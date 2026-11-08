/**
 * 管理端 · 已安装前端选择器（`/admin/platform/frontends`，specialized 能力）。
 *
 * ## 逃生舱声明（PUBLIC SDK GAP · class B）
 *
 * 本地前端注册表**没有** SDK 抽象：它不是一个后端 API，而是宿主 `$FLOATCTF_HOME/frontends/`
 * 下由 Caddy 只读公开的同源静态文件 `/__floatctf/frontends/registry.json`
 * （见 `packages/frontend-runtime/src/version.ts::DEFAULT_REGISTRY_URL`）。
 * 因此这里用同源 `fetch(DEFAULT_REGISTRY_URL)` 取数，并用运行时提供的**权威校验器**
 * `parseRegistry` 做 schema 校验（严格白名单，fail-closed）。
 *
 * 语义边界（与平台一致）：
 * - 注册表描述「装了什么」，平台设置 `FRONTEND_ACTIVE` 描述「用哪个」；
 * - 注册表 404 / 非 JSON / schema 校验失败**必须**显示具体错误并提供重试，
 *   **绝不**当成「空注册表」（否则会出现「前端突然消失」而无法定位）；
 * - 本页只做「选择已安装的前端」，不安装 / 不构建 / 不克隆（那是宿主 CLI 的职责）。
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Info, RefreshCw, RotateCw, ShieldAlert } from "lucide-react";
import { Link } from "react-router";
import type { TFunction } from "i18next";

import {
	API_CONTRACT_VERSION,
	DEFAULT_REGISTRY_URL,
	FRONTEND_RUNTIME_VERSION,
	isMajorCompatible,
	parseRegistry,
	type FloatCTFRegistry,
	type FloatCTFRegistryFrontend,
	type FloatCTFRegistryVersion,
} from "@floatctf/frontend-runtime";
import type { SettingsDto } from "@floatctf/sdk";

import { call, callList } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { BooleanPill, TonePill } from "~/components/app/badges";
import { useConfirm } from "~/components/app/confirm";
import { DataTable, type DataTableColumn } from "~/components/app/data-table";
import {
	CopyText,
	KeyValueList,
	MonoText,
	PageBody,
	PageHeader,
	SectionCard,
	StatCard,
	Toolbar,
} from "~/components/app/page";
import {
	EmptyBlock,
	ErrorBlock,
	InlineError,
	LoadingBlock,
	RefreshingBadge,
} from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { AbsoluteTime } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "~/components/ui/sheet";
import { useDocumentTitle } from "~/lib/hooks";

import { textOf } from "./components";

const FRONTEND_ACTIVE_KEY = "FRONTEND_ACTIVE";

/** 切换生效前端是平台级高危操作：要求输入确认词。 */
const SWITCH_PHRASE = "SWITCH";

interface RegistryError {
	message: string;
	details: string[];
}

type RegistryState =
	| { status: "loading" }
	| { status: "error"; error: RegistryError }
	| { status: "ok"; registry: FloatCTFRegistry };

interface CompatInfo {
	compatible: boolean;
	reasons: string[];
}

/** 契约兼容性判定（与 `resolveFrontend` 同一套 major 规则）。 */
function checkCompatibility(version: FloatCTFRegistryVersion, t: TFunction): CompatInfo {
	const reasons: string[] = [];
	if (!isMajorCompatible(version.compatibility.frontendRuntime, FRONTEND_RUNTIME_VERSION)) {
		reasons.push(
			t("adminPlatform.frontends.compat.runtimeMismatch", {
				required: version.compatibility.frontendRuntime,
				actual: FRONTEND_RUNTIME_VERSION,
			}),
		);
	}
	if (!isMajorCompatible(version.compatibility.apiContract, API_CONTRACT_VERSION)) {
		reasons.push(
			t("adminPlatform.frontends.compat.apiMismatch", {
				required: version.compatibility.apiContract,
				actual: API_CONTRACT_VERSION,
			}),
		);
	}
	return { compatible: reasons.length === 0, reasons };
}

function currentVersionOf(entry: FloatCTFRegistryFrontend): FloatCTFRegistryVersion | null {
	return entry.versions[entry.currentVersion] ?? null;
}

export function AdminFrontendsPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminPlatform.frontends.documentTitle"));
	const client = useClient();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [state, setState] = useState<RegistryState>({ status: "loading" });
	const [selected, setSelected] = useState<string | null>(null);
	const [switched, setSwitched] = useState<string | null>(null);
	const [detailId, setDetailId] = useState<string | null>(null);

	// ── 本地注册表（同源静态文件 + 运行时权威校验器）—— 逃生舱，见文件头声明 ──
	const loadRegistry = useCallback(async () => {
		setState({ status: "loading" });
		try {
			const response = await fetch(DEFAULT_REGISTRY_URL, {
				headers: { Accept: "application/json" },
				cache: "no-store",
				credentials: "same-origin",
			});
			if (!response.ok) {
				setState({
					status: "error",
					error: {
						message: t("adminPlatform.frontends.errors.http", {
							status: response.status,
							statusText: response.statusText,
						}),
						details: [
							t("adminPlatform.frontends.errors.address", {
								url: DEFAULT_REGISTRY_URL,
							}),
							response.status === 404
								? t("adminPlatform.frontends.errors.http404")
								: t("adminPlatform.frontends.errors.httpOther"),
						],
					},
				});
				return;
			}
			const text = await response.text();
			const parsed = parseRegistry(text);
			if (!parsed.ok) {
				setState({
					status: "error",
					error: {
						message: t("adminPlatform.frontends.errors.invalid"),
						details: parsed.errors,
					},
				});
				return;
			}
			setState({ status: "ok", registry: parsed.registry });
		} catch (error) {
			setState({
				status: "error",
				error: {
					message: t("adminPlatform.frontends.errors.fetch", {
						message: error instanceof Error ? error.message : String(error),
					}),
					details: [
						t("adminPlatform.frontends.errors.address", {
							url: DEFAULT_REGISTRY_URL,
						}),
						t("adminPlatform.frontends.errors.sameOrigin"),
					],
				},
			});
		}
	}, [t]);

	useEffect(() => {
		void loadRegistry();
	}, [loadRegistry]);

	// ── 当前生效前端（平台设置 FRONTEND_ACTIVE，可编辑不可删除）──
	const activeQuery = useQuery({
		queryKey: qk.admin.settings({}),
		queryFn: () => callList<SettingsDto>(client.admin.settings.fetch()),
	});

	const activeRow = useMemo(
		() => (activeQuery.data?.items ?? []).find((row) => row.key === FRONTEND_ACTIVE_KEY) ?? null,
		[activeQuery.data],
	);
	const currentValue = activeRow?.value ?? "";

	useEffect(() => {
		if (activeRow && selected === null) setSelected(activeRow.value);
	}, [activeRow, selected]);

	const patchMutation = useMutation({
		mutationFn: (value: string) => {
			if (!activeRow) throw new Error(t("adminPlatform.frontends.errors.noActive"));
			return call(
				client.admin.settings.patch({ id: activeRow.id, value }),
				t("adminPlatform.frontends.switch.title"),
			);
		},
		onSuccess: (_data, value) => {
			toast.success(
				t("adminPlatform.frontends.switch.toastSwitched", { id: value }),
				t("adminPlatform.frontends.switch.toastSwitchedDescription"),
			);
			setSwitched(value);
			void queryClient.invalidateQueries({ queryKey: qk.admin.settings() });
		},
		onError: (error) =>
			toast.apiError(t("adminPlatform.frontends.switch.toastSwitchFailed"), error),
	});

	const registry = state.status === "ok" ? state.registry : null;

	const rows = useMemo(() => {
		if (!registry) return [] as FloatCTFRegistryFrontend[];
		return Object.values(registry.frontends).sort((a, b) => a.id.localeCompare(b.id));
	}, [registry]);

	const options = useMemo(() => {
		return rows.map((entry) => {
			const version = currentVersionOf(entry);
			const compat: CompatInfo = version
				? checkCompatibility(version, t)
				: {
						compatible: false,
						reasons: [
							t("adminPlatform.frontends.compat.versionMissingInVersions", {
								version: entry.currentVersion,
							}),
						],
					};
			return { entry, version, compat };
		});
	}, [rows, t]);

	const selectedOption = options.find((option) => option.entry.id === selected) ?? null;
	const dirty = selected !== null && selected !== currentValue;
	const detailEntry = rows.find((entry) => entry.id === detailId) ?? null;

	async function submitSwitch() {
		if (!selected || !selectedOption) return;
		if (!selectedOption.compat.compatible) {
			toast.warning(
				t("adminPlatform.frontends.switch.toastIncompatible"),
				selectedOption.compat.reasons.join(t("adminPlatform.common.reasonSeparator")),
			);
			return;
		}
		const ok = await confirm({
			title: t("adminPlatform.frontends.switch.confirmTitle", { id: selected }),
			description: t("adminPlatform.frontends.switch.confirmDescription"),
			consequences: [
				t("adminPlatform.frontends.switch.consequence1", { id: selected }),
				t("adminPlatform.frontends.switch.consequence2"),
				t("adminPlatform.frontends.switch.consequence3"),
			],
			tone: "danger",
			confirmText: t("adminPlatform.frontends.switch.confirmText"),
			confirmPhrase: SWITCH_PHRASE,
		});
		if (!ok) return;
		patchMutation.mutate(selected);
	}

	const columns: DataTableColumn<FloatCTFRegistryFrontend>[] = [
		{
			id: "id",
			header: t("adminPlatform.frontends.columns.id"),
			sortValue: (row) => row.id,
			cell: (row) => (
				<span className="inline-flex items-center gap-1.5">
					<MonoText className="font-medium">{row.id}</MonoText>
					{row.protected ? (
						<TonePill tone="info">{t("adminPlatform.frontends.pills.builtin")}</TonePill>
					) : null}
					{row.id === currentValue ? (
						<TonePill tone="success">{t("adminPlatform.frontends.pills.active")}</TonePill>
					) : null}
				</span>
			),
		},
		{
			id: "name",
			header: t("adminPlatform.frontends.columns.name"),
			cell: (row) => <span>{currentVersionOf(row)?.name ?? "—"}</span>,
		},
		{
			id: "version",
			header: t("adminPlatform.frontends.columns.version"),
			cell: (row) => <MonoText>{row.currentVersion}</MonoText>,
		},
		{
			id: "compat",
			header: t("adminPlatform.frontends.columns.compat"),
			cell: (row) => {
				const version = currentVersionOf(row);
				if (!version) {
					return (
						<TonePill tone="danger">
							{t("adminPlatform.frontends.compat.versionMissing")}
						</TonePill>
					);
				}
				const compat = checkCompatibility(version, t);
				return compat.compatible ? (
					<TonePill tone="success" icon={<CheckCircle2 aria-hidden="true" />}>
						{t("adminPlatform.frontends.compat.compatible")}
					</TonePill>
				) : (
					<TonePill
						tone="warning"
						title={compat.reasons.join(t("adminPlatform.common.reasonSeparator"))}
					>
						{t("adminPlatform.frontends.compat.incompatible")}
					</TonePill>
				);
			},
		},
		{
			id: "runtime",
			header: t("adminPlatform.frontends.columns.runtime"),
			hideBelow: "md",
			cell: (row) => {
				const version = currentVersionOf(row);
				return (
					<MonoText className="text-muted-foreground">
						{version?.compatibility.frontendRuntime ?? "—"} /{" "}
						{version?.compatibility.apiContract ?? "—"}
					</MonoText>
				);
			},
		},
		{
			id: "entry",
			header: t("adminPlatform.frontends.columns.entry"),
			hideBelow: "lg",
			cell: (row) => (
				<MonoText className="text-muted-foreground">
					{currentVersionOf(row)?.entry ?? "—"}
				</MonoText>
			),
		},
		{
			id: "installedAt",
			header: t("adminPlatform.frontends.columns.installedAt"),
			align: "right",
			hideBelow: "sm",
			sortValue: (row) => Date.parse(currentVersionOf(row)?.installedAt ?? ""),
			cell: (row) => {
				const version = currentVersionOf(row);
				return version ? <AbsoluteTime value={version.installedAt} /> : <span>—</span>;
			},
		},
	];

	return (
		<PageBody>
			<PageHeader
				title={t("adminPlatform.frontends.title")}
				description={t("adminPlatform.frontends.description")}
				badge={<TonePill tone="muted">{t("adminPlatform.frontends.badge")}</TonePill>}
				actions={
					<Toolbar>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void loadRegistry()}
							disabled={state.status === "loading"}
						>
							<RefreshCw aria-hidden="true" />
							{t("adminPlatform.frontends.actions.reload")}
						</Button>
						<Button variant="outline" size="sm" asChild>
							<Link to="/admin/platform/settings">
								<ExternalLink aria-hidden="true" />
								{t("adminPlatform.frontends.actions.settingsPage")}
							</Link>
						</Button>
					</Toolbar>
				}
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label={t("adminPlatform.frontends.stats.installed")}
					value={registry ? rows.length : "…"}
					hint={
						registry ? (
							<span>
								{t("adminPlatform.frontends.stats.updatedAt")}{" "}
								<AbsoluteTime value={registry.updatedAt} />
							</span>
						) : (
							t("adminPlatform.frontends.stats.waitingRegistry")
						)
					}
					icon={<Info className="size-4" aria-hidden="true" />}
				/>
				<StatCard
					label={t("adminPlatform.frontends.stats.runtimeContract")}
					value={FRONTEND_RUNTIME_VERSION}
					hint={
						<span className="inline-flex flex-wrap items-center gap-1">
							<MonoText>FRONTEND_RUNTIME_VERSION</MonoText>·{" "}
							{t("adminPlatform.frontends.stats.compileTimeConstant")}
						</span>
					}
				/>
				<StatCard
					label={t("adminPlatform.frontends.stats.apiContract")}
					value={API_CONTRACT_VERSION}
					hint={
						<span className="inline-flex flex-wrap items-center gap-1">
							<MonoText>API_CONTRACT_VERSION</MonoText>·{" "}
							{t("adminPlatform.frontends.stats.compileTimeConstant")}
						</span>
					}
				/>
				<StatCard
					label={t("adminPlatform.frontends.stats.active")}
					value={<span className="font-mono">{currentValue || "—"}</span>}
					hint={
						activeRow ? (
							<span className="inline-flex flex-wrap items-center gap-1">
								<MonoText>FRONTEND_ACTIVE</MonoText>·{" "}
								{t("adminPlatform.frontends.stats.activeUpdatedAt")}{" "}
								<AbsoluteTime value={activeRow.updated_at} />
							</span>
						) : (
							t("adminPlatform.frontends.stats.activeMissing")
						)
					}
					tone={activeRow ? "success" : "warning"}
				/>
			</div>

			<SectionCard
				title={t("adminPlatform.frontends.registry.title")}
				description={t("adminPlatform.frontends.registry.description")}
				actions={<RefreshingBadge active={state.status === "loading"} />}
			>
				{state.status === "loading" ? (
					<LoadingBlock label={t("adminPlatform.frontends.registry.loading")} />
				) : state.status === "error" ? (
					<ErrorBlock
						error={new Error(state.error.message)}
						title={t("adminPlatform.frontends.registry.errorTitle")}
						onRetry={() => void loadRegistry()}
					/>
				) : (
					<div className="space-y-4">
						<KeyValueList
							columns={3}
							items={[
								{
									key: t("adminPlatform.frontends.registry.address"),
									value: (
										<CopyText
											value={DEFAULT_REGISTRY_URL}
											label={t("adminPlatform.frontends.registry.address")}
										/>
									),
								},
								{
									key: t("adminPlatform.frontends.registry.schemaVersion"),
									value: (
										<MonoText>{String(state.registry.schemaVersion)}</MonoText>
									),
									hint: "FRONTEND_REGISTRY_SCHEMA_VERSION",
								},
								{
									key: t("adminPlatform.frontends.registry.updatedAt"),
									value: (
										<AbsoluteTime value={state.registry.updatedAt} seconds />
									),
								},
							]}
						/>
						{rows.length === 0 ? (
							<EmptyBlock
								title={t("adminPlatform.frontends.registry.emptyTitle")}
								description={t("adminPlatform.frontends.registry.emptyDescription")}
							/>
						) : (
							<DataTable
								data={rows}
								getRowId={(row) => row.id}
								columns={columns}
								rowActions={(row) => (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setDetailId(row.id)}
									>
										{t("adminPlatform.frontends.detail.title")}
									</Button>
								)}
								mobileCard={(row) => {
									const version = currentVersionOf(row);
									const compat = version ? checkCompatibility(version, t) : null;
									return (
										<div className="space-y-2">
											<div className="flex items-center justify-between gap-2">
												<MonoText className="font-medium">{row.id}</MonoText>
												{compat ? (
													<TonePill
														tone={
															compat.compatible ? "success" : "warning"
														}
													>
														{compat.compatible
															? t(
																	"adminPlatform.frontends.compat.contractCompatible",
																)
															: t(
																	"adminPlatform.frontends.compat.contractIncompatible",
																)}
													</TonePill>
												) : null}
											</div>
											<p className="text-sm">
												{version?.name ?? "—"} · v{row.currentVersion}
											</p>
											{compat && !compat.compatible ? (
												<p className="text-xs text-destructive">
													{compat.reasons.join(
														t("adminPlatform.common.reasonSeparator"),
													)}
												</p>
											) : null}
											<Button
												variant="outline"
												size="sm"
												onClick={() => setDetailId(row.id)}
											>
												{t("adminPlatform.frontends.detail.title")}
											</Button>
										</div>
									);
								}}
							/>
						)}
					</div>
				)}
			</SectionCard>

			{state.status === "error" ? (
				<SectionCard
					title={t("adminPlatform.frontends.registry.errorDetailsTitle")}
					description={t("adminPlatform.frontends.registry.errorDetailsDescription")}
				>
					<ul className="list-disc space-y-1 pl-5 text-sm">
						{state.error.details.map((detail) => (
							<li key={detail} className="text-muted-foreground break-all">
								{detail}
							</li>
						))}
					</ul>
				</SectionCard>
			) : null}

			<SectionCard
				title={t("adminPlatform.frontends.switch.title")}
				description={t("adminPlatform.frontends.switch.description")}
			>
				<div className="space-y-4">
					{activeQuery.isPending ? (
						<LoadingBlock
							label={t("adminPlatform.frontends.switch.loadingSettings")}
						/>
					) : activeQuery.isError ? (
						<ErrorBlock
							error={activeQuery.error}
							title={t("adminPlatform.frontends.switch.settingsLoadFailed")}
							onRetry={() => void activeQuery.refetch()}
						/>
					) : !activeRow ? (
						<div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
							<ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
							<div className="space-y-1">
								<p className="flex flex-wrap items-center gap-1.5">
									<MonoText>{FRONTEND_ACTIVE_KEY}</MonoText>
									<span>{t("adminPlatform.frontends.switch.noActiveDescription")}</span>
								</p>
								<Link
									to="/admin/platform/settings"
									className="underline underline-offset-4"
								>
									{t("adminPlatform.frontends.switch.goSettings")}
								</Link>
							</div>
						</div>
					) : (
						<>
							<div className="grid gap-4 lg:grid-cols-2">
								<div className="space-y-1.5">
									<p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
										{t("adminPlatform.frontends.switch.currentLabel")}
										<MonoText>{FRONTEND_ACTIVE_KEY}</MonoText>
									</p>
									<Select
										value={selected ?? ""}
										onValueChange={setSelected}
										disabled={registry === null || patchMutation.isPending}
									>
										<SelectTrigger
											className="w-full"
											aria-label={t("adminPlatform.frontends.switch.selectAria")}
										>
											<SelectValue
												placeholder={t(
													"adminPlatform.frontends.switch.placeholder",
												)}
											/>
										</SelectTrigger>
										<SelectContent>
											{options.map((option) => {
												const suffix = `${
													option.entry.protected
														? t(
																"adminPlatform.frontends.switch.optionBuiltinSuffix",
															)
														: ""
												}${
													option.compat.compatible
														? ""
														: t(
																"adminPlatform.frontends.switch.optionDisabledSuffix",
															)
												}`;
												return (
													<SelectItem
														key={option.entry.id}
														value={option.entry.id}
														disabled={!option.compat.compatible}
													>
														{t(
															"adminPlatform.frontends.switch.option",
															{
																id: option.entry.id,
																name:
																	option.version?.name ??
																	t(
																		"adminPlatform.frontends.switch.optionNameFallback",
																	),
																version: option.entry.currentVersion,
															},
														)}
														{suffix}
													</SelectItem>
												);
											})}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<p className="text-xs text-muted-foreground">
										{t("adminPlatform.frontends.switch.selectedTitle")}
									</p>
									{selectedOption ? (
										<div className="space-y-1 text-sm">
											<div className="flex flex-wrap items-center gap-2">
												<BooleanPill
													value={selectedOption.compat.compatible}
													trueText={t(
														"adminPlatform.frontends.compat.contractCompatible",
													)}
													falseText={t(
														"adminPlatform.frontends.compat.contractIncompatible",
													)}
													trueTone="success"
													falseTone="warning"
												/>
												<BooleanPill
													value={selectedOption.entry.protected}
													trueText={t(
														"adminPlatform.frontends.pills.builtin",
													)}
													falseText={t(
														"adminPlatform.frontends.pills.thirdParty",
													)}
												/>
											</div>
											<p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
												<span>
													{t(
														"adminPlatform.frontends.switch.versionLabel",
														{
															version:
																selectedOption.entry
																	.currentVersion,
														},
													)}
												</span>
												·{" "}
												<span>
													{t(
														"adminPlatform.frontends.switch.entryLabel",
													)}
												</span>
												<MonoText>
													{selectedOption.version?.entry ?? "—"}
												</MonoText>
											</p>
											{selectedOption.compat.reasons.length > 0 ? (
												<InlineError
													error={selectedOption.compat.reasons.join(
														t(
															"adminPlatform.common.reasonSeparator",
														),
													)}
												/>
											) : null}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">
											{t("adminPlatform.frontends.switch.selectHint")}
										</p>
									)}
								</div>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<Button
									onClick={() => void submitSwitch()}
									disabled={!dirty || patchMutation.isPending || !activeRow}
								>
									{patchMutation.isPending
										? t("adminPlatform.frontends.switch.saving")
										: t("adminPlatform.frontends.switch.save")}
								</Button>
								<Button
									variant="outline"
									onClick={() => window.location.reload()}
									disabled={switched === null}
								>
									<RotateCw aria-hidden="true" />
									{t("adminPlatform.frontends.switch.reload")}
								</Button>
								{switched && !dirty ? (
									<p className="text-xs text-muted-foreground">
										{t("adminPlatform.frontends.switch.savedHint", {
											id: switched,
										})}
									</p>
								) : null}
								{activeQuery.isFetching ? (
									<RefreshingBadge
										active={activeQuery.isFetching && !activeQuery.isPending}
									/>
								) : null}
							</div>

							<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<span>{t("adminPlatform.frontends.switch.breakGlass")}</span>
								<MonoText>?frontend=default</MonoText>
							</div>
						</>
					)}
				</div>
			</SectionCard>

			<Sheet open={detailEntry !== null} onOpenChange={(open) => !open && setDetailId(null)}>
				<SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl">
					<SheetHeader>
						<SheetTitle>
							{detailEntry
								? t("adminPlatform.frontends.detail.namedTitle", {
										id: detailEntry.id,
									})
								: t("adminPlatform.frontends.detail.title")}
						</SheetTitle>
						<SheetDescription>
							{t("adminPlatform.frontends.detail.description")}
						</SheetDescription>
					</SheetHeader>
					{detailEntry ? (
						<div className="space-y-3 px-4 pb-6">
							<KeyValueList
								columns={2}
								items={[
									{
										key: t("adminPlatform.frontends.detail.id"),
										value: <MonoText>{detailEntry.id}</MonoText>,
									},
									{
										key: t("adminPlatform.frontends.detail.currentVersion"),
										value: (
											<MonoText>{detailEntry.currentVersion}</MonoText>
										),
									},
									{
										key: t("adminPlatform.frontends.detail.protected"),
										value: (
											<BooleanPill
												value={detailEntry.protected}
												trueText={t(
													"adminPlatform.frontends.pills.builtinNoRemove",
												)}
												falseText={t(
													"adminPlatform.frontends.pills.thirdParty",
												)}
											/>
										),
									},
									{
										key: t("adminPlatform.frontends.detail.versionCount"),
										value: (
											<MonoText>
												{Object.keys(detailEntry.versions).length}
											</MonoText>
										),
									},
								]}
							/>
							<div className="space-y-2">
								{Object.entries(detailEntry.versions).map(
									([versionKey, version]) => {
										const compat = checkCompatibility(version, t);
										return (
											<div
												key={versionKey}
												className="space-y-1 rounded-lg border px-3 py-2"
											>
												<div className="flex flex-wrap items-center gap-2">
													<MonoText className="font-medium">
														v{versionKey}
													</MonoText>
													<span className="text-sm">
														{version.name}
													</span>
													{versionKey ===
													detailEntry.currentVersion ? (
														<TonePill tone="success">
															{t(
																"adminPlatform.frontends.pills.currentVersion",
															)}
														</TonePill>
													) : null}
													<TonePill
														tone={
															compat.compatible
																? "success"
																: "warning"
														}
													>
														{compat.compatible
															? t(
																	"adminPlatform.frontends.compat.contractCompatible",
																)
															: t(
																	"adminPlatform.frontends.compat.contractIncompatible",
																)}
													</TonePill>
												</div>
												<p className="text-xs text-muted-foreground">
													{t(
														"adminPlatform.frontends.detail.runtimeApi",
														{
															runtime:
																version.compatibility
																	.frontendRuntime,
															api: version.compatibility
																.apiContract,
														},
													)}
													{version.compatibility.sdk
														? ` · sdk ${version.compatibility.sdk}`
														: ""}
												</p>
												<p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
													<span>
														{t(
															"adminPlatform.frontends.detail.entry",
														)}
													</span>
													<MonoText>{version.entry}</MonoText>
													·{" "}
													<span>
														{t(
															"adminPlatform.frontends.detail.styles",
														)}
													</span>
													<MonoText>
														{version.styles.join(", ") ||
															t(
																"adminPlatform.frontends.detail.emptyStyles",
															)}
													</MonoText>
												</p>
												<p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
													<span>
														{t(
															"adminPlatform.frontends.detail.installedAt",
														)}
													</span>
													<AbsoluteTime
														value={version.installedAt}
														seconds
													/>
													{version.author ? (
														<span>
															·{" "}
															{t(
																"adminPlatform.frontends.detail.author",
																{
																	author: textOf(
																		version.author,
																	),
																},
															)}
														</span>
													) : null}
												</p>
												{version.description ? (
													<p className="text-xs text-muted-foreground">
														{version.description}
													</p>
												) : null}
												{compat.reasons.length > 0 ? (
													<InlineError
														error={compat.reasons.join(
															t(
																"adminPlatform.common.reasonSeparator",
															),
														)}
													/>
												) : null}
											</div>
										);
									},
								)}
							</div>
						</div>
					) : null}
				</SheetContent>
			</Sheet>
		</PageBody>
	);
}
