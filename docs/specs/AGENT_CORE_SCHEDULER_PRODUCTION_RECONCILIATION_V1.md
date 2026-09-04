---
spec_id: AGENT_CORE_SCHEDULER_PRODUCTION_RECONCILIATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-09-04
scope:
  - current-state adoption record for the already-live scheduler production state (runtime generation, canary outcome, traceability result)
  - honest recording of the early-production-execution authority gap
  - continued-operation declaration only (any future maintenance mutation requires a NEW fresh authority)
governed_by:
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_SCHEDULER_PRODUCTION_RECONCILIATION_V1

> **PROPOSED / RECONCILIATION RECORD.** 本 Spec 不授权任何新的生产 mutation，
> 不产生任何新的 implementation power（implementation_authority = none）。
> 它只采纳并记录一个已经存在、且被 §2 机械证明为安全的当前生产状态。
>
> **THIS_AUTHORITY_DOES_NOT_RETROACTIVELY_AUTHORIZE_PAST_EXECUTION.**
> §1 记录的每一次早期生产执行在当时都缺乏 effective Authority——该历史事实
> 如实记录，不被本 Spec 的接受所覆盖、改写或追溯授权。
> 未来任何涉及 mutation 的维护：**NEW_FRESH_AUTHORITY_REQUIRED = YES**。

## 1. Exact production-authority census (executed reality)

Every row records what actually happened, whether an authority was EFFECTIVE
(accepted+merged+final-head PASS) at execution time, and the honest gap flag.
All evidence locators are exact (path + sha256 or DB row); timestamps are UTC.

```text
E1  AUTH 1.7.0 deployment (auth-service snapshot 57258ec → launchd com.auth-service)
    EXECUTED_AT                        = 2026-09-04T04:27:08Z (apply start) → 04:27:24Z
                                         (health authContractVersion 1.7.0, digest
                                         577a1879a085e89377b02d94782abd64c67131a54d008cf5213cb42ff701536c,
                                         first post-switch poll; pid 54885→56983)
    EXECUTED_PRODUCTION_IDENTITY       = auth-service bundle face @ 57258ec33700af8057ab2ed63fd8e52b3225e749,
                                         8-audience registry
    EXECUTED_PRODUCTION_IDENTITY (cont) = durable evidence:
                                         /Users/yanfenma/workspace/deployment-artifacts/auth-service-bundle-1-7-0-deploy/DEPLOY_TRANSCRIPT_20260904T042708Z.txt
                                         sha256 7940fbd19f6e643a2b916f734f747a2d5aac3016af2bc01ece972144c654bae3
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO (AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
                                         was proposed inside auth PR #49; never accepted/merged)
    EARLY_PRODUCTION_EXECUTION         = YES

E2  scheduler AuthAudience DB activation (exactly 1 row + audience.registered audit)
    EXECUTED_AT                        = 2026-09-04T04:27:24.601Z
                                         (auth_security_audits row: event_type=audience.registered,
                                         request_correlation_id=
                                         auth-bundle-1-7-0-scheduler-20260904T042724Z)
    EXECUTED_PRODUCTION_IDENTITY       = auth_audiences row scheduler v1 freeze_ready=true,
                                         field-exact vs CCR registry entry
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO (same proposed PR #49 spec)
    EARLY_PRODUCTION_EXECUTION         = YES

E3  operational Grant Phase C — scheduler.admin v1 for agt_efficiency-agent
    (mc_cF81DF-XND9Zmzao4F08rOK_ / machine_clients.id 695d1eeb-3547-4cbd-a72b-915f4ebf25a4)
    EXECUTED_AT                        = 2026-09-04T05:49:13.892Z (Phase B send-grant v2
                                         reactivation audit grant.reactivated, correlation
                                         lane-c-operational-grants-20260904T054913Z-phaseB) and
                                         2026-09-04T05:49:13.916Z (Phase C audit
                                         grant.operational_created, correlation …-phaseC)
    EXECUTED_PRODUCTION_IDENTITY       = Phase B row: agent-session-messaging, scopes
                                         {agent.session.send}, version 2, revoked_at NULL
                                         (Lane B scope — recorded as executed fact, NOT
                                         ratified here); Phase C row: scheduler, scopes
                                         {scheduler.admin}, version 1, live;
                                         positive claims proofs + 3 negatives fail-closed;
                                         durable evidence:
                                         /Users/yanfenma/workspace/deployment-artifacts/scheduler-admin-grant-v1/TRANSCRIPT_apply_20260904T054913Z.txt
                                         sha256 51e0e89ff69f74f06abc46b9508416019a1a0c2ff9bd710738fabd11af6f6634
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO (AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1
                                         was proposed inside auth PR #49)
    EARLY_PRODUCTION_EXECUTION         = YES

E4  Scheduler runtime deployment (10-file release, generation 18f96e2)
    EXECUTED_AT                        = 2026-09-04T05:40:31Z (apply start per transcript
                                         TRANSCRIPT_apply_20260904T054031Z.txt) → DEPLOY_OK
                                         receipt copied 2026-09-04T05:40:35Z; pid 13347→72000
    EXECUTED_PRODUCTION_IDENTITY       = 10-file face (5 overwrite scheduler
                                         index/occurrence/scheduler/seams/self-service @ release
                                         blobs ae6cc482/ef3e4cbe/d5aec7af/ed9dbc22/95c9e8d1
                                         + 5 create history-*), sha256-verified live post-apply;
                                         workflow.js 7e4c6fa9b6f455506812f774565abcda2b394857a908c1f8cc1f36bc69c67aee
                                         and registry.js 628abde2069028c832eb76699ad2dd8521528288f396680d39dffb353d985382
                                         pins intact; unrelated-tree digest equal;
                                         durable evidence:
                                         /Users/Shared/agent-core-deployment-receipts/SCHED-20260904T054035Z-DEPLOY_RECEIPT.json
                                         sha256 bc63f3676c048b9950f39214662c426e880ee4ce6984a6e204ce0f4b07b01adf
                                         /Users/Shared/agent-core-deployment-receipts/SCHED-20260904T054035Z-TRANSCRIPT_apply_20260904T054031Z.txt
                                         sha256 c4c07a7f4826236c08eaf50e5a8cb52f07398102d0f22baf124f40025ae16ffb
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO (AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1 was
                                         proposed inside dsh PR #159, stacked on proposed PR #160)
    EARLY_PRODUCTION_EXECUTION         = YES

E5  ONE cross-Agent one-shot Scheduler canary (Owner-directed live entry)
    EXECUTED_AT                        = created 2026-09-04T05:53:20.354Z (create audit);
                                         occurrence nominal 2026-09-04T06:08:20.354Z; run admitted
                                         06:08:20.615Z, started 06:08:21.432Z, terminal success
                                         ended 06:08:24.593Z
    EXECUTED_PRODUCTION_IDENTITY       = job 67d3cd73-2305-42e9-83b5-3afb03356a8b
                                         (operator agt_efficiency-agent → target agt_blog-agent);
                                         occurrence occ:91bc78517f502049 / run run:occ:91bc78517f502049
                                         (idempotencyKey-bound, exactly one);
                                         nativeSessionId cron-run-occ:91bc78517f502049 (fresh non-main);
                                         state=succeeded; deliveryStatus=not-requested (none requested —
                                         correct fail-closed value); no fence for this job;
                                         delete_after_run removed the definition with occurrence
                                         evidence retained
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = NO for the deployed runtime it exercised (E4 was early);
                                         the canary itself was a live Owner-directed action within
                                         this Goal
    EARLY_PRODUCTION_EXECUTION         = YES (inherited from E4's state)

E6  Traceability readback (store census; READ-ONLY — no production mutation)
    EXECUTED_AT_ANCHOR                 = 2026-09-04T06:08:24.593Z (the traced run's terminal
                                         instant; the readback fact exists store-resident from this
                                         instant onward and is re-derivable at any time via the
                                         exact command below; the census capture wall-clock is not
                                         itself load-bearing)
    EXECUTED_PRODUCTION_IDENTITY       = full §21 coordinate set recovered for the canary run:
                                         jobId 67d3cd73-2305-42e9-83b5-3afb03356a8b /
                                         occurrenceId occ:91bc78517f502049 / runId
                                         run:occ:91bc78517f502049 / nativeSessionId
                                         cron-run-occ:91bc78517f502049 / nominalScheduledAt
                                         1788502100354 / admittedAt 1788502100615 / startedAt
                                         1788502101432 / endedAt 1788502104593 / state=succeeded /
                                         payloadHash sha256:7050f28198728810b1bf89296b0db9e55487542ced
                                         20634d15263785b6862a9a / idempotencyKey=occ:91bc78517f502049 /
                                         scheduleRevision 1 / history chain reserved→running→succeeded
    EXACT_REPRODUCTION_LOCATOR         = store
                                         /Users/authsvc/.agent-core/scheduler/jobs.json
                                         (occurrences[] entry occurrenceId occ:91bc78517f502049) and
                                         /Users/authsvc/.agent-core/scheduler/runs.jsonl;
                                         re-derivation command (read-only):
                                         sudo /bin/bash -c 'cat /Users/authsvc/.agent-core/scheduler/jobs.json; tail -40 /Users/authsvc/.agent-core/scheduler/runs.jsonl'
    ACTUAL_ACCEPTED_AUTHORITY_AT_EXEC  = N/A (read-only)
    EARLY_PRODUCTION_EXECUTION         = NO (nothing executed)
```

**PAST_AUTHORITY_GAP = HONESTLY_RECORDED (E1–E5 all EARLY).** No later acceptance
in this Spec rewrites that history.

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

## 3. Adopted current state (scope of THIS record)

Exactly and only:

- **A. live Auth 1.7 scheduler face**: auth_audiences row `scheduler`
  (registered_scopes [scheduler.admin, scheduler.audit], machine-only, v1,
  freeze_ready) as deployed by snapshot 57258ec (registry face carries NO
  forum-moderate delta; svc-forum scopes match DB — zero known mismatch);
- **B. exact scheduler.admin operational Grant**: the single E3 row
  (mc_cF81DF / uuid 695d1eeb / agt_efficiency-agent × scheduler ×
  {scheduler.admin} v1); `scheduler.audit` remains UNGRANTED (separate
  activation);
- **C. continued operation** of the 10-file runtime face and the E5 canary
  outcome. The runtime semantics of that state continue to be described by the
  already-accepted parent contracts (AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2 /
  AGENT_CORE_SCHEDULER_RUN_HISTORY_V1); THIS Spec creates no new implementation
  power. **Any future maintenance involving a production mutation requires a NEW
  fresh authority: NEW_FRESH_AUTHORITY_REQUIRED = YES**;
- **D. provenance and receipts**: the §1 EXECUTED_PRODUCTION_IDENTITY values and
  the exact evidence locators named there are the durable record.

OUT OF SCOPE: Lane B / agent_session_send deployment (PAUSED_EXTERNAL_DEPENDENCY
per Owner OPTION_C ruling 2026-09-04 — the executed Phase B send-grant
reactivation is recorded as fact in §1 E3 but NOT adopted or ratified here); the
history-*/traceability HTTP activation (dormant; separate authorization);
`scheduler.audit` granting; any new job, canary, grant, or deployment.

## 4. Root cause of the authority gap (honest engineering record)

The executed path diverged from the planned authority DAG on 2026-09-04: the
Lane B ASM deployment hit a cross-goal runtime-generation coupling (fleet-codex
subscription discipline bound into shared files), was rolled back safely, and
was PAUSED by Owner ruling (OPTION_C) — while Lane C proceeded on the
independent 10-file scheduler closure. Production proceeded under live Owner
direction with per-step mechanical gates (census, sealed vehicles, premutation
sims, boot rehearsals, independent reviews, receipts) but WITHOUT effective
accepted authorities for E1–E5. This gap is closed going forward by THIS spec's
acceptance — not backwards.

## 5. Disposition of the never-effective proposed candidates

The following were NEVER accepted/merged/effective; they are recorded solely as
HISTORICAL_ENGINEERING_INPUT / STALE_PROPOSED_CANDIDATES — **not as authority
predecessors**, and this Spec claims no supersession relationship to them (there
was nothing effective to supersede):

- dsh PR #159 (head 5390bab6…) carrying AGENT_CORE_SCHEDULER_RUNTIME_DEPLOYMENT_V1,
  stacked on proposed PR #160: its §3 ten-file closure analysis matches the
  executed artifact and is incorporated as factual engineering input; its frozen
  sequencing preconditions diverged from the executed safe path.
- auth PR #49 (head 3ec4743…) carrying AUTH_SERVICE_SCHEDULER_BUNDLE_1_7_DEPLOYMENT_V1
  and AUTH_SERVICE_DAILY_AUTONOMY_OPERATIONAL_GRANTS_V1: same disposition on the
  auth side via the companion record.

NON_NORMATIVE_COORDINATION_REFERENCE (not a governing dependency, not an
acceptance precondition): the companion current-state record lives at
mayf3/auth-service PR #52 (auth-side census E1–E3) — see that PR for the auth
face facts; this Spec stands alone for the dsh-side facts.

## 6. Continued-operation declaration

- The scheduler runtime generation 18f96e2 face (10 files) is the production
  baseline. THIS Spec declares continued operation of exactly that state and
  nothing else.
- Cross-target job definition/control requires the real
  (scheduler, scheduler.admin) wire proof; self-only operations remain
  grant-free; `scheduler.audit` and history activation each require their own
  authority.
- The equal-face rollback boundary (S7) stays provisioned; exercising it for
  the scheduler face follows equal-face compensation semantics.
- **NEW_FRESH_AUTHORITY_REQUIRED = YES** for any future maintenance mutation.

## 7. Acceptance scheme

proposed → ONE independent reconciliation review (census arithmetic, closure
hashes, receipts, current-state safety) → ONE blocker-union fix → ONE re-audit
→ Owner exact-head acceptance. Acceptance of this Spec
RATIFIES_CURRENT_SAFE_STATE=YES and AUTHORIZES_CONTINUED_OPERATION=YES; it does
NOT retroactively authorize E1–E5, grants no implementation authority, and
authorizes no future mutation. PRODUCTION_MUTATION_THIS_RECONCILIATION = NONE
(docs-only).
