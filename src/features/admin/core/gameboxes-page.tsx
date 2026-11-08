/**
 * GameBox 库管理（`/admin/gameboxes`）—— 导入 / 扫描 / 校验 / 构建 / 隐藏 / 删除 / 更新。
 *
 * 真实接口（`client.awd.admin.*`，与 `client.service.awd` 无关的管理端作用域）：
 * `listGameboxes` / `importGamebox(package_zip)` / `updateGamebox(id, body)` /
 * `hideGamebox(id)` / `removeGamebox(id_list)` / `scanGameboxes()` /
 * `checkGameboxes(gamebox_id_list?)` / `buildGameboxes(gamebox_id_list?)`。
 *
 * JSON 字段陷阱（已按后端源码核实）：
 * - **读**：`healthchecks_json` / `judge_args_json` 是 `unknown | null`；
 * - **写**：`PATCH` 要求 JSON **字符串**（后端会 `serde_json::from_str`），显式 `null` = 清空；
 *   没改动的字段**不发**，避免把 `unknown` 重新序列化后写回。
 *
 * 所有用户可见文案走 `adminCore.gameboxes.*` / `adminCore.form.*` / `adminCore.ops.*`。
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import {
	EyeOff,
	FileUp,
	Hammer,
	Lock,
	Pencil,
	RefreshCw,
	ScanSearch,
	ShieldCheck,
	Trash2,
} from "lucide-react";

import { call, callList, uploadFile, callVoid } from "~/api/call";
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
	GameBoxBuildResult,
	GameBoxCheckResult,
	GameBoxLibraryDto,
	GameBoxScanItem,
	ImportGameBoxResponse,
	QueryParams,
} from "@floatctf/sdk";

import { BuildResultTable, ScanResultTable } from "./ops";
import {
	BuildStatusPill,
	ResultsCard,
	RowMenu,
	SearchInput,
	formatJsonText,
	parseIntInput,
	parseJsonInput,
	useAdminListState,
} from "./shared";

const SEARCH_KEYS = ["name", "safe_name", "category"];

interface GameboxFormState {
	name: string;
	category: string;
	description: string;
	hidden: boolean;
	username: string;
	cpuMillis: string;
	memoryBytes: string;
	pidsLimit: string;
	healthchecksJson: string;
	judgeScriptName: string;
	judgeScriptContent: string;
	judgeArgsJson: string;
	judgeTimeoutSecs: string;
	judgeRetryIntervalSecs: string;
}

type GameboxFormErrors = Partial<Record<keyof GameboxFormState, string>>;

interface GameboxOriginal {
	healthchecksJson: string;
	judgeArgsJson: string;
}

const EMPTY_FORM: GameboxFormState = {
	name: "",
	category: "",
	description: "",
	hidden: false,
	username: "",
	cpuMillis: "",
	memoryBytes: "",
	pidsLimit: "",
	healthchecksJson: "",
	judgeScriptName: "",
	judgeScriptContent: "",
	judgeArgsJson: "",
	judgeTimeoutSecs: "",
	judgeRetryIntervalSecs: "",
};

/** JSON 文本字段的统一取值：空 → null（清空）；与原值相同 → undefined（不动）；否则必须是合法 JSON。 */
function resolveJsonPatch(
	text: string,
	original: string,
	field: keyof GameboxFormErrors,
	errors: GameboxFormErrors,
	t: TFunction,
): string | null | undefined {
	const trimmed = text.trim();
	if (trimmed === "") return null;
	if (trimmed === original.trim()) return undefined;
	const parsed = parseJsonInput(trimmed);
	if (!parsed.ok) {
		errors[field] = t("adminCore.form.jsonInvalid", { error: parsed.error });
		return undefined;
	}
	return JSON.stringify(parsed.value);
}

function validate(
	form: GameboxFormState,
	original: GameboxOriginal,
	t: TFunction,
): GameboxFormErrors {
	const errors: GameboxFormErrors = {};
	if (!form.name.trim()) errors.name = t("adminCore.gameboxes.validation.nameRequired");
	if (!form.category.trim()) {
		errors.category = t("adminCore.gameboxes.validation.categoryRequired");
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

	for (const [key, label] of [
		["judgeTimeoutSecs", t("adminCore.form.labels.judgeTimeout")],
		["judgeRetryIntervalSecs", t("adminCore.form.labels.judgeRetryInterval")],
	] as const) {
		const parsed = parseIntInput(form[key]);
		if (parsed.kind === "invalid") {
			errors[key] = t("adminCore.form.integerSecondsField", { label });
		} else if (parsed.kind === "ok" && parsed.value < 0) {
			errors[key] = t("adminCore.form.nonNegativeField", { label });
		}
	}

	resolveJsonPatch(form.healthchecksJson, original.healthchecksJson, "healthchecksJson", errors, t);
	resolveJsonPatch(form.judgeArgsJson, original.judgeArgsJson, "judgeArgsJson", errors, t);
	return errors;
}

export function AdminGameboxesPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCore.gameboxes.documentTitle"));
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
	const [editing, setEditing] = useState<GameBoxLibraryDto | null>(null);
	const [form, setForm] = useState<GameboxFormState>(EMPTY_FORM);
	const [original, setOriginal] = useState<GameboxOriginal>({
		healthchecksJson: "",
		judgeArgsJson: "",
	});
	const [errors, setErrors] = useState<GameboxFormErrors>({});

	const fileInputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [progress, setProgress] = useState(0);
	const [imported, setImported] = useState<GameBoxLibraryDto | null>(null);

	const [scanItems, setScanItems] = useState<GameBoxScanItem[] | null>(null);
	const [checkItems, setCheckItems] = useState<GameBoxCheckResult[] | null>(null);
	const [buildItems, setBuildItems] = useState<GameBoxBuildResult[] | null>(null);

	const params: QueryParams = {
		page: list.page,
		limit: list.pageSize,
		...(list.filter ? { filter: list.filter } : {}),
	};

	const query = useQuery({
		queryKey: qk.awd.library(params),
		queryFn: () => callList<GameBoxLibraryDto>(client.awd.admin.listGameboxes(params)),
	});

	function invalidate(): void {
		void queryClient.invalidateQueries({ queryKey: qk.awd.library() });
	}

	const save = useMutation({
		mutationFn: (input: { id: string; body: GameboxFormState; original: GameboxOriginal }) => {
			const { body } = input;
			const cpu = parseIntInput(body.cpuMillis);
			const memory = parseIntInput(body.memoryBytes);
			const pids = parseIntInput(body.pidsLimit);
			const timeout = parseIntInput(body.judgeTimeoutSecs);
			const retry = parseIntInput(body.judgeRetryIntervalSecs);
			// 空串在推荐资源字段上等于「不修改」（后端 `Option<i64>`，null 不更新）。
			return call<GameBoxLibraryDto>(
				client.awd.admin.updateGamebox(input.id, {
					name: body.name.trim(),
					category: body.category.trim(),
					description: body.description,
					hidden: body.hidden,
					// username / judge_script_* 的空串由后端归一化为「清空」。
					username: body.username,
					recommended_cpu_millis: cpu.kind === "ok" ? cpu.value : undefined,
					recommended_memory_bytes: memory.kind === "ok" ? memory.value : undefined,
					recommended_pids_limit: pids.kind === "ok" ? pids.value : undefined,
					healthchecks_json: resolveJsonPatch(
						body.healthchecksJson,
						input.original.healthchecksJson,
						"healthchecksJson",
						{},
						t,
					),
					judge_script_name: body.judgeScriptName,
					judge_script_content: body.judgeScriptContent,
					judge_args_json: resolveJsonPatch(
						body.judgeArgsJson,
						input.original.judgeArgsJson,
						"judgeArgsJson",
						{},
						t,
					),
					// 空 = 清空（继承赛事默认值）。
					judge_timeout_secs: timeout.kind === "ok" ? timeout.value : null,
					judge_retry_interval_secs: retry.kind === "ok" ? retry.value : null,
				}),
				t("adminCore.actions.updateGamebox"),
			);
		},
		onSuccess: () => {
			toast.success(t("adminCore.gameboxes.toasts.updated"));
			invalidate();
			setEditing(null);
			setErrors({});
		},
		onError: (error) => toast.apiError(t("adminCore.gameboxes.toasts.updateFailed"), error),
	});

	const hide = useMutation({
		mutationFn: (id: string) =>
			// 该接口返回 data:null，必须用 callVoid。
			callVoid(client.awd.admin.hideGamebox(id), t("adminCore.actions.hideGamebox")),
		onSuccess: () => {
			toast.success(
				t("adminCore.gameboxes.toasts.hidden"),
				t("adminCore.gameboxes.toasts.hiddenDescription"),
			);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminCore.gameboxes.toasts.hideFailed"), error),
	});

	const remove = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(client.awd.admin.removeGamebox(ids), t("adminCore.actions.deleteGameboxes")),
		onSuccess: (count) => {
			toast.success(
				t("adminCore.gameboxes.toasts.deleted", { count }),
				t("adminCore.gameboxes.toasts.deletedDescription"),
			);
			invalidate();
			setSelectedIds([]);
		},
		onError: (error) => toast.apiError(t("adminCore.gameboxes.toasts.deleteFailed"), error),
	});

	const importMutation = useMutation({
		mutationFn: (selected: File) =>
			uploadFile<ImportGameBoxResponse>({
				client,
				scope: "admin",
				url: "/awd/gameboxes/import",
				field: "package_zip",
				file: selected,
				onProgress: setProgress,
			}),
		onSuccess: (data) => {
			setImported(data.gamebox);
			setFile(null);
			setProgress(0);
			toast.success(
				t("adminCore.gameboxes.toasts.imported"),
				t("adminCore.gameboxes.toasts.importedDescription", { name: data.gamebox.name }),
			);
			invalidate();
		},
		onError: (error) => {
			setProgress(0);
			toast.apiError(t("adminCore.gameboxes.toasts.importFailed"), error);
		},
	});

	const scan = useMutation({
		mutationFn: () =>
			call<GameBoxScanItem[]>(
				client.awd.admin.scanGameboxes(),
				t("adminCore.actions.scanGameboxes"),
			),
		onSuccess: (items) => {
			setScanItems(items);
			const failed = items.filter((item) => item.status === "error").length;
			if (failed > 0) {
				toast.warning(
					t("adminCore.gameboxes.toasts.scanWarning", {
						count: items.length,
						failed,
					}),
				);
			} else {
				toast.success(
					t("adminCore.gameboxes.toasts.scanSuccess", { count: items.length }),
				);
			}
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminCore.gameboxes.toasts.scanFailed"), error),
	});

	const check = useMutation({
		mutationFn: (ids?: string[]) =>
			call<GameBoxCheckResult[]>(
				client.awd.admin.checkGameboxes(ids),
				t("adminCore.actions.checkGameboxes"),
			),
		onSuccess: (items) => {
			setCheckItems(items);
			const failed = items.filter((item) => !item.is_ok).length;
			if (failed > 0) {
				toast.warning(
					t("adminCore.gameboxes.toasts.checkWarning", {
						count: items.length,
						failed,
					}),
				);
			} else {
				toast.success(
					t("adminCore.gameboxes.toasts.checkSuccess", { count: items.length }),
				);
			}
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminCore.gameboxes.toasts.checkFailed"), error),
	});

	const build = useMutation({
		mutationFn: (ids?: string[]) =>
			call<GameBoxBuildResult[]>(
				client.awd.admin.buildGameboxes(ids),
				t("adminCore.actions.buildGameboxes"),
			),
		onSuccess: (items) => {
			setBuildItems(items);
			const failed = items.filter((item) => !item.is_ok);
			if (items.length === 0) {
				toast.warning(
					t("adminCore.gameboxes.toasts.buildEmptyTitle"),
					t("adminCore.gameboxes.toasts.buildEmptyDescription"),
				);
			} else if (failed.length > 0) {
				toast.error(
					t("adminCore.gameboxes.toasts.buildFailedTitle", { count: failed.length }),
					failed[0]?.message,
				);
			} else {
				toast.success(
					t("adminCore.gameboxes.toasts.buildSuccess", { count: items.length }),
				);
			}
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminCore.gameboxes.toasts.buildFailed"), error),
	});

	function openEdit(row: GameBoxLibraryDto): void {
		const nextOriginal: GameboxOriginal = {
			healthchecksJson: formatJsonText(row.healthchecks_json),
			judgeArgsJson: formatJsonText(row.judge_args_json),
		};
		setOriginal(nextOriginal);
		setForm({
			name: row.name,
			category: row.category,
			description: row.description,
			hidden: row.hidden,
			username: row.username ?? "",
			cpuMillis: row.cpu_millis === null ? "" : String(row.cpu_millis),
			memoryBytes: row.memory_bytes === null ? "" : String(row.memory_bytes),
			pidsLimit: row.pids_limit === null ? "" : String(row.pids_limit),
			healthchecksJson: nextOriginal.healthchecksJson,
			judgeScriptName: row.judge_script_name ?? "",
			judgeScriptContent: row.judge_script_content ?? "",
			judgeArgsJson: nextOriginal.judgeArgsJson,
			judgeTimeoutSecs:
				row.judge_timeout_secs === null || row.judge_timeout_secs === undefined
					? ""
					: String(row.judge_timeout_secs),
			judgeRetryIntervalSecs:
				row.judge_retry_interval_secs === null || row.judge_retry_interval_secs === undefined
					? ""
					: String(row.judge_retry_interval_secs),
		});
		setErrors({});
		setEditing(row);
	}

	function submit(): void {
		if (!editing) return;
		const nextErrors = validate(form, original, t);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			toast.warning(t("adminCore.form.fixErrors"));
			return;
		}
		save.mutate({ id: editing.id, body: form, original });
	}

	async function confirmHide(row: GameBoxLibraryDto): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.gameboxes.confirm.hideTitle", { name: row.name }),
			description: t("adminCore.gameboxes.confirm.hideDescription"),
			consequences: [
				t("adminCore.gameboxes.confirm.hideConsequence1"),
				t("adminCore.gameboxes.confirm.hideConsequence2"),
				t("adminCore.gameboxes.confirm.hideConsequence3"),
			],
			tone: "danger",
			confirmText: t("adminCore.gameboxes.confirm.hide"),
			confirmPhrase: row.name,
		});
		if (ok) hide.mutate(row.id);
	}

	async function confirmRemoveOne(row: GameBoxLibraryDto): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.gameboxes.confirm.deleteOneTitle", { name: row.name }),
			description: t("adminCore.gameboxes.confirm.deleteDescription"),
			consequences: [
				t("adminCore.gameboxes.confirm.deleteConsequence1"),
				t("adminCore.gameboxes.confirm.deleteConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.gameboxes.confirm.delete"),
			confirmPhrase: row.name,
		});
		if (ok) remove.mutate([row.id]);
	}

	async function confirmRemoveSelected(): Promise<void> {
		if (selectedIds.length === 0) {
			toast.warning(t("adminCore.gameboxes.toasts.selectForDelete"));
			return;
		}
		const ok = await confirm({
			title: t("adminCore.gameboxes.confirm.deleteSelectedTitle", {
				count: selectedIds.length,
			}),
			description: t("adminCore.gameboxes.confirm.deleteDescription"),
			consequences: [
				t("adminCore.gameboxes.confirm.deleteSelectedConsequence1", {
					count: selectedIds.length,
				}),
				t("adminCore.gameboxes.confirm.deleteSelectedConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.gameboxes.confirm.delete"),
			confirmPhrase: "delete",
		});
		if (ok) remove.mutate(selectedIds);
	}

	async function confirmBuild(ids: string[]): Promise<void> {
		const ok = await confirm({
			title:
				ids.length === 1
					? t("adminCore.gameboxes.confirm.buildOneTitle")
					: t("adminCore.gameboxes.confirm.buildSelectedTitle", { count: ids.length }),
			description: t("adminCore.gameboxes.confirm.buildDescription"),
			consequences: [
				t("adminCore.gameboxes.confirm.buildConsequence1"),
				t("adminCore.gameboxes.confirm.buildConsequence2"),
				t("adminCore.gameboxes.confirm.buildConsequence3"),
			],
			tone: "default",
			confirmText: t("adminCore.gameboxes.confirm.buildConfirm"),
		});
		if (ok) build.mutate(ids.length > 0 ? ids : undefined);
	}

	async function confirmScan(): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.gameboxes.confirm.scanTitle"),
			description: t("adminCore.gameboxes.confirm.scanDescription"),
			consequences: [
				t("adminCore.gameboxes.confirm.scanConsequence1"),
				t("adminCore.gameboxes.confirm.scanConsequence2"),
			],
			tone: "default",
			confirmText: t("adminCore.gameboxes.confirm.scanConfirm"),
		});
		if (ok) scan.mutate();
	}

	async function confirmImport(): Promise<void> {
		if (!file) return;
		const ok = await confirm({
			title: t("adminCore.gameboxes.confirm.importTitle", { file: file.name }),
			description: t("adminCore.gameboxes.confirm.importDescription"),
			consequences: [
				t("adminCore.gameboxes.confirm.importConsequence1"),
				t("adminCore.gameboxes.confirm.importConsequence2"),
				t("adminCore.gameboxes.confirm.importConsequence3"),
			],
			tone: "default",
			confirmText: t("adminCore.gameboxes.confirm.importConfirm"),
		});
		if (ok) importMutation.mutate(file);
	}

	const columns: DataTableColumn<GameBoxLibraryDto>[] = [
		{
			id: "name",
			header: t("adminCore.gameboxes.columns.gamebox"),
			cell: (row) => <span className="text-sm font-medium">{row.name}</span>,
			sortValue: (row) => row.name,
		},
		{
			id: "safe_name",
			header: t("adminCore.gameboxes.columns.safeName"),
			cell: (row) => <MonoText>{row.safe_name}</MonoText>,
			sortValue: (row) => row.safe_name,
			hideBelow: "md",
		},
		{
			id: "version",
			header: t("adminCore.gameboxes.columns.versionBuild"),
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
			header: t("adminCore.gameboxes.columns.image"),
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
						{t("adminCore.gameboxes.noImage")}
					</span>
				),
			hideBelow: "lg",
		},
		{
			id: "hidden",
			header: t("adminCore.gameboxes.columns.visibility"),
			cell: (row) => (
				<TonePill tone={row.hidden ? "muted" : "success"}>
					{row.hidden
						? t("adminCore.common.visibility.hidden")
						: t("adminCore.common.visibility.public")}
				</TonePill>
			),
			sortValue: (row) => (row.hidden ? 1 : 0),
		},
	];

	const canBuild = (row: GameBoxLibraryDto): boolean => row.build_status === "ready";

	return (
		<PageBody>
			<PageHeader
				title={t("adminCore.gameboxes.title")}
				description={t("adminCore.gameboxes.description")}
				actions={
					<Toolbar>
						<Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
							<RefreshCw
								className={query.isFetching ? "animate-spin" : undefined}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</Button>
						<Button onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending}>
							<FileUp aria-hidden="true" /> {t("adminCore.gameboxes.import")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminCore.gameboxes.listTitle")}
				description={t("adminCore.gameboxes.listDescription")}
				actions={
					<Toolbar>
						<SearchInput
							value={list.search}
							onChange={list.setSearch}
							placeholder={t("adminCore.gameboxes.searchPlaceholder")}
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void confirmScan()}
							disabled={scan.isPending}
						>
							<ScanSearch aria-hidden="true" />{" "}
							{scan.isPending
								? t("adminCore.gameboxes.scanning")
								: t("adminCore.gameboxes.scan")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => check.mutate(selectedIds.length > 0 ? selectedIds : undefined)}
							disabled={check.isPending}
						>
							<ShieldCheck aria-hidden="true" />{" "}
							{check.isPending
								? t("adminCore.gameboxes.checking")
								: selectedIds.length > 0
									? t("adminCore.gameboxes.checkSelected")
									: t("adminCore.gameboxes.checkAll")}
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
									{t("adminCore.gameboxes.buildSelected", { count: selectedIds.length })}
								</Button>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => void confirmRemoveSelected()}
									disabled={remove.isPending}
								>
									<Trash2 aria-hidden="true" />{" "}
									{t("adminCore.gameboxes.deleteSelected", { count: selectedIds.length })}
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
								t("adminCore.gameboxes.toasts.zipOnly"),
								t("adminCore.gameboxes.toasts.zipOnlyDescription"),
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
					</div>
				) : null}

				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={5} />}
					errorTitle={t("adminCore.gameboxes.error")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						list.filter ? (
							<EmptyBlock
								variant="filtered"
								title={t("adminCore.gameboxes.filtered.title")}
								description={t("adminCore.gameboxes.filtered.description", {
									query: list.search,
								})}
							/>
						) : (
							<EmptyBlock
								title={t("adminCore.gameboxes.empty.title")}
								description={t("adminCore.gameboxes.empty.description")}
								action={
									<Button size="sm" onClick={() => fileInputRef.current?.click()}>
										<FileUp aria-hidden="true" /> {t("adminCore.gameboxes.import")}
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
									<p className="tnum font-mono text-xs text-muted-foreground">
										{t("adminCore.common.runtimeValue", {
											cpu: row.cpu_millis !== null ? `${row.cpu_millis}m` : "—",
											memory:
												row.memory_bytes !== null ? formatBytes(row.memory_bytes) : "—",
											pids: row.pids_limit ?? "—",
										})}
									</p>
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
											{t("adminCore.gameboxes.check")}
										</Button>
										{canBuild(row) ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => void confirmBuild([row.id])}
												disabled={build.isPending}
											>
												<Hammer aria-hidden="true" />{" "}
												{t("adminCore.gameboxes.build")}
											</Button>
										) : null}
										{!row.hidden ? (
											<Button
												variant="outline"
												size="sm"
												onClick={() => void confirmHide(row)}
											>
												<EyeOff aria-hidden="true" />{" "}
												{t("adminCore.gameboxes.hide")}
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
								<RowMenu label={t("adminCore.gameboxes.rowMenu", { name: row.name })}>
									<DropdownMenuItem onSelect={() => openEdit(row)}>
										<Pencil aria-hidden="true" /> {t("common.edit")}
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => check.mutate([row.id])}>
										<ShieldCheck aria-hidden="true" />{" "}
										{t("adminCore.gameboxes.check")}
									</DropdownMenuItem>
									{canBuild(row) ? (
										<DropdownMenuItem onSelect={() => void confirmBuild([row.id])}>
											<Hammer aria-hidden="true" />{" "}
											{t("adminCore.gameboxes.buildImage")}
										</DropdownMenuItem>
									) : null}
									{!row.hidden ? (
										<DropdownMenuItem onSelect={() => void confirmHide(row)}>
											<EyeOff aria-hidden="true" /> {t("adminCore.gameboxes.hide")}
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
					title={t("adminCore.gameboxes.results.scanTitle")}
					description={t("adminCore.gameboxes.results.scanDescription", {
						count: scanItems.length,
					})}
					onDismiss={() => setScanItems(null)}
				>
					<ScanResultTable items={scanItems} />
				</ResultsCard>
			) : null}

			{checkItems ? (
				<ResultsCard
					title={t("adminCore.gameboxes.results.checkTitle")}
					description={t("adminCore.gameboxes.results.checkDescription", {
						count: checkItems.length,
						failed: checkItems.filter((item) => !item.is_ok).length,
					})}
					onDismiss={() => setCheckItems(null)}
				>
					<GameboxCheckResultTable
						items={checkItems}
						onBuild={(id) => void confirmBuild([id])}
						building={build.isPending}
					/>
				</ResultsCard>
			) : null}

			{buildItems ? (
				<ResultsCard
					title={t("adminCore.gameboxes.results.buildTitle")}
					description={t("adminCore.gameboxes.results.buildDescription")}
					onDismiss={() => setBuildItems(null)}
				>
					<BuildResultTable
						items={buildItems}
						nameOf={(row) => row.gamebox_name}
						label={t("adminCore.gameboxes.columns.gamebox")}
					/>
				</ResultsCard>
			) : null}

			<FormSheet
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				title={
					editing
						? t("adminCore.gameboxes.sheet.editTitleWithName", { name: editing.name })
						: t("adminCore.gameboxes.sheet.editTitle")
				}
				description={t("adminCore.gameboxes.sheet.formDescription")}
				width="xl"
				footer={
					<FormFooter
						onCancel={() => setEditing(null)}
						submitLabel={t("common.saveChanges")}
						isPending={save.isPending}
						formId="admin-gamebox-form"
						hint={
							editing
								? t("adminCore.common.safeNameWithVersion", {
										safeName: editing.safe_name,
										version: editing.version ?? "—",
									})
								: undefined
						}
					/>
				}
			>
				<form
					id="admin-gamebox-form"
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<FormGrid columns={2}>
						<Field
							label={t("adminCore.gameboxes.sheet.name")}
							htmlFor="gamebox-name"
							required
							error={errors.name}
						>
							<Input
								id="gamebox-name"
								value={form.name}
								onChange={(event) => setForm({ ...form, name: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.gameboxes.sheet.category")}
							htmlFor="gamebox-category"
							required
							error={errors.category}
						>
							<Input
								id="gamebox-category"
								value={form.category}
								onChange={(event) => setForm({ ...form, category: event.target.value })}
							/>
						</Field>
					</FormGrid>
					<Field
						label={t("adminCore.gameboxes.sheet.description")}
						htmlFor="gamebox-description"
					>
						<Textarea
							id="gamebox-description"
							rows={3}
							value={form.description}
							onChange={(event) => setForm({ ...form, description: event.target.value })}
						/>
					</Field>
					<div className="flex items-center justify-between rounded-lg border px-3 py-2">
						<div>
							<p className="text-sm font-medium">{t("adminCore.gameboxes.sheet.hidden")}</p>
							<p className="text-xs text-muted-foreground">
								{t("adminCore.gameboxes.sheet.hiddenHint")}
							</p>
						</div>
						<Switch
							checked={form.hidden}
							onCheckedChange={(checked) => setForm({ ...form, hidden: checked })}
							aria-label={t("adminCore.gameboxes.sheet.hiddenAria")}
						/>
					</div>

					<FormGrid columns={2}>
						<Field
							label={t("adminCore.gameboxes.sheet.username")}
							htmlFor="gamebox-username"
							hint={t("adminCore.gameboxes.sheet.usernameHint")}
						>
							<Input
								id="gamebox-username"
								value={form.username}
								onChange={(event) => setForm({ ...form, username: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.gameboxes.sheet.cpu")}
							htmlFor="gamebox-cpu"
							error={errors.cpuMillis}
							hint={t("adminCore.gameboxes.sheet.resourceHint")}
						>
							<Input
								id="gamebox-cpu"
								inputMode="numeric"
								value={form.cpuMillis}
								onChange={(event) => setForm({ ...form, cpuMillis: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.gameboxes.sheet.memory")}
							htmlFor="gamebox-memory"
							error={errors.memoryBytes}
							hint={t("adminCore.gameboxes.sheet.resourceHint")}
						>
							<Input
								id="gamebox-memory"
								inputMode="numeric"
								value={form.memoryBytes}
								onChange={(event) => setForm({ ...form, memoryBytes: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.gameboxes.sheet.pids")}
							htmlFor="gamebox-pids"
							error={errors.pidsLimit}
							hint={t("adminCore.gameboxes.sheet.resourceHint")}
						>
							<Input
								id="gamebox-pids"
								inputMode="numeric"
								value={form.pidsLimit}
								onChange={(event) => setForm({ ...form, pidsLimit: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.gameboxes.sheet.timeout")}
							htmlFor="gamebox-timeout"
							error={errors.judgeTimeoutSecs}
							hint={t("adminCore.gameboxes.sheet.timingHint")}
						>
							<Input
								id="gamebox-timeout"
								inputMode="numeric"
								value={form.judgeTimeoutSecs}
								onChange={(event) =>
									setForm({ ...form, judgeTimeoutSecs: event.target.value })
								}
							/>
						</Field>
						<Field
							label={t("adminCore.gameboxes.sheet.retry")}
							htmlFor="gamebox-retry"
							error={errors.judgeRetryIntervalSecs}
							hint={t("adminCore.gameboxes.sheet.timingHint")}
						>
							<Input
								id="gamebox-retry"
								inputMode="numeric"
								value={form.judgeRetryIntervalSecs}
								onChange={(event) =>
									setForm({ ...form, judgeRetryIntervalSecs: event.target.value })
								}
							/>
						</Field>
						<Field
							label={t("adminCore.gameboxes.sheet.judgeName")}
							htmlFor="gamebox-judge-name"
							hint={t("adminCore.gameboxes.sheet.judgeNameHint")}
						>
							<Input
								id="gamebox-judge-name"
								value={form.judgeScriptName}
								onChange={(event) =>
									setForm({ ...form, judgeScriptName: event.target.value })
								}
							/>
						</Field>
					</FormGrid>

					<Field
						label={t("adminCore.gameboxes.sheet.judgeContent")}
						htmlFor="gamebox-judge-content"
						hint={t("adminCore.gameboxes.sheet.judgeContentHint")}
					>
						<Textarea
							id="gamebox-judge-content"
							rows={6}
							className="font-mono text-xs"
							value={form.judgeScriptContent}
							onChange={(event) =>
								setForm({ ...form, judgeScriptContent: event.target.value })
							}
						/>
					</Field>

					<Field
						label="healthchecks_json"
						htmlFor="gamebox-healthchecks"
						error={errors.healthchecksJson}
						hint={t("adminCore.gameboxes.sheet.healthchecksHint")}
					>
						<Textarea
							id="gamebox-healthchecks"
							rows={6}
							className="font-mono text-xs"
							placeholder='[{"name":"port-80","type":"tcp","port":80}]'
							value={form.healthchecksJson}
							onChange={(event) =>
								setForm({ ...form, healthchecksJson: event.target.value })
							}
						/>
					</Field>

					<Field
						label="judge_args_json"
						htmlFor="gamebox-judge-args"
						error={errors.judgeArgsJson}
						hint={t("adminCore.gameboxes.sheet.judgeArgsHint")}
					>
						<Textarea
							id="gamebox-judge-args"
							rows={6}
							className="font-mono text-xs"
							value={form.judgeArgsJson}
							onChange={(event) => setForm({ ...form, judgeArgsJson: event.target.value })}
						/>
					</Field>
				</form>
			</FormSheet>
		</PageBody>
	);
}

/** GameBox 校验结果表（含 package 目录检查）。 */
function GameboxCheckResultTable({
	items,
	onBuild,
	building,
}: {
	items: GameBoxCheckResult[];
	onBuild: (id: string) => void;
	building: boolean;
}): ReactNode {
	const { t } = useTranslation();
	const columns: DataTableColumn<GameBoxCheckResult>[] = [
		{
			id: "gamebox_name",
			header: t("adminCore.gameboxes.columns.gamebox"),
			cell: (row) => <span className="text-sm font-medium">{row.gamebox_name}</span>,
			sortValue: (row) => row.gamebox_name,
		},
		{
			id: "docker_image",
			header: t("adminCore.gameboxes.checkTable.image"),
			cell: (row) =>
				row.docker_image ? (
					<TonePill tone="success">{t("adminCore.gameboxes.checkTable.ready")}</TonePill>
				) : (
					<Button variant="outline" size="xs" onClick={() => onBuild(row.id)} disabled={building}>
						<Hammer aria-hidden="true" /> {t("adminCore.gameboxes.build")}
					</Button>
				),
			sortValue: (row) => (row.docker_image ? 1 : 0),
		},
		{
			id: "package_dir",
			header: t("adminCore.gameboxes.checkTable.packageDir"),
			cell: (row) => (
				<TonePill tone={row.package_dir ? "success" : "danger"}>
					{row.package_dir
						? t("adminCore.gameboxes.checkTable.mirrored")
						: t("adminCore.gameboxes.checkTable.missing")}
				</TonePill>
			),
			sortValue: (row) => (row.package_dir ? 1 : 0),
			hideBelow: "sm",
		},
		{
			id: "is_ok",
			header: t("adminCore.gameboxes.checkTable.conclusion"),
			cell: (row) => (
				<TonePill tone={row.is_ok ? "success" : "danger"}>
					{row.is_ok
						? t("adminCore.gameboxes.checkTable.ok")
						: t("adminCore.gameboxes.checkTable.notOk")}
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
						<span className="text-sm font-medium">{row.gamebox_name}</span>
						<TonePill tone={row.is_ok ? "success" : "danger"}>
							{row.is_ok
								? t("adminCore.gameboxes.checkTable.ok")
								: t("adminCore.gameboxes.checkTable.notOk")}
						</TonePill>
					</div>
					<p className="text-xs text-muted-foreground">
						{t("adminCore.gameboxes.checkTable.mobile", {
							image: row.docker_image
								? t("adminCore.gameboxes.checkTable.ready")
								: t("adminCore.gameboxes.checkTable.missing"),
							packageDir: row.package_dir
								? t("adminCore.gameboxes.checkTable.mirrored")
								: t("adminCore.gameboxes.checkTable.missing"),
						})}
					</p>
				</div>
			)}
			empty={<span>{t("adminCore.gameboxes.checkTable.empty")}</span>}
		/>
	);
}
