---
spec_id: AGENT_CORE_BINDING_WORKSPACE_V1
status: accepted
amendment: AGENT_CORE_BINDING_WORKSPACE_V1_SPEC_PRODUCT_MODEL_AMEND
---

# Agent Core Binding Workspace V1 — Product Model AMEND

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结，不实现）** · 日期：2026-08-17 · AMEND 2026-08-17
> 仓库：`mayf3/dsh-agent-core`
> 角色：Binding / Workspace Semantics Spec Agent
>
> 本文档是 `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md` 的 **产品模型收敛（AMEND）**。
> 它不是第二份平行 Spec；它在原 proposal 之上 **收窄 workspace resolution、保留
> Binding.workspace、冻结 session-level cwd、加入 Feishu/App 产品 policy、明确产品 policy
> ≠ Router policy**。原 proposal 已经通过 Independent Spec Review（VERDICT = FIX_REQUIRED，
> Review disposition 见 §ReviewDisposition）；本轮按用户澄清的真实产品形态收敛成以下单一最终模型。
>
> 本 Spec 回答「这次允许改变什么」：允许把 workspace 选择权从「Agent 固定拥有唯一
> workspace」迁移到「Binding 决定 effective workspace」，同时 **不引入 Workspace Registry /
> configWorkspaceMap / arbitrary path map / 新运行时实体 / kernel 变更**。它是
> `docs/investigations/test-agent-feishu-product-semantics-v1.md`（evidence authority，已 PASS）
> 的实施授权收敛。调查细节不在本 Spec 复制，仅作为 evidence source 引用。
>
> 本轮只修改 `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md`。**不修改代码、不写
> binding、不启动 runtime、不 merge。**

---

## Review Disposition（2892099 已通过 Independent Review）

```text
BASE_REVIEWED_HEAD = 2892099

# Independent Review 结论（本 AMEND 的前提）
DSH_SESSION_WORKSPACE_EVIDENCE  = PASS
D002_SUPERSEDE_SCOPE            = PASS
D004_PRESERVED                  = YES
WORKSPACE_AUTHORITY direction   = PASS
BACKWARD_COMPATIBILITY          = PASS
ROUTER_SEAM_MINIMAL             = PASS
ROUTER_PRODUCT_SPECIAL_CASE     = NONE
ONE_AGENT_ONE_PROCESS_PRESERVED = YES
NEW_RUNTIME_ENTITY_REQUIRED     = NO
KERNEL_CHANGE                   = NONE

VERDICT = FIX_REQUIRED
  - workspaceId/path safety 未冻结完整          -> 本 AMEND §WorkspaceIdValidation 收窄冻结
  - workspace 切换时 Session 行为留下二选一       -> 本 AMEND §SessionWriteContract 冻结唯一契约
  - restart/resume、mismatch、instruction isolation 验收不足
                                             -> 本 AMEND §Acceptance 补齐 AC5..AC7

# 重要：不要机械按旧 Review 建设 configWorkspaceMap / Workspace Registry。
# 用户在 Review 后又澄清了真实产品形态（本 AMEND 的 NEW_EVIDENCE），
# 收敛成 §ProductModel / §WorkspaceResolution 的极薄模型。
```

---

## NEW_EVIDENCE（本 AMEND 的语义来源）

Review 之后用户澄清了**两种真实产品形态**，它们共同定义「effective workspace 从何而来」：

```text
SCENARIO_A_FEISHU_GROUP
  每个 Feishu 群有一个唯一的 conversation/openId（如 oc_xxx）。
  该群长期对应一个固定 Workspace：
      Feishu Group A -> Workspace A
  workspaceId 由 conversation identity 确定性产生（stable），
  概念上 feishu-<normalized-conversation-id>（具体串不写死，复用 sanitize 规则）。
  同一个群下同时存在多个 Session：
      main-session · cron-daily · memory-maintenance · other task sessions
  sessionId 不同、cwd 相同 -> 共享 AGENTS.md / MEMORY.md / files / 长期资料，
  但 conversation context / trajectory 各自独立。
  （用户感知：它们像同一个长期 Agent，因为共享同一 Workspace；实际是不同的 Session。）

SCENARIO_B_APP_AGENT_SWITCH
  另一 App 中，用户通过语音/前端操作切换 Agent（切到秘书 Agent / 投资 Agent / 论文 Agent）。
  这些 Agent 各自有稳定默认 Workspace：
      Secretary   -> secretary workspace
      Investment  -> investment workspace
      Paper       -> paper workspace
  切 Agent 时实际一起切换到：
      target Agent + target effective Workspace + compatible Session
  （绝不允许投资 Agent + 秘书 Workspace。）但 Router 不解读 App 产品逻辑。
```

本 AMEND 收敛出的统一模型见 §ProductModel。

---

## Problem

当前 Binding 与 Workspace 模型与产品目标冲突：

```text
当前 Binding = { channelConversationId, activeAgentId, activeSessionId, updatedAt }
             — 无 workspace 字段（packages/agent-router/src/binding-store.js，source-verified）

当前 workspace = workspaceBootstrap.resolveWorkspace(agentId)
             = <workspaceRoot>/<agentId>
             = f(agentId) 且与 Binding / Session 无关
             （packages/workspace-bootstrap/src/paths.js，source-verified）

demo-server 在 initialize({cwd}) 时把 process 级 cwd 捕获一次，
并把同一个 cwd 作为 meta:{cwd} 传给该进程内每一个 agents.create()
（packages/demo-server/src/index.js:83,145,226，source-verified）

agent-definition 把 config 冻结为 { version, defaultAgentId, agents }，
不允许 workspace/persona/credential/runtime 字段进入
（packages/agent-definition/src/config.js:78-81,121-126，source-verified）

router ensureRunning(agentId) 在 spawn 时把 agentId 的 workspace 烘进唯一 AgentProcess，
同一 Agent 的所有 binding/session 共享该单进程 workspace
（packages/agent-router/src/index.js  +  packages/agent-router/src/process.js，source-verified）

agent-memory 从已解析的 workspace 推导 MEMORY.md：<workspace>/MEMORY.md、
<workspace>/memory/YYYY-MM-DD.md —— memory 文件由 workspace 决定，不孤立于 agentId
（packages/agent-memory/src/paths.js:29-51，source-verified）

结果：same Agent + different Feishu bindings -> same workspace（产品违规，见 Investigation §3/§5）
```

这与 frozen product goal 冲突：

```text
Frozen Product Goal
  same Agent identity + different Binding
    -> may use different Session
    -> may use different Workspace

场景 A（Feishu 群）：
  群 A -> 小虾米 / session-main-A / workspace-A（= feishu-oc_A...）
  群 B -> 小虾米 / session-main-B / workspace-B（= feishu-oc_B...）

场景 B（App 切 Agent）：
  App -> 秘书 Agent / secretary workspace
  App -> 投资 Agent / investment workspace
  同一入口切 Agent + effective workspace + compatible session
```

当前模型下该状态**不可表达**，且即使 Binding 带上 workspace，`one-process-one-cwd`
的 baked-in（`agent-router/src/process.js` `spawn({cwd: this.workspace})` + demo-server 单
process cwd）也会把同一 Agent 的所有 binding 折叠进同一 workspace。

本 AMEND 回答「如何接起 Binding → Workspace → Session.cwd 这条线」，并收窄
workspace resolution 到极薄。

---

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
      distinct cwd paths -> distinct durable workspaces
  - packages/core/agent-loop/src/index.ts:589
      create(id, options, meta: Pick<SessionHeader,'cwd'>) — cwd is per-session meta
  - packages/core/agent-loop/src/index.ts:353
      systemPrompt variable 'cwd' = ctx.agent.session.header.cwd

WORKSPACE_IMMUTABLE_FOR_SESSION (DSH native)
  - create:   agents.create({meta:{cwd}}) 只在 fresh create 时把 cwd 写入 header
              (agent-loop/src/index.ts:355-361: meta = cwd===undefined?{}:{cwd};
               create(id, options, meta) at :589)
  - resume:   resumeWith / resumeSessionId 按持久化的 session header 恢复；
              meta:{cwd} 不覆盖既有 session（agent-loop/src/index.ts:653-675）
  - 结论：DSH 没有运行期修改 session.header.cwd 的语义；cwd 在 session creation 冻结；
          resume 只恢复持久化 header，绝不重新猜测 cwd

ONE_AGENT_ONE_PROCESS_COMPATIBLE_WITH_MULTI_WORKSPACE = WITH_CONSTRAINTS
  - DSH 侧完全兼容（同一进程内多 session 各带不同 header.cwd；也可多 session 同 cwd）
  - Agent Core 侧未接线：Router 每个 Agent 只 spawn 一个进程，且进程 cwd 固定为
    resolveWorkspace(agentId)；约束在 wiring，不在 DSH kernel

AGENT_DEFAULT_WORKSPACE_ALREADY_EXPRESSIBLE = YES
  - resolveWorkspace(agentId) = <workspaceRoot>/<sanitizeAgentId(agentId)>
    （workspace-bootstrap/src/paths.js:87-92）
    已经确定性表达 "Agent -> default workspace"（App 场景的 secretary/investment/paper
    默认 workspace 就是 resolveWorkspace(agentId)）
  - agent-definition config 明确禁止 workspace 字段进入（config.js:78-81），
    因此本 AMEND **不新增** AgentDefinition.defaultWorkspaceId —— 无需扩大 Agent Definition。

MEMORY_IS_WORKSPACE_KEYED = YES
  - agent-memory 从 workspace 推导 MEMORY.md / memory/（paths.js:29-51）
  - 同一 workspace 的多个 session 自然共享同一份 MEMORY.md / AGENTS.md / files

SANITIZE_REUSABLE (workspaceId safety)
  - sanitizeAgentId（workspace-bootstrap/src/paths.js:60,135-149）是一个同构的
    safe-id helper：只允许 [A-Za-z0-9_-]，拒绝 `/` `\` `.` NUL，拒绝 overlong /
    absolute / leading-trailing space。V1 直接复用作 workspaceId 的校验器。
  - configWorkspaceMap / resolveWorkspacePath：当前代码中**不存在**（grep 无命中），
    仅为旧 proposal 的构想 —— 本轮删除。
```

---

## Product Model（收拢后的统一概念）

```text
Agent        = 谁在工作 / 长期身份（长期实体；身份与生命周期不依赖任何 Channel）
Workspace    = 在哪里工作 / 长期工作环境（长期工作目录；含 AGENTS.md / MEMORY.md / files）
Session      = 一次具体对话或任务轨迹（一次起止的上下文）
Binding      = 当前产品入口实际组合哪个
               Agent + effective Workspace + active Session
```

长期 invariant（本 Spec 冻结，取代 D-002 的 workspace 归属条款）：

```text
LONG_LIVED_INVARIANTS
  - Agent identity does NOT uniquely determine Workspace.
  - Agent MAY have a default Workspace.（即 resolveWorkspace(agentId)）
  - Binding determines the effective Workspace.
  - Multiple Sessions MAY share one Workspace.
  - One native DSH Session has exactly one immutable cwd.
  - Different Workspace => different compatible native Session
    （绝不复用同一 native session；绝不静默改 cwd；只能 select/create compatible session）
```

---

## Binding Schema（保留 Binding.workspace，向后兼容）

```text
BindingRow = {
  channelConversationId : string            # 主键（现有）
  activeAgentId         : string            # 现有
  activeSessionId       : string            # 现有
  workspace             : string | null     # 保留：stable effective workspaceId；null = 默认规则
  updatedAt             : string            # 现有
}
```

- `workspace` 是 **stable effective workspaceId**（字符串），**不是**裸路径——路径是部署
  形态，不持久化进绑定（迁移/换根不重写 binding）。
- `null` 保留现有行为（见 Default Workspace Rule）。既有 binding 行兼容（字段 optional）。
- **BINDING_WORKSPACE_PRESERVED = YES**：不因「Feishu conversation 自动决定 workspace」
  删除 Binding.workspace。App 场景已证明 effective workspace 不总来自 conversationId；
  Binding 保存的是**最终选择结果**（stable effective workspaceId）。至于为什么选这个
  workspace，是 Binding 前面的产品 policy（见 §ProductPolicyAndRouterLayering）。

---

## Workspace Resolution — 极薄

```text
resolveWorkspacePath(workspaceId) =
    <workspaceRoot>/<sanitizeWorkspaceId(workspaceId)>
    （复用现有 workspace-bootstrap 路径派生：resolveWorkspace 已接受任意 id 字符串并
      走 sanitize；不新建 Workspace 实体 / Runtime Instance / Profile / Workspace Registry）

WorkspaceId 校验（复用/原地提取同构 safe-id helper，见 §WorkspaceIdValidation）
```

**删除**旧 proposal 的 `configWorkspaceMap` 与 optional 显式映射（第一优先级）。真实需求
没有证明需要一套 Workspace Mapping System：

```text
CONFIG_WORKSPACE_MAP = REMOVED / NOT_REQUIRED（V1 不建设）
ANY_ARBITRARY_PATH_MAP = NOT_ALLOWED（Binding 只存 stable workspaceId，不存路径）
MULTIPLE_WORKSPACE_ROOTS = NOT_INTRODUCED
```

empty `workspace`（`null`）→ 现行 `resolveWorkspace(agentId)`（agent-scoped，见 Default
Workspace Rule）。

### Default Workspace Rule

```text
DEFAULT_WORKSPACE_RULE = binding.workspace == null
    -> resolveWorkspace(agentId)             # 现行行为，Agent default workspace，向后兼容
  binding.workspace != null
    -> resolveWorkspacePath(binding.workspace)
```

**显式 workspace 永远优先；未指定时落回 Agent default workspace（现状）**，保证历史
binding / default-agent auto-bind 不变。Agent default workspace = `resolveWorkspace(agentId)`
——App 场景的「秘书 → secretary workspace / 投资 → investment workspace / 论文 → paper
workspace」正是由此表达，**不新增 AgentDefinition.defaultWorkspaceId**。

---

## WorkspaceIdValidation（冻结完整）

复用 `sanitizeAgentId`（workspace-bootstrap/src/paths.js，安全单路径段的同构校验证器），
**不给 workspaceId 单独造一套安全系统**：

```text
workspaceId 必须是单个安全 path component：
  - 非空字符串；trim 后等于原值（无前导/尾随空格）
  - 只允许 [A-Za-z0-9_-]（拒绝 `/` `\` `.` `..` NUL）
  - 不可能是 absolute path（`/` 已禁，列表性守卫仍在）
  - 长度 <= MAX_AGENT_ID_LENGTH（=200）
  - 任何不合法 -> STRUCTURED_REJECT（不 truncate、不 reshape、不静默 sanitize 成别的）
```

Workspace 不存在怎么办（对齐任务 §11）：

```text
WRITE_VALIDATION_ONLY = NO —— 只对 workspaceId 的 *格式* 做结构化 reject，
                       不对「合法 workspaceId 但目录尚不存在」做 reject。

WORKSPACE_MISSING_BEHAVIOR = Valid workspaceId
    -> deterministic path（resolveWorkspace）
    -> 复用现有 Workspace Bootstrap 的 ensure/mkdir（idempotent, never overwrite）
    （workspace-bootstrap/src/index.js ensure + provisionAgentHome mkdirSync，
      source-verified；valid workspaceId + 目录不存在 = 正常初始化路径）

只能对 invalid workspaceId 才 STRUCTURED_REJECT。
不引入 Workspace registry / DB / pre-registration system / arbitrary path map。
```

---

## Workspace 不存在怎么办（Bootstrap 复用）

```text
valid workspaceId
    -> resolveWorkspace(workspaceId)         # deterministic path
    -> workspaceBootstrap ensure（或其同构 id-keyed ensure）+ provisionAgentHome mkdir
       # 现有机制，idempotent；目录不存在则创建/初始化，绝不复用 agentId 强制
invalid workspaceId
    -> STRUCTURED_REJECT（见 §WorkspaceIdValidation）
```

本轮不需要为「unknown workspaceId」建设 Workspace Registry：合法 id + 目录缺失只是
「还没 bootstrap」，由现有 ensure 创建即可。Binding 侧的 workspace 路径在
turn()/deliver() 创建 session 时按 effective workspace 解析并传给 demo-server，
即「自动 ensure」。

---

## Session Semantics（冻结）

```text
SESSION_CWD_IMMUTABLE = YES（强制）
  - cwd 在 native DSH Session creation 时冻结（agents.create({meta:{cwd}})；
    resume 恢复持久化 header；DSH 无运行期改 cwd 语义 —— agent-loop source-verified）
  - Binding 的 workspace 变化**不得**偷偷改动已有 session 的 header.cwd

SAME_WORKSPACE_MULTI_SESSION = ALLOWED（期望行为）
  - 同一 Workspace（同一 cwd）下允许任意多个 Session：
      Group A: main-session + cron-daily + cron-memory + task-sessions
    -> sessionId 不同、header.cwd 相同
    -> 都读取相同 AGENTS.md / MEMORY.md / files（agent-memory 由 workspace 决定）
    -> conversation context / trajectory 各自独立
  - same cwd across sessions 是期望行为，不是隔离失败（与 "different workspace =>
    隔离" 并存，见 AC7 vs AC6）

CROSS_WORKSPACE_SESSION_REUSE = FORBIDDEN
  - different workspace => MUST NOT reuse the same native DSH Session
  - 若最终解析到 persisted session.header.cwd = A 而 resolved Binding workspace = B，
    必须 STRUCTURED_REJECT —— 绝不静默 mutate cwd，Binding 不得进入半写状态
```

### Session Write Contract（最小、确定性写入契约）

任务 §13：把「a 或 b 均可」的旧 Review 二选一收窄成**唯一**冻结契约，不留给
Implementation Agent 二义性：

```text
SESSION_WRITE_CONTRACT
  turn()/deliver() 命中 session S（由 Binding.activeSessionId 决定）时：

  R1. 该 native session 尚不存在（冷启动）
        -> 以 resolved effective workspace 为 cwd 创建 S:
           agents.create({ sessionId: S, meta: { cwd: <resolvedWorkspace> } })   # 唯一创建契约
  R2. 该 native session 已存在且已持久化（resume/重启）
        -> resume 恢复持久化 header；绝不再传 meta:{cwd}（meta 不覆盖既有 header）
        -> 校验持久化 header.cwd == <resolvedWorkspace>：
           . 相等 -> 复用，正常路由
           . 不等 -> STRUCTURED_REJECT（mismatch，见 R3）
  R3. cross-workspace mismatch（persisted cwd == A，resolved workspace == B，A≠B）
        -> STRUCTURED_REJECT（error code 见 §Errors）
           . 不改动持久化 session 的 cwd（仍 = A）
           . Binding 不写入该不兼容 activeSessionId（不变更 activeSessionId 指向该不兼容 S）
           . 绝不隐式创建另一个 Session、绝不静默切 cwd
```
- 产品入口通过**已有 Session seam** select / create a compatible session
  （D-002 `switchAgent(…, { targetSessionId })` / `activeSessionId`），但最终 Binding
  update 必须保证 `activeSessionId` 与 `effective workspace` **compatible**。
- 不要过度冻结成「human/operator 必须手工提供 sessionId」；冻结的 invariant 只是
  `different workspace ⇒ different compatible native session`，Select/Create 的 UX 属于
  产品入口。

---

## Product Policy 与 Router 分层

**产品 policy ≠ Router policy**，这句话是冻结边界。

### 产品入口 policy（Binding creation / switch policy，属于产品入口，不进 Router 核心规则）

```text
FEISHU_WORKSPACE_POLICY（Binding creation）=
    conversation/openId -> deterministic workspaceId
    （Feishu Group A(oc_A) -> workspace feishu-<normalized oc_A>；
      复用现有 channel namespace 'feishu' 与 sanitize 规则；具体串不写死）

APP_AGENT_SWITCH_WORKSPACE_POLICY =
    selected Agent -> selected Agent default workspace（resolveWorkspace(agentId)）
    （切到 Investment Agent ——> investment workspace；绝不出现 投资Agent+秘书 Workspace）
```

这两条 policy 决定 **Binding.workspace 最终选值**（effective workspaceId），发生在
产品入口（Feishu 群 bind、App switch 的前端/语音动作）解析成 Binding 时，不是 Router
的 turn/deliver 逻辑。

### Router policy（统一机械执行）

```text
ROUTER_POLICY = 机械执行下列三元组，无产品分支：

  AgentProcess(agentId)
    + DSH Session(sessionId, cwd = resolveWorkspacePath(binding.workspace))

ROUTER_DISALLOWED：
  - if Feishu ... if App ...           （禁止产品分支）
  - workspace = openId ...             （workspace 取值不在 Router）
  - workspace = Agent default ...       （workspace 取值前置在产品 policy 已算成 Binding.workspace）
  - 解读 App 产品逻辑 / 群产品逻辑
```

Router 不再有 `ROUTER_PRODUCT_SPECIAL_CASE`（= NONE）。产品 policy 把「为什么选这个
workspace」消化成 Binding.workspace，Router 只认
`Binding { agentId, workspaceId, sessionId }`。

---

## Product Policy 具体化（两条）

```text
FEISHU_CONVERSATION_TO_WORKSPACE
  每个 Feishu conversation（per p2p chatId / group oc_* / thread）是独立
  ChannelConversation + Binding row（key = feishu:<conversationId>，现有 namespace）。
  群 A (oc_A) -> binding { agent, session=main-A, workspace=ws-feishu-A }
  群 B (oc_B) -> binding { agent, session=main-B, workspace=ws-feishu-B }
  私聊 (p2pC) -> binding { agent, session=main-C, workspace=ws-feishu-C }
  同群内多 session（main-session/cron-daily/...）共享同一 ws-feishu-x（同一 cwd）。

APP_AGENT_SWITCH_TO_TARGET_DEFAULT
  入口 App 当前和「秘书 Agent」聊天 -> 秘书 workspace。
  用户说「切到投资 Agent」 -> 目标有效 workspace = 投资 Default workspace
     = resolveWorkspace(investmentAgentId)；compatible active Session。
  绝不出现 投资Agent + 秘书 Workspace。
```

---

## D-002 / D-004 Disposition

```text
D002_DISPOSITION = SUPERSEDE（但只 supersede 一条条款）
```

supersede 的范围（OLD）：

```text
D-002 被 supersede 的条款：
  「Agent 固定拥有唯一/自己的 workspace」（D-002 AGENT_SESSION_CHANNEL_MODEL_V1
   §1 原则 1 / §2.1「Agent 固定拥有自己的 workspace / DSH_HOME …」中与 workspace 唯一
   归属相关的句子）
```

替代为：

```text
新 long-lived invariant：
  Agent identity does NOT uniquely determine effective Workspace.
  Agent MAY have a default Workspace（resolveWorkspace(agentId)）。
  Binding determines the effective Workspace（Binding.workspace，null -> Agent default）。
  Session freezes resolved cwd；same workspace -> many sessions allowed；
  different workspace -> different compatible native session；绝不静默改 cwd。
```

不受影响（保留原语义）：

```text
D-002 其余实体 / API 语义保持不变：
  DSH_HOME 归属、credential 归属、memory 归属、
  Agent / Session / ChannelConversation / Binding 实体模型、
  channel-agnostic 原则、switchAgent 只改绑定、main 长期主会话、resolveChannelConversation。
```

```text
D004_PRESERVED = YES
  - Binding owner = Router / Control Plane（唯一 owner）保持不变。
  - atomic JSON persistence、switchAgent 唯一原语、per-agent single-flight —— 全保持。
  - 本 Spec 只给 switchAgent 加 optional workspace 语义
    （switchAgent(..., { targetSessionId?, workspace? }) 作为 target 的三元组之一），
    并给 Binding 行结构增补 workspace 字段。
  - Browser/Router 层无 product if/else。
```

---

## One-Agent-One-Process（保持）

```text
ONE_AGENT_ONE_PROCESS_PRESERVED = YES
  - 一个 Agent 一个 DSH process（registry 仍按 agentId 键控）
  - 该 process 内的多个 session 各带独立 header.cwd（DSH 原生支持；也可同 cwd）
  - 不因 multi-workspace 创建第二个 process / Runtime Instance / Workspace Agent / Profile
```

---

## Workspace 如何进入 DSH session.header.cwd

```text
Router 解析 binding.workspace -> resolveWorkspacePath() -> 路径 P
  -> 在 turn()/deliver() 的 session 创建路径中把 P 传给 demo-server
  -> demo-server 以 P 作为该 session 的 agents.create({meta:{cwd:P}})（SESSION_WRITE_CONTRACT R1）
  -> DSH session.header.cwd = P（既有机制，无需 Kernel 改动）

现有 seam（source-verified）：
  packages/demo-server/src/index.js:225-226  initialize({cwd})（当前捕获一次）
  packages/demo-server/src/index.js:145      agents.create({meta:{cwd}})
  packages/agent-router/src/process.js:142-143 spawn({cwd: this.workspace})
  packages/agent-router/src/process.js:252-257 ready() initialize({cwd})
  最小 delta = 把单一 process cwd 改为按 session 传入 effective workspace 的 cwd。
  （demo-server 的 getOrCreateSession 需接收 per-session cwd；router turn/deliver 同。）
```

---

## Must-Answer（Evidence-Anchored）

| # | Question | Answer |
|---|---|---|
| 1 | Binding 是否直接持有 workspace? | **YES**——Binding 保留 optional `workspace` 字段（stable effective workspaceId），是 effective workspace 的 authority（与 activeAgentId/activeSessionId 并列） |
| 2 | workspace 是路径还是 stable ID? | **stable effective workspaceId**；路径是部署形态不持久化进 Binding |
| 3 | Binding 未指定 workspace 默认规则? | `null -> resolveWorkspace(agentId)`（= Agent default workspace，现行 agent-scoped，向后兼容）；显式优先 |
| 4 | session 已存在后 Binding workspace 变? | **不静默改已有 session cwd**；workspace 变 = select/create 不同 compatible session，或结构化 reject（见 SESSION_WRITE_CONTRACT R2/R3） |
| 5 | session 运行期可否切 cwd? | **NO**——workspace 在 session creation 冻结（DSH native）；不同 workspace ⇒ 不同 session；same workspace ⇒ 可多 session |
| 6 | Feishu 群如何映射 workspace? | conversation/openId -> deterministic workspaceId（feishu-<normalized>）；同群多 session 共享同 cwd |
| 7 | App 切 Agent 如何选 workspace? | selected Agent -> 其 default workspace（resolveWorkspace(agentId)）；切 Agent 一起切 effective workspace + compatible session |
| 8 | 产品 policy 与 Router 分层? | 产品 policy 决定 Binding.workspace 取值；Router 只机械执行 AgentProcess+DSH Session(cwd=resolved)，无 if Feishu/if App |
| 9 | different workspace 可否复用同一 native session? | **否**——persisted cwd != resolved workspace => STRUCTURED_REJECT，cwd 保持原值，Binding 不半写 |
| 10 | one-Agent-one-process 保持? | **YES**（进程按 agentId；多 workspace 在多 session 内，不新建进程/Runtime/Profile） |

---

## Errors

```text
WORKSPACE_ID_INVALID        # workspaceId 格式不合法（见 §WorkspaceIdValidation）——结构化 reject
SESSION_WORKSPACE_MISMATCH  # persisted session.header.cwd != resolved effective workspace——
                            # 结构化 reject；cwd 保持原值；Binding 不半写（AC4）
BINDING_NOT_FOUND / AGENT_NOT_FOUND / SESSION_NOT_FOUND / SESSION_NOT_IN_AGENT
                            # 沿用 D-002 现有 error surface
```

---

## Scope（Allowed for Implementation）

允许（优先最小 delta，复用现有 seam；全部在 Implementation 轮完成，本轮不实现）：

- Binding store / persistBinding / switchAgent 增补 optional `workspace`（workspaceId）。
  作为 `switchAgent(..., { targetSessionId?, workspace? })` 三元组之一，Router 仍唯一 owner。
- workspace-bootstrap 复用/extract 同构 safe-id helper（sanitizeAgentId 即 workspaceId
  校验器）；按 workspaceId resolve 路径（现有 resolveWorkspace 已接受任意 id）。
  **不引入 configWorkspaceMap。**
- demo-server 按 session 接受 effective workspace cwd（不再把单一 process cwd 塞给所有
  session）——SESSION_WRITE_CONTRACT R1。
- Router turn()/deliver() 按 binding 解析 effective workspace 并按 session 传入；
  cross-workspace mismatch => 结构化 reject（R2/R3）。
- 验收断言（见 Acceptance Criteria AC1–AC11）。

**不修改** agent-definition config 结构（不加 defaultWorkspaceId）；workspace 选值留在
产品 policy -> Binding，Router 不读 App/群逻辑。

## Non-Goals and Frozen Boundaries

```text
DAILY_MAIN_SESSION_RESET   = OUT_OF_SCOPE（本轮只证明 same workspace -> 多 session allowed）
CRON_SCHEDULING_POLICY     = OUT_OF_SCOPE
SESSION_NAMING_LIFECYCLE   = OUT_OF_SCOPE

LARK_REQUIRE_MENTION       = OUT_OF_SCOPE（owner = LARK_TRANSPORT_PHASE1 / OPENCLAW_LARK...）
LARK_REACTION_TYPING       = OUT_OF_SCOPE
LARK_MARKDOWN              = OUT_OF_SCOPE
LARK_CARDS_STREAMING_MEDIA = OUT_OF_SCOPE

FORUM_CREDENTIAL           = OUT_OF_SCOPE（owner = credential provisioning）
AUTH_CREDENTIAL_PROVISIONING = OUT_OF_SCOPE

WORKSPACE_REGISTRY         = OUT_OF_SCOPE（不建设）
CONFIG_WORKSPACE_MAP       = OUT_OF_SCOPE（删除，不建设）
ARBITRARY_PATH_MAPPING     = OUT_OF_SCOPE
MULTIPLE_WORKSPACE_ROOTS   = OUT_OF_SCOPE

RUNTIME_INSTANCE           = NO（不新建）
WORKSPACE_AGENT            = NO（不新建 Workspace Agent 实体）
PROFILE_ENTITY             = NO
ROUTER_REWRITE             = NO
KERNEL_CHANGE              = NONE（DSH 本身无需改动）
AGENT_DEFINITION_SCHEMA_CHANGE = NO（不加 defaultWorkspaceId）
```

---

## Alternatives considered

- **configWorkspaceMap / workspace mapping system**：否决/删除。真实需求没有证明需要
  workspace 映射平台；V1 只需 stable workspaceId -> sanitize -> <root>/<id>。
- **Workspace Registry / DB / pre-registration**：否决。valid workspaceId + 目录缺失只是
  尚未 bootstrap，用现有 ensure 创建；只有 invalid workspaceId 才 reject。
- **Model B：Agent Definition -> 多个 Runtime Instance（registry 按 (agentId,workspace)）**：
  否决。破坏「registry 按 agentId」与 per-agent single-flight；DSH 原生 per-session cwd
  足够。
- **Model C：Binding -> Agent Profile / Workspace Instance（新产品实体）**：否决。
- **workspace 裸路径存入 Binding**：否决。stable workspaceId + 部署侧派生。
- **session 运行期切 cwd（DSH 语义变更）**：否决。DSH 无此语义；不同 workspace 走不同
  session（或 create new compatible session）。
- **跨 workspace 静默迁移已有 session cwd**：否决。会话历史/记忆/文件按原 cwd 沉淀，
  静默换根是数据丢失与语义欺诈（=> STRUCTURED_REJECT）。
- **AgentDefinition.defaultWorkspaceId**：否决（NEW_EVIDENCE：resolveWorkspace(agentId)
  已足够表达 Agent default workspace；且 agent-definition config 冻结 schema 禁 workspace）。
- **Router 内 if Feishu / if App 取 workspace**：否决（product policy ≠ Router policy 冻结）。

---

## Acceptance Criteria（覆盖真实产品）

下面 AC1–AC8 由 Implementation 至少证明（无 Kernel change、单 Agent 进程不变）：

```text
AC1 — 两个 Feishu 群，same Agent
    group A -> Workspace A（= feishu-<norm oc_A>）
    group B -> Workspace B（= feishu-<norm oc_B>）
    断言：A != B；两条 binding 的 workspaceId stable、deterministic。

AC2 — 同 Workspace 多 Session
    Group A main-session + Group A cron-session
    断言：sessionId 不同；header.cwd 相同；两者都能读取相同 AGENTS.md / MEMORY.md /
          files（从 DSH session artifact 读取 cwd）；但 trajectory/context 独立。

AC3 — App 切 Agent
    初始：App -> Secretary Agent -> secretary default workspace
    切换：Investment Agent
    最终 Binding：activeAgent = Investment；effective workspace = investment default
          workspace（resolveWorkspace(investmentAgentId)）；compatible active Session。
    Router 内：App-specific logic = NONE（Workspace 选值来自产品 policy 已算好的
          Binding.workspace，Router 只机械执行）。

AC4 — Cross-workspace Session mismatch
    Session X persisted cwd = A；Binding resolves workspace = B（A != B）
    断言：STRUCTURED_REJECT（SESSION_WORKSPACE_MISMATCH）；持久化 cwd 仍 = A（不 mutate）；
          Binding 不出现半写状态（activeSessionId 不指向不兼容会话 / activeAgent+workspace
          一致性不被破坏）。

AC5 — Restart / Resume
    Control Plane restart 后：Session A resumes cwd=A；Session B resumes cwd=B。
    cwd 来自 persisted native session header，不重新错误猜测（resume 不传 meta:{cwd}）。

AC6 — 不同 Workspace 隔离
    Workspace A 的 AGENTS.md / MEMORY / files 不泄漏到 Workspace B。

AC7 — 同 Workspace 共享（期望行为）
    同一 Workspace 下多个 Session：SHOULD share AGENTS.md / MEMORY.md / files。

AC8 — Backward compatibility
    旧 Binding 无 workspace 字段时：fallback -> 现行 resolveWorkspace(agentId)，
    保持现在的行为，无强制 migration。
```

补充断言（沿用原 proposal + 本 AMEND 收窄）：

```text
AC9 — Agent process 可保持同一（registry 仍按 agentId 一个 process）。
AC10 — 跨 binding 无 cwd 泄漏：Binding A 的 turn 不读取/写入 Binding B 的 workspace。
AC11 — workspaceId validation：
        合法 id（feishu-oc_9233.../secretary/investment）-> 正常 resolve；
        `a/b`、`..`、`.`、空格、`\`、absolute、超长 -> STRUCTURED_REJECT，且绝不被
        reshape/truncate 成别的路径。
```

```text
ROUTER_CHANGE_REQUIRED       = YES（最小：binding workspace -> 按 session 传 effective cwd；
                                cross-workspace mismatch reject）
SESSION_SEAM_CHANGE_REQUIRED = YES（demo-server per-session cwd）
WORKSPACE_BOOTSTRAP_DELTA    = MINIMAL（复用 sanitize + resolveWorkspace；ensure 按
                                workspaceId 幂等创建；不加 configWorkspaceMap）
KERNEL_CHANGE                = NONE
```

---

## Risks

- **静默 cwd 迁移**破坏会话沉淀 → 冻结 session-cwd-immutable + different-workspace-reject。
- **binding 路径持久化**导致部署耦合 → workspace 只用 stable ID，路径经部署侧派生。
- **默认规则破坏存量** → default = resolveWorkspace(agentId)，向后兼容（AC8）。
- **同一进程多 session 并发 turn** → D-004 per-process single-flight 不变（多 session
  同进程并行仍受其约束）。
- **把产品分支漏进 Router** → 冻结「产品 policy ≠ Router policy」；Router 只认
  Binding{agentId,workspaceId,sessionId} 三元组，无 if Feishu/if App（AC3 Router 断言）。

---

## Related Evidence

- `TEST_AGENT_FEISHU_PRODUCT_SEMANTICS_INVESTIGATION_V1 = PASS`:
  `docs/investigations/test-agent-feishu-product-semantics-v1.md`
- D-002: `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`（本 Spec SUPERSEDE 其 workspace
  唯一归属条款；其余实体/API 语义不受影响）
- D-004: `docs/decisions/BINDING_AND_SWITCH_V1.md`（Binding owner / 原子持久化 / switchAgent
  唯一原语 / single-flight 保持；行结构增补 workspace）
- DSH harness（evidence）：`packages/core/agent-loop/src/index.ts`、
  `packages/fs/tool-fs/src/session-cwd.ts`、`packages/workspace/workspace/src/index.ts`
- Agent Core：`packages/agent-router/src/{binding-store,index,process}.js`、
  `packages/demo-server/src/index.js`、
  `packages/workspace-bootstrap/src/{index,paths}.js`、
  `packages/agent-definition/src/{config,definition}.js`（frozen schema，禁 workspace 字段）、
  `packages/agent-memory/src/paths.js`（memory 由 workspace 决定）

---

## Final Output

```text
AGENT_CORE_BINDING_WORKSPACE_V1_SPEC_PRODUCT_MODEL_AMEND = PASS

BASE_REVIEWED_HEAD = 2892099
HEAD               = <this amendment commit>

PRODUCT_MODEL =
  Agent(谁在工作/长期身份) · Workspace(在哪工作/长期工作环境) · Session(一次对话轨迹) ·
  Binding(当前入口组合哪个 Agent+effective Workspace+active Session)。
  长期 invariant：Agent identity 不唯一决定 Workspace；Agent MAY 有 default Workspace；
  Binding 决定 effective Workspace；同 Workspace 可多 Session；一个 native Session 恰一个
  不可变 cwd。

BINDING_SCHEMA = { channelConversationId, activeAgentId, activeSessionId,
                   workspace: string|null, updatedAt }   # workspace = stable effective workspaceId
BINDING_WORKSPACE_PRESERVED = YES（不清除；App 场景证明 effective workspace 不总来自
  conversationId；Binding 保存最终选择结果）

FEISHU_WORKSPACE_POLICY =
  conversation/openId -> deterministic workspaceId（feishu-<normalized>，复用 namespace/sanitize；
  具体串不写死）；同群多 session 共享同 cwd（场景 A）。
APP_AGENT_SWITCH_WORKSPACE_POLICY =
  selected Agent -> 其 default workspace（resolveWorkspace(agentId)）；切 Agent 一起切
  effective workspace + compatible session；绝不出现 投资Agent+秘书 Workspace（场景 B）。
AGENT_DEFAULT_WORKSPACE_SEMANTICS =
  resolveWorkspace(agentId) 已足够表达 Agent default workspace（= <root>/<sanitize(agentId)>）；
  不新增 AgentDefinition.defaultWorkspaceId（agent-definition config schema 冻结禁 workspace）。

WORKSPACE_RESOLUTION_MODEL =
  resolveWorkspacePath(workspaceId) = <workspaceRoot>/<sanitizeWorkspaceId(workspaceId)>；
  null -> resolveWorkspace(agentId)。极薄，无映射平台。
WORKSPACE_ID_VALIDATION =
  复用 sanitizeAgentId（同构 safe-id helper）：单安全 component，禁 / \ . .. NUL、禁
  absolute、禁 overlong/前导尾随空格；非法 -> STRUCTURED_REJECT（不 reshape/truncate）。
  valid id + 目录缺失 = 现有 bootstrap ensure 创建；只有 invalid id 才 reject。
CONFIG_WORKSPACE_MAP = REMOVED / NOT_REQUIRED（不建设；当前代码中也不存在）

SAME_WORKSPACE_MULTI_SESSION = ALLOWED（期望行为；AC2/AC7：同 cwd 多 session 共享
  AGENTS.md/MEMORY.md/files，trajectory 独立）
SESSION_CWD_IMMUTABLE = YES（DSH native；create 写 cwd，resume 恢复持久化 header，不覆盖）
CROSS_WORKSPACE_SESSION_REUSE = FORBIDDEN（不同 workspace MUST NOT 复用同一 native session）
SESSION_WORKSPACE_MISMATCH_BEHAVIOR = STRUCTURED_REJECT（persisted cwd=A 且 resolved=B(A≠B) =>
  拒绝；cwd 保持 A；Binding 不半写；绝不静默改 cwd；绝不隐式另拨 session）
SESSION_WRITE_CONTRACT = R1(冷键创建+传 cwd) / R2(resume 恢复+校验 cwd 相等) /
                          R3(不匹配结构化 reject) —— 唯一确定契约。

ROUTER_PRODUCT_POLICY =
  产品 policy 决定 Binding.workspace 取值；Router 只机械执行
  AgentProcess(agentId)+DSH Session(sessionId, cwd=resolvedWorkspace)；
  Router 禁止 if Feishu / if App / workspace=openId / workspace=Agent default；
  ROUTER_PRODUCT_SPECIAL_CASE = NONE。

D002_DISPOSITION = SUPERSEDE（只 supersede「Agent 固定拥有唯一 workspace」条款；
  新 invariant：Agent identity 不唯一决定 Workspace / Agent MAY default / Binding 决定
  effective / Session freezes cwd；D-002 其余 DSH_HOME/credential/memory/实体/API 不受影响）
D004_PRESERVED = YES（Binding owner=Router、原子 JSON、switchAgent 唯一原语、single-flight 都保持；
  只增补 optional workspace）

ONE_AGENT_ONE_PROCESS_PRESERVED = YES
NEW_RUNTIME_ENTITY_REQUIRED = NO（无 Runtime Instance/Workspace Agent/Profile/Workspace Registry）

ACCEPTANCE_COVERAGE =
  AC1(两 Feishu 群，A!=B) · AC2(同 workspace 多 session，同 AGENTS/MEMORY 独立轨迹) ·
  AC3(App 切 Agent，effective workspace 跟随，Router 无 App 逻辑) ·
  AC4(cross-workspace mismatch => 结构化 reject，cwd 不变，无半写) ·
  AC5(restart/resume 用持久化 header cwd) · AC6(不同 workspace 隔离) ·
  AC7(同 workspace 共享，期望行为) · AC8(backward compat: 无 workspace 字段 -> 
  resolveWorkspace(agentId)) · AC9(单进程可保持) · AC10(跨 binding 无 cwd 泄漏) ·
  AC11(workspaceId validation)。

IMPLEMENTATION_SCOPE =
  binding-store/persistBinding/switchAgent 增补 optional workspace
  workspace-bootstrap 复用 sanitize + 按 workspaceId resolve + ensure 幂等创建
  demo-server per-session effective cwd（SESSION_WRITE_CONTRACT R1）
  router turn/deliver 按 binding 解析 effective workspace 并按 session 传 cwd；
   cross-workspace mismatch 结构化 reject（R2/R3）
  acceptance assertions (AC1..AC11)
OUT_OF_SCOPE =
  daily session reset · cron policy · session naming lifecycle ·
  Lark requireMention/reaction/typing/markdown/cards/streaming/media ·
  Forum credential · Auth credential provisioning ·
  Workspace registry · configWorkspaceMap · arbitrary path map · multi workspace roots ·
  Runtime Instance · Workspace Agent · Profile entity · Router rewrite ·
  AgentDefinition schema change · Kernel change

KERNEL_CHANGE = NONE

SPEC_STATUS = accepted
READY_FOR_INDEPENDENT_RE_REVIEW = YES
```
