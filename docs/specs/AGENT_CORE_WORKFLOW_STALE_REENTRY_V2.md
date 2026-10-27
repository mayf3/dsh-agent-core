---
spec_id: AGENT_CORE_WORKFLOW_STALE_REENTRY_V2
title: Stale re-entry with separate explicit Owner-resume authorization
status: accepted
accepted_date: 2026-10-28
accepted_at: 2026-10-27T17:37:27.570181+00:00
accepted_by: Codex root (explicitly delegated by mayf3)
accepted_reviewed_head: 62e9d263acd48c554bfeb47727eab4e3048aff73
acceptance_review_verdict: PASS
independent_semantic_reviewer: /root/recovery_contract_review_luna
acceptance_delta_class: whole_authority_successor
semantic_delta_from_reviewed_head: none; body SHA-256 bab05faf378851d6a63ddf857eadc689d8927b4e75f5ebfa95ce0e09acee5992
accepted_proposal_patch_sha256: 6b11cbccc3f8f2d5dbc4140f9ee71705ba6147e115c94b921c008dae2b6ca563
acceptance_receipt: docs/reports/OWNER_ASSISTANCE_RESUME_CONTRACT_ACCEPTANCE_20261028.json
acceptance_receipt_sha256: 38cad7f44a23d5c10b1af71a1680e9134718f446c1b0b0644d08e0c340b7048c
acceptance_authority_basis: >-
  Root accepted this exact reviewed semantic body under the user's explicit
  delegation to complete source and isolated unattended-workflow mechanisms.
  Independent reviewer /root/recovery_contract_review_luna returned PASS on
  this exact candidate and independently scratch-applied the complete patch.
  The predecessor V1 retains its original acceptance lineage and unchanged
  body; this transaction supersedes the whole authority with atomic backlinks.
  This acceptance changes lifecycle metadata only after review. Authority
  activates on merge; implementation is a subsequent REUSE task. Production
  apply authority remains NONE.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
date: 2026-10-28
revision: r1
candidate_base: 90d53b6200d3825f8b7c1e24533af28637085dab
scope:
  - packages/workflow-execution
  - packages/production-runtime
  - packages/broker
  - packages/scheduler
governed_by:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2
supersedes:
  - AGENT_CORE_WORKFLOW_STALE_REENTRY_V1
superseded_by: null
owners:
  - mayf3
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_EXECUTION_CONTROL_V1
    revision: 2c7e59a14d5d84ecc0688c47c30c5f04d0f05900
    relation: interoperates_with
    note: CTR-SWEC-010 companion proposal must be separately accepted before implementation
  - repository: mayf3/agent-forum
    authority_id: AGENT_FORUM_WORKFLOW_INSTANCE_CONTEXT_V1
    revision: 71882c48593599c550259892e255ec9c3d73b7f2
    relation: interoperates_with
---

# AGENT_CORE_WORKFLOW_STALE_REENTRY_V2

This whole-authority successor carries the complete V1 stale-reentry
authority and its inherited V2 execution obligations. Its only semantic
delta is the explicit separation of CTR-WEC1-008 Owner-resume admission from
stale admission, including the Owner-resumed automatic-continuation
exclusion. V1's original acceptance and scoped historical lineage remain
readable in V1; this is not a new partial supersession of that authority.
CTR-SRE-002's stale predicate and CTR-SRE-004's read-only quiescence mechanism
are preserved. This proposal authorizes no production action.

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
authority for this candidate. The original V1 acceptance is historical lineage, not acceptance of this
successor. This V2 candidate is INERT while `status: proposed`;
AGENT_CORE_WORKFLOW_STALE_REENTRY_V1 remains the active stale authority
until the successor transaction is accepted.

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
generation N+1 `attempt_planned` is legal under the CTR-SRE-003 stale
admission rule or the separate CTR-WEC1-008 Owner-resume authorization, and
only against the SAME identity triple
(dispatchIntentId, workflowInstanceId, ownerPrincipalId) as the attempt it
supersedes — a mismatch is a corrupt-ledger fail-loud.

The projection record carries, additively: `generation`, `dispatchCount`
(= generation), and on a re-plan `previousAttemptId` +
`retryReason: 'stale_no_progress'` for stale re-entry, or
`retryReason: 'owner_assistance_resolved'` with all CTR-WEC1-008 proof fields
for that separate authorization. `lastDispatchAtMs` is the current
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

For the stale path, `beginAttemptIfAbsent` admits generation N+1 iff the
current attempt is terminal with judgment `stale_no_progress` (CTR-SRE-002).
The only separate authorization is CTR-WEC1-008 in
`AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2`, with its complete Owner-proof,
known-settled predecessor, baseline, identity and single-consumption gates;
all other predecessors retain `already_attempted`. That path does not append
`stale_superseded` or relax the CTR-SRE-002 predicate. Owner-resumed attempts
are excluded from subsequent automatic stale/policy continuation; a further
Owner-resume requires a new post-baseline case and explicit resolve.
The re-plan runs the SAME admission path: fresh principal resolution → write-ahead
`delivery_started` → `router.deliver` with the SAME trusted provenance
shape (carrying the NEW attemptId) → `run_delivered`/`delivery_failed`/
`resolution_blocked` exactly as V2.

The ledger-level admission rule above is NECESSARY but not sufficient:
the stale generation N+1 delivery is additionally gated by CTR-SRE-004
(execution-layer quiescence). CTR-WEC1-008 requires its stronger positive
`settled` predecessor proof and preserves the same no-concurrent-execution
boundary.

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
  fresh under the ledger lock each pass. Attempts admitted with
  `retryReason: owner_assistance_resolved` are excluded from this automatic
  evaluation under CTR-WEC1-008. On confirmed staleness it appends
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
| CASE 4 | version advanced by assistance activity (OWNER_PENDING case open, Domain Owner resolve, or explicit HUMAN_REQUIRED escalation) or visit moved (RETURN/admin) → NOT stale; no stale redispatch. The separate CTR-WEC1-008 authorization may resume only a known-settled attempt with an exact post-baseline Owner-resolved case and the same active dispatch/visit/assignee; moved or changed ownership still rejects it |
| CASE 5 | instance terminal → NOT stale (and the intent leaves the due feed server-side) |
| CASE 6 | gen-2 advanced the version; old attempt's transition (old expectedWorkflowStateVersion) → svc 409 `workflow_state_version_conflict` (cited: svc transition_transaction test coverage — workflow-data layer, no DSH change required). Execution-layer concurrency is excluded by the quiescence gate, not by svc CAS |
| CASE 7 | two consecutive reconcile passes over the same stale occurrence → exactly ONE `stale_superseded`; gen-2 within its threshold window → `already_attempted`; quiescence deferrals are unbounded and side-effect-free; no unbounded redispatch |
| quiescence | `pending` turn ⇒ `deferred_quiescence`, zero deliveries, zero ledger appends; correlation-fallback path (handle lost) honours the same gate; `restart_lost` ⇒ quiescent ⇒ re-admission |
| settlement truth | no engine or wiring path settles/releases the router record: the r1 `resolveStaleTurn` seam does not exist; a real late event reaching the late machine settles with its TRUE outcome (router-side contract, unchanged) |
| replay | generation-1 events without a `generation` field project byte-compatibly; a gen-N+1 `attempt_planned` against a non-stale predecessor is corrupt-ledger fail-loud unless it has the complete valid CTR-WEC1-008 Owner-resume authorization. Identity mismatch, duplicate case consumption/generation, invalid baseline/proof, and unknown predecessor always fail. Legacy missing baseline remains readable but cannot authorize Owner-resume |
| Owner-resume separation | isolated actual engine/ledger tests (CTR-SRE-003/005 and CTR-WEC1-008) prove Assistance version changes remain NOT stale, exact Owner proof can admit one separate generation without stale_superseded, and Owner-resumed no-submission cannot automatically stale-redispatch. Required evidence: exact input facts, ledger replay and delivery counts; any bypass of proof/identity/unknown fences fails |
| wiring | threshold env parse: default 3600000; non-positive-integer rejected; disabled poller keeps the ledger evidence-only; no stale path references any router mutation seam |
