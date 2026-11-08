/**
 * 「战队」标签：AWD 战队封禁 / 解封。
 *
 * 已核实的后端语义（`ban_service`）：
 * - 封禁：写入 `awd_team_bans`（含原因与操作管理员）→ 同步 `event_teams.banned` →
 *   挂起该队在宿主上的 WireGuard 对端（DB 记录保留）→ 重建防火墙 banned 集合 → 清理该队连接；
 * - 解封：反向闭环（DB 解除 → 恢复 WG 对端 → 重建 banned 集合）；
 * - 封禁是手动的，**不会自动到期**；解封前该队一直失去比赛访问权限。
 *
 * 文案全部走 `adminAwdOps.*`；封禁 / 解封都必须二次确认并写明真实后果。
 */

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, UserMinus, Users } from "lucide-react";

import type { TeamResult } from "@floatctf/sdk";

import { call, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormSheet } from "~/components/app/form";
import { MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { formatDateTime } from "~/lib/format";

import { useAwdTeams } from "./queries";

/** 封禁表单：收集原因（后端会连同操作管理员一起写入封禁记录）。 */
function BanTeamSheet({
	eventId,
	team,
	onClose,
}: {
	eventId: string;
	team: TeamResult;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: (input: { reason: string }) =>
			call<string>(
				client.awd.admin.banTeam(eventId, team.team.id, { reason: input.reason }),
				t("adminAwdOps.actionNames.banTeam"),
			),
		onSuccess: () => {
			toast.success(
				t("adminAwdOps.teams.banSheet.successTitle", { team: team.team.name }),
				t("adminAwdOps.teams.banSheet.successDescription"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.admin.eventTeams(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminScores(eventId) });
			onClose();
		},
		onError: (err) => toast.apiError(t("adminAwdOps.teams.banSheet.failed"), err),
	});

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const trimmed = reason.trim();
		if (trimmed === "") {
			setError(t("adminAwdOps.teams.banSheet.reasonRequired"));
			return;
		}
		setError(null);
		const ok = await confirm({
			title: t("adminAwdOps.teams.confirmBan.title", { team: team.team.name }),
			description: t("adminAwdOps.teams.confirmBan.description"),
			consequences: [
				t("adminAwdOps.teams.confirmBan.consequence1"),
				t("adminAwdOps.teams.confirmBan.consequence2"),
				t("adminAwdOps.teams.confirmBan.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminAwdOps.teams.confirmBan.confirm"),
		});
		if (ok) mutation.mutate({ reason: trimmed });
	};

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("adminAwdOps.teams.banSheet.title", { team: team.team.name })}
			description={t("adminAwdOps.teams.banSheet.description")}
			footer={
				<FormFooter
					onCancel={onClose}
					formId="awd-ban-form"
					submitLabel={t("adminAwdOps.teams.banSheet.submit")}
					isPending={mutation.isPending}
				/>
			}
		>
			<form id="awd-ban-form" onSubmit={(event) => void submit(event)} className="space-y-4">
				<Field
					label={t("adminAwdOps.teams.banSheet.reasonLabel")}
					htmlFor="awd-ban-reason"
					required
					error={error}
					hint={t("adminAwdOps.teams.banSheet.reasonHint")}
				>
					<Textarea
						id="awd-ban-reason"
						rows={3}
						value={reason}
						disabled={mutation.isPending}
						onChange={(event) => setReason(event.target.value)}
						placeholder={t("adminAwdOps.teams.banSheet.reasonPlaceholder")}
					/>
				</Field>
			</form>
		</FormSheet>
	);
}

export function AwdTeamsTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const teamsQuery = useAwdTeams(eventId);
	const [banTarget, setBanTarget] = useState<TeamResult | null>(null);

	const bannedText = t("adminAwdOps.teams.banned");
	const normalText = t("adminAwdOps.teams.normal");

	const unban = useMutation({
		mutationFn: (team: TeamResult) =>
			callVoid(
				client.awd.admin.unbanTeam(eventId, team.team.id),
				t("adminAwdOps.actionNames.unbanTeam"),
			),
		onSuccess: (_result, team) => {
			toast.success(t("adminAwdOps.teams.unbanSuccess", { team: team.team.name }));
			void queryClient.invalidateQueries({ queryKey: qk.admin.eventTeams(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminScores(eventId) });
		},
		onError: (error) => toast.apiError(t("adminAwdOps.teams.unbanFailed"), error),
	});

	const columns: DataTableColumn<TeamResult>[] = [
		{
			id: "name",
			header: t("adminAwdOps.teams.columns.team"),
			sortValue: (row) => row.team.name,
			cell: (row) => <span className="font-medium">{row.team.name}</span>,
		},
		{
			id: "banned",
			header: t("adminAwdOps.teams.columns.status"),
			cell: (row) => (
				<BooleanPill
					value={row.team.banned}
					trueText={bannedText}
					falseText={normalText}
					trueTone="danger"
					falseTone="success"
				/>
			),
			sortValue: (row) => (row.team.banned ? 1 : 0),
		},
		{
			id: "captain",
			header: t("adminAwdOps.teams.columns.captain"),
			hideBelow: "md",
			cell: (row) => row.captain || "—",
		},
		{
			id: "members",
			header: t("adminAwdOps.teams.columns.members"),
			align: "right",
			cell: (row) => <span className="tnum">{row.members.length}</span>,
			sortValue: (row) => row.members.length,
		},
		{
			id: "created_at",
			header: t("adminAwdOps.teams.columns.createdAt"),
			hideBelow: "lg",
			cell: (row) => (
				<span className="tnum whitespace-nowrap">{formatDateTime(row.team.created_at, { seconds: true })}</span>
			),
			sortValue: (row) => row.team.created_at,
		},
		{
			id: "team_id",
			header: t("adminAwdOps.teams.columns.teamId"),
			hideBelow: "lg",
			cell: (row) => <MonoText>{row.team.id}</MonoText>,
		},
	];

	const renderActions = (row: TeamResult) =>
		row.team.banned ? (
			<Button
				variant="outline"
				size="sm"
				disabled={unban.isPending}
				title={t("adminAwdOps.teams.unban")}
				onClick={async () => {
					const ok = await confirm({
						title: t("adminAwdOps.teams.confirmUnban.title", { team: row.team.name }),
						description: t("adminAwdOps.teams.confirmUnban.description"),
						consequences: [
							t("adminAwdOps.teams.confirmUnban.consequence1"),
							t("adminAwdOps.teams.confirmUnban.consequence2"),
							t("adminAwdOps.teams.confirmUnban.consequence3"),
						],
						confirmText: t("adminAwdOps.teams.confirmUnban.confirm"),
					});
					if (ok) unban.mutate(row);
				}}
			>
				<UserMinus data-icon="inline-start" />
				{t("adminAwdOps.teams.unban")}
			</Button>
		) : (
			<Button
				variant="destructive"
				size="sm"
				title={t("adminAwdOps.teams.banActionAria", { team: row.team.name })}
				onClick={() => setBanTarget(row)}
				aria-label={t("adminAwdOps.teams.banActionAria", { team: row.team.name })}
			>
				<Ban data-icon="inline-start" />
				{t("adminAwdOps.teams.ban")}
			</Button>
		);

	return (
		<SectionCard
			title={t("adminAwdOps.teams.title")}
			description={t("adminAwdOps.teams.description")}
		>
			<QueryState
				query={teamsQuery}
				skeleton={<TableSkeleton rows={6} columns={5} />}
				isEmpty={(teams) => teams.length === 0}
				empty={
					<EmptyBlock
						title={t("adminAwdOps.teams.emptyTitle")}
						description={t("adminAwdOps.teams.emptyDescription")}
						icon={<Users className="size-6" />}
					/>
				}
			>
				{(teams) => (
					<>
						<DataTable
							data={teams}
							getRowId={(row) => row.team.id}
							columns={columns}
							mobileCard={(row) => (
								<div className="space-y-2">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">
												{row.team.name}
											</p>
											<p className="tnum text-xs text-muted-foreground">
												{t("adminAwdOps.teams.members", {
													count: row.members.length,
												})}
											</p>
										</div>
										<BooleanPill
											value={row.team.banned}
											trueText={bannedText}
											falseText={normalText}
											trueTone="danger"
											falseTone="success"
										/>
									</div>
									<div className="flex justify-end">{renderActions(row)}</div>
								</div>
							)}
							rowActions={renderActions}
						/>
						{banTarget ? (
							<BanTeamSheet
								eventId={eventId}
								team={banTarget}
								onClose={() => setBanTarget(null)}
							/>
						) : null}
					</>
				)}
			</QueryState>
		</SectionCard>
	);
}
