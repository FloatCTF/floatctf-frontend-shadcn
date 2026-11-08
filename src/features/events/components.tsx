/**
 * 赛事相关的共享组件：状态徽章、参赛/退赛、战队、writeup 提交。
 *
 * 参赛语义（与后端守卫及 Default 行为一致）：
 * - 仅在赛事**未开始**时可以加入/退出（个人赛走 `events.join/leave`，战队赛走 `createTeam/joinTeam/quitTeam`）；
 * - 非「未开始」且未加入 → 不展示赛事工作区内容（后端也会拒绝受保护接口）。
 *
 * 文案全部走 `events` 命名空间（docs/theme.md §8.4）；状态判定仍由 `~/lib/event-status.ts` 提供。
 */

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, LogIn, LogOut, ShieldAlert, Users } from "lucide-react";

import { call, callMaybe, callVoid, uploadFile } from "~/api/call";
import { useClient } from "~/api/client";
import { isNotFound } from "~/api/errors";
import { qk } from "~/api/keys";
import { useConfirm } from "~/components/app/confirm";
import {
	KeyValueList,
	MonoText,
	ReadonlyBlock,
	SectionCard,
} from "~/components/app/page";
import { EmptyBlock, InlineError, LoadingBlock } from "~/components/app/states";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import type { EventInfo } from "@floatctf/sdk";
import type { Events } from "@floatctf/sdk/entity";
import { formatRange, formatRelative } from "~/lib/format";
import {
	EVENT_STATUS_TONE,
	computeEventStatus,
	eventStatusOf,
	participationGate,
	type EventStatus,
} from "~/lib/event-status";
import { useNow } from "~/lib/hooks";

const STATUS_KEYS: Record<EventStatus, string> = {
	upcoming: "events.status.upcoming",
	ongoing: "events.status.ongoing",
	ended: "events.status.ended",
	unknown: "events.status.unknown",
};

const FAMILY_KEYS: Record<string, string> = {
	jeopardy: "events.family.jeopardy",
	awd: "events.family.awd",
	awdp: "events.family.awdp",
};

const MODE_KEYS: Record<string, string> = {
	individual: "events.participantMode.individual",
	team: "events.participantMode.team",
};

const PURPOSE_KEYS: Record<string, string> = {
	competition: "events.purpose.competition",
	practice: "events.purpose.practice",
};

/** 赛事状态 / 赛制 / 模式 / 类型的本地化文案（值本身仍来自后端与 event-status）。 */
export function useEventLabels() {
	const { t } = useTranslation();
	return {
		status: (status: EventStatus): string => t(STATUS_KEYS[status]),
		family: (family: string): string =>
			FAMILY_KEYS[family] ? t(FAMILY_KEYS[family]) : family,
		mode: (mode: string): string => (MODE_KEYS[mode] ? t(MODE_KEYS[mode]) : mode),
		purpose: (purpose: string): string =>
			PURPOSE_KEYS[purpose] ? t(PURPOSE_KEYS[purpose]) : purpose,
	};
}

export function EventStatusPill({
	event,
	className,
}: {
	event: Events;
	className?: string;
}) {
	const labels = useEventLabels();
	const now = useNow(30_000);
	const status = computeEventStatus(event.start_time, event.end_time ?? null, now.getTime());
	const label = labels.status(status);
	return (
		<TonePill tone={EVENT_STATUS_TONE[status]} className={className} title={label}>
			{label}
		</TonePill>
	);
}

export function EventFactsCard({ event }: { event: Events }) {
	const { t } = useTranslation();
	const labels = useEventLabels();
	const now = useNow(30_000);
	return (
		<SectionCard title={t("events.facts.title")}>
			<KeyValueList
				items={[
					{ key: t("events.facts.family"), value: labels.family(event.family) },
					{ key: t("events.facts.participantMode"), value: labels.mode(event.participant_mode) },
					{ key: t("events.facts.purpose"), value: labels.purpose(event.purpose) },
					{ key: t("events.facts.window"), value: formatRange(event.start_time, event.end_time ?? null) },
					{
						key: t("events.facts.allowJoin"),
						// 对齐后端：练习赛/系统赛事不支持自助报名；正式赛开赛后也会锁定。
						value:
							participationGate(event).kind === "open"
								? t("events.facts.joinAllowed")
								: participationGate(event).kind === "started"
									? t("events.facts.joinLocked")
									: participationGate(event).kind === "closed"
										? t("events.facts.joinDisallowed")
										: "—",
					},
					{
						key: t("events.facts.flagPrefix"),
						value: event.flag_prefix ? <MonoText>{event.flag_prefix}</MonoText> : "—",
					},
					{
						key: t("events.facts.visibility"),
						value: (
							<BooleanPill
								value={!event.hidden}
								trueText={t("events.facts.public")}
								falseText={t("events.facts.hidden")}
								trueTone="success"
								falseTone="muted"
							/>
						),
					},
					{
						key: t("events.facts.updatedAt"),
						value: <span className="text-xs">{formatRelative(event.updated_at, now)}</span>,
					},
				]}
				// 右栏宽度约 200px：两列会把「Jeopardy 解题」和时间窗挤成折行，单列更好读。
				columns={1}
			/>
		</SectionCard>
	);
}

/** 个人赛参赛 / 退赛（仅未开始时可用）。 */
export function JoinLeaveControl({ info, locked = false }: { info: EventInfo; locked?: boolean }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const now = useNow(30_000);
	const status = computeEventStatus(
		info.event.start_time,
		info.event.end_time ?? null,
		now.getTime(),
	);
	const gate = participationGate(info.event, now.getTime());
	const canJoin = !locked && gate.kind === "open";

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: qk.events.detail(info.event.id) });
		void queryClient.invalidateQueries({ queryKey: qk.events.all });
	};

	const join = useMutation({
		mutationFn: () =>
			callVoid(client.service.events.join(info.event.id), t("events.participation.joinAction")),
		onSuccess: () => {
			toast.success(t("events.participation.joinSuccess"));
			invalidate();
		},
		onError: (error) => toast.apiError(t("events.participation.joinFailed"), error),
	});

	const leave = useMutation({
		mutationFn: () =>
			callVoid(client.service.events.leave(info.event.id), t("events.participation.leave")),
		onSuccess: () => {
			toast.success(t("events.participation.leaveSuccess"));
			invalidate();
		},
		onError: (error) => toast.apiError(t("events.participation.leaveFailed"), error),
	});

	const gateReason =
		locked || gate.kind !== "closed"
			? t("events.participation.lockedHint")
			: t("events.participation.notOpenHint");

	// 练习赛 / 系统托管赛事：后端明确拒绝自助报名，这里不显示按钮，避免「点了必失败」。
	if (gate.kind === "not-competition" || gate.kind === "system-managed") {
		return (
			<p className="text-sm text-muted-foreground">
				{gate.kind === "not-competition"
					? t("events.participation.practiceHint")
					: t("events.participation.systemManagedHint")}
			</p>
		);
	}

	// 已结束的赛事：报名/退出都已关闭，不再渲染一个永远点不动的按钮。
	if (status === "ended") {
		return (
			<p className="text-sm text-muted-foreground">{t("events.participation.endedHint")}</p>
		);
	}

	return (
		<div className="space-y-2">
			{info.joined ? (
				<Button
					variant="destructive"
					disabled={!canJoin || leave.isPending}
					title={canJoin ? undefined : gateReason}
					onClick={async () => {
						const ok = await confirm({
							title: t("events.participation.leaveTitle"),
							description: info.event.title,
							consequences: [
								t("events.participation.leaveConsequence1"),
								t("events.participation.leaveConsequence2"),
							],
							tone: "danger",
							confirmText: t("events.participation.leaveConfirm"),
						});
						if (ok) leave.mutate();
					}}
				>
					<LogOut aria-hidden="true" /> {t("events.participation.leave")}
				</Button>
			) : (
				<Button
					disabled={!canJoin || join.isPending}
					title={canJoin ? undefined : gateReason}
					onClick={() => join.mutate()}
				>
					<LogIn aria-hidden="true" /> {t("events.participation.join")}
				</Button>
			)}
			{!canJoin ? <p className="text-xs text-muted-foreground">{gateReason}</p> : null}
			{join.isError ? <InlineError error={join.error} /> : null}
			{leave.isError ? <InlineError error={leave.error} /> : null}
		</div>
	);
}

/** 战队赛：建队 / 用 Team ID 加入 / 退队 / 查看成员。 */
export function TeamPanel({ info, locked = false }: { info: EventInfo; locked?: boolean }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const now = useNow(30_000);
	const gate = participationGate(info.event, now.getTime());
	const canChange = !locked && gate.kind === "open";
	const [teamName, setTeamName] = useState("");
	const [teamId, setTeamId] = useState("");

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: qk.events.detail(info.event.id) });
		void queryClient.invalidateQueries({ queryKey: qk.events.all });
	};

	const createTeam = useMutation({
		mutationFn: () =>
			call(
				client.service.events.createTeam({ event_id: info.event.id, name: teamName.trim() }),
				t("events.team.createAction"),
			),
		onSuccess: () => {
			toast.success(t("events.team.createSuccess"), t("events.team.createSuccessDescription"));
			setTeamName("");
			invalidate();
		},
		onError: (error) => toast.apiError(t("events.team.createFailed"), error),
	});

	const joinTeam = useMutation({
		mutationFn: (id: string) =>
			callVoid(
				client.service.events.joinTeam({ event_id: info.event.id, team_id: id }),
				t("events.team.joinAction"),
			),
		onSuccess: () => {
			toast.success(t("events.team.joinSuccess"));
			setTeamId("");
			invalidate();
		},
		onError: (error) => toast.apiError(t("events.team.joinFailed"), error),
	});

	const quitTeam = useMutation({
		mutationFn: (id: string) =>
			callVoid(
				client.service.events.quitTeam({ event_id: info.event.id, team_id: id }),
				t("events.team.quitAction"),
			),
		onSuccess: () => {
			toast.success(t("events.team.quitSuccess"));
			invalidate();
		},
		onError: (error) => toast.apiError(t("events.team.quitFailed"), error),
	});

	const team = info.team_result;

	// 已加入但战队关系缺失（历史半加入数据）同样需要给出加入 / 建队入口，
	// 否则会卡在一个只有说明文字、没有任何操作的死胡同里。
	if (!info.joined || !team) {
		if (!canChange) {
			return (
				<EmptyBlock
					title={
						info.joined
							? t("events.team.noTeamTitle")
							: t("events.team.notJoinedTitle")
					}
					description={
						info.joined
							? t("events.team.noTeamLockedDescription")
							: t("events.team.notJoinedDescription")
					}
					icon={<ShieldAlert className="size-5" aria-hidden="true" />}
				/>
			);
		}
		return (
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="join-team-id" className="text-xs">
						{t("events.team.joinTitle")}
					</Label>
					<div className="flex gap-2">
						<Input
							id="join-team-id"
							value={teamId}
							onChange={(event) => setTeamId(event.target.value)}
							placeholder={t("events.team.teamIdPlaceholder")}
							className="font-mono text-xs"
						/>
						<Button
							variant="outline"
							disabled={teamId.trim() === "" || joinTeam.isPending}
							onClick={() => joinTeam.mutate(teamId.trim())}
						>
							<Users aria-hidden="true" /> {t("events.team.join")}
						</Button>
					</div>
				</div>
				<Separator />
				<div className="space-y-2">
					<Label htmlFor="create-team-name" className="text-xs">
						{t("events.team.createTitle")}
					</Label>
					<div className="flex gap-2">
						<Input
							id="create-team-name"
							value={teamName}
							onChange={(event) => setTeamName(event.target.value)}
							placeholder={t("events.team.namePlaceholder")}
						/>
						<Button
							disabled={teamName.trim() === "" || createTeam.isPending}
							onClick={() => createTeam.mutate()}
						>
							{t("events.team.create")}
						</Button>
					</div>
				</div>
				{createTeam.isError ? <InlineError error={createTeam.error} /> : null}
				{joinTeam.isError ? <InlineError error={joinTeam.error} /> : null}
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-sm font-semibold">{team.team.name}</span>
					{team.team.banned ? (
						<TonePill tone="danger" icon={<ShieldAlert aria-hidden="true" />}>
							{t("events.team.banned")}
						</TonePill>
					) : null}
					<TonePill tone="info" className="tnum">
						{t("events.team.points", { points: team.team.points })}
					</TonePill>
				</div>
				{canChange ? (
					<Button
						variant="destructive"
						size="sm"
						disabled={quitTeam.isPending}
						onClick={async () => {
							const ok = await confirm({
								title: t("events.team.quitTitle"),
								description: team.team.name,
								consequences: [
									t("events.team.quitConsequence1"),
									t("events.team.quitConsequence2"),
								],
								tone: "danger",
								confirmText: t("events.team.quitConfirm"),
							});
							if (ok) quitTeam.mutate(team.team.id);
						}}
					>
						<LogOut aria-hidden="true" /> {t("events.team.quitAction")}
					</Button>
				) : (
					<p className="text-xs text-muted-foreground">{t("events.team.lockedNote")}</p>
				)}
			</div>

			<KeyValueList
				columns={1}
				items={[
					{ key: t("events.team.teamId"), value: <MonoText>{team.team.id}</MonoText> },
					...(team.team.description
						? [
								{
									key: t("events.team.description"),
									value: <ReadonlyBlock>{team.team.description}</ReadonlyBlock>,
								},
							]
						: []),
					{
						key: t("events.team.members"),
						value: (
							<ul className="space-y-1">
								{team.members.map((member) => (
									<li key={member.member.user_id} className="flex items-center gap-2 text-sm">
										<TonePill tone={member.member.role === "captain" ? "info" : "muted"}>
											{member.member.role === "captain"
												? t("events.team.captain")
												: t("events.team.member")}
										</TonePill>
										<span className="truncate">{member.member_name}</span>
										<span className="text-xs text-muted-foreground">
											{t("events.team.joinedAt", {
												time: formatRelative(member.member.joined_at, now),
											})}
										</span>
									</li>
								))}
							</ul>
						),
					},
				]}
			/>
			{quitTeam.isError ? <InlineError error={quitTeam.error} /> : null}
		</div>
	);
}

/** 赛后 writeup（PDF）提交状态 + 上传。 */
export function EventWriteupPanel({ info }: { info: EventInfo }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [file, setFile] = useState<File | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const own = useQuery({
		queryKey: qk.events.ownWriteup(info.event.id),
		queryFn: async () => {
			try {
				return await callMaybe<string>(
					client.service.events.getOwnWp(info.event.id),
					t("events.writeup.ownAction"),
				);
			} catch (error) {
				if (isNotFound(error)) return null;
				throw error;
			}
		},
		retry: false,
	});

	const upload = useMutation({
		mutationFn: (selected: File) =>
			uploadFile<null>({
				client,
				scope: "user",
				url: `/submit/writeup`,
				field: "writeup_pdf",
				file: selected,
				extra: {
					event_id: info.event.id,
					...(info.team_result ? { team_id: info.team_result.team.id } : {}),
				},
			}),
		onSuccess: () => {
			toast.success(t("events.writeup.success"));
			setFile(null);
			void queryClient.invalidateQueries({ queryKey: qk.events.ownWriteup(info.event.id) });
		},
		onError: (error) => toast.apiError(t("events.writeup.failed"), error),
	});

	if (own.isPending) return <LoadingBlock label={t("events.writeup.loading")} />;
	if (own.isError) {
		return (
			<div className="space-y-2">
				<InlineError error={own.error} />
				<Button variant="outline" size="sm" onClick={() => void own.refetch()}>
					{t("common.retry")}
				</Button>
			</div>
		);
	}

	// 防御：真实后端返回 string | null；非字符串（契约漂移）按「未提交」处理，绝不崩页。
	const submitted = typeof own.data === "string" && own.data.trim().length > 0;

	return (
		<div className="space-y-3">
			{submitted ? (
				<div className="rounded-lg border bg-muted/30 p-3 text-sm">
					<p className="mb-1 font-medium">{t("events.writeup.submitted")}</p>
					<MonoText className="text-muted-foreground">{own.data}</MonoText>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">{t("events.writeup.notSubmitted")}</p>
			)}
			<div className="flex flex-wrap items-center gap-2">
				<input
					ref={fileInputRef}
					type="file"
					accept="application/pdf"
					aria-label={t("events.writeup.fileLabel")}
					className="sr-only"
					onChange={async (event) => {
						const picked = event.target.files?.[0] ?? null;
						event.target.value = "";
						// `accept` 只是选择器过滤，用户可切到「所有文件」：这里先挡一次非 PDF。
						if (
							picked &&
							picked.type !== "application/pdf" &&
							!picked.name.toLowerCase().endsWith(".pdf")
						) {
							toast.warning(t("events.writeup.notPdf"));
							setFile(null);
							return;
						}
						// 后缀 / MIME 都可能伪造；读文件头挡掉必然被后端拒绝的伪 PDF。
						if (picked) {
							const head = await picked.slice(0, 1024).text();
							if (!head.includes("%PDF-")) {
								toast.error(t("events.writeup.invalidPdf"));
								setFile(null);
								return;
							}
						}
						setFile(picked);
					}}
				/>
				<Button
					type="button"
					variant="outline"
					onClick={() => fileInputRef.current?.click()}
				>
					<FileUp aria-hidden="true" />
					{t("events.writeup.choose")}
				</Button>
				{file ? (
					<span className="max-w-48 truncate text-xs text-muted-foreground" title={file.name}>
						{file.name}
					</span>
				) : null}
				<Button
					disabled={!file || upload.isPending}
					onClick={() => file && upload.mutate(file)}
				>
					{upload.isPending ? (
						<Loader2 className="animate-spin" aria-hidden="true" />
					) : (
						<FileUp aria-hidden="true" />
					)}
					{submitted ? t("events.writeup.resubmit") : t("events.writeup.submit")}
				</Button>
			</div>
			{upload.isError ? <InlineError error={upload.error} /> : null}
		</div>
	);
}

/** 未参赛且赛事已开始时的门禁提示（与后端权限一致）。 */
export function MemberGateNotice({ event }: { event: Events }) {
	const { t } = useTranslation();
	const gate = participationGate(event);
	const ended = eventStatusOf(event) === "ended";
	const title =
		gate.kind === "not-competition"
			? t("events.gate.practiceTitle")
			: gate.kind === "system-managed"
				? t("events.gate.systemTitle")
				: gate.kind === "closed"
					? t("events.gate.closedTitle")
					: ended
						? t("events.gate.endedTitle")
						: t("events.gate.title");
	const description =
		gate.kind === "not-competition"
			? t("events.gate.practiceDescription")
			: gate.kind === "system-managed"
				? t("events.gate.systemDescription")
				: gate.kind === "closed"
					? t("events.gate.closedDescription")
					: ended
						? t("events.gate.endedDescription")
						: t("events.gate.description");
	return (
		<div
			role="status"
			className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-700 dark:text-amber-400"
		>
			<p className="flex items-center gap-2 text-sm font-medium">
				<ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
				{title}
			</p>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
		</div>
	);
}
