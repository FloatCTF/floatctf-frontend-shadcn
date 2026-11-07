/**
 * `/lab/:eventId` —— AWDP 比赛工作台（阶段驱动的单页工作区）。
 *
 * 顶部：阶段步进条（含 `preparing_fix` 过渡态）+ 关键指标
 * 左：我的靶机列表 + 实例生命周期（启动 / 停止 / 重置 / 刷新）
 * 中：Break / Fix 动作区（提交 flag、上传补丁、Test Check、源码下载）
 * 右：Fix 回合与我的评测
 * 底部：积分榜矩阵 / 我的积分 / 趋势
 *
 * 实时：`useAwdpEventStream`（`lastEvent` 来自 ref，所以用 invalidate 驱动刷新）+
 * `RealtimePill`（显式呈现 auth_error）。
 *
 * 文案：全部走 i18n（`awdp.*`）；阶段 / 动作门禁来自 `./domain`（SDK `AwdpPhase`）。
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Trophy } from "lucide-react";

import type { AwdpInstance, AwdpOverview } from "@floatctf/sdk";

import { call, callMaybe, callVoid } from "~/api/call";
import { isForbidden, isNotFound } from "~/api/errors";
import { useBindings, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { RealtimePill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import {
	KeyValueList,
	PageBody,
	PageHeader,
	SectionCard,
	StatCard,
} from "~/components/app/page";
import {
	EmptyBlock,
	ErrorBlock,
	LoadingBlock,
	PermissionDeniedBlock,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatDateTime, formatDuration, formatInt, formatPoints } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import {
	AwdpActionPanel,
	AwdpGameboxList,
	AwdpInstancePanel,
	AwdpMyScoresPanel,
	AwdpPhaseSteps,
	AwdpRoundsEvaluationsPanel,
	AwdpScoreboardPanel,
	AwdpTrendPanel,
} from "./components";
import {
	awdpInstanceResetConsequences,
	awdpPhaseLabel,
	awdpPhaseTone,
	awdpStopConsequences,
	isAwdpNotConfigured,
} from "./domain";

export function LabPage(): ReactNode {
	const { eventId = "" } = useParams<{ eventId: string }>();
	const { t } = useTranslation();
	useDocumentTitle(t("awdp.page.docTitle"));

	const client = useClient();
	const { useAwdpEventStream } = useBindings();
	const stream = useAwdpEventStream({ eventId, enabled: Boolean(eventId) });
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const overviewQuery = useQuery({
		queryKey: qk.awdp.overview(eventId),
		queryFn: () => call<AwdpOverview>(client.awdp.player.overview(eventId), t("awdp.calls.overview")),
		enabled: Boolean(eventId),
	});

	const overview = overviewQuery.data;
	const gameboxes = useMemo(() => overview?.gameboxes ?? [], [overview]);
	const selected = gameboxes.find((item) => item.id === selectedId) ?? gameboxes[0] ?? null;
	const selectedGameboxId = selected?.id ?? "";

	// 阶段为 pending / ended 时后端没有 active run，`getInstance` 会返回
	// 400（"AWDP 事件尚未开始"）——那是业务态，不该当成加载失败：这两种阶段直接不查。
	const phase = overview?.phase ?? "pending";
	const activePhase = phase === "break" || phase === "preparing_fix" || phase === "fix";
	// 赛事是否已经开始过（决定 rounds / evaluations 这两个「必须有 run」的端点是否可查）。
	const hasRun = (overview?.started_at ?? null) !== null || phase !== "pending";

	// 实例详情：key 以 qk.awdp.instance(eventId) 为前缀 + 靶机 id，因此
	// `invalidateQueries({ queryKey: qk.awdp.instance(eventId) })` 仍能前缀失效到。
	const instanceQuery = useQuery({
		queryKey: [...qk.awdp.instance(eventId), selectedGameboxId],
		queryFn: () =>
			callMaybe<AwdpInstance>(
				client.awdp.player.getInstance(eventId, selectedGameboxId),
				t("awdp.calls.instance"),
			),
		enabled: Boolean(eventId) && Boolean(selectedGameboxId) && activePhase,
		retry: false,
	});

	// 两个来源：overview（SSE 会失效 `awdp-overview`）与 getInstance（动作后 / 手动刷新）。
	// 取 dataUpdatedAt 更新的一方 —— 否则 SSE 已刷新的 overview 会被缓存的 getInstance 覆盖。
	const instance: AwdpInstance | null =
		instanceQuery.dataUpdatedAt >= overviewQuery.dataUpdatedAt
			? (instanceQuery.data ?? null)
			: (selected?.instance ?? null);

	const refreshAll = useCallback(() => {
		for (const key of [
			qk.awdp.overview(eventId),
			qk.awdp.instance(eventId),
			qk.awdp.rounds(eventId),
			qk.awdp.evaluations(eventId),
			qk.awdp.scores(eventId),
			qk.awdp.scoreboard(eventId),
			qk.awdp.trend(eventId),
		]) {
			void queryClient.invalidateQueries({ queryKey: key });
		}
	}, [queryClient, eventId]);

	const startMutation = useMutation({
		mutationFn: () =>
			call<AwdpInstance>(
				client.awdp.player.startInstance(eventId, selectedGameboxId),
				t("awdp.calls.startInstance"),
			),
		onSuccess: () => {
			toast.success(t("awdp.toasts.instanceStarted"));
			refreshAll();
		},
		onError: (error) => toast.apiError(t("awdp.toasts.instanceStartFailed"), error),
	});

	const stopMutation = useMutation({
		mutationFn: () =>
			callVoid(
				client.awdp.player.stopInstance(eventId, selectedGameboxId),
				t("awdp.calls.stopInstance"),
			),
		onSuccess: () => {
			toast.success(t("awdp.toasts.instanceStopped"));
			refreshAll();
		},
		onError: (error) => toast.apiError(t("awdp.toasts.instanceStopFailed"), error),
	});

	const resetMutation = useMutation({
		mutationFn: () =>
			call<AwdpInstance>(
				client.awdp.player.resetInstance(eventId, selectedGameboxId),
				t("awdp.calls.resetInstance"),
			),
		onSuccess: () => {
			toast.success(t("awdp.toasts.instanceReset"));
			refreshAll();
		},
		onError: (error) => toast.apiError(t("awdp.toasts.instanceResetFailed"), error),
	});

	const busy = startMutation.isPending || stopMutation.isPending || resetMutation.isPending;

	async function askStop() {
		const ok = await confirm({
			title: t("awdp.confirm.stopTitle", {
				name: selected?.name ?? t("awdp.confirm.instanceNameFallback"),
			}),
			description: t("awdp.confirm.stopDescription"),
			consequences: awdpStopConsequences(t),
			tone: "danger",
			confirmText: t("awdp.confirm.stopConfirm"),
		});
		if (ok) stopMutation.mutate();
	}

	async function askReset() {
		const ok = await confirm({
			title: t("awdp.confirm.resetTitle", {
				name: selected?.name ?? t("awdp.confirm.instanceNameFallback"),
			}),
			description: t("awdp.confirm.resetDescription"),
			consequences: awdpInstanceResetConsequences(t),
			tone: "danger",
			confirmText: t("awdp.confirm.resetConfirm"),
		});
		if (ok) resetMutation.mutate();
	}

	return (
		<PageBody>
			<PageHeader
				title={t("awdp.page.title")}
				description={t("awdp.page.subtitle")}
				breadcrumbs={
					<nav className="flex items-center gap-1.5">
						<Link to="/events" className="hover:underline">
							{t("awdp.page.breadcrumbEvents")}
						</Link>
						<span>/</span>
						<Link to={`/events/${eventId}`} className="hover:underline">
							{t("awdp.page.breadcrumbWorkspace")}
						</Link>
						<span>/</span>
						<span className="text-foreground">{t("awdp.page.breadcrumbCurrent")}</span>
					</nav>
				}
				badge={
					overview ? (
						<TonePill tone={awdpPhaseTone(overview.phase)}>
							{awdpPhaseLabel(overview.phase, t)}
						</TonePill>
					) : null
				}
				actions={
					<RealtimePill
						state={stream.connectionState}
						onRefresh={() => {
							stream.invalidateAwdp();
							refreshAll();
						}}
					/>
				}
			/>

			{overviewQuery.isPending ? (
				<LoadingBlock label={t("awdp.states.loadingOverview")} />
			) : overviewQuery.isError ? (
				isForbidden(overviewQuery.error) ? (
					<PermissionDeniedBlock description={t("awdp.states.forbiddenDescription")} />
				) : isNotFound(overviewQuery.error) || isAwdpNotConfigured(overviewQuery.error) ? (
					<EmptyBlock
						title={t("awdp.states.notConfiguredTitle")}
						description={t("awdp.states.notConfiguredDescription")}
						action={
							<Button variant="outline" size="sm" asChild>
								<Link to="/events">{t("awdp.states.backToEvents")}</Link>
							</Button>
						}
					/>
				) : (
					<ErrorBlock
						error={overviewQuery.error}
						title={t("awdp.states.loadOverview")}
						onRetry={() => void overviewQuery.refetch()}
					/>
				)
			) : overview ? (
				<div className="space-y-5">
					<SectionCard
						title={t("awdp.phases.sectionTitle")}
						description={t("awdp.phases.sectionDescription")}
						actions={
							overview.next_action_at ? (
								<span className="tnum text-xs text-muted-foreground">
									{t("awdp.phases.nextActionAt", {
										time: formatDateTime(overview.next_action_at, {
											seconds: true,
										}),
									})}
								</span>
							) : null
						}
					>
						<AwdpPhaseSteps
							phase={overview.phase}
							currentRound={overview.current_round}
							totalRounds={overview.total_rounds}
							nextActionAt={overview.next_action_at}
						/>
						<div className="mt-4 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-4">
							<StatCard
								label={t("awdp.stats.myScore")}
								value={formatPoints(overview.my_score)}
								hint={t("awdp.stats.myScoreHint")}
								icon={<Trophy className="size-4" aria-hidden="true" />}
								tone="success"
							/>
							<StatCard
								label={t("awdp.stats.currentRound")}
								value={t("awdp.stats.roundRatio", {
									current: formatInt(overview.current_round),
									total: formatInt(overview.total_rounds),
								})}
								hint={t("awdp.stats.currentRoundHint")}
								icon={<Database className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("awdp.stats.breakDuration")}
								value={formatDuration(overview.break_duration_secs)}
								hint={
									overview.break_ends_at
										? t("awdp.stats.endsAt", {
												time: formatDateTime(overview.break_ends_at, {
													seconds: true,
												}),
											})
										: t("awdp.stats.notStarted")
								}
							/>
							<StatCard
								label={t("awdp.stats.fixDuration")}
								value={`${formatDuration(overview.fix_duration_secs)} / ${formatDuration(overview.fix_round_interval_secs)}`}
								hint={
									overview.fix_ends_at
										? t("awdp.stats.endsAt", {
												time: formatDateTime(overview.fix_ends_at, {
													seconds: true,
												}),
											})
										: t("awdp.stats.notStarted")
								}
							/>
						</div>
						<KeyValueList
							className="mt-4"
							columns={3}
							items={[
								{
									key: t("awdp.stats.breakScore"),
									value: (
										<span className="tnum">
											{formatPoints(overview.break_score)}
										</span>
									),
								},
								{
									key: t("awdp.stats.fixRoundScore"),
									value: (
										<span className="tnum">
											{formatPoints(overview.fix_round_score)}
										</span>
									),
								},
								{
									key: t("awdp.stats.startedAt"),
									value: overview.started_at ? (
										<span className="tnum">
											{formatDateTime(overview.started_at, {
												seconds: true,
											})}
										</span>
									) : (
										<span className="text-muted-foreground">
											{t("awdp.stats.notStarted")}
										</span>
									),
								},
								{
									key: t("awdp.stats.fixStartedAt"),
									value: overview.fix_started_at ? (
										<span className="tnum">
											{formatDateTime(overview.fix_started_at, {
												seconds: true,
											})}
										</span>
									) : (
										<span className="text-muted-foreground">
											{t("awdp.stats.notStarted")}
										</span>
									),
								},
								{
									key: t("awdp.stats.finishedAt"),
									value: overview.finished_at ? (
										<span className="tnum">
											{formatDateTime(overview.finished_at, {
												seconds: true,
											})}
										</span>
									) : (
										<span className="text-muted-foreground">
											{t("awdp.stats.notFinished")}
										</span>
									),
								},
							]}
						/>
					</SectionCard>

					{/* 1280 下三列会把「实例 / 评测」压到 300px 左右：宽屏才三列，其余两列 + 评测整行。 */}
					<div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)]">
						<div className="space-y-5">
							<SectionCard
								title={t("awdp.gameboxes.sectionTitle")}
								description={t("awdp.gameboxes.sectionDescription")}
							>
								<AwdpGameboxList
									gameboxes={gameboxes}
									selectedId={selected?.id ?? null}
									onSelect={setSelectedId}
								/>
							</SectionCard>

							<AwdpInstancePanel
								gamebox={selected}
								instance={instance}
								isPending={
									activePhase && Boolean(selectedGameboxId) && instanceQuery.isPending
								}
								isError={activePhase && instanceQuery.isError}
								error={instanceQuery.error}
								busy={busy}
								phase={phase}
								onStart={() => startMutation.mutate()}
								onStop={() => void askStop()}
								onReset={() => void askReset()}
								onRefresh={() => void instanceQuery.refetch()}
							/>
						</div>

						<AwdpActionPanel
							eventId={eventId}
							gamebox={selected}
							instance={instance}
							phase={phase}
							onChanged={refreshAll}
						/>

						<div className="lg:col-span-2 2xl:col-span-1">
							<AwdpRoundsEvaluationsPanel eventId={eventId} enabled={hasRun} />
						</div>
					</div>

					<SectionCard
						title={t("awdp.scoreboard.sectionTitle")}
						description={t("awdp.scoreboard.sectionDescription")}
					>
						<Tabs defaultValue="scoreboard">
							<TabsList>
								<TabsTrigger value="scoreboard">
									{t("awdp.scoreboard.tabMatrix")}
								</TabsTrigger>
								<TabsTrigger value="scores">
									{t("awdp.scoreboard.tabScores")}
								</TabsTrigger>
								<TabsTrigger value="trend">
									{t("awdp.scoreboard.tabTrend")}
								</TabsTrigger>
							</TabsList>
							<TabsContent value="scoreboard" className="pt-3">
								<AwdpScoreboardPanel eventId={eventId} />
							</TabsContent>
							<TabsContent value="scores" className="pt-3">
								<AwdpMyScoresPanel eventId={eventId} />
							</TabsContent>
							<TabsContent value="trend" className="pt-3">
								<AwdpTrendPanel eventId={eventId} />
							</TabsContent>
						</Tabs>
					</SectionCard>

					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link to={`/events/${eventId}`}>{t("awdp.page.backToWorkspace")}</Link>
						</Button>
					</div>
				</div>
			) : null}
		</PageBody>
	);
}
