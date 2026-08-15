# OpenClaw cron → Agent Core Scheduler V1 — 真实 Job 形态调查与字段映射

> 实证调查（investigation）· 只读本机真实 OpenClaw 配置与 gateway bundle。
> 日期：2026-08-15 · 分支：`feat/scheduler-replacement-v1`
> 前置：`docs/investigations/openclaw-replacement-audit.md`（全量差距盘点，本文件
> 只深挖 cron 执行面）。本文件是 `docs/reports/scheduler-replacement-v1.md` 的证据
> 基础，不改任何 OpenClaw 配置、不改 `packages/agent-router/**`。

## 0. 方法、来源与置信度

| 面 | 来源 | 方式 | 置信度 |
|---|---|---|---|
| Job 库存 | `~/.openclaw/cron/jobs.json`（2026-08-15 现网，247 条；enabled 在 135~141 间波动，at 一次性 job 由 daemon 持续创建/删除） | 全量 jq/python 统计 | 高 |
| Job 运行史 | `~/.openclaw/cron/runs/`（2810+ 条 JSONL） | 抽样 + jobId 关联 | 高 |
| 调度语义 | OpenClaw 2026.3.13 gateway bundle（`dist/gateway-cli-*.js` / `update-runner-*.js` / `cron-cli-*.js`，未混淆源码段） | 直接读实现 | 高 |
| cron 引擎 | `croner@10.0.1`（OpenClaw 依赖，5 字段 + tz） | 实跑验证 | 高 |
| 外部 daemon | `~/.openclaw/cron/scripts/forum-scheduler.sh`（v5）+ `cron-domain-scheduler/scripts/unified-dispatcher.py` | 读调用点 | 高 |
| 操作面 | `~/.openclaw/skills/cron-helper/{scripts/diagnose.sh,references/*}` | 读调用点 | 高 |

计数口径：enabled job 数量以「读文件当刻」为准。本调查上午 07:22 读为 135
（cron 117 / at 10 / every 8），下午 09:00 读为 141（cron 117 / at 15 / every 8）——
差异全部来自 at 一次性 job（daemon 每小时新增、deleteAfterRun 后删除），cron 与
every 数量稳定。**兼容性扫描以最新 141 为基准**（fixture 快照 140 条）。

---

## 1. REAL OPENCLAW JOB SHAPE —— 全字段实证

### 1.1 顶层字段（247 条全量统计）

| 字段 | 使用量 | 说明 |
|---|---|---|
| `id` | 247 | uuid；`podcast-`/`service-` 等少数历史 id 非 uuid（every job，仍有效） |
| `name` | 247 | 中文名，如「每日学习-家庭财务」 |
| `agentId` | 241 | **6 条缺失**（3 条 enabled：PPT设计师每日学习/周内化/双周应用检查）——见 §3.2 |
| `enabled` | 247 | 135~141 enabled |
| `schedule` | 247 | 见 §1.2 |
| `sessionTarget` | 247 | `isolated` 246 / `main` 1（disabled） |
| `wakeMode` | 247 | `now` 246 / `next-heartbeat` 1（disabled）——**无真实语义依赖** |
| `payload` | 247 | `agentTurn` 246 / `systemEvent` 1（disabled） |
| `delivery` | 246 | 1 条缺失（disabled） |
| `state` | 247 | 执行状态，见 §1.5 |
| `deleteAfterRun` | 86 | 全部 enabled at job 均为 true |
| `createdAtMs` / `updatedAtMs` | 142 / 243 | 时间戳 |
| `timeoutSec` | 122 | 旧顶层超时字段，恒 3600 |
| `timeoutMs` | 86 | 旧顶层超时字段，恒 1800000 |
| `runTimeoutMs` | 23 | 旧顶层超时字段，恒 1800000 |
| `description` | 14 | 可选说明，无执行语义 |
| `sessionKey` | 15 | 显式会话键（见 §1.6） |
| `everyMs`（顶层） | 6 | **死数据**：全部出现在 cron job 上，与 `schedule.kind` 冲突，运行时不用 |

### 1.2 schedule（247 全量）

| kind | 全量 | enabled | 字段 | 值域 |
|---|---|---|---|---|
| `cron` | 148 | 117 | `expr`（**全部 5 字段**，148/148；136 个不同表达式） | `0 9 * * *`、`30 1 */3 * *`、`23 0,8 * * *`… |
| | | | `tz` | `Asia/Shanghai` 115/148；33 条无 tz → **系统本地时区** |
| | | | `staggerMs` | 显式 7 条（300000/600000）；另外**顶层整点表达式**（minute=`0` 且 hour 含 `*`，如 `0 */3 * * *`）在创建时自动获得默认 300s 错峰 |
| `at` | 86 | 10~15 | `at` | 绝对 ISO（`2026-08-14T23:25:00.000Z`）；daemon 的 `--at 15m` 由 CLI 换算为绝对 ISO 落盘 |
| `every` | 13 | 8 | `everyMs` | 86400000×4 / 3600000×3 / 14400000 / 1800000 |
| | | | `anchorMs` | 全部 13 条有 anchor（创建时刻）；next = anchor + k·everyMs |

enabled at job 全部 `deleteAfterRun: true`、`model: opencode-go/deepseek-v4-flash`
（15/15）、`lightContext` 10/15 —— 均为 forum-scheduler / unified-dispatcher 创建。

### 1.3 payload（246 agentTurn）

| 字段 | 使用量 | 说明 |
|---|---|---|
| `message` | 246 | 长度 min 6 / p50 674 / p90 1286 / max 6739；内容为中文任务指令，引用 daily-learning、cron-domain-scheduler 等 skill |
| `timeoutSeconds` | 189 | 运行超时（运行器唯一读取的超时字段） |
| `lightContext` | 89 | bootstrapContextMode=lightweight（轻量上下文注入） |
| `model` | 88 | 87×`opencode-go/deepseek-v4-flash` + 1×`deepseek/deepseek-v4-flash`（模型覆盖） |

### 1.4 delivery（enabled 统计）

| mode | enabled | 说明 |
|---|---|---|
| `announce` | 90 | 投递 agent 最终文本到 `to`；**86 条 `to=chat:oc_*` 等于该 agent 绑定群**；3 条指向其他群；1 条（每日羊毛扫描）无 `to`（channel=`last` + `bestEffort`） |
| `none` | 43~48 | 不投递（`channel: "last"` 伴随出现，仅记录） |
| `silent` | 2 | 投递但不打扰（`to=chat:oc_*`） |

`delivery.channel`：`feishu` / `last`（opaque）。`delivery.bestEffort`：2 条。
`failureDestination` / `bestEffortDeliver`：**0 条 enabled** —— 失败告警在现网无配置。

### 1.5 state（运行器维护，持久化）

| 字段 | 语义（读 gateway 实现确认） |
|---|---|
| `nextRunAtMs` | 下次运行时刻；enabled=false 时清空 |
| `runningAtMs` | 运行中标记；**invoke 前先持久化**；>2h（STUCK_RUN_MS）视为卡死清除 |
| `lastRunAtMs` / `lastRunStatus` / `lastStatus` | 上次运行起始时刻 / ok·error |
| `lastDurationMs` | 运行耗时 |
| `lastDeliveryStatus` | delivered / not-delivered / not-requested / unknown |
| `consecutiveErrors` | 连续错误数（ok 归零） |
| `lastError` / `lastErrorReason` / `lastDelivered` / `lastDeliveryError` | 错误细节 |

### 1.6 sessionKey（15 条，opaque）

两种形态，**都原样透传给 V1 invoker**：
- `agent:<agentId>:feishu:group:oc_<chatId>` —— 在 agent 自己的飞书群会话里执行
  （`workflow-dispatcher-hr-agent`、`论坛动态调度器 v6`）；
- `agent:hr-agent:cron:<dispatcherJobId>` —— **dispatcher 创建的一次性 job 在父
  dispatcher 的 cron 会话里执行**（`workflow-dispatch-*`、`stagnation-alert`），
  注意前缀 agent 与 job.agentId 可能不同（如 agentId=`ceo-agent`、
  sessionKey=`agent:hr-agent:cron:...`）——这是 OpenClaw 现有行为，V1 不解释、
  不修正，原样交给 invocation seam。

### 1.7 运行记录（runs/ JSONL，2810+ 条）

`{ts, jobId, action: started|finished, status, summary, delivered, deliveryStatus,
sessionId, sessionKey, runAtMs, durationMs, nextRunAtMs, model, provider, usage}`。

---

## 2. 执行语义实证（读 gateway bundle，2026.3.13）

| 语义 | 实现（源码段位置） | V1 复刻 |
|---|---|---|
| 到期判定 | `isRunnableJob`：enabled ∧ 无 runningAtMs ∧ `now >= nextRunAtMs` ∧ 非 error-backoff 中 | ✅ 一致 |
| at 一次性 | `skipAtIfAlreadyRan`：有 lastStatus → 不再跑（error 且 nextRun>lastRun 且到期才重试） | ✅ 一致 |
| at 收尾 | `applyJobResult`：ok ∧ deleteAfterRun → **删除**；ok ∧ 无 deleteAfterRun → **enabled=false**；error → 瞬时错误（rate_limit/overloaded/5xx…）≤3 次按 30s/60s/5m backoff 重试，否则 enabled=false | ✅ 一致 |
| cron next | `computeNextRunAtMs`：croner `nextRun(now)`（含「恰好到点不重复」保护）；error → `max(naturalNext, endedAt + backoff)`，backoff 30s/60s/5m/15m/60m；ok → `max(naturalNext, endedAt+2s)` | ✅ 一致 |
| every next | anchor + ceil((now-anchor)/everyMs)·everyMs；有 lastRunAtMs 时优先 `lastRun+everyMs` | ✅ 一致 |
| 重启补跑 | `planStartupCatchup`：`skipAtIfAlreadyRan=true` + `allowCronMissedRunByLastRun`；**cron 只补最近一次错过的 occurrence**（`previousRunAtMs > lastRunAtMs`，且 lastRunAtMs 必须存在）；at 只在从未跑过且到期时补跑；最多 5 个立即跑，其余错峰 | ✅ 一致（V1 剩余在首个 tick 自然错峰） |
| 崩溃去重 | tick 先 `runningAtMs=now` 全量持久化再 invoke；重启跳过 fresh runningAtMs；>2h 清卡死标记 | ✅ 一致 |
| 超时 | `resolveCronJobTimeoutMs`：payload.timeoutSeconds（缺省 agentTurn 60min 安全上限）；超时报 `cron: job execution timed out` | ✅ 一致（缺省 3600s） |
| 并发 | `cron.maxConcurrentRuns=50`（现网配置） | ✅ V1 可配，默认 5 |
| 失败告警 | `DEFAULT_FAILURE_ALERT_AFTER=2`；但现网 0 条 job 配置 failureDestination | ⏸️ DEFER（无真实使用） |

**重启语义结论（简单、可测试）**：任何一次停机，每个 enabled job **至多补跑一次**
（cron 取最近一个错过的 occurrence；at 只在从未跑过时补跑；every 由 nextRunAtMs
自然保证）；崩溃在 invoke 前先落 runningAtMs 标记，重启不会重复跑（2h 卡死窗口
除外）。这就是 V1 的「不丢不重」契约。

---

## 3. 字段映射：OpenClaw → Agent Core V1

### 3.1 映射表（enabled 141 条全量 structually compatible / importable）

> 措辞说明（第二轮审计）：兼容性数字的证据是「可导入 + 字段映射无损」，不是
> 「未来每次执行的语义等价」——报告统一使用 structurally compatible / importable。

| OpenClaw 字段 | 真实使用量（enabled） | V1 需要 | V1 字段 / 处理 |
|---|---|---|---|
| `id` | 141 | ✅ | 原样保留（标识保持） |
| `name` | 141 | ✅ | 原样保留 |
| `agentId` | 138 | ✅ **必填** | 原样保留；3 条缺失 → **GAP**（见 §3.2） |
| `enabled` | — | ✅ | 原样保留 |
| `schedule.kind` | cron 117 / at 15 / every 8 | ✅ | 同构 |
| `schedule.expr` | 117（5 字段） | ✅ | 同构（croner 同库同版本） |
| `schedule.tz` | 87/117 显式 | ✅ | 同构；缺省=系统本地时区 |
| `schedule.staggerMs` | 显式 1（enabled）+ 整点默认 | ✅ | 同构 + 自动默认 300s（sha256(jobId)%window 稳定错峰） |
| `schedule.at` | 15（绝对 ISO） | ✅ | 同构 |
| `schedule.everyMs`/`anchorMs` | 8 | ✅ | 同构 |
| `sessionTarget` | isolated 141 | ✅ | 同构（main 保留支持） |
| `wakeMode` | 0 语义依赖 | ❌ | **DROP**（1 条 next-heartbeat 为 disabled；heartbeat 无真实机制） |
| `payload.kind` | agentTurn 141 | ✅ | 仅 agentTurn（systemEvent 1 条 disabled → GAP 不入库） |
| `payload.message` | 141 | ✅ | 原样保留 |
| `payload.timeoutSeconds` | 97 | ✅ | 规范字段；顶层 `timeoutSec/timeoutMs/runTimeoutMs`（93/79/19）导入时归一化进此字段（行为等价，OpenClaw 运行器也只读它） |
| `payload.lightContext` | 87 | ✅ | 原样保留（opaque 传给 invoker） |
| `payload.model` | 88 | ✅ | 原样保留（opaque 传给 invoker） |
| `delivery.mode` | announce 90 / none 48 / silent 2 | ✅ | 同构 |
| `delivery.channel` / `to` / `bestEffort` | 129 / 113 / 1 | ✅ | **opaque 原样保留**（`chat:oc_*` 不做任何解释） |
| `deleteAfterRun` | 15（enabled at 全部） | ✅ | 同构；at 默认 true |
| `state.*` | 全部 | ✅ | 同构（nextRunAtMs/lastRunAtMs/lastStatus/lastDurationMs/lastDeliveryStatus/consecutiveErrors/lastError/runningAtMs/lastDelivered）——重启语义连续 |
| `sessionKey` | 7（enabled） | ✅ | opaque 原样保留，覆盖 sessionTarget 传给 invoker |
| `description` | 8 | ⭕ 可选 | 保留（无执行语义） |
| 顶层 `everyMs` | 3（死数据） | ❌ | DROP（cron job 上的残留，运行时不用） |
| `delivery.failureDestination` / `bestEffortDeliver` | 0 | ❌ | DEFER（现网无配置） |

### 3.2 真实 GAP（141 中 3 条，2.1%）

`PPT设计师每日学习`、`PPT设计师周内化`、`PPT设计师双周应用检查` —— **无 agentId**。
实证：V1 需要「一个 job 指向且只指向一个 agent」；这 3 条在 OpenClaw 现网本就
**broken**（runs 记录 sessionId=null、近 36 次运行全部 error / 1 条曾落到默认
agent ceo-agent 的会话）。迁移时需人工补 agentId（例如 `ppt-designer-agent`），
**不是 schema 缺口，是数据缺口** —— 不为此扩设计。

### 3.3 外部 daemon 的提交面（forum-scheduler / workflow-dispatcher）

两个 launchd daemon 调用面（读脚本确认）：

```bash
openclaw cron add --agent <id> --name <name> --at <15m|ISO> --message <msg> \
  --light-context --no-deliver --session isolated --timeout-seconds 600 \
  --delete-after-run --model opencode-go/deepseek-v4-flash --json
openclaw cron list --json        # forum-scheduler 查 pending（只取 id）
openclaw cron runs --id <id> --limit 1   # cron-helper diagnose.sh
```

V1 提交面 = `scripts/agentcore-cron.mjs`（`add/list/runs/rm/enable/disable`，
`--at` 同时接受相对时长与绝对 ISO），domain 操作 = `Scheduler.submitOneShot(...)`
与 `Scheduler.listJobs()`。daemon 只改一行命令名 + `--store` 指向（或
`AGENTCORE_SCHEDULER_STORE`），脚本逻辑本轮不动。`unified-dispatcher.py` 另直读
`~/.openclaw/cron/jobs.json` 做查重 —— 对 V1 的等价物是直读
`~/.agent-core/scheduler/jobs.json`（同一原子写协议，文件格式同构
`{version, jobs}`）。

---

## 4. 明确不做（实证依据）

| 项 | 依据 |
|---|---|
| 完整 OpenClaw cron API clone | 现网只用了 add/list/runs 三个 CLI 面 + jobs.json 直读 |
| heartbeat framework | 无独立 heartbeat 配置/进程；wakeMode=next-heartbeat 仅 1 条 disabled |
| 分布式调度（Redis/Kafka/lock/CronJob） | 单机单 Control Plane 进程即可承载 141 job；无多机实证需求 |
| Workflow | 无 flow/task_runs 现网依赖（flow_runs 0 条） |
| 失败告警推送 | failureDestination 0 条配置 |
| 斜杠命令/日历 UI/移动端 | 与本执行面无关（audit 已证 0 使用） |
| Router/Product Integration 修改 | 本 PR 冻结 `packages/agent-router/**`，只定义 invocation seam 契约 |
