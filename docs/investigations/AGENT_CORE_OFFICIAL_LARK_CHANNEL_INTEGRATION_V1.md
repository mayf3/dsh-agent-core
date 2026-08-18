# AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_V1 — Investigation

- 性质：**Investigation（evidence authority，不授予实现权限）**
- 日期：2026-08-18
- 仓库：`mayf3/dsh-agent-core` · 审计基线 **origin/main = `93f9acf67cb9b4862fc9b8ffaf593630086285ba`**
- 本轮范围：**Investigation + Spec disposition ONLY**。不修改代码、不部署、不 merge、
  不安装任何插件到任何 profile、不改现网飞书应用。
- 上游基线（均已 clone 实读）：
  - `larksuite/channel-sdk-node` @ main `d41b81c350d4c4df27d26d94dcd7b24bc96cef8a`，
    package **`@larksuite/channel@0.5.0`**（README/package.json 实测）
  - `omdsh-dev/dsh-lark` @ **`bffc7306d0872f13f7c964969db323e4a66ec2f7`**，
    package **`dsh-lark-channel@0.0.6`**（package.json 实测）
- 方法：本地核心代码逐行实读 + 两个上游全量深读（源码/测试/examples）+
  决定性论断抽样复核（dsh-lark `bridge.ts:1057-1112` ladder、SDK
  `safety/index.ts:69` chatQueue 默认、dsh-lark `runtime.ts:77-85` batch 清零）。

---

## Final Output

```text
AGENT_CORE_OFFICIAL_LARK_CHANNEL_INTEGRATION_AUDIT = PASS

RECOMMENDED_FOUNDATION = @larksuite/channel

DIRECT_DSH_LARK_PLUGIN_ADOPTION = NO

OFFICIAL_CHANNEL_SDK_ADOPTION = YES
  （YES = 作为新 governing Spec 的 transport foundation 立项；
   本轮零代码/零部署/零 merge —— Investigation 不授予实现权限）

CURRENT_LARK_PHASE1_SPEC_DISPOSITION = SUPERSEDE
  （docs/specs/AGENT_CORE_LARK_TRANSPORT_PHASE1_V1.md 从未被实现；
   其冻结的实施路线「从 openclaw-lark 逐个 PORT 模块」被第一方 SDK 实质取代）

NEW_SPEC_NEEDED = YES —— AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1
  （承接 Phase1 的产品目标 Part A/B/C 语义，替换实施载体）

冻结边界核对（全部成立，见 §7）：
ROUTER_BINDING_AUTHORITY = PRESERVE
FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY = PRESERVE
ONE_AGENT_ONE_WORKSPACE = PRESERVE
CANONICAL_MAIN = PRESERVE
AGENT_SECURITY_DOMAIN = PRESERVE
SECOND_SESSION_AUTHORITY = NO / SECOND_WORKSPACE_AUTHORITY = NO
SECOND_AGENT_LIFECYCLE = NO / SECOND_BINDING_TABLE = NO
KERNEL_CHANGE = NONE / PRODUCT_CODE_CHANGE = NONE / PRODUCTION_STATE_CHANGE = NONE
```

---

## 1. 问题重述

accepted Spec `AGENT_CORE_LARK_TRANSPORT_PHASE1_V1`（2026-08-17，**未实现**——
main @ 93f9acf 的 `feishu-connector` 仍是 V0 text-only）冻结的路线是
「从 `@larksuite/openclaw-lark@2026.3.12` selective PORT 六个模块 +
REIMPLEMENT 四件」。本轮出现两个此前从未评估过的上游：

1. 飞书官方 **Channel SDK** `@larksuite/channel@0.5.0`（MIT，第一方）。
2. DSH 原生飞书插件 **`dsh-lark-channel@0.0.6`**（BSD-3，omdsh-dev）。

关键事实（第一手，package.json）：**dsh-lark 的 runtime 依赖就是
`@larksuite/channel@^0.4.1`** —— dsh-lark 本身构建在官方 SDK 之上，
其 transport 层 = 官方 SDK。两个上游不是竞争关系，而是「协议层 vs 产品层」。

先前评估空白（NEW_EVIDENCE 成立性）：`docs/investigations/openclaw-parity-v1.md`
只盘点过社区 bridge（`imetn/dsh-lark-bridge`、`xmanrui/dsh-feishu` 等），
`omdsh-dev/dsh-lark` 与 `@larksuite/channel` 均无任何 prior 评估/拒绝记录
（grep docs/ 全量核实）——本轮不是 reopen 任何 rejected 方案。

---

## 2. 三个候选的 seam map（现状 vs 官方 SDK vs dsh-lark）

| 能力（Agent Core 视角） | 现状 `@agent-core/feishu-connector`（1,242 行） | `@larksuite/channel@0.5.0` | `dsh-lark-channel@0.0.6` |
|---|---|---|---|
| WS 长连接/重连 | 自包 `transport.js` 薄壳（node-sdk WSClient；reconnect 计数实际无人触发） | ✅ connect/handshake 超时/reconnecting/reconnected + 可选 keepalive watchdog（`channel.ts:322-370`、`keepalive.ts`） | 用 SDK（`runtime.ts:96-154`）+ 自建 3min 重连看门狗（`liveness.ts`，因 SDK 恢复环有 terminal give-up） |
| 入站事件面 | 仅 `im.message.receive_v1` 一种 | ✅ message + cardAction + reaction ± + botAdded + comment + 3×meeting + `onRawEvent` 逃生口（`channel.ts:1122-1269`） | 同 SDK（`bridge.ts:135-154`） |
| 消息归一化 | 自写 ~330 行（7 种 msg_type） | ✅ 21 种 msg_type registry + merge_forward 展开 + mention 解析 + reply/thread 上下文（`normalize/registry.ts:26-52`） | 用 SDK NormalizedMessage |
| dedup | 自写 `LruDedup`（mark-**before**-dispatch，进程内） | ✅ SeenCache 双层（mark-**after**-handler + ProcessingLock 补 in-flight 窗口，TTL 12h，可注入持久层）（`safety/dedup-cache.ts`、`safety/index.ts:89,121-139`） | 用 SDK |
| mention/group 门 | `classifyIngress`（p2p/群@/thread） | ✅ PolicyGate：requireMention 默认 true + groupAllowlist + dmMode + 热更新（`safety/policy-gate.ts:23-61`）。**无 per-group requireMention**（见 §5 Part A） | 用 SDK policy + 自写 authorization.ts 窄门 |
| per-chat 串行 | 无（事件并发直达） | ✅ ChatPipeline promise 链（默认 ON，scope=chatId；card action 与 message 同 scope）（`safety/chat-pipeline.ts`、`safety/index.ts:69`） | 用 SDK（保留串行） |
| batching | 无 | 默认 ON（600ms/8条/4000字符合并）——**Agent Core 必须关**（§6） | 显式关（`runtime.ts:77-85`，delayMs=0，理由=群内 sender 错标） |
| 出站 | 仅 `msg_type:"text"`（`api.js`） | ✅ text/markdown/post/card/image/file/audio/video/share/sticker + reply/thread + 3500 字符 code-fence 感知分块 + target_revoked/format_error 降级 + rate_limited 指数退避（`outbound/sender.ts`） | 用 SDK send/stream/updateCard |
| streaming | 无 | ✅ cardkit 原生打字机（100ms/50字符双阈值 + 30k rollover + 收尾 summary）（`outbound/streaming/markdown-stream.ts`） | 用 SDK stream + 自建 CoT renderer（`cot.ts`，走 raw REST `im/v1/message_cot`） |
| reaction | 无（Phase1 Part B 计划 port openclaw-lark typing.js） | ✅ addReaction/removeReactionByEmoji（只删自己的）（`channel.ts:577-631`）+ 入站 reaction 归一化 | 用 SDK |
| 媒体上传/下载 | 无（附件只留 metadata） | ✅ 上传 SSRF guard（IP pinning、0 redirect、50MB cap、本地路径默认拒绝）+ ogg/mp4 duration 解析；下载 downloadResource（ToFile）（`outbound/media/*`） | 用 SDK downloadResourceToFile 落 inbox |
| QR 注册 | 无 | ✅ `registerApp`（node-sdk device-code flow 再导出，注册**新 app 凭据**）（`registration.ts`） | 用 SDK（onboarding 首启扫码） |
| 会话/Agent/工作区 authority | **无**（pure channel；PREBOUND_ONLY gate 在 connector，Binding 在 Router） | **无**（grep 证实：零 model 调用、零 session/workspace/agent 概念；`comments.ts:14-18` 明示边界） | **有——完整第二套**（§4） |
| 宿主耦合 | cordis 壳（inject=[]，pure） | 无宿主概念（事件回调 + 出站调用） | cordis 插件 + ctx.agents 等十余个 host 服务 |

依赖面：`@larksuite/channel` runtime deps 仅 2 个——`@larksuiteoapi/node-sdk ^1.73.0`
（**与 feishu-connector 现有 pin 完全一致**）+ `https-proxy-agent ^9`；MIT
（© 2026 Lark Technologies Pte. Ltd.）；ESM+CJS 双格式；Node ≥18。

---

## 3. Authority 分层（问题 2 的回答）

```text
层 1  飞书协议/Transport authority —— @larksuite/channel
      WS 生命周期、事件归一化、IM API 调用、重试/降级/分块、媒体、卡片、reaction。
      协议正确性的单一 owner；不含任何产品判断。

层 2  Transport eligibility —— SDK SafetyPipeline（channel-generic）
      stale-drop → dedup（SeenCache+ProcessingLock）→ PolicyGate
      （requireMention/allowlist/dmMode）→ per-chat 串行。
      这是「这条消息在协议层是否值得进 handler」，不是「这个会话归哪个 Agent」。

层 3  Agent Core PREBOUND_ONLY admission —— 不变，位置平移
      makeV2PreboundIngressGate（production-runtime/src/v2-ingress-gate.js）
      原样保留：predicate 签名、fail-closed 方向、固定回执、TOCTOU 只欠放行。
      唯一变化：挂载点从 connector 内部 pipeline 位（classify 之后、onEvent 之前）
      平移为 SDK message handler 的最前段 —— 逻辑链位置完全等价
      （仍在「channel 级资格之后、任何 Router 调用之前」）。

层 4  Router Binding authority —— 零改动
      agent-router/* 不动一行。getBinding/channelConversationId/
      resolveChannelConversation/switchAgent/deliver 全部原样。
      Binding 行继续以 feishu:<conversationId> 键控 —— 前提是 conversationId
      派生 byte-identical（§8 迁移）。

层 5  Agent / Session / Workspace authority —— 零改动
      ensureRunning 单进程单 Agent、AgentProcess per-agent single-flight、
      workspace-bootstrap 路径权威、DSH primary workspace、canonical main
      （defaultSessionId='main'）全部不动。
```

**链路证明（问题 3）**：SDK pipeline 顺序（`safety/index.ts:84-149` 实证）为
stale → dedup → policy → lock → batch → per-chat queue → `message` handler。
Agent Core bridge handler 内部：[可选 Agent Core 侧 mention 细则] →
PREBOUND_ONLY gate（unbound → 固定回执、不调 onEvent、不建 Binding）→
`router.onIngress` → `resolveChannelConversation`（gate 已证 Binding 存在，
TOCTOU 只可能欠放行）→ `ensureRunning` → `proc.turn(binding.activeSessionId)` →
`channel.send` 回执。因此：

```text
dedup / official policy → Agent Core PREBOUND_ONLY → Router → Agent canonical main
```

在官方 SDK 之下**保持成立**，且 dedup 语义强于现状（in-flight 锁 + handler
完成后才 mark，替代现状的 mark-before-dispatch）。

---

## 4. dsh-lark 审计：authority 冲突清单（问题 6 的回答——全部确认存在、全部排除）

以下机制在 dsh-lark@bffc7306 中逐一实证（抽样已第一手复核），**均不得进入
Agent Core authority**：

| 禁入机制 | dsh-lark 证据 | 判定 |
|---|---|---|
| ConversationSessions | `src/session.ts:144-438`（opened/keys/generations 表），`bridge.ts:1112` 装配 | DO_NOT_ADOPT |
| connector 层 agents.create/resume | `bridge.ts:1058-1110`：ladder `lookup/resume/create` 直接调 `ctx.agents`，create 传 `meta.cwd`+`agentOptions` | DO_NOT_ADOPT（second agent lifecycle） |
| chat-derived session ownership | `session.ts:66-95`：conversationKey = chatId / chatId:threadId / chatId:senderId → `lark-<key>` session id；epoch/workspace discriminator（`workspace.ts:104-108`、`epoch.ts:108-110`） | DO_NOT_ADOPT |
| `/cd` workspace authority | `workspace.ts:163-304`（ChatWorkspaces 持久 conversation→directory map，切换即 release agent）；`bridge.ts:1580-1623` 命令在 agent 获取**前**执行 | DO_NOT_ADOPT（second workspace authority） |
| connector-owned model selection | `model.ts:133-184`（ChatModels 持久 route map）+ `bridge.ts:851-862` modelSelection() → create/resume 的 agentOptions | DO_NOT_ADOPT |
| second Agent lifecycle | ladder + `composeChatAgent` per-agent setup/工具影子（`bridge.ts:563-636`）+ disposal sweep（`bridge.ts:2701-2723`） | DO_NOT_ADOPT |
| second Binding table | `bySession`（`bridge.ts:722`）+ `bindings`（`:1133`）+ 持久 `chatWorkspaces`/`chatModels`/`chatEpochs` 三表 | DO_NOT_ADOPT |

结构性原因（比逐条枚举更根本）：dsh-lark 是**跑在 DSH host 进程内**的 cordis
插件（inject `agents` 等），它本身就是聊天驱动的控制面。装进 Agent Core 的
production profile = 在 Router 托管的每个 per-agent DSH 进程里再造一个第二
控制面，与 Router 的进程/凭据/身份模型（DSH_PLUGIN_ADOPTION_V1 §3「Router
= BUILD 主命门」、same-uid-router-secret-boundary-audit）正面冲突。
本轮也明文禁止安装到 production profile。

---

## 5. 模块级 reuse matrix（问题 1/5 的回答）

### 5.1 dsh-lark 模块分类

| 模块 | 分类 | 依据 |
|---|---|---|
| `@larksuite/channel` 依赖（dsh-lark 的 transport） | **REUSE_AS_DEPENDENCY（直连官方 SDK，不经 dsh-lark）** | Agent Core 应直接依赖 SDK；经由 dsh-lark 间接获得只带来产品模型捆绑 |
| `runtime.ts` | DO_NOT_ADOPT | cordis activation + settings/credentials/onboarding 产品生命周期；Agent Core 有 compose.js |
| `bridge.ts` | **DO_NOT_ADOPT**（authority 部分）/ REFERENCE_ONLY（卡片 action 分发、审批 UX、reply aiming） | §4 清单所在；presentation 模式可参考 |
| `session.ts` | DO_NOT_ADOPT | ConversationSessions = SECOND_SESSION_AUTHORITY |
| `host.ts` | DO_NOT_ADOPT | 第二 agent 生命周期契约面 |
| `workspace.ts` | DO_NOT_ADOPT | /cd = SECOND_WORKSPACE_AUTHORITY |
| `model.ts` | DO_NOT_ADOPT | connector-owned model selection |
| `provision.ts` | DO_NOT_ADOPT | 独立 CLI 供给 DSH profile + launchd/systemd 单元；与 production-runtime 职责冲突 |
| `config.ts`/`credentials.ts` | DO_NOT_ADOPT | settings-service 托管态持久化；Agent Core 用部署配置 + 现有 credentialsPath 模式 |
| `authorization.ts` | REFERENCE_ONLY | 纯谓词（senderAllowlist/approvers）；未来 Agent Core 授权面可参考 |
| `cards.ts` | REFERENCE_ONLY（后续卡片 Spec 时评估 PORT） | 纯飞书卡片构建器，零 cordis/host 耦合——但 Phase1 无卡片 |
| `cot.ts` | REFERENCE_ONLY | 纯呈现（session events → AG-UI → message_cot raw REST）；依赖 host 事件形状 |
| `questions.ts`/`plan.ts` | REFERENCE_ONLY | shadow-tool 机制深度耦合 per-agent setup 组合 |
| `permission.ts` | REFERENCE_ONLY | preset picker 经 host `/permission` 命令从 idle 相执行——模式有价值，宿主耦合 |
| `files.ts` + `outbound-file.ts` | REFERENCE_ONLY（安全机制优秀，后续附件 Spec 评估 PORT） | 容器逃逸防护/文件名消毒/路径脱敏一流；但落盘位置=workspace authority，且传输半边已被 SDK 覆盖 |
| `liveness.ts` | REFERENCE_ONLY（SDK keepalive 不足时 PORT 候选） | 3min 重连看门狗 + 配额隔离，补 SDK terminal give-up |
| `cordis.patch.yml` | DO_NOT_ADOPT | DSH profile 部署管道；Agent Core 不装进 DSH profile |
| `tests/harness.ts` | REFERENCE_ONLY | fake-host 挂载模式是未来 Agent Core bridge 测试的好范式 |

### 5.2 现状 feishu-connector 模块在新 foundation 下的去留

| 现状模块 | 去向 |
|---|---|
| `transport.js`（WS 薄壳） | **DELETE**（SDK connect/keepalive 取代） |
| `core.js` `normalizeIngressEvent` 原始解析 | **DELETE**（SDK 21-type normalize 取代；换薄映射 NormalizedMessage→IngressEvent） |
| `core.js` `LruDedup`/`dedupEvent` | **DELETE**（SDK SeenCache+ProcessingLock 取代且更强——严禁双层 dedup） |
| `core.js` `classifyIngress` | **DELETE/收敛**（SDK PolicyGate 取代；Agent Core 侧仅在需要 per-group no-mention 时补细则，见 §6） |
| `core.js` conversationId 派生（`buildConversationId`/`resolveConversation`） | **KEEP（byte-identical，Binding 连续性命脉）** |
| `core.js` ReplyTarget 家族 | **KEEP**（出站语义不变；末端映射到 SDK send options） |
| `conversationWorkspaceId`/`conversationMainSessionId` 过渡载体 | **KEEP**（TRANSITIONAL 承诺不变） |
| `createIngressPipeline` 的 gate 位 | **RELOCATE**（gate predicate 原样，移入 SDK message handler 前段） |
| `api.js`（text-only reply） | **DELETE**（SDK send/reply + markdown post + 分块 + 降级取代） |
| `index.js` 挂载壳 | **REWRITE**（createLarkChannel + handler 装配；`{enabled, credentialsPath}` 挂载协议与 `ctx.provide('feishu', handle)` 服务面保持） |
| bot open_id 自解析（`index.js:153-169`） | DELETE（SDK connect 时 fetchBotIdentity） |

---

## 6. 排队语义重复性判定（问题 4）

**结论：SDK per-chat 串行 × AgentProcess per-agent single-flight = 分层组合，
不是重复；但有三条硬性配置要求 + 一条必须冻结的语义决定。**

1. **键不同、不重叠**：SDK ChatPipeline 的 scope = `chatId`（消息+卡片 action
   同 scope；评论 = fileToken），串行的是「同一 chat 的 handler 执行」
   （`safety/chat-pipeline.ts:69-82,147-178`）；AgentProcess single-flight 的
   scope = `agentId`，串行的是「同一 Agent 的 routed turn」
   （`packages/agent-router/src/process.js:302-309` promise 链）。单条消息路径
   恰好各过一条队列（先本 chat pipeline、后本 agent single-flight），
   无双重排队。
2. **必须 `safety.batch.text.delayMs = 0`（强制）**：SDK 默认 600ms 批量合并按
   **chatId** 合并，但 Agent Core 的 Binding 单位是 **conversationId**
   （`chatId` vs `chatId:topic:<threadId>` 是两个不同 Binding，却共享同一
   chatId pipeline）——跨 conversation 合并将无法路由到唯一 Binding。
   叠加 dsh-lark 已实证的群内 sender 错标问题（`runtime.ts:70-85` 注释原文）。
   dsh-lark 生产上正是这样配置的（同款决定，独立证据）。
3. **必须删除自研 dedup**（§5.2）：双层 dedup 冗余，且 SDK 的
   mark-after-handler + ProcessingLock 比现状 mark-before-dispatch 更强
   （现状崩溃 mid-processing 即永久丢单）。
4. **必须显式裁决 stale-drop 默认**：SDK 默认 30min stale 丢消息
   （`safety/stale-detector.ts` + 默认值 `safety/types.ts:30 DEFAULT_STALE_MS`）
   ——现状无此行为。停机超过 30min 后的
   补投会被静默丢弃。新 Spec 必须显式配置并在 AC 里固定（接受或调大）。
5. **必须冻结的语义决定**：message handler 若 `await` 完整 turn（现状
   Router.onIngress 语义），则该 chat 的 pipeline 槽位被占用整个 turn 时长，
   同 chat 的 card action 会排队其后（Feishu 卡片回调有超时）。Phase1 无卡片
   无影响；未来采用交互卡片时需改为 admission 式 handler（deliver 先回执、
   回复异步）。新 Spec 应显式冻结「Phase 1 handler = await 完整 turn，
   禁止交互卡片」。

---

## 7. 冻结边界逐条核对

```text
ROUTER_BINDING_AUTHORITY = PRESERVE     agent-router/* 0 行改动；Binding 行键控不变
FEISHU_V2_INGRESS_MODE = PREBOUND_ONLY = PRESERVE
                                       gate predicate 原样，仅挂载位平移（§3 层3）
ONE_AGENT_ONE_WORKSPACE = PRESERVE      workspace-bootstrap / primary workspace 不动
CANONICAL_MAIN = PRESERVE               defaultSessionId='main' 不动
AGENT_SECURITY_DOMAIN = PRESERVE        进程/凭据/broker 模型不动；SDK 不触凭据
                                       之外的东西（2 个 runtime deps，无 postinstall）
SECOND_SESSION_AUTHORITY = NO           SDK 无 session 概念（grep 实证）；dsh-lark 部分不采纳
SECOND_WORKSPACE_AUTHORITY = NO         SDK 无 workspace 概念；/cd 不采纳
SECOND_AGENT_LIFECYCLE = NO             SDK 不调 model、不建 agent；dsh-lark ladder 不采纳
KERNEL_CHANGE = NONE                    本轮零代码；未来 Spec 也只在 feishu-connector 内
PRODUCT_CODE_CHANGE = NONE              同上
PRODUCTION_STATE_CHANGE = NONE          Binding store / 现网应用 / profile 全不动
本轮未安装任何插件到任何 profile、未改代码、未部署、未 merge、未为复用
dsh-lark 绕过 Router（DIRECT_DSH_LARK_PLUGIN_ADOPTION = NO）
```

---

## 8. 最小 files-to-change / migration / rollback / AC（供新 Spec 立项，本轮不实施）

### 8.1 最小 files-to-change

```text
packages/feishu-connector/package.json        +@larksuite/channel（node-sdk 由其带入，版本同 pin）
packages/feishu-connector/src/index.js        挂载壳重写（createLarkChannel；handler=gate→onEvent）
packages/feishu-connector/src/core.js         收敛（§5.2 的 KEEP/DELETE 清单）
packages/feishu-connector/src/transport.js    DELETE
packages/feishu-connector/src/api.js          DELETE（或缩为 ReplyTarget→SendOptions 薄映射）
packages/feishu-connector/standalone.mjs      驱动重写（手工验证路径）
packages/feishu-connector/test/*              适配（ingress-gate.test 几乎原样保留）
packages/production-runtime/src/compose.js    仅挂载参数透传形状（语义零变化）
不改动：agent-router/**、v2-ingress-gate.js、workspace-bootstrap、binding-store、
        scheduler-router（feishu.reply(replyTarget,text) seam 保持）
```

### 8.2 Migration / Rollback

- **迁移前置**：conversationId 派生 golden vectors（p2p/group/thread × 现有
  fixtures + 真实 Binding 行），锁定 byte-identical。
- **cutover**：分支替换 → 测试 app（feishu-test-bot 模式）canary → 生产 app。
  Binding 行只读兼容，无状态迁移。
- **rollback**：revert 分支即可——connector 自包含、SDK 仅进程内、connector
  不写任何持久状态；旧 connector 恢复后 Binding 语义完全一致。写死回滚步骤
  （对齐 V2 alignment §8 rollback 风格），禁止临场发挥。

### 8.3 Acceptance Criteria（新 Spec 草案要点）

```text
AC1  conversationId 派生与 golden vectors byte-equal（Binding 连续性）
AC2  unbound conversation → 固定 INGRESS_GATE_REJECTED_REPLY；onEvent 不被调用；
     无 default Binding 被创建（与现状 ingress-gate.test 断言同构）
AC3  同 event 重投（含 in-flight 并发重投）恰好处理一次（SDK dedup + lock）
AC4  agent-router / v2-ingress-gate / workspace-bootstrap 文件 diff = 0
AC5  默认 requireMention=true 姿态保持（未声明群的 no-mention 消息仍被丢弃）
AC6  safety.batch.text.delayMs=0 固化（无跨消息合并——跨 conversation 路由安全）
AC7  markdown post 出站可读 + text 逃生舱；长文自动分块
AC8  无第二排队语义：单消息路径仅过 SDK chat pipeline + agent single-flight；
    connector 内无再 dedup / 再 queue
AC9  stale-drop 窗口显式配置并记录决定（默认 30min 是否接受）
AC10 handler = await 完整 turn；Phase 禁止交互卡片（card action 排队风险）
AC11 rollback 演练通过（revert 即恢复，Binding 行无损）
```

### 8.4 Phase1 三 Part 的去向（SUPERSEDE 的内容映射）

| Phase1 Part | 产品目标 | 新载体 | 变化 |
|---|---|---|---|
| A 群 no-mention | 显式声明群可免 @ 交互 | SDK PolicyGate + Agent Core 侧细则 | **SDK v0.5.0 无 per-group requireMention**（单一布尔 + groupAllowlist，`policy-gate.ts:28-41`）：需 (a) 贡献上游 per-group 覆盖，或 (b) SDK requireMention=true 保持默认 + Agent Core 在 handler 内对已声明群放行（gate 已按 conversation fail-close，安全姿态不降）。两条路都可行，新 Spec 裁决 |
| B typing/ack reaction | 处理中可见反馈 | `channel.addReaction/removeReactionByEmoji`（`channel.ts:577-631`） | 原计划 port openclaw-lark typing.js/reactions.js + 自写生命周期 → 仅剩生命周期编排（SDK 原语直接可用） |
| C markdown post | 富文本出站 | `send({markdown})` + markdownToPost + 分块 + 降级 + `outbound.markdownConverter` 钩子 | 原计划 port markdown-style.js/deliver.js 纯 Lark 部分 → 全部内置，且多出 streaming 能力 |

### 8.5 是否需要新 Spec

**需要：`AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1`。** 理由：
(a) Phase1 的采购决策（§8 PORT/REUSE/REIMPLEMENT 全表）整体失效——该 Spec
的实质内容就是「从 openclaw-lark 移植什么」，foundation 更换后无处安放；
(b) 新增的排队/dedup/stale 语义决定（§6）与 SDK 默认面需要自己的冻结文本；
(c) 按 `.agents/README.md` 规则 6，方向实质改变走 SUPERSEDE；Phase1 未实现，
supersede 零实现成本。SUPERSEDE 而非 AMEND 的判定依据：Phase1 §2/§8 的
reference 基线（openclaw-lark@2026.3.12）与 PORT 清单是该 Spec 的骨架而非
脚注。

---

## 9. 证据索引（决定性引用）

本地（origin/main @ 93f9acf）：

- `packages/feishu-connector/src/index.js:22-46,135-214,229-268`（V0 挂载、
  im.message.receive_v1 单事件、ingress gate wiring、`ctx.provide('feishu')`）
- `packages/feishu-connector/src/core.js:314-382,401-425,577-653,668-682,694-768`
  （normalize、transitional 载体、LruDedup、classifyIngress、固定回执、pipeline）
- `packages/feishu-connector/src/transport.js` / `src/api.js`（text-only 出站）
- `packages/production-runtime/src/compose.js:163-196`（FEISHU_CREDS_PATH 挂载 +
  wireV2IngressGate fail-loud）
- `packages/production-runtime/src/v2-ingress-gate.js:62-110`（PREBOUND_ONLY
  predicate：getBinding + primary-workspace 校验 + fail-closed）
- `packages/agent-router/src/index.js:140-161,346-376,416-466,498-614,636-688,725-784`
  （namespace 语义、first-contact、switchAgent、ensureRunning 双 spawn 不变量、
  onIngress、Delivery V0）
- `packages/agent-router/src/process.js:302-309`（per-process single-flight）
- `docs/specs/AGENT_CORE_LARK_TRANSPORT_PHASE1_V1.md`（accepted、未实现）
- `docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md:226-286`（§4.5）
- `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md`（ONE_AGENT_ONE_WORKSPACE 等）
- `docs/investigations/openclaw-lark-transport-reuse-v1.md`（Phase1 依据：
  DIRECT_DEPENDENCY_RECOMMENDED=NO；Open Q5「推动 upstream 收口独立 package」）
- `docs/decisions/DSH_PLUGIN_ADOPTION_V1.md`（proposed；Router=BUILD 主命门）

上游 @larksuite/channel@0.5.0（d41b81c）：README（定位/能力表）、
`src/channel.ts:216-394,446-485,577-631,1053-1096,1122-1269`、
`src/safety/{index,policy-gate,dedup-cache,chat-pipeline,processing-lock,stale-detector,loop-guard}.ts`、
`src/outbound/{sender,retry,errors}.ts`、`src/outbound/media/*`、
`src/outbound/streaming/*`、`src/normalize/registry.ts`、`src/registration.ts`、
54 个测试文件（dedup/queue/policy/stream/SSRF/分块/降级全覆盖）。

上游 dsh-lark@bffc7306：`src/{runtime,bridge,session,host,workspace,model,permission,files,outbound-file,cards,cot,questions,plan,liveness}.ts`、
`cordis.patch.yml`、`tests/harness.ts`（fake-host 挂载）。

---

## 10. 相关

- 被裁定 disposition 的 Spec：`docs/specs/AGENT_CORE_LARK_TRANSPORT_PHASE1_V1.md`
- 建议新 Spec：`AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V1`（待立项草案 §8）
- 上游：github.com/larksuite/channel-sdk-node（MIT）、github.com/omdsh-dev/dsh-lark（BSD-3）

---

## 11. 交付核验（INVESTIGATION_DELIVERY round，2026-08-19）

```text
DELIVERY_BASE_MAIN = 93f9acf67cb9b4862fc9b8ffaf593630086285ba
  （fetch 后 origin/main 未前进 —— 与调查基线同一 commit，零事实漂移；
   产品结论未被 main 前进影响，无需改写）

CITATION_VERIFICATION =
  本仓库（mayf3/dsh-agent-core @ 93f9acf）：全部引用逐行核对（本地全量实读）
  larksuite/channel-sdk-node @ d41b81c350d4c4df27d26d94dcd7b24bc96cef8a：
    逐锚点核对；修正 1 处（safety/index.ts:68 -> :69，chatQueue 默认行）；
    精化 1 处（stale 默认值补 safety/types.ts:30 DEFAULT_STALE_MS）
  omdsh-dev/dsh-lark @ bffc7306d0872f13f7c964969db323e4a66ec2f7：
    逐锚点核对（bridge.ts 1058/1066/1081/1112/722/1133/563/851/1623/2701-2723、
    session.ts 66/93/144、workspace.ts 104/163、epoch.ts 108、model.ts 133、
    runtime.ts 80-85、package.json:70）——全部命中，零修正

INDEX_REGISTRATION = NOT_REQUIRED
  （docs/README.md 文档地图仅覆盖最初五份调查；此后全部新调查均未登记，
   且 AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1 明文「不建中央 INDEX」）

本轮改动面 = 仅本文件（新增交付核验 + 2 处引用精化）；
未修改 docs/specs/、packages/、production 配置、任何 accepted Spec。
```
