---
spec_id: AGENT_CORE_LARK_UX_PHASE1_V3
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - Feishu successful-answer pre-send plain-text selection
  - Existing ingress result execution-versus-delivery diagnostic projection
  - Complete existing Phase 1 UX contract succession
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities: []
supersedes:
  - AGENT_CORE_LARK_UX_PHASE1_V2
  - AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_LARK_UX_PHASE1_V3

## 1. Goal

含外部图片的已生成答案能够通过原飞书入口收到；展示失败不抹去既有执行结果，不触发 Agent 重新执行。
本文件是最小规范候选，不是接受或部署回执。自动回收不是本候选的依赖。

## 2. Scope and non-goals

### Effective in scope

- 飞书 Agent 成功回复的 SDK-native Markdown、group/topic 触发者自动 mention，以及
  `IngressEvent.sender.openId` 到 ReplyTarget mention context 的机械投影；
- SDK-native format-error、target-revoked、bounded transport retry、长内容/表格/代码/链接保真；
- SDK 原生 heading normalization：保留标题文字、顺序和 heading treatment，不要求六种视觉样式；
- Router successful-reply seam 传递 rendering/mention intent；
- Router 成功答案在进入 card 或 Markdown/post 之前执行媒体标记预检，命中时预选 SDK text；
- 已获得执行结果后的 reply-delivery 失败诊断投影，保留执行结果并区分 admission、execution、
  reply_delivery；
- Scheduler 既有成功通知 card eligibility 与其他 caller 的既有发送计划保持不变；
- unit/integration、stub transport、dedicated test app、production canary 前置 gate 和 rollback。

允许实现路径仅为 `packages/feishu-connector/src/{index,core,reply-card}.js`、必要的纯展示预检辅助
文件和直接测试，以及 `packages/agent-router/src/ingress-delivery.js` 的 execution/reply-delivery
diagnostic branches 与 successful-reply seam。

### Effective non-goals and prohibitions

- per-group no-mention、typing reaction、streaming/thinking/approval card、文件/媒体上传、`/cd`、
  `/model`、`/status`、ConversationSessions 或第二 Agent lifecycle；
- 图片下载/上传、URL 改写、custom Markdown converter、raw client、direct node SDK、第二 outbound
  transport、`resolveMentionsInText`、roster/name-to-identity resolution；
- AgentProcess、kill/reap、Binding、PREBOUND_ONLY、Workspace/Session、Kernel、ingress gate、
  scheduler-router、Scheduler retry、身份 authority、业务幂等或 SDK pin/retry policy；
- 新结果存储、后台补投、历史答案重放、自动恢复平台或以新 generation 代替旧执行终止证明；
- 修改 Scheduler presentation intent/call site、将 Router 媒体预检扩展到 Scheduler，或改变其他
  excluded caller 的既有发送计划；
- 未经独立授权的 production mutation、批量重启或跨 Goal 部署否决权。

现有结果的诊断投影只引用本次调用已持有的数据；不能通过诊断 API 添加新 execution authority。
上述清单完整承接 V2 与 heading amendment 的有效产品边界，并加入本 V3 display delta。

## 3. Authority and dependencies

本 proposed V3 是完整 authority successor 候选，拟整体替代 `AGENT_CORE_LARK_UX_PHASE1_V2` 与其 `AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT`。不是新增局部 supersession。§9/10 内嵌全部有效产品 Contracts/Acceptance 与真实客户端 gates；旧 heading distinctness 已按既有 accepted amendment 承接 native normalization。

当前 `status=proposed` 且 `supersedes` 已列出上述两项；这声明拟议的完整替代关系，不提前停用
predecessor。接受事务须固定 reviewed head，仅执行 lifecycle/provenance 机械变化：本文件 status 为
accepted；两项 predecessor 的 status 为 superseded、superseded_by 为 V3，并按仓库治理原子进入
main。此前旧 authority 继续有效，禁止实现。不得复制旧 acceptance 证明作为本候选的 acceptance。

唯一新增语义是 CTR-DISPLAY-001..006、对应 Router/rendering 边界及明确保留 Scheduler 发送计划；保留当前 static-card 配置行为作为此次明确审查的合同，不从运行字节推导既有 authority。新代码只实现展示 delta，不重做 Phase A/既有 UX。Lifecycle 冻结和自动回收决定均不作为展示接受或合法 operator 恢复的前置条件。

源码基线 f72255d4feddb6deb4f907cbe70cca547f9e240a；SDK runtime ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f 不变。

## 4. Current State

- STATE-001：上述基线的 `reply-card.js` 原样放入 Markdown，只检查 empty / wire size。2026-09-15 本地纯函数复现外部图片 URL 进入卡片；未调用飞书 API。
- STATE-002：同基线 `ingress-delivery.js` 一个 catch 覆盖 execution 与 Feishu send，二者均输出 delivery failed。
- STATE-003：固定 SDK 会重试 unknown，默认最多 3 次；缺 messageId 归入 unknown；send_timeout 默认不重试。首期保持此行为，不承诺端到端 ambiguous 零重试。
- STATE-004：SDK 分块 IDs 位于发送函数局部数组，全部成功后才返回；中途失败没有公开的部分 IDs 结果。

## 5. Observations

- OBS-001：3D 打印专家真实 main native turns 8/9 分别在 2026-09-15 20:19:31.323 / 20:25:07.874（Asia/Shanghai）记录 completed；相应最终答案含外部图片 Markdown。用户给出的错误是 invalid image keys / 200570。生产 send attempt 与这些事件的精确关联仍需实测收口。
- OBS-002：文章发布管家有真实 fence 拒绝；旧执行根因未确认。本次只确认共同的错误呈现缺陷，不能声称两者根因相同。
- OBS-003：源码核对：`src/outbound/retry.ts` 的 maxAttempts 默认 3；`sender.ts` rawSend 缺 ID 抛 unknown，sendText/sendMarkdown 仅在循环完成后 makeResult(ids)。

## 6. Claims and assumptions

- CLM-001：发送前改选 `{text: originalAnswer}` 可避开卡片图片 key 解析；依赖固定 SDK 实际走 text msg_type，必须测试。
- CLM-002：现有执行结果可在投递失败分支继续引用；不推导跨 runtime epoch 或保留期的可用性。
- CLM-003：失败的逻辑多块发送可能已有部分成功；上层不能可靠知道成功块数量或 IDs。

## 7. Evidence relations

OBS-001 + STATE-001 支持 CLM-001 的故障机制；不替代真实飞书验收。
STATE-002 支持阶段诊断修订；不证明原 unknown execution 根因。
OBS-003 限制重试与 partial receipt 声明。

固定来源：[retry.ts](https://github.com/mayf3/channel-sdk-node/blob/ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f/src/outbound/retry.ts)、[sender.ts](https://github.com/mayf3/channel-sdk-node/blob/ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f/src/outbound/sender.ts)。
图片资源引用：[上传图片接口](https://open.feishu.cn/document/server-docs/im-v1/image/create)。不使用下载图片短链证明上传行为。


EVD-DISPLAY-001: OBS-001/STATE-001 → CLM-001，固定 main 纯函数复现支持输入机制但不足以证明 API 送达。EVD-DISPLAY-002: OBS-003 → STATE-003/004，固定 SDK 源码直接支持重试/回执限制，不证明现场 attempt 数。历史 V2 investigation/decision evidence 保留在 predecessor；本候选不将历史日期状态冒充 fresh 结果。

## 8. Decisions

### DEC-LUX-V3-001 — Preserve Phase 1 UX and add only display safety

- Decision owner: `mayf3`
- Decision: 保留 V2 的 Markdown、mention、topic continuity 和 test-app UX；唯一新增产品行为是
  Router 成功答案媒体预检与 execution/reply-delivery 诊断投影。
- Rejected alternatives: 重做 Phase 1 UX、扩展到其他 Phase B 功能或自动恢复。
- Reason: 修复已生成答案的飞书展示失败，同时保持既有边界。
- Owner decision remaining: NONE

### DEC-LUX-V3-002 — Keep SDK primitives as outbound authority

- Decision owner: `mayf3`
- Decision: SDK built-ins 继续唯一拥有 Markdown rendering、mention、target/format fallback、transport
  retry 和 wire send；connector 只做既有 static-card pre-send plan 与新增媒体 text 预选，不增加第二
  transport、converter、retry 或 fallback。
- Rejected alternatives: custom converter、raw client、connector resend、SDK policy change。
- Reason: 避免重复投递和第二 transport/rendering authority。
- Owner decision remaining: NONE

### DEC-LUX-V3-003 — Preserve openId identity authority

- Decision owner: `mayf3`
- Decision: `IngressEvent.sender.openId` 仍是 mention identity 的唯一 authority；Router 不传 identity。
- Rejected alternatives: name/roster inference 或任意 mention target。
- Reason: 保持身份边界并防止伪造 mention。
- Owner decision remaining: NONE

### DEC-LUX-V3-004 — Allow only two bounded Router seams

- Decision owner: `mayf3`
- Decision: Router 仅可在 successful-reply seam 传递 UX intent，并在
  `ingress-delivery.js` 投影本次调用已持有的 execution/reply-delivery 结果；不得取得 transport、
  rendering、identity 或 lifecycle authority。
- Rejected alternatives: Router 自行发送、解析 identity、持久化新结果或管理 AgentProcess。
- Reason: 阶段语义存在于 ingress delivery orchestration，但 transport/identity 仍属于原 owner。
- Owner decision remaining: NONE

### DEC-LUX-V3-005 — Preserve SDK fallbacks and truthful ambiguity

- Decision owner: `mayf3`
- Decision: target-revoked 与 post-to-text format fallback、`maxAttempts=3` 的 SDK retry 保持分层；
  SDK 终局后上层不重发。unknown/send_timeout 和 partial delivery 只按可证明状态表达，不声明
  visible exactly-once。
- Rejected alternatives: 全链路 ambiguous 零重试、connector fallback 或虚构 partial receipts。
- Reason: 固定 SDK 的 attempt/receipt 能力不足以支持更强保证。
- Owner decision remaining: NONE

### DEC-LUX-V3-006 — Preserve excluded caller plans

- Decision owner: `mayf3`
- Decision: Router failure/unbound/startup receipt 与普通 proactive caller 保留各自发送计划；Scheduler
  success presentation 保留既有 card eligibility。新增媒体预检仅作用于 Router 成功回复。
- Rejected alternatives: 所有 Scheduler 强制 text，或用 cardEligible 并集触发媒体预检。
- Reason: 展示修复不能改变并行 Scheduler 产品行为。
- Owner decision remaining: NONE

### DEC-LUX-V3-007 — Gate implementation on accepted same-main content

- Decision owner: `mayf3`
- Decision: implementation 仅从同时包含 V3 accepted exact content 与 Phase A foundation 的 main
  descendant 开始；PR/branch 身份不能替代内容。
- Rejected alternatives: proposed 或未合并的 accepted-looking 文档授权实现。
- Reason: authority 必须在指定 authority branch 生效。
- Owner decision remaining: NONE

### DEC-LUX-V3-008 — Retain real-client verification

- Decision owner: `mayf3`
- Decision: Markdown、mention、notification、topic、failure 和新增含图片答案均须经过相应
  dedicated test-app/real-client gate；模拟证据必须单独标记。
- Rejected alternatives: unit/mock-only acceptance。
- Reason: 本地测试不能证明飞书客户端真实展示与通知行为。
- Owner decision remaining: NONE

### DEC-LUX-V3-009 — Retain SDK-native heading normalization

- Decision owner: `mayf3`
- Decision: 标题文字、顺序与 SDK-native heading treatment 必须保留；H1–H6 六种视觉样式不作为
 通过条件；custom converter、heading preprocessor 与 SDK re-pin 仍禁止。
- Rejected alternatives: 恢复六级视觉区分或将标题全部降为正文。
- Reason: 完整承接 accepted heading normalization ruling。
- Owner decision remaining: NONE

### DEC-LUX-V3-010 — Use one whole-authority successor

- Decision owner: `mayf3`
- Decision: V3 以完整 standalone authority 替代 V2 与 heading amendment；接受时三个 lifecycle
 记录与 reciprocal links 原子闭合，旧 global normative IDs 仅作为历史 authority。
- Rejected alternatives: partial supersession、原地修改 accepted predecessor 或 transitive-only claim。
- Reason: 当前仓库禁止新 partial supersession。
- Owner decision remaining: NONE

### DEC-DISPLAY-001 — Deliver original answer bytes without media upload

- Decision owner: `mayf3`
- Decision: 媒体标记命中时预选 SDK text，保留正文与 URL 原字节；不下载、上传或改写资源。
- Rejected alternatives: prompt-only suppression、自动上传或 URL parser。
- Reason: 用最小 pre-send selection 避开 static-card image-key 解释。
- Owner decision remaining: NONE

### DEC-DISPLAY-002 — Never re-execute or resend after terminal delivery result

- Decision owner: `mayf3`
- Decision: 一次答案最多一次上层 `channel.send`；SDK 终局后不得重发答案、切模型或重新执行
  Agent。SDK 内部 retry/fallback 保持现状。
- Rejected alternatives: card failure 后全文补投或业务重放。
- Reason: ambiguous/partial delivery 下重发会放大重复副作用。
- Owner decision remaining: NONE

### DEC-DISPLAY-003 — Project a closed stage-specific result

- Decision owner: `mayf3`
- Decision: admission/execution failure 与 reply-delivery failure 使用 §9 的封闭诊断 union；reply
  failure 携带原 execution projection，错误回执状态独立，缺失信息不猜测。
- Rejected alternatives: 新结果存储、覆盖 execution 状态或把 delivery unknown 写成 execution unknown。
- Reason: 调用方需要准确诊断，同时保留现有 top-level `error` 兼容性。
- Owner decision remaining: NONE

## 9. Contracts

### CTR-MARKDOWN-001-V3 — Successful reply rendering selection

Non-media successful replies retain the configured static-card or SDK-native Markdown path. On the Markdown path, headings, emphasis, lists, quotes, code, links, simple tables and mixed Chinese/English remain eligible for native rendering. Media markers MUST select plain text before either rich path, as CTR-DISPLAY-001 defines. Markdown-specific fidelity gates apply to the Markdown path; media text preserves source bytes instead. Excluded receipt/proactive paths do not opt in.

### CTR-MARKDOWN-HEADING-NATIVE-001 — SDK-native heading normalization is compliant



输入中的六个标题标签（`#` 到 `######`）MUST 满足：

1. 六个标题标签的文本（label 文字）全部保留在 SDK 发送载荷中，不得丢失、截断或改写；
2. 标题相对顺序全部保留，不得重排；
3. SDK 发送载荷对每个标题仍使用 SDK-native heading treatment（heading 标记行）；
   `ALL_HEADINGS_PLAIN_BODY_TEXT = FORBIDDEN` —— 不得全部退化为普通无格式正文；
4. 六个输入级别产生六种不同视觉样式 NOT REQUIRED —— SDK reviewed runtime 的原生 style
   optimization（含 `# → ####`、`##`–`###### → #####` 归一化）是合规渲染；
5. 不得丢字、合并标题或重排标题；
6. MUST NOT 启用 custom markdown converter（`CUSTOM_MARKDOWN_CONVERTER = FORBIDDEN`，
   `CTR-MARKDOWN-002` 继续有效）；
7. MUST NOT 在 connector 侧引入 heading preprocessor 或任何第二渲染 authority
   （`CONNECTOR_HEADING_PREPROCESSOR = FORBIDDEN`）；
8. MUST NOT 修改 SDK pin / dependency coordinate（`NEW_SDK_REVISION = NO`，
   `DEPENDENCY_CHANGE = NONE`）。

本 Contract 只适用于 `CTR-MARKDOWN-001-V3` 已适用的 Agent 成功回复 Markdown 路径；excluded
receipt/proactive 路径不受影响（`CTR-RECEIPT-001-V3` 继续有效）。

被取代的旧失败条件 `any heading level flattened` 不再构成失败；新的失败条件见
`ACC-MARKDOWN-HEADING-NATIVE-001`。


### CTR-MARKDOWN-NESTED-LIST-001 — One nested list level is mandatory

`NESTED_LIST_DEPTH_REQUIRED = 1`. The SDK-native Markdown path MUST preserve one nested level for both
unordered and ordered lists. Parent/child hierarchy, item order and item text MUST NOT be flattened,
reordered or lost.

### CTR-MARKDOWN-CODE-LANGUAGE-001 — Fenced-code language tags are preserved

Fenced code with an explicit language tag, including a `python` fence, MUST preserve the opening and
closing fences, the language tag and all code content. SDK-native long-message splitting MUST close and
reopen a split fence without dropping or changing its language tag.

### CTR-MARKDOWN-LINK-001 — Markdown link URLs are byte-stable

`LINK_URL_PRESERVATION = BYTE_STABLE`. The Markdown link display text and exact input URL MUST be
preserved through Agent Core and the SDK send input. Query parameters, fragments and percent encoding
MUST NOT be lost, rewritten, decoded/re-encoded a second time, or replaced by another redirect URL.
Feishu client-side click handling is outside this byte-stability obligation.

### CTR-MARKDOWN-002 — SDK is the single rendering authority

Agent Core MUST leave `config.markdownConverter` unset and MUST NOT add a custom converter, raw client,
direct node SDK fallback, streaming card, or second outbound transport. Native table failure MUST stop for
Owner review and MUST NOT authorize a local converter.

### CTR-MARKDOWN-003 — SDK-native long-content fidelity

The connector MUST retain SDK chunk limit `3500` and native splitting. In-limit content MUST remain one
message; over-limit content MUST be complete, ordered and code-fence-safe, including fence close/reopen,
language-tag and link preservation. Mentions MUST follow native first-chunk-only behavior. Normal
continuations remain anchored; revoked targets use
`CTR-TARGET-REVOKED-001`.

### CTR-MARKDOWN-LONG-TABLE-001 — Long-message fidelity includes a simple table

The greater-than-3500-character Markdown path MUST include and preserve at least one simple table together
with a language-tagged fenced-code block, a byte-stable link and the first-chunk automatic mention.
Across all chunks, table content, code, link, mention placement and source order MUST remain complete with
no content loss.

### CTR-AUTO-MENTION-001 — Group/topic success mentions triggering sender

When intent requests mention, target is group/thread, and valid triggering sender openId exists, connector
MUST create one native mention of that sender. The mention MUST be clickable and the mentioned user MUST
receive the Feishu-native notification in both group and topic test-app cases. Failure of native
notification is a stop condition requiring Owner disposition; it MUST NOT degrade to plain `@name` text.

### CTR-AUTO-MENTION-CODE-FENCE-001 — Automatic mention stays outside code fences

The generated mention token MUST be placed outside every fenced-code block, MUST NOT alter code content,
and MUST remain outside code after long-message splitting. Automatic mention remains first-chunk-only.

### CTR-AUTO-MENTION-NOTIFICATION-001 — Native notification is mandatory

For a valid `IngressEvent.sender.openId`, group and topic automatic mentions MUST be real clickable Feishu
mentions and MUST notify the mentioned user through the native client. If a trusted openId is missing or
invalid, the connector MUST create no mention and MUST NOT fabricate a name-based replacement.

### CTR-TOPIC-CONTINUITY-001 — Subsequent topic ingress preserves conversation identity

After the bot replies inside a topic, a user's next message in that same topic MUST normalize to the
correct `threadId`; its `conversationId` MUST remain `chatId:topic:threadId`, MUST resolve the same
prebound Binding, and MUST NOT degrade to the containing group conversation.

### CTR-AUTO-MENTION-002 — P2P and missing identity never fabricate mention

P2P MUST NOT auto-mention. A valid triggering identity MUST match
`^(?:ou_|on_)[A-Za-z0-9_-]+$`; missing/invalid `sender.openId` MUST yield no mention without name
substitution, roster lookup, inferred identity or body mutation.

### CTR-AUTO-MENTION-003 — Mention identity is openId only

`IngressEvent.sender.openId` is the sole identity authority. Connector MAY mechanically carry it in
ReplyTarget context. It MUST NOT carry sender name/arbitrary targets and MUST keep
`resolveMentionsInText` disabled so model `@name` remains text.

### CTR-ROUTER-INTENT-001-V3 — Successful reply passes UX intent only

The successful reply seam may pass rendering and autoMentionTriggerSender intent; connector retains rendering/identity responsibility. Existing routing is unchanged. Only the additional execution-versus-delivery projection in CTR-DISPLAY-003 is allowed in `packages/agent-router/src/ingress-delivery.js`; no new routing authority is granted.

### CTR-ROUTER-INTENT-002 — Router does not own identity

Router MUST NOT pass openId, sender name, mention identity or targets. Connector ReplyTarget context
MUST derive identity mechanically from `IngressEvent.sender.openId`.

### CTR-ROUTER-INTENT-003-V3 — Bounded failure diagnostics

The execution/reply-delivery branches and deterministic failure receipt may preserve execution results and explain the actual failure stage under CTR-DISPLAY-003. Other Router behavior and files MUST remain unchanged. ROUTER_AUTHORITY_CHANGE and ROUTER_PRODUCT_ROUTING_CHANGE are NONE.

### CTR-RECEIPT-001-V3 — Excluded callers preserve their own sending plan

Router failure receipt, unbound `INGRESS_GATE_REJECTED_REPLY` and startup/configuration failures remain plain text without automatic mentions or success UX opts. Ordinary proactive paths retain their existing plan.
Scheduler is outside the new Router-success media precheck. Its terminal success announcement with `presentation.cardEligible=true` AND `presentation.source='scheduler'` retains the baseline static-card eligibility, card-mode no-mention behavior, same target/anchor, and existing empty/oversize pre-send plan selection. Scheduler failure/unbound and other notifications retain their own baseline plans. This Spec neither changes Scheduler intent/call sites nor applies a new all-Scheduler-plain-text rule, retry policy or media fallback.
The frozen baseline is `f72255d4feddb6deb4f907cbe70cca547f9e240a`, `packages/feishu-connector/src/index.js` reply wiring. This explicit preservation contract is proposed authority, not a claim that code alone created prior authority.

### CTR-TARGET-REVOKED-001 — One logical same-chat top-level fallback

When original reply target is revoked/deleted/unavailable and SDK classifies `target_revoked`, SDK MUST
perform exactly one logical fallback: remove `replyTo` and send the same Agent answer at same-chat top
level. Each attempt MUST preserve chat, content, rendering and generated mentions. Cross-chat is forbidden.
Thread/reply anchor preservation is not guaranteed because the anchor is unavailable.

### CTR-TARGET-REVOKED-002 — Connector adds no second fallback

Connector MUST NOT retry, add another target-revoked fallback, use raw/direct SDK, or automatically
replay. Failed SDK fallback MUST fail loud subject only to `CTR-TRANSPORT-RETRY-001`.

### CTR-TRANSPORT-RETRY-001 — SDK owns bounded transport retry

Reviewed SDK MAY retry `rate_limited` and `unknown`. Total transport attempts per send leg MUST be
bounded by `maxAttempts=3`; same-chat/content/rendering/mention preservation applies per attempt.
Connector-owned retry is `NONE`.

### CTR-TRANSPORT-RETRY-002 — Exhaustion and ambiguity are truthful

After attempts exhaust, operation MUST fail loud; connector retry and automatic replay MUST be zero.
Ambiguous unknown MUST end as `OUTCOME_UNKNOWN`. Visible exactly-once is `NOT_CLAIMED` where remote
acceptance cannot be proven.

### CTR-PERMISSION-ERROR-001 — Permission denied fails loud

`permission_denied` MUST fail loud and MUST NOT remove `replyTo`, switch top-level, invoke format fallback,
or be masked by connector.

### CTR-FORMAT-FALLBACK-001-V3 — SDK post-to-text format fallback only

Only a `format_error` in the fixed SDK's `msgType === 'post'` path receives its existing one logical `post → text` fallback, retaining answer content and generated mentions under native conversion. Markdown source characters in plain text are acceptable. Already-selected `text` and static `interactive` card format rejections receive no second format downgrade/send from this Contract. This does not alter the separately defined target-revoked behavior.
The one logical transition is per SDK send leg; SDK transport attempts remain governed by `CTR-TRANSPORT-RETRY-001`. Connector fallback/retry/replay MUST be zero. No fallback is added after the SDK returns a terminal result.

### CTR-PHASE-A-PRECONDITION-001 — Same-main-base precondition

Implementation MUST start only from a main descendant containing this Spec's accepted exact content and
Phase A foundation implementation on that same base. PR number, branch, historical head or unmerged
accepted-looking document MUST NOT satisfy it. Fresh preflight MUST re-inventory callers and D-U1 seam.

### CTR-BOUNDARY-001-V3 — Implementation scope remains narrow

After all authority gates, implementation MAY change `packages/feishu-connector/**`, direct tests, and
the successful-reply seam and `ingress-delivery.js` diagnostic branches defined in CTR-ROUTER-INTENT-001-V3 and CTR-DISPLAY-003. It MUST NOT change AgentProcess, Binding, PREBOUND_ONLY,
workspace/session, scheduler-router, broker, product API, notification ingress, Kernel, dependencies or
other Phase B behavior.

### CTR-TEST-APP-001 — Real-client gates precede production canary

Every mandatory test-app case in §10 MUST pass against pinned implementation/runtime before canary. Unit
or mock evidence MUST NOT substitute for table, mention, notification, topic, revoked, permission, format
or exhausted-attempt behavior.

### CTR-ROLLBACK-001 — Restore previous verified commit

Implementation MUST add no persistent product state or Binding migration. Rollback MUST restore the
previous verified deployment commit; no dual flag/data migration is authorized.



### CTR-DISPLAY-001 — 发送前保守选择

本预检仅适用于 Router 成功回复（现有 opts.ux.rendering=markdown 意图），不适用于 Scheduler presentation 意图或其他发送方。不得使用 cardEligible 并集作为本预检的触发条件。
在该 Router 成功答案进入 card 或 markdown/post 发送前，若原文本含 `![`，或大小写不敏感的 `<img` / `<image` / `<video` / `<audio`，或无法由此纯预检明确排除的该类媒体输入，必须直接构造 SDK `{text: originalAnswer}`。
首期 `img_*` 字符串不视为资源有效性证明；上述图片语法无论目标是 URL、img key 或 reference 均走 text。
保守命中代码块中的图片语法允许降级。保留答案原始字节和 URL，不解析/改写 URL，不删除正文，不进行网络资源探测。
预检不创建新 Markdown parser。未命中输入继续现有 card/markdown、empty/oversize 行为；不声称支持所有未来媒体语法。

### CTR-DISPLAY-002 — 发送目标和计数

沿用既有 ReplyTarget、replyTo/replyInThread。card 模式触发的 text 例外保持 card 模式不自动 mention；markdown 模式触发的 text 例外沿用该路径现行 mention 策略，不增加新提及。
一次逻辑答案最多一次上层 `channel.send` 调用。固定 SDK 内部的分块、格式/目标 fallback 和 retry 仍按既有合同执行；不能把逻辑调用一次宣称为 wire attempt 一次或用户可见 exactly-once。
终局失败后不得第二次发送原答案、切模型、重跑业务或由本功能返回自动 retry 指令。

### CTR-DISPLAY-003 — 保留执行结果并区分阶段

`deliverIngress()` 的失败结果 MUST 是以下封闭 discriminated union 之一；所有 variant 保留既有
top-level `error`，不得添加未列出的诊断枚举值：

```text
AdmissionFailure = {
  error: Error,
  failureStage: 'admission'
}

ExecutionFailure = {
  error: Error,
  failureStage: 'execution'
}

ReplyDeliveryFailure = {
  error: Error,
  failureStage: 'reply_delivery',
  executionResult: {
    reply: string,
    agentId: string,
    sessionId: string,
    pid?: number,
    status?: string,
    reconciliationHandle?: string,
    evidence?: object
  },
  replyDelivery: 'failed' | 'unknown',
  partialDelivery: 'possible',
  confirmedChunkReceipts: 'unavailable',
  failureReceipt: { status: 'delivered' | 'failed' | 'not_attempted' }
}
```

`admission` 仅用于 prompt 未进入执行的结果，并保留原 `not_admitted`/`fencedBy`/envelope；已进入
执行但尚未获得 turnResult 的错误为 `execution`。只有获得 turnResult 后的 `feishu.reply` 失败为
`reply_delivery`，其 `executionResult` MUST 与若发送成功本来会返回的既有 success projection
字段和值相同，不得把 delivery 状态写入 execution status，也不得丢失 status、handle 或 evidence。

确定投递失败的回执说明“答案已生成，但回复投递失败”；终局 unknown/send_timeout 回执说明
“答案已生成，但投递结果未知，可能已送达”。若 executionResult 自身没有 completed 证据，不能
自行断言 completed。`failureReceipt.status` 只描述错误回执本身；回执不得包含原答案正文，回执失败
不得改写 `executionResult`。非飞书入口不尝试回执并使用 `not_attempted`。

此投影不改变 turn store/fence，不新增持久化或 execution authority。不在日志输出答案正文或私有 URL。

### CTR-DISPLAY-004 — SDK 终局 unknown 与缺 ID

SDK 终局 unknown（含其内部缺 messageId 重试后仍失败）或 send_timeout 返回后，上层投影 replyDelivery=unknown，不再调用 channel.send 重发原答案；Agent 执行计数不增加。
真实内部 attempt 数未公开时记 unavailable，测试桩可观测；禁止伪造 production attempt=1 或 attempt=3。
SDK send_timeout 与 unknown 原错误分类保持不变；二者均投影 replyDelivery=unknown，用户回执必须说明“可能已送达”。SDK 默认不重试 send_timeout 不构成未送达证明，不能投影为 definitively_rejected。全链路 ambiguous 零重试不属于首期保证。

`error.code` 为 `unknown`、`send_timeout` 或未被固定分类器证明为确定拒绝的值时，
`replyDelivery='unknown'`。`error.code` 为 SDK 已分类的 `permission_denied`、`format_error`、
`target_revoked` 或 `rate_limited` 且相应 SDK attempts/fallback 已终局失败时，
`replyDelivery='failed'`。任何映射都 MUST 保留原 `error.code`，不得把 timeout 改写成 unknown code。

### CTR-DISPLAY-005 — 分块失败诚实投影

SDK 全部成功时只记录实际返回的 messageId/chunkIds，不生成 failure union。
任一逻辑发送失败均使用 `partialDelivery='possible'`、
`confirmedChunkReceipts='unavailable'`；即使终局错误是 format/permission rejection，也不能据此声称整个答案零送达。
上层显示“可能部分送达，已确认块回执不可用”，不重新投递整篇。缺回执不生成假 chunkIds，不建设旁路拦截 transport。
SDK 明确错误码只描述终局调用；除非已有证据排除先前 chunks/unknown attempts，不推导逻辑答案整体 definitively_rejected。

### CTR-DISPLAY-006 — 零业务重放

原 unknown 请求和被拒排队请求不得重放。展示修复验收必须证明包含图片的单次新 canary 只产生一次 Agent 执行。现有历史答案不因部署自动补投。

## 10. Acceptance

### ACC-MARKDOWN-001 — Native Markdown surface

- Contracts: `CTR-MARKDOWN-001-V3`, `CTR-MARKDOWN-002`
- Method: send-plan tests and real-app heading/list/quote/emphasis/code/link checks.
- Environment: pinned implementation/runtime and real Feishu group.
- Required evidence: commit, SDK coordinate, message IDs and client captures.
- Expected result: native rendering; no custom/raw/direct transport.
- Failure condition: required raw Markdown or second renderer/transport.

### ACC-MARKDOWN-HEADING-NATIVE-001 — Native heading fidelity gate



- Contracts: `CTR-MARKDOWN-HEADING-NATIVE-001`, `CTR-MARKDOWN-002`,
  `CTR-TEST-APP-001`
- Method: 发送一份输入含 `#` 至 `######` 六个唯一标签文本的文档（每个级别带可核对的唯一
  label），在 dedicated test-app 真实客户端检视渲染结果，并核对 SDK 发送载荷。
- Environment: dedicated non-production test app（沿用 §10 的 dedicated test-app 门槛；
  禁止 production App 与 standalone pilot App）。
- Required evidence: 精确输入、message ID、发送载荷（post md 元素 text）、客户端 capture、
  connector/SDK 配置与 dependency pin 快照。
- Expected result:
  1. 输入包含 `#` 至 `######` 六个唯一标签；
  2. 六个标签文字全部存在（text preservation）；
  3. 顺序与输入一致（order preservation）；
  4. SDK payload 中仍有原生 heading treatment（SDK 归一化后的 `####`/`#####` 属于合规样式）；
  5. 无内容丢失、合并或重排；
  6. 不以六种视觉级别 distinct 作为通过条件；
  7. 无 custom converter（`config.markdownConverter` 保持 unset）；
  8. SDK pin 未改变（runtime 仍为 `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`）。
- Failure condition（取代旧 `any heading level flattened`）:
  - `heading text missing`（任一标题 label 文本缺失/被改写）；
  - `heading order changed`（标题相对顺序变化）；
  - `all heading treatment lost`（全部退化为无格式正文）;
  - `heading content merged`（任意两个标题被合并为一个）；
  - `second rendering authority introduced`（启用 custom converter / connector heading preprocessor /
    更改 SDK pin 来恢复视觉区分）。


### ACC-MARKDOWN-NESTED-LIST-001 — One-level ordered and unordered nesting

- Contracts: `CTR-MARKDOWN-001-V3`, `CTR-MARKDOWN-NESTED-LIST-001`, `CTR-TEST-APP-001`
- Method: send unordered and ordered lists, each with one nested child level and unique item text.
- Environment: dedicated test app and real Feishu client.
- Required evidence: exact input, message ID and capture showing parent/child hierarchy and order.
- Expected result: `NESTED_LIST_DEPTH_REQUIRED = 1`; both list kinds preserve hierarchy, order and text.
- Failure condition: flattening, reordering, missing child/item text or loss of ordered-list numbering.

### ACC-MARKDOWN-CODE-LANGUAGE-001 — Language-tagged fenced code

- Contracts: `CTR-MARKDOWN-CODE-LANGUAGE-001`, `CTR-MARKDOWN-003`, `CTR-TEST-APP-001`
- Method: send a normal `python` fenced block containing `print("hello")`, then repeat with the fence
  crossing the SDK long-message split boundary.
- Environment: dedicated test app with observable input/chunks.
- Required evidence: exact input, chunk payloads/order, message IDs and client captures.
- Expected result: fences, `python` tag and code bytes remain present; split fences close/reopen safely.
- Failure condition: untagged fence, changed/lost code, lost language tag or unsafe chunk boundary.

### ACC-MARKDOWN-LINK-BYTE-STABLE — Link text and URL preservation

- Contracts: `CTR-MARKDOWN-LINK-001`, `CTR-MARKDOWN-003`, `CTR-TEST-APP-001`
- Method: send a link whose URL contains query parameters, fragment and percent encoding in both normal
  and long-message inputs.
- Environment: send-plan integration evidence plus dedicated test app.
- Required evidence: exact source URL, SDK input/chunks, message ID, clickable-link capture and destination observation.
- Expected result: display text is preserved; Agent Core/SDK input URL is byte-identical, including query,
  fragment and percent encoding; no replacement redirect URL is introduced.
- Failure condition: any input rewrite, parameter/fragment loss, double encoding or redirect substitution.

### ACC-MARKDOWN-TABLE — Native simple-table gate

- Contracts: `CTR-MARKDOWN-001-V3`, `CTR-MARKDOWN-002`, `CTR-TEST-APP-001`
- Method: send GFM pipe table via real SDK and inspect client.
- Environment: dedicated test app.
- Required evidence: coordinates, message ID and capture.
- Expected result: simple table renders as table.
- Failure condition: non-table rendering stops for Owner review; no local fallback.

### ACC-MARKDOWN-LONG-001 — Long-content fidelity

- Contracts: `CTR-MARKDOWN-003`
- Method: send in-limit and >3500 mixed Markdown.
- Environment: integration and dedicated test app.
- Required evidence: ordered IDs, reconstruction and captures.
- Expected result: one in-limit message; complete ordered safe chunks; mention first chunk only.
- Failure condition: truncation, reorder, broken fence/link, duplicate mention or wrong conversation.

### ACC-MARKDOWN-LONG-WITH-TABLE-001 — Long mixed-content closure

- Contracts: `CTR-MARKDOWN-003`, `CTR-MARKDOWN-LONG-TABLE-001`, `CTR-MARKDOWN-CODE-LANGUAGE-001`,
  `CTR-MARKDOWN-LINK-001`, `CTR-AUTO-MENTION-CODE-FENCE-001`, `CTR-TEST-APP-001`
- Method: send a greater-than-3500-character group reply containing one simple table, a language-tagged
  code fence, a query/fragment/percent-encoded link and automatic triggering-sender mention.
- Environment: dedicated test app with SDK chunk observation and real Feishu clients.
- Required evidence: exact source, ordered chunk/message IDs, reconstructed content, mention position,
  table/code/link captures and recipient observation.
- Expected result: table remains complete; fence/tag/link survive; mention is outside code and only first
  chunk; chunk order matches source; no content is lost.
- Failure condition: table omitted/broken, content loss/reorder, code/link mutation or misplaced/duplicate mention.

### ACC-GROUP-AUTO-MENTION — Group triggering-sender mention

- Contracts: `CTR-AUTO-MENTION-001`, `CTR-AUTO-MENTION-003`, `CTR-ROUTER-INTENT-001-V3`, `CTR-ROUTER-INTENT-002`
- Method: human triggers group turn; inspect sender/recipient clients.
- Environment: dedicated test app with two users.
- Required evidence: ingress openId, outbound ID, clickable mention and notification capture.
- Expected result: first chunk mentions only triggering sender with native notification.
- Failure condition: missing/wrong/non-clickable/name-derived/extra mention.

### ACC-MENTION-OUTSIDE-CODE-FENCE-001 — Mention placement is code-safe

- Contracts: `CTR-AUTO-MENTION-CODE-FENCE-001`, `CTR-MARKDOWN-003`, `CTR-TEST-APP-001`
- Method: send normal and long group/topic replies whose content begins with and spans fenced code.
- Environment: dedicated test app with outbound chunk inspection.
- Required evidence: exact source, chunk payloads, mention position and rendered code capture.
- Expected result: real mention is outside all fences, first chunk only; code bytes are unchanged.
- Failure condition: mention inside code, code mutation, mention after first chunk or duplicate mention.

### ACC-NATIVE-MENTION-NOTIFICATION-001 — Group/topic native notification

- Contracts: `CTR-AUTO-MENTION-001`, `CTR-AUTO-MENTION-NOTIFICATION-001`,
  `CTR-AUTO-MENTION-002`, `CTR-AUTO-MENTION-003`, `CTR-TEST-APP-001`
- Method: execute separate group and topic turns from a real human account; repeat with missing/invalid openId.
- Environment: dedicated test app with the mentioned user's real Feishu client.
- Required evidence: ingress openId, group/topic message IDs, clickable mention captures, recipient native
  notification evidence and missing-ID outbound payload.
- Expected result: both valid-ID cases notify the correct user with a clickable mention; missing/invalid ID
  emits no mention and no plain-name substitute.
- Failure condition: either native notification absent, mention non-clickable/wrong, or identity fabricated;
  failure requires stop and `OWNER_DECISION_REQUIRED` rather than text degradation.

### ACC-TOPIC-AUTO-MENTION — Topic triggering-sender mention

- Contracts: `CTR-AUTO-MENTION-001`, `CTR-AUTO-MENTION-003`, `CTR-ROUTER-INTENT-001-V3`, `CTR-TARGET-REVOKED-001`
- Method: normal topic turn, then separate revoked-target case.
- Environment: dedicated test app.
- Required evidence: thread/root/chat/message IDs, mention and notification capture.
- Expected result: normal reply/mention stays topic; revoked fallback stays same chat with anchor exception.
- Failure condition: normal escape, wrong mention or cross-chat fallback.

### ACC-TOPIC-INGRESS-CONTINUITY-001 — Subsequent topic message keeps Binding identity

- Contracts: `CTR-TOPIC-CONTINUITY-001`, `CTR-TEST-APP-001`
- Method: bot replies in a topic; the user sends a subsequent message in that topic; observe normalization
  and Binding resolution.
- Environment: dedicated test app with a prebound topic conversation.
- Required evidence: chatId, expected/actual threadId and conversationId, ingress record, Binding key/row
  lookup, Router target and client captures.
- Expected result: bot reply stays topic; subsequent ingress has correct threadId and
  `conversationId = chatId:topic:threadId`, resolves the same prebound Binding and does not become group.
- Failure condition: missing/wrong threadId, group conversationId, different Binding or main-chat escape.

### ACC-P2P-NO-MENTION — P2P structural exclusion

- Contracts: `CTR-AUTO-MENTION-002`
- Method: P2P with deliberately true UX intent.
- Environment: seam test and dedicated app.
- Required evidence: payload and capture.
- Expected result: no `<at>`/mention.
- Failure condition: any auto-mention.

### ACC-IDENTITY-OPENID — Identity and missing-ID behavior

- Contracts: `CTR-AUTO-MENTION-002`, `CTR-AUTO-MENTION-003`, `CTR-ROUTER-INTENT-002`
- Method: renamed account, absent/invalid openId, model `@name` text.
- Environment: integration and dedicated app.
- Required evidence: ingress fields, ReplyTarget, mention entries and capture.
- Expected result: valid openId selects correct user; invalid ID no mention; name stays text.
- Failure condition: name/roster/self-claim inference, fabricated ID or Router identity.

### ACC-FAILURE-RECEIPT-NO-MENTION-V3 — Router failure remains plain text

- Contracts: `CTR-ROUTER-INTENT-003-V3`, `CTR-RECEIPT-001-V3`
- Method: force deterministic delivery failure; inspect call and receipt.
- Environment: integration and dedicated app.
- Required evidence: exact Router diff, connector input and capture.
- Expected result: stage-accurate receipt under CTR-DISPLAY-003, plain text, no mention.
- Failure condition: UX opts, Markdown or mention.

### ACC-UNBOUND-PROACTIVE-NO-MENTION-V3 — Excluded caller plan preservation

- Contracts: `CTR-RECEIPT-001-V3`, `CTR-BOUNDARY-001-V3`, `CTR-DISPLAY-001`.
- Method: compare baseline and candidate plans for identical unbound, proactive, Scheduler success and failure inputs; cover card/markdown mode, media-marker bodies, and empty/oversize bodies.
- Environment: unit/integration with stub transport, plus dedicated receipt app case.
- Required evidence: exact baseline/head, call-site diff, complete plan comparisons, invocation counts and receipt capture.
- Expected result: Router media precheck does not run for these callers; Scheduler eligible success retains its card plan in card mode, including with media markers; existing empty/oversize alternatives and noneligible plain-text plans retain targets/mentions/bytes. No Scheduler intent/retry change.
- Failure condition: new text selection for a previously card-eligible Scheduler answer, changed sending plan, new mention or modified excluded caller.

### ACC-ROUTER-INTENT-001-V3 — D-U1 minimal seam

- Contracts: `CTR-ROUTER-INTENT-001-V3`, `CTR-ROUTER-INTENT-002`, `CTR-ROUTER-INTENT-003-V3`, `CTR-BOUNDARY-001-V3`
- Method: exact diff and seam tests.
- Environment: future main-descendant branch.
- Required evidence: file list, call arguments, identity-flow assertions.
- Expected result: success intent remains identity-free; only the specified diagnostic branches differ; other Router behavior unchanged.
- Failure condition: Router change outside the specified diagnostic scope or new identity/target authority.

### ACC-TARGET-REVOKED-SAME-CHAT — Revoked target fallback

- Contracts: `CTR-TARGET-REVOKED-001`, `CTR-TARGET-REVOKED-002`, `CTR-TRANSPORT-RETRY-001`, `CTR-TRANSPORT-RETRY-002`, `CTR-TEST-APP-001`
- Method: revoke original and execute normal, rate-limited and ambiguous variants.
- Environment: dedicated group/topic app with attempt visibility.
- Required evidence: chat IDs, replyTo absence, attempts, payload comparison, native mention/notification,
  connector counters and final error.
- Expected result: one logical same-chat top-level fallback; payload preserved per attempt; SDK <=3;
  connector fallback/retry/replay zero; unknown is `OUTCOME_UNKNOWN`.
- Failure condition: cross-chat, payload loss, connector resend, false exactly-once or hidden failure.

### ACC-SDK-ATTEMPTS-EXHAUSTED — Independent bounded-attempt gate

- Contracts: `CTR-TRANSPORT-RETRY-001`, `CTR-TRANSPORT-RETRY-002`, `CTR-TEST-APP-001`
- Method: independently force `rate_limited` and ambiguous `unknown` through reviewed runtime.
- Environment: dedicated test app, not embedded only in revoked happy path.
- Required evidence: exactly three SDK attempts per exhausted leg, connector counters, terminal class and replay audit.
- Expected result: attempts `3`, fail-loud, connector retry `0`, replay `0`; unknown `OUTCOME_UNKNOWN`.
- Failure condition: wrong/unbounded count, connector attempt, replay, swallowed error or exactly-once claim.

### ACC-PERMISSION-ERROR-001 — Permission denial does not degrade

- Contracts: `CTR-PERMISSION-ERROR-001`, `CTR-TEST-APP-001`
- Method: induce permission-denied.
- Environment: dedicated test app.
- Required evidence: attempt/fallback trace and observable error.
- Expected result: fail-loud without top-level/text degradation.
- Failure condition: fallback, masking or connector retry.

### ACC-FORMAT-FALLBACK-001-V3 — Path-specific format fallback

- Contracts: `CTR-FORMAT-FALLBACK-001-V3`, `CTR-TRANSPORT-RETRY-001`, `CTR-TEST-APP-001`.
- Method: independently induce format_error for post, preselected text, and static interactive card; separately observe retryable transport.
- Environment: fixed SDK with stub transport for all three branches; dedicated app post case with attempt instrumentation. Mock cases are labeled simulated.
- Required evidence: msgType, SDK transitions/attempts, connector counters and original Agent execution count.
- Expected result: post has one logical text transition per failing send leg; preselected text/static card have zero format transitions or second sends. SDK policy remains per leg; connector retry/replay zero; no Agent re-execution.
- Failure condition: format downgrade of text/card, second logical fallback, connector fallback or transport-count conflation.

### ACC-PHASE-A-PRECONDITION-001 — Same-main-base preflight

- Contracts: `CTR-PHASE-A-PRECONDITION-001`
- Method: fetch/pin future base; verify accepted blob, foundation files and callers.
- Environment: future implementation base from main.
- Required evidence: exact SHA, accepted blob, implementation paths and checks.
- Expected result: both conditions on one base and D-U1 seam intact.
- Failure condition: PR substituted for content, missing condition or seam drift.

### ACC-BOUNDARY-001-V3 — File and persistent-state boundary

- Contracts: `CTR-BOUNDARY-001-V3`, `CTR-ROLLBACK-001`
- Method: changed-file/diff and state/migration inventory.
- Environment: future implementation branch.
- Required evidence: files, dependency diff, migrations and rollback record.
- Expected result: authorized connector/tests, successful-reply seam and bounded ingress-delivery diagnostic branches only; no persistent state.
- Failure condition: forbidden path, dependency, migration or broader Router change.

### Contract coverage

| Contract | Acceptance coverage | Covered |
|---|---|---|
| `CTR-MARKDOWN-001-V3` | `ACC-MARKDOWN-001`, `ACC-MARKDOWN-TABLE` | YES |
| `CTR-MARKDOWN-HEADING-NATIVE-001` | `ACC-MARKDOWN-HEADING-NATIVE-001` | YES |
| `CTR-MARKDOWN-NESTED-LIST-001` | `ACC-MARKDOWN-NESTED-LIST-001` | YES |
| `CTR-MARKDOWN-CODE-LANGUAGE-001` | `ACC-MARKDOWN-CODE-LANGUAGE-001`, `ACC-MARKDOWN-LONG-WITH-TABLE-001` | YES |
| `CTR-MARKDOWN-LINK-001` | `ACC-MARKDOWN-LINK-BYTE-STABLE`, `ACC-MARKDOWN-LONG-WITH-TABLE-001` | YES |
| `CTR-MARKDOWN-002` | `ACC-MARKDOWN-001`, `ACC-MARKDOWN-TABLE` | YES |
| `CTR-MARKDOWN-003` | `ACC-MARKDOWN-LONG-001` | YES |
| `CTR-MARKDOWN-LONG-TABLE-001` | `ACC-MARKDOWN-LONG-WITH-TABLE-001` | YES |
| `CTR-AUTO-MENTION-001` | `ACC-GROUP-AUTO-MENTION`, `ACC-TOPIC-AUTO-MENTION` | YES |
| `CTR-AUTO-MENTION-CODE-FENCE-001` | `ACC-MENTION-OUTSIDE-CODE-FENCE-001`, `ACC-MARKDOWN-LONG-WITH-TABLE-001` | YES |
| `CTR-AUTO-MENTION-NOTIFICATION-001` | `ACC-NATIVE-MENTION-NOTIFICATION-001` | YES |
| `CTR-AUTO-MENTION-002` | `ACC-P2P-NO-MENTION`, `ACC-IDENTITY-OPENID` | YES |
| `CTR-AUTO-MENTION-003` | group/topic/identity Acceptances | YES |
| `CTR-TOPIC-CONTINUITY-001` | `ACC-TOPIC-INGRESS-CONTINUITY-001` | YES |
| `CTR-ROUTER-INTENT-001-V3` | group and Router Acceptances | YES |
| `CTR-ROUTER-INTENT-002` | group/identity/Router Acceptances | YES |
| `CTR-ROUTER-INTENT-003-V3` | failure and Router Acceptances | YES |
| `CTR-RECEIPT-001-V3` | failure and unbound/proactive Acceptances | YES |
| `CTR-TARGET-REVOKED-001` | topic and revoked Acceptances | YES |
| `CTR-TARGET-REVOKED-002` | revoked Acceptance | YES |
| `CTR-TRANSPORT-RETRY-001` | revoked/exhausted/format Acceptances | YES |
| `CTR-TRANSPORT-RETRY-002` | revoked/exhausted Acceptances | YES |
| `CTR-PERMISSION-ERROR-001` | permission Acceptance | YES |
| `CTR-FORMAT-FALLBACK-001-V3` | format Acceptance | YES |
| `CTR-PHASE-A-PRECONDITION-001` | Phase A precondition Acceptance | YES |
| `CTR-BOUNDARY-001-V3` | Router/unbound/boundary Acceptances | YES |
| `CTR-TEST-APP-001` | dedicated app Acceptance items | YES |
| `CTR-ROLLBACK-001` | boundary Acceptance | YES |
| `CTR-DISPLAY-001` | `ACC-DISPLAY-001`, `ACC-DISPLAY-005` | YES |
| `CTR-DISPLAY-002` | `ACC-DISPLAY-002`, `ACC-DISPLAY-003`, `ACC-DISPLAY-005` | YES |
| `CTR-DISPLAY-003` | `ACC-DISPLAY-004`, `ACC-DISPLAY-006` | YES |
| `CTR-DISPLAY-004` | `ACC-DISPLAY-002`, `ACC-DISPLAY-004` | YES |
| `CTR-DISPLAY-005` | `ACC-DISPLAY-003`, `ACC-DISPLAY-004` | YES |
| `CTR-DISPLAY-006` | `ACC-DISPLAY-003`, `ACC-DISPLAY-004`, `ACC-DISPLAY-005`, `ACC-DISPLAY-006` | YES |


### ACC-DISPLAY-001 — Router media preselection

- Contracts: `CTR-DISPLAY-001`, `CTR-MARKDOWN-001-V3`, `CTR-RECEIPT-001-V3`.
- Method: parameterized connector plan test with external/encoded URLs, img key, reference image, HTML media,
  code-block marker, ordinary Markdown, empty and oversize bodies; separately invoke Scheduler presentation.
- Environment: exact implementation with stub SDK transport; simulated, zero network.
- Required evidence: exact input bytes, selected SDK input variant, card/post/text attempt counters, caller intent
  and baseline/candidate Scheduler plan comparison.
- Expected result: every Router-success media case selects `{text: originalAnswer}`, preserves bytes/URL and has
  interactive/post attempts zero; non-media and Scheduler cases retain their existing plans.
- Failure condition: media enters card/post, bytes change, network resource probe occurs, or Scheduler is selected
  by the media precheck.

### ACC-DISPLAY-002 — Bounded SDK outcomes and timeout projection

- Contracts: `CTR-DISPLAY-002`, `CTR-DISPLAY-004`, `CTR-TRANSPORT-RETRY-001`,
  `CTR-TRANSPORT-RETRY-002`.
- Method: run short text success, retryable unknown, missing messageId, send_timeout and deterministic rejection
  through the fixed SDK with instrumented stub transport and the real upper send seam.
- Environment: SDK `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`; simulated transport.
- Required evidence: upper `channel.send` count, lower wire-attempt count, original/final error code, returned union,
  failure-receipt text and Agent prompt/execution counters.
- Expected result: upper call is one; unknown/missing-ID follow current SDK bounded retry; send_timeout is not retried
  by default; unknown/send_timeout preserve code and project `replyDelivery='unknown'` with “可能已送达”; no Agent
  prompt or execution is added.
- Failure condition: upper resend, error reclassification, timeout projected failed/not-delivered, fabricated attempt
  count or Agent re-execution.

### ACC-DISPLAY-003 — Partial chunk failure is possible/unavailable

- Contracts: `CTR-DISPLAY-002`, `CTR-DISPLAY-005`, `CTR-DISPLAY-006`.
- Method: force at least two SDK text chunks, accept the first and fail the second independently with unknown,
  permission and format classifications.
- Environment: fixed SDK with instrumented stub transport; simulated.
- Required evidence: chunk inputs/order, lower attempts, upper call count, thrown terminal error and returned
  `ReplyDeliveryFailure`; transport stub privately records the first ID only to prove SDK does not return it.
- Expected result: every failure returns `partialDelivery='possible'` and
  `confirmedChunkReceipts='unavailable'`; upper resend/replay is zero and no fake chunk ID is exposed.
- Failure condition: whole-answer zero-delivery assertion, partial ID fabrication, entire-answer resend or new prompt.

### ACC-DISPLAY-004 — Stage-specific result union preserves execution

- Contracts: `CTR-DISPLAY-003`, `CTR-DISPLAY-004`, `CTR-DISPLAY-005`, `CTR-DISPLAY-006`,
  `CTR-ROUTER-INTENT-003-V3`.
- Method: exercise fenced-before-admission, pre-turn-result execution failure, completed execution plus each reply
  error class, and reply error followed by failure-receipt failure through the real ingress function.
- Environment: real Router ingress code with fake process/Feishu dependencies; simulated delivery.
- Required evidence: exact returned object keys/values, original Error fields, source turnResult projection, receipt
  attempt/status and execution/prompt/send counters.
- Expected result: variants match exactly §9 `AdmissionFailure`, `ExecutionFailure` or `ReplyDeliveryFailure`;
  admission retains not_admitted/fencedBy, reply failure retains byte-equal execution projection, enum mapping and
  possible/unavailable; receipt failure changes only `failureReceipt.status`.
- Failure condition: wrong discriminator/enum, unlisted diagnostic field, missing status/handle/evidence, delivery
  state written into execution, receipt error replacing original error, or extra execution/send.

### ACC-DISPLAY-005 — Real original-entry image-answer canary

- Contracts: `CTR-DISPLAY-001`, `CTR-DISPLAY-002`, `CTR-DISPLAY-006`, `CTR-TEST-APP-001`.
- Method: after all authority/test/deployment gates, send one new harmless image-containing request from the original
  user entry to the bound Agent and inspect client, session and transport receipts.
- Environment: authorized dedicated test app first; production only under a separate valid serialized operation.
- Required evidence: sanitized exact request/answer hash, message ID, target/thread/mention metadata, Agent turn and
  upper-send counts, client capture and historical-request replay audit.
- Expected result: original body and URL are received; same Agent execution count is one; upper original-answer
  resend is zero; target/thread/mention are correct; historical answers are not replayed.
- Failure condition: missing/changed body or link, wrong Agent/thread/mention, multiple executions/sends, or any
  historical replay. Simulated evidence cannot satisfy this item.

### ACC-DISPLAY-006 — Scope, dependency and storage preservation

- Contracts: `CTR-DISPLAY-003`, `CTR-DISPLAY-006`, `CTR-BOUNDARY-001-V3`, `CTR-ROLLBACK-001`.
- Method: exact base/head diff, dependency/config/state inventory, affected regression suite and production mutation
  audit.
- Environment: isolated implementation branch; production read-only preflight where authorized.
- Required evidence: changed-path list, SDK lock/pin diff, AgentProcess/Binding/Session/Scheduler/identity/result-store
  diffs, test results, rollback preimage and production mutation receipt.
- Expected result: only V3-authorized display paths change; SDK pin/retry, lifecycle, identity, Scheduler plan and
  persistent result stores are unchanged; production mutation remains zero until its separate gate.
- Failure condition: forbidden file/authority/state change, new storage/retry/replay, missing rollback preimage or
  unapproved production mutation.

### Inherited real-client gates


These are mandatory definitions, not executed Observations or conformance Evidence in this proposed Spec.

| Case | Acceptance | Required live result |
|---|---|---|
| `TEST-LUX-MD-SURFACE` | `ACC-MARKDOWN-001` | heading/list/quote/emphasis/code/link native |
| `TEST-LUX-MD-HEADINGS-NATIVE` | `ACC-MARKDOWN-HEADING-NATIVE-001` | all six labels/order/native heading treatment retained; distinct visual levels not required |
| `TEST-LUX-MD-NESTED-LISTS` | `ACC-MARKDOWN-NESTED-LIST-001` | ordered/unordered depth 1 hierarchy, order and text preserved |
| `TEST-LUX-MD-CODE-LANGUAGE` | `ACC-MARKDOWN-CODE-LANGUAGE-001` | `python` fence/tag/code preserved normally and across split |
| `TEST-LUX-MD-LINK-BYTE-STABLE` | `ACC-MARKDOWN-LINK-BYTE-STABLE` | display text and exact query/fragment/percent-encoded URL preserved |
| `TEST-LUX-MD-TABLE` | `ACC-MARKDOWN-TABLE` | GFM table renders as table; otherwise stop |
| `TEST-LUX-MD-LONG` | `ACC-MARKDOWN-LONG-001` | complete ordered safe chunks; mention first only |
| `TEST-LUX-MD-LONG-WITH-TABLE` | `ACC-MARKDOWN-LONG-WITH-TABLE-001` | >3500 input includes intact table/code/link/mention in source order with no loss |
| `TEST-LUX-GROUP-MENTION` | `ACC-GROUP-AUTO-MENTION` | clickable sender mention plus notification |
| `TEST-LUX-TOPIC-MENTION` | `ACC-TOPIC-AUTO-MENTION` | normal reply/mention stays topic |
| `TEST-LUX-MENTION-OUTSIDE-CODE` | `ACC-MENTION-OUTSIDE-CODE-FENCE-001` | mention remains outside code, first chunk only, code unchanged |
| `TEST-LUX-NATIVE-NOTIFICATION` | `ACC-NATIVE-MENTION-NOTIFICATION-001` | group and topic recipients receive native notification; missing ID creates none |
| `TEST-LUX-TOPIC-CONTINUITY` | `ACC-TOPIC-INGRESS-CONTINUITY-001` | subsequent ingress keeps threadId, topic conversationId and same Binding |
| `TEST-LUX-P2P-NO-MENTION` | `ACC-P2P-NO-MENTION` | no mention even with intent |
| `TEST-LUX-IDENTITY` | `ACC-IDENTITY-OPENID` | renamed user works by openId; invalid ID no mention |
| `TEST-LUX-RECEIPTS` | receipt Acceptances | Router/unbound receipts plain text/no mention; Scheduler original plan retained |
| `TEST-LUX-TARGET-REVOKED` | `ACC-TARGET-REVOKED-SAME-CHAT` | one logical same-chat fallback; no connector resend |
| `TEST-LUX-SDK-ATTEMPTS-EXHAUSTED` | `ACC-SDK-ATTEMPTS-EXHAUSTED` | independent rate-limited/unknown; 3 SDK attempts; fail-loud; connector/replay 0 |
| `TEST-LUX-PERMISSION` | `ACC-PERMISSION-ERROR-001` | fail-loud without top-level/text degradation |
| `TEST-LUX-FORMAT` | `ACC-FORMAT-FALLBACK-001-V3` | post-only text transition; text/card zero format downgrade; transport SDK-owned |

All MUST pass before production canary. Ambiguous unknown remains `OUTCOME_UNKNOWN` and MUST NOT become
a visible-exactly-once claim.

### Semantic closure matrix

| Audit omission | CTR | ACC | Test gate |
|---|---|---|---|
| H1–H6 headings | `CTR-MARKDOWN-HEADING-NATIVE-001` | `ACC-MARKDOWN-HEADING-NATIVE-001` | `TEST-LUX-MD-HEADINGS-NATIVE` |
| one-level nested lists | `CTR-MARKDOWN-NESTED-LIST-001` | `ACC-MARKDOWN-NESTED-LIST-001` | `TEST-LUX-MD-NESTED-LISTS` |
| language-tagged fence | `CTR-MARKDOWN-CODE-LANGUAGE-001` | `ACC-MARKDOWN-CODE-LANGUAGE-001` | `TEST-LUX-MD-CODE-LANGUAGE` |
| byte-stable link URL | `CTR-MARKDOWN-LINK-001` | `ACC-MARKDOWN-LINK-BYTE-STABLE` | `TEST-LUX-MD-LINK-BYTE-STABLE` |
| mention outside fence | `CTR-AUTO-MENTION-CODE-FENCE-001` | `ACC-MENTION-OUTSIDE-CODE-FENCE-001` | `TEST-LUX-MENTION-OUTSIDE-CODE` |
| mandatory native notification | `CTR-AUTO-MENTION-NOTIFICATION-001` | `ACC-NATIVE-MENTION-NOTIFICATION-001` | `TEST-LUX-NATIVE-NOTIFICATION` |
| long text with table | `CTR-MARKDOWN-LONG-TABLE-001` | `ACC-MARKDOWN-LONG-WITH-TABLE-001` | `TEST-LUX-MD-LONG-WITH-TABLE` |
| subsequent topic threadId | `CTR-TOPIC-CONTINUITY-001` | `ACC-TOPIC-INGRESS-CONTINUITY-001` | `TEST-LUX-TOPIC-CONTINUITY` |

```text
SEMANTIC_CLOSURE_MATRIX = 8/8
PRODUCT_SEMANTIC_CHANGE = DISPLAY_DELTA_ONLY
```

## 11. Alternatives and disposition

- ALT-001 rejected：提示词禁止图片作为唯一修复；无法覆盖自由输出及其他投递错误。
- ALT-002 rejected：卡片失败后 connector 再发全文；可能重复，违反 SDK 单一重试权威。
- ALT-003 deferred：SDK ambiguous 零重试及部分成功回执；需要单独能力修订，不假装已有。
- ALT-004 deferred：自动图片上传/缓存、长期结果存储、自动回收；均不阻塞本候选。

## 12. Migration, compatibility, and rollback

无需状态迁移或新存储；附加诊断保持原 envelope/status/handle 兼容。
适用目标在接受/部署前 fresh 固定，不批量重启所有 Agent。rollback 恢复此次修改文件的 exact preimage，不重放历史答案。
本展示修复的文档审查与隔离开发可以并行。影响同一生产安装、Runtime 或共享部署资源的变更，按现有操作授权与串行 mutation lane 执行；部署前记录当前 generation、可获取的恢复证据及预期影响，并遵守既有操作门的中止条件。本展示规范不新增跨 Goal 的部署阻断条件。

重启后的新 generation 本身不构成旧执行的终止证明。旧执行的解除 fence、结果核定与恢复，仍须依据既有生命周期合同允许的精确证据；不得自动重放历史请求。
部署后先真实无副作用 canary，再按既有授权扩展；Owner 看到图片链接而非嵌入图片是本期有意展示变化。



| Risk | Contract / gate |
|---|---|
| Native table failure | `CTR-MARKDOWN-002`, `ACC-MARKDOWN-TABLE`; stop |
| Mention escapes normal topic | `CTR-AUTO-MENTION-001`, topic Acceptance |
| Name becomes identity | `CTR-AUTO-MENTION-003`, identity Acceptance |
| Failure/proactive opted in | `CTR-RECEIPT-001-V3`, receipt Acceptances |
| Logical fallback confused with attempts | format and retry Contracts |
| Revoked fallback crosses chat/duplicates | revoked Contracts/Acceptance |
| Ambiguous result reported exactly once | `CTR-TRANSPORT-RETRY-002` |
| Router authority expands | Router Contracts/Acceptance |
| PR identity substitutes for main | Phase A precondition Contract |

```text
MIGRATION = NONE
PERSISTENT_STATE_CHANGE = NONE
COMPATIBILITY = UNOPTED_CALLERS_REMAIN_BYTE_COMPATIBLE
ROLLBACK = RESTORE_PREVIOUS_VERIFIED_DEPLOYMENT_COMMIT
EMERGENCY_CONTAINMENT = DISABLE_OR_ROLL_BACK_UX_WITHOUT_DATA_MIGRATION
```

## 13. Open questions

产品语义按本候选完整固定，不以自动回收决定为前提。待处理的是候选接受与部署授权/现场门，不是实施中再自行选择策略。
```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

四项声明表示候选已明确语义与完整替代方案，不表示 Owner 已接受；独立语义审查和精确 reviewed head 接受仍是前置门。
ACCEPTED=NO；IMPLEMENTATION_STARTED=NO；PRODUCTION_APPLIED=NO。

Whole-authority migration preserves the complete effective V2 Decisions, Contracts, Acceptance items, test gates,
scope and prohibitions. Changed meanings use new IDs in the explicit mapping below; heading IDs follow the already
accepted amendment; CTR-LUXHN-BOUNDARY-001 was a historical amendment-only boundary, consumed by whole
succession, not new product behavior. Old investigation/authoring artifacts are not new implementation gates.
Acceptance transaction and exact review remain pending.


### Exhaustive predecessor normative migration

Every identifier in this section is globally qualified as `<SPEC_ID>#<ITEM_ID>`. `PRESERVED` means the
effective meaning is restated under the V3 global identity; `REPLACED` names the changed V3 item;
`RETIRED` applies only to amendment-governance mechanics that have no product effect after whole succession.
No predecessor ID is reused or edited.

#### Decisions

| Predecessor global ID | V3 global ID / disposition |
|---|---|
| `AGENT_CORE_LARK_UX_PHASE1_V2#DEC-LUX-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-001` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#DEC-LUX-002` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-002` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#DEC-LUX-003` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-003` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#DEC-LUX-004` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-004` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#DEC-LUX-005` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-005` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#DEC-LUX-006` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-006` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#DEC-LUX-007` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-007` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#DEC-LUX-008` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-008` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT#DEC-LUXHN-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-009` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT#DEC-LUXHN-002` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-010` — REPLACED by whole succession |
| `AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT#DEC-LUXHN-003` | `AGENT_CORE_LARK_UX_PHASE1_V3#DEC-LUX-V3-010` — PRESERVED as complete effective inventory |

#### Contracts

| Predecessor global ID | V3 global ID / disposition |
|---|---|
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-MARKDOWN-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-001-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-MARKDOWN-HEADING-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-HEADING-NATIVE-001` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-MARKDOWN-NESTED-LIST-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-NESTED-LIST-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-MARKDOWN-CODE-LANGUAGE-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-CODE-LANGUAGE-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-MARKDOWN-LINK-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-LINK-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-MARKDOWN-002` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-002` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-MARKDOWN-003` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-003` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-MARKDOWN-LONG-TABLE-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-LONG-TABLE-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-AUTO-MENTION-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-AUTO-MENTION-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-AUTO-MENTION-CODE-FENCE-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-AUTO-MENTION-CODE-FENCE-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-AUTO-MENTION-NOTIFICATION-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-AUTO-MENTION-NOTIFICATION-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-TOPIC-CONTINUITY-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-TOPIC-CONTINUITY-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-AUTO-MENTION-002` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-AUTO-MENTION-002` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-AUTO-MENTION-003` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-AUTO-MENTION-003` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-ROUTER-INTENT-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-ROUTER-INTENT-001-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-ROUTER-INTENT-002` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-ROUTER-INTENT-002` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-ROUTER-INTENT-003` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-ROUTER-INTENT-003-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-RECEIPT-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-RECEIPT-001-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-TARGET-REVOKED-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-TARGET-REVOKED-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-TARGET-REVOKED-002` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-TARGET-REVOKED-002` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-TRANSPORT-RETRY-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-TRANSPORT-RETRY-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-TRANSPORT-RETRY-002` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-TRANSPORT-RETRY-002` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-PERMISSION-ERROR-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-PERMISSION-ERROR-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-FORMAT-FALLBACK-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-FORMAT-FALLBACK-001-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-PHASE-A-PRECONDITION-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-PHASE-A-PRECONDITION-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-BOUNDARY-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-BOUNDARY-001-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-TEST-APP-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-TEST-APP-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#CTR-ROLLBACK-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-ROLLBACK-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT#CTR-MARKDOWN-HEADING-NATIVE-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#CTR-MARKDOWN-HEADING-NATIVE-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT#CTR-LUXHN-BOUNDARY-001` | RETIRED; amendment-only boundary is consumed by `DEC-LUX-V3-010` and current whole-succession governance |

#### Acceptance items

| Predecessor item(s) | V3 item / disposition |
|---|---|
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MARKDOWN-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MARKDOWN-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MARKDOWN-HEADINGS-H1-H6`; `AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT#ACC-MARKDOWN-HEADING-NATIVE-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MARKDOWN-HEADING-NATIVE-001` — REPLACED / PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MARKDOWN-NESTED-LIST-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MARKDOWN-NESTED-LIST-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MARKDOWN-CODE-LANGUAGE-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MARKDOWN-CODE-LANGUAGE-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MARKDOWN-LINK-BYTE-STABLE` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MARKDOWN-LINK-BYTE-STABLE` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MARKDOWN-TABLE` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MARKDOWN-TABLE` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MARKDOWN-LONG-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MARKDOWN-LONG-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MARKDOWN-LONG-WITH-TABLE-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MARKDOWN-LONG-WITH-TABLE-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-GROUP-AUTO-MENTION` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-GROUP-AUTO-MENTION` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-MENTION-OUTSIDE-CODE-FENCE-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-MENTION-OUTSIDE-CODE-FENCE-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-NATIVE-MENTION-NOTIFICATION-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-NATIVE-MENTION-NOTIFICATION-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-TOPIC-AUTO-MENTION` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-TOPIC-AUTO-MENTION` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-TOPIC-INGRESS-CONTINUITY-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-TOPIC-INGRESS-CONTINUITY-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-P2P-NO-MENTION` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-P2P-NO-MENTION` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-IDENTITY-OPENID` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-IDENTITY-OPENID` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-FAILURE-RECEIPT-NO-MENTION` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-FAILURE-RECEIPT-NO-MENTION-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-UNBOUND-PROACTIVE-NO-MENTION` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-UNBOUND-PROACTIVE-NO-MENTION-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-ROUTER-INTENT-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-ROUTER-INTENT-001-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-TARGET-REVOKED-SAME-CHAT` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-TARGET-REVOKED-SAME-CHAT` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-SDK-ATTEMPTS-EXHAUSTED` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-SDK-ATTEMPTS-EXHAUSTED` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-PERMISSION-ERROR-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-PERMISSION-ERROR-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-FORMAT-FALLBACK-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-FORMAT-FALLBACK-001-V3` — REPLACED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-PHASE-A-PRECONDITION-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-PHASE-A-PRECONDITION-001` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#ACC-BOUNDARY-001` | `AGENT_CORE_LARK_UX_PHASE1_V3#ACC-BOUNDARY-001-V3` — REPLACED |

#### Test gates

| Predecessor gate | V3 gate / disposition |
|---|---|
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MD-SURFACE` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-SURFACE` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MD-HEADINGS-H1-H6`; `AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT#TEST-LUX-MD-HEADINGS-NATIVE` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-HEADINGS-NATIVE` — REPLACED / PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MD-NESTED-LISTS` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-NESTED-LISTS` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MD-CODE-LANGUAGE` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-CODE-LANGUAGE` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MD-LINK-BYTE-STABLE` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-LINK-BYTE-STABLE` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MD-TABLE` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-TABLE` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MD-LONG` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-LONG` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MD-LONG-WITH-TABLE` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-LONG-WITH-TABLE` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-GROUP-MENTION` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-GROUP-MENTION` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-TOPIC-MENTION` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-TOPIC-MENTION` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-MENTION-OUTSIDE-CODE` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MENTION-OUTSIDE-CODE` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-NATIVE-NOTIFICATION` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-NATIVE-NOTIFICATION` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-TOPIC-CONTINUITY` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-TOPIC-CONTINUITY` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-P2P-NO-MENTION` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-P2P-NO-MENTION` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-IDENTITY` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-IDENTITY` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-RECEIPTS` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-RECEIPTS` — REPLACED by V3 caller-plan expectations |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-TARGET-REVOKED` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-TARGET-REVOKED` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-SDK-ATTEMPTS-EXHAUSTED` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-SDK-ATTEMPTS-EXHAUSTED` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-PERMISSION` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-PERMISSION` — PRESERVED |
| `AGENT_CORE_LARK_UX_PHASE1_V2#TEST-LUX-FORMAT` | `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-FORMAT` — REPLACED by post-only expectations |

The amendment's historical mention of
`AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT#TEST-LUX-MD-HEADINGS-H1-H6` names the
retired V2 gate it replaced;
it maps through the same row to `AGENT_CORE_LARK_UX_PHASE1_V3#TEST-LUX-MD-HEADINGS-NATIVE` and is not reactivated.
