/**
 * instances 域展示组件 —— 状态/类型标签、生命周期文案、实例详情 Sheet。
 *
 * 约束：
 * - 状态值来自后端 `instances.runtime_state`（pending / starting / running / stopped / failed / completed）；
 *   本文件只做「值 → 文案/色调」映射，遇到未知值原样显示，不发明新状态。
 * - `InstancesDto.flag` 由后端恒定脱敏为空：有值才用 `SecretValue`，空值绝不当真值展示。
 * - 详情是只读视图，不在此发起新的网络请求。
 */

import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ExternalLink, Trash2, X } from "lucide-react";

import type { Instances as InstanceDto } from "@floatctf/sdk";
import {
	CopyText,
	KeyValueList,
	MonoText,
	SecretValue,
} from "~/components/app/page";
import { TonePill, type PillTone } from "~/components/app/badges";
import { Button } from "~/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "~/components/ui/sheet";
import { formatDateTime } from "~/lib/format";
import { useNow } from "~/lib/hooks";
import { cn } from "~/lib/utils";

export type InstanceKind = "challenge" | "gamebox" | "unknown";

const STATUS_LABEL_KEYS: Record<string, string> = {
	pending: "instances.status.pending",
	starting: "instances.status.starting",
	running: "instances.status.running",
	stopped: "instances.status.stopped",
	failed: "instances.status.failed",
	completed: "instances.status.completed",
};

/** 实例归类只依据后端关联字段（challenge_id / run_id），不在前端自造类型。 */
export function instanceKindOf(row: InstanceDto): InstanceKind {
	if (row.challenge_id) return "challenge";
	if (row.run_id) return "gamebox";
	return "unknown";
}

export function instanceKindLabel(t: TFunction, row: InstanceDto): string {
	switch (instanceKindOf(row)) {
		case "challenge":
			return t("instances.type.challenge");
		case "gamebox":
			return t("instances.type.gamebox");
		default:
			return t("instances.type.unknown");
	}
}

export function instanceName(t: TFunction, row: InstanceDto): string {
	const title = row.challenge_title?.trim() || row.gamebox_title?.trim();
	return title || row.identifier?.trim() || t("instances.row.unknownSubject");
}

export function instanceEventLabel(t: TFunction, row: InstanceDto): string {
	const title = row.event_title?.trim();
	if (title) return title;
	switch (instanceKindOf(row)) {
		case "challenge":
			return t("instances.row.challengePractice");
		case "gamebox":
			return t("instances.row.gameboxPractice");
		default:
			return t("common.empty");
	}
}

export function instanceStatusLabel(t: TFunction, status: string | null | undefined): string {
	const normalized = (status ?? "").trim().toLowerCase();
	const key = STATUS_LABEL_KEYS[normalized];
	if (key) return t(key);
	return (status ?? "").trim() || t("common.unknown");
}

export function instanceStatusTone(status: string | null | undefined): PillTone {
	switch ((status ?? "").trim().toLowerCase()) {
		case "running":
			return "success";
		case "pending":
		case "starting":
			return "warning";
		case "failed":
			return "danger";
		case "completed":
			return "info";
		default:
			return "muted";
	}
}

export function InstanceStatusPill({
	status,
}: {
	status: string | null | undefined;
}) {
	const { t } = useTranslation();
	const normalized = (status ?? "").trim().toLowerCase();
	return (
		<TonePill
			tone={instanceStatusTone(status)}
			icon={
				<span
					className={cn(
						"size-1.5 rounded-full bg-current",
						normalized === "running" && "animate-pulse motion-reduce:animate-none",
					)}
					aria-hidden="true"
				/>
			}
		>
			{instanceStatusLabel(t, status)}
		</TonePill>
	);
}

export function InstanceKindPill({ row }: { row: InstanceDto }) {
	const { t } = useTranslation();
	return <TonePill tone="neutral">{instanceKindLabel(t, row)}</TonePill>;
}

/** 实例的宿主页面：挑战实例回题库，AWDP 练习回训练 Run。 */
export function instanceSubjectHref(row: InstanceDto): string | null {
	if (row.challenge_id) return `/challenges/${row.challenge_id}`;
	if (row.run_id) return `/training/runs/${row.run_id}`;
	return null;
}

export function instanceSubjectActionLabel(t: TFunction, row: InstanceDto): string | null {
	switch (instanceKindOf(row)) {
		case "challenge":
			return t("instances.row.openChallenge");
		case "gamebox":
			return t("instances.row.openTraining");
		default:
			return null;
	}
}

/** 自动回收展示：completed 后后端可能把 expires_at 置空，语义是「不自动回收」。 */
export function instanceExpiresLabel(t: TFunction, row: InstanceDto): string {
	if (row.destroy_at) return formatDateTime(row.destroy_at);
	if ((row.status ?? "").trim().toLowerCase() === "completed") {
		return t("instances.row.noExpiry");
	}
	return t("common.empty");
}

export function instanceRemainingText(
	t: TFunction,
	destroyAt: string | null | undefined,
	now: Date,
): string {
	if (!destroyAt) return t("common.empty");
	const target = new Date(destroyAt);
	if (Number.isNaN(target.getTime())) return t("common.empty");
	const diffMs = target.getTime() - now.getTime();
	if (diffMs <= 0) return t("instances.time.expired");
	const minutes = Math.ceil(diffMs / 60_000);
	if (minutes < 1) return t("instances.time.lessThanMinute");
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours > 0 && rest > 0) return t("instances.time.hoursMinutes", { hours, minutes: rest });
	if (hours > 0) return t("instances.time.hours", { hours });
	return t("instances.time.minutes", { minutes });
}

/** 后端把实例入口写成一条 `<a href=...>`；这里只取 URL，不注入 HTML。 */
export function extractInstanceUrl(content: string | null | undefined): string | null {
	if (!content) return null;
	const href = /href="([^"]+)"/.exec(content)?.[1];
	const candidate = href ?? /https?:\/\/[^\s<>"']+/.exec(content)?.[0] ?? null;
	if (!candidate) return null;
	// 只允许绝对 http(s) 与站内相对路径，避免把后端文本里的伪协议直接塞进 href。
	if (candidate.startsWith("//")) return null;
	if (candidate.startsWith("/")) return candidate;
	return /^https?:\/\//i.test(candidate) ? candidate : null;
}

export function InstanceDetailSheet({
	row,
	open,
	onOpenChange,
	onDestroy,
	destroyPending,
}: {
	row: InstanceDto | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDestroy: (row: InstanceDto) => void;
	destroyPending: boolean;
}) {
	const { t } = useTranslation();
	const now = useNow(30_000);

	if (!row) return null;

	const name = instanceName(t, row);
	const subjectHref = instanceSubjectHref(row);
	const subjectAction = instanceSubjectActionLabel(t, row);
	const instanceUrl = extractInstanceUrl(row.content);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				showCloseButton={false}
				className="flex w-full flex-col gap-0 sm:max-w-sm"
			>
				<SheetHeader className="flex-row items-start justify-between gap-3 border-b">
					<div className="min-w-0 space-y-1">
						<SheetTitle className="truncate text-base" title={name}>
							{name}
						</SheetTitle>
						<SheetDescription>{t("instances.detail.description")}</SheetDescription>
					</div>
					<SheetClose asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t("instances.detail.close")}
							title={t("instances.detail.close")}
						>
							<X />
						</Button>
					</SheetClose>
				</SheetHeader>

				<div className="flex-1 space-y-4 overflow-y-auto p-4">
					<div className="flex flex-wrap items-center gap-2">
						<InstanceStatusPill status={row.status} />
						<InstanceKindPill row={row} />
						<MonoText title={row.id}>{row.identifier}</MonoText>
					</div>

					<KeyValueList
						columns={2}
						items={[
							{
								key: t("instances.detail.fieldType"),
								value: <InstanceKindPill row={row} />,
							},
							{
								key: t("instances.detail.fieldStatus"),
								value: <InstanceStatusPill status={row.status} />,
							},
							{
								key: t("instances.detail.fieldEvent"),
								value: instanceEventLabel(t, row),
								hint: <MonoText>{row.event_id}</MonoText>,
							},
							{
								key: t("instances.detail.fieldOwner"),
								value: row.user_name?.trim() || <MonoText>{row.user_id}</MonoText>,
								hint: row.user_name ? <MonoText>{row.user_id}</MonoText> : undefined,
							},
							{
								key: t("instances.detail.fieldCreated"),
								value: <span className="tnum">{formatDateTime(row.created_at)}</span>,
							},
							{
								key: t("instances.detail.fieldUpdated"),
								value: <span className="tnum">{formatDateTime(row.updated_at)}</span>,
							},
							{
								key: t("instances.detail.fieldExpires"),
								value: <span className="tnum">{instanceExpiresLabel(t, row)}</span>,
							},
							{
								key: t("instances.detail.fieldRemaining"),
								value: (
									<span className="tnum">
										{instanceRemainingText(t, row.destroy_at, now)}
									</span>
								),
							},
							{
								key: t("instances.detail.fieldIdentifier"),
								value: (
									<CopyText
										value={row.identifier}
										label={t("instances.detail.fieldIdentifier")}
									/>
								),
							},
							{
								key: t("instances.detail.fieldInstanceId"),
								value: (
									<CopyText
										value={row.id}
										label={t("instances.detail.fieldInstanceId")}
									/>
								),
							},
							...(row.challenge_id
								? [
										{
											key: t("instances.detail.fieldChallengeId"),
											value: (
												<CopyText
													value={row.challenge_id}
													label={t("instances.detail.fieldChallengeId")}
												/>
											),
										},
									]
								: []),
							...(row.run_id
								? [
										{
											key: t("instances.detail.fieldRunId"),
											value: (
												<CopyText
													value={row.run_id}
													label={t("instances.detail.fieldRunId")}
												/>
											),
										},
									]
								: []),
							...(row.gamebox_id
								? [
										{
											key: t("instances.detail.fieldGameboxId"),
											value: (
												<CopyText
													value={row.gamebox_id}
													label={t("instances.detail.fieldGameboxId")}
												/>
											),
										},
									]
								: []),
						]}
					/>

					<div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
						<p className="text-xs text-muted-foreground">{t("instances.detail.flag")}</p>
						{row.flag ? (
							<SecretValue value={row.flag} label={t("instances.detail.flag")} />
						) : (
							<div className="space-y-1">
								<span className="text-sm">{t("common.empty")}</span>
								<p className="text-xs text-muted-foreground">
									{t("instances.detail.flagRedacted")}
								</p>
							</div>
						)}
					</div>

					<div className="space-y-1.5">
						<p className="text-xs text-muted-foreground">{t("instances.detail.content")}</p>
						{instanceUrl ? (
							<Button variant="outline" size="sm" asChild>
								<a href={instanceUrl} target="_blank" rel="noopener noreferrer">
									<ExternalLink aria-hidden="true" />
									{t("instances.row.openEnvironment")}
								</a>
							</Button>
						) : (
							<p className="text-sm text-muted-foreground">
								{t("instances.detail.contentEmpty")}
							</p>
						)}
					</div>

					<p className="text-xs text-muted-foreground">{t("instances.detail.footnote")}</p>
				</div>

				<SheetFooter className="border-t bg-muted/30">
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						{subjectHref && subjectAction ? (
							<Button variant="outline" asChild>
								<Link to={subjectHref}>
									<ExternalLink aria-hidden="true" />
									{subjectAction}
								</Link>
							</Button>
						) : null}
						<Button
							variant="destructive"
							disabled={destroyPending}
							onClick={() => onDestroy(row)}
						>
							<Trash2 aria-hidden="true" />
							{t("instances.confirm.confirmDestroy")}
						</Button>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
