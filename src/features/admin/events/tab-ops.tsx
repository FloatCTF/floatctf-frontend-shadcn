/**
 * 赛事控制台 · AWD / AWDP 只读概览标签。
 *
 * 这里**只做摘要与跳转**：完整的运维流程（部署 / 开始 / 暂停 / 结束 / 归档 / 预检 /
 * GameBox 与网络管理）属于 `features/admin/awd-ops` 与 `features/admin/awdp-ops` 的独立页面，
 * 本标签不复制那套操作，避免出现两个「能改状态」的入口。
 *
 * - AWD：`client.awd.admin.getStatus(eventId)`（`data` 可能为 `null` → `callMaybe`）+ `scores`
 * - AWDP：`client.awdp.admin.getConfig(eventId)` + `scores`
 *
 * 文案全部走 `adminEvents.ops` 命名空间；`status` / `phase` 原值是后端技术标识，
 * 只在旁边补本地化说明，不替换原值。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";

import { call, callMaybe } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill, type PillTone } from "~/components/app/badges";
import type { DataTableColumn } from "~/components/app/data-table";
import { DataTable } from "~/components/app/data-table";
import { KeyValueList, MonoText, SectionCard, StatCard, Toolbar } from "~/components/app/page";
import { EmptyBlock, ErrorBlock, LoadingBlock, QueryState } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import type { AwdpEventConfigDto, AwdpScoreRow, AwdEventStatus, AwdScoreRow } from "@floatctf/sdk";
import { formatDateTime, formatDuration, formatScore } from "~/lib/format";

import { MobileFacts } from "./shared";

/* ── AWD ────────────────────────────────────────────────────────────────── */

function awdStatusTone(status: string): PillTone {
	switch (status) {
		case "running":
		case "verified":
			return "success";
		case "paused":
		case "start_blocked":
		case "verification_failed":
		case "deploy_failed":
			return "warning";
		case "network_error":
			return "danger";
		case "configuring":
		case "deploying":
		case "deployed":
		case "prechecking":
			return "info";
		default:
			return "muted";
	}
}

const AWD_PHASE_KEY: Record<string, string> = {
	hardening: "adminEvents.ops.awd.phases.hardening",
	attack: "adminEvents.ops.awd.phases.attack",
	pause: "adminEvents.ops.awd.phases.pause",
};

export function EventAwdTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const statusQuery = useQuery({
		queryKey: qk.awd.adminStatus(eventId),
		queryFn: () =>
			callMaybe<AwdEventStatus>(
				client.awd.admin.getStatus(eventId),
				t("adminEvents.actions.loadAwdStatus"),
			),
	});
	const scoresQuery = useQuery({
		queryKey: qk.awd.adminScores(eventId),
		queryFn: () =>
			call<AwdScoreRow[]>(
				client.awd.admin.scores(eventId),
				t("adminEvents.actions.loadAwdScores"),
			),
	});

	const scoreColumns: DataTableColumn<AwdScoreRow>[] = [
		{
			id: "rank",
			header: t("adminEvents.ops.awd.columns.rank"),
			align: "right",
			cell: (row) => <MonoText>{row.rank}</MonoText>,
			sortValue: (row) => row.rank,
		},
		{
			id: "team_name",
			header: t("adminEvents.ops.awd.columns.team"),
			cell: (row) => row.team_name,
			sortValue: (row) => row.team_name,
		},
		{
			id: "attack_score",
			header: t("adminEvents.ops.awd.columns.attack"),
			align: "right",
			cell: (row) => <MonoText>{formatScore(row.attack_score)}</MonoText>,
			sortValue: (row) => row.attack_score,
		},
		{
			id: "defense_score",
			header: t("adminEvents.ops.awd.columns.defense"),
			align: "right",
			cell: (row) => <MonoText>{formatScore(row.defense_score)}</MonoText>,
			sortValue: (row) => row.defense_score,
		},
		{
			id: "total_score",
			header: t("adminEvents.ops.awd.columns.total"),
			align: "right",
			cell: (row) => <MonoText>{formatScore(row.total_score)}</MonoText>,
			sortValue: (row) => row.total_score,
		},
	];

	const status = statusQuery.data ?? null;
	const phaseKey = status ? AWD_PHASE_KEY[status.phase] : undefined;

	return (
		<div className="space-y-5">
			<SectionCard
				title={t("adminEvents.ops.awd.summaryTitle")}
				description={t("adminEvents.ops.awd.summaryDescription")}
				actions={
					<Toolbar>
						<Button
							variant="outline"
							size="sm"
							disabled={statusQuery.isFetching}
							onClick={() => {
								void statusQuery.refetch();
								void scoresQuery.refetch();
							}}
						>
							<RefreshCw className={statusQuery.isFetching ? "animate-spin" : undefined} />{" "}
							{t("common.refresh")}
						</Button>
						<Button size="sm" asChild>
							<Link to={`/admin/events/${eventId}/awd`}>
								<ExternalLink /> {t("adminEvents.ops.awd.openOps")}
							</Link>
						</Button>
					</Toolbar>
				}
			>
				{statusQuery.isPending ? (
					<LoadingBlock label={t("adminEvents.ops.awd.loading")} />
				) : statusQuery.isError ? (
					<ErrorBlock
						error={statusQuery.error}
						title={t("adminEvents.ops.awd.loadError")}
						onRetry={() => void statusQuery.refetch()}
					/>
				) : status === null ? (
					<EmptyBlock
						title={t("adminEvents.ops.awd.emptyTitle")}
						description={t("adminEvents.ops.awd.emptyDescription")}
						icon={<ShieldAlert className="size-6" />}
						action={
							<Button size="sm" asChild>
								<Link to={`/admin/events/${eventId}/awd`}>
									{t("adminEvents.ops.awd.goToOps")}
								</Link>
							</Button>
						}
					/>
				) : (
					<div className="space-y-5">
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<StatCard
								label={t("adminEvents.ops.awd.stats.status.label")}
								value={
									<TonePill tone={awdStatusTone(status.status)} title={status.status}>
										{status.status}
									</TonePill>
								}
								hint={t("adminEvents.ops.awd.stats.status.hint")}
							/>
							<StatCard
								label={t("adminEvents.ops.awd.stats.phase.label")}
								value={
									<TonePill tone="info" title={status.phase}>
										{status.phase}
									</TonePill>
								}
								hint={
									phaseKey
										? t(phaseKey)
										: t("adminEvents.ops.awd.stats.phase.hintFallback")
								}
							/>
							<StatCard
								label={t("adminEvents.ops.awd.stats.rounds.label")}
								value={
									status.round_count === null
										? t("adminEvents.ops.awd.stats.rounds.unset")
										: status.round_count
								}
								hint={t("adminEvents.ops.awd.stats.rounds.hint", {
									duration: formatDuration(status.round_duration_secs),
								})}
							/>
							<StatCard
								label={t("adminEvents.ops.awd.stats.initialScore.label")}
								value={formatScore(status.initial_score)}
								hint={t("adminEvents.ops.awd.stats.initialScore.hint", {
									free: status.free_reset_count,
									penalty: formatScore(status.extra_reset_penalty),
								})}
								tone="warning"
							/>
						</div>

						{status.status === "network_error" ? (
							<p
								role="alert"
								className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
							>
								{t("adminEvents.ops.awd.networkError")}
							</p>
						) : null}
						{status.final_settlement ? (
							<p
								role="status"
								className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
							>
								{t("adminEvents.ops.awd.finalSettlement")}
							</p>
						) : null}

						<KeyValueList
							columns={3}
							items={[
								{
									key: t("adminEvents.ops.awd.fields.plannedStart.key"),
									value: status.planned_start_at ? (
										<MonoText>{formatDateTime(status.planned_start_at, { seconds: true })}</MonoText>
									) : (
										<span className="text-xs text-muted-foreground">
											{t("adminEvents.ops.awd.fields.plannedStart.unset")}
										</span>
									),
								},
								{
									key: t("adminEvents.ops.awd.fields.startedAt.key"),
									value: status.started_at ? (
										<MonoText>{formatDateTime(status.started_at, { seconds: true })}</MonoText>
									) : (
										<span className="text-xs text-muted-foreground">
											{t("adminEvents.ops.awd.fields.startedAt.notStarted")}
										</span>
									),
								},
								{
									key: t("adminEvents.ops.awd.fields.verifiedAt.key"),
									value: status.verified_at ? (
										<MonoText>{formatDateTime(status.verified_at, { seconds: true })}</MonoText>
									) : (
										<span className="text-xs text-muted-foreground">
											{t("adminEvents.ops.awd.fields.verifiedAt.notVerified")}
										</span>
									),
								},
								{
									key: t("adminEvents.ops.awd.fields.judge.key"),
									value: (
										<MonoText>
											{t("adminEvents.ops.awd.fields.judge.value", {
												concurrency: status.judge_max_concurrency,
												timeout: formatDuration(status.judge_default_timeout_secs),
											})}
										</MonoText>
									),
								},
								{
									key: t("adminEvents.ops.awd.fields.judgeRetry.key"),
									value: <MonoText>{formatDuration(status.judge_retry_interval_secs)}</MonoText>,
								},
								{
									key: t("adminEvents.ops.awd.fields.archiveRetention.key"),
									value: (
										<MonoText>
											{t("adminEvents.ops.awd.fields.archiveRetention.value", {
												hours: status.archive_retention_hours,
											})}
										</MonoText>
									),
								},
								{
									key: t("adminEvents.ops.awd.fields.updatedAt.key"),
									value: <MonoText>{formatDateTime(status.updated_at, { seconds: true })}</MonoText>,
								},
							]}
						/>
					</div>
				)}
			</SectionCard>

			<SectionCard
				title={t("adminEvents.ops.awd.scores.title")}
				description={t("adminEvents.ops.awd.scores.description")}
			>
				<QueryState
					query={scoresQuery}
					errorTitle={t("adminEvents.ops.awd.scores.loadError")}
					skeleton={<LoadingBlock label={t("adminEvents.ops.awd.scores.loading")} />}
					isEmpty={(rows) => rows.length === 0}
					empty={
						<EmptyBlock
							title={t("adminEvents.ops.awd.scores.emptyTitle")}
							description={t("adminEvents.ops.awd.scores.emptyDescription")}
						/>
					}
				>
					{(rows) => (
						<DataTable
							data={rows}
							columns={scoreColumns}
							getRowId={(row) => row.team_id}
							mobileCard={(row) => (
								<MobileFacts
									items={[
										{
											k: t("adminEvents.ops.awd.mobile.rank"),
											v: <MonoText>{row.rank}</MonoText>,
										},
										{ k: t("adminEvents.ops.awd.mobile.team"), v: row.team_name },
										{
											k: t("adminEvents.ops.awd.mobile.attack"),
											v: <MonoText>{formatScore(row.attack_score)}</MonoText>,
										},
										{
											k: t("adminEvents.ops.awd.mobile.defense"),
											v: <MonoText>{formatScore(row.defense_score)}</MonoText>,
										},
										{
											k: t("adminEvents.ops.awd.mobile.total"),
											v: <MonoText>{formatScore(row.total_score)}</MonoText>,
										},
									]}
								/>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>
		</div>
	);
}

/* ── AWDP ───────────────────────────────────────────────────────────────── */

/** `AwdpPhase` 含过渡态 `preparing_fix`，必须如实展示（见 CONVENTIONS §6.19）。 */
const AWDP_PHASE_KEY: Record<string, string> = {
	pending: "adminEvents.ops.awdp.phases.pending",
	break: "adminEvents.ops.awdp.phases.break",
	preparing_fix: "adminEvents.ops.awdp.phases.preparingFix",
	fix: "adminEvents.ops.awdp.phases.fix",
	ended: "adminEvents.ops.awdp.phases.ended",
};

function awdpPhaseTone(phase: string): PillTone {
	switch (phase) {
		case "break":
			return "danger";
		case "preparing_fix":
			return "warning";
		case "fix":
			return "info";
		case "ended":
			return "muted";
		default:
			return "neutral";
	}
}

export function EventAwdpTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const configQuery = useQuery({
		queryKey: qk.awdp.adminConfig(eventId),
		queryFn: () =>
			call<AwdpEventConfigDto>(
				client.awdp.admin.getConfig(eventId),
				t("adminEvents.actions.loadAwdpConfig"),
			),
	});
	const scoresQuery = useQuery({
		queryKey: qk.awdp.adminScores(eventId),
		queryFn: () =>
			call<AwdpScoreRow[]>(
				client.awdp.admin.scores(eventId),
				t("adminEvents.actions.loadAwdpScores"),
			),
	});

	const scoreColumns: DataTableColumn<AwdpScoreRow>[] = [
		{
			id: "rank",
			header: t("adminEvents.ops.awdp.columns.rank"),
			align: "right",
			cell: (row) => <MonoText>{row.rank}</MonoText>,
			sortValue: (row) => row.rank,
		},
		{
			id: "subject_name",
			header: t("adminEvents.ops.awdp.columns.subject"),
			cell: (row) => row.subject_name,
			sortValue: (row) => row.subject_name,
		},
		{
			id: "break_score",
			header: t("adminEvents.ops.awdp.columns.breakScore"),
			align: "right",
			cell: (row) => <MonoText>{formatScore(row.break_score)}</MonoText>,
			sortValue: (row) => row.break_score,
		},
		{
			id: "fix_score",
			header: t("adminEvents.ops.awdp.columns.fixScore"),
			align: "right",
			cell: (row) => <MonoText>{formatScore(row.fix_score)}</MonoText>,
			sortValue: (row) => row.fix_score,
		},
		{
			id: "total_score",
			header: t("adminEvents.ops.awdp.columns.total"),
			align: "right",
			cell: (row) => <MonoText>{formatScore(row.total_score)}</MonoText>,
			sortValue: (row) => row.total_score,
		},
	];

	return (
		<div className="space-y-5">
			<SectionCard
				title={t("adminEvents.ops.awdp.summaryTitle")}
				description={t("adminEvents.ops.awdp.summaryDescription")}
				actions={
					<Toolbar>
						<Button
							variant="outline"
							size="sm"
							disabled={configQuery.isFetching}
							onClick={() => {
								void configQuery.refetch();
								void scoresQuery.refetch();
							}}
						>
							<RefreshCw className={configQuery.isFetching ? "animate-spin" : undefined} />{" "}
							{t("common.refresh")}
						</Button>
						<Button size="sm" asChild>
							<Link to={`/admin/events/${eventId}/awdp`}>
								<ExternalLink /> {t("adminEvents.ops.awdp.openWorkbench")}
							</Link>
						</Button>
					</Toolbar>
				}
			>
				<QueryState
					query={configQuery}
					errorTitle={t("adminEvents.ops.awdp.loadError")}
					skeleton={<LoadingBlock label={t("adminEvents.ops.awdp.loading")} />}
				>
					{(config) => {
						const phaseKey = AWDP_PHASE_KEY[config.phase];
						return (
							<div className="space-y-5">
								<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
									<StatCard
										label={t("adminEvents.ops.awdp.stats.phase.label")}
										value={
											<TonePill tone={awdpPhaseTone(config.phase)} title={config.phase}>
												{config.phase}
											</TonePill>
										}
										hint={
											phaseKey
												? t(phaseKey)
												: t("adminEvents.ops.awdp.stats.phase.hintFallback")
										}
									/>
									<StatCard
										label={t("adminEvents.ops.awdp.stats.round.label")}
										value={`${config.current_round} / ${config.total_rounds}`}
										hint={t("adminEvents.ops.awdp.stats.round.hint", {
											generation: config.configuration_generation,
										})}
									/>
									<StatCard
										label={t("adminEvents.ops.awdp.stats.break.label")}
										value={formatDuration(config.break_duration_secs)}
										hint={t("adminEvents.ops.awdp.stats.break.hint", {
											score: formatScore(config.break_score),
										})}
									/>
									<StatCard
										label={t("adminEvents.ops.awdp.stats.fix.label")}
										value={formatDuration(config.fix_duration_secs)}
										hint={t("adminEvents.ops.awdp.stats.fix.hint", {
											score: formatScore(config.fix_round_score),
											interval: formatDuration(config.fix_round_interval_secs),
										})}
										tone="success"
									/>
								</div>

								<KeyValueList
									columns={3}
									items={[
										{
											key: t("adminEvents.ops.awdp.fields.startedAt.key"),
											value: config.started_at ? (
												<MonoText>{formatDateTime(config.started_at, { seconds: true })}</MonoText>
											) : (
												<span className="text-xs text-muted-foreground">
													{t("adminEvents.ops.awdp.fields.startedAt.notStarted")}
												</span>
											),
										},
										{
											key: t("adminEvents.ops.awdp.fields.breakEndsAt.key"),
											value: config.break_ends_at ? (
												<MonoText>{formatDateTime(config.break_ends_at, { seconds: true })}</MonoText>
											) : (
												<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
											),
										},
										{
											key: t("adminEvents.ops.awdp.fields.fixRange.key"),
											value: (
												<MonoText>
													{config.fix_started_at
														? formatDateTime(config.fix_started_at, { seconds: true })
														: t("common.empty")}{" "}
													→{" "}
													{config.fix_ends_at
														? formatDateTime(config.fix_ends_at, { seconds: true })
														: t("common.empty")}
												</MonoText>
											),
										},
										{
											key: t("adminEvents.ops.awdp.fields.finishedAt.key"),
											value: config.finished_at ? (
												<MonoText>{formatDateTime(config.finished_at, { seconds: true })}</MonoText>
											) : (
												<span className="text-xs text-muted-foreground">
													{t("adminEvents.ops.awdp.fields.finishedAt.notFinished")}
												</span>
											),
										},
										{
											key: t("adminEvents.ops.awdp.fields.nextActionAt.key"),
											value: config.next_action_at ? (
												<MonoText>{formatDateTime(config.next_action_at, { seconds: true })}</MonoText>
											) : (
												<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
											),
										},
										{
											key: t("adminEvents.ops.awdp.fields.updatedAt.key"),
											value: (
												<MonoText>{formatDateTime(config.updated_at, { seconds: true })}</MonoText>
											),
										},
									]}
								/>
							</div>
						);
					}}
				</QueryState>
			</SectionCard>

			<SectionCard
				title={t("adminEvents.ops.awdp.scores.title")}
				description={t("adminEvents.ops.awdp.scores.description")}
			>
				<QueryState
					query={scoresQuery}
					errorTitle={t("adminEvents.ops.awdp.scores.loadError")}
					skeleton={<LoadingBlock label={t("adminEvents.ops.awdp.scores.loading")} />}
					isEmpty={(rows) => rows.length === 0}
					empty={
						<EmptyBlock
							title={t("adminEvents.ops.awdp.scores.emptyTitle")}
							description={t("adminEvents.ops.awdp.scores.emptyDescription")}
						/>
					}
				>
					{(rows) => (
						<DataTable
							data={rows}
							columns={scoreColumns}
							getRowId={(row) => row.subject_id}
							mobileCard={(row) => (
								<MobileFacts
									items={[
										{
											k: t("adminEvents.ops.awdp.mobile.rank"),
											v: <MonoText>{row.rank}</MonoText>,
										},
										{ k: t("adminEvents.ops.awdp.mobile.subject"), v: row.subject_name },
										{
											k: t("adminEvents.ops.awdp.mobile.breakScore"),
											v: <MonoText>{formatScore(row.break_score)}</MonoText>,
										},
										{
											k: t("adminEvents.ops.awdp.mobile.fixScore"),
											v: <MonoText>{formatScore(row.fix_score)}</MonoText>,
										},
										{
											k: t("adminEvents.ops.awdp.mobile.total"),
											v: <MonoText>{formatScore(row.total_score)}</MonoText>,
										},
									]}
								/>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>
		</div>
	);
}
