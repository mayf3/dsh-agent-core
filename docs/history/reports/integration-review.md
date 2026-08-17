---
status: historical
as_of: 2026-08-15
superseded_by:
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-15.
> It is **not** current architecture documentation.
>
> Current documentation: none for this engineering evidence — see the index at [docs/README.md](../../README.md).
# Agent Core on DSH — Integration Review（三包并行交付审阅）

> 状态：已完成 · 审阅人：主 Agent · 日期：2026-08-14
> 范围：只审阅、不拼接。三个 coding subagent 的交付各自独立，Router/daemon 集成
> 待 process-model benchmark 结束后进行。

## 1. 审阅结论总览

| 交付 | 包 | 测试 | 审阅结论 |
|---|---|---|---|
| Feishu Connector V0 | `packages/feishu-connector/` | 25/25 pass | ✅ 通过（含真实长连接验证） |
| Workspace Bootstrap V0 | `packages/workspace-bootstrap/` | 13/13 pass | ✅ 通过 |
| Generic Broker V1 | `packages/broker/` | 21/21 pass | ✅ 通过（V0 回归 + 端到端 42） |

三个包互不重叠、各自独立可测；插件契约（`name`/`inject`/`Config`/`apply`）与仓库
V0 约定一致。**共 59 项测试全绿**（重跑确认，2026-08-14）。

## 2. 逐项审阅

### 2.1 Feishu Connector V0（`@agent-core/feishu-connector`，name=`feishu`）

- **架构**：`core.js`（零依赖纯逻辑：normalize/dedup/ReplyTarget/附件解析）+ `transport.js`
  （SDK WSClient 状态机/重连）+ `api.js`（出站 reply/create）+ `index.js`（Cordis 壳，
  `inject=[]`，`Config.credentialsPath` 避免 secret 入配置，`ctx.effect` 管理连接生命周期）。
- **契约输出**：`IngressEvent`（eventId/type/channel/conversationId/chatId/threadId/sender/
  text/mentions/attachments/dedupKey）+ `ReplyTarget`（reply/create/create_thread 三形态）——
  纯数据、可序列化，后续 Router 可直接消费。
- **集成修复（主 Agent 完整 DSH 进程挂载验证发现，已修复并复验）**：
  ① `Config` 改为 schemastery schema（原普通对象导致 Cordis loader
  `resolveConfig` 崩溃：`config.validate` undefined）；② `ctx.effect(...)?.catch` 改为
  effect 内 try/catch（`ctx.effect` 返回 disposer 函数而非 Promise）。修复后完整 DSH
  进程挂载成功：`feishu-transport: connected` + 优雅停止。详见 feishu-connector 报告 §5b。
- **注意事项**：
  - 入站经 `Config.onEvent` 回调暴露——函数无法在 YAML 配置里序列化，完整 DSH 挂载时
    需由上层（Router）在代码里注入回调（`setCallback` 已提供）；这正是「不拼接」的衔接点。
  - dedup 为进程内 LRU（接口已抽象，可换持久化）。
  - thread 语义（topic `thread_id` vs 内联 `root_id`）已分开建模，出站组合需真实群场景复核。

### 2.2 Workspace Bootstrap V0（`@agent-core/workspace-bootstrap`，name=`workspace-bootstrap`）

- **架构**：`paths.js`（纯函数映射 + 严格 sanitize）+ `index.js`（Cordis 壳，`inject=[]`，
  `ctx.provide('workspaceBootstrap')` 注册能力，**不自播**——挂点留给 Router）。
- **播种**：仅 `AGENTS.md`（唯一有 DSH 原生消费者 `agent-instructions` 的文件），
  SOUL/USER/IDENTITY/MEMORY 均经论证否决——符合用户「不机械复制 OpenClaw」的要求。
- **发现的问题**：无阻塞问题。注意事项：
  - workspace（`~/.dsh/workspaces/<id>`）与 agent home（`~/.dsh/agents/<id>`）双根分离，
    与 DSH 单根 `$DSH_HOME` 的关系是开放问题（报告 §6.1），进 Router/daemon 阶段需对齐。

### 2.3 Generic Broker V1（`@agent-core/broker`，name=`broker`）

- **架构**：manifest 数据（`schema.js` 校验）+ `mapping.js`（请求/响应/错误映射，V0 语义
  1:1）+ `registry.js`（manifest → 一个 DSH tool）+ `identity.js`（`resolvePrincipal` 单一
  获取点，占位实现）+ `calculator.manifest.js`（calculator 数据化）+ `index.js`（Cordis 壳）。
- **身份纪律**（三条，均有测试断言）：tool schema 无 principal 字段；mapping 忽略走私
  principalId；handler 只能经 `resolvePrincipal` 取身份。占位实现读 `AGENT_CORE_PRINCIPAL`
  env，指向 TRUST-BOUNDARY 方案 B 为最终形态——本轮不实现 spawn/凭据注入（符合用户指示）。
- **发现的问题**：无阻塞问题。注意事项：
  - 多 capability 的 tool 命名唯一性无保证机制（报告 §9.1）——进多能力阶段前需定；
  - handler 注册 seam（`handlersByCapability`）是包内静态映射，跨包能力（Forum/Workflow）
    的公共注册接口未冻结——这正好是「不给专用 adapter」之后的下一步设计点。

## 3. 接口衔接点（记录，不实现）

三者之间与未来 Router/daemon 的衔接面（各交付均以接口而非拼接形式暴露）：

```
Feishu Connector ──IngressEvent──▶  Router（未来）
   ▲                                   │
   └────────── ReplyTarget ◀───────────┘（handle.reply()）

Workspace Bootstrap ──ctx.workspaceBootstrap.ensure(agentId)──▶ Router 挂点（agent/pre-step）
   ▲ 播种 AGENTS.md（agent-instructions 自动消费）

Broker ──resolvePrincipal(ctx)──▶ 方案 B 进程凭据注入（控制面，未来）
   └─ manifest 数据 ──▶ Forum/Workflow/OKR（未来，零新机制）
```

- Router 侧需要的三个输入面已全部就绪：入站（onEvent 回调）、出站（reply handle）、
  身份（resolvePrincipal 接口）、目录（workspaceBootstrap 能力）。
- 无一处需要改三包代码才能衔接——都是调用方（Router/控制面）的责任，留待 benchmark 后。

## 4. 风险与注意

1. **同仓库并发写**：broker 的 V1 文件曾遭并发 agent（process-model demo 的 `.demo/`、
   `packages/demo-server/` 等工作）短暂还原为 V0，已重建并二次验证（21/21 + 端到端 42），
   当前文件稳定。教训：并行阶段三包目录虽互不重叠，但仓库级操作（install/git 恢复）可能
   误伤；后续并行工作建议分目录工作区或串行化仓库级操作。
2. **真实飞书验证待补**：mock 全过；真实 WS 连接已建立、出站请求已到达真实 API（业务错误
   99992351 = 目标 open_id 属旧 app 作用域，跨 app 无效，非凭据问题）。入站（真实用户发消息）
   无法自造，待人工配合验证（步骤见 feishu-connector 报告 §4.2）。
3. **bundle/profile 未挂载任何新包**（符合本轮约束）：三个包都是「可挂载但未挂载」状态，
   挂载是 Router/daemon 阶段的事。
4. **process-model benchmark 进程（PID 62558，`--profile agent-core-demo`）未受影响**；
   旧 agent-core 的 coding-harness（7201/7202）已按指示关闭。

## 5. 下一步（benchmark 结束后）

1. 飞书真实入站验证（人工发消息，见 §4.2 步骤）；
2. Router/daemon 阶段：把三个衔接点接上（onEvent 投递、workspaceBootstrap 挂点、
   resolvePrincipal 升级为方案 B 绑定）；
3. Broker 命名唯一性 + handler 注册 seam 冻结；
4. workspace 双根与 DSH 单根语义对齐。
