/**
 * 题集管理（`/admin/challenge-sets`）—— 列表 + Sheet 新建/编辑 + 批量删除。
 *
 * 题目与题集的关联在详情页维护（`/admin/challenge-sets/:setId`）：
 * SDK 的 `createChallengeSet` 只接受 `Partial<ChallengeSets>`（后端其实还接受
 * `challenge_id_list`，但公共类型面没有暴露），因此创建后进入详情页挂题。
 *
 * 所有用户可见文案走 `adminCore.challengeSets.*`。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Blocks, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import { call, callList, callVoid } from "~/api/call";
import { useAppQueryClient, useClient } from "~/api/client";
import { qk } from "~/api/keys";
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
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { formatDateTime } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";
import type { ChallengesListItem, QueryParams } from "@floatctf/sdk";
import type { ChallengeSets } from "@floatctf/sdk/entity";

import { BuildStatusPill, RowMenu, SearchInput, useAdminListState } from "./shared";

const SEARCH_KEYS = ["name", "description"];

interface SetFormState {
	name: string;
	description: string;
}

export function AdminChallengeSetsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCore.challengeSets.documentTitle"));
	const client = useClient();
	const queryClient = useAppQueryClient();
	const confirm = useConfirm();
	const list = useAdminListState(SEARCH_KEYS);

	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [editing, setEditing] = useState<{ mode: "create" | "edit"; row?: ChallengeSets } | null>(null);
	const [selectedSet, setSelectedSet] = useState<ChallengeSets | null>(null);
	const [form, setForm] = useState<SetFormState>({ name: "", description: "" });
	const [nameError, setNameError] = useState<string | undefined>(undefined);

	const params: QueryParams = {
		page: list.page,
		limit: list.pageSize,
		...(list.filter ? { filter: list.filter } : {}),
	};

	const query = useQuery({
		queryKey: qk.admin.challengeSets(params),
		queryFn: () => callList<ChallengeSets>(client.admin.challenges.getChallengeSets(params)),
	});

	function invalidate(): void {
		void queryClient.invalidateQueries({ queryKey: qk.admin.challengeSets() });
	}

	const save = useMutation({
		mutationFn: (input: { mode: "create" | "edit"; id?: string; body: SetFormState }) => {
			const body = { name: input.body.name.trim(), description: input.body.description };
			if (input.mode === "create") {
				// 后端 create 成功返回 data:null（ok_none），SDK 类型却标成 ChallengeSets；
				// 用 call 会把成功当成“没有返回数据”，导致弹失败但 DB 已创建。
				return callVoid(
					client.admin.challenges.createChallengeSet(body),
					t("adminCore.actions.createChallengeSet"),
				);
			}
			// patchChallengeSet(Partial<ChallengeSets>) 的 URL 用 `.id` 拼接，**必须**带 id。
			return callVoid(
				client.admin.challenges.patchChallengeSet({ id: input.id ?? "", ...body }),
				t("adminCore.actions.updateChallengeSet"),
			);
		},
		onSuccess: async (_data, input) => {
			toast.success(
				input.mode === "create"
					? t("adminCore.challengeSets.toasts.created")
					: t("adminCore.challengeSets.toasts.updated"),
			);
			invalidate();
			setEditing(null);
			setNameError(undefined);
			if (input.mode === "create") {
				// create 不返回新行；按名称回查最新一条后进入详情页（页面文案承诺创建后进入详情）。
				try {
					const { items } = await callList<ChallengeSets>(
						client.admin.challenges.getChallengeSets({
							filter: `name:${input.body.name.trim()}`,
							page: 1,
							limit: 1,
						}),
					);
					const created = items[0];
					if (created) setSelectedSet(created);
				} catch {
					// 回查失败不覆盖已成功的创建；用户仍可在列表点开题集。
				}
			}
		},
		onError: (error) => toast.apiError(t("adminCore.challengeSets.toasts.saveFailed"), error),
	});

	const remove = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(
				client.admin.challenges.deleteChallengeSet(ids),
				t("adminCore.actions.deleteChallengeSets"),
			),
		onSuccess: (count) => {
			toast.success(
				t("adminCore.challengeSets.toasts.deleted", { count }),
				t("adminCore.challengeSets.toasts.deletedDescription"),
			);
			invalidate();
			setSelectedIds([]);
		},
		onError: (error) => toast.apiError(t("adminCore.challengeSets.toasts.deleteFailed"), error),
	});

	function openCreate(): void {
		setForm({ name: "", description: "" });
		setNameError(undefined);
		setEditing({ mode: "create" });
	}

	function openEdit(row: ChallengeSets): void {
		setForm({ name: row.name, description: row.description ?? "" });
		setNameError(undefined);
		setEditing({ mode: "edit", row });
	}

	function submit(): void {
		if (!editing) return;
		if (!form.name.trim()) {
			setNameError(t("adminCore.challengeSets.validation.nameRequired"));
			toast.warning(t("adminCore.challengeSets.toasts.nameRequired"));
			return;
		}
		setNameError(undefined);
		save.mutate({ mode: editing.mode, id: editing.row?.id, body: form });
	}

	async function confirmRemoveOne(row: ChallengeSets): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.challengeSets.confirm.deleteOneTitle", { name: row.name }),
			description: t("adminCore.challengeSets.confirm.deleteDescription"),
			consequences: [
				t("adminCore.challengeSets.confirm.deleteConsequence1"),
				t("adminCore.challengeSets.confirm.deleteConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.challengeSets.confirm.delete"),
			confirmPhrase: row.name,
		});
		if (ok) remove.mutate([row.id]);
	}

	async function confirmRemoveSelected(): Promise<void> {
		if (selectedIds.length === 0) {
			toast.warning(t("adminCore.challengeSets.toasts.selectForDelete"));
			return;
		}
		const ok = await confirm({
			title: t("adminCore.challengeSets.confirm.deleteSelectedTitle", {
				count: selectedIds.length,
			}),
			description: t("adminCore.challengeSets.confirm.deleteDescription"),
			consequences: [
				t("adminCore.challengeSets.confirm.deleteSelectedConsequence1", {
					count: selectedIds.length,
				}),
				t("adminCore.challengeSets.confirm.deleteConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.challengeSets.confirm.delete"),
			confirmPhrase: "delete",
		});
		if (ok) remove.mutate(selectedIds);
	}

	const columns: DataTableColumn<ChallengeSets>[] = [
		{
			id: "name",
			header: t("adminCore.challengeSets.columns.set"),
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{row.name}</p>
					<MonoText className="text-muted-foreground">{row.id}</MonoText>
				</div>
			),
			sortValue: (row) => row.name,
		},
		{
			id: "description",
			header: t("adminCore.challengeSets.columns.description"),
			cell: (row) =>
				row.description ? (
					<span className="line-clamp-2 text-sm text-muted-foreground">{row.description}</span>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				),
			hideBelow: "sm",
		},
		{
			id: "created_at",
			header: t("adminCore.challengeSets.columns.createdAt"),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
			),
			sortValue: (row) => Date.parse(row.created_at),
			hideBelow: "md",
		},
		{
			id: "updated_at",
			header: t("adminCore.challengeSets.columns.updatedAt"),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">{formatDateTime(row.updated_at)}</span>
			),
			sortValue: (row) => Date.parse(row.updated_at),
			hideBelow: "lg",
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("adminCore.challengeSets.title")}
				description={t("adminCore.challengeSets.description")}
				actions={
					<Toolbar>
						<Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
							<RefreshCw
								className={query.isFetching ? "animate-spin" : undefined}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</Button>
						<Button onClick={openCreate}>
							<Plus aria-hidden="true" /> {t("adminCore.challengeSets.new")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminCore.challengeSets.listTitle")}
				description={t("adminCore.challengeSets.listDescription")}
				actions={
					<Toolbar>
						<SearchInput
							value={list.search}
							onChange={list.setSearch}
							placeholder={t("adminCore.challengeSets.searchPlaceholder")}
						/>
						{selectedIds.length > 0 ? (
							<Button
								variant="destructive"
								size="sm"
								onClick={() => void confirmRemoveSelected()}
								disabled={remove.isPending}
							>
								<Trash2 aria-hidden="true" />{" "}
								{t("adminCore.challengeSets.deleteSelected", { count: selectedIds.length })}
							</Button>
						) : null}
					</Toolbar>
				}
				contentClassName="p-0"
				footer={
					// 数据到位前不渲染分页条，避免出现「共 0 条」这种与事实不符的文案。
					query.data ? (
						<PaginationBar
							page={list.page}
							pageSize={list.pageSize}
							total={query.data.meta?.total ?? 0}
							onPageChange={list.setPage}
							onPageSizeChange={list.setPageSize}
						/>
					) : null
				}
			>
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={6} columns={4} />}
					errorTitle={t("adminCore.challengeSets.error")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						list.filter ? (
							<EmptyBlock
								variant="filtered"
								title={t("adminCore.challengeSets.filtered.title")}
								description={t("adminCore.challengeSets.filtered.description", {
									query: list.search,
								})}
							/>
						) : (
							<EmptyBlock
								title={t("adminCore.challengeSets.empty.title")}
								description={t("adminCore.challengeSets.empty.description")}
								action={
									<Button size="sm" onClick={openCreate}>
										<Plus aria-hidden="true" /> {t("adminCore.challengeSets.new")}
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
							selectedIds={selectedIds}
							onSelectionChange={setSelectedIds}
							onRowClick={(row) => setSelectedSet(row)}
							mobileCard={(row) => (
								<div className="space-y-1.5">
									<p className="text-sm font-medium">{row.name}</p>
									<p className="text-xs text-muted-foreground">
										{row.description || t("adminCore.common.noDescription")}
									</p>
									<div className="flex flex-wrap gap-2 pt-1">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setSelectedSet(row)}
										>
											<Blocks aria-hidden="true" />{" "}
											{t("adminCore.challengeSets.manageChallenges")}
										</Button>
										<Button variant="outline" size="sm" onClick={() => openEdit(row)}>
											<Pencil aria-hidden="true" /> {t("common.edit")}
										</Button>
										<Button
											variant="destructive"
											size="sm"
											onClick={() => void confirmRemoveOne(row)}
										>
											<Trash2 aria-hidden="true" /> {t("common.delete")}
										</Button>
									</div>
								</div>
							)}
							rowActions={(row) => (
								<RowMenu
									label={t("adminCore.challengeSets.rowMenu", { name: row.name })}
								>
									<DropdownMenuItem onSelect={() => setSelectedSet(row)}>
										<Blocks aria-hidden="true" />{" "}
										{t("adminCore.challengeSets.manageChallenges")}
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => openEdit(row)}>
										<Pencil aria-hidden="true" /> {t("common.edit")}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										variant="destructive"
										onSelect={() => void confirmRemoveOne(row)}
									>
										<Trash2 aria-hidden="true" /> {t("common.delete")}
									</DropdownMenuItem>
								</RowMenu>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>

			<AdminChallengeSetDialog
				set={selectedSet}
				onOpenChange={(open) => {
					if (!open) setSelectedSet(null);
				}}
			/>

			<FormSheet
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				title={
					editing?.mode === "edit"
						? t("adminCore.challengeSets.sheet.editTitle")
						: t("adminCore.challengeSets.sheet.createTitle")
				}
				description={
					editing?.mode === "edit"
						? t("adminCore.challengeSets.sheet.editDescription")
						: t("adminCore.challengeSets.sheet.createDescription")
				}
				width="md"
				footer={
					<FormFooter
						onCancel={() => setEditing(null)}
						submitLabel={
							editing?.mode === "edit"
								? t("adminCore.challengeSets.sheet.submitSave")
								: t("adminCore.challengeSets.sheet.submitCreate")
						}
						isPending={save.isPending}
						formId="admin-set-form"
					/>
				}
			>
				<form
					id="admin-set-form"
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<FormGrid columns={1}>
						<Field
							label={t("adminCore.challengeSets.sheet.name")}
							htmlFor="set-name"
							required
							error={nameError}
						>
							<Input
								id="set-name"
								value={form.name}
								onChange={(event) => setForm({ ...form, name: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.challengeSets.sheet.description")}
							htmlFor="set-description"
							hint={t("adminCore.challengeSets.sheet.descriptionHint")}
						>
							<Textarea
								id="set-description"
								rows={3}
								value={form.description}
								onChange={(event) => setForm({ ...form, description: event.target.value })}
							/>
						</Field>
					</FormGrid>
					{editing?.mode === "create" ? (
						<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<ArrowRight className="size-4" aria-hidden="true" />
							{t("adminCore.challengeSets.sheet.createHint")}
						</p>
					) : null}
				</form>
			</FormSheet>
		</PageBody>
	);
}


function AdminChallengeSetDialog({
	set,
	onOpenChange,
}: {
	set: ChallengeSets | null;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useAppQueryClient();
	const confirm = useConfirm();
	const setId = set?.id ?? "";
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [picked, setPicked] = useState<string[]>([]);
	const picker = useAdminListState(["name", "safe_name", "category"]);

	const items = useQuery({
		queryKey: [...qk.admin.challengeSet(setId), "dialog"],
		queryFn: () =>
			callList<ChallengesListItem>(
				client.admin.challenges.getChallengeSet(setId)({ page: 1, limit: 200 }),
			),
		enabled: setId !== "",
	});
	const pickerParams: QueryParams = {
		page: picker.page,
		limit: picker.pageSize,
		...(picker.filter ? { filter: picker.filter } : {}),
	};
	const pickerQuery = useQuery({
		queryKey: qk.admin.challenges(pickerParams),
		queryFn: () => callList<ChallengesListItem>(client.admin.challenges.fetch(pickerParams)),
		enabled: pickerOpen,
	});

	function invalidate(): void {
		void queryClient.invalidateQueries({ queryKey: qk.admin.challengeSet(setId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.challengeSets() });
	}

	const add = useMutation({
		mutationFn: (ids: string[]) =>
			callVoid(
				client.admin.challenges.addChallengeToSet({ set_id: setId, challenge_id_list: ids }),
				t("adminCore.actions.addChallengesToSet"),
			),
		onSuccess: (_data, ids) => {
			toast.success(t("adminCore.challengeSetDetail.toasts.added", { count: ids.length }));
			invalidate();
			setPicked([]);
			setPickerOpen(false);
		},
		onError: (error) => toast.apiError(t("adminCore.challengeSetDetail.toasts.addFailed"), error),
	});
	const remove = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(
				client.admin.challenges.removeChallengeFromSet(setId)(ids),
				t("adminCore.actions.removeChallengesFromSet"),
			),
		onSuccess: (count) => {
			toast.success(t("adminCore.challengeSetDetail.toasts.removed", { count }));
			invalidate();
			setSelectedIds([]);
		},
		onError: (error) => toast.apiError(t("adminCore.challengeSetDetail.toasts.removeFailed"), error),
	});

	async function confirmRemove(ids: string[]): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.challengeSetDetail.confirm.removeSelectedTitle", { count: ids.length }),
			description: t("adminCore.challengeSetDetail.confirm.removeDescription"),
			consequences: [
				t("adminCore.challengeSetDetail.confirm.removeSelectedConsequence1", { count: ids.length }),
				t("adminCore.challengeSetDetail.confirm.removeSelectedConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.challengeSetDetail.confirm.remove"),
			confirmPhrase: "delete",
		});
		if (ok) remove.mutate(ids);
	}

	const columns: DataTableColumn<ChallengesListItem>[] = [
		{
			id: "name",
			header: t("adminCore.challengeSetDetail.columns.challenge"),
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{row.name}</p>
					<MonoText className="text-muted-foreground">{row.safe_name}</MonoText>
				</div>
			),
			sortValue: (row) => row.name,
		},
		{
			id: "category",
			header: t("adminCore.challengeSetDetail.columns.category"),
			cell: (row) => <span className="text-sm">{row.category}</span>,
			sortValue: (row) => row.category,
			hideBelow: "sm",
		},
		{
			id: "build",
			header: t("adminCore.challengeSetDetail.columns.versionBuild"),
			cell: (row) => (
				<div className="flex flex-wrap items-center gap-1">
					<MonoText>{row.version ?? "—"}</MonoText>
					<BuildStatusPill status={row.build_status} />
				</div>
			),
			hideBelow: "md",
		},
	];

	return (
		<>
			<Dialog open={set !== null} onOpenChange={onOpenChange}>
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
					<DialogHeader>
						<DialogTitle>{set?.name ?? t("adminCore.challengeSetDetail.titleFallback")}</DialogTitle>
						<DialogDescription>
							{set?.description || t("adminCore.challengeSetDetail.descriptionFallback")}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs text-muted-foreground">
								{set?.id ? <MonoText>{set.id}</MonoText> : null}
							</p>
							<div className="flex flex-wrap items-center gap-2">
								{selectedIds.length > 0 ? (
									<Button
										variant="destructive"
										size="sm"
										onClick={() => void confirmRemove(selectedIds)}
										disabled={remove.isPending}
									>
										{t("adminCore.challengeSetDetail.removeSelected", { count: selectedIds.length })}
									</Button>
								) : null}
								<Button
									size="sm"
									onClick={() => {
										setPicked([]);
										setPickerOpen(true);
									}}
								>
									<Plus aria-hidden="true" /> {t("adminCore.challengeSetDetail.add")}
								</Button>
							</div>
						</div>
						<QueryState
							query={items}
							skeleton={<TableSkeleton rows={5} columns={3} />}
							errorTitle={t("adminCore.challengeSetDetail.itemsError")}
							isEmpty={(result) => result.items.length === 0}
							empty={
								<EmptyBlock
									title={t("adminCore.challengeSetDetail.empty.title")}
									description={t("adminCore.challengeSetDetail.empty.description")}
								/>
							}
						>
							{(result) => (
								<DataTable
									data={result.items}
									getRowId={(row) => row.id}
									columns={columns}
									selectable
									selectedIds={selectedIds}
									onSelectionChange={setSelectedIds}
									rowActions={(row) => (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => void confirmRemove([row.id])}
											disabled={remove.isPending}
										>
											{t("adminCore.challengeSetDetail.remove")}
										</Button>
									)}
								/>
							)}
						</QueryState>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => onOpenChange(false)}>
							{t("common.close")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<FormSheet
				open={pickerOpen}
				onOpenChange={(open) => {
					if (!open) {
						setPickerOpen(false);
						setPicked([]);
					}
				}}
				title={t("adminCore.challengeSetDetail.picker.title")}
				description={t("adminCore.challengeSetDetail.picker.description")}
				width="xl"
				footer={
					<div className="flex w-full flex-wrap items-center justify-between gap-2">
						<span className="text-xs text-muted-foreground">
							{t("adminCore.challengeSetDetail.picker.selected", { count: picked.length })}
						</span>
						<div className="flex items-center gap-2">
							<Button variant="outline" onClick={() => setPickerOpen(false)}>
								{t("common.cancel")}
							</Button>
							<Button
								onClick={() => {
									if (picked.length === 0) {
										toast.warning(t("adminCore.challengeSetDetail.toasts.selectForAdd"));
										return;
									}
									add.mutate(picked);
								}}
								disabled={add.isPending || picked.length === 0}
							>
								<Plus aria-hidden="true" />
								{t("adminCore.challengeSetDetail.picker.addSelected", { count: picked.length })}
							</Button>
						</div>
					</div>
				}
			>
				<SearchInput
					value={picker.search}
					onChange={picker.setSearch}
					placeholder={t("adminCore.challengeSetDetail.picker.searchPlaceholder")}
				/>
				<QueryState
					query={pickerQuery}
					skeleton={<TableSkeleton rows={5} columns={3} />}
					errorTitle={t("adminCore.challengeSetDetail.picker.error")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							variant="filtered"
							title={t("adminCore.challengeSetDetail.picker.empty.title")}
							description={t("adminCore.challengeSetDetail.picker.empty.description")}
						/>
					}
				>
					{(result) => (
						<DataTable
							data={result.items}
							getRowId={(row) => row.id}
							selectable
							isRowSelectable={(row) =>
								!(items.data?.items ?? []).some((item) => item.id === row.id)
							}
							selectedIds={picked}
							onSelectionChange={setPicked}
							columns={[
								{
									id: "name",
									header: t("adminCore.challengeSetDetail.columns.challenge"),
									cell: (row) => (
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">{row.name}</p>
											<MonoText className="text-muted-foreground">{row.safe_name}</MonoText>
										</div>
									),
									sortValue: (row) => row.name,
								},
								{
									id: "category",
									header: t("adminCore.challengeSetDetail.columns.category"),
									cell: (row) => <span className="text-sm">{row.category}</span>,
									sortValue: (row) => row.category,
								},
							]}
						/>
					)}
				</QueryState>
			</FormSheet>
		</>
	);
}
