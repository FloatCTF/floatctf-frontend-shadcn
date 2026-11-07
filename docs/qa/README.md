# QA 截图（v0.2 主题）

两张来源，**不要混用**：

## A. 真实 dev server（无 API 时也能看）

`pnpm dev`（:13400）+ Chromium 采集，验证 [`docs/theme.md`](../../../../docs/theme.md)
的令牌与版式是否真的生效。数据结构为页面自身的空态/表单，不含任何编造的业务数据。

| 文件 | 场景 |
|---|---|
| `v0.2-login-light.png` | 登录 · 亮色（默认） · 1280×800 |
| `v0.2-login-dark.png` | 登录 · 暗色 |
| `v0.2-login-en.png` | 登录 · 英文（i18n 全量生效） |
| `v0.2-login-mobile.png` | 登录 · 390×844 |
| `v0.2-not-found.png` | 404 兜底 |

## B. ⚠️ Mock API 预览（数据是假的）

本机没有 Postgres/Redis/API 时，用 `scripts/mock-api.mjs`（dev-only，**不进制品**）
让页面跑起来看布局。以下截图的数据**全部来自 mock**，仅用于视觉评审，
**不代表真实平台数据**，不得作为功能验收证据。

| 文件 | 页面 |
|---|---|
| `player-dashboard.png` | 选手端总览 |
| `player-events.png` | 赛事列表 |
| `player-event-workspace.png` | 赛事工作区 |
| `player-challenges.png` | 题库 |
| `player-practice-gate.png` | 练习赛门禁（不显示报名，引导去题库/训练场） |
| `check-login-validation.png` | 登录页字段级校验（必填 + 焦点） |
| `check-task-confirm.png` | 高危操作确认（后果清单 + 输入确认词） |
| `player-awd-arena.png` | AWD 驾驶舱（4 指标 + flag/靶机/积分/凭据） |
| `player-awdp-lab.png` | AWDP 工作台（阶段 / Break·Fix / 评测 / 矩阵） |
| `player-rank.png` | 排行榜 |
| `player-solves.png` | 解题流水 |
| `player-discussions.png` | 讨论区 |
| `player-awd-arena.png` | AWD 驾驶舱（SSE 未接，显示「已降级轮询」是真实降级行为） |
| `admin-dashboard.png` | 管理端总览 |
| `admin-events.png` | 赛事管理 |
| `admin-challenges.png` | 题目管理 |
| `admin-users.png` | 用户管理 |
| `admin-roles.png` | 角色与权限（RBAC） |
| `admin-logs.png` | 操作日志 |

复现：

```bash
node scripts/mock-api.mjs        # :7780，Vite 的 /api 代理目标
pnpm dev                         # :13400
# 登录：任意账号 + 任意密码（mock 不校验）
```
