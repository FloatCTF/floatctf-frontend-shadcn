#!/usr/bin/env node
/**
 * ⚠️ 仅用于本地 UI 预览的 **mock API**（不是平台后端，也不进制品）。
 *
 * 目的：本机没有 Postgres/Redis/API 时，让前端能跑起来看「里面」长什么样。
 * 它挂在 Vite `/api` 代理的目标端口（默认 7780），因此页面走的是**真实前端代码路径**，
 * 只是响应来自这里的内存数据。
 *
 * 约束（与 docs/theme.md / AGENTS.md 的「禁止假数据」一致）：
 * - 这些数据**只在开发预览期存在**，绝不打包进 dist/（脚本不在 src/，构建不引用）；
 * - 截图/演示必须标注「mock」；
 * - 不实现写操作的真实语义（mutation 返回成功但内存里不留痕），避免被误当作可用的后端。
 *
 * 用法：
 *   node scripts/mock-api.mjs [--port 7780]
 *   # 另开一个终端：pnpm dev（Vite 会把 /api 代理到这里）
 */

import http from "node:http";

const PORT = Number(process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : 7780);
const now = Date.now();
const H = 3600 * 1000;
const D = 24 * H;
const iso = (ms) => new Date(ms).toISOString();

// ── mock 数据 ────────────────────────────────────────────────────────────────
const me = {
	id: "8f1c2d7a-0001-4a11-9a11-000000000001",
	username: "2024001",
	nickname: "李明",
	email: "liming@example.edu",
	avatar: null,
	created_at: iso(now - 90 * D),
	updated_at: iso(now - 2 * D),
	permissions: [],
	grants_all: true,
};

const events = [
	{
		id: "e0a1b2c3-0001-4a11-9a11-000000000001",
		title: "2026 春季校内赛 · Jeopardy",
		description: "面向全校的解题赛，题目覆盖 Web / Pwn / Crypto / Misc。",
		hidden: false,
		start_time: iso(now - 3 * H),
		end_time: iso(now + 21 * H),
		rules: "禁止攻击比赛平台；禁止交换 flag；每队最多 4 人。",
		allow_join: true,
		flag_prefix: "flag{",
		created_at: iso(now - 10 * D),
		updated_at: iso(now - 2 * H),
		family: "jeopardy",
		purpose: "competition",
		participant_mode: "individual",
		is_virtual: false,
	},
	{
		id: "e0a1b2c3-0002-4a11-9a11-000000000002",
		title: "AWD 联赛 第 3 轮",
		description: "攻防对抗：每轮提交对手 flag，同时守住自己的 GameBox。",
		hidden: false,
		start_time: iso(now - 40 * 60000),
		end_time: iso(now + 2 * H),
		rules: "只允许通过比赛网络访问；禁止 DoS。",
		allow_join: true,
		flag_prefix: "flag{",
		created_at: iso(now - 6 * D),
		updated_at: iso(now - 30 * 60000),
		family: "awd",
		purpose: "competition",
		participant_mode: "team",
		is_virtual: false,
	},
	{
		id: "e0a1b2c3-0003-4a11-9a11-000000000003",
		title: "AWDP 自动化攻防 · 练习",
		description: "自动化攻防练习赛：Break / Fix 轮次与自动评测。",
		hidden: false,
		start_time: iso(now - 4 * D),
		end_time: null,
		rules: "练习赛不计入正式排名。",
		allow_join: true,
		flag_prefix: "flag{",
		created_at: iso(now - 20 * D),
		updated_at: iso(now - 4 * D),
		family: "awdp",
		purpose: "practice",
		participant_mode: "individual",
		is_virtual: false,
	},
];

const challenges = [
	{
		id: "c-0001",
		name: "签到：你好 CTF",
		safe_name: "hello-ctf",
		category: "Misc",
		description: "把一个 Base64 串解出来就是 flag。",
		hidden: false,
		version: "1.0.0",
		author: "组委会",
		created_at: iso(now - 9 * D),
		updated_at: iso(now - 9 * D),
		recommended_cpu_millis: 100,
		recommended_memory_bytes: 134217728,
		recommended_pids_limit: 64,
		build_status: "ready",
		solved: true,
	},
	{
		id: "c-0002",
		name: "Notes 越权读取",
		safe_name: "notes-idor",
		category: "Web",
		description: "一个笔记应用：注意 `GET /api/notes/{id}` 的鉴权实现。",
		hidden: false,
		version: "1.2.3",
		author: "web-team",
		created_at: iso(now - 8 * D),
		updated_at: iso(now - 3 * D),
		recommended_cpu_millis: 200,
		recommended_memory_bytes: 268435456,
		recommended_pids_limit: 64,
		container_port: 8080,
		build_status: "ready",
		solved: true,
	},
	{
		id: "c-0003",
		name: "栈溢出：返回地址",
		safe_name: "pwn-ret2win",
		category: "Pwn",
		description: "32 位程序存在栈溢出，跳转到 win 函数。",
		hidden: false,
		version: "1.0.1",
		author: "pwn-team",
		created_at: iso(now - 8 * D),
		updated_at: iso(now - 5 * D),
		recommended_cpu_millis: 500,
		recommended_memory_bytes: 536870912,
		recommended_pids_limit: 128,
		container_port: 1337,
		build_status: "ready",
		solved: false,
	},
	{
		id: "c-0004",
		name: "RSA 小公钥",
		safe_name: "rsa-small-e",
		category: "Crypto",
		description: "e=3 且明文很短，试一下开方。",
		hidden: false,
		version: "1.0.0",
		author: "crypto-team",
		created_at: iso(now - 7 * D),
		updated_at: iso(now - 7 * D),
		recommended_cpu_millis: 100,
		recommended_memory_bytes: 134217728,
		recommended_pids_limit: 32,
		build_status: "ready",
		solved: false,
	},
	{
		id: "c-0005",
		name: "流量分析：可疑 DNS",
		safe_name: "pcap-dns",
		category: "Forensics",
		description: "在 pcap 里找出被外带的数据。",
		hidden: false,
		version: "1.1.0",
		author: "forensics-team",
		created_at: iso(now - 6 * D),
		updated_at: iso(now - 2 * D),
		recommended_cpu_millis: 100,
		recommended_memory_bytes: 134217728,
		recommended_pids_limit: 32,
		build_status: "ready",
		solved: true,
	},
	{
		id: "c-0006",
		name: "逆向：魔改校验",
		safe_name: "rev-check",
		category: "Reverse",
		description: "程序把输入做了逐字节变换，恢复原始字符串。",
		hidden: false,
		version: "1.0.0",
		author: "rev-team",
		created_at: iso(now - 5 * D),
		updated_at: iso(now - 5 * D),
		recommended_cpu_millis: 200,
		recommended_memory_bytes: 268435456,
		recommended_pids_limit: 64,
		build_status: "ready",
		solved: false,
	},
];

const eventChallenges = challenges.map((challenge, index) => ({
	id: challenge.id,
	challenge,
	current_points: [500, 450, 430, 410, 380, 350][index] ?? 300,
	solved_count: [42, 31, 18, 12, 9, 4][index] ?? 0,
	solved: [true, true, false, false, true, false][index] ?? false,
	solved_no: [7, 12, 0, 0, 21, 0][index] ?? 0,
}));

const teams = [
	["0x7f", 4820, 9],
	["NOP Sled", 4410, 8],
	["SegFault Club", 3980, 7],
	["Byte Me", 3520, 6],
	["午夜场", 3120, 6],
	["李明", 2450, 3],
	["Kernel Panic", 2210, 4],
	["Stack Smashers", 1980, 3],
	["Null Pointer", 1760, 2],
	["Hex Hazard", 1540, 2],
];

const scoreboard = teams.map(([name, score, solved], index) => ({
	id: `team-${index}`,
	no: index + 1,
	name,
	score,
	solved_count: solved,
	challenges: challenges.map((challenge, ci) => ({
		name: challenge.name,
		solved: ci < solved,
		solved_no: ci < solved ? index + 1 : 0,
	})),
}));

const trendNames = teams.slice(0, 5).map(([name]) => name);
const trend = trendNames.map((name, index) => ({
	name,
	points: Array.from({ length: 12 }, (_, hour) => ({
		name,
		score: (index + 1) * 220 + hour * (90 - index * 12) + (index % 2 ? hour * hour * 2 : 0),
		time: iso(now - (11 - hour) * H),
	})),
}));

const topUsers = teams.slice(0, 15).map(([name, score, solved], index) => ({
	no: index + 1,
	nickname: name,
	solved_count: solved,
	solved_last_at: iso(now - index * 40 * 60000),
}));

const announcements = [
	{
		id: "a-1",
		title: "比赛环境升级完成",
		content: "所有题目的容器已重建，若遇到实例异常请在讨论区反馈。",
		publisher: "组委会",
		publisher_id: undefined,
		created_at: iso(now - 5 * H),
		updated_at: iso(now - 5 * H),
	},
	{
		id: "a-2",
		title: "Flag 格式说明",
		content: "本题库统一使用 flag{...} 格式，提交时不需要包含前缀以外的空白。",
		publisher: "组委会",
		publisher_id: undefined,
		created_at: iso(now - 2 * D),
		updated_at: iso(now - 2 * D),
	},
];

const solves = [
	["李明", "签到：你好 CTF", 500],
	["0x7f", "Notes 越权读取", 450],
	["NOP Sled", "栈溢出：返回地址", 430],
	["李明", "流量分析：可疑 DNS", 380],
].map(([nickname, challengeName, points], index) => ({
	id: `solve-${index}`,
	event_id: events[0].id,
	challenge_id: `c-000${index + 1}`,
	challenge_name: challengeName,
	nickname,
	user_id: `u-${index}`,
	team_id: null,
	obtained_points: points,
	bonus_points: 0,
	created_at: iso(now - (index + 1) * 37 * 60000),
	updated_at: iso(now - (index + 1) * 37 * 60000),
}));

const discussions = [
	{
		id: "d-1",
		title: "Pwn 第三题的环境连不上？",
		content: "重启了两次实例，`nc` 仍然超时，其他人有遇到吗？",
		author_id: "u-2",
		author_nickname: "NOP Sled",
		author_avatar: null,
		likes: 6,
		comments_count: 3,
		created_at: iso(now - 90 * 60000),
		updated_at: iso(now - 30 * 60000),
	},
	{
		id: "d-2",
		title: "分享一个 RSA 小技巧",
		content: "当 e 很小且明文短时，直接对密文开 e 次方即可，不需要分解 n。",
		author_id: "u-3",
		author_nickname: "SegFault Club",
		author_avatar: null,
		likes: 12,
		comments_count: 5,
		created_at: iso(now - 6 * H),
		updated_at: iso(now - 2 * H),
	},
];

const writeups = [
	{
		id: "w-1",
		challenge_id: "c-0002",
		challenge_name: "Notes 越权读取",
		author: "李明",
		author_id: me.id,
		content: "## 思路\n\n接口只校验了登录态，没有校验 note 的归属。\n\n```bash\ncurl -H 'Authorization: Bearer <token>' /api/notes/2\n```",
		created_at: iso(now - 26 * H),
		updated_at: iso(now - 26 * H),
	},
];

const adminEvents = events.map((event, index) => ({
	...event,
	// 管理端还有一些统计字段；缺省时页面按空值渲染
	event_challenge_count: index === 0 ? challenges.length : 0,
	event_user_count: index === 0 ? 42 : 12,
}));

const dashboardSummary = {
	stats: {
		users: 128,
		events: events.length,
		challenges: challenges.length,
		weapons: 6,
		announcements: announcements.length,
		discussions: discussions.length,
		instances: 17,
		gameboxes: 6,
	},
	attention: {
		failed_tasks: [
			{
				task_name: "平台课程同步",
				task_key: "platform.training.sync",
				error_msg: "network timeout（示例）",
				attempt_count: 2,
				max_attempts: 3,
				updated_at: iso(now - 40 * 60000),
			},
		],
		error_logs_24h: 3,
		awd_alerts: [],
	},
	events: events.map((event) => ({
		event_id: event.id,
		title: event.title,
		family: event.family,
		purpose: event.purpose,
		participant_mode: event.participant_mode,
		start_time: event.start_time,
		end_time: event.end_time,
		hidden: event.hidden,
		awd:
			event.family === "awd"
				? { status: "running", phase: "attack", started_at: event.start_time }
				: null,
	})),
	activity: {
		recent_solves: solves.slice(0, 4).map((solve) => ({
			nickname: solve.nickname,
			avatar: null,
			challenge_name: solve.challenge_name,
			solved_at: solve.created_at,
		})),
		recent_signups: [
			{ nickname: "李明", username: "2024001", avatar: null, created_at: iso(now - 2 * D) },
			{ nickname: "Byte Me", username: "2024007", avatar: null, created_at: iso(now - 3 * D) },
		],
	},
};

// ── 服务器 ───────────────────────────────────────────────────────────────────
const json = (res, status, body) => {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"access-control-allow-origin": "*",
		"access-control-allow-headers": "*",
		"access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
	});
	res.end(JSON.stringify(body));
};

const ok = (res, data, req) => {
	const url = new URL(req?.url ?? "/", "http://localhost");
	const limit = Number(url.searchParams.get("limit") ?? 20);
	const page = Number(url.searchParams.get("page") ?? 1);
	const meta = {
		offset: (page - 1) * limit,
		limit,
		page,
		filter: null,
		total: Array.isArray(data) ? data.length : 0,
	};
	json(res, 200, { code: 0, message: "OK", data, meta: Array.isArray(data) ? meta : null });
};

const routes = [
	// 认证 / 账号
	["POST", /^\/api\/session$/, (_m, res) => ok(res, "mock-token-0001")],
	["POST", /^\/api\/users$/, (_m, res) => ok(res, "mock-token-0001")],
	["POST", /^\/api\/users\/reset_password$/, (_m, res) => ok(res, "ok")],
	["POST", /^\/api\/users\/reset$/, (_m, res) => ok(res, "ok")],
	["GET", /^\/api\/users\/me$/, (_m, res) => ok(res, me)],
	["PATCH", /^\/api\/users\/me$/, (_m, res) => ok(res, null)],

	// 赛事
	["GET", /^\/api\/events$/, (_m, res, req) =>
		ok(res, events.map((event) => ({ id: event.id, event, joined: true })), req)],
	["GET", /^\/api\/events\/([^/]+)$/, (m, res) => {
		const event = events.find((item) => item.id === m[1]) ?? events[0];
		ok(res, { id: event.id, event, joined: true });
	}],
	["GET", /^\/api\/events\/([^/]+)\/challenges$/, (_m, res, req) => ok(res, eventChallenges, req)],
	["GET", /^\/api\/events\/([^/]+)\/scoreboard$/, (_m, res) => ok(res, scoreboard)],
	["GET", /^\/api\/events\/([^/]+)\/trend$/, (_m, res) => ok(res, trend)],
	["GET", /^\/api\/events\/([^/]+)\/announcements$/, (_m, res, req) => ok(res, announcements, req)],
	["GET", /^\/api\/events\/([^/]+)\/instances$/, (_m, res) => ok(res, [])],
	["GET", /^\/api\/events\/([^/]+)\/own_wp$/, (_m, res) => ok(res, [])],
	["POST", /^\/api\/events\/([^/]+)\/join$/, (_m, res) => ok(res, null)],
	["DELETE", /^\/api\/events\/([^/]+)\/leave$/, (_m, res) => ok(res, null)],

	// 题目
	["GET", /^\/api\/challenges$/, (_m, res, req) => ok(res, challenges, req)],
	["GET", /^\/api\/challenges\/([^/]+)$/, (m, res) => {
		ok(res, challenges.find((item) => item.id === m[1]) ?? challenges[0]);
	}],
	["GET", /^\/api\/challenges\/([^/]+)\/instance$/, (_m, res) => ok(res, null)],
	["GET", /^\/api\/challenges\/([^/]+)\/writeups$/, (_m, res, req) => ok(res, writeups, req)],
	["GET", /^\/api\/challenges\/([^/]+)\/my_writeup$/, (_m, res) => ok(res, null)],
	["POST", /^\/api\/challenges\/([^/]+)\/submit$/, (_m, res) => ok(res, { correct: true, points: 500 })],
	["GET", /^\/api\/challenge_sets$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/challenge_sets\/([^/]+)$/, (_m, res) => ok(res, null)],

	// 社区
	["GET", /^\/api\/announcements$/, (_m, res, req) => ok(res, announcements, req)],
	["GET", /^\/api\/solves$/, (_m, res, req) => ok(res, solves, req)],
	["GET", /^\/api\/solves\/top15users$/, (_m, res) => ok(res, topUsers)],
	["GET", /^\/api\/writeups$/, (_m, res, req) => ok(res, writeups, req)],
	["GET", /^\/api\/discussions$/, (_m, res, req) => ok(res, discussions, req)],
	["GET", /^\/api\/discussions\/([^/]+)$/, (m, res) => {
		ok(res, discussions.find((item) => item.id === m[1]) ?? discussions[0]);
	}],
	["GET", /^\/api\/discussions\/([^/]+)\/comments$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/weapons$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/instances$/, (_m, res, req) => ok(res, [], req)],

	// AWD 驾驶舱
	["GET", /^\/api\/events\/([^/]+)\/awd\/status$/, (m, res) =>
		ok(res, {
			event_id: m[1],
			status: "running",
			phase: "attack",
			current_round: 3,
			round_count: 8,
			banned: false,
			score: 1240,
			final_settlement: false,
		})],
	["GET", /^\/api\/events\/([^/]+)\/awd\/gameboxes$/, (_m, res) =>
		ok(res, [
			{
				id: "gb-1",
				team_id: "team-6",
				event_gamebox_id: "egb-1",
				gamebox_name: "web-01",
				status: "running",
				gamebox_ip: "10.42.16.11",
				container_name: "fctf-awd-e2-t6-web01",
				health_status: "healthy",
			},
			{
				id: "gb-2",
				team_id: "team-6",
				event_gamebox_id: "egb-2",
				gamebox_name: "pwn-01",
				status: "running",
				gamebox_ip: "10.42.16.12",
				container_name: "fctf-awd-e2-t6-pwn01",
				health_status: "healthy",
			},
		])],
	["GET", /^\/api\/events\/([^/]+)\/awd\/scores$/, (_m, res) =>
		ok(res, teams.map(([name, score], index) => ({
			team_id: `team-${index}`,
			team_name: name,
			attack_score: Math.round(score * 0.55),
			defense_score: Math.round(score * 0.45),
			total_score: score,
			rank: index + 1,
		})))],
	["POST", /^\/api\/events\/([^/]+)\/awd\/submissions$/, (_m, res) => ok(res, null)],
	["POST", /^\/api\/events\/([^/]+)\/awd\/gameboxes\/([^/]+)\/reset$/, (_m, res) => ok(res, null)],

	// 管理端
	["GET", /^\/api\/admin\/dashboard\/summary$/, (_m, res) => ok(res, dashboardSummary)],
	["GET", /^\/api\/admin\/events$/, (_m, res, req) => ok(res, adminEvents, req)],
	["GET", /^\/api\/admin\/events\/([^/]+)$/, (m, res) => {
		ok(res, adminEvents.find((item) => item.id === m[1]) ?? adminEvents[0]);
	}],
	["GET", /^\/api\/admin\/events\/([^/]+)\/data$/, (_m, res) => ok(res, {})],
	["GET", /^\/api\/admin\/challenges$/, (_m, res, req) => ok(res, challenges, req)],
	["GET", /^\/api\/admin\/challenge_sets$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/admin\/users$/, (_m, res, req) =>
		ok(
			res,
			[
				{ ...me, permissions: undefined, grants_all: undefined },
				{
					id: "u-2",
					username: "2024007",
					nickname: "Byte Me",
					email: "byte@example.edu",
					avatar: null,
					created_at: iso(now - 30 * D),
					updated_at: iso(now - 30 * D),
				},
			],
			req,
		)],
	["GET", /^\/api\/admin\/users\/([^/]+)\/roles$/, (m, res) =>
		ok(res, { user_id: m[1], username: me.username, roles: [], permissions: [] })],
	["GET", /^\/api\/admin\/permissions$/, (_m, res) =>
		ok(res, [
			{ key: "events.manage", domain: "事件", description: "管理赛事", high_risk: false },
			{ key: "users.manage", domain: "身份", description: "管理账号", high_risk: true },
			{ key: "roles.manage", domain: "身份", description: "管理角色与权限", high_risk: true },
		])],
	["GET", /^\/api\/admin\/permissions\/domains$/, (_m, res) => ok(res, ["事件", "身份"])],
	["GET", /^\/api\/admin\/roles$/, (_m, res) =>
		ok(res, [
			{
				id: "r-1",
				key: "super-admin",
				name: "超级管理员",
				description: "拥有全部权限",
				protected: true,
				grants_all: true,
				permissions: [],
				user_count: 1,
			},
		])],
	["GET", /^\/api\/admin\/logs$/, (_m, res, req) =>
		ok(
			res,
			[
				{
					id: "log-1",
					ip_address: "10.0.0.8",
					category: "auth",
					action: "session.login",
					level: "info",
					message: "用户登录成功",
					details: "",
					created_at: iso(now - 12 * 60000),
					actor_user_id: me.id,
				},
			],
			req,
		)],
	["GET", /^\/api\/admin\/settings$/, (_m, res, req) =>
		ok(
			res,
			[
				{
					id: "s-1",
					key: "FRONTEND_ACTIVE",
					value: "shadcn",
					type: "string",
					description: "当前激活的前端",
					protected: false,
					created_at: iso(now - 30 * D),
					updated_at: iso(now - 30 * D),
				},
			],
			req,
		)],
	["GET", /^\/api\/admin\/scheduled_tasks$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/admin\/system\/version$/, (_m, res) => ok(res, "1.0.6")],
	["GET", /^\/api\/admin\/system\/monitor$/, (_m, res) => ok(res, null)],
	["GET", /^\/api\/admin\/docker\/containers$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/admin\/docker\/images$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/admin\/docker\/networks$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/admin\/announcements$/, (_m, res, req) => ok(res, announcements, req)],
	["GET", /^\/api\/admin\/discussions$/, (_m, res, req) => ok(res, discussions, req)],
	["GET", /^\/api\/admin\/weapons$/, (_m, res, req) => ok(res, [], req)],
];

const server = http.createServer((req, res) => {
	if (req.method === "OPTIONS") {
		res.writeHead(204, {
			"access-control-allow-origin": "*",
			"access-control-allow-headers": "*",
			"access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
		});
		return res.end();
	}
	const path = (req.url ?? "").split("?")[0];
	for (const [method, pattern, handler] of routes) {
		if (method !== req.method) continue;
		const match = pattern.exec(path);
		if (match) {
			try {
				return handler(match, res, req);
			} catch (error) {
				return json(res, 500, { code: 500, message: String(error), data: null });
			}
		}
	}
	// 未实现的端点：返回空数据而不是 404，避免页面整块报错（预览用途）。
	if (path.startsWith("/api/")) {
		return json(res, 200, { code: 0, message: "OK (mock fallback)", data: null, meta: null });
	}
	json(res, 404, { code: 404, message: "not found", data: null });
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`[mock-api] http://127.0.0.1:${PORT}  (仅本地预览；数据为 mock，不是真实平台数据)`);
});
