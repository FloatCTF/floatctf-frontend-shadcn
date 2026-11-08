/**
 * 管理端 · 武器库治理（`/admin/community/weapons`）。
 *
 * 真实接口：`client.admin.weapons.fetch/create/patch/remove` + 附件上传。
 *
 * 两个必须遵守的事实：
 * 1. `GET /api/admin/weapons` **忽略分页与过滤参数**、直接返回全部武器且不带 `meta`
 *    （`apps/api/src/modules/weapon/api.rs::get_weapons_admin`），
 *    因此搜索与分页在本页做客户端处理。
 * 2. 上传为 `POST /weapons/{id}/upload`，multipart 字段名 **`weapon`**；SDK 门面
 *    `weapons.upload(weapon_id, file)` 不暴露进度，因此走公共上传逃生舱
 *    `uploadFile({ scope: "admin", ... })`（axios 级 `onUploadProgress`）。
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ExternalLink,
	MoreHorizontal,
	Pencil,
	Plus,
	RefreshCw,
	Swords,
	Trash2,
	Upload,
} from "lucide-react";

import type { Weapons } from "@floatctf/sdk/entity/weapons";

import { call, callList, callVoid, uploadFile } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
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
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { formatInt, truncate } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import { DeleteSelectedButton, SearchInput, pageSlice, useListState } from "./components";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** 武器附件的同源公开地址（后端把 S3 key 存在 `file_url`，静态前缀为 `/public/`）。 */
function weaponFileHref(fileUrl: string): string {
	return `/public/${fileUrl.replace(/^\/+/, "")}`;
}

export function AdminWeaponsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCommunity.weapons.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const list = useListState(20);
	const [selected, setSelected] = useState<string[]>([]);
	const [editing, setEditing] = useState<Weapons | null | undefined>(undefined);

	const query = useQuery({
		queryKey: qk.admin.weapons({ all: true }),
		// 后端忽略 QueryParams 并返回全部：这里显式不带参数，避免"以为在服务端分页"。
		queryFn: () => callList<Weapons>(client.admin.weapons.fetch()),
	});

	const removeMutation = useMutation({
		mutationFn: (ids: string[]) =>
			callVoid(client.admin.weapons.remove(ids), t("adminCommunity.weapons.requests.delete")),
		onSuccess: (_data, ids) => {
			toast.success(t("adminCommunity.weapons.toasts.deleted", { count: ids.length }));
			setSelected([]);
			void queryClient.invalidateQueries({ queryKey: qk.admin.weapons() });
			void queryClient.invalidateQueries({ queryKey: qk.weapons.all });
		},
		onError: (error) => toast.apiError(t("adminCommunity.weapons.toasts.deleteFailed"), error),
	});

	async function removeRows(rows: Weapons[]) {
		if (rows.length === 0) return;
		const titles = rows
			.slice(0, 3)
			.map((row) => row.name)
			.join(t("adminCommunity.common.listSeparator"));
		const ok = await confirm({
			title:
				rows.length === 1
					? t("adminCommunity.weapons.confirm.deleteTitleSingle")
					: t("adminCommunity.weapons.confirm.deleteTitleMany", { count: rows.length }),
			description:
				rows.length === 1
					? rows[0].name
					: rows.length > 3
						? t("adminCommunity.weapons.confirm.descriptionManyMore", {
								titles,
								count: rows.length,
							})
						: t("adminCommunity.weapons.confirm.descriptionMany", { titles }),
			consequences: [
				t("adminCommunity.weapons.confirm.consequencePlayers"),
				t("adminCommunity.weapons.confirm.consequenceIrreversible"),
			],
			tone: "danger",
			confirmText: t("adminCommunity.weapons.confirm.confirm"),
		});
		if (!ok) return;
		removeMutation.mutate(rows.map((row) => row.id));
	}

	const all = query.data?.items ?? [];
	const keyword = list.filter.toLowerCase();
	const filtered = all.filter((row) => {
		if (keyword.length === 0) return true;
		return (
			row.name.toLowerCase().includes(keyword) ||
			row.category.toLowerCase().includes(keyword) ||
			(row.description ?? "").toLowerCase().includes(keyword)
		);
	});
	const visible = pageSlice(filtered, list.page, list.pageSize);

	useEffect(() => {
		setSelected([]);
	}, [list.page, list.filter]);

	const columns: DataTableColumn<Weapons>[] = [
		{
			id: "name",
			header: t("adminCommunity.weapons.columns.name"),
			sortValue: (row) => row.name,
			cell: (row) => <span className="text-sm font-medium">{row.name}</span>,
		},
		{
			id: "category",
			header: t("adminCommunity.weapons.columns.category"),
			sortValue: (row) => row.category,
			cell: (row) => <span className="text-sm">{row.category}</span>,
		},
		{
			id: "description",
			header: t("adminCommunity.weapons.columns.description"),
			hideBelow: "lg",
			cell: (row) => (
				<span className="text-sm text-muted-foreground">
					{truncate(row.description ?? "", 50) ||
						t("adminCommunity.weapons.mobile.noDescription")}
				</span>
			),
		},
		{
			id: "file",
			header: t("adminCommunity.weapons.columns.file"),
			cell: (row) =>
				row.has_file && row.file_url ? (
					<a
						href={weaponFileHref(row.file_url)}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex max-w-48 items-center gap-1 font-mono text-xs text-primary underline underline-offset-4"
						title={row.file_url}
						aria-label={t("adminCommunity.weapons.file.open", { name: row.name })}
					>
						<ExternalLink className="size-4" aria-hidden="true" />
						<span className="truncate">{truncate(row.file_url, 28)}</span>
					</a>
				) : row.has_file ? (
					<TonePill tone="warning">{t("adminCommunity.weapons.file.markedNoUrl")}</TonePill>
				) : (
					<BooleanPill
						value={false}
						trueText={t("adminCommunity.weapons.file.hasFile")}
						falseText={t("adminCommunity.weapons.file.noFile")}
					/>
				),
		},
		{
			id: "download_count",
			header: t("adminCommunity.weapons.columns.downloadCount"),
			align: "right",
			hideBelow: "sm",
			sortValue: (row) => row.download_count,
			cell: (row) => <MonoText>{formatInt(row.download_count)}</MonoText>,
		},
		{
			id: "updated_at",
			header: t("adminCommunity.weapons.columns.updatedAt"),
			align: "right",
			sortValue: (row) => Date.parse(row.updated_at),
			cell: (row) => <AbsoluteTime value={row.updated_at} />,
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("adminCommunity.weapons.title")}
				description={t("adminCommunity.weapons.subtitle")}
				badge={<TonePill tone="info">{t("adminCommunity.weapons.badge")}</TonePill>}
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
							{t("adminCommunity.weapons.actions.create")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={
					<span className="flex items-center gap-2">
						{t("adminCommunity.weapons.section.title")}
						{query.data ? (
							<MonoText className="text-muted-foreground">
								{formatInt(filtered.length)}
							</MonoText>
						) : null}
					</span>
				}
				description={t("adminCommunity.weapons.section.description")}
				contentClassName="px-0"
				footer={
					filtered.length > 0 ? (
						<PaginationBar
							page={list.page}
							pageSize={list.pageSize}
							total={filtered.length}
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
						placeholder={t("adminCommunity.weapons.search.placeholder")}
					/>
					<DeleteSelectedButton
						count={selected.length}
						isPending={removeMutation.isPending}
						onClick={() => void removeRows(all.filter((row) => selected.includes(row.id)))}
					/>
				</div>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={5} />}
					errorTitle={t("adminCommunity.weapons.errors.load")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							className="mx-4"
							title={t("adminCommunity.weapons.empty.title")}
							description={t("adminCommunity.weapons.empty.description")}
							icon={<Swords aria-hidden="true" />}
							action={
								<Button size="sm" onClick={() => setEditing(null)}>
									{t("adminCommunity.weapons.empty.action")}
								</Button>
							}
						/>
					}
				>
					{() =>
						filtered.length === 0 ? (
							<EmptyBlock
								className="mx-4"
								variant="filtered"
								title={t("adminCommunity.weapons.filtered.title")}
								description={t("adminCommunity.weapons.filtered.description", {
									query: list.filter,
								})}
								action={
									<Button size="sm" variant="outline" onClick={() => list.setSearch("")}>
										{t("adminCommunity.weapons.filtered.clear")}
									</Button>
								}
							/>
						) : visible.length === 0 ? (
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
							<DataTable
								data={visible}
								getRowId={(row) => row.id}
								columns={columns}
								selectable
								selectedIds={selected}
								onSelectionChange={setSelected}
								rowActions={(row) => (
									<div className="flex items-center gap-1">
										<WeaponUploadAction weapon={row} />
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon-sm"
													aria-label={t("adminCommunity.weapons.rowActions.aria")}
													title={t("adminCommunity.weapons.rowActions.aria")}
												>
													<MoreHorizontal />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onSelect={() => setEditing(row)}>
													<Pencil />
													{t("adminCommunity.weapons.rowActions.edit")}
												</DropdownMenuItem>
												{row.has_file && row.file_url ? (
													<DropdownMenuItem asChild>
														<a
															href={weaponFileHref(row.file_url)}
															target="_blank"
															rel="noopener noreferrer"
														>
															<ExternalLink />
															{t("adminCommunity.weapons.rowActions.openFile")}
														</a>
													</DropdownMenuItem>
												) : null}
												<DropdownMenuItem
													variant="destructive"
													onSelect={() => void removeRows([row])}
												>
													<Trash2 />
													{t("adminCommunity.weapons.rowActions.delete")}
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								)}
								mobileCard={(row) => (
									<div className="space-y-2">
										<div className="flex items-start justify-between gap-2">
											<span className="min-w-0 text-sm font-medium break-words">
												{row.name}
											</span>
											<AbsoluteTime value={row.updated_at} />
										</div>
										<p className="tnum text-xs text-muted-foreground">
											{t("adminCommunity.weapons.mobile.meta", {
												category: row.category,
												downloads: formatInt(row.download_count),
											})}
										</p>
										<p className="line-clamp-4 text-sm break-words text-muted-foreground">
											{truncate(row.description ?? "", 160) ||
												t("adminCommunity.weapons.mobile.noDescription")}
										</p>
										<div className="flex flex-wrap items-center gap-2">
											<WeaponUploadAction weapon={row} />
											<Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
												<Pencil />
												{t("adminCommunity.weapons.rowActions.edit")}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive"
												onClick={() => void removeRows([row])}
											>
												<Trash2 />
												{t("adminCommunity.weapons.rowActions.delete")}
											</Button>
										</div>
									</div>
								)}
							/>
						)
					}
				</QueryState>
			</SectionCard>

			<WeaponFormSheet
				open={editing !== undefined}
				row={editing ?? null}
				onOpenChange={(open) => {
					if (!open) setEditing(undefined);
				}}
			/>
		</PageBody>
	);
}

/** 行内上传附件：字段名 `weapon`，显示上传百分比。 */
function WeaponUploadAction({ weapon }: { weapon: Weapons }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const [percent, setPercent] = useState<number | null>(null);

	async function handleFile(file: File) {
		setPercent(0);
		try {
			await uploadFile({
				client,
				scope: "admin",
				url: `/weapons/${weapon.id}/upload`,
				field: "weapon",
				file,
				onProgress: setPercent,
			});
			toast.success(
				t("adminCommunity.weapons.upload.success"),
				t("adminCommunity.weapons.upload.successDescription", {
					weapon: weapon.name,
					file: file.name,
				}),
			);
			void queryClient.invalidateQueries({ queryKey: qk.admin.weapons() });
			void queryClient.invalidateQueries({ queryKey: qk.weapons.all });
		} catch (error) {
			toast.apiError(t("adminCommunity.weapons.upload.failed"), error);
		} finally {
			setPercent(null);
		}
	}

	const uploading = percent !== null;
	const title = weapon.has_file
		? t("adminCommunity.weapons.upload.titleReplace")
		: t("adminCommunity.weapons.upload.titleUpload");

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				className="hidden"
				disabled={uploading}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void handleFile(file);
				}}
			/>
			<Button
				variant="ghost"
				size="sm"
				disabled={uploading}
				onClick={() => inputRef.current?.click()}
				title={title}
				aria-label={title}
			>
				<Upload aria-hidden="true" />
				{uploading ? (
					<span className="tnum">
						{t("adminCommunity.weapons.upload.progress", { percent })}
					</span>
				) : (
					t("adminCommunity.weapons.upload.action")
				)}
			</Button>
		</>
	);
}

function WeaponFormSheet({
	open,
	row,
	onOpenChange,
}: {
	open: boolean;
	row: Weapons | null;
	onOpenChange: (open: boolean) => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [form, setForm] = useState({
		name: "",
		category: "",
		description: "",
		hasFile: false,
		fileUrl: "",
		downloadCount: 0,
	});
	const [errors, setErrors] = useState<{ name?: string; category?: string }>({});

	useEffect(() => {
		if (!open) return;
		setErrors({});
		setForm({
			name: row?.name ?? "",
			category: row?.category ?? "",
			description: row?.description ?? "",
			hasFile: row?.has_file ?? false,
			fileUrl: row?.file_url ?? "",
			downloadCount: row?.download_count ?? 0,
		});
	}, [open, row]);

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: qk.admin.weapons() });
		void queryClient.invalidateQueries({ queryKey: qk.weapons.all });
	}

	const createMutation = useMutation({
		mutationFn: (input: Partial<Weapons>) =>
			call(client.admin.weapons.create(input), t("adminCommunity.weapons.requests.create")),
		onSuccess: () => {
			toast.success(t("adminCommunity.weapons.toasts.created"));
			invalidate();
			onOpenChange(false);
		},
		onError: (error) => toast.apiError(t("adminCommunity.weapons.toasts.createFailed"), error),
	});

	const patchMutation = useMutation({
		mutationFn: (input: Partial<Weapons>) =>
			call(client.admin.weapons.patch(input), t("adminCommunity.weapons.requests.update")),
		onSuccess: () => {
			toast.success(t("adminCommunity.weapons.toasts.updated"));
			invalidate();
			onOpenChange(false);
		},
		onError: (error) => toast.apiError(t("adminCommunity.weapons.toasts.updateFailed"), error),
	});

	const isPending = createMutation.isPending || patchMutation.isPending;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const name = form.name.trim();
		const category = form.category.trim();
		const nextErrors: { name?: string; category?: string } = {};
		if (name.length === 0) nextErrors.name = t("adminCommunity.weapons.form.nameRequired");
		if (category.length === 0)
			nextErrors.category = t("adminCommunity.weapons.form.categoryRequired");
		setErrors(nextErrors);
		if (nextErrors.name || nextErrors.category) return;

		const payload: Partial<Weapons> = {
			name,
			category,
			description: form.description,
			has_file: form.hasFile,
			file_url: form.fileUrl.trim(),
			download_count: form.downloadCount,
		};
		if (row) patchMutation.mutate({ ...payload, id: row.id });
		else createMutation.mutate(payload);
	}

	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			title={
				row
					? t("adminCommunity.weapons.form.editTitle")
					: t("adminCommunity.weapons.form.createTitle")
			}
			description={t("adminCommunity.weapons.form.description")}
			width="lg"
			footer={
				<FormFooter
					formId="weapon-form"
					isPending={isPending}
					submitLabel={
						row
							? t("adminCommunity.weapons.form.submitEdit")
							: t("adminCommunity.weapons.form.submitCreate")
					}
					onCancel={() => onOpenChange(false)}
					hint={
						row ? (
							<span className="tnum font-mono">
								{t("adminCommunity.weapons.form.idHint", { id: row.id })}
							</span>
						) : (
							t("adminCommunity.weapons.form.requiredHint")
						)
					}
				/>
			}
		>
			<form id="weapon-form" className="space-y-4" onSubmit={submit}>
				<FormGrid columns={2}>
					<Field
						label={t("adminCommunity.weapons.form.nameLabel")}
						htmlFor="weapon-name"
						required
						error={errors.name}
					>
						<Input
							id="weapon-name"
							value={form.name}
							aria-invalid={Boolean(errors.name)}
							onChange={(event) => setForm({ ...form, name: event.target.value })}
						/>
					</Field>
					<Field
						label={t("adminCommunity.weapons.form.categoryLabel")}
						htmlFor="weapon-category"
						required
						error={errors.category}
					>
						<Input
							id="weapon-category"
							value={form.category}
							aria-invalid={Boolean(errors.category)}
							onChange={(event) => setForm({ ...form, category: event.target.value })}
							placeholder={t("adminCommunity.weapons.form.categoryPlaceholder")}
						/>
					</Field>
				</FormGrid>
				<Field
					label={t("adminCommunity.weapons.form.descriptionLabel")}
					htmlFor="weapon-description"
				>
					<Textarea
						id="weapon-description"
						value={form.description}
						onChange={(event) => setForm({ ...form, description: event.target.value })}
						className="min-h-32 resize-y"
					/>
				</Field>
				<FormGrid columns={2}>
					<Field
						label={t("adminCommunity.weapons.form.fileUrlLabel")}
						htmlFor="weapon-file-url"
						hint={t("adminCommunity.weapons.form.fileUrlHint")}
					>
						<Input
							id="weapon-file-url"
							className="font-mono text-xs"
							value={form.fileUrl}
							onChange={(event) => setForm({ ...form, fileUrl: event.target.value })}
						/>
					</Field>
					<Field
						label={t("adminCommunity.weapons.form.downloadCountLabel")}
						htmlFor="weapon-download-count"
						hint={t("adminCommunity.weapons.form.downloadCountHint")}
					>
						<Input
							id="weapon-download-count"
							type="number"
							min={0}
							className="tnum"
							value={String(form.downloadCount)}
							onChange={(event) =>
								setForm({ ...form, downloadCount: Number(event.target.value) || 0 })
							}
						/>
					</Field>
				</FormGrid>
				<Field
					label={t("adminCommunity.weapons.form.hasFileLabel")}
					htmlFor="weapon-has-file"
					hint={t("adminCommunity.weapons.form.hasFileHint")}
				>
					<div className="flex items-center gap-2">
						<Switch
							id="weapon-has-file"
							checked={form.hasFile}
							onCheckedChange={(checked) => setForm({ ...form, hasFile: checked })}
						/>
						<BooleanPill
							value={form.hasFile}
							trueText={t("adminCommunity.weapons.file.hasFile")}
							falseText={t("adminCommunity.weapons.file.noFile")}
						/>
					</div>
				</Field>
			</form>
		</FormSheet>
	);
}
