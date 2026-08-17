# 架构总览（Architecture Overview）

> status: current · 本页是「Agent Core 当前整体架构」的唯一 authority。事实改变时直接改写本页，禁止底部追加日期。

## 一句话

Agent Core 是基于 DeepSeek Harness（DSH）的一层**薄组织层**：把 DSH 的通用 Agent
运行时组织成一批长期存在的「数字员工」——每个 Agent 有稳定身份、专属 workspace 与
DSH 进程、多个会话、跨会话记忆，能安全地调用外部系统能力。**one Agent = one DSH
process（进程 = 安全域）**。

它**不重做** DSH 的任何 Runtime 能力（agent loop、tools、fs、skills、session
持久化……），只负责「员工是谁 / 在哪办公 / 正在和谁聊 / 何时上班 / 如何安全访问外部系统」。

## 当前链路（merged main 事实）

```
Feishu（WebSocket 长连接）   Scheduler（cron/at/every）   HTTP 入口（localhost）
        │                          │                            │
   feishu-connector          scheduler → scheduler-router    notification-ingress / product-api
        │                          │                            │
        └────────────┬─────────────┴────────────────────────────┘
                     ▼
        Router / Control Plane（packages/agent-router）
        · Binding 路由（conversation → agent）
        · per-agent DSH 进程 registry（spawn / reuse / resume）
        │
        ▼   one Agent = one DSH process（独立 DSH_HOME + workspace）
        DSH Runtime（dsh --profile <agentProfile>，stdio JSON-RPC）
        │
        ▼
        Broker bridge（capability manifests → model-facing tools）→ 外部系统
```

- 入站消息按 Binding 的 activeAgentId 路由到对应 Agent 的 DSH 进程；一个 turn =
  从 prompt 到该 Agent 整体回到 idle。
- 生产形态由 `packages/production-runtime` 做 **wiring-only 组合**（不新增领域组件），
  常驻进程 = Scheduler 引擎 + Notification Ingress + Product API + Feishu channel，
  持久化根默认 `~/.agent-core`。

## 责任边界（谁负责什么）

| 层 | 负责 | 不负责 |
|---|---|---|
| Channel（feishu-connector 等） | externalId ↔ ChannelConversation 映射、事件归一化 | 不拥有 Agent/Session 状态 |
| Router / Control Plane | 消息找谁、进程何时启动、Binding 持久化 | 不拥有 workspace 路径规则、不演化成大 Kernel |
| DSH Runtime | agent loop / tools / fs / session 持久化 / compaction | 不做组织层编排 |
| Broker bridge | capability manifest → 工具、credential 绑定 | 不做第二个 agent loop |

## 包清单（packages/，均为 merged 事实）

| 包 | 职责 |
|---|---|
| `agent-definition` | Agent 存在性的声明式只读配置（稳定 `agt_*` id） |
| `agent-provisioning` | per-agent DSH_HOME 幂等准备（settings/credentials/profile/插件链接） |
| `workspace-bootstrap` | agentId → workspace 唯一映射（默认 `~/.dsh/workspaces/<agentId>`） |
| `agent-router` | 控制面：Binding 路由 + per-agent DSH 进程 registry |
| `agent-switch` | DSH 内 `agent_core.switch_agent` 工具（纯 adapter，经 parent-RPC） |
| `agent-memory` | file-first 长期记忆（MEMORY.md + daily notes + consolidation） |
| `scheduler` | 持久化 cron/at/every job 引擎（零 DSH 依赖） |
| `scheduler-router` | Scheduler ↔ Router 桥（真实 invokeAgent + Feishu deliver） |
| `broker` | capability manifests → model-facing DSH tools + credential 绑定 |
| `feishu-connector` | 飞书/Lark WebSocket channel（IngressEvent / ReplyTarget） |
| `notification-ingress` | `POST /v1/deliver` 薄 HTTP 入口（localhost:8790） |
| `product-api` | Gate 1 Mobile Product API（localhost:8787，供 adb reverse） |
| `demo-server` | per-agent 常驻 JSON-RPC server 插件（stdio 协议、resume） |
| `owner-guard` | 单 owner 锁（每个 agent home 同时只允许一个活进程） |
| `production-runtime` | 生产常驻组合（wiring/lifecycle only） |

## 成熟度（诚实边界）

- 已 merged 并在生产使用：上表全部链路（单机 macOS 部署形态，launchd KeepAlive）。
- 设计冻结但**未**完整实现：per-agent process credential 的最终形态（token 注入 +
  Broker 侧 credential→principal 绑定的完整攻击测试面）——见
  [security-model](../security/security-model.md)。
- 明确不做：重做 Runtime、内置 Forum/Workflow/OKR（经 Broker 访问外部系统）。

延伸阅读：[runtime-boundary](runtime-boundary.md) · [control-plane](control-plane.md) ·
[security-model](../security/security-model.md)。研发过程证据见
[docs/history](../history/README.md)（历史，不代表当前）。
