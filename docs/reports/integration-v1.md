# Integration V1 — 第一条真实长期链路总装

> 状态：已完成并真实验收（2026-08-15）· 分支：feat/integration-v1
> 产品边界：D-002 AGENT_SESSION_CHANNEL_MODEL_V1（docs 契约，PR #2 已合并）

## 1. 目标

跑通第一条**真实**长期链路（不经过 OpenClaw / 旧 Agent Core）：

```
真实飞书消息 → Feishu Connector → Router/Control Plane → workspace-bootstrap
  → owner-guard → per-agent DSH process → resume-aware agent-server → Agent reply → 飞书
```

证明：一条真实飞书消息可路由到稳定的 per-agent DSH 实例；同一 Agent 的后续消息进入
同一持久化上下文；进程被杀后能从持久化恢复并继续工作。

## 2. 实现改了什么

### 新增

- **`packages/agent-router/`**（新组件，Router / Control Plane）：
  - `src/process.js` — per-agent DSH 进程客户端（从 process-model benchmark 驱动
    抽取精简）：spawn（`dsh --profile agent-core-demo`，独立 DSH_HOME/workspace）、
    initialize、session/prompt + 事件流等待 idle + 提取回复、shutdown/kill9、exit
    清理；复用 `scripts/demo-home.mjs` 的 `cliBin`。
  - `src/index.js` — 常驻 Router 插件：
    - **D-002 契约端点 #12 等价实现**：`resolveChannelConversation({channel, externalId})`
      幂等 —— 首次接触创建 ChannelConversation + 默认 Binding（defaultAgentId +
      defaultSessionId），已存在则返回现有；以 `agentRouter` 服务对外暴露（同进程调用）。
    - 进程注册表：`ensureRunning(agentId)` 惰性 spawn / 复用 / 死亡后清理重拉；
      `registrySnapshot()` 运维面。
    - `onIngress`：ChannelConversation → Binding → Agent + Session → 模型回复 →
      经 feishu handle `replyTo()` 回复原消息（thread 自动 replyInThread）。
    - teardown：插件停止时 shutdown 全部 owned 进程。
- **`bundle-integration/` + `profile-integration/`**：控制面进程组合
  （dsh-base + workspace-bootstrap + feishu-connector + agent-router），
  `ROUTER_DEFAULT_AGENT` / `ROUTER_DEFAULT_SESSION` / `FEISHU_CREDS_PATH` 环境注入。
- **`scripts/`**：
  - `setup-feishu-creds.mjs` — 从本机 OpenClaw 配置派生 0600 飞书凭据文件；
  - `install-integration.mjs` — 安装控制面 profile + 插件 farm（只增不改）；
  - `integration-v1-verify.mjs` — 验收驱动（启动控制面、分阶段断言）。

### 修改（最小）

- **`packages/feishu-connector/src/index.js`**：+`ctx.provide('feishu', handle)`
  （服务值语义，供 Router 绑定回调与回复）；其余 channel 层零改动。
- **`packages/workspace-bootstrap/src/index.js`**：`ctx.provide('workspaceBootstrap', service)`
  —— 修正 Cordis provide 的值语义（原传工厂函数，`ctx.get()` 会返回函数而非服务）。

### 复用（零改动）

`packages/demo-server`（作为正式 resume-aware agent-server）、`packages/owner-guard`
（单 owner 锁）、`scripts/demo-home.mjs` 的 `provisionAgentHome`（agent home 装配）。

## 3. 真实验收证据（2026-08-15，真实飞书私聊）

控制面：`dsh --profile agent-core-integration`（PID 971/10740）；agent 进程：
`dsh --profile agent-core-demo`。

### 第一条消息 —— 自动绑定 + 建 workspace + 启动进程 + 建会话 + 回复

```
[router] binding created: channelConversation oc_9dd74b9ed... -> agent agent-demo + session main
[router] channelConversation oc_9dd74b9ed... -> binding -> agent agent-demo + session main (channel=p2p ... text="你好，这是 Integration V1 第一条消息")
[router] agent agent-demo ready pid=4549 (885ms)
[router] agent agent-demo: session main created (0 events)
[router] agent agent-demo (pid 4549) replied: 收到，欢迎来到 Integration V1！...
[router] reply sent back to oc_9dd74b9ed...
```

### 第二条消息 —— 复用同一 PID + 同一上下文

```
[router] channelConversation oc_9dd74b9ed... -> binding -> agent agent-demo + session main
         (text="你还记得我上一条消息吗？...")
[router] reuse process for agent-demo (pid 4549)
[router] agent agent-demo (pid 4549) replied: 你上一条消息是："你好，这是 Integration V1 第一条消息" ...
[router] reply sent back to oc_9dd74b9ed...
```

### 第三条消息（kill -9 4549 之后）—— 自动 respawn + resume + 记忆延续

```
[router] binding created: channelConversation oc_9dd74b9ed... -> agent agent-demo + session main   （控制面重启后重建）
[router] agent agent-demo ready pid=11639 (881ms)
[router] agent agent-demo: session main resumed (150 events)
[router] agent agent-demo (pid 11639) replied: ...根据当前会话里已有的内容，我可以回顾前两轮：第 1 轮：你发来"你好，这是 Int...
[router] reply sent back to oc_9dd74b9ed...
```

### 持久化证据

```
~/.dsh/agents/agent-demo/sessions/--Users-yanfenma-.dsh-workspaces-agent-demo--/main/session.jsonl
  （150 事件，三轮完整对话）
~/.dsh/agents/agent-demo/   ← 该 Agent 专属 DSH_HOME（profiles/sessions/settings.yaml/.credentials.yaml）
~/.dsh/workspaces/agent-demo/  ← 该 Agent 专属 workspace
```

### 验收对照

| 验收项 | 结果 | 证据 |
|---|---|---|
| 飞书消息不经过 OpenClaw 到达 Agent | ✅ | 飞书事件 → 本控制面（feishu-connector 长连接）→ router；OpenClaw 进程未参与 |
| Agent 回复回飞书 | ✅ | `reply sent back` + 用户实际收到 |
| 连续消息复用同一 PID/session | ✅ | `reuse process for agent-demo (pid 4549)`（第二条） |
| 进程 kill 后自动启动并 resume | ✅ | `kill -9 4549` → `ready pid=11639` → `session main resumed (150 events)` + 记忆延续 |
| workspace/DSH_HOME 固定属于该 Agent | ✅ | `~/.dsh/agents/agent-demo/` + `~/.dsh/workspaces/agent-demo/`（agentId 派生，唯一） |
| 同一 Agent 不出现双 owner | ✅（继承自 process-model test F：intruder 拒绝/race 单赢家/stale 接管）+ Router 进程注册表单实例 |

## 4. 尚未解决的问题

1. **控制面进程生命周期**：验收驱动 kill driver 时，router 进程因 stdio 断开随之退出
   （DSH CLI 行为）——正式部署需 daemon/服务化托管（systemd/launchd），属 always-on 主题
   （已调查，未实现）。
2. **resolve 端点的传输形态**：当前为同进程服务（`agentRouter`）；契约形态是
   `PUT /v1/channel-conversations/resolve` —— 跨进程 HTTP/JSON-RPC 暴露未实现
   （V1 组合内 Connector 与 Router 同进程，无需 wire）。
3. **Binding 持久化**：Binding 表在 Router 进程内存中；Router 重启后首次消息重建
   （语义等价——默认绑定是确定性的）。多 Binding / 历史 / 换绑未实现（D-002 明确不做）。
4. **群聊/thread 入站**：feishu-connector 已验证 group/thread 规范化（前轮验收），
   但本链路只在 p2p 实测；group @bot 走同一 resolve+dispatch 路径，未单独实测。
5. **第二个 agentId 的隔离实测**：V1 单默认 Agent（D-002），"两 agent 不串"由
   process-model test D（不同 pid/home/workspace/session-store）+ 本链路 agent-demo
   归属证据共同支撑，未在真实飞书双会话实测。

## 5. Blocker vs 后续 debt

**Integration V1 blocker：无。** 全部验收项已通过（§3）。

后续 debt（非本里程碑阻断）：
- 控制面 daemon 化托管（问题 1）→ always-on 里程碑；
- resolve 端点 wire 化（问题 2）→ 契约 #12 完整落地；
- Binding 持久化/多 agent 实测（问题 3/5）→ D-002 后续；
- group/thread 端到端（问题 4）→ 下一个真实场景。

## 6. 结论

**可以宣布：第一个完全不经过 OpenClaw 的长期 Agent 已跑通。**

真实飞书消息 → 自动绑定（D-002 模型）→ per-agent 专属 workspace/DSH_HOME → 独立 DSH
进程 → 会话持久化 → 进程复用 → kill 后自动 resume → 回复回飞书，全链路真实验证通过。
当前形态是"控制面（Router 进程）+ 每 Agent 一进程"的最小可行实现，边界符合 D-002：
Channel 只是入口，Agent 固定拥有 workspace/DSH_HOME/process/memory。
