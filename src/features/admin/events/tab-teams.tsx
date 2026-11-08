/**
 * 赛事控制台 · 战队标签（event_teams）。
 *
 * `getTeams(eventId)` 是**柯里化且第二层无参数**：`client.admin.event_teams.getTeams(eventId)()`。
 * 该接口不接受 `page`/`limit`（一次返回全量 + `meta.total`），因此这里做客户端分页。
 *
 * 文案全部走 `adminEvents.teams` 命名空间。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, MoreHorizontal, ShieldCheck, Trash2, Users } from "lucide-react";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import type { DataTableColumn } from "~/components/app/data-table";
import { MonoText, SectionCard, Toolbar } from "~/components/app/page";
import { EmptyBlock } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { EventTeamMemberRole } from "@floatctf/sdk/entity";
import type { TeamMemberResult, TeamResult } from "@floatctf/sdk";
import { formatDateTime } from "~/lib/format";

import { clientPageCount, clientPaged, MobileFacts, PagedTable } from "./shared";

function memberLabel(member: TeamMemberResult): string {
	return member.nickname && member.nickname.length > 0 ? member.nickname : member.username;
}

function MemberList({ members }: { members: TeamMemberResult[] }): ReactNode {
	const { t } = useTranslation();
	if (members.length === 0) {
		return <span className="text-xs text-muted-foreground">{t("adminEvents.teams.member.empty")}</span>;
	}
	return (
		<ul className="space-y-1">
			{members.map((member) => (
				<li key={member.username} className="flex flex-wrap items-center gap-2 text-xs">
					<span className="font-medium">{memberLabel(member)}</span>
					<TonePill tone={member.role === EventTeamMemberRole.Captain ? "info" : "muted"}>
						{member.role === EventTeamMemberRole.Captain
							? t("adminEvents.teams.member.captain")
							: t("adminEvents.teams.member.member")}
					</TonePill>
					<MonoText>{member.points.toFixed(2)}</MonoText>
				</li>
			))}
		</ul>
	);
}

export function EventTeamsTab({
	eventId,
	participantMode,
}: {
	eventId: string;
	participantMode: string;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const query = useQuery({
		queryKey: qk.admin.eventTeams(eventId),
		queryFn: () => callList<TeamResult>(client.admin.event_teams.getTeams(eventId)()),
	});

	const total = query.data?.meta?.total ?? query.data?.items.length ?? 0;
	const safePage = Math.min(page, clientPageCount(total, pageSize));
	const pagedQuery = clientPaged(query, safePage, pageSize);

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventTeams(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventUsers(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.event(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventLogs(eventId) });
	}

	// 后端没有批量封禁接口：逐条串行调用，成功后统一提示与失效。
	const ban = useMutation({
		mutationFn: async (teamIds: string[]) => {
			for (const teamId of teamIds) {
				await callVoid(
					client.admin.event_teams.banned({ event_id: eventId, team_id: teamId }),
					t("adminEvents.actions.banTeam"),
				);
			}
		},
		onSuccess: (_result, teamIds) => {
			toast.success(t("adminEvents.teams.toast.banSuccess", { count: teamIds.length }));
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.teams.toast.banFailed"), error),
	});

	const unban = useMutation({
		mutationFn: async (teamIds: string[]) => {
			for (const teamId of teamIds) {
				await callVoid(
					client.admin.event_teams.unbanned({ event_id: eventId, team_id: teamId }),
					t("adminEvents.actions.unbanTeam"),
				);
			}
		},
		onSuccess: (_result, teamIds) => {
			toast.success(t("adminEvents.teams.toast.unbanSuccess", { count: teamIds.length }));
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.teams.toast.unbanFailed"), error),
	});

	const remove = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(
				client.admin.event_teams.remove(eventId)(ids),
				t("adminEvents.actions.deleteTeam"),
			),
		onSuccess: (count) => {
			toast.success(t("adminEvents.teams.toast.removeSuccess", { count }));
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.teams.toast.removeFailed"), error),
	});

	async function confirmBan(row: TeamResult) {
		const ok = await confirm({
			title: t("adminEvents.teams.confirmBan.title", { name: row.team.name }),
			description: t("adminEvents.teams.confirmBan.description"),
			consequences: [
				t("adminEvents.teams.confirmBan.consequence1"),
				t("adminEvents.teams.confirmBan.consequence2"),
				t("adminEvents.teams.confirmBan.consequence3"),
				t("adminEvents.teams.confirmBan.consequence4"),
			],
			tone: "danger",
			confirmText: t("adminEvents.teams.confirmBan.confirm"),
			confirmPhrase: row.team.name,
		});
		if (!ok) return;
		ban.mutate([row.team.id]);
	}

	async function confirmRemove(rows: TeamResult[]) {
		if (rows.length === 0) return;
		const single = rows.length === 1 ? rows[0] : null;
		const ok = await confirm({
			title: single
				? t("adminEvents.teams.confirmRemove.singleTitle", { name: single.team.name })
				: t("adminEvents.teams.confirmRemove.bulkTitle", { count: rows.length }),
			description: t("adminEvents.teams.confirmRemove.description"),
			consequences: [
				t("adminEvents.teams.confirmRemove.consequence1"),
				t("adminEvents.teams.confirmRemove.consequence2"),
				t("adminEvents.teams.confirmRemove.consequence3"),
				t("adminEvents.teams.confirmRemove.consequence4"),
			],
			tone: "danger",
			confirmText: t("adminEvents.teams.confirmRemove.confirm"),
			confirmPhrase: single ? single.team.name : t("adminEvents.teams.confirmRemove.phraseBulk"),
		});
		if (!ok) return;
		remove.mutate(rows.map((row) => row.team.id));
	}

	const columns: DataTableColumn<TeamResult>[] = [
		{
			id: "name",
			header: t("adminEvents.teams.columns.team"),
			cell: (row) => (
				<div className="min-w-0">
					<span className="font-medium">{row.team.name}</span>
					{row.team.description ? (
						<p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{row.team.description}</p>
					) : null}
				</div>
			),
			sortValue: (row) => row.team.name,
		},
		{
			id: "captain",
			header: t("adminEvents.teams.columns.captain"),
			cell: (row) =>
				row.captain ? <MonoText>{row.captain}</MonoText> : <span className="text-xs">—</span>,
			sortValue: (row) => row.captain,
			hideBelow: "md",
		},
		{
			id: "members",
			header: t("adminEvents.teams.columns.members"),
			cell: (row) => <MemberList members={row.members} />,
		},
		{
			id: "points",
			header: t("adminEvents.teams.columns.points"),
			align: "right",
			cell: (row) => <MonoText>{row.team.points.toFixed(2)}</MonoText>,
			sortValue: (row) => row.team.points,
		},
		{
			id: "banned",
			header: t("adminEvents.teams.columns.status"),
			cell: (row) => (
				<BooleanPill
					value={row.team.banned}
					trueText={t("adminEvents.teams.values.banned")}
					falseText={t("adminEvents.teams.values.normal")}
					trueTone="danger"
					falseTone="success"
				/>
			),
			sortValue: (row) => (row.team.banned ? 1 : 0),
		},
		{
			id: "created_at",
			header: t("adminEvents.teams.columns.createdAt"),
			cell: (row) => <MonoText className="whitespace-nowrap">
				{formatDateTime(row.team.created_at, { seconds: true })}
			</MonoText>,
			sortValue: (row) => row.team.created_at,
			hideBelow: "lg",
		},
	];

	const rowActions = (row: TeamResult): ReactNode => {
		const actionsLabel = t("adminEvents.teams.row.actions", { name: row.team.name });
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label={actionsLabel} title={actionsLabel}>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel className="max-w-56 truncate">{row.team.name}</DropdownMenuLabel>
					{row.team.banned ? (
						<DropdownMenuItem onSelect={() => unban.mutate([row.team.id])}>
							<ShieldCheck /> {t("adminEvents.teams.row.unban")}
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem variant="destructive" onSelect={() => void confirmBan(row)}>
							<Ban /> {t("adminEvents.teams.row.ban")}
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onSelect={() => void confirmRemove([row])}>
						<Trash2 /> {t("adminEvents.teams.row.remove")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	};

	const mobileCard = (row: TeamResult): ReactNode => (
		<div className="space-y-2">
			<MobileFacts
				items={[
					{
						k: t("adminEvents.teams.mobile.team"),
						v: <span className="font-medium">{row.team.name}</span>,
					},
					{
						k: t("adminEvents.teams.mobile.captain"),
						v: row.captain ? <MonoText>{row.captain}</MonoText> : "—",
					},
					{ k: t("adminEvents.teams.mobile.members"), v: <MemberList members={row.members} /> },
					{
						k: t("adminEvents.teams.mobile.points"),
						v: <MonoText>{row.team.points.toFixed(2)}</MonoText>,
					},
					{
						k: t("adminEvents.teams.mobile.status"),
						v: (
							<BooleanPill
								value={row.team.banned}
								trueText={t("adminEvents.teams.values.banned")}
								falseText={t("adminEvents.teams.values.normal")}
								trueTone="danger"
								falseTone="success"
							/>
						),
					},
				]}
			/>
			<div className="flex justify-end">{rowActions(row)}</div>
		</div>
	);

	const selectedRows = (query.data?.items ?? []).filter((item) => selectedIds.includes(item.team.id));

	return (
		<SectionCard
			title={t("adminEvents.teams.title")}
			description={
				participantMode === "team"
					? t("adminEvents.teams.descriptionTeam")
					: t("adminEvents.teams.descriptionIndividual")
			}
			actions={
				<Toolbar>
					{selectedIds.length > 0 ? (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => unban.mutate(selectedRows.map((row) => row.team.id))}
							>
								<ShieldCheck /> {t("adminEvents.teams.toolbar.unban")}
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => {
									void (async () => {
										const ok = await confirm({
											title: t("adminEvents.teams.confirmBulkBan.title", {
												count: selectedRows.length,
											}),
											description: t("adminEvents.teams.confirmBulkBan.description"),
											consequences: [
												t("adminEvents.teams.confirmBulkBan.consequence1"),
												t("adminEvents.teams.confirmBulkBan.consequence2"),
												t("adminEvents.teams.confirmBulkBan.consequence3"),
											],
											tone: "danger",
											confirmText: t("adminEvents.teams.confirmBulkBan.confirm"),
											confirmPhrase: t("adminEvents.teams.confirmBulkBan.phrase"),
										});
										if (!ok) return;
										ban.mutate(selectedRows.map((row) => row.team.id));
									})();
								}}
							>
								<Ban /> {t("adminEvents.teams.toolbar.banSelected")}
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => void confirmRemove(selectedRows)}
							>
								<Trash2 /> {t("adminEvents.teams.toolbar.removeSelected")}
							</Button>
						</>
					) : null}
				</Toolbar>
			}
		>
			<PagedTable
				query={pagedQuery}
				columns={columns}
				getRowId={(row) => row.team.id}
				page={safePage}
				pageSize={pageSize}
				total={total}
				onPageChange={setPage}
				onPageSizeChange={(size) => {
					setPageSize(size);
					setPage(1);
				}}
				rowActions={rowActions}
				selectable
				selectedIds={selectedIds}
				onSelectionChange={setSelectedIds}
				mobileCard={mobileCard}
				errorTitle={t("adminEvents.teams.loadError")}
				empty={
					<EmptyBlock
						title={
							participantMode === "team"
								? t("adminEvents.teams.empty.teamTitle")
								: t("adminEvents.teams.empty.individualTitle")
						}
						description={
							participantMode === "team"
								? t("adminEvents.teams.empty.teamDescription")
								: t("adminEvents.teams.empty.individualDescription")
						}
						icon={<Users className="size-6" />}
					/>
				}
			/>
		</SectionCard>
	);
}
