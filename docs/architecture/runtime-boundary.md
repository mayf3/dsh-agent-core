# Runtime 边界：DSH vs Agent Core

> status: current · 本页是「DSH Runtime 与 Agent Core 控制面边界」的唯一 authority。

## 原则

**DSH 是 Runtime，Agent Core 是组织层。** 凡 DSH 已提供的运行时能力，Agent Core 一律
直接使用（ADOPT）或只做薄配置（ADAPT）；Agent Core 只自建 DSH 完全没有的组织层
（BUILD）。这条边界是仓库的 frozen invariant（见
[contributing/architecture-rules](../contributing/architecture-rules.md)）。

## DSH 提供、Agent Core 直接复用（ADOPT）

- agent loop、tools、fs/shell/subagent、agent-instructions
- skill 文件系统、compaction
- session 持久化（kill → resume 已验证）、goal、inbox/followup/steer
- Cordis 动态插件运行时（Agent Core 的 DSH 侧组件都以插件形态挂载）

## DSH 提供、Agent Core 薄适配（ADAPT）

- schedule（opt-in；`every_seconds` ≥ 300s；无 cron —— cron 由 Agent Core 自建
  `scheduler` 补齐）
- MCP memory channel（可选后端；V1 以文件记忆为主）

## Agent Core 自建（BUILD，因 DSH 完全没有）

- workspace-bootstrap：per-agent 长期目录与约定
- agent-definition：Agent 身份声明
- agent-router：控制面（路由 + 进程编排）
- agent-memory：跨会话 consolidation
- scheduler：持久化 cron/at/every jobs
- broker bridge：capability → 工具的统一出口

## 禁止出现的东西

不存在、也不允许出现这些组件：Session 映射层（product sessionId 直接等于 DSH
native sessionId）、`agent-core-session(-runtime)`、`agent-core-skill-manager`、
`agent-core-shell`、`agent-core-forum-plugin` / `agent-core-workflow-plugin`。
完整清单见 [contributing/architecture-rules](../contributing/architecture-rules.md)。

## 进程视角

每个 Agent = 一个独立 DSH 进程：`dsh --profile <agentProfile>`，带自己的
DSH_HOME 与 workspace，控制面经 stdio 上的 newline-delimited JSON-RPC 驱动
（initialize / session/prompt/shutdown）。进程即隔离域（security rationale 见
[security-model](../security/security-model.md)）。

相关：[overview](overview.md) · [control-plane](control-plane.md) ·
[workspace-and-memory](../concepts/workspace-and-memory.md)。
