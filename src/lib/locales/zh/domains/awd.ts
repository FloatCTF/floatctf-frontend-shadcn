/** awd 域文案（中文）。 */

export default {
	documentTitle: "{{title}} · FloatCTF",

	/** `call(...)` 的动作名（只在后端未给文案时进入兜底错误）。 */
	actionNames: {
		status: "AWD 赛事状态",
		event: "赛事详情",
		submitFlag: "提交 flag",
		gameboxList: "GameBox 列表",
		resetGamebox: "重置 GameBox",
		scores: "AWD 积分榜",
		wireguard: "WireGuard 配置",
		ssh: "SSH 凭据",
	},

	arena: {
		titleFallback: "AWD 驾驶舱",
		description:
			"AWD 竞赛驾驶舱：提交 flag 攻击对手、监控并重置自己的 GameBox、下发网络凭据。",
		loading: "加载 AWD 赛事状态…",
		retryCheck: "重新检查",

		breadcrumbs: {
			label: "面包屑",
			events: "赛事",
			workspace: "赛事工作区",
			current: "AWD 驾驶舱",
		},

		banned: {
			title: "你的队伍已被禁赛",
			description:
				"禁赛期间 flag 提交、GameBox 重置与网络访问均被后端拒绝；如有疑问请联系赛事管理员。",
		},
		settlement: {
			title: "最终结算中",
			description:
				"最后一轮已结束，Judge 仍在结算；比赛已关闭，不再接受新的提交。",
		},

		empty: {
			title: "暂无 AWD 数据",
			description: "后端没有返回 AWD 状态；请刷新页面或联系管理员。",
		},
		errors: {
			status: "加载 AWD 状态失败",
			event: "加载赛事信息失败",
		},
		notEnabled: {
			title: "该赛事未启用 AWD",
			description: "本赛事没有 AWD 赛制配置；请从赛事列表确认赛制，或联系管理员。",
			action: "返回赛事列表",
		},
		forbidden: "你不是本赛事的参赛成员（或已离队），无法查看 AWD 驾驶舱。",

		sections: {
			state: {
				title: "轮次与状态",
				description: "阶段与轮次由后端推进，本页只展示真实值。",
			},
			tips: {
				title: "攻击流程提示",
				description: "能力语义与 Default 一致，操作路径由本前端重新设计。",
			},
		},

		stats: {
			score: "我的分数",
			scoreHint: "攻击分 + 防守分",
			round: "当前轮次",
			roundHintUnknown: "总轮次未配置",
			roundHint: "共 {{rounds}} 轮",
		},
		fields: {
			status: "赛事状态",
			phase: "阶段",
			teamStatus: "队伍状态",
			finalSettlement: "最终结算",
		},
		event: {
			family: {
				jeopardy: "Jeopardy 解题",
				awd: "AWD 攻防",
				awdp: "AWDP 攻防",
				unknown: "未知赛制",
			},
			joined: "已加入赛事",
			notJoined: "尚未加入赛事",
			schedule: "赛程",
			status: {
				upcoming: "未开始",
				ongoing: "进行中",
				ended: "已结束",
				unknown: "时间未知",
			},
		},
		tips: {
			wireguard: "先用 WireGuard 接入赛事内网，再用 SSH 登录自己的 GameBox（见上方网络凭据）。",
			phases:
				"在<strong>加固期</strong>只允许修复自身漏洞；进入<strong>攻击期</strong>后才能提交 flag。",
			reset: "重置 GameBox 会销毁并按原始镜像重建容器，受免费次数与罚分约束，请谨慎使用。",
			back: "返回赛事工作区",
		},
	},

	state: {
		unknown: "未知",
		teamBanned: "已禁赛",
		teamNormal: "正常",
		settlementActive: "进行中",
		settlementInactive: "否",
		status: {
			draft: "草稿",
			configuring: "配置中",
			deploying: "部署中",
			deployed: "已部署",
			prechecking: "预检中",
			verified: "已验证",
			running: "进行中",
			paused: "已暂停",
			networkError: "网络异常",
			startBlocked: "启动受阻",
			finished: "已结束",
			archived: "已归档",
			deployFailed: "部署失败",
			verificationFailed: "验证失败",
		},
		phase: {
			hardening: "加固期",
			attack: "攻击期",
			pause: "暂停",
		},
		gamebox: {
			pending: "等待中",
			creating: "创建中",
			running: "运行中",
			ready: "就绪",
			resetting: "重置中",
			missing: "缺失",
			orphan: "孤儿容器",
			conflict: "资源冲突",
			startFailed: "启动失败",
			resetFailed: "重置失败",
			stopped: "已停止",
		},
	},

	gate: {
		notConfigured: "AWD 尚未配置。",
		banned: "你的队伍已被禁赛，所有选手端操作已关闭。",
		finished: "比赛已结束。",
		finalSettlement: "最终结算中 —— 比赛已关闭，等待 Judge 结算完成。",
		paused: "比赛已暂停。",
		networkError: "基础设施网络异常，暂不可操作。",
		hardening: "攻击尚未开始（加固期）。",
		notAttack: "当前阶段不可提交 flag。",
		resetClosed: "当前阶段不可重置 GameBox。",
	},

	flag: {
		title: "提交 flag",
		description: "提交从对手 GameBox 中取到的 flag，按赛事规则计入攻击得分。",
		round: "第 {{round}} 轮",
		label: "flag",
		hint: "flag 只提交给后端校验，不会写入 URL 或日志。",
		placeholder: "flag{...}",
		submit: "提交",
		submitting: "提交中…",
		success: "flag 已提交",
		error: "提交 flag 失败",
	},

	gamebox: {
		title: "我的 GameBox",
		description: "只显示你所在队伍在本赛事中的实例；IP 通过 WireGuard / 内网访问。",
		loadError: "加载 GameBox 失败",
		empty: {
			title: "暂无 GameBox",
			description:
				"赛事可能尚未部署，或你的队伍在部署之后才创建（需要管理员重新部署）。",
		},
		columns: {
			name: "靶机",
			ip: "IP",
			status: "状态",
			health: "健康",
		},
		reset: "重置",
		resetting: "重置中…",
		resetHint: "重置该 GameBox",
		healthValue: "健康：{{health}}",
		confirm: {
			title: "重置 GameBox「{{name}}」？",
			description: "重置是破坏性操作，会销毁容器并按原始镜像重建。",
			action: "重置",
		},
		consequences: {
			dataLoss:
				"GameBox 容器会被销毁，并按原始镜像重新构建：你在容器内的所有修改都会丢失。",
			penalty:
				"重置受赛事配置的免费重置次数与超次数罚分约束 —— 免费次数用尽后继续重置会按赛事规则扣分。",
			downtime:
				"重置期间该 GameBox 会短暂不可用，SSH / WireGuard 连接可能中断，需要重新连接。",
		},
		success: {
			title: "已请求重置 GameBox",
			description: "容器将按原始镜像重建，稍后刷新查看状态。",
		},
		resetError: "重置 GameBox 失败",
	},

	board: {
		title: "实时积分榜",
		description: "攻击分 = 提交有效 flag；防守分 = GameBox 存活情况。",
		loadError: "加载积分榜失败",
		empty: {
			title: "暂无积分",
			description: "比赛开始并产生得分后这里会更新。",
		},
		columns: {
			rank: "排名",
			team: "队伍",
			attack: "攻击",
			defense: "防守",
			total: "合计",
		},
		myTeam: "我的队伍",
		you: "（我）",
		mobileSummary: "攻击 {{attack}} · 防守 {{defense}}",
	},

	network: {
		title: "网络凭据",
		description: "通过 WireGuard 接入赛事内网，再用 SSH 登录自己的 GameBox。",
		tabs: {
			wireguard: "WireGuard",
			ssh: "SSH",
		},
	},

	wireguard: {
		loadError: "获取 WireGuard 配置失败",
		empty: {
			title: "暂无 WireGuard 配置",
			description: "后端尚未下发隧道配置；赛事部署完成并加入队伍后这里会出现。",
		},
		copy: "复制 .conf",
		copyAria: "复制 WireGuard 配置",
		download: "下载 .conf",
		note: "私钥只在首次下发时返回；请立即保存，丢失后需要联系管理员轮换密钥。",
		privateKey: "WireGuard 私钥",
	},

	ssh: {
		loadError: "获取 SSH 凭据失败",
		empty: {
			title: "暂无 SSH 凭据",
			description: "后端尚未返回本队的 SSH 凭据；赛事部署完成后这里会出现。",
		},
		noInstances: {
			title: "暂无实例",
			description: "队伍还没有部署 GameBox，或部署尚未完成。",
		},
		port: "端口",
		portLabel: "SSH 端口",
		password: "密码（队伍共享）",
		passwordLabel: "SSH 密码",
		download: "下载凭据",
		commandLabel: "SSH 命令",
		columns: {
			ip: "IP",
			username: "用户名",
			health: "健康",
			command: "连接命令",
		},
		file: {
			title: "FloatCTF AWD SSH 凭据（赛事 {{eventId}}）",
			port: "端口：{{port}}",
			password: "密码：{{password}}",
		},
	},

	credentials: {
		eventNetwork: {
			title: "赛事网络尚未分配",
			description:
				"管理员尚未为这场赛事分配 GameBox / WireGuard 网段，也未完成部署；分配并部署后这里会出现你的 WireGuard 配置与 SSH 凭据。",
		},
		teamNetwork: {
			title: "队伍网络尚未分配",
			description:
				"赛事网络已分配，但你的队伍还没有网络段（通常发生在队伍晚于部署创建）；需要管理员重新部署。",
		},
		notJoined: {
			title: "尚未加入战队",
			description: "加入本赛事的战队后，即可领取 WireGuard 配置与 SSH 凭据。",
		},
		privateKey: {
			title: "私钥已下发过",
			description:
				"WireGuard 私钥只在首次拉取时返回；如需重新获取，请联系管理员轮换密钥。",
		},
		notReady: {
			title: "网络凭据尚未可用",
			description:
				"赛事尚未部署完成，或你的队伍还没有可用实例；管理员部署后这里会出现凭据。",
			descriptionWithMessage:
				"{{message}} —— 赛事尚未部署完成，或你的队伍还没有可用实例；管理员部署后这里会出现凭据。",
		},
		accessClosed: {
			title: "网络访问已关闭",
			description: "赛事已结束或正在最终结算，网络访问已关闭。",
			descriptionWithMessage: "{{message}}",
		},
	},
};
