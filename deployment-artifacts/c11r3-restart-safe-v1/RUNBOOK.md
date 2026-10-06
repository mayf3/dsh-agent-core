# C11-R3 restart-safe runtime maintenance — frozen apply / rollback / canary runbook

FROZEN AT PACKET ROUND. Execute top-to-bottom, one operator, one production
mutation lane (P0: PRODUCTION_MUTATION_CONCURRENCY = 1). Every gate prints an
exact receipt; a failed gate stops the run. NOTHING here runs without Owner
authorization of this exact packet (candidate head `04bae91c`). This packet
authorizes EXACTLY ONE planned runtime restart (plus its rollback restart if
needed) — the drain gate itself decides whether the restart may proceed.

## Operation (single authorized mutation)

ONE tree-deploy + ONE runtime restart through the existing release path
(scheduler-cp controlled apply; the restart step is
`restartSchedulerProductionRuntime`, which from this candidate head carries
the A1–A3 census/drain/refusal gate and the A4 receipts). No manual
JSON/store mutation of any kind, no new plist keys, no credentials.

```text
CANDIDATE_HEAD      = 04bae91c  (c11r3-restart-safe-v1)
BASE                = d9eb5280  (origin/main at packet round)
PREIMAGE            = the exact live runtime tree digest captured at step P2
TARGET              = the canonical production runtime unit (launchd
                      ai.agent-core.runtime) — the only restart in this packet
DRAIN WINDOW        = AGENT_CORE_RESTART_DRAIN_WINDOW_MS (default 60000;
                      poll 2000ms) — bounded; expiry = ordinary restart REFUSES
RECEIPTS            = <artifactsDir>/runtime-drain-receipt.json (gate) and
                      /Users/authsvc/.agent-core/control/restart-boundary.jsonl
                      (runtime controlled stop) — evidence only, read back in
                      step V, never consumed by any trust path
```

## P — Preflight (read-only)

- P1 Fresh census: runtime healthy (8790/health ok, deliverReady), current
  generation, pid; no deploy/reconcile in flight. Abort if any watchdog is red.
- P2 Capture PREIMAGE: deployed tree digest + bytes hash of the 9 changed
  source files (see README table). This is the rollback artifact.
- P3 Canary load selection (read-only): confirm the runtime currently has at
  least one observable live execution to exercise the gate — an admitted
  in-flight Router turn (fresh turn handle in the turn-recovery census) OR an
  admitted/running scheduler occurrence. If none exists, start ONE allowed
  low-risk turn (issue DONE_WHEN D12) and let it run into the drain window.

## A — Apply

- A1 Deploy the candidate tree at `04bae91c` (complete rebuildable release
  through the existing deploy operation; readiness gate must pass).
- A2 Invoke the restart step ONCE (`runtimeRestart()` in
  scheduler-cp-admission.mjs). EXACTLY ONE of:
  - A2-ok  `DRAIN_OBSERVED` receipt (quiescent or drained_within_window) →
    bootout/bootstrap → POSTIMAGE_STAMP=`04bae91c` read back from the live
    unit env; scheduler health ok.
  - A2-ref `DRAIN_REFUSED` receipt (`RESTART_DRAIN_UNDRAINED` or
    `RESTART_DRAIN_CENSUS_UNAVAILABLE`): the restart FAILED CLOSED BEFORE
    stopping the runtime. This is a PASSING canary observation of A3 when the
    cause is the bounded window on live work: record the receipt, verify the
    runtime is still healthy, and re-run A2 once the census drains (or with
    the window raised via AGENT_CORE_RESTART_DRAIN_WINDOW_MS). A census-
    unavailable refusal is a STOP (store integrity must be investigated
    before any restart).
  - A2-emergency is NOT part of this packet: `acceptUndrainedRestart` must
    NOT be set. Emergency rollback availability is governed by the rollback
    lane (R), which keeps its own semantics.
- A3 Read back V (below).

## V — Canary verification (bounded: this one restart)

- V1 `/Users/authsvc/.agent-core/control/restart-boundary.jsonl` has a
  `quiesce_begin` line (previous epoch + lifecycle slots + unresolved handle
  classes + in-flight occurrences) and a `quiesce_end` line from the
  controlled stop.
- V2 The restart created NO new restart-lost UNKNOWN: compare the unresolved
  outcome_unknown census before P1 and after V1 — delta must be 0 for
  current-epoch handles (an already-blocked previous-epoch set may persist
  unchanged; it was not live work).
- V3 Business outcomes stay UNKNOWN where no outcome exists: no
  `exitObservedAt`/`terminationEvidence` appears on any record that has no
  real-exit observation (the boundary receipt writes never mutate the store —
  bytes verified in CI; spot-check one record read-only).
- V4 No old-turn replay: the pre-restart stuck occurrence (if any) was
  invoked exactly once in its lifetime (session/invocation evidence); after
  recovery the only new admissions belong to future natural slots.
- V5 Scheduler auto-resume (Owner usability invariant): for any occurrence
  legally settled by the engine tick during the window (termination-only or
  exact trusted late business outcome), the runs.jsonl receipt line shows
  `replayOccurrence:false`, `scheduleDisposition=recurring_future_natural_only`
  (or `one_shot_disabled` for a completed one-shot), and `nextRunAtMsAfter`
  matching the job's recomputed future-natural next run — with NO model
  prompt, Owner chat, run-now, or manual enable/disable in the interval.
- V6 Router availability and scheduler recurring-job availability reported
  separately: reconciliationRuntimeStatus health + job.state.nextRunAtMs
  (undefined while fenced) — neither inferred from the other.
- V7 Fleet regression delta 0: scheduler health projection green; W1/W2
  heartbeats fresh; error-tail delta 0.

## R — Rollback

Redeploy the exact PREIMAGE tree and restart ONCE — the rollback restart now
runs behind the SAME drain gate (a refused rollback restart means the
preimage runtime still has live work: wait for the window or use the
rollback lane's own availability semantics, which are outside this packet).
Already-settled records stay terminal (settle-once); nothing to undo. The
candidate's evidence files (drain receipt, boundary receipts) are additive
and safe under the preimage runtime.

## Stop conditions

- Any census-unavailable refusal → STOP, investigate store integrity.
- V2 delta > 0 (a NEW restart-lost unknown created by THIS restart) → the
  Product's core invariant failed → STOP, file incident, rollback optional
  (the runtime is healthy; the failure is evidence, not availability).
- V5 failure (fence stays HUMAN_REQUIRED with a legal settlement available)
  → STOP; do NOT hand-settle; the #417 wiring is the authority under test.
