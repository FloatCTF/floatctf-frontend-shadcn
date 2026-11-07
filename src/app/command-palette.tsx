/**
 * 命令面板 —— 键盘优先入口（⌘K / Ctrl-K）。
 *
 * 命令来源：
 * 1. 导航命令（由 `nav.ts` 的信息架构自动派生，文案走 `nav.items.*`）；
 * 2. 页面通过 `useCommands([...])` 注册的**上下文命令**（提交 flag / 启动实例 / 新建赛事…）。
 *    卸载时自动撤销，不会在别的页面里残留；调用方负责把文案本地化后再注册。
 */

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { Search } from "lucide-react";
import { create } from "zustand";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "~/components/ui/command";
import { useIsAdminAuthenticated } from "~/auth/store";
import { adminNav, flatNav, playerNav } from "./nav";

const RECENT_KEY = "shadcn.recent-pages";

/** 顶栏触发器与面板提示必须一致：Mac 用 ⌘K，其余用 Ctrl K。 */
function platformShortcutHint(): string {
	if (typeof navigator !== "undefined" && !/Mac|iPhone|iPad/.test(navigator.platform)) {
		return "Ctrl K";
	}
	return "⌘K";
}

export interface AppCommand {
	id: string;
	/** 已本地化的文案（调用方用 `t()` 生成）。 */
	label: string;
	group?: string;
	keywords?: string;
	icon?: ReactNode;
	shortcut?: string;
	run: () => void | Promise<void>;
}

interface CommandStore {
	contextual: AppCommand[];
	register: (commands: AppCommand[]) => void;
	unregister: (ids: string[]) => void;
}

const useCommandStore = create<CommandStore>((set) => ({
	contextual: [],
	register: (commands) =>
		set((state) => ({
			contextual: [...state.contextual.filter((item) => !commands.some((c) => c.id === item.id)), ...commands],
		})),
	unregister: (ids) =>
		set((state) => ({ contextual: state.contextual.filter((item) => !ids.includes(item.id)) })),
}));

/** 页面注册上下文命令；`deps` 变化会重新注册。 */
export function useCommands(commands: AppCommand[], deps: unknown[] = []): void {
	const register = useCommandStore((state) => state.register);
	const unregister = useCommandStore((state) => state.unregister);
	const ids = useMemo(() => commands.map((command) => command.id), [commands]);
	useEffect(() => {
		register(commands);
		return () => unregister(ids);
		// biome-ignore lint/correctness/useExhaustiveDependencies: 由调用方通过 deps 控制
	}, [register, unregister, ids.join("|"), ...deps]);
}

interface PaletteState {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
}

const usePaletteStore = create<PaletteState>((set) => ({
	open: false,
	setOpen: (open) => set({ open }),
	toggle: () => set((state) => ({ open: !state.open })),
}));

export function useCommandPalette(): PaletteState {
	return usePaletteStore();
}

/** 全局快捷键：⌘K / Ctrl-K 打开命令面板。 */
export function CommandPalette(): ReactNode {
	const { t } = useTranslation();
	const { open, setOpen, toggle } = usePaletteStore();
	const contextual = useCommandStore((state) => state.contextual);
	const navigate = useNavigate();
	const isAdmin = useIsAdminAuthenticated();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				toggle();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [toggle]);

	const go = useCallback(
		(to: string) => {
			setOpen(false);
			void navigate(to);
		},
		[navigate, setOpen],
	);

	const navigationGroups = useMemo(() => {
		const sortNav = (items: ReturnType<typeof flatNav>) =>
			[...items].sort((a, b) => t(a.labelKey).localeCompare(t(b.labelKey)));
		if (isAdmin) {
			return [
				{ key: "admin", label: t("shell.command.adminNav"), items: sortNav(flatNav(adminNav)) },
				{ key: "player", label: t("shell.command.playerNav"), items: sortNav(flatNav(playerNav)) },
			];
		}
		return [{ key: "player", label: t("shell.command.nav"), items: sortNav(flatNav(playerNav)) }];
	}, [isAdmin, t]);

	// 最近访问：只在命中导航项时记录（子页面归并到所属一级页面）。
	const allNavItems = useMemo(() => [...flatNav(playerNav), ...flatNav(adminNav)], []);
	const openedOnce = useRef(false);
	const previouslyFocused = useRef<HTMLElement | null>(null);
	useEffect(() => {
		if (open) {
			openedOnce.current = true;
			previouslyFocused.current =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
			return;
		}
		if (!openedOnce.current) return;
		// Radix 关闭时会自己处理一次焦点；延后一拍再覆盖，避免被还原成 body。
		window.setTimeout(() => {
			const previous = previouslyFocused.current;
			if (previous && document.contains(previous)) {
				previous.focus();
				return;
			}
			document.getElementById("global-search-trigger")?.focus();
		}, 0);
	}, [open]);

	const [recent, setRecent] = useState<string[]>(() => {
		try {
			const raw = window.localStorage.getItem(RECENT_KEY);
			const parsed: unknown = raw ? JSON.parse(raw) : [];
			return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 5) : [];
		} catch {
			return [];
		}
	});
	const location = useLocation();
	useEffect(() => {
		const hit = allNavItems.find((item) =>
			item.end
				? location.pathname === item.to
				: location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
		);
		if (!hit) return;
		setRecent((prev) => {
			if (prev[0] === hit.to) return prev;
			const next = [hit.to, ...prev.filter((path) => path !== hit.to)].slice(0, 5);
			try {
				window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
			} catch {
				/* 隐私模式：仅内存 */
			}
			return next;
		});
	}, [location.pathname, allNavItems]);
	const recentItems = useMemo(
		() =>
			recent
				.map((path) => allNavItems.find((item) => item.to === path))
				.filter((item): item is NonNullable<typeof item> => Boolean(item) && item!.to !== location.pathname),
		[recent, allNavItems, location.pathname],
	);

	const shortcutHint = platformShortcutHint();

	return (
		<CommandDialog
			open={open}
			onOpenChange={setOpen}
			title={t("shell.commandPanel")}
			description={t("shell.command.description")}
		>
			<CommandInput placeholder={t("shell.command.searchPlaceholder")} />
			<CommandList>
				<CommandEmpty>{t("shell.command.empty")}</CommandEmpty>

				{contextual.length > 0 ? (
					<>
						<CommandGroup heading={t("shell.command.contextual")}>
							{contextual.map((command) => (
								<CommandItem
									key={command.id}
									value={`${command.label} ${command.keywords ?? ""}`}
									onSelect={() => {
										setOpen(false);
										void command.run();
									}}
								>
									{command.icon}
									<span>{command.label}</span>
									{command.shortcut ? <CommandShortcut>{command.shortcut}</CommandShortcut> : null}
								</CommandItem>
							))}
						</CommandGroup>
						<CommandSeparator />
					</>
				) : null}

				{recentItems.length > 0 ? (
					<CommandGroup heading={t("shell.command.recent")}>
						{recentItems.map((item) => {
							const Icon = item.icon;
							return (
								<CommandItem
									key={`recent-${item.to}`}
									value={`${t(item.labelKey)} ${item.to} recent`}
									onSelect={() => go(item.to)}
								>
									<Icon className="size-4" aria-hidden="true" />
									<span>{t(item.labelKey)}</span>
									<CommandShortcut>{item.to}</CommandShortcut>
								</CommandItem>
							);
						})}
					</CommandGroup>
				) : null}

				{navigationGroups.map((group) => (
					<CommandGroup key={group.key} heading={group.label}>
						{group.items.map((item) => {
							const Icon = item.icon;
							return (
								<CommandItem
									key={item.to}
									value={`${t(item.labelKey)} ${item.to} ${item.descriptionKey ? t(item.descriptionKey) : ""}`}
									onSelect={() => go(item.to)}
								>
									<Icon className="size-4" aria-hidden="true" />
									<span>{t(item.labelKey)}</span>
									<CommandShortcut>{item.to}</CommandShortcut>
								</CommandItem>
							);
						})}
					</CommandGroup>
				))}

				<CommandSeparator />
				<CommandGroup heading={t("shell.command.hints")}>
					<CommandItem value="shortcuts keyboard" onSelect={() => setOpen(false)}>
						<span>{t("shell.command.openPalette")}</span>
						<CommandShortcut>{shortcutHint}</CommandShortcut>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}

/** 顶栏里的「搜索 / 命令」触发器。 */
export function CommandTrigger({ className }: { className?: string }) {
	const { t } = useTranslation();
	const { setOpen } = usePaletteStore();
	const shortcutHint = platformShortcutHint();
	return (
		<button
			type="button"
			id="global-search-trigger"
			onClick={() => setOpen(true)}
			className={className}
			aria-label={t("shell.command.openPalette")}
			title={t("shell.command.openPalette")}
		>
			<span className="inline-flex items-center gap-2 whitespace-nowrap">
				<Search className="size-4" aria-hidden="true" />
				<span className="hidden sm:inline">{t("shell.command.trigger")}</span>
			</span>
			<kbd className="hidden items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] whitespace-nowrap text-muted-foreground sm:inline-flex">
				{shortcutHint}
			</kbd>
		</button>
	);
}
