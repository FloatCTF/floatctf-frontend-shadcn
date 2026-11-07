/** 未匹配路由的兜底页：可见、可恢复，不是白屏。 */

import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { PageBody } from "~/components/app/page";
import { NotFoundBlock } from "~/components/app/states";
import { useDocumentTitle } from "~/lib/hooks";
import { Button } from "~/components/ui/button";

export function NotFoundPage() {
	const { t } = useTranslation();
	useDocumentTitle(t("shell.notFound.title"));
	return (
		<PageBody className="max-w-2xl">
			<NotFoundBlock
				title={t("shell.notFound.title")}
				description={t("shell.notFound.description")}
				action={
					<div className="flex flex-wrap items-center justify-center gap-2">
						<Button asChild>
							<Link to="/">{t("shell.notFound.toPlayer")}</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/admin">{t("shell.notFound.toAdmin")}</Link>
						</Button>
					</div>
				}
			/>
		</PageBody>
	);
}
