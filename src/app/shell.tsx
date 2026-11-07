/**
 * 应用外壳（选手端 Field / 管理端 Control Room 共用一套实现，靠导航配置区分）。
 *
 * 交互模型：左侧可折叠导航（图标态保留）→ 顶栏（命令面板 / 语言 / 主题 / 账号）→ 主区；
 * 移动端侧边栏收进 Sheet，另有底部导航。主区永远由 `<Outlet/>` 渲染当前页面。
 * 版式对齐 docs/theme.md §6.1（侧栏 256/48、顶栏 sticky、面包屑式当前页标题）。
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronsUpDown, Languages, LogOut, Moon, Sun, UserCircle } from "lucide-react";

import { useAuthStore, useMe } from "~/auth/store";
import { CommandTrigger } from "~/app/command-palette";
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

function isActivePath(pathname: string, item: NavItem): boolean {
	if (item.end) return pathname === item.to;
	return pathname === item.to || pathname.startsWith(`${item.to}/`);
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

	return (
		<SidebarProvider>
			<Sidebar collapsible="icon">
				<SidebarHeader>
					<div className="flex items-center gap-2 px-1 py-1.5">
						<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground ring-1 ring-border/60">
							{brand.slice(0, 1)}
						</div>
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

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon-sm"
								className="bg-background/80 backdrop-blur"
								aria-label={
									theme === "dark" ? t("common.theme.toggleToLight") : t("common.theme.toggleToDark")
								}
								title={
									theme === "dark" ? t("common.theme.toggleToLight") : t("common.theme.toggleToDark")
								}
							>
								{theme === "dark" ? <Sun /> : <Moon />}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>{t("common.theme.label")}</DropdownMenuLabel>
							<DropdownMenuItem onClick={() => setThemePreference("light")}>
								<Sun /> {t("common.theme.light")}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setThemePreference("dark")}>
								<Moon /> {t("common.theme.dark")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

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

				<main className="min-w-0 flex-1 pb-16 md:pb-0">
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
