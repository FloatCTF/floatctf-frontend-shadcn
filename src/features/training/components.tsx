/**
 * AWDP Training Ground 的域内组件：
 * 阶段步进条 / 实例卡 / Break·Fix·ALL Check 动作区 / 轮次与评测 / 积分明细 / Writeup。
 *
 * 所有用户可见文案走 training 命名空间（zh / en 同步），技术标识（flag、patch.sh、
 * Test Check、ALL Check、端点、ID）保持原文。
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	CheckCircle2,
	ChevronRight,
	Download,
	FileUp,
	FlaskConical,
	Loader2,
	Play,
	RefreshCw,
	RotateCcw,
	Save,
	ShieldCheck,
	Square,
	Terminal,
	TriangleAlert,
	XCircle,
} from "lucide-react";

import type {
	AllCheckDto,
	AwdpInstance,
	AwdpRunDto,
	AwdpRunEvaluationDto,
	AwdpRunScoresDto,
	AwdpRunWriteupDto,
	AwdpRoundDto,
	BreakSubmitResponse,
	ManualCheckDto,
	PatchSubmitResponse,
} from "@floatctf/sdk";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable } from "~/components/app/data-table";
import { Field } from "~/components/app/form";
import { MarkdownEditor } from "~/components/app/markdown";
import { CopyText, MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatDateTime, formatDuration, formatInt, formatPoints } from "~/lib/format";
import { useNow } from "~/lib/hooks";

import {
	RUN_PHASE_ORDER,
	allCheckRunGate,
	breakRunGate,
	isRunInstanceRunning,
	patchRunGate,
	runAllCheckConsequences,
	runEvaluationLabel,
	runEvaluationTone,
	runInstanceControlGate,
	runPhaseIndex,
	runPhaseLabel,
	runPhaseTone,
	runRuntimeLabel,
	runRuntimeTone,
	sourceRunGate,
	testCheckRunGate,
	runRoundStatusLabel,
} from "./domain";

/** 阶段步进条（pending → Break → 准备 Fix → Fix → 已结束）。 */
export function RunPhaseSteps({
	phase,
	currentRound,
	totalRounds,
	nextActionAt,
}: {
	phase: AwdpRunDto["phase"];
	currentRound: number;
	totalRounds: number;
	nextActionAt: string | null;
}): ReactNode {
	const { t } = useTranslation();
	const currentIndex = runPhaseIndex(phase);
	const now = useNow(1000);
	const remaining = (() => {
		if (!nextActionAt) return null;
		const target = Date.parse(nextActionAt);
		if (!Number.isFinite(target)) return null;
		return Math.max(0, Math.floor((target - now.getTime()) / 1000));
	})();

	return (
		<div className="space-y-3">
			<ol className="flex flex-wrap items-stretch gap-2">
				{RUN_PHASE_ORDER.map((step, index) => {
					const done = currentIndex > index;
					const active = currentIndex === index;
					return (
						<li key={step} className="flex items-center gap-2">
							<TonePill
								tone={active ? runPhaseTone(step) : done ? "success" : "muted"}
								className={active ? "ring-1 ring-current" : undefined}
							>
								{runPhaseLabel(step, t)}
							</TonePill>
							{index < RUN_PHASE_ORDER.length - 1 ? (
								<ChevronRight
									className="size-4 text-muted-foreground"
									aria-hidden="true"
								/>
							) : null}
						</li>
					);
				})}
			</ol>
			<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
				{phase === "fix" ? (
					<span className="tnum">
						{t("training.phase.round", {
							current: formatInt(currentRound),
							total: formatInt(totalRounds),
						})}
					</span>
				) : null}
				{remaining !== null && (phase === "break" || phase === "fix") ? (
					<span className="tnum">
						{phase === "break"
							? t("training.phase.breakRemaining", {
									duration: formatDuration(remaining),
								})
							: t("training.phase.nextRoundCountdown", {
									duration: formatDuration(remaining),
								})}
					</span>
				) : null}
				{nextActionAt ? (
					<span className="tnum">
						{t("training.phase.nextActionAt", {
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
					<span>{t("training.phase.preparingFixNote")}</span>
				</div>
			) : null}
		</div>
	);
}

/** 实例卡：端点、重建代数、重置次数 + 启动 / 停止 / 重置 / 刷新（取数由页面持有）。 */
export function TrainingInstancePanel({
	gameboxName,
	broken,
	instance,
	isPending,
	isError,
	error,
	judgeEndpoint,
	busy,
	pendingAction,
	refreshing,
	phase,
	onStart,
	onStop,
	onReset,
	onRefresh,
}: {
	gameboxName: string;
	broken: boolean;
	instance: AwdpInstance | null;
	isPending: boolean;
	isError: boolean;
	error: unknown;
	judgeEndpoint: AwdpRunDto["judge_endpoint"];
	busy: boolean;
	/** 正在执行的实例动作（用于只在被点击的按钮上显示 spinner）。 */
	pendingAction: "start" | "stop" | "reset" | null;
	refreshing: boolean;
	phase: AwdpRunDto["phase"];
	onStart: () => void;
	onStop: () => void;
	onReset: () => void;
	onRefresh: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const running = isRunInstanceRunning(instance);
	const control = runInstanceControlGate(phase, t);

	const startTitle = !control.allowed
		? control.reason
		: running
			? t("training.instance.startTitleRunning")
			: t("training.instance.startTitleAllowed");
	const stopTitle = !control.allowed
		? control.reason
		: running
			? t("training.instance.stopTitleAllowed")
			: t("training.instance.stopTitleNotRunning");
	const resetTitle = !control.allowed
		? control.reason
		: instance
			? t("training.instance.resetTitleAllowed")
			: t("training.instance.resetTitleMissing");

	return (
		<SectionCard
			title={t("training.instance.title")}
			description={gameboxName}
			actions={
				<div className="flex items-center gap-1">
					<TonePill tone={broken ? "danger" : "muted"}>
						{broken ? t("training.instance.broken") : t("training.instance.notBroken")}
					</TonePill>
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={onRefresh}
						disabled={refreshing}
						aria-label={t("training.instance.refresh")}
						title={t("training.instance.refresh")}
					>
						<RefreshCw className={refreshing ? "animate-spin" : undefined} />
					</Button>
				</div>
			}
		>
			{isPending ? (
				<TableSkeleton rows={2} columns={2} />
			) : isError ? (
				<ErrorBlock
					error={error}
					title={t("training.instance.loadError")}
					onRetry={onRefresh}
				/>
			) : (
				<div className="space-y-3">
					<div className="flex flex-wrap items-center gap-2">
						<TonePill tone={runRuntimeTone(instance?.runtime_state)}>
							{runRuntimeLabel(instance?.runtime_state, t)}
						</TonePill>
						{instance ? (
							<>
								<span className="tnum text-xs text-muted-foreground">
									{t("training.instance.generation", {
										value: formatInt(instance.runtime_generation),
									})}
								</span>
								<span className="tnum text-xs text-muted-foreground">
									{t("training.instance.resetCount", {
										value: formatInt(instance.reset_count),
									})}
								</span>
								<MonoText className="text-muted-foreground">
									{instance.instance_id}
								</MonoText>
							</>
						) : (
							<span className="text-xs text-muted-foreground">
								{t("training.instance.notStarted")}
							</span>
						)}
					</div>

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
											className="size-4 text-muted-foreground"
											aria-hidden="true"
										/>
										<CopyText
											value={url}
											label={t("training.instance.serviceAddress")}
										/>
										<span className="tnum text-xs text-muted-foreground">
											{t("training.instance.containerPort", {
												port: endpoint.container_port,
											})}
										</span>
									</li>
								);
							})}
						</ul>
					) : (
						<p className="text-xs text-muted-foreground">
							{t("training.instance.noEndpoints")}
						</p>
					)}

					{!control.allowed ? (
						<div
							className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
							role="status"
						>
							<TriangleAlert
								className="mt-0.5 size-4 shrink-0"
								aria-hidden="true"
							/>
							<span>{control.reason}</span>
						</div>
					) : null}
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={busy || running || !control.allowed}
							title={startTitle}
							onClick={onStart}
						>
							{pendingAction === "start" ? (
								<Loader2 className="animate-spin" aria-hidden="true" />
							) : (
								<Play aria-hidden="true" />
							)}
							{t("training.instance.start")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={busy || !running || !control.allowed}
							title={stopTitle}
							onClick={onStop}
						>
							{pendingAction === "stop" ? (
								<Loader2 className="animate-spin" aria-hidden="true" />
							) : (
								<Square aria-hidden="true" />
							)}
							{t("training.instance.stop")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={busy || !instance || !control.allowed}
							title={resetTitle}
							onClick={onReset}
						>
							{pendingAction === "reset" ? (
								<Loader2 className="animate-spin" aria-hidden="true" />
							) : (
								<RotateCcw aria-hidden="true" />
							)}
							{t("training.instance.reset")}
						</Button>
					</div>

					{judgeEndpoint ? (
						<div className="space-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
							<p className="flex items-center gap-1.5 font-medium">
								<ShieldCheck className="size-4" aria-hidden="true" />
								{t("training.instance.judge.title")}
							</p>
							<p className="text-muted-foreground">
								{t("training.instance.judge.scope", {
									scope: judgeEndpoint.scope,
								})}
							</p>
							<div className="flex flex-wrap items-center gap-2">
								<CopyText
									value={judgeEndpoint.base_url}
									label={t("training.instance.judge.baseUrl")}
								/>
								<CopyText
									value={judgeEndpoint.flag_url}
									label={t("training.instance.judge.flagUrl")}
								/>
							</div>
						</div>
					) : null}
				</div>
			)}
		</SectionCard>
	);
}

/**
 * 动作区：Break flag / Fix 补丁 / Test Check / ALL Check / 源码下载。
 * 所有结果（accepted/scored/already_broken、patch applied/failed、自检三项、ALL Check 终态）
 * 都直接展示后端返回值。
 */
export function TrainingActionPanel({
	runId,
	gameboxId,
	phase,
	instance,
	onChanged,
}: {
	runId: string;
	gameboxId: string;
	phase: AwdpRunDto["phase"];
	instance: AwdpInstance | null;
	onChanged: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const confirm = useConfirm();
	const [flag, setFlag] = useState("");
	const [breakResult, setBreakResult] = useState<BreakSubmitResponse | null>(null);
	const [patchResult, setPatchResult] = useState<PatchSubmitResponse | null>(null);
	const [checkResult, setCheckResult] = useState<ManualCheckDto | null>(null);
	const [allCheckResult, setAllCheckResult] = useState<AllCheckDto | null>(null);
	const fileRef = useRef<HTMLInputElement | null>(null);

	const breakGate = breakRunGate(phase, t);
	const patchGate = patchRunGate(phase, instance, t);
	const testGate = testCheckRunGate(instance, t);
	const allGate = allCheckRunGate(phase, instance, t);
	const sourceGate = sourceRunGate(phase, t);

	const breakMutation = useMutation({
		mutationFn: (value: string) =>
			call<BreakSubmitResponse>(
				client.awdp.runs.submitBreak(runId, gameboxId, value),
				"提交 Break flag",
			),
		onSuccess: (result) => {
			setBreakResult(result);
			setFlag("");
			if (result.scored) toast.success(t("training.actions.break.toast.scored"));
			else if (result.already_broken)
				toast.info(
					t("training.actions.break.toast.alreadyBroken"),
					t("training.actions.break.toast.alreadyBrokenDesc"),
				);
			else if (result.accepted)
				toast.info(t("training.actions.break.toast.acceptedNoScore"));
			else toast.error(t("training.actions.break.toast.rejected"));
			onChanged();
		},
		onError: (error) => toast.apiError(t("training.actions.break.toast.failed"), error),
	});

	const patchMutation = useMutation({
		mutationFn: (file: File) =>
			call<PatchSubmitResponse>(
				client.awdp.runs.uploadPatch(runId, gameboxId, file),
				"上传补丁",
			),
		onSuccess: (result) => {
			setPatchResult(result);
			if (result.status === "applied") toast.success(t("training.actions.fix.toast.applied"));
			else
				toast.error(
					t("training.actions.fix.toast.failed"),
					result.error_message ?? undefined,
				);
			if (fileRef.current) fileRef.current.value = "";
			onChanged();
		},
		onError: (error) => {
			setPatchResult(null);
			toast.apiError(t("training.actions.fix.toast.uploadFailed"), error);
		},
	});

	const checkMutation = useMutation({
		mutationFn: () =>
			call<ManualCheckDto>(client.awdp.runs.testCheck(runId, gameboxId), "Test Check"),
		onSuccess: (result) => {
			setCheckResult(result);
			toast.success(
				t("training.actions.test.toast.done"),
				t("training.actions.test.toast.doneDesc"),
			);
			onChanged();
		},
		onError: (error) => toast.apiError(t("training.actions.test.toast.failed"), error),
	});

	const allCheckMutation = useMutation({
		mutationFn: () =>
			call<AllCheckDto>(client.awdp.runs.allCheck(runId, gameboxId), "ALL Check"),
		onSuccess: (result) => {
			setAllCheckResult(result);
			if (result.status === "patched") {
				toast.success(
					t("training.actions.allCheck.toast.passed"),
					result.swept
						? t("training.actions.allCheck.toast.passedSwept", {
								count: result.swept_rounds,
							})
						: t("training.actions.allCheck.toast.passedDesc"),
				);
			} else {
				toast.error(
					t("training.actions.allCheck.toast.failed"),
					t("training.actions.allCheck.toast.failedDesc"),
				);
			}
			onChanged();
		},
		onError: (error) => toast.apiError(t("training.actions.allCheck.toast.error"), error),
	});

	const sourceWindowRef = useRef<Window | null>(null);
	const sourceMutation = useMutation({
		mutationFn: () =>
			call<string>(client.awdp.runs.sourceUrl(runId, gameboxId), "获取源码地址"),
		onSuccess: (url) => {
			const opened = sourceWindowRef.current;
			sourceWindowRef.current = null;
			if (!url) {
				opened?.close();
				toast.error(t("training.actions.source.missingUrl"));
				return;
			}
			// 窗口已在点击时同步打开：异步回调里只做导航，避免被弹窗拦截。
			if (!opened || opened.closed) {
				toast.error(t("common.popupBlocked"));
				return;
			}
			opened.location.href = url;
			toast.success(t("training.actions.source.opened"));
		},
		onError: (error) => {
			sourceWindowRef.current?.close();
			sourceWindowRef.current = null;
			toast.apiError(t("training.actions.source.failed"), error);
		},
	});

	function openSource() {
		const opened = window.open("about:blank", "_blank");
		if (!opened) {
			toast.error(t("common.popupBlocked"));
			return;
		}
		opened.opener = null;
		sourceWindowRef.current = opened;
		sourceMutation.mutate();
	}

	return (
		<div className="space-y-5">
			<SectionCard
				title={t("training.actions.break.title")}
				description={t("training.actions.break.description")}
				actions={<TonePill tone={runPhaseTone(phase)}>{runPhaseLabel(phase, t)}</TonePill>}
			>
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
						label="flag"
						htmlFor="training-break-flag"
						error={!breakGate.allowed ? breakGate.reason : undefined}
					>
						<div className="flex gap-2">
							<Input
								id="training-break-flag"
								value={flag}
								autoComplete="off"
								spellCheck={false}
								placeholder="flag{...}"
								className="font-mono"
								disabled={!breakGate.allowed || breakMutation.isPending}
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
								{breakMutation.isPending ? (
									<Loader2 className="animate-spin" aria-hidden="true" />
								) : (
									<FlaskConical aria-hidden="true" />
								)}
								{t("training.actions.break.submit")}
							</Button>
						</div>
					</Field>
				</form>
				{breakResult ? (
					<div
						className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"
						aria-live="polite"
					>
						<span className="text-muted-foreground">
							{t("training.actions.break.result")}
						</span>
						<TonePill tone={breakResult.accepted ? "success" : "danger"}>
							{breakResult.accepted
								? t("training.actions.break.accepted")
								: t("training.actions.break.rejected")}
						</TonePill>
						<TonePill tone={breakResult.scored ? "success" : "muted"}>
							{breakResult.scored
								? t("training.actions.break.scored")
								: t("training.actions.break.notScored")}
						</TonePill>
						{breakResult.accepted ? (
							<TonePill tone={breakResult.already_broken ? "warning" : "muted"}>
								{breakResult.already_broken
									? t("training.actions.break.alreadyBroken")
									: t("training.actions.break.firstBroken")}
							</TonePill>
						) : null}
					</div>
				) : null}
			</SectionCard>

			<SectionCard
				title={t("training.actions.fix.title")}
				description={t("training.actions.fix.description")}
			>
				<div className="space-y-4">
					<Field
						label={t("training.actions.fix.patchLabel")}
						htmlFor="training-patch"
						error={!patchGate.allowed ? patchGate.reason : undefined}
						hint={t("training.actions.fix.patchHint")}
					>
						<div className="flex flex-wrap items-center gap-2">
							<Input
								id="training-patch"
								ref={fileRef}
								type="file"
								accept=".tar.gz,.tgz,application/gzip"
								className="hidden"
								disabled={!patchGate.allowed || patchMutation.isPending}
								onChange={async (event) => {
									const file = event.target.files?.[0];
									event.target.value = "";
									if (!file) return;
									if (!/\.(tar\.gz|tgz)$/i.test(file.name)) {
										toast.error(t("training.actions.fix.patchFormat"));
										return;
									}
									const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
									if (head[0] !== 0x1f || head[1] !== 0x8b) {
										toast.error(t("training.actions.fix.patchGzip"));
										return;
									}
									patchMutation.mutate(file);
								}}
							/>
							<Button
								variant="outline"
								size="sm"
								disabled={!patchGate.allowed || patchMutation.isPending}
								onClick={() => fileRef.current?.click()}
							>
								{patchMutation.isPending ? (
									<Loader2 className="animate-spin" aria-hidden="true" />
								) : (
									<FileUp aria-hidden="true" />
								)}
								{t("training.actions.fix.chooseUpload")}
							</Button>
						</div>
					</Field>
					{patchResult ? (
						<div
							className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"
							aria-live="polite"
						>
							<span className="text-muted-foreground">
								{t("training.actions.fix.patchResult")}
							</span>
							<TonePill tone={patchResult.status === "applied" ? "success" : "danger"}>
								{patchResult.status === "applied"
									? t("training.actions.fix.applied")
									: t("training.actions.fix.failed")}
							</TonePill>
							{patchResult.error_message ? (
								<span className="min-w-0 break-words text-destructive">
									{patchResult.error_message}
								</span>
							) : null}
						</div>
					) : null}

					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={!testGate.allowed || checkMutation.isPending}
							title={testGate.allowed ? t("training.actions.test.title") : testGate.reason}
							onClick={() => checkMutation.mutate()}
						>
							{checkMutation.isPending ? (
								<Loader2 className="animate-spin" aria-hidden="true" />
							) : (
								<Activity aria-hidden="true" />
							)}
							{t("training.actions.test.label")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!allGate.allowed || allCheckMutation.isPending}
							title={
								allGate.allowed
									? t("training.actions.allCheck.title")
									: allGate.reason
							}
							onClick={async () => {
								// ALL Check 通过会直接结束本 run（剩余回合全部计分）→ 破坏性，需确认。
								const ok = await confirm({
									title: t("training.confirm.allCheck.title"),
									description: t("training.confirm.allCheck.description"),
									consequences: runAllCheckConsequences(t),
									tone: "danger",
									confirmText: t("training.confirm.allCheck.confirmText"),
								});
								if (ok) allCheckMutation.mutate();
							}}
						>
							{allCheckMutation.isPending ? (
								<Loader2 className="animate-spin" aria-hidden="true" />
							) : (
								<CheckCircle2 aria-hidden="true" />
							)}
							{t("training.actions.allCheck.label")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!sourceGate.allowed || sourceMutation.isPending}
							title={
								sourceGate.allowed
									? t("training.actions.source.title")
									: sourceGate.reason
							}
							onClick={openSource}
						>
							{sourceMutation.isPending ? (
								<Loader2 className="animate-spin" aria-hidden="true" />
							) : (
								<Download aria-hidden="true" />
							)}
							{t("training.actions.source.label")}
						</Button>
					</div>
					{!testGate.allowed ? (
						<p className="text-xs text-muted-foreground">{testGate.reason}</p>
					) : null}
					{!allGate.allowed ? (
						<p className="text-xs text-muted-foreground">{allGate.reason}</p>
					) : null}
					{!sourceGate.allowed ? (
						<p className="text-xs text-muted-foreground">{sourceGate.reason}</p>
					) : null}

					{checkResult ? (
						<div
							className="space-y-2 rounded-lg border px-3 py-2 text-xs"
							aria-live="polite"
						>
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-medium">
									{t("training.actions.test.resultTitle")}
								</span>
								<span className="text-muted-foreground">
									{t("training.actions.test.evaluationId")}
								</span>
								<MonoText>{checkResult.evaluation_id}</MonoText>
							</div>
							<ul className="space-y-1">
								<li className="flex items-center gap-2">
									{checkResult.healthcheck_ok ? (
										<CheckCircle2
											className="size-4 text-emerald-600 dark:text-emerald-400"
											aria-hidden="true"
										/>
									) : (
										<XCircle className="size-4 text-destructive" aria-hidden="true" />
									)}
									<span>
										{t("training.actions.test.healthcheck", {
											result: checkResult.healthcheck_ok
												? t("training.actions.test.pass")
												: t("training.actions.test.fail"),
										})}
									</span>
								</li>
								<li className="flex items-center gap-2">
									{checkResult.judge_ok ? (
										<CheckCircle2
											className="size-4 text-emerald-600 dark:text-emerald-400"
											aria-hidden="true"
										/>
									) : (
										<XCircle className="size-4 text-destructive" aria-hidden="true" />
									)}
									<span>
										{t("training.actions.test.judge", {
											result: checkResult.judge_ok
												? t("training.actions.test.pass")
												: t("training.actions.test.fail"),
										})}
									</span>
								</li>
								<li className="flex items-center gap-2">
									{checkResult.exploit_ok === null ? (
										<TonePill tone="muted">
											{t("training.actions.test.exploitSkipped")}
										</TonePill>
									) : checkResult.exploit_ok ? (
										<XCircle className="size-4 text-destructive" aria-hidden="true" />
									) : (
										<CheckCircle2
											className="size-4 text-emerald-600 dark:text-emerald-400"
											aria-hidden="true"
										/>
									)}
									<span>
										{t("training.actions.test.exploit", {
											result:
												checkResult.exploit_ok === null
													? t("training.actions.test.exploitNotRun")
													: checkResult.exploit_ok
														? t("training.actions.test.exploitStillVulnerable")
														: t("training.actions.test.exploitFixed"),
										})}
									</span>
								</li>
							</ul>
							{checkResult.healthcheck_detail?.length ? (
								<pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
									{checkResult.healthcheck_detail.join("\n")}
								</pre>
							) : null}
							{checkResult.judge_detail ? (
								<pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
									{checkResult.judge_detail}
								</pre>
							) : null}
							{checkResult.exploit_detail ? (
								<pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
									{checkResult.exploit_detail}
								</pre>
							) : null}
						</div>
					) : null}

					{allCheckResult ? (
						<div
							className="space-y-2 rounded-lg border px-3 py-2 text-xs"
							aria-live="polite"
						>
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-muted-foreground">
									{t("training.actions.allCheck.finalStatus")}
								</span>
								<TonePill
									tone={allCheckResult.status === "patched" ? "success" : "danger"}
								>
									{runEvaluationLabel(allCheckResult.status, t)}
								</TonePill>
								<TonePill
									tone={allCheckResult.swept ? "success" : "muted"}
									className="tnum"
								>
									{allCheckResult.swept
										? t("training.actions.allCheck.swept", {
												count: allCheckResult.swept_rounds,
											})
										: t("training.actions.allCheck.notSwept")}
								</TonePill>
								<span className="tnum text-muted-foreground">
									{t("training.actions.allCheck.targetRound", {
										round: allCheckResult.target_round,
									})}
								</span>
							</div>
							{allCheckResult.healthcheck_detail ? (
								<pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
									{allCheckResult.healthcheck_detail}
								</pre>
							) : null}
							{allCheckResult.judge_detail ? (
								<pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
									{allCheckResult.judge_detail}
								</pre>
							) : null}
							{allCheckResult.exploit_detail ? (
								<pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
									{allCheckResult.exploit_detail}
								</pre>
							) : null}
						</div>
					) : null}
				</div>
			</SectionCard>
		</div>
	);
}

/** 轮次与评测。 */
export function RunRoundsEvaluationsPanel({ runId }: { runId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const roundsQuery = useQuery({
		queryKey: qk.runs.rounds(runId),
		queryFn: () => call<AwdpRoundDto[]>(client.awdp.runs.rounds(runId), "Fix 回合"),
	});
	const evaluationsQuery = useQuery({
		queryKey: qk.runs.evaluations(runId),
		queryFn: () =>
			call<AwdpRunEvaluationDto[]>(client.awdp.runs.evaluations(runId), "我的评测"),
	});

	// SSE 失效契约缺口兜底：`useAwdpRunStream` 失效的是 `["awdp-run-evals", runId]`，
	// 而 `qk.runs.evaluations` 是 `["awdp-run-evaluations", runId]`（前缀不匹配）。
	// 回合会被事件流刷新 → 以回合刷新完成为信号顺带失效评测（单向，不成环）。
	const roundsUpdatedAt = roundsQuery.dataUpdatedAt;
	useEffect(() => {
		if (roundsUpdatedAt === 0) return;
		void queryClient.invalidateQueries({ queryKey: qk.runs.evaluations(runId) });
	}, [roundsUpdatedAt, queryClient, runId]);

	return (
		<div className="space-y-5">
			<SectionCard
				title={t("training.rounds.title")}
				description={t("training.rounds.description")}
			>
				{roundsQuery.isPending ? (
					<TableSkeleton rows={3} columns={3} />
				) : roundsQuery.isError ? (
					<ErrorBlock
						error={roundsQuery.error}
						title={t("training.rounds.loadError")}
						onRetry={() => void roundsQuery.refetch()}
					/>
				) : (roundsQuery.data ?? []).length === 0 ? (
					<EmptyBlock
						title={t("training.rounds.emptyTitle")}
						description={t("training.rounds.emptyDescription")}
					/>
				) : (
					<DataTable
						data={roundsQuery.data ?? []}
						getRowId={(row) => row.id}
						columns={[
							{
								id: "sequence",
								header: t("training.rounds.columns.round"),
								sortValue: (row) => row.sequence,
								cell: (row) => <MonoText>#{row.sequence}</MonoText>,
							},
							{
								id: "cutoff",
								header: t("training.rounds.columns.cutoff"),
								sortValue: (row) => row.cutoff_at,
								cell: (row) => (
									<span className="tnum text-xs">
										{formatDateTime(row.cutoff_at, { seconds: true })}
									</span>
								),
							},
							{
								id: "status",
								header: t("training.rounds.columns.status"),
								sortValue: (row) => row.status,
								cell: (row) => (
									<MonoText>{runRoundStatusLabel(row.status, t)}</MonoText>
								),
							},
						]}
					/>
				)}
			</SectionCard>

			<SectionCard
				title={t("training.evaluations.title")}
				description={t("training.evaluations.description")}
			>
				{evaluationsQuery.isPending ? (
					<TableSkeleton rows={4} columns={4} />
				) : evaluationsQuery.isError ? (
					<ErrorBlock
						error={evaluationsQuery.error}
						title={t("training.evaluations.loadError")}
						onRetry={() => void evaluationsQuery.refetch()}
					/>
				) : (evaluationsQuery.data ?? []).length === 0 ? (
					<EmptyBlock
						title={t("training.evaluations.emptyTitle")}
						description={t("training.evaluations.emptyDescription")}
					/>
				) : (
					<DataTable
						data={evaluationsQuery.data ?? []}
						getRowId={(row) => row.id}
						columns={[
							{
								id: "round",
								header: t("training.evaluations.columns.round"),
								sortValue: (row) => row.round_sequence ?? 0,
								cell: (row) => (
									<MonoText>
										{row.round_sequence === null ? "—" : `#${row.round_sequence}`}
									</MonoText>
								),
							},
							{
								id: "kind",
								header: t("training.evaluations.columns.kind"),
								sortValue: (row) => row.kind,
								cell: (row) => (
									<TonePill tone={row.kind === "official" ? "info" : "muted"}>
										{row.kind === "official"
											? t("training.evaluation.kind.official")
											: t("training.evaluation.kind.manual")}
									</TonePill>
								),
							},
							{
								id: "status",
								header: t("training.evaluations.columns.result"),
								sortValue: (row) => row.status,
								cell: (row) => (
									<TonePill tone={runEvaluationTone(row.status)}>
										{runEvaluationLabel(row.status, t, row.kind)}
									</TonePill>
								),
							},
							{
								id: "finished",
								header: t("training.evaluations.columns.finished"),
								hideBelow: "md",
								sortValue: (row) => row.finished_at ?? "",
								cell: (row) => (
									<span className="tnum text-xs text-muted-foreground">
										{row.finished_at
											? formatDateTime(row.finished_at, { seconds: true })
											: "—"}
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

/** 积分明细（append-only ledger）。 */
export function RunScoresPanel({ runId }: { runId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.runs.scores(runId),
		queryFn: () => call<AwdpRunScoresDto>(client.awdp.runs.scores(runId), "积分明细"),
	});

	if (query.isPending) return <TableSkeleton rows={4} columns={5} />;
	if (query.isError) {
		return (
			<ErrorBlock
				error={query.error}
				title={t("training.scores.loadError")}
				onRetry={() => void query.refetch()}
			/>
		);
	}
	const data = query.data;
	if (!data || data.history.length === 0) {
		return (
			<EmptyBlock
				title={t("training.scores.emptyTitle")}
				description={t("training.scores.emptyDescription")}
			/>
		);
	}
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<span className="text-xs text-muted-foreground">{t("training.scores.total")}</span>
				<MonoText className="text-base font-semibold">{formatPoints(data.total)}</MonoText>
			</div>
			<DataTable
				data={data.history}
				getRowId={(row) => row.id}
				columns={[
					{
						id: "type",
						header: t("training.scores.columns.type"),
						sortValue: (row) => row.score_type,
						cell: (row) => (
							<TonePill tone={row.score_type === "break" ? "info" : "success"}>
								{row.score_type === "break" ? "Break" : "Fix"}
							</TonePill>
						),
					},
					{
						id: "delta",
						header: t("training.scores.columns.delta"),
						align: "right",
						sortValue: (row) => row.delta,
						cell: (row) => (
							<MonoText className={row.delta < 0 ? "text-destructive" : undefined}>
								{row.delta > 0 ? `+${formatPoints(row.delta)}` : formatPoints(row.delta)}
							</MonoText>
						),
					},
					{
						id: "round",
						header: t("training.scores.columns.round"),
						hideBelow: "sm",
						sortValue: (row) => row.fix_round_id ?? "",
						cell: (row) => (
							<span className="text-xs text-muted-foreground">
								{row.fix_round_id ? t("training.scores.roundJudgement") : "—"}
							</span>
						),
					},
					{
						id: "gamebox",
						header: t("training.scores.columns.gamebox"),
						hideBelow: "md",
						cell: (row) => <MonoText>{row.gamebox_id}</MonoText>,
					},
					{
						id: "created",
						header: t("training.scores.columns.created"),
						sortValue: (row) => row.created_at,
						cell: (row) => (
							<span className="tnum text-xs text-muted-foreground">
								{formatDateTime(row.created_at, { seconds: true })}
							</span>
						),
					},
				]}
			/>
		</div>
	);
}

/** Writeup 读写（一 run 一份）。 */
export function RunWriteupPanel({ runId }: { runId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	// `null` = 用户尚未编辑；非 null 时以本地草稿为准，避免 refetch 覆盖输入。
	const [draft, setDraft] = useState<string | null>(null);

	const query = useQuery({
		queryKey: qk.runs.writeup(runId),
		queryFn: () =>
			call<AwdpRunWriteupDto>(client.awdp.runs.getWriteup(runId), "我的 Writeup"),
	});

	const saved = query.data?.content ?? "";
	const value = draft ?? saved;
	const dirty = draft !== null && draft !== saved;

	const mutation = useMutation({
		mutationFn: (content: string) =>
			call<AwdpRunWriteupDto>(
				client.awdp.runs.saveWriteup(runId, content),
				"保存 Writeup",
			),
		onSuccess: (result) => {
			setDraft(null);
			queryClient.setQueryData(qk.runs.writeup(runId), result);
			void queryClient.invalidateQueries({ queryKey: qk.runs.writeup(runId) });
			toast.success(t("training.writeup.toast.saved"));
		},
		onError: (error) => toast.apiError(t("training.writeup.toast.failed"), error),
	});

	return (
		<SectionCard
			title={t("training.writeup.title")}
			description={t("training.writeup.description")}
			actions={
				<div className="flex items-center gap-2">
					{query.data?.updated_at ? (
						<span className="tnum text-xs text-muted-foreground">
							{t("training.writeup.updatedAt", {
								time: formatDateTime(query.data.updated_at, { seconds: true }),
							})}
						</span>
					) : null}
					<Button
						size="sm"
						disabled={!dirty || mutation.isPending || query.isPending}
						onClick={() => mutation.mutate(value)}
					>
						{mutation.isPending ? (
							<Loader2 className="animate-spin" aria-hidden="true" />
						) : (
							<Save aria-hidden="true" />
						)}
						{t("training.writeup.save")}
					</Button>
				</div>
			}
		>
			{query.isPending ? (
				<TableSkeleton rows={5} columns={2} />
			) : query.isError ? (
				<ErrorBlock
					error={query.error}
					title={t("training.writeup.loadError")}
					onRetry={() => void query.refetch()}
				/>
			) : (
				<div className="space-y-2">
					<MarkdownEditor
						value={value}
						onChange={setDraft}
						minHeight={320}
						placeholder={t("training.writeup.placeholder")}
					/>
					{dirty ? (
						<p className="text-xs text-muted-foreground">
							{t("training.writeup.unsaved")}
						</p>
					) : null}
				</div>
			)}
		</SectionCard>
	);
}
