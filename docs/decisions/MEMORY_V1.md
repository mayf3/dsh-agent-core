# Memory V1 — per-agent file-first long-term memory（Agent Core memory glue）

- 状态: accepted（Agent Memory V1 分支已实现并真实验收，见 `docs/reports/memory-v1.md`）
- 日期: 2026-08-15
- 类型: 正式决策（memory 主题收敛，落实 CAPABILITY_MATRIX §1.2 与裁决 3）
- 关联: `docs/investigations/memory.md`、`docs/CAPABILITY_MATRIX.md`、`docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`（D-002，Agent 长期拥有 workspace/DSH_HOME/credential/memory）

## 背景

Agent 是长期实体，Session 可以不断新建、归档、清理。因此必须区分 **Session
trajectory**（会话日志，DSH 已完备：事件溯源 + JSONL/SQLite 持久化）与 **Agent
long-term memory**（跨会话、可维护、按 agent 隔离的 curated 记忆）。调查结论
（`investigations/memory.md`）：DSH 无 memory 包；consolidation 完全缺失、召回仅
关键字；官方定位记忆走 MCP。收敛裁决（CAPABILITY_MATRIX §2 裁决 3）：V1 以**文件
记忆为主**（与 OpenClaw「Memory is just Markdown」一致、零外部依赖、与
workspace-bootstrap 播种天然衔接），MCP 记忆保留为可选后端。

## 决策

1. **存储位置：每个 Agent 的 workspace 内。** curated 层 =
   `<workspace>/MEMORY.md`（唯一事实源、人类可编辑）；episodic 层 =
   `<workspace>/memory/YYYY-MM-DD.md`（每日原始证据）。agentId→workspace 映射
   复用 `@agent-core/workspace-bootstrap`（D-002：该映射的唯一 owner）。不建任何
   全局库（mneme 的 `~/.dsh/memory/memory.db` 是反模式——一个库装所有 agent）。
2. **隔离 = 物理隔离。** 不同 agentId → 不同 workspace → 不同 MEMORY.md；per-agent
   进程（既有架构：one agent per DSH process + per-agent home/workspace）天然把
   记忆插件限定在单个 agent 的目录内。无共享命名空间、无跨 agent 读取路径。
3. **新 Session 拿记忆 = 自动注入 + 按需工具。** `systemPrompt.context` 在每次
   prompt 装配时**同步重读 MEMORY.md**（`loadEntriesSync`），因此注入总是最新
   （人工编辑下一轮即生效）；另注册模型可见工具 `memory_search` 等做按需召回。
   不自动改写 session 日志，不注入历史 episodic 内容。
4. **consolidation 时机 = turn/end + 防抖，另提供显式工具。** `session/event`
   `turn/end` 后 debounce（默认 3s）把该 session 自上次 consolidation 以来的新增
   surface 证据（直接用户消息 + 助手回复，按 seq 水位去重）交给 LLM 提炼；也可由
   模型显式调 `memory_consolidate` 或外部调服务 `consolidate(agentId, evidence)`。
5. **consolidation 输入 = session surface 证据。** 只取 `user/message`（source.kind
   = user，排除插件注入上下文）与 `assistant/message` 的文本，按 session seq 增量、
   有界（40 条）。信任边界：证据先过滤（防记忆注入），LLM 输出逐条 validate
   （type/title/content 白名单）后才落盘，坏输出整单丢弃。
6. **人工查看/编辑/删除 = 直接编辑 MEMORY.md。** file-first：每次机器写前重新读盘
   （read-modify-write + 原子 rename），人工修改永远优先；删除 = 删掉该 entry 块。
   条目格式适配 `@modusensus/dsh-mneme` 的 Markdown 镜像格式（`## title` + 元数据
   行 + 正文 + `---`），该格式对人工编辑回读（round-trip）经过验证。
7. **fallback = episodic 层永不丢数据。** consolidate 每次先把原始证据 append 到
   当日 daily note（审计/兜底）；LLM 不可用、输出非法或为空时，证据仍在 daily note
   里，MEMORY.md 不受污染。记忆是文件，进程重启/会话清理不丢。

## 替代方案

- **BUILD 原生 SQLite 记忆库 + Markdown 镜像**（mneme 式）：否决——镜像双写复杂、
  全局库破坏隔离、违背「file-first」。
- **ADOPT MCP 记忆服务**（MCP Reference Memory / Memorix，`examples/mcp-memory`）：
  保留为可选后端（裁决 3），V1 不依赖外部进程。
- **自研向量库/embedding 检索**：DEFER（调查结论：OpenClaw 也是关键字+文件为主）。
- **记忆放 DSH home**（`~/.dsh/agents/<id>/memory/`）：否决——home 是运行时
  （sessions/settings/credentials），workspace 才是 agent 的长期家、人类可见、可
  git 备份。

## 影响

- 新增 `packages/agent-memory/`（纯 core + Cordis 插件）、`bundle-memory/`、
  `profile-memory/`（per-agent 组合：dsh-base + bundle-demo + bundle-memory）、
  `scripts/memory-v1-verify.mjs`（真实验收驱动）。
- 第一轮未触碰 `packages/agent-router/**`、`packages/agent-registry/**`、
  `packages/agent-session/**`；Router/Session 将来要接 Memory 时见报告 §
  Integration need。
- 不实现：vector DB / embedding、Dashboard、Mobile、HTTP API、Forum/Workflow、
  scheduler/daemon（本轮边界外）。
