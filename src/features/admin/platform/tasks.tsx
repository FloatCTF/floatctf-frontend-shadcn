/**
 * 管理端 · 计划任务（`/admin/platform/tasks`）。
 *
 * 真实接口：`client.admin.scheduled_tasks.fetch/create/patch/remove/run`。
 * 后端语义（`apps/api/src/modules/platform/operations/scheduled_tasks.rs`）：
 * - 列表支持 `page`/`limit`，`filter` 映射 `id`/`task_name`/`task_key`/`trigger_type`/
 *   `status`/`enabled`/`protected` 以及分组条件 `kind:service|system|event`；
 * - **`run` 不是立即执行**：它把 `status` 置为 `pending`、`execute_at` 置为当前时间并唤醒
 *   调度器（毫秒级入队）—— 文案必须如实反映；
 * - `create`/`patch` 都会校验 `trigger_type`：`once` 必须给 `execute_at`，
 *   `cron` 必须给合法 Cron 表达式，`task_key` 必须是平台已注册的任务键；
 * - `protected=true` 的任务后端**禁止删除**（400）；
 * - `create`/`patch` 的 DTO **不接受** `max_attempts` / `timeout_secs`，
 *   它们是运行时字段（只读展示）；`payload` 在后端是 `serde_json::Value`，但 SDK
 *   把实体字段声明成 `string`（见报告中的 SDK GAP），因此本页不提供 payload 编辑。
 */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	MoreHorizontal,
	Pencil,
	Play,
	Plus,
	RefreshCw,
	ScrollText,
	Trash2,
} from "lucide-react";

import type { ScheduledTasks } from "@floatctf/sdk/entity";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill, type PillTone } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormGrid, FormSheet, LocalTimeHint } from "~/components/app/form";
import {
	CopyText,
	KeyValueList,
	MonoText,
	PageBody,
	PageHeader,
	PaginationBar,
	ReadonlyBlock,
	SectionCard,
	FilterChips,
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
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { fromDatetimeLocalValue, toDatetimeLocalValue, truncate } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import {
	DeleteSelectedButton,
	SearchInput,
	jsonText,
	sanitizeFilterValue,
	textOf,
	useListState,
} from "./components";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DELETE_PHRASE = "DELETE";

type Kind = "all" | "service" | "system" | "event";
type SearchField = "task_name" | "task_key" | "status";

const KINDS: Kind[] = ["all", "service", "system", "event"];
const SEARCH_FIELD_VALUES: SearchField[] = ["task_name", "task_key", "status"];

const TRIGGER_TYPES = ["once", "cron", "startup"] as const;

function statusTone(status: string): PillTone {
	switch (status) {
		case "pending":
			return "info";
		case "running":
			return "warning";
		case "completed":
			return "success";
		case "failed":
			return "danger";
		default:
			return "neutral";
	}
}

export function AdminScheduledTasksPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminPlatform.tasks.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const list = useListState(20);
	const [kind, setKind] = useState<Kind>("all");
	const [field, setField] = useState<SearchField>("task_name");
	const [selected, setSelected] = useState<string[]>([]);
	const [editing, setEditing] = useState<ScheduledTasks | null | undefined>(undefined);
	const [openTask, setOpenTask] = useState<ScheduledTasks | null>(null);

	function statusLabel(status: string): string {
		switch (status) {
			case "pending":
				return t("adminPlatform.tasks.status.pending");
			case "running":
				return t("adminPlatform.tasks.status.running");
			case "completed":
				return t("adminPlatform.tasks.status.completed");
			case "failed":
				return t("adminPlatform.tasks.status.failed");
			default:
				return status;
		}
	}

	function triggerLabel(trigger: string): string {
		switch (trigger) {
			case "once":
				return t("adminPlatform.tasks.trigger.once");
			case "cron":
				return t("adminPlatform.tasks.trigger.cron");
			case "startup":
				return t("adminPlatform.tasks.trigger.startup");
			default:
				return trigger;
		}
	}

	const searchFields = useMemo(
		() =>
			SEARCH_FIELD_VALUES.map((value) => ({
				value,
				label: t(`adminPlatform.tasks.filters.fields.${value}`),
			})),
		[t],
	);

	const kindOptions = useMemo(
		() =>
			KINDS.map((value) => ({
				value,
				label: t(`adminPlatform.tasks.filters.kinds.${value}`),
			})),
		[t],
	);

	const searchValue = sanitizeFilterValue(list.filter);
	const conditions: string[] = [];
	if (kind !== "all") conditions.push(`kind:${kind}`);
	if (searchValue.length > 0) conditions.push(`${field}:${searchValue}`);
	const remoteFilter = conditions.length > 0 ? conditions.join(" & ") : undefined;

	useEffect(() => {
		list.setPage(1);
	}, [kind, field, list.setPage]);

	useEffect(() => {
		setSelected([]);
	}, [list.page, remoteFilter]);

	const params = {
		page: list.page,
		limit: list.pageSize,
		...(remoteFilter ? { filter: remoteFilter } : {}),
	};

	const query = useQuery({
		queryKey: qk.admin.scheduledTasks(params),
		queryFn: () => callList<ScheduledTasks>(client.admin.scheduled_tasks.fetch(params)),
		placeholderData: keepPreviousData,
	});

	const runMutation = useMutation({
		mutationFn: (task: ScheduledTasks) =>
			call(client.admin.scheduled_tasks.run(task.id), t("adminPlatform.tasks.requests.run")),
		onSuccess: (task) => {
			toast.success(
				t("adminPlatform.tasks.run.toastTitle", { name: task.task_name }),
				t("adminPlatform.tasks.run.toastDescription", {
					status: statusLabel(task.status),
				}),
			);
			void queryClient.invalidateQueries({ queryKey: qk.admin.scheduledTasks() });
		},
		onError: (error) => toast.apiError(t("adminPlatform.tasks.run.toastFailed"), error),
	});

	const removeMutation = useMutation({
		mutationFn: (ids: string[]) =>
			callVoid(
				client.admin.scheduled_tasks.remove(ids),
				t("adminPlatform.tasks.requests.delete"),
			),
		onSuccess: (_data, ids) => {
			toast.success(t("adminPlatform.tasks.remove.toastSuccess", { count: ids.length }));
			setSelected([]);
			void queryClient.invalidateQueries({ queryKey: qk.admin.scheduledTasks() });
		},
		onError: (error) => toast.apiError(t("adminPlatform.tasks.remove.toastFailed"), error),
	});

	async function runTask(task: ScheduledTasks) {
		const ok = await confirm({
			title: t("adminPlatform.tasks.run.title", { name: task.task_name }),
			description: (
				<span className="flex flex-wrap items-center gap-1.5">
					<span>{t("adminPlatform.tasks.detail.taskKey")}</span>
					<MonoText>{task.task_key}</MonoText>
					<span>·</span>
					<span>{t("adminPlatform.tasks.detail.trigger")}</span>
					<MonoText>{task.trigger_type}</MonoText>
				</span>
			),
			consequences: [
				t("adminPlatform.tasks.run.consequence1"),
				t("adminPlatform.tasks.run.consequence2"),
				t("adminPlatform.tasks.run.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminPlatform.tasks.run.confirmText"),
			confirmPhrase: task.task_key,
		});
		if (!ok) return;
		runMutation.mutate(task);
	}

	async function removeRows(rows: ScheduledTasks[]) {
		const deletable = rows.filter((row) => !row.protected);
		const blocked = rows.filter((row) => row.protected);
		if (blocked.length > 0) {
			toast.warning(
				t("adminPlatform.tasks.remove.blockedTitle"),
				t("adminPlatform.tasks.remove.blockedDescription", {
					names: blocked
						.map((row) => row.task_name)
						.join(t("adminPlatform.common.listSeparator")),
				}),
			);
		}
		if (deletable.length === 0) return;
		const ok = await confirm({
			title:
				deletable.length === 1
					? t("adminPlatform.tasks.remove.titleOne", {
							name: deletable[0].task_name,
						})
					: t("adminPlatform.tasks.remove.titleMany", { count: deletable.length }),
			description: deletable
				.map((row) => row.task_name)
				.join(t("adminPlatform.common.listSeparator")),
			consequences: [
				t("adminPlatform.tasks.remove.consequence1"),
				t("adminPlatform.tasks.remove.consequence2"),
				t("adminPlatform.tasks.remove.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminPlatform.tasks.remove.confirmText"),
			confirmPhrase: DELETE_PHRASE,
		});
		if (!ok) return;
		removeMutation.mutate(deletable.map((row) => row.id));
	}

	const columns: DataTableColumn<ScheduledTasks>[] = [
		{
			id: "id",
			header: t("adminPlatform.tasks.columns.id"),
			sortValue: (row) => row.id,
			cell: (row) => <MonoText className="text-xs text-muted-foreground">{row.id}</MonoText>,
			hideBelow: "lg",
		},
		{
			id: "task_name",
			header: t("adminPlatform.tasks.columns.name"),
			sortValue: (row) => row.task_name,
			cell: (row) => (
				<span className="inline-flex items-center gap-1.5">
					<span className="font-medium">{row.task_name}</span>
					{row.protected ? (
						<TonePill tone="muted">{t("adminPlatform.tasks.pills.protected")}</TonePill>
					) : null}
				</span>
			),
		},
		{
			id: "task_key",
			header: t("adminPlatform.tasks.columns.key"),
			sortValue: (row) => row.task_key,
			cell: (row) => <MonoText>{row.task_key}</MonoText>,
			hideBelow: "sm",
		},
		{
			id: "trigger_type",
			header: t("adminPlatform.tasks.columns.trigger"),
			sortValue: (row) => row.trigger_type,
			cell: (row) => (
				<TonePill tone="neutral" title={row.trigger_type}>
					{triggerLabel(row.trigger_type)}
				</TonePill>
			),
			hideBelow: "md",
		},
		{
			id: "status",
			header: t("adminPlatform.tasks.columns.status"),
			sortValue: (row) => row.status,
			cell: (row) => (
				<TonePill tone={statusTone(row.status)} title={row.status}>
					{statusLabel(row.status)}
				</TonePill>
			),
		},
		{
			id: "cron_expr",
			header: t("adminPlatform.tasks.columns.cron"),
			hideBelow: "lg",
			cell: (row) =>
				row.cron_expr ? (
					<MonoText className="text-muted-foreground">{row.cron_expr}</MonoText>
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			id: "execute_at",
			header: t("adminPlatform.tasks.columns.executeAt"),
			hideBelow: "lg",
			sortValue: (row) => (row.execute_at ? Date.parse(row.execute_at) : 0),
			cell: (row) =>
				row.execute_at ? <AbsoluteTime value={row.execute_at} seconds /> : <span>—</span>,
		},
		{
			id: "enabled",
			header: t("adminPlatform.tasks.columns.enabled"),
			cell: (row) => (
				<BooleanPill
					value={row.enabled}
					trueText={t("adminPlatform.common.enabled")}
					falseText={t("adminPlatform.common.disabled")}
				/>
			),
			sortValue: (row) => (row.enabled ? 1 : 0),
			hideBelow: "md",
		},
		{
			id: "protected",
			header: t("adminPlatform.tasks.columns.protected"),
			cell: (row) => <BooleanPill value={row.protected} />,
			sortValue: (row) => (row.protected ? 1 : 0),
			hideBelow: "md",
		},
		{
			id: "last_run_at",
			header: t("adminPlatform.tasks.columns.lastRun"),
			sortValue: (row) => Date.parse(row.last_run_at ?? ""),
			cell: (row) =>
				row.last_run_at ? <AbsoluteTime value={row.last_run_at} /> : <span>—</span>,
			hideBelow: "xl",
		},
		{
			id: "updated_at",
			header: t("adminPlatform.tasks.columns.updatedAt"),
			sortValue: (row) => Date.parse(row.updated_at),
			cell: (row) => <AbsoluteTime value={row.updated_at} />,
			hideBelow: "lg",
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("adminPlatform.tasks.title")}
				description={t("adminPlatform.tasks.description")}
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
							{t("adminPlatform.tasks.create")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminPlatform.tasks.section.title")}
				description={t("adminPlatform.tasks.section.description")}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Select value={kind} onValueChange={(value) => setKind(value as Kind)}>
							<SelectTrigger
								size="sm"
								className="w-48"
								aria-label={t("adminPlatform.tasks.filters.groupAria")}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{kindOptions.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FilterChips
							filters={
								kind === "all"
									? []
									: [
											{
												key: "kind",
												label: t(`adminPlatform.tasks.filters.kinds.${kind}`),
												onRemove: () => setKind("all"),
											},
										]
							}
						/>
						<Select
							value={field}
							onValueChange={(value) => setField(value as SearchField)}
						>
							<SelectTrigger
								size="sm"
								className="w-32"
								aria-label={t("adminPlatform.tasks.filters.fieldAria")}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{searchFields.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<SearchInput
							value={list.search}
							onChange={list.setSearch}
							placeholder={t("adminPlatform.tasks.filters.searchPlaceholder", {
								field:
									searchFields.find((item) => item.value === field)?.label ?? "",
							})}
						/>
						<DeleteSelectedButton
							count={selected.length}
							isPending={removeMutation.isPending}
							label={t("adminPlatform.tasks.deleteSelected")}
							onClick={() =>
								void removeRows(
									(query.data?.items ?? []).filter((row) =>
										selected.includes(row.id),
									),
								)
							}
						/>
					</div>
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={8} columns={6} />}
					errorTitle={t("adminPlatform.tasks.errors.load")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							variant={remoteFilter ? "filtered" : "empty"}
							title={
								remoteFilter
									? t("adminPlatform.tasks.empty.filteredTitle")
									: t("adminPlatform.tasks.empty.title")
							}
							description={
								remoteFilter
									? t("adminPlatform.tasks.empty.filteredDescription")
									: t("adminPlatform.tasks.empty.description")
							}
						/>
					}
				>
					{(result) => (
						<div className="space-y-3">
							<DataTable
								data={result.items}
								getRowId={(row) => row.id}
								columns={columns}
								selectable
								selectedIds={selected}
								onSelectionChange={setSelected}
								onRowClick={(row) => setOpenTask(row)}
								rowActions={(row) => {
									const menuLabel = t("adminPlatform.tasks.menu.ariaLabel", {
										name: row.task_name,
									});
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
													disabled={runMutation.isPending}
													onSelect={() => void runTask(row)}
												>
													<Play aria-hidden="true" />
													{t("adminPlatform.tasks.menu.run")}
												</DropdownMenuItem>
												<DropdownMenuItem
													onSelect={() => setEditing(row)}
												>
													<Pencil aria-hidden="true" />
													{t("adminPlatform.tasks.menu.edit")}
												</DropdownMenuItem>
												<DropdownMenuItem
													onSelect={() => setOpenTask(row)}
												>
													<ScrollText aria-hidden="true" />
													{t("adminPlatform.tasks.menu.detail")}
												</DropdownMenuItem>
												<DropdownMenuItem
													variant="destructive"
													disabled={row.protected}
													onSelect={() => void removeRows([row])}
												>
													<Trash2 aria-hidden="true" />
													{row.protected
														? t(
																"adminPlatform.tasks.menu.protectedDelete",
															)
														: t("adminPlatform.tasks.menu.delete")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									);
								}}
								mobileCard={(row) => (
									<div className="space-y-2">
										<div className="flex items-start justify-between gap-2">
											<span className="font-medium">{row.task_name}</span>
											<TonePill tone={statusTone(row.status)} title={row.status}>
												{statusLabel(row.status)}
											</TonePill>
										</div>
										<p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
											<MonoText>{row.task_key}</MonoText>
											<TonePill tone="muted" title={row.trigger_type}>
												{triggerLabel(row.trigger_type)}
											</TonePill>
											<BooleanPill
												value={row.enabled}
												trueText={t("adminPlatform.common.enabled")}
												falseText={t("adminPlatform.common.disabled")}
											/>
										</p>
										{row.error_msg || row.last_error ? (
											<p className="text-xs text-destructive">
												{truncate(row.error_msg ?? row.last_error ?? "", 90)}
											</p>
										) : null}
										<div className="flex flex-wrap items-center gap-2">
											<Button
												variant="ghost"
												size="sm"
												disabled={runMutation.isPending}
												onClick={() => void runTask(row)}
											>
												<Play aria-hidden="true" />
												{t("adminPlatform.tasks.menu.run")}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setEditing(row)}
											>
												<Pencil aria-hidden="true" />
												{t("adminPlatform.tasks.menu.edit")}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive"
												disabled={row.protected}
												onClick={() => void removeRows([row])}
											>
												<Trash2 aria-hidden="true" />
												{t("adminPlatform.tasks.menu.delete")}
											</Button>
										</div>
									</div>
								)}
							/>
							<PaginationBar
								page={list.page}
								pageSize={list.pageSize}
								total={result.meta.total ?? result.items.length}
								onPageChange={list.setPage}
								onPageSizeChange={list.setPageSize}
								pageSizeOptions={PAGE_SIZE_OPTIONS}
							/>
						</div>
					)}
				</QueryState>
			</SectionCard>

			<ScheduledTaskFormSheet
				open={editing !== undefined}
				row={editing ?? null}
				onOpenChange={(open) => {
					if (!open) setEditing(undefined);
				}}
			/>

			<Sheet open={openTask !== null} onOpenChange={(open) => !open && setOpenTask(null)}>
				<SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl">
					<SheetHeader>
						<SheetTitle>
							{openTask ? openTask.task_name : t("adminPlatform.tasks.detail.title")}
						</SheetTitle>
						<SheetDescription>
							{openTask ? (
								<CopyText
									value={openTask.id}
									label={t("adminPlatform.tasks.detail.idLabel")}
								/>
							) : null}
						</SheetDescription>
					</SheetHeader>
					{openTask ? (
						<div className="space-y-4 px-4 pb-6">
							<KeyValueList
								columns={2}
								items={[
									{
										key: t("adminPlatform.tasks.detail.taskKey"),
										value: <MonoText>{openTask.task_key}</MonoText>,
									},
									{
										key: t("adminPlatform.tasks.detail.status"),
										value: (
											<TonePill
												tone={statusTone(openTask.status)}
												title={openTask.status}
											>
												{statusLabel(openTask.status)}
											</TonePill>
										),
									},
									{
										key: t("adminPlatform.tasks.detail.trigger"),
										value: (
											<MonoText>{openTask.trigger_type}</MonoText>
										),
									},
									{
										key: t("adminPlatform.tasks.detail.cron"),
										value: <MonoText>{openTask.cron_expr ?? "—"}</MonoText>,
									},
									{
										key: t("adminPlatform.tasks.detail.executeAt"),
										value: openTask.execute_at ? (
											<AbsoluteTime value={openTask.execute_at} seconds />
										) : (
											<span>—</span>
										),
									},
									{
										key: t("adminPlatform.tasks.detail.expiresAt"),
										value: openTask.expires_at ? (
											<AbsoluteTime value={openTask.expires_at} seconds />
										) : (
											<span>—</span>
										),
									},
									{
										key: t("adminPlatform.tasks.detail.groupId"),
										value: <MonoText>{openTask.group_id ?? "—"}</MonoText>,
										hint: t("adminPlatform.tasks.detail.groupHint"),
									},
									{
										key: t("adminPlatform.tasks.detail.attempts"),
										value: (
											<MonoText>
												{textOf(openTask.attempt_count)} /{" "}
												{textOf(openTask.max_attempts)}
											</MonoText>
										),
									},
									{
										key: t("adminPlatform.tasks.detail.timeout"),
										value: <MonoText>{textOf(openTask.timeout_secs)}</MonoText>,
										hint: t("adminPlatform.tasks.detail.timeoutHint"),
									},
									{
										key: t("adminPlatform.tasks.detail.lastRun"),
										value: openTask.last_run_at ? (
											<AbsoluteTime value={openTask.last_run_at} seconds />
										) : (
											<span>—</span>
										),
									},
									{
										key: t("adminPlatform.tasks.detail.lockedAt"),
										value: openTask.locked_at ? (
											<AbsoluteTime value={openTask.locked_at} seconds />
										) : (
											<span>—</span>
										),
									},
									{
										key: t("adminPlatform.tasks.detail.heartbeat"),
										value: openTask.heartbeat_at ? (
											<AbsoluteTime value={openTask.heartbeat_at} seconds />
										) : (
											<span>—</span>
										),
									},
								]}
							/>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">
									{t("adminPlatform.tasks.detail.description")}
								</p>
								<ReadonlyBlock>{openTask.description ?? ""}</ReadonlyBlock>
							</div>
							{openTask.error_msg || openTask.last_error ? (
								<div className="space-y-1">
									<p className="text-xs text-destructive">
										{t("adminPlatform.tasks.detail.lastError")}
									</p>
									<ReadonlyBlock className="border-destructive/30 bg-destructive/5 font-mono text-xs">
										{openTask.error_msg ?? openTask.last_error ?? ""}
									</ReadonlyBlock>
								</div>
							) : null}
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">
									{t("adminPlatform.tasks.detail.payload")}
								</p>
								<ReadonlyBlock>
									<pre className="max-h-72 overflow-auto font-mono text-xs">
										{jsonText(openTask.payload) ||
											t("adminPlatform.common.emptyJson")}
									</pre>
								</ReadonlyBlock>
							</div>
						</div>
					) : null}
				</SheetContent>
			</Sheet>
		</PageBody>
	);
}

function ScheduledTaskFormSheet({
	open,
	row,
	onOpenChange,
}: {
	open: boolean;
	row: ScheduledTasks | null;
	onOpenChange: (open: boolean) => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [form, setForm] = useState({
		taskName: "",
		taskKey: "",
		triggerType: "once" as (typeof TRIGGER_TYPES)[number],
		cronExpr: "",
		executeAt: "",
		expiresAt: "",
		description: "",
		enabled: true,
		protected: false,
	});
	const [errors, setErrors] = useState<{
		taskName?: string;
		taskKey?: string;
		executeAt?: string;
		cronExpr?: string;
	}>({});

	function triggerLabel(trigger: string): string {
		switch (trigger) {
			case "once":
				return t("adminPlatform.tasks.trigger.once");
			case "cron":
				return t("adminPlatform.tasks.trigger.cron");
			case "startup":
				return t("adminPlatform.tasks.trigger.startup");
			default:
				return trigger;
		}
	}

	useEffect(() => {
		if (!open) return;
		setErrors({});
		setForm({
			taskName: row?.task_name ?? "",
			taskKey: row?.task_key ?? "",
			triggerType: (row?.trigger_type as (typeof TRIGGER_TYPES)[number]) ?? "once",
			cronExpr: row?.cron_expr ?? "",
			executeAt: row?.execute_at ? toDatetimeLocalValue(row.execute_at) : "",
			expiresAt: row?.expires_at ? toDatetimeLocalValue(row.expires_at) : "",
			description: row?.description ?? "",
			enabled: row?.enabled ?? true,
			protected: row?.protected ?? false,
		});
	}, [open, row]);

	const createMutation = useMutation({
		mutationFn: (input: Partial<ScheduledTasks>) =>
			call(
				client.admin.scheduled_tasks.create(input),
				t("adminPlatform.tasks.requests.create"),
			),
		onSuccess: () => {
			toast.success(t("adminPlatform.tasks.toasts.created"));
			void queryClient.invalidateQueries({ queryKey: qk.admin.scheduledTasks() });
			onOpenChange(false);
		},
		onError: (error) => toast.apiError(t("adminPlatform.tasks.toasts.createFailed"), error),
	});

	const patchMutation = useMutation({
		mutationFn: (input: Partial<ScheduledTasks>) =>
			call(
				client.admin.scheduled_tasks.patch(input),
				t("adminPlatform.tasks.requests.update"),
			),
		onSuccess: () => {
			toast.success(t("adminPlatform.tasks.toasts.updated"));
			void queryClient.invalidateQueries({ queryKey: qk.admin.scheduledTasks() });
			onOpenChange(false);
		},
		onError: (error) => toast.apiError(t("adminPlatform.tasks.toasts.updateFailed"), error),
	});

	const isPending = createMutation.isPending || patchMutation.isPending;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const taskName = form.taskName.trim();
		const taskKey = form.taskKey.trim();
		const nextErrors: typeof errors = {};
		if (taskName.length === 0)
			nextErrors.taskName = t("adminPlatform.tasks.validation.taskNameRequired");
		if (taskKey.length === 0)
			nextErrors.taskKey = t("adminPlatform.tasks.validation.taskKeyRequired");
		if (form.triggerType === "once" && form.executeAt.length === 0) {
			nextErrors.executeAt = t("adminPlatform.tasks.validation.executeAtRequired");
		}
		if (form.triggerType === "cron") {
			const cron = form.cronExpr.trim();
			if (cron.length === 0) {
				nextErrors.cronExpr = t("adminPlatform.tasks.validation.cronRequired");
			} else if (cron.split(/\s+/).filter(Boolean).length !== 7) {
				// 后端用 cron 库校验 7 段（秒 分 时 日 月 周 年）：这里先给出即时反馈。
				nextErrors.cronExpr = t("adminPlatform.tasks.validation.cronShape");
			}
		}
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;

		const executeAt = fromDatetimeLocalValue(form.executeAt);
		const expiresAt = fromDatetimeLocalValue(form.expiresAt);
		const payload: Partial<ScheduledTasks> = {
			task_name: taskName,
			task_key: taskKey,
			trigger_type: form.triggerType,
			description: form.description,
			enabled: form.enabled,
			protected: form.protected,
			...(form.cronExpr.trim().length > 0 ? { cron_expr: form.cronExpr.trim() } : {}),
			...(executeAt ? { execute_at: executeAt } : {}),
			...(expiresAt ? { expires_at: expiresAt } : {}),
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
					? t("adminPlatform.tasks.form.editTitle", { name: row.task_name })
					: t("adminPlatform.tasks.form.createTitle")
			}
			description={t("adminPlatform.tasks.form.description")}
			width="lg"
			footer={
				<FormFooter
					formId="scheduled-task-form"
					isPending={isPending}
					submitLabel={
						row
							? t("adminPlatform.tasks.form.save")
							: t("adminPlatform.tasks.form.create")
					}
					onCancel={() => onOpenChange(false)}
					hint={
						row ? (
							<span>
								{t("adminPlatform.tasks.form.idHint")}{" "}
								<MonoText>{row.id}</MonoText>
							</span>
						) : (
							t("adminPlatform.tasks.form.createHint")
						)
					}
				/>
			}
		>
			<form
				id="scheduled-task-form"
				className="space-y-4"
				onSubmit={(event) => submit(event)}
			>
				<FormGrid columns={2}>
					<Field
						label={t("adminPlatform.tasks.form.taskName")}
						htmlFor="task-name"
						required
						error={errors.taskName}
					>
						<Input
							id="task-name"
							value={form.taskName}
							onChange={(event) =>
								setForm({ ...form, taskName: event.target.value })
							}
						/>
					</Field>
					<Field
						label={t("adminPlatform.tasks.form.taskKey")}
						htmlFor="task-key"
						required
						error={errors.taskKey}
						hint={t("adminPlatform.tasks.form.taskKeyHint")}
					>
						<Input
							id="task-key"
							className="font-mono text-xs"
							value={form.taskKey}
							onChange={(event) =>
								setForm({ ...form, taskKey: event.target.value })
							}
						/>
					</Field>
				</FormGrid>
				<FormGrid columns={2}>
					<Field
						label={t("adminPlatform.tasks.form.triggerType")}
						htmlFor="task-trigger"
					>
						<Select
							value={form.triggerType}
							onValueChange={(value) =>
								setForm({
									...form,
									triggerType: value as (typeof TRIGGER_TYPES)[number],
								})
							}
						>
							<SelectTrigger id="task-trigger" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TRIGGER_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{triggerLabel(type)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field
						label={t("adminPlatform.tasks.form.cron")}
						htmlFor="task-cron"
						error={errors.cronExpr}
						hint={t("adminPlatform.tasks.form.cronHint")}
					>
						<Input
							id="task-cron"
							className="font-mono text-xs"
							placeholder={t("adminPlatform.tasks.form.cronPlaceholder")}
							value={form.cronExpr}
							onChange={(event) =>
								setForm({ ...form, cronExpr: event.target.value })
							}
						/>
					</Field>
				</FormGrid>
				<FormGrid columns={2}>
					<Field
						label={t("adminPlatform.tasks.form.executeAt")}
						htmlFor="task-execute-at"
						error={errors.executeAt}
						hint={t("adminPlatform.tasks.form.executeAtHint")}
					>
						<Input
							id="task-execute-at"
							type="datetime-local"
							value={form.executeAt}
							onChange={(event) =>
								setForm({ ...form, executeAt: event.target.value })
							}
						/>
					</Field>
					<Field
						label={t("adminPlatform.tasks.form.expiresAt")}
						htmlFor="task-expires-at"
						hint={t("adminPlatform.tasks.form.expiresAtHint")}
					>
						<Input
							id="task-expires-at"
							type="datetime-local"
							value={form.expiresAt}
							onChange={(event) =>
								setForm({ ...form, expiresAt: event.target.value })
							}
						/>
					</Field>
				</FormGrid>
				<LocalTimeHint />
				<Field
					label={t("adminPlatform.tasks.form.descriptionField")}
					htmlFor="task-description"
				>
					<Textarea
						id="task-description"
						style={{ minHeight: 80 }}
						value={form.description}
						onChange={(event) =>
							setForm({ ...form, description: event.target.value })
						}
					/>
				</Field>
				<FormGrid columns={2}>
					<Field
						label={t("adminPlatform.tasks.form.enabled")}
						htmlFor="task-enabled"
						hint={t("adminPlatform.tasks.form.enabledHint")}
					>
						<div className="flex items-center gap-2">
							<Switch
								id="task-enabled"
								checked={form.enabled}
								onCheckedChange={(checked) =>
									setForm({ ...form, enabled: checked })
								}
							/>
							<BooleanPill
								value={form.enabled}
								trueText={t("adminPlatform.common.enabled")}
								falseText={t("adminPlatform.common.disabled")}
							/>
						</div>
					</Field>
					<Field
						label={t("adminPlatform.tasks.form.protected")}
						htmlFor="task-protected"
						hint={t("adminPlatform.tasks.form.protectedHint")}
					>
						<div className="flex items-center gap-2">
							<Switch
								id="task-protected"
								checked={form.protected}
								onCheckedChange={(checked) =>
									setForm({ ...form, protected: checked })
								}
							/>
							<BooleanPill
								value={form.protected}
								trueText={t("adminPlatform.common.protected")}
								falseText={t("adminPlatform.common.deletable")}
							/>
						</div>
					</Field>
				</FormGrid>
				<p className="text-xs text-muted-foreground">
					{t("adminPlatform.tasks.form.runtimeNote")}
				</p>
			</form>
		</FormSheet>
	);
}
