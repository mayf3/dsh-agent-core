---
spec_id: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
status: proposed
supersedes: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
date: 2026-08-19
type: implementation-spec (spec-only; no implementation in authoring/finalize rounds)
scope: docs-only — supersede V1 only where PR #16 review evidence requires corrected Phase A contracts;
  preserve every other V1 authority, boundary, package pin, migration, rollback, and Phase B exclusion
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
> REVIEW_BASE = `5cfb61025641f8ec2430d0b9d39ad0cb8348124e`  
> REVIEWED_HEAD = `8962113bc9aba3557a384b03d010111f1201aabb`  
> IMPLEMENTATION_REVIEW_IDENTITY = `CODEX_PR16_INDEPENDENT_REVIEW_2026-08-19`
>
> 本 Spec 在 authoring round 只新增本文件。`PRODUCT_CODE_CHANGE = NONE`、
> `DEPENDENCY_CHANGE = NONE`、`DEPLOYMENT = NONE`、`PRODUCTION_STATE_CHANGE = NONE`。
> 不修改 PR #16，不使用 test app，不部署，不 merge implementation。
>
> `origin/main` 在 PR #16 的历史 base 之后已前进到 `eaebb28`；PR #16 Head 仍精确为
> `8962113`，其与当前 main 的 merge-base 仍精确为 `5cfb610`。本 Spec 的 review evidence
> 只绑定上述精确对象，不把当前 main 或 PR 分支的未来移动冒充为已评审内容。

---

## 0. Final Output（authoring round）

```text
SPEC_STATUS = proposed
SUPERSEDES = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
IMPLEMENTATION_AUTHORIZED = NO

PHASE_A_FOUNDATION_CUTOVER = PRESERVE_WITH_V2_CONTRACT_CORRECTIONS
PHASE_B_UX_PERMISSION = NO

PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
PR16_CHANGE = NONE
```

V2 accepted 且进入 implementation base branch 之前，原 Implementation Agent 不得基于本
Spec 改动 PR #16。

---

## 1. Problem and New Evidence

V1 的方向仍正确：以 `@larksuite/channel@0.5.0` 替换自维护 Feishu transport foundation，
只做 Phase A compatibility cutover，Phase B UX activation 不授权。但 PR #16 在精确 Head
`8962113` 的独立 Implementation Review 暴露出四项 blocker 与一项 Owner decision：

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

`NEW_EVIDENCE` 不只来自 review 结论。V2 author 重新读取官方 SDK 固定源码
`larksuite/channel-sdk-node @ d41b81c350d4c4df27d26d94dcd7b24bc96cef8a`：

| SDK source fact | 对 V2 的约束 |
|---|---|
| `src/safety/policy-gate.ts` 先执行 `requireMention && !mentionedBot`，之后才检查 `mentionAll/respondToMentionAll` | `requireMention=true` 时，`@all-only` 无法被 `respondToMentionAll=true` 挽救 |
| `src/safety/index.ts` queue-disabled 分支以 `void dispatchHandler(...)` fire-and-forget | SDK push/WS dispatcher 的 Promise 返回不等于 Agent turn 完成 |
| 同文件 `dispatchHandler` 内 `await onMessage`，`finally` 才 SeenCache.add + ProcessingLock.release | bridge Promise 必须覆盖 Router full turn；否则 dedup/lock 只覆盖提前完成的 adapter |
| 同文件会捕获 handler throw 并只记 logger；queue-disabled 时 `src/channel.ts` 的 outer dispatcher 已提前返回，不能把该 throw 转成 `error` event | Owner 要求的 SDK `error` event 不是 0.5.0 自动提供的结果；实现必须真实闭合 `channel.on('error')` 可观察性，无法闭合即停 `OWNER_DECISION_REQUIRED` |
| `src/outbound/sender.ts` 有 `replyTo` 时调用 `im.v1.message.reply` + `reply_in_thread`；无 `replyTo` 时才调用 `im.v1.message.create`，高阶 surface 无 `root_id` 参数 | `create_thread` 应冻结产品结果，不再冻结 endpoint identity；等价性必须由 test app 实测 |
| `NormalizedMessage`/`MentionInfo`/`ResourceDescriptor` 未暴露 V0 的所有身份与附件字段，但 `includeRawEvent` 可附原 event | 允许读取 raw metadata，但不得恢复第二套 wire normalization |

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
V1_PACKAGE_PIN = PRESERVE (@larksuite/channel exactly "0.5.0" @ d41b81c)
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
REVIEWED_SDK_BASELINE = 0.5.0 @ d41b81c
SDK_BATCH_DELAY_MS = 0
SDK_CHAT_QUEUE = DISABLED
SDK_STALE_DROP = DISABLED
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
  -> SDK dedup + ProcessingLock
  -> SDK PolicyGate(requireMention=false)
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
   `channel.on('error')` observer 断言。logger-only、connector-only callback 或“等价错误面”均不算
   通过。若 `@larksuite/channel@0.5.0` 的公开 surface 无法满足，Implementation Agent 必须停止并
   报告 `OWNER_DECISION_REQUIRED`；不得靠 rawClient、私有字段、logger 字符串解析或第二套
   queue/dedup 近似实现。

`AgentProcess` 现有 per-Agent promise chain 不修改；它仍是唯一产品级串行 authority。SDK
ProcessingLock 仅负责同一 messageId 的并发重投，不得扩张为按 chat/Agent 的产品队列。

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
包括 SDK `ProcessingLock` TTL 边界；只做远短于 TTL 的短 pending test 不足以证明“直到 Promise
settle 前保持”。若 exact SDK pin 与现有 Agent turn timeout 无法满足该不变量，仍须停止并报
`OWNER_DECISION_REQUIRED`，不得新增第二把 adapter lock。

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
  SeenCache mark 发生在 Router settle 后；覆盖产品支持的最大 turn window 与 SDK lock TTL 边界。
  真实 channel.on('error') observer 可见 Router failure，logger-only 不算通过。

AC-FULL-INGRESS-DIFFERENTIAL
  §5 全字段矩阵覆盖 V0 supported msg_type、p2p/group/topic、@bot/@all、sender identity triple、
  attachment metadata、timestamp seconds/milliseconds、event_id fallback 和 raw availability；
  差分全部通过，production source 无第二 wire normalizer。

AC-CREATE-THREAD-TEST-APP-PENDING
  Spec authoring/finalize 明确 PENDING；implementation cutover gate 必须用真实 test app 证明 §7
  四项产品结果。未通过不得 production canary；失败时 OWNER_DECISION_REQUIRED，rawClient 禁止。
```

配套保留/强化：

```text
AC-SDK-FROZEN-CONFIG
  batch=0 / chatQueue disabled / stale disabled / requireMention=false /
  includeRawEvent=true / one SDK dedup authority 全部被测试锁定。

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

V1 §11–§12 全部原样承接：

```text
SDK_VERSION_PIN = exactly "0.5.0"
SDK_UPGRADE_REVIEW = INDEPENDENT_COMPATIBILITY_REVIEW
NO_NEW_PERSISTENT_PRODUCT_STATE = REQUIRED
BINDING_STORE_NO_MIGRATION = REQUIRED
ROLLBACK = RESTORE_PREVIOUS_VERIFIED_COMMIT
NO_DUAL_BACKEND_FLAG = REQUIRED
CUTOVER_GATES = GOLDEN_VECTORS + UNIT + INTEGRATION + TEST_APP + PRODUCTION_CANARY
```

V2 只把 test-app create-thread product semantics 明确升为 mandatory pre-production gate；不在本
Spec round 执行该 gate。

---

## 12. Risks

| 风险 | V2 gate |
|---|---|
| `requireMention=false` 被误读成 no-mention UX activation | §4 adapter eligibility + AC-NO-MENTION-STILL-DROPPED；Phase B remains NO |
| queue-disabled transport Promise 被误当 full-turn Promise | §6 明确双 Promise 语义 + real-SDK pending-turn test |
| SDK handler-error 内部 containment 使 Router failure 不进入公开 error surface | §6 fail-closed implementation gate；禁止 logger-string/private/rawClient workaround，无法满足即 Owner decision |
| SDK ProcessingLock 生命周期或 TTL 无法覆盖支持的 full turn | AC-PROCESSING-LOCK-COVERS-TURN；真实 SDK 受控 pending-turn/duplicate 证明，不能证明即停止 cutover |
| raw metadata lookup 重新长成第二 normalizer | §5 字段投影边界 + production-source inspection |
| SDK-native reply thread 语义与旧 create+root_id 不等价 | test app mandatory；production canary 前 fail closed；rawClient 未授权 |

---

## 13. Independent Review and Acceptance Finalize Protocol

独立 reviewer 必须同时读取：

- 本 V2 proposed commit；
- V1 与前置 Investigation；
- PR #16 `REVIEW_BASE` / `REVIEWED_HEAD` diff 与测试；
- 官方 SDK 精确 `d41b81c` 的 policy/safety/normalize/outbound/channel source。

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

## 14. Related

- `docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1.md`
- `docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md`
- `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md`
- `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`
- PR #16 `feat: cut over Feishu foundation to official Lark Channel SDK`
- official SDK `larksuite/channel-sdk-node @ d41b81c350d4c4df27d26d94dcd7b24bc96cef8a`
