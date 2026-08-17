---
spec_id: AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC
status: proposed
---

# AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC — 最小实现 Spec（只出 Spec，不实现）

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结并出 Implementation Spec，不 implementation /
> 不 migration / 不 merge）** · 日期：2026-08-17
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
  agent-memory 从 session.header.cwd 解析；tests；canary/runbook if needed。
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

### 5.2 需要的冻结改动：从 Session.header.cwd 解析

```text
MEMORY_RUNTIME_SEAM = CURRENT Session.header.cwd
  each memory operation 解析当前 Session.header.cwd
  → <cwd>/MEMORY.md（= primary Workspace / MEMORY.md）

至少覆盖：
  load
  save/write
  search
  system prompt [memory] injection
  consolidation
  daily notes
```

- 同 Workspace 的 `main` / `cron` / `agent-task` / `background` session 因
  `header.cwd` 相同 → 自然共享同一份 MEMORY.md（V2 §7/§13 的
  SAME Agent / SAME Workspace 跨 Session 共享）。
- Memory **不认识** Feishu / conversationId / group/p2p / Binding / Router ——
  它只看 `session.header.cwd` 落点。
- 现有 path helpers（`resolveMemoryFile(workspace)` / `resolveMemoryDir(workspace)` /
  `resolveDailyNoteFile(workspace)`）已经是 `workspace → MEMORY.md` 形态，**保持不动**
  （无意义重构禁止）。

### 5.3 Memory CALL_SITES（实现方要改的最小面）

memory 当前把 workspace 当**进程级常量**在 apply 时捕获一次；V2 改为**每个操作**按
session.header.cwd 解析。具体接线（实现裁决，以 source-verified 现状为据）：

```text
- agent-memory apply 不再仅靠 agentId 解析 workspace；
- service 方法与 prompt-injection text 项在需要 memory 文件时，从操作触发的
  当前 session.header.cwd 派生 memoryFile；
- consolidation（turn/end）发生后，从触发它的 session.header.cwd 取 workspace；
- 保持 memory.js 纯函数不动。
```

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

### 7.2 被污染的 MEMORY.md（一次性 archive）

```text
~/.agent-core/workspaces/agt_stock_agent/MEMORY.md
  已被旧 multi-workspace Canary 污染
  （含 CANARY-R2-BOOT-OK / consolidation:session:agent:agt\\\\_stock\\\\_agent:cron:... 等
    canary-test 痕迹；agent-memory 之前进程级按 agentId 解析写进来）
```

冻结一次性处理：

```text
MIXED_MEMORY_DISPOSITION = ARCHIVE_WHOLE_FILE_ONLY
  old mixed MEMORY.md
    → backup/archive 整文件（不动内容，不 provenance split）
    → no provenance split
    → no copy into another Workspace
    → active primary Workspace 以 clean/lazy MEMORY.md 开始
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
  packages/feishu-connector/src/index.js       # 相应去导管/注释对齐
  packages/agent-memory/src/index.js           # memory 从 session.header.cwd 解析
  tests（feishu-connector / agent-memory / agent-router 受影响断言）
  docs/runbooks/*（canary v2 runbook，如需要）
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
AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC = PASS

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

MEMORY_RUNTIME_SEAM     = CURRENT Session.header.cwd
MEMORY_CALL_SITES       = load / save(write) / search / system-prompt [memory] injection /
                          consolidation / daily notes（≥ 这些覆盖）
                          （memory.js 纯函数不动；现有 workspace→MEMORY.md path helpers 保持）

MAIN_CHANGE_REQUIRED    = NONE（current native sessionId = main 已可落地 canonical main；
                          NEW_MAIN_MAPPING_LAYER = NO / SESSION_SEAM_REDESIGN = NO；
                          本轮不实现 daily reset）

STOCK_GROUP_STATE_CHANGE = NONE（feishu:oc_92332c45… → agt_stock_agent → main →
                          workspace=null 已是 V2 normal shape，不迁）
MIXED_MEMORY_DISPOSITION = ARCHIVE_WHOLE_FILE_ONLY
  （~/.agent-core/workspaces/agt_stock_agent/MEMORY.md 整文件 backup/archive；
    no provenance split；no copy into another Workspace；primary Workspace 以 clean/lazy
    MEMORY.md 开始；普通 Workspace 文件与 AGENTS.md KEEP）
P2P_TRANSITIONAL_STATE   = OUT_OF_SCOPE
  （preserve/disable/archive 安全显式可回滚，不删历史证据；不得阻塞 group cutover）

LARGE_REFACTOR_REQUIRED  = NO
NEW_REGISTRY_REQUIRED    = NO
KERNEL_CHANGE            = NONE

PRODUCT_CODE_CHANGE      = NONE（本轮仅出 Spec）
STATE_CHANGE             = NONE（本轮仅出 Spec）
MERGE                    = NONE
KERNEL_CHANGE            = NONE

FILES_TO_CHANGE =
  packages/feishu-connector/src/core.js · packages/feishu-connector/src/index.js ·
  packages/agent-memory/src/index.js · tests · canary/runbook if needed
ACCEPTANCE_TESTS =
  REAL_PRODUCT_AGENT_CANARY_V2（A 真人 ingress / B →agt_stock_agent /
  C effective Workspace=resolveWorkspace(agt_stock_agent) / D main.header.cwd==primary
  Workspace / E Memory==primary Workspace/MEMORY.md / F resume main / G restart 后 resume /
  H fresh non-main 同 cwd 独立 trajectory / I one-Agent-one-process / J OpenClaw fallback=NO；
  不验 daily reset / auto birth / p2p final model / Mobile switch_agent / auth redesign）

REAL_PRODUCT_AGENT_CANARY_V2 = REQUIRED（实现完成后必跑）

LARGE_REFACTOR_REQUIRED = NO
NEW_REGISTRY_REQUIRED   = NO
KERNEL_CHANGE           = NONE

SPEC_STATUS             = proposed
READY_FOR_INDEPENDENT_REVIEW = YES
```
