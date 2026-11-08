/**
 * AWD 运维页的共用语义层：状态文案、生命周期可用性判定、破坏性操作的真实后果、预检报告解析。
 *
 * 两条硬约束（来自 CONVENTIONS §0.9 与 §2）：
 * - 状态判定**只**用后端返回的 `status` / `phase` / `final_settlement` / 网络分配结果，
 *   不在前端用时间或本地推导替代后端状态；
 * - 每个动作的禁用原因都写成可直接展示的文案（`title` + 页面提示），不出现「按钮灰着但不知为何」。
 *
 * i18n（CONVENTIONS §10.2）：本文件只负责「后端字段 → i18n key」的映射；
 * 文案由调用方传入的 `t` 现译，语言切换后即时生效。未知枚举值**原样透传**，
 * 不伪装成已知状态。
 */

import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { FloatCTFClient } from "@floatctf/sdk";
import { AwdEventStatus, AwdPhase, GameboxStatus } from "@floatctf/sdk/entity";

import { callVoid } from "~/api/call";
import { isFloatCTFError } from "~/api/errors";
import { TonePill, type PillTone } from "~/components/app/badges";
import type { ConfirmOptions } from "~/components/app/confirm";
import { EVENT_FAMILY_KEY, EVENT_PURPOSE_KEY } from "~/lib/event-status";

/* ── 状态文案（后端 awd_event_status / awd_phase 的枚举值）────────────────── */

const STATUS_KEYS: Record<AwdEventStatus, string> = {
	[AwdEventStatus.Draft]: "adminAwdOps.state.status.draft",
	[AwdEventStatus.Configuring]: "adminAwdOps.state.status.configuring",
	[AwdEventStatus.Deploying]: "adminAwdOps.state.status.deploying",
	[AwdEventStatus.Deployed]: "adminAwdOps.state.status.deployed",
	[AwdEventStatus.Prechecking]: "adminAwdOps.state.status.prechecking",
	[AwdEventStatus.Verified]: "adminAwdOps.state.status.verified",
	[AwdEventStatus.Running]: "adminAwdOps.state.status.running",
	[AwdEventStatus.Paused]: "adminAwdOps.state.status.paused",
	[AwdEventStatus.NetworkError]: "adminAwdOps.state.status.networkError",
	[AwdEventStatus.StartBlocked]: "adminAwdOps.state.status.startBlocked",
	[AwdEventStatus.Finished]: "adminAwdOps.state.status.finished",
	[AwdEventStatus.Archived]: "adminAwdOps.state.status.archived",
	[AwdEventStatus.DeployFailed]: "adminAwdOps.state.status.deployFailed",
	[AwdEventStatus.VerificationFailed]: "adminAwdOps.state.status.verificationFailed",
};

const STATUS_TONES: Record<AwdEventStatus, PillTone> = {
	[AwdEventStatus.Draft]: "muted",
	[AwdEventStatus.Configuring]: "info",
	[AwdEventStatus.Deploying]: "info",
	[AwdEventStatus.Deployed]: "info",
	[AwdEventStatus.Prechecking]: "info",
	[AwdEventStatus.Verified]: "success",
	[AwdEventStatus.Running]: "success",
	[AwdEventStatus.Paused]: "warning",
	[AwdEventStatus.NetworkError]: "danger",
	[AwdEventStatus.StartBlocked]: "warning",
	[AwdEventStatus.Finished]: "neutral",
	[AwdEventStatus.Archived]: "muted",
	[AwdEventStatus.DeployFailed]: "danger",
	[AwdEventStatus.VerificationFailed]: "danger",
};

const PHASE_KEYS: Record<AwdPhase, string> = {
	[AwdPhase.Hardening]: "adminAwdOps.state.phase.hardening",
	[AwdPhase.Attack]: "adminAwdOps.state.phase.attack",
	[AwdPhase.Pause]: "adminAwdOps.state.phase.pause",
};

const PHASE_TONES: Record<AwdPhase, PillTone> = {
	[AwdPhase.Hardening]: "info",
	[AwdPhase.Attack]: "success",
	[AwdPhase.Pause]: "warning",
};

/** 实例运行时状态（`gamebox_status`）；未知值原样展示。 */
const GAMEBOX_STATUS_KEYS: Record<GameboxStatus, string> = {
	[GameboxStatus.Pending]: "adminAwdOps.state.gamebox.pending",
	[GameboxStatus.Creating]: "adminAwdOps.state.gamebox.creating",
	[GameboxStatus.Running]: "adminAwdOps.state.gamebox.running",
	[GameboxStatus.Ready]: "adminAwdOps.state.gamebox.ready",
	[GameboxStatus.Resetting]: "adminAwdOps.state.gamebox.resetting",
	[GameboxStatus.Missing]: "adminAwdOps.state.gamebox.missing",
	[GameboxStatus.Orphan]: "adminAwdOps.state.gamebox.orphan",
	[GameboxStatus.Conflict]: "adminAwdOps.state.gamebox.conflict",
	[GameboxStatus.StartFailed]: "adminAwdOps.state.gamebox.startFailed",
	[GameboxStatus.ResetFailed]: "adminAwdOps.state.gamebox.resetFailed",
	[GameboxStatus.Stopped]: "adminAwdOps.state.gamebox.stopped",
};

const GAMEBOX_STATUS_TONES: Record<GameboxStatus, PillTone> = {
	[GameboxStatus.Pending]: "muted",
	[GameboxStatus.Creating]: "info",
	[GameboxStatus.Running]: "success",
	[GameboxStatus.Ready]: "success",
	[GameboxStatus.Resetting]: "warning",
	[GameboxStatus.Missing]: "danger",
	[GameboxStatus.Orphan]: "danger",
	[GameboxStatus.Conflict]: "danger",
	[GameboxStatus.StartFailed]: "danger",
	[GameboxStatus.ResetFailed]: "danger",
	[GameboxStatus.Stopped]: "danger",
};

/** 赛事状态：`null` = 尚未开通 AWD；未知值原样透传。 */
export function awdStatusLabel(status: string | null | undefined, t: TFunction): string {
	if (!status) return t("adminAwdOps.state.notEnabled");
	const key = STATUS_KEYS[status as AwdEventStatus];
	return key ? t(key) : status;
}

export function awdStatusTone(status: string | null | undefined): PillTone {
	if (!status) return "muted";
	return STATUS_TONES[status as AwdEventStatus] ?? "neutral";
}

/** AWD 阶段：空值用 `—`；未知值原样透传。 */
export function awdPhaseLabel(phase: string | null | undefined, t: TFunction): string {
	if (!phase) return "—";
	const key = PHASE_KEYS[phase as AwdPhase];
	return key ? t(key) : phase;
}

export function awdPhaseTone(phase: string | null | undefined): PillTone {
	if (!phase) return "muted";
	return PHASE_TONES[phase as AwdPhase] ?? "neutral";
}

export function gameboxStatusLabel(status: string | null | undefined, t: TFunction): string {
	if (!status) return "—";
	const key = GAMEBOX_STATUS_KEYS[status as GameboxStatus];
	return key ? t(key) : status;
}

export function gameboxStatusTone(status: string | null | undefined): PillTone {
	if (!status) return "muted";
	return GAMEBOX_STATUS_TONES[status as GameboxStatus] ?? "neutral";
}

/** 赛制 / 用途：使用共享 key 映射；未知值原样透传。 */
export function eventFamilyLabel(family: string | null | undefined, t: TFunction): string {
	if (!family) return "—";
	const key = EVENT_FAMILY_KEY[family];
	return key ? t(key) : family;
}

export function eventPurposeLabel(purpose: string | null | undefined, t: TFunction): string {
	if (!purpose) return "—";
	const key = EVENT_PURPOSE_KEY[purpose];
	return key ? t(key) : purpose;
}

/** 状态 + 阶段徽章；阶段缺失时如实显示「—」。 */
export function AwdStatusPill({
	status,
	phase,
	finalSettlement = false,
}: {
	status: string | null | undefined;
	phase?: string | null;
	finalSettlement?: boolean;
}): ReactNode {
	const { t } = useTranslation();
	// 终态赛事不再有「当前阶段」：archived/finished 还显示「加固期」会误导。
	const terminal = status === "finished" || status === "archived";
	return (
		<span className="inline-flex flex-wrap items-center gap-1.5">
			<TonePill tone={awdStatusTone(status)}>{awdStatusLabel(status, t)}</TonePill>
			{phase && !terminal ? (
				<TonePill tone={awdPhaseTone(phase)}>{awdPhaseLabel(phase, t)}</TonePill>
			) : null}
			{finalSettlement ? (
				<TonePill tone="warning" title={t("adminAwdOps.state.finalSettlementTitle")}>
					{t("adminAwdOps.state.finalSettlement")}
				</TonePill>
			) : null}
		</span>
	);
}

/* ── 生命周期动作 ─────────────────────────────────────────────────────────── */

export type AwdAction =
	| "deploy"
	| "precheck"
	| "start"
	| "pause"
	| "resume"
	| "finish"
	| "archive"
	| "rotateTokens";

const ACTION_KEYS: Record<AwdAction, string> = {
	deploy: "adminAwdOps.actions.deploy",
	precheck: "adminAwdOps.actions.precheck",
	start: "adminAwdOps.actions.start",
	pause: "adminAwdOps.actions.pause",
	resume: "adminAwdOps.actions.resume",
	finish: "adminAwdOps.actions.finish",
	archive: "adminAwdOps.actions.archive",
	rotateTokens: "adminAwdOps.actions.rotateTokens",
};

export function awdActionLabel(action: AwdAction, t: TFunction): string {
	return t(ACTION_KEYS[action]);
}

/** 调用后端生命周期接口（返回 null 的动作统一走 `callVoid`）。 */
export async function runAwdAction(
	client: FloatCTFClient,
	eventId: string,
	action: AwdAction,
	t: TFunction,
): Promise<void> {
	const awd = client.awd.admin;
	const label = awdActionLabel(action, t);
	switch (action) {
		case "deploy":
			return callVoid(awd.deploy(eventId), label);
		case "precheck":
			return callVoid(awd.precheck(eventId), label);
		case "start":
			return callVoid(awd.start(eventId), label);
		case "pause":
			return callVoid(awd.pause(eventId), label);
		case "resume":
			return callVoid(awd.resume(eventId), label);
		case "finish":
			return callVoid(awd.finish(eventId), label);
		case "archive":
			return callVoid(awd.archive(eventId), label);
		case "rotateTokens":
			return callVoid(awd.rotateTokens(eventId), label);
	}
}

/**
 * 破坏性 / 不可逆操作的真实后果（逐条对应后端实现，不编造）。
 * 返回 `ConfirmOptions`，由 `useConfirm()` 的 `AlertDialog` 渲染。
 */
export function awdActionConfirm(t: TFunction, action: AwdAction): ConfirmOptions {
	switch (action) {
		case "deploy":
			return {
				title: t("adminAwdOps.confirm.deploy.title"),
				description: t("adminAwdOps.confirm.deploy.description"),
				consequences: [
					t("adminAwdOps.confirm.deploy.consequence1"),
					t("adminAwdOps.confirm.deploy.consequence2"),
					t("adminAwdOps.confirm.deploy.consequence3"),
				],
				tone: "danger",
				confirmText: t("adminAwdOps.confirm.deploy.confirm"),
			};
		case "precheck":
			return {
				title: t("adminAwdOps.confirm.precheck.title"),
				description: t("adminAwdOps.confirm.precheck.description"),
				consequences: [
					t("adminAwdOps.confirm.precheck.consequence1"),
					t("adminAwdOps.confirm.precheck.consequence2"),
				],
				confirmText: t("adminAwdOps.confirm.precheck.confirm"),
			};
		case "start":
			return {
				title: t("adminAwdOps.confirm.start.title"),
				description: t("adminAwdOps.confirm.start.description"),
				consequences: [
					t("adminAwdOps.confirm.start.consequence1"),
					t("adminAwdOps.confirm.start.consequence2"),
					t("adminAwdOps.confirm.start.consequence3"),
				],
				tone: "danger",
				confirmText: t("adminAwdOps.confirm.start.confirm"),
			};
		case "pause":
			return {
				title: t("adminAwdOps.confirm.pause.title"),
				description: t("adminAwdOps.confirm.pause.description"),
				consequences: [
					t("adminAwdOps.confirm.pause.consequence1"),
					t("adminAwdOps.confirm.pause.consequence2"),
					t("adminAwdOps.confirm.pause.consequence3"),
				],
				confirmText: t("adminAwdOps.confirm.pause.confirm"),
			};
		case "resume":
			return {
				title: t("adminAwdOps.confirm.resume.title"),
				description: t("adminAwdOps.confirm.resume.description"),
				consequences: [
					t("adminAwdOps.confirm.resume.consequence1"),
					t("adminAwdOps.confirm.resume.consequence2"),
				],
				confirmText: t("adminAwdOps.confirm.resume.confirm"),
			};
		case "finish":
			return {
				title: t("adminAwdOps.confirm.finish.title"),
				description: t("adminAwdOps.confirm.finish.description"),
				consequences: [
					t("adminAwdOps.confirm.finish.consequence1"),
					t("adminAwdOps.confirm.finish.consequence2"),
				],
				tone: "danger",
				confirmText: t("adminAwdOps.confirm.finish.confirm"),
			};
		case "archive":
			return {
				title: t("adminAwdOps.confirm.archive.title"),
				description: t("adminAwdOps.confirm.archive.description"),
				consequences: [
					t("adminAwdOps.confirm.archive.consequence1"),
					t("adminAwdOps.confirm.archive.consequence2"),
					t("adminAwdOps.confirm.archive.consequence3"),
					t("adminAwdOps.confirm.archive.consequence4"),
				],
				tone: "danger",
				confirmText: t("adminAwdOps.confirm.archive.confirm"),
				confirmPhrase: "archive",
			};
		case "rotateTokens":
			return {
				title: t("adminAwdOps.confirm.rotateTokens.title"),
				description: t("adminAwdOps.confirm.rotateTokens.description"),
				consequences: [
					t("adminAwdOps.confirm.rotateTokens.consequence1"),
					t("adminAwdOps.confirm.rotateTokens.consequence2"),
					t("adminAwdOps.confirm.rotateTokens.consequence3"),
					t("adminAwdOps.confirm.rotateTokens.consequence4"),
				],
				tone: "danger",
				confirmText: t("adminAwdOps.confirm.rotateTokens.confirm"),
				confirmPhrase: "rotate",
			};
	}
}

export interface AwdActionGate {
	enabled: boolean;
	/** 不可用时的原因（已翻译，直接展示给管理员）。 */
	reason: string | null;
}

export interface AwdGateInput {
	status: string | null;
	/** 赛事网络是否已分配（`getEventNetwork` 未返回 404）。 */
	networkAllocated: boolean;
	finalSettlement: boolean;
}

/** 后端 `AwdEventStatus::is_configurable()` 的字面值集合。 */
const CONFIGURABLE_STATUSES: string[] = [
	AwdEventStatus.Draft,
	AwdEventStatus.Configuring,
	AwdEventStatus.Deployed,
	AwdEventStatus.Prechecking,
	AwdEventStatus.Verified,
	AwdEventStatus.StartBlocked,
	AwdEventStatus.DeployFailed,
	AwdEventStatus.VerificationFailed,
];

/** 可（重新）部署的状态：处于运行前的配置态，允许修复后重试。 */
const DEPLOYABLE_STATUSES: string[] = [
	AwdEventStatus.Draft,
	AwdEventStatus.Configuring,
	AwdEventStatus.Deployed,
	AwdEventStatus.DeployFailed,
	AwdEventStatus.VerificationFailed,
];

const TERMINAL_STATUSES: string[] = [AwdEventStatus.Finished, AwdEventStatus.Archived];

/** 不可部署时的**逐状态**原因（比一句笼统的「当前状态不支持」更有用）。 */
const DEPLOY_BLOCK_KEYS: Record<string, string> = {
	[AwdEventStatus.Deploying]: "adminAwdOps.gates.deployBlock.deploying",
	[AwdEventStatus.Prechecking]: "adminAwdOps.gates.deployBlock.prechecking",
	[AwdEventStatus.Verified]: "adminAwdOps.gates.deployBlock.verified",
	[AwdEventStatus.StartBlocked]: "adminAwdOps.gates.deployBlock.startBlocked",
	[AwdEventStatus.Running]: "adminAwdOps.gates.deployBlock.running",
	[AwdEventStatus.Paused]: "adminAwdOps.gates.deployBlock.paused",
	[AwdEventStatus.NetworkError]: "adminAwdOps.gates.deployBlock.networkError",
	[AwdEventStatus.Finished]: "adminAwdOps.gates.deployBlock.finished",
	[AwdEventStatus.Archived]: "adminAwdOps.gates.deployBlock.archived",
};

/** 不可预检时的逐状态原因。 */
const PRECHECK_BLOCK_KEYS: Record<string, string> = {
	[AwdEventStatus.Deploying]: "adminAwdOps.gates.precheckBlock.deploying",
	[AwdEventStatus.Running]: "adminAwdOps.gates.precheckBlock.running",
	[AwdEventStatus.Paused]: "adminAwdOps.gates.precheckBlock.paused",
	[AwdEventStatus.NetworkError]: "adminAwdOps.gates.precheckBlock.networkError",
	[AwdEventStatus.Finished]: "adminAwdOps.gates.precheckBlock.finished",
	[AwdEventStatus.Archived]: "adminAwdOps.gates.precheckBlock.archived",
};

function deployReason(status: string, t: TFunction): string {
	const key = DEPLOY_BLOCK_KEYS[status];
	return key
		? t(key)
		: t("adminAwdOps.gates.deployBlocked", { status: awdStatusLabel(status, t) });
}

function precheckReason(status: string, t: TFunction): string {
	const key = PRECHECK_BLOCK_KEYS[status];
	return key
		? t(key)
		: t("adminAwdOps.gates.precheckBlocked", { status: awdStatusLabel(status, t) });
}

/**
 * 依据后端状态判定每个动作可用性。
 * 判定与后端守卫一一对应：
 * - deploy：`deploy_service` 接受 `is_configurable()` 的状态（幂等重入 Deploying/Deployed）；
 * - precheck：`precheck_service` 要求 is_configurable() 且赛事网络已分配；
 * - start：`event_service::start_event` 要求 status == Verified；
 * - pause：status == Running；resume：status ∈ {Paused, NetworkError}；
 * - finish：`maybe_finish_event` 仅在 Running 且终局结算成立时才真正结束；
 * - archive：`archive_service` 要求 status == Finished；
 * - rotateTokens：需要已配置且赛事网络已分配（要重建 infra 容器）。
 */
export function buildAwdGates(input: AwdGateInput, t: TFunction): Record<AwdAction, AwdActionGate> {
	const { status, networkAllocated, finalSettlement } = input;
	const unknown = status === null;
	const networkReason = t("adminAwdOps.gates.networkNotAllocated");

	const deploy: AwdActionGate = unknown
		? { enabled: false, reason: t("adminAwdOps.gates.notEnabled") }
		: !DEPLOYABLE_STATUSES.includes(status)
			? { enabled: false, reason: deployReason(status, t) }
			: !networkAllocated
				? { enabled: false, reason: networkReason }
				: { enabled: true, reason: null };

	const precheck: AwdActionGate = unknown
		? { enabled: false, reason: t("adminAwdOps.gates.notEnabled") }
		: !CONFIGURABLE_STATUSES.includes(status)
			? { enabled: false, reason: precheckReason(status, t) }
			: !networkAllocated
				? { enabled: false, reason: networkReason }
				: { enabled: true, reason: null };

	const start: AwdActionGate = unknown
		? { enabled: false, reason: t("adminAwdOps.gates.notEnabledShort") }
		: status !== AwdEventStatus.Verified
			? {
					enabled: false,
					reason:
						status === AwdEventStatus.StartBlocked
							? t("adminAwdOps.gates.startBlocked")
							: t("adminAwdOps.gates.startNotVerified", {
									status: awdStatusLabel(status, t),
								}),
				}
			: { enabled: true, reason: null };

	const pause: AwdActionGate =
		status === AwdEventStatus.Running
			? finalSettlement
				? { enabled: false, reason: t("adminAwdOps.gates.pauseSettlement") }
				: { enabled: true, reason: null }
			: {
					enabled: false,
					reason: t("adminAwdOps.gates.pauseNotRunning", {
						status: awdStatusLabel(status, t),
					}),
				};

	const resume: AwdActionGate =
		status === AwdEventStatus.Paused || status === AwdEventStatus.NetworkError
			? { enabled: true, reason: null }
			: {
					enabled: false,
					reason: t("adminAwdOps.gates.resumeNotPaused", {
						status: awdStatusLabel(status, t),
					}),
				};

	const finish: AwdActionGate = unknown
		? { enabled: false, reason: t("adminAwdOps.gates.notEnabledShort") }
		: TERMINAL_STATUSES.includes(status)
			? {
					enabled: false,
					reason: t("adminAwdOps.gates.finishTerminal", {
						status: awdStatusLabel(status, t),
					}),
				}
			: status !== AwdEventStatus.Running
				? {
						enabled: false,
						reason: t("adminAwdOps.gates.finishNotRunning", {
							status: awdStatusLabel(status, t),
						}),
					}
				: !finalSettlement
					? { enabled: false, reason: t("adminAwdOps.gates.finishNoSettlement") }
					: { enabled: true, reason: null };

	const archive: AwdActionGate =
		status === AwdEventStatus.Finished
			? { enabled: true, reason: null }
			: status === AwdEventStatus.Archived
				? { enabled: false, reason: t("adminAwdOps.gates.archiveArchived") }
				: {
						enabled: false,
						reason: t("adminAwdOps.gates.archiveBlocked", {
							status: awdStatusLabel(status, t),
						}),
					};

	const rotateTokens: AwdActionGate =
		status === null
			? { enabled: false, reason: t("adminAwdOps.gates.rotateNotEnabled") }
			: TERMINAL_STATUSES.includes(status)
				? {
						enabled: false,
						reason: t("adminAwdOps.gates.rotateTerminal", {
							status: awdStatusLabel(status, t),
						}),
					}
				: !networkAllocated
					? { enabled: false, reason: networkReason }
					: { enabled: true, reason: null };

	return { deploy, precheck, start, pause, resume, finish, archive, rotateTokens };
}

/* ── 预检报告 ─────────────────────────────────────────────────────────────── */

export interface PrecheckEntry {
	component: string;
	error?: string;
	note?: string;
}

export interface PrecheckReport {
	errors: PrecheckEntry[];
	notes: PrecheckEntry[];
}

/**
 * `AwdPrecheckRun.error_msg` 是**后端落库的 JSON 字符串**
 * （`{"errors":[{"component","error"}],"notes":[{"component","note"}]}`）。
 * 非法内容按单条错误展示，绝不吞掉失败原因（CONVENTIONS §6.13）。
 */
export function parsePrecheckReport(raw?: string | null): PrecheckReport {
	if (!raw) return { errors: [], notes: [] };
	try {
		const parsed = JSON.parse(raw) as { errors?: PrecheckEntry[]; notes?: PrecheckEntry[] };
		return { errors: parsed.errors ?? [], notes: parsed.notes ?? [] };
	} catch {
		return { errors: [{ component: "precheck", error: raw }], notes: [] };
	}
}

const PRECHECK_STATUS_KEYS: Record<string, string> = {
	pending: "adminAwdOps.precheck.status.pending",
	running: "adminAwdOps.precheck.status.running",
	passed: "adminAwdOps.precheck.status.passed",
	failed: "adminAwdOps.precheck.status.failed",
	error: "adminAwdOps.precheck.status.error",
};

/** 预检结果：已知状态走 i18n，未知值原样透传。 */
export function precheckStatusLabel(status: string | null | undefined, t: TFunction): string {
	if (!status) return "—";
	// 后端历史记录用 `format!("{:?}")`（"Passed"），POST 响应却是小写 —— 统一归一化。
	const normalized = status.trim().toLowerCase();
	const key = PRECHECK_STATUS_KEYS[normalized];
	return key ? t(key) : status;
}

export function precheckStatusTone(status: string | null | undefined): PillTone {
	if (!status) return "muted";
	const normalized = status.trim().toLowerCase();
	if (normalized === "passed") return "success";
	if (normalized === "failed" || normalized === "error") return "danger";
	if (normalized === "running") return "info";
	return "neutral";
}

/** 乐观锁冲突（后端 409）：配置已被他人修改。 */
export function isConflictError(error: unknown): boolean {
	return isFloatCTFError(error) && error.httpStatus === 409;
}
