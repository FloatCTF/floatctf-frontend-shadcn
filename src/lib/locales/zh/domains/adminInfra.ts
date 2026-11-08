/** adminInfra 域文案（中文）。 */

export default {
	specialized: "专属能力",
	docker: {
		documentTitle: "Docker · FloatCTF 控制台",
		title: "Docker",
		description:
			"宿主容器 / 镜像 / 网络治理。所有调用经宿主 helper 的受限协议；若 helper 未就绪，接口会返回 5xx 并在下方显示后端原文。",
		tabs: {
			containers: "容器",
			images: "镜像",
			networks: "网络",
		},
		columns: {
			name: "名称",
			containerId: "容器 ID",
			image: "镜像",
			status: "状态",
			ports: "端口",
			createdAt: "创建时间",
			tags: "标签",
			imageId: "镜像 ID",
			size: "大小",
			driver: "驱动",
			scope: "作用域",
			subnet: "子网",
			gateway: "网关",
			networkId: "网络 ID",
		},
		status: {
			created: "已创建",
			running: "运行中",
			paused: "已暂停",
			restarting: "重启中",
			removing: "删除中",
			exited: "已退出",
			dead: "已失效",
		},
		containers: {
			section: {
				title: "容器",
				description: "服务端按 offset/limit 分页；后端没有过滤接口，搜索只作用于当前页。",
			},
			searchPlaceholder: "在当前页内筛选（名称 / ID / 镜像 / 状态）",
			errorTitle: "加载容器列表失败",
			empty: {
				title: "没有容器",
				description: "宿主上还没有任何容器；如果这里本应有容器，请检查 helper 状态。",
			},
			filtered: {
				title: "当前页没有匹配的容器",
				description: "后端 Docker 接口不支持服务端过滤，请翻页或清空搜索词。",
			},
			portsLabel: "端口",
			actions: {
				start: "启动容器",
				stop: "停止容器",
				delete: "删除容器",
				startShort: "启动",
				stopShort: "停止",
				deleteShort: "删除",
			},
			toast: {
				started: "容器 {{name}} 已启动",
				stopped: "容器 {{name}} 已停止",
				deleted: "容器 {{name}} 已删除",
				startFailed: "启动容器失败",
				stopFailed: "停止容器失败",
				deleteFailed: "删除容器失败",
			},
			confirm: {
				start: {
					title: "启动容器 {{name}}？",
					description: "镜像 {{image}}",
					consequenceResources:
						"容器会以原有配置重新启动，占用宿主端口与资源",
					consequenceLifecycle:
						"若是平台管理的题目 / GameBox 实例容器，可能与实例生命周期状态不一致",
					confirm: "启动",
				},
				stop: {
					title: "停止容器 {{name}}？",
					description: "镜像 {{image}} · 当前状态 {{status}}",
					consequenceProcesses:
						"容器内进程会被终止，未持久化的数据（内存态 / 临时文件）全部丢失",
					consequencePlayers: "选手正在使用的实例环境会立即不可用",
					consequenceRestart:
						"容器不会自动重启（平台实例需要重新启动流程）",
					confirm: "停止容器",
				},
				delete: {
					title: "删除容器 {{name}}？",
					description: "镜像 {{image}} · 状态 {{status}}",
					consequenceData:
						"容器会被强制删除（包括其可写层），容器内数据永久丢失",
					consequenceInstance:
						"若容器仍属于某个赛事实例，平台记录会与被删除的运行时资源不一致",
					consequenceIrreversible: "删除后不可恢复，只能依赖镜像重新创建",
					confirm: "永久删除",
				},
			},
		},
		images: {
			section: {
				title: "镜像",
				description: "服务端按 offset/limit 分页；搜索只作用于当前页。",
			},
			searchPlaceholder: "在当前页内筛选（标签 / ID）",
			errorTitle: "加载镜像列表失败",
			empty: {
				title: "没有镜像",
				description: "宿主上还没有任何镜像；平台镜像通常由构建 / 拉取流程写入。",
			},
			filtered: {
				title: "当前页没有匹配的镜像",
				description: "后端 Docker 接口不支持服务端过滤，请翻页或清空搜索词。",
			},
			actions: {
				delete: "删除镜像",
				deleteShort: "删除",
			},
			toast: {
				deleted: "镜像已删除",
				deleteFailed: "删除镜像失败",
			},
			confirm: {
				title: "删除镜像 {{name}}？",
				description: "镜像 ID {{id}} · 大小 {{size}}",
				consequenceDependents:
					"依赖该镜像的容器将无法再创建 / 重启（正在运行的容器不受影响）",
				consequenceRebuild:
					"重新拉起需要重新拉取或重建镜像，恢复依赖网络与构建时间",
				consequenceIrreversible: "删除后不可恢复",
				confirm: "永久删除",
			},
		},
		networks: {
			section: {
				title: "网络",
				description: "服务端按 offset/limit 分页；搜索只作用于当前页。",
			},
			searchPlaceholder: "在当前页内筛选（名称 / 子网）",
			errorTitle: "加载网络列表失败",
			empty: {
				title: "没有网络",
				description: "宿主上还没有自定义网络；平台靶场网络通常由赛事流程创建。",
			},
			filtered: {
				title: "当前页没有匹配的网络",
				description: "后端 Docker 接口不支持服务端过滤，请翻页或清空搜索词。",
			},
			create: "新建网络",
			actions: {
				delete: "删除网络",
				deleteShort: "删除",
			},
			toast: {
				deleted: "网络已删除",
				deleteFailed: "删除网络失败",
				created: "网络已创建",
				createdDescription: "容器可按名称接入该网络。",
				createFailed: "创建网络失败",
			},
			confirm: {
				title: "删除网络 {{name}}？",
				description: "驱动 {{driver}} · 作用域 {{scope}} · 子网 {{subnet}}",
				consequenceConnectivity:
					"已连接到该网络的容器会失去网络连通性（跨容器通信与网关访问中断）",
				consequenceEndpoints:
					"Docker 拒绝删除仍有活动端点的网络，届时后端会返回具体错误",
				consequenceIrreversible:
					"删除后不可恢复，需要重建网络并重新连接容器",
				confirm: "永久删除",
			},
			form: {
				title: "新建 Docker 网络",
				description:
					"创建自定义 bridge 网络（带显式子网与网关）。名称 / 子网冲突时后端会返回 Docker 原文错误。",
				fields: {
					name: "名称",
					subnet: "子网",
					gateway: "网关",
					driver: "驱动",
				},
				placeholders: {
					name: "例如 fctf-awd-net",
					subnet: "172.20.0.0/16",
					gateway: "172.20.0.1",
				},
				errors: {
					name: "网络名称不能为空",
					subnet: "子网不能为空（例如 172.20.0.0/16）",
					gateway: "网关不能为空（例如 172.20.0.1）",
				},
				driverHint: "默认 bridge。",
				submit: "创建",
				hint: "名称、子网、网关为必填项",
				note: "子网必须与宿主现有网络不重叠；创建成功后可被赛事 / GameBox 分配流程引用。",
			},
		},
	},
	sql: {
		documentTitle: "SQL 控制台 · FloatCTF 控制台",
		title: "SQL 控制台",
		description:
			"直接对平台 PostgreSQL 执行语句。仅限 superadmin，且需要 TOML 打开 [features].unsafe_sql_admin。",
		badge: "极高危",
		actions: {
			clear: "清空",
			execute: "执行",
			executing: "执行中 {{done}}/{{total}}",
		},
		warning: {
			title: "这是生产数据库的直接执行入口",
			body: "写语句不可撤销；执行前需要输入确认词 <mono>{{phrase}}</mono>。多语句会在前端按 `;` 切分后<strong>逐条</strong>提交（后端禁止单请求多语句）；写语句会自动补上 <mono>{{prefix}}</mono> 前缀。",
		},
		editor: {
			title: "语句",
			description:
				"已识别 {{count}} 条语句{{writeNote}}；单条上限 {{max}} 字符，超时 {{timeout}}s。",
			writeNote: "（其中 {{count}} 条为写语句）",
			ariaLabel: "SQL 输入",
			placeholder: "SELECT * FROM users LIMIT 10;",
			examples: "常用查询示例（点击填入）",
		},
		result: {
			title: "执行结果",
			descriptionExecuted: "最近一次执行：{{time}}",
			descriptionIdle: "执行后在此逐条显示结果 / 后端错误。",
			running: "执行中 {{done}}/{{total}}",
			emptyTitle: "还没有执行结果",
			emptyDescription: "输入 SQL 并点击执行；每条语句的结果与错误会分别列出。",
			itemLabel: "#{{index}} {{status}}",
			success: "成功",
			failure: "失败",
			rows: "{{count}} 行",
			rowsAffected: "影响 {{count}} 行",
			elapsed: "{{ms}} ms",
			resultEmpty: "查询没有返回数据行",
			resultCount: "共 {{count}} 行",
		},
		confirm: {
			title: "执行 {{count}} 条 SQL？",
			descriptionWrite:
				"其中 {{count}} 条为写语句（前端会补上后端要求的 ADMIN_CONFIRMED 前缀）",
			descriptionReadOnly:
				"全部为只读查询（select / show / describe / explain / with）",
			consequenceReal:
				"语句在平台生产数据库上真实执行，无法撤销（写语句会立即提交）",
			consequenceDamage:
				"删除 / 更新表数据会导致选手成绩、赛事配置、账号等不可恢复的损坏",
			consequenceTimeout:
				"单条语句超过 5 秒会被后端中断；执行会在审计日志中留下记录（不记录 SQL 正文）",
			consequenceTooLong:
				"{{count}} 条语句超过 {{max}} 字符上限，会被后端直接拒绝",
			consequenceSequential:
				"确认后按顺序逐条执行，任一条失败不会中断后续语句",
			confirm: "执行",
		},
		toast: {
			emptyInput: "请输入至少一条 SQL 语句",
			allDone: "全部 {{count}} 条语句执行完成",
			partial: "{{success}} 条成功，{{failed}} 条失败",
			partialDescription: "逐条结果与后端错误见下方列表。",
		},
		statement: {
			label: "第 {{index}} 条语句",
			tooLong: "语句长度 {{length}} 超过后端上限 {{max}} 字符，未提交",
			failed: "执行失败",
		},
	},
	terminal: {
		documentTitle: "Web 终端 · FloatCTF 控制台",
		title: "Web 终端",
		description:
			"在宿主 helper 上打开的交互式 shell（fish > zsh > bash > sh）。鉴权用一次性 HttpOnly 票据，token 不进入 URL。",
		status: {
			idle: "未连接",
			authorizing: "申请终端票据…",
			connecting: "建立 WebSocket…",
			connected: "已连接",
			closed: "连接已断开",
			error: "连接失败",
		},
		actions: {
			connect: "打开终端",
			reconnect: "重新连接",
		},
		confirm: {
			title: "打开宿主 Web 终端？",
			description: "将在宿主 helper 上启动一个交互式 shell。",
			consequenceHost:
				"命令在宿主上以宿主权限执行，等同于直接操作宿主机",
			consequenceRealtime:
				"对容器 / 网络 / 文件的修改会立即生效且不可撤销",
			consequenceSession:
				"关闭页面或重新连接会结束当前会话；票据一次性，不能复用",
			confirm: "打开终端",
		},
		warning:
			"终端直接落在宿主环境：命令以宿主权限执行，且会真实修改容器 / 网络 / 文件。关闭页面或点「重新连接」会结束当前会话（票据一次性，不能复用）。",
		error: {
			fallback: "终端连接失败",
			withBackend: "{{message}} —— 后端：{{backend}}",
			disabledHint:
				"{{message}}（终端功能可能未在 TOML 打开 [features].enable_web_terminal）",
			wsError: "WebSocket 连接异常（票据可能已过期或被拒绝）",
			closed: "连接已关闭",
			closedWithCode: "连接已关闭（code={{code}}）",
			closedWithReason: "连接已关闭（code={{code}} {{reason}}）",
		},
		section: {
			title: "交互终端",
			description: "WS 端点：<mono>{{url}}</mono>（由 adminBaseUrl 派生）",
			idleTitle: "终端未打开",
			idleDescription:
				"点击右上角「打开终端」建立 WebSocket 会话；该会话等同于宿主 shell 权限。",
			connectedLine: "已连接到平台 Web 终端（ticket 一次性消费）",
		},
	},
	version: {
		documentTitle: "平台版本 · FloatCTF 控制台",
		title: "平台版本",
		description: "前端制品版本与后端 API 版本。",
		stats: {
			api: "平台 API",
			apiHint: "GET /api/admin/system/version",
			runtimeContract: "前端运行时契约",
			runtimeContractHint: "{{name}}（编译期常量）",
			apiContract: "API 契约",
			apiContractHint: "{{name}}（编译期常量）",
			fullVersion: "运行时完整版本",
			fullVersionHint: "{{name}}（仅诊断展示）",
		},
		rows: {
			title: "版本信息",
			version: "前端制品版本（floatctf-web）",
			missing: "后端未返回版本号",
		},
		loading: "查询版本…",
		errorTitle: "查询平台版本失败",
		apiSection: {
			title: "后端 API 版本",
			description: "来自真实接口；失败时显示后端文案并可重试。",
			missing: "（后端未返回版本号）",
		},
		contracts: {
			title: "契约版本说明",
			description:
				"三个版本概念互相独立，前端与注册表的 compatibility 必须与运行时 / API 契约 major 一致。",
			hints: {
				runtime: "破坏 frontend.json 或 mount(context) 契约时变更",
				api: "破坏前端可见的 HTTP API（删字段 / 改语义）时变更",
				full: "含 minor/patch，仅用于诊断展示",
			},
		},
	},
};
