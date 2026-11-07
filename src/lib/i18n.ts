/**
 * i18n 基础设施 —— 所有用户可见文本走 `t()`（docs/theme.md §8.4 / 铁律 10）。
 *
 * 资源按域分组（namespace 即域：`common` / `nav` / `auth` / `events` / …），
 * key 语义化；新增文案必须同时补 zh 与 en。默认语言 zh-CN，
 * 偏好持久化到 localStorage，切换时同步 `<html lang>`。
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en";
import zh from "./locales/zh";

export const SUPPORTED_LOCALES = ["zh-CN", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = "shadcn.locale";

function readStoredLocale(): Locale {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY);
		if (value === "en" || value === "zh-CN") return value;
	} catch {
		/* 忽略存储失败 */
	}
	// 中文为第一语言（theme.md §8.1）；英文由用户在切换器里显式选择。
	return "zh-CN";
}

export function getLocale(): Locale {
	return (i18n.language as Locale) ?? "zh-CN";
}

/** 切换语言并持久化；同步 `<html lang>` 便于浏览器与辅助技术识别。 */
export async function setLocale(next: Locale): Promise<void> {
	await i18n.changeLanguage(next);
	try {
		window.localStorage.setItem(STORAGE_KEY, next);
	} catch {
		/* 忽略存储失败 */
	}
	document.documentElement.lang = next;
}

void i18n.use(initReactI18next).init({
	// 域资源全部挂在**默认 translation 命名空间**下的嵌套键里：
	// `t("events.list.title")` → translation.events.list.title。
	resources: { "zh-CN": { translation: zh }, en: { translation: en } },
	lng: typeof window === "undefined" ? "zh-CN" : readStoredLocale(),
	fallbackLng: "zh-CN",
	// 开发环境及早暴露缺失 key（控制台警告），生产静默回退。
	saveMissing: import.meta.env.DEV,
	missingKeyHandler: import.meta.env.DEV
		? (_lngs, _ns, key) => {
				if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
			}
		: undefined,
	interpolation: { escapeValue: false },
	react: { useSuspense: false },
});

if (typeof document !== "undefined") {
	document.documentElement.lang = i18n.language;
}

export default i18n;
