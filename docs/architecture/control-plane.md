# 控制面内部（Router / Process Supervisor）

> status: current · 本页描述 Router / Control Plane 的内部结构与关键机制。

## 组成（packages/agent-router/src/）

- `binding-store.js` — Binding 持久化：原子 JSON 单文档
  （`<DSH_HOME>/.dsh/bindings/bindings.json`，tmp+rename，fail-loud），无数据库。
- `process.js` — `AgentProcess`：per-agent DSH 子进程客户端。spawn
  `dsh --profile <profile>`（cwd=workspace、独立 DSH_HOME），stdio JSON-RPC；
  缓冲 `session.event` / `session.status` 通知；**单飞 turn 队列**（每个 Agent
  同时只跑一个 routed turn）；子进程退出可 respawn + resume。
- `index.js` — Router 域面：resolveChannelConversation / getBinding /
  switchAgent / turn / deliver；进程 registry（spawn / reuse / resume）。

## 关键机制

- **唯一切换原语**：`Router.switchAgent(bindingContext, targetAgentId,
  { targetSessionId? })` — 校验 Agent → 选 Session（显式 sessionId，缺省 main，
  无 LLM 猜测）→ 原子持久化 Binding → 返回新 Binding。所有入口最终都调它。
- **Parent-RPC relay**：per-agent 进程内插件（如 `agent_core.switch_agent` 工具）
  可请求控制面执行域操作——demo-server 在 stdout 发 `rpc.request` 通知，
  `AgentProcess` 转发给 Router 钩子并以 `rpc.response` 应答。client 只转发，不拥有策略。
- **Owner-guard**：`packages/owner-guard` 保证每个 agent home 同时只有一个活进程。
- **Scheduler 桥**：`packages/scheduler-router` 把 scheduler 的 injectable
  `invokeAgent` / `deliver` seam 接到真实 Router 域面与 Feishu 出站。

## 生产组合（packages/production-runtime）

wiring/lifecycle-only：一个常驻进程把 Scheduler 引擎、Notification Ingress
（:8790）、Product API（:8787）、Feishu channel 挂载到同一持久根
（`PRODUCTION_RUNTIME_ROOT`，默认 `~/.agent-core`）。崩溃恢复交给 supervision
（launchd KeepAlive）；进程本身只做优雅停机 + 启动补跑。运行面见
[guides/deployment](../guides/deployment.md)。

相关：[overview](overview.md) · [sessions-and-bindings](../concepts/sessions-and-bindings.md) ·
[security-model](../security/security-model.md)。
