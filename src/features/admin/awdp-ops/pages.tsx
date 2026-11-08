/**
 * 管理端 AWDP 赛事运维页（`/admin/events/:eventId/awdp`）。
 *
 * 阶段是**线性**状态机（pending → break → preparing_fix → fix → ended）：
 * 后端 tick 会在时间点自动推进（Break 到期 → 准备修复 → 修复；最后一轮 cutoff → 结束），
 * 页面上的按钮只用于**提前**推进，并按后端返回的 phase 决定可用性。
 *
 * 实时性说明：后端没有管理端 AWDP SSE 通道（只有选手端 `/api/events/{id}/awdp/stream`），
 * 因此本页用 30s 轮询 + 显式刷新，而不是挂一个连不上的管理端流。
 *
 * 文案全部走 i18n（`adminAwdpOps.*`），阶段文案与动作门禁来自 `./shared`（SDK `AwdpPhase`）。
 */

import { useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2, Play, RefreshCw, RotateCcw, Square } from "lucide-react";

import { isForbidden, isNotFound } from "~/api/errors";
import { useClient } from "~/api/client";
import { TonePill } from "~/components/app/badges";
import { qk } from "~/api/keys";
import { useConfirm } from "~/components/app/confirm";
import { KeyValueList, PageBody, PageHeader, SectionCard } from "~/components/app/page";
import {
	ErrorBlock,
	LoadingBlock,
	NotFoundBlock,
	PermissionDeniedBlock,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { EVENT_FAMILY_KEY, PARTICIPANT_MODE_KEY } from "~/lib/event-status";
import { formatDuration, formatInt } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import { AwdpConfigTab } from "./config-tab";
import { AwdpDataTab } from "./data-tab";
import { AwdpGameboxesTab } from "./gameboxes-tab";
import { AwdpInstancesTab } from "./instances-tab";
import { useAwdpConfig, useAwdpEvent } from "./queries";
import { AwdpScoresTab } from "./scores-tab";
import {
	AWDP_ACTION_ORDER,
	AWDP_PHASE_ORDER,
	AwdpPhasePill,
	awdpActionConfirm,
	awdpActionLabel,
	awdpPhaseDescription,
	awdpPhaseLabel,
	awdpPhaseTone,
	buildAwdpGates,
	runAwdpAction,
	type AwdpAction,
} from "./shared";

const TAB_KEYS = ["config", "gameboxes", "instances", "scores", "data"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function normalizeTab(raw: string | null): TabKey {
	return TAB_KEYS.find((key) => key === raw) ?? "config";
}

const ACTION_ICON: Record<AwdpAction, ReactNode> = {
	start: <Play aria-hidden="true" />,
	breakToFix: <RotateCcw aria-hidden="true" />,
	finish: <Square aria-hidden="true" />,
};

export function AwdpOpsPage(): ReactNode {
	const { eventId = "" } = useParams<{ eventId: string }>();
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [searchParams, setSearchParams] = useSearchParams();

	const eventQuery = useAwdpEvent(eventId);
	const configQuery = useAwdpConfig(eventId);
	const event = eventQuery.data;
	const phase = configQuery.data?.phase ?? null;
	const tab = normalizeTab(searchParams.get("tab"));

	useDocumentTitle(
		event
			? t("adminAwdpOps.page.documentTitleNamed", { name: event.title })
			: t("adminAwdpOps.page.documentTitle"),
	);

	const refreshAll = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: qk.awdp.adminConfig(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awdp.adminGameboxes(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awdp.adminInstances(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awdp.adminScores(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awdp.adminData(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.event(eventId) });
	}, [queryClient, eventId]);

	const lifecycle = useMutation({
		mutationFn: (action: AwdpAction) => runAwdpAction(client, eventId, action, t),
		onSuccess: (_result, action) => {
			toast.success(
				t("adminAwdpOps.actions.submitted", { action: awdpActionLabel(action, t) }),
				t("adminAwdpOps.actions.submittedDescription"),
			);
			refreshAll();
		},
		onError: (error, action) =>
			toast.apiError(
				t("adminAwdpOps.actions.failed", { action: awdpActionLabel(action, t) }),
				error,
			),
	});

	const phaseIndex = phase === null ? -1 : AWDP_PHASE_ORDER.indexOf(phase);
	const gates = buildAwdpGates(phase, t);
	const pendingAction = lifecycle.isPending ? lifecycle.variables : null;
	const refreshing = configQuery.isFetching || eventQuery.isFetching;

	const changeTab = (next: string) => {
		const nextParams = new URLSearchParams(searchParams);
		nextParams.set("tab", next);
		setSearchParams(nextParams, { replace: true });
	};

	if (eventId === "") {
		return (
			<PageBody>
				<NotFoundBlock
					title={t("adminAwdpOps.page.missingEventIdTitle")}
					description={t("adminAwdpOps.page.missingEventIdDescription")}
					action={
						<Button asChild>
							<Link to="/admin/events">{t("adminAwdpOps.page.backToEvents")}</Link>
						</Button>
					}
				/>
			</PageBody>
		);
	}

	if (eventQuery.isPending) {
		return (
			<PageBody>
				<PageHeader
					title={t("adminAwdpOps.page.title")}
					description={t("adminAwdpOps.page.loadingDescription")}
				/>
				<LoadingBlock label={t("adminAwdpOps.page.loading")} />
			</PageBody>
		);
	}

	if (eventQuery.isError) {
		if (isForbidden(eventQuery.error)) {
			return (
				<PageBody>
					<PageHeader title={t("adminAwdpOps.page.title")} />
					<PermissionDeniedBlock description={t("adminAwdpOps.page.forbiddenDescription")} />
				</PageBody>
			);
		}
		if (isNotFound(eventQuery.error)) {
			return (
				<PageBody>
					<PageHeader title={t("adminAwdpOps.page.title")} />
					<NotFoundBlock
						title={t("adminAwdpOps.page.notFoundTitle")}
						description={t("adminAwdpOps.page.notFoundDescription")}
						action={
							<Button asChild>
								<Link to="/admin/events">{t("adminAwdpOps.page.backToEvents")}</Link>
							</Button>
						}
					/>
				</PageBody>
			);
		}
		return (
			<PageBody>
				<PageHeader title={t("adminAwdpOps.page.title")} />
				<ErrorBlock
					error={eventQuery.error}
					title={t("adminAwdpOps.page.loadError")}
					onRetry={() => void eventQuery.refetch()}
				/>
				<Button variant="outline" size="sm" className="w-fit" asChild>
					<Link to="/admin/events">
						<ArrowLeft aria-hidden="true" /> {t("adminAwdpOps.page.backToEvents")}
					</Link>
				</Button>
			</PageBody>
		);
	}

	const familyKey = event ? EVENT_FAMILY_KEY[event.family] : undefined;
	const modeKey = event ? PARTICIPANT_MODE_KEY[event.participant_mode] : undefined;

	return (
		<PageBody>
			<PageHeader
				title={
					event
						? t("adminAwdpOps.page.titleNamed", { name: event.title })
						: t("adminAwdpOps.page.title")
				}
				description={t("adminAwdpOps.page.subtitle")}
				badge={<AwdpPhasePill phase={phase} />}
				breadcrumbs={
					<span className="inline-flex flex-wrap items-center gap-1.5">
						<Link className="hover:text-foreground hover:underline" to="/admin/events">
							{t("adminAwdpOps.page.breadcrumbEvents")}
						</Link>
						<span aria-hidden="true">/</span>
						<Link
							className="max-w-[16rem] truncate hover:text-foreground hover:underline"
							to={`/admin/events/${eventId}`}
							title={event?.title ?? eventId}
						>
							{event?.title ?? eventId}
						</Link>
						<span aria-hidden="true">/</span>
						<span className="text-foreground" aria-current="page">
							{t("adminAwdpOps.page.breadcrumbCurrent")}
						</span>
					</span>
				}
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							disabled={refreshing}
							onClick={() => {
								void configQuery.refetch();
								refreshAll();
							}}
						>
							<RefreshCw className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
							{t("common.refresh")}
						</Button>
						<Button variant="ghost" size="sm" asChild>
							<Link to={`/admin/events/${eventId}`}>
								<ArrowLeft aria-hidden="true" />
								{t("adminAwdpOps.page.backToConsole")}
							</Link>
						</Button>
					</>
				}
			/>

			<SectionCard
				title={t("adminAwdpOps.phase.sectionTitle")}
				description={t("adminAwdpOps.phase.sectionDescription")}
			>
				<div className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						<AwdpPhasePill phase={phase} />
						<span className="text-xs text-muted-foreground">
							{configQuery.isPending ? t("common.loading") : awdpPhaseDescription(phase, t)}
						</span>
					</div>

					{phaseIndex >= 0 ? (
						<ol
							className="flex flex-wrap items-center gap-1.5"
							aria-label={t("adminAwdpOps.phase.stepsLabel")}
						>
							{AWDP_PHASE_ORDER.map((step, index) => (
								<li key={step} className="flex items-center gap-1.5">
									{index > 0 ? (
										<ChevronRight
											className="size-3.5 text-muted-foreground"
											aria-hidden="true"
										/>
									) : null}
									{index === phaseIndex ? (
										<TonePill tone={awdpPhaseTone(step)}>
											{awdpPhaseLabel(step, t)}
										</TonePill>
									) : (
										<span
											className={
												index < phaseIndex ? "text-xs text-foreground" : "text-xs text-muted-foreground"
											}
										>
											{awdpPhaseLabel(step, t)}
										</span>
									)}
								</li>
							))}
						</ol>
					) : null}

					<div className="flex flex-wrap items-center gap-2">
						{AWDP_ACTION_ORDER.map((action) => {
							const gate = gates[action];
							const label = awdpActionLabel(action, t);
							const variant =
								!gate.enabled ? "outline" : action === "finish" ? "destructive" : "default";
							return (
								<Button
									key={action}
									variant={variant}
									size="sm"
									disabled={!gate.enabled || lifecycle.isPending}
									title={gate.reason ?? undefined}
									onClick={async () => {
										const ok = await confirm(awdpActionConfirm(action, t));
										if (ok) lifecycle.mutate(action);
									}}
								>
									{pendingAction === action ? (
										<Loader2 className="animate-spin" aria-hidden="true" />
									) : (
										ACTION_ICON[action]
									)}
									{label}
								</Button>
							);
						})}
					</div>

					{configQuery.isError ? (
						<ErrorBlock
							error={configQuery.error}
							title={t("adminAwdpOps.phase.configError")}
							onRetry={() => void configQuery.refetch()}
						/>
					) : null}

					<ul className="space-y-1 text-xs text-muted-foreground">
						<li>{t("adminAwdpOps.phase.autoAdvanceNote")}</li>
						<li>{t("adminAwdpOps.phase.resetNote")}</li>
						{configQuery.data
							? AWDP_ACTION_ORDER.filter((action) => !gates[action].enabled).map((action) => (
									<li key={action}>
										<span className="text-foreground">
											{t("adminAwdpOps.phase.disabledAction", {
												action: awdpActionLabel(action, t),
											})}
										</span>
										<span> · {gates[action].reason}</span>
									</li>
								))
							: null}
					</ul>

					{configQuery.data ? (
						<KeyValueList
							columns={3}
							items={[
								{
									key: t("adminAwdpOps.phase.meta.totalDuration"),
									value: (
										<span className="tnum">
											{formatDuration(
												configQuery.data.break_duration_secs +
													configQuery.data.fix_duration_secs,
											)}
										</span>
									),
								},
								{
									key: t("adminAwdpOps.phase.meta.totalRounds"),
									value: <span className="tnum">{formatInt(configQuery.data.total_rounds)}</span>,
								},
								{
									key: t("adminAwdpOps.phase.meta.currentRound"),
									value: (
										<span className="tnum">{formatInt(configQuery.data.current_round)}</span>
									),
								},
								{
									key: t("adminAwdpOps.phase.meta.breakScore"),
									value: <span className="tnum">{formatInt(configQuery.data.break_score)}</span>,
								},
								{
									key: t("adminAwdpOps.phase.meta.fixRoundScore"),
									value: (
										<span className="tnum">{formatInt(configQuery.data.fix_round_score)}</span>
									),
								},
								{
									key: t("adminAwdpOps.phase.meta.configurationGeneration"),
									value: (
										<span className="tnum">
											{formatInt(configQuery.data.configuration_generation)}
										</span>
									),
								},
							]}
						/>
					) : null}
				</div>
			</SectionCard>

			<Tabs value={tab} onValueChange={changeTab}>
				<div className="overflow-x-auto">
					<TabsList
						variant="line"
						className="w-max min-w-full justify-start"
						aria-label={t("adminAwdpOps.tabs.label")}
					>
						<TabsTrigger value="config">{t("adminAwdpOps.tabs.config")}</TabsTrigger>
						<TabsTrigger value="gameboxes">{t("adminAwdpOps.tabs.gameboxes")}</TabsTrigger>
						<TabsTrigger value="instances">{t("adminAwdpOps.tabs.instances")}</TabsTrigger>
						<TabsTrigger value="scores">{t("adminAwdpOps.tabs.scores")}</TabsTrigger>
						<TabsTrigger value="data">{t("adminAwdpOps.tabs.data")}</TabsTrigger>
					</TabsList>
				</div>
				<TabsContent value="config" className="mt-4">
					<AwdpConfigTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="gameboxes" className="mt-4">
					<AwdpGameboxesTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="instances" className="mt-4">
					<AwdpInstancesTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="scores" className="mt-4">
					<AwdpScoresTab eventId={eventId} />
				</TabsContent>
				<TabsContent value="data" className="mt-4">
					<AwdpDataTab eventId={eventId} />
				</TabsContent>
			</Tabs>

			{event ? (
				<p className="text-xs text-muted-foreground">
					{t("adminAwdpOps.page.meta", {
						family: familyKey ? t(familyKey) : event.family,
						mode: modeKey ? t(modeKey) : event.participant_mode,
					})}
				</p>
			) : null}
		</PageBody>
	);
}
