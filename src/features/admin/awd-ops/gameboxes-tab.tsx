/**
 * 「GameBox 挂载」标签：赛事与 GameBox 的挂载关系（EventGameBox）增删改。
 *
 * 已核实的后端语义：
 * - 只能挂载 `build_status == "ready"` 的 GameBox；`host_offset` 需在 2..254，缺省自动取未占用值；
 * - UNIQUE(event_id, gamebox_id)：重复挂载返回 409；
 * - 新增时会从 GameBox 的 recommended_* 预填资源，并记录配置代数变更（需重新预检）；
 * - 移除时若该 GameBox 已有实例，DB 层 RESTRICT 拒绝（后端返回冲突），必须先处理实例。
 *
 * 文案全部走 `adminAwdOps.*`；表单校验范围与后端一致。
 */

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";

import type { EventGameBoxDto } from "@floatctf/sdk";

import { call, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import { MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, InlineError, QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { formatBytes, formatDateTime } from "~/lib/format";

import { useAwdEventGameboxes, useAwdGameboxLibrary } from "./queries";

function intOrError(raw: string, min: number, max: number, t: TFunction): string | null {
	const trimmed = raw.trim();
	if (trimmed === "") return null;
	if (!/^-?\d+$/.test(trimmed)) return t("adminAwdOps.validation.integer");
	const value = Number(trimmed);
	if (value < min || value > max) return t("adminAwdOps.validation.range", { min, max });
	return null;
}

/** 行式开关：左侧标题 + 说明，右侧 Switch（theme.md §6.4.C / §7.2）。 */
function SwitchField({
	id,
	label,
	hint,
	checked,
	onCheckedChange,
}: {
	id: string;
	label: string;
	hint?: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0 space-y-0.5">
				<Label htmlFor={id} className="text-xs">
					{label}
				</Label>
				{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
			</div>
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

/* ── 新增挂载 ─────────────────────────────────────────────────────────────── */

function AddEventGameboxSheet({
	eventId,
	attachedIds,
	onClose,
}: {
	eventId: string;
	attachedIds: Set<string>;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const libraryQuery = useAwdGameboxLibrary(true);

	const [gameboxId, setGameboxId] = useState("");
	const [hostOffset, setHostOffset] = useState("");
	const [hidden, setHidden] = useState(false);
	const [attackScore, setAttackScore] = useState("100");
	const [judgeDownPenalty, setJudgeDownPenalty] = useState("20");
	const [firstBonus, setFirstBonus] = useState("50");

	const errors = {
		host_offset: intOrError(hostOffset, 2, 254, t) ?? undefined,
		attack_score: intOrError(attackScore, -1_000_000_000, 1_000_000_000, t) ?? undefined,
		judge_down_penalty:
			intOrError(judgeDownPenalty, -1_000_000_000, 1_000_000_000, t) ?? undefined,
		first_bonus: intOrError(firstBonus, -1_000_000_000, 1_000_000_000, t) ?? undefined,
	};
	const hasError = Object.values(errors).some((value) => value !== undefined);

	const mutation = useMutation({
		mutationFn: (body: {
			gamebox_id: string;
			host_offset?: number;
			hidden?: boolean;
			attack_score?: number;
			judge_down_penalty?: number;
			first_bonus?: number;
		}) =>
			call<EventGameBoxDto>(
				client.awd.admin.addEventGamebox(eventId, body),
				t("adminAwdOps.actionNames.addEventGamebox"),
			),
		onSuccess: (gamebox) => {
			toast.success(
				t("adminAwdOps.gameboxes.addSheet.successTitle", { name: gamebox.gamebox_name }),
				t("adminAwdOps.gameboxes.addSheet.successDescription", {
					offset: gamebox.host_offset,
				}),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awd.eventGameboxes(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
			onClose();
		},
		onError: (error) => toast.apiError(t("adminAwdOps.gameboxes.addSheet.failed"), error),
	});

	const library = libraryQuery.data?.items ?? [];
	const ready = library.filter(
		(item) => item.build_status === "ready" && !attachedIds.has(item.id),
	);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (gameboxId === "" || hasError) return;
		const body: {
			gamebox_id: string;
			host_offset?: number;
			hidden?: boolean;
			attack_score?: number;
			judge_down_penalty?: number;
			first_bonus?: number;
		} = { gamebox_id: gameboxId, hidden };
		if (hostOffset.trim() !== "") body.host_offset = Number(hostOffset);
		if (attackScore.trim() !== "") body.attack_score = Number(attackScore);
		if (judgeDownPenalty.trim() !== "") body.judge_down_penalty = Number(judgeDownPenalty);
		if (firstBonus.trim() !== "") body.first_bonus = Number(firstBonus);
		mutation.mutate(body);
	};

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("adminAwdOps.gameboxes.addSheet.title")}
			description={t("adminAwdOps.gameboxes.addSheet.description")}
			width="lg"
			footer={
				<FormFooter
					onCancel={onClose}
					formId="awd-add-gamebox-form"
					submitLabel={t("adminAwdOps.gameboxes.addSheet.submit")}
					isPending={mutation.isPending}
					disabled={gameboxId === "" || hasError}
				/>
			}
		>
			<form id="awd-add-gamebox-form" onSubmit={submit} className="space-y-4">
				<Field
					label={t("adminAwdOps.gameboxes.addSheet.selectLabel")}
					htmlFor="awd-add-gamebox"
					required
					hint={t("adminAwdOps.gameboxes.addSheet.selectHint")}
				>
					<Select
						value={gameboxId}
						onValueChange={setGameboxId}
						disabled={libraryQuery.isPending}
					>
						<SelectTrigger
							id="awd-add-gamebox"
							className="w-full min-w-0"
							aria-label={t("adminAwdOps.gameboxes.addSheet.selectAria")}
						>
							<SelectValue
								placeholder={
									libraryQuery.isPending
										? t("adminAwdOps.gameboxes.addSheet.selectLoading")
										: t("adminAwdOps.gameboxes.addSheet.selectPlaceholder")
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{ready.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{t("adminAwdOps.gameboxes.addSheet.selectOption", {
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
					<p className="text-xs text-muted-foreground">
						{t("adminAwdOps.gameboxes.addSheet.noneAvailable")}
					</p>
				) : null}
				<FormGrid columns={2}>
					<Field
						label={t("adminAwdOps.gameboxes.addSheet.hostOffsetLabel")}
						htmlFor="awd-add-host-offset"
						hint={t("adminAwdOps.gameboxes.addSheet.hostOffsetHint")}
						error={errors.host_offset}
					>
						<Input
							id="awd-add-host-offset"
							type="number"
							inputMode="numeric"
							value={hostOffset}
							onChange={(event) => setHostOffset(event.target.value)}
							placeholder={t("adminAwdOps.gameboxes.addSheet.autoPlaceholder")}
						/>
					</Field>
					<SwitchField
						id="awd-add-hidden"
						label={t("adminAwdOps.gameboxes.addSheet.hiddenLabel")}
						hint={t("adminAwdOps.gameboxes.addSheet.hiddenHint")}
						checked={hidden}
						onCheckedChange={setHidden}
					/>
					<Field
						label={t("adminAwdOps.gameboxes.addSheet.attackLabel")}
						htmlFor="awd-add-attack"
						error={errors.attack_score}
					>
						<Input
							id="awd-add-attack"
							type="number"
							inputMode="numeric"
							value={attackScore}
							onChange={(event) => setAttackScore(event.target.value)}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.addSheet.penaltyLabel")}
						htmlFor="awd-add-penalty"
						error={errors.judge_down_penalty}
					>
						<Input
							id="awd-add-penalty"
							type="number"
							inputMode="numeric"
							value={judgeDownPenalty}
							onChange={(event) => setJudgeDownPenalty(event.target.value)}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.addSheet.firstBonusLabel")}
						htmlFor="awd-add-first-bonus"
						error={errors.first_bonus}
					>
						<Input
							id="awd-add-first-bonus"
							type="number"
							inputMode="numeric"
							value={firstBonus}
							onChange={(event) => setFirstBonus(event.target.value)}
						/>
					</Field>
				</FormGrid>
			</form>
		</FormSheet>
	);
}

/* ── 编辑挂载 ─────────────────────────────────────────────────────────────── */

interface EventGameboxForm {
	enabled: boolean;
	hidden: boolean;
	cpu_millis: string;
	memory_bytes: string;
	pids_limit: string;
	judge_timeout_secs: string;
	judge_retry_interval_secs: string;
	attack_score: string;
	judge_down_penalty: string;
	first_bonus: string;
}

interface EventGameboxPatch {
	enabled?: boolean;
	hidden?: boolean;
	cpu_millis?: number;
	memory_bytes?: number;
	pids_limit?: number;
	judge_timeout_secs?: number;
	judge_retry_interval_secs?: number;
	attack_score?: number;
	judge_down_penalty?: number;
	first_bonus?: number;
}

function EditEventGameboxSheet({
	eventId,
	row,
	onClose,
}: {
	eventId: string;
	row: EventGameBoxDto;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<EventGameboxForm>({
		enabled: row.enabled,
		hidden: row.hidden,
		cpu_millis: String(row.cpu_millis),
		memory_bytes: String(row.memory_bytes),
		pids_limit: String(row.pids_limit),
		judge_timeout_secs: row.judge_timeout_secs === null ? "" : String(row.judge_timeout_secs),
		judge_retry_interval_secs:
			row.judge_retry_interval_secs === null ? "" : String(row.judge_retry_interval_secs),
		attack_score: String(row.attack_score),
		judge_down_penalty: String(row.judge_down_penalty),
		first_bonus: String(row.first_bonus),
	});
	const [errors, setErrors] = useState<Record<string, string | undefined>>({});

	const mutation = useMutation({
		mutationFn: (patch: EventGameboxPatch) =>
			call<EventGameBoxDto>(
				client.awd.admin.updateEventGamebox(eventId, row.id, patch),
				t("adminAwdOps.actionNames.updateEventGamebox"),
			),
		onSuccess: (updated) => {
			toast.success(t("adminAwdOps.gameboxes.editSheet.success", { name: updated.gamebox_name }));
			void queryClient.invalidateQueries({ queryKey: qk.awd.eventGameboxes(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
			onClose();
		},
		onError: (error) => toast.apiError(t("adminAwdOps.gameboxes.editSheet.failed"), error),
	});

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const nextErrors: Record<string, string | undefined> = {
			cpu_millis: intOrError(form.cpu_millis, 0, 1_000_000, t) ?? undefined,
			memory_bytes: intOrError(form.memory_bytes, 0, 1_000_000_000_000, t) ?? undefined,
			pids_limit: intOrError(form.pids_limit, 0, 1_000_000, t) ?? undefined,
			attack_score:
				intOrError(form.attack_score, -1_000_000_000, 1_000_000_000, t) ?? undefined,
			judge_down_penalty:
				intOrError(form.judge_down_penalty, -1_000_000_000, 1_000_000_000, t) ?? undefined,
			first_bonus:
				intOrError(form.first_bonus, -1_000_000_000, 1_000_000_000, t) ?? undefined,
			judge_timeout_secs: intOrError(form.judge_timeout_secs, 1, 3_600, t) ?? undefined,
			judge_retry_interval_secs:
				intOrError(form.judge_retry_interval_secs, 1, 3_600, t) ?? undefined,
		};
		// 后端 updateEventGamebox 没有 double_option：显式 null 会被忽略（不是清空），
		// 因此这里禁止「把已有值清空」。同时必须阻止空串走 Number("") → 0：
		// 那会把 CPU 限额/分值/罚分静默改成 0，是货真价实的数据事故。
		const cannotClearKeys = [
			"cpu_millis",
			"memory_bytes",
			"pids_limit",
			"attack_score",
			"judge_down_penalty",
			"first_bonus",
			"judge_timeout_secs",
			"judge_retry_interval_secs",
		] as const;
		for (const key of cannotClearKeys) {
			if (form[key].trim() === "" && row[key] !== null && row[key] !== undefined) {
				nextErrors[key] = t("adminAwdOps.gameboxes.editSheet.cannotClear");
			}
		}
		setErrors(nextErrors);
		if (Object.values(nextErrors).some((value) => value !== undefined)) return;

		const patch: EventGameboxPatch = {};
		if (form.enabled !== row.enabled) patch.enabled = form.enabled;
		if (form.hidden !== row.hidden) patch.hidden = form.hidden;
		if (form.cpu_millis !== String(row.cpu_millis) && form.cpu_millis.trim() !== "") patch.cpu_millis = Number(form.cpu_millis);
		if (form.memory_bytes !== String(row.memory_bytes) && form.memory_bytes.trim() !== "") {
			patch.memory_bytes = Number(form.memory_bytes);
		}
		if (form.pids_limit !== String(row.pids_limit) && form.pids_limit.trim() !== "") patch.pids_limit = Number(form.pids_limit);
		if (form.attack_score !== String(row.attack_score) && form.attack_score.trim() !== "") {
			patch.attack_score = Number(form.attack_score);
		}
		if (form.judge_down_penalty !== String(row.judge_down_penalty) && form.judge_down_penalty.trim() !== "") {
			patch.judge_down_penalty = Number(form.judge_down_penalty);
		}
		if (form.first_bonus !== String(row.first_bonus) && form.first_bonus.trim() !== "") patch.first_bonus = Number(form.first_bonus);
		const originalTimeout = row.judge_timeout_secs === null ? "" : String(row.judge_timeout_secs);
		if (form.judge_timeout_secs !== originalTimeout && form.judge_timeout_secs.trim() !== "") {
			patch.judge_timeout_secs = Number(form.judge_timeout_secs);
		}
		const originalRetry =
			row.judge_retry_interval_secs === null ? "" : String(row.judge_retry_interval_secs);
		if (
			form.judge_retry_interval_secs !== originalRetry &&
			form.judge_retry_interval_secs.trim() !== ""
		) {
			patch.judge_retry_interval_secs = Number(form.judge_retry_interval_secs);
		}

		if (Object.keys(patch).length === 0) {
			toast.warning(t("adminAwdOps.gameboxes.editSheet.noChanges"));
			return;
		}
		mutation.mutate(patch);
	};

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("adminAwdOps.gameboxes.editSheet.title", { name: row.gamebox_name })}
			description={
				row.gamebox_version
					? t("adminAwdOps.gameboxes.editSheet.descriptionWithVersion", {
							safeName: row.gamebox_safe_name,
							version: row.gamebox_version,
							offset: row.host_offset,
						})
					: t("adminAwdOps.gameboxes.editSheet.description", {
							safeName: row.gamebox_safe_name,
							offset: row.host_offset,
						})
			}
			width="lg"
			footer={
				<FormFooter
					onCancel={onClose}
					formId="awd-edit-gamebox-form"
					isPending={mutation.isPending}
				/>
			}
		>
			<form id="awd-edit-gamebox-form" onSubmit={submit} className="space-y-4">
				<FormGrid columns={2}>
					<SwitchField
						id="awd-eg-enabled"
						label={t("adminAwdOps.gameboxes.editSheet.enabledLabel")}
						hint={t("adminAwdOps.gameboxes.editSheet.enabledHint")}
						checked={form.enabled}
						onCheckedChange={(value) =>
							setForm((prev) => ({ ...prev, enabled: value }))
						}
					/>
					<SwitchField
						id="awd-eg-hidden"
						label={t("adminAwdOps.gameboxes.editSheet.hiddenLabel")}
						checked={form.hidden}
						onCheckedChange={(value) => setForm((prev) => ({ ...prev, hidden: value }))}
					/>
					<Field
						label={t("adminAwdOps.gameboxes.editSheet.cpuLabel")}
						htmlFor="awd-eg-cpu"
						error={errors.cpu_millis}
					>
						<Input
							id="awd-eg-cpu"
							type="number"
							inputMode="numeric"
							value={form.cpu_millis}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, cpu_millis: event.target.value }))
							}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.editSheet.memoryLabel")}
						htmlFor="awd-eg-mem"
						error={errors.memory_bytes}
					>
						<Input
							id="awd-eg-mem"
							type="number"
							inputMode="numeric"
							value={form.memory_bytes}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, memory_bytes: event.target.value }))
							}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.editSheet.pidsLabel")}
						htmlFor="awd-eg-pids"
						error={errors.pids_limit}
					>
						<Input
							id="awd-eg-pids"
							type="number"
							inputMode="numeric"
							value={form.pids_limit}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, pids_limit: event.target.value }))
							}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.editSheet.timeoutLabel")}
						htmlFor="awd-eg-judge-timeout"
						hint={t("adminAwdOps.gameboxes.editSheet.timeoutHint")}
						error={errors.judge_timeout_secs}
					>
						<Input
							id="awd-eg-judge-timeout"
							type="number"
							inputMode="numeric"
							value={form.judge_timeout_secs}
							onChange={(event) =>
								setForm((prev) => ({
									...prev,
									judge_timeout_secs: event.target.value,
								}))
							}
							placeholder={t("adminAwdOps.gameboxes.editSheet.inheritPlaceholder")}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.editSheet.retryLabel")}
						htmlFor="awd-eg-judge-retry"
						hint={t("adminAwdOps.gameboxes.editSheet.retryHint")}
						error={errors.judge_retry_interval_secs}
					>
						<Input
							id="awd-eg-judge-retry"
							type="number"
							inputMode="numeric"
							value={form.judge_retry_interval_secs}
							onChange={(event) =>
								setForm((prev) => ({
									...prev,
									judge_retry_interval_secs: event.target.value,
								}))
							}
							placeholder={t("adminAwdOps.gameboxes.editSheet.inheritPlaceholder")}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.editSheet.attackLabel")}
						htmlFor="awd-eg-attack"
						error={errors.attack_score}
					>
						<Input
							id="awd-eg-attack"
							type="number"
							inputMode="numeric"
							value={form.attack_score}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, attack_score: event.target.value }))
							}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.editSheet.penaltyLabel")}
						htmlFor="awd-eg-penalty"
						error={errors.judge_down_penalty}
					>
						<Input
							id="awd-eg-penalty"
							type="number"
							inputMode="numeric"
							value={form.judge_down_penalty}
							onChange={(event) =>
								setForm((prev) => ({
									...prev,
									judge_down_penalty: event.target.value,
								}))
							}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.gameboxes.editSheet.firstBonusLabel")}
						htmlFor="awd-eg-first-bonus"
						error={errors.first_bonus}
					>
						<Input
							id="awd-eg-first-bonus"
							type="number"
							inputMode="numeric"
							value={form.first_bonus}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, first_bonus: event.target.value }))
							}
						/>
					</Field>
				</FormGrid>
				<p className="text-xs text-muted-foreground">
					{t("adminAwdOps.gameboxes.editSheet.note")}
				</p>
			</form>
		</FormSheet>
	);
}

/* ── 标签主体 ─────────────────────────────────────────────────────────────── */

export function AwdGameboxesTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const eventGameboxes = useAwdEventGameboxes(eventId);
	const [adding, setAdding] = useState(false);
	const [editRow, setEditRow] = useState<EventGameBoxDto | null>(null);

	const enabledText = t("adminAwdOps.gameboxes.enabled");
	const disabledText = t("adminAwdOps.gameboxes.disabled");
	const visibleText = t("adminAwdOps.gameboxes.visible");
	const hiddenText = t("adminAwdOps.gameboxes.hidden");

	const remove = useMutation({
		mutationFn: (row: EventGameBoxDto) =>
			callVoid(
				client.awd.admin.removeEventGamebox(eventId, row.id),
				t("adminAwdOps.actionNames.removeEventGamebox"),
			),
		onSuccess: (_result, row) => {
			toast.success(t("adminAwdOps.gameboxes.removeSuccess", { name: row.gamebox_name }));
			void queryClient.invalidateQueries({ queryKey: qk.awd.eventGameboxes(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
		},
		onError: (error) => toast.apiError(t("adminAwdOps.gameboxes.removeFailed"), error),
	});

	const columns: DataTableColumn<EventGameBoxDto>[] = [
		{
			id: "gamebox_name",
			header: t("adminAwdOps.gameboxes.columns.gamebox"),
			sortValue: (row) => row.gamebox_name,
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate font-medium">{row.gamebox_name}</p>
					<p className="text-xs text-muted-foreground">
						<span className="font-mono">{row.gamebox_safe_name}</span>
						{row.gamebox_version ? ` · v${row.gamebox_version}` : ""}
					</p>
				</div>
			),
		},
		{
			id: "host_offset",
			header: t("adminAwdOps.gameboxes.columns.hostOffset"),
			align: "right",
			sortValue: (row) => row.host_offset,
			cell: (row) => <MonoText>#{row.host_offset}</MonoText>,
		},
		{
			id: "enabled",
			header: t("adminAwdOps.gameboxes.columns.enabled"),
			cell: (row) => (
				<BooleanPill value={row.enabled} trueText={enabledText} falseText={disabledText} />
			),
		},
		{
			id: "hidden",
			header: t("adminAwdOps.gameboxes.columns.visible"),
			hideBelow: "md",
			cell: (row) => (
				<BooleanPill
					value={!row.hidden}
					trueText={visibleText}
					falseText={hiddenText}
					falseTone="warning"
				/>
			),
		},
		{
			id: "scores",
			header: t("adminAwdOps.gameboxes.columns.scores"),
			hideBelow: "lg",
			cell: (row) => (
				<MonoText>
					{row.attack_score} / {row.judge_down_penalty} / {row.first_bonus}
				</MonoText>
			),
		},
		{
			id: "resources",
			header: t("adminAwdOps.gameboxes.columns.resources"),
			hideBelow: "lg",
			cell: (row) => (
				<MonoText>
					{row.cpu_millis}m / {formatBytes(row.memory_bytes)} / {row.pids_limit}
				</MonoText>
			),
		},
		{
			id: "created_at",
			header: t("adminAwdOps.gameboxes.columns.createdAt"),
			hideBelow: "xl",
			cell: (row) => (
				<span className="tnum whitespace-nowrap">{formatDateTime(row.created_at, { seconds: true })}</span>
			),
			sortValue: (row) => row.created_at,
		},
	];

	const renderActions = (row: EventGameBoxDto) => (
		<>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={() => setEditRow(row)}
				aria-label={t("adminAwdOps.gameboxes.editAria", { name: row.gamebox_name })}
				title={t("common.edit")}
			>
				<Pencil />
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				disabled={remove.isPending}
				onClick={async () => {
					const ok = await confirm({
						title: t("adminAwdOps.gameboxes.removeConfirm.title", {
							name: row.gamebox_name,
						}),
						description: t("adminAwdOps.gameboxes.removeConfirm.description"),
						consequences: [
							t("adminAwdOps.gameboxes.removeConfirm.consequence1"),
							t("adminAwdOps.gameboxes.removeConfirm.consequence2"),
							t("adminAwdOps.gameboxes.removeConfirm.consequence3"),
						],
						tone: "danger",
						confirmText: t("adminAwdOps.gameboxes.removeConfirm.confirm"),
					});
					if (ok) remove.mutate(row);
				}}
				aria-label={t("adminAwdOps.gameboxes.removeAria", { name: row.gamebox_name })}
				title={t("adminAwdOps.gameboxes.removeTitle")}
			>
				<Trash2 className="text-destructive" />
			</Button>
		</>
	);

	return (
		<SectionCard
			title={t("adminAwdOps.gameboxes.title")}
			description={t("adminAwdOps.gameboxes.description")}
			actions={
				<Button size="sm" onClick={() => setAdding(true)}>
					<Plus data-icon="inline-start" />
					{t("adminAwdOps.gameboxes.add")}
				</Button>
			}
		>
			<QueryState
				query={eventGameboxes}
				skeleton={<TableSkeleton rows={5} columns={5} />}
				isEmpty={(data) => data.items.length === 0}
				empty={
					<EmptyBlock
						title={t("adminAwdOps.gameboxes.emptyTitle")}
						description={t("adminAwdOps.gameboxes.emptyDescription")}
						icon={<Boxes className="size-6" />}
						action={
							<Button size="sm" onClick={() => setAdding(true)}>
								<Plus data-icon="inline-start" />
								{t("adminAwdOps.gameboxes.add")}
							</Button>
						}
					/>
				}
			>
				{(data) => (
					<div className="space-y-3">
						<DataTable
							data={data.items}
							getRowId={(row) => row.id}
							columns={columns}
							mobileCard={(row) => (
								<div className="min-w-0 space-y-2">
									<p className="truncate text-sm font-medium">
										{row.gamebox_name}
									</p>
									<p className="tnum text-xs text-muted-foreground">
										{t("adminAwdOps.gameboxes.mobileMeta", {
											offset: row.host_offset,
											attack: row.attack_score,
											penalty: row.judge_down_penalty,
										})}
									</p>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="flex flex-wrap gap-1">
											<BooleanPill
												value={row.enabled}
												trueText={enabledText}
												falseText={disabledText}
											/>
											<BooleanPill
												value={!row.hidden}
												trueText={visibleText}
												falseText={hiddenText}
												falseTone="warning"
											/>
										</div>
										<div className="flex items-center gap-1">
											{renderActions(row)}
										</div>
									</div>
								</div>
							)}
							rowActions={renderActions}
						/>
						{data.items.length < data.total ? (
							<p className="tnum text-xs text-muted-foreground">
								{t("adminAwdOps.gameboxes.partial", {
									shown: data.items.length,
									total: data.total,
								})}
							</p>
						) : null}
					</div>
				)}
			</QueryState>

			{adding ? (
				<AddEventGameboxSheet
					eventId={eventId}
					attachedIds={new Set((eventGameboxes.data?.items ?? []).map((row) => row.gamebox_id))}
					onClose={() => setAdding(false)}
				/>
			) : null}
			{editRow ? (
				<EditEventGameboxSheet
					eventId={eventId}
					row={editRow}
					onClose={() => setEditRow(null)}
				/>
			) : null}
		</SectionCard>
	);
}
