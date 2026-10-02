# C11-R3 RESTART_SAFE_RUNTIME_MAINTENANCE — production release packet (PREPARED, NOT EXECUTED)

Status: **PREPARED / WAITING_PROD_AUTH**. No step in this packet has been
executed against production. The only authorized executor action is the
frozen apply in RUNBOOK.md, after explicit Owner authorization. The issue's
ACCEPTANCE_MODE is "test identity first, then one bounded production restart
canary" — this packet freezes exactly that canary and its rollback.

- Product: #426 (Epic #377 C11, Goal #386, Program #382; W0 reliability
  follow-up; EXECUTION_CLAIM `c11-r3-restart-safe-20261002-r1`)
- Candidate source: git head `04bae91c` (branch `c11r3-restart-safe-v1`,
  base origin/main `d9eb5280`), reviewed at that exact head (independent
  changed-surface review: round-1 REVISE / 3 blockers → all fixed;
  round-2 **PASS / BLOCKING_ISSUES=0**, suites independently re-run).
- Governing accepted contracts (reused, NONE modified):
  AGENT_PROCESS_LIFECYCLE_HARDENING_V4,
  AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1, SCHEDULER_TIMEOUT_OUTCOME_V3 +
  D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2 lineage,
  SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1
  (CTR-RECON-001 — the #417 production wiring this packet builds on),
  HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2,
  PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.

## What ships (changed surface — 13 files, additive only)

| File | Change |
|---|---|
| packages/production-runtime/src/scheduler/restart-drain.js | NEW — `readRestartDrainCensus` (read-only authoritative census over the durable turn-recovery store via `readDurableRecoveryStore` + jobs.json admitted/running occurrences) + `enforceRestartDrainGate` (bounded drain window; fail-closed refusal; emergency receipt) |
| packages/production-runtime/src/scheduler/deployment-runtime-restart.js | gate call BEFORE any plist mutation; drain receipts on the dedicated `runtime-drain-receipt.json` channel |
| packages/production-runtime/src/restart-boundary.js | NEW — runtime-side restart-boundary census + JSONL receipt (quiesce_begin/quiesce_end), strictly read-only over the recovery store |
| packages/production-runtime/src/paths.js | `restartBoundaryLog` layout path (`<root>/control/restart-boundary.jsonl`) |
| packages/production-runtime/src/compose.js | `stop(signal)` writes the boundary receipts around the EXISTING controlled shutdown; failures downgrade to evidence lines |
| packages/production-runtime/src/entry.js | passes the signal to `runtime.stop` |
| packages/scheduler/src/occurrence.js | `late_settlement` evidence line += `replayOccurrence:false`, `scheduleDisposition`, `nextRunAtMsAfter` (oneShot captured BEFORE the completion splice) |
| packages/scheduler/src/self-ops/invoker-outcome.js | `termination_settlement` evidence line += the same receipt fields |
| scripts/scheduler-cp-admission.mjs | production CTX arms the gate (census paths + `AGENT_CORE_RESTART_DRAIN_WINDOW_MS`, Number.isFinite-guarded) and wires `runtime-drain-receipt.json`; selftest CTX stays unarmed/legacy |
| packages/production-runtime/test/scheduler/restart-drain.test.js | NEW — 10 tests (refuse/proceed/window/emergency/fail-closed/legacy/previous-epoch/repeat) |
| packages/production-runtime/test/restart-boundary.test.js | NEW — 3 tests (census content, read-only guard, compose-level receipt) |
| packages/agent-router/test/process-lifecycle/restart-convergence-matrix.test.js | NEW — 5 tests (rows 2/4/5/6/8: previous-epoch classification, child_real_exit termination-only, abandonment honesty/idempotency, restart idempotency, fault radius) |
| packages/scheduler/test/watchdog/restart-convergence-matrix.test.js | NEW — 6 tests (rows 3/7/9/10 + receipt fields + one-shot disposition edge) |

No schema/DB change. No plist schema change (the plist env keys are
unchanged). No new watcher/scheduler/database/state machine/platform. The
gate is INERT unless the deployment context passes BOTH census paths; the
scheduler evidence fields are additive on two append-only evidence lines.

## Verification frozen at the candidate head

- RED on pristine base `d9eb5280`: restart-drain 8/9 FAIL + restart-boundary
  FAIL (the drain gate and boundary receipt do not exist) + scheduler row-9
  receipt-field assertions FAIL; router convergence rows 2/4/5/6/8 and
  scheduler rows 3/7/10 already GREEN (pins on accepted behavior — the
  startup matrix, #417 wiring, abandonment authority are on main).
- GREEN at `04bae91c`: restart-drain 10/10, restart-boundary 3/3, router
  matrix 5/5, scheduler matrix 6/6; scheduler 390/390; product-api 97/97;
  scheduler-router 30/30; production-runtime under the pinned runtime node
  (v25.6.1) 404 tests / 391 pass with EXACTLY the 8 pre-existing
  environmental failures (failure-name set identical to pristine
  origin/main); agent-router failure set identical to pristine (5
  environmental).
- Independent changed-surface review @ `04bae91c`: round-1 REVISE (3
  blockers — drain receipts clobbering the single-slot install receipt;
  boundary census reading a nonexistent slot field; one-shot splice
  ordering falsifying the receipt disposition) → all three fixed →
  round-2 PASS / BLOCKING_ISSUES=0 (5 non-blocking notes, none
  release-gating, recorded in the review record).

## Rollback compatibility

Additive runtime-tree change, zero persistent-format change. Rollback =
redeploy the exact preimage tree captured at apply time and restart once —
and the packet's OWN gate now protects that rollback restart with the same
census/drain/refusal discipline. Already-classified records stay terminal
(settle-once); nothing exists to undo. Refusal receipts
(`runtime-drain-receipt.json`) and boundary receipts
(`restart-boundary.jsonl`) are evidence-only files no startup path trusts.

## Canary (see RUNBOOK.md for the exact sequence)

Exactly ONE real bounded planned restart: with at least one live admitted
Router turn or admitted/running scheduler occurrence observable, the
deployment must (a) census it, (b) drain it through the EXISTING controlled
paths within the bounded window, (c) restart, (d) prove at startup that the
previous-epoch state classifies deterministically (restart-boundary receipt
present; no new restart-lost `outcome_unknown` created by the restart
itself; unresolved business outcomes stay UNKNOWN; no old-turn replay), and
(e) prove a fenced recurring job auto-resumes future-natural-only after a
legal settlement with no model prompt / run-now / manual toggle. If the
window expires, the ordinary restart MUST refuse — the refusal itself is a
PASSING canary observation of A3, receipted, with the runtime still up.
Never bulk: one restart per authorization.
