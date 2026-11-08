/**
 * 路由与鉴权守卫 —— 平台级要求：受保护内容不得闪现，401 必须引导重新登录。
 * 守卫只做「有没有对应作用域的 token」判定；真实权限由后端接口决定（403 会显式展示）。
 */

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useIsAdminAuthenticated, useIsUserAuthenticated } from "~/auth/store";
import { safeNextPath } from "~/lib/safe-next";

function currentPath(): string {
	if (typeof window === "undefined") return "/";
	return `${window.location.pathname}${window.location.search}`;
}

export function RequireUser({ children }: { children: ReactNode }) {
	const authenticated = useIsUserAuthenticated();
	const location = useLocation();
	if (!authenticated) {
		const next = safeNextPath(`${location.pathname}${location.search}`, "/");
		return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
	}
	return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
	const authenticated = useIsAdminAuthenticated();
	const location = useLocation();
	if (!authenticated) {
		const next = safeNextPath(`${location.pathname}${location.search}`, "/admin");
		return <Navigate to={`/admin/login?next=${encodeURIComponent(next)}`} replace />;
	}
	return <>{children}</>;
}

/** 已登录用户访问登录 / 注册页时回到 `next` 或首页。 */
export function RedirectIfAuthenticated({
	children,
	scope = "user",
	to = "/",
}: {
	children: ReactNode;
	scope?: "user" | "admin";
	to?: string;
}) {
	const location = useLocation();
	const user = useIsUserAuthenticated();
	const admin = useIsAdminAuthenticated();
	const authenticated = scope === "admin" ? admin : user;
	if (authenticated) {
		// 用 router 的 location 而不是 window.location.search：
		// 登录成功时 onSuccess 与守卫会在同一次提交里各跳一次，读 window 会读到已跳走的 URL，
		// 于是 next 丢失、被兜底到 "/"（曾经导致 ?next= 深链失效）。
		const params = new URLSearchParams(location.search);
		return <Navigate to={safeNextPath(params.get("next"), to)} replace />;
	}
	return <>{children}</>;
}

export { currentPath };
