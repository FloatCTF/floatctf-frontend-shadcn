/**
 * 选手端赛事 —— 列表 + **赛事工作区**（一个赛事一个工作区，能力以标签面板呈现）。
 *
 * 参赛门禁与后端一致：非「未开始」且未加入时不展示题目 / 积分榜 / 实例等工作区内容。
 * 全部用户可见文案走 `events` 命名空间；状态判定仍由 `~/lib/event-status.ts` 提供。
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Search } from "lucide-react";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import {
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
} from "~/components/app/page";
import {
	EmptyBlock,
	LoadingBlock,
	NotFoundBlock,
	QueryState,
	TableSkeleton,
} from "~/components/app/states";
import { TonePill } from "~/components/app/badges";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { EventChallengeResult, EventInfo } from "@floatctf/sdk";
import { formatRange, formatScore } from "~/lib/format";
import {
	EVENT_STATUS_TONE,
	computeEventStatus,
	eventCapabilities,
	eventIdOf,
	participationGate,
} from "~/lib/event-status";
import { useDebouncedValue, useDocumentTitle, useNow } from "~/lib/hooks";

import {
	EventStatusPill,
	EventFactsCard,
	JoinLeaveControl,
	MemberGateNotice,
	TeamPanel,
	useEventLabels,
} from "./components";
import { ChallengeWorkbench } from "~/features/jeopardy/workbench";
import {
	ArenaSummaryTab,
	BulletinTab,
	ChallengesTab,
	InstancesTab,
	LabSummaryTab,
	OverviewTab,
	ScoreboardTab,
	TrendTab,
} from "./tabs";

/* ── 赛事列表 ───────────────────────────────────────────────────────────── */

export function EventsListPage() {
	const { t } = useTranslation();
	const labels = useEventLabels();
	useDocumentTitle(t("events.list.documentTitle"));
	const client = useClient();
	const now = useNow(30_000);
	const [search, setSearch] = useState("");
	const [family, setFamily] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [onlyJoined, setOnlyJoined] = useState(false);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const debouncedSearch = useDebouncedValue(search, 300);

	const query = useQuery({
		queryKey: qk.events.list({ limit: 200 }),
		queryFn: () => callList<EventInfo>(client.service.events.fetch({ limit: 200 })),
	});

	const items = query.data?.items ?? [];

	const filtered = useMemo(() => {
		const keyword = debouncedSearch.trim().toLowerCase();
		return items.filter((item) => {
			const status = computeEventStatus(
				item.event.start_time,
				item.event.end_time ?? null,
				now.getTime(),
			);
			if (family !== "all" && item.event.family !== family) return false;
			if (statusFilter !== "all" && status !== statusFilter) return false;
			if (onlyJoined && !item.joined) return false;
			if (keyword === "") return true;
			return (
				item.event.title.toLowerCase().includes(keyword) ||
				(item.event.description ?? "").toLowerCase().includes(keyword)
			);
		});
	}, [items, family, statusFilter, onlyJoined, debouncedSearch, now]);

	const sorted = useMemo(
		() =>
			[...filtered].sort(
				(a, b) => new Date(b.event.start_time).getTime() - new Date(a.event.start_time).getTime(),
			),
		[filtered],
	);
	const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

	const columns: DataTableColumn<EventInfo>[] = [
		{
			id: "title",
			header: t("events.list.columns.event"),
			sortValue: (row) => row.event.title,
			cell: (row) => (
				<div className="min-w-0">
					<Link to={`/events/${eventIdOf(row)}`} className="truncate text-sm font-medium hover:underline">
						{row.event.title}
					</Link>
					<p className="truncate text-xs text-muted-foreground">
						{labels.purpose(row.event.purpose)} · {labels.mode(row.event.participant_mode)}
					</p>
				</div>
			),
		},
		{
			id: "family",
			header: t("events.list.columns.family"),
			sortValue: (row) => row.event.family,
			cell: (row) => <TonePill tone="neutral">{labels.family(row.event.family)}</TonePill>,
		},
		{
			id: "status",
			header: t("events.list.columns.status"),
			sortValue: (row) =>
				computeEventStatus(row.event.start_time, row.event.end_time ?? null, now.getTime()),
			cell: (row) => <EventStatusPill event={row.event} />,
		},
		{
			id: "window",
			header: t("events.list.columns.window"),
			hideBelow: "lg",
			cell: (row) => (
				<span className="text-xs text-muted-foreground">
					{formatRange(row.event.start_time, row.event.end_time ?? null)}
				</span>
			),
		},
		{
			id: "joined",
			header: t("events.list.columns.joined"),
			cell: (row) => {
				if (row.joined) return <TonePill tone="success">{t("events.list.joined")}</TonePill>;
				const gate = participationGate(row.event, now.getTime());
				// 练习赛 / 系统赛事没有「报名」概念，显示「—」比「未加入」诚实。
				return gate.kind === "not-competition" || gate.kind === "system-managed" ? (
					<span className="text-xs text-muted-foreground">—</span>
				) : (
					<TonePill tone="muted">{t("events.list.notJoined")}</TonePill>
				);
			},
		},
		{
			id: "action",
			header: "",
			align: "right",
			cell: (row) => {
				const gate = participationGate(row.event, now.getTime());
				// 练习赛不进赛事工作区（后端拒绝报名/取题），直接去对应练习入口。
				if (!row.joined && gate.kind === "not-competition") {
					const to = row.event.family === "awdp" ? "/training" : "/challenges";
					return (
						<Button variant="ghost" size="sm" asChild>
							<Link to={to}>
								{t("events.list.practiceEntry")} <ChevronRight aria-hidden="true" />
							</Link>
						</Button>
					);
				}
				return (
					<Button variant="ghost" size="sm" asChild>
						<Link to={`/events/${eventIdOf(row)}`}>
							{t("events.list.open")} <ChevronRight aria-hidden="true" />
						</Link>
					</Button>
				);
			},
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("events.list.title")}
				description={t("events.list.description")}
			/>

			<SectionCard
				title={t("events.list.cardTitle")}
				description={
					query.isSuccess ? (
						<span className="tnum">
							{filtered.length === items.length
								? t("events.list.countAll", { total: items.length })
								: t("events.list.count", { total: items.length, filtered: filtered.length })}
						</span>
					) : undefined
				}
				contentClassName="px-0"
				footer={
					filtered.length > pageSize ? (
						<PaginationBar
							page={page}
							pageSize={pageSize}
							total={filtered.length}
							onPageChange={setPage}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
						/>
					) : null
				}
			>
				<div className="flex flex-wrap items-center gap-2 px-4 pb-4">
					<div className="relative w-full sm:max-w-xs">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setPage(1);
							}}
							placeholder={t("events.list.searchPlaceholder")}
							aria-label={t("events.list.searchPlaceholder")}
							className="w-full pl-8"
						/>
					</div>
					<Select
						value={family}
						onValueChange={(value) => {
							setFamily(value);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-full sm:w-40" aria-label={t("events.list.familyFilter")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("events.family.all")}</SelectItem>
							<SelectItem value="jeopardy">{t("events.family.jeopardy")}</SelectItem>
							<SelectItem value="awd">{t("events.family.awd")}</SelectItem>
							<SelectItem value="awdp">{t("events.family.awdp")}</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={statusFilter}
						onValueChange={(value) => {
							setStatusFilter(value);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-full sm:w-32" aria-label={t("events.list.statusFilter")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("events.status.all")}</SelectItem>
							<SelectItem value="upcoming">{t("events.status.upcoming")}</SelectItem>
							<SelectItem value="ongoing">{t("events.status.ongoing")}</SelectItem>
							<SelectItem value="ended">{t("events.status.ended")}</SelectItem>
						</SelectContent>
					</Select>
					<Button
						variant={onlyJoined ? "default" : "outline"}
						size="sm"
						onClick={() => {
							setOnlyJoined((value) => !value);
							setPage(1);
						}}
					>
						{t("events.list.onlyJoined")}
					</Button>
				</div>

				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={5} />}
					errorTitle={t("events.list.loadError")}
					isEmpty={() => items.length === 0}
					empty={
						<EmptyBlock
							title={t("events.list.emptyTitle")}
							description={t("events.list.emptyDescription")}
							icon={<CalendarDays className="size-5" aria-hidden="true" />}
						/>
					}
				>
					{() =>
						filtered.length === 0 ? (
							<EmptyBlock variant="filtered" />
						) : (
							<DataTable
								data={paged}
								getRowId={(row) => eventIdOf(row)}
								columns={columns}
								mobileCard={(row) => (
									<Link to={`/events/${eventIdOf(row)}`} className="block space-y-1">
										<div className="flex items-center justify-between gap-2">
											<span className="truncate text-sm font-medium">{row.event.title}</span>
											<EventStatusPill event={row.event} />
										</div>
										<p className="text-xs text-muted-foreground">
											{labels.family(row.event.family)} ·{" "}
											{row.joined ? t("events.list.joined") : t("events.list.notJoined")}
										</p>
									</Link>
								)}
							/>
						)
					}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}

/* ── 赛事工作区 ─────────────────────────────────────────────────────────── */

export function EventWorkspacePage() {
	const { t } = useTranslation();
	const labels = useEventLabels();
	const { eventId = "" } = useParams<{ eventId: string }>();
	const client = useClient();
	const now = useNow(30_000);
	const [params, setParams] = useSearchParams();
	const tab = params.get("tab") ?? "overview";

	const query = useQuery({
		queryKey: qk.events.detail(eventId),
		queryFn: () => call<EventInfo>(client.service.events.get(eventId), t("events.workspace.loadError")),
		enabled: eventId !== "",
	});

	const info = query.data;
	useDocumentTitle(
		info
			? t("events.workspace.documentTitle", { title: info.event.title })
			: t("events.list.documentTitle"),
	);

	return (
		<PageBody>
			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("events.workspace.loading")} />}
				errorTitle={t("events.workspace.loadError")}
			>
				{(data) => {
					const status = computeEventStatus(
						data.event.start_time,
						data.event.end_time ?? null,
						now.getTime(),
					);
					const caps = eventCapabilities(data.event);
					const resolvedEventId = eventIdOf(data);
					const gated = status !== "upcoming" && !data.joined;
					const isTeam = data.event.participant_mode === "team";

					return (
						<>
							<PageHeader
								title={data.event.title}
								description={formatRange(data.event.start_time, data.event.end_time ?? null)}
								badge={
									<div className="flex flex-wrap items-center gap-2">
										<EventStatusPill event={data.event} />
										<TonePill tone="neutral">{labels.family(data.event.family)}</TonePill>
										<TonePill tone="neutral">{labels.mode(data.event.participant_mode)}</TonePill>
										{data.joined ? (
											<TonePill tone="success">{t("events.workspace.joinedBadge")}</TonePill>
										) : null}
									</div>
								}
								actions={
									// 进入驾驶舱 / 工作台的入口在对应标签页里（AWD 概览 / AWDP 概览），
									// 这里不再重复放一个同义按钮。
									<Button variant="outline" asChild>
										<Link to="/events">{t("events.workspace.backToList")}</Link>
									</Button>
								}
							/>

							<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
								<div className="min-w-0 space-y-4">
									{gated ? (
										<MemberGateNotice event={data.event} />
									) : (
										<Tabs
											value={tab}
											onValueChange={(value) => {
												params.set("tab", value);
												setParams(params, { replace: true });
											}}
										>
											<TabsList className="no-scrollbar flex w-full justify-start overflow-x-auto">
												<TabsTrigger value="overview" className="shrink-0">
													{t("events.workspace.tabs.overview")}
												</TabsTrigger>
												{caps.challenges ? (
													<TabsTrigger value="challenges" className="shrink-0">
														{t("events.workspace.tabs.challenges")}
													</TabsTrigger>
												) : null}
												{caps.arena ? (
													<TabsTrigger value="arena" className="shrink-0">
														{t("events.workspace.tabs.arena")}
													</TabsTrigger>
												) : null}
												{caps.lab ? (
													<TabsTrigger value="lab" className="shrink-0">
														{t("events.workspace.tabs.lab")}
													</TabsTrigger>
												) : null}
												{caps.scoreboard ? (
													<TabsTrigger value="scoreboard" className="shrink-0">
														{t("events.workspace.tabs.scoreboard")}
													</TabsTrigger>
												) : null}
												{caps.trend ? (
													<TabsTrigger value="trend" className="shrink-0">
														{t("events.workspace.tabs.trend")}
													</TabsTrigger>
												) : null}
												{caps.instances ? (
													<TabsTrigger value="instances" className="shrink-0">
														{t("events.workspace.tabs.instances")}
													</TabsTrigger>
												) : null}
												<TabsTrigger value="bulletin" className="shrink-0">
													{t("events.workspace.tabs.bulletin")}
												</TabsTrigger>
											</TabsList>

											<TabsContent value="overview" className="mt-4">
												<OverviewTab info={data} />
											</TabsContent>
											{caps.challenges ? (
												<TabsContent value="challenges" className="mt-4">
													<ChallengesTab eventId={resolvedEventId} participantMode={data.event.participant_mode} />
												</TabsContent>
											) : null}
											{caps.arena ? (
												<TabsContent value="arena" className="mt-4">
													<ArenaSummaryTab eventId={resolvedEventId} />
												</TabsContent>
											) : null}
											{caps.lab ? (
												<TabsContent value="lab" className="mt-4">
													<LabSummaryTab eventId={resolvedEventId} />
												</TabsContent>
											) : null}
											{caps.scoreboard ? (
												<TabsContent value="scoreboard" className="mt-4">
													<ScoreboardTab info={data} />
												</TabsContent>
											) : null}
											{caps.trend ? (
												<TabsContent value="trend" className="mt-4">
													<TrendTab eventId={resolvedEventId} />
												</TabsContent>
											) : null}
											{caps.instances ? (
												<TabsContent value="instances" className="mt-4">
													<InstancesTab eventId={resolvedEventId} />
												</TabsContent>
											) : null}
											<TabsContent value="bulletin" className="mt-4">
												<BulletinTab eventId={resolvedEventId} />
											</TabsContent>
										</Tabs>
									)}
								</div>

								<div className="flex flex-col gap-4">
									{/* 右侧栏：赛事事实 → 参赛状态。标签页已经承担跳转，不再重复放「快速跳转」卡片。 */}
									<EventFactsCard event={data.event} />
									{/* 只有正式赛才有「参赛」语义；练习赛 / 系统托管赛事在门禁提示里已经解释过。 */}
									{participationGate(data.event, now.getTime()).kind === "not-competition" ||
									participationGate(data.event, now.getTime()).kind === "system-managed" ? null : (
										<SectionCard
											title={
												isTeam
													? t("events.workspace.teamCardTitle")
													: t("events.workspace.participationCardTitle")
											}
											description={
												isTeam
													? data.joined
														? t("events.workspace.teamCardDescriptionJoined")
														: t("events.workspace.teamCardDescription")
													: participationGate(data.event, now.getTime()).kind === "open"
														? t("events.workspace.participationOpen")
														: participationGate(data.event, now.getTime()).kind === "closed"
															? t("events.participation.notOpenHint")
															: status === "ended"
																? t("events.workspace.participationEnded")
																: t("events.workspace.participationLocked")
											}
										>
											{isTeam ? <TeamPanel info={data} /> : <JoinLeaveControl info={data} />}
										</SectionCard>
									)}
								</div>
							</div>
						</>
					);
				}}
			</QueryState>
		</PageBody>
	);
}

/* ── 赛事内题目工作台 ───────────────────────────────────────────────────── */

export function EventChallengePage() {
	const { t } = useTranslation();
	const { eventId = "", challengeId = "" } = useParams<{ eventId: string; challengeId: string }>();
	const client = useClient();

	const eventQuery = useQuery({
		queryKey: qk.events.detail(eventId),
		queryFn: () => call<EventInfo>(client.service.events.get(eventId), t("events.challengePage.loadError")),
		enabled: eventId !== "",
	});

	const challengesQuery = useQuery({
		queryKey: qk.events.challenges(eventId, { limit: 200 }),
		queryFn: () =>
			callList<EventChallengeResult>(
				client.service.events.fetchChallenges(eventId, { limit: 200 }),
			),
		enabled: eventId !== "",
	});

	const item = (challengesQuery.data?.items ?? []).find(
		(entry) => entry.challenge.id === challengeId,
	);
	useDocumentTitle(
		item
			? t("events.challengePage.documentTitle", { title: item.challenge.name })
			: t("events.challengePage.fallbackDocumentTitle"),
	);

	return (
		<PageBody>
			<QueryState
				query={challengesQuery}
				skeleton={<LoadingBlock label={t("events.challengePage.loading")} />}
				errorTitle={t("events.challengePage.loadError")}
			>
				{() =>
					item ? (
						<>
							<PageHeader
								title={item.challenge.name}
								description={
									<span className="flex flex-wrap items-center gap-2">
										<TonePill tone="info" className="tnum">
											{t("events.challengePage.currentPoints", {
												points: formatScore(item.current_points),
											})}
										</TonePill>
										<TonePill tone="neutral" className="tnum">
											{t(
												eventQuery.data?.event.participant_mode === "team"
													? "events.challengePage.solvedTeams"
													: "events.challengePage.solvedSolvers",
												{ count: item.solved_count },
											)}
										</TonePill>
										{item.solved ? (
											<TonePill tone="success">
												{t("events.challengePage.solved", { no: item.solved_no })}
											</TonePill>
										) : null}
									</span>
								}
								breadcrumbs={
									<span className="flex flex-wrap items-center gap-1">
										<Link to="/events" className="hover:underline">
											{t("events.list.title")}
										</Link>
										<ChevronRight className="size-3" aria-hidden="true" />
										<Link to={`/events/${eventId}`} className="hover:underline">
											{eventQuery.data?.event.title ?? eventId}
										</Link>
										<ChevronRight className="size-3" aria-hidden="true" />
										<span>{item.challenge.category || t("events.challengePage.uncategorized")}</span>
									</span>
								}
								actions={
									<Button variant="outline" asChild>
										<Link to={`/events/${eventId}?tab=challenges`}>
											{t("events.challengePage.backToList")}
										</Link>
									</Button>
								}
							/>
							<ChallengeWorkbench
								challenge={item.challenge}
								mode={{ kind: "event", eventId }}
							/>
						</>
					) : (
						<NotFoundBlock
							title={t("events.challengePage.notFoundTitle")}
							description={t("events.challengePage.notFoundDescription")}
							action={
								<Button asChild>
									<Link to={`/events/${eventId}?tab=challenges`}>
										{t("events.challengePage.backToList")}
									</Link>
								</Button>
							}
						/>
					)
				}
			</QueryState>
		</PageBody>
	);
}

export { EVENT_STATUS_TONE };
