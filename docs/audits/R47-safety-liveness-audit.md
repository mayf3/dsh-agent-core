# R47 Safety/Liveness Audit

## Version relationship

Local candidate is `b95562eb40ef24d36f767934a62985b3ed695c7a` on `fix/workflow-execution-verifier-audience`. Owner baseline `eb8fd18934d827cec98faacaef987869c5cb92e7` is `origin/main`, a newer independent merge line. They are not ancestor/descendant; their merge-base is `44da63d21987bf7115435f0767e7851b9022836a`. The baseline contains the newer owner-assistance and owner-obligation implementation and cannot be treated as the local candidate's code. No production change was made from the baseline.

## Five-tuples

### 1. Cross-attempt old-result pollution

- **Current existence:** mitigated for the same NodeVisit by the local identity/generation fence; residual risk remains only if an external effect is unobservable and a stale re-entry is positively admitted.
- **Isolated evidence:** `packages/workflow-execution/test/stale-reentry.test.js:425-480` rejects duplicate generation and identity drift; `src/ledger.js:297-329` checks state, identity triple, generation and quiescence before `attempt_planned`.
- **Authority:** `packages/workflow-execution/src/ledger.js:297-343`.
- **Existing mechanism:** terminal `stale_no_progress` is the only generation re-entry class; same visit/dispatch/workflow/owner identity is required; quiescence is required.
- **Repair scope:** retain the fence, add an adversarial test where an old external effect is unresolved, and require durable effect evidence before any generation N+1 side effect.

### 2. `settle_check_unavailable` permanent stall

- **Current existence:** reproducible liveness gap. A failed settle read becomes `NEEDS_REVIEW`; the normal reconciliation pass does not retry it, and stale candidates only include `run_ended_no_submission`.
- **Isolated evidence:** `packages/workflow-execution/test/engine.test.js:302-317` asserts `settle_check_unavailable`; `src/engine.js:286-305` records the verdict; `src/ledger.js:666-674` excludes this judgment from stale candidates.
- **Authority:** `packages/workflow-execution/src/engine.js:286-305`, `src/ledger.js:666-674`.
- **Existing mechanism:** fail-closed `NEEDS_REVIEW` prevents false settlement.
- **Repair scope:** durable retryable review class with bounded backoff/next-check and owner escalation after exhaustion; never convert unavailable into settled.

### 3. `resolution_blocked` has no automatic recovery caller

- **Current existence:** reproducible liveness gap by design. `reconcileOnce()` explicitly skips it; recovery is exposed only through the explicit `recoverAttempt` operation.
- **Isolated evidence:** `src/engine.js:256-265` increments `blocked` and continues; `src/recovery.js:61-67` states there is no timer/watcher/poller; `test/engine.test.js:319-334` covers blocked state.
- **Authority:** `packages/workflow-execution/src/engine.js:256-265`, `src/recovery.js:61-67`.
- **Existing mechanism:** recoverable blocked state, durable reason, explicit authorityRef-gated recovery with zero Runs when identity remains unavailable.
- **Repair scope:** add a durable owner/control-plane wake or retry scheduler that invokes the existing recovery operation, with authorityRef and idempotency; do not call recovery from model-facing code.

### 4. Ordinary `attempt_planned` interruption has no legal continuation

- **Current existence:** reproducible liveness gap on a crash after `attempt_planned` and before delivery evidence. It is projected as `delivery_unverified`/`NEEDS_REVIEW`; the recovery operation refuses planned-only attempts.
- **Isolated evidence:** `src/judgment.js:173-177`; `src/recovery.js:81-89,117-121`; `test/stale-quiescence.test.js:155-156` treats `delivery_unverified` as non-reentry.
- **Authority:** `packages/workflow-execution/src/judgment.js:173-177`, `src/recovery.js:81-121`.
- **Existing mechanism:** write-ahead delivery fence and no blind retry protect against duplicate delivery.
- **Repair scope:** implement a legal continuation proof (fresh correlation == never existed, exact due intent, unchanged visit/version, no ownership/fence evidence) and a single controlled continuation; otherwise keep human review.

### 5. Missing version baseline / same-visit version growth

- **Current existence:** safety behavior is present; missing baseline or unavailable version does not permit terminal stale settlement. It can cause liveness deferral.
- **Isolated evidence:** `src/judgment.js:146-155` returns unavailable when version/baseline is absent and progressed when version changes; `src/engine.js:135-156` records dispatch baseline when available; `test/engine.test.js:137-140` covers dispatch version behavior.
- **Authority:** `packages/workflow-execution/src/judgment.js:146-155`.
- **Existing mechanism:** stale settlement requires exact unchanged `workflowStateVersionAtDispatch`; CAS settlement is guarded by the ledger.
- **Repair scope:** make version baseline a required durable admission fact or route missing-baseline attempts to bounded owner review; never infer unchanged from absence.

### 6. Owner obligation STOPPED/BLOCKED_KNOWN with no successor / producer head blocking

- **Current existence:** cannot be validated against local candidate: the local branch has no owner-obligation implementation. The named baseline contains a newer `owner-obligation`/`owner-obligation-guard` and owner-assistance resume stack.
- **Isolated evidence:** baseline-only source: `eb8fd189:packages/broker/src/capabilities/workflow/owner-obligation-guard.js:23-32` validates managed states including `STOPPED`; local source has no equivalent. Baseline owner obligation is not evidence that local candidate is fixed.
- **Authority:** baseline `packages/broker/src/capabilities/workflow/owner-obligation-guard.js:23-32`; local absence confirmed by source tree.
- **Existing mechanism:** none proven in local candidate.
- **Repair scope:** first port/rebase the authoritative owner-obligation and producer queue semantics into the candidate, then add STOPPED/BLOCKED_KNOWN successor and head-unblocking tests. This is blocked for local repair until the intended baseline merge/rebase is authorized.

### 7. Owner wake already settled but actual failure responsibility handoff

- **Current existence:** not provable on local candidate because the owner-assistance wake/resume implementation is absent. Baseline has a separate wake adapter which treats pending/settled Router correlation as reused, but that is delivery evidence, not proof that the original Workflow resumed.
- **Isolated evidence:** baseline-only `packages/production-runtime/src/workflow/owner-assistance-review-wake.js:49-53,79-88` returns reused for pending/settled correlation; it explicitly tells the owner not to infer original case resolution at lines 65-70. No local equivalent exists.
- **Authority:** baseline wake adapter above; local branch contains no corresponding owner-assistance review wake path.
- **Existing mechanism:** baseline separates owner wake delivery from Workflow completion and provides resume evidence reads; not present in local candidate.
- **Repair scope:** port the wake/resume evidence contract; require independent Workflow readback and durable responsibility handoff on failed/unknown resume, with no duplicate wake based only on settled delivery correlation.

### 8. Non-idempotent external effect repeated across attempts

- **Current existence:** residual risk. Same attempt has write-ahead `delivery_started` protection, but generation N+1 deliberately has a new attemptId; an external side effect whose outcome is unknown cannot be proven absent by the local ledger alone.
- **Isolated evidence:** `src/engine.js:117-133` uses `attempt.attemptId` as requestId after the fence; `src/ledger.js:344-358` records delivery outcome; `src/ledger.js:313-323` permits N+1 only on quiescence proof. No external effect registry is present in local workflow-execution.
- **Authority:** `packages/workflow-execution/src/engine.js:117-133`, `src/ledger.js:313-323`.
- **Existing mechanism:** per-attempt request identity, durable write-ahead fence, Router reconciliation/quiescence checks, stale re-entry CAS.
- **Repair scope:** bind external effect idempotency to stable visit/operation identity and require effect readback before N+1; classify unknown as no-retry/owner escalation.

## Repair order

1. **Safety first:** items 1, 5 and 8 (cross-generation contamination, version ambiguity, and non-idempotent external effects).
2. **Safety-preserving liveness:** item 2 (`settle_check_unavailable`) and item 4 (`attempt_planned`) with bounded durable retry/proof only.
3. **Liveness/control-plane:** item 3 (`resolution_blocked`) using an authorized caller.
4. **Baseline-dependent owner governance:** items 6 and 7 after authorized rebase/port of the Owner baseline implementation.

No production transition, deployment, restart, or data mutation was performed. An exact enabled arch Agent identity could not be resolved from the available Agent directory, so this is an engineering evidence table, not an arch sign-off.
