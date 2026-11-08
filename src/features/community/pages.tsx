/**
 * 社区域列表页 —— Top15 排行榜、解题流水、全站公告、武器库。
 *
 * 口径：
 * - 分页一律「page 从 1 开始 + pageSize + `meta.total`」（`QueryParams` 只有 page/limit/filter）。
 * - 搜索框是受控 `Input` + `useDebouncedValue(300)`，值喂给后端 `filter`；
 *   后端过滤串语法是 `key:value` 且**条件之间用 `&` 分隔**。
 * - 后端确实没有搜索参数时（Top15 / 题解），不做假的「服务端搜索」：
 *   排行榜是定长 15 条（视图内分页），题解接口一次性返回全部（视图内搜索 + 分页），
 *   页面描述里会写明该事实。
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Activity, Check, Download, Megaphone, Swords, Trophy } from "lucide-react";

import type { SolveResult, TopUser } from "@floatctf/sdk";
import type { Announcements, Weapons } from "@floatctf/sdk/entity";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { FilterBar, type FilterKey } from "~/components/app/filter-bar";
import {
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	StatCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	ErrorBlock,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { RelativeTime, UserCell } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { formatDateTime, formatInt } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";


function rankTone(no: number): "warning" | "info" | "muted" {
	if (no === 1) return "warning";
	if (no <= 3) return "info";
	return "muted";
}

/** Top15 用户排行榜（后端固定返回 15 条，无过滤参数）。 */
export function RankPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("community.rank.documentTitle"));
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	const query = useQuery({
		queryKey: qk.solves.top15(),
		queryFn: () => call<TopUser[]>(client.service.solves.getTop15Users(), t("community.requests.top15")),
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});

	const rows = query.data ?? [];
	const paged = useMemo(
		() => rows.slice((page - 1) * pageSize, page * pageSize),
		[rows, page, pageSize],
	);
	const leader = rows[0];
	const latest = rows.reduce<string | null>(
		(acc, row) => (acc === null || row.solved_last_at > acc ? row.solved_last_at : acc),
		null,
	);

	const columns: DataTableColumn<TopUser>[] = [
		{
			id: "no",
			header: t("community.rank.columns.rank"),
			align: "center",
			sortValue: (row) => row.no,
			cell: (row) => (
				<TonePill tone={rankTone(row.no)}>
					{row.no === 1 ? <Trophy aria-hidden="true" /> : null}#{row.no}
				</TonePill>
			),
		},
		{
			id: "nickname",
			header: t("community.rank.columns.player"),
			sortValue: (row) => row.nickname,
			cell: (row) => (
				<UserCell
					username={row.nickname}
					nickname={row.nickname}
					avatar={row.avatar ?? null}
					secondary="none"
				/>
			),
		},
		{
			id: "solved_count",
			header: t("community.rank.columns.solvedCount"),
			align: "right",
			sortValue: (row) => row.solved_count,
			cell: (row) => <span className="tnum text-sm">{formatInt(row.solved_count)}</span>,
		},
		{
			id: "solved_last_at",
			header: t("community.rank.columns.lastSolved"),
			align: "right",
			sortValue: (row) => row.solved_last_at,
			cell: (row) => <RelativeTime value={row.solved_last_at} />,
		},
	];

	const header = (
		<PageHeader
			title={t("community.rank.title")}
			description={t("community.rank.subtitle")}
			badge={<TonePill tone="info">{t("community.rank.badge")}</TonePill>}
			actions={
				<Toolbar>
					<Button variant="outline" asChild>
						<Link to="/solves">
							<Activity aria-hidden="true" /> {t("community.rank.actions.solves")}
						</Link>
					</Button>
				</Toolbar>
			}
		/>
	);

	if (query.isError) {
		return (
			<PageBody>
				{header}
				<ErrorBlock
					error={query.error}
					title={t("community.rank.loadError")}
					onRetry={() => void query.refetch()}
				/>
			</PageBody>
		);
	}

	return (
		<PageBody>
			{header}

			<div className="grid gap-4 sm:grid-cols-3">
				<StatCard
					label={t("community.rank.stats.usersLabel")}
					value={query.isPending ? "…" : formatInt(rows.length)}
					hint={t("community.rank.stats.usersHint")}
					icon={<Trophy aria-hidden="true" className="size-4" />}
				/>
				<StatCard
					label={t("community.rank.stats.leaderLabel")}
					value={leader?.nickname ?? t("common.empty")}
					hint={
						leader
							? t("community.rank.stats.leaderHint", {
									count: formatInt(leader.solved_count),
								})
							: t("community.rank.stats.leaderEmptyHint")
					}
					icon={<Trophy aria-hidden="true" className="size-4" />}
					tone="success"
				/>
				<StatCard
					label={t("community.rank.stats.latestLabel")}
					value={<RelativeTime value={latest} className="text-sm" />}
					hint={t("community.rank.stats.latestHint")}
					icon={<Activity aria-hidden="true" className="size-4" />}
				/>
			</div>

			<SectionCard
				title={t("community.rank.section.title")}
				description={t("community.rank.section.description")}
				actions={<RefreshingBadge active={query.isFetching && !query.isPending} />}
				contentClassName="px-0"
				footer={
					<PaginationBar
						page={page}
						pageSize={pageSize}
						total={rows.length}
						onPageChange={setPage}
						onPageSizeChange={(size) => {
							setPageSize(size);
							setPage(1);
						}}
						pageSizeOptions={[10, 15]}
					/>
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={4} />}
					errorTitle={t("community.rank.errors.load")}
					isEmpty={(list) => list.length === 0}
					empty={
						<EmptyBlock
							title={t("community.rank.empty.title")}
							description={t("community.rank.empty.description")}
							icon={<Trophy aria-hidden="true" />}
							action={
								<Button size="sm" asChild>
									<Link to="/challenges">{t("community.rank.empty.action")}</Link>
								</Button>
							}
						/>
					}
				>
					{() => (
						<DataTable
							data={paged}
							getRowId={(row) => String(row.no)}
							columns={columns}
							mobileCard={(row) => (
								<div className="space-y-1.5">
									<div className="flex items-center justify-between gap-2">
										<UserCell
											username={row.nickname}
											nickname={row.nickname}
											avatar={row.avatar ?? null}
											secondary="none"
										/>
										<TonePill tone={rankTone(row.no)}>#{row.no}</TonePill>
									</div>
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span>
											{t("community.rank.mobile.solved", {
												count: formatInt(row.solved_count),
											})}
										</span>
										<RelativeTime value={row.solved_last_at} />
									</div>
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}

/** 解题流水：后端只返回**当前账号**在练习赛事中的解题记录，支持按题目过滤。 */
export function SolvesPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("community.solves.documentTitle"));
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [draftFilter, setDraftFilter] = useState("");
	const [appliedFilter, setAppliedFilter] = useState("");
	const filter = appliedFilter.trim() || undefined;
	const query = useQuery({
		queryKey: qk.solves.list({ page, limit: pageSize, filter }),
		queryFn: () =>
			callList<SolveResult>(client.service.solves.fetch({ page, limit: pageSize, filter })),
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});

	const columns: DataTableColumn<SolveResult>[] = [
		{
			id: "challenge",
			header: t("community.solves.columns.challenge"),
			sortValue: (row) => row.challenge_name,
			cell: (row) => (
				<Link
					to={`/challenges/${row.challenge_id}`}
					className="text-sm font-medium hover:underline"
				>
					{row.challenge_name}
				</Link>
			),
		},
		{
			id: "solver",
			header: t("community.solves.columns.solver"),
			sortValue: (row) => row.nickname,
			cell: (row) => (
				<UserCell
					username={row.nickname}
					nickname={row.nickname}
					avatar={row.avatar ?? null}
					secondary="none"
				/>
			),
		},
		{
			id: "updated_at",
			header: t("community.solves.columns.updatedAt"),
			sortValue: (row) => row.updated_at ?? row.created_at,
			cell: (row) => <RelativeTime value={row.updated_at ?? row.created_at} />,
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("community.solves.title")}
				description={t("community.solves.subtitle")}
			/>
			<SectionCard
				title={t("community.solves.section.title")}
				description={t("community.solves.section.description")}
				contentClassName="px-0"
				actions={
					<FilterBar
						keys={[
							{ key: "challenge_id", label: t("community.solves.columns.challenge") },
						] satisfies FilterKey[]}
						value={draftFilter}
						onChange={setDraftFilter}
						onApply={() => {
							setAppliedFilter(draftFilter.trim());
							setPage(1);
						}}
						onClear={() => {
							setDraftFilter("");
							setAppliedFilter("");
							setPage(1);
						}}
						placeholder={t("common.filter.placeholder")}
					/>
				}
				footer={
					query.data && query.data.items.length > 0 ? (
						<PaginationBar
							page={page}
							pageSize={pageSize}
							total={query.data.meta?.total ?? query.data.items.length}
							onPageChange={setPage}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
						/>
					) : null
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={3} />}
					errorTitle={t("community.solves.errors.load")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							title={t("community.solves.empty.title")}
							description={t("community.solves.empty.description")}
						/>
					}
				>
					{(result) => (
						<DataTable
							data={result.items}
							getRowId={(row) => String(row.id ?? `${row.challenge_id}:${row.nickname}`)}
							columns={columns}
							mobileCard={(row) => (
								<div className="space-y-1">
									<Link to={`/challenges/${row.challenge_id}`} className="text-sm font-medium hover:underline">
										{row.challenge_name}
									</Link>
									<p className="text-xs text-muted-foreground">{row.nickname}</p>
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}

export function AnnouncementsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("community.announcements.documentTitle"));
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [draftFilter, setDraftFilter] = useState("");
	const [appliedFilter, setAppliedFilter] = useState("");
	const filter = appliedFilter.trim() || undefined;

	const query = useQuery({
		queryKey: qk.announcements.list({ page, limit: pageSize, filter }),
		queryFn: () =>
			callList<Announcements>(
				client.service.announcements.fetch({ page, limit: pageSize, filter }),
			),
		refetchInterval: 60_000,
		refetchIntervalInBackground: false,
	});

	const columns: DataTableColumn<Announcements>[] = [
		{
			id: "publisher",
			header: t("community.announcements.columns.publisher"),
			sortValue: (row) => row.publisher,
			cell: (row) => <span className="text-sm">{row.publisher || t("common.empty")}</span>,
		},
		{
			id: "title",
			header: t("community.announcements.columns.title"),
			sortValue: (row) => row.title,
			cell: (row) => <span className="text-sm font-medium">{row.title}</span>,
		},
		{
			id: "content",
			header: t("community.announcements.columns.content"),
			cell: (row) => (
				<div className="line-clamp-3 max-w-2xl text-sm break-words whitespace-pre-wrap text-muted-foreground">
					{row.content && row.content.trim() !== "" ? row.content : t("common.empty")}
				</div>
			),
		},
		{
			id: "created_at",
			header: t("community.announcements.columns.createdAt"),
			sortValue: (row) => row.created_at,
			cell: (row) => <span className="tnum text-xs">{formatDateTime(row.created_at)}</span>,
		},
		{
			id: "updated_at",
			header: t("community.announcements.columns.updatedAt"),
			sortValue: (row) => row.updated_at,
			cell: (row) => <span className="tnum text-xs">{formatDateTime(row.updated_at)}</span>,
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("community.announcements.title")}
				description={t("community.announcements.subtitle")}
				badge={<TonePill tone="info">{t("community.announcements.badge")}</TonePill>}
			/>

			<SectionCard
				title={t("community.announcements.section.title")}
				description={t("community.announcements.section.description")}
				actions={
					<FilterBar
						keys={[
							{ key: "title", label: t("community.announcements.columns.title") },
							{ key: "content", label: t("community.announcements.columns.content") },
						] satisfies FilterKey[]}
						value={draftFilter}
						onChange={setDraftFilter}
						onApply={() => {
							setAppliedFilter(draftFilter.trim());
							setPage(1);
						}}
						onClear={() => {
							setDraftFilter("");
							setAppliedFilter("");
							setPage(1);
						}}
						placeholder={t("common.filter.placeholder")}
					/>
				}
				contentClassName="px-0"
				footer={
					<PaginationBar
						page={page}
						pageSize={pageSize}
						total={query.data?.meta.total ?? query.data?.items.length ?? 0}
						onPageChange={setPage}
						onPageSizeChange={(size) => {
							setPageSize(size);
							setPage(1);
						}}
					/>
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={4} />}
					errorTitle={t("community.announcements.errors.load")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						appliedFilter === "" ? (
							<EmptyBlock
								title={t("community.announcements.empty.title")}
								description={t("community.announcements.empty.description")}
								icon={<Megaphone aria-hidden="true" />}
							/>
						) : (
							<EmptyBlock
								variant="filtered"
								title={t("community.announcements.filtered.title")}
								description={t("community.announcements.filtered.description", {
									query: appliedFilter,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => {
										setDraftFilter("");
										setAppliedFilter("");
									}}>
										{t("community.announcements.filtered.clear")}
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
							mobileCard={(row) => (
								<div className="space-y-1.5">
									<p className="text-sm font-medium">{row.title}</p>
									<p className="line-clamp-4 text-xs break-words whitespace-pre-wrap text-muted-foreground">
										{row.content && row.content.trim() !== ""
											? row.content
											: t("common.empty")}
									</p>
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span>{row.publisher || t("common.empty")}</span>
										<RelativeTime value={row.created_at} />
									</div>
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}

/** 武器库：只读列表 + 附件下载（`file_url` 是对象存储 key，公网路径为 `/public/<key>`）。 */
export function ArsenalPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("community.arsenal.documentTitle"));
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [draftFilter, setDraftFilter] = useState("");
	const [appliedFilter, setAppliedFilter] = useState("");
	const filter = appliedFilter.trim() || undefined;

	const query = useQuery({
		queryKey: qk.weapons.list({ page, limit: pageSize, filter }),
		queryFn: () =>
			callList<Weapons>(client.service.weapons.fetch({ page, limit: pageSize, filter })),
	});

	const columns: DataTableColumn<Weapons>[] = [
		{
			id: "name",
			header: t("community.arsenal.columns.name"),
			sortValue: (row) => row.name,
			cell: (row) => <span className="text-sm font-medium">{row.name}</span>,
		},
		{
			id: "category",
			header: t("community.arsenal.columns.category"),
			sortValue: (row) => row.category,
			cell: (row) => <span className="text-sm">{row.category || "—"}</span>,
		},
		{
			id: "description",
			header: t("community.arsenal.columns.description"),
			cell: (row) => (
				<p className="line-clamp-3 max-w-xl text-sm break-words text-muted-foreground">
					{row.description?.trim() ? row.description : "—"}
				</p>
			),
		},
		{
			id: "has_file",
			header: t("community.arsenal.columns.hasFile"),
			sortValue: (row) => (row.has_file ? 1 : 0),
			cell: (row) =>
				row.has_file ? (
					<Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-label={t("common.yes")} />
				) : null,
		},
		{
			id: "file_url",
			header: t("community.arsenal.columns.fileUrl"),
			cell: (row) => <WeaponFile row={row} />,
		},
		{
			id: "updated_at",
			header: t("community.arsenal.columns.updatedAt"),
			sortValue: (row) => row.updated_at,
			cell: (row) => <span className="tnum text-xs">{formatDateTime(row.updated_at)}</span>,
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("community.arsenal.title")}
				description={t("community.arsenal.subtitle")}
				badge={<TonePill tone="info">{t("community.arsenal.badge")}</TonePill>}
			/>

			<SectionCard
				title={t("community.arsenal.section.title")}
				description={t("community.arsenal.section.description")}
				actions={
					<FilterBar
						keys={[
							{ key: "name", label: t("community.arsenal.columns.name") },
							{ key: "category", label: t("community.arsenal.columns.category") },
							{ key: "has_file", label: t("community.arsenal.columns.hasFile") },
						] satisfies FilterKey[]}
						value={draftFilter}
						onChange={setDraftFilter}
						onApply={() => {
							setAppliedFilter(draftFilter.trim());
							setPage(1);
						}}
						onClear={() => {
							setDraftFilter("");
							setAppliedFilter("");
							setPage(1);
						}}
						placeholder={t("common.filter.placeholder")}
					/>
				}
				contentClassName="px-0"
				footer={
					<PaginationBar
						page={page}
						pageSize={pageSize}
						total={query.data?.meta.total ?? query.data?.items.length ?? 0}
						onPageChange={setPage}
						onPageSizeChange={(size) => {
							setPageSize(size);
							setPage(1);
						}}
					/>
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={4} />}
					errorTitle={t("community.arsenal.errors.load")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						appliedFilter === "" ? (
							<EmptyBlock
								title={t("community.arsenal.empty.title")}
								description={t("community.arsenal.empty.description")}
								icon={<Swords aria-hidden="true" />}
							/>
						) : (
							<EmptyBlock
								variant="filtered"
								title={t("community.arsenal.filtered.title")}
								description={t("community.arsenal.filtered.description", {
									query: appliedFilter,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => {
										setDraftFilter("");
										setAppliedFilter("");
									}}>
										{t("community.arsenal.filtered.clear")}
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
							mobileCard={(row) => (
								<div className="space-y-1.5">
									<div className="flex items-center justify-between gap-2">
										<span className="truncate text-sm font-medium">{row.name}</span>
										<TonePill tone="neutral">
											{row.category || t("community.arsenal.uncategorized")}
										</TonePill>
									</div>
									{row.description ? (
										<p className="line-clamp-3 text-xs text-muted-foreground">
											{row.description}
										</p>
									) : null}
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<WeaponFile row={row} />
										<span className="tnum">
											{t("community.arsenal.mobile.downloads", {
												count: formatInt(row.download_count),
											})}
										</span>
									</div>
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}

/** 附件下载单元：`file_url` 是对象存储 key，平台公网路径为 `/public/<key>`（与 Default 一致）。 */
function WeaponFile({ row }: { row: Weapons }) {
	const { t } = useTranslation();
	if (!row.has_file || row.file_url.trim() === "") {
		return (
			<TonePill tone="muted">
				{t("community.arsenal.noFile")}
			</TonePill>
		);
	}
	const key = row.file_url.replace(/^\/+/, "");
	const name = key.split("/").pop() ?? key;
	return (
		<a
			href={`/public/${key}`}
			target="_blank"
			rel="noopener noreferrer"
			download
			className="inline-flex items-center gap-1 text-xs hover:underline"
			title={key}
		>
			<Download aria-hidden="true" className="size-4" />
			{name}
		</a>
	);
}
