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

## 第 19 轮补充（真实 AWDP 训练）

已完成真实 AWDP 全链路：

- 导入 `examples/test-g`（AWDP-capable）→ 练习目录「开始训练」→ Break 阶段实例启动；
- 错误 flag 被拒绝；真实 flag 提交成功，Break +540，实例标记「已被攻破」；
- 进入 Fix 阶段，实例重置且物化 6 个 Fix 回合；
- `patch.tar.gz` 上传成功；Test Check 返回 Healthcheck 通过 / Judge 通过 / Exploit 已不可利用；
- ALL Check 通过，run 直接结束，总分 1440（Break 540 + Fix 6×150），实例停止。

真实 API 下发现并修复：

- **补丁上传格式前后端不一致**：页面文案和 `accept` 让用户传 `.sh / .patch / .diff / .txt / .zip`，
  但后端只接受 `patch.tar.gz`（gzip tar，根目录含 `patch.sh`）。用户选了 `.sh` 后才收到
  「请上传 patch.tar.gz」。训练场和赛事 AWDP 两处都已改为：
  - `accept=".tar.gz,.tgz,application/gzip"`；
  - 标签改为 `patch.tar.gz`，hint 说明 gzip tar + 根目录 patch.sh；
  - onChange 先做扩展名校验并 toast，不再把格式错误发给后端。
- 补中英文 `patchFormat` 文案。

验证：`vite build` / i18n / theme 全绿（i18n 5019 keys）。

## 第 20 轮补充（开发注册表时间戳）

- 真实 dev 的前端注册表没有安装/更新时间（字段为 epoch 0），页面显示成
  `1970/01/01 00:00`，看起来像真实数据损坏。
- `AbsoluteTime` 现在把 epoch 0 统一渲染为 `—`，注册表更新时间和 default 安装时间
  不再出现 1970；真实时间戳不受影响。
- 移动端 390×844 扫 15 条重点路由：无横向溢出、无 console error；训练 run 的
  “当前阶段不可提交/上传”提示属于预期 gate 文案。

验证：`vite build` / i18n / theme 全绿。

## 第 21 轮补充（AWD 状态机守卫对齐）

真实 AWD 状态机与 `is_configurable()` 并不等价，前端此前把两者当成同一集合：

- `deploy` 之前只要求状态属于 `is_configurable()`，但后端唯一允许进入 `Deploying` 的
  状态是 `Configuring`；`Draft / Deployed / DeployFailed / VerificationFailed` 直接部署
  都会收到 `Invalid transition`。
- `precheck` 之前只要求 `is_configurable()`，但 `Draft` 和 `DeployFailed` 也不能直接进入
  `Prechecking`（合法入口是 `Configuring`；`VerificationFailed` 可以重检）。

现在：

- `DEPLOYABLE_STATUSES` 收紧为仅 `Configuring`；
- 新增 `PRECHECKABLE_STATUSES`，与 `precheck_service` 的真实转移一致；
- 为 `draft / deployed / deployFailed / verificationFailed` 补了可直接展示的禁用原因，
  例如「已部署：修改配置回到配置中后才可重新部署」「部署失败：先修改配置保存回到配置中」；
- 保留上一轮的失败后 `refreshAll`，保证状态变化后按钮不会继续按旧状态可用。

这是对后端 `is_configurable()` 与状态机不一致的前端侧防御；后端最好也在 deploy/precheck
入口自动做 `DeployFailed -> Configuring` 的恢复转移，避免要求用户改一个无关字段。

验证：`vite build` / i18n（5023 keys）/ theme 全绿。

## 第 22 轮补充（AWDP 手动开赛与赛事工作台）

真实 AWDP 赛事链路：

- 创建 `Real AWDP QA`（个人赛），挂载 test-g，选手加入后管理员手动开始比赛；
- 管理员处于 Break 阶段时，选手 `/lab/:eventId` 仍显示「赛事尚未开始」——和上一轮 AWD
  一样，选手端只按 `event.start_time` 判断，忽略了 AWDP 已经真实开赛。
- 现在 AWDP 工作台会先拉 overview；`started_at != null` 时即使 event 时间仍是 upcoming
  也放行。实测手动开赛后选手能看到 Break 阶段、test-g 实例与 360 分 Break 规则。
- 事件 AWDP 的 Break 提交实测 +360；进入 Fix 后错误 `.sh` 会被前端按
  `patch.tar.gz` 规则拒绝，确认两处 AWDP 组件的补丁格式修复都生效。

验证：`vite build` / i18n（5023 keys）/ theme 全绿。

## 第 23 轮补充（AWDP 提前开赛的赛事入口）

上一轮修了 `/lab/:id` 直链，但赛事工作区 `/events/:id` 仍只按 event 时间隐藏 AWDP 标签，
玩家手动提前开赛时找不到入口。本轮补上：

- 赛事工作区在已参赛且 event 仍 upcoming 时，按 family 查询 AWD status / AWDP overview：
  - AWD 为 running / paused / network_error；
  - AWDP 的 `started_at != null`；
  满足则允许内容标签（arena / lab）出现。
- 实测 AWDP 赛事在赛程开始前手动开赛后，`/events/:id` 出现「AWDP 概览」标签，
  点击显示真实 Break 阶段、靶机数与「进入 AWDP 工作台」按钮。
- 赛事头部仍按赛程显示「未开始」，但内容入口已与真实运行态一致；测试赛事已删除。

验证：`vite build` / i18n（5023 keys）/ theme 全绿。

## 第 24 轮补充（提前开赛的参赛状态）

- 提前开赛时赛事头部此前仍只有「未开始」，现在额外显示「已提前开赛」绿色徽章，
  明确这是管理端手动覆盖赛程，而不是把赛程本身改成已开始。
- 参赛卡此前仍提示「赛事开始前可自由加入 / 退出」并允许点退出；现在 `liveBeforeWindow`
  会锁定 JoinLeaveControl / TeamPanel：
  - 说明改为「赛事进行中，参赛名单已锁定」；
  - 退出 / 加入 / 建队 / 退队按钮禁用，title 说明后端同样会拒绝；
  - 实测提前开赛的 AWDP 赛事：头部显示「未开始 + 已提前开赛」，退出按钮 disabled，
    提示为参赛名单已锁定。
- 测试赛事已删除。

验证：`vite build` / i18n（5024 keys）/ theme 全绿。

## 第 25 轮补充（细节与真实文件链路）

- `AbsoluteTime` 上一轮已把 epoch 0 显示为「—」，但 tooltip 仍带 1970；
  现在未知时间连 title 也不输出，前端注册表页不再出现任何 1970 线索。
- 真实 AWDP 训练 Writeup：
  - Markdown 保存成功，刷新后内容仍在；
  - 「插入图片」上传真实 PNG 成功，插入 `/public/images/...` Markdown，Caddy 返回 200；
  - 保存后刷新，图片链接仍在。
- 320×568 扫 15 条重点路由：无横向溢出、无 console error。

验证：`vite build` / i18n（5024 keys）/ theme 全绿。

## 第 26 轮补充（题集创建假失败）

真实后端 `POST /api/admin/challenge_sets` 成功时返回 `data: null`（`ok_none()`），
但 SDK 把返回类型标成 `ChallengeSets`；页面用 `call<ChallengeSets>` 解析，
于是：

- 后端已创建题集；
- 前端却弹「保存题集失败：没有返回数据」；
- 列表不刷新，用户以为没创建，实际库里已经多了一条。

修复：创建与编辑都改用 `callVoid`（页面不使用返回值），成功后 toast + invalidate。
实测创建 `Working Set QA` 成功，列表立即出现；后端记录一致。

验证：`vite build` / i18n（5024 keys）/ theme 全绿。

## 第 27 轮补充（训练生命周期与移动端批量操作）

本轮主要做真实栈回归，未发现新的前端逻辑错误：

- AWDP 训练 run 的 `停止训练`（未运行实例时禁用）、`结束训练`、`重置 run` 均走真实 API：
  - 结束训练成功，run 进入已结束，得分与评测历史保留；
  - 重置 run 成功，提示「run 内实例已重置为原始状态」；
  - `开始训练` / `再次训练` 状态与按钮文案一致。
- 320×568 复扫训练场、训练 run、管理公告、题集、用户等 15 条路由：无横向溢出、无 console error。
- 管理表格移动端卡片保留勾选框；桌面表格的勾选框在移动端隐藏属于预期布局，不是不可操作的假按钮。

验证：`vite build` / i18n（5024 keys）/ theme 全绿。

## 第 28 轮补充（题集创建后进入详情）

题集 Sheet 文案写「创建后进入详情页」，但创建成功只关闭 Sheet、留在列表；用户还要手动找刚创建的题集。

- 创建接口不返回新行（上一轮已改用 callVoid）；
- 现在创建成功后按 `name:<name>` 回查最新一条，取到 id 后 `navigate` 到
  `/admin/challenge-sets/:id`；回查失败不覆盖创建成功，用户仍可在列表点开。
- 实测创建 `Nav Set QA` 后立即跳到详情页，显示名称、ID、0 道题和「添加题目」入口。

验证：`vite build` / i18n（5024 keys）/ theme 全绿。

## 第 29 轮补充（用户/角色 CRUD 与中文题集）

本轮用真实 API 做管理端 CRUD 回归，未发现新的前端逻辑错误：

- 新建用户 `qa-temp-2908` 成功，列表立即出现；确认删除弹窗要求输入账号，删除后列表消失。
- 新建空权限角色 `qa-role-29` 成功；删除弹窗显示持有账号数 0，确认后删除成功。
- 题集创建使用中文名 `中文题集 QA`：创建后按名称回查并自动跳转到详情页，中文 filter 正常。
- 测试用户 / 角色 / 题集均已清理。

验证：`vite build` / i18n（5024 keys）/ theme 全绿。

## 第 30 轮补充（敏感设置编辑）

设置列表已用 `SecretValue` 遮蔽 `SMTP_URI` 等敏感键，但编辑 Sheet 仍用普通 Textarea
把完整值明文显示出来。

- 编辑敏感键时改为 `type=password` 的 Input，默认隐藏；
- 增加「显示原值 / 隐藏原值」眼睛按钮；
- hint 明确这是敏感设置，保存会明文提交给后端；
- 敏感键判定复用列表同一套 `SENSITIVE_KEY_PATTERN`。
- 实测 `SMTP_URI` 编辑：默认 `type=password`，点「显示原值」切到 `text`，再点可隐藏。

验证：`vite build` / i18n（5027 keys）/ theme 全绿。

## 第 31 轮补充（解析值里的 Secret）

上一轮把敏感设置的编辑输入改成 password，但编辑 Sheet 底部的「当前解析值」仍用
`CopyText` 明文展示 `SMTP_URI` 的完整解析结果。

- 敏感键的解析值改用 `SecretValue` 遮蔽；
- 普通设置继续用 `CopyText` 展示/复制；
- 实测 SMTP_URI 编辑：输入框 `type=password`，解析值显示 `••••••••`，
  Sheet 文本中不再出现原始 `SMTP_PASS`。

验证：`vite build` / i18n（5027 keys）/ theme 全绿。

## 第 32 轮补充（头像可解码性）

头像上传只校验 MIME 与大小；一个 8 字节的坏 PNG（`\x89PNG...`）也能通过前端校验，
后端返回成功、toast「头像已更新」，但浏览器无法解码，页面仍是占位符。

- 选择文件后先用 `new Image()` 做一次真实解码探测；
- 解码失败立即 toast「图片无法解码…」，不把坏文件塞进待上传状态；
- 合法 PNG 仍正常进入「待上传」并显示预览。

实测：8 字节坏 PNG 被拦截，合法 tiny PNG 正常进入待上传。

验证：`vite build` / i18n（5028 keys）/ theme 全绿。

## 第 33 轮补充（Markdown 插图可解码性）

头像修完后，MarkdownEditor 的插图仍是 `accept=image/*` + 直接上传：坏 PNG 会拿到
`/public/images/...` URL，正文里留下一个永远裂开的图片。

- 上传前先校验 `file.type.startsWith("image/")`；
- 用 `new Image()` 真实解码一次，失败 toast 且不插入 Markdown；
- 讨论区、Writeup 等所有 MarkdownEditor 共用该逻辑。

实测：8 字节坏 PNG 被拦截且 textarea 保持空；合法 tiny PNG 正常插入 `![...](/public/images/...)`。

验证：`vite build` / i18n（5029 keys）/ theme 全绿。

## 第 34 轮补充（Writeup PDF 魔数）

赛事 Writeup 只按 MIME / 后缀判断 PDF；一个文本文件改名 `fake.pdf` 能进入待提交，
点提交后才收到后端英文错误 `Writeup must be a valid PDF file`。

- 选择文件时读取前 1024 字节，要求包含 `%PDF-`；
- 不匹配时立即中文 toast，`file` 保持空；
- 合法 PDF 仍正常进入待提交状态。

实测：`fake.pdf` 被前端拦截；带 `%PDF-` 头的文件正常显示文件名。
测试赛事已删除。

验证：`vite build` / i18n（5030 keys）/ theme 全绿。

## 第 35 轮补充（补丁 gzip 魔数）

补丁上传已限制 `.tar.gz / .tgz` 后缀，但把文本文件改成这些后缀仍能选中并提交，
后端才报「请上传 patch.tar.gz」。

- 训练场与赛事 AWDP 的补丁 onChange 都读取前 2 字节，要求 gzip 魔数 `1f 8b`；
- 不匹配立即中文 toast，不发起上传；
- 合法 `patch.tar.gz` 仍正常应用。

实测：`fake.tar.gz`（文本）被拦截；真实 gzip tar 补丁仍返回「补丁已应用」。

验证：`vite build` / i18n（5032 keys）/ theme 全绿。

## 第 36 轮补充（题目包 / 靶机包 ZIP 魔数）

题目包与 GameBox 包只校验 `.zip` 后缀；文本文件改名也能进入“待导入”状态，
点开始导入才由后端报解压失败。

- 两个导入入口都读取前 4 字节，要求 ZIP 魔数 `PK` + `03/05/07`；
- 不匹配立即 toast，不设置待导入文件；
- 合法 `test-c.zip` 仍正常进入待导入卡片。

实测：`fake.zip`（文本）被拦截；真实 `test-c.zip` 正常显示待导入卡片。

验证：`vite build` / i18n（5033 keys）/ theme 全绿。

## 第 37 轮补充（题集行操作与真实 CRUD 复查）

本轮继续用真实 API 回归管理端交互，未发现新的前端逻辑错误：

- 题集列表行操作菜单「管理题目 / 编辑 / 删除」均可用；
- 删除确认要求输入题集名称，确认后同时清理 challenge_set_items，题目本身保留；
- 用户创建 / 删除、空权限角色创建 / 删除此前已验证；本轮复查无回归；
- 训练 run 结束后「再次训练」创建新 run，旧 run 得分与历史保留。

验证：`vite build` / i18n（5033 keys）/ theme 全绿；测试题集已删除。

## 第 38 轮补充（PDF 魔数与后端精确对齐）

上一轮客户端只检查前 1024 字节里“包含 `%PDF-`”，但后端实际读取前 5 字节并要求
**精确等于** `%PDF-`；文件前面加一个字符的伪 PDF 仍会通过前端，直到后端拒绝。

- 客户端改为读前 5 字节并精确比较 `%PDF-`；
- 实测 `x%PDF-...` 被前端拦截；标准 `%PDF-` 文件正常进入待提交；
- 测试赛事已删除。

验证：`vite build` / i18n（5033 keys）/ theme 全绿。

## 第 39 轮补充（GameBox 校验与移动端操作）

本轮回归 GameBox 库，未发现新的前端逻辑错误：

- 对 test-g 执行「校验」：真实后端返回「1 个，0 个不可用」，弹窗展示镜像、
  package 目录与可用结论；
- 320×568 下 GameBox 移动卡片保留「编辑 / 校验 / 构建 / 隐藏 / 删除」操作，
  不是只有桌面行才可操作；
- 移动端无横向溢出。

验证：`vite build` / i18n（5033 keys）/ theme 全绿。

## 第 40 轮补充（静态 Flag 编辑遮蔽）

题目标题列表已用 `SecretValue` 遮蔽静态 flag，但编辑 Sheet 的「静态 Flag（明文）」
仍是普通 text input，打开就完整显示。

- 编辑时默认 `type=password`；
- 增加「显示静态 Flag / 隐藏静态 Flag」眼睛按钮；
- 列表遮蔽与编辑输入使用同一份值，保存不受影响；
- 普通字段不变。

实测：Edit QA 的静态 flag 编辑默认 password，点按钮切 text，再点可隐藏。

验证：`vite build` / i18n（5035 keys）/ theme 全绿。
