# R21 Runtime Reliability Contract V1

Status: isolated implementation / design only. Production deployment is not authorized.

Evidence anchors: CTO diagnostics `0451ecf5` / `e79be722`, Goal §B2/B3/C5/G, and the prior dispatch verification gap where `message_id` did not prove session injection.

## 1. Turn persistence and restart recovery

The runtime writes an append-only admission journal before/after turn execution:

- `turn.admitted`: requestId, turnId, agentId, sessionId, source proof and admission timestamp.
- `turn.started`: same immutable identity and execution start.
- `turn.completed`: turnId, result digest and completion timestamp.

On startup, a recovery scan finds admitted/started records older than a configured stale boundary with no completion record. Recovery may drive only that exact request/session/turn identity, with `recovery=true`; it must not mint a new requestId or replay completed turns. A successful drive produces a normal session/turn receipt; repeated scans converge on the same identity.

The isolated implementation is `packages/agent-router/src/reliability-contract.js:AdmissionJournal`.

## 2. Binding health probe

The control-plane Binding registry remains the source of truth. A periodic probe enumerates each binding and checks the channel/session admission path. A missing or unhealthy binding emits one deduplicated `binding.lost` alert per binding identity. A healthy probe clears the alert suppression key; a later loss alerts again. Probes never silently create, switch, or repair a binding. Repair remains an explicit control-plane action.

Implementation: `BindingHealthMonitor`.

## 3. Admission refusal transparency

Every refusal emits a structured `admission.rejected` event containing requestId, agentId, optional sessionId, fenceId, stable code, detail and timestamp. Stable codes include `FENCE_ACTIVE`, `AGENT_NOT_ADMITTED`, `SESSION_NOT_READY`, `BINDING_NOT_FOUND`, `PROOF_MISSING`, `PROOF_EXPIRED`, and `RUNTIME_UNAVAILABLE`. The fence ID is an auditable reference only; the ledger never clears or mutates a fence.

Implementation: `AdmissionRejectionLedger`.

## 4. Delivery-to-injection receipt

A transport `message_id` is not an injection receipt. The router must append `session.injection_receipt` only after the target session accepts the message, binding requestId + messageId + agentId + sessionId and optional turnId. Dispatch verification queries this fact by the original request/message identity. `INJECTED`, `REJECTED`, and `UNKNOWN` are distinct outcomes; retries reconcile the original identity and never substitute a new key.

Implementation: `SessionInjectionReceiptLog`.

## 5. Isolation tests

`packages/agent-router/test/reliability-contract.test.js` covers:

1. stale in-flight turn detection after restart;
2. same-identity recovery drive;
3. completed-turn exclusion;
4. deduplicated binding-loss alert;
5. alert reset after binding recovery;
6. binding loss alert on a later recurrence;
7. structured fence rejection persistence;
8. stable rejection code retention;
9. session injection receipt persistence;
10. requestId/messageId/sessionId/turnId correlation;
11. absence of transport-only acceptance as injection proof;
12. isolated temporary-file cleanup and no production path access.

Run from the repository root:

```sh
node --test packages/agent-router/test/reliability-contract.test.js
```

These tests are isolated temporary-file tests. They do not start a production runtime, use production credentials, touch Feishu, or alter production configuration.

## 6. Integration and rollout boundary

This slice is intentionally a contract module, not an unreviewed runtime wiring change. Integration must add journal hooks at admission/start/complete, call the binding monitor from the scheduler-owned health loop, emit rejection events at the admission guard, and make dispatch verification consume the injection receipt log. Those changes require architecture/QA review and a separate release authorization. Production deployment remains `NOT_APPLIED`.
