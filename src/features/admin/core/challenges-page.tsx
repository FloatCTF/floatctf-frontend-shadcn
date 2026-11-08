/**
 * 挑战管理（`/admin/challenges`）—— CRUD + 导入 / 校验 / 构建 / 扫描。
 *
 * 真实接口：`client.admin.challenges.*`（`fetch` / `create` / `patch` / `remove` /
 * `importChallenge(package_zip)` / `checkChallenges(challenge_id_list?)` /
 * `buildChallenges(challenge_id_list?)` / `scanChallenges()`）。
 *
 * 语义要点（读后端 `catalog/admin.rs` 与 `build/mod.rs` 核实）：
 * - 手工 create 只接受 name / category / description / hidden（版本内容只能经包导入进入）；
 * - `static_flag_value` 是**明文 flag**：列表里必须用 `<SecretValue>` 渲染；
 * - `container_port` 为 null = 没有 docker 运行时（static / attachment-only）；
 * - `build` 不是重新构建，而是「确保当前版本 pin 的镜像在本地存在」（必要时按 digest 拉取），
 *   只对 `build_status=ready` 的题目生效。
 *
 * 所有用户可见文案走 `adminCore.challenges.*` / `adminCore.form.*` / `adminCore.ops.*`。
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import {
	Eye,
	EyeOff,
	FileUp,
	Hammer,
	Lock,
	Pencil,
	Plus,
	RefreshCw,
	ScanSearch,
	ShieldCheck,
	Trash2,
} from "lucide-react";

import { call, callList, uploadFile } from "~/api/call";
import { useAppQueryClient, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import {
	MonoText,
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { formatBytes } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";
import type {
	BuildChallengeResult,
	ChallengeCheckResult,
	ChallengeScanItem,
	ChallengesListItem,
	ImportChallengeResponse,
	QueryParams,
} from "@floatctf/sdk";

import { BuildResultTable, ScanResultTable } from "./ops";
import {
	BuildStatusPill,
	ResultsCard,
	RowMenu,
	SearchInput,
	parseIntInput,
	useAdminListState,
} from "./shared";

const SEARCH_KEYS = ["name", "safe_name", "category"];

interface ChallengeFormState {
	name: string;
	category: string;
	description: string;
	hidden: boolean;
	staticFlagValue: string;
	containerPort: string;
	cpuMillis: string;
	memoryBytes: string;
	pidsLimit: string;
}

type ChallengeFormErrors = Partial<Record<keyof ChallengeFormState, string>>;

const EMPTY_FORM: ChallengeFormState = {
	name: "",
	category: "",
	description: "",
	hidden: true,
	staticFlagValue: "",
	containerPort: "",
	cpuMillis: "",
	memoryBytes: "",
	pidsLimit: "",
};

function validate(form: ChallengeFormState, mode: "create" | "edit", t: TFunction): ChallengeFormErrors {
	const errors: ChallengeFormErrors = {};
	if (!form.name.trim()) errors.name = t("adminCore.challenges.validation.nameRequired");
	// 后端 create 用 name 派生 safe_name；没有 ASCII 字母/数字时必然失败。
	else if (mode === "create" && !/[A-Za-z0-9]/.test(form.name)) {
		errors.name = t("adminCore.challenges.validation.safeNameRequired");
	}
	if (!form.category.trim()) {
		errors.category = t("adminCore.challenges.validation.categoryRequired");
	}
	if (mode === "edit") {
		const port = parseIntInput(form.containerPort);
		if (port.kind === "invalid") {
			errors.containerPort = t("adminCore.challenges.validation.portRange");
		} else if (port.kind === "ok" && (port.value < 1 || port.value > 65535)) {
			errors.containerPort = t("adminCore.challenges.validation.portRange");
		}
		for (const [key, label] of [
			["cpuMillis", t("adminCore.form.labels.recommendedCpu")],
			["memoryBytes", t("adminCore.form.labels.recommendedMemory")],
			["pidsLimit", t("adminCore.form.labels.recommendedPids")],
		] as const) {
			const parsed = parseIntInput(form[key]);
			if (parsed.kind === "invalid") {
				errors[key] = t("adminCore.form.integerField", { label });
			} else if (parsed.kind === "ok" && parsed.value <= 0) {
				errors[key] = t("adminCore.form.positiveField", { label });
			}
		}
	}
	return errors;
}

export function AdminChallengesPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCore.challenges.documentTitle"));
	const client = useClient();
	const queryClient = useAppQueryClient();
	const confirm = useConfirm();
	const list = useAdminListState(SEARCH_KEYS);

	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	// 筛选条件变化后，已选中但被筛掉的行不能再进入批量删除：
	// 用户看不到它们，却会在确认框里删掉。
	useEffect(() => {
		setSelectedIds([]);
	}, [list.filter]);
	const [editing, setEditing] = useState<{ mode: "create" | "edit"; row?: ChallengesListItem } | null>(
		null,
	);
	const [form, setForm] = useState<ChallengeFormState>(EMPTY_FORM);
	const [errors, setErrors] = useState<ChallengeFormErrors>({});
	const [showStaticFlag, setShowStaticFlag] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [progress, setProgress] = useState(0);
	const [imported, setImported] = useState<ChallengesListItem | null>(null);

	const [scanItems, setScanItems] = useState<ChallengeScanItem[] | null>(null);
	const [checkItems, setCheckItems] = useState<ChallengeCheckResult[] | null>(null);
	const [buildItems, setBuildItems] = useState<BuildChallengeResult[] | null>(null);

	const params: QueryParams = {
		page: list.page,
		limit: list.pageSize,
		...(list.filter ? { filter: list.filter } : {}),
	};

	const query = useQuery({
		queryKey: qk.admin.challenges(params),
		queryFn: () => callList<ChallengesListItem>(client.admin.challenges.fetch(params)),
	});

	function invalidate(): void {
		void queryClient.invalidateQueries({ queryKey: qk.admin.challenges() });
	}

	const save = useMutation({
		mutationFn: (input: { mode: "create" | "edit"; id?: string; body: ChallengeFormState }) => {
			const { body } = input;
			if (input.mode === "create") {
				// 手工创建只有身份字段；版本 / 镜像 / flag 由包导入写入。
				return call<ChallengesListItem>(
					client.admin.challenges.create({
						name: body.name.trim(),
						category: body.category.trim(),
						description: body.description,
						hidden: body.hidden,
					}),
					t("adminCore.actions.createChallenge"),
				);
			}
			const port = parseIntInput(body.containerPort);
			const cpu = parseIntInput(body.cpuMillis);
			const memory = parseIntInput(body.memoryBytes);
			const pids = parseIntInput(body.pidsLimit);
			// patch(Partial<ChallengesListItem>) 的 URL 用 `.id` 拼接，**必须**带 id。
			return call<ChallengesListItem>(
				client.admin.challenges.patch({
					id: input.id ?? "",
					name: body.name.trim(),
					category: body.category.trim(),
					description: body.description,
					hidden: body.hidden,
					// 空串 = 清空明文 flag（后端 `filter(|s| !s.trim().is_empty())`）。
					static_flag_value: body.staticFlagValue,
					// 显式 null = 清空容器端口（变为无 docker 运行时）。
					container_port: port.kind === "ok" ? port.value : null,
					...(cpu.kind === "ok" ? { recommended_cpu_millis: cpu.value } : {}),
					...(memory.kind === "ok" ? { recommended_memory_bytes: memory.value } : {}),
					...(pids.kind === "ok" ? { recommended_pids_limit: pids.value } : {}),
				}),
				t("adminCore.actions.updateChallenge"),
			);
		},
		onSuccess: (_data, input) => {
			toast.success(
				input.mode === "create"
					? t("adminCore.challenges.toasts.created")
					: t("adminCore.challenges.toasts.updated"),
			);
			invalidate();
			setEditing(null);
			setErrors({});
		},
		onError: (error) => toast.apiError(t("adminCore.challenges.toasts.saveFailed"), error),
	});

	const remove = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(client.admin.challenges.remove(ids), t("adminCore.actions.deleteChallenges")),
		onSuccess: (count) => {
			toast.success(
				t("adminCore.challenges.toasts.deleted", { count }),
				t("adminCore.challenges.toasts.deletedDescription"),
			);
			invalidate();
			setSelectedIds([]);
		},
		onError: (error) => toast.apiError(t("adminCore.challenges.toasts.deleteFailed"), error),
	});

	const importMutation = useMutation({
		mutationFn: (selected: File) =>
			uploadFile<ImportChallengeResponse>({
				client,
				scope: "admin",
				url: "/challenges/import",
				field: "package_zip",
				file: selected,
				onProgress: setProgress,
			}),
		onSuccess: (data) => {
			setImported(data.challenge);
			setFile(null);
			setProgress(0);
			toast.success(
				t("adminCore.challenges.toasts.imported"),
				t("adminCore.challenges.toasts.importedDescription", { name: data.challenge.name }),
			);
			invalidate();
		},
		onError: (error) => {
			setProgress(0);
			toast.apiError(t("adminCore.challenges.toasts.importFailed"), error);
		},
	});

	const scan = useMutation({
		mutationFn: () =>
			call<ChallengeScanItem[]>(
				client.admin.challenges.scanChallenges(),
				t("adminCore.actions.scanChallenges"),
			),
		onSuccess: (items) => {
			setScanItems(items);
			const failed = items.filter((item) => item.status === "error").length;
			if (failed > 0) {
				toast.warning(
					t("adminCore.challenges.toasts.scanWarning", {
						count: items.length,
						failed,
					}),
				);
			} else {
				toast.success(
					t("adminCore.challenges.toasts.scanSuccess", { count: items.length }),
				);
			}
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminCore.challenges.toasts.scanFailed"), error),
	});

	const check = useMutation({
		mutationFn: (ids?: string[]) =>
			call<ChallengeCheckResult[]>(
				client.admin.challenges.checkChallenges(ids),
				t("adminCore.actions.checkChallenges"),
			),
		onSuccess: (items) => {
			setCheckItems(items);
			const failed = items.filter((item) => !item.is_ok).length;
			if (failed > 0) {
				toast.warning(
					t("adminCore.challenges.toasts.checkWarning", {
						count: items.length,
						failed,
					}),
				);
			} else {
				toast.success(
					t("adminCore.challenges.toasts.checkSuccess", { count: items.length }),
				);
			}
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminCore.challenges.toasts.checkFailed"), error),
	});

	const build = useMutation({
		mutationFn: (ids?: string[]) =>
			call<BuildChallengeResult[]>(
				client.admin.challenges.buildChallenges(ids),
				t("adminCore.actions.buildChallenges"),
			),
		onSuccess: (items) => {
			setBuildItems(items);
			const failed = items.filter((item) => !item.is_ok);
			if (items.length === 0) {
				toast.warning(
					t("adminCore.challenges.toasts.buildEmptyTitle"),
					t("adminCore.challenges.toasts.buildEmptyDescription"),
				);
			} else if (failed.length > 0) {
				toast.error(
					t("adminCore.challenges.toasts.buildFailedTitle", { count: failed.length }),
					failed[0]?.message,
				);
			} else {
				toast.success(
					t("adminCore.challenges.toasts.buildSuccess", { count: items.length }),
				);
			}
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminCore.challenges.toasts.buildFailed"), error),
	});

	function openCreate(): void {
		setForm(EMPTY_FORM);
		setErrors({});
		setShowStaticFlag(false);
		setEditing({ mode: "create" });
	}

	function openEdit(row: ChallengesListItem): void {
		setForm({
			name: row.name,
			category: row.category,
			description: row.description,
			hidden: row.hidden,
			staticFlagValue: row.static_flag_value ?? "",
			containerPort: row.container_port === null || row.container_port === undefined
				? ""
				: String(row.container_port),
			cpuMillis: row.recommended_cpu_millis ? String(row.recommended_cpu_millis) : "",
			memoryBytes: row.recommended_memory_bytes ? String(row.recommended_memory_bytes) : "",
			pidsLimit: row.recommended_pids_limit ? String(row.recommended_pids_limit) : "",
		});
		setErrors({});
		setShowStaticFlag(false);
		setEditing({ mode: "edit", row });
	}

	function submit(): void {
		if (!editing) return;
		const nextErrors = validate(form, editing.mode, t);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			toast.warning(t("adminCore.form.fixErrors"));
			return;
		}
		save.mutate({ mode: editing.mode, id: editing.row?.id, body: form });
	}

	async function confirmRemoveOne(row: ChallengesListItem): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.challenges.confirm.deleteOneTitle", { name: row.name }),
			description: t("adminCore.challenges.confirm.deleteDescription"),
			consequences: [
				t("adminCore.challenges.confirm.deleteConsequence1"),
				t("adminCore.challenges.confirm.deleteConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.challenges.confirm.delete"),
			confirmPhrase: row.name,
		});
		if (ok) remove.mutate([row.id]);
	}

	async function confirmRemoveSelected(): Promise<void> {
		if (selectedIds.length === 0) {
			toast.warning(t("adminCore.challenges.toasts.selectForDelete"));
			return;
		}
		const ok = await confirm({
			title: t("adminCore.challenges.confirm.deleteSelectedTitle", {
				count: selectedIds.length,
			}),
			description: t("adminCore.challenges.confirm.deleteDescription"),
			consequences: [
				t("adminCore.challenges.confirm.deleteSelectedConsequence1", {
					count: selectedIds.length,
				}),
				t("adminCore.challenges.confirm.deleteSelectedConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.challenges.confirm.delete"),
			confirmPhrase: "delete",
		});
		if (ok) remove.mutate(selectedIds);
	}

	async function confirmBuild(ids: string[]): Promise<void> {
		const ok = await confirm({
			title:
				ids.length === 1
					? t("adminCore.challenges.confirm.buildOneTitle")
					: t("adminCore.challenges.confirm.buildSelectedTitle", { count: ids.length }),
			description: t("adminCore.challenges.confirm.buildDescription"),
			consequences: [
				t("adminCore.challenges.confirm.buildConsequence1"),
				t("adminCore.challenges.confirm.buildConsequence2"),
				t("adminCore.challenges.confirm.buildConsequence3"),
			],
			tone: "default",
			confirmText: t("adminCore.challenges.confirm.buildConfirm"),
		});
		if (ok) build.mutate(ids.length > 0 ? ids : undefined);
	}

	async function confirmScan(): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.challenges.confirm.scanTitle"),
			description: t("adminCore.challenges.confirm.scanDescription"),
			consequences: [
				t("adminCore.challenges.confirm.scanConsequence1"),
				t("adminCore.challenges.confirm.scanConsequence2"),
			],
			tone: "default",
			confirmText: t("adminCore.challenges.confirm.scanConfirm"),
		});
		if (ok) scan.mutate();
	}

	async function confirmImport(): Promise<void> {
		if (!file) return;
		const ok = await confirm({
			title: t("adminCore.challenges.confirm.importTitle", { file: file.name }),
			description: t("adminCore.challenges.confirm.importDescription"),
			consequences: [
				t("adminCore.challenges.confirm.importConsequence1"),
				t("adminCore.challenges.confirm.importConsequence2"),
				t("adminCore.challenges.confirm.importConsequence3"),
			],
			tone: "default",
			confirmText: t("adminCore.challenges.confirm.importConfirm"),
		});
		if (ok) importMutation.mutate(file);
	}

	const columns: DataTableColumn<ChallengesListItem>[] = [
		{
			id: "id",
			header: t("adminCore.challenges.columns.id"),
			sortValue: (row) => row.id,
			cell: (row) => <MonoText className="text-muted-foreground">{row.id}</MonoText>,
			hideBelow: "md",
		},
		{
			id: "name",
			header: t("adminCore.challenges.columns.challenge"),
			cell: (row) => <span className="text-sm font-medium">{row.name}</span>,
			sortValue: (row) => row.name,
		},
		{
			id: "safe_name",
			header: t("adminCore.challenges.columns.safeName"),
			cell: (row) => <MonoText>{row.safe_name}</MonoText>,
			sortValue: (row) => row.safe_name,
			hideBelow: "md",
		},
		{
			id: "category",
			header: t("adminCore.challenges.columns.category"),
			cell: (row) => <span className="text-sm">{row.category || "—"}</span>,
			sortValue: (row) => row.category,
		},
		{
			id: "version",
			header: t("adminCore.challenges.columns.versionBuild"),
			cell: (row) => (
				<div className="flex flex-wrap items-center gap-1">
					<MonoText>{row.version ?? "—"}</MonoText>
					<BuildStatusPill status={row.build_status} />
				</div>
			),
			sortValue: (row) => row.version ?? "",
		},
		{
			id: "image",
			header: t("adminCore.challenges.columns.image"),
			cell: (row) =>
				row.image_ref ? (
					<div className="min-w-0">
						<MonoText title={row.image_ref}>{row.image_ref}</MonoText>
						{row.image_repo_digest ? (
							<span
								className="ml-1 inline-flex text-muted-foreground"
								role="img"
								aria-label={t("adminCore.common.repositoryPinned")}
								title={t("adminCore.common.repositoryPinned")}
							>
								<Lock className="size-4" aria-hidden="true" />
							</span>
						) : null}
					</div>
				) : (
					<span className="text-xs text-muted-foreground">
						{t("adminCore.challenges.noImage")}
					</span>
				),
			hideBelow: "lg",
		},
		{
			id: "hidden",
			header: t("adminCore.challenges.columns.visibility"),
			cell: (row) => (
				<TonePill tone={row.hidden ? "muted" : "success"}>
					{row.hidden
						? t("adminCore.common.visibility.hidden")
						: t("adminCore.common.visibility.public")}
				</TonePill>
			),
			sortValue: (row) => (row.hidden ? 1 : 0),
			hideBelow: "sm",
		},
	];

	const canBuild = (row: ChallengesListItem): boolean =>
		row.build_status === "ready" && row.container_port !== null && row.container_port !== undefined;

	return (
		<PageBody>
			<PageHeader
				title={t("adminCore.challenges.title")}
				description={t("adminCore.challenges.description")}
				actions={
					<Toolbar>
						<Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
							<RefreshCw
								className={query.isFetching ? "animate-spin" : undefined}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</Button>
						<Button onClick={openCreate}>
							<Plus aria-hidden="true" /> {t("adminCore.challenges.new")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminCore.challenges.listTitle")}
				description={t("adminCore.challenges.listDescription")}
				actions={
					<Toolbar>
						<SearchInput
							value={list.search}
							onChange={list.setSearch}
							placeholder={t("adminCore.challenges.searchPlaceholder")}
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void confirmScan()}
							disabled={scan.isPending}
						>
							<ScanSearch aria-hidden="true" />{" "}
							{scan.isPending
								? t("adminCore.challenges.scanning")
								: t("adminCore.challenges.scan")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => check.mutate(selectedIds.length > 0 ? selectedIds : undefined)}
							disabled={check.isPending}
						>
							<ShieldCheck aria-hidden="true" />{" "}
							{check.isPending
								? t("adminCore.challenges.checking")
								: selectedIds.length > 0
									? t("adminCore.challenges.checkSelected")
									: t("adminCore.challenges.checkAll")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={importMutation.isPending}
						>
							<FileUp aria-hidden="true" /> {t("adminCore.challenges.choosePackage")}
						</Button>
						{selectedIds.length > 0 ? (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={() => void confirmBuild(selectedIds)}
									disabled={build.isPending}
								>
									<Hammer aria-hidden="true" />{" "}
									{t("adminCore.challenges.buildSelected", { count: selectedIds.length })}
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => void confirmRemoveSelected()}
									disabled={remove.isPending}
								>
									<Trash2 aria-hidden="true" />{" "}
									{t("adminCore.challenges.deleteSelected", { count: selectedIds.length })}
								</Button>
							</>
						) : null}
					</Toolbar>
				}
				contentClassName="p-0"
				footer={
					// 数据到位前不渲染分页条，避免出现「共 0 条」这种与事实不符的文案。
					query.data ? (
						<PaginationBar
							page={list.page}
							pageSize={list.pageSize}
							total={query.data.meta?.total ?? 0}
							onPageChange={list.setPage}
							onPageSizeChange={list.setPageSize}
						/>
					) : null
				}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept=".zip,application/zip"
					className="hidden"
					onChange={async (event) => {
						const selected = event.target.files?.[0] ?? null;
						event.target.value = "";
						if (!selected) return;
						if (!selected.name.toLowerCase().endsWith(".zip")) {
							toast.error(
								t("adminCore.challenges.toasts.zipOnly"),
								t("adminCore.challenges.toasts.zipOnlyDescription"),
							);
							return;
						}
						const head = new Uint8Array(await selected.slice(0, 4).arrayBuffer());
						if (
							head[0] !== 0x50 ||
							head[1] !== 0x4b ||
							(head[2] !== 0x03 && head[2] !== 0x05 && head[2] !== 0x07)
						) {
							toast.error(t("adminCore.common.invalidZip"));
							return;
						}
						setFile(selected);
						setImported(null);
					}}
				/>

				{file ? (
					<div className="space-y-2 border-b bg-muted/30 px-4 py-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">{file.name}</p>
								<p className="tnum text-xs text-muted-foreground">
									{t("adminCore.common.syncBuildHint", { size: formatBytes(file.size) })}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="ghost" size="sm" onClick={() => setFile(null)}>
									{t("common.cancel")}
								</Button>
								<Button
									size="sm"
									onClick={() => void confirmImport()}
									disabled={importMutation.isPending}
								>
									<FileUp aria-hidden="true" />{" "}
									{importMutation.isPending
										? t("adminCore.common.importing")
										: t("adminCore.common.startImport")}
								</Button>
							</div>
						</div>
						{importMutation.isPending || progress > 0 ? (
							<div className="space-y-1">
								<Progress
									value={progress}
									aria-label={t("adminCore.common.uploadProgressLabel")}
								/>
								<p className="tnum text-xs text-muted-foreground">
									{t("adminCore.common.uploadProgress", { percent: progress })}
								</p>
							</div>
						) : null}
					</div>
				) : null}

				{imported ? (
					<div className="flex flex-wrap items-center gap-3 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
						<span className="font-medium">{t("adminCore.common.importSuccess")}</span>
						<span>{imported.name}</span>
						<MonoText>{imported.safe_name}</MonoText>
						<MonoText>
							{t("adminCore.common.versionShort", { version: imported.version ?? "—" })}
						</MonoText>
						<BuildStatusPill status={imported.build_status} />
						{imported.build_error ? (
							<span className="text-xs text-destructive">{imported.build_error}</span>
						) : null}
					</div>
				) : null}

				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={5} />}
					errorTitle={t("adminCore.challenges.error")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						list.filter ? (
							<EmptyBlock
								variant="filtered"
								title={t("adminCore.challenges.filtered.title")}
								description={t("adminCore.challenges.filtered.description", {
									query: list.search,
								})}
							/>
						) : (
							<EmptyBlock
								title={t("adminCore.challenges.empty.title")}
								description={t("adminCore.challenges.empty.description")}
								action={
									<Button size="sm" onClick={() => fileInputRef.current?.click()}>
										<FileUp aria-hidden="true" />{" "}
										{t("adminCore.challenges.choosePackage")}
									</Button>
								}
							/>
						)
					}
				>
					{(result) => (
						<DataTable
							data={result.items}
							getRowId={(row) => row.id}
							columns={columns}
							selectable
							selectedIds={selectedIds}
							onSelectionChange={setSelectedIds}
							mobileCard={(row) => (
								<div className="space-y-1.5">
									<div className="flex items-start justify-between gap-2">
										<span className="text-sm font-medium">{row.name}</span>
										<BuildStatusPill status={row.build_status} />
									</div>
									<MonoText className="text-muted-foreground">
										{row.safe_name} · {row.category} ·{" "}
										{t("adminCore.common.versionShort", {
											version: row.version ?? "—",
										})}
									</MonoText>
									{row.image_ref ? <MonoText>{row.image_ref}</MonoText> : null}
									<div className="flex flex-wrap gap-2 pt-1">
										<Button variant="outline" size="sm" onClick={() => openEdit(row)}>
											<Pencil aria-hidden="true" /> {t("common.edit")}
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => check.mutate([row.id])}
											disabled={check.isPending}
										>
											<ShieldCheck aria-hidden="true" />{" "}
											{t("adminCore.challenges.check")}
										</Button>
										{canBuild(row) ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => void confirmBuild([row.id])}
												disabled={build.isPending}
											>
												<Hammer aria-hidden="true" />{" "}
												{t("adminCore.challenges.build")}
											</Button>
										) : null}
										<Button
											variant="destructive"
											size="sm"
											onClick={() => void confirmRemoveOne(row)}
										>
											<Trash2 aria-hidden="true" /> {t("common.delete")}
										</Button>
									</div>
								</div>
							)}
							rowActions={(row) => (
								<RowMenu
									label={t("adminCore.challenges.rowMenu", { name: row.name })}
								>
									<DropdownMenuItem onSelect={() => openEdit(row)}>
										<Pencil aria-hidden="true" /> {t("common.edit")}
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => check.mutate([row.id])}>
										<ShieldCheck aria-hidden="true" />{" "}
										{t("adminCore.challenges.checkOne")}
									</DropdownMenuItem>
									{canBuild(row) ? (
										<DropdownMenuItem onSelect={() => void confirmBuild([row.id])}>
											<Hammer aria-hidden="true" />{" "}
											{t("adminCore.challenges.buildImage")}
										</DropdownMenuItem>
									) : null}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onSelect={() => void confirmRemoveOne(row)}
									>
										<Trash2 aria-hidden="true" /> {t("common.delete")}
									</DropdownMenuItem>
								</RowMenu>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>

			{scanItems ? (
				<ResultsCard
					title={t("adminCore.challenges.results.scanTitle")}
					description={t("adminCore.challenges.results.scanDescription", {
						count: scanItems.length,
					})}
					onDismiss={() => setScanItems(null)}
				>
					<ScanResultTable items={scanItems} />
				</ResultsCard>
			) : null}

			{checkItems ? (
				<ResultsCard
					title={t("adminCore.challenges.results.checkTitle")}
					description={t("adminCore.challenges.results.checkDescription", {
						count: checkItems.length,
						failed: checkItems.filter((item) => !item.is_ok).length,
					})}
					onDismiss={() => setCheckItems(null)}
				>
					<CheckResultTable
						items={checkItems}
						onBuild={(id) => void confirmBuild([id])}
						building={build.isPending}
					/>
				</ResultsCard>
			) : null}

			{buildItems ? (
				<ResultsCard
					title={t("adminCore.challenges.results.buildTitle")}
					description={t("adminCore.challenges.results.buildDescription")}
					onDismiss={() => setBuildItems(null)}
				>
					<BuildResultTable
						items={buildItems}
						nameOf={(row) => row.challenge_name}
						label={t("adminCore.challenges.columns.challenge")}
					/>
				</ResultsCard>
			) : null}

			<FormSheet
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				title={
					editing?.mode === "edit"
						? t("adminCore.challenges.sheet.editTitle")
						: t("adminCore.challenges.sheet.createTitle")
				}
				description={
					editing?.mode === "edit"
						? t("adminCore.challenges.sheet.editDescription")
						: t("adminCore.challenges.sheet.createDescription")
				}
				width="lg"
				footer={
					<FormFooter
						onCancel={() => setEditing(null)}
						submitLabel={
							editing?.mode === "edit"
								? t("adminCore.challenges.sheet.submitSave")
								: t("adminCore.challenges.sheet.submitCreate")
						}
						isPending={save.isPending}
						formId="admin-challenge-form"
					/>
				}
			>
				<form
					id="admin-challenge-form"
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<FormGrid columns={2}>
						<Field
							label={t("adminCore.challenges.sheet.name")}
							htmlFor="challenge-name"
							required
							error={errors.name}
							hint={t("adminCore.challenges.sheet.nameHint")}
						>
							<Input
								id="challenge-name"
								value={form.name}
								onChange={(event) => setForm({ ...form, name: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.challenges.sheet.category")}
							htmlFor="challenge-category"
							required
							error={errors.category}
							hint={t("adminCore.challenges.sheet.categoryHint")}
						>
							<Input
								id="challenge-category"
								value={form.category}
								onChange={(event) => setForm({ ...form, category: event.target.value })}
							/>
						</Field>
					</FormGrid>
					<Field
						label={t("adminCore.challenges.sheet.description")}
						htmlFor="challenge-description"
						hint={t("adminCore.challenges.sheet.descriptionHint")}
					>
						<Textarea
							id="challenge-description"
							rows={4}
							value={form.description}
							onChange={(event) => setForm({ ...form, description: event.target.value })}
						/>
					</Field>
					<div className="flex items-center justify-between rounded-lg border px-3 py-2">
						<div>
							<p className="text-sm font-medium">{t("adminCore.challenges.sheet.hidden")}</p>
							<p className="text-xs text-muted-foreground">
								{t("adminCore.challenges.sheet.hiddenHint")}
							</p>
						</div>
						<Switch
							checked={form.hidden}
							onCheckedChange={(checked) => setForm({ ...form, hidden: checked })}
							aria-label={t("adminCore.challenges.sheet.hiddenAria")}
						/>
					</div>

					{editing?.mode === "edit" ? (
						<>
							<Field
								label={t("adminCore.challenges.sheet.staticFlag")}
								htmlFor="challenge-static-flag"
								error={errors.staticFlagValue}
								hint={t("adminCore.challenges.sheet.staticFlagHint")}
							>
								<div className="flex gap-2">
									<Input
										id="challenge-static-flag"
										type={showStaticFlag ? "text" : "password"}
										autoComplete="off"
										spellCheck={false}
										className="font-mono text-xs"
										value={form.staticFlagValue}
										onChange={(event) =>
											setForm({ ...form, staticFlagValue: event.target.value })
										}
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										aria-label={
											showStaticFlag
												? t("adminCore.challenges.sheet.hideStaticFlag")
												: t("adminCore.challenges.sheet.showStaticFlag")
										}
										title={
											showStaticFlag
												? t("adminCore.challenges.sheet.hideStaticFlag")
												: t("adminCore.challenges.sheet.showStaticFlag")
										}
										onClick={() => setShowStaticFlag((value) => !value)}
									>
										{showStaticFlag ? (
											<EyeOff aria-hidden="true" />
										) : (
											<Eye aria-hidden="true" />
										)}
									</Button>
								</div>
							</Field>
							<FormGrid columns={2}>
								<Field
									label={t("adminCore.challenges.sheet.port")}
									htmlFor="challenge-port"
									error={errors.containerPort}
									hint={t("adminCore.challenges.sheet.portHint")}
								>
									<Input
										id="challenge-port"
										inputMode="numeric"
										value={form.containerPort}
										onChange={(event) =>
											setForm({ ...form, containerPort: event.target.value })
										}
									/>
								</Field>
								<Field
									label={t("adminCore.challenges.sheet.cpu")}
									htmlFor="challenge-cpu"
									error={errors.cpuMillis}
									hint={t("adminCore.challenges.sheet.leaveEmptyHint")}
								>
									<Input
										id="challenge-cpu"
										inputMode="numeric"
										value={form.cpuMillis}
										onChange={(event) =>
											setForm({ ...form, cpuMillis: event.target.value })
										}
									/>
								</Field>
								<Field
									label={t("adminCore.challenges.sheet.memory")}
									htmlFor="challenge-memory"
									error={errors.memoryBytes}
									hint={t("adminCore.challenges.sheet.leaveEmptyHint")}
								>
									<Input
										id="challenge-memory"
										inputMode="numeric"
										value={form.memoryBytes}
										onChange={(event) =>
											setForm({ ...form, memoryBytes: event.target.value })
										}
									/>
								</Field>
								<Field
									label={t("adminCore.challenges.sheet.pids")}
									htmlFor="challenge-pids"
									error={errors.pidsLimit}
									hint={t("adminCore.challenges.sheet.leaveEmptyHint")}
								>
									<Input
										id="challenge-pids"
										inputMode="numeric"
										value={form.pidsLimit}
										onChange={(event) =>
											setForm({ ...form, pidsLimit: event.target.value })
										}
									/>
								</Field>
							</FormGrid>
						</>
					) : null}
				</form>
			</FormSheet>
		</PageBody>
	);
}

/** 校验结果表（challenges 专属：多一列 static / attachment-only 语义）。 */
function CheckResultTable({
	items,
	onBuild,
	building,
}: {
	items: ChallengeCheckResult[];
	onBuild: (id: string) => void;
	building: boolean;
}): ReactNode {
	const { t } = useTranslation();
	const columns: DataTableColumn<ChallengeCheckResult>[] = [
		{
			id: "challenge_name",
			header: t("adminCore.challenges.checkTable.challenge"),
			cell: (row) => <span className="text-sm font-medium">{row.challenge_name}</span>,
			sortValue: (row) => row.challenge_name,
		},
		{
			id: "docker_image",
			header: t("adminCore.challenges.checkTable.image"),
			cell: (row) => {
				if (row.static_content) {
					return <TonePill tone="muted">{t("adminCore.challenges.checkTable.staticOnly")}</TonePill>;
				}
				if (row.docker_image) {
					return <TonePill tone="success">{t("adminCore.challenges.checkTable.ready")}</TonePill>;
				}
				return (
					<Button variant="outline" size="xs" onClick={() => onBuild(row.id)} disabled={building}>
						<Hammer aria-hidden="true" /> {t("adminCore.challenges.build")}
					</Button>
				);
			},
			sortValue: (row) => (row.docker_image ? 1 : 0),
		},
		{
			id: "attachment",
			header: t("adminCore.challenges.checkTable.attachment"),
			cell: (row) => (
				<TonePill tone={row.attachment ? "success" : "muted"}>
					{row.attachment
						? t("adminCore.challenges.checkTable.present")
						: t("adminCore.challenges.checkTable.absent")}
				</TonePill>
			),
			sortValue: (row) => (row.attachment ? 1 : 0),
			hideBelow: "sm",
		},
		{
			id: "is_ok",
			header: t("adminCore.challenges.checkTable.conclusion"),
			cell: (row) => (
				<TonePill tone={row.is_ok ? "success" : "danger"}>
					{row.is_ok
						? t("adminCore.challenges.checkTable.ok")
						: t("adminCore.challenges.checkTable.notOk")}
				</TonePill>
			),
			sortValue: (row) => (row.is_ok ? 1 : 0),
		},
	];

	return (
		<DataTable
			data={items}
			getRowId={(row) => row.id}
			columns={columns}
			mobileCard={(row) => (
				<div className="space-y-1.5">
					<div className="flex items-center justify-between gap-2">
						<span className="text-sm font-medium">{row.challenge_name}</span>
						<TonePill tone={row.is_ok ? "success" : "danger"}>
							{row.is_ok
								? t("adminCore.challenges.checkTable.ok")
								: t("adminCore.challenges.checkTable.notOk")}
						</TonePill>
					</div>
					<p className="text-xs text-muted-foreground">
						{row.static_content
							? t("adminCore.challenges.checkTable.mobileStatic", {
									image: row.docker_image
										? t("adminCore.challenges.checkTable.ready")
										: t("adminCore.challenges.checkTable.missing"),
									attachment: row.attachment
										? t("adminCore.challenges.checkTable.present")
										: t("adminCore.challenges.checkTable.absent"),
									static: t("adminCore.challenges.checkTable.staticOnly"),
								})
							: t("adminCore.challenges.checkTable.mobile", {
									image: row.docker_image
										? t("adminCore.challenges.checkTable.ready")
										: t("adminCore.challenges.checkTable.missing"),
									attachment: row.attachment
										? t("adminCore.challenges.checkTable.present")
										: t("adminCore.challenges.checkTable.absent"),
								})}
					</p>
				</div>
			)}
			empty={<span>{t("adminCore.challenges.checkTable.empty")}</span>}
		/>
	);
}
