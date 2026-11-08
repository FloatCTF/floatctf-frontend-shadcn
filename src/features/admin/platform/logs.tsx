/**
 * 管理端 · 操作日志（`/admin/platform/logs`）。
 *
 * 真实接口：`client.admin.logs.fetch({ page, limit, filter })`。
 * 后端语义（`apps/api/src/modules/platform/operations/logs.rs`）：
 * - `filter` 支持精确/包含映射：`id`、`actor_user_id`（Wave 6 起合并了 v1 的 user_id/superadmin_id）、`ip_address`(contains)、
 *   `category`(eq)、`action`(contains)、`level`(eq)；
 * - `filter` 语法是 `key:value`，多个条件用 ` & ` 连接（`|` 是 OR 分组）；
 * - 实体里**没有** `target` 字段：日志维度是 `category` + `action`（以实体为准）。
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw, ScrollText } from "lucide-react";

import type { Logs } from "@floatctf/sdk/entity";

import { callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill, type PillTone } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
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
import { AbsoluteTime } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
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
import { truncate } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import { SearchInput, jsonText, sanitizeFilterValue, useListState } from "./components";

const PAGE_SIZE_OPTIONS = [20, 50, 100];

/** 日志级别（后端 `add_log` 使用大写：INFO / WARN / ERROR / DEBUG）。 */
const LEVELS = ["INFO", "WARN", "ERROR", "DEBUG"] as const;

const LEVEL_TONE: Record<string, PillTone> = {
	info: "info",
	warn: "warning",
	warning: "warning",
	error: "danger",
	debug: "muted",
};

type SearchField = "action" | "category" | "ip_address" | "actor_user_id" | "level";

function levelTone(level: string): PillTone {
	return LEVEL_TONE[level.toLowerCase()] ?? "neutral";
}

export function AdminLogsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminPlatform.logs.documentTitle"));
	const client = useClient();
	const list = useListState(50);
	const [level, setLevel] = useState<string>("all");
	const [field, setField] = useState<SearchField>("action");
	const [openLog, setOpenLog] = useState<Logs | null>(null);

	const searchFields = useMemo(
		() =>
			[
				{
					value: "action" as const,
					label: t("adminPlatform.logs.search.fields.action"),
					hint: t("adminPlatform.logs.search.hints.contains"),
				},
				{
					value: "category" as const,
					label: t("adminPlatform.logs.search.fields.category"),
					hint: t("adminPlatform.logs.search.hints.exact"),
				},
				{
					value: "ip_address" as const,
					label: t("adminPlatform.logs.search.fields.ip"),
					hint: t("adminPlatform.logs.search.hints.contains"),
				},
				{
					value: "actor_user_id" as const,
					label: t("adminPlatform.logs.search.fields.actor"),
					hint: t("adminPlatform.logs.search.hints.exactUuid"),
				},
				{
					value: "level" as const,
					label: t("adminPlatform.logs.search.fields.level"),
					hint: t("adminPlatform.logs.search.hints.exact"),
				},
			],
		[t],
	);

	const searchValue = sanitizeFilterValue(list.filter);
	const conditions: string[] = [];
	if (level !== "all") conditions.push(`level:${level}`);
	if (searchValue.length > 0) conditions.push(`${field}:${searchValue}`);
	const remoteFilter = conditions.length > 0 ? conditions.join(" & ") : undefined;

	useEffect(() => {
		list.setPage(1);
		// 级别 / 字段变化也需要回到第 1 页（list.filter 变化由 useListState 处理）。
	}, [level, field, list.setPage]);

	const params = {
		page: list.page,
		limit: list.pageSize,
		...(remoteFilter ? { filter: remoteFilter } : {}),
	};

	const query = useQuery({
		queryKey: qk.admin.logs(params),
		queryFn: () => callList<Logs>(client.admin.logs.fetch(params)),
		placeholderData: keepPreviousData,
	});

	const fieldMeta = searchFields.find((item) => item.value === field);

	const columns: DataTableColumn<Logs>[] = [
		{
			id: "id",
			header: t("adminPlatform.logs.columns.id"),
			sortValue: (row) => row.id,
			cell: (row) => <MonoText className="text-xs text-muted-foreground">{row.id}</MonoText>,
			hideBelow: "lg",
		},
		{
			id: "category",
			header: t("adminPlatform.logs.columns.category"),
			sortValue: (row) => row.category,
			cell: (row) => <MonoText>{row.category}</MonoText>,
		},
		{
			id: "action",
			header: t("adminPlatform.logs.columns.action"),
			sortValue: (row) => row.action,
			cell: (row) => <MonoText>{row.action}</MonoText>,
		},
		{
			id: "level",
			header: t("adminPlatform.logs.columns.level"),
			sortValue: (row) => row.level,
			cell: (row) => (
				<TonePill tone={levelTone(row.level)}>
					{t(`adminPlatform.logs.levels.${row.level.toLowerCase()}`)}
				</TonePill>
			),
		},
		{
			id: "message",
			header: t("adminPlatform.logs.columns.message"),
			cell: (row) => (
				<span className="break-words" title={row.message}>
					{truncate(row.message, 80)}
				</span>
			),
		},
		{
			id: "actor_user_id",
			header: t("adminPlatform.logs.columns.actor"),
			cell: (row) => <MonoText className="text-muted-foreground">{row.actor_user_id ?? "—"}</MonoText>,
			hideBelow: "lg",
		},
		{
			id: "ip_address",
			header: t("adminPlatform.logs.columns.ip"),
			sortValue: (row) => row.ip_address ?? "",
			cell: (row) => <MonoText className="text-muted-foreground">{row.ip_address ?? "—"}</MonoText>,
			hideBelow: "lg",
		},
		{
			id: "details",
			header: t("adminPlatform.logs.columns.details"),
			cell: (row) => (
				<span className="line-clamp-2 max-w-md break-all text-xs text-muted-foreground">
					{jsonText(row.details)}
				</span>
			),
			hideBelow: "xl",
		},
		{
			id: "created_at",
			header: t("adminPlatform.logs.columns.time"),
			sortValue: (row) => Date.parse(row.created_at),
			cell: (row) => <AbsoluteTime value={row.created_at} seconds />,
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("adminPlatform.logs.title")}
				description={t("adminPlatform.logs.description")}
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
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminPlatform.logs.section.title")}
				description={t("adminPlatform.logs.section.description")}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						<Select
							value={field}
							onValueChange={(value) => setField(value as SearchField)}
						>
							<SelectTrigger
								size="sm"
								className="w-32"
								aria-label={t("adminPlatform.logs.search.fieldAria")}
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
						<Select value={level} onValueChange={setLevel}>
							<SelectTrigger
								size="sm"
								className="w-32"
								aria-label={t("adminPlatform.logs.search.levelAria")}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									{t("adminPlatform.logs.search.allLevels")}
								</SelectItem>
								{LEVELS.map((item) => (
									<SelectItem key={item} value={item}>
										{t(`adminPlatform.logs.levels.${item.toLowerCase()}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FilterChips
							filters={
								level === "all"
									? []
									: [
											{
												key: "level",
												label: t(`adminPlatform.logs.levels.${level.toLowerCase()}`),
												onRemove: () => setLevel("all"),
											},
										]
							}
						/>
						<SearchInput
							value={list.search}
							onChange={list.setSearch}
							placeholder={t("adminPlatform.logs.search.placeholder", {
								field:
									fieldMeta?.label ??
									t("adminPlatform.logs.search.fields.fallback"),
								hint: fieldMeta?.hint ?? "",
							})}
						/>
					</div>
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={8} columns={6} />}
					errorTitle={t("adminPlatform.logs.errorTitle")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							variant={remoteFilter ? "filtered" : "empty"}
							title={
								remoteFilter
									? t("adminPlatform.logs.empty.filteredTitle")
									: t("adminPlatform.logs.empty.title")
							}
							description={
								remoteFilter
									? t("adminPlatform.logs.empty.filteredDescription")
									: t("adminPlatform.logs.empty.description")
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
								onRowClick={(row) => setOpenLog(row)}
								mobileCard={(row) => (
									<button
										type="button"
										className="w-full space-y-2 text-left"
										onClick={() => setOpenLog(row)}
									>
										<div className="flex items-center justify-between gap-2">
											<TonePill tone={levelTone(row.level)}>{row.level}</TonePill>
											<AbsoluteTime value={row.created_at} seconds />
										</div>
										<p className="text-sm break-words">{row.message}</p>
										<p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
											<MonoText>{row.category}</MonoText>
											<MonoText>{row.action}</MonoText>
											<MonoText>{row.ip_address ?? "—"}</MonoText>
										</p>
									</button>
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

			<Sheet open={openLog !== null} onOpenChange={(open) => !open && setOpenLog(null)}>
				<SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl">
					<SheetHeader>
						<SheetTitle className="flex items-center gap-2">
							<ScrollText className="size-4" aria-hidden="true" />
							{t("adminPlatform.logs.detail.title")}
						</SheetTitle>
						<SheetDescription>
							{openLog ? (
								<CopyText
									value={openLog.id}
									label={t("adminPlatform.logs.detail.idLabel")}
								/>
							) : null}
						</SheetDescription>
					</SheetHeader>
					{openLog ? (
						<div className="space-y-4 px-4 pb-6">
							<KeyValueList
								items={[
									{
										key: t("adminPlatform.logs.detail.time"),
										value: <AbsoluteTime value={openLog.created_at} seconds />,
									},
									{
										key: t("adminPlatform.logs.detail.level"),
										value: (
											<TonePill tone={levelTone(openLog.level)}>
												{openLog.level}
											</TonePill>
										),
									},
									{
										key: t("adminPlatform.logs.detail.category"),
										value: <MonoText>{openLog.category}</MonoText>,
									},
									{
										key: t("adminPlatform.logs.detail.action"),
										value: <MonoText>{openLog.action}</MonoText>,
									},
									{
										key: t("adminPlatform.logs.detail.ip"),
										value: (
											<MonoText>{openLog.ip_address ?? "—"}</MonoText>
										),
									},
									{
										key: t("adminPlatform.logs.detail.actor"),
										value: (
											<MonoText>{openLog.actor_user_id ?? "—"}</MonoText>
										),
									},
								]}
								columns={2}
							/>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">
									{t("adminPlatform.logs.detail.message")}
								</p>
								<ReadonlyBlock>{openLog.message}</ReadonlyBlock>
							</div>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">
									{t("adminPlatform.logs.detail.details")}
								</p>
								<ReadonlyBlock>
									<pre className="max-h-96 overflow-auto font-mono text-xs">
										{jsonText(openLog.details) ||
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
