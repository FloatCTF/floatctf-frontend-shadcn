/**
 * 管理端 AWD 赛事运维页（`/admin/events/:eventId/awd`）。
 *
 * 定位（FRONTEND-PLAN §4）：赛事控制台只放只读摘要与跳转，**完整运维流程在本页**：
 * 赛事配置 → 分配赛事网络 → 部署 → 预检 → 开赛 → 暂停/恢复 → 结束 → 归档，
 * 外加令牌轮换、分数调整、封禁、GameBox 挂载与实例重置。
 *
 * 状态机驱动：所有按钮的可用性只由后端字段（status / phase / final_settlement /
 * 赛事网络是否已分配）决定，禁用时把原因写在按钮 title 与状态条里。
 *
 * 文案全部走 `adminAwdOps.*`（CONVENTIONS §10.2）；数据逻辑与后端语义保持不变。
 */

import { useCallback } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Boxes, RefreshCw } from "lucide-react";

import type { AwdEventStatus } from "@floatctf/sdk";

import { useBindings, useClient } from "~/api/client";
import { errorText } from "~/api/errors";
import { qk } from "~/api/keys";
import { RealtimePill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import {
	KeyValueList,
	MonoText,
	PageBody,
	PageHeader,
	SectionCard,
} from "~/components/app/page";
import { EmptyBlock, ErrorBlock, LoadingBlock } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatDateTime } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import { AwdConfigTab } from "./config-tab";
import { AwdGameboxesTab } from "./gameboxes-tab";
import { AwdInstancesTab } from "./instances-tab";
import { AwdNetworkTab } from "./network-tab";
import { AwdPrecheckTab } from "./precheck-tab";
import { useAwdEvent, useAwdEventNetwork, useAwdStatus } from "./queries";
import { AwdScoresTab } from "./scores-tab";
import {
	awdActionConfirm,
	awdActionLabel,
	awdPhaseLabel,
	awdStatusLabel,
	AwdStatusPill,
	buildAwdGates,
	eventFamilyLabel,
	eventPurposeLabel,
	runAwdAction,
	type AwdAction,
} from "./shared";
import { AwdTeamsTab } from "./teams-tab";

const ACTION_ORDER: AwdAction[] = [
	"deploy",
	"precheck",
	"start",
	"pause",
	"resume",
	"finish",
	"archive",
	"rotateTokens",
];

/** 真正不可逆 / 高危的动作才用 destructive 视觉；部署、开赛等用次级按钮。 */
const DANGER_ACTIONS: AwdAction[] = ["finish", "archive", "rotateTokens"];

export function AwdOpsPage() {
	const { t } = useTranslation();
	const { eventId = "" } = useParams<{ eventId: string }>();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { useAdminAwdEventStream } = useBindings();
	const stream = useAdminAwdEventStream({ eventId, enabled: eventId !== "" });

	useDocumentTitle(t("adminAwdOps.documentTitle"));

	const eventQuery = useAwdEvent(eventId);
	const statusQuery = useAwdStatus(eventId);
	const networkQuery = useAwdEventNetwork(eventId);

	const status: AwdEventStatus | null = statusQuery.data ?? null;
	const event = eventQuery.data;
	const networkAllocated = networkQuery.data !== null && networkQuery.data !== undefined;
	const eventTitle = event?.title ?? t("adminAwdOps.page.titleFallback");
	const breadcrumbTitle = event?.title ?? eventId;

	/** 手动刷新：既失效 SSE 覆盖的键，也覆盖 SSE 未包含的赛事 GameBox / 赛事网络 / 赛事本体。 */
	const refreshAll = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awd.adminScores(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awd.prechecks(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awd.eventGameboxes(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awd.eventNetwork(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.event(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventInstances(eventId) });
		stream.invalidateAwd();
	}, [queryClient, eventId, stream]);

	const lifecycle = useMutation({
		mutationFn: (action: AwdAction) => runAwdAction(client, eventId, action, t),
		onSuccess: (_result, action) => {
			toast.success(
				t("adminAwdOps.lifecycle.submitSuccess", { action: awdActionLabel(action, t) }),
				t("adminAwdOps.lifecycle.submitSuccessDescription"),
			);
			refreshAll();
		},
		onError: (error, action) =>
			toast.apiError(
				t("adminAwdOps.lifecycle.submitFailed", { action: awdActionLabel(action, t) }),
				error,
			),
	});

	const gates = buildAwdGates(
		{
			status: status?.status ?? null,
			networkAllocated,
			finalSettlement: status?.final_settlement ?? false,
		},
		t,
	);

	const unavailableActions = ACTION_ORDER.filter((action) => !gates[action].enabled);
	const statusPending = statusQuery.isPending;
	const statusError = statusQuery.isError;

	if (eventQuery.isPending) {
		return (
			<PageBody>
				<PageHeader
					title={t("adminAwdOps.page.titleFallback")}
					description={t("adminAwdOps.page.loadingEvent")}
				/>
				<LoadingBlock label={t("adminAwdOps.page.loadingLabel")} />
			</PageBody>
		);
	}

	if (eventQuery.isError) {
		return (
			<PageBody>
				<PageHeader title={t("adminAwdOps.page.titleFallback")} />
				<ErrorBlock
					error={eventQuery.error}
					title={t("adminAwdOps.page.loadFailed")}
					onRetry={() => eventQuery.refetch()}
				/>
				<Button variant="outline" size="sm" asChild>
					<Link to="/admin/events">
						<ArrowLeft data-icon="inline-start" />
						{t("adminAwdOps.page.backToList")}
					</Link>
				</Button>
			</PageBody>
		);
	}

	return (
		<PageBody>
			<PageHeader
				title={t("adminAwdOps.page.title", { event: eventTitle })}
				description={t("adminAwdOps.page.description")}
				breadcrumbs={
					<nav
						aria-label={t("adminAwdOps.breadcrumbs.label")}
						className="flex flex-wrap items-center gap-1.5 text-xs"
					>
						<Link
							className="min-w-0 truncate hover:text-foreground hover:underline"
							to="/admin/events"
						>
							{t("adminAwdOps.breadcrumbs.events")}
						</Link>
						<span aria-hidden="true" className="text-border">
							/
						</span>
						<Link
							className="min-w-0 truncate hover:text-foreground hover:underline"
							to={`/admin/events/${eventId}`}
						>
							{breadcrumbTitle}
						</Link>
						<span aria-hidden="true" className="text-border">
							/
						</span>
						<span className="min-w-0 truncate font-medium text-foreground">
							{t("adminAwdOps.breadcrumbs.current")}
						</span>
					</nav>
				}
				badge={
					statusQuery.isPending || statusQuery.isError ? null : (
						<AwdStatusPill
							status={status?.status ?? null}
							phase={status?.phase ?? null}
							finalSettlement={status?.final_settlement ?? false}
						/>
					)
				}
				actions={
					<>
						<RealtimePill state={stream.connectionState} onRefresh={refreshAll} />
						<Button variant="outline" size="sm" asChild>
							<Link to="/admin/gameboxes">
								<Boxes data-icon="inline-start" />
								{t("adminAwdOps.page.gameboxLibrary")}
							</Link>
						</Button>
						<Button variant="outline" size="sm" asChild>
							<Link to={`/admin/events/${eventId}`}>
								<ArrowLeft data-icon="inline-start" />
								{t("adminAwdOps.page.backToConsole")}
							</Link>
						</Button>
					</>
				}
			/>

			<SectionCard
				title={t("adminAwdOps.lifecycle.title")}
				description={t("adminAwdOps.lifecycle.description")}
				actions={
					<Button
						variant="outline"
						size="sm"
						disabled={statusQuery.isFetching}
						onClick={() => void statusQuery.refetch()}
					>
						<RefreshCw data-icon="inline-start" />
						{t("adminAwdOps.lifecycle.refresh")}
					</Button>
				}
			>
				<div className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						{ACTION_ORDER.map((action) => {
							const gate = gates[action];
							return (
								<Button
									key={action}
									variant={DANGER_ACTIONS.includes(action) ? "destructive" : "outline"}
									size="sm"
									disabled={statusPending || statusError || !gate.enabled || lifecycle.isPending}
									title={
										statusError
											? t("adminAwdOps.lifecycle.statusLoadFailed")
											: statusPending
												? t("adminAwdOps.lifecycle.loadingStatus")
												: (gate.reason ?? awdActionLabel(action, t))
									}
									onClick={async () => {
										const ok = await confirm(awdActionConfirm(t, action));
										if (ok) lifecycle.mutate(action);
									}}
								>
									{awdActionLabel(action, t)}
								</Button>
							);
						})}
					</div>

					{!statusPending && !statusError && status !== null && unavailableActions.length > 0 ? (
						<details className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
							<summary className="cursor-pointer text-foreground">
								{t("adminAwdOps.lifecycle.unavailableSummary", {
									count: unavailableActions.length,
								})}
							</summary>
							<ul className="mt-2 space-y-1">
								{unavailableActions.map((action) => (
									<li key={action}>
										<span className="font-medium text-foreground">
											{awdActionLabel(action, t)}
										</span>
										<span aria-hidden="true"> · </span>
										<span>{gates[action].reason}</span>
									</li>
								))}
							</ul>
						</details>
					) : null}

					{statusError ? (
						<ErrorBlock
							error={statusQuery.error}
							title={t("adminAwdOps.lifecycle.statusLoadFailed")}
							onRetry={() => void statusQuery.refetch()}
						/>
					) : statusPending ? (
						<LoadingBlock label={t("adminAwdOps.lifecycle.loadingStatus")} />
					) : status === null ? (
						<EmptyBlock
							title={t("adminAwdOps.lifecycle.notEnabledTitle")}
							description={t("adminAwdOps.lifecycle.notEnabledDescription")}
						/>
					) : (
						<KeyValueList
							columns={3}
							items={[
								{
									key: t("adminAwdOps.lifecycle.fields.status"),
									value: awdStatusLabel(status.status, t),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.phase"),
									value: awdPhaseLabel(status.phase, t),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.roundCount"),
									value:
										status.round_count === null ? (
											<span className="text-muted-foreground">
												{t("adminAwdOps.lifecycle.fields.notConfigured")}
											</span>
										) : (
											<span className="tnum">{status.round_count}</span>
										),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.roundDuration"),
									value: (
										<span className="tnum">
											{t("adminAwdOps.units.seconds", {
												count: status.round_duration_secs,
											})}
										</span>
									),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.initialScore"),
									value: <span className="tnum">{status.initial_score}</span>,
								},
								{
									key: t("adminAwdOps.lifecycle.fields.resetPolicy"),
									value: (
										<span className="tnum">
											{t("adminAwdOps.lifecycle.fields.resetPolicyValue", {
												free: status.free_reset_count,
												penalty: status.extra_reset_penalty,
											})}
										</span>
									),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.plannedStart"),
									value: status.planned_start_at ? (
										<span className="tnum whitespace-nowrap">{formatDateTime(status.planned_start_at, { seconds: true })}</span>
									) : (
										<span className="text-muted-foreground">
											{t("adminAwdOps.lifecycle.fields.manualStart")}
										</span>
									),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.verifiedAt"),
									value: status.verified_at ? (
										<span className="tnum whitespace-nowrap">{formatDateTime(status.verified_at, { seconds: true })}</span>
									) : (
										<span className="text-muted-foreground">
											{t("adminAwdOps.lifecycle.fields.notVerified")}
										</span>
									),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.startedAt"),
									value: status.started_at ? (
										<span className="tnum whitespace-nowrap">{formatDateTime(status.started_at, { seconds: true })}</span>
									) : (
										<span className="text-muted-foreground">
											{t("adminAwdOps.lifecycle.fields.notStarted")}
										</span>
									),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.finalSettlement"),
									value: (
										<TonePill tone={status.final_settlement ? "warning" : "muted"}>
											{status.final_settlement
												? t("adminAwdOps.lifecycle.fields.settlementActive")
												: t("adminAwdOps.lifecycle.fields.settlementInactive")}
										</TonePill>
									),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.network"),
									value: (
										<TonePill tone={networkAllocated ? "success" : "danger"}>
											{networkAllocated
												? t("adminAwdOps.lifecycle.fields.networkAllocated")
												: t("adminAwdOps.lifecycle.fields.networkNotAllocated")}
										</TonePill>
									),
								},
								{
									key: t("adminAwdOps.lifecycle.fields.configVersion"),
									value: <MonoText>{status.updated_at}</MonoText>,
								},
							]}
						/>
					)}

					{networkQuery.isError ? (
						<p className="text-xs text-destructive" role="alert">
							{t("adminAwdOps.lifecycle.networkError", {
								error: errorText(networkQuery.error),
							})}
						</p>
					) : null}

					{event ? (
						<p className="tnum text-xs text-muted-foreground">
							{t("adminAwdOps.lifecycle.eventMeta", {
								family: eventFamilyLabel(event.family, t),
								purpose: eventPurposeLabel(event.purpose, t),
								start: formatDateTime(event.start_time, { seconds: true }),
								end: formatDateTime(event.end_time, { seconds: true }),
							})}
						</p>
					) : null}
				</div>
			</SectionCard>

			<Tabs defaultValue="config">
				<TabsList className="no-scrollbar flex w-full justify-start overflow-x-auto">
					<TabsTrigger value="config">{t("adminAwdOps.tabs.config")}</TabsTrigger>
					<TabsTrigger value="precheck">{t("adminAwdOps.tabs.precheck")}</TabsTrigger>
					<TabsTrigger value="scores">{t("adminAwdOps.tabs.scores")}</TabsTrigger>
					<TabsTrigger value="teams">{t("adminAwdOps.tabs.teams")}</TabsTrigger>
					<TabsTrigger value="gameboxes">{t("adminAwdOps.tabs.gameboxes")}</TabsTrigger>
					<TabsTrigger value="network">{t("adminAwdOps.tabs.network")}</TabsTrigger>
					<TabsTrigger value="instances">{t("adminAwdOps.tabs.instances")}</TabsTrigger>
				</TabsList>
				<TabsContent value="config" className="mt-6">
					<AwdConfigTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="precheck" className="mt-6">
					<AwdPrecheckTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="scores" className="mt-6">
					<AwdScoresTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="teams" className="mt-6">
					<AwdTeamsTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="gameboxes" className="mt-6">
					<AwdGameboxesTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="network" className="mt-6">
					<AwdNetworkTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="instances" className="mt-6">
					<AwdInstancesTab eventId={eventId} />
				</TabsContent>
			</Tabs>
		</PageBody>
	);
}
