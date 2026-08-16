---
spec_id: AGENT_CORE_BINDING_WORKSPACE_V1
status: proposed
---

# Agent Core Binding Workspace V1

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结，不实现）** · 日期：2026-08-17
> 仓库：`mayf3/dsh-agent-core`
> 角色：Binding / Workspace Semantics Spec Agent
>
> 本 Spec 回答「这次允许改变什么」：允许把 workspace 选择权从「Agent 固定拥有一个
> workspace」迁移到「Binding 选择 (agent, session, workspace)」。它是
> `docs/investigations/test-agent-feishu-product-semantics-v1.md`（evidence authority，
> 已 PASS）的实施授权收敛。调查细节不在本 Spec 复制，仅作为 evidence source 引用。
>
> 本轮只新增 `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md`。**不修改代码、不写
> binding、不启动 runtime、不 merge。**

---

## Problem

当前 Binding 与 Workspace 模型与产品目标冲突：

```text
当前 Binding = { channelConversationId, activeAgentId, activeSessionId, updatedAt }
             — 无 workspace 字段（agent-router/src/binding-store.js）

当前 workspace = workspaceBootstrap.resolveWorkspace(agentId)
             = <workspaceRoot>/<agentId>
             = f(agentId) 且与 Binding / Session 无关
             （workspace-bootstrap/src/paths.js，source-verified）

demo-server 在 initialize({cwd}) 时把 process 级 cwd 捕获一次，
并把同一个 cwd 作为 meta:{cwd} 传给该进程内每一个 agents.create()
（packages/demo-server/src/index.js:83,225-226,145-146，source-verified）

结果：same Agent + different Feishu bindings → same workspace
```

这与 frozen product goal 冲突：

```text
Frozen Product Goal
  same Agent identity + different Binding
    → may use different Session
    → may use different Workspace

示例（Investigation §3/§5）：
  群 A → 小虾米 / session-A / workspace-A
  群 B → 小虾米 / session-B / workspace-B
  私聊 → 小虾米 / session-C / workspace-C
```

当前模型下该状态**不可表达**，且即使 Binding 带上 workspace，`one-process-one-cwd`
的 baked-in（`agent-router/src/process.js` `initialize({cwd: this.workspace})`）也会把
同一 Agent 的所有 binding 折叠进同一 workspace。

## Governing Evidence（全部 source-verified）

```text
GOVERNING_INVESTIGATION = docs/investigations/test-agent-feishu-product-semantics-v1.md
                          (TEST_AGENT_FEISHU_PRODUCT_SEMANTICS_INVESTIGATION_V1 = PASS)

DSH_WORKSPACE_SCOPE = SESSION
  - packages/fs/tool-fs/src/session-cwd.ts:24-26
      file tools resolve relative paths against exec.agent.session.header.cwd
  - packages/context/agent-instructions/src/index.ts:124
      instruction surface (AGENTS.md baseline) derived from agent.session.header.cwd
  - packages/workspace/workspace/src/index.ts
      WorkspaceRegistry groups sessions by canonical header.cwd;
      distinct cwd paths → distinct durable workspaces
  - packages/core/agent-loop/src/index.ts:589
      create(id, options, meta: Pick<SessionHeader,'cwd'>) — cwd is per-session meta
  - packages/core/agent-loop/src/index.ts:353
      systemPrompt variable 'cwd' = ctx.agent.session.header.cwd

WORKSPACE_IMMUTABLE_FOR_SESSION (DSH native)
  - create:      agents.create({meta:{cwd}}) 只在 fresh create 时把 cwd 写入 header
  - resume:      restoreOrCreateConfigured / resumeWith 按持久化的 session header
                 恢复（materialized header 含 cwd）；meta:{cwd} 不覆盖既有 session
  - 结论：DSH 没有运行期修改 session.header.cwd 的语义；cwd 在 session creation 冻结

ONE_AGENT_ONE_PROCESS_COMPATIBLE_WITH_MULTI_WORKSPACE = WITH_CONSTRAINTS
  - DSH 侧完全兼容（同一进程内多 session 各带不同 header.cwd）
  - Agent Core 侧未接线：Router 每个 Agent 只 spawn 一个进程，且进程 cwd 固定为
    resolveWorkspace(agentId)；约束在 wiring，不在 DSH kernel
```

## Proposal — Frozen Model

### Binding Schema（增补，向后兼容）

```text
BindingRow = {
  channelConversationId : string   # 主键（现有）
  activeAgentId         : string   # 现有
  activeSessionId       : string   # 现有
  workspace             : string | null   # 新增：stable workspaceId；null = 默认规则
  updatedAt             : string   # 现有
}
```

- `workspace` 是 **stable workspace ID**（字符串），**不是**裸路径——路径是部署形态，
  不应持久化进绑定（迁移/换根不重写 binding）。
- 默认 `null` 保留现有行为（见 Default Workspace Rule）。既有 binding 行兼容（新增
  字段 optional）。

### Workspace Resolution

```text
resolveWorkspacePath(workspaceId) =
    configWorkspaceMap[workspaceId]        # 显式映射（可选，部署侧配置）
    ?? <workspaceRoot>/<workspaceId>       # 默认派生，与今天 <workspaceRoot>/<agentId> 同构
```

- 复用现有 `workspace-bootstrap` 路径派生（不新建 Workspace 实体 / Runtime Instance /
  Profile / 新 Router 子系统）。
- 空 `workspaceId`（`null`）→ 现行 `resolveWorkspace(agentId)`（agent-scoped）。

### Default Workspace Rule

```text
DEFAULT_WORKSPACE_RULE = binding.workspace == null
    → resolveWorkspace(agentId)   # 现行行为，向后兼容
  binding.workspace != null
    → resolveWorkspacePath(binding.workspace)
```

**显式 workspace 永远优先；未指定时落回 agent-scoped（现状）**，保证历史 binding /
default-agent auto-bind 不变。

### Session / Workspace Semantics（冻结）

```text
WORKSPACE_IMMUTABLE_FOR_DSH_SESSION = YES（强制）
  - workspace 在 DSH session creation 时冻结（agents.create({meta:{cwd}})；
    resume 恢复持久化 header；DSH 无运行期改 cwd 语义）
  - Binding 的 workspace 变化**不得**偷偷改动已有 session 的 cwd

SESSION_WORKSPACE_MAPPING =
  workspace 不同 → 必须落在不同的 DSH Session
  （Binding 的 activeSessionId 指向的 session，其 header.cwd 必须等于该 Binding
   解析出的 workspace 路径；否则视为不一致，Router 必须选择：
     a) 为该 workspace 使用/创建对应 session，或
     b) 结构化拒绝（要求显式 session 选择），绝不静默改 cwd）
```

- **一个 session 运行期间不允许切 cwd**。想要不同 workspace = 不同的 session，
  不是一个 session 换 cwd。

### Binding Key → Session/Workspace Mapping

```text
每个入站 conversation（p2p chatId / group oc_* / thread）是独立的
ChannelConversation + Binding row，key = feishu:<conversationId>（现有 namespace，
merge audit FIX 1）。

group A (oc_A)  -> binding { agent=小虾米, session=main-A,  workspace=ws-A }
group B (oc_B)  -> binding { agent=小虾米, session=main-B,  workspace=ws-B }
private (p2p C) -> binding { agent=小虾米, session=main-C,  workspace=ws-C }

各 binding 的 (activeAgentId, activeSessionId, workspace) 相互独立；
workspace 不同的 binding 必须映射到不同 session id。
```

### Workspace 如何进入 DSH session.header.cwd

```text
Router 解析 binding.workspace → resolveWorkspacePath() → 路径 P
  → 在 turn()/deliver() 的 session 创建路径中把 P 传给 demo-server
  → demo-server 以 P 作为该 session 的 agents.create({meta:{cwd:P}})
  → DSH session.header.cwd = P（既有机制，无需 Kernel 改动）

现有 seam（source-verified）：
  packages/demo-server/src/index.js:225-226  initialize({cwd})（当前捕获一次）
  packages/demo-server/src/index.js:145-146  agents.create({meta:{cwd}})
  packages/agent-router/src/process.js:143    initialize({cwd: this.workspace})
  packages/agent-router/src/process.js:253    （ready 重复同值）
```

### One-Agent-One-Process（保持）

```text
ONE_AGENT_ONE_PROCESS_PRESERVED = YES
  - 一个 Agent 一个 DSH process（registry 仍按 agentId 键控）
  - 该 process 内的多个 session 各带独立 header.cwd（DSH 原生支持）
  - 不因 multi-workspace 创建第二个 process / Runtime Instance / Profile
```

## Must-Answer（Evidence-Anchored）

| # | Question | Answer |
|---|---|---|
| 1 | Binding 是否直接持有 workspace? | **YES**——Binding 新增 optional `workspace` 字段，是 workspace 选择 authority（与 activeAgentId/activeSessionId 并列） |
| 2 | workspace 是路径还是 stable ID? | **stable workspace ID**（配置可映射路径）；路径不持久化进 Binding |
| 3 | Binding 未指定 workspace 默认规则? | `resolveWorkspace(agentId)`（现行 agent-scoped），显式优先、向后兼容 |
| 4 | session 已存在后 Binding workspace 变? | **不静默改已有 session cwd**；workspace 变 = 换/建不同 session（或结构化拒绝）；DSH resume 恢复持久化 header，覆盖语义不存在 |
| 5 | session 运行期可否切 cwd? | **NO**——workspace 在 session creation 冻结（DSH native）；不同 workspace ⇒ 不同 session |
| 6 | private/group key 如何映射? | 各 conversation 独立 binding row（`feishu:<conversationId>`），各 row 独立选 (agent, session, workspace) |
| 7 | workspace 如何进 session.header.cwd? | Binding → Router resolveWorkspacePath → 按 session 传 demo-server → `agents.create({meta:{cwd}})`（既有 seam） |
| 8 | one-Agent-one-process 保持? | **YES**（进程按 agentId；多 workspace 在多 session 内，不新建进程） |

## D-002 Disposition

```text
D002_DISPOSITION = SUPERSEDE
```

依据：方向**实质改变**（.agents/README.md standing order 6：方向实质改变走 SUPERSEDE）。
D-002 `AGENT_SESSION_CHANNEL_MODEL_V1.md` §1 原则 1 / §2.1「Agent 固定拥有自己的
workspace / DSH_HOME…」与新 long-lived invariant 直接冲突——workspace 从「Agent 固定
拥有」变为「Binding/Session 选择」。这不是澄清/纠正同方向（那才走 AMEND），而是把
workspace 所有权从 Agent 移到 Binding。

```text
新 long-lived invariant（替代 D-002 的 workspace 归属条款；D-002 其余实体模型
Agent/Session/ChannelConversation/Binding、channel-agnostic、switchAgent 只改绑定、
main 长期主会话等语义不受影响）:

  Agent identity does not uniquely determine workspace.
  Workspace may be selected by Binding / Session.
  同一 Agent 的不同 Binding 可以映射到不同 Session 与不同 Workspace。
  workspace 在 DSH Session 创建时冻结；不同 workspace ⇒ 不同 Session。

D-004 BINDING_AND_SWITCH_V1（Router 是 Binding 唯一 owner、单一 switchAgent 原语、
原子 JSON 持久化、one-process-one-workspace 的进程模型）：
  - switchAgent 的单一原语不变；本 Spec 补充其可携带 optional workspace 语义。
  - D-004 那套「一个 Agent 一次一个 routed turn」single-flight 按 AgentProcess 边界
    保持不变（多 session 同 process 并行，仍受 per-process single-flight 约束）。
  - D-004 的 Binding 持久化契约（原子 JSON、单文档）保持；仅行结构增补 workspace。
```

## Scope（Allowed for Implementation）

允许（优先最小 delta，复用现有 seam；全部在 Implementation 轮完成，本轮不实现）：

- Binding store / persistBinding / switchAgent 增补 optional `workspace`（workspaceId）。
- workspace-bootstrap 增加 `resolveWorkspacePath(workspaceId)`（含 configWorkspaceMap
  可选映射；默认派生）。
- demo-server 接受 per-session cwd（不再把一个 process cwd 塞给所有 session）。
- Router AgentProcess turn()/deliver() 按 binding 解析 workspace 路径并按 session 传入。
- 验收断言（见 Acceptance Criteria）。

## Non-Goals and Frozen Boundaries

```text
FORUM_CREDENTIAL            = OUT_OF_SCOPE（Investigation 已定位；另由 spec/runbook 处理）
LARK_REACTION_TYPING        = OUT_OF_SCOPE
CARDS_STREAMING_MEDIA       = OUT_OF_SCOPE
REQUIRE_MENTION             = OUT_OF_SCOPE（owner = LARK_TRANSPORT_INVESTIGATION）
AGENT_RUNTIME_REDESIGN      = OUT_OF_SCOPE
ROUTER_REWRITE              = OUT_OF_SCOPE
KERNEL_CHANGE               = NONE（DSH 本身无需改动）
NEW_WORKSPACE_AGENT         = NO（不新建 Workspace Agent 实体）
NEW_RUNTIME_INSTANCE        = NO
NEW_PROFILE_ENTITY          = NO
NEW_ROUTER_SUBSYSTEM        = NO
```

## Alternatives considered

- **Model B：Agent Definition → 多个 Runtime Instance（registry 按 (agentId,workspace)）**：
  否决。破坏「registry 按 agentId」与 per-agent single-flight 冻结假设；本轮 DSH 原生
  支持 per-session cwd，无需多进程。
- **Model C：Binding → Agent Profile / Workspace Instance（新产品实体）**：否决。只有
  在 Model A 证明不够时才考虑；新增实体是更大语义负担。
- **workspace 以裸路径存入 Binding**：否决。路径是部署形态；迁移/换根会破坏绑定。
  stable workspaceId + 部署侧映射更稳。
- **session 运行期切 cwd（DSH 语义变更）**：否决。DSH 无此语义，且违背
  workspace-immutable 原则；不同 workspace 走不同 session。
- **Binding workspace 改变时静默迁移已有 session cwd**：否决。会话历史/记忆/文件按
  原 cwd 语义沉淀，静默换根是数据丢失与语义欺诈。

## Acceptance Criteria

Implementation 至少证明（无 Kernel change、单 Agent 进程不变）：

1. same Agent + Binding A → session A cwd = workspace-A 路径；Binding B → session B cwd =
   workspace-B 路径；`workspace-A != workspace-B`。
2. 两条 binding 的 `session.header.cwd` 各不相同（从 DSH session artifact 读取）。
3. Agent process 可保持同一（registry 仍按 agentId 一个 process）。
4. 跨 binding 无 cwd 泄漏：Binding A 的 turn 不读取/不写入 Binding B 的 workspace。
5. Binding 未指定 workspace → 现行 `resolveWorkspace(agentId)` 路径（向后兼容断言）。
6. 已有 session 的 workspace 不因 Binding 变化而改动（immutable 断言）。
7. 不同 workspace 的 binding 不会复用同一个已有 session id（session-per-workspace）。
8. 无 Kernel / Router 架构重写（只允许本 Spec Scope 内的 seam 变更）。

```text
ROUTER_CHANGE_REQUIRED      = YES（最小：binding 解析 workspace + 按 session 传 cwd）
SESSION_SEAM_CHANGE_REQUIRED = YES（demo-server per-session cwd）
KERNEL_CHANGE               = NONE
```

## Risks

- **静默 cwd 迁移**破坏会话沉淀 → 冻结 workspace-immutable + session-per-workspace。
- **binding 路径持久化**导致部署耦合 → workspace 只用 stable ID，路径经部署侧映射。
- **默认规则破坏存量** → default = `resolveWorkspace(agentId)`，向后兼容。
- **同一进程多 session 并发 turn** → D-004 per-process single-flight 不变，会话级
  并行仍受其约束。

## Related Evidence

- `TEST_AGENT_FEISHU_PRODUCT_SEMANTICS_INVESTIGATION_V1 = PASS`:
  `docs/investigations/test-agent-feishu-product-semantics-v1.md`
- D-002: `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`（本 Spec SUPERSEDE 其
  workspace 归属条款）
- D-004: `docs/decisions/BINDING_AND_SWITCH_V1.md`（Binding owner / 持久化 / single-flight
  保持；行结构增补）
- DSH harness（evidence）：`packages/core/agent-loop/src/index.ts`、
  `packages/fs/tool-fs/src/session-cwd.ts`、`packages/workspace/workspace/src/index.ts`
- Agent Core：`packages/agent-router/src/{binding-store,process,index}.js`、
  `packages/demo-server/src/index.js`、`packages/workspace-bootstrap/src/{index,paths}.js`

---

## Final Output

```text
AGENT_CORE_BINDING_WORKSPACE_V1_SPEC = PASS

GOVERNING_INVESTIGATION = TEST_AGENT_FEISHU_PRODUCT_SEMANTICS_INVESTIGATION_V1 = PASS
                          (docs/investigations/test-agent-feishu-product-semantics-v1.md)

D002_DISPOSITION = SUPERSEDE
  （方向实质改变：workspace 从 Agent 固定拥有 → Binding/Session 选择；
    D-002 其余实体/API 语义不受影响；D-004 的 Binding owner/持久化/single-flight 保持）

WORKSPACE_AUTHORITY = Binding（optional stable workspaceId）+ 默认 agent-scoped 兜底
BINDING_SCHEMA = { channelConversationId, activeAgentId, activeSessionId,
                   workspace: string|null, updatedAt }
SESSION_WORKSPACE_SEMANTICS = workspace immutable for a DSH Session（creation 冻结、
                              resume 恢复持久化 header；不同 workspace ⇒ 不同 session）
DEFAULT_WORKSPACE_RULE = binding.workspace==null → resolveWorkspace(agentId)（现状）；
                         else → resolveWorkspacePath(binding.workspace)

ONE_AGENT_ONE_PROCESS_PRESERVED = YES

ROUTER_CHANGE_REQUIRED = YES（最小 seam：binding workspace → 按 session 传 cwd）
SESSION_SEAM_CHANGE_REQUIRED = YES（demo-server per-session cwd）
KERNEL_CHANGE = NONE

IMPLEMENTATION_SCOPE =
  binding-store/persistBinding/switchAgent 增补 optional workspace
  workspace-bootstrap.resolveWorkspacePath(workspaceId)
  demo-server per-session cwd
  router turn/deliver 按 binding 解析并传 session cwd
  acceptance assertions (AC-1..AC-8)
OUT_OF_SCOPE =
  Forum credential · Lark reaction/typing · cards/streaming/media · requireMention ·
  Agent Runtime redesign · Router rewrite · new Workspace Agent / Runtime Instance /
  Profile / Router subsystem · Kernel change

READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```