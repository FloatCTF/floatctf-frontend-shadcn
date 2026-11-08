/**
 * 赛事控制台 · 公告标签（event_announcements）。
 *
 * SDK 的四个方法**全部柯里化**（第一层 `eventId`）：
 * `fetch(eventId)({page,limit})`、`create(eventId)(body)`、`patch(eventId)(announcement)`、
 * `remove(eventId)(id_list)`；其中 `patch` 的 URL 用 `announcement.id` 拼接，因此**必须带 id**。
 *
 * 文案全部走 `adminEvents.announcements` 命名空间；公告标题 / 正文是用户数据，不翻译。
 */

import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, MoreHorizontal, PencilLine, Plus, Trash2 } from "lucide-react";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { useConfirm } from "~/components/app/confirm";
import type { DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormSheet } from "~/components/app/form";
import { MarkdownEditor, MarkdownView } from "~/components/app/markdown";
import { MonoText, SectionCard, Toolbar } from "~/components/app/page";
import { EmptyBlock, InlineError } from "~/components/app/states";
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
import type { EventAnnouncements } from "@floatctf/sdk/entity";
import { formatDateTime } from "~/lib/format";

import { clientPageCount, clientPaged, MobileFacts, PagedTable } from "./shared";

export function EventAnnouncementsTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [editing, setEditing] = useState<{ announcement: EventAnnouncements | null } | null>(null);
	const [preview, setPreview] = useState<EventAnnouncements | null>(null);

	const query = useQuery({
		queryKey: qk.admin.eventAnnouncements(eventId),
		// 该 query key 不含分页参数（`qk.admin.eventAnnouncements(eventId)`）→ 一次取全量，
		// 由 `PagedTable` + `clientPaged` 做客户端分页。
		queryFn: () =>
			callList<EventAnnouncements>(client.admin.event_announcements.fetch(eventId)()),
	});

	const total = query.data?.meta?.total ?? query.data?.items.length ?? 0;
	const safePage = Math.min(page, clientPageCount(total, pageSize));
	const pagedQuery = clientPaged(query, safePage, pageSize);

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventAnnouncements(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.eventLogs(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.announcements.all });
	}

	const remove = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(
				client.admin.event_announcements.remove(eventId)(ids),
				t("adminEvents.actions.deleteAnnouncement"),
			),
		onSuccess: (count) => {
			toast.success(t("adminEvents.announcements.toast.deleteSuccess", { count }));
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminEvents.announcements.toast.deleteFailed"), error),
	});

	async function confirmRemove(row: EventAnnouncements) {
		const ok = await confirm({
			title: t("adminEvents.announcements.confirmRemove.title", { name: row.title }),
			description: t("adminEvents.announcements.confirmRemove.description"),
			consequences: [
				t("adminEvents.announcements.confirmRemove.consequence1"),
				t("adminEvents.announcements.confirmRemove.consequence2"),
			],
			tone: "danger",
			confirmText: t("adminEvents.announcements.confirmRemove.confirm"),
		});
		if (!ok) return;
		remove.mutate([row.id]);
	}

	const columns: DataTableColumn<EventAnnouncements>[] = [
		{
			id: "title",
			header: t("adminEvents.announcements.columns.title"),
			cell: (row) => <span className="font-medium">{row.title}</span>,
			sortValue: (row) => row.title,
		},
		{
			id: "content",
			header: t("adminEvents.announcements.columns.content"),
			cell: (row) => (
				<button
					type="button"
					className="line-clamp-2 max-w-md text-left text-sm text-muted-foreground underline-offset-4 hover:underline"
					onClick={() => setPreview(row)}
				>
					{row.content}
				</button>
			),
		},
		{
			id: "created_at",
			header: t("adminEvents.announcements.columns.createdAt"),
			cell: (row) => <MonoText className="whitespace-nowrap">
				{formatDateTime(row.created_at, { seconds: true })}
			</MonoText>,
			sortValue: (row) => row.created_at,
			hideBelow: "md",
		},
	];

	const rowActions = (row: EventAnnouncements): ReactNode => {
		const actionsLabel = t("adminEvents.announcements.row.actions", { name: row.title });
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label={actionsLabel} title={actionsLabel}>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuLabel className="max-w-56 truncate">{row.title}</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => setPreview(row)}>{t("common.view")}</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setEditing({ announcement: row })}>
						<PencilLine /> {t("common.edit")}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem variant="destructive" onSelect={() => void confirmRemove(row)}>
						<Trash2 /> {t("common.delete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		);
	};

	const mobileCard = (row: EventAnnouncements): ReactNode => (
		<div className="space-y-2">
			<MobileFacts
				items={[
					{
						k: t("adminEvents.announcements.mobile.title"),
						v: <span className="font-medium">{row.title}</span>,
					},
					{
						k: t("adminEvents.announcements.mobile.createdAt"),
						v: <MonoText>{formatDateTime(row.created_at)}</MonoText>,
					},
					{
						k: t("adminEvents.announcements.mobile.content"),
						v: <span className="line-clamp-3 text-xs">{row.content}</span>,
					},
				]}
			/>
			<div className="flex justify-end">{rowActions(row)}</div>
		</div>
	);

	return (
		<SectionCard
			title={t("adminEvents.announcements.title")}
			description={t("adminEvents.announcements.description")}
			actions={
				<Toolbar>
					<Button size="sm" onClick={() => setEditing({ announcement: null })}>
						<Plus /> {t("adminEvents.announcements.publishButton")}
					</Button>
				</Toolbar>
			}
		>
			<PagedTable
				query={pagedQuery}
				columns={columns}
				getRowId={(row) => row.id}
				page={safePage}
				pageSize={pageSize}
				total={total}
				onPageChange={setPage}
				onPageSizeChange={(size) => {
					setPageSize(size);
					setPage(1);
				}}
				rowActions={rowActions}
				mobileCard={mobileCard}
				errorTitle={t("adminEvents.announcements.loadError")}
				empty={
					<EmptyBlock
						title={t("adminEvents.announcements.empty.title")}
						description={t("adminEvents.announcements.empty.description")}
						icon={<Megaphone className="size-6" />}
						action={
							<Button size="sm" onClick={() => setEditing({ announcement: null })}>
								<Plus /> {t("adminEvents.announcements.publishButton")}
							</Button>
						}
					/>
				}
			/>

			{editing ? (
				<AnnouncementSheet
					eventId={eventId}
					announcement={editing.announcement}
					onClose={() => setEditing(null)}
					onDone={invalidate}
				/>
			) : null}

			{preview ? (
				<FormSheet
					open
					onOpenChange={(next) => {
						if (!next) setPreview(null);
					}}
					width="lg"
					title={preview.title}
					description={t("adminEvents.announcements.preview.publishedAt", {
						time: formatDateTime(preview.created_at, { seconds: true }),
					})}
				>
					<MarkdownView>{preview.content}</MarkdownView>
				</FormSheet>
			) : null}
		</SectionCard>
	);
}

/* ── 新建 / 编辑公告 ────────────────────────────────────────────────────── */

function AnnouncementSheet({
	eventId,
	announcement,
	onClose,
	onDone,
}: {
	eventId: string;
	announcement: EventAnnouncements | null;
	onClose: () => void;
	onDone: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const formId = useId();
	const [title, setTitle] = useState(announcement?.title ?? "");
	const [content, setContent] = useState(announcement?.content ?? "");
	const [error, setError] = useState<string | null>(null);

	const save = useMutation({
		mutationFn: () => {
			if (announcement === null) {
				return call(
					client.admin.event_announcements.create(eventId)({
						title: title.trim(),
						content,
					}),
					t("adminEvents.actions.publishAnnouncement"),
				);
			}
			// `patch` 用 `announcement.id` 拼 URL —— 必须带 id。
			return call(
				client.admin.event_announcements.patch(eventId)({
					id: announcement.id,
					title: title.trim(),
					content,
				}),
				t("adminEvents.actions.saveAnnouncement"),
			);
		},
		onSuccess: () => {
			toast.success(
				announcement === null
					? t("adminEvents.announcements.toast.publishSuccess")
					: t("adminEvents.announcements.toast.updateSuccess"),
			);
			onDone();
			onClose();
		},
		onError: (mutationError) =>
			toast.apiError(t("adminEvents.announcements.toast.saveFailed"), mutationError),
	});

	return (
		<FormSheet
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			width="lg"
			title={
				announcement === null
					? t("adminEvents.announcements.editor.createTitle")
					: t("adminEvents.announcements.editor.editTitle")
			}
			description={t("adminEvents.announcements.editor.description")}
			footer={
				<FormFooter
					formId={formId}
					onCancel={onClose}
					isPending={save.isPending}
					submitLabel={
						announcement === null
							? t("adminEvents.announcements.editor.submitCreate")
							: t("adminEvents.announcements.editor.submitUpdate")
					}
				/>
			}
		>
			<form
				id={formId}
				className="space-y-4"
				onSubmit={(submitEvent) => {
					submitEvent.preventDefault();
					if (title.trim() === "") {
						setError(t("adminEvents.announcements.editor.titleRequired"));
						return;
					}
					setError(null);
					save.mutate();
				}}
			>
				<Field
					label={t("adminEvents.announcements.editor.titleLabel")}
					htmlFor={`${formId}-title`}
					required
					error={error}
				>
					<Input
						id={`${formId}-title`}
						value={title}
						maxLength={200}
						onChange={(changeEvent) => setTitle(changeEvent.target.value)}
						placeholder={t("adminEvents.announcements.editor.titlePlaceholder")}
					/>
				</Field>
				<Field
					label={t("adminEvents.announcements.editor.contentLabel")}
					hint={t("adminEvents.announcements.editor.contentHint")}
				>
					<MarkdownEditor value={content} onChange={setContent} allowUpload={false} minHeight={240} />
				</Field>
				{save.isError ? <InlineError error={save.error} /> : null}
			</form>
		</FormSheet>
	);
}
