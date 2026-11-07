/**
 * 「预检与轮换」标签：手动预检、预检历史与失败原因、内部令牌轮换。
 *
 * 已核实的后端语义：
 * - 预检要求赛事网络已分配，且状态处于运行前的配置态（含 prechecking）；
 * - `POST .../awd/precheck` 实际返回 `{ run_id, status, error_msg, failed_checks, checks }`
 *   对象（SDK 把它标注成 `string`，见交付报告 PUBLIC SDK GAP），这里按对象解析并做兜底；
 * - `AwdPrecheckRun.error_msg` 是 JSON 字符串，需 `JSON.parse` 后展示 errors / notes。
 *
 * 文案全部走 `adminAwdOps.*`；状态判定仍只看后端字段。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck, ShieldX } from "lucide-react";

import type { AwdPrecheckRun } from "@floatctf/sdk";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { errorText } from "~/api/errors";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { KeyValueList, MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, InlineError, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { formatDateTime } from "~/lib/format";

import { useAwdEventNetwork, useAwdStatus } from "./queries";
import {
	awdActionConfirm,
	buildAwdGates,
	parsePrecheckReport,
	precheckStatusLabel,
	precheckStatusTone,
	runAwdAction,
} from "./shared";

/** 后端实际返回的预检结果（比 SDK 声明的 `string` 更宽，因此这里显式声明并用兜底解析）。 */
interface AwdPrecheckResult {
	run_id?: string;
	status?: string;
	error_msg?: string | null;
	failed_checks?: string[];
}

export function AwdPrecheckTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const statusQuery = useAwdStatus(eventId);
	const networkQuery = useAwdEventNetwork(eventId);
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

	const runsQuery = useQuery({
		queryKey: qk.awd.prechecks(eventId),
		queryFn: () =>
			call<AwdPrecheckRun[]>(
				client.awd.admin.prechecks(eventId),
				t("adminAwdOps.actionNames.precheckHistory"),
			),
		enabled: eventId !== "",
	});

	const status = statusQuery.data ?? null;
	const gates = buildAwdGates(
		{
			status: status?.status ?? null,
			networkAllocated: networkQuery.data !== null && networkQuery.data !== undefined,
			finalSettlement: status?.final_settlement ?? false,
		},
		t,
	);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: qk.awd.prechecks(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
		void queryClient.invalidateQueries({ queryKey: qk.awd.eventNetwork(eventId) });
	};

	const precheck = useMutation({
		mutationFn: () =>
			call<AwdPrecheckResult>(
				client.awd.admin.precheck(eventId),
				t("adminAwdOps.actions.precheck"),
			),
		onSuccess: (result) => {
			const nextStatus = result?.status ?? "";
			const failed = result?.failed_checks ?? [];
			if (nextStatus === "passed") {
				toast.success(
					t("adminAwdOps.precheck.successTitle"),
					t("adminAwdOps.precheck.successDescription"),
				);
			} else {
				const detail =
					failed.length > 0
						? t("adminAwdOps.precheck.failedChecks", { checks: failed.join(" · ") })
						: result?.error_msg
							? t("adminAwdOps.precheck.failedRecorded")
							: t("adminAwdOps.precheck.failedNoDetail");
				toast.error(t("adminAwdOps.precheck.failedTitle"), detail);
			}
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminAwdOps.precheck.errorTitle"), error),
	});

	const rotate = useMutation({
		mutationFn: () => runAwdAction(client, eventId, "rotateTokens", t),
		onSuccess: () => {
			toast.success(
				t("adminAwdOps.precheck.rotateSuccessTitle"),
				t("adminAwdOps.precheck.rotateSuccessDescription"),
			);
			invalidate();
		},
		onError: (error) => toast.apiError(t("adminAwdOps.precheck.rotateFailed"), error),
	});

	const runs = runsQuery.data ?? [];
	const statusPending = statusQuery.isPending;
	const selected =
		runs.find((run) => run.id === selectedRunId) ?? (runs.length > 0 ? runs[0] : null);
	const report = parsePrecheckReport(selected?.error_msg);

	const columns: DataTableColumn<AwdPrecheckRun>[] = [
		{
			id: "status",
			header: t("adminAwdOps.precheck.columns.result"),
			sortValue: (row) => row.status,
			cell: (row) => (
				<TonePill tone={precheckStatusTone(row.status)}>
					{precheckStatusLabel(row.status, t)}
				</TonePill>
			),
		},
		{
			id: "trigger",
			header: t("adminAwdOps.precheck.columns.trigger"),
			cell: (row) => row.trigger ?? "—",
			hideBelow: "sm",
		},
		{
			id: "revision",
			header: t("adminAwdOps.precheck.columns.revision"),
			align: "right",
			cell: (row) =>
				row.revision === null || row.revision === undefined ? (
					<span className="text-muted-foreground">—</span>
				) : (
					<span className="tnum">{row.revision}</span>
				),
			hideBelow: "md",
		},
		{
			id: "started_at",
			header: t("adminAwdOps.precheck.columns.startedAt"),
			cell: (row) => (<span className="tnum whitespace-nowrap">{formatDateTime(row.started_at, { seconds: true })}</span>),
			sortValue: (row) => row.started_at ?? "",
		},
		{
			id: "completed_at",
			header: t("adminAwdOps.precheck.columns.completedAt"),
			cell: (row) => (<span className="tnum whitespace-nowrap">{formatDateTime(row.completed_at, { seconds: true })}</span>),
			hideBelow: "md",
		},
		{
			id: "errors",
			header: t("adminAwdOps.precheck.columns.errors"),
			align: "right",
			cell: (row) => {
				const parsed = parsePrecheckReport(row.error_msg);
				if (parsed.errors.length === 0) return <span className="text-muted-foreground">—</span>;
				return <TonePill tone="danger">{parsed.errors.length}</TonePill>;
			},
		},
	];

	return (
		<div className="space-y-6">
			<SectionCard
				title={t("adminAwdOps.precheck.title")}
				description={t("adminAwdOps.precheck.description")}
				actions={
					<Button
						size="sm"
						disabled={
							statusPending ||
							statusQuery.isError ||
							!gates.precheck.enabled ||
							precheck.isPending
						}
						title={
							statusQuery.isError
								? t("adminAwdOps.lifecycle.statusLoadFailed")
								: statusPending
									? t("adminAwdOps.lifecycle.loadingStatus")
									: (gates.precheck.reason ?? t("adminAwdOps.precheck.runTitle"))
						}
						onClick={async () => {
							const ok = await confirm(awdActionConfirm(t, "precheck"));
							if (ok) precheck.mutate();
						}}
					>
						<ShieldCheck data-icon="inline-start" />
						{t("adminAwdOps.precheck.run")}
					</Button>
				}
			>
				<div className="space-y-3">
					{statusQuery.isError ? <InlineError error={statusQuery.error} /> : null}
					<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<TonePill tone={gates.precheck.enabled ? "success" : "warning"}>
							{gates.precheck.enabled
								? t("adminAwdOps.precheck.available")
								: t("adminAwdOps.precheck.unavailable")}
						</TonePill>
						{gates.precheck.reason ? (
							<span>
								{statusQuery.isError
									? t("adminAwdOps.lifecycle.statusLoadFailed")
									: statusPending
										? t("adminAwdOps.lifecycle.loadingStatus")
										: gates.precheck.reason}
							</span>
						) : null}
					</div>
					<KeyValueList
						columns={2}
						items={[
							{
								key: t("adminAwdOps.precheck.network"),
								value: networkQuery.isPending ? (
									<span className="text-muted-foreground">
										{t("adminAwdOps.precheck.networkReading")}
									</span>
								) : networkQuery.isError ? (
									<span className="text-destructive">
										{t("adminAwdOps.precheck.networkReadFailed")}
									</span>
								) : networkQuery.data == null ? (
									<span className="text-destructive">
										{t("adminAwdOps.precheck.networkMissing")}
									</span>
								) : (
									<TonePill tone="success">
										{t("adminAwdOps.precheck.networkAllocated")}
									</TonePill>
								),
								hint: networkQuery.isError ? errorText(networkQuery.error) : undefined,
							},
							{
								key: t("adminAwdOps.precheck.verifiedAt"),
								value: status?.verified_at ? (
									formatDateTime(status.verified_at, { seconds: true })
								) : (
									<span className="text-muted-foreground">
										{t("adminAwdOps.precheck.notVerified")}
									</span>
								),
							},
						]}
					/>
				</div>
			</SectionCard>

			<SectionCard
				title={t("adminAwdOps.precheck.historyTitle")}
				description={t("adminAwdOps.precheck.historyDescription")}
				actions={
					<Button
						variant="outline"
						size="sm"
						disabled={runsQuery.isFetching}
						onClick={() => void runsQuery.refetch()}
					>
						<RefreshCw data-icon="inline-start" />
						{t("adminAwdOps.precheck.refresh")}
					</Button>
				}
			>
				<QueryState
					query={runsQuery}
					skeleton={<TableSkeleton rows={4} columns={5} />}
					isEmpty={(data) => data.length === 0}
					empty={
						<EmptyBlock
							title={t("adminAwdOps.precheck.emptyTitle")}
							description={t("adminAwdOps.precheck.emptyDescription")}
							icon={<ShieldCheck className="size-6" />}
						/>
					}
				>
					{(data) => (
						<div className="space-y-4">
							<DataTable
								data={data}
								getRowId={(row) => row.id}
								columns={columns}
								onRowClick={(row) => setSelectedRunId(row.id)}
								mobileCard={(row) => (
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0 space-y-1">
											<TonePill tone={precheckStatusTone(row.status)}>
												{precheckStatusLabel(row.status, t)}
											</TonePill>
											<p className="tnum text-xs text-muted-foreground">
												{formatDateTime(row.started_at, { seconds: true })}
												{row.trigger ? ` · ${row.trigger}` : ""}
											</p>
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setSelectedRunId(row.id)}
										>
											{t("adminAwdOps.precheck.viewReport")}
										</Button>
									</div>
								)}
							/>
							{selected ? (
								<div className="space-y-3 rounded-lg border bg-muted/30 p-3">
									<div className="flex flex-wrap items-center gap-2">
										<TonePill tone={precheckStatusTone(selected.status)}>
											{precheckStatusLabel(selected.status, t)}
										</TonePill>
										<span className="tnum text-xs text-muted-foreground">
											{formatDateTime(selected.completed_at ?? selected.started_at, {
												seconds: true,
											})}
										</span>
										{selected.revision !== null &&
										selected.revision !== undefined ? (
											<>
												<span
													aria-hidden="true"
													className="text-xs text-muted-foreground"
												>
													·
												</span>
												<span className="text-xs text-muted-foreground">
													{t("adminAwdOps.precheck.revision", {
														revision: selected.revision,
													})}
												</span>
											</>
										) : null}
										<MonoText>{selected.id}</MonoText>
									</div>

									{report.errors.length > 0 ? (
										<ul className="space-y-1">
											{report.errors.map((entry, index) => (
												<li
													key={`${entry.component}-${index}`}
													className="flex items-start gap-2 text-sm"
												>
													<ShieldX className="mt-1 size-4 shrink-0 text-destructive" />
													<span className="min-w-0 break-words">
														<span className="font-mono text-xs">
															{entry.component}
														</span>
														<span className="text-muted-foreground"> · </span>
														{entry.error ??
															t("adminAwdOps.precheck.backendNoReason")}
													</span>
												</li>
											))}
										</ul>
									) : (
										<p className="text-sm text-muted-foreground">
											{t("adminAwdOps.precheck.noFailures")}
										</p>
									)}

									{report.notes.length > 0 ? (
										<details className="text-sm">
											<summary className="cursor-pointer text-muted-foreground">
												{t("adminAwdOps.precheck.notesSummary", {
													count: report.notes.length,
												})}
											</summary>
											<ul className="mt-2 space-y-1">
												{report.notes.map((entry, index) => (
													<li key={`${entry.component}-${index}`}>
														<span className="font-mono text-xs">
															{entry.component}
														</span>
														<span className="text-muted-foreground"> · </span>
														{entry.note}
													</li>
												))}
											</ul>
										</details>
									) : null}
								</div>
							) : null}
						</div>
					)}
				</QueryState>
			</SectionCard>

			<SectionCard
				title={t("adminAwdOps.precheck.rotateTitle")}
				description={t("adminAwdOps.precheck.rotateDescription")}
				actions={
					<Button
						variant="destructive"
						size="sm"
						disabled={
							statusPending ||
							statusQuery.isError ||
							!gates.rotateTokens.enabled ||
							rotate.isPending
						}
						title={
							statusQuery.isError
								? t("adminAwdOps.lifecycle.statusLoadFailed")
								: statusPending
									? t("adminAwdOps.lifecycle.loadingStatus")
									: (gates.rotateTokens.reason ??
										t("adminAwdOps.precheck.rotateTitleAttr"))
						}
						onClick={async () => {
							const ok = await confirm(awdActionConfirm(t, "rotateTokens"));
							if (ok) rotate.mutate();
						}}
					>
						{t("adminAwdOps.precheck.rotateAction")}
					</Button>
				}
			>
				<div className="space-y-2 text-sm text-muted-foreground">
					<p>{t("adminAwdOps.precheck.rotateNoteToken")}</p>
					<p>{t("adminAwdOps.precheck.rotateNoteDowntime")}</p>
					{gates.rotateTokens.reason ? (
						<p className="text-xs text-destructive">
							{statusQuery.isError
								? t("adminAwdOps.lifecycle.statusLoadFailed")
								: statusPending
									? t("adminAwdOps.lifecycle.loadingStatus")
									: gates.rotateTokens.reason}
						</p>
					) : null}
				</div>
			</SectionCard>
		</div>
	);
}
