# Agent Core on DeepSeek Harness

**Agent Core 是一个长期运行的多 Agent 控制面（control plane）**：把通用 Agent 运行时
DeepSeek Harness（DSH）组织成一批长期存在的「数字员工」——每个 Agent 有稳定身份、
专属 workspace 与独立 DSH 进程、多个会话、跨会话记忆，能安全地调用外部系统能力。

```
Feishu / Scheduler / HTTP 入口（localhost）
            │
        Agent Core 控制面（路由 · 进程编排 · 定时 · 出站）
            │
   one Agent = one DSH process（进程 = 安全域）
            │
     Tools / Workspace / Memory / 外部系统（经 Broker）
```

## 它解决什么问题 / 为什么不直接用 DSH？

DSH 是优秀的**单 Agent Runtime**（agent loop、tools、session 持久化、skills……），
但它不管组织问题：员工是谁、在哪办公、正在和谁聊、什么时候上班、如何安全地访问
外部系统。Agent Core 只做这一层薄组织，**不重做 DSH 的任何 Runtime 能力**——边界
详见 [docs/architecture/runtime-boundary](docs/architecture/runtime-boundary.md)。

## 现在能做到什么（只列已合入 main 的事实）

- **真实消息链路**：飞书（WebSocket 长连接）→ 控制面路由 → per-agent DSH 进程 →
  回复；HTTP 入口（notification-ingress :8790 / mobile product-api :8787，均
  localhost）。
- **会话归属**：ChannelConversation ↔ Binding ↔ Agent/Session 模型，`switchAgent`
  单一原语切换（原子持久化）。
- **定时**：持久化 cron/at/every scheduler（`agentcore-cron` CLI，OpenClaw 迁移工具）。
- **长期记忆**：per-agent file-first 记忆（MEMORY.md + daily notes + consolidation）。
- **安全底座**：per-agent 进程隔离 + trusted 控制面子进程 uid 降权 + Broker
  credential store；凭据永不进入模型输入。
- **生产形态**：单进程常驻组合（production-runtime）+ launchd KeepAlive（单机
  macOS）。

## 成熟度与限制（诚实说明）

- 内部生产使用中；单机 macOS 部署形态，无多机/HA，无容器化。
- **公开 Quick Start 尚缺失**：没有「install → create Agent → send message →
  reply」的产品级路径；当前以 developer verification（`npm test` + verify 脚本）与
  部署者自行组合为主 —— 见 [docs/getting-started/quick-start](docs/getting-started/quick-start.md)。
- 尚无开源 License（决策属 Project Owner，进行中）；外部贡献渠道暂未开放。
- 已合入与已接受未合并的边界以 main 代码为准。

## 从哪里开始

| 你想… | 去 |
|---|---|
| 跑测试 / 验证 | [Quick Start（现状页）](docs/getting-started/quick-start.md) |
| 理解架构 | [架构总览](docs/architecture/overview.md) |
| 部署 | [部署与运行](docs/guides/deployment.md) |
| 加 Agent / 开发扩展 | [加一个 Agent](docs/guides/adding-an-agent.md) · [插件与扩展](docs/guides/plugins.md) |
| 全部文档 | [docs/README.md](docs/README.md)（index） |

## 文档导航

- **当前文档树**（current truth）：`docs/getting-started/` · `concepts/` ·
  `architecture/` · `guides/` · `security/` · `reference/` · `contributing/` —
  从 [docs/README.md](docs/README.md) 进入。
- **知识权威**（活跃）：[docs/specs/](docs/specs/)（变更授权）、
  [docs/investigations/](docs/investigations/)（调查证据）、
  [docs/decisions/](docs/decisions/)（长期决策）。
- **研发历史**：[docs/history/](docs/history/README.md)（27 份验收报告 + 5 份旧
  快照，带 historical marker，不代表当前）。
- `examples/v0-vertical-slice/`：**已废弃**的 V0 历史示例，仅作参考。

## 仓库结构

npm workspaces monorepo：`packages/`（15 个包：agent-router / scheduler / broker /
feishu-connector / agent-definition / agent-provisioning / workspace-bootstrap /
agent-memory / agent-switch / demo-server / owner-guard / scheduler-router /
notification-ingress / product-api / production-runtime）+ `bundle-*` / `profile-*`
（组合面）+ `scripts/`（verify / 运维）。包职责清单见
[架构总览](docs/architecture/overview.md)。
