---
status: historical
as_of: 2026-08-16
superseded_by: ../../concepts/agents.md
public: PUBLIC_AFTER_SANITIZE
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-16.
> It is **not** current architecture documentation.
>
> Current documentation: [docs/concepts/agents.md](../../concepts/agents.md)

# Agent Definition Config V1 — 声明式 Agent 存在性权威

> 状态：已完成（2026-08-15）· 分支：feat/agent-definition-config-v1 · 基线：origin/main = 1c3f9a0
> 冻结结论来源：AGENT_DEFINITION_AUTH_REGISTRY_ARCHITECTURE_AUDIT_V1 —
> RECOMMENDATION = REPLACE_WITH_AGENT_DEFINITION_CONFIG（writable agent-registry
> service 生产写入者 = 0；Agent ≠ Auth Principal；Workspace 继续独立拥有
> persona/AGENTS.md/memory）。

## 1. 一句话总结

旧的 writable **agent-registry service**（`registerAgent` / `updateAgent` /
`setDefaultAgent` / 事务回滚 / 原子 store）从正式产品路径整体移除，替换为
**声明式、只读的 Agent Definition config**——Agent 存在性 / stable id / name /
display / default 的**唯一权威**。生产写入者 = 0；部署侧通过 thin mutation
seam（AGENT_DEFINITION_ACCESS_V1）受控修改。

## 2. 冻结的职责边界

| 归属 | 组件 |
|---|---|
| Agent 存在性 / stable `agt_*` id / name / display / default / disabled | **Agent Definition config**（本 PR） |
| Workspace / persona / AGENTS.md / memory | workspace-bootstrap（不动） |
| Process lifecycle | agent-router（只改读取面） |
| Native session / runtime | DSH（KERNEL_CHANGE = NONE） |
| Principal / credential / grant | Auth（AUTH_CHANGE = NONE） |

## 3. Schema（最小，不照抄 OpenClaw）

```json
{
  "version": 1,
  "defaultAgentId": "agt_xxx",
  "agents": [
    { "id": "agt_xxx", "name": "论文导师", "description": "...", "disabled": false }
  ]
}
```

- `id`：不透明 `agt_*`，**创建后永不因 rename 改变**；配置校验强制 `agt_` 前缀
  与唯一性。
- `description` 只是 display metadata；`disabled` 是唯一操作状态字段
  （ACCESS_V1 引入：保留身份、不可路由、不可为 default）。
- **删除 `avatar`**：全仓没有任何生产 caller 读取它（Product API wire 里
  `avatar: null` 是常量；Router 从不读），保留只会是死 schema。`createdAt` /
  `updatedAt`（旧 Registry 内部簿记）一并删除。
- 不新增 persona / workspace path / credential / grant / runtime / session /
  process 字段——加载时对未知字段 **fail-loud**（CORRUPT_CONFIG），任何
  persona/workspace/credential 字段都不可能偷渡进配置。
- 不变式（fail-loud，绝不静默修复）：`defaultAgentId` 必须解析到**启用**的
  Agent；非空列表必须有合法 default；id 唯一且带 `agt_` 前缀；无第二份权威文件。

## 4. 生产读取面替换（Task 2）

| 调用方 | 旧 | 新 |
|---|---|---|
| agent-router | `ctx.agentRegistry`（list/get/default + 自实现 name→id） | `ctx.agentDefinition`：listAgents / getAgent / getDefaultAgent / **resolveAgentRef**（id→name 统一在此） |
| product-api | `ctx.agentRegistry` 读 /v1/agents | `ctx.agentDefinition`（wire 契约不变：`avatar: null` 保持常量） |
| scheduler-router | `createRouterInvoker(router, { registry })` | `{ definition }`：getAgent 存在性校验（内存同步读，无 I/O） |
| agent-core-resident | `AgentRegistry` store 加载 | `AgentDefinition` config 加载（boot 校验 default 存在） |

热路径不新增任何 config/database 查询：`ensureRunning(agentId)` 与旧实现一致，
完全不读配置（definition 在构造时一次性同步载入内存）。

## 5. 删除的 mutation machinery（Task 3）

`packages/agent-registry/**` 整体删除：`registerAgent`、`updateAgent`、
`setDefaultAgent`、事务回滚（snapshot→mutate→persist）、原子 store、writable
service。verify fixture 全部迁移为**生成临时 Agent Definition config**
（`adoptAgents` / `writeAgentDefinition`），不再运行时 register。acceptance 仍可
表达：Agent A / Agent B / default agent / stock-agent adoption。

## 6. Stock adoption（Task 4）

最小等价机制：`adoptAgents({ configFile, agents })`——新 Agent 铸造一次
`agt_*` opaque id 并写入 config；已存在（同名）复用既有 stable id。默认选择
保留；无 default 时首个被采纳者成为 default（historic first-registered 语义的
声明式表达）。workspace symlink 继续属于 workspace/deployment 层；adoption /
workspace 语义**不进配置**；不做 stock cutover。

## 7. 一次性迁移（Task 6）

`scripts/migrate-registry-to-definition.mjs` + `convertRegistryStore()`：
old `registry.json` → 新 config。每个既有 stable `agt_*` id 与 default 选择
**原样保留**；avatar / 内部时间戳丢弃；目标已存在时拒绝覆盖（`--force` 显式）。
不建设 migration service / reconcile loop / database / Agent Directory /
provisioning platform。

## 8. AGENT_DEFINITION_ACCESS_V1（动态读取 + 受控修改）

Agent Definition config 保持 single authority；Manager/API = thin mutation
seam（**不恢复重型 Registry service**）：

- **读**（`agent.definition.read`: list / get）— 所有**持凭据**的正式 Agent
  可用，无 scope 要求（Broker gateway 仍要求 MachineClient credential 身份
  证明——trusted broker 姿态，缺失即 fail-closed）。
- **写**（`agent.definition.write`: create / update / disable / set_default）—
  默认 DENIED；仅当调用凭据的 **Auth grant** 覆盖 `agent.definition.write`
  scope 时 ALLOWED。授权完全由 auth-service（唯一 grant 权威）通过
  client_credentials token 请求决定。
- **HR_HARDCODE = NONE**：任何代码都不比较 agent id / name / role——"谁有
  grant 谁能写"是纯部署侧 <svc-user> 配置。
- create 铸造一次稳定 `agt_*` id；update/rename 永不改 id；disable 保留身份
  但不可路由（默认 Agent 必须先 set_default）；set_default 持久化。
- 每次成功写入后 `AgentDefinition.reload()` 刷新控制面内存读模型（无重启）。
- 接线：agent-definition 插件提供 `ctx.agentDefinitionAccess`（handler map）；
  Broker gateway（gateway 模式）消费之；child 模式工具经既有 parent-RPC
  relay。Broker 侧 = manifest 数据（`capabilities/agent-definition.js`）+
  很薄的 local-capability 分派 + 复用 token 原语导出；**Auth 核心零改动、
  Broker 核心引擎（transport/mapping/registry/relay 语义）零改动、
  KERNEL_CHANGE = NONE**。

## 9. 验证

### 单元 / 集成（276/276 PASS，`npm test`）

- agent-definition（23）：list/get/name→id/default/unknown rejection、
  stable id、adoption 复用、migration、corrupt fail-loud、avatar/多余字段拒绝、
  disabled 语义、reload、create/update/disable/set_default、access handler
  envelope。
- agent-router（23）：switch、first-contact default binding、name 解析、未知
  Agent 拒绝、restart 保持、bookmark。
- product-api（6）：HTTP /v1/agents 等四端点 + 错误信封。
- scheduler-router（9）：definition 存在性校验 → 未知 agent 变 error outcome、
  ensureRunning 不被调用。
- broker（73）：local capability 分派——read 无 scope、write grant 判定
  （deny 不执行 handler / allow 执行）、无凭据 fail-closed、未知 op fail-closed、
  handler 错误结构化。

### 真实 acceptance

- **scheduler-router-final-v1-verify：16/16 PASS**（定义配置 → Router →
  真实 DSH → 真实模型；调度存在性校验、投递链、abort 证据）。
- **stock-agent-registry-adoption-v1-verify：22/22 PASS**（真实生产
  stock-agent 经 adoptAgents 铸造一次 `agt_*` id 入配置；resident 加载配置、
  真实 canary 回合精确令牌；OpenClaw 生产 hash 全不变）。
- **agent-definition-access-v1-verify：全 PASS**（读全员可用、写默认拒绝、
  grant 放行、稳定 id、disable/set_default、单权威、HR_HARDCODE 扫描、
  真实控制面组合 boot + /v1/agents）。
- **resident boot smoke：PASS**（配置缺失 exit 2、加载 default、ready、
  SIGTERM 优雅退出）。

## 9.5 DISABLED_ENFORCEMENT（merge review FIX）

merge review 唯一 blocker（其余全部 PASS）已修复，最小改动、不重新设计：

- **Fix 1（agent-router）**：`ensureRunning(agentId)` 生命周期入口统一 enforcement
  ——`agentDefinition.getAgent(agentId)` → unknown（`AGENT_NOT_FOUND`）/
  disabled（`AGENT_DISABLED`）→ 结构化拒绝 → **NEVER spawn**（连已存在的
  binding 命中也不重新拉起）。不清 binding（历史关系保留）、Definition
  Manager 不拥有 Binding。检查是构造时一次性载入的内存读，热路径无 I/O。
- **Fix 2（scheduler-router）**：`createRouterInvoker` 用"可运行 Agent"语义——
  unknown 与 disabled 都在调用 `ensureRunning()` 前拒绝（同一结构化代码）；
  Scheduler core / job store / job ownership 零改动，被拒 job 只是 failed run
  outcome。
- 新增测试：disabled + existing binding → ingress rejected → spawn = 0；
  unknown + existing binding → rejected → spawn = 0；disabled + scheduler
  invocation → rejected → ensureRunning = 0；active Agent 行为不变（既有全套
  用例 + 真实链）；rename 保持稳定 id（既有用例 + 新用例内断言）。

## 10. 结论（最终报告）

```
AGENT_DEFINITION_CONFIG_V1 = PASS
OLD_REGISTRY_SERVICE_REMOVED = YES
SINGLE_AGENT_AUTHORITY      = YES

AGENT_DEFINITION_FIELDS      = id / name / description / disabled (+ version / defaultAgentId)
STABLE_AGENT_ID_PRESERVED    = YES
DEFAULT_AGENT_PRESERVED      = YES

ROUTER_PASS                  = PASS      (15/15 unit + 16/16 scheduler-router real + real CP boot)
PRODUCT_API_PASS             = PASS      (6/6 unit + /v1/agents on the real composition)
SCHEDULER_ROUTER_PASS        = PASS      (9/9 unit + 16/16 real chain)
RESIDENT_PASS                = PASS      (boot + ready + graceful stop; stock adoption resident 22/22)
STOCK_ADOPTION_PASS          = PASS      (22/22 real, stable agt_* preserved, OpenClaw untouched)
TESTS                        = 279/279 unit PASS

AGENT_DEFINITION_ACCESS_V1   = PASS      (22/22 real acceptance)
DEFINITION_READ_FOR_ALL_AGENTS = YES
DEFINITION_WRITE_VIA_AUTH_GRANT = YES
HR_HARDCODE                  = NONE
DYNAMIC_CREATE               = YES
DYNAMIC_UPDATE               = YES

PERSONA_CHANGE               = NONE
WORKSPACE_SEMANTIC_CHANGE    = NONE
AUTH_CHANGE                  = NONE
KERNEL_CHANGE                = NONE
READY_FOR_REVIEW             = YES
```

全仓单一 Agent 存在性权威：`packages/agent-registry` 从正式产品路径移除（含全部
mutation machinery / 事务 / 原子 store）；`ctx.agentRegistry` 全仓无残留；仅存的
`registry` 字样是历史文档与一次性迁移脚本。
