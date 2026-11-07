/**
 * 应用外壳（选手端 Field / 管理端 Control Room 共用一套实现，靠导航配置区分）。
 *
 * 交互模型：左侧可折叠导航（图标态保留）→ 顶栏（命令面板 / 语言 / 主题 / 账号）→ 主区；
 * 移动端侧边栏收进 Sheet，另有底部导航。主区永远由 `<Outlet/>` 渲染当前页面。
 * 版式对齐 docs/theme.md §6.1（侧栏 256/48、顶栏 sticky、面包屑式当前页标题）。
 */

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronsUpDown, Languages, LogOut, Moon, Search, Sun, UserCircle } from "lucide-react";

import { useAuthStore, useMe } from "~/auth/store";
import { CommandTrigger, useCommandPalette } from "~/app/command-palette";
import { BrandMark } from "~/components/app/brand";
import { UserAvatar } from "~/components/app/user-cell";
import { Button } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "~/components/ui/sidebar";
import { getLocale, setLocale, type Locale } from "~/lib/i18n";
import { setThemePreference, useTheme } from "~/lib/theme";
import { cn } from "~/lib/utils";

import {
	adminNav as adminNavGroups,
	adminMobileNav,
	type NavGroup,
	type NavItem,
	playerNav as playerNavGroups,
	playerMobileNav,
} from "./nav";

export interface AppShellProps {
	navGroups: NavGroup[];
	mobileNav: NavItem[];
	/** 账号作用域：决定登出清哪个 token、在哪看资料。 */
	scope: "user" | "admin";
	children?: ReactNode;
}

/**
 * AWD 驾驶舱（/arena/:id）与 AWDP 工作台（/lab/:id）是赛事的子工作区，
 * 但路由并不挂在 /events 下 —— 侧边栏仍应高亮父级「赛事」。
 */
const NAV_ALIASES: Record<string, string> = {
	"/arena": "/events",
	"/lab": "/events",
};

function isActivePath(pathname: string, item: NavItem): boolean {
	if (item.end) return pathname === item.to;
	const alias = Object.keys(NAV_ALIASES).find(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
	const target = alias ? NAV_ALIASES[alias] : pathname;
	return target === item.to || target.startsWith(`${item.to}/`);
}

function currentItem(groups: NavGroup[], pathname: string): NavItem | undefined {
	const items = groups.flatMap((group) => group.items);
	// 取最长匹配（最具体的路径优先）。
	return items
		.filter((item) => isActivePath(pathname, item))
		.sort((a, b) => b.to.length - a.to.length)[0];
}

export function AppShell({ navGroups, mobileNav, scope }: AppShellProps) {
	const { t } = useTranslation();
	const location = useLocation();
	const setPaletteOpen = useCommandPalette().setOpen;
	const navigate = useNavigate();
	const theme = useTheme();
	const me = useMe();
	const clearScope = useAuthStore((state) => state.clearScope);
	const clearAll = useAuthStore((state) => state.clearAll);
	const adminToken = useAuthStore((state) => state.adminToken);

	const active = currentItem(navGroups, location.pathname);
	const title = active ? t(active.labelKey) : "";
	const identity =
		scope === "admin"
			? t("shell.adminSession")
			: (me?.nickname ?? me?.username ?? t("shell.playerSession"));

	const brand = "FloatCTF";
	const brandSubtitle =
		scope === "admin" ? t("shell.adminSubtitle") : t("shell.playerSubtitle");

	function logout() {
		if (scope === "admin") clearScope("admin");
		else clearAll();
		void navigate(scope === "admin" ? "/admin/login" : "/login", { replace: true });
	}

	async function changeLocale(next: Locale) {
		await setLocale(next);
	}

	// shadcn 的 SidebarProvider 会把状态写进 cookie，但不会自己读回：
	// 首次挂载时按 cookie 初始化，刷新后保持折叠/展开。
	const sidebarDefaultOpen = useState(() => {
		const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/);
		return match ? match[1] === "true" : true;
	})[0];

	return (
		<SidebarProvider defaultOpen={sidebarDefaultOpen}>
			{/* 键盘用户先到主内容：Tab 第一站，Enter 跳过侧栏与顶栏。 */}
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-sm"
			>
				{t("shell.skipToContent")}
			</a>
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<div className="flex items-center gap-2 px-1 py-1.5">
						<BrandMark />
						<div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
							<span className="truncate text-sm font-semibold tracking-tight">{brand}</span>
							<span className="truncate text-xs text-muted-foreground">{brandSubtitle}</span>
						</div>
					</div>
				</SidebarHeader>

				<SidebarContent>
					{navGroups.map((group) => (
						<SidebarGroup key={group.labelKey}>
							<SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{group.items.map((item) => {
										const Icon = item.icon;
										return (
											<SidebarMenuItem key={item.to}>
												<SidebarMenuButton
													asChild
													isActive={isActivePath(location.pathname, item)}
													tooltip={t(item.labelKey)}
												>
													<NavLink to={item.to} end={item.end}>
														<Icon aria-hidden="true" />
														<span>{t(item.labelKey)}</span>
													</NavLink>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}
				</SidebarContent>

				<SidebarFooter>
					<div className="flex items-center gap-2 px-1 py-1.5 group-data-[collapsible=icon]:hidden">
						<span className="truncate text-xs text-muted-foreground">{identity}</span>
					</div>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>

			<SidebarInset className="min-w-0">
				<header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:px-6">
					<SidebarTrigger aria-label={t("shell.toggleNav")} />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{title}</p>
					</div>

					<CommandTrigger className="hidden h-8 items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted md:inline-flex md:w-56" />
					{/* 移动端没有 ⌘K：给一个图标入口，别让命令面板在手机上不可达。 */}
					<Button
						variant="ghost"
						size="icon-sm"
						className="md:hidden"
						aria-label={t("shell.command.openPalette")}
						title={t("shell.command.openPalette")}
						onClick={() => setPaletteOpen(true)}
					>
						<Search className="size-4" aria-hidden="true" />
					</Button>

					{/* 单键切换亮/暗（theme.md §2.4 ThemeToggle）：一次点击即生效，不藏在菜单里。 */}
					<Button
						variant="outline"
						size="icon-sm"
						className="bg-background/80 backdrop-blur"
						aria-label={
							theme === "dark" ? t("common.theme.toggleToLight") : t("common.theme.toggleToDark")
						}
						title={theme === "dark" ? t("common.theme.toggleToLight") : t("common.theme.toggleToDark")}
						onClick={() => setThemePreference(theme === "dark" ? "light" : "dark")}
					>
						{theme === "dark" ? <Sun /> : <Moon />}
					</Button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t("common.language")}
								title={t("common.language")}
							>
								<Languages />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
							{(["zh-CN", "en"] as const).map((locale) => (
								<DropdownMenuItem
									key={locale}
									onClick={() => void changeLocale(locale)}
									aria-current={getLocale() === locale ? "true" : undefined}
								>
									{locale === "zh-CN" ? "简体中文" : "English"}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="gap-2 px-1.5">
								{scope === "user" ? (
									<UserAvatar name={identity} avatar={me?.avatar ?? null} size="sm" />
								) : (
									<span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
										ADM
									</span>
								)}
								<span className="hidden max-w-32 truncate text-sm sm:inline">{identity}</span>
								<ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuLabel className="truncate">
								{scope === "admin"
									? adminToken
										? t("shell.adminLabel")
										: t("shell.notSignedIn")
									: (me?.username ?? t("shell.notSignedIn"))}
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{scope === "user" ? (
								<DropdownMenuItem onClick={() => void navigate("/profile")}>
									<UserCircle /> {t("nav.items.profile")}
								</DropdownMenuItem>
							) : (
								<DropdownMenuItem onClick={() => void navigate("/")}>
									<UserCircle /> {t("shell.goPlayer")}
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="destructive" onClick={logout}>
								<LogOut /> {t("common.logout")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</header>

				<main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pb-16 md:pb-0 outline-none">
					<Outlet />
				</main>
			</SidebarInset>

			{/* 移动端底部导航 */}
			<nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/95 backdrop-blur md:hidden">
				{mobileNav.map((item) => {
					const Icon = item.icon;
					const itemActive = isActivePath(location.pathname, item);
					return (
						<NavLink
							key={item.to}
							to={item.to}
							end={item.end}
							aria-current={itemActive ? "page" : undefined}
							className={cn(
								"flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
								itemActive ? "text-foreground" : "text-muted-foreground",
							)}
						>
							<Icon className="size-4" aria-hidden="true" />
							{t(item.labelKey)}
						</NavLink>
					);
				})}
			</nav>
		</SidebarProvider>
	);
}

/** 选手端外壳。 */
export function PlayerShell() {
	return (
		<AppShell navGroups={playerNavGroups} mobileNav={playerMobileNav} scope="user" />
	);
}

/** 管理端外壳。 */
export function AdminShell() {
	return <AppShell navGroups={adminNavGroups} mobileNav={adminMobileNav} scope="admin" />;
}
