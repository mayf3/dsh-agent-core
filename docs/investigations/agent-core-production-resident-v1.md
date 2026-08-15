# Agent Core Production Resident V1 — 实证调查

> 实证调查（investigation）· 只读现有组件源码与本机运行态。
> 日期：2026-08-15 · 分支：`feat/agent-core-production-resident-v1`
> 前置：`scheduler-replacement-v1`（Scheduler 核心）、`scheduler-router-final-integration-v1`
> （桥与真实链路验收）、`scheduler-production-cutover-closure-v1`（第一 blocker：
> AGENTCORE_RESIDENT_RUNNING = NO → 已回滚 caller）。本文件只回答「现有组件
> 能否通过一个薄 entrypoint 常驻」，不改任何组件核心。

## 0. 结论速览

| 项 | 结论 |
|---|---|
| 现有 resident 入口 | **无**（closure 已证：无任何 scheduler 常驻进程/launchd 条目） |
| 组件就绪度 | Scheduler 引擎 / scheduler-router 桥 / Router→DSH 进程链 / Registry / bootstrap **全部就绪**（final-integration 16/16 实证） |
| 薄 entrypoint | `scripts/agent-core-resident.mjs`（约 200 行，零新组件，复用 bundle-integration composition 行序） |
| 外部写面 | `agentcore-cron add`（跨进程锁内 mutate）→ 引擎 mtime tick 自动纳入 |
| 验收结果 | 7/7 门 PASS（14/14 checks），含真实模型 turn 与重启恢复 |

## 1. 现有组件盘点（只读）

| 组件 | 位置 | 常驻所需接口 | 状态 |
|---|---|---|---|
| workspace-bootstrap | `packages/workspace-bootstrap` | `apply(ctx, {workspaceRoot, agentsHome})` → resolveWorkspace/resolveDshHome | ✅ |
| AgentRegistry | `packages/agent-registry` | `new AgentRegistry({storeFile})` + svc 包装 | ✅（D-002 身份注册表） |
| feishu connector | `packages/feishu-connector` | `apply(ctx, {enabled, credentialsPath})` → `reply(ReplyTarget, text)` | ✅（本机有 live 凭据） |
| agent-router | `packages/agent-router` | `apply(ctx, {bindingsStoreFile, defaultAgentId, defaultSessionId, agentProfile})` → `ensureRunning(agentId)` / `registrySnapshot()` | ✅（ensureRunning 自动 provisionAgentHome + spawn `dsh --profile` JSON-RPC 子进程） |
| scheduler-router | `packages/scheduler-router` | `createRouterInvoker(router, {registry})` / `createFeishuDeliver(feishu)` | ✅（final-integration 真实验证） |
| scheduler | `packages/scheduler` | `new Scheduler({store, invoker, deliver, tickMs, concurrency, log})` + `start({autoStart, catchup})` / `stop()` | ✅（tick 单飞 / 锁内 mutation / mtime reload / 重启 catch-up） |
| JobStore | `packages/scheduler/src/store.js` | `new JobStore(jobsPath, {runLogPath})` | ✅（跨进程 lockfile，CLI 与常驻引擎同协议） |
| agentcore-cron | `scripts/agentcore-cron.mjs` | control-only CLI（永不实例化引擎） | ✅（外部写面） |

## 2. 为什么「薄 entrypoint」可行（关键事实）

1. **引擎对外部写入开放**：`Scheduler._tickOnce()` 每次 tick `await this.load()`，
   mtime 检查重读 store —— 常驻引擎运行时 `agentcore-cron add` 的写入在下个 tick
   自动纳入（Scheduler V1 报告 §3 已声明，audit FIX 3 CLI_RESIDENT_MULTIWRITER
   已单元验证）。
2. **Router 是自足的**：`ensureRunning(agentId)` 内完成 workspace/home 解析 +
   `provisionAgentHome`（profile 安装幂等）+ spawn + ready —— 注册表里有 agent
   即能拉起真实 DSH 进程，无需外部预置。
3. **Registry 是可加载的持久 store**：resident 只需 `new AgentRegistry({storeFile})`
   + 校验 default agent，不需要注册逻辑。
4. **进程存活语义**：Scheduler 的 timer 是 unref 的（设计使然），薄 entrypoint
   必须自己持有 keepalive handle —— 这是 resident 与一次性 verify 驱动的唯一
   本质区别。

## 3. 薄 entrypoint 的组成（scripts/agent-core-resident.mjs）

```
CLI: node scripts/agent-core-resident.mjs [--runtime <root>] [--tick-ms N]
     [--concurrency N] [--catchup 0|1]

1. load Registry（必填：registry.json 缺失 → exit 2；resident 永不注册 agent）
2. applyBootstrap(ctx, {workspaceRoot: <rt>/agents, agentsHome: <rt>/homes})
3. mount feishu（有凭据 → applyFeishu；无 → recording seam）
4. applyRouter(ctx, {bindingsStoreFile, defaultAgentId: registry.default,
                     defaultSessionId: 'main', agentProfile: 'agent-core-demo'})
5. invoker = createRouterInvoker(router, {registry})
   deliver = createFeishuDeliver(feishuService)
6. store = new JobStore(<rt>/control/jobs.json, {runLogPath: runs.jsonl})
   scheduler = new Scheduler({store, invoker, deliver, tickMs, concurrency, log})
7. await scheduler.start({autoStart: true, catchup: true})
8. keepalive interval（引擎 timer unref；进程必须自持存活）
9. SIGTERM/SIGINT → scheduler.stop() → ctx.disposeAll() → exit 0（优雅重启/关闭）
```

可观测性（非框架）：每次 invocation 与生命周期事件追加一行到
`<rt>/control/resident-evidence.jsonl`（agentId/sessionId/status/summary/
routerProcessPid/routerProcessAlive），供外部验收驱动断言；业务面零新增。

**零改动面**：`packages/scheduler/**`、`packages/agent-router/**`、
`packages/scheduler-router/**`、Auth/Broker、Kernel —— 全部 NONE。

## 4. 验收设计（scripts/agent-core-production-resident-v1-verify.mjs）

- Phase 0：全新 runtime（`.demo/agent-core-production-resident-v1/runtime`，
  gitignored），AgentRegistry 注册 1 个真实 agent（resident 加载该 store）。
- Phase 1：spawn resident → 等 ready 证据 → **`agentcore-cron add`（--at 12s）**
  → 不做任何人工 run/tick，等引擎自动执行 → 断言真实 Router 拉起 DSH 进程 →
  真实模型回复（RESIDENT_AUTO_OK）→ runs.jsonl/evidence 持久化 → job 按
  deleteAfterRun 删除。
- Phase 2：`agentcore-cron add`（--at 45s）→ SIGTERM 优雅停机（exit 0）→ 断言
  停机期未执行 → 重启 resident → 启动 catch-up 自动执行 → finished ok。
- 安全：全部写面在 runtime root 内；OpenClaw 生产 store / daemon 脚本零接触。
