---
spec_id: AGENT_CORE_LARK_TRANSPORT_PHASE1_V1
status: draft
---

# Agent Core Lark Transport Phase 1 V1

> 性质：**Spec（本轮只冻结 Spec，不实施）** · 日期：2026-08-17
> 仓库：`mayf3/dsh-agent-core` · 分支：`docs/lark-transport-phase1-v1-spec`
> BASE_MAIN = `6b4f50582c4ce5d3e35941d5a838f5ec504ff480`（`main` HEAD of this round）
> 本 Spec 是 `AGENT_CORE_LARK_TRANSPORT_PHASE1_V1_SPEC`（本文件）的冻结文本，
> 只授权「这次允许实现什么」。两个 governing Investigation（见 §2）是 evidence source，
> **不复制其细节**；需细节时引用文件名与章节。
>
> **不修改 Feishu transport。** 本轮是 SPEC ONLY：只新增本 Spec 文件，不修改任何
> Investigation、不修改任何代码、不部署、不 merge 到 `main`。

---

## 0. North Star

Agent Core 已经证明真人链路可用：

```text
Human → Feishu → Agent Core → DSH Agent → model → Feishu reply
```

但当前 Feishu UX 明显弱于成熟 OpenClaw Lark implementation：inbound 无
acknowledgement / reaction、无 typing 反馈、outbound 仅 `msg_type:"text"` 基础格式化。

目标**不是**重新发明 Feishu channel，也**不是**把 OpenClaw Runtime 引回来。目标是：

> 复用成熟 `PURE_LARK` protocol implementation，通过**极薄 Agent Core seam** 提升
> Feishu 基础交互体验。

Phase 1 只冻结三个能力：

1. **bound group configurable no-mention ingress**（Part A）
2. **inbound acknowledgement / typing reaction**（Part B）
3. **improved markdown/text outbound formatting**（Part C）

不把 Phase 1 变成完整 Lark rewrite。

---

## 1. Problem

| 能力 | Agent Core today（main @ BASE_MAIN） | OpenClaw Lark reference |
|---|---|---|
| group no-mention 入口 | `classifyIngress` → `group_not_mentioned` → drop（= requireMention=true 内建） | per-group `requireMention` 可配（gate） |
| inbound acknowledgement | 无（消息发出后静默） | `Typing` emoji reaction 仿真 typing + reaction ack |
| typing 反馈 | 无 | `im.messageReaction.create('Typing')` + 完成后删除 |
| outbound 格式化 | 仅 `msg_type:"text"` 字面 JSON（`api.js textContent`） | `msg_type:"post"`（`[[{tag:'md',text}]]`）+ markdown-style 优化 |

证据位置：`packages/feishu-connector/src/core.js`（`classifyIngress`）、
`packages/feishu-connector/src/api.js`（仅 text）、
`packages/agent-router/src/index.js`（唯一出站 seam `feishu.reply(replyTarget, text)`）。

---

## 2. Governing Evidence（只读引用，不复制）

| Artifact | 结论（冻结引用） |
|---|---|
| `docs/investigations/openclaw-lark-transport-reuse-v1.md`（PASS） | `DIRECT_DEPENDENCY_RECOMMENDED = NO`、`OPENCLAW_RUNTIME_DEPENDENCY_INTRODUCED = NO`；reference = `@larksuite/openclaw-lark@2026.3.12`（本机 `~/.openclaw/extensions/openclaw-lark`，官方 src MIT）；PURE_LARK 模块清单（Part F）；Phase 1 = reaction/typing + markdown post（Part J）；seam 兼容结论（Part I）；切割线 = 不设 `LarkClient.runtime`（Finding 8） |
| `docs/investigations/test-agent-feishu-product-semantics-v1.md`（PASS） | `GROUP_MESSAGE_WITHOUT_MENTION = NO_REPLY`、`GROUP_MESSAGE_WITH_MENTION = REPLY`；`GROUP_REQUIRE_MENTION = YES`，owner = LARK_TRANSPORT_INVESTIGATION（§7）——本 Spec 是 owner 的产出之一 |
| `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`（accepted） | Binding = `{ccId, activeAgentId, activeSessionId, updatedAt}`，Router 是 Binding 唯一 owner，connector 不持有 agent/session 状态（D-002） |
| `docs/decisions/BINDING_AND_SWITCH_V1.md`（accepted） | switch/binding 语义不变 |

本会话现场新增核实（evidence for this round）：

- `~/.openclaw/extensions/openclaw-lark/src/messaging/outbound/typing.js` /
  `reactions.js`：typing 与 reaction **完全基于 Lark SDK `im.messageReaction.create/delete`**，
  仅经 `LarkClient.fromCfg(cfg).sdk` 取 client，无 `openclaw/plugin-sdk` 运行期 import；
  `TYPING_EMOJI_TYPE = 'Typing'`；失败静默吞掉（typing 是 best-effort 提示）。
- `~/.openclaw/extensions/openclaw-lark/src/messaging/outbound/send.js` /
  `deliver.js`：text 出站统一走 `msg_type:"post"` + `zh_cn.content:[[{tag:'md',text}]]`；
  预处理链 = `normalizeAtMentions` → （runtime 表格转换，Agent Core 无此 runtime，Phase 1 不做）
  → `optimizeMarkdownStyle`。
- `~/.openclaw/extensions/openclaw-lark/src/card/markdown-style.js`：`optimizeMarkdownStyle`
  （标题降级、表格间距、代码块保护、空行压缩）纯函数。
- `~/.openclaw/extensions/openclaw-lark/src/messaging/inbound/gate.js:157-170`：
  `requireMention` 优先级 = **per-group > "*" > requireMentionOverride > true**；
  非 mention 群消息被 gate 记录进 chat history 后拒绝 → **证明平台会把 ordinary
  （非 @bot）群消息推给应用**，提及过滤是应用侧决策，不是平台侧缺失。
- `~/.openclaw/extensions/openclaw-lark/src/messaging/inbound/handler.js:77-83`：
  `gate.historyEntry` 只读入口，确认非 mention 消息确实到达应用。
- `~/.openclaw/extensions/openclaw-lark/src/card/reply-dispatcher.js:90-140`：
  typing 生命周期（`start` → `addTypingIndicator`；`stop`/error → `removeTypingIndicator`，
  `typingStopped` 防重启、`typingState.reactionId` 防重复）——编排在 OpenClaw runtime
  `core.channel.reply.createReplyDispatcherWithTyping` 上 → 属 REIMPLEMENT_FROM_REFERENCE。
- Agent Core `packages/feishu-connector/src/{core,api,index}.js`：`classifyIngress`
  （group mention policy 唯一 gate 位）、`api.js` text-only、`onEvent` 流（dedup →
  classify → forward）。
- Agent Core `packages/agent-router/src/{index.js, binding-store.js}`：`onIngress` 先
  `resolveChannelConversation`（first-contact **自动创建** default Binding）再 turn 再
  `feishu.reply(...)`；Binding store row 无 policy 字段；Router 不做 mention 二次检查。
- Agent Core `packages/production-runtime/src/compose.js:133-137`：
  feishu-connector 仅以 `{enabled, credentialsPath}` 挂载（`FEISHU_CREDS_PATH`）。

**平台核实结论（Part A 前置问题「不能在 filter 层自嗨」）**：

```text
ORDINARY_GROUP_MESSAGE_EVENT_DELIVERY = SUPPORTED
  - reference gate 能收到并记录 non-mention 群消息（gate.js historyEntry）→ 平台把
    ordinary group message 推给已订阅 im.message.receive_v1 且在该群内的应用。
  - 当前 Agent Core production app（cli_a9d7abdf05385cd3，openclaw-lark
    investigation Part B）已在真实群收到消息（canary 群 @bot 回复走通）→ 事件订阅
    + WSClient 长连接对群消息生效。
  - 因此 no-mention 过滤纯属应用侧 classify 决策；不存在「平台根本不推普通群消息」。
EVENT_SUBSCRIPTION_REQUIREMENT =
  im.message.receive_v1 已订阅（现网已生效）；
  应用需具备群消息相关权限/订阅（im:message 及群消息接收），经真实生产 app 现网验证。
  Implementation 阶段对任一 bound group 开启 no-mention 前，必须在真实租户确认
  该 group 内应用可见（已进群）且事件可达（验收 AC1 实测覆盖）。
```

---

## 3. Frozen Boundaries（贯穿全文）

```text
DIRECT_OPENCLAW_DEPENDENCY  = NO
OPENCLAW_RUNTIME_DEPENDENCY = NONE
ROUTER_CHANGE               = NONE     （onIngress / feishu.reply(replyTarget,text) seam 签名不变）
RUNTIME_CHANGE              = NONE
KERNEL_CHANGE               = NONE
BINDING_STORE_CHANGE        = NONE     （D-002 Binding shape 不变；policy 不进 Binding row）
SCHEDULER_CHANGE            = NONE
DELIVERY_CHANGE             = NONE     （scheduler-router 仍只调 feishu.reply(ReplyTarget,text)）
LARK_CLIENT_RUNTIME         = 不设     （切割线：绝不注入 OpenClaw channel runtime）
FULL_PACKAGE_DEPENDENCY     = 禁止     （不允许依赖整个 @larksuite/openclaw-lark）
```

LarkAdaper seam（Investigation Part I 的候选边界）**不是 Phase-1 新建 artifact**：
Phase 1 在 `feishu-connector` 内部就地增强既有 seam，不新增服务、不新增回调参数。

---

## 4. Part A — Group Mention Policy（bound group configurable no-mention ingress）

### 4.1 产品 policy（不是全局开关）

**禁止**简单全局 `requireMention=false`。冻结为**显式 per-group 声明**：

```text
进入条件（AND）：
  (1) 该 group 是「bound group」= 在 feishu-connector 配置中显式声明了该 group 的
      per-group 条目（chatId 精确匹配，大小写不敏感；"*" 作为默认组条目）；
      即「策略层面的显式绑定」——管理员刻意把该群登记为 no-mention 可交互群；
  (2) 该 group（或其默认 "*" 条目）的 requireMention = false；
  (3) 事件本身通过既有 dedup + 非 self-echo 检查。

反例（必须避免）：bot 加进任何群 → 自动吃掉所有消息。默认 requireMention=true，
只有显式声明过的 group 才可能放行 no-mention。
```

> 「explicit Binding」的 Phase-1 语义 = feishu-connector config 中的**显式 per-group
> 声明**（BOUND_GROUP），因为 Router Binding row 是 first-contact 自动创建的
> （`resolveChannelConversation`），connector 无权查询 Binding，且任何 connector→Router
> 状态查询都会改变 seam（禁止）。「Router Binding 必须预先存在」的严格 gate
> 需要 seam 变更 → 记为 Phase 2+ 候选（§12），不进入 Phase 1。

### 4.2 冻结参数

```text
REQUIRE_MENTION_DEFAULT = true        （= 现状 classifyIngress 语义，默认安全）
NO_MENTION_POLICY_AUTHORITY = feishu-connector Config（单一 channel config schema）
POLICY_SCOPE = per-group（chatId 键控），带 "*" 默认条目 + 全局 fallback
解析优先级（与 reference gate.js:158 对齐）：
  groups.<chatId>.requireMention > groups["*"].requireMention > requireMention（全局）> true
```

Config 形状（extension of existing `Config`，全部可选，向后兼容）：

```text
{
  requireMention?: boolean,                       // 全局 fallback，默认 true
  groups?: {
    "<chatId|*>": {
      requireMention?: boolean,                   // per-group 覆盖，默认继承上级
      enabled?: boolean,                          // false = 该群完全忽略（与 reference gate 一致）
    }
  }
}
```

### 4.3 classifyIngress 扩展（纯函数，现有 signature 不变）

```text
p2p                                    -> forward（不变）
group + mentioned                      -> forward 'group_mentioned'（不变）
group + not mentioned + NOT bound      -> drop 'group_not_mentioned'（不变，默认行为）
group + not mentioned + bound & no-mention -> forward 'group_no_mention_allowed'（新增）
thread 规则不变
```

- 判定发生在 dedup **之后**，与现状顺序一致（dedup → classify → forward）。
- 不改变 `onEvent` / `feishu.reply` 签名；Router 无需知道 policy。

### 4.4 平台核实（冻结）

见 §2 `ORDINARY_GROUP_MESSAGE_EVENT_DELIVERY = SUPPORTED`。Implementation 对每个
bound group 实测开启（AC1 覆盖），不在 filter 层盲改。

---

## 5. Part B — Inbound Acknowledgement / Typing Reaction

### 5.1 语义冻结

```text
REACTION_SEMANTICS =
  - typing 指示 = 对「被接受的入站消息」加 emoji reaction 'Typing'
    （im.messageReaction.create {reaction_type:{emoji_type:'Typing'}}）—— 事件认可 +
    处理中可视承诺（Feishu 无专有 typing API，reference 同款仿真）。
  - ack reaction = 可选：最终回复成功送达后，对用户消息加显式 ack
    （默认关闭；配置 ackEmoji: 'THUMBSUP' | 'OK' | false 时开启）。
  - 两者都 best-effort：任何失败静默记录，绝不阻塞消息处理（port typing.js/reactions.js 语义）。

TYPING_LIFECYCLE =
  BEGIN  : dedup accepted + classify forward 之后、cfg.onEvent(ingress) 之前，
          在 connector 内对此 messageId 加 'Typing' reaction（每次入站只加一次，
          typingState 按 messageId 键控，重复触发不重复加）。
  END    : connector.reply() 内，最终回复发送成功或失败后立即 remove 该 reaction
           （best-effort；先发回复再删 typing，用户看到「答案出现 ↔ reaction 消失」）。
  ERROR  : onEvent 回调抛错 → 立即 remove；reply 发送失败 → remove + 可选失败 ack。
  TIMEOUT: per-message 存活 watchdog（配置 typingMaxMs，默认 ≥10min）超时强制 remove
           （防「agent 永不回」留下永久 reaction 噪音）。
  DISCONNECT/STOP: connector stop / WS 断开时清理全部 active typing state（best-effort）。

DUPLICATE_EVENT = dedup 发生在 typing BEGIN 之前 → 重复事件永不重复加 reaction
                 （AC5）；进程内 typingState map 再兜底。
```

- **UX state 全部住在 `feishu-connector` 内部**（一个 connector-owned
  `TypingState` map：messageId → {reactionId, addedAt, timer}），**不进 Router**。
- `reply()` 无新参数（seam 不变）：connector 依赖 fallback key
  `replyTarget.replyMsgId` 反查 typingState。
- scheduler announce（`scheduler-router.createFeishuDeliver`）走同一 `reply()`：
  无对应 typingState 时 remove 为 no-op，天然兼容。

### 5.2 参考实现接线（证据）

- reference `reply-dispatcher.js:90-140` 的 `createTypingCallbacks`（OpenClaw runtime）
  是**编排**，Phase 1 **REIMPLEMENT** 为 §5.1 生命周期（量约一个 connector 内部小模块）。
- reference `typing.js` / `reactions.js` 的原语可 **PORT**（替换
  `LarkClient.fromCfg(cfg).sdk` 为 connector 现持 `LarkClient` client 实例）。
- 可选硬编码 fallback：若 'Typing' emoji 在目标租户不可用，回退 ack 策略
  （config `typingEmoji`, 默认 'Typing'）。

---

## 6. Part C — Improved Markdown/Text Outbound Formatting

### 6.1 语义冻结

```text
MARKDOWN_SEMANTICS =
  - 默认出站：所有文本 reply → msg_type:"post"，
    content = {"zh_cn":{"content":[[{"tag":"md","text":<processed>}]]}}（reference 同款信封）。
  - 预处理链（runtime-free，Agent Core 无 OpenClaw channel runtime）：
      1) normalizeAtMentions：<at id=all/open_id=..> 等常见 AI 错误写法归一为
         <at user_id="..">（port deliver.js 的 normalizeAtMentions）；
      2) optimizeMarkdownStyle(text, cardVersion=1)：标题降级、代码块保护、表格间距、
         空行压缩（port markdown-style.js）；
      3) 装 post 信封。
  - 降级开关：config outboundMode: 'post' | 'text'，默认 'post'；'text' 回到现状
    msg_type:"text"（逃生舱，不破坏现有消费方）。
  - 不进入 streaming card / interactive card；不做 chunking（Phase 2+）。
  - 长文本 / 表格转换（reference 的 runtime.channel.text.convertMarkdownTables）=
    OpenClaw runtime 能力 → Phase 1 不做，Phase 2 以 REIMPLEMENT 的最小 bullets
    转换评估（表格在 Feishu post md 渲染降级为原样文本，可接受）。
```

- 落点：`api.js`（`reply()` 内部按 msg_type 分支）+ 一个 connector 内
  `formatOutboundText` 纯函数（可单测）。
- scheduler announce 与 router reply 共用同一 `feishu.reply` → 自动获得格式化。

---

## 7. Thin Boundary（LarkAdapter 边界，Phase-1 角色）

Phase 1 **不新建 adapter 类/服务**；增强全部落在既有 seam 内部。边界知识清单冻结如下：

```text
LarkAdapter 可以知道：
  chatId / messageId / rootId / threadId / sender（openId 等）/ content /
  attachment 元数据 / reaction / formatting（post/text/emoji）
LarkAdapter 不能知道（Phase 1 也不触碰）：
  DSH internals / Router lifecycle / Agent process lifecycle / Workflow /
  Scheduler / Kernel / OpenClaw Session / Binding workspace semantics / Broker
```

---

## 8. Module Classification（PORT / VENDOR / REIMPLEMENT）与 License

### 8.1 冻结分类

reference = `@larksuite/openclaw-lark@2026.3.12`（本机 `~/.openclaw/extensions/openclaw-lark`，
官方 src 基线，本地定制脚本不在官方 MIT 覆盖内）。

```text
PORT_MODULES（vendor 进 feishu-connector，改掉 OpenClaw 胶水，保留 MIT header）：
  - messaging/outbound/typing.js        （addTypingIndicator / removeTypingIndicator；
                                         替换 LarkClient.fromCfg 为 connector 现有 client）
  - messaging/outbound/reactions.js     （addReactionFeishu / removeReactionFeishu /
                                         listReactionsFeishu —— ack reaction 用）
  - messaging/outbound/send.js + deliver.js 中纯 Lark 部分（buildPostContent /
                                          normalizeAtMentions / post 信封 —— 剔除 runtime
                                          convertMarkdownTables 分支）
  - card/markdown-style.js              （optimizeMarkdownStyle / stripInvalidImageKeys）
  - core/message-unavailable.js         （isMessageUnavailableError /
                                         runWithMessageUnavailableGuard —— typing/reactions
                                         依赖的守卫，PURE）
  - core/targets.js 的 normalizeMessageId（当前无合成 id，port 仅当需要时；可后置）

REIMPLEMENT_MODULES（思路照抄 reference，代码按 Agent Core seam 重写，runtime-free）：
  - typing 生命周期编排（§5.1，替代 createTypingCallbacks / reply-dispatcher typing 部分）
  - group requireMention 解析（§4.2 优先级，替代 core.channel.groups.resolveRequireMention）
  - classifyIngress 扩展（§4.3，新增 group_no_mention_allowed 分支）
  - 出站预处理链顺序（normalizeAtMentions → optimizeMarkdownStyle → post 信封）

REUSE_MODULES（Agent Core 已等价实现或零改动直接引用，无需新代码）：
  - messaging/inbound/dedup.js —— Agent Core 已有 LruDedup（等价，不改）
  - core/version.js / core/api-error.js —— 可选（UA / formatLarkError，PURE；Phase 1 不强制）

DO_NOT_REUSE（明确禁止）：
  openclaw/plugin-sdk 依赖面、channel/plugin.js、accounts.js / config-adapter.js、
  outbound.js（OpenClaw outbound adapter）、工具家族 tools/**、
  reply-dispatcher.js 整文件（OpenClaw runtime 编排）、dispatch*.js / handler.js 喂
  agent/session 的部分、card streaming 编排。
```

### 8.2 License / Attribution（MIT，来自 Investigation Part H + 源码头实测）

```text
LICENSE        = MIT License
COPYRIGHT      = Copyright (c) 2026 Lark Technologies Pte. Ltd.
SOURCE HEADER  = Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
                 SPDX-License-Identifier: MIT
UPSTREAM       = @larksuite/openclaw-lark@2026.3.12
                 （本机 clone 基线 = 官方 src；提前记本地定制脚本不属于官方 MIT 范围）
强制要求（对每个 ported 文件）：
  1) 保留原 MIT copyright notice 到文件头；
  2) 保留 LICENSE 全文（仓库 LICENSE 或移植模块目录 NOTICE）；
  3) 记录 attribution：来源 + upstream version + 本仓库移植时间，
     便于未来同步 upstream fixes（维护「reference 基线 + 变更记录」控制 drift）。
```

---

## 9. Config Model Change（变更面）

```text
feishu-connector Config（index.js z.object）新增可选字段，全部向后兼容：
  requireMention?: boolean      （默认 true，Part A 全局 fallback）
  groups?: Record<string, { requireMention?: boolean; enabled?: boolean }>
  ackEmoji?: string | false     （默认 false，Part B 完成 ack；'THUMBSUP'/'OK'/…）
  typingEmoji?: string          （默认 'Typing'）
  typingMaxMs?: number          （默认 ≥10min，Part B watchdog）
  outboundMode?: 'post' | 'text'（默认 'post'，Part C）

Router / Binding store / production-runtime compose 不变：
  compose 仅多传可选键透传；不改挂载协议（仍 { enabled, credentialsPath } 起步）。
```

---

## 10. Acceptance Criteria

```text
AC1  explicitly bound test group（per-group requireMention=false 声明）+ no-mention
     普通群消息 → Agent 被触发并回复（ORDINARY_GROUP_MESSAGE_EVENT_DELIVERY 实测成立）。
AC2  require mention 的 group（默认或显式 true）→ 非 mention 消息仍被忽略
     （classify reason = group_not_mentioned）。
AC3  accepted inbound → 最终答案出现前有可见 reaction/typing 反馈
     （'Typing' reaction 在 processing 期间存在）。
AC4  processing 成功 → typing reaction 被移除；processing 失败 / timeout / 断连 →
     typing state 被清理（watchdog + error path 覆盖）。
AC5  重复 inbound event（同 event_id/message_id 重投）→ 不重复加 reaction、不重复回复
     （dedup 先行）。
AC6  markdown 答案 → Feishu 内可见可读格式化（标题/列表/代码块可读；post md 渲染）。
AC7  OpenClaw runtime dependency = NONE（全引用面 0 个 openclaw/plugin-sdk import、
     无 LarkClient.runtime 注入）。
AC8  Router / Runtime / Kernel semantics 不变（seam 签名、Binding store、onIngress
     行为 diff 为空或仅日志）。
```

---

## 11. Explicit Non-Goals（Phase 1 不做）

```text
interactive cards / streaming cards / images-media migration / file upload UX expansion /
thread redesign / full dedupe redesign / retry framework / rate-limit framework /
OpenClaw plugin SDK / OpenClaw Gateway / OpenClaw Session / OpenClaw dispatcher /
Broker / Auth / Binding workspace（per-binding workspace 属 TEST_AGENT... investigation
的独立决策栈，不在本 Spec）/ Router / Runtime / Kernel 改动 /
表格 → Feishu bullets 转换（Phase 2 候选）/ 长消息 chunking（Phase 2+）/
strict「Router Binding 必须预先存在」gate（需 seam 变更，Phase 2+ 候选）。
```

---

## 12. Deferred / Open Questions（记而不决）

1. 严格 binding-existence gate 是否值得引入 connector→Router 只读查询（改变 seam）？
2. 'Typing' reaction 在群聊的噪音边界：per-group typing 开关（groups.<id>.typing=false）
   是否随 Phase 1 提供，还是等真实使用反馈？
3. 表格转换最小实现（bullets）是否值得 Phase 2 做（vs Feishu post md 渲染降级可接受）？
4. 是否推动 upstream 把纯 Lark transport 抽为独立 package（长期，Investigation Option 2）。

---

## 13. Status

```text
AGENT_CORE_LARK_TRANSPORT_PHASE1_V1_SPEC = PASS

BASE_MAIN = 6b4f50582c4ce5d3e35941d5a838f5ec504ff480
GOVERNING_INVESTIGATIONS =
  docs/investigations/openclaw-lark-transport-reuse-v1.md（PASS）
  docs/investigations/test-agent-feishu-product-semantics-v1.md（PASS）

PHASE1_SCOPE =
  1) bound group configurable no-mention ingress
  2) inbound acknowledgement / typing reaction
  3) improved markdown/text outbound formatting

REQUIRE_MENTION_DEFAULT = true
NO_MENTION_POLICY_AUTHORITY = feishu-connector Config（requireMention + groups map）
ORDINARY_GROUP_MESSAGE_PERMISSION = SUPPORTED（平台推送 ordinary group message；
  app 侧过滤；bound group 实测验证）

REACTION_SEMANTICS = 'Typing' emoji reaction（inbound accepted，处理中可见，可配
  typingEmoji）；可选 ack reaction（ackEmoji，默认关闭）；best-effort 静默失败
TYPING_SEMANTICS = BEGIN 于 dedup+classify 通过后；END 于 reply() 发送完成/失败后
  remove；error/timeout/disconnect 均有 cleanup（watchdog typingMaxMs）；
  duplicate event 不重复 reaction（dedup 先行 + per-messageId state）
MARKDOWN_SEMANTICS = 默认 msg_type:'post' md 信封；
  normalizeAtMentions → optimizeMarkdownStyle（cardVersion=1）→ post envelope；
  outboundMode 可降级 text；无 streaming/card/chunking/表格转换

REUSE_MODULES = dedup（Agent Core LruDedup 已等价）；可选 version/api-error
PORT_MODULES = typing.js、reactions.js、send/deliver 纯 Lark 部分（post 信封 +
  normalizeAtMentions）、markdown-style.js、message-unavailable.js、（targets
  normalizeMessageId 按需）
REIMPLEMENT_MODULES = typing 生命周期编排、requireMention 解析优先级、classifyIngress
  扩展（group_no_mention_allowed）、出站预处理链顺序

DIRECT_OPENCLAW_DEPENDENCY = NO
OPENCLAW_RUNTIME_DEPENDENCY = NONE

LARK_ADAPTER_BOUNDARY = Phase 1 不新建 adapter；增强全部在 feishu-connector 既有 seam
  （onEvent / feishu.reply(replyTarget,text)）内部；边界知识清单见 §7。
  router 调用签名不变。

ROUTER_CHANGE = NONE
RUNTIME_CHANGE = NONE
KERNEL_CHANGE = NONE
BINDING_STORE_CHANGE = NONE

IMPLEMENTATION_SCOPE = packages/feishu-connector 内：Config 扩展、classifyIngress policy、
  typing/reaction 生命周期（connector-owned state）、api.js post(md) 格式化、
  port 模块 + MIT notice、单元测试
OUT_OF_SCOPE = §11 Explicit Non-Goals 全列表（card/streaming/media/thread/dedupe 重设计/
  retry/rate-limit/OpenClaw 全家/Router/Runtime/Kernel/Binding workspace 等）

SPEC_STATUS = DRAFT（冻结 proposal；待独立 spec review 通过后 accepted 才具实现许可）
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```

---

## 14. Related

- `docs/investigations/openclaw-lark-transport-reuse-v1.md`
- `docs/investigations/test-agent-feishu-product-semantics-v1.md`
- `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`、`BINDING_AND_SWITCH_V1.md`
- `packages/feishu-connector/src/{core,api,index}.js`
- `packages/agent-router/src/{index,binding-store}.js`
- `packages/production-runtime/src/compose.js`
- `~/.openclaw/extensions/openclaw-lark/`（reference：`@larksuite/openclaw-lark@2026.3.12`）