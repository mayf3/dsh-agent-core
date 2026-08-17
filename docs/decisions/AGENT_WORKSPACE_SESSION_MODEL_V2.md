# AGENT_WORKSPACE_SESSION_MODEL_V2 — Agent / Workspace / Session / main 长期产品模型 Current Decision

- 状态: accepted（本决策是 V2 产品模型的 **Current Authority**；对旧 authority 的处置见
  §24 Disposition——未来 Agent 读这一份 + 被标记 PRESERVE 的旧文档即可知道 Current Truth）
- 日期: 2026-08-17
- 类型: 正式决策（**standalone Current Decision**，不是旧 Spec 的 amendment；不再给旧
  Spec 叠 amendment）
- 范围: 只改文档（PRODUCT_CODE_CHANGE = NONE / RUNTIME_CHANGE = NONE / MIGRATION = NONE /
  KERNEL_CHANGE = NONE）
- 关联: D-002 `AGENT_SESSION_CHANNEL_MODEL_V1.md`（PARTIALLY_SUPERSEDE）· D-004
  `BINDING_AND_SWITCH_V1.md`（PARTIALLY_SUPERSEDE）· D-003 `MEMORY_V1.md`
  （PARTIALLY_SUPERSEDE）·
  `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md`（PARTIALLY_SUPERSEDE，产品模型条款被本文档
  取代）· `FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd`（DO_NOT_ACCEPT / REPLACE_WITH_SMALLER_SPEC）

---

## 0. 一句话模型（Current Truth，standalone 起点）

```text
Feishu Conversation
→ first eligible human message creates one Agent
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

## 3. Agent 自动出生（trigger = FIRST_ELIGIBLE_HUMAN_MESSAGE）

Agent Core **看到 Feishu event 不等于创建 Agent**。创建条件冻结为：

```text
AGENT_CREATION_TRIGGER = FIRST_ELIGIBLE_HUMAN_MESSAGE

只有 transport 已判断「这条真人消息是在和 bot 说话」，
才进入：
  conversation lookup
  → Agent absent
  → create Agent
```

即：

```text
TRANSPORT_INGRESS_ELIGIBILITY
precedes
AGENT_CREATION
```

eligibility 判定示例（transport 层职责，不属于 Agent Core 模型特例）：

```text
p2p 第一条真人消息
  → eligible → create Agent

group 默认 requireMention=true：
  普通未 @ 消息 → NOT eligible → drop，NO Agent creation
  第一次 @ bot  → eligible → create Agent

explicitly configured no-mention group：
  第一条符合 ingress policy 的真人消息 → eligible → create Agent
```

Agent 出生流程（触发后；provisioning 步为**非阻塞启动**，见 §20）：

```text
FEISHU_FIRST_CONTACT_AUTO_CREATES_AGENT = YES

first eligible human message
→ create Agent
→ create Workspace
→ seed AGENTS.md
→ begin external capability provisioning（非阻塞，见 §20）
→ establish canonical main
→ fixed-bind conversation to Agent

第一条消息应该能够直接进入新 Agent 的 main（AGENT_CHAT_READY，见 §20）。
```

Agent Core 不负责创建飞书群/私聊。新 Feishu conversation 可以来自：

- 人手动创建
- Agent 调 Feishu API 创建
- 其他外部系统创建

Agent Core 不关心来源，它只响应 `FIRST_ELIGIBLE_HUMAN_MESSAGE`：

```text
CREATE_AGENT_CORE_PRIMITIVE = NOT_REQUIRED          # 不需要显式 create-agent 产品入口
FEISHU_CONVERSATION_CREATION = OUTSIDE_AGENT_CORE

与 §2 的关系：p2p / group 的 mention / eligibility 规则属于 transport 的 ingress
判定，不是 Agent Core 模型中的 p2p/group 特例 —— Agent Core 对已 eligible 的
p2p / group 仍然一视同仁（P2P_SPECIAL_CASE = NONE / GROUP_SPECIAL_CASE = NONE，§2）。
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

## 20. Agent birth — 安全 / 能力 readiness（不阻塞聊天）

撤销「Agent 必须等 principal / credential / grant 全部成功才可聊天」的模型：

```text
AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO

AGENT_CHAT_READY =
  stable agentId
  + Workspace
  + AGENTS.md
  + canonical main/runtime ready

达到以上条件后，第一条 Feishu 消息即可正常进入 Agent
（触发流程见 §3）。

EXTERNAL_CAPABILITY_READINESS =
  principal
  + credential
  + baseline grants
```

external capability provisioning 独立进行（出生时启动、不阻塞聊天）：

```text
ensure principal
→ ensure credential
→ ensure standard baseline grants

如果失败：
  Agent 仍可聊天（DOES_NOT_BLOCK_CHAT）
  Agent 仍可操作 Workspace / 本地能力
  受影响 Broker capability = unavailable / fail closed
  → 稍后 retry / reconcile

CAPABILITY_PROVISIONING_RETRY = YES

不把这种状态定义成「半个 Agent」。
更准确：
  Agent exists and works
  but some external capabilities are temporarily unavailable
```

能力修复与 main reset 无关：

```text
MAIN_RESET != CAPABILITY_REPAIR

credential 后来修好后，当前 main 应直接能使用该能力；
不要求等待 daily session reset（§9）。
```

baseline grants 存在，但 V2 不列任何具体 forum.* / workflow.* / broker.* scope。
具体 baseline profile 留给 Auth / Provisioning Spec。

provisioning 的所有权边界（冻结）：

```text
Router
  = routing / process lifecycle
  NOT:
    Agent provisioning manager
    Auth manager
    Credential manager

后续 Implementation 可以建立 trusted userspace provisioning seam / coordinator，
但 KERNEL_CHANGE = NONE；本轮不设计具体 API / daemon / state machine（§25）。
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
BINDING_AND_SWITCH_V1_DISPOSITION = PARTIALLY_SUPERSEDE

PRESERVE（机制层，保持有效）：
  - Binding owner = Router / Control Plane（唯一 owner）
  - persistence mechanism（原子 JSON 单文档持久化，tmp+rename、fail-loud）
  - per-Agent turn single-flight
  - switch 不是角色扮演（只写 Binding，不创建/移动/复制任何 Agent/Session）
  - 薄 switch adapter（agent_core.switch_agent 纯转发）

SUPERSEDE（产品语义，以本文档为准）：
  - Feishu 参与通用 switchAgent
    （本文档 §15/§17：Feishu = FIXED；Feishu main 的 switch 请求 NOT_ALLOWED）
  - every ChannelConversation is switchable
    （只有 switchable Product Surface（如 Mobile）可切换；§17
      SWITCHABLE_PRODUCT_SURFACE_SCOPED）
  - first-contact → default Agent
    （本文档 §3：first eligible human message → 自动创建新 Agent，
      不是绑定 config default Agent）
  - targetSessionId 作为 Human Surface 产品状态
    （本文档 §8/§14：Human 入口只有 activeAgent，Session = canonical main
      logical slot；targetSessionId 不再是产品状态）
```

### 24.3 D-003 `docs/decisions/MEMORY_V1.md`

```text
MEMORY_V1_DISPOSITION = PARTIALLY_SUPERSEDE

PRESERVE（产品 invariant，保持为 Current Truth）：
  - Memory belongs to Agent Workspace
  - file-first
  - MEMORY.md 作为长期记忆文件（curated，唯一事实源）
  - per-Agent 物理隔离（无全局库）

RETAIN_AS_IMPLEMENTED_STRATEGY_BUT_NOT_PRODUCT_AUTHORITY
  （保留为已实现的策略，不承担产品 authority）：
  - memory/YYYY-MM-DD.md（episodic 层）
  - turn/end consolidation
  - debounce
  - automatic prompt injection
  - memory_search / tool strategy
  - evidence window / LLM extraction details

V2 内部一致性（本文档立场）：
  - consolidation 时机 / 什么值得写 / 谁负责总结 = Agent/plugin strategy（§13），
    不是 Agent identity model 的一部分；
  - 上述「已实现策略」条目仅表示它们已按 MEMORY_V1 落地、V2 不否定其存在；
    它们不构成 V2 长期产品模型的 authority。
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

## 26. Authority Reconciliation — 代码 / README / 相关 Spec 现状

> 本轮除新增本文档外，系统核对与新模型相关的既有 Authority（decisions / specs /
> investigations / reports / 代码注释）。目标不是整理所有文档，而是回答：哪些旧判断
> 继续有效、哪些已被 V2 替代、哪些实现仍存在但只属于 transitional compatibility、
> 哪些 proposed Spec 应停止推进、哪些内容需要后续更小的 Implementation Spec。

### 26.1 五份主 Authority 的核对结论（转写表）

```text
| Authority                       | 继续有效 (KEEP)                                        | 被 V2 替代 (REPLACED_BY_V2)                              | 仍存在但 transitional              | proposed 停止 | 需更小 Impl Spec |
|---------------------------------|--------------------------------------------------------|----------------------------------------------------------|-------------------------------------|---------------|------------------|
| D-002 AGENT_SESSION_CHANNEL_    | Agent 长期实体 / Session 属 Agent / Channel 只是 UI /   | 任意 ChannelConversation 均可 switch 到任意 Agent        | —                                   | —（决策记录，  | 不需             |
|   MODEL_V1 (proposed)           | Binding 实体 / switchAgent 只改绑定 / resolve 幂等入口 / | （V2 §15/§17 产品分层）/ activeSessionId 作为人类入口    |                                     |  不再叠 amend）|                  |
|                                 | API channel-agnostic                                    | 状态（V2 §8/§14）/「Agent 固定拥有唯一 workspace」条款   |                                     |               |                  |
| D-004 BINDING_AND_SWITCH_V1     | Binding owner=Router / 持久化机制 / per-Agent            | Feishu 参与通用 switch / every ChannelConversation       | —                                   | —             | 不需             |
|   (accepted)                    | single-flight / switch≠角色扮演 / 薄 adapter             | switchable / first-contact→default Agent / targetSessionId |                                     |               |                  |
|                                 |                                                          | 作为 Human Surface 产品状态（V2 §3/§8/§14/§15/§17）      |                                     |               |                  |
| D-003 MEMORY_V1 (accepted)      | 产品 invariant：Memory 属 Agent Workspace / file-first / | 具体策略条目（memory/ 每日 note、turn/end consolidation、 | 已实现策略 = 保留但非产品 authority  | —             | 不需             |
|                                 | MEMORY.md / per-Agent 物理隔离                           | debounce、自动注入、memory_search、evidence window）     | （§24.3：策略归 Agent/plugin，        |               |                  |
|                                 |                                                          | = RETAIN_AS_IMPLEMENTED_STRATEGY（§24.3）                |  非 Agent identity model）            |               |                  |
| AGENT_CORE_BINDING_WORKSPACE_V1 | SESSION_WRITE_CONTRACT R1-R3 / cwd immutable /         | FEISHU_WORKSPACE_POLICY per-conversation workspace（     | Binding.workspace（代码已落地）→     | —             | 需要：            |
|   (accepted spec)               | workspaceId validation / Router 零产品分支 /            |   V2 §2/§5 替代）/「Binding 决定 effective workspace」   |  transitional field（§22）；         |               |  Binding.workspace |
|                                 | one-agent-one-process / App 切 Agent → target default   |   作为产品 authority（V2 §5/§21 替代）                   |  feishu conversationWorkspaceId →    |               |  未来处置；注释对齐 |
|                                 |   workspace（与 V2 §15/§16 一致）                        |                                                          |  transitional mechanism（§26.3）     |               |                  |
| FEISHU_WORKSPACE_MEMORY_        | HISTORICAL_MIXED_MEMORY_MIGRATION = NONE /             | 「same Agent → per-conversation Workspace」建模前提       | —                                   | STOP_PROPOSAL  | 需要：把两个保留  |
|   ALIGNMENT_V1 @ 6071dfd        | OLD_MIXED_MEMORY = ARCHIVE_ONLY                        | （与 V2 ONE_AGENT_ONE_WORKSPACE 冲突）                    |                                     | (DO_NOT_ACCEPT |  判断吸收进更小   |
|   (proposed，分支上，未上 main) |                                                         |                                                          |                                     |  / DO_NOT_     |  spec（§23）      |
|                                 |                                                         |                                                          |                                     |  MERGE)        |                  |
| AGENT_REPO_KNOWLEDGE_GOVERNANCE | Decision = long-lived invariant authority（§4C D-003）/ | —（V2 恰好按其 Decision contract 撰写；                 | —                                   | —             | 不需             |
|   V1 (accepted spec)            | status metadata supersession / ownership rule           |   §4C 示例 invariant 的 native-session 映射问题 V2 未决， |                                     |               |                  |
|                                 |                                                         |   留给 Implementation Spec，不冲突）                      |                                     |               |                  |
```

### 26.2 未受影响的其它 main-bound Spec

```text
AGENT_CORE_BACKUP_RETENTION_V1（accepted）    = PRESERVE（主题与 V2 无关）
OPEN_SOURCE_DOCS_CONVERGENCE_V1（accepted）   = PRESERVE（主题与 V2 无关）
```

### 26.3 代码 / 注释现状核对（当前 origin/main 实现）

| 组件 / 文件 | 现状断言 / 行为（source-verified） | V2 判定 |
|---|---|---|
| `feishu-connector/src/core.js:372-402` | 每个 conversation 一个稳定 workspaceId（`conversationWorkspaceId`）+ conversation-scoped 初始 session（`conversationMainSessionId` = main-<conv>）；注释「two groups of the SAME Agent never collapse onto same workspace」 | **TRANSITIONAL 机制**（对话→独立 workspace 的 canary 载体，§21）；该注释断言的是旧产品模型 → 后续 Impl Spec 对齐注释；本轮**不动代码**（DO_NOT_BREAK_CANARY，§22） |
| `agent-router/src/index.js:81-86,254-257` | `resolveChannelConversation` first contact 绑定 **config defaultAgentId**（旧模型：默认 Agent + 其 main） | **机制 = 旧产品模型**；V2 产品模型 = first eligible human message → 自动创建新 Agent（§3，transport eligibility 前置）→ 属未来 Impl Spec，本轮不实现 |
| `agent-router/src/binding-store.js` / `index.js`（Binding.workspace / resolveEffectiveWorkspace / switchAgent 三元组） | Binding.workspace 决定 effective workspace；null → agent default；Router 只机械执行 | **TRANSITIONAL_COMPATIBILITY_FIELD**（§22）；机制保留，无产品 authority |
| `workspace-bootstrap`（`seedFiles = ['AGENTS.md']`、ensure/ensureWorkspace 幂等） | 只 seed AGENTS.md；不 seed MEMORY.md / files/ | **KEEP** ＝ 与 V2 `WORKSPACE_BOOTSTRAP = AGENTS_MD_ONLY` 一致（§5） |
| `agent-provisioning`（provisionAgentHome） | per-agent home 预置（profile / settings / credentials copy），幂等 | **KEEP**（V2 §20 非阻塞 provisioning 的机制地基；principal/credential/grant 的 birth 级 ensure = AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO，机制落地属未来 Auth/Provisioning Spec） |
| `agent-memory`（paths.js:17-19 注释、MEMORY.md lazy 创建 + memory/ 每日 note） | workspace 内 MEMORY.md，mount 时按 agentId 解析；注释引用 D-002「Agent 固定拥有 workspace / credential / memory」 | **KEEP** 产品 invariant（Memory 属 Agent Workspace，§24.3 PRESERVE；ONE_AGENT_ONE_WORKSPACE 下所有 Session 共享同一份，§5/§13）；memory/ 每日 note、turn/end consolidation、debounce、自动注入、memory_search = RETAIN_AS_IMPLEMENTED_STRATEGY（非产品 authority，§24.3）；注释引用旧模型 → 后续对齐 |
| `broker`（credential-store / credential / identity / gateway） | credential 按 agentId 绑定；principal = credential→agent 绑定（Auth 侧唯一权威）；fail-closed | **KEEP** ＝ 与 V2 §19/§20 一致（SECURITY_DOMAIN = AGENT；credential 属 Agent）；provisioning 失败 = fail-closed（受影响 capability unavailable）+ 后续 retry（CAPABILITY_PROVISIONING_RETRY = YES），不阻塞聊天 |
| `scheduler-router`（createRouterInvoker → proc.turn(sessionId, message, {})） | cron 不传 workspace/cwd → 落 process 级 agent default workspace | **KEEP** 机制；V2 §10 PER_EXECUTION fresh Session + 同 Agent Workspace/Security 的 scoping 属未来 Impl Spec |
| `agent-switch`（tool relay 三元组） | 转发 {targetAgentId, targetSessionId?, workspace?}，纯 adapter | **KEEP** 机制；V2 §17 surface scoping（Feishu main / cron / agent-task NOT_ALLOWED）属未来产品 policy |

### 26.4 proposed Spec 停止推进清单

```text
STOP_PROPOSAL（DO_NOT_ACCEPT / DO_NOT_MERGE，不再推进）：
  FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd（proposed；分支上，未上 main；
    §23/§24.5；处置方向 = REPLACE_WITH_SMALLER_SPEC）

不再继续推进 amendment 的决策记录：
  D-002 AGENT_SESSION_CHANNEL_MODEL_V1（proposed；V2 §24.1 PARTIALLY_SUPERSEDE，
    不叠 amendment）
```

### 26.5 历史 Report 语句（非 authority，不修改）

```text
docs/reports/integration-v1.md:145（「Agent 固定拥有 workspace/DSH_HOME/process/memory」）
docs/reports/agent-session-v1.md:227（「Agent 必须始终以唯一 workspace 为 cwd」）
  → 历史验收记录（report 不是 authority，见 AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 §10）；
    其中的产品模型断言已被 V2 取代；档案保留原样。
```

### 26.6 Investigation 重分类

```text
docs/investigations/test-agent-feishu-product-semantics-v1.md（PASS）
  = TRANSITIONAL_COMPATIBILITY_EVIDENCE（机制能力实证；不授予产品 authority，§21）；
  保持 evidence 原样，不修改。
```

---

## Final Output

```text
AGENT_WORKSPACE_SESSION_MODEL_V2 = PASS
OWNER_RULING_SYNC = PASS（R2 FIX_REQUIRED 四项已修并全文档同步）

LONG_TERM_MODEL =
  ONE_FEISHU_CONVERSATION_ONE_AGENT = YES（P2P/GROUP 无区别；FEISHU_BINDING = FIXED；
    AGENT_REBIND / AGENT_RETIREMENT = OUT_OF_SCOPE；AUTO_DELETE_AGENT = NO）
  ONE_AGENT_ONE_WORKSPACE = YES
  AGENT_CREATION_TRIGGER = FIRST_ELIGIBLE_HUMAN_MESSAGE（transport eligibility 前置；
    p2p 首条真人消息 / 首次 @bot / no-mention 群首条 eligible 真人消息 → create；
    requireMention=true 未 @ → drop 不创建；CREATE_AGENT_CORE_PRIMITIVE = NOT_REQUIRED；
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
  AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO（AGENT_CHAT_READY = stable agentId +
    Workspace + AGENTS.md + canonical main/runtime；EXTERNAL_CAPABILITY_READINESS =
    principal + credential + baseline grants；provisioning failure →
    DOES_NOT_BLOCK_CHAT / 受影响 Broker capability fail-closed /
    CAPABILITY_PROVISIONING_RETRY = YES；MAIN_RESET != CAPABILITY_REPAIR（credential
    修好后当前 main 直接用，不等 daily reset）；Router ≠ provisioning/auth/credential
    manager；具体 baseline scope 留给 Auth/Provisioning Spec）
  MECHANISM_CAPABILITY_VS_PRODUCT_MODEL = DISTINCT（冻结 !=）
  CANARY_CLASSIFICATION = TRANSITIONAL_COMPATIBILITY_EVIDENCE
  BINDING_WORKSPACE_DISPOSITION = TRANSITIONAL_COMPATIBILITY_FIELD
    （LONG_TERM_PRODUCT_AUTHORITY = NO；DO_NOT_REMOVE_CODE / DO_NOT_MIGRATE /
      DO_NOT_BREAK_CANARY）

  D002_DISPOSITION             = PARTIALLY_SUPERSEDE
  BINDING_AND_SWITCH_V1_DISPOSITION = PARTIALLY_SUPERSEDE（机制保留：Binding owner /
      持久化 / single-flight / switch≠角色扮演 / 薄 adapter；产品语义被取代：Feishu
      通用 switch / 全可 switch / first-contact→default Agent / targetSessionId 人类
      入口状态）
  MEMORY_V1_DISPOSITION        = PARTIALLY_SUPERSEDE（产品 invariant 保留：Memory 属
      Agent Workspace / file-first / MEMORY.md / per-Agent 物理隔离；memory/ 每日
      note、turn/end consolidation、debounce、自动注入、memory_search、evidence
      window = RETAIN_AS_IMPLEMENTED_STRATEGY，非产品 authority，策略归 Agent/plugin）
  BINDING_WORKSPACE_V1_DISPOSITION = PARTIALLY_SUPERSEDE（机制保留；
      产品模型条款被本文档取代）
  FEISHU_MEMORY_SPEC_DISPOSITION  = DO_NOT_ACCEPT / DO_NOT_MERGE
      → REPLACE_WITH_SMALLER_SPEC（保留 HISTORICAL_MIXED_MEMORY_MIGRATION = NONE +
        OLD_MIXED_MEMORY = ARCHIVE_ONLY 两个产品判断）
  AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1_DISPOSITION = PRESERVE
  OTHER_MAIN_BOUND_SPECS_DISPOSITION = PRESERVE（BACKUP_RETENTION_V1 /
      DOCS_CONVERGENCE_V1，主题无关）
  CODE_SURFACE_RECONCILIATION = DONE（§26.3；无代码改动；断言旧产品模型且须后续对齐的
      注释点位已登记：feishu-connector conversationWorkspaceId 注释 /
      agent-router first-contact default-agent binding / agent-memory D-002 引用）
  PROPOSED_SPEC_STOPLIST = FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd
      （STOP_PROPOSAL / DO_NOT_ACCEPT / DO_NOT_MERGE；处置 = REPLACE_WITH_SMALLER_SPEC）

  OWNER_DECISIONS_STILL_REQUIRED = NONE
    （V2 已把长期产品模型收敛完整；§25 的推迟项均为 Implementation/Operational 级，
      不构成产品模型决策缺口）

PRODUCT_CODE_CHANGE = NONE
RUNTIME_CHANGE      = NONE
MIGRATION           = NONE
KERNEL_CHANGE       = NONE

OWNER_RULING_SYNC（R2 FIX_REQUIRED 复核结项）：
  AGENT_CREATION_TRIGGER           = FIRST_ELIGIBLE_HUMAN_MESSAGE
  AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO
  D004_DISPOSITION                 = PARTIALLY_SUPERSEDE
  MEMORY_V1_DISPOSITION            = PARTIALLY_SUPERSEDE
  INTERNAL_CONTRADICTIONS          = NONE
  OWNER_DECISIONS_STILL_REQUIRED   = NONE
```