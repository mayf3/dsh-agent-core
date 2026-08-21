---
spec_id: SCHEDULER_TIMEOUT_OUTCOME_V2
status: proposed
date: 2026-08-22
type: implementation-spec (whole-authority replacement of SCHEDULER_TIMEOUT_OUTCOME_V1; spec only — no implementation this round)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
replaces_on_acceptance: SCHEDULER_TIMEOUT_OUTCOME_V1
scope:
  - Scheduler occurrence authority store（layout / schema / identity / state machine / fence）
  - timeout / cancellation / termination outcome semantics（V1 C-001..C-020 逐条保留）
  - scheduled Session alignment with D-006
  - OpenClaw scheduled-work migration owner rulings and restore gate
  - Scheduler CLI / control projection
  - implementation preconditions（依赖门，不授权提前实现）
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V2 (D-007)
  - AGENT_WORKSPACE_SESSION_MODEL_V2 (D-006)
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
references:
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md（accepted；被本 Spec 整体替换的对象）
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md（D-007；accepted Current Scheduler Authority）
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md（D-006；accepted）
  - docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md（Program）
  - 超时调查（已完成，PASS）：REPLACEMENT_SPEC_ID = SCHEDULER_TIMEOUT_OUTCOME_V2；
    REPLACED_SPEC_ID = SCHEDULER_TIMEOUT_OUTCOME_V1；
    ONLY_INTENDED_AUTHORITY_CHANGE = implementation_authority: none -> contracts
---

# SCHEDULER_TIMEOUT_OUTCOME_V2 — occurrence authority store、timeout、termination 与迁移语义（whole-authority replacement）

> 状态：**proposed**。本轮只提交 Spec 文本。
> 不 implementation、不创建 production jobs、不补跑 missed runs、不修改 Scheduler store、不部署、不 accepted、不 merge。
> 在本 Spec 合法 acceptance-finalize 之前，**current active authority 仍是 `SCHEDULER_TIMEOUT_OUTCOME_V1`（accepted）+ D-007（accepted）**；本文件不提前覆盖任何现有 authority。

---

## 0. Authoring Result

Owner rulings 已由 Program V1、D-007、D-006 与 V1 完整提供；本轮新增的唯一 authority 变化（`implementation_authority: none -> contracts`）与 D-007 §10.2 显式留给 implementation Spec 的 occurrence store layout 选择，均不需要新的 Owner 决策：

```text
SCHEDULER_TIMEOUT_OUTCOME_V2_SPEC = PASS（authoring 输入完整）
NEEDS_OWNER_DECISION = NO
SPEC_STATUS = proposed
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
IMPLEMENTATION_ALLOWED = NO（proposed 不授权实现；且依赖门未过，见 §3.3）
```

本 `PASS` 仅表示 authoring 输入足以形成完整 proposed Spec；不等于 independent review PASS、accepted 或 implementation authority。

---

## 1. Goal

本 Spec 是 `SCHEDULER_TIMEOUT_OUTCOME_V1`（accepted）的**完整、自包含、whole-authority replacement**。它做且仅做两件事：

1. **逐条保留 V1 的全部 normative semantics**：V1 C-001..C-020、D-007 complete standalone Scheduler Current Truth、D-006 fresh non-main Session per occurrence、D-005 preserved/replaced disposition matrix、no-catch-up migration ruling、production restore gate、timeout without proven termination = `outcome_unknown`、same-occurrence prohibition、unresolved-unknown same-job fence、no blind retry。Scheduler 产品语义与 D-007 Decision **零变化**。
2. **把 V1 留空、D-007 §10.2 显式 deferred 的 implementation 细节冻结到足以实施**：occurrence authority store 的 layout / versioning / record schema / identity 派生 / 原子 reserve / 状态机写回 / fence 持久化 / legacy state 降级 / CLI projection / store 升级与回滚 / fault-injection matrix，并把 `implementation_authority` 从 `none` 提升为 `contracts`（接受后、且依赖门全部通过后才生效）。

与 V1 的 authority delta（唯一意图变化，逐项声明）：

```text
SEMANTIC_DELTA_VS_V1 = NONE
  （C-001..C-020 normative meaning 逐条保留；D-007 / D-006 语义零改动）

IMPLEMENTATION_AUTHORITY_DELTA = none -> contracts
  （SCHEDULER_TIMEOUT_OUTCOME_V1.implementation_authority = none；
   SCHEDULER_TIMEOUT_OUTCOME_V2.implementation_authority = contracts；
   该值在本 Spec accepted 进入 main 前不生效）

NEW_CONTENT_CLASS = IMPLEMENTATION_FREEZING_ONLY
  （C-021..C-037 全部是 D-007 §10.2/§11/§12/§13/§15 已授权或已要求 implementation Spec
   冻结的机制细节；不引入任何新的产品语义或新的 Decision）
```

为什么必须新 spec_id 而不是 V1 同 ID amendment：V1 已 accepted；`SPEC_FORMAT_V0` §14.1/§14.3 禁止在既有 accepted stable ID 下做 authority-changing 改写（`implementation_authority` 变化 + 新 Contracts 属于 authority 变化）。因此采用 `NEW` + 未来原子 whole-Spec supersession（§3.2）。

V1 的根本目标原样保留：Scheduler 必须把「计划时间到达 / occurrence 持久 reserve / Router admission 发出 / Agent turn 开始 / 调用方停止等待（timeout）/ cancel request 发出 / Agent turn 真实终止 / 外部副作用是否发生」分开，避免 timeout 被写成 ordinary failed 后自动 retry / 下一 occurrence 继续 admission、与仍在运行的原 turn 产生重复或重叠外部副作用：

```text
one logical occurrence
→ one stable occurrenceId
→ one runId
→ one request/idempotency key
→ durable reserve before Router
→ at most one Router admission
→ one fresh non-main Session
→ same Agent primary Workspace
→ succeeded | failed | outcome_unknown
```

优先保证「不重复产生未知副作用」：在 crash boundary 上允许保守漏执行或 fence 一个 Job，不虚假承诺 exactly-once completion。

---

## 2. Scope and non-goals

### 2.1 Scope

- `packages/scheduler`（engine、store、job model、schedule、seams、import）与 `packages/scheduler-router`（invoker/delivery 桥）的 occurrence authority store 与 timeout/outcome 实现契约；
- occurrence store layout / versioning / record schema / deterministic identity / reserve 原子性 / durable lifecycle / late settlement / fence 持久化与重建；
- legacy Job execution state（`runningAtMs` 等）降级为 derived projection；importer 剥离 legacy execution state 与 legacy session fields；
- CLI / control projection（`agentcore-cron` 与 domain control surface）;
- native store v1→v2 升级、rollback、restore gate；
- implementation preconditions（依赖门）。

### 2.2 Non-goals（V1 §9 全部保留 + 本轮边界）

```text
Forum/Workflow credential provisioning
channel:last delivery
payload.model passthrough
model fallback
OpenClaw daemon deployment
fleet job import implementation
```

不建设：

- 通用 Workflow Engine；
- distributed exactly-once / transaction platform；
- Session Mapping DB；
- Router product special cases；
- DSH Kernel changes；
- production job 创建、启用、补跑、store mutation（本轮）。

本轮（proposed authoring round）额外禁止：实现任何 Contract、修改 Scheduler 产品代码、修改 Scheduler store、恢复/创建任何 job、部署、把本 Spec 标记 accepted、merge。

---

## 3. Authority and dependencies

### 3.1 Authority map

```text
Program                    = AGENT_CORE_HARDENING_PROGRAM_V1（accepted）
Current Scheduler Decision = D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2（accepted）
Session Product Decision   = D-006 AGENT_WORKSPACE_SESSION_MODEL_V2（accepted）
Superseded Scheduler Decision = D-005（superseded-by-D-007）
Current Scheduler Spec     = SCHEDULER_TIMEOUT_OUTCOME_V1（accepted / active）
Replacement (this file)    = SCHEDULER_TIMEOUT_OUTCOME_V2（proposed）
Implementation authority   = contracts（仅在本 Spec accepted 进入 main 后生效；
                             且依赖门 §3.3 全部通过前不得开始实现）
Kernel change              = NONE
```

规则：

- 本 Spec proposed 阶段不覆盖 V1、D-007、D-006 的任何 authority；
- 本 Spec 只 refine（细化实施）D-007 / D-006 / Program，不 contradiction 它们；如实现中发现冲突，按 `SPEC_GOVERNANCE_V0` §10 停止并走独立 docs-only authority 变更；
- D-007 仍是 Scheduler Current Truth 的 Decision authority；本 Spec §9 的 Contracts 是它的 implementation 契约化重述 + D-007 §10.2 授权的 layout 冻结。

### 3.2 Acceptance transaction（未来，本轮不执行）

独立 review PASS 后，由 authorized owner / maintainer 在**同一次 docs-only transaction** 中原子完成：

```text
SCHEDULER_TIMEOUT_OUTCOME_V2.status: proposed -> accepted
SCHEDULER_TIMEOUT_OUTCOME_V2.supersedes: [SCHEDULER_TIMEOUT_OUTCOME_V1]
SCHEDULER_TIMEOUT_OUTCOME_V1.status: accepted -> superseded
SCHEDULER_TIMEOUT_OUTCOME_V1.superseded_by: SCHEDULER_TIMEOUT_OUTCOME_V2
mutual backlinks = present（含 V1 frontmatter 补充 supersedes/superseded_by 字段）
```

不允许出现「V2 accepted 且 V1 仍是并行 accepted Current Authority」的中间态。本轮**不**提前修改 V1 的任何字节。Program V1 §4.3/§5 对 child spec 的历史引用保持原样（historical record）；V2 accepted 后，Scheduler 实现链上的 current implementation authority 即为本 Spec。

### 3.3 Implementation preconditions（即使 V2 accepted 也冻结生效）

```text
IMPLEMENTATION_AUTHORITY_AFTER_ACCEPTANCE = contracts
IMPLEMENTATION_ALLOWED_BEFORE_DEPENDENCIES_PASS = NO
```

Scheduler 实现 PR 开工前，以下条件**全部**成立（缺一不可）：

1. Scheduler V2（本 Spec）已 accepted、已 merge 进 main；
2. AgentProcess implementation-authorizing V2 Spec（`AGENT_PROCESS_LIFECYCLE_HARDENING_V1` 的 implementation-authority replacement，`implementation_authority: contracts`）已 accepted、已 merge 进 main；
3. 该 AgentProcess implementation 已完成且 review PASS（conformance/fault evidence 齐备）；
4. `NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1` implementation Spec 已 accepted、已 merge 进 main；
5. 该 Notification Ingress implementation 已完成且 review PASS；
6. implementation base 包含 D-006、D-007；
7. contract-by-contract fault-test plan（§10 Acceptance + §10.1 fault matrix）完整且作为实现 PR 的验证计划。

依据：Program V1 §5 的 1→2→3 实现依赖链（Scheduler 实现至少依赖 AgentProcess 提供可信生命周期 / 终止 evidence；在 cancel + proven termination 尚不存在时，timeout 的唯一安全 terminal observation 是 `outcome_unknown`）。当前事实：本 Spec 自身仍为 proposed（precondition 1 未满足）；main@54ac27f 上 `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` 为 accepted 但 `implementation_authority: none`（OBS-SCH-009，precondition 2 未满足），`NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1` spec 尚不存在（precondition 4 未满足）——因此依赖门当前**未**满足。

一个 implementation PR 不得顺手实现下一个 child（Program §5）；本 Spec 的实现 PR 范围仅限 Scheduler occurrence authority store 与 timeout/outcome Contracts。

---

## 4. Current State

- `STATE-SCH-001` — production Scheduler store 无 production jobs（`Agent Core production jobs = 0`），OpenClaw fleet 280 jobs（enabled 140 / disabled 140）尚未 import。Basis: `OBS-SCH-011`（fleet evidence，`OPENCLAW_TO_AGENT_CORE_SCHEDULED_WORK_MIGRATION_AUDIT_V1 = PASS`，经 V1 §3.1 / D-007 §15 转写）。
- `STATE-SCH-002` — main@54ac27f 的 Scheduler 实现仍是 job-level execution model：timeout 折叠 ordinary error + backoff、`runningAtMs` no-dup + 2h stuck-clear re-admit、稳定 per-job Session。Basis: `OBS-SCH-001`, `OBS-SCH-002`, `OBS-SCH-003`, `OBS-SCH-007`；`CLM-SCH-001`, `CLM-SCH-002`, `CLM-SCH-003`。
- `STATE-SCH-003` — `JobStore` 已具备 D-007 §11.1 要求的 mutation 协议（same-process FIFO → cross-process exclusive lock → re-read latest → delta → fsync/atomic rename → RAM-after-commit），`jobs.json = {version:1, jobs}`、`runs.jsonl` append-only bounded 10MB evidence。Basis: `OBS-SCH-004`；`CLM-SCH-004`。
- `STATE-SCH-004` — Router / AgentProcess 无 active-turn cancel + proven termination seam；scheduler-router 仅观察并记录 AbortSignal。Basis: `OBS-SCH-005`；`CLM-SCH-005`。
- `STATE-SCH-005` — current active Scheduler spec authority = `SCHEDULER_TIMEOUT_OUTCOME_V1`（accepted，`implementation_authority: none`）；`SCHEDULER_TIMEOUT_OUTCOME_V2` 在 main 上不存在。Basis: `OBS-SCH-010`；`CLM-SCH-006`。
- `STATE-SCH-006` — Scheduler 实现依赖门未满足（AgentProcess implementation-authority 替换不存在、Notification Ingress implementation spec 不存在）。Basis: `OBS-SCH-009`；`CLM-SCH-007`。

---

## 5. Observations

坐标统一：repository `mayf3/dsh-agent-core`，revision `54ac27ff8a39fe6035b497dc3ae43958479df3db`（origin/main，2026-08-22 fetch），environment = 本地 checkout（read-only inspection）。方法均为源码检视（file:line）。

### OBS-SCH-001 — timeout 折叠为 ordinary error 并进入 retry/backoff

- Subject: `packages/scheduler/src/scheduler.js`
- Source revision: `54ac27f`
- Method: 检视 `_invokeWithTimeout()`（Promise.race + AbortController + `TIMEOUT_ERROR_TEXT` reject）与 `applyRunState()`（`status==='error'` → `consecutiveErrors++` → one-shot `30s/60s/5m` / recurring `30s/60s/5m/15m/60m` backoff 写 `nextRunAtMs`）
- Result: timeout rejection 产出 `{status:'error'}`，与普通失败同路径 retry；无 `outcome_unknown` 类型。
- Provenance: `packages/scheduler/src/scheduler.js`（`_invokeWithTimeout` / `applyRunState`；`TIMEOUT_ERROR_TEXT = 'cron: job execution timed out'`）

### OBS-SCH-002 — `runningAtMs` 是唯一 no-dup/ownership 标记，2h 后清除并可 re-admit

- Subject: `packages/scheduler/src/scheduler.js`
- Source revision: `54ac27f`
- Method: 检视 `isRunnableJob()`（`typeof job.state.runningAtMs === 'number'` → not runnable）、`normalizeJobTickState()`（`nowMs - runningAt > STUCK_RUN_MS(2h)` → 清除）、`_fireJobs()`（batch `_commit` 内写 `runningAtMs = now` 后才 invoke）
- Result: stale `runningAtMs` 清除后同一 Job 立即恢复 runnable；occurrence 无独立身份。
- Provenance: `packages/scheduler/src/scheduler.js`

### OBS-SCH-003 — scheduled Session 稳定为 per-job `agent:<agentId>:cron:<jobId>`

- Subject: `packages/scheduler/src/seams.js` `defaultSessionId(job)`；`scheduler.js` `_invokeWithTimeout` 的 `sessionId` 选择（`sessionKey` > `sessionTarget==='main'` > default）
- Source revision: `54ac27f`
- Result: 默认（`sessionTarget:'isolated'`，135/140 真实 fleet）复用同一 per-job Session；与 D-006 per-execution fresh Session 冲突。
- Provenance: `packages/scheduler/src/seams.js`、`packages/scheduler/src/scheduler.js`

### OBS-SCH-004 — JobStore 已具备 cross-process mutation 协议与两类持久化面

- Subject: `packages/scheduler/src/store.js`
- Source revision: `54ac27f`
- Method: 检视 `mutate()`/`_mutateLocked()`/`_withLock()`（`<jobs.json>.lock` O_EXCL、stale-break 30s、timeout 15s）、`_writeAtomic()`（tmp → fsync → rename）、`appendRunEvent()`（fsync append + 10MB truncate 保留完整最新行）
- Result: `jobs.json = { version: 1, jobs: [...] }` 原子整体写；`runs.jsonl` 为 evidence-only；mutation 均走 lock 内 re-read-latest。
- Provenance: `packages/scheduler/src/store.js`（`STORE_VERSION = 1`）

### OBS-SCH-005 — Router/AgentProcess 无 cancel + proven termination seam

- Subject: `packages/scheduler-router/src/index.js` `createRouterInvoker()`
- Source revision: `54ac27f`
- Method: 检视 invoke 路径：`assertRunnable()`（AGENT_NOT_FOUND/AGENT_DISABLED 预检）→ `router.ensureRunning()` → `proc.turn(sessionId, message, {}, turnTimeoutMs=timeoutMs+30s)`；AbortSignal 仅 `addEventListener('abort')` 记录 `aborted`
- Result: abort 不能取消真实 turn；超时后原 turn 可继续；无终止 acknowledgment。
- Provenance: `packages/scheduler-router/src/index.js`（文件头注释明确 "the signal cannot cancel a real turn yet"）

### OBS-SCH-006 — CLI control-only，六个子命令，写路径走 mutation 协议

- Subject: `scripts/agentcore-cron.mjs`
- Source revision: `54ac27f`
- Result: `add|list|runs|rm|enable|disable`；`runs` 当前仅展示 job-level run log（runs.jsonl 事件），无 occurrenceId/runId/outcome_unknown/fence 维度；store 默认 `~/.agent-core/scheduler/jobs.json`。
- Provenance: `scripts/agentcore-cron.mjs`（文件头 "CONTROL-ONLY (audit FIX 2)"）

### OBS-SCH-007 — Job model 携带 legacy session fields 与 job-level state whitelist

- Subject: `packages/scheduler/src/job-model.js`
- Source revision: `54ac27f`
- Result: `sessionTarget: 'isolated'|'main'`、`sessionKey?` 存在于 schema；`normalizeState` whitelist = `nextRunAtMs,lastRunAtMs,lastDurationMs,consecutiveErrors,runningAtMs,lastRunStatus,lastStatus,lastDeliveryStatus,lastError,lastDelivered`；`toPublicJob` 把这些作为对外 projection。
- Provenance: `packages/scheduler/src/job-model.js`

### OBS-SCH-008 — OpenClaw import 已是 definition-mapping + gap/warning report

- Subject: `packages/scheduler/src/import-openclaw.js`
- Source revision: `54ac27f`
- Result: `mapOpenClawJob()` 逐字段映射（timeoutSec/timeoutMs/runTimeoutMs → payload.timeoutSeconds 等），返回 `{jobs, report}`，gap job 不导入；尚无 D-007 §15.2 的 existing-store refuse/force 守卫实现细节冻结。
- Provenance: `packages/scheduler/src/import-openclaw.js`

### OBS-SCH-009 — AgentProcess child spec 在 main 上 accepted 但 implementation_authority = none

- Subject: `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V1.md` frontmatter
- Source revision: `54ac27f`
- Result: `status: accepted`、`implementation_authority: none`；即 §3.3 precondition 2 的「AgentProcess implementation-authorizing V2」尚未存在。
- Provenance: `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V1.md:1-25`

### OBS-SCH-010 — V1 accepted 且 V2 不存在

- Subject: `docs/specs/`
- Source revision: `54ac27f`
- Method: `ls docs/specs/`（无 `SCHEDULER_TIMEOUT_OUTCOME_V2.md`）；读 V1 frontmatter（`status: accepted`、`implementation_authority: none`）
- Result: current active authority = V1；本文件是首个 V2 proposal。
- Provenance: `docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V1.md:1-24`

### OBS-SCH-011 — fleet evidence（转写自 V1 §3.1 / D-007 §15，原始 provenance 不变）

- Subject: OpenClaw→Agent Core scheduled-work migration audit
- Source artifact: `OPENCLAW_TO_AGENT_CORE_SCHEDULED_WORK_MIGRATION_AUDIT_V1 = PASS`（经 V1 §3.1 / D-007 §15 转写；原始 audit 为 provenance）
- Result: total 280 / enabled 140 / disabled 140 / Agent Core production jobs 0；`NON_IDEMPOTENT_SIDE_EFFECT=113`、`RECORDING_OR_REMINDER=4`、`DAEMON_OR_LONG_RUNNING=3`、`OBSOLETE_OR_DUPLICATE=13`、`BLOCKED=7`、`SAFE_READ_ONLY=0`、`IDEMPOTENT_WRITE=0`；pre-existing timeout/error 63/140；missed runs 94。
- Provenance: V1 §3.1；D-007 §15

---

## 6. Claims and assumptions

### CLM-SCH-001 — 当前实现把 timeout 当 ordinary failed 并自动 retry

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCH-001`（源：`OBS-SCH-001`）
- Contradicted by evidence: none known
- Uncertainty: none（源码直接可证）

### CLM-SCH-002 — 当前 no-dup 依赖 job-level `runningAtMs`，可在 2h 后 re-admit 同一逻辑执行

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCH-002`（源：`OBS-SCH-002`）
- Contradicted by evidence: none known
- Uncertainty: none

### CLM-SCH-003 — 当前 scheduled Session 是稳定 per-job，违反 D-006

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCH-003`（源：`OBS-SCH-003`, `OBS-SCH-007`）
- Contradicted by evidence: none known
- Uncertainty: none

### CLM-SCH-004 — 复用既有 JobStore mutation 协议承载 occurrence authority，能满足 D-007 §10.2 的原子性/一致性要求，且无需第二把锁

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCH-004`（源：`OBS-SCH-004`；D-007 §10.2 明确允许「扩展同一版本化 Scheduler state document」）
- Contradicted by evidence: none known
- Uncertainty: 单机文件 store 的既有前提（不引入 Redis/Kafka/分布式事务）继续成立

### CLM-SCH-005 — Router/AgentProcess 当前无 cancel + proven termination，timeout 后原 turn 可能继续

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCH-005`（源：`OBS-SCH-005`；Program V1 §3.4 交互 turn evidence 佐证「timeout 后 turn 仍完成并产生副作用」）
- Contradicted by evidence: none known
- Uncertainty: none

### CLM-SCH-006 — 本 Spec proposed 阶段 current authority 仍是 V1 + D-007

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCH-006`（源：`OBS-SCH-010`）
- Contradicted by evidence: none known
- Uncertainty: none

### CLM-SCH-007 — Scheduler 实现依赖门当前未满足

- Support state: SUPPORTED
- Supported by evidence: `EVD-SCH-007`（源：`OBS-SCH-009`；`docs/specs/` 无 Notification Ingress implementation spec）
- Contradicted by evidence: none known
- Uncertainty: none

无 `OPEN_ASSUMPTION`。没有影响 authority 或 Contract meaning 的未决假设。

---

## 7. Evidence relations

### EVD-SCH-001 — timeout 折叠证据支持 CLM-SCH-001

- Source observations: `OBS-SCH-001`
- Target: `CLM-SCH-001` — Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `54ac27f`，`packages/scheduler/src/scheduler.js`
- Strength/sufficiency: strong（实现路径唯一且确定）
- Limitations: 仅覆盖该 revision
- Provenance: OBS-SCH-001 源码引用

### EVD-SCH-002 — no-dup/stuck-clear 证据支持 CLM-SCH-002

- Source observations: `OBS-SCH-002` — Target: `CLM-SCH-002` — Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `54ac27f`，`packages/scheduler/src/scheduler.js`
- Strength: strong — Limitations: 仅覆盖该 revision

### EVD-SCH-003 — session 证据支持 CLM-SCH-003

- Source observations: `OBS-SCH-003`, `OBS-SCH-007` — Target: `CLM-SCH-003` — Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `54ac27f`
- Strength: strong — Limitations: 仅覆盖该 revision

### EVD-SCH-004 — mutation 协议证据支持 CLM-SCH-004

- Source observations: `OBS-SCH-004` — Target: `CLM-SCH-004` — Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `54ac27f`，`packages/scheduler/src/store.js`
- Strength: strong（协议四要素在源码中逐条可核）
- Limitations: occurrence 负载规模为设计推断，属 implementation 验证范围（§10 Acceptance）

### EVD-SCH-005 — 无取消 seam 证据支持 CLM-SCH-005

- Source observations: `OBS-SCH-005` — Target: `CLM-SCH-005` — Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `54ac27f`，`packages/scheduler-router/src/index.js`
- Strength: strong — Limitations: 仅覆盖该 revision

### EVD-SCH-006 — authority 现状证据支持 CLM-SCH-006

- Source observations: `OBS-SCH-010` — Target: `CLM-SCH-006` — Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `54ac27f`，`docs/specs/`
- Strength: strong — Limitations: 快照时点（2026-08-22 fetch）

### EVD-SCH-007 — 依赖门现状证据支持 CLM-SCH-007

- Source observations: `OBS-SCH-009`（及 `docs/specs/` 无 NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1）
- Target: `CLM-SCH-007` — Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `54ac27f`
- Strength: strong — Limitations: 快照时点

---

## 8. Decisions

### DEC-SCH-001 — 以新 spec_id 做 whole-authority replacement，不做 V1 同 ID amendment

- Decision owner: repository owner（Program V1 §0.2 框架内）
- Decision: 新建 `SCHEDULER_TIMEOUT_OUTCOME_V2`（本文件），完整自包含重述；接受时按 §3.2 原子 supersede V1。
- Rejected alternative: 在 `SCHEDULER_TIMEOUT_OUTCOME_V1` 下做 authority-changing AMEND（违反 `SPEC_FORMAT_V0` §14.1/§14.3：accepted stable ID 不得改写 normative/authority meaning）。
- Reason: `implementation_authority` 变化与新增 Contracts 是 authority 变化；governance 要求 NEW + SUPERSEDE。
- Owner input required: NO。

### DEC-SCH-002 — 唯一 authority 变化 = implementation_authority: none -> contracts；语义零变化

- Decision owner: repository owner（超时调查 ruling 转写）
- Decision: 本 Spec 对 V1/D-007/D-006 的全部产品语义逐条保留（`SEMANTIC_DELTA_VS_V1 = NONE`）；新增内容仅限 implementation-freezing（store layout 等，D-007 §10.2 显式留给 implementation Spec 的选择）。
- Rejected alternative: 顺手调整任何 timeout/retry/fence/session/migration 语义（会导致 D-007 或 V1 stable meaning 变化，需另走 authority 变更）。
- Owner input required: NO。

### DEC-SCH-003 — occurrence authority store 采用 D-007 §10.2 选项 1：扩展同一版本化 Scheduler state document

- Decision owner: repository owner（D-007 §10.2 把该二选一显式指派给 implementation Spec）
- Decision: 单一 state document、单一 mutation authority：`jobs.json` 升级为 `{ version: 2, jobs: [...], occurrences: [...] }`，同一 cross-process lock、同一 re-read-latest + fsync + atomic rename 协议；admission 判定（due + fence + uniqueness）与 occurrence reserve 在**同一次** lock 内提交，天然满足 D-007 §10.2 的「occurrence state and Job definition cannot be torn into an unsafe admission view」。
- Rejected alternative: 选项 2（独立 versioned occurrence document/store）——需要第二把锁与跨文件一致性顺序，admission 视图可能在两锁之间被撕裂，复杂度无对应收益。
- Reason: `CLM-SCH-004`；单机最小持久化前提不变。
- Owner input required: NO（D-007 §10.2 已授权 implementation Spec 自行二选一并通过 review）。

### DEC-SCH-004 — occurrence/run/request identity 全部确定性派生（不使用随机 mint）

- Decision owner: repository owner
- Decision: `occurrenceId` 由 `(jobId, scheduleRevision, slot 坐标)` 确定性派生；`runId`、`idempotencyKey` 由 `occurrenceId` 派生（见 C-023）。restart / tick 重入 / timezone 重算后同一 nominal slot 必然得到同一 identity，从机制上排除「同一 occurrence 第二个 id」。
- Rejected alternative: lock 内随机 mint（允许但非必要；随机值崩溃后不可复现，恢复路径更弱）。
- Owner input required: NO。

### DEC-SCH-005 — fence 以 occurrence ledger 为 authority、持久化为可重建 projection

- Decision owner: repository owner
- Decision: fence 的 authority 是「存在未解析 `outcome_unknown` occurrence」这一 ledger 事实；store 同时维护 `fences` map（jobId → 激活信息）作为**可删除可重建**的持久化 projection（满足 D-007 §10.2「必须持久保存 fence」），在状态转换的同一原子 commit 内更新。
- Rejected alternative: 独立 fence store / 仅内存 fence（前者制造第二 authority，后者违反 durable 要求）。
- Owner input required: NO。

### DEC-SCH-006 — operator reconcile 作为 control-only 显式操作

- Decision owner: repository owner（D-007 §8.3「authorized operator 做显式 reconciliation」的实施化）
- Decision: 冻结一个 control-only `reconcileOccurrence` 操作（见 C-029）：解析 `outcome_unknown` → `succeeded | failed`、记录 evidence、解除 fence；永不 re-admit。
- Rejected alternative: 隐式/自动 reconcile（时间流逝不是 evidence；违反 C-003/C-011）。
- Owner input required: NO。

### DEC-SCH-007 — 冻结 implementation preconditions（§3.3），未过门不得实现

- Decision owner: repository owner（Program V1 §5 依赖链转写）
- Decision: 即使本 Spec accepted，`IMPLEMENTATION_ALLOWED_BEFORE_DEPENDENCIES_PASS = NO`。
- Rejected alternative: V2 accepted 即开工（会在 cancel/proven-termination seam 不存在时实现不安全的 timeout 收口）。
- Owner input required: NO。

### DEC-SCH-008 — 本轮 docs-only

- Decision owner: repository owner（任务边界）
- Decision: 本轮只新增本文件；不改 V1、不改 D-006/D-007、不改代码/store/production、不 accepted、不 merge。
- Owner input required: NO。

---

## 9. Contracts

Contract ID 在 accepted 后不得重编号或复用。**C-001..C-020 = V1 对应 Contract 的完整保留（normative meaning 不变，文字按 V1 原义重述并标注保留来源）；C-021..C-037 = 本 Spec 新冻结的 implementation Contracts（D-007 已授权/要求的机制细节）。** Contract 的全局身份是 `SCHEDULER_TIMEOUT_OUTCOME_V2#<C-xxx>`。

### C-001 — Timeout outcome（PRESERVED V1 C-001 / D-007 §8）

```text
timeout without proven termination
→ outcome_unknown
```

不得写为 ordinary `failed` / `error`，不得继承普通 retry/backoff。

### C-002 — Same occurrence unknown prohibition（PRESERVED V1 C-002 / D-007 §6.1/§8.3）

```text
same occurrence + outcome_unknown
→ MUST NOT automatically retry
→ MUST NOT be re-admitted
→ MUST NOT obtain a second runId
```

可信 evidence 证明原执行已终止后，也只能决定是否创建**新的 occurrence**；不得复活原 occurrence admission identity。

### C-003 — Unknown execution fence（PRESERVED V1 C-003 / D-007 §8.3）

```text
outcome_unknown + termination not proven
→ SAME_JOB_EXECUTION_FENCE = ACTIVE
→ no retry occurrence
→ no later natural occurrence admission
```

fence 解除条件：trusted late settlement / termination evidence，或 authorized operator explicit reconciliation。fence 期间产生的自然 slots 不积压自动补跑；解除后从下一个 future natural occurrence 继续，除非新的 accepted policy 另有明确规定。

### C-004 — Ordinary failed is separate（PRESERVED V1 C-004 / D-007 §6/§9）

`failed` 只允许：(1) proven pre-start terminal rejection（明确 turn 未开始）；(2) terminal failure + evidence 证明 exact turn 不再继续。普通 proven failure 可按显式 retry policy 处理；非幂等 job 没有 downstream idempotency proof 时，默认不得自动重放。Delivery 失败不得把 proven `succeeded` execution 改写为 `failed`（D-007 §11.4）。

### C-005 — Stable identity（PRESERVED V1 C-005 / D-007 §5）

每个 occurrence 持久拥有：`jobId`、`scheduleRevision`、`occurrenceId`、`runId`、`requestId / idempotencyKey`、`payloadHash`、`nominalScheduledAt` OR `retryOfOccurrenceId`（OR `catchUpOfNominalAt`，D-007 §5 扩展）、`admittedAt`、`nativeSessionId`（when known; evidence only）。Schedule 更新不得改变已有 occurrence identity。

### C-006 — Durable states（PRESERVED V1 C-006 / D-007 §6）

最小 durable states：`admitted` / `running` / `succeeded` / `failed` / `outcome_unknown`，语义与 D-007 §6 完全一致（admitted ≠ running ≠ terminated）。

### C-007 — Reserve before Router（PRESERVED V1 C-007 / D-007 §11.2）

occurrence record 与 `admitted` reservation 必须先于首次 Router call 持久化。reserve 后、Router 前 crash → recovery 为 `outcome_unknown` + fence，不得 re-admit。接受潜在漏执行，不接受重复未知副作用。

### C-008 — At-most-once Router admission（PRESERVED V1 C-008 / D-007 §6.1）

```text
SAME_OCCURRENCE_ADMISSION = AT_MOST_ONCE
SAME_OCCURRENCE_MUST_NOT_ENTER_ROUTER_TWICE = YES
```

并发 tick、startup recovery、CLI mutation、restart、迟到 callback 都不得产生第二次 Router admission。`runningAtMs` 单字段不再足以证明 occurrence identity / ownership。idempotency key 语义（D-007 §5.4）：same key + same payloadHash → return current/previous status、no second enqueue；same key + different payloadHash → conflict / fail loud。

### C-009 — Retry is a new occurrence（PRESERVED V1 C-009 / D-007 §7.5/§9）

ordinary `failed` 命中显式 retry policy：new retry occurrence = new occurrenceId + runId + idempotencyKey，`new.retryOfOccurrenceId = old.occurrenceId`。one-shot `30s/60s/5m`（≤3 次）与 recurring `30s/60s/5m/15m/60m` 保留为 default policy（非幂等默认 `AUTO_RETRY_DEFAULT = NO`），但调度的都是新 occurrence。

### C-010 — Cancel requested is not terminated（PRESERVED V1 C-010 / D-007 §8.1/§8.2）

`AbortSignal sent` / cancel request emitted / Promise.race settled locally 都不等于 `Agent turn proven terminated`。当前无真实 cancellation contract，所以 timeout 必须输出 `outcome_unknown`。未来 cancellation 只有在 exact turn terminal acknowledgment、可信 queued-turn removal、或能证明 exact turn 不可能继续的 lifecycle evidence 下，才可写 terminal result。仅 kill 一个可能承载其他 surface / occurrence turn 的 AgentProcess 不是自动安全方案。

### C-011 — Late settlement（PRESERVED V1 C-011 / D-007 §8.4）

同一 `(occurrenceId, runId)` 的迟到 success / failure / external-effect evidence 必须追加保存；不能丢弃，也不能触发 second admission。`outcome_unknown → succeeded | failed` 只允许 trusted late settlement / reconcile；timeout/unknown history 继续可审计。若实现暂时无法接收可信 late settlement，最小安全行为是保持 unknown + fence。

### C-012 — Timeout clock / queue distinction（PRESERVED V1 C-012 / D-007 §7/§11）

区分：等待 Scheduler concurrency slot；durable admitted、尚未证明 turn started；turn running。执行 timeout 至少从 `admittedAt` / Router admission 开始后计算；未 admission 的 Scheduler 排队时间不得误记为 execution timeout。admitted 后 timeout、但无法证明 queued request 已移除 → `outcome_unknown`。

### C-013 — Scheduled Session model（PRESERVED V1 C-013 / D-007 §14 / D-006 §10）

```text
each occurrence admission
→ fresh non-main native Session
→ same Agent
→ same Agent primary Workspace
```

禁止最终语义：`scheduled execution -> main`、`scheduled execution -> stable per-job agent:<id>:cron:<jobId>`、`CRON_SESSION_REUSE = YES`。native Session ID 可由 occurrence identity 派生或 mint，并记录在 occurrence evidence；不得新增独立 Session Mapping DB。

### C-014 — Migration no catch-up（PRESERVED V1 C-014 / D-007 §13.2/§15.4）

```text
MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
```

OpenClaw definition import：strip `lastRun / lastStatus / runningAt / error counters / retry state`；不导入触发过去 occurrence 的 legacy `nextRunAt`；recurring 从 activation 后下一个 future natural occurrence 开始；94 个 missed occurrence 零补跑。此条是 migration policy；native runtime restart policy 由 D-007 §13.1 完整重述并始终受 occurrence at-most-once 与 unknown fence 约束。

### C-015 — Missing Agent ID（PRESERVED V1 C-015 / D-007 §15.5）

```text
MISSING_AGENT_ID_JOBS = BLOCKED
```

3 个无 Agent ID jobs 不猜测、不按名称模糊匹配、不绑定 default Agent。

### C-016 — Stale one-shots（PRESERVED V1 C-016 / D-007 §15.6）

```text
STALE_ONE_SHOTS = DO_NOT_IMPORT
```

过去的 at target 不转换为「立即执行」。

### C-017 — Disabled jobs（PRESERVED V1 C-017 / D-007 §15.7）

```text
DISABLED_JOBS = KEEP_DISABLED
```

state strip / defaulting 不得自动 enable。

### C-018 — Daemon jobs（PRESERVED V1 C-018 / D-007 §15.8）

```text
DAEMON_JOBS = OUT_OF_SCHEDULER
```

3 个 daemon/long-running jobs 由独立 supervision owner 处理。

### C-019 — Restore gate（PRESERVED V1 C-019 / D-007 §16）

在「Scheduler timeout/outcome implementation spec accepted（本 V2）+ D-007 accepted + implementation review PASS + occurrence/idempotency/unknown fault tests PASS + migration prerequisites PASS」全部完成前：

```text
NON_IDEMPOTENT_SIDE_EFFECT = MUST_NOT_AUTO_ENABLE
RECORDING_OR_REMINDER = MUST_NOT_AUTO_ENABLE
READY_TO_RESTORE_BEFORE_HARDENING = 0
```

本 Spec 不授权 import 或 enable。

### C-020 — D-005 supersession（PRESERVED V1 C-020 / D-007 §1/§17/§21）

```text
D005_DISPOSITION = SUPERSEDE
REPLACED_BY = D-007 / SCHEDULER_OCCURRENCE_OUTCOME_V2
```

D-005 已（2026-08-20 acceptance 时）被 D-007 原子取代并标记 superseded；D-007 §17 disposition matrix 是 standalone Current Truth，不需要读 D-005 拼接语义。本 Spec 不改变该 disposition。

---

### C-021 — Occurrence authority store layout（NEW；D-007 §10.2 选项 1 冻结）

Occurrence authority 与 Job definition 共存于**同一** versioned Scheduler state document：

```text
file: <store>/jobs.json（路径不变；默认 ~/.agent-core/scheduler/jobs.json）
document: { "version": 2, "jobs": [...], "occurrences": [...] }
```

约束：

- 单一 mutation authority：所有 job/occurrence 写入必须经同一 mutation 协议（same-process FIFO → cross-process exclusive lock → re-read latest → apply one delta → fsync + atomic rename → RAM after commit → release lock）；CLI、resident engine、recovery、migration 不得各自维护盲写路径。
- `version: 1`（或 bare array）旧文档按 C-033 升级；corrupt / unsupported document fail loud，不得静默当空 store。
- `runs.jsonl` 仍为 append-only bounded evidence（默认 10MB，truncate 保留完整最新行），**不是** occurrence authority；occurrence 权威状态必须始终在 state document 中。
- 不引入 Redis / Kafka / distributed transaction / leader election / 第二把跨进程锁。

### C-022 — Occurrence record schema（NEW；D-007 §5/§6/§10.2/§11 的实施冻结）

每条 occurrence record 的 normative 字段（存储层不得缺失以下 authority 字段；允许附加 evidence 字段但不允许以其替代 authority）：

```text
OccurrenceRecord {
  occurrenceId: string            # 稳定唯一；C-023 派生
  jobId: string
  scheduleRevision: number        # 创建时绑定的 Job definition revision
  kind: 'natural' | 'retry' | 'catchup'
  nominalScheduledAt?: number     # natural/catchup 的 nominal slot（ms epoch）
  retryOfOccurrenceId?: string    # retry slot 的前驱 occurrence
  catchUpOfNominalAt?: number     # native downtime catch-up 对应的 nominal slot
  runId: string                   # 唯一 admitted execution attempt
  idempotencyKey: string          # = occurrenceId（C-023）；Router requestId 复用此值
  payloadHash: string             # C-024
  state: 'admitted' | 'running' | 'succeeded' | 'failed' | 'outcome_unknown'
  admittedAt: number
  executionDeadlineAtMs: number   # C-025
  startedAt?: number              # running evidence 到达时间
  endedAt?: number
  executionOutcome?: 'succeeded' | 'failed'   # 终态（含 late settlement 后）
  deliveryStatus?: 'delivered' | 'not-delivered' | 'not-requested' | 'unknown'
  nativeSessionId?: string        # evidence only（C-031）
  lateSettlement?: { resolvedTo: 'succeeded' | 'failed',
                     resolvedAt: number,
                     basis: 'trusted-late-evidence' | 'operator-reconcile',
                     evidenceRef: string }
  terminalEvidence?: { kind: 'pre-start-rejection' | 'turn-terminal' |
                             'late-settlement' | 'operator-reconcile',
                       detailRef: string }
  history: [ { at: number, from, to, reason: string } ]   # append-only 转换审计
}
```

- `history` 由实现按状态转换追加；`outcome_unknown → succeeded|failed` 的 late settlement 必须在 `history` 与 `lateSettlement` 同时留痕。
- state document 另含 `fences` projection：`{ [jobId]: { occurrenceId, runId, activatedAtMs, reason } }`（C-028）。
- schema 校验 fail loud：未知/损坏 record 不得静默丢弃或当作无 occurrence（区别于 `load()` 对单条 corrupt **job** 的现有 warn-drop——occurrence record 损坏属于 authority 损坏，必须 fail loud）。

### C-023 — Deterministic identity derivation（NEW；D-007 §5.1/§5.3/§5.4 实施冻结）

```text
natural:  occurrenceId = 'occ:' + hex16(sha256(jobId ∥ scheduleRevision ∥ 'natural' ∥ nominalScheduledAt))
retry:    occurrenceId = 'occ:' + hex16(sha256(jobId ∥ scheduleRevision ∥ 'retry' ∥ retryOfOccurrenceId))
catchup:  occurrenceId = 'occ:' + hex16(sha256(jobId ∥ scheduleRevision ∥ 'catchup' ∥ catchUpOfNominalAt))
runId            = 'run:' + occurrenceId
idempotencyKey   = occurrenceId（Router admission request 的 requestId = idempotencyKey）
```

- `hex16` = sha256 hex 前 16 字符；分隔使用不可歧义编码（长度前缀或 JSON canonical 串）。具体字符串拼接格式是 implementation detail，但**同一 logical slot 跨 tick/restart/store reload 必须确定性得到同一 id**，且 store 必须拒绝插入重复 `occurrenceId` 或重复 `(jobId, scheduleRevision, kind, slot坐标)` 的 natural record。
- 禁止：仅 RAM sequence、restart 后按当前时间 re-mint、以 `runningAtMs` 充当 identity、同一 occurrence 第二个 occurrenceId/runId。
- `scheduleRevision`：任何改变未来 occurrence 语义（schedule/payload/target/retry）的 Job update 递增 revision；已存在 occurrence 继续绑定创建时的 revision 与 payloadHash（D-007 §5.2）。

### C-024 — payloadHash（NEW）

```text
payloadHash = sha256(canonicalJSON({ agentId, payload: { kind, message,
  timeoutSeconds, lightContext, model } }))
```

- canonicalJSON = 键排序、无空白的标准 JSON 序列化；`undefined` 字段省略。
- `delivery` 不进入 execution payloadHash（delivery 是独立 outcome，D-007 §11.4）。
- 校验规则：任何写回/late settlement 携带的 payloadHash 与 record 不一致 → conflict / fail loud，不得静默覆盖。

### C-025 — Execution deadline recorded at admission（NEW；C-012 的实施冻结）

reserve 时写入：

```text
timeoutMs = payload.timeoutSeconds * 1000（未设置时 default = 3600_000，即现有
            AGENT_TURN_SAFETY_TIMEOUT_MS）
executionDeadlineAtMs = admittedAt + timeoutMs
```

- 执行超时判定以 `executionDeadlineAtMs` 为准；Scheduler concurrency 排队时间（admission 之前）不计入。
- 超时触发时若无法证明 queued request 已移除或 turn 未开始 → `outcome_unknown`。

### C-026 — Admission reserve atomicity（NEW；C-007/C-008 的实施冻结）

一次 admission 必须在**同一次** mutation lock 内完成全部判定与写入：

```text
lock 内：
  re-read latest { jobs, occurrences, fences }
  → due eligibility（D-007 §7.1：enabled + agentId runnable + nominal <= now
     + 无同 (jobId, scheduleRevision, nominal slot) 既有 record
     + 未被 explicit backoff 抑制 + 未被 migration policy 阻断）
  → 无 active fence（fences[jobId] 不存在或已解除）
  → mint identity（C-023 确定性派生）
  → append OccurrenceRecord { state: 'admitted', ... } + 更新 projection
  → fsync + atomic rename
unlock 后：方可发出首次 Router admission call
```

- 任何判定失败 → 本次不 admission（不写 partial record）。
- 并发 tick / startup recovery / CLI mutation / restart 重放同一 slot：lock 内 uniqueness 检查保证至多一次 reserve；`runs.jsonl` 迟到 callback 不得复活 admission。
- Job disable 与已 admitted occurrence 并发：disable 不撤销 reserve，occurrence outcome 仍记录（D-007 §12.3/§11.3）。

### C-027 — Occurrence-state writeback authority（NEW；D-007 §11.3 实施冻结）

- invocation / model turn / delivery 发生在 store lock 之外；start evidence 与 terminal/unknown outcome 按 `(occurrenceId, runId)` 在 lock 内写回 **latest** state document。
- result 不得按旧 store snapshot 或仅按 `jobId` 覆盖整库；concurrent Job update/disable/delete 不得被 late completion 回滚。
- Job 已删除：occurrence terminal evidence 仍必须持久，且不得复活 Job。
- Job disabled：已 admitted occurrence 的 outcome 仍记录，但不生成下一 occurrence。
- `payloadHash` / `scheduleRevision` 不匹配 = conflict / fail loud。
- 每次转换 append `history` 条目；状态机非法转换（§9.1）必须被拒绝。

### C-028 — Fence projection persistence & rebuild（NEW；C-003 实施冻结）

- fence 的 authority 是 ledger 事实：`fences[jobId]` active ⇔ 存在 state=`outcome_unknown` 且无 `lateSettlement` 的 occurrence record（该 Job 任意 occurrence）。
- `fences` map 在产生/解析 `outcome_unknown` 的同一原子 commit 内更新；是可删除、可由 occurrence ledger 完整重建的 projection（重建结果必须与持久化值一致）。
- admission 判定读 `fences` projection（或等价地在 lock 内直接查 ledger）；锁 stale-break 只能恢复 mutation lock ownership，不能证明 occurrence 已终止，也不能解除 fence（D-007 §11.1）。

### C-029 — Operator reconcile seam（NEW；D-007 §8.3 实施冻结）

control-only 域操作：

```text
reconcileOccurrence(occurrenceId, runId, { resolvedTo: 'succeeded' | 'failed',
                                           evidenceNote: string })
```

- 仅接受 state=`outcome_unknown` 且无 lateSettlement 的 record；写入 `lateSettlement { basis: 'operator-reconcile' }` + history + 解除 fence（若该 Job 无其他未解析 unknown）。
- 不删除 timeout/unknown history；不 re-admit；不生成 retry occurrence（是否创建新 occurrence 由显式 retry policy 另行决定）。
- CLI/control 面暴露为显式 operator 命令；必须留 audit evidence（operator 标识、时间、note）。

### C-030 — Legacy Job.state demoted to derived projection（NEW；D-007 §3.1 实施冻结）

```text
LEGACY_EXECUTION_STATE_AUTHORITY = NONE（native store 亦适用）
```

- `runningAtMs / lastStatus / lastRunStatus / lastRunAtMs / consecutiveErrors / lastError / lastDurationMs / lastDeliveryStatus / lastDelivered` 降级为 derived summary/cache：authority 来自 occurrence records；summary 可删除并由 ledger 重建；重建不得触发第二次 admission。
- 任何 admission / no-dup / ownership / termination 判定**禁止**读取这些字段（唯一判定来源 = occurrence ledger + fences + Job definition eligibility）。
- `nextRunAtMs` 保留为 schedule projection/cache，可由 Job definition、latest terminal occurrence、fence 与 retry policy 重算；不是 occurrence identity。
- `runningAtMs` 不得再作为唯一 no-dup 或 termination proof；`STUCK_RUN_MS`（2h）清除-重跑路径整体废除。

### C-031 — Scheduled session minting per occurrence（NEW；C-013 实施冻结）

- 每次 admission 为该 occurrence mint 一个 fresh non-main native Session（same Agent、same primary Workspace、same credential/grants），把最终 session id 写入 `nativeSessionId`（evidence only）。
- 任意两个 occurrence 的 native session 必须不同；primary Workspace 必须相同。
- 新 Job schema **不包含** session 选择字段（`sessionTarget` / `sessionKey` 移除；D-007 §3.2 `NEW_JOB_SESSION_SELECTION_FIELDS = NONE`）；`defaultSessionId` 稳定 per-job 路径（`agent:<agentId>:cron:<jobId>`）不再是 admission 使用的 session 来源。
- 不新增 Session Mapping DB；非 main trajectory 不 merge 回 main（D-006 §12）。

### C-032 — CLI / control projection（NEW；D-007 §12 实施冻结）

- domain control surface 保留：`createJob / submitOneShot / updateJob / enableJob / disableJob / deleteJob / listJobs / getJob / readRun/OccurrenceEvidence`，并新增 C-029 `reconcileOccurrence`；write 全部走同一 mutation 协议。
- `agentcore-cron runs` 必须能展示 occurrence 维度：`occurrenceId / runId / state（含 outcome_unknown）/ kind（natural|retry|catchup）/ nominal / admittedAt / startedAt / endedAt / deliveryStatus / lateSettlement / fence 状态`，而不是只展示 job-level status。
- `agentcore-cron list` 展示 per-Job fence 状态与由 ledger 重建的 next/last projection。
- CLI 仍 control-only：不实例化 execution engine、不执行 due jobs、不运行 startup catch-up。
- `enable` 只恢复未来 schedule eligibility：不清除 unknown fence、不补跑 migration history（D-007 §12.3）。

### C-033 — Native store upgrade v1 → v2 and rollback（NEW；D-007 §10/§13.1 实施冻结）

- 首次以 v2 语义打开 store 时，在 mutation lock 内做一次性升级：读取 `version:1`（或 bare array）文档 → 写出 `{version:2, jobs, occurrences: [], fences: {}}`；升级前在同一目录保留一次性备份 `jobs.json.v1.bak`（已存在则不覆盖）。
- 升级必须产出 upgrade report：列出每个 job 的 legacy execution state 处置（strip 明细），特别是带有 `runningAtMs` / in-flight 标记的 job——**不**为其 fabrication occurrence record（无 occurrence identity 可言），strip + report，且相关 Job 不得因升级自动 enable/restore；没有 termination evidence 时不猜测成功或失败。
- 升级后 restart recovery（D-007 §13.1）：已有 occurrence record terminal → 不重放；admitted/running 无 termination proof → `outcome_unknown` + fence；停机期完全无 record 的 slot → 每 Job 每 downtime 至多一个新 catch-up occurrence（`catchUpOfNominalAt` = 最近一个 eligible missed slot），不得对应已有 record、不得绕过 fence。
- 不支持的 version / 损坏文档 → fail loud。
- 回滚：stop scheduler → 恢复 `jobs.json.v1.bak` 为 `jobs.json` → 以旧代码重启；v2 期间产生的 occurrence evidence 以 `runs.jsonl` 与（如需要）人工 export 为准。回滚是 operator 显式动作，不是自动行为。

### C-034 — Import guard and definition-only import mechanics（NEW；D-007 §15.1/§15.2/§15.3 实施冻结）

- import tool 默认 dry-run；写入时若 target store exists OR contains jobs/occurrences 且未显式 `--force` → REFUSE。守卫必须在 mutation lock 内读取 latest target state（无 TOCTOU）。
- `--force` 仅表示 operator 授权 whole-store replacement；使用前必须 stop/drain Control Plane，且仍受 no-catch-up、state-strip、disabled、restore gate 约束；`--force` ≠ auto-enable authority。
- import strip 清单（逐 job report）：`lastRun / lastStatus / runningAt / consecutiveErrors / lastError / retry state / past-due nextRunAt`（execution state）；`sessionTarget / sessionKey`（legacy session fields，含 `main` 或显式稳定 session 意图的 Job 保持 disabled/blocked 直到 migration review 确认新语义）；`wakeMode`、top-level dead `everyMs`、`state.status` 等 dormant fields drop with report；`payload.kind != agentTurn` → BLOCKED / NOT IMPORTED；legacy timeout 字段按 D-007 §3.3 规范化；unknown schedule kind / invalid cron / empty message / missing id/name/agentId / unknown delivery mode → fail loud / gap report。
- source 出现 `runningAt` / in-flight：report 列出 + strip，不迁为 running/admitted truth，不 auto-enable，不猜 outcome。
- 每job 输出 disposition：target Agent、daemon/scheduled、stale、disabled、restore eligibility；不得静默猜测。

### C-035 — Evidence append（NEW；D-007 §11.5 实施冻结）

`runs.jsonl` 至少记录以下事件（含 occurrenceId/runId 坐标）：

```text
occurrence reserved
Router admission attempted / accepted / unknown
turn start evidence
terminal / unknown outcome
delivery outcome
late settlement / reconcile
store upgrade v1->v2
```

- evidence append failure 不得虚假改变 authoritative state，但必须可观察（不得静默吞掉错误）。
- authoritative occurrence commit 失败则本次状态转换失败（RAM 不更新）。

### C-036 — Implementation preconditions gate（NEW；§3.3 契约化）

```text
IMPLEMENTATION_AUTHORITY_AFTER_ACCEPTANCE = contracts
IMPLEMENTATION_ALLOWED_BEFORE_DEPENDENCIES_PASS = NO
```

- Scheduler 实现 PR 必须声明 §3.3 的七项 precondition 全部满足，且其 base 包含 D-006、D-007 与 accepted 的本 Spec（precondition 1/6）。
- 一个 implementation PR 不得实现其他 child（AgentProcess / Notification Ingress / Product API）。
- 本轮（proposed authoring）：无实现、无 store mutation、无 production 变化。

### C-037 — Restore gate in the implementation round（NEW；C-019 实施化）

implementation 完成并 review/fault-tests PASS 前，任何 import/enable 流程必须维持：

```text
READY_TO_RESTORE_BEFORE_HARDENING = 0
```

实现 PR 不得创建、启用或补跑 production jobs；restore 决策是后续独立 owner 行为。

---

### 9.1 State machine（V1 §6 / D-007 §6.1 原样保留）

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
  -> succeeded | failed   # trusted late settlement / reconcile only
  -> NEVER admitted again
```

禁止：`outcome_unknown -> admitted`；`runningAt stale -> clear -> re-admit`；`same occurrence -> second runId`；`same occurrence -> second Router admission`；`unknown fence active -> later same-job occurrence admission`。

Natural next 与 retry occurrence 都是新 identity（不复用旧 key）。Native runtime restart 按 C-033 处置；本 rule 不得用于 OpenClaw migration 的 94 次 missed occurrence。

---

## 10. Acceptance

本轮不实现。未来实现轮必须逐 Contract 产出 contract-by-contract conformance evidence（`SPEC_GOVERNANCE_V0` §11）。每个 ACC 声明 Contracts / Method / Environment / Expected / Failure condition；环境为单机 fault-injection 测试环境 + dedicated test app（不使用 production store）。

### ACC-001 — Timeout → outcome_unknown

- Contracts: C-001, C-012, C-025
- Method: fault injection `TIMEOUT_DURING_ACTIVE_TURN` / `TIMEOUT_BEFORE_TURN_START`（injected clock 越过 `executionDeadlineAtMs`）
- Expected: occurrence state = `outcome_unknown`；无 ordinary-error backoff；排队等待不触发执行超时
- Failure: 任何 timeout 被写成 `failed`/error 或进入 retry backoff

### ACC-002 — Same-occurrence prohibition

- Contracts: C-002
- Method: unknown 后触发 tick/restart/CLI；断言无 retry occurrence、无 re-admission、无第二 runId
- Failure: 同 occurrence 出现第二个 runId 或第二次 Router call

### ACC-003 — Unknown execution fence

- Contracts: C-003, C-028
- Method: `UNKNOWN_FENCES_LATER_SAME_JOB_OCCURRENCE`：unknown 未解析期间，后续 natural slot admission 数 = 0；fence 期间 slot 不积压；late settlement / reconcile 后从下一个 future natural occurrence 恢复
- Failure: fence 期间出现同 Job 新 admission，或解除后自动补跑积压 slot

### ACC-004 — failed 类型分离与 delivery 分离

- Contracts: C-004
- Method: pre-start rejection（AGENT_NOT_FOUND/AGENT_DISABLED 预检）→ `failed`（pre-start）；terminal failure + termination evidence → `failed`；delivery throw 不改变 `succeeded` execution outcome（deliveryStatus 独立）
- Failure: delivery 失败把 execution 改写为 failed；或无 termination proof 的失败被写成 failed

### ACC-005 — Stable identity across restart

- Contracts: C-005, C-023
- Method: restart / tick 重入 / CLI 并发 mutation / timezone 重算后重算同一 nominal slot
- Expected: 同一 `(jobId, scheduleRevision, nominal)` 得到同一 occurrenceId；无第二 id
- Failure: 同一 logical slot 产生两个 record/id

### ACC-006 — Durable states & state machine

- Contracts: C-006, C-027
- Method: 全转换矩阵 + 非法转换拒绝（含 `outcome_unknown -> admitted`）+ history append 校验
- Failure: 任何非法转换被接受，或 history 缺失

### ACC-007 — Reserve-before-Router crash points

- Contracts: C-007, C-026
- Method: `RESTART_AFTER_ADMITTED_BEFORE_ROUTER` / `RESTART_AFTER_ROUTER_BEFORE_RECEIPT`（reserve 与 Router call 之间、call 与 receipt 之间注入 crash）
- Expected: recovery = `outcome_unknown` + fence；不 re-admit；接受漏执行
- Failure: recovery 后同 occurrence 再次进入 Router

### ACC-008 — At-most-once admission

- Contracts: C-008
- Method: `CONCURRENT_DUE_TICKS_SAME_OCCURRENCE` + startup recovery 并发 + CLI mutation 并发 + 迟到 callback 注入
- Expected: 每 occurrence Router admission call count ≤ 1；same key + same payloadHash 返回既有状态、无 second enqueue；same key + different payloadHash → conflict fail loud
- Failure: 任何路径产生第二次 admission

### ACC-009 — Retry = new occurrence

- Contracts: C-009
- Method: `ORDINARY_FAILED_RETRY_NEW_OCCURRENCE`：ordinary failed 命中显式 policy → 新 occurrenceId/runId/key + `retryOfOccurrenceId`；`OUTCOME_UNKNOWN_NO_RETRY`：unknown 不创建 retry occurrence
- Failure: retry 复用旧 identity，或 unknown 产生 retry

### ACC-010 — Abort ≠ terminated

- Contracts: C-010
- Method: `ABORT_SENT_WITHOUT_TERMINATION`：AbortSignal 发出且无 termination ack
- Expected: `outcome_unknown`；原 turn 若完成 → late settlement 记录（不 second admission）
- Failure: abort 观察即宣称 cancel 成功 / 写 terminal failed

### ACC-011 — Late settlement

- Contracts: C-011
- Method: `LATE_SUCCESS_AFTER_TIMEOUT` / `LATE_FAILURE_AFTER_TIMEOUT` / `LATE_EXTERNAL_SIDE_EFFECT_AFTER_TIMEOUT`（timeout 后注入迟到 terminal / external-effect evidence）
- Expected: 按 `(occurrenceId, runId)` 追加记录、可审计、可把 unknown 解析为 succeeded/failed；无 second admission
- Failure: 迟到 evidence 被丢弃，或触发二次执行

### ACC-012 — Timeout clock

- Contracts: C-012, C-025
- Method: 人为制造 concurrency 排队（未 admission）+ admitted 未 start 两个窗口
- Expected: 排队时间不计入执行超时；deadline 自 admittedAt 起算并持久化；admitted 后无法证明 queued removal → unknown
- Failure: 排队等待被记为 execution timeout，或 deadline 不在 reserve 中持久化

### ACC-013 — Fresh non-main Session per occurrence

- Contracts: C-013, C-031
- Method: `FRESH_SESSION_PER_OCCURRENCE`：连续两个 occurrence 执行
- Expected: native session 不同、primary Workspace 相同、trajectory 隔离；`agent:<agentId>:cron:<jobId>` 不再是 session 来源；新 Job schema 无 session 选择字段
- Failure: 任两 occurrence 复用 session，或 admission 读取 sessionTarget/sessionKey

### ACC-014 — Migration no catch-up

- Contracts: C-014, C-034
- Method: `MIGRATION_NO_CATCH_UP`：以 audit fleet 副本 dry-run + 隔离 store 写入
- Expected: 94 missed occurrence replay = 0；recurring 从 activation 后 future natural slot 开始
- Failure: 任何 missed occurrence 被转换成立即执行/补跑

### ACC-015 — Missing Agent ID blocked

- Contracts: C-015, C-034
- Expected: 3 个无 Agent ID job = BLOCKED，无模糊匹配/default Agent 绑定

### ACC-016 — Stale one-shots not imported

- Contracts: C-016
- Expected: 过去 at target 保持 DO_NOT_IMPORT，不转为 now

### ACC-017 — Disabled keep disabled

- Contracts: C-017
- Expected: strip/defaulting 不自动 enable

### ACC-018 — Daemon out of scheduler

- Contracts: C-018
- Expected: 3 个 daemon job 不进入 Scheduler，由独立 owner 处置

### ACC-019 — Restore gate

- Contracts: C-019, C-037
- Expected: implementation review/fault tests PASS 前 restore count = 0；NON_IDEMPOTENT_SIDE_EFFECT / RECORDING_OR_REMINDER 不 auto-enable

### ACC-020 — Authority disposition intact

- Contracts: C-020
- Method: 静态核验 V1↔V2 supersession metadata 仅在 acceptance transaction 中原子变化；D-005 superseded-by-D-007 状态未被触碰
- Failure: 出现并行 current authority 或 V1 被提前修改

### ACC-021 — Store layout & fail-loud

- Contracts: C-021
- Method: `CORRUPT_OCCURRENCE_STORE_FAIL_LOUD`（损坏/未知 version 文档）+ jobs key 语义保持（definition 字段与写入协议不变）
- Expected: fail loud（不当空 store）；单一 mutation authority；runs.jsonl 非 authority（轮转后 terminal/unknown state 仍在 state document）
- Failure: 损坏文档被静默清空，或出现第二写路径

### ACC-022 — Record schema round-trip

- Contracts: C-022
- Method: 全字段 reserve/transition/settlement round-trip + 未知字段策略验证 + authority 字段缺失 fail loud
- Failure: authority 字段可被省略/替代

### ACC-023 — Identity derivation determinism

- Contracts: C-023
- Method: 同 slot 跨 restart/tick 重算；重复插入拒绝；retry 链（A→B→C）id 唯一
- Failure: 派生不稳定或重复 id 被接受

### ACC-024 — payloadHash conflict

- Contracts: C-024
- Method: same key + 不同 payload 写回 → conflict fail loud（结构化错误，非静默覆盖）
- Failure: 任何 mismatched-hash 写回被接受

### ACC-025 — Deadline persistence

- Contracts: C-025（与 ACC-012 联合覆盖）

### ACC-026 — Reserve atomicity under concurrency

- Contracts: C-026
- Method: 并发 due ticks + CLI disable 竞态 + fence active 时 due slot
- Expected: 每 slot 至多一条 admitted record；disable 不撤销已 admitted occurrence 且其 outcome 仍记录；fence active 时 reserve 被拒绝
- Failure: torn admission view（existence 检查与写入分离导致双 admission）

### ACC-027 — Writeback keyed by occurrence

- Contracts: C-027
- Method: invocation 期间并发 updateJob/disableJob/deleteJob；terminal 写回
- Expected: Job mutation 不被回滚；已删 Job 的 terminal evidence 持久且 Job 不复活；disabled Job 不生成下一 occurrence
- Failure: late completion 覆盖并发 Job mutation 或复活 Job

### ACC-028 — Fence projection rebuild

- Contracts: C-028
- Method: `PROJECTION_REBUILD_FROM_OCCURRENCE_LEDGER`：删除 fences map 与全部 Job.state summary 后重建
- Expected: 重建结果与原值一致；重建不触发任何 admission
- Failure: projection 不可重建或重建引发 admission

### ACC-029 — Operator reconcile

- Contracts: C-029
- Method: `OPERATOR_RECONCILE_RESOLVES_FENCE`：reconcile unknown occurrence → resolvedTo + evidence + fence 解除 + history 留痕；对非 unknown record 的 reconcile 请求被拒绝
- Expected: 不 re-admit、不删 history、不自动生成 retry；audit evidence 完整
- Failure: reconcile 被用于重放执行或清除审计痕迹

### ACC-030 — Legacy state demotion

- Contracts: C-030
- Method: 代码审查 + fault：制造「state summary 缺失/过期」场景，断言 admission 判定不受影响；2h stuck-clear 重跑路径不存在
- Failure: 任何 admission/no-dup/termination 判定读取 legacy state 字段

### ACC-031 — Session minting & legacy fields

- Contracts: C-031（与 ACC-013 联合覆盖；含 importer strip sessionTarget/sessionKey 验证）

### ACC-032 — CLI projection

- Contracts: C-032
- Method: `agentcore-cron runs/list` 输出核验（occurrenceId/runId/state/kind/fence 可见）；CLI 不实例化 engine（静态+运行核验）
- Failure: runs 仅展示 job-level status，或 CLI 可执行 job

### ACC-033 — Store upgrade v1→v2 + rollback

- Contracts: C-033
- Method: `STORE_UPGRADE_V1_TO_V2`：构造 v1 store（含 runningAtMs in-flight job）→ 升级 → 断言 `{version:2,...}`、`.v1.bak` 存在、in-flight strip + report、无 fabricated occurrence；恢复备份回滚可用；restart recovery 按 D-007 §13.1（catch-up 每 Job 每 downtime ≤1）
- Failure: 升级伪造 occurrence / 遗漏备份 / in-flight 被当作 authority

### ACC-034 — Import guard

- Contracts: C-034
- Method: existing-store（无 --force）→ REFUSE；--force 前 stop/drain 纪录；strip/report 完整性
- Failure: 守卫 TOCTOU 或 force 绕过 no-catch-up/state-strip

### ACC-035 — Evidence append

- Contracts: C-035
- Method: 使 runs.jsonl 写失败（只读/满）→ 状态转换仍成功但错误可观察；使 authoritative commit 失败 → 转换失败且 RAM 不变
- Failure: evidence 失败被静默吞掉，或 commit 失败却更新 RAM

### ACC-036 — Preconditions gate

- Contracts: C-036
- Method: 实现 PR 元数据核验（§3.3 七项：含本 Spec accepted+merged、AgentProcess implementation-authorizing V2 accepted+merged+PASS、Notification Ingress spec accepted+merged+PASS、base 包含 D-006/D-007）+ PR 范围审查（无跨 child 实现）
- Failure: 依赖未过门即开工，或 PR 混入其他 child 实现

### ACC-037 — Restore gate (implementation round)

- Contracts: C-037（与 ACC-019 联合覆盖；实现 PR 不创建/启用/补跑 production jobs）

### 10.1 Fault-injection matrix（V1 §11 matrix 完整保留 + 扩展）

```text
TIMEOUT_BEFORE_TURN_START
TIMEOUT_DURING_ACTIVE_TURN
ABORT_SENT_WITHOUT_TERMINATION
UNKNOWN_FENCES_LATER_SAME_JOB_OCCURRENCE
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
# ── V2 新增（store / projection / control 面）──
STORE_UPGRADE_V1_TO_V2
CORRUPT_OCCURRENCE_STORE_FAIL_LOUD
CONCURRENT_CLI_DISABLE_DURING_ADMITTED_OCCURRENCE
PROJECTION_REBUILD_FROM_OCCURRENCE_LEDGER
OPERATOR_RECONCILE_RESOLVES_FENCE
PAYLOAD_HASH_CONFLICT
IDEMPOTENT_KEY_SAME_PAYLOAD_NO_SECOND_ENQUEUE
FENCE_RELEASE_NO_BACKLOG_REPLAY
```

每个 matrix 条目必须映射到至少一个 ACC，并在实现 PR 的 Conformance Record 中给出 exact commit / environment / command / result evidence。Kernel change = none 必须保持。

---

## 11. Alternatives and disposition

V1 §10 全部保留（逐条重申），另加本 Spec 新决策的被拒替代：

### timeout = failed — 拒绝
停止等待不证明 turn / external effect 停止。

### timeout 后相同 occurrence retry — 拒绝
可能与原 turn 重叠或顺序重复副作用。

### stale marker 固定时间后清除 — 拒绝
时间流逝不是 termination proof（`STUCK_RUN_MS` 2h 清除路径废除）。

### unknown 时允许下一自然 occurrence — 拒绝
原 turn 可能仍活着；必须 same-job fence，解除后从未来 slot 继续，不补积压。

### stable per-job Session — 拒绝
违反 D-006 per-execution fresh Session。

### Session Mapping DB — 拒绝
occurrence evidence 记录本次 native Session；不创建第二 Session authority。

### 补跑 94 次 missed occurrence — 拒绝
fleet 主要为非幂等副作用，历史 outcome 不可靠。

### amendment D-005 / amendment V1 — 拒绝
normative meaning / authority 实质变化，必须完整 supersession（D-007 已完成 D-005；本 Spec 完成 V1）。

### occurrence store 选项 2（独立 versioned occurrence document）— 拒绝
需要第二把跨进程锁与跨文件提交顺序；admission 视图可能在两锁间隙被撕裂；与「单机最小持久化」无收益（DEC-SCH-003）。

### `runs.jsonl` 作为 occurrence authority — 拒绝（D-007 §10.2 明令）
append-only 有界日志会因容量轮转丢失 authority；只能作 evidence。

### 随机 mint occurrence identity — 拒绝
restart 后不可复现；确定性派生从机制上保证 at-most-once（DEC-SCH-004）。

### 自动/隐式 reconcile（超时 N 分钟后自动解析 unknown）— 拒绝
时间流逝不是 evidence；只有 trusted late evidence 或 operator 显式 reconcile。

### 把 legacy `runningAtMs` 升级为 occurrence record — 拒绝
无 occurrence identity 可言；fabrication 违反 LEGACY_EXECUTION_STATE_AUTHORITY = NONE（C-033）。

### fence 独立持久 store — 拒绝
制造第二 authority；fence 是 ledger 的 derived projection（DEC-SCH-005）。

---

## 12. Migration, compatibility, and rollback

- **本轮**：docs-only。无 store 变化、无 production 变化、无代码变化。V1 在本 Spec acceptance 前保持 active authority。
- **Authority 迁移**：按 §3.2 原子 supersession transaction；backlinks 同一 commit 内完成；Decision index / D-006 / D-007 零改动。
- **Store 迁移（实现轮）**：按 C-033（v1→v2 in-lock 升级 + `.v1.bak` + report + fail loud + operator 回滚步骤）。production store 当前 0 jobs（STATE-SCH-001），升级影响面在实现轮以 dedicated test store 验证。
- **兼容**：Job definition 字段语义与 exact 持久化协议不变（jobs key、tmp+fsync+rename、fail-loud）；`toPublicJob`/CLI 输出向后兼容地扩展（新增 occurrence 维度，不删除既有字段）；`agentcore-cron` 六个子命令保留。
- **Rollback（实现轮）**：store 层恢复 `.v1.bak` + 旧代码；authority 层若实现发现 Contract 缺口，按 `SPEC_GOVERNANCE_V0` §10 停止 → 报告 → 独立 docs-only 变更 → 重启实现。
- **Restore gate**：C-019/C-037 冻结；restore 决策是 gate 全过后的独立 owner 行为。

---

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

非 normative 的实现级自由度（不改变 Decision/Contract meaning，实现 PR 内决定并过 review）：identity 字符串拼接的具体编码、`history` 条目的字段命名、CLI 输出格式、备份文件命名细节。

---

## 14. Final Output

```text
SPEC_ID = SCHEDULER_TIMEOUT_OUTCOME_V2
SPEC_STATUS = proposed
SPEC_KIND = implementation
IMPLEMENTATION_AUTHORITY = contracts（accepted 且进入 main 后生效）
REPLACES_ON_ACCEPTANCE = SCHEDULER_TIMEOUT_OUTCOME_V1
SUPERSEDES = []（acceptance transaction 时原子置为 [SCHEDULER_TIMEOUT_OUTCOME_V1]）

SEMANTIC_DELTA_VS_V1 = NONE
C001_TO_C020_DISPOSITION = PRESERVED_VERBATIM_MEANING
D007_SEMANTICS_CHANGE = NONE
D006_SEMANTICS_CHANGE = NONE

TIMEOUT_OUTCOME = outcome_unknown
RETRY_AFTER_OUTCOME_UNKNOWN = FORBIDDEN_FOR_SAME_OCCURRENCE
UNKNOWN_EXECUTION_FENCE = SAME_JOB_NO_FURTHER_ADMISSION_UNTIL_RESOLVED
OCCURRENCE_IDENTITY = STABLE_DETERMINISTIC_PER_LOGICAL_OCCURRENCE
DURABLE_EXECUTION_STATES = admitted,running,succeeded,failed,outcome_unknown
SAME_OCCURRENCE_ADMISSION = MUST_NOT_ENTER_ROUTER_TWICE
CANCEL_REQUESTED_VS_TERMINATED = DISTINCT
SCHEDULED_SESSION_MODEL = FRESH_NON_MAIN_PER_EXECUTION_SAME_AGENT_PRIMARY_WORKSPACE

OCCURRENCE_AUTHORITY_STORE = SINGLE_VERSIONED_STATE_DOCUMENT_V2_JOBS_PLUS_OCCURRENCES
OCCURRENCE_STORE_COMMIT = SAME_MUTATION_PROTOCOL_TEMP_FSYNC_ATOMIC_RENAME
RUN_EVIDENCE = APPEND_ONLY_BOUNDED_RUNS_JSONL_DEFAULT_10MB_NOT_AUTHORITY
LEGACY_EXECUTION_STATE_AUTHORITY = NONE
LEGACY_JOB_STATE_ROLE = DERIVED_REBUILDABLE_PROJECTION_ONLY
FENCE_PERSISTENCE = DERIVED_PROJECTION_ATOMIC_WITH_TRANSITIONS

MIGRATION_CATCH_UP_POLICY = NO_CATCH_UP
MISSING_AGENT_ID_JOBS = BLOCKED
STALE_ONE_SHOTS = DO_NOT_IMPORT
DISABLED_JOBS = KEEP_DISABLED
DAEMON_JOBS = OUT_OF_SCHEDULER
READY_TO_RESTORE_BEFORE_HARDENING = 0

IMPLEMENTATION_AUTHORITY_AFTER_ACCEPTANCE = contracts
IMPLEMENTATION_ALLOWED_BEFORE_DEPENDENCIES_PASS = NO
IMPLEMENTATION_PRECONDITIONS =
  1_SCHEDULER_V2_ACCEPTED_AND_MERGED
  2_AGENTPROCESS_IMPL_AUTHORITY_V2_ACCEPTED_AND_MERGED
  3_AGENTPROCESS_IMPLEMENTATION_PASS
  4_NOTIFICATION_INGRESS_IMPL_SPEC_ACCEPTED_AND_MERGED
  5_NOTIFICATION_INGRESS_IMPLEMENTATION_PASS
  6_BASE_CONTAINS_D006_D007
  7_CONTRACT_BY_CONTRACT_FAULT_TEST_PLAN_COMPLETE

KERNEL_CHANGE = NONE
PRODUCT_CODE_CHANGE_THIS_ROUND = NONE
PRODUCTION_JOB_CHANGE_THIS_ROUND = NONE
SCHEDULER_STORE_CHANGE_THIS_ROUND = NONE
MISSED_RUN_REPLAY_THIS_ROUND = NONE
DEPLOYMENT_THIS_ROUND = NONE
MERGE = NO（Draft PR only；不 accepted）

CURRENT_ACTIVE_AUTHORITY_UNTIL_ACCEPTANCE = SCHEDULER_TIMEOUT_OUTCOME_V1 + D-007
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
NEXT_TASK = 超时 审计
```
