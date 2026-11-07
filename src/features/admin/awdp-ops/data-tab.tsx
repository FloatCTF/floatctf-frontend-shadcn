/**
 * 「数据大屏」标签（optional）：`GET /admin/events/{id}/awdp/data` 的聚合视图。
 *
 * 该标签只在被选中时挂载（Radix Tabs 默认不渲染非激活内容），因此不会给页面首屏加请求。
 * 数据全部来自后端聚合（人数 / 战队数、每题攻破与修复计数、Top10、趋势、最近动态）。
 *
 * 文案全部走 i18n（`adminAwdpOps.data.*`）。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";

import type { AwdpDataActivity, AwdpDataGameBox, AwdpScoreRow } from "@floatctf/sdk";

import { TrendChart } from "~/components/app/charts";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MonoText, SectionCard, StatCard } from "~/components/app/page";
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import { formatDelta, formatInt, formatRelative, formatScore, formatTime } from "~/lib/format";
import { useNow } from "~/lib/hooks";

import { useAwdpDataPresent } from "./queries";

export function AwdpDataTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const dataQuery = useAwdpDataPresent(eventId, true);
	const now = useNow(30_000);

	const gameboxColumns: DataTableColumn<AwdpDataGameBox>[] = [
		{
			id: "name",
			header: t("adminAwdpOps.gameboxes.columns.gamebox"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate font-medium">{row.name}</p>
					<p className="truncate text-xs text-muted-foreground">{row.category}</p>
				</div>
			),
		},
		{
			id: "break_count",
			header: t("adminAwdpOps.data.gameboxStats.breakCount"),
			align: "right",
			sortValue: (row) => row.break_count,
			cell: (row) => <MonoText>{formatInt(row.break_count)}</MonoText>,
		},
		{
			id: "fix_count",
			header: t("adminAwdpOps.data.gameboxStats.fixCount"),
			align: "right",
			sortValue: (row) => row.fix_count,
			cell: (row) => <MonoText>{formatInt(row.fix_count)}</MonoText>,
		},
	];

	const topColumns: DataTableColumn<AwdpScoreRow>[] = [
		{
			id: "rank",
			header: t("adminAwdpOps.scores.columns.rank"),
			align: "right",
			sortValue: (row) => row.rank,
			cell: (row) => <MonoText>#{formatInt(row.rank)}</MonoText>,
		},
		{
			id: "subject_name",
			header: t("adminAwdpOps.scores.columns.subject"),
			sortValue: (row) => row.subject_name,
			cell: (row) => row.subject_name,
		},
		{
			id: "total_score",
			header: t("adminAwdpOps.scores.columns.totalScore"),
			align: "right",
			sortValue: (row) => row.total_score,
			cell: (row) => (
				<MonoText className="font-semibold">{formatScore(row.total_score, 0)}</MonoText>
			),
		},
	];

	const activityColumns: DataTableColumn<AwdpDataActivity>[] = [
		{
			id: "activity",
			header: t("adminAwdpOps.data.activity.columns.activity"),
			sortValue: (row) => row.subject_name,
			cell: (row) => (
				<p className="truncate text-sm">
					{t("adminAwdpOps.data.activity.line", {
						subject: row.subject_name,
						action:
							row.action === "break"
								? t("adminAwdpOps.data.activity.actionBreak")
								: t("adminAwdpOps.data.activity.actionFix"),
						gamebox: row.gamebox_name,
					})}
				</p>
			),
		},
		{
			id: "detail",
			header: t("adminAwdpOps.data.activity.columns.detail"),
			hideBelow: "sm",
			cell: (row) => (
				<span className="text-xs text-muted-foreground">
					{row.gamebox_category} · {formatRelative(row.created_at, now)}
				</span>
			),
		},
		{
			id: "delta",
			header: t("adminAwdpOps.data.activity.columns.delta"),
			align: "right",
			sortValue: (row) => row.delta,
			cell: (row) => <MonoText className="text-sm">{formatDelta(row.delta, 0)}</MonoText>,
		},
	];

	return (
		<QueryState
			query={dataQuery}
			skeleton={<TableSkeleton rows={5} columns={4} />}
			errorTitle={t("adminAwdpOps.data.loadError")}
		>
			{(data) => {
				// 旧版 / 部分响应可能缺字段：不要让数据大屏白屏（platform 级要求）。
				const gameboxes = data.gameboxes ?? [];
				const recentActivity = data.recent_activity ?? [];
				const top10 = data.scoreboard_top10 ?? [];
				const trend = data.trend ?? [];
				return (
				<div className="flex flex-col gap-4">
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<StatCard
							label={t("adminAwdpOps.data.stats.users")}
							value={<span className="tnum">{formatInt(data.user_count)}</span>}
						/>
						<StatCard
							label={t("adminAwdpOps.data.stats.teams")}
							value={<span className="tnum">{formatInt(data.team_count)}</span>}
						/>
						<StatCard
							label={t("adminAwdpOps.data.stats.gameboxes")}
							value={<span className="tnum">{formatInt(gameboxes.length)}</span>}
							hint={t("adminAwdpOps.data.statsHint.gameboxes")}
						/>
						<StatCard
							label={t("adminAwdpOps.data.stats.recent")}
							value={<span className="tnum">{formatInt(recentActivity.length)}</span>}
							hint={t("adminAwdpOps.data.statsHint.recent")}
						/>
					</div>

					<SectionCard
						title={t("adminAwdpOps.data.top.title")}
						description={t("adminAwdpOps.data.top.description")}
						actions={
							<Button
								variant="outline"
								size="sm"
								disabled={dataQuery.isFetching}
								onClick={() => void dataQuery.refetch()}
							>
								<RefreshCw
									className={dataQuery.isFetching ? "animate-spin" : undefined}
									aria-hidden="true"
								/>
								{t("common.refresh")}
							</Button>
						}
					>
						{top10.length === 0 ? (
							<EmptyBlock
								title={t("adminAwdpOps.data.top.emptyTitle")}
								description={t("adminAwdpOps.data.top.emptyDescription")}
							/>
						) : (
							<DataTable
								data={top10}
								getRowId={(row) => row.subject_id}
								columns={topColumns}
								mobileCard={(row) => (
									<div className="flex items-center justify-between gap-2">
										<p className="min-w-0 truncate text-sm font-medium">
											{t("adminAwdpOps.scores.mobileRankSubject", {
												rank: formatInt(row.rank),
												name: row.subject_name,
											})}
										</p>
										<MonoText className="font-semibold">
											{formatScore(row.total_score, 0)}
										</MonoText>
									</div>
								)}
							/>
						)}
					</SectionCard>

					<SectionCard
						title={t("adminAwdpOps.data.gameboxStats.title")}
						description={t("adminAwdpOps.data.gameboxStats.description")}
					>
						{data.gameboxes.length === 0 ? (
							<EmptyBlock
								title={t("adminAwdpOps.data.gameboxStats.emptyTitle")}
								description={t("adminAwdpOps.data.gameboxStats.emptyDescription")}
							/>
						) : (
							<DataTable
								data={data.gameboxes}
								getRowId={(row) => row.id}
								columns={gameboxColumns}
								mobileCard={(row) => (
									<div className="space-y-1">
										<p className="truncate text-sm font-medium">{row.name}</p>
										<p className="text-xs text-muted-foreground">
											{t("adminAwdpOps.data.gameboxStats.mobileCounts", {
												breakCount: formatInt(row.break_count),
												fixCount: formatInt(row.fix_count),
											})}
										</p>
									</div>
								)}
							/>
						)}
					</SectionCard>

					<SectionCard
						title={t("adminAwdpOps.data.trend.title")}
						description={t("adminAwdpOps.data.trend.description")}
					>
						<TrendChart
							series={trend.map((item) => ({
								name: item.name,
								points: item.points.map((point) => ({
									x: Date.parse(point.time),
									y: point.score,
								})),
							}))}
							formatY={(value) => formatScore(value, 0)}
							formatX={(value) => formatTime(value)}
						/>
					</SectionCard>

					<SectionCard
						title={t("adminAwdpOps.data.activity.title")}
						description={t("adminAwdpOps.data.activity.description")}
					>
						{data.recent_activity.length === 0 ? (
							<EmptyBlock
								title={t("adminAwdpOps.data.activity.emptyTitle")}
								description={t("adminAwdpOps.data.activity.emptyDescription")}
							/>
						) : (
							<DataTable
								data={data.recent_activity}
								getRowId={(row, index) =>
									`${row.subject_name}-${row.gamebox_name}-${row.created_at}-${index}`
								}
								columns={activityColumns}
								mobileCard={(row) => (
									<div className="flex items-center justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate text-sm">
												{t("adminAwdpOps.data.activity.line", {
													subject: row.subject_name,
													action:
														row.action === "break"
															? t("adminAwdpOps.data.activity.actionBreak")
															: t("adminAwdpOps.data.activity.actionFix"),
													gamebox: row.gamebox_name,
												})}
											</p>
											<p className="truncate text-xs text-muted-foreground">
												{row.gamebox_category} · {formatRelative(row.created_at, now)}
											</p>
										</div>
										<MonoText className="text-sm">{formatDelta(row.delta, 0)}</MonoText>
									</div>
								)}
							/>
						)}
					</SectionCard>
				</div>
				);
			}}
		</QueryState>
	);
}
