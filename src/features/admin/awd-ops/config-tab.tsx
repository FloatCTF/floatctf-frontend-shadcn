/**
 * 「配置」标签：AWD 赛事配置的读取 / 首次开通 / 修改。
 *
 * 已核实的后端语义：
 * - 首次开通走 `POST /admin/events/awd`（body 需 event_id；赛事必须是 AWD 赛制、且有结束时间）；
 * - 修改走 PATCH，**必须**携带 `expected_updated_at`（乐观锁），并至少提交一个变更字段；
 * - 运行态（running/paused/network_error/finished/archived）配置锁定；prechecking 期间也不可改。
 *
 * 文案全部走 `adminAwdOps.*`（CONVENTIONS §10.2）；数据逻辑与后端语义保持不变。
 */

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Settings2 } from "lucide-react";

import type { AwdEventConfigInput, AwdEventStatus } from "@floatctf/sdk";
import { AwdEventStatus as AwdEventStatusEnum, EventFamily } from "@floatctf/sdk/entity";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import { KeyValueList, MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, QueryState } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatDateTime, fromDatetimeLocalValue, toDatetimeLocalValue } from "~/lib/format";

import { useAwdEvent, useAwdStatus } from "./queries";
import { awdStatusLabel, eventFamilyLabel, isConflictError } from "./shared";

type NumericKey =
	| "round_count"
	| "round_duration_secs"
	| "initial_score"
	| "free_reset_count"
	| "extra_reset_penalty"
	| "judge_max_concurrency"
	| "judge_default_timeout_secs"
	| "judge_retry_interval_secs"
	| "archive_retention_hours";

interface NumericField {
	key: NumericKey;
	min: number;
	max: number;
}

/** 范围与后端 `AwdEventConfigPatch::validate()` 一致（超范围后端会 400）。 */
const NUMERIC_FIELDS: NumericField[] = [
	{ key: "round_count", min: 1, max: 10_000 },
	{ key: "round_duration_secs", min: 30, max: 86_400 },
	{ key: "initial_score", min: 0, max: 1_000_000_000 },
	{ key: "free_reset_count", min: 0, max: 100 },
	{ key: "extra_reset_penalty", min: 0, max: 1_000_000_000 },
	{ key: "judge_max_concurrency", min: 1, max: 1_000 },
	{ key: "judge_default_timeout_secs", min: 1, max: 3_600 },
	{ key: "judge_retry_interval_secs", min: 1, max: 3_600 },
	{ key: "archive_retention_hours", min: 1, max: 87_600 },
];

/** 后端 `assert_config_editable` 允许改配置的状态（其余状态配置锁定）。 */
const EDITABLE_STATUSES: string[] = [
	AwdEventStatusEnum.Draft,
	AwdEventStatusEnum.Configuring,
	AwdEventStatusEnum.Deployed,
	AwdEventStatusEnum.Verified,
	AwdEventStatusEnum.StartBlocked,
	AwdEventStatusEnum.DeployFailed,
	AwdEventStatusEnum.VerificationFailed,
];

type ConfigFormState = Record<NumericKey, string> & { planned_start_at: string };

function emptyForm(): ConfigFormState {
	const base = { planned_start_at: "" } as ConfigFormState;
	for (const field of NUMERIC_FIELDS) base[field.key] = "";
	return base;
}

function formFromStatus(status: AwdEventStatus): ConfigFormState {
	const form = emptyForm();
	for (const field of NUMERIC_FIELDS) {
		const value = status[field.key];
		form[field.key] = value === null || value === undefined ? "" : String(value);
	}
	form.planned_start_at = toDatetimeLocalValue(status.planned_start_at);
	return form;
}

type FormErrors = Partial<Record<NumericKey | "planned_start_at", string>>;

function validateForm(form: ConfigFormState, t: TFunction): FormErrors {
	const errors: FormErrors = {};
	for (const field of NUMERIC_FIELDS) {
		const raw = form[field.key].trim();
		if (raw === "") continue;
		if (!/^-?\d+$/.test(raw)) {
			errors[field.key] = t("adminAwdOps.validation.integer");
			continue;
		}
		const value = Number(raw);
		if (value < field.min || value > field.max) {
			errors[field.key] = t("adminAwdOps.validation.range", {
				min: field.min,
				max: field.max,
			});
		}
	}
	if (form.planned_start_at !== "") {
		const iso = fromDatetimeLocalValue(form.planned_start_at);
		if (iso === null) {
			errors.planned_start_at = t("adminAwdOps.config.validation.plannedInvalid");
		} else if (new Date(iso).getTime() <= Date.now()) {
			errors.planned_start_at = t("adminAwdOps.config.validation.plannedInPast");
		}
	}
	return errors;
}

function collectNumbers(form: ConfigFormState): Partial<Record<NumericKey, number>> {
	const out: Partial<Record<NumericKey, number>> = {};
	for (const field of NUMERIC_FIELDS) {
		const raw = form[field.key].trim();
		if (raw === "") continue;
		out[field.key] = Number(raw);
	}
	return out;
}

/** 相对已加载配置计算 PATCH 最小变更集；无变更返回 null。 */
function buildPatch(status: AwdEventStatus, form: ConfigFormState): AwdEventConfigInput | null {
	const patch: AwdEventConfigInput = {};
	for (const field of NUMERIC_FIELDS) {
		const raw = form[field.key].trim();
		if (raw === "") continue;
		const value = Number(raw);
		if (value !== status[field.key]) patch[field.key] = value;
	}
	const originalPlanned = toDatetimeLocalValue(status.planned_start_at);
	if (form.planned_start_at !== originalPlanned) {
		if (form.planned_start_at === "") {
			// 原本有排期、现在清空 → 删除已排期的开赛任务。
			if (originalPlanned !== "") patch.clear_planned_start = true;
		} else {
			const iso = fromDatetimeLocalValue(form.planned_start_at);
			if (iso) patch.planned_start_at = iso;
		}
	}
	return Object.keys(patch).length > 0 ? patch : null;
}

function ConfigFields({
	form,
	errors,
	onChange,
	disabled,
}: {
	form: ConfigFormState;
	errors: FormErrors;
	onChange: (key: keyof ConfigFormState, value: string) => void;
	disabled: boolean;
}) {
	const { t } = useTranslation();
	return (
		<FormGrid columns={2}>
			{NUMERIC_FIELDS.map((field) => (
				<Field
					key={field.key}
					label={t(`adminAwdOps.config.form.${field.key}.label`)}
					htmlFor={`awd-${field.key}`}
					hint={t(`adminAwdOps.config.form.${field.key}.hint`)}
					error={errors[field.key]}
				>
					<Input
						id={`awd-${field.key}`}
						type="number"
						inputMode="numeric"
						value={form[field.key]}
						disabled={disabled}
						onChange={(event) => onChange(field.key, event.target.value)}
					/>
				</Field>
			))}
			<Field
				label={t("adminAwdOps.config.form.planned_start_at.label")}
				htmlFor="awd-planned-start"
				hint={t("adminAwdOps.config.form.planned_start_at.hint")}
				error={errors.planned_start_at}
				className="sm:col-span-2"
			>
				<Input
					id="awd-planned-start"
					type="datetime-local"
					value={form.planned_start_at}
					disabled={disabled}
					onChange={(event) => onChange("planned_start_at", event.target.value)}
				/>
			</Field>
		</FormGrid>
	);
}

/** 首次开通：POST /admin/events/awd（body 带 event_id）。 */
function CreateAwdSheet({
	eventId,
	family,
	onClose,
}: {
	eventId: string;
	family: string;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<ConfigFormState>(emptyForm);
	const [errors, setErrors] = useState<FormErrors>({});

	const notAwd = family !== EventFamily.Awd;

	const mutation = useMutation({
		mutationFn: (body: AwdEventConfigInput & { event_id: string }) =>
			call<string>(client.awd.admin.createEvent(body), t("adminAwdOps.actionNames.createAwd")),
		onSuccess: () => {
			toast.success(
				t("adminAwdOps.config.create.successTitle"),
				t("adminAwdOps.config.create.successDescription"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
			onClose();
		},
		onError: (error) => toast.apiError(t("adminAwdOps.config.create.failed"), error),
	});

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const nextErrors = validateForm(form, t);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		const body: AwdEventConfigInput & { event_id: string } = {
			event_id: eventId,
			...collectNumbers(form),
		};
		const planned = fromDatetimeLocalValue(form.planned_start_at);
		if (planned) body.planned_start_at = planned;
		mutation.mutate(body);
	};

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("adminAwdOps.config.create.title")}
			description={t("adminAwdOps.config.create.description")}
			width="lg"
			footer={
				<FormFooter
					onCancel={onClose}
					formId="awd-create-form"
					submitLabel={t("adminAwdOps.config.create.submit")}
					isPending={mutation.isPending}
					disabled={notAwd}
					hint={notAwd ? t("adminAwdOps.config.create.blockedHint") : undefined}
				/>
			}
		>
			<form id="awd-create-form" onSubmit={submit} className="space-y-4">
				{notAwd ? (
					<p className="text-sm text-destructive" role="alert">
						{t("adminAwdOps.config.create.blockedBody", {
							family: eventFamilyLabel(family, t),
						})}
					</p>
				) : (
					<ConfigFields
						form={form}
						errors={errors}
						disabled={mutation.isPending}
						onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
					/>
				)}
			</form>
		</FormSheet>
	);
}

/** 修改配置：PATCH + expected_updated_at 乐观锁。 */
function EditAwdSheet({
	eventId,
	status,
	onClose,
}: {
	eventId: string;
	status: AwdEventStatus;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<ConfigFormState>(() => formFromStatus(status));
	const [errors, setErrors] = useState<FormErrors>({});

	const mutation = useMutation({
		mutationFn: (patch: AwdEventConfigInput) =>
			call<AwdEventStatus>(
				client.awd.admin.updateConfig(eventId, {
					...patch,
					// 乐观锁：回传读取时拿到的 updated_at，避免覆盖他人修改。
					expected_updated_at: status.updated_at,
				}),
				t("adminAwdOps.actionNames.saveConfig"),
			),
		onSuccess: () => {
			toast.success(t("adminAwdOps.config.edit.success"));
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
			onClose();
		},
		onError: (error) => {
			if (isConflictError(error)) {
				toast.error(
					t("adminAwdOps.config.edit.conflictTitle"),
					t("adminAwdOps.config.edit.conflictDescription"),
				);
				void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
				return;
			}
			toast.apiError(t("adminAwdOps.config.edit.failed"), error);
		},
	});

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const nextErrors = validateForm(form, t);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;
		const patch = buildPatch(status, form);
		if (!patch) {
			toast.warning(
				t("adminAwdOps.config.edit.noChangesTitle"),
				t("adminAwdOps.config.edit.noChangesDescription"),
			);
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
			title={t("adminAwdOps.config.edit.title")}
			description={t("adminAwdOps.config.edit.description", {
				time: formatDateTime(status.updated_at, { seconds: true }),
			})}
			width="lg"
			footer={<FormFooter onCancel={onClose} formId="awd-edit-form" isPending={mutation.isPending} />}
		>
			<form id="awd-edit-form" onSubmit={submit} className="space-y-4">
				<ConfigFields
					form={form}
					errors={errors}
					disabled={mutation.isPending}
					onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
				/>
				<p className="text-xs text-muted-foreground">{t("adminAwdOps.config.edit.note")}</p>
			</form>
		</FormSheet>
	);
}

export function AwdConfigTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const statusQuery = useAwdStatus(eventId);
	const eventQuery = useAwdEvent(eventId);
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState(false);

	const family = eventQuery.data?.family ?? "";

	// 首次开通时后端要求赛事为 AWD 赛制（family 未知时不禁用，交给后端裁决并展示错误）。
	const familyBlocked = family !== "" && family !== EventFamily.Awd;

	return (
		<>
			<QueryState
				query={statusQuery}
				empty={
					<EmptyBlock
						title={t("adminAwdOps.config.emptyTitle")}
						description={
							<>
								<span className="block">
									{t("adminAwdOps.config.emptyDescription")}
								</span>
								{familyBlocked ? (
									<span className="mt-1 block text-destructive">
										{t("adminAwdOps.config.createBlocked", {
											family: eventFamilyLabel(family, t),
										})}
									</span>
								) : null}
							</>
						}
						icon={<Settings2 className="size-6" />}
						action={
							<Button
								size="sm"
								disabled={familyBlocked}
								title={
									familyBlocked
										? t("adminAwdOps.config.createBlocked", {
												family: eventFamilyLabel(family, t),
											})
										: undefined
								}
								onClick={() => setCreating(true)}
							>
								<Settings2 data-icon="inline-start" />
								{t("adminAwdOps.config.createAction")}
							</Button>
						}
					/>
				}
			>
				{(data) => {
					// QueryState 已在 data == null 时渲染 empty；这里只做类型收窄。
					if (!data) return null;
					const editable = EDITABLE_STATUSES.includes(data.status);
					return (
						<>
							<SectionCard
								title={t("adminAwdOps.config.runtimeTitle")}
								description={t("adminAwdOps.config.runtimeDescription")}
								actions={
									<Button
										variant="outline"
										size="sm"
										disabled={!editable}
										title={
											editable
												? undefined
												: t("adminAwdOps.config.lockedReason", {
														status: awdStatusLabel(data.status, t),
													})
										}
										onClick={() => setEditing(true)}
									>
										<Settings2 data-icon="inline-start" />
										{t("adminAwdOps.config.editAction")}
									</Button>
								}
							>
								<div className="space-y-4">
									<div className="flex flex-wrap items-center gap-2">
										<TonePill tone={editable ? "success" : "warning"}>
											{editable
												? t("adminAwdOps.config.editable")
												: t("adminAwdOps.config.locked")}
										</TonePill>
										<span className="tnum text-xs text-muted-foreground">
											{t("adminAwdOps.config.updatedAt", {
												time: formatDateTime(data.updated_at, { seconds: true }),
											})}
										</span>
									</div>
									<KeyValueList
										columns={3}
										items={[
											{
												key: t("adminAwdOps.config.detail.totalRounds"),
												value:
													data.round_count === null ? (
														<span className="text-muted-foreground">—</span>
													) : (
														<span className="tnum">{data.round_count}</span>
													),
											},
											{
												key: t("adminAwdOps.config.detail.roundDuration"),
												value: (
													<span className="tnum">
														{t("adminAwdOps.units.seconds", {
															count: data.round_duration_secs,
														})}
													</span>
												),
											},
											{
												key: t("adminAwdOps.config.detail.initialScore"),
												value: <span className="tnum">{data.initial_score}</span>,
											},
											{
												key: t("adminAwdOps.config.detail.freeResetCount"),
												value: <span className="tnum">{data.free_reset_count}</span>,
											},
											{
												key: t("adminAwdOps.config.detail.extraResetPenalty"),
												value: <span className="tnum">{data.extra_reset_penalty}</span>,
											},
											{
												key: t("adminAwdOps.config.detail.judgeMaxConcurrency"),
												value: (
													<span className="tnum">{data.judge_max_concurrency}</span>
												),
											},
											{
												key: t("adminAwdOps.config.detail.judgeTimeout"),
												value: (
													<span className="tnum">
														{t("adminAwdOps.units.seconds", {
															count: data.judge_default_timeout_secs,
														})}
													</span>
												),
											},
											{
												key: t("adminAwdOps.config.detail.judgeRetry"),
												value: (
													<span className="tnum">
														{t("adminAwdOps.units.seconds", {
															count: data.judge_retry_interval_secs,
														})}
													</span>
												),
											},
											{
												key: t("adminAwdOps.config.detail.archiveRetention"),
												value: (
													<span className="tnum">
														{t("adminAwdOps.units.hours", {
															count: data.archive_retention_hours,
														})}
													</span>
												),
											},
											{
												key: t("adminAwdOps.config.detail.plannedStart"),
												value: data.planned_start_at ? (
													<span className="tnum whitespace-nowrap">{formatDateTime(data.planned_start_at, { seconds: true })}</span>
												) : (
													<span className="text-muted-foreground">
														{t("adminAwdOps.config.values.manualStart")}
													</span>
												),
											},
											{
												key: t("adminAwdOps.config.detail.verifiedAt"),
												value: data.verified_at ? (
													<span className="tnum whitespace-nowrap">{formatDateTime(data.verified_at, { seconds: true })}</span>
												) : (
													<span className="text-muted-foreground">
														{t("adminAwdOps.config.values.notVerified")}
													</span>
												),
											},
											{
												key: t("adminAwdOps.config.detail.startedAt"),
												value: data.started_at ? (
													<span className="tnum whitespace-nowrap">{formatDateTime(data.started_at, { seconds: true })}</span>
												) : (
													<span className="text-muted-foreground">
														{t("adminAwdOps.config.values.notStarted")}
													</span>
												),
											},
											{
												key: t("adminAwdOps.config.detail.eventId"),
												value: <MonoText>{data.event_id}</MonoText>,
											},
										]}
									/>
									{!editable ? (
										<p className="text-xs text-muted-foreground">
											{t("adminAwdOps.config.lockedNote", {
												status: awdStatusLabel(data.status, t),
											})}
										</p>
									) : null}
								</div>
							</SectionCard>

							{editing ? (
								<EditAwdSheet
									eventId={eventId}
									status={data}
									onClose={() => setEditing(false)}
								/>
							) : null}
						</>
					);
				}}
			</QueryState>

			{/* 创建表单必须在 QueryState 之外：未开通时 QueryState 渲染的是空态，而不是 children。 */}
			{creating ? (
				<CreateAwdSheet eventId={eventId} family={family} onClose={() => setCreating(false)} />
			) : null}
		</>
	);
}
