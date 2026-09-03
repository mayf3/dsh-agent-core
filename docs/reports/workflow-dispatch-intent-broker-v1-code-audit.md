# AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1 — Independent Broker Code Audit (r1)

> Date: 2026-09-02 · Auditor: independent coordination agent (implementation-auditor split per governance)
> Subject: impl branch `impl/workflow-dispatch-intent-broker-v1` @ `aaf7a43`
> Authority: accepted `AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1` (PR #146, merged `495b163`), governed by `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`; external authority svc-workflow `SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1` @ `22e862a`; Owner ruling `KEEP_ACCEPTED_V6`.

## Verdict

```text
BROKER_CODE_AUDIT = PASS (2 review-round test fixes during development; no post-commit audit finding on the manifest/transport surface)
SPEC_COMPLIANCE = PASS
TESTS = PASS (packages/broker 331/331)
```

## Mechanical verification matrix (CTR-DIB-001..004)

| CTR | Obligation | Evidence @ aaf7a43 | Result |
|---|---|---|---|
| 001 | due poll: GET, workflow.read, limit 1-100 fail-fast, passthrough, 403/422 declared | workflow.js `workflowDispatchIntentsManifest` (query `['limit']`, validationError invalid_pagination, no body); test: passthrough keys exactly the 7 §5.7 fields; 403 envelope preserved w/ request-id; limit 0/101/-1 → 0 token/HTTP calls | PASS |
| 002 | wake: POST w/ 2 pathParams, workflow.execute, trusted IK, no auto-retry, no-op = success, declared error family | workflow.js `workflowWakeDispatchIntentManifest` (pathParams workflowInstanceId+nodeVisitId; body exactly expectedWorkflowStateVersion+cause; idempotencyKey: true); tests: body shape + fresh IK + scope; model-supplied principalId/agentId/actor/assignee/idempotencyKey absent from wire; wakeApplied=false surfaces as res.ok; 5 downstream errors preserved verbatim (404/403/422/409/425) | PASS |
| 003 | registration/inventory additive | manifests join `manifests` array → DEFAULT_MANIFESTS via existing spread; registry.js byte-untouched (git diff scope = workflow.js + 4 test files); manifest-inventory 15→17 | PASS |
| 004 | Owner-rule fences | mechanical check: workflow_global_instances/workflow_domain_instances manifests byte-identical to main (only additive manifest blocks + header comment lines); no gateway/relay/transport/schema/mapping change; no scheduler policy logic; server-side authorization only | PASS |

## Review notes

- DEC-010 single-write-entry invariant re-scoped explicitly in the test contract:
  `workflow_execute` remains the only workflow-STATE write; `workflow_wake_dispatch_intent`
  is the separately-authorized activation-model eligibility command
  (AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1), and `workflow_transition` remains
  absent from the tool face (asserted).
- The legacy "scheduler-free source" check on workflow.js was narrowed to its actual
  invariant (no `agt_`/dispatcher per-agent wiring, no legacy scheduler client ids
  `dc702687`/`bc970ced`); the GLOBAL_SCHEDULER_READ capability strings are the lawful
  scheduler-facing vocabulary introduced by the accepted Spec.
- Development-round fixes (before commit): mock-server request-index off-by-one in the
  error-cycling test; validateManifest returns `{ok}` (not a violations array);
  trailing-EOF whitespace (`git diff --check` clean at commit).

## Test evidence

- New `packages/broker/test/capabilities/workflow-dispatch-intent.test.js`: 8/8.
- Full `npm test` in packages/broker: **331/331** (309 pre-existing baseline + 8 new +
  14 assertions updated additively per CTR-DIB-003).
- `git diff --check` clean.

## Scope conformance

- Exactly `packages/broker/src/capabilities/workflow.js` + 4 test files changed.
- No svc-workflow / auth-service change; no Grant/principal/credential change.
- PRODUCTION_CHANGE = NONE; deployment remains a separate gate.
