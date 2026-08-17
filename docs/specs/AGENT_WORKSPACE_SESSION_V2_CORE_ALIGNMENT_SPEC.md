---
spec_id: AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC
status: accepted
---

# AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC — 最小实现 Spec（只出 Spec，不实现）

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结并出 Implementation Spec，不 implementation /
> 不 migration / 不 merge）** · 日期：2026-08-17
> 状态：**accepted**（accepted_reviewed_head = `60d248e`；focused_re_review = PASS，
> REQUIRED_FIXES = NONE，VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC；acceptance
> finalize 2026-08-18，mechanical only，SEMANTIC_CHANGE = NONE）
> 仓库：`mayf3/dsh-agent-core`
> 角色：V2 Core Alignment Implementation Spec Agent
>
> 本文档是 V2 产品模型（`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`，status:
> **accepted**）的**最小实现 Spec**。它只回答「这次允许改变什么」：把当前已跑通的真实股票群
> 收敛到 V2 shape，并授权实现方跑通 `REAL_PRODUCT_AGENT_CANARY_V2` 验收。它**不是** V2 的
> 全量落地，也**不**决定后补项（daily reset / 自动 Agent 出生 / p2p 最终模型 / Mobile
> switch_agent / Auth provisioning redesign）。
>
> 本文档**只修改/新增文档**：新增 `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md`。
> 若实现阶段需要，Spec 授权新增/修改 `docs/runbooks/` 下的 canary runbook（见 §11）。
> **PRODUCT_CODE_CHANGE = NONE / STATE_CHANGE = NONE / MERGE = NONE / KERNEL_CHANGE = NONE**
> （本轮）。
>
> **AMENDMENT（2026-08-17，闭合独立 Review 的 REQUIRED_FIXES）**：
> BASE_REVIEWED_HEAD = `ed514ff`（VERDICT = FIX_REQUIRED）。本修订只闭合 Reviewer 的
> 3 个 REQUIRED_FIXES，其余内容不动；仍是 SPEC ONLY（不 implementation / 不 production
> state change / 不 merge），status 维持 `proposed` 待 focused re-review：
>
> 1. **Fix 1（§4.5）**：unknown Feishu conversation 必须 **fail closed** —— 冻结
>    `FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY`（现有 pre-bound conversation 放行；
>    unknown/unbound conversation 结构化拒绝，绝不创建 default Agent Binding）。
> 2. **Fix 2（§7.2）**：mixed MEMORY 的处置是一次真实的 production state change ——
>    `STOCK_GROUP_STATE_CHANGE = ONE_TIME_PRODUCTION_STATE_CHANGE`（仅
>    `agt_stock_agent/MEMORY.md` 整文件 archive；冻结最小步骤与 rollback）。
> 3. **Fix 3（§5.2–§5.5）**：system-prompt injection **不再断言**能拿 session —— 删除
>    不可实现的「injection 必须直接从 session.header.cwd 获取 workspace」；冻结
>    KERNEL_CHANGE = NONE 下的最小 Memory resolver（session-aware 调用点用
>    `session.header.cwd`；同步 system-prompt injection 用 `Agent.primaryWorkspace`），
>    并冻结 `V2_NORMAL_PATH_REQUIRES_PRIMARY_WORKSPACE = YES`（旧非 primary
>    `Binding.workspace` = TRANSITIONAL_COMPATIBILITY_STATE，不得进入 V2 normal
>    production path）。

---

## 0. 一句话目标（Current Truth，standalone 起点）

```text
Feishu group
→ dedicated agt_stock_agent
→ Agent primary Workspace (= resolveWorkspace(agentId))
→ canonical main
→ Workspace-local Memory
```

即把现有真实股票群收敛到 V2 的固定形态，并能够执行：

```text
REAL_PRODUCT_AGENT_CANARY_V2   # 一组真实产品验收（见 §11）
```

本轮**不**实现 V2 全量，只实现让上述链跑通的最小 delta。

---

## 1. DEVELOPMENT_PREFLIGHT（于改动第一行代码前输出；本文档作为 Spec 交付物内嵌）

```text
DEVELOPMENT_PREFLIGHT
Problem =
  把当前已跑通的真实股票群收敛到 V2 shape：
  Feishu group → agt_stock_agent → Agent primary Workspace（resolveWorkspace(agentId)）
  → canonical main → Workspace-local Memory；并跑通 REAL_PRODUCT_AGENT_CANARY_V2。
Governing Spec = 本文档 AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC（proposed，待 review 后 accepted）
  （authority decision: docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md = accepted）
  + docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md（accepted，机制级 PRESERVE）
Spec status = proposed（本轮只出 Implementation Spec，不实现；accepted 后才具备实现许可）
Relevant investigations =
  docs/investigations/test-agent-feishu-product-semantics-v1.md（TRANSITIONAL_COMPATIBILITY_EVIDENCE）
  AGENT_WORKSPACE_SESSION_MODEL_V2_IMPLEMENTATION_IMPACT_AUDIT（= PASS）
Relevant decisions =
  AGENT_WORKSPACE_SESSION_MODEL_V2.md（accepted；ONE_AGENT_ONE_WORKSPACE / FEISHU_BINDING=FIXED /
    MAIN_LOGICAL_SLOT / MEMORY 属 Agent Workspace / §25 留给 Implementation Specs）
  D-004 BINDING_AND_SWITCH_V1.md（PARTIALLY_SUPERSEDE；机制保留）
  D-003 MEMORY_V1.md（PARTIALLY_SUPERSEDE；产品 invariant 保留）
Previously rejected alternatives =
  FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd（proposed，DO_NOT_ACCEPT / 不 merge；
    「same Agent → per-conversation workspace」建模前提已被 V2 替代）——本 Spec 不复用其建模前提；
    保留其已正确冻结的两个产品判断（HISTORICAL_MIXED_MEMORY_MIGRATION = NONE /
    OLD_MIXED_MEMORY = ARCHIVE_ONLY）为 MIXED_MEMORY_DISPOSITION 依据。
Frozen boundaries =
  PRINCIPAL：不删 Binding.workspace / 不建 Workspace Registry / 不加 mapping layer /
  不重写 Router / 不改 Kernel / 不做 daily reset / 不做 Agent birth / 不做 p2p final model /
  不做 Mobile switch_agent / 不做 auth provisioning redesign。
  Router 保持机械 override 支持，不加 normal/compatibility 分支。
Implementation scope（本轮只出 Spec，accepted 后）=
  feishu-connector normal ingress 停止注入 conversation workspace；
  feishu-connector pre-forward PREBOUND_ONLY gate + production-runtime compose 接线
  （§4.5，仅用现有 agentRouter.getBinding / channelConversationId）；
  agent-memory 按 resolveMemoryWorkspace 分路解析（§5.2：session-aware 调用点 =
  session.header.cwd；同步 system-prompt injection = Agent.primaryWorkspace）；
  tests；canary/runbook if needed。
Out-of-scope = daily reset / Agent birth / p2p final model / Mobile switch_agent /
  auth provisioning redesign / 任何 route/kernel/definition schema 扩大。
New evidence = 见 §3 Evidence（source-verified 代码点位 + IMPLEMENTATION_IMPACT_AUDIT = PASS）。
Need new/amended Spec = YES（本文档即替代旧 FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 的
  REPLACE_WITH_SMALLER_SPEC 方向，V2 §23/§24.5；本轮先出 proposed Spec 供独立 review）。
```

---

## 2. 为什么是 Implementation Spec，而不是 Decision / 全量实现

1. V2 决策文档（accepted）只冻结**长期产品模型**（§2/§5/§8/§13 的 ONE_AGENT_ONE_WORKSPACE、
   FEISHU_BINDING = FIXED、MAIN_LOGICAL_SLOT、MEMORY 属 Agent Workspace），并明确把**机制细节 /
   迁移 / 实现授权**留给后续 Implementation Specs（V2 §25「本轮明确不解决…留给后续 Implementation
   Specs」）。
2. 本 Spec 从**当前 origin/main 代码**正在表现的旧模型状态出发，逐步证明哪些是
   「已符合 V2，保持不动」、哪些是「需要最小冻结改动」、哪些是「明确不建/不动」。
3. 禁止「顺手」扩大改动面：不删 Binding.workspace、不建 Workspace Registry、不引入 mapping
   layer、不重写 Router、不改 Kernel、不做 daily reset。实现 delta 只允许落在 Spec 约定的
   极小区面（§9 Scope）。

---

## 3. Evidence / 依据

```text
AUTHORITY_DECISION = docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (accepted, origin/main = 67404bc)
IMPLEMENTATION_IMPACT_AUDIT = AGENT_WORKSPACE_SESSION_MODEL_V2_IMPLEMENTATION_IMPACT_AUDIT
                            = PASS（本文档复述其结论；不复制全部 audit 文本）
BASE_CODE = origin/main（指定 authority 修订）
```

本文档内所有代码点位均为 **source-verified**（对照 origin/main 的 `packages/*/src`）。

---

## 4. Primary Workspace（已确认：无需任何新配置 / 新实体）

```text
resolveWorkspace(agentId)
  = <workspaceRoot>/<sanitize(agentId)>
  = ~/.agent-core/workspaces/<agentId>（生产布局下 workspaceRoot = ~/.agent-core/workspaces）
  （packages/workspace-bootstrap/src/paths.js：resolveWorkspace）

已可直接作为：
  Agent.primaryWorkspace
```

结论（冻结）：

```text
NEW_WORKSPACE_REGISTRY     = NO
NEW_MAPPING_LAYER          = NO
WORKSPACE_BOOTSTRAP_CHANGE = NONE
AGENT_DEFINITION_CHANGE    = NONE
```

- **不新增** `primaryWorkspace` 配置字段（agent-definition config schema 冻结，禁 workspace 字段；
  `resolveWorkspace(agentId)` 已表达 Agent default / primary workspace）。
- 实现方**不得**为此建 Workspace Registry / 映射表 / 新运行时实体。

---

## 5. Feishu 正常路径停止选择 Workspace

### 4.1 现状（source-verified）

`packages/feishu-connector/src/core.js` 在 `normalizeIngressEvent()` 里直接注入：

```text
workspace: conversationWorkspaceId(conv.conversationId)   # feishu-<normalized conversation id>
session:   conversationMainSessionId(conv.conversationId) # main-<normalized conversation id>
```

`conversationWorkspaceId` / `conversationMainSessionId`（core.js:402-428）就是旧产品模型
（same Agent → per-conversation workspace）的载体。`packages/feishu-connector/src/index.js`
把它随 ingress 暴露给 Router。

### 4.2 需要的冻结改动

```text
FEISHU_NORMAL_INGRESS_MUST_NOT_INJECT/SELECT_CONVERSATION_WORKSPACE = YES

Feishu normal ingress event 不得再注入 / 选择 conversation workspace。
Feishu Binding 不应再携带 conversation-derived workspace。

Existing/new normal Feishu Binding 应使用：
  workspace = null
（或等价的「不提供 workspace override」语义 → 落回 Default Workspace Rule：
   resolveWorkspace(agentId) = Agent primary workspace）
```

即正常路径：

```text
conversation → Binding selects Agent → Agent primary Workspace = resolveWorkspace(agentId)
（不再是 conversation → choose Workspace）
```

### 4.3 Router 保持机械，不加 normal/compatibility 分支

```text
ROUTER_GENERIC_WORKSPACE_OVERRIDE_SUPPORT = KEEP
ROUTER_FEISHU_SPECIAL_CASE                = NONE
```

- **Router 不判断** normal / compatibility 两种路径。它继续机械支持旧
  `Binding.workspace != null`（generic mechanism，仅作为 transitional compatibility
  mechanism 保留）。
- **不删除** `Binding.workspace` 字段；**不重写** Router。
- 唯一目的是让 **Feishu normal 入口**不再把 conversation workspace 喂给 Binding ——
  改动落在 feishu-connector（产品入口层），不落在 Router。

### 4.4 具体改动面（实现时）

- Feishu normal ingress：**停止**注入 `workspace`；`conversationMainSessionId` 由
  V2 canonical main（native `main` session）取代（见 §7）。
- `conversationWorkspaceId` / `conversationMainSessionId` helper 的**未来去留**不在本轮
  决定（保持 transitional，见 §8 p2p / §22 精神）——本轮只让 normal 路径不再调用它们来
  选择 workspace。

### 4.5 V2 过渡期 ingress 冻结：unknown conversation 必须 fail closed（AMENDMENT Fix 1）

**问题（source-verified，origin/main）**：unknown Feishu conversation 今天的行为是
Router `resolveChannelConversation()` 发现 `store.get(ccId) === undefined` 后调
`resolveDefaultAgent()`（agent-definition `defaultAgentId` → `agt_stock_agent`）并**自动
创建 default Binding**（`packages/agent-router/src/index.js`：resolveChannelConversation /
resolveDefaultAgent）。当前这个行为被 conversation workspace/session 注入**掩盖**；一旦
按 §4.2 删除注入，unknown conversation A / B / C 会全部隐式落到
`agt_stock_agent / primary Workspace / main` —— 直接违反 D-006
（`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`，不重新讨论）。

**冻结（V2 过渡期）**：

```text
FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY

existing known/pre-bound conversation（binding store 已有该
  feishu:<conversationId> 的 Binding row）
  → proceed（正常 V2 路径）

unknown/unbound conversation（binding store 无该 row）
  → FAIL CLOSED
  → structured rejection（日志 + 固定的「未绑定」回执）
  → MUST NOT create Binding to default Agent
  → MUST NOT enter default Agent / default Agent main

AUTOMATIC_AGENT_BIRTH = OUT_OF_SCOPE
  （fail closed 与 automatic birth 相反；unknown conversation 的显式绑定/
  provisioning 属更晚的产品决策，本 Spec 不发明任何 provisioning 系统）
```

**最小实现 seam（source-verified，不新增 generic Router API）**：

```text
UNKNOWN_CONVERSATION_IMPLEMENTATION_SEAM =
  feishu-connector 产品入口层的 pre-forward gate
  + 控制面 composition 层（packages/production-runtime/src/compose.js）接线，
    仅使用 Router service 已暴露的 generic 只读 API：
      agentRouter.channelConversationId('feishu', conversationId)   # id 格式唯一 owner
      agentRouter.getBinding(<ccId>)                                # 返回 Binding row 或 undefined
```

- **判定 API 已存在，Router 零改动**：`agentRouter` service 已暴露 D-002 读 API
  `getBinding`（返回当前 Binding 或 `undefined`，即 404 BINDING_NOT_FOUND 的等价物）与
  `channelConversationId`（`packages/agent-router/src/index.js` service surface）。因此
  **无需**为「connector 判断已有 Binding」新增任何 Router seam。
- **gate 落点**：feishu-connector 在 `classifyIngress` 判定 forward 之后、调用
  `cfg.onEvent(ingress)`（即 Router `onIngress`）**之前**增加一个可编程注入的 pre-forward
  predicate（注入风格与 `onEvent` 相同；connector 保持 pure channel，`inject = []`，
  不直接依赖 Router）。predicate 返回 unbound → **不调用 onEvent**（因此
  `resolveChannelConversation` 对该 conversation 根本不会执行 → default Binding 不会被
  创建），并由 connector 自己的 reply 路径回固定「未绑定」结构化回执。
- **接线点**：production-runtime `compose.js` 同时持有 `feishu` handle 与 `router`
  service（该层已有 wrap router service 方法的先例），把 predicate 接到
  `router.getBinding(router.channelConversationId('feishu', …))` 上。
- **TOCTOU 安全方向**：gate 与 resolve 读同一份 in-process durable binding store
  （同步读）；Binding 只会被创建不会被删除（store 无 delete API），gate 误差方向只会
  「少放行」，绝不会「多放行」——fail-closed 方向成立。
- **Router 保持 generic**：`resolveChannelConversation` 的 first-contact default-Agent
  创建机制原样保留（mobile / scheduler 等其它入口仍可用）；`ROUTER_PRODUCT_SPECIAL_CASE
  = NONE`，不允许任何 `Router if Feishu …` 分支。

---

## 6. Memory（冻结最小改动）

### 5.1 现状（source-verified，origin/main）

`packages/agent-memory/src/index.js` 在 **apply (mount), 进程级** 解析一次：

```text
const agentId  = cfg.agentId ?? $DSH_AGENT_ID ?? agentIdFromCwd(process.cwd())
const workspace  = resolveAgentWorkspace(agentId, cfg.workspaceRoot)
const memoryFile = resolveMemoryFile(workspace)   # <workspace>/MEMORY.md
```

所有 memory 操作（load / update / remove / search / list / consolidateNow /
readDailyNotes / prompt-injection / daily-note fallback）都复用这个进程级 `workspace` /
`memoryFile`。`packages/agent-memory/src/memory.js` 的所有函数都以
`workspace` / `memoryFile` 为参数（纯函数），**不**自行读 session。

### 5.2 需要的冻结改动：KERNEL_CHANGE = NONE 下的最小 Memory resolver（AMENDMENT Fix 3）

> **AMENDMENT 修正**：原 §5.2 把「system prompt [memory] injection」列入
> session.header.cwd 覆盖面，等于断言 injection 必须直接从 session.header.cwd 获取
> workspace。该断言**不可实现**（见 §5.4 source-verified 事实），予以删除，替换为本节
> 的 resolver 冻结。

```text
MEMORY_WORKSPACE_RESOLUTION = resolveMemoryWorkspace(operationContext)

resolveMemoryWorkspace(operationContext):
  if current Session is available
    → session.header.cwd
  else
    → Agent.primaryWorkspace
      = resolveWorkspace(agentId)

SESSION_AWARE_MEMORY_PATHS（当前 Session 可达的调用点）=
  tools（memory_save / memory_search / memory_list / memory_update / memory_delete）
  save/write · search · consolidation（turn/end 与显式 memory_consolidate）· daily notes
  → workspace = session.header.cwd

SYSTEM_PROMPT_MEMORY_PATH（同步 system-prompt [memory] injection）=
  → workspace = Agent.primaryWorkspace = resolveWorkspace(agentId)
```

- V2 长期 invariant 是 `ONE_AGENT_ONE_WORKSPACE`，因此 V2 normal path 下
  `normal Session.header.cwd == Agent.primaryWorkspace` —— **两条取法必须得到同一个
  Workspace**（canary 显式验收 `MEMORY_WORKSPACE_EQUALITY`，见 §11）。
- 这**不是**两套 Memory ownership：

```text
MEMORY_OWNERSHIP = WORKSPACE_LOCAL（不变，唯一）
```

  只是**不同调用点拿到 Workspace authority 的方式不同**：session-aware 调用点有当前
  Session，就以其冻结的 `header.cwd` 为准；同步 system-prompt 注入点没有当前 Session，
  就以 `Agent.primaryWorkspace`（`resolveWorkspace(agentId)`）为准。
- 同 Workspace 的 `main` / `cron` / `agent-task` / `background` session 因
  `header.cwd` 相同 → 自然共享同一份 MEMORY.md（V2 §7/§13 的
  SAME Agent / SAME Workspace 跨 Session 共享）。
- Memory **不认识** Feishu / conversationId / group/p2p / Binding / Router ——
  它只看 resolver 给出的 workspace 落点。
- 现有 path helpers（`resolveMemoryFile(workspace)` / `resolveMemoryDir(workspace)` /
  `resolveDailyNoteFile(workspace)`）已经是 `workspace → MEMORY.md` 形态，**保持不动**
  （无意义重构禁止）。

### 5.3 Memory CALL_SITES（实现方要改的最小面）

memory 当前把 workspace 当**进程级常量**在 apply 时捕获一次；V2 改为**每个操作**按
§5.2 的 `resolveMemoryWorkspace` 解析。具体接线（实现裁决，以 source-verified 现状为据）：

```text
- agent-memory apply 保留 agentId / primaryWorkspace（= resolveWorkspace(agentId)）
  作为 session 不可达时的 resolver 落点；
- tools 的 execute(args, exec)：workspace = exec.agent.session.header.cwd
  （session-aware）；
- service 方法（load/update/remove/search/list/consolidate/readDailyNotes）在
  session-aware 调用点从当前 session.header.cwd 派生 memoryFile；
- consolidation（turn/end）从触发它的 session.header.cwd 取 workspace；
- 同步 systemPrompt.context('memory') 的 text() 项用 Agent.primaryWorkspace
  （进程级，见 §5.4）；
- 保持 memory.js 纯函数不动。
```

### 5.4 为什么 system-prompt injection 拿不到 session（source-verified）

`packages/agent-memory/src/index.js` 的 automatic injection 走
`systemPrompt.context({ name:'memory', …, text: () => renderContextText(loadEntriesSync(memoryFile), …) })`
—— text provider 是**同步、无参数**的纯函数，组装它的上下文是 agent 级（scope=agent）
的 prompt assembly，**没有当前 Session**。session-aware 的调用点在别处：tools 的
`exec.agent.session`、turn/end 事件的 session 回调参数，且 session 的 cwd 形态就是
`session.header.cwd`（`packages/demo-server/src/session-seam.js`：`assertSessionCwd` 读
`handle?.agent?.session?.header?.cwd`；R1 创建时冻结、R2 resume 校验、R3 mismatch 拒绝）。

结论：在 KERNEL_CHANGE = NONE 的约束下（不重设计 prompt assembly / 不给 text provider
引入 Session 参数），**同步 system-prompt injection 只能取 `Agent.primaryWorkspace`**；
这正好与 V2 invariant（normal `session.header.cwd == Agent.primaryWorkspace`）一致。

### 5.5 Compatibility safety：非 primary Binding.workspace 不得进入 V2 normal path

Review 指出的真实风险：旧 p2p 状态（`agt_stock_agent` + `Binding.workspace =
feishu-oc_…`）若仍可进入生产，会出现 tools/consolidation 走 p2p cwd、而 prompt
injection 走 Agent primary Workspace 的**不一致**。冻结：

```text
V2_NORMAL_PATH_REQUIRES_PRIMARY_WORKSPACE = YES

V2 正常生产入口必须满足：
  effective workspace == resolveWorkspace(activeAgentId)
```

- 旧磁盘状态 `Binding.workspace != null && Binding.workspace != Agent.primaryWorkspace`
  分类为：

```text
NON_PRIMARY_WORKSPACE_COMPATIBILITY_STATE = TRANSITIONAL_COMPATIBILITY_STATE
  保留在磁盘 / 留作证据；
  MUST NOT 进入本轮启用的 V2 normal production path。
```

- **不删除** `Binding.workspace` 字段（Router 机械 override 机制保留，§4.3）；
  **不删除**旧 p2p workspace/session；**不决定** p2p 最终 Agent（§7.3）。
- 实现侧的最小含义：V2 启用的 Feishu normal 入口不再产生任何非 primary 的
  `Binding.workspace`（§4.2），既有非 primary row 不被本路径使用/重写；处置（preserve /
  disable / archive）仍按 §7.3 的安全显式可回滚原则，不阻塞 group cutover。

---

## 7. main（已确认：native sessionId = main，可落地 D-006 canonical main）

```text
current native sessionId = main   # scheduler / router deliver('main') / demo-server
```

已可直接落地 V2 的 canonical main（V2 §8 MAIN_LOGICAL_SLOT）。

```text
NEW_MAIN_MAPPING_LAYER    = NO
SESSION_SEAM_REDESIGN     = NO
```

- Router `deliver(sessionMode:'main' → 'main')`、Feishu Binding `activeSessionId = main`
  都是现状，保持。
- 本轮**不实现** daily reset（V2 §9 MAIN_RESET_MODEL = RESETTABLE 属更晚 Spec）。

---

## 8. 当前股票群 state cutover（一次性冻结处理）

### 7.1 真实 group（保持，不迁移）

```text
feishu:oc_92332c45c1cac2ef89857abfee8ed762   （「大侠 - 小虾米」真实群）
  → agt_stock_agent
  → main
  → workspace = null
```

该 shape 已经是 V2 normal shape（conversation → Agent → primary workspace via
resolveWorkspace(agentId)）。**不要迁它。**

### 7.2 被污染的 MEMORY.md（一次性 production state change + archive）

> **AMENDMENT 修正（Fix 2）**：archive mixed MEMORY.md 是一次**真实的 production
> state change**，不是「无 state change」。原 Final Output 的
> `STOCK_GROUP_STATE_CHANGE = NONE` 予以纠正。

```text
~/.agent-core/workspaces/agt_stock_agent/MEMORY.md
  已被旧 multi-workspace Canary 污染
  （含 CANARY-R2-BOOT-OK / consolidation:session:agent:agt\\\\_stock\\\\_agent:cron:... 等
    canary-test 痕迹；agent-memory 之前进程级按 agentId 解析写进来）
  （只读核实 @2026-08-17：文件存在，135 行，sha256 =
   8c4380a5a7fce0b2a993cf300f734584aa8755776bcf87988a75c6888994ab34）
```

冻结一次性处理：

```text
STOCK_GROUP_STATE_CHANGE = ONE_TIME_PRODUCTION_STATE_CHANGE
WORKSPACE_MIGRATION      = NONE
BINDING_MIGRATION        = NONE

只处理一个对象：~/.agent-core/workspaces/agt_stock_agent/MEMORY.md
MIXED_MEMORY_DISPOSITION = ARCHIVE_WHOLE_FILE_ONLY
  old mixed MEMORY.md
    → backup/archive 整文件（不动内容，不 provenance split）
    → no provenance split
    → no copy into another Workspace
    → active primary Workspace 以 clean/lazy MEMORY.md 开始
```

冻结最小步骤（实现轮执行，顺序不可换）：

```text
MIXED_MEMORY_PROCEDURE =
  1. stop/quiesce writes
     （停/quiesce 会写该 MEMORY.md 的路径：agt_stock_agent 的 DSH process /
       consolidation；确保没有 in-flight write）
  2. checksum + backup/archive whole MEMORY.md
     （对源文件计算 checksum 后整文件拷贝到 archive 位置，保留原始内容字节不变）
  3. verify archive matches source
     （对 archive 副本重算 checksum，与步骤 2 的源 checksum 相等才允许继续）
  4. remove/rename active MEMORY.md out of active path
     （把 active 路径上的 MEMORY.md 移出 active 位置，不与 archive 混放）
  5. active Memory starts clean/lazy
     （不预创建填充内容的 MEMORY.md；由正常使用 lazy 产生）
  6. keep AGENTS.md and all ordinary Workspace files untouched
```

冻结 rollback（写死，不可临场发挥）：

```text
MIXED_MEMORY_ROLLBACK =
  quiesce（同上，停 writes）
  → remove newly-created active MEMORY.md if any
  → restore archived original MEMORY.md atomically
    （tmp + rename 覆盖回 active 路径）
  → checksum verify（恢复后 active 文件 checksum == archive/original checksum）
  → resume（恢复 writes / process）
```

- **普通** Workspace 文件与 AGENTS.md（`~/.agent-core/workspaces/agt_stock_agent/AGENTS.md`
  等既有长期资料）：**KEEP**。不要因为 MEMORY 污染把整个股票 Agent Workspace 推倒重建。

### 7.3 p2p 不要变成本轮 blocker

当前 p2p（transitional compatibility state）：

```text
feishu:oc_9dd74b9ed02ce216951260a381eb502d
  → agt_stock_agent
  → explicit feishu-oc_... Workspace
```

```text
P2P_FINAL_MODEL_IMPLEMENTATION = OUT_OF_SCOPE
  本 Spec 不设计 p2p 的最终 Agent，也不创建新 Agent。
```

但实现后**不能**让新的 Feishu normal binding 再自动产生：
`same Agent + conversation-specific Workspace`。对现有这条 p2p state，只要求：

```text
P2P_TRANSITIONAL_STATE = preserve / disable / archive strategy
  安全、显式、可回滚，不删除历史证据。
```

任何「不使用 p2p 就可以完成股票群 V2 Canary」的实现，**不得**阻塞本轮 group cutover
（即：p2p state 的处置与 group V2 Canary 解耦，p2p 处置不成为 group 验收的前置）。

---

## 9. Scope（Allowed for Implementation）

预期实际代码影响只允许优先落在：

```text
packages/feishu-connector/
packages/agent-memory/
tests
canary/runbook if needed
```

Router 只有在**证明 generic mechanism 有 bug** 时才允许修改（见 §13 巡检）。本轮明确禁止：

```text
delete Binding.workspace          → NO
add Workspace Registry            → NO
add mapping layer                 → NO
rewrite Router                    → NO
change Kernel                     → NO
implement daily reset             → NO
implement automatic Agent birth   → NO
design p2p final model            → NO
Mobile switch_agent               → NO
Auth provisioning redesign        → NO
```

---

## 10. Non-Goals and Frozen Boundaries

```text
DAILY_MAIN_RESET               = OUT_OF_SCOPE
AUTOMATIC_AGENT_BIRTH          = OUT_OF_SCOPE
P2P_FINAL_MODEL                = OUT_OF_SCOPE
MOBILE_SWITCH_AGENT            = OUT_OF_SCOPE
AUTH_PROVISIONING_REDESIGN     = OUT_OF_SCOPE
CANONICAL_MAIN_DAILY_RESET     = OUT_OF_SCOPE（本轮不实现 reset scheduler）
NEW_WORKSPACE_REGISTRY         = NO
NEW_MAPPING_LAYER              = NO
ROUTER_REWRITE                 = NO
KERNEL_CHANGE                  = NONE
AGENT_DEFINITION_SCHEMA_CHANGE = NO（不加 primaryWorkspace；resolveWorkspace(agentId) 已表达）
```

---

## 11. Acceptance（Canary）— REAL_PRODUCT_AGENT_CANARY_V2

Implementation 完成后必须跑 `REAL_PRODUCT_AGENT_CANARY_V2`。验收：

```text
A. 真人 Feishu group ingress
B. Binding → agt_stock_agent
C. effective Workspace = resolveWorkspace(agt_stock_agent)
   (~/.agent-core/workspaces/agt_stock_agent)
D. main.header.cwd == primary Workspace
E. Memory read/write/injection == primary Workspace/MEMORY.md
F. 第二轮真人消息 resume main
G. runtime restart 后 resume main
H. 一个 fresh non-main Session
   → same cwd（= primary Workspace）
   → separate trajectory
I. one Agent = one DSH process
J. OpenClaw fallback = NO
```

AMENDMENT 补清（REAL_PRODUCT_AGENT_CANARY_V2 显式增加，与 A–J 并列验收）：

```text
REAL_MODEL_TURN                     = PASS   （真实模型 turn，非 stub）
REAL_FEISHU_DELIVERY                = PASS   （真实 Feishu 投递回执）
UNKNOWN_CONVERSATION_FAIL_CLOSED    = PASS   （§4.5：unknown/unbound conversation
                                             被结构化拒绝；binding store 无新增
                                             default Binding row；未进入
                                             agt_stock_agent/main）
EFFECTIVE_WORKSPACE_IS_PRIMARY      = PASS   （active V2 route 的 effective
                                             workspace == resolveWorkspace(
                                             activeAgentId)；无任何 non-primary
                                             Binding.workspace override 被使用）
MEMORY_INJECTION_WORKSPACE          = Agent.primaryWorkspace
                                            （同步 system-prompt [memory] 注入的
                                              解析落点，§5.4）
MEMORY_TOOL_WORKSPACE               = session.header.cwd
                                            （tools/save/search/consolidation/
                                              daily notes 的解析落点，§5.2）
MEMORY_WORKSPACE_EQUALITY           = PASS   （上述两条路径在 V2 normal path 得到
                                             同一个 Workspace / 同一份 MEMORY.md）
```

同时必须证明（不变量回归）：

```text
no active V2 route uses non-primary Binding.workspace override
resolveWorkspace(agentId) = primary Workspace
Router remains generic（无 Feishu special-case）
Binding.workspace field stays（不删）
native main stays（无 mapping layer / 无 daily reset）
no Workspace Registry
no mapping layer
no daily reset
no automatic Agent birth
no p2p split
KERNEL_CHANGE = NONE
```

本轮**明确不验**：

```text
daily main reset
automatic Agent birth
p2p final model
Mobile switch_agent
Auth provisioning redesign
```

### Canary runbook

- 若需要，Spec 授权实现方新增/修改 `docs/runbooks/` 下的 canary runbook（如
  `feishu-stock-canary-v2.md`），复述上述 A–J 验收与 rollback 步骤。
- 本轮（Spec）本身不写 runbook 的完整执行 body；只冻结验收项。

---

## 12. FILES_TO_CHANGE（实现轮的预期）

```text
FILES_TO_CHANGE =
  packages/feishu-connector/src/core.js        # normal ingress 停止注入 conversation workspace
  packages/feishu-connector/src/index.js       # pre-forward PREBOUND_ONLY gate（§4.5）
                                              # + 去导管/注释对齐
  packages/production-runtime/src/compose.js   # gate 接线到现有 agentRouter.getBinding /
                                              # channelConversationId（§4.5，Router 零改动）
  packages/agent-memory/src/index.js           # resolveMemoryWorkspace 分路解析（§5.2/§5.3）
  tests（feishu-connector / agent-memory / agent-router 受影响断言）
  docs/runbooks/*（canary v2 runbook，如需要）
  + 实现轮一次性执行 §7.2 MIXED_MEMORY_PROCEDURE（production state change，
    冻结步骤 + 冻结 rollback）
```

Router / workspace-bootstrap / demo-server / binding-store 仅在 §13 巡检证明需要时才允许
触及，且严格最小。

---

## 13. Router 巡检条件

```text
ROUTER_CHANGE_REQUIRED =
  仅当「generic mechanism（Binding.workspace != null 机械 override）被证明有 bug」才允许
  修改 Router；
  默认 ROUTER_CHANGE_REQUIRED = NO。
```

任何 Router 修改都必须在实现时给出已证伪/证实的机制 bug 证据；无证据不得改。

---

## Final Output

```text
AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC_AMENDMENT = PASS

BASE_REVIEWED_HEAD = ed514ff
HEAD = 本 amendment commit（hash 见 commit message / git log）

FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY
UNKNOWN_CONVERSATION_POLICY =
  existing known/pre-bound conversation → proceed；
  unknown/unbound conversation → FAIL CLOSED（structured rejection；
  MUST NOT create Binding to default Agent；MUST NOT enter default Agent/main；
  AUTOMATIC_AGENT_BIRTH = OUT_OF_SCOPE）
UNKNOWN_CONVERSATION_IMPLEMENTATION_SEAM =
  feishu-connector 产品入口层 pre-forward gate（classify 后、onEvent 前，
  可编程注入 predicate，connector 保持 pure channel）
  + production-runtime compose.js 接线，仅用 Router service 现有 generic 只读 API：
  agentRouter.getBinding(agentRouter.channelConversationId('feishu', <conversationId>))
  → Router 零改动、零 Feishu special-case

V2_NORMAL_PATH_REQUIRES_PRIMARY_WORKSPACE = YES
  （V2 正常生产入口必须满足 effective workspace == resolveWorkspace(activeAgentId)）
NON_PRIMARY_WORKSPACE_COMPATIBILITY_STATE = TRANSITIONAL_COMPATIBILITY_STATE
  （旧 Binding.workspace != primary 的 row 保留在磁盘/留作证据，
    不得进入本轮启用的 V2 normal production path；不删除 Binding.workspace 字段；
    不删除旧 p2p workspace/session；不决定 p2p 最终 Agent）

MEMORY_WORKSPACE_RESOLUTION = resolveMemoryWorkspace(operationContext)
  （current Session available → session.header.cwd；
    else → Agent.primaryWorkspace = resolveWorkspace(agentId)；
    MEMORY_OWNERSHIP = WORKSPACE_LOCAL 不变，唯一 ownership）
SESSION_AWARE_MEMORY_PATHS = tools / save / search / consolidation / daily notes
  → session.header.cwd
SYSTEM_PROMPT_MEMORY_PATH = Agent.primaryWorkspace
  （同步 systemPrompt.context text provider 无当前 Session，source-verified；
    不再断言 injection 直接从 session.header.cwd 获取 workspace）
KERNEL_CHANGE = NONE

STOCK_GROUP_STATE_CHANGE = ONE_TIME_PRODUCTION_STATE_CHANGE
  （WORKSPACE_MIGRATION = NONE / BINDING_MIGRATION = NONE；group shape 已是 V2，
    不迁移；唯一 state change = agt_stock_agent/MEMORY.md 整文件处置）
MIXED_MEMORY_BACKUP = CHECKSUM_PLUS_WHOLE_FILE_ARCHIVE
  （stop/quiesce writes → checksum + 整文件 backup/archive → verify archive ==
    source → remove/rename active MEMORY.md out of active path → active Memory
    clean/lazy 开始；AGENTS.md 与全部普通 Workspace 文件 untouched；no provenance
    split）
MIXED_MEMORY_VERIFICATION = CHECKSUM_ARCHIVE_EQUALS_SOURCE（移出 active 路径前）;
  ROLLBACK 后 CHECKSUM_RESTORED_EQUALS_ORIGINAL
MIXED_MEMORY_ROLLBACK = FROZEN
  （quiesce → remove newly-created active MEMORY.md if any → restore archived
    original atomically（tmp+rename） → checksum verify → resume）

ROUTER_PRODUCT_SPECIAL_CASE = NONE

REAL_PRODUCT_AGENT_CANARY_V2_COVERAGE =
  A 真人 ingress / B →agt_stock_agent / C effective Workspace=
  resolveWorkspace(agt_stock_agent) / D main.header.cwd==primary Workspace /
  E Memory==primary Workspace/MEMORY.md / F resume main / G restart 后 resume /
  H fresh non-main 同 cwd 独立 trajectory / I one-Agent-one-process /
  J OpenClaw fallback=NO
  + AMENDMENT 补清：REAL_MODEL_TURN=PASS / REAL_FEISHU_DELIVERY=PASS /
  UNKNOWN_CONVERSATION_FAIL_CLOSED=PASS / EFFECTIVE_WORKSPACE_IS_PRIMARY=PASS /
  MEMORY_INJECTION_WORKSPACE=Agent.primaryWorkspace /
  MEMORY_TOOL_WORKSPACE=session.header.cwd / MEMORY_WORKSPACE_EQUALITY=PASS
  + 不变量回归：no non-primary Binding.workspace override on active V2 route /
  resolveWorkspace(agentId)=primary Workspace / Router remains generic /
  Binding.workspace field stays / native main stays / no Workspace Registry /
  no mapping layer / no daily reset / no automatic Agent birth / no p2p split /
  KERNEL_CHANGE=NONE
  （不验 daily reset / auto birth / p2p final model / Mobile switch_agent /
    auth redesign）

PRIMARY_WORKSPACE_CHANGE        = NONE
  （resolveWorkspace(agentId) 已可直接作为 Agent.primaryWorkspace；
    NEW_WORKSPACE_REGISTRY = NO / NEW_MAPPING_LAYER = NO /
    WORKSPACE_BOOTSTRAP_CHANGE = NONE / AGENT_DEFINITION_CHANGE = NONE /
    不新增 primaryWorkspace 配置字段）

FEISHU_WORKSPACE_SELECTION_CHANGE = MINIMAL
  （Feishu normal ingress 停止注入/选择 conversation workspace；
    normal Binding workspace = null → Agent primary workspace =
    resolveWorkspace(agentId)；改动落 feishu-connector 产品入口层）

ROUTER_CHANGE_REQUIRED  = NO（默认；仅证明 generic mechanism 有 bug 才允许改）
BINDING_WORKSPACE_FIELD = KEEP（不删；作为 transitional compatibility mechanism 保留）

MAIN_CHANGE_REQUIRED    = NONE（current native sessionId = main 已可落地 canonical main；
                          NEW_MAIN_MAPPING_LAYER = NO / SESSION_SEAM_REDESIGN = NO；
                          本轮不实现 daily reset）

P2P_TRANSITIONAL_STATE   = OUT_OF_SCOPE
  （preserve/disable/archive 安全显式可回滚，不删历史证据；不得阻塞 group cutover）

LARGE_REFACTOR_REQUIRED  = NO
NEW_REGISTRY_REQUIRED    = NO
KERNEL_CHANGE            = NONE

PRODUCT_CODE_CHANGE      = NONE（本轮仅出 Spec amendment）
STATE_CHANGE             = NONE（本轮不执行 §7.2；实现轮才执行一次性
                          ONE_TIME_PRODUCTION_STATE_CHANGE）
MERGE                    = NONE

FILES_TO_CHANGE =
  packages/feishu-connector/src/core.js · packages/feishu-connector/src/index.js ·
  packages/production-runtime/src/compose.js · packages/agent-memory/src/index.js ·
  tests · canary/runbook if needed · §7.2 MIXED_MEMORY_PROCEDURE（实现轮一次性执行）

REAL_PRODUCT_AGENT_CANARY_V2 = REQUIRED（实现完成后必跑）

SPEC_STATUS             = accepted
ACCEPTANCE              =
  accepted_reviewed_head = 60d248e
  focused_re_review      = PASS（REQUIRED_FIXES = NONE；
                           VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC）
  acceptance_finalize    = 2026-08-18，mechanical only
  SEMANTIC_CHANGE        = NONE（产品语义 / implementation scope / AC /
                           migration/state-change 规则均未修改；
                           PREBOUND_ONLY / Memory resolver / p2p /
                           Binding.workspace / daily reset / Router 未重新设计）
  non-blocking implementation notes（Reviewer，仅实现时注意事项，不改 Spec 语义）=
    V2 active route 必须满足 effective workspace == Agent.primaryWorkspace；
    旧 non-primary pre-bound p2p row 不得进入 V2 normal path
    （即 §5.5 已冻结的 V2_NORMAL_PATH_REQUIRES_PRIMARY_WORKSPACE = YES 与
      TRANSITIONAL_COMPATIBILITY_STATE，无新增语义）
READY_FOR_MECHANICAL_DELTA_REVIEW = YES
```
