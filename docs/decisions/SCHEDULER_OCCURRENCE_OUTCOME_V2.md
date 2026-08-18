# D-007: Scheduler Occurrence / Outcome / Session / Migration Current Decision V2

- 状态: proposed
- 日期: 2026-08-19
- 类型: standalone replacement Decision（不是 D-005 amendment）
- 提议取代: D-005 `SCHEDULER_V1.md`
- Governing Spec: `docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md`（proposed）
- Product dependency: D-006 `AGENT_WORKSPACE_SESSION_MODEL_V2.md`（accepted）
- Evidence: `OPENCLAW_TO_AGENT_CORE_SCHEDULED_WORK_MIGRATION_AUDIT_V1 = PASS`
- 本轮范围: Decision / Spec text only；无 implementation、production jobs、missed-run replay、Scheduler store mutation、deployment 或 merge。

> **Authority rule:** D-005 在本 Decision accepted 前继续是 Current Authority。本文件为 proposed，不提前覆盖 D-005。接受时必须原子完成 `D-007 -> accepted`、`D-005 -> superseded-by-D-007`、双向 backlink 与 Decision index 更新。

---

## 0. 一句话 Current Model（接受后）

```text
Job
→ produces logical scheduled occurrences

one occurrence
→ one stable occurrenceId
→ one runId
→ one admission idempotency key
→ at most one Router admission
→ one fresh non-main Session
→ same Agent primary Workspace
→ succeeded | failed | outcome_unknown

timeout without proven termination
→ outcome_unknown
→ execution fence
→ no automatic retry / no further same-job admission until resolved

ordinary proven failure
→ may create a NEW retry occurrence under explicit policy

OpenClaw migration
→ definitions only
→ strip legacy execution state
→ no catch-up
→ restore count before hardening = 0
```

---

## 1. 为什么必须取代 D-005，而不是 amendment

D-005 已 accepted，并冻结了：

- timeout 被普通 error path 消化；
- job-level `runningAtMs` / `lastStatus` 作为执行状态；
- stale running marker 可在固定时间后清除；
- isolated execution 默认复用稳定 per-job Session；
- OpenClaw 风格 retry / catch-up。

新的 evidence 与 Owner rulings改变的是 normative execution model，而不只是补一句注释：

```text
execution identity: job-level -> occurrence-level
timeout result: error -> outcome_unknown
retry identity: same execution slot -> new occurrence
session scope: per-job -> per-execution
migration: legacy catch-up -> no catch-up
```

在 D-005 stable ID 下直接改写，会让未来 Agent 无法知道哪些旧语义仍有效，也违反 accepted Decision immutability。

因此：

```text
D005_DISPOSITION = SUPERSEDE
D007_IS_COMPLETE_STANDALONE_CURRENT_DECISION = YES
PARTIAL_MANUAL_MERGE_WITH_D005_REQUIRED = NO
```

D-007 必须把所有继续有效的 D-005 语义重新写在本文，而不是说“其余见 D-005”。

---

## 2. Authority Transition

### Proposed 阶段

```text
D005_STATUS = accepted / Current Authority
D007_STATUS = proposed / no implementation authority
```

### Acceptance transaction

独立 review PASS 后，由 authorized owner / maintainer 在同一次 docs-only transition 中完成：

```text
D007_STATUS: proposed -> accepted
D005_STATUS: accepted -> superseded-by-D-007
D005_REPLACED_BY = D-007
D007_SUPERSEDES = D-005
Decision index = D-007 current, D-005 superseded
```

不允许出现：

```text
D-007 accepted
AND
D-005 仍被标为 parallel accepted Current Authority
```

---

## 3. Entity Model

### 3.1 Job

Job 是长期 schedule definition：

- `jobId`；
- target `agentId`；
- schedule `cron | at | every`；
- payload；
- delivery directive；
- enabled / disabled；
- retry policy；
- definition revision。

Job 不是某一次执行，也不直接代表“正在运行”。

### 3.2 Scheduled occurrence

Occurrence 是 Job 产生的一次逻辑执行机会：

```text
cron slot
at instant
every anchor-derived slot
ordinary failed 后显式产生的 retry slot
```

每个 occurrence 只有一个稳定身份。

### 3.3 Run

Run 是 occurrence 的唯一 admitted execution attempt。V1：

```text
ONE_OCCURRENCE_MAX_RUNS = 1
```

若 ordinary `failed` 允许 retry，retry 是一个新的 occurrence / run，不是原 occurrence 第二次运行。

### 3.4 Admission

Admission 是 Scheduler 把 occurrence 交给 Router / Agent execution boundary 的动作。

```text
admitted != running
running  != terminated
cancel requested != terminated
local promise timeout != terminated
```

---

## 4. Stable Identity

每次 occurrence 必须持久拥有：

```text
jobId
scheduleRevision
occurrenceId
runId
requestId / idempotencyKey
payloadHash
nominalScheduledAt OR retryOfOccurrenceId
admittedAt
nativeSessionId (after known; evidence, not product authority)
```

### 4.1 occurrenceId

必须跨 tick、restart、store reload 稳定。编码不冻结；允许：

- 对 `(jobId, scheduleRevision, nominalScheduledAt)` 确定性派生；或
- 在 mutation lock 内 mint 并持久化。

禁止：

- 仅靠 RAM sequence；
- restart 后按当前时间重新 mint；
- 用 `runningAtMs` 充当 occurrence identity；
- 同一 occurrence 获得第二个 occurrenceId。

### 4.2 runId

一个 occurrence 对应一个 runId。late result、日志和 cancellation evidence 必须引用同一 `(occurrenceId, runId)`。

### 4.3 requestId / idempotencyKey

必须稳定绑定 occurrence，且在所有 Router / admission retry transport 中复用。

```text
same key + same payload hash
→ return current/previous admission status
→ no second enqueue

same key + different payload hash
→ conflict / fail loud
```

---

## 5. Durable Occurrence States

最小状态：

```text
admitted
running
succeeded
failed
outcome_unknown
```

### admitted

Occurrence 已在 durable store reserve，identity 与 payload hash 已固定；Router call 可能尚未发出、正在进行、receipt 丢失或已经返回。

Reservation 必须先于首次 Router call。

### running

有可信 evidence 证明 exact run 已开始执行。仅“Scheduler 调用了 invoker”不一定等于 running。

### succeeded

Exact run 有可信 terminal success。

### failed

只有两类：

1. proven pre-start terminal rejection（turn 明确未开始）；
2. exact run 返回 terminal failure，且有 evidence 证明不再继续执行。

### outcome_unknown

无法证明 exact run succeeded、failed 或 terminated。典型原因：

- execution timeout；
- process / pipe crash；
- admission receipt 丢失；
- Scheduler 重启时 record 为 admitted/running；
- cancel request sent，但没有 termination acknowledgment；
- terminal callback 丢失；
- 无法把 process exit精确归因到该 turn 的终止。

---

## 6. State Transitions

```text
(no record)
  -> admitted

admitted
  -> running
  -> failed               # proven pre-start terminal rejection
  -> outcome_unknown      # crash / timeout / no proof

running
  -> succeeded
  -> failed               # proven terminal failure + termination
  -> outcome_unknown

outcome_unknown
  -> succeeded | failed   # trusted late settlement / reconciliation only
  -> NEVER admitted again
```

禁止：

```text
outcome_unknown -> admitted
runningAt stale -> clear -> re-admit same occurrence
same occurrence -> second runId
same occurrence -> second Router admission
```

---

## 7. Timeout / Cancellation / Termination

长期语义：

```text
TIMEOUT_WITHOUT_PROVEN_TERMINATION = outcome_unknown
TIMEOUT_IS_ORDINARY_FAILED = NO
```

### 7.1 Current boundary

当前 Scheduler 会发送 `AbortSignal`，但 Router / AgentProcess 没有 active-turn cancel + proven termination contract。

因此当前唯一安全输出：

```text
AbortSignal sent
AND no terminal proof
→ outcome_unknown
```

### 7.2 Proven termination

未来若加入 cancellation，只有正向 evidence 才允许 terminal failure/cancel result，例如：

- exact turn terminal acknowledgment；
- exact queued turn 被可信移除且从未开始；
- process lifecycle evidence 能证明 exact turn 不可能继续。

单纯 kill 一个可能承载其他 surface / occurrence turn 的 AgentProcess，不自动满足要求。实现若选择 kill，必须先证明 attribution 与 collateral effect 安全。

### 7.3 Execution fence

当某 occurrence 为 `outcome_unknown` 且原执行可能仍活着：

```text
same occurrence automatic retry = forbidden
same job later occurrence admission = held
```

该 Job 进入 execution fence，直到：

- trusted late settlement / termination evidence resolve；或
- authorized operator 做显式 reconciliation。

被 fence 期间产生的自然 schedule slots 不自动积压补跑；解除 fence 后从下一个 future natural occurrence 继续，除非新的 accepted policy 明确允许其他行为。

此规则避免 recurring job 在旧 turn 仍可能运行时继续产生新副作用。

---

## 8. Ordinary Failed and Retry

`failed` 与 `outcome_unknown`必须类型分离。

普通 proven failure 可以命中显式 retry policy，但：

```text
retry = new retry occurrence
new occurrenceId
new runId
new idempotencyKey
retryOfOccurrenceId = previous occurrenceId
```

### 8.1 Retained default backoff

D-005 的默认 backoff 可保留：

```text
one-shot retry: 30s / 60s / 5m, max 3
recurring error backoff: 30s / 60s / 5m / 15m / 60m
```

但它们只适用于 ordinary proven failure，并调度新的 occurrence。

### 8.2 Non-idempotent jobs

即使 terminal result 是 `failed`，也不必然证明 downstream side effect 没发生。对于非幂等 job：

```text
AUTO_RETRY_DEFAULT = NO
```

只有 job 有明确 retry classification / downstream idempotency key / business proof 时，才可启用自动 retry policy。

### 8.3 One-shot completion

- succeeded + `deleteAfterRun=true`：可删除 Job definition；occurrence evidence 仍保留；
- succeeded + keep：Job disabled；
- ordinary failed：按显式 policy 新建 retry occurrence，或 disabled；
- outcome_unknown：不删除为“成功”，不按普通 failure retry；Job fenced 等待 reconcile。

### 8.4 Recurring completion

- succeeded：安排下一自然 occurrence；
- ordinary failed：按 explicit retry/new occurrence 或下一自然 occurrence policy；
- outcome_unknown：fence same Job，后续自然 occurrence 暂不 admission。

---

## 9. Scheduling Semantics Retained from D-005

D-007 接受后继续冻结：

### 9.1 Schedule kinds

```text
cron
at
every
```

不扩成完整 OpenClaw cron API clone。

### 9.2 Agent target

```text
agentId = required
```

未知 / disabled / missing Agent 必须 fail closed；不得 fallback default Agent。

### 9.3 Single-machine persistence

继续采用最小单机持久化：

- atomic JSON or equivalent single-machine durable store；
- append-only / bounded run and occurrence evidence；
- fail loud on corrupt state；
- no Redis / Kafka / distributed transaction / leader election。

Store schema 必须能保存 occurrence records；Job-level state 不能继续作为唯一 execution authority。

### 9.4 Mutation authority

继续保留：

```text
cross-process lock
-> re-read latest
-> mutate fresh state
-> fsync / atomic commit
-> update RAM only after commit
```

### 9.5 Tick single-flight

同一 Scheduler instance 一次只执行一个 collection/admission pass。并发 tick 合并；同一 occurrence 仍由 durable reservation 防止跨进程/重启重复 admission。

### 9.6 CLI control-only

`agentcore-cron` 等提交面不得因 add/list/runs/rm/enable/disable 自己执行 due job 或 catch-up。

### 9.7 Thin seams

Scheduler 保持：

- 不理解 Forum / Workflow / OKR；
- 不理解 Feishu product policy；
- invocation / delivery 走注入 seam；
- channel / target 对 Scheduler 是 opaque directive。

### 9.8 Disabled

Disabled Job 永不产生新 occurrence；definition import 不能通过默认值把 disabled 变 enabled。

---

## 10. Runtime Restart Policy

D-007 区分两类 restart：Agent Core native runtime restart 与 OpenClaw migration。

### 10.1 Native Agent Core runtime restart

已有 occurrence record：

- terminal → 不重放；
- admitted/running 且无 termination proof → `outcome_unknown` + Job fence；
- same occurrence never re-admit。

停机期间完全没有 occurrence record 的 schedule slots：

```text
RUNTIME_CATCH_UP_MAX = one new catch-up occurrence per Job per downtime
```

仅允许为最近一个 eligible missed slot创建新的 occurrenceId；不得对应已存在 record，不得绕过 execution fence。

never-ran cron仍从未来自然 occurrence开始，除非明确 current policy允许 catch-up；at one-shot仅在未 stale且没有 occurrence record时处理。

### 10.2 OpenClaw migration restart / cutover gap

```text
MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
```

94 个 missed occurrence 不创建 occurrence record、不 admission、不逐步补跑。

---

## 11. Scheduled Session Model（D-006）

```text
SCHEDULED_SESSION_SCOPE = PER_OCCURRENCE
SCHEDULED_SESSION_REUSE = NO
SCHEDULED_MAIN_SESSION = NOT_ALLOWED
```

每次 occurrence admission：

```text
fresh non-main native Session
same Agent
same Agent primary Workspace
same Agent credential / grants
trajectory isolated from other occurrences
```

当前：

```text
agent:<agentId>:cron:<jobId>
```

不得继续作为 final product session。

具体 native Session ID 是 implementation detail；可由 occurrenceId 派生或 mint，并存入 occurrence evidence。该记录不是独立 Session Mapping DB。

Non-main trajectory 不 merge 回 main；跨 execution continuity 来自 Workspace、MEMORY.md、files 与显式结果，符合 D-006。

---

## 12. OpenClaw Migration Owner Rulings

输入 fleet：

```text
total = 280
enabled = 140
disabled = 140
Agent Core production jobs = 0
```

Enabled classification：

```text
SAFE_READ_ONLY = 0
IDEMPOTENT_WRITE = 0
NON_IDEMPOTENT_SIDE_EFFECT = 113
RECORDING_OR_REMINDER = 4
DAEMON_OR_LONG_RUNNING = 3
OBSOLETE_OR_DUPLICATE = 13
BLOCKED = 7
```

### 12.1 Legacy execution state

```text
LEGACY_EXECUTION_STATE = STRIP
```

Import definition 时删除/忽略：

- lastRun / lastStatus；
- runningAt；
- consecutive error state；
- legacy retry state；
- 会触发历史 occurrence 的 past-due nextRunAt；
- legacy stable session identity。

Recurring Job 从 activation 后下一个 future natural occurrence开始。

### 12.2 Missed runs

```text
MISSED_OCCURRENCES = 94
MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
```

不转换成 immediate jobs，不分批回放，不因为旧 error 状态“补偿执行”。

### 12.3 Missing Agent ID

```text
MISSING_AGENT_ID_JOBS = BLOCKED
```

3 个无 Agent ID jobs 不猜测 target、不按名称模糊匹配、不使用 default Agent。

### 12.4 Stale one-shots

```text
STALE_ONE_SHOTS = DO_NOT_IMPORT
```

过去的 at target 不转换为 now。

### 12.5 Disabled jobs

```text
DISABLED_JOBS = KEEP_DISABLED
```

### 12.6 Daemon / long-running

```text
DAEMON_JOBS = OUT_OF_SCHEDULER
```

由独立 supervision / daemon deployment owner处理。

### 12.7 Obsolete / duplicate / blocked

本 Decision 不自动恢复这些 jobs。逐项 disposition 必须来自 migration audit / Owner ruling；默认无 enable authority。

---

## 13. Restore Gate

在以下全部完成前：

```text
SCHEDULER_TIMEOUT_OUTCOME_V1 = accepted
D-007 = accepted
Scheduler implementation review = PASS
occurrence / idempotency / unknown fault tests = PASS
migration prerequisites = PASS
```

不得自动启用：

```text
NON_IDEMPOTENT_SIDE_EFFECT = 113
RECORDING_OR_REMINDER = 4
```

最终冻结：

```text
READY_TO_RESTORE_BEFORE_HARDENING = 0
```

Spec / Decision review本身不创建 production jobs，也不授权 import。

---

## 14. D-005 Disposition Matrix

| D-005 area | D-007 disposition | Current meaning after D-007 acceptance |
|---|---|---|
| cron / at / every | PRESERVE | 继续支持三种 schedule definition |
| agentId required | PRESERVE | 缺失 target = blocked |
| single-machine minimal store | PRESERVE + EXTEND | 保存 Job definitions + occurrence records |
| atomic persist / mutation lock | PRESERVE | 锁内重读最新、原子 commit |
| tick single-flight | PRESERVE | instance pass不重叠 |
| CLI control-only | PRESERVE | CLI 不执行 job |
| opaque invoker / delivery seams | PRESERVE | Scheduler 保持产品无知 |
| disabled never runs | PRESERVE | 不 mint occurrence |
| ordinary error backoff | PRESERVE WITH NEW IDENTITY | 仅 proven failure；retry = new occurrence |
| at success delete/disable | PRESERVE | occurrence evidence保留 |
| job-level runningAt as no-dup | REPLACE | occurrence reservation + idempotency key |
| stale running marker clear + rerun | REPLACE | unknown + fence；不 re-admit same occurrence |
| timeout as ordinary error | REPLACE | timeout without termination = outcome_unknown |
| stable per-job isolated Session | REPLACE | fresh non-main Session per occurrence |
| migration catch-up from legacy state | REPLACE | no catch-up；strip state |
| same occurrence retry | REPLACE | retry uses new occurrence |
| AbortSignal observed = cancellation | REJECT | cancel request != terminated |

D-007 是完整 Current Decision；表中 PRESERVE 条款已在本文正文重述，无需继续读取 D-005 才能实施。

---

## 15. Explicitly Out of Scope

```text
Forum/Workflow credential provisioning
channel:last delivery
payload.model passthrough
model fallback
OpenClaw daemon deployment
fleet job import implementation
```

同时不建设：

- 通用 Workflow Engine；
- distributed exactly-once system；
- distributed transaction；
- Session Mapping DB；
- Router product special cases；
- DSH Kernel changes。

---

## 16. Consequences

### Positive

- timeout 不再伪装成普通失败；
- 同一 occurrence 不会二次进入 Router；
- retry / natural next run 有独立 identity；
- crash 后宁可 unknown，不冒险重复副作用；
- scheduled sessions 符合 D-006；
- OpenClaw 迁移不会突然补跑 94 次历史任务；
- D-005 authority 不需要人工拼 amendment。

### Cost

- outcome_unknown 可能 fence 一个 Job，直到 evidence / operator reconcile；
- reserve-before-admission crash 可能保守地漏掉一次执行；
- 需要 durable occurrence ledger 与 migration schema change；
- 非幂等 fleet restore 必须继续等待 hardening。

这是有意的 safety tradeoff：

```text
prefer one visible unknown / missed execution
over duplicated unknown external side effects
```

---

## 17. Acceptance Conditions

D-007 可 accepted 的条件：

1. `SCHEDULER_TIMEOUT_OUTCOME_V1` independent review PASS；
2. preserved / replaced D-005 semantics完整，无“其余自己拼旧文档”；
3. timeout / failed / unknown类型清楚；
4. occurrence identity与 at-most-once admission清楚；
5. unknown execution fence清楚；
6. retry = new occurrence；
7. AbortSignal / termination分离；
8. D-006 fresh Session per execution一致；
9. migration no-catch-up与 restore gate完整；
10. acceptance transaction同时标记 D-005 superseded；
11. 无 implementation、production jobs、store mutation或 Kernel change。

---

## 18. Final Decision Output（proposed）

```text
DECISION_ID = D-007
DECISION_STATUS = proposed
SUPERSEDES_ON_ACCEPTANCE = D-005
CURRENT_AUTHORITY_BEFORE_ACCEPTANCE = D-005

TIMEOUT_OUTCOME = outcome_unknown
UNKNOWN_EXECUTION_FENCE = SAME_JOB_NO_FURTHER_ADMISSION_UNTIL_RESOLVED
SAME_OCCURRENCE_ADMISSION = AT_MOST_ONCE
RETRY_IDENTITY = NEW_OCCURRENCE
DURABLE_EXECUTION_STATES = admitted,running,succeeded,failed,outcome_unknown

SCHEDULED_SESSION_MODEL = FRESH_NON_MAIN_PER_OCCURRENCE
SCHEDULED_WORKSPACE = SAME_AGENT_PRIMARY_WORKSPACE
STABLE_PER_JOB_CRON_SESSION = SUPERSEDED

MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
MISSING_AGENT_ID_JOBS = BLOCKED
STALE_ONE_SHOTS = DO_NOT_IMPORT
DISABLED_JOBS = KEEP_DISABLED
DAEMON_JOBS = OUT_OF_SCHEDULER
READY_TO_RESTORE_BEFORE_HARDENING = 0

KERNEL_CHANGE = NONE
PRODUCT_CODE_CHANGE_THIS_ROUND = NONE
PRODUCTION_STATE_CHANGE_THIS_ROUND = NONE
SCHEDULER_STORE_CHANGE_THIS_ROUND = NONE
MERGE = NO
```
