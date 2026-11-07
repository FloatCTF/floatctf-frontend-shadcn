/**
 * 管理端 · 全局公告治理（`/admin/community/announcements`）。
 *
 * 真实接口：`client.admin.announcements.fetch/create/patch/remove`。
 * 后端语义（`apps/api/src/modules/platform/announcements/api.rs`）：
 * - 列表支持 `page` / `limit` 服务端分页，`filter` 只映射 `id` / `title` / `content`；
 * - `patch` 走 `PATCH /announcements/{id}`，SDK 要求必须带 `.id`；
 * - 批量删除是 `DELETE` + body `{ id_list }`。
 */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Megaphone, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { Announcements } from "@floatctf/sdk/entity";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormSheet } from "~/components/app/form";
import {
	MonoText,
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { AbsoluteTime } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { formatInt, truncate } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import {
	DeleteSelectedButton,
	SearchInput,
	sanitizeFilterValue,
	useListState,
} from "./components";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function AdminAnnouncementsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCommunity.announcements.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const list = useListState(20);
	const [selected, setSelected] = useState<string[]>([]);
	/** `undefined` = 关闭；`null` = 新建；否则为编辑目标。 */
	const [editing, setEditing] = useState<Announcements | null | undefined>(undefined);

	// 后端 filter 只映射 title/content，多字段用 `|` 做 OR（搜索词先剔除逻辑分隔符）。
	const filter = list.filter;
	const keyword = sanitizeFilterValue(filter);
	const remoteFilter =
		keyword.length === 0 ? undefined : `title:${keyword} | content:${keyword}`;

	useEffect(() => {
		setSelected([]);
	}, [list.page, filter]);

	const query = useQuery({
		queryKey: qk.admin.announcements({
			page: list.page,
			limit: list.pageSize,
			...(remoteFilter ? { filter: remoteFilter } : {}),
		}),
		queryFn: () =>
			callList<Announcements>(
				client.admin.announcements.fetch({
					page: list.page,
					limit: list.pageSize,
					...(remoteFilter ? { filter: remoteFilter } : {}),
				}),
			),
		placeholderData: keepPreviousData,
	});

	const removeMutation = useMutation({
		mutationFn: (ids: string[]) =>
			callVoid(client.admin.announcements.remove(ids), t("adminCommunity.announcements.requests.delete")),
		onSuccess: (_data, ids) => {
			toast.success(t("adminCommunity.announcements.toasts.deleted", { count: ids.length }));
			setSelected([]);
			void queryClient.invalidateQueries({ queryKey: qk.admin.announcements() });
			void queryClient.invalidateQueries({ queryKey: qk.announcements.all });
		},
		onError: (error) => toast.apiError(t("adminCommunity.announcements.toasts.deleteFailed"), error),
	});

	async function removeRows(rows: Announcements[]) {
		if (rows.length === 0) return;
		const titles = rows
			.slice(0, 3)
			.map((row) => row.title)
			.join(t("adminCommunity.common.listSeparator"));
		const ok = await confirm({
			title:
				rows.length === 1
					? t("adminCommunity.announcements.confirm.deleteTitleSingle")
					: t("adminCommunity.announcements.confirm.deleteTitleMany", { count: rows.length }),
			description:
				rows.length === 1
					? rows[0].title
					: rows.length > 3
						? t("adminCommunity.announcements.confirm.descriptionManyMore", {
								titles,
								count: rows.length,
							})
						: t("adminCommunity.announcements.confirm.descriptionMany", { titles }),
			consequences: [
				t("adminCommunity.announcements.confirm.consequenceVisibility"),
				t("adminCommunity.announcements.confirm.consequenceIrreversible"),
			],
			tone: "danger",
			confirmText: t("adminCommunity.announcements.confirm.confirm"),
		});
		if (!ok) return;
		removeMutation.mutate(rows.map((row) => row.id));
	}

	/**
	 * 公告发布者展示名：`publisher` 是发布时的展示名快照；`publisher_id` 为空
	 * 表示该账号已被注销（后端 ON DELETE SET NULL），此时保留快照并标注。
	 */
	function publisherText(row: Announcements): string {
		const name = row.publisher.trim();
		if (row.publisher_id) return name || t("adminCommunity.announcements.publisher.deleted");
		return name
			? t("adminCommunity.announcements.publisher.deletedSuffix", { name })
			: t("adminCommunity.announcements.publisher.deleted");
	}

	const columns: DataTableColumn<Announcements>[] = [
		{
			id: "title",
			header: t("adminCommunity.announcements.columns.title"),
			sortValue: (row) => row.title,
			cell: (row) => <span className="text-sm font-medium">{row.title}</span>,
		},
		{
			id: "content",
			header: t("adminCommunity.announcements.columns.content"),
			hideBelow: "md",
			cell: (row) => (
				<span
					className="line-clamp-2 max-w-2xl text-sm break-words text-muted-foreground"
					title={row.content ?? undefined}
				>
					{truncate(row.content ?? "", 80) || t("adminCommunity.common.noContent")}
				</span>
			),
		},
		{
			id: "publisher",
			header: t("adminCommunity.announcements.columns.publisher"),
			hideBelow: "sm",
			sortValue: (row) => publisherText(row),
			cell: (row) => <span className="text-sm">{publisherText(row)}</span>,
		},
		{
			id: "created_at",
			header: t("adminCommunity.announcements.columns.createdAt"),
			align: "right",
			hideBelow: "sm",
			sortValue: (row) => Date.parse(row.created_at),
			cell: (row) => <AbsoluteTime value={row.created_at} />,
		},
		{
			id: "updated_at",
			header: t("adminCommunity.announcements.columns.updatedAt"),
			align: "right",
			sortValue: (row) => Date.parse(row.updated_at),
			cell: (row) => <AbsoluteTime value={row.updated_at} />,
		},
	];

	const total = query.data?.meta.total ?? query.data?.items.length ?? 0;
	const hasRows = total > 0;

	return (
		<PageBody>
			<PageHeader
				title={t("adminCommunity.announcements.title")}
				description={t("adminCommunity.announcements.subtitle")}
				badge={<TonePill tone="info">{t("adminCommunity.announcements.badge")}</TonePill>}
				actions={
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						<Button
							variant="outline"
							size="sm"
							onClick={() => void query.refetch()}
							disabled={query.isFetching}
						>
							<RefreshCw aria-hidden="true" />
							{t("common.refresh")}
						</Button>
						<Button onClick={() => setEditing(null)}>
							<Plus aria-hidden="true" />
							{t("adminCommunity.announcements.actions.create")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={
					<span className="flex items-center gap-2">
						{t("adminCommunity.announcements.section.title")}
						{query.data ? (
							<MonoText className="text-muted-foreground">{formatInt(total)}</MonoText>
						) : null}
					</span>
				}
				description={t("adminCommunity.announcements.section.description")}
				contentClassName="px-0"
				footer={
					hasRows && query.data ? (
						<PaginationBar
							page={list.page}
							pageSize={list.pageSize}
							total={total}
							onPageChange={list.setPage}
							onPageSizeChange={list.setPageSize}
							pageSizeOptions={PAGE_SIZE_OPTIONS}
						/>
					) : null
				}
			>
				<div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
					<SearchInput
						value={list.search}
						onChange={list.setSearch}
						placeholder={t("adminCommunity.announcements.search.placeholder")}
					/>
					<DeleteSelectedButton
						count={selected.length}
						isPending={removeMutation.isPending}
						onClick={() =>
							void removeRows(
								(query.data?.items ?? []).filter((row) => selected.includes(row.id)),
							)
						}
					/>
				</div>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={5} />}
					errorTitle={t("adminCommunity.announcements.errors.load")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						keyword.length > 0 ? (
							<EmptyBlock
								className="mx-4"
								variant="filtered"
								title={t("adminCommunity.announcements.filtered.title")}
								description={t("adminCommunity.announcements.filtered.description", {
									query: keyword,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => list.setSearch("")}>
										{t("adminCommunity.announcements.filtered.clear")}
									</Button>
								}
							/>
						) : list.page > 1 ? (
							<EmptyBlock
								className="mx-4"
								title={t("adminCommunity.common.pageOutOfRangeTitle")}
								description={t("adminCommunity.common.pageOutOfRangeDescription")}
								action={
									<Button size="sm" variant="outline" onClick={() => list.setPage(1)}>
										{t("adminCommunity.common.pageOutOfRangeAction")}
									</Button>
								}
							/>
						) : (
							<EmptyBlock
								className="mx-4"
								title={t("adminCommunity.announcements.empty.title")}
								description={t("adminCommunity.announcements.empty.description")}
								icon={<Megaphone aria-hidden="true" />}
								action={
									<Button size="sm" onClick={() => setEditing(null)}>
										{t("adminCommunity.announcements.empty.action")}
									</Button>
								}
							/>
						)
					}
				>
					{(result) => (
						<DataTable
							data={result.items}
							getRowId={(row) => row.id}
							columns={columns}
							selectable
							selectedIds={selected}
							onSelectionChange={setSelected}
							rowActions={(row) => (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={t("adminCommunity.announcements.rowActions.aria")}
											title={t("adminCommunity.announcements.rowActions.aria")}
										>
											<MoreHorizontal />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onSelect={() => setEditing(row)}>
											<Pencil />
											{t("adminCommunity.announcements.rowActions.edit")}
										</DropdownMenuItem>
										<DropdownMenuItem
											variant="destructive"
											onSelect={() => void removeRows([row])}
										>
											<Trash2 />
											{t("adminCommunity.announcements.rowActions.delete")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
							mobileCard={(row) => (
								<div className="space-y-2">
									<div className="flex items-start justify-between gap-2">
										<span className="min-w-0 text-sm font-medium break-words">
											{row.title}
										</span>
										<AbsoluteTime value={row.updated_at} />
									</div>
									<p className="line-clamp-4 text-sm break-words text-muted-foreground">
										{truncate(row.content ?? "", 160) ||
											t("adminCommunity.common.noContent")}
									</p>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<span className="text-xs text-muted-foreground">
											{publisherText(row)}
										</span>
										<div className="flex items-center gap-1">
											<Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
												<Pencil />
												{t("adminCommunity.announcements.rowActions.edit")}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive"
												onClick={() => void removeRows([row])}
											>
												<Trash2 />
												{t("adminCommunity.announcements.rowActions.delete")}
											</Button>
										</div>
									</div>
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>

			<AnnouncementFormSheet
				open={editing !== undefined}
				row={editing ?? null}
				onOpenChange={(open) => {
					if (!open) setEditing(undefined);
				}}
			/>
		</PageBody>
	);
}

function AnnouncementFormSheet({
	open,
	row,
	onOpenChange,
}: {
	open: boolean;
	row: Announcements | null;
	onOpenChange: (open: boolean) => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setTitle(row?.title ?? "");
		setContent(row?.content ?? "");
		setError(null);
	}, [open, row]);

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.announcements() });
		void queryClient.invalidateQueries({ queryKey: qk.announcements.all });
	}

	const createMutation = useMutation({
		mutationFn: (input: { title: string; content: string }) =>
			call(client.admin.announcements.create(input), t("adminCommunity.announcements.requests.create")),
		onSuccess: () => {
			toast.success(t("adminCommunity.announcements.toasts.created"));
			invalidate();
			onOpenChange(false);
		},
		onError: (err) => toast.apiError(t("adminCommunity.announcements.toasts.createFailed"), err),
	});

	const patchMutation = useMutation({
		mutationFn: (input: { id: string; title: string; content: string }) =>
			call(client.admin.announcements.patch(input), t("adminCommunity.announcements.requests.update")),
		onSuccess: () => {
			toast.success(t("adminCommunity.announcements.toasts.updated"));
			invalidate();
			onOpenChange(false);
		},
		onError: (err) => toast.apiError(t("adminCommunity.announcements.toasts.updateFailed"), err),
	});

	const isPending = createMutation.isPending || patchMutation.isPending;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const nextTitle = title.trim();
		if (nextTitle.length === 0) {
			setError(t("adminCommunity.announcements.form.titleRequired"));
			return;
		}
		setError(null);
		if (row) patchMutation.mutate({ id: row.id, title: nextTitle, content });
		else createMutation.mutate({ title: nextTitle, content });
	}

	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			title={
				row
					? t("adminCommunity.announcements.form.editTitle")
					: t("adminCommunity.announcements.form.createTitle")
			}
			description={
				row
					? t("adminCommunity.announcements.form.descriptionEdit")
					: t("adminCommunity.announcements.form.descriptionCreate")
			}
			width="lg"
			footer={
				<FormFooter
					formId="announcement-form"
					isPending={isPending}
					submitLabel={
						row
							? t("adminCommunity.announcements.form.submitEdit")
							: t("adminCommunity.announcements.form.submitCreate")
					}
					onCancel={() => onOpenChange(false)}
					hint={
						row ? (
							<span className="tnum font-mono">
								{t("adminCommunity.announcements.form.idHint", { id: row.id })}
							</span>
						) : (
							t("adminCommunity.announcements.form.requiredHint")
						)
					}
				/>
			}
		>
			<form id="announcement-form" className="space-y-4" onSubmit={submit}>
				<Field
					label={t("adminCommunity.announcements.form.titleLabel")}
					htmlFor="announcement-title"
					required
					error={error}
				>
					<Input
						id="announcement-title"
						value={title}
						aria-invalid={Boolean(error)}
						onChange={(event) => setTitle(event.target.value)}
						placeholder={t("adminCommunity.announcements.form.titlePlaceholder")}
					/>
				</Field>
				<Field
					label={t("adminCommunity.announcements.form.contentLabel")}
					htmlFor="announcement-content"
					hint={t("adminCommunity.announcements.form.contentHint")}
				>
					<Textarea
						id="announcement-content"
						value={content}
						onChange={(event) => setContent(event.target.value)}
						placeholder={t("adminCommunity.announcements.form.contentPlaceholder")}
						className="min-h-48 resize-y"
					/>
				</Field>
			</form>
		</FormSheet>
	);
}
