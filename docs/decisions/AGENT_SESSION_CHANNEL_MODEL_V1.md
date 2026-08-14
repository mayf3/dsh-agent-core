# Agent / Session / Channel / Binding 模型与 API 契约 — Agent Core V1

- 状态: proposed（候选决策，供主线 PR / 总装评审；**不实现后端**）
- 日期: 2026-08-15
- 类型: 正式候选决策（产品模型 + 前后端 API 契约）
- 机器可读契约: [`AGENT_SESSION_CHANNEL_MODEL_V1.api.json`](AGENT_SESSION_CHANNEL_MODEL_V1.api.json)（Android 可直接 mock）
- 关联: `docs/decisions/README.md` D-001

## 0. 一句话总结

Agent 是长期实体，固定拥有自己的 workspace / DSH_HOME / credential / memory；Session
挂在 Agent 之下（`main` 为长期主会话）；飞书、微信、Android、Web 都只是 Channel / UI，
不拥有 Agent 也不拥有 Session；「当前正在和谁聊」由 ChannelConversation 上的 **Binding**
表达——「叫论文导师来 / 换回来」= `switchAgent(channelConversationId, agentId, sessionId?)`，
纯绑定切换，不是角色扮演。渠道只有原生标识（如飞书 chatId）时，经幂等
`resolveChannelConversation(channel, externalId)` 一步拿到 ChannelConversation +
Binding，随后直接 dispatch。API 与任何具体渠道无关。

## 1. 背景与原则

背景：Agent Core V1 需要统一的 Channel / Agent / Session 产品模型，作为 Router /
控制面、渠道适配器（如 feishu-connector）与各端 UI（飞书/微信/Android/Web）之间的
共同契约，避免每个渠道各自发明一套「会话归属」语义。

原则：

1. **Agent 是长期实体。** Agent 固定拥有自己的 workspace / DSH_HOME / credential /
   memory；其存在与生命周期不依赖任何 Channel。这些资源由控制面 per-agent supervisor
   承载，V1 API 不暴露（见 §2.1）。
2. **一个 Agent 下有多个 Session。** `main` 是长期主会话（随 Agent 预置，不可删除/
   归档）；其他 Session 可以新建、归档、定期清理。
3. **Channel 只是 Channel / UI。** 飞书、微信、Android、Web 都只是传输与展示层。
   Channel 不拥有 Agent；Channel 不拥有 Session。
4. **「切换」只是改绑定。** UI 动态切换当前正在聊天的 Agent = 修改该
   ChannelConversation 的 Binding 的 `activeAgentId`（+ `activeSessionId`）。没有角色
   扮演，不复制、不移动任何 Agent / Session。
5. **API 与渠道无关。** 契约中渠道标识是不透明字符串（`channel`），不存在飞书/微信/
   Android/Web 专有类型或字段；渠道适配器负责外部标识 ↔ `ChannelConversation` 的映射。

## 2. 实体模型

最小实体集：**Agent、Session、ChannelConversation、Binding**。
`Message` 是 API 数据类型（sendMessage/getMessages 需要），不作为第五个实体、不进入
Agent/Session 生命周期。

### 2.1 Agent（长期实体）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 全局唯一不透明 id，如 `agt_01JQ…`；客户端不得解析 |
| `name` | string | 是 | 展示名（如「论文导师」） |
| `avatar` | string \| null | 是 | 头像 URL；无头像为 null |
| `description` | string \| null | 否 | 一句话介绍，展示用；缺省 null |

隐含所有权（V1 API 不暴露）：workspace / DSH_HOME / credential / memory 由 Agent 实体
拥有，由控制面 per-agent supervisor 承载。API 只把 Agent 当「身份 + 展示」对象。

### 2.2 Session（属于 Agent）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 全局唯一不透明 id，如 `ses_…` |
| `agentId` | string | 是 | 所属 Agent |
| `title` | string | 否 | 会话标题；createSession 可指定，缺省由系统生成 |
| `kind` | enum `main` \| `normal` | 是 | `main`：随 Agent 预置的长期主会话，每个 Agent 恰好一个；`normal`：普通会话 |
| `createdAt` | string (ISO8601) | 是 | 创建时间 |
| `lastActiveAt` | string (ISO8601) | 是 | 最近一次收发消息时间；用于排序与清理决策 |

### 2.3 ChannelConversation（渠道侧会话）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 内部全局唯一 id，如 `ccv_…` |
| `channel` | string | 是 | 不透明渠道标识，API 不解释其值（如 `"feishu"` / `"wechat"` / `"android"` / `"web"`） |
| `externalId` | string | 是 | 渠道原生会话标识（如飞书 chat_id、Android 会话 key） |
| `title` | string | 否 | 展示标题，可选 |
| `createdAt` | string (ISO8601) | 是 | 首次在该渠道建立会话的时间 |
| `lastActiveAt` | string (ISO8601) | 是 | 最近活跃时间 |

### 2.4 Binding（ChannelConversation → 当前 (agent, session)）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `channelConversationId` | string | 是 | 主键；每个 ChannelConversation 至多一条 Binding |
| `activeAgentId` | string | 是 | 当前正在聊的 Agent |
| `activeSessionId` | string | 是 | 当前正在聊的 Session；必须属于 activeAgentId（由 switchAgent 保证） |
| `updatedAt` | string (ISO8601) | 是 | 最近一次切换时间 |

### 2.5 Message（API 数据类型）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 全局唯一，如 `msg_…` |
| `agentId` | string | 是 | 所属 Agent |
| `sessionId` | string | 是 | 所属 Session |
| `role` | enum `user` \| `assistant` | 是 | 发送方 |
| `content` | string | 是 | 文本内容 |
| `createdAt` | string (ISO8601) | 是 | 消息时间 |

## 3. 生命周期与规则

- **Agent**：预置时自动创建其 `main` session；Agent 的生命周期不随任何 Channel 的增减
  而改变。
- **Session（normal）**：`createSession` 新建；`archiveSession` 软归档（默认列表隐藏）；
  `deleteSession` 硬删除（仅 normal）。`main` 不可归档、不可删除。
- **定期清理**：归档超过保留期的 normal Session 由控制面定期清理。保留期是**配置**
  （建议默认 30 天），不是 API 参数。
- **ChannelConversation / Binding 落地入口**：渠道适配器收到入站消息（只有渠道原生
  标识，如飞书 chatId）时，调用幂等接口 `resolveChannelConversation(channel,
  externalId)`，一步拿到 ChannelConversation + Binding（即当前 (agentId,
  sessionId)），随后按 Binding dispatch。(channel, externalId) 唯一；已存在则返回
  原对象，不存在则创建，并在创建时同时建立「默认 Agent + 其 main session」的初始
  Binding（开箱可用）；显式 `switchAgent` 总是覆盖 Binding。渠道适配器不保存任何
  Agent / Session 状态。
- **switchAgent 语义（定案）**：只写 Binding。`sessionId` 未传时**固定进入目标 Agent
  的 `main` session**。校验：agent 存在、session 属于该 agent 且未归档。不创建、不
  移动、不复制任何 Agent/Session，不产生任何「角色扮演」状态。
- **「换回来」不进入 V1 后端模型**：Binding 不保存切换 history / stack；「换回来」=
  客户端保存之前的 (agentId, sessionId) 后再次调用 `switchAgent`，后端无记忆。
- **getBinding**：无绑定 → `404 BINDING_NOT_FOUND`（客户端据此决定先 switchAgent 或
  调用 resolve 等待自动绑定）。

## 4. API 契约

Base: `https://<host>/v1` · HTTPS · JSON。全部端点如下（机器可读版见
`AGENT_SESSION_CHANNEL_MODEL_V1.api.json`）：

| # | 函数 | HTTP | 路径 | 请求体 / 参数 | 成功响应 |
|---|---|---|---|---|---|
| 1 | `listAgents` | GET | `/agents` | — | 200 `{"agents": Agent[]}` |
| 2 | `getAgent` | GET | `/agents/{agentId}` | — | 200 `Agent` |
| 3 | `listSessions` | GET | `/agents/{agentId}/sessions?includeArchived=false` | query: `includeArchived` | 200 `{"sessions": Session[]}`（lastActiveAt 降序） |
| 4 | `createSession` | POST | `/agents/{agentId}/sessions` | `{"title"?: string}` | 201 `Session`（kind=normal） |
| 5 | `getMainSession` | GET | `/agents/{agentId}/sessions/main` | — | 200 `Session`（kind=main，保证存在） |
| 6 | `archiveSession` | POST | `/agents/{agentId}/sessions/{sessionId}/archive` | — | 200 `Session`（已归档） |
| 7 | `deleteSession` | DELETE | `/agents/{agentId}/sessions/{sessionId}` | — | 204 空 |
| 8 | `sendMessage` | POST | `/agents/{agentId}/sessions/{sessionId}/messages` | `{"content": string, "clientMessageId"?: string}` | 201 `Message`（role=assistant，即本次回复） |
| 9 | `getMessages` | GET | `/agents/{agentId}/sessions/{sessionId}/messages?limit=50&before=<msgId>` | query: `limit`, `before` | 200 `{"messages": Message[], "hasMore": boolean}` |
| 10 | `getBinding` | GET | `/bindings/{channelConversationId}` | — | 200 `Binding` |
| 11 | `switchAgent` | PUT | `/bindings/{channelConversationId}` | `{"agentId": string, "sessionId"?: string}` | 200 `Binding` |
| 12 | `resolveChannelConversation` | PUT | `/channel-conversations/resolve` | `{"channel": string, "externalId": string, "title"?: string}` | 200/201 `{"channelConversation": ChannelConversation, "binding": Binding}` |

说明：

- **`resolveChannelConversation` 是渠道落地入口（幂等）**：(channel, externalId)
  唯一；已存在返回原 ChannelConversation（200），不存在则创建（201）并同时建立
  「默认 Agent + main session」的初始 Binding。
  **飞书只有 chatId 时一步得到 (agentId, sessionId) 的方法**：调
  `PUT /v1/channel-conversations/resolve`，body
  `{"channel": "feishu", "externalId": "<chatId>"}`，响应中的
  `binding.activeAgentId` / `binding.activeSessionId` 即当前正在聊的
  (agent, session)，渠道可直接 dispatch；渠道适配器无需保存任何 Agent / Session
  状态。
- `clientMessageId`（可选）：移动端重试去重——同一 clientMessageId 重复提交不重复产生
  assistant 回复。
- 消息为同步契约：`sendMessage` 返回完整的 assistant 回复 `Message`。流式
  （SSE/WebSocket）V1 不做（见 §7 开放问题 2）。
- `getMessages` 返回升序消息；`before` = 客户端已持有最旧一条的 id，向前翻页。

错误（统一 `{"error": {"code": "...", "message": "..."}}`）：

| code | HTTP | 场景 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 参数缺失 / 格式错误（含 resolve 缺 `channel` / `externalId`） |
| `SESSION_NOT_IN_AGENT` | 400 | sessionId 不属于路径中的 agentId |
| `MAIN_SESSION_PROTECTED` | 403 | 对 main session 执行 archive / delete |
| `AGENT_NOT_FOUND` | 404 | agentId 不存在 |
| `SESSION_NOT_FOUND` | 404 | sessionId 不存在 |
| `BINDING_NOT_FOUND` | 404 | 该 ChannelConversation 尚无 Binding |
| `ARCHIVED_SESSION` | 409 | 对已归档 session 发消息或切换 |
| `INTERNAL_ERROR` | 500 | 服务端错误 |

## 5. 通用约定

- **传输**：HTTPS + JSON；Base path `/v1`；所有 body 为 JSON 对象。
- **id**：不透明字符串，全局唯一、永不复用；客户端不得解析或拼接。
- **时间**：ISO 8601 UTC（`2026-08-15T05:00:00Z`）。
- **分页**：`limit` 默认 50、上限 200；`before` 为消息 id 游标；响应带 `hasMore`。
- **排序**：sessions 按 `lastActiveAt` 降序；messages 按 `createdAt` 升序。
- **认证**：预留 `Authorization` 头，V1 不定义鉴权细节。

## 6. 不设计（V1 明确不做）

- 群组 Agent（多人共享一个对话 / Agent）
- Agent hierarchy（继承 / 父子）
- workflow
- 复杂权限 UI
- marketplace
- memory UI
- 消息流式推送（SSE/WebSocket）
- 切换 history / stack（「换回来」由客户端再次 `switchAgent` 完成，见 §3）
- 鉴权 / 多用户

## 7. 开放问题

（`switchAgent` 未传 `sessionId` 的行为已定案：固定进入目标 Agent 的 `main`，见 §3。
其余问题保持 open，不提前设计。）

1. 归档保留期默认值（建议 30 天，配置化）。
2. 流式消息是否 V2 必做。
3. 同一用户在多渠道（飞书 + Android）与同一 Agent 对话：各自 ChannelConversation
   独立 Binding、互不影响——确认可接受。
4. 「默认 Agent」如何确定：配置 vs 首个创建的 Agent（`resolveChannelConversation`
   首次创建时使用）。

## 8. 影响

- **Router / 控制面**：入站消息按 `Binding.activeAgentId` 路由到对应 per-agent 进程。
- **渠道适配器**（如 feishu-connector）：只负责把渠道原生标识（如飞书 chatId）经
  `resolveChannelConversation` 换成 ChannelConversation + Binding，再按 Binding
  dispatch；不持有任何 Agent / Session 状态。
- **端 UI（Android/Web）**：首屏 = `listAgents` + `getBinding`；切换 =
  `switchAgent`；新建会话 = `createSession`；聊天 = `sendMessage` / `getMessages`。
- **本决策不实现后端**；Android 可直接用 `AGENT_SESSION_CHANNEL_MODEL_V1.api.json`
  搭 mock。
