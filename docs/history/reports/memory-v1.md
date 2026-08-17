---
status: historical
as_of: 2026-08-15
superseded_by: ../../concepts/workspace-and-memory.md
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/concepts/workspace-and-memory.md](../../concepts/workspace-and-memory.md)
# Agent Memory V1 — 实现报告

> 状态: 已实现并真实验收（2026-08-15）· 分支: feat/agent-memory-v1 · 基线: main = 69273a9
> 决策: `docs/decisions/MEMORY_V1.md`（D-003）· 调查: `docs/investigations/memory.md`、
> `docs/CAPABILITY_MATRIX.md` §1.2/§2 裁决 3

## 1. 一句话总结

Agent Core Memory V1 做的是 **Agent Core memory glue**（不是 Memory 平台）：一个
file-first 的 per-agent 长期记忆插件（`packages/agent-memory/`），把「Session
trajectory ≠ Agent long-term memory」用最小胶水层变成事实 —— 记忆就是 agent
workspace 里的 `MEMORY.md`（curated）+ `memory/YYYY-MM-DD.md`（episodic），每个
agent 物理隔离；consolidation 在 `turn/end` 由 LLM 提炼，失败时原始证据永远留在
daily note（可靠 fallback）。参考并适配了 `@modusensus/dsh-mneme` 的条目格式与
工具集（file-first 取代其 SQLite 主存储 + Markdown 镜像双写）。

## 2. 七个核心问题的答案

| # | 问题 | 答案 |
|---|---|---|
| 1 | 每个 Agent 的长期 Memory 放在哪里？ | **Agent 自己的 workspace 内**：`<workspace>/MEMORY.md`（curated，唯一事实源）+ `<workspace>/memory/YYYY-MM-DD.md`（episodic daily notes）。agentId→workspace 映射复用 `@agent-core/workspace-bootstrap`（D-002：该映射唯一 owner）。不放 DSH home（那是运行时：sessions/settings/credentials）。 |
| 2 | Agent A/B 如何物理/逻辑隔离？ | **物理隔离**：不同 agentId → 不同 workspace 目录 → 不同 MEMORY.md 文件。插件运行在 per-agent 进程中（one agent per process + per-agent DSH_HOME/workspace 是既有架构），agentId 由 `config.agentId` / `$DSH_AGENT_ID` / cwd basename 解析，所有文件操作天然锁在该 agent 目录内。**不存在全局记忆库**。真实验收中专门验证了「把两个 agent 指到同一个文件」的反例：A 与 B 的记忆互相污染（见 §5 教训），这正是物理隔离必要性的证据。 |
| 3 | 新 Session 怎么拿到长期 Memory？ | **自动注入 + 按需工具**：`systemPrompt.context({name:'memory', order:90})` 在每次 prompt 装配时**同步重读** MEMORY.md（`loadEntriesSync`，memory 块优先注入 preference/importance≥3 的 decision/project，上限默认 6 条 / 2400 字符），同时注册模型可见工具 `memory_save/search/list/update/delete/consolidate`。新 session（甚至同一进程内的新 sessionId、或进程重启后）首轮上下文即含记忆；人工编辑在下一轮立即生效（file-first）。 |
| 4 | 什么时机 consolidation？ | **`turn/end` 事件 + 防抖**（默认 3s，`session/event` 监听）；另提供显式路径：模型可调 `memory_consolidate` 工具，或外部调用服务 `consolidate(agentId, sessionEvidence)`。每次只提炼该 session 自上次 consolidation 以来的**新增** surface 证据（按 event seq 水位去重，避免重复提炼旧 turn）。 |
| 5 | consolidation 输入是什么？ | **Session surface 证据**：直接用户消息（`user/message`，`source.kind === 'user'`，排除插件注入上下文）+ 助手文本回复（`assistant/message`），有界（最近 40 条）。LLM 按固定 prompt 提炼 2-3 条 `{type,title,content,importance}`；输出逐条 validate（type/title/content 白名单），坏输出整单丢弃不落盘（防记忆注入污染）。 |
| 6 | 人怎么直接查看/编辑/删除？ | **直接编辑 MEMORY.md**（任何编辑器）。file-first：机器每次写入前重新读盘（read-modify-write + 原子 rename），人工修改永远优先、不会被机器覆盖；删除 = 删掉对应 entry 块（`## title` + 元数据行 + 正文 + `---`）。条目格式适配 mneme 的 Markdown 镜像格式，round-trip 解析有测试覆盖（含「正文里长得像元数据的行不会伪造条目」）。 |
| 7 | Memory plugin 失败后，怎么 fallback？ | **三层 fallback**：(a) consolidation 每次先把原始证据 append 到当日 daily note —— LLM 不可用/输出非法/为空时证据仍在 episodic 层，MEMORY.md 不受污染；(b) 注入失败降级为空上下文，agent 照常工作；(c) 记忆是纯文件，进程崩溃/会话清理/插件重启都不丢。 |

## 3. 组件

| 组件 | 内容 |
|---|---|
| `packages/agent-memory/` | 纯 core（`paths.js` agentId→记忆文件路径；`memory.js` file store：parse/render/CRUD/dedupe/atomic write/daily notes/consolidate with fallback）+ Cordis 插件（`index.js`：`ctx.agentMemory` 服务 + 6 个模型工具 + systemPrompt 注入 + turn/end consolidation）+ 24 个 node:test 单元测试 |
| `bundle-memory/` | bundle 补丁层：向 per-agent profile 插入 `@agent-core/agent-memory` 行 |
| `profile-memory/` | per-agent 组合：`dsh-base + @agent-core/bundle-demo + @agent-core/bundle-memory`（demo-server 的 resume-aware JSON-RPC + owner-guard + memory），persona 覆盖为允许 memory 工具 |
| `scripts/memory-v1-verify.mjs` | 真实验收驱动（真实 DSH 进程 + 真实模型 turn） |

### 服务面（Agent Core memory glue）

```js
ctx.agentMemory = {
  agentId, workspace, memoryFile,
  load(),                                  // load(agentId) — 解析 + 读 MEMORY.md
  renderForContext(),                      // renderForContext(agentId) — 注入文本
  update(entry),                           // update(agentId, {type,title,content,...})
  remove(id), delete(id),
  search(query),
  list(),
  consolidate(evidence, {session}),        // consolidate(agentId, sessionEvidence)
  readDailyNotes(opts),
}
```

纯函数面（无 Cordis，可直接被控制面/人工工具调用）：
`load(agentId)` / `renderForContext(agentId)` / `update(agentId,…)` /
`consolidate(agentId, evidence, {distill})` 均在 `src/memory.js` 导出。

## 4. 与既有结论/参考的关系

- **mneme 适配**（不是搬抄）：取其「Markdown 镜像条目格式（`## title` + 元数据行 +
  `---`，人工编辑回读稳健）」与「6 工具 + turn/end 摘要 + 决策清单校验」的成熟
  思路；改掉它的全局 `~/.dsh/memory/memory.db`（破坏 per-agent 隔离）与
  SQLite+镜像双写（违背 file-first）——V1 中 **MEMORY.md 就是库**，无 SQLite。
- **CAPABILITY_MATRIX**：落实裁决 3（文件记忆为主）；consolidation BUILD 项完成；
  召回 = 注入 + 关键字工具（语义召回 DEFER 不变）。
- **workspace-bootstrap 报告**：其否决表明确「MEMORY.md 由 memory/consolidation
  层写入维护、不由 bootstrap 播种」——本分支正是那个消费者；workspace 映射继续由
  workspace-bootstrap 单一持有，agent-memory 只 import 其 `paths`。

## 5. 真实验收（PoC evidence）

驱动：`node scripts/memory-v1-verify.mjs`（真实模型 deepseek-v4-flash，每 agent
独立 `dsh --profile agent-core-memory` 进程，独立 home/workspace，进程间 kill 重启）。

> 证据为验收运行时输出，见下方附录（首次运行发现并修复了一个隔离 bug：插件曾从
> cwd basename 推导 agentId，而验收驱动的 workspace 目录名不是 agentId，导致两个
> agent 写入同一个全局 MEMORY.md —— 两 agent 记忆互相污染。修复：agentId 优先取
> `$DSH_AGENT_ID`（进程启动方知道 id），cwd basename 仅作标准布局的 fallback。
> 该反例恰好证明了「不做物理隔离就会串话」。）

### 验收清单

1. **P1A** Session s1 中 A 用 `memory_save` 记住 ALPHA → A 的 MEMORY.md 含 ALPHA、
   不含 BETA；进程 kill。
2. **P1B** 新进程 + 新 session s2：A 答出 ALPHA（自动注入或搜索），且答不出 BETA。
3. **P1C** B 记住 BETA：B 的 MEMORY.md 含 BETA、不含 ALPHA；新 session t2 答出
   BETA、不含 ALPHA。
4. **P2** Session c1 无工具调用地产生事实（生日 1990-01-01）→ turn/end 自动
   consolidation 把提炼条目写入 MEMORY.md（含 `consolidation:session:c1` 溯源）+
   daily note 落原始证据 → 新 session c2 从记忆答出生日。
5. **P3** 人工直接编辑 MEMORY.md（追加「favorite color 绿色」条目 + 改写生日值）→
   新 session c3 反映人工修改。

## 6. Integration need（本轮不集成，留给后续）

- **Router/Session 接 Memory 的挂点**：per-agent 进程 spawn 时注入 `DSH_AGENT_ID`
  （`agent-router/src/process.js` 的 `agentEnv` 是天然位置）；控制面如需跨进程读
  agent 记忆，调 `ctx.agentMemory` 服务或纯函数 `load(agentId)`（按
  workspace-bootstrap 路径解析）。
- **`agent-registry` / `agent-session`**：如果它们将来持久化 Agent 实体与
  Session→Agent 归属，memory 的 agentId 命名空间应与 registry 的 agentId 同一来源
  （当前以 workspace/`DSH_AGENT_ID` 为准）。
- **记忆浏览/编辑 UI**（dashboard 面板的 memory 浏览项）：数据面已就绪（MEMORY.md
  就是人类可读文件），面板只是浏览该文件 + 服务调用。
- **consolidation 调度**：当前 turn/end + 显式工具；将来可加定时/空闲批量 consolidation
  （输入不变：session 证据）。
- **MCP 记忆后端**：裁决 3 保留为可选后端，接法不变（MCP 通道 + tool_session_query）。

## 7. 边界确认（本轮未做）

未修改 `packages/agent-router/**`、`packages/agent-registry/**`、
`packages/agent-session/**`；未做 vector DB / embedding、Dashboard、Mobile、
HTTP API、Forum/Workflow、scheduler/daemon；未改 DSH checkout；对 `~/.dsh` 零写入
（验收运行在 `.demo/memory-v1/runtime`，全局 `~/.dsh/workspaces` 未被触碰 ——
首次 bug 运行产生的脏目录已清理）。

## 附录：验收运行输出（2026-08-15 实跑，model deepseek-v4-flash via opencode-go）

```
=== Agent Memory V1 acceptance — runtime: .../.demo/memory-v1
PASS  P1A A called memory_save in session s1
PASS  P1A A MEMORY.md contains ALPHA
PASS  P1A A MEMORY.md does NOT contain BETA
[driver] agent-a process killed (proves memory is file-backed, not in-RAM)
PASS  P1B new session s2: A answers ALPHA — reply="ALPHA"
PASS  P1B isolation: A does NOT know BETA — reply="ALPHA"
PASS  P1C B MEMORY.md contains BETA
PASS  P1C isolation: B MEMORY.md does NOT contain ALPHA
PASS  P1C new session t2: B answers BETA — reply="BETA"
PASS  P1C isolation: B does NOT know ALPHA — reply="BETA"
PASS  P2 consolidation ran: daily note holds the raw evidence — file=memory/2026-08-14.md
PASS  P2 consolidation: entries carry consolidation provenance
PASS  P2 curated MEMORY.md contains the distilled fact
PASS  P2 new session c2: A answers from consolidated memory — reply="1990-01-01"
PASS  P3 new session c3: A reflects the human-appended entry (绿色)
PASS  P3 new session c3: A reflects the human-edited birthday (1991-02-02)
=== Agent Memory V1: 15/15 checks passed
```

落地证据（agent-a 的 workspace，运行时 `.demo/memory-v1/agents/agent-a/`）：

- `MEMORY.md` 四个条目各带来源：`codeword`（Source: tool，P1 的 ALPHA）、`用户生日`
  （Source: tool，c1 中模型主动 memory_save）、`User birthday revealed`（Source:
  **consolidation:session:c1**，turn/end 自动 consolidation 提炼条目，含
  "1990-01-01"）、`favorite color`（Source: manual，P3 人工编辑，id 前缀 human-）。
- `memory/2026-08-14.md` daily note 含 c1 的原始证据（user + assistant 原文）。
- `~/.dsh/workspaces/` 无本轮任何写入（验收运行完全在 `.demo/memory-v1/` 内）。
