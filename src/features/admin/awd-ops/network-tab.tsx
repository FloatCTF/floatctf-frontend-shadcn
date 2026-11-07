/**
 * 「网络」标签：赛事网络（Event Network）的查看 / 分配 / 重新分配。
 *
 * 已核实的后端语义：
 * - `GET .../awd/network` 在**未分配**时返回 404 → 本页把 404 当「未分配」，不是加载失败；
 * - `PUT .../awd/network`：已分配且未锁定 → 幂等 no-op；已锁定 → 拒绝。
 *   携带 gamebox_cidr / wireguard_cidr 任一即按 manual 分配（两个都需要），否则 automatic；
 * - `POST .../awd/network/reallocate`：仅未锁定且状态处于 Draft / Configuring 时可用
 *   （`assert_network_editable`），同事务里释放旧网段并写入新网段 + 新 WireGuard 端口。
 *
 * 文案全部走 `adminAwdOps.*`；网段 / 容器名等标识保持原文并用等宽字体。
 */

import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Network, RefreshCw, Wand2 } from "lucide-react";

import type { EventNetworkInfo, NetworkAllocationRequest } from "@floatctf/sdk";
import { AwdEventStatus, AwdNetworkAllocationMode } from "@floatctf/sdk/entity";

import { callVoid } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import { CopyText, KeyValueList, MonoText, SectionCard } from "~/components/app/page";
import { EmptyBlock, InlineError, QueryState } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { useAwdEventNetwork, useAwdStatus } from "./queries";
import { awdStatusLabel } from "./shared";

const CIDR_PATTERN = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;

/** reallocate 的后端前提：未锁定且状态为 Draft / Configuring。 */
const NETWORK_EDITABLE_STATUSES: string[] = [AwdEventStatus.Draft, AwdEventStatus.Configuring];

function ManualAllocationSheet({ eventId, onClose }: { eventId: string; onClose: () => void }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const [gameboxCidr, setGameboxCidr] = useState("");
	const [wireguardCidr, setWireguardCidr] = useState("");
	const [listenPort, setListenPort] = useState("");
	const [errors, setErrors] = useState<Record<string, string | undefined>>({});

	const mutation = useMutation({
		mutationFn: (body: NetworkAllocationRequest) =>
			callVoid(
				client.awd.admin.allocateEventNetwork(eventId, body),
				t("adminAwdOps.actionNames.allocateNetwork"),
			),
		onSuccess: () => {
			toast.success(
				t("adminAwdOps.network.toast.manualSuccessTitle"),
				t("adminAwdOps.network.toast.manualSuccessDescription"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awd.eventNetwork(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
			onClose();
		},
		onError: (error) => toast.apiError(t("adminAwdOps.network.toast.manualFailed"), error),
	});

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const nextErrors: Record<string, string | undefined> = {};
		if (!CIDR_PATTERN.test(gameboxCidr.trim())) {
			nextErrors.gamebox_cidr = t("adminAwdOps.validation.cidr", { example: "10.20.0.0/16" });
		}
		if (!CIDR_PATTERN.test(wireguardCidr.trim())) {
			nextErrors.wireguard_cidr = t("adminAwdOps.validation.cidr", { example: "10.30.0.0/16" });
		}
		if (listenPort.trim() !== "" && !/^\d+$/.test(listenPort.trim())) {
			nextErrors.listen_port = t("adminAwdOps.validation.portInteger");
		}
		setErrors(nextErrors);
		if (Object.values(nextErrors).some((value) => value !== undefined)) return;
		mutation.mutate({
			allocation_mode: AwdNetworkAllocationMode.Manual,
			gamebox_cidr: gameboxCidr.trim(),
			wireguard_cidr: wireguardCidr.trim(),
			...(listenPort.trim() === "" ? {} : { wireguard_listen_port: Number(listenPort) }),
		});
	};

	return (
		<FormSheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("adminAwdOps.network.manual.title")}
			description={t("adminAwdOps.network.manual.description")}
			width="lg"
			footer={
				<FormFooter
					onCancel={onClose}
					formId="awd-manual-network-form"
					submitLabel={t("adminAwdOps.network.manual.submit")}
					isPending={mutation.isPending}
				/>
			}
		>
			<form id="awd-manual-network-form" onSubmit={submit} className="space-y-4">
				<FormGrid columns={2}>
					<Field
						label={t("adminAwdOps.network.manual.gameboxLabel")}
						htmlFor="awd-network-gamebox-cidr"
						required
						error={errors.gamebox_cidr}
						hint={t("adminAwdOps.network.manual.gameboxHint")}
					>
						<Input
							id="awd-network-gamebox-cidr"
							value={gameboxCidr}
							onChange={(event) => setGameboxCidr(event.target.value)}
							placeholder={t("adminAwdOps.network.manual.gameboxPlaceholder")}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.network.manual.wireguardLabel")}
						htmlFor="awd-network-wireguard-cidr"
						required
						error={errors.wireguard_cidr}
						hint={t("adminAwdOps.network.manual.wireguardHint")}
					>
						<Input
							id="awd-network-wireguard-cidr"
							value={wireguardCidr}
							onChange={(event) => setWireguardCidr(event.target.value)}
							placeholder={t("adminAwdOps.network.manual.wireguardPlaceholder")}
						/>
					</Field>
					<Field
						label={t("adminAwdOps.network.manual.portLabel")}
						htmlFor="awd-network-listen-port"
						hint={t("adminAwdOps.network.manual.portHint")}
						error={errors.listen_port}
					>
						<Input
							id="awd-network-listen-port"
							type="number"
							inputMode="numeric"
							value={listenPort}
							onChange={(event) => setListenPort(event.target.value)}
							placeholder={t("adminAwdOps.network.manual.autoPlaceholder")}
						/>
					</Field>
				</FormGrid>
			</form>
		</FormSheet>
	);
}

function NetworkDetail({ eventId, network }: { eventId: string; network: EventNetworkInfo }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const statusQuery = useAwdStatus(eventId);
	const status = statusQuery.data?.status ?? null;

	const reallocate = useMutation({
		mutationFn: () =>
			callVoid(
				client.awd.admin.reallocateEventNetwork(eventId),
				t("adminAwdOps.actionNames.reallocateNetwork"),
			),
		onSuccess: () => {
			toast.success(
				t("adminAwdOps.network.toast.reallocateSuccessTitle"),
				t("adminAwdOps.network.toast.reallocateSuccessDescription"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awd.eventNetwork(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
		},
		onError: (error) => toast.apiError(t("adminAwdOps.network.toast.reallocateFailed"), error),
	});

	const editableStatus = status !== null && NETWORK_EDITABLE_STATUSES.includes(status);
	const canReallocate = !network.locked && editableStatus;

	const statusPending = statusQuery.isPending;
	const statusError = statusQuery.isError;
	const blockedReason = statusError
		? t("adminAwdOps.lifecycle.statusLoadFailed")
		: statusPending
			? t("adminAwdOps.lifecycle.loadingStatus")
			: network.locked
			? t("adminAwdOps.network.blockedLocked")
			: !editableStatus
				? t("adminAwdOps.network.blockedStatus", {
						status: awdStatusLabel(status, t),
					})
				: t("adminAwdOps.network.reallocatable");

	return (
		<SectionCard
			title={t("adminAwdOps.network.title")}
			description={t("adminAwdOps.network.description")}
			actions={
				<Button
					variant="destructive"
					size="sm"
					disabled={statusPending || statusError || !canReallocate || reallocate.isPending}
					title={blockedReason}
					onClick={async () => {
						const ok = await confirm({
							title: t("adminAwdOps.network.confirmReallocate.title"),
							description: t("adminAwdOps.network.confirmReallocate.description"),
							consequences: [
								t("adminAwdOps.network.confirmReallocate.consequence1"),
								t("adminAwdOps.network.confirmReallocate.consequence2"),
								t("adminAwdOps.network.confirmReallocate.consequence3"),
								t("adminAwdOps.network.confirmReallocate.consequence4"),
							],
							tone: "danger",
							confirmText: t("adminAwdOps.network.confirmReallocate.confirm"),
							confirmPhrase: "reallocate",
						});
						if (ok) reallocate.mutate();
					}}
				>
					<RefreshCw data-icon="inline-start" />
					{t("adminAwdOps.network.reallocate")}
				</Button>
			}
		>
			<div className="space-y-4">
				{statusError ? <InlineError error={statusQuery.error} /> : null}
				<div className="flex flex-wrap items-center gap-2">
					<TonePill tone={network.locked ? "warning" : "info"}>
						{network.locked
							? t("adminAwdOps.network.lockedPill")
							: t("adminAwdOps.network.editablePill")}
					</TonePill>
					<TonePill tone="neutral">
						{t("adminAwdOps.network.modePill", {
							mode:
								network.allocation_mode === AwdNetworkAllocationMode.Manual
									? t("adminAwdOps.network.modeManual")
									: t("adminAwdOps.network.modeAutomatic"),
						})}
					</TonePill>
					{!canReallocate ? (
						<span className="text-xs text-muted-foreground">{blockedReason}</span>
					) : null}
				</div>
				<KeyValueList
					columns={2}
					items={[
						{
							key: t("adminAwdOps.network.fields.gameboxCidr"),
							value: <MonoText>{network.gamebox_cidr}</MonoText>,
						},
						{
							key: t("adminAwdOps.network.fields.wireguardCidr"),
							value: <MonoText>{network.wireguard_cidr}</MonoText>,
						},
						{
							key: t("adminAwdOps.network.fields.infrastructureSubnet"),
							value: <MonoText>{network.infrastructure_subnet}</MonoText>,
						},
						{
							key: t("adminAwdOps.network.fields.flagserverIp"),
							value: <MonoText>{network.flagserver_ip}</MonoText>,
						},
						{
							key: t("adminAwdOps.network.fields.judgeserverIp"),
							value: <MonoText>{network.judgeserver_ip}</MonoText>,
						},
						{
							key: t("adminAwdOps.network.fields.dockerNetwork"),
							value: <CopyText value={network.docker_network_name} />,
						},
						{
							key: t("adminAwdOps.network.fields.wireguardInterface"),
							value: <MonoText>{network.wireguard_interface_name}</MonoText>,
						},
						{
							key: t("adminAwdOps.network.fields.wireguardPort"),
							value: <MonoText>{network.wireguard_listen_port}</MonoText>,
						},
					]}
				/>
			</div>
		</SectionCard>
	);
}

export function AwdNetworkTab({ eventId }: { eventId: string }) {
	const { t } = useTranslation();
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const networkQuery = useAwdEventNetwork(eventId);
	const [manualOpen, setManualOpen] = useState(false);

	const automatic = useMutation({
		mutationFn: () =>
			callVoid(
				client.awd.admin.allocateEventNetwork(eventId, { allocation_mode: "automatic" }),
				t("adminAwdOps.actionNames.autoAllocateNetwork"),
			),
		onSuccess: () => {
			toast.success(
				t("adminAwdOps.network.toast.autoSuccessTitle"),
				t("adminAwdOps.network.toast.autoSuccessDescription"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awd.eventNetwork(eventId) });
			void queryClient.invalidateQueries({ queryKey: qk.awd.adminStatus(eventId) });
		},
		onError: (error) => toast.apiError(t("adminAwdOps.network.toast.autoFailed"), error),
	});

	return (
		<>
			<QueryState
				query={networkQuery}
				isEmpty={() => networkQuery.data === null}
				empty={
					<EmptyBlock
						title={t("adminAwdOps.network.emptyTitle")}
						description={t("adminAwdOps.network.emptyDescription")}
						icon={<Network className="size-6" />}
						action={
							<div className="flex flex-wrap items-center justify-center gap-2">
								<Button
									size="sm"
									disabled={automatic.isPending}
									onClick={async () => {
										const ok = await confirm({
											title: t("adminAwdOps.network.confirmAuto.title"),
											description: t("adminAwdOps.network.confirmAuto.description"),
											consequences: [
												t("adminAwdOps.network.confirmAuto.consequence1"),
												t("adminAwdOps.network.confirmAuto.consequence2"),
												t("adminAwdOps.network.confirmAuto.consequence3"),
											],
											confirmText: t("adminAwdOps.network.confirmAuto.confirm"),
										});
										if (ok) automatic.mutate();
									}}
								>
									<Wand2 data-icon="inline-start" />
									{t("adminAwdOps.network.autoAllocate")}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setManualOpen(true)}
								>
									{t("adminAwdOps.network.manualAllocate")}
								</Button>
							</div>
						}
					/>
				}
			>
				{(network) =>
					network ? <NetworkDetail eventId={eventId} network={network} /> : null
				}
			</QueryState>

			{/* 表单挂在 QueryState 之外：未分配时 QueryState 渲染的是空态而不是 children。 */}
			{manualOpen ? (
				<ManualAllocationSheet eventId={eventId} onClose={() => setManualOpen(false)} />
			) : null}
		</>
	);
}
