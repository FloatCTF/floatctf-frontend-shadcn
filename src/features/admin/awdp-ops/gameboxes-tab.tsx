/**
 * 「GameBox 挂载」标签：AWDP 赛事与 GameBox 的挂载关系（attach / detach / list）。
 *
 * 已核实的后端语义：
 * - attach 后端要求 GameBox `build_status == "ready"` **且**具备完整 [awdp] capability
 *   （存在 `awdp_source_artifact_key`），并受 UNIQUE(event_id, gamebox_id) 约束；
 * - 比赛进行中（Break / Fix）新挂载且未隐藏时，会为全部参与者自动启动该 GameBox 实例（幂等）；
 * - detach 是直接删除挂载行：`awdp_instances` / `awdp_breaks` / `awdp_score_events` 都以
 *   `event_gamebox_id` 外键 **ON DELETE CASCADE**，因此该题的实例、Break 记录与计分账本
 *   会一并消失。
 *
 * 文案全部走 i18n（`adminAwdpOps.gameboxes.*`）。
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Link2, Plus, Trash2 } from "lucide-react";

import type { AwdpAdminEventGameBoxDto } from "@floatctf/sdk";

import { call, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormSheet } from "~/components/app/form";
import { MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, InlineError, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { formatBytes } from "~/lib/format";

import { useAwdpEventGameboxes, useAwdpGameboxLibrary } from "./queries";
import { awdpBuildStatusLabel, awdpBuildStatusTone } from "./shared";

function AttachGameboxSheet({
	eventId,
	attachedIds,
	onClose,
}: {
	eventId: string;
	attachedIds: Set<string>;
	onClose: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const libraryQuery = useAwdpGameboxLibrary(true);
	const [gameboxId, setGameboxId] = useState("");
	const [hidden, setHidden] = useState(false);

	const mutation = useMutation({
		mutationFn: (input: { gameboxId: string; hidden: boolean }) =>
			call<AwdpAdminEventGameBoxDto>(
				client.awdp.admin.attachGamebox(eventId, input.gameboxId, input.hidden),
				t("adminAwdpOps.calls.attach"),
			),
		onSuccess: (row) => {
			toast.success(t("adminAwdpOps.gameboxes.attachToast", { name: row.name }));
			void queryClient.invalidateQueries({ queryKey: qk.awdp.adminGameboxes(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awdp.adminInstances(eventId) });
			onClose();
		},
		onError: (error) => toast.apiError(t("adminAwdpOps.gameboxes.attachFailed"), error),
	});

	const ready = (libraryQuery.data?.items ?? []).filter(
		(item) => item.build_status === "ready" && !attachedIds.has(item.id),
	);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (gameboxId === "") return;
		const selected = ready.find((item) => item.id === gameboxId);
		const ok = await confirm({
			title: t("adminAwdpOps.gameboxes.attachConfirm.title", {
				name: selected?.name ?? gameboxId,
			}),
			description: t("adminAwdpOps.gameboxes.attachConfirm.description"),
			consequences: [
				t("adminAwdpOps.gameboxes.attachConfirm.consequence1"),
				t("adminAwdpOps.gameboxes.attachConfirm.consequence2"),
				t("adminAwdpOps.gameboxes.attachConfirm.consequence3"),
				t("adminAwdpOps.gameboxes.attachConfirm.consequence4"),
			],
			confirmText: t("adminAwdpOps.gameboxes.attachConfirm.confirmText"),
		});
		if (ok) mutation.mutate({ gameboxId, hidden });
	};

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("adminAwdpOps.gameboxes.attachTitle")}
			description={t("adminAwdpOps.gameboxes.attachDescription")}
			footer={
				<FormFooter
					onCancel={onClose}
					formId="awdp-attach-form"
					submitLabel={t("adminAwdpOps.gameboxes.attach")}
					isPending={mutation.isPending}
					disabled={gameboxId === ""}
				/>
			}
		>
			<form id="awdp-attach-form" onSubmit={(event) => void submit(event)} className="space-y-4">
				<Field label={t("adminAwdpOps.gameboxes.fieldGamebox")} htmlFor="awdp-attach-gamebox" required>
					<Select value={gameboxId} onValueChange={setGameboxId} disabled={libraryQuery.isPending}>
						<SelectTrigger
							id="awdp-attach-gamebox"
							aria-label={t("adminAwdpOps.gameboxes.fieldGameboxAria")}
						>
							<SelectValue
								placeholder={
									libraryQuery.isPending
										? t("adminAwdpOps.gameboxes.loadingLibrary")
										: t("adminAwdpOps.gameboxes.selectPlaceholder")
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{ready.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{t("adminAwdpOps.gameboxes.option", {
										name: item.name,
										safeName: item.safe_name,
									})}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				{libraryQuery.isError ? (
					<InlineError error={libraryQuery.error} />
				) : !libraryQuery.isPending && ready.length === 0 ? (
					<p className="text-xs text-muted-foreground">{t("adminAwdpOps.gameboxes.noReady")}</p>
				) : null}
				<Field
					label={t("adminAwdpOps.gameboxes.hiddenLabel")}
					htmlFor="awdp-attach-hidden"
					hint={t("adminAwdpOps.gameboxes.hiddenHint")}
				>
					<Switch id="awdp-attach-hidden" checked={hidden} onCheckedChange={setHidden} />
				</Field>
			</form>
		</FormSheet>
	);
}

export function AwdpGameboxesTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const gameboxesQuery = useAwdpEventGameboxes(eventId);
	const [attaching, setAttaching] = useState(false);
	// 空态把「挂载」主操作放在空态块里，避免同一张卡片出现两个主按钮。
	const hasRows = (gameboxesQuery.data ?? []).length > 0;

	const detach = useMutation({
		mutationFn: (row: AwdpAdminEventGameBoxDto) =>
			callVoid(
				client.awdp.admin.detachGamebox(eventId, row.id),
				t("adminAwdpOps.calls.detach"),
			),
		onSuccess: (_result, row) => {
			toast.success(t("adminAwdpOps.gameboxes.detachToast", { name: row.name }));
			void queryClient.invalidateQueries({ queryKey: qk.awdp.adminGameboxes(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awdp.adminInstances(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awdp.adminScores(eventId) });
		},
		onError: (error) => toast.apiError(t("adminAwdpOps.gameboxes.detachFailed"), error),
	});

	const askDetach = async (row: AwdpAdminEventGameBoxDto) => {
		const ok = await confirm({
			title: t("adminAwdpOps.gameboxes.detachConfirm.title", { name: row.name }),
			description: t("adminAwdpOps.gameboxes.detachConfirm.description"),
			consequences: [
				t("adminAwdpOps.gameboxes.detachConfirm.consequence1"),
				t("adminAwdpOps.gameboxes.detachConfirm.consequence2"),
				t("adminAwdpOps.gameboxes.detachConfirm.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminAwdpOps.gameboxes.detachConfirm.confirmText"),
			confirmPhrase: "detach",
		});
		if (ok) detach.mutate(row);
	};

	const detachButton = (row: AwdpAdminEventGameBoxDto) => (
		<Button
			variant="ghost"
			size="icon-sm"
			disabled={detach.isPending}
			aria-label={t("adminAwdpOps.gameboxes.detachAria", { name: row.name })}
			title={t("adminAwdpOps.gameboxes.detachTitle")}
			onClick={() => void askDetach(row)}
		>
			<Trash2 className="text-destructive" aria-hidden="true" />
		</Button>
	);

	const columns: DataTableColumn<AwdpAdminEventGameBoxDto>[] = [
		{
			id: "name",
			header: t("adminAwdpOps.gameboxes.columns.gamebox"),
			sortValue: (row) => row.name,
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate font-medium">{row.name}</p>
					<p className="truncate text-xs text-muted-foreground">
						<MonoText>{row.safe_name}</MonoText> · {row.category}
					</p>
				</div>
			),
		},
		{
			id: "awdp_capable",
			header: t("adminAwdpOps.gameboxes.columns.capability"),
			cell: (row) => (
				<BooleanPill
					value={row.awdp_capable}
					trueText={t("adminAwdpOps.gameboxes.capabilityComplete")}
					falseText={t("adminAwdpOps.gameboxes.capabilityMissing")}
					falseTone="danger"
				/>
			),
		},
		{
			id: "build_status",
			header: t("adminAwdpOps.gameboxes.columns.buildStatus"),
			cell: (row) => (
				<TonePill tone={awdpBuildStatusTone(row.build_status)} title={row.build_status ?? undefined}>
					{awdpBuildStatusLabel(row.build_status, t)}
				</TonePill>
			),
			hideBelow: "md",
		},
		{
			id: "enabled",
			header: t("adminAwdpOps.gameboxes.columns.enabled"),
			cell: (row) => (
				<BooleanPill
					value={row.enabled}
					trueText={t("adminAwdpOps.gameboxes.enabledTrue")}
					falseText={t("adminAwdpOps.gameboxes.enabledFalse")}
				/>
			),
			hideBelow: "md",
		},
		{
			id: "hidden",
			header: t("adminAwdpOps.gameboxes.columns.visible"),
			cell: (row) => (
				<BooleanPill
					value={!row.hidden}
					trueText={t("adminAwdpOps.gameboxes.visibleTrue")}
					falseText={t("adminAwdpOps.gameboxes.visibleFalse")}
					falseTone="warning"
				/>
			),
		},
		{
			id: "resources",
			header: t("adminAwdpOps.gameboxes.columns.resources"),
			hideBelow: "lg",
			cell: (row) => (
				<MonoText>
					{row.cpu_millis}m / {formatBytes(row.memory_bytes)} / {row.pids_limit}
				</MonoText>
			),
		},
		{
			id: "awdp_source_code_dir",
			header: t("adminAwdpOps.gameboxes.columns.sourceDir"),
			hideBelow: "xl",
			cell: (row) => <MonoText>{row.awdp_source_code_dir ?? t("common.empty")}</MonoText>,
		},
	];

	return (
		<SectionCard
			title={t("adminAwdpOps.gameboxes.sectionTitle")}
			description={t("adminAwdpOps.gameboxes.sectionDescription")}
			actions={
				hasRows ? (
					<Button size="sm" onClick={() => setAttaching(true)}>
						<Plus aria-hidden="true" />
						{t("adminAwdpOps.gameboxes.attach")}
					</Button>
				) : undefined
			}
		>
			<QueryState
				query={gameboxesQuery}
				skeleton={<TableSkeleton rows={4} columns={5} />}
				isEmpty={(rows) => rows.length === 0}
				errorTitle={t("adminAwdpOps.gameboxes.loadError")}
				empty={
					<EmptyBlock
						title={t("adminAwdpOps.gameboxes.emptyTitle")}
						description={t("adminAwdpOps.gameboxes.emptyDescription")}
						icon={<Boxes className="size-6" aria-hidden="true" />}
						action={
							<Button size="sm" onClick={() => setAttaching(true)}>
								<Plus aria-hidden="true" />
								{t("adminAwdpOps.gameboxes.attach")}
							</Button>
						}
					/>
				}
			>
				{(rows) => (
					<DataTable
						data={rows}
						getRowId={(row) => row.id}
						columns={columns}
						rowActions={detachButton}
						mobileCard={(row) => (
							<div className="space-y-2">
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{row.name}</p>
										<p className="truncate text-xs text-muted-foreground">
											{t("adminAwdpOps.gameboxes.mobileMeta", {
												safeName: row.safe_name,
												category: row.category,
												status: awdpBuildStatusLabel(row.build_status, t),
											})}
										</p>
									</div>
									{detachButton(row)}
								</div>
								<div className="flex flex-wrap gap-1">
									<BooleanPill
										value={row.awdp_capable}
										trueText={t("adminAwdpOps.gameboxes.capabilityCompleteShort")}
										falseText={t("adminAwdpOps.gameboxes.capabilityMissingShort")}
										falseTone="danger"
									/>
									<BooleanPill
										value={!row.hidden}
										trueText={t("adminAwdpOps.gameboxes.visibleTrue")}
										falseText={t("adminAwdpOps.gameboxes.visibleFalse")}
										falseTone="warning"
									/>
								</div>
							</div>
						)}
					/>
				)}
			</QueryState>

			{attaching ? (
				<AttachGameboxSheet
					eventId={eventId}
					attachedIds={new Set((gameboxesQuery.data ?? []).map((row) => row.gamebox_id))}
					onClose={() => setAttaching(false)}
				/>
			) : null}

			<p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
				<Link2 className="size-4 shrink-0" aria-hidden="true" />
				{t("adminAwdpOps.gameboxes.footnote")}
			</p>
		</SectionCard>
	);
}
