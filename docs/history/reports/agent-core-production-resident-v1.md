---
status: historical
as_of: 2026-08-15
superseded_by:
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: none for this engineering evidence — see the index at [docs/README.md](../../README.md).
# AGENT_CORE_PRODUCTION_RESIDENT_V1 — 报告

> 分支：`feat/agent-core-production-resident-v1` · 日期：2026-08-15
> 目标（唯一）：用最薄的 composition entrypoint 让现有 Agent Core 真正长期在线，
> 自动消费 Scheduler job，并通过现有 Router 拉起真实 Agent。不重新设计 Scheduler；
> 不建设 Runtime Framework / Dashboard / Config Service。
> 前置：`scheduler-production-cutover-closure-v1` 已实证第一 blocker
> （AGENTCORE_RESIDENT_RUNNING = NO，5 个 job 入库无人执行）并正确回滚 caller 到
> OpenClaw —— 本任务只证明 resident ready，**不再迁移 caller**（三个 caller 保持
> OpenClaw 版本，逐文件确认：forum-scheduler.sh / unified-dispatcher.py /
> check-dispatch-health.py 写面均为 `openclaw cron`）。

## 1. 交付物（薄 entrypoint，零新组件）

- `scripts/agent-core-resident.mjs` —— 常驻入口：load Registry → bootstrap →
  feishu → Router → `createRouterInvoker`/`createFeishuDeliver` → Scheduler
  start（tick 500ms，catchup on）→ keepalive → SIGTERM/SIGINT 优雅停机。
  复用 `packages/{agent-registry, workspace-bootstrap, agent-router,
  feishu-connector, scheduler, scheduler-router}`，行序与 bundle-integration
  composition 完全一致；对每个 invocation 追加一行证据到
  `<runtime>/control/resident-evidence.jsonl`（可观测性，非框架）。
- `scripts/agent-core-production-resident-v1-verify.mjs` —— 真实验收驱动。

## 2. 真实验收证据（两轮完整运行，均为 14/14 checks PASS）

验收链（无任何人工 run/tick）：

```
resident 常驻
→ agentcore-cron add --at 12s（跨进程锁内 mutate 写入同一 store）
→ 引擎 mtime tick 自动纳入 → 到期自动执行
→ Router.ensureRunning(agent) → 真实 DSH 进程（dsh --profile agent-core-demo）
→ 原生 session turn → 真实模型回复 "RESIDENT_AUTO_OK"
→ runs.jsonl started+finished（status ok / durationMs / deliveryStatus）
→ deleteAfterRun 语义删除

重启恢复：
→ agentcore-cron add --at 45s（future job）
→ SIGTERM 优雅停机（exit 0，evidence stopped）
→ 停机期 job 未执行（无 finished 事件）
→ 重启 resident → 启动 catch-up 自动执行 → status ok
```

运行日志（`/tmp/acpr-final-verify.log`，rc=0）关键行：

```
PASS  RESIDENT_PROCESS — ready pid=14528 tickMs=500 defaultAgent=agt_6132a8...
PASS  RESIDENT_AUTO_EXECUTION — finished status=ok after 4812ms (no manual run/tick)
PASS  REAL_REGISTRY_AGENT — run agentId=agt_6132a8... == registered agt_6132a8...
PASS  REAL_ROUTER — router spawned DSH process pid=14579 alive=true
PASS  REAL_DSH_TURN — model reply="RESIDENT_AUTO_OK"; sessionId=agent:agt_6132a8...:cron:e043e23e...
PASS  NATIVE_SESSION_PERSISTED — session.jsonl under <home>/sessions/...
PASS  RUN_PERSISTENCE — runs.jsonl events=2 (started+finished); durationMs=4812; deleteAfterRun -> job deleted=true
PASS  GRACEFUL_SHUTDOWN — exit code=0 signal=null; evidence stopped=true
PASS  NO_EXECUTION_WHILE_DOWN — job untouched while down
PASS  RESIDENT_RESTART — restarted pid=15109
PASS  RESIDENT_RESTART_RECOVERY — job auto-executed after restart: status=ok durationMs=4.4s (startup catch-up)
```

证据文件（runtime 保留在 `.demo/agent-core-production-resident-v1/runtime/control/`）：
`resident-evidence.jsonl`（ready/invocation×2/stopped×2，含 routerProcessPid）、
`runs.jsonl`（started/finished×2，含 agentId/sessionId/durationMs/deliveryStatus）、
`registry.json`（1 个真实注册 agent）、`jobs.json`（执行后 0 job，deleteAfterRun
语义实证）。

## 3. 最终结果

```
AGENT_CORE_PRODUCTION_RESIDENT_V1 = PASS

RESIDENT_PROCESS = PASS
REAL_REGISTRY_AGENT = PASS
RESIDENT_AUTO_EXECUTION = PASS
REAL_ROUTER = PASS
REAL_DSH_TURN = PASS
RUN_PERSISTENCE = PASS
RESIDENT_RESTART_RECOVERY = PASS

STOCK_CUTOVER_SCHEDULER_READY = YES
    （scheduler 平面 ready：resident + 外部写面自动消费 + 重启恢复全部实证。
      说明：生产 agent 身份接线 —— Agent Core Registry 注册生产 agent /
      Router attach OpenClaw runtime —— 仍是 closure 报告 §6 的前置条件 #1，
      属独立工作线，本任务不触碰（不碰 Auth/Broker、不重构）。）

SCHEDULER_CORE_CHANGE = NONE
ROUTER_CORE_CHANGE = NONE
AUTH_CHANGE = NONE
KERNEL_CHANGE = NONE
```

## 4. 边界与安全

- caller 迁移**未再次执行**：forum-scheduler.sh / unified-dispatcher.py /
  check-dispatch-health.py 维持 OpenClaw 版本（v5 / pre-migration），生产
  jobs.json 写面不变；OpenClaw gateway 继续执行其 job（closure 已恢复的闭环）。
- 本任务所有写面都在 runtime root（`.demo/agent-core-production-resident-v1/`，
  gitignored）；`~/.agent-core/scheduler/`（生产 store 目录）保持空置、未被写入。
- 未触碰：Scheduler core、Router core、Auth/Broker、caller migration、
  OpenClaw gateway、Kernel；无 Runtime Framework / Dashboard / Config Service。

## 5. cutover 时的接法（文档化，不在本任务执行）

resident 就绪后，stock cutover 序列为：生产 agent 身份接入 Agent Core Registry
（前置 #1）→ 以生产 store 启动 `agentcore-cron` / resident（复用本 entrypoint，
`--runtime` 指向生产 runtime）→ 切 caller（`feat/scheduler-caller-migration-v1`
的迁移代码仍在）→ 验证完整周期后关停 gateway。
