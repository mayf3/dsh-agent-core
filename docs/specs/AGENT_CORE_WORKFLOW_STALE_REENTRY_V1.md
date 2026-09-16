---
spec_id: AGENT_CORE_WORKFLOW_STALE_REENTRY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
title: Stale accepted-no-progress dispatch re-entry (attempt generation, business stale settlement, quiescence-gated redispatch)
repo: mayf3/dsh-agent-core
date: 2026-09-16
candidate_base: 1a1e59b8e41901c57beb8e5306a557350f56bfa9
revision: r2
revision_date: 2026-09-16
revision_note: >-
  r2 = independent Architecture/Semantic review CHANGES_REQUIRED closure
  (4 ship blockers). The r1 router seam `resolveStaleTurn`
  (force-settleLate of an unresolved turn + releaseFence + same-child
  re-delivery) is RETIRED ENTIRELY: r1 conflated BUSINESS STALENESS
  (workflow_state_version unchanged) with EXECUTION TERMINATION PROOF,
  violating AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-013
  (SAME_AGENTPROCESS_NEW_TURN_ADMISSION=FORBIDDEN), C-015 (elapsed time /
  fixed waiting duration are NOT termination proof), C-016 (fence releases
  only on exact termination evidence; no rewrite to ordinary failed) and
  C-017 (settle-once truthfulness), plus V2's outcome_unknown contract
  (CTR-WAE-006 carried; "an unknown outcome NEVER creates a second
  execution"). r2 architecture: the business layer (generation,
  stale_superseded, re-entry eligibility) is unchanged; the execution layer
  gains a READ-ONLY quiescence gate — generation N+1 delivery defers while
  the superseded attempt's reconciliation record is still an active unknown
  and proceeds only on exact-termination convergence produced by the
  existing authorities. Zero lifecycle-authority changes; zero router
  changes in r2.
scope:
  - packages/workflow-execution (ledger event vocabulary + engine reconcile/poll/admission gate)
  - packages/production-runtime (wiring + threshold configuration only)
governed_by:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 (carried; see supersedes scope)
external:
  - svc-workflow SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1 (consumed UNCHANGED)
  - svc-workflow SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1 (consumed UNCHANGED)
supersedes:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 — SCOPED successor: supersedes ONLY
    the two §1 frozen gates `SECOND_ATTEMPT_ID = FORBIDDEN` and
    `SECOND_RUN = FORBIDDEN` and the §0 non-goal clauses "no automatic retry
    engine of any kind … no recovery triggered by poller ticks or reconcile
    passes" and "no second attempt id, ever", in the single bounded case
    defined by CTR-SRE-002 + CTR-SRE-004. Every other V2 contract, non-goal,
    invariant and recovery semantic is carried forward UNCHANGED — INCLUDING
    the entire outcome_unknown family (CTR-WAE-006 carried; V2 §0 "an unknown
    outcome or an unknown external side effect NEVER creates a second
    execution"). When this document is accepted, V2 remains the authority for
    all surfaces this spec does not explicitly move (V2 gains a reciprocal
    amended/superseded-in-scope-by backlink at acceptance).
superseded_by: null
owners:
  - mayf3
related_authorities:
  - AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 (untouched)
  - AGENT_ROUTER_DELIVERY_V0 (untouched)
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-013/C-015/C-016/C-017 (REUSED, NOT
    amended and NOT superseded — this spec's redispatch DEFERS to them; see
    CTR-SRE-004)
---

# AGENT_CORE_WORKFLOW_STALE_REENTRY_V1

## 0. Problem and authority basis

A dispatched-and-accepted NodeVisit whose Agent Run produces no workflow
observable progress is suppressed from dispatch **forever** by the
one-attempt fence, while "accepted" is an unverifiable transport admission
with no expiry. Real case
`44dee9da-c3d4-4beb-a7f7-f68edfceedcf` (investigation
`docs/investigations/WORKFLOW_ACCEPTED_STALE_NO_PROGRESS_REENTRY_V1.md` §7):
7h04m frozen; recovered only by an out-of-band human re-dispatch request.

Authority basis: Owner GOAL
`WORKFLOW_ACCEPTED_STALE_NO_PROGRESS_REENTRY_V1` (2026-09-16),
GOAL_MODE = INVESTIGATE_THEN_MINIMAL_IMPLEMENTATION — the Owner directive
`SEND_CONFIRMED != permanent dispatch suppression; ACCEPTED != permanent
ownership` is NEW_EVIDENCE against the V2 frozen gates and the authoring
authority for this candidate. This candidate is INERT while `status:
proposed`; AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 remains the accepted
authority in full until acceptance.

## 1. frozen invariants carried UNCHANGED from V2

- svc-workflow stays the ONLY business authority (state version /
  idempotency / transactions). The ledger records facts; it never decides
  business truth.
- Exactly ONE assignee resolution authority (fresh per admission; never
  cached, never substituted).
- `workflow_execute.transition` by the target Agent remains the ONLY
  workflow write path.
- Write-ahead `delivery_started` before ANY `router.deliver` (CTR-WAE-012/013).
- Terminal attempts refuse appends fail-loud (the refusal text is updated to
  reference V3; the mechanic is unchanged for all non-stale verdicts).
- Unknown outcomes never become "run it again" by themselves: re-entry is
  admissible ONLY on positive business evidence (CTR-SRE-002) AND execution-
  layer quiescence (CTR-SRE-004), never on timeout alone.
- AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-013/C-015/C-016/C-017 are REUSED,
  NOT amended and NOT superseded: this spec never settles a turn, never
  releases a fence, never tears down an execution slot, and never injects a
  prompt into a process whose active turn is an unresolved unknown. The
  scheduler's ONLY execution-layer act is a read-only quiescence query.
- No model-facing tool, no new broker capability, no router surface change,
  no svc-workflow change (SVC = NO_CHANGE_REQUIRED per investigation §8),
  no scheduler/watchdog/launchd/production-filesystem surface.

## 2. CTR-SRE-001 — attempt generation (moves V2's SECOND_ATTEMPT_ID gate)

A NodeVisit may carry a bounded SEQUENCE of attempts. `generation` starts at
1 and is part of the deterministic attempt id:

```text
attemptIdFor(nodeVisitId, generation)
  generation = 1 → sha256(nodeVisitId-lowercase)        (byte-identical to V2)
  generation = N > 1 → sha256(`${nodeVisitId}-lowercase#gen${N}`)
```

Generation 1 replays byte-compatibly with every existing ledger file. A
generation N+1 `attempt_planned` is legal ONLY under the CTR-SRE-003
admission rule and only against the SAME identity triple
(dispatchIntentId, workflowInstanceId, ownerPrincipalId) as the attempt it
supersedes — a mismatch is a corrupt-ledger fail-loud.

The projection record carries, additively: `generation`, `dispatchCount`
(= generation), and on a re-plan `previousAttemptId` +
`retryReason: 'stale_no_progress'`. `lastDispatchAtMs` is the current
attempt's delivery timestamp (the dispatch clock is per attempt; a re-plan
restarts it — there is no renewal, no lease, no heartbeat).

## 3. CTR-SRE-002 — stale settlement and re-entry eligibility

New ledger event:

```text
stale_superseded { nodeVisitId, observedWorkflowStateVersion, observedAtMs }
  → terminal state SETTLED, phase 'stale_superseded',
    judgment 'stale_no_progress'
```

Legal source states (pre-checked + appended + applied inside ONE locked
ledger mutation):
- ACTIVE / `run_delivered` (the hung-run class), or
- terminal `NEEDS_REVIEW` whose projection has `delivered` evidence (the
  run-ended-without-submission class): positive business evidence supersedes
  the review — the review existed to answer "did the business commit?", and
  the probe answered NO authoritatively.

`STALE_SUPERSEDED` is emitted ONLY when ALL of the following hold (the
re-entry predicate; every conjunct REQUIRED):

```text
REENTRY_ELIGIBLE =
    attempt has delivered evidence (run_delivered happened)
AND age(delivered.atMs, now) >= staleNoProgressThresholdMs
AND probe(instance detail AS THE TARGET AGENT — the settle-probe seam)
      reports visit still current (current_node_visit_id == attempt.nodeVisitId)
AND probe reports instance NOT terminal (is_terminal = false)
AND probe reports workflow_state_version == attempt.workflowStateVersionAtDispatch
AND probe read succeeded (any failure / restricted visibility = NOT eligible,
      conservative; a moved visit is ordinary SETTLED business, not stale)
```

The threshold `staleNoProgressThresholdMs` defaults to 3_600_000 (1h) and is
wiring configuration (env `DSH_WORKFLOW_STALE_NO_PROGRESS_MS`); the wiring
MUST reject a value that is not a positive integer and SHOULD be configured
greater than the router's maximum turn deadline (the 900s production turn
timeout guarantees `outcome_unknown` is already marked before any stale
evaluation can fire).

`workflowStateVersionAtDispatch` is captured by ONE instance-detail read (AS
THE TARGET AGENT) immediately after a successful delivery, inside the
existing admission completion callback (same locked-mutation discipline as
the delivery itself). If that read fails, the field is absent and the
attempt is NEVER stale-eligible (conservative V2 behaviour for that
attempt). The dispatch-time version is evidence, not fencing: the workflow
data layer is fenced by svc's mandatory `expected_workflow_state_version`
CAS (investigation §4) — an old attempt's late transition is rejected 409
`workflow_state_version_conflict` the moment the new attempt (or anything
else) advances the instance; if it lands first it is a legitimate
authorized transition of the same assignee on the same visit, and the
progress probe then stands the re-entry down.

## 4. CTR-SRE-003 — re-plan admission (moves V2's SECOND_RUN gate)

`beginAttemptIfAbsent` admits generation N+1 iff the current attempt is
terminal with judgment `stale_no_progress` (CTR-SRE-002); otherwise the
V2 behaviour (`already_attempted`) is byte-for-byte unchanged. The re-plan
runs the SAME admission path: fresh principal resolution → write-ahead
`delivery_started` → `router.deliver` with the SAME trusted provenance
shape (carrying the NEW attemptId) → `run_delivered`/`delivery_failed`/
`resolution_blocked` exactly as V2.

The ledger-level admission rule above is NECESSARY but not sufficient:
the generation N+1 delivery is additionally gated by CTR-SRE-004
(execution-layer quiescence).

Idempotence (Goal CASE 7): a stale occurrence settles once (terminal
append refusal); the new attempt restarts the dispatch clock; repeated
scans of the same occurrence cannot re-dispatch again until the NEW attempt
itself reaches threshold age with no progress. Redispatch rate is bounded
by construction: ≤ 1 per threshold window per visit, and additionally never
concurrent with the superseded execution (CTR-SRE-004). There is no maximum
generation cap in V1 — a cap would reintroduce permanent suppression, which
this spec exists to remove; `dispatchCount` makes amplification observable.

## 5. CTR-SRE-004 — execution-layer quiescence gate (READ-ONLY; zero router change)

BUSINESS STALENESS and EXECUTION TERMINATION are distinct authorities and
this spec never conflates them:

- BUSINESS STALENESS (CTR-SRE-002: threshold age + version unchanged + visit
  current + instance active) restores the visit's RE-ENTRY ELIGIBILITY in
  the ledger. It proves NOTHING about the old turn's execution state — it
  does not prove the turn stopped, will not call tools, will not emit side
  effects, observed turn/end, or that the child exited (C-015: elapsed time
  and fixed waiting duration are NOT termination proof).
- EXECUTION convergence remains owned by the EXISTING termination
  authorities (AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-013/015/016/017 and
  the stream/exit late paths): an unresolved turn keeps its unknown fence
  and `SAME_AGENTPROCESS_NEW_TURN_ADMISSION = FORBIDDEN` stands.

Therefore the engine gates the generation N+1 DELIVERY on a READ-ONLY
quiescence check over the EXISTING seams (`getTurnReconciliation` /
`resolveCallerCorrelation` — the same query used by reconcile). Before
minting a re-plan, the superseded attempt's turn state is queried; the
re-plan is admitted ONLY when the record is provably no longer an active
unknown:

```text
QUIESCENT(turnState) =
    'settled'         (late machine settled it WITH trusted evidence — the
                       stream/exit paths release the fence themselves)
  | 'evicted' | 'restart_lost' | 'never_existed'
                       (record gone with its process generation; the fence
                       died with the process — restart/exit convergence)
NOT quiescent = 'pending'  → DEFER: mint NOTHING, deliver NOTHING; the visit
                       keeps its restored eligibility and the sweep re-checks
                       on every later poll. Bounded, silent-until-proven,
                       zero execution-layer side effect.
```

Consequences (all intended):

- The redispatch is never concurrent with the superseded execution in the
  same persistent child — two logical Agent executions in one session are
  unreachable by construction, and the fence is never released by this spec.
- A hung-forever turn defers redispatch indefinitely — that residual is a
  PROCESS LIFECYCLE concern (child exit / REAP / exact-owned shutdown
  C-020..022), not the workflow scheduler's to override. The business
  eligibility is already restored and persists, so the moment any lifecycle
  convergence produces the evidence (exit, restart, eviction → quiescent),
  the next poll redispatches. NO_PERMANENT_STARVATION holds at the business
  layer; NO_CONCURRENT_OLD_AGENT_EXECUTION holds at the execution layer.
- If the abandoned turn later commits a transition while its visit's
  re-entry is deferred, the transition closes the visit server-side, the
  intent leaves the due feed, and re-entry moots itself (no redispatch to
  an obsolete task).
- The workflow DATA layer race remains fenced by svc's mandatory
  `expected_workflow_state_version` CAS (investigation §4) — unchanged.

No router seam exists in r2: the r1 `resolveStaleTurn` force-settle +
fence-release design was retired by review (it violated C-013/015/016/017).
Settlement truthfulness is untouched: a real late event reaching the late
machine settles the record with its TRUE outcome.

## 6. CTR-SRE-005 — engine integration

- `reconcileOnce` additionally evaluates the stale predicate (CTR-SRE-002)
  for (a) ACTIVE `run_delivered` attempts whose turn judgment is ACTIVE and
  (b) terminal NEEDS_REVIEW attempts with delivered evidence, enumerated
  fresh under the ledger lock each pass. On confirmed staleness it appends
  `stale_superseded` (CAS-guarded on the enumerated attempt; a lost race is
  a no-op skip). This is a BUSINESS-layer ledger mutation only — it never
  touches the reconciliation store, fences, or processes.
- `admitDueIntent` applies the CTR-SRE-004 quiescence gate BEFORE minting a
  re-plan: a superseded-stale predecessor whose turn state is still
  `pending` yields `deferred_quiescence` (not counted against the admission
  bound, no ledger append, retried every sweep).
- `pollOnce` order is unchanged (reconcile → sweep); once quiescence is
  reached, the visit is re-admissible in the SAME pass under the existing
  admission bound; `already_attempted` replays stay free (CTR-WAE-001b
  carried).
- Progress semantics (Goal §7): ONLY svc business facts (transition /
  RETURN / assistance change / terminal / cancel / archive) defeat or
  exclude staleness. SEND_CONFIRMED, accepted receipts, session liveness,
  model text, context reads and heartbeats are never progress and nothing
  can renew the stale clock.

## 7. Fairness, scheduler and production boundary

Unchanged and out of scope: due-feed ordering, admission bound, keyset
continuation, fairness among eligible visits, scheduler deployment, watchdog
routing, launchd, production filesystem ownership, historical scheduler
recovery, outcome_unknown recovery tooling, global reconciliation. This spec
adds no second scheduler and no second workflow state machine.

## 8. Test matrix (mechanical, consumer-side fakes; Goal CASE 1–7)

| case | requirement |
|---|---|
| CASE 1 | delivered 30m ago, version unchanged → reconcile keeps ACTIVE (`run_running`); poll returns `already_attempted`; no second delivery |
| CASE 2 | delivered 61m ago, visit current, version == atDispatch, instance active → `stale_superseded` appended (business eligibility restored); while the superseded turn record is still `pending` the sweep returns `deferred_quiescence` (NO second delivery, NO mint); once the execution converges (record settled / restart_lost) the sweep admits gen 2 (new attemptId, `dispatchCount=2`, `retryReason=stale_no_progress`) |
| CASE 3 | version advanced after dispatch (agent transitioned) → NOT stale; normal SETTLED business verdict; no redispatch |
| CASE 4 | version advanced by assistance open (HUMAN_REQUIRED) or visit moved (RETURN/admin) → NOT stale; no redispatch to the old ownership |
| CASE 5 | instance terminal → NOT stale (and the intent leaves the due feed server-side) |
| CASE 6 | gen-2 advanced the version; old attempt's transition (old expectedWorkflowStateVersion) → svc 409 `workflow_state_version_conflict` (cited: svc transition_transaction test coverage — workflow-data layer, no DSH change required). Execution-layer concurrency is excluded by the quiescence gate, not by svc CAS |
| CASE 7 | two consecutive reconcile passes over the same stale occurrence → exactly ONE `stale_superseded`; gen-2 within its threshold window → `already_attempted`; quiescence deferrals are unbounded and side-effect-free; no unbounded redispatch |
| quiescence | `pending` turn ⇒ `deferred_quiescence`, zero deliveries, zero ledger appends; correlation-fallback path (handle lost) honours the same gate; `restart_lost` ⇒ quiescent ⇒ re-admission |
| settlement truth | no engine or wiring path settles/releases the router record: the r1 `resolveStaleTurn` seam does not exist; a real late event reaching the late machine settles with its TRUE outcome (router-side contract, unchanged) |
| replay | generation-1 events without a `generation` field project byte-compatibly; a gen-2 `attempt_planned` against a non-stale or identity-mismatched predecessor is a corrupt-ledger fail-loud |
| wiring | threshold env parse: default 3600000; non-positive-integer rejected; disabled poller keeps the ledger evidence-only; no stale path references any router mutation seam |
