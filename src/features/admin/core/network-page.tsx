/**
 * 靶场网络（`/admin/network`，specialized）—— 平台网络设置 / 宿主健康 / 分配容量 / 分配账本。
 *
 * 真实接口（全部只读，除设置外）：
 * - `getPlatformNetwork()`            → `PlatformNetworkSettings`（含服务端计算的容量预览）；
 * - `updatePlatformNetwork(body)`     → 部分更新，返回 `note`（原样展示给管理员）；
 * - `getPlatformNetworkHealth()`      → `PlatformNetworkHealth`（宿主观测状态，只读）；
 * - `getPlatformNetworkAllocations()` → `PlatformNetworkAllocation[]`（分配账本，只读）。
 *
 * `null` / 空值一律显示为空态，不编造默认值；能力（capacity）由后端按**已保存**配置计算，
 * 因此编辑抽屉里不会实时重算容量 —— 保存后刷新即可看到新值。
 *
 * 所有用户可见文案走 `adminCore.network.*` / `adminCore.validation.*`。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Network, Pencil, RefreshCw, ShieldAlert } from "lucide-react";

import { call, callList } from "~/api/call";
import { useAppQueryClient, useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { TonePill, type PillTone } from "~/components/app/badges";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import { Field, FormFooter, FormGrid, FormSheet } from "~/components/app/form";
import {
	KeyValueList,
	MonoText,
	PageBody,
	PageHeader,
	SectionCard,
	StatCard,
	Toolbar,
} from "~/components/app/page";
import { EmptyBlock, LoadingBlock, QueryState } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { formatDateTime, formatInt } from "~/lib/format";
import { useDocumentTitle } from "~/lib/hooks";
import type {
	PlatformNetworkAllocation,
	PlatformNetworkHealth,
	PlatformNetworkSettings,
	PlatformNetworkSettingsUpdateResponse,
} from "@floatctf/sdk";

import {
	AWD_MAX_EVENT_PREFIX,
	EMPTY_PLATFORM_NETWORK_FORM,
	type PlatformNetworkErrors,
	type PlatformNetworkForm,
	formFromSettings,
	validatePlatformNetworkForm,
} from "./network-validation";

function allocationKindKey(kind: string): string | undefined {
	if (kind === "gamebox") return "adminCore.network.allocations.kind.gamebox";
	if (kind === "wireguard") return "adminCore.network.allocations.kind.wireguard";
	return undefined;
}

export function AdminNetworkPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminCore.network.documentTitle"));
	const client = useClient();
	const queryClient = useAppQueryClient();

	const settings = useQuery({
		queryKey: qk.awd.platformNetwork(),
		queryFn: () =>
			call<PlatformNetworkSettings>(
				client.awd.admin.getPlatformNetwork(),
				t("adminCore.network.actions.loadSettings"),
			),
	});

	const health = useQuery({
		queryKey: qk.awd.platformHealth(),
		queryFn: () =>
			call<PlatformNetworkHealth>(
				client.awd.admin.getPlatformNetworkHealth(),
				t("adminCore.network.actions.loadHealth"),
			),
	});

	const allocations = useQuery({
		queryKey: qk.awd.platformAllocations(),
		queryFn: () =>
			callList<PlatformNetworkAllocation>(client.awd.admin.getPlatformNetworkAllocations()),
	});

	const [sheetOpen, setSheetOpen] = useState(false);
	const [form, setForm] = useState<PlatformNetworkForm>(EMPTY_PLATFORM_NETWORK_FORM);
	const [errors, setErrors] = useState<PlatformNetworkErrors>({});

	const save = useMutation({
		mutationFn: (body: PlatformNetworkForm) =>
			call<PlatformNetworkSettingsUpdateResponse>(
				client.awd.admin.updatePlatformNetwork({
					gamebox_pool: body.gamebox_pool.trim(),
					gamebox_event_prefix: Number(body.gamebox_event_prefix),
					gamebox_team_prefix: Number(body.gamebox_team_prefix),
					wireguard_pool: body.wireguard_pool.trim(),
					wireguard_event_prefix: Number(body.wireguard_event_prefix),
					wireguard_team_prefix: Number(body.wireguard_team_prefix),
					wireguard_port_min: Number(body.wireguard_port_min),
					wireguard_port_max: Number(body.wireguard_port_max),
					// 空串 = 清空（后端 double_option：显式 null 才清空）。
					wireguard_public_endpoint: body.wireguard_public_endpoint.trim() || null,
				}),
				t("adminCore.actions.savePlatformNetwork"),
			),
		onSuccess: (data) => {
			// 后端返回的 note 是权威语义说明（现有分配不受影响，仅后续分配生效），原样展示。
			toast.success(
				t("adminCore.network.toasts.saved"),
				data.note ?? t("adminCore.network.toasts.savedDefault"),
			);
			void queryClient.invalidateQueries({ queryKey: qk.awd.platformNetwork() });
			setSheetOpen(false);
			setErrors({});
		},
		onError: (error) => toast.apiError(t("adminCore.network.toasts.saveFailed"), error),
	});

	function openSettings(): void {
		const data = settings.data;
		if (!data) {
			toast.warning(t("adminCore.network.toasts.notLoaded"));
			return;
		}
		setForm(formFromSettings(data));
		setErrors({});
		setSheetOpen(true);
	}

	function submit(): void {
		const nextErrors = validatePlatformNetworkForm(form, t);
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			toast.warning(t("adminCore.form.fixErrors"));
			return;
		}
		save.mutate(form);
	}

	function refreshAll(): void {
		void settings.refetch();
		void health.refetch();
		void allocations.refetch();
	}

	const refreshing = settings.isFetching || health.isFetching || allocations.isFetching;

	return (
		<PageBody>
			<PageHeader
				title={t("adminCore.network.title")}
				description={t("adminCore.network.description")}
				actions={
					<Toolbar>
						<Button variant="outline" onClick={refreshAll} disabled={refreshing}>
							<RefreshCw
								className={refreshing ? "animate-spin" : undefined}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</Button>
						<Button
							onClick={openSettings}
							disabled={!settings.data}
							title={
								settings.data ? undefined : t("adminCore.network.toasts.notLoaded")
							}
						>
							<Pencil aria-hidden="true" /> {t("adminCore.network.editSettings")}
						</Button>
					</Toolbar>
				}
			/>

			<SectionCard
				title={t("adminCore.network.settings.title")}
				description={t("adminCore.network.settings.description")}
			>
				<QueryState
					query={settings}
					skeleton={<LoadingBlock label={t("adminCore.network.settings.loading")} />}
					errorTitle={t("adminCore.network.settings.error")}
				>
					{(data) => (
						<div className="space-y-5">
							<KeyValueList
								columns={3}
								items={[
									{
										key: t("adminCore.network.settings.gameboxPool"),
										value: <MonoText className="text-sm">{data.gamebox_pool}</MonoText>,
										hint: t("adminCore.network.settings.gameboxPoolHint", {
											eventPrefix: data.gamebox_event_prefix,
											teamPrefix: data.gamebox_team_prefix,
										}),
									},
									{
										key: t("adminCore.network.settings.wireguardPool"),
										value: <MonoText className="text-sm">{data.wireguard_pool}</MonoText>,
										hint: t("adminCore.network.settings.wireguardPoolHint", {
											eventPrefix: data.wireguard_event_prefix,
											teamPrefix: data.wireguard_team_prefix,
										}),
									},
									{
										key: t("adminCore.network.settings.portRange"),
										value: (
											<MonoText className="text-sm">
												{data.wireguard_port_min}–{data.wireguard_port_max}
											</MonoText>
										),
									},
									{
										key: t("adminCore.network.settings.endpoint"),
										value: data.wireguard_public_endpoint ? (
											<MonoText className="text-sm">
												{data.wireguard_public_endpoint}
											</MonoText>
										) : (
											<span className="text-xs text-muted-foreground">
												{t("adminCore.network.settings.endpointMissing")}
											</span>
										),
										hint: t("adminCore.network.settings.endpointHint"),
									},
									{
										key: t("adminCore.network.settings.updatedAt"),
										value: (
											<MonoText className="text-sm">
												{formatDateTime(data.updated_at, { seconds: true })}
											</MonoText>
										),
									},
								]}
							/>

							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<StatCard
									label={t("adminCore.network.capacity.gameboxEvents")}
									value={formatInt(data.gamebox_event_capacity)}
									hint={t("adminCore.network.capacity.gameboxEventsHint")}
									icon={<Network className="size-4" aria-hidden="true" />}
								/>
								<StatCard
									label={t("adminCore.network.capacity.teamsPerEvent")}
									value={formatInt(data.gamebox_team_capacity_per_event)}
									hint={t("adminCore.network.capacity.gameboxTeamsHint")}
								/>
								<StatCard
									label={t("adminCore.network.capacity.hostsPerTeam")}
									value={formatInt(data.gamebox_hosts_per_team)}
									hint={t("adminCore.network.capacity.hostsPerTeamHint")}
								/>
								<StatCard
									label={t("adminCore.network.capacity.wireguardEvents")}
									value={formatInt(data.wireguard_event_capacity)}
									hint={t("adminCore.network.capacity.wireguardEventsHint")}
								/>
								<StatCard
									label={t("adminCore.network.capacity.teamsPerEvent")}
									value={formatInt(data.wireguard_team_capacity_per_event)}
									hint={t("adminCore.network.capacity.wireguardTeamsHint")}
								/>
								<StatCard
									label={t("adminCore.network.capacity.ports")}
									value={formatInt(data.wireguard_port_capacity)}
									hint={t("adminCore.network.capacity.portsHint")}
								/>
							</div>
						</div>
					)}
				</QueryState>
			</SectionCard>

			<SectionCard
				title={t("adminCore.network.health.title")}
				description={t("adminCore.network.health.description")}
				actions={
					<TonePill
						tone={
							health.data === undefined
								? "muted"
								: health.data.capability_supported
									? "success"
									: "danger"
						}
					>
						{health.data === undefined
							? t("adminCore.network.health.undetected")
							: health.data.capability_supported
								? t("adminCore.network.health.supported")
								: t("adminCore.network.health.unsupported")}
					</TonePill>
				}
			>
				<QueryState
					query={health}
					skeleton={<LoadingBlock label={t("adminCore.network.health.loading")} />}
					errorTitle={t("adminCore.network.health.error")}
				>
					{(data) => (
						<div className="space-y-4">
							<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{buildHealthEntries(data, t).map((entry) => (
									<div key={entry.keyName} className="space-y-1.5 rounded-lg border p-3">
										<div className="flex items-center justify-between gap-2">
											<span className="text-sm font-medium">{entry.label}</span>
											<TonePill tone={entry.tone}>{entry.status}</TonePill>
										</div>
										<MonoText className="text-muted-foreground">{entry.keyName}</MonoText>
										{entry.raw && entry.raw !== entry.status ? (
											<MonoText className="text-muted-foreground">{entry.raw}</MonoText>
										) : null}
										<p className="text-xs text-muted-foreground">{entry.hint}</p>
									</div>
								))}
							</div>
							{data.notes.length > 0 ? (
								<div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">
									<p className="flex items-center gap-1.5 text-sm font-medium">
										<ShieldAlert className="size-4" aria-hidden="true" />{" "}
										{t("adminCore.network.health.notesTitle")}
									</p>
									<ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
										{data.notes.map((note) => (
											<li key={note}>{note}</li>
										))}
									</ul>
								</div>
							) : null}
						</div>
					)}
				</QueryState>
			</SectionCard>

			<SectionCard
				title={t("adminCore.network.allocations.title")}
				description={t("adminCore.network.allocations.description")}
				contentClassName="p-0"
				actions={
					allocations.data ? (
						<span className="tnum text-xs text-muted-foreground">
							{t("adminCore.network.allocations.summary", {
								total: allocations.data.items.length,
								active: allocations.data.items.filter((item) => item.active).length,
							})}
						</span>
					) : null
				}
			>
				<QueryState
					query={allocations}
					skeleton={<LoadingBlock label={t("adminCore.network.allocations.loading")} />}
					errorTitle={t("adminCore.network.allocations.error")}
					isEmpty={(result) => result.items.length === 0}
					empty={
						<EmptyBlock
							title={t("adminCore.network.allocations.empty.title")}
							description={t("adminCore.network.allocations.empty.description")}
						/>
					}
				>
					{(result) => (
						<DataTable<PlatformNetworkAllocation>
							data={result.items}
							getRowId={(row) => `${row.event_id}-${row.kind}-${row.cidr}`}
							columns={allocationColumns(t)}
							mobileCard={(row) => {
								const kindKey = allocationKindKey(row.kind);
								return (
									<div className="space-y-1">
										<div className="flex items-center justify-between gap-2">
											<span className="text-sm font-medium">
												{row.event_title ?? row.event_id}
											</span>
											<TonePill tone={row.active ? "success" : "muted"}>
												{row.active
													? t("adminCore.network.allocations.active")
													: t("adminCore.network.allocations.released")}
											</TonePill>
										</div>
										<MonoText>
											{kindKey ? t(kindKey) : row.kind} · {row.cidr}
										</MonoText>
										<p className="tnum text-xs text-muted-foreground">
											{t("adminCore.network.allocations.allocatedAt", {
												time: formatDateTime(row.allocated_at),
											})}
											{row.released_at ? (
												<span>
													{" · "}
													{t("adminCore.network.allocations.releasedAt", {
														time: formatDateTime(row.released_at),
													})}
												</span>
											) : null}
										</p>
									</div>
								);
							}}
							empty={<span>{t("adminCore.network.allocations.emptyInline")}</span>}
						/>
					)}
				</QueryState>
			</SectionCard>

			<FormSheet
				open={sheetOpen}
				onOpenChange={(open) => {
					if (!open) setSheetOpen(false);
				}}
				title={t("adminCore.network.sheet.title")}
				description={t("adminCore.network.sheet.description")}
				width="xl"
				footer={
					<FormFooter
						onCancel={() => setSheetOpen(false)}
						submitLabel={t("adminCore.network.sheet.submit")}
						isPending={save.isPending}
						formId="admin-network-form"
						hint={t("adminCore.network.sheet.footerHint", { max: AWD_MAX_EVENT_PREFIX })}
					/>
				}
			>
				<form
					id="admin-network-form"
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<FormGrid columns={2}>
						<Field
							label={t("adminCore.network.sheet.gameboxPool")}
							htmlFor="network-gamebox-pool"
							required
							error={errors.gamebox_pool}
							hint={t("adminCore.network.sheet.cidrHint")}
						>
							<Input
								id="network-gamebox-pool"
								className="font-mono text-xs"
								value={form.gamebox_pool}
								onChange={(event) => setForm({ ...form, gamebox_pool: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.network.sheet.wireguardPool")}
							htmlFor="network-wireguard-pool"
							required
							error={errors.wireguard_pool}
							hint={t("adminCore.network.sheet.wireguardPoolHint")}
						>
							<Input
								id="network-wireguard-pool"
								className="font-mono text-xs"
								value={form.wireguard_pool}
								onChange={(event) => setForm({ ...form, wireguard_pool: event.target.value })}
							/>
						</Field>
						<Field
							label={t("adminCore.network.sheet.gameboxEventPrefix")}
							htmlFor="network-gamebox-event-prefix"
							required
							error={errors.gamebox_event_prefix}
							hint={t("adminCore.network.sheet.gameboxEventPrefixHint", {
								max: AWD_MAX_EVENT_PREFIX,
							})}
						>
							<Input
								id="network-gamebox-event-prefix"
								inputMode="numeric"
								value={form.gamebox_event_prefix}
								onChange={(event) =>
									setForm({ ...form, gamebox_event_prefix: event.target.value })
								}
							/>
						</Field>
						<Field
							label={t("adminCore.network.sheet.gameboxTeamPrefix")}
							htmlFor="network-gamebox-team-prefix"
							required
							error={errors.gamebox_team_prefix}
							hint={t("adminCore.network.sheet.teamPrefixHint")}
						>
							<Input
								id="network-gamebox-team-prefix"
								inputMode="numeric"
								value={form.gamebox_team_prefix}
								onChange={(event) =>
									setForm({ ...form, gamebox_team_prefix: event.target.value })
								}
							/>
						</Field>
						<Field
							label={t("adminCore.network.sheet.wireguardEventPrefix")}
							htmlFor="network-wireguard-event-prefix"
							required
							error={errors.wireguard_event_prefix}
							hint={t("adminCore.network.sheet.wireguardEventPrefixHint")}
						>
							<Input
								id="network-wireguard-event-prefix"
								inputMode="numeric"
								value={form.wireguard_event_prefix}
								onChange={(event) =>
									setForm({ ...form, wireguard_event_prefix: event.target.value })
								}
							/>
						</Field>
						<Field
							label={t("adminCore.network.sheet.wireguardTeamPrefix")}
							htmlFor="network-wireguard-team-prefix"
							required
							error={errors.wireguard_team_prefix}
							hint={t("adminCore.network.sheet.teamPrefixHint")}
						>
							<Input
								id="network-wireguard-team-prefix"
								inputMode="numeric"
								value={form.wireguard_team_prefix}
								onChange={(event) =>
									setForm({ ...form, wireguard_team_prefix: event.target.value })
								}
							/>
						</Field>
						<Field
							label={t("adminCore.network.sheet.portMin")}
							htmlFor="network-port-min"
							required
							error={errors.wireguard_port_min}
							hint={t("adminCore.network.sheet.portHint")}
						>
							<Input
								id="network-port-min"
								inputMode="numeric"
								value={form.wireguard_port_min}
								onChange={(event) =>
									setForm({ ...form, wireguard_port_min: event.target.value })
								}
							/>
						</Field>
						<Field
							label={t("adminCore.network.sheet.portMax")}
							htmlFor="network-port-max"
							required
							error={errors.wireguard_port_max}
							hint={t("adminCore.network.sheet.portMaxHint")}
						>
							<Input
								id="network-port-max"
								inputMode="numeric"
								value={form.wireguard_port_max}
								onChange={(event) =>
									setForm({ ...form, wireguard_port_max: event.target.value })
								}
							/>
						</Field>
					</FormGrid>
					<Field
						label={t("adminCore.network.sheet.endpoint")}
						htmlFor="network-endpoint"
						error={errors.wireguard_public_endpoint}
						hint={t("adminCore.network.sheet.endpointHint")}
					>
						<Input
							id="network-endpoint"
							className="font-mono text-xs"
							placeholder="vpn.example.com:51820"
							value={form.wireguard_public_endpoint}
							onChange={(event) =>
								setForm({ ...form, wireguard_public_endpoint: event.target.value })
							}
						/>
					</Field>
				</form>
			</FormSheet>
		</PageBody>
	);
}

// ── 宿主健康条目（把后端原始观测值翻译成可读状态；原始值同时展示）──────────

interface HealthEntry {
	label: string;
	keyName: string;
	tone: PillTone;
	status: string;
	raw?: string | null;
	hint: string;
}

function buildHealthEntries(health: PlatformNetworkHealth, t: TFunction): HealthEntry[] {
	const isHealthy = (raw: string): boolean => raw.toLowerCase().startsWith("healthy");
	const dockerState = health.docker.toLowerCase();
	const ipv4State = health.ipv4_forwarding;
	return [
		{
			label: t("adminCore.network.health.entries.nftables.label"),
			keyName: "nftables",
			tone: isHealthy(health.nftables) ? "success" : "danger",
			status: isHealthy(health.nftables)
				? t("adminCore.network.health.status.ok")
				: t("adminCore.network.health.status.missing"),
			raw: health.nftables,
			hint: t("adminCore.network.health.entries.nftables.hint"),
		},
		{
			label: t("adminCore.network.health.entries.wireguard.label"),
			keyName: "wireguard",
			tone: isHealthy(health.wireguard) ? "success" : "danger",
			status: isHealthy(health.wireguard)
				? t("adminCore.network.health.status.ok")
				: t("adminCore.network.health.status.missing"),
			raw: health.wireguard,
			hint: t("adminCore.network.health.entries.wireguard.hint"),
		},
		{
			label: t("adminCore.network.health.entries.docker.label"),
			keyName: "docker",
			tone:
				dockerState === "available"
					? "success"
					: dockerState === "unknown"
						? "warning"
						: "danger",
			status:
				dockerState === "available"
					? t("adminCore.network.health.status.available")
					: dockerState === "unknown"
						? t("adminCore.network.health.status.unknown")
						: t("adminCore.network.health.status.unavailable"),
			raw: health.docker,
			hint: t("adminCore.network.health.entries.docker.hint"),
		},
		{
			label: t("adminCore.network.health.entries.firewallRuntime.label"),
			keyName: "firewall_runtime",
			tone: health.firewall_runtime.includes("nftables") ? "success" : "warning",
			status: health.firewall_runtime,
			hint: t("adminCore.network.health.entries.firewallRuntime.hint"),
		},
		{
			label: t("adminCore.network.health.entries.table.label"),
			keyName: "floatctf_table",
			tone: "neutral",
			status: health.floatctf_table,
			hint: t("adminCore.network.health.entries.table.hint"),
		},
		{
			label: t("adminCore.network.health.entries.dockerBackend.label"),
			keyName: "docker_firewall_backend",
			tone: health.docker_firewall_backend ? "success" : "muted",
			status: health.docker_firewall_backend ?? t("adminCore.network.health.status.notDetected"),
			raw: health.docker_firewall_backend,
			hint: t("adminCore.network.health.entries.dockerBackend.hint"),
		},
		{
			label: t("adminCore.network.health.entries.firewalld.label"),
			keyName: "firewalld",
			tone: health.firewalld.toLowerCase() === "active" ? "warning" : "success",
			status:
				health.firewalld.toLowerCase() === "active"
					? t("adminCore.network.health.status.running")
					: t("adminCore.network.health.status.notRunning"),
			raw: health.firewalld,
			hint: t("adminCore.network.health.entries.firewalld.hint"),
		},
		{
			label: t("adminCore.network.health.entries.ipv4.label"),
			keyName: "ipv4_forwarding",
			tone:
				ipv4State === "enabled" ? "success" : ipv4State === "disabled" ? "danger" : "warning",
			status:
				ipv4State === "enabled"
					? t("adminCore.network.health.status.enabled")
					: ipv4State === "disabled"
						? t("adminCore.network.health.status.disabled")
						: t("adminCore.network.health.status.unknown"),
			raw: health.ipv4_forwarding,
			hint: t("adminCore.network.health.entries.ipv4.hint"),
		},
		{
			label: t("adminCore.network.health.entries.ipv6.label"),
			keyName: "ipv6_policy",
			tone: health.ipv6_policy === "blocked" ? "success" : "warning",
			status:
				health.ipv6_policy === "blocked"
					? t("adminCore.network.health.status.blocked")
					: health.ipv6_policy,
			raw: health.ipv6_policy,
			hint: t("adminCore.network.health.entries.ipv6.hint"),
		},
		{
			label: t("adminCore.network.health.entries.capability.label"),
			keyName: "capability_supported",
			tone: health.capability_supported ? "success" : "danger",
			status: health.capability_supported
				? t("adminCore.network.health.status.met")
				: t("adminCore.network.health.status.notMet"),
			hint: t("adminCore.network.health.entries.capability.hint"),
		},
	];
}

// ── 分配账本列 ──────────────────────────────────────────────────────────────

function allocationColumns(
	t: TFunction,
): DataTableColumn<PlatformNetworkAllocation>[] {
	return [
		{
			id: "event",
			header: t("adminCore.network.allocations.columns.event"),
			cell: (row) => (
				<div className="min-w-0">
					<p className="truncate text-sm">
						{row.event_title ?? t("adminCore.network.allocations.eventMissing")}
					</p>
					<MonoText className="text-muted-foreground">{row.event_id}</MonoText>
				</div>
			),
			sortValue: (row) => row.event_title ?? row.event_id,
		},
		{
			id: "kind",
			header: t("adminCore.network.allocations.columns.kind"),
			cell: (row) => {
				const key = allocationKindKey(row.kind);
				return <span className="text-sm">{key ? t(key) : row.kind}</span>;
			},
			sortValue: (row) => row.kind,
		},
		{
			id: "cidr",
			header: t("adminCore.network.allocations.columns.cidr"),
			cell: (row) => <MonoText className="text-sm">{row.cidr}</MonoText>,
			sortValue: (row) => row.cidr,
		},
		{
			id: "active",
			header: t("adminCore.network.allocations.columns.status"),
			cell: (row) => (
				<TonePill tone={row.active ? "success" : "muted"}>
					{row.active
						? t("adminCore.network.allocations.active")
						: t("adminCore.network.allocations.released")}
				</TonePill>
			),
			sortValue: (row) => (row.active ? 1 : 0),
		},
		{
			id: "allocated_at",
			header: t("adminCore.network.allocations.columns.allocatedAt"),
			cell: (row) => (
				<span className="tnum text-xs text-muted-foreground">
					{formatDateTime(row.allocated_at)}
				</span>
			),
			sortValue: (row) => Date.parse(row.allocated_at),
			hideBelow: "md",
		},
		{
			id: "released_at",
			header: t("adminCore.network.allocations.columns.releasedAt"),
			cell: (row) =>
				row.released_at ? (
					<span className="tnum text-xs text-muted-foreground">
						{formatDateTime(row.released_at)}
					</span>
				) : (
					<span className="text-xs text-muted-foreground">—</span>
				),
			sortValue: (row) => (row.released_at ? Date.parse(row.released_at) : 0),
			hideBelow: "lg",
		},
	];
}
