# Product Integration V1 — 第一次把长期 Agent 基础组件真正装进统一 Router / Binding

> 状态：已完成（2026-08-15）· 分支：feat/product-integration-v1 ·
> 基线：main = 542cc4b（PR #1–#7 全部合入：Integration V1、Session V1、
> Registry V1、Memory V1）
> 关联决策：D-004 `docs/decisions/BINDING_AND_SWITCH_V1.md`（Router / Binding
> 域操作与持久化）
> 验收驱动：`scripts/product-integration-v1-verify.mjs`（真实 DSH 进程 + 真实
> 模型 turn，29 项断言全 PASS，含 FIX1 自足 spawn 回归检查）
> 审计修复：PR #10 两轮审计后按最小修复落地（FIX 1–3，见 §14）

## 0. 一句话总结

本轮不做新组件，而是把已经验收的六块（Agent Registry V1、Workspace Bootstrap、
DSH native Session、Agent Memory V1、per-Agent DSH process、Feishu Integration
V1）**第一次真正装起来**：一个 Router，一套域操作，两条入口殊途同归：

```text
Registry + Workspace + DSH native Session + Memory + per-Agent process
                              ↓
                    Router / Binding (switchAgent)
                              ↓
                  真正长期多 Agent (A / B 双验收)
```

## 1. 本轮新增的产品边界

### 1.1 一个 Router，一套路由规则

Agent Core 后续有两条入口，但 Router 只有一套：

| 入口 | 形态 | Binding 行为 |
|---|---|---|
| Feishu | 外部 Connector | 通常固定 Binding（前期允许，不做自然语言切 Agent） |
| Mobile / Web | 原生 Product Surface | 可以高频切 Binding（本轮不实现完整 WebSocket/API） |

**禁止的分裂**（本轮明确不做）：Feishu Router / Mobile Router /
`if websocket → mobile routing` / `if feishu → feishu routing`。WebSocket / Feishu
只是入口协议，不进入 Router 的核心路由规则。

### 1.2 统一 Router domain operation：`switchAgent`

```text
switchAgent(bindingContext, targetAgentId, { targetSessionId? })
```

职责（严格按 D-002 §3 定案）：

1. **Registry 验证 target Agent 存在**——未知 id / 名字抛 `AGENT_NOT_FOUND`，
   Binding 不被改动；
2. **Router 决定目标 Session**——显式 `targetSessionId` 用之；缺省固定进入目标
   Agent 的 `main`（V1 不做 LLM/语义 Session 猜测）；
3. **更新「当前调用所属 Binding」**（该 ChannelConversation 尚无 Binding 时创建）；
4. **返回新 Binding**（含 `updatedAt`）。

`bindingContext` 接受 ccId 字符串或 D-002 形状 `{channelConversationId}`——未来
Product API 无论持有什么形状都调用同一个原语。

### 1.3 自然语言与手动切换统一（两种入口同一 domain operation）

```text
Mobile UI 手动点 Agent                    DSH tool: agent_core_switch_agent
        │                                         │
        └──────────────► Router.switchAgent ◄──────┘
                              （"叫论文导师来"最终也到这里）
```

真实验收（Phase 6）：Agent A 收到「请把当前对话切换到 Agent B」→ A 的模型调用
`agent_core_switch_agent`（targetAgentId = 'Agent B'，显示名）→ parent-RPC 转发 →
`Router.switchAgent` → Binding 变成 B/main → 下一条消息真正进入 B。

## 2. CURRENT ROUTER FLOW（改造后）

```text
Feishu WS ingress
   │  (feishu-connector 只归一化 + dedup + 转发，无状态)
   ▼
resolveChannelConversation({channel, externalId})   ← 幂等；首接触自动建
   │                                                   「默认 Agent + main」Binding
   ▼
Binding {activeAgentId, activeSessionId}
   │
   ▼
ensureRunning(activeAgentId)     ← 每 Agent 一个 DSH 进程
   │                                 (workspace-bootstrap 决定 home/workspace)
   ▼
proc.turn(activeSessionId, text, {bindingContext})  ← DSH native Session
   │                                                   (demo-server create/resume)
   ▼
reply → feishu.reply / 返回给调用方
```

## 3. NEW DOMAIN OPERATIONS

`ctx.agentRouter` 服务面（Router / Control Plane 是唯一 owner）：

| 操作 | 语义 |
|---|---|
| `resolveChannelConversation({channel, externalId})` | 幂等落地入口；首接触自动建默认 Binding（**持久化**） |
| `switchAgent(bindingContext, targetAgentId, {targetSessionId?})` | **唯一切换原语**；校验 → 选 Session → 更新 → 持久化 → 返回 |
| `getBinding(bindingContext)` | D-002 getBinding（无 Binding → undefined） |
| `route(ingress)` | 入站投递（返回 `{reply, agentId, sessionId, pid}`） |
| `ensureRunning(agentId)` / `registrySnapshot()` / `bindingsSnapshot()` | 进程注册表与快照（ops/test） |

## 4. BINDING OWNER / PERSISTENCE

- **owner = Agent Core Router / Control Plane**。Mobile、Feishu Connector、DSH
  Agent、Registry、Memory 一律不写 Binding（连接器保持无状态；Registry 只持身份；
  Memory 只持记忆）。
- Integration V1 的 Binding 是 **demo/in-memory Map**（调查结论：重启即丢）——
  本轮做成**最小可恢复持久化**：
  - 单 JSON 文档 `<home>/.dsh/bindings/bindings.json`（config
    `bindingsStoreFile` 可覆盖；绝对路径契约，相对 / `~` 前缀 fail-loud）；
  - 原子写（tmp + rename）、变更串行队列、损坏 fail-loud（绝不静默重置）；
  - 无数据库平台、无 event sourcing——一张表、原子替换，够用且可靠。
- 验收（Phase 7/8）：切到 B → 重建 Router（同一 store）→ 仍是 B；
  **真实控制面进程**（agent-core-integration 组合）在同 store 上启动 →
  `binding store loaded: 2 binding(s)`。

## 5. REGISTRY INTEGRATION

- `bundle-integration` 新增 `agent-core-registry` 行（store 可 env 覆盖），Router
  挂载时**要求** `agentRegistry` 服务（缺失 fail-loud）。
- 首次接触的默认 Agent = Registry 的默认（首个注册 / `setDefaultAgent`），配置
  `defaultAgentId` 只是兜底。
- `switchAgent` 第一步经 Registry 验证：接受不透明 `agentId` 或显示名
  （**查找策略属于 Router**，DSH 工具只转发原话）。
- 验收（Phase 0）：Registry 真正提供 A/B（`agt_` 生成 id）；A 首个注册 → 默认；
  所有 Agent 路径（workspace / DSH_HOME / process / session / memory）都由
  **Registry 生成的 id** 派生——验收本身就是 id 驱动 provisioning 的证据。

## 6. MEMORY INTEGRATION

- Memory 仍在 per-Agent 进程内（file-first，`<workspace>/MEMORY.md`），本轮没有
  把它搬进控制面——**物理隔离**保持不变。
- 新增 per-Agent 组合 `profile-integration-agent`（bundle-demo + bundle-memory +
  bundle-agent-switch）：Router 通过 `ROUTER_AGENT_PROFILE` 指定；进程注入
  `$DSH_AGENT_ID`（= Registry id），memory 插件据此解析自己的 workspace。
- 验收（Phase 2/4/5）：A 存 1990-01-01、B 存 1991-02-02；各自只回忆自己的生日；
  A 的 MEMORY.md 永不见 1991，B 的永不见 1990；kill B 进程重启后 B 仍能回忆
  1991（session + memory 一起恢复）。

## 7. DSH SESSION INTEGRATION

- 产品 Session = DSH native session（Session V1 结论），本轮零新组件：Router 的
  `proc.turn(sessionId, text)` 直接命中 per-Agent 进程里 demo-server 的
  create/resume。
- 每个 Agent 的 `main` session 独立落在自己的 DSH_HOME（`<home>/sessions/...`）；
  「切到 B」后下一条消息进入 B 的 main，A 的 main 轨迹字节不变。
- 验收（Phase 1/3/5）：A main created / B main created（不同 home）/ B main
  **resumed (99 events)** after kill——轨迹文件在磁盘上可断言。

## 8. DSH SWITCH TOOL STATUS：已实现（adapter，且只做 adapter）

`agent_core_switch_agent(targetAgentId, targetSessionId?)`（`packages/agent-switch`，
mount 在 per-Agent 组合里）：

```text
DSH Agent 的模型调用 tool
   │
   ▼
agent-switch 插件: agentRpc.request('agent-core/switchAgent', {targetAgentId,...})
   │  (demo-server parent-RPC passthrough: stdout rpc.request 通知)
   ▼
控制面 AgentProcess: onRpcRequest → Router.switchAgent(activeBindingContext, ...)
   │  (rpc.response 应答)
   ▼
tool 返回新 Binding；下一条消息进入新 Agent
```

**它不拥有**：Binding persistence、Agent lookup policy、Session selection
policy、Mobile/Feishu branching、navigation history——全部在 Router 域内。

**RPC 契约（实测修正）**：demo-server 的 parent-RPC passthrough 是「信封」契约
——`agentRpc.request(method, params)` resolve 为 `{ok, result}`（父侧
`rpc.response` 的 `result` 即 Router 返回的新 Binding）；adapter 只解信封、
透传参数。首轮实测发现并修正过一处信封不一致（resolve 裸 result vs 信封），
修正后工具成功路径与 Router 实际行为完全一致（Phase 6 验收覆盖）。

**调查发现（真实约束）**：任务语义名 `agent_core.switch_agent` 的**点号**被模型
路由（opencode-go）拒绝——`Invalid 'tools[0].function.name': string does not
match pattern '^[a-zA-Z0-9_-]+$'`（live 实证）。工具注册为
`agent_core_switch_agent`（语义前缀保留，adapter 行为不变）。这是「调查后实现
最薄 adapter」的产物：先查约束，再定名，不让 Router interface 因此变形。

**RPC relay 顺带修复**：Session V1 报告记录的 `AgentProcess.shutdown`
`setTimeout(...).then` 现代 Node bug（integration need）本轮顺手修掉（同文件
`process.js`，属于 Router 进程客户端）。

## 9. REAL MULTI-AGENT EVIDENCE（A/B 验收，28 项断言）

| # | 验收项 | 结果 |
|---|---|---|
| 1 | Registry 真正提供 A/B | PASS（agt_… 两个 opaque id） |
| 2 | A/B workspace / DSH_HOME 独立 | PASS（不同目录，id 派生） |
| 3 | A/B process 独立 | PASS（pid 67324 vs 67714） |
| 4 | A/B main session 独立 | PASS（各自 home 下 trajectory） |
| 5 | A/B Memory 独立 | PASS（MEMORY.md 互不可见） |
| 6 | 当前 Binding A → switchAgent(B) → B/main | PASS |
| 7 | switch 后消息真实进入 B | PASS（B 轨迹含 BETA-1，A 轨迹无） |
| 8 | A 不受修改 | PASS（A 轨迹 + MEMORY.md 字节不变） |
| 9 | 其他 Binding 不受修改 | PASS（chat-other 仍 A） |
| 10 | Control Plane / Router 重启后 Binding 恢复 | PASS（进程内重建 + 真实进程启动均验证） |
| 11 | kill B process 后 resume B session + memory | PASS（resumed 109 events；回忆 1991） |
| 12 | DSH tool：A 收到「叫 Agent B 来」→ switch_agent → Binding=B/main → 下条消息进 B | PASS（attempt 1 一次成功；A 回复「已将对话切换到 Agent B」） |

完整断言输出 + 运行证据：`.demo/product-integration-v1/evidence.md`（驱动自动
生成；`node scripts/product-integration-v1-verify.mjs` 可复跑，DSH_HARNESS_ROOT
需指向 deepseek-harness checkout）。

## 10. RESTART / CRASH EVIDENCE

- **Phase 7（进程内重启）**：`ctx.disposeAll()` 关停所有 per-Agent 进程 → 全新
  Registry + 全新 Router 在同一 store 上重建 → `chat-main` 仍是 B、
  `chat-other` 仍是 A。Binding 恢复由构造保证（store 加载于 apply 时）。
- **Phase 8（真实控制面进程重启）**：`dsh --profile agent-core-integration`
  （feishu 关闭）在同 store 上启动 → `[router] binding store loaded: 2
  binding(s)` + `router idle` → 干净退出。真实组合（registry 行 + router 行 +
  workspace-bootstrap 行）一次性 mount 成功。
- **Phase 5（Agent 进程崩溃）**：kill -9 B → 下一条消息 respawn 新进程（新 pid）
  → `[demo-server] session main resumed (99 events)` → 回复 BETA-2 → 回忆生日
  1991（memory 文件在 workspace，天然跨进程存活）。

## 11. DEFERRED NEEDS（只记录，本轮不做）

- **Mobile WebSocket Gateway / 完整 Product API**：不做；`ctx.agentRouter`
  服务面（switchAgent / route / resolveChannelConversation / getBinding）就是
  未来 Product API 的调用边界，且已验证可被任意入口调用。
- **per-Agent last-active-session**：不实现；记录为 integration need（Mobile UX
  的 session 列表需要时，用 D-002 session endpoints hooks 实现）。
- **Session 归属校验**（switchAgent 校验 sessionId 属于目标 Agent）：V1 无
  session 目录能力；D-002 session endpoints hooks 到位后补（Session V1 已记录）。
- **Feishu 自然语言切 Agent**：前期允许固定 Binding；本轮只证明 DSH 入口的
  自然语言路径（Phase 6）。飞书侧接入同一 domain op 时无需改 Router。
- **AgentProcess 并发 turn**：控制面逐 turn 串行；同进程并发 turn 留待
  scheduler milestone。
- **Auth / Broker / OpenClaw replacement**：并行调查线负责，本轮零改动。

## 12. 禁止项核对（本轮未做）

Mobile WebSocket Gateway ❌ · 完整 Product API ❌ · Mobile-specific Router ❌ ·
Feishu-specific Router ❌ · navigation history system ❌ · intelligent Session
resolver ❌ · 新 Session package ❌ · Kernel change ❌ · Auth/Broker identity
重构 ❌ · Forum/Workflow/OKR 接线 ❌ · Self-Evolution ❌ · Proactive ❌ ·
Dashboard ❌。跨组件发现一律只记录 integration need（§11）。

## 13. 组件与文件

| 文件 | 内容 |
|---|---|
| `packages/agent-router/src/binding-store.js` | Binding 持久化（原子 JSON，fail-loud + 事务回滚） |
| `packages/agent-router/src/index.js` | switchAgent / getBinding / async resolve / registry 校验 / rpc 钩子 |
| `packages/agent-router/src/process.js` | env 注入（DSH_AGENT_ID）、turn bindingContext、per-process single-flight turn、parent-RPC relay、shutdown bug 修复 |
| `packages/demo-server/src/index.js` | 无状态 parent-RPC passthrough（`ctx.agentRpc`） |
| `packages/agent-switch/` | `agent_core_switch_agent` adapter（新） |
| `bundle-agent-switch/` + `profile-integration-agent/` | per-Agent 组合（新） |
| `bundle-integration/cordis.patch.yml` | registry 行 + router 配置 env 化 |
| `scripts/demo-home.mjs` | 共享 per-Agent provisioning，表驱动 profile + farm（FIX 1） |
| `scripts/product-integration-v1-verify.mjs` | 29 项验收驱动（新，不再 pre-provision） |
| `docs/decisions/BINDING_AND_SWITCH_V1.md` | D-004（新） |
| 单元测试 | binding-store 9 项 + router 域操作 10 项 + single-flight 4 项 + switch adapter 5 项（全部通过；仓库全部 130 项测试通过） |

## 14. 审计最小修复（PR #10 audit round 3，只修 3 项）

DSH queue 事实（源码 + 实证，见本轮调查输出）：**per native Session FIFO；同
Session turn 不 overlap；tool call 全程保持 running；不同 Session 同一 process
可以并行**。据此冻结产品语义：不同 Agent → 不同 process → 可并行；**同一个
Agent → 一次只处理一个 routed turn，后续排队**。Agent Core 只在 AgentProcess
边界补 per-process single-flight，不造 mailbox / turnId / scheduler。

### FIX 1 — per-Agent profile provisioning（merge 前真实缺口）

- 修复前：Router spawn 路径（`ensureRunning → provisionAgentHome`）只装
  `agent-core-demo` + {bundle-demo, owner-guard, demo-server}；验收依赖的
  integration-agent profile / memory / switch 仅靠 verification driver
  pre-provision 掩盖（真实部署 `ROUTER_AGENT_PROFILE=agent-core-integration-agent`
  会崩 `profile does not exist`，已复现）。
- 修复：`scripts/demo-home.mjs` 的共享 provisioner 改为**表驱动**
  （`AGENT_PROFILE_DEFS`：profile 名 → 仓库 profile 目录 + 该组合需要的 farm
  链接）；`ensureRunning` 按 `cfg.agentProfile` 安装。默认 `agent-core-demo`
  不变（全部旧调用方向后兼容）。
- 回归验证（driver phase 7.5）：全新注册 Agent C，**零 pre-provision** →
  `router.ensureRunning` → 进程起来 + profile 落盘 + memory 插件 mount；
  driver 对 A/B 也删除了额外 pre-provision（AGENTS.md 除外），整条验收现在
  走的就是正常生产 spawn 路径。
- 不改变 Workspace Bootstrap ownership（路径映射仍在 workspace-bootstrap）。

### FIX 2 — AgentProcess per-process single-flight turn

- 事实：`activeBindingContext` 是 AgentProcess 单个共享字段；DSH 只保证
  per-Session 串行，跨 Session 同进程 turn 真实并行（实证），同 Session 排队
  turn 也会提前覆盖该字段 → switch tool 可能切错 Binding。
- 修复：`AgentProcess.turn()` 外层 per-AgentProcess promise chain
  （single-flight）：turn A（set bindingContext A → 整个 DSH turn → tools /
  parent-RPC → turn/end → clear A）**完整结束后**才允许 turn B。失败 turn 不
  卡死队列（chain 吞 rejection）。无新 mailbox / scheduler / ALS / turnId，
  DSH queue 未动。
- 确定性测试（`test/single-flight.test.js`，fake child 无进程无模型）：同
  Session 排队、跨 Session 排队、A 执行期间 switch tool 拿到 A 的
  bindingContext、失败 turn 不 wedged。全部通过。

### FIX 3 — BindingStore persistence failure rollback

- 修复前：`mutate Map → persist → persist failure → Map 未恢复` → RAM=new /
  disk=old / caller=failure 三态分裂。
- 修复：直接复用 AgentRegistry 模式——`enqueue` 带
  `snapshot → mutate → persist → catch restore(snapshot)`。
- failure injection 测试（test 8/9）：persist 抛错 → switch 拒绝 → RAM 不变 →
  disk 字节不变 → 恢复后下一次写正常；新建 Binding 失败也不留 phantom row。

### 明确不改

- `ensureRunning`：不加 in-flight spawn framework（实证 check→spawn→set 无
  await，30 并发调用 1 pid）；只加注释固化不变式。
- `agent_core_switch_agent`：保留现有实现与验收，不删除、不扩展；定位 =
  Router.switchAgent 之上的正交 enhancement。

最终状态：全部 unit tests 130/130 PASS；Product Integration real verification
29 项断言全 PASS（不再依赖任何正常生产路径之外的 per-Agent pre-provision）；
Kernel change = NONE。
