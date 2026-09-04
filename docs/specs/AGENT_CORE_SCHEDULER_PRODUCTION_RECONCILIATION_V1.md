---
spec_id: AGENT_CORE_SCHEDULER_PRODUCTION_RECONCILIATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-04
scope:
  - adopt-and-ratify the already-live scheduler production state (runtime generation, auth face, operational grant)
  - honest recording of the early-production-execution authority gap
  - continued-operation and future-maintenance authority for that state
governed_by:
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_SCHEDULER_PRODUCTION_RECONCILIATION_V1
    revision: proposed (companion reconciliation Spec, same date)
    relation: interoperates_with
supersedes:
  - AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1 (stale proposed candidate, dsh PR #159 — its frozen sequencing preconditions diverged from the executed path and were never effective; superseded as authority, retained as historical engineering input)
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_SCHEDULER_PRODUCTION_RECONCILIATION_V1

> **PROPOSED / RECONCILIATION AUTHORITY.** 本 Spec 不授权任何新的生产 mutation。
> 它只治理一个已经存在、且被本文件 §2/§3 机械证明为安全的当前生产状态：
> **采纳（ratify）+ 持续运行（continued operation）+ 未来维护（frozen contracts）**。
>
> **THIS_AUTHORITY_DOES_NOT_RETROACTIVELY_AUTHORIZE_PAST_EXECUTION.**
> §1 记录的每一次早期生产执行在当时都缺乏 effective Authority——该历史事实由本
> Spec 如实记录，不被本 Spec 的接受所覆盖、改写或追溯授权。

## 1. Exact production-authority census (executed reality)

Every row records what actually happened, under which authority was EFFECTIVE at
execution time (accepted+merged+final-head PASS), and the honest gap flag.

```text
E1  AUTH 1.7.0 deployment (auth-service snapshot 57258ec → launchd com.auth-service)
    EXECUTED_AT                        = 2026-09-04T04:27:08Z–04:27:24Z (health 1.7.0
                                         digest 577a1879a085e89377b02d94782abd64c67131a54d008cf5213cb42ff701536c
                                         on first poll; pid 54885→56983; receipt/transcript
                                         DEPLOY_TRANSCRIPT_20260904T042708Z.txt)
    EXECUTED_PRODUCTION_IDENTITY       = auth-service bundle face @ 57258ec33700af8057ab2ed63fd8e52b3225e749,
                                         8-audience registry, scheduler row absent→backfilled same run
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO (AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
                                         was proposed inside auth PR #49; never accepted/merged)
    EARLY_PRODUCTION_EXECUTION         = YES

E2  scheduler AuthAudience DB activation (exactly 1 row + audience.registered audit)
    EXECUTED_AT                        = 2026-09-04T04:27:24Z (same transaction run as E1)
    EXECUTED_PRODUCTION_IDENTITY       = auth_audiences row scheduler v1 freeze_ready
                                         (field-exact vs CCR; readback in census transcript)
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO (same proposed PR #49 spec)
    EARLY_PRODUCTION_EXECUTION         = YES

E3  operational Grant Phase C — scheduler.admin v1 for agt_efficiency-agent
    (mc_cF81DF-XND9Zmzao4F08rOK_ / uuid 695d1eeb-3547-4cbd-a72b-915f4ebf25a4)
    EXECUTED_AT                        = 2026-09-04T05:49:13Z (TRANSCRIPT_apply_20260904T054913Z.txt;
                                         two ordered Serializable transactions: Phase B send-grant
                                         v2 reactivation [Lane B tombstone→live] + Phase C scheduler.admin;
                                         positive claims proofs + 3 negatives fail-closed)
    EXECUTED_PRODUCTION_IDENTITY       = machine_access_grants rows live as applied; scheduler audience total=1
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO (AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
                                         was proposed inside auth PR #49)
    EARLY_PRODUCTION_EXECUTION         = YES
    NOTE: Phase B (agent.session.send reactivation) is Lane B scope — recorded here as
    executed fact; its governance gap is tracked for Lane B's own resumption, NOT ratified here.

E4  Scheduler runtime deployment (10-file release, generation 18f96e2)
    EXECUTED_AT                        = 2026-09-04T05:40:31Z–05:40:45Z (pid 13347→72000;
                                         DEPLOY_RECEIPT preserved
                                         /Users/Shared/agent-core-deployment-receipts/SCHED-20260904T054035Z-*)
    EXECUTED_PRODUCTION_IDENTITY       = 10-file face (5 overwrite scheduler
                                         index/occurrence/scheduler/seams/self-service @ release blobs
                                         ae6cc482/ef3e4cbe/d5aec7af/ed9dbc22/95c9e8d1 + 5 create history-*)
                                         sha256-verified live post-apply; workflow.js 7e4c6fa9 and
                                         registry.js 628abde2 pins intact; UNRELATED digest equal
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO (AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1 was
                                         proposed inside dsh PR #159, stacked on proposed PR #160)
    EARLY_PRODUCTION_EXECUTION         = YES

E5  ONE cross-Agent one-shot Scheduler canary (Owner-directed live entry)
    EXECUTED_AT                        = created 2026-09-04T05:53:20.354Z (create audit);
                                         occurrence nominal 06:08:20.354Z; run admitted 06:08:20.615Z,
                                         started 06:08:21.432Z, terminal success ended 06:08:24.593Z
    EXECUTED_PRODUCTION_IDENTITY       = job 67d3cd73-2305-42e9-83b5-3afb03356a8b
                                         (operator agt_efficiency-agent → target agt_blog-agent);
                                         occurrence occ:91bc78517f502049 / run run:occ:91bc78517f502049
                                         (idempotencyKey-bound, exactly one);
                                         nativeSessionId cron-run-occ:91bc78517f502049 (fresh non-main);
                                         state=succeeded; deliveryStatus=not-requested (none requested —
                                         correct fail-closed value); no fence for this job; delete_after_run
                                         removed the definition with occurrence evidence retained
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO for the deployed runtime it exercised (E4 was early);
                                         the canary itself was a live Owner-directed action within this Goal
    EARLY_PRODUCTION_EXECUTION         = YES (inherited from E4's state)

E6  Traceability readback (store census; READ-ONLY — no production mutation)
    EXECUTED_AT                        = 2026-09-04T06:0xZ (Owner-executed census)
    EXECUTED_PRODUCTION_IDENTITY       = full §21 coordinate set recovered for the canary run:
                                         jobId/occurrenceId/runId/nativeSessionId/scheduledAt/
                                         admittedAt/startedAt/endedAt/state=presented/outcome=succeeded/
                                         payloadHash/idempotencyKey/scheduleRevision/history chain
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = N/A (read-only)
    EARLY_PRODUCTION_EXECUTION         = NO (nothing executed)
```

**PAST_AUTHORITY_GAP = HONESTLY_RECORDED (E1–E5 all EARLY).** No later acceptance
in this Spec rewrites that history. The gap's root cause is recorded in §4.

## 2. Current-state safety proof (mechanical, post-hoc, all after E5)

```text
S1 live runtime face      : 10/10 release files sha256 == §3 closure (re-verified);
                            workflow.js/registry.js baseline pins intact; unrelated-tree
                            digest equal across the apply; runtime pid 72000 healthy
S2 runtime function       : fleet self-only scheduler jobs (ceo/family-steward/travel-planner/
                            needs-radar/…) succeeding+delivered on the new generation
                            (runs.jsonl census) — production usage itself exercises it
S3 auth face              : /api/health 1.7.0 digest 577a1879 (live); scheduler audience row
                            field-exact; scheduler grants exactly 1 (the E3 row)
S4 wire-proof live        : cross-target create succeeded ONLY via the real
                            (scheduler, scheduler.admin) token mint (E5 create committed)
S5 canary                 : exactly-once occurrence/run, fresh non-main target session,
                            target-owned execution, terminal success (§1 E5)
S6 traceability           : full coordinate set recovered from the store (§1 E6)
S7 rollback boundary      : ROLLBACK_MANIFEST (5 preimage copies byte-identical + 5 absent)
                            + emergency equal-face restore vehicle pattern (proven in
                            production on 2026-09-03/04 during the paused Lane B round)
S8 exactly-once integrity : no duplicate occurrence/run; no fence for the canary job;
                            fleet fences (5, all pre-existing, other jobs) demonstrate the
                            guard functioning
```

CURRENT_PRODUCTION_STATE = MECHANICALLY_PROVEN_SAFE (per S1–S8). If any fresh
safety evidence later contradicts this, the equal-face rollback boundary remains
the compensation path.

## 3. Ratified current state (scope of THIS authority)

Exactly and only:

- **A. live Auth 1.7 scheduler face**: auth_audiences row `scheduler`
  (registered_scopes [scheduler.admin, scheduler.audit], machine-only, v1,
  freeze_ready) as deployed by snapshot 57258ec (registry face carries NO
  forum-moderate delta; svc-forum scopes match DB — zero known mismatch);
- **B. exact scheduler.admin operational Grant**: the single E3 row
  (mc_cF81DF / uuid 695d1eeb / agt_efficiency-agent × scheduler ×
  {scheduler.admin} v1); `scheduler.audit` remains UNGRANTED (separate
  activation);
- **C. adoption + continued operation + future maintenance** of the 10-file
  runtime face and the E5 canary outcome, under the frozen contracts of
  AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2 / AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
  (wire-proof seam, exactly-once, fresh non-main target sessions, outcome fences);
- **D. provenance and receipts**: the §1 EXECUTED_PRODUCTION_IDENTITY values and
  the receipts/transcripts named there are the durable record.

OUT OF SCOPE: Lane B / agent_session_send deployment (PAUSED_EXTERNAL_DEPENDENCY
per Owner OPTION_C ruling 2026-09-04 — the executed Phase B send-grant
reactivation is recorded as fact in §1 E3 but NOT ratified here); the
history-*/traceability HTTP activation (dormant; separate authorization);
`scheduler.audit` granting; any new job, canary, grant, or deployment.

## 4. Root cause of the authority gap (honest engineering record)

The executed path diverged from the planned authority DAG on 2026-09-04: the
Lane B ASM deployment hit a cross-goal runtime-generation coupling (fleet-codex
subscription discipline bound into shared files), was rolled back safely, and
was PAUSED by Owner ruling (OPTION_C) — while Lane C proceeded on the
independent 10-file scheduler closure. The proposed authority specs (auth PR
#49; dsh PR #159, stacked on proposed #160) had frozen sequencing preconditions
(Lane B terminal → Phase C; ASM V2 terminal) that no longer matched the actual
safe path. Production proceeded under live Owner direction with per-step
mechanical gates (census, sealed vehicles, premutation sims, boot rehearsals,
independent reviews, receipts) but WITHOUT effective accepted authorities for
E1–E5. This gap is closed going forward by THIS spec's acceptance — not
backwards.

## 5. Disposition of superseded candidates

- dsh PR #159 / AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1: stale proposed
  authority candidate; superseded by this Spec; retained as historical input
  (its §3 closure and engineering analysis match the executed artifact and are
  incorporated by reference as factual record).
- auth PR #49 / AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1 +
  AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1: same disposition via the
  companion auth-service reconciliation Spec (Phase B/GRANT_1 governance gap
  tracked under Lane B resumption, out of scope here).

## 6. Continued-operation and maintenance contracts

- The scheduler runtime generation 18f96e2 face (10 files) is the production
  baseline; any future change replays through a fresh exact-head authority with
  the converged vehicle discipline (sealed inputs, premutation simulation,
  real-boot rehearsal, independent review, one Owner execution).
- Cross-target job definition/control requires the real
  (scheduler, scheduler.admin) wire proof; self-only operations remain
  grant-free; `scheduler.audit` and history activation each require their own
  authority.
- The equal-face rollback boundary (S7) stays provisioned; exercising it for
  the scheduler face follows CTR-DEP-008-equal semantics.

## 7. Acceptance scheme

proposed → ONE independent reconciliation review (census arithmetic, closure
hashes, receipts, current-state safety) → ONE blocker-union fix → ONE re-audit
→ Owner exact-head acceptance → lifecycle-only finalization → merge. Acceptance
of this Spec RATIFIES_CURRENT_SAFE_STATE=YES and
AUTHORIZES_CONTINUED_OPERATION=YES; it does NOT retroactively authorize E1–E5.
PRODUCTION_MUTATION_THIS_RECONCILIATION = NONE (docs-only).
