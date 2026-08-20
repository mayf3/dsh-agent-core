---
spec_id: AGENT_CORE_LARK_UX_PHASE1_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/dsh-agent-core
  - packages/feishu-connector
  - packages/agent-router/src/index.js
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
date: 2026-08-20
type: ux-activation-spec (spec-only; no implementation in authoring round)
builds_upon: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 (accepted; foundation authority)
references:
  - >-
    docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md (accepted on main;
    forward-only Spec format and authority protocol)
  - >-
    docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md (accepted; Phase A foundation
    authority; accepted content present on main at e1ae7fdc5e7dabcba17819c02935395a5f19e9b0)
  - >-
    docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1.md (superseded; §1.3/§5.2 froze
    THIS spec id as the sole Phase B governing spec placeholder; §10 outbound contracts)
  - >-
    docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md (PASS; evidence
    authority for the SDK outbound/mention primitives inventory)
  - >-
    docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md (accepted; PREBOUND_ONLY authority — unchanged)
---

# AGENT_CORE_LARK_UX_PHASE1_V2 — 飞书第一轮 UX 激活：Markdown 出站 + 回复自动 @ 触发发送者（只出 Spec，不实现）

> 性质：**UX activation Spec（SPEC ONLY — 本轮只撰写本 Spec，不 implementation / 不部署 / 不 merge）**  
> 日期：2026-08-20 · 仓库：`mayf3/dsh-agent-core` · 分支：`docs/lark-ux-phase1-v2-spec`  
> AUTHORING_BASE_MAIN = `f8ec58dad8f51ff1107326723981bb174254f74d`（历史 authoring 坐标）
> GOVERNANCE_RECONCILIATION_MAIN = `34d7c73456f2b177b8ad042e67359bc86fae8861`
> GOVERNANCE_AUTHORITY_MERGE = `2f8bdad2cfa22d91e1eed9597d053eeb031e63ea`
> PHASE_A_SOURCE_EVIDENCE_HEAD = `cce18f3aa8c0836d3255c0514de86bda4dbd961b`
>（历史 source evidence only；不是 implementation precondition authority）
> SDK_SOURCE_AUTHORITY = `bd24f6742513769c80b5401b96ad464d74dd2027`（outbound 原语合同引用基准）  
> SDK_RUNTIME_INSTALL_AUTHORITY = `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`（不变，V2 §11）  
>
> **实现前置（冻结）**：同一个 implementation base 必须是 `main` 的 descendant，并同时包含
> (1) 本 UX Spec 的 accepted exact content 与 (2) 已 merge 到 main 的 Phase A foundation。
> PR number / branch / historical candidate Head 均不是硬前置或 authority。
>
> 本轮 authoring：`PRODUCT_CODE_CHANGE = NONE`、`DEPENDENCY_CHANGE = NONE`、
> `DEPLOYMENT = NONE`、`PRODUCTION_STATE_CHANGE = NONE`、`MERGE = NONE`、
> `FOUNDATION_CHANGE = NONE`。仅修改本 Spec。
>
> **Owner amendment（2026-08-20）**：`D-U1 = APPROVED`。本 amendment 仅把 Owner
> 对 §5.3 最小 Router seam 的批准写回本 proposed Spec；不 acceptance-finalize、不实现。
> `PR_DRAFT_AT_FOCUSED_REVIEW = YES`；proposed Spec 在独立 review 与 acceptance-finalize
> 完成前必须保持 Draft，不得以 Ready for review 表达可直接合并。
>
> **Focused review amendment（2026-08-20）**：
> `REVIEWER_IDENTITY = CODEX_PR24_LARK_UX_PHASE1_V2_SPEC_AUDIT_2026_08_20`，
> `REVIEWED_HEAD = 82871b6aa8c0734834bac5286f40e6eec14ddb9c`，
> `REVIEW_VERDICT = FIX_REQUIRED`，唯一 blocker = `TARGET_REVOKED_CONTRACT`。
> Owner 裁决 `TARGET_REVOKED_DISPOSITION = ACCEPT_SDK_NATIVE_TOP_LEVEL_FALLBACK`；
> 本 amendment 仅修正文档合同并补强 dedicated test-app AC，不 acceptance-finalize、不实现。
>
> **Retry-semantics focused amendment（2026-08-20）**：
> `PREVIOUS_REVIEWER = CODEX_PR24_TARGET_REVOKED_FOCUSED_REVIEW_2026_08_20`，
> `REVIEWED_HEAD = 7c07e9c50a6da1a8543f606b5f5614d78a273c03`，
> `PREVIOUS_VERDICT = FIX_REQUIRED`，唯一 blocker =
> `TARGET_REVOKED_FALLBACK_RETRY_POLICY`。Owner 裁决
> `RETRY_SEMANTICS_DISPOSITION = ACCEPT_SDK_BOUNDED_TRANSPORT_RETRY`；本 amendment
> 只把 logical fallback 与 SDK transport attempt 分层，不改变 UX scope，不实现。
>
> **Governance/base/test reconciliation（2026-08-21）**：删除 historical PR-number hard precondition；
> 增加独立 `AC/T-SDK-ATTEMPTS-EXHAUSTED`；按 accepted
> `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` 补齐 frontmatter、authority 与 future-base
> reconciliation。本轮仍为 proposed / Draft，不 acceptance-finalize、不实现。

---

## 0. Final Output（authoring round）

```text
SPEC_STATUS = proposed
BUILDS_UPON = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 (accepted)
IMPLEMENTATION_AUTHORIZED = NO
IMPLEMENTATION_PRECONDITION_1 = UX_SPEC_ACCEPTED_EXACT_CONTENT_PRESENT_ON_MAIN
IMPLEMENTATION_PRECONDITION_2 = PHASE_A_FOUNDATION_MERGED_ON_MAIN
IMPLEMENTATION_BASE = MAIN_DESCENDANT_SATISFYING_BOTH_PRECONDITIONS
PR_NUMBER_HARD_PRECONDITION = NONE

MARKDOWN_SCOPE_FROZEN = YES
OUTBOUND_MENTION_SCOPE_FROZEN = YES
ROUTER_CHANGE_REQUIRED = YES_MINIMAL
MINIMAL_ROUTER_SEAM = single successful-reply call-site UX opts (§5.3)
D_U1 = APPROVED
OWNER_DECISION_REQUIRED = NONE
ROUTER_AUTHORITY_CHANGE = NONE
ROUTER_PRODUCT_ROUTING_CHANGE = NONE
TARGET_REVOKED_DISPOSITION = ACCEPT_SDK_NATIVE_TOP_LEVEL_FALLBACK
RETRY_SEMANTICS_DISPOSITION = ACCEPT_SDK_BOUNDED_TRANSPORT_RETRY
TARGET_REVOKED_LOGICAL_FALLBACK_INVOCATIONS = EXACTLY_ONE
SDK_OUTBOUND_RETRY_MAX_ATTEMPTS = 3
CONNECTOR_OWNED_RETRY = NONE
CONNECTOR_OWNED_SECOND_FALLBACK = NONE
TARGET_REVOKED_FALLBACK =
  REMOVE_REPLY_TO
  THEN_SAME_CHAT_TOP_LEVEL_SEND
THREAD_OR_REPLY_ANCHOR_PRESERVATION = NOT_GUARANTEED_WHEN_TARGET_REVOKED
SAME_CHAT_PRESERVATION = REQUIRED_PER_ATTEMPT
CONTENT_RENDERING_AND_MENTIONS = PRESERVED_PER_ATTEMPT
VISIBLE_EXACTLY_ONCE_DELIVERY = NOT_CLAIMED
AMBIGUOUS_UNKNOWN_OUTCOME = OUTCOME_UNKNOWN
SDK_RETRYABLE_ERRORS =
  RATE_LIMITED
  UNKNOWN
SDK_ATTEMPTS_EXHAUSTED =
  FAIL_LOUD
  NO_CONNECTOR_RETRY
  NO_AUTOMATIC_REPLAY
PERMISSION_DENIED = FAIL_LOUD
FORMAT_ERROR = EXACTLY_ONCE_PLAIN_TEXT_FORMAT_FALLBACK
RAW_CLIENT = FORBIDDEN
DIRECT_NODE_SDK_FALLBACK = FORBIDDEN

PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
MERGE = NONE
```

---

## 0.1 Authority and Dependencies（governance reconciliation）

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_KIND = implementation
AUTHORITY_LEVEL = governing_spec
GOVERNANCE_FORMAT_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
GOVERNANCE_AUTHORITY_STATUS = accepted_on_main
GOVERNANCE_AUTHORITY_MERGE = 2f8bdad2cfa22d91e1eed9597d053eeb031e63ea
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
LOCAL_PRODUCT_PARENT_AUTHORITY = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
LOCAL_PRODUCT_PARENT_STATUS = accepted_on_main
IMPLEMENTATION_AUTHORITY = contracts
CURRENT_SPEC_STATUS = proposed
CURRENT_IMPLEMENTATION_AUTHORIZED = NO
EXTERNAL_GOVERNING_AUTHORITIES = NONE
AUTHORITY_CONFLICT = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
AUTHORING_READY_FOR_REVIEW = YES
```

`implementation_authority: contracts` 只表示：本 Spec 经独立 review、Owner acceptance，且
accepted exact content 已进入 authority branch `main` 后，其 Contracts 才可能授权边界内
implementation。当前 `status: proposed` 与 Draft PR 不授予任何实现权限。

`@larksuite/channel` 的 pinned source/runtime revisions 是 dependency/source-evidence 坐标，
不是可替本仓库执行 acceptance 的 external governing authority。历史 candidate Head 同样只作
source evidence；长期实现前置只由 §8 的 main-base reconciliation 判定。

---

## 1. Problem and Positioning

### 1.1 历史现状观察（source-verified @ evidence Head `cce18f3`）

1. **出站是纯文本**：`feishu.reply(replyTarget, text)` → `replyTargetToSdkSend` 产出
   `{ input: { text } }` → SDK `sendText`（`msg_type:"text"`）。Agent 的 markdown 输出
   （标题/列表/代码块/链接）在飞书里以原始字符显示，无富文本渲染。
2. **群聊回复无 @ 提醒**：group/topic 中 bot 的回复不 @ 触发该轮的人类发送者，被回复者
   无飞书原生提醒，多人群聊中回复归属不明。
3. **Phase A 已冻结一切 UX 激活**：V1 §5.2 / V2 §10 把 markdown/post activation 与一切
   UX 编排排除在 Foundation 之外，并把 Phase B governing spec 名字冻结为**本 Spec**。
   旧 Phase1 的 Part A/B/C 产品目标已显式映射到本 Spec（V1 §1.3 映射不变量：SUPERSEDE
   不得让产品目标无声消失）。

### 1.2 本 Spec 授权范围（第一轮 UX，只有两件事）

```text
UX_ROUND_1_SCOPE =
  1. OUTBOUND MARKDOWN — Agent turn 回复默认以 SDK markdown 原语富文本渲染（§3）
  2. OUTBOUND AUTO-MENTION — group/topic 中 bot 回复自动 @ 触发该 turn 的人类发送者（§4）
```

### 1.3 未消费的 Phase B 积压（继续冻结，本 Spec 不授权）

旧 Part A（bound group configurable no-mention）、旧 Part B（typing reaction lifecycle）、
streaming card、thinking card、question/plan/tool approval 卡片、file/media delivery、
`/cd` `/model` `/status` 命令面、dsh-lark ConversationSessions、第二 Agent lifecycle——
全部继续无许可（§9 Non-Goals）。它们的 governing authority 仍留在未来 UX Spec；
本 Spec 不因占据 `AGENT_CORE_LARK_UX_PHASE1_V2` 之名而吸收或删除这些产品目标
（承接 V1 §1.3 映射不变量的义务：留在积压，不无声消失）。

---

## 2. Frozen Owner Rulings（machine-readable 汇总）

```text
# ── 一、文本格式 ──────────────────────────────────────────
OUTBOUND_DEFAULT_RENDERING = SDK_MARKDOWN          # §3.1
MARKDOWN_PRIMITIVE = SDK send({ markdown }) -> markdownToPost -> msg_type:"post"
MARKDOWN_RENDERING_AUTHORITY = @larksuite/channel builtin (single 'md' element;
  Feishu native renderer)                          # §3.2
CUSTOM_MARKDOWN_CONVERTER = NO                     # §3.2 (config.markdownConverter 不设置)
DIRECT_NODE_SDK_RESTORE = NO
RAW_CLIENT = FORBIDDEN
STREAMING_CARD = NO
SECOND_OUTBOUND_TRANSPORT = NO
RECEIPT_RENDERING = PLAIN_TEXT_UNCHANGED           # §3.4
SCHEDULER_DELIVERY_RENDERING = TEXT_UNCHANGED      # §3.4
MARKDOWN_FORMAT_ERROR_FALLBACK = EXACTLY_ONCE_LOGICAL_MARKDOWN_TO_TEXT   # §3.5
FORMAT_ERROR = EXACTLY_ONCE_PLAIN_TEXT_FORMAT_FALLBACK
TARGET_REVOKED_DISPOSITION = ACCEPT_SDK_NATIVE_TOP_LEVEL_FALLBACK   # §3.5
RETRY_SEMANTICS_DISPOSITION = ACCEPT_SDK_BOUNDED_TRANSPORT_RETRY   # §3.5
TARGET_REVOKED_LOGICAL_FALLBACK_INVOCATIONS = EXACTLY_ONE
SDK_OUTBOUND_RETRY_MAX_ATTEMPTS = 3
CONNECTOR_OWNED_RETRY = NONE
CONNECTOR_OWNED_SECOND_FALLBACK = NONE
TARGET_REVOKED_FALLBACK = REMOVE_REPLY_TO_THEN_SAME_CHAT_TOP_LEVEL_SEND
THREAD_OR_REPLY_ANCHOR_PRESERVATION = NOT_GUARANTEED_WHEN_TARGET_REVOKED
SAME_CHAT_PRESERVATION = REQUIRED_PER_ATTEMPT
CONTENT_RENDERING_AND_MENTIONS = PRESERVED_PER_ATTEMPT
VISIBLE_EXACTLY_ONCE_DELIVERY = NOT_CLAIMED
AMBIGUOUS_UNKNOWN_OUTCOME = OUTCOME_UNKNOWN
SDK_RETRYABLE_ERRORS =
  RATE_LIMITED
  UNKNOWN
SDK_ATTEMPTS_EXHAUSTED =
  FAIL_LOUD
  NO_CONNECTOR_RETRY
  NO_AUTOMATIC_REPLAY
PERMISSION_ERROR_FAIL_LOUD = YES                   # §3.5
PERMISSION_DENIED = FAIL_LOUD
LONG_TEXT_CHUNKING = SDK_NATIVE_FIDELITY           # §3.6

# ── 二、出站自动 @ ────────────────────────────────────────
GROUP_REPLY_AUTO_MENTION_TRIGGERING_SENDER = YES   # §4.1
TOPIC_REPLY_AUTO_MENTION_TRIGGERING_SENDER = YES   # §4.1
P2P_AUTO_MENTION = NO                              # §4.1
MENTION_IDENTITY_AUTHORITY = INGRESS_EVENT_SENDER_OPEN_ID   # §4.2
PLAINTEXT_NAME_TO_MENTION_RESOLUTION = NO          # §4.2
SDK_RESOLVE_MENTIONS_IN_TEXT = OFF (never enabled) # §4.3
MENTION_PRIMITIVE = SDK SendOptions.mentions (openId-carrying entries only)      # §4.3
MENTION_EXCLUSIONS = §4.4 全表（receipts / notifications / proactive / 无可信 openId）

# ── 三、边界 ──────────────────────────────────────────────
ROUTER_CHANGE_REQUIRED = YES_MINIMAL
MINIMAL_ROUTER_SEAM = single successful-reply call-site UX opts (§5.3)
ROUTER_AUTHORITY_CHANGE = NONE
ROUTER_PRODUCT_ROUTING_CHANGE = NONE
D_U1 = APPROVED
OWNER_DECISION_REQUIRED = NONE
AGENT_PROCESS_CHANGE = NONE
BINDING_STORE_CHANGE = NONE
PREBOUND_ONLY_CHANGE = NONE
WORKSPACE_SESSION_AUTHORITY_CHANGE = NONE
KERNEL_CHANGE = NONE
V2_INGRESS_GATE_IMPLEMENTATION_CHANGE = NONE
```

---

## 3. Contract U1 — Outbound Markdown Rendering

### 3.1 默认渲染与其适用面

```text
OUTBOUND_DEFAULT_RENDERING = SDK_MARKDOWN
```

**唯一翻转为 markdown 的调用点**：Router `onIngress` 成功路径的 agent turn 回复
（historical Phase A evidence Head `cce18f3` 的 `packages/agent-router/src/index.js:691`，
`feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), reply)` —— 经 §5
最小 seam 加 UX opts）。该调用点的出站由 `channel.send(to, { markdown }, opts)` 承载。

**目标支持**（owner 冻结）：标题、粗体/斜体、有序/无序列表、引用、行内代码、
fenced code block、链接、简单表格、中文与英文混排。

### 3.2 渲染权威（单一）

SDK reviewed source（`bd24f67`）`src/outbound/markdown/to-post.ts:17-29`：`markdownToPost`
把整段 markdown 放进**单个 `tag:'md'` 元素**，由飞书原生渲染器渲染 bold/italic/code/
links/headings/lists/blockquotes/`<at>` mentions/code fences，并先经
`optimizeMarkdownStyle` 做视觉修正（超大 H1/H2、多余空行）。

```text
MARKDOWN_RENDERING_AUTHORITY = @larksuite/channel builtin
CUSTOM_MARKDOWN_CONVERTER = NO        # config.markdownConverter 保持 unset（builtin）
SECOND_RENDER_AUTHORITY = NO          # Agent Core 不写 markdown->post 转换器
```

**表格**：飞书 `md` 元素是否原生渲染 GFM 简单表格**不由源码断言**——这是真实设备行为，
冻结为 test-app 强制验证项（§7 T-MD-TABLE）。若实测表格不渲染，Implementation Agent
**停止并报 `OWNER_DECISION_REQUIRED`**；不得以 custom `markdownConverter` 自建转换器、
不得启用 rawClient、不得换 SDK。

### 3.3 禁止的替代路线（继承并重申）

```text
DIRECT_NODE_SDK_RESTORE = NO     # 不恢复直连 node-sdk client
RAW_CLIENT = FORBIDDEN           # 继承 V2 §7
DIRECT_NODE_SDK_FALLBACK = FORBIDDEN
STREAMING_CARD = NO              # 不引入 streaming/card 表面（channel.stream 禁用）
SECOND_OUTBOUND_TRANSPORT = NO   # reply seam 仍是唯一出站路径
```

### 3.4 固定 plain text 的消息（不翻转，字节不变）

| 消息 | 历史 Phase A evidence 路径（`cce18f3`） | 本 Spec 后 |
|---|---|---|
| unbound receipt（`INGRESS_GATE_REJECTED_REPLY`） | bridge `createReceiptReply` 直调 `channel.send`（`bridge.js:445-459`），不经过 `handle.reply` | **plain text 不变** |
| Router deterministic failure receipt（`[agent-core] delivery failed: …`） | `index.js:699`，同一 reply seam | **plain text 不变**（不传 UX opts，见 §5） |
| startup / configuration failure 回执 | 启动 fail-loud 路径（compose readiness / bridge startup） | **plain text 不变** |
| scheduler proactive 投递（`createFeishuDeliver` → `scheduler-router/src/index.js:178` `feishu.reply`） | text | **plain text 不变**（`SCHEDULER_DELIVERY_RENDERING = TEXT_UNCHANGED`；把 markdown 扩展到 scheduler 投递 = 未来 owner 决定，本 Spec 不做） |

冻结理由：owner 裁决「系统固定回执继续使用 plain text」+ 行为兼容原则——所有**未显式
opt-in** 的 `feishu.reply` 调用方行为与 Phase A 字节级一致（AC-EXISTING-CALLERS-UNCHANGED）。

### 3.5 Fallback 与错误合同

SDK reviewed source `src/outbound/sender.ts:317-335`（`sendOneWithFallback`）+
`src/outbound/retry.ts`（bounded transport retry）+ `src/outbound/errors.ts`
（`classifyError`）冻结如下产品合同：

```text
MARKDOWN_FORMAT_ERROR_FALLBACK = EXACTLY_ONCE_LOGICAL_MARKDOWN_TO_TEXT
FORMAT_ERROR = EXACTLY_ONCE_PLAIN_TEXT_FORMAT_FALLBACK
  # 触发类：feishu code 230002/230001、HTTP 400（errors.ts inferCode -> 'format_error'）
  # 机制：SDK builtin —— post 被拒后只进行一次 markdown -> plain text 的逻辑降级。
  # 边界："exactly once"只约束 format fallback invocation，不宣称底层网络只有一次请求；
  #        每个 SDK send leg 的 transport attempts 仍由 maxAttempts=3 policy 管理。
  #        connector 不增加 retry、第二 format fallback 或 automatic replay。
  # 降级保真：postToPlainText 保留 'md' 元素 text 原文（markdown 源字符可接受）；
  #        at-tag 前缀（若有）原文保留于 text 消息中，飞书 text 消息原生渲染 <at> 为真实 mention。

TARGET_REVOKED_DISPOSITION = ACCEPT_SDK_NATIVE_TOP_LEVEL_FALLBACK
RETRY_SEMANTICS_DISPOSITION = ACCEPT_SDK_BOUNDED_TRANSPORT_RETRY
TARGET_REVOKED_LOGICAL_FALLBACK_INVOCATIONS = EXACTLY_ONE
SDK_OUTBOUND_RETRY_MAX_ATTEMPTS = 3
CONNECTOR_OWNED_RETRY = NONE
CONNECTOR_OWNED_SECOND_FALLBACK = NONE
TARGET_REVOKED_FALLBACK =
  REMOVE_REPLY_TO
  THEN_SAME_CHAT_TOP_LEVEL_SEND
  # 触发：带 replyTo 的原 reply target 已撤回、删除或不可回复，SDK 分类为 target_revoked。
  # logical fallback：恰好调用一次；去掉 replyTo，在同一 chat 顶层发送。
  # transport：该 SDK send 可对 rate_limited / unknown 做 bounded retry，总 attempt 数 <= 3。
  # payload：每个 attempt 保持同一 Agent content、markdown/text rendering、outbound mentions。
  # 地址：每个 attempt 必须同一 chat；不得跨 chat / conversation。
  # anchor：THREAD_OR_REPLY_ANCHOR_PRESERVATION = NOT_GUARANTEED_WHEN_TARGET_REVOKED，
  #         因原 anchor 已不可用；这是唯一允许的定位降级。
  # 边界：connector 不得 retry、不得第二次 target-revoked fallback、不得 automatic replay。

SAME_CHAT_PRESERVATION = REQUIRED_PER_ATTEMPT
CONTENT_RENDERING_AND_MENTIONS = PRESERVED_PER_ATTEMPT
VISIBLE_EXACTLY_ONCE_DELIVERY = NOT_CLAIMED
  # transport response 丢失等 ambiguous unknown 下，不能证明服务端未送达，故不承诺可见恰好一次。
AMBIGUOUS_UNKNOWN_OUTCOME = OUTCOME_UNKNOWN
SDK_RETRYABLE_ERRORS =
  RATE_LIMITED
  UNKNOWN
SDK_ATTEMPTS_EXHAUSTED =
  FAIL_LOUD
  NO_CONNECTOR_RETRY
  NO_AUTOMATIC_REPLAY

TARGET_REVOKED_CONNECTOR_FALLBACK = FORBIDDEN
RAW_CLIENT = FORBIDDEN
DIRECT_NODE_SDK_FALLBACK = FORBIDDEN

PERMISSION_DENIED = FAIL_LOUD
PERMISSION_ERROR_FAIL_LOUD = YES
  # feishu 99991400/99991401、HTTP 401/403（permission_denied）不进入 target-revoked
  # 顶层发送；SDK 抛错 -> feishu.reply() reject（上抛）。unknown / rate_limited 由上述
  # bounded transport retry 管理，attempts 耗尽后同样 fail loud。
  # 继承 V1 §10 API_ERROR_FAIL_LOUD 与 Router catch 回执路径，语义不变。
  # 本 Spec 不为这些错误类增加任何 text 降级/掩蔽。

FORMAT_FALLBACK_OWNER = SDK
CONNECTOR_OWNED_FORMAT_FALLBACK = NONE
  # format_error 的 markdown -> text logical fallback 由 SDK 拥有；connector 不重试。
  # target_revoked 使用上述 SDK-native same-payload fallback，permission_denied 不 fallback。
```

**Owner 接受的 SDK-native 产品合同**：SDK
`sendOneWithFallback` 对「带 `replyTo` 且 reply target 已消失（230020/230017/404）」的
子情形内置降级——恰好一次 logical fallback：去掉 `replyTo`，以同一 chat 的顶层 create
发送（`sender.ts:322-324`）；该 send 内部对 `rate_limited` / `unknown` 可按 SDK policy
bounded retry，`maxAttempts=3`（`retry.ts`）。logical fallback 次数与 transport attempt
次数是两个不同维度。该行为自 Phase A 起即随 `channel.send` 生效；V1 §10 的
`DEGRADATION_MATRIX = NOT_RELIED` 仅描述 Foundation text-only 阶段。本 UX Spec 现明确
**依赖并接受**该 SDK-native 行为，不允许 connector 复制或包裹第二层 fallback。
若 SDK revision 不再满足 logical fallback 恰好一次、transport attempts 最大三次、
per-attempt same-chat / payload / mentions 保持或 attempts-exhausted fail-loud 终态，
implementation 必须停止并回独立 review；不得以 rawClient 或 direct node-sdk 补洞。

### 3.6 长文与分块

SDK reviewed source `src/outbound/markdown/splitter.ts:10-56` + `sender.ts:87-101,503-507`
冻结：

```text
LONG_TEXT_CHUNKING = SDK_NATIVE_FIDELITY
TEXT_CHUNK_LIMIT = 3500            # SDK 默认，不覆盖
IN_LIMIT_SINGLE_MESSAGE = REQUIRED # 限内消息永不拆分（单条送达）
OVER_LIMIT_COMPLETE_DELIVERY = REQUIRED   # 超限内容完整送达，不截断丢尾
CODE_FENCE_SAFE_SPLIT = REQUIRED   # 分块若落在 fenced code block 内：当前 chunk 闭合围栏、
                                   # 下 chunk 以同 language tag 重开（splitter.ts:19-31）
CHUNK_ORDER_STABLE = REQUIRED      # 顺序 = 文本顺序；正常路径的 anchored 续块链在上一 chunk
                                   # message id（replyTargetForChunk），保持 reply/thread 线；
                                   # target_revoked 时 anchor 例外仅按 §3.5 same-chat fallback
NO_CONTENT_LOSS = REQUIRED         # 链接与代码不得因分块丢失
MENTION_FIRST_CHUNK_ONLY = SDK_NATIVE  # mentions 只注入第一块（sender.ts:90：
                                   # i === 0 ? opts.mentions : undefined）
```

---

## 4. Contract U2 — Outbound Auto-Mention of the Triggering Sender

### 4.1 方向区分与适用面

```text
INBOUND_MENTION  = Phase A 已有（@bot / @all eligibility；V2 §4）——本 Spec 不改
OUTBOUND_MENTION = 本 Spec 新增：bot 回复时 @ 触发该 turn 的人类发送者

GROUP_REPLY_AUTO_MENTION_TRIGGERING_SENDER = YES
TOPIC_REPLY_AUTO_MENTION_TRIGGERING_SENDER = YES
P2P_AUTO_MENTION = NO
```

- group：agent turn 回复的第一块开头携带真实 `<at>`（可点击、原生提醒）。
- topic/thread：正常 anchor 可用时同上，且 mention 与回复一起留在 thread 内
  （不逃逸主群，§7 T-MT-TOPIC）；target_revoked 时原 anchor 已不可用，按 §3.5 只保证
  same chat 顶层 fallback，不保证 thread/reply anchor。
- p2p：**结构性排除**——connector 侧 `target.channel === 'p2p'` 永不注入 mention，
  即使调用方误传 opts 也不可能 @（防御性结构保证，非仅靠调用纪律）。
- `@all` 触发的 turn 同样适用：触发者 = `IngressEvent.sender`（发消息的人），
  不区分其以 @bot 还是 @all 触发。

### 4.2 身份权威（单一）

```text
MENTION_IDENTITY_AUTHORITY = INGRESS_EVENT_SENDER_OPEN_ID
```

Mention 身份**必须**来自产出该回复的 turn 所对应的 `IngressEvent.sender.openId`
（historical Phase A evidence Head `cce18f3` 的 `bridge.js:99-111`：SDK 归一化
`sender.openId` / `sender.name` /
`sender.senderType`；V2 §5 full-parity 合同保证该字段存在且与 V0 逐字段一致）。

**禁止的来源**（全部 NO）：

```text
MODEL_GENERATED_NAME_TEXT = NO      # 模型输出里的 "@张三" 永远是纯文本
REQUEST_BODY_SELF_CLAIMED_ID = NO   # 请求体自报身份
FUZZY_NAME_QUERY = NO               # 模糊名称查询
GROUP_MEMBER_NAME_GUESS = NO        # 群成员名称猜测 / roster 反查
PLAINTEXT_NAME_TO_MENTION_RESOLUTION = NO
SDK_RESOLVE_MENTIONS_IN_TEXT = OFF  # SendOptions.resolveMentionsInText（roster 名称解析）
                                    # 永不启用（types.ts:100-105；默认 off，保持 off）
```

**openId 有效性**：注入前经 SDK `isValidOpenId`（`compose-mentions.ts:5-8`，
`ou_|on_` 前缀校验）；缺失/非法 → **不 @**（无伪造、无名称替代、无静默改名）。
ReplyTarget mention context **只机械携带 openId**；不携带 sender name，也不携带任何其它
mention identity。Connector 只以该 openId 构造 SDK mention entry；显示名不是身份输入，
不得由 Router、模型文本、roster 查询或名称猜测补入。

### 4.3 实现原语（SDK native，唯一）

```text
MENTION_PRIMITIVE = SDK SendOptions.mentions
  # 只传由 ReplyTarget context 携带 openId 的条目（resolve-mentions.ts 语义：
  # openId 条目原样直通）；不传 name 或任意其它 mention target
  # markdown 路径：markdownToPost 把 <at user_id="ou_…">name</at> 前缀注入第一块
  #   md 元素开头（to-post.ts:14-15,21-22）
  # text 路径（fallback）：composeMentionsTextPrefix 构造 <at> 前缀（sender.ts:110-112）
  # connector 不自拼 <at> 字符串、不自建 mention 元素、不做名称解析
```

### 4.4 不自动 @ 的消息（冻结全表）

| 消息 | 机械保证 |
|---|---|
| unbound receipt | bridge 内部 `createReceiptReply` 直调 `channel.send`，不经过 `handle.reply`，无 UX opts、无 mentions（`bridge.js:445-459`） |
| Router deterministic failure receipt（`[agent-core] delivery failed: …`） | 该调用点（`index.js:699`）**不传 UX opts**（§5）→ 无 mention |
| system / control-plane notification（startup / configuration failure 回执） | 不经过 opted-in 调用点 |
| bot self-generated proactive message（scheduler `createFeishuDeliver` 投递，`scheduler-router/src/index.js:153-178`） | target 由显式部件构造（非 ingress 派生），不携带 `triggerSenderOpenId`；且不传 UX opts —— 双重结构保证 |
| 找不到可信 sender open_id 的消息 | §4.2 有效性守卫 → 不 @，不伪造 |

---

## 5. Reply Seam、Router 最小变更与 Owner Ruling

### 5.1 现有 seam 事实（historical evidence Head `cce18f3` source-verified）

生产 `feishu.reply` 调用点全表（`grep '\.reply(' packages --exclude tests`）：

```text
packages/agent-router/src/index.js:691   # agent turn 成功回复（markdown + mention 的唯一对象）
packages/agent-router/src/index.js:699   # deterministic failure receipt（保持 text、无 mention）
packages/scheduler-router/src/index.js:178  # scheduler proactive（保持 text、无 mention）
feishu-connector/src/bridge.js:445-459   # unbound receipt（connector 内部直发，不走 handle.reply）
```

seam 既有形态：`handle.reply(replyTarget, text, opts = {})`（`feishu-connector/src/index.js:215`）
**第三参已存在且当前被忽略**；`replyTargetFor(ev)`（`core.js:318`）接收**完整 IngressEvent**，
目前只投影 conversation/chat/channel/message/thread/root 六字段。

### 5.2 最小 seam（冻结设计）

1. **ReplyTarget 可选 metadata（connector-owned，零 Router 参与）**：
   `replyTargetFor(ev)` 产出的每个 target（`replyTo`/`asThread`/`directChat`）新增可选字段
   `triggerSenderOpenId`，只从 `ev.sender?.openId` 机械投影。ReplyTarget 不携带 sender name
   或任意 mention target。显式部件构造（`buildReplyTarget` 直接调用，scheduler 路径）
   **不携带**该 metadata —— proactive 不 @ 的机械保证。
2. **`handle.reply` 第三参成为 UX 激活面**：opts 只携带**意图标志**，永不携带身份值：
   ```text
   ux: { rendering: 'markdown', autoMentionTriggerSender: true }
   ```
   冻结语义：Router 只传 `rendering` intent 与 `autoMentionTriggerSender` intent；不得传
   sender openId、sender name 或任意 mention identity / targets。
3. **Mention 触发 = 合取**：opts 请求 AND `triggerSenderOpenId` 有效（`isValidOpenId`）
   AND `target.channel ∈ {group, thread}`。三者缺一不可；p2p 结构性排除。
4. **未传 opts 的调用方**：与 Phase A 行为字节级一致（text、无 mention）。

### 5.3 Router 变更判定（诚实结论）

**事实**：成功回复（:691）与失败回执（:699）是同一 seam、同一
`replyTargetFor(ingress)`、同一 sender metadata 的两个调用点。「这是 agent turn 回复」
与「这是 deterministic failure receipt」的区分信息**只存在于 Router 调用点**；connector
侧无法机械区分（文本前缀嗅探 `[agent-core] delivery failed` 非机械合同，禁止）。

**推论**：

```text
若 opts 不存在（Router 零改动）：
  默认开启 mention -> 失败回执也 @ -> 违反 §4.4 冻结裁决（REJECTED）
  默认关闭 mention -> group/topic 自动 @ 永不生效 -> 违反 §4.1 冻结裁决（REJECTED）
=> 零 Router diff 不存在同时满足两条冻结裁决的机械设计。

ROUTER_CHANGE_REQUIRED = YES_MINIMAL
MINIMAL_ROUTER_SEAM =
  packages/agent-router/src/index.js:691（成功回复调用点）唯一一行：追加第三参
  ux opts；:699 与其余一切 agent-router 文件 0 行 diff。
  Router 只表达意图（"这是 agent turn 回复"），不解析、不传递、不决定身份；
  mention 全部判定与构造住在 connector —— 不扩大 Router authority。
ROUTER_AUTHORITY_CHANGE = NONE
ROUTER_PRODUCT_ROUTING_CHANGE = NONE
```

**Owner ruling D-U1（APPROVED，2026-08-20）**：Owner 已批准本 Spec 对 V2 §8 与原
`packages/agent-router/** = NO CHANGE` 边界的**唯一例外**——未来实现只可修改
`packages/agent-router/src/index.js` 的 Agent 成功回复单一调用点，追加上述最小 UX opts。
Router failure receipt 调用点以及其余 Router 文件必须 byte-preserved；unbound receipt、
scheduler / proactive notification 的既有调用点同样保持原样。它们全部继续 plain text、
no auto-mention。

```text
D_U1 = APPROVED
OWNER_DECISION_REQUIRED = NONE
```

本批准只消除 D-U1 未决项，不 acceptance-finalize 本 Spec，也不授予本轮产品代码修改权限。

---

## 6. Implementation Scope（accepted 后、前置满足后）

```text
允许修改：
  packages/feishu-connector/**          # reply UX opts 处理、markdown send 映射、
                                        # ReplyTarget metadata、mentions 组装、fallback 守卫
  packages/feishu-connector/test/**     # 直接相关测试
  packages/agent-router/src/index.js    # 仅 §5.3 D-U1 批准的成功回复单调用点最小 opts

默认 0 行 / NO CHANGE：
  packages/agent-router/** 其余一切（含 src/process.js）
  AgentProcess / turnQueue / 单飞串行 authority
  Binding Store（格式/行/键/语义；无迁移、无新持久状态）
  v2-ingress-gate.js / PREBOUND_ONLY
  workspace-bootstrap / scheduler-router / broker / product-api / notification-ingress
  DSH Kernel
  SDK 依赖坐标（V2 §11 双 revision 合同不变）
```

超出上述范围，或 SDK public surface 无法满足本 Spec 合同 → **停 + OWNER_DECISION_REQUIRED**；
Implementation Agent 不得修改本 governing Spec、不得改 V2、不得扩权。

---

## 7. Acceptance Criteria（mandatory 全表）

### 7.1 Markdown 渲染

```text
AC-MARKDOWN-HEADING
  真实 SDK send 管线：'#'-###### 标题以飞书标题样式渲染（test app 实测 T-MD-HEADING）；
  markdown 源经 optimizeMarkdownStyle 后仍是合法 md 元素。

AC-MARKDOWN-LIST
  有序/无序列表（含嵌套一层）真实渲染为飞书列表；限内单条消息。

AC-MARKDOWN-CODE-FENCE
  fenced code block 渲染为飞书代码块并保留 language tag；行内代码渲染为 inline code。

AC-MARKDOWN-LINK
  [text](url) 渲染为可点击链接；URL 不因渲染/分块丢失或被改写。

AC-MARKDOWN-TABLE
  简单表格（GFM 管道表）在真实飞书客户端渲染为表格（T-MD-TABLE 强制 gate）。
  若原生不渲染 -> 停 + OWNER_DECISION_REQUIRED；禁止 custom converter / rawClient 兜底。

AC-MARKDOWN-LONG-CHUNKING
  >3500 字符回复：限内单条；超限完整送达；分块顺序稳定；代码块不在错误位置切断
  （围栏闭合/重开、language tag 保留）；正常路径 anchored 续块链在同一 reply/thread 线内；
  target_revoked 时只要求 §3.5 same-chat fallback，不保证原 thread/reply anchor。

AC-MARKDOWN-TEXT-FALLBACK
  format_error（230002/230001/400）只触发一次 markdown -> plain text 的逻辑 format
  fallback；不代表底层 transport 只有一次请求。每个 send leg 的 rate_limited / unknown
  transport attempts 仍由 SDK maxAttempts=3 policy 管理；connector retry / 第二 format
  fallback / automatic replay 均为 NONE。permission_denied 永不触发 fallback（fail loud，
  reply() reject -> Router catch 回执路径不变）。target_revoked 不触发 text fallback，
  单独遵循下一项 same-payload 合同。

AC-TARGET-REVOKED-SAME-CHAT-FALLBACK
  dedicated test app 必须覆盖五组真实 SDK send 场景：
  1. normal target-revoked：logical fallback 恰好一次，删除 replyTo，在同一 chat 顶层发送；
     每个 attempt 保持 content、markdown/text rendering 与 outbound mentions；无 connector
     二次 fallback。group/topic 自动 mention 仍为真实可点击 mention，被 mention 用户仍
     收到飞书原生提醒；原 thread/reply anchor 不保证。
  2. rate_limited：SDK transport attempt 总数受 maxAttempts=3 约束；connector 额外 attempt=0。
  3. ambiguous unknown：VISIBLE_EXACTLY_ONCE_DELIVERY = NOT_CLAIMED；最终歧义失败标为
     OUTCOME_UNKNOWN，connector 不 automatic replay。
  4. permission_denied：fail loud，不删除 replyTo、不改为同 chat 顶层发送。
  5. format_error：只进行一次 markdown -> text logical format fallback；transport retry
     仍由 SDK bounded policy 管理。

AC-SDK-ATTEMPTS-EXHAUSTED
  独立 mandatory dedicated test-app case，不能由 target-revoked happy fallback 或单元 mock
  代替。对 reviewed SDK runtime 的 retryable error（rate_limited 与 ambiguous unknown）强制
  transport attempts 达到 maxAttempts=3：第三次 attempt 后仍失败，必须 fail loud；
  connector-owned retry count = 0；connector-owned automatic replay count = 0。
  ambiguous unknown 的终态必须记录为 OUTCOME_UNKNOWN，且不得升级为 visible exactly-once claim。
```

### 7.2 出站自动 @

```text
AC-GROUP-AUTO-MENTION-SENDER
  group agent turn 回复第一块含真实可点击 @触发者（test app 实测 T-MT-GROUP）；
  被 @ 用户收到飞书原生提醒；@ 不落在 code fence 内。

AC-TOPIC-AUTO-MENTION-SENDER
  正常 anchor 可用时，topic/thread 内回复自动 @ 触发者；mention 与回复均留在 thread 内，
  不逃逸到主群（T-MT-TOPIC）。target_revoked 时适用
  AC-TARGET-REVOKED-SAME-CHAT-FALLBACK 的 same-chat / anchor-exception 合同。

AC-P2P-NO-MENTION
  p2p 回复无任何 <at> 注入（结构性排除，opts 误传也不 @）。

AC-UNBOUND-RECEIPT-NO-MENTION
  INGRESS_GATE_REJECTED_REPLY 无 mention、plain text。

AC-FAILURE-RECEIPT-NO-MENTION（补充冻结）
  Router `[agent-core] delivery failed` 回执无 mention、plain text
  ——即 §5.3 零 diff 方案被 REJECTED 的直接原因，必须被测试锁定。

AC-MISSING-SENDER-ID-NO-FABRICATED-MENTION
  sender.openId 缺失/非法（不匹配 ^(?:ou_|on_)[A-Za-z0-9_-]+$）时不 @：
  不伪造、不名称替代、不 roster 反查、消息正文原样送达。

AC-MENTION-USES-OPEN-ID-NOT-NAME
  构造的 mentions 条目以 sender.openId 为唯一身份；模型文本中的 "@<名字>"
  保持纯文本（resolveMentionsInText 全程 OFF）；用显示名与正文文字完全不同、
  名字从未出现在任何输入里的测试账号验证（证明非名称解析）。
```

### 7.3 结构与边界（补充冻结）

```text
AC-EXISTING-CALLERS-UNCHANGED
  未传 UX opts 的三个既有调用方（Router failure receipt / scheduler deliver /
  bridge receipt）行为与 Phase A 字节级一致（text、无 mention）；单元级 seam 测试锁定。

AC-SINGLE-RENDER-AUTHORITY
  config.markdownConverter 未设置；无 Agent Core 自建 markdown->post 转换；
  无第二 outbound transport；rawClient / direct node-sdk 0 引用。

AC-ROUTER-DIFF-MINIMAL
  packages/agent-router/** diff = §5.3 批准的成功回复单调用点最小 UX opts；
  其余 agent-router / AgentProcess / Binding / gate / Kernel 文件 diff = 0。

AC-NO-NEW-PERSISTENT-STATE
  无新持久产品状态；Binding store 0 迁移；回滚 = 恢复上一 verified 部署 commit
  （继承 V1 §11-12 / V2 §11）。
```

### 7.4 Dedicated test app 真实验证（mandatory pre-production gate）

独立 dedicated test app（复用 V2 §7 create_thread gate 的 test-app 纪律；不得以 mock
SDK / 单元测试替代）必须实测：

```text
T-MD-HEADING   群内标题/列表/引用/粗斜体真实渲染截图/证据
T-MD-CODE      代码块 + language tag + 行内代码真实渲染
T-MD-LINK      链接可点击
T-MD-TABLE     简单表格真实渲染（AC-MARKDOWN-TABLE 的唯一 gate；失败即停）
T-MD-LONG      >3500 混排长文（含代码块/链接/表格）完整送达、顺序稳定、围栏不切断
T-MD-FALLBACK  构造 format_error：markdown -> text logical fallback 恰好一次；transport
  attempts 受 SDK maxAttempts=3 管理；connector attempt / second fallback / replay = 0
T-TARGET-REVOKED
  a) normal revoked：一次 logical fallback，同 chat 顶层；content/rendering/mentions 每 attempt
     保持，connector second fallback=0；真实 @ 可点击且被 @ 用户收到原生提醒；
  b) rate_limited：SDK attempts <= 3，connector extra attempt=0；
  c) ambiguous unknown：visible exactly-once 不声明，终态 OUTCOME_UNKNOWN，无 connector replay；
  d) permission_denied：fail loud，不转顶层；
  e) format_error：一次 logical markdown -> text fallback，transport retry 归 SDK policy；
  target_revoked 时允许 thread/reply anchor 不保留，但每 attempt 必须同 chat
T-SDK-ATTEMPTS-EXHAUSTED（独立 mandatory case）
  分别构造 rate_limited 与 ambiguous unknown，真实 SDK transport attempt count = 3；
  attempts exhausted 后错误 fail loud；connector retry count = 0；automatic replay count = 0；
  ambiguous unknown 终态 = OUTCOME_UNKNOWN，VISIBLE_EXACTLY_ONCE_DELIVERY = NOT_CLAIMED
T-MT-GROUP     群回复含真正可点击 @；被 @ 用户收到飞书原生提醒（以该用户客户端为准）
T-MT-TOPIC     正常 anchor 可用时，topic 内 @ 与回复不逃逸到主群；后续 ingress threadId 派生正确
T-MT-P2P       p2p 无 @
T-MT-RECEIPT   unbound receipt 与 failure receipt 均无 @、plain text
T-MT-IDENTITY  改名/匿名测试账号：@ 仍正确（openId 权威），模型文本 @名字 保持纯文本
```

未全部通过不得 production canary；任一失败 → 停 + OWNER_DECISION_REQUIRED。

---

## 8. Ordering with Phase A（冻结）

```text
AUTHORITY_BRANCH = main
UX_SPEC_MAIN_PRECONDITION = ACCEPTED_EXACT_CONTENT_PRESENT_ON_MAIN
PHASE_A_FOUNDATION_MAIN_PRECONDITION = MERGED_AND_PRESENT_ON_MAIN
IMPLEMENTATION_PRECONDITIONS =
  UX_SPEC_MAIN_PRECONDITION
  AND PHASE_A_FOUNDATION_MAIN_PRECONDITION
PR_NUMBER_HARD_PRECONDITION = NONE
HISTORICAL_CANDIDATE_BRANCH_HARD_PRECONDITION = NONE
SPEC_REVIEW_PARALLEL = ALLOWED
IMPLEMENTATION_START = REQUIRES MAIN_DESCENDANT_SATISFYING_BOTH_PRECONDITIONS

BASE_RECONCILIATION_REQUIRED = YES
CURRENT_RECONCILIATION_SNAPSHOT = origin/main@34d7c73456f2b177b8ad042e67359bc86fae8861
GOVERNANCE_ADOPTION_ACCEPTED_ON_MAIN = YES@2f8bdad2cfa22d91e1eed9597d053eeb031e63ea
FOUNDATION_V2_SPEC_ACCEPTED_ON_MAIN = YES@e1ae7fdc5e7dabcba17819c02935395a5f19e9b0
HISTORICAL_PHASE_A_EVIDENCE_HEAD = cce18f3aa8c0836d3255c0514de86bda4dbd961b
HISTORICAL_PHASE_A_EVIDENCE_HEAD_IS_CURRENT_MAIN_ANCESTOR = NO
PHASE_A_FOUNDATION_MAIN_PRECONDITION_SATISFIED = REQUIRES_FRESH_IMPLEMENTATION_PREFLIGHT

FUTURE_IMPLEMENTATION_BASE_RECONCILIATION =
  1. git fetch origin; pin exact implementation-base main SHA
  2. verify this UX Spec status=accepted and exact accepted content is present in that main SHA
  3. verify Phase A foundation implementation and accepted V2 dependency/source revision contract
     are present in that same main SHA; a PR number or historical candidate ancestry is insufficient
  4. re-inventory success/failure/scheduler/unbound reply call sites and ReplyTarget/opts seam
  5. revalidate D-U1 single successful-reply call-site minimal diff against the pinned base
  6. any missing precondition, semantic drift, or structural seam change -> STOP + independent re-review

ROLLBACK = RESTORE_PREVIOUS_VERIFIED_COMMIT   # 无迁移、无新状态、无 dual flag
CUTOVER_GATES = UNIT + INTEGRATION + TEST_APP(§7.4 全表) + PRODUCTION_CANARY
```

---

## 9. Non-Goals and Prohibitions

```text
# 本轮不做（继续留给未来 UX Spec）
per-group no-mention（旧 Part A）
typing reaction lifecycle（旧 Part B）
streaming card / thinking card
question / plan / tool approval cards
file / media content delivery
/cd /model /status 命令面
dsh-lark ConversationSessions / 第二 Agent lifecycle / connector-owned model selection
markdown 扩展到 scheduler proactive 投递（SCHEDULER_DELIVERY_RENDERING = TEXT_UNCHANGED）

# 永久禁止（本 Spec 内）
rawClient / 私有 SDK 字段访问 / logger 字符串解析
direct node-sdk client 恢复 / 第二 outbound transport / 第二 WebSocket
custom markdownConverter / 第二渲染权威 / 第二归一化
SDK resolveMentionsInText / roster 名称解析 / 模型文本 @ 解析
per-group policy registry / mention 白名单配置面
Router mention 身份解析权（Router 只传意图标志）
AgentProcess / Binding / PREBOUND_ONLY / Workspace/Session / Kernel / gate 任何变更
SDK 依赖坐标变更（双 revision 合同不变；升级需独立 compatibility review）
```

---

## 10. Risks

| 风险 | gate |
|---|---|
| 飞书 md 元素不渲染 GFM 表格 | T-MD-TABLE 强制实测；失败停 + OWNER_DECISION；禁 custom converter |
| 正常 anchor 可用时 mention 逃逸 topic 到主群 | T-MT-TOPIC + anchored 续块链测试；create_thread 语义继承 V2 §7 |
| format_error logical fallback 与 transport retry 混为一谈 | FORMAT_ERROR 只约束一次 markdown→text 逻辑降级；SDK attempts <= 3；T-MD-FALLBACK |
| target-revoked fallback 跨 chat、丢 rendering/mention 或被 connector 再包一层 | AC-TARGET-REVOKED-SAME-CHAT-FALLBACK + T-TARGET-REVOKED；per-attempt same-chat/payload；connector retry/fallback = NONE |
| ambiguous unknown 被误报为 visible exactly-once | `OUTCOME_UNKNOWN` + `VISIBLE_EXACTLY_ONCE_DELIVERY = NOT_CLAIMED`；无 connector automatic replay |
| 失败回执被误 @ | AC-FAILURE-RECEIPT-NO-MENTION；opts 不传即不 @ 的默认关闭语义 |
| 名称注入伪造 mention | ReplyTarget context 与 SDK mention entry 只携带 openId；不携带 name，不做名称解析 |
| Router 单调用点 diff 被扩大成 authority 漂移 | AC-ROUTER-DIFF-MINIMAL + `D-U1 = APPROVED` 的窄边界 + review diff 检查 |
| SDK bounded transport retry 被误禁或被 connector 扩大 | SDK `maxAttempts=3` 只处理 rate_limited/unknown；耗尽后 fail loud，connector retry/replay = NONE |
| attempts exhausted 仅被嵌在其它 case、未独立验证 | AC-SDK-ATTEMPTS-EXHAUSTED + T-SDK-ATTEMPTS-EXHAUSTED mandatory dedicated test-app case |
| resolveMentionsInText 被顺手打开 | AC-SINGLE-RENDER-AUTHORITY + AC-MENTION-USES-OPEN-ID-NOT-NAME |
| 任一 main precondition 未满足即开工实现 | §8 同一 pinned main base 双前置 + future-base reconciliation；PR identity 不计数 |

---

## 11. Independent Review and Acceptance Protocol

独立 reviewer 必须读取：本 proposed commit；accepted
`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0`；V1（superseded）与 V2（accepted）Spec；
`origin/main` pinned reconciliation snapshot；historical Phase A evidence Head `cce18f3` 的
Router/connector/scheduler 源（仅作 source evidence，尤其 :691/:699/bridge/core/scheduler
五个位置）；SDK source `bd24f67` 的 sender/compose-mentions/to-post/splitter/errors/types/retry；
V2 §7 create_thread test-app gate 先例。

```text
review 输出至少包含：
REVIEWER_IDENTITY
REVIEW_BASE_COMMIT
REVIEWED_SPEC_COMMIT
REVIEW_VERDICT = PASS | FIX_REQUIRED
BLOCKERS
OWNER_DECISION_DISPOSITION = D-U1 APPROVED（显式核对）
TARGET_REVOKED_DISPOSITION = ACCEPT_SDK_NATIVE_TOP_LEVEL_FALLBACK（显式核对）
RETRY_SEMANTICS_DISPOSITION = ACCEPT_SDK_BOUNDED_TRANSPORT_RETRY（显式核对）
SEMANTIC_REVIEW_COMPLETE = YES | NO
VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC | FIX_REQUIRED
```

仅 `PASS + BLOCKERS=NONE + SEMANTIC_REVIEW_COMPLETE=YES` 允许 acceptance-finalize
（`status: proposed -> accepted` + 记录 reviewed head/reviewer/verdict + D-U1 裁决归档）；
本 retry-semantics focused amendment 写入 bounded transport retry Owner ruling 后不得直接
finalize，须 focused independent re-review；D-U1 继续保持 APPROVED。当前仍为 proposed，
实现不得启动。

---

## 12. Related

- `docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md`（accepted foundation）
- `docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md`（accepted development-governance authority）
- `docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1.md`（superseded；§1.3/§5.2 命名与承接义务来源）
- `docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md`（SDK 原语证据）
- Historical Phase A source-evidence Head `cce18f3`（不是 hard precondition authority）
- SDK source `bd24f6742513769c80b5401b96ad464d74dd2027` / runtime `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`
