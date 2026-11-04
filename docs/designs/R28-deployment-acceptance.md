# R28 Deployment Acceptance Addendum

Status: candidate only; production deployment remains `NOT_APPLIED`.

## Gate 1 — safe recovery callback

`ProcessHealthWatch` now invokes `createSafeRecoveryCallback`. Automatic recovery is allowed only when the exact agent projection has no live process and the lifecycle slot is `EMPTY`; it calls the exact `agentId + generation` operator recovery path. Any READY/STARTUP/REAP/live-owner ambiguity, missing recovery record, CAS failure, or recovery exception emits an escalation targeted at `itops/HUMAN_GATE`. No heuristic fence clearing occurs.

## Gate 2 — turn → Workflow recovery chain

`buildWorkflowRecoveryKick` requires and preserves `turnExecutionId`, `workflowInstanceId`, `nodeVisitId`, `workflowStateVersion`, and `assigneePrincipalId`. The resulting `WORKFLOW_EXECUTION_KICK` is intended for the existing KICK/due-feed path. It is not a transition and cannot alter assignee; the downstream Workflow service must re-read the visit and CAS the current state version. If any field is missing, the chain fails closed.

Evidence required in deployment readback: original turn receipt, workflow instance detail, node visit detail, current stateVersion, kick/outbox id, due-feed delivery, and a new execution receipt for the same assignee.

## Gate 3 — recurrence and escalation

`RecoveryRecurrenceMonitor` counts exact `(agentId,generation)` recovery failures and emits one deduplicated escalation at the threshold (default 2) to `itops/HUMAN_GATE`. The escalation event is redacted and includes reason/count, not secrets or prompt content.

## Gate 4 — rollback runbook and window

**Window entry:** itops confirms candidate SHA, package hash, service stop/start authority, health endpoint, and an abort owner. No deployment starts without a recovery backout window.

**Technical steps:**

1. Record current deployed commit/package hash and router process PID.
2. Stage candidate artifact; verify Git SHA and package hashes.
3. Stop the LaunchDaemon through the approved itops mechanism; confirm child processes are drained or explicitly recorded.
4. Install candidate; start once through the approved launcher (no manual child spawn).
5. Verify router health, process-health projection, recovery escalation sink, and one synthetic exact-generation fixture.
6. Keep the window open through the agreed observation period and capture `release.sh` receipt fields: candidate SHA, previous SHA, start/stop timestamps, PID, health result, rollback decision, operator and evidence paths.

**Rollback:** stop candidate, restore previous package/commit, start via the same launcher, verify old health and admission status, and attach the failed candidate receipt. Never edit session journals, clear fences manually, or change assignees during rollback.

**Responsibility:** itops owns production stop/start, window and rollback execution; backend owns candidate integrity, technical verification commands and interpretation; arch-reviewer owns independent acceptance.

## Gate 5 — HR_R4_SALVAGE_ROOT skip

The one skipped test consumes an external immutable salvage corpus selected by `HR_R4_SALVAGE_ROOT`. Without that path, it performs no production I/O and cannot validate corpus compatibility; it does not cover process recovery, admission, lifecycle fences, or Feishu ingress. All other lifecycle tests remain executable. The skip is therefore an explicit evidence boundary, not a pass claim. Deployment must record whether the immutable corpus is available and keep the skip visible.
