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
import { RefreshCw } from "lucide-react";
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
import { TonePill } from "~/components/app/badges";
import { PageBody, PageHeader, SectionCard } from "~/components/app/page";
import { InlineError, LoadingBlock } from "~/components/app/states";
import { toast } from "~/components/app/toast";
import { Button } from "~/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { useDocumentTitle } from "~/lib/hooks";


const FRONTEND_ACTIVE_KEY = "FRONTEND_ACTIVE";


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
	const [state, setState] = useState<RegistryState>({ status: "loading" });
	const [selected, setSelected] = useState<string | null>(null);
	const [switched, setSwitched] = useState<string | null>(null);

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
						details: [t("adminPlatform.frontends.errors.address", { url: DEFAULT_REGISTRY_URL })],
					},
				});
				return;
			}
			const parsed = parseRegistry(await response.text());
			if (!parsed.ok) {
				setState({
					status: "error",
					error: { message: t("adminPlatform.frontends.errors.invalid"), details: parsed.errors },
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
					details: [t("adminPlatform.frontends.errors.sameOrigin")],
				},
			});
		}
	}, [t]);

	useEffect(() => {
		void loadRegistry();
	}, [loadRegistry]);

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
	const options = useMemo(() => {
		if (!registry) return [];
		return Object.keys(registry.frontends)
			.sort()
			.map((id) => {
				const entry = registry.frontends[id];
				const version = currentVersionOf(entry);
				const compat = version
					? checkCompatibility(version, t)
					: { compatible: false, reasons: [t("adminPlatform.frontends.compat.versionMissing")] };
				return { id, entry, version, compat };
			});
	}, [registry, t]);

	const selectedOption = options.find((option) => option.id === selected) ?? null;
	const dirty = selected !== null && selected !== currentValue;
	const loading = state.status === "loading" || activeQuery.isPending;

	return (
		<PageBody>
			<PageHeader
				title={t("adminPlatform.frontends.title")}
				description={t("adminPlatform.frontends.description")}
				actions={
					<Button variant="outline" size="sm" onClick={() => void loadRegistry()} disabled={loading}>
						<RefreshCw aria-hidden="true" />
						{t("adminPlatform.frontends.actions.reload")}
					</Button>
				}
			/>

			<SectionCard
				title={t("adminPlatform.frontends.registry.title")}
				description={t("adminPlatform.frontends.registry.description")}
			>
				{state.status === "error" ? (
					<div className="space-y-2">
						<InlineError error={state.error.message} />
						{state.error.details.map((detail) => (
							<p key={detail} className="text-xs text-muted-foreground">
								{detail}
							</p>
						))}
					</div>
				) : loading ? (
					<LoadingBlock label={t("adminPlatform.frontends.registry.loading")} />
				) : (
					<div className="max-w-2xl space-y-4">
						<div className="space-y-2">
							<label htmlFor="frontend-active" className="text-sm font-medium">
								{t("adminPlatform.frontends.selector.label", { key: FRONTEND_ACTIVE_KEY })}
							</label>
							<Select
								value={selected ?? ""}
								disabled={!activeRow || patchMutation.isPending}
								onValueChange={setSelected}
							>
								<SelectTrigger id="frontend-active" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{options.map((option) => (
										<SelectItem
											key={option.id}
											value={option.id}
											disabled={!option.compat.compatible}
										>
											{option.id} · {option.version?.name ?? "—"} · v
											{option.entry.currentVersion}
											{option.entry.protected ? `（${t("adminPlatform.frontends.pills.builtin")}）` : ""}
											{option.compat.compatible
												? ""
												: `（${t("adminPlatform.frontends.compat.incompatible")}）`}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{selectedOption ? (
							<div className="flex flex-wrap items-center gap-2 text-sm">
								<TonePill tone={selectedOption.entry.protected ? "info" : "muted"}>
									{selectedOption.entry.protected
										? t("adminPlatform.frontends.pills.builtin")
										: t("adminPlatform.frontends.pills.thirdParty")}
								</TonePill>
								<TonePill tone={selectedOption.compat.compatible ? "success" : "warning"}>
									{selectedOption.compat.compatible
										? t("adminPlatform.frontends.compat.compatible")
										: t("adminPlatform.frontends.compat.incompatible")}
								</TonePill>
								<span className="text-muted-foreground">
									{t("adminPlatform.frontends.selector.meta", {
										version: selectedOption.entry.currentVersion,
										entry: selectedOption.version?.entry ?? "—",
									})}
								</span>
								{selectedOption.compat.reasons.length > 0 ? (
									<span className="text-xs text-amber-600 dark:text-amber-400">
										{selectedOption.compat.reasons.join(t("adminPlatform.common.reasonSeparator"))}
									</span>
								) : null}
							</div>
						) : null}

						<div className="flex flex-wrap items-center gap-2">
							<Button
								disabled={!dirty || !activeRow || patchMutation.isPending}
								onClick={() => {
									if (selected) patchMutation.mutate(selected);
								}}
							>
								{patchMutation.isPending
									? t("adminPlatform.frontends.switch.saving")
									: t("adminPlatform.frontends.switch.save")}
							</Button>
							<Button
								variant="outline"
								disabled={!switched}
								onClick={() => window.location.reload()}
							>
								{t("adminPlatform.frontends.switch.reload")}
							</Button>
							{switched && !dirty ? (
								<span className="text-xs text-muted-foreground">
									{t("adminPlatform.frontends.switch.savedHint", { id: switched })}
								</span>
							) : null}
						</div>

						<p className="text-xs text-muted-foreground">
							{t("adminPlatform.frontends.selector.breakGlass")}
						</p>
					</div>
				)}
			</SectionCard>
		</PageBody>
	);
}
