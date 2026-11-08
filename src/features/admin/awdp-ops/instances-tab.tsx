/**
 * 「实例」标签：AWDP 赛事实例列表（管理端 inspect 视图）。
 *
 * 已核实的后端语义：`GET /admin/events/{id}/awdp/instances` 经 run 聚合返回全部实例，
 * 含 `runtime_state`、`runtime_generation`、容器名与公开端点；DTO **不含 flag**。
 * 后端还返回 `reset_count`（玩家手动重置次数），但公共 SDK 类型未声明该字段，
 * 因此这里做一次带类型保护的可选读取（见交付报告的 PUBLIC SDK GAP）。
 *
 * 文案全部走 i18n（`adminAwdpOps.instances.*`）；未知运行态保持后端原文。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";

import type { AwdpAdminInstanceDto } from "@floatctf/sdk";

import { TonePill } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, QueryState, TableSkeleton } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import { formatInt } from "~/lib/format";

import { useAwdpInstances } from "./queries";
import { awdpRuntimeLabel, awdpRuntimeTone } from "./shared";

/** 后端返回但 SDK 未声明的字段：带类型保护地读取，拿不到就显示「—」。 */
function readResetCount(row: AwdpAdminInstanceDto): number | null {
	const value = (row as { reset_count?: unknown }).reset_count;
	return typeof value === "number" ? value : null;
}

export function AwdpInstancesTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const instancesQuery = useAwdpInstances(eventId);

	const subjectLabel = (row: AwdpAdminInstanceDto): string => {
		if (row.owner_team_id) return t("adminAwdpOps.instances.subjectTeam");
		if (row.owner_user_id) return t("adminAwdpOps.instances.subjectUser");
		return t("adminAwdpOps.instances.subjectUnbound");
	};

	const runtimePill = (row: AwdpAdminInstanceDto) => (
		<TonePill tone={awdpRuntimeTone(row.runtime_state)} title={row.runtime_state}>
			{awdpRuntimeLabel(row.runtime_state, t)}
		</TonePill>
	);

	const columns: DataTableColumn<AwdpAdminInstanceDto>[] = [
		{
			id: "gamebox_name",
			header: t("adminAwdpOps.instances.columns.gamebox"),
			sortValue: (row) => row.gamebox_name,
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate font-medium">{row.gamebox_name}</p>
					<p className="truncate text-xs text-muted-foreground">{subjectLabel(row)}</p>
				</div>
			),
		},
		{
			id: "runtime_state",
			header: t("adminAwdpOps.instances.columns.runtimeState"),
			cell: runtimePill,
			sortValue: (row) => row.runtime_state,
		},
		{
			id: "runtime_generation",
			header: t("adminAwdpOps.instances.columns.generation"),
			align: "right",
			cell: (row) => <span className="tnum">{formatInt(row.runtime_generation)}</span>,
			sortValue: (row) => row.runtime_generation,
		},
		{
			id: "reset_count",
			header: t("adminAwdpOps.instances.columns.resetCount"),
			align: "right",
			hideBelow: "md",
			cell: (row) => {
				const count = readResetCount(row);
				return <span className="tnum">{count === null ? t("common.empty") : formatInt(count)}</span>;
			},
			sortValue: (row) => readResetCount(row) ?? -1,
		},
		{
			id: "endpoints",
			header: t("adminAwdpOps.instances.columns.endpoints"),
			hideBelow: "lg",
			cell: (row) =>
				row.endpoints.length === 0 ? (
					<span className="text-muted-foreground">{t("common.empty")}</span>
				) : (
					<div className="space-y-0.5">
						{row.endpoints.map((endpoint) => (
							<MonoText
								key={`${endpoint.protocol}-${endpoint.public_port}-${endpoint.container_port}`}
							>
								{t("adminAwdpOps.instances.endpoint", {
									protocol: endpoint.protocol,
									host: endpoint.public_host,
									port: endpoint.public_port,
									containerPort: endpoint.container_port,
								})}
							</MonoText>
						))}
					</div>
				),
		},
		{
			id: "container_name",
			header: t("adminAwdpOps.instances.columns.containerName"),
			hideBelow: "xl",
			cell: (row) => <MonoText>{row.container_name}</MonoText>,
		},
		{
			id: "instance_id",
			header: t("adminAwdpOps.instances.columns.instanceId"),
			hideBelow: "xl",
			cell: (row) => <MonoText>{row.instance_id}</MonoText>,
		},
	];

	return (
		<SectionCard
			title={t("adminAwdpOps.instances.sectionTitle")}
			description={t("adminAwdpOps.instances.sectionDescription")}
			actions={
				<Button
					variant="outline"
					size="sm"
					disabled={instancesQuery.isFetching}
					onClick={() => void instancesQuery.refetch()}
				>
					<RefreshCw
						className={instancesQuery.isFetching ? "animate-spin" : undefined}
						aria-hidden="true"
					/>
					{t("adminAwdpOps.instances.refresh")}
				</Button>
			}
		>
			<QueryState
				query={instancesQuery}
				skeleton={<TableSkeleton rows={5} columns={6} />}
				isEmpty={(rows) => rows.length === 0}
				errorTitle={t("adminAwdpOps.instances.loadError")}
				empty={
					<EmptyBlock
						title={t("adminAwdpOps.instances.emptyTitle")}
						description={t("adminAwdpOps.instances.emptyDescription")}
					/>
				}
			>
				{(rows) => (
					<DataTable
						data={rows}
						getRowId={(row) => row.instance_id}
						columns={columns}
						mobileCard={(row) => (
							<div className="space-y-1.5">
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{row.gamebox_name}</p>
										<p className="truncate text-xs text-muted-foreground">
											{t("adminAwdpOps.instances.mobileMeta", {
												subject: subjectLabel(row),
												generation: formatInt(row.runtime_generation),
												resetCount:
													readResetCount(row) === null
														? t("common.empty")
														: formatInt(readResetCount(row)),
											})}
										</p>
									</div>
									{runtimePill(row)}
								</div>
								{row.endpoints.length > 0 ? (
									<div className="space-y-0.5">
										{row.endpoints.map((endpoint) => (
											<MonoText
												key={`${endpoint.protocol}-${endpoint.public_port}-${endpoint.container_port}`}
											>
												{t("adminAwdpOps.instances.endpoint", {
													protocol: endpoint.protocol,
													host: endpoint.public_host,
													port: endpoint.public_port,
													containerPort: endpoint.container_port,
												})}
											</MonoText>
										))}
									</div>
								) : null}
							</div>
						)}
					/>
				)}
			</QueryState>
		</SectionCard>
	);
}
