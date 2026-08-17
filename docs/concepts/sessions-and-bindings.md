# Session 与 Binding：会话归属模型（V2）

> status: current · 本页是「Agent / Workspace / Session / main / Surface」语义的唯一
> authority。产品模型 = **D-006** `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`
> （accepted，Current Authority）；runtime 收敛状态见文末（诚实边界，不把目标模型
> 写成已实现）。

## 一句话模型（D-006）

```text
Agent → one primary Workspace → one canonical main

Human Product Surface → selects/binds Agent → canonical main

Feishu = FIXED      # conversation ↔ Agent 固定关联
Mobile = SWITCHABLE # activeAgent 可切；只能选已有 Agent，不能创建
```

## 实体语义

- **Agent**：long-lived subject，稳定 agentId（≠ Feishu conversationId，conversation
  只是创建/固定绑定 anchor）。拥有**一个** primary Workspace 与一个 canonical
  main；principal / credential / grants 都属于 Agent（security domain = Agent）。
- **Workspace**：Agent 唯一的长期状态容器；bootstrap 只 seed `AGENTS.md`，其余
  Agent-managed。**V2 normal path：effective Workspace = Agent.primaryWorkspace**
  （= `resolveWorkspace(agentId)`）。
- **Session**：trajectory。**所有 Session 共享 Agent 的同一个 Workspace**；non-main
  不 merge 回 main；所有 Session 都能贡献长期 Memory。product sessionId = DSH
  native sessionId（无映射层）。
- **main**：人类入口的 canonical **logical slot**（不是固定 trajectory）——
  trajectory 可 reset，reset 后人类入口进入新的 current main。
- **cron**：per-execution fresh Session；**Agent-to-Agent**：per-task Session——
  都不携带人类入口状态。

## Surface 模型（Feishu FIXED / Mobile SWITCHABLE）

- **Feishu**：一个 conversation → 一个长期 Agent → Agent/main。**固定关联，不允许
  动态切到另一个 Agent。**
- **Mobile**：`activeAgent` 可切换；只访问**已有** Agent（MOBILE_CAN_CREATE_AGENT
  = NO）。切换 = 在当前 Agent 对话里调用 `agent_core.switch_agent` → Router 更新该
  Mobile Surface 的 activeAgent → 下一条消息进入目标 Agent/main。切走**不 reset**
  原 Agent 的 main；切回 = resume 其 current main。
- **switch_agent scope**（D-006 §17）：Mobile main = **ALLOWED**；Feishu main /
  cron Session / agent-task Session = **NOT_ALLOWED**（原因：只有 Mobile 这类
  Surface 有「当前选哪个 Agent」的状态）。
- **Human Product Surface Binding = activeAgent only**——不需要 activeWorkspace /
  activeSessionId：Workspace 由 Agent 唯一决定，人类 Session = canonical main。

## Binding.workspace = transitional 兼容字段（不是 Workspace authority）

```text
BINDING_WORKSPACE_TRANSITIONAL = TRANSITIONAL_COMPATIBILITY_FIELD
LONG_TERM_PRODUCT_AUTHORITY = NO
```

- 机制保留在代码中（Router 机械 override；null → agent default），但**无产品
  authority**：「same Agent + 任意 Binding Workspace」**不是**正常产品模型——即使
  底层技术上允许 `Binding.workspace != Agent.primaryWorkspace`，也不代表正常路径
  应该这么用。
- V2 normal path 冻结要求（`AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC` §5.5）：
  `effective workspace == resolveWorkspace(activeAgentId)`；磁盘上的非 primary 旧
  状态 = transitional compatibility state，**不得进入 V2 正常生产路径**。

## 已被部分取代的旧语义（登记，D-006 §24）

- **targetSessionId（D-004 的人类入口选 session 语义）**：取代——人类入口永远进入
  canonical main；`targetSessionId` 不再是人类入口产品状态（机制字段仍在代码中
  转发）。
- **「任意 conversation 均可 switchAgent 到任意 Agent」（D-002/D-004 通用切换）**：
  取代——Feishu 固定 / Mobile 可切（§15/§17）。
- **「first contact → 默认 Agent + 默认 Binding」（D-002）**：取代——first
  eligible human message → 自动创建 Agent（见 [agents](agents.md)）。
- D-002 / D-004 / D-003 的 PARTIALLY_SUPERSEDE 处置与保留条款全文见
  [docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md](../decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md) §24；
  索引见 [docs/decisions/README.md](../decisions/README.md)。

## 入站路径（机制）

消息到达 → connector 归一化 IngressEvent → conversation 解析（V2：eligibility
前置，见 agents 的出生模型）→ 按 Surface 的 activeAgent 路由到对应 Agent 进程
（一个 turn = prompt 到该 Agent 整体 idle）。

## 实现收敛状态（诚实边界，当前 main）

| V2 产品模型 | 当前 runtime（source-verified，D-006 §26.3） |
|---|---|
| first eligible human message → 自动创建 Agent + 固定绑定 | ❌ pending：first contact 仍绑定 config defaultAgentId（旧形态，transitional） |
| Feishu normal path 停止选择 conversation workspace | ❌ pending：feishu-connector `conversationWorkspaceId` 机制仍在（transitional） |
| effective workspace = primaryWorkspace 的 V2 normal path | ❌ pending：accepted `AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC` 已授权最小收敛 + REAL_PRODUCT_AGENT_CANARY_V2，实现未落地 |
| switch surface scoping（Feishu / cron / agent-task 不可切） | ❌ pending 产品 policy：agent-switch 仍是纯转发 adapter |
| Binding 持久化 / switch 原子性 / 单飞 turn（机制层） | ✅ merged（binding-store 原子 JSON + 单飞队列） |

相关：[agents](agents.md) · [workspace-and-memory](workspace-and-memory.md) ·
[architecture/control-plane](../architecture/control-plane.md) ·
[decisions D-006](../decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md)。
