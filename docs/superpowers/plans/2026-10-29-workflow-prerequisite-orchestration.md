# Core plan: workflow prerequisite orchestration

**Status:** proposed implementation plan only; this is not Product Authority.
Implementation waits for both proposed Specs to be accepted in their bases
and a separate exact-scope mandate.

**Target:** Core `01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99`.
**Authority:** `AGENT_CORE_WORKFLOW_PREREQUISITE_ORCHESTRATION_V1` (proposed),
paired with Svc `SVC_WORKFLOW_PREREQUISITE_ORCHESTRATION_V1` (proposed).

## Bounded phases

1. Implement the closed `create_and_bind_governance_child` operation on the
   existing assistance capability. Use existing workflow Definition reads,
   scope and authenticated transport. Add exact field/schema checks and
   transparent service receipt forwarding. On ambiguous result, use exact case
   detail readback; never retry with a fresh key or call separate create/bind.
2. Change the existing due-page reader to the new Svc READY-only projection.
   Every normal poll starts at page one and drains that scan. Preserve existing
   WEC attempt planning/fences; never fall back to raw due.
3. Add focused Broker/runtime tests, then paired isolated Core↔Svc conformance.
   Start with one trigger and no child. The Owner may first create an ordinary
   supplier through existing `create_instance`, then use the returned actual
   Instance ID in atomic child create-bind while supplier work remains pending.
   Include WAITING polls with zero attempt/Router call, terminal receipt
   commit, READY dispatch, a separate ordinary non-GCR dependent, GCR
   review/resolve, and restart/re-readback. This is test sequencing, not a
   product-selection rule.

## Touch points and stop gates

Expected Core files are `packages/broker/src/capabilities/workflow-assistance.js`
and `packages/production-runtime/src/workflow-execution-runtime.js`, plus
existing focused tests. Do not change WEC storage or GCR's existing bind,
review, or resolve semantics.

Stop if paired authority is not accepted at exact implementation bases, if
Definition reads do not identify exactly one compatible published Version,
if unknown create-bind cannot be safely read back, or if the runtime can use a
raw-due fallback. CLOSED/UNKNOWN and indefinitely WAITING remain readable stop
states; no automatic recovery claim. Production apply requires separate
authority.
