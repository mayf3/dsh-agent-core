---
spec_id: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
status: superseded
replaced_by: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
supersedes: AGENT_CORE_LARK_TRANSPORT_PHASE1_V1
date: 2026-08-19
type: implementation-spec (spec-only; no implementation this round)
scope: docs-only — freeze the @larksuite/channel foundation cutover (Phase A) as the sole first-round
  implementation permission; defer all UX activation (Phase B) to AGENT_CORE_LARK_UX_PHASE1_V2
references:
  - docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md (PASS; evidence authority; branch HEAD 6afa83c)
  - docs/specs/AGENT_CORE_LARK_TRANSPORT_PHASE1_V1.md (accepted; NEVER implemented; SUPERSEDED by this spec — see §1)
  - docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md (accepted; §4.5 PREBOUND_ONLY)
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (accepted; Current Authority)
  - docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md (proposed; PARTIALLY_SUPERSEDE by V2)
  - docs/decisions/BINDING_AND_SWITCH_V1.md (accepted; PARTIALLY_SUPERSEDE by V2)
---

# AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1 — 官方 Lark Channel SDK Foundation Cutover（只出 Spec，不实现）

> 性质：**Spec（SPEC ONLY — 本轮只冻结并撰写本 Spec，不 implementation / 不部署 / 不 merge）**
> · 日期：2026-08-19
> 仓库：`mayf3/dsh-agent-core` · 分支：`docs/official-lark-channel-integration-v1-investigation`
> BASE_MAIN = `93f9acf67cb9b4862fc9b8ffaf593630086285ba`（origin/main，fetch 复核未前进）
> BRANCH_BASE = `6afa83c`（前置 Investigation `AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1`
> 的交付 commit；本 Spec 建立在其证据之上）
>
> 本 Spec 是 `@larksuite/channel` 官方 SDK 作为 Agent Core Feishu transport foundation 的
> governing implementation Spec。evidence source 是上述 Investigation（**evidence authority，
> 不复制其细节**；需细节时引用文件名与章节）。
>
> **本轮零改动**：只新增本 Spec 文件。`PRODUCT_CODE_CHANGE = NONE`、
> `DEPENDENCY_CHANGE = NONE`、`DEPLOYMENT = NONE`、`MERGE = NONE`。
> 不修改任何代码、不修改任何既有 Spec / Decision / Investigation、不安装依赖、不部署、不 merge。
>
> **状态（2026-08-19 acceptance finalize）：accepted** —— 独立 review PASS：reviewed HEAD
> `0ea5a39`，`AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1_SPEC_REVIEW` = PASS、
> BLOCKERS = NONE、SEMANTIC_REVIEW_COMPLETE = YES。finalize 轮为 metadata-only
> （`SEMANTIC_CHANGE_AFTER_REVIEW = NONE`）：正文、Contract、AC、scope、阶段划分
> 与 reviewed 字节内容零变化。accepted 即具备实现许可——**首轮 implementation
> permission 仅覆盖 PHASE A FOUNDATION CUTOVER（§5.1）**；PHASE B UX ACTIVATION
> 仍未授权（§5.2）。本 Spec 进入 implementation base branch（main）之前，
> 不得开工实现。

---

## 0. North Star

```text
Human → Feishu → @larksuite/channel（官方 SDK：协议/传输 authority）
              → Agent Core 薄 adapter（映射 + PREBOUND_ONLY + Router seam）
              → Router（Binding authority，零改动）
              → Agent canonical main（零改动）
              → SDK outbound（行为兼容的 text 回执）
```

Phase 1（旧 Spec）的路线是「从 `@larksuite/openclaw-lark@2026.3.12` selective PORT 六模块 +
REIMPLEMENT 四件」。该路线**从未实现**（main @ 93f9acf 的 feishu-connector 仍是 V0 text-only），
且被第一方 SDK `@larksuite/channel@0.5.0` 实质取代：WS 生命周期、事件归一化（21 msg_type）、
dedup（SeenCache + ProcessingLock）、outbound 协议原语（reply/thread/分块/降级/退避）全部内置。
本 Spec 把 transport foundation 切换到官方 SDK，**首轮只做 Foundation 兼容性 cutover（Phase A）**，
一切产品 UX 激活（Phase B）推迟到后续 `AGENT_CORE_LARK_UX_PHASE1_V2`。

Foundation 的成功标准只有一条：**cutover 前后，Agent Core 的产品行为字节级不变**
（Binding 键、准入语义、路由、回执），变的只是协议层由谁实现。

---

## 1. Supersession 声明（machine-readable）

### 1.1 声明

```text
AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
SUPERSEDES
AGENT_CORE_LARK_TRANSPORT_PHASE1_V1
```

machine-readable 表达（双锚点）：

1. **本文件 frontmatter**：`spec_id: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1` +
   `supersedes: AGENT_CORE_LARK_TRANSPORT_PHASE1_V1` + `status: proposed`（本轮写入）。
2. **旧 Spec frontmatter 翻转**：`docs/specs/AGENT_CORE_LARK_TRANSPORT_PHASE1_V1.md`
   的 `status: accepted → superseded` 并新增 `replaced_by: AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1`
   ——这是 `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md` §5 冻结的 SUPERSEDE 机制
   （「新 Spec，旧 Spec 标 superseded + replaced_by」）的后半步。

### 1.2 旧 Spec 处置时点（冻结）

旧 Spec 的 frontmatter 翻转**不属于本轮 authoring PR**（本轮不得修改旧 Spec 文件），
而属于**本 Spec 的 acceptance-finalize 轮**：仅当本 Spec 通过独立 review 并 finalize 为
accepted 时，才以 **text-only metadata 轮**（`SEMANTIC_CHANGE = NONE`，与仓库既有
SPEC_ACCEPTANCE_FINALIZE 轮同构）对旧 Spec 做 status 翻转。若本 Spec 被 rejected，
旧 Spec 维持 accepted，supersession 不成立。在本 Spec accepted 之前，二者并存时的阅读规则：
旧 Phase1 Spec 是 accepted 但**已被本 Spec（proposed）声明取代、且从未实现**的历史 authority；
任何人不得据旧 Spec 开工实现（其路线已被 Investigation 裁定失效，见 §3）。

旧 Spec **保留为历史 authority**：不删除、不移动、不原地改义（「不原地改义」= 除 §1.1-2
所述 frontmatter status/replaced_by 两个 metadata 字段外，正文一概不改；其 §13 Status 块
等正文保持 acceptance 当时的原样）。

### 1.3 Supersession 内容映射（旧 Spec 逐元素去向）

| 旧 Phase1 元素 | 产品目标 / 内容 | 去向 |
|---|---|---|
| §2 reference 基线 `@larksuite/openclaw-lark@2026.3.12` + §8 PORT/REUSE/REIMPLEMENT 全表 | 「从 openclaw-lark 移植什么」的实施路线 | **SUPERSEDED（路线整体失效）**——该 Spec 的实质内容就是 PORT 清单，foundation 更换后无处安放（Investigation §8.5）。openclaw-lark 从此仅为历史 reference，不再是任何实施载体 |
| Part A — bound group configurable no-mention ingress | 显式声明群可免 @ 交互 | **产品目标 PRESERVED，实现推迟** → `AGENT_CORE_LARK_UX_PHASE1_V2`（Phase B；见 §5.2） |
| Part B — inbound acknowledgement / typing reaction | 处理中可见反馈 | **产品目标 PRESERVED，实现推迟** → `AGENT_CORE_LARK_UX_PHASE1_V2`（SDK `addReaction/removeReactionByEmoji` 原语已在 Foundation 引入但**不启用编排**） |
| Part C — improved markdown/text outbound formatting | 富文本出站（post 信封） | **产品目标 PRESERVED，实现推迟** → `AGENT_CORE_LARK_UX_PHASE1_V2`（Foundation 出站保持 text 行为兼容，见 §10） |
| §5.1 TYPING_LIFECYCLE / §4.2 policy 优先级等语义冻结文本 | UX 语义设计 | 作为 UX_V2 立项时的**历史 authority 输入**沿用评估，不在本 Spec 复制 |
| §10 AC1–AC10 | 旧验收标准 | SUPERSEDED —— 由本 Spec §14 AC 全表替代（Foundation 语义）+ 未来 UX_V2 AC（激活语义） |
| §3 Frozen Boundaries 中 `DIRECT_OPENCLAW_DEPENDENCY = NO`、`OPENCLAW_RUNTIME_DEPENDENCY = NONE` | 边界 | **PRESERVED 并升格**为本 Spec §4 的 `OPENCLAW_LARK_RUNTIME_DEPENDENCY = NONE`（SDK 路线下同样成立：`@larksuite/channel` 与 openclaw-lark 无关） |
| §12 Deferred Q4「推动 upstream 抽独立 package」 | 开放问题 | **CLOSED** —— upstream 已经做了（`@larksuite/channel` 即那个独立 package），本 Spec 就是采纳 |

**映射不变量**：SUPERSEDE 不得让旧 Phase1 已冻结的产品目标无声消失。Part A/B/C 三个目标
全部显式落到 `AGENT_CORE_LARK_UX_PHASE1_V2`（§5.2 冻结该 Spec 名为唯一 Phase B governing
spec 占位；其立项时间与内容由 owner 决定，本 Spec 只锁名字与承接义务）。

---

## 2. Problem

现状（main @ 93f9acf，全部 source-verified）：

1. **自包协议层薄且弱**：`feishu-connector/src/transport.js` 是 node-sdk `WSClient` 薄壳
   （reconnect 计数实际无人触发）；`core.js` 自写 ~330 行归一化（7 种 msg_type）、
   自写 `LruDedup`（mark-**before**-dispatch：进程崩溃 mid-processing 即永久丢单）；
   `api.js` 出站仅 `msg_type:"text"`；bot open_id 用裸 REST 自解析（异步、失败静默降级
   null——身份未就绪时群 @bot 消息会被误判为未提及而丢弃）。
2. **旧 accepted Spec 的路线失效**：`AGENT_CORE_LARK_TRANSPORT_PHASE1_V1`（2026-08-17
   accepted）冻结「从 openclaw-lark PORT」，从未实现；官方第一方
   `@larksuite/channel@0.5.0`（MIT，runtime deps 仅 2 个：`@larksuiteoapi/node-sdk ^1.73.0`
   ——与 feishu-connector 现有 pin 完全一致——+ `https-proxy-agent ^9`）以协议层身份覆盖了
   该路线的全部目标且更强。
3. **缺失的语义决定无处安放**：SDK 自带 batching（默认 600ms 合并）、per-chat 串行队列
   （默认 ON）、stale-drop（默认 30min）、PolicyGate（requireMention 默认 true）等产品可见
   语义开关——不显式冻结就会以 SDK 默认值隐式改变 Agent Core 产品行为。

需要的：一份 superseding Spec，授权一次**行为兼容的 foundation cutover**，冻结全部 SDK
语义开关为「与现状等价」的值，锁定 Binding 键字节连续性，并把一切 UX 激活显式挡在首轮之外。

---

## 3. Governing Evidence（只读引用，不复制）

| Artifact | 结论（冻结引用） |
|---|---|
| `docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md`（PASS，2026-08-18/19） | `RECOMMENDED_FOUNDATION = @larksuite/channel`；`DIRECT_DSH_LARK_PLUGIN_ADOPTION = NO`（ConversationSessions / connector 层 agents.create-resume / chat-derived session ownership / /cd workspace authority / connector-owned model selection / second agent lifecycle / second binding tables 全部实证存在并全部排除）；`CURRENT_LARK_PHASE1_SPEC_DISPOSITION = SUPERSEDE`；authority 五层分层（§3）、排队语义判定（§6）、模块去留矩阵（§5.2）、最小 files-to-change / migration / AC 草案（§8）——本 Spec 是其 §8.5 裁定「需要新 Spec」的落实 |
| `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md`（accepted）§4.5 | `FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY`：unknown/unbound conversation fail closed、固定回执、绝不创建 default Binding；gate = `makeV2PreboundIngressGate`（`packages/production-runtime/src/v2-ingress-gate.js`），只经 Router 通用读 API（`channelConversationId` + `getBinding`），TOCTOU 只欠放行 |
| `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`（accepted，Current Authority） | `ONE_AGENT_ONE_WORKSPACE = YES`、`FEISHU_BINDING = FIXED`、`CANONICAL_MAIN`（main = logical slot）、`AGENT_SECURITY_DOMAIN = AGENT`、`BINDING_WORKSPACE_TRANSITIONAL` |
| `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`（proposed；机制层 PRESERVE） | Binding 实体；connector 不持有 agent/session 状态；`channelConversationId(channel, externalId)` = `feishu:<conversationId>` 键控（id format owner = Router） |
| `docs/decisions/BINDING_AND_SWITCH_V1.md`（accepted） | Binding owner = Router / Control Plane；原子 JSON 持久化；per-Agent turn single-flight |
| 现状实现（main @ 93f9acf，本会话实读） | `feishu-connector/src/{index,core,transport,api}.js`（挂载壳 / 纯逻辑 / WS 薄壳 / text-only 出站）；`production-runtime/src/{compose.js:163-196, v2-ingress-gate.js}`（FEISHU_CREDS_PATH 挂载 + gate fail-loud 接线）；`agent-router/src/index.js`（`channelConversationId:140`、`ingressBindingNamespace`、`onIngress`、Delivery V0）；`agent-router/src/process.js:302-309`（per-agent single-flight promise chain）；`scheduler-router/src/index.js:140-165`（出站唯一依赖 `feishu.reply(ReplyTarget, text)`） |

上游基线（Investigation 已 clone 实读）：`@larksuite/channel@0.5.0` @
`d41b81c350d4c4df27d26d94dcd7b24bc96cef8a`；`dsh-lark-channel@0.0.6` @
`bffc7306`（**不采纳**，仅 reference）。

---

## 4. Frozen Decisions（已接受，不得重新设计）

以下决定已经 owner 接受，本 Spec 只冻结执行，评审与实现**不得重开**：

```text
TRANSPORT_FOUNDATION = @larksuite/channel
REVIEWED_SDK_BASELINE = 0.5.0 @ d41b81c
DIRECT_DSH_LARK_PLUGIN_ADOPTION = NO
OPENCLAW_LARK_RUNTIME_DEPENDENCY = NONE

ROUTER_BINDING_AUTHORITY = PRESERVE        （agent-router/* 0 行改动；Binding 行键控不变）
FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY     （gate predicate 原样，仅挂载位平移）
ONE_AGENT_ONE_PRIMARY_WORKSPACE = PRESERVE （V2 ONE_AGENT_ONE_WORKSPACE + Agent.primaryWorkspace
                                            静态 import 模型不动；workspace-bootstrap 0 行改动）
CANONICAL_MAIN = PRESERVE                  （defaultSessionId='main'；binding.activeSessionId 路由不动）
AGENT_SECURITY_DOMAIN = PRESERVE           （进程/凭据/broker 模型不动；SDK 无凭据概念）

SECOND_BINDING_AUTHORITY = NO
SECOND_SESSION_AUTHORITY = NO
SECOND_WORKSPACE_AUTHORITY = NO
SECOND_AGENT_LIFECYCLE = NO
KERNEL_CHANGE = NONE
DUAL_TRANSPORT_RUNTIME = NO                （不保留 legacy WSClient 与 SDK 双连接）

本轮（authoring round）：
PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NONE
```

Foundation cutover 的冻结配置值（§6.5 详述）：

```text
SDK_BATCH_DELAY_MS = 0
SDK_CHAT_QUEUE = DISABLED
SDK_STALE_DROP = DISABLED
SDK_REQUIRE_MENTION = true
CUSTOM_LRU_DEDUP = REMOVE
DEDUP_AUTHORITY = @larksuite/channel
```

这些值是 Foundation 兼容性 cutover 的冻结值：**不得采用 SDK 默认值造成隐式产品语义变化**
（SDK 默认 batching 600ms / chat queue ON / stale-drop 30min，均与现状行为不等价，见 §6.5）。

---

## 5. Phase 划分

### 5.1 PHASE A — FOUNDATION CUTOVER（本 Spec 首轮 implementation permission 的唯一范围）

**@larksuite/channel 负责**（协议/传输 authority，Investigation §3 层 1-2）：

- WebSocket lifecycle（connect / handshake 超时 / reconnecting / reconnected，可选 keepalive）
- first-handshake readiness（含 connect 时 `fetchBotIdentity`）
- reconnect primitives
- bot identity
- event normalization（21 msg_type registry + mention 解析 + reply/thread 上下文）
- one dedup authority（SeenCache mark-after-handler + ProcessingLock 补 in-flight 窗口）
- outbound protocol primitives（send / reply / reply_in_thread / 长文分块 / rate_limited 退避）
- 全局 eligibility（PolicyGate：requireMention；dmMode；groupAllowlist——Foundation 仅用默认姿态）

**Agent Core 薄 adapter（住在 feishu-connector 内）继续负责**（Investigation §3 层 3-5 的接线）：

- 将 SDK NormalizedMessage 映射为既有 `IngressEvent`（§7 契约）
- 保持 conversationId 与既有 Binding key **字节级兼容**（§7 golden vectors）
- 调用 PREBOUND_ONLY predicate（`makeV2PreboundIngressGate` 原样注入，fail-closed + 固定回执）
- 进入现有 Router callback（`cfg.onEvent` → Router `onIngress`，签名不变）
- 保持既有 ReplyTarget / Router reply seam（`feishu.reply(replyTarget, text)` 原样；见 §10）

### 5.2 PHASE B — UX ACTIVATION（本轮不授权）

以下能力**不在首轮 Foundation implementation permission 内**，不得随 cutover 自动开启：

- per-group configurable no-mention（旧 Part A）
- Typing reaction lifecycle（旧 Part B）
- Markdown/post activation（旧 Part C）
- streaming card
- media/file content delivery
- question / plan / approval cards

**Phase B governing spec = `AGENT_CORE_LARK_UX_PHASE1_V2`**（名字本 Spec 冻结；内容与立项
时间 owner 决定）。旧 Phase1 的 Part A/B/C 产品目标按 §1.3 映射到该 Spec。任何 Phase B
实现开工前，该 Spec 必须先独立立项并 accepted——本 Spec 不因 SUPERSEDE 而吸收或删除这些
产品目标，也不预支其实现许可。Foundation 交付物中若包含 Phase B 能力的** dormant 代码**
（如 SDK 原语天然存在），允许存在但不得有任何激活路径（配置键、环境变量、默认值均不得开启）。

---

## 6. Phase A — Foundation Cutover 架构

### 6.1 Authority 分层（ Investigation §3 的落地形态）

```text
层 1  飞书协议/Transport authority —— @larksuite/channel
层 2  Transport eligibility —— SDK SafetyPipeline（stale[disabled] → dedup → PolicyGate
      [requireMention=true] → chat queue [disabled]）
层 3  Agent Core PREBOUND_ONLY admission —— 不变，挂载位从 connector 内部 pipeline 位
      平移为 SDK message handler 最前段（逻辑链位置等价：channel 级资格之后、
      任何 Router 调用之前）；makeV2PreboundIngressGate 逐字节不动
层 4  Router Binding authority —— 零改动（agent-router/* 0 行 diff）
层 5  Agent / Session / Workspace authority —— 零改动（ensureRunning、AgentProcess
      single-flight、workspace-bootstrap、canonical main 全部不动）
```

### 6.2 模块去留（Investigation §5.2 的冻结化）

| 现状模块 | 去向 |
|---|---|
| `transport.js`（WS 薄壳 + node-sdk `WSClient` 装配） | **DELETE**（SDK connect/keepalive/reconnect 取代；不得残留第二条连接，见 §9） |
| `core.js` `normalizeIngressEvent` 原始 wire 解析 | **DELETE**（SDK 21-type normalize 取代；新增**薄映射** SDK NormalizedMessage → `IngressEvent`） |
| `core.js` `LruDedup` / `dedupEvent`（admission 路径） | **REMOVE from admission path**（SDK SeenCache + ProcessingLock 取代且更强；严禁双层 dedup。测试代码中作为对照实现保留不受限） |
| `core.js` `classifyIngress` | **DELETE/收敛**：p2p 准入、group requireMention、thread-as-group-mention 全部由 SDK PolicyGate（requireMention=true）承担；adapter 仅保留 SDK 不拥有的残余守卫——**self-echo drop**（`sender_type` 为 bot/app 的自回声，与现状 `classifyIngress` 的 `self_echo` 分支语义一致），置于 bridge handler 最前段 |
| `core.js` conversationId 派生（`buildConversationId`/`resolveConversation` 语义） | **KEEP（字节级语义不变）**——Binding 连连续性命脉；输入源从 raw event 字段改为 SDK 归一化字段（§7） |
| `core.js` ReplyTarget 家族（`buildReplyTarget`/`replyTargetFor`） | **KEEP**（出站语义不变；末端由 ReplyTarget→SDK send options 薄映射实现，§10） |
| `conversationWorkspaceId` / `conversationMainSessionId` | **KEEP**（TRANSITIONAL 承诺不变：继续导出、normal 路径继续不调用） |
| `api.js`（text-only reply + node-sdk client 直调） | **DELETE**（SDK send/reply 取代；允许缩并为 ReplyTarget→SendOptions 纯映射模块） |
| `index.js` 挂载壳 | **REWRITE**（createLarkChannel + handler 装配：stale/queue/batch/mention 冻结配置、bridge handler = self-echo → gate → onEvent、readiness promise、SDK shutdown；`{enabled, credentialsPath}` 挂载协议与 `ctx.provide('feishu', handle)` 服务面保持，§9） |
| bot open_id 裸 REST 自解析（`index.js:153-169`） | **DELETE**（SDK connect 时 fetchBotIdentity；身份未就绪不得以 unknown/null 处理群消息，§9） |
| `standalone.mjs` 手工验证驱动 | **REWRITE**（同一 SDK 冻结配置驱动；手工验证路径不降级） |
| `production-runtime/src/v2-ingress-gate.js` | **KEEP，0 行 diff**（predicate 与其测试原样） |
| `production-runtime/src/compose.js` | 最小改动：仅 (a) 挂载后 **await connector readiness**（§9）、(b) 与之配套的日志/失败语义；`FEISHU_CREDS_PATH` 挂载协议、`wireV2IngressGate` fail-loud 接线不变 |

### 6.3 IngressEvent 映射契约

新增纯函数（落点 `feishu-connector/src/` 内，文件名实现自定）：输入 SDK NormalizedMessage，
输出**既有 `IngressEvent` shape**。Router 及下游消费的字段
（`channel`/`chatType`/`conversationId`/`chatId`/`threadId`/`rootMsgId`/`parentMsgId`/
`messageId`/`messageType`/`sender`/`text`/`mentions`/`mentioned`/`addressed`/`attachments`/
`timestamp`）逐字段保持语义不变；`dedupKey` 保留为**informational 字段**
（`event_id || 'message:'+messageId`），不再是 dedup authority。`workspace`/`session`
继续不注入（V2 §4.4/§5 语义不变）。映射必须是纯函数、可单测（与 core.js 现有风格一致）。

### 6.4 SDK 安全语义与现状的已接受差异（诚实记录）

| 维度 | 现状 | Foundation（SDK） | 判定 |
|---|---|---|---|
| dedup mark 时机 | mark-**before**-dispatch（崩溃 mid-processing = 永久丢单） | mark-**after**-handler + ProcessingLock 补 in-flight 窗口 | **接受的改进**：进程内 exactly-once 准入（含并发重投）；跨进程重启从「丢单」变为「至多一次处理或重启后重投」，任何情况下不劣于现状 |
| self-echo 判定 | `classifyIngress`（bot/app sender） | adapter 残余守卫（同语义，位置在 SDK pipeline 之后、gate 之前） | 等价（两序都在 PREBOUND_ONLY 之前丢弃） |
| 无 mention 群消息 | `classifyIngress` drop（`group_not_mentioned`，静默） | SDK PolicyGate drop（requireMention=true，静默） | 等价 |
| WS 断线恢复 | node-sdk WSClient 内建（reconnect 计数无人消费） | SDK reconnecting/reconnected + 可选 keepalive | 等价或更强；SDK 恢复环若有 terminal give-up（dsh-lark 证据），经 canary 观察，不足时按 §16 记录证据走后续轮，不得 cutover 中途即兴移植 dsh-lark `liveness.ts` |

### 6.5 Foundation 冻结配置值（逐条理由）

```text
SDK_BATCH_DELAY_MS = 0
  SDK 默认 600ms/8条/4000字符合并按 chatId 键控；Agent Core 的 Binding 单位是
  conversationId（chatId 与 chatId:topic:<threadId> 是两个不同 Binding 却共享同一
  chatId pipeline）——跨 conversation 合并将无法路由到唯一 Binding。dsh-lark 生产
  同款清零决定（runtime.ts:77-85，群内 sender 错标）。SDK 配置键：
  safety.batch.text.delayMs = 0。

SDK_CHAT_QUEUE = DISABLED
  SDK ChatPipeline 默认 ON（scope=chatId，串行同 chat handler 执行）。现状 Agent Core
  无任何 chat 级队列：事件并发直达 onIngress，唯一串行化 authority 是 AgentProcess
  per-agent single-flight（process.js:302-309）。Foundation = 行为兼容 cutover，故
  chat queue 必须禁用，保持「单消息路径只过一条队列（agent single-flight）」的现状
  语义。重新启用 per-chat 串行是产品语义变化，属 Phase B+ 决定，本 Spec 冻结为
  DISABLED，实现 PR 不得自行开启。

SDK_STALE_DROP = DISABLED
  SDK 默认 30min stale 丢消息（safety/types.ts:30 DEFAULT_STALE_MS）；现状无此行为
  ——停机超 30min 后的补投会被静默丢弃。Foundation 禁用 stale-drop，保证补投行为
  与现状一致（dedup 仍兜底重复）。

SDK_REQUIRE_MENTION = true
  与现状 classifyIngress 姿态一致（未声明群的 no-mention 消息仍被丢弃）。SDK
  PolicyGate 默认即 true，但必须显式 pin（防 SDK 未来改默认值造成隐式漂移）。
  per-group 覆盖 = Phase B（UX_V2）裁决。

CUSTOM_LRU_DEDUP = REMOVE
  LruDedup/dedupEvent 从 admission 路径移除；严禁双层 dedup。

DEDUP_AUTHORITY = @larksuite/channel
  唯一 dedup authority = SDK SeenCache + ProcessingLock（Foundation 使用进程内实现，
  不配置 SDK 的可注入持久 dedup 层——不引入新的持久产品状态，见 §12）。
```

以上六值为**语义契约**；实现以 SDK 0.5.0 实际配置面落值，若 SDK 键名与上述语义无法
一一对应（如某项不可禁用），实现 PR 必须 fail-loud 报告并停在 OWNER_DECISION_REQUIRED
（§13.3），不得近似替代。

---

## 7. Contract 1 — Conversation identity compatibility（golden vectors）

**目标**：证明迁移前后 `router.channelConversationId('feishu', conversationId)` 完全一致；
既有 Binding 无需迁移、不会孤儿化。

### 7.1 冻结的 golden vectors

派生语义来源 = 现状 `core.js` `buildConversationId`/`resolveConversation`（main @ 93f9acf，
实读）：

```text
GV1  p2p 基线
     in : chat_type=p2p, chat_id="oc_4d2f81a9e7"（无 thread_id / root_id）
     out: scope=p2p, channel='p2p'
          conversationId = "oc_4d2f81a9e7"
          ccId = feishu:oc_4d2f81a9e7
          replyInThread = false

GV2  group 基线
     in : chat_type=group, chat_id="oc_9b7c3e5f12"
     out: scope=group, channel='group'
          conversationId = "oc_9b7c3e5f12"
          ccId = feishu:oc_9b7c3e5f12
          replyInThread = false

GV3  topic thread（thread_id 存在）
     in : chat_type=group, chat_id="oc_9b7c3e5f12",
          thread_id=" omt_2a8d40c1 "（首尾空白，证明 trim）
     out: scope=group_topic, channel='thread'
          conversationId = "oc_9b7c3e5f12:topic:omt_2a8d40c1"
          ccId = feishu:oc_9b7c3e5f12:topic:omt_2a8d40c1
          replyInThread = true

GV4  reply 带 root_id 但无 thread_id（inline 回复）
     in : chat_type=group, chat_id="oc_9b7c3e5f12",
          root_id="om_5e1c9b", parent_id="om_5e1c9b"
     out: scope=group, channel='group'（root_id ≠ thread：不构成 topic thread）
          conversationId = "oc_9b7c3e5f12"
          ccId = feishu:oc_9b7c3e5f12
          rootMsgId = "om_5e1c9b"（作为事件字段携带，不参与 conversationId）
          replyInThread = false（reply 端点不带 reply_in_thread）

GV5  缺失可选 id
     5a in : chat_type=p2p, chat_id=""（空串/全空白）
         out: conversationId = "unknown"; ccId = feishu:unknown
     5b in : chat_type=group, chat_id="oc_9b7c3e5f12", thread_id=""（空串）
         out: threadId=undefined → 同 GV2（conversationId = chatId）

GV6  p2p 携带 thread_id（supplemental edge）
     in : chat_type=p2p, chat_id="oc_4d2f81a9e7", thread_id="omt_2a8d40c1"
     out: isThread 要求 chat_type=group → scope=p2p
          conversationId = "oc_4d2f81a9e7"; ccId = feishu:oc_4d2f81a9e7
          （threadId 仍作为事件字段携带，但不参与 conversationId）
```

补充不变量（Binding namespace）：Feishu 入站的 Binding namespace 恒为 `feishu`
（`ingressBindingNamespace`：`ingress.channel` 是消息子类型 p2p/group/thread，
**不是** Binding namespace）——映射后 `ingress.channel` 语义必须保持，ccId 永远
`feishu:<conversationId>`。

### 7.2 Vector 执行要求（实现 PR 交付物）

1. **golden fixture 文件**（JSON，committed）：至少覆盖 GV1–GV6 全部输入与期望输出
   （conversationId / ccId / channel / threadId / rootMsgId / replyInThread）。
2. **端到端测试**：raw wire event → SDK（0.5.0 pinned）normalize → 薄映射 → conversationId，
   与 fixture 期望值逐字节断言相等；再经 `channelConversationId('feishu', …)` 断言 ccId 相等。
3. **差分对照**：实现 PR 允许将旧 `normalizeIngressEvent`/`buildConversationId` 以
   test-only 代码形态保留为对照实现，对同一 fixture 做差分断言（old vs new 派生一致）。
   test-only 保留不等于生产路径保留（§6.2 的 DELETE 面向生产代码）。
4. **真实 Binding 行连续性**：以现网 bindings.json 的真实行（如 stock 群 canary 的
   `feishu:oc_…` 行）做只读回放：同一 conversation 的 canary 事件经新链路派生 ccId 后
   `router.getBinding(ccId)` 必须命中既有行（不迁移、不孤儿化）。

---

## 8. Contract 2 — Pipeline ordering（冻结）

```text
SDK stale/dedup/global eligibility
  （stale-drop DISABLED → no-op；dedup = SeenCache+ProcessingLock；
    PolicyGate requireMention=true；chat queue DISABLED）
→ Agent Core PREBOUND_ONLY（bridge message handler 内：
    self-echo 残余守卫 → makeV2PreboundIngressGate predicate，
    fail-closed，unbound → 固定 INGRESS_GATE_REJECTED_REPLY 回执，不调 onEvent）
→ Router（onIngress → resolveChannelConversation → resolveEffectiveWorkspace
    → ensureRunning）
→ Agent canonical main（proc.turn(binding.activeSessionId, …)；
    AgentProcess per-agent single-flight）
→ SDK outbound（feishu.reply(ReplyTarget, text) → SDK send/reply）
```

冻结约束：

1. **no-mention 群消息由 SDK `requireMention=true` 拦截**（Foundation V1 语义 = 现状
   `group_not_mentioned` drop），发生在 Agent Core gate 之前（channel 级资格先于绑定准入）。
2. **任何路径不得绕过 PREBOUND_ONLY**：unbound conversation 绝不进入 `onEvent`，因此
   `resolveChannelConversation` 的 first-contact default Binding 创建路径对 Feishu 入口
   根本不会执行（V2 §4.5 语义原样）。
3. **单一串行化 authority 不变**：单条消息路径仅过 AgentProcess single-flight；
   connector 内无再 dedup、无再 queue（§6.5）。
4. **handler = await 完整 turn**（与现状 `onEvent` 语义一致：bridge handler await
   Router onIngress 直至 turn 完成）；Foundation 不引入 admission 式 handler、不启用
   交互卡片（card action 同 chat 排队风险是 Phase B 前置改造，见 §16）。

---

## 9. Contract 3 — Lifecycle

```text
FIRST_HANDSHAKE_AWAIT = REQUIRED
  production-runtime compose 在挂载 feishu connector 后必须 await 其 readiness
  promise（SDK first handshake 完成 + bot identity 已解析）才宣告 channel live；
  handshake/identity 失败 = startup fail-loud（错误上抛，runtime 不得以
  「静默重试中的半开 channel」状态宣告健康）。

BOT_IDENTITY_BEFORE_INGRESS = REQUIRED
  bot identity 未就绪不得以 unknown/null 身份继续接收（处理）群消息：
  - 正常路径：readiness（含 SDK connect 时 fetchBotIdentity）先行，事件流后至；
  - 纵深防御：若 bridge 仍收到 identity 未知的群消息（异常时序），fail-closed——
    error log + drop，绝不以 null identity 走 mention 判定
    （现状「null → mentions 全判 user → @bot 消息被误丢」是本 cutover 移除的缺陷）。

SDK_SHUTDOWN_CLEANUP = REQUIRED
  ctx.effect disposer 必须清理 SDK connection（close/disconnect）；进程退出不留
  残连。

DUAL_TRANSPORT_RUNTIME = NO
  legacy WSClient（transport.js 装配路径）从生产挂载路径删除；不存在任何配置键/
  feature flag 可同时开启 legacy 与 SDK 双 WebSocket。手工验证（standalone.mjs）
  同样只走 SDK 单连接。

RECONNECT_PRIMITIVES = SDK-OWNED
  断线重连由 SDK reconnecting/reconnected + 可选 keepalive 承担；connector 仅经
  onStatus 面上抛状态（handle.status() 语义保持）。不移植 dsh-lark liveness.ts
  （REFERENCE_ONLY）；SDK 恢复能力若在 canary 中证不足，按 §16 走后续轮。

EVENT_SURFACE = MESSAGE_ONLY
  Foundation 只注册 SDK message 事件 handler（等价现状 im.message.receive_v1 单事件面）；
  cardAction / reaction / comment / meeting 等一律不注册，生产配置不启用 onRawEvent
  catch-all。
```

connector handle 服务面（`ctx.provide('feishu', handle)`）保持：`reply(replyTarget, text,
opts)`、`replyTargetFor(ev)`、`setCallback(fn)`、`setIngressGate(fn)`、`status()`；
新增 `ready()`（readiness promise，compose await 之）。`reconnectCount()` 若 SDK 面不再
提供等价计数，允许以 onStatus 累计实现或移除（实现 PR 说明；无下游依赖）。

---

## 10. Contract 4 — Outbound compatibility

```text
OUTBOUND_DEFAULT = TEXT_BEHAVIOR_COMPAT
  Foundation 首轮以行为兼容为主：默认出站保持 msg_type:"text" 语义（SDK send 的
  text 路径）；不得无条件启用 streaming/card/markdown post/media（§5.2 Phase B 清单）。

REPLY_SEAM = PRESERVE
  既有 ReplyTarget 家族（replyTo / asThread / directChat）与 Router 出站 seam
  feishu.reply(replyTarget, text) 原样保留（Router onIngress 回执与 scheduler-router
  createFeishuDeliver 的唯一依赖）。末端实现 = ReplyTarget → SDK send options 薄映射：
    kind 'reply'         → SDK reply（channel='thread' 时 reply_in_thread=true，
                           与现状 replyInThread 语义一致）
    kind 'create_thread' → SDK create + root_id（进/开 topic thread）
    kind 'create'        → SDK create into receive_id（receive_id_type 语义保持）

REPLY_THREAD_ROUTING_PARITY = REQUIRED
  §7 GV3/GV4 的 reply 路由 parity 由出站测试锁定：thread 消息回进 thread
  （reply_in_thread），非 thread 的 inline 回复不带 reply_in_thread，
  topic conversation 的回复绝不逃逸到 group 主会话（否则发错会话 = 产品事故）。

LONG_TEXT = SDK CHUNKING ALLOWED (fidelity-only)
  SDK 的 3500 字符分块允许生效——它只影响现状本会超限失败的消息（不改变
  限内消息的单条形态），属于投递保真而非语义变化；须有测试覆盖
  「限内消息永不拆分；超限消息至少送达完整内容」。

API_ERROR_FAIL_LOUD = REQUIRED
  出站 API 错误必须 fail-loud：SDK/飞书返回非零 code 或抛错时，feishu.reply()
  必须 reject（上抛），不得像现状 api.js toResult 那样把 code/msg 静默装进
  返回值。Router onIngress 的 catch 路径（发失败回执）语义保持。

EMPTY_MESSAGE_ID_REJECTION = REQUIRED
  send/reply 成功返回但 message_id 为空/缺失 → 视为失败并 reject（结构化错误），
  不得返回「成功但无 messageId」的假成功。

DEGRADATION_MATRIX = NOT_RELIED
  Foundation 不依赖 SDK 的 target_revoked/format_error 降级矩阵与 markdown 转换
  钩子（text-only 路径不触达）；rate_limited 指数退避属 SDK 协议层职责，允许生效。
```

---

## 11. Contract 5 — Package policy

```text
SDK_VERSION_PIN = EXACT
  packages/feishu-connector/package.json 的 @larksuite/channel 必须为**精确版本 pin**
  （"0.5.0"，无 ^/~ 前缀），基线 = REVIEWED_SDK_BASELINE（0.5.0 @ d41b81c）。
  实现必须可复现：lockfile 与 package.json 一致提交。

NO_SILENT_UPGRADE = REQUIRED
  SDK 版本升级不得随普通 lockfile refresh / npm update 偷渡：exact pin 保证任何
  版本移动只能来自显式的 dependency bump commit。

SDK_UPGRADE_REVIEW = INDEPENDENT_COMPATIBILITY_REVIEW
  后续任何 SDK 版本升级（含 minor/patch）需要独立 compatibility review：对照
  本 Spec §6.5 冻结值与 §7 golden vectors 重新验证（SDK 默认值漂移、normalize
  行为变化、safety pipeline 顺序变化都是审查对象），以 amendment / 新 Spec 轮
  记录结论后方可合入。

NODE_SDK_TRANSITIVITY
  cutover 后 feishu-connector 生产代码不再直接 import @larksuiteoapi/node-sdk
  （LarkClient/WSClient/EventDispatcher 装配全部由 SDK 取代）；node-sdk 经
  @larksuite/channel 传入（其 ^1.73.0 与现状 pin 一致，无版本冲突）。若实现中
  发现必须保留直接 import，实现 PR 必须给出理由并停 OWNER_DECISION_REQUIRED。
  （test-only 差分对照代码的 import 不受此限。）
```

---

## 12. Contract 6 — Migration / rollback

```text
NO_NEW_PERSISTENT_PRODUCT_STATE = REQUIRED
  connector 不写任何新的持久产品状态：SDK dedup 使用进程内实现（不配置可注入
  持久 dedup 层）；无新 store、无新表、无 connector 侧任何落盘。

BINDING_STORE_NO_MIGRATION = REQUIRED
  Binding store 不迁移、不改写、不重键。cutover 是只读兼容（§7.2-4）。

ROLLBACK = RESTORE_PREVIOUS_VERIFIED_COMMIT
  rollback = 恢复上一已验证 deployment commit（git revert/checkout 该 deployment
  分支点）。旧 connector 恢复后对同一 Binding store 语义完全一致——连接器自包含、
  SDK 仅进程内、无状态需要清理或转换。实现 PR 必须写死回滚步骤（对齐 V2
  alignment §8 rollback 风格），禁止临场发挥。

NO_DUAL_BACKEND_FLAG = REQUIRED
  不引入长期 legacy/official 双后端 feature flag：cutover 是分支整体替换。
  允许的过渡只存在于部署序列（test app canary → 生产 app 切换），不存在于
  运行时代码的并行后端开关。

CUTOVER_GATES = GOLDEN_VECTORS + UNIT + INTEGRATION + PRODUCTION_CANARY
  生产 app cutover 前必须依序通过：
    1) golden vector 套件（§7.2）全绿；
    2) 单元测试（feishu-connector 全量 + production-runtime compose/gate）；
    3) 集成验证（standalone.mjs 或等价驱动，真实租户 test app —— feishu-test-bot
       模式 —— 上跑通 GV1/GV3/GV4 三形态的收发回路）；
    4) production canary（§14 AC15）：test app 先行；生产 app 切换后按 runbook
       观察（Binding 命中、准入拒绝、回执、重连），异常即回滚。
```

---

## 13. Implementation scope

### 13.1 首轮最小代码范围（implementation permission 覆盖面）

```text
packages/feishu-connector/          package.json（+ @larksuite/channel exact pin）/
                                    src/*（§6.2 去留清单）/ test/*（含 golden vectors）/
                                    standalone.mjs
packages/production-runtime/        src/compose.js（仅 §9 readiness await + 配套日志/
                                    失败语义）/ test/*（compose 适配）
docs/runbooks/                      （如需要）cutover + rollback runbook
```

### 13.2 默认 NO CHANGE（超出即违规）

```text
packages/agent-router/              = NO CHANGE（含 src/index.js、src/process.js、
                                      binding-store.js —— 文件 diff = 0）
Binding Store（存储/格式/语义）      = NO CHANGE
DSH Kernel / workspace-bootstrap / scheduler-router / broker / product-api /
notification-ingress / agent-provisioning = NO CHANGE
packages/production-runtime/src/v2-ingress-gate.js = NO CHANGE（0 行 diff）
任何 Binding / Agent / workspace 状态迁移 = NO CHANGE
```

### 13.3 越界处理：OWNER_DECISION_REQUIRED

若实现中发现必须超出 §13.1 范围（例如 SDK 0.5.0 配置面无法表达 §6.5 某冻结值、
Router seam 需要任何签名变化、production-runtime 需要超出 §9 的改动），实现 Agent
**不得自行扩 scope**：在实现 PR 中以 `OWNER_DECISION_REQUIRED = <问题 + 选项 + 建议>`
显式停在该点，等待 owner 裁定（裁定以本 Spec amendment 轮或 owner ruling 记录）。
本 Spec 授权的最小范围之外的一切都是未授权区域。

---

## 14. Acceptance Criteria

AC1–AC11 为任务冻结的核心验收（顺序与语义不得删改）；AC12–AC15 为本 Spec 补充的
支撑验收。

```text
AC1   EXISTING_PREBOUND_P2P_PASS
      既有 pre-bound p2p conversation：真人消息 → Agent turn → 回执到达原会话，
      全链路与 cutover 前行为一致（含 eligibility、gate 放行、turn、reply）。

AC2   EXISTING_PREBOUND_GROUP_AT_BOT_PASS
      既有 pre-bound group conversation：@bot 消息 → Agent turn → 回执；回执
      落点正确（group 主会话）。

AC3   UNBOUND_FIXED_REJECTION_PASS
      unbound conversation（binding store 无行）的 eligible 消息（p2p 或群 @bot）
      → 固定 INGRESS_GATE_REJECTED_REPLY 回执（逐字节同现状文案）；onEvent 不被调用。

AC4   NO_BINDING_AUTO_CREATION_PASS
      unbound conversation 被拒后（及整个测试窗口内），binding store 行数不变；
      无 default Binding 被创建（resolveChannelConversation 未对该 conversation 执行）。

AC5   EXISTING_BINDING_KEY_CONTINUITY_PASS
      §7 golden vectors 全绿（GV1–GV6 byte-equal）；真实 bindings.json 行回放
      getBinding 命中（§7.2-4）。既有 Binding 无迁移、无孤儿化。

AC6   TOPIC_THREAD_ROUTING_CONTINUITY_PASS
      topic thread conversation（chatId:topic:threadId 键控）路由到其自身 Binding；
      回执 reply_in_thread=true 进 thread（§10 parity 测试）。

AC7   DUPLICATE_EXACTLY_ONCE_ADMISSION_PASS
      同一事件重投（顺序重投 + in-flight 并发重投）恰好进入一次 Agent turn；
      进程内 exactly-once（SDK dedup + lock），connector 无第二层 dedup。

AC8   BOT_IDENTITY_READY_BEFORE_INGRESS_PASS
      readiness（handshake + identity）await 语义验证：identity 未解析期间群消息
      不被处理（fail-closed drop + error log）；identity 解析失败 → startup fail-loud。

AC9   NO_DUAL_WEBSOCKET_PASS
      运行时仅存在 SDK 管理的单条 WebSocket；transport.js 生产路径删除；无任何
      双连接配置形态。

AC10  AGENT_PROCESS_SINGLE_FLIGHT_UNCHANGED_PASS
      packages/agent-router 文件 diff = 0（含 process.js）；per-agent turn 串行化
      行为与现状一致（同 Agent 第二条消息在第一条 turn 完成前不进入模型）。

AC11   ROLLBACK_WITHOUT_STATE_MIGRATION_PASS
      rollback 演练：恢复上一已验证 deployment commit 后，同一 Binding store 下
      旧链路全功能回归（p2p / group / thread 收发正常），无任何状态清理/迁移步骤。

AC12   FROZEN_SDK_SEMANTICS_ENFORCED_PASS
      §6.5 六个冻结值全部生效并有测试锁定：batch delay=0（无跨消息合并）、
      chat queue disabled（单消息路径无 chat 级排队）、stale-drop disabled
      （超龄补投不丢）、requireMention=true（未声明群 no-mention 仍拦截）、
      dedup 单 authority（SDK）、connector 无自研 dedup/queue 残留于 admission 路径。

AC13   OUTBOUND_PARITY_AND_FAIL_LOUD_PASS
      text 出站行为兼容（限内单条、超限分块完整送达）；reply/thread 路由 parity
      （GV3/GV4 锁定）；API 非零 code / 异常 → feishu.reply reject；空 messageId →
      reject。

AC14   PACKAGE_PIN_NO_SILENT_UPGRADE_PASS
      @larksuite/channel exact pin "0.5.0"；lockfile 一致；CI/审查对任何非显式
      bump 的版本移动报警（实现 PR 说明执行方式，如 lockfile diff 检查）。

AC15   PRODUCTION_CANARY_BEFORE_CUTOVER_PASS
      生产 app 切换前完成 §12 CUTOVER_GATES 全序（golden vectors → unit →
      integration（test app 真实租户三形态回路）→ test app canary 观察窗）；
      canary 观察项至少含 Binding 命中率、unbound 拒绝、回执送达、重连恢复。
```

---

## 15. Explicit Non-Goals（本 Spec / Phase A 不做）

```text
per-group configurable no-mention / Typing reaction lifecycle / Markdown post 激活 /
streaming card / media-file content delivery（含附件下载落盘）/ question-plan-approval
cards —— 全部 Phase B（AGENT_CORE_LARK_UX_PHASE1_V2，§5.2）
dsh-lark 任何模块的采纳（ConversationSessions / agents ladder / /cd / model route /
liveness port 等，Investigation §4/§5.1 全表 DO_NOT_ADOPT）
openclaw-lark 任何模块的 PORT（旧 Phase1 路线整体失效，§1.3）
SDK 持久 dedup 层注入 / 任何 connector 侧新持久状态
chat queue 重启 / batching 启用 / stale-drop 启用（§6.5 冻结为 DISABLED/0）
交互卡片与 admission 式 handler 改造（Phase B 前置，§16）
Router / Binding store / Kernel / workspace-bootstrap / scheduler-router / broker 改动
（§13.2 全表 NO CHANGE）
Feishu 之外的新 channel；QR 注册（SDK registerApp）；评论/会议/卡片事件面（§9
EVENT_SURFACE = MESSAGE_ONLY）
legacy/official 双后端运行时 flag（§12）
AUTOMATIC_AGENT_BIRTH / unknown conversation 的显式绑定 provisioning（V2 §4.5
OUT_OF_SCOPE 维持）
```

---

## 16. Deferred / Open Questions（记而不决）

1. **Phase B governing spec `AGENT_CORE_LARK_UX_PHASE1_V2` 立项**：Part A 的实现路线
   裁决（(a) 推动上游 per-group requireMention vs (b) SDK requireMention=true + Agent
   Core handler 内对已声明群放行——Investigation §8.4 两条路均可行）、Part B typing
   生命周期编排（SDK 原语 + connector 编排）、Part C markdown post 激活与
   `outbound.markdownConverter` 钩子，全部留给该 Spec。
2. **交互卡片前置改造**：若 Phase B 采用交互卡片，handler 须从「await 完整 turn」改为
   admission 式（deliver 先回执、回复异步），否则同 chat card action 会排队超时
   （Investigation §6.5）——该改造在 UX_V2 内裁决。
3. **SDK 恢复能力观察**：canary 中观察 SDK reconnect/keepalive 是否存在 terminal
   give-up（dsh-lark liveness.ts 的存在动机）；若不足，以证据立项后续轮（PORT
   liveness 为候选，当前 REFERENCE_ONLY）。
4. **SeenCache 持久化**：跨重启 exactly-once 是否值得引入 SDK 可注入持久 dedup 层
   （引入即产生新持久状态，需独立 Spec 裁决）。
5. **`reconnectCount()` 服务面去留**（§9，实现 PR 顺带说明即可，非阻塞）。

---

## 17. Risks

| 风险 | 缓解 |
|---|---|
| SDK 0.5.0 处于 0.x，上游 API/默认值可能漂移 | exact pin（§11）+ 独立 compatibility review 门槛 + AC12 对默认值漂移的测试锁定 |
| normalize 边缘行为差异导致 conversationId 漂移 | golden vectors（§7）+ 真实 Binding 行回放（AC5）+ 差分对照（§7.2-3） |
| SDK 某冻结语义在 0.5.0 配置面无法表达 | §6.5 尾款：fail-loud 上报 + OWNER_DECISION_REQUIRED（§13.3），禁止近似替代 |
| SDK 恢复环 terminal give-up（dsh-lark 证据） | canary 观察项（AC15）；不足则证据立项（§16-3），不 cutover 中途即兴移植 |
| chat queue 禁用后同 chat 并发进入 gate/Router | 与现状完全一致（现状亦无 chat 队列）；AgentProcess single-flight 是唯一串行点且 diff=0（AC10） |
| 双连接/半开连接残留 | DUAL_TRANSPORT_RUNTIME = NO + AC9 + shutdown cleanup（§9） |

---

## 18. Status（Final Output）

```text
SPEC_STATUS = ACCEPTED
  （2026-08-19 acceptance finalize；metadata-only，
   SEMANTIC_CHANGE_AFTER_REVIEW = NONE。accepted 后首轮 implementation
   permission 仅覆盖 PHASE A FOUNDATION CUTOVER。）

INDEPENDENT_SPEC_REVIEW = PASS
  REVIEW_BASE_COMMIT = 6afa83c51ebaabf35703e88978556f3862edd41e
    （origin/main @ review；= REVIEWED_SPEC_COMMIT 的直接父提交，
     REBASE_REQUIRED = NO —— reviewed 字节内容即最终内容）
  REVIEWED_SPEC_COMMIT = 0ea5a39ceed5b335e627012ea5b5ea21daca4787
  REVIEWER_IDENTITY = AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1_SPEC_REVIEW
    （独立 review 运行标识，按仓库既有 REVIEW record 格式——同
     AGENT_CORE_LARK_TRANSPORT_PHASE1_V1_SPEC_RE_REVIEW /
     AGENT_PRIMARY_WORKSPACE_IMPORT_V1_SPEC_REVIEW 先例；review 事实
     （REVIEW_VERDICT = PASS / BLOCKERS = NONE / SEMANTIC_REVIEW_COMPLETE = YES）
     由 owner instruction 于 2026-08-19 交付，锚定 reviewed commit 0ea5a39）
  REVIEW_VERDICT = PASS
  BLOCKERS = NONE
  SEMANTIC_REVIEW_COMPLETE = YES
  SEMANTIC_CHANGE_AFTER_REVIEW = NONE
    （review 的五项 non-blocking notes 不折入本 Spec——只进入 PR
     implementation-watchlist / 后续 Implementation Preflight。）

SUPERSESSION_EXECUTED = YES
  （本 finalize 轮对旧 Spec 仅做 machine-readable metadata 翻转：
   docs/specs/AGENT_CORE_LARK_TRANSPORT_PHASE1_V1.md frontmatter
   status: accepted → superseded + replaced_by:
   AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1；旧 Spec 正文未动，
   保留为历史 authority，见 §1.2。）

SUPERSEDES = AGENT_CORE_LARK_TRANSPORT_PHASE1_V1
  （machine-readable：本文件 frontmatter supersedes 字段；
   旧 Spec 的 status: accepted→superseded + replaced_by 翻转属本 Spec 的
   acceptance-finalize 轮——text-only metadata，SEMANTIC_CHANGE = NONE；
   旧 Spec 保留为历史 authority，不删除、不原地改义，见 §1.2）

PHASE_SPLIT =
  PHASE A FOUNDATION CUTOVER  —— 本 Spec 首轮（唯一）implementation permission
  PHASE B UX ACTIVATION        —— 无许可；governing spec = AGENT_CORE_LARK_UX_PHASE1_V2
                                  （旧 Phase1 Part A/B/C 产品目标全部映射至此，§1.3/§5.2）

TRANSPORT_FOUNDATION = @larksuite/channel
REVIEWED_SDK_BASELINE = 0.5.0 @ d41b81c
SDK_VERSION_PIN = "0.5.0"（exact；升级需独立 compatibility review）

FOUNDATION_FROZEN_VALUES =
  SDK_BATCH_DELAY_MS = 0 / SDK_CHAT_QUEUE = DISABLED / SDK_STALE_DROP = DISABLED /
  SDK_REQUIRE_MENTION = true / CUSTOM_LRU_DEDUP = REMOVE /
  DEDUP_AUTHORITY = @larksuite/channel

PIPELINE_ORDER =
  SDK stale/dedup/global eligibility → Agent Core PREBOUND_ONLY → Router →
  Agent canonical main → SDK outbound

SCOPE =
  packages/feishu-connector/ + packages/production-runtime/（compose 仅 readiness）
  agent-router（含 src/process.js）/ Binding store / DSH Kernel /
  v2-ingress-gate.js / workspace-bootstrap = NO CHANGE
  越界 = OWNER_DECISION_REQUIRED（§13.3）

ACCEPTANCE = AC1–AC15（§14；AC1–AC11 为冻结核心，AC12–AC15 支撑）

本轮（authoring round）：
PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NONE
（本轮唯一产物 = 本 Spec 文件；未修改任何既有 Spec/Decision/Investigation/代码/配置）

本轮（acceptance-finalize round，2026-08-19）：
PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
MERGE = NONE
（改动仅限：本 Spec 的 status/acceptance/review metadata + 旧 Spec frontmatter
 status → superseded + replaced_by；正文、Contract、AC、scope、阶段划分
 相对 reviewed commit 0ea5a39 零变化——SEMANTIC_CHANGE_AFTER_REVIEW = NONE。
 FINAL_ACCEPTED_HEAD 见本轮 commit / PR 描述。）
```

---

## 19. Related

- `docs/investigations/AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1.md`（governing evidence）
- `docs/specs/AGENT_CORE_LARK_TRANSPORT_PHASE1_V1.md`（被取代；accepted、从未实现）
- `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md`（§4.5 PREBOUND_ONLY 来源）
- `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`、`AGENT_SESSION_CHANNEL_MODEL_V1.md`、
  `BINDING_AND_SWITCH_V1.md`
- `packages/feishu-connector/src/{index,core,transport,api}.js`、
  `packages/production-runtime/src/{compose.js,v2-ingress-gate.js}`、
  `packages/agent-router/src/{index.js,process.js}`（cutover 对象与 NO CHANGE 面）
- 上游：github.com/larksuite/channel-sdk-node（`@larksuite/channel@0.5.0` @ d41b81c，MIT）
- 未来：`AGENT_CORE_LARK_UX_PHASE1_V2`（Phase B governing spec，待立项）
