# Agent：数字员工

> status: current · 本页是「Agent 是什么」的唯一 authority。

## 定义

**Agent 是长期存在的实体**（不是一次会话、不是一次进程）。一个 Agent 固定拥有：

- **身份**：声明式只读配置中的稳定 `agt_*` id + name / display / default
  （`packages/agent-definition`；早期 `registry` 命名已被声明式 agent-definition 取代）。
- **办公地点**：专属 workspace（`~/.dsh/workspaces/<agentId>`，由
  workspace-bootstrap 唯一映射）+ 专属 DSH_HOME（agent-provisioning 幂等准备）。
- **进程**：one Agent = one DSH process（懒启动；退出后 respawn + resume）。
- **会话与记忆**：多个 Session（`main` 长期主会话 + normal 会话）与跨会话记忆
  （MEMORY.md + daily notes）。
- **能力**：经 bundle/profile 组合获得的 DSH 插件能力 + 经 Broker 暴露的外部系统工具。

## Agent 不是什么

- 不是 OS 用户（Agent 间隔离靠进程 + 独立 home，不靠多用户）。
- 不是 channel 的从属物（Channel 只是入口，见
  [sessions-and-bindings](sessions-and-bindings.md)）。
- 不是 persona 配置项（agent-definition 刻意不含 persona / workspace / credential /
  runtime 字段）。

## 生命周期

```
声明（agent-definition 配置）
  → workspace / DSH_HOME 幂等准备（provisioning + workspace-bootstrap）
  → profile 安装（bundle 组合，见 guides/plugins）
  → 首条消息到达时由 Router 懒启动 DSH 进程
  → 常驻运行；崩溃 → respawn + resume；切换入口 → switchAgent 改 Binding
```

如何新增一个 Agent：见 [guides/adding-an-agent](../guides/adding-an-agent.md)。

相关：[sessions-and-bindings](sessions-and-bindings.md) ·
[workspace-and-memory](workspace-and-memory.md) · [architecture/overview](../architecture/overview.md)。
