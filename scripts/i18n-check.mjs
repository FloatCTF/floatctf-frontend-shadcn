#!/usr/bin/env node
/**
 * i18n 一致性检查（docs/theme.md §8.4 / §12.5）：
 * 1. `zh` 与 `en` 的 key 集合（含嵌套路径）必须完全一致；
 * 2. 每个 key 的插值占位符集合必须一致；
 * 3. 值必须是字符串；空字符串算缺失。
 *
 * 用法：node scripts/i18n-check.mjs [--json]
 * 退出码：0 = 一致；1 = 有差异（打印全部差异）。
 */

import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

async function loadLocale(lang) {
	const dir = await mkdtemp(join(tmpdir(), "i18n-"));
	const outfile = join(dir, `${lang}.mjs`);
	try {
		await build({
			entryPoints: [join(ROOT, "src/lib/locales", `${lang}.ts`)],
			bundle: true,
			format: "esm",
			platform: "neutral",
			outfile,
			logLevel: "silent",
		});
		const mod = await import(pathToFileURL(outfile).href);
		return mod.default;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

function flatten(value, prefix = "", out = new Map()) {
	if (typeof value === "string") {
		out.set(prefix, value);
		return out;
	}
	if (value && typeof value === "object" && !Array.isArray(value)) {
		for (const [key, child] of Object.entries(value)) {
			flatten(child, prefix ? `${prefix}.${key}` : key, out);
		}
		return out;
	}
	out.set(prefix, `[non-string: ${typeof value}]`);
	return out;
}

const placeholders = (text) => new Set([...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]));

const zh = flatten(await loadLocale("zh"));
const en = flatten(await loadLocale("en"));

const problems = [];

for (const key of zh.keys()) {
	if (!en.has(key)) problems.push(`missing in en: ${key}`);
}
for (const key of en.keys()) {
	if (!zh.has(key)) problems.push(`missing in zh: ${key}`);
}

for (const [key, value] of zh) {
	if (!value.trim()) problems.push(`empty value: ${key} (zh)`);
}
for (const [key, value] of en) {
	if (!value.trim()) problems.push(`empty value: ${key} (en)`);
}

for (const key of zh.keys()) {
	if (!en.has(key)) continue;
	const a = [...placeholders(zh.get(key))].sort().join(",");
	const b = [...placeholders(en.get(key))].sort().join(",");
	if (a !== b) problems.push(`placeholder mismatch: ${key} (zh: {${a}} / en: {${b}})`);
}

// ── 3. 代码里用到的静态 key 必须存在（防止拼错 key 后静默显示原文） ─────────────
try {
	const { readFileSync } = await import("node:fs");
	const { execSync } = await import("node:child_process");
	const files = execSync("grep -rlE 't\\(\\s*[\"\`]' src --include='*.tsx' --include='*.ts' || true")
		.toString()
		.trim()
		.split("\n")
		.filter(Boolean);
	const used = new Set();
	for (const file of files) {
		const text = readFileSync(file, "utf8");
		for (const m of text.matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(m[1]);
	}
	for (const key of used) {
		if (!zh.has(key) && !en.has(key)) problems.push(`missing key used in code: ${key}`);
	}
} catch (error) {
	console.warn(`[i18n] 跳过 key 使用检查：${error instanceof Error ? error.message : error}`);
}

const json = process.argv.includes("--json");
if (json) {
	console.log(JSON.stringify({ ok: problems.length === 0, problems, zhKeys: zh.size, enKeys: en.size }, null, 2));
} else if (problems.length === 0) {
	console.log(`i18n OK — zh ${zh.size} keys, en ${en.size} keys`);
} else {
	console.error(`i18n 不一致（${problems.length} 处）：`);
	for (const line of problems) console.error(`  - ${line}`);
	process.exitCode = 1;
}
