# AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1 — capability census

- Status: complete (read-only source/runtime census)
- Date: 2026-09-13
- Source base: `github/main@5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`
- Production observation: `system/ai.agent-core.runtime` running, PID observed, health endpoint returned
  `ok=true`, `deliverReady=true`, `storeReady=true`; canonical Scheduler store is not readable by the
  unprivileged authoring identity. No sudo, store mutation, runtime reload, secret read, or Feishu send was
  performed.
- Authority: evidence only; this Investigation does not authorize implementation or production apply.

## 1. Question

Can a Feishu Agent inspect, classify, safely repair, verify, and report common problems that belong to its
own Scheduler/turn/runtime state without an Owner or an external local Agent performing the mechanical
repair?

## 2. Existing capability census

| Required outcome | Existing capability | Evidence | Classification |
|---|---|---|---|
| Trusted caller identity | Parent RPC overwrites caller identity from the actual process and supplies `callerAgentId`, `processGeneration`, and `turnExecutionId` | `packages/broker/src/gateway.js`; `packages/agent-router/src/parent-rpc-relay.js` | REUSE |
| List own jobs | Unified `scheduler(action=list)` filters definitions by `job.agentId === callerAgentId` | `packages/scheduler/src/self-service/access.js` | REUSE |
| Read own occurrence evidence | `scheduler(action=runs)` filters by self ownership; foreign history requires exact audit proof | same | REUSE |
| Enable/disable own job | Existing self-service handlers reuse `enableJobOp` / `disableJobOp` inside the single JobStore mutation authority | same; `packages/scheduler/src/control.js` | REUSE |
| Prevent critical self-disable | Exact persisted `logicalKey` is checked against the critical inventory inside the locked mutation | `packages/scheduler/src/self-service/critical-job-guard.js` | REUSE |
| Identify exact unknown execution | Scheduler occurrence stores `occurrenceId`, `runId`, and `idempotencyKey`; Router has an exact caller-correlation secondary index from that triple to its handle | `packages/scheduler/src/occurrence-model.js`; `packages/agent-router/src/reconciliation/query.js` | REUSE |
| Prove turn termination | Router reconciliation records use a closed evidence vocabulary and expose non-consuming snapshots | `packages/agent-router/src/process/agent-process.js`; `packages/agent-router/src/reconciliation/state-machine.js` | REUSE |
| Release process-local unknown fence | Exact late terminal+idle or real child exit settles the Router record and releases only the matching handle | `packages/agent-router/src/process/event-correlation.js`; `packages/agent-router/src/process/spawn.js` | REUSE |
| Controlled child restart | Router owns exact generation/object/token/PID shutdown with real-exit wait | `packages/agent-router/src/process/shutdown.js` | REUSE, NOT MODEL-EXPOSED |
| Scheduler store reload | Resident Scheduler already observes the canonical JobStore through its tick/load path; a definition mutation does not require a parent runtime restart | `packages/scheduler/src/scheduler.js`; production composition | REUSE |
| Combined self status | No model-visible caller-scoped projection joins job/fence/occurrence with Router termination evidence | source census | GAP |
| Self turn reconciliation | Current model-visible Scheduler tool expressly excludes reconcile; control reconcile is operator-only | `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`; `SCHEDULER_TIMEOUT_OUTCOME_V2` C-029 | AUTHORITY + IMPLEMENTATION GAP |
| Trigger existing job once | No current operation; `submitOneShotOp` creates a new definition and is not equivalent | `packages/scheduler/src/control.js`; `scripts/agentcore-cron.mjs` | GAP, NOT REQUIRED FOR V1 DOGFOOD |
| Self runtime reload | No safe model-facing supervisor operation; a tool call is itself an active turn, so `NO_ACTIVE_TURN` cannot be satisfied synchronously | lifecycle census | OWNER GATE |

## 3. Core gap

The Scheduler and Router already preserve the evidence needed for a safe decision, but there is no trusted
caller-scoped join or model-facing operation that consumes it. The current operator reconcile also forces an
unknown occurrence to `succeeded|failed`. That contract cannot express the required fact:

```text
TURN_TERMINATION_PROVEN = YES
BUSINESS_OUTCOME = UNKNOWN
ADMISSION_FENCE_CLEARED = YES
```

Mapping this case to `failed` would overclaim business outcome. Mapping it to `succeeded` is forbidden.
Leaving the fence active after exact termination is proven prevents safe future work. Current authority does
not encode the required distinction: its occurrence schema permits `executionOutcome` only for
`succeeded|failed`, and its fence projection treats every unsettled `outcome_unknown` as live-risk. The
minimum semantic addition therefore requires a whole-authority successor; it cannot be smuggled in as an
additive implementation field.

## 4. Minimal V1 surface

Do not create the five candidate tools from scratch.

1. Keep the existing unified `scheduler` tool for self job list/runs/enable/disable. Add no second job-control
   tool.
2. Add one LOCAL Broker capability named `self_ops` with exactly two actions:
   - `status` — caller-scoped read-only joined projection;
   - `reconcile_turn` — exact, evidence-consuming, idempotent reconciliation.
3. Do not expose `runtime_reload` in V1. The current supervisor does not offer a safe synchronous self-reload
   contract and Scheduler definition changes do not require it.
4. Do not add `trigger_once` in V1. It would add a new occurrence kind/admission policy; the dogfood may wait
   for the next natural slot after reconciliation, as allowed by the business goal.

## 5. Required exact reconciliation

`reconcile_turn` should accept only `job_id`, `occurrence_id`, and `run_id`. It accepts no
principal, agent, PID, outcome selection, evidence text, payload, or retry flag.

The Parent Runtime derives caller identity and must prove all of the following from current authorities:

1. the job exists and `job.agentId` equals the trusted caller;
2. the occurrence belongs to that job and its run ID and idempotency key match exactly;
3. the Router current-epoch secondary index resolves the occurrence's exact
   `(occurrenceId, runId, idempotencyKey)` triple to one handle, and that record is bound to the same caller;
4. the Router record is settled with trusted termination evidence;
5. the Scheduler occurrence remains unresolved `outcome_unknown` and no conflicting late disposition exists.

If a future whole-authority successor permits it, the server would consume the Router result without model
interpretation:

- `late_completed` -> Scheduler `succeeded` with trusted-late-evidence provenance;
- `late_failed` -> Scheduler `failed` with trusted-late-evidence provenance;
- `terminated_without_outcome` -> Scheduler business outcome remains `outcome_unknown`, records a
  termination-only disposition, and rebuilds/releases the execution fence.

Any `pending`, `restart_lost`, `evicted`, `never_existed`, identity mismatch, correlation mismatch, or
conflicting state returns a stable blocker and performs zero mutation. UNKNOWN never means ZERO.

## 6. Canonical versus superseded classification

Title/name is display data and cannot mechanically prove canonical identity. V1 may automatically disable a
self-owned superseded job only when an accepted desired-state entry or another durable exact provenance edge
identifies the canonical logical key and the candidate has an explicit supersession edge to it. Without that
evidence the tool reports `canonicality_ambiguous`; the single Owner gate remains a product decision, not a
runtime failure.

## 7. Production observation and blocker

Fresh unprivileged observation on 2026-09-13 proved the system runtime is running and the local health surface
is ready. The canonical Scheduler store is protected from the authoring user, so the requested three-job HR
census cannot be truthfully refreshed without an Owner-only privileged read or execution by HR through the
deployed self-service surface. This is a correct permission boundary, not a defect to weaken.

## 8. Conclusion

```text
EXISTING_CAPABILITY_COVERAGE = HIGH
NEW_MODEL_VISIBLE_TOOLS = 1 (self_ops)
NEW_ACTIONS = 2 (status, reconcile_turn)
SCHEDULER_TOOL_DUPLICATION = 0
TRIGGER_ONCE_V1 = DEFER
SELF_RUNTIME_RELOAD_V1 = OWNER_GATE
NEW_SEMANTIC_AUTHORITY_REQUIRED = YES
PRODUCT_IMPLEMENTATION_ALLOWED_NOW = NO
```
