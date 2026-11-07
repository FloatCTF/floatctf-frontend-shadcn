/**
 * 题目工作台 —— 练习题库（`/challenges/:id`）与赛事内题目（`/events/:id/challenges/:cid`）
 * **共用同一套真实解题流程**：
 *
 * 1. 读取该题当前用户的实例（可能没有 → 404 当「无实例」处理，不是错误）；
 * 2. 启动实例（静态题也会创建一个「无容器」的答题实例，实例上带着该题的 flag 比对值）；
 * 3. 提交 flag（比对的是**实例**的 flag；成功后后端会自动销毁实例）；
 * 4. 可选：写自己的题解（`getMyWriteup` / `createMyWriteup`）与查看他人题解。
 *
 * 注意：`InstancesDto.flag` 由后端恒定脱敏为空 —— 绝不把空值当 flag 展示或兜底。
 *
 * 版式：题库详情页把本组件当作**整块工作区**（`PageBody` 扣掉外壳高度后传入
 * `lg:flex-1`），左右两栏各自独立滚动；赛事页仍按普通页面流嵌入。
 */

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	CheckCircle2,
	Download,
	ExternalLink,
	FileText,
	Loader2,
	Paperclip,
	RotateCw,
	Send,
	Trash2,
} from "lucide-react";

import { call, callMaybe, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { useConfirm } from "~/components/app/confirm";
import { MarkdownEditor, MarkdownView } from "~/components/app/markdown";
import {
	CopyText,
	KeyValueList,
	MonoText,
	ReadonlyBlock,
	SectionCard,
} from "~/components/app/page";
import { EmptyBlock, ErrorBlock, InlineError, LoadingBlock, QueryState } from "~/components/app/states";
import { TonePill } from "~/components/app/badges";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import type { ChallengesListItem, Instances } from "@floatctf/sdk";
import { isNotFound } from "~/api/errors";
import { formatBytes, formatDateTime, formatRelative } from "~/lib/format";
import { useNow } from "~/lib/hooks";
import { cn } from "~/lib/utils";

export type WorkbenchMode = { kind: "practice" } | { kind: "event"; eventId: string };

export interface ChallengeWorkbenchProps {
	challenge: ChallengesListItem;
	mode: WorkbenchMode;
	className?: string;
	/** 附着在左栏底部的额外区块（题库详情页用它放公开题解）。 */
	children?: ReactNode;
}

/** 后端把实例入口写成一条 `<a href=...>`（见 instance_service.rs）；这里只取 URL，不注入 HTML。 */
function extractInstanceUrl(content: string | null | undefined): string | null {
	if (!content) return null;
	const href = /href="([^"]+)"/.exec(content);
	if (href) return href[1];
	const url = /https?:\/\/[^\s<>"']+/.exec(content);
	return url ? url[0] : null;
}

function instanceStatusTone(status: string | undefined): "success" | "warning" | "danger" | "muted" {
	switch ((status ?? "").toLowerCase()) {
		case "running":
			return "success";
		case "pending":
		case "starting":
			return "warning";
		case "failed":
		case "error":
			return "danger";
		default:
			return "muted";
	}
}

export function ChallengeWorkbench({ challenge, mode, className, children }: ChallengeWorkbenchProps) {
	const { t } = useTranslation();
	const confirm = useConfirm();
	const client = useClient();
	const queryClient = useQueryClient();
	const now = useNow(30_000);
	const [flag, setFlag] = useState("");
	const [writeupOpen, setWriteupOpen] = useState(false);

	const eventId = mode.kind === "event" ? mode.eventId : null;

	const instanceQuery = useQuery({
		queryKey: eventId
			? qk.events.challengeInstance(eventId, challenge.id)
			: qk.challenges.instance(challenge.id),
		queryFn: async (): Promise<Instances | null> => {
			try {
				return eventId
					? await callMaybe(client.service.events.getChallengeInstance(eventId, challenge.id))
					: await callMaybe(client.service.challenges.getInstance(challenge.id));
			} catch (error) {
				// 「没有实例」是正常状态（后端 404），不是页面错误。
				if (isNotFound(error)) return null;
				throw error;
			}
		},
		retry: false,
	});

	const invalidateAfterInstanceChange = () => {
		void queryClient.invalidateQueries({
			queryKey: eventId
				? qk.events.challengeInstance(eventId, challenge.id)
				: qk.challenges.instance(challenge.id),
		});
		void queryClient.invalidateQueries({ queryKey: qk.instances.all });
		if (eventId) {
			void queryClient.invalidateQueries({ queryKey: qk.events.challenges(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.events.instances(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.events.detail(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.events.scoreboard(eventId) });
		} else {
			void queryClient.invalidateQueries({ queryKey: qk.challenges.detail(challenge.id) });
			void queryClient.invalidateQueries({ queryKey: qk.challenges.all });
		}
	};

	const launch = useMutation({
		mutationFn: () =>
			eventId
				? call<Instances>(client.service.events.launchSingleInstance(eventId, challenge.id), "启动实例")
				: call<Instances>(client.service.instances.launch(challenge.id), "启动实例"),
		onSuccess: () => {
			toast.success(t("jeopardy.workbench.env.started"));
			invalidateAfterInstanceChange();
		},
		onError: (error) => toast.apiError(t("jeopardy.workbench.env.startFailed"), error),
	});

	const destroy = useMutation({
		mutationFn: (instanceId: string) =>
			callVoid(client.service.instances.destroy(instanceId), "销毁实例"),
		onSuccess: () => {
			toast.success(t("jeopardy.workbench.env.destroyed"));
			invalidateAfterInstanceChange();
		},
		onError: (error) => toast.apiError(t("jeopardy.workbench.env.destroyFailed"), error),
	});

	const submit = useMutation({
		mutationFn: (input: { instanceId: string; flag: string }) =>
			eventId
				? call(
						client.service.submit.submitSingle({
							event_id: eventId,
							instance_id: input.instanceId,
							flag: input.flag,
						}),
						"提交 flag",
					)
				: call(
						client.service.submit.submit({
							instance_id: input.instanceId,
							flag: input.flag,
						}),
						"提交 flag",
					),
		onSuccess: () => {
			setFlag("");
			toast.success(
				t("jeopardy.workbench.submit.success"),
				t("jeopardy.workbench.submit.successDescription"),
			);
			invalidateAfterInstanceChange();
			void queryClient.invalidateQueries({ queryKey: qk.solves.all });
			void queryClient.invalidateQueries({ queryKey: qk.auth.me() });
		},
		onError: (error) => toast.apiError(t("jeopardy.workbench.submit.failed"), error),
	});

	const instance = instanceQuery.data ?? null;
	const instanceUrl = extractInstanceUrl(instance?.content);
	const statusCode = (instance?.status ?? "").toLowerCase();
	const statusText =
		statusCode === "running"
			? t("jeopardy.status.running")
			: statusCode === "pending"
				? t("jeopardy.status.pending")
				: statusCode === "starting"
					? t("jeopardy.status.starting")
					: statusCode === "failed"
						? t("jeopardy.status.failed")
						: statusCode === "error"
							? t("jeopardy.status.error")
							: instance?.status || t("jeopardy.workbench.env.unknownStatus");

	async function handleDestroy(instanceId: string, identifier: string) {
		const ok = await confirm({
			title: t("jeopardy.workbench.confirmDestroy.title"),
			description: t("jeopardy.workbench.confirmDestroy.description", {
				identifier: identifier || instanceId,
			}),
			consequences: [
				t("jeopardy.workbench.confirmDestroy.consequenceContainer"),
				t("jeopardy.workbench.confirmDestroy.consequenceResubmit"),
			],
			tone: "danger",
			confirmText: t("jeopardy.workbench.confirmDestroy.confirmText"),
		});
		if (ok) destroy.mutate(instanceId);
	}

	return (
		<div
			className={cn(
				"grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden",
				className,
			)}
		>
			<div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
				<SectionCard
					title={t("jeopardy.workbench.descriptionTitle")}
					description={
						<div className="flex flex-wrap items-center gap-2">
							<TonePill tone="neutral" icon={<FileText aria-hidden="true" />}>
								{challenge.category || t("jeopardy.common.categoryFallback")}
							</TonePill>
							{challenge.version ? (
								<TonePill tone="info">
									{t("jeopardy.workbench.version", { version: challenge.version })}
								</TonePill>
							) : null}
							{challenge.solved ? (
								<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
									{t("jeopardy.common.solved")}
								</TonePill>
							) : null}
						</div>
					}
				>
					<MarkdownView>{challenge.description}</MarkdownView>

					{challenge.attachment ? (
						<>
							<Separator className="my-4" />
							<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
								<div className="flex min-w-0 items-center gap-2">
									<Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
									<span className="truncate text-sm" title={challenge.attachment.name}>
										{challenge.attachment.name}
									</span>
									{challenge.attachment.size ? (
										<span className="tnum text-xs text-muted-foreground">
											{formatBytes(challenge.attachment.size)}
										</span>
									) : null}
								</div>
								<Button variant="outline" size="sm" asChild>
									<a
										href={`/static/challenges/${challenge.safe_name}/${challenge.attachment.path}`}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Download aria-hidden="true" />
										{t("jeopardy.workbench.attachmentDownload")}
									</a>
								</Button>
							</div>
						</>
					) : null}
				</SectionCard>

				<SectionCard
					title={t("jeopardy.workbench.myWriteup.title")}
					description={t("jeopardy.workbench.myWriteup.description")}
					actions={
						<Button
							variant="ghost"
							size="sm"
							aria-expanded={writeupOpen}
							onClick={() => setWriteupOpen((value) => !value)}
						>
							{writeupOpen
								? t("jeopardy.workbench.myWriteup.collapse")
								: t("jeopardy.workbench.myWriteup.expand")}
						</Button>
					}
				>
					{writeupOpen ? (
						<MyWriteupEditor challengeId={challenge.id} />
					) : (
						<p className="text-sm text-muted-foreground">
							{t("jeopardy.workbench.myWriteup.hint")}
						</p>
					)}
				</SectionCard>

				{children}
			</div>

			<div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
				<SectionCard
					title={t("jeopardy.workbench.env.title")}
					description={t("jeopardy.workbench.env.description")}
				>
					{instanceQuery.isPending ? (
						<LoadingBlock label={t("jeopardy.workbench.env.loading")} />
					) : instanceQuery.isError ? (
						<ErrorBlock
							error={instanceQuery.error}
							title={t("jeopardy.workbench.env.loadError")}
							onRetry={() => instanceQuery.refetch()}
						/>
					) : instance ? (
						<div className="space-y-4">
							<KeyValueList
								columns={1}
								items={[
									{
										key: t("jeopardy.workbench.env.status"),
										value: (
											<TonePill tone={instanceStatusTone(instance.status)}>
												{statusText}
											</TonePill>
										),
									},
									{
										key: t("jeopardy.workbench.env.instanceId"),
										value: (
											<CopyText
												value={instance.id}
												label={t("jeopardy.workbench.env.instanceId")}
											/>
										),
									},
									{
										key: t("jeopardy.workbench.env.container"),
										value: instance.identifier ? (
											<MonoText>{instance.identifier}</MonoText>
										) : (
											<span className="text-xs text-muted-foreground">—</span>
										),
									},
									{
										key: t("jeopardy.workbench.env.destroyAt"),
										value: instance.destroy_at ? (
											<span className="tnum text-xs">
												{t("jeopardy.workbench.env.destroyAtValue", {
													time: formatDateTime(instance.destroy_at),
													relative: formatRelative(instance.destroy_at, now),
												})}
											</span>
										) : (
											<span className="text-xs text-muted-foreground">—</span>
										),
									},
								]}
							/>

							{instanceUrl ? (
								<div className="rounded-lg border bg-muted/30 p-3">
									<p className="mb-1 text-xs text-muted-foreground">
										{t("jeopardy.workbench.env.entry")}
									</p>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<CopyText
											value={instanceUrl}
											label={t("jeopardy.workbench.env.entry")}
										/>
										<Button variant="outline" size="sm" asChild>
											<a href={instanceUrl} target="_blank" rel="noopener noreferrer">
												<ExternalLink aria-hidden="true" />
												{t("jeopardy.workbench.env.open")}
											</a>
										</Button>
									</div>
								</div>
							) : instance.content ? (
								<ReadonlyBlock>{instance.content}</ReadonlyBlock>
							) : null}

							{mode.kind === "event" ? (
								<p className="text-xs text-muted-foreground">
									{t("jeopardy.workbench.env.eventNote")}
								</p>
							) : null}

							<div className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={launch.isPending}
									onClick={() => launch.mutate()}
								>
									{launch.isPending ? (
										<Loader2 className="animate-spin" aria-hidden="true" />
									) : (
										<RotateCw aria-hidden="true" />
									)}
									{t("jeopardy.workbench.env.relaunch")}
								</Button>
								<Button
									variant="destructive"
									size="sm"
									disabled={destroy.isPending}
									onClick={() => void handleDestroy(instance.id, instance.identifier)}
								>
									{destroy.isPending ? (
										<Loader2 className="animate-spin" aria-hidden="true" />
									) : (
										<Trash2 aria-hidden="true" />
									)}
									{t("jeopardy.workbench.env.destroy")}
								</Button>
							</div>
						</div>
					) : (
						<div className="space-y-3">
							<EmptyBlock
								title={t("jeopardy.workbench.env.emptyTitle")}
								description={
									challenge.flag_type === "dynamic"
										? t("jeopardy.workbench.env.emptyDynamic")
										: t("jeopardy.workbench.env.emptyStatic")
								}
							/>
							<Button
								className="w-full"
								disabled={launch.isPending}
								onClick={() => launch.mutate()}
							>
								{launch.isPending ? (
									<Loader2 className="animate-spin" aria-hidden="true" />
								) : (
									<RotateCw aria-hidden="true" />
								)}
								{t("jeopardy.workbench.env.start")}
							</Button>
						</div>
					)}
				</SectionCard>

				<SectionCard
					title={t("jeopardy.workbench.submit.title")}
					description={t("jeopardy.workbench.submit.description")}
				>
					<form
						className="space-y-3"
						onSubmit={(event) => {
							event.preventDefault();
							if (!instance) {
								toast.warning(t("jeopardy.workbench.submit.needInstance"));
								return;
							}
							if (flag.trim() === "") {
								toast.warning(t("jeopardy.workbench.submit.needFlag"));
								return;
							}
							submit.mutate({ instanceId: instance.id, flag: flag.trim() });
						}}
					>
						<div className="space-y-1.5">
							<Label htmlFor="flag-input">{t("jeopardy.workbench.submit.label")}</Label>
							<Input
								id="flag-input"
								value={flag}
								onChange={(event) => setFlag(event.target.value)}
								placeholder={t("jeopardy.workbench.submit.placeholder")}
								className="font-mono"
								autoComplete="off"
								aria-describedby="flag-hint"
							/>
							<p id="flag-hint" className="text-xs text-muted-foreground">
								{t("jeopardy.workbench.submit.hint")}
							</p>
						</div>
						{submit.isError ? <InlineError error={submit.error} /> : null}
						<Button
							type="submit"
							className="w-full"
							disabled={submit.isPending || !instance}
							title={!instance ? t("jeopardy.workbench.submit.needInstance") : undefined}
						>
							{submit.isPending ? (
								<Loader2 className="animate-spin" aria-hidden="true" />
							) : (
								<Send aria-hidden="true" />
							)}
							{t("jeopardy.workbench.submit.submit")}
						</Button>
					</form>
				</SectionCard>
			</div>
		</div>
	);
}

/** 我的题解：读取（可能 404 = 还没写）→ 保存（POST upsert）。 */
export function MyWriteupEditor({ challengeId }: { challengeId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [content, setContent] = useState<string | null>(null);

	const query = useQuery({
		// 题解始终按**题目**维度缓存：`qk.events.ownWriteup` 属于赛事 PDF writeup，语义不同，绝不能共用。
		queryKey: qk.challenges.myWriteup(challengeId),
		queryFn: async () => {
			try {
				return await callMaybe<{ content: string }>(
					client.service.challenges.getMyWriteup(challengeId),
					"我的题解",
				);
			} catch (error) {
				if (isNotFound(error)) return null;
				throw error;
			}
		},
		retry: false,
	});

	const save = useMutation({
		mutationFn: (text: string) =>
			call(
				client.service.challenges.createMyWriteup({ challenge_id: challengeId, content: text }),
				"保存题解",
			),
		onSuccess: () => {
			toast.success(t("jeopardy.workbench.myWriteup.saved"));
			void queryClient.invalidateQueries({
				queryKey: qk.challenges.myWriteup(challengeId),
			});
		},
		onError: (error) => toast.apiError(t("jeopardy.workbench.myWriteup.saveFailed"), error),
	});

	if (query.isPending) return <LoadingBlock label={t("jeopardy.workbench.myWriteup.loading")} />;
	if (query.isError) {
		return (
			<ErrorBlock
				error={query.error}
				title={t("jeopardy.workbench.myWriteup.loadError")}
				onRetry={() => query.refetch()}
			/>
		);
	}

	const value = content ?? query.data?.content ?? "";

	return (
		<div className="space-y-3">
			<MarkdownEditor
				value={value}
				onChange={(next) => setContent(next)}
				minHeight={240}
				placeholder={t("jeopardy.workbench.myWriteup.placeholder")}
			/>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-xs text-muted-foreground">
					{query.data?.content
						? t("jeopardy.workbench.myWriteup.existing")
						: t("jeopardy.workbench.myWriteup.empty")}
				</p>
				<Button
					disabled={save.isPending || value.trim() === ""}
					title={
						value.trim() === ""
							? t("jeopardy.workbench.myWriteup.saveDisabled")
							: undefined
					}
					onClick={() => save.mutate(value)}
				>
					{save.isPending ? (
						<Loader2 className="animate-spin" aria-hidden="true" />
					) : null}
					{t("jeopardy.workbench.myWriteup.save")}
				</Button>
			</div>
			{save.isError ? <InlineError error={save.error} /> : null}
		</div>
	);
}

/** 他人题解列表（可选能力；按题目维度）。 */
export function ChallengeWriteups({ challengeId }: { challengeId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const now = useNow(60_000);
	const query = useQuery({
		queryKey: [...qk.challenges.writeups(challengeId)],
		queryFn: () => call(client.service.challenges.getWriteups(challengeId), "题解列表"),
	});

	return (
		<QueryState
			query={query}
			skeleton={<LoadingBlock label={t("jeopardy.writeups.loading")} />}
			errorTitle={t("jeopardy.writeups.loadError")}
			isEmpty={(items) => items.length === 0}
			empty={
				<EmptyBlock
					title={t("jeopardy.writeups.emptyTitle")}
					description={t("jeopardy.writeups.emptyDescription")}
				/>
			}
		>
			{(items) => (
				<ul className="divide-y">
					{items.map((item) => (
						<li key={item.id} className="py-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-sm font-medium" data-user-data>
									{item.nickname}
								</span>
								<span className="tnum text-xs text-muted-foreground">
									{formatRelative(item.writeup.updated_at, now)}
								</span>
							</div>
							<div className="mt-2">
								<MarkdownView>{item.writeup.content}</MarkdownView>
							</div>
						</li>
					))}
				</ul>
			)}
		</QueryState>
	);
}
