# SCHEDULER_SELF_HEALING_REAL_EVENT_ACCEPTANCE_V2 — real-event acceptance packet (frozen, one-click re-freeze)

Status: `ACCEPTANCE_PACKET_READY` — frozen for Owner/business authorization. This packet is
docs-only; freezing it performed ZERO production mutation, sent ZERO Feishu events, created or
modified ZERO scheduler jobs, deployed/restarted NOTHING, and touched NO credential or durable
store. Execution requires the fresh authorization in §10 (nothing is inherited — not from V1, not
from any prior attempt).

Packet id: `SCHEDULER_SELF_HEALING_REAL_EVENT_ACCEPTANCE_V2` (supersedes V1
`docs/evidence/scheduler-self-healing-real-event-acceptance-packet-v1-20260925/`, freeze commit
`88866df7`, which is STALE against the current generation per `mayf3/agent-control#441`).
Freeze head: branch `docs/selfops-v4-acceptance-refreeze-20261006` (from `origin/main` `4a666777`).
Live-byte binding + target evidence: `LIVE_BYTES_REFREEZE_20261006.md` in this directory (§refs
below are to that file unless noted).

Governing accepted authorities (sha-pinned in LIVE_BYTES §0):
`SCHEDULER_SELF_HEALING_FROM_FEISHU_V1`, `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4`,
`PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`, `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1`,
`AGENT_CORE_SCHEDULER_RUN_HISTORY_V1`, decision `SCHEDULER_OCCURRENCE_OUTCOME_V3` (D-009,
successor of D-007).

The execution is a bounded four-leg sequence, executed strictly in order, each leg gated on the
previous one's frozen outcome. No leg may be skipped, reordered, forced, or retried inside this
authorization.

## 1. TARGET_SCENARIO (exact, lowest-risk, freshly re-identified 2026-10-06)

Primary target bot: **「3D打印专家 - 生活」(agent `agt_3d-print-agent`, authsvc principal
`ed55e35c-f0a1-43fe-a2db-f6b7c45b7005`, ACTIVE per fresh authsvc directory readback)**, and its
own real recurring daily job at **10:00 Asia/Shanghai**.

```text
IDENTITY (fresh)  = authsvc directory readback 2026-10-06: agt_3d-print-agent ACTIVE (LIVE_BYTES §3).
REAL OWNED JOB    = the bot's own Feishu announcement of record (2026-09-24 10:04, screenshot of
                    record re-verified 2026-10-06): 「已设置每日 10:00 (Asia/Shanghai) 自动任务」.
                    Current existence is re-confirmed in-window by the bot's own self_ops.status
                    (NO_OWNED_SCHEDULER_JOB otherwise). This packet creates no job.
ZERO SIDE EFFECT  = LEG-1 and LEG-2 are read-only by product contract (self_ops.status /
                    job_disposition are pure diagnosis surfaces; job_disposition is caller-scoped
                    and zero-write). LEG-3 is CONDITIONAL (§5) and expected to resolve
                    NO_REAL_RECOVERY_CANDIDATE for a healthy job. LEG-4 observes the job's own
                    NEXT NATURAL slot — no synthetic slot, no run-now, no forcing.
NATURAL SLOT      = the same real job provides the natural due slot for LEG-4 (next natural fire
                    10:00 +08:00 after LEG-2 completes) — never earlier, never forced.
```

FORBIDDEN target and coordinates, without exception: 「HR助手 - 管理」 — no message, no prompt
canary, and no HR job/occurrence/fence may be used, referenced, or reconciled (conservative
carry-over of the V1 rule; the HR lane is independent and stays untouched).

ATTEMPTS = 1: one authorization covers exactly LEG-1's single elevated readback, the two messages
in §4/§6 to this one target, and the conditional replay proof of §5. If any leg ends
UNKNOWN/FAILED, record and stop; a retry, a forced slot, or a different target bot needs a FRESH
authorization. Do not pick alternates ad hoc.

## 2. Pre-check (read-only, run immediately before LEG-1; abort on drift)

```sh
cd /usr/local/libexec/agent-core/app &&
for f in packages/scheduler/src/eligibility.js packages/scheduler/src/occurrence.js \
         packages/scheduler/src/scheduler.js packages/scheduler/src/store.js \
         packages/scheduler/src/self-ops/diagnosis.js packages/scheduler/src/self-ops/index.js \
         packages/scheduler/src/watchdog/admission-isolation.js \
         packages/broker/src/capabilities/self-ops.js packages/broker/src/gateway.js \
         packages/broker/src/registry.js \
         packages/broker/src/capabilities/workflow.js; do shasum -a 256 "$f"; done
launchctl print system/ai.agent-core.runtime | grep -E "state = |pid = |last exit code"
curl -fsS --max-time 5 http://127.0.0.1:8790/health; echo
curl -fsS --max-time 5 http://127.0.0.1:8788/health; echo
```

Expected: the eleven hashes equal §1 of `LIVE_BYTES_REFREEZE_20261006.md` (ten V2-bound files +
`workflow.js` `ed96a4c9…` generation canary); `state = running` with pid 64187 — if a different
pid appears, re-run the hash loop and require ALL eleven hashes to still equal the table (any
byte drift → STOP; a pid change with identical bytes is recorded, not failed); both healths ok.
ANY byte drift → STOP, record `GENERATION_DRIFT`, execute nothing (the packet stays frozen; a
fresh re-freeze is required).

## 3. LEG-1 — read-only elevated identity/tool-list readback (closes the #441 authsvc/root-gated gap)

Performed ONCE, after §2 passes, by the elevated reader NAMED in §10 (authsvc-user session or
Owner-directed root; the executor lane itself stays unprivileged). All reads are read-only:

```text
R1a jobs.json    — the single target job's entry (job id, schedule, enabled, nextRunAtMs) for
                   agt_3d-print-agent; plus a count summary only. Record the exact job id.
R1b runs.jsonl   — the tail for that job only: the latest occurrence/invocation/outcome records
                   (ids, timestamps, durable states/reasons), bounded to the last 10 entries.
R1c watchdog     — launchctl print system/ai.agent-core.scheduler-watchdog-w1 / -w2: last exit
                   code and recent kick evidence (firing liveness).
R1d tool list    — the REAL live-turn model tool list from runtime turn logs: self_ops PRESENT
                   with actions EXACTLY {status, reconcile_turn, job_disposition} (assert the
                   exact V4 names, not substrings), scheduler still present, and the
                   infrastructure-hidden tool agent_session_send_reconcile ABSENT.
```

LEG-1 = PASS iff R1a–R1d are captured and consistent (job exists, enabled, next natural slot in
the future; tool list matches the V4 regression predicates). If the live-turn log is unreadable
root-side, record the capture attempt + the explicit §10 waiver (V1 M1 leg-B #2 precedent) — the
leg-2/leg-4 bot replies then carry the in-window self_ops proof instead. ANY anomaly (job missing
or disabled, nextRunAtMs not in the future, tool list mismatch) → LEG-1 = FAIL, record, STOP —
no repair, no enablement, no restart from this packet.

## 4. LEG-2 — real diagnosis (message 1 of 2, send from the Owner's real Feishu account to the target bot)

Send verbatim (the Owner's own 2026-09-24 protocol wording carried verbatim from V1 with exactly
ONE execution-mechanics addition — the idempotency-replay clause — plus the three bracketed guard
clauses; unchanged from V1's frozen message):

```text
SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 真实业务验收：请仅以当前 owning Agent 身份使用正式 self_ops。
先执行 self_ops.status, 并对你自己的 Scheduler jobs 执行 self_ops.job_disposition。
如果且仅如果 diagnosis 明确返回 recoveryEligibility=SELF_RECONCILE_AVAILABLE：选择一个最新且坐
标明确的自有候选，记录 jobId/occurrenceId/runId、classification、lastProvenStage、
firstMissingStage、globalSchedulerHealth、jobLocalHealth、fenceStatus；然后只执行一次
self_ops.reconcile_turn(jobId, occurrenceId, runId)。收到 receipt 后，在同一 turn 内用完全相同
的 jobId/occurrenceId/runId 再执行一次 self_ops.reconcile_turn 作为幂等验证：应返回与首次
byte-equivalent 的 receipt 且零二次写；该验证仅在首次已返回 receipt 时执行，且仅此一次，
不是重试。然后用 self_ops.status + self_ops.job_disposition readback，返回 operationId、
fenceBefore/fenceAfter、committedAt、evidenceRef 以及恢复后的 eligibility/health。
如果不存在真实可恢复候选：不要执行 recovery，明确回复 NO_REAL_RECOVERY_CANDIDATE 并给出 diagnosis。
[守卫1] 若你名下没有 Scheduler job：回复 NO_OWNED_SCHEDULER_JOB，不要创建、修改或补跑任何 job。
[守卫2] 不得触碰 HR助手 的任何 job/occurrence；除上述条件分支外不得执行任何写操作。
[守卫3] 任何工具失败或证据不足：如实回复失败与分类，不要重试、不要伪造结果。
最终请给出 REAL_FEISHU_DIAGNOSIS=PASS|FAIL、REAL_RECOVERY_EXECUTED=YES|NO、
REAL_RECOVERY_ACCEPTANCE=PASS|FAIL|NOT_APPLICABLE，以及实际调用的 self_ops actions。
```

Expected tool-call sequence (all via the model-visible self_ops surface, live manifest
`e7f6105d…` registered `9dab1da6…`; identity comes from the Runtime's trusted callerAgentId,
never from the model):

```text
1. self_ops(action=status)                                   — enumerate OWN jobs + runtime health
2. self_ops(action=job_disposition, job_id=<owned-real-job>) — accepted §3 disposition fields:
   scheduleRevision/retryState/classification?/lastProvenStage/firstMissingStage/
   globalSchedulerHealth/jobLocalHealth/recoveryEligibility
3. [ONLY IF recoveryEligibility=SELF_RECONCILE_AVAILABLE — this is LEG-3, §5]
   self_ops(action=reconcile_turn, job_id, occurrence_id, run_id) — EXACTLY ONE recovery call,
   then — only after a receipted commit — EXACTLY ONE same-coordinate idempotency-replay call
   (byte-equivalent receipt, zero second write; not a retry)
4. self_ops(action=status) + self_ops(action=job_disposition, job_id) — readback
```

Timeout: no bot reply within 30 min → UNKNOWN → record + stop (no resend). A delivery-failure
reply (any `[agent-core] delivery failed: …`) → FAILED → record + stop. No second message to the
bot under this authorization except §6.

Diagnosis-vocabulary rule (frozen): the live diagnosis surface is one line behind `origin/main`
(missing only `restart_quiescence_proven`, LIVE_BYTES §2). Any disposition whose live
classification would correspond to a restart-quiescence state is treated as
evidence-insufficient → fail-closed (LEG-2 diagnosis stands, LEG-3 not eligible, record + stop
for the affected coordinate). No favorable interpretation, no store inspection to "complete" it.

## 5. LEG-3 — conditional exactly-once receipted recovery (existing accepted authority only)

Outcome map for the recovery branch of message 1 (frozen semantics, unchanged from V1 §4):

```text
Reply reports diagnosis fields + NO recovery performed
  → REAL_FEISHU_DIAGNOSIS=PASS, REAL_RECOVERY_EXECUTED=NO,
    REAL_RECOVERY_ACCEPTANCE=NOT_APPLICABLE (fail-closed; zero mutation).
    LEG-3 closure under NOT_APPLICABLE requires the explicit Owner pre-ruling in §10 (option B) —
    a synthetic stuck occurrence to force a recovery candidate is FORBIDDEN (it would itself be a
    production mutation).
Reply executes exactly one reconcile_turn + receipt + readback
  → REAL_FEISHU_DIAGNOSIS=PASS, REAL_RECOVERY_EXECUTED=YES,
    REAL_RECOVERY_ACCEPTANCE=PASS iff persisted receipt fields are complete
    (operationId/fenceBefore/fenceAfter/committedAt/evidenceRef) AND same-coordinate replay is
    byte-equivalent with zero second write (the one in-turn replay of §4 is authorized for this
    proof only).
Reply executes recovery but the receipt is incomplete OR the replay is not byte-equivalent OR a
    second write is observed
  → REAL_RECOVERY_ACCEPTANCE=FAIL, record evidence, stop (no correction attempt in-window).
Reply = NO_OWNED_SCHEDULER_JOB → coordination failure for THIS target → record + stop.
Any fabricated/uncited output, any write outside the conditional branch, any HR touch
  → ACCEPTANCE=FAIL, record evidence, stop.
```

The reconcile settlement, when it executes, is the product's own receipted business-data write on
the formal surface (self_ops `reconcile_turn`, accepted Specs V3/V4 + self-healing §4; idempotent
by deterministic `operationId` = derive(callerAgentId, occurrenceId, runId)) — it is the ONLY
production effect this packet can produce, it uses EXISTING accepted authority only (no new
surface, no parallel path, no manual store edit), and it has NO cleanup/rollback step by design;
post-hoc disagreement with a committed settlement is a new Owner decision, never an in-window undo.

## 6. LEG-4 — NEXT NATURAL due slot observation (message 2 of 2)

Window: the FIRST NATURAL fire of the target job after LEG-2 completes — expected the next
10:00 +08:00. The slot must occur naturally: **no run-now, no force-next-run, no schedule edit,
no catch-up trigger, no restart to induce it** (§7 F1/F4). The readback message may be sent
between T+0 and T+90 min after that natural fire. If LEG-2 diagnosed the job as
disabled/unhealthy, skip §6 and record LEG-4 = UNKNOWN.

```text
请仅用正式工具面报告你名下每日 10:00 任务最近一次自然 slot 的结果：occurrence/invocation/outcome
的持久证据（id、时间、状态、durable reason），以及你判断该 slot 正常完成或未运行的依据。不要修改
任何 job，不要补跑。
```

PASS criterion (LEG-4, all four must hold on the reply's cited durable evidence, consistent with
LEG-1's R1b tail and LEG-2's diagnosis):

```text
DURABLE ACCOUNTING   = the natural slot has a persisted occurrence with invocation + outcome
                       (run-history / scheduler surfaces; ids, timestamps, durable reason).
EXACTLY-ONCE         = exactly ONE occurrence admitted for that slot coordinate — no duplicate
                       admission, no duplicate work (at-most-once admission).
NO UNKNOWN REPLAY    = no outcome_unknown coordinate was re-executed; unresolved unknowns remain
                       fenced (fail-closed), with any fence state reported honestly.
NO DUPLICATE         = the bot reports no second/complementary run for the same slot, and the
                       reply itself performs zero writes.
No reply in 30 min   → UNKNOWN → record + stop.
```

## 7. Forbidden mutations (binding for every participant)

```text
F1  No scheduler job create/modify/pause/resume/delete/retry — and explicitly NO run-now, NO
    force-next-run, NO schedule/time edit, NO synthetic or catch-up slot for LEG-4 (or any leg).
F2  No HR-agent message, prompt, or use of any HR job/occurrence/fence — no exceptions in this
    packet.
F3  No fabricated Feishu sender, no webhook/event replay, no binding bypass; only a real Feishu
    DM from the Owner's account to the target bot produces acceptance evidence. Direct broker/
    runtime self_ops invocations during the window are NOT acceptance evidence.
F4  No raw store edit, fence clearing, PID kill, signal, runtime restart, redeploy, reload, no
    sudo or any other privileged mutation beyond LEG-1's named read-only reader, and no
    production-mutex acquisition — by the executor or by any "helper" lane.
F5  No secret scraping; no credential mutation or reauthentication; no authsvc write of any kind.
    LEG-1's elevated reads are READ-ONLY and use the named authorized reader only.
F6  No mutation of the eleven live files (§2) or any deployed byte.
F7  No UNKNOWN replay: an unresolved unknown stays fenced; no manual reconcile of an
    unproven coordinate, no log-derived "help" for a fenced occurrence.
    PRODUCTION_MUTATION ceiling = the single conditional receipted reconcile settlement of §5,
    nothing else.
```

## 8. Receipt / recording

The executor records into a new evidence dir
`docs/evidence/scheduler-self-healing-real-event-acceptance-v2-results-<date>/`:

```text
R1 §2 pre-check output + timestamp + operator (before LEG-1) and re-run after LEG-2 and after
   §6 (generation no-drift readback; eleven files + pid + health). Drift → record
   DEPLOYED_WITH_GENERATION_DRIFT, never silent.
R2 LEG-1 captures R1a–R1d verbatim (read-only), with reader identity + timestamp.
R3 Feishu screenshots (Owner-side, user-visible) + verbatim bot reply text for both messages.
R4 the four outcome fields (REAL_FEISHU_DIAGNOSIS / REAL_RECOVERY_EXECUTED /
   REAL_RECOVERY_ACCEPTANCE / LEG-4 result) + actual self_ops actions observed in replies.
R5 attempt-ledger entry (authorization id, legs executed, messages sent, outcomes,
   STOP/UNKNOWN reasons).
```

Closure: `BUSINESS_ACCEPTED=YES` may be recorded only when LEG-1 ∧ LEG-2 ∧ LEG-4 PASS and LEG-3
is PASS or NOT_APPLICABLE WITH the explicit §10 Owner pre-ruling — plus final no-drift readback
and the R2 tool-list capture (or its §10 waiver). Until closure, BUSINESS_ACCEPTED stays NO.

## 9. UNKNOWN / fence rules

Any of: generation drift, delivery failure, timeout (30 min), tool refusal, unreadable reply,
fence (`AGENT_PROCESS_TURN_FENCED` or similar), scheduler unhealthy
(`globalSchedulerHealth != healthy`), restart-quiescence-classified disposition (§4 vocabulary
rule), or any observed duplicate/UNKNOWN-replay → the affected leg is UNKNOWN/failed-closed;
record and stop; no blind retry, no second authorization consumption. `ATTEMPTS=1` per
authorization (PDCP house rule). The live engine has no C11-R1 consult deployed (LIVE_BYTES §2),
so unknowns stay fenced fail-closed; resolution only through the existing frozen
late-outcome/self-heal machinery under a separate authorization — never inside this packet's
window.

## 10. AUTHORIZATION_REQUIRED (fresh; nothing inherited)

To be granted by Owner mayf3 (the only authorized Feishu sender; delegation of the *send*
mechanics to a named human operator is allowed if the authorization names them explicitly, but
the message must still originate from the Owner's own Feishu account — a send from any other
Feishu identity produces no acceptance evidence and consumes ATTEMPTS=1):

```text
AUTHORIZATION_DECISION (circle one):
  A) Approve execution as frozen (target agt_3d-print-agent; LEG-1 readback; messages §4+§6;
     outcome maps §5/§6).
  B) Approve with LEG-3 pre-ruling: NOT_APPLICABLE (no real candidate) closes
     REAL_RECOVERY_ACCEPTANCE.
  C) Approve with a different named target bot: ____________ (fresh packet spin required).
  D) Decline — packet stays frozen; backlog keeps blocker unchanged.
Authorization id: ____________  Date: ____________  Signature: ____________
LEG-3 Owner pre-ruling (if B not circled, NOT_APPLICABLE does NOT close LEG-3): ____________
LEG-1 elevated reader (authsvc-user session / Owner-directed root), named: ____________
LEG-1 R1d tool-list waiver if live-turn log unreadable (YES/NO): ____________
```

## 11. NEXT_OWNER

```text
1. mayf3 — grant §10 authorization (LEG-3 pre-ruling, elevated reader, R1d waiver if needed).
   The §4 message is sent ONLY after §2 has passed and the LEG-1 outcome is recorded (steps 2–3);
   never before.
2. Named elevated reader — perform LEG-1 (read-only), record R2, stop on any anomaly.
3. Named executor — run §2 pre-check, capture R1/R3–R5, stop on any UNKNOWN.
4. Backlog reconciler lane — consume the results evidence dir; update the
   SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 record (BUSINESS_ACCEPTED/NEXT_ACTION only as §8
   allows) and the deployment backlog; reconcile this V2 packet as superseding V1.
```
