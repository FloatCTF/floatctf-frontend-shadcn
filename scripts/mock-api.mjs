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
 * 覆盖：认证 / 赛事 / 题库 / 题解 / 训练场（Practice Run）/ AWD 选手端 / AWDP 选手端 /
 * 管理端 AWD·AWDP 运维 / SSE（含 POST /api/__sse/close 主动断开以测试重连）。
 *
 * 用法：
 *   node scripts/mock-api.mjs [--port 7780] [--host 127.0.0.1] [--host 10.66.66.2]
 *   默认只监听回环；Vite 的 `/api` 代理走 127.0.0.1，因此从 WireGuard 访问 UI 无需放行本端口。
 *   # 另开一个终端：pnpm dev（Vite 会把 /api 代理到这里）
 */

import http from "node:http";

const argValue = (flag, fallback) => {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : fallback;
};
const PORT = Number(argValue("--port", 7780));
/** 监听地址：默认只回环；`--host 0.0.0.0` 或 `--host 10.66.66.2` 可显式放行（dev 预览用）。 */
const HOSTS = process.argv.reduce((hosts, arg, index, argv) => {
	if (arg === "--host" && argv[index + 1]) hosts.push(argv[index + 1]);
	return hosts;
}, []);
const LISTEN_HOSTS = HOSTS.length > 0 ? HOSTS : ["127.0.0.1"];
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
		id: "e0a1b2c3-0004-4a11-9a11-000000000004",
		title: "2025 秋季新生赛",
		description: "面向新生的入门解题赛。",
		hidden: false,
		start_time: iso(now - 30 * D),
		end_time: iso(now - 29 * D),
		rules: "赛后可以查看题解。",
		allow_join: true,
		flag_prefix: "flag{",
		created_at: iso(now - 60 * D),
		updated_at: iso(now - 29 * D),
		family: "jeopardy",
		purpose: "competition",
		participant_mode: "individual",
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
	{
		id: "e0a1b2c3-0005-4a11-9a11-000000000005",
		title: "AWD 新生杯 · 报名中",
		description: "尚未开始的战队赛：可以创建或加入战队，开赛后锁定。",
		hidden: false,
		start_time: iso(now + 2 * H),
		end_time: iso(now + 8 * H),
		rules: "每队 2–4 人；开赛后不可更换战队。",
		allow_join: true,
		flag_prefix: "flag{",
		created_at: iso(now - 2 * D),
		updated_at: iso(now - 2 * H),
		family: "awd",
		purpose: "competition",
		participant_mode: "team",
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

/** 讨论评论（mock）：与 `discussions[].comment_count` 对齐，支持新增/编辑/删除。 */
let discussionComments = [
	{
		id: "c-1",
		discussion_id: "d-1",
		author_id: "u-2",
		author_nickname: "NOP Sled",
		author_avatar: null,
		content: "我这边也超时，换成 `nc -vz 10.42.16.11 31337` 能看到端口是开的，但应用层没响应。",
		parent_id: null,
		created_at: iso(now - 80 * 60000),
		updated_at: iso(now - 80 * 60000),
	},
	{
		id: "c-2",
		discussion_id: "d-1",
		author_id: "u-3",
		author_nickname: "SegFault Club",
		author_avatar: null,
		content: "重置一次 GameBox 之后好了，估计是容器里的服务没起来。",
		parent_id: null,
		created_at: iso(now - 60 * 60000),
		updated_at: iso(now - 60 * 60000),
	},
	{
		id: "c-3",
		discussion_id: "d-1",
		author_id: "u-1",
		author_nickname: "李明",
		author_avatar: null,
		content: "确认是实例问题；已经在赛事公告里同步了，重置即可。",
		parent_id: null,
		created_at: iso(now - 35 * 60000),
		updated_at: iso(now - 35 * 60000),
	},
];

const discussions = [
	{
		id: "d-1",
		title: "Pwn 第三题的环境连不上？",
		content: "重启了两次实例，`nc` 仍然超时，其他人有遇到吗？",
		author_id: "u-2",
		author_nickname: "NOP Sled",
		author_avatar: null,
		view_count: 128,
		like_count: 6,
		is_liked: false,
		comment_count: 3,
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
		view_count: 128,
		like_count: 6,
		is_liked: false,
		comment_count: 3,
		created_at: iso(now - 6 * H),
		updated_at: iso(now - 2 * H),
	},
];

/** 题目页的题库 writeup（ChallengeWriteupResult：含作者 + 题目 + 正文实体）。 */
const challengeWriteups = [
	{
		id: "w-1",
		nickname: "Byte Me",
		avatar: undefined,
		email: "byte@example.edu",
		challenge: challenges[1],
		writeup: {
			id: "cw-1",
			challenge_id: "c-0002",
			user_id: me.id,
			content:
				"## 思路\n\n接口只校验了登录态，没有校验 note 的归属。\n\n```bash\ncurl -H 'Authorization: Bearer <token>' /api/notes/2\n```",
			created_at: iso(now - 26 * H),
			updated_at: iso(now - 26 * H),
		},
	},
];

/** 全站题解列表（UnifiedWriteupResult：challenge + gamebox 合并）。 */
const unifiedWriteups = [
	{
		id: "w-1",
		writeup_type: "challenge",
		nickname: "李明",
		avatar: null,
		email: "liming@example.edu",
		content_id: "c-0002",
		content_name: "Notes 越权读取",
		updated_at: iso(now - 26 * H),
	},
	{
		id: "w-2",
		writeup_type: "gamebox",
		nickname: "Byte Me",
		avatar: null,
		email: "byte@example.edu",
		content_id: "run-1",
		content_name: "web-01 修复记录",
		updated_at: iso(now - 3 * H),
	},
];

const unifiedWriteupDetail = {
	id: "w-1",
	writeup_type: "challenge",
	content_id: "c-0002",
	content_name: "Notes 越权读取",
	category: "Web",
	nickname: "李明",
	avatar: null,
	email: "liming@example.edu",
	content:
		"## 思路\n\n接口只校验了登录态，没有校验 note 的归属。\n\n```bash\ncurl -H 'Authorization: Bearer <token>' /api/notes/2\n```",
	created_at: iso(now - 26 * H),
	updated_at: iso(now - 26 * H),
};

const adminEvents = events.map((event, index) => ({
	...event,
	// 管理端还有一些统计字段；缺省时页面按空值渲染
	event_challenge_count: index === 0 ? challenges.length : 0,
	event_user_count: 12,
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


/** 服务端分页：按 page/limit 切片并回填 meta.total（对齐真实后端行为）。 */
const okPage = (res, rows, req) => {
	const url = new URL(req?.url ?? "/", "http://localhost");
	const limit = Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20);
	const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
	const total = rows.length;
	const start = (page - 1) * limit;
	json(res, 200, {
		code: 0,
		message: "OK",
		data: rows.slice(start, start + limit),
		meta: { offset: start, limit, page, filter: url.searchParams.get("filter"), total },
	});
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

// ── 管理端 AWDP 运维 ──────────────────────────────────────────────────
let awdpAdminPhase = process.env.MOCK_AWDP_ADMIN_PHASE ?? "break";
const awdpAdminConfig = (eventId) => ({
	event_id: eventId,
	phase: awdpAdminPhase,
	break_duration_secs: 5400,
	fix_duration_secs: 3600,
	fix_round_interval_secs: 600,
	break_score: 200,
	fix_round_score: 100,
	total_rounds: 3,
	configuration_generation: 4,
	updated_at: iso(now - 40 * 60000),
	started_at: awdpAdminPhase === "pending" ? null : iso(now - 50 * 60000),
	break_ends_at: awdpAdminPhase === "break" ? iso(now + 40 * 60000) : iso(now - 10 * 60000),
	fix_started_at: ["fix", "ended"].includes(awdpAdminPhase) ? iso(now - 10 * 60000) : null,
	fix_ends_at: awdpAdminPhase === "fix" ? iso(now + 50 * 60000) : null,
	finished_at: awdpAdminPhase === "ended" ? iso(now - 60000) : null,
	current_round: awdpAdminPhase === "fix" ? 1 : 0,
	next_action_at: iso(now + 40 * 60000),
});
const awdpAdminGameboxes = (eventId) => [
	{
		id: "aegb-1",
		event_id: eventId,
		gamebox_id: "gb-lib-1",
		name: "web-shop",
		safe_name: "web-shop",
		category: "Web",
		enabled: true,
		hidden: false,
		cpu_millis: 500,
		memory_bytes: 268435456,
		pids_limit: 128,
		awdp_capable: true,
		awdp_source_code_dir: "src/web-shop",
		build_status: "ready",
	},
];
const awdpAdminInstances = [
	{
		instance_id: "ainst-1",
		event_gamebox_id: "aegb-1",
		gamebox_name: "web-shop",
		owner_user_id: "8f1c2d7a-0001-4a11-9a11-000000000001",
		owner_team_id: null,
		runtime_state: "running",
		runtime_generation: 1,
		container_name: "awdp-e1-web-shop-u1",
		endpoints: [{ protocol: "http", container_port: 8080, public_host: "10.42.20.11", public_port: 18080 }],
	},
];

/**
 * 战队列表与积分榜必须同源：两者都用 `teams`（下标即 `team-${index}`），
 * 否则管理端「按战队调分」会改到另一个队、积分榜看起来没反应。
 */
const awdTeams = (eventId) =>
	teams.slice(0, 3).map(([name, score], index) => ({
		id: `team-${index}`,
		team: {
			id: `team-${index}`,
			event_id: eventId,
			name,
			description: "Mock 战队",
			points: score,
			created_at: iso(now - 3 * D),
			updated_at: iso(now - 2 * H),
			// 第三支队伍标记为已封禁，用于验证封禁态展示。
			banned: index === 2,
		},
		captain: index === 0 ? "李明" : `队长 ${index}`,
		members: [
			{ username: `202400${index + 1}`, nickname: index === 0 ? "李明" : `队员 ${index}`, role: "captain", points: score },
			...(index === 0
				? [{ username: "2024009", nickname: "NOP Sled", role: "member", points: Math.round(score / 2) }]
				: []),
		],
	}));

// ── 管理端 AWD 运维（赛事状态机 / 网络 / 赛事靶机 / 预检）──────────────
let awdAdminStatus = process.env.MOCK_AWD_ADMIN_STATUS ?? "verified";
const awdAdminState = (eventId) => ({
	event_id: eventId,
	status: awdAdminStatus,
	phase: ["running", "paused"].includes(awdAdminStatus) ? "attack" : "hardening",
	round_count: 8,
	round_duration_secs: 600,
	initial_score: 1000,
	free_reset_count: 2,
	extra_reset_penalty: 50,
	judge_max_concurrency: 8,
	judge_default_timeout_secs: 120,
	judge_retry_interval_secs: 30,
	archive_retention_hours: 72,
	planned_start_at: iso(now - 2 * H),
	verified_at: awdAdminStatus === "draft" || awdAdminStatus === "configuring" ? null : iso(now - 3 * H),
	started_at: ["running", "paused", "finished", "archived"].includes(awdAdminStatus)
		? iso(now - 40 * 60000)
		: null,
	updated_at: iso(now - 5 * 60000),
	final_settlement: false,
});
const awdEventNetwork = (eventId) => ({
	event_id: eventId,
	allocation_mode: "automatic",
	gamebox_cidr: "10.42.16.0/24",
	wireguard_cidr: "10.66.3.0/24",
	infrastructure_subnet: "10.42.16.0/28",
	flagserver_ip: "10.42.16.2",
	judgeserver_ip: "10.42.16.3",
	wireguard_interface_name: "wg-awd-3",
	wireguard_listen_port: 51823,
	docker_network_name: "floatctf-awd-3",
	locked: false,
});
const awdEventGameboxes = (eventId) => [
	{
		id: "egb-1",
		event_id: eventId,
		gamebox_id: "gb-lib-1",
		gamebox_name: "web-01",
		gamebox_safe_name: "web-01",
		gamebox_version: "1.2.0",
		host_offset: 1,
		enabled: true,
		hidden: false,
		cpu_millis: 500,
		memory_bytes: 268435456,
		pids_limit: 128,
		judge_timeout_secs: 120,
		judge_retry_interval_secs: 30,
		attack_score: 100,
		judge_down_penalty: 20,
		first_bonus: 50,
		created_at: iso(now - 3 * D),
	},
	{
		id: "egb-2",
		event_id: eventId,
		gamebox_id: "gb-lib-2",
		gamebox_name: "pwn-02",
		gamebox_safe_name: "pwn-02",
		gamebox_version: "0.9.3",
		host_offset: 2,
		enabled: true,
		hidden: false,
		cpu_millis: 500,
		memory_bytes: 536870912,
		pids_limit: 64,
		judge_timeout_secs: 120,
		judge_retry_interval_secs: 30,
		attack_score: 120,
		judge_down_penalty: 20,
		first_bonus: 50,
		created_at: iso(now - 3 * D),
	},
];
const awdPrecheckRuns = (eventId) => [
	{
		id: "pc-1",
		event_id: eventId,
		status: "succeeded",
		trigger: "manual",
		error_msg: null,
		created_at: iso(now - 50 * 60000),
		finished_at: iso(now - 48 * 60000),
	},
];

// ── AWDP 训练场（目录 + Practice Run）──────────────────────────────────
const trainingCatalog = [
	{
		id: "gb-lib-1",
		name: "web-shop",
		description: "练习用 Web 靶机：修复 SESSION 伪造漏洞。",
		category: "Web",
		version: "1.2.0",
		author: "组委会",
		updated_at: iso(now - 10 * D),
		awdp_capable: true,
		recommended_cpu_millis: 500,
		recommended_memory_bytes: 268435456,
		recommended_pids_limit: 128,
		active_training: null,
		solved: false,
	},
	{
		id: "gb-lib-2",
		name: "pwn-note",
		description: "练习用 Pwn 靶机：堆溢出到任意写。",
		category: "Pwn",
		version: "0.9.3",
		author: "组委会",
		updated_at: iso(now - 20 * D),
		awdp_capable: true,
		recommended_cpu_millis: 500,
		recommended_memory_bytes: 536870912,
		recommended_pids_limit: 64,
		active_training: { run_id: "run-done", phase: "ended", score: 140 },
		solved: true,
	},
];
const runInstance = {
	instance_id: "run-inst-1",
	gamebox_id: "gb-lib-1",
	runtime_state: process.env.MOCK_RUN_STATE ?? "running",
	runtime_generation: 1,
	reset_count: 0,
	endpoints: [
		{ protocol: "http", container_port: 8080, public_host: "10.42.30.11", public_port: 18080 },
	],
};
let mockRunPhase = "break";
let runInstanceState = process.env.MOCK_RUN_STATE ?? "running";
const currentRunInstance = () => ({ ...runInstance, runtime_state: runInstanceState });
const trainingRun = (phase = mockRunPhase, runId = "run-1") => ({
	run_id: runId,
	gamebox_id: "gb-lib-1",
	gamebox_name: "web-shop",
	gamebox_category: "Web",
	gamebox_description: "练习用 Web 靶机：修复 SESSION 伪造漏洞。",
	event_id: null,
	phase,
	break_duration_secs: 1800,
	fix_duration_secs: 1200,
	fix_round_interval_secs: 300,
	break_score: 100,
	fix_round_score: 50,
	total_rounds: 2,
	started_at: phase === "pending" ? null : iso(now - 5 * 60000),
	break_ends_at: iso(now + 25 * 60000),
	fix_started_at: phase === "fix" ? iso(now - 60000) : null,
	fix_ends_at: phase === "fix" ? iso(now + 19 * 60000) : null,
	finished_at: null,
	current_round: phase === "fix" ? 1 : 0,
	next_action_at: iso(now + 25 * 60000),
	// 分数只在 Fix 阶段（有回合判定）后产生；Break 刚开始时应为 0。
	my_score: phase === "fix" || phase === "ended" ? 100 : 0,
	fix_round_penalty: 10,
	source_code_dir: "src/web-shop",
	instances: [currentRunInstance()],
	judge_endpoint: {
		base_url: "http://10.42.30.2:8080",
		flag_url: "http://10.42.30.2:8080/flag",
		scope: "gamebox_internal",
	},
});
const runRounds = [
	{ id: "rrun-1", sequence: 1, starts_at: iso(now - 3 * 60000), cutoff_at: iso(now + 2 * 60000), status: "pending" },
	{ id: "rrun-2", sequence: 2, starts_at: iso(now + 5 * 60000), cutoff_at: iso(now + 10 * 60000), status: "pending" },
];
const runEvaluations = [
	{
		id: "ev-run-1",
		instance_id: "run-inst-1",
		gamebox_id: "gb-lib-1",
		fix_round_id: null,
		round_sequence: null,
		kind: "manual",
		status: "patched",
		healthcheck_result: "ok",
		judge_result: "ok",
		exploit_result: "blocked",
		finished_at: iso(now - 2 * 60000),
	},
];
const runScores = {
	total: 100,
	history: [
		{ id: "se-1", score_type: "break", gamebox_id: "gb-lib-1", fix_round_id: null, delta: 100, created_at: iso(now - 4 * 60000) },
	],
};

// ── AWD 选手端 ──────────────────────────────────────────────────────────
const awdStatus = (eventId) => ({
	event_id: eventId,
	status: "running",
	phase: "attack",
	current_round: 3,
	round_count: 8,
	banned: process.env.MOCK_TEAM_BANNED === "1",
	score: 1240,
	final_settlement: false,
});
const awdGameboxes = [
	{
		id: "gb-1",
		team_id: "team-1",
		event_gamebox_id: "egb-1",
		gamebox_name: "web-01",
		status: "running",
		gamebox_ip: "10.42.16.11",
		container_name: "awd-team1-web01",
		health_status: "healthy",
	},
	{
		id: "gb-2",
		team_id: "team-1",
		event_gamebox_id: "egb-2",
		gamebox_name: "pwn-02",
		status: "running",
		gamebox_ip: "10.42.16.12",
		container_name: "awd-team1-pwn02",
		health_status: "unhealthy",
	},
];
/** 由 `teams` 派生积分行：加分/扣分后**重算排名**，选手端与管理端共用同一份数据。 */
const awdScoreRows = () =>
	teams
		.map(([name, base], index) => {
			const score = base + (index === 0 ? mockAwdBonus : 0);
			return {
				team_id: `team-${index}`,
				team_name: name,
				attack_score: Math.round(score * 0.55),
				defense_score: Math.round(score * 0.45),
				total_score: score,
			};
		})
		.sort((a, b) => b.total_score - a.total_score)
		.map((row, index) => ({ ...row, rank: index + 1 }));

const wireguardConfig = `[Interface]
PrivateKey = MOCK-PRIVATE-KEY-DO-NOT-USE
Address = 10.66.3.2/24
DNS = 10.66.0.1

[Peer]
PublicKey = MOCK-SERVER-PUBLIC-KEY
Endpoint = vpn.example.edu:51820
AllowedIPs = 10.42.16.0/24
PersistentKeepalive = 25`;

// ── AWDP 选手端 ─────────────────────────────────────────────────────────
const awdpGameboxId = "egb-awdp-1";
let awdpInstanceState = "running";
const awdpInstance = {
	instance_id: "inst-awdp-1",
	runtime_state: "running",
	runtime_generation: 2,
	reset_count: 0,
	endpoints: [
		{ protocol: "http", container_port: 8080, public_host: "10.42.20.11", public_port: 18080 },
		{ protocol: "tcp", container_port: 22, public_host: "10.42.20.11", public_port: 22022 },
	],
};
/** 每次读取都从可变状态生成，停止/启动/重置后页面能立即反映。 */
const currentAwdpInstance = () => ({ ...awdpInstance, runtime_state: awdpInstanceState });

const awdpOverview = (eventId) => ({
	event_id: eventId,
	phase: process.env.MOCK_AWDP_PHASE ?? "break",
	break_duration_secs: 5400,
	fix_duration_secs: 3600,
	fix_round_interval_secs: 600,
	total_rounds: 3,
	break_score: 200,
	fix_round_score: 100,
	started_at: iso(now - 40 * 60000),
	break_ends_at: iso(now + 50 * 60000),
	fix_started_at: null,
	fix_ends_at: null,
	finished_at: null,
	current_round: 0,
	next_action_at: iso(now + 50 * 60000),
	my_score: 200,
	gameboxes: [
		{
			id: awdpGameboxId,
			gamebox_id: "gb-lib-1",
			name: "web-shop",
			category: "Web",
			enabled: true,
			hidden: false,
			exposed: [["http", 8080]],
			broken: true,
			instance: currentAwdpInstance(),
			source_code_dir: "src/web-shop",
		},
	],
});
const awdpRounds = [
	{ id: "r-1", sequence: 1, starts_at: iso(now - 20 * 60000), cutoff_at: iso(now + 10 * 60000), status: "completed" },
	{ id: "r-2", sequence: 2, starts_at: iso(now + 10 * 60000), cutoff_at: iso(now + 40 * 60000), status: "pending" },
];
const awdpEvaluations = [
	{
		id: "ev-1",
		instance_id: "inst-awdp-1",
		event_gamebox_id: awdpGameboxId,
		fix_round_id: null,
		round_sequence: null,
		kind: "manual",
		status: "patched",
		healthcheck_result: "ok",
		judge_result: "ok",
		finished_at: iso(now - 15 * 60000),
	},
];
const awdpScores = [
	{ subject_id: "s-1", subject_name: "Byte Me", break_score: 200, fix_score: 100, total_score: 300, rank: 1 },
	{ subject_id: "s-2", subject_name: "NOP Sled", break_score: 200, fix_score: 0, total_score: 200, rank: 2 },
	{ subject_id: "s-3", subject_name: "SegFault Club", break_score: 0, fix_score: 100, total_score: 100, rank: 3 },
];


/** 记录活跃 SSE 连接，便于 `POST /__sse/close` 主动断开以测试重连。 */
const sseClients = new Set();

/** 向全部活跃 SSE 连接广播一条事件（用于验证前端的实时失效）。 */
const broadcastSse = (data) => {
	for (const client of sseClients) {
		if (!client.writableEnded) client.write(`data: ${JSON.stringify(data)}\n\n`);
	}
};

/** mock 里少数需要看请求体的路由（flag 校验）：其余路由忽略 body。 */

/** 一组 OR 组、每组 AND 条件：`title:a | content:b` = (title 含 a) 或 (content 含 b)。 */
const mockFilterGroups = (req) => {
	const url = new URL(req.url ?? "", "http://mock.local");
	const raw = (url.searchParams.get("filter") ?? "").trim();
	if (!raw) return null;
	return raw
		.split("|")
		.map((group) =>
			group
				.split("&")
				.map((token) => token.trim())
				.filter(Boolean)
				.map((token) => {
					const [key, ...rest] = token.split(":");
					return { key: key.trim(), value: rest.join(":").trim() };
				})
				.filter((item) => item.key && item.value),
		)
		.filter((group) => group.length > 0);
};

/** 行是否命中筛选；字段名可通过 alias 重映射（如 `name` → `task_name`）。 */
const mockFilterMatch = (req, row, alias = {}) => {
	const groups = mockFilterGroups(req);
	if (!groups) return true;
	return groups.some((group) =>
		group.every(({ key, value }) => {
			const field = alias[key] ?? key;
			const actual = row?.[field];
			return actual !== undefined && actual !== null && matchesContains(actual, value);
		}),
	);
};

/** 不区分大小写的包含匹配（mock 的通用过滤）。 */
const matchesContains = (value, needle) =>
	String(value ?? "").toLowerCase().includes(String(needle ?? "").toLowerCase());

const readJsonBody = (req) =>
	new Promise((resolve) => {
		let raw = "";
		req.on("data", (chunk) => {
			raw += chunk;
		});
		req.on("end", () => {
			try {
				resolve(JSON.parse(raw || "{}"));
			} catch {
				resolve({});
			}
		});
	});

/** SSE：保持连接并心跳；首个事件用于让前端进入 connected 状态。 */
const sse = (res, req) => {
	res.writeHead(200, {
		"content-type": "text/event-stream; charset=utf-8",
		"cache-control": "no-cache, no-transform",
		connection: "keep-alive",
		"x-accel-buffering": "no",
	});
	res.write("retry: 3000\n\n");
	const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
	send({ type: "connected", sequence: 1, occurred_at: iso(now) });
	// 2 秒后推一条计分事件：验证前端按 SSE 事件失效查询（会重新拉取 awd-scores 等）。
	setTimeout(() => {
		if (!res.writableEnded) send({ type: "score.updated", sequence: 2, occurred_at: iso(now) });
	}, 2000);
	const timer = setInterval(() => {
		if (res.writableEnded) return;
		res.write(": ping\n\n");
	}, 15000);
	sseClients.add(res);
	console.log("[sse] open ->", sseClients.size);
	const drop = () => {
		clearInterval(timer);
		sseClients.delete(res);
	};
	// 用 response 的 close（客户端断开）而不是 req 的 close（请求体结束就会触发）。
	res.on("close", drop);
	return undefined;
};

let mockWriteup = null;
let mockAwdBonus = 0;


/** 25 个账号（mock）：足够覆盖分页、筛选后回到第 1 页、跨页多选与批量删除。 */
let mockUsers = [
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
	...Array.from({ length: 23 }, (_, index) => {
		const no = index + 8;
		return {
			id: `u-${no}`,
			username: `20240${String(no).padStart(2, "0")}`,
			nickname: `选手 ${no}`,
			email: `player${no}@example.edu`,
			avatar: null,
			created_at: iso(now - (30 - index) * D),
			updated_at: iso(now - index * H),
		};
	}),
];


/** 角色列表（mock）：内置超级管理员 + 可创建的自定义角色。 */
let mockRoles = [
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
];


/** 战队详情（mock）：仅 team 模式的赛事返回，用于验证战队面板与成员角色。 */
const mockTeamFor = (event) => ({
	team: {
		id: "team-6",
		event_id: event.id,
		name: "Byte Me",
		description: "Mock 战队",
		points: 1240,
		created_at: iso(now - 3 * D),
		updated_at: iso(now - 2 * H),
		banned: process.env.MOCK_TEAM_BANNED === "1",
	},
	members: [
		{
			member_name: me.nickname,
			member: { event_id: event.id, team_id: "team-6", user_id: me.id, role: "captain", joined_at: iso(now - 3 * D) },
		},
		{
			member_name: "NOP Sled",
			member: { event_id: event.id, team_id: "team-6", user_id: "u-2", role: "member", joined_at: iso(now - 2 * D) },
		},
	],
});

/** 计划任务（mock）：创建/编辑/删除都作用在这份状态上。 */
let mockTasks = [
		{
			id: "t-1",
			group_id: "system",
			task_name: "清理过期实例",
			description: "回收超过 24 小时的题目实例。",
			task_key: "cleanup-stale-instances",
			trigger_type: "cron",
			status: "pending",
			enabled: true,
			protected: false,
			cron_expr: "0 */6 * * * *",
			created_at: iso(now - 30 * D),
			updated_at: iso(now - 2 * H),
			attempt_count: 0,
			max_attempts: 3,
		},
		{
			id: "t-3",
			group_id: "system",
			task_name: "启动时检查 helper 连接",
			description: "API 启动后确认 helper-docker / helper-control socket 可用。",
			task_key: "helper-healthcheck",
			trigger_type: "startup",
			status: "pending",
			enabled: true,
			protected: false,
			cron_expr: null,
			created_at: iso(now - 90 * D),
			updated_at: iso(now - 3 * 60000),
			attempt_count: 0,
			max_attempts: 3,
		},
		{
			id: "t-2",
			group_id: "service",
			task_name: "平台课程同步",
			description: "从课程服务同步选课名单（示例任务）。",
			task_key: "course-sync",
			trigger_type: "cron",
			status: "failed",
			enabled: true,
			protected: true,
			cron_expr: "0 0 3 * * * *",
			created_at: iso(now - 60 * D),
			updated_at: iso(now - 45 * 60000),
			attempt_count: 2,
			max_attempts: 3,
			last_error: "network timeout（示例）",
		},
		];


/** 赛事战队（mock）：E5 这类未开始赛事可创建/加入/退出。 */
let mockEventTeams = {};
const mockEventJoined = new Set();

const mockTeamResult = (event) => {
	const team = mockEventTeams[event.id];
	if (!team) return undefined;
	return {
		team,
		members: [
			{
				member_name: me.nickname,
				member: { event_id: event.id, team_id: team.id, user_id: me.id, role: "captain", joined_at: team.created_at },
			},
		],
	};
};

/** 附件下载（mock）：/public/<key> 返回一个可下载的占位文件，并累加武器下载计数。 */
const handlePublicFile = (key, res) => {
	const weapon = weapons.find((item) => item.file_url.replace(/^\/+/, "") === key);
	if (weapon) weapon.download_count = (weapon.download_count ?? 0) + 1;
	const filename = key.split("/").pop() || "attachment.txt";
	const body = `FloatCTF mock attachment\nkey: ${key}\n`;
	res.writeHead(200, {
		"content-type": "application/octet-stream",
		"content-disposition": `attachment; filename="${filename}"`,
		"content-length": Buffer.byteLength(body),
	});
	res.end(body);
};


/** 武器库附件（mock）：file_url 是对象存储 key，前端拼成 /public/<key> 下载。 */
const weapons = [
	{
		id: "w-1",
		name: "pwn 工具速查表",
		category: "Pwn",
		description: "常用 pwntools / ROPgadget 命令速查（纯文本）。",
		has_file: true,
		download_count: 143,
		file_url: "weapons/pwn-cheatsheet.txt",
		created_at: iso(now - 40 * D),
		updated_at: iso(now - 5 * D),
	},
	{
		id: "w-2",
		name: "弱口令字典（示例）",
		category: "Misc",
		description: "演示用的 5 行弱口令列表，真实场景请自备字典。",
		has_file: true,
		download_count: 87,
		file_url: "weapons/tiny-wordlist.txt",
		created_at: iso(now - 32 * D),
		updated_at: iso(now - 12 * D),
	},
	{
		id: "w-3",
		name: "模板：Writeup 骨架",
		category: "写作",
		description: "暂无附件（has_file=false）：用于验证下载按钮的禁用态。",
		has_file: false,
		download_count: 0,
		file_url: "",
		created_at: iso(now - 9 * D),
		updated_at: iso(now - 9 * D),
	},
];


/** 训练 run 的 writeup（mock）：保存后再次读取应拿到同一份内容。 */
let mockRunWriteup = { content: "", updated_at: null };


/** 赛事成员（mock）：默认全部 mock 用户参赛；支持添加/移出/封禁。 */
let mockEventMembers = {};
const eventMemberIds = (eventId) => {
	// 默认只让前 12 个账号参赛，其余留给「添加成员」流程。
	if (!mockEventMembers[eventId]) mockEventMembers[eventId] = mockUsers.slice(0, 12).map((user) => user.id);
	return mockEventMembers[eventId];
};


/** 赛事成员封禁状态（mock）：`eventId:userId`。 */
const mockMemberBans = new Set(["e0a1b2c3-0001-4a11-9a11-000000000001:u-2"]);


/** 赛事成员行（含 user 与 event_user），供列表与封禁接口共用。 */
const eventUserRows = (eventId) =>
	mockUsers
		.filter((user) => eventMemberIds(eventId).includes(user.id))
		.map((user) => ({
			id: user.id,
			user,
			username: user.username,
			nickname: user.nickname,
			event_user: {
				event_id: eventId,
				user_id: user.id,
				points: 0,
				banned: mockMemberBans.has(`${eventId}:${user.id}`),
				joined_at: user.created_at,
			},
		}));


/** 题集（mock）：题集与题目的关系单独维护，便于验证加题/移题。 */
let mockChallengeSets = [
	{
		id: "set-1",
		name: "Web 入门题集",
		description: "给新生的 Web 方向练习集合。",
		created_at: iso(now - 20 * D),
		updated_at: iso(now - 3 * D),
	},
];
const mockSetChallenges = { "set-1": ["c-0002"] };

const routes = [




	// dev-only：主动断开全部 SSE，用于验证「断线 → 轮询 → 重连」表现
	["POST", /^\/api\/__sse\/close$/, (_m, res, req) => {
		for (const client of sseClients) {
			try { client.end(); } catch { /* 已断开 */ }
		}
		sseClients.clear();
		console.log("[sse] close all");
		return ok(res, 0, req);
	}],
	// SSE（mock：建立连接后保持心跳；事件类型与真实后端一致）
	["GET", /^\/api\/(?:admin\/)?events\/[^/]+\/awd\/stream$/, (_m, res, req) => sse(res, req)],
	["GET", /^\/api\/events\/[^/]+\/awdp\/stream$/, (_m, res, req) => sse(res, req)],
	["GET", /^\/api\/service\/awdp\/runs\/[^/]+\/stream$/, (_m, res, req) => sse(res, req)],
	// 管理端 AWD 运维（状态机 / 网络 / 赛事靶机 / 预检 / 积分）
	["GET", /^\/api\/admin\/events\/([^/]+)\/awd$/, (m, res) => ok(res, awdAdminState(m[1]))],
	["PATCH", /^\/api\/admin\/events\/([^/]+)\/awd$/, (m, res) => ok(res, awdAdminState(m[1]))],
	// 管理端 AWD：生命周期（状态机）/ 网络 / 赛事靶机 / 实例 / 预检 / 积分 / 战队
	["POST", /^\/api\/admin\/events\/([^/]+)\/awd\/(deploy|start|pause|resume|finish|archive)$/, (m, res) => {
		const next = { deploy: "deployed", start: "running", pause: "paused", resume: "running", finish: "finished", archive: "archived" }[m[2]];
		awdAdminStatus = next;
		broadcastSse({ type: "precheck.updated", sequence: Date.now(), occurred_at: iso(now) });
		return ok(res, null);
	}],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awd\/tokens\/rotate$/, (_m, res) => ok(res, null)],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awd\/precheck$/, (m, res) =>
		ok(res, {
			run_id: "pc-mock-new",
			status: "succeeded",
			error_msg: null,
			failed_checks: [],
			checks: [{ name: "network", ok: true, detail: "mock" }],
			trigger: "manual",
			event_id: m[1],
		})],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awd\/prechecks$/, (m, res) => ok(res, awdPrecheckRuns(m[1]))],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awd\/scores$/, (_m, res) => ok(res, awdScoreRows())],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awd\/network$/, (m, res) => ok(res, awdEventNetwork(m[1]))],
	["PUT", /^\/api\/admin\/events\/([^/]+)\/awd\/network$/, (m, res) => ok(res, null)],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awd\/network\/reallocate$/, (_m, res) => ok(res, null)],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awd\/gameboxes$/, (m, res) => ok(res, awdEventGameboxes(m[1]))],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awd\/gameboxes$/, (m, res) => ok(res, awdEventGameboxes(m[1])[0])],
	["DELETE", /^\/api\/admin\/events\/([^/]+)\/awd\/gameboxes\/([^/]+)$/, (_m, res) => ok(res, null)],
	["PATCH", /^\/api\/admin\/events\/([^/]+)\/awd\/gameboxes\/([^/]+)$/, (m, res) => ok(res, awdEventGameboxes(m[1])[0])],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awd\/instances$/, (_m, res) => ok(res, [])],
	["GET", /^\/api\/admin\/events\/([^/]+)\/teams$/, (m, res) => ok(res, awdTeams(m[1]))],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awd\/teams\/([^/]+)\/ban$/, (_m, res) => ok(res, "team banned")],
	["DELETE", /^\/api\/admin\/events\/([^/]+)\/awd\/teams\/([^/]+)\/ban$/, (_m, res) => ok(res, null)],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awd\/score\/adjust$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const idx = Number(String(body.team_id ?? "").replace("team-", ""));
			const delta = Number(body.delta ?? 0);
			if (!Number.isInteger(idx) || idx < 0 || idx >= teams.length || !Number.isFinite(delta)) {
				return json(res, 200, { code: 400, message: "team_id 或 delta 不合法", data: null, meta: null });
			}
			teams[idx][1] = Math.max(0, teams[idx][1] + delta);
			broadcastSse({ type: "score.updated", sequence: Date.now(), occurred_at: iso(now) });
			return ok(res, null);
		})],


	// 管理端 AWDP 运维（配置 / 阶段推进 / 挂载 / 实例 / 积分 / 大屏）
	["GET", /^\/api\/admin\/events\/([^/]+)\/awdp$/, (m, res) => ok(res, awdpAdminConfig(m[1]))],
	["PATCH", /^\/api\/admin\/events\/([^/]+)\/awdp$/, (m, res) => ok(res, awdpAdminConfig(m[1]))],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awdp\/start$/, (m, res) => { awdpAdminPhase = "break"; return ok(res, null); }],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awdp\/break-to-fix$/, (m, res) => { awdpAdminPhase = "fix"; return ok(res, null); }],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awdp\/finish$/, (m, res) => { awdpAdminPhase = "ended"; return ok(res, null); }],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awdp\/gameboxes$/, (m, res) => ok(res, awdpAdminGameboxes(m[1]))],
	["POST", /^\/api\/admin\/events\/([^/]+)\/awdp\/gameboxes$/, (m, res) => ok(res, awdpAdminGameboxes(m[1])[0])],
	["DELETE", /^\/api\/admin\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)$/, (_m, res) => ok(res, null)],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awdp\/instances$/, (_m, res) => ok(res, awdpAdminInstances)],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awdp\/scores$/, (_m, res) => ok(res, awdpScores)],
	["GET", /^\/api\/admin\/events\/([^/]+)\/awdp\/data$/, (m, res) => {
		const event = events.find((e) => e.id === m[1]) ?? events[0];
		return ok(res, {
			event,
			user_count: 3,
			team_count: 0,
			gameboxes: [{ id: "aegb-1", name: "web-shop", category: "Web", break_count: 2, fix_count: 1 }],
			scoreboard_top10: awdpScores,
			trend: [
				{ name: "Byte Me", points: [{ name: "Byte Me", score: 200, time: iso(now - 30 * 60000) }, { name: "Byte Me", score: 300, time: iso(now - 10 * 60000) }] },
			],
			recent_activity: [
				{ subject_name: "Byte Me", gamebox_name: "web-shop", gamebox_category: "Web", action: "break", delta: 200, created_at: iso(now - 20 * 60000) },
			],
		});
	}],
	["GET", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/instance$/, (_m, res) => ok(res, currentAwdpInstance())],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/instance$/, (_m, res) => {
		awdpInstanceState = "running";
		return ok(res, currentAwdpInstance());
	}],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/instance\/stop$/, (_m, res) => {
		awdpInstanceState = "stopped";
		return ok(res, null);
	}],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/instance\/reset$/, (_m, res) => {
		awdpInstance.reset_count += 1;
		awdpInstance.runtime_generation += 1;
		awdpInstanceState = "running";
		return ok(res, currentAwdpInstance());
	}],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/instance\/stop$/, (_m, res) => ok(res, null)],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/break$/, (_m, res) =>
		ok(res, { accepted: true, scored: true, already_broken: false })],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/patch$/, (_m, res) =>
		ok(res, { status: "applied", error_message: null })],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/test-check$/, (_m, res) =>
		ok(res, {
			evaluation_id: "ev-manual-1",
			status: "completed",
			healthcheck_ok: true,
			healthcheck_detail: ["mock: 服务可用"],
			judge_ok: true,
			judge_detail: "mock: 官方 judge 通过",
			exploit_ok: false,
			exploit_detail: "mock: 未执行到 exploit 阶段",
		})],
	["GET", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/source$/, (_m, res) =>
		ok(res, "// mock：源码包只对已参赛选手开放，这里仅返回占位说明。\n")],

	// AWDP 选手端（总览 / 轮次 / 评估 / 积分 / 趋势 / 实例动作）
	["GET", /^\/api\/events\/([^/]+)\/awdp$/, (m, res) => ok(res, awdpOverview(m[1]))],
	["GET", /^\/api\/events\/([^/]+)\/awdp\/rounds$/, (_m, res) => ok(res, awdpRounds)],
	["GET", /^\/api\/events\/([^/]+)\/awdp\/evaluations$/, (_m, res) => ok(res, awdpEvaluations)],
	["GET", /^\/api\/events\/([^/]+)\/awdp\/scores$/, (_m, res) => ok(res, awdpScores)],
	["GET", /^\/api\/events\/([^/]+)\/awdp\/scoreboard$/, (_m, res) =>
		ok(res, {
			participant_mode: "individual",
			gameboxes: [{ id: awdpGameboxId, name: "web-shop", category: "Web" }],
			rounds: awdpRounds.map((r) => ({ sequence: r.sequence, status: r.status, cutoff_at: r.cutoff_at })),
			rows: awdpScores.map((row) => ({
				subject_id: row.subject_id,
				subject_name: row.subject_name,
				rank: row.rank,
				break_score: row.break_score,
				fix_score: row.fix_score,
				total_score: row.total_score,
				is_me: row.subject_id === "s-1",
				break_status: [row.break_score > 0],
				fix_gamebox_score: [row.fix_score],
				fix_round_status: [[row.fix_score > 0 ? "patched" : null, null]],
			})),
		})],
	["GET", /^\/api\/events\/([^/]+)\/awdp\/trend$/, (_m, res) =>
		ok(res, [
			{ name: "Byte Me", points: [{ name: "Byte Me", score: 200, time: iso(now - 30 * 60000) }, { name: "Byte Me", score: 300, time: iso(now - 10 * 60000) }] },
			{ name: "NOP Sled", points: [{ name: "NOP Sled", score: 200, time: iso(now - 30 * 60000) }, { name: "NOP Sled", score: 200, time: iso(now - 10 * 60000) }] },
		])],

	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/instance\/stop$/, (_m, res) => ok(res, null)],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/break$/, (_m, res) =>
		ok(res, { accepted: true, scored: true, already_broken: false })],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/patch$/, (_m, res) =>
		ok(res, { status: "applied", error_message: null })],
	["POST", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/test-check$/, (_m, res) =>
		ok(res, {
			evaluation_id: "ev-manual-1",
			status: "completed",
			healthcheck_ok: true,
			healthcheck_detail: ["mock: 服务可用"],
			judge_ok: true,
			judge_detail: "mock: 官方 judge 通过",
			exploit_ok: false,
			exploit_detail: "mock: 未执行到 exploit 阶段",
		})],
	["GET", /^\/api\/events\/([^/]+)\/awdp\/gameboxes\/([^/]+)\/source$/, (_m, res) =>
		ok(res, "// mock：源码包只对已参赛选手开放，这里仅返回占位说明。\n")],

	// AWDP 训练场（目录 / Practice Run / 阶段动作 / 实例 / 评测 / 积分 / Writeup）
	["GET", /^\/api\/service\/gameboxes$/, (_m, res, req) => ok(res, trainingCatalog, req)],
	["POST", /^\/api\/service\/gameboxes\/([^/]+)\/awdp\/runs$/, (_m, res) => {
		mockRunPhase = "pending";
		runInstanceState = "stopped";
		return ok(res, trainingRun(mockRunPhase, "run-1"));
	}],
	["GET", /^\/api\/service\/awdp\/runs\/([^/]+)$/, (m, res) => ok(res, trainingRun(mockRunPhase, m[1]))],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/start$/, (m, res) => {
		mockRunPhase = "break";
		runInstanceState = "running";
		return ok(res, trainingRun(mockRunPhase, m[1]));
	}],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/stop$/, (_m, res) => ok(res, null)],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/reset$/, (m, res) => {
		mockRunPhase = "break";
		return ok(res, trainingRun(mockRunPhase, m[1]));
	}],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/end$/, (m, res) => {
		mockRunPhase = "ended";
		return ok(res, trainingRun(mockRunPhase, m[1]));
	}],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/restart-training$/, (_m, res) => {
		mockRunPhase = "pending";
		runInstanceState = "stopped";
		return ok(res, trainingRun(mockRunPhase, "run-2"));
	}],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/phase$/, (m, res) => {
		// 前端只会切到「另一个阶段」；mock 用反转模拟（不解析 body）。
		mockRunPhase = mockRunPhase === "fix" ? "break" : "fix";
		// 切阶段会把实例重置为 pristine 后继续运行。
		runInstanceState = "running";
		return ok(res, trainingRun(mockRunPhase, m[1]));
	}],
	["GET", /^\/api\/service\/awdp\/runs\/([^/]+)\/rounds$/, (_m, res) => ok(res, runRounds)],
	["GET", /^\/api\/service\/awdp\/runs\/([^/]+)\/evaluations$/, (_m, res) => ok(res, runEvaluations)],
	["GET", /^\/api\/service\/awdp\/runs\/([^/]+)\/scores$/, (_m, res) => ok(res, runScores)],
	["GET", /^\/api\/service\/awdp\/runs\/([^/]+)\/writeup$/, (m, res) =>
		ok(res, { run_id: m[1], content: mockRunWriteup.content, updated_at: mockRunWriteup.updated_at })],
	["PUT", /^\/api\/service\/awdp\/runs\/([^/]+)\/writeup$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			// 保存内容必须持久化：之前返回固定文本，编辑后刷新就丢。
			mockRunWriteup = {
				content: String(body.content ?? ""),
				updated_at: iso(now),
			};
			return ok(res, { run_id: m[1], ...mockRunWriteup });
		})],
	["GET", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/instance$/, (_m, res) => ok(res, currentRunInstance())],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/instance$/, (_m, res) => {
		runInstanceState = "running";
		return ok(res, currentRunInstance());
	}],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/instance\/start$/, (_m, res) => {
		runInstanceState = "running";
		return ok(res, currentRunInstance());
	}],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/instance\/stop$/, (_m, res) => {
		runInstanceState = "stopped";
		return ok(res, null);
	}],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/instance\/reset$/, (_m, res) => {
		runInstanceState = "running";
		return ok(res, currentRunInstance());
	}],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/break$/, (_m, res) =>
		ok(res, { accepted: true, scored: true, already_broken: false })],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/patch$/, (_m, res) =>
		ok(res, { status: "applied", error_message: null })],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/test-check$/, (_m, res) =>
		ok(res, {
			evaluation_id: "ev-run-manual",
			status: "completed",
			healthcheck_ok: true,
			healthcheck_detail: ["mock: 服务可用"],
			judge_ok: true,
			judge_detail: "mock: judge 通过",
			exploit_ok: true,
			exploit_detail: "mock: exploit 被阻断",
		})],
	["POST", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/all-check$/, (_m, res) =>
		ok(res, {
			status: "patched",
			swept: false,
			swept_rounds: 0,
			healthcheck_ok: true,
			judge_ok: true,
			exploit_ok: true,
			detail: "mock: ALL Check 通过",
		})],
	["GET", /^\/api\/service\/awdp\/runs\/([^/]+)\/gameboxes\/([^/]+)\/source$/, (_m, res) =>
		ok(res, "https://files.example.edu/mock/web-shop-src.tar.gz")],

	// 认证 / 账号
	["POST", /^\/api\/session$/, (_m, res) => ok(res, "mock-token-0001")],
	["POST", /^\/api\/users$/, (_m, res) => ok(res, "mock-token-0001")],
	["POST", /^\/api\/users\/reset_password$/, (_m, res) => ok(res, "ok")],
	["POST", /^\/api\/users\/reset$/, (_m, res) => ok(res, "ok")],
	["GET", /^\/api\/users\/me$/, (_m, res) => ok(res, me)],
	["PATCH", /^\/api\/users\/me$/, (_m, res) => ok(res, null)],

	// 赛事
	["GET", /^\/api\/events$/, (_m, res, req) =>
		ok(
			res,
			events.map((event) => {
				const joined = event.id.endsWith("0001") || event.id.endsWith("0002");
				return {
					id: event.id,
					event,
					joined,
					...(joined && event.participant_mode === "team" ? { team_result: mockTeamFor(event) } : {}),
				};
			}),
			req,
		)],
	["GET", /^\/api\/events\/([^/]+)$/, (m, res) => {
		const event = events.find((item) => item.id === m[1]) ?? events[0];
		const baseJoined = event.id.endsWith("0001") || event.id.endsWith("0002");
		const dynamicTeam = mockTeamResult(event);
		const joined = baseJoined || mockEventJoined.has(event.id);
		ok(res, {
			id: event.id,
			event,
			joined,
			...(dynamicTeam
				? { team_result: dynamicTeam }
				: joined && event.participant_mode === "team"
					? { team_result: mockTeamFor(event) }
					: {}),
		});
	}],
	["POST", /^\/api\/events\/([^/]+)\/team$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const eventId = m[1];
			const name = String(body.name ?? "").trim();
			if (!name) return json(res, 200, { code: 400, message: "战队名称不能为空", data: null, meta: null });
			if (mockEventJoined.has(eventId)) {
				return json(res, 200, { code: 409, message: "你已在该赛事的战队中，先退出再加入其它战队", data: null, meta: null });
			}
			const team = {
				id: `team-${Date.now()}`,
				event_id: eventId,
				name,
				description: "",
				points: 0,
				created_at: iso(now),
				updated_at: iso(now),
				banned: false,
			};
			mockEventTeams[eventId] = team;
			mockEventJoined.add(eventId);
			return ok(res, team);
		})],
	["POST", /^\/api\/events\/([^/]+)\/team\/([^/]+)\/join$/, (m, res) => {
		const eventId = m[1];
		const team = mockEventTeams[eventId];
		if (!team || team.id !== m[2]) {
			return json(res, 200, { code: 404, message: "战队不存在", data: null, meta: null });
		}
		mockEventJoined.add(eventId);
		return ok(res, null);
	}],
	["DELETE", /^\/api\/events\/([^/]+)\/team\/([^/]+)$/, (m, res) => {
		const eventId = m[1];
		const team = mockEventTeams[eventId];
		if (!team || team.id !== m[2]) {
			return json(res, 200, { code: 404, message: "战队不存在", data: null, meta: null });
		}
		// 退出 = 离开成员关系；战队本身保留，仍可用 Team ID 重新加入。
		mockEventJoined.delete(eventId);
		return ok(res, null);
	}],
	["GET", /^\/api\/events\/([^/]+)\/challenges$/, (_m, res, req) => ok(res, eventChallenges, req)],
	["GET", /^\/api\/events\/([^/]+)\/scoreboard$/, (_m, res) => ok(res, scoreboard)],
	["GET", /^\/api\/events\/([^/]+)\/trend$/, (_m, res) => ok(res, trend)],
	["GET", /^\/api\/events\/([^/]+)\/announcements$/, (_m, res, req) => ok(res, announcements, req)],
	["GET", /^\/api\/events\/([^/]+)\/instances$/, (_m, res) => ok(res, [])],
	["GET", /^\/api\/events\/([^/]+)\/own_wp$/, (_m, res) => ok(res, mockWriteup)],
	["POST", /^\/api\/submit\/writeup$/, (_m, res) => {
		mockWriteup = "writeup.pdf";
		return ok(res, null);
	}],
	["POST", /^\/api\/events\/([^/]+)\/join$/, (_m, res) => ok(res, null)],
	["DELETE", /^\/api\/events\/([^/]+)\/leave$/, (_m, res) => ok(res, null)],

	// 题目
	["GET", /^\/api\/challenges$/, (_m, res, req) => ok(res, challenges, req)],
	["GET", /^\/api\/challenges\/([^/]+)$/, (m, res) => {
		ok(res, challenges.find((item) => item.id === m[1]) ?? challenges[0]);
	}],
	["GET", /^\/api\/challenges\/([^/]+)\/instance$/, (_m, res) => ok(res, null)],
	["GET", /^\/api\/challenges\/([^/]+)\/writeups$/, (_m, res, req) => ok(res, challengeWriteups, req)],
	["GET", /^\/api\/challenges\/([^/]+)\/my_writeup$/, (_m, res) => ok(res, null)],
	["POST", /^\/api\/challenges\/([^/]+)\/submit$/, (_m, res) => ok(res, { correct: true, points: 500 })],
	["GET", /^\/api\/challenge_sets$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/challenge_sets\/([^/]+)$/, (_m, res) => ok(res, null)],

	// 社区
	["GET", /^\/api\/announcements$/, (_m, res, req) =>
		okPage(res, announcements.filter((a) => mockFilterMatch(req, a)), req)],
	["GET", /^\/api\/solves$/, (_m, res, req) => ok(res, solves, req)],
	["GET", /^\/api\/solves\/top15users$/, (_m, res) => ok(res, topUsers)],
	["GET", /^\/api\/writeups$/, (_m, res, req) => ok(res, unifiedWriteups, req)],
	["GET", /^\/api\/writeups\/([^/]+)$/, (_m, res) => ok(res, unifiedWriteupDetail)],
	["GET", /^\/api\/discussions$/, (_m, res, req) =>
		okPage(res, discussions.filter((d) => mockFilterMatch(req, d)), req)],
	["POST", /^\/api\/discussions$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const title = String(body.title ?? "").trim();
			const content = String(body.content ?? "").trim();
			if (!title || !content) {
				return json(res, 200, { code: 400, message: "标题与正文都不能为空", data: null, meta: null });
			}
			const discussion = {
				id: `d-${Date.now()}`,
				title,
				content,
				author_id: me.id,
				author_nickname: me.nickname,
				author_avatar: me.avatar,
				view_count: 0,
				like_count: 0,
				is_liked: false,
				comment_count: 0,
				created_at: iso(now),
				updated_at: iso(now),
			};
			discussions.unshift(discussion);
			return ok(res, discussion);
		})],
	["PATCH", /^\/api\/discussions\/([^/]+)$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const target = discussions.find((d) => d.id === m[1]);
			if (!target) return json(res, 404, { code: 404, message: "讨论不存在", data: null, meta: null });
			if (body.title !== undefined) target.title = String(body.title);
			if (body.content !== undefined) target.content = String(body.content);
			target.updated_at = iso(now);
			return ok(res, target);
		})],
	["DELETE", /^\/api\/discussions\/([^/]+)$/, (m, res) => {
		const index = discussions.findIndex((d) => d.id === m[1]);
		if (index < 0) return json(res, 404, { code: 404, message: "讨论不存在", data: null, meta: null });
		discussions.splice(index, 1);
		discussionComments = discussionComments.filter((c) => c.discussion_id !== m[1]);
		return ok(res, null);
	}],
	["GET", /^\/api\/discussions\/([^/]+)$/, (m, res) => {
		ok(res, discussions.find((item) => item.id === m[1]) ?? discussions[0]);
	}],
	["POST", /^\/api\/discussions\/([^/]+)\/like$/, (m, res) => {
		const target = discussions.find((d) => d.id === m[1]);
		if (!target) return json(res, 404, { code: 404, message: "讨论不存在", data: null, meta: null });
		// 幂等：已点赞再加一次不涨计数。
		if (!target.is_liked) {
			target.is_liked = true;
			target.like_count = (target.like_count ?? 0) + 1;
		}
		return ok(res, null);
	}],
	["DELETE", /^\/api\/discussions\/([^/]+)\/like$/, (m, res) => {
		const target = discussions.find((d) => d.id === m[1]);
		if (!target) return json(res, 404, { code: 404, message: "讨论不存在", data: null, meta: null });
		if (target.is_liked) {
			target.is_liked = false;
			target.like_count = Math.max(0, (target.like_count ?? 0) - 1);
		}
		return ok(res, null);
	}],
	["GET", /^\/api\/discussions\/([^/]+)\/comments$/, (m, res, req) =>
		ok(res, discussionComments.filter((c) => c.discussion_id === m[1]), req)],
	["POST", /^\/api\/discussions\/([^/]+)\/comments$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const content = String(body.content ?? "").trim();
			if (!content) return json(res, 200, { code: 400, message: "评论内容不能为空", data: null, meta: null });
			const comment = {
				id: `c-${Date.now()}`,
				discussion_id: m[1],
				author_id: me.id,
				author_nickname: me.nickname,
				author_avatar: me.avatar,
				content,
				parent_id: body.parent_id ?? null,
				created_at: iso(now),
				updated_at: iso(now),
			};
			discussionComments = [...discussionComments, comment];
			const target = discussions.find((d) => d.id === m[1]);
			if (target) target.comment_count = discussionComments.filter((c) => c.discussion_id === m[1]).length;
			return ok(res, comment);
		})],
	["PATCH", /^\/api\/discussions\/([^/]+)\/comments\/([^/]+)$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const comment = discussionComments.find((c) => c.id === m[2] && c.discussion_id === m[1]);
			if (!comment) return json(res, 404, { code: 404, message: "评论不存在", data: null, meta: null });
			comment.content = String(body.content ?? comment.content);
			comment.updated_at = iso(now);
			return ok(res, comment);
		})],
	["DELETE", /^\/api\/discussions\/([^/]+)\/comments\/([^/]+)$/, (m, res) => {
		discussionComments = discussionComments.filter((c) => !(c.id === m[2] && c.discussion_id === m[1]));
		const target = discussions.find((d) => d.id === m[1]);
		if (target) target.comment_count = discussionComments.filter((c) => c.discussion_id === m[1]).length;
		return ok(res, null);
	}],
	["GET", /^\/public\/(.+)$/, (m, res) => handlePublicFile(m[1], res)],
	["GET", /^\/api\/weapons$/, (_m, res, req) => ok(res, weapons, req)],
	["GET", /^\/api\/instances$/, (_m, res, req) => ok(res, [], req)],

	// AWD 驾驶舱
	["GET", /^\/api\/events\/([^/]+)\/awd\/status$/, (m, res) =>
		ok(res, {
			event_id: m[1],
			status: "running",
			phase: "attack",
			current_round: 3,
			round_count: 8,
			banned: process.env.MOCK_TEAM_BANNED === "1",
			score: 1240 + mockAwdBonus,
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
		ok(res, awdScoreRows())],
	["POST", /^\/api\/events\/([^/]+)\/awd\/submissions$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const flag = String(body.flag ?? "").trim();
			if (!flag.startsWith("FLAG{") || !flag.endsWith("}")) {
				return json(res, 200, { code: 400, message: "flag 不正确", data: null, meta: null });
			}
			mockAwdBonus += 100;
			broadcastSse({ type: "score.updated", sequence: Date.now(), occurred_at: iso(now) });
			return ok(res, null);
		})],
	["POST", /^\/api\/events\/([^/]+)\/awd\/gameboxes\/([^/]+)\/reset$/, (_m, res) => ok(res, null)],
	["GET", /^\/api\/events\/([^/]+)\/awd\/wireguard\/config$/, (_m, res) => ok(res, { config: wireguardConfig })],
	["GET", /^\/api\/events\/([^/]+)\/awd\/ssh-config$/, (_m, res) =>
		ok(res, {
			port: 2222,
			password: "mock-ssh-password",
			instances: awdGameboxes.map((box) => ({
				id: box.id,
				gamebox_ip: box.gamebox_ip,
				username: "root",
				container_name: box.container_name,
				health_status: box.health_status,
			})),
		})],

	// 平台网络（AWD 地址池 + 宿主观测 + 分配账本）
	["GET", /^\/api\/admin\/awd\/network$/, (_m, res) =>
		ok(res, {
			gamebox_pool: "10.42.16.0/20",
			gamebox_event_prefix: 16,
			gamebox_team_prefix: 8,
			wireguard_pool: "10.66.0.0/16",
			wireguard_event_prefix: 21,
			wireguard_team_prefix: 24,
			wireguard_port_min: 51820,
			wireguard_port_max: 51900,
			wireguard_public_endpoint: "vpn.example.edu:51820",
			updated_at: iso(now - 12 * D),
			gamebox_event_capacity: 15,
			gamebox_team_capacity_per_event: 256,
			gamebox_hosts_per_team: 6,
			wireguard_event_capacity: 31,
			wireguard_team_capacity_per_event: 256,
			wireguard_port_capacity: 81,
		})],
	["GET", /^\/api\/admin\/awd\/network\/health$/, (_m, res) =>
		ok(res, {
			nftables: "ok",
			wireguard: "ok",
			docker: "ok",
			firewall_runtime: "nftables",
			floatctf_table: "present",
			docker_firewall_backend: "iptables",
			firewalld: "inactive",
			ipv4_forwarding: "1",
			ipv6_policy: "disabled",
			capability_supported: true,
			notes: [],
		})],
	["GET", /^\/api\/admin\/awd\/network\/allocations$/, (_m, res, req) =>
		ok(
			res,
			[
				{
					event_id: events[1].id,
					event_title: events[1].title,
					kind: "awd",
					cidr: "10.42.16.0/24",
					allocated_at: iso(now - 6 * D),
					released_at: null,
					active: true,
				},
			],
			req,
		)],

	// 管理端
	["GET", /^\/api\/admin\/dashboard\/summary$/, (_m, res) => ok(res, dashboardSummary)],
	["GET", /^\/api\/admin\/events\/([^/]+)\/writeups$/, (m, res, req) => {
		const rows = [
			{
				event_id: m[1],
				user_id: me.id,
				team_id: null,
				file_url: "writeups/event-1/liming.pdf",
				created_at: iso(now - 6 * H),
			},
			{
				event_id: m[1],
				user_id: "u-2",
				team_id: null,
				file_url: "writeups/event-1/byte-me.pdf",
				created_at: iso(now - 4 * H),
			},
		];
		return okPage(res, rows, req);
	}],
	["GET", /^\/api\/admin\/events\/([^/]+)\/report$/, (_m, res) => ok(res, "reports/event-1-report.zip")],
	["GET", /^\/api\/admin\/download$/, (_m, res, req) => {
		const url = new URL(req.url ?? "/", "http://mock.local");
		const key = url.searchParams.get("key") ?? "download.bin";
		return ok(res, `/public/${key.replace(/^\/+/, "")}`);
	}],
	["GET", /^\/api\/admin\/events\/([^/]+)\/users$/, (m, res, req) => {
		return okPage(res, eventUserRows(m[1]).filter((row) => mockFilterMatch(req, row)), req);
	}],
	["POST", /^\/api\/admin\/events\/([^/]+)\/users\/([^/]+)\/banned$/, (m, res) => {
		mockMemberBans.add(`${m[1]}:${m[2]}`);
		return ok(res, eventUserRows(m[1]).find((row) => row.id === m[2]) ?? null);
	}],
	["POST", /^\/api\/admin\/events\/([^/]+)\/users\/([^/]+)\/unbanned$/, (m, res) => {
		mockMemberBans.delete(`${m[1]}:${m[2]}`);
		return ok(res, eventUserRows(m[1]).find((row) => row.id === m[2]) ?? null);
	}],
	["POST", /^\/api\/admin\/events\/([^/]+)\/users$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const ids = eventMemberIds(m[1]);
			const adding = Array.isArray(body.user_id_list) ? body.user_id_list.map(String) : [String(body.user_id ?? "")].filter(Boolean);
			for (const id of adding) if (!ids.includes(id)) ids.push(id);
			return ok(res, null);
		})],
	["DELETE", /^\/api\/admin\/events\/([^/]+)\/users$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const ids = eventMemberIds(m[1]);
			// SDK 发的是 id_list（user_id_list 只是部分端点的别名）。
			const raw = body.id_list ?? body.user_id_list ?? [];
			const removing = Array.isArray(raw) ? raw.map(String) : [];
			const matched = ids.filter((id) => removing.includes(id));
			mockEventMembers[m[1]] = ids.filter((id) => !removing.includes(id));
			return ok(res, matched.length);
		})],
	["GET", /^\/api\/admin\/events$/, (_m, res, req) => okPage(res, adminEvents.filter((e) => mockFilterMatch(req, e)), req)],
	["GET", /^\/api\/admin\/events\/([^/]+)$/, (m, res) => {
		ok(res, adminEvents.find((item) => item.id === m[1]) ?? adminEvents[0]);
	}],
	["GET", /^\/api\/admin\/scheduled_tasks$/, (_m, res, req) => {
		const rows = mockTasks;
		return okPage(res, rows.filter((row) => mockFilterMatch(req, row, { kind: "group_id", name: "task_name" })), req);
	}],
	["POST", /^\/api\/admin\/scheduled_tasks$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const name = String(body.task_name ?? "").trim();
			const key = String(body.task_key ?? "").trim();
			const trigger = String(body.trigger_type ?? "once");
			if (!name || !key) {
				return json(res, 200, { code: 400, message: "任务名称与任务键必填", data: null, meta: null });
			}
			if (trigger === "cron") {
				const cron = String(body.cron_expr ?? "").trim();
				// 后端用 cron 库校验（7 段：秒 分 时 日 月 周 年）；这里做同样的段数检查。
				if (cron.split(/\s+/).filter(Boolean).length !== 7) {
					return json(res, 200, { code: 400, message: "Cron 表达式需要 7 段（秒 分 时 日 月 周 年）", data: null, meta: null });
				}
			}
			const task = {
				id: `t-${Date.now()}`,
				group_id: body.group_id ?? "system",
				task_name: name,
				description: String(body.description ?? ""),
				task_key: key,
				trigger_type: trigger,
				status: "pending",
				enabled: body.enabled !== false,
				protected: false,
				cron_expr: body.cron_expr ?? null,
				execute_at: body.execute_at ?? null,
				created_at: iso(now),
				updated_at: iso(now),
				attempt_count: 0,
				max_attempts: 3,
			};
			mockTasks = [...mockTasks, task];
			return ok(res, task);
		})],
	["PATCH", /^\/api\/admin\/scheduled_tasks\/([^/]+)$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const task = mockTasks.find((item) => item.id === m[1]);
			if (!task) return json(res, 404, { code: 404, message: "任务不存在", data: null, meta: null });
			if (task.protected) return json(res, 200, { code: 400, message: "受保护任务不可修改", data: null, meta: null });
			Object.assign(task, {
				task_name: body.task_name ?? task.task_name,
				task_key: body.task_key ?? task.task_key,
				trigger_type: body.trigger_type ?? task.trigger_type,
				cron_expr: body.cron_expr ?? task.cron_expr,
				execute_at: body.execute_at ?? task.execute_at,
				expires_at: body.expires_at ?? task.expires_at,
				description: body.description ?? task.description,
				enabled: body.enabled ?? task.enabled,
				updated_at: iso(now),
			});
			return ok(res, task);
		})],
	["DELETE", /^\/api\/admin\/scheduled_tasks$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const ids = Array.isArray(body.id_list) ? body.id_list.map(String) : [];
			const removable = mockTasks.filter((task) => ids.includes(task.id) && !task.protected);
			mockTasks = mockTasks.filter((task) => !removable.some((item) => item.id === task.id));
			return ok(res, removable.length);
		})],
	["POST", /^\/api\/admin\/scheduled_tasks\/([^/]+)\/run$/, (_m, res, req) =>
		ok(
			res,
			{
				id: "t-1",
				group_id: "maintenance",
				task_name: "清理过期实例",
				description: "回收超过 24 小时的题目实例。",
				task_key: "cleanup-stale-instances",
				trigger_type: "cron",
				status: "pending",
				enabled: true,
				protected: false,
				cron_expr: "0 */6 * * * *",
				created_at: iso(now - 30 * D),
				updated_at: iso(now),
				attempt_count: 0,
				max_attempts: 3,
			},
			req,
		)],
	["GET", /^\/api\/admin\/events\/([^/]+)\/data$/, (_m, res) =>
		ok(res, {
			event: events[0],
			user_count: eventMemberIds(m[1]).length,
			team_count: 0,
			solved_recent_15: solves.map((solve) => ({
				user_nickname: solve.nickname,
				challenge_name: solve.challenge_name,
				challenge_category: "Misc",
				created_at: solve.created_at,
				bonus_points: 0,
			})),
			event_challenges: eventChallenges.map((item) => ({
				name: item.challenge.name,
				category: item.challenge.category,
				points: item.current_points,
				solved_count: item.solved_count,
				// 后端返回的是比例（0..1），前端 formatPercent 再乘 100；不能直接给百分数。
				solved_percent: Math.min(1, item.solved_count / 42),
			})),
			scoreboard_top10: scoreboard.slice(0, 10),
			trend,
		})],
	["GET", /^\/api\/admin\/challenges$/, (_m, res, req) => okPage(res, challenges.filter((c) => mockFilterMatch(req, c)), req)],
	["GET", /^\/api\/admin\/challenge_sets$/, (_m, res, req) => okPage(res, mockChallengeSets, req)],
	["POST", /^\/api\/admin\/challenge_sets$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const set = {
				id: `set-${Date.now()}`,
				name: String(body.name ?? "未命名题集"),
				description: String(body.description ?? ""),
				created_at: iso(now),
				updated_at: iso(now),
			};
			mockChallengeSets.push(set);
			mockSetChallenges[set.id] = [];
			return ok(res, set);
		})],
	["DELETE", /^\/api\/admin\/challenge_sets$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const ids = Array.isArray(body.id_list) ? body.id_list.map(String) : [];
			mockChallengeSets = mockChallengeSets.filter((set) => !ids.includes(set.id));
			return ok(res, ids.length);
		})],
	["GET", /^\/api\/admin\/challenge_sets\/([^/]+)$/, (m, res, req) => {
		const ids = mockSetChallenges[m[1]] ?? [];
		return okPage(res, challenges.filter((c) => ids.includes(c.id)), req);
	}],
	["POST", /^\/api\/admin\/challenge_sets\/([^/]+)\/challenges$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const list = Array.isArray(body.challenge_id_list) ? body.challenge_id_list.map(String) : [];
			const current = mockSetChallenges[m[1]] ?? (mockSetChallenges[m[1]] = []);
			for (const id of list) if (!current.includes(id)) current.push(id);
			return ok(res, null);
		})],
	["DELETE", /^\/api\/admin\/challenge_sets\/([^/]+)\/challenges$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const list = Array.isArray(body.id_list) ? body.id_list.map(String) : [];
			const current = mockSetChallenges[m[1]] ?? [];
			const matched = current.filter((id) => list.includes(id));
			mockSetChallenges[m[1]] = current.filter((id) => !list.includes(id));
			return ok(res, matched.length);
		})],
	["GET", /^\/api\/admin\/users$/, (_m, res, req) =>
		okPage(res, mockUsers.filter((row) => mockFilterMatch(req, row)), req)],
	["DELETE", /^\/api\/admin\/users$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const ids = Array.isArray(body.id_list) ? body.id_list.map(String) : [];
			const before = mockUsers.length;
			mockUsers = mockUsers.filter((row) => !ids.includes(row.id));
			return ok(res, before - mockUsers.length);
		})],
	["GET", /^\/api\/admin\/users\/([^/]+)\/roles$/, (m, res) =>
		ok(res, { user_id: m[1], username: me.username, roles: [], permissions: [] })],
	["GET", /^\/api\/admin\/permissions$/, (_m, res) =>
		ok(res, [
			{ key: "events.manage", domain: "事件", description: "管理赛事", high_risk: false },
			{ key: "users.manage", domain: "身份", description: "管理账号", high_risk: true },
			{ key: "roles.manage", domain: "身份", description: "管理角色与权限", high_risk: true },
		])],
	["GET", /^\/api\/admin\/permissions\/domains$/, (_m, res) => ok(res, ["事件", "身份"])],
	["GET", /^\/api\/admin\/roles$/, (_m, res) => ok(res, mockRoles)],
	["POST", /^\/api\/admin\/roles$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const key = String(body.key ?? "").trim();
			if (!key) return json(res, 200, { code: 400, message: "角色 key 不能为空", data: null, meta: null });
			if (mockRoles.some((role) => role.key === key)) {
				return json(res, 200, { code: 409, message: "角色 key 已存在", data: null, meta: null });
			}
			const role = {
				id: `r-${mockRoles.length + 1}`,
				key,
				name: String(body.name ?? key),
				description: String(body.description ?? ""),
				protected: false,
				grants_all: false,
				permissions: Array.isArray(body.permissions) ? body.permissions : [],
				user_count: 0,
			};
			mockRoles = [...mockRoles, role];
			return ok(res, role);
		})],
	["PATCH", /^\/api\/admin\/roles\/([^/]+)$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const role = mockRoles.find((item) => item.id === m[1]);
			if (!role) return json(res, 404, { code: 404, message: "角色不存在", data: null, meta: null });
			if (role.protected) return json(res, 200, { code: 409, message: "内置角色不可修改", data: null, meta: null });
			if (body.name !== undefined) role.name = String(body.name);
			if (body.description !== undefined) role.description = String(body.description);
			if (Array.isArray(body.permissions)) role.permissions = body.permissions;
			return ok(res, role);
		})],
	["DELETE", /^\/api\/admin\/roles\/([^/]+)$/, (m, res) => {
		const role = mockRoles.find((item) => item.id === m[1]);
		if (!role) return json(res, 404, { code: 404, message: "角色不存在", data: null, meta: null });
		if (role.protected) return json(res, 200, { code: 409, message: "内置角色不可删除", data: null, meta: null });
		mockRoles = mockRoles.filter((item) => item.id !== m[1]);
		return ok(res, null);
	}],
	["GET", /^\/api\/admin\/logs$/, (_m, res, req) => {
		const rows = [
				{
					id: "log-2",
					ip_address: "10.0.0.9",
					category: "event",
					action: "awd.deploy",
					level: "warn",
					message: "GameBox 部署重试一次后成功",
					details: "retry=1",
					created_at: iso(now - 26 * 60000),
					actor_user_id: me.id,
				},
				{
					id: "log-3",
					ip_address: "10.0.0.9",
					category: "platform",
					action: "helper.control",
					level: "error",
					message: "helper-control 连接超时（示例）",
					details: "timeout=2s",
					created_at: iso(now - 8 * 60000),
					actor_user_id: me.id,
				},
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
		];
		return okPage(res, rows.filter((row) => mockFilterMatch(req, row)), req);
	}],
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
	["GET", /^\/api\/admin\/system\/version$/, (_m, res) => ok(res, "1.0.6")],
	["GET", /^\/api\/admin\/system\/monitor$/, (_m, res) => ok(res, null)],
	["GET", /^\/api\/admin\/docker\/containers$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/admin\/docker\/images$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/admin\/docker\/networks$/, (_m, res, req) => ok(res, [], req)],
	["GET", /^\/api\/admin\/announcements$/, (_m, res, req) => okPage(res, announcements.filter((a) => mockFilterMatch(req, a)), req)],
	["GET", /^\/api\/admin\/discussions$/, (_m, res, req) => okPage(res, discussions.filter((d) => mockFilterMatch(req, d)), req)],
	["POST", /^\/api\/admin\/weapons$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const weapon = {
				id: `w-${Date.now()}`,
				name: String(body.name ?? "未命名武器"),
				category: String(body.category ?? "Misc"),
				description: String(body.description ?? ""),
				has_file: false,
				download_count: 0,
				file_url: "",
				created_at: iso(now),
				updated_at: iso(now),
			};
			weapons.push(weapon);
			return ok(res, weapon);
		})],
	["PATCH", /^\/api\/admin\/weapons\/([^/]+)$/, (m, res, req) =>
		readJsonBody(req).then((body) => {
			const weapon = weapons.find((item) => item.id === m[1]);
			if (!weapon) return json(res, 404, { code: 404, message: "武器不存在", data: null, meta: null });
			weapon.name = body.name ?? weapon.name;
			weapon.category = body.category ?? weapon.category;
			weapon.description = body.description ?? weapon.description;
			weapon.updated_at = iso(now);
			return ok(res, weapon);
		})],
	["POST", /^\/api\/admin\/weapons\/([^/]+)\/upload$/, (m, res, req) => {
		// multipart 表单：mock 不解析内容，只把附件状态置为已上传。
		req.resume();
		req.on("end", () => {
			const weapon = weapons.find((item) => item.id === m[1]);
			if (!weapon) return json(res, 404, { code: 404, message: "武器不存在", data: null, meta: null });
			weapon.has_file = true;
			weapon.file_url = `weapons/${weapon.id}.bin`;
			weapon.updated_at = iso(now);
			return ok(res, null);
		});
	}],
	["DELETE", /^\/api\/admin\/weapons$/, (_m, res, req) =>
		readJsonBody(req).then((body) => {
			const ids = Array.isArray(body.id_list) ? body.id_list.map(String) : [];
			const before = weapons.length;
			for (let index = weapons.length - 1; index >= 0; index -= 1) {
				if (ids.includes(weapons[index].id)) weapons.splice(index, 1);
			}
			return ok(res, before - weapons.length);
		})],
	["GET", /^\/api\/admin\/weapons$/, (_m, res, req) => ok(res, weapons, req)],
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

for (const host of LISTEN_HOSTS) {
	const listener = http.createServer(server.listeners("request")[0]);
	listener.listen(PORT, host, () => {
		console.log(
			`[mock-api] http://${host}:${PORT}  (仅本地预览；数据为 mock，不是真实平台数据)`,
		);
	});
	listener.on("error", (error) => {
		console.error(`[mock-api] 监听 ${host}:${PORT} 失败：${error.message}`);
		process.exitCode = 1;
	});
}
