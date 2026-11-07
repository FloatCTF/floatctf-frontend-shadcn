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
import { Activity, Download, Megaphone, Puzzle, Swords, Trophy } from "lucide-react";

import type { SolveResult, TopUser } from "@floatctf/sdk";
import type { Announcements, Weapons } from "@floatctf/sdk/entity";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
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
	InlineError,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { RelativeTime, UserAvatar, UserCell } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { formatInt, formatScore } from "~/lib/format";
import { useDebouncedValue, useDocumentTitle } from "~/lib/hooks";

import { SearchField } from "./components";

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

	return (
		<PageBody>
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
	const [challengeId, setChallengeId] = useState("all");

	// 过滤选项：后端 `/solves` 只支持 id / challenge_id / event_id 三个键，
	// 因此用「自己解题记录里出现过的题目」构造题目下拉（真实数据，不是枚举题库）。
	const optionsQuery = useQuery({
		queryKey: qk.solves.list({ limit: 200, purpose: "filter-options" }),
		queryFn: () => callList<SolveResult>(client.service.solves.fetch({ limit: 200 })),
	});

	const filter = challengeId === "all" ? undefined : `challenge_id:${challengeId}`;
	const query = useQuery({
		queryKey: qk.solves.list({ page, limit: pageSize, filter }),
		queryFn: () =>
			callList<SolveResult>(client.service.solves.fetch({ page, limit: pageSize, filter })),
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});

	const challengeOptions = useMemo(() => {
		const map = new Map<string, string>();
		for (const item of optionsQuery.data?.items ?? []) {
			map.set(item.challenge_id, item.challenge_name);
		}
		return [...map.entries()]
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
	}, [optionsQuery.data]);

	const items = query.data?.items ?? [];
	const pageScore = items.reduce(
		(sum, item) => sum + item.obtained_points + item.bonus_points,
		0,
	);

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
			hideBelow: "sm",
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
			id: "points",
			header: t("community.solves.columns.points"),
			align: "right",
			sortValue: (row) => row.obtained_points + row.bonus_points,
			cell: (row) => (
				<span className="tnum text-sm">
					+{formatScore(row.obtained_points)}
					{row.bonus_points !== 0 ? (
						<span className="text-muted-foreground">
							{t("community.solves.points.bonus", {
								score: formatScore(row.bonus_points),
							})}
						</span>
					) : null}
				</span>
			),
		},
		{
			id: "created_at",
			header: t("community.solves.columns.createdAt"),
			align: "right",
			sortValue: (row) => row.created_at,
			cell: (row) => <RelativeTime value={row.created_at} />,
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("community.solves.title")}
				description={t("community.solves.subtitle")}
				actions={
					<Toolbar>
						<Button variant="outline" asChild>
							<Link to="/rank">
								<Trophy aria-hidden="true" /> {t("community.solves.actions.rank")}
							</Link>
						</Button>
						<Button asChild>
							<Link to="/challenges">
								<Puzzle aria-hidden="true" /> {t("community.solves.actions.challenges")}
							</Link>
						</Button>
					</Toolbar>
				}
			/>

			<div className="grid gap-4 sm:grid-cols-2">
				<StatCard
					label={t("community.solves.stats.totalLabel")}
					value={query.isPending ? "…" : formatInt(query.data?.meta.total ?? items.length)}
					hint={t("community.solves.stats.totalHint")}
					icon={<Activity aria-hidden="true" className="size-4" />}
				/>
				<StatCard
					label={t("community.solves.stats.pageScoreLabel")}
					value={query.isPending ? "…" : formatScore(pageScore)}
					hint={t("community.solves.stats.pageScoreHint", { count: items.length })}
					icon={<Trophy aria-hidden="true" className="size-4" />}
					tone="success"
				/>
			</div>

			<SectionCard
				title={t("community.solves.section.title")}
				description={t("community.solves.section.description")}
				actions={
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						{optionsQuery.isError ? (
							<InlineError error={optionsQuery.error} className="text-xs" />
						) : null}
						<Select
							value={challengeId}
							disabled={optionsQuery.isPending}
							onValueChange={(value) => {
								setChallengeId(value);
								setPage(1);
							}}
						>
							<SelectTrigger
								size="sm"
								className="w-[220px]"
								aria-label={t("community.solves.filter.ariaLabel")}
							>
								<SelectValue placeholder={t("community.solves.filter.all")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{t("community.solves.filter.all")}</SelectItem>
								{challengeOptions.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Toolbar>
				}
				contentClassName="px-0"
				footer={
					<PaginationBar
						page={page}
						pageSize={pageSize}
						total={query.data?.meta.total ?? items.length}
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
					errorTitle={t("community.solves.errors.load")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						challengeId === "all" ? (
							<EmptyBlock
								title={t("community.solves.empty.title")}
								description={t("community.solves.empty.description")}
								icon={<Activity aria-hidden="true" />}
								action={
									<Button size="sm" asChild>
										<Link to="/challenges">{t("community.solves.empty.action")}</Link>
									</Button>
								}
							/>
						) : (
							<EmptyBlock
								variant="filtered"
								description={t("community.solves.filtered.description")}
								action={
									<Button
										size="sm"
										variant="outline"
										onClick={() => setChallengeId("all")}
									>
										{t("community.solves.filtered.clear")}
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
									<Link
										to={`/challenges/${row.challenge_id}`}
										className="text-sm font-medium hover:underline"
									>
										{row.challenge_name}
									</Link>
									<div className="flex items-center gap-2">
										<UserAvatar
											name={row.nickname}
											avatar={row.avatar ?? null}
											size="sm"
										/>
										<span className="truncate text-xs text-muted-foreground">
											{row.nickname}
										</span>
									</div>
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span className="tnum">
											+{formatScore(row.obtained_points)}
										</span>
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

/** 全站公告：后端支持 id / title / content 过滤，这里用标题过滤。 */
export function AnnouncementsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("community.announcements.documentTitle"));
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);

	const trimmed = debouncedSearch.trim();
	const filter = trimmed === "" ? undefined : `title:${trimmed}`;

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
			id: "title",
			header: t("community.announcements.columns.title"),
			sortValue: (row) => row.title,
			cell: (row) => <span className="text-sm font-medium">{row.title}</span>,
		},
		{
			id: "publisher",
			header: t("community.announcements.columns.publisher"),
			hideBelow: "sm",
			sortValue: (row) => row.publisher,
			cell: (row) => <span className="text-sm">{row.publisher || t("common.empty")}</span>,
		},
		{
			id: "content",
			header: t("community.announcements.columns.content"),
			hideBelow: "md",
			cell: (row) => (
				<div className="max-w-2xl text-sm break-words whitespace-pre-wrap text-muted-foreground">
					{row.content && row.content.trim() !== "" ? row.content : t("common.empty")}
				</div>
			),
		},
		{
			id: "created_at",
			header: t("community.announcements.columns.createdAt"),
			align: "right",
			sortValue: (row) => row.created_at,
			cell: (row) => <RelativeTime value={row.created_at} />,
		},
		{
			id: "updated_at",
			header: t("community.announcements.columns.updatedAt"),
			align: "right",
			hideBelow: "lg",
			sortValue: (row) => row.updated_at,
			cell: (row) => <RelativeTime value={row.updated_at} />,
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
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						<SearchField
							value={search}
							placeholder={t("community.announcements.search.placeholder")}
							onChange={(value) => {
								setSearch(value);
								setPage(1);
							}}
						/>
					</Toolbar>
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
						trimmed === "" ? (
							<EmptyBlock
								title={t("community.announcements.empty.title")}
								description={t("community.announcements.empty.description")}
								icon={<Megaphone aria-hidden="true" />}
							/>
						) : (
							<EmptyBlock
								variant="filtered"
								description={t("community.announcements.filtered.description", {
									query: trimmed,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => setSearch("")}>
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
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);

	const trimmed = debouncedSearch.trim();
	const filter = trimmed === "" ? undefined : `name:${trimmed}`;

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
			hideBelow: "sm",
			sortValue: (row) => row.category,
			cell: (row) => (
				<TonePill tone="neutral">
					{row.category || t("community.arsenal.uncategorized")}
				</TonePill>
			),
		},
		{
			id: "description",
			header: t("community.arsenal.columns.description"),
			hideBelow: "md",
			cell: (row) => (
				<p className="line-clamp-3 max-w-xl text-sm break-words text-muted-foreground">
					{row.description && row.description.trim() !== ""
						? row.description
						: t("common.empty")}
				</p>
			),
		},
		{
			id: "file",
			header: t("community.arsenal.columns.file"),
			cell: (row) => <WeaponFile row={row} />,
		},
		{
			id: "download_count",
			header: t("community.arsenal.columns.downloadCount"),
			align: "right",
			hideBelow: "lg",
			sortValue: (row) => row.download_count,
			cell: (row) => <span className="tnum text-sm">{formatInt(row.download_count)}</span>,
		},
		{
			id: "updated_at",
			header: t("community.arsenal.columns.updatedAt"),
			align: "right",
			sortValue: (row) => row.updated_at,
			cell: (row) => <RelativeTime value={row.updated_at} />,
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
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						<SearchField
							value={search}
							placeholder={t("community.arsenal.search.placeholder")}
							onChange={(value) => {
								setSearch(value);
								setPage(1);
							}}
						/>
					</Toolbar>
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
						trimmed === "" ? (
							<EmptyBlock
								title={t("community.arsenal.empty.title")}
								description={t("community.arsenal.empty.description")}
								icon={<Swords aria-hidden="true" />}
							/>
						) : (
							<EmptyBlock
								variant="filtered"
								description={t("community.arsenal.filtered.description", {
									query: trimmed,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => setSearch("")}>
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
