/**
 * 赛事控制台 · 数据大屏标签（`events.getData(eventId)` → `DataPresent`）。
 *
 * 只渲染后端返回的聚合字段：参赛人数 / 战队数、挂题解出统计、Top10 积分榜、
 * 走势（`TrendItem[]`）与最近解出流水。30s 轮询（与平台积分榜 / 趋势语义一致）。
 * 文案全部走 `adminEvents.data` 命名空间。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Puzzle, Users } from "lucide-react";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { TrendChart } from "~/components/app/charts";
import type { DataTableColumn } from "~/components/app/data-table";
import { DataTable } from "~/components/app/data-table";
import { MonoText, SectionCard, StatCard } from "~/components/app/page";
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { UserAvatar } from "~/components/app/user-cell";
import type { DataEventChallenge, DataEventChallengeSolve, DataPresent, ScoreboardItem } from "@floatctf/sdk";
import { formatDateTime, formatPercent, formatRelative, formatScore, formatTime } from "~/lib/format";
import { useNow } from "~/lib/hooks";

import { MobileFacts } from "./shared";

export function EventDataTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const now = useNow(30_000);

	const query = useQuery({
		queryKey: qk.admin.eventData(eventId),
		queryFn: () => call<DataPresent>(client.admin.events.getData(eventId), t("adminEvents.actions.loadEventData")),
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});

	return (
		<QueryState
			query={query}
			errorTitle={t("adminEvents.data.loadError")}
			skeleton={<TableSkeleton rows={6} columns={4} />}
		>
			{(data) => <DataPresentView data={data} now={now} />}
		</QueryState>
	);
}

function DataPresentView({ data, now }: { data: DataPresent; now: Date }): ReactNode {
	const { t } = useTranslation();
	// 防御：后端偶发缺字段 / 旧版本响应不应把整个控制台打成白屏（theme.md §7.11）。
	const trend = data.trend ?? [];
	const challenges = data.event_challenges ?? [];
	const recentSolves = data.solved_recent_15 ?? [];
	const scoreboard = data.scoreboard_top10 ?? [];
	const challengeColumns: DataTableColumn<DataEventChallenge>[] = [
		{
			id: "name",
			header: t("adminEvents.data.columns.challenge"),
			cell: (row) => row.name,
			sortValue: (row) => row.name,
		},
		{
			id: "category",
			header: t("adminEvents.data.columns.category"),
			cell: (row) => (
				<TonePill tone="neutral" title={row.category}>
					{row.category}
				</TonePill>
			),
			sortValue: (row) => row.category,
		},
		{
			id: "points",
			header: t("adminEvents.data.columns.points"),
			align: "right",
			cell: (row) => <MonoText>{formatScore(row.points)}</MonoText>,
			sortValue: (row) => row.points,
		},
		{
			id: "solved_count",
			header: t("adminEvents.data.columns.solvedCount"),
			align: "right",
			cell: (row) => <MonoText>{row.solved_count}</MonoText>,
			sortValue: (row) => row.solved_count,
		},
		{
			id: "solved_percent",
			header: t("adminEvents.data.columns.solvedPercent"),
			align: "right",
			cell: (row) => <MonoText>{formatPercent(row.solved_percent)}</MonoText>,
			sortValue: (row) => row.solved_percent,
		},
	];

	const scoreboardColumns: DataTableColumn<ScoreboardItem>[] = [
		{
			id: "no",
			header: t("adminEvents.data.columns.rank"),
			align: "right",
			cell: (row) => <MonoText>{row.no}</MonoText>,
			sortValue: (row) => row.no,
		},
		{
			id: "name",
			header: t("adminEvents.data.columns.name"),
			cell: (row) => (
				<div className="flex items-center gap-2">
					<UserAvatar name={row.name} avatar={row.avatar} size="sm" />
					<span className="truncate">{row.name}</span>
				</div>
			),
			sortValue: (row) => row.name,
		},
		{
			id: "score",
			header: t("adminEvents.data.columns.score"),
			align: "right",
			cell: (row) => <MonoText>{formatScore(row.score)}</MonoText>,
			sortValue: (row) => row.score,
		},
		{
			id: "solved_count",
			header: t("adminEvents.data.columns.solveCount"),
			align: "right",
			cell: (row) => <MonoText>{row.solved_count}</MonoText>,
			sortValue: (row) => row.solved_count,
			hideBelow: "md",
		},
	];

	const solveColumns: DataTableColumn<DataEventChallengeSolve>[] = [
		{
			id: "user",
			header: t("adminEvents.data.columns.user"),
			cell: (row) => row.user_nickname || t("common.empty"),
			sortValue: (row) => row.user_nickname,
		},
		{
			id: "challenge",
			header: t("adminEvents.data.columns.challenge"),
			cell: (row) => (
				<span>
					<span className="text-muted-foreground">{row.challenge_category} / </span>
					{row.challenge_name}
				</span>
			),
			sortValue: (row) => row.challenge_name,
		},
		{
			id: "created_at",
			header: t("adminEvents.data.columns.solveTime"),
			cell: (row) => (
				<span
					className="tnum text-xs whitespace-nowrap"
					title={formatDateTime(row.created_at, { seconds: true })}
				>
					{formatRelative(row.created_at, now)}
				</span>
			),
			sortValue: (row) => row.created_at,
		},
	];

	const trendSeries = trend.map((item) => ({
		name: item.name,
		points: item.points.map((point) => ({ x: Date.parse(point.time), y: point.score })),
	}));

	const solvedTotal = challenges.reduce((sum, item) => sum + (item.solved_count ?? 0), 0);

	return (
		<div className="space-y-5">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label={t("adminEvents.data.stats.users.label")}
					value={data.user_count ?? 0}
					hint={t("adminEvents.data.stats.users.hint")}
					icon={<Users className="size-4" />}
				/>
				<StatCard
					label={t("adminEvents.data.stats.teams.label")}
					value={data.team_count ?? 0}
					hint={
						data.event.participant_mode === "team"
							? t("adminEvents.data.stats.teams.hintTeam")
							: t("adminEvents.data.stats.teams.hint")
					}
					icon={<Users className="size-4" />}
					tone="success"
				/>
				<StatCard
					label={t("adminEvents.data.stats.challenges.label")}
					value={challenges.length}
					hint={t("adminEvents.data.stats.challenges.hint", { count: solvedTotal })}
					icon={<Puzzle className="size-4" />}
				/>
				<StatCard
					label={t("adminEvents.data.stats.recent.label")}
					value={recentSolves.length}
					hint={t("adminEvents.data.stats.recent.hint")}
					icon={<Activity className="size-4" />}
					tone="warning"
				/>
			</div>

			<SectionCard
				title={t("adminEvents.data.trend.title")}
				description={t("adminEvents.data.trend.description")}
			>
				<TrendChart
					series={trendSeries}
					formatY={(value) => value.toFixed(0)}
					formatX={(value) => formatTime(value)}
				/>
			</SectionCard>

			<div className="grid gap-5 lg:grid-cols-2">
				<SectionCard
					title={t("adminEvents.data.scoreboard.title")}
					description={t("adminEvents.data.scoreboard.description")}
				>
					{scoreboard.length === 0 ? (
						<EmptyBlock
							title={t("adminEvents.data.scoreboard.emptyTitle")}
							description={t("adminEvents.data.scoreboard.emptyDescription")}
						/>
					) : (
						<DataTable
							data={scoreboard}
							columns={scoreboardColumns}
							getRowId={(row) => row.id}
							mobileCard={(row) => (
								<MobileFacts
									items={[
										{
											k: t("adminEvents.data.mobile.rank"),
											v: <MonoText>{row.no}</MonoText>,
										},
										{ k: t("adminEvents.data.mobile.name"), v: row.name },
										{
											k: t("adminEvents.data.mobile.score"),
											v: <MonoText>{formatScore(row.score)}</MonoText>,
										},
									]}
								/>
							)}
						/>
					)}
				</SectionCard>

				<SectionCard
					title={t("adminEvents.data.challenges.title")}
					description={t("adminEvents.data.challenges.description")}
				>
					{challenges.length === 0 ? (
						<EmptyBlock
							title={t("adminEvents.data.challenges.emptyTitle")}
							description={t("adminEvents.data.challenges.emptyDescription")}
						/>
					) : (
						<DataTable
							data={challenges}
							columns={challengeColumns}
							getRowId={(row) => `${row.category}-${row.name}`}
							mobileCard={(row) => (
								<MobileFacts
									items={[
										{ k: t("adminEvents.data.mobile.challenge"), v: row.name },
										{
											k: t("adminEvents.data.mobile.category"),
											v: (
												<TonePill tone="neutral" title={row.category}>
													{row.category}
												</TonePill>
											),
										},
										{
											k: t("adminEvents.data.mobile.points"),
											v: <MonoText>{formatScore(row.points)}</MonoText>,
										},
										{
											k: t("adminEvents.data.mobile.solved"),
											v: (
												<MonoText>
													{t("adminEvents.data.mobile.solvedValue", {
														count: row.solved_count,
														percent: formatPercent(row.solved_percent),
													})}
												</MonoText>
											),
										},
									]}
								/>
							)}
						/>
					)}
				</SectionCard>
			</div>

			<SectionCard
				title={t("adminEvents.data.recent.title")}
				description={t("adminEvents.data.recent.description")}
			>
				{data.solved_recent_15.length === 0 ? (
					<EmptyBlock
						title={t("adminEvents.data.recent.emptyTitle")}
						description={t("adminEvents.data.recent.emptyDescription")}
						icon={<BarChart3 className="size-6" />}
					/>
				) : (
					<DataTable
						data={data.solved_recent_15}
						columns={solveColumns}
						getRowId={(row) => `${row.user_nickname}-${row.challenge_name}-${row.created_at}`}
						mobileCard={(row) => (
							<MobileFacts
								items={[
									{
										k: t("adminEvents.data.mobile.user"),
										v: row.user_nickname || t("common.empty"),
									},
									{ k: t("adminEvents.data.mobile.challenge"), v: row.challenge_name },
									{
										k: t("adminEvents.data.mobile.bonus"),
										v: <MonoText>{formatScore(row.bonus_points)}</MonoText>,
									},
									{
										k: t("adminEvents.data.mobile.time"),
										v: formatDateTime(row.created_at),
									},
								]}
							/>
						)}
					/>
				)}
			</SectionCard>
		</div>
	);
}
