---
spec_id: AGENT_CORE_WORKFLOW_STALE_REENTRY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
title: Stale accepted-no-progress dispatch re-entry (attempt generation, stale settlement, fence-aware redispatch)
repo: mayf3/dsh-agent-core
date: 2026-09-16
candidate_base: 1a1e59b8e41901c57beb8e5306a557350f56bfa9
scope:
  - packages/workflow-execution (ledger event vocabulary + engine reconcile/poll)
  - packages/agent-router (ONE control seam: settle-once stale turn + release its fence)
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
    defined by CTR-SRE-002. Every other V2 contract, non-goal, invariant and
    recovery semantic is carried forward UNCHANGED. When this document is
    accepted, V2 remains the authority for all surfaces this spec does not
    explicitly move (V2 gains a reciprocal amended/superseded-in-scope-by
    backlink at acceptance).
superseded_by: null
owners:
  - mayf3
related_authorities:
  - AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 (untouched)
  - AGENT_ROUTER_DELIVERY_V0 (untouched)
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2 C-013/C-015/C-016/C-017 (reused, not amended)
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
  admissible ONLY on positive business evidence (CTR-SRE-002), never on
  timeout alone.
- No model-facing tool, no new broker capability, no svc-workflow change
  (SVC = NO_CHANGE_REQUIRED per investigation §8), no scheduler/watchdog/
  launchd/production-filesystem surface.

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

Idempotence (Goal CASE 7): a stale occurrence settles once (terminal
append refusal); the new attempt restarts the dispatch clock; repeated
scans of the same occurrence cannot re-dispatch again until the NEW attempt
itself reaches threshold age with no progress. Redispatch rate is bounded
by construction: ≤ 1 per threshold window per visit. There is no maximum
generation cap in V1 — a cap would reintroduce permanent suppression, which
this spec exists to remove; `dispatchCount` makes amplification observable.

## 5. CTR-SRE-004 — router stale-turn resolution seam (ONE new control seam)

A hung turn leaves a `pending`/`outcome_unknown` reconciliation record and an
active unknown fence that would reject the re-plan's prompt
(`AGENT_PROCESS_TURN_FENCED`). The engine therefore gains ONE injected
control seam, `resolveStaleTurn({agentId, reconciliationHandle, reason})`,
implemented in the router over EXISTING frozen mechanics, with NO new
vocabulary:

1. store-level, settle-once via the C-017 late machine:
   `settleLate(handle, { lateOutcome: 'late_failed',
   outcomeEvidence: 'stale_no_progress', terminationEvidence: null })`;
   an already-settled record is a no-op (`won:false` audit), and a record
   without an unknown source is first `markOutcomeUnknown` (idempotent,
   C-017) — the 900s deadline makes this the expected state, the fallback is
   defensive only.
2. process-level, only when the owning process is live:
   release THIS handle's fence (C-016: per-handle; all other unknowns stay
   fenced), mark the local execution settled so the stream/exit late paths
   become duplicate-ignored audits, and finish the execution slot.

The seam never aborts a live provider call; a late transition emitted by the
abandoned turn is fenced at the workflow layer by svc's version CAS
(CTR-SRE-002). Seam failure is logged and non-fatal: the re-plan delivery
would then fail `AGENT_PROCESS_TURN_FENCED` → terminal
`delivery_failed` NEEDS_REVIEW (truthful, visible, never absorbed).

## 6. CTR-SRE-005 — engine integration

- `reconcileOnce` additionally evaluates the stale predicate (CTR-SRE-002)
  for (a) ACTIVE `run_delivered` attempts whose turn judgment is ACTIVE and
  (b) terminal NEEDS_REVIEW attempts with delivered evidence, enumerated
  fresh under the ledger lock each pass. On confirmed staleness it appends
  `stale_superseded` (CAS-guarded on the enumerated attempt; a lost race is
  a no-op skip), then invokes `resolveStaleTurn` when the turn record was
  unresolved.
- `pollOnce` order is unchanged (reconcile → sweep), so a visit settled
  stale is re-admissible in the SAME pass under the existing admission
  bound; `already_attempted` replays stay free (CTR-WAE-001b carried).
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
| CASE 2 | delivered 61m ago, visit current, version == atDispatch, instance active, no assistance → `stale_superseded` appended; same-pass sweep admits gen 2 (new attemptId, `dispatchCount=2`, `retryReason=stale_no_progress`); second delivery happened |
| CASE 3 | version advanced after dispatch (agent transitioned) → NOT stale; normal SETTLED business verdict; no redispatch |
| CASE 4 | version advanced by assistance open (HUMAN_REQUIRED) or visit moved (RETURN/admin) → NOT stale; no redispatch to the old ownership |
| CASE 5 | instance terminal → NOT stale (and the intent leaves the due feed server-side) |
| CASE 6 | gen-2 advanced the version; old attempt's transition (old expectedWorkflowStateVersion) → svc 409 `workflow_state_version_conflict` (cited: svc transition_transaction test coverage — workflow-data layer, no DSH change required) |
| CASE 7 | two consecutive reconcile passes over the same stale occurrence → exactly ONE `stale_superseded`; gen-2 within its threshold window → `already_attempted`; no unbounded redispatch |
| fence | CASE-2 hung-turn variant: `resolveStaleTurn` settles the record once (`late_failed`/`stale_no_progress` evidence), releases the fence, and the re-plan delivery is admitted; a second resolution is a no-op |
| replay | generation-1 events without a `generation` field project byte-compatibly; a gen-2 `attempt_planned` against a non-stale or identity-mismatched predecessor is a corrupt-ledger fail-loud |
| wiring | threshold env parse: default 3600000; non-positive-integer rejected; disabled poller keeps the ledger evidence-only |
