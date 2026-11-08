/**
 * 讨论区 —— 列表（新建 / 编辑 / 删除）、我的讨论、详情（评论 CRUD + 点赞）。
 *
 * 业务语义对照 Default Frontend（只作行为参照，未复制其视觉）：
 * - 「我的讨论」用后端真实过滤参数 `filter: author_id:<me.id>`（GET /discussions 支持
 *   `id` / `title` / `author_id` 三个过滤键），不做客户端假过滤。
 * - 过滤串语法来自后端 `build_filter_condition`：**条件之间必须用 `&` 分隔**，
 *   否则后续条件会被并入前一个条件的值。
 * - 删除讨论会级联删除全部评论（`discussion_comments.discussion_id` ON DELETE CASCADE）；
 *   删除评论会级联删除其回复（`parent_id` ON DELETE CASCADE）——确认框里如实写明。
 */

import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	Eye,
	MessageSquare,
	MessagesSquare,
	Pencil,
	ThumbsUp,
	Trash2,
} from "lucide-react";

import type { DiscussionWithAuthor } from "@floatctf/sdk";
import type { Users } from "@floatctf/sdk/entity";

import { call, callList, callVoid } from "~/api/call";
import { isNotFound } from "~/api/errors";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { useMe } from "~/auth/store";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MarkdownView } from "~/components/app/markdown";
import {
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
	NotFoundBlock,
	QueryState,
	RefreshingBadge,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { RelativeTime, UserAvatar, UserCell } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { useDebouncedValue, useDocumentTitle } from "~/lib/hooks";

import {
	CommentCard,
	CommentComposer,
	DiscussionFormSheet,
	SearchField,
	buildCommentTree,
	type DiscussionComment,
} from "./components";

/** 删除讨论（列表 / 我的 / 详情共用）：`useConfirm` + 真实后果 + 失效全部讨论查询。 */
function useDeleteDiscussion() {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [pendingId, setPendingId] = useState<string | null>(null);

	const mutation = useMutation({
		mutationFn: (discussionId: string) =>
			callVoid(client.service.discussions.remove(discussionId), t("community.requests.discussionDelete")),
		onSuccess: (_data, discussionId) => {
			toast.success(t("community.discussions.toasts.discussionDeleted"));
			// 详情页删除后仍挂载着 detail/comments 查询：如果先 invalidate，
			// 会在跳转前重新请求已删除的 id，控制台留下 404。先移除再失效列表。
			queryClient.removeQueries({ queryKey: qk.discussions.detail(discussionId) });
			queryClient.removeQueries({ queryKey: qk.discussions.comments(discussionId) });
			void queryClient.invalidateQueries({ queryKey: qk.discussions.all });
		},
		onError: (error) =>
			toast.apiError(t("community.discussions.toasts.discussionDeleteFailed"), error),
		onSettled: () => setPendingId(null),
	});

	async function requestDelete(row: { id: string; title: string }): Promise<boolean> {
		const ok = await confirm({
			title: t("community.discussions.detail.deleteTitle"),
			description: row.title,
			consequences: [
				t("community.discussions.detail.deleteConsequences.content"),
				t("community.discussions.detail.deleteConsequences.visibility"),
			],
			tone: "danger",
			confirmText: t("community.discussions.detail.deleteConfirm"),
		});
		if (!ok) return false;
		setPendingId(row.id);
		mutation.mutate(row.id);
		return true;
	}

	return { requestDelete, pendingId, isPending: mutation.isPending };
}

/** 列表 / 我的：共用列定义（`mineId` 用于标记「我的」条目）。 */
function discussionColumns(
	t: TFunction,
	mineId: string | undefined,
): DataTableColumn<DiscussionWithAuthor>[] {
	return [
		{
			id: "title",
			header: t("community.discussions.table.title"),
			sortValue: (row) => row.title,
			cell: (row) => (
				<div className="flex min-w-0 items-center gap-2">
					<Link
						to={`/community/discussions/${row.id}`}
						className="truncate text-sm font-medium hover:underline"
					>
						{row.title}
					</Link>
					{mineId !== undefined && row.author_id === mineId ? (
						<TonePill tone="info">{t("community.discussions.table.mine")}</TonePill>
					) : null}
				</div>
			),
		},
		{
			id: "author",
			header: t("community.discussions.table.author"),
			hideBelow: "sm",
			sortValue: (row) => row.author_nickname,
			cell: (row) => (
				<UserCell
					username={row.author_nickname}
					nickname={row.author_nickname}
					avatar={row.author_avatar ?? null}
					secondary="none"
				/>
			),
		},
		{
			id: "stats",
			header: t("community.discussions.table.interactions"),
			align: "right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
					<span
						className="tnum inline-flex items-center gap-1"
						title={t("community.discussions.table.viewCount")}
						aria-label={t("community.discussions.table.viewCountAria", { count: row.view_count })}
					>
						<Eye aria-hidden="true" className="size-4" />
						{row.view_count}
					</span>
					<span
						className="tnum inline-flex items-center gap-1"
						title={t("community.discussions.table.likeCount")}
						aria-label={t("community.discussions.table.likeCountAria", { count: row.like_count })}
					>
						<ThumbsUp aria-hidden="true" className="size-4" />
						{row.like_count}
					</span>
					<span
						className="tnum inline-flex items-center gap-1"
						title={t("community.discussions.table.commentCount")}
						aria-label={t("community.discussions.table.commentCountAria", { count: row.comment_count })}
					>
						<MessageSquare aria-hidden="true" className="size-4" />
						{row.comment_count}
					</span>
				</div>
			),
		},
		{
			id: "created_at",
			header: t("community.discussions.table.createdAt"),
			hideBelow: "md",
			sortValue: (row) => row.created_at,
			cell: (row) => <RelativeTime value={row.created_at} />,
		},
		{
			id: "updated_at",
			header: t("community.discussions.table.updatedAt"),
			hideBelow: "lg",
			sortValue: (row) => row.updated_at,
			cell: (row) => <RelativeTime value={row.updated_at} />,
		},
	];
}

function discussionMobileCard(
	t: TFunction,
	row: DiscussionWithAuthor,
	mineId: string | undefined,
): ReactNode {
	return (
		<div className="space-y-1.5">
			<div className="flex items-start justify-between gap-2">
				<Link
					to={`/community/discussions/${row.id}`}
					className="text-sm font-medium hover:underline"
				>
					{row.title}
				</Link>
				{mineId !== undefined && row.author_id === mineId ? (
					<TonePill tone="info">{t("community.discussions.table.mine")}</TonePill>
				) : null}
			</div>
			<div className="flex items-center gap-2">
				<UserAvatar name={row.author_nickname} avatar={row.author_avatar ?? null} size="sm" />
				<span className="truncate text-xs text-muted-foreground">{row.author_nickname}</span>
			</div>
			<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
				<span className="tnum">
					{t("community.discussions.table.mobile.views", { count: row.view_count })}
				</span>
				<span className="tnum">
					{t("community.discussions.table.mobile.likes", { count: row.like_count })}
				</span>
				<span className="tnum">
					{t("community.discussions.table.mobile.comments", { count: row.comment_count })}
				</span>
				<RelativeTime value={row.updated_at} />
			</div>
		</div>
	);
}

/** 讨论区列表：全站讨论，支持按标题过滤与新建。 */
export function DiscussionsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("community.discussions.documentTitle"));
	const client = useClient();
	const me = useMe();
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [search, setSearch] = useState("");
	const [formOpen, setFormOpen] = useState(false);
	const debouncedSearch = useDebouncedValue(search, 300);
	const deleteAction = useDeleteDiscussion();
	const columns = discussionColumns(t, me?.id);

	const trimmed = debouncedSearch.trim();
	const filter = trimmed === "" ? undefined : `title:${trimmed}`;

	const query = useQuery({
		queryKey: qk.discussions.list({ page, limit: pageSize, filter }),
		queryFn: () =>
			callList<DiscussionWithAuthor>(
				client.service.discussions.fetch({ page, limit: pageSize, filter }),
			),
	});

	return (
		<PageBody>
			<PageHeader
				title={t("community.discussions.title")}
				description={t("community.discussions.subtitle")}
				actions={
					<Toolbar>
						<Button variant="outline" asChild>
							<Link to="/community/discussions/mine">
								<MessagesSquare aria-hidden="true" /> {t("community.discussions.actions.mine")}
							</Link>
						</Button>
						<Button onClick={() => setFormOpen(true)}>
							<Pencil aria-hidden="true" /> {t("community.discussions.actions.create")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("community.discussions.list.sectionTitle")}
				description={t("community.discussions.list.sectionDescription")}
				actions={
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						<SearchField
							value={search}
							placeholder={t("community.discussions.list.searchPlaceholder")}
							onChange={(value) => {
								setSearch(value);
								setPage(1);
							}}
						/>
					</Toolbar>
				}
				contentClassName="px-0"
				footer={
					<PaginationBar
						page={page}
						pageSize={pageSize}
						total={query.data?.meta.total ?? query.data?.items.length ?? 0}
						onPageChange={setPage}
						onPageSizeChange={(size) => {
							setPageSize(size);
							setPage(1);
						}}
					/>
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={5} />}
					errorTitle={t("community.discussions.list.loadError")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						trimmed === "" ? (
							<EmptyBlock
								title={t("community.discussions.list.emptyTitle")}
								description={t("community.discussions.list.emptyDescription")}
								icon={<MessagesSquare aria-hidden="true" />}
								action={
									<Button size="sm" onClick={() => setFormOpen(true)}>
										{t("community.discussions.actions.create")}
									</Button>
								}
							/>
						) : (
							<EmptyBlock
								variant="filtered"
								title={t("community.discussions.list.filteredTitle")}
								description={t("community.discussions.list.filteredDescription", {
									query: trimmed,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => setSearch("")}>
										{t("community.discussions.list.clearSearch")}
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
							onRowClick={(row) => void navigate(`/community/discussions/${row.id}`)}
							mobileCard={(row) => discussionMobileCard(t, row, me?.id)}
							rowActions={(row) => (
								<div className="flex items-center gap-1">
									<Button variant="ghost" size="sm" asChild>
										<Link to={`/community/discussions/${row.id}`}>
											{t("community.discussions.table.view")}
										</Link>
									</Button>
									{me !== null && row.author_id === me.id ? (
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={t("community.discussions.table.delete")}
											title={t("community.discussions.table.delete")}
											disabled={deleteAction.isPending}
											onClick={() => void deleteAction.requestDelete(row)}
										>
											<Trash2 aria-hidden="true" className="text-destructive" />
										</Button>
									) : null}
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>

			<DiscussionFormSheet open={formOpen} onOpenChange={setFormOpen} />
		</PageBody>
	);
}

/** 我的讨论：后端按 `author_id` 过滤（不是客户端过滤），支持发帖 / 编辑 / 删除闭环。 */
export function MyDiscussionsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("community.discussions.mine.documentTitle"));
	const client = useClient();
	const me = useMe();
	const navigate = useNavigate();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [search, setSearch] = useState("");
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState<{ id: string; title: string; content: string } | null>(
		null,
	);
	const debouncedSearch = useDebouncedValue(search, 300);
	const deleteAction = useDeleteDiscussion();

	// 本页必须知道当前账号 id 才能构造 `author_id` 过滤串。这里复用会话引导的
	// `qk.auth.me()`（同键共享缓存，不会重复请求），并显式处理它失败的情况，
	// 避免拿不到账号时永远停在加载态。
	const authQuery = useQuery({
		queryKey: qk.auth.me(),
		queryFn: () => call<Users>(client.service.users.getMe(), t("community.requests.currentAccount")),
	});
	const meId = me?.id ?? authQuery.data?.id;
	const columns = discussionColumns(t, meId);

	const trimmed = debouncedSearch.trim();
	// 条件之间用 `&` 分隔（后端解析规则），`author_id` 始终生效。
	const filterParts = [
		...(trimmed === "" ? [] : [`title:${trimmed}`]),
		...(meId ? [`author_id:${meId}`] : []),
	];
	const filter = filterParts.join(" & ");

	const query = useQuery({
		queryKey: qk.discussions.mine({ page, limit: pageSize, filter }),
		queryFn: () =>
			callList<DiscussionWithAuthor>(
				client.service.discussions.fetch({ page, limit: pageSize, filter }),
			),
		enabled: meId !== undefined,
	});

	return (
		<PageBody>
			<PageHeader
				title={t("community.discussions.mine.title")}
				description={t("community.discussions.mine.subtitle")}
				breadcrumbs={
					<Link
						to="/community/discussions"
						className="inline-flex items-center gap-1 hover:underline"
					>
						<ArrowLeft aria-hidden="true" className="size-4" />{" "}
						{t("community.discussions.mine.back")}
					</Link>
				}
				actions={
					<Toolbar>
						<Button onClick={() => setFormOpen(true)}>
							<Pencil aria-hidden="true" /> {t("community.discussions.actions.create")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("community.discussions.mine.sectionTitle")}
				description={t("community.discussions.mine.sectionDescription")}
				actions={
					<Toolbar>
						<RefreshingBadge active={query.isFetching && !query.isPending} />
						<SearchField
							value={search}
							placeholder={t("community.discussions.mine.searchPlaceholder")}
							onChange={(value) => {
								setSearch(value);
								setPage(1);
							}}
						/>
					</Toolbar>
				}
				contentClassName="px-0"
				footer={
					<PaginationBar
						page={page}
						pageSize={pageSize}
						total={query.data?.meta.total ?? query.data?.items.length ?? 0}
						onPageChange={setPage}
						onPageSizeChange={(size) => {
							setPageSize(size);
							setPage(1);
						}}
					/>
				}
			>
				{meId === undefined ? (
					authQuery.isError ? (
						<ErrorBlock
							error={authQuery.error}
							title={t("community.discussions.mine.accountError")}
							onRetry={() => void authQuery.refetch()}
						/>
					) : (
						<LoadingBlock label={t("community.discussions.mine.accountLoading")} />
					)
				) : (
					<QueryState
						query={query}
						skeleton={<TableSkeleton rows={5} columns={5} />}
						errorTitle={t("community.discussions.mine.loadError")}
						isEmpty={(result) => result.items.length === 0}
						empty={
							trimmed === "" ? (
								<EmptyBlock
									title={t("community.discussions.mine.emptyTitle")}
									description={t("community.discussions.mine.emptyDescription")}
									icon={<MessagesSquare aria-hidden="true" />}
									action={
										<Button size="sm" onClick={() => setFormOpen(true)}>
											{t("community.discussions.actions.create")}
										</Button>
									}
								/>
							) : (
								<EmptyBlock
									variant="filtered"
									description={t("community.discussions.mine.filteredDescription", {
										query: trimmed,
									})}
									action={
										<Button size="sm" variant="outline" onClick={() => setSearch("")}>
											{t("community.discussions.mine.clearSearch")}
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
								onRowClick={(row) => void navigate(`/community/discussions/${row.id}`)}
								mobileCard={(row) => discussionMobileCard(t, row, meId)}
								rowActions={(row) => (
									<div className="flex items-center gap-1">
										<Button variant="ghost" size="sm" asChild>
											<Link to={`/community/discussions/${row.id}`}>
												{t("community.discussions.table.view")}
											</Link>
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												setEditing({ id: row.id, title: row.title, content: row.content })
											}
										>
											<Pencil aria-hidden="true" /> {t("community.discussions.detail.edit")}
										</Button>
										<Button
											variant="ghost"
											size="icon-sm"
											aria-label={t("community.discussions.table.delete")}
											title={t("community.discussions.table.delete")}
											disabled={deleteAction.isPending}
											onClick={() => void deleteAction.requestDelete(row)}
										>
											<Trash2 aria-hidden="true" className="text-destructive" />
										</Button>
									</div>
								)}
							/>
						)}
					</QueryState>
				)}
			</SectionCard>

			<DiscussionFormSheet open={formOpen} onOpenChange={setFormOpen} />
			<DiscussionFormSheet
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				discussion={editing ?? undefined}
			/>
		</PageBody>
	);
}

/** 讨论详情：左侧正文（Markdown），右侧评论流（`lg:grid-cols-[2fr_1fr]`）。 */
export function DiscussionDetailPage(): ReactNode {
	const { t } = useTranslation();
	const params = useParams<{ id: string }>();
	const discussionId = params.id ?? "";
	const client = useClient();
	const me = useMe();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [editOpen, setEditOpen] = useState(false);
	const [newComment, setNewComment] = useState("");
	const [submittingComment, setSubmittingComment] = useState(false);
	// 删除成功后详情仍在路由卸载前的一帧里：禁用查询，避免窗口焦点/失效触发
	// 对已删除 id 的重新请求（控制台 404）。
	const [deleted, setDeleted] = useState(false);

	const discussionQuery = useQuery({
		queryKey: qk.discussions.detail(discussionId),
		queryFn: () =>
			call<DiscussionWithAuthor>(client.service.discussions.get(discussionId), t("community.requests.discussionDetail")),
		enabled: discussionId !== "" && !deleted,
	});

	const commentsQuery = useQuery({
		queryKey: qk.discussions.comments(discussionId),
		// SDK 声明 `DiscussionComments[]`，后端实际返回 `CommentWithAuthor`（含作者昵称 / 头像）：
		// 用 `call<T>()` 的 `Promise<unknown>` 重载取真实 DTO（见报告 PUBLIC SDK GAP）。
		queryFn: () =>
			call<DiscussionComment[]>(
				client.service.discussions.getComments(discussionId),
				t("community.requests.commentList"),
			),
		enabled: discussionId !== "" && !deleted,
	});

	const discussion = discussionQuery.data;
	useDocumentTitle(
		discussion
			? t("community.discussions.detail.documentTitle", { title: discussion.title })
			: t("community.discussions.detail.documentTitleFallback"),
	);


	const like = useMutation({
		mutationFn: () => callVoid(client.service.discussions.like(discussionId), t("community.requests.like")),
		onSuccess: () => {
			toast.success(t("community.discussions.toasts.likeSuccess"));
			void queryClient.invalidateQueries({ queryKey: qk.discussions.detail(discussionId) });
		},
		onError: (error) =>
			toast.apiError(t("community.discussions.toasts.likeFailed"), error),
	});

	const unlike = useMutation({
		mutationFn: () => callVoid(client.service.discussions.unlike(discussionId), t("community.requests.unlike")),
		onSuccess: () => {
			toast.success(t("community.discussions.toasts.unlikeSuccess"));
			void queryClient.invalidateQueries({ queryKey: qk.discussions.detail(discussionId) });
		},
		onError: (error) =>
			toast.apiError(t("community.discussions.toasts.unlikeFailed"), error),
	});

	const createComment = useMutation({
		mutationFn: (input: { content: string; parent_id?: string }) =>
			call(client.service.discussions.createComment(discussionId, input), t("community.requests.commentCreate")),
		onSuccess: (_data, input) => {
			toast.success(
				input.parent_id
					? t("community.discussions.toasts.replyCreated")
					: t("community.discussions.toasts.commentCreated"),
			);
			if (!input.parent_id) setNewComment("");
			void queryClient.invalidateQueries({ queryKey: qk.discussions.comments(discussionId) });
			void queryClient.invalidateQueries({ queryKey: qk.discussions.detail(discussionId) });
		},
		onError: (error) =>
			toast.apiError(t("community.discussions.toasts.commentCreateFailed"), error),
	});

	const patchComment = useMutation({
		mutationFn: (input: { commentId: string; content: string }) =>
			call(
				client.service.discussions.patchComment(discussionId, input.commentId, {
					content: input.content,
				}),
				t("community.requests.commentUpdate"),
			),
		onSuccess: () => {
			toast.success(t("community.discussions.toasts.commentUpdated"));
			void queryClient.invalidateQueries({ queryKey: qk.discussions.comments(discussionId) });
		},
		onError: (error) =>
			toast.apiError(t("community.discussions.toasts.commentUpdateFailed"), error),
	});

	const deleteComment = useMutation({
		mutationFn: (commentId: string) =>
			callVoid(client.service.discussions.deleteComment(discussionId, commentId), t("community.requests.commentDelete")),
		onSuccess: () => {
			toast.success(t("community.discussions.toasts.commentDeleted"));
			void queryClient.invalidateQueries({ queryKey: qk.discussions.comments(discussionId) });
			void queryClient.invalidateQueries({ queryKey: qk.discussions.detail(discussionId) });
		},
		onError: (error) =>
			toast.apiError(t("community.discussions.toasts.commentDeleteFailed"), error),
	});

	const removeDiscussion = useMutation({
		mutationFn: () => callVoid(client.service.discussions.remove(discussionId), t("community.requests.discussionDelete")),
		onSuccess: () => {
			setDeleted(true);
			toast.success(t("community.discussions.toasts.discussionDeleted"));
			queryClient.removeQueries({ queryKey: qk.discussions.detail(discussionId) });
			queryClient.removeQueries({ queryKey: qk.discussions.comments(discussionId) });
			// 只失效列表 / 我的；不要失效 detail/comments，否则仍挂载的详情观察者
			// 会在跳转前重新请求已删除的 id（控制台 404）。
			void queryClient.invalidateQueries({ queryKey: ["discussions", "list"] });
			void queryClient.invalidateQueries({ queryKey: ["discussions", "mine"] });
			void navigate("/community/discussions/mine", { replace: true });
		},
		onError: (error) =>
			toast.apiError(t("community.discussions.toasts.discussionDeleteFailed"), error),
	});

	const isAuthor = me !== null && discussion !== undefined && discussion.author_id === me.id;

	async function handleCreateComment() {
		if (newComment.trim() === "") {
			toast.warning(t("community.discussions.comment.mustNotBeEmpty"));
			return;
		}
		setSubmittingComment(true);
		try {
			await createComment.mutateAsync({ content: newComment.trim() });
		} catch {
			// 失败原因已由 onError 的 toast.apiError 展示；这里保留输入内容不清空。
		} finally {
			setSubmittingComment(false);
		}
	}

	async function handleDeleteComment(commentId: string) {
		const ok = await confirm({
			title: t("community.discussions.comment.deleteTitle"),
			description: t("community.discussions.comment.deleteDescription"),
			consequences: [
				t("community.discussions.comment.deleteConsequences.comment"),
				t("community.discussions.comment.deleteConsequences.replies"),
			],
			tone: "danger",
			confirmText: t("community.discussions.comment.deleteConfirm"),
		});
		if (ok) deleteComment.mutate(commentId);
	}

	if (discussionQuery.isError && isNotFound(discussionQuery.error)) {
		return (
			<PageBody>
				<NotFoundBlock
					title={t("community.discussions.detail.notFoundTitle")}
					description={t("community.discussions.detail.notFoundDescription")}
					action={
						<Button asChild variant="outline">
							<Link to="/community/discussions">
								{t("community.discussions.detail.backToDiscussions")}
							</Link>
						</Button>
					}
				/>
			</PageBody>
		);
	}

	return (
		<PageBody>
			<PageHeader
				title={
					discussion?.title ?? t("community.discussions.detail.titleFallback")
				}
				description={
					discussion ? (
						<span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
							<span className="inline-flex items-center gap-1.5">
								<UserAvatar
									name={discussion.author_nickname}
									avatar={discussion.author_avatar ?? null}
									size="sm"
								/>
								<span className="text-foreground">{discussion.author_nickname}</span>
							</span>
							<span className="text-xs text-muted-foreground">
								{t("community.discussions.detail.postedLabel")}{" "}
								<RelativeTime value={discussion.created_at} />
							</span>
							<span className="text-xs text-muted-foreground">
								{t("community.discussions.detail.updatedLabel")}{" "}
								<RelativeTime value={discussion.updated_at} />
							</span>
						</span>
					) : (
						t("community.discussions.detail.subtitleFallback")
					)
				}
				breadcrumbs={
					<Link
						to="/community/discussions"
						className="inline-flex items-center gap-1 hover:underline"
					>
						<ArrowLeft aria-hidden="true" className="size-4" />{" "}
						{t("community.discussions.detail.back")}
					</Link>
				}
				actions={
					discussion ? (
						<Toolbar>
							<Button
								variant={discussion.is_liked ? "default" : "outline"}
								disabled={like.isPending || unlike.isPending}
								onClick={() => {
									if (discussion.is_liked) unlike.mutate();
									else like.mutate();
								}}
							>
								<ThumbsUp aria-hidden="true" />{" "}
								{discussion.is_liked
									? t("community.discussions.detail.liked")
									: t("community.discussions.detail.like")}{" "}
								<span className="tnum">{discussion.like_count}</span>
							</Button>
							{isAuthor ? (
								<Button variant="outline" onClick={() => setEditOpen(true)}>
									<Pencil aria-hidden="true" /> {t("community.discussions.detail.edit")}
								</Button>
							) : null}
							{isAuthor ? (
								<Button
									variant="destructive"
									disabled={removeDiscussion.isPending}
									onClick={async () => {
										const ok = await confirm({
											title: t("community.discussions.detail.deleteTitle"),
											description: discussion.title,
											consequences: [
												t("community.discussions.detail.deleteConsequences.content"),
												t("community.discussions.detail.deleteConsequences.visibility"),
											],
											tone: "danger",
											confirmText: t("community.discussions.detail.deleteConfirm"),
										});
										if (ok) removeDiscussion.mutate();
									}}
								>
									<Trash2 aria-hidden="true" /> {t("community.discussions.detail.delete")}
								</Button>
							) : null}
						</Toolbar>
					) : null
				}
			/>

			<QueryState
				query={discussionQuery}
				skeleton={<LoadingBlock label={t("community.discussions.detail.loadingDiscussion")} />}
				errorTitle={t("community.discussions.detail.loadError")}
			>
				{(data) => (
					<div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
						<SectionCard
							title={t("community.discussions.detail.contentTitle")}
							description={t("community.discussions.detail.contentStats", {
								// 缺字段时不要渲染成空白数字（旧版后端 / 部分契约）。
								views: data.view_count ?? 0,
								likes: data.like_count ?? 0,
								comments: data.comment_count ?? 0,
							})}
							contentClassName="space-y-3"
						>
							<div className="rounded-md border bg-muted/20 px-4 py-3">
								<MarkdownView>{data.content}</MarkdownView>
							</div>
							{data.updated_at !== data.created_at ? (
								<p className="text-xs text-muted-foreground">
									{t("community.discussions.detail.lastUpdatedLabel")}{" "}
									<RelativeTime value={data.updated_at} />
								</p>
							) : null}
						</SectionCard>

						<SectionCard
							title={t("community.discussions.detail.commentsTitle", {
								count: commentsQuery.data?.length ?? data.comment_count,
							})}
							description={t("community.discussions.detail.commentsDescription")}
							actions={
								<RefreshingBadge
									active={commentsQuery.isFetching && !commentsQuery.isPending}
								/>
							}
						>
							<div className="space-y-4">
								<CommentComposer
									value={newComment}
									onChange={setNewComment}
									onSubmit={() => void handleCreateComment()}
									isPending={submittingComment || createComment.isPending}
								/>

								<QueryState
									query={commentsQuery}
									skeleton={
										<LoadingBlock
											label={t("community.discussions.detail.loadingComments")}
										/>
									}
									errorTitle={t("community.discussions.detail.commentsLoadError")}
									isEmpty={(list) => list.length === 0}
									empty={
										<EmptyBlock
											title={t("community.discussions.detail.commentsEmptyTitle")}
											description={t(
												"community.discussions.detail.commentsEmptyDescription",
											)}
										/>
									}
								>
									{(list) => (
										<div className="space-y-1">
											{buildCommentTree(list).map((node) => (
												<CommentCard
													key={node.id}
													comment={node}
													depth={0}
													currentUserId={me?.id}
													onReply={(parentId, content) =>
														createComment
															.mutateAsync({ content, parent_id: parentId })
															.then(() => undefined)
													}
													onUpdate={(commentId, content) =>
														patchComment
															.mutateAsync({ commentId, content })
															.then(() => undefined)
													}
													onDelete={(commentId) => void handleDeleteComment(commentId)}
												/>
											))}
										</div>
									)}
								</QueryState>
							</div>
						</SectionCard>
					</div>
				)}
			</QueryState>

			{discussion ? (
				<DiscussionFormSheet
					open={editOpen}
					onOpenChange={setEditOpen}
					discussion={{
						id: discussion.id,
						title: discussion.title,
						content: discussion.content,
					}}
				/>
			) : null}
		</PageBody>
	);
}
