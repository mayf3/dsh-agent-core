# 加一个 Agent

> status: current · 本页描述当前的新增 Agent 流程与 **V2 产品模型**（D-006，
> accepted）的实现收敛状态——尚未实现的部分如实标注，不虚构已跑通。

## 1. Agent 的存在面（agent-definition + V2 出生模型）

Agent 存在性 = **声明式只读配置**（`packages/agent-definition`）：稳定 `agt_*` id +
name / display / default。刻意**不含** persona / workspace / credential / runtime
字段——那些由各 owner 分别管理（workspace 见
[concepts/workspace-and-memory](../concepts/workspace-and-memory.md)）。

**V2 产品模型（D-006，accepted）**：Agent 由 **first eligible human message 自动
出生**并固定绑定到该 conversation（p2p 首条 / 群内首次 @bot / no-mention 群首条
eligible），无需显式 create-agent 入口；出生不等外部能力 provision。**实现状态**：
automatic birth 的 implementation convergence **pending**——当前 runtime 的 first
contact 仍绑定 config defaultAgentId（transitional 旧形态），收敛由 accepted
`docs/specs/AGENT_WORKSPACE_SESSION_V2_CORE_ALIGNMENT_SPEC.md` 授权，尚未实现
（见 [concepts/agents](../concepts/agents.md)）。

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

- **飞书会话（V2 产品模型）**：one conversation → one Agent **固定关联**；Agent
  出生 = first eligible human message 自动创建并固定绑定
  （requireMention=true 未 @ → drop，不创建）。**实现状态**：当前 runtime 的
  first contact 仍绑定 config defaultAgentId（transitional；implementation
  convergence pending）。
- **切换**：仅**可切换 Surface**——Mobile 的 `switch_agent` 改该 Surface 的
  activeAgent（只能选已有 Agent）；**Feishu 固定不可切**（cron / agent-task 亦
  不可）。详见
  [concepts/sessions-and-bindings](../concepts/sessions-and-bindings.md)。

## 5. 验证

`scripts/agent-definition-access-v1-verify.mjs` 覆盖声明式配置的访问面；
端到端用 `npm run verify:product-integration`。

相关：[concepts/agents](../concepts/agents.md) · [guides/plugins](plugins.md)。
