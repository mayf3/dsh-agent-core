# AGENT_WORKSPACE_SESSION_MODEL_V2 — Agent / Workspace / Session / main 长期产品模型 Current Decision

- 状态: accepted（本决策是 V2 产品模型的 **Current Authority**；对旧 authority 的处置见
  §24 Disposition——未来 Agent 读这一份 + 被标记 PRESERVE 的旧文档即可知道 Current Truth）
- 日期: 2026-08-17
- 类型: 正式决策（**standalone Current Decision**，不是旧 Spec 的 amendment；不再给旧
  Spec 叠 amendment）
- 范围: 只改文档（PRODUCT_CODE_CHANGE = NONE / RUNTIME_CHANGE = NONE / MIGRATION = NONE /
  KERNEL_CHANGE = NONE）
- 关联: D-002 `AGENT_SESSION_CHANNEL_MODEL_V1.md`（PARTIALLY_SUPERSEDE）· D-004
  `BINDING_AND_SWITCH_V1.md`（PRESERVE）· D-003 `MEMORY_V1.md`（PRESERVE）·
  `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md`（PARTIALLY_SUPERSEDE，产品模型条款被本文档
  取代）· `FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd`（DO_NOT_ACCEPT / REPLACE_WITH_SMALLER_SPEC）

---

## 0. 一句话模型（Current Truth，standalone 起点）

```text
Feishu Conversation
→ first-seen creates one Agent
→ fixed association


Agent
→ stable agentId
→ one Workspace
→ one security domain
→ one canonical main logical slot


Workspace
→ long-lived Agent state
→ bootstrap AGENTS.md only
→ otherwise Agent-managed


Session
→ trajectory
→ all Sessions share Agent Workspace


main
→ human canonical logical slot
→ trajectory resettable


cron
→ fresh Session per execution


Agent-to-Agent
→ Session per task


Feishu
→ fixed Agent/main


Mobile
→ switchable activeAgent
→ always target Agent/main


Human Binding
→ activeAgent only


Security
→ principal / credential / grants belong to Agent
```

---

## 1. 为什么是 Current Decision，而不是 amendment

不继续在旧 Spec 上叠 amendment：

- 旧 authority 之间已经出现需要人工 merge 才能理解的产品模型分叉（D-002 的
  「Agent 固定拥有唯一 workspace」→ BINDING_WORKSPACE_V1 的「Binding 决定 effective
  workspace」→ FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 的「conversation workspace」）。
- 继续叠 amendment 只会让 Current Truth 更难找。
- 本文档把长期产品模型收敛成**一份 standalone Current Decision**，并对五份旧文档逐条给
  disposition（§24），使未来 Agent 不必自己把五份文档 merge 才能知道「现在是什么模型」。

本文档只冻结产品模型。所有机制细节 / 迁移 / 实现授权留给后续 Implementation Specs（§25）。

---

## 2. Feishu Conversation → Agent

当前产品模型：

```text
ONE_FEISHU_CONVERSATION_ONE_AGENT = YES
one Feishu conversation
→ one long-lived Agent
→ one Workspace
→ one canonical main

P2P_SPECIAL_CASE = NONE
GROUP_SPECIAL_CASE = NONE

私聊和群聊在 Agent Core 模型中没有区别。
它们只是不同的 Feishu conversation identity。

FEISHU_BINDING = FIXED
一个 Agent 当前必须有一个固定 Feishu conversation 作为 creation/binding anchor。

AGENT_REBIND     = OUT_OF_SCOPE   # 不考虑 Agent 迁移到另一个飞书群
AGENT_RETIREMENT = OUT_OF_SCOPE   # 不考虑 Agent 删除/退休
AUTO_DELETE_AGENT = NO
```

---

## 3. Agent 自动出生

Agent Core 第一次看到一个此前不存在的 Feishu conversation identity 时：

```text
FEISHU_FIRST_CONTACT_AUTO_CREATES_AGENT = YES

first seen Feishu conversation
→ create Agent
→ create Workspace
→ seed AGENTS.md
→ provision principal
→ provision credential
→ assign standard baseline grants
→ establish canonical main
→ fixed-bind conversation to Agent

第一条消息应该能够直接进入新 Agent 的 main。
```

Agent Core 不负责创建飞书群/私聊。新 Feishu conversation 可以来自：

- 人手动创建
- Agent 调 Feishu API 创建
- 其他外部系统创建

Agent Core 不关心来源，它只响应 `FIRST_SEEN_FEISHU_CONVERSATION`：

```text
CREATE_AGENT_CORE_PRIMITIVE = NOT_REQUIRED          # 不需要显式 create-agent 产品入口
FEISHU_CONVERSATION_CREATION = OUTSIDE_AGENT_CORE
```

---

## 4. Agent identity

```text
AGENT_ID = 独立稳定的不透明 id（agentId）
AGENT_ID != FEISHU_CONVERSATION_ID

Feishu conversationId 只是创建/固定绑定 anchor，不是 Agent 身份。
Scheduler / Broker / Mobile / Agent-to-Agent 等内部系统
都应该使用 channel-independent agentId。
```

---

## 5. One Agent = One Workspace

长期产品 invariant：

```text
ONE_AGENT_ONE_WORKSPACE = YES

Agent 的长期状态主要存在于自己的 Workspace：

Workspace/
├── AGENTS.md
├── MEMORY.md      # optional / lazy
└── arbitrary files/directories

NEW_AGENT_WORKSPACE_BOOTSTRAP = AGENTS_MD_ONLY
MEMORY_MD_CREATION = LAZY
OTHER_FILES = LAZY
PRECREATE_FILES_DIRECTORY = NO      # 不规定 files/ 目录

Workspace 内部怎么组织，交给 Agent 自己。
```

---

## 6. AGENTS.md 属于 Agent 自己

```text
AGENTS_MD_MUTABLE_BY_AGENT = YES

Agent 可以自己 read / edit / rewrite / evolve AGENTS.md。
不需要 Kernel approval、Router approval、special AGENTS.md gate。

Agent Workspace 原则上就是 Agent 自己管理的长期工作环境。
```

---

## 7. Session

```text
SESSION = ONE TRAJECTORY（一次对话/任务的轨迹）

一个 Agent 可以同时存在：
  main
  cron-run-*
  agent-task-*
  background-*

所有 Session：
  same Agent
  same Workspace
  same security domain
  same tools/capabilities

SESSION_ISOLATION = TRAJECTORY_ONLY

non-main 不是 sandbox，也不是低权限 Session。
```

---

## 8. Main 是 logical slot

```text
每个 Agent 正常只有一个 canonical main。

MAIN_SESSION_IDENTITY = LOGICAL_SLOT
NATIVE_DSH_SESSION_ID = IMPLEMENTATION_DETAIL

main = Agent 面向人类长期交流的 canonical logical slot，
       不是某一个永久不变的 native DSH Session。

多个人类 Product Surface 如果当前都访问 same Agent / main
→ 共享同一条 current main trajectory。
```

---

## 9. Main 可以 reset

```text
MAIN_SESSION_LIFETIME = RESETTABLE
AGENT_LIFETIME        = LONG_LIVED
WORKSPACE_LIFETIME    = LONG_LIVED

例如可以保留当前 OpenClaw 类似的：每日凌晨 reset main。

产品语义：
  retire / clear current main trajectory
  → start fresh trajectory behind same logical main

保持：same Agent / same Workspace / same AGENTS.md / same MEMORY.md /
      same files / same logical main

RESET_CLEARS_WORKSPACE = NO
MAIN_RESET_CHANGES_BINDING = NO
MAIN_RESET_SCOPE = MAIN_ONLY

non-main Session 不受 main reset 影响。
长期 continuity 属于 Agent + Workspace，而不是某一条 Session trajectory。
```

本轮**不决定**（见 §25）：

- native DSH Session ID 是否复用
- old trajectory archive/delete
- reset scheduler
- reset policy persistence
- OpenClaw reset migration
- reset 前是否做 memory consolidation

---

## 10. Cron Session

```text
CRON_SESSION_SCOPE = PER_EXECUTION
CRON_SESSION_REUSE = NO

每次 cron execution → fresh non-main Session。
但仍然使用同一个 Agent Workspace 和 security domain。
```

---

## 11. Agent-to-Agent Session

```text
AGENT_TO_AGENT_SESSION_SCOPE = PER_TASK
LONG_LIVED_PAIR_SESSION = NO
MULTI_TURN_WITHIN_TASK = YES

Agent A 找 Agent B 做事：
  one task / delegation → one B non-main Session
同一 task 内允许多轮持续。
不建立永久 Agent A ↔ Agent B pair session。
session 生命周期/超时以后再定。
```

---

## 12. Non-main 不 merge 回 main

```text
NON_MAIN_TRAJECTORY_MERGE_INTO_MAIN = NO

cron / agent-task 的原始上下文不塞回 main。

跨 Session continuity 来自：
  MEMORY.md
  Workspace files
  explicit task result

即：Session 共享脑子和工作台，但不共享聊天记录。
```

---

## 13. 所有 Session 都能贡献长期 Memory

```text
MAIN_CAN_UPDATE_MEMORY      = YES
CRON_CAN_UPDATE_MEMORY      = YES
AGENT_TASK_CAN_UPDATE_MEMORY = YES

所有 Session 都可以读写：
  AGENTS.md
  MEMORY.md
  arbitrary Workspace files

但具体：
  什么时候 consolidation
  什么值得写入 MEMORY.md
  谁负责总结
属于后续 Agent/plugin policy，不属于 V2 identity model。
```

---

## 14. Human Product Surface

```text
人类入口永远进入：
  selected/bound Agent
  → canonical main

Human Product Surface 不绑定 cron/task Session。

因此长期模型：
  HUMAN_PRODUCT_SURFACE_BINDING = activeAgent only

不需要 activeWorkspace、activeSessionId，因为：
  Workspace     = Agent 唯一决定
  Human Session = canonical main
```

---

## 15. Feishu 与 Mobile 的区别

```text
Feishu:
  FEISHU_BINDING = FIXED
  conversation A → Agent A → Agent A/main
  Feishu 不允许动态切到另一个 Agent。

Mobile:
  MOBILE_BINDING = SWITCHABLE
  Mobile 只访问已有 Agent，不创建 Agent。
  MOBILE_CAN_CREATE_AGENT = NO
  MOBILE_CAN_SELECT_EXISTING_AGENT = YES
```

---

## 16. Mobile switch_agent

用户可以在 Mobile 当前和 Secretary Agent 聊：“切到股票 Agent”。

```text
当前 Agent 调：agent_core.switch_agent(stock-agent)

然后：
  backend / Router → 更新该 Mobile Surface activeAgent
  → 通知前端 → 前端自动切换
  → 下一条消息进入 Stock Agent/main

用户不需要手动操作 UI。

switch_agent 不是「当前 Agent 角色扮演成另一个 Agent」，
而是「修改当前 switchable Product Surface 的 activeAgent」。
```

---

## 17. switch_agent scope

```text
SWITCHABLE_PRODUCT_SURFACE_SCOPED

Mobile main        = ALLOWED
Feishu main        = NOT_ALLOWED
cron Session       = NOT_ALLOWED
agent-task Session = NOT_ALLOWED

原因不是权限高低，而是只有 Mobile 这类 Surface
有「当前选择哪个 Agent」的状态。
```

---

## 18. Switch-away / switch-back

```text
Mobile 从 Agent A 切到 B：
  DOES_NOT_RESET_A_MAIN

再切回 A：
  → resume Agent A current canonical main

如果期间发生 daily main reset：
  → 返回 reset 后的新 current main trajectory
```

---

## 19. Security domain

```text
AGENT_SECURITY_DOMAIN = Agent

属于 Agent：
  principal
  credential
  grants

不属于：
  Session
  Feishu conversation
  Mobile Surface
  Binding

main / cron / agent-task 默认都使用同一个 Agent security identity。
```

---

## 20. Agent birth security

```text
AGENT_BIRTH → COMPLETE_SECURITY_DOMAIN

Agent 出生时立即：
  ensure principal
  ensure credential
  assign standard baseline grant profile

baseline grants 存在，但 V2 不列任何具体 forum.* / workflow.* / broker.* scope。
具体 baseline profile 留给 Auth / Provisioning Spec。
```

---

## 21. Mechanism capability != Product model

必须明确冻结：

```text
MECHANISM_CAPABILITY != PRODUCT_MODEL

当前已经跑通的 Canary（same stock-agent → group workspace → p2p workspace）
重新分类为：TRANSITIONAL_COMPATIBILITY_EVIDENCE

它证明 multi-workspace-per-agent 的底层机制能工作。
它不证明 multi-workspace-per-agent 应该成为长期产品模型。

长期模型仍然：ONE_AGENT_ONE_WORKSPACE
```

---

## 22. Binding.workspace

当前代码已有 `Binding.workspace`，本轮 disposition：

```text
BINDING_WORKSPACE_TRANSITIONAL = TRANSITIONAL_COMPATIBILITY_FIELD
LONG_TERM_PRODUCT_AUTHORITY = NO

即使底层技术上允许 Binding.workspace != Agent.primaryWorkspace，
也不代表正常产品路径应该这么用。

DO_NOT_REMOVE_CODE
DO_NOT_MIGRATE
DO_NOT_BREAK_CANARY

是否以后删除/保留 internal escape hatch，由后续 Implementation Spec 判断。
```

---

## 23. FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd

```text
DISPOSITION = DO_NOT_ACCEPT
              DO_NOT_MERGE

其中已经正确冻结的、保留的产品判断：
  HISTORICAL_MIXED_MEMORY_MIGRATION = NONE
  OLD_MIXED_MEMORY = ARCHIVE_ONLY

但该 Spec 仍建立在「same Agent → per-conversation Workspace」的旧产品模型上。

V2 完成后判断：PRESERVE / SUPERSEDE / REPLACE_WITH_SMALLER_SPEC
当前优先方向：REPLACE_WITH_SMALLER_SPEC

不继续在 6071dfd 上叠 amendment。
```

---

## 24. 重新梳理旧 Authority — Disposition

对以下文档逐一明确 PRESERVE / PARTIALLY_SUPERSEDE / SUPERSEDE。重点不是删历史，
而是让未来 Agent 不需要把五份文档 merge 才能知道 Current Truth。

### 24.1 D-002 `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`

```text
D002_DISPOSITION = PARTIALLY_SUPERSEDE

PRESERVE（原语义不变）：
  - Agent 是长期实体（与 Channel 无关）
  - Session 属于 Agent；Channel 只是 Channel / UI，不拥有 Agent / Session
  - Binding 实体；switchAgent = 只改绑定，不是角色扮演
  - resolveChannelConversation 幂等落地入口（渠道只有原生标识时一步拿到
    ChannelConversation + Binding）
  - channel-agnostic API 契约、main 长期主会话概念、Message 作为 API 数据类型
  - DSH_HOME / credential / memory 归属 Agent（见 §19/§5 的 V2 重申）

SUPERSEDE（以本文档为准）：
  - 「Agent 固定拥有唯一/自己的 workspace」条款
    （BINDING_WORKSPACE_V1 已 supersede 该条款；本文档以产品模型口径重新冻结
    ONE_AGENT_ONE_WORKSPACE，见 §24.4）
  - 「任意 ChannelConversation 均可 switchAgent 到任意 Agent」的通用切换语义
    （本文档 §15/§17：Feishu = FIXED、Mobile = SWITCHABLE，switch_agent 限定在
    switchable Product Surface）
  - Binding.activeSessionId 作为人类入口状态
    （本文档 §8/§14：人类入口只有 activeAgent，Session = canonical main logical slot；
    activeSessionId 降为实现细节）
```

### 24.2 D-004 `docs/decisions/BINDING_AND_SWITCH_V1.md`

```text
BINDING_AND_SWITCH_V1_DISPOSITION = PRESERVE

机制层全部保留：
  - Binding owner = Router / Control Plane（唯一 owner）
  - switchAgent 唯一原语（Registry 校验 / Router 选 Session / 更新持久化 Binding）
  - 原子 JSON 单文档持久化（tmp+rename、fail-loud）
  - per-Agent turn single-flight
  - DSH switch tool = 纯 adapter（agent_core.switch_agent）

本文档在其上新增的只是产品入口层的 scope 规则（§16/§17），不改变任何机制。
```

### 24.3 D-003 `docs/decisions/MEMORY_V1.md`

```text
MEMORY_V1_DISPOSITION = PRESERVE

内容保留：
  - file-first 记忆：MEMORY.md（curated）+ memory/YYYY-MM-DD.md（episodic）
  - 隔离 = 物理目录隔离（per-agent workspace），无全局库
  - consolidation 时机 = turn/end + 防抖 + 显式工具/服务
  - file-first 人工查看/编辑/删除（人工优先）

V2 语境对齐：
  - MEMORY.md 属于 Agent Workspace（ONE_AGENT_ONE_WORKSPACE 下天然 agent-scoped，
    所有 Session 共享同一份，见 §5/§13）
  - MEMORY.md creation = LAZY（§5）
  - 所有 Session 都能读写（§13）
```

### 24.4 `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md`（accepted Spec）

```text
BINDING_WORKSPACE_V1_DISPOSITION = PARTIALLY_SUPERSEDE

PRESERVE（机制级 invariant，保持有效）：
  - SESSION_WRITE_CONTRACT R1/R2/R3：session cwd 在创建时冻结、resume 恢复持久化
    header、cross-workspace mismatch 结构化拒绝（绝不静默改 cwd）
  - workspaceId validation（复用 sanitize 同构 safe-id helper；非法 -> 结构化 reject）
  - Router 零产品分支（ROUTER_PRODUCT_SPECIAL_CASE = NONE；只机械执行
    Binding{agentId, workspaceId, sessionId} 三元组）
  - ONE_AGENT_ONE_PROCESS 保持（registry 按 agentId；多 workspace 在多 session 内）
  - APP_AGENT_SWITCH → target Agent 的 default workspace
    （与本文档 §15/§16 的 Mobile 模型一致：切 Agent 即到该 Agent 的 Workspace）

SUPERSEDE（产品模型条款，以本文档为准）：
  - FEISHU_WORKSPACE_POLICY「每个 Feishu conversation → 独立 workspaceId」
    —— 被本文档 ONE_AGENT_ONE_WORKSPACE + FEISHU_BINDING = FIXED 代替（§2/§5）
  - 「Agent identity does NOT uniquely determine Workspace」作为产品 invariant
    —— 产品模型回到 ONE_AGENT_ONE_WORKSPACE（§5/§21）；
    底层机制能力保留为 transitional 证据，不承担产品 authority（§21/§22）
  - Binding.workspace 从 product authority 降级为
    TRANSITIONAL_COMPATIBILITY_FIELD（§22）
```

### 24.5 `FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd`（proposed Spec，未 accepted）

```text
FEISHU_MEMORY_SPEC_DISPOSITION = DO_NOT_ACCEPT / DO_NOT_MERGE
                                → 方向 = REPLACE_WITH_SMALLER_SPEC

保留其中两个已正确冻结的产品判断（不带入旧产品模型）：
  - HISTORICAL_MIXED_MEMORY_MIGRATION = NONE
  - OLD_MIXED_MEMORY = ARCHIVE_ONLY

不保留：其「same Agent → per-conversation Workspace」的建模前提
（与本文档 ONE_AGENT_ONE_WORKSPACE 冲突，见 §23/§21）。

处置路径：V2 完成后按 REPLACE_WITH_SMALLER_SPEC 优先方向，由后续 Spec 把仍需要
的小判断（如 OLD_MIXED_MEMORY = ARCHIVE_ONLY）吸收进更小文档；不继续在 6071dfd
上叠 amendment。
```

---

## 25. 本轮明确不解决（留给后续 Implementation Specs）

以下全部**不决定**，不得用 implementation detail 制造新产品决策：

```text
- native DSH Session ID mapping
- daily reset scheduler
- trajectory archive/delete
- reset config persistence
- Agent-to-Agent Session GC
- agentId generation algorithm
- Feishu ID mapping storage format
- credential storage mechanism
- exact baseline grants
- Mobile push/WebSocket protocol
- Binding.workspace removal implementation
- old Canary migration
- OpenClaw migration mechanics
```

---

## Final Output

```text
AGENT_WORKSPACE_SESSION_MODEL_V2 = PASS

LONG_TERM_MODEL =
  ONE_FEISHU_CONVERSATION_ONE_AGENT = YES（P2P/GROUP 无区别；FEISHU_BINDING = FIXED；
    AGENT_REBIND / AGENT_RETIREMENT = OUT_OF_SCOPE；AUTO_DELETE_AGENT = NO）
  ONE_AGENT_ONE_WORKSPACE = YES
  AGENT_CREATION_TRIGGER = FIRST_SEEN_FEISHU_CONVERSATION（auto-create；
    CREATE_AGENT_CORE_PRIMITIVE = NOT_REQUIRED；
    FEISHU_CONVERSATION_CREATION = OUTSIDE_AGENT_CORE）
  WORKSPACE_BOOTSTRAP = AGENTS_MD_ONLY（MEMORY.md / other files = LAZY；
    PRECREATE_FILES_DIRECTORY = NO）
  AGENTS_MD_OWNERSHIP = AGENT（AGENTS_MD_MUTABLE_BY_AGENT = YES；
    无 Kernel/Router approval gate）
  MAIN_LOGICAL_SLOT = YES（MAIN_SESSION_IDENTITY = LOGICAL_SLOT；
    NATIVE_DSH_SESSION_ID = IMPLEMENTATION_DETAIL）
  MAIN_RESET_MODEL = RESETTABLE（MAIN_ONLY；RESET_CLEARS_WORKSPACE = NO；
    MAIN_RESET_CHANGES_BINDING = NO；Agent/Workspace = LONG_LIVED）
  CRON_SESSION_MODEL = PER_EXECUTION（fresh non-main Session；CRON_SESSION_REUSE = NO）
  AGENT_TO_AGENT_SESSION_MODEL = PER_TASK（MULTI_TURN_WITHIN_TASK = YES；
    LONG_LIVED_PAIR_SESSION = NO）
  CROSS_SESSION_CONTINUITY = WORKSPACE + MEMORY（MEMORY.md / files /
    explicit task result；NON_MAIN_TRAJECTORY_MERGE_INTO_MAIN = NO；
    MAIN/CRON/AGENT_TASK 均可更新 memory）
  FEISHU_BINDING_MODEL = FIXED（conversation -> Agent -> Agent/main）
  MOBILE_BINDING_MODEL = SWITCHABLE（MOBILE_CAN_CREATE_AGENT = NO；
    MOBILE_CAN_SELECT_EXISTING_AGENT = YES；切回 = resume current canonical main）
  SWITCH_AGENT_SCOPE = SWITCHABLE_PRODUCT_SURFACE_SCOPED
    （Mobile main = ALLOWED；Feishu main / cron / agent-task = NOT_ALLOWED）
  SECURITY_DOMAIN = AGENT（principal / credential / grants 属 Agent，不属
    Session/conversation/Mobile Surface/Binding；HUMAN_PRODUCT_SURFACE_BINDING =
    activeAgent only）
  AGENT_BIRTH_PROVISIONING = COMPLETE_SECURITY_DOMAIN（ensure principal +
    credential + baseline grant profile；具体 scope 留给 Auth/Provisioning Spec）
  MECHANISM_CAPABILITY_VS_PRODUCT_MODEL = DISTINCT（冻结 !=）
  CANARY_CLASSIFICATION = TRANSITIONAL_COMPATIBILITY_EVIDENCE
  BINDING_WORKSPACE_DISPOSITION = TRANSITIONAL_COMPATIBILITY_FIELD
    （LONG_TERM_PRODUCT_AUTHORITY = NO；DO_NOT_REMOVE_CODE / DO_NOT_MIGRATE /
      DO_NOT_BREAK_CANARY）

  D002_DISPOSITION             = PARTIALLY_SUPERSEDE
  BINDING_AND_SWITCH_V1_DISPOSITION = PRESERVE
  MEMORY_V1_DISPOSITION        = PRESERVE
  BINDING_WORKSPACE_V1_DISPOSITION = PARTIALLY_SUPERSEDE（机制保留；
      产品模型条款被本文档取代）
  FEISHU_MEMORY_SPEC_DISPOSITION  = DO_NOT_ACCEPT / DO_NOT_MERGE
      → REPLACE_WITH_SMALLER_SPEC（保留 HISTORICAL_MIXED_MEMORY_MIGRATION = NONE +
        OLD_MIXED_MEMORY = ARCHIVE_ONLY 两个产品判断）

  OWNER_DECISIONS_STILL_REQUIRED = NONE
    （V2 已把长期产品模型收敛完整；§25 的推迟项均为 Implementation/Operational 级，
      不构成产品模型决策缺口）

PRODUCT_CODE_CHANGE = NONE
RUNTIME_CHANGE      = NONE
MIGRATION           = NONE
KERNEL_CHANGE       = NONE
```