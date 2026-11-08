/**
 * 赛事控制台 · 配置标签。
 *
 * 可写字段以 SDK / 后端 `PatchEventRequest` 为准（title / description / hidden /
 * allow_join / rules / flag_prefix / start_time / end_time）；**家族、参赛模式、用途**
 * 后端 PATCH 请求体不接收（创建即固定），这里只读展示并说明原因，不做假交互。
 *
 * 文案全部走 `adminEvents.config` 命名空间。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PencilLine } from "lucide-react";

import { BooleanPill, TonePill } from "~/components/app/badges";
import { MarkdownView } from "~/components/app/markdown";
import { CopyText, KeyValueList, MonoText, SectionCard } from "~/components/app/page";
import { Button } from "~/components/ui/button";
import { EventPurpose } from "@floatctf/sdk/entity";
import type { Events } from "@floatctf/sdk/entity";
import { formatDateTime, formatRange } from "~/lib/format";
import { EVENT_STATUS_TONE, computeEventStatus } from "~/lib/event-status";

import { EventFormSheet } from "./event-form";
import { useEventLabels } from "./shared";

export function EventConfigTab({ event }: { event: Events }): ReactNode {
	const { t } = useTranslation();
	const labels = useEventLabels();
	const [editing, setEditing] = useState(false);
	const status = computeEventStatus(event.start_time, event.end_time ?? null);
	const statusLabel = labels.status(status);

	return (
		<div className="space-y-5">
			<SectionCard
				title={t("adminEvents.config.identityTitle")}
				description={t("adminEvents.config.identityDescription")}
			>
				<KeyValueList
					columns={2}
					items={[
						{
							key: t("adminEvents.config.fields.eventId"),
							value: (
								<CopyText
									value={event.id}
									label={t("adminEvents.config.fields.eventId")}
								/>
							),
						},
						{
							key: t("adminEvents.config.fields.family"),
							value: (
								<TonePill tone="neutral" title={labels.family(event.family)}>
									{labels.family(event.family)}
								</TonePill>
							),
							hint: t("adminEvents.config.hints.immutable"),
						},
						{
							key: t("adminEvents.config.fields.participantMode"),
							value: (
								<TonePill tone="info" title={labels.mode(event.participant_mode)}>
									{labels.mode(event.participant_mode)}
								</TonePill>
							),
							hint: t("adminEvents.config.hints.immutable"),
						},
						{
							key: t("adminEvents.config.fields.purpose"),
							value: (
								<TonePill
									tone={event.purpose === EventPurpose.Practice ? "warning" : "muted"}
									title={labels.purpose(event.purpose)}
								>
									{labels.purpose(event.purpose)}
								</TonePill>
							),
						},
						{
							key: t("adminEvents.config.fields.virtual"),
							value: (
								<BooleanPill
									value={event.is_virtual}
									trueText={t("common.yes")}
									falseText={t("common.no")}
									trueTone="warning"
									falseTone="muted"
								/>
							),
							hint: t("adminEvents.config.hints.virtualDerived"),
						},
						{
							key: t("adminEvents.config.fields.systemManaged"),
							value: event.system_key ? (
								<MonoText>{event.system_key}</MonoText>
							) : (
								<span className="text-sm text-muted-foreground">
									{t("adminEvents.config.values.no")}
								</span>
							),
							hint: event.system_key
								? t("adminEvents.config.hints.systemManaged")
								: undefined,
						},
						{
							key: t("adminEvents.config.fields.createdAt"),
							value: (
								<MonoText>{formatDateTime(event.created_at, { seconds: true })}</MonoText>
							),
						},
						{
							key: t("adminEvents.config.fields.updatedAt"),
							value: (
								<MonoText>{formatDateTime(event.updated_at, { seconds: true })}</MonoText>
							),
							hint: t("adminEvents.config.hints.updatedAt"),
						},
					]}
				/>
			</SectionCard>

			<SectionCard
				title={t("adminEvents.config.editableTitle")}
				description={t("adminEvents.config.editableDescription")}
				actions={
					<Button variant="outline" size="sm" onClick={() => setEditing(true)}>
						<PencilLine /> {t("adminEvents.config.edit")}
					</Button>
				}
			>
				<KeyValueList
					columns={2}
					items={[
						{ key: t("adminEvents.config.fields.title"), value: event.title },
						{
							key: t("adminEvents.config.fields.status"),
							value: (
								<TonePill tone={EVENT_STATUS_TONE[status]} title={statusLabel}>
									{statusLabel}
								</TonePill>
							),
							hint: t("adminEvents.config.hints.status"),
						},
						{
							key: t("adminEvents.config.fields.window"),
							value: (
								<MonoText className="text-sm">
									{formatRange(event.start_time, event.end_time ?? null)}
								</MonoText>
							),
						},
						{
							key: t("adminEvents.config.fields.flagPrefix"),
							value: event.flag_prefix ? (
								<MonoText>{event.flag_prefix}</MonoText>
							) : (
								<span className="text-sm text-muted-foreground">
									{t("adminEvents.config.values.flagPrefixDefault")}
								</span>
							),
						},
						{
							key: t("adminEvents.config.fields.hidden"),
							value: (
								<BooleanPill
									value={event.hidden}
									trueText={t("adminEvents.config.values.hidden")}
									falseText={t("adminEvents.config.values.public")}
									trueTone="muted"
									falseTone="success"
								/>
							),
						},
						{
							key: t("adminEvents.config.fields.allowJoin"),
							value: (
								<BooleanPill
									value={event.allow_join}
									trueText={t("adminEvents.config.values.allowJoin")}
									falseText={t("adminEvents.config.values.disallowJoin")}
									trueTone="success"
									falseTone="muted"
								/>
							),
						},
					]}
				/>
				<div className="mt-5 space-y-5">
					<div>
						<p className="mb-2 text-xs text-muted-foreground">
							{t("adminEvents.config.fields.description")}
						</p>
						<MarkdownView emptyText={t("adminEvents.config.values.descriptionEmpty")}>
							{event.description}
						</MarkdownView>
					</div>
					<div>
						<p className="mb-2 text-xs text-muted-foreground">
							{t("adminEvents.config.fields.rules")}
						</p>
						<MarkdownView emptyText={t("adminEvents.config.values.rulesEmpty")}>
							{event.rules}
						</MarkdownView>
					</div>
				</div>
			</SectionCard>

			{editing ? (
				<EventFormSheet
					open
					onOpenChange={(next) => {
						if (!next) setEditing(false);
					}}
					event={event}
				/>
			) : null}
		</div>
	);
}
