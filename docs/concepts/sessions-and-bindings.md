# Session 与 Binding：会话归属模型

> status: current · 本页是「Session / ChannelConversation / Binding 语义」的唯一 authority。

## 最小实体集（D-002，含 reconciliation）

- **Agent**：长期实体（见 [agents](agents.md)）。
- **Session**：属于 Agent。身份 = **(agentId, sessionId)**；`main` 为每个 Agent 的
  长期主会话，normal 会话可新建/归档/清理。
- **ChannelConversation**：`(channel, externalId)` 全局唯一；channel id 不透明
  （飞书只有 chatId 也能直接 dispatch）。
- **Binding**：每个 ChannelConversation 至多一条，记录 `activeAgentId`。

> **D-002 reconciliation**：契约 `AGENT_SESSION_CHANNEL_MODEL_V1.api.json` 把
> Session.id 描述为「全局唯一 `ses_` 前缀」，与实现证据「product sessionId =
> (agentId, sessionId) 直通 DSH native sessionId，无映射层」存在偏差。已由 accepted
> Spec `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md` 把 D-002 的 SUPERSEDE 收窄至
> unique-workspace 条款；**当前事实以本页与 merged 代码为准**。登记见
> [docs/decisions/README.md](../decisions/README.md)。

## 关键语义（无映射层）

- **product sessionId = DSH native sessionId**。不存在 session 转换层、不存在独立
  session 包；DSH 原生负责身份/轨迹持久化/创建/resume/崩溃恢复。
- **switchAgent 只改 Binding**：`switchAgent(bindingContext, targetAgentId,
  { targetSessionId? })`——验证 Agent → 选 Session（显式 id，缺省 main，无 LLM
  猜测）→ 原子持久化（`bindings.json` tmp+rename）→ 返回新 Binding。不是角色扮演、
  不复制历史；「换回来」= 再次 switchAgent，后端不保存切换栈。
- **跨 workspace 切换是结构化拒绝**：Binding 绑定的 workspace 语义与目标 Agent 的
  workspace 不兼容时，Router 返回结构化 reject，绝不隐式创建另一个 Session、绝不
  静默改 cwd（AGENT_CORE_BINDING_WORKSPACE_V1 的 Session write contract R1-R3）。
- **幂等入口**：`resolveChannelConversation(channel, externalId)` 一步返回
  ChannelConversation + Binding。

## 入站路径

消息到达 → connector 归一化为 IngressEvent → resolveChannelConversation → 按
Binding.activeAgentId 路由到对应 Agent 的进程（一个 turn = prompt 到该 Agent 整体
idle）。

相关：[agents](agents.md) · [architecture/control-plane](../architecture/control-plane.md) ·
[guides/integrations](../guides/integrations.md)。
