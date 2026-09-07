# AGENT_WORKSPACE_SESSION_MODEL_V3 — Agent / Workspace / Session / main 长期产品模型 Current Decision

- 状态: accepted（2026-09-01；**standalone Current Authority**；整份取代 D-006 / V2）
- decision id: `D-008`
- 日期: 2026-08-31
- 类型: 正式决策（完整 Current Decision，不是 V2 §11 amendment）
- 范围: 只改 Decision/docs（PRODUCT_CODE_CHANGE = NONE / PRODUCTION_CHANGE = NONE /
  RUNTIME_CHANGE = NONE / ROUTER_CHANGE = NONE / BROKER_CHANGE = NONE /
  SCHEDULER_CHANGE = NONE / WORKFLOW_CHANGE = NONE / MIGRATION = NONE /
  KERNEL_CHANGE = NONE / DEPLOYMENT = NONE）
- fresh authoring base: `mayf3/dsh-agent-core origin/main@1a9b81de19c2bf4af01f62f6189acffc1bb6839d`
- base current decision: `D-006` / `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`（accepted）
  blob `c991010712f4c3a9b826bb38eac16189691bcc3f`
- supersedes: `D-006` / `AGENT_WORKSPACE_SESSION_MODEL_V2`（整份；acceptance transaction
  已同步将 D-006 标记为 superseded-by-D-008）
- Acceptance provenance: reviewed head
  `70bd5b2ed064a19f3e99a58e2454c3172c512bf9`；`模型 审计 = PASS`；
  `BLOCKER/HIGH/MEDIUM = 0/0/0`；`SEMANTIC_DELTA_AFTER_REVIEW = NONE`；
  accepted by Owner `mayf3` at `2026-08-31T21:56:51Z`。
- read-only proposed input: `AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r2`
  （`sha256:20820492d1b65842b0c607ee013baca1d5a3d6377b072d8914405eabff99d169`；
  不随本 Decision 提交、不在本轮接受或实现）
- 关联: D-002 `AGENT_SESSION_CHANNEL_MODEL_V1.md` · D-004 `BINDING_AND_SWITCH_V1.md` ·
  D-003 `MEMORY_V1.md` · `docs/specs/AGENT_CORE_BINDING_WORKSPACE_V1.md` ·
  `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md` ·
  `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md`

---

## 0. 一句话模型（V3 Current Truth，standalone 起点）

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
→ all Sessions share Agent Workspace and Agent security domain

main
→ canonical long-lived conversational address for the Agent
→ used by human Product Surfaces and Agent-to-Agent Messaging
→ trajectory resettable

cron
→ fresh non-main Session per execution

Agent-to-Agent Messaging
→ target Agent canonical main
→ existing main resume; absent main establish/create
→ each send starts one new Run/Turn
→ not one new Session per send

Agent-to-Agent Delegation
→ one explicit task/delegation = one target Agent non-main Session
→ multi-turn within that task
→ no transcript merge into main

Messaging ≠ Delegation
→ Session selection depends on the interaction primitive,
  not merely on the source actor being another Agent

Feishu
→ fixed Agent/main

Mobile
→ switchable activeAgent
→ always target selected Agent/main

Human Binding
→ activeAgent only

Security
→ principal / credential / grants belong to Agent

Memory
→ Workspace-local; shared across that Agent's Sessions
```

---

## 1. 为什么必须完整替代 V2，而不是修改 V2 §11

V2 把两个不同需求合并为单一 `Agent-to-Agent = PER_TASK`：

1. **Messaging**：A 找 B 本人说话、问问题、通知事实、协调工作或提醒 B 查看 B 已拥有的任务；
2. **Delegation**：A 明确创建或委托一项独立工作给 B。

两者的 Session 需求相反：Messaging 需要 B 的长期 conversational context；Delegation 需要独立
trajectory。仅 amendment V2 §11 会迫使未来 Agent 同时 merge V2 与 amendment，还会遗漏一句话模型、
Session 分类、main、non-main merge、security、Product Surface 与实现边界中的交叉引用。

因此冻结：

```text
V3_DOCUMENT_FORM = STANDALONE_COMPLETE_REPLACEMENT
PARTIAL_SUPERSESSION = FORBIDDEN

V3 accepted before:
  V2 remains Current Authority

V3 accepted after:
  V2_DISPOSITION = SUPERSEDED_BY_V3
  V3 = sole Current Authority for this complete model
```

V3 完整保留 V2 中仍正确的 Current Truth，只拆开 Messaging 与 Delegation，并明确它们与 Scheduler、
Workflow notification 的边界。

---

## 2. Feishu Conversation → Agent

```text
ONE_FEISHU_CONVERSATION_ONE_AGENT = YES
one Feishu conversation
→ one long-lived Agent
→ one Workspace
→ one canonical main

P2P_SPECIAL_CASE = NONE
GROUP_SPECIAL_CASE = NONE

FEISHU_BINDING = FIXED
一个 Agent 当前必须有一个固定 Feishu conversation 作为 creation/binding anchor。

AGENT_REBIND      = OUT_OF_SCOPE
AGENT_RETIREMENT  = OUT_OF_SCOPE
AUTO_DELETE_AGENT = NO
```

私聊和群聊只是不同的 Feishu conversation identity；Agent Core 对已通过 transport ingress
eligibility 的两者不设置不同产品模型。

---

## 3. Agent 自动出生

```text
AGENT_CREATION_TRIGGER = FIRST_ELIGIBLE_HUMAN_MESSAGE
TRANSPORT_INGRESS_ELIGIBILITY precedes AGENT_CREATION
```

Agent Core 看到任意 Feishu event 不等于创建 Agent。只有 transport 已判定真人消息确实在和 bot
说话，才允许 conversation lookup 后在 Agent absent 时创建：

```text
p2p 第一条真人消息
  → eligible → create Agent

group 默认 requireMention=true
  普通未 @ 消息 → drop，NO Agent creation
  第一次 @ bot → eligible → create Agent

explicitly configured no-mention group
  第一条符合 ingress policy 的真人消息 → create Agent
```

出生链：

```text
first eligible human message
→ create stable Agent identity
→ create Workspace
→ seed AGENTS.md
→ begin external capability provisioning（非阻塞，§23）
→ establish canonical main
→ fixed-bind conversation to Agent
→ first message enters that Agent main

CREATE_AGENT_CORE_PRIMITIVE = NOT_REQUIRED
FEISHU_CONVERSATION_CREATION = OUTSIDE_AGENT_CORE
```

Agent Core 不负责创建飞书群或私聊，也不关心 conversation 是由人、Agent 还是外部系统创建。

---

## 4. Agent identity

```text
AGENT_ID = 独立稳定的不透明 id（agentId）
AGENT_ID != FEISHU_CONVERSATION_ID
```

Feishu conversationId 只是创建/固定绑定 anchor，不是 Agent 身份。Scheduler、Broker、Mobile、
Agent-to-Agent Messaging 与 Agent-to-Agent Delegation 等内部系统都使用 channel-independent
`agentId`。

---

## 5. One Agent = One Workspace

```text
ONE_AGENT_ONE_WORKSPACE = YES

Workspace/
├── AGENTS.md
├── MEMORY.md      # optional / lazy
└── arbitrary files/directories

NEW_AGENT_WORKSPACE_BOOTSTRAP = AGENTS_MD_ONLY
MEMORY_MD_CREATION = LAZY
OTHER_FILES = LAZY
PRECREATE_FILES_DIRECTORY = NO
```

Workspace 是 Agent 的长期工作环境。main、Messaging、Delegation、cron 与 background Session
都不选择第二个正常产品 Workspace。

---

## 6. AGENTS.md 属于 Agent 自己

```text
AGENTS_MD_OWNERSHIP = AGENT
AGENTS_MD_MUTABLE_BY_AGENT = YES
```

Agent 可以 read、edit、rewrite、evolve 自己 Workspace 内的 AGENTS.md；不需要 Kernel approval、
Router approval 或专门 AGENTS.md gate。

---

## 7. Session 与完整分类

```text
SESSION = ONE TRAJECTORY
SESSION_ISOLATION = TRAJECTORY_ONLY
```

一个 Agent 可以同时拥有：

```text
main                         # canonical logical slot
cron-run-*                   # per-execution non-main
agent-delegation/task-*      # per-task non-main
background-*                 # explicit isolated background trajectory
```

Messaging 不增加一种长期 pair Session，也不默认创建 `agent-message-*` Session；它进入 target main。

所有 Session：

```text
same Agent
same Workspace
same security domain
same Agent-owned tools/capabilities
```

non-main 不是 sandbox，不是低权限 Session。它只隔离 trajectory。

Session 选择表：

| interaction primitive | target Session | reuse rule | trajectory purpose |
|---|---|---|---|
| Human via Feishu | bound Agent main | resume/establish main | 与 Agent 本人长期交流 |
| Human via Mobile | selected Agent main | resume/establish main | 与选中 Agent 本人长期交流 |
| Agent-to-Agent Messaging | target Agent main | resume/establish main | 私下消息、问答、通知、协调、提醒 |
| Agent-to-Agent Delegation | fresh/per-task non-main | one task one Session | 独立工作轨迹 |
| cron occurrence | fresh/per-execution non-main | no reuse | 调度执行轨迹 |
| explicit isolated background work | explicit non-main | 由其 governing Spec 冻结 | 独立工作轨迹 |

---

## 8. Main 是 Agent 的 canonical logical slot 与 stable address

```text
每个 Agent 正常只有一个 canonical main。

MAIN_SESSION_IDENTITY = LOGICAL_SLOT
NATIVE_DSH_SESSION_ID = IMPLEMENTATION_DETAIL

main = Agent 面向长期交流的 canonical logical slot
     = Human Product Surface 的目标
     = Agent-to-Agent Messaging 的目标
```

main 不只是「human-only」入口。它是“找这个 Agent 本人说话”的稳定地址；消息来源可以是人类或另一个
Agent，但可信 provenance 仍应区分来源。

```text
existing target main → resume current main trajectory
absent target main   → establish/create canonical main
```

absent 时创建 main 是建立该 Agent 唯一 canonical slot，不是为每次 send 创建新 Session。多个
Product Surface 若都访问同一 Agent/main，就共享当前 main trajectory。

---

## 9. Main 可以 reset

```text
MAIN_SESSION_LIFETIME = RESETTABLE
AGENT_LIFETIME        = LONG_LIVED
WORKSPACE_LIFETIME    = LONG_LIVED

retire / clear current main trajectory
→ start fresh trajectory behind same logical main

RESET_CLEARS_WORKSPACE       = NO
MAIN_RESET_CHANGES_BINDING   = NO
MAIN_RESET_SCOPE             = MAIN_ONLY
```

reset 后保持 same Agent、same Workspace、same AGENTS.md、same MEMORY.md、same files、same logical
main。Messaging 与 Human Product Surface 后续都进入 reset 后的 current main。non-main Session 不受
main reset 影响。

本 Decision 不决定 native DSH Session ID 是否复用、旧 trajectory archive/delete、reset scheduler、
reset policy persistence、OpenClaw reset migration 或 reset 前 memory consolidation。

---

## 10. Cron 与 Scheduler isolated work

```text
CRON_SESSION_SCOPE = PER_EXECUTION
CRON_SESSION_REUSE = NO

每次 cron execution
→ fresh non-main Session
→ same Agent Workspace
→ same Agent security domain
```

Scheduler `run_once` 若表达一次 isolated work，也属于 fresh/per-task execution family，而不是 Agent chat：

```text
SCHEDULER_RUN_ONCE_AS_AGENT_CHAT = NO
SCHEDULER_ISOLATED_EXECUTION_SESSION = FRESH/PER_TASK_NON_MAIN
```

本节只保持现有产品边界，不修改 D-007、Scheduler API、occurrence/outcome 模型或任何 Scheduler
实现。

---

## 11. Agent-to-Agent Messaging

Messaging 是“A 找 B 本人说话”，包括但不限于：

- 给 B 发一条私下消息；
- 问 B 一个问题；
- 通知 B 某个事实；
- 与 B 协调工作；
- 提醒 B 查看它本来就拥有的 Workflow task。

冻结：

```text
AGENT_TO_AGENT_MESSAGING_SESSION_SCOPE = TARGET_MAIN
AGENT_TO_AGENT_MESSAGING_TARGET = TARGET_AGENT_CANONICAL_MAIN

existing main → resume
absent main   → establish/create canonical main
one send      → one new target Run/Turn
one send      → NOT one new Session

MESSAGING_CREATES_DELEGATED_TASK = NO
MESSAGING_CREATES_PAIR_SESSION   = NO
```

理由：Messaging 是“找这个 Agent 本人说话”。B 的长期 conversational context 对理解问答、通知、
前后协调与提醒至关重要，因此 B main 是自然、稳定且 channel-independent 的 address。

对应 generic primitive：

```text
agent_session_send
→ messaging
→ target main
→ one send = one new Run/Turn, not one new Session
```

V3 只冻结产品语义，不授权或规定 Broker manifest、Router 改动、trusted provenance sidecar、reply wait、
reconciliation helper、grant、deployment 或实现细节。

---

## 12. Agent-to-Agent Delegation

Delegation 是“A 明确创建/委托一项独立工作给 B”，不是普通消息。

```text
AGENT_TO_AGENT_DELEGATION_SESSION_SCOPE = PER_TASK
AGENT_TO_AGENT_DELEGATION_TARGET = TARGET_AGENT_NON_MAIN
ONE_DELEGATED_TASK = ONE_TARGET_NON_MAIN_SESSION
MULTI_TURN_WITHIN_DELEGATED_TASK = YES
DELEGATION_TRANSCRIPT_MERGE_INTO_MAIN = NO
```

理由：Delegation 创建一条独立工作 trajectory。任务 prompt、工具调用、中间产物、失败恢复与多轮推进
需要 trajectory isolation，因此 per-task non-main 合理。

对应未来或既有 generic family：

```text
explicit delegation / spawn / isolated run_once
→ per-task or per-execution non-main
```

本 Decision 不命名或授权未来 delegation capability，不设计 task handle、GC、timeout、result delivery、
spawn API、Scheduler API 或实现。

---

## 13. Messaging 与 Delegation 的精确边界

```text
MESSAGING_VS_DELEGATION_BOUNDARY =
  Messaging addresses the target Agent as an ongoing conversational peer and delivers a message,
  question, fact, coordination note, or notification into that Agent's canonical main; each send
  creates a new Run/Turn but no per-send Session. Delegation explicitly creates an independently
  owned work trajectory for the target Agent; one delegated task gets one isolated non-main Session,
  may be multi-turn within that task, and its transcript is not merged into main.
```

裁决规则：

```text
SESSION_SELECTION_DEPENDS_ON = INTERACTION_PRIMITIVE
SESSION_SELECTION_DEPENDS_MERELY_ON_SOURCE_ACTOR_IS_AGENT = NO
```

“发送者是另一个 Agent”不足以推出 non-main。必须先判断调用的是 Messaging 还是 explicit
Delegation primitive。不得根据 message 文本像不像任务，偷偷把 Messaging 升格为 Delegation；也不得把
explicit Delegation 压进 main 来省 Session。

---

## 14. Workflow assignment notification

Workflow 是 task authority。假设 HR 已发现某个既有 Workflow task 的 `assignee=B`，然后告诉 B：

```text
“你有任务 X，请处理”
```

该动作是 notification/messaging，不是 HR 新建 delegated task：

```text
WORKFLOW_ASSIGNMENT_NOTIFICATION = AGENT_TO_AGENT_MESSAGING
WORKFLOW_ASSIGNMENT_NOTIFICATION_TARGET = B_MAIN
NOTIFICATION_CREATES_SECOND_TASK_AUTHORITY = NO
WORKFLOW_REMAINS_TASK_AUTHORITY = YES
```

B 收到通知后是否读取、领取或推进 Workflow task，由 Workflow 的 existing authority、权限与状态机决定。
Messaging 不复制 Workflow task，不新建 parallel delegated Session，不篡改 assignee，不成为 Workflow
状态权威。

若 A 另行调用明确 delegation/spawn primitive，请 B 完成一项独立工作，那才进入 B per-task non-main；
不能仅因消息中出现“请处理”就改变 primitive 身份。

---

## 15. 不建立 long-lived pair Session

```text
LONG_LIVED_PAIR_SESSION = NO
```

A↔B 不拥有独立永久 pair transcript：

- Messaging 进入每一方被寻址时的 target main；
- Delegation 进入每个 task 独立的 target non-main；
- 不建立隐藏 pair mailbox Session；
- 不把多次不同 delegation 自动复用成永久 A↔B task Session。

---

## 16. Non-main 不 merge 回 main

```text
NON_MAIN_TRAJECTORY_MERGE_INTO_MAIN = NO
```

cron、delegation/task、isolated background trajectory 的原始上下文不塞回 main。跨 Session continuity
来自：

```text
MEMORY.md
Workspace files
explicit task/delegation result
explicit later Messaging when appropriate
```

Messaging 本身已在 main，因此不存在“把 Messaging transcript merge 回 main”的步骤。Delegation 的结果
可以被显式发送、写入 Workspace 或 Memory，但原始 transcript 不 merge。

---

## 17. 所有 Session 都能贡献 Workspace-local Memory

```text
MAIN_CAN_UPDATE_MEMORY         = YES
MESSAGING_RUN_CAN_UPDATE_MEMORY = YES   # Messaging Run 属 main
CRON_CAN_UPDATE_MEMORY         = YES
DELEGATION_CAN_UPDATE_MEMORY   = YES
AGENT_TASK_CAN_UPDATE_MEMORY   = YES
```

所有 Session 都可以读写同一 Agent Workspace 中的 AGENTS.md、MEMORY.md 与普通文件。具体何时
consolidation、什么值得写、谁负责总结，属于后续 Agent/plugin policy，不属于本 identity model。

---

## 18. Human Product Surface

```text
HUMAN_PRODUCT_SURFACE_BINDING = activeAgent only

human ingress
→ selected/bound Agent
→ canonical main
```

Human Product Surface 不绑定 cron、delegation/task 或 background Session。不需要 activeWorkspace 或
activeSessionId：Workspace 由 Agent 唯一决定，Human Session 为 canonical main。

Agent-to-Agent Messaging 同样 target main，但不是 Human Product Surface，也不得借此伪造 human
provenance 或 external reply route。

---

## 19. Feishu 与 Mobile

```text
Feishu:
  FEISHU_BINDING = FIXED
  conversation A → Agent A → Agent A/main
  Feishu 不允许动态切到另一个 Agent

Mobile:
  MOBILE_BINDING = SWITCHABLE
  Mobile 只访问已有 Agent，不创建 Agent
  MOBILE_CAN_CREATE_AGENT = NO
  MOBILE_CAN_SELECT_EXISTING_AGENT = YES
  selected Agent → selected Agent/main
```

Messaging/Delegation 的内部来源不会改变 Feishu Binding 或 Mobile activeAgent。

---

## 20. Mobile switch_agent 与 scope

```text
agent_core.switch_agent(targetAgent)
→ update current switchable Product Surface activeAgent
→ notify client
→ next human message enters target Agent/main
```

switch_agent 不是当前 Agent 角色扮演成另一个 Agent，也不创建、移动或复制 Session。

```text
SWITCH_AGENT_SCOPE = SWITCHABLE_PRODUCT_SURFACE_SCOPED

Mobile main             = ALLOWED
Feishu main             = NOT_ALLOWED
cron Session            = NOT_ALLOWED
delegation/task Session = NOT_ALLOWED
Agent-to-Agent Messaging Run = NOT_ALLOWED as a Product-Surface switch context
```

Messaging 选择 target main 是其 primitive 的路由语义，不是 `switch_agent`，不更新任何 Human Product
Surface activeAgent。

---

## 21. Switch-away / switch-back

```text
Mobile 从 Agent A 切到 B
→ DOES_NOT_RESET_A_MAIN

再切回 A
→ resume Agent A current canonical main

若期间发生 main reset
→ 返回 reset 后的新 current main trajectory
```

这与期间是否有其它 Agent 向 A main 发送 Messaging 无冲突：切回时看到的是 A 当前 canonical main。

---

## 22. Security domain 与来源边界

```text
AGENT_SECURITY_DOMAIN = Agent

属于 Agent：
  principal
  credential
  grants

不属于：
  Session
  Run/Turn
  Feishu conversation
  Mobile Surface
  Binding
  source Agent
```

main、Messaging Run、cron、delegation/task 默认都使用**target/executing Agent**的 security identity、
Workspace 与 capability grants。

```text
A sends to B:
  provenance source = A（由 trusted runtime 表达，具体机制留给 Spec）
  execution identity = B
  credential/principal/grants = B
  workspace = B Workspace

SOURCE_AGENT_IMPERSONATES_TARGET = NO
SOURCE_AGENT_GRANTS_INHERITED_BY_TARGET = NO
```

V3 不实现 provenance，不定义 source schema，不授予 send 权限；只冻结 security-domain 归属不因
Messaging/Delegation 改变。

---

## 23. Agent birth — 安全 / 能力 readiness 不阻塞聊天

```text
AGENT_BIRTH_BLOCKS_ON_CREDENTIAL = NO

AGENT_CHAT_READY =
  stable agentId
  + Workspace
  + AGENTS.md
  + canonical main/runtime ready

EXTERNAL_CAPABILITY_READINESS =
  principal
  + credential
  + baseline grants
```

external capability provisioning 独立进行：

```text
ensure principal
→ ensure credential
→ ensure standard baseline grants

failure:
  Agent remains chat-capable
  Workspace/local capabilities remain usable
  affected Broker capability = unavailable / fail closed
  retry/reconcile later

CAPABILITY_PROVISIONING_RETRY = YES
MAIN_RESET != CAPABILITY_REPAIR
```

Router 是 routing/process lifecycle owner，不是 Agent provisioning、Auth 或 Credential manager。具体
baseline profile、trusted provisioning seam、retry state machine 留给独立 Spec。

---

## 24. Mechanism capability != Product model

```text
MECHANISM_CAPABILITY != PRODUCT_MODEL
ONE_AGENT_ONE_WORKSPACE = YES
```

既有 same Agent → multiple workspace Canary 仅为 `TRANSITIONAL_COMPATIBILITY_EVIDENCE`：证明底层机制
可工作，不证明它应成为长期产品模型。

同理，底层 `sessionMode:'fresh'` 能工作，不表示所有 Agent-to-Agent interaction 都应 fresh；底层 main
能接收消息，也不表示 explicit Delegation 应失去 isolation。产品 primitive 先决定 Session class，
机制随后执行。

---

## 25. Binding.workspace

```text
BINDING_WORKSPACE_TRANSITIONAL = TRANSITIONAL_COMPATIBILITY_FIELD
LONG_TERM_PRODUCT_AUTHORITY = NO

DO_NOT_REMOVE_CODE
DO_NOT_MIGRATE
DO_NOT_BREAK_CANARY
```

即使底层允许 `Binding.workspace != Agent.primaryWorkspace`，正常产品模型仍为
ONE_AGENT_ONE_WORKSPACE。是否删除或保留 internal escape hatch，由后续 Implementation Spec 决定。

---

## 26. FEISHU_WORKSPACE_MEMORY_ALIGNMENT_V1 @ 6071dfd

```text
DISPOSITION = DO_NOT_ACCEPT / DO_NOT_MERGE
DIRECTION = REPLACE_WITH_SMALLER_SPEC

PRESERVE product judgments:
  HISTORICAL_MIXED_MEMORY_MIGRATION = NONE
  OLD_MIXED_MEMORY = ARCHIVE_ONLY

DO_NOT_PRESERVE premise:
  same Agent → per-conversation Workspace
```

V3 不重开该旧方向，也不继续在该 proposed Spec 上叠 amendment。

---

## 27. Authority disposition

```text
NEW_PARTIAL_SUPERSESSION = NONE
ONLY_NEW_AUTHORITY_TRANSITION = V2 whole-document supersession by V3
LEGACY_V2_PARTIAL_DISPOSITIONS = HISTORICAL_COORDINATES_ONLY
```

§27.2–§27.5 record the legacy relationship that V2 had already established before the current
governance adoption. V3 does not create, widen, or amend those partial relationships and does not
mutate the older files. The new transition owned by this Decision is only the complete V2 → V3
replacement in §27.1. V3's standalone body states the complete Current Model without requiring
those legacy documents to define its meaning.

### 27.1 V2 整份处置

```text
AGENT_WORKSPACE_SESSION_MODEL_V2_DISPOSITION = SUPERSEDED_BY_V3
TRANSITION_KIND = WHOLE_DOCUMENT_SUPERSESSION
EFFECTIVE_WHEN = V3_ACCEPTED
```

V2 accepted 历史正文保留。V3 accepted 前 V2 仍是 Current Authority；V3 accepted 后未来 Agent 只需读
V3 与下列明确 PRESERVE 的文档，不需要 merge V2 + V3。

本 authoring round 只提交 proposed D-008 与 proposed index entry，不翻转 D-006。独立审阅 PASS 后，
authorized Owner/maintainer 才可对审阅绑定的 exact final head 执行单一 docs-only acceptance transaction：

```text
D-008 / V3: proposed -> accepted/current
D-006 / V2: accepted/current -> superseded-by-D-008
docs/decisions/README.md: D-008 -> accepted/current; D-006 -> superseded-by-D-008
SEMANTIC_DELTA_AFTER_REVIEW = NONE
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

任一 lifecycle/backlink/index 更新缺失，或审阅后出现 normative delta，都不得完成 acceptance。

V2 被替代的实质判断只有其未拆分的 A2A 模型：

```text
V2 AGENT_TO_AGENT_SESSION_SCOPE = PER_TASK
→ replaced by:
  AGENT_TO_AGENT_MESSAGING_SESSION_SCOPE = TARGET_MAIN
  AGENT_TO_AGENT_DELEGATION_SESSION_SCOPE = PER_TASK
```

V2 其余 Current Truth 已完整重述于 V3，不因整份 supersession 丢失。

### 27.2 D-002 `AGENT_SESSION_CHANNEL_MODEL_V1.md`

```text
HISTORICAL_V2_D002_DISPOSITION = PARTIALLY_SUPERSEDE
V3_NEW_DISPOSITION_CHANGE = NONE
```

PRESERVE：Agent 是 channel-independent 长期实体；Session 属 Agent；Channel 只是 Channel/UI；Binding
是实体；switchAgent 只改允许切换的 binding；resolve 入口幂等；channel-agnostic API；main 长期概念；
Message 是 API data type；DSH_HOME/credential/memory 归 Agent。

SUPERSEDE：任意 ChannelConversation 通用 switch；Binding.activeSessionId 作为 Human Surface 产品状态；
以及其 workspace 条款中与 V3 ONE_AGENT_ONE_WORKSPACE 冲突的历史层次。

### 27.3 D-004 `BINDING_AND_SWITCH_V1.md`

```text
HISTORICAL_V2_BINDING_AND_SWITCH_V1_DISPOSITION = PARTIALLY_SUPERSEDE
V3_NEW_DISPOSITION_CHANGE = NONE
```

PRESERVE：Binding owner = Router/Control Plane；原子持久化/fail-loud；per-Agent turn single-flight；
switch 非角色扮演；薄 switch adapter。

SUPERSEDE：Feishu 参与通用 switch、every ChannelConversation switchable、first-contact→default Agent、
targetSessionId 作为 Human Surface 产品状态。以 V3 §2/§3/§8/§18–§20 为准。

### 27.4 D-003 `MEMORY_V1.md`

```text
HISTORICAL_V2_MEMORY_V1_DISPOSITION = PARTIALLY_SUPERSEDE
V3_NEW_DISPOSITION_CHANGE = NONE
```

PRESERVE 产品 invariant：Memory 属 Agent Workspace、file-first、MEMORY.md 是 curated 长期记忆事实源、
per-Agent 物理隔离。

`memory/YYYY-MM-DD.md`、turn/end consolidation、debounce、automatic injection、memory tools、evidence
window 与 extraction 细节保留为 implemented strategy，不承担 V3 identity model authority。

### 27.5 `AGENT_CORE_BINDING_WORKSPACE_V1.md`（accepted Spec）

```text
HISTORICAL_V2_BINDING_WORKSPACE_V1_DISPOSITION = PARTIALLY_SUPERSEDE
V3_NEW_DISPOSITION_CHANGE = NONE
```

PRESERVE 机制 invariant：Session cwd 创建时冻结/resume 恢复/cross-workspace mismatch 拒绝；workspaceId
validation；Router 零产品分支；ONE_AGENT_ONE_PROCESS；App 切 Agent 到 target Agent default Workspace。

SUPERSEDE 产品条款：Feishu per-conversation Workspace；“Agent identity 不唯一决定 Workspace”作为长期产品
invariant；Binding.workspace 作为产品 authority。

### 27.6 Accepted V2 child-authority census and disposition

Fresh `origin/main@1a9b81de19c2bf4af01f62f6189acffc1bb6839d` contains the following
accepted, non-superseded Specs that cite V2 as a governing Decision or direct Current Decision
reference:

| accepted child authority | V2 predicate used | V3 disposition |
|---|---|---|
| `AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1` | Agent owns its credential/security identity | PRESERVE |
| `AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2` | Feishu fixed ingress reaches Agent/main; Core Alignment remains parent authority | PRESERVE |
| `AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3` | one Agent = one primary Workspace; path selection is separately governed | PRESERVE |
| `AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1` | one Agent = one primary Workspace; path-agnostic product model | PRESERVE |
| `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` | Sessions/Runs belong to the executing Agent; prompt paths use exact turn identity | PRESERVE |
| `AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC` | Feishu → primary Workspace → canonical main → Workspace-local Memory | PRESERVE |
| `SCHEDULER_TIMEOUT_OUTCOME_V2` | cron occurrence → fresh non-main Session in the same Agent Workspace/security domain | PRESERVE |

```text
ACTIVE_V2_CHILD_AUTHORITY_DISPOSITION = PRESERVE
CHILD_IMPLEMENTATION_AUTHORITY_CHANGE = NONE
CHILD_CONTRACT_CHANGE = NONE
CHILD_ACCEPTANCE_CHANGE = NONE
CHILD_PRODUCTION_AUTHORITY_CHANGE = NONE
```

V3 changes only the formerly collapsed A2A classification. Every V2 predicate used by the active
children above is restated unchanged in V3. Their existing file references to V2 remain historical
acceptance provenance; this proposed V3 authoring round does not rewrite accepted child files. Any
future cross-reference reconciliation requires its own docs-only exact-delta review and MUST NOT alter
their Goal, scope, Decisions, Contracts, Acceptance, implementation authority, production authority,
or accepted meaning.

#### 27.6.1 `AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md`（accepted）

```text
V2_CORE_ALIGNMENT_SPEC_DISPOSITION = PRESERVE
V2_CORE_ALIGNMENT_SPEC_VALIDITY = STILL_VALID_FOR_ITS_IMPLEMENTATION_SCOPE
CURRENT_MODEL_PARENT_AFTER_V3_ACCEPTANCE = AGENT_WORKSPACE_SESSION_MODEL_V3
EXISTING_V2_REFERENCE = HISTORICAL_ACCEPTANCE_PROVENANCE
```

理由：该 Spec 的实现 scope 是 Feishu → Agent primary Workspace → canonical main → Workspace-local
Memory，以及相关 core alignment。V3 完整保留 ONE_AGENT_ONE_WORKSPACE、Feishu fixed Agent/main、
canonical main 与 Workspace-local Memory；Messaging/Delegation 拆分不改变该 Spec 的 implementation
scope、验收成果或已完成实现。

不得因文件名含 V2、正文引用 V2，废掉或回滚其成果。V3 accepted 后，V3 承接其所依赖且未改变的
长期产品语义；历史 V2 引用保留 acceptance provenance。未来可做独立 docs-only cross-reference
reconciliation，但不需要语义 revise、supersede 或重实现。

#### 27.6.2 `AGENT_PROCESS_LIFECYCLE_HARDENING_V2`（accepted）

```text
PROCESS_LIFECYCLE_SPEC_DISPOSITION = PRESERVE
PROCESS_LIFECYCLE_SPEC_CONTRACT_CHANGE = NONE
```

该 Spec 的 exact `turnExecutionId == reconciliationHandle`、prompt receipt、bounded final assistant
output、`truncated` metadata、terminal/unknown distinction、no automatic replay 与 no unsolicited
Product-Surface delivery仍完整有效。V3 只选择 Messaging/Delegation/Cron 的 Session class；它不重写
这些 Run lifecycle contracts。proposed Messaging r2 对 exact source turn correlation、receipt 与完整未截断
reply 的细化必须继续服从该 accepted lifecycle authority。

### 27.7 `AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md`（proposed；只读核对）

```text
SESSION_MESSAGING_SPEC_ALIGNMENT = PASS
SESSION_MESSAGING_R2_ALIGNMENT = PASS
```

其 r2 核心：target Agent canonical main；existing main resume；absent main establish/create；每次 send 在
**同一 logical main** 上创建 one new Run/Turn, not one new Session——与 V3 §8/§11 完全一致。r2 已冻结的
完整未截断成功终态 reply、exact source turnExecutionId provenance、intent/outcome audit 顺序、receipt 后
audit append failure，以及 `timeoutSeconds=0..300` / receipt-relative reply deadline，均属于该 Spec 的
implementation contract；它们不与 V3 产品模型冲突，也不需要 V3 扩展或重述。

Read-only alignment matrix（不把 r2 的 implementation contracts 提升为本 Decision contracts）：

```text
MODEL_VISIBLE_INPUT = targetAgentId + message + timeoutSeconds(0..300)
SESSION_TARGET = target Agent canonical main only
RUN_MODEL = each send creates one new Run/Turn in the same main
PROVENANCE = runtime-owned source identity + exact source turnExecutionId
EXECUTION_SECURITY = target Agent Principal + credential + grants
TIMEOUT_0 = return only after real inbox receipt
TIMEOUT_POSITIVE = replied only for complete, successful, non-truncated final output of the exact Run

NO_AUTOMATIC_PING_PONG = YES
NO_EXTERNAL_ANNOUNCE = YES
NO_ARBITRARY_SESSION_TARGETING = YES
NO_FRESH_SESSION_FOR_MESSAGING = YES
NO_SCHEDULER_CREATION = YES
```

V3 不修改该 Spec、不接受它、不授权实现。V3 accepted 后，该 Spec 的 Decision alignment gate 在产品语义
上得到满足并获得清晰的 Current Decision parent；其 authority reference 可在其自身后续治理轮从 V2
对齐为 V3。

### 27.8 PR #130 / `AGENT_CORE_AGENT_WAKE_CAPABILITY_V1`

```text
PR130_DISPOSITION = CLOSE
AGENT_WAKE_IN_V3 = NO
```

`agent_wake` 的 fresh-session one-shot execution 属 Scheduler/delegation/isolated-execution family，不是
Messaging primitive。它不进入 V3，也不得作为 Agent chat 的替代物。PR #130 从未成为 accepted
Current Authority，因此 close/withdraw，而不是把其历史合同伪装为 V3 Messaging。

### 27.9 其它 authority

```text
AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 = PRESERVE
AGENT_CORE_BACKUP_RETENTION_V1 = PRESERVE
OPEN_SOURCE_DOCS_CONVERGENCE_V1 = PRESERVE
SCHEDULER_OCCURRENCE_OUTCOME_V2 (D-007) = PRESERVE
```

V3 不修改 Scheduler occurrence/outcome/migration 权威。

---

## 28. Product Surface 与 internal primitive 的正交关系

```text
Human Product Surface selects Agent/main.
Agent Messaging names target Agent/main.
Delegation names target Agent + creates isolated task trajectory.
Scheduler names target Agent + creates isolated execution trajectory.
Workflow owns task state; notification only informs target Agent/main.
```

这些入口都不得：

- 创建第二个正常产品 Workspace；
- 改变 target Agent security domain；
- 把 source Agent identity 当作 target credential；
- 隐式更新 Feishu Binding 或 Mobile activeAgent；
- 用 main/non-main 选择取代 Workflow task authority；
- 用 Scheduler run_once 伪装 Agent chat。

---

## 29. Future implementation boundaries

V3 是长期产品 Decision，不是 Implementation Spec。以下全部不在本轮实现或决定：

```text
- agent_session_send implementation
- explicit delegation/spawn capability name and contract
- Router change
- Broker manifest or local capability wiring
- trusted inter-agent provenance representation
- reconciliation/wait helper
- authorization/grant profile
- reply/timeout/streaming contract
- self-send/cycle policy
- native DSH Session ID mapping
- main daily reset scheduler
- trajectory archive/delete or Session GC
- Agent-to-Agent delegation result delivery
- Workflow notification automation
- Workflow state or assignee transitions
- Scheduler API/behavior/store changes
- run_once implementation changes
- Feishu ID mapping storage format
- credential storage mechanism
- exact baseline grants
- Mobile push/WebSocket protocol
- Binding.workspace removal
- old Canary migration
- OpenClaw compatibility or migration code
- deployment or production apply
```

后续 implementation 必须由独立 accepted Spec 授权。Session selection 只能实现本 Decision 冻结的 primitive
边界，不能再把所有 A2A interaction 合并成一个模式。

---

## 30. Alternatives considered

### A. 保持 V2：所有 A2A 都 per-task non-main

拒绝。普通 message/question/notification/coordination 被错误建模为 delegated task，丢失 target Agent main
中的长期 conversational context，也会为每次普通 send 制造不必要的 Session。

### B. 所有 A2A 都进入 target main

拒绝。explicit Delegation 失去 trajectory isolation，独立任务的中间上下文污染长期 main。

### C. 每对 Agent 一个 long-lived pair Session

拒绝。它既不是 target Agent 本人的 canonical context，也不是 task-isolated trajectory；还引入额外稳定
address、lifecycle 与 transcript ownership 问题。

### D. 用 Scheduler run_once 代替 Agent chat

拒绝。run_once 表达 isolated execution；Messaging 表达与 target Agent 本人的长期 conversational contact。
二者 authority、Session、result 与产品目的不同。

### E. Workflow assignment 自动创建 delegated Session

拒绝。Workflow 已拥有 task authority。通知 assignee 只是 Messaging；再创建 delegated task 会复制 authority
与 trajectory。

### F. 只发布 V2 §11 amendment

拒绝。违反 complete-current-authority 可读性要求，并会遗漏所有受 A2A 分类影响的交叉引用。

---

## 31. Acceptance / independent review checklist

独立审阅至少确认：

1. V3 standalone，不依赖读者 merge V2 才能理解完整模型；
2. ONE_AGENT_ONE_WORKSPACE、Feishu fixed Agent/main、Mobile selected Agent/main、main reset、cron
   per-execution、Agent security domain、Workspace-local Memory 均未被改变；
3. Messaging = target main + each send new Run/Turn + no per-send Session；
4. Delegation = one task one target non-main + task 内多轮 + no transcript merge；
5. Session selection 由 primitive 决定，不由 source actor 决定；
6. Workflow assignment notification 明确进入 B main，Workflow 仍为 task authority；
7. Scheduler run_once 未被当作 Agent chat，Scheduler authority/实现未改；
8. `switch_agent` 仍只属于 switchable Human Product Surface；Messaging 路由不等于 switch；
9. security identity 始终属于 target/executing Agent；
10. V2 whole-document disposition 与全部七份 active V2 child authorities 的 preserve disposition 明确；
11. accepted Process Lifecycle authority 的 exact turn / receipt / terminal / truncation / no replay
    语义保持不变；
12. proposed Session Messaging Spec 的核心语义核对 PASS，但本轮未修改/接受/实现它；
13. PR #130 = CLOSE，wake 未进入 V3；
14. repository diff 只有 Decision/docs；无产品、生产、Scheduler、Workflow 或部署变更。

---

## Final Output（accepted）

```text
TASK_NAME = 模型 执行
TASK_TYPE = CURRENT_DECISION_V3_AUTHORING_ONLY

SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_KIND = CURRENT_DECISION
STATUS = accepted
IMPLEMENTATION_AUTHORITY = none
OPEN_OWNER_DECISIONS = NONE
OWNER_ACCEPTANCE_REQUIRED = NO
NORMATIVE_TBD = NONE
NEW_PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = NOT_APPLICABLE_CURRENT_DECISION
AUTHORING_READY_FOR_REVIEW = YES

BASE_CURRENT_DECISION = AGENT_WORKSPACE_SESSION_MODEL_V2
BASE_CURRENT_DECISION_ID = D-006
NEW_CURRENT_DECISION = AGENT_WORKSPACE_SESSION_MODEL_V3
NEW_CURRENT_DECISION_ID = D-008

MESSAGING_SESSION = TARGET_MAIN
DELEGATION_SESSION = PER_TASK_NON_MAIN
CRON_SESSION = PER_EXECUTION_NON_MAIN

MESSAGING_VS_DELEGATION_BOUNDARY =
  Messaging addresses the target Agent as an ongoing conversational peer and delivers a message,
  question, fact, coordination note, or notification into that Agent's canonical main; each send
  creates a new Run/Turn but no per-send Session. Delegation explicitly creates an independently
  owned work trajectory for the target Agent; one delegated task gets one isolated non-main Session,
  may be multi-turn within that task, and its transcript is not merged into main.

LONG_LIVED_PAIR_SESSION = NO
SESSION_SELECTION_DEPENDS_ON = INTERACTION_PRIMITIVE

V2_DISPOSITION = SUPERSEDED_BY_V3
  (activated by the 2026-09-01 atomic Owner acceptance transaction)

V2_CORE_ALIGNMENT_SPEC_DISPOSITION = PRESERVE
  STILL_VALID_FOR_ITS_IMPLEMENTATION_SCOPE because Feishu → Agent primary Workspace → canonical
  main → Workspace-local Memory remains unchanged; V3 carries the same parent semantics while the
  existing V2 reference remains historical acceptance provenance.

ACTIVE_V2_CHILD_AUTHORITY_DISPOSITION = PRESERVE
  AGENT_CORE_CREDENTIAL_METADATA_RESOLUTION_V1
  AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
  AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3
  AGT_CTO_AGENT_PRIMARY_WORKSPACE_OPENCLAW_IN_PLACE_V1
  AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC
  SCHEDULER_TIMEOUT_OUTCOME_V2
  CHILD_IMPLEMENTATION_AUTHORITY_CHANGE = NONE
  CHILD_CONTRACT_CHANGE = NONE

PROCESS_LIFECYCLE_SPEC_DISPOSITION = PRESERVE
  exact turnExecutionId/reconciliation identity, real receipt, complete non-truncated terminal output,
  timeout/unknown distinctions, no replay, and no unsolicited Product-Surface delivery remain governed
  by the accepted process-lifecycle authority.

SESSION_MESSAGING_SPEC_ALIGNMENT = PASS
  target main + existing resume/absent establish + one send one new Run/Turn, not one new Session,
  is aligned; this Decision does not modify or accept that proposed Spec.

PR130_DISPOSITION = CLOSE
AGENT_WAKE_IN_V3 = NO

PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
ROUTER_CHANGE = NONE
BROKER_CHANGE = NONE
SCHEDULER_CHANGE = NONE
WORKFLOW_CHANGE = NONE
MIGRATION = NONE
DEPLOYMENT = NONE

ACCEPTED_REVIEWED_HEAD = 70bd5b2ed064a19f3e99a58e2454c3172c512bf9
INDEPENDENT_REVIEW = 模型 审计 = PASS
SEMANTIC_DELTA_AFTER_REVIEW = NONE
ACCEPTED_BY = mayf3
ACCEPTED_AT = 2026-08-31T21:56:51Z
CURRENT_AUTHORITY_AFTER_ACCEPTANCE = D-008
NEXT_TASK = 会话 执行
```
