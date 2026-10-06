# PRODUCT #456 (A7) — Transactional reconciliation-state backend: bounded closure packet

- Date: 2026-10-06
- Branch: `product-456-a7-reconcile-store-20261006` (local, based on `origin/main` @ `556ea5b4`)
- Commit: `e6c494f0` (2 files: `packages/scheduler/src/control.js` +16/-2, `packages/scheduler/test/reconcile-transactional.test.js` +297)
- Acceptance mode: TEST_IDENTITY (isolated tmpdir stores, injected clock)
- PRODUCTION_MUTATION = NO
- Execution: agent-control#458 / claim `a7-reconcile-store-r257`

## 1. CURRENT_STORE_MAP (fresh-read on current main)

The reconciliation-state authority is the Scheduler V3 single-document store
(`packages/scheduler/src/store.js`, `STORE_VERSION=3`): one JSON document
`{jobs, occurrences, fences}` committed through `mutateDoc` — in-process mutex
chain + cross-process `OwnerLock` file lock + re-read-latest + fail-loud
document validation + atomic write (unique tmp file, fsync, rename, dir fsync)
+ `mutationOutcome: 'committed'|'not_committed'` tagging with
`committedDoc`/`committedValue` attached to ack-lost commit errors.

Reconciliation surfaces sharing that one mutation authority:

| Surface | File | Role |
|---|---|---|
| `reconcileOccurrence` (C-029) | `src/control.js` | operator business-outcome (`succeeded/failed`, basis `operator-reconcile`) and `terminated_without_outcome` settlement; never re-admits, never deletes unknown history, never mints retries |
| `reconcileTurn` / `status` | `src/self-ops/index.js` | trusted caller-scoped termination-only reconcile with committed-receipt replay (`error.mutationOutcome === 'committed'` → `committedValue`) |
| `applyLateSettlement` / `watchLateSettlement` | `src/occurrence.js` | trusted-late-evidence settle-once guard (`state==='outcome_unknown' && lateSettlement===undefined`) |
| `classifyReconciliationEvidence` / `dispatchReconciliation` (CTR-RECON-001) | `src/watchdog/reconciliation.js` | quarantine/live = zero-write; trusted exact business outcome or termination-only routed to the seams above |
| `_sweepUnresolved` | `src/scheduler.js` | crash recovery: every `admitted|running` record → `outcome_unknown` (`restart_unresolved`) BEFORE any admission, fences rebuilt |
| C11-R1 periodic tick | `src/occurrence.js` `reconcileTrustedReadbacks` | re-consults unresolved unknowns via the published Router readback; settle-once mutations make restart re-consults idempotent |
| §9.1 state machine + C-028 fences | `src/occurrence-model.js`, `store.js _validateDocument` | `outcome_unknown → succeeded|failed` only (never re-admitted); fences are an exact, validated projection of unresolved unknowns on every mutation |

(Note: `packages/agent-router/src/reconciliation/store.js` is a different,
unrelated reconciliation store in the agent-router process domain — not in
scope for A7's scheduler reconciliation-state.)

## 2. GAPS (census) and disposition

- **G-1 (CLOSED in `e6c494f0`)**: `control.reconcileOccurrence` surfaced a raw
  error when `mutateDoc`'s atomic commit was durable but its acknowledgement
  was lost (`mutationOutcome:'committed'` + `committedValue`), and the only
  safe retry then failed with `RECONCILE_NOT_UNKNOWN` — no committed-receipt
  convergence, unlike the self-ops path which already replays `committedValue`.
  Closed by replaying the committed receipt (same discipline as
  `self-ops/index.js:241`) and appending the audit evidence line exactly once
  (the ack-lost path previously appended zero audit lines).
- **G-2 (CLOSED by pinning, zero source change)**: no direct focused tests at
  the store-API level pinned (a) ack-loss convergence, (b) replay-fails-closed
  with no second write/history/audit, (c) dead-engine `running` record →
  adoption sweep → `outcome_unknown` + fence + zero slot replay, (d) settled
  record survives restart immutable with only future-natural resumption.
  All four are now pinned in `packages/scheduler/test/reconcile-transactional.test.js`.
- **G-3 (observed, NOT closed — out of bounded scope)**:
  `applyLateSettlement` swallows a committed-ack throw (logs only), so its
  runs.jsonl evidence line can be lost while state still converges
  settle-once + periodic re-consult. Evidence is best-effort by design
  ("never authority"); recorded here for a future Owner decision.
- **G-4 (observed, NOT closed)**: no store-level read API listing unresolved
  unknowns outside the engine/self-ops (both read the doc directly). Not
  required by DONE_WHEN; no consumer blocked.

## 3. CONFLICT_CHECK

- Active writer Product #455 / agent-control#457 (A6): branch
  `product-455-a6-ingress-handoff-20261006` exists in the main checkout at
  `556ea5b4` with ZERO commits; worktrees `ac-455/456/457` clean at
  `e9699aee`. Its plausible surface (packages/broker ingress/transport) shows
  no file written by it; the dirty `packages/broker/*` drift in the main repo
  working tree has Sep-16 mtimes (three weeks old, pre-existing, untouched).
- Active writer Product #470 / agent-control#456 (F1, VERIFY_ONLY): no source
  modifications anywhere (clean worktrees; no scheduler/other source file
  modified repo-wide in the prior 6h).
- My surface: `packages/scheduler/src/control.js` + new scheduler test only —
  zero overlap. CLEAR.

## 4. RED → GREEN

- RED: with `control.js` pristine, `A7/G-1: reconcileOccurrence converges to
  the committed receipt when the commit ack is lost` fails with the raw
  injected `mutationOutcome:'committed'` error (the exact G-1 gap); the three
  frozen-semantics pins pass on main (regression guards, expected GREEN).
- GREEN: all 4 pass after the closure (`e6c494f0`).

## 5. TRANSACTIONAL_INVARIANTS (preserved / pinned)

- Settle-once: `outcome_unknown → succeeded|failed` requires
  `lateSettlement` (§9.1); terminal states have no outgoing transitions;
  double-settle mechanically impossible.
- Exactly-once audit: one `late_settlement`/`termination_settlement` line per
  committed settlement — never zero (ack-lost path now appends), never two
  (replay returns the receipt / fails closed without appending).
- Fail-closed preserved: `RECONCILE_NOT_UNKNOWN`, runId-mismatch, and unknown-
  occurrence errors propagate unchanged; `not_committed` failures rethrow.
- No schema change: no new record field, no validator change, no new state
  transition; C-028 exact-fence validation untouched.

## 6. CRASH_RESTART / UNKNOWN_NO_REPLAY (pinned)

- Dead engine's persisted `running` record → adoption sweep →
  `outcome_unknown` with `lateSettlement === undefined` (no fabricated
  outcome), fence retained, ZERO invocation while fenced.
- After exact operator reconcile: only a NEW future natural slot resumes
  (past the `MIN_REFIRE_GAP_MS` floor); the dead slot's identity never
  re-executes.
- A settled occurrence survives restart immutable; the settled slot is never
  replayed; a genuine replayed reconcile fails closed (`RECONCILE_NOT_UNKNOWN`)
  with no history/audit write.

## 7. TESTS

- Focused: `packages/scheduler/test/reconcile-transactional.test.js` 4/4.
- Full scheduler package: 403/403.
- Consumers: scheduler-router 30/30; execution-history 76/76; fixed-operation
  33/33.
- production-runtime (scheduler + root): 118/119 and 95/111 — byte-identical
  failure sets to a pristine `origin/main` baseline run in the same worktree
  (pre-existing local-env dependency drift; zero regressions from this change).
- `verify:structure` with base==head reports only main's own pre-existing
  violations/warnings; none reference the changed files.

## 8. REVIEW

One independent changed-surface review: **VERDICT: PASS**, zero blockers.
All six faithfulness sub-items, the self-ops precedent comparison, the test
rig fidelity (real atomic-rename before the injected ack loss; clock floors),
the frozen-semantics check (no schema/transition/validator change, no double
settle), and the blast radius were verified mechanically. Non-blocking notes
resolved: leftover debug log removed (amended into `e6c494f0`); tmpdir
non-cleanup matches the existing scheduler-test convention. Blast radius
correction absorbed: third production caller `scripts/scheduler-cp-occurrence.mjs:121`
consumes the same receipt fields and parses no error codes — unbroken, and it
now benefits from convergence.

## 9. ROLLOUT (bounded)

- Scope: TEST_IDENTITY only. Nothing deployed, restarted, enabled, or mutated.
- The change is API-compatible at both prior call sites
  (`scripts/agentcore-cron.mjs cmdReconcile`, `Scheduler.reconcileOccurrence`)
  and the third (`scripts/scheduler-cp-occurrence.mjs`): previously-thrown
  ambiguous commits now resolve to the same receipt those callers already
  print/consume.
- Remaining Owner-gated boundary (NOT executed here): push branch + open PR
  for merge review; any future deploy follows the existing MRDP road and is
  OUT OF SCOPE for this packet.
- Residual census items for future Products: G-3 (late-settlement evidence
  durability on ack loss) and G-4 (store-level unresolved-unknown read API).
