---
spec_id: FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1
status: proposed
amendment: FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1_SPEC_AMENDMENT
amends: AGENT_CORE_BINDING_WORKSPACE_V1 (accepted) — product-policy literal + memory ownership
superseded_by: none
---

# Feishu Workspace Memory Alignment V1

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结，不实现）** · 日期：2026-08-17
> 仓库：`mayf3/dsh-agent-core`
> 角色：Workspace / Memory Ownership Spec Agent
>
> 本轮只产出 `docs/specs/FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1.md`（本文件）。
> **不 implementation、不 merge、不做任何磁盘迁移。** 只调查、冻结、提交。
>
> 本 Spec 在 `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md`（status: **accepted**，
> 且其 Implementation 已在 `origin/main` 落地的两条冻结之上，**收窄/澄清**两个缺口：
>
> 1. Binding 决定 effective workspace 后，**long-term memory 的 ownership 仍按 agentId
>    定位**——不同 conversation 共享同一 MEMORY.md（生产重现实证，见 §Problem）。本 Spec
>    把 memory ownership 冻结为 **WORKSPACE_LOCAL**。
> 2. Feishu conversation → workspaceId 的字面量沿用 `feishu-<normalized>`（accepted Spec 明确
>    “具体串不写死”）。Product Owner 已裁决冻结 **FEISHU_WORKSPACE_ID = conversationId**
>    （`oc_<chatId>` 直接作为 workspaceId），前提是源码确认该 id 满足现有 workspaceId
>    validation —— 已确认（§FeishuWorkspaceIdentity），并冻结一次性显式 migration
>    （§LegacyBindingMigration）。
>
> 不新增 runtime 实体、不建设 Workspace Registry、不建设第二层 global memory、
> 不改 DSH kernel、不改 Router 的产品分支。

---

## AMENDMENT — Migration Data Safety Closure（REQUIRED_FIX 1–3 + Migration Gate）

> 日期：2026-08-17 · BASE_REVIEWED_HEAD = `4558b50` · Independent Review:
> **VERDICT = FIX_REQUIRED**（仅 §Migration Data Safety 的 REQUIRED_FIX；
> 主模型全部 PASS，见下）。
>
> 本 AMENDMENT **只闭合 Migration Data Safety 的 REQUIRED_FIX**，不重新讨论：
> `MEMORY_OWNERSHIP = WORKSPACE_LOCAL`、`TARGET_MEMORY_KEY = session.header.cwd`、
> `FEISHU_WORKSPACE_ID = conversationId`、`LEGACY_GENERIC_FALLBACK = KEEP`、
> Router boundary、AC1–AC10 主模型 —— 这些已 Review **PASS**。
>
> 被本 AMENDMENT 收敛的原文范围：§ExistingOpenClawWorkspaceData 的
> `MIGRATION_MEMORY_CLEANUP` 段（原为“由 runbook 显式移入 archive”的模糊表述）与
> §LegacyBindingMigration 的 verification/rollback 段 —— 本 AMENDMENT 冻结唯一规则，
> 消除 Implementation 的自行判断空间。

### Fix 1 — Provenance 分类规则（冻死）

```text
PROVENANCE_KEEP_RULE =
  对迁移到 target conversation workspace 的每一条 memory entry：

  KEEP
    iff provenance 能证明该 entry 所属 Session 的 effective workspace
    == target conversation workspace

  ARCHIVE / EXCLUDE
    otherwise（所有无法证明的条目一律不得进入 target MEMORY.md）

  判断依据 = entry 的 Source/Metadata 中可核验的 session/provenance 信息
  （如 consolidation:session:<...>、写入时冻结的 header.cwd 路径等）；
  不允许 Implementation Agent 依据内容语义自行判断“哪些应该复制”。

UNKNOWN_PROVENANCE_POLICY =
  unknown / malformed / provenance 不足
    -> MUST NOT 猜测归属
    -> ARCHIVE / MANUAL_REVIEW
       （进入 migration quarantine/archive，绝不允许写入 target MEMORY.md）

  默认 fail-safe：不能证明属于目标 workspace，就不能写进目标 MEMORY.md。

CRON_ENTRY_POLICY =
  cron / agent-default session entry：
  如果其 effective workspace != target conversation workspace
    -> 不得进入 target conversation MEMORY.md
  （例如迁移前 cron session 落在 agt_stock_agent（agent default）而 target 是
   oc_92332c45…，则这些 cron entry 不得进入 oc_92332c45…/MEMORY.md）
```

```text
分层落地（迁移目标行形态，三类 known provenance）：
  group main session entry :
    仅当其 effective workspace 被证明 == 目标 group workspace 时才 KEEP；
    否则 ARCHIVE（见 Fix 2 去向规则）。
  p2p session entry          : 一律不得进入 group MEMORY.md（目标为 group 时
    其 effective workspace != target => ARCHIVE/EXCLUDE）。
  cron / agent-default entry : effective workspace != target => 不得进入 target
    conversation MEMORY.md（ARCHIVE/EXCLUDE；去向见 Fix 2）。
```

### Fix 2 — Archive 去向（冻死）

```text
FOREIGN_ENTRY_ARCHIVE_DESTINATION =
  禁止模糊 “move to some memory/archive”。

  对 foreign entry 明确二选一：
  1) provenance 能确定属于某个已知 conversation workspace
       -> archive 到【该 conversation workspace 的 migration archive】
          （<该 workspace>/memory/migration-archive/ 或同等显式集合）
          或放入该 workspace 的待恢复集合（pending-restore），
          绝不进入任何可注入的 MEMORY.md；
  2) 无法安全确定目标 workspace（unknown / malformed）
       -> 放入 dedicated migration quarantine/archive
          （<migration-root>/quarantine/，独立于所有 conversation workspace）
          -> 不注入任何 conversation MEMORY.md
          -> MANUAL_REVIEW 兜底

  禁止：为了“保留数据”把 foreign entry 放进当前 group workspace 的
  可注入 MEMORY.md。
```

### Fix 3 — 源侧 mixed MEMORY.md 立场（冻死）

```text
SOURCE_MIXED_MEMORY_DISPOSITION =
  迁移后 agt_stock_agent/MEMORY.md（legacy 混合文件：group main entries +
  p2p entries + cron/agent-default entries）不得继续作为任何 conversation 的
  active memory source。

  该原文件应：backup/archive（一次性封存，保留只读），
  而【不是】继续被 group / p2p Session 注入。

  agent-default workspace 的后续 cron/background Session：
    只能消费属于 agent-default workspace 自己的、新的 workspace-local
    MEMORY.md（<agent-default-workspace>/MEMORY.md，按 WORKSPACE_LOCAL 规则
    由这些 session 自己的 header.cwd 解析），
    不能继续消费历史混合文件。

  即：迁移 = source 封存 + target 收拢 KEEP 条目的全新 workspace-local
  MEMORY.md；不存在“group 继续读旧混合文件”的状态。
```

### Migration Gate（顺手冻清 Reviewer non-blocking 建议）

```text
MIGRATION_PREFLIGHT =
  - source missing
      -> FAIL LOUD before write（迁移脚本立即失败，不写任何目标）
  - destination non-empty（存在任何内容/已被 ensure 播种）
      -> ABORT before write（不覆盖、不合并、不静默继续）
  - 不因此新增 migration framework（保持脚本 + runbook 形态）

BINDING_AUTHORITY_SWITCH_GATE =
  bindings.json 的 authority switch（binding.workspace / activeSessionId 改为
  迁移目标值）-> ONLY AFTER 全部 migration verification gates PASS
  （§ExistingOpenClawWorkspaceDataPolicy 的 V1–V5 全过之后才能改；
   任何 gate 失败 => 不切换 authority，保持旧 binding 不变，走 rollback）。
```

### 边界重申（本 AMENDMENT 不改变）

```text
AUTO_MIGRATION = NO（迁移必须显式 runbook，绝不自动触发）
SELECTED_FEISHU_BINDINGS_ONLY = YES（只迁移显式白名单 binding）
WORKSPACE_REGISTRY = NOT_INTRODUCED
GLOBAL_MEMORY_LAYER = NOT_BUILT（V1 无第二层）
ROUTER_REWRITE = NO
SCHEDULER_REDESIGN = NO
KERNEL_CHANGE = NONE
```

---

## DEVELOPMENT_PREFLIGHT

```text
DEVELOPMENT_PREFLIGHT

Problem =
  长期 Memory 当前按 agentId 定位（packages/agent-memory/src/paths.js resolveWorkspace(agentId)），
  同一 Agent 的不同 conversation 共享同一 MEMORY.md：
  生产重现实证 —— 私聊 session（main-oc_9dd74b9ed…，cwd=feishu-oc_9dd74b9ed…）的 consolidation
  条目出现在群 session（main，cwd=agt_stock_agent）的 MEMORY.md 中（Source 含
  consolidation:session:main\-oc\_9dd74b9ed…），即私聊 memory 进入群聊 [memory] 注入。
  Product Owner 裁决：MEMORY_OWNERSHIP = WORKSPACE_LOCAL。
  Feishu conversation → workspace 字面量需按 FEISHU_WORKSPACE_ID = conversationId 冻结，
  并冻结一次性显式 migration（legacy workspace=null binding → explicit conversation workspace）。

Governing Spec =
  AGENT_CORE_BINDING_WORKSPACE_V1（status: accepted；Implementation 已在 origin/main）——
  本 Spec 是其产品 policy 字面量澄清 + memory ownership 扩展（AMEND 语义）。
Spec status（本文件） = proposed（冻结本轮；需 Independent Spec Review 后 accepted 才授权实现）

Relevant investigations =
  docs/investigations/test-agent-feishu-product-semantics-v1.md（PASS；OpenClaw 参照行为、
    Binding/workspace 现状实证）
  docs/investigations/AGENT_CORE_MEMORY_EVOLUTION_PLUGIN_AUDIT_V1.md（agent-memory 架构 audit）
  docs/investigations/openclaw-parity-v1.md / openclaw-lark-transport-reuse-v1.md
Relevant decisions =
  D-002 AGENT_SESSION_CHANNEL_MODEL_V1（Binding owner / channel-agnostic）
  D-004 BINDING_AND_SWITCH_V1（Binding 唯一 owner=Router / switchAgent 唯一原语）
  DSH_PLUGIN_ADOPTION_V1（memory 插件形态）
Previously rejected alternatives =
  Workspace Registry / configWorkspaceMap（AGENT_CORE_BINDING_WORKSPACE_V1 已否决，本轮不复活）
  Agent-global second memory layer（本 Spec 明确 V1 不建设）

Frozen boundaries =
  LEGACY_GENERIC_FALLBACK = KEEP（workspace=null → resolveWorkspace(agentId) 不变）
  Router 无 Feishu special-case（policy 只在 feishu-connector / product entry）
  agent-memory 不知道 Feishu / Binding / Router，只知道 workspace（session.header.cwd）
  SESSION_WRITE_CONTRACT R1/R2/R3 不变（cwd immutable；cross-workspace mismatch 结构化拒绝）
  一个 Agent 仍只有一个 DSH process
  KERNEL_CHANGE = NONE

Implementation scope（下一轮，本 Spec 授权） =
  1) agent-memory：workspace 解析从 mount-time resolveWorkspace(agentId)
     → operation-time session.header.cwd（tools / injection / consolidation 三处同 seam）
  2) feishu-connector：conversationWorkspaceId 字面量改为 bare conversationId
     （thread/sender scope 复用 normalize）
  3) 一次性显式 migration（runbook 化，仅选中 Feishu production bindings）：
     legacy workspace=null / 已存在 feishu-oc_* 的 binding → explicit conversation workspace，
     workspace 数据 copy + 校验 + rollback（§LegacyBindingMigration / §ExistingWorkspaceData）
  4) 验收断言 AC1–AC10
Out-of-scope =
  Agent-global second memory layer · semantic memory redesign · embedding/vector DB ·
  memory ranking · memory summarization redesign · Lark UX · Auth/Broker/Forum ·
  Scheduler redesign · Router rewrite · Agent Definition schema expansion ·
  Workspace Registry · Kernel change

New evidence =
  §Problem 的生产运行时实证（bindings.json + session headers + MEMORY.md 泄漏条目）
  §FeishuWorkspaceIdentity 的源码验证（bare oc_* 通过 validateWorkspaceId，
  'feishu-' 前缀无任何 code parse 依赖；accepted Spec 明写“具体串不写死”）
  OpenClaw 现状：~/.openclaw/groups/workspace-oc_<chatId>（90 个，含实测 stock 群
    workspace-oc_0480991b…），chat id 即为 workspace identity（带 workspace- 类前缀）

Need new/amended Spec = YES（本文件即 new Spec；需 Independent Review → accepted）
```

---

## 开头回答（Preflight Answers）

```text
North Star =
  Agent   = 谁在工作（长期身份）
  Workspace = 在哪个工作环境中工作（长期工作目录：AGENTS.md / MEMORY.md / files）
  Session = Workspace 中的一段具体 trajectory（main / cron / background 均可共享同一 Workspace）
  一个 Workspace 统一承载：AGENTS.md · MEMORY.md · files ·
    main Session · cron Sessions · background Sessions。
  不同 Workspace：files 隔离 + MEMORY 隔离。

First blocker =
  无技术 blocker（本轮 SPEC）。可观测的产品缺陷只有一个：
  memory 按 agentId 定位导致同 Agent 跨 conversation 共享 MEMORY.md（生产实证，§Problem）；
  源码 seam 全部可用（§MemoryApiSeam / §FeishuWorkspaceIdentity），无需 Kernel 改动。
  下一轮实现前唯一的必要前置 = 本 Spec 被 Independent Review → accepted。

Can Agent/Harness/Reviewer solve outside Kernel =
  YES —— 全部改动落在 agent-memory（workspace 解析 seam）、feishu-connector
  （workspaceId 字面量）、一次性 migration runbook；DSH 侧只读 session.header.cwd
  （agent-instructions / tool-fs 同款既有 seam），无任何 DSH 代码改动。

Kernel change truly necessary =
  NO（KERNEL_CHANGE = NONE）

Product special-casing introduced =
  NO —— Router 保持 0 产品分支；Feishu policy 只在 feishu-connector / product entry；
  agent-memory 只认识 workspace（session.header.cwd），不认识 Feishu / Binding / Router。

Smallest next action =
  本轮：冻结本 Spec（本文件）→ commit + push（不 merge）。
  下一轮（implementation，需本 Spec accepted）：
    1) agent-memory 按 session.header.cwd 解析 memoryFile；
    2) feishu-connector 字面量改 bare conversationId；
    3) 选中 binding 的一次性显式 migration + AC1–AC10 验收。
```

Expected / 冻结基线：

```text
KERNEL_CHANGE = NONE
```

---

## Problem

### 已观测缺陷（生产实证，2026-08-17）

生产 runtime（`~/.agent-core`，`feat/agent-core-binding-workspace-v1` 实现已落地）现存两条
Feishu binding（`~/.agent-core/bindings/bindings.json`，source-verified）：

```text
feishu:oc_92332c45c1cac2ef89857abfee8ed762   # 群「大侠 - 小虾米」（legacy）
  activeAgentId = agt_stock_agent
  activeSessionId = main
  workspace = null                            # legacy fallback → resolveWorkspace(agt_stock_agent)

feishu:oc_9dd74b9ed02ce216951260a381eb502d   # 新私聊（conversation-specific workspace）
  activeAgentId = agt_stock_agent
  activeSessionId = main-oc_9dd74b9ed02ce216951260a381eb502d
  workspace = "feishu-oc_9dd74b9ed02ce216951260a381eb502d"   # 现行 feishu- 字面量
```

对应 native session（`~/.agent-core/homes/agt_stock_agent/sessions/`，persisted JSONL header）：

```text
sessions/<cwd=…workspaces/agt_stock_agent>/main                     cwd = ~/.agent-core/workspaces/agt_stock_agent
sessions/<cwd=…workspaces/agt_stock_agent>/agent:agt_stock_agent:cron:… cwd = ~/.agent-core/workspaces/agt_stock_agent
sessions/<cwd=…workspaces/feishu-oc_9dd74b9ed…>/main-oc_9dd74b9ed…     cwd = ~/.agent-core/workspaces/feishu-oc_9dd74b9ed…
```

**泄漏实证**：群侧 memory 文件
`~/.agent-core/workspaces/agt_stock_agent/MEMORY.md` 内出现私聊 session 的 consolidation
条目（Source = `consolidation:session:main\-oc\_9dd74b9ed02ce216951260a381eb502d`，
内容为私聊侧 R2 marker 与私聊 workspace 描述），并已污染模型认知（同文件内出现
“Canary marker is not actual workspace... the real workspace is agt_stock_agent” 的自我困惑条目）。

根因（source-verified）：

```text
packages/agent-memory/src/index.js:144-148
  agentId = cfg.agentId ?? process.env.DSH_AGENT_ID ?? agentIdFromCwd(process.cwd())
  workspace = resolveAgentWorkspace(agentId, cfg.workspaceRoot)     # 只由 agentId 决定
  memoryFile = resolveMemoryFile(workspace)                          # mount 时冻结一次
  # → 该文件被进程内 ALL sessions 共用（tools / injection / consolidation），
  #   与各 session 的 header.cwd 无关
packages/agent-memory/src/paths.js:41-43
  resolveAgentWorkspace(agentId) = resolveWorkspace(agentId)        # workspace-bootstrap
packages/agent-router/src/process.js:97-107（child cwd）+ ensureRunning
  # spawn cwd / DSH_AGENT_ID 都是 agent 级，同一 Agent 单进程服务多 conversation session
```

文件隔离（tool-fs 按 `exec.agent.session.header.cwd`）已经正确（私聊 marker 只在
`feishu-oc_9dd74b9ed…` 目录），但 MEMORY.md 仍按 agentId —— 这就是
`FEISHU_CHAT_READY_TO_REPLACE_OPENCLAW = YES` 后遗留的**真实产品语义问题**。

---

## Governing Evidence（全部 source-verified / runtime-verified）

```text
MEMORY_KEYED_BY_AGENT_ID = CONFIRMED
  - agent-memory/src/index.js:144-149（mount 时 resolveAgentWorkspace(agentId) 冻结 workspace+memoryFile）
  - agent-memory/src/paths.js:41-43,50-52（resolveAgentWorkspace → resolveWorkspace(agentId)；
    resolveMemoryFile(workspace) 已按 workspace）
  - agent-memory/src/memory.js:427-441（load(agentId)/renderForContext(agentId) 只收 agentId；
    consolidate({workspace,…}) 已按 workspace）
  - 生产实证：agt_stock_agent/MEMORY.md 含私聊 session Source 条目（§Problem）

SESSION_CWD_IS_WORKSPACE_AUTHORITY = CONFIRMED（DSH 既有 seam，无 kernel 改动）
  - demo-server/src/session-seam.js：R1 create 冻结 meta:{cwd}=resolved effective workspace；
    R2 resume 恢复持久化 header 并校验；R3 mismatch → SESSION_WORKSPACE_MISMATCH
  - harness packages/core/agent-loop/src/index.ts:589（create(id, options, meta:{cwd})）、
    :353（systemPrompt variable 'cwd' = context.agent?.session.header.cwd）
  - harness packages/fs/tool-fs/src/session-cwd.ts:24（文件工具相对路径按 exec.agent.session.header.cwd）
  - harness packages/context/agent-instructions/src/index.ts:124-126（AGENTS.md baseline 按
    agent.session.header.cwd）
  - harness packages/core/agent-loop/src/agent.ts:95（agent-scope ctx.extend({agent}) →
    插件 ctx.agent 可用）

MEMORY_FILE_IS_PURELY_WORKSPACE_DERIVED = CONFIRMED
  - resolveMemoryFile(workspace) = <workspace>/MEMORY.md；loadEntries(memoryFile)；
    consolidate({workspace,memoryFile,…})；appendDailyNote/readDailyNotes(workspace, …)
    —— 纯层全部已按 workspace/路径操作；唯一按 agentId 的地方是方便层 load/
    renderForContext 与 plugin 的 mount-time 解析

FEISHU_WORKSPACE_ID_LITERAL_NOT_FROZEN = CONFIRMED（accepted Spec 明示）
  - AGENT_CORE_BINDING_WORKSPACE_V1 §ProductPolicy 具体化：“复用现有 channel namespace
    'feishu' 与 sanitize 规则；**具体串不写死**”
  - 源码：feishu- 前缀只在 feishu-connector/src/core.js conversationWorkspaceId 构造；
    全仓 grep 无任何 parse/依赖该前缀的代码；向 workspaceId 的传输全程不透明
    （router resolveChannelConversation req.workspace）

BARE_CONVERSATION_ID_PASSES_WORKSPACE_ID_VALIDATION = CONFIRMED（执行验证）
  - validateWorkspaceId/sanitizeAgentId（workspace-bootstrap/src/paths.js:60,135-149）只允许
    [A-Za-z0-9_-]（禁 / \ . NUL、禁 absolute、禁 overlong、禁首尾空格）
  - node 实测：'oc_92332c45c1cac2ef89857abfee8ed762' / 'oc_9dd74b9ed02ce216951260a381eb502d'
    / 'oc_0480991b97f1e27c96514ac66b4f122c' → resolveWorkspace → <root>/<id> 全部 OK
  - 注意：thread/sender scope conversationId 含 ':'（oc_A:topic:omt_B），必须复用现有
    normalize（replace [^A-Za-z0-9_-] → '-'）才满足“单安全 path component”语义
  - 现有测试 workspace-id.test.js:33-40 以 'feishu-oc_92332…' 为例值；bare oc_* 同过同规则

OPENCLAW_REFERENCE_MODEL = workspace-oc_<chatId>，conversation 决定 workspace
  - 实测 ~/.openclaw/groups/ 下 90 个 workspace-oc_*（含生产股票群
    workspace-oc_0480991b97f1e27c96514ac66b4f122c，完整内容：AGENTS.md/MEMORY.md/SOUL.md/
    TODO.md/TRACKING.md/…，非空、非 symlink）
  - docs/investigations/test-agent-feishu-product-semantics-v1.md（PASS）：
    OPENCLAW_REFERENCE_BEHAVIOR = workspace stored per peer(group) —— workspace-oc_<chatId>，
    distinct chat => distinct workspace even when the persona/role string is shared

LEGACY_BINDING_STATE = CONFIRMED（生产实证）
  - feishu:oc_92332c45… binding workspace=null → resolveWorkspace(agt_stock_agent) =
    ~/.agent-core/workspaces/agt_stock_agent（该目录即群目前真实 cwd，含完整股票 agent 内容）
  - workspace-bootstrap/src/index.js:155-169 ensure(agentId)（agent 级）与
    :185-191 ensureWorkspace(workspaceId)（binding 级）——迁移后 group workspace 由后者保障

CRON_SESSION_CURRENTLY_AGENT_DEFAULT_WORKSPACE = CONFIRMED
  - scheduler-router/src/index.js createRouterInvoker → proc.turn(sessionId, message, {}, …)
    不传 cwd → session 落到 process 级 initialize cwd = agent default workspace
  - 生产实证：cron session（agent:agt_stock_agent:cron:a4f31fe7-…）cwd = agt_stock_agent，
    其 consolidation 进入 agt_stock_agent/MEMORY.md
  - target：memory 按 workspace ⇒ 同 workspace 的 main/cron/background 天然共享同一
    MEMORY.md（AC4）；cron 的 workspace 选择属于 product entry（job 级 workspace 提示），
    不属于 Router / memory
```

---

## Product Model（North Star，冻结）

```text
Agent      = 谁在工作（长期身份：identity 与生命周期不依赖任何 Channel）
Workspace  = 在哪个工作环境中工作（长期工作目录：AGENTS.md / MEMORY.md / files）
Session    = Workspace 中的一段具体 trajectory（main / cron / background，
             同一 Workspace 可承载多个 Session）

WORKSPACE_UNIFIED_CARRIER =
  Workspace
  ├── AGENTS.md（workspace-bootstrap 播种；DSH agent-instructions 原生消费）
  ├── MEMORY.md（file-first 长期记忆；由 workspace 决定，见 §MemoryOwnership）
  ├── files（由 session.header.cwd 决定；tool-fs 既有行为）
  ├── main Session
  ├── cron Sessions
  └── background Sessions
  多个 Session 可共享同一 Workspace；不同 Workspace：files 隔离 + MEMORY 隔离。
```

长期 invariant（延续并收紧 AGENT_CORE_BINDING_WORKSPACE_V1）：

```text
LONG_LIVED_INVARIANTS
  - Agent identity does NOT uniquely determine Workspace.
  - Agent MAY have a default Workspace（resolveWorkspace(agentId)）。
  - Binding determines the effective Workspace（binding.workspace；null → Agent default，KEEP）。
  - One native DSH Session has exactly one immutable cwd（SESSION_WRITE_CONTRACT R1/R2/R3）。
  - Memory ownership follows the effective Workspace（= session.header.cwd），NOT agentId。
  - Different Workspace => files isolated AND memory isolated.
  - 一个 Agent 仍只有一个 DSH process（registry 按 agentId；多 workspace 在多 session 内）。
```

---

## Memory Ownership（冻结：WORKSPACE_LOCAL）

```text
MEMORY_OWNERSHIP = WORKSPACE_LOCAL

Memory read / write / injection 必须跟当前 Session 的 effective Workspace 走：

  effective Workspace（运行期权威）= session.header.cwd
    （SESSION_WRITE_CONTRACT R1：create 时冻结；R2：resume 恢复持久化 header ——
     restart/resume 后 memory workspace 不漂移，AC5）

  memoryFile 定位 = <session.header.cwd>/MEMORY.md
  episodic 层定位 = <session.header.cwd>/memory/YYYY-MM-DD.md

  同一 Workspace（同一 header.cwd）的 main / cron / background Session
    → 共享同一 MEMORY.md（AC4）
  不同 Workspace 的 Session → 永不共享 MEMORY.md（AC1 / AC2）

不允许：
  同一个 Agent + 群聊 Workspace + 私聊 Workspace → 自动共享任何 conversation-scoped
  MEMORY.md。（这正是当前生产缺陷：memoryFile 在 mount 时按 agentId 冻结。）

V1 边界：
  本 Spec 不建设第二层 Agent-global durable profile / knowledge。
  V1 不存在任何 global memory 层；“Agent 全局档案”是未来议题，不由本 Spec 授权。
```

```text
CURRENT_MEMORY_KEY = agentId
  （agent-memory/src/index.js:144-149：mount 时 workspace=resolveAgentWorkspace(agentId)，
   memoryFile 冻结一次；load/renderForContext 收 agentId）
TARGET_MEMORY_KEY = effective workspace = session.header.cwd
  （每次 operation / 每次 injection assembly 时从当前 session 的 header.cwd 解析
   memoryFile；process 级 cwd 仅作 header 缺失时的 fallback）
```

---

## Memory API Seam（冻结：最薄 seam）

```text
MEMORY_API_SEAM = Memory receives effective workspace / cwd

agent-memory 只应该知道 workspace。它不查询 Feishu Binding、不理解 conversationId、
不理解 Router。workspace 的“从哪来”由上游 product entry + SESSION_WRITE_CONTRACT 决定；
agent-memory 只消费 session.header.cwd。

现有纯层（已按 workspace/路径操作，source-verified，无需重设计）：
  resolveMemoryFile(workspace)      -> <workspace>/MEMORY.md
  resolveMemoryDir(workspace)       -> <workspace>/memory/
  consolidate({workspace, memoryFile, …})
  appendDailyNote(workspace, …) / readDailyNotes(workspace, …)
  loadEntries(memoryFile) / writeEntries(memoryFile, …)

需要改的只有 plugin 的“mount-time agentId 解析”这一处（index.js:144-148）：
  把 workspace / memoryFile 从 mount-time 常量 → operation-time 按 session 解析：

  1. 模型工具（memory_save/search/list/update/delete/consolidate）：
     execute(args, exec) → workspace = exec.agent.session.header.cwd
     （memory_consolidate 已用 exec?.agent?.session —— 同一 seam；tool-fs 同款）
  2. 自动注入（systemPrompt.context text provider，index.js:563-582）：
     assembly 时 workspace = ctx.agent.session.header.cwd
     （harness agent.ts:95 ctx.extend({agent})；agent-loop:353 同款变量 seam）
  3. turn/end 自动 consolidation（session/event，index.js:531-534）：
     workspace = session.header.cwd（事件载荷即 session 对象）
  4. 缺 header.cwd 的极旧/畸形 session：fallback = process 级 initialize cwd（现行行为），
     绝不回退到 agentId 推导（agentId 只用于身份/日志/DELIVERY_V0 无绑定场景）。

保留不动：
  - memoryFile 显式 override（memory.js load/renderForContext 的 memoryFile 参数，
    control-plane / 工具调用仍可显式传入）—— 显式 > session 推导 > fallback。
  - 纯层函数签名（consolidate 已收 workspace；load/renderForContext 的 agentId 参数
    保留为“deriveAgentWorkspace 方便层”，plugin 不再使用它定位 memoryFile）。
```

---

## Feishu Workspace Identity（冻结）

```text
FEISHU_WORKSPACE_ID = conversationId

一个 Feishu conversation = 一个固定 Workspace（保持 OpenClaw 心智模型）：

  oc_92332c45c1cac2ef89857abfee8ed762
    → <workspaceRoot>/oc_92332c45c1cac2ef89857abfee8ed762

scope 规则：
  - p2p / group scope：conversationId === chatId（oc_*）→ workspaceId = chatId（bare）
  - thread / sender scope：conversationId 含 ':'（oc_A:topic:omt_B）→ 复用现有 normalize
    （replace 非 [A-Za-z0-9_-] → '-'）后作为 workspaceId；V1 主路径仍是 p2p/group，
    thread 只保证“单安全 path component”语义完整（不退化、不被截断成别的 id）

前提确认（§GoverningEvidence）：
  - bare oc_* 通过 validateWorkspaceId（worker 实测 3 个真实 id 全部 OK）
  - 无任何源码/测试 invariant 依赖 'feishu-' 前缀（accepted Spec 明写“具体串不写死”）
  - Router 收到的是不透明 workspaceId（resolveChannelConversation req.workspace），
    本 policy 仍只存在于 feishu-connector（conversationWorkspaceId 生成函数）

OPENCLAW_WORKSPACE_ID_MODEL = workspace-oc_<chatId>
  （OpenClaw 以 workspace- 类前缀 + oc_<chatId> 作为 agent 工作目录名；
   chat id 即 workspace identity。Agent Core 采用 bare conversationId：
   名字空间由 <workspacesRoot>/ 目录本身承担，无需类前缀 —— 与 production layout
   `~/.agent-core/workspaces/<id>` 一致。）

FEISHU_CONVERSATION_SESSION_ID（不变） = conversationMainSessionId(conversationId)
  = 'main-' + normalized conversationId（现行实现不变，例如 main-oc_9dd74b9ed…）

namespace 保留判定：
  源码 evidence 未发现必须保留 namespace 才能满足的既有 invariant
  （无 parse、无依赖、无测试断言、accepted Spec 未冻结字面量）
  → 不 STOP，冻结 FEISHU_WORKSPACE_ID = conversationId。
  同时记录唯一跨命名空间风险：<workspaceRoot> 同时承载 agent default workspace
  （<root>/<agentId>）与 conversation workspace（<root>/oc_*）；二者靠 id 约定不相交
  （authored agent id = agt_*/名称；Feishu chat id = oc_<32hex>）。未来若出现 authored
  agent id == oc_* 碰撞，属 Agent Definition 侧约定问题，不在本命名内解决（§Risks）。
```

---

## Existing OpenClaw Workspace Data（冻结：优先复用，禁止空目录）

```text
EXISTING_WORKSPACE_DATA_MIGRATION = DEFINED（本轮只冻结，不执行）

现状（runtime-verified）：
  - OpenClaw：~/.openclaw/groups/workspace-oc_<chatId>（90 个）。
    生产股票群 oc_0480991b97f1e27c96514ac66b4f122c 存在完整工作目录：
    ~/.openclaw/groups/workspace-oc_0480991b97f1e27c96514ac66b4f122c/
    （AGENTS.md / MEMORY.md / SOUL.md / TODO.md / TRACKING.md / memory/ / …，非 symlink）
  - Agent Core（现行）：~/.agent-core/workspaces/agt_stock_agent = 群「大侠 - 小虾米」
    legacy fallback 的 cwd，含完整股票 agent 内容（OpenClaw cutover 的 Agent Core 侧载体）；
    ~/.agent-core/workspaces/feishu-oc_9dd74b9ed… = 私聊现行 conversation workspace
    （AGENTS.md + canary-r2-isolation-marker.txt）
  - canary 群 oc_92332c45… 在 OpenClaw 无 workspace 目录（0 命中）——测试群，无 OpenClaw 负载。
  - Agent Core 侧尚无 oc_<chatId> 裸目录（oc_92332/oc_9dd74/oc_0480991b 均不存在）。

冻结规则：
  MIGRATION_CONTENT_POLICY = COPY（禁止默认 move / 禁止凭空建空目录）
    - 每个被迁移 binding 都必须有显式 source → destination：
        legacy 群  ：source = <root>/workspaces/agt_stock_agent
                      destination = <root>/workspaces/oc_92332c45c1cac2ef89857abfee8ed762
        私聊        ：source = <root>/workspaces/feishu-oc_9dd74b9ed02ce216951260a381eb502d
                      destination = <root>/workspaces/oc_9dd74b9ed02ce216951260a381eb502d
        未来生产股票群 cutover：source = <root>/workspaces/agt_stock_agent（Agent Core 侧
                      载体，已含 OpenClaw 内容；OpenClaw 原始目录
                      ~/.openclaw/groups/workspace-oc_0480991b… 作为只读 archive 保留）
                      destination = <root>/workspaces/oc_0480991b97f1e27c96514ac66b4f122c
    - copy 方式：rsync -a（或等价 cp -a），保留权限/symlink/.git 等；目标端
      no-clobber（dest 已存在文件绝不覆盖；encountered existing → 停止并报告）
    - source 在验证窗口内保持原样（copy 后 source = read-only archive，直到 rollback
      窗口关闭；即便窗口关闭也保留 source 为 agent default workspace 语义 —— 见下文）
    - AGENTS.md / MEMORY.md / memory/ / files 必须完整迁移；不许出现“空目录 + 自动
      seed 模板”覆盖真实内容（ensureWorkspace 的 seed 只应在 dest 文件缺失时发生）
    - 迁移后：agt_stock_agent 仍是该 Agent 的 default workspace（DELIVERY_V0 cron/
      background session 落点，LEGACY_GENERIC_FALLBACK = KEEP）；其内容与 conversation
      workspace 是同一数据源的两个视图（copy 关系），由 migration runbook 一次性对齐。

  MIGRATION_SESSION_POLICY = SESSION_WRITE_CONTRACT-compatible（活跃 native session 处理）
    - 迁移后 binding.{workspace, activeSessionId} 必须为兼容对：
        legacy 群  ：workspace = oc_92332c45…；activeSessionId =
                      main-oc_92332c45c1cac2ef89857abfee8ed762（conversationMainSessionId，
                      新 native session，首次 turn 时在 new workspace 内 R1 创建）
                      旧 'main' session（persisted cwd=agt_stock_agent）不可在 new workspace
                      内 resume（R3：cwd immutable）→ 保留在原始路径作为历史 archive，
                      绝不静默改 cwd
        私聊        ：workspace = oc_9dd74b9ed…；activeSessionId 保持
                      main-oc_9dd74b9ed…（已是 conversation-scoped id）；
                      该 native session 的 persisted cwd = feishu-oc_9dd74b9ed… ≠ dest
                      → 允许 runbook 做一次性显式 session artifact 迁移：把
                      sessions/<cwd=feishu-oc_9dd74…>/main-oc_9dd74… 整体搬移到
                      sessions/<cwd=oc_9dd74…>/ 并将其 header.cwd 重写为 dest
                      （admin 数据迁移，runbook 专用，绝不进入 runtime 路径；
                      迁移前备份原 artifact；验证后旧 artifact 保留到 rollback 窗口关闭）。
                      若 runbook 选择不迁移 artifact，则按 R3 拒绝使用该旧 session，
                      在 new workspace 内创建新的 conversation session（轨迹断档，
                      memory/files 不丢）——二选一由 runbook 显式记录，不得静默。

  MIGRATION_MEMORY_CLEANUP = REQUIRED（一次性，runbook 专用；规则 = AMENDMENT Fix 1/2/3）
    - 对 source MEMORY.md 的每一条 entry，按 AMENDMENT §PROVENANCE_KEEP_RULE 分类：
        KEEP iff provenance 能证明所属 session 的 effective workspace == target
        conversation workspace；否则 ARCHIVE/EXCLUDE；
        unknown/malformed -> MUST NOT 猜测 -> quarantine + MANUAL_REVIEW。
    - 去向按 AMENDMENT §FOREIGN_ENTRY_ARCHIVE_DESTINATION（能确定 conversation
      workspace -> 该 workspace 的 migration archive / pending-restore；
      无法确定 -> dedicated quarantine，不注入任何 conversation MEMORY.md）。
    - p2p entry 不得进入 group MEMORY.md；cron/agent-default entry 在
      effective workspace != target 时不得进入 target conversation MEMORY.md。
    - 迁移后 target MEMORY.md 只含被证明属于 target workspace 的 KEEP 条目；
      source 混合文件按 AMENDMENT §SOURCE_MIXED_MEMORY_DISPOSITION 封存为
      backup/archive，不再作为任何 conversation 的注入源。
    - 这是数据卫生，不是新的 memory engine；runtime 不做任何跨 conversation 清理。
    - 对应 AC2 对已污染数据的落地（迁移后群侧 [memory] 无私聊内容）。

  MIGRATION_PREFLIGHT（Amend Fix：写前 gate，全部 fail-fast）：
    - source missing        -> FAIL LOUD before write（迁移脚本立即失败，不写任何目标）
    - destination non-empty -> ABORT before write（不覆盖、不合并、不静默继续）
    - 不新增 migration framework（保持脚本 + runbook 形态）

  VERIFICATION（迁移后必须全过；bindings.json authority switch 只在 V1–V5 全过之后）：
    - V1 dest 文件/目录数量 == source（差异 = 0；允许 seed-only 文件的已知新增）
    - V2 抽样或全量 checksum/字节级一致（AGENTS.md / MEMORY.md / 关键文件）
    - V3 bindings.json 修改前备份 + 修改后 JSON 合法 + 行内容 == 冻结的迁移目标
      （该修改 = BINDING_AUTHORITY_SWITCH_GATE 的唯一执行点：仅当 V1–V5 全 PASS
        才允许改 authority；任何 gate 失败 => 不切换、保持旧 binding、走 rollback）
    - V4 smoke：群发一条消息 → 回复成功（agent 进程正常、session 在 new workspace 创建）
    - V5 隔离断言：群 session 注入块不含私聊 marker；私聊 session 注入块为私聊自己的
      MEMORY.md（对应 AC1/AC2）
  ROLLBACK：
    - 迁移前备份：bindings.json、被迁移 workspace 目录（copy）、session artifact（如搬迁）
    - 回滚 = 还原 bindings.json + 交换/删除 dest + 保留 source 不动；幂等、无半写
      （BindingStore 原子写 + snapshot/restore 语义复用）
```

---

## Legacy Binding Migration（冻结：一次性、显式、只选中的 Feishu production bindings）

```text
LEGACY_GENERIC_FALLBACK = KEEP
  - workspace = null → resolveWorkspace(agentId)（agent default）—— 现行 fallback 规则
    对**所有 generic legacy Binding** 保持完全不变（AC8）。
  - 不因 Feishu 迁移改变任何 generic 规则；不带任何 workspace 的旧行照旧工作。

FEISHU_LEGACY_BINDING_MIGRATION = ONE_TIME_EXPLICIT（只迁移明确选中的 Feishu production bindings）
  - 迁移对象 = 显式白名单（binding key 列表），本轮冻结如下（生产实证行）：
      1) feishu:oc_92332c45c1cac2ef89857abfee8ed762   （legacy，workspace null → agt_stock_agent）
      2) feishu:oc_9dd74b9ed02ce216951260a381eb502d   （现行 workspace = feishu-oc_9dd74…，
         字面量对齐为 bare conversationId）
  - 未来被“选中的 Feishu production bindings”（如生产股票群 oc_0480991b… 的正式 cutover）
    必须显式进入同一迁移清单后才可执行；默认 generic 行为永远不迁移。
  - 每次迁移 = runbook 化：source / destination / copy(rsync -a, no-clobber) /
    session artifact 策略 / memory cleanup（AMENDMENT Fix 1/2/3 规则）/
    MIGRATION_PREFLIGHT（source missing FAIL LOUD / dest non-empty ABORT）/
    verification(V1-V5) / BINDING_AUTHORITY_SWITCH_GATE（V1–V5 全过才改 bindings.json）/
    rollback —— 全部按 §ExistingOpenClawWorkspaceDataPolicy（含 AMENDMENT）执行。
  - 迁移结果（冻结目标行形态，与 product policy 一致）：
      1) feishu:oc_92332c45… → workspace 'oc_92332c45c1cac2ef89857abfee8ed762'
                             + activeSessionId 'main-oc_92332c45c1cac2ef89857abfee8ed762'
      2) feishu:oc_9dd74b9ed… → workspace 'oc_9dd74b9ed02ce216951260a381eb502d'
                             + activeSessionId 'main-oc_9dd74b9ed02ce216951260a381eb502d'
                          （若选择 artifact 迁移则沿用；否则在 new workspace 重建）
  - 本 Spec 不执行上述任何迁移（SPEC ONLY）。
```

---

## Router Layering（冻结：零产品分支）

```text
ROUTER_PRODUCT_SPECIAL_CASE = NONE（延续 AGENT_CORE_BINDING_WORKSPACE_V1）

Router 只机械执行 Binding{agentId, workspaceId, sessionId} 三元组：
  - resolveEffectiveWorkspace(binding)：workspace != null → resolveWorkspacePath(workspaceId)；
    null → resolveWorkspace(agentId)（LEGACY_GENERIC_FALLBACK）
  - onIngress → proc.turn(sessionId, text, { cwd: workspacePath })（per-session cwd）
  - deliver（DELIVERY_V0，无 ChannelConversation）→ agent default workspace（不变）
  - feishu-connector 的 conversationWorkspaceId / conversationMainSessionId 是
    product entry 代码；Router 只收不透明的 req.workspace / req.sessionId。
  - 是否/何时迁移某个 binding 属于 product entry + runbook，Router 不参与。
```

```text
AGENT_MEMORY_PRODUCT_SPECIAL_CASE = NONE
  - agent-memory 对 Feishu / conversationId / Binding 零感知；
    它只消费 session.header.cwd 并据此定位 MEMORY.md。
  - 没有任何 “if feishu / if conversation A” 分支进入 memory 组件。
```

---

## Acceptance Criteria（冻结 AC1–AC10）

```text
AC1 — 群 A / 私聊 B，same Agent，different Workspace → MEMORY.md different
    群 A（oc_92332c45…）workspace = oc_92332c45… → <root>/workspaces/oc_92332c45…
    私聊 B（oc_9dd74b9ed…）workspace = oc_9dd74b9ed… → <root>/workspaces/oc_9dd74b9ed…
    断言：两 workspaceId 不同、deterministic、稳定；
          A 的 MEMORY.md 与 B 的 MEMORY.md 是两个不同文件（物理隔离）。
    运行期断言（推理）：A session 的 memory_save/injection 只读写
          <root>/workspaces/oc_92332c45…/MEMORY.md；B 同理只读写自己的。

AC2 — B memory_save 唯一 marker → B 可读；A memory injection 不出现 marker
    私聊 B：memory_save(title=UNIQUE-MARKER-<ts>) → B 可 memory_search 读到。
    群 A：[memory] 注入块（及 memory_search）不出现 UNIQUE-MARKER。
    已污染存量：迁移 runbook 的 MIGRATION_MEMORY_CLEANUP 一次性归档 foreign-source 条目后，
    断言同样成立（V5）。

AC3 — A 普通文件不在 B 出现 → 保持现有 workspace isolation
    群 A 写文件 X → 私聊 B 的文件工具看不到 X（tool-fs 按 session.header.cwd 相对解析，
    既有行为；本 Spec 不回归该隔离）。

AC4 — 同 Workspace 的 main / cron / background Session → 共享同一 MEMORY.md
    同一 workspace W 下创建 main 与 cron/background session（header.cwd 均 = W）：
    任一 session memory_save → 同一 W/MEMORY.md；各自 [memory] 注入同一份。
    （cron 的 workspace 选择由 product entry 在 job 级显式携带；不携带 = agent default，
     兼容现行行为。memory 组件只保证“同 cwd ⇒ 同 MEMORY.md”。）

AC5 — restart/resume → Memory workspace 不漂移
    resume 恢复持久化 session header.cwd（R2 不传 meta:{cwd}）；
    memory 按 header.cwd 解析 ⇒ 重启/恢复后 memory 文件仍是同一 MEMORY.md。
    断言：resume 后 session A 的注入块与重启前一致（同 workspace）。

AC6 — Feishu 新 conversation → deterministic workspace = conversationId
    新群 oc_NEW → workspaceId = 'oc_NEW'；<root>/workspaces/oc_NEW
    （thread/sender scope → normalize 后单安全 component）；
    同一 conversation 每次 ingress 得到同一 workspaceId（deterministic）。

AC7 — legacy generic workspace=null fallback → 保持兼容
    任意 legacy binding（无 workspace 字段 / null）→ resolveWorkspace(agentId)，
    行为与现状完全一致（无强制迁移、无命名变化）。AC8 兼容。

AC8 — 被选中的 legacy Feishu production binding → 可显式迁移为 conversation workspace，
      migration 后不再 fallback 到 agent default workspace
    迁移前：feishu:oc_92332c45… workspace=null → effective cwd=agt_stock_agent。
    迁移（runbook）后：workspace='oc_92332c45…' → effective cwd=<root>/workspaces/oc_92332c45…；
    迁移后该 binding 的 turn 不再解析到 agt_stock_agent；
    generic 规则不变（其他 null 行照旧）。

AC9 — Router 无 Feishu special-case
    Router 源码无 if (channel==='feishu') 取 workspace / if App 分支；
    resolveEffectiveWorkspace 只读 binding{workspace, activeAgentId}；
    Feishu 的 conversationWorkspaceId 只存在于 feishu-connector / product entry。

AC10 — 一个 Agent 仍只有一个 DSH process
    agt_stock_agent 同时服务群 A / 私聊 B（多 session 多 cwd）→ registry 仍一条
    process 记录（agentId 键控）；无第二个进程 / Runtime Instance / Workspace Agent。

验证方式（implementation 轮）：
  - 单元：agent-memory（session-cwd→memoryFile 解析 + 隔离）、
    feishu-connector（conversationWorkspaceId bare 字面量 + scope normalize）、
    workspace-bootstrap（bare oc_* 通过 validation）
  - 集成（选中的既有 binding 或隔离测试 root）：AC1/AC2/AC5 用两个 conversation 双 session；
    AC4 用 main + cron 同 workspace；AC8/AC7 用 bindings.json 前后对比；
    AC9 用 Router 源码 grep（无分支）；AC10 用 registrySnapshot 单进程断言。
```

---

## Scope（本 Spec 授权给 Implementation 的边界）

```text
IMPLEMENTATION_SCOPE（下一轮，需本 Spec accepted 后执行）
  - agent-memory：workspace/memoryFile 从 mount-time agentId 推导
    → operation-time session.header.cwd（tools / injection / consolidation 三 seam；
    header 缺失 fallback = process cwd；保留显式 memoryFile override）
  - feishu-connector：conversationWorkspaceId 字面量 → bare conversationId
    （thread/sender scope 复用 normalize）；conversationMainSessionId 不变
  - 一次性显式 migration runbook（§ExistingOpenClawWorkspaceDataPolicy +
    §LegacyBindingMigration），只迁移选中白名单 binding（本轮冻结 2 条）
  - workspace-bootstrap：确认 bare oc_* 文案/测试用例对齐（valid id 语义不变；
    例值可增补 bare oc_*）—— 纯测试/注释层，无行为变化
  - AC1–AC10 验收断言 + 对应单测/集成

NOT_CHANGED
  - binding-store / router 领域逻辑（三元组机械执行不变；不新增 workspace 推导）
  - demo-server session-seam（R1/R2/R3、SESSION_WORKSPACE_MISMATCH 不变）
  - scheduler 核心 / scheduler-router 域逻辑（cron workspace 选项为 product entry 后续，
    本 Spec 不强迫）；deliver() agent-default 行为不变
  - agent-definition schema（不加 defaultWorkspaceId）
  - DSH kernel（KERNEL_CHANGE = NONE）
```

## Non-Goals（Out of Scope）

```text
AGENT_GLOBAL_MEMORY_LAYER    = OUT_OF_SCOPE（V1 不建第二层 global memory）
SEMANTIC_MEMORY_REDESIGN     = OUT_OF_SCOPE
MEMORY_EMBEDDING_VECTOR_DB   = OUT_OF_SCOPE
MEMORY_RANKING               = OUT_OF_SCOPE
MEMORY_SUMMARIZATION_REDESIGN = OUT_OF_SCOPE
MEMORY_CROSS_CONVERSATION_CLEANUP_AT_RUNTIME = OUT_OF_SCOPE（仅 migration runbook 一次性）

LARK_UX                      = OUT_OF_SCOPE
AUTH / BROKER / FORUM        = OUT_OF_SCOPE
SCHEDULER_REDESIGN           = OUT_OF_SCOPE
ROUTER_REWRITE               = OUT_OF_SCOPE（Router 零 product 分支保持）
AGENT_DEFINITION_SCHEMA_EXPANSION = OUT_OF_SCOPE
WORKSPACE_REGISTRY           = OUT_OF_SCOPE（不建设）
CONFIG_WORKSPACE_MAP         = OUT_OF_SCOPE（已否决，不复活）
KERNEL_CHANGE                = NONE
WORKSPACE_ARTIFACT_AUTO_MIGRATION = OUT_OF_SCOPE（migration 必须显式 runbook，绝不自动）
```

---

## Alternatives considered

- **保留 'feishu-' / 'workspace-' 命名空间前缀**：证据显示既无 code 依赖、accepted Spec
  明确不冻结字面量、bare oc_* 通过 validation —— 采纳 Product Owner 的
  FEISHU_WORKSPACE_ID = conversationId；namespace 由 <workspacesRoot>/ 目录承担。
  保留选项仅作为「未来出现 agentId==oc_* 碰撞时」的 revisit 触发（§Risks）。
- **记忆做 conversation-level 双 key（agentId + conversationId）**：否决 —— 那要求
  agent-memory 理解 conversation，违反最薄 seam；workspace 单一 key 已全覆盖
  （conversation workspace 天然 conversation 隔离；agent default workspace 天然 agent 隔离）。
- **在 Router 内把 cron/deliver 映射到 binding workspace**：否决 —— Router 无产品分支；
  cron workspace 选择属 product entry（job 级提示），deliver() agent-default 保持兼容。
- **迁移时移动（move）workspace 数据而非 copy**：否决 —— source 在 rollback 窗口内必须
  保留；agt_stock_agent 同时是 agent default workspace（cron/DELIVERY_V0 落点），
  移动会破坏其语义。冻结 COPY。
- **运行期自动清理跨 conversation 的 MEMORY.md 条目**：否决 —— 数据卫生只在一次性
  migration runbook 执行；runtime 不做跨 conversation 理解。
- **Agent-global durable profile / knowledge（V1 建设）**：否决 —— V1 冻结
  MEMORY_OWNERSHIP=WORKSPACE_LOCAL，第二层留给未来独立 Spec。

---

## Risks

```text
- 共享 workspace 根空间：<root>/workspaces 同时承载 agent default 与 conversation
  workspace；当前靠 id 约定不相交（agt_*/名称 vs oc_<32hex>）。
  若未来 authored agent id 撞上 oc_* 形态 → 必须显式 revisit 命名（新增 namespace 或
  agent-default 独立根），不由本命名静默处理。
- session artifact 搬运（私聊选项）：搬移 sessions/<cwd>/… 并改写 header.cwd 是 admin
  数据迁移，风险 = 绝对路径引用断裂 / artifact 损坏。缓解：迁移前备份、no-clobber、
  V1-V5 验证、rollback 在窗口内可用；或放弃搬运走 R3 路径重建 session（二选一显式记录）。
- 已污染存量 memory：copy 会原样带入私聊条目。缓解：MIGRATION_MEMORY_CLEANUP 一次性
  归档 foreign-source 条目（runbook 专用）。
- cron 与 conversation workspace 漂移：迁移后 cron（DELIVERY_V0，agent default）不再
  与群 conversation workspace 共享 MEMORY.md。缓解：AC4 冻结 memory 按 workspace 共享的
  模型；cron 需要共享时由 product entry 在 job 级显式携带 workspace（未来项，不影响本
  Spec 的 memory 模型正确性）；当前生产 cron 目标群（oc_0480991b…）尚未进入 Agent Core
  binding，其 cutover 会按 §ExistingOpenClawWorkspaceDataPolicy 显式规划。
- 测试例值漂移：workspace-id.test.js 以 'feishu-oc_…' 为例值 —— 纯测试文本，随
  implementation 轮增补 bare oc_* 例值；行为（validation 规则）不变。
```

---

## Related Evidence

```text
- 生产运行时实证（2026-08-17）：
    ~/.agent-core/bindings/bindings.json（两条 binding 行，workspace null / feishu- 字面量）
    ~/.agent-core/homes/agt_stock_agent/sessions/（session header.cwd 实证）
    ~/.agent-core/workspaces/agt_stock_agent/MEMORY.md（私聊条目泄漏实证）
    ~/.openclaw/groups/workspace-oc_0480991b… /（OpenClaw 生产群工作目录）
    ~/.agent-core/workspaces/feishu-oc_9dd74b9ed…/（canary-r2-isolation-marker.txt）
- AGENT_CORE_BINDING_WORKSPACE_V1（accepted，docs/specs/）：本 Spec 的产品 policy
  字面量澄清 + memory ownership 扩展；其 821 行证据/契约全部延续
- docs/investigations/test-agent-feishu-product-semantics-v1.md（PASS）
- docs/investigations/AGENT_CORE_MEMORY_EVOLUTION_PLUGIN_AUDIT_V1.md
- docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md（D-002）、BINDING_AND_SWITCH_V1.md（D-004）
- DSH harness（只读证据）：packages/core/agent-loop/src/{index,agent}.ts、
    packages/context/agent-instructions/src/index.ts、packages/fs/tool-fs/src/session-cwd.ts
- Agent Core 源码：packages/agent-memory/src/{index,paths,memory}.js、
    packages/feishu-connector/src/core.js、packages/agent-router/src/{index,process}.js、
    packages/demo-server/src/{index,session-seam}.js、packages/workspace-bootstrap/src/{index,paths}.js、
    packages/scheduler-router/src/index.js、packages/production-runtime/src/{compose,paths}.js
```

---

## Final Output

```text
FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1_SPEC = PASS
（生产实证 + 源码验证齐备：bare oc_* 通过 workspaceId validation、无 namespace
  invariant 依赖、memory 泄漏根因定位、session.header.cwd seam 全链路可用）

MEMORY_OWNERSHIP = WORKSPACE_LOCAL
CURRENT_MEMORY_KEY = agentId（agent-memory mount 时 resolveWorkspace(agentId) → memoryFile 冻结一次）
TARGET_MEMORY_KEY = effective workspace = session.header.cwd
  （每次 operation / injection assembly 从当前 session header.cwd 解析 memoryFile；
   header 缺失 fallback = process cwd；显式 memoryFile override 保留）

MEMORY_API_SEAM = Memory receives effective workspace/cwd
  - agent-memory 只消费 session.header.cwd（tools: exec.agent.session.header.cwd /
    injection: ctx.agent.session.header.cwd / consolidation: session.header.cwd）；
  - agent-memory 零感知 Feishu / conversationId / Binding / Router；
  - 纯层（resolveMemoryFile/consolidate/appendDailyNote/readDailyNotes/loadEntries…）
    已按 workspace/路径操作，唯一改动点 = plugin 的 mount-time agentId 解析

FEISHU_WORKSPACE_ID = conversationId（p2p/group：workspaceId=chatId（oc_*）；
  thread/sender：现 normalize 后单安全 component；conversationMainSessionId 不变）
OPENCLAW_WORKSPACE_ID_MODEL = workspace-oc_<chatId>（OpenClaw 每 conversation/peer 一个
  工作目录，chat id 即 identity，带 workspace- 类前缀；Agent Core 用 bare conversationId，
  类语义由 <workspacesRoot>/ 目录承担）

LEGACY_GENERIC_FALLBACK = KEEP（workspace=null → resolveWorkspace(agentId)，所有 generic
  legacy binding 完全不变）
FEISHU_LEGACY_BINDING_MIGRATION = ONE_TIME_EXPLICIT（只迁移显式白名单 Feishu production
  bindings；本轮冻结 2 条：feishu:oc_92332c45…（null→oc_92332c45…）、
  feishu:oc_9dd74b9ed…（feishu-oc_9dd74…→oc_9dd74…）；runbook 化，绝不自动）

EXISTING_WORKSPACE_DATA_MIGRATION = DEFINED / NOT_EXECUTED（COPY 优先，禁止空目录：
  source/destination 显式、rsync -a no-clobber、session artifact 二选一显式记录、
  memory entry 按 AMENDMENT PROVENANCE_KEEP_RULE 分类归档（KEEP iff provenance 证明
  effective workspace == target；unknown -> quarantine + MANUAL_REVIEW）、
  MIGRATION_PREFLIGHT（source missing FAIL LOUD / dest non-empty ABORT）、
  verification V1-V5、BINDING_AUTHORITY_SWITCH_GATE（V1–V5 全过才改 bindings.json）、
  rollback（先备份 bindings.json + workspace + artifact））

ROUTER_PRODUCT_SPECIAL_CASE = NONE
AGENT_MEMORY_PRODUCT_SPECIAL_CASE = NONE

AC1  = 群 A / 私聊 B，same Agent，不同 Workspace → 两个不同 MEMORY.md（物理隔离）
AC2  = B memory_save 唯一 marker → B 可读；A memory injection 不出现（存量由 runbook 清理）
AC3  = A 普通文件不进入 B（tool-fs session.header.cwd 隔离保持）
AC4  = 同 Workspace 的 main/cron/background Session 共享同一 MEMORY.md（memory 按
       workspace；cron workspace 选择是 product entry job 级事项，不强制）
AC5  = restart/resume → memory workspace 不漂移（resume 恢复持久化 header.cwd）
AC6  = Feishu 新 conversation → deterministic workspace = conversationId
AC7  = legacy generic workspace=null fallback 保持兼容（无强制迁移）
AC8  = 选中 legacy Feishu binding 显式迁移为 conversation workspace；迁移后不再 fallback
       到 agent default workspace
AC9  = Router 无 Feishu special-case（政策只在 feishu-connector / product entry）
AC10 = 一个 Agent 仍只有一个 DSH process

ARCHITECTURE_CHANGE = YES（memory ownership key 变更 + feishu workspaceId 字面量变更 +
  一次性显式 migration；不新增实体/registry/映射平台）
KERNEL_CHANGE = NONE

SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```

## Amendment Final Output（AMENDMENT — Migration Data Safety Closure）

```text
FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1_SPEC_AMENDMENT = PASS
（REQUIRED_FIX 1–3 + Migration Gate 全部冻结为唯一规则，无 NEEDS_MORE_EVIDENCE）

BASE_REVIEWED_HEAD = 4558b50
HEAD = <this amendment commit>

PROVENANCE_KEEP_RULE =
  KEEP iff provenance 能证明该 entry 所属 Session 的 effective workspace
  == target conversation workspace；否则 ARCHIVE/EXCLUDE。
  不允许 Implementation 自行判断“哪些应该复制”；
  判断依据 = 可核验的 session/provenance 信息（Source/metadata/header.cwd），
  不是内容语义。

UNKNOWN_PROVENANCE_POLICY =
  unknown / malformed / provenance 不足 -> MUST NOT 猜测归属
  -> ARCHIVE / MANUAL_REVIEW（quarantine），绝不写入 target MEMORY.md。
  默认 fail-safe：不能证明属于目标 workspace，就不能写进目标 MEMORY.md。

CRON_ENTRY_POLICY =
  cron / agent-default session entry：其 effective workspace != target
  conversation workspace 时，不得进入 target conversation MEMORY.md（ARCHIVE/EXCLUDE）。

FOREIGN_ENTRY_ARCHIVE_DESTINATION =
  能确定属于某已知 conversation workspace -> archive 到该 workspace 的
  migration archive / pending-restore 集合；无法安全确定 -> dedicated
  migration quarantine/archive（独立于所有 conversation workspace），
  不注入任何 conversation MEMORY.md + MANUAL_REVIEW。
  禁止为“保留数据”把 foreign entry 放进当前 group workspace 的可注入 MEMORY.md。

SOURCE_MIXED_MEMORY_DISPOSITION =
  迁移后旧 agt_stock_agent/MEMORY.md 不再作为任何 conversation 的 active
  memory source：backup/archive 封存（只读）；group / p2p Session 不再注入它。
  agent-default workspace 后续 cron/background Session 只消费属于
  agent-default workspace 自己的新 workspace-local MEMORY.md
  （按 WORKSPACE_LOCAL 由自身 header.cwd 解析），不消费历史混合文件。

MIGRATION_PREFLIGHT =
  source missing -> FAIL LOUD before write（不写任何目标）；
  destination non-empty -> ABORT before write（不覆盖/不合并/不静默继续）；
  不新增 migration framework（脚本 + runbook 形态）。

BINDING_AUTHORITY_SWITCH_GATE =
  bindings.json authority switch（workspace/activeSessionId 改迁移目标值）
  -> ONLY AFTER 全部 migration verification gates（V1–V5）PASS；
  任何 gate 失败 => 不切换 authority、保持旧 binding、走 rollback。

ARCHITECTURE_CHANGE = NONE_FROM_REVIEWED_DIRECTION
（AMENDMENT 只加规则，不引入新实体/registry/框架/映射平台；
 主模型方向与 reviewed HEAD 4558b50 完全一致，无架构变化）
KERNEL_CHANGE = NONE

边界保持：AUTO_MIGRATION = NO · selected Feishu bindings only ·
Workspace Registry NOT_INTRODUCED · global memory layer NOT_BUILT ·
Router rewrite NO · Scheduler redesign NO

SPEC_STATUS = proposed
READY_FOR_FOCUSED_RE_REVIEW = YES
```