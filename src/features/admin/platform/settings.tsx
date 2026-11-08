/**
 * 管理端 · 动态设置（`/admin/platform/settings`，required 能力）。
 *
 * 真实接口：`client.admin.settings.fetch()` / `create` / `patch(带 id)` / `remove(id_list)`。
 * 后端语义（`apps/api/src/modules/platform/settings/api.rs`）：
 * - `GET /admin/settings` **不接受任何 QueryParams**（SDK 签名也是 `fetch()`），
 *   一次性返回全部设置并已算好 `resolved_value` ⇒ 搜索与分页在客户端完成；
 * - `create` 必须带全 `key/value/description/protected/type`；
 * - `patch` 走 `PATCH /settings/{id}`（SDK 要求带 `.id`）；
 * - **受保护（protected）设置后端禁止删除**（返回 400），只能改值；
 * - `FRONTEND_ACTIVE` 的值必须是安全前端 ID（`[a-z0-9][a-z0-9._-]*`，≤64）。
 */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ExternalLink,
	Eye,
	EyeOff,
	Lock,
	MoreHorizontal,
	Pencil,
	Plus,
	RefreshCw,
	ShieldAlert,
	Trash2,
} from "lucide-react";
import { Link } from "react-router";

import type { SettingsDto } from "@floatctf/sdk";
import { SettingValueType } from "@floatctf/sdk/entity";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import {
	CopyText,
	MonoText,
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	SecretValue,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { AbsoluteTime } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { truncate } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import {
	DeleteSelectedButton,
	OutOfRangeBlock,
	SearchInput,
	pageSlice,
	useListState,
} from "./components";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** 平台关键设置：切换生效前端（只读提示 + 跳转选择器）。 */
const SENSITIVE_KEY_PATTERN =
	/(SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE_KEY|API_KEY|PROXY|SMTP_URI|DATABASE_URL|REDIS_URL)/i;

function isSensitiveKey(key: string): boolean {
	return SENSITIVE_KEY_PATTERN.test(key);
}

const FRONTEND_ACTIVE_KEY = "FRONTEND_ACTIVE";

/** 覆盖受保护设置值所需的确认词。 */
const OVERRIDE_PHRASE = "OVERRIDE";

export function AdminSettingsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminPlatform.settings.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const list = useListState(20);
	const [selected, setSelected] = useState<string[]>([]);
	const [editing, setEditing] = useState<SettingsDto | null | undefined>(undefined);

	function settingTypeLabel(type: string): string {
		switch (type) {
			case SettingValueType.String:
				return t("adminPlatform.settings.types.string");
			case SettingValueType.Integer:
				return t("adminPlatform.settings.types.integer");
			case SettingValueType.Boolean:
				return t("adminPlatform.settings.types.boolean");
			case SettingValueType.Float:
				return t("adminPlatform.settings.types.float");
			default:
				return type;
		}
	}

	const query = useQuery({
		queryKey: qk.admin.settings({ all: true }),
		queryFn: () => callList<SettingsDto>(client.admin.settings.fetch()),
	});

	const all = query.data?.items ?? [];

	const removeMutation = useMutation({
		mutationFn: (ids: string[]) =>
			callVoid(client.admin.settings.remove(ids), t("adminPlatform.settings.requests.delete")),
		onSuccess: (_data, ids) => {
			toast.success(t("adminPlatform.settings.deleteSuccess", { count: ids.length }));
			setSelected([]);
			void queryClient.invalidateQueries({ queryKey: qk.admin.settings() });
		},
		onError: (error) => toast.apiError(t("adminPlatform.settings.deleteFailed"), error),
	});

	async function removeRows(rows: SettingsDto[]) {
		const deletable = rows.filter((row) => !row.protected);
		const blocked = rows.filter((row) => row.protected);
		if (blocked.length > 0) {
			toast.warning(
				t("adminPlatform.settings.confirm.blockedTitle"),
				t("adminPlatform.settings.confirm.blockedDescription", {
					keys: blocked
						.map((row) => row.key)
						.join(t("adminPlatform.common.listSeparator")),
				}),
			);
		}
		if (deletable.length === 0) return;
		const ok = await confirm({
			title:
				deletable.length === 1
					? t("adminPlatform.settings.confirm.titleOne", { key: deletable[0].key })
					: t("adminPlatform.settings.confirm.titleMany", { count: deletable.length }),
			description: deletable
				.map((row) => row.key)
				.join(t("adminPlatform.common.listSeparator")),
			consequences: [
				t("adminPlatform.settings.confirm.consequence1"),
				t("adminPlatform.settings.confirm.consequence2"),
				t("adminPlatform.settings.confirm.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminPlatform.settings.confirm.confirmText"),
			confirmPhrase: "DELETE",
		});
		if (!ok) return;
		removeMutation.mutate(deletable.map((row) => row.id));
	}

	const keyword = list.filter.toLowerCase();
	const filtered = all.filter(
		(row) =>
			keyword.length === 0 ||
			row.key.toLowerCase().includes(keyword) ||
			row.value.toLowerCase().includes(keyword) ||
			(row.resolved_value ?? "").toLowerCase().includes(keyword) ||
			row.description.toLowerCase().includes(keyword),
	);
	const visible = pageSlice(filtered, list.page, list.pageSize);
	const protectedCount = all.filter((row) => row.protected).length;
	const selectedRows = all.filter((row) => selected.includes(row.id));
	const deletableSelected = selectedRows.filter((row) => !row.protected);
	const protectedSelected = selectedRows.filter((row) => row.protected);


	useEffect(() => {
		setSelected([]);
	}, [list.page, list.filter]);

	const columns: DataTableColumn<SettingsDto>[] = [
		{
			id: "id",
			header: t("adminPlatform.settings.columns.id"),
			sortValue: (row) => row.id,
			cell: (row) => <MonoText className="text-xs text-muted-foreground">{row.id}</MonoText>,
			hideBelow: "lg",
		},
		{
			id: "key",
			header: t("adminPlatform.settings.columns.key"),
			sortValue: (row) => row.key,
			cell: (row) => (
				<span className="inline-flex items-center gap-1.5">
					<MonoText className="font-medium">{row.key}</MonoText>
					{row.key === FRONTEND_ACTIVE_KEY ? (
						<TonePill tone="info">{t("adminPlatform.settings.activeFrontend")}</TonePill>
					) : null}
					{row.protected ? (
						<Lock className="size-3 text-muted-foreground" aria-hidden="true" />
					) : null}
				</span>
			),
		},
		{
			id: "value",
			header: t("adminPlatform.settings.columns.value"),
			cell: (row) =>
				isSensitiveKey(row.key) ? (
					<SecretValue value={row.value} label={row.key} />
				) : (
					<MonoText>{truncate(row.value, 40) || "—"}</MonoText>
				),
		},
		{
			id: "resolved_value",
			header: t("adminPlatform.settings.columns.resolved"),
			hideBelow: "lg",
			cell: (row) =>
				isSensitiveKey(row.key) ? (
					<SecretValue value={row.resolved_value ?? ""} label={row.key} />
				) : (
					<MonoText className="text-muted-foreground">
						{truncate(row.resolved_value ?? "", 40) || "—"}
					</MonoText>
				),
		},
		{
			id: "description",
			header: t("adminPlatform.settings.columns.description"),
			hideBelow: "xl",
			cell: (row) => (
				<span className="text-muted-foreground">
					{truncate(row.description ?? "", 50) || "—"}
				</span>
			),
		},
		{
			id: "type",
			header: t("adminPlatform.settings.columns.type"),
			sortValue: (row) => row.type,
			cell: (row) => <TonePill tone="muted">{settingTypeLabel(row.type)}</TonePill>,
		},
		{
			id: "updated_at",
			header: t("adminPlatform.settings.columns.updatedAt"),
			sortValue: (row) => Date.parse(row.updated_at),
			cell: (row) => <AbsoluteTime value={row.updated_at} />,
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("adminPlatform.settings.title")}
				description={t("adminPlatform.settings.description")}
				actions={
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						<Button
							variant="outline"
							size="sm"
							onClick={() => void query.refetch()}
							disabled={query.isFetching}
						>
							<RefreshCw aria-hidden="true" />
							{t("adminPlatform.common.refresh")}
						</Button>
						<Button size="sm" onClick={() => setEditing(null)}>
							<Plus aria-hidden="true" />
							{t("adminPlatform.settings.form.createTitle")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminPlatform.settings.section.title")}
				description={t("adminPlatform.settings.section.description", {
					total: all.length,
					protectedCount,
				})}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<SearchInput
							value={list.search}
							onChange={list.setSearch}
							placeholder={t("adminPlatform.settings.searchPlaceholder")}
						/>
						<DeleteSelectedButton
							count={deletableSelected.length}
							isPending={removeMutation.isPending}
							label={t("adminPlatform.settings.deleteSelected")}
							onClick={() => void removeRows(deletableSelected)}
						/>
						{protectedSelected.length > 0 ? (
							<span className="text-xs text-muted-foreground">
								{t("adminPlatform.settings.protectedSkip", {
									count: protectedSelected.length,
								})}
							</span>
						) : null}
					</div>
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={8} columns={6} />}
					errorTitle={t("adminPlatform.settings.errorTitle")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							title={t("adminPlatform.settings.empty.title")}
							description={t("adminPlatform.settings.empty.description")}
						/>
					}
				>
					{() =>
						filtered.length === 0 ? (
							<EmptyBlock
								variant="filtered"
								title={t("adminPlatform.settings.filtered.title")}
								description={t("adminPlatform.settings.filtered.description")}
							/>
						) : visible.length === 0 ? (
							<OutOfRangeBlock onReset={() => list.setPage(1)} />
						) : (
							<div className="space-y-3">
								<DataTable
									data={visible}
									getRowId={(row) => row.id}
									columns={columns}
									selectable
									selectedIds={selected}
									onSelectionChange={setSelected}
									rowActions={(row) => {
										const menuLabel = t(
											"adminPlatform.settings.menu.ariaLabel",
											{ key: row.key },
										);
										return (
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon-sm"
														aria-label={menuLabel}
														title={menuLabel}
													>
														<MoreHorizontal aria-hidden="true" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onSelect={() => setEditing(row)}
													>
														<Pencil aria-hidden="true" />
														{row.protected
															? t(
																	"adminPlatform.settings.menu.overrideEdit",
																)
															: t("adminPlatform.settings.menu.edit")}
													</DropdownMenuItem>
													{row.key === FRONTEND_ACTIVE_KEY ? (
														<DropdownMenuItem asChild>
															<Link to="/admin/platform/frontends">
																<ExternalLink aria-hidden="true" />
																{t(
																	"adminPlatform.settings.menu.goFrontends",
																)}
															</Link>
														</DropdownMenuItem>
													) : null}
													<DropdownMenuItem
														variant="destructive"
														disabled={row.protected}
														onSelect={() => void removeRows([row])}
													>
														<Trash2 aria-hidden="true" />
														{row.protected
															? t(
																	"adminPlatform.settings.menu.protectedDelete",
																)
															: t("adminPlatform.settings.menu.delete")}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										);
									}}
									mobileCard={(row) => (
										<div className="space-y-2">
											<div className="flex items-start justify-between gap-2">
												<MonoText className="font-medium">{row.key}</MonoText>
												<AbsoluteTime value={row.updated_at} />
											</div>
											<p className="flex flex-wrap items-center gap-1.5 text-sm">
												<MonoText>{truncate(row.value, 40) || "—"}</MonoText>
												<BooleanPill
													value={row.protected}
													trueText={t("adminPlatform.common.protected")}
													falseText={t("adminPlatform.common.deletable")}
												/>
											</p>
											<p className="text-xs text-muted-foreground">
												{truncate(row.description ?? "", 80) ||
													t("adminPlatform.common.noDescription")}
											</p>
											<div className="flex flex-wrap items-center gap-2">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => setEditing(row)}
												>
													<Pencil aria-hidden="true" />
													{t("adminPlatform.settings.menu.edit")}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="text-destructive"
													disabled={row.protected}
													onClick={() => void removeRows([row])}
												>
													<Trash2 aria-hidden="true" />
													{t("adminPlatform.settings.menu.delete")}
												</Button>
											</div>
										</div>
									)}
								/>
								<PaginationBar
									page={list.page}
									pageSize={list.pageSize}
									total={filtered.length}
									onPageChange={list.setPage}
									onPageSizeChange={list.setPageSize}
									pageSizeOptions={PAGE_SIZE_OPTIONS}
								/>
							</div>
						)
					}
				</QueryState>
			</SectionCard>

			<SettingFormSheet
				open={editing !== undefined}
				row={editing ?? null}
				onOpenChange={(open) => {
					if (!open) setEditing(undefined);
				}}
			/>
		</PageBody>
	);
}

function SettingFormSheet({
	open,
	row,
	onOpenChange,
}: {
	open: boolean;
	row: SettingsDto | null;
	onOpenChange: (open: boolean) => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [form, setForm] = useState<{
		key: string;
		value: string;
		description: string;
		type: SettingValueType;
		protected: boolean;
	}>({
		key: "",
		value: "",
		description: "",
		type: SettingValueType.String,
		protected: false,
	});
	const [errors, setErrors] = useState<{ key?: string; value?: string }>({});
	const [showSecret, setShowSecret] = useState(false);

	useEffect(() => {
		if (!open) return;
		setErrors({});
		setShowSecret(false);
		setForm({
			key: row?.key ?? "",
			value: row?.value ?? "",
			description: row?.description ?? "",
			type: row?.type ?? SettingValueType.String,
			protected: row?.protected ?? false,
		});
	}, [open, row]);

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.settings() });
	}

	function settingTypeLabel(type: string): string {
		switch (type) {
			case SettingValueType.String:
				return t("adminPlatform.settings.types.string");
			case SettingValueType.Integer:
				return t("adminPlatform.settings.types.integer");
			case SettingValueType.Boolean:
				return t("adminPlatform.settings.types.boolean");
			case SettingValueType.Float:
				return t("adminPlatform.settings.types.float");
			default:
				return type;
		}
	}

	const createMutation = useMutation({
		mutationFn: (input: Partial<SettingsDto>) =>
			call(client.admin.settings.create(input), t("adminPlatform.settings.requests.create")),
		onSuccess: () => {
			toast.success(t("adminPlatform.settings.toasts.created"));
			invalidate();
			onOpenChange(false);
		},
		onError: (error) => toast.apiError(t("adminPlatform.settings.toasts.createFailed"), error),
	});

	const patchMutation = useMutation({
		mutationFn: (input: Partial<SettingsDto>) =>
			call(client.admin.settings.patch(input), t("adminPlatform.settings.requests.update")),
		onSuccess: () => {
			toast.success(t("adminPlatform.settings.toasts.updated"));
			invalidate();
			onOpenChange(false);
		},
		onError: (error) => toast.apiError(t("adminPlatform.settings.toasts.updateFailed"), error),
	});

	const isPending = createMutation.isPending || patchMutation.isPending;

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextKey = form.key.trim();
		const nextErrors: { key?: string; value?: string } = {};
		if (nextKey.length === 0) nextErrors.key = t("adminPlatform.settings.field.keyRequired");
		if (form.value.length === 0) nextErrors.value = t("adminPlatform.settings.field.valueRequired");
		setErrors(nextErrors);
		if (nextErrors.key || nextErrors.value) return;

		// 受保护设置的「覆盖」需要额外确认（真实后果：影响所有读取该键的功能）。
		if (row?.protected) {
			const changedValue = row.value !== form.value;
			const changedKey = row.key !== nextKey;
			const ok = await confirm({
				title: t("adminPlatform.settings.override.title", { key: row.key }),
				description: changedKey
					? t("adminPlatform.settings.override.descKey", {
							from: row.key,
							to: nextKey,
						})
					: changedValue
						? t("adminPlatform.settings.override.descValue", {
								from: truncate(row.value, 40),
								to: truncate(form.value, 40),
							})
						: t("adminPlatform.settings.override.descMeta"),
				consequences: [
					t("adminPlatform.settings.override.consequence1"),
					row.key === FRONTEND_ACTIVE_KEY
						? t("adminPlatform.settings.override.consequenceFrontend")
						: t("adminPlatform.settings.override.consequence2"),
					t("adminPlatform.settings.override.consequence3"),
				],
				tone: "danger",
				confirmText: t("adminPlatform.settings.override.confirmText"),
				confirmPhrase: OVERRIDE_PHRASE,
			});
			if (!ok) return;
		}

		const payload: Partial<SettingsDto> = {
			key: nextKey,
			value: form.value,
			description: form.description,
			type: form.type,
			protected: form.protected,
		};
		if (row) patchMutation.mutate({ ...payload, id: row.id });
		else createMutation.mutate(payload);
	}

	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			title={
				row
					? t("adminPlatform.settings.form.editTitle", { key: row.key })
					: t("adminPlatform.settings.form.createTitle")
			}
			description={
				row?.protected
					? t("adminPlatform.settings.form.protectedDescription")
					: t("adminPlatform.settings.form.normalDescription")
			}
			width="lg"
			footer={
				<FormFooter
					formId="setting-form"
					isPending={isPending}
					submitLabel={
						row
							? t("adminPlatform.settings.form.save")
							: t("adminPlatform.settings.form.create")
					}
					onCancel={() => onOpenChange(false)}
					hint={
						row ? (
							<span>
								{t("adminPlatform.settings.form.idHint")}{" "}
								<MonoText>{row.id}</MonoText>
							</span>
						) : (
							t("adminPlatform.settings.field.requiredHint")
						)
					}
				/>
			}
		>
			<form id="setting-form" className="space-y-4" onSubmit={(event) => void submit(event)}>
				{row?.protected ? (
					<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
						<ShieldAlert
							className="mt-0.5 size-4 shrink-0 text-destructive"
							aria-hidden="true"
						/>
						<span>
							{t("adminPlatform.settings.warning.protectedNote")}{" "}
							<MonoText>{OVERRIDE_PHRASE}</MonoText>
						</span>
					</div>
				) : null}
				<FormGrid columns={2}>
					<Field
						label={t("adminPlatform.settings.field.keyLabel")}
						htmlFor="setting-key"
						required
						error={errors.key}
					>
						<Input
							id="setting-key"
							className="font-mono text-xs"
							autoComplete="off"
							value={form.key}
							onChange={(event) => setForm({ ...form, key: event.target.value })}
							placeholder={t("adminPlatform.settings.field.keyPlaceholder")}
						/>
					</Field>
					<Field
						label={t("adminPlatform.settings.field.typeLabel")}
						htmlFor="setting-type"
						hint={t("adminPlatform.settings.field.typeHint")}
					>
						<Select
							value={form.type}
							onValueChange={(value) =>
								setForm({ ...form, type: value as SettingValueType })
							}
						>
							<SelectTrigger id="setting-type" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.values(SettingValueType).map((type) => (
									<SelectItem key={type} value={type}>
										{t("adminPlatform.settings.typeOption", {
											label: settingTypeLabel(type),
											type,
										})}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</FormGrid>
				<Field
					label={t("adminPlatform.settings.field.valueLabel")}
					htmlFor="setting-value"
					required
					error={errors.value}
					hint={
						form.key === FRONTEND_ACTIVE_KEY
							? t("adminPlatform.settings.field.valueHintFrontend")
							: isSensitiveKey(form.key)
								? t("adminPlatform.settings.field.secretHint")
								: t("adminPlatform.settings.field.valueHint")
					}
				>
					{isSensitiveKey(form.key) ? (
						<div className="flex gap-2">
							<Input
								id="setting-value"
								type={showSecret ? "text" : "password"}
								className="font-mono text-sm"
								autoComplete="off"
								spellCheck={false}
								value={form.value}
								onChange={(event) => setForm({ ...form, value: event.target.value })}
							/>
							<Button
								type="button"
								variant="outline"
								size="icon"
								aria-label={
									showSecret
										? t("adminPlatform.settings.field.hideSecret")
										: t("adminPlatform.settings.field.revealSecret")
								}
								title={
									showSecret
										? t("adminPlatform.settings.field.hideSecret")
										: t("adminPlatform.settings.field.revealSecret")
								}
								onClick={() => setShowSecret((value) => !value)}
							>
								{showSecret ? (
									<EyeOff aria-hidden="true" />
								) : (
									<Eye aria-hidden="true" />
								)}
							</Button>
						</div>
					) : (
						<Textarea
							id="setting-value"
							className="font-mono text-sm"
							style={{ minHeight: 90 }}
							value={form.value}
							onChange={(event) => setForm({ ...form, value: event.target.value })}
						/>
					)}
				</Field>
				<Field
					label={t("adminPlatform.settings.field.descriptionLabel")}
					htmlFor="setting-description"
				>
					<Textarea
						id="setting-description"
						style={{ minHeight: 80 }}
						value={form.description}
						onChange={(event) => setForm({ ...form, description: event.target.value })}
					/>
				</Field>
				<Field
					label={t("adminPlatform.settings.field.protectedLabel")}
					htmlFor="setting-protected"
					hint={t("adminPlatform.settings.field.protectedHint")}
				>
					<div className="flex items-center gap-2">
						<Switch
							id="setting-protected"
							checked={form.protected}
							onCheckedChange={(checked) => setForm({ ...form, protected: checked })}
						/>
						<BooleanPill
							value={form.protected}
							trueText={t("adminPlatform.common.protected")}
							falseText={t("adminPlatform.common.deletable")}
						/>
					</div>
				</Field>
				{row ? (
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<span>{t("adminPlatform.settings.field.resolvedLabel")}</span>
						{isSensitiveKey(form.key) ? (
							<SecretValue
								value={row.resolved_value ?? ""}
								label={t("adminPlatform.settings.field.resolvedCopyLabel")}
							/>
						) : (
							<CopyText
								value={row.resolved_value ?? ""}
								label={t("adminPlatform.settings.field.resolvedCopyLabel")}
							/>
						)}
					</div>
				) : null}
			</form>
		</FormSheet>
	);
}
