/**
 * 题集详情（`/admin/challenge-sets/:setId`）—— 题集信息 + 题目增删。
 *
 * 真实接口：
 * - 题集信息：`getChallengeSets({ filter: "id:<setId>", limit: 1 })`
 *   （没有「按 id 取题集」的单条接口，复用列表接口的 `id` 过滤）；
 * - 题集内题目：`getChallengeSet(setId)({ page, limit })` —— **柯里化，必须二次调用**；
 * - 增：`addChallengeToSet({ set_id, challenge_id_list })`；
 * - 删：`removeChallengeFromSet(setId)(id_list)` —— 同上柯里化。
 *
 * 注意：`GET /challenge_sets/{id}` 在服务端只支持 `page` / `limit`，**没有** filter 映射，
 * 因此本页不提供搜索框（避免给出「看起来生效、其实被后端忽略」的假过滤）。
 * 需要找题请用「添加题目」抽屉里的搜索（那走的是 `/challenges`，有完整 filter 映射）。
 *
 * 所有用户可见文案走 `adminCore.challengeSetDetail.*`。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, RefreshCw } from "lucide-react";

import { call, callList, callVoid } from "~/api/call";
import { useAppQueryClient, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { FormSheet } from "~/components/app/form";
import {
	KeyValueList,
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
	NotFoundBlock,
	QueryState,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { formatDateTime } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";
import type { ChallengesListItem, QueryParams } from "@floatctf/sdk";
import type { ChallengeSets } from "@floatctf/sdk/entity";

import { BuildStatusPill, SearchInput, useAdminListState } from "./shared";

export function AdminChallengeSetDetailPage(): ReactNode {
	const { t } = useTranslation();
	const { setId = "" } = useParams<{ setId: string }>();
	const client = useClient();
	const queryClient = useAppQueryClient();
	const confirm = useConfirm();

	const metaParams: QueryParams = { filter: `id:${setId}`, limit: 1 };
	const setMeta = useQuery({
		queryKey: qk.admin.challengeSets(metaParams),
		queryFn: () => callList<ChallengeSets>(client.admin.challenges.getChallengeSets(metaParams)),
		enabled: setId !== "",
	});

	const meta = setMeta.data?.items[0] ?? null;
	useDocumentTitle(
		meta
			? t("adminCore.challengeSetDetail.documentTitle", { name: meta.name })
			: t("adminCore.challengeSetDetail.documentTitleFallback"),
	);

	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	const itemsParams: QueryParams = { page, limit: pageSize };
	const items = useQuery({
		queryKey: [...qk.admin.challengeSet(setId), itemsParams],
		// getChallengeSet 是柯里化的：getChallengeSet(id) 返回函数，必须二次调用。
		queryFn: () => callList<ChallengesListItem>(client.admin.challenges.getChallengeSet(setId)(itemsParams)),
		enabled: setId !== "",
	});

	// ── 添加题目（抽屉里的题库选择器）──
	const [pickerOpen, setPickerOpen] = useState(false);
	const [picked, setPicked] = useState<string[]>([]);
	const picker = useAdminListState(["name", "safe_name", "category"]);
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

	function invalidateSet(): void {
		void queryClient.invalidateQueries({ queryKey: qk.admin.challengeSet(setId) });
		void queryClient.invalidateQueries({ queryKey: qk.admin.challengeSets() });
	}

	const addChallenges = useMutation({
		mutationFn: (ids: string[]) =>
			// 该接口返回 data:null，必须用 callVoid。
			callVoid(
				client.admin.challenges.addChallengeToSet({ set_id: setId, challenge_id_list: ids }),
				t("adminCore.actions.addChallengesToSet"),
			),
		onSuccess: (_data, ids) => {
			toast.success(t("adminCore.challengeSetDetail.toasts.added", { count: ids.length }));
			invalidateSet();
			setPicked([]);
			setPickerOpen(false);
		},
		onError: (error) => toast.apiError(t("adminCore.challengeSetDetail.toasts.addFailed"), error),
	});

	const removeChallenges = useMutation({
		mutationFn: (ids: string[]) =>
			call<number>(
				client.admin.challenges.removeChallengeFromSet(setId)(ids),
				t("adminCore.actions.removeChallengesFromSet"),
			),
		onSuccess: (count) => {
			toast.success(
				t("adminCore.challengeSetDetail.toasts.removed", { count }),
				t("adminCore.challengeSetDetail.toasts.removedDescription"),
			);
			invalidateSet();
			setSelectedIds([]);
		},
		onError: (error) =>
			toast.apiError(t("adminCore.challengeSetDetail.toasts.removeFailed"), error),
	});

	async function confirmRemoveOne(row: ChallengesListItem): Promise<void> {
		const ok = await confirm({
			title: t("adminCore.challengeSetDetail.confirm.removeOneTitle", { name: row.name }),
			description: t("adminCore.challengeSetDetail.confirm.removeDescription"),
			consequences: [
				t("adminCore.challengeSetDetail.confirm.removeConsequence1"),
				t("adminCore.challengeSetDetail.confirm.removeConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.challengeSetDetail.confirm.remove"),
			confirmPhrase: row.name,
		});
		if (ok) removeChallenges.mutate([row.id]);
	}

	async function confirmRemoveSelected(): Promise<void> {
		if (selectedIds.length === 0) {
			toast.warning(t("adminCore.challengeSetDetail.toasts.selectForRemove"));
			return;
		}
		const ok = await confirm({
			title: t("adminCore.challengeSetDetail.confirm.removeSelectedTitle", {
				count: selectedIds.length,
			}),
			description: t("adminCore.challengeSetDetail.confirm.removeDescription"),
			consequences: [
				t("adminCore.challengeSetDetail.confirm.removeSelectedConsequence1", {
					count: selectedIds.length,
				}),
				t("adminCore.challengeSetDetail.confirm.removeSelectedConsequence2"),
			],
			tone: "danger",
			confirmText: t("adminCore.challengeSetDetail.confirm.remove"),
			confirmPhrase: "delete",
		});
		if (ok) removeChallenges.mutate(selectedIds);
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
			id: "version",
			header: t("adminCore.challengeSetDetail.columns.versionBuild"),
			cell: (row) => (
				<div className="flex flex-wrap items-center gap-1">
					<MonoText>{row.version ?? "—"}</MonoText>
					<BuildStatusPill status={row.build_status} />
				</div>
			),
			hideBelow: "md",
		},
		{
			id: "hidden",
			header: t("adminCore.challengeSetDetail.columns.visibility"),
			cell: (row) => (
				<TonePill tone={row.hidden ? "muted" : "success"}>
					{row.hidden
						? t("adminCore.common.visibility.hidden")
						: t("adminCore.common.visibility.public")}
				</TonePill>
			),
			sortValue: (row) => (row.hidden ? 1 : 0),
		},
		{
			id: "updated_at",
			header: t("adminCore.challengeSetDetail.columns.updatedAt"),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">{formatDateTime(row.updated_at)}</span>
			),
			sortValue: (row) => Date.parse(row.updated_at),
			hideBelow: "lg",
		},
	];

	const backLink = (
		<Link
			to="/admin/challenge-sets"
			className="inline-flex items-center gap-1 hover:text-foreground"
		>
			<ArrowLeft className="size-4" aria-hidden="true" />{" "}
			{t("adminCore.challengeSetDetail.back")}
		</Link>
	);

	return (
		<PageBody>
			<PageHeader
				breadcrumbs={backLink}
				title={meta?.name ?? t("adminCore.challengeSetDetail.titleFallback")}
				description={
					meta?.description || t("adminCore.challengeSetDetail.descriptionFallback")
				}
				badge={meta ? <MonoText className="text-muted-foreground">{meta.id}</MonoText> : undefined}
				actions={
					<Toolbar>
						<Button variant="outline" onClick={() => items.refetch()} disabled={items.isFetching}>
							<RefreshCw
								className={items.isFetching ? "animate-spin" : undefined}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</Button>
						<Button
							onClick={() => {
								setPicked([]);
								setPickerOpen(true);
							}}
						>
							<Plus aria-hidden="true" /> {t("adminCore.challengeSetDetail.add")}
						</Button>
					</Toolbar>
				}
			/>

			{setMeta.isPending ? (
				<SectionCard title={t("adminCore.challengeSetDetail.infoTitle")}>
					<LoadingBlock label={t("adminCore.challengeSetDetail.infoLoading")} />
				</SectionCard>
			) : null}

			{setMeta.isError ? (
				<ErrorBlock
					error={setMeta.error}
					title={t("adminCore.challengeSetDetail.infoError")}
					onRetry={() => setMeta.refetch()}
				/>
			) : null}

			{meta ? (
				<SectionCard title={t("adminCore.challengeSetDetail.infoTitle")}>
					<KeyValueList
						columns={2}
						items={[
							{ key: t("adminCore.challengeSetDetail.info.name"), value: meta.name },
							{
								key: t("adminCore.challengeSetDetail.info.count"),
								value: <MonoText>{items.data ? (items.data.meta?.total ?? 0) : "—"}</MonoText>,
								hint: t("adminCore.challengeSetDetail.info.countHint"),
							},
							{
								key: t("adminCore.challengeSetDetail.info.createdAt"),
								value: <MonoText>{formatDateTime(meta.created_at)}</MonoText>,
							},
							{
								key: t("adminCore.challengeSetDetail.info.updatedAt"),
								value: <MonoText>{formatDateTime(meta.updated_at)}</MonoText>,
							},
						]}
					/>
				</SectionCard>
			) : null}

			<SectionCard
				title={t("adminCore.challengeSetDetail.itemsTitle")}
				description={t("adminCore.challengeSetDetail.itemsDescription")}
				actions={
					selectedIds.length > 0 ? (
						<Button
							variant="destructive"
							size="sm"
							onClick={() => void confirmRemoveSelected()}
							disabled={removeChallenges.isPending}
						>
							<Minus aria-hidden="true" />{" "}
							{t("adminCore.challengeSetDetail.removeSelected", {
								count: selectedIds.length,
							})}
						</Button>
					) : null
				}
				contentClassName="p-0"
				footer={
					items.data ? (
						<PaginationBar
							page={page}
							pageSize={pageSize}
							total={items.data.meta?.total ?? 0}
							onPageChange={setPage}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
						/>
					) : null
				}
			>
				<QueryState
					query={items}
					skeleton={<TableSkeleton rows={6} columns={4} />}
					errorTitle={t("adminCore.challengeSetDetail.itemsError")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							title={t("adminCore.challengeSetDetail.empty.title")}
							description={t("adminCore.challengeSetDetail.empty.description")}
							action={
								<Button
									size="sm"
									onClick={() => {
										setPicked([]);
										setPickerOpen(true);
									}}
								>
									<Plus aria-hidden="true" /> {t("adminCore.challengeSetDetail.add")}
								</Button>
							}
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
							mobileCard={(row) => (
								<div className="space-y-1.5">
									<div className="flex items-start justify-between gap-2">
										<span className="text-sm font-medium">{row.name}</span>
										<BuildStatusPill status={row.build_status} />
									</div>
									<MonoText className="text-muted-foreground">
										{row.safe_name} · {row.category}
									</MonoText>
									<Button
										variant="destructive"
										size="sm"
										className="mt-1"
										onClick={() => void confirmRemoveOne(row)}
									>
										<Minus aria-hidden="true" />{" "}
										{t("adminCore.challengeSetDetail.removeOne")}
									</Button>
								</div>
							)}
							rowActions={(row) => (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => void confirmRemoveOne(row)}
									aria-label={t("adminCore.challengeSetDetail.removeRowAria", {
										name: row.name,
									})}
									disabled={removeChallenges.isPending}
								>
									<Minus aria-hidden="true" /> {t("adminCore.challengeSetDetail.remove")}
								</Button>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>

			{setMeta.isSuccess && setMeta.data.items.length === 0 ? (
				<NotFoundBlock
					title={t("adminCore.challengeSetDetail.notFound.title")}
					description={t("adminCore.challengeSetDetail.notFound.description", { id: setId })}
					action={
						<Button asChild size="sm">
							<Link to="/admin/challenge-sets">
								{t("adminCore.challengeSetDetail.back")}
							</Link>
						</Button>
					}
				/>
			) : null}

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
						<span className="tnum text-xs text-muted-foreground">
							{t("adminCore.challengeSetDetail.picker.selected", { count: picked.length })}
						</span>
						<div className="flex items-center gap-2">
							<Button variant="outline" onClick={() => setPickerOpen(false)}>
								{t("common.cancel")}
							</Button>
							<Button
								onClick={() => {
									if (picked.length === 0) {
										toast.warning(
											t("adminCore.challengeSetDetail.toasts.selectForAdd"),
										);
										return;
									}
									addChallenges.mutate(picked);
								}}
								disabled={addChallenges.isPending || picked.length === 0}
							>
								<Plus aria-hidden="true" />{" "}
								{t("adminCore.challengeSetDetail.picker.addSelected", {
									count: picked.length,
								})}
							</Button>
						</div>
					</div>
				}
			>
				<SearchInput
					value={picker.search}
					onChange={picker.setSearch}
					placeholder={t("adminCore.challengeSetDetail.picker.searchPlaceholder")}
					className="sm:max-w-md"
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
									hideBelow: "sm",
								},
								{
									id: "build_status",
									header: t("adminCore.challengeSetDetail.columns.build"),
									cell: (row) => <BuildStatusPill status={row.build_status} />,
									hideBelow: "sm",
								},
							]}
							mobileCard={(row) => (
								<div className="space-y-1">
									<div className="flex items-center justify-between gap-2">
										<span className="text-sm font-medium">{row.name}</span>
										<BuildStatusPill status={row.build_status} />
									</div>
									<MonoText className="text-muted-foreground">{row.safe_name}</MonoText>
									<p className="text-xs text-muted-foreground">{row.category}</p>
								</div>
							)}
						/>
					)}
				</QueryState>
				{pickerQuery.data ? (
					<PaginationBar
						page={picker.page}
						pageSize={picker.pageSize}
						total={pickerQuery.data.meta?.total ?? 0}
						onPageChange={picker.setPage}
						onPageSizeChange={picker.setPageSize}
					/>
				) : null}
			</FormSheet>
		</PageBody>
	);
}
