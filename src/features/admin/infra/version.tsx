/**
 * 管理端 · 平台版本（`/admin/version`）。
 *
 * 真实接口：`client.admin.system.version()`（`GET /api/admin/system/version`，返回字符串）。
 * 其它数字是**编译期契约常量**（`@floatctf/frontend-runtime`），不是接口数据，
 * 因此单独标注来源，绝不冒充后端返回值。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AppWindow, Info, RefreshCw, Server } from "lucide-react";

import {
	API_CONTRACT_VERSION,
	FRONTEND_RUNTIME_FULL_VERSION,
	FRONTEND_RUNTIME_VERSION,
} from "@floatctf/frontend-runtime";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import {
	KeyValueList,
	MonoText,
	PageBody,
	PageHeader,
	SectionCard,
	StatCard,
	Toolbar,
} from "~/components/app/page";
import { LoadingBlock, QueryState } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import { useDocumentTitle } from "~/lib/hooks";

export function AdminVersionPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminInfra.version.documentTitle"));
	const client = useClient();
	const empty = t("common.empty");

	const query = useQuery({
		queryKey: qk.admin.version(),
		queryFn: () => call<string>(client.admin.system.version(), t("adminInfra.version.title")),
		// 版本号几乎不变：低频缓存足够。
		staleTime: 5 * 60_000,
	});

	return (
		<PageBody>
			<PageHeader
				title={t("adminInfra.version.title")}
				description={t("adminInfra.version.description")}
				actions={
					<Toolbar>
						<Button
							variant="outline"
							size="sm"
							onClick={() => void query.refetch()}
							disabled={query.isFetching}
						>
							<RefreshCw
								className={query.isFetching ? "size-4 animate-spin" : "size-4"}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</Button>
					</Toolbar>
				}
			/>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					label={t("adminInfra.version.stats.api")}
					value={query.isPending ? "…" : query.isError ? empty : (query.data ?? empty)}
					hint={t("adminInfra.version.stats.apiHint")}
					icon={<Server className="size-4" aria-hidden="true" />}
					tone={query.isError ? "danger" : "default"}
				/>
				<StatCard
					label={t("adminInfra.version.stats.runtimeContract")}
					value={FRONTEND_RUNTIME_VERSION}
					hint={t("adminInfra.version.stats.runtimeContractHint", {
						name: "FRONTEND_RUNTIME_VERSION",
					})}
					icon={<AppWindow className="size-4" aria-hidden="true" />}
				/>
				<StatCard
					label={t("adminInfra.version.stats.apiContract")}
					value={API_CONTRACT_VERSION}
					hint={t("adminInfra.version.stats.apiContractHint", {
						name: "API_CONTRACT_VERSION",
					})}
					icon={<Info className="size-4" aria-hidden="true" />}
				/>
				<StatCard
					label={t("adminInfra.version.stats.fullVersion")}
					value={FRONTEND_RUNTIME_FULL_VERSION}
					hint={t("adminInfra.version.stats.fullVersionHint", {
						name: "FRONTEND_RUNTIME_FULL_VERSION",
					})}
				/>
			</div>

			<SectionCard
				title={t("adminInfra.version.apiSection.title")}
				description={t("adminInfra.version.apiSection.description")}
			>
				<QueryState
					query={query}
					skeleton={<LoadingBlock label={t("adminInfra.version.loading")} />}
					errorTitle={t("adminInfra.version.errorTitle")}
				>
					{(version) => (
						<KeyValueList
							columns={1}
							items={[
								{
									key: "floatctf-api",
									value: (
										<MonoText className="text-sm">
											{version || t("adminInfra.version.apiSection.missing")}
										</MonoText>
									),
								},
							]}
						/>
					)}
				</QueryState>
			</SectionCard>

			<SectionCard
				title={t("adminInfra.version.contracts.title")}
				description={t("adminInfra.version.contracts.description")}
			>
				<KeyValueList
					columns={1}
					items={[
						{
							key: "FRONTEND_RUNTIME_VERSION",
							value: <MonoText className="text-sm">{FRONTEND_RUNTIME_VERSION}</MonoText>,
							hint: t("adminInfra.version.contracts.hints.runtime"),
						},
						{
							key: "API_CONTRACT_VERSION",
							value: <MonoText className="text-sm">{API_CONTRACT_VERSION}</MonoText>,
							hint: t("adminInfra.version.contracts.hints.api"),
						},
						{
							key: "FRONTEND_RUNTIME_FULL_VERSION",
							value: <MonoText className="text-sm">{FRONTEND_RUNTIME_FULL_VERSION}</MonoText>,
							hint: t("adminInfra.version.contracts.hints.full"),
						},
					]}
				/>
			</SectionCard>
		</PageBody>
	);
}
