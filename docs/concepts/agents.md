# Agent：数字员工

> status: current · 本页是「Agent 是什么」的唯一 authority。产品模型 = **D-006**
> `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`（accepted，Current
> Authority）；尚未实现的部分在文末明确标注 implementation status，不虚构已跑通。

## 定义（V2）

**Agent 是 long-lived subject**（长期主体——不是一次会话、不是一次进程、不是配置项）：

- **稳定身份**：独立稳定的不透明 `agentId`（≠ Feishu conversationId——conversation
  只是创建/固定绑定 anchor，不是 Agent 身份；Scheduler / Broker / Mobile 等内部
  系统都用 channel-independent 的 agentId）。
- **one primary Workspace**：Agent 唯一决定自己的 Workspace
  （`resolveWorkspace(agentId)`，默认 `~/.dsh/workspaces/<agentId>`；bootstrap 只
  seed `AGENTS.md`，其余 Agent-managed）。
- **one canonical main**：人类入口的 canonical logical slot（trajectory 可 reset）。
- **security domain**：principal / credential / grants 属于 Agent（不属于 Session /
  conversation / Surface / Binding）。
- **进程**：one Agent = one DSH process（懒启动；崩溃 respawn + resume）。
- **记忆**：所有 Session 共享 Agent Workspace 内的长期记忆（见
  [workspace-and-memory](workspace-and-memory.md)）。

## 出生与生命周期（D-006 产品模型）

```text
AGENT_CREATION_TRIGGER = FIRST_ELIGIBLE_HUMAN_MESSAGE   # transport eligibility 前置

first eligible human message（p2p 首条真人消息 / 群内首次 @bot /
no-mention 群的首条 eligible 真人消息；requireMention=true 未 @ → drop，不创建）
→ create Agent → create Workspace → seed AGENTS.md
→ begin external capability provisioning（非阻塞）
→ establish canonical main → fixed-bind conversation ↔ Agent
```

- **AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO**：聊天就绪（AGENT_CHAT_READY =
  agentId + Workspace + AGENTS.md + main/runtime）**不等**外部能力 provision；
  外部能力（principal / credential / baseline grants）失败 = fail-closed（受影响
  capability 不可用）+ 后续 retry，不阻塞聊天；main reset ≠ capability repair。
  Router 不是 provisioning / auth / credential manager。
- 不需要显式 create-agent 产品入口；Agent Core 不创建飞书会话（会话由人 / API /
  外部系统创建，Agent Core 只响应 eligible 消息）。
- **切换有 Surface scope**：Feishu = FIXED（conversation ↔ Agent 固定关联）；
  Mobile = SWITCHABLE（`switch_agent` 只改该 Surface 的 activeAgent，只能选已有
  Agent；Feishu main / cron / agent-task 不可切）——详见
  [sessions-and-bindings](sessions-and-bindings.md)。

## 实现收敛状态（诚实边界，当前 main）

| 模型要素 | 当前 runtime |
|---|---|
| agent-definition 声明式存在面（稳定 `agt_*` id；无 persona/runtime 字段） | ✅ merged |
| workspace / per-agent DSH_HOME 幂等准备（只 seed AGENTS.md） | ✅ merged（workspace-bootstrap + agent-provisioning） |
| one Agent = one DSH process + owner-guard 单 owner 锁 | ✅ merged |
| **automatic Agent birth**（first eligible message 自动创建 + 固定绑定） | ❌ **accepted product model / implementation convergence pending**：当前 first contact 绑定 config defaultAgentId（transitional）；收敛由 accepted `AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC` 授权，实现未落地 |
| 出生级非阻塞能力 provisioning（ensure / retry / fail-closed 策略面） | ❌ pending（留待未来 Auth/Provisioning Spec） |

早期 `registry`（写运行时注册表）已被声明式 agent-definition 取代；存量迁移用
`scripts/migrate-registry-to-definition.mjs`（一次性）。如何登记/使用 Agent 见
[guides/adding-an-agent](../guides/adding-an-agent.md)。

## Agent 不是什么

- 不是 OS 用户（Agent 间隔离靠进程 + 独立 home，不靠多用户）。
- 不是 channel 的从属物（Channel 只是入口，conversationId 只是 anchor）。
- 不是 persona 配置项（agent-definition 刻意不含 persona / workspace / credential /
  runtime 字段）。

相关：[sessions-and-bindings](sessions-and-bindings.md) ·
[workspace-and-memory](workspace-and-memory.md) · [architecture/overview](../architecture/overview.md)。
