# Workspace 与 Memory

> status: current · 本页是「per-agent workspace 与长期记忆」的唯一 authority。

## Workspace

- **唯一映射 owner**：`packages/workspace-bootstrap`。`agentId → workspace` 解析为
  超薄 `resolveWorkspacePath`（`sanitizeAgentId` 校验）；默认根
  `~/.dsh/workspaces/<agentId>`。Router 不重复实现路径规则。
- 目录**幂等创建**并播种 `AGENTS.md`（agent 的 workspace 内联说明）。
- DSH 进程以 workspace 为 cwd 启动；per-agent DSH_HOME 由
  `packages/agent-provisioning` 幂等准备（settings / credentials / profile 安装 /
  插件 farm 链接）——对 Router 可能 spawn 的每个 profile 都成立。

## Memory（file-first，D-003）

Session trajectory ≠ 长期记忆。每个 Agent 的记忆完全物理隔离在自己的 workspace：

- **`<workspace>/MEMORY.md`** — curated 唯一事实源；人工可直接查看/编辑/删除
  （file-first，人工优先）。
- **`<workspace>/memory/YYYY-MM-DD.md`** — episodic daily notes；consolidation 的
  原始证据始终落这里（fallback）。
- **注入**：新 session 通过 `systemPrompt.context` 同步重读 MEMORY.md 注入 +
  `memory_*` 工具读写。
- **consolidation**：turn/end + 防抖触发；输入只用 session surface 证据（直接用户
  消息 + 助手回复，seq 水位去重），输出逐条校验后写回 MEMORY.md。

向量/embedding 检索 DEFER；MCP memory channel 保留为可选后端（V1 以文件为主）。

相关：[agents](agents.md) · [reference/filesystem-layout](../reference/filesystem-layout.md) ·
[guides/adding-an-agent](../guides/adding-an-agent.md)。
