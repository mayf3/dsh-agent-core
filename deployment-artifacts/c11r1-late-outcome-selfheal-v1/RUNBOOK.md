# C11-R1 late-outcome self-heal — frozen apply / rollback / canary runbook

FROZEN AT PACKET ROUND. Execute top-to-bottom, one operator, one production
mutation lane (P0: PRODUCTION_MUTATION_CONCURRENCY = 1). Every gate prints an
exact receipt; a failed gate stops the run. NOTHING here runs without Owner
authorization of this exact packet (candidate head `d9f1a1f3`).

## Operation (single authorized mutation)

ONE tree-deploy + ONE runtime restart through the existing release path
(MRDP baseline #383 / PR #374 process; PDCP V3 controlled apply with
readiness gate, reconcile, health readback). No plist edit, no CLI edit, no
store migration, no manual JSON/store mutation of any kind.

```text
CANDIDATE_HEAD      = d9f1a1f3  (goal/c11r1-trusted-late-outcome-selfheal)
BASE                = c67c0d4c  (origin/main at packet round)
PREIMAGE            = the exact live runtime tree digest captured at step P2
TARGET              = the canonical production runtime unit (launchd
                      ai.agent-core.runtime) — the only restart in this packet
POSTIMAGE_STAMP     = AGENT_CORE_DEPLOYED_SHA=d9f1a1f3 read back from the
                      live unit env after restart
```

## P — Preflight (read-only)

- P1 Fresh census: confirm the runtime is healthy and record generation,
  pid, store path, W1/W2 heartbeat freshness. Abort if any watchdog is red
  or a deploy/reconcile is already in flight.
- P2 Capture PREIMAGE: the deployed tree digest (loaded SHA + bytes hash of
  packages/scheduler/src/{occurrence,scheduler}.js,
  packages/production-runtime/src/compose.js, scripts/agent-core-resident.mjs).
  This is the rollback artifact.
- P3 Canary candidate selection (read-only): via the existing census path
  (self_ops.status of owner agents / authsvc read channel), pick EXACTLY ONE
  enabled-Job `outcome_unknown` occurrence whose fresh trusted router readback
  classifies `late_completed` (or `late_failed`) — i.e. a row with
  `reconciliationState=RECONCILED_SUCCESS|FAILURE` and `fenceActive=true`.
  Record its exact (jobId, occurrenceId, runId, requestId). If no such
  occurrence exists, the canary is N/A — report and stop after step A (the
  wiring still ships and the first natural future occurrence proves it).

## A — Apply

- A1 Deploy the candidate tree at `d9f1a1f3` (complete rebuildable release
  through the existing deploy operation; readiness gate must pass).
- A2 Restart the runtime unit ONCE; read back POSTIMAGE_STAMP=d9f1a1f3 and
  scheduler health ok. A failed health readback → ROLLBACK (R) immediately.

## C — Canary verification (bounded: one occurrence, two consult intervals)

- C1 Within ≤2 consult intervals (default 60s each) after restart, and with
  ZERO human/model action: the P3 occurrence reaches terminal
  (`lateSettlement.basis='trusted-late-evidence'`, resolvedTo
  succeeded|failed; or `terminationSettlement` for termination-only), the
  Job's fence projection clears, and exactly one `late_settlement` (or
  `termination_settlement`) evidence line exists for it.
- C2 The Job's NEXT natural slot mints a NEW occurrence and succeeds
  (recurring), or the one-shot disables/deletes per §9.1 (existing
  semantics). The settled run is never re-invoked.
- C3 Fleet safety: W1/W2 green throughout; scheduler watchdog error-tail
  delta 0; no other Job's occurrence mutated (spot census unchanged for all
  other fenced jobs).
- C4 Any C-gate failure → ROLLBACK (R) + incident record. PASS → this packet
  is BUSINESS_VERIFIED for the canary scope.

## R — Rollback (armed, deterministic)

- R1 Redeploy the P2 PREIMAGE tree; restart the runtime unit once; health
  readback must equal the P2 generation baseline.
- R2 The consult disappears with the tree (optional dep). Settled
  occurrences stay terminal (settle-once; no undo, no replay). Unsettled
  occurrences return to HUMAN_REQUIRED (fail-closed, pre-wiring state).
- R3 Record the rollback receipt and re-open the Product with the blocker.

## Explicitly forbidden during this operation

- Bulk fence clearing or multi-occurrence reconcile of any kind.
- Raw store/JSON edits, direct DB writes, UNKNOWN replay.
- New watchdog/platform/framework; governance changes.
- A second restart beyond the one in A2/R1 (plus the rollback restart).
