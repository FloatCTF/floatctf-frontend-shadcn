/**
 * AWD 驾驶舱的域内组件：状态胶囊 / flag 提交 / GameBox 表 / 实时积分榜 / 网络凭据。
 *
 * 每个组件自己持有 query 与 mutation，页面只负责布局 —— 但**所有** query key 都来自
 * `~/api/keys` 的 `qk.awd.*`（与 `@floatctf/react` 的 SSE 失效常量一致），
 * 否则事件到达时面板不会刷新。所有文案走 `awd.*` i18n key。
 */

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
	AlertTriangle,
	Download,
	Loader2,
	RefreshCw,
	RotateCcw,
	ShieldAlert,
	Swords,
	TerminalSquare,
} from "lucide-react";

import type {
	AwdGameBox,
	AwdPlayerStatus,
	AwdScoreRow,
	SshAccessResponse,
	WireGuardConfigResponse,
} from "@floatctf/sdk";

import { call, callMaybe, callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable } from "~/components/app/data-table";
import { Field } from "~/components/app/form";
import {
	CopyText,
	MonoText,
	ReadonlyBlock,
	SecretValue,
	SectionCard,
} from "~/components/app/page";
import {
	EmptyBlock,
	ErrorBlock,
	InlineError,
	QueryState,
	TableSkeleton,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { formatPoints } from "~/lib/format";
import { useCopyToClipboard } from "~/lib/hooks";

import {
	AWD_RESET_CONSEQUENCE_KEYS,
	awdCredentialsUnavailable,
	awdFlagGate,
	awdHealthLabel,
	awdPhaseKey,
	awdPhaseTone,
	awdResetGate,
	awdStatusKey,
	awdStatusTone,
	gameboxStatusKey,
	gameboxStatusTone,
	type AwdUnavailableHint,
} from "./domain";

/** 触发浏览器下载（内容不进 URL）—— 与 Default 的 `Blob + a[download]` 同法。 */
function downloadTextFile(filename: string, content: string): void {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

/** 不能执行操作的原因 —— 用琥珀提示条，而不是把状态限制伪装成字段错误。 */
function AwdGateNotice({ reasonKey }: { reasonKey: string }): ReactNode {
	const { t } = useTranslation();
	return (
		<div
			role="status"
			className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
		>
			<AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden="true" />
			<p className="min-w-0">{t(reasonKey)}</p>
		</div>
	);
}

/** 「网络凭据尚未可用」业务态：保留后端原文，并提供重新检查。 */
function AwdUnavailable({
	hint,
	onRetry,
}: {
	hint: AwdUnavailableHint;
	onRetry: () => void;
}): ReactNode {
	const { t } = useTranslation();
	return (
		<EmptyBlock
			title={t(hint.titleKey)}
			description={
				hint.message
					? t(hint.descriptionKey, { message: hint.message })
					: t(hint.descriptionKey)
			}
			action={
				<Button variant="outline" size="sm" onClick={onRetry}>
					<RefreshCw className="size-4" aria-hidden="true" />
					{t("awd.arena.retryCheck")}
				</Button>
			}
		/>
	);
}

/** 状态胶囊组 —— 颜色 + 文字一起表达状态，颜色不单独承载信息。 */
export function AwdStatePills({
	status,
	phase,
	banned,
	finalSettlement,
}: {
	status: string;
	phase: string;
	banned: boolean;
	finalSettlement: boolean;
}): ReactNode {
	const { t } = useTranslation();
	return (
		<span className="flex flex-wrap items-center gap-1.5">
			<TonePill tone={awdStatusTone(status)}>{t(awdStatusKey(status))}</TonePill>
			<TonePill tone={awdPhaseTone(phase)}>{t(awdPhaseKey(phase))}</TonePill>
			{banned ? <TonePill tone="danger">{t("awd.state.teamBanned")}</TonePill> : null}
			{finalSettlement ? (
				<TonePill tone="warning">{t("awd.state.settlementActive")}</TonePill>
			) : null}
		</span>
	);
}

/** flag 提交（攻击得分）。提交按钮的可用性完全由后端 status 派生。 */
export function AwdFlagPanel({
	eventId,
	status,
}: {
	eventId: string;
	status: AwdPlayerStatus;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [flag, setFlag] = useState("");
	const gate = awdFlagGate(status);

	const mutation = useMutation({
		mutationFn: (value: string) =>
			callVoid(
				client.awd.player.submitFlag(eventId, value),
				t("awd.actionNames.submitFlag"),
			),
		onSuccess: () => {
			setFlag("");
			toast.success(t("awd.flag.success"));
			void queryClient.invalidateQueries({ queryKey: qk.awd.status(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.scores(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.gameboxes(eventId) });
		},
		onError: (error) => toast.apiError(t("awd.flag.error"), error),
	});

	return (
		<SectionCard
			title={t("awd.flag.title")}
			description={t("awd.flag.description")}
			actions={
				<TonePill tone="neutral" className="tnum">
					{t("awd.flag.round", { round: status.current_round ?? "—" })}
				</TonePill>
			}
		>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					const value = flag.trim();
					if (!value || !gate.allowed || mutation.isPending) return;
					mutation.mutate(value);
				}}
			>
				{!gate.allowed ? <AwdGateNotice reasonKey={gate.reasonKey} /> : null}
				<Field
					label={t("awd.flag.label")}
					htmlFor="awd-flag"
					hint={t("awd.flag.hint")}
				>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input
							id="awd-flag"
							value={flag}
							autoComplete="off"
							spellCheck={false}
							placeholder={t("awd.flag.placeholder")}
							aria-label={t("awd.flag.label")}
							disabled={!gate.allowed || mutation.isPending}
							onChange={(event) => setFlag(event.target.value)}
							className="min-w-0 flex-1 font-mono"
						/>
						<Button
							type="submit"
							className="shrink-0"
							disabled={
								!gate.allowed || mutation.isPending || flag.trim().length === 0
							}
						>
							{mutation.isPending ? (
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							) : (
								<Swords className="size-4" aria-hidden="true" />
							)}
							{mutation.isPending
								? t("awd.flag.submitting")
								: t("awd.flag.submit")}
						</Button>
					</div>
				</Field>
				{mutation.isError ? <InlineError error={mutation.error} /> : null}
			</form>
		</SectionCard>
	);
}

/** 我的 GameBox 列表 + 行内重置（破坏性 → useConfirm）。 */
export function AwdGameboxPanel({
	eventId,
	status,
}: {
	eventId: string;
	status: AwdPlayerStatus;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [pendingId, setPendingId] = useState<string | null>(null);
	const gate = awdResetGate(status);

	const query = useQuery({
		queryKey: qk.awd.gameboxes(eventId),
		queryFn: () =>
			call<AwdGameBox[]>(
				client.awd.player.gameboxes(eventId),
				t("awd.actionNames.gameboxList"),
			),
	});

	const mutation = useMutation({
		mutationFn: (row: AwdGameBox) =>
			callVoid(
				client.awd.player.resetGamebox(eventId, row.id),
				t("awd.actionNames.resetGamebox"),
			),
		onMutate: (row) => setPendingId(row.id),
		onSettled: () => setPendingId(null),
		onSuccess: () => {
			toast.success(
				t("awd.gamebox.success.title"),
				t("awd.gamebox.success.description"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awd.gameboxes(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.status(eventId) });
		},
		onError: (error) => toast.apiError(t("awd.gamebox.resetError"), error),
	});

	async function askReset(row: AwdGameBox) {
		const ok = await confirm({
			title: t("awd.gamebox.confirm.title", {
				name: row.gamebox_name || row.container_name,
			}),
			description: t("awd.gamebox.confirm.description"),
			consequences: AWD_RESET_CONSEQUENCE_KEYS.map((key) => t(key)),
			tone: "danger",
			confirmText: t("awd.gamebox.confirm.action"),
		});
		if (ok) mutation.mutate(row);
	}

	return (
		<SectionCard
			title={t("awd.gamebox.title")}
			description={t("awd.gamebox.description")}
		>
			<div className="space-y-4">
				{!gate.allowed ? <AwdGateNotice reasonKey={gate.reasonKey} /> : null}
				{mutation.isError ? <InlineError error={mutation.error} /> : null}
				<QueryState
					query={query}
					skeleton={<TableSkeleton rows={3} columns={4} />}
					errorTitle={t("awd.gamebox.loadError")}
					isEmpty={(rows) => rows.length === 0}
					empty={
						<EmptyBlock
							title={t("awd.gamebox.empty.title")}
							description={t("awd.gamebox.empty.description")}
						/>
					}
				>
					{(rows) => (
						<DataTable
							data={rows}
							getRowId={(row) => row.id}
							columns={[
								{
									id: "name",
									header: t("awd.gamebox.columns.name"),
									sortValue: (row) => row.gamebox_name,
									cell: (row) => (
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">
												{row.gamebox_name || row.container_name}
											</p>
											<MonoText className="text-muted-foreground">
												{row.container_name}
											</MonoText>
										</div>
									),
								},
								{
									id: "ip",
									header: t("awd.gamebox.columns.ip"),
									sortValue: (row) => row.gamebox_ip,
									cell: (row) => <MonoText>{row.gamebox_ip || "—"}</MonoText>,
								},
								{
									id: "status",
									header: t("awd.gamebox.columns.status"),
									sortValue: (row) => row.status,
									cell: (row) => (
										<TonePill tone={gameboxStatusTone(row.status)}>
											{t(gameboxStatusKey(row.status))}
										</TonePill>
									),
								},
								{
									id: "health",
									header: t("awd.gamebox.columns.health"),
									hideBelow: "md",
									sortValue: (row) => row.health_status,
									cell: (row) => (
										<span className="text-sm text-muted-foreground">
											{awdHealthLabel(row.health_status, t)}
										</span>
									),
								},
							]}
							rowActions={(row) => (
								<Button
									variant="outline"
									size="sm"
									disabled={!gate.allowed || mutation.isPending}
									title={
										gate.allowed
											? t("awd.gamebox.resetHint")
											: t(gate.reasonKey)
									}
									onClick={() => void askReset(row)}
								>
									<RotateCcw className="size-4" aria-hidden="true" />
									{pendingId === row.id
										? t("awd.gamebox.resetting")
										: t("awd.gamebox.reset")}
								</Button>
							)}
							mobileCard={(row) => (
								<div className="space-y-2">
									<div className="flex items-start justify-between gap-2">
										<span className="min-w-0 truncate text-sm font-medium">
											{row.gamebox_name || row.container_name}
										</span>
										<TonePill tone={gameboxStatusTone(row.status)}>
											{t(gameboxStatusKey(row.status))}
										</TonePill>
									</div>
									<MonoText>{row.gamebox_ip || "—"}</MonoText>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<span className="text-xs text-muted-foreground">
											{t("awd.gamebox.healthValue", {
												health: awdHealthLabel(row.health_status, t),
											})}
										</span>
										<Button
											variant="outline"
											size="sm"
											disabled={!gate.allowed || mutation.isPending}
											title={
												gate.allowed
													? t("awd.gamebox.resetHint")
													: t(gate.reasonKey)
											}
											onClick={() => void askReset(row)}
										>
											<RotateCcw className="size-4" aria-hidden="true" />
											{pendingId === row.id
												? t("awd.gamebox.resetting")
												: t("awd.gamebox.reset")}
										</Button>
									</div>
								</div>
							)}
						/>
					)}
				</QueryState>
			</div>
		</SectionCard>
	);
}

/** 实时积分榜 —— 我的队伍高亮；`key` 与 SSE 失效常量对齐。 */
export function AwdScoreboardPanel({
	eventId,
	myTeamId,
}: {
	eventId: string;
	myTeamId: string | null;
}): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.awd.scores(eventId),
		queryFn: () =>
			call<AwdScoreRow[]>(
				client.awd.player.scores(eventId),
				t("awd.actionNames.scores"),
			),
	});

	return (
		<SectionCard
			title={t("awd.board.title")}
			description={t("awd.board.description")}
		>
			<QueryState
				query={query}
				skeleton={<TableSkeleton rows={6} columns={5} />}
				errorTitle={t("awd.board.loadError")}
				isEmpty={(rows) => rows.length === 0}
				empty={
					<EmptyBlock
						title={t("awd.board.empty.title")}
						description={t("awd.board.empty.description")}
					/>
				}
			>
				{(rows) => (
					<DataTable
						data={rows}
						getRowId={(row) => row.team_id}
						columns={[
							{
								id: "rank",
								header: t("awd.board.columns.rank"),
								align: "right",
								sortValue: (row) => row.rank,
								cell: (row) => <MonoText>{row.rank}</MonoText>,
							},
							{
								id: "team",
								header: t("awd.board.columns.team"),
								sortValue: (row) => row.team_name,
								cell: (row) =>
									row.team_id === myTeamId ? (
										<span className="flex flex-wrap items-center gap-1.5 font-semibold">
											<MonoText
												className="text-sm font-semibold"
												title={row.team_name}
											>
												{row.team_name}
											</MonoText>
											<TonePill tone="info">{t("awd.board.myTeam")}</TonePill>
										</span>
									) : (
										<MonoText className="text-sm" title={row.team_name}>
											{row.team_name}
										</MonoText>
									),
							},
							{
								id: "attack",
								header: t("awd.board.columns.attack"),
								align: "right",
								hideBelow: "sm",
								sortValue: (row) => row.attack_score,
								cell: (row) => <MonoText>{formatPoints(row.attack_score)}</MonoText>,
							},
							{
								id: "defense",
								header: t("awd.board.columns.defense"),
								align: "right",
								hideBelow: "sm",
								sortValue: (row) => row.defense_score,
								cell: (row) => <MonoText>{formatPoints(row.defense_score)}</MonoText>,
							},
							{
								id: "total",
								header: t("awd.board.columns.total"),
								align: "right",
								sortValue: (row) => row.total_score,
								cell: (row) => (
									<MonoText className="font-semibold">
										{formatPoints(row.total_score)}
									</MonoText>
								),
							},
						]}
						mobileCard={(row) => (
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0 space-y-1">
									<p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
										<span className="tnum shrink-0">#{row.rank}</span>
										<MonoText
											className="min-w-0 truncate text-sm"
											title={row.team_name}
										>
											{row.team_name}
										</MonoText>
										{row.team_id === myTeamId ? (
											<span className="shrink-0 text-xs text-muted-foreground">
												{t("awd.board.you")}
											</span>
										) : null}
									</p>
									<p className="tnum text-xs text-muted-foreground">
										{t("awd.board.mobileSummary", {
											attack: formatPoints(row.attack_score),
											defense: formatPoints(row.defense_score),
										})}
									</p>
								</div>
								<MonoText className="shrink-0 font-semibold">
									{formatPoints(row.total_score)}
								</MonoText>
							</div>
						)}
					/>
				)}
			</QueryState>
		</SectionCard>
	);
}

/**
 * WireGuard 配置下发。
 * 私钥（`PrivateKey` 行）用 `<SecretValue>` 展示（默认模糊）；复制/下载给出完整 .conf，
 * 因为客户端需要它才能建立隧道。
 */
function AwdWireGuardPanel({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const { copied, copy } = useCopyToClipboard();
	const query = useQuery({
		queryKey: qk.awd.wireguard(eventId),
		queryFn: () =>
			callMaybe<WireGuardConfigResponse>(
				client.awd.player.wireguardConfig(eventId),
				t("awd.actionNames.wireguard"),
			),
		// 未加入队伍 / 未部署 / 私钥只下发一次 → 400/403/404 是正常业务态，不重试。
		retry: false,
	});

	if (query.isPending) return <TableSkeleton rows={3} columns={2} />;

	if (query.isError) {
		// 「尚未分配网络 / 尚未部署 / 私钥已下发」是业务态，不是加载失败。
		const hint = awdCredentialsUnavailable(query.error);
		if (hint) {
			return <AwdUnavailable hint={hint} onRetry={() => void query.refetch()} />;
		}
		return (
			<ErrorBlock
				error={query.error}
				title={t("awd.wireguard.loadError")}
				onRetry={() => void query.refetch()}
			/>
		);
	}

	const config = query.data?.config ?? "";
	if (!config.trim()) {
		return (
			<EmptyBlock
				title={t("awd.wireguard.empty.title")}
				description={t("awd.wireguard.empty.description")}
				action={
					<Button variant="outline" size="sm" onClick={() => void query.refetch()}>
						<RefreshCw className="size-4" aria-hidden="true" />
						{t("awd.arena.retryCheck")}
					</Button>
				}
			/>
		);
	}
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => void copy(config)}
					aria-label={t("awd.wireguard.copyAria")}
					title={t("awd.wireguard.copyAria")}
				>
					{copied ? t("common.copied") : t("awd.wireguard.copy")}
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => downloadTextFile(`floatctf-awd-${eventId}.conf`, config)}
				>
					<Download className="size-4" aria-hidden="true" />
					{t("awd.wireguard.download")}
				</Button>
			</div>
			<p className="text-xs text-muted-foreground">{t("awd.wireguard.note")}</p>
			<ReadonlyBlock className="max-h-72 overflow-auto font-mono text-xs">
				{config.split("\n").map((line, index) => {
					const match = /^(\s*PrivateKey\s*=\s*)(.*)$/i.exec(line);
					if (match) {
						return (
							<div key={index} className="flex items-center gap-1">
								<span>{match[1]}</span>
								<SecretValue
									value={match[2].trim()}
									label={t("awd.wireguard.privateKey")}
								/>
							</div>
						);
					}
					return <div key={index}>{line.length > 0 ? line : "\u00a0"}</div>;
				})}
			</ReadonlyBlock>
		</div>
	);
}

/** 队伍 SSH 凭据：一个队伍共享密码，用户名/IP 每个实例不同。 */
function AwdSshPanel({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	const client = useClient();
	const query = useQuery({
		queryKey: qk.awd.ssh(eventId),
		queryFn: () =>
			call<SshAccessResponse>(
				client.awd.player.sshConfig(eventId),
				t("awd.actionNames.ssh"),
			),
		retry: false,
	});
	// 在类型收窄前取出 refetch，避免「已判定成功」的分支里 `query` 被收窄成 never。
	const reload = () => void query.refetch();

	if (query.isPending) return <TableSkeleton rows={3} columns={3} />;

	if (query.isError) {
		const hint = awdCredentialsUnavailable(query.error);
		if (hint) {
			return <AwdUnavailable hint={hint} onRetry={reload} />;
		}
		return (
			<ErrorBlock
				error={query.error}
				title={t("awd.ssh.loadError")}
				onRetry={reload}
			/>
		);
	}

	const ssh = query.data;
	if (!ssh) {
		return (
			<EmptyBlock
				title={t("awd.ssh.empty.title")}
				description={t("awd.ssh.empty.description")}
				action={
					<Button variant="outline" size="sm" onClick={reload}>
						<RefreshCw className="size-4" aria-hidden="true" />
						{t("awd.arena.retryCheck")}
					</Button>
				}
			/>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-4">
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">{t("awd.ssh.port")}</span>
					<CopyText value={String(ssh.port)} label={t("awd.ssh.portLabel")} />
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">{t("awd.ssh.password")}</span>
					<SecretValue value={ssh.password} label={t("awd.ssh.passwordLabel")} />
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() =>
						downloadTextFile(
							`floatctf-awd-${eventId}-ssh.txt`,
							[
								t("awd.ssh.file.title", { eventId }),
								t("awd.ssh.file.port", { port: ssh.port }),
								t("awd.ssh.file.password", { password: ssh.password }),
								"",
								...ssh.instances.map(
									(item) =>
										`ssh -p ${ssh.port} ${item.username}@${item.gamebox_ip}  # ${item.container_name}`,
								),
							].join("\n"),
						)
					}
				>
					<Download className="size-4" aria-hidden="true" />
					{t("awd.ssh.download")}
				</Button>
			</div>
			{ssh.instances.length === 0 ? (
				<EmptyBlock
					title={t("awd.ssh.noInstances.title")}
					description={t("awd.ssh.noInstances.description")}
				/>
			) : (
				<DataTable
					data={ssh.instances}
					getRowId={(row) => row.id}
					columns={[
						{
							id: "ip",
							header: t("awd.ssh.columns.ip"),
							sortValue: (row) => row.gamebox_ip,
							cell: (row) => <MonoText>{row.gamebox_ip}</MonoText>,
						},
						{
							id: "username",
							header: t("awd.ssh.columns.username"),
							sortValue: (row) => row.username,
							cell: (row) => <MonoText>{row.username}</MonoText>,
						},
						{
							id: "health",
							header: t("awd.ssh.columns.health"),
							hideBelow: "sm",
							sortValue: (row) => row.health_status,
							cell: (row) => (
								<span className="text-sm text-muted-foreground">
									{row.health_status || "—"}
								</span>
							),
						},
						{
							id: "command",
							header: t("awd.ssh.columns.command"),
							cell: (row) => (
								<CopyText
									value={`ssh -p ${ssh.port} ${row.username}@${row.gamebox_ip}`}
									label={t("awd.ssh.commandLabel")}
								/>
							),
						},
					]}
					mobileCard={(row) => (
						<div className="space-y-1.5">
							<MonoText>{row.gamebox_ip}</MonoText>
							<MonoText className="text-muted-foreground">{row.username}</MonoText>
							<CopyText
								value={`ssh -p ${ssh.port} ${row.username}@${row.gamebox_ip}`}
								label={t("awd.ssh.commandLabel")}
							/>
						</div>
					)}
				/>
			)}
		</div>
	);
}

/** 网络凭据（WireGuard / SSH）—— 两个独立 Tab，各自三态齐全。 */
export function AwdNetworkPanel({ eventId }: { eventId: string }): ReactNode {
	const { t } = useTranslation();
	return (
		<SectionCard
			title={t("awd.network.title")}
			description={t("awd.network.description")}
		>
			<Tabs defaultValue="wireguard">
				<TabsList>
					<TabsTrigger value="wireguard">
						<ShieldAlert className="size-4" aria-hidden="true" />{" "}
						{t("awd.network.tabs.wireguard")}
					</TabsTrigger>
					<TabsTrigger value="ssh">
						<TerminalSquare className="size-4" aria-hidden="true" />{" "}
						{t("awd.network.tabs.ssh")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="wireguard" className="pt-2">
					<AwdWireGuardPanel eventId={eventId} />
				</TabsContent>
				<TabsContent value="ssh" className="pt-2">
					<AwdSshPanel eventId={eventId} />
				</TabsContent>
			</Tabs>
		</SectionCard>
	);
}
