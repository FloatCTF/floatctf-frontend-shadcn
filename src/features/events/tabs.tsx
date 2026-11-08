/**
 * 赛事工作区的标签内容。每个标签只做「真实接口 → 展示 / 操作」，
 * 状态文案统一走 `~/lib/event-status.ts` 与后端返回字段，不前端自造。
 *
 * 全部用户可见文案走 `events` 命名空间；后端枚举值只做「已知值 → 文案」映射，
 * 未知值原样展示（技术标识保持原文）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, ExternalLink, Swords, Trash2, Trophy } from "lucide-react";
import { EventPurpose } from "@floatctf/sdk/entity";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TrendChart } from "~/components/app/charts";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MarkdownView } from "~/components/app/markdown";
import {
	KeyValueList,
	MonoText,
	PaginationBar,
	SectionCard,
	StatCard,
} from "~/components/app/page";
import { EmptyBlock, LoadingBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { TonePill, type PillTone } from "~/components/app/badges";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import type {
	AwdpOverview,
	AwdPlayerStatus,
	EventChallengeResult,
	EventInfo,
	EventInstanceResult,
	ScoreboardItem,
	TrendItem,
} from "@floatctf/sdk";
import type { EventAnnouncements } from "@floatctf/sdk/entity";
import { formatDateTime, formatPoints, formatRelative, formatScore } from "~/lib/format";
import { getLocale } from "~/lib/i18n";
import { useNow } from "~/lib/hooks";

import { EventWriteupPanel } from "./components";
import {
	AwdFlagPanel,
	AwdGameboxPanel,
	AwdScoreboardPanel,
	AwdSshPanel,
	AwdWireGuardPanel,
} from "~/features/awd/components";
import {
	AwdpGameboxList,
	AwdpRoundsEvaluationsPanel,
	AwdpScoreboardPanel,
	AwdpTrendPanel,
} from "~/features/awdp/components";

const AWD_STATUS_KEYS: Record<string, string> = {
	draft: "events.awd.status.draft",
	configuring: "events.awd.status.configuring",
	deploying: "events.awd.status.deploying",
	deployed: "events.awd.status.deployed",
	prechecking: "events.awd.status.prechecking",
	verified: "events.awd.status.verified",
	running: "events.awd.status.running",
	paused: "events.awd.status.paused",
	network_error: "events.awd.status.network_error",
	start_blocked: "events.awd.status.start_blocked",
	finished: "events.awd.status.finished",
	archived: "events.awd.status.archived",
	deploy_failed: "events.awd.status.deploy_failed",
	verification_failed: "events.awd.status.verification_failed",
};

const AWD_PHASE_KEYS: Record<string, string> = {
	hardening: "events.awd.phaseLabel.hardening",
	attack: "events.awd.phaseLabel.attack",
	pause: "events.awd.phaseLabel.pause",
};

const AWDP_PHASE_KEYS: Record<string, string> = {
	pending: "events.awdp.phaseLabel.pending",
	break: "events.awdp.phaseLabel.break",
	preparing_fix: "events.awdp.phaseLabel.preparing_fix",
	fix: "events.awdp.phaseLabel.fix",
	ended: "events.awdp.phaseLabel.ended",
};

const INSTANCE_STATUS_KEYS: Record<string, string> = {
	pending: "events.instances.status.pending",
	running: "events.instances.status.running",
	completed: "events.instances.status.completed",
	failed: "events.instances.status.failed",
};

const INSTANCE_STATUS_TONES: Record<string, PillTone> = {
	pending: "warning",
	running: "success",
	completed: "info",
	failed: "danger",
};

/** 后端枚举值 → 本地化文案；未知值原样展示，不臆造状态。 */
function useEnumLabel(keys: Record<string, string>) {
	const { t } = useTranslation();
	return (value: string | null | undefined): string => {
		if (!value) return t("common.unknown");
		const key = keys[value];
		return key ? t(key) : value;
	};
}

/* ── 总览 ───────────────────────────────────────────────────────────────── */

export function OverviewTab({ info }: { info: EventInfo }) {
	const { t } = useTranslation();
	return (
		// 工作区本身已是「主内容 + 右栏」两栏：总览内部不再二次分栏，
		// 赛事事实卡放在页面右栏，这里只保留纵向阅读流（说明 → 规则 → 赛后材料）。
		<div className="space-y-4">
			<SectionCard
				title={t("events.overview.descriptionTitle")}
				description={t("events.overview.descriptionSubtitle")}
			>
				<MarkdownView emptyText={t("events.overview.descriptionEmpty")}>
					{info.event.description}
				</MarkdownView>
			</SectionCard>
			<SectionCard
				title={t("events.overview.rulesTitle")}
				description={t("events.overview.rulesSubtitle")}
			>
				<MarkdownView emptyText={t("events.overview.rulesEmpty")}>{info.event.rules}</MarkdownView>
			</SectionCard>
			{/* 后端只接受正式赛的 writeup（练习赛返回 400），且要求已加入赛事；
			    未加入时提交必然 403 —— 不渲染一个点了必失败的入口。 */}
			{info.event.purpose === EventPurpose.Competition &&
			info.event.family === "jeopardy" ? (
				info.joined ? (
					<SectionCard
						title={t("events.writeup.title")}
						description={t("events.writeup.description")}
					>
						<EventWriteupPanel info={info} />
					</SectionCard>
				) : (
					<SectionCard
						title={t("events.writeup.lockedTitle")}
						description={t("events.writeup.lockedDescription")}
					>
						<p className="text-sm text-muted-foreground">
							{t("events.writeup.lockedHint")}
						</p>
					</SectionCard>
				)
			) : null}
		</div>
	);
}

/* ── 赛事题目 ───────────────────────────────────────────────────────────── */

export function ChallengesTab({
	eventId,
	participantMode,
}: {
	eventId: string;
	participantMode?: string;
}) {
	const isTeamEvent = participantMode === "team";
	const { t } = useTranslation();
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);

	const query = useQuery({
		queryKey: qk.events.challenges(eventId, { page: 1, limit: 200 }),
		queryFn: () => callList(client.service.events.fetchChallenges(eventId, { page: 1, limit: 200 })),
	});

	const items = query.data?.items ?? [];
	const sorted = [...items].sort((a, b) => b.current_points - a.current_points);
	const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

	const columns: DataTableColumn<EventChallengeResult>[] = [
		{
			id: "name",
			header: t("events.challenges.columns.challenge"),
			sortValue: (row) => row.challenge.name,
			cell: (row) => (
				<div className="min-w-0">
					<Link
						to={`/events/${eventId}/challenges/${row.challenge.id}`}
						className="truncate text-sm font-medium hover:underline"
					>
						{row.challenge.name}
					</Link>
					<p className="truncate text-xs text-muted-foreground">
						{row.challenge.category || t("events.challenges.uncategorized")}
					</p>
				</div>
			),
		},
		{
			id: "points",
			header: t("events.challenges.columns.points"),
			align: "right",
			sortValue: (row) => row.current_points,
			cell: (row) => <span className="tnum font-mono text-xs">{formatScore(row.current_points)}</span>,
		},
		{
			id: "solves",
			header: t("events.challenges.columns.solves"),
			align: "right",
			hideBelow: "sm",
			sortValue: (row) => row.solved_count,
			cell: (row) => <span className="tnum font-mono text-xs">{row.solved_count}</span>,
		},
		{
			id: "solved",
			header: t("events.challenges.columns.status"),
			cell: (row) =>
				row.solved ? (
					<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
						{t("events.challenges.solved", { no: row.solved_no })}
					</TonePill>
				) : (
					<TonePill tone="muted">{t("events.challenges.unsolved")}</TonePill>
				),
		},
		{
			id: "action",
			header: "",
			align: "right",
			cell: (row) => (
				<Button variant="ghost" size="sm" asChild>
					<Link to={`/events/${eventId}/challenges/${row.challenge.id}`}>
						{t("events.challenges.open")} <ChevronRight aria-hidden="true" />
					</Link>
				</Button>
			),
		},
	];

	return (
		<SectionCard
			title={t("events.challenges.title")}
			description={
				query.isSuccess ? (
					<span className="tnum">{t("events.challenges.count", { count: items.length })}</span>
				) : undefined
			}
			contentClassName="px-0"
			footer={
				items.length > pageSize ? (
					<PaginationBar
						page={page}
						pageSize={pageSize}
						total={items.length}
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
				skeleton={<TableSkeleton rows={6} columns={5} />}
				errorTitle={t("events.challenges.loadError")}
				isEmpty={() => items.length === 0}
				empty={
					<EmptyBlock
						title={t("events.challenges.emptyTitle")}
						description={t("events.challenges.emptyDescription")}
					/>
				}
			>
				{() => (
					<DataTable
						data={paged}
						getRowId={(row) => row.challenge.id}
						columns={columns}
						mobileCard={(row) => (
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">{row.challenge.name}</p>
									<p className="text-xs text-muted-foreground">
										{t(
											isTeamEvent
												? "events.challenges.mobileSummary"
												: "events.challenges.mobileSummarySolvers",
											{
												score: formatScore(row.current_points),
												count: row.solved_count,
											},
										)}
									</p>
								</div>
								<Link
									to={`/events/${eventId}/challenges/${row.challenge.id}`}
									aria-label={t("events.challenges.open")}
									title={t("events.challenges.open")}
								>
									<ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
								</Link>
							</div>
						)}
					/>
				)}
			</QueryState>
		</SectionCard>
	);
}

/* ── 积分榜 ─────────────────────────────────────────────────────────────── */

export function ScoreboardTab({ info }: { info: EventInfo }) {
	const { t } = useTranslation();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.events.scoreboard(info.event.id),
		queryFn: () => callList(client.service.events.getScoreboard(info.event.id)),
		refetchInterval: 30_000,
	});

	const myName =
		info.event.participant_mode === "team"
			? (info.team_result?.team.name ?? null)
			: null;

	const columns: DataTableColumn<ScoreboardItem>[] = [
		{
			id: "rank",
			header: t("events.scoreboard.columns.rank"),
			align: "right",
			sortValue: (row) => row.no,
			cell: (row) => <span className="tnum font-mono text-xs">{row.no}</span>,
		},
		{
			id: "name",
			header: t("events.scoreboard.columns.name"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="flex min-w-0 items-center gap-2">
					<span className="truncate text-sm font-medium">{row.name}</span>
					{myName && row.name === myName ? (
						<TonePill tone="info">{t("events.scoreboard.myTeam")}</TonePill>
					) : null}
				</div>
			),
		},
		{
			id: "solved",
			header: t("events.scoreboard.columns.solved"),
			align: "right",
			sortValue: (row) => row.solved_count,
			cell: (row) => <span className="tnum font-mono text-xs">{row.solved_count}</span>,
		},
		{
			id: "score",
			header: t("events.scoreboard.columns.score"),
			align: "right",
			sortValue: (row) => row.score,
			cell: (row) => <span className="tnum font-mono text-sm">{formatScore(row.score)}</span>,
		},
		{
			id: "grid",
			header: t("events.scoreboard.columns.matrix"),
			hideBelow: "lg",
			cell: (row) => (
				<div
					className="flex flex-wrap gap-1"
					role="group"
					aria-label={t("events.scoreboard.matrixLabel")}
				>
					{row.challenges.map((cell) => {
						const label = cell.solved
							? t("events.scoreboard.matrixSolved", { name: cell.name, no: cell.solved_no })
							: t("events.scoreboard.matrixUnsolved", { name: cell.name });
						return (
							<span
								key={cell.name}
								role="img"
								aria-label={label}
								title={label}
								className={
									cell.solved
										? "inline-block size-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400"
										: "inline-block size-2.5 rounded-sm bg-muted-foreground/20"
								}
							/>
						);
					})}
				</div>
			),
		},
	];

	return (
		<SectionCard
			title={t("events.scoreboard.title")}
			description={t("events.scoreboard.description")}
			actions={
				<Button variant="ghost" size="sm" onClick={() => query.refetch()}>
					{t("events.scoreboard.refreshNow")}
				</Button>
			}
			contentClassName="px-0"
		>
			<QueryState
				query={query}
				skeleton={<TableSkeleton rows={6} columns={4} />}
				errorTitle={t("events.scoreboard.loadError")}
				isEmpty={(result) => result.items.length === 0}
				empty={
					<EmptyBlock
						title={t("events.scoreboard.emptyTitle")}
						description={t("events.scoreboard.emptyDescription")}
						icon={<Trophy className="size-5" aria-hidden="true" />}
					/>
				}
			>
				{(result) => (
					<DataTable
						data={result.items}
						getRowId={(row) => row.id}
						columns={columns}
						mobileCard={(row) => (
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">
										#{row.no} {row.name}
									</p>
									<p className="text-xs text-muted-foreground">
										{t("events.scoreboard.mobileSolved", { count: row.solved_count })}
									</p>
								</div>
								<span className="tnum font-mono text-sm">{formatScore(row.score)}</span>
							</div>
						)}
					/>
				)}
			</QueryState>
		</SectionCard>
	);
}

/* ── 趋势 ───────────────────────────────────────────────────────────────── */

export function TrendTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const locale = getLocale() === "en" ? "en-US" : "zh-CN";
	const query = useQuery({
		queryKey: qk.events.trend(eventId),
		queryFn: () => call<TrendItem[]>(client.service.events.getTrend(eventId), t("events.workspace.tabs.trend")),
		refetchInterval: 30_000,
	});

	return (
		<SectionCard title={t("events.trend.title")} description={t("events.trend.description")}>
			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("events.trend.loading")} />}
				errorTitle={t("events.trend.loadError")}
				isEmpty={(series) => series.every((item) => item.points.length === 0)}
				empty={
					<EmptyBlock
						title={t("events.trend.emptyTitle")}
						description={t("events.trend.emptyDescription")}
					/>
				}
			>
				{(series) => (
					<TrendChart
						series={series.map((item) => ({
							name: item.name,
							points: item.points.map((point) => ({
								x: new Date(point.time).getTime(),
								y: point.score,
							})),
						}))}
						formatY={(value) => value.toFixed(0)}
						formatX={(value) =>
							new Date(value).toLocaleTimeString(locale, {
								hour: "2-digit",
								minute: "2-digit",
								hour12: false,
							})
						}
					/>
				)}
			</QueryState>
		</SectionCard>
	);
}

/* ── 赛事实例 ───────────────────────────────────────────────────────────── */

export function InstancesTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const now = useNow(30_000);
	const instanceStatus = useEnumLabel(INSTANCE_STATUS_KEYS);

	const query = useQuery({
		queryKey: qk.events.instances(eventId),
		queryFn: () =>
			call<EventInstanceResult[]>(
				client.service.events.getInstances(eventId),
				t("events.instances.title"),
			),
		refetchInterval: 30_000,
	});

	const destroy = useMutation({
		mutationFn: (id: string) =>
			callVoid(client.service.instances.destroy(id), t("events.instances.destroyAction")),
		onSuccess: () => {
			toast.success(t("events.instances.destroySuccess"));
			void queryClient.invalidateQueries({ queryKey: qk.events.instances(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.instances.all });
		},
		onError: (error) => toast.apiError(t("events.instances.destroyFailed"), error),
	});

	const columns: DataTableColumn<EventInstanceResult>[] = [
		{
			id: "challenge",
			header: t("events.instances.columns.challenge"),
			sortValue: (row) => row.challenge_name,
			cell: (row) => <span className="text-sm">{row.challenge_name}</span>,
		},
		{
			id: "owner",
			header: t("events.instances.columns.owner"),
			hideBelow: "sm",
			cell: (row) => <span className="text-xs">{row.user_nickname}</span>,
		},
		{
			id: "status",
			header: t("events.instances.columns.status"),
			cell: (row) => (
				<TonePill tone={INSTANCE_STATUS_TONES[row.instance.status] ?? "neutral"}>
					{instanceStatus(row.instance.status)}
				</TonePill>
			),
		},
		{
			id: "identifier",
			header: t("events.instances.columns.container"),
			hideBelow: "md",
			cell: (row) => <MonoText>{row.instance.identifier || "—"}</MonoText>,
		},
		{
			id: "created",
			header: t("events.instances.columns.created"),
			hideBelow: "md",
			sortValue: (row) => row.instance.created_at,
			cell: (row) => (
				<span className="text-xs text-muted-foreground tnum">
					{formatRelative(row.instance.created_at, now)}
				</span>
			),
		},
		{
			id: "expires",
			header: t("events.instances.columns.expires"),
			hideBelow: "lg",
			cell: (row) => (
				<span className="text-xs whitespace-nowrap text-muted-foreground tnum">
					{row.instance.destroy_at ? formatDateTime(row.instance.destroy_at) : "—"}
				</span>
			),
		},
	];

	return (
		<SectionCard
			title={t("events.instances.title")}
			description={t("events.instances.description")}
			contentClassName="px-0"
		>
			<QueryState
				query={query}
				skeleton={<TableSkeleton rows={4} columns={5} />}
				errorTitle={t("events.instances.loadError")}
				isEmpty={(items) => items.length === 0}
				empty={
					<EmptyBlock
						title={t("events.instances.emptyTitle")}
						description={t("events.instances.emptyDescription")}
					/>
				}
			>
				{(items) => (
					<DataTable
						data={items}
						getRowId={(row) => row.instance.id}
						columns={columns}
						rowActions={(row) => (
							<Button
								variant="destructive"
								size="sm"
								disabled={destroy.isPending}
								onClick={async () => {
									const ok = await confirm({
										title: t("events.instances.destroyTitle"),
										description: row.challenge_name,
										consequences: [t("events.instances.destroyConsequence")],
										tone: "danger",
										confirmText: t("events.instances.destroyConfirm"),
									});
									if (ok) destroy.mutate(row.instance.id);
								}}
							>
								<Trash2 aria-hidden="true" /> {t("events.instances.destroy")}
							</Button>
						)}
						mobileCard={(row) => (
							<div className="space-y-1">
								<p className="text-sm font-medium">{row.challenge_name}</p>
								<p className="text-xs text-muted-foreground">
									{instanceStatus(row.instance.status)} ·{" "}
									<MonoText>{row.instance.identifier || "—"}</MonoText>
								</p>
							</div>
						)}
					/>
				)}
			</QueryState>
		</SectionCard>
	);
}

/* ── 赛事公告 ───────────────────────────────────────────────────────────── */

export function BulletinTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const now = useNow(30_000);
	const query = useQuery({
		queryKey: qk.events.announcements(eventId),
		queryFn: () =>
			call<EventAnnouncements[]>(
				client.service.events.getAnnouncements(eventId),
				t("events.bulletin.title"),
			),
		refetchInterval: 60_000,
	});

	return (
		<SectionCard title={t("events.bulletin.title")} description={t("events.bulletin.description")}>
			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("events.bulletin.loading")} />}
				errorTitle={t("events.bulletin.loadError")}
				isEmpty={(items) => items.length === 0}
				empty={
					<EmptyBlock
						title={t("events.bulletin.emptyTitle")}
						description={t("events.bulletin.emptyDescription")}
					/>
				}
			>
				{(items) => (
					<ul className="space-y-3">
						{items.map((item) => (
							<li key={item.id} className="rounded-lg border p-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className="text-sm font-medium">{item.title}</p>
									<span className="text-xs text-muted-foreground">
										{formatRelative(item.created_at, now)}
									</span>
								</div>
								<div className="mt-2">
									<MarkdownView>{item.content}</MarkdownView>
								</div>
							</li>
						))}
					</ul>
				)}
			</QueryState>
		</SectionCard>
	);
}

/* ── AWD / AWDP 概览（只读摘要 + 进入专用工作区） ────────────────────────── */

export function ArenaSummaryTab({
	eventId,
	info,
}: {
	eventId: string;
	info: EventInfo;
}) {
	const { t } = useTranslation();
	const awdStatus = useEnumLabel(AWD_STATUS_KEYS);
	const awdPhase = useEnumLabel(AWD_PHASE_KEYS);
	const client = useClient();
	const query = useQuery({
		queryKey: qk.awd.status(eventId),
		queryFn: () =>
			call<AwdPlayerStatus>(client.awd.player.status(eventId), t("events.awd.statusAction")),
		refetchInterval: 30_000,
	});

	return (
		<div className="space-y-4">
			<SectionCard
				title={t("events.overview.rulesTitle")}
				description={t("events.awd.rulesDescription")}
			>
				<MarkdownView emptyText={t("events.overview.rulesEmpty")}>
					{info.event.rules}
				</MarkdownView>
			</SectionCard>
			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("events.awd.loading")} />}
				errorTitle={t("events.awd.loadError")}
			>
				{(status) => (
					<>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<StatCard
								label={t("events.awd.phase")}
								value={awdPhase(status.phase)}
								hint={awdStatus(status.status)}
							/>
							<StatCard
								label={t("events.awd.round")}
								value={
									status.current_round !== null
										? `${status.current_round}${status.round_count ? ` / ${status.round_count}` : ""}`
										: "—"
								}
							/>
							<StatCard
								label={t("events.awd.score")}
								value={formatPoints(status.score)}
								tone="success"
								icon={<Swords className="size-5" aria-hidden="true" />}
							/>
							<StatCard
								label={t("events.awd.participation")}
								value={status.banned ? t("events.awd.banned") : t("events.awd.normal")}
								tone={status.banned ? "danger" : "default"}
								hint={status.final_settlement ? t("events.awd.finalSettlement") : undefined}
							/>
						</div>
						<AwdFlagPanel eventId={eventId} status={status} />

						{info.team_result ? (
							<SectionCard
								title={t("events.awd.teamTitle")}
								description={t("events.awd.teamDescription")}
							>
								<KeyValueList
									columns={1}
									items={[
										{
											key: t("events.awd.teamName"),
											value: (
												<span className="font-medium">
													{info.team_result.team.name}
												</span>
											),
										},
										{
											key: t("events.awd.teamId"),
											value: <MonoText>{info.team_result.team.id}</MonoText>,
										},
										...info.team_result.members.map((member) => ({
											key: member.member.role,
											value: (
												<span>
													{member.member_name}{" "}
													<span className="text-xs text-muted-foreground">
														{formatDateTime(member.member.joined_at, { seconds: true })}
													</span>
												</span>
											),
										})),
									]}
								/>
							</SectionCard>
						) : null}

						<EventWriteupPanel info={info} />

						<SectionCard
							title={t("events.awd.cockpitTitle")}
							description={t("events.awd.cockpitDescription")}
						>
							<Button asChild>
								<Link to={`/arena/${eventId}`}>
									{t("events.awd.enterCockpit")} <ExternalLink aria-hidden="true" />
								</Link>
							</Button>
						</SectionCard>
					</>
				)}
			</QueryState>
		</div>
	);
}

export function LabSummaryTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const awdpPhase = useEnumLabel(AWDP_PHASE_KEYS);
	const client = useClient();
	const query = useQuery({
		queryKey: qk.awdp.overview(eventId),
		queryFn: () =>
			call<AwdpOverview>(client.awdp.player.overview(eventId), t("events.awdp.overviewAction")),
		refetchInterval: 30_000,
	});

	return (
		<div className="space-y-4">
			<QueryState
				query={query}
				skeleton={<LoadingBlock label={t("events.awdp.loading")} />}
				errorTitle={t("events.awdp.loadError")}
			>
				{(overview) => (
					<>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<StatCard
								label={t("events.awdp.phase")}
								value={awdpPhase(overview.phase)}
								hint={
									overview.next_action_at
										? t("events.awdp.nextAction", {
												time: formatDateTime(overview.next_action_at),
											})
										: undefined
								}
							/>
							<StatCard
								label={t("events.awdp.round")}
								value={`${overview.current_round} / ${overview.total_rounds}`}
							/>
							<StatCard
								label={t("events.awdp.score")}
								value={formatScore(overview.my_score)}
								tone="success"
							/>
							<StatCard
								label={t("events.awdp.gameboxes")}
								value={overview.gameboxes.length}
							/>
						</div>
						<SectionCard
							title={t("events.awdp.workbenchTitle")}
							description={t("events.awdp.workbenchDescription")}
						>
							<Button asChild>
								<Link to={`/lab/${eventId}`}>
									{t("events.awdp.enterWorkbench")} <ExternalLink aria-hidden="true" />
								</Link>
							</Button>
						</SectionCard>
						<SectionCard
							title={t("events.awdp.rhythmTitle")}
							description={t("events.awdp.rhythmDescription")}
						>
							<KeyValueList
								items={[
									{
										key: t("events.awdp.breakDuration"),
										value: t("events.awdp.seconds", {
											seconds: overview.break_duration_secs,
										}),
									},
									{
										key: t("events.awdp.fixDuration"),
										value: t("events.awdp.seconds", { seconds: overview.fix_duration_secs }),
									},
									{
										key: t("events.awdp.roundInterval"),
										value: t("events.awdp.seconds", {
											seconds: overview.fix_round_interval_secs,
										}),
									},
									{
										key: t("events.awdp.breakScore"),
										value: formatScore(overview.break_score),
									},
									{
										key: t("events.awdp.fixRoundScore"),
										value: formatScore(overview.fix_round_score),
									},
								]}
							/>
						</SectionCard>
					</>
				)}
			</QueryState>
		</div>
	);
}


/* ── AWD：Default 的五个子页 ─────────────────────────────────────────────── */

export function AwdGameboxesTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.awd.status(eventId),
		queryFn: () => call<AwdPlayerStatus>(client.awd.player.status(eventId), t("awd.actionNames.status")),
	});
	return (
		<QueryState
			query={query}
			skeleton={<LoadingBlock label={t("awd.arena.loading")} />}
			errorTitle={t("awd.arena.errors.status")}
		>
			{(status) => <AwdGameboxPanel eventId={eventId} status={status} />}
		</QueryState>
	);
}

export function AwdScoreboardTab({
	eventId,
	myTeamId,
}: {
	eventId: string;
	myTeamId: string | null;
}) {
	return <AwdScoreboardPanel eventId={eventId} myTeamId={myTeamId} />;
}

export function AwdWireguardTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	return (
		<SectionCard title={t("awd.network.tabs.wireguard")} description={t("awd.network.description")}>
			<AwdWireGuardPanel eventId={eventId} />
		</SectionCard>
	);
}

export function AwdSshTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	return (
		<SectionCard title={t("awd.network.tabs.ssh")} description={t("awd.network.description")}>
			<AwdSshPanel eventId={eventId} />
		</SectionCard>
	);
}


/* ── AWDP：Default 的六子页 ─────────────────────────────────────────────── */

export function AwdpGameboxesTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const query = useQuery({
		queryKey: qk.awdp.overview(eventId),
		queryFn: () => call<AwdpOverview>(client.awdp.player.overview(eventId), t("awdp.calls.overview")),
	});
	return (
		<QueryState
			query={query}
			skeleton={<LoadingBlock label={t("awdp.states.loadingOverview")} />}
			errorTitle={t("awdp.page.loadError")}
		>
			{(overview) => (
				<SectionCard
					title={t("awdp.gameboxes.sectionTitle")}
					description={t("awdp.gameboxes.sectionDescription")}
				>
					<AwdpGameboxList
						gameboxes={overview.gameboxes}
						selectedId={selectedId}
						onSelect={setSelectedId}
					/>
					<div className="mt-4">
						<Button asChild variant="outline" size="sm">
							<Link to={`/lab/${eventId}`}>
								{t("awdp.gameboxes.openWorkbench")}
							</Link>
						</Button>
					</div>
				</SectionCard>
			)}
		</QueryState>
	);
}

export function AwdpRoundsTab({ eventId }: { eventId: string }) {
	return <AwdpRoundsEvaluationsPanel eventId={eventId} enabled />;
}

export function AwdpScoreboardTab({ eventId }: { eventId: string }) {
	return <AwdpScoreboardPanel eventId={eventId} />;
}

export function AwdpTrendTab({ eventId }: { eventId: string }) {
	return <AwdpTrendPanel eventId={eventId} />;
}
