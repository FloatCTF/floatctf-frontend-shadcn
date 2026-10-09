/**
 * 导航配置 —— 信息架构的唯一出处（侧边栏、移动端导航、命令面板、面包屑都从这里派生）。
 * 路由路径由本前端自主决定，与 Default Frontend 无关。
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
	Home,
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
	Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
	/** 精确匹配（用于 `/` 这类根路径）。 */
	end?: boolean;
	description?: string;
	/**
	 * 整页加载（真实 `<a>` 跳转），不经过客户端路由。
	 *
	 * 用于**同源但不属于本前端路由表**的静态站点（平台在 `/training/` 挂载的教学课程站）：
	 * `<Link>` 会走客户端路由并落到 not-found 页，必须强制文档级跳转。
	 */
	reloadDocument?: boolean;
	/**
	 * 该入口所需的平台权限（v2）。**仅用于界面显隐**，不是授权依据：
	 * 真正的判定在服务端每个请求上（`RequirePermission<P>`）。
	 * 若只靠隐藏入口来"保护"页面，直接输入 URL 就能绕过。
	 */
	permission?: string;
}

export interface NavGroup<T extends NavItem = NavItem> {
	label: string;
	items: T[];
}

/**
 * 管理端导航条目：`permission` **必填**。
 *
 * 为什么要用类型而不是测试来保证：本仓库没有测试运行器（AGENTS.md 规定的门禁是
 * `tsc --noEmit` + `vite build`）。把「必须声明权限」编码进类型后，
 * 漏声明一项就是**编译错误**，比一个可能被删掉的测试更可靠。
 *
 * 同时它把「导航显隐」与「授权」在类型层面分开：`permission` 只决定显示什么，
 * 真正的拒绝永远在服务端。
 */
export type AdminNavItem = NavItem & { permission: string };

export interface AdminNavGroup extends NavGroup<AdminNavItem> {
	items: AdminNavItem[];
}

export const playerNav: NavGroup[] = [
	{
		label: "Play",
		items: [
			{ to: "/", label: "总览", icon: Home, end: true, description: "我的比赛与待办" },
			{ to: "/events", label: "赛事", icon: CalendarDays, description: "全部赛事与工作区" },
			{ to: "/challenges", label: "题库", icon: Puzzle, description: "练习题库" },
			{ to: "/challenge-sets", label: "题集", icon: Blocks, description: "按主题组织的题目集合" },
			// 平台在 `/training/` 直接提供的教学课程站（同源静态站点，不属于本前端路由，故整页加载）。
			{
				to: "/training/",
				label: "课程",
				icon: GraduationCap,
				reloadDocument: true,
				description: "教学课程站（整页打开）",
			},
			{ to: "/training", label: "训练场", icon: Dumbbell, description: "AWDP 练习靶机" },
			{ to: "/instances", label: "我的实例", icon: Boxes, description: "已启动的题目环境" },
		],
	},
	{
		label: "Community",
		items: [
			{ to: "/rank", label: "排行榜", icon: Trophy, description: "Top15 选手" },
			{ to: "/solves", label: "解题流水", icon: Activity, description: "我的练习解题记录" },
			{ to: "/community/announcements", label: "公告", icon: Megaphone },
			{ to: "/community/discussions", label: "讨论区", icon: MessagesSquare },
			{ to: "/writeups", label: "题解", icon: BookOpen },
			{ to: "/arsenal", label: "武器库", icon: Swords },
		],
	},
	{
		label: "Me",
		items: [{ to: "/profile", label: "我的资料", icon: UserCircle }],
	},
];

export const adminNav: AdminNavGroup[] = [
	{
		label: "控制台",
		items: [
			{ to: "/admin", permission: "system.read", label: "总览", icon: Gauge, end: true, description: "平台聚合状态" },
			{ to: "/admin/events", permission: "events.read", label: "赛事", icon: CalendarDays, description: "赛事控制台" },
		],
	},
	{
		label: "内容",
		items: [
			{ to: "/admin/challenges", permission: "challenges.read", label: "题库", icon: Puzzle, description: "题目导入 / 构建 / 校验" },
			{ to: "/admin/challenge-sets", permission: "challenges.read", label: "题集", icon: Blocks },
			{ to: "/admin/gameboxes", permission: "gameboxes.read", label: "GameBox 库", icon: Boxes },
			{ to: "/admin/network", permission: "awd.read", label: "靶场网络", icon: Network },
		],
	},
	{
		label: "社区",
		items: [
			{ to: "/admin/community/announcements", permission: "announcements.manage", label: "公告", icon: Megaphone },
			{ to: "/admin/community/discussions", permission: "discussions.moderate", label: "讨论", icon: MessagesSquare },
			{ to: "/admin/community/weapons", permission: "weapons.read", label: "武器库", icon: Swords },
		],
	},
	{
		label: "平台",
		items: [
			{ to: "/admin/platform/users", permission: "users.read", label: "用户", icon: Users },
			{ to: "/admin/platform/logs", permission: "logs.read", label: "日志", icon: ScrollText },
			{ to: "/admin/platform/settings", permission: "settings.read", label: "设置", icon: Settings },
			{ to: "/admin/platform/frontends", permission: "settings.manage", label: "前端", icon: PanelsTopLeft },
			{ to: "/admin/platform/tasks", permission: "scheduler.manage", label: "计划任务", icon: Timer },
		],
	},
	{
		label: "基础设施",
		items: [
			{ to: "/admin/infra/docker", permission: "docker.read", label: "Docker", icon: Container },
			{ to: "/admin/infra/sql", permission: "database.execute", label: "SQL 控制台", icon: Database },
			{ to: "/admin/infra/terminal", permission: "terminal.open", label: "终端", icon: Terminal },
			{ to: "/admin/version", permission: "system.read", label: "版本", icon: Info },
		],
	},
];

/** 移动端底部导航（只放最高频入口）。 */
export const playerMobileNav: NavItem[] = [
	{ to: "/", label: "总览", icon: Home, end: true },
	{ to: "/events", label: "赛事", icon: CalendarDays },
	{ to: "/challenges", label: "题库", icon: Puzzle },
	{ to: "/rank", label: "排行", icon: Trophy },
	{ to: "/profile", label: "我的", icon: UserCircle },
];

export const adminMobileNav: AdminNavItem[] = [
	{ to: "/admin", permission: "system.read", label: "总览", icon: Gauge, end: true },
	{ to: "/admin/events", permission: "events.read", label: "赛事", icon: CalendarDays },
	{ to: "/admin/challenges", permission: "challenges.read", label: "题库", icon: Puzzle },
	{ to: "/admin/platform/users", permission: "users.read", label: "用户", icon: Users },
];

export function flatNav(groups: NavGroup[]): NavItem[] {
	return groups.flatMap((group) => group.items);
}

/** 事件日志 / 列表里常用的安全图标。 */
export const navIcons = { Shield, ListChecks };

/**
 * 按权限过滤导航（v2）。
 *
 * 语义：
 * - 没有 `permission` 的条目**始终显示**（例如选手端入口、以及"只需要登录"的页面）；
 * - 有 `permission` 的条目要求权限集合里含有它；
 * - `permissions` 为空集合时，所有声明了权限的管理入口都会被隐藏
 *   —— 这正是「已登录但没有任何平台权限」应有的界面（而不是让用户逐个点开吃 403）。
 *
 * 这个函数**不做任何安全判断**：它只决定显示什么。真正的拒绝在服务端。
 */
export function filterNavItems(
	items: NavItem[],
	permissions: ReadonlySet<string>,
): NavItem[] {
	return items.filter((item) => !item.permission || permissions.has(item.permission));
}

export function filterNavGroups(
	groups: NavGroup[],
	permissions: ReadonlySet<string>,
): NavGroup[] {
	return groups
		.map((group) => ({ ...group, items: filterNavItems(group.items, permissions) }))
		.filter((group) => group.items.length > 0);
}
