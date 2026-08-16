# OPENCLAW_LARK_TRANSPORT_REUSE_INVESTIGATION_V1 — 实证调查

> INVESTIGATION ONLY · 只调查、比较、记录 evidence。**不修改 Agent Core 飞书实现、
> 不移植代码、不创建新 Adapter、不引入 openclaw dependency、不改 Router/Runtime/Delivery。**
>
> - 日期: 2026-08-16 · 分支: `main`（BASE = 当前 main HEAD `578de73`）
> - 调查面: 本机真实 OpenClaw 环境实际装载的 Feishu 插件源码 + 当前 Agent Core
>   `feishu-connector` 源码，逐文件、逐 import 实证。
> - 本文件是 Investigation（evidence authority），**不授予实现权限**。若后续建议迁移，
>   必须新建 governing Spec（见 `NEED_GOVERNING_SPEC`）。

## Status

```
OPENCLAW_LARK_TRANSPORT_REUSE_INVESTIGATION_V1 = PASS
CODE_CHANGE = NONE
ROUTER_CHANGE = NONE
RUNTIME_CHANGE = NONE
KERNEL_CHANGE = NONE
```

Investigation 结论成立（`PASS`），证据充分、可复核。任何后续实现都需新 governing Spec。

---

## Problem

Agent Core 已具备真实链路：

```
human Feishu → Agent Core(feishu-connector) → Router → DSH Agent → real model → Feishu reply
```

但真实体验显著弱于 OpenClaw 成熟飞书插件：inbound 无 acknowledgement / reaction、无
typing 反馈、message/card UX 基础、streaming/formatting/threading 成熟度存疑。

本调查回答的不是「能不能把 OpenClaw 插件整个塞进 Agent Core」，而是：

> **能否复用其成熟的 Lark protocol / transport 能力，同时完全不继承 OpenClaw
> Runtime / Session / Dispatcher semantics？**

即判断每个能力对 OpenClaw 的真实耦合度，把「protocol implementation」与
「OpenClaw integration glue」严格分开，给出可单独提取/移植的纯 Lark 模块清单。

冻结架构约束（贯穿全文）：

```
AGENT_RUNTIME_OPENCLAW_DEPENDENCY = NONE
禁止引入: OpenClaw Gateway / Agent Runtime / Session model / Dispatcher /
         tool lifecycle / config authority / memory semantics / Scheduler
```

---

## Evidence

### Part A — 当前 Agent Core Feishu stack 审计（`packages/feishu-connector`）

**源码位置与模块分工（逐文件走读）**：

| 模块 | 职责 | 实现 |
|---|---|---|
| `src/transport.js` `createFeishuTransport` | 建立 WS、状态机、reconnect 计数、事件回传 | 薄封装，**reconnect+heartbeat 全部委托给 Lark SDK `WSClient`** |
| `src/index.js` `apply` | Cordis 插件壳：建 `LarkClient`/`WSClient`/`EventDispatcher`、令牌、bot 身份解析、dedup/classify、启动连接 | `EventDispatcher.register({'im.message.receive_v1':…})` |
| `src/core.js` | 纯 channel 逻辑（零 DSH/零网络）：`normalizeIngressEvent`、`parseSender/Mentions/Attachments/Content`、`resolveConversation`、`buildReplyTarget`、`LruDedup`、`dedupEvent`、`classifyIngress` | 纯函数，可单测 |
| `src/api.js` | 出站：`reply()` 映射 `ReplyTarget`→`im.message.reply/create` | **仅 `msg_type:"text"`，无 markdown/post/card/media** |
| `standalone.mjs` | 无 DSH 真实跑一次手动验证 | 读 `~/.openclaw/openclaw.json` channels.feishu |

**当前链路（谁做什么）**：

```
Base — 当前 main HEAD `578de73`：packages/feishu-connector + agent-router + scheduler-router
接口 — @larksuiteoapi/node-sdk ^1.73.0（WSClient / Client / EventDispatcher）

谁建立 WS        → feishu-connector index.js:117-122  new WSClient(...).start({eventDispatcher})
                     reconnect/heartbeat 委托给 SDK 长连接（transport.js 注释明言）
谁解析 inbound   → core.normalizeIngressEvent(raw,{botOpenId})  解析 enumerate {header,event}
谁做 event dedupe→ core.LruDedup.check/record + dedupEvent  (index.js 先 dedup 再 classify)
谁转换 NotificationIngress → 当前无独立 NotificationIngress 转发；feishu 直接经 onEvent → Router onIngress
谁负责 outbound  → feishu.reply(replyTarget,text) → api.js reply() → im.message.reply/create
谁格式化消息     → api.textContent(text)：字面 JSON {"text":...}，msg_type:"text"
谁处理 reaction/card/media → NONE（api.js 头注释：Media send is out of scope；全仓无 messageReaction/typing/card）
```

关键证据（gap 实证）：`grep messageReaction|reaction|typing|card` 在 `packages/feishu-connector`
与 `packages/agent-router` **0 命中**；`api.js` 仅 `msg_type:"text"`。

**CURRENT 状态打标**：

| 能力 | 状态 |
|---|---|
| inbound WebSocket 长连接 | IMPLEMENTED（SDK WSClient，reconnect 委托 SDK） |
| inbound 事件解析 normalize | IMPLEMENTED（core.parse/normalize） |
| event dedupe | IMPLEMENTED（LruDedup） |
| @mention 解析 / group 路由 classify | PARTIAL（mention 解析有；group 仅 @bot / p2p/thread 判定） |
| outbound text reply | IMPLEMENTED（replyTarget.replyTo→im.message.reply） |
| thread/reply（root_id/reply_in_thread） | PARTIAL（ReplyTarget 有 thread/root 字段，属数据层；无独立 thread 生成本体） |
| markdown / post 富文本 | MISSING（仅 msg_type:"text"） |
| reaction / acknowledgement | MISSING |
| typing 反馈 | MISSING |
| interactive card | MISSING |
| streaming card | MISSING |
| image/file/media 发送 | MISSING（仅 inbound 附 metadata 解析） |
| retry / rate limit | PARTIAL（SDK 层；无应用层重试/退避显式编排） |
| reconnect | PARTIAL（SDK 内建；仅计数上报，无应用层 healed/exhausted 策略） |
| long message chunking | MISSING |

---

### Part B — 实际成熟参考实现定位

**本机真实 OpenClaw 环境实际装载的 Feishu 插件**：

```
实际参考 = ~/.openclaw/extensions/openclaw-lark/
         = package `@larksuite/openclaw-lark` version 2026.3.12
         = 官方 Lark/Feishu 团队维护的 OpenClaw 渠道插件（README: "official Lark/Feishu plugin for OpenClaw"）
```

现场核实（非凭名字猜）：

- `openclaw.plugin.json` → `"id": "openclaw-lark", "channels": ["feishu"]`。
- `package.json` → `"name": "@larksuite/openclaw-lark", "version": "2026.3.12"`；
  依赖 `@larksuiteoapi/node-sdk:^1.59.0`、zod、typebox、image-size。
- `~/.openclaw/openclaw.json` → `channels.feishu.enabled=true, connectionMode:"websocket",
  streaming:true`；生产 app `cli_a9d7abdf05385cd3`（与 canary 报告一致的 production app）。
- 该 directory 本体是一个 git checkout（remote `mayf3/agent-kanban`，HEAD `245795ce`），
  含大量自定义 doc/task 脚本 —— 即**本地定制的工作副本**（base 是官方 `src/` 传输实现）
  = 官方 `@larksuite/openclaw-lark@2026.3.12` + 本地定制。

```
ACTUAL_REFERENCE_IMPLEMENTATION =
  openclaw-lark  = 实际使用的插件 = @larksuite/openclaw-lark@2026.3.12（官方 Lark 出品）
  lark-openclaw  = 不同的名字：本机未安装 / 未使用；真实运行的是 `openclaw-lark`
```

> 即「lark-openclaw / openclaw-lark 谁是谁」：**`openclaw-lark`** 是官方渠道插件，
> npm 包名 `@larksuite/openclaw-lark`。`lark-openclaw` 指代同一产品名族下的另一套命名，
> **本机实际装载的是 `openclaw-lark`**。

---

### Part C — reference 插件源码依赖分级

方法：对每能力定位实现模块 → 列 exact `import` / SDK call → 判定
`PURE_LARK / LIGHTLY_COUPLED / OPENCLAW_COUPLED`。

关键总览证据：全插件 119 个文件 import `openclaw/plugin-sdk`；其中
`src/messaging` 有 33 个文件引用，但**运行期 `.js` 仅 7 个**（另 26 个是 `.d.ts` 类型引用），
即许多传输原语对 OpenClaw 只有 type 依赖，运行期无耦合。

`openclaw/plugin-sdk` 在插件 `node_modules` 与 `~/.openclaw` 下**均不存在** → 它由
OpenClaw 运行期注入（非下载 dependency）。因此 **凡运行期 import `openclaw/plugin-sdk`
的模块都无法脱离 OpenClaw 运行**——这是硬性切割边界。

**依赖根（dependency root）**：所有能力最终流向 `core/lark-client.js` 的 `LarkClient.runtime`
static（`index.js` 一次 `LarkClient.setRuntime(api.runtime)` 注入）；出站编排里的
`core = LarkClient.runtime.channel.*` 就是该运行期。→ 切割点是「不设这个 runtime」。

| 能力 | 模块（exact path） | import / SDK call 证据 | 分级 |
|---|---|---|---|
| WebSocket 连接 | `core/lark-client.js` `connect()` | `new Lark.WSClient(...)`、`Lark.defaultHttpInstance` 注入 UA；本身无 `openclaw/plugin-sdk` import，但 class 有 static `runtime`（`api.runtime` 注入） | LIGHTLY_COUPLED |
| credential/token 管理 | `core/token-store.js` | **仅 node stdlib**（child_process,fs,crypto,path,homedir）+ 自带 `lark-logger`；**0 个 openclaw import** | PURE_LARK |
| 事件解析 inbound | `messaging/inbound/parse.js` | convertMessageContent（自带 converters）+ getUserNameCache/getLarkAccount/LarkClient；运行期无 openclaw import（.d.ts type only） | LIGHTLY_COUPLED |
| 事件 dedupe | `messaging/inbound/dedup.js` | **0 import**（纯模块） | PURE_LARK |
| mention 解析 | `messaging/inbound/mention.js` | 仅 import `escapeRegExp`（自带 converters/utils） | PURE_LARK |
| reaction（出） | `messaging/outbound/reactions.js` | 仅 import `LarkClient`；`client.im.messageReaction.create/delete/list` | LIGHTLY_COUPLED |
| typing（出） | `messaging/outbound/typing.js` | 仅 `LarkClient` + `im.messageReaction.create/delete`（emoji `Typing`） | LIGHTLY_COUPLED |
| text/markdown 出站 | `messaging/outbound/deliver.js` `sendTextLark` / `send.js` | `client.im.message.reply/create`，`msg_type:"post"`（`[[{tag:'md'}]`）+ `optimizeMarkdownStyle`；唯一 openclaw 引用是 try/catch 内可降级的 `LarkClient.runtime?.channel?.text?.convertMarkdownTables` | LIGHTLY_COUPLED |
| reply/thread 目标 | `core/targets.js` | `normalizeMessageId/normalizeFeishuTarget` 纯函数 + `im.message.reply` `reply_in_thread` | LIGHTLY_COUPLED |
| interactive card build | `card/builder.js`, `card/cardkit.js` | `createCardEntity/sendCardByCardId/updateCardKitCard`；cardkit **0 openclaw import（纯）** | PURE_LARK（builder）/ LIGHTLY（上层） |
| streaming card 编排 | `card/streaming-card-controller.js` | import `SILENT_REPLY_TOKEN` from `openclaw/plugin-sdk`；核心可分离（cardkit/flush-controller/unavailable-guard 均纯） | LIGHTLY_COUPLED |
| image/file/media | `messaging/outbound/media.js` | node stdlib + `LarkClient` + 自带 media-url-utils；`im/v1/images|files` 上传 | LIGHTLY_COUPLED |
| retry / error / rate limit | `core/api-error.js`, `core/message-unavailable.js` | `formatLarkError`/gaps；api-error 仅引入自带 permission-url/auth-errors | PURE_LARK |
| reconnect | SDK 长连接 + `core/lark-client.js` | WSClient 内建 | LIGHTLY_COUPLED |
| inbound dispatch / session 语义 | `messaging/inbound/dispatch*.js`, `handler.js`, `channel/plugin.js` | import `clearHistoryEntriesIfEnabled`、`SILENT_REPLY_TOKEN`、`DEFAULT_GROUP_HISTORY_LIMIT` from `openclaw/plugin-sdk`；实现 `api.registerChannel`、`api.runtime` | OPENCLAW_COUPLED |
| **reply 编排层**（text/card/streaming 决策 + chunking + typing 回调） | `card/reply-dispatcher.js` | import `createReplyPrefixContext`/`createTypingCallbacks`/`logTypingFailure` from `openclaw/plugin-sdk`；调 `core.channel.reply.createReplyDispatcherWithTyping`、`core.channel.text.resolveTextChunkLimit`/`chunkTextWithMode`/`convertMarkdownTables`/`resolveMarkdownTableMode` —— **OpenClaw 运行期 `core.channel.*` 服务** | OPENCLAW_COUPLED |

> **reply-dispatcher.js 是重要反例**：它把「该用 text / card / streaming、怎么分块、
> typing 回调、human-delay」的**编排智能**全设在 OpenClaw `core.channel.*` 上。因此
> 纯原语（typing.js/send.js/cardkit）可 port，但**编排智能只能 REIMPLEMENT**。

**另外两处 dead-code 异常**（若未来 vendor 需注意）：`core/sdk-compat.js` 与
`card/tool-use-config.js` 是 ES module 包内以 CJS `require` 写成、且无任何文件 import，
一旦被加载会抛错——vendor 时应跳过。

> 详见 Part D 的 coupling audit 与 Part F 的最终归类。

---

### Part D — OpenClaw Coupling Audit

对 reference 内所有 OpenClaw 依赖面逐项回答：是 Lark protocol 必需，还是仅因「它是
OpenClaw 插件」而必需。

| OpenClaw 依赖面 | reference 中位置 | 是 protocol 必需？ | 判定 |
|---|---|---|---|
| `openclaw/plugin-sdk`（运行期注入模块） | `index.js`, `channel/plugin.js` 等（119 文件引用，运行期 .js 约 10 个） | **否** —— 只是 OpenClaw 插件装载/分发协议 | 集成 glue（不含进 Lark core） |
| `api.registerChannel` / `api.runtime` | `plugin.js`, `lark-client.js` static runtime | **否** —— channel 注册是 OpenClaw 托管协议 | 集成 glue |
| `api.on('before_tool_call')` 等 hooks | `index.js` | **否** —— tool 生命周期 | OpenClaw tool lifecycle |
| Capabilities / Pairing / AgentPrompt / Groups / Reload（ChannelPlugin 接口） | `channel/plugin.js` | **否** —— OpenClaw Channel 抽象 | OpenClaw session/identity/permissions |
| Config authority（`channels.feishu` + accounts） | `core/accounts.js`, `channel/config-adapter.js` | **部分** —— 需要 appId/secret，但 OpenClaw 的 account/config 权威结构不是 protocol 必需 | 轻耦合（可换 Agent Core 权威） |
| 入站事件 → session/dispatcher 分发 | `messaging/inbound/*dispatch*`, `handler.js`, `comment-handler.js` | **否** —— 这是把消息喂给 OpenClaw agent/session 的 glue | OpenClaw session/dispatcher |
| tool 注册（doc/wiki/bitable/calendar/task OAPI） | `tools/oapi/**`, `tools/mcp/**` | **否** —— 这些是 OpenClaw tool 家族，非 Lark 传输 | OpenClaw tool lifecycle |
| reaction-handler → dispatchToAgent | `messaging/inbound/reaction-handler.js` | **否** —— 喂给 agent 的 glue | OpenClaw session |
| 出站 adapter（`sendMessage`/`updateMessage`/source/…） | `messaging/outbound/outbound.js`（OpenClaw outbound 对象） | **否** —— OpenClaw 要求 channel 实现 outbound 接口 | 集成 glue（可替换为 Agent Core Delivery） |

**核心区分结论**：

```
protocol implementation  =  WS/token/parse/dedup/mention/reaction/typing/
                            send/deliver/media/card/flush/error  —— 几乎不依赖 OpenClaw
OpenClaw integration glue =  channel plugin 接口 + account/config 权威 +
                            inbound dispatch → session + outbound adapter 对象
                            + tool 家族 + hooks
```

二层可干净切开。`token-store`、`dedup`、`mention`、`api-error`、`cardkit` 等模块
**零运行期 OpenClaw 依赖**，可直接移植。

---

### Part E — Feature Gap Matrix

| 能力 | Agent Core today | OpenClaw Lark | Value | Reuse difficulty | OpenClaw coupling |
|---|---|---|---|---|---|
| inbound WS 长连接 | ✅ SDK WSClient | ✅ 同 SDK + 装饰 | — | 低 | none |
| reconnect | 部分（委托 SDK，仅计数） | SDK + 状态机 | 中 | 低 | none |
| dedupe | ✅ LruDedup | ✅ pure dedup.js | — | 低 | none |
| acknowledgement reaction | ❌ 无 | ✅ reactions.js | 高 | 低 | light（LarkClient 包装） |
| typing 反馈 | ❌ 无 | ✅ typing.js（见下） | 高 | 低 | light |
| message reply | ✅ text | ✅ send/deliver（支持 card/post） | 高 | 低 | light |
| thread 语义 | 部分（ReplyTarget 字段） | ✅ thread/reply 完备 | 中高 | 低 | light |
| markdown | ❌ text-only | ✅ post `tag:'md'` + markdown-style | 高 | 低 | light |
| cards | ❌ | ✅ builder/cardkit v1+v2 | 中高（须 UX） | 中（cardkit 纯） | none（cardkit）/light（上层） |
| streaming | ❌ | ✅ streaming-card-controller + flush | 中高 | 中 | light（SILENT_REPLY_TOKEN） |
| images | ❌ send、仅 inbound meta | ✅ media.js | 高 | 中 | light |
| files | ❌ | ✅ media.js | 中 | 中 | light |
| @mention | 部分 parse+classify | ✅ mention + 格式 | 中 | 低 | none |
| group/private 路由 | 部分 | ✅ gate/policy 完备 | 中 | 中 | light |
| errors/retry/rate | 部分（SDK） | ✅ api-error/message-unavailable | 中 | 中 | none/light |
| long message chunking | ❌ | ✅（split 能力内建于 send/deliver） | 中 | 低 | light |

**针对真实体验缺失的专项解释 —— inbound message 为何没有 reaction / typing 认可：**

reference 的 typing/acknowledgement **不是** Feishu 的「输入中」专有 API（Feishu 无此 API）。
它的事件认可机制是：

1. 收到入站消息后，`messaging/inbound/gate-effects.js` 立即调用
   `typing.addTypingIndicator()` —— 实质是向该消息 `im.messageReaction.create({emoji_type:'Typing'})`
   加一个**打字 emoji reaction** 作为「已收到、处理中」的可视承诺；
   Agent Core 反之未加任何 reaction → 用户看到的是「消息已发、无回应」的静默。
2. 响应就绪时 `typing.removeTypingIndicator()` 删除该 reaction（`im.messageReaction.delete`）。
3. 另可用 `reactions.js` 对用户输入/完成打 `OK/THUMBSUP/...` 做显式 acknowledgement。

这**完全基于 Lark SDK `im.messageReaction.*`**，与 OpenClaw 运行期无关，仅经
`LarkClient.fromCfg(cfg).sdk` 间接取 SDK client。**Agent Core 用现有
`@larksuiteoapi/node-sdk` 即可实现同等 typing/ack**，无需 OpenClaw。

---

### Part F — Reuse Classification

对代码/能力分四类。判定基于 Part C 的 exact import/调用证据。

**1. REUSE_DIRECTLY（真正独立于 OpenClaw，可直接依赖/提取）**
这些模块运行期 **0 OpenClaw import**，纯逻辑 + Lark SDK / node stdlib：

- `core/lark-client.js`、`core/token-store.js`（凭据/客户端管理，token 仅 node stdlib）、
  `core/raw-request.js`、`core/feishu-fetch.js`（HTTP 封装，纯）
- `messaging/inbound/dedup.js`（event dedupe，0 import）、`mention.js`（仅自带 utils）、
  `parse.js` + `converters/*`（含 `converters/utils.js`；inbound 内容/消息 → 文本/markdown 转换，纯）
- `messaging/outbound/reactions.js`、`typing.js`、`deliver.js`、`send.js`、`media.js`、
  `forward.js`（出站原语，仅 LarkClient/自带模块）
- `core/targets.js`、`core/api-error.js`、`core/message-unavailable.js`（target 规范化/错误守卫）、
  `core/version.js`（User-Agent）
- `card/builder.js`、`card/cardkit.js`、`card/flush-controller.js`、`card/markdown-style.js`、
  `card/tool-use-display.js`、`card/reply-mode.js`（cards / streaming 底层原语，纯）、
  `channel/chat-queue.js`（并发/队列原语）

**2. PORT_WITH_THIN_ADAPTER（Lark 实现很成熟，但需要把 OpenClaw ingress/reply 换成 Agent Core 对应 seam）**

- inbound 事件解析 `parse.js` / normalize：Lark 解析逻辑成熟，需把「喂 OpenClaw session」
  换成「喂 Agent Core onEvent / NotificationIngress」。
- outbound `send.js`/`deliver.js`（text/post/card/media）：把 OpenClaw outbound adapter 对
  象换成 Agent Core Delivery（现有 `feishu.reply` seam，见 Part I）。
- reaction/typing（`reactions.js`/`typing.js`）：把 `LarkClient.fromCfg(cfg).sdk` 换成
  Agent Core `feishu-connector` 持有的 `Lark Client` 实例。
- 事件 dispatch（inbound → agent）：把 OpenClaw dispatch 换成 Router `onIngress`。

**3. REIMPLEMENT_FROM_REFERENCE（思路值得抄，代码与 OpenClaw SDK 耦合太深，不值得直接依赖）**

- `card/reply-dispatcher.js`（text/card/streaming 决策 + chunking + typing 回调编排）——
  **最典型**：设计值得抄（status machine、human-delay、chunk、typing 回调），但实现硬依赖
  `core.channel.*` 与 `createReplyDispatcherWithTyping`。
- `channel/plugin.js`（OpenClaw ChannelPlugin 接口本体）——不在 Agent Core 场景。
- `messaging/inbound/dispatch*.js`/`handler.js`/`reaction-handler.js` 中喂 agent/session 的
  逻辑——思路可借鉴，但须按 Agent Core Router/session 重写。
- streaming 顶层 `streaming-card-controller.js` 的编排——可借设计（状态机 idle→streaming→
  completed/aborted），但 `SILENT_REPLY_TOKEN` 等 OpenClaw 语义须剔除。

**4. DO_NOT_REUSE（OpenClaw runtime/session/gateway/dispatcher/tool semantics，完全不能进 Agent Core）**

- tool 家族 `tools/oapi/**`、`tools/mcp/**`（doc/wiki/bitable/calendar/task …）——OpenClaw
  tool 生命周期，且超出「Lark 传输」scope。
- `core/accounts.js`、`channel/config-adapter.js`（OpenClaw account/config 权威）。
- `messaging/outbound/outbound.js`（OpenClaw outbound adapter 对象）。
- `index.js` 的 `register(api)` 通道装载、hooks、CLI 命令。

---

### Part G — Dependency Strategy

**A. Direct dependency（Agent Core → 直接依赖 `@larksuite/openclaw-lark` package）**

- 是否会 transitively 引入 OpenClaw：`package.json` 依赖仅
  `@larksuiteoapi/node-sdk`、zod、typebox、image-size；**openclaw/plugin-sdk 未声明为
  依赖**（运行期注入）。但 `main`/`index.js` 顶层强制 `import {emptyPluginConfigSchema}
  from 'openclaw/plugin-sdk'` → 直接包级依赖该 npm 包**在无 OpenClaw 运行期时会因为
  `openclaw/plugin-sdk` 不可解析而爆炸**。→ 直接依赖整个 npm 包 **不可行**，除非也只
  抽其中纯模块。
- version coupling / upgrade risk：`openclaw/plugin-sdk` 是 OpenClaw 主版本耦合点，
  跟随 OpenClaw 发布节奏，升级风险高。

**B. Extract / upstream reusable Lark core**

- 天然存在的纯模块（token-store、dedup、mention、cardkit、api-error、mention …）可被
  direct import（不改行，它们无 openclaw 运行期 import）。
- 但很多模块经内部相对路径互相引用，抽成独立「lark transport core」需结构性收口；
  未来可推动 upstream 把 `messaging/(inbound|outbound)` 的纯部分抽成
  `@larksuite/lark-transport-core`。

**C. Vendor / port selected modules（推荐主导路径）**

- 把 Part F「REUSE_DIRECTLY + PORT_WITH_THIN_ADAPTER」中选定的少量纯模块 port 到
  Agent Core `feishu-connector`。
- maintenance：量小（<10 文件）、纯逻辑。
- attribution/license：MIT（见 Part H），可复制修改，需保留版权声明。
- upstream sync cost / divergence risk：**存在**——需建立「reference 版本基线 + 变更记录」，
  控制 drift。

> 结论建议见 Recommendation。不预设单一答案；A 整体否决，B/C 组合可行。

---

### Part H — License / Attribution

从**实际 clone**（`~/.openclaw/extensions/openclaw-lark/`）核实，非凭印象：

- `LICENSE`：**MIT License**, `Copyright (c) 2026 Lark Technologies Pte. Ltd.`
- `README.md` badge：`[License: MIT]`, npm `@larksuite/openclaw-lark`。
- 源码文件头：`Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
  SPDX-License-Identifier: MIT`。
- `package.json` LICENSE（本地插件）：**`UNLICENSED`**（这是 OpenClaw-extensions 目录的
  本地定制包元数据；**源码本体是 MIT**）。

所以：**reference（`@larksuite/openclaw-lark` 官方源码）是 MIT**，允许复制/修改/分发/商用。
未来 port 到 Agent Core 时要求（MIT 条款）：

1. 保留并复制原 MIT copyright notice（`Copyright (c) 2026 Lark Technologies Pte. Ltd.`）到
   移植文件头。
2. 保留 LICENSE 全文（随包/随 repo）。
3. 明确 attribution（在本 repo 的移植模块注释 + LICENSE/NOTICE 标注来源与 commit/version
   `@larksuite/openclaw-lark@2026.3.12`）。
4. 不声明与原出处无关（不误导来源）。

> 注意：本地 `~/.openclaw/extensions/openclaw-lark` 目录还含大量 custom 脚本（非官方源码），
> 那些自定义部分不在官方 MIT 覆盖内；未来只移植官方 `src/**` 传输实现。

---

### Part I — Minimal Target Boundary

候选最终 seam（本轮**不实现**）：

```
LarkAdapter.inbound(event)
  → normalized Feishu event    （取自 reference 的 parse/mention/normalize 纯逻辑）
  → Agent Core NotificationIngress / onEvent
  → Router → DSH

Agent output
  → Delivery  (Agent Core 现有 feishu.reply seam)
  → LarkAdapter.send(replyTarget, {body, msg_type, card?, media?, typing?})
```

关键结论：**候选 seam 非常薄且与现状兼容。**

当前 Agent Core 全系统唯一的出站 seam 就是 `feishu.reply(replyTarget, text)`：
- `agent-router` `onIngress`（正常回复）：`feishu.reply(feishu.replyTargetFor(ingress).replyTo(ingress.messageId), reply)`
- `scheduler-router` `createFeishuDeliver`（定时 announce）：同样仅调 `feishu.reply(ReplyTarget, text)`

→ 任何传输升级（markdown/post、card、media、typing/ack）都可在 **`feishu-connector` 内部**
就地增强，**无需改动 Router / Delivery / scheduler seam / 调 Binding**，因为 seam 的调用
签名（replyTarget + text）不变。

`LarkAdapter` 应能理解：`chatId`、`messageId`、`threadId/rootId`、`sender`、`content`、
`attachments`、`reaction/card metadata`。
应 **不能** 理解：`agentId` semantics、`DSH Session` internals、`Router` lifecycle、
`Scheduler`、`OpenClaw Session`。

判断：**需要这样一个 seam**（薄、兼容现状），但本轮不实现。

---

### Part J — Migration Strategy

由真实 dependency graph 决定的最小顺序（不预设重写整个 Feishu）。

**为什么顺序如此**：reaction/typing/格式化（Phase 1）是 PURE/LIGHTLY 能力、复用难度最低
（直接 port reference 纯模块 typing.js/reactions.js/deliver.js 的 markdown 逻辑，且只改
`feishu-connector` 内部出站/事件副作用，零 seam 改动，**完全不需要 OpenClaw 耦合的
reply-dispatcher.js**——ack+typing 是直配原语，不涉及「text/card/streaming 决策」编排）；
reply/thread + dedupe/retry（Phase 2）仍是 feishu-connector 内增强，不改 Router；cards /
streaming / media（Phase 3）复杂度上升（media 上传、且 streaming 编排必须 REIMPLEMENT
reply-dispatcher 的决策层），放最后。

```
Phase 1  — reaction/typing + markdown post 格式化
           · inbound onEvent 入口加 typing reaction + 完成删除（port typing.js/reactions.js）
           · 出站 api.reply 支持 msg_type:"post"(md) / text 智能选择（port deliver/send）
           · 只改 feishu-connector，seam 签名不变
Phase 2  — reply/thread + dedupe/retry 增强
           · 完善 thread 生成本体 + 应用层 retry/退避（port dedup/api-error）
           · 仍只在 feishu-connector 内
Phase 3  — cards / streaming / media
           · port cardkit/builder + streaming 状态机 + media 上传发送
           · 复杂度最高，最后
```

**stock-agent Canary 之前是否值得完成某个最小 reuse phase？**

现场事实（来自 FEISHU_STOCK_CANARY_READINESS_V1）：Canary 走 **既有组件、无新 gateway**，
其回复已能覆盖用户 wait（Bot 最终回 original chat）。Canary 的 **blocker** 是
`PRODUCTION_INTEGRATION_V1 = PASS`（before canary 流程本就前置），**不是飞书 transport
成熟度**。Feishu 传输当前已能真实收发走通。

判定（区分三类）：

```
CANARY_BLOCKER            = NONE（Feishu 传输已能走通；Canary 不依赖 reaction/card/streaming）
PRE_STOCK_AGENT_HIGH_VALUE= Phase 1（reaction/typing acknowledgement + markdown post）：
                            高价值（直接消除真实体验缺失：无回应静默 + 纯文本），
                            复用难度低，且不改变 seam/Binding/Router。
FOLLOW_UP_UX              = Phase 2（thread/dedupe/retry 增强）与 Phase 3（cards/streaming/media）：
                            锦上添花，不阻塞 Canary，可后置。
```

> 在遵守「Investigation 不授予实现权限」的前提下：**建议在 stock-agent Canary 前完成
> Phase 1（若取得 governing Spec）**，因为它以极小成本修复真实体验的核心缺口；但
> 这**不是 Canary 的强制 blocker**。

---

## Options considered

1. **直接依赖整个 `@larksuite/openclaw-lark` npm 包** —— 否决（顶层强制 import
   `openclaw/plugin-sdk`，无 OpenClaw 运行期不可解析）。
2. **extract/upstream 纯 Lark transport core** —— 可选（存在天然纯模块），但需 upstream
   配合抽包，属中长期。
3. **vendor/port 选定纯模块到 Agent Core feishu-connector** —— 推荐主导路径（量小、MIT、
   seam 兼容）。
4. **什么都不做，保持现状 text-only** —— 可接受（能收发），但 UX 缺口持续存在。

---

## Findings

1. 当前 Agent Core Feishu 出站仅 `msg_type:"text"`，无 reaction/typing/card/markdown/media；
   inbound 无任何 ack；typing/acknowledgement 完全缺失 —— 与真实体验一致。
2. 实际参考 = 本机 `@larksuite/openclaw-lark@2026.3.12`（官方 Lark 插件，MIT）。
3. **核心区别**：Lark protocol/transport 层（WS/token/parse/dedup/mention/reaction/typing/
   send/deliver/media/card/error）几乎不依赖 OpenClaw；OpenClaw 深度耦合集中在
   「channel plugin 接口 + account/config 权威 + inbound dispatch→session + outbound
   adapter + tool 家族」。二层干净可切。
4. `openclaw/plugin-sdk` 为运行期注入（不在 node_modules）——凡运行期 import 它的模块
   无法脱离 OpenClaw 运行。
5. **typing/ack 无需 Feishu 专有 API**：reference 用 `im.messageReaction.create('Typing')`
   仿真 typing + `reactions.js` 做 ack —— 用 Agent Core 现有 Lark SDK 即可实现同款。
6. Agent Core 全系统唯一出站 seam 就是 `feishu.reply(replyTarget, text)`；传输升级可在
   feishu-connector 内部完成，**不需要改 Router/Delivery/Binding**。
7. License = MIT（©2026 Lark Technologies Pte. Ltd.），可复制/修改，port 时须保留
   copyright + LICENSE + attribution。
8. **切割线 = 不设 `LarkClient.runtime`**：inbound parse/dedupe/mention/content-conversion
   与 outbound create/reply/upload/reaction 完全可脱离 OpenClaw 复用（注入一个
   cfg 形状的 credentials 对象 + 可选 table/chunking 回调即可）；真正的端到端鉴权分发仍需
   reply-dispatcher.js + dispatch-*.js（OpenClaw dispatcher/gateway 语义）→ 属 REIMPLEMENT/DO_NOT_REUSE。
9. `core/targets.js` 的 `normalizeFeishuTarget`/`normalizeMessageId` 是纯函数，作为
   `feishu-connector` ReplyTarget 的上游/对照极有价值（当前 Agent Core 已有独立实现，可对齐）。

---

## Recommendation

**OPENCLAW_LARK_TRANSPORT_REUSE_INVESTIGATION_V1 = PASS，支持「最小 reuse」方向，但不在此轮实现。**

1. 采用 **Option 3（vendor/port 选定纯模块）** 为主、**Option 2（推动 upstream 抽
   lark-transport-core）** 为长期演进，**否决 Option 1（整体引入 npm 包）**。
2. 启动范围内的首个迁移是 **Phase 1**：reaction/typing acknowledgement + markdown post 格式化，
   全部落在 `feishu-connector` 内部（port `typing.js`/`reactions.js`/`deliver.js` 的 markdown
   逻辑），不改 seam、Binding、Router。
3. 该迁移必须在 **新 governing Spec** 下实施（Investigation 不授予实现权限）。
4. 在 stock-agent Canary 前，Phase 1 是 **PRE_STOCK_AGENT_HIGH_VALUE**（非 blocker）。

```
DIRECT_DEPENDENCY_RECOMMENDED = NO
OPENCLAW_RUNTIME_DEPENDENCY_INTRODUCED = NO
PROPOSED_LARK_ADAPTER_BOUNDARY = 薄 adapter：inbound→normalized→onIngress；
                                outbound→feishu.reply seam 增强（text/post/card/media/typing/ack）
PRE_STOCK_AGENT_RECOMMENDATION = 完成 Phase 1（reaction/typing + markdown post）
NEED_GOVERNING_SPEC = YES
```

---

## Open questions

1. Phase 1「outbound 用 post(md) vs text」如何定默认策略（全部 md，还是按内容 detectCard / 长度）？
2. typing 仿真 reaction（`Typing` emoji）在 Agent Core 群聊中是否会造成「bot 一直冒反应」噪音，
   需不需要 per-group 开关？
3. thread 生成本体在 Agent Core 现有 ReplyTarget 数据层之上需要多厚（Phase 2）？
4. streaming（Phase 3）在 DSH Agent 是「一次 turn 返回完整 reply」的模型下价值有多大？
   （若 Agent 不吐增量，streaming 原语无法完全发挥。）
5. 长期是否值得推动 upstream 把纯 Lark transport 收口为独立 package？

---

## Related

- `docs/reports/feishu-stock-canary-readiness-v1.md`（Canary 前置、既有 Feishu 链路）
- `packages/feishu-connector/src/*`（当前 Agent Core 飞书实现）
- `docs/investigations/openclaw-parity-v1.md`（既往 OpenClaw 平行能力盘点）
- `docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`（Investigation/Spec 权威边界）
- `.agents/README.md`（Agent 开发协议 / Investigation 不授予实现权限）
