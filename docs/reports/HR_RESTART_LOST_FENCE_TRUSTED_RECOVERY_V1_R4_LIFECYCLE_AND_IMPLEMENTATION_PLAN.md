# HR r4 acceptance lifecycle and bounded implementation plan

## DEVELOPMENT_PREFLIGHT — lifecycle checkpoint

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 5726f43f9c028a8967720ccaff49a054ee1423e6
BASE_HEAD = b4e8511c533f8fa5be2f48dd56acc16bc79dff39
CURRENT_BASE_HEAD = b647ee7e5c8dd7de7b2a1957949a33c70c1648ce
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
GOAL_OR_TARGET = publish the Owner-accepted r4 amendment, then implement only its bounded nonproduction contracts
CURRENT_GAP = r4 exact-head review and Owner Q1/Q2 acceptance are durable, but the candidate lifecycle is still draft and unmerged
OBSERVATIONS = clean isolated worktree at reviewed HEAD; Spec SHA-256 fb5a5f825900b4c77ff681283cb51b5f914f449adda6789949f39dffeb60ad78; independent review PASS/0 blockers; mayf3 Q1=YES/Q2=YES acceptance record SHA-256 1575ad24f57f42e97ef612358360367f2c959a1c7e9d486b5bcea47eb132da3b; main moved only outside this affected surface
WORKING_GUESS = NOT_APPLICABLE
AUTHORITY_ACTION = AMEND
PRIMARY_AUTHORITY = HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1@r4 (accepted by Owner; not yet active in main)
RELATED_AUTHORITIES = AGENT_PROCESS_LIFECYCLE_HARDENING_V3@r2; AGENT_CORE_HARDENING_PROGRAM_V1
IMPLEMENTATION_AUTHORITY = contracts after lifecycle merge
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (Owner Q2, bounded nonproduction implementation; production effects explicitly excluded)
MUTATION_AUTHORIZATION = VALID (lifecycle docs in this checkpoint; later code only after accepted base)
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO (no controlled operation in this checkpoint)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS (exact reviewed bytes and acceptance/review records copied into this branch)
LIVE_AUTHORITY_GAP = NONE for this docs-only transaction
OWNER_DECISION_REQUIRED = NO (Q1/Q2 already answered)
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = NOT_APPLICABLE
BASE_IMPACT = BOUNDED (current main's DES fix does not alter r4 authority or affected runtime paths)
IMPLEMENTATION_ALLOWED = NO (until accepted lifecycle is canonical in implementation base)
MERGE_READY = NO (independent lifecycle final-head check and normal PR integration pending)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = frontmatter-only r4 delta; body byte equality; exact-hash readback; independent lifecycle final-head check; later contract-level tests and independent affected security review
DONE_WHEN = docs-only lifecycle commit, index sync, and bounded implementation plan are frozen for independent final-head review
EXPANSION_TRIGGER = a real contract conflict, exact reviewed-byte drift, authority supersession, or concrete security/data-loss blocker
NEXT_REAL_ACTION = independent final-head lifecycle review and normal PR merge, then re-PREFLIGHT against that accepted base
NEXT_ACTION = CONTINUE (docs-only checkpoint)
```

The `status: accepted` field becomes active authority only after its exact
content enters `main`. The frozen r4 body remains byte-identical to the
reviewed file, including candidate-stage prose retained as historical context.
This transaction changes no product source, protected store, production
binary, runtime or fence. It neither supplies RQ-007 deployment proof nor
bootstraps the proposed privileged collector/launcher.

## Implementation sequence after accepted-base signal

1. Re-PREFLIGHT from the exact accepted main commit. Confirm r4 frontmatter,
   its body hash, PLH_V3 relationship and Q2 mandate. Freeze the affected
   source/test paths; stop on a load-bearing Spec gap.
2. RED: add deterministic, non-root fixtures and failing tests for ACC-RQ-001
   through ACC-RQ-010 and NEG-RQ-001 through NEG-RQ-019. Prioritize durable
   validator and exact identity, zero-write bundle rejection, settle-once and
   startup barrier, then end-to-end scheduler readback. No production records.
3. GREEN: extend all six closed vocabularies verbatim. Implement one
   handle-keyed bundle validator and startup consumer using the existing
   `mutateRecord` preimage/rollback, `settleLate`, `recordRecoveryAction`,
   `markFenceCleared` and crash-cleanup machinery. Wire evidence directory
   configuration only through the startup path. Preserve C-017/C-018 caps and
   existing five kinds.
4. Implement and validate bounded control-plane evidence collector/launcher
   tooling in nonproduction fixtures only. It must seal exact root-custody
   receipts, launch authorization after census/holder observations, a unique
   nonce, and one pinned startup; runtime verification rejects absent live
   exclusive-window continuity. This code is inert without separately
   accepted and explicitly bootstrapped control-plane authority.
5. Run focused suites, durable round-trip/fault injection, scheduler bridge
   convergence and structure/governance checks. Freeze exact implementation
   HEAD and Contract-by-Contract evidence for independent affected security
   review. No production readiness conclusion follows from tests alone.

| Surface | Source path(s) | Focused test path(s) | r4 checks |
|---|---|---|---|
| store vocabulary, validation, settlement | `packages/agent-router/src/reconciliation/state-machine.js`, `durable-file.js`, `store.js` (only if needed for exact constructor) | `packages/agent-router/test/process-lifecycle/late-settlement.test.js`, `unknown-fence-repair.test.js`, `auto-recovery-v3-persistence.test.js`, new focused suite in that directory | RQ-001/003/004; ACC-RQ-001/004/005/007/008/009/010; NEG-RQ-001..011/016/019 |
| startup consumer and barrier | `packages/agent-router/src/reconciliation/startup-recovery.js`, `packages/agent-router/src/index.js`, `process-registry.js` (only if required for ordering) | `packages/agent-router/test/process-lifecycle/startup.test.js`, `auto-recovery-v3-persistence-seams.test.js`, new focused suite | RQ-002/005/007/008; ACC-RQ-002/003; NEG-RQ-012..015/017..019 |
| four scheduler-side vocabulary consumers | `packages/scheduler-router/src/index.js`, `packages/scheduler/src/self-ops/invoker-outcome.js`, `packages/scheduler/src/occurrence-model.js`, `packages/scheduler/src/self-ops/diagnosis.js` | `packages/scheduler-router/test/bridge.test.js`, `packages/scheduler/test/occurrence-model.test.js`, `packages/scheduler/test/self-service/self-ops-v3.test.js`, `self-ops-termination-write.test.js` | RQ-009; ACC-RQ-006; no retry or business-outcome upgrade |
| evidence collector/launcher tooling | narrow trusted control-plane script location to be selected from existing scripts after accepted-base check | fixture-level collector validation alongside the focused Router suite | RQ-002/003 V1/V2/V5/V9/V10, RQ-005/007; NEG-RQ-003..005/012..015/017..019 |

The old and new evidence kinds serve distinct proofs; the six-set additions
are `RETAIN` for the five existing values and `MIGRATE` for consumers to the
sixth value. No legacy execution path is retired and no bridge is introduced.
If a controlled production cutover is later requested, it needs a separate
mandate/runbook, deployed floor and validator-before-producer receipts,
privileged authority/bootstrap, exact preimage, readback and canary.
