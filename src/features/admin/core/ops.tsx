/**
 * 题库 / GameBox 库共用的「一次性操作结果」表格 —— 扫描、校验、构建。
 *
 * 铁律：后端返回的**每一条**结果都要如实展示（含 `message` 里的失败原因），
 * 不允许用一句「操作成功」把失败吞掉。用户可见文案全部来自 `adminCore.ops.*`。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { TonePill, type PillTone } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { MonoText } from "~/components/app/page";

/** `ChallengeScanItem` / `GameBoxScanItem` 的结构（两者字段完全一致）。 */
export interface ScanRow {
	safe_name: string;
	name: string | null;
	version: string | null;
	status: "added" | "skipped" | "error";
	message: string;
}

export function ScanResultTable({ items }: { items: ScanRow[] }): ReactNode {
	const { t } = useTranslation();
	const statusMeta = (status: ScanRow["status"]): { tone: PillTone; label: string } => {
		switch (status) {
			case "added":
				return { tone: "success", label: t("adminCore.ops.scan.status.added") };
			case "skipped":
				return { tone: "muted", label: t("adminCore.ops.scan.status.skipped") };
			case "error":
				return { tone: "danger", label: t("adminCore.ops.scan.status.error") };
		}
	};

	const columns: DataTableColumn<ScanRow>[] = [
		{
			id: "safe_name",
			header: "safe_name",
			cell: (row) => <MonoText>{row.safe_name}</MonoText>,
			sortValue: (row) => row.safe_name,
		},
		{
			id: "name",
			header: t("adminCore.ops.scan.columns.name"),
			cell: (row) =>
				row.name ? (
					<span className="text-sm">{row.name}</span>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				),
			sortValue: (row) => row.name ?? "",
			hideBelow: "sm",
		},
		{
			id: "version",
			header: t("adminCore.ops.scan.columns.version"),
			cell: (row) =>
				row.version ? (
					<MonoText>{row.version}</MonoText>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				),
			hideBelow: "md",
		},
		{
			id: "status",
			header: t("adminCore.ops.scan.columns.status"),
			cell: (row) => {
				const entry = statusMeta(row.status);
				return (
					<TonePill tone={entry.tone} title={row.status}>
						{entry.label}
					</TonePill>
				);
			},
			sortValue: (row) => row.status,
		},
		{
			id: "message",
			header: t("adminCore.ops.scan.columns.message"),
			cell: (row) => (
				<span className="text-xs text-muted-foreground">{row.message || "—"}</span>
			),
		},
	];

	return (
		<DataTable
			data={items}
			getRowId={(row) => row.safe_name}
			columns={columns}
			mobileCard={(row) => {
				const entry = statusMeta(row.status);
				return (
					<div className="space-y-1.5">
						<div className="flex items-center justify-between gap-2">
							<MonoText>{row.safe_name}</MonoText>
							<TonePill tone={entry.tone} title={row.status}>
								{entry.label}
							</TonePill>
						</div>
						<p className="text-sm">{row.name ?? "—"}</p>
						<p className="text-xs text-muted-foreground">{row.message || "—"}</p>
					</div>
				);
			}}
			empty={<span>{t("adminCore.ops.scan.empty")}</span>}
		/>
	);
}

/** `BuildChallengeResult` / `GameBoxBuildResult` 的结构。 */
export interface BuildRow {
	is_ok: boolean;
	message: string;
}

export function BuildResultTable<T extends BuildRow>({
	items,
	nameOf,
	label,
}: {
	items: T[];
	nameOf: (row: T) => string;
	label: string;
}): ReactNode {
	const { t } = useTranslation();
	const columns: DataTableColumn<T>[] = [
		{
			id: "name",
			header: label,
			cell: (row) => <span className="text-sm font-medium">{nameOf(row)}</span>,
			sortValue: (row) => nameOf(row),
		},
		{
			id: "is_ok",
			header: t("adminCore.ops.build.columns.result"),
			cell: (row) => (
				<TonePill tone={row.is_ok ? "success" : "danger"}>
					{row.is_ok
						? t("adminCore.ops.build.success")
						: t("adminCore.ops.build.failure")}
				</TonePill>
			),
			sortValue: (row) => (row.is_ok ? 1 : 0),
		},
		{
			id: "message",
			header: t("adminCore.ops.build.columns.message"),
			cell: (row) => (
				<span className={row.is_ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
					{row.message || "—"}
				</span>
			),
		},
	];

	return (
		<DataTable
			data={items}
			getRowId={(row) => nameOf(row)}
			columns={columns}
			mobileCard={(row) => (
				<div className="space-y-1.5">
					<div className="flex items-center justify-between gap-2">
						<span className="text-sm font-medium">{nameOf(row)}</span>
						<TonePill tone={row.is_ok ? "success" : "danger"}>
							{row.is_ok
								? t("adminCore.ops.build.success")
								: t("adminCore.ops.build.failure")}
						</TonePill>
					</div>
					<p className="text-xs text-muted-foreground">{row.message || "—"}</p>
				</div>
			)}
			empty={<span>{t("adminCore.ops.build.empty")}</span>}
		/>
	);
}
