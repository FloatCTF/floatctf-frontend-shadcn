/**
 * 赛事控制台 · 题目标签（jeopardy_event_challenges）。
 *
 * 覆盖：列表（柯里化 `fetch(eventId)({page,limit})`）、从题库勾选加入（`add`）、
 * 批量设分（`setPoints`）、发布 / 隐藏（`open` / `hidden`）、移除（柯里化 `remove(eventId)`）。
 *
 * 文案全部走 `adminEvents.challenges` 命名空间；`build_status` 等后端技术标识保持原文。
 */

import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, MoreHorizontal, Plus, Target, Trash2 } from "lucide-react";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormSheet } from "~/components/app/form";
import { MonoText, SectionCard, Toolbar } from "~/components/app/page";
import { EmptyBlock, ErrorBlock, TableSkeleton } from "~/components/app/states";
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
import { Input } from "~/components/ui/input";
import type { AdminEventChallengeResult, ChallengesListItem } from "@floatctf/sdk";
import { formatDateTime } from "~/lib/format";
import { useDebouncedValue } from "~/lib/hooks";

import { MobileFacts, PagedTable } from "./shared";

function buildStatusTone(status: string | undefined): "success" | "warning" | "muted" {
	if (status === "ready") return "success";
	if (!status) return "muted";
	return "warning";
}

export function EventChallengesTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [addOpen, setAddOpen] = useState(false);
	const [pointsTarget, setPointsTarget] = useState<string[] | null>(null);

	const query = useQuery({
		queryKey: qk.admin.eventChallenges(eventId, { page, limit: pageSize }),
		queryFn: () =>
			callList<AdminEventChallengeResult>(
				client.admin.event_challenges.fetch(eventId)({ page, limit: pageSize }),
			),
	});

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventChallenges(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.event(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventLogs(eventId) });
	}

	const openChallenges = useMutation({
		mutationFn: (ids: string[]) =>
			call(
				client.admin.event_challenges.open({ event_id: eventId, challenge_id_list: ids }),
				t("adminEvents.actions.publishChallenges"),
			),
		onSuccess: (_result, ids) => {
			toast.success(
				t("adminEvents.challenges.toast.publishSuccess", { count: ids.length }),
				t("adminEvents.challenges.toast.publishSuccessDescription"),
			);
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.challenges.toast.publishFailed"), error),
	});

	const hideChallenges = useMutation({
		mutationFn: (ids: string[]) =>
			call(
				client.admin.event_challenges.hidden({ event_id: eventId, challenge_id_list: ids }),
				t("adminEvents.actions.hideChallenges"),
			),
		onSuccess: (_result, ids) => {
			toast.success(t("adminEvents.challenges.toast.hideSuccess", { count: ids.length }));
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.challenges.toast.hideFailed"), error),
	});

	const removeChallenges = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(
				client.admin.event_challenges.remove(eventId)(ids),
				t("adminEvents.actions.removeChallenges"),
			),
		onSuccess: (count) => {
			toast.success(t("adminEvents.challenges.toast.removeSuccess", { count }));
			setSelectedIds([]);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.challenges.toast.removeFailed"), error),
	});

	const setPoints = useMutation({
		mutationFn: (input: { ids: string[]; points: number }) =>
			call(
				client.admin.event_challenges.setPoints({
					event_id: eventId,
					challenge_id_list: input.ids,
					points: input.points,
				}),
				t("adminEvents.actions.setChallengePoints"),
			),
		onSuccess: () => {
			toast.success(
				t("adminEvents.challenges.toast.pointsSuccess"),
				t("adminEvents.challenges.toast.pointsSuccessDescription"),
			);
			setPointsTarget(null);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.challenges.toast.pointsFailed"), error),
	});

	async function confirmRemove(rows: AdminEventChallengeResult[]) {
		if (rows.length === 0) return;
		const single = rows.length === 1 ? rows[0] : null;
		const ok = await confirm({
			title: single
				? t("adminEvents.challenges.confirm.singleTitle", { name: single.challenge.name })
				: t("adminEvents.challenges.confirm.bulkTitle", { count: rows.length }),
			description: t("adminEvents.challenges.confirm.description"),
			consequences: [
				t("adminEvents.challenges.confirm.consequence1"),
				t("adminEvents.challenges.confirm.consequence2"),
				t("adminEvents.challenges.confirm.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminEvents.challenges.confirm.confirm"),
		});
		if (!ok) return;
		removeChallenges.mutate(rows.map((row) => row.challenge.id));
	}

	const columns: DataTableColumn<AdminEventChallengeResult>[] = [
		{
			id: "challenge_id",
			header: t("adminEvents.challenges.columns.challengeId"),
			cell: (row) => <MonoText>{row.challenge.id}</MonoText>,
			sortValue: (row) => row.challenge.id,
			hideBelow: "lg",
		},
		{
			id: "name",
			header: t("adminEvents.challenges.columns.name"),
			cell: (row) => <span className="font-medium">{row.challenge.name}</span>,
			sortValue: (row) => row.challenge.name,
		},
		{
			id: "category",
			header: t("adminEvents.challenges.columns.category"),
			cell: (row) => (
				<TonePill tone="neutral" title={row.challenge.category}>
					{row.challenge.category}
				</TonePill>
			),
			sortValue: (row) => row.challenge.category,
		},
		{
			id: "points",
			header: t("adminEvents.challenges.columns.points"),
			align: "right",
			cell: (row) => <MonoText>{row.event_challenge.points.toFixed(2)}</MonoText>,
			sortValue: (row) => row.event_challenge.points,
		},
		{
			id: "hidden",
			header: t("adminEvents.challenges.columns.publishState"),
			cell: (row) => (
				<BooleanPill
					value={row.event_challenge.hidden}
					trueText={t("adminEvents.challenges.values.hidden")}
					falseText={t("adminEvents.challenges.values.published")}
					trueTone="muted"
					falseTone="success"
				/>
			),
			sortValue: (row) => (row.event_challenge.hidden ? 1 : 0),
		},
		{
			id: "build_status",
			header: t("adminEvents.challenges.columns.buildStatus"),
			cell: (row) => (
				<TonePill tone={buildStatusTone(row.challenge.build_status)}>
					{row.challenge.build_status ?? t("common.unknown")}
				</TonePill>
			),
			sortValue: (row) => row.challenge.build_status ?? "",
			hideBelow: "lg",
		},
	];

	const rowActions = (row: AdminEventChallengeResult): ReactNode => {
		const actionsLabel = t("adminEvents.challenges.row.actions", { name: row.challenge.name });
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label={actionsLabel} title={actionsLabel}>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel className="max-w-56 truncate">{row.challenge.name}</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => setPointsTarget([row.challenge.id])}>
						<Target /> {t("adminEvents.challenges.row.setPoints")}
					</DropdownMenuItem>
					{row.event_challenge.hidden ? (
						<DropdownMenuItem onSelect={() => openChallenges.mutate([row.challenge.id])}>
							<Eye /> {t("adminEvents.challenges.row.publish")}
						</DropdownMenuItem>
					) : (
						<DropdownMenuItem onSelect={() => hideChallenges.mutate([row.challenge.id])}>
							<EyeOff /> {t("adminEvents.challenges.row.hide")}
						</DropdownMenuItem>
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onSelect={() => void confirmRemove([row])}>
						<Trash2 /> {t("adminEvents.challenges.row.remove")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	};

	const mobileCard = (row: AdminEventChallengeResult): ReactNode => (
		<div className="space-y-2">
			<MobileFacts
				items={[
					{
						k: t("adminEvents.challenges.mobile.challenge"),
						v: <span className="font-medium">{row.challenge.name}</span>,
					},
					{
						k: t("adminEvents.challenges.mobile.category"),
						v: (
							<TonePill tone="neutral" title={row.challenge.category}>
								{row.challenge.category}
							</TonePill>
						),
					},
					{
						k: t("adminEvents.challenges.mobile.points"),
						v: <MonoText>{row.event_challenge.points.toFixed(2)}</MonoText>,
					},
					{
						k: t("adminEvents.challenges.mobile.status"),
						v: (
							<BooleanPill
								value={row.event_challenge.hidden}
								trueText={t("adminEvents.challenges.values.hidden")}
								falseText={t("adminEvents.challenges.values.published")}
								trueTone="muted"
								falseTone="success"
							/>
						),
					},
				]}
			/>
			<div className="flex justify-end">{rowActions(row)}</div>
		</div>
	);

	return (
		<SectionCard
			title={t("adminEvents.challenges.title")}
			description={t("adminEvents.challenges.description")}
			actions={
				<Toolbar>
					{selectedIds.length > 0 ? (
						<>
							<Button
								variant="outline"
								size="sm"
								disabled={openChallenges.isPending}
								onClick={() => openChallenges.mutate(selectedIds)}
							>
								<Eye />{" "}
								{t("adminEvents.challenges.toolbar.publishSelected", {
									count: selectedIds.length,
								})}
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={hideChallenges.isPending}
								onClick={() => hideChallenges.mutate(selectedIds)}
							>
								<EyeOff /> {t("adminEvents.challenges.toolbar.hideSelected")}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPointsTarget(selectedIds)}
							>
								<Target /> {t("adminEvents.challenges.toolbar.bulkSetPoints")}
							</Button>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => {
									const rows = (query.data?.items ?? []).filter((item) =>
										selectedIds.includes(item.challenge.id),
									);
									void confirmRemove(rows);
								}}
							>
								<Trash2 /> {t("adminEvents.challenges.toolbar.removeSelected")}
							</Button>
						</>
					) : null}
					<Button size="sm" onClick={() => setAddOpen(true)}>
						<Plus /> {t("adminEvents.challenges.addButton")}
					</Button>
				</Toolbar>
			}
		>
			<PagedTable
				query={query}
				columns={columns}
				getRowId={(row) => row.challenge.id}
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
				errorTitle={t("adminEvents.challenges.loadError")}
				empty={
					<EmptyBlock
						title={t("adminEvents.challenges.empty.title")}
						description={t("adminEvents.challenges.empty.description")}
						action={
							<Button size="sm" onClick={() => setAddOpen(true)}>
								<Plus /> {t("adminEvents.challenges.addButton")}
							</Button>
						}
					/>
				}
			/>

			{addOpen ? (
				<AddChallengesSheet eventId={eventId} onClose={() => setAddOpen(false)} onDone={invalidate} />
			) : null}

			{pointsTarget ? (
				<SetPointsSheet
					count={pointsTarget.length}
					isPending={setPoints.isPending}
					onClose={() => setPointsTarget(null)}
					onSubmit={(points) => setPoints.mutate({ ids: pointsTarget, points })}
				/>
			) : null}
		</SectionCard>
	);
}

/* ── 从题库添加 ─────────────────────────────────────────────────────────── */

function AddChallengesSheet({
	eventId,
	onClose,
	onDone,
}: {
	eventId: string;
	onClose: () => void;
	onDone: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize] = useState(10);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [points, setPoints] = useState("");
	const keyword = useDebouncedValue(search, 300);

	const filter = useMemo(() => {
		const cleaned = keyword.replace(/[&|]/g, " ").trim();
		return cleaned === "" ? undefined : `name:${cleaned}`;
	}, [keyword]);

	const query = useQuery({
		queryKey: qk.admin.challenges({ page, limit: pageSize, filter }),
		queryFn: () =>
			callList<ChallengesListItem>(
				client.admin.challenges.fetch({ page, limit: pageSize, filter }),
			),
	});

	const parsedPoints = points.trim() === "" ? undefined : Number(points);
	const pointsValid =
		parsedPoints === undefined ||
		(Number.isFinite(parsedPoints) && parsedPoints > 0 && parsedPoints <= 1_000_000);

	const add = useMutation({
		mutationFn: () =>
			call(
				client.admin.event_challenges.add({
					event_id: eventId,
					challenge_id_list: selectedIds,
					points: parsedPoints,
				}),
				t("adminEvents.actions.addChallenges"),
			),
		onSuccess: () => {
			toast.success(t("adminEvents.challenges.add.toast.success", { count: selectedIds.length }));
			onDone();
			onClose();
		},
		onError: (error) => toast.apiError(t("adminEvents.challenges.add.toast.failed"), error),
	});

	const columns: DataTableColumn<ChallengesListItem>[] = [
		{
			id: "name",
			header: t("adminEvents.challenges.add.table.name"),
			cell: (row) => row.name,
			sortValue: (row) => row.name,
		},
		{
			id: "category",
			header: t("adminEvents.challenges.add.table.category"),
			cell: (row) => (
				<TonePill tone="neutral" title={row.category}>
					{row.category}
				</TonePill>
			),
			sortValue: (row) => row.category,
		},
		{
			id: "build_status",
			header: t("adminEvents.challenges.add.table.buildStatus"),
			cell: (row) => (
				<TonePill tone={buildStatusTone(row.build_status)}>
					{row.build_status ?? t("common.unknown")}
				</TonePill>
			),
			sortValue: (row) => row.build_status ?? "",
		},
		{
			id: "updated_at",
			header: t("adminEvents.challenges.add.table.updatedAt"),
			cell: (row) => <MonoText>{formatDateTime(row.updated_at)}</MonoText>,
			sortValue: (row) => row.updated_at,
			hideBelow: "md",
		},
	];

	const total = query.data?.meta?.total ?? query.data?.items.length ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	return (
		<FormSheet
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			width="xl"
			title={t("adminEvents.challenges.add.title")}
			description={t("adminEvents.challenges.add.description")}
			footer={
				<FormFooter
					formId="add-challenges-form"
					onCancel={onClose}
					submitLabel={
						selectedIds.length > 0
							? t("adminEvents.challenges.add.submitWithCount", {
									count: selectedIds.length,
								})
							: t("adminEvents.challenges.add.submit")
					}
					isPending={add.isPending}
					disabled={selectedIds.length === 0 || !pointsValid}
				/>
			}
		>
			<form
				id="add-challenges-form"
				className="space-y-3"
				onSubmit={(submitEvent) => {
					submitEvent.preventDefault();
					if (selectedIds.length === 0 || !pointsValid) return;
					add.mutate();
				}}
			>
				<div className="flex flex-wrap items-end gap-3">
					<Field
						label={t("adminEvents.challenges.add.searchLabel")}
						htmlFor="challenge-search"
						className="min-w-52 flex-1"
					>
						<Input
							id="challenge-search"
							value={search}
							onChange={(changeEvent) => {
								setSearch(changeEvent.target.value);
								setPage(1);
							}}
							placeholder={t("adminEvents.challenges.add.searchPlaceholder")}
						/>
					</Field>
					<Field
						label={t("adminEvents.challenges.add.pointsLabel")}
						htmlFor="challenge-points"
						hint={t("adminEvents.challenges.add.pointsHint")}
						error={pointsValid ? undefined : t("adminEvents.challenges.add.pointsError")}
					>
						<Input
							id="challenge-points"
							type="number"
							min={1}
							value={points}
							className="w-40"
							onChange={(changeEvent) => setPoints(changeEvent.target.value)}
						/>
					</Field>
				</div>

				{query.isPending ? (
					<TableSkeleton rows={6} columns={4} />
				) : query.isError ? (
					<ErrorBlock
						error={query.error}
						title={t("adminEvents.challenges.loadError")}
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
									title={t("adminEvents.challenges.add.emptyTitle")}
									description={t("adminEvents.challenges.add.emptyDescription")}
								/>
							}
							mobileCard={(row) => (
								<MobileFacts
									items={[
										{ k: t("adminEvents.challenges.add.mobile.name"), v: row.name },
										{
											k: t("adminEvents.challenges.add.mobile.category"),
											v: (
												<TonePill tone="neutral" title={row.category}>
													{row.category}
												</TonePill>
											),
										},
										{
											k: t("adminEvents.challenges.add.mobile.buildStatus"),
											v: (
												<TonePill tone={buildStatusTone(row.build_status)}>
													{row.build_status ?? t("common.unknown")}
												</TonePill>
											),
										},
									]}
								/>
							)}
						/>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="tnum text-xs text-muted-foreground">
								{t("adminEvents.challenges.add.selectedSummary", {
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
									{t("adminEvents.challenges.add.pageInfo", {
										page,
										total: totalPages,
									})}
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

/* ── 设置分值 ───────────────────────────────────────────────────────────── */

function SetPointsSheet({
	count,
	isPending,
	onClose,
	onSubmit,
}: {
	count: number;
	isPending: boolean;
	onClose: () => void;
	onSubmit: (points: number) => void;
}): ReactNode {
	const { t } = useTranslation();
	const [value, setValue] = useState("100");
	const parsed = Number(value);
	const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000;

	return (
		<FormSheet
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			title={t("adminEvents.challenges.points.title", { count })}
			description={t("adminEvents.challenges.points.description")}
			footer={
				<FormFooter
					onCancel={onClose}
					submitLabel={t("adminEvents.challenges.points.submit")}
					isPending={isPending}
					disabled={!valid}
					formId="set-points-form"
				/>
			}
		>
			<form
				id="set-points-form"
				onSubmit={(submitEvent) => {
					submitEvent.preventDefault();
					if (valid) onSubmit(parsed);
				}}
			>
				<Field
					label={t("adminEvents.challenges.points.label")}
					htmlFor="set-points-value"
					required
					hint={t("adminEvents.challenges.points.hint")}
					error={valid ? undefined : t("adminEvents.challenges.points.error")}
				>
					<Input
						id="set-points-value"
						type="number"
						min={1}
						value={value}
						onChange={(changeEvent) => setValue(changeEvent.target.value)}
					/>
				</Field>
			</form>
		</FormSheet>
	);
}
