/**
 * AWDP Training Ground（练习场）：
 * - `/training` 目录 + 开始训练（`gameboxCatalog` / `startTraining`）
 * - `/training/runs/:runId` run 工作台（生命周期 / 实例 / Break·Fix / 轮次评测 / 积分 / Writeup）
 *
 * 数据全部来自 `client.awdp.runs.*`；实时用 `useAwdpRunStream`。
 * 用户可见文案一律走 training 命名空间，技术标识（run / endpoint / ID）保持原文。
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowRight,
	Dumbbell,
	Loader2,
	Play,
	RefreshCw,
	Search,
	Square,
	StopCircle,
	Trophy,
} from "lucide-react";

import type { AwdpInstance, AwdpRunDto, GameBoxCatalogDto } from "@floatctf/sdk";

import { call, callList, callMaybe, callVoid } from "~/api/call";
import { isForbidden, isNotFound } from "~/api/errors";
import { useBindings, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { RealtimePill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable } from "~/components/app/data-table";
import {
	KeyValueList,
	MonoText,
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	StatCard,
} from "~/components/app/page";
import {
	EmptyBlock,
	ErrorBlock,
	LoadingBlock,
	PermissionDeniedBlock,
	QueryState,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatBytes, formatDateTime, formatDuration, formatInt, formatScore } from "~/lib/format";
import { useDebouncedValue, useDocumentTitle } from "~/lib/hooks";

import {
	RunPhaseSteps,
	RunRoundsEvaluationsPanel,
	RunScoresPanel,
	RunWriteupPanel,
	TrainingActionPanel,
	TrainingInstancePanel,
} from "./components";
import {
	endRunGate,
	restartTrainingGate,
	runEndConsequences,
	runInstanceResetConsequences,
	runPhaseLabel,
	runPhaseTone,
	runResetConsequences,
	runRestartConsequences,
	runSetPhaseBreakConsequences,
	runSetPhaseFixConsequences,
	runStopConsequences,
	setPhaseGate,
	startRunGate,
} from "./domain";

// ────────────────────────────────────────────────────────────────────────────
// 目录
// ────────────────────────────────────────────────────────────────────────────

export function TrainingCatalogPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("training.catalog.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(12);
	const [search, setSearch] = useState("");
	const debounced = useDebouncedValue(search, 300);
	const filter = debounced.trim() ? `name:${debounced.trim()}` : undefined;
	const params = useMemo(
		() => ({ page, limit: pageSize, ...(filter ? { filter } : {}) }),
		[page, pageSize, filter],
	);

	const query = useQuery({
		queryKey: qk.runs.catalog(params),
		queryFn: () => callList<GameBoxCatalogDto>(client.awdp.runs.gameboxCatalog(params)),
		// 目录里的 active_training / solved 会随 run 生命周期变化：回到本页必须重新取。
		staleTime: 0,
	});

	const startMutation = useMutation({
		mutationFn: (gameboxId: string) =>
			call<AwdpRunDto>(client.awdp.runs.startTraining(gameboxId), "开始训练"),
		onSuccess: (run) => {
			toast.success(
				t("training.catalog.toast.started"),
				t("training.catalog.toast.startedDescription"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.runs.catalog(params) });
			void navigate(`/training/runs/${run.run_id}`);
		},
		onError: (error) => toast.apiError(t("training.catalog.toast.startFailed"), error),
	});

	const result = query.data;
	const startingGameboxId = startMutation.isPending ? startMutation.variables : undefined;

	const startButton = (row: GameBoxCatalogDto): ReactNode =>
		row.active_training ? (
			<Button size="sm" asChild>
				<Link to={`/training/runs/${row.active_training.run_id}`}>
					<Play aria-hidden="true" />
					{t("training.catalog.actions.continue")}
				</Link>
			</Button>
		) : (
			<Button
				size="sm"
				disabled={startMutation.isPending}
				onClick={() => startMutation.mutate(row.id)}
			>
				{startingGameboxId === row.id ? (
					<Loader2 className="animate-spin" aria-hidden="true" />
				) : (
					<Dumbbell aria-hidden="true" />
				)}
				{t("training.catalog.actions.start")}
			</Button>
		);

	return (
		<PageBody>
			<PageHeader
				title={t("training.catalog.title")}
				description={t("training.catalog.description")}
				actions={
					<Button variant="outline" asChild>
						<Link to="/events">
							{t("training.catalog.eventsAction")}
							<ArrowRight aria-hidden="true" />
						</Link>
					</Button>
				}
			/>

			<SectionCard
				title={t("training.catalog.section.title")}
				description={t("training.catalog.section.description")}
				actions={
					<div className="flex items-center gap-2">
						<div className="relative w-44 sm:w-56">
							<Search
								className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
								aria-hidden="true"
							/>
							<Input
								value={search}
								placeholder={t("training.catalog.search.placeholder")}
								aria-label={t("training.catalog.search.ariaLabel")}
								className="pl-8"
								onChange={(event) => {
									setSearch(event.target.value);
									setPage(1);
								}}
							/>
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("training.catalog.refresh")}
							title={t("training.catalog.refresh")}
							onClick={() => void query.refetch()}
						>
							<RefreshCw />
						</Button>
					</div>
				}
				footer={
					result ? (
						<PaginationBar
							page={page}
							pageSize={pageSize}
							total={result.meta.total ?? result.items.length}
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
					errorTitle={t("training.catalog.loadError")}
					isEmpty={(data) => data.items.length === 0}
					empty={
						<EmptyBlock
							title={
								filter
									? t("training.catalog.filtered.title")
									: t("training.catalog.empty.title")
							}
							description={
								filter
									? t("training.catalog.filtered.description")
									: t("training.catalog.empty.description")
							}
							variant={filter ? "filtered" : "empty"}
							action={
								filter ? (
									<Button size="sm" variant="outline" onClick={() => setSearch("")}>
										{t("training.catalog.filtered.clear")}
									</Button>
								) : undefined
							}
						/>
					}
				>
					{(data) => (
						<DataTable
							data={data.items}
							getRowId={(row) => row.id}
							columns={[
								{
									id: "name",
									header: t("training.catalog.columns.gamebox"),
									sortValue: (row) => row.name,
									cell: (row) => (
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">{row.name}</p>
											<p className="line-clamp-1 text-xs text-muted-foreground">
												{row.description || t("training.catalog.noDescription")}
											</p>
										</div>
									),
								},
								{
									id: "category",
									header: t("training.catalog.columns.category"),
									sortValue: (row) => row.category,
									cell: (row) => (
										<span className="text-sm">{row.category || "—"}</span>
									),
								},
								{
									id: "author",
									header: t("training.catalog.columns.author"),
									hideBelow: "md",
									sortValue: (row) => row.author ?? "",
									cell: (row) => (
										<span className="text-sm text-muted-foreground">
											{row.author || "—"}
										</span>
									),
								},
								{
									id: "resources",
									header: t("training.catalog.columns.resources"),
									hideBelow: "lg",
									cell: (row) => (
										<span className="tnum font-mono text-xs text-muted-foreground">
											{t("training.catalog.resourcesValue", {
												cpu: row.recommended_cpu_millis,
												memory: formatBytes(row.recommended_memory_bytes),
												pids: row.recommended_pids_limit,
											})}
										</span>
									),
								},
								{
									id: "state",
									header: t("training.catalog.columns.state"),
									cell: (row) => (
										<span className="flex flex-wrap items-center gap-1">
											{row.solved ? (
												<TonePill tone="success">
													{t("training.catalog.state.trained")}
												</TonePill>
											) : null}
											{row.active_training ? (
												<TonePill tone="info" className="tnum">
													{t("training.catalog.state.active", {
														phase: runPhaseLabel(
															row.active_training.phase,
															t,
														),
														score: formatScore(
															row.active_training.score,
														),
													})}
												</TonePill>
											) : null}
											{!row.solved && !row.active_training ? (
												<TonePill tone="muted">
													{t("training.catalog.state.notStarted")}
												</TonePill>
											) : null}
										</span>
									),
								},
								{
									id: "updated",
									header: t("training.catalog.columns.updated"),
									hideBelow: "md",
									sortValue: (row) => row.updated_at ?? "",
									cell: (row) => (
										<span className="tnum text-xs text-muted-foreground">
											{row.updated_at
												? formatDateTime(row.updated_at, { seconds: true })
												: "—"}
										</span>
									),
								},
							]}
							rowActions={(row) => startButton(row)}
							mobileCard={(row) => (
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-2">
										<span className="min-w-0 truncate text-sm font-medium">
											{row.name}
										</span>
										<TonePill
											tone={
												row.active_training
													? "info"
													: row.solved
														? "success"
														: "muted"
											}
										>
											{row.active_training
												? t("training.catalog.state.activeShort", {
														phase: runPhaseLabel(
															row.active_training.phase,
															t,
														),
													})
												: row.solved
													? t("training.catalog.state.trained")
													: t("training.catalog.state.notStarted")}
										</TonePill>
									</div>
									<p className="line-clamp-2 text-xs text-muted-foreground">
										{row.description || t("training.catalog.noDescription")}
									</p>
									<div className="flex justify-end">
										{row.active_training ? (
											<Button size="sm" asChild>
												<Link
													to={`/training/runs/${row.active_training.run_id}`}
												>
													<Play aria-hidden="true" />
													{t("training.catalog.actions.continue")}
												</Link>
											</Button>
										) : (
											<Button
												size="sm"
												disabled={startMutation.isPending}
												onClick={() => startMutation.mutate(row.id)}
											>
												{startingGameboxId === row.id ? (
													<Loader2
														className="animate-spin"
														aria-hidden="true"
													/>
												) : (
													<Dumbbell aria-hidden="true" />
												)}
												{t("training.catalog.actions.start")}
											</Button>
										)}
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

// ────────────────────────────────────────────────────────────────────────────
// Run 工作台
// ────────────────────────────────────────────────────────────────────────────

export function TrainingRunPage(): ReactNode {
	const { t } = useTranslation();
	const { runId = "" } = useParams<{ runId: string }>();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const navigate = useNavigate();
	const { useAwdpRunStream } = useBindings();
	const stream = useAwdpRunStream({ runId, enabled: Boolean(runId) });

	const runQuery = useQuery({
		queryKey: qk.runs.run(runId),
		queryFn: () => call<AwdpRunDto>(client.awdp.runs.getRun(runId), "训练 Run"),
		enabled: Boolean(runId),
		retry: false,
	});

	const run = runQuery.data;
	useDocumentTitle(
		run
			? t("training.run.documentTitle", { name: run.gamebox_name })
			: t("training.run.documentTitleFallback"),
	);

	const gameboxId = run?.gamebox_id ?? "";

	// 实例详情：key 以 qk.runs.instance(runId) 为前缀，保持 qk 失效语义。
	const instanceQuery = useQuery({
		queryKey: [...qk.runs.instance(runId), gameboxId],
		queryFn: () =>
			callMaybe<AwdpInstance>(client.awdp.runs.getInstance(runId, gameboxId), "实例详情"),
		enabled: Boolean(runId) && Boolean(gameboxId),
		retry: false,
	});

	// 两个来源：run DTO 的实例快照（SSE 会失效 `awdp-run`）与 getInstance（动作后 / 手动刷新）。
	// 取 dataUpdatedAt 更新的一方，避免 SSE 已刷新的 run 快照被缓存的 getInstance 覆盖。
	const runInstance = run?.instances[0] ?? null;
	const instanceFromRun: AwdpInstance | null = runInstance
		? {
				instance_id: runInstance.instance_id,
				runtime_state: runInstance.runtime_state,
				runtime_generation: runInstance.runtime_generation,
				reset_count: runInstance.reset_count,
				endpoints: runInstance.endpoints,
			}
		: null;
	const instance: AwdpInstance | null =
		instanceQuery.dataUpdatedAt >= runQuery.dataUpdatedAt
			? (instanceQuery.data ?? null)
			: instanceFromRun;

	const refreshAll = useCallback(() => {
		for (const key of [
			qk.runs.run(runId),
			qk.runs.instance(runId),
			qk.runs.rounds(runId),
			qk.runs.evaluations(runId),
			qk.runs.scores(runId),
			qk.runs.writeup(runId),
		]) {
			void queryClient.invalidateQueries({ queryKey: key });
		}
	}, [queryClient, runId]);

	const startMutation = useMutation({
		mutationFn: () => call<AwdpRunDto>(client.awdp.runs.startRun(runId), "开始训练"),
		onSuccess: () => {
			toast.success(t("training.run.toasts.started"));
			refreshAll();
		},
		onError: (error) => toast.apiError(t("training.run.toasts.startFailed"), error),
	});

	const stopMutation = useMutation({
		mutationFn: () => callVoid(client.awdp.runs.stopRun(runId), "停止实例"),
		onSuccess: () => {
			toast.success(t("training.run.toasts.stopped"));
			refreshAll();
		},
		onError: (error) => toast.apiError(t("training.run.toasts.stopFailed"), error),
	});

	const resetMutation = useMutation({
		mutationFn: () => call<AwdpRunDto>(client.awdp.runs.resetRun(runId), "重置 run"),
		onSuccess: () => {
			toast.success(t("training.run.toasts.reset"));
			refreshAll();
		},
		onError: (error) => toast.apiError(t("training.run.toasts.resetFailed"), error),
	});

	const endMutation = useMutation({
		mutationFn: () => call<AwdpRunDto>(client.awdp.runs.endRun(runId), "结束训练"),
		onSuccess: () => {
			toast.success(
				t("training.run.toasts.ended"),
				t("training.run.toasts.endedDescription"),
			);
			refreshAll();
		},
		onError: (error) => toast.apiError(t("training.run.toasts.endFailed"), error),
	});

	const restartMutation = useMutation({
		mutationFn: () => call<AwdpRunDto>(client.awdp.runs.restartTraining(runId), "再次训练"),
		onSuccess: (next) => {
			toast.success(t("training.run.toasts.restarted"));
			void navigate(`/training/runs/${next.run_id}`);
		},
		onError: (error) => toast.apiError(t("training.run.toasts.restartFailed"), error),
	});

	const phaseMutation = useMutation({
		mutationFn: (target: "break" | "fix") =>
			call<AwdpRunDto>(client.awdp.runs.setPhase(runId, target), "切换阶段"),
		onSuccess: (next, target) => {
			toast.success(
				target === "fix"
					? t("training.run.toasts.phaseFix")
					: t("training.run.toasts.phaseBreak"),
			);
			// 切换阶段可能新建/回卷 run 数据，直接以返回值刷新缓存。
			queryClient.setQueryData(qk.runs.run(runId), next);
			refreshAll();
		},
		onError: (error) => toast.apiError(t("training.run.toasts.phaseFailed"), error),
	});

	const instanceMutation = useMutation({
		mutationFn: async (action: "start" | "stop" | "reset") => {
			if (action === "start") {
				return await call<AwdpInstance>(
					client.awdp.runs.startInstance(runId, gameboxId),
					"启动实例",
				);
			}
			if (action === "stop") {
				await callVoid(client.awdp.runs.stopInstance(runId, gameboxId), "停止实例");
				return null;
			}
			return await call<AwdpInstance>(
				client.awdp.runs.resetInstance(runId, gameboxId),
				"重置实例",
			);
		},
		onSuccess: (_result, action) => {
			toast.success(
				action === "start"
					? t("training.run.toasts.instanceStarted")
					: action === "stop"
						? t("training.run.toasts.instanceStopped")
						: t("training.run.toasts.instanceReset"),
			);
			refreshAll();
		},
		onError: (error) => toast.apiError(t("training.run.toasts.instanceFailed"), error),
	});

	if (!runId) {
		return (
			<PageBody>
				<EmptyBlock
					title={t("training.run.missing.title")}
					description={t("training.run.missing.description")}
				/>
			</PageBody>
		);
	}

	return (
		<PageBody>
			<PageHeader
				title={run ? run.gamebox_name : t("training.run.titleFallback")}
				description={run?.gamebox_description || t("training.run.descriptionFallback")}
				breadcrumbs={
					<nav className="flex items-center gap-1.5">
						<Link to="/training" className="hover:underline">
							{t("training.run.breadcrumb.training")}
						</Link>
						<span>/</span>
						<span className="text-foreground">
							{t("training.run.breadcrumb.run", { id: runId.slice(0, 8) })}
						</span>
					</nav>
				}
				badge={
					run ? (
						<TonePill tone={runPhaseTone(run.phase)}>
							{runPhaseLabel(run.phase, t)}
						</TonePill>
					) : null
				}
				actions={
					<RealtimePill
						state={stream.connectionState}
						onRefresh={() => {
							stream.invalidateRun();
							refreshAll();
						}}
					/>
				}
			/>

			{runQuery.isPending ? (
				<LoadingBlock label={t("training.run.loading")} />
			) : runQuery.isError ? (
				isForbidden(runQuery.error) ? (
					<PermissionDeniedBlock description={t("training.run.forbidden")} />
				) : isNotFound(runQuery.error) ? (
					<EmptyBlock
						title={t("training.run.notFound.title")}
						description={t("training.run.notFound.description")}
						action={
							<Button variant="outline" size="sm" asChild>
								<Link to="/training">{t("training.run.notFound.back")}</Link>
							</Button>
						}
					/>
				) : (
					<ErrorBlock
						error={runQuery.error}
						title={t("training.run.loadError")}
						onRetry={() => void runQuery.refetch()}
					/>
				)
			) : run ? (
				(() => {
					const startGate = startRunGate(run.phase, t);
					const endGate = endRunGate(run.phase, t);
					const restartGate = restartTrainingGate(run.phase, t);
					const toFixGate = setPhaseGate(run.phase, "fix", t);
					const toBreakGate = setPhaseGate(run.phase, "break", t);
					const lifecycleBusy =
						startMutation.isPending ||
						stopMutation.isPending ||
						resetMutation.isPending ||
						endMutation.isPending ||
						restartMutation.isPending ||
						phaseMutation.isPending;
					const instanceBusy = instanceMutation.isPending;

					return (
						<div className="space-y-5">
							<SectionCard
								title={t("training.run.phaseSection.title")}
								description={t("training.run.phaseSection.description")}
								actions={
									run.next_action_at ? (
										<span className="tnum text-xs text-muted-foreground">
											{t("training.run.phaseSection.nextAction", {
												time: formatDateTime(run.next_action_at, {
													seconds: true,
												}),
											})}
										</span>
									) : null
								}
							>
								<RunPhaseSteps
									phase={run.phase}
									currentRound={run.current_round}
									totalRounds={run.total_rounds}
									nextActionAt={run.next_action_at}
								/>

								<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
									<StatCard
										label={t("training.run.stats.myScore")}
										value={formatScore(run.my_score)}
										hint={t("training.run.stats.myScoreHint")}
										icon={<Trophy className="size-4" aria-hidden="true" />}
										tone="success"
									/>
									<StatCard
										label={t("training.run.stats.currentRound")}
										value={`${formatInt(run.current_round)} / ${formatInt(run.total_rounds)}`}
										hint={t("training.run.stats.currentRoundHint")}
									/>
									<StatCard
										label={t("training.run.stats.penalty")}
										value={formatScore(run.fix_round_penalty)}
										hint={t("training.run.stats.penaltyHint")}
									/>
									<StatCard
										label={t("training.run.stats.durations")}
										value={`${formatDuration(run.break_duration_secs)} / ${formatDuration(run.fix_duration_secs)}`}
										hint={t("training.run.stats.durationsHint", {
											duration: formatDuration(run.fix_round_interval_secs),
										})}
									/>
								</div>

								<KeyValueList
									className="mt-4"
									columns={3}
									items={[
										{
											key: t("training.run.fields.breakScore"),
											value: (
												<span className="tnum">
													{formatScore(run.break_score)}
												</span>
											),
										},
										{
											key: t("training.run.fields.fixRoundScore"),
											value: (
												<span className="tnum">
													{formatScore(run.fix_round_score)}
												</span>
											),
										},
										{
											key: t("training.run.fields.startedAt"),
											value: run.started_at ? (
												<span className="tnum">
													{formatDateTime(run.started_at, {
														seconds: true,
													})}
												</span>
											) : (
												<span className="text-muted-foreground">
													{t("training.run.fields.notStarted")}
												</span>
											),
										},
										{
											key: t("training.run.fields.fixStartedAt"),
											value: run.fix_started_at ? (
												<span className="tnum">
													{formatDateTime(run.fix_started_at, {
														seconds: true,
													})}
												</span>
											) : (
												<span className="text-muted-foreground">
													{t("training.run.fields.notStarted")}
												</span>
											),
										},
										{
											key: t("training.run.fields.finishedAt"),
											value: run.finished_at ? (
												<span className="tnum">
													{formatDateTime(run.finished_at, {
														seconds: true,
													})}
												</span>
											) : (
												<span className="text-muted-foreground">
													{t("training.run.fields.notFinished")}
												</span>
											),
										},
										{
											key: t("training.run.fields.sourceDir"),
											value: run.source_code_dir ? (
												<MonoText>{run.source_code_dir}</MonoText>
											) : (
												<span className="text-muted-foreground">
													{t("training.run.fields.sourceDirHint")}
												</span>
											),
										},
									]}
								/>

								<div className="mt-4 flex flex-wrap items-center gap-2">
									<Button
										size="sm"
										disabled={!startGate.allowed || lifecycleBusy}
										title={
											startGate.allowed
												? t("training.run.lifecycle.startTitle")
												: startGate.reason
										}
										onClick={() => startMutation.mutate()}
									>
										{startMutation.isPending ? (
											<Loader2 className="animate-spin" aria-hidden="true" />
										) : (
											<Play aria-hidden="true" />
										)}
										{t("training.run.lifecycle.start")}
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={lifecycleBusy}
										title={t("training.run.lifecycle.stopTitle")}
										onClick={async () => {
											const ok = await confirm({
												title: t("training.confirm.stopRun.title"),
												description: t(
													"training.confirm.stopRun.description",
												),
												consequences: runStopConsequences(t),
												tone: "danger",
												confirmText: t(
													"training.confirm.stopRun.confirmText",
												),
											});
											if (ok) stopMutation.mutate();
										}}
									>
										{stopMutation.isPending ? (
											<Loader2 className="animate-spin" aria-hidden="true" />
										) : (
											<Square aria-hidden="true" />
										)}
										{t("training.run.lifecycle.stop")}
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={lifecycleBusy}
										title={t("training.run.lifecycle.resetTitle")}
										onClick={async () => {
											const ok = await confirm({
												title: t("training.confirm.resetRun.title"),
												description: t(
													"training.confirm.resetRun.description",
												),
												consequences: runResetConsequences(t),
												tone: "danger",
												confirmText: t(
													"training.confirm.resetRun.confirmText",
												),
											});
											if (ok) resetMutation.mutate();
										}}
									>
										{resetMutation.isPending ? (
											<Loader2 className="animate-spin" aria-hidden="true" />
										) : (
											<RefreshCw aria-hidden="true" />
										)}
										{t("training.run.lifecycle.reset")}
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={!endGate.allowed || lifecycleBusy}
										title={
											endGate.allowed
												? t("training.run.lifecycle.endTitle")
												: endGate.reason
										}
										onClick={async () => {
											const ok = await confirm({
												title: t("training.confirm.endRun.title"),
												description: t(
													"training.confirm.endRun.description",
												),
												consequences: runEndConsequences(t),
												tone: "danger",
												confirmText: t(
													"training.confirm.endRun.confirmText",
												),
											});
											if (ok) endMutation.mutate();
										}}
									>
										{endMutation.isPending ? (
											<Loader2 className="animate-spin" aria-hidden="true" />
										) : (
											<StopCircle aria-hidden="true" />
										)}
										{t("training.run.lifecycle.end")}
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={!restartGate.allowed || lifecycleBusy}
										title={
											restartGate.allowed
												? t("training.run.lifecycle.restartTitle")
												: restartGate.reason
										}
										onClick={async () => {
											const ok = await confirm({
												title: t("training.confirm.restart.title"),
												description: t(
													"training.confirm.restart.description",
												),
												consequences: runRestartConsequences(t),
												confirmText: t(
													"training.confirm.restart.confirmText",
												),
											});
											if (ok) restartMutation.mutate();
										}}
									>
										{restartMutation.isPending ? (
											<Loader2 className="animate-spin" aria-hidden="true" />
										) : (
											<Dumbbell aria-hidden="true" />
										)}
										{t("training.run.lifecycle.restart")}
									</Button>
									{endGate.allowed ? (
										<Button
											variant="ghost"
											size="sm"
											asChild
											title={t("training.run.lifecycle.backTitle")}
										>
											<Link to="/training">
												{t("training.run.lifecycle.back")}
											</Link>
										</Button>
									) : null}
								</div>

								{!startGate.allowed ||
								!endGate.allowed ||
								!restartGate.allowed ? (
									<ul className="mt-2 space-y-1 text-xs text-muted-foreground">
										{!startGate.allowed ? (
											<li>
												{t("training.run.lifecycle.blocked.start", {
													reason: startGate.reason,
												})}
											</li>
										) : null}
										{!endGate.allowed ? (
											<li>
												{t("training.run.lifecycle.blocked.end", {
													reason: endGate.reason,
												})}
											</li>
										) : null}
										{!restartGate.allowed ? (
											<li>
												{t("training.run.lifecycle.blocked.restart", {
													reason: restartGate.reason,
												})}
											</li>
										) : null}
									</ul>
								) : null}

								<div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
									<span className="text-xs text-muted-foreground">
										{t("training.run.phaseSwitch.label")}
									</span>
									<Button
										variant="outline"
										size="sm"
										disabled={!toFixGate.allowed || lifecycleBusy}
										title={
											toFixGate.allowed
												? t("training.run.phaseSwitch.toFixTitle")
												: toFixGate.reason
										}
										onClick={async () => {
											const ok = await confirm({
												title: t("training.confirm.toFix.title"),
												description: t(
													"training.confirm.toFix.description",
												),
												consequences: runSetPhaseFixConsequences(t),
												tone: "danger",
												confirmText: t(
													"training.confirm.toFix.confirmText",
												),
											});
											if (ok) phaseMutation.mutate("fix");
										}}
									>
										{phaseMutation.isPending &&
										phaseMutation.variables === "fix" ? (
											<Loader2 className="animate-spin" aria-hidden="true" />
										) : null}
										{t("training.run.phaseSwitch.toFix")}
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={!toBreakGate.allowed || lifecycleBusy}
										title={
											toBreakGate.allowed
												? t("training.run.phaseSwitch.toBreakTitle")
												: toBreakGate.reason
										}
										onClick={async () => {
											const ok = await confirm({
												title: t("training.confirm.toBreak.title"),
												description: t(
													"training.confirm.toBreak.description",
												),
												consequences: runSetPhaseBreakConsequences(t),
												tone: "danger",
												confirmText: t(
													"training.confirm.toBreak.confirmText",
												),
											});
											if (ok) phaseMutation.mutate("break");
										}}
									>
										{phaseMutation.isPending &&
										phaseMutation.variables === "break" ? (
											<Loader2 className="animate-spin" aria-hidden="true" />
										) : null}
										{t("training.run.phaseSwitch.toBreak")}
									</Button>
									{!toFixGate.allowed ? (
										<span className="text-xs text-muted-foreground">
											{toFixGate.reason}
										</span>
									) : null}
								</div>
							</SectionCard>

							<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.2fr)]">
								<TrainingInstancePanel
									gameboxName={run.gamebox_name}
									broken={runInstance?.broken ?? false}
									instance={instance}
									isPending={Boolean(gameboxId) && instanceQuery.isPending}
									isError={instanceQuery.isError}
									error={instanceQuery.error}
									judgeEndpoint={run.judge_endpoint}
									busy={instanceBusy}
									pendingAction={
										instanceMutation.isPending
											? (instanceMutation.variables ?? null)
											: null
									}
									refreshing={instanceQuery.isFetching && !instanceQuery.isPending}
									phase={run.phase}
									onStart={() => instanceMutation.mutate("start")}
									onStop={async () => {
										const ok = await confirm({
											title: t("training.confirm.stopInstance.title"),
											description: t(
												"training.confirm.stopInstance.description",
											),
											consequences: runStopConsequences(t),
											tone: "danger",
											confirmText: t(
												"training.confirm.stopInstance.confirmText",
											),
										});
										if (ok) instanceMutation.mutate("stop");
									}}
									onReset={async () => {
										const ok = await confirm({
											title: t("training.confirm.resetInstance.title"),
											description: t(
												"training.confirm.resetInstance.description",
											),
											consequences: runInstanceResetConsequences(t),
											tone: "danger",
											confirmText: t(
												"training.confirm.resetInstance.confirmText",
											),
										});
										if (ok) instanceMutation.mutate("reset");
									}}
									onRefresh={() => void instanceQuery.refetch()}
								/>

								<TrainingActionPanel
									runId={runId}
									gameboxId={gameboxId}
									phase={run.phase}
									instance={instance}
									onChanged={refreshAll}
								/>

								<RunRoundsEvaluationsPanel runId={runId} />
							</div>

							<SectionCard
								title={t("training.run.scoresSection.title")}
								description={t("training.run.scoresSection.description")}
							>
								<Tabs defaultValue="scores">
									<TabsList>
										<TabsTrigger value="scores">
											{t("training.run.scoresSection.scoresTab")}
										</TabsTrigger>
										<TabsTrigger value="writeup">
											{t("training.run.scoresSection.writeupTab")}
										</TabsTrigger>
									</TabsList>
									<TabsContent value="scores" className="pt-3">
										<RunScoresPanel runId={runId} />
									</TabsContent>
									<TabsContent value="writeup" className="pt-3">
										<RunWriteupPanel runId={runId} />
									</TabsContent>
								</Tabs>
							</SectionCard>
						</div>
					);
				})()
			) : null}
		</PageBody>
	);
}
