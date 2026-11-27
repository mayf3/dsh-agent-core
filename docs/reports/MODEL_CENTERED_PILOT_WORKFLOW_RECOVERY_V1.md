# Model-centered pilot: workflow execution recovery

**Status:** analysis + model mapping complete; Lean kernel verification passed in primitives workflow run 45917271049; consumer Rust/JS execution remains pending.
**Scope:** read-only pilot of the existing same-attempt recovery and delivery fence. This report is not a Product Contract, implementation authorization, or production authorization.

## 1. Exact source and authority

- Consumer source snapshot inspected: `main@5fe3026eed2d7dcb1972af9c24abded5eb720fcb`.
- Governing accepted authority: `AGENT_CORE_WORKFLOW_PRE_ADMISSION_RECOVERY_V2` and `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V5`.
- Paired business authority remains `mayf3/svc-workflow`; svc-workflow owns workflow instance/visit/assignee/version and business transition truth.
- Shared model candidate: `mayf3/primitives` PR #12, modules `AgentWorkflow.ExecutionRecovery` and `AgentWorkflow.Outbox`. The model PR must pass its own Lean workflow before it can be treated as kernel-checked.
- No accepted Spec is amended or superseded by this pilot.

The governing authorities explicitly preserve UNKNOWN as distinct from success/failure, constrain automatic recovery to eligible pre-delivery situations, and retain separate production-apply authorization. The V2 PPR authority also carries the blocked recovery and read-only responsibility protocols; this pilot does not widen them.

## 2. Requirement → model → Lean → code → evidence

| Requirement / accepted meaning | Model property | Lean declaration | Implementation mapping | Existing evidence surface |
|---|---|---|---|---|
| Same NodeVisit / attempt / generation identity is preserved across a permitted blocked recovery | A transition changes phase/fence only, never the identity tuple | `ExecutionRecovery.step_preserves_identity`; `blocked_recovery_is_same_attempt` | `ledger-admission.js:76` `beginAttemptIfAbsent`; `ledger-events.js` attempt projection and `resolution_blocked` / `delivery_started` event guards | `blocked-recovery.test.js` historical resolve-failed same-identity case; restart case |
| Resolution failure before delivery is recoverable, but ordinary planned / already delivered / stale / terminal states are not silently reminted | Only `resolutionBlocked ∧ deliveryStarted=false` may take the recovery-to-delivery transition | `blocked_recovery_is_same_attempt`; `begin_delivery_requires_clear_fence` | `recovery/automatic.js:19-35` selects ACTIVE `resolution_blocked` attempts; `automatic-ledger.js:7-18` compares tuple, attempt and recovery revision | B2 ordinary-planned exclusion; automatic/manual race; changed-target and revocation negative cases |
| A durable delivery-start marker precedes the Router call; it can occur at most once per attempt | Monotone `deliveryStarted` latch; no second begin transition after it is set | `begin_delivery_requires_clear_fence` | `engine.js` calls `recordDeliveryStarted()` immediately before `deliverRun()`; `ledger-events.js` rejects a second `delivery_started`; `ledger.js` append+fsync under FIFO + OwnerLock | real-process SIGKILL before/after WAL and lost-ACK cases |
| UNKNOWN must not be converted into an automatic second delivery | UNKNOWN admits read-only original-request correlation only; no transition from UNKNOWN to begin-delivery | `unknown_cannot_begin_delivery`; `unknown_readback_preserves_state` | `engine.js::reconcileDeliveries()` selects undelivered planned / delivery_started / delivery_unverified attempts and calls `projection.js::reconcileDeliveryEvidence()`; this is distinct from `recovery/readback.js`, which requires `attempt.delivered` and handles post-delivery business-state readback | SIGKILL after Router acceptance with ACK lost: restart preserves UNKNOWN and sends no second request |
| Terminal business state cannot be reopened as a new delivery; permitted handoff metadata is not business completion | Terminal phase has no begin-delivery transition; metadata-only event leaves phase unchanged | `terminal_cannot_begin_delivery` | `ledger-events.js` terminal refusal guard; PPR2's bounded terminal handoff metadata remains a separate protocol, not a new attempt | terminal refusal and restart/handoff cases; not a proof of Svc acceptance or Owner receipt |

## 3. Abstract transition model

The model has identity `(nodeVisitId, attemptId, generation)`, a phase, and a monotone delivery-start latch.

```text
planned ──resolve failure──> resolutionBlocked
   │                              │
   │ begin delivery               │ same-attempt recovery after fresh gate
   └──────────────┬───────────────┘
                  v
           deliveryStarted
             /    |     \
       success   unknown  post-invocation reject
          |        |          |
          v        v          v
     runDelivered  UNKNOWN  needsReview
          |
      reconciliation
       /        \
   settled    needsReview
```

UNKNOWN can receive a read-only recheck that preserves the phase and identity. A reviewed terminal attempt can receive separately governed handoff metadata; neither action reopens delivery.

The Lean model proves properties of this declared transition relation. It does not prove that the Node.js program, filesystem, process lock, Router or remote service refines the relation.

## 4. Implementation mapping details

- **Admission/fence:** `packages/workflow-execution/src/ledger-admission.js:76-99` enters the single ledger mutation path; `classifyCandidate` at 110+ rejects ineligible existing attempts and compares identity before any append.
- **Write-ahead call order:** `packages/workflow-execution/src/engine.js` admission callback persists `delivery_started` before calling `deliverRun`. This is the critical refinement seam for the no-blind-replay claim.
- **Event semantics:** `packages/workflow-execution/src/ledger-events.js:99+` projects `attempt_planned`, `resolution_blocked`, `delivery_started`, `run_delivered`, `delivery_failed`, and terminal events. It rejects a second delivery-start marker and disallows illegal phase transitions.
- **Durability/serialization:** `packages/workflow-execution/src/ledger.js` uses FIFO sequencing, cross-process `OwnerLock`, fresh replay, append and fsync; it repairs a torn tail before a mutation. This is an implementation claim supported by code and tests, not by the abstract Lean proof.
- **Automatic blocked recovery:** `recovery/automatic.js:19-35` consumes only due ACTIVE `resolution_blocked` attempts under a finite per-poll budget. `automatic-ledger.js:7-18,20-60` binds the expected attempt, generation, identity and recovery revision.
- **Lost-ACK UNKNOWN delivery evidence:** `engine.js::reconcileDeliveries()` calls `projection.js::reconcileDeliveryEvidence()` for attempts with no durable `delivered` projection but a planned / delivery-started / delivery-unverified phase. It queries original request correlation and returns UNKNOWN / ACCEPTED / NOT_SENT evidence without replaying delivery.
- **Post-delivery business readback:** `recovery/readback.js` is a different path; `readbackCategory()` requires `attempt.delivered`. It checks the target Agent's workflow-instance state after a known delivered Run, and does not handle the lost-ACK-before-`run_delivered` case.

## 5. Counterexamples and existing test evidence

The repository already has focused negative and restart tests; this pilot maps them rather than claiming to have rerun them:

- `blocked-recovery.test.js:63-95`: default OFF / caller-forged authorization leaves ledger unchanged; ordinary planned-only is excluded.
- `blocked-recovery.test.js:170-243`: historical pre-delivery resolution failure may recover same identity; delivery-domain UNKNOWN remains protected; persisted WAL overrides a false Router absence.
- `blocked-recovery.test.js:264-295`: manual/automatic race admits at most once; changed target and revocation during fresh I/O do not receive a Run.
- `blocked-recovery-restart.test.js:178-275`: real child processes cover dependency recovery + restart, SIGKILL before/after WAL, and lost ACK after Router acceptance; the lost-ACK restart sends no second request.
- `ledger-identity.test.js`: attempt ID, generation and phase CAS reject stale observations without appends.

**Execution status:** these are source-inspected test definitions and historical repository artifacts. No test command was executed in this GitHub-only pilot session. The consumer PR CI must run the focused suites against its exact head before test status is upgraded.

## 6. Proof boundary and gaps

| Claim | Current evidence class | Remaining obligation |
|---|---|---|
| The abstract model preserves identity and does not reopen UNKNOWN/terminal delivery | Lean model source; pending kernel run | Pinned Lean 4.19.0 build + compiled theorem/a​​xiom audit in primitives PR #12 |
| The implementation persists WAL before Router delivery | Source mapping + existing test definitions | Execute focused tests at exact PR head; retain raw command/exit code and process traces |
| The append-only ledger survives process restart/torn tail | Implementation + restart tests | Execute process/restart suite at exact head and inspect durable files/receipts |
| A single attempt is admitted at most once under races | Lock/CAS implementation + tests | Execute two-process race tests; abstract model does not prove OS lock correctness |
| Original workflow business outcome is correct | Not established by this pilot | Svc-owned authoritative instance readback and original acceptance remain independent |

Specific gaps:
1. The abstract model does not represent Node.js crash points, fsync failure, partial append, directory-entry durability, or cross-process lock implementation.
2. It does not prove the Router call has exactly the intended side effect or that a remote ACK is truthful.
3. The model's UNKNOWN read-only self-loop abstracts original-request correlation, not the full evidence classifier. The implementation path is `reconcileDeliveries()` / `reconcileDeliveryEvidence()`; `recovery/readback.js` is post-delivery business-state readback only.
4. It does not model all SRE stale-reentry, Owner-resume, RTH terminal-handoff, or scheduler fairness rules. Those are preserved as external accepted obligations, not silently generalized.
5. The outbox/Agent Workflow generic Lean models do not prove the Core JS implementation. A future refinement model would need explicit event-log replay and crash-prefix semantics.

## 7. Pilot conclusion

**Model fit:** PASS for the narrow same-attempt / pre-delivery fence slice, Lean model CI passed; implementation execution remains pending.
**Implementation mapping:** substantially identified; exact execution evidence is pending.
**Formal implementation refinement:** NOT PROVED.
**Production / unattended end-to-end acceptance:** NOT RUN / NOT CLAIMED.

The most valuable reusable property is that recovery is a phase transition on the same attempt identity, not a new task or a blind retry. The highest-risk implementation seam is the durable `delivery_started` append+fsync immediately before `deliverRun`; future changes to this ordering must invalidate and rerun the affected proof/test evidence.
