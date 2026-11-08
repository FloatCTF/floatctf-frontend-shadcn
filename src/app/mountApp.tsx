/**
 * 应用挂载 —— 把 React 应用挂到 `context.root`，并返回清理函数。
 * 一次 `mount` 一套实例：客户端 / QueryClient / 路由 / 主题监听全部独立，卸载即回收。
 */

import type { FloatCTFMountContext } from "@floatctf/frontend-runtime";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { createRuntime, setUnauthorizedHandler } from "~/api/client";
// i18n 必须在任何页面渲染前初始化（react-i18next 的全局单例）。
import "~/lib/i18n";
import { initTheme } from "~/lib/theme";
import { safeNextPath } from "~/lib/safe-next";

import { AppProviders, ErrorBoundary } from "./providers";
import { createAppRouter } from "./router";

export function mountApp(context: FloatCTFMountContext): () => void {
	const disposeTheme = initTheme();
	const runtime = createRuntime(context);
	const router = createAppRouter();

	// 401 之后的动作由前端决定（SDK 不导航）：清 token 已在 store 层完成，这里只负责引导登录。
	setUnauthorizedHandler((scope, next) => {
		// 登录页本身也可能因为残留 token / 并发请求收到 401；此时再“引导去登录”
		// 会把 /login?next=... 继续套娃成无限重定向。认证入口不再二次跳转。
		const path = next.split(/[?#]/, 1)[0] ?? "";
		if (
			path === "/login" ||
			path === "/admin/login" ||
			path === "/register" ||
			path === "/forgot" ||
			path === "/reset"
		) {
			return;
		}
		const fallback = scope === "admin" ? "/admin" : "/";
		const encoded = encodeURIComponent(safeNextPath(next, fallback));
		void router.navigate(
			scope === "admin" ? `/admin/login?next=${encoded}` : `/login?next=${encoded}`,
		);
	});

	const root = createRoot(context.root);
	root.render(
		<ErrorBoundary>
			<AppProviders runtime={runtime}>
				<RouterProvider router={router} />
			</AppProviders>
		</ErrorBoundary>,
	);

	return () => {
		setUnauthorizedHandler(null);
		disposeTheme();
		root.unmount();
		runtime.queryClient.clear();
	};
}
