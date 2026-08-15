# D-004: Router / Binding 域操作与持久化 — Product Integration V1

- 状态: accepted（分支 feat/product-integration-v1 已实现并真实验收，见
  `docs/reports/product-integration-v1.md`）
- 日期: 2026-08-15
- 类型: 产品边界决策（Router domain operation + Binding owner + 持久化）
- 关联: D-002 AGENT_SESSION_CHANNEL_MODEL_V1（Binding 实体与 switchAgent 语义）

## 0. 一句话总结

Router / Control Plane 是 Binding 的唯一 owner；系统只有一个切换原语
`Router.switchAgent(bindingContext, targetAgentId, { targetSessionId? })`，所有
入口（Feishu 连接器、未来的 Mobile/Web Product API、per-Agent 进程内的 DSH
switch 工具）最终都调用它；Binding 用最薄的原子 JSON 存储持久化，控制面重启后
「仍然是 Agent B」。

## 1. 背景

Integration V1 已经把 Feishu → Router → per-Agent DSH → reply 的链路跑通，但：

1. Binding 是 Router 进程内的 `Map`——切到 Agent B 后控制面一重启就回到默认
   Agent，无法支撑长期多 Agent。
2. 没有统一切换原语：`resolveChannelConversation` 只会在首次接触时自动绑定默认
   Agent；"叫论文导师来 / 换回来"没有落点。
3. 后续两条产品入口（Feishu 外部连接器、Mobile/Web 原生 Product Surface）即将
   并存；如果各自发明路由规则，就会出现 Feishu Router / Mobile Router 的分裂。

## 2. 决策

### 2.1 一个 Router，一个 domain operation

Router 只提供一套路由规则，入口协议（WebSocket / Feishu / …）不进入核心规则：

```text
Feishu connector  -> resolveChannelConversation -> Binding -> Router.switchAgent
Mobile Product API -> (future)  Current Binding  -> Router.switchAgent
per-Agent DSH tool  -> parent-RPC relay          -> Router.switchAgent
```

`switchAgent(bindingContext, targetAgentId, { targetSessionId? })` 是唯一的切换
原语，职责严格按 D-002 §3 定案执行：

1. **Registry 验证 target Agent 存在**（`AGENT_NOT_FOUND` 时拒绝且不改动 Binding）；
2. **Router 决定目标 Session**：显式 `targetSessionId` 用之；缺省固定进目标 Agent
   的 `main`（V1 不做 LLM/语义 Session 猜测）；
3. **更新当前 Binding**（该 ChannelConversation 尚无 Binding 时创建——切换也是
   合法的首次接触）；
4. **返回新 Binding**。

`targetAgentId` 接受不透明 agentId 或显示名：解析策略属于 Router（经 Registry），
自然语言入口（DSH tool）只转发原话，不自己查 Agent。

### 2.2 Binding owner = Router / Control Plane

- ✅ Router 拥有并持久化 Binding（新建、切换、读取）。
- ❌ Mobile / Feishu Connector / DSH Agent / Registry / Memory 都不写 Binding：
  连接器保持无状态（D-002）；Registry 只持有 Agent 身份；Memory 只持有 Agent 记忆。
- DSH switch tool（`agent_core.switch_agent`）是纯 adapter：转发
  `{targetAgentId, targetSessionId?}` 到 Router.switchAgent，不拥有持久化 / 查找 /
  Session 选择 / 入口分支 / 导航历史。

### 2.3 持久化 = 原子 JSON，无数据库

- 单文档 `<home>/.dsh/bindings/bindings.json`（config `bindingsStoreFile` 可覆盖，
  必须绝对路径，相对 / `~` 前缀 fail-loud——与 agent-registry 的 storeFile 契约一致）。
- 文档 `{ "version": 1, "bindings": { "<ccId>": Binding } }`；写 = tmp + rename，
  变更经内部队列串行化，`set` resolve 即已落盘；加载 fail-loud（损坏绝不静默重置）。
- 不引入数据库平台 / event sourcing：一张表、原子替换，足够满足
  "切到 Agent B → 控制面重启 → 仍然是 Agent B"。

### 2.4 切换不是角色扮演

切换只写 Binding，不创建 / 移动 / 复制任何 Agent / Session；「换回来」= 客户端
再次 `switchAgent`，Router 无导航历史（D-002 §6）。per-Agent last-active-session
不实现，只记录 integration need（Mobile UX 需要时再定）。

## 3. 替代方案

- **Binding 留在内存 + 重启丢**：现状，否决（长期多 Agent 硬需求）。
- **控制面引入 SQLite / Redis**：否决（本轮目标是简单可靠；单表 JSON 原子写足够）。
- **tool 侧解析 Agent / 选 Session**：否决（策略必须集中在 Router；adapter 只转发）。
- **Feishu Router + Mobile Router 两套**：否决（入口协议不应进入核心路由规则）。

## 4. 影响

- `packages/agent-router`：BindingStore（`src/binding-store.js`）、
  `switchAgent` / `getBinding` / async `resolveChannelConversation`、
  registry 校验、per-Agent 进程 `$DSH_AGENT_ID` 注入、parent-RPC 转发钩子。
- `packages/demo-server`：parent-RPC passthrough（`ctx.agentRpc`）——纯转发，
  不感知 Router 语义。
- `packages/agent-switch`（新增）：`agent_core.switch_agent` adapter。
- `bundle-integration`：新增 agent-registry 行；router 配置
  （bindingsStoreFile / agentProfile / registry storeFile 均可 env 覆盖）。
- `profile-integration-agent` + `bundle-agent-switch`（新增）：per-Agent 组合
  （demo-server + owner-guard + agent-memory + agent-switch）。
- 未来 Mobile Product API 只需调用 `ctx.agentRouter.switchAgent` / `route` /
  `resolveChannelConversation`——domain boundary 已就绪。
