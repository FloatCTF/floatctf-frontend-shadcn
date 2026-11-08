/**
 * AWD 选手端语义 —— **只做「后端字段 → 语义/i18n key」的映射与动作可用性判定**，
 * 不自造任何数字与状态。
 *
 * 状态值一律使用 SDK 的 `AwdEventStatus` / `AwdPhase` / `GameboxStatus` / `EventFamily`
 * 枚举（`@floatctf/sdk/entity`），不在前端另立字符串字面量。
 * 判定口径与官方 Default 前端 `service/events/awd.$id/{index,gameboxes}.tsx` 的
 * `flagAllowed` / `resetAllowed` 完全一致（那是后端语义的参照），字段全部取自
 * `AwdPlayerStatus`（`status` / `phase` / `banned` / `final_settlement`）。
 * 注意：`AwdPlayerStatus` **没有**免费重置次数与罚分字段（那在管理端 `AwdEventStatus`），
 * 因此本前端**不显示任何免费次数/罚分数字**，只在确认框里描述后端语义。
 *
 * 本文件返回的是 **i18n key**，由组件层 `t()` 翻译，确保语言切换即时生效。
 */

import {
	AwdEventStatus,
	AwdPhase,
	EventFamily,
	GameboxStatus,
} from "@floatctf/sdk/entity";

import { isFloatCTFError } from "~/api/errors";
import type { PillTone } from "~/components/app/badges";

export interface AwdGate {
	allowed: boolean;
	/** 不允许时的 i18n key（永远可见，不静默禁用）。 */
	reasonKey: string;
}

const ALLOWED: AwdGate = { allowed: true, reasonKey: "" };

/** AWD 赛事状态（`awd_event_status`）。 */
const STATUS_KEYS: Record<AwdEventStatus, string> = {
	[AwdEventStatus.Draft]: "awd.state.status.draft",
	[AwdEventStatus.Configuring]: "awd.state.status.configuring",
	[AwdEventStatus.Deploying]: "awd.state.status.deploying",
	[AwdEventStatus.Deployed]: "awd.state.status.deployed",
	[AwdEventStatus.Prechecking]: "awd.state.status.prechecking",
	[AwdEventStatus.Verified]: "awd.state.status.verified",
	[AwdEventStatus.Running]: "awd.state.status.running",
	[AwdEventStatus.Paused]: "awd.state.status.paused",
	[AwdEventStatus.NetworkError]: "awd.state.status.networkError",
	[AwdEventStatus.StartBlocked]: "awd.state.status.startBlocked",
	[AwdEventStatus.Finished]: "awd.state.status.finished",
	[AwdEventStatus.Archived]: "awd.state.status.archived",
	[AwdEventStatus.DeployFailed]: "awd.state.status.deployFailed",
	[AwdEventStatus.VerificationFailed]: "awd.state.status.verificationFailed",
};

const STATUS_TONES: Record<AwdEventStatus, PillTone> = {
	[AwdEventStatus.Running]: "success",
	[AwdEventStatus.Verified]: "success",
	[AwdEventStatus.Deployed]: "info",
	[AwdEventStatus.Deploying]: "info",
	[AwdEventStatus.Prechecking]: "info",
	[AwdEventStatus.Configuring]: "info",
	[AwdEventStatus.Paused]: "warning",
	[AwdEventStatus.StartBlocked]: "warning",
	[AwdEventStatus.NetworkError]: "danger",
	[AwdEventStatus.DeployFailed]: "danger",
	[AwdEventStatus.VerificationFailed]: "danger",
	[AwdEventStatus.Finished]: "muted",
	[AwdEventStatus.Archived]: "muted",
	[AwdEventStatus.Draft]: "muted",
};

/** AWD 阶段（`awd_phase`）：hardening / attack / pause。 */
const PHASE_KEYS: Record<AwdPhase, string> = {
	[AwdPhase.Hardening]: "awd.state.phase.hardening",
	[AwdPhase.Attack]: "awd.state.phase.attack",
	[AwdPhase.Pause]: "awd.state.phase.pause",
};

const PHASE_TONES: Record<AwdPhase, PillTone> = {
	[AwdPhase.Hardening]: "info",
	[AwdPhase.Attack]: "success",
	[AwdPhase.Pause]: "warning",
};

/** GameBox 实例状态（`gamebox_status` 枚举全量取值）。 */
const GAMEBOX_STATUS_KEYS: Record<GameboxStatus, string> = {
	[GameboxStatus.Pending]: "awd.state.gamebox.pending",
	[GameboxStatus.Creating]: "awd.state.gamebox.creating",
	[GameboxStatus.Running]: "awd.state.gamebox.running",
	[GameboxStatus.Ready]: "awd.state.gamebox.ready",
	[GameboxStatus.Resetting]: "awd.state.gamebox.resetting",
	[GameboxStatus.Missing]: "awd.state.gamebox.missing",
	[GameboxStatus.Orphan]: "awd.state.gamebox.orphan",
	[GameboxStatus.Conflict]: "awd.state.gamebox.conflict",
	[GameboxStatus.StartFailed]: "awd.state.gamebox.startFailed",
	[GameboxStatus.ResetFailed]: "awd.state.gamebox.resetFailed",
	[GameboxStatus.Stopped]: "awd.state.gamebox.stopped",
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

/** 赛事赛制（`EventFamily`）。 */
const EVENT_FAMILY_KEYS: Record<EventFamily, string> = {
	[EventFamily.Jeopardy]: "awd.arena.event.family.jeopardy",
	[EventFamily.Awd]: "awd.arena.event.family.awd",
	[EventFamily.Awdp]: "awd.arena.event.family.awdp",
};

export function awdStatusKey(status: string | null | undefined): string {
	if (!status) return "awd.state.unknown";
	return STATUS_KEYS[status as AwdEventStatus] ?? "awd.state.unknown";
}

export function awdStatusTone(status: string | null | undefined): PillTone {
	if (!status) return "muted";
	return STATUS_TONES[status as AwdEventStatus] ?? "neutral";
}

export function awdPhaseKey(phase: string | null | undefined): string {
	if (!phase) return "awd.state.unknown";
	return PHASE_KEYS[phase as AwdPhase] ?? "awd.state.unknown";
}

/** GameBox 健康状态的展示文案：后端只约定字符串，未知值原样显示而不是硬编码英文枚举。 */
const HEALTH_KEYS: Record<string, string> = {
	healthy: "awd.gamebox.healthValues.healthy",
	unhealthy: "awd.gamebox.healthValues.unhealthy",
	degraded: "awd.gamebox.healthValues.degraded",
	unknown: "awd.gamebox.healthValues.unknown",
	starting: "awd.gamebox.healthValues.starting",
};

export function awdHealthLabel(
	value: string | null | undefined,
	t: (key: string) => string,
): string {
	if (!value) return "—";
	const key = HEALTH_KEYS[value];
	if (!key) return value;
	const translated = t(key);
	return translated === key ? value : translated;
}

export function awdPhaseTone(phase: string | null | undefined): PillTone {
	if (!phase) return "muted";
	return PHASE_TONES[phase as AwdPhase] ?? "neutral";
}

/**
 * 后端选手端把 `GameboxStatus` 序列化成 `format!("{:?}").to_lowercase()`，
 * 于是 `StartFailed` 变成 `startfailed`（与枚举的 `start_failed` 不一致）。
 * 这里做一次兼容归一化，避免最关键的失败态被显示成「未知 / 中性」。
 */
function normalizeGameboxStatus(status: string | null | undefined): GameboxStatus | null {
	if (!status) return null;
	const raw = status.trim().toLowerCase();
	const alias: Record<string, GameboxStatus> = {
		startfailed: GameboxStatus.StartFailed,
		resetfailed: GameboxStatus.ResetFailed,
	};
	return alias[raw] ?? (raw as GameboxStatus);
}

export function gameboxStatusKey(status: string | null | undefined): string {
	const normalized = normalizeGameboxStatus(status);
	if (!normalized) return "awd.state.unknown";
	return GAMEBOX_STATUS_KEYS[normalized] ?? "awd.state.unknown";
}

export function gameboxStatusTone(status: string | null | undefined): PillTone {
	const normalized = normalizeGameboxStatus(status);
	if (!normalized) return "muted";
	return GAMEBOX_STATUS_TONES[normalized] ?? "neutral";
}

export function eventFamilyKey(family: string | null | undefined): string {
	if (!family) return "awd.arena.event.family.unknown";
	return EVENT_FAMILY_KEYS[family as EventFamily] ?? "awd.arena.event.family.unknown";
}

export interface AwdStatusFields {
	status: string;
	phase: string;
	banned: boolean;
	final_settlement: boolean;
}

/** 由 `AwdPlayerStatus` 得到的「比赛已关闭」原因；null = 未关闭。 */
function closedReasonKey(status: AwdStatusFields | null): string | null {
	if (!status) return "awd.gate.notConfigured";
	if (status.banned) return "awd.gate.banned";
	if (
		status.status === AwdEventStatus.Finished ||
		status.status === AwdEventStatus.Archived
	) {
		return "awd.gate.finished";
	}
	if (status.final_settlement) return "awd.gate.finalSettlement";
	if (status.status === AwdEventStatus.Paused || status.phase === AwdPhase.Pause) {
		return "awd.gate.paused";
	}
	if (status.status === AwdEventStatus.NetworkError) return "awd.gate.networkError";
	return null;
}

/** flag 提交（攻击得分）是否可用 —— 仅在攻击期、且比赛未关闭时。 */
export function awdFlagGate(status: AwdStatusFields | null): AwdGate {
	const closed = closedReasonKey(status);
	if (closed) return { allowed: false, reasonKey: closed };
	if (status?.phase === AwdPhase.Hardening) {
		return { allowed: false, reasonKey: "awd.gate.hardening" };
	}
	if (status?.phase !== AwdPhase.Attack) {
		return { allowed: false, reasonKey: "awd.gate.notAttack" };
	}
	return ALLOWED;
}

/** GameBox 重置是否可用 —— 加固期与攻击期可用；暂停/结算/封禁/网络异常均不可用。 */
export function awdResetGate(status: AwdStatusFields | null): AwdGate {
	const closed = closedReasonKey(status);
	if (closed) return { allowed: false, reasonKey: closed };
	if (status?.phase === AwdPhase.Hardening || status?.phase === AwdPhase.Attack) {
		return ALLOWED;
	}
	return { allowed: false, reasonKey: "awd.gate.resetClosed" };
}

/** GameBox 重置的真实后果（后端语义；免费次数与罚分由赛事配置决定，本前端不臆造数字）。 */
export const AWD_RESET_CONSEQUENCE_KEYS = [
	"awd.gamebox.consequences.dataLoss",
	"awd.gamebox.consequences.penalty",
	"awd.gamebox.consequences.downtime",
] as const;

export interface AwdUnavailableHint {
	titleKey: string;
	descriptionKey: string;
	/** 后端原文；有值时 `descriptionKey` 含 `{{message}}` 插值。 */
	message?: string;
}

/**
 * 把「网络凭据尚未可用」从**加载失败**里区分出来 —— 返回 null 表示这是真正的失败
 * （网络错误 / 5xx / 未知业务错误），调用方应该渲染 `ErrorBlock`。
 *
 * 判定证据（后端源码 `apps/api/src/modules/event/awd/`，实测响应与之一致）：
 * - `repo/event_network_repo.rs::require_by_event_id` → `AwdError::NotFound("event network for {id}")`
 *   → HTTP 404，`platformMessage` 形如 `event network for <uuid>`（赛事尚未分配网络）；
 * - `wireguard/config` 里 `awd_team_networks` 缺失 → `NotFound("Team network not configured")`（队伍网络尚未分配）；
 * - `wireguard/config` / `ssh-config` 未加入战队 → `NotFound("你尚未加入队伍")`；
 * - `wireguard/config` 私钥二次拉取 → `Forbidden("WireGuard 私钥仅首次拉取返回…")`；
 * - 赛事终态 / 最终结算 → `Forbidden("赛事已结束…" / "正在最终结算…")`。
 * 因此：404 一律视为「业务上尚不可用」；403 视为「访问已关闭 / 私钥已下发」；
 * 其余（含 5xx、网络错误）仍走错误块。任何情况下都保留后端原文，不隐藏信息。
 */
export function awdCredentialsUnavailable(error: unknown): AwdUnavailableHint | null {
	if (!isFloatCTFError(error)) return null;
	const message = (error.platformMessage ?? "").trim();
	const lower = message.toLowerCase();

	if (lower.includes("event network")) {
		return {
			titleKey: "awd.credentials.eventNetwork.title",
			descriptionKey: "awd.credentials.eventNetwork.description",
		};
	}
	if (lower.includes("team network")) {
		return {
			titleKey: "awd.credentials.teamNetwork.title",
			descriptionKey: "awd.credentials.teamNetwork.description",
		};
	}
	if (message.includes("加入队伍")) {
		return {
			titleKey: "awd.credentials.notJoined.title",
			descriptionKey: "awd.credentials.notJoined.description",
		};
	}
	if (message.includes("私钥")) {
		return {
			titleKey: "awd.credentials.privateKey.title",
			descriptionKey: "awd.credentials.privateKey.description",
		};
	}
	if (error.httpStatus === 404) {
		return {
			titleKey: "awd.credentials.notReady.title",
			descriptionKey: message
				? "awd.credentials.notReady.descriptionWithMessage"
				: "awd.credentials.notReady.description",
			message: message || undefined,
		};
	}
	if (error.httpStatus === 403) {
		return {
			titleKey: "awd.credentials.accessClosed.title",
			descriptionKey: message
				? "awd.credentials.accessClosed.descriptionWithMessage"
				: "awd.credentials.accessClosed.description",
			message: message || undefined,
		};
	}
	return null;
}
