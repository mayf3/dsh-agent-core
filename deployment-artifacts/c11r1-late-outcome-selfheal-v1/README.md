# C11-R1 WORKFLOW_LATE_OUTCOME_SELFHEAL — production release packet (PREPARED, NOT EXECUTED)

Status: **PREPARED / WAITING_PROD_AUTH**. No step in this packet has been
executed against production. The only authorized executor action is the
frozen apply in RUNBOOK.md, after explicit Owner authorization.

- Product: #417 (Epic #377 C11-R1, Goal #386, Program #382)
- Candidate source: git head `d9f1a1f3` (branch `goal/c11r1-trusted-late-outcome-selfheal`,
  base origin/main `c67c0d4c`), reviewed at that exact head (independent
  changed-surface review: PASS / blockers none).
- Governing accepted specs (unchanged by the candidate): SCHEDULER_WATCHDOG_
  ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 (CTR-RECON-001), SCHEDULER_TIMEOUT_
  OUTCOME_V3 (V3 late settlement, C-039), SCHEDULER_SELF_HEALING_FROM_FEISHU_V1,
  SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.

## What ships (changed surface — 5 files, 509 insertions, 0 deletions)

| File | Change |
|---|---|
| packages/scheduler/src/occurrence.js | `reconcileTrustedReadbacks` engine method + `settleFromReadback` (the production call site of `dispatchReconciliation`) |
| packages/scheduler/src/scheduler.js | optional `reconciliation` constructor dep + one consult call in `_tickOnce` after the engine-lease guard |
| packages/production-runtime/src/compose.js | passes `router.resolveCallerCorrelation` into the engine |
| scripts/agent-core-resident.mjs | same |
| packages/scheduler/test/watchdog/late-outcome-selfheal.test.js | focused RED/GREEN suite (8 tests) |

No schema/DB change. No plist/CLI change. No self-ops/broker/watchdog source
change. The consult is inert unless the engine is constructed with the new
optional dep; absent dep = today's fail-closed behavior byte-for-byte.

## Verification frozen at the candidate head

- RED on pristine base `c67c0d4c`: focused suite 7/8 FAIL (the defect:
  ledger stays `outcome_unknown`+fence while status says RECONCILED_SUCCESS
  and job_disposition HUMAN_REQUIRED).
- GREEN at `d9f1a1f3`: focused suite 8/8; scheduler package 384/384;
  scheduler-router 30/30; production-runtime + compose failure set
  byte-identical to the pristine-base baseline (environmental, pre-existing).
- Independent changed-surface review @ `d9f1a1f3`: PASS / blockers none
  (5 non-blocking notes, none release-gating).

## Rollback compatibility

Pure additive runtime-tree change, zero persistent-format change. Rollback =
redeploy the exact preimage tree captured at apply time and restart once.
Already-settled occurrences stay terminal (settle-once); occurrences not yet
settled at rollback return to the pre-wiring HUMAN_REQUIRED steady state.
No data migration exists to undo.

## Canary (see RUNBOOK.md for the exact sequence)

Exactly ONE real bounded occurrence: a live `outcome_unknown` occurrence whose
fresh trusted router readback classifies `late_completed`/`late_failed`
(self_ops.status row `reconciliationState=RECONCILED_SUCCESS|FAILURE`). After
deploy, the engine must settle it with NO human/model action within two consult
intervals; fence releases; next natural slot succeeds; W1/W2 stay green; fleet
error-tail delta 0. Never bulk: one occurrence per authorization.
