# @agent-core/agent-registry

Agent 是长期存在的"数字员工/人"（不是目录、进程或 Session）。本组件是它的**身份
注册表**：回答系统里有哪些 Agent、某个 `agentId` 是谁、默认 Agent 是谁。

只持有身份 + 展示数据（D-002 Agent schema：`id` / `name` / `avatar` /
`description`）。Agent 的 workspace / DSH_HOME / sessions / memory 由各自组件
拥有，本组件**不计算任何路径、不启动进程、不触碰 Session**（边界见
`docs/reports/agent-registry-v1.md`）。`agentId` 是不透明字符串，Registry 只生成
与存储，**不校验、不解释**——路径合法性由 workspace-bootstrap 收到 id 后自行负责，
本组件对它有**零源码依赖**。

## 快速开始

```js
import { homedir } from 'node:os'
import { join } from 'node:path'
import { AgentRegistry } from '@agent-core/agent-registry/registry'

// storeFile 必须是绝对路径（不做 `~` 展开，传相对/`~` 前缀值会 fail-loud）
const registry = new AgentRegistry({ storeFile: join(homedir(), '.dsh', 'registry', 'agents.json') })

const mentor = await registry.registerAgent({
  name: '论文导师',
  avatar: 'https://cdn.example.com/avatars/thesis-mentor.png',
  description: '帮我改论文、做文献综述、模拟答辩',
})
const director = await registry.registerAgent({ name: '研发总监' })

registry.listAgents()          // [mentor, director]（注册顺序）
registry.getAgent(mentor.id)   // { id, name, avatar, description }
registry.getDefaultAgent()     // mentor —— 首个注册者自动成为默认
await registry.setDefaultAgent(director.id) // 显式切换（持久化）
await registry.updateAgent(mentor.id, { name: '论文导师 v2' }) // id 不变
```

## Cordis 插件

```js
// cordis.patch.yml / bundle 中挂载后，任何同进程插件可：
const registry = ctx.get('agentRegistry')
```

`apply(ctx, config)` 挂载 `ctx.agentRegistry` 服务；`Config.storeFile` 可覆盖
默认存储位置 `<home>/.dsh/registry/agents.json`（**必须为绝对路径**，相对或
`~` 前缀值在构造时 fail-loud 拒绝）。

## API

| 方法 | 说明 | 错误 |
|---|---|---|
| `listAgents()` | 全部 Agent（注册顺序），同步 | — |
| `getAgent(agentId)` | 按 id 解析，同步 | `AGENT_NOT_FOUND` |
| `registerAgent({name, avatar?, description?})` | 注册新 Agent，**id 由 Registry 生成**（`agt_` + 32 hex，永不复用）；首个注册者自动成为默认 | `VALIDATION_ERROR` |
| `updateAgent(agentId, {name?, avatar?, description?})` | 只改展示字段，**agentId 永不变**；`undefined` 保留原值，`null` 清空 avatar/description | `AGENT_NOT_FOUND` / `VALIDATION_ERROR` |
| `getDefaultAgent()` | 默认 Agent；无 Agent 时返回 `undefined`（合法状态） | — |
| `setDefaultAgent(agentId)` | 显式设置默认（持久化） | `AGENT_NOT_FOUND` |

## 持久化

单 JSON 文档（默认 `<home>/.dsh/registry/agents.json`），**原子写**（tmp +
rename），变更串行化；进程重启后 Registry 完整保留。每次 mutation 具备最小事务
语义：snapshot → mutate → persist → success；**persist 失败自动回滚内存并
reject**，磁盘文档保持原状。损坏文件、悬空默认指针、非空 Registry 无合法默认 →
一律 `CORRUPT_STORE` **fail-loud**，绝不静默修复。V1 为**单写者**语义：一个控制面
进程内只允许一个 Registry 实例写同一 store 文件。

## V1 不做

- `deleteAgent`（无删除语义）
- 调用方指定 id（唯一性由构造保证；确定性播种留待控制面集成时评估）
- HTTP API / 鉴权 / 多用户
- workspace 播种（那是 workspace-bootstrap `ensure` 的职责）

## 测试

```sh
node --test "packages/agent-registry/test/*.test.js"
```
