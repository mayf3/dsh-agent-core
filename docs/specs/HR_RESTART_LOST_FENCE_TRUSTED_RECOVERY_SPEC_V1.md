---
spec_id: HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1
status: draft
spec_kind: implementation
authority_level: governing_spec_candidate
revision: r1
revision_date: 2026-09-25
base_revision: origin/main b4e8511c533f8fa5be2f48dd56acc16bc79dff39
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
amends:
  spec: AGENT_PROCESS_LIFECYCLE_HARDENING_V3
  scope: >-
    Adds exactly one trusted terminationEvidence kind (`restart_quiescence_proven`)
    to the C-015 closed vocabulary and its durable/query validators, and names the
    second trusted path of the C-019/C-024 "separately accepted trusted mechanism"
    (post-restart permanent-quiescence proof). No other PLH_V3 clause, state
    machine, cap or shutdown ordering is changed. PLH_V3 text itself is NOT edited
    by this amendment; this standalone Spec is the amendment authority.
related_specs:
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V3
  - AGENT_CORE_LARK_UX_PHASE1_V3
related_reports:
  - docs/reports/scheduler-terminal-proof-unknown-containment-v1.md
  - docs/evidence/router-durable-generation-restart-safety-v1-20260921/REPORT.md
supersedes: []
superseded_by: null
implementation_started: NO
production_mutation: NO
scope:
  - restart-lost outcome_unknown active fence records (durable, blocked,
    failureReason=runtime_restart_ownership_unavailable)
  - root-authenticated whole-host quiescence proof bundle
  - exact single-record termination-only settlement at Router startup
out_of_scope:
  - live-runtime recovery (C-023..C-025 unchanged)
  - business outcome determination or upgrade
  - scheduler occurrence policy, retry, or any new taxonomy beyond one enum value
  - per-agent special-casing of any kind (the ID records the incident origin;
    the mechanism is generic over ALL agents)
---

# HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1

## 0. Result

```text
SPEC_CANDIDATE_READY = YES
RECOMMENDED_MECHANISM = root-authenticated whole-host quiescence proof bundle,
  consumed at Router startup, settling ONE exact record as
  terminated_without_outcome + terminationEvidence=restart_quiescence_proven
NEW_EVIDENCE_CLASS_REQUIRED = YES (6th value of the C-015 closed vocabulary;
  NOT a separate settlement field/authority)
RESTART_SAFETY_PREREQ = ROUTER_RESTART_SAFETY=PROVEN binary (generation floor,
  2097e4f+) deployed via trusted control plane BEFORE any recovery-related
  stop/restart; validator-before-producer binary ordering
IMPLEMENTATION_STARTED = NO
PRODUCTION_MUTATION = NO
```

## 1. DEVELOPMENT_PREFLIGHT

See the DEVELOPMENT_PREFLIGHT emitted with this candidate's transmittal
(identical content: governing authority, frozen boundaries, rejected
alternatives, `Need new/amended Spec = YES`).

## 2. Problem and live record class

A whole-Runtime restart orphans durable V3 reconciliation records whose prompt
was already written. `startup-recovery.js` (`restoreCrashInterruptedRecords`)
and `process-registry.js` (`restoreRecoveryFences`) classify them
fail-closed as:

```text
state = pending (queryState), initialOutcome = outcome_unknown
recoveryState = blocked
missingEvidence = [live_generation_ownership]
failureReason = runtime_restart_ownership_unavailable
nextSafeAction = reestablish_exact_ownership
fenceState = active
terminationEvidence = null, exitObservedAt = null
```

Live instances of this exact class (sanitized opaque identities, read from the
Owner-provided census; the protected store was NOT read or modified during
authoring):

```text
turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256   (agt_hr-agent)
same class: article-publisher s168, reader-simulator s30
```

Why the class is permanently stuck under the accepted contract alone:

1. `activeFenceForAgent` rejects every new business prompt for the agent
   (`AGENT_PROCESS_TURN_FENCED`); the agent is admission-dead until the fence
   clears.
2. Fence release requires C-015 termination evidence for the exact turn
   (C-016). The only post-restart source C-019 allows is re-established
   **live** ownership (exact processRef/child/ownership-token checks,
   C-020). For a retired runtime epoch the old processRef, ownership token
   and child handle no longer exist anywhere; live ownership can never be
   re-established.
3. C-019 forbids exactly the tempting shortcuts: "A new PID, elapsed time,
   absent PID lookup or new generation never proves the old generation
   terminated." C-024 forbids the wall-clock `hardDeadlineAt` from
   authorizing a signal after a whole-Runtime restart.
4. PLH_V3 C-019/C-024 therefore deliberately leave this class fenced
   "unless exact live ownership and deadline continuity are re-established
   by a **separately accepted trusted mechanism**" — which no accepted
   artifact yet defines. This Spec is that mechanism.

The existing trusted consumers correctly fail closed for this class today:
self-ops `reconcileTurn` returns `routerFailure(disposition)` (disposition is
`recovering`, never `terminated_without_outcome`); the scheduler-router
readback only trusts settled records with a trusted evidence kind; the bridge
keeps `outcome_unknown`. No consumer can be tricked into settling the class
today — and none may be weakened by this amendment.

## 3. Mechanism assessment

### 3.1 What a completed restart can truthfully prove

The turn executed inside the old Runtime's process tree. Termination of the
execution follows from three durable facts, none of which involves guessing:

1. **Retired epoch.** The record's `runtimeEpoch` is durably observed
   (retained by the store — `compactRuntimeEpochs` always retains every
   record's epoch) and differs from the current runtime epoch. The current
   runtime minted a fresh epoch (`store.js` constructor) and can never adopt
   the old one.
2. **Whole-host quiescence.** A root-authenticated census enumerates ALL
   processes on the deployment host and finds zero members of the Runtime
   deployment tree (wrapper, runtime entry, agent children) and zero holders
   of the subject agents' workspace/session lock paths.
3. **Generation floor.** With the restart-safety fix deployed
   (`highestIssuedGeneration`), the old `(agentId, processGeneration)` can
   never be reissued by a later runtime, so "no live member exists" cannot be
   silently repaired by identity reuse.

This is the same **truth class** as `child_real_exit`: it proves the exact
execution cannot continue; it proves nothing about success/failure. It is
NOT `child_real_exit` — that kind asserts the owning AgentProcess observed
the real exit of its child, and here the observer is gone. Recording this
proof as `child_real_exit` would falsify evidence and is forbidden
(RQ-006).

### 3.2 Assessment of the root-authenticated quiescence proof (Requirement 3)

**Verdict: SUFFICIENT for termination-only settlement on the single-host
deployment, after four minimal strengthenings.** The proof as stated
(intentional stop; old identity gone; complete root census without target
child; workspace/session holders absent; exact preimage binding) is sound;
the strengthenings close its residual gaps:

- **G1 — census completeness.** A bare targeted lookup is the forbidden
  "absent PID lookup". Strengthen to a COMPLETE host enumeration by root
  (all processes), with a closed tool list, captured output hashed (sha256)
  and archived. Absence is then derived from enumeration completeness, not
  from a target filter. Corroboration by a second independent enumeration
  method is required.
- **G2 — custody.** The census, stop receipts and bundles must be produced
  under root custody (sudo / trusted control plane) and deposited into a
  root-owned, non-group/non-world-writable evidence directory. Agent-level
  callers have no write path and no API that accepts a bundle. The runtime
  consumes bundles only from that directory, only at startup.
- **G3 — intent is not truth.** For records ALREADY orphaned by past
  restarts, a retroactive "intentional stop receipt" cannot exist and must
  NOT be manufactured; termination truth does not depend on the historical
  stop's intent (a crashed runtime is equally terminated). A controlled-stop
  receipt is REQUIRED only when the recovery plan itself includes a
  stop/restart (RQ-002 `controlledStop`). This keeps the mechanism honest
  while strengthening future operations.
- **G4 — TOCTOU.** The census proves absence at census time; the termination
  fact occurred at/before the old runtime stopped and cannot regress (a
  process cannot become un-exited; epoch retirement prevents identity
  resurrection). If any census ever DOES find a live old-tree member, the
  bundle is invalid and everything fails closed (RQ-003).

**Scope assumption (hard):** single-host deployment topology. The census is
authoritative for the deployment host only. If Agent children could ever run
on other hosts, this evidence class is INSUFFICIENT and must not settle
anything (RQ-008).

### 3.3 Guesswork family — rejected (Requirement 2)

Each is already rejected by PLH_V2/V3 and stays rejected here, with the
reason recorded:

| Rejected alternative | Why it stays rejected |
|---|---|
| elapsed time since restart ⇒ terminated | wall-clock carries no termination fact (C-024) |
| absent PID lookup ⇒ terminated | untrusted targeted absence; no completeness, no custody |
| new generation exists ⇒ old dead | generation identity is not causal; forbidden by C-019 |
| operator judgment / fixed wait | operator guesses are not proof (C-016) |
| record proof as `child_real_exit` | falsifies the observer-bound evidence kind (RQ-006) |
| settle as `failed`/`completed` | business outcome is not proven; termination-only (C-015/C-016) |

## 4. Requirement-4 decision: new evidence class, not a new authority

**Decision: extend the C-015 closed vocabulary with ONE new kind —
`restart_quiescence_proven` — and settle through the EXISTING settle-once
machine. A separate recovery-proof field or separate settlement authority is
REJECTED.**

Reasons:

1. C-016/C-017 fence release and settlement precedence are already keyed on
   `terminationEvidence ∈ trusted vocabulary` with settle-once CAS. A second
   field would fork the settlement authority into two winning paths and
   weaken the strongest invariant the store has.
2. Every trusted consumer already gates on the vocabulary: scheduler-router
   bridge `TERMINATION_EVIDENCE`, scheduler self-ops
   `TRUSTED_TERMINATION_EVIDENCE`, durable validator. One new kind flows
   through all of them with one-line set extensions; a new field would
   require every consumer to learn a second proof channel.
3. Truthfulness: the new kind says exactly what was proven — quiescence of
   the runtime hosting the generation after a restart — and deliberately
   does NOT claim child-exit observation.
4. Compatibility: the durable validator change is additive. Deployment
   ordering is pinned in RQ-007 (validator-before-producer); after any
   `restart_quiescence_proven` record is durable, rolling back to a binary
   whose validator lacks the value fails closed at store load
   (`durable_store_invalid`, admission blocked) — no corruption, but the
   rollback floor must be pinned in the deployment record (RQ-007).

Vocabulary disposition across the four closed sets:

| Set | File | Disposition |
|---|---|---|
| store settlement vocabulary | `packages/agent-router/src/reconciliation/state-machine.js` `TERMINATION_EVIDENCE_TYPES` | ADD `restart_quiescence_proven` |
| durable record validator | `packages/agent-router/src/reconciliation/durable-file.js` `TERMINATION_EVIDENCE` | ADD `restart_quiescence_proven` (must deploy before any producer) |
| scheduler-router bridge | `packages/scheduler-router/src/index.js` `TERMINATION_EVIDENCE` | ADD `restart_quiescence_proven` (end-to-end convergence; see RQ-009) |
| scheduler self-ops | `packages/scheduler/src/self-ops/invoker-outcome.js` `TRUSTED_TERMINATION_EVIDENCE` | ADD `restart_quiescence_proven` |

`exact_started_then_idle` remains absent from the two scheduler-side sets —
pre-existing, deliberate, and NOT changed by this Spec (no readback producer
exists for it; delta stays minimal).

## 5. Normative clauses

### RQ-001 — Evidence class definition

`restart_quiescence_proven` is trusted termination-only evidence for an exact
unresolved `outcome_unknown` record if and only if a valid
`QuiescenceProofBundle` (RQ-002/003) proves, for that record's exact
`(runtimeEpoch, agentId, processGeneration, reconciliationHandle)`:

1. the record's runtime epoch is durably retired (present in the store's
   epoch set and different from the consuming runtime's epoch);
2. a root-custody complete host census found zero processes of the Runtime
   deployment tree and zero holders of the subject agents'
   workspace/session lock paths;
3. the restart-safety prerequisite (RQ-007) held for every restart since the
   record's epoch was current;
4. when the recovery plan included a stop/restart, an authenticated
   controlled-stop receipt is bound into the bundle.

The kind proves ONLY that the exact execution cannot continue. It never
proves success, failure, side-effect absence, or any business outcome.

### RQ-002 — QuiescenceProofBundle (closed shape, bounded)

```text
QuiescenceProofBundle = {
  bundleSchemaVersion: 1,
  subject: { reconciliationHandle, turnExecutionId == reconciliationHandle,
             runtimeEpoch, agentId, processGeneration },        // ONE exact record
  epochRetirement: { retiredEpoch == subject.runtimeEpoch },
  hostCensus: { executedAtWallMs, hostId,
                tools: [closed enum, >= 2 independent methods],
                outputsSha256: [..], archiveRef,
                runtimeTreeProcessCount: 0 },
  holderCheck: { method: closed enum, paths: [bounded <= 16],
                 openHolderCount: 0 },
  custody: { executedAs: 'root',
             producedBy: closed enum ['trusted_cp_recovery_evidence_collector_v1'],
             evidenceDir },
  controlledStop: null | { method: closed enum, receiptSha256, atWallMs }
}
MAX_BUNDLE_BYTES = 65536
```

One bundle is bound to ONE `reconciliationHandle`. A bundle naming more than
one subject, or a directory holding two different bundles for the same
handle, is invalid (fail closed). Bundles are inputs; they are never written
into the reconciliation store. The store's own bounded caps
(MAX_RECONCILIATION_RECORD_BYTES etc.) continue to govern the record.

### RQ-003 — Bundle validation (fail closed on every element)

Before ANY mutation, the consumer validates, in order, and records a
structured reject reason otherwise:

```text
V1  file custody: root-owned, not group/world writable, <= MAX_BUNDLE_BYTES
V2  schema: closed shape, version 1, closed enums, digest recomputation
V3  single-subject binding: subject.reconciliationHandle == target handle
V4  epoch: retiredEpoch == record.runtimeEpoch != consuming runtime epoch,
    and retiredEpoch is in the store's durable epoch set
V5  census: runtimeTreeProcessCount == 0 AND openHolderCount == 0
V6  custody.producedBy/executedAs within closed enums
V7  controlledStop present iff the recovery plan declared a stop/restart
V8  record preimage predicates (RQ-004 P1..P10) all hold
```

Any invalid element ⇒ ZERO-WRITE; the record remains exactly as before
(blocked, fenced); the result is a bounded audit entry on the store's own
diagnostics plus a structured health/reason exposure — never a silent drop.
UNKNOWN or unverifiable ⇒ same as invalid (fail closed).

### RQ-004 — Exact single-record settlement (preimage + cmp, real constructors)

The settlement operation is keyed by `reconciliationHandle` ONLY. There is NO
by-agent, by-epoch, or bulk entry point. Preconditions (all must hold;
checked against the durable record immediately before mutation):

```text
P1  record exists for the exact handle
P2  record.runtimeEpoch == bundle.subject.runtimeEpoch (retired, != current)
P3  record.agentId == bundle.subject.agentId
P4  record.processGeneration == bundle.subject.processGeneration
P5  record.state != 'settled' (queryState pending)
P6  record.initialOutcome == 'outcome_unknown'
P7  record.recoveryState == 'blocked'
P8  record.failureReason == 'runtime_restart_ownership_unavailable'
P9  record.terminationEvidence == null AND record.exitObservedAt == null
P10 record.fenceState == 'active'
```

Effect — via the REAL store constructors only (settle-once CAS
`settleLate` + `recordRecoveryAction` + `markFenceCleared`, all through the
transactional `mutateRecord` preimage/rollback machinery):

```text
settleLate(handle, { lateOutcome: 'terminated_without_outcome',
                     terminationEvidence: 'restart_quiescence_proven',
                     exitObserved: false })          // exitObservedAt stays NULL
then, same logical operation:
  attemptedActions += registry_cleanup(succeeded,
      reasonCode='restart_quiescence_no_live_slot_old_epoch')   // old epoch:
      // no live registry slot exists or can exist; nothing to CAS
  failureReason = null
  fenceState = 'cleared' (markFenceCleared)
  nextSafeAction = 'send_new_request_after_reopened'
```

Constraints:

- `exitObservedAt` remains `null` forever for this class — no exit was
  observed by any owner; writing it would falsify evidence.
- `finalAssistantOutput` is never supplied; no output is minted or replayed.
- Business outcome remains `outcome_unknown` at the business layer; the
  record's `settlementResult` is `terminated_without_outcome` (C-017).
- Crash between the settle and the fence-clear sub-steps converges at the
  next startup through the EXISTING `restoreCrashInterruptedRecords`
  may-finish-cleanup branch (settled + unknown + active fence + evidence
  present + no reapClaim ⇒ fence cleared). No new crash-recovery state is
  introduced.
- Preimage + cmp + rollback: validation is pure; the mutations go through
  `mutateRecord`'s structuredClone-preimage with restore-on-failure; any
  persistence failure restores the preimage exactly and reports failure —
  no partial record.
- Replay of an already-settled handle ⇒ existing settle-once behavior:
  `duplicate_ignored`/`conflict_ignored` bounded audit only, zero state
  change, zero second emission.

### RQ-005 — Startup consumption; restart only after validation

Bundles are consumed only by the Router startup recovery path, BEFORE the
fail-closed business-admission barrier opens (C-019 barrier discipline):

```text
durable store opens + schema/caps validate
-> consume evidence dir: validate each bundle (RQ-003), settle each exact
   record (RQ-004) — per-record results (settled | zero-write+reason)
   appended as bounded audit
-> install remaining unresolved fences
-> open business admission barrier
```

An invalid or missing bundle never blocks the fleet: the affected record
simply remains blocked with its structured reason, and the invalid-bundle
event fails loud in health/diagnostics (tampering indicator). A business
prompt arriving during processing is `not_admitted` (barrier still closed).

Any stop/restart that is part of a recovery plan may be performed only after
the RQ-007 prerequisites validate; the plan must carry the validated
prerequisite set in its run record.

### RQ-006 — No falsification, no replay, no sweep

```text
FALSIFIED_CHILD_REAL_EXIT = FORBIDDEN   (this class can never write that kind)
ORIGINAL_PROMPT_REPLAY = 0
ORIGINAL_ANSWER_REPLAY = 0
HISTORICAL_SIDE_EFFECT_REPLAY = 0
BY_AGENT_SWEEP_ENTRY_POINT = 0          (handle-keyed only; one call = one record)
BULK_BY_EPOCH_ENTRY_POINT = 0
```

Three stuck records (e.g. the live HR / article-publisher / reader-simulator
set) settle as THREE independent exact operations; they may share one census
archive but each carries its own subject-bound bundle.

### RQ-007 — Deployment prerequisites (Requirement 6)

Before any stop/restart performed as part of, or as a precondition of, this
mechanism:

1. **Restart-safety floor PROVEN.** The deployed binary includes the durable
   generation restart-safety floor (`highestIssuedGeneration`,
   main ≥ `2097e4f`) and `ROUTER_RESTART_SAFETY = PROVEN`
   (docs/evidence/router-durable-generation-restart-safety-v1-20260921).
   Without the floor, a restart reissues generation ids and breaks both the
   store's range invariants and this mechanism's exact identity binding —
   so no recovery restart is permitted on a pre-floor binary.
2. **Validator-before-producer ordering.** The binary that EXTENDS the
   durable validator (RQ-00 vocabulary table) is deployed first; only then
   may any settlement write the new kind. Deployments go through the trusted
   control plane (TRUSTED_CP_PACK_INPUT_PROVENANCE_V1 installer,
   production-deploy.lock discipline).
3. **Rollback floor pinned.** After any `restart_quiescence_proven` record
   is durable, rollback below the validator-extended binary fails closed at
   store load; the deployment record must pin that minimum binary.
4. **Recovery plan prerequisites validated first** (RQ-005 last paragraph):
   restart-safety PROVEN, lock discipline, bundle tooling availability.

### RQ-008 — Single-host scope assumption

The census is authoritative for ONE deployment host. The bundle records
`hostId`; the consumer must reject a bundle whose hostId differs from the
consuming host. If the deployment topology ever becomes multi-host, this
evidence class is INSUFFICIENT by definition and MUST NOT settle records; a
successor authority would be required (this Spec does not anticipate one).

### RQ-009 — Amendment disposition and downstream convergence

- PLH_V3 C-015 vocabulary gains item 6: `restart_quiescence_proven`
  (restart-lost class only; live-runtime settlements keep the existing five).
- PLH_V3 C-019/C-024 "separately accepted trusted mechanism" is satisfied by
  TWO named paths, both exact-identity-bound: (i) re-established live
  ownership (existing, unchanged); (ii) this permanent-quiescence proof for
  retired epochs (new). Path (ii) applies ONLY to records matching RQ-004
  P1..P10.
- The scheduler-router bridge and scheduler self-ops vocabularies add the
  new kind so the END-TO-END path converges: after a Router-side settlement,
  a late bridge readback stamps the trusted proof and the scheduler's C-039
  termination-only settlement releases the occurrence fence with business
  state still `outcome_unknown`, `retryCandidate` stays null, and a later
  `self_ops reconcile_turn` replays the same receipt zero-write. No other
  scheduler semantics change.
- C-026 outer projection: `terminationEvidence` may now surface the new
  value; no new top-level key, no new failure taxonomy member (the existing
  `recovery_ownership_unavailable` reason code continues to describe the
  PRE-settlement blocked state).

### RQ-010 — HR neutrality

The incident-origin ID of this Spec MUST NOT be read as an HR carve-out: the
mechanism is generic over all agents and all records of the class; no
agentId, discriminator, route, or workspace predicate appears in any clause.
The live HR/article-publisher/reader-simulator records are instances, not
targets of special-casing.

## 6. Acceptance tests

All tests are deterministic store/startup-level harnesses in the agent-router
(process-lifecycle) and scheduler test suites; no production store, no real
restart, no root actions (the custody/census predicates are injected as
fixtures; the collector script itself is validated separately as evidence
tooling).

| ID | Contract | Case | Expected |
|---|---|---|---|
| ACC-RQ-001 | RQ-004 | happy path: valid bundle + exact blocked record at startup | settled `terminated_without_outcome`, `terminationEvidence=restart_quiescence_proven`, fence cleared, `exitObservedAt=null`, `failureReason=null`, `nextSafeAction=send_new_request_after_reopened`, admission reopened for the agent |
| ACC-RQ-002 | RQ-006 | three records of the class, one census archive, three subject-bound bundles | three independent exact settlements, order-independent, each handle-keyed; no bulk call exists |
| ACC-RQ-003 | RQ-005 | fenced prompt before processing, valid prompt after barrier | before: `not_admitted` fenced projection; after: admitted and executed |
| ACC-RQ-004 | RQ-004 | durable round-trip: restart the store again | record still settled, queries repeatable and byte-identical (C-018) |
| ACC-RQ-005 | RQ-004 | crash between settle and fence clear | next startup completes fence clear via EXISTING may-finish-cleanup branch; zero new recovery state |
| ACC-RQ-006 | RQ-009 | scheduler end-to-end: unknown occurrence + Router-settled record | bridge readback stamps proof; C-039 termination-only settlement; fence released; business state stays `outcome_unknown`; no retry minted even with retry.auto=true; later reconcile_turn = receipt zero-write |
| ACC-RQ-007 | RQ-003/004 | preimage+cmp: inject persist failure mid-settlement | record restored to exact preimage; structured failure; no partial write |
| ACC-RQ-008 | RQ-007 | validator ordering: old validator sees new-kind record | durable load fails closed `durable_store_invalid`, admission blocked, records intact (documented rollback floor) |

## 7. Negative / security test matrix

| ID | Attack / fault | Required behavior |
|---|---|---|
| NEG-RQ-001 | bundle absent / dir empty | zero-write; record stays blocked with structured reason; fleet admission unaffected |
| NEG-RQ-002 | record preconditions mismatch (settled / other epoch / other gen / evidence already set / fence cleared / failureReason different) | V8 fails; zero-write; exact failed-predicate list in diagnostics |
| NEG-RQ-003 | custody invalid: non-root-owned, group/world-writable, oversized bundle | V1 fails; zero-write; fail-loud tamper indicator |
| NEG-RQ-004 | digest mismatch / recomputed hash differs | V2 fails; zero-write |
| NEG-RQ-005 | census finds any runtime-tree process or workspace/session holder (matchedProcessCount>0 / openHolderCount>0) | V5 fails; zero-write |
| NEG-RQ-006 | retiredEpoch == consuming runtime epoch (live runtime asked to quiesce-settle its own epoch) | V4 fails; zero-write |
| NEG-RQ-007 | two different bundles for one handle; or one bundle naming two subjects | invalid (RQ-002); zero-write |
| NEG-RQ-008 | replay settlement of already-settled handle | settle-once `duplicate_ignored`/`conflict_ignored` audit only; no rewrite, no second emission |
| NEG-RQ-009 | conflicting late evidence after quiescence settlement | `conflict_ignored`; state immutable (C-017) |
| NEG-RQ-010 | caller attempts agent-keyed or epoch-keyed sweep via any surface | no such entry point exists; constructor rejects non-handle keys; test proves absence |
| NEG-RQ-011 | attempt to mint `child_real_exit` from the quiescence path | kind is hard-coded; impossible by construction; test asserts the exact kind written |
| NEG-RQ-012 | controlledStop missing while plan declared a restart (or present without one) | V7 fails; zero-write |
| NEG-RQ-013 | hostId mismatch (bundle from another host) | rejected (RQ-008); zero-write |
| NEG-RQ-014 | business prompt arrives while startup bundle processing is in flight | `not_admitted`; barrier discipline holds (C-019) |
| NEG-RQ-015 | forged bundle written by a non-root actor | no write path to the evidence dir; custody check V1 rejects; no runtime API accepts bundles |
| NEG-RQ-016 | capacity pressure during settlement | existing byte-cap behavior: fail-loud, preimage restored; unresolved record never evicted (BOUNDED rule 8/13) |

## 8. Implementation paths (when, and only when, accepted)

MAY change:

```text
packages/agent-router/src/reconciliation/state-machine.js     (+1 enum member;
                                                               +1 settlement constructor)
packages/agent-router/src/reconciliation/durable-file.js      (+1 validator enum member)
packages/agent-router/src/reconciliation/startup-recovery.js  (bundle consumption step)
packages/agent-router/src/index.js                            (evidence-dir cfg wiring)
packages/scheduler-router/src/index.js                        (+1 bridge enum member)
packages/scheduler/src/self-ops/invoker-outcome.js            (+1 enum member)
packages/agent-router/test/process-lifecycle/*.test.js        (ACC-RQ/NEG-RQ suites)
packages/scheduler/test/*.test.js                             (ACC-RQ-006 extension)
trusted control-plane evidence collector script               (root custody producer)
```

MUST NOT change:

```text
C-015 semantics for the five existing kinds
C-017 settle-once machine, precedence, audit behavior
C-018 non-consuming queries, bounded caps, eviction rules
C-020..C-022 shutdown/ownership/kill model (live-runtime REAP path)
C-023..C-025 live-runtime recovery coordinator
PLH_V3 spec text (this Spec is the amendment authority)
any scheduler retry/occurrence policy or new failure taxonomy member
```

## 9. Gates

```text
INDEPENDENT_REVIEW      = required, PASS with BLOCKERS=NONE, on this frozen SHA
OWNER_ACCEPTANCE        = required after review; the decision packet carries the
                          exact YES/NO wording
IMPLEMENTATION          = forbidden until BOTH gates pass
PRODUCTION_APPLY        = separately authorized; never implied by acceptance
IMPLEMENTATION_STARTED  = NO
PRODUCTION_MUTATION     = NO
```

## 10. Frozen decisions checklist

```text
MECHANISM                       = startup-consumed root-authenticated whole-host
                                  quiescence proof (bundle), single-host scope
NEW_EVIDENCE_CLASS_REQUIRED     = YES (`restart_quiescence_proven`, 6th C-015 kind)
SEPARATE_SETTLEMENT_AUTHORITY   = NO (rejected; forks C-017 authority)
SETTLEMENT_KIND                 = terminated_without_outcome (termination-only)
EXIT_OBSERVED_AT                = stays null (never falsified)
EFFECT_SCOPE                    = one record per operation, handle-keyed,
                                  preimage+cmp+rollback, real constructors only
FAIL_CLOSED                     = every unknown/invalid element zero-writes
BARRIER                         = opens only after bundle processing completes
REPLAY                          = 0 (prompt/answer/side-effect)
SWEEP                           = 0 (no by-agent / by-epoch entry point)
RESTART_SAFETY_PREREQ           = ROUTER_RESTART_SAFETY=PROVEN + validator-before-
                                  producer ordering + pinned rollback floor
LIVE_RUNTIME_RECOVERY           = unchanged (C-023..C-025 path (i))
```
