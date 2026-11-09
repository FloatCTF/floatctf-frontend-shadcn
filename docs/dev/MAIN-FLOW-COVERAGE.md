# shadcn 主流程覆盖审计

> 目标：信息架构、子页面层级与操作逻辑以 Default 为准；只保留 shadcn 主题与组件。
> 本表只记录**真实 API 验收到**的能力；未验收项明确标注。

## 选手端

| 页面 | Default 对齐点 | 状态 |
| --- | --- | --- |
| `/rank` | Top 15 单表：排名 / 选手 / 解出数 / 最近解出 | 目标站验收 |
| `/events` | 赛事 / 家族 / 参赛者 / 状态 / 可加入 / 时间窗，FilterBar | 目标站验收 |
| `/events/:id` | 总览 / 题目 / 实例 / 积分榜 / 趋势 / 公告；未参赛保留总览+公告 | 目标站验收（已参赛 + 未参赛） |
| `/events/:id/challenges/:cid` | 赛事题目工作台与 flag 提交 | 代码路径复用 |
| `/challenges` | 题目 / 分类 / 状态 / 作者 / 版本 / 更新时间 | 目标站验收 |
| `/challenges/:id` | 左侧 Challenge/WriteUp、右侧常驻我的题解 | 目标站验收 |
| `/challenge-sets` | FilterBar + 名称进入题集详情 | 目标站验收 |
| `/challenge-sets/:id` | 题集详情；题目名称打开弹窗查看/启动/提交 Flag | 目标站验收（URL 不切换） |
| `/gameboxes` | 名称 / 分类 / 已解出 / 作者 / 版本 / 更新 | 目标站验收 |
| `/instances` | 内容 / 类型 / 状态 / 赛事 / 标识 / 用户 / 销毁时间 | 目标站验收 |
| `/solves` | 题目 / 用户 / 更新时间 | 目标站验收 |
| `/community/announcements` | 发布者 / 标题 / 内容 / 创建 / 更新 | 目标站验收 |
| `/community/discussions` | 标题 / 作者 / 浏览 / 点赞 / 评论 / 创建 | 目标站验收 |
| `/community/discussions/:id` | 单列：正文在上、评论在下 | 目标站验收 |
| `/writeups` | 内容 / 作者 / 类型 / 邮箱 / 更新 | 目标站验收 |
| `/writeups/:id` | 页头作者/邮箱/时间，正文单卡 | 目标站验收 |
| `/arsenal` | 名称 / 分类 / 描述 / 有附件 / 文件地址 / 更新 | 目标站验收 |
| `/profile` | 左字段、右头像，编辑/取消/保存 | 目标站验收 |
| AWD 赛事 | 总览 / 靶机箱 / 积分榜 / WireGuard / SSH；未参赛可建队/入队 | 目标站临时赛事验收 |
| AWDP 赛事 | 总览 / 靶机箱 / 轮次 / 积分榜 / 趋势 / 公告；个人赛 Join/Leave | 目标站临时赛事验收 |

## 管理端

| 页面 | Default 对齐点 | 状态 |
| --- | --- | --- |
| `/admin` | 统计 / 赛事 / 需要关注 / 最近活动 / 基础设施 | 目标站验收 |
| `/admin/events` | ID / 赛制 / 参赛者 / 标题 / 状态 / 隐藏 / 可加入 / 时间 | 目标站验收 |
| 赛事控制台 Jeopardy | 题目 / 用户 / 公告 / WriteUps / 日志 / 数据大屏 / 实例 | 目标站验收 |
| 赛事控制台 AWD | 配置 / 总览 / 靶机箱 / 网络 / 运维操作 / 实例 / 战队 / 公告 / WriteUps / 日志 | 目标站验收 |
| 赛事控制台 AWDP | 配置 / 概览 / 靶机箱 / 积分榜 / 公告 / WriteUps / 日志 / 数据大屏 / 实例 | 本地路径 + 构建 |
| `/admin/challenges` | ID / 题目 / 安全名 / 分类 / 版本构建 / 镜像 / 可见性 | 目标站验收 |
| `/admin/challenge-sets` | ID / 题集 / 描述 / 创建时间；行编辑抽屉 | 目标站验收 |
| `/admin/gameboxes` | 名称 / 安全名 / 版本构建 / 镜像 / 可见性 | 目标站验收 |
| `/admin/network` | 平台网络设置 / 健康 / 分配 | 目标站验收 |
| `/admin/community/announcements` | ID / 标题 / 内容 / 发布者 / 创建 / 更新 | 目标站验收 |
| `/admin/community/discussions` | ID / 标题 / 作者 / 浏览 / 点赞 / 评论 / 创建 / 更新 | 目标站验收 |
| `/admin/community/weapons` | ID / 名称 / 分类 / 有附件 / 文件地址 / 更新 | 目标站验收 |
| `/admin/platform/users` | ID / 用户名 / 昵称 / 邮箱 | 目标站验收 |
| `/admin/platform/roles` | ID / 标识 / 名称 / 说明 / 权限 / 内置 / 持有账号 | 目标站验收 |
| `/admin/platform/logs` | ID / 分类 / 操作 / 级别 / 消息 / 主体 / IP / 详情 / 时间 | 目标站验收 |
| `/admin/platform/settings` | ID / 键 / 值 / 解析值 / 描述 / 类型 / 更新 | 目标站验收 |
| `/admin/platform/frontends` | 当前生效前端下拉 + 保存/刷新 | 目标站验收 |
| `/admin/platform/tasks` | ID / 名称 / 键 / 触发 / 状态 / Cron / 执行 / 启用 / 受保护 / 上次 / 更新 | 目标站验收 |
| `/admin/infra/docker` | 容器 / 镜像 / 网络；容器 ID 优先，网络 ID 优先 | 目标站验收 |
| `/admin/version` | floatctf-web / floatctf-api 两行 | 目标站验收 |
| `/admin/infra/terminal` | 未连接说明 + 连接后全屏终端 | 未连接态验收 |

## 明确不在本轮范围

- OIDC / Developer 相关页面；
- 数据库迁移与管理工具；
- 终端连接后的宿主 shell 实际操作（避免在生产执行真实命令）；
- AWD/AWDP 深度运维动作（部署、轮次推进、评测），继续复用既有真实面板，不在本轮改语义。

## 最终冒烟（2026-11-08）

目标站 `http://10.66.66.7`，shadcn `0.2.53`，逐页打开 31 个主流程路由：

- 选手端 13 个：Top、赛事、题库/题目详情、题集、GameBoxes、实例、解题流水、公告、讨论、Writeup、武器库、资料；
- 管理端 18 个：Dashboard、赛事列表/控制台、题库、题集、GameBox、网络、公告/讨论/武器、用户/角色/日志/设置/前端/任务、Docker、版本。

结果：全部 HTTP 200，页面主内容非空，无 `Something went wrong` / React 更新深度错误；Playwright 控制台错误 0 条。

已参赛 AWD/AWDP 的玩家 Tab 与战队/Writeup 另用临时赛事验收并清理。终端仅验收未连接态，未在生产执行宿主 shell。

## 宽屏回归（2026-11-09，shadcn 0.2.54）

题目详情在 2659×1577 下暴露：外层 5:7 + 工作台内部 1fr+360px 导致描述列仅约 90px、中文逐字竖排。

修复：`ChallengeWorkbench` 改为单列（描述 → 环境 → Flag → 可选 Writeup），外层仍保持 Default 的 5:7。

回归结果：

- 2659px：左栏卡片宽 613px，右题解 859px，无窄文本元素；
- 1280px：左栏卡片宽 400px，右题解 560px；
- 390px：卡片 358px，页面 `scrollWidth = clientWidth`，无横向溢出；
- 扫描选手端 10 个页面、管理端 16 个页面，未再发现 <100px 且长文本的窄列。

## 题集交互调整（2026-11-09）

- 题集列表点击名称仍进入 `/challenge-sets/:id`；
- 题集详情中点击**题目名称**打开弹窗，展示题目描述、环境/启动实例、Flag 提交；
- URL 保持在 `/challenge-sets/:id`，关闭弹窗回到题集列表；
- 桌面弹窗为 2xl，移动端不溢出。
