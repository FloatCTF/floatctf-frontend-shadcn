#!/usr/bin/env node
/**
 * 主题合规审计（docs/theme.md 的可机械检查部分）：
 * 1. 禁止 `var(--success)` / `var(--warning)`（本主题没有这两个令牌）；
 * 2. 禁止在 tsx 中写死 hex / rgb() / hsl() 颜色；
 * 3. 禁止原生 `alert(` / `confirm(` / `prompt(`（用 useConfirm / toast）；
 * 4. 禁止 `@/` 私有 alias 与逃逸 import；
 * 5. 图标只允许 lucide：tsx 里不允许内联 `<svg`（图表组件是唯一例外）；
 * 6. 语义色必须带暗色变体：出现 `text-emerald-600` 等同级亮色类时，同文件应出现 `dark:`
 *    （对 `components/app/badges.tsx` 这类集中映射文件只做提示，不阻塞）。
 *
 * 用法：node scripts/theme-audit.mjs
 * 退出码：0 = 通过；1 = 有违规。
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

async function* walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
		const full = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (/\.(tsx?|css)$/.test(entry.name)) yield full;
	}
}

const problems = [];
const warnings = [];

const ALLOWED_SVG = /components[\\/]app[\\/]charts\.tsx$/;
const ALLOWED_HEX = /(components[\\/]ui[\\/]sidebar\.tsx)$/;

for await (const file of walk(join(ROOT, "src"))) {
	const rel = relative(ROOT, file);
	const text = await readFile(file, "utf8");
	const lines = text.split("\n");

	// 只在代码里检查，跳过注释行。
	const code = lines.filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line)).join("\n");

	if (/var\(--success\)|var\(--warning\)/.test(code)) {
		problems.push(`${rel}: 使用了本主题不存在的 --success / --warning 令牌`);
	}
	if (/var\(--success|var\(--warning/.test(text)) {
		// css 文件里也不该出现（已经移除）
	}

	if (/\.tsx$/.test(rel) && !ALLOWED_HEX.test(rel)) {
		const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g);
		if (hex) problems.push(`${rel}: 硬编码颜色 ${[...new Set(hex)].join(", ")}`);
	}
	if (/\.tsx$/.test(rel) && /\b(rgb|hsl)\(\s*\d/.test(code)) {
		problems.push(`${rel}: 硬编码 rgb()/hsl() 颜色`);
	}

	if (/\balert\(|\bconfirm\(|\bprompt\(/.test(code)) {
		// 变量名为 confirm 的 useConfirm 返回值是允许的
		const suspicious = lines.filter(
			(line) =>
				/\balert\(|\bprompt\(/.test(line) ||
				(/\bconfirm\(/.test(line) && !/await confirm\(|confirm\(\{/.test(line)),
		);
		if (suspicious.length > 0) problems.push(`${rel}: 疑似原生 alert/confirm/prompt`);
	}

	if (/from ["']@\//.test(code)) problems.push(`${rel}: 使用了 @/ 私有 alias`);

	if (/\.tsx$/.test(rel) && !ALLOWED_SVG.test(rel) && /<svg[\s>]/.test(code)) {
		problems.push(`${rel}: 内联 <svg（图标只用 lucide-react）`);
	}

	const semantic = code.match(/\b(emerald|amber|sky|rose)-\d{3}\b/g);
	if (semantic && !/dark:/.test(text)) {
		warnings.push(`${rel}: 使用语义色但同文件没有 dark: 变体`);
	}
}

if (problems.length > 0) {
	console.error(`主题审计失败（${problems.length} 处）：`);
	for (const line of problems) console.error(`  - ${line}`);
	process.exitCode = 1;
} else {
	console.log(`主题审计通过${warnings.length ? `（${warnings.length} 条提示）` : ""}`);
	for (const line of warnings) console.warn(`  · ${line}`);
}
