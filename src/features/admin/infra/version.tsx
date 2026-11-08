/**
 * 管理端 · 平台版本（`/admin/version`）。
 *
 * Default 的版本页只有三行：Version / floatctf-web / floatctf-api。
 * 这里保持同一信息架构，只换成 shadcn 的卡片与排版。
 *
 * - `floatctf-web` 来自构建期注入的制品版本（`__APP_VERSION__`）；
 * - `floatctf-api` 来自真实接口 `GET /api/admin/system/version`；
 * - 接口失败时显示后端错误并提供重试，不伪造版本号。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { call } from "~/api/call";
import { useClient } from "~/api/client";
import { qk } from "~/api/keys";
import { KeyValueList, MonoText, PageBody, PageHeader, SectionCard } from "~/components/app/page";
import { ErrorBlock, LoadingBlock } from "~/components/app/states";
import { Button } from "~/components/ui/button";
import { useDocumentTitle } from "~/lib/hooks";

export function AdminVersionPage(): ReactNode {
	const { t } = useTranslation();
	useDocumentTitle(t("adminInfra.version.documentTitle"));
	const client = useClient();

	const query = useQuery({
		queryKey: qk.admin.version(),
		queryFn: () => call<string>(client.admin.system.version(), t("adminInfra.version.title")),
		staleTime: 5 * 60_000,
	});

	return (
		<PageBody>
			<PageHeader
				title={t("adminInfra.version.title")}
				description={t("adminInfra.version.description")}
				actions={
					<Button
						variant="outline"
						onClick={() => void query.refetch()}
						disabled={query.isFetching}
					>
						<RefreshCw className={query.isFetching ? "animate-spin" : undefined} />
						{t("common.refresh")}
					</Button>
				}
			/>

			<SectionCard title={t("adminInfra.version.rows.title")}>
				<KeyValueList
					columns={1}
					items={[
						{
							key: "floatctf-web",
							value: <MonoText>{__APP_VERSION__}</MonoText>,
						},
						{
							key: "floatctf-api",
							value: query.isPending ? (
								<LoadingBlock label={t("adminInfra.version.loading")} />
							) : query.isError ? (
								<ErrorBlock error={query.error} title={t("adminInfra.version.errorTitle")} />
							) : (
								<MonoText>{query.data || t("adminInfra.version.rows.missing")}</MonoText>
							),
						},
					]}
				/>
			</SectionCard>
		</PageBody>
	);
}
