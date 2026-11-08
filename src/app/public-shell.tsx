/**
 * 公开页面外壳（登录 / 注册 / 找回密码）—— 认证分屏布局，无侧边栏。
 *
 * 版式对齐 docs/theme.md §6.4.E：
 * - `md:grid-cols-2` 分屏：左侧 `bg-card` 品牌区（细网格纹理）+ 右侧表单区；
 * - 右上角固定语言切换 + 主题切换；移动端隐藏品牌区，只保留字标；
 * - 管理端与选手端会话相互独立，token 永远不进 URL。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun } from "lucide-react";
import { Link, Outlet } from "react-router";

import { useIsAdminAuthenticated } from "~/auth/store";
import { BrandMark } from "~/components/app/brand";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { getLocale, setLocale, type Locale } from "~/lib/i18n";
import { setThemePreference, useTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

export function PublicShell({ children }: { children?: ReactNode }) {
	const { t } = useTranslation();
	const isAdmin = useIsAdminAuthenticated();

	return (
		<div className="grid min-h-svh bg-background md:grid-cols-2">
			{/* 品牌区：仅桌面可见（theme.md §6.4.E） */}
			<aside className="relative hidden flex-col justify-between overflow-hidden border-r bg-card p-10 md:flex">
				<div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
				<div className="relative flex items-center gap-2">
					<BrandMark size="lg" />
					<span className="text-base font-semibold tracking-tight">FloatCTF</span>
				</div>

				<div className="relative max-w-lg space-y-6">
					<div className="space-y-3">
						<h1 className="text-3xl font-semibold tracking-tight text-balance">
							{t("auth.brand.headline")}
						</h1>
						<p className="text-sm leading-relaxed text-muted-foreground">
							{t("auth.brand.description")}
						</p>
					</div>
					<ul className="space-y-3">
						{(["jeopardy", "awd", "awdp"] as const).map((key) => (
							<li key={key} className="flex items-start gap-2 text-sm">
								<span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
								<span>
									<span className="font-medium">{t(`auth.brand.points.${key}.title`)}</span>
									<span className="text-muted-foreground">
										{" "}
										— {t(`auth.brand.points.${key}.description`)}
									</span>
								</span>
							</li>
						))}
					</ul>
				</div>

				<p className="relative text-xs text-muted-foreground">
					{t("auth.brand.footer")}
				</p>
			</aside>

			{/* 表单区 */}
			<div className="relative flex min-h-svh flex-col md:min-h-0">
				<div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-4 py-4 lg:px-6">
					<Link to="/" className="flex items-center gap-2 md:hidden">
						<BrandMark size="sm" />
						<span className="text-sm font-semibold tracking-tight">FloatCTF</span>
					</Link>
					<div className="flex items-center gap-2">
						<ToolbarControls />
						<Button variant="ghost" size="sm" asChild>
							<Link to={isAdmin ? "/admin" : "/admin/login"}>
								{isAdmin ? t("auth.toolbar.backToConsole") : t("auth.toolbar.adminLogin")}
							</Link>
						</Button>
					</div>
				</div>

				<main className="flex flex-1 items-center justify-center px-4 pt-20 pb-10">
					{children ?? <Outlet />}
				</main>

				<footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
					FloatCTF · {t("auth.brand.footer")}
				</footer>
			</div>
		</div>
	);
}

/** 右上角语言 / 主题切换（认证页专用，避免依赖应用外壳）。 */
function ToolbarControls() {
	const { t } = useTranslation();
	const theme = useTheme();
	const [locale, setLocaleState] = useState<Locale>(getLocale());

	async function changeLocale(next: Locale) {
		setLocaleState(next);
		await setLocale(next);
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("common.language")}
						title={t("common.language")}
					>
						<span className="text-xs font-semibold">{locale === "en" ? "EN" : "中"}</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => void changeLocale("zh-CN")}>简体中文</DropdownMenuItem>
					<DropdownMenuItem onClick={() => void changeLocale("en")}>English</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={theme === "dark" ? t("common.theme.toggleToLight") : t("common.theme.toggleToDark")}
				title={theme === "dark" ? t("common.theme.toggleToLight") : t("common.theme.toggleToDark")}
				onClick={() => setThemePreference(theme === "dark" ? "light" : "dark")}
			>
				{theme === "dark" ? <Sun /> : <Moon />}
			</Button>
		</>
	);
}


/** 认证页面统一表单容器（右栏居中，max-w-sm；theme.md §6.4.E）。 */
export function AuthCard({
	title,
	description,
	children,
	footer,
	wide = false,
}: {
	title: string;
	description?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
	wide?: boolean;
}) {
	return (
		<div className={cn("w-full", wide ? "max-w-md" : "max-w-sm")}>
			<div className="mb-6 space-y-1.5">
				<h2 className="text-xl font-semibold tracking-tight">{title}</h2>
				{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
			</div>
			{children}
			{footer ? <div className="mt-6 text-sm">{footer}</div> : null}
		</div>
	);
}
