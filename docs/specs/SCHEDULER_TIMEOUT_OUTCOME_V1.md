---
spec_id: SCHEDULER_TIMEOUT_OUTCOME_V1
status: proposed
date: 2026-08-19
type: implementation-spec (spec / decision text only; no implementation this round)
scope:
  - Scheduler occurrence identity and admission idempotency
  - timeout / cancellation / termination outcome semantics
  - scheduled Session alignment with D-006
  - OpenClaw scheduled-work migration owner rulings and restore gate
references:
  - OPENCLAW_TO_AGENT_CORE_SCHEDULED_WORK_MIGRATION_AUDIT_V1 (PASS)
  - docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md
  - docs/decisions/SCHEDULER_V1.md (D-005, accepted Current Authority until replacement acceptance)
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md (D-006, accepted Current Authority)
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md (D-007, proposed replacement Decision)
implementation_authority: none
---

# SCHEDULER_TIMEOUT_OUTCOME_V1 — occurrence、timeout、termination 与迁移语义

> 状态：**proposed，等待独立 Spec Review**。  
> 所在 PR：Draft PR #11。  
> 本轮只提交 Spec / Decision 文本。  
> 不 implementation、不创建 production jobs、不补跑 missed runs、不修改 Scheduler store、不部署、不 merge。

---

## 0. Authoring Result

Owner 已提供所有必要 ruling，本轮不存在未决产品选择：

```text
SCHEDULER_TIMEOUT_OUTCOME_V1_SPEC = PASS
NEEDS_OWNER_DECISION = NO
SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
IMPLEMENTATION_ALLOWED = NO
```

这里的 `PASS` 表示本轮 authoring 输入已经能够形成完整 proposed Spec；它不等于独立 review PASS，也不等于 accepted 或 implementation authority。

---

## 1. Goal

Scheduler 必须把“计划时间到达”“一次真实 admission”“Agent turn 是否开始”“调用方是否停止等待”“真实执行是否终止”拆成不同事实，避免：

```text
timeout
→ 被写成 ordinary failed
→ 同一个 scheduled occurrence 自动 retry
→ 原 Agent turn 实际仍在运行
→ 两次产生相同外部副作用
```

目标语义：

```text
one scheduled occurrence
→ one durable occurrence identity
→ at most one Router admission
→ one fresh non-main Session
→ one honest terminal outcome or outcome_unknown
```

本 Spec 优先保证“不重复产生未知副作用”，接受在 crash boundary 上保守地留下 `outcome_unknown`，不虚假声称 exactly-once completion。

---

## 2. Development Preflight / Authority

```text
Primary Program        = AGENT_CORE_HARDENING_PROGRAM_V1（draft, same PR）
Current Scheduler Decision = D-005（accepted；在 D-007 accepted 前仍是 Current Authority）
Session Product Decision   = D-006（accepted；cron = fresh Session per execution）
New Child Spec         = SCHEDULER_TIMEOUT_OUTCOME_V1（本文件，proposed）
Replacement Decision   = D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2（proposed）
Implementation authority = NONE
Kernel change          = NONE
```

### 2.1 D-005 disposition

D-005 是 accepted stable Decision，不允许在同一 stable ID 下直接改写既有 normative meaning。

冻结：

```text
D005_DISPOSITION = SUPERSEDE
REPLACE_AFFECTED_TIMEOUT_AND_RETRY_SEMANTICS = YES
COMPLETE_REPLACEMENT_DECISION = D-007
```

D-007 必须是 standalone Current Decision，完整重述 preserved 与 replaced semantics；未来 Agent 不得自行拼 D-005 + amendment。

在 D-007 accepted 前：

```text
D005_CURRENT_AUTHORITY = YES
D007_CURRENT_AUTHORITY = NO
```

D-007 接受时必须与 D-005 lifecycle flip、双向 backlink 和 Decision index 更新原子完成。

### 2.2 D-006 disposition

D-006 的 scheduled Session 产品模型直接约束本 Spec：

```text
each scheduled execution
→ fresh non-main Session
→ same Agent primary Workspace

CRON_SESSION_SCOPE = PER_EXECUTION
CRON_SESSION_REUSE = NO
```

当前稳定 per-job Session：

```text
agent:<agentId>:cron:<jobId>
```

是 legacy implementation strategy，不得继续作为最终产品语义。

---

## 3. Evidence

### 3.1 Migration fleet evidence

输入：

```text
OPENCLAW_TO_AGENT_CORE_SCHEDULED_WORK_MIGRATION_AUDIT_V1 = PASS

OpenClaw jobs:
  total    = 280
  enabled  = 140
  disabled = 140

Agent Core production jobs = 0
```

140 个 enabled jobs 分类：

| Classification | Count |
|---|---:|
| `SAFE_READ_ONLY` | 0 |
| `IDEMPOTENT_WRITE` | 0 |
| `NON_IDEMPOTENT_SIDE_EFFECT` | 113 |
| `RECORDING_OR_REMINDER` | 4 |
| `DAEMON_OR_LONG_RUNNING` | 3 |
| `OBSOLETE_OR_DUPLICATE` | 13 |
| `BLOCKED` | 7 |

```text
pre-existing timeout/error = 63 / 140
missed runs since cutover   = 94
```

结论：当前 fleet 没有任何已证明 SAFE_READ_ONLY 或 IDEMPOTENT_WRITE 的 enabled candidate；绝大部分会产生非幂等外部副作用。timeout / retry 错误会直接放大为真实重复操作风险。

### 3.2 Current implementation evidence

当前 Scheduler：

- 用 `Promise.race()` 在 timeout 时停止等待并 `AbortController.abort()`；
- Router / AgentProcess 当前没有 end-to-end cancel + proven termination；
- timeout rejection 被折叠为普通 `status: error`；
- ordinary error 进入现有 retry/backoff；
- `runningAtMs` 仅是 job-level marker，超过 stuck threshold 后可清除；
- default isolated Session = `agent:<agentId>:cron:<jobId>`，跨 execution 重用。

因此当前可能同时成立：

```text
Scheduler state = error / retry scheduled
Agent turn      = still running
external effect = may already have happened
```

---

## 4. Primitive Definitions

### Job

长期 schedule definition：谁执行、何时产生 occurrence、payload 与 delivery directive。Job 不是某一次执行。

### Scheduled occurrence

由 Job schedule 产生的一次逻辑执行机会，例如：

- cron 的某个 nominal fire time；
- at 的目标 instant；
- every 的某个 anchor-derived instant；
- ordinary failed 后、显式 retry policy 产生的一次 retry occurrence。

### Occurrence ID

```text
occurrenceId = one stable durable identity for one logical occurrence
```

必须跨 tick、进程重启和 store reload 保持稳定。具体字符串编码不是产品 contract；实现可以按 `(jobId, scheduleRevision, nominalAt)` 确定性派生，也可以在锁内 mint 后持久化，但不得仅靠 RAM 或 wall-clock “重新算一个差不多的 run”。

### Run ID

```text
runId = the single execution-attempt identity owned by one occurrence
```

V1 同一 occurrence 最多拥有一个 admitted run。普通失败需要 retry 时，必须创建新的 retry occurrence（新的 `occurrenceId` 与 `runId`），并用 `retryOfOccurrenceId` 关联；不得让原 occurrence 第二次进入 Router。

### Request ID / Idempotency key

```text
requestId / idempotencyKey = stable admission key derived from or durably bound to occurrenceId
```

同一 occurrence 的所有重复调用、进程恢复和 transport retry 必须使用同一 key。相同 key 但 payload hash 不同 = conflict / fail loud。

### Admission

```text
admission = Scheduler 将一个 occurrence 交给 Router / Agent execution boundary 的一次动作
```

它不同于 Agent turn 已经开始，也不同于 turn 已经结束。

---

## 5. Contracts

以下 Contract ID 一经 accepted 不得重编号或复用。

### C-001 — Timeout outcome

```text
timeout without proven termination
→ outcome_unknown
```

不得记录为 ordinary `failed`、ordinary `error` 或任何会自动继承普通 retry/backoff 的状态。

### C-002 — Unknown retry prohibition

```text
same occurrence + outcome_unknown
→ MUST NOT automatically retry
→ MUST NOT be re-admitted
```

只有在可信 evidence 证明原执行已终止后，才允许人工/显式策略决定是否创建**新的 occurrence**；即使重新执行，也不得复活原 occurrence 的 admission identity。

### C-003 — Ordinary failed is separate

`failed` 只能表示：

- 明确的 pre-start rejection，已证明 Agent turn 未启动；或
- 执行返回明确 terminal failure，并有 evidence 证明该 turn 不再继续运行。

普通可确认失败可按显式 retry policy 处理，但 retry 必须创建新的 retry occurrence。对于非幂等副作用 job，若没有 downstream idempotency proof，默认不得因为“返回 failed”就盲目重放业务动作。

### C-004 — Stable occurrence identity

每个 scheduled occurrence 必须有持久、不可复用的：

```text
occurrenceId
runId
requestId / idempotencyKey
payloadHash
jobId
nominalScheduledAt / retryOfOccurrenceId
```

Schedule 更新不得改变已存在 occurrence 的 identity。

### C-005 — Durable execution states

最小 durable states：

```text
admitted
running
succeeded
failed
outcome_unknown
```

定义：

- `admitted`：occurrence 与 admission key 已持久 reserve；Router admission 可能尚未发出、正在发出或 receipt 丢失。它不是 running proof。
- `running`：有可信 evidence 证明对应 Agent turn 已开始。
- `succeeded`：可信 terminal success。
- `failed`：可信 terminal failure / pre-start terminal rejection，并证明不再执行。
- `outcome_unknown`：无法安全证明 succeeded、failed 或 terminated。

### C-006 — Reserve before Router

occurrence record 与 `admitted` reservation 必须在首次 Router call **之前**持久化。

如果进程在 reserve 后、Router call 前崩溃，重启后不得重新 admission；该 record 必须保守进入 `outcome_unknown`（或保持 admitted 并立即由 recovery 收敛为 unknown）。V1 接受潜在漏执行，不接受同 occurrence 重复副作用。

### C-007 — Same occurrence admission at most once

```text
SAME_OCCURRENCE_ADMISSION = AT_MOST_ONCE
SAME_OCCURRENCE_MUST_NOT_ENTER_ROUTER_TWICE = YES
```

并发 tick、startup recovery、外部 CLI mutation、Scheduler restart 和迟到 callback 都不得导致第二次 Router admission。

`runningAtMs` 单字段不再足以证明 occurrence identity 或 admission ownership。

### C-008 — Retry creates a new occurrence

普通 `failed` 若命中显式 retry policy：

```text
old occurrence = failed (immutable identity)
new retry occurrence = new occurrenceId + new runId + new idempotencyKey
new.retryOfOccurrenceId = old.occurrenceId
```

D-005 的 one-shot 30s/60s/5m 与 recurring 30s/60s/5m/15m/60m backoff 可以作为 retained default policy，但它们调度的是**新的 occurrence**，不允许原 occurrence 二次 admission。

### C-009 — Cancel requested is not terminated

```text
AbortSignal sent
cancel request emitted
promise race settled locally
```

都不等于：

```text
Agent turn proven terminated
```

当前 Router / AgentProcess 没有真实 active-turn cancellation contract。因此当前实现路径发生 timeout 时必须输出 `outcome_unknown`。

未来若加入 cancellation，`failed` / cancelled terminal 结果必须有正向 termination evidence，例如：

- 对应 turn 的可信 terminal acknowledgment；或
- 能证明该 exact turn 不可能继续的 process lifecycle evidence。

仅 kill 一个共享 AgentProcess 不自动构成安全方案；必须证明不会误杀另一个 surface / occurrence 正在执行的 turn。

### C-010 — Late settlement

同一 `occurrenceId/runId` 的迟到 success / failure / external-effect evidence 必须追加保存，不能静默丢弃，也不能触发二次 admission。

允许：

```text
outcome_unknown
→ 通过可信 late settlement / reconcile 解析为 succeeded 或 failed
```

但 timeout event、unknown history 与 late evidence 必须继续可审计；状态解析不是 retry。

如果实现暂时不能接收可信 late settlement，最小安全行为是保持 `outcome_unknown` 并阻止重投。

### C-011 — Timeout clock / queue distinction

Scheduler 必须区分：

- occurrence 等待 Scheduler concurrency slot；
- 已 durable admitted，但尚未开始 Agent turn；
- Agent turn running。

执行 timeout 至少从 durable `admittedAt` / Router admission 开始后计算，不得把尚未 admission 的普通 Scheduler 排队等待误记成执行 timeout。

如果 timeout 发生在 admitted 但未证明 turn 启动的阶段，而系统也无法证明 queued request 已被移除，则仍为 `outcome_unknown`。

### C-012 — Scheduled Session model

符合 D-006：

```text
each scheduled occurrence admission
→ fresh non-main native Session
→ same Agent
→ same Agent primary Workspace
```

禁止最终语义：

```text
scheduled execution -> main
scheduled execution -> stable per-job session agent:<id>:cron:<jobId>
CRON_SESSION_REUSE = YES
```

具体 native Session ID 编码是实现细节；它可以由 occurrence identity 派生或 mint，并记录在 occurrence evidence 中。不得新增独立 Session Mapping DB。

### C-013 — Migration no catch-up

```text
MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
```

导入 OpenClaw job definition 时：

- strip legacy `lastRun` / `lastStatus` / `runningAt` / error counters / execution state；
- 不导入能触发过去 occurrence 的 legacy `nextRunAt`；
- recurring job 从 restore/activation 之后的下一个自然 future occurrence 开始；
- 不自动补跑已统计的 94 次 missed occurrence。

本条只裁定 OpenClaw → Agent Core migration；Agent Core 原生 job 在未来 hardening 后的正常 runtime restart policy 由 D-007 完整重述，并始终受 occurrence at-most-once 约束。

### C-014 — Missing Agent ID

```text
MISSING_AGENT_ID_JOBS = BLOCKED
```

3 个无 Agent ID job 不猜测、不按名称映射、不绑定 default Agent。只有新的明确 Owner / migration ruling 指定合法 Agent 后，才可进入新的 review。

### C-015 — Stale one-shots

```text
STALE_ONE_SHOTS = DO_NOT_IMPORT
```

目标时间已在 migration / restore 前过去的 at one-shot 不导入、不补跑、不转换成“立即执行”。

### C-016 — Disabled jobs

```text
DISABLED_JOBS = KEEP_DISABLED
```

导入或保存 disabled definition 不构成 enable authority。不得因字段缺失、状态 strip 或默认值而自动 enabled。

### C-017 — Daemon jobs

```text
DAEMON_JOBS = OUT_OF_SCHEDULER
```

`DAEMON_OR_LONG_RUNNING = 3` 不迁入 occurrence Scheduler。其 supervision / deployment 由 OpenClaw daemon replacement 或独立 runtime owner 处理。

### C-018 — Restore gate

在本 Spec accepted、D-007 accepted、对应 implementation review PASS 之前：

```text
NON_IDEMPOTENT_SIDE_EFFECT jobs = MUST_NOT_AUTO_ENABLE
RECORDING_OR_REMINDER jobs       = MUST_NOT_AUTO_ENABLE
READY_TO_RESTORE_BEFORE_HARDENING = 0
```

本 Spec 不授权生产 import 或 enable。即使文档 review PASS，也必须等待 implementation compliance 与 migration prerequisite review。

### C-019 — D-005 supersession

```text
D005_DISPOSITION = SUPERSEDE
REPLACED_BY = D-007 / SCHEDULER_OCCURRENCE_OUTCOME_V2
```

D-007 accepted 后，D-005 不再作为并行 Current Authority。D-007 必须完整列出 D-005 retained / replaced clauses。

---

## 6. Occurrence State Machine

最小状态转换：

```text
(no occurrence record)
  → admitted                         # durable reserve before Router

admitted
  → running                          # positive start evidence
  → failed                           # proven pre-start terminal rejection
  → outcome_unknown                  # crash / lost receipt / timeout / no proof

running
  → succeeded                        # proven terminal success
  → failed                           # proven terminal failure + termination
  → outcome_unknown                  # timeout / process ambiguity / lost terminal evidence

outcome_unknown
  → succeeded | failed               # trusted late settlement / reconcile only
  → NO automatic admission transition
```

不允许：

```text
outcome_unknown -> admitted
runningAt stale -> clear -> re-admit same occurrence
same occurrence -> second runId
```

### 6.1 Natural next occurrence vs retry occurrence

Recurring job 的下一自然 schedule slot拥有新的 occurrence identity，不是旧 occurrence retry。

Ordinary failed 后的 retry policy也创建新的 retry occurrence。二者都不得复用旧 occurrence 的 request/idempotency key。

### 6.2 Runtime restart after hardening

对于 Agent Core 原生 job：

- 已存在 `admitted/running` record 且没有 termination evidence → recovery 为 `outcome_unknown`，不 re-admit；
- 已有 terminal record → 不重放；
- 运行时停机期间完全没有创建 record 的 missed schedule slots，可按 D-007 保留的“每 job 每次 downtime 至多创建一个新 catch-up occurrence”策略处理；该 catch-up 必须有新的 occurrenceId，且不能对应一个已存在 record 的 slot。

该 native runtime rule 不得被用于 OpenClaw migration 的 94 次 missed occurrence；migration 固定 `NO_CATCH_UP`。

---

## 7. D-005 Preserved / Replaced Summary

本 Spec 提议 D-007 完整取代 D-005，并要求 D-007 至少重述以下 disposition：

### Preserved

- schedule kinds `cron / at / every`；
- `agentId` 必填；
- 单机、最小持久化，不引入 Redis / Kafka / distributed transaction；
- locked read-modify-write / atomic persistence；
- tick single-flight；
- CLI control-only；
- Scheduler 不理解 Agent / Forum / Workflow / Feishu 产品语义；
- opaque invoker / delivery seams；
- disabled job 不运行；
- ordinary proven failure 可以有显式 retry/backoff policy。

### Replaced

- timeout → ordinary error；
- `runningAtMs` 超过 2h 后清除并允许相同 occurrence 重跑；
- job-level state 代替 occurrence identity；
- stable per-job cron Session；
- OpenClaw migration根据 legacy state 自动 catch-up；
- retry 复用同一 occurrence identity；
- 仅观察 `AbortSignal` 就宣称 cancellation PASS。

---

## 8. Migration Owner Rulings

### 8.1 Definition import

只允许导入经过 migration review 的 Job definition，不导入 legacy execution truth。

```text
LEGACY_EXECUTION_STATE_AUTHORITY = NONE
```

未来 import implementation 必须输出逐 job disposition，不得静默猜测：

- target Agent；
- daemon vs scheduled；
- stale one-shot；
- disabled state；
- restore eligibility。

### 8.2 Fleet restore

当前 140 enabled jobs：

```text
SAFE_READ_ONLY + IDEMPOTENT_WRITE = 0
```

因此没有可在 hardening 前自动恢复的 job。

`OBSOLETE_OR_DUPLICATE` 与 `BLOCKED` 也不因本 Spec 自动获得 import/enable authority；其逐项 disposition 继续由 migration audit / Owner ruling 决定。

---

## 9. Out of Scope / Migration Prerequisites Only

以下只记录为后续 prerequisite，不扩大本 Scheduler child scope：

```text
Forum/Workflow credential provisioning
channel:last delivery
payload.model passthrough
model fallback
OpenClaw daemon deployment
fleet job import implementation
```

同时不做：

- 通用 Workflow Engine；
- 分布式事务 / exactly-once 平台；
- 新 Session Mapping DB；
- Router 产品特例；
- DSH Kernel change；
- production job 创建、启用、补跑或 store mutation。

---

## 10. Alternatives Considered

### A. timeout 继续作为 failed

拒绝。调用方停止等待不证明 Agent turn 或外部副作用停止。

### B. timeout 后立即 retry，同一 occurrence 复用原 request

拒绝。可能与仍在运行的原 turn 重叠或顺序重复产生副作用。

### C. 超过固定时间直接清除 running marker

拒绝作为 termination proof。时间流逝不能证明 external effect 未发生或 turn 已停止。

### D. 为 cron job 建永久 Session

拒绝。违反 D-006 `CRON_SESSION_SCOPE = PER_EXECUTION`，会把不同执行轨迹混在一起。

### E. 为 Session 建新 Mapping DB

拒绝。occurrence record 可以保存本次 native Session evidence；产品模型不需要第二套 Session identity authority。

### F. 把 94 次 missed occurrence 全部补跑

拒绝。113 个 enabled jobs 有非幂等副作用，历史执行状态与 timeout 结果不可靠；批量补跑风险不可接受。

### G. 在 D-005 上叠 amendment

拒绝。D-005 是 accepted stable Decision，新的 occurrence/outcome/session/migration 模型会改变其 normative execution meaning；必须由完整 standalone D-007 取代。

---

## 11. Future Implementation Acceptance

本轮不实现。未来 implementation 至少必须证明：

1. timeout active turn → `outcome_unknown`，不是 ordinary failed；
2. `AbortSignal` 被观察但没有 termination ack → 仍是 unknown；
3. 同一 occurrence 的并发 tick / restart / recovery 实际 Router call count = 1；
4. crash after reserve-before-Router → unknown，不 re-admit；
5. crash after Router-before-receipt → unknown，不 re-admit；
6. ordinary failed retry 创建新 occurrence，并保留 `retryOfOccurrenceId`；
7. unknown 不自动产生 retry occurrence；
8. late success/failure evidence 按同一 occurrence/run 记录，不触发 second admission；
9. 每次 scheduled execution 创建 fresh non-main Session，两个 occurrence 的 native Session 不同；
10. 两个 Session 都使用同一 Agent primary Workspace；
11. stable per-job `agent:<id>:cron:<jobId>` 不再是 final path；
12. migration strip legacy execution state；
13. 94 个 missed occurrence 零补跑；
14. missing-agent jobs blocked；
15. stale one-shots 不导入；
16. disabled jobs保持 disabled；
17. daemon jobs不进入 Scheduler；
18. hardening 前 production restore count = 0；
19. 所有 evidence 标明 exact commit / environment / command / result；
20. Kernel change = none。

建议 fault matrix：

```text
TIMEOUT_BEFORE_TURN_START
TIMEOUT_DURING_ACTIVE_TURN
ABORT_SENT_WITHOUT_TERMINATION
PROCESS_EXIT_WITHOUT_TURN_ATTRIBUTION
LATE_SUCCESS_AFTER_TIMEOUT
LATE_FAILURE_AFTER_TIMEOUT
LATE_EXTERNAL_SIDE_EFFECT_AFTER_TIMEOUT
CONCURRENT_DUE_TICKS_SAME_OCCURRENCE
RESTART_AFTER_ADMITTED_BEFORE_ROUTER
RESTART_AFTER_ROUTER_BEFORE_RECEIPT
ORDINARY_FAILED_RETRY_NEW_OCCURRENCE
OUTCOME_UNKNOWN_NO_RETRY
FRESH_SESSION_PER_OCCURRENCE
MIGRATION_NO_CATCH_UP
```

---

## 12. Spec Acceptance Criteria

独立 reviewer 必须确认：

- `outcome_unknown` 与 `failed`类型分离；
- same occurrence at-most-once Router admission；
- occurrence/run/request identity足以跨重启稳定；
- retry 使用新 occurrence；
- AbortSignal 与 termination evidence 分离；
- D-006 fresh scheduled Session 已覆盖；
- D-005 disposition 是完整 supersession；
- D-007 不要求未来 Agent 自己 merge D-005；
- migration no-catch-up / missing-agent / stale-one-shot / disabled / daemon rulings完整；
- restore gate = 0；
- Non-Goals 未被偷渡进入 implementation scope；
- 本轮无代码、job、store、production state 或 Kernel change。

独立 review 建议输出：

```text
SCHEDULER_TIMEOUT_OUTCOME_V1_SPEC_REVIEW = PASS | FIX_REQUIRED
REQUIRED_FIXES = [...]
VERDICT = READY_TO_ACCEPT | NOT_READY
```

Review recommendation 不自动等于 acceptance；最终 status flip 由 authorized repository owner / maintainer 完成。

---

## 13. Final Output

```text
SCHEDULER_TIMEOUT_OUTCOME_V1_SPEC = PASS

TIMEOUT_OUTCOME = outcome_unknown
RETRY_AFTER_OUTCOME_UNKNOWN = FORBIDDEN_FOR_SAME_OCCURRENCE
OCCURRENCE_IDENTITY = STABLE_DURABLE_PER_LOGICAL_OCCURRENCE
DURABLE_EXECUTION_STATES = admitted,running,succeeded,failed,outcome_unknown
SAME_OCCURRENCE_ADMISSION = MUST_NOT_ENTER_ROUTER_TWICE
CANCEL_REQUESTED_VS_TERMINATED = DISTINCT
SCHEDULED_SESSION_MODEL = FRESH_NON_MAIN_PER_EXECUTION_SAME_AGENT_PRIMARY_WORKSPACE

D005_DISPOSITION = SUPERSEDE / REPLACE_AFFECTED_TIMEOUT_AND_RETRY_SEMANTICS
D005_REPLACEMENT_DECISION = D-007 / SCHEDULER_OCCURRENCE_OUTCOME_V2

MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
MISSING_AGENT_ID_JOBS = BLOCKED
STALE_ONE_SHOTS = DO_NOT_IMPORT
DISABLED_JOBS = KEEP_DISABLED
DAEMON_JOBS = OUT_OF_SCHEDULER
READY_TO_RESTORE_BEFORE_HARDENING = 0

KERNEL_CHANGE = NONE
SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES

PRODUCT_CODE_CHANGE_THIS_ROUND = NONE
PRODUCTION_JOB_CHANGE_THIS_ROUND = NONE
SCHEDULER_STORE_CHANGE_THIS_ROUND = NONE
MISSED_RUN_REPLAY_THIS_ROUND = NONE
MERGE = NO
```
