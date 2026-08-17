---
status: historical
as_of: 2026-08-16
superseded_by:
public: PUBLIC
---

> HISTORICAL ENGINEERING RECORD
>
> This document describes the system as of 2026-08-16.
> It is **not** current architecture documentation.
>
> Current documentation: none for this engineering evidence — see the index at [docs/README.md](../../README.md).
# Agent Router Delivery V0 — 实现报告

> 状态：已完成（2026-08-16）。冻结接口 `deliver({requestId, agentId,
> sessionMode, message}) → {accepted, sessionId}` 在 `@agent-core/agent-router`
> 上落地，单测 + 真实验收全部 PASS。Kernel change = NONE；demo-server 零改动
> （inbox-accept seam 已存在，见 §4）。无 Workflow / Forum / Team / Mailbox /
> Notification retry queue / Scheduler 耦合，无任意非-main Session resume API。

## 1. 冻结接口与语义

```text
deliver({ requestId, agentId, sessionMode: "main" | "fresh", message })
→ { accepted, sessionId }
```

- `accepted: true` 只表示：消息已经被正确 DSH Session 接受（进入 DSH native
  inbox）。**绝不等待**整个 Agent turn / job 执行完成。
- `main`：sessionId 固定为 `main`；已存在则 resume（demo-server 按持久化工件
  判断），不存在则 create。V0 唯一允许跨 job 继续使用的 Session。
- `fresh`：第一次 requestId 创建一个全新的 native Session；相同 requestId 重试
  仍然指向同一个 Session（持久化映射，控制面重启也不变）；不同 requestId 得到
  不同的新 Session。调用方不能指定或恢复任意历史非-main Session（接口没有
  sessionId 字段，出现即 fail-loud）。

## 2. 组件改动（全部在 `packages/agent-router`，控制面）

| 文件 | 改动 |
|---|---|
| `src/index.js` | 新增 `deliver()` 域操作（service 面 `agentRouter.deliver`）；fresh 映射 mint 逻辑（`fresh-<sha256(agentId\0requestId) 前 32 hex>`，碰撞循环）；`processFactory` 测试/运维 seam；`deliveriesSnapshot` / `freshSessionsSnapshot` 证据面 |
| `src/binding-store.js` | 新增持久化 `freshSessions` 表（agentId → requestId → row）；`freshSessionFor` 在 mutation queue 内原子 read-or-mint（并发首次投递收敛为同一 session）；load/snapshot/restore/persist 全链路 + 损坏 fail-loud；文档字段可选，旧 store 文件兼容（version 不变） |
| `src/process.js` | `AgentProcess.deliver(sessionId, text)`：inbox-accept seam，`session/prompt` receipt 即 resolve，不轮询事件、不等待 idle、不进 single-flight 队列；`request()` 增加可选超时（死进程不挂死调用方），超时清理 pending |

**Admission seam（重点确认）：**

```text
ensureRunning(agentId)      find-or-start agent DSH process（registry 复用/重生 + ready）
→ 会话决议                   main 固定 / fresh 由 (agentId, requestId) 映射
→ proc.deliver(sessionId, text)   demo-server 收到消息 → followup() 同步入 inbox → 回 receipt
→ { accepted, sessionId }   立即返回
```

## 3. inbox-accept seam 的 userspace 证据（demo-server 零改动）

demo-server `session/prompt` 处理（`packages/demo-server/src/index.js`）：

```js
async function prompt(sessionId, contentBlocks) {
  const handle = await getOrCreateSession(sessionId)   // create | resume
  const message = createUserMessage({ content: contentBlocks, source: { kind: 'user' } })
  handle.agent.followup(message)                        // 同步入 inbox
  return { messageId: message.id }                      // 立刻回 receipt
}
```

`followup` 的 DSH 语义（harness `core/agent-loop/src/agent.ts:113-123`）：

```ts
send(message, target, wakeup) { this.inbox.splice(..., [message]); if (wakeup) this.wakeDriver(...) }
followup(input) { this.send(input, 'next-turn', true) }   // void，同步 enqueue
```

即 JSON-RPC receipt 只在 `followup()`（同步 inbox.splice + wake）之后写出 ——
**receipt 就是 "inbox accepted" 的证明**。因此不需要任何 demo-server seam，
更不需要 DSH Kernel/Core 改动。

## 4. 测试证据

### 4.1 单元测试（`packages/agent-router/test/`，`node --test`，全绿）

- `delivery.test.js`（11 个）：D1 main 首次 create；D2 main 再次 → 同一
  session/同一进程；D3 fresh 不同 requestId → 不同 session；D4 fresh 同
  requestId 重试 → 同一 session（映射表仅 1 行）；D4b 并发首次投递收敛同一
  session；D5 调用方 sessionId 字段被拒 + fresh session 不可经其他 requestId
  触达；D6 控制面重启后 fresh 映射不变、main 仍 main；D6b agent 进程死后
  respawn 且会话目标不变；D7 accepted 立即返回（fake proc 永不 idle，仍
  <5s resolve）；D8 参数契约（sessionMode/agentId/requestId/message）；
  D9 fresh 映射按 agent 命名空间隔离。
- `process-delivery.test.js`（4 个）：DLV1 receipt 单独 resolve（零事件、零
  idle、零 turn/end —— 需求 7 的最强确定性证明）；DLV2 在 turn 进行中 deliver
  立即返回且不碰 activeBindingContext；DLV3 死进程超时 reject 并清理 pending；
  DLV4 超时后迟到的 receipt 不能复活幽灵 promise。
- `binding-store.test.js` 新增 7 个：mint-on-first-sight/retry 同 row；不同
  requestId 不同 session；按 agent 命名空间；mint 收到 used 集合（碰撞循环
  输入）；并发收敛；跨重启持久化 + 旧文档（无 freshSessions 字段）兼容；
  校验与损坏 fail-loud。

运行：`npm test`（仓库 286 个测试全绿，其中 router 60 个）。

### 4.2 真实验收（`scripts/agent-router-delivery-v0-verify.mjs`，真实 DSH 进程）

覆盖任务要求的全部 7 点：

1. `REQ1_*` main 首次 → accepted + sessionId=main，进程 spawn，session
   created，轨迹随后出现消息；
2. `REQ2_*` main 再次 → 同一 main，同一 pid，无第二次 create；
3. `REQ3_*` fresh X → S1、fresh Y → S2，S1≠S2，均 `fresh-` 前缀真实 native
   session；
4. `REQ4_*` fresh X 重试 → 同一 S1，映射表 1 行，同一 native 会话续聊；
5. `REQ5_*` 携带 sessionId 字段被拒；其他 requestId 触达不同 session；返回
   形状恰为 `{accepted, sessionId}`；
6. `REQ6_*` kill -9 agent 进程 → 下次 deliver respawn 新 pid，main session
   resumed（stderr 证据），会话轨迹跨重启延续；
7. `REQ7_*` 长回合在 <30s 内 accepted（receipt 即返回），且回复事件在
   JSONL 中的 `time` 严格晚于 deliver() 返回时刻 —— 结构证明不等待模型回合；
8. `REQ8_*` 控制面重启（同 store 新 router）→ fresh X 仍 S1，main 仍 main。

运行：`npm run verify:delivery`（env：`DSH_HARNESS_ROOT`、`DSH_DELIVERY_V0_RUNTIME`、
`DSH_DELIVERY_V0_KEEP=1` 保留 runtime）。

## 5. 边界与禁止项核对

- Router 不理解 Workflow / Forum / Team / Mailbox / Notification retry queue /
  Scheduler：deliver 是纯 (agentId, session) admission 入口，无任何上述语义。
- 无任意非-main Session resume API：调用方唯一能提供的是 (agentId,
  requestId)；sessionId 由 Router 独占决议（main 固定 / fresh 映射）。
- Kernel change = NONE；`deepseek-harness` checkout 未改动。
- 未触碰 Channel/Binding 语义：deliver 不经 ChannelConversation，不写
  Binding，与 onIngress/switchAgent 平行共存。
