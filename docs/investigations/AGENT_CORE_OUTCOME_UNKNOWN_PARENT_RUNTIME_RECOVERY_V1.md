---
investigation_id: AGENT_CORE_OUTCOME_UNKNOWN_PARENT_RUNTIME_RECOVERY_V1
status: complete
repository: mayf3/dsh-agent-core
base_revision: 3c7b169a864c1e45df8b5c67333a9478138a22ee
date: 2026-09-18
owners:
  - mayf3
---

# AGENT_CORE_OUTCOME_UNKNOWN_PARENT_RUNTIME_RECOVERY_V1

## 0. Result

```text
GOAL = AGENT_CORE_OUTCOME_UNKNOWN_PARENT_RUNTIME_RECOVERY_V1
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACTION = SUPERSEDE
PRIMARY_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V2
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
FRESH_BASE = origin/main@3c7b169a864c1e45df8b5c67333a9478138a22ee
PRODUCT_CODE_CHANGED = NO
PRODUCTION_MUTATION_PERFORMED = NO
READY_FOR_IMPLEMENTATION = NO
```

Root cause: current code has exact late-evidence settlement and exact-owned
shutdown primitives, but no parent-owned coordinator schedules the latter when
an ordinary admitted turn remains `outcome_unknown`. The reconciliation store,
unknown fence and registry generation are runtime-memory only. A Router restart
therefore loses the recovery operation and classifies an old handle as
`restart_lost`. The outer Feishu failure path finally renders the error message
as a string and drops most structured recovery fields.

The session reports that the current Agent was recovered, but this investigation
has no sanitized exact handle/generation recovery receipt. It therefore records
no operational recovery conclusion and does not use that report as evidence of
automatic convergence or replay counts.

## 1. DEVELOPMENT_PREFLIGHT

```text
DEVELOPMENT_PREFLIGHT

Problem = An admitted exact Agent turn can remain outcome_unknown indefinitely.
          Late exact evidence can settle it, but no parent coordinator performs
          a bounded exact-generation REAP when evidence never arrives; restart
          loses the fence/recovery state and outer diagnostics are incomplete.

Governing Spec = AGENT_PROCESS_LIFECYCLE_HARDENING_V2
Spec status = accepted; implementation_authority=contracts

Relevant investigations =
  AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1
  this investigation

Relevant decisions =
  AGENT_CORE_HARDENING_PROGRAM_V1
  AGENT_WORKSPACE_SESSION_MODEL_V2

Previously rejected alternatives =
  timeout -> ordinary failed
  timeout -> replay original prompt
  unresolved unknown -> admit a new turn
  grace expiry / elapsed time / PID absence -> termination proof
  PID-only or name-based kill

Frozen boundaries =
  outcome_unknown remains authoritative until exact settlement
  no prompt, answer or historical side-effect replay
  no admission before termination proof and cleanup
  no Scheduler occurrence policy, Binding/Session redesign, Lark rendering,
  Agent credential change, periodic restart platform or production operation

Implementation scope = NONE in this Goal; docs-only investigation, complete
  successor candidate, acceptance plan and independent semantic review.

Out-of-scope = implementation, merge, deployment, restart, production recovery

New evidence = Fresh main still contains no timeout-triggered parent recovery
  coordinator; registry/reconciliation/fence state remains memory-only, while
  exact late settlement and exact-owned shutdown are already implemented.

Need new/amended Spec = YES; local governance requires a complete whole-
  authority successor because durable recovery changes V2's explicit
  no-disk-persistence and restart_lost meaning.
```

## 2. Observations

All observations use a clean isolated worktree at the exact base above.

### OBS-OUR-001 — Unknown creation and admission fence

`packages/agent-router/src/process/turn-execution.js` mints the
`turnExecutionId == reconciliationHandle` before prompt write. A caller or
background deadline records `outcome_unknown` and installs an
`activeUnknownFences` entry. The common prompt boundary rejects every later
business prompt with `AGENT_PROCESS_TURN_FENCED`; queued requests are rejected
and are not retained for replay.

### OBS-OUR-002 — Existing late settlement is event-driven

`packages/agent-router/src/process/event-correlation.js` incrementally consumes
events. For an unknown execution, exact correlated `turn/end` plus the required
same-session idle condition produces `late_completed` or `late_failed`, calls
the settle-once reconciliation machine, releases that exact handle's fence and
finishes the execution. This path runs on event arrival and does not call or
wait for a new prompt.

Generic same-session idle by itself is not trusted exact-turn termination
evidence in the current contract. It only completes `exact_terminal_then_idle`
after an exact terminal has been correlated and no later same-session turn has
started. Calling generic idle alone sufficient would weaken V2 C-015/C-016.

### OBS-OUR-003 — Child exit is observed by the owning AgentProcess

`packages/agent-router/src/process/spawn.js` installs the child exit callback.
It marks real exit, creates/joins the exact REAP slot, rejects pending RPC,
freezes input, gives already parsed terminal evidence precedence, settles each
unknown execution (`late_*` or `terminated_without_outcome(child_real_exit)`),
makes reconciliation visible, cleans the exact registry slot, then resolves
`exitPromise`.

### OBS-OUR-004 — Existing reaper is reactive, not a hard-deadline coordinator

`packages/agent-router/src/process-registry.js` has two relevant paths:

1. `reapOnExitPromise` cleans an exact live slot only after its process has
   already reported real exit.
2. fatal/startup/shutdown paths can CAS an exact `STARTUP|READY` slot to REAP.

No current component scans or schedules unresolved ordinary
`outcome_unknown` records at their turn deadline and invokes exact-owned
shutdown. Thus a process that stays alive and emits no sufficient evidence can
remain fenced indefinitely.

### OBS-OUR-005 — Registry cleanup authority is exact identity CAS

`process-registry.js` owns the lifecycle slot. `casReapSlot` requires the
current slot's `processRef` to identity-match. `casEmptySlot` additionally
matches generation and ownership token. `ensureRunning` rejects while REAP is
present. `shutdown.js` verifies child object, PID, ownership token, processRef
and REAP ownership before signaling. Bare PID, Agent name or elapsed time has
no cleanup authority.

### OBS-OUR-006 — Deadline ownership

Each `TurnExecution` owns the monotonic absolute turn deadline derived from the
static per-Agent `turnTimeoutMs`; `deadlineAtWallMs` is audit data. That deadline
currently stops the caller and records unknown. It does not cancel the turn or
schedule a parent recovery operation. There is no second recovery deadline or
automatic REAP timer.

### OBS-OUR-007 — Generation identity is canonical only inside one runtime

The registry issues a positive per-Agent integer `processGeneration` from an
in-memory map. Reconciliation handles embed a fresh runtime epoch, Agent
discriminator, generation and turn sequence. The pair
`runtimeEpoch + agentId + processGeneration` is sufficient to distinguish
current-runtime generations, but the generation counter alone is neither
globally unique nor durable across runtime restart.

### OBS-OUR-008 — Legal stop entries already exist

`AgentProcess.fatal()` performs exact-owned immediate teardown.
`AgentProcess.shutdown()` is idempotent through one `shutdownPromise`, performs
graceful shutdown, sends at most one forced termination after grace, and waits
for real exit. Registry disposal also invokes owned process shutdown. None is
currently a normal unknown hard-deadline recovery coordinator.

### OBS-OUR-009 — Persistence is incomplete for recovery

Durable today: Binding/fresh-session mappings outside this lifecycle surface.

Memory-only today: reconciliation records and issuance metadata, runtime epoch,
active unknown fences, lifecycle slots, generation counters, ownership token,
child/processRef, recovery attempts and delivery acceptance log. The
reconciliation source explicitly promises no disk persistence.

### OBS-OUR-010 — Restart and outer projection

After restart, an old handle is classified `restart_lost`; the new registry has
no old `processRef`, ownership token or child exit listener. A PID or new runtime
generation cannot repair that proof gap.

`ingress-delivery.js` carries `reconciliationHandle`, deadline and evidence on
the internal unknown error and correctly marks its phase as execution, but the
Feishu failure reply interpolates only `error.message`. Its returned failure
object does not provide the requested stable recovery projection
(`fencedBy`, generation, missing evidence, attempted actions and next action).

## 3. Answers to the ten investigation questions

1. **Late evidence already settling:** exact correlated success/failure
   terminal plus required idle settles `late_completed/late_failed`; exact
   child real exit settles `terminated_without_outcome` unless already parsed
   terminal evidence wins. Exact queued-removal/cancellation acknowledgements
   are allowed by V2 but have no general current producer.
2. **Needs a next prompt:** no. Existing event and child-exit callbacks settle
   autonomously. A next prompt only observes the fence if settlement has not
   happened.
3. **Child-exit observer:** the exact owning `AgentProcess` child listener;
   registry cleanup is notified through its injected integration.
4. **Current reaper coverage:** fatal/startup/explicit shutdown and children
   that already exit. It does not initiate recovery for an otherwise live
   ordinary unknown turn at deadline.
5. **Cleanup authority:** settle-once reconciliation store + exact handle fence
   release inside AgentProcess; exact lifecycle CAS in process registry.
6. **Hard execution deadline owner:** `TurnExecution` owns the monotonic turn
   deadline. No separate parent recovery coordinator owns it today.
7. **Canonical generation:** canonical in one runtime only when combined with
   runtime epoch and Agent identity; the integer alone is not restart-stable.
8. **Legal cancellation/shutdown/kill:** exact AgentProcess `shutdown`, `fatal`
   and registry disposal; forced termination is valid only after ownership
   verification and never proves exit by itself.
9. **Persistence:** lifecycle/reconciliation/recovery state is memory-only;
   Binding/fresh-session data is unrelated durable state.
10. **After crash/restart:** the handle string may still be presented by an
    outer caller, but current code retains no authoritative record, fence,
    generation issuance, ownership object or exit observation; it returns
    `restart_lost`.

## 4. Root-cause classification

```text
ROOT_CAUSE = RECOVERY_ENTRY_NOT_CONNECTED
EVENT_REORDERING_FIX_PRESENT = YES
LATE_SETTLEMENT_PRESENT = YES
EXACT_OWNED_SHUTDOWN_PRESENT = YES
HARD_DEADLINE_COORDINATOR_PRESENT = NO
DURABLE_RECOVERY_STATE_PRESENT = NO
STRUCTURED_OUTER_RECOVERY_PROJECTION_COMPLETE = NO
```

The observed long-lived fence is consistent with missing termination evidence
plus the absent coordinator. This investigation does not claim the historical
turn's original execution cause, because its exact production handle,
generation and event trace are not available in current source evidence.

## 5. Authority routing conclusion

The new behavior changes accepted V2 C-018/C-019 and bounded-state semantics:
unresolved records and fences must survive restart instead of becoming only
`restart_lost`. It also creates a new parent-owned mutation after deadline.
Repository governance therefore requires `SUPERSEDE`, not an in-place
amendment or a child clarification. The authoring output is the complete
standalone successor `AGENT_PROCESS_LIFECYCLE_HARDENING_V3`.

```text
IMPLEMENTATION_STARTED = NO
PRODUCT_CODE_CHANGED = NO
PRODUCTION_MUTATION_PERFORMED = NO
```
