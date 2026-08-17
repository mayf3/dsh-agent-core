---
status: historical
as_of: 2026-08-15
superseded_by: ../../concepts/agents.md
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/concepts/agents.md](../../concepts/agents.md)
# Agent Registry V1 — 长期 Agent 身份注册表

> 状态：已完成（2026-08-15）· 分支：feat/agent-registry-v1 · 基线：main = 69273a9
> 产品边界：D-002 AGENT_SESSION_CHANNEL_MODEL_V1（Agent 是长期实体，固定拥有
> workspace / DSH_HOME / credential / memory，V1 API 不暴露）
> 修订（PR #4 review cleanup，2026-08-15）：去掉对 workspace-bootstrap 的源码依赖；
> D-002 idFormat 去 ULID 约束；updateAgent 并发覆盖修复；mutation 回滚；
> fail-loud 统一（悬空/缺失默认 = CORRUPT_STORE）；storeFile 绝对路径契约。

## 1. 目标与一句话总结

最终产品里，Agent 是长期存在的"数字员工/人"（论文导师、研发总监、知识管家、生活
伙伴），不是目录、进程或 Session。它拥有稳定的 `agentId` / `name` / `avatar` /
`description`，并长期拥有自己的 workspace / DSH_HOME / sessions / memory——但这些
底层资源**不暴露成产品 UI**。

本组件（`packages/agent-registry/`）是独立组件，只回答三个问题：

1. 系统里有哪些 Agent？→ `listAgents()`
2. 某个 `agentId` 对应谁？→ `getAgent(agentId)`
3. 默认 Agent 是谁？→ `getDefaultAgent()`（+ `setDefaultAgent` 显式切换）

它只持有**身份 + 展示**（D-002 Agent schema 四字段），对 Agent 的其他资源一律
不知情：不计算路径、不启动进程、不建 Session、不写 memory。

## 2. 最小设计

### 2.1 实体与 API

- `id`：不透明 `agt_` + 32 hex（`crypto.randomUUID` 派生），**由 Registry 生成，
  调用方不可指定**——唯一性由构造保证、永不复用。Registry 把 id 视为**不透明值**，
  不校验、不解释、不计算任何派生物（路径合法性由 workspace-bootstrap 收到 id 后
  自行负责，见 §3.1）。D-002 契约同步修订：idFormat = 带类型前缀的不透明字符串
  （`agt_...` / `ses_...` / `ccv_...` / `msg_...`），不再规定 ULID。
- 存储记录内部附 `createdAt` / `updatedAt`（排序与审计），API 只暴露 D-002 契约
  四字段。
- 服务形态：进程内 `ctx.agentRegistry`（Cordis 插件 `name`/`inject`/`Config`/
  `apply`，值语义 `ctx.provide`，与 workspace-bootstrap 一致）；核心 `AgentRegistry`
  类可脱离 Cordis 直接嵌入。
- 错误：`AGENT_NOT_FOUND`（对应 D-002 404）、`VALIDATION_ERROR`（对应 400）、
  `CORRUPT_STORE`（存储损坏 fail-loud）。

| 方法 | 同步/异步 | 语义 |
|---|---|---|
| `listAgents()` | 同步 | 全部 Agent，注册顺序 |
| `getAgent(agentId)` | 同步 | 不存在抛 `AGENT_NOT_FOUND` |
| `registerAgent({name, avatar?, description?})` | 异步 | 生成 id；首个注册者自动成为默认；落盘后才返回 |
| `updateAgent(agentId, patch)` | 异步 | 只改展示字段，**agentId 永不变**；`undefined` 保留、`null` 清空；merge 在串行队列内执行，并发更新互不覆盖 |
| `getDefaultAgent()` | 同步 | 无 Agent → `undefined`（合法状态，不是错误） |
| `setDefaultAgent(agentId)` | 异步 | 显式设置并持久化；未知 id 抛 `AGENT_NOT_FOUND` |

### 2.2 持久化

- 单 JSON 文档，默认 `<home>/.dsh/registry/agents.json`（config `storeFile` 可
  覆盖，**必须为绝对路径**——相对或 `~` 前缀值在构造时 fail-loud 拒绝，杜绝意外
  创建字面 `~` 目录；控制面状态放在共享 DSH home 下，与 workspace-bootstrap 的
  `~/.dsh/workspaces`、`~/.dsh/agents` 并列）。
- 文档：`{ "version": 1, "agents": { "<id>": record }, "defaultAgentId": id|null }`。
- **原子写**：tmp + rename，崩溃不会留下残缺文档；变更经内部队列串行化，并发
  变更不会交错；每次变更 `await` 落盘后才 resolve——"重启后仍存在"由构造保证。
- **最小事务语义**：snapshot → mutate → persist → success；persist 失败自动
  restore 内存快照并 reject，磁盘文档保持原状（失败路径 best-effort 清理 `.tmp`）。
- 加载：文件缺失 → 空 Registry；解析失败 / 版本不符 → 抛 `CORRUPT_STORE`
  （绝不静默重置）；**`defaultAgentId` 悬空（指向不存在的 Agent）或非空 Registry
  无合法默认 → 同样抛 `CORRUPT_STORE`**——Registry 无 delete API，此类状态只可能
  来自 store 被篡改，fail-loud 而非静默"修复"。
- 加载用同步读（构造时完成），挂载后的服务永远 ready。

### 2.3 默认 Agent 语义（含 setDefaultAgent 论证）

D-002 §7 开放问题 4 悬而未决："默认 Agent 如何确定：配置 vs 首个创建的 Agent"。
本组件给出的答案是：**首个注册的 Agent 自动成为默认** + **`setDefaultAgent` 显式
覆盖**。论证：

1. **单一权威**：`resolveChannelConversation` 首次接触要建立"默认 Agent + main
   session"的初始 Binding（D-002 §3）。目前这个默认硬编码在 Router config
   （`defaultAgentId: 'agent-demo'`）。默认 Agent 是**系统状态**，Registry 才应该是
   它的唯一权威——否则"谁是默认"散落在各组件配置里。
2. **不改配置即可切换**：一旦默认由 Registry 持有，`setDefaultAgent` 是唯一的变更
   原语；不提供它，切换默认只能改代码/配置或删库重来，与"Registry 是长期实体身份
   的唯一事实源"矛盾。
3. **成本与收益**：实现约 15 行 + 持久化一个指针字段 + 测试，换来语义闭环
   （首建默认 → 显式切换 → 重启保持，全部可测）。
4. **不默认**：V1 不做"无默认"模式（新 ChannelConversation 首接触需要确定答案）；
   空 Registry 时 `getDefaultAgent()` 返回 `undefined` 已是合法兜底。

## 3. 边界

### 3.1 与 workspace-bootstrap 的边界（已冻结的 owner）

workspace-bootstrap 是 `agentId → workspace / DSH_HOME` 路径映射的**唯一 owner**
（Integration V1 边界清理已定）。因此 Registry：

- ✅ **表达** Agent 长期拥有 workspace（身份记录与路径解耦——路径由 owner 在
  provisioning 时从同一 `agentId` 派生）；
- ❌ 不自己计算 `~/.dsh/workspaces/<id>` 或任何路径；
- ❌ 不复制 workspace-bootstrap 逻辑；
- ❌ **不依赖其源码**：Registry 对路径规则一无所知，`agentId` 作为不透明字符串
  存储；`sanitizeAgentId` 等路径合法性校验是 workspace-bootstrap 收到 id 时的
  内部职责，不在 Registry 侧复用（不为两行函数制造跨 package 源码耦合）。

### 3.2 生命周期边界

Registry 不知道 Agent 当前 PID，也不负责启动/停止任何进程；不建 Session、不读写
memory。持久化记录里只有身份字段——测试断言 store 中不含 `pid` / `process` /
`workspace` / `dshHome` / `session` / `home` 任何引用（验收项 7）。

### 3.3 本轮禁止修改

`packages/agent-router/**`、`packages/agent-session/**`、`packages/agent-memory/**`
零改动。未接入 Router（见 §5 Integration need）。

### 3.4 V1 不做

`deleteAgent`、调用方指定 id、HTTP API / 鉴权 / 多用户、workspace 播种、Agent
hierarchy、memory UI。

## 4. 验收对照（全部通过，19 个测试）

| # | 验收项 | 结果 | 证据（test） |
|---|---|---|---|
| 1 | 创建 Agent A / Agent B | ✅ | `1+2. register Agent A and B`：名称/头像/简介正确，list 按序返回 |
| 2 | agentId 唯一 | ✅ | `2. agentId uniqueness`：20 次注册 20 个互异 id；均带 `agt_` 类型前缀（opaque，不校验路径） |
| 3 | 重启后仍存在 | ✅ | `3. persistence`：同一 store 文件新建实例 → Agent 与默认指针完整恢复（含改名后的值） |
| 4 | list/get 正常 | ✅ | `4. getAgent`：roundtrip；未知 id 抛 `AGENT_NOT_FOUND`；返回对象仅四字段 |
| 5 | 更新 name/avatar 不改变 agentId | ✅ | `5. updateAgent`：改 name/avatar/description 后 id 不变；部分更新保留未动字段；重启后同一 id 下是新值 |
| 6 | 默认 Agent 语义明确 | ✅ | `6. default agent`：首建=默认、次建不夺权、setDefaultAgent 覆盖、未知抛错、重启保持、空 Registry 返回 undefined |
| 7 | 不知道 PID、不启动进程 | ✅ | `7. no process ownership`：服务面只有 6 个身份方法；store 序列化不含任何进程/路径/session 引用 |

Review cleanup 新增用例：

| 修正 | 结果 | 证据（test） |
|---|---|---|
| 并发 `updateAgent` 不互相覆盖 | ✅ | `Promise.all([{name:'A2'},{avatar:'new.png'}])` → 两者同时成立，重启后仍成立 |
| mutation 回滚（persist 失败） | ✅ | monkey-patch `persist` 抛错：mutation reject、内存不变、磁盘 store 未被污染、恢复后可继续工作 |
| fail-loud：悬空默认指针 | ✅ | store 中 `defaultAgentId` 指向不存在 Agent → `CORRUPT_STORE`，不静默清空 |
| fail-loud：非空无默认 | ✅ | 有 Agent 但 `defaultAgentId: null` → `CORRUPT_STORE`；空 Registry 无默认字段仍合法 |
| storeFile 绝对路径契约 | ✅ | 相对 / `~` 前缀值在核心与插件壳构造时均 fail-loud 拒绝 |
| 零 workspace-bootstrap 源码依赖 | ✅ | `grep -rn "sanitizeAgentId\|expandTilde" packages/agent-registry/` 无命中（源码与测试均已移除） |

附加：原子写（无 `.tmp` 残留、文档完整）、损坏 store fail-loud、并发变更串行且
全部落盘、输入校验（空名/错类型拒绝且无副作用）、插件壳（`apply` 挂载
`ctx.agentRegistry`、默认 storeFile 为绝对路径）。

运行：

```sh
node --test "packages/agent-registry/test/*.test.js"        # 19/19
node --test "packages/workspace-bootstrap/test/*.test.js"   # 13/13（回归，未改动）
node -e "JSON.parse(require('fs').readFileSync('docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.api.json','utf8'))"  # D-002 契约校验
```

## 5. Integration need（只记录，不在本 PR 接入 Router）

Router（`packages/agent-router`）后续接入 Registry 时的挂点：

1. **默认 Agent 单一权威**：`resolveChannelConversation` 首次接触建立 Binding 时，
   用 `agentRegistry.getDefaultAgent()` 取代 config `defaultAgentId`（后者降级为
   兜底/seed 配置）。
2. **入站校验**：Binding 命中前先 `agentRegistry.getAgent(agentId)`——未知 id 不再
   静默 `ensureRunning`（当前会为任意字符串建 workspace 起进程）。
3. **provisioning 时序**：控制面启动时对 Registry 中每个 Agent 调
   `workspaceBootstrap.ensure(agentId)`（路径 owner 职责，Registry 不参与）。
4. **确定性播种（可选）**：如需"预置员工"而非运行时注册，评估
   `registerAgent` 增加可选 `id` 参数 + `AGENT_ALREADY_EXISTS` 幂等语义；V1 保持
   只生成 id，不动。
5. **Session/Memory 组件**：`agentId` 是它们的 join key；Registry 是"哪些 agentId
   合法"的唯一事实源。

## 6. 结论

Agent Registry V1 完成：长期 Agent 身份（id 不可变、唯一、opaque）+ 默认
Agent 语义闭环 + 原子、事务化 JSON 持久化，进程重启后 Registry 完整存在。组件
零耦合于进程/路径/Session，对 workspace-bootstrap **零源码依赖**（路径合法性由
owner 自行负责），fail-loud 语义统一；Router 接入以 Integration need 记录，留待
后续 PR。
