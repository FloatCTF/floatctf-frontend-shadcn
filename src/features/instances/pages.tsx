/**
 * 我的实例 —— 选手自己启动的题目 / AWDP 练习环境。
 *
 * 能力与数据语义保持不变：
 * - 列表：`GET /api/instances`（`client.service.instances.fetch`，limit 200，30 秒轮询）；
 * - 单个销毁：`DELETE /api/instances/{id}`；
 * - 批量销毁：`DELETE /api/instances`（`bulkDelete`）。
 *
 * 本页只做展示层增强：客户端搜索/类型筛选、统计、详情 Sheet、批量选择与真实后果确认。
 * 启动实例在题库/训练域完成；这里不新增任何 API 调用。
 */

import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	Boxes,
	CirclePlay,
	Clock,
	Eye,
	Loader2,
	RefreshCw,
	Search,
	Trash2,
} from "lucide-react";

import { callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import {
	MonoText,
	PageBody,
	PageHeader,
	SectionCard,
	StatCard,
} from "~/components/app/page";
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { RelativeTime } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { Instances as InstanceDto } from "@floatctf/sdk";
import { formatDateTime } from "~/lib/format";
import { useDocumentTitle, useNow } from "~/lib/hooks";

import {
	InstanceDetailSheet,
	InstanceKindPill,
	InstanceStatusPill,
	instanceExpiresLabel,
	instanceKindLabel,
	instanceKindOf,
	instanceName,
	instanceEventLabel,
	instanceSubjectHref,
} from "./components";

type KindFilter = "all" | "challenge" | "gamebox";

export function InstancesPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("instances.documentTitle"));

	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const now = useNow(30_000);

	const [search, setSearch] = useState("");
	const [kindFilter, setKindFilter] = useState<KindFilter>("all");
	const [selected, setSelected] = useState<string[]>([]);
	const [detailId, setDetailId] = useState<string | null>(null);

	const query = useQuery({
		queryKey: qk.instances.list({ limit: 200 }),
		queryFn: () => callList<InstanceDto>(client.service.instances.fetch({ limit: 200 })),
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});

	const destroy = useMutation({
		mutationFn: (id: string) =>
			callVoid(client.service.instances.destroy(id), t("instances.confirm.confirmDestroy")),
		onSuccess: (_data, id) => {
			toast.success(t("instances.toast.destroyed"));
			setSelected((current) => current.filter((item) => item !== id));
			setDetailId((current) => (current === id ? null : current));
			void queryClient.invalidateQueries({ queryKey: qk.instances.all });
		},
		onError: (error) => toast.apiError(t("instances.toast.destroyFailed"), error),
	});

	const bulkDestroy = useMutation({
		mutationFn: (ids: string[]) =>
			callVoid(client.service.instances.bulkDelete(ids), t("instances.confirm.confirmBulk")),
		onSuccess: (_data, ids) => {
			toast.success(t("instances.toast.bulkDestroyed", { count: ids.length }));
			setSelected([]);
			setDetailId((current) => (current && ids.includes(current) ? null : current));
			void queryClient.invalidateQueries({ queryKey: qk.instances.all });
		},
		onError: (error) => toast.apiError(t("instances.toast.bulkDestroyFailed"), error),
	});

	const items = query.data?.items ?? [];
	const normalizedSearch = search.trim().toLowerCase();

	const filtered = useMemo(() => {
		return items.filter((row) => {
			const kind = instanceKindOf(row);
			if (kindFilter === "challenge" && kind !== "challenge") return false;
			if (kindFilter === "gamebox" && kind !== "gamebox") return false;
			if (!normalizedSearch) return true;
			const haystack = [
				instanceName(t, row),
				instanceEventLabel(t, row),
				row.identifier,
				row.status,
				row.user_name ?? "",
			]
				.join(" ")
				.toLowerCase();
			return haystack.includes(normalizedSearch);
		});
	}, [items, kindFilter, normalizedSearch, t]);

	const selectedRows = useMemo(
		() => items.filter((row) => selected.includes(row.id)),
		[items, selected],
	);

	const runningCount = items.filter(
		(row) => (row.status ?? "").trim().toLowerCase() === "running",
	).length;
	const startingCount = items.filter((row) =>
		["pending", "starting"].includes((row.status ?? "").trim().toLowerCase()),
	).length;
	const expiringSoonCount = items.filter((row) => {
		if (!row.destroy_at) return false;
		const remaining = new Date(row.destroy_at).getTime() - now.getTime();
		return remaining > 0 && remaining <= 60 * 60 * 1000;
	}).length;

	const detailRow = detailId ? (items.find((row) => row.id === detailId) ?? null) : null;

	const clearFilters = () => {
		setSearch("");
		setKindFilter("all");
		setSelected([]);
	};

	const toggleSelected = (id: string, checked: boolean) => {
		setSelected((current) => {
			if (checked) return current.includes(id) ? current : [...current, id];
			return current.filter((item) => item !== id);
		});
	};

	const askDestroy = async (row: InstanceDto) => {
		const kind = instanceKindOf(row);
		const consequences = [
			t("instances.confirm.consequenceContainer"),
			...(kind === "gamebox"
				? [t("instances.confirm.consequenceRunRetained")]
				: kind === "challenge"
					? [t("instances.confirm.consequenceChallengeProgress")]
					: []),
			t("instances.confirm.consequenceRelaunch"),
		];
		const ok = await confirm({
			title: t("instances.confirm.destroyTitleNamed", { name: instanceName(t, row) }),
			description: t("instances.confirm.description"),
			consequences,
			tone: "danger",
			confirmText: t("instances.confirm.confirmDestroy"),
		});
		if (ok) destroy.mutate(row.id);
	};

	const askBulkDestroy = async () => {
		if (selectedRows.length === 0) return;
		const hasChallenge = selectedRows.some((row) => instanceKindOf(row) === "challenge");
		const hasGamebox = selectedRows.some((row) => instanceKindOf(row) === "gamebox");
		const consequences = [
			t("instances.confirm.consequenceContainer"),
			...(hasGamebox ? [t("instances.confirm.consequenceRunRetained")] : []),
			...(hasChallenge ? [t("instances.confirm.consequenceChallengeProgress")] : []),
			t("instances.confirm.consequenceRelaunch"),
		];
		const ok = await confirm({
			title: t("instances.confirm.bulkTitle", { count: selectedRows.length }),
			description: t("instances.confirm.description"),
			consequences,
			tone: "danger",
			confirmText: t("instances.confirm.confirmBulk"),
		});
		if (ok) bulkDestroy.mutate(selectedRows.map((row) => row.id));
	};

	const columns = useMemo<DataTableColumn<InstanceDto>[]>(
		() => [
			{
				id: "subject",
				header: t("instances.list.column.subject"),
				sortValue: (row) => instanceName(t, row),
				cell: (row) => {
					const name = instanceName(t, row);
					const href = instanceSubjectHref(row);
					return (
						<div className="min-w-0">
							{href ? (
								<Link
									to={href}
									onClick={(event) => event.stopPropagation()}
									className="block truncate text-sm font-medium underline-offset-4 hover:underline"
									title={name}
								>
									{name}
								</Link>
							) : (
								<p className="truncate text-sm font-medium" title={name}>
									{name}
								</p>
							)}
							<p className="truncate text-xs text-muted-foreground">
								{instanceEventLabel(t, row)}
							</p>
						</div>
					);
				},
			},
			{
				id: "type",
				header: t("instances.list.column.type"),
				hideBelow: "sm",
				sortValue: (row) => instanceKindLabel(t, row),
				cell: (row) => <InstanceKindPill row={row} />,
			},
			{
				id: "status",
				header: t("instances.list.column.status"),
				sortValue: (row) => row.status,
				cell: (row) => <InstanceStatusPill status={row.status} />,
			},
			{
				id: "identifier",
				header: t("instances.list.column.identifier"),
				hideBelow: "lg",
				sortValue: (row) => row.identifier,
				cell: (row) => (
					<MonoText title={row.identifier}>{row.identifier || t("common.empty")}</MonoText>
				),
			},
			{
				id: "created",
				header: t("instances.list.column.created"),
				hideBelow: "md",
				sortValue: (row) => Date.parse(row.created_at) || 0,
				cell: (row) => <RelativeTime value={row.created_at} className="tnum" />,
			},
			{
				id: "expires",
				header: t("instances.list.column.expires"),
				hideBelow: "md",
				sortValue: (row) => row.destroy_at ?? "",
				cell: (row) => (
					<span
						className="tnum text-xs text-muted-foreground"
						title={row.destroy_at ? formatDateTime(row.destroy_at) : undefined}
					>
						{instanceExpiresLabel(t, row)}
					</span>
				),
			},
		],
		[t],
	);

	const rowActions = (row: InstanceDto) => {
		const name = instanceName(t, row);
		return (
			<>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setDetailId(row.id)}
					aria-label={t("instances.row.details", { name })}
					title={t("instances.row.details", { name })}
				>
					<Eye />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					className="text-destructive hover:bg-destructive/10 hover:text-destructive"
					disabled={destroy.isPending || bulkDestroy.isPending}
					onClick={() => void askDestroy(row)}
					aria-label={t("instances.row.destroy", { name })}
					title={t("instances.row.destroy", { name })}
				>
					<Trash2 />
				</Button>
			</>
		);
	};

	return (
		<PageBody>
			<PageHeader
				title={t("instances.header.title")}
				description={t("instances.header.description")}
				actions={
					<Button asChild>
						<Link to="/challenges">
							<Boxes aria-hidden="true" />
							{t("instances.header.launchAction")}
						</Link>
					</Button>
				}
			/>

			<QueryState
				query={query}
				skeleton={
					<SectionCard title={t("instances.list.title")}>
						<TableSkeleton rows={6} columns={6} />
					</SectionCard>
				}
				errorTitle={t("instances.list.errorTitle")}
				isEmpty={(result) => result.items.length === 0}
				empty={
					<EmptyBlock
						title={t("instances.list.emptyTitle")}
						description={t("instances.list.emptyDescription")}
						icon={<Boxes className="size-4" />}
						action={
							<Button size="sm" asChild>
								<Link to="/challenges">{t("instances.list.emptyAction")}</Link>
							</Button>
						}
					/>
				}
			>
				{(result) => (
					<div className="space-y-5">
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
							<StatCard
								label={t("instances.stats.total")}
								value={result.items.length}
								hint={t("instances.stats.totalHint")}
								icon={<Boxes className="size-4" />}
							/>
							<StatCard
								label={t("instances.stats.running")}
								value={runningCount}
								hint={t("instances.stats.runningHint")}
								icon={<CirclePlay className="size-4" />}
								tone="success"
							/>
							<StatCard
								label={t("instances.stats.starting")}
								value={startingCount}
								hint={t("instances.stats.startingHint")}
								icon={<Loader2 className="size-4" />}
								tone={startingCount > 0 ? "warning" : "default"}
							/>
							<StatCard
								label={t("instances.stats.expiringSoon")}
								value={expiringSoonCount}
								hint={t("instances.stats.expiringSoonHint")}
								icon={<Clock className="size-4" />}
								tone={expiringSoonCount > 0 ? "warning" : "default"}
							/>
						</div>

						<SectionCard
							title={t("instances.list.title")}
							description={t("instances.list.description", { count: result.items.length })}
						>
							<div className="space-y-4">
								<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
									<div className="relative w-full sm:max-w-xs">
										<Search
											className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
											aria-hidden="true"
										/>
										<Input
											value={search}
											onChange={(event) => {
												setSearch(event.target.value);
												setSelected([]);
											}}
											placeholder={t("instances.list.searchPlaceholder")}
											aria-label={t("instances.list.searchLabel")}
											className="pl-8"
										/>
									</div>
									<Select
										value={kindFilter}
										onValueChange={(value) => {
											setKindFilter(value as KindFilter);
											setSelected([]);
										}}
									>
										<SelectTrigger
											className="w-full sm:w-[150px]"
											aria-label={t("instances.list.typeFilterLabel")}
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												{t("instances.list.typeAll")}
											</SelectItem>
											<SelectItem value="challenge">
												{t("instances.type.challenge")}
											</SelectItem>
											<SelectItem value="gamebox">
												{t("instances.type.gamebox")}
											</SelectItem>
										</SelectContent>
									</Select>
									<Button
										variant="outline"
										size="icon"
										className="sm:ml-auto"
										onClick={() => void query.refetch()}
										disabled={query.isFetching}
										aria-label={
											query.isFetching
												? t("instances.list.refreshing")
												: t("instances.list.refresh")
										}
										title={
											query.isFetching
												? t("instances.list.refreshing")
												: t("instances.list.refresh")
										}
									>
										<RefreshCw
											className={
												query.isFetching
													? "animate-spin motion-reduce:animate-none"
													: undefined
											}
										/>
									</Button>
								</div>

								{selectedRows.length > 0 ? (
									<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/50 px-3 py-2">
										<p className="tnum text-sm font-medium">
											{t("instances.list.selectedCount", {
												count: selectedRows.length,
											})}
										</p>
										<div className="flex flex-wrap items-center gap-2">
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setSelected([])}
											>
												{t("instances.list.clearSelection")}
											</Button>
											<Button
												variant="destructive"
												size="sm"
												disabled={bulkDestroy.isPending || destroy.isPending}
												onClick={() => void askBulkDestroy()}
											>
												<Trash2 aria-hidden="true" />
												{t("instances.list.bulkDestroy", {
													count: selectedRows.length,
												})}
											</Button>
										</div>
									</div>
								) : null}

								{filtered.length === 0 ? (
									<EmptyBlock
										variant="filtered"
										title={t("instances.list.filteredTitle")}
										description={t("instances.list.filteredDescription")}
										action={
											<Button
												variant="outline"
												size="sm"
												onClick={clearFilters}
											>
												{t("instances.list.filteredAction")}
											</Button>
										}
									/>
								) : (
									<DataTable
										data={filtered}
										getRowId={(row) => row.id}
										columns={columns}
										rowActions={rowActions}
										onRowClick={(row) => setDetailId(row.id)}
										selectable
										selectedIds={selected}
										onSelectionChange={setSelected}
										mobileCard={(row) => {
											const name = instanceName(t, row);
											const href = instanceSubjectHref(row);
											return (
												<div className="space-y-2">
													<div className="flex items-start justify-between gap-2">
														<div className="min-w-0">
															{href ? (
																<Link
																	to={href}
																	className="block truncate text-sm font-medium underline-offset-4 hover:underline"
																	title={name}
																>
																	{name}
																</Link>
															) : (
																<p
																	className="truncate text-sm font-medium"
																	title={name}
																>
																	{name}
																</p>
															)}
															<p className="truncate text-xs text-muted-foreground">
																{instanceEventLabel(t, row)}
															</p>
														</div>
														<Checkbox
															checked={selected.includes(row.id)}
															onCheckedChange={(checked) =>
																toggleSelected(row.id, checked === true)
															}
															aria-label={t("instances.list.selectRow", {
																name,
															})}
														/>
													</div>

													<div className="flex flex-wrap items-center gap-2">
														<InstanceKindPill row={row} />
														<InstanceStatusPill status={row.status} />
													</div>

													<div className="space-y-1 text-xs text-muted-foreground">
														<div className="flex min-w-0 items-center gap-1.5">
															<span className="shrink-0">
																{t("instances.list.column.identifier")}
															</span>
															<MonoText>{row.identifier}</MonoText>
														</div>
														<div className="flex items-center gap-1.5">
															<span className="shrink-0">
																{t("instances.list.column.expires")}
															</span>
															<span className="tnum">
																{instanceExpiresLabel(t, row)}
															</span>
														</div>
													</div>

													<div className="flex items-center justify-end gap-2 pt-1">
														<Button
															variant="ghost"
															size="sm"
															onClick={() => setDetailId(row.id)}
														>
															<Eye aria-hidden="true" />
															{t("common.details")}
														</Button>
														<Button
															variant="ghost"
															size="sm"
															className="text-destructive hover:bg-destructive/10 hover:text-destructive"
															disabled={destroy.isPending || bulkDestroy.isPending}
															onClick={() => void askDestroy(row)}
														>
															<Trash2 aria-hidden="true" />
															{t("common.delete")}
														</Button>
													</div>
												</div>
											);
										}}
									/>
								)}
							</div>
						</SectionCard>
					</div>
				)}
			</QueryState>

			<InstanceDetailSheet
				row={detailRow}
				open={detailRow !== null}
				onOpenChange={(open) => {
					if (!open) setDetailId(null);
				}}
				onDestroy={(row) => void askDestroy(row)}
				destroyPending={destroy.isPending || bulkDestroy.isPending}
			/>
		</PageBody>
	);
}
