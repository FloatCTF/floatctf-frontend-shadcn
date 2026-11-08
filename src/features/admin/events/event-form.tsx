/**
 * 赛事新建 / 编辑表单（`<FormSheet>`）。
 *
 * 只发送后端 `CreateEventRequest` / `PatchEventRequest` 真正接收的字段：
 * - 创建：family / participant_mode / purpose(可省略=competition) / title / description /
 *   hidden / allow_join / rules / flag_prefix / start_time / end_time；
 * - 编辑：title / description / hidden / allow_join / rules / flag_prefix / start_time / end_time
 *   （**family / participant_mode / purpose 创建后不可变更** —— 后端 PATCH 请求体里没有这三个字段，
 *   发过去也会被忽略，因此这里只读展示，不做「看似能改」的假交互）。
 *
 * 文案全部走 `adminEvents.form` 命名空间。
 */

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { Field, FormFooter, FormGrid, FormSheet, LocalTimeHint } from "~/components/app/form";
import { InlineError } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { EventFamily, EventPurpose, ParticipantMode } from "@floatctf/sdk/entity";
import type { Events } from "@floatctf/sdk/entity";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "~/lib/format";

import { EventFamilyPill, ParticipantModePill, useEventLabels } from "./shared";

interface EventFormState {
	title: string;
	description: string;
	family: EventFamily;
	participant_mode: ParticipantMode;
	start_time: string;
	end_time: string;
	hidden: boolean;
	allow_join: boolean;
	flag_prefix: string;
	rules: string;
}

function initialState(event: Events | null): EventFormState {
	if (event) {
		return {
			title: event.title,
			description: event.description ?? "",
			family: event.family,
			participant_mode: event.participant_mode,
			start_time: toDatetimeLocalValue(event.start_time),
			end_time: toDatetimeLocalValue(event.end_time ?? null),
			hidden: event.hidden,
			allow_join: event.allow_join,
			flag_prefix: event.flag_prefix ?? "",
			rules: event.rules,
		};
	}
	return {
		title: "",
		description: "",
		family: EventFamily.Jeopardy,
		participant_mode: ParticipantMode.Individual,
		start_time: "",
		end_time: "",
		hidden: false,
		allow_join: true,
		flag_prefix: "flag",
		rules: "",
	};
}

export function EventFormSheet({
	open,
	onOpenChange,
	event,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 有值 = 编辑；`null` = 新建。 */
	event: Events | null;
}) {
	const { t } = useTranslation();
	const labels = useEventLabels();
	const client = useClient();
	const queryClient = useQueryClient();
	const formId = useId();
	const [form, setForm] = useState<EventFormState>(() => initialState(event));
	const [errors, setErrors] = useState<{
		title?: string;
		start_time?: string;
		end_time?: string;
	}>({});

	const isEdit = event !== null;
	// 后端：competition 赛事必须有 end_time；practice（虚拟）赛事可以没有。
	const endRequired = event === null || event.purpose !== EventPurpose.Practice;

	const save = useMutation({
		mutationFn: (input: { id: string | null; payload: Partial<Events> }) =>
			input.id === null
				? call<Events>(client.admin.events.create(input.payload), t("adminEvents.actions.createEvent"))
				: call<Events>(client.admin.events.patch(input.payload), t("adminEvents.actions.saveEvent")),
		onSuccess: (saved, input) => {
			toast.success(
				input.id === null
					? t("adminEvents.form.toast.created")
					: t("adminEvents.form.toast.updated"),
			);
			// `qk.admin.events()` 的 `{}` 在 TanStack 的 partial match 中匹配全部参数组合。
			void queryClient.invalidateQueries({ queryKey: qk.admin.events() });
			void queryClient.invalidateQueries({ queryKey: qk.admin.event(saved.id) });
			onOpenChange(false);
		},
		onError: (error) =>
			toast.apiError(
				isEdit ? t("adminEvents.form.toast.saveFailed") : t("adminEvents.form.toast.createFailed"),
				error,
			),
	});

	function submit() {
		const nextErrors: typeof errors = {};
		if (form.title.trim() === "") nextErrors.title = t("adminEvents.form.validation.titleRequired");
		const startIso = fromDatetimeLocalValue(form.start_time);
		const endIso = fromDatetimeLocalValue(form.end_time);
		if (startIso === null) nextErrors.start_time = t("adminEvents.form.validation.startRequired");
		if (endRequired && endIso === null)
			nextErrors.end_time = t("adminEvents.form.validation.endRequired");
		if (startIso !== null && endIso !== null && startIso >= endIso) {
			nextErrors.end_time = t("adminEvents.form.validation.endBeforeStart");
		}
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) return;

		const flagPrefix = form.flag_prefix.trim();
		if (event === null) {
			save.mutate({
				id: null,
				payload: {
					family: form.family,
					participant_mode: form.participant_mode,
					title: form.title.trim(),
					description: form.description,
					hidden: form.hidden,
					allow_join: form.allow_join,
					rules: form.rules,
					flag_prefix: flagPrefix === "" ? undefined : flagPrefix,
					start_time: startIso as string,
					end_time: endIso as string,
				},
			});
			return;
		}

		save.mutate({
			id: event.id,
			payload: {
				id: event.id,
				// 乐观并发：把读到的 `updated_at` 一起回传（后端 PatchEventRequest 目前不消费该字段，
				// 语义是「我基于这个版本修改」；见交付报告）。
				updated_at: event.updated_at,
				title: form.title.trim(),
				description: form.description,
				hidden: form.hidden,
				allow_join: form.allow_join,
				rules: form.rules,
				flag_prefix: flagPrefix,
				start_time: startIso as string,
				...(endIso !== null ? { end_time: endIso } : {}),
			},
		});
	}

	return (
		<FormSheet
			open={open}
			onOpenChange={onOpenChange}
			width="lg"
			title={isEdit ? t("adminEvents.form.titleEdit") : t("adminEvents.form.titleCreate")}
			description={
				isEdit
					? t("adminEvents.form.descriptionEdit")
					: t("adminEvents.form.descriptionCreate")
			}
			footer={
				<FormFooter
					formId={formId}
					onCancel={() => onOpenChange(false)}
					isPending={save.isPending}
					submitLabel={
						isEdit ? t("adminEvents.form.submitSave") : t("adminEvents.form.submitCreate")
					}
				/>
			}
		>
			<form
				id={formId}
				className="space-y-4"
				onSubmit={(submitEvent) => {
					submitEvent.preventDefault();
					submit();
				}}
			>
				{save.isError ? <InlineError error={save.error} /> : null}
				<Field
					label={t("adminEvents.form.field.title")}
					htmlFor={`${formId}-title`}
					required
					error={errors.title}
				>
					<Input
						id={`${formId}-title`}
						value={form.title}
						maxLength={200}
						onChange={(changeEvent) => setForm({ ...form, title: changeEvent.target.value })}
						placeholder={t("adminEvents.form.field.titlePlaceholder")}
					/>
				</Field>

				<Field
					label={t("adminEvents.form.field.description")}
					htmlFor={`${formId}-description`}
					hint={t("adminEvents.form.field.descriptionHint")}
				>
					<Textarea
						id={`${formId}-description`}
						value={form.description}
						rows={3}
						onChange={(changeEvent) => setForm({ ...form, description: changeEvent.target.value })}
					/>
				</Field>

				{isEdit ? (
					<div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2">
						<p className="text-xs text-muted-foreground">
							{t("adminEvents.form.readonlyNote")}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<EventFamilyPill family={form.family} />
							<ParticipantModePill mode={form.participant_mode} />
							<span className="text-xs text-muted-foreground">
								{labels.family(form.family)} · {labels.mode(form.participant_mode)}
							</span>
						</div>
					</div>
				) : (
					<FormGrid>
						<Field
							label={t("adminEvents.form.field.family")}
							htmlFor={`${formId}-family`}
							required
							hint={t("adminEvents.form.field.familyHint")}
						>
							<Select
								value={form.family}
								onValueChange={(value) => {
									const family = value as EventFamily;
									setForm({
										...form,
										family,
										participant_mode:
											family === EventFamily.Awd ? ParticipantMode.Team : form.participant_mode,
									});
								}}
							>
								<SelectTrigger id={`${formId}-family`} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={EventFamily.Jeopardy}>
										{labels.family(EventFamily.Jeopardy)}
									</SelectItem>
									<SelectItem value={EventFamily.Awd}>
										{labels.family(EventFamily.Awd)}
									</SelectItem>
									<SelectItem value={EventFamily.Awdp}>
										{labels.family(EventFamily.Awdp)}
									</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<Field
							label={t("adminEvents.form.field.participantMode")}
							htmlFor={`${formId}-participant-mode`}
							required
							hint={t("adminEvents.form.field.participantModeHint")}
						>
							<Select
								value={form.participant_mode}
								disabled={form.family === EventFamily.Awd}
								onValueChange={(value) =>
									setForm({ ...form, participant_mode: value as ParticipantMode })
								}
							>
								<SelectTrigger id={`${formId}-participant-mode`} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{form.family === EventFamily.Awd ? (
										<SelectItem value={ParticipantMode.Team}>
											{labels.mode(ParticipantMode.Team)}
										</SelectItem>
									) : (
										<>
											<SelectItem value={ParticipantMode.Individual}>
												{labels.mode(ParticipantMode.Individual)}
											</SelectItem>
											<SelectItem value={ParticipantMode.Team}>
												{labels.mode(ParticipantMode.Team)}
											</SelectItem>
										</>
									)}
								</SelectContent>
							</Select>
						</Field>
					</FormGrid>
				)}

				<FormGrid>
					<Field
						label={t("adminEvents.form.field.startTime")}
						htmlFor={`${formId}-start`}
						required
						error={errors.start_time}
					>
						<Input
							id={`${formId}-start`}
							type="datetime-local"
							step={1}
							value={form.start_time}
							onChange={(changeEvent) => setForm({ ...form, start_time: changeEvent.target.value })}
						/>
					</Field>
					<Field
						label={t("adminEvents.form.field.endTime")}
						htmlFor={`${formId}-end`}
						required={endRequired}
						hint={
							endRequired ? undefined : t("adminEvents.form.field.endTimeHintPractice")
						}
						error={errors.end_time}
					>
						<Input
							id={`${formId}-end`}
							type="datetime-local"
							step={1}
							value={form.end_time}
							onChange={(changeEvent) => setForm({ ...form, end_time: changeEvent.target.value })}
						/>
					</Field>
				</FormGrid>
				<LocalTimeHint />

				<FormGrid>
					<Field
						label={t("adminEvents.form.field.flagPrefix")}
						htmlFor={`${formId}-prefix`}
						hint={t("adminEvents.form.field.flagPrefixHint")}
					>
						<Input
							id={`${formId}-prefix`}
							value={form.flag_prefix}
							maxLength={32}
							onChange={(changeEvent) => setForm({ ...form, flag_prefix: changeEvent.target.value })}
						/>
					</Field>
					<div className="flex flex-col gap-3">
						<label className="flex items-center justify-between gap-3 text-sm">
							<span>
								{t("adminEvents.form.field.hidden")}
								<span className="ml-2 text-xs text-muted-foreground">
									{t("adminEvents.form.field.hiddenHint")}
								</span>
							</span>
							<Switch
								checked={form.hidden}
								onCheckedChange={(checked) => setForm({ ...form, hidden: checked })}
								aria-label={t("adminEvents.form.field.hidden")}
							/>
						</label>
						<label className="flex items-center justify-between gap-3 text-sm">
							<span>
								{t("adminEvents.form.field.allowJoin")}
								<span className="ml-2 text-xs text-muted-foreground">
									{t("adminEvents.form.field.allowJoinHint")}
								</span>
							</span>
							<Switch
								checked={form.allow_join}
								onCheckedChange={(checked) => setForm({ ...form, allow_join: checked })}
								aria-label={t("adminEvents.form.field.allowJoin")}
							/>
						</label>
					</div>
				</FormGrid>

				<Field
					label={t("adminEvents.form.field.rules")}
					htmlFor={`${formId}-rules`}
					hint={t("adminEvents.form.field.rulesHint")}
					actions={
						<Button
							type="button"
							variant="ghost"
							size="xs"
							onClick={() =>
								setForm({ ...form, rules: t("adminEvents.form.rulesTemplate") })
							}
						>
							<Wand2 /> {t("adminEvents.form.field.templateButton")}
						</Button>
					}
				>
					<Textarea
						id={`${formId}-rules`}
						value={form.rules}
						rows={8}
						onChange={(changeEvent) => setForm({ ...form, rules: changeEvent.target.value })}
					/>
				</Field>
			</form>
		</FormSheet>
	);
}
