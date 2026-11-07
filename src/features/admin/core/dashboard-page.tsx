/**
 * 管理端总览（`/admin`）—— 平台聚合状态 + 系统监控 + 平台版本。
 *
 * 三个真实接口：
 * - `client.admin.dashboard.summary()` → 聚合统计 / 需要关注 / 赛事 / 动态（60s 轮询）；
 * - `client.admin.system.monitor()`   → 宿主 CPU·内存·磁盘·网卡·Docker（60s 轮询）；
 * - `client.admin.system.version()`   → 平台版本。
 *
 * `DashboardSummary` 的子结构在 SDK 里是内联匿名类型，这里用索引类型取用，
 * 不额外复制一份 DTO（避免与 SDK 漂移）。所有用户可见文案走 `adminCore.dashboard.*`。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import {
	AlertTriangle,
	Boxes,
	CalendarDays,
	Container,
	Cpu,
	HardDrive,
	Megaphone,
	MessagesSquare,
	Puzzle,
	RefreshCw,
	ServerCog,
	Swords,
	Thermometer,
	Users,
} from "lucide-react";

import { call } from "~/api/call";
import { useAppQueryClient, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import {
	CopyText,
	MonoText,
	PageBody,
	PageHeader,
	SectionCard,
	StatCard,
} from "~/components/app/page";
import { EmptyBlock, LoadingBlock, QueryState } from "~/components/app/states";
import { UserAvatar } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import {
	EVENT_STATUS_TONE,
	computeEventStatus,
} from "~/lib/event-status";
import {
	formatBytes,
	formatDuration,
	formatInt,
	formatRange,
	formatRelative,
} from "~/lib/format";
import { useDocumentTitle, useNow } from "~/lib/hooks";
import type {
	DashboardSummary,
	DiskInformation,
	NetworkInterfaceInfo,
	SystemInformation,
} from "@floatctf/sdk";

import { useAdminEventLabels, type AdminEventLabels } from "./shared";

const AWD_STATUS_KEYS: Record<string, string> = {
	draft: "adminCore.dashboard.awdStatus.draft",
	configuring: "adminCore.dashboard.awdStatus.configuring",
	deploying: "adminCore.dashboard.awdStatus.deploying",
	deployed: "adminCore.dashboard.awdStatus.deployed",
	prechecking: "adminCore.dashboard.awdStatus.prechecking",
	verified: "adminCore.dashboard.awdStatus.verified",
	running: "adminCore.dashboard.awdStatus.running",
	paused: "adminCore.dashboard.awdStatus.paused",
	network_error: "adminCore.dashboard.awdStatus.networkError",
	start_blocked: "adminCore.dashboard.awdStatus.startBlocked",
	finished: "adminCore.dashboard.awdStatus.finished",
	archived: "adminCore.dashboard.awdStatus.archived",
	deploy_failed: "adminCore.dashboard.awdStatus.deployFailed",
	verification_failed: "adminCore.dashboard.awdStatus.verificationFailed",
};

const AWD_STATUS_TONES: Record<string, "success" | "warning" | "danger" | "info" | "muted"> = {
	draft: "muted",
	configuring: "info",
	deploying: "info",
	deployed: "info",
	prechecking: "warning",
	verified: "success",
	running: "success",
	paused: "warning",
	network_error: "danger",
	start_blocked: "danger",
	finished: "muted",
	archived: "muted",
	deploy_failed: "danger",
	verification_failed: "danger",
};

const AWD_PHASE_KEYS: Record<string, string> = {
	hardening: "adminCore.dashboard.awdPhase.hardening",
	attack: "adminCore.dashboard.awdPhase.attack",
	pause: "adminCore.dashboard.awdPhase.pause",
};

function awdStatusLabel(t: TFunction, status: string): string {
	const key = AWD_STATUS_KEYS[status];
	return key ? t(key) : status;
}

function awdPhaseLabel(t: TFunction, phase: string): string {
	const key = AWD_PHASE_KEYS[phase];
	return key ? t(key) : phase;
}

type SummaryEvent = DashboardSummary["events"][number];
type MonitorQuery = {
	isPending: boolean;
	isError: boolean;
	error: unknown;
	data: SystemInformation | undefined;
	refetch: () => void;
};

function percent(used: number, total: number): number {
	if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
	return Math.min(100, Math.max(0, (used / total) * 100));
}

/** sysinfo 读不到传感器时返回 0；0 不代表「0 度」，如实显示为未知。 */
function temperatureText(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "—";
	return `${value.toFixed(1)} °C`;
}

/** 磁盘用量：后端已换算为 GB（`bytes / 1e9`），按 GB 显示，不做二次换算。 */
function gigabytes(value: number): string {
	if (!Number.isFinite(value)) return "—";
	return `${value.toFixed(1)} GB`;
}

export function AdminDashboardPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCore.dashboard.documentTitle"));
	const client = useClient();
	const queryClient = useAppQueryClient();
	const now = useNow(30_000);
	const labels = useAdminEventLabels();

	const summary = useQuery({
		queryKey: qk.admin.dashboard(),
		queryFn: () =>
			call<DashboardSummary>(
				client.admin.dashboard.summary(),
				t("adminCore.actions.dashboardSummary"),
			),
		refetchInterval: 60_000,
		refetchIntervalInBackground: false,
	});

	const monitor = useQuery({
		queryKey: qk.admin.system(),
		queryFn: () =>
			call<SystemInformation>(
				client.admin.system.monitor(),
				t("adminCore.actions.systemMonitor"),
			),
		refetchInterval: 60_000,
		refetchIntervalInBackground: false,
	});

	const version = useQuery({
		queryKey: qk.admin.version(),
		queryFn: () =>
			call<string>(client.admin.system.version(), t("adminCore.actions.platformVersion")),
	});

	function refreshAll(): void {
		void queryClient.invalidateQueries({ queryKey: qk.admin.dashboard() });
		void queryClient.invalidateQueries({ queryKey: qk.admin.system() });
		void queryClient.invalidateQueries({ queryKey: qk.admin.version() });
	}

	return (
		<PageBody className="max-w-[1180px]">
			<PageHeader
				title={t("adminCore.dashboard.title")}
				description={t("adminCore.dashboard.description")}
				actions={
					<Button variant="outline" onClick={refreshAll} disabled={summary.isFetching}>
						<RefreshCw
							className={summary.isFetching ? "animate-spin" : undefined}
							aria-hidden="true"
						/>
						{t("common.refresh")}
					</Button>
				}
			/>

			<QueryState
				query={summary}
				skeleton={<LoadingBlock label={t("adminCore.dashboard.loadingSummary")} />}
				errorTitle={t("adminCore.dashboard.errorSummary")}
			>
				{(data) => (
					<>
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<StatCard
								label={t("adminCore.dashboard.stats.users.label")}
								value={formatInt(data.stats.users)}
								hint={t("adminCore.dashboard.stats.users.hint")}
								icon={<Users className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.stats.events.label")}
								value={formatInt(data.stats.events)}
								hint={t("adminCore.dashboard.stats.events.hint")}
								icon={<CalendarDays className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.stats.challenges.label")}
								value={formatInt(data.stats.challenges)}
								hint={t("adminCore.dashboard.stats.challenges.hint")}
								icon={<Puzzle className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.stats.gameboxes.label")}
								value={formatInt(data.stats.gameboxes)}
								hint={t("adminCore.dashboard.stats.gameboxes.hint")}
								icon={<Boxes className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.stats.weapons.label")}
								value={formatInt(data.stats.weapons)}
								icon={<Swords className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.stats.instances.label")}
								value={formatInt(data.stats.instances)}
								hint={t("adminCore.dashboard.stats.instances.hint")}
								icon={<Container className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.stats.announcements.label")}
								value={formatInt(data.stats.announcements)}
								icon={<Megaphone className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.stats.discussions.label")}
								value={formatInt(data.stats.discussions)}
								icon={<MessagesSquare className="size-4" aria-hidden="true" />}
							/>
						</div>

						<AttentionSection summary={data} monitor={monitor.data} />

						<SectionCard
							title={t("adminCore.dashboard.events.title")}
							description={t("adminCore.dashboard.events.description")}
							actions={
								<Button variant="ghost" size="sm" asChild>
									<Link to="/admin/events">{t("adminCore.dashboard.events.manage")}</Link>
								</Button>
							}
							contentClassName="p-0"
						>
							{data.events.length === 0 ? (
								<div className="p-4">
									<EmptyBlock
										title={t("adminCore.dashboard.events.emptyTitle")}
										description={t("adminCore.dashboard.events.emptyDescription")}
									/>
								</div>
							) : (
								<DataTable
									data={data.events}
									getRowId={(row) => row.event_id}
									columns={buildEventColumns(now.getTime(), labels, t)}
									mobileCard={(row) => <EventMobileCard event={row} />}
									empty={<span>{t("adminCore.dashboard.events.empty")}</span>}
								/>
							)}
						</SectionCard>

						<div className="grid gap-5 lg:grid-cols-2">
							<SectionCard
								title={t("adminCore.dashboard.solves.title")}
								description={t("adminCore.dashboard.solves.description")}
							>
								<ActivityList
									empty={t("adminCore.dashboard.solves.empty")}
									items={data.activity.recent_solves.map((solve) => ({
										key: `${solve.nickname}-${solve.challenge_name}-${solve.solved_at}`,
										nickname: solve.nickname,
										avatar: solve.avatar,
										primary: t("adminCore.dashboard.solves.line", {
											challenge: solve.challenge_name,
										}),
										at: solve.solved_at,
									}))}
									now={now}
								/>
							</SectionCard>
							<SectionCard
								title={t("adminCore.dashboard.signups.title")}
								description={t("adminCore.dashboard.signups.description")}
							>
								<ActivityList
									empty={t("adminCore.dashboard.signups.empty")}
									items={data.activity.recent_signups.map((signup) => ({
										key: `${signup.username}-${signup.created_at}`,
										nickname: signup.nickname || signup.username,
										avatar: signup.avatar,
										primary: signup.username,
										at: signup.created_at,
									}))}
									now={now}
								/>
							</SectionCard>
						</div>
					</>
				)}
			</QueryState>

			<SystemMonitorSection monitor={monitor} />

			<SectionCard
				title={t("adminCore.dashboard.version.title")}
				description={t("adminCore.dashboard.version.description")}
			>
				<QueryState
					query={version}
					skeleton={<LoadingBlock label={t("adminCore.dashboard.version.loading")} />}
				>
					{(value) =>
						value ? (
							<div className="flex items-center gap-2">
								<MonoText className="text-sm">{value}</MonoText>
								<CopyText value={value} label={t("adminCore.dashboard.version.copyLabel")} />
							</div>
						) : (
							<EmptyBlock title={t("adminCore.dashboard.version.empty")} />
						)
					}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}

// ── 需要关注 ────────────────────────────────────────────────────────────────

function AttentionSection({
	summary,
	monitor,
}: {
	summary: DashboardSummary;
	monitor: SystemInformation | undefined;
}) {
	const { t } = useTranslation();
	const items: Array<{ key: string; tone: "danger" | "warning"; node: ReactNode }> = [];

	for (const alert of summary.attention.awd_alerts) {
		items.push({
			key: `awd-${alert.event_id}`,
			tone: "danger",
			node: (
				<span>
					{t("adminCore.dashboard.attention.awdAlert", {
						title: alert.title,
						status: awdStatusLabel(t, alert.status),
						phase: awdPhaseLabel(t, alert.phase),
					})}{" "}
					<MonoText className="text-muted-foreground">({alert.event_id})</MonoText>
				</span>
			),
		});
	}

	for (const task of summary.attention.failed_tasks) {
		items.push({
			key: `task-${task.task_key}`,
			tone: "danger",
			node: (
				<span>
					{t("adminCore.dashboard.attention.taskFailed", {
						name: task.task_name,
						attempt: task.attempt_count,
						max: task.max_attempts,
						error: task.error_msg ?? t("adminCore.dashboard.attention.taskNoError"),
						time: formatRelative(task.updated_at),
					})}
				</span>
			),
		});
	}

	if (summary.attention.error_logs_24h > 0) {
		items.push({
			key: "error-logs",
			tone: "warning",
			node: (
				<span>
					{t("adminCore.dashboard.attention.errorLogs", {
						count: formatInt(summary.attention.error_logs_24h),
					})}
				</span>
			),
		});
	}

	for (const disk of monitor?.disks_info ?? []) {
		if (disk.usage_percent >= 90) {
			items.push({
				key: `disk-${disk.name}-${disk.mount_point}`,
				tone: "warning",
				node: (
					<span>
						{t("adminCore.dashboard.attention.diskAlert", {
							mount: disk.mount_point,
							name: disk.name,
							percent: disk.usage_percent.toFixed(1),
						})}
					</span>
				),
			});
		}
	}

	return (
		<SectionCard
			title={t("adminCore.dashboard.attention.title")}
			description={t("adminCore.dashboard.attention.description")}
		>
			{items.length === 0 ? (
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<TonePill tone="success">{t("adminCore.dashboard.attention.healthy")}</TonePill>
					<span className="text-muted-foreground">
						{monitor
							? t("adminCore.dashboard.attention.healthyDetail")
							: t("adminCore.dashboard.attention.healthyDetailNoMonitor")}
					</span>
				</div>
			) : (
				<ul className="space-y-2">
					{items.map((item) => (
						<li
							key={item.key}
							className={
								item.tone === "danger"
									? "flex items-start gap-2 text-sm text-destructive"
									: "flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
							}
						>
							<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							<div className="min-w-0">{item.node}</div>
						</li>
					))}
				</ul>
			)}
		</SectionCard>
	);
}

// ── 赛事表 ──────────────────────────────────────────────────────────────────

function buildEventColumns(
	nowMs: number,
	labels: AdminEventLabels,
	t: TFunction,
): DataTableColumn<SummaryEvent>[] {
	return [
		{
			id: "title",
			header: t("adminCore.dashboard.events.columns.event"),
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{row.title}</p>
					<MonoText className="text-muted-foreground">{row.event_id}</MonoText>
				</div>
			),
			sortValue: (row) => row.title,
		},
		{
			id: "family",
			header: t("adminCore.dashboard.events.columns.family"),
			cell: (row) => (
				<span className="text-sm">{labels.family(row.family)}</span>
			),
			sortValue: (row) => row.family,
			hideBelow: "sm",
		},
		{
			id: "purpose",
			header: t("adminCore.dashboard.events.columns.purposeMode"),
			cell: (row) => (
				<span className="text-xs text-muted-foreground">
					{labels.purpose(row.purpose)} · {labels.mode(row.participant_mode)}
				</span>
			),
			hideBelow: "lg",
		},
		{
			id: "window",
			header: t("adminCore.dashboard.events.columns.window"),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">
					{formatRange(row.start_time, row.end_time)}
				</span>
			),
			hideBelow: "md",
		},
		{
			id: "status",
			header: t("adminCore.dashboard.events.columns.status"),
			cell: (row) => {
				const status = computeEventStatus(row.start_time, row.end_time, nowMs);
				return (
					<div className="flex flex-wrap items-center gap-1">
						<TonePill tone={EVENT_STATUS_TONE[status]}>{labels.status(status)}</TonePill>
						<BooleanPill
							value={row.hidden}
							trueText={t("adminCore.common.visibility.hidden")}
							falseText={t("adminCore.common.visibility.public")}
							trueTone="muted"
							falseTone="success"
						/>
					</div>
				);
			},
		},
		{
			id: "awd",
			header: t("adminCore.dashboard.events.columns.awd"),
			cell: (row) =>
				row.awd ? (
					<div className="flex flex-wrap items-center gap-1">
						<TonePill tone={AWD_STATUS_TONES[row.awd.status] ?? "info"}>
							{awdStatusLabel(t, row.awd.status)}
						</TonePill>
						<span className="text-xs text-muted-foreground">
							{awdPhaseLabel(t, row.awd.phase)}
						</span>
					</div>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				),
			hideBelow: "sm",
		},
	];
}

function EventMobileCard({ event }: { event: SummaryEvent }) {
	const { t } = useTranslation();
	const labels = useAdminEventLabels();
	const status = computeEventStatus(event.start_time, event.end_time);
	return (
		<div className="space-y-1.5">
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm font-medium">{event.title}</p>
				<TonePill tone={EVENT_STATUS_TONE[status]}>{labels.status(status)}</TonePill>
			</div>
			<p className="text-xs text-muted-foreground">
				{labels.family(event.family)} · {labels.purpose(event.purpose)} ·{" "}
				{labels.mode(event.participant_mode)}
			</p>
			<p className="tnum text-xs text-muted-foreground">
				{formatRange(event.start_time, event.end_time)}
			</p>
			<MonoText className="text-muted-foreground">{event.event_id}</MonoText>
			<p className="text-xs text-muted-foreground">
				{t("adminCore.common.visibility.label")}{" "}
				{event.hidden
					? t("adminCore.common.visibility.hidden")
					: t("adminCore.common.visibility.public")}
			</p>
		</div>
	);
}

// ── 动态列表 ────────────────────────────────────────────────────────────────

function ActivityList({
	items,
	empty,
	now,
}: {
	items: Array<{
		key: string;
		nickname: string;
		avatar: string | null;
		primary: string;
		at: string;
	}>;
	empty: string;
	now: Date;
}) {
	if (items.length === 0) return <EmptyBlock title={empty} />;
	return (
		<ul className="divide-y">
			{items.map((item) => (
				<li key={item.key} className="flex items-center gap-3 py-2.5">
					<UserAvatar name={item.nickname} avatar={item.avatar} size="sm" />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm">
							<span className="font-medium">{item.nickname}</span>
							<span className="text-muted-foreground"> {item.primary}</span>
						</p>
						<p className="tnum text-xs text-muted-foreground">
							{formatRelative(item.at, now)}
						</p>
					</div>
				</li>
			))}
		</ul>
	);
}

// ── 系统监控 ────────────────────────────────────────────────────────────────

function SystemMonitorSection({ monitor }: { monitor: MonitorQuery }) {
	const { t } = useTranslation();
	return (
		<SectionCard
			title={t("adminCore.dashboard.system.title")}
			description={t("adminCore.dashboard.system.description")}
		>
			<QueryState
				query={monitor}
				skeleton={<LoadingBlock label={t("adminCore.dashboard.system.loading")} />}
				errorTitle={t("adminCore.dashboard.system.error")}
			>
				{(data) => (
					<div className="space-y-5">
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<StatCard
								label={t("adminCore.dashboard.system.cpu.label")}
								value={t("adminCore.dashboard.system.cpu.cores", {
									count: formatInt(data.nb_cpu),
								})}
								hint={
									data.name
										? `${data.name}${data.os_version ? ` ${data.os_version}` : ""}`
										: undefined
								}
								icon={<Cpu className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.system.uptime.label")}
								value={formatDuration(data.uptime)}
								hint={
									data.host_name
										? t("adminCore.dashboard.system.uptime.hostName", {
												name: data.host_name,
											})
										: undefined
								}
								icon={<ServerCog className="size-4" aria-hidden="true" />}
							/>
							<StatCard
								label={t("adminCore.dashboard.system.temperature.label")}
								value={temperatureText(data.max_temp)}
								hint={t("adminCore.dashboard.system.temperature.average", {
									value: temperatureText(data.avg_temp),
								})}
								icon={<Thermometer className="size-4" aria-hidden="true" />}
								tone={
									data.max_temp >= 80 ? "danger" : data.max_temp >= 65 ? "warning" : "default"
								}
							/>
							<StatCard
								label={t("adminCore.dashboard.system.containers.label")}
								value={formatInt(data.docker_info.running_container_count)}
								hint={t("adminCore.dashboard.system.containers.hint", {
									images: formatInt(data.docker_info.image_count),
									disk: formatBytes(data.docker_info.total_disk),
								})}
								icon={<Container className="size-4" aria-hidden="true" />}
							/>
						</div>

						<div className="grid gap-4 lg:grid-cols-2">
							<UsageMeter
								label={t("adminCore.dashboard.system.memory")}
								used={data.used_memory}
								total={data.total_memory}
								format={formatBytes}
							/>
							<UsageMeter
								label={t("adminCore.dashboard.system.swap")}
								used={data.used_swap}
								total={data.total_swap}
								format={formatBytes}
							/>
						</div>

						{data.kernel_version ? (
							<p className="text-xs text-muted-foreground">
								{t("adminCore.dashboard.system.kernel")}{" "}
								<MonoText>{data.kernel_version}</MonoText>
							</p>
						) : null}

						<DiskSection disks={data.disks_info} />
						<NetworkSection interfaces={data.network_interfaces} />
						<DockerImagesSection monitor={data} />
					</div>
				)}
			</QueryState>
		</SectionCard>
	);
}

function UsageMeter({
	label,
	used,
	total,
	format,
}: {
	label: string;
	used: number;
	total: number;
	format: (value: number) => string;
}) {
	const { t } = useTranslation();
	const value = percent(used, total);
	return (
		<div className="space-y-1.5 rounded-lg border p-3">
			<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
				<span className="flex items-center gap-2 font-medium">
					{label}
					{value >= 90 ? (
						<TonePill tone="danger">{t("adminCore.dashboard.system.nearlyFull")}</TonePill>
					) : null}
				</span>
				<span className="tnum font-mono text-xs text-muted-foreground">
					{format(used)} / {format(total)}（{value.toFixed(1)}%）
				</span>
			</div>
			<Progress
				value={value}
				aria-label={t("adminCore.dashboard.usageLabel", { label })}
			/>
		</div>
	);
}

function DiskSection({ disks }: { disks: DiskInformation[] }) {
	const { t } = useTranslation();
	return (
		<div className="space-y-2">
			<h3 className="flex items-center gap-1.5 text-sm font-medium">
				<HardDrive className="size-4" aria-hidden="true" />
				{t("adminCore.dashboard.disk.title")}
			</h3>
			{disks.length === 0 ? (
				<EmptyBlock title={t("adminCore.dashboard.disk.empty")} />
			) : (
				<div className="space-y-2">
					{disks.map((disk) => (
						<div
							key={`${disk.name}-${disk.mount_point}`}
							className="space-y-1.5 rounded-lg border p-3"
						>
							<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
								<span className="flex flex-wrap items-center gap-2 font-medium">
									{disk.mount_point}
									<span className="text-xs text-muted-foreground">
										{disk.name} · {disk.file_system}
									</span>
									{disk.usage_percent >= 90 ? (
										<TonePill tone="danger">
											{t("adminCore.dashboard.disk.alert")}
										</TonePill>
									) : null}
								</span>
								<span className="tnum font-mono text-xs text-muted-foreground">
									{t("adminCore.dashboard.disk.summary", {
										used: gigabytes(disk.used_space),
										total: gigabytes(disk.total_space),
										percent: disk.usage_percent.toFixed(1),
										available: gigabytes(disk.available_space),
									})}
								</span>
							</div>
							<Progress
								value={Math.min(100, Math.max(0, disk.usage_percent))}
								aria-label={t("adminCore.dashboard.disk.usageLabel", {
									mount: disk.mount_point,
								})}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function NetworkSection({ interfaces }: { interfaces: NetworkInterfaceInfo[] }) {
	const { t } = useTranslation();
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-medium">{t("adminCore.dashboard.network.title")}</h3>
			{interfaces.length === 0 ? (
				<EmptyBlock title={t("adminCore.dashboard.network.empty")} />
			) : (
				<div className="space-y-2">
					{interfaces.map((iface) => (
						<div
							key={iface.name}
							className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
						>
							<div className="min-w-0">
								<p className="font-medium">{iface.name}</p>
								<p className="flex flex-wrap gap-1 text-xs text-muted-foreground">
									{iface.ip_addresses.length === 0 ? (
										<span>{t("adminCore.dashboard.network.noAddress")}</span>
									) : (
										iface.ip_addresses.map((address) => (
											<MonoText key={address}>{address}</MonoText>
										))
									)}
								</p>
							</div>
							<div className="tnum font-mono text-xs text-muted-foreground">
								<div>
									{t("adminCore.dashboard.network.traffic", {
										received: formatBytes(iface.received),
										transmitted: formatBytes(iface.transmitted),
									})}
								</div>
								<div>
									{t("adminCore.dashboard.network.rate", {
										down: formatBytes(iface.recv_rate),
										up: formatBytes(iface.transmit_rate),
									})}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function DockerImagesSection({ monitor }: { monitor: SystemInformation }) {
	const { t } = useTranslation();
	return (
		<div className="space-y-2">
			<h3 className="text-sm font-medium">
				{t("adminCore.dashboard.docker.title", {
					count: formatInt(monitor.docker_info.image_count),
				})}
			</h3>
			{monitor.docker_info.images.length === 0 ? (
				<EmptyBlock title={t("adminCore.dashboard.docker.empty")} />
			) : (
				<ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
					{monitor.docker_info.images.map((image) => (
						<li
							key={image.id}
							className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs"
						>
							<MonoText className="min-w-0">{image.repo_tags.join(", ") || image.id}</MonoText>
							<span className="tnum font-mono text-muted-foreground">
								{formatBytes(image.size)}
							</span>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
