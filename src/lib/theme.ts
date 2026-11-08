/**
 * 主题偏好 —— 归本前端所有（平台不关心）。
 * **亮色是默认**（docs/theme.md §2.4）：dark/light 二态切换，system 不作为持久偏好
 * （system 只是「未做过选择」时的初始探测 —— 首屏脚本的行为与此处保持一致）。
 * 写入 localStorage，切换 `<html class="dark">` 并同步 `color-scheme`。
 */

import { useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "shadcn.theme";
const MEDIA = "(prefers-color-scheme: dark)";

function readStored(): ThemePreference {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY);
		// 显式选择过的值才生效；没选过 = 默认亮色（与 index.html 首屏脚本一致）。
		if (value === "dark" || value === "light") return value;
	} catch {
		/* 隐私模式：退化为默认值 */
	}
	return "light";
}

let preference: ThemePreference = typeof window === "undefined" ? "light" : readStored();
const listeners = new Set<() => void>();

/** 把主题写到 <html class="dark">，与 globals.css 的变量切换保持一致。 */
function apply(): void {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.toggle("dark", preference === "dark");
	root.style.colorScheme = preference;
}

function emit(): void {
	for (const listener of listeners) listener();
}

export function getThemePreference(): ThemePreference {
	return preference;
}

export function setThemePreference(next: ThemePreference): void {
	preference = next;
	try {
		window.localStorage.setItem(STORAGE_KEY, next);
	} catch {
		/* 忽略存储失败 */
	}
	apply();
	emit();
}

/** 在 mount 时调用一次：应用已存偏好并跟随系统变化（仅当用户未显式选择时）。 */
export function initTheme(): () => void {
	apply();
	if (typeof window === "undefined" || !window.matchMedia) return () => {};
	const media = window.matchMedia(MEDIA);
	const onChange = () => {
		try {
			// 只有用户没做过显式选择时才跟随系统（显式选择存在 localStorage 里）。
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (stored !== "dark" && stored !== "light") {
				preference = media.matches ? "dark" : "light";
				apply();
				emit();
			}
		} catch {
			/* localStorage 不可用：保持当前偏好 */
		}
	};
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
}

export function useTheme(): ThemePreference {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		() => preference,
		() => "light" as ThemePreference,
	);
}

/** 供 sonner 等第三方组件读取「当前生效主题」（theme.md §2.4：禁止固定亮色）。 */
export function useResolvedTheme(): ThemePreference {
	return useTheme();
}
