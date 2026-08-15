# Scheduler Replacement V1 — 报告

> 分支：`feat/scheduler-replacement-v1` · 日期：2026-08-15
> 范围：最小替代 OpenClaw Gateway 内嵌 cron scheduler 的真实执行面
> （persistent job / cron / at / every / enable·disable / 到期触发 / announce seam）。
> 独立 PR，不修改 `packages/agent-router/**`（Product Integration 由并行分支负责）。

## 1. REAL OPENCLAW JOB SHAPE

实证来源：`~/.openclaw/cron/jobs.json`（247 条，enabled 135~141 波动）、
`~/.openclaw/cron/runs/`（2810+ 条）、OpenClaw 2026.3.13 gateway bundle 源码段、
两个 launchd daemon 脚本。完整字段统计与映射见
[`docs/investigations/scheduler-replacement-audit.md`](../investigations/scheduler-replacement-audit.md)，
要点：

- **schedule 三种形态**：cron 117（全 5 字段，136 个不同表达式；`Asia/Shanghai`
  显式 87/117，缺省用系统时区；整点重复表达式自动 300s 错峰）、at 10~15（绝对
  ISO，全部 deleteAfterRun + flash model）、every 8（anchorMs + everyMs）。
- **payload 只有 agentTurn**：message（中文指令，p50 674B）+ timeoutSeconds +
  lightContext(89) + model(88)。
- **delivery**：announce 90（86 条投回本 agent 绑定群，4 条异群/无 to）、none 48、
  silent 2；`to` 形如 `chat:oc_<chatId>` —— **对调度器是 opaque 字符串**。
- **sessionKey 15 条**：opaque，覆盖 sessionTarget（含 dispatcher 父会话前缀与
  agentId 不一致的现网行为）。
- **状态机字段**：nextRunAtMs / runningAtMs / lastRunAtMs / lastRunStatus /
  lastStatus / lastDurationMs / lastDeliveryStatus / consecutiveErrors / lastError
  / lastDelivered —— 全部持久化在 jobs.json 内。
- **daemon 提交面**：`openclaw cron add --at 15m --delete-after-run …` +
  `openclaw cron list --json`（forum-scheduler / unified-dispatcher），
  `openclaw cron runs --id`（cron-helper）。就这三个面。

## 2. MINIMUM JOB MODEL

V1 job（`packages/scheduler/src/job-model.js`）是现网字段的真子集，一一对应：

```jsonc
{
  "id": "uuid", "name": "…", "agentId": "…（必填）", "enabled": true,
  "schedule": { "kind": "cron", "expr": "0 9 * * *", "tz": "Asia/Shanghai", "staggerMs": 300000 }
           /* 或 { "kind": "at", "at": "2026-08-15T01:00:00.000Z" }
              或 { "kind": "every", "everyMs": 86400000, "anchorMs": … } */,
  "sessionTarget": "isolated", "sessionKey": "…（opaque，可选）",
  "payload": { "kind": "agentTurn", "message": "…", "timeoutSeconds": 3600,
               "lightContext": true, "model": "opencode-go/deepseek-v4-flash" },
  "delivery": { "mode": "announce", "channel": "feishu", "to": "chat:oc_…", "bestEffort": true },
  "deleteAfterRun": false,
  "createdAtMs": …, "updatedAtMs": …,
  "state": { "nextRunAtMs": …, "lastRunAtMs": …, "lastStatus": "ok",
             "lastDurationMs": …, "lastDeliveryStatus": "delivered",
             "consecutiveErrors": 0, "lastError": …, "runningAtMs": …, "lastDelivered": true }
}
```

归一化：顶层 `timeoutSec/timeoutMs/runTimeoutMs` → `payload.timeoutSeconds`
（行为等价，OpenClaw 运行器也只读后者）；`wakeMode`、顶层 `everyMs` 死数据、
`systemEvent` payload（全 disabled）**丢弃**。没有为猜测的用途扩字段。

## 3. PERSISTENCE

- `~/.agent-core/scheduler/jobs.json`（可覆盖）：`{version: 1, jobs: […]}`，
  **原子替换**（tmp + fsync + rename，fail-loud），与 OpenClaw jobs.json 同构，
  迁移工具零转换成本。
- `runs.jsonl`：追加式运行事件日志（started/finished + 状态 + deliveryStatus +
  sessionId + durationMs），默认 10MB 截断 —— 运行史证据，不是 Workflow。
- **无 Redis / Kafka / 分布式锁 / K8s CronJob**（决策 D-005）：单机单 Control
  Plane 进程承载 141 job；单写者假设，CLI 提交面走同一原子协议。
- Control Plane 重启 → 文件即全部事实 → job 不丢；外部 `agentcore-cron add`
  在引擎运行时写入 → 下个 tick（mtime 检查）自动纳入。

## 4. EXECUTION SEMANTICS

（逐条对照 OpenClaw gateway bundle 复刻，见 audit §2）

| 面 | 语义 |
|---|---|
| 到期 | enabled ∧ 未运行 ∧ now ≥ nextRunAtMs ∧ 非 error-backoff |
| at 一次性 | **至多一次**：ok → deleteAfterRun 删除 / 否则 disabled；瞬时错误 ≤3 次 30s/60s/5m 重试；永久错误 disabled |
| cron 循环 | 每次运行后 next = 严格晚于结束的下一次 occurrence（+2s refire gap）；error → max(naturalNext, endedAt+backoff)，backoff 30s/60s/5m/15m/60m；错峰 sha256(jobId)%window 稳定 |
| every 循环 | anchor + k·everyMs；有 lastRunAtMs 时优先 lastRun+everyMs |
| 重启补跑 | **停机期每 job 至多补跑一次**：cron 最近一个错过的 occurrence（仅当 lastRunAtMs 已存在）；at 仅从未跑过且到期；every 由 nextRunAtMs 保证；启动立即跑 ≤5 个，其余自然错峰 |
| 崩溃去重 | invoke **前**先持久化 runningAtMs；重启跳过 fresh 标记；>2h 卡死标记清除 |
| 超时 | payload.timeoutSeconds（缺省 3600s）；超时报 `cron: job execution timed out` |
| disabled | 不运行；nextRunAtMs/runningAtMs 清空 |

状态机字段与 OpenClaw 同名同义（scheduled → nextRunAtMs 未来；running →
runningAtMs 置位；lastRunAt/lastResult 每次运行更新）——不发明新概念，不长成
Workflow。

## 5. INVOCATION SEAM

```js
// Scheduler 认识 agent 的唯一途径（注入；V1 提供 fake/noop，测试全用 fake）
invokeAgent({ agentId, sessionId?, message, model?, lightContext?,
              timeoutMs?, deliveryTarget? })
  → { status: 'ok'|'error', summary?, error?, sessionId?, durationMs? }
```

- `sessionId` 默认 `agent:<id>:cron:<jobId>`；`sessionKey` 优先（opaque 透传）。
- Product Integration 稳定后把真实现注入 `Scheduler({invoker})` 即可，本 PR
  **不冻结** Router API，也不修改 `packages/agent-router/**`。
- 测试证据：到期调用、参数透传、并发上限、超时——全部用 fake invoker 断言。

## 6. DELIVERY / ANNOUNCE SEAM

```js
deliver({ job, result, text })   // 仅 announce/silent 时调用；throw = not-delivered
```

- `job.delivery.{mode,channel,to}` **原样透传**（`chat:oc_*` 对 Scheduler 是
  opaque）；代码里**没有** `if feishu`，无 Feishu SDK 依赖。
- 测试证据：acceptance #10 —— announce 目标逐字到达 delivery seam；
  silent 同样走 seam；none → `not-requested`；deliver 抛错 → `not-delivered`。
- Feishu Connector 后续实现 `deliver` 适配器（读 channel/to + result.summary
  发送），Scheduler 零改动。

## 7. RESTART EVIDENCE

单元测试（`packages/scheduler/test/scheduler.test.js`，46/46 pass）+ 验收驱动
（`scripts/scheduler-v1-verify.mjs`，14/14 门全部 PASS）：

- 重启后 job 恢复（id/schedule/nextRunAtMs/lastRunAtMs 原样）；
- 停机期到期的 cron → 重启**恰好补跑一次**，nextRunAtMs 重算到未来；
- 停机期到期的 at（从未跑）→ 补跑一次后删除；**已跑过的 at → 不再跑**；
- **从未跑过的 cron 不补跑已错过的首个 occurrence**（OpenClaw 同款：missed
  规则要求 lastRunAtMs 存在）；
- 崩溃时 fresh runningAtMs → 重启跳过（不重复）；>2h 卡死 → 清除后重跑；
- 一次性 job 成功即删、失败（永久）即 disabled，重启均不重放；
- 同一 store 重建引擎两次验证（第二实例零触发，除非补跑规则命中）。

## 8. 135-JOB COMPATIBILITY RESULT

`node scripts/scheduler-v1-verify.mjs` 与 `scripts/openclaw-job-import.mjs` 输出
（redacted fixture 快照 + 实时文件双跑）：

```
redacted fixture (140 enabled): 137/140 lossless (97.9%)
live ~/.openclaw/cron/jobs.json (141 enabled): 138/141 lossless (97.9%)
GAP ×3: PPT设计师每日学习 / 周内化 / 双周应用检查 — 无 agentId
```

- **97.9% 无损**；唯一 GAP 是 3 条**现网已 broken** 的 legacy job（runs 实证
  sessionId=null、36 次运行全 error），迁移时人工补 agentId 即解决 —— 数据缺口，
  不是 schema 缺口，**不扩设计**。
- 90 条 announce 的 `chat:oc_*` 目标、15 条 at、8 条 every、7 条 sessionKey、
  model/lightContext/timeout 全部原样表达；休眠字段按 §2 归一化/丢弃（行为等价）。

## 9. INTEGRATION NEED

- **Scheduler ↔ 引擎**：已完成（本 PR）。`Scheduler` 可被 Control Plane 常驻进程
  直接 `start()`，或包一层 Cordis 插件（未做——本轮不需要）。
- **invoker 接线**：Product Integration 提供稳定 `invokeAgent` 后，一行注入
  （§5）。未完成前用 noop invoker 空转（job 状态机照常推进）。
- **deliver 接线**：Feishu Connector 提供适配器（§6）。
- **daemon 切换**：forum-scheduler.sh / unified-dispatcher.py 把
  `openclaw cron add/list` 换成 `node …/agentcore-cron.mjs add/list`（flag 面
  1:1，见 audit §3.3）；`unified-dispatcher.py` 的 jobs.json 直读查重改指
  `~/.agent-core/scheduler/jobs.json`（格式同构）。本轮**不改 daemon 本体**。
- **迁移**：`node scripts/openclaw-job-import.mjs --write`（默认 dry-run）+
  3 条 GAP 人工补 agentId。

### 特别回答：如果 Product Integration 明天给出稳定 invokeAgent，还差什么？

**代码面**：只差 Control Plane 里把 `Scheduler({ invoker: productIntegrationInvoker,
deliver: feishuConnectorDeliver })` 实例化并常驻 —— 约 10 行接线 + 把
`agentcore-cron` 装入 launchd（或并入 Control Plane daemon）。

**数据面**：`openclaw-job-import.mjs --write` 一次迁移（137~138 条无损 + 3 条补
agentId）；imported `state` 已含 nextRunAtMs/lastRunAtMs → 重启语义无缝。

**验证面**：canary = 1 个真实 agent（audit §7.4 建议 stock-agent，6 个 enabled
job）在 Agent Core 侧跑完整周期（cron + at 各一次 + announce 回原群 + runs 可查），
对照 OpenClaw 行为；通过后全量切换并关停 gateway。

**没有其他缺口**：不依赖 Router 的 session 选择逻辑（sessionKey opaque）、不依赖
broker 工具面、不依赖 Feishu SDK。

## 10. DEFERRED FEATURES（明确不做）

- ❌ 完整 OpenClaw cron API clone（只做 add/list/runs/rm/enable/disable）
- ❌ heartbeat framework（现网无真实 heartbeat 依赖）
- ❌ proactive agent framework / Workflow replacement（flow/task_runs 0 依赖）
- ❌ distributed scheduler（Redis/Kafka/lock/CronJob —— 无多机实证）
- ❌ 失败告警推送（failureDestination 0 条配置）
- ❌ Mobile / 日历 UI / 斜杠命令
- ❌ Router / Auth / Broker / Kernel 任何修改

## 11. 交付物清单

- `packages/scheduler/**`（`@agent-core/scheduler`，零 DSH 依赖，仅 croner）：
  job-model / schedule / store / scheduler 引擎 / seams / import-openclaw；
- `packages/scheduler/test/`：46 个测试（10 项最小验收 + 重启/去重/backoff/并发/
  兼容扫描）全绿；
- `packages/scheduler/fixtures/openclaw-jobs-enabled.json`：redacted 真实库存快照；
- `scripts/agentcore-cron.mjs`（daemon 提交面）、`scripts/openclaw-job-import.mjs`
  （迁移工具）、`scripts/scheduler-v1-verify.mjs`（验收驱动，14/14 PASS）；
- `docs/investigations/scheduler-replacement-audit.md`、`docs/decisions/SCHEDULER_V1.md`
  （D-005）、本报告。
