/**
 * 「实例」标签：赛事 GameBox 实例列表与管理员重置（specialized）。
 *
 * 已核实的后端语义：
 * - 实例列表来自管理端归一化视图 `GET /admin/events/{id}/instances`（`AdminInstanceRow`，
 *   不返回 flag，`instance_type == "gamebox"` 才是 AWD 靶机）；
 * - `POST .../awd/gameboxes/{instance_id}/reset` 的 `instance_id` 就是该视图的 `id`；
 * - 重置资格由后端 `check_reset_eligibility` 决定：必须 status == running 且
 *   phase ∈ {hardening, attack}（暂停 / 终局结算均不允许）；
 * - 管理员重置不扣战队免费重置次数（charge_team=false），但会写入重置记录与审计。
 *
 * 文案全部走 `adminAwdOps.*`；实例状态用 SDK 枚举映射，未知值原样透传。
 */

import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, RefreshCw, RotateCcw } from "lucide-react";

import type { AdminInstanceRow } from "@floatctf/sdk";
import { AwdEventStatus, AwdPhase } from "@floatctf/sdk/entity";

import { callList, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, InlineError, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { formatDateTime } from "~/lib/format";

import { useAwdStatus } from "./queries";
import { awdStatusLabel, gameboxStatusLabel, gameboxStatusTone } from "./shared";

const RESETTABLE_PHASES: string[] = [AwdPhase.Hardening, AwdPhase.Attack];

export function AwdInstancesTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const statusQuery = useAwdStatus(eventId);

	const instancesQuery = useQuery({
		queryKey: qk.admin.eventInstances(eventId),
		queryFn: () =>
			callList<AdminInstanceRow>(
				client.admin.instances.listForEvent(eventId, { limit: 200 }),
			).then((result) => result.items),
		enabled: eventId !== "",
	});

	const status = statusQuery.data ?? null;
	const resetAllowed =
		status !== null &&
		status.status === AwdEventStatus.Running &&
		RESETTABLE_PHASES.includes(status.phase) &&
		!status.final_settlement;

	const statusPending = statusQuery.isPending;
	const statusError = statusQuery.isError;
	const blockedReason = statusError
		? t("adminAwdOps.lifecycle.statusLoadFailed")
		: statusPending
			? t("adminAwdOps.lifecycle.loadingStatus")
			: status === null
				? t("adminAwdOps.instances.blocked.notEnabled")
				: status.status !== AwdEventStatus.Running
					? t("adminAwdOps.instances.blocked.notRunning", {
							status: awdStatusLabel(status.status, t),
						})
					: status.phase === AwdPhase.Pause
						? t("adminAwdOps.instances.blocked.paused")
						: status.final_settlement
							? t("adminAwdOps.instances.blocked.settling")
							: t("adminAwdOps.instances.resetTitle");

	const reset = useMutation({
		mutationFn: (row: AdminInstanceRow) =>
			callVoid(
				client.awd.admin.resetGamebox(eventId, row.id),
				t("adminAwdOps.actionNames.resetGamebox"),
			),
		onSuccess: (_result, row) => {
			toast.success(
				t("adminAwdOps.instances.toast.successTitle"),
				row.content_title ?? row.identifier,
			);
			void queryClient.invalidateQueries({ queryKey: qk.admin.eventInstances(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
		},
		onError: (error) => toast.apiError(t("adminAwdOps.instances.toast.failed"), error),
	});

	const rows = (instancesQuery.data ?? []).filter((row) => row.instance_type === "gamebox");

	const columns: DataTableColumn<AdminInstanceRow>[] = [
		{
			id: "content_title",
			header: t("adminAwdOps.instances.columns.gamebox"),
			sortValue: (row) => row.content_title ?? "",
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate font-medium">{row.content_title ?? "—"}</p>
					<p className="text-xs text-muted-foreground">
						{row.team_name ?? row.user_name ?? t("adminAwdOps.instances.notBound")}
					</p>
				</div>
			),
		},
		{
			id: "status",
			header: t("adminAwdOps.instances.columns.status"),
			cell: (row) => (
				<TonePill tone={gameboxStatusTone(row.status)}>
					{gameboxStatusLabel(row.status, t)}
				</TonePill>
			),
			sortValue: (row) => row.status,
		},
		{
			id: "runtime_generation",
			header: t("adminAwdOps.instances.columns.generation"),
			align: "right",
			hideBelow: "md",
			cell: (row) =>
				row.runtime_generation === null || row.runtime_generation === undefined ? (
					<span className="text-muted-foreground">—</span>
				) : (
					<span className="tnum">{row.runtime_generation}</span>
				),
			sortValue: (row) => row.runtime_generation ?? 0,
		},
		{
			id: "identifier",
			header: t("adminAwdOps.instances.columns.identifier"),
			hideBelow: "lg",
			cell: (row) => <MonoText>{row.identifier}</MonoText>,
		},
		{
			id: "updated_at",
			header: t("adminAwdOps.instances.columns.updatedAt"),
			hideBelow: "xl",
			cell: (row) => (
				<span className="tnum whitespace-nowrap">{formatDateTime(row.updated_at, { seconds: true })}</span>
			),
			sortValue: (row) => row.updated_at,
		},
		{
			id: "instance_id",
			header: t("adminAwdOps.instances.columns.instanceId"),
			hideBelow: "xl",
			cell: (row) => <MonoText>{row.id}</MonoText>,
		},
	];

	const renderActions = (row: AdminInstanceRow) => (
		<Button
			variant="outline"
			size="sm"
			disabled={statusPending || statusError || !resetAllowed || reset.isPending}
			title={blockedReason}
			onClick={async () => {
				const ok = await confirm({
					title: t("adminAwdOps.instances.confirm.title", {
						name: row.content_title ?? row.identifier,
					}),
					description: t("adminAwdOps.instances.confirm.description"),
					consequences: [
						t("adminAwdOps.instances.confirm.consequence1"),
						t("adminAwdOps.instances.confirm.consequence2"),
						t("adminAwdOps.instances.confirm.consequence3"),
						t("adminAwdOps.instances.confirm.consequence4"),
					],
					tone: "danger",
					confirmText: t("adminAwdOps.instances.confirm.confirm"),
				});
				if (ok) reset.mutate(row);
			}}
		>
			<RotateCcw data-icon="inline-start" />
			{t("adminAwdOps.instances.reset")}
		</Button>
	);

	return (
		<SectionCard
			title={t("adminAwdOps.instances.title")}
			description={t("adminAwdOps.instances.description")}
			actions={
				<Button
					variant="outline"
					size="sm"
					disabled={instancesQuery.isFetching}
					onClick={() => void instancesQuery.refetch()}
				>
					<RefreshCw data-icon="inline-start" />
					{t("adminAwdOps.instances.refresh")}
				</Button>
			}
		>
			<QueryState
				query={instancesQuery}
				skeleton={<TableSkeleton rows={5} columns={6} />}
				isEmpty={() => rows.length === 0}
				empty={
					<EmptyBlock
						title={t("adminAwdOps.instances.emptyTitle")}
						description={t("adminAwdOps.instances.emptyDescription")}
						icon={<Boxes className="size-6" />}
					/>
				}
			>
				{() => (
					<div className="space-y-3">
						{statusError ? <InlineError error={statusQuery.error} /> : null}
						{!resetAllowed ? (
							<p className="text-xs text-muted-foreground">
								{t("adminAwdOps.instances.resetUnavailable", { reason: blockedReason })}
							</p>
						) : null}
						<DataTable
							data={rows}
							getRowId={(row) => row.id}
							columns={columns}
							mobileCard={(row) => (
								<div className="min-w-0 space-y-2">
									<p className="truncate text-sm font-medium">
										{row.content_title ?? "—"}
									</p>
									<div className="flex flex-wrap items-center gap-2">
										<span className="min-w-0 truncate text-xs text-muted-foreground">
											{row.team_name ??
												row.user_name ??
												t("adminAwdOps.instances.notBound")}
										</span>
										<TonePill tone={gameboxStatusTone(row.status)}>
											{gameboxStatusLabel(row.status, t)}
										</TonePill>
									</div>
									<div className="flex justify-end">{renderActions(row)}</div>
								</div>
							)}
							rowActions={renderActions}
						/>
					</div>
				)}
			</QueryState>
		</SectionCard>
	);
}
