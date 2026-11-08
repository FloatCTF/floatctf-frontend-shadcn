/**
 * 管理端 · 讨论治理（`/admin/community/discussions`）。
 *
 * 真实接口：`client.admin.discussions.fetch/get/remove/getComments/removeComment`。
 * 后端语义（`apps/api/src/modules/community/discussion/{admin.rs,dto.rs}`）：
 * - 列表返回 `DiscussionWithAuthor`（`#[serde(flatten)]` 展平）—— 除 `Discussions`
 *   字段外还带 `author_nickname` / `author_avatar` / `is_liked`；
 * - 列表 `filter` 只映射 `id` / `title` / `author_id`；
 * - 详情 `get` 只返回讨论本体（不含作者）；评论列表支持 `page` / `limit`。
 * - 删除讨论会级联删除全部评论；删除评论会级联删除其回复（`parent_id` ON DELETE CASCADE）。
 */

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	Eye,
	FileText,
	MessageSquare,
	MessagesSquare,
	MoreHorizontal,
	RefreshCw,
	Trash2,
} from "lucide-react";

import type { DiscussionComments, Discussions } from "@floatctf/sdk/entity";

import { call, callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MarkdownView } from "~/components/app/markdown";
import {
	CopyText,
	MonoText,
	PageBody,
	PageHeader,
	PaginationBar,
	SectionCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	ErrorBlock,
	LoadingBlock,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { AbsoluteTime, RelativeTime, UserAvatar } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/components/ui/sheet";
import { Separator } from "~/components/ui/separator";
import { formatInt, truncate } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import {
	DeleteSelectedButton,
	SearchInput,
	sanitizeFilterValue,
	useListState,
} from "./components";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** 后端 `DiscussionWithAuthor` 的展平形态（SDK 类型只声明了 `Discussions`）。 */
type DiscussionRow = Discussions & {
	author_nickname?: string;
	author_avatar?: string | null;
	is_liked?: boolean;
};

export function AdminDiscussionsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCommunity.discussions.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const list = useListState(20);
	const [selected, setSelected] = useState<string[]>([]);
	const [openId, setOpenId] = useState<string | null>(null);

	const filter = list.filter;
	// 后端 filter 只映射 id/title/author_id：正文搜索不可用，这里只搜标题。
	const keyword = sanitizeFilterValue(filter);
	const remoteFilter = keyword.length === 0 ? undefined : `title:${keyword}`;

	useEffect(() => {
		setSelected([]);
	}, [list.page, filter]);

	const query = useQuery({
		queryKey: qk.admin.discussions({
			page: list.page,
			limit: list.pageSize,
			...(remoteFilter ? { filter: remoteFilter } : {}),
		}),
		queryFn: () =>
			callList<DiscussionRow>(
				client.admin.discussions.fetch({
					page: list.page,
					limit: list.pageSize,
					...(remoteFilter ? { filter: remoteFilter } : {}),
				}),
			),
		placeholderData: keepPreviousData,
	});

	const removeMutation = useMutation({
		mutationFn: (ids: string[]) =>
			callVoid(client.admin.discussions.remove(ids), t("adminCommunity.discussions.requests.delete")),
		onSuccess: (_data, ids) => {
			toast.success(t("adminCommunity.discussions.toasts.deleted", { count: ids.length }));
			setSelected([]);
			void queryClient.invalidateQueries({ queryKey: qk.admin.discussions() });
			void queryClient.invalidateQueries({ queryKey: qk.discussions.all });
		},
		onError: (error) => toast.apiError(t("adminCommunity.discussions.toasts.deleteFailed"), error),
	});

	async function removeRows(rows: DiscussionRow[]) {
		if (rows.length === 0) return;
		const titles = rows
			.slice(0, 3)
			.map((row) => row.title)
			.join(t("adminCommunity.common.listSeparator"));
		const ok = await confirm({
			title:
				rows.length === 1
					? t("adminCommunity.discussions.confirm.deleteTitleSingle")
					: t("adminCommunity.discussions.confirm.deleteTitleMany", { count: rows.length }),
			description:
				rows.length === 1
					? rows[0].title
					: rows.length > 3
						? t("adminCommunity.discussions.confirm.descriptionManyMore", {
								titles,
								count: rows.length,
							})
						: t("adminCommunity.discussions.confirm.descriptionMany", { titles }),
			consequences: [
				t("adminCommunity.discussions.confirm.consequenceContent"),
				t("adminCommunity.discussions.confirm.consequenceIrreversible"),
			],
			tone: "danger",
			confirmText: t("adminCommunity.discussions.confirm.confirm"),
		});
		if (!ok) return;
		removeMutation.mutate(rows.map((row) => row.id));
	}

	const columns: DataTableColumn<DiscussionRow>[] = [
		{
			id: "id",
			header: t("adminCommunity.discussions.columns.id"),
			sortValue: (row) => row.id,
			cell: (row) => <MonoText className="text-xs text-muted-foreground">{row.id}</MonoText>,
			hideBelow: "lg",
		},
		{
			id: "title",
			header: t("adminCommunity.discussions.columns.title"),
			sortValue: (row) => row.title,
			cell: (row) => <span className="text-sm font-medium">{row.title}</span>,
		},
		{
			id: "author",
			header: t("adminCommunity.discussions.columns.author"),
			sortValue: (row) => row.author_nickname ?? row.author_id,
			cell: (row) => (
				<div className="flex min-w-0 items-center gap-2">
					<UserAvatar
						name={row.author_nickname ?? row.author_id}
						avatar={row.author_avatar ?? undefined}
						size="sm"
					/>
					{row.author_nickname ? (
						<span className="truncate text-sm">{row.author_nickname}</span>
					) : (
						<MonoText className="truncate">{row.author_id}</MonoText>
					)}
				</div>
			),
		},
		{
			id: "view_count",
			header: t("adminCommunity.discussions.columns.views"),
			align: "right",
			sortValue: (row) => row.view_count,
			cell: (row) => <span className="tnum text-sm">{formatInt(row.view_count)}</span>,
			hideBelow: "md",
		},
		{
			id: "like_count",
			header: t("adminCommunity.discussions.columns.likes"),
			align: "right",
			sortValue: (row) => row.like_count,
			cell: (row) => <span className="tnum text-sm">{formatInt(row.like_count)}</span>,
			hideBelow: "md",
		},
		{
			id: "comment_count",
			header: t("adminCommunity.discussions.columns.comments"),
			align: "right",
			sortValue: (row) => row.comment_count,
			cell: (row) => <span className="tnum text-sm">{formatInt(row.comment_count)}</span>,
			hideBelow: "md",
		},
		{
			id: "created_at",
			header: t("adminCommunity.discussions.columns.createdAt"),
			sortValue: (row) => Date.parse(row.created_at),
			cell: (row) => <AbsoluteTime value={row.created_at} />,
			hideBelow: "lg",
		},
		{
			id: "updated_at",
			header: t("adminCommunity.discussions.columns.updatedAt"),
			sortValue: (row) => Date.parse(row.updated_at),
			cell: (row) => <AbsoluteTime value={row.updated_at} />,
			hideBelow: "xl",
		},
	];

	const total = query.data?.meta.total ?? query.data?.items.length ?? 0;

	return (
		<PageBody>
			<PageHeader
				title={t("adminCommunity.discussions.title")}
				description={t("adminCommunity.discussions.subtitle")}
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
					</Toolbar>
				}
			/>

			<SectionCard
				title={
					<span className="flex items-center gap-2">
						{t("adminCommunity.discussions.section.title")}
						{query.data ? (
							<MonoText className="text-muted-foreground">{formatInt(total)}</MonoText>
						) : null}
					</span>
				}
				description={t("adminCommunity.discussions.section.description")}
				contentClassName="px-0"
				footer={
					total > 0 && query.data ? (
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
						placeholder={t("adminCommunity.discussions.search.placeholder")}
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
					skeleton={<TableSkeleton rows={6} columns={4} />}
					errorTitle={t("adminCommunity.discussions.errors.load")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						keyword.length > 0 ? (
							<EmptyBlock
								className="mx-4"
								variant="filtered"
								title={t("adminCommunity.discussions.filtered.title")}
								description={t("adminCommunity.discussions.filtered.description", {
									query: keyword,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => list.setSearch("")}>
										{t("adminCommunity.discussions.filtered.clear")}
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
								title={t("adminCommunity.discussions.empty.title")}
								description={t("adminCommunity.discussions.empty.description")}
								icon={<MessagesSquare aria-hidden="true" />}
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
							onRowClick={(row) => setOpenId(row.id)}
							rowActions={(row) => (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={t("adminCommunity.discussions.rowActions.aria")}
											title={t("adminCommunity.discussions.rowActions.aria")}
										>
											<MoreHorizontal />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onSelect={() => setOpenId(row.id)}>
											<Eye />
											{t("adminCommunity.discussions.rowActions.view")}
										</DropdownMenuItem>
										<DropdownMenuItem
											variant="destructive"
											onSelect={() => void removeRows([row])}
										>
											<Trash2 />
											{t("adminCommunity.discussions.rowActions.delete")}
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
									<div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
										<UserAvatar
											name={row.author_nickname ?? row.author_id}
											avatar={row.author_avatar ?? undefined}
											size="sm"
										/>
										{row.author_nickname ? (
											<span className="truncate">{row.author_nickname}</span>
										) : (
											<MonoText className="truncate">{row.author_id}</MonoText>
										)}
									</div>
									<p className="tnum text-xs text-muted-foreground">
										{t("adminCommunity.discussions.interactions.mobile", {
											views: formatInt(row.view_count),
											likes: formatInt(row.like_count),
											comments: formatInt(row.comment_count),
										})}
									</p>
									<div className="flex items-center gap-1">
										<Button variant="ghost" size="sm" onClick={() => setOpenId(row.id)}>
											<Eye />
											{t("adminCommunity.discussions.rowActions.view")}
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="text-destructive"
											onClick={() => void removeRows([row])}
										>
											<Trash2 />
											{t("adminCommunity.discussions.rowActions.delete")}
										</Button>
									</div>
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>

			<DiscussionDetailSheet
				discussionId={openId}
				onOpenChange={(open) => {
					if (!open) setOpenId(null);
				}}
			/>
		</PageBody>
	);
}

/** 讨论详情抽屉：正文用 `<MarkdownView>` 渲染，并列出评论供逐条治理。 */
function DiscussionDetailSheet({
	discussionId,
	onOpenChange,
}: {
	discussionId: string | null;
	onOpenChange: (open: boolean) => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();

	const detail = useQuery({
		queryKey: qk.admin.discussion(discussionId ?? ""),
		queryFn: () => call<Discussions>(client.admin.discussions.get(discussionId ?? ""), t("adminCommunity.discussions.requests.detail")),
		enabled: discussionId !== null,
	});

	const comments = useQuery({
		queryKey: qk.admin.discussionComments(discussionId ?? ""),
		queryFn: () =>
			callList<DiscussionComments>(
				client.admin.discussions.getComments(discussionId ?? "", { page: 1, limit: 100 }),
			),
		enabled: discussionId !== null,
	});

	const removeComment = useMutation({
		mutationFn: (commentId: string) =>
			callVoid(
				client.admin.discussions.removeComment(discussionId ?? "", commentId),
				t("adminCommunity.discussions.requests.commentDelete"),
			),
		onSuccess: () => {
			toast.success(t("adminCommunity.discussions.detail.toasts.commentDeleted"));
			void queryClient.invalidateQueries({
				queryKey: qk.admin.discussionComments(discussionId ?? ""),
			});
			void queryClient.invalidateQueries({
				queryKey: qk.admin.discussion(discussionId ?? ""),
			});
			void queryClient.invalidateQueries({ queryKey: qk.admin.discussions() });
		},
		onError: (error) =>
			toast.apiError(t("adminCommunity.discussions.detail.toasts.commentDeleteFailed"), error),
	});

	async function deleteComment(comment: DiscussionComments) {
		const ok = await confirm({
			title: t("adminCommunity.discussions.detail.confirmComment.title"),
			description: truncate(comment.content, 120),
			consequences: [
				t("adminCommunity.discussions.detail.confirmComment.consequenceRemoved"),
				t("adminCommunity.discussions.detail.confirmComment.consequenceCascade"),
				t("adminCommunity.discussions.detail.confirmComment.consequenceCount"),
			],
			tone: "danger",
			confirmText: t("adminCommunity.discussions.detail.confirmComment.confirm"),
		});
		if (!ok) return;
		removeComment.mutate(comment.id);
	}

	return (
		<Sheet open={discussionId !== null} onOpenChange={onOpenChange}>
			<SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-3xl">
				<SheetHeader>
					<SheetTitle>
						{detail.data?.title ?? t("adminCommunity.discussions.detail.titleFallback")}
					</SheetTitle>
					<SheetDescription>
						{discussionId ? (
							<span className="inline-flex items-center gap-2">
								{t("adminCommunity.discussions.detail.idLabel")}
								<CopyText
									value={discussionId}
									label={t("adminCommunity.discussions.detail.idLabel")}
								/>
							</span>
						) : null}
					</SheetDescription>
				</SheetHeader>

				<div className="space-y-4 px-4 pb-6">
					{detail.isPending ? (
						<LoadingBlock label={t("adminCommunity.discussions.detail.loading")} />
					) : detail.isError ? (
						<ErrorBlock
							error={detail.error}
							title={t("adminCommunity.discussions.detail.loadFailed")}
							onRetry={() => void detail.refetch()}
						/>
					) : detail.data ? (
						<>
							<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<TonePill tone="neutral">
									{t("adminCommunity.discussions.detail.authorLabel")}{" "}
									<MonoText>{detail.data.author_id}</MonoText>
								</TonePill>
								<span className="tnum">
									{t("adminCommunity.discussions.detail.views", {
										count: formatInt(detail.data.view_count),
									})}
								</span>
								<span className="tnum">
									{t("adminCommunity.discussions.detail.likes", {
										count: formatInt(detail.data.like_count),
									})}
								</span>
								<span className="tnum">
									{t("adminCommunity.discussions.detail.comments", {
										count: formatInt(detail.data.comment_count),
									})}
								</span>
							</div>
							<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
								<span>
									{t("adminCommunity.discussions.detail.createdLabel")}{" "}
									<AbsoluteTime value={detail.data.created_at} seconds />
								</span>
								<span>
									{t("adminCommunity.discussions.detail.updatedLabel")}{" "}
									<RelativeTime value={detail.data.updated_at} />
								</span>
							</div>
							<Separator />
							<h3 className="flex items-center gap-2 text-sm font-semibold">
								<FileText className="size-4" aria-hidden="true" />
								{t("adminCommunity.discussions.detail.contentTitle")}
							</h3>
							<MarkdownView className="break-words">{detail.data.content}</MarkdownView>
						</>
					) : null}

					<Separator />

					<div className="space-y-2">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h3 className="flex items-center gap-2 text-sm font-semibold">
								<MessageSquare className="size-4" aria-hidden="true" />
								{t("adminCommunity.discussions.detail.commentsTitle")}
								{comments.data ? (
									<MonoText className="text-muted-foreground">
										{formatInt(comments.data.meta.total ?? comments.data.items.length)}
									</MonoText>
								) : null}
							</h3>
							<Button
								variant="outline"
								size="sm"
								onClick={() => void comments.refetch()}
								disabled={comments.isFetching}
							>
								<RefreshCw aria-hidden="true" />
								{t("adminCommunity.discussions.detail.commentsRefresh")}
							</Button>
						</div>

						{comments.isPending ? (
							<LoadingBlock label={t("adminCommunity.discussions.detail.commentsLoading")} />
						) : comments.isError ? (
							<ErrorBlock
								error={comments.error}
								title={t("adminCommunity.discussions.detail.commentsLoadFailed")}
								onRetry={() => void comments.refetch()}
							/>
						) : comments.data.items.length === 0 ? (
							<EmptyBlock
								title={t("adminCommunity.discussions.detail.commentsEmptyTitle")}
								description={t("adminCommunity.discussions.detail.commentsEmptyDescription")}
							/>
						) : (
							<ul className="divide-y">
								{comments.data.items.map((comment) => (
									<li key={comment.id} className="flex items-start justify-between gap-3 py-3">
										<div className="min-w-0 space-y-1">
											<p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
												<MonoText>{comment.author_id}</MonoText>
												<AbsoluteTime value={comment.created_at} seconds />
												{comment.parent_id ? (
													<TonePill tone="muted">
														{t("adminCommunity.discussions.detail.reply")}
													</TonePill>
												) : null}
											</p>
											<MarkdownView className="text-sm break-words">{comment.content}</MarkdownView>
										</div>
										<Button
											variant="ghost"
											size="icon-sm"
											className="text-destructive"
											aria-label={t("adminCommunity.discussions.detail.deleteCommentAria")}
											title={t("adminCommunity.discussions.detail.deleteCommentAria")}
											disabled={removeComment.isPending}
											onClick={() => void deleteComment(comment)}
										>
											<Trash2 />
										</Button>
									</li>
								))}
							</ul>
						)}
						{comments.data && (comments.data.meta.total ?? 0) > comments.data.items.length ? (
							<p className="text-xs text-muted-foreground">
								{t("adminCommunity.discussions.detail.commentsTruncated", {
									shown: formatInt(comments.data.items.length),
									total: formatInt(comments.data.meta.total ?? comments.data.items.length),
								})}
							</p>
						) : null}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
