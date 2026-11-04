# R22 Runtime Mechanism Design Correction

Status: isolated implementation only; production deployment is `NOT_APPLIED`.

This revision supersedes the R21 binding-health wording. The production topology is **dsh agent-core LaunchDaemon + agent-router child-process registry**. OpenClaw is out of scope and is not referenced by this design.

## 1. Turn persistence and interruption recovery

Keep the R21 admission-journal contract. At admission/start/complete, persist immutable `requestId`, `turnId`, `agentId`, `sessionId`, source proof and timestamps. On router restart, scan for stale admitted/started turns without a completion event, classify `PROCESS_RESTART_INTERRUPTED_TURN`, and re-drive only the original identity through the normal admission path. Completed turns are excluded; a new request key or blind resend is forbidden. Recovery must emit a receipt and preserve CAS/fence semantics.

## 2. Agent process liveness and registry observability (corrected)

The former Binding health-probe design is discarded. `packages/agent-router/src/process-registry.js` is the source of truth. Its READY-only `registrySnapshot()` and per-agent `lifecycleSlotSnapshot()` expose process PID/aliveness, lifecycle state, generation and exit cause. A periodic health watcher must:

- distinguish `READY_ALIVE`, `AGENT_PROCESS_EXITED`, `REAP`, `STARTUP`, and `EMPTY`;
- emit a deduplicated `agent.process.exited` alert with agentId, generation, PID/cause and timestamp;
- invoke controlled `ensureRunning(agentId)` recovery only through the registry's existing CAS/recovery fence path;
- never clear fences, change assignees, or spawn a second engine;
- record recovery success/failure and alert again only after a new failure epoch.

This directly addresses the observed `AGENT_PROCESS_EXITED` state with no alert or self-healing.

## 3. Admission refusal transparency

`agent-session-messaging.js` already maps delivery failures through `mapDeliverError`. The correction is to expose a stable structured rejection event rather than only `not_admitted`: requestId, target agent/session, stable code (`FENCE_ACTIVE`, `AGENT_NOT_ADMITTED`, `SESSION_NOT_READY`, `BINDING_NOT_FOUND`, `PROOF_MISSING`, `PROOF_EXPIRED`, `RUNTIME_UNAVAILABLE`), fence reference, detail, and timestamp. Registry state must be queryable alongside the refusal so a caller can distinguish a live process, exited process, reaping generation, and missing admission. The ledger is append-only and never mutates fences.

## 4. Delivery-to-session injection receipt

`message_id` proves transport identity only. After the target session accepts the message, append `session.injection_receipt` binding requestId, messageId, agentId, sessionId, optional turnId, status (`INJECTED|REJECTED|UNKNOWN`) and timestamp. Dispatch verification consumes this exact identity; it must not convert `accepted` or timeout recovery into injection success and must not mint a replacement key.

## Isolated implementation

- `packages/agent-router/src/r22-reliability-observability.js`
  - `snapshotAgentProcessHealth` consumes real registry projections.
  - `ProcessHealthWatch` deduplicates exit alerts and invokes a supplied controlled recovery callback.
  - `structureAdmissionRejection` and `sessionInjectionReceipt` provide stable event contracts.
- `packages/agent-router/test/r22-reliability-observability.test.js`
  - isolated unit tests use in-memory projections only; no LaunchDaemon, production process, credentials, Feishu or database.

Integration into the production router loop remains a separately reviewable change: wire the watcher to the existing process registry and wire receipt/rejection events to the existing audit/dispatch verification stores. No production restart or configuration mutation is part of this slice.
