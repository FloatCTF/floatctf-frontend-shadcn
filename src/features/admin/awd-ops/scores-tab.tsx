/**
 * 「积分与判罚」标签：AWD 积分榜 + 审计化的分数调整。
 *
 * 已核实的后端语义：
 * - `scores` 返回 `AwdScoreRow[]`（rank / attack_score / defense_score / total_score）；
 * - `adjustScore` 追加一条 `ScoreEventType::Adjustment` 账本事件（delta 有符号，正数加分），
 *   并写入 `ScoreAdjusted` 审计；赛事进入终态（finished / archived）后被拒绝。
 *
 * 文案全部走 `adminAwdOps.*`；分数、排名用等宽数字。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";

import type { AwdScoreRow } from "@floatctf/sdk";
import { AwdEventStatus } from "@floatctf/sdk/entity";

import { call, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field } from "~/components/app/form";
import { MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, InlineError, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { formatDelta, formatScore } from "~/lib/format";

import { useAwdStatus, useAwdTeams } from "./queries";
import { awdStatusLabel } from "./shared";

const TERMINAL_STATUSES: string[] = [AwdEventStatus.Finished, AwdEventStatus.Archived];

export function AwdScoresTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const statusQuery = useAwdStatus(eventId);
	const teamsQuery = useAwdTeams(eventId);

	const [teamId, setTeamId] = useState("");
	const [delta, setDelta] = useState("");
	const [reason, setReason] = useState("");

	const scoresQuery = useQuery({
		queryKey: qk.awd.adminScores(eventId),
		queryFn: () =>
			call<AwdScoreRow[]>(client.awd.admin.scores(eventId), t("adminAwdOps.actionNames.scores")),
		enabled: eventId !== "",
	});

	const status = statusQuery.data?.status ?? null;
	const statusError = statusQuery.isError;
	const locked = status !== null && TERMINAL_STATUSES.includes(status);

	const bannedTeams = new Set(
		(teamsQuery.data ?? []).filter((item) => item.team.banned).map((item) => item.team.id),
	);
	const teamName = (id: string) =>
		(teamsQuery.data ?? []).find((item) => item.team.id === id)?.team.name ?? null;

	const adjust = useMutation({
		mutationFn: (input: { team_id: string; delta: number; reason: string }) =>
			callVoid(
				client.awd.admin.adjustScore(eventId, input),
				t("adminAwdOps.actionNames.adjustScore"),
			),
		onSuccess: (_result, input) => {
			toast.success(
				t("adminAwdOps.scores.toast.adjustedTitle"),
				t("adminAwdOps.scores.toast.adjustedDescription", {
					team: teamName(input.team_id) ?? input.team_id,
					delta: formatDelta(input.delta, 0),
				}),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminScores(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
			setDelta("");
			setReason("");
		},
		onError: (error) => toast.apiError(t("adminAwdOps.scores.toast.failed"), error),
	});

	const columns: DataTableColumn<AwdScoreRow>[] = [
		{
			id: "rank",
			header: t("adminAwdOps.scores.columns.rank"),
			align: "right",
			sortValue: (row) => row.rank,
			cell: (row) => <MonoText>#{row.rank}</MonoText>,
		},
		{
			id: "team",
			header: t("adminAwdOps.scores.columns.team"),
			sortValue: (row) => row.team_name,
			cell: (row) => (
				<span className="inline-flex min-w-0 items-center gap-2">
					<span className="truncate">{row.team_name}</span>
					{bannedTeams.has(row.team_id) ? (
						<TonePill tone="danger">{t("adminAwdOps.scores.banned")}</TonePill>
					) : null}
				</span>
			),
		},
		{
			id: "attack_score",
			header: t("adminAwdOps.scores.columns.attack"),
			align: "right",
			sortValue: (row) => row.attack_score,
			cell: (row) => <MonoText>{formatScore(row.attack_score, 0)}</MonoText>,
		},
		{
			id: "defense_score",
			header: t("adminAwdOps.scores.columns.defense"),
			align: "right",
			sortValue: (row) => row.defense_score,
			cell: (row) => <MonoText>{formatScore(row.defense_score, 0)}</MonoText>,
		},
		{
			id: "total_score",
			header: t("adminAwdOps.scores.columns.total"),
			align: "right",
			sortValue: (row) => row.total_score,
			cell: (row) => (
				<MonoText className="font-semibold">{formatScore(row.total_score, 0)}</MonoText>
			),
		},
		{
			id: "team_id",
			header: t("adminAwdOps.scores.columns.teamId"),
			hideBelow: "lg",
			cell: (row) => <MonoText>{row.team_id}</MonoText>,
		},
	];

	const deltaValue = delta.trim() === "" ? null : Number(delta);
	const deltaValid =
		deltaValue !== null && Number.isFinite(deltaValue) && Number.isInteger(deltaValue);
	const canSubmit =
		!statusQuery.isPending &&
		!statusError &&
		status !== null &&
		!locked &&
		teamId !== "" &&
		deltaValid &&
		deltaValue !== 0 &&
		reason.trim() !== "" &&
		!adjust.isPending;

	return (
		<div className="space-y-6">
			<SectionCard
				title={t("adminAwdOps.scores.adjustTitle")}
				description={t("adminAwdOps.scores.adjustDescription")}
			>
				<div className="space-y-3">
					<div className="grid gap-4 sm:grid-cols-3">
						<Field
							label={t("adminAwdOps.scores.team")}
							htmlFor="awd-adjust-team"
							required
						>
							<Select value={teamId} onValueChange={setTeamId} disabled={locked}>
								<SelectTrigger
									id="awd-adjust-team"
									className="w-full min-w-0"
									aria-label={t("adminAwdOps.scores.selectTeamAria")}
								>
									<SelectValue
										placeholder={t("adminAwdOps.scores.selectTeamPlaceholder")}
									/>
								</SelectTrigger>
								<SelectContent>
									{(teamsQuery.data ?? []).map((item) => (
										<SelectItem key={item.team.id} value={item.team.id}>
											{item.team.banned
												? t("adminAwdOps.scores.teamOptionBanned", {
														name: item.team.name,
													})
												: t("adminAwdOps.scores.teamOption", {
														name: item.team.name,
													})}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field
							label={t("adminAwdOps.scores.delta")}
							htmlFor="awd-adjust-delta"
							required
							hint={t("adminAwdOps.scores.deltaHint")}
							error={
								delta.trim() !== "" && !deltaValid
									? t("adminAwdOps.validation.integer")
									: undefined
							}
						>
							<Input
								id="awd-adjust-delta"
								type="number"
								inputMode="numeric"
								value={delta}
								disabled={locked}
								onChange={(event) => setDelta(event.target.value)}
								placeholder={t("adminAwdOps.scores.deltaPlaceholder")}
							/>
						</Field>
						<Field
							label={t("adminAwdOps.scores.reason")}
							htmlFor="awd-adjust-reason"
							required
							hint={t("adminAwdOps.scores.reasonHint")}
						>
							<Input
								id="awd-adjust-reason"
								value={reason}
								disabled={locked}
								onChange={(event) => setReason(event.target.value)}
								placeholder={t("adminAwdOps.scores.reasonPlaceholder")}
							/>
						</Field>
					</div>
					{statusError ? <InlineError error={statusQuery.error} /> : null}
					{teamsQuery.isPending ? (
						<p className="text-xs text-muted-foreground">
							{t("adminAwdOps.scores.loadTeams")}
						</p>
					) : teamsQuery.isError ? (
						<InlineError error={teamsQuery.error} />
					) : null}
					{locked ? (
						<p className="text-xs text-destructive" role="alert">
							{t("adminAwdOps.scores.lockedNotice", {
								status: awdStatusLabel(status, t),
							})}
						</p>
					) : null}
					<div className="flex flex-wrap items-center gap-2">
						<Button
							size="sm"
							disabled={!canSubmit}
							title={
								statusError
									? t("adminAwdOps.lifecycle.statusLoadFailed")
									: statusQuery.isPending
										? t("adminAwdOps.lifecycle.loadingStatus")
										: locked
											? t("adminAwdOps.scores.lockedTitle")
											: t("adminAwdOps.scores.applyDisabledTitle")
							}
							onClick={async () => {
								if (deltaValue === null) return;
								const ok = await confirm({
									title: t("adminAwdOps.scores.confirm.title", {
										delta: formatDelta(deltaValue, 0),
									}),
									description: t("adminAwdOps.scores.confirm.description"),
									consequences: [
										t("adminAwdOps.scores.confirm.consequence1", {
											team: teamName(teamId) ?? teamId,
											delta: formatDelta(deltaValue, 0),
										}),
										t("adminAwdOps.scores.confirm.consequence2"),
										t("adminAwdOps.scores.confirm.consequence3"),
									],
									tone: "danger",
									confirmText: t("adminAwdOps.scores.confirm.confirm"),
								});
								if (ok) {
									adjust.mutate({
										team_id: teamId,
										delta: deltaValue,
										reason: reason.trim(),
									});
								}
							}}
						>
							<Scale data-icon="inline-start" />
							{t("adminAwdOps.scores.apply")}
						</Button>
						<span className="text-xs text-muted-foreground">
							{t("adminAwdOps.scores.applyHint")}
						</span>
					</div>
				</div>
			</SectionCard>

			<SectionCard
				title={t("adminAwdOps.scores.scoreboardTitle")}
				description={t("adminAwdOps.scores.scoreboardDescription")}
			>
				<QueryState
					query={scoresQuery}
					skeleton={<TableSkeleton rows={6} columns={5} />}
					isEmpty={(rows) => rows.length === 0}
					empty={
						<EmptyBlock
							title={t("adminAwdOps.scores.emptyTitle")}
							description={t("adminAwdOps.scores.emptyDescription")}
						/>
					}
				>
					{(rows) => (
						<DataTable
							data={rows}
							getRowId={(row) => row.team_id}
							columns={columns}
							mobileCard={(row) => (
								<div className="flex items-center justify-between gap-2">
									<div className="min-w-0 space-y-1">
										<p className="tnum truncate text-sm font-medium">
											#{row.rank} {row.team_name}
										</p>
										<p className="tnum text-xs text-muted-foreground">
											{t("adminAwdOps.scores.mobileSubtitle", {
												attack: formatScore(row.attack_score, 0),
												defense: formatScore(row.defense_score, 0),
											})}
										</p>
										{bannedTeams.has(row.team_id) ? (
											<TonePill tone="danger">
												{t("adminAwdOps.scores.banned")}
											</TonePill>
										) : null}
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
		</div>
	);
}
