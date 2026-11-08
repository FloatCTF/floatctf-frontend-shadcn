/**
 * 我的实例 —— 选手自己启动的题目 / AWDP 练习环境。
 *
 * 展示口径按 Default：内容 / 类型 / 状态 / 赛事 / 标识 / 用户 / 销毁时间 / 操作；
 * 工具栏使用 Add Filter + Clear + Apply Filters。
 */

import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { FilterBar, type FilterKey } from "~/components/app/filter-bar";
import { MonoText, PageBody, PageHeader, PaginationBar, SectionCard } from "~/components/app/page";
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import type { Instances as InstanceDto } from "@floatctf/sdk";
import { formatDateTime } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";

import {
	InstanceKindPill,
	InstanceStatusPill,
	instanceKindLabel,
	instanceKindOf,
	instanceName,
	instanceSubjectHref,
} from "./components";

export function InstancesPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("instances.documentTitle"));

	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [draftFilter, setDraftFilter] = useState("");
	const [appliedFilter, setAppliedFilter] = useState("");

	const query = useQuery({
		queryKey: qk.instances.list({ page: 1, limit: 200 }),
		queryFn: () => callList<InstanceDto>(client.service.instances.fetch({ page: 1, limit: 200 })),
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
	});

	const destroy = useMutation({
		mutationFn: (row: InstanceDto) =>
			// 单条 DELETE 只解析 challenge 实例；GameBox 实例必须走批量接口。
			instanceKindOf(row) === "gamebox"
				? callVoid(client.service.instances.bulkDelete([row.id]), t("instances.confirm.confirmDestroy"))
				: callVoid(client.service.instances.destroy(row.id), t("instances.confirm.confirmDestroy")),
		onSuccess: () => {
			toast.success(t("instances.toast.destroyed"));
			void queryClient.invalidateQueries({ queryKey: qk.instances.all });
		},
		onError: (error) => toast.apiError(t("instances.toast.destroyFailed"), error),
	});

	const items = query.data?.items ?? [];
	const filterClauses = appliedFilter
		.split("&")
		.map((clause) => clause.trim())
		.filter(Boolean);
	const filtered = items.filter((row) => {
		if (filterClauses.length === 0) return true;
		return filterClauses.every((clause) => {
			const separator = clause.indexOf(":");
			const key = (separator >= 0 ? clause.slice(0, separator) : "").trim();
			const value = (separator >= 0 ? clause.slice(separator + 1) : clause).trim().toLowerCase();
			const record = row as Record<string, unknown>;
			if (key in record) {
				return String(record[key] ?? "").toLowerCase().includes(value);
			}
			return `${instanceName(t, row)} ${row.identifier} ${row.status} ${row.user_name ?? ""}`
				.toLowerCase()
				.includes(clause.toLowerCase());
		});
	});
	const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

	async function askDestroy(row: InstanceDto) {
		const kind = instanceKindOf(row);
		const ok = await confirm({
			title: t("instances.confirm.destroyTitleNamed", { name: instanceName(t, row) }),
			description: t("instances.confirm.description"),
			consequences: [
				t("instances.confirm.consequenceContainer"),
				...(kind === "gamebox"
					? [t("instances.confirm.consequenceRunRetained")]
					: [t("instances.confirm.consequenceChallengeProgress")]),
				t("instances.confirm.consequenceRelaunch"),
			],
			tone: "danger",
			confirmText: t("instances.confirm.confirmDestroy"),
		});
		if (ok) destroy.mutate(row);
	}

	const columns: DataTableColumn<InstanceDto>[] = [
		{
			id: "subject",
			header: t("instances.list.column.subject"),
			sortValue: (row) => instanceName(t, row),
			cell: (row) => {
				const name = instanceName(t, row);
				const href = instanceSubjectHref(row);
				return href ? (
					<Link to={href} className="text-sm font-medium hover:underline">
						{name}
					</Link>
				) : (
					<span className="text-sm">{name}</span>
				);
			},
		},
		{
			id: "type",
			header: t("instances.list.column.type"),
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
			id: "event",
			header: t("instances.list.column.event"),
			sortValue: (row) => row.event_title ?? row.event_id ?? "",
			cell: (row) => (
				<span className="text-sm">{row.event_title ?? row.event_id ?? "—"}</span>
			),
			hideBelow: "md",
		},
		{
			id: "identifier",
			header: t("instances.list.column.identifier"),
			cell: (row) => <MonoText>{row.identifier || "—"}</MonoText>,
			hideBelow: "lg",
		},
		{
			id: "user",
			header: t("instances.list.column.user"),
			cell: (row) => <span className="text-sm">{row.user_name ?? row.user_id ?? "—"}</span>,
			hideBelow: "md",
		},
		{
			id: "destroy_at",
			header: t("instances.list.column.expires"),
			sortValue: (row) => row.destroy_at ?? "",
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">
					{row.destroy_at ? formatDateTime(row.destroy_at) : "—"}
				</span>
			),
		},
		{
			id: "action",
			header: t("common.actions"),
			cell: (row) =>
				row.challenge_id ? (
					<Button
						variant="ghost"
						size="sm"
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						disabled={destroy.isPending}
						onClick={() => void askDestroy(row)}
					>
						{t("instances.row.destroy", { name: instanceName(t, row) })}
					</Button>
				) : row.run_id ? (
					<Button variant="ghost" size="sm" asChild>
						<Link to={`/training/runs/${row.run_id}`}>{t("common.open")}</Link>
					</Button>
				) : null,
		},
	];

	return (
		<PageBody>
			<PageHeader title={t("instances.header.title")} description={t("instances.header.description")} />
			<SectionCard
				title={t("instances.list.title")}
				description={t("instances.list.description", { count: filtered.length })}
				contentClassName="px-0"
				actions={
					<FilterBar
						keys={[
							{ key: "status", label: t("instances.list.column.status") },
							{ key: "identifier", label: t("instances.list.column.identifier") },
							{ key: "event_id", label: t("instances.list.column.event") },
							{ key: "user_id", label: t("instances.list.column.user") },
						] satisfies FilterKey[]}
						value={draftFilter}
						onChange={setDraftFilter}
						onApply={() => {
							setAppliedFilter(draftFilter.trim());
							setPage(1);
						}}
						onClear={() => {
							setDraftFilter("");
							setAppliedFilter("");
							setPage(1);
						}}
						placeholder={t("common.filter.placeholder")}
					/>
				}
				footer={
					filtered.length > 0 ? (
						<PaginationBar
							page={page}
							pageSize={pageSize}
							total={filtered.length}
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
					query={query}
					skeleton={<TableSkeleton rows={6} columns={6} />}
					errorTitle={t("instances.list.errorTitle")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							title={t("instances.list.emptyTitle")}
							description={t("instances.list.emptyDescription")}
							action={
								<Button size="sm" asChild>
									<Link to="/challenges">{t("instances.list.emptyAction")}</Link>
								</Button>
							}
						/>
					}
				>
					{() => (
						<DataTable
							data={paged}
							getRowId={(row) => row.id}
							columns={columns}
							mobileCard={(row) => (
								<div className="space-y-1">
									<Link to={instanceSubjectHref(row) ?? "#"} className="text-sm font-medium hover:underline">
										{instanceName(t, row)}
									</Link>
									<p className="text-xs text-muted-foreground">
										{instanceKindLabel(t, row)} · <InstanceStatusPill status={row.status} />
									</p>
								</div>
							)}
						/>
					)}
				</QueryState>
			</SectionCard>
		</PageBody>
	);
}
