/**
 * AWDP 选手端语义 —— 阶段 / 评测状态 / 动作可用性的**唯一**映射出处。
 *
 * 阶段与动作门禁全部来自后端真实约束（`apps/api/src/modules/event/awdp/`）：
 * - `break_service::submit_flag`：`phase != Break` → InvalidState（只有 Break 阶段能交 flag）；
 * - `patch_service::apply_patch`：`phase != Fix` → InvalidState；且实例必须 `running`；
 * - `api/player.rs::download_source`：`phase != Fix` → InvalidState（源码仅在 Fix 阶段）；
 * - `api/player.rs::manual_test_check`：实例未启动 → NotFound（Test Check 前必须先在跑实例）。
 * 因此前端把这几条做成**显式禁用 + 原因**，而不是让用户点了再吃 4xx。
 *
 * 文案：本文件只产出「已翻译的展示文案」，语言由调用方传入的 `t` 决定（docs/theme.md §8.4）；
 * 阶段 / 状态的**判定**仍然只来自 SDK 的 `AwdpPhase` 与后端 `status` 字符串，前端不自造状态。
 */

import type { TFunction } from "i18next";

import type { AwdpInstance, AwdpPhase } from "@floatctf/sdk";

import type { PillTone } from "~/components/app/badges";
import { isFloatCTFError } from "~/api/errors";

export interface AwdpGate {
	allowed: boolean;
	/** 不允许时的原因（必须渲染出来，不静默禁用）。 */
	reason: string;
}

const ALLOWED: AwdpGate = { allowed: true, reason: "" };

/** `api/awdp.ts` 的 `AwdpPhase` 字符串联合 —— 含过渡态 `preparing_fix`。 */
export const AWDP_PHASE_ORDER: readonly AwdpPhase[] = [
	"pending",
	"break",
	"preparing_fix",
	"fix",
	"ended",
];

const PHASE_TONE: Record<AwdpPhase, PillTone> = {
	pending: "muted",
	break: "info",
	preparing_fix: "warning",
	fix: "success",
	ended: "muted",
};

export function awdpPhaseLabel(phase: AwdpPhase | null | undefined, t: TFunction): string {
	switch (phase) {
		case "pending":
			return t("awdp.phases.pending");
		case "break":
			return t("awdp.phases.break");
		case "preparing_fix":
			return t("awdp.phases.preparingFix");
		case "fix":
			return t("awdp.phases.fix");
		case "ended":
			return t("awdp.phases.ended");
		default:
			return t("awdp.phases.unknown");
	}
}

export function awdpPhaseTone(phase: AwdpPhase | null | undefined): PillTone {
	if (!phase) return "muted";
	return PHASE_TONE[phase] ?? "neutral";
}

export function awdpPhaseIndex(phase: AwdpPhase | null | undefined): number {
	if (!phase) return -1;
	return AWDP_PHASE_ORDER.indexOf(phase);
}

/** 官方评测 / manual 评估状态（`awdp_evaluation_status`）—— 未知值保持后端原文。 */
export function awdpEvaluationLabel(status: string | null | undefined, t: TFunction): string {
	switch (status) {
		case "pending":
			return t("awdp.evaluationStatus.pending");
		case "running":
			return t("awdp.evaluationStatus.running");
		case "no_patch":
			return t("awdp.evaluationStatus.noPatch");
		case "service_down":
			return t("awdp.evaluationStatus.serviceDown");
		case "functional_broken":
			return t("awdp.evaluationStatus.functionalBroken");
		case "vulnerable":
			return t("awdp.evaluationStatus.vulnerable");
		case "patched":
			return t("awdp.evaluationStatus.patched");
		case "platform_error":
			return t("awdp.evaluationStatus.platformError");
		case null:
		case undefined:
		case "":
			return "—";
		default:
			return status;
	}
}

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

export function awdpEvaluationTone(status: string | null | undefined): PillTone {
	if (!status) return "muted";
	return EVAL_STATUS_TONE[status] ?? "neutral";
}

/** 评估类型（`awdp_evaluation_kind`）：official = 官方回合判定；manual = Test Check 自检。 */
export function awdpEvaluationKindLabel(kind: string, t: TFunction): string {
	switch (kind) {
		case "official":
			return t("awdp.rounds.kindOfficial");
		case "manual":
			return t("awdp.rounds.kindManual");
		default:
			return kind;
	}
}

/** Fix 回合状态：后端会写 `pending` / `evaluating` / `completed`（`repo/round_repo.rs`）。 */
export function awdpRoundStatusLabel(status: string | null | undefined, t: TFunction): string {
	switch (status) {
		case "pending":
			return t("awdp.rounds.statusPending");
		case "evaluating":
			return t("awdp.rounds.statusEvaluating");
		case "completed":
			return t("awdp.rounds.statusCompleted");
		case null:
		case undefined:
		case "":
			return "—";
		default:
			return status;
	}
}

export function awdpRoundStatusTone(status: string | null | undefined): PillTone {
	switch (status) {
		case "pending":
			return "warning";
		case "evaluating":
			return "info";
		case "completed":
			return "info";
		default:
			return "muted";
	}
}

/** 实例运行态：后端只写 `running` / `stopped`（`awdp/service/runtime.rs`）。 */
export function awdpRuntimeLabel(state: string | null | undefined, t: TFunction): string {
	switch (state) {
		case "running":
			return t("awdp.runtime.running");
		case "stopped":
			return t("awdp.runtime.stopped");
		case null:
		case undefined:
		case "":
			return t("awdp.runtime.notStarted");
		default:
			return state;
	}
}

export function awdpRuntimeTone(state: string | null | undefined): PillTone {
	switch (state) {
		case "running":
			return "success";
		case "stopped":
			return "muted";
		case null:
		case undefined:
		case "":
			return "muted";
		default:
			return "neutral";
	}
}

export function isInstanceRunning(instance: AwdpInstance | null | undefined): boolean {
	return instance?.runtime_state === "running";
}

/** Break flag 提交：仅 Break 阶段。 */
export function awdpBreakGate(phase: AwdpPhase, t: TFunction): AwdpGate {
	if (phase === "break") return ALLOWED;
	if (phase === "preparing_fix") {
		return { allowed: false, reason: t("awdp.gates.breakPreparingFix") };
	}
	return {
		allowed: false,
		reason: t("awdp.gates.breakOnly", { phase: awdpPhaseLabel(phase, t) }),
	};
}

/** 补丁上传：仅 Fix 阶段，且实例必须运行中。 */
export function awdpPatchGate(phase: AwdpPhase, instance: AwdpInstance | null, t: TFunction): AwdpGate {
	if (phase !== "fix") {
		return {
			allowed: false,
			reason: t("awdp.gates.patchOnly", { phase: awdpPhaseLabel(phase, t) }),
		};
	}
	if (!isInstanceRunning(instance)) {
		return { allowed: false, reason: t("awdp.gates.patchNotRunning") };
	}
	return ALLOWED;
}

/**
 * 实例生命周期动作（启动 / 停止 / 重置）的阶段门。
 * 后端 `service/runtime.rs::start_instance` 明确要求 `phase ∈ {Break, Fix}`（第 119-126 行），
 * 其它阶段直接 InvalidState；pending / ended 连 active run 都没有。
 */
export function awdpInstanceControlGate(phase: AwdpPhase, t: TFunction): AwdpGate {
	if (phase === "break" || phase === "fix") return ALLOWED;
	if (phase === "pending") return { allowed: false, reason: t("awdp.gates.controlPending") };
	if (phase === "preparing_fix") {
		return { allowed: false, reason: t("awdp.gates.controlPreparingFix") };
	}
	return { allowed: false, reason: t("awdp.gates.controlEnded") };
}

/** 手工 Test Check：后端要求实例已启动（否则 404 instance not started）。 */
export function awdpTestCheckGate(instance: AwdpInstance | null, t: TFunction): AwdpGate {
	if (!isInstanceRunning(instance)) {
		return { allowed: false, reason: t("awdp.gates.testCheckNotRunning") };
	}
	return ALLOWED;
}

/** 源码下载：仅 Fix 阶段（后端在其它阶段直接拒绝）。 */
export function awdpSourceGate(phase: AwdpPhase, t: TFunction): AwdpGate {
	if (phase === "fix") return ALLOWED;
	return {
		allowed: false,
		reason: t("awdp.gates.sourceFixOnly", { phase: awdpPhaseLabel(phase, t) }),
	};
}

/** 停止实例的真实后果（后端：官方判定需要 running 实例）。 */
export function awdpStopConsequences(t: TFunction): string[] {
	return [
		t("awdp.confirm.stopConsequence1"),
		t("awdp.confirm.stopConsequence2"),
		t("awdp.confirm.stopConsequence3"),
	];
}

/** 破坏性操作：实例重置的真实后果。 */
export function awdpInstanceResetConsequences(t: TFunction): string[] {
	return [
		t("awdp.confirm.resetConsequence1"),
		t("awdp.confirm.resetConsequence2"),
		t("awdp.confirm.resetConsequence3"),
	];
}

export function awdpRunResetConsequences(t: TFunction): string[] {
	return [
		t("awdp.confirm.runResetConsequence1"),
		t("awdp.confirm.runResetConsequence2"),
		t("awdp.confirm.runResetConsequence3"),
	];
}

export function awdpRunEndConsequences(t: TFunction): string[] {
	return [
		t("awdp.confirm.runEndConsequence1"),
		t("awdp.confirm.runEndConsequence2"),
		t("awdp.confirm.runEndConsequence3"),
	];
}

/**
 * 赛事未启用 AWDP：后端 `api/player.rs::get_overview` 对非 AWDP 赛事返回
 * `AppError::Validation("not an AWDP event")`。这属于业务态，应显示空态而不是错误块。
 */
export function isAwdpNotConfigured(error: unknown): boolean {
	if (!isFloatCTFError(error)) return false;
	return (error.platformMessage ?? "").toLowerCase().includes("not an awdp event");
}
