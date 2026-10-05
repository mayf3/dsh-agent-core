---
spec_id: HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
accepted_by: mayf3
accepted_date: 2026-09-26
accepted_reviewed_head: 94eb53c48856d850a77a0d64ada6566f9fcd13d4
accepted_reviewed_spec_sha256: 62a105cc1cc34160253b938d55637898cb1ff93d75096331d450b2fa042ee259
independent_review_result: PASS_READY_FOR_OWNER_ACCEPTANCE
independent_review_record: docs/reports/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V2_INDEPENDENT_REVIEW.md
independent_review_sha256: 57fcab985dfbc2fc553fc772db02234ca0bd61127adbdf7d9aed6f9e122c2009
owner_acceptance_record: docs/reports/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V2_OWNER_ACCEPTANCE.json
owner_acceptance_sha256: 17a71f3336b27f8c2073865eaba1e75a2863ad7e4905ea99081c2110a00a20b6
revision: v2-proposal-1
revision_date: 2026-09-25
source_authority: HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1 r4
source_accepted_reviewed_body_sha256: fb5a5f825900b4c77ff681283cb51b5f914f449adda6789949f39dffeb60ad78
proposal_input_sha256: 443a1bde9c24656f0d907f71c00c0c6825ef16866013af22806ed109d414535a
proposal_independent_review_sha256: 9772797b87b1e1cdaeb7ef5edca1f0548d7f23c4014cc1e53b9ad1dbac922542
base_revision: origin/main bed1936f990f7a2831cf55ac35716b861570f40e
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
supersedes:
  - HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1
superseded_by: null
implementation_started_under_v2: NO
production_mutation_under_v2: NO
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

# HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2

> Whole-authority successor **proposal**. It carries the complete r4 contract
> below, replacing only the exact replay provenance and related lifecycle
> clauses. V1 remains accepted with `superseded_by: null` until independent
> exact-head review and an Owner-accepted, atomic lifecycle transaction mark
> V2 accepted and V1 superseded in the same docs-only change. This draft has
> no implementation or production authority.

## 0. Result

```text
SPEC_CANDIDATE_READY = PENDING_INDEPENDENT_WHOLE_AUTHORITY_REVIEW
RECOMMENDED_MECHANISM = root-authenticated whole-host quiescence proof bundle,
  consumed at Router startup, settling ONE exact record as
  terminated_without_outcome + terminationEvidence=restart_quiescence_proven
NEW_EVIDENCE_CLASS_REQUIRED = YES (6th value of the C-015 closed vocabulary;
  NOT a separate settlement field/authority)
RESTART_SAFETY_PREREQ = ROUTER_RESTART_SAFETY=PROVEN binary (generation floor,
  2097e4f+) deployed via trusted control plane BEFORE any recovery-related
  stop/restart; validator-before-producer binary ordering
IMPLEMENTATION_STARTED_UNDER_V2 = NO
PRODUCTION_MUTATION_UNDER_V2 = NO
```

## 1. DEVELOPMENT_PREFLIGHT

See the DEVELOPMENT_PREFLIGHT in this proposal's frozen review handoff.
`AUTHORITY_ACTION=SUPERSEDE`, `ROUTE_STAGE=AUTHORITY_AUTHORING`, and
`IMPLEMENTATION_ALLOWED=NO` until this whole-authority successor is accepted
in the applicable implementation base.

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
is the root launch-authorization event written after the census and before
the final bundle, external commitment, and sole launch, not a forecast
or an operator-entered time. The independently sealed, immutable launch
authorization receipt identified by `launchAuthorizationReceiptSha256`
records the same `operationId`, `hostId`, unique `startupNonce`, pinned
`consumingBinarySha256`, exact census archive/output digests and the complete
`holderCheck` fields used by this bundle. Its authorization event occurs after both
observations and before the sole launch; the receipt is sealed before the
final bundle and is never self-digested. A reviewed bounded time/continuity
gate covers every intervening seal, fsync, readback, and launch step; no old
execution source may resume during that interval.

Before the sole launch, the trusted root control plane seals the **exact final
bundle bytes** and registers one separate `BundleCommitmentReceipt` in a
root-controlled, crash-durable, create-only journal. Its closed fields are:

```text
receiptVersion;
operationId; hostId; startupNonce; reconciliationHandle; // exact journal key
subject: { turnExecutionId == reconciliationHandle, runtimeEpoch,
           agentId, processGeneration };
subjectPreimageSha256; launchAuthorizationReceiptSha256;
bundleSha256 = SHA256(exact sealed final bundle bytes);
bundleByteLength; sealedAtWallMs;
producerId = trusted root recovery control plane
```

The receipt digest is NOT placed in the bundle, avoiding self-reference. Its
key is resolved from trusted journal registration, not from a caller path or
digest. Registration uses no-follow descriptor-relative access, exclusive
create, a create-only unique-key/live-handle index, bounded bytes/count,
file-and-parent fsync and exact independent root readback before launch. An
unprivileged writer, runtime API, ordinary bundle-directory rewrite, symlink,
same-key different-byte registration, second LIVE commitment for one handle,
or new commitment after that handle is settled cannot replace or create an
eligible commitment. Root control-plane integrity plus the installed immutable
registration protocol is the trust anchor; root ownership/mode of a mutable
file alone is insufficient. Different historical keys for a handle may exist
only after the earlier window is durably closed or abandoned and its bundle
cannot launch, consume or replay. The tuple key alone is not a settled-winner
oracle: the global lock, fresh P5 preflight, one nonce-bound launch, and live
same-window challenge must also hold.

The journal records monotone, crash-durable phase receipts:
`SEALED_NOT_ATTEMPTED`, `LAUNCH_ATTEMPT_COMMITTED`, `STARTUP_OBSERVED`,
`CONSUMPTION_READBACK`, `ABANDONED`, `CLOSED`. The launch-attempt marker is
durable BEFORE any possible spawn. Absent or ambiguous marker/readback is
UNKNOWN, never proof of no launch. No nonce may be reused after a crash.
Capacity is reserved and verified before opening the cut; final registration
consumes that reservation, and any later failure aborts before launch. No
eligible or UNKNOWN commitment is evicted. There is no automatic purge. A
separately reviewed retirement may purge receipt bytes only after the window
is closed with exact child/source/lock readback, a permanent key tombstone
durably disables and readbacks bundle presentation/replay, settlement/fence
and operation/rollback-floor evidence are archived with exact digests, and
no UNKNOWN remains. The tombstone and required evidence remain. An abandoned
prelaunch commitment is tombstoned after affirmative no-launch proof and safe
window closure; it never authorizes a later launch or replay.

These bundle and receipt inputs are never written into the reconciliation
store. The store's own bounded caps
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
V8  pending-settlement branch: record preimage predicates (RQ-004 P1..P10)
    all hold. Already-settled exact-replay branch: P1..P4/P6 and the
    RQ-004 settled-replay predicates all hold; no generic settled bypass.
V9  current cutover: on the pending branch, subject preimage digest matches
    the durable exact record; on the settled-replay branch, compare it to
    the immutable original bundle commitment, NOT to the changed settled
    record. Both branches require that the trusted journal uniquely resolves
    the exact (operationId, hostId, startupNonce, reconciliationHandle) key,
    verifies its create-only registration and exact bundle digest/length,
    subject tuple, preimage, launch-authorization digest, seal order and
    durable launch-attempt marker; the same operation's exclusive window,
    canonical global lock and startup challenge remain live. A different
    historical key, closed/abandoned window, second launch, missing or
    ambiguous journal state, altered bundle byte, or tombstone rejects
    BEFORE any settlement OR audit write. The root-owned exclusive-window,
    launch-source inhibition, old-tree stop, archive and
    launch-authorization receipts all resolve from root custody and
    digest-verify. The launch authorization binds the same operationId,
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

Any invalid element ⇒ ZERO-WRITE, including zero duplicate/conflict audit;
the record remains exactly as before (blocked/fenced if pending, settled if
already settled). Rejection is exposed through bounded out-of-store startup
diagnostics and structured health/reason — never a silent drop.
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
- An already-settled handle is eligible for an **exact-bundle duplicate**
  branch only when V1..V7/V10, the applicable V9 checks, P1..P4/P6, and
  all of these settled-record predicates hold: `settlementResult =
  terminated_without_outcome`, `terminationEvidence =
  restart_quiescence_proven`, `recoveryState = settled`,
  `exitObservedAt = null`, and `fenceState = cleared` or the existing
  crash-interrupted active-fence cleanup state. This branch replaces
  P5/P7..P10 ONLY for exact same-window replay. The bundle must be
  byte-identical to the original immutable commitment and carry the same
  still-live operation/nonce/window/lock. A valid exact replay may append
  only the existing bounded `duplicate_ignored` audit, with no rewrite of
  settlement, no second emission, and transactional rollback on audit
  persistence failure. Altered proof, other settled outcome, stale window,
  missing provenance or UNKNOWN ⇒ structured ZERO-WRITE reject before audit.
  A subsequent Router launch cannot reuse an old nonce/bundle. Existing
  `conflict_ignored` for independently validated conflicting late evidence
  remains the settle-once store rule; an unproven startup bundle cannot
  reach that audit path.

### RQ-005 — Startup consumption; restart only after validation

Bundles are consumed only by the Router startup recovery path, BEFORE the
fail-closed business-admission barrier opens (C-019 barrier discipline):

```text
separate deployment authority establishes RQ-007 floor PROVEN + validator
-> trusted control plane acquires the one global production lock and proves
   exclusive control of all Runtime launch/resumption sources on this host
-> while admission remains fenced: reserve bounded root-journal capacity;
   fresh-check exact P1..P10 and capture durable subject preimage;
   stop/inhibit old Runtime tree; complete post-stop root census + holder check;
   root launcher independently seals one nonce-bound launch authorization
   receipt referencing those exact proof bytes; seals the operation-bound
   final bundle with its receipt digest; registers, fsyncs and independently
   reads back the exact external bundle commitment; durably records one
   launch attempt BEFORE any possible spawn; then executes ONE pinned
   fresh-epoch binary with that nonce
-> durable store opens + schema/caps/issuance/handle validate
-> consume evidence dir: validate each bundle (RQ-003), settle each exact
   record or validate an exact same-window duplicate (RQ-004) — per-record
   result (settled | duplicate_ignored bounded audit | zero-write+reason)
-> install remaining unresolved fences
-> open business admission barrier
-> trusted control plane may close the exclusive window after startup
   consumption and readback; UNKNOWN window continuity fails the subject
   closed rather than releasing its fence
```

The launch-authorization event is before final-bundle and commitment sealing;
it is not the binary-spawn timestamp. The reviewed bounded interval and
continuous inhibition/window/lock cover census through consumption. If any
seal, fsync, readback or continuity check fails before a possible launch,
abort without launching and leave the record fenced. The root journal's
durable phase marker, not an absent process or elapsed time, decides whether
no launch is affirmatively proven. The operation may not launch again under
the same nonce after a crash, even if no launch is proven.

Crash disposition is phase-specific:

| Durable phase | Required disposition |
|---|---|
| Before commitment fsync/readback | No launch by construction; unusable partial commitment, safe abort, fence unchanged. |
| Committed `SEALED_NOT_ATTEMPTED` | Only affirmative durable no-launch plus exact child/source/lock readback permits closing the window, tombstoning the key and considering a separately authorized new cut/nonce. Missing or ambiguous proof is UNKNOWN. |
| `LAUNCH_ATTEMPT_COMMITTED` through lost startup/readback | Launch may have occurred. Never relaunch the nonce or present its old bundle to a new process/window. Preserve inhibition and named bounded custody/containment until exact owned-child and store readback resolves settlement/fence; otherwise UNKNOWN. |
| Settled record with active fence after a crash | The EXISTING `restoreCrashInterruptedRecords` may-finish-cleanup branch may clear that fence under its accepted predicates, without old bundle, new launch, second settlement or duplicate audit. |
| Unsettled record after possible launch | Retain the exact fence. Any later attempt requires separately authorized fresh cut/nonce/bundle/commitment and current P1..P10. Unknown child/source state or rollback below the validator floor stops that attempt. |

The active-operation deadline stops further active work; it never proves
termination or releases an UNKNOWN safety window. No original prompt,
answer or side effect is replayed in any phase.

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
| ACC-RQ-001 | RQ-002/003/004/005 | happy path: exact blocked record, same live window and nonce, root commitment sealed/fsynced/read back before one launch, valid bundle at startup | settled `terminated_without_outcome`, `terminationEvidence=restart_quiescence_proven`, fence cleared, `exitObservedAt=null`, `failureReason=null`, `nextSafeAction=send_new_request_after_reopened`, admission reopened for the agent; commitment and store readback exact |
| ACC-RQ-002 | RQ-006 | three records of the class, one census archive, three subject-bound bundles | three independent exact settlements, order-independent, each handle-keyed; no bulk call exists |
| ACC-RQ-003 | RQ-005 | fenced prompt before processing, valid prompt after barrier | before: `not_admitted` fenced projection; after: admitted and executed |
| ACC-RQ-004 | RQ-004/005 | durable round-trip: restart the store again | record still settled, queries repeatable and byte-identical (C-018); old bundle cannot authorize replay in the new startup/window |
| ACC-RQ-005 | RQ-004/005 | crash between settle and fence clear | next startup completes fence clear via EXISTING may-finish-cleanup branch without old bundle, new launch, duplicate audit or new recovery state |
| ACC-RQ-006 | RQ-009 | scheduler end-to-end: unknown occurrence + Router-settled record | bridge readback stamps proof; C-039 termination-only settlement; fence released; business state stays `outcome_unknown`; no retry minted even with retry.auto=true; later reconcile_turn = receipt zero-write |
| ACC-RQ-007 | RQ-003/004 | preimage+cmp: inject persist failure mid-settlement or exact-duplicate audit | record restored to exact preimage; structured failure; no partial write |
| ACC-RQ-008 | RQ-007 | validator ordering: old validator sees new-kind record | durable load fails closed `durable_store_invalid`, admission blocked, records intact (documented rollback floor) |
| ACC-RQ-009 | RQ-001/003/005 | s256-shaped exact record survived an explicitly pre-floor restart; valid store, future floor PROVEN before operation, one causal exclusive cut and matching fresh startup | exact record alone settles termination-only; old business outcome remains unknown, exitObservedAt null, no replay; historical floor is not asserted |
| ACC-RQ-010 | RQ-001/003/004 | a second record reuses bare generation 1 under another epoch while the valid bundle binds s256's full handle/epoch | only the bound s256-shaped record can settle; second record byte-identical, no by-generation selection |
| ACC-RQ-011 | RQ-002/003/004 | after valid settlement, reconsume byte-identical bundle in the same live nonce/window with committed journal key | exactly one bounded `duplicate_ignored` audit; no second settlement or emission |
| ACC-RQ-012 | RQ-002/005 | crash after committed receipt but before launch-attempt marker; exact root journal and child/source/lock readback prove no launch | old key tombstoned after safe window closure; any later attempt has a new authorized cut/nonce and fresh P1..P10; no old-bundle replay |

## 7. Negative / security test matrix

| ID | Attack / fault | Required behavior |
|---|---|---|
| NEG-RQ-001 | bundle absent / dir empty | zero-write; record stays blocked with structured reason; fleet admission unaffected |
| NEG-RQ-002 | pending record mismatches P1..P10, or settled record mismatches exact replay predicates (other outcome/evidence, other tuple, incompatible fence) | V8 fails; zero-write including audit; exact failed-predicate list in diagnostics |
| NEG-RQ-003 | custody invalid: non-root-owned, group/world-writable, oversized bundle | V1 fails; zero-write; fail-loud tamper indicator |
| NEG-RQ-004 | bundle-local digest mismatch or exact external commitment digest/length differs | V2 or V9 fails respectively; zero-write including audit |
| NEG-RQ-005 | census finds any runtime-tree process or workspace/session holder (matchedProcessCount>0 / openHolderCount>0) | V5 fails; zero-write |
| NEG-RQ-006 | retiredEpoch == consuming runtime epoch (live runtime asked to quiesce-settle its own epoch) | V4 fails; zero-write |
| NEG-RQ-007 | two different bundles for one handle in one directory; one bundle naming two subjects; second live commitment for handle or same-key different bytes | invalid/refused (RQ-002); zero-write |
| NEG-RQ-008 | settled handle with valid-format changed `subjectPreimageSha256` or any other changed bundle byte; old bundle in later window/key; other settled outcome | V9 provenance or V8 exact reason; zero-write including audit, durable bytes identical |
| NEG-RQ-009 | conflicting late evidence after quiescence settlement | `conflict_ignored`; state immutable (C-017) |
| NEG-RQ-010 | caller attempts agent-keyed or epoch-keyed sweep via any surface | no such entry point exists; constructor rejects non-handle keys; test proves absence |
| NEG-RQ-011 | attempt to mint `child_real_exit` from the quiescence path | kind is hard-coded; impossible by construction; test asserts the exact kind written |
| NEG-RQ-012 | controlledStop missing while plan declared a restart (or present without one) | V7 fails; zero-write |
| NEG-RQ-013 | hostId mismatch (bundle from another host) | rejected (RQ-008); zero-write |
| NEG-RQ-014 | business prompt arrives while startup bundle processing is in flight | `not_admitted`; barrier discipline holds (C-019) |
| NEG-RQ-015 | forged bundle written by a non-root actor | no write path to the evidence dir; custody check V1 rejects; no runtime API accepts bundles |
| NEG-RQ-016 | journal capacity unavailable or settlement/duplicate-audit byte cap exceeded | journal admission stops before cut; store cap fails loud and restores exact preimage; no eligible/UNKNOWN receipt or unresolved record evicted |
| NEG-RQ-017 | later floor proof exists but current causal cut is absent, or census precedes subject history / belongs to another host or window | V5/V9 rejects; zero-write, original fence remains active |
| NEG-RQ-018 | old tree/holder still live; source inhibition/global lock/window not proven through consumption; launch-authorization or bundle-commitment receipt missing/wrong/digest-mismatched/not immutable or not bound to exact census/holder/preimage; wrong/reused nonce; authorization/commitment/launch order UNKNOWN | V5/V9 rejects; zero-write including audit, no old-turn replay |
| NEG-RQ-019 | deployed floor proof or new-kind validator receipt missing/mismatched/not effective before recovery stop, or durable issuance/handle identity corrupt or aliased | V10 or existing store validator rejects before settlement; no history repair, zero-write |
| NEG-RQ-020 | journal key duplicate/substituted/truncated/symlinked/tombstoned; receipt differs after root readback; two live keys for one handle; producer tries new commitment after settlement | registration refused or V9 rejects; no launch or store write |
| NEG-RQ-021 | crash/timeout after launch-attempt marker with missing child or store readback; stale commitment offered to another process; ambiguous prelaunch no-launch proof | UNKNOWN containment, no nonce relaunch, no old-bundle consumption or duplicate audit, no fence fabrication |
| NEG-RQ-022 | purge requested while bundle presentation active, window open, child/source/lock UNKNOWN, receipt needed for post-startup/rollback evidence, or tombstone not durable | purge refused; eligible/UNKNOWN receipt retained, capacity pressure fails closed |

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
                                                               cutover receipts, immutable
                                                               commitment journal and nonce;
                                                               separately accepted profile)
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
IMPLEMENTATION          = forbidden until BOTH gates pass and V2 is accepted
                          in the applicable implementation base; privileged
                          producer additionally needs its own accepted authority
PRODUCTION_APPLY        = separately authorized; never implied by acceptance
IMPLEMENTATION_STARTED_UNDER_V2 = NO
PRODUCTION_MUTATION_UNDER_V2    = NO
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
EXACT_REPLAY_PROVENANCE         = external immutable root commitment to final
                                  bundle bytes; same live nonce/window only
ONE_NONCE_ONE_LAUNCH            = durable attempt marker before possible spawn;
                                  after crash no nonce reuse or old-bundle launch
FAIL_CLOSED                     = every unknown/invalid element zero-writes
BARRIER                         = opens only after bundle processing completes
REPLAY                          = 0 (prompt/answer/side-effect)
SWEEP                           = 0 (no by-agent / by-epoch entry point)
RESTART_SAFETY_PREREQ           = ROUTER_RESTART_SAFETY=PROVEN + validator-before-
                                  producer ordering + pinned rollback floor
LIVE_RUNTIME_RECOVERY           = unchanged (C-023..C-025 path (i))
```

## 11. Whole-authority successor lifecycle and separate operation authority

This V2 proposal carries the entire accepted r4 normative contract, including
unaffected RQ-001 and RQ-006..010, §3/§4 truth and rejected-alternative
decisions, and all retained acceptance and negative rows. Changed meaning is
limited to RQ-002..005, the affected rows, and their lifecycle summaries.
The predecessor's accepted Q1/Q2 authorized bounded nonproduction work under
**r4 only**; those decisions do not pre-accept V2 or privilege a root journal.

Acceptance is one atomic docs-only lifecycle transaction after independent
exact-head semantic review: V2 `status: proposed -> accepted`; predecessor V1
`status: accepted -> superseded` and `superseded_by: null ->
HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2`; V2 `supersedes` remains the
whole V1 ID; the Specs index changes from proposed successor to current
accepted successor. The accepted review/head/Owner receipt fields are filled
only from actual later evidence, never forecast in this draft. Until that
transaction lands in the authority branch, V1 remains effective and V2
grants no implementation or operation permission.

The fixed s256 privileged producer/launcher requires a separate, narrowly
revised R2 authority bound to V2, with its own independent review and exact
Owner acceptance. One attributable Owner event may accept **both** separately
reviewed exact artifacts by naming each final SHA/head; neither acceptance is
inferred from the other. Installation/bootstrap and a live run remain gated
by an exact reviewed package, installed root-profile proof, fresh preimage,
floor/validator proof, canonical lock/source/holder closure, phase-specific
abort/containment, and explicit authorized effects. This Spec is not that
package and grants no production mutation.

```text
OPEN_OWNER_DECISIONS = accept or reject this exact V2 successor after review
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

The inherited r4 organization remains intact: goal/state and source
observations are in §0–2; proof claims/evidence and rejected alternatives
in §3; decision in §4; contracts in §5; acceptance in §6–7; migration,
compatibility and rollback gates in §8–11. The independent reviewer must
assess both the carried body and changed clauses, not only the diff.
