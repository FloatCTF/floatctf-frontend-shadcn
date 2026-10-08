# AGENTS.md — floatctf-frontend-shadcn 作业手册

> 这是 **shadcn/ui 版 FloatCTF 可插拔前端**（前端 id `shadcn`）的独立仓库。
> 动手前先读本文件，再读 §2 列出的权威文档。**不要**凭 Default Frontend 的实现猜 API。

## 1. 这个仓库是什么

一个**全新的 FloatCTF 可插拔前端**（不是修改官方 Default 前端）：自己的路由、设计系统、
交互模型与信息架构。技术栈 **React 19 + Vite 6 + Tailwind CSS v4 + shadcn/ui（Radix）** +
react-router v7 + TanStack Query/Table + Zustand + sonner + cmdk + react-markdown + xterm。

- 范围：**complete** —— 覆盖 [CAPABILITY-MATRIX](../../docs/frontend/CAPABILITY-MATRIX.md)
  全部 89 项 `required`（选手端 + 管理端），逐行见 [CAPABILITY-COVERAGE.md](./CAPABILITY-COVERAGE.md)。
- 依赖边界：只 import `@floatctf/{sdk,react,frontend-runtime}` 与第三方库；**禁止**
  `frontends/default/*`、`apps/web/*`、`packages/*/src/*`、`@/`；包内 alias 是 `~/*` → `src/*`。

### 常用命令

```bash
# 作为 FloatCTF monorepo 的 submodule（位于 frontends/floatctf-frontend-shadcn）
cd <monorepo> && mise exec -- pnpm --filter @floatctf/frontend-shadcn typecheck
mise exec -- pnpm --filter @floatctf/frontend-shadcn build
mise exec -- pnpm --filter @floatctf/frontend-shadcn dev     # :13400，自带 /api 代理

# 独立 checkout（先把 SDK 打成 tarball，见 README §1.1）
npm run build && npm run typecheck
```

**任何改动在交付前必须让 `tsc --noEmit` 与 `vite build` 都通过。**

## 2. 权威文档

| 文档 | 用途 |
|---|---|
| `docs/dev/CONVENTIONS.md` | 作业口径：路由自注册契约、共享组件 API、数据层写法、**SDK 陷阱清单**、铁律 |
| `docs/dev/SDK-SURFACE.md` | SDK 公共面速查（从 `packages/sdk` 源码生成，`scripts/gen-sdk-surface.py`） |
| `README.md` | 身份、两种用法（monorepo submodule / 独立 checkout）、安装与激活、截图、契约缺口 |
| `FRONTEND-PLAN.md` | 视觉方向、交互模型、信息架构与路由计划 |
| `CAPABILITY-COVERAGE.md` | 89 项 required 的逐行落地与证据 |
| `docs/E2E-ACCEPTANCE.md` | 真实 API 端到端验收记录（含复现步骤） |
| 主仓库 `docs/frontend/AI-FRONTEND-GUIDE.md` | 平台侧权威手册（mount 契约、依赖边界、验收流程） |

## 3. 硬规则（违反即返工）

1. 禁止假数据；每条数据来自真实接口，没有就空态。
2. 三态齐全（loading / empty / error，统一用 `~/components/app/states` 的 `QueryState`）；
   错误必须可见可恢复，绝不白屏。
3. 每个 mutation 都要 `toast.success` + `onError` 里 `toast.apiError` + 失效对应 `qk`。
4. 破坏性操作必须 `useConfirm()` 并写明**真实后果**；高危操作加 `confirmPhrase`；
   **禁止**原生 `alert/confirm/prompt`。
5. token 绝不进 URL；敏感值（flag / SSH 密码 / WireGuard 私钥）用 `SecretValue`（只复制不回显），
   `password` 字段永不渲染。
6. 状态判定与后端一致（`~/lib/event-status.ts`、SDK 枚举，含 AWDP `preparing_fix` 过渡态）。
7. **`EventInfo.id` 运行时不返回** —— 一律用 `eventIdOf(info)`（`event.id`）。
8. `QueryParams` 只有 `offset/limit/page/total/filter`；柯里化方法必须二次调用。
9. 版本不可变：**已发布内容变更必须递增版本号**（`floatctf.frontend.json` 与 `package.json`）。

## 4. 提交与发布

- 提交信息用中文，带 `feat/fix/chore/docs/refactor` 前缀，按角度分批。
- 发布路径：`pnpm build` → `tar -czf shadcn-<version>.tar.gz -C dist .` →
  `scripts/frontend.sh verify` → `frontend.sh install`（宿主执行），激活由管理端设置
  `FRONTEND_ACTIVE` 完成（CLI 不激活），破窗 `?frontend=default`。
