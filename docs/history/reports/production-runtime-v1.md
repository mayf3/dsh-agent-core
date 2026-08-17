---
status: historical
as_of: 2026-08-16
superseded_by: ../../guides/deployment.md
public: PUBLIC_AFTER_SANITIZE
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-16.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/guides/deployment.md](../../guides/deployment.md)

# PRODUCTION_RUNTIME_V1 — 报告

> 分支：`feat/production-runtime-v1` · 基线：origin/main @ bfe7491 · 日期：2026-08-16
> 目标：把已存在的 Agent Core 组件真正组合成一个**可启动、可长期常驻、crash 后可恢复、
> 使用生产持久目录、不依赖 demo 环境**的 Production Runtime。不重新设计 Agent Core；
> 只做 wiring / lifecycle。

## 最终结果

```
PRODUCTION_RUNTIME_V1 = PASS

BASE_MAIN = bfe7491 (origin/main)
FEATURE_HEAD = <见 commit>

DEMO_HOME_DEPENDENCY = NO    （production 路径 import @agent-core/agent-provisioning；
                              scripts/demo-home.mjs 降级为 demo-path shim）
DEMO_PROFILE_DEPENDENCY = NO （runtime 显式 agent-core-production；
                              Router 移除 agent-core-demo 库默认值，profile 必填）
DEMO_STATE_DEPENDENCY = NO   （默认 root ~/.agent-core；.demo root 被 fail-loud 拒绝；
                              持久化路径中无任何 .demo / tmp / fixture）

PRODUCTION_COMPOSITION = PASS （workspace-bootstrap → agent-definition → feishu(可选)
                              → agent-router → broker(gateway) → product-api
                              → notification-ingress → scheduler + scheduler-router seams）
PRODUCTION_PERSISTENT_ROOT = ~/.agent-core（agents.json / bindings/ / scheduler/jobs.json
                              (agentcore-cron 默认同路径) / workspaces/ / homes/ / logs/）
SUPERVISION = launchd LaunchAgent ai.agent-core.runtime
              （RunAtLoad + KeepAlive + ThrottleInterval 10s；仅 plist，无新平台）

REAL_AGENT_START = PASS       （POST /v1/deliver → ensureRunning → 真实 DSH 子进程
                              (agent-core-production) → workspace AGENTS.md → 真实模型回复）
AGENT_CRASH_RECOVERY = PASS   （kill -9 DSH 子进程 → 下一次 deliver respawn 新 pid，
                              main session 恢复并完成 turn）
RUNTIME_RESTART_RECOVERY = PASS（kill -9 Runtime → restart 同一持久 root → 全部状态可用）

BINDING_PERSISTENCE = PASS
SCHEDULER_PERSISTENCE = PASS
DELIVERY_IDEMPOTENCY_PERSISTENCE = PASS

TESTS = full npm test 326 tests / 325 pass / 0 fail / 1 skipped（基线 312 pass / 0 fail / 1 skipped，
        +13 新增单测）；真实验收 21/21 PASS（scripts/production-runtime-v1-verify.mjs）

AUTH_CHANGE = NONE
BROKER_CORE_CHANGE = NONE
AGENT_DEFINITION_CHANGE = NONE
SCHEDULER_CORE_CHANGE = NONE
DSH_CORE_CHANGE = NONE
KERNEL_CHANGE = NONE

READY_FOR_INTEGRATION = YES
```

## 交付物

| 文件 | 角色 |
|---|---|
| `packages/agent-provisioning/` | home provisioning 去 demo 化：harness 解析（worktree-aware）、profile 表（含 `agent-core-production`）、幂等 `provisionAgentHome`（profile **必填**，无 demo 默认） |
| `packages/production-runtime/` | **Production Runtime 本体**（wiring/lifecycle only）：`src/paths.js`（生产持久布局，`.demo` fail-loud）、`src/context.js`（最小 plugin host，取代 fakeCtx）、`src/compose.js`（组件组合）、`src/entry.js`（常驻入口 + SIGTERM/SIGINT + evidence） |
| `profile-production/` | 生产 per-agent profile：dsh-base + demo-server(JSON-RPC 进程协议) + owner-guard + memory + switch + broker relay；persona 为生产 digital-employee |
| `scripts/production-runtime.mjs` | 薄启动器（launchd ProgramArguments 目标） |
| `scripts/production-runtime-launchd.mjs` | launchd supervision：`--print/--install/--status/--uninstall`；生成 `ai.agent-core.runtime` LaunchAgent（RunAtLoad/KeepAlive）；Trusted CP env 透传 baked-in |
| `scripts/production-runtime-v1-verify.mjs` | 真实验收驱动（Task 5） |
| `scripts/demo-home.mjs` | 改为 backwards-compat shim（demo 路径保留 demo 默认；生产包无默认） |
| 修改 | `packages/agent-router/src/{index,process}.js`（import 换 agent-provisioning；agentProfile 必填）、`packages/agent-router/test/delivery.test.js`（mount 显式 profile） |

## Task 1 — demo leakage 移除（production path）

- `agent-router` 生产包不再 import `scripts/demo-home.mjs`（改 `@agent-core/agent-provisioning`）。
- Router `Config.agentProfile` 移除 `'agent-core-demo'` 库默认值 → spawn 时必填、fail-loud；
  `AgentProcess` 构造同样必填 profile。
- Production 启动路径（production-runtime）默认 root 为 `~/.agent-core`（生产 store 根，
  与 `agentcore-cron` 默认一致）；`.demo` root 在 `resolveProductionLayout` 中直接 TypeError。
- 无 feishu 凭据时**不 mount** channel（无 fake/recording seam）；要求投递的 job 被标记
  not-delivered（honest failure），`--no-deliver` job 不受影响。
- demo/home 泄漏仅存于 demo 路径：`agent-core-resident.mjs`（demo resident，未改）、
  `demo-home.mjs` shim、demo/integration 验收驱动 —— 按"测试/demo path 可保留"边界保留。

## Task 2 — production composition

`composeProductionRuntime` 单函数按 bundle-integration 行序挂载现有组件（见上表），随后
`createRouterInvoker`/`createFeishuDeliver`（现有 seam）+ `JobStore` + `Scheduler` 引擎。
不复制组件逻辑；deliver 观测为 wrapper（evidence 一行，不改语义）。**未引入** Workflow /
Forum / OKR / 第二 registry / 第二 scheduler / 第二 auth。

## Task 3 — 生产持久目录

`~/.agent-core`：`agents.json`（定义，runtime 只读）、`bindings/bindings.json`（Binding +
bookmark + fresh mapping 同一 store）、`scheduler/jobs.json`（**agentcore-cron 默认路径，
外部写面零 env 接线**）+ `runs.jsonl`、`workspaces/<id>/`、`homes/<id>/`、
`control/runtime-evidence.jsonl`、`logs/`。

## Task 4 — 常驻与 supervision

launchd LaunchAgent（复用本机 OpenClaw 同款 posture，无新 deployment platform）：
boot/login 自动启动（RunAtLoad）、crash 自动重启（KeepAlive, Throttle 10s）、SIGTERM 优雅
停机。安装：`node scripts/production-runtime-launchd.mjs --install`。验收中仅渲染未安装
（安装属 operator 动作；plist 契约在 phase 4 验证）。LaunchAgent=登录会话级自启；真
machine-boot（root LaunchDaemon）留给 PRODUCTION_INTEGRATION_V1 与 Trusted CP <uid> 身份对齐。

## Task 5 — Agent lifecycle real acceptance（21/21 PASS）

```
Phase 1 REAL START
  runtime 启动 → Agent Definition 可读（default == 定义 config）
  POST /v1/deliver (fresh) → accepted → Router 拉起真实 DSH 子进程 (pid 30952,
  profile agent-core-production) → workspaceBootstrap.ensure() (AGENTS.md 落盘)
  → 真实模型回复 PRT_START_OK 写入 native session fresh-da89…340c
Phase 2 AGENT CRASH RECOVERY
  kill -9 DSH 子进程 → 下一次 deliver → respawn (pid 30969) → accepted (main)
  → main session 完成真实 turn PRT_CRASH_OK
Phase 3 RUNTIME CRASH + RESTART RECOVERY
  预置：Binding (mobile:prt-acceptance-surface) + future job (agentcore-cron 外部写)
  + phase-1 fresh mapping
  kill -9 runtime（crash，非优雅）→ 磁盘三项全在（bindings.json / jobs.json / mapping）
  → restart 同一 root → binding 查询一致；同一 requestId → 同一 sessionId（未重铸）；
  startup catch-up 执行 future job（真实模型回复 PRT_RESTART_OK，durationMs=2474）
Phase 4 SUPERVISION
  plist 渲染含 RunAtLoad + KeepAlive，目标 scripts/production-runtime.mjs，无 .demo
```

证据保留在 `~/.agent-core-production-runtime-v1-acceptance/`（agents.json / bindings/
bindings.json / scheduler/{jobs.json,runs.jsonl} / control/runtime-evidence.jsonl /
homes/*/sessions/**/session.jsonl）。

## Task 6 — Trusted CP thin seam

- 不存在也不修改 `trusted-cp-deploy-install.sh` / `trusted-cp-hardening-v1-verify.mjs`
  （属并行 TRUSTED_CP_AGENT_DEFINITION_COMPAT_V1 分支）。
- Seam 全部为**现有 env**：`AGENT_CORE_CREDENTIALS_FILE`、`BROKER_AUTH_ORIGIN`（broker
  gateway 无凭据即 fail-closed，从不伪造授权）；`DSH_AGENT_CHILD_UID/GID`、
  `DSH_AGENT_SPAWN_HELPER`（Router 现有 spawn 路径，无法降权即 fail-loud）。
  launchd `--install` 会把安装 shell 中已设置的这些 env 写进 plist。
- <uid>/<uid> hardening 不复制、不重做；安全生产验收留给 PRODUCTION_INTEGRATION_V1。

## Task 7 — Regression

| 套件 | 结果 |
|---|---|
| production-runtime（layout+compose，新） | 9/9 |
| agent-provisioning（新） | 4/4 |
| agent-router（delivery/router/broker-rpc/single-flight/feishu-regression/process-delivery/binding-store） | 63/63 |
| scheduler | 59/59 |
| scheduler-router | 10/10 |
| notification-ingress | 10 pass / 1 skipped（既有 skip） |
| agent-definition | 23/23 |
| workspace-bootstrap | 13/13 |
| **full `npm test`** | **325 pass / 0 fail / 1 skipped（326 tests）** |
| 真实 runtime lifecycle acceptance | 21/21（上节） |

## 边界确认

- 未修改：Auth 架构、Broker 架构（新增 gateway 挂载为现有 mode）、Agent Definition 语义、
  Scheduler core 语义、DSH Core、Kernel、Trusted CP hardening 脚本（不存在于本分支）。
- Router 变更限于：import 来源 + profile 必填化（spawn 路径 fail-loud 语义，无路由行为变化；
  63/63 router 单测全绿）。
- 不 merge main；不做 Stock Cutover；不迁移 OpenClaw 真实流量。
