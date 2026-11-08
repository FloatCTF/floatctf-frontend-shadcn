/**
 * `/arena/:eventId` —— AWD 驾驶舱（单一工作区，不是 Default 的多页）。
 *
 * 左列：攻击面板（flag 提交 + 我的 GameBox 表 + 行内重置）
 * 右列：分数/轮次 KPI + 轮次状态卡 + 实时积分榜
 * 底部：网络凭据（WireGuard / SSH）与攻击流程提示
 *
 * 所有数据来自 `client.awd.player.*` 与 `client.service.events.get`；
 * 实时通道为 `useAwdEventStream`（`RealtimePill` 显式呈现连接态，含 `auth_error`）。
 * 文案全部走 `awd.*` i18n 命名空间，状态判定走 SDK 枚举与 `~/lib/event-status`。
 */

import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Trans, useTranslation } from "react-i18next";
import { Activity, AlertTriangle, CalendarDays, Flag, Swords, Trophy } from "lucide-react";

import type { AwdPlayerStatus, EventInfo } from "@floatctf/sdk";

import { call } from "~/api/call";
import { isForbidden, isNotFound } from "~/api/errors";
import { useBindings, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, RealtimePill, TonePill } from "~/components/app/badges";
import {
	KeyValueList,
	PageBody,
	PageHeader,
	SectionCard,
	StatCard,
} from "~/components/app/page";
import {
	EmptyBlock,
	ErrorBlock,
	LoadingBlock,
	PermissionDeniedBlock,
} from "~/components/app/states";
import {
	WorkspaceAccessBlock,
	type WorkspaceAccessReason,
} from "~/components/app/workspace-access";
import { Button } from "~/components/ui/button";
import {
	computeEventStatus,
	EVENT_STATUS_TONE,
	isPracticeEvent,
} from "~/lib/event-status";
import { formatInt, formatPoints } from "~/lib/format";
import { useDocumentTitle, useNow } from "~/lib/hooks";

import {
	AwdFlagPanel,
	AwdGameboxPanel,
	AwdNetworkPanel,
	AwdScoreboardPanel,
	AwdStatePills,
} from "./components";
import { useCommands } from "~/app/command-palette";

import { awdPhaseKey, awdStatusKey, eventFamilyKey } from "./domain";

export function ArenaPage(): ReactNode {
	const { eventId = "" } = useParams<{ eventId: string }>();
	const { t } = useTranslation();

	const client = useClient();
	const { useAwdEventStream } = useBindings();
	const now = useNow(30_000);

	const eventQuery = useQuery({
		queryKey: qk.events.detail(eventId),
		queryFn: () =>
			call<EventInfo>(client.service.events.get(eventId), t("awd.actionNames.event")),
		enabled: Boolean(eventId),
	});

	const eventInfo = eventQuery.data;
	const eventStatus = eventInfo
		? computeEventStatus(eventInfo.event.start_time, eventInfo.event.end_time, now.getTime())
		: "unknown";

	// 后端对未参赛 / 未开始 / 赛制不符的赛事会直接拒绝选手端 AWD 接口。
	// 先把闸门放在请求之前：深链接不会先打一发必失败的 403，再给一个没有出路的错误块。
	let access: WorkspaceAccessReason | null = null;
	if (eventInfo) {
		if (eventInfo.event.family !== "awd") access = "wrong-family";
		else if (isPracticeEvent(eventInfo.event)) access = "practice";
		else if (!eventInfo.joined) access = "not-joined";
		else if (eventStatus === "upcoming") access = "not-started";
	}
	const canAccess = eventQuery.isSuccess && access === null;

	const stream = useAwdEventStream({ eventId, enabled: Boolean(eventId) && canAccess });

	const statusQuery = useQuery({
		queryKey: qk.awd.status(eventId),
		queryFn: () =>
			call<AwdPlayerStatus>(client.awd.player.status(eventId), t("awd.actionNames.status")),
		enabled: Boolean(eventId) && canAccess,
		retry: false,
	});

	// 命令面板的上下文命令：只注册本页真实存在的动作（聚焦提交框 / 刷新权威状态）。
	useCommands(
		[
			{
				id: "awd-focus-flag",
				label: t("shell.commands.focusFlag"),
				keywords: "flag submit 提交",
				run: () => {
					// 命令面板关闭时 Radix 会把焦点还给触发元素：延后一帧再聚焦目标输入框。
					window.setTimeout(() => document.getElementById("awd-flag")?.focus(), 80);
				},
			},
			{
				id: "awd-refresh",
				label: t("shell.commands.refresh"),
				keywords: "refresh reload 刷新",
				run: () => {
					void statusQuery.refetch();
					void eventQuery.refetch();
				},
			},
		],
		[eventId],
	);

	const status = statusQuery.data;
	const myTeamId = eventInfo?.team_result?.team.id ?? null;
	const eventTitle = eventInfo?.event.title ?? t("awd.arena.titleFallback");

	useDocumentTitle(t("awd.documentTitle", { title: eventTitle }));

	return (
		<PageBody>
			<PageHeader
				title={eventTitle}
				description={t("awd.arena.description")}
				breadcrumbs={
					<nav
						aria-label={t("awd.arena.breadcrumbs.label")}
						className="flex flex-wrap items-center gap-1.5 text-sm"
					>
						<Link
							to="/events"
							className="min-w-0 truncate hover:text-foreground hover:underline"
						>
							{t("awd.arena.breadcrumbs.events")}
						</Link>
						<span aria-hidden="true" className="text-border">
							/
						</span>
						<Link
							to={`/events/${eventId}`}
							className="min-w-0 truncate hover:text-foreground hover:underline"
						>
							{t("awd.arena.breadcrumbs.workspace")}
						</Link>
						<span aria-hidden="true" className="text-border">
							/
						</span>
						<span className="min-w-0 truncate font-medium text-foreground">
							{t("awd.arena.breadcrumbs.current")}
						</span>
					</nav>
				}
				badge={
					status ? (
						<AwdStatePills
							status={status.status}
							phase={status.phase}
							banned={status.banned}
							finalSettlement={status.final_settlement}
						/>
					) : null
				}
				actions={
					canAccess ? (
						<RealtimePill
							state={stream.connectionState}
							onRefresh={() => stream.invalidateAwd()}
						/>
					) : undefined
				}
			/>

			{eventQuery.isPending ? (
				<LoadingBlock label={t("awd.arena.loading")} />
			) : eventQuery.isError ? (
				<ErrorBlock
					error={eventQuery.error}
					title={t("awd.arena.errors.event")}
					onRetry={() => eventQuery.refetch()}
				/>
			) : access ? (
				<WorkspaceAccessBlock
					reason={access}
					eventId={eventId}
					practiceEntry={eventInfo?.event.family === "awdp" ? "training" : "events"}
				/>
			) : statusQuery.isPending ? (
				<LoadingBlock label={t("awd.arena.loading")} />
			) : statusQuery.isError ? (
				isNotFound(statusQuery.error) ? (
					// 赛事没有 AWD 配置时后端返回 404（「未找到该 AWD 赛事」）——这是业务态，不是加载失败。
					<EmptyBlock
						title={t("awd.arena.notEnabled.title")}
						description={t("awd.arena.notEnabled.description")}
						action={
							<Button variant="outline" size="sm" asChild>
								<Link to="/events">{t("awd.arena.notEnabled.action")}</Link>
							</Button>
						}
					/>
				) : isForbidden(statusQuery.error) ? (
					<PermissionDeniedBlock description={t("awd.arena.forbidden")} />
				) : (
					<ErrorBlock
						error={statusQuery.error}
						title={t("awd.arena.errors.status")}
						onRetry={() => statusQuery.refetch()}
					/>
				)
			) : status ? (
				<div className="space-y-4">
					{status.banned ? (
						<div
							className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
							role="alert"
						>
							<AlertTriangle
								className="mt-1 size-4 shrink-0 text-destructive"
								aria-hidden="true"
							/>
							<div className="min-w-0 space-y-1">
								<p className="font-medium text-destructive">
									{t("awd.arena.banned.title")}
								</p>
								<p className="text-muted-foreground">
									{t("awd.arena.banned.description")}
								</p>
							</div>
						</div>
					) : null}

					{status.final_settlement ? (
						<div
							className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
							role="status"
						>
							<AlertTriangle
								className="mt-1 size-4 shrink-0 text-amber-700 dark:text-amber-400"
								aria-hidden="true"
							/>
							<div className="min-w-0 space-y-1">
								<p className="font-medium text-amber-700 dark:text-amber-400">
									{t("awd.arena.settlement.title")}
								</p>
								<p className="text-muted-foreground">
									{t("awd.arena.settlement.description")}
								</p>
							</div>
						</div>
					) : null}

					{/* 总览指标放顶部一行：窄侧栏里塞表格会横向溢出，也浪费左列高度。 */}
					<div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 xl:grid-cols-4">
						<StatCard
							label={t("awd.arena.stats.score")}
							value={formatPoints(status.score)}
							hint={t("awd.arena.stats.scoreHint")}
							icon={<Trophy className="size-4" aria-hidden="true" />}
						/>
						<StatCard
							label={t("awd.arena.stats.round")}
							value={formatInt(status.current_round)}
							hint={
								status.round_count === null ? (
									t("awd.arena.stats.roundHintUnknown")
								) : (
									<span className="tnum">
										{t("awd.arena.stats.roundHint", {
											rounds: formatInt(status.round_count),
										})}
									</span>
								)
							}
							icon={<Flag className="size-4" aria-hidden="true" />}
						/>
						<StatCard
							label={t("awd.arena.fields.status")}
							value={t(awdStatusKey(status.status))}
							hint={t("awd.arena.stats.statusHint")}
							icon={<Activity className="size-4" aria-hidden="true" />}
						/>
						<StatCard
							label={t("awd.arena.fields.phase")}
							value={t(awdPhaseKey(status.phase))}
							hint={t("awd.arena.stats.phaseHint")}
							icon={<Swords className="size-4" aria-hidden="true" />}
						/>
					</div>

					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
						<div className="min-w-0 space-y-4">
							<AwdFlagPanel eventId={eventId} status={status} />
							<AwdGameboxPanel eventId={eventId} status={status} />
							<AwdScoreboardPanel eventId={eventId} myTeamId={myTeamId} />
						</div>

						<div className="min-w-0 space-y-4">
							<SectionCard
								title={t("awd.arena.sections.state.title")}
								description={t("awd.arena.sections.state.description")}
							>
								<div className="space-y-4">
									<KeyValueList
										columns={1}
										items={[
											{
												key: t("awd.arena.fields.status"),
												value: t(awdStatusKey(status.status)),
											},
											{
												key: t("awd.arena.fields.phase"),
												value: t(awdPhaseKey(status.phase)),
											},
											{
												key: t("awd.arena.fields.teamStatus"),
												value: (
													<BooleanPill
														value={status.banned}
														trueText={t("awd.state.teamBanned")}
														falseText={t("awd.state.teamNormal")}
														trueTone="danger"
														falseTone="success"
													/>
												),
											},
											{
												key: t("awd.arena.fields.finalSettlement"),
												value: (
													<BooleanPill
														value={status.final_settlement}
														trueText={t("awd.state.settlementActive")}
														falseText={t("awd.state.settlementInactive")}
														trueTone="warning"
														falseTone="muted"
													/>
												),
											},
										]}
									/>
									{eventInfo ? (
										<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
											<CalendarDays className="size-4" aria-hidden="true" />
											<span>{t(eventFamilyKey(eventInfo.event.family))}</span>
											<span aria-hidden="true">·</span>
											<BooleanPill
												value={eventInfo.joined}
												trueText={t("awd.arena.event.joined")}
												falseText={t("awd.arena.event.notJoined")}
												trueTone="success"
												falseTone="muted"
											/>
											<span aria-hidden="true">·</span>
											<span>{t("awd.arena.event.schedule")}</span>
											<TonePill tone={EVENT_STATUS_TONE[eventStatus]}>
												{t(`awd.arena.event.status.${eventStatus}`)}
											</TonePill>
										</div>
									) : null}
								</div>
							</SectionCard>

							<SectionCard
								title={t("awd.arena.sections.tips.title")}
								description={t("awd.arena.sections.tips.description")}
							>
								<ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
									<li>{t("awd.arena.tips.wireguard")}</li>
									<li>
										<Trans
											i18nKey="awd.arena.tips.phases"
											components={{ strong: <strong className="text-foreground" /> }}
										/>
									</li>
									<li>{t("awd.arena.tips.reset")}</li>
								</ul>
								<div className="mt-3 flex flex-wrap gap-2">
									<Button variant="outline" size="sm" asChild>
										<Link to={`/events/${eventId}`}>
											<Swords className="size-4" aria-hidden="true" />
											{t("awd.arena.tips.back")}
										</Link>
									</Button>
								</div>
							</SectionCard>
						</div>
					</div>

					<AwdNetworkPanel eventId={eventId} />

				</div>
			) : (
				<EmptyBlock
					title={t("awd.arena.empty.title")}
					description={t("awd.arena.empty.description")}
				/>
			)}
		</PageBody>
	);
}
