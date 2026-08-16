# @agent-core/agent-definition

Agent Core 的 Agent 存在性权威（AGENT_DEFINITION_CONFIG_V1）——**声明式、只读**
的 Agent Definition 配置，取代了旧的 writable agent-registry service。

## 职责（frozen authority）

一份部署期固定的 JSON 配置回答全部 Agent 存在性问题：

- 系统里有哪些 Agent？ → `listAgents()`
- 某个 `agentId` 是谁？ → `getAgent(agentId)`
- 默认 Agent 是谁？ → `getDefaultAgent()`
- id / 名称引用解析到谁？ → `resolveAgentRef(ref)`

配置只携带**身份 + 展示**（`id` / `name` / `description?`）。不携带 persona、
workspace path、credential / grant、runtime / session / process 字段（加载时
fail-loud 拒绝）。生产写入者 = 0：运行时没有任何注册/更新/删除原语。

```json
{
  "version": 1,
  "defaultAgentId": "agt_xxx",
  "agents": [
    { "id": "agt_xxx", "name": "论文导师", "description": "..." }
  ]
}
```

## 边界

| 归属 | 组件 |
|---|---|
| Agent 存在性 / stable id / name / display / default | 本包（Agent Definition config） |
| Workspace / persona / AGENTS.md / memory | workspace-bootstrap |
| Process lifecycle | agent-router |
| Native session / runtime | DSH |
| Principal / credential / grant | Auth |

`avatar` 已删除：没有任何生产 caller 读取它（Product API 的 wire contract 里
`avatar: null` 是常量），保留只会是死 schema。`createdAt` / `updatedAt` 是旧
Registry 的内部簿记，声明式配置不需要。

## 使用

- 只读服务：`ctx.agentDefinition`（Cordis 插件，config `configFile`，默认
  `<home>/.dsh/agents.json`，必须为绝对路径）。缺失文件 = 空定义（合法状态）；
  损坏文件 = `CORRUPT_CONFIG` fail-loud。
- 部署侧写配置：`writeAgentDefinition(configFile, { defaultAgentId, agents })`
  原子写入；`adoptAgents({ configFile, agents })` 为每个新 Agent 铸造一次
  `agt_*` id、按名复用已有 stable id（Task 4 最小 adoption 机制，adoption /
  workspace 语义不进配置）。
- 一次性迁移：`convertRegistryStore(oldStore)` + CLI
  `scripts/migrate-registry-to-definition.mjs`（旧 `registry.json` → 新
  config，id 与 default 原样保留，avatar / 内部时间戳丢弃）。

## 测试

```sh
node --test "packages/agent-definition/test/*.test.js"
```

## AGENT_DEFINITION_ACCESS_V1（动态读取 + 受控修改）

Agent Definition config 保持 **single authority**；访问通过 thin mutation seam
（不是重型 Registry service）：

- `agent.definition.read`（list / get）— 所有**持有凭据**的正式 Agent 可用，
  无需 scope（Broker gateway 仍要求 MachineClient credential 作为身份证明，
  与 trusted broker 模型一致）。
- `agent.definition.write`（create / update / disable / set_default）— 只有
  **Auth grant** 覆盖 `agent.definition.write` scope 的凭据可用（auth-service
  是唯一授权权威）。**没有任何 agent id / name / role 硬编码比较**（HR_HARDCODE
  = NONE）：谁有 grant 谁就能写，完全由部署侧 authsvc 决定。
- 变更原语（`src/config.js`）：create 铸造一次稳定 `agt_*` id；update 只改
  display 字段、id 永不变；disable 保留身份但不可路由（默认 Agent 必须先
  set_default）；set_default 持久化默认选择。
- 每次写入后 `AgentDefinition.reload()` 刷新控制面内存读模型（无重启）。
- 接线：agent-definition 插件提供 `ctx.agentDefinitionAccess`（handler map），
  Broker gateway（gateway 模式）消费它；child 模式工具经既有 parent-RPC
  relay。Broker 的 generic manifest/adapter 只做很薄接线，Auth 核心与 Broker
  核心（transport/mapping/registry/relay）零改动。
