---
spec_id: HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1
status: superseded
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
revision: r4
revision_date: 2026-09-25
accepted_by: mayf3
accepted_date: 2026-09-25
accepted_reviewed_head: 5726f43f9c028a8967720ccaff49a054ee1423e6
accepted_reviewed_spec_sha256: fb5a5f825900b4c77ff681283cb51b5f914f449adda6789949f39dffeb60ad78
independent_review_result: PASS_READY_FOR_OWNER_ACCEPTANCE
independent_review_record: docs/reports/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V1_R4_INDEPENDENT_REVIEW.md
independent_review_sha256: 0fc932ba8dc4100255ea0f4db756fcd8d5f23e62aa84e1237610d652948056b3
owner_acceptance_record: docs/reports/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V1_R4_OWNER_ACCEPTANCE.json
owner_acceptance_sha256: 1575ad24f57f42e97ef612358360367f2c959a1c7e9d486b5bcea47eb132da3b
owner_decisions: "Q1=YES; Q2=YES; nonproduction implementation only"
base_revision: origin/main b4e8511c533f8fa5be2f48dd56acc16bc79dff39
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
external_authorities: []
owners:
  - mayf3
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
  - docs/evidence/router-durable-generation-restart-safety-v1-20260921/PROOF_INDEX.md
supersedes: []
superseded_by: HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2
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
SPEC_CANDIDATE_READY = PENDING_B4_INDEPENDENT_REVIEW
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

### 3.1 What a prospective recovery cutover can truthfully prove

The turn executed inside the old Runtime's process tree. A completed restart
alone proves nothing. Termination of the exact execution follows only from a
current, controlled recovery cutover with three separate facts:

1. **Retired epoch.** The record's `runtimeEpoch` is durably observed
   (retained by the store — `compactRuntimeEpochs` always retains every
   record's epoch) and differs from the current runtime epoch. The current
   runtime minted a fresh epoch (`store.js` constructor) and can never adopt
   the old one.
2. **Causal whole-host quiescence.** After the exact record already exists and
   all sources capable of resuming its old execution are stopped or inhibited
   under one exclusive root-controlled window, a root-authenticated COMPLETE
   census enumerates all processes on the deployment host and finds zero
   Runtime-tree members and zero relevant workspace/session holders. The
   census is bound to this window and precedes its one authorized startup;
   an unrelated earlier archive is insufficient.
3. **No resumption after the cut.** Root custody maintains exclusive control
   of launch sources through the census and authorized startup. The new
   runtime has a fresh epoch and keeps the old record fenced until settlement;
   it cannot resume or replay the old turn. Full C-019 identity includes the
   epoch and handle: prior reuse of a bare generation number is neither
   proof of termination nor an automatic identity alias. The durable store
   must still pass its accepted validator and exact preimage checks.

The restart-safety floor is a separate FORWARD deployment prerequisite:
`ROUTER_RESTART_SAFETY = PROVEN` must hold before this recovery operation's
stop/restart. It prevents future issuance damage. It does not establish that
the floor held across historical restarts and is never cited as proof of
historical non-reuse. Records such as s256 with a pre-floor intervening
restart can be eligible only through the current cutover proof; no past
duplicate work or business outcome is inferred.

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
- **G4 — causal cut and no resumption.** The census must occur inside the
  exclusive recovery window after the subject record's possible execution
  history and after all old execution/launch sources are quiesced. Root
  custody inhibits their resumption until the one bound new-runtime startup.
  The startup nonce, live window ownership, host and deployment receipts bind
  the archive to that startup. An earlier zero-process census or an unproven
  launch-source gap is invalid. If any census finds a live old-tree member,
  the bundle is invalid and everything fails closed (RQ-003).

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
2. Six closed sets gate settlement, durable validation, scheduler-router
   readback, scheduler occurrence authority, and self-ops diagnosis. All six
   add the same `restart_quiescence_proven` value verbatim, without a
   scheduler-local mapping; a new field would
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

Vocabulary disposition across all six closed sets:

| Set | File | Disposition |
|---|---|---|
| store settlement vocabulary | `packages/agent-router/src/reconciliation/state-machine.js` `TERMINATION_EVIDENCE_TYPES` | ADD `restart_quiescence_proven` |
| durable record validator | `packages/agent-router/src/reconciliation/durable-file.js` `TERMINATION_EVIDENCE` | ADD `restart_quiescence_proven` (must deploy before any producer) |
| scheduler-router bridge | `packages/scheduler-router/src/index.js` `TERMINATION_EVIDENCE` | ADD `restart_quiescence_proven` (end-to-end convergence; see RQ-009) |
| scheduler self-ops | `packages/scheduler/src/self-ops/invoker-outcome.js` `TRUSTED_TERMINATION_EVIDENCE` | ADD `restart_quiescence_proven` |
| scheduler occurrence authority validator | `packages/scheduler/src/occurrence-model.js` `TERMINATION_EVIDENCE_KINDS` | ADD `restart_quiescence_proven` verbatim so the occurrence settlement remains valid |
| scheduler self-ops diagnosis | `packages/scheduler/src/self-ops/diagnosis.js` `ROUTER_TERMINATION_EVIDENCE` | ADD `restart_quiescence_proven` verbatim so `reconcile_turn` recognizes the receipt |

`exact_started_then_idle` remains absent from the four scheduler-side sets —
pre-existing, deliberate, and NOT changed by this Spec (no readback producer
exists for it; delta stays minimal).

## 5. Normative clauses

### RQ-001 — Evidence class definition

`restart_quiescence_proven` is trusted termination-only evidence for an exact
unresolved `outcome_unknown` record if and only if a valid
`QuiescenceProofBundle` (RQ-002/003) proves, for that record's exact
`(runtimeEpoch, agentId, processGeneration, turnExecutionId =
reconciliationHandle)`:

1. the record's runtime epoch is durably retired (present in the store's
   epoch set and different from the consuming runtime's epoch);
2. a root-custody complete host census found zero processes of the Runtime
   deployment tree and zero holders of the subject agents'
   workspace/session lock paths;
3. a present, exclusive, root-controlled cutover window causally binds the
   subject's durable preimage, stopped/inhibited old execution sources,
   COMPLETE zero-member census, and one authorized startup with no old-turn
   resumption or replay; the deployed restart-safety floor is independently
   PROVEN before this recovery operation's stop/restart (RQ-007), without
   asserting anything about pre-floor historical restarts;
4. when the recovery plan included a stop/restart, an authenticated
   controlled-stop receipt is bound into the bundle.

The kind proves ONLY that the exact execution cannot continue. It never
proves success, failure, side-effect absence, or any business outcome.

### RQ-002 — QuiescenceProofBundle (closed shape, bounded)

```text
QuiescenceProofBundle = {
  bundleSchemaVersion: 2,
  subject: { reconciliationHandle, turnExecutionId == reconciliationHandle,
             runtimeEpoch, agentId, processGeneration },        // ONE exact record
  epochRetirement: { retiredEpoch == subject.runtimeEpoch },
  recoveryCutover: { operationId, hostId, startupNonce,
                     subjectPreimageSha256,
                     exclusiveWindowReceiptSha256,
                     launchSourcesInhibitedReceiptSha256,
                     oldTreeQuiescedReceiptSha256,
                     launchAuthorizationReceiptSha256,
                     windowOpenedAtWallMs, oldTreeQuiescedAtWallMs,
                     authorizedStartupAtWallMs,
                     consumingBinarySha256 },
  deploymentProof: { floorProvenReceiptSha256,
                     validatorInstalledReceiptSha256,
                     deployedBinarySha256 },
  hostCensus: { operationId, executedAtWallMs, hostId,
                tools: [closed enum, >= 2 independent methods],
                outputsSha256: [..], archiveRef,
                runtimeTreeProcessCount: 0 },
  holderCheck: { operationId, executedAtWallMs,
                 method: closed enum, paths: [bounded <= 16],
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
handle, is invalid (fail closed). The root-owned receipt references above are
content digests of exact trusted-control-plane records, not operator claims.
The bound startup nonce is unique to the ONE launch and supplied by its
trusted root launcher to the startup consumer. `authorizedStartupAtWallMs`
is the root launch-authorization event written after the census and
immediately before that launcher executes the pinned binary, not a forecast
or an operator-entered time. The independently sealed, immutable launch
authorization receipt identified by `launchAuthorizationReceiptSha256`
records the same `operationId`, `hostId`, unique `startupNonce`, pinned
`consumingBinarySha256`, exact census archive/output digests and the complete
`holderCheck` fields used by this bundle. Its authorization event occurs after both
observations and before the sole launch; the receipt is sealed before the
final bundle and is never self-digested. These are inputs; they are never written
into the reconciliation store. The store's own bounded caps
(MAX_RECONCILIATION_RECORD_BYTES etc.) continue to govern the record.

### RQ-003 — Bundle validation (fail closed on every element)

Before ANY mutation, the consumer validates, in order, and records a
structured reject reason otherwise:

```text
V1  file custody: root-owned, not group/world writable, <= MAX_BUNDLE_BYTES
V2  schema: closed shape, version 2, closed enums, digest recomputation
V3  single-subject binding: subject.reconciliationHandle == target handle ==
    subject.turnExecutionId; the durable record's projected handle/turnExecutionId
    equality, complete canonical tuple,
    and issuance/handle consistency pass the accepted store validator
V4  epoch: retiredEpoch == record.runtimeEpoch != consuming runtime epoch,
    and retiredEpoch is in the store's durable epoch set
V5  census: runtimeTreeProcessCount == 0 AND openHolderCount == 0;
    both complete enumerations bind to the SAME operationId/hostId and occur
    after oldTreeQuiescedAtWallMs, before authorizedStartupAtWallMs
V6  custody.producedBy/executedAs within closed enums
V7  controlledStop present iff the recovery plan declared a stop/restart
V8  record preimage predicates (RQ-004 P1..P10) all hold
V9  current cutover: subject preimage digest matches the durable exact record;
    root-owned exclusive-window, launch-source inhibition, old-tree stop,
    archive and launch-authorization receipts all resolve from root custody
    and digest-verify. The launch authorization binds the same operationId,
    hostId, unique startup nonce, pinned binary, exact census archive/output
    digests and all `holderCheck` fields; its event follows both observations
    and precedes the sole launch. A missing, mismatched, or unverifiable
    `launchAuthorizationReceiptSha256` rejects with ZERO-WRITE. The consuming
    startup received that nonce from the trusted root launcher, observes its
    own fresh epoch, and verifies the exclusive window is STILL held through
    consumption. The subject record predates the cut; no old execution source
    may resume or replay between census and consumption. Missing/UNKNOWN
    continuity or unrelated earlier census rejects.
V10 forward deployment: trusted deployment receipt and post-deploy proofs
    establish ROUTER_RESTART_SAFETY=PROVEN for the actual deployed binary
    BEFORE this operation's stop/restart; the consuming binary digest matches
    and includes the new-kind validator BEFORE any producer write. A merged
    source commit, proof index, or historical inference cannot satisfy V10.
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
P1  record exists for the exact handle; record.handle == handle and its durable
    projection has reconciliationHandle == turnExecutionId == handle
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
separate deployment authority establishes RQ-007 floor PROVEN + validator
-> trusted control plane acquires the one global production lock and proves
   exclusive control of all Runtime launch/resumption sources on this host
-> while admission remains fenced: capture exact durable subject preimage;
   stop/inhibit old Runtime tree; complete post-stop root census + holder check;
   root launcher independently seals one nonce-bound launch authorization
   receipt referencing those exact proof bytes; seals the operation-bound
   bundle with its receipt digest; then executes ONE pinned fresh-epoch binary
-> durable store opens + schema/caps/issuance/handle validate
-> consume evidence dir: validate each bundle (RQ-003), settle each exact
   record (RQ-004) — per-record results (settled | zero-write+reason)
   appended as bounded audit
-> install remaining unresolved fences
-> open business admission barrier
-> trusted control plane may close the exclusive window after startup
   consumption and readback; UNKNOWN window continuity fails the subject
   closed rather than releasing its fence
```

An invalid or missing bundle never blocks the fleet: the affected record
simply remains blocked with its structured reason, and the invalid-bundle
event fails loud in health/diagnostics (tampering indicator). A business
prompt arriving during processing is `not_admitted` (barrier still closed).
This window cannot be substituted with a past census: the root launcher binds
its one startup nonce to the bundle, and the consumer checks live exclusive
window ownership at consumption. The control plane must inhibit other
automatic/manual launch paths until its authorized startup is established;
if it cannot demonstrate that control, it must not produce a valid bundle.
The collector/launcher and live exclusive-window verification are proposed
privileged obligations. The production lock alone grants neither capability:
implementation and any operation require an applicable separately accepted
and explicitly bootstrapped control-plane authority before these effects.
The new runtime never receives an old ownership token or old-turn replay
instruction; its fresh epoch and the surviving old fence prevent old-turn
admission. No source history or unrelated record is repaired.

Any stop/restart that is part of a recovery plan may be performed only after
the RQ-007 prerequisites validate; the plan must carry the validated
prerequisite set in its run record. This prospective operation cannot make
the floor PROVEN itself. Neither its new proof nor a later deployment receipt
claims that the floor held across prior restarts.

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
   (committed proof-status index:
   `docs/evidence/router-durable-generation-restart-safety-v1-20260921/PROOF_INDEX.md`).
   This is a hard gate, not a claim of present proof: as of 2026-09-25 the fix
   is merged to main (`2097e4f9`, with follow-up `2a85d065`) and independently
   reviewed, but the deployed binary remains pre-floor, deployment is pending,
   and the designated post-deploy proof location reports
   `ROUTER_RESTART_SAFETY = PROVEN 未达成` (proofs 1–9 pending).
   Without the floor, a restart reissues generation ids and breaks both the
   store's range invariants and this mechanism's exact identity binding —
   so no recovery restart is permitted on a pre-floor binary.
   This applies prospectively to the recovery operation, not retroactively
   to every restart since the target epoch. A historically reused bare
   generation does not select a record; malformed/overlapping durable
   issuance or ambiguous full identity still fails the accepted validator.
2. **Validator-before-producer ordering.** The binary that EXTENDS the
   durable validator (§4 vocabulary table) is deployed first; only then
   may any settlement write the new kind. Deployments go through the trusted
   control plane (TRUSTED_CP_PACK_INPUT_PROVENANCE_V1 installer,
   production-deploy.lock discipline).
3. **Rollback floor pinned.** After any `restart_quiescence_proven` record
   is durable, rollback below the validator-extended binary fails closed at
   store load; the deployment record must pin that minimum binary.
4. **Recovery plan prerequisites validated first** (RQ-005 last paragraph):
   restart-safety PROVEN, lock discipline, exclusive launch-source control,
   bundle tooling availability. The preflight resolves actual deployed
   binary/proof receipts before the window opens; the startup consumer
   re-verifies their hashes, ordering, and binding under RQ-003 V9/V10.

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
- All six §4 closed sets add the same new kind verbatim. The scheduler-router
  bridge, self-ops invoker, occurrence authority validator, and self-ops
  diagnosis must all recognize it so the END-TO-END path converges: after a Router-side settlement,
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
| ACC-RQ-009 | RQ-001/003/005 | s256-shaped exact record survived an explicitly pre-floor restart; valid store, future floor PROVEN before operation, one causal exclusive cut and matching fresh startup | exact record alone settles termination-only; old business outcome remains unknown, exitObservedAt null, no replay; historical floor is not asserted |
| ACC-RQ-010 | RQ-001/003/004 | a second record reuses bare generation 1 under another epoch while the valid bundle binds s256's full handle/epoch | only the bound s256-shaped record can settle; second record byte-identical, no by-generation selection |

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
| NEG-RQ-017 | later floor proof exists but current causal cut is absent, or census precedes subject history / belongs to another host or window | V5/V9 rejects; zero-write, original fence remains active |
| NEG-RQ-018 | old tree/holder still live, launch-source inhibition or exclusive lock not proven through consumption, launch-authorization receipt missing/wrong/digest-mismatched or not bound to exact census/holder proofs, wrong/reused startup nonce, or authorized-startup ordering unknown | V5/V9 rejects; zero-write, no old-turn replay |
| NEG-RQ-019 | deployed floor proof or new-kind validator receipt missing/mismatched/not effective before recovery stop, or durable issuance/handle identity corrupt or aliased | V10 or existing store validator rejects before settlement; no history repair, zero-write |

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
packages/scheduler/src/occurrence-model.js                    (+1 occurrence authority enum member)
packages/scheduler/src/self-ops/diagnosis.js                  (+1 router evidence enum member)
packages/agent-router/test/process-lifecycle/*.test.js        (ACC-RQ/NEG-RQ suites)
packages/scheduler/test/*.test.js                             (ACC-RQ-006 extension)
trusted control-plane evidence collector/launcher script      (root custody
                                                               cutover receipts and nonce)
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
TEMPORAL_PROOF                  = prospective exclusive stop-census-one-startup
                                  cut; pre-floor history is allowed only with
                                  valid present identity and this causal cut
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
