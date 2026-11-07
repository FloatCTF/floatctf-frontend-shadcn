/**
 * 「积分榜」标签：AWDP 管理端积分榜（个人 / 战队主体）。
 *
 * 已核实的后端语义：`GET /admin/events/{id}/awdp/scores` 与选手端同一套服务，
 * 返回 `AwdpScoreRow[]`（subject_id / subject_name / break_score / fix_score / total_score / rank），
 * 主体是个人还是战队由赛事 `participant_mode` 决定（这里只如实展示“主体”）。
 *
 * 文案全部走 i18n（`adminAwdpOps.scores.*`）。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";

import type { AwdpScoreRow } from "@floatctf/sdk";

import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import { formatInt, formatScore } from "~/lib/format";

import { useAwdpScores } from "./queries";

export function AwdpScoresTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const scoresQuery = useAwdpScores(eventId);

	const columns: DataTableColumn<AwdpScoreRow>[] = [
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
			cell: (row) => <span className="font-medium">{row.subject_name}</span>,
		},
		{
			id: "break_score",
			header: t("adminAwdpOps.scores.columns.breakScore"),
			align: "right",
			sortValue: (row) => row.break_score,
			cell: (row) => <MonoText>{formatScore(row.break_score, 0)}</MonoText>,
		},
		{
			id: "fix_score",
			header: t("adminAwdpOps.scores.columns.fixScore"),
			align: "right",
			sortValue: (row) => row.fix_score,
			cell: (row) => <MonoText>{formatScore(row.fix_score, 0)}</MonoText>,
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
		{
			id: "subject_id",
			header: t("adminAwdpOps.scores.columns.subjectId"),
			hideBelow: "lg",
			cell: (row) => <MonoText>{row.subject_id}</MonoText>,
		},
	];

	return (
		<SectionCard
			title={t("adminAwdpOps.scores.sectionTitle")}
			description={t("adminAwdpOps.scores.sectionDescription")}
			actions={
				<Button
					variant="outline"
					size="sm"
					disabled={scoresQuery.isFetching}
					onClick={() => void scoresQuery.refetch()}
				>
					<RefreshCw
						className={scoresQuery.isFetching ? "animate-spin" : undefined}
						aria-hidden="true"
					/>
					{t("common.refresh")}
				</Button>
			}
		>
			<QueryState
				query={scoresQuery}
				skeleton={<TableSkeleton rows={6} columns={5} />}
				isEmpty={(rows) => rows.length === 0}
				errorTitle={t("adminAwdpOps.scores.loadError")}
				empty={
					<EmptyBlock
						title={t("adminAwdpOps.scores.emptyTitle")}
						description={t("adminAwdpOps.scores.emptyDescription")}
					/>
				}
			>
				{(rows) => (
					<DataTable
						data={rows}
						getRowId={(row) => row.subject_id}
						columns={columns}
						mobileCard={(row) => (
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium">
										{t("adminAwdpOps.scores.mobileRankSubject", {
											rank: formatInt(row.rank),
											name: row.subject_name,
										})}
									</p>
									<p className="truncate text-xs text-muted-foreground">
										{t("adminAwdpOps.scores.mobileScores", {
											breakScore: formatScore(row.break_score, 0),
											fixScore: formatScore(row.fix_score, 0),
										})}
									</p>
								</div>
								<MonoText className="font-semibold">
									{formatScore(row.total_score, 0)}
								</MonoText>
							</div>
						)}
					/>
				)}
			</QueryState>
		</SectionCard>
	);
}
