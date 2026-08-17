# 加一个 Agent

> status: current · 本页描述当前（声明式 agent-definition）的新增 Agent 流程。

## 1. 声明 Agent（agent-definition）

Agent 存在性 = **声明式只读配置**（`packages/agent-definition`）：稳定 `agt_*` id +
name / display / default。刻意**不含** persona / workspace / credential / runtime
字段——那些由各 owner 分别管理（workspace 见
[concepts/workspace-and-memory](../concepts/workspace-and-memory.md)）。

早期 registry（写运行时注册表）已被声明式配置取代；存量迁移用
`scripts/migrate-registry-to-definition.mjs`（一次性）。

## 2. 准备 workspace 与 DSH_HOME

无需手工：workspace-bootstrap 在首次使用时幂等创建
`~/.dsh/workspaces/<agentId>` 并播种 `AGENTS.md`；agent-provisioning 为 Router 可能
spawn 的每个 profile 幂等准备 per-agent DSH_HOME（settings / credentials /
profile / 插件链接）。

## 3. 组合能力（bundle / profile）

用 DSH profile + bundle 把该 Agent 需要的插件组合起来（demo-server + owner-guard
是每个 per-agent 进程的基础；可选 agent-memory / agent-switch 等），安装面：
`npm run install:integration`（symlink、additive）。机制见
[guides/plugins](plugins.md)。

## 4. 接入入口

- 飞书群/会话：消息到达后 `resolveChannelConversation` 首次解析即建立默认
  Binding（默认 Agent 的 main 会话）。
- 切换：`switchAgent`（见 [concepts/sessions-and-bindings](../concepts/sessions-and-bindings.md)）。

## 5. 验证

`scripts/agent-definition-access-v1-verify.mjs` 覆盖声明式配置的访问面；
端到端用 `npm run verify:product-integration`。

相关：[concepts/agents](../concepts/agents.md) · [guides/plugins](plugins.md)。
