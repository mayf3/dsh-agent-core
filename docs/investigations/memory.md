# Memory Investigation

## 1. Required behavior

「长期 Memory」的目标行为（以 OpenClaw 为参照基准，见第 3 节）：agent 不只依赖当前会话的原始对话上下文，而应具备一个**跨会话、可检索、可维护、隔离于单一会话**的持久记忆层。

- **巩固（consolidation）**：把会话的 episodic 日志（发生了什么）提炼成 curated 的长期事实（"用户偏好"、"项目决策"、"已验证结论"），并在会话压缩/结束时自动沉淀，避免因上下文压缩而丢失。
- **召回（recall）**：在新会话或新上下文里，依据当前意图命中并注入相关历史记忆（关键词命中或语义相关）。
- **隔离（isolation per-agent）**：每个 agent 的记忆彼此隔离，不串话；共享需显式授权。
- **持久化（persistence）**：记忆在进程重启、会话重建后仍存在，且与原始日志可追溯（provenance）。

满足的验收判据：在 DSH 会话 A 写入一条偏好 → 会话 B（同一轮/Host 内，不拷贝 A 的对话）询问该偏好 → agent 能通过记忆工具取回调用到答案中（这正是 `examples/mcp-memory` 的验证脚本）。

## 2. DSH native capabilities

**结论：DSH 没有任何 `memory` 包。** 顶层 `packages/` 下不存在 memory 类插件（`ls packages/` 无 memory 目录；全仓 `find -iname "*memory*"` 仅命中 `examples/mcp-memory` 与 node_modules 依赖）。但 DSH 提供了构成记忆层所需的"下层积木"：

### 2.1 会话即事件溯源日志（episodic 原语）
- `Session` 是 append-only 的 `SessionEvent` 日志，是整段交互历史的唯一事实源，模型消息历史由它派生（`docs/subsystems/session.md:5`，`packages/core/session/src/types.ts`，`src/index.ts:792` 定义 `ctx.sessions`）。
- 模型可见面是 `SessionSurface` 与 `deriveMessages()`：只投影三类 surface 事件 `user/message`、`assistant/message`、`tool/result`（`types.ts:263`，`docs/subsystems/session.md:510`）。其余事件（turn/step/chunk/usage/request-header 等）是 **log-only** 的持久化记录，进持久化但**不进模型上下文**（`docs/persistence-catalog.md:23`，`docs/subsystems/session.md:119`）。
- 因此模型上下文 = surface 派生消息 + 注入上下文；持久化 = 整个日志（含 chunk）。（`docs/subsystems/session.md:601` durability 契约）

### 2.2 持久化（跨进程长存，已完备）
- `ctx.sessionPersistence` 抽象接缝（`docs/subsystems/persistence.md:248`，`packages/session/session-persistence/src/index.ts:84`），两个后端：JSONL（`session-persistence-jsonl`，按会话 append-only）与 SQLite（`session-persistence-sqlite`，每事件一行）。带 flush 检查点、崩溃恢复、格式版本拒绝。
- `SessionHeader` 记录 parent/seedLength/cwd 等血缘元数据（`docs/subsystems/persistence.md:51`）。**注意：持久化是"会话日志"的持久化，不是"长期记忆"的持久化。**

### 2.3 会话内压缩 / 摘要（partial consolidation）
- `ctx.compaction` 编译引擎 + `compaction-basic` 后端 + `command-compact` 命令 + `compaction-tool-result-pruner`（`docs/subsystems/compaction.md`）。
- 用 model 摘要，通过 `user/message` + `surfaceOp: {op:'replace'}` 把一段 surface 替换成摘要节点；`compaction/summary` 等事件 log-only 持久化（`docs/subsystems/compaction.md:11`，`docs/persistence-catalog.md:352`）。
- **局限：只做会话内压缩，不跨会话巩固，不沉淀成可长期查询的 memory 文件。**

### 2.4 跨会话召回基座（keyword 检索，已具备一部分）
- `ctx.sessionQuery` + `session-query-sqlite`：跨会话全文检索，SQLite FTS5，关键字匹配（`packages/session-query/session-query-sqlite`）。`session-query` 基接缝是"字面语义文本扫描"，**非嵌入式语义检索**（`session-query/session-query/README.md`）。
- `tool-session-query`：可选的**模型可见**工具（`session_search`/`session_event_search`），**默认未挂载**，跨会话需 cwd 认证（`session-query/tool-session-query/README.md`）。
- `context/session-reference`：把其他会话快照作为模型可见上下文注入（`packages/context/session-reference/README.md`），支持 `@label` 提及，最多 3 个引用源，读取面投影 + 预算截断。这是"引用式召回"而非"记忆库召回"。

### 2.5 上下文卸载与文件记忆
- `spill` / `spill-local` / `spill-policy`：把超大 tool 输出落盘并返回模型可读 locator（`docs/subsystems/spill.md`）。可类比"episodic 大块落文件"。
- `agent-instructions`：加载 `AGENTS.md` / `CLAUDE.md` 工作区指令并以 `<system-reminder>` 注入（`packages/context/agent-instructions/README.md`）。这是"项目规范记忆"，非个人长期记忆。

### 2.6 其他（非长期记忆，需澄清边界）
- `skill` / `skill-filesystem` / `tool-skill`：`ctx.skills` 注册表 + SKILL.md，属于"可复用能力/提示"（`packages/skill/skill/README.md`），不是事实记忆。
- `goal` / `todo`：任务状态（`goal/change`、`todo/write` 均为 log-only 事件），不是长期知识记忆。
- `storage` / `storage-json` / `storage-sqlite`：通用 KV，为插件自有状态服务，非统一记忆接口。

**关键证据（文件路径）**：`packages/core/session/src/types.ts`、`packages/core/session/src/index.ts`、`packages/session/session-persistence*/`、`packages/compaction/compaction*/`、`packages/session-query/*/`、`packages/context/session-reference/`、`packages/spill/*`、`docs/subsystems/{session,persistence,compaction,spill}.md`、`docs/persistence-catalog.md`。`examples/mcp-memory/` 表明 DSH 官方对"记忆"的定位是**第三方 MCP 服务**，见 3 节。

## 3. Existing community plugins

DSH 官方立场：记忆不内置，走 MCP。`examples/mcp-memory/` 提供三个默认关闭的参考配置，均通过 `@deepseek-ai/dsh-mcp-client` 接入（`examples/mcp-memory/README.md:5`）：

- **MCP Reference Memory**（`@modelcontextprotocol/server-memory`）：本地知识图谱，entity/relation/observation + 搜索，无需模型/embedding，JSONL 落盘。已在 DSH 示例里（`mcp-reference-memory.cordis.yml`）。keyword 子串搜索，无语义、无自动摘要、无遗忘策略。
- **Memorix**（`memorix@1.3.0`）：本地启发式记忆，可无 LLM 运行，Git-project 身份。
- **Engram**（`engram@v1.20.0`）：Go 写的历史记忆工具，拥有自己的存储与项目归属。

OpenClaw 记忆设计（对照基准）：
- 「Memory is just Markdown」：`MEMORY.md`（curated 长期）+ `memory/YYYY-MM-DD.md`（daily notes，episodic）+ episodic tier + "dreaming/consolidation"（门控后 model 混淆、合并、supersede、dedupe，写入 MEMORY.md/USER.md，摘要入 DREAMS.md）。参考 https://docs.openclaw.ai/concepts/memory-architecture 、https://docs.openclaw.ai/concepts/memory 、https://gaodalie.substack.com/p/i-studied-openclaw-memory-system
- 会话结束/压缩前 flush unwritten context 到 daily note，防压缩吞掉历史。

通用 agent memory 层（需适配，均为外部服务/较重）：
- **mem0**：universal memory layer，vector + graph，agent 用 API 读写，云/自托管。https://github.com/mem0ai/mem0
- **Letta / MemGPT**：stateful agent 运行时，inner/outer monologue + 可自编辑 memory blocks。
- **Zep**：temporal knowledge graph，面向生产长会话（有额度计费）。
- **Cordis/DSH 生态**：未发现独立的 DSH 原生 memory plugin；官方推荐 = MCP 方式。

**结论**：DSH 已有 MCP 接入记忆服务的成熟通道（含 OpenClaw 风格的文件记忆、KG 记忆），可直接采纳；通用外部层（mem0/Zep/Letta）需适配成 MCP 或代之以原生插件，较重。

## 4. Evidence

- 无 memory 包：`packages/` 顶层目录清单无 memory；`find -iname "*memory*"` 仅 `examples/mcp-memory` + node_modules。
- 事件溯源 + surface：`docs/subsystems/session.md`（session-event 表面/持久化契约）、`docs/persistence-catalog.md`（各事件 surface 徽标）。
- 持久化完备：`docs/subsystems/persistence.md`、`packages/session/session-persistence*/src/index.ts`。
- 会话内压缩：`docs/subsystems/compaction.md`（compaction/* 事件、surface replace）。
- 跨会话关键字召回：`packages/session-query/session-query-sqlite`（FTS5）、`packages/session-query/tool-session-query`（opt-in 模型可见 session_search，cwd 认证）。
- 引用注入：`packages/context/session-reference/README.md`（会话快照注入，maxReferences=3）。
- MCP 记忆接入：`examples/mcp-memory/README.md` + 三个 cordis.yml。
- OpenClaw/mem0/Letta/Zep 检索：见第 3 节 URL。

## 5. Gaps

以第 1 节四项行为逐一对照；持久化与隔离 DSH 已强，巩固完全缺失、召回仅部分（关键字、无语义），无 curated 长期记忆：

| 能力 | 状态 | 缺口 |
|---|---|---|
| 跨会话**巩固 consolidation** | ❌ 缺失 | 只有会话内 compaction 摘要；无跨会话把 episodic 日志沉淀成 curated 长期事实（MEMORY.md 等价物）、无 "dreaming/merge/supersede/dedupe"、无压缩前 flush 到记忆。 |
| 跨会话**召回 recall** | ⚠️ 部分 | `session_query`/`tool_session_query` 提供关键字全文召回（FTS5，opt-in 挂载），`session-reference` 提供会话引用，但**无语义/embedding 检索、无 curated 长期记忆库召回**（当前召回=在原始会话日志里搜，而非在提炼后的事实记忆里取）。 |
| 跨会话**隔离 per-agent** | ✅ 基本具备 | session 存储按会话隔离；`tool_session_query` 跨会话需 cwd 精确匹配认证；`session-reference` 需宿主显式 opt-in。缺的是"每个 agent 一份记忆命名空间"的统一抽象（现靠 cwd/session 约定）。 |
| **持久化 persistence** | ✅ 具备 | 事件溯源日志经 JSONL/SQLite 持久化，闪存检查点 + 崩溃恢复。缺的是"记忆自身（提炼结果）的持久化通道"——目前只能靠 MCP 服务自持或落文件，无第一方记忆存储。 |

**最关键缺口**：DSH 有"日志/压缩/检索"的积木，但没有把会话经历**自动巩固成长期可维护记忆**（consolidation）这一层；且召回是关键字语义，无 curated 记忆库。

## 6. Options

1. **ADAPT — 复用 DSH 已有的 MCP 记忆通道**：启用 `examples/mcp-memory`（MCP Reference Memory 或 Memorix），辅以 `tool_session_query`/`session-reference` 做召回。最低成本，契合 DSH "外部能力走 MCP" 的既有设计；缺点：无自有 consolidation，语义召回靠第三方。
2. **BUILD — 原生记忆 Cordis 插件**：注册 `session/event` 监听 → 在会话尾部/压缩前把 surface 提炼（可按 schedule/阈值）写入一个记忆存储（可复用 `storage` 或文件），暴露 model 命中的 memory tool；隔离按 session/cwd。成本中高，收益是真正补齐 consolidation + curated 记忆层。
3. **ADOPT — 接入通用记忆层**（mem0 / Zep / Letta）：能力强（语义+图谱+时间推理），但强外部依赖（云/额度/embedding），与 DSH 本地优先、MCP 化的哲学不符。
4. **DEFER — 仅依赖会话日志 + compaction + 关键字检索**：短期够用但无法真正跨会话"记得"，长期能力不足。

## 7. Recommendation

> 主推荐：**ADAPT**

**ADAPT（主推荐）**：把"记忆存储 + 检索"交给 DSH 已内置支持的 MCP 记忆服务（`examples/mcp-memory` 的 MCP Reference Memory / Memorix / Engram），并启用 `tool_session_query` 补充关键字跨会话召回。理由：DSH 官方已为此备好默认关闭的 MCP 通道，零侵入、契合"外部能力走 MCP"哲学；OpenClaw 本身是 Markdown 文件记忆，MCP Reference Memory 与 Memorix 正是文件/KG 式记忆，可直接对标。

可选子项（各一个动词）：

- **BUILD** — 原生 consolidation 插件：在 compaction 前 / 会话结束把 surface 经历用 model 提炼写入记忆服务（复用 `session/event` + `compaction` 时机 + `storage`）。理由：这是当前**唯一完全缺失**、且无法靠 ADAPT 获得的关键层。
- **ADAPT** — 用 `session-reference`（跨会话引用注入）作显式"提及式"召回，短期补 recall。理由：无需语义即可按需把相关会话快照带进上下文。
- **BUILD** — 每-agent 记忆命名空间（按 agentPreset/session/cwd 键控的记忆隔离 + 授权）。理由：现仅靠 cwd/session 约定，缺统一抽象。
- **DEFER** — 语义/embedding 召回。理由：OpenClaw 也以关键字+文件为主，V1 不急需；需要时再引入 mem0/向量。

## 8. Open questions

- **consolidation 触发点与时机**：在 compaction 前、turn 结束、还是定时批量？DSH 的 `agent/pre-step`、`compaction`、idle 机制哪个是自然锚点？
- **记忆召回模型**：是"自动注入"（把命中记忆拼进 prompt）还是"按需工具"（agent 决定是否 search memory）？前者省 token 但侵入 loop，后者贴合 DSH 现有 tool 生态（`tool_session_query` 已是后者范本）。
- **consolidation 的信任边界**：提炼结果是否可信/可写回（TRUST-BOUNDARY 视角）？OpenClaw 用门控（gated/never untrusted）防记忆注入攻击，DSH 若 BUILD 也须处理 untrusted 内容，避免记忆被污染成 prompt 注入载体。
- **记忆与 `session-reference` 是否需要统一**：跨会话引用已存在，能否复用其授权/预算机制承载 curated 记忆，而不新增一套召回面？
