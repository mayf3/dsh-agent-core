---
spec_id: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
status: accepted
supersedes: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
date: 2026-08-19
type: implementation-spec (spec-only; no implementation in authoring/finalize rounds)
scope: docs-only — supersede V1 only where PR #16 review evidence requires corrected Phase A contracts;
  preserve every other V1 authority, boundary, migration, rollback, and Phase B exclusion;
  replace the historical SDK package pin with reviewed source/runtime dual-revision authority
references:
  - docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1.md (accepted; superseded on V2 acceptance)
  - docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md (PASS; evidence authority)
  - docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md (accepted; PREBOUND_ONLY authority)
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (accepted; Current Authority)
  - docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md (proposed; mechanism preserved)
  - docs/decisions/BINDING_AND_SWITCH_V1.md (accepted; Binding and single-flight authority preserved)
---

# AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 — Phase A Contract Correction

> 性质：**superseding implementation Spec（SPEC ONLY）** · 日期：2026-08-19  
> 仓库：`mayf3/dsh-agent-core`  
> AUTHORING_BASE_MAIN = `eaebb28df4e5a67ecbcfe6f3990fe276ff11acd1`  
> RECONCILED_CURRENT_MAIN = `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`
> REVIEW_BASE = `5cfb61025641f8ec2430d0b9d39ad0cb8348124e`  
> REVIEWED_HEAD = `8962113bc9aba3557a384b03d010111f1201aabb`  
> IMPLEMENTATION_REVIEW_IDENTITY = `CODEX_PR16_INDEPENDENT_REVIEW_2026-08-19`
>
> 本 Spec 在 authoring round 只新增本文件。`PRODUCT_CODE_CHANGE = NONE`、
> `DEPENDENCY_CHANGE = NONE`、`DEPLOYMENT = NONE`、`PRODUCTION_STATE_CHANGE = NONE`。
> 不修改 PR #16，不使用 test app，不部署，不 merge implementation。
>
> `origin/main` 在 PR #16 的历史 base 之后已前进到 `fe2c6393915b1dc61c4c3d25b2996d2f258ba484`；
> PR #16 Head 仍精确为 `8962113bc9aba3557a384b03d010111f1201aabb`。本 Spec 保留历史 review
> objects，并把 current-main Router/AgentProcess 语义作为
> future implementation 的只读 authority；不把 PR 分支的未来移动冒充为已评审内容。
>
> **状态（2026-08-20 acceptance finalize）：accepted** —— focused independent review 对精确
> reviewed Spec Head `fa92987206c6bd5a8baf7a12b299d9cc088d72d2` 给出 PASS，BLOCKERS = NONE，
> SEMANTIC_REVIEW_COMPLETE = YES。本 finalize 轮仅执行 lifecycle/review metadata 翻转；
> `SEMANTIC_CHANGE_AFTER_REVIEW = NONE`。V2 进入 implementation base branch（main）前仍不得
> 修改 PR #16；Phase B 仍未授权，create_thread test-app gate 仍为 PENDING。

---

## 0. Final Output（authoring round）

```text
SPEC_STATUS = proposed
SUPERSEDES = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES (reviewed SDK source/runtime revisions close prior blockers)
IMPLEMENTATION_AUTHORIZED = NO

PHASE_A_FOUNDATION_CUTOVER = PRESERVE_WITH_V2_CONTRACT_CORRECTIONS
PHASE_B_UX_PERMISSION = NO

PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
PR16_CHANGE = NONE
SPEC_STATUS = proposed
```

V2 accepted 且进入 implementation base branch 之前，原 Implementation Agent 不得基于本
Spec 改动 PR #16。

---

## 1. Problem and New Evidence

V1 的方向仍正确：以 `@larksuite/channel@0.5.0` 替换自维护 Feishu transport foundation，
只做 Phase A compatibility cutover，Phase B UX activation 不授权。但 PR #16 在精确 Head
`8962113bc9aba3557a384b03d010111f1201aabb` 的独立 Implementation Review 曾暴露出四项 blocker
与一项 historical Owner decision：

```text
BLOCKERS =
  1. malformed ingressGate verdict admits Router
  2. @all-only V0 eligibility is not preserved
  3. IngressEvent mention/attachment metadata parity fails
  4. SDK queue-disabled path does not await full Router turn

OWNER_DECISION_REQUIRED =
  SDK high-level send surface cannot express the old create + root_id endpoint contract
```

这些不是单纯实现疏漏：V1 的冻结文本把 `requireMention=true`、transport dispatch completion、
IngressEvent parity 范围和 `create_thread` endpoint identity 写成或留下了错误/不足合同。因此按
`AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` §5 必须 SUPERSEDE，不能由 Implementation Agent 在
PR #16 内自行扩大或重解释 governing Spec。

`NEW_EVIDENCE` 不只来自 review 结论。V2 author 重新读取上游 SDK 的 reviewed source revision
`bd24f6742513769c80b5401b96ad464d74dd2027`，并把其唯一后继 reviewed runtime revision
`ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f` 的 committed `dist/**` 作为 Agent Core 安装 authority：

| SDK source fact | 对 V2 的约束 |
|---|---|
| `src/safety/policy-gate.ts` 先执行 `requireMention && !mentionedBot`，之后才检查 `mentionAll/respondToMentionAll` | `requireMention=true` 时，`@all-only` 无法被 `respondToMentionAll=true` 挽救 |
| `src/safety/index.ts` queue-disabled 分支以 `void dispatchHandler(...)` fire-and-forget | SDK push/WS dispatcher 的 Promise 返回不等于 Agent turn 完成 |
| 同文件 `dispatchHandler` 内 `await onMessage`，`finally` 才 SeenCache.add + ProcessingLock.release | bridge Promise 必须覆盖 Router full turn；否则 dedup/lock 只覆盖提前完成的 adapter |
| `SafetyPipeline` 捕获 handler throw/rejection 后调用 async-aware `onError`，`LarkChannel` 将其接至 `emitError`；`channel.on('error')` observer 可返回 Promise，observer 自身 rejection 被安全消费 | Owner 要求的公开 error surface 已由 reviewed source revision 闭合；不得退回 logger-only 或 connector-private surface |
| `ProcessingLease` 由 `id + ownerToken(Symbol)` 标识，支持 configurable TTL/renew interval、续租与 tokenized exact release；默认 `300000ms/60000ms` | full-turn lock 可覆盖 pending handler；Agent Core 不得另造第二把 lock/dedup |
| `src/outbound/sender.ts` 有 `replyTo` 时调用 `im.v1.message.reply` + `reply_in_thread`；无 `replyTo` 时才调用 `im.v1.message.create`，高阶 surface 无 `root_id` 参数 | `create_thread` 应冻结产品结果，不再冻结 endpoint identity；等价性必须由 test app 实测 |
| `NormalizedMessage`/`MentionInfo`/`ResourceDescriptor` 未暴露 V0 的所有身份与附件字段，但 `includeRawEvent` 可附原 event | 允许读取 raw metadata，但不得恢复第二套 wire normalization |

reviewed SDK 双 revision 冻结为：

```text
SDK_UPSTREAM_REPOSITORY = larksuite/channel-sdk-node
SDK_UPSTREAM_PR = larksuite/channel-sdk-node #15
REVIEWED_SOURCE_REVISION = bd24f6742513769c80b5401b96ad464d74dd2027
SOURCE_REVIEW_VERDICT = PASS
SOURCE_REVIEWER_IDENTITY = CODEX_LARK_CHANNEL_SDK_PR15_V2_FOCUSED_RE_REVIEW_2026_08_19
REVIEWED_RUNTIME_REVISION = ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f
RUNTIME_REVIEW_VERDICT = PASS
RUNTIME_REVIEWER_IDENTITY = CODEX_LARK_CHANNEL_SDK_RUNTIME_PACKAGING_REVIEW_2026_08_20
RUNTIME_PARENT_REVISION = bd24f6742513769c80b5401b96ad464d74dd2027
RUNTIME_AHEAD_BY = 1
RUNTIME_DIFF = dist/** only
EXACT_RUNTIME_INSTALL_COORDINATE = https://github.com/mayf3/channel-sdk-node.git#ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f
```

source revision 是源码合同与安全语义的 review authority；runtime revision 是 Agent Core 唯一安装
authority。二者不可互换，也不得使用 source-only revision、branch、tag、floating ref 或 npm registry
version 代替 exact runtime coordinate。

---

## 2. Supersession and Preservation Rule

```text
AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
SUPERSEDES
AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
```

machine-readable 双锚点：

1. 本文件 frontmatter：`supersedes: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1`。
2. 仅在独立 Spec Review PASS 后的 acceptance-finalize round，V1 frontmatter 才从
   `status: accepted` 翻转为 `status: superseded` 并新增
   `replaced_by: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2`。V1 正文不改、不删、不移动。

若 V2 未 accepted，V1 metadata 不翻转，Implementation 仍不得以 proposed V2 为权限。

### 2.1 V1 global preservation

除 §3–§7 明确替换的合同外，V1 全部 `PRESERVE`：

```text
V1_PHASE_A_AUTHORITY = PRESERVE
V1_IMPLEMENTATION_SCOPE = PRESERVE
V1_PHASE_B_EXCLUSIONS = PRESERVE
V1_PACKAGE_PIN = REPLACED_BY_V2_REVIEWED_SOURCE_RUNTIME_DUAL_REVISION
V1_MIGRATION_AND_ROLLBACK = PRESERVE
V1_BINDING_CONTINUITY = PRESERVE
V1_CONVERSATION_ID_GOLDEN_VECTORS = PRESERVE
V1_READINESS_AND_SINGLE_WEBSOCKET = PRESERVE
V1_OUTBOUND_TEXT_DEFAULT_AND_FAIL_LOUD = PRESERVE
V1_OWNER_BOUNDARIES = PRESERVE
```

V1 中未被本 Spec 点名替换的 AC 继续生效。若文字冲突，以 V2 §3–§7 为 current
authority；其余不得借 SUPERSEDE 重新设计。

### 2.2 Frozen unchanged values

```text
TRANSPORT_FOUNDATION = @larksuite/channel
SDK_PACKAGE_MANIFEST_VERSION = 0.5.0
SDK_SOURCE_AUTHORITY = bd24f6742513769c80b5401b96ad464d74dd2027
SDK_RUNTIME_INSTALL_AUTHORITY = ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f
SDK_BATCH_DELAY_MS = 0
SDK_CHAT_QUEUE = DISABLED
SDK_STALE_DROP = DISABLED
SDK_RESPOND_TO_MENTION_ALL = true
CUSTOM_LRU_DEDUP = REMOVE
DEDUP_AUTHORITY = @larksuite/channel
EVENT_SURFACE = MESSAGE_ONLY
DUAL_WEBSOCKET = NO

ROUTER_CHANGE = NONE
AGENT_PROCESS_CHANGE = NONE
BINDING_STORE_CHANGE = NONE
V2_INGRESS_GATE_IMPLEMENTATION_CHANGE = NONE
WORKSPACE_AUTHORITY_CHANGE = NONE
KERNEL_CHANGE = NONE

PHASE_B_UX_PERMISSION = NO
```

`V2_INGRESS_GATE_IMPLEMENTATION_CHANGE = NONE` 指
`packages/production-runtime/src/v2-ingress-gate.js` 必须 0 行 diff；本 Spec 只收紧 bridge
如何解释 gate 的返回值。

### 2.3 Current-main semantic reconciliation

```text
BASE_SEMANTIC_DRIFT = CONFIRMED
DRIFT_FROM = eaebb28df4e5a67ecbcfe6f3990fe276ff11acd1
DRIFT_TO = fe2c6393915b1dc61c4c3d25b2996d2f258ba484
CURRENT_MAIN_INCREMENT_1 = e60b26cf30d2e495b07192e486fd5591b5f6e282
CURRENT_MAIN_INCREMENT_2 = 878177114cee70e5f37cc0f09546f168ffe2ba67
CURRENT_MAIN_INCREMENT_3 = fe2c6393915b1dc61c4c3d25b2996d2f258ba484
DRIFT_DISPOSITION = COMPATIBLE_AFTER_EXPLICIT_RECONCILIATION
NEW_OWNER_DECISION_REQUIRED = NO
NEW_V3_SPEC_REQUIRED = NO

FULL_TURN_AUTHORITY = EXISTING_ROUTER_ONINGRESS_PROMISE_ON_CURRENT_MAIN
AGENT_PROCESS_INTERNAL_EVENT_MODEL = READ_ONLY_EXISTING_AUTHORITY
AGENT_PROCESS_CHANGE_BY_LARK_IMPLEMENTATION = NONE
```

`fe2c6393915b1dc61c4c3d25b2996d2f258ba484` 上的 current-main authority 已具备：Router
`onIngress` 等待 `AgentProcess.turn()` 和最终 Feishu success reply；`AgentProcess` 保留 per-Agent
`turnQueue`、默认 `DSH_AGENT_TURN_TIMEOUT=300000`，并以 prompt 前 watermark、receipt ownership、
matching `turn/start`、matching `user/message`、same-turn `turn/end` 与 idle 作为 exact-turn completion；
terminal `reason.kind=error` 产生 sanitized provider failure，reply 只从 watermark 到 terminal 区间提取。

Lark implementation 只消费这一现存 Promise seam，不拥有、不复制、不修改上述事件模型。冻结 lease
窗口为：

```text
LARK_BRIDGE_LEASE_WINDOW =
  before SDK handler dispatch
  -> await bridge onEvent
  -> await Router onIngress
  -> await current AgentProcess.turn Promise
  -> await final Feishu reply/error handling
  -> bridge Promise settle
  -> stop renewal
  -> SeenCache add attempt
  -> release exact lease
```

---

## 3. Contract A — Gate Fail Closed

```text
GATE_ALLOWED =
  verdict is a non-null object
  AND verdict.allowed === true
```

唯一放行值是上述 conjunction。以下全部进入既有 fixed rejection path：

```text
undefined
null
empty object
array / string / number / boolean / function / other wrong type
gate throw / rejected Promise
allowed missing
allowed = false / 0 / 1 / "true" / any value other than literal true
```

固定结果：

```text
NO Router callback
NO Binding creation
existing INGRESS_GATE_REJECTED_REPLY path
```

不得把“只有 `allowed === false` 才拒绝”作为兼容解释。`makeV2PreboundIngressGate` 的合法
`{allowed:true}` / `{allowed:false}` shape 不变；Malformed verdict 测试只针对 bridge consumer。

---

## 4. Contract B — Preserve V0 @all Eligibility

```text
PURE_MENTION_ALL_V0_BEHAVIOR = PRESERVE
SDK_REQUIRE_MENTION = false
SDK_RESPOND_TO_MENTION_ALL = true
```

V2 以 SDK normalization 的 `mentionedBot` / `mentionAll` 输出为输入，在 SDK dedup/lock **之后**、
PREBOUND_ONLY **之前**执行唯一 Agent Core eligibility：

```text
AGENT_CORE_MENTION_ELIGIBILITY =
  p2p                         -> eligible
  group/topic mentionedBot    -> eligible
  group/topic mentionAll      -> eligible
  group/topic neither         -> silent drop
```

顺序冻结：

```text
SDK stale(disabled)
  -> SDK SeenCache duplicate check
  -> SDK PolicyGate(requireMention=false, respondToMentionAll=true)
  -> SDK LoopGuard(default disabled)
  -> SDK ProcessingLock acquire
  -> Agent Core self-echo / identity residual guards
  -> AGENT_CORE_MENTION_ELIGIBILITY
  -> PREBOUND_ONLY
  -> Router
```

普通 group/topic no-mention 仍静默丢弃，不发 unbound receipt、不调用 gate、不调用 Router、不创建
Binding。`requireMention=false` 只把 V0 的全局 mention eligibility 搬到薄 adapter；它不授权
per-group no-mention，不改变 Phase B，且不得演化成 group policy registry。

---

## 5. Contract C — Full IngressEvent Parity

```text
INGRESS_EVENT_PARITY = FULL
NORMALIZATION_AUTHORITY = @larksuite/channel
SECOND_WIRE_NORMALIZATION = NO
SDK_INCLUDE_RAW_EVENT = true
```

实现必须把 V0 test-only differential oracle 扩展为**完整 IngressEvent 差分**，不能只比较
conversation identity。对每个 V0 支持的 `msg_type` 及关键边缘向量，逐字段比较：

```text
sender.openId / sender.unionId / sender.userId / sender.senderType
mentions[].key / openId / unionId / userId / name / type
mentioned / addressed
attachments[].type / fileKey / name / sizeBytes / duration /
  coverImageKey / downloadHint
text placeholder for every supported msg_type
rootMsgId / threadId / parentMsgId
timestamp units and fallback behavior
dedupKey
raw field availability and shape
```

另继续比较 V1 已冻结的 `channel/chatType/conversationId/chatId/messageId/messageType/subType`。

SDK `NormalizedMessage` 未暴露但 raw event 已提供的 metadata，允许通过 `includeRawEvent` 做字段
lookup/机械投影；禁止重新 parse wire content 来决定 SDK 已归一化的正文、mention eligibility、
conversation identity 或 supported-msg-type dispatch。薄 adapter 只补齐既有 IngressEvent ABI，
不得成为第二 normalization authority。

差分失败即 blocker；不得用“Router 当前未消费该字段”降低 `FULL` parity。

---

## 6. Contract D — SDK Async Dispatch and Full-Turn Promise

```text
SDK_TRANSPORT_DISPATCH_COMPLETION != AGENT_TURN_COMPLETION
BRIDGE_HANDLER_AWAITS_ROUTER = YES
SDK_CHAT_QUEUE = DISABLED
AGENT_PROCESS_SINGLE_FLIGHT = SOLE_PRODUCT_SERIALIZATION_AUTHORITY
```

V2 接受 queue-disabled 的 SDK push/WS dispatcher 可在 handler settle 前返回；transport 的
ack/dispatch Promise 不是产品 turn completion receipt。禁止为等待 transport dispatch 而重新启用
chat queue。

但 bridge 的 Promise contract 必须满足：

1. gate 允许后，Promise 在 Router `onIngress` **full turn**（含 Agent turn 与最终 reply/error）
   完成前不得 settle。
2. bridge 不得 `void onEvent(...)`、不得只 await admission receipt、不得 catch 后提前 resolve。
3. SDK ProcessingLock 在该 Promise settle 前保持；并发 duplicate 不进入第二次 Agent turn。
4. SDK SeenCache 只在 handler 完成后 mark；handler 未完成时不能以 seen=true 代替 in-flight lock。
5. Router/onEvent error 不得被 bridge 静默吞掉；它必须进入 SDK `error` event，并由真实
   `channel.on('error')` observer 断言。reviewed source revision 的
   `SafetyPipeline onError -> LarkChannel.emitError -> channel.on('error')` 是唯一公开路径；同步 observer、
   Promise observer 与 rejecting async observer 均须安全处理，且 `unhandledRejection = 0`。
   logger-only、connector-only callback 或“等价错误面”均不算通过；不得靠 rawClient、私有字段、
   logger 字符串解析或第二套 queue/dedup 近似实现。

`AgentProcess` 现有 per-Agent promise chain 不修改；它仍是唯一产品级串行 authority。SDK
ProcessingLock 仅负责同一 messageId 的并发重投，不得扩张为按 chat/Agent 的产品队列。

```text
HANDLER_ERROR_FLOW =
  message handler error
  -> SafetyPipeline onError
  -> LarkChannel.emitError
  -> channel.on('error')
HANDLER_ERROR_INPUTS = sync throw + rejected Promise
ASYNC_REJECTING_OBSERVER_SAFELY_CONSUMED = YES
UNHANDLED_REJECTION_COUNT = 0
```

### 6.1 Required real-SDK test shape

测试必须经过真实 `@larksuite/channel@0.5.0` SafetyPipeline/dispatcher，不得只直接调用
`createBridgeHandler`：

```text
T0  first event acquires SDK ProcessingLock
T1  bridge enters allowed Router callback; callback held pending
T2  assert bridge Promise pending and Agent turn count = 1
T3  dispatch concurrent duplicate with same messageId
T4  assert duplicate does not enter second Router/Agent turn
T5  settle Router callback
T6  assert SeenCache mark/release happens after T5; later duplicate is seen-drop
T7  throwing Router callback is observed on the required SDK error surface
```

测试还必须证明 `SDK_CHAT_QUEUE=DISABLED`，不能用 queue-enabled 行为误证上述合同。
`AC-PROCESSING-LOCK-COVERS-TURN` 的证明必须覆盖产品支持的最大 full-turn completion window，
包括 SDK lease TTL/renew 边界；只做远短于 TTL 的短 pending test 不足以证明“直到 Promise
settle 前保持”。reviewed source revision 默认 `processingLockTtlMs=300000`、
`processingLockRenewIntervalMs=60000`，以 `ProcessingLease(id, ownerToken: Symbol)` 续租并 tokenized
exact release。对象引用 identity 不是合同；`id + generation token` 才是 ownership authority。
不得新增第二把 adapter lock 或第二套 dedup；SeenCache 仍是 committed duplicate authority。

```text
PROCESSING_LOCK_TTL_MS = 300000
PROCESSING_LOCK_RENEW_INTERVAL_MS = 60000
PROCESSING_LOCK_TOKENIZED_LEASE = YES
EXACT_LEASE_IDENTITY = message/event id + unforgeable generation token
OBJECT_REFERENCE_IDENTITY_REQUIRED = NO
```

### 6.2 AC-CURRENT-MAIN-FULL-TURN-PROMISE

future implementation 必须在 current-main integration seam 上证明以下全部事实，不得复制一个假的
AgentProcess 状态机作为 test double 来替代真实 integration seam：

```text
AC-CURRENT-MAIN-FULL-TURN-PROMISE
  bridge onEvent Promise does not settle before current AgentProcess.turn settles
  successful turn resolves only after exact same-turn terminal + idle
  terminal provider error rejects AgentProcess.turn
  Router/bridge maps that failure into the reviewed SDK public error path exactly once
  channel.on('error') observes that failure exactly once
  success and error paths hold the renewable lease until bridge Promise settlement
  concurrent duplicate remains blocked while terminal-error handling is pending
  current-main AgentProcess/turnQueue/process.js supplies the event model
  Lark implementation diff under packages/agent-router/** = 0
```

current Router may represent a caught AgentProcess failure as its existing `onIngress` error result after final
Feishu error handling；bridge 必须机械地把该 existing failure outcome 保持为 handler failure，使 reviewed
SDK public error path exactly-once 可观察，不得要求 Router 或 AgentProcess 改码。

---

## 7. Contract E — create_thread Product Semantics

```text
CREATE_THREAD_AUTHORITY = PRODUCT_SEMANTICS_NOT_ENDPOINT_IDENTITY
SDK_NATIVE_CREATE_THREAD_PLAN =
  replyTo = rootMsgId
  replyInThread = true

CREATE_THREAD_LIVE_TEST = REQUIRED
CREATE_THREAD_ROOT_ID_PARITY = PENDING_UNTIL_TEST_APP
RAW_CLIENT_AUTHORIZED = NO
```

V2 替换 V1 的“必须 `im.message.create + root_id`” endpoint identity。允许 SDK-native
`im.message.reply(message_id=rootMsgId, reply_in_thread=true)`，前提是 test app 证明产品结果：

1. 从 flat group message 启动或进入其 topic；
2. reply 不逃逸到 group main；
3. 返回消息属于预期 root/thread；
4. 后续 ingress 的 `threadId/rootMsgId` 能派生正确 topic `conversationId`，并命中预期 Binding。

本 Spec authoring/finalize 不使用 test app，因此只把该项冻结为 implementation-time mandatory gate，
不声称 root_id parity 已通过。若真实 test app 证明 SDK-native 语义不等价，Implementation Agent
停止并另报 `OWNER_DECISION_REQUIRED`；不得自行启用 `rawClient`、恢复 direct node-sdk client、
更换 SDK 或修改 ReplyTarget 产品合同。

---

## 8. Implementation Scope after Acceptance

V1 §13 scope 原样承接：

```text
packages/feishu-connector/
  minimal bridge/config/mapping/outbound-plan changes and tests required by §3–§7
packages/production-runtime/
  compose readiness-only scope preserved from V1
docs/runbooks/
  cutover/rollback evidence if required by V1
```

明确 0 行 / no-change：

```text
packages/agent-router/**
packages/agent-router/src/process.js
Binding Store format/rows/keys/semantics
packages/production-runtime/src/v2-ingress-gate.js
workspace-bootstrap / scheduler-router / broker / product-api /
notification-ingress / agent-provisioning
DSH Kernel
```

实现若需要超出上述范围，或 SDK public surface 无法满足 §6 error/lock 合同，必须停
`OWNER_DECISION_REQUIRED`；不得由 Implementation Agent 修改本 governing Spec。

### 8.1 PR #16 historical-base reconciliation

```text
PR16_HISTORICAL_BASE = 5cfb61025641f8ec2430d0b9d39ad0cb8348124e
PR16_HISTORICAL_HEAD = 8962113bc9aba3557a384b03d010111f1201aabb
PR16_BASE_RECONCILIATION_REQUIRED = YES
PR16_REVIEW_BASE = future exact target main
```

V2 accepted 后，PR #16 必须基于届时精确 latest target main 重新对账/重作；不得直接 merge 历史 Head，
也不得把历史测试计数冒充 current-base 证据。`packages/agent-router/**`（特别是
`src/process.js`）diff 必须为 0，并保留 current-main provider/model override、terminal error 与 exact-turn
语义。production `compose` 只允许机械增加 Feishu readiness/gate wiring，不得覆盖现存 model override。
所有适用测试必须在 reconciled base 重跑，历史通过数只作为历史证据。

---

## 9. Acceptance Criteria

V1 中未被以下条目替换的 AC 全部继续生效；以下为 V2 新增/修订的 mandatory AC：

```text
AC-GATE-MALFORMED-FAIL-CLOSED
  对 undefined/null/{}/wrong type/throw/allowed!=true 全表逐项测试；Router callback = 0，
  Binding row delta = 0；合法 {allowed:true} 才唯一放行。

AC-ATALL-V0-PARITY
  真实 SDK pipeline，group/topic @all-only（mentionedBot=false, mentionAll=true）通过 adapter
  eligibility，随后按 PREBOUND_ONLY 判定；prebound 仅进入一次 Agent turn。

AC-NO-MENTION-STILL-DROPPED
  真实 SDK pipeline，group/topic mentionedBot=false 且 mentionAll=false 静默丢弃；gate = 0，
  Router = 0，reply = 0，Binding row delta = 0。

AC-REAL-SDK-ASYNC-DISPATCH
  以 queue disabled 的真实 SDK dispatcher 证明 transport dispatch 可先返回，同时 bridge/full
  Router turn Promise 仍 pending；测试不得用 direct bridge call 冒充 SDK 行为。

AC-PROCESSING-LOCK-COVERS-TURN
  按 §6.1 时序保持首个 Router turn pending，并发同 messageId duplicate 不进入第二 turn；
  SeenCache mark 发生在 Router settle 后；覆盖产品支持的最大 turn window 与 SDK renewable lease
  TTL/renew 边界。
  真实 channel.on('error') observer 可见 Router failure，logger-only 不算通过。

AC-FULL-INGRESS-DIFFERENTIAL
  §5 全字段矩阵覆盖 V0 supported msg_type、p2p/group/topic、@bot/@all、sender identity triple、
  attachment metadata、timestamp seconds/milliseconds、event_id fallback 和 raw availability；
  差分全部通过，production source 无第二 wire normalizer。

AC-CREATE-THREAD-TEST-APP-PENDING
  Spec authoring/finalize 明确 PENDING；implementation cutover gate 必须用真实 test app 证明 §7
  四项产品结果。未通过不得 production canary；失败时 OWNER_DECISION_REQUIRED，rawClient 禁止。

AC-SDK-SOURCE-REVISION-PIN
  source contract review 精确绑定 bd24f6742513769c80b5401b96ad464d74dd2027；不得以 branch、tag、
  floating ref、npm package 或 runtime-only inspection 替代。

AC-SDK-RUNTIME-REVISION-PIN
  package.json 与 package-lock.json 精确使用
  https://github.com/mayf3/channel-sdk-node.git#ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f；
  lockfile resolved/integrity evidence 必须可追溯到完整 40-char runtime SHA。

AC-SCRIPT-DISABLED-INSTALL
  remote Git install 与 clean npm ci 均以 scripts disabled 完成；prepare 不执行；运行时直接使用已
  committed dist。安装、require/import 与适用测试均通过。

AC-HANDLER-ERROR-PUBLIC-SURFACE
  handler sync throw/rejected Promise 经 SafetyPipeline onError -> emitError -> channel.on('error') exactly
  once；async observer rejection 被消费，unhandledRejection = 0。

AC-TOKENIZED-RENEWABLE-LOCK
  lease 以 exact message id + generation ownerToken 续租与释放；覆盖 success/error full-turn window；
  stale/non-owner release 不得释放当前 lease。对象引用相等不是必需条件。

AC-NO-SECOND-LOCK-OR-DEDUP
  connector/bridge 无第二 lock、LRU、queue 或 dedup；ProcessingLease 管 in-flight，SeenCache 管
  committed duplicate。

AC-TEMPORARY-FORK-MIGRATION
  reviewed fork runtime revision 可作为临时 immutable install authority；upstream CLA pending 只阻塞
  upstream PR merge。未来迁移到 official npm release 必须另做 independent compatibility review，
  不得仅按 version string 自动切换。
```

配套保留/强化：

```text
AC-SDK-FROZEN-CONFIG
  batch=0 / chatQueue disabled / stale disabled / requireMention=false /
  respondToMentionAll=true / includeRawEvent=true / one SDK dedup authority 全部被测试锁定。

AC-NO-AUTHORITY-DRIFT
  Router/AgentProcess/Binding/v2-ingress-gate/workspace/Kernel 文件 diff = 0；无第二 queue、
  dedup、normalization、WebSocket、Binding 或 session authority。
```

---

## 10. Non-Goals and Prohibitions

```text
PR #16 modification in this Spec round
packages/** modification in authoring/finalize rounds
test-app use in authoring/finalize rounds
deployment / production state change / implementation merge in Spec rounds

per-group no-mention UX
typing/reaction lifecycle
markdown/post/streaming/card/media UX activation
Phase B governing scope

SDK chat queue enablement
custom LRU or second dedup
second wire normalization
rawClient / private SDK field access
dual WebSocket / legacy transport flag
Router / AgentProcess / Binding / ingress-gate / Workspace / Kernel change
```

---

## 11. Migration, Rollback, and Package Policy

除旧 package/install authority 被以下双 revision 合同替换外，V1 §11–§12 的 migration、rollback 与
cutover gates 原样承接：

```text
SDK_PACKAGE_MANIFEST_VERSION = 0.5.0
SDK_SOURCE_AUTHORITY = bd24f6742513769c80b5401b96ad464d74dd2027
SDK_RUNTIME_INSTALL_AUTHORITY = ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f
AGENT_CORE_DEPENDENCY_SPECIFIER = https://github.com/mayf3/channel-sdk-node.git#ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f
DEPENDENCY_PIN_KIND = EXACT_IMMUTABLE_GIT_COMMIT
INSTALL_SCRIPTS = DISABLED
REMOTE_GIT_INSTALL_IGNORE_SCRIPTS = PASS
REMOTE_NPM_CI_IGNORE_SCRIPTS = PASS
PREPARE_EXECUTED = NO
TEMPORARY_REVIEWED_FORK_RUNTIME = ALLOWED
CLA_STATUS = PENDING
SDK_UPGRADE_REVIEW = INDEPENDENT_COMPATIBILITY_REVIEW
INDEPENDENT_COMPATIBILITY_REVIEW_REQUIRED = YES
NO_NEW_PERSISTENT_PRODUCT_STATE = REQUIRED
BINDING_STORE_NO_MIGRATION = REQUIRED
ROLLBACK = RESTORE_PREVIOUS_VERIFIED_COMMIT
NO_DUAL_BACKEND_FLAG = REQUIRED
CUTOVER_GATES = GOLDEN_VECTORS + UNIT + INTEGRATION + TEST_APP + PRODUCTION_CANARY
```

runtime revision 的 parent 精确为 source revision、ahead-by-one，reviewed diff 仅新增六个 `dist/**`
artifact；package manifest 仍为 `@larksuite/channel@0.5.0`。review evidence 已覆盖六文件集合、可复现
build、文件与 hash 相等、secret scan、absolute-path scan 与 source-map 检查。Agent Core 安装必须
禁用 lifecycle scripts，`prepare` 不执行而运行时仍可直接 import/require committed dist。

temporary reviewed fork 被明确允许。`CLA = PENDING` 只阻塞 upstream PR #15 merge，不阻塞此 exact
reviewed runtime revision 的临时安装；未来 official npm release 即使版本仍为 `0.5.0`，也必须经过
独立 compatibility review 后才能替换，不得自动漂移。

V2 只把 test-app create-thread product semantics 明确升为 mandatory pre-production gate；不在本
Spec round 执行该 gate。

---

## 12. Risks

| 风险 | V2 gate |
|---|---|
| `requireMention=false` 被误读成 no-mention UX activation | §4 adapter eligibility + AC-NO-MENTION-STILL-DROPPED；Phase B remains NO |
| queue-disabled transport Promise 被误当 full-turn Promise | §6 明确双 Promise 语义 + real-SDK pending-turn test |
| bridge 未把 current Router failure outcome 维持为 handler failure | §6.2 current-main integration seam + 真实 public error exactly-once test |
| renewable lease 被错误释放或续租停止过早 | tokenized exact release + TTL/renew boundary tests；禁止第二 lock/dedup |
| temporary fork 或 lockfile 漂移到未评审对象 | exact 40-char runtime coordinate + scripts-disabled clean install + full lockfile inspection |
| raw metadata lookup 重新长成第二 normalizer | §5 字段投影边界 + production-source inspection |
| SDK-native reply thread 语义与旧 create+root_id 不等价 | test app mandatory；production canary 前 fail closed；rawClient 未授权 |

---

## 13. Independent Review and Acceptance Finalize Protocol

独立 reviewer 必须同时读取：

- 本 V2 proposed commit；
- V1 与前置 Investigation；
- PR #16 historical `REVIEW_BASE` / `REVIEWED_HEAD` diff 与测试；
- current main `fe2c6393915b1dc61c4c3d25b2996d2f258ba484` 的 Router/AgentProcess/compose authority；
- upstream SDK source `bd24f6742513769c80b5401b96ad464d74dd2027` 的 policy/safety/normalize/
  outbound/channel source；
- reviewed runtime `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f` 的 parent、dist-only diff、package、
  scripts-disabled install 与 runtime evidence。

review 输出至少包含：

```text
REVIEWER_IDENTITY
REVIEW_BASE_COMMIT
REVIEWED_SPEC_COMMIT
REVIEW_VERDICT = PASS | FIX_REQUIRED
BLOCKERS
OWNER_DECISION_REQUIRED
SEMANTIC_REVIEW_COMPLETE = YES | NO
VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC | FIX_REQUIRED
```

只有 `PASS + BLOCKERS=NONE + SEMANTIC_REVIEW_COMPLETE=YES` 才允许 acceptance-finalize：

1. 本文件 `status: proposed -> accepted`；
2. 记录 `accepted_reviewed_head` / reviewer identity / verdict；
3. V1 frontmatter `status: accepted -> superseded` +
   `replaced_by: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2`；
4. 除这些 lifecycle/review metadata 外，reviewed V2 contracts/AC/scope 字节不变；V1 正文不变；
5. `SEMANTIC_CHANGE_AFTER_REVIEW = NONE`；
6. finalize commit merge main 后，才可更新 PR #16。

若 review 为 FIX_REQUIRED，先做 Spec-only amendment，再针对新 commit focused independent re-review；
不得把 fix 与 acceptance 状态翻转合并为一次未评审语义变化。

---

## 14. Review History

```text
REVIEWER_IDENTITY = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2_SPEC_REVIEW
REVIEW_BASE_COMMIT = eaebb28df4e5a67ecbcfe6f3990fe276ff11acd1
REVIEWED_SPEC_COMMIT = 963fef3af6c722fe49266f122373d4d31248ca83
AUTHORING_SPEC_COMMIT = 963fef3af6c722fe49266f122373d4d31248ca83
FIRST_AMENDMENT_SPEC_COMMIT = 8aa308f7dca58c4d801682530f8b9725a096239a
REVIEW_VERDICT = FIX_REQUIRED
SEMANTIC_REVIEW_COMPLETE = YES

BLOCKERS =
  1. exact SDK 0.5.0 swallows queue-disabled onMessage throw into logger;
     the frozen real channel.on('error') requirement has no authorized public implementation path
  2. exact SDK ProcessingLock TTL = 300000ms without renewal/config surface;
     Router default full-turn timeout = 300000ms and may be configured longer
  3. proposed text omitted SDK_RESPOND_TO_MENTION_ALL=true and misstated SDK pipeline order

BLOCKER_3_DISPOSITION = FIXED_IN_SPEC_AMENDMENT
BLOCKER_1_DISPOSITION_AT_8AA308F = OWNER_DECISION_REQUIRED
BLOCKER_2_DISPOSITION_AT_8AA308F = OWNER_DECISION_REQUIRED
READY_FOR_FOCUSED_RE_REVIEW_AT_8AA308F = NO
```

上述是 `963fef3af6c722fe49266f122373d4d31248ca83` review 与
`8aa308f7dca58c4d801682530f8b9725a096239a` 首次 amendment 的历史记录，不因本轮删除或改写。之后 Owner
停止旧路线，要求基于 reviewed upstream source/runtime revision 与 current-main semantic authority 做
reconciliation。本轮不放松公开 error/renewable lock/full-turn 合同；reviewed revisions 以实现这些合同
的公共 surface 关闭原 blocker：

```text
RECONCILIATION_BASE_MAIN = fe2c6393915b1dc61c4c3d25b2996d2f258ba484
RECONCILED_FROM_SPEC_COMMIT = 8aa308f7dca58c4d801682530f8b9725a096239a

BASE_DRIFT_STOP = STOPPED at 8aa308f7dca58c4d801682530f8b9725a096239a because current main changed AgentProcess full-turn semantics
BASE_DRIFT_RECONCILIATION = current main fe2c6393915b1dc61c4c3d25b2996d2f258ba484 reviewed; COMPATIBLE_AFTER_EXPLICIT_RECONCILIATION
SDK_SOURCE_GATE = CLOSED by bd24f6742513769c80b5401b96ad464d74dd2027 review PASS
SDK_RUNTIME_GATE = CLOSED by ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f packaging review PASS

OWNER_BLOCKER_ERROR_SURFACE = CLOSED_BY_REVIEWED_SOURCE_REVISION
OWNER_BLOCKER_PROCESSING_LOCK = CLOSED_BY_REVIEWED_SOURCE_REVISION
RUNTIME_PACKAGING_GATE = CLOSED_BY_REVIEWED_RUNTIME_REVISION
OWNER_DECISION_REQUIRED = NONE

READY_FOR_FOCUSED_RE_REVIEW = YES
SPEC_STATUS = proposed
IMPLEMENTATION_AUTHORIZED = NO
PR16_REVISION_IN_THIS_ROUND = NO
TEST_APP_OR_CANARY_IN_THIS_ROUND = NO
READY_FOR_PR16_REVISION = NO
READY_FOR_TEST_APP_CANARY = NO
```

`SPEC_STATUS` 仍为 `proposed`：关闭 prior blockers 只使新 commit 可 focused re-review，不构成 review
PASS、acceptance-finalize、implementation authority、PR #16 revision、test-app/canary、merge 或 production
activation。

focused re-review PASS 后，本轮仅执行下述 acceptance metadata：

### 14.1 Acceptance Finalize

```text
ACCEPTED_REVIEWED_HEAD = fa92987206c6bd5a8baf7a12b299d9cc088d72d2
REVIEW_BASE_MAIN = fe2c6393915b1dc61c4c3d25b2996d2f258ba484
REVIEWER_IDENTITY = CODEX_AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2_FOCUSED_RE_REVIEW_2026_08_20
REVIEW_VERDICT = PASS
BLOCKERS = NONE
OWNER_DECISION_REQUIRED = NONE
SEMANTIC_REVIEW_COMPLETE = YES
SEMANTIC_CHANGE_AFTER_REVIEW = NONE

SPEC_STATUS = accepted
SUPERSESSION_EXECUTED = YES
SUPERSESSION_CHAIN_COMPLETE = YES
FINAL_ACCEPTED_HEAD = SEE_THIS_FINALIZE_COMMIT_AND_PR_DESCRIPTION
ACCEPTED_AT = 2026-08-20T01:09:45Z

PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
PR16_CHANGE = NONE
MERGE = NONE
```

`FINAL_ACCEPTED_HEAD` 采用仓库既有 acceptance-finalize 格式，在本 finalize commit 产生后由该 Git
object identity 与 Draft PR 描述记录完整 SHA；commit 不能在自身内容中预填或伪造自身 SHA。

---

## 15. Related

- `docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1.md`
- `docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md`
- `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md`
- `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`
- PR #16 `feat: cut over Feishu foundation to official Lark Channel SDK`
- upstream SDK PR #15 source `bd24f6742513769c80b5401b96ad464d74dd2027`
- reviewed runtime install revision `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`
