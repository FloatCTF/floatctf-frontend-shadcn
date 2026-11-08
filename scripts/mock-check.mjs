#!/usr/bin/env node
/**
 * mock 路由完整性检查（dev-only 工具，不进制品）。
 *
 * 背景：mock 是一个大 switch，靠手工编辑维护；曾经因为「按字符串下标切块」误删了
 * 24 条选手端路由，页面直接变成「没有返回数据」，但构建/类型检查都不会报错。
 *
 * 这里做两件事：
 * 1. 与 `scripts/mock-routes.snapshot.json` 比对，**路由消失即失败**（新增需 `--update` 落盘）；
 * 2. 对照 `@floatctf/sdk` 的端点模板，打印 mock 覆盖情况（仅信息，不阻断）。
 *
 * 用法：
 *   node scripts/mock-check.mjs            # 校验
 *   node scripts/mock-check.mjs --update   # 更新快照（新增路由后执行）
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mockPath = join(here, "mock-api.mjs");
const snapshotPath = join(here, "mock-routes.snapshot.json");
const sdkApiDir = resolve(here, "../../../packages/sdk/src/api");
const update = process.argv.includes("--update");

const ROUTE_RE = /\["(GET|POST|PATCH|PUT|DELETE)", \/\^(.+?)\$\/?/g;

function mockRoutes() {
	const source = readFileSync(mockPath, "utf8");
	const routes = [];
	for (const match of source.matchAll(ROUTE_RE)) {
		routes.push({ method: match[1], pattern: match[2] });
	}
	const key = (route) => `${route.method} /${route.pattern}`;
	return [...new Map(routes.map((route) => [key(route), route])).values()].sort((a, b) =>
		key(a).localeCompare(key(b)),
	);
}

/** 把 SDK 的模板字符串端点转成可匹配的示例 URL。 */
function sdkEndpoints() {
	const files = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) walk(full);
			else if (entry.endsWith(".ts") && entry !== "index.ts") files.push(full);
		}
	};
	try {
		walk(sdkApiDir);
	} catch {
		return [];
	}
	const endpoints = new Set();
	for (const file of files) {
		const source = readFileSync(file, "utf8");
		for (const match of source.matchAll(/http\.(get|post|patch|put|delete)<?[^(]*\(\s*`([^`]+)`/g)) {
			const [, method, template] = match;
			const path = template.replace(/\$\{[^}]+\}/g, "11111111-1111-4111-8111-111111111111");
			endpoints.add(`${method.toUpperCase()} /api${path}`);
		}
	}
	return [...endpoints].sort();
}

const routes = mockRoutes();
const snapshot = existsSync(snapshotPath)
	? JSON.parse(readFileSync(snapshotPath, "utf8"))
	: { routes: [] };
const currentKeys = routes.map((route) => `${route.method} /${route.pattern}`);
const snapshotKeys = snapshot.routes.map((route) => `${route.method} /${route.pattern}`);

const removed = snapshotKeys.filter((key) => !currentKeys.includes(key));
const added = currentKeys.filter((key) => !snapshotKeys.includes(key));

if (update) {
	writeFileSync(snapshotPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), routes }, null, "\t")}\n`);
	console.log(`已更新快照：${routes.length} 条路由 → ${snapshotPath}`);
} else if (removed.length > 0) {
	console.error(`mock 路由比快照少 ${removed.length} 条（可能是误删）：`);
	for (const key of removed) console.error(`  - ${key}`);
	console.error("确认是有意删除后执行：node scripts/mock-check.mjs --update");
	process.exitCode = 1;
} else {
	console.log(`mock 路由完整：${routes.length} 条${added.length ? `（新增 ${added.length} 条，可 --update 落盘）` : ""}`);
}

// SDK 覆盖情况：只做信息输出（很多端点刻意不 mock，例如 OIDC / 上传 / WebSocket）。
const regexes = routes.map((route) => ({ method: route.method, re: new RegExp(`^${route.pattern}$`) }));
const endpoints = sdkEndpoints();
const uncovered = endpoints.filter((endpoint) => {
	const [method, path] = endpoint.split(" ");
	return !regexes.some((route) => route.method === method && route.re.test(path));
});
if (endpoints.length > 0) {
	const covered = endpoints.length - uncovered.length;
	console.log(`SDK 端点覆盖（信息）：${covered}/${endpoints.length}；未 mock ${uncovered.length} 个`);
	if (process.argv.includes("--verbose")) {
		for (const endpoint of uncovered) console.log(`  · ${endpoint}`);
	}
}
