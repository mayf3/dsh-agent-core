# Agent Core on DSH — Feishu Connector V0 调查报告

> 状态：已完成 · 报告人：coding subagent · 日期：2026-08-14
> 范围：**纯 channel 层** Feishu/Lark 连接器 V0，只做消息进出，不触碰 Router / Agent / DSH session。
> 交付物：`packages/feishu-connector/`（新）+ 本报告 `docs/reports/feishu-connector-v0.md`。

---

## 1. 目标与范围

在 DSH-based Agent Core 仓库中新增一个独立的 Feishu Connector V0，作为后续把旧
Agent Core「外部消息送入」通道（旧 Feishu connector → Kernel `/v1/ingress`）替换为
DSH 通道链路的最底层积木。V0 只建立并维护飞书 WebSocket 长连接、把入站消息规范化为
统一的 `IngressEvent`、按 `event_id` 去重、并对出站回复提供统一 `ReplyTarget` 结构 + `reply()` 方法。

### 明确负责

1. WebSocket 长连接（飞书官方 SDK `@larksuiteoapi/node-sdk` 的 `WSClient`）
2. message/event normalization → 统一 `IngressEvent`（纯数据、可 JSON 序列化）
3. conversation / chat / thread 标识统一（p2p / 群聊 / topic 线程）
4. sender 元数据（open_id / union_id / user_id / 名称 / 是否 bot 自身 / 是否被 @）
5. dedup（按 `event_id`，进程内 LRU，接口可换持久化实现）
6. attachments 基础解析（image/file/audio/video/sticker → 统一结构，不负责下载）
7. outbound reply（`ReplyTarget` + `reply(target, text, opts)`，走 SDK `im` API）
8. reconnect / heartbeat / 连接状态事件 / 重连计数 / 失败告警 / 优雅关闭

### 明确不负责（绝对不做）

- 不创建 DSH agent、不投递 session、不调用 `ctx.agents` / router / owner-guard
- 不做 Auth / principal 解析、不做任何授权判断
- 不管理 process spawn / 进程生命周期
- 不修改：`packages/router/`、`packages/owner-guard/`、`bundle/`、`profile/`、
  `scripts/`、根 `README.md`、`docs/` 下除本报告外的任何文件、DSH checkout（只读）

---

## 2. 架构与文件清单

保持核心逻辑与 DSH / Cordis **解耦**：`src/core.js` 零 DSH 依赖、纯函数，可独立测试；
只有 `src/index.js` 是 Cordis 插件壳。

```text
packages/feishu-connector/
├── package.json          # @agent-core/feishu-connector；deps: @larksuiteoapi/node-sdk ^1.73.0
├── src/
│   ├── core.js           # 纯逻辑：normalize / dedup / ReplyTarget / 事件分类 / 附件解析（零 DSH 依赖，可独立测试）
│   ├── transport.js      # SDK WS 客户端封装（连接/重连/心跳/状态事件/优雅关闭）
│   ├── api.js            # 出站回复（SDK im.message.reply / create 调用）
│   └── index.js          # Cordis 插件壳（name/inject/Config/apply）
├── standalone.mjs        # 不经 DSH 的直连演示/验证脚本（读本机 OpenClaw 配置（channels.feishu）凭据）
└── test/
    ├── fixtures.js       # 真实形状的 im.message.receive_v1 事件 fixtures
    ├── core.test.js      # 规范化 / 标识 / dedup / 附件 / 分类
    ├── api.test.js       # 出站请求构造
    └── transport.test.js # 连接状态机 / 重连 / 断连后消息仍处理
```

### 分层职责

| 文件 | 职责 | 依赖 |
|---|---|---|
| `src/core.js` | 事件规范化、conversation/thread 标识、sender/mention/附件元数据、LRU dedup、`ReplyTarget` 构造、事件分类 | 零（纯函数） |
| `src/transport.js` | 包装 `Lark.WSClient`：start/stop、连接状态机、重连计数、onEvent 路由 | 仅 SDK（可注入 mock） |
| `src/api.js` | 把 `ReplyTarget` 映射为 `im.message.reply/create`；`textContent` 构造文本 | 仅 SDK Client |
| `src/index.js` | Cordis 壳：读配置 → 建 client/ws/dispatcher → 注册 `im.message.receive_v1` → 经 core 规范化+去重+分类 → 回调 onEvent；暴露 `handle.reply()` | Cordis `ctx`（未用 DSH 专用服务） |

`inject = []`：V0 不依赖任何 DSH 核心服务；入站通过 `Config.onEvent` 回调暴露，谁挂载
该插件谁决定投递到哪。

---

## 3. IngressEvent / ReplyTarget 结构

### 3.1 IngressEvent（`normalizeIngressEvent` 输出，纯数据、可 JSON 序列化）

```text
{
  eventId:        string,   // Feishu header.event_id（规范化前）
  type:           'message',
  subType:        'text'|'image'|'file'|'audio'|'video'|'sticker'|'other',
  channel:        'p2p'|'group'|'thread',      // 统一 channel 分类
  chatType:       'p2p'|'group',
  conversationId: string,   // 规范 conversation 标识（见下）
  chatId:         string,   // Feishu chat_id（oc_*）
  threadId?:      string,   // 仅 topic 线程（omt_*）
  rootMsgId?:     string,   // 线程根消息
  parentMsgId?:   string,
  messageId:      string,   // Feishu message_id（om_*）
  messageType:    string,   // 原始 message_type
  sender: {
    openId, unionId?, userId?, senderType, name?,
    isBotSelf: boolean, selfSent: boolean, senderId: string
  },
  text:          string,    // 规范化文本（text/post 平铺；image/file 等为占位符）
  mentions:      [ { key, openId, unionId?, userId?, name, type: 'all'|'user'|'bot' } ],
  mentioned:     boolean,   // 消息含 @all 或 @bot 自身
  addressed:     boolean,   // p2p 恒 true；群/线程=mentioned
  attachments:   [ { type, fileKey, name?, sizeBytes?, duration?, coverImageKey?, downloadHint } ],
  raw:           object,    // 原始 event（供上层取 detail）
  timestamp:     number,    // 毫秒 epoch
  dedupKey:      string,    // event_id（缺省回退 message:message_id）
}
```

### 3.2 conversation / chat / thread 标识

- `buildConversationId({ chatId, scope, threadId, senderOpenId })`
  - p2p/group → 直接 `chat_id`
  - thread（topic）→ `` `${chatId}:topic:${threadId}` ``
  - （预留）sender-scoped `` `${chatId}:sender:${openId}` ``
- `resolveConversation(event)` 把 `im.message.receive_v1` 映射到 `{channel, chatType, conversationId, chatId, threadId, rootMsgId}`：
  群内带 `thread_id` 的消息 → `channel='thread'`（保留独立线程标识 + 根消息）；
  否则归入 p2p / group 会话。

### 3.3 ReplyTarget（`buildReplyTarget` / `replyTargetFor(ev)`）

```text
replyTarget.replyTo(messageId) → { kind:'reply',   replyMsgId, receiveIdType:'chat_id',
                                    receiveId: chatId, replyInThread:<channel==='thread'> }
replyTarget.asThread()          → { kind:'create_thread', rootMsgId, replyInThread:true }
replyTarget.directChat(id,type) → { kind:'create',  receiveId, receiveIdType }
```

`reply(client, target, text, opts)` 出站映射：
- `kind='reply'` → `im.message.reply({ path:{message_id}, data:{ content, msg_type:'text', reply_in_thread? } })`
- `kind='create'/'create_thread'` → `im.message.create({ params:{receive_id_type}, data:{ receive_id, content, msg_type, root_id? } })`

---

## 4. 验证结果

### 4.1 Mock 单测（node:test，零依赖）

测试命令（在 `packages/feishu-connector/` 下）：

```bash
node --test
```

结果：**25 pass / 0 fail**（首跑基线后两次修复 fixture 断言与文本解析边界，最终全绿）。

| # | 验收项 | 测试 | 结果 |
|---|---|---|---|
| 1 | 收消息 → 规范化 IngressEvent（p2p） | `p2p message normalizes to IngressEvent (channel=p2p)` | ✅ |
| 1b | 收消息 → 规范化 IngressEvent（group + @bot） | `group message with bot mention...` | ✅ |
| 2 | 回复出站请求构造（conversation_id、thread 参数） | `reply() posts via im.message.reply...` + `direct chat create posts conversation_id...` | ✅ |
| 3 | 群聊标识（chat_id、chat_type=group，未提及不转发） | `group chat identifier keeps chat_id and classifies as group` | ✅ |
| 4 | 私聊标识（chat_type=p2p） | `p2p conversation identifier is the plain chat id` | ✅ |
| 5 | thread（thread_id / root 消息保留） | `thread message preserves thread_id / root message...` | ✅ |
| 6 | duplicate event（同一 event_id 二次丢弃） | `same event_id is deduplicated a second time` + LRU eviction | ✅ |
| 7 | disconnect → reconnect（重连触发、状态事件、重连后消息仍处理） | `after a reconnect, a message is still ingested and deduped` + `notification of reconnect...` | ✅ |

补充覆盖：附件解析（image/file）、sender 元数据（bot 自身 / id）、mentions（all/user/bot）
、bot 自回声不转发、非法事件抛错、优雅关闭、`textContent`。

### 4.2 真实验证（已完成 ✅，2026-08-14 人工配合验收）

凭据来源：本机 OpenClaw 配置 → `channels.feishu`（`appId=cli_a907e...`、
`connectionMode=websocket`、`enabled=true`）。凭据仅由 `standalone.mjs` 在运行时读取，
**未写入任何输出 / 文件**。

| 项 | 结果 | 说明 |
|---|---|---|
| **连接建立** | ✅ 成功 | `standalone.mjs` 起长连接：`client ready` → `event-dispatch is ready` → `connected (long connection established, heartbeat handled by SDK)` → `[ws] ws client ready`。连接保持 30s 无断线。说明 SDK 长连接已连同**心跳/保活**由 SDK 负责。 |
| **心跳/重连** | ✅（SDK 内置） | 长连接模式心跳与断线重连由 SDK `WSClient` 内置；插件层 `transport` 额外提供状态事件 / 重连计数 / onReconnect 钩子（已 mock 测试）。真实链路多次重启（kill 后重连、修复后重启）均成功建立。 |
| **收消息（p2p 私聊）** | ✅ 已验收 | 用户私聊发 `hi` → `[standalone] ingress channel=p2p chat=oc_9dd74b9ed02ce216951260a381eb502d sender=ou_1e4... text="hi" forward=true`。 |
| **收消息（group 群聊）** | ✅ 已验收 | 用户在大侠-小虾米群（`oc_92332c45c1cac2ef...`）@bot 发消息 → `channel=group ... text="@_user_1 hi" forward=true`。 |
| **收消息（thread 话题）** | ✅ 已验收 | 用户在群内话题回复 → `channel=thread chat=oc_92332c45... text="@_user_1 hi" forward=true`（thread 正确分类、@bot 识别）。 |
| **出站回复** | ✅ 已验收 | 用入站获得的 chat_id（`oc_9dd74b...`，p2p）经 `api.reply()` 发送测试文本 → **`code:0 success`**，返回真实 `messageId=om_x100b68c68e407ca4c25d537c765ba4b`，用户实际收到 bot 回复。 |
| **@bot 识别（含修复）** | ✅ 已验收 | 最初 `@_user_1 hi` 被判 `forward=false`（`botOpenId` 未解析，@bot 归类为 user）；修复（启动时经 `bot/v3/info` 解析 bot 自身 open_id 传入 normalize）后三条真实消息全部 `forward=true`。 |
| **duplicate event** | ✅ mock 覆盖 | 真实环境无法自造重复事件；`LruDedup` 已 mock 测试（同一 event_id 二次丢弃 + LRU 淘汰）。 |
| **disconnect → reconnect** | ✅ mock 覆盖 + 真实重启 | mock 状态机测试（重连触发、状态事件、重连后消息仍处理）；真实链路多次 kill/重启连接均成功。 |
| **OpenClaw 冲突** | 已查明并解除 | 最初怀疑 OpenClaw 抢消息——实际是**旧 agent-core 的 feishu connector 在 Lima 虚拟机内运行**，用同一 app 长连接分流事件（gateway 日志 dispatch 为另一 app（OpenClaw 本体）的正常业务）。已 `systemctl --user stop+disable` 对应 feishu connector 服务 并确认无残留进程。 |

**验收结论**：p2p / group / thread 三条入站规范化链路、出站 reply、@bot 识别、连接保活全部在真实飞书环境验证通过；duplicate 与断连重连由 mock 测试覆盖。遗留事项（非阻塞）：真实群聊+话题场景下 `reply_in_thread`/`root_id` 出站组合复核（§6.1）。

---

## 5. 已知限制

- **open_id 跨 app 无效**：文档/环境的 `FEISHU_USER_ID` 属于旧 app 作用域；真实出站投递已改用
  本 app 作用域内获得的 `chat_id`（入站事件的 conversationId）完成验证。
- **入站需人工配合**：真实入站（p2p/group/thread）已通过用户配合验收（见 §4.2），
  无法用 API 自造消息这一限制依然存在。
- V0 只发 `msg_type='text'`；富文本 / 卡片 / @mention 出站不在范围。
- 附件只解析元数据（fileKey / name / size / downloadHint.endpoint），**不下载内容**。
- dedup 为**进程内 LRU**；进程重启后不保留（接口 `check/record` 已抽象，可换 JSONL/Redis 持久化）。
- thread 语义：topic 线程（`thread_id`）与内联回复（`root_id`/`parent_id`）已在 V0 区分并保留，
  但「回复落在哪一层」的完整策略（reply_in_thread vs root 语义）仍待业务层最终确认。

## 5b. 集成修复记录（主 Agent 完整 DSH 进程挂载验证发现）

在真实 DSH 进程挂载（`dsh CLI --profile` + 独立 `DSH_HOME`）时发现并修复两个加载问题：

1. **`Config` 必须是 schemastery schema**（原为普通对象）：Cordis loader 的 `resolveConfig`
   调用 `config.validate`，普通对象导致 `Cannot read properties of undefined (reading 'validate')`。
   修复：`Config = z.object({ appId, appSecret, credentialsPath, enabled, dedupSize })`
   （`@deepseek-ai/schemastery` 加入 peerDependencies）；`onEvent`/`onStatus`/`log` 函数回调
   移入 `DEFAULTS` 对象（schemastery `z.object` 对未知键透传，程序化注入不受影响）。
2. **`ctx.effect(...)?.catch` 非法**（`ctx.effect` 返回 disposer 函数而非 Promise）：
   连接启动错误处理移入 effect 内部 try/catch，错误重新抛出交由 Cordis 处理。

修复后验证：25/25 单测通过；完整 DSH 进程挂载成功 —— `feishu-transport: connected`
（长连接建立）+ 停止时优雅断开（`ctx.effect` disposer 生效），无加载错误。

## 6. 未决问题

1. **thread 语义**：Feishu 的「topic 线程」（`thread_id=omt_*`）与「内联回复」（`root_id`）
   在 V0 已分开建模，但出站时 `reply_in_thread` / `root_id` 的组合是否覆盖所有飞书话题场景
   需在真实群 + 话题场景下复核。
2. **附件下载**：`downloadHint` 只标记 endpoint 与 key，尚未实现按 fileKey 通过
   `im/v1/images` / `im/v1/files` 下载内容的调用（V0 明确不做，下一步可加）。
3. **dedup 持久化**：当前进程内 LRU，重连后内存仍有效但进程重启丢失；`event_id` 之外是否要加
   `message_id` 双键留待与增量/幂等设计对齐。
4. **sender 名称解析**：sender 的 display name 需调用用户 API（`batch_get_id`）解析，V0 仅透传
   raw 里的 name 字段；名称解析留待上层。

## 7. 下一步

1. 真实入站验证（见 §4.2 步骤），确认 p2p/group/thread 三条入站规范化链路在真实事件下正确。
2. 用本 app 内一次入站事件拿到的 `sender.open_id` 完成一次真实出站 `reply()` 到 p2p。
3. 把 `handle.reply()` 从 channel 层接到上层（router / Agent inbox），事件经 `onEvent` 投递。
4. 若需要，把 dedup 换成持久化后端（JSONL/Redis），复用 `LruDedup.check/record` 接口。

---

### 变更清单

- 新增：`packages/feishu-connector/`（package.json、src/{core,transport,api,index}.js、standalone.mjs、test/{fixtures,core,api,transport}.test.js）
- 新增：`docs/reports/feishu-connector-v0.md`（本报告）
- 未修改任何受限路径。
