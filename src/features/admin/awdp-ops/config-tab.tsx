/**
 * 「配置」标签：AWDP 赛事配置读写。
 *
 * 已核实的后端语义：
 * - `GET /admin/events/{id}/awdp` 同时返回配置与阶段（阶段来自 active / 最近一次 run）；
 *   非 AWDP 赛制会返回 400（后端 `ensure_awdp_event`）；
 * - PATCH 必须携带 `expected_updated_at`（乐观锁），且在**存在 active run 时锁定配置**；
 * - Break 时长不是独立可配置项：后端按「赛事总时长 − Fix 时长」推导，并把 `events.end_time`
 *   重算为 `start_time + Break + Fix`，因此本表单不提交 break_duration_secs；
 * - Fix 时长会被后端向下取整到回合间隔的整数倍（无 partial round），间隔不能整除会报错。
 *
 * 文案全部走 i18n（`adminAwdpOps.config.*`）。
 */

import { useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2 } from "lucide-react";

import type { AwdpConfigPatchInput, AwdpEventConfigDto, AwdpPhase } from "@floatctf/sdk";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import { KeyValueList, MonoText, SectionCard } from "~/components/app/page";
import { QueryState, TableSkeleton } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatDateTime, formatDuration, formatInt } from "~/lib/format";

import { useAwdpConfig } from "./queries";
import {
	awdpPhaseDescription,
	awdpPhaseLabel,
	isAwdpConflict,
	validateFixTiming,
} from "./shared";

/** 存在 active run 的阶段：后端 `update_config` 在这些阶段锁定配置。 */
const LOCKED_PHASES: readonly AwdpPhase[] = ["break", "preparing_fix", "fix"];

interface ConfigForm {
	fix_duration_secs: string;
	fix_round_interval_secs: string;
	break_score: string;
	fix_round_score: string;
}

function formFromConfig(config: AwdpEventConfigDto): ConfigForm {
	return {
		fix_duration_secs: String(config.fix_duration_secs),
		fix_round_interval_secs: String(config.fix_round_interval_secs),
		break_score: String(config.break_score),
		fix_round_score: String(config.fix_round_score),
	};
}

function EditAwdpConfigSheet({
	eventId,
	config,
	onClose,
}: {
	eventId: string;
	config: AwdpEventConfigDto;
	onClose: () => void;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [form, setForm] = useState<ConfigForm>(() => formFromConfig(config));
	const [errors, setErrors] = useState<Partial<Record<keyof ConfigForm, string>>>({});

	const mutation = useMutation({
		mutationFn: (patch: AwdpConfigPatchInput) =>
			call<AwdpEventConfigDto>(
				client.awdp.admin.updateConfig(eventId, patch),
				t("adminAwdpOps.calls.updateConfig"),
			),
		onSuccess: () => {
			toast.success(
				t("adminAwdpOps.config.toasts.saved"),
				t("adminAwdpOps.config.toasts.savedDescription"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awdp.adminConfig(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.admin.event(eventId) });
			onClose();
		},
		onError: (error) => {
			if (isAwdpConflict(error)) {
				toast.error(
					t("adminAwdpOps.config.toasts.conflict"),
					t("adminAwdpOps.config.toasts.conflictDescription"),
				);
				void queryClient.invalidateQueries({ queryKey: qk.awdp.adminConfig(eventId) });
				return;
			}
			toast.apiError(t("adminAwdpOps.config.toasts.saveFailed"), error);
		},
	});

	const fixDuration = Number(form.fix_duration_secs);
	const interval = Number(form.fix_round_interval_secs);
	const fixScore = Number(form.fix_round_score);
	const timingError = validateFixTiming(fixDuration, interval, t);
	const rounds = timingError === null ? Math.floor(fixDuration / interval) : null;
	const derivedBreakScore =
		rounds === null ? null : Math.floor((fixScore * rounds * 3) / 5);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const nextErrors: Partial<Record<keyof ConfigForm, string>> = {};
		if (timingError) {
			if (form.fix_duration_secs.trim() === "" || fixDuration <= 0) {
				nextErrors.fix_duration_secs = t("adminAwdpOps.config.errors.durationPositive");
			}
			if (form.fix_round_interval_secs.trim() === "" || interval <= 0) {
				nextErrors.fix_round_interval_secs = t("adminAwdpOps.config.errors.intervalPositive");
			}
			if (!nextErrors.fix_duration_secs && !nextErrors.fix_round_interval_secs) {
				nextErrors.fix_duration_secs = timingError;
			}
		}
		for (const key of ["break_score", "fix_round_score"] as const) {
			const raw = form[key].trim();
			if (raw === "" || !/^\d+$/.test(raw)) {
				nextErrors[key] = t("adminAwdpOps.config.errors.scoreInteger");
				continue;
			}
			if (Number(raw) > 1_000_000_000) {
				nextErrors[key] = t("adminAwdpOps.config.errors.scoreMax");
			}
		}
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;

		const patch: AwdpConfigPatchInput = {};
		if (fixDuration !== config.fix_duration_secs) patch.fix_duration_secs = fixDuration;
		if (interval !== config.fix_round_interval_secs) {
			patch.fix_round_interval_secs = interval;
		}
		if (Number(form.break_score) !== config.break_score) {
			patch.break_score = Number(form.break_score);
		}
		if (fixScore !== config.fix_round_score) patch.fix_round_score = fixScore;
		if (Object.keys(patch).length === 0) {
			toast.warning(t("adminAwdpOps.config.toasts.noChanges"));
			return;
		}
		mutation.mutate({ ...patch, expected_updated_at: config.updated_at });
	};

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("adminAwdpOps.config.sheet.title")}
			description={t("adminAwdpOps.config.sheet.description", {
				time: formatDateTime(config.updated_at, { seconds: true }),
			})}
			width="lg"
			footer={
				<FormFooter
					onCancel={onClose}
					formId="awdp-config-form"
					submitLabel={t("common.saveChanges")}
					isPending={mutation.isPending}
				/>
			}
		>
			<form id="awdp-config-form" onSubmit={submit} className="space-y-4">
				<FormGrid columns={2}>
					<Field
						label={t("adminAwdpOps.config.sheet.breakDuration")}
						htmlFor="awdp-break-duration"
						hint={t("adminAwdpOps.config.sheet.breakDurationHint")}
					>
						<Input
							id="awdp-break-duration"
							value={formatDuration(config.break_duration_secs)}
							readOnly
							disabled
							className="tnum"
						/>
					</Field>
					<Field
						label={t("adminAwdpOps.config.sheet.fixDuration")}
						htmlFor="awdp-fix-duration"
						required
						error={errors.fix_duration_secs}
						hint={t("adminAwdpOps.config.sheet.fixDurationHint")}
					>
						<Input
							id="awdp-fix-duration"
							type="number"
							inputMode="numeric"
							className="tnum"
							aria-invalid={Boolean(errors.fix_duration_secs)}
							value={form.fix_duration_secs}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, fix_duration_secs: event.target.value }))
							}
						/>
					</Field>
					<Field
						label={t("adminAwdpOps.config.sheet.roundInterval")}
						htmlFor="awdp-fix-interval"
						required
						error={errors.fix_round_interval_secs}
						hint={t("adminAwdpOps.config.sheet.roundIntervalHint")}
					>
						<Input
							id="awdp-fix-interval"
							type="number"
							inputMode="numeric"
							className="tnum"
							aria-invalid={Boolean(errors.fix_round_interval_secs)}
							value={form.fix_round_interval_secs}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, fix_round_interval_secs: event.target.value }))
							}
						/>
					</Field>
					<Field
						label={t("adminAwdpOps.config.sheet.breakScore")}
						htmlFor="awdp-break-score"
						required
						error={errors.break_score}
						hint={
							derivedBreakScore === null
								? t("adminAwdpOps.config.sheet.breakScoreHint")
								: t("adminAwdpOps.config.sheet.breakScoreDerived", {
										value: formatInt(derivedBreakScore),
									})
						}
					>
						<Input
							id="awdp-break-score"
							type="number"
							inputMode="numeric"
							className="tnum"
							aria-invalid={Boolean(errors.break_score)}
							value={form.break_score}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, break_score: event.target.value }))
							}
						/>
					</Field>
					<Field
						label={t("adminAwdpOps.config.sheet.fixRoundScore")}
						htmlFor="awdp-fix-score"
						required
						error={errors.fix_round_score}
						hint={
							rounds === null
								? t("adminAwdpOps.config.sheet.fixRoundScoreHint")
								: t("adminAwdpOps.config.sheet.fixRoundScoreRounds", { count: rounds })
						}
					>
						<Input
							id="awdp-fix-score"
							type="number"
							inputMode="numeric"
							className="tnum"
							aria-invalid={Boolean(errors.fix_round_score)}
							value={form.fix_round_score}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, fix_round_score: event.target.value }))
							}
						/>
					</Field>
				</FormGrid>
				<p className="text-xs text-muted-foreground">{t("adminAwdpOps.config.sheet.note")}</p>
			</form>
		</FormSheet>
	);
}

export function AwdpConfigTab({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const configQuery = useAwdpConfig(eventId);
	const [editing, setEditing] = useState(false);

	return (
		<QueryState
			query={configQuery}
			skeleton={<TableSkeleton rows={6} columns={3} />}
			errorTitle={t("adminAwdpOps.config.loadError")}
		>
			{(config) => {
				if (!config) return null;
				const locked = LOCKED_PHASES.includes(config.phase);
				return (
					<>
						<SectionCard
							title={t("adminAwdpOps.config.sectionTitle")}
							description={awdpPhaseDescription(config.phase, t)}
							actions={
								<Button
									variant="outline"
									size="sm"
									disabled={locked}
									title={
										locked
											? t("adminAwdpOps.config.editLockedTitle", {
													phase: awdpPhaseLabel(config.phase, t),
												})
											: t("adminAwdpOps.config.editHint")
									}
									onClick={() => setEditing(true)}
								>
									<Settings2 aria-hidden="true" />
									{t("adminAwdpOps.config.edit")}
								</Button>
							}
						>
							<div className="space-y-4">
								<div className="flex flex-wrap items-center gap-2">
									<TonePill tone={locked ? "warning" : "success"}>
										{locked
											? t("adminAwdpOps.config.locked")
											: t("adminAwdpOps.config.editable")}
									</TonePill>
									<TonePill tone="neutral">
										{t("adminAwdpOps.config.generation", {
											count: formatInt(config.configuration_generation),
										})}
									</TonePill>
									<span className="tnum text-xs text-muted-foreground">
										{t("adminAwdpOps.config.updatedAt", {
											time: formatDateTime(config.updated_at, { seconds: true }),
										})}
									</span>
								</div>
								<KeyValueList
									columns={3}
									items={[
										{
											key: t("adminAwdpOps.config.fields.breakDuration"),
											value: (
												<span className="tnum">
													{formatDuration(config.break_duration_secs)}
												</span>
											),
										},
										{
											key: t("adminAwdpOps.config.fields.fixDuration"),
											value: (
												<span className="tnum">
													{formatDuration(config.fix_duration_secs)}
												</span>
											),
										},
										{
											key: t("adminAwdpOps.config.fields.roundInterval"),
											value: (
												<span className="tnum">
													{formatDuration(config.fix_round_interval_secs)}
												</span>
											),
										},
										{
											key: t("adminAwdpOps.config.fields.totalRounds"),
											value: <span className="tnum">{formatInt(config.total_rounds)}</span>,
										},
										{
											key: t("adminAwdpOps.config.fields.breakScore"),
											value: <span className="tnum">{formatInt(config.break_score)}</span>,
										},
										{
											key: t("adminAwdpOps.config.fields.fixRoundScore"),
											value: (
												<span className="tnum">{formatInt(config.fix_round_score)}</span>
											),
										},
										{
											key: t("adminAwdpOps.config.fields.currentRound"),
											value: (
												<span className="tnum">{formatInt(config.current_round)}</span>
											),
										},
										{
											key: t("adminAwdpOps.config.fields.startedAt"),
											value: config.started_at ? (
												<span className="tnum">
													{formatDateTime(config.started_at, { seconds: true })}
												</span>
											) : (
												t("adminAwdpOps.config.values.notStarted")
											),
										},
										{
											key: t("adminAwdpOps.config.fields.breakEndsAt"),
											value: config.break_ends_at ? (
												<span className="tnum">
													{formatDateTime(config.break_ends_at, { seconds: true })}
												</span>
											) : (
												t("common.empty")
											),
										},
										{
											key: t("adminAwdpOps.config.fields.fixStartedAt"),
											value: config.fix_started_at ? (
												<span className="tnum">
													{formatDateTime(config.fix_started_at, { seconds: true })}
												</span>
											) : (
												t("common.empty")
											),
										},
										{
											key: t("adminAwdpOps.config.fields.fixEndsAt"),
											value: config.fix_ends_at ? (
												<span className="tnum">
													{formatDateTime(config.fix_ends_at, { seconds: true })}
												</span>
											) : (
												t("common.empty")
											),
										},
										{
											key: t("adminAwdpOps.config.fields.finishedAt"),
											value: config.finished_at ? (
												<span className="tnum">
													{formatDateTime(config.finished_at, { seconds: true })}
												</span>
											) : (
												t("adminAwdpOps.config.values.notFinished")
											),
										},
										{
											key: t("adminAwdpOps.config.fields.nextActionAt"),
											value: config.next_action_at ? (
												<span className="tnum">
													{formatDateTime(config.next_action_at, { seconds: true })}
												</span>
											) : (
												t("common.empty")
											),
										},
										{
											key: t("adminAwdpOps.config.fields.eventId"),
											value: <MonoText>{config.event_id}</MonoText>,
										},
									]}
								/>
							</div>
						</SectionCard>
						{editing ? (
							<EditAwdpConfigSheet
								eventId={eventId}
								config={config}
								onClose={() => setEditing(false)}
							/>
						) : null}
					</>
				);
			}}
		</QueryState>
	);
}
