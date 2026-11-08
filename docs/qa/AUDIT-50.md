# 50 轮走查台账（2026-11-07/08）

环境：`pnpm dev`（:13400）+ `scripts/mock-api.mjs`（:7780）。
说明：mock 数据只用于开发走查，不代表真实平台数据；真实 API 语义以
[`docs/E2E-ACCEPTANCE.md`](../E2E-ACCEPTANCE.md) 与后端守卫为准。

状态：✅ 页面与主要交互走通；△ 页面走通但写操作/边界仍需深测；⏳ 下一轮补。

| # | 范围 | 状态 | 发现 / 处理 |
|---|------|:---:|-------------|
| 1 | 登录 / 注册 / 忘记 / 重置 | ✅ | 空提交两字段报错、焦点落第一个错误；守卫 `next` 统一白名单（拒绝 `//` 与登录页自身）。 |
| 2 | 选手总览 | ✅ | 统计口径与赛事列表一致；`limit` 补 `page=1`，避免后端返回全量；`进行中` 提示改为“已加入的赛事中”。 |
| 3 | 赛事列表筛选/搜索 | ✅ | 家族/状态/仅我参加 + chip 清除正常；共 N / 筛选后 M 正确。 |
| 4 | Jeopardy 赛事工作区 | ✅ | 六个标签均取真实数据；writeup 只对已参赛的 Jeopardy 正式赛展示。 |
| 5 | AWD 赛事工作区 | ✅ | 只保留 总览 / AWD 概览 / 公告；不再显示 Jeopardy 专属积分榜/趋势（后端 400）。 |
| 6 | 练习赛赛事页 | ✅ | 不显示报名入口；工作区闸门引导去题库/训练场。 |
| 7 | 已结束未参赛赛事 | ✅ | 不展示题目/积分榜；说明与锁定原因可见。 |
| 8 | 未开始战队赛 | ✅ | 建队/加入入口、锁定说明、Team ID 可见；不展示题目/实例。 |
| 9 | AWDP 正式赛赛事页 | ✅ | 只保留 总览 / AWDP 概览 / 公告；新增 mock E6 便于验证。 |
| 10 | AWD 驾驶舱 | ✅ | 分数/轮次/阶段/封禁/结算/GameBox/积分榜/网络凭据均渲染；深链闸门先于请求。 |
| 11 | AWD 未参赛/未开始/赛制不符 | ✅ | 不再显示 E2 状态；分别给出未加入/未开始/无此工作区与返回动作。 |
| 12 | AWD flag 提交 | ✅ | 合法 flag 加分并 SSE 刷新；非法 flag 显示后端错误，输入保留。 |
| 13 | AWDP 工作台（正式赛） | ✅ | Break/Fix、实例生命周期、回合、评测、积分榜矩阵、趋势均可用。 |
| 14 | AWDP 练习赛深链 | ✅ | 不再渲染正式工作台，改为“去训练场”。 |
| 15 | 题库练习解题 | ✅ | 启动实例 → 错 flag（错误可见）→ 对 flag（自动回收、已解出）；flag 提交改 `callVoid`。 |
| 16 | 赛事内解题 | ✅ | 赛事实例查询/启动/提交/回收打通；`solved_no` 不再出现 #0。 |
| 17 | 赛事「实例」标签 | ✅ | 只列本赛事实例；行 key 改用 `instance.id` 修复重复 key。 |
| 18 | 我的实例 | ✅ | 列表、类型筛选、统计、详情、单删/批删（AWDP 走批量接口）可用。 |
| 19 | 题集列表 / 详情 | ✅ | 管理端题集同步到选手端；详情返回题目列表。 |
| 20 | 训练场目录 | ✅ | pending/ended 不再显示“进行中”；按钮文案区分进入/继续/查看记录。 |
| 21 | 训练 run 工作台 | ✅ | 阶段、实例、Break/Fix、回合状态（含 evaluating）、评测、积分/Writeup 正常。 |
| 22 | 排行榜 Top15 | ✅ | 按解题数 + 最近解出排序；前三/榜首/最近解出统计正确。 |
| 23 | 解题流水 | ✅ | 后端分页、题目过滤、本页得分合计正确。 |
| 24 | 全站公告 | ✅ | 服务端过滤/分页与空态正常。 |
| 25 | 讨论区列表 | ✅ | 搜索、分页、作者/浏览/点赞/评论数来自后端。 |
| 26 | 讨论详情（d-1/d-2） | ✅ | 评论数与实际列表同源（d-2 已修正为 0）；点赞/评论交互可见。 |
| 27 | 我的讨论 | ✅ | 后端 author_id 过滤；空态与新建入口正常。 |
| 28 | 武器库 | ✅ | 只读、搜索、附件下载、下载计数。 |
| 29 | 题解列表 / 详情 | ✅ | 公开题解与 AWDP 练习题解；作者/邮箱一致（修正 mock 作者漂移）。 |
| 30 | 我的资料 | ✅ | 昵称/邮箱/密码校验、头像类型与 50MB 限制、保存后会话刷新。 |
| 31 | 管理端登录 / 总览 | ✅ | 独立 token；统计数与列表同源；AWD 赛事状态按时间/阶段推导。 |
| 32 | 赛事管理列表 | ✅ | 家族/正式-虚拟分组、搜索、分页；系统托管赛事删除禁用并给原因。 |
| 33 | 赛事控制台 · 配置 | ✅ | 时间保留秒；系统托管字段只读；保存后对选手端生效。 |
| 34 | 赛事控制台 · 题目 | ✅ | 管理端挂题列表；发布/隐藏/移出/调分入口（写接口待补 mock 深测）。 |
| 35 | 赛事控制台 · 成员 | ✅ | 列表/分页/封禁/解封/移出；封禁改 `callVoid`，批量不再误报；添加成员支持账号或昵称搜索。 |
| 36 | 赛事控制台 · 战队 | △ | 列表与封禁入口渲染正常；ban/unban 已改 `callVoid`，mock 深测下一轮。 |
| 37 | 赛事控制台 · 公告 | ✅ | 赛事公告列表/发布/编辑/删除入口；与选手端同源。 |
| 38 | 赛事控制台 · 实例 | ✅ | 实例列表/状态/容器/销毁入口。 |
| 39 | 赛事控制台 · 日志 | ✅ | 级别/操作/详情/操作者/IP/时间；「本人」来自当前会话（管理 token sub 兜底）。 |
| 40 | 赛事控制台 · Writeup / 报告 | ✅ | 列表、下载、报告导出入口。 |
| 41 | 赛事控制台 · 数据大屏 | ✅ | 按赛事取数；AWD/AWDP 榜单映射统一形状；修复 `_m/m` 500 与事件 1 串台。 |
| 42 | 管理端 AWD 运维 | ✅ | 配置/网络/赛事靶机/部署/预检/生命周期/判罚/实例；预检状态大小写归一化。 |
| 43 | 管理端 AWDP 运维 | ✅ | 配置/阶段推进/挂载/实例/积分/数据大屏；阶段与选手端同源。 |
| 44 | 用户管理 | ✅ | 列表/搜索/分页/批量删除；邮箱校验与后端同口径；角色授予 UI 待补。 |
| 45 | 题库管理 | ✅ | 列表/导入/校验/编辑/删除；明文 flag 用 SecretValue。 |
| 46 | 题集管理 / 详情 | ✅ | 列表、增删题、编辑、删除；跨页重复添加仍有边界。 |
| 47 | GameBox 库 / 靶场网络 | ✅ | 库、隐藏、编辑、删除、扫描；地址池设置可保存且自洽。 |
| 48 | 角色 / 日志 / 设置 / 前端 / 计划任务 | ✅ | RBAC、审计日志、受保护设置、前端注册表、Cron 7 段校验；受保护角色补丁不再 409。 |
| 49 | Docker / SQL / 终端 / 版本 | ✅ | 容器/镜像/网络、SQL 确认词、终端票据、版本与契约信息；未实现写接口在 mock 返回 501。 |
| 50 | 404 / 空态 / i18n / 主题 / 构建 | ✅ | 404 在壳内可恢复；中英 4986 key 一致；主题审计、`tsc`、`vite build` 全绿。 |

## 本轮已修复的代表性问题

- **必失败标签**：AWD/AWDP 的「积分榜/趋势/题目/实例」调用 Jeopardy 端点（后端 `require_jeopardy_family` → 400）。
- **深链越权**：`/arena/:id`、`/lab/:id`、赛事题目页在未参赛/未开始/练习赛时仍渲染正式工作区。
- **正确 flag 显示失败**：`/submit/flag` 成功返回 `data:null`，前端用 `call()` 当成契约错误。
- **封禁/解封误报失败**：后端 `ok_none()`，前端用 `call()`。
- **管理端日志「本人」跨作用域**：管理页误调选手端 `/users/me`，缺少选手 token 时会 401 并清 token。
- **数据大屏 500**：mock `_m` 参数却使用 `m[1]`。
- **积分榜「我」标错 / 加分加到榜首**：mock 战队 id 与积分榜行不一致。
- **实例流程断链**：mock 缺赛事实例查询、实例列表恒空、正确 flag 不标记已解出。
- **管理端写操作假成功**：mock 未实现写接口返回 code 0；现改为 501，避免“保存成功但没变化”。
- **交互细节**：趋势图 hover 偏移、表格键盘事件冒泡、移动端无选择、剪贴板假成功、`next=//evil.com`、dashboard limit 不带 page、训练目录状态文案、侧栏 Ctrl+B 劫持。

## 下一轮重点（⏳）

1. 管理端 CRUD 的 mock 深度测试：赛事/用户/公告/题集/讨论/前端设置。
2. 角色授予 UI（`users.getRoles/setRoles`）从“说明有入口”变为真实入口。
3. 赛事战队封禁/解封、跨页重复挂题、受保护设置/密钥展示的完整交互。
4. AWD/AWDP 管理端 PATCH 的乐观锁与冲突提示；配置清空/数值边界的 UI。
5. 移动端全量回归（选择、行操作、表格滚动、命令面板）。
6. 真实 API 回归（本机 dev 栈可用时）：重新按 `docs/E2E-ACCEPTANCE.md` 跑关键路径。

## 复现与验证

```bash
pnpm --filter @floatctf/frontend-shadcn typecheck
pnpm --filter @floatctf/frontend-shadcn build
node scripts/i18n-check.mjs
node scripts/theme-audit.mjs
node scripts/mock-check.mjs
```

## 第 2 轮补充（深测写操作 / 角色授予 / 移动端）

已完成：

- **角色授予**：用户管理行菜单 / 移动端卡片新增「角色与权限」，通过 `users.getRoles` / `users.setRoles`
  整体替换角色集合；显示有效权限数、内置/全权标记；保存后失效用户与角色列表。
- **管理端 CRUD mock**：补齐赛事创建/编辑/删除、用户创建/编辑、赛事题目挂载/调分/移除/发布隐藏、
  赛事公告与全站公告 CRUD、角色详情、题目/题集编辑、Docker 容器启动、练习题解保存。
- **战队封禁/解封**：mock 现在真正写入封禁集合，列表状态与 toast 一致；AWD 运维的 ban 入口同源。
- **AWD 赛事状态按赛事隔离**：未开始的 E5 显示「预检通过 / 加固期 / 未开赛」，不再复用 E2 的
  「进行中 / 攻击期」；管理端生命周期只改本赛事。
- **AWD 配置编辑**：已有「计划开赛」是过去时间时，不再因为未修改的历史值阻止其它字段保存；
  数值字段清空会当场报错（后端无清空语义）。
- **挂题重复保护**：添加题目时按**全量**已挂载集合禁用已挂题目，不再只看当前页；实测移除→重新添加。
- **移动端**：用户卡片补角色入口；移除通用 rowActions 与页面自定义按钮的重复；筛选变化清空不可见选择；
  移动端命令面板、导航、表格选择均可用。

验证：`tsc` / `vite build` / i18n / theme / mock-check 全绿；50 条路由 sweep 0 console error
（训练场 break 阶段不可上传补丁为预期提示）。

## 第 3 轮补充（404 语义 / 持久化写操作 / 数据自洽）

已完成：

- **404 不再伪装成「加载失败」**：不存在的赛事、赛事题目深链接显示「赛事不存在 / 题目不在本赛事」
  与返回列表入口，不再给无意义的重试按钮；题目 / 讨论 / 题解详情仍保留各自的错误态。
- **重置密码会话语义**：成功后清空所有前端 token 再跳登录，避免「请使用新密码登录」却因旧会话
  被守卫送回控制台。
- **管理端跨页去重**：添加成员也按全量 `event_users` 判断已参赛账号，不再只看当前页。
- **mock 写操作持久化**：赛事 GameBox 的 CPU/内存/PID/计分/判题覆盖保存后重开仍生效；GameBox 库
  的 `recommended_*` 与隐藏状态；赛事网络 PUT；删除赛事导致成员/战队同步消失。
- **mock 数据自洽**：战队解出题数收敛到 ≤ 题库题数（6）；AWDP Fix 阶段 3 轮与 `total_rounds` 一致；
  `w-2` 题解详情返回自己的类型/作者/正文；写题解列表按 challenge 过滤；未知 ID 返回 404。
- **mock 覆盖**：补全讨论详情 / 评论删除 / 讨论删除、`POST /users/reset`；`mock-check` 对
  `?token=` 查询串不再误报未覆盖（148/157，剩余 9 条均为本前端未使用的 OIDC 管理端点）。

验证：`tsc` / `vite build` / i18n / theme / mock-check 全绿；选手端 + 管理端 56 条路由 sweep
0 console error（训练场 Break 不可上传补丁为预期提示）。手动复测：创建/退出战队、成员封禁/解封、
删除战队、添加成员、GameBox 配置保存后重开、密码重置后落登录页。

## 第 4 轮补充（挂载写操作 / 运维动作 / 双语与社区细节）

已完成：

- **AWD 挂载 GameBox 真正新增**：此前 POST 无论选哪个都返回第一行（toast 显示 web-01、列表不变）；
  现在按 `gamebox_id` 创建挂载行，自动分配 host_offset，并用库推荐资源；实测移除 pwn-02 →
  重新挂载 pwn-ret2win，行数 1→2 且名称/资源正确。
- **AWD 挂载默认值纠正**：宕机罚分默认 200 → 20、一血加成 20 → 50，与既有挂载行/后端语义一致。
- **AWDP 挂载新增/解除真正生效**：此前同样返回第一行/空操作；现在挂载后列表出现 pwn-ret2win，
  解除后回到 1 行。
- **题集添加文案**：已加入题目现在直接禁用勾选，文案从“重复会被后端拒绝”改成“不可重复勾选”。

深测通过（无代码改动）：

- 战队创建 → 退出 → 非法 Team ID 加入（inline error + toast）。
- 赛事 Writeup 上传（浏览器内构造 PDF）→ 已提交状态与文件名。
- 计划任务立即执行（输入确认词 → 入队 toast）。
- Docker 停止（STOP 确认）→ 已退出；启动 → 运行中。
- SQL 控制台 SELECT（EXECUTE 确认）→ 结果表 + 1 条成功。
- AWD 积分调整 +100 → 总分 4820→4920 并刷新积分榜。
- AWDP Break → Fix（reset 确认）→ 阶段切换、回合 1/3、玩家工作台同步。
- 中英切换后 10 条核心路由无 missing key 警告。

验证：`vite build` / i18n / theme / mock-check 全绿；7 条重点路由 sweep 0 console error。

## 第 5 轮补充（社区删除 404 / 实例批量销毁 / 头像 / 宿主健康语义）

已完成：

- **删除讨论不再留下 404**：详情页删除后 detail/comments 查询仍挂载，原先 invalidate 会在跳转前
  重新请求已删除 id。现在删除成功先禁用/移除详情查询，只失效列表与「我的」；实测 console 0 error。
- **实例批量销毁可用**：mock 缺 `DELETE /api/instances`，页面会显示「未实现」。补齐后
  选中 2 个实例 → 批量销毁 → toast「已销毁 2 个实例」，列表 2→0。
- **头像上传可用**：补齐 `PATCH /api/uploads/avatar`；浏览器内构造 PNG 上传 → 「头像已更新」。
- **宿主网络健康语义对齐**：mock 返回 `ok`，但前端按后端真实值 `Healthy (...)`/`Available` 映射，
  导致「状态缺失 + 原始值 ok」自相矛盾；改为后端同款字符串后显示「正常 / 可用 / 未运行」。
- **健康条目排版**：keyName 与 raw 值之间加分隔，避免渲染成 `nftablesHealthy (mock)`。

深测通过：讨论创建 → 点赞 → 评论 → 编辑 → 删除全链路；实例批量销毁；头像上传；平台网络设置保存；
AWD/AWDP 挂载新增与解除（第 4 轮修复后复测）。

验证：`vite build` / i18n / theme / mock-check 全绿；mock 路由 235 条。

## 第 6 轮补充（题目编辑持久化 / 级联删除 / AWD 数据标签）

已完成：

- **题目编辑真正持久化**：编辑表单提交的 `static_flag_value`、`container_port`、
  `recommended_cpu_millis/memory_bytes/pids_limit` 此前被 mock 丢弃；现在保存后重开
  仍为修改值（实测 flag 与 CPU 150 保持）。
- **题目删除级联**：删除题库题目时同步清理 `eventChallenges` 与题集关联；实测删除
  「逆向：魔改校验」后，选手端赛事题目列表 6→5，不再残留已删除题。
- **AWD/AWDP 不再显示 Jeopardy 专属标签**：赛事控制台对非 Jeopardy 隐藏「题目」「数据大屏」，
  避免出现「挂题数 0 / 累计解出 0」但积分榜有分的矛盾；深链接 `?tab=data` 回退到「配置」，
  AWD/AWDP 使用各自运维页的数据大屏。
- 复测：题库编辑、题目删除级联、AWD/AWDP 控制台标签、移动端无横向溢出、社区删除无 404。

验证：`vite build` / i18n / theme / mock-check 全绿；10 条重点路由 sweep 0 console error。

## 第 7 轮补充（个人赛战队数据 / AWD 通用实例标签）

已完成：

- **个人赛不再显示 AWD 假战队**：`GET /admin/events/:id/teams` 之前对所有赛事返回同一份 AWD 战队，
  导致 E1（Jeopardy 个人赛）出现「个人赛通常没有战队数据」+ 3 支 AWD 战队的矛盾。现在按
  `participant_mode` 返回空列表，E1 显示空状态，E2（AWD 战队赛）仍返回 3 支。
- **AWD/AWDP 隐藏通用「实例 / Writeup」标签**：通用实例是 Jeopardy 语义，AWD 下会显示
  「签到 / Notes 题目实例」，与 AWD 运维页的 GameBox 实例矛盾；现在非 Jeopardy 只保留
  配置 / 成员 / 战队 / 公告 / 日志 + 专属概览，深链接 `?tab=instances/writeups` 回退「配置」。
- 事件 `team_count` 同步按 `participant_mode` 计算，个人赛为 0。

验证：E1 战队空状态、E2 战队 3 行、E1 实例标签仍在、E2/E6 深链接回退配置；
`vite build` / i18n / mock-check 全绿。

## 第 8 轮补充（个人赛隐藏无意义战队标签）

已完成：

- **个人赛事件控制台隐藏「战队」标签**：`participant_mode=individual` 时不再显示一个只能打开空状态的
  标签；深链接 `?tab=teams` 回退到「配置」。战队赛（E2）仍保留「战队」标签。
- 复测个人赛 teams 接口已按 `participant_mode` 返回空列表（E1），战队赛返回 3 行（E2），
  标签显隐与接口语义一致。
- 回归：AWD/AWDP 非 Jeopardy 标签收敛、E1 实例/Writeup 标签、社区删除无 404、移动端无横向溢出。

验证：`vite build` / i18n / theme / mock-check 全绿。

## 第 9 轮补充（无效题集 ID / 空状态去重）

已完成：

- **无效题集不再显示第一个题集**：mock 的管理端题集列表忽略 `filter=id:...`，导致
  `/admin/challenge-sets/does-not-exist` 显示 set-1 的详情。现在按查询过滤；找不到时
  显示「题集不存在 + 返回题集列表」。
- **无效题集只显示一个空状态**：原先页面先渲染「题集里还没有题目」再渲染「题集不存在」；
  现在确认无 meta 时提前返回 NotFoundBlock，不再出现「添加题目」等对无效 ID 可执行的动作。
- 复测：`set-1` 正常显示名称/描述/题目；无效 ID 只有 not-found 块；题集添加/移出仍正常。

验证：`vite build` / i18n / mock-check 全绿。

## 第 10 轮补充（无效题目深链接）

已完成：

- **选手端无效题目显示 not-found**：`/challenges/does-not-exist` 原先显示「加载题目失败 + 重试」，
  重试不会让不存在的题目出现。现在显示「题目不存在 + 返回题库」，不再提供无效重试。
- 补中英文 `jeopardy.detail.notFound*` / `backToCatalog` 文案；有效题目详情不受影响。
- 复测：无效题目只有 not-found 块；`/challenges/c-0003` 正常进入工作台。

验证：`vite build` / i18n / theme / mock-check 全绿。

## 第 11 轮补充（无效训练 Run / AWD·AWDP 无效赛事）

已完成：

- **无效训练 Run 不再被伪造**：mock 的 `GET /service/awdp/runs/:id` 对任意 id 都返回一份可操作
  的 run，导致 `/training/runs/does-not-exist` 显示 web-shop 工作台和「run does-not」。
  现在只接受真实存在的 run-1 / run-2 / run-done，其它返回 404；页面显示「未找到该训练 run +
  返回训练场」。
- **AWD/AWDP 无效赛事深链接**：`/arena/does-not-exist`、`/lab/does-not-exist` 原先显示
  「加载赛事信息失败 + 重试」；现在显示「赛事不存在 + 返回赛事列表」，不再给无效重试。
- 复测：`/training/runs/run-1`、`/arena/<真实赛事>`、`/lab/<真实赛事>` 正常。

验证：`vite build` / i18n / theme / mock-check 全绿。

## 第 12 轮补充（无效讨论深链接）

已完成：

- **选手端无效讨论显示 not-found**：`/community/discussions/does-not-exist` 原先显示
  「加载讨论失败 + 重试」；现在显示「讨论不存在 + 返回讨论区」，不再提供无效重试。
- 补中英文 `community.discussions.detail.notFound*` / `backToDiscussions` 文案。
- 实现时先放在 `useDocumentTitle` 后，触发 React「Rendered fewer hooks than expected」；
  已把早退移到全部 hooks/回调之后，并复测无效/有效讨论均正常。
- 复测：`d-2` 正常显示正文/点赞/评论；无效 ID 只有 not-found 块。

验证：`vite build` / i18n / theme / mock-check 全绿。

## 第 13 轮补充（题解详情链接与无效题解）

已完成：

- **「打开训练 Run」用错 ID**：GameBox 题解详情把 `writeup.id`（w-2）当成 run id，
  跳到 `/training/runs/w-2`（上一轮已让未知 run 返回 404）。现在改用
  `writeup.content_id`（run-1），实测正确进入训练工作台。
- **无效题解显示 not-found**：`/writeups/does-not-exist` 原先显示「加载题解失败 + 重试」；
  现在显示「题解不存在 + 返回题解列表」。
- 补中英文 `community.writeups.detail.notFound*` 文案。
- 复测：w-2 正文/作者/打开 Run 正常；无效 ID 只有 not-found 块。

验证：`vite build` / i18n / theme / mock-check 全绿。

## 第 14 轮补充（选手端无效题集）

已完成：

- **选手端无效题集显示 not-found**：后端 `GET /challenge_sets/:id` 对不存在的 id 返回空数组，
  与「空题集」无法区分。现在详情页同时读题集列表（与列表页同 queryKey，通常命中缓存），
  确认 id 不存在时显示「题集不存在 + 返回题集」，不再显示“题集里还没有题目”的误导空状态。
- 补中英文 `jeopardy.setDetail.notFound*` 文案。
- 复测：`/challenge-sets/does-not-exist` 只有 not-found；`set-1` 正常显示 1 道题与已解出状态。

验证：`vite build` / i18n / theme / mock-check 全绿（i18n 5013 keys）。

## 第 15 轮补充（AWD Flag 提交）

已完成：

- **AWD 提交 flag 不再接受任意 flag**：mock 的 `/events/:id/awd/submissions` 只校验
  `flag{...}` 形状，`flag{wrong}` 也会成功。现在改为精确比对 mock 正确 flag，
  错误返回业务错误（toast + inline error），正确才加攻击分并广播 SSE。
- 实测：E2 提交 `flag{wrong}` → 「提交 flag 失败 / flag 错误」；提交
  `flag{mock_awd_flag}` → 「flag 已提交」，我的分数 3520→3620。
- 移除重复的 submissions 路由，只保留一条并复用 `mockAwdBonus`，避免两份实现分叉。

验证：`vite build` / i18n / theme / mock-check 全绿。

## 第 16 轮补充（AWDP Break 提交）

已完成：

- **AWDP Break 提交不再接受任意 flag**：mock 的 `/events/:id/awdp/gameboxes/:id/break`
  原先只要调用就返回 `{accepted:true, scored:true}`。现在精确比对 mock 正确 flag：
  错误返回 `accepted:false`（UI「flag 未被接受」），正确才进入计分/已攻破分支。
- **已攻破状态自洽**：fixture 中 E6 web-shop 已是「已被攻破」；初始把该 gamebox 放入
  broken 集合，重复提交返回 `already_broken:true, scored:false`，不再从 200 分莫名加到 400。
- 删除重复的 break 路由，只保留一条；正确首次提交才 +200 并广播 SSE。
- 实测：错误 flag → 「flag 未被接受」；正确但已攻破 → 「该靶机此前已被攻破，本次提交不计分」，
  分数保持 200。

验证：`vite build` / i18n / theme / mock-check 全绿。

## 第 17 轮补充（真实 dev API E2E）

已启动真实开发栈并完成端到端验证：

- 宿主机：安装 `build-essential`（补齐 `cc`）、启动 `floatctf-helper`、把开发者加入 `floatctf` 组；
  `mise` 固定 `postgres@18.6`；PostgreSQL / Redis / RustFS / Caddy 容器健康，60 个 migrations 全部应用；
  API `:9090`、Caddy `:7780`、Default Vite `:13000`、shadcn Vite `:13400`。
- shadcn 以真实 API 登录 `1000000 / testuser` 与 `sysadmin`，不再使用 mock。

真实 API 下发现并修复：

- **练习赛没有官方数据大屏**：真实后端对 practice 返回 400
  `UnsupportedForPurpose: practice has no official event scoreboard`。管理端现在对
  `purpose != competition` 隐藏「数据大屏」，深链接回退「配置」。
- **手工建题中文名无提示**：后端要求从 name 派生 safe_name，中文名会返回
  `CHALLENGE_SAFE_NAME_REQUIRED`。前端在创建前校验并提示「加入英文字母/数字，或使用题目包导入」，
  不再把技术错误直接抛给用户。
- **趋势图单点重复 key**：真实数据只有一个解出时间时，趋势图的三个 x tick 完全相同，
  React 报 `two children with the same key`。现在 `maxX === minX` 只渲染一个 tick。

真实 E2E 链路：

1. PostgreSQL 空库登录 → 管理端导入 `examples/test-c` 题目包 → build ready；
2. 创建 `Real QA Event`、设置进行中时间、挂载并发布 test-c；
3. 选手加入赛事 → 启动真实容器实例 → 从容器 `/flag` 取 flag 提交；
4. 成功计分（100 → 动态 99.95）、`已解出 #1`、实例自动回收；
5. 选手积分榜 / 趋势、管理端数据大屏均显示真实数据；21 条重点路由 sweep 0 console error。

测试数据已清理：删除 `Real QA Event`、2 道测试题目与 `floatctf/test-c` 镜像；系统练习赛事保留。
仍待：真实 AWD/AWDP 全流程（需要更多 fixture）；v0.2 截图重采。

## 第 18 轮补充（真实 AWD E2E）

已完成真实 AWD 全链路：

- 构建 `floatctf/awd-flagserver:latest`、`floatctf/awd-judgeserver:latest`、
  `floatctf/infra/awdp-judgeserver:latest`；加载 `br_netfilter` 并开启 bridge netfilter。
- 导入 `examples/test-g` GameBox → 开通 AWD → 自动分配网络 → 挂载 GameBox → 选手先建队 →
  部署 → 预检通过 → 开赛 → HardeningEnd → Attack 第 1 轮。
- 选手驾驶舱真实显示 GameBox `test-g`（10.0.1.2）、WireGuard 配置、积分榜；
  错误 flag 被后端拒绝（`flag 无效或已过期`）；GameBox 重置成功；暂停/恢复均成功。

真实 API 下发现并修复：

- **部署失败后状态查询不刷新**：首次部署失败进入 `deploy_failed`，但页面仍显示旧
  `configuring`，部署按钮可用，再点收到 `Invalid transition: DeployFailed -> Deploying`。
  现在生命周期动作失败后立即刷新所有 AWD 状态；`DeployFailed` / `VerificationFailed`
  不再标成可部署，按钮禁用并给出“修改任意配置字段并保存后回到配置中”的恢复提示。
- **手工开赛后选手端仍被赛程挡住**：管理员可在 event.start_time 之前手动开赛，此时
  AWD 已 running，但选手端只按 event 时间判定 `upcoming`，进入竞技场显示“赛事尚未开始”。
  现在 AWD 状态为 running / paused / network_error 时，优先信任 AWD 权威状态放行。
- 保留真实 AWD 观测到的两个后端契约缺口，不在前端伪造：
  1. `DeployFailed` 属于 `is_configurable()`，但状态机只允许 `DeployFailed -> Configuring`，
     直接 deploy 永远非法；需要后端在 deploy 入口自动先回 Configuring，或前端提供一键恢复。
  2. 队伍在 deploy 之后创建时，预检仍可通过，但该队没有 GameBox/网络段；开赛后选手端只能
     看到“需要管理员重新部署”，而 running 状态又不允许重新部署。

测试数据已清理：删除 AWD 赛事、test-g GameBox 与镜像；保留运行时基础镜像供后续真实 AWD 回归。
验证：`vite build` / i18n / theme 全绿；清理后 10 条重点路由 0 console error。
