/**
 * 导航配置 —— 信息架构的唯一出处（侧边栏、移动端导航、命令面板、面包屑都从这里派生）。
 * 路由路径由本前端自主决定，与 Default Frontend 无关。
 *
 * 文案不写死：`labelKey` / `groupKey` 是 i18n key（`nav.*` 命名空间），
 * 渲染时由消费方 `t()` 翻译 —— 保证中英双语与语言切换即时生效。
 */

import {
	Activity,
	Blocks,
	BookOpen,
	Boxes,
	CalendarDays,
	Container,
	Database,
	Dumbbell,
	Gauge,
	GraduationCap,
	Info,
	ListChecks,
	Megaphone,
	MessagesSquare,
	Network,
	PanelsTopLeft,
	Puzzle,
	ScrollText,
	Settings,
	Shield,
	Swords,
	Terminal,
	Timer,
	Trophy,
	UserCircle,
	UserCog,
	Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
	to: string;
	/** i18n key（`nav.items.*`）。 */
	labelKey: string;
	icon: LucideIcon;
	/** 精确匹配（用于 `/` 这类根路径）。 */
	end?: boolean;
	/** i18n key：命令面板里的补充说明（可选）。 */
	descriptionKey?: string;
	/** 同源静态站点（如 `/training/` 课程站）使用整页跳转，不走客户端路由。 */
	reloadDocument?: boolean;
}

export interface NavGroup {
	/** i18n key（`nav.groups.*`）。 */
	labelKey: string;
	items: NavItem[];
}

export const playerNav: NavGroup[] = [
	{
		labelKey: "nav.groups.overview",
		items: [
			// Default 的选手端落地页是 Top Users；保留 /rank 页面，把 / 重定向到这里。
			{ to: "/rank", labelKey: "nav.items.top", icon: Trophy },
			{ to: "/training/", labelKey: "nav.items.course", icon: GraduationCap, reloadDocument: true },
		],
	},
	{
		labelKey: "nav.groups.competition",
		items: [
			{ to: "/events", labelKey: "nav.items.events", icon: CalendarDays, descriptionKey: "nav.items.eventsHint" },
			{ to: "/challenges", labelKey: "nav.items.challenges", icon: Puzzle, descriptionKey: "nav.items.challengesHint" },
			{ to: "/challenge-sets", labelKey: "nav.items.challengeSets", icon: Blocks },
			{ to: "/training", labelKey: "nav.items.training", icon: Dumbbell },
			{ to: "/instances", labelKey: "nav.items.instances", icon: Boxes },
			{ to: "/solves", labelKey: "nav.items.solves", icon: Activity },
		],
	},
	{
		labelKey: "nav.groups.community",
		items: [
			{ to: "/community/announcements", labelKey: "nav.items.announcements", icon: Megaphone },
			{ to: "/community/discussions", labelKey: "nav.items.discussions", icon: MessagesSquare },
			{ to: "/writeups", labelKey: "nav.items.writeups", icon: BookOpen },
		],
	},
	{
		labelKey: "nav.groups.arsenal",
		items: [{ to: "/arsenal", labelKey: "nav.items.arsenal", icon: Swords }],
	},
	{
		labelKey: "nav.groups.account",
		items: [{ to: "/profile", labelKey: "nav.items.profile", icon: UserCircle }],
	},
];

export const adminNav: NavGroup[] = [
	{
		labelKey: "nav.groups.control",
		items: [
			{ to: "/admin", labelKey: "nav.items.adminDashboard", icon: Gauge, end: true },
			{ to: "/admin/events", labelKey: "nav.items.adminEvents", icon: CalendarDays },
		],
	},
	{
		labelKey: "nav.groups.content",
		items: [
			{ to: "/admin/challenges", labelKey: "nav.items.adminChallenges", icon: Puzzle },
			{ to: "/admin/challenge-sets", labelKey: "nav.items.adminChallengeSets", icon: Blocks },
			{ to: "/admin/gameboxes", labelKey: "nav.items.adminGameboxes", icon: Boxes },
			{ to: "/admin/network", labelKey: "nav.items.adminNetworks", icon: Network },
		],
	},
	{
		labelKey: "nav.groups.community",
		items: [
			{ to: "/admin/community/announcements", labelKey: "nav.items.announcements", icon: Megaphone },
			{ to: "/admin/community/discussions", labelKey: "nav.items.discussions", icon: MessagesSquare },
			{ to: "/admin/community/weapons", labelKey: "nav.items.arsenal", icon: Swords },
		],
	},
	{
		labelKey: "nav.groups.platform",
		items: [
			{ to: "/admin/platform/users", labelKey: "nav.items.adminUsers", icon: Users },
			{ to: "/admin/platform/roles", labelKey: "nav.items.adminRoles", icon: UserCog },
			{ to: "/admin/platform/logs", labelKey: "nav.items.adminLogs", icon: ScrollText },
			{ to: "/admin/platform/settings", labelKey: "nav.items.adminSettings", icon: Settings },
			{ to: "/admin/platform/frontends", labelKey: "nav.items.adminFrontends", icon: PanelsTopLeft },
			{ to: "/admin/platform/tasks", labelKey: "nav.items.adminTasks", icon: Timer },
		],
	},
	{
		labelKey: "nav.groups.infra",
		items: [
			{ to: "/admin/infra/docker", labelKey: "nav.items.adminDocker", icon: Container },
			{ to: "/admin/infra/sql", labelKey: "nav.items.adminSql", icon: Database },
			{ to: "/admin/infra/terminal", labelKey: "nav.items.adminTerminal", icon: Terminal },
			{ to: "/admin/version", labelKey: "nav.items.adminVersion", icon: Info },
		],
	},
];

/** 移动端底部导航（只放最高频入口）。 */
export const playerMobileNav: NavItem[] = [
	{ to: "/rank", labelKey: "nav.items.top", icon: Trophy },
	{ to: "/events", labelKey: "nav.items.events", icon: CalendarDays },
	{ to: "/challenges", labelKey: "nav.items.challenges", icon: Puzzle },
	{ to: "/profile", labelKey: "nav.items.profile", icon: UserCircle },
];

export const adminMobileNav: NavItem[] = [
	{ to: "/admin", labelKey: "nav.items.adminDashboard", icon: Gauge, end: true },
	{ to: "/admin/events", labelKey: "nav.items.adminEvents", icon: CalendarDays },
	{ to: "/admin/challenges", labelKey: "nav.items.adminChallenges", icon: Puzzle },
	{ to: "/admin/platform/users", labelKey: "nav.items.adminUsers", icon: Users },
];

export function flatNav(groups: NavGroup[]): NavItem[] {
	return groups.flatMap((group) => group.items);
}

/** 事件日志 / 列表里常用的安全图标。 */
export const navIcons = { Shield, ListChecks };
