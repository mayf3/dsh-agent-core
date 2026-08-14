# Agent Session V1 — 产品 Session 与 DSH native session 的映射结论

> 状态：已完成（2026-08-15）· 分支：feat/agent-session-v1 · 基线：main = 69273a9
> 产品边界：D-002 AGENT_SESSION_CHANNEL_MODEL_V1（已冻结：Agent 是长期实体；每个
> Agent 恰好一个 main；normal Session 可创建/归档；Session 属于 Agent；Channel
> 不拥有 Session）

## 1. 目标与一句话总结

本轮回答一个问题：**Agent Core 产品 Session 与 DSH native session 之间需要什么？**

一句话结论：

> **产品 Session = DSH native session，直接同一，零 mapping、零新组件、零新表。**
> DSH 的 SessionId 就是产品 sessionId（`main`、`normal-1` 原样落盘为
> `<agent home>/sessions/<project>/<id>/session.jsonl` 的 header id）；"每个 Agent
> 恰好一个 main"由 DSH 身份语义 + 确定性 id 结构性保证；normal session 与 main
> 走完全相同的 create/resume 机制；archive/delete 是产品元数据语义，落在 DSH
> 轨迹之外（本轮不实现，属 API milestone）。

因此本轮**不创建** `packages/agent-session/`（论证见 §4）：身份模型不需要任何组件，
PoC 以真实 kill/restart 证明；元数据目录（title/kind/archived）的消费者（HTTP 12
API）明确不在本轮范围，"不要为了凑接口而实现"。

## 2. 调查：六个问题逐一回答

### Q1. 产品 sessionId 是否应该直接等于 DSH sessionId？

**是，直接相等，不需要任何转换。** 证据链（均来自 DSH checkout 实证）：

1. **SessionId 是"未校验的 branded string"，任何字符串都是合法 session id。**
   `packages/core/session/src/types.ts`：`type SessionId = Branded<'SessionId'>`，
   `SessionId(id) = id as SessionId`（纯编译期 cast，零运行时成本）；jsonl 后端注释
   明言 "A `SessionId` is an unvalidated branded string"。
2. **身份就是 id 本身。** 持久化协调器
   （`session-persistence/src/coordinator.ts`）在 create 已存在的 id 时抛错：
   "Do NOT clobber an existing session: the SessionId IS the identity." →
   `session "${meta.id}" already exists in this backend`。不存在"产品 id ↔ 存储 id"
   两个身份。
3. **落盘路径由 id 确定，且可逆。** `<home>/sessions/<projectKey(cwd)>/<encodeSegment(id)>/session.jsonl`；
   `encodeSegment` 对任意 JS 字符串单射（安全码元原样、其余 `~XXXX` 转义），任意
   产品 id 无损往返；header 第一行原样记录 `"id":"<产品 id>"`（PoC 实证
   `"id":"main"` / `"id":"normal-1"`）。
4. **唯一性由后端强制。** `list()` 扫描同一 home 下所有 project 目录时，发现跨
   project 重名 id 直接抛 "duplicate JSONL session id ... appears in multiple
   project directories"——同一 Agent home 内 session id 全局唯一是后端不变量。
5. **作用域 = DSH_HOME。** 一个 Agent = 一个 DSH_HOME + 一个 workspace（cwd）。
   产品 sessionId 在 Agent 内唯一由构造保证；同一 id（如 `main`）出现在不同
   Agent 的不同 home 里互不可见、绝不碰撞——这正是"不需要 mapping"的空间基础。
6. **进程内 agent id == session id。** `agents.register` 强制
   `agent id "..." must match session id "..."`——一个 session 就是一个 agent
   实例，身份单一。

结论：产品侧与 DSH 侧是同一个 id 的同一份轨迹，双向 1:1，无任何变换。mapping 表
只会制造第二个事实源。

### Q2. main 为什么当前可以直接叫 "main"？

三个原因，都指向同一个事实：**"main" 不是产品魔法，它就是 DSH 原生命名。**

1. 任何字符串都是合法 SessionId（Q1-1），"main" 只是其中之一；落盘即
   `<home>/sessions/<project>/main/session.jsonl`，header `"id":"main"`。
2. **DSH 自己的约定就是这个**：agent-loop 的配置式启动里，主 agent 的 id 就是
   `'main'`（`agents: [{ id: 'main', sessionId, ... }]`，见
   `core/agent-loop/tests/config-session-id.spec.ts` 等）。Agent Core 用 "main"
   恰好顺应 DSH 惯例，而不是发明新约定。
3. 确定性 = 幂等：固定 id → 固定路径 → 固定轨迹 → 重启必 resume 不重建
   （Q4 展开）。Router 的 `defaultSessionId: 'main'`（D-002：switchAgent 未传
   sessionId 固定进入 main）与 DSH 命名直接对齐。

### Q3. 是否真的需要 mapping layer？

**不需要。** 论证：

- mapping 能提供的全部能力（id 转换、轨迹定位、resume 句柄）已被 Q1 的同一性
  覆盖——产品 id 本身就是存储 key。mapping 是纯重复。
- mapping 的成本是真实的：create/delete/GC 时的双写同步、重启后的对账、两份
  事实源漂移。集成 V1 的现有链路（binding → (agentId, sessionId) → turn）已用裸 id
  跑通真实飞书链路，说明产品消费面不需要任何转换层。
- 产品真正缺的是**元数据**（title/kind/archived/lastActiveAt），不是 id 映射——
  而元数据连消费者都还没有（HTTP API 本轮明确不做），连它都可以推迟（§4）。

PoC 直接证明：kill -9 → 重启 → 两个 session 各自 resume、互不串——全程零产品侧
簿记。稳定性不是靠层换来的，是 DSH 身份语义自带的。

### Q4. 如何保证每个 Agent 恰好一个 main？

**三层结构性保证，零产品表：**

| 层 | 机制 | 出处/证据 |
|---|---|---|
| 1. 确定性 id | D-002 冻结："main" 固定；路径 `<home>/sessions/<project>/main/` 确定性 | D-002 §2.2 / §3 |
| 2. DSH 身份强制 | 对已存在 id 再次 create 抛 `session "main" already exists`——第二个 main 物理上造不出来 | coordinator.ts "SessionId IS the identity" |
| 3. resume-first 创建 | demo-server `getOrCreateSession`：先 `persistence.list()`，header 存在 → `agents.resume`，缺失才 `agents.create`——重启后对 main 的首次 prompt 必然 resume，绝不重建 | packages/demo-server/src/index.js |
| + 单写者 | owner-guard 保证同一 home 同时只有一个 owner 进程，create/resume 无并发竞争 | process-model test F |

PoC 实证：kill -9 → 重启 → demo-server 日志 `session main resumed (26 events)`
（不是 created）；home 下 `main` 目录**恰好一个**；header id 仍是 `main`。

### Q5. normal session 如何创建和 resume？

**与 main 完全同一机制，无任何特判代码：**

- 创建：对一个**新 id** 的首次 prompt → demo-server 查 `persistence.list()` 无
  header → `agents.create({ sessionId })` → 落盘新轨迹。
- resume：对**已存在 id** 的 prompt → header 命中 → `agents.resume({ resumeSessionId })`
  → 加载 JSONL 重建会话，模型继续原对话。
- id 的独特性由产品侧铸造（uuid/slug，属 API milestone 的职责）；铸造后唯一性由
  后端跨 project 查重兜底（Q1-4）。
- PoC 实证：`normal-1` 与 `main` 在同一 PID（37096）创建、同一 home 两个独立
  artifact；kill 后在同一新 PID（37169）各自 resume（各 26 events）、互不串。

### Q6. archive/delete 与 DSH trajectory 的关系？

DSH 轨迹是 append-only 事件日志，**没有 archive/delete 语义**——这两个是产品概念
（D-002：`main` 不可归档/删除；`normal` 可归档/删除）。关系如下：

| 产品操作 | 对 DSH trajectory 做什么 | 语义 |
|---|---|---|
| archive（软归档） | **什么都不做**——轨迹原样保留，继续可 resume；只在产品元数据里翻转 "archived" 标志（列表隐藏） | 归档不销毁记忆，是纯展示/组织语义 |
| delete（硬删除，仅 normal） | 删除 artifact 目录 `<home>/sessions/<project>/<id>/` | 操作前提：该 session **不 live**（无运行中 handle；进程已 dispose 该 session 或已退出）——coordinator 会向这个确切文件 append，live 时删除会破坏追加 |
| lastActiveAt / 排序 | header 无此字段；可由轨迹尾部事件时间推导（或入元数据 sidecar） | D-002 用于排序与清理决策 |
| createdAt | DSH header 已带（epoch ms） | 产品直接读取，无需复制 |

清理（归档超保留期自动硬删）是控制面定期任务，属后续 milestone（D-002 §3）。

### 元数据落点设计备忘（API milestone 时实现，本轮不做）

DSH header 只有 version/id/createdAt/cwd，没有 title/kind/archived/lastActiveAt。
而 DSH 明确把 session 目录预留为 "future session-local artifacts"
（`sessionDir` 文档注释）。因此推荐：

> **`<home>/sessions/<project>/<id>/meta.json`，由 per-agent 进程写入**（home 的
> 唯一写者，遵守单写者纪律），控制面经 session-list 协议读取。
> 备选：控制面侧按 agentId+sessionId 的独立 catalog——仅当控制面需要在 Agent
> 进程未运行时回答 list 才值得（API milestone 按真实需求裁决）。

## 3. 真实 PoC evidence（2026-08-15）

驱动：`scripts/agent-session-v1-poc.mjs`。复用 production 客户端
（`packages/agent-router/src/process.js` 的 `AgentProcess`——与 Integration V1
Router 完全相同的代码路径）驱动 per-agent DSH 进程（`dsh --profile
agent-core-demo`）；PoC 零新增组件、零 DSH 改动。运行方式：

```sh
DSH_HARNESS_ROOT=<deepseek-harness checkout> node scripts/agent-session-v1-poc.mjs
```

场景与完整日志（Node v25.6.1，provider opencode-go / model deepseek-v4-flash）：

```
=== boot 1: create sessions (codewords ASV1-MAIN-836I / ASV1-N1-RQSI) ===
[router] agent agent-a ready pid=37096 (919ms)
[router] agent agent-a: session main created (0 events)
[router] agent agent-a: session normal-1 created (0 events)
PASS  BOOT1_TWO_SESSIONS_CREATED — main + normal-1 created on pid 37096
PASS  BOOT1_DATA_ISOLATION — each jsonl contains only its own codeword

=== crash: kill -9 37096 ===   （非优雅退出，无 flush）

=== boot 2: resume both sessions from persistence ===
[router] agent agent-a ready pid=37169 (746ms)   ← 新 PID
[router] agent agent-a: session main resumed (26 events)
[router] agent agent-a: session normal-1 resumed (26 events)
  main recall:     "ASV1-MAIN-836I"
  normal-1 recall: "ASV1-N1-RQSI"
PASS  RESUME_MAIN_ISOLATED — main resumed (26 events, pid 37169) recalls ONLY ASV1-MAIN-836I
PASS  RESUME_NORMAL1_ISOLATED — normal-1 resumed (26 events, pid 37169) recalls ONLY ASV1-N1-RQSI
PASS  EXACTLY_ONE_MAIN — one main artifact after crash+restart (identity, not a copy)
PASS  APPEND_AFTER_RESUME — both resumed trajectories keep appending in the same files
PASS  GRACEFUL_SHUTDOWN — pid 37169 exited 0, owner lock released
```

验收对照：

| 验收项 | 结果 | 证据 |
|---|---|---|
| Agent A 下有 main + normal-1 两个会话 | ✅ | 同一 home 下两个独立 artifact（下） |
| main 只记得 main 的 codeword | ✅ | resume 后 recall `"ASV1-MAIN-836I"`，不含 `ASV1-N1-*` |
| normal-1 只记得 normal-1 的 codeword | ✅ | resume 后 recall `"ASV1-N1-RQSI"`，不含 `ASV1-MAIN-*` |
| 两者不串（双向） | ✅ | 模型层：双方 recall 互不含对方词；数据层：见下 |
| kill DSH process → restart → 两个 session 都恢复 | ✅ | 新 PID 37169；`main`/`normal-1` 均 `resumed (26 events)` |
| 数据层隔离 | ✅ | main 日志含 MAIN×5 / N1×0；normal-1 日志含 N1×5 / MAIN×0 |

落盘证据（同一 Agent home，两个会话目录，header id 即产品 id）：

```
sessions/--…-agent-a-workspace--/main/session.jsonl      # 首行: {"type":"session","version":0,"id":"main",...}
sessions/--…-agent-a-workspace--/normal-1/session.jsonl  # 首行: {"type":"session","version":0,"id":"normal-1",...}
```

说明：PoC 收尾的优雅关闭绕开了 `AgentProcess.shutdown()` 的一个既有 bug
（`setTimeout(...).then(...)`，见 §5-1），用脚本内局部 helper 完成——那是清理路径，
不影响本 PoC 的 kill/restart 证据。

## 4. 为什么本轮不建 packages/agent-session/

任务允许"调查确认需要独立组件"才创建。调查结论是：**身份模型不需要任何组件**：

1. 身份/轨迹/resume 全部由 DSH 原生提供且被 PoC 证明稳定（§2/§3）——组件没有可
   实现的剩余职责。
2. 唯一可能的内容是会话元数据目录（title/kind/archived），其消费者是 HTTP 12 API
   （D-002 端点 #3–#7），而 API 明确不在本轮范围；Router 现有链路只用裸 id，已
   跑通。现在实现 = 为不存在的消费者造接口 = "为了凑接口而实现"。
3. 元数据落点（sidecar vs 控制面 catalog）需要 API 的真实约束（是否无进程时也要
   list）才能裁决，提前定案有返工风险（§2-Q6 备忘）。

因此本轮交付 = **模型结论 + 真实 PoC 证据 + Integration need 记录**，零组件零表。
API milestone 落地时，本报告的 Q1–Q6 结论是 load-bearing 的：无论元数据 catalog
放哪，产品 sessionId 都直接等于 DSH sessionId。

## 5. Integration need（只记录，本轮未改 Router）

1. **`AgentProcess.shutdown()` 优雅关闭 bug**（packages/agent-router/src/process.js
   ~L193）：`new Promise(r => setTimeout(r, ms).then(...))` —— 现代 Node 的
   `setTimeout` 返回 Timeout 对象，没有 `.then`（PoC 在 Node v25.6.1 实证抛
   `setTimeout(...).then is not a function`）。Router 的 teardown（插件停止时对
   全部 owned 进程 `proc.shutdown()`）会命中。**Router should** 改用 promise 包装
   的计时器。本轮按边界未修改。
2. **API milestone 的 Session 端点挂点**：**Router should** 实现 D-002 #3–#7 时——
   `createSession` = 铸造全局唯一 id + 首条消息惰性 create（现有协议已支持任意
   id）；`listSessions` = `persistence.list()` header（createdAt 现成）+ 元数据
   sidecar（§2-Q6 设计）；`archive` = 只翻元数据标志，**不碰轨迹**；
   `deleteSession` = 删除 artifact 目录，前提是 session 不 live；`main` 保护由
   D-002 语义（禁止 archive/delete）+ DSH 身份强制（无法重建第二个）双保险。
3. **保持"每 Agent 单一 cwd"约束**：后端对同一 home 内跨 project 重名 id 抛错
   （Q1-4）——Agent 必须始终以唯一 workspace 为 cwd（现状已由 workspace-bootstrap
   保证），后续不得引入多 cwd 会话。
4. **可选**：demo-server 协议增加 `session/list`（返回 persistence.list() 头），
   供 API 在不 prompt 的情况下读目录——API milestone 需要时再加，本轮不加。

## 6. 结论

Agent Session V1 完成：

- **模型结论**：产品 Session 与 DSH native session 直接同一（Q1–Q6），零 mapping、
  零新表；"恰好一个 main"由确定性 id + DSH 身份强制 + resume-first 创建结构性
  保证；normal 与 main 同机制；archive/delete 是轨迹之外的元数据语义。
- **真实 PoC**：Agent A（main + normal-1）→ kill -9 → 重启 → 两个 session 各自
  resume（新 PID、各 26 events）、各自只记得自己的 codeword、双向不串、数据层零
  交叉、main 恰好一个——8/8 PASS，evidence 见 §3。
- **组件决策**：不建 `packages/agent-session/`（§4）；元数据 catalog 推迟到 API
  milestone 按真实需求裁决。
- **边界遵守**：`agent-router/**`、`agent-registry/**`、`agent-memory/**` 零改动；
  未做 Feishu / HTTP 12 API / Memory / Mobile / Auth / scheduler；Router 需要改的
  只以 §5 Integration need 记录。
