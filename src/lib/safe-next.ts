/**
 * 登录后回跳目标的白名单化。
 *
 * 只接受**同源绝对路径**：
 * - 拒绝 `//evil.com`（协议相对 URL，会被浏览器当成外站）；
 * - 拒绝 `/\evil.com` 之类的反斜杠变体；
 * - 拒绝登录 / 注册 / 重置页本身，避免 `next=/login` 造成重定向环。
 */

const AUTH_ENTRY_PATHS = new Set([
	"/login",
	"/register",
	"/forgot",
	"/reset",
	"/admin/login",
]);

export function safeNextPath(
	raw: string | null | undefined,
	fallback: string,
): string {
	if (!raw || !raw.startsWith("/")) return fallback;
	if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
	const path = raw.split(/[?#]/, 1)[0] ?? "";
	if (AUTH_ENTRY_PATHS.has(path)) return fallback;
	return raw;
}
