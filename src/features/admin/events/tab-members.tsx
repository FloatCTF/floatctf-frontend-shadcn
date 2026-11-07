/**
 * 赛事控制台 · 成员标签（event_users）。
 *
 * `fetch` / `delete` 是柯里化方法（`fetch(eventId)({page,limit})`、`delete(eventId)(id_list)`）；
 * `banned` / `unbanned` 是普通方法。`add` 运行时返回 AxiosResponse —— 用 `call` 助手解包即可。
 *
 * 文案全部走 `adminEvents.members` 命名空间。
 */

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, MoreHorizontal, Plus, ShieldCheck, Trash2, UserMinus } from "lucide-react";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormSheet } from "~/components/app/form";
import { MonoText, SectionCard, Toolbar } from "~/components/app/page";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { UserCell } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import type { EventUserResult } from "@floatctf/sdk";
import type { Users } from "@floatctf/sdk/entity";
import { formatDateTime } from "~/lib/format";
import { useDebouncedValue } from "~/lib/hooks";

import { MobileFacts, PagedTable } from "./shared";

function displayName(user: Users): string {
	return user.nickname && user.nickname.length > 0 ? user.nickname : user.username;
}

export function EventMembersTab({
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
	const [addOpen, setAddOpen] = useState(false);

	const query = useQuery({
		queryKey: qk.admin.eventUsers(eventId, { page, limit: pageSize }),
		queryFn: () =>
			callList<EventUserResult>(client.admin.event_users.fetch(eventId)({ page, limit: pageSize })),
	});

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventUsers(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventTeams(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.event(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventLogs(eventId) });
	}

	// 后端没有批量封禁接口：逐条串行调用，成功后统一提示与失效（避免 N 次 toast / refetch）。
	const ban = useMutation({
		mutationFn: async (userIds: string[]) => {
			for (const userId of userIds) {
				await call(
					client.admin.event_users.banned({ event_id: eventId, user_id: userId }),
					t("adminEvents.actions.banMember"),
				);
			}
		},
		onSuccess: (_result, userIds) => {
			toast.success(t("adminEvents.members.toast.banSuccess", { count: userIds.length }));
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.members.toast.banFailed"), error),
	});

	const unban = useMutation({
		mutationFn: async (userIds: string[]) => {
			for (const userId of userIds) {
				await call(
					client.admin.event_users.unbanned({ event_id: eventId, user_id: userId }),
					t("adminEvents.actions.unbanMember"),
				);
			}
		},
		onSuccess: (_result, userIds) => {
			toast.success(t("adminEvents.members.toast.unbanSuccess", { count: userIds.length }));
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.members.toast.unbanFailed"), error),
	});

	const remove = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(
				client.admin.event_users.delete(eventId)(ids),
				t("adminEvents.actions.removeMember"),
			),
		onSuccess: (count) => {
			toast.success(t("adminEvents.members.toast.removeSuccess", { count }));
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.members.toast.removeFailed"), error),
	});

	async function confirmBan(row: EventUserResult) {
		const name = displayName(row.user);
		const ok = await confirm({
			title: t("adminEvents.members.confirmBan.title", { name }),
			description: t("adminEvents.members.confirmBan.description"),
			consequences: [
				t("adminEvents.members.confirmBan.consequence1"),
				t("adminEvents.members.confirmBan.consequence2"),
				t("adminEvents.members.confirmBan.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminEvents.members.confirmBan.confirm"),
			confirmPhrase: row.user.username,
		});
		if (!ok) return;
		ban.mutate([row.user.id]);
	}

	async function confirmRemove(rows: EventUserResult[]) {
		if (rows.length === 0) return;
		const single = rows.length === 1 ? rows[0] : null;
		const ok = await confirm({
			title: single
				? t("adminEvents.members.confirmRemove.singleTitle", {
						name: displayName(single.user),
					})
				: t("adminEvents.members.confirmRemove.bulkTitle", { count: rows.length }),
			description: t("adminEvents.members.confirmRemove.description"),
			consequences: [
				t("adminEvents.members.confirmRemove.consequence1"),
				t("adminEvents.members.confirmRemove.consequence2"),
				t("adminEvents.members.confirmRemove.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminEvents.members.confirmRemove.confirm"),
		});
		if (!ok) return;
		remove.mutate(rows.map((row) => row.user.id));
	}

	const columns: DataTableColumn<EventUserResult>[] = [
		{
			id: "user",
			header: t("adminEvents.members.columns.user"),
			cell: (row) => (
				<UserCell
					username={row.user.username}
					nickname={row.user.nickname}
					avatar={row.user.avatar}
				/>
			),
			sortValue: (row) => row.user.nickname || row.user.username,
		},
		{
			id: "points",
			header: t("adminEvents.members.columns.points"),
			align: "right",
			cell: (row) => <MonoText>{row.event_user.points.toFixed(2)}</MonoText>,
			sortValue: (row) => row.event_user.points,
		},
		{
			id: "banned",
			header: t("adminEvents.members.columns.status"),
			cell: (row) => (
				<BooleanPill
					value={row.event_user.banned}
					trueText={t("adminEvents.members.values.banned")}
					falseText={t("adminEvents.members.values.normal")}
					trueTone="danger"
					falseTone="success"
				/>
			),
			sortValue: (row) => (row.event_user.banned ? 1 : 0),
		},
		{
			id: "joined_at",
			header: t("adminEvents.members.columns.joinedAt"),
			cell: (row) => <MonoText className="whitespace-nowrap">
				{formatDateTime(row.event_user.joined_at, { seconds: true })}
			</MonoText>,
			sortValue: (row) => row.event_user.joined_at,
			hideBelow: "md",
		},
	];

	const rowActions = (row: EventUserResult): ReactNode => {
		const actionsLabel = t("adminEvents.members.row.actions", { name: displayName(row.user) });
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label={actionsLabel} title={actionsLabel}>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel className="max-w-56 truncate">
						{displayName(row.user)}
					</DropdownMenuLabel>
					{row.event_user.banned ? (
						<DropdownMenuItem onSelect={() => unban.mutate([row.user.id])}>
							<ShieldCheck /> {t("adminEvents.members.row.unban")}
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem variant="destructive" onSelect={() => void confirmBan(row)}>
							<Ban /> {t("adminEvents.members.row.ban")}
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					{participantMode === "team" ? (
						<DropdownMenuItem disabled>
							<UserMinus /> {t("adminEvents.members.row.teamManaged")}
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem variant="destructive" onSelect={() => void confirmRemove([row])}>
							<UserMinus /> {t("adminEvents.members.row.remove")}
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		);
	};

	const mobileCard = (row: EventUserResult): ReactNode => (
		<div className="space-y-2">
			<MobileFacts
				items={[
					{
						k: t("adminEvents.members.mobile.user"),
						v: (
							<UserCell
								username={row.user.username}
								nickname={row.user.nickname}
								avatar={row.user.avatar}
							/>
						),
					},
					{
						k: t("adminEvents.members.mobile.points"),
						v: <MonoText>{row.event_user.points.toFixed(2)}</MonoText>,
					},
					{
						k: t("adminEvents.members.mobile.status"),
						v: (
							<BooleanPill
								value={row.event_user.banned}
								trueText={t("adminEvents.members.values.banned")}
								falseText={t("adminEvents.members.values.normal")}
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

	const selectedRows = (query.data?.items ?? []).filter((item) => selectedIds.includes(item.user.id));

	return (
		<SectionCard
			title={t("adminEvents.members.title")}
			description={
				participantMode === "team"
					? t("adminEvents.members.descriptionTeam")
					: t("adminEvents.members.descriptionIndividual")
			}
			actions={
				<Toolbar>
					{selectedIds.length > 0 ? (
						<>
							<Button
								variant="outline"
								size="sm"
								disabled={unban.isPending}
								onClick={() => unban.mutate(selectedRows.map((row) => row.user.id))}
							>
								<ShieldCheck /> {t("adminEvents.members.toolbar.unban")}
							</Button>
							<Button
								variant="destructive"
								size="sm"
								disabled={ban.isPending}
								onClick={() => {
									// 批量封禁沿用单条确认词（逐条输入用户名）不可行，这里统一确认一次。
									void (async () => {
										const ok = await confirm({
											title: t("adminEvents.members.confirmBulkBan.title", {
												count: selectedRows.length,
											}),
											description: t("adminEvents.members.confirmBulkBan.description"),
											consequences: [
												t("adminEvents.members.confirmBulkBan.consequence1"),
												t("adminEvents.members.confirmBulkBan.consequence2"),
												t("adminEvents.members.confirmBulkBan.consequence3"),
											],
											tone: "danger",
											confirmText: t("adminEvents.members.confirmBulkBan.confirm"),
											confirmPhrase: t("adminEvents.members.confirmBulkBan.phrase"),
										});
										if (!ok) return;
										ban.mutate(selectedRows.map((row) => row.user.id));
									})();
								}}
							>
								<Ban /> {t("adminEvents.members.toolbar.banSelected")}
							</Button>
							{participantMode === "team" ? null : (
								<Button
									variant="destructive"
									size="sm"
									disabled={remove.isPending}
									onClick={() => void confirmRemove(selectedRows)}
								>
									<Trash2 /> {t("adminEvents.members.toolbar.removeSelected")}
								</Button>
							)}
						</>
					) : null}
					<Button size="sm" onClick={() => setAddOpen(true)}>
						<Plus /> {t("adminEvents.members.addButton")}
					</Button>
				</Toolbar>
			}
		>
			<PagedTable
				query={query}
				columns={columns}
				getRowId={(row) => row.user.id}
				page={page}
				pageSize={pageSize}
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
				errorTitle={t("adminEvents.members.loadError")}
				empty={
					<EmptyBlock
						title={t("adminEvents.members.empty.title")}
						description={t("adminEvents.members.empty.description")}
						action={
							<Button size="sm" onClick={() => setAddOpen(true)}>
								<Plus /> {t("adminEvents.members.addButton")}
							</Button>
						}
					/>
				}
			/>

			{addOpen ? (
				<AddMembersSheet
					eventId={eventId}
					participantMode={participantMode}
					onClose={() => setAddOpen(false)}
					onDone={invalidate}
				/>
			) : null}
		</SectionCard>
	);
}

/* ── 添加成员 ───────────────────────────────────────────────────────────── */

function AddMembersSheet({
	eventId,
	participantMode,
	onClose,
	onDone,
}: {
	eventId: string;
	participantMode: string;
	onClose: () => void;
	onDone: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize] = useState(10);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const keyword = useDebouncedValue(search, 300);

	const filter = useMemo(() => {
		const cleaned = keyword.replace(/[&|]/g, " ").trim();
		return cleaned === "" ? undefined : `nickname:${cleaned}`;
	}, [keyword]);

	const query = useQuery({
		queryKey: qk.admin.users({ page, limit: pageSize, filter }),
		queryFn: () => callList<Users>(client.admin.users.fetch({ page, limit: pageSize, filter })),
	});

	const add = useMutation({
		mutationFn: () =>
			call(
				client.admin.event_users.add({ event_id: eventId, user_id_list: selectedIds }),
				t("adminEvents.actions.addMember"),
			),
		onSuccess: () => {
			toast.success(t("adminEvents.members.add.toast.success", { count: selectedIds.length }));
			onDone();
			onClose();
		},
		onError: (error) => toast.apiError(t("adminEvents.members.add.toast.failed"), error),
	});

	const columns: DataTableColumn<Users>[] = [
		{
			id: "username",
			header: t("adminEvents.members.add.table.username"),
			cell: (row) => <MonoText>{row.username}</MonoText>,
			sortValue: (row) => row.username,
		},
		{
			id: "nickname",
			header: t("adminEvents.members.add.table.nickname"),
			cell: (row) => row.nickname,
			sortValue: (row) => row.nickname,
		},
		{
			id: "created_at",
			header: t("adminEvents.members.add.table.createdAt"),
			cell: (row) => <MonoText>{formatDateTime(row.created_at)}</MonoText>,
			sortValue: (row) => row.created_at,
			hideBelow: "md",
		},
	];

	const total = query.data?.meta?.total ?? query.data?.items.length ?? 0;

	return (
		<FormSheet
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			width="lg"
			title={t("adminEvents.members.add.title")}
			description={
				participantMode === "team"
					? t("adminEvents.members.add.descriptionTeam")
					: t("adminEvents.members.add.descriptionIndividual")
			}
			footer={
				<FormFooter
					formId="add-members-form"
					onCancel={onClose}
					submitLabel={
						selectedIds.length > 0
							? t("adminEvents.members.add.submitWithCount", {
									count: selectedIds.length,
								})
							: t("adminEvents.members.add.submit")
					}
					isPending={add.isPending}
					disabled={selectedIds.length === 0}
				/>
			}
		>
			<form
				id="add-members-form"
				className="space-y-3"
				onSubmit={(submitEvent) => {
					submitEvent.preventDefault();
					if (selectedIds.length === 0) return;
					add.mutate();
				}}
			>
				<Field
					label={t("adminEvents.members.add.searchLabel")}
					htmlFor="member-search"
					hint={t("adminEvents.members.add.searchHint")}
				>
					<Input
						id="member-search"
						value={search}
						onChange={(changeEvent) => {
							setSearch(changeEvent.target.value);
							setPage(1);
						}}
						placeholder={t("adminEvents.members.add.searchPlaceholder")}
					/>
				</Field>

				{query.isPending ? (
					<TableSkeleton rows={6} columns={3} />
				) : query.isError ? (
					<ErrorBlock
						error={query.error}
						title={t("adminEvents.members.loadError")}
						onRetry={() => void query.refetch()}
					/>
				) : (
					<>
						<DataTable
							data={query.data?.items ?? []}
							columns={columns}
							getRowId={(row) => row.id}
							selectable
							selectedIds={selectedIds}
							onSelectionChange={setSelectedIds}
							empty={
								<EmptyBlock
									title={t("adminEvents.members.add.emptyTitle")}
									description={t("adminEvents.members.add.emptyDescription")}
								/>
							}
							mobileCard={(row) => (
								<MobileFacts
									items={[
										{
											k: t("adminEvents.members.add.mobile.username"),
											v: <MonoText>{row.username}</MonoText>,
										},
										{
											k: t("adminEvents.members.add.mobile.nickname"),
											v: row.nickname,
										},
									]}
								/>
							)}
						/>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="tnum text-xs text-muted-foreground">
								{t("adminEvents.members.add.selectedSummary", {
									total,
									selected: selectedIds.length,
								})}
							</p>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={page <= 1}
									onClick={() => setPage((current) => Math.max(1, current - 1))}
								>
									{t("common.table.prevPage")}
								</Button>
								<span className="tnum text-xs text-muted-foreground">
									{t("common.table.page", { page })}
								</span>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={query.data !== undefined && page * pageSize >= total}
									onClick={() => setPage((current) => current + 1)}
								>
									{t("common.table.nextPage")}
								</Button>
							</div>
						</div>
					</>
				)}
			</form>
		</FormSheet>
	);
}
