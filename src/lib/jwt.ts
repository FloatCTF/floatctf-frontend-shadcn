/**
 * 只读解析 JWT 的 `sub`（当前账号 ID）。
 *
 * 背景：管理端与选手端 token 作用域分离，管理端没有「我是谁」的独立端点；
 * `GET /users/me` 只认选手端 token。如果管理端会话没有同时登录选手端，
 * 用选手端请求去取 `me` 会 401，并触发 `onUnauthorized("user")` 清掉选手 token
 * ——在管理页面上制造一次莫名其妙的登出。
 *
 * 这里只做**展示用**的 claims 读取：不做验签、不把 token 写入任何日志或 URL。
 * 服务端仍是唯一的授权来源；解析失败一律返回 null。
 */

function base64UrlDecode(value: string): string | null {
	try {
		const padded = value.replace(/-/g, "+").replace(/_/g, "/");
		const withPadding = padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "=");
		return atob(withPadding);
	} catch {
		return null;
	}
}

export function jwtSubject(token: string | null | undefined): string | null {
	if (!token) return null;
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const payload = base64UrlDecode(parts[1]);
	if (!payload) return null;
	try {
		const claims = JSON.parse(payload) as { sub?: unknown };
		return typeof claims.sub === "string" && claims.sub.length > 0 ? claims.sub : null;
	} catch {
		return null;
	}
}
