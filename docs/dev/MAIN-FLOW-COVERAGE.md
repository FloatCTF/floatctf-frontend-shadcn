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
| `/challenge-sets` | FilterBar + 名称进入详情 | 目标站验收 |
| `/challenge-sets/:id` | 题集详情与题目列表 | 目标站验收 |
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
