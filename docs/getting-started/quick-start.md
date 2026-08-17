# Quick Start（现状页）

> status: current · **PUBLIC_QUICK_START = CURRENTLY_MISSING**：当前**不存在**
> 「install → create Agent → send message → reply」的产品级公开可运行路径。本页
> 如实呈现 developer verification、当前可运行 surface 与限制，不发明运行路径。

## 你现在能做什么

### 1. 开发者验证（当前主要使用方式）

```bash
# 前置见 installation.md：Node + DSH checkout + 模型凭据
npm install
npm test                       # node --test packages/*/test/*.test.js（全包单测）
npm run verify:product-integration   # Integration V1 端到端验收（A/B 28 断言）
npm run verify:scheduler             # Scheduler V1 验收
npm run verify:scheduler-router-final # Scheduler ↔ Router 终集成验收
npm run verify:delivery              # Router 出站投递验收
```

更多 verify 脚本（mobile-gate1 / trusted-cp / trusted-credential-broker /
production-runtime / agent-definition-access 等）见
[reference/cli](../reference/cli.md)。这些是 **developer verification**，不是产品
安装器。

### 2. 当前可运行 surface（如实）

- **控制面 profile 安装**：`npm run install:integration` 把 Integration V1 控制面
  profile 以 symlink 方式装入 DSH home（additive only）。
- **生产常驻运行**（面向部署者，非公开用户）：`node scripts/production-runtime.mjs`
  组合 Scheduler + Ingress + Product API + Feishu channel，见
  [guides/deployment](../guides/deployment.md)。
- **历史 V0 示例**：`examples/v0-vertical-slice/`（calculator 6×7=42 一次性驱动）
  **已废弃**，仅作历史参考——不得当作 Quick Start 复活。

### 3. 限制（诚实清单）

- 无 `install → create Agent → send message → reply` 的产品级路径；跑通完整链路
  需要部署者按 [deployment](../guides/deployment.md) 自行组合。
- 无公开 License（`package.json license = UNLICENSED`；开源 license 决策属
  Project Owner，进行中）。
- 单机 macOS 部署形态（launchd）；无多机/HA。
- Mobile 面仅为 Gate 1 薄 API（localhost，adb reverse），无公开 App。

真实的 Quick Start（产品级引导）需要单独立项，不属于文档收敛。

下一步：[concepts/agents](../concepts/agents.md) →
[architecture/overview](../architecture/overview.md)。
