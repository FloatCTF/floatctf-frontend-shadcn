/**
 * AWDP Training Ground（练习 Run）语义 —— 阶段 / 评测状态 / 生命周期门禁。
 *
 * 与 `features/awdp/domain.ts` 刻意各持一份（两个域互相独立、可单独审阅），
 * 值都来自同一份后端枚举与守卫：
 * - `practice_service::train_again`：仅 `ended` run 可「再次训练」（新建 run）；
 * - `api/training.rs::end_run`：仅 `break` / `fix` 可结束（pending / ended 拒绝）；
 * - `set_phase`：仅 practice，且只支持 break↔fix；
 * - `break_service::submit_flag`：仅 Break 阶段；`patch_service`：仅 Fix 阶段 + 实例 running；
 * - `download_source`：仅 Fix 阶段；`manual_test_check`：需要运行中的实例。
 *
 * 本模块只做**展示语义**（label / tone / 门禁原因），不做数据获取；所有文案由调用方传入的
 * `t`（training 命名空间）解析，阶段判定仍以 SDK 的 `AwdpPhase` 为准。
 */

import type { TFunction } from "i18next";

import type { AwdpInstance, AwdpPhase } from "@floatctf/sdk";

import type { PillTone } from "~/components/app/badges";

export interface TrainingGate {
	allowed: boolean;
	reason: string;
}

const ALLOWED: TrainingGate = { allowed: true, reason: "" };

export const RUN_PHASE_ORDER: readonly AwdpPhase[] = [
	"pending",
	"break",
	"preparing_fix",
	"fix",
	"ended",
];

const PHASE_LABEL_KEY: Record<AwdpPhase, string> = {
	pending: "training.phase.pending",
	break: "training.phase.break",
	preparing_fix: "training.phase.preparingFix",
	fix: "training.phase.fix",
	ended: "training.phase.ended",
};

const PHASE_TONE: Record<AwdpPhase, PillTone> = {
	pending: "muted",
	break: "info",
	preparing_fix: "warning",
	fix: "success",
	ended: "muted",
};

export function runPhaseLabel(phase: AwdpPhase | null | undefined, t: TFunction): string {
	if (!phase) return t("training.phase.unknown");
	const key = PHASE_LABEL_KEY[phase];
	return key ? t(key) : phase;
}

export function runPhaseTone(phase: AwdpPhase | null | undefined): PillTone {
	if (!phase) return "muted";
	return PHASE_TONE[phase] ?? "neutral";
}

export function runPhaseIndex(phase: AwdpPhase | null | undefined): number {
	if (!phase) return -1;
	return RUN_PHASE_ORDER.indexOf(phase);
}

const EVAL_STATUS_LABEL_KEY: Record<string, string> = {
	pending: "training.evaluation.pending",
	running: "training.evaluation.running",
	no_patch: "training.evaluation.noPatch",
	service_down: "training.evaluation.serviceDown",
	functional_broken: "training.evaluation.functionalBroken",
	vulnerable: "training.evaluation.vulnerable",
	patched: "training.evaluation.patched",
	platform_error: "training.evaluation.platformError",
};

const EVAL_STATUS_TONE: Record<string, PillTone> = {
	pending: "info",
	running: "info",
	patched: "success",
	no_patch: "warning",
	service_down: "danger",
	functional_broken: "danger",
	vulnerable: "warning",
	platform_error: "danger",
};

export function runEvaluationLabel(
	status: string | null | undefined,
	t: TFunction,
	kind?: "manual" | "official",
): string {
	if (!status) return "—";
	// 自检（manual）不计分：同一个 patched 不能对两种情况都说「（计分）」。
	if (status === "patched" && kind === "manual") {
		return t("training.evaluation.patchedManual");
	}
	const key = EVAL_STATUS_LABEL_KEY[status];
	return key ? t(key) : status;
}

export function runEvaluationTone(status: string | null | undefined): PillTone {
	if (!status) return "muted";
	return EVAL_STATUS_TONE[status] ?? "neutral";
}

export function runRuntimeLabel(state: string | null | undefined, t: TFunction): string {
	switch (state) {
		case "running":
			return t("training.runtime.running");
		case "stopped":
			return t("training.runtime.stopped");
		case null:
		case undefined:
		case "":
			return t("training.runtime.notStarted");
		default:
			return state;
	}
}

export function runRuntimeTone(state: string | null | undefined): PillTone {
	switch (state) {
		case "running":
			return "success";
		case "stopped":
			return "muted";
		default:
			return "muted";
	}
}

export function isRunInstanceRunning(instance: AwdpInstance | null | undefined): boolean {
	return instance?.runtime_state === "running";
}

/** 「开始训练（Launch）」：pending / break / fix 可启动或继续；ended 终态拒绝。 */
export function startRunGate(
	phase: AwdpPhase,
	t: TFunction,
	instanceRunning = false,
): TrainingGate {
	if (phase === "ended") {
		return { allowed: false, reason: t("training.gates.startEnded") };
	}
	// Break/Fix 阶段「开始」等价于「启动实例」：实例已在跑就没有可做的事，
	// 否则会出现「实例运行中却还能点开始训练」的错觉。
	if (phase !== "pending" && instanceRunning) {
		return { allowed: false, reason: t("training.gates.startRunning") };
	}
	return ALLOWED;
}

/** 「结束训练」：仅 Break / Fix 阶段（pending / ended 后端拒绝）。 */
export function endRunGate(phase: AwdpPhase, t: TFunction): TrainingGate {
	if (phase === "break" || phase === "fix") return ALLOWED;
	return {
		allowed: false,
		reason: t("training.gates.end", { phase: runPhaseLabel(phase, t) }),
	};
}

/** 「停止训练」：只在还有实例在跑时有意义；已结束的 run 不再提供。 */
export function stopRunGate(
	phase: AwdpPhase,
	instanceRunning: boolean,
	t: TFunction,
): TrainingGate {
	if (phase === "ended") {
		return { allowed: false, reason: t("training.gates.stopEnded") };
	}
	if (!instanceRunning) {
		return { allowed: false, reason: t("training.gates.stopIdle") };
	}
	return ALLOWED;
}

/** 「重置 run」：会销毁实例并回卷，已结束的 run 不允许。 */
export function resetRunGate(phase: AwdpPhase, t: TFunction): TrainingGate {
	if (phase === "ended") {
		return { allowed: false, reason: t("training.gates.resetEnded") };
	}
	return ALLOWED;
}

/** 「再次训练」：仅 ended run（后端新建一个从 0 计分的 run）。 */
export function restartTrainingGate(phase: AwdpPhase, t: TFunction): TrainingGate {
	if (phase === "ended") return ALLOWED;
	return {
		allowed: false,
		reason: t("training.gates.restart", { phase: runPhaseLabel(phase, t) }),
	};
}

/** 手动切阶段：仅 break ↔ fix。 */
export function setPhaseGate(
	phase: AwdpPhase,
	target: "break" | "fix",
	t: TFunction,
): TrainingGate {
	if (phase === "break" && target === "fix") return ALLOWED;
	if (phase === "fix" && target === "break") return ALLOWED;
	return {
		allowed: false,
		reason: t("training.gates.setPhase", {
			phase: runPhaseLabel(phase, t),
			target: target === "fix" ? "Fix" : "Break",
		}),
	};
}

export function breakRunGate(phase: AwdpPhase, t: TFunction): TrainingGate {
	if (phase === "break") return ALLOWED;
	return {
		allowed: false,
		reason: t("training.gates.break", { phase: runPhaseLabel(phase, t) }),
	};
}

export function patchRunGate(
	phase: AwdpPhase,
	instance: AwdpInstance | null,
	t: TFunction,
): TrainingGate {
	if (phase !== "fix") {
		return {
			allowed: false,
			reason: t("training.gates.patchPhase", { phase: runPhaseLabel(phase, t) }),
		};
	}
	if (!isRunInstanceRunning(instance)) {
		return { allowed: false, reason: t("training.gates.patchNotRunning") };
	}
	return ALLOWED;
}

/**
 * 实例生命周期动作（启动 / 停止 / 重置）的阶段门。
 * 后端 `service/runtime.rs::start_instance` 要求 `phase ∈ {Break, Fix}`（练习与比赛同一实现）：
 * pending 阶段要先用「开始训练」Launch，ended 阶段要「再次训练」。
 */
export function runInstanceControlGate(phase: AwdpPhase, t: TFunction): TrainingGate {
	if (phase === "break" || phase === "fix") return ALLOWED;
	if (phase === "pending") {
		return { allowed: false, reason: t("training.gates.instancePending") };
	}
	if (phase === "preparing_fix") {
		return { allowed: false, reason: t("training.gates.instancePreparingFix") };
	}
	return { allowed: false, reason: t("training.gates.instanceEnded") };
}

export function testCheckRunGate(
	instance: AwdpInstance | null,
	t: TFunction,
): TrainingGate {
	if (!isRunInstanceRunning(instance)) {
		return { allowed: false, reason: t("training.gates.testCheck") };
	}
	return ALLOWED;
}

/** ALL Check：需要运行中的实例；成功即结束本 run。 */
export function allCheckRunGate(
	phase: AwdpPhase,
	instance: AwdpInstance | null,
	t: TFunction,
): TrainingGate {
	if (phase !== "fix") {
		return {
			allowed: false,
			reason: t("training.gates.allCheckPhase", { phase: runPhaseLabel(phase, t) }),
		};
	}
	if (!isRunInstanceRunning(instance)) {
		return { allowed: false, reason: t("training.gates.allCheckNotRunning") };
	}
	return ALLOWED;
}

export function sourceRunGate(phase: AwdpPhase, t: TFunction): TrainingGate {
	if (phase === "fix") return ALLOWED;
	return {
		allowed: false,
		reason: t("training.gates.source", { phase: runPhaseLabel(phase, t) }),
	};
}

const RUN_STOP_CONSEQUENCE_KEYS = [
	"training.confirm.consequences.stopRun.c1",
	"training.confirm.consequences.stopRun.c2",
	"training.confirm.consequences.stopRun.c3",
] as const;

const RUN_RESET_CONSEQUENCE_KEYS = [
	"training.confirm.consequences.resetRun.c1",
	"training.confirm.consequences.resetRun.c2",
	"training.confirm.consequences.resetRun.c3",
] as const;

const RUN_END_CONSEQUENCE_KEYS = [
	"training.confirm.consequences.endRun.c1",
	"training.confirm.consequences.endRun.c2",
	"training.confirm.consequences.endRun.c3",
] as const;

const RUN_RESTART_CONSEQUENCE_KEYS = [
	"training.confirm.consequences.restart.c1",
	"training.confirm.consequences.restart.c2",
] as const;

const RUN_INSTANCE_RESET_CONSEQUENCE_KEYS = [
	"training.confirm.consequences.instanceReset.c1",
	"training.confirm.consequences.instanceReset.c2",
	"training.confirm.consequences.instanceReset.c3",
] as const;

const RUN_SET_PHASE_FIX_CONSEQUENCE_KEYS = [
	"training.confirm.consequences.toFix.c1",
	"training.confirm.consequences.toFix.c2",
] as const;

const RUN_SET_PHASE_BREAK_CONSEQUENCE_KEYS = [
	"training.confirm.consequences.toBreak.c1",
	"training.confirm.consequences.toBreak.c2",
	"training.confirm.consequences.toBreak.c3",
] as const;

const RUN_ALL_CHECK_CONSEQUENCE_KEYS = [
	"training.confirm.consequences.allCheck.c1",
	"training.confirm.consequences.allCheck.c2",
	"training.confirm.consequences.allCheck.c3",
] as const;

function translateAll(keys: readonly string[], t: TFunction): string[] {
	return keys.map((key) => t(key));
}

export function runStopConsequences(t: TFunction): string[] {
	return translateAll(RUN_STOP_CONSEQUENCE_KEYS, t);
}

export function runResetConsequences(t: TFunction): string[] {
	return translateAll(RUN_RESET_CONSEQUENCE_KEYS, t);
}

export function runEndConsequences(t: TFunction): string[] {
	return translateAll(RUN_END_CONSEQUENCE_KEYS, t);
}

export function runRestartConsequences(t: TFunction): string[] {
	return translateAll(RUN_RESTART_CONSEQUENCE_KEYS, t);
}

export function runInstanceResetConsequences(t: TFunction): string[] {
	return translateAll(RUN_INSTANCE_RESET_CONSEQUENCE_KEYS, t);
}

export function runSetPhaseFixConsequences(t: TFunction): string[] {
	return translateAll(RUN_SET_PHASE_FIX_CONSEQUENCE_KEYS, t);
}

export function runSetPhaseBreakConsequences(t: TFunction): string[] {
	return translateAll(RUN_SET_PHASE_BREAK_CONSEQUENCE_KEYS, t);
}

export function runAllCheckConsequences(t: TFunction): string[] {
	return translateAll(RUN_ALL_CHECK_CONSEQUENCE_KEYS, t);
}
