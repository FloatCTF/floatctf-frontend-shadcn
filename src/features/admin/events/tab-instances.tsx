/**
 * 赛事控制台 · 实例标签。
 *
 * `client.admin.instances.listForEvent(eventId)` 返回**归一化**的 `AdminInstanceRow[]`
 * （challenge / gamebox 类型、对应 content_title）—— 该接口不支持 `page`/`limit`，
 * 一次返回全量，因此这里客户端分页。
 *
 * ⚠️ 管理端实例列表**不返回 flag**（后端脱敏），页面也不展示任何 flag 字段。
 * 文案全部走 `adminEvents.instances` 命名空间；`instance_type` / `status` 是后端技术标识。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";

import { callMaybe } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import type { DataTableColumn } from "~/components/app/data-table";
import { MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import type { AdminInstanceRow } from "@floatctf/sdk";
import { formatDateTime } from "~/lib/format";

import { clientPageCount, clientPaged, MobileFacts, PagedTable } from "./shared";

function typeTone(type: AdminInstanceRow["instance_type"]): "info" | "success" {
	return type === "challenge" ? "info" : "success";
}

function instanceTypeLabel(type: AdminInstanceRow["instance_type"], t: (key: string) => string): string {
	return t(type === "challenge" ? "adminEvents.instances.types.challenge" : "adminEvents.instances.types.gamebox");
}

/** 后端 status 是技术标识，展示时统一本地化。 */
function instanceStatusLabel(status: string, t: (key: string) => string): string {
	const known = ["running", "stopped", "starting", "pending", "error", "destroyed"];
	return known.includes(status)
		? t(`adminEvents.instances.statuses.${status}`)
		: status;
}

function OwnerLabel({ row }: { row: AdminInstanceRow }): ReactNode {
	const { t } = useTranslation();
	if (row.user_name) return <span>{row.user_name}</span>;
	if (row.team_name) return <span>{t("adminEvents.instances.values.ownerTeam", { name: row.team_name })}</span>;
	const fallback = row.user_id ?? row.team_id;
	return fallback ? (
		<MonoText>{fallback}</MonoText>
	) : (
		<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
	);
}

export function EventInstancesTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);

	const query = useQuery({
		queryKey: qk.admin.eventInstances(eventId),
		queryFn: async () => {
			const rows = (await callMaybe<AdminInstanceRow[]>(
				client.admin.instances.listForEvent(eventId),
				t("adminEvents.actions.loadEventInstances"),
			)) ?? [];
			return { items: rows, meta: { total: rows.length } };
		},
	});

	const total = query.data?.meta?.total ?? query.data?.items.length ?? 0;
	const safePage = Math.min(page, clientPageCount(total, pageSize));
	const pagedQuery = clientPaged(query, safePage, pageSize);

	const columns: DataTableColumn<AdminInstanceRow>[] = [
		{
			id: "instance_type",
			header: t("adminEvents.instances.columns.type"),
			cell: (row) => (
				<TonePill tone={typeTone(row.instance_type)}>
					{instanceTypeLabel(row.instance_type, t)}
				</TonePill>
			),
			sortValue: (row) => row.instance_type,
		},
		{
			id: "status",
			header: t("adminEvents.instances.columns.status"),
			cell: (row) => (
				<TonePill tone="neutral" title={row.status}>
					{instanceStatusLabel(row.status, t)}
				</TonePill>
			),
			sortValue: (row) => row.status,
		},
		{
			id: "identifier",
			header: t("adminEvents.instances.columns.identifier"),
			cell: (row) => <MonoText title={row.identifier}>{row.identifier}</MonoText>,
			sortValue: (row) => row.identifier,
			hideBelow: "md",
		},
		{
			id: "content",
			header: t("adminEvents.instances.columns.content"),
			cell: (row) => (
				<span>
					{row.content_title ?? row.challenge_id ?? row.gamebox_id ?? t("common.empty")}
				</span>
			),
			sortValue: (row) => row.content_title ?? row.challenge_id ?? row.gamebox_id ?? "",
		},
		{
			id: "owner",
			header: t("adminEvents.instances.columns.owner"),
			cell: (row) => <OwnerLabel row={row} />,
			sortValue: (row) => row.user_name ?? row.team_name ?? "",
		},
		{
			id: "runtime_generation",
			header: t("adminEvents.instances.columns.generation"),
			align: "right",
			cell: (row) =>
				row.runtime_generation === null || row.runtime_generation === undefined ? (
					<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
				) : (
					<MonoText>{row.runtime_generation}</MonoText>
				),
			sortValue: (row) => row.runtime_generation ?? 0,
			hideBelow: "lg",
		},
		{
			id: "created_at",
			header: t("adminEvents.instances.columns.createdAt"),
			cell: (row) => <MonoText className="whitespace-nowrap">
				{formatDateTime(row.created_at, { seconds: true })}
			</MonoText>,
			sortValue: (row) => row.created_at,
			hideBelow: "lg",
		},
		{
			id: "destroy_at",
			header: t("adminEvents.instances.columns.destroyAt"),
			cell: (row) =>
				row.destroy_at ? (
					<MonoText className="whitespace-nowrap">
					{formatDateTime(row.destroy_at, { seconds: true })}
				</MonoText>
				) : (
					<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
				),
			sortValue: (row) => row.destroy_at ?? "",
			hideBelow: "lg",
		},
	];

	const mobileCard = (row: AdminInstanceRow): ReactNode => (
		<MobileFacts
			items={[
				{
					k: t("adminEvents.instances.mobile.type"),
					v: (
						<TonePill tone={typeTone(row.instance_type)}>
							{instanceTypeLabel(row.instance_type, t)}
						</TonePill>
					),
				},
				{
					k: t("adminEvents.instances.mobile.status"),
					v: (
						<TonePill tone="neutral" title={row.status}>
							{row.status}
						</TonePill>
					),
				},
				{
					k: t("adminEvents.instances.mobile.identifier"),
					v: <MonoText>{row.identifier}</MonoText>,
				},
				{
					k: t("adminEvents.instances.mobile.content"),
					v: row.content_title ?? row.challenge_id ?? row.gamebox_id ?? t("common.empty"),
				},
				{ k: t("adminEvents.instances.mobile.owner"), v: <OwnerLabel row={row} /> },
				{
					k: t("adminEvents.instances.mobile.destroyAt"),
					v: row.destroy_at ? (
						<MonoText>{formatDateTime(row.destroy_at)}</MonoText>
					) : (
						t("common.empty")
					),
				},
			]}
		/>
	);

	return (
		<SectionCard
			title={t("adminEvents.instances.title")}
			description={t("adminEvents.instances.description")}
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
				mobileCard={mobileCard}
				errorTitle={t("adminEvents.instances.loadError")}
				empty={
					<EmptyBlock
						title={t("adminEvents.instances.empty.title")}
						description={t("adminEvents.instances.empty.description")}
						icon={<Boxes className="size-6" />}
						action={
							<Button variant="outline" size="sm" onClick={() => void query.refetch()}>
								{t("adminEvents.instances.empty.reload")}
							</Button>
						}
					/>
				}
			/>
		</SectionCard>
	);
}
