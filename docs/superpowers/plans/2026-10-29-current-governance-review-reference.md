# Current Governance Review Reference Implementation Plan

> **For agentic workers:** Root explicitly assigned one Core source writer; this plan is executed by that writer with TDD.

**Goal:** Implement CTR-GCR-006 so an explicit Owner operation obtains and projects current service-owned review references without manual digest transcription.

**Architecture:** Add one action operation beside existing resolve, with an invocation-local source read from the existing detail capability under its existing authorization. Extend trusted manifest/transport binding generically, validate the concrete detail DTO before POST, preserve the original CAS input, and leave old typed/opaque resolve paths unchanged.

**Tech Stack:** Node.js ESM, existing Broker manifest/schema/HTTP transport, `node:test`.

**Spec:** `docs/specs/AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1.md`, CTR-GCR-006 and ACC-GCR-003.

## Global Constraints

- Same caller; existing `workflow.read` for detail and `workflow.execute` for resolve.
- Static trusted manifest mapping only; no caller-selected path, shared cache, or vault.
- Exactly the five declared service values; compare actual detail DTO fields and preserve expected version unchanged.
- Any failure before mutation means zero resolve POST; unknown POST uses existing no-replay behavior.
- No new scope, Grant, service route/API, automatic resolve, model correction, live run, or production action.

## Review Focus

- Invalid reserved target must reject before detail invocation; assert zero internal reads and zero wire requests.
- Read authorization denial must create zero wire GET; Svc visibility denial is one GET and zero POST.
- Detail DTO source/binding/child/proof mismatches and stale version must stop before POST.
- Policy allows exact new operation only after manifest schema registration and existing policy-digest acknowledgement.
- Existing typed direct and opaque resolve behavior, expected-version CAS, and idempotency remain unchanged.

### Task: Generic invocation-local projection and explicit operation

**Files:**
- Modify `packages/broker/src/schema.js`, `packages/broker/src/transport/body-projection.js`, `packages/broker/src/transport/http.js` only as needed for a statically declared source operation/result projection.
- Modify `packages/broker/src/capabilities/workflow-assistance.js` to declare the new explicit operation, schema, predicates, source mapping, errors, and Owner guidance.
- Test `packages/broker/test/transport.test.js` and `packages/broker/test/workflow-assistance-capability.test.js`.

- [ ] Write behavior tests first for registered operation/schema, authorized same-caller read-to-body projection, exact DTO predicates, zero-POST failures and emitted-GET counts, byte-exact five-field mapping, unchanged expected version, no input mutation, and old resolve compatibility.
- [ ] Run each focused test and verify its expected missing-feature failure.
- [ ] Implement minimum manifest validation and invocation-local transport flow; no persistent result store.
- [ ] Run focused suites, broader Broker package tests, governance integrity, and structure verifier; document pre-existing failures without changing unrelated files.
- [ ] Commit only after verified, clean diff; hand exact commit to root for independent review.
