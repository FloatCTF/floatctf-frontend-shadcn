/**
 * 选手总览（Field 首页）—— 用**真实接口**回答四个问题：
 * 我在哪些赛事里？平台在发生什么？我的下一步是什么？公告有哪些？
 *
 * 版式遵循 docs/theme.md §6.4.B（仪表盘）：标题 + 更新时间 + 刷新、KPI 网格、
 * 两列数据区块。所有列表都是 DataTable，文案全部走 dashboard 命名空间的 i18n。
 */

import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Megaphone, Puzzle, RefreshCw, Trophy } from "lucide-react";

import type { EventInfo, SolveResult, TopUser } from "@floatctf/sdk";
import type { Announcements } from "@floatctf/sdk/entity";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { useAuthStore, useMe } from "~/auth/store";
import { TonePill } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { PageBody, PageHeader, SectionCard, StatCard, Toolbar } from "~/components/app/page";
import {
	EmptyBlock,
	QueryState,
	TableSkeleton,
} from "~/components/app/states";
import { UserAvatar } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { formatDateTime, formatInt, formatRelative, formatScore } from "~/lib/format";
import {
	EVENT_STATUS_TONE,
	eventIdOf,
	eventStatusOf,
	participationGate,
	type EventStatus,
} from "~/lib/event-status";
import { useDocumentTitle, useNow } from "~/lib/hooks";

const EVENT_STATUS_KEY: Record<EventStatus, string> = {
	upcoming: "dashboard.status.upcoming",
	ongoing: "dashboard.status.ongoing",
	ended: "dashboard.status.ended",
	unknown: "dashboard.status.unknown",
};

const EVENT_FAMILY_KEY: Record<string, string> = {
	jeopardy: "dashboard.family.jeopardy",
	awd: "dashboard.family.awd",
	awdp: "dashboard.family.awdp",
};

export function DashboardPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("dashboard.page.documentTitle"));
	const client = useClient();
	const me = useMe();
	const userToken = useAuthStore((state) => state.userToken);
	const navigate = useNavigate();
	const now = useNow(30_000);

	const events = useQuery({
		queryKey: qk.events.list({ limit: 50 }),
		queryFn: () => callList(client.service.events.fetch({ limit: 50 })),
		enabled: userToken !== null,
	});

	const announcements = useQuery({
		queryKey: qk.announcements.list({ limit: 5 }),
		queryFn: () => callList(client.service.announcements.fetch({ limit: 5 })),
		refetchInterval: 60_000,
		refetchIntervalInBackground: false,
	});

	const solves = useQuery({
		queryKey: qk.solves.list({ limit: 8 }),
		queryFn: () => callList(client.service.solves.fetch({ limit: 8 })),
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});

	const top = useQuery({
		queryKey: qk.solves.top15(),
		queryFn: () => call(client.service.solves.getTop15Users(), "Top15"),
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});

	const myEvents = (events.data?.items ?? []).filter((item) => item.joined);
	// 「可加入」必须与后端 join 判定一致：练习赛 / 系统赛事 / 未开放 / 已开赛都不算。
	const openEvents = (events.data?.items ?? []).filter(
		(item) => !item.joined && participationGate(item.event, now.getTime()).kind === "open",
	);
	const ongoingCount = myEvents.filter(
		(item) => eventStatusOf(item.event, now.getTime()) === "ongoing",
	).length;
	const solveTotal = solves.data?.meta?.total ?? solves.data?.items.length ?? 0;
	const announcementTotal =
		announcements.data?.meta?.total ?? announcements.data?.items.length ?? 0;

	const refreshing =
		events.isFetching || announcements.isFetching || solves.isFetching || top.isFetching;
	const updatedAt = Math.max(
		events.dataUpdatedAt,
		announcements.dataUpdatedAt,
		solves.dataUpdatedAt,
		top.dataUpdatedAt,
	);
	const updatedLabel = updatedAt > 0 ? formatRelative(new Date(updatedAt), now) : "—";
	const displayName = me?.nickname || me?.username;

	const metricValue = (pending: boolean, error: boolean, value: number): string =>
		pending ? "…" : error ? "—" : formatInt(value);
	const statusLabel = (status: EventStatus): string => t(EVENT_STATUS_KEY[status]);
	const familyLabel = (family: string): string => {
		const key = EVENT_FAMILY_KEY[family];
		return key ? t(key) : family;
	};

	const refreshAll = (): void => {
		void Promise.all([
			events.refetch(),
			announcements.refetch(),
			solves.refetch(),
			top.refetch(),
		]);
	};

	const eventColumns: DataTableColumn<EventInfo>[] = [
		{
			id: "event",
			header: t("dashboard.myEvents.columns.event"),
			sortValue: (row) => row.event.title,
			cell: (row) => (
				<Link
					to={`/events/${eventIdOf(row)}`}
					onClick={(event) => event.stopPropagation()}
					title={row.event.title}
					className="block max-w-72 truncate font-medium hover:underline"
				>
					{row.event.title}
				</Link>
			),
		},
		{
			id: "family",
			header: t("dashboard.myEvents.columns.family"),
			cell: (row) => <span className="text-muted-foreground">{familyLabel(row.event.family)}</span>,
			sortValue: (row) => row.event.family,
		},
		{
			id: "start",
			header: t("dashboard.myEvents.columns.start"),
			// 卡片只有半屏宽：1280 下四列会挤到出现横向滚动条，2xl 以上再显示开始时间。
			hideBelow: "2xl",
			cell: (row) => (
				<span
					className="tnum text-xs whitespace-nowrap text-muted-foreground"
					title={formatDateTime(row.event.start_time, { seconds: true })}
				>
					{formatDateTime(row.event.start_time)}
				</span>
			),
			sortValue: (row) => row.event.start_time,
		},
		{
			id: "status",
			header: t("dashboard.myEvents.columns.status"),
			align: "right",
			cell: (row) => {
				const status = eventStatusOf(row.event, now.getTime());
				return <TonePill tone={EVENT_STATUS_TONE[status]}>{statusLabel(status)}</TonePill>;
			},
			sortValue: (row) => eventStatusOf(row.event, now.getTime()),
		},
	];

	const announcementColumns: DataTableColumn<Announcements>[] = [
		{
			id: "announcement",
			header: t("dashboard.announcements.columns.announcement"),
			sortValue: (row) => row.title,
			cell: (row) => (
				<div className="min-w-0 max-w-96">
					<p className="truncate font-medium" title={row.title}>{row.title}</p>
					{row.content ? (
						<p className="line-clamp-2 text-xs whitespace-normal text-muted-foreground">
							{row.content}
						</p>
					) : null}
				</div>
			),
		},
		{
			id: "publisher",
			header: t("dashboard.announcements.columns.publisher"),
			hideBelow: "sm",
			cell: (row) => (
				<span className="text-sm text-muted-foreground">{row.publisher || "—"}</span>
			),
			sortValue: (row) => row.publisher,
		},
		{
			id: "publishedAt",
			header: t("dashboard.announcements.columns.publishedAt"),
			align: "right",
			cell: (row) => (
				<span
					className="tnum text-xs whitespace-nowrap text-muted-foreground"
					title={formatDateTime(row.created_at, { seconds: true })}
				>
					{formatRelative(row.created_at, now)}
				</span>
			),
			sortValue: (row) => row.created_at,
		},
	];

	const solveColumns: DataTableColumn<SolveResult>[] = [
		{
			id: "user",
			header: t("dashboard.solves.columns.user"),
			sortValue: (row) => row.nickname,
			cell: (row) => (
				<div className="flex min-w-0 items-center gap-2">
					<UserAvatar name={row.nickname} avatar={row.avatar} size="sm" />
					<span className="max-w-40 truncate text-sm" title={row.nickname}>{row.nickname}</span>
				</div>
			),
		},
		{
			id: "challenge",
			header: t("dashboard.solves.columns.challenge"),
			sortValue: (row) => row.challenge_name,
			cell: (row) => (
				<span className="block max-w-64 truncate text-sm" title={row.challenge_name}>{row.challenge_name}</span>
			),
		},
		{
			id: "points",
			header: t("dashboard.solves.columns.points"),
			align: "right",
			cell: (row) => (
				<span className="tnum font-mono text-xs">
					{t("dashboard.solves.points", { score: formatScore(row.obtained_points) })}
				</span>
			),
			sortValue: (row) => row.obtained_points,
		},
		{
			id: "time",
			header: t("dashboard.solves.columns.time"),
			align: "right",
			hideBelow: "sm",
			cell: (row) => (
				<span
					className="tnum text-xs whitespace-nowrap text-muted-foreground"
					title={formatDateTime(row.created_at, { seconds: true })}
				>
					{formatRelative(row.created_at, now)}
				</span>
			),
			sortValue: (row) => row.created_at,
		},
	];

	const topColumns: DataTableColumn<TopUser>[] = [
		{
			id: "rank",
			header: t("dashboard.top.columns.rank"),
			align: "center",
			cell: (row) => (
				<span className="tnum font-mono text-xs text-muted-foreground">#{row.no}</span>
			),
			sortValue: (row) => row.no,
		},
		{
			id: "user",
			header: t("dashboard.top.columns.user"),
			sortValue: (row) => row.nickname,
			cell: (row) => (
				<div className="flex min-w-0 items-center gap-2">
					<UserAvatar name={row.nickname} avatar={row.avatar} size="sm" />
					<span className="max-w-40 truncate text-sm" title={row.nickname}>{row.nickname}</span>
				</div>
			),
		},
		{
			id: "solved",
			header: t("dashboard.top.columns.solved"),
			align: "right",
			cell: (row) => (
				<span className="tnum font-mono text-xs">
					{t("dashboard.top.solvedCount", { count: formatInt(row.solved_count) })}
				</span>
			),
			sortValue: (row) => row.solved_count,
		},
	];

	return (
		<PageBody className="max-w-[1180px] space-y-4">
			<PageHeader
				title={
					displayName
						? t("dashboard.page.greeting", { name: displayName })
						: t("dashboard.page.title")
				}
				description={t("dashboard.page.description")}
				actions={
					<Toolbar>
						<span className="tnum text-xs text-muted-foreground" aria-live="polite">
							{t("dashboard.page.updatedAt", { time: updatedLabel })}
						</span>
						<Button
							variant="outline"
							size="icon"
							onClick={refreshAll}
							disabled={refreshing}
							aria-label={t("dashboard.page.refresh")}
							title={t("dashboard.page.refresh")}
						>
							<RefreshCw className={refreshing ? "animate-spin" : undefined} />
						</Button>
						<Button asChild>
							<Link to="/challenges">
								<Puzzle />
								{t("dashboard.page.goSolve")}
							</Link>
						</Button>
					</Toolbar>
				}
			/>

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard
					label={t("dashboard.stats.myEvents.label")}
					value={metricValue(events.isPending, events.isError, myEvents.length)}
					hint={
						events.isError
							? t("dashboard.stats.unavailable")
							: openEvents.length > 0
								? t("dashboard.stats.myEvents.hintMore", { count: formatInt(openEvents.length) })
								: t("dashboard.stats.myEvents.hintNone")
					}
					icon={<CalendarDays className="size-4" />}
				/>
				<StatCard
					label={t("dashboard.stats.ongoing.label")}
					value={metricValue(events.isPending, events.isError, ongoingCount)}
					hint={
						events.isError
							? t("dashboard.stats.unavailable")
							: t("dashboard.stats.ongoing.hint")
					}
					icon={<Trophy className="size-4" />}
					tone={events.isError ? "default" : "success"}
				/>
				<StatCard
					label={t("dashboard.stats.solves.label")}
					value={metricValue(solves.isPending, solves.isError, solveTotal)}
					hint={
						solves.isError
							? t("dashboard.stats.unavailable")
							: t("dashboard.stats.solves.hint")
					}
					icon={<Puzzle className="size-4" />}
				/>
				<StatCard
					label={t("dashboard.stats.announcements.label")}
					value={metricValue(announcements.isPending, announcements.isError, announcementTotal)}
					hint={
						announcements.isError
							? t("dashboard.stats.unavailable")
							: t("dashboard.stats.announcements.hint")
					}
					icon={<Megaphone className="size-4" />}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<SectionCard
					title={<h2>{t("dashboard.myEvents.title")}</h2>}
					description={t("dashboard.myEvents.description")}
					actions={
						<Button variant="ghost" size="sm" asChild>
							<Link to="/events">
								{t("dashboard.myEvents.viewAll")}
								<ArrowRight />
							</Link>
						</Button>
					}
					contentClassName="px-0"
				>
					<QueryState
						query={events}
						skeleton={<TableSkeleton rows={4} columns={4} />}
						errorTitle={t("dashboard.myEvents.errorTitle")}
						isEmpty={() => myEvents.length === 0}
						empty={
							<EmptyBlock
								title={t("dashboard.myEvents.emptyTitle")}
								description={t("dashboard.myEvents.emptyDescription")}
								icon={<CalendarDays className="size-6" />}
								action={
									<Button size="sm" asChild>
										<Link to="/events">{t("dashboard.myEvents.emptyAction")}</Link>
									</Button>
								}
							/>
						}
					>
						{() => (
							<DataTable
								data={myEvents}
								getRowId={(row) => eventIdOf(row)}
								columns={eventColumns}
								onRowClick={(row) => void navigate(`/events/${eventIdOf(row)}`)}
								mobileCard={(row) => {
									const status = eventStatusOf(row.event, now.getTime());
									return (
										<Link
											to={`/events/${eventIdOf(row)}`}
											className="block space-y-1.5"
										>
											<div className="flex items-center justify-between gap-2">
												<span
													className="min-w-0 truncate text-sm font-medium"
													title={row.event.title}
												>
													{row.event.title}
												</span>
												<TonePill tone={EVENT_STATUS_TONE[status]}>
													{statusLabel(status)}
												</TonePill>
											</div>
											<p className="text-xs text-muted-foreground">
												{familyLabel(row.event.family)} ·{" "}
												<span className="tnum">
													{formatDateTime(row.event.start_time)}
												</span>
											</p>
										</Link>
									);
								}}
							/>
						)}
					</QueryState>
				</SectionCard>

				<SectionCard
					title={<h2>{t("dashboard.announcements.title")}</h2>}
					description={t("dashboard.announcements.description")}
					actions={
						<Button variant="ghost" size="sm" asChild>
							<Link to="/community/announcements">
								{t("dashboard.announcements.viewAll")}
								<ArrowRight />
							</Link>
						</Button>
					}
					contentClassName="px-0"
				>
					<QueryState
						query={announcements}
						skeleton={<TableSkeleton rows={4} columns={3} />}
						errorTitle={t("dashboard.announcements.errorTitle")}
						isEmpty={(result) => result.items.length === 0}
						empty={
							<EmptyBlock
								title={t("dashboard.announcements.emptyTitle")}
								description={t("dashboard.announcements.emptyDescription")}
								icon={<Megaphone className="size-6" />}
								action={
									<Button size="sm" variant="outline" asChild>
										<Link to="/community/announcements">
											{t("dashboard.announcements.emptyAction")}
										</Link>
									</Button>
								}
							/>
						}
					>
						{(result) => (
							<DataTable
								data={result.items}
								getRowId={(row) => row.id}
								columns={announcementColumns}
								mobileCard={(row) => (
									<div className="space-y-1.5">
										<p className="text-sm font-medium">{row.title}</p>
										{row.content ? (
											<p className="line-clamp-2 text-xs text-muted-foreground">
												{row.content}
											</p>
										) : null}
										<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
											<span className="truncate">{row.publisher || "—"}</span>
											<span className="tnum shrink-0">
												{formatRelative(row.created_at, now)}
											</span>
										</div>
									</div>
								)}
							/>
						)}
					</QueryState>
				</SectionCard>

				<SectionCard
					title={<h2>{t("dashboard.solves.title")}</h2>}
					description={t("dashboard.solves.description")}
					actions={
						<Button variant="ghost" size="sm" asChild>
							<Link to="/solves">
								{t("dashboard.solves.viewAll")}
								<ArrowRight />
							</Link>
						</Button>
					}
					contentClassName="px-0"
				>
					<QueryState
						query={solves}
						skeleton={<TableSkeleton rows={4} columns={4} />}
						errorTitle={t("dashboard.solves.errorTitle")}
						isEmpty={(result) => result.items.length === 0}
						empty={
							<EmptyBlock
								title={t("dashboard.solves.emptyTitle")}
								description={t("dashboard.solves.emptyDescription")}
								icon={<Puzzle className="size-6" />}
								action={
									<Button size="sm" asChild>
										<Link to="/challenges">{t("dashboard.solves.emptyAction")}</Link>
									</Button>
								}
							/>
						}
					>
						{(result) => (
							<DataTable
								data={result.items}
								getRowId={(row) => row.id}
								columns={solveColumns}
								mobileCard={(row) => (
									<div className="flex items-center gap-3">
										<UserAvatar
											name={row.nickname}
											avatar={row.avatar}
											size="sm"
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">
												{row.nickname}
											</p>
											<p className="text-xs text-muted-foreground">
												<span className="block truncate">{row.challenge_name}</span>
												<span className="tnum">
													{formatRelative(row.created_at, now)}
												</span>
											</p>
										</div>
										<span className="tnum shrink-0 font-mono text-xs">
											{t("dashboard.solves.points", {
												score: formatScore(row.obtained_points),
											})}
										</span>
									</div>
								)}
							/>
						)}
					</QueryState>
				</SectionCard>

				<SectionCard
					title={<h2>{t("dashboard.top.title")}</h2>}
					description={t("dashboard.top.description")}
					actions={
						<Button variant="ghost" size="sm" asChild>
							<Link to="/rank">
								{t("dashboard.top.viewAll")}
								<ArrowRight />
							</Link>
						</Button>
					}
					contentClassName="px-0"
				>
					<QueryState
						query={top}
						skeleton={<TableSkeleton rows={4} columns={3} />}
						errorTitle={t("dashboard.top.errorTitle")}
						isEmpty={(rows) => rows.length === 0}
						empty={
							<EmptyBlock
								title={t("dashboard.top.emptyTitle")}
								description={t("dashboard.top.emptyDescription")}
								icon={<Trophy className="size-6" />}
								action={
									<Button size="sm" variant="outline" asChild>
										<Link to="/rank">{t("dashboard.top.emptyAction")}</Link>
									</Button>
								}
							/>
						}
					>
						{(rows) => (
							<DataTable
								data={rows.slice(0, 8)}
								getRowId={(row) => String(row.no)}
								columns={topColumns}
								mobileCard={(row) => (
									<div className="flex items-center gap-3">
										<span className="tnum w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">
											{row.no}
										</span>
										<UserAvatar
											name={row.nickname}
											avatar={row.avatar}
											size="sm"
										/>
										<span className="min-w-0 flex-1 truncate text-sm" title={row.nickname}>
											{row.nickname}
										</span>
										<span className="tnum shrink-0 font-mono text-xs">
											{t("dashboard.top.solvedCount", {
												count: formatInt(row.solved_count),
											})}
										</span>
									</div>
								)}
							/>
						)}
					</QueryState>
				</SectionCard>
			</div>
		</PageBody>
	);
}
