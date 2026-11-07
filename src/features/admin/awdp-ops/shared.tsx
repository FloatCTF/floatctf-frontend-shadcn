/**
 * AWDP 运维页的共用语义层：阶段文案、生命周期可用性、破坏性操作后果、参数校验。
 *
 * AWDP 阶段状态机（后端 `AwdpPhaseExt::can_transition_to`）是**线性**的：
 * `pending → break → preparing_fix → fix → ended`，禁止跳级与回退；
 * `preparing_fix` 是真实的过渡态（实例正在被重置为 pristine），必须如实展示。
 *
 * 文案：本文件只产出「已翻译的展示文案」，语言由调用方传入的 `t` 决定（theme.md §8.4）；
 * 阶段 / 动作可用性的**判定**仍然只来自 SDK `AwdpPhase` 与后端守卫，前端不自造状态。
 * 未知阶段值原样透传，不猜测语义。
 */

import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { AwdpPhase, FloatCTFClient } from "@floatctf/sdk";

import { callVoid } from "~/api/call";
import { isFloatCTFError } from "~/api/errors";
import { TonePill, type PillTone } from "~/components/app/badges";
import type { ConfirmOptions } from "~/components/app/confirm";

/* ── 阶段 ─────────────────────────────────────────────────────────────────── */

/** 后端线性阶段顺序（`AwdpPhaseExt::can_transition_to`），用于步骤条展示。 */
export const AWDP_PHASE_ORDER: readonly AwdpPhase[] = [
	"pending",
	"break",
	"preparing_fix",
	"fix",
	"ended",
];

const PHASE_LABEL_KEY: Record<string, string> = {
	pending: "adminAwdpOps.phase.label.pending",
	break: "adminAwdpOps.phase.label.break",
	preparing_fix: "adminAwdpOps.phase.label.preparingFix",
	fix: "adminAwdpOps.phase.label.fix",
	ended: "adminAwdpOps.phase.label.ended",
};

const PHASE_DESCRIPTION_KEY: Record<string, string> = {
	pending: "adminAwdpOps.phase.description.pending",
	break: "adminAwdpOps.phase.description.break",
	preparing_fix: "adminAwdpOps.phase.description.preparingFix",
	fix: "adminAwdpOps.phase.description.fix",
	ended: "adminAwdpOps.phase.description.ended",
};

const PHASE_TONE: Record<string, PillTone> = {
	pending: "muted",
	break: "info",
	preparing_fix: "warning",
	fix: "success",
	ended: "muted",
};

/** 阶段名：已知值走 i18n，未知值原样透传（theme.md §8.4 技术标识保持原文）。 */
export function awdpPhaseLabel(phase: AwdpPhase | string | null | undefined, t: TFunction): string {
	if (phase === null || phase === undefined || phase === "") {
		return t("adminAwdpOps.phase.label.unknown");
	}
	const key = PHASE_LABEL_KEY[phase];
	return key ? t(key) : phase;
}

/** 阶段说明：未知阶段给出「先刷新配置」的下一步，而不是空文案。 */
export function awdpPhaseDescription(
	phase: AwdpPhase | string | null | undefined,
	t: TFunction,
): string {
	const key = phase ? PHASE_DESCRIPTION_KEY[phase] : undefined;
	return key ? t(key) : t("adminAwdpOps.phase.description.unknown");
}

export function awdpPhaseTone(phase: AwdpPhase | string | null | undefined): PillTone {
	if (!phase) return "muted";
	return PHASE_TONE[phase] ?? "neutral";
}

export function AwdpPhasePill({
	phase,
}: {
	phase: AwdpPhase | string | null | undefined;
}): ReactNode {
	const { t } = useTranslation();
	const description = awdpPhaseDescription(phase, t);
	return (
		<TonePill tone={awdpPhaseTone(phase)} title={description}>
			{awdpPhaseLabel(phase, t)}
		</TonePill>
	);
}

/* ── 生命周期动作 ─────────────────────────────────────────────────────────── */

export type AwdpAction = "start" | "breakToFix" | "finish";

export const AWDP_ACTION_ORDER: readonly AwdpAction[] = ["start", "breakToFix", "finish"];

const ACTION_LABEL_KEY: Record<AwdpAction, string> = {
	start: "adminAwdpOps.actions.start",
	breakToFix: "adminAwdpOps.actions.breakToFix",
	finish: "adminAwdpOps.actions.finish",
};

export function awdpActionLabel(action: AwdpAction, t: TFunction): string {
	return t(ACTION_LABEL_KEY[action]);
}

export async function runAwdpAction(
	client: FloatCTFClient,
	eventId: string,
	action: AwdpAction,
	t: TFunction,
): Promise<void> {
	const admin = client.awdp.admin;
	const what = awdpActionLabel(action, t);
	switch (action) {
		case "start":
			return callVoid(admin.start(eventId), what);
		case "breakToFix":
			return callVoid(admin.breakToFix(eventId), what);
		case "finish":
			return callVoid(admin.finish(eventId), what);
	}
}

/**
 * 破坏性确认文案。三个生命周期动作全部是不可逆的高危操作，因此都带 `confirmPhrase`：
 * - start：创建 run 并锁定配置，赛事结束后不能重开；
 * - breakToFix：重置**全部**实例为 pristine；
 * - finish：终态，不再接受提交。
 */
export function awdpActionConfirm(action: AwdpAction, t: TFunction): ConfirmOptions {
	switch (action) {
		case "start":
			return {
				title: t("adminAwdpOps.confirm.start.title"),
				description: t("adminAwdpOps.confirm.start.description"),
				consequences: [
					t("adminAwdpOps.confirm.start.consequence1"),
					t("adminAwdpOps.confirm.start.consequence2"),
					t("adminAwdpOps.confirm.start.consequence3"),
					t("adminAwdpOps.confirm.start.consequence4"),
				],
				tone: "danger",
				confirmText: t("adminAwdpOps.confirm.start.confirmText"),
				confirmPhrase: "start",
			};
		case "breakToFix":
			return {
				title: t("adminAwdpOps.confirm.breakToFix.title"),
				description: t("adminAwdpOps.confirm.breakToFix.description"),
				consequences: [
					t("adminAwdpOps.confirm.breakToFix.consequence1"),
					t("adminAwdpOps.confirm.breakToFix.consequence2"),
					t("adminAwdpOps.confirm.breakToFix.consequence3"),
					t("adminAwdpOps.confirm.breakToFix.consequence4"),
				],
				tone: "danger",
				confirmText: t("adminAwdpOps.confirm.breakToFix.confirmText"),
				confirmPhrase: "reset",
			};
		case "finish":
			return {
				title: t("adminAwdpOps.confirm.finish.title"),
				description: t("adminAwdpOps.confirm.finish.description"),
				consequences: [
					t("adminAwdpOps.confirm.finish.consequence1"),
					t("adminAwdpOps.confirm.finish.consequence2"),
					t("adminAwdpOps.confirm.finish.consequence3"),
				],
				tone: "danger",
				confirmText: t("adminAwdpOps.confirm.finish.confirmText"),
				confirmPhrase: "finish",
			};
	}
}

export interface AwdpActionGate {
	enabled: boolean;
	reason: string | null;
}

/**
 * 阶段 → 动作可用性。与后端守卫一一对应：
 * - start：`create_competition_run` 要求无 active run（pending）；已有 ended run 时拒绝重启；
 * - breakToFix：`transition_break_to_fix` 从 break 推进，也允许从 preparing_fix 重试；
 * - finish：`finish_awdp_event` 只做 Fix → Ended。
 */
export function buildAwdpGates(
	phase: AwdpPhase | string | null,
	t: TFunction,
): Record<AwdpAction, AwdpActionGate> {
	switch (phase) {
		case "pending":
			return {
				start: { enabled: true, reason: null },
				breakToFix: { enabled: false, reason: t("adminAwdpOps.phase.gates.pending.breakToFix") },
				finish: { enabled: false, reason: t("adminAwdpOps.phase.gates.pending.finish") },
			};
		case "break":
			return {
				start: { enabled: false, reason: t("adminAwdpOps.phase.gates.break.start") },
				breakToFix: { enabled: true, reason: null },
				finish: { enabled: false, reason: t("adminAwdpOps.phase.gates.break.finish") },
			};
		case "preparing_fix":
			return {
				start: { enabled: false, reason: t("adminAwdpOps.phase.gates.preparingFix.start") },
				breakToFix: { enabled: true, reason: null },
				finish: { enabled: false, reason: t("adminAwdpOps.phase.gates.preparingFix.finish") },
			};
		case "fix":
			return {
				start: { enabled: false, reason: t("adminAwdpOps.phase.gates.fix.start") },
				breakToFix: { enabled: false, reason: t("adminAwdpOps.phase.gates.fix.breakToFix") },
				finish: { enabled: true, reason: null },
			};
		case "ended":
			return {
				start: { enabled: false, reason: t("adminAwdpOps.phase.gates.ended.start") },
				breakToFix: { enabled: false, reason: t("adminAwdpOps.phase.gates.ended.breakToFix") },
				finish: { enabled: false, reason: t("adminAwdpOps.phase.gates.ended.finish") },
			};
		default: {
			const reason = t("adminAwdpOps.phase.gates.unknown");
			return {
				start: { enabled: false, reason },
				breakToFix: { enabled: false, reason },
				finish: { enabled: false, reason },
			};
		}
	}
}

/** 乐观锁冲突（后端 409）：配置已被他人修改。 */
export function isAwdpConflict(error: unknown): boolean {
	return isFloatCTFError(error) && error.httpStatus === 409;
}

/* ── 实例运行态（后端 `runtime_state`）────────────────────────────────────── */

const RUNTIME_LABEL_KEY: Record<string, string> = {
	running: "adminAwdpOps.instances.runtime.running",
	resetting: "adminAwdpOps.instances.runtime.resetting",
	pending: "adminAwdpOps.instances.runtime.pending",
	stopped: "adminAwdpOps.instances.runtime.stopped",
	exited: "adminAwdpOps.instances.runtime.exited",
};

const RUNTIME_TONE: Record<string, PillTone> = {
	running: "success",
	resetting: "warning",
	pending: "warning",
	stopped: "muted",
	exited: "muted",
};

/** 未知运行态保持后端原文（技术标识不翻译）。 */
export function awdpRuntimeLabel(state: string | null | undefined, t: TFunction): string {
	if (!state) return "—";
	const key = RUNTIME_LABEL_KEY[state];
	return key ? t(key) : state;
}

export function awdpRuntimeTone(state: string | null | undefined): PillTone {
	if (!state) return "muted";
	return RUNTIME_TONE[state] ?? "neutral";
}

/* ── GameBox 构建状态（后端 `BUILD_STATUS_*`）────────────────────────────── */

const BUILD_STATUS_LABEL_KEY: Record<string, string> = {
	ready: "adminAwdpOps.gameboxes.buildStatus.ready",
	building: "adminAwdpOps.gameboxes.buildStatus.building",
	failed: "adminAwdpOps.gameboxes.buildStatus.failed",
};

const BUILD_STATUS_TONE: Record<string, PillTone> = {
	ready: "success",
	building: "warning",
	failed: "danger",
};

/** 未知构建状态保持后端原文（技术标识不翻译）。 */
export function awdpBuildStatusLabel(status: string | null | undefined, t: TFunction): string {
	if (!status) return "—";
	const key = BUILD_STATUS_LABEL_KEY[status];
	return key ? t(key) : status;
}

export function awdpBuildStatusTone(status: string | null | undefined): PillTone {
	if (!status) return "muted";
	return BUILD_STATUS_TONE[status] ?? "neutral";
}

/* ── 配置校验（后端 `AwdpConfig::validate()` 的约束；后端仍是权威）────────── */

export function validateFixTiming(
	fixDuration: number,
	interval: number,
	t: TFunction,
): string | null {
	if (!Number.isInteger(fixDuration) || fixDuration <= 0) {
		return t("adminAwdpOps.config.errors.durationPositive");
	}
	if (!Number.isInteger(interval) || interval <= 0) {
		return t("adminAwdpOps.config.errors.intervalPositive");
	}
	if (fixDuration % interval !== 0) {
		return t("adminAwdpOps.config.errors.notDivisible", {
			duration: fixDuration,
			interval,
		});
	}
	return null;
}
