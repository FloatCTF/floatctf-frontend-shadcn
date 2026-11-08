/**
 * AWDP 工作台的域内组件 —— 阶段步进条 / 我的靶机 / 实例卡 / Break·Fix 动作区 /
 * 轮次与评测 / 积分榜矩阵 / 趋势。
 *
 * 组件只做展示与各自的数据读取；`overview` 的取数与实例生命周期动作由页面持有，
 * 以保证「选中的靶机」在两列之间一致。
 *
 * 文案全部走 i18n（`awdp.*`），阶段 / 状态判定来自 `./domain`（SDK `AwdpPhase` 与后端 status）。
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	CheckCircle2,
	ChevronRight,
	Download,
	FileUp,
	FlaskConical,
	Play,
	RefreshCw,
	RotateCcw,
	Square,
	Terminal,
	TriangleAlert,
	XCircle,
} from "lucide-react";

import type {
	AwdpEvaluationDto,
	AwdpGameBox,
	AwdpInstance,
	AwdpOverview,
	AwdpRoundDto,
	AwdpScoreRow,
	AwdpScoreboardDetail,
	AwdpTrendItem,
	BreakSubmitResponse,
	ManualCheckDto,
	PatchSubmitResponse,
} from "@floatctf/sdk";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { TrendChart } from "~/components/app/charts";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field } from "~/components/app/form";
import { CopyText, MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	formatDateTime,
	formatDuration,
	formatInt,
	formatPoints,
	formatTime,
} from "~/lib/format";
import { useNow } from "~/lib/hooks";
import { cn } from "~/lib/utils";

import {
	AWDP_PHASE_ORDER,
	awdpBreakGate,
	awdpEvaluationKindLabel,
	awdpEvaluationLabel,
	awdpEvaluationTone,
	awdpInstanceControlGate,
	awdpPatchGate,
	awdpPhaseIndex,
	awdpPhaseLabel,
	awdpPhaseTone,
	awdpRoundStatusLabel,
	awdpRoundStatusTone,
	awdpRuntimeLabel,
	awdpRuntimeTone,
	awdpSourceGate,
	awdpTestCheckGate,
} from "./domain";

/** 门禁原因条：显式解释「为什么现在不能操作」，不用红色错误样式（那是用户可纠正的错误）。 */
function GateNotice({ reason }: { reason: string }): ReactNode {
	return (
		<div
			role="status"
			className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
		>
			<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>{reason}</span>
		</div>
	);
}

/** 阶段步进条：pending → Break → 准备 Fix（过渡）→ Fix → 已结束。 */
export function AwdpPhaseSteps({
	phase,
	currentRound,
	totalRounds,
	nextActionAt,
}: {
	phase: AwdpOverview["phase"];
	totalRounds: number;
	currentRound: number;
	nextActionAt: string | null;
}): ReactNode {
	const { t } = useTranslation();
	const currentIndex = awdpPhaseIndex(phase);
	const now = useNow(1000);
	const remaining = (() => {
		if (!nextActionAt) return null;
		const target = Date.parse(nextActionAt);
		if (!Number.isFinite(target)) return null;
		return Math.max(0, Math.floor((target - now.getTime()) / 1000));
	})();

	return (
		<div className="space-y-3">
			<ol
				className="flex flex-wrap items-stretch gap-2"
				aria-label={t("awdp.phases.stepsLabel")}
			>
				{AWDP_PHASE_ORDER.map((step, index) => {
					const done = currentIndex > index;
					const active = currentIndex === index;
					return (
						<li key={step} className="flex items-center gap-2">
							<TonePill
								tone={active ? awdpPhaseTone(step) : done ? "success" : "muted"}
								className={active ? "ring-1 ring-current" : undefined}
							>
								{awdpPhaseLabel(step, t)}
							</TonePill>
							{index < AWDP_PHASE_ORDER.length - 1 ? (
								<ChevronRight
									className="size-4 text-muted-foreground"
									aria-hidden="true"
								/>
							) : null}
						</li>
					);
				})}
			</ol>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
				{phase === "fix" ? (
					<span className="tnum">
						{t("awdp.phases.roundProgress", {
							current: formatInt(currentRound),
							total: formatInt(totalRounds),
						})}
					</span>
				) : null}
				{remaining !== null && (phase === "break" || phase === "fix") ? (
					<span className="tnum">
						{phase === "break"
							? t("awdp.phases.breakRemaining", {
									duration: formatDuration(remaining),
								})
							: t("awdp.phases.nextRoundCountdown", {
									duration: formatDuration(remaining),
								})}
					</span>
				) : null}
				{nextActionAt ? (
					<span className="tnum">
						{t("awdp.phases.nextActionTime", {
							time: formatDateTime(nextActionAt, { seconds: true }),
						})}
					</span>
				) : null}
			</div>
			{phase === "preparing_fix" ? (
				<div
					className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
					role="status"
				>
					<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span>{t("awdp.phases.preparingFixNote")}</span>
				</div>
			) : null}
		</div>
	);
}

/** 左列：我的靶机（选择决定中间动作区与实例卡的对象）。 */
export function AwdpGameboxList({
	gameboxes,
	selectedId,
	onSelect,
}: {
	gameboxes: AwdpGameBox[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}): ReactNode {
	const { t } = useTranslation();
	if (gameboxes.length === 0) {
		return (
			<EmptyBlock
				title={t("awdp.gameboxes.emptyTitle")}
				description={t("awdp.gameboxes.emptyDescription")}
			/>
		);
	}
	return (
		<ul className="space-y-2">
			{gameboxes.map((gamebox) => {
				const active = gamebox.id === selectedId;
				return (
					<li key={gamebox.id}>
						<button
							type="button"
							onClick={() => onSelect(gamebox.id)}
							aria-pressed={active}
							className={cn(
								"w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
								active ? "border-primary bg-primary/5" : "hover:bg-muted/40",
							)}
						>
							<div className="flex items-center justify-between gap-2">
								<span
									className="min-w-0 truncate text-sm font-medium"
									title={gamebox.name}
								>
									{gamebox.name}
								</span>
								<span className="flex shrink-0 items-center gap-1">
									{gamebox.broken ? (
										<TonePill tone="danger">
											{t("awdp.gameboxes.broken")}
										</TonePill>
									) : (
										<TonePill tone="muted">
											{t("awdp.gameboxes.notBroken")}
										</TonePill>
									)}
									<TonePill tone={awdpRuntimeTone(gamebox.instance?.runtime_state)}>
										{awdpRuntimeLabel(gamebox.instance?.runtime_state, t)}
									</TonePill>
								</span>
							</div>
							<p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
								<span>{gamebox.category || t("awdp.gameboxes.unclassified")}</span>
								{gamebox.exposed.length > 0 ? (
									<>
										<span>·</span>
										<span>{t("awdp.gameboxes.exposed")}</span>
										{gamebox.exposed.map(([proto, port]) => (
											<MonoText
												key={`${proto}:${port}`}
												className="text-muted-foreground"
											>
												{proto}:{port}
											</MonoText>
										))}
									</>
								) : null}
								{gamebox.enabled ? null : (
									<TonePill tone="muted">{t("awdp.gameboxes.disabled")}</TonePill>
								)}
							</p>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

/** 实例生命周期卡（启动 / 停止 / 重置 / 刷新）—— 动作与门禁原因全部显式。 */
export function AwdpInstancePanel({
	gamebox,
	instance,
	isPending,
	isError,
	error,
	busy,
	onStart,
	onStop,
	onReset,
	onRefresh,
	phase,
}: {
	gamebox: AwdpGameBox | null;
	instance: AwdpInstance | null;
	isPending: boolean;
	isError: boolean;
	error: unknown;
	busy: boolean;
	onStart: () => void;
	onStop: () => void;
	onReset: () => void;
	onRefresh: () => void;
	phase: AwdpOverview["phase"];
}): ReactNode {
	const { t } = useTranslation();
	if (!gamebox) {
		return (
			<EmptyBlock
				title={t("awdp.instance.selectTitle")}
				description={t("awdp.instance.selectDescription")}
			/>
		);
	}
	const running = instance?.runtime_state === "running";
	const control = awdpInstanceControlGate(phase, t);

	return (
		<SectionCard
			title={t("awdp.instance.sectionTitle")}
			description={t("awdp.instance.sectionDescription", { name: gamebox.name })}
			actions={
				<Button
					variant="ghost"
					size="icon-xs"
					onClick={onRefresh}
					aria-label={t("awdp.instance.refresh")}
					title={t("awdp.instance.refresh")}
				>
					<RefreshCw />
				</Button>
			}
		>
			{isPending ? (
				<TableSkeleton rows={2} columns={2} />
			) : isError ? (
				<ErrorBlock
					error={error}
					title={t("awdp.states.loadInstance")}
					onRetry={onRefresh}
				/>
			) : (
				<div className="space-y-3">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<TonePill tone={awdpRuntimeTone(instance?.runtime_state)}>
							{awdpRuntimeLabel(instance?.runtime_state, t)}
						</TonePill>
						{instance ? (
							<>
								<span className="tnum text-xs text-muted-foreground">
									{t("awdp.instance.generation", {
										count: formatInt(instance.runtime_generation),
									})}
								</span>
								<span className="tnum text-xs text-muted-foreground">
									{t("awdp.instance.resets", {
										count: formatInt(instance.reset_count),
									})}
								</span>
							</>
						) : (
							<span className="text-xs text-muted-foreground">
								{t("awdp.instance.notStartedHint")}
							</span>
						)}
						<span className="text-xs text-muted-foreground">
							{t("awdp.phases.currentPhase", { phase: awdpPhaseLabel(phase, t) })}
						</span>
					</div>
					{!control.allowed ? <GateNotice reason={control.reason} /> : null}

					{instance && !running ? (
						<p className="text-xs text-muted-foreground">
							{t("awdp.instance.endpointsOffline")}
						</p>
					) : null}

					{instance && instance.endpoints.length > 0 ? (
						<ul className="space-y-1.5">
							{instance.endpoints.map((endpoint) => {
								const url = `${endpoint.protocol}://${endpoint.public_host}:${endpoint.public_port}`;
								return (
									<li
										key={`${endpoint.protocol}:${endpoint.public_port}`}
										className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
									>
										<Terminal
											className="size-4 shrink-0 text-muted-foreground"
											aria-hidden="true"
										/>
										<CopyText value={url} label={t("awdp.instance.endpointLabel")} />
										<span className="tnum text-xs text-muted-foreground">
											{t("awdp.instance.containerPort", {
												port: endpoint.container_port,
											})}
										</span>
									</li>
								);
							})}
						</ul>
					) : (
						<p className="text-xs text-muted-foreground">
							{t("awdp.instance.endpointsEmpty")}
						</p>
					)}

					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={busy || running || !control.allowed}
							onClick={onStart}
							title={
								!control.allowed
									? control.reason
									: running
										? t("awdp.instance.startRunning")
										: t("awdp.instance.startHint")
							}
						>
							<Play />
							{t("awdp.instance.start")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={busy || !running || !control.allowed}
							onClick={onStop}
							title={
								!control.allowed
									? control.reason
									: running
										? t("awdp.instance.stopHint")
										: t("awdp.instance.stopNotRunning")
							}
						>
							<Square />
							{t("awdp.instance.stop")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={busy || !instance || !control.allowed}
							onClick={onReset}
							title={
								!control.allowed
									? control.reason
									: instance
										? t("awdp.instance.resetHint")
										: t("awdp.instance.resetMissing")
							}
						>
							<RotateCcw />
							{t("awdp.instance.reset")}
						</Button>
					</div>
				</div>
			)}
		</SectionCard>
	);
}

/** 自检结果的一行：颜色 + 图标 + 文字同时表达状态（颜色不单独承载信息）。 */
function CheckLine({
	label,
	ok,
	invert = false,
	trueText,
	falseText,
	notExecutedText,
}: {
	label: string;
	ok: boolean | null;
	invert?: boolean;
	trueText: string;
	falseText: string;
	notExecutedText?: string;
}): ReactNode {
	const { t } = useTranslation();
	if (ok === null) {
		return (
			<li className="flex flex-wrap items-center gap-2">
				<TonePill tone="muted">{t("awdp.actions.notExecuted")}</TonePill>
				<span>
					{t("awdp.actions.checkLine", {
						label,
						value: notExecutedText ?? t("awdp.actions.notExecuted"),
					})}
				</span>
			</li>
		);
	}
	const good = invert ? !ok : ok;
	return (
		<li className="flex flex-wrap items-center gap-2">
			{good ? (
				<CheckCircle2
					className="size-4 text-emerald-600 dark:text-emerald-400"
					aria-hidden="true"
				/>
			) : (
				<XCircle className="size-4 text-destructive" aria-hidden="true" />
			)}
			<span>{t("awdp.actions.checkLine", { label, value: ok ? trueText : falseText })}</span>
		</li>
	);
}

function CheckDetail({ label, detail }: { label: string; detail: string | null }): ReactNode {
	if (!detail) return null;
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground">{label}</p>
			<pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] break-words whitespace-pre-wrap">
				{detail}
			</pre>
		</div>
	);
}

/** Test Check 结果：healthcheck / judge / exploit 三项如实展示后端返回值。 */
function CheckResult({ result }: { result: ManualCheckDto }): ReactNode {
	const { t } = useTranslation();
	return (
		<div className="space-y-2 rounded-lg border px-3 py-2 text-xs" role="status">
			<p className="font-medium">
				<Trans
					i18nKey="awdp.actions.checkResult"
					values={{ id: result.evaluation_id }}
					components={{ mono: <MonoText>{null}</MonoText> }}
				/>
			</p>
			<ul className="space-y-1">
				<CheckLine
					label={t("awdp.actions.healthcheck")}
					ok={result.healthcheck_ok}
					trueText={t("awdp.actions.passed")}
					falseText={t("awdp.actions.failed")}
				/>
				<CheckLine
					label={t("awdp.actions.judge")}
					ok={result.judge_ok}
					trueText={t("awdp.actions.passed")}
					falseText={t("awdp.actions.failed")}
				/>
				<CheckLine
					label={t("awdp.actions.exploit")}
					ok={result.exploit_ok}
					invert
					trueText={t("awdp.actions.exploitStillVulnerable")}
					falseText={t("awdp.actions.exploitNotExploitable")}
					notExecutedText={t("awdp.actions.exploitNotReached")}
				/>
			</ul>
			<CheckDetail
				label={t("awdp.actions.healthcheckDetail")}
				detail={result.healthcheck_detail?.join("\n") ?? null}
			/>
			<CheckDetail label={t("awdp.actions.judgeDetail")} detail={result.judge_detail} />
			<CheckDetail label={t("awdp.actions.exploitDetail")} detail={result.exploit_detail} />
		</div>
	);
}

/**
 * 中列：Break / Fix 动作区。
 * - Break：提交 flag（仅 Break 阶段）；
 * - Fix：上传 patch.sh（仅 Fix 阶段 + 实例运行中）、Test Check 自检、源码下载（仅 Fix）。
 * 结果（accepted/scored/already_broken、patch applied/failed、自检三项）**如实展示后端返回值**。
 */
export function AwdpActionPanel({
	eventId,
	gamebox,
	instance,
	phase,
	onChanged,
}: {
	eventId: string;
	gamebox: AwdpGameBox | null;
	instance: AwdpInstance | null;
	phase: AwdpOverview["phase"];
	onChanged: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const [flag, setFlag] = useState("");
	const [breakResult, setBreakResult] = useState<BreakSubmitResponse | null>(null);
	const [patchResult, setPatchResult] = useState<PatchSubmitResponse | null>(null);
	const [checkResult, setCheckResult] = useState<ManualCheckDto | null>(null);
	const fileRef = useRef<HTMLInputElement | null>(null);

	const gameboxId = gamebox?.id ?? "";
	const breakGate = awdpBreakGate(phase, t);
	const patchGate = awdpPatchGate(phase, instance, t);
	const testGate = awdpTestCheckGate(instance, t);
	const sourceGate = awdpSourceGate(phase, t);

	const breakMutation = useMutation({
		mutationFn: (value: string) =>
			call<BreakSubmitResponse>(
				client.awdp.player.submitBreak(eventId, gameboxId, value),
				t("awdp.calls.breakFlag"),
			),
		onSuccess: (result) => {
			setBreakResult(result);
			setFlag("");
			if (result.scored) toast.success(t("awdp.actions.breakScoredToast"));
			else if (result.already_broken)
				toast.info(
					t("awdp.actions.breakAlreadyBrokenTitle"),
					t("awdp.actions.breakAlreadyBrokenDescription"),
				);
			else if (result.accepted) toast.info(t("awdp.actions.breakAcceptedNoScore"));
			else toast.error(t("awdp.actions.breakRejected"));
			onChanged();
		},
		onError: (error) => toast.apiError(t("awdp.actions.breakFailedToast"), error),
	});

	const patchMutation = useMutation({
		mutationFn: (file: File) =>
			call<PatchSubmitResponse>(
				client.awdp.player.uploadPatch(eventId, gameboxId, file),
				t("awdp.calls.patch"),
			),
		onSuccess: (result) => {
			setPatchResult(result);
			if (result.status === "applied") toast.success(t("awdp.actions.patchAppliedToast"));
			else
				toast.error(
					t("awdp.actions.patchFailedToast"),
					result.error_message ?? undefined,
				);
			if (fileRef.current) fileRef.current.value = "";
			onChanged();
		},
		onError: (error) => {
			setPatchResult(null);
			toast.apiError(t("awdp.actions.patchUploadFailed"), error);
		},
	});

	const checkMutation = useMutation({
		mutationFn: () =>
			call<ManualCheckDto>(
				client.awdp.player.testCheck(eventId, gameboxId),
				t("awdp.calls.testCheck"),
			),
		onSuccess: (result) => {
			setCheckResult(result);
			toast.success(
				t("awdp.actions.checkDoneTitle"),
				t("awdp.actions.checkDoneDescription"),
			);
			onChanged();
		},
		onError: (error) => toast.apiError(t("awdp.actions.checkFailed"), error),
	});

	const sourceWindowRef = useRef<Window | null>(null);
	const sourceMutation = useMutation({
		mutationFn: () =>
			call<string>(
				client.awdp.player.sourceUrl(eventId, gameboxId),
				t("awdp.calls.sourceUrl"),
			),
		onSuccess: (url) => {
			const opened = sourceWindowRef.current;
			sourceWindowRef.current = null;
			if (!url) {
				opened?.close();
				toast.error(t("awdp.actions.sourceMissingUrl"));
				return;
			}
			// 窗口已在点击时同步打开：这里只导航，避免异步 onSuccess 里 window.open 被拦截。
			if (!opened || opened.closed) {
				toast.error(t("common.popupBlocked"));
				return;
			}
			opened.location.href = url;
			toast.success(t("awdp.actions.sourceOpened"));
		},
		onError: (error) => {
			sourceWindowRef.current?.close();
			sourceWindowRef.current = null;
			toast.apiError(t("awdp.actions.sourceFailed"), error);
		},
	});

	function openSource() {
		// 必须在用户点击的同步栈里打开，弹窗拦截器才认；稍后由 onSuccess 导航。
		const opened = window.open("about:blank", "_blank");
		if (!opened) {
			toast.error(t("common.popupBlocked"));
			return;
		}
		opened.opener = null;
		sourceWindowRef.current = opened;
		sourceMutation.mutate();
	}

	if (!gamebox) {
		return (
			<EmptyBlock
				title={t("awdp.instance.selectTitle")}
				description={t("awdp.instance.selectDescription")}
			/>
		);
	}

	return (
		<div className="space-y-5">
			<SectionCard
				title={t("awdp.actions.breakTitle")}
				description={t("awdp.actions.breakDescription")}
				actions={
					<TonePill tone={awdpPhaseTone(phase)}>{awdpPhaseLabel(phase, t)}</TonePill>
				}
			>
				<div className="space-y-3">
					{!breakGate.allowed ? <GateNotice reason={breakGate.reason} /> : null}
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							const value = flag.trim();
							if (!value || !breakGate.allowed || breakMutation.isPending) return;
							breakMutation.mutate(value);
						}}
					>
						<Field
							label={t("awdp.actions.flagLabel")}
							htmlFor="awdp-break-flag"
							hint={breakGate.allowed ? t("awdp.actions.flagHint") : undefined}
						>
							<div className="flex flex-col gap-2 sm:flex-row">
								<Input
									id="awdp-break-flag"
									value={flag}
									autoComplete="off"
									spellCheck={false}
									placeholder={t("awdp.actions.flagPlaceholder")}
									aria-label={t("awdp.actions.flagLabel")}
									className="font-mono"
									disabled={!breakGate.allowed || breakMutation.isPending}
									title={!breakGate.allowed ? breakGate.reason : undefined}
									onChange={(event) => setFlag(event.target.value)}
								/>
								<Button
									type="submit"
									disabled={
										!breakGate.allowed ||
										breakMutation.isPending ||
										flag.trim().length === 0
									}
								>
									<FlaskConical />
									{t("awdp.actions.submit")}
								</Button>
							</div>
						</Field>
					</form>
					{breakResult ? (
						<div
							className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"
							role="status"
						>
							<span className="text-muted-foreground">
								{t("awdp.actions.breakResult")}
							</span>
							<TonePill tone={breakResult.accepted ? "success" : "danger"}>
								{breakResult.accepted
									? t("awdp.actions.accepted")
									: t("awdp.actions.rejected")}
							</TonePill>
							<TonePill tone={breakResult.scored ? "success" : "muted"}>
								{breakResult.scored
									? t("awdp.actions.scored")
									: t("awdp.actions.notScored")}
							</TonePill>
							{breakResult.accepted ? (
								<TonePill tone={breakResult.already_broken ? "warning" : "muted"}>
									{breakResult.already_broken
										? t("awdp.actions.alreadyBroken")
										: t("awdp.actions.firstBreak")}
								</TonePill>
							) : null}
						</div>
					) : null}
				</div>
			</SectionCard>

			<SectionCard
				title={t("awdp.actions.fixTitle")}
				description={t("awdp.actions.fixDescription")}
			>
				<div className="space-y-4">
					{!patchGate.allowed ? <GateNotice reason={patchGate.reason} /> : null}
					<div className="space-y-2">
						<Field
							label={t("awdp.actions.patchLabel")}
							hint={patchGate.allowed ? t("awdp.actions.patchHint") : undefined}
						>
							{/* 原生 file input 会漏出 "Choose File / No file chosen"（英文、且不可主题化）。 */}
							<input
								id="awdp-patch"
								ref={fileRef}
								type="file"
								accept=".tar.gz,.tgz,application/gzip"
								className="sr-only"
								tabIndex={-1}
								aria-label={t("awdp.actions.patchLabel")}
								disabled={!patchGate.allowed || patchMutation.isPending}
								onChange={async (event) => {
									const file = event.target.files?.[0];
									event.target.value = "";
									if (!file) return;
									if (!/\.(tar\.gz|tgz)$/i.test(file.name)) {
										toast.error(t("awdp.actions.patchFormat"));
										return;
									}
									const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
									if (head[0] !== 0x1f || head[1] !== 0x8b) {
										toast.error(t("awdp.actions.patchGzip"));
										return;
									}
									patchMutation.mutate(file);
								}}
							/>
							<div className="flex flex-wrap items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={!patchGate.allowed || patchMutation.isPending}
									title={!patchGate.allowed ? patchGate.reason : undefined}
									onClick={() => fileRef.current?.click()}
								>
									<FileUp />
									{t("awdp.actions.chooseAndUpload")}
								</Button>
								<span className="text-xs text-muted-foreground">
									{t("awdp.actions.patchAcceptHint")}
								</span>
							</div>
						</Field>
						{patchResult ? (
							<div
								className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"
								role="status"
							>
								<span className="text-muted-foreground">
									{t("awdp.actions.patchResult")}
								</span>
								<TonePill
									tone={patchResult.status === "applied" ? "success" : "danger"}
								>
									{patchResult.status === "applied"
										? t("awdp.actions.patchApplied")
										: t("awdp.actions.patchFailed")}
								</TonePill>
								{patchResult.error_message ? (
									<span className="text-destructive break-words">
										{patchResult.error_message}
									</span>
								) : null}
							</div>
						) : null}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={!testGate.allowed || checkMutation.isPending}
							title={
								testGate.allowed
									? t("awdp.actions.testCheckHint")
									: testGate.reason
							}
							onClick={() => checkMutation.mutate()}
						>
							<Activity />
							{t("awdp.actions.testCheck")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!sourceGate.allowed || sourceMutation.isPending}
							title={
								sourceGate.allowed
									? t("awdp.actions.downloadSourceHint")
									: sourceGate.reason
							}
							onClick={openSource}
						>
							<Download />
							{t("awdp.actions.downloadSource")}
						</Button>
					</div>
					{!testGate.allowed ? (
						<p className="text-xs text-muted-foreground">{testGate.reason}</p>
					) : null}
					{!sourceGate.allowed ? (
						<p className="text-xs text-muted-foreground">{sourceGate.reason}</p>
					) : null}

					{checkResult ? <CheckResult result={checkResult} /> : null}
				</div>
			</SectionCard>
		</div>
	);
}

/**
 * 右列：Fix 回合时间线 + 我的官方/手动评测。
 *
 * `enabled` 由页面的 overview 派生（`started_at !== null || phase !== "pending"`）：
 * 后端这两个端点在「赛事从未开始」时返回 400 `AWDP 事件尚未开始` —— 那是业务态，
 * 因此未开始时**不发起请求**，直接显示空态。
 */
export function AwdpRoundsEvaluationsPanel({
	eventId,
	enabled,
}: {
	eventId: string;
	enabled: boolean;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const roundsQuery = useQuery({
		queryKey: qk.awdp.rounds(eventId),
		queryFn: () =>
			call<AwdpRoundDto[]>(client.awdp.player.rounds(eventId), t("awdp.calls.rounds")),
		enabled,
	});
	const evaluationsQuery = useQuery({
		queryKey: qk.awdp.evaluations(eventId),
		queryFn: () =>
			call<AwdpEvaluationDto[]>(
				client.awdp.player.evaluations(eventId),
				t("awdp.calls.evaluations"),
			),
		enabled,
	});

	// SSE 失效契约缺口兜底：`useAwdpEventStream` 失效的是 `["awdp-evals", eventId]`，
	// 而 `qk.awdp.evaluations` 是 `["awdp-evaluations", eventId]`（前缀不匹配），
	// 评测面板本身不会被事件流刷新。回合时间线**会**被刷新，因此以「回合刷新完成」为信号
	// 顺带失效一次评测（单向、不会成环），让评测结果也保持实时。
	// 已作为集成缺口写进交付报告；qk 由集成方维护，本 feature 不改共享文件。
	const roundsUpdatedAt = roundsQuery.dataUpdatedAt;
	useEffect(() => {
		if (roundsUpdatedAt === 0) return;
		void queryClient.invalidateQueries({ queryKey: qk.awdp.evaluations(eventId) });
	}, [roundsUpdatedAt, queryClient, eventId]);

	if (!enabled) {
		return (
			<EmptyBlock
				title={t("awdp.rounds.startPendingTitle")}
				description={t("awdp.rounds.startPendingDescription")}
			/>
		);
	}

	return (
		<div className="space-y-5">
			<SectionCard
				title={t("awdp.rounds.sectionTitle")}
				description={t("awdp.rounds.sectionDescription")}
			>
				{roundsQuery.isPending ? (
					<TableSkeleton rows={3} columns={4} />
				) : roundsQuery.isError ? (
					<ErrorBlock
						error={roundsQuery.error}
						title={t("awdp.states.loadRounds")}
						onRetry={() => void roundsQuery.refetch()}
					/>
				) : (roundsQuery.data ?? []).length === 0 ? (
					<EmptyBlock
						title={t("awdp.rounds.emptyTitle")}
						description={t("awdp.rounds.emptyDescription")}
					/>
				) : (
					<DataTable
						data={roundsQuery.data ?? []}
						getRowId={(row) => row.id}
						columns={[
							{
								id: "sequence",
								header: t("awdp.rounds.columnSequence"),
								sortValue: (row) => row.sequence,
								cell: (row) => <MonoText>#{row.sequence}</MonoText>,
							},
							{
								id: "cutoff",
								header: t("awdp.rounds.columnCutoff"),
								sortValue: (row) => row.cutoff_at,
								cell: (row) => (
									<span className="tnum text-xs">
										{formatDateTime(row.cutoff_at, { seconds: true })}
									</span>
								),
							},
							{
								id: "status",
								header: t("awdp.rounds.columnStatus"),
								sortValue: (row) => row.status,
								cell: (row) => (
									<TonePill tone={awdpRoundStatusTone(row.status)}>
										{awdpRoundStatusLabel(row.status, t)}
									</TonePill>
								),
							},
						]}
					/>
				)}
			</SectionCard>

			<SectionCard
				title={t("awdp.rounds.evaluationsTitle")}
				description={t("awdp.rounds.evaluationsDescription")}
			>
				{evaluationsQuery.isPending ? (
					<TableSkeleton rows={4} columns={4} />
				) : evaluationsQuery.isError ? (
					<ErrorBlock
						error={evaluationsQuery.error}
						title={t("awdp.states.loadEvaluations")}
						onRetry={() => void evaluationsQuery.refetch()}
					/>
				) : (evaluationsQuery.data ?? []).length === 0 ? (
					<EmptyBlock
						title={t("awdp.rounds.evaluationsEmptyTitle")}
						description={t("awdp.rounds.evaluationsEmptyDescription")}
					/>
				) : (
					<DataTable
						data={evaluationsQuery.data ?? []}
						getRowId={(row) => row.id}
						columns={[
							{
								id: "round",
								header: t("awdp.rounds.columnSequence"),
								sortValue: (row) => row.round_sequence ?? 0,
								cell: (row) => (
									<MonoText>
										{row.round_sequence === null
											? t("common.empty")
											: `#${row.round_sequence}`}
									</MonoText>
								),
							},
							{
								id: "kind",
								header: t("awdp.rounds.columnKind"),
								sortValue: (row) => row.kind,
								cell: (row) => (
									<TonePill tone={row.kind === "official" ? "info" : "muted"}>
										{awdpEvaluationKindLabel(row.kind, t)}
									</TonePill>
								),
							},
							{
								id: "status",
								header: t("awdp.rounds.columnResult"),
								sortValue: (row) => row.status,
								cell: (row) => (
									<TonePill tone={awdpEvaluationTone(row.status)}>
										{awdpEvaluationLabel(row.status, t)}
									</TonePill>
								),
							},
							{
								id: "finished",
								header: t("awdp.rounds.columnFinishedAt"),
								hideBelow: "md",
								sortValue: (row) => row.finished_at ?? "",
								cell: (row) => (
									<span className="tnum text-xs text-muted-foreground">
										{row.finished_at
											? formatDateTime(row.finished_at, { seconds: true })
											: t("common.empty")}
									</span>
								),
							},
						]}
					/>
				)}
			</SectionCard>
		</div>
	);
}

interface ScoreMatrixRow {
	id: string;
	name: string;
	broken: boolean;
	statuses: (string | null)[];
	fixScore: number;
}

/** 底部 Tab：积分榜矩阵（Break/Fix 逐题逐回合）。 */
export function AwdpScoreboardPanel({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.awdp.scoreboard(eventId),
		queryFn: () =>
			call<AwdpScoreboardDetail>(
				client.awdp.player.scoreboard(eventId),
				t("awdp.calls.scoreboard"),
			),
	});

	if (query.isPending) return <TableSkeleton rows={6} columns={6} />;
	if (query.isError) {
		return (
			<ErrorBlock
				error={query.error}
				title={t("awdp.states.loadScoreboard")}
				onRetry={() => void query.refetch()}
			/>
		);
	}

	const data = query.data;
	if (!data || data.rows.length === 0) {
		return (
			<EmptyBlock
				title={t("awdp.scoreboard.emptyTitle")}
				description={t("awdp.scoreboard.emptyDescription")}
			/>
		);
	}

	return (
		<div className="space-y-3">
			<p className="tnum text-xs text-muted-foreground">
				{t("awdp.scoreboard.summary", {
					mode:
						data.participant_mode === "team"
							? t("awdp.scoreboard.modeTeam")
							: t("awdp.scoreboard.modeIndividual"),
					gameboxes: data.gameboxes.length,
					rounds: data.rounds.length,
				})}
			</p>
			{data.rows.map((row) => {
				const matrix: ScoreMatrixRow[] = data.gameboxes.map((gamebox, index) => ({
					id: gamebox.id,
					name: gamebox.name,
					broken: row.break_status[index] ?? false,
					statuses: row.fix_round_status[index] ?? [],
					fixScore: row.fix_gamebox_score[index] ?? 0,
				}));
				const columns: DataTableColumn<ScoreMatrixRow>[] = [
					{
						id: "gamebox",
						header: t("awdp.scoreboard.columnGamebox"),
						sortValue: (item) => item.name,
						cell: (item) => <span className="text-xs">{item.name}</span>,
					},
					{
						id: "break",
						header: t("awdp.scoreboard.columnBreak"),
						cell: (item) =>
							item.broken ? (
								<TonePill tone="success">
									{t("awdp.scoreboard.breakBroken")}
								</TonePill>
							) : (
								<TonePill tone="muted">
									{t("awdp.scoreboard.breakNotBroken")}
								</TonePill>
							),
					},
					...data.rounds.map<DataTableColumn<ScoreMatrixRow>>((round, roundIndex) => ({
						id: `round-${round.sequence}`,
						header: <MonoText>R{round.sequence}</MonoText>,
						cell: (item) => {
							const status = item.statuses[roundIndex] ?? null;
							return status === null ? (
								<span className="text-muted-foreground">
									{t("common.empty")}
								</span>
							) : (
								<TonePill tone={awdpEvaluationTone(status)}>
									{awdpEvaluationLabel(status, t)}
								</TonePill>
							);
						},
					})),
					{
						id: "fixScore",
						header: t("awdp.scoreboard.columnFixScore"),
						align: "right",
						sortValue: (item) => item.fixScore,
						cell: (item) => <MonoText>{formatPoints(item.fixScore)}</MonoText>,
					},
				];
				return (
					<section
						key={row.subject_id}
						className={cn(
							"space-y-2 rounded-lg border p-3",
							row.is_me && "border-primary bg-primary/5",
						)}
					>
						<div className="flex flex-wrap items-center gap-2">
							<MonoText className="font-semibold">#{row.rank}</MonoText>
							<MonoText className="text-sm font-medium">{row.subject_name}</MonoText>
							{row.is_me ? (
								<TonePill tone="info">{t("awdp.scoreboard.me")}</TonePill>
							) : null}
							<span className="tnum ml-auto text-xs text-muted-foreground">
								{t("awdp.scoreboard.totals", {
									breakScore: formatPoints(row.break_score),
									fixScore: formatPoints(row.fix_score),
									total: formatPoints(row.total_score),
								})}
							</span>
						</div>
						<DataTable
							data={matrix}
							getRowId={(item) => item.id}
							columns={columns}
						/>
					</section>
				);
			})}
		</div>
	);
}

/** 底部 Tab：官方积分榜（`awdp.player.scores` 聚合行）。 */
export function AwdpMyScoresPanel({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.awdp.scores(eventId),
		queryFn: () =>
			call<AwdpScoreRow[]>(client.awdp.player.scores(eventId), t("awdp.calls.scores")),
	});

	if (query.isPending) return <TableSkeleton rows={5} columns={5} />;
	if (query.isError) {
		return (
			<ErrorBlock
				error={query.error}
				title={t("awdp.states.loadScores")}
				onRetry={() => void query.refetch()}
			/>
		);
	}
	const rows = query.data ?? [];
	if (rows.length === 0) {
		return (
			<EmptyBlock
				title={t("awdp.scoreboard.scoresEmptyTitle")}
				description={t("awdp.scoreboard.scoresEmptyDescription")}
			/>
		);
	}
	return (
		<DataTable
			data={rows}
			getRowId={(row) => row.subject_id}
			columns={[
				{
					id: "rank",
					header: t("awdp.scoreboard.columnRank"),
					align: "right",
					sortValue: (row) => row.rank,
					cell: (row) => <MonoText>{row.rank}</MonoText>,
				},
				{
					id: "subject",
					header: t("awdp.scoreboard.columnSubject"),
					sortValue: (row) => row.subject_name,
					cell: (row) => <MonoText>{row.subject_name}</MonoText>,
				},
				{
					id: "break",
					header: t("awdp.scoreboard.columnBreak"),
					align: "right",
					sortValue: (row) => row.break_score,
					cell: (row) => <MonoText>{formatPoints(row.break_score)}</MonoText>,
				},
				{
					id: "fix",
					header: t("awdp.scoreboard.columnFix"),
					align: "right",
					sortValue: (row) => row.fix_score,
					cell: (row) => <MonoText>{formatPoints(row.fix_score)}</MonoText>,
				},
				{
					id: "total",
					header: t("awdp.scoreboard.columnTotal"),
					align: "right",
					sortValue: (row) => row.total_score,
					cell: (row) => (
						<MonoText className="font-semibold">
							{formatPoints(row.total_score)}
						</MonoText>
					),
				},
			]}
		/>
	);
}

/**
 * 底部 Tab：官方积分趋势。
 *
 * 不叠加 `refetchInterval`：本页由 `useAwdpEventStream` 驱动失效（`awdp-trend` 在 hook 的
 * 失效列表里），SSE 断开时 hook 自身会降级为 15s 轮询并失效同一批 key —— 这正是约定 §4
 * 要求的「不要叠加轮询」；平台的 30s 新鲜度语义由此满足。
 */
export function AwdpTrendPanel({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.awdp.trend(eventId),
		queryFn: () =>
			call<AwdpTrendItem[]>(client.awdp.player.trend(eventId), t("awdp.calls.trend")),
	});

	if (query.isPending) return <TableSkeleton rows={5} columns={2} />;
	if (query.isError) {
		return (
			<ErrorBlock
				error={query.error}
				title={t("awdp.states.loadTrend")}
				onRetry={() => void query.refetch()}
			/>
		);
	}
	const series = (query.data ?? []).map((item) => ({
		name: item.name,
		points: item.points
			.map((point) => ({ x: Date.parse(point.time), y: point.score }))
			.filter((point) => Number.isFinite(point.x)),
	}));
	if (series.length === 0 || series.every((item) => item.points.length === 0)) {
		return (
			<EmptyBlock
				title={t("awdp.scoreboard.trendEmptyTitle")}
				description={t("awdp.scoreboard.trendEmptyDescription")}
			/>
		);
	}
	return (
		<TrendChart
			series={series}
			formatY={(value) => formatPoints(value)}
			formatX={(x) => formatTime(x)}
		/>
	);
}
