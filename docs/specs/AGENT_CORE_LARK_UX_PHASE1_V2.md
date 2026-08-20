---
spec_id: AGENT_CORE_LARK_UX_PHASE1_V2
status: proposed
date: 2026-08-20
type: ux-activation-spec (spec-only; no implementation in authoring round)
scope: >-
  docs-only — authorize the FIRST round of Feishu UX activation on top of the accepted
  @larksuite/channel foundation, covering only (1) markdown/rich-text outbound rendering
  for agent turn replies and (2) group/topic auto-mention of the triggering human sender
  on outbound replies. Everything else in the deferred Phase B backlog stays unauthorized.
builds_upon: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 (accepted; foundation authority)
references:
  - >-
    docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md (accepted; Phase A foundation
    authority; at authoring time present in PR #23 HEAD cce18f3aa8c0836d3255c0514de86bda4dbd961b,
    becomes main authority when PR #23 merges)
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
> BASE_MAIN = `f8ec58dad8f51ff1107326723981bb174254f74d`（origin/main，fetch 复核）  
> IMPLEMENTATION_CANDIDATE = PR #23（OPEN，`feat/lark-channel-sdk-integration-v2-phase-a`）
> HEAD = `cce18f3aa8c0836d3255c0514de86bda4dbd961b`（Phase A 实现 + governing V2 Spec）  
> SDK_SOURCE_AUTHORITY = `bd24f6742513769c80b5401b96ad464d74dd2027`（outbound 原语合同引用基准）  
> SDK_RUNTIME_INSTALL_AUTHORITY = `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`（不变，V2 §11）  
>
> **实现前置（冻结）**：Phase A（PR #23）必须先进入 implementation base branch（main）。
> 本 Spec 可以先 author / review / accept，但在该前置满足前 **不构成任何实现许可**。
>
> 本轮 authoring：`PRODUCT_CODE_CHANGE = NONE`、`DEPENDENCY_CHANGE = NONE`、
> `DEPLOYMENT = NONE`、`PRODUCTION_STATE_CHANGE = NONE`、`MERGE = NONE`、
> `PR23_CHANGE = NONE`。仅新增本文件。
>
> **Owner amendment（2026-08-20）**：`D-U1 = APPROVED`。本 amendment 仅把 Owner
> 对 §5.3 最小 Router seam 的批准写回本 proposed Spec；不 acceptance-finalize、不实现。
> PR #24 当前为 OPEN 且非 Draft；为保持 `status: proposed` 的评审语义，建议转回 Draft，
> 但本轮不修改 PR Draft 状态。

---

## 0. Final Output（authoring round）

```text
SPEC_STATUS = proposed
BUILDS_UPON = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 (accepted)
IMPLEMENTATION_AUTHORIZED = NO
IMPLEMENTATION_PRECONDITION_1 = this spec accepted (independent review PASS + acceptance finalize)
IMPLEMENTATION_PRECONDITION_2 = PR #23 (Phase A) merged into implementation base branch (main)

MARKDOWN_SCOPE_FROZEN = YES
OUTBOUND_MENTION_SCOPE_FROZEN = YES
ROUTER_CHANGE_REQUIRED = YES_MINIMAL
MINIMAL_ROUTER_SEAM = single successful-reply call-site UX opts (§5.3)
D_U1 = APPROVED
OWNER_DECISION_REQUIRED = NONE
ROUTER_AUTHORITY_CHANGE = NONE
ROUTER_PRODUCT_ROUTING_CHANGE = NONE

PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
MERGE = NONE
```

---

## 1. Problem and Positioning

### 1.1 现状（source-verified @ PR #23 HEAD `cce18f3`）

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
RAW_CLIENT = NO
STREAMING_CARD = NO
SECOND_OUTBOUND_TRANSPORT = NO
RECEIPT_RENDERING = PLAIN_TEXT_UNCHANGED           # §3.4
SCHEDULER_DELIVERY_RENDERING = TEXT_UNCHANGED      # §3.4
MARKDOWN_FORMAT_ERROR_FALLBACK = RETRY_ONCE_AS_PLAIN_TEXT   # §3.5
TARGET_REVOKED_FAIL_LOUD = YES                     # §3.5
PERMISSION_ERROR_FAIL_LOUD = YES                   # §3.5
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
（PR #23 `packages/agent-router/src/index.js:691`，
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
RAW_CLIENT = NO                  # 继承 V2 §7
STREAMING_CARD = NO              # 不引入 streaming/card 表面（channel.stream 禁用）
SECOND_OUTBOUND_TRANSPORT = NO   # reply seam 仍是唯一出站路径
```

### 3.4 固定 plain text 的消息（不翻转，字节不变）

| 消息 | 现路径（PR #23） | 本 Spec 后 |
|---|---|---|
| unbound receipt（`INGRESS_GATE_REJECTED_REPLY`） | bridge `createReceiptReply` 直调 `channel.send`（`bridge.js:445-459`），不经过 `handle.reply` | **plain text 不变** |
| Router deterministic failure receipt（`[agent-core] delivery failed: …`） | `index.js:699`，同一 reply seam | **plain text 不变**（不传 UX opts，见 §5） |
| startup / configuration failure 回执 | 启动 fail-loud 路径（compose readiness / bridge startup） | **plain text 不变** |
| scheduler proactive 投递（`createFeishuDeliver` → `scheduler-router/src/index.js:178` `feishu.reply`） | text | **plain text 不变**（`SCHEDULER_DELIVERY_RENDERING = TEXT_UNCHANGED`；把 markdown 扩展到 scheduler 投递 = 未来 owner 决定，本 Spec 不做） |

冻结理由：owner 裁决「系统固定回执继续使用 plain text」+ 行为兼容原则——所有**未显式
opt-in** 的 `feishu.reply` 调用方行为与 Phase A 字节级一致（AC-EXISTING-CALLERS-UNCHANGED）。

### 3.5 Fallback 与错误合同

SDK reviewed source `src/outbound/sender.ts:317-335`（`sendOneWithFallback`）+
`src/outbound/errors.ts`（`classifyError`）冻结如下产品合同：

```text
MARKDOWN_FORMAT_ERROR_FALLBACK = RETRY_ONCE_AS_PLAIN_TEXT
  # 触发类：feishu code 230002/230001、HTTP 400（errors.ts inferCode -> 'format_error'）
  # 机制：SDK builtin —— post 被拒后 postToPlainText 转纯文本、同 chunk 恰好重试一次
  # 边界：Agent Core 不得叠加第二层"整条重发"——已送达 chunk 之上再重发即产生重复消息，
  #        违反 AC-MARKDOWN-TEXT-FALLBACK。仅当整次 send 在首个 chunk 送达前整体失败
  #        （零 chunk 送达）时，connector 允许恰好一次 { text } 重试。
  # 降级保真：postToPlainText 保留 'md' 元素 text 原文（markdown 源字符可接受）；
  #        at-tag 前缀（若有）原文保留于 text 消息中，飞书 text 消息原生渲染 <at> 为真实 mention。

TARGET_REVOKED_FAIL_LOUD = YES
PERMISSION_ERROR_FAIL_LOUD = YES
  # feishu 99991400/99991401、HTTP 401/403（permission_denied）、send_timeout、unknown、
  # 退避耗尽的 rate_limited：SDK 抛错 -> feishu.reply() reject（上抛）——
  # 继承 V1 §10 API_ERROR_FAIL_LOUD 与 Router catch 回执路径，语义不变。
  # 本 Spec 不为这些错误类增加任何 text 降级/掩蔽。

FALLBACK_ERROR_CLASS_GATE = FORMAT_ERROR_ONLY
  # connector 自有任何 UX 层 fallback 只允许以 format_error 为触发条件；
  # target_revoked / permission_denied 永不触发 text fallback。
```

**透明记录（继承行为，非本 Spec 新增，也非本 Spec 可移除）**：SDK
`sendOneWithFallback` 对「带 `replyTo` 且 reply target 已消失（230020/230017/404）」的
子情形**内置静默降级**——去掉 `replyTo` 以顶层 create 重发（`sender.ts:322-324`）。该
行为自 Phase A 起即随 `channel.send` 生效（Phase A 文本路径同样经过
`sendOneWithFallback`），是 V1 §10 `DEGRADATION_MATRIX = NOT_RELIED` 所述 SDK 矩阵的
既存事实。本 Spec **不新增、不移除、不依赖**该子情形；禁用它需要 rawClient（未授权）
或 SDK revision 变更（需独立 compatibility review）。列为 implementation-watch
（§10），不构成 blocker。

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
CHUNK_ORDER_STABLE = REQUIRED      # 顺序 = 文本顺序；anchored 续块链在上一 chunk 的
                                   # message id（replyTargetForChunk），保持 reply/thread 线
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
- topic/thread：同上，且 mention 与回复一起留在 thread 内（不逃逸主群，§7 T-MT-TOPIC）。
- p2p：**结构性排除**——connector 侧 `target.channel === 'p2p'` 永不注入 mention，
  即使调用方误传 opts 也不可能 @（防御性结构保证，非仅靠调用纪律）。
- `@all` 触发的 turn 同样适用：触发者 = `IngressEvent.sender`（发消息的人），
  不区分其以 @bot 还是 @all 触发。

### 4.2 身份权威（单一）

```text
MENTION_IDENTITY_AUTHORITY = INGRESS_EVENT_SENDER_OPEN_ID
```

Mention 身份**必须**来自产出该回复的 turn 所对应的 `IngressEvent.sender.openId`
（PR #23 `bridge.js:99-111`：SDK 归一化 `sender.openId` / `sender.name` /
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

### 5.1 现有 seam 事实（PR #23 HEAD source-verified）

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
  （围栏闭合/重开、language tag 保留）；anchored 续块链在同一 reply/thread 线内。

AC-MARKDOWN-TEXT-FALLBACK
  format_error（230002/230001/400）触发恰好一次纯文本重试（SDK builtin 或零 chunk
  送达时的 connector 单次 { text } 重试）；不产生重复消息（同一回复送达的消息数
  ≤ chunk 数）；target_revoked / permission_denied 永不触发 text fallback（fail loud，
  reply() reject -> Router catch 回执路径不变）。
```

### 7.2 出站自动 @

```text
AC-GROUP-AUTO-MENTION-SENDER
  group agent turn 回复第一块含真实可点击 @触发者（test app 实测 T-MT-GROUP）；
  被 @ 用户收到飞书原生提醒；@ 不落在 code fence 内。

AC-TOPIC-AUTO-MENTION-SENDER
  topic/thread 内回复自动 @ 触发者；mention 与回复均留在 thread 内，
  不逃逸到主群（T-MT-TOPIC）。

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
T-MD-FALLBACK  构造 format_error 场景：恰好一次 text 重试、无重复消息
T-MT-GROUP     群回复含真正可点击 @；被 @ 用户收到飞书原生提醒（以该用户客户端为准）
T-MT-TOPIC     topic 内 @ 与回复不逃逸到主群；后续 ingress threadId 派生正确
T-MT-P2P       p2p 无 @
T-MT-RECEIPT   unbound receipt 与 failure receipt 均无 @、plain text
T-MT-IDENTITY  改名/匿名测试账号：@ 仍正确（openId 权威），模型文本 @名字 保持纯文本
```

未全部通过不得 production canary；任一失败 → 停 + OWNER_DECISION_REQUIRED。

---

## 8. Ordering with Phase A（冻结）

```text
PHASE_A_MERGE_PRECONDITION = PR #23 merged into main（implementation base branch）
SPEC_REVIEW_PARALLEL = ALLOWED       # 本 Spec 的 review/accept 可先于 Phase A merge
IMPLEMENTATION_START = REQUIRES (accepted) AND (PHASE_A_MERGE_PRECONDITION)
BASE_RECONCILIATION_REQUIRED = YES   # 实现时对届时 main 重新对账（V2 §8.1 同款纪律）：
  # :691/:699 调用点行号可能漂移 —— 重新验证"单调用点一行 diff"声明；
  # 若 agent-router reply seam 结构性变化 -> 回独立 re-review，不得带病实现。
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
| mention 逃逸 topic 到主群 | T-MT-TOPIC + anchored 续块链测试；create_thread 语义继承 V2 §7 |
| format_error fallback 产生重复消息 | 恰好一次语义 + "零 chunk 送达才允许整条重试"边界 + T-MD-FALLBACK |
| 失败回执被误 @ | AC-FAILURE-RECEIPT-NO-MENTION；opts 不传即不 @ 的默认关闭语义 |
| 名称注入伪造 mention | ReplyTarget context 与 SDK mention entry 只携带 openId；不携带 name，不做名称解析 |
| Router 单调用点 diff 被扩大成 authority 漂移 | AC-ROUTER-DIFF-MINIMAL + `D-U1 = APPROVED` 的窄边界 + review diff 检查 |
| SDK 内置 reply-target-gone 顶层重发被误当本 Spec 新增 | §3.5 透明记录（Phase A 既存）；不新增不依赖不移除 |
| resolveMentionsInText 被顺手打开 | AC-SINGLE-RENDER-AUTHORITY + AC-MENTION-USES-OPEN-ID-NOT-NAME |
| Phase A 未 merge 即开工实现 | §8 双前置；Implementation Preflight 必须验证 |

---

## 11. Independent Review and Acceptance Protocol

独立 reviewer 必须读取：本 proposed commit；V1（superseded）与 V2（accepted）Spec；
PR #23 HEAD `cce18f3` 的 Router/connector/scheduler 源（尤其 :691/:699/bridge/core/scheduler
五个位置）；SDK source `bd24f67` 的 sender/compose-mentions/to-post/splitter/errors/types
六文件；V2 §7 create_thread test-app gate 先例。

```text
review 输出至少包含：
REVIEWER_IDENTITY
REVIEW_BASE_COMMIT
REVIEWED_SPEC_COMMIT
REVIEW_VERDICT = PASS | FIX_REQUIRED
BLOCKERS
OWNER_DECISION_DISPOSITION = D-U1 APPROVED（显式核对）
SEMANTIC_REVIEW_COMPLETE = YES | NO
VERDICT = READY_TO_ACCEPT_AND_MERGE_SPEC | FIX_REQUIRED
```

仅 `PASS + BLOCKERS=NONE + SEMANTIC_REVIEW_COMPLETE=YES` 允许 acceptance-finalize
（`status: proposed -> accepted` + 记录 reviewed head/reviewer/verdict + D-U1 裁决归档）；
本 amendment 写入 D-U1 后不得直接 finalize，须 focused independent re-review。
当前仍为 proposed，实现不得启动。

---

## 12. Related

- `docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2.md`（accepted foundation）
- `docs/specs/AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1.md`（superseded；§1.3/§5.2 命名与承接义务来源）
- `docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md`（SDK 原语证据）
- PR #23 `feat/lark-channel-sdk-integration-v2-phase-a` @ `cce18f3`（Phase A 实现候选 + V2 Spec）
- SDK source `bd24f6742513769c80b5401b96ad464d74dd2027` / runtime `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`
