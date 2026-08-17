# 插件与扩展（Plugin / Bundle / Profile）

> status: current · 面向想给 Agent 加能力的贡献者。

## 机制（ADOPT DSH 的 Cordis 插件运行时）

Agent Core **不自建插件系统**——直接使用 DSH 的 Cordis 动态插件运行时。Agent Core
的 DSH 侧组件都以 Cordis 插件形态挂载在 per-agent 进程内：

- `demo-server` — per-agent 常驻 JSON-RPC server（stdio 协议、持久化 resume）。
- `owner-guard` — 单 owner 锁（一个 agent home 一个活进程）。
- `agent-memory` — 记忆工具与注入（`memory_*` tools）。
- `agent-switch` — `agent_core.switch_agent` 工具（纯 adapter，经 parent-RPC 请
  控制面执行；零策略）。

## 组合面（bundle / profile）

仓库以 **bundle**（能力包）+ **DSH profile**（组合声明）组织可安装面：

- `bundle-integration/`、`bundle-memory/`、`bundle-agent-switch/`、`bundle-broker/`
  （历史 demo bundle 见仓库根）。
- `profile-integration/`（控制面 profile）、`profile-integration-agent/`
  （per-agent：demo-server + owner-guard + agent-memory + agent-switch）。
- 安装：`npm run install:integration`——以 symlink 装入 `$DSH_HOME/profiles/`
  （additive only，不覆盖既有安装）。

## 扩展守则

1. 新能力优先做成 **capability manifest**（经 Broker 暴露给模型），而不是新插件
   ——见 [guides/integrations](integrations.md)。
2. 确需进程内插件时：不得拥有 Binding/路由策略（那是控制面）；经 parent-RPC 请求
   域操作（参考 `agent-switch`）。
3. 禁止出现的组件名清单与 frozen 边界见
   [contributing/architecture-rules](../contributing/architecture-rules.md)。
4. 完整的 plugin **生命周期治理**（实验→证据→评审→晋升→回滚）尚未建设；当前以
   Spec + verify 脚本 + git review 代替。

相关：[concepts/agents](../concepts/agents.md) ·
[architecture/runtime-boundary](../architecture/runtime-boundary.md)。
