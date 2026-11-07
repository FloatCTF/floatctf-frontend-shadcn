/**
 * 赛事控制台 · 日志 / Writeup 标签。
 *
 * - 日志：`event_logs.fetch(eventId)({page,limit})`（柯里化）
 * - Writeup：`event_writeups.fetch(eventId)({page,limit})`（柯里化）+ `events.getReport(eventId)`
 *   取 S3 对象键，再用 `download.download(key)` 触发浏览器下载
 *   （`download` 返回 void，失败抛普通 `Error`，这里用 toast 显示真实原因）。
 *
 * 文案全部走 `adminEvents.records` 命名空间；日志级别 / action / ID 是后端技术标识。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, RefreshCw } from "lucide-react";

import { callList, callMaybe } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill, type PillTone } from "~/components/app/badges";
import type { DataTableColumn } from "~/components/app/data-table";
import { MonoText, SectionCard, Toolbar } from "~/components/app/page";
import { EmptyBlock } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import type { EventLogs, EventWriteup } from "@floatctf/sdk/entity";
import { formatDateTime } from "~/lib/format";

import { MobileFacts, PagedTable } from "./shared";

function levelTone(level: string): PillTone {
	switch (level.trim().toLowerCase()) {
		case "info":
			return "info";
		case "warn":
		case "warning":
			return "warning";
		case "error":
		case "critical":
			return "danger";
		case "debug":
			return "muted";
		default:
			return "neutral";
	}
}

/* ── 日志 ───────────────────────────────────────────────────────────────── */

export function EventLogsTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);

	const query = useQuery({
		queryKey: qk.admin.eventLogs(eventId, { page, limit: pageSize }),
		queryFn: () =>
			callList<EventLogs>(client.admin.event_logs.fetch(eventId)({ page, limit: pageSize })),
	});

	const columns: DataTableColumn<EventLogs>[] = [
		{
			id: "level",
			header: t("adminEvents.records.logs.columns.level"),
			cell: (row) => (
				<TonePill tone={levelTone(row.level)} title={row.level}>
					{row.level}
				</TonePill>
			),
			sortValue: (row) => row.level,
		},
		{
			id: "action",
			header: t("adminEvents.records.logs.columns.action"),
			cell: (row) => <MonoText>{row.action}</MonoText>,
			sortValue: (row) => row.action,
		},
		{
			id: "details",
			header: t("adminEvents.records.logs.columns.details"),
			cell: (row) => (
				<span className="line-clamp-2 max-w-md text-xs break-all">{row.details}</span>
			),
		},
		{
			id: "user_id",
			header: t("adminEvents.records.logs.columns.actor"),
			cell: (row) =>
				row.user_id || row.team_id ? (
					<span className="flex flex-col gap-1">
						{row.user_id ? <MonoText>user {row.user_id}</MonoText> : null}
						{row.team_id ? <MonoText>team {row.team_id}</MonoText> : null}
					</span>
				) : (
					<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
				),
			hideBelow: "lg",
		},
		{
			id: "ip_address",
			header: t("adminEvents.records.logs.columns.ip"),
			cell: (row) =>
				row.ip_address ? (
					<MonoText>{row.ip_address}</MonoText>
				) : (
					<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
				),
			sortValue: (row) => row.ip_address ?? "",
			hideBelow: "xl",
		},
		{
			id: "created_at",
			header: t("adminEvents.records.logs.columns.time"),
			cell: (row) => <MonoText className="whitespace-nowrap">
				{formatDateTime(row.created_at, { seconds: true })}
			</MonoText>,
			sortValue: (row) => row.created_at,
		},
	];

	const mobileCard = (row: EventLogs): ReactNode => (
		<MobileFacts
			items={[
				{
					k: t("adminEvents.records.logs.mobile.level"),
					v: (
						<TonePill tone={levelTone(row.level)} title={row.level}>
							{row.level}
						</TonePill>
					),
				},
				{
					k: t("adminEvents.records.logs.mobile.action"),
					v: <MonoText>{row.action}</MonoText>,
				},
				{
					k: t("adminEvents.records.logs.mobile.details"),
					v: <span className="text-xs break-all">{row.details}</span>,
				},
				{
					k: t("adminEvents.records.logs.mobile.time"),
					v: <MonoText>{formatDateTime(row.created_at)}</MonoText>,
				},
			]}
		/>
	);

	return (
		<SectionCard
			title={t("adminEvents.records.logs.title")}
			description={t("adminEvents.records.logs.description")}
			actions={
				<Toolbar>
					<Button
						variant="outline"
						size="sm"
						disabled={query.isFetching}
						onClick={() => void query.refetch()}
					>
						<RefreshCw className={query.isFetching ? "animate-spin" : undefined} />{" "}
						{t("common.refresh")}
					</Button>
				</Toolbar>
			}
		>
			<PagedTable
				query={query}
				columns={columns}
				getRowId={(row) => row.id}
				page={page}
				pageSize={pageSize}
				onPageChange={setPage}
				onPageSizeChange={(size) => {
					setPageSize(size);
					setPage(1);
				}}
				mobileCard={mobileCard}
				errorTitle={t("adminEvents.records.logs.loadError")}
				empty={
					<EmptyBlock
						title={t("adminEvents.records.logs.empty.title")}
						description={t("adminEvents.records.logs.empty.description")}
					/>
				}
			/>
		</SectionCard>
	);
}

/* ── Writeup ────────────────────────────────────────────────────────────── */

export function EventWriteupsTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);

	const query = useQuery({
		queryKey: qk.admin.eventWriteups(eventId, { page, limit: pageSize }),
		queryFn: () =>
			callList<EventWriteup>(
				client.admin.event_writeups.fetch(eventId)({ page, limit: pageSize }),
			),
	});

	const download = useMutation({
		mutationFn: (key: string) => client.admin.download.download(key),
		onSuccess: () => toast.success(t("adminEvents.records.writeups.toast.downloadSuccess")),
		onError: (error) => toast.apiError(t("adminEvents.records.writeups.toast.downloadFailed"), error),
	});

	const exportAll = useMutation({
		mutationFn: async () => {
			// 1) 取 S3 对象键（后端 HTML/zip 报告）
			const key = await callMaybe<string>(
				client.admin.events.getReport(eventId),
				t("adminEvents.actions.generateWriteupReport"),
			);
			if (!key) throw new Error(t("adminEvents.records.writeups.reportKeyMissing"));
			// 2) 预签名 URL + 触发浏览器下载
			await client.admin.download.download(key);
		},
		onSuccess: () => toast.success(t("adminEvents.records.writeups.toast.exportSuccess")),
		onError: (error) => toast.apiError(t("adminEvents.records.writeups.toast.exportFailed"), error),
	});

	const columns: DataTableColumn<EventWriteup>[] = [
		{
			id: "user_id",
			header: t("adminEvents.records.writeups.columns.userId"),
			cell: (row) => <MonoText>{row.user_id}</MonoText>,
			sortValue: (row) => row.user_id,
		},
		{
			id: "team_id",
			header: t("adminEvents.records.writeups.columns.teamId"),
			cell: (row) =>
				row.team_id ? (
					<MonoText>{row.team_id}</MonoText>
				) : (
					<span className="text-xs text-muted-foreground">{t("common.empty")}</span>
				),
			sortValue: (row) => row.team_id ?? "",
			hideBelow: "md",
		},
		{
			id: "file",
			header: t("adminEvents.records.writeups.columns.file"),
			cell: (row) => {
				const name = row.file_url.split("/").pop() || row.file_url;
				return (
					<Button
						variant="link"
						size="xs"
						disabled={download.isPending}
						onClick={() => download.mutate(row.file_url)}
						aria-label={t("adminEvents.records.writeups.downloadAria", { name })}
					>
						<Download /> {name}
					</Button>
				);
			},
		},
		{
			id: "created_at",
			header: t("adminEvents.records.writeups.columns.createdAt"),
			cell: (row) => <MonoText className="whitespace-nowrap">
				{formatDateTime(row.created_at, { seconds: true })}
			</MonoText>,
			sortValue: (row) => row.created_at,
		},
	];

	const mobileCard = (row: EventWriteup): ReactNode => (
		<div className="space-y-2">
			<MobileFacts
				items={[
					{
						k: t("adminEvents.records.writeups.mobile.user"),
						v: <MonoText>{row.user_id}</MonoText>,
					},
					{
						k: t("adminEvents.records.writeups.mobile.team"),
						v: row.team_id ? (
							<MonoText>{row.team_id}</MonoText>
						) : (
							t("common.empty")
						),
					},
					{
						k: t("adminEvents.records.writeups.mobile.file"),
						v: <MonoText>{row.file_url.split("/").pop() || row.file_url}</MonoText>,
					},
					{
						k: t("adminEvents.records.writeups.mobile.createdAt"),
						v: <MonoText>{formatDateTime(row.created_at)}</MonoText>,
					},
				]}
			/>
			<div className="flex justify-end">
				<Button
					variant="outline"
					size="xs"
					disabled={download.isPending}
					onClick={() => download.mutate(row.file_url)}
					title={t("common.download")}
				>
					<Download /> {t("common.download")}
				</Button>
			</div>
		</div>
	);

	return (
		<SectionCard
			title={t("adminEvents.records.writeups.title")}
			description={t("adminEvents.records.writeups.description")}
			actions={
				<Toolbar>
					<Button
						size="sm"
						disabled={exportAll.isPending}
						onClick={() => exportAll.mutate()}
					>
						<Download /> {t("adminEvents.records.writeups.exportAll")}
					</Button>
				</Toolbar>
			}
		>
			<PagedTable
				query={query}
				columns={columns}
				getRowId={(row) => `${row.event_id}-${row.user_id}-${row.team_id ?? ""}`}
				page={page}
				pageSize={pageSize}
				onPageChange={setPage}
				onPageSizeChange={(size) => {
					setPageSize(size);
					setPage(1);
				}}
				mobileCard={mobileCard}
				errorTitle={t("adminEvents.records.writeups.loadError")}
				empty={
					<EmptyBlock
						title={t("adminEvents.records.writeups.empty.title")}
						description={t("adminEvents.records.writeups.empty.description")}
						icon={<FileText className="size-6" />}
					/>
				}
			/>
		</SectionCard>
	);
}
