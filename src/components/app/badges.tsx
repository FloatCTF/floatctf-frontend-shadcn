/**
 * 状态标签与实时状态指示 —— 视觉上统一，语义由调用方传入（**不在前端自造状态**）。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CircleDot, Loader2, PlugZap, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type PillTone = "neutral" | "muted" | "success" | "warning" | "danger" | "info";

const toneClass: Record<PillTone, string> = {
	neutral: "border-border bg-muted text-foreground",
	muted: "border-transparent bg-transparent text-muted-foreground",
	success: "border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	warning: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
	danger: "border-transparent bg-destructive/10 text-destructive",
	info: "border-transparent bg-sky-500/10 text-sky-700 dark:text-sky-400",
};

export function TonePill({
	tone = "neutral",
	children,
	icon,
	className,
	title,
}: {
	tone?: PillTone;
	children: ReactNode;
	icon?: ReactNode;
	className?: string;
	title?: string;
}) {
	return (
		<span
			title={title}
			className={cn(
				"inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3",
				toneClass[tone],
				className,
			)}
		>
			{icon}
			{children}
		</span>
	);
}

/** SSE 连接状态 → 人类可读 + 颜色（断线必须显式可见，不能静默）。 */
export function RealtimePill({
	state,
	label,
	onRefresh,
	className,
}: {
	state: string | undefined;
	label?: string;
	onRefresh?: () => void;
	className?: string;
}) {
	const { t } = useTranslation();
	const normalized = (state ?? "idle").toLowerCase();
	const realtimeLabel = label ?? t("common.realtime.label");
	const map: Record<string, { tone: PillTone; text: string; icon: ReactNode }> = {
		connected: { tone: "success", text: t("common.realtime.connected"), icon: <PlugZap /> },
		connecting: {
			tone: "info",
			text: t("common.realtime.connecting"),
			icon: <Loader2 className="animate-spin" />,
		},
		reconnecting: {
			tone: "warning",
			text: t("common.realtime.reconnecting"),
			icon: <RefreshCw className="animate-spin" />,
		},
		auth_error: { tone: "danger", text: t("common.realtime.authError"), icon: <WifiOff /> },
		error: { tone: "danger", text: t("common.realtime.error"), icon: <WifiOff /> },
		closed: { tone: "muted", text: t("common.realtime.closed"), icon: <WifiOff /> },
		idle: { tone: "muted", text: t("common.realtime.idle"), icon: <CircleDot /> },
	};
	const entry = map[normalized] ?? {
		tone: "muted" as PillTone,
		text: normalized,
		icon: <CircleDot />,
	};

	return (
		<span className={cn("inline-flex items-center gap-1.5", className)}>
			<TonePill tone={entry.tone} icon={entry.icon} title={`${realtimeLabel}: ${normalized}`}>
				{entry.text}
			</TonePill>
			{onRefresh ? (
				<Button variant="ghost" size="icon-xs" onClick={onRefresh} aria-label={t("common.realtime.refreshNow")} title={t("common.realtime.refreshNow")}>
					<RefreshCw />
				</Button>
			) : null}
		</span>
	);
}

/** 布尔/可空状态的通用「是 / 否 / 未知」标签（避免各页面自成一套）。 */
export function BooleanPill({
	value,
	trueText,
	falseText,
	trueTone = "success",
	falseTone = "muted",
}: {
	value: boolean | null | undefined;
	trueText?: string;
	falseText?: string;
	trueTone?: PillTone;
	falseTone?: PillTone;
}) {
	const { t } = useTranslation();
	if (value === null || value === undefined) return <TonePill tone="muted">{t("common.unknown")}</TonePill>;
	return (
		<TonePill tone={value ? trueTone : falseTone}>
			{value ? (trueText ?? t("common.yes")) : (falseText ?? t("common.no"))}
		</TonePill>
	);
}
