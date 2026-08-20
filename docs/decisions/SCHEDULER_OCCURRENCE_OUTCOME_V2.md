# D-007: Scheduler Occurrence / Outcome / Session / Migration Current Decision V2

- 状态: accepted（2026-08-20）
- 日期: 2026-08-19
- 类型: standalone replacement Decision（不是 D-005 amendment）
- supersedes: D-005 / SCHEDULER_V1（`docs/decisions/SCHEDULER_V1.md`；acceptance 时正式激活，D-005 已同步标记 superseded）
- Governing Spec: `docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md`（accepted）
- Product dependency: D-006 `AGENT_WORKSPACE_SESSION_MODEL_V2.md`（accepted）
- Evidence: `OPENCLAW_TO_AGENT_CORE_SCHEDULED_WORK_MIGRATION_AUDIT_V1 = PASS`
- 本轮范围: Decision / Spec text only；无 implementation、production jobs、missed-run replay、Scheduler store mutation、deployment 或 merge。
- Acceptance provenance: accepted_reviewed_head = 3776b1929a05d0e8c81a6cacde576b39a5151017；AGENT_CORE_HARDENING_PROGRAM_V1_PR11_AMENDMENT_FOCUSED_RE_REVIEW = PASS（REQUIRED_FIXES = NONE；VERDICT = READY_TO_ACCEPT_AND_MERGE_PR11_SPEC_SET）；accepted 2026-08-20。

> **Authority rule:** D-005 在本 Decision accepted 前继续是 Current Authority。本文件为 proposed，不提前覆盖 D-005。接受时必须原子完成 `D-007 -> accepted`、`D-005 -> superseded-by-D-007`、双向 backlink 与 Decision index 更新。
>
> **Standalone completeness rule:** D-007 接受后，未来 Agent 只读 D-007 即可得到 Scheduler 的完整 Current Truth；不得要求读者再从 D-005、当前代码或旧迁移脚本中补齐 Job schema、调度计算、持久化、控制面或结果写回语义。

---

## 0. 一句话 Current Model（接受后）

```text
Job definition
→ produces logical scheduled occurrences

one occurrence
→ one stable occurrenceId
→ one runId
→ one admission idempotency key
→ durable reserve before Router
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
→ reviewed definitions only
→ strip legacy execution state
→ no catch-up
→ restore count before hardening = 0
```

---

## 1. 为什么必须取代 D-005，而不是 amendment

D-005 已 accepted，并冻结了 Job 模型、调度计算、持久化、控制面、执行状态、retry、catch-up 与 Session 策略。新的 evidence 与 Owner rulings 改变的是整体 normative execution model，而不只是增加一个 timeout 注释：

```text
execution identity: job-level -> occurrence-level
timeout result: error -> outcome_unknown
retry identity: same execution slot -> new occurrence
session scope: per-job -> per-occurrence
migration: legacy catch-up -> no catch-up
execution ownership: runningAtMs -> durable occurrence reservation
```

在 D-005 stable ID 下直接改写，会破坏 accepted Decision immutability，也会迫使未来 Agent 人工判断哪些旧句子仍有效。

因此：

```text
D005_DISPOSITION = SUPERSEDE
D007_IS_COMPLETE_STANDALONE_CURRENT_DECISION = YES
PARTIAL_MANUAL_MERGE_WITH_D005_REQUIRED = NO
DIRECT_NORMATIVE_REWRITE_UNDER_D005 = FORBIDDEN
```

D-007 必须逐项重述或明确处置 D-005 的全部 normative clauses。某条旧语义只有三种合法 disposition：

```text
PRESERVE
REPLACE
DEFER_TO_IMPLEMENTATION_DETAIL
```

不得使用“其余沿用 D-005”作为 Current Truth。

---

## 2. Authority Transition

### 2.1 Proposed 阶段

```text
D005_STATUS = accepted / Current Authority
D007_STATUS = proposed / no implementation authority
```

本 proposed Decision 不授权代码、迁移、生产 job 创建或 store 修改。

### 2.2 Acceptance transaction

独立 review PASS 后，由 authorized owner / maintainer 在同一次 docs-only transaction 中完成：

```text
D007_STATUS: proposed -> accepted
D005_STATUS: accepted -> superseded-by-D-007
D005_REPLACED_BY = D-007
D007_SUPERSEDES = D-005
Decision index = D-007 current, D-005 superseded
mutual backlinks = present
```

不允许出现：

```text
D-007 accepted
AND
D-005 仍被标为 parallel accepted Current Authority
```

---

## 3. Job Definition Model（完整 Current Truth）

Job 是长期 schedule definition，不是某一次执行，也不直接代表“正在运行”。D-007 接受后，Scheduler Job definition 的 normative 真子集为：

```text
Job {
  id: string                         # stable jobId
  name: string
  description?: string
  agentId: string                    # required
  enabled: boolean

  schedule:
    | { kind: "cron", expr: string, tz?: string, staggerMs?: number }
    | { kind: "at", at: ISO-instant }
    | { kind: "every", everyMs: number, anchorMs?: number }

  payload: {
    kind: "agentTurn"
    message: string
    timeoutSeconds?: positive integer
    lightContext?: boolean
    model?: string                   # opaque field; runtime passthrough is a later prerequisite
  }

  delivery: {
    mode: "announce" | "none" | "silent"
    channel?: string                 # opaque
    to?: string                      # opaque
    bestEffort?: boolean
  }

  deleteAfterRun?: boolean
  createdAtMs: number
  updatedAtMs: number
}
```

### 3.1 Definition fields vs execution fields

Occurrence identity、admission ownership 与 terminal outcome 不属于 Job definition。以下历史 Job-level state 不再是 execution authority：

```text
runningAtMs
lastStatus
lastRunStatus
lastRunAtMs
consecutiveErrors
lastError
lastDurationMs
lastDeliveryStatus
lastDelivered
```

实现可以保留部分字段作为**派生 summary/cache/public projection**，但必须满足：

- authority 来自 occurrence records；
- summary 可删除并由 occurrence ledger 重建；
- summary 不得触发同 occurrence 第二次 admission；
- `runningAtMs` 不得再作为唯一 no-dup 或 termination proof。

`nextRunAtMs` 可以作为 schedule projection/cache，但不是 occurrence identity；它必须可由 Job definition、latest terminal occurrence、fence 与 retry policy重新计算。

### 3.2 Legacy Session fields disposition

D-005 Job 模型中的：

```text
sessionTarget
sessionKey
```

不再是当前 scheduled product schema。它们不能选择 `main`，也不能建立稳定 per-job Session。

```text
LEGACY_SESSION_TARGET_FIELD = REPLACED
LEGACY_SESSION_KEY_FIELD = REPLACED
NEW_JOB_SESSION_SELECTION_FIELDS = NONE
```

旧定义中的这些字段只能作为 migration input 被报告；未来 importer 必须 strip，并按 D-006 统一执行 fresh non-main Session。含 `main` 或显式稳定 Session 意图的旧 Job 不得静默恢复，必须保持 disabled/blocked，直到 migration review确认其新语义。

### 3.3 Legacy field normalization / rejection

以下规则从 D-005 完整保留并收口：

```text
canonical timeout = payload.timeoutSeconds
```

- `payload.timeoutSeconds`：正数，规范化为整数秒；
- legacy top-level `timeoutSec`：按秒转换到 `payload.timeoutSeconds`；
- legacy top-level `timeoutMs` / `runTimeoutMs`：除以 1000 后规范化为整数秒；转换后不足 1 秒或非法值不得静默变成有效 timeout；
- `wakeMode`、top-level dead `everyMs`、`state.status` 与其他无当前语义的 dormant fields：不进入新 Job schema，import report 必须说明 dropped disposition；
- `payload.kind != agentTurn`（包括 legacy `systemEvent`）：不自动转换为 Agent turn，Job = BLOCKED / NOT IMPORTED；
- unknown schedule kind、invalid cron expression、empty message、missing id/name/agentId：fail loud / gap report，不猜测；
- unknown delivery mode：fail loud / gap report。

`payload.model` 字段可以保存在 definition 中，但其 provider/model passthrough、fallback 与生产可用性不由本 Decision证明，也不得成为 restore authority。

### 3.4 Schedule normalization

- cron expression = 5 fields；`tz` 缺席时使用部署系统本地 timezone；
- `staggerMs` 显式值优先；符合 recurring top-of-hour 形态且未显式配置时，保留 300 秒默认 stagger window；per-Job offset 必须稳定（由 jobId 确定），避免 restart 后漂移；
- at = 单一绝对 instant，规范化为 ISO instant；
- every = 正整数 `everyMs`，可选非负 `anchorMs`；未给 anchor 时以 Job `createdAtMs` 为 fallback anchor。

---

## 4. Entity Model

### 4.1 Scheduled occurrence

Occurrence 是 Job schedule 产生的一次逻辑执行机会：

```text
cron nominal slot
at instant
every anchor-derived slot
ordinary failed 后显式产生的 retry slot
native runtime downtime policy产生的 catch-up slot
```

每个 occurrence 只有一个稳定身份。

### 4.2 Run

Run 是 occurrence 的唯一 admitted execution attempt。V1：

```text
ONE_OCCURRENCE_MAX_RUNS = 1
```

若 ordinary `failed` 允许 retry，retry 是新的 occurrence / run，不是原 occurrence 第二次运行。

### 4.3 Admission

Admission 是 Scheduler 把 occurrence 交给 Router / Agent execution boundary 的动作。

```text
reserved/admitted != running
running           != terminated
cancel requested  != terminated
local timeout     != terminated
```

---

## 5. Stable Identity

每次 occurrence 必须持久拥有：

```text
jobId
scheduleRevision
occurrenceId
runId
requestId / idempotencyKey
payloadHash
nominalScheduledAt OR retryOfOccurrenceId / catchUpOfNominalAt
admittedAt
nativeSessionId (after known; evidence, not product authority)
```

### 5.1 occurrenceId

必须跨 tick、restart、store reload 稳定。编码不冻结；允许：

- 对 `(jobId, scheduleRevision, nominalScheduledAt)` 确定性派生；或
- 在 mutation lock 内 mint 并持久化。

禁止：

- 仅靠 RAM sequence；
- restart 后按当前时间重新 mint；
- 用 `runningAtMs` 充当 occurrence identity；
- 同一 occurrence 获得第二个 occurrenceId。

### 5.2 scheduleRevision

任何会改变未来 occurrence 的 schedule/payload/target/retry 语义的 Job update 必须产生新的 definition revision。已存在 occurrence 继续绑定创建它时的 revision 与 payloadHash；后续更新不得改变其身份或 payload。

### 5.3 runId

一个 occurrence 对应一个 runId。late result、日志、delivery evidence 与 cancellation evidence 必须引用同一 `(occurrenceId, runId)`。

### 5.4 requestId / idempotencyKey

必须稳定绑定 occurrence，且在所有 Router / admission transport retry 中复用。

```text
same key + same payload hash
→ return current/previous admission status
→ no second enqueue

same key + different payload hash
→ conflict / fail loud
```

---

## 6. Durable Occurrence States

最小 durable states：

```text
admitted
running
succeeded
failed
outcome_unknown
```

### admitted

Occurrence 已 durable reserve，identity 与 payloadHash 已固定；首次 Router call 可能尚未发出、正在进行、receipt 丢失或已经返回。

Reservation 必须先于首次 Router call。

### running

有可信 evidence 证明 exact run 已开始执行。仅“Scheduler 调用了 invoker”不等于 running。

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

### 6.1 State transitions

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

## 7. Due Eligibility and Scheduling Calculation

### 7.1 Due eligibility

一个 Job 只有同时满足以下条件，才可为某个 nominal slot创建 occurrence：

```text
enabled = true
agentId resolves to runnable Agent
no active unresolved execution fence for this Job
nominal scheduled time <= now
no existing occurrence record for the same (jobId, scheduleRevision, nominal slot)
not suppressed by explicit ordinary-failure backoff / retry policy
not stale or otherwise blocked by migration policy
```

创建 occurrence 后，必须先 durable reserve，再进入 Router。旧条件“无 `runningAtMs`”由“无冲突 occurrence ownership + 无 execution fence”取代。

### 7.2 Cron next occurrence

- 使用 5-field cron expression和 resolved timezone；
- optional stable stagger 后的 nominal time 必须严格晚于计算 reference time；
- successful/terminal run 后，下一 natural occurrence 必须严格晚于 run end，并保留最小 2 秒 refire gap；
- 同一 nominal slot 在 restart、tick 重入或 timezone evaluation重算后仍只能对应一个 occurrence identity。

### 7.3 At one-shot

- `at` 产生一个 nominal occurrence；
- succeeded + `deleteAfterRun=true`：可删除 Job definition，但 occurrence evidence继续存在；
- succeeded + keep：Job disabled；
- ordinary failed：只有显式 retry policy允许时创建新的 retry occurrence；
- outcome_unknown：Job fenced；
- migration/restore 时已过去的 stale at = DO_NOT_IMPORT，不转成立即执行。

### 7.4 Every next occurrence

`every` 是 anchor-aligned fixed-rate schedule：

- `anchorMs` 缺席时使用 Job `createdAtMs`；
- normal natural next = 最小 `anchor + k * everyMs`，且严格晚于计算 reference time；
- 保留 D-005 的兼容规则：若 latest proven terminal occurrence 的 `lastRunAt + everyMs`仍晚于 now，可作为 next；否则回到 anchor alignment；
- next projection 不得覆盖已有 occurrence identity。

### 7.5 Ordinary failure next / backoff calculation

D-005 的 backoff数值保留为默认公式，但仅适用于 ordinary proven failure 且必须由显式 retry policy授权：

```text
one-shot: 30s / 60s / 5m，最多 3 次
recurring: 30s / 60s / 5m / 15m / 60m
```

对于 recurring ordinary failure：

```text
next eligible occurrence time
= max(naturalNext, endedAt + selectedBackoff)
```

该 next 是新的 occurrence identity。不得把原 occurrence 清空后重跑，也不得同时为同一 recovery window生成一个 retry occurrence和一个冲突 natural occurrence。

非幂等 Job 默认：

```text
AUTO_RETRY_DEFAULT = NO
```

只有 downstream idempotency proof、明确 business proof 或 accepted per-class retry policy存在时，才允许启用自动 retry。

---

## 8. Timeout / Cancellation / Termination

长期语义：

```text
TIMEOUT_WITHOUT_PROVEN_TERMINATION = outcome_unknown
TIMEOUT_IS_ORDINARY_FAILED = NO
```

### 8.1 Current boundary

当前 Scheduler 会发送 `AbortSignal`，但 Router / AgentProcess 没有 active-turn cancel + proven termination contract。

因此当前唯一安全输出：

```text
AbortSignal sent
AND no terminal proof
→ outcome_unknown
```

### 8.2 Proven termination

未来若加入 cancellation，只有正向 evidence 才允许 terminal failure/cancel result，例如：

- exact turn terminal acknowledgment；
- exact queued turn 被可信移除且从未开始；
- process lifecycle evidence 能证明 exact turn 不可能继续。

单纯 kill 一个可能承载其他 surface / occurrence turn 的 AgentProcess，不自动满足要求。实现若选择 kill，必须先证明 attribution 与 collateral effect 安全。

### 8.3 Execution fence

当某 occurrence 为 `outcome_unknown` 且原执行可能仍活着：

```text
same occurrence automatic retry = forbidden
same job later occurrence admission = held
```

该 Job 进入 execution fence，直到：

- trusted late settlement / termination evidence resolve；或
- authorized operator 做显式 reconciliation。

被 fence 期间产生的自然 schedule slots不自动积压补跑；解除 fence 后从下一个 future natural occurrence继续，除非新的 accepted policy 明确允许其他行为。

### 8.4 Late settlement

同一 `occurrenceId/runId` 的迟到 success、failure、termination 或 external-effect evidence 必须追加保存，不能静默丢弃，也不能触发二次 admission。

允许：

```text
outcome_unknown -> succeeded | failed
```

但 timeout/unknown history仍须可审计。状态解析不是 retry。

---

## 9. Ordinary Failed and Retry

`failed` 与 `outcome_unknown`必须类型分离。

普通 proven failure可以命中显式 retry policy，但：

```text
retry = new retry occurrence
new occurrenceId
new runId
new idempotencyKey
retryOfOccurrenceId = previous occurrenceId
```

### 9.1 One-shot completion

- succeeded + `deleteAfterRun=true`：可删除 Job definition；occurrence evidence保留；
- succeeded + keep：Job disabled；
- ordinary failed：按显式 policy创建 retry occurrence，或 disabled；
- outcome_unknown：不删除为成功，不按普通 failure retry；Job fenced。

### 9.2 Recurring completion

- succeeded：按 §7安排下一 natural occurrence；
- ordinary failed：按 §7.5 产生新的 recovery/retry occurrence；
- outcome_unknown：fence same Job，后续 natural occurrence暂不 admission。

---

## 10. Persistence and Evidence Commitments

### 10.1 Job definition store — PRESERVE EXACT

D-005 的精确 commitment继续成立：

```text
jobs.json = { version, jobs }
write temp
-> file fsync
-> close
-> atomic rename over target
```

要求：

- 单机 durable store；
- corrupt/unsupported document fail loud，不静默当空 store；
- write失败不更新 caller RAM/cache；
- 不引入 Redis、Kafka、distributed transaction、leader election或 K8s CronJob。

D-007 不使用“atomic JSON or equivalent”来静默放宽 `jobs.json`。若未来要替换 Job definition store，必须有新的 accepted Decision。

### 10.2 Occurrence authority store — NEW, layout deferred explicitly

D-007 新增 durable occurrence authority。它必须持久保存 identity、payloadHash、state、timestamps、fence、late settlement 与 terminal evidence reference。

本 Decision**不冻结具体文件拆分**；implementation Spec必须在改代码前明确二选一并通过 review：

1. 扩展同一版本化 Scheduler state document，分开 `jobs` 与 `occurrences`；或
2. 新增独立 versioned occurrence document/store。

无论选哪种：

```text
same cross-process mutation authority
same re-read-latest discipline
fsync + atomic commit
fail loud
occurrence state and Job definition cannot be torn into an unsafe admission view
```

`runs.jsonl`不能作为唯一 occurrence authority。

### 10.3 Run / occurrence evidence log — PRESERVE EXACT AS EVIDENCE

D-005 的：

```text
runs.jsonl
append-only operational evidence
fsync before append resolves
default bound = 10 MB
truncate by preserving complete newest lines
```

继续保留。其角色明确为 evidence/operations surface，不是 execution authority。即使旧 evidence因容量策略轮转，authoritative occurrence terminal/unknown state也必须仍在 occurrence store中。

### 10.4 Store ownership

Job definition与 occurrence state都只能通过 Scheduler mutation authority写入。CLI、resident engine、recovery与 migration不得各自维护整库盲写路径。

---

## 11. Mutation and Latest-State Result Writeback

### 11.1 Mutation protocol

继续保留：

```text
same-process FIFO
-> cross-process exclusive lock
-> re-read latest durable state
-> apply one delta to fresh copy
-> fsync / atomic commit
-> update RAM/cache only after commit
-> release lock
```

锁 stale-break 只能恢复**mutation lock ownership**，不能证明 Agent occurrence已终止，也不能解除 execution fence。

### 11.2 Reserve-before-Router

在首次 Router call前，必须在 mutation protocol内原子写入：

```text
occurrenceId
runId
idempotencyKey
payloadHash
scheduleRevision
state = admitted
admittedAt
```

reserve后、Router call前 crash：recovery保守标记 `outcome_unknown` / fenced，不 re-admit。V1接受 visible missed execution，不接受重复未知副作用。

### 11.3 Start and terminal writeback

- invocation / model turn / delivery发生在 store lock之外；
- start evidence到达后，按 `(occurrenceId, runId)` 在锁内把 latest occurrence从 admitted推进到 running；
- terminal/unknown outcome也按 `(occurrenceId, runId)`写回 latest store；
- result不得只按旧 Job object或 `jobId`覆盖 whole-store snapshot；
- concurrent Job update/disable/delete不得被 late completion回滚；
- Job已删除时，occurrence terminal evidence仍必须持久，且不得复活 Job；
- Job被 disabled时，当前已 admitted occurrence的 outcome仍记录，但不得生成下一 occurrence；
- payloadHash / scheduleRevision不匹配 = conflict / fail loud。

### 11.4 Delivery result separation

Agent invocation outcome与 outbound delivery outcome是两个字段：

```text
executionOutcome = succeeded | failed | outcome_unknown
deliveryStatus   = delivered | not-delivered | not-requested | unknown
```

Delivery failure不得把已 proven succeeded 的 Agent execution改写为 ordinary failed；它只影响 delivery status与后续明确 delivery policy。

### 11.5 Evidence append

至少记录：

```text
occurrence reserved
Router admission attempted/accepted/unknown
turn start evidence
terminal/unknown outcome
delivery outcome
late settlement/reconcile
```

Evidence append failure不得虚假改变 authoritative state，但必须可观察；authoritative occurrence commit失败则本次状态转换失败。

---

## 12. Submission and Control Surface

### 12.1 Domain operations — PRESERVE

继续保留以下逻辑控制能力：

```text
createJob
submitOneShot
updateJob
enableJob
disableJob
deleteJob
listJobs
getJob
readRun/OccurrenceEvidence
```

精确 JavaScript module shape可以由 implementation Spec调整，但不得删除这些已接受的 operator/control semantics而不做新的 authority变更。

### 12.2 CLI surface — PRESERVE

继续保留当前实际 caller需要的：

```text
agentcore-cron add
agentcore-cron list
agentcore-cron runs
agentcore-cron rm
agentcore-cron enable
agentcore-cron disable
```

CLI = control-only：

- 不实例化 execution engine；
- 不执行 due jobs；
- 不运行 startup catch-up；
- write操作必须走同一 mutation protocol；
- `runs`未来必须能展示 occurrenceId/runId/outcome_unknown与 fence evidence，而不是只展示 job-level status。

### 12.3 Create / update rules

- create必须验证完整 Job definition schema；
- update必须保留 stable jobId，并在 schedule/payload/target/retry语义变化时增加 scheduleRevision；
- disable阻止未来 occurrence mint，但不删除已有 occurrence evidence；
- enable只恢复未来 schedule eligibility，不清除 unknown fence、不补跑 migration history；
- delete不删除 occurrence/run evidence；
- control operation不得自己执行 Job。

### 12.4 Submission flags not proven by this Decision

以下现有字段/flags可继续存在于控制面，但其生产执行能力不是本 Child Scope的验收内容：

```text
payload.model passthrough
channel:last delivery
model fallback
```

它们不能作为 production restore gate已通过的依据。

---

## 13. Runtime Restart Policy

D-007 区分 Agent Core native runtime restart与 OpenClaw migration。

### 13.1 Native Agent Core runtime restart

已有 occurrence record：

- terminal → 不重放；
- admitted/running且无 termination proof → `outcome_unknown` + Job fence；
- same occurrence never re-admit。

停机期间完全没有 occurrence record的 schedule slots：

```text
RUNTIME_CATCH_UP_MAX = one new catch-up occurrence per Job per downtime
```

仅允许为最近一个 eligible missed slot创建新的 occurrenceId；不得对应已存在 record，不得绕过 execution fence。

never-ran cron从未来 natural occurrence开始；at one-shot仅在未 stale、没有 occurrence record且明确符合 native catch-up policy时处理。

### 13.2 OpenClaw migration / cutover gap

```text
MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
```

94 个 missed occurrences不创建 occurrence record、不 admission、不分批补跑。

---

## 14. Scheduled Session Model（D-006）

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

当前稳定 per-job形式：

```text
agent:<agentId>:cron:<jobId>
```

被正式替换，不得继续作为 final product session。

具体 native Session ID是 implementation detail；可由 occurrenceId派生或 mint，并写入 occurrence evidence。该记录不是 Session Mapping DB。

Non-main trajectory不 merge回 main；跨 execution continuity来自 Workspace、MEMORY.md、files与显式结果，符合 D-006。

---

## 15. OpenClaw Migration Owner Rulings

输入 fleet：

```text
total = 280
enabled = 140
disabled = 140
Agent Core production jobs = 0

SAFE_READ_ONLY = 0
IDEMPOTENT_WRITE = 0
NON_IDEMPOTENT_SIDE_EFFECT = 113
RECORDING_OR_REMINDER = 4
DAEMON_OR_LONG_RUNNING = 3
OBSOLETE_OR_DUPLICATE = 13
BLOCKED = 7

pre-existing timeout/error = 63 / 140
missed occurrences = 94
```

### 15.1 Definition-only import

```text
LEGACY_EXECUTION_STATE_AUTHORITY = NONE
LEGACY_EXECUTION_STATE = STRIP
```

未来 import只允许导入经过 review的 Job definition。删除/忽略：

- lastRun / lastStatus / runningAt；
- consecutive error / retry execution state；
- past-due nextRunAt；
- legacy occurrence ownership；
- legacy stable Session identity。

Recurring Job从 activation后下一个 future natural occurrence开始。

### 15.2 Existing-store overwrite guard — PRESERVE EXACT

Import tool默认 dry-run。未来 write仍必须满足：

```text
target store exists OR contains jobs/occurrences
AND --force not explicitly supplied
→ REFUSE
```

守卫必须在 mutation lock内读取 latest target state，避免 TOCTOU。`--force`只表示 operator明确授权 whole-store replacement；使用前必须 stop/drain Control Plane，并仍受本 Decision 的 no-catch-up、state-strip、disabled与restore gate约束。`--force`不等于 auto-enable authority。

### 15.3 Legacy in-flight disposition

Source出现 `runningAt` / in-flight标记时：

- 必须在 report中列出；
- 不把该标记迁为 Agent Core running/admitted truth；
- execution state仍 strip；
- 相关 Job不得自动 enable/restore；
- 没有 termination evidence时，不猜测成功或失败。

这替换旧的“仅报告后可带状态迁移”理解。

### 15.4 Missed runs

```text
MISSED_OCCURRENCES = 94
MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
```

不转换成 immediate jobs，不分批回放，不因为旧 error状态补偿执行。

### 15.5 Missing Agent ID

```text
MISSING_AGENT_ID_JOBS = BLOCKED
```

3 个无 Agent ID jobs不猜测 target、不模糊匹配、不使用 default Agent。

### 15.6 Stale one-shots

```text
STALE_ONE_SHOTS = DO_NOT_IMPORT
```

过去的 at target不转换为 now。

### 15.7 Disabled jobs

```text
DISABLED_JOBS = KEEP_DISABLED
```

Definition normalization不得因缺失值把 disabled变 enabled。

### 15.8 Daemon / long-running

```text
DAEMON_JOBS = OUT_OF_SCHEDULER
```

由独立 supervision / daemon deployment owner处理。

### 15.9 Obsolete / duplicate / blocked

本 Decision不自动恢复这些 jobs。逐项 disposition必须来自 migration audit / Owner ruling；默认无 import/enable authority。

---

## 16. Restore Gate

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

## 17. Complete D-005 Disposition Matrix

| D-005 normative area | D-007 disposition | Complete Current Truth after D-007 acceptance |
|---|---|---|
| Job model = live-field true subset | PRESERVE + RESTATE | §3 完整列出 Job definition schema；execution state移到 occurrence |
| legacy timeout normalization | PRESERVE + CLARIFY | timeoutSec/timeoutMs/runTimeoutMs -> payload.timeoutSeconds；非法值 fail/report |
| dormant / unsupported fields | PRESERVE + CLARIFY | dormant fields drop with report；non-agentTurn payload blocked |
| cron / at / every | PRESERVE | §3.4、§7完整定义 |
| cron timezone / stagger | PRESERVE | 5-field、resolved timezone、stable stagger；top-of-hour默认 300s |
| agentId required | PRESERVE | missing/unknown/disabled fail closed；migration missing IDs blocked |
| due predicate | PRESERVE + REKEY | enabled + due + no fence + no existing nominal occurrence；不再靠 runningAtMs |
| cron next strictly after end | PRESERVE | §7.2，含 2s refire gap |
| every lastRun/anchor rule | PRESERVE | §7.4 |
| recurring error next = max(naturalNext, endedAt+backoff) | PRESERVE WITH NEW IDENTITY | §7.5；只适用于 explicit ordinary-failure policy |
| one-shot 30s/60s/5m max 3 | PRESERVE AS OPTIONAL DEFAULT | ordinary proven failure、新 occurrence；非幂等默认 no auto retry |
| recurring 30s/60s/5m/15m/60m | PRESERVE AS OPTIONAL DEFAULT | 同上 |
| at success delete/disable | PRESERVE | occurrence evidence保留 |
| exact jobs.json `{version,jobs}` | PRESERVE EXACT | §10.1；不以“or equivalent”放宽 |
| temp write + fsync + rename | PRESERVE EXACT | §10.1 |
| fail-loud store | PRESERVE | corrupt/unsupported不当空 store |
| runs.jsonl append-only bounded 10MB | PRESERVE EXACT AS EVIDENCE | §10.3；非 occurrence authority |
| occurrence ledger | NEW | §10.2；layout由 implementation Spec明确，语义/原子性已冻结 |
| cross-process lock + latest reread | PRESERVE | §11.1 |
| RAM commit only after persist | PRESERVE | §11.1 |
| tick single-flight | PRESERVE | instance pass不重叠；durable reserve处理跨重启/进程 |
| latest-state result writeback by jobId | PRESERVE + REKEY | §11.3 改为 occurrenceId/runId；不覆盖并发 Job update |
| invocation/delivery outside lock | PRESERVE | §11.3/§11.4 |
| execution vs delivery result | PRESERVE + CLARIFY | §11.4 分离 outcome与 deliveryStatus |
| CLI control-only | PRESERVE | §12.2 |
| CLI add/list/runs/rm/enable/disable | PRESERVE | §12.2 |
| domain create/submit/list/update/toggle/delete/get | PRESERVE | §12.1 |
| import existing-store default refusal | PRESERVE EXACT | §15.2；lock内 latest check；explicit --force only |
| source in-flight report | PRESERVE + REPLACE STATE USE | §15.3：report + strip；不得迁为 running truth或 auto-enable |
| whole-store import overwrite | PRESERVE ONLY WITH EXPLICIT FORCE | stop/drain + all new migration gates仍适用 |
| job-level runningAt as no-dup | REPLACE | occurrence reservation + idempotency key |
| stale running marker clear + rerun | REPLACE | unknown + fence；不 re-admit same occurrence |
| timeout as ordinary error | REPLACE | timeout without termination = outcome_unknown |
| stable per-job Session / sessionKey | REPLACE | fresh non-main Session per occurrence；legacy fields strip/report |
| sessionTarget main/isolated as product selector | REPLACE | scheduled execution固定 fresh non-main；main不允许 |
| native restart catch-up max one/job/downtime | PRESERVE + REKEY | 新 catch-up occurrence；不得绕过 fence |
| OpenClaw migration catch-up | REPLACE | NO_CATCH_UP；94不补跑 |
| same occurrence retry | REPLACE | retry = new occurrence |
| AbortSignal observed = cancellation | REJECT | cancel request != terminated |
| Scheduler product/channel ignorance | PRESERVE | opaque invoker/delivery；不引入 Forum/Workflow/Feishu策略 |
| payload.model runtime correctness | DEFER_TO_PREREQUISITE | 字段可存，passthrough/fallback另行验收 |
| channel:last delivery correctness | DEFER_TO_PREREQUISITE | 不作为本 hardening/restore proof |

以上矩阵与正文共同构成 standalone Current Truth。接受后不需要读取 D-005来决定任何 retained/replaced clause；D-005只保留历史 rationale。

---

## 18. Explicitly Out of Scope / Migration Prerequisites

```text
Forum/Workflow credential provisioning
channel:last delivery implementation
payload.model passthrough implementation
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

## 19. Consequences

### Positive

- timeout不再伪装成普通失败；
- 同一 occurrence不会二次进入 Router；
- retry / natural next run有独立 identity；
- crash后宁可 unknown，不冒险重复副作用；
- scheduled sessions符合 D-006；
- D-005全部 retained/replaced semantics可从一份 Current Decision读取；
- OpenClaw migration不会突然补跑 94 次历史任务；
- exact jobs.json、runs.jsonl、import guard与控制面承诺没有被静默丢失。

### Cost

- outcome_unknown可能 fence一个 Job直到 evidence/operator reconcile；
- reserve-before-admission crash可能保守漏掉一次执行；
- 需要 durable occurrence ledger与 schema change；
- implementation Spec必须冻结 occurrence store layout；
- 非幂等 fleet restore继续等待 hardening。

有意的 safety tradeoff：

```text
prefer one visible unknown / missed execution
over duplicated unknown external side effects
```

---

## 20. Acceptance Conditions

D-007 可 accepted 的条件：

1. `SCHEDULER_TIMEOUT_OUTCOME_V1` independent review PASS；
2. Job definition true subset已完整重述；
3. legacy field normalize/drop/block规则已完整处置；
4. due、cron/at/every next、refire gap与 ordinary backoff公式明确；
5. exact jobs.json / atomic persist / runs.jsonl 10MB commitments明确；
6. occurrence authority store的语义与 implementation-Spec前置选择明确；
7. latest-state writeback按 occurrenceId/runId，不会覆盖并发 Job mutation；
8. submission/domain/CLI control surface完整；
9. existing-store import guard与 in-flight strip/report disposition完整；
10. timeout / failed / unknown类型清楚；
11. occurrence identity与 at-most-once admission清楚；
12. unknown execution fence清楚；
13. retry = new occurrence；
14. AbortSignal / termination分离；
15. D-006 fresh Session per execution一致；
16. migration no-catch-up与 restore gate完整；
17. §17 matrix覆盖 D-005全部 normative areas，无“其余自己拼旧文档”；
18. acceptance transaction同时标记 D-005 superseded并更新 backlinks/index；
19. 无 implementation、production jobs、store mutation或 Kernel change。

---

## 21. Final Decision Output（accepted）

```text
DECISION_ID = D-007
DECISION_STATUS = accepted
D007_IS_COMPLETE_STANDALONE_CURRENT_DECISION = YES
PARTIAL_MANUAL_MERGE_WITH_D005_REQUIRED = NO
SUPERSEDES = D-005（activated at acceptance 2026-08-20）
CURRENT_AUTHORITY_BEFORE_ACCEPTANCE = D-005
CURRENT_AUTHORITY_AFTER_ACCEPTANCE = D-007

JOB_MODEL = EXPLICIT_TRUE_SUBSET_IN_SECTION_3
LEGACY_FIELD_DISPOSITION = EXPLICIT_NORMALIZE_DROP_OR_BLOCK
DUE_AND_NEXT_CALCULATION = EXPLICIT_IN_SECTION_7

TIMEOUT_OUTCOME = outcome_unknown
UNKNOWN_EXECUTION_FENCE = SAME_JOB_NO_FURTHER_ADMISSION_UNTIL_RESOLVED
SAME_OCCURRENCE_ADMISSION = AT_MOST_ONCE
RETRY_IDENTITY = NEW_OCCURRENCE
DURABLE_EXECUTION_STATES = admitted,running,succeeded,failed,outcome_unknown

JOB_DEFINITION_STORE = EXACT_VERSIONED_JOBS_JSON
JOB_STORE_COMMIT = TEMP_WRITE_FSYNC_ATOMIC_RENAME
RUN_EVIDENCE = APPEND_ONLY_BOUNDED_RUNS_JSONL_DEFAULT_10MB
OCCURRENCE_AUTHORITY_STORE = DURABLE_VERSIONED_ATOMIC_LAYOUT_TO_BE_FROZEN_BY_IMPLEMENTATION_SPEC
LATEST_STATE_WRITEBACK_KEY = occurrenceId,runId

DOMAIN_CONTROL_SURFACE = create,submitOneShot,update,enable,disable,delete,list,get,readEvidence
CLI_CONTROL_SURFACE = add,list,runs,rm,enable,disable
CLI_EXECUTION = FORBIDDEN

EXISTING_STORE_IMPORT_DEFAULT = REFUSE
IMPORT_FORCE = EXPLICIT_OPERATOR_ONLY_AFTER_STOP_DRAIN
LEGACY_IN_FLIGHT = REPORT_AND_STRIP_NOT_RUNNING_AUTHORITY

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

ACCEPTED_REVIEWED_HEAD = 3776b1929a05d0e8c81a6cacde576b39a5151017
FOCUSED_RE_REVIEW = AGENT_CORE_HARDENING_PROGRAM_V1_PR11_AMENDMENT_FOCUSED_RE_REVIEW = PASS
REQUIRED_FIXES = NONE
VERDICT = READY_TO_ACCEPT_AND_MERGE_PR11_SPEC_SET
```