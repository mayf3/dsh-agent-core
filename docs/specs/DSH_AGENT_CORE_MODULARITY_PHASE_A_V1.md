---
spec_id: DSH_AGENT_CORE_MODULARITY_PHASE_A_V1
status: accepted
accepted_date: 2026-09-24
accepted_by: mayf3
accepted_reviewed_spec_commit: 283ff1f1d7f67f011afb4cbf0299a7a400ee009c
acceptance_review_verdict: PASS
acceptance_review: independent semantic authority review = ACCEPT / 0 blockers (local Ollama qwen3.8:27b-mtp-q4_K_M-64k, fresh context, exact reviewed proposal head 283ff1f1; durable record docs/reviews/DSH_AGENT_CORE_MODULARITY_PHASE_A_V1_INDEPENDENT_REVIEW.md)
acceptance_authority_basis: >-
  Owner direct mandate GOAL DSH_AGENT_CORE_MODULARITY_PHASE_A_V1_CLOSURE_FIX
  (2026-09-24), persisted at
  docs/reports/DSH_AGENT_CORE_MODULARITY_PHASE_A_V1_CLOSURE_FIX_MANDATE.md;
  source SHA256 13245acaea57ba547e90b536c14b36c0af6ad0cd982868e02a6435f82ca8cf67.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core
  - structural ownership and composition boundaries for the Phase A identity-capability extraction, generic Broker LOCAL handler injection, trusted-pack closure, reverse-principal wiring, and workflow shutdown drain propagation
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1
  - AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
  - AGENT_CORE_AGENT_DIRECTORY_TOOL_V1
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
date: 2026-09-24
---

# DSH_AGENT_CORE_MODULARITY_PHASE_A_V1

## 1. Goal and authority route

This Spec closes one bounded structural authority gap discovered during
`DSH_AGENT_CORE_MODULARITY_PHASE_A_V1`: Agent identity read providers had
become product behavior inside `production-runtime`, while the generic Broker
enumerated product provider service names. Phase A moves those provider
implementations behind an independent package and replaces Broker-owned provider
enumeration with one composition-injected LOCAL-handler map, without changing
the existing identity, authorization, transport, persistence, or Workflow
semantics.

```text
GOAL = DSH_AGENT_CORE_MODULARITY_PHASE_A_V1
CLOSURE_GOAL = DSH_AGENT_CORE_MODULARITY_PHASE_A_V1_CLOSURE_FIX
AUTHORITY_ACTION = NEW
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
PRODUCTION_APPLY_AUTHORITY = NONE
```

Owner directive `DSH_AGENT_CORE_MODULARITY_PHASE_A_V1_CLOSURE_FIX`
(2026-09-24) explicitly requires fresh authority audit and, when no accepted
authority covers this exact structural decision, authorizes the minimum
governing Spec needed to close it. The same directive forbids production
mutation, Deployment System redesign, Auth scope/audience changes, credential
topology changes, state migration, persistence-schema changes, and unrelated
Phase B/C architecture.

## 2. Authority audit and relationship to existing Specs

Fresh audit at `origin/main = 2a85d0659157a3bab649239158744d5222d86afe`
found no accepted Spec governing the exact combination of:

- extraction of the three read-only identity providers into an independent
  `packages/agent-identity-capabilities` package;
- a generic composition-injected Broker LOCAL-handler seam;
- a tracked package-root public entry that must survive the canonical trusted
  pack; and
- preservation of the existing workflow-engine drain ordering at the runtime
  wrapper boundary.

The neighboring accepted Specs remain authoritative for business semantics:

- `AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1` — reverse lookup surface,
  trusted caller, Auth route/scope, response validation, and error taxonomy;
- `AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2` — forward lookup trusted
  caller/Auth/Definition semantics;
- `AGENT_CORE_AGENT_DIRECTORY_TOOL_V1` — directory read semantics and
  definition-read authorization baseline;
- `AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2` — workflow execution semantics.

Their exact-file-set clauses describe the bounded implementation closure of
those earlier Goals. This Spec does not rewrite those authorities, does not
change their product semantics, and does not partially supersede them. It
authorizes a later structure-only relocation/composition change that must remain
conformant to all of their semantic Contracts.

## 3. Contracts

### CTR-MPA-001 — Identity capability package ownership

The trusted provider implementations for:

```text
agent_resolve_principal
agent_resolve_principal_by_agent
agent_directory
```

MAY live in the independent package:

```text
packages/agent-identity-capabilities/
```

The package owns the provider implementations and their provider-level tests.
`production-runtime` owns only composition/configuration of those providers.

The package exposes one tracked public entry:

```text
packages/agent-identity-capabilities/index.js
```

and `package.json exports["."]` points to that entry. Production composition
MAY consume that tracked public entry by repository-relative path. No
`node_modules/@agent-core` bridge, gitignored symlink, or post-pack manual copy
may be required for the production runtime to resolve it.

### CTR-MPA-002 — Generic Broker LOCAL-handler composition seam

Gateway-mode Broker MAY accept one additive composition seam:

```text
resolveLocalHandlers: () => handlersByCapabilityId
```

The Broker must not enumerate composition-owned `ctx.get("*Access")` business
provider service names. The composition layer owns the provider enumeration and
injects the merged handler map at execute time.

This structural seam does not change:

- capability IDs or tool names;
- model-visible input/output schemas;
- caller identity source;
- required Auth resource/scope/audience;
- credential ownership or token handling;
- HTTP transport or parent-RPC relay semantics;
- error vocabularies.

Absent/miswired LOCAL handlers continue to fail closed under the existing
Broker semantics.

### CTR-MPA-003 — Reverse principal wiring remains complete

`agent_resolve_principal_by_agent` remains reachable through the real chain:

```text
Agent child
  -> broker relay
  -> Router parent RPC
  -> Broker gateway
  -> agentPrincipalReverseResolutionAccess
```

The actual trusted caller relationship remains the sole caller-identity source.
The model-visible target `agentId` never selects caller credentials or caller
authorization. The existing fixed Auth route/resource/scope and all
`AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1` failure semantics remain
unchanged. Structural extraction must never reintroduce
`unsupported_operation` through missing provider wiring.

### CTR-MPA-004 — Trusted pack is a source-closure boundary

The canonical trusted app pack MUST preserve package-root public entry files
needed by the packed runtime. For the Phase A identity package the packed app
must contain at least:

```text
app/packages/agent-identity-capabilities/package.json
app/packages/agent-identity-capabilities/index.js
app/packages/agent-identity-capabilities/src/**
```

and the packed `production-runtime/src/compose.js` import of
`../../agent-identity-capabilities/index.js` must resolve directly from those
packed bytes.

The canonical pack fix must be generic for package public root entries; a
feature-specific production symlink, live-tree patch, or post-pack manual copy is
forbidden.

### CTR-MPA-005 — Workflow shutdown drain propagation

The production runtime wrapper around Workflow Execution MUST preserve the
engine's bounded drain Promise:

```text
workflowExecution.stop()
  -> await engine drain completion
  -> scheduler.stop()
  -> context/router disposal
```

The wrapper must not regress to fire-and-forget `engine.stop()`. This structural
contract changes no polling, retry, stale-reentry, ledger, outcome-unknown, or
Router reconciliation semantics.

### CTR-MPA-006 — Frozen negative boundaries

Phase A introduces none of the following:

```text
AUTH_SCOPE_CHANGE = NO
AUTH_AUDIENCE_CHANGE = NO
CREDENTIAL_TOPOLOGY_CHANGE = NO
PERSISTENCE_SCHEMA_CHANGE = NO
STATE_MIGRATION = NO
DEPLOYMENT_SYSTEM_REDESIGN = NO
DYNAMIC_CAPABILITY_LOADING_FRAMEWORK = NO
MODEL_ROUTING_CHANGE = NO
```

The canonical trusted-pack closure may be corrected so it faithfully carries
tracked package public entries; that bounded source-closure correction is not
authorization to change deployment transaction semantics, activation policy,
production state, or rollback behavior.

## 4. Acceptance

| Acceptance | Contracts | Evidence |
|---|---|---|
| ACC-MPA-001 | 001/002 | identity provider tests + Broker generic LOCAL-handler behavior/static regression |
| ACC-MPA-002 | 003 | real `applyBroker -> brokerGateway.execute` reverse-principal wiring regression |
| ACC-MPA-003 | 004 | canonical pack regression builds the trusted package shape and proves packed `compose.js` resolves the tracked root public entry with no first-party `node_modules/@agent-core` bridge |
| ACC-MPA-004 | 005 | production-runtime shutdown regression proves stop remains pending until engine drain completes and no later delivery/write occurs |
| ACC-MPA-005 | 001..006 | clean tracked-only acceptance; structure gate has no candidate-only structural debt; independent exact-head review and Spec compliance PASS |

Full-repository baseline failures do not become PASS by declaration. Release
readiness requires no deterministic candidate-only regression on the affected
surface.

## 5. Non-goals and stop boundary

This Spec does not authorize manifest extraction from Broker, Scheduler/self_ops/
Workflow-draft gateway special-case refactoring, dynamic discovery, new plugin
infrastructure, Auth changes, Deployment System redesign, production mutation,
credential mutation, state cleanup, or broader product architecture.

`DONE_WHEN` is source closure only:

```text
SPEC_GATE = PASS
SPEC_COMPLIANCE = PASS
TRACKED_ONLY_CLOSURE = PASS
TRUSTED_PACK_CLOSURE = PASS
IDENTITY_PACKAGE_RESOLUTION = PASS
REVERSE_PRINCIPAL_WIRING = PASS
WORKFLOW_SHUTDOWN_DRAIN = PASS
CANDIDATE_ONLY_DETERMINISTIC_REGRESSION = NONE
INDEPENDENT_REVIEW = PASS
SOURCE_COMPLETE = YES
DEPLOYMENT_READY = YES
PRODUCTION_MUTATION = NO
```

Deployment remains a separate controlled operation owned by the existing
Production Deployment Control Plane.
