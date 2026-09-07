# WORKFLOW_DEFINITION_AUTHORING_CENSUS_V1

```text
GOAL = WORKFLOW_DEFINITION_AUTHORING_READY_FOR_INTEGRATION_V1
OBSERVED_AT = 2026-09-03 Asia/Shanghai
DSH_REPOSITORY = mayf3/dsh-agent-core
DSH_BASE = bf2efd52f28a63c95d5b07253031ff793390bd1a
SERVICE_REPOSITORY = mayf3/svc-workflow
SERVICE_BASE = 22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7
SERVICE_CAPABILITY_EXISTS = YES
ACCEPTED_PRODUCT_AUTHORITY = PARTIAL
EXISTING_BROKER_IMPLEMENTATION = NO
AUTH_SCOPE_AUTHORITY = COVERED
```

## Observations

### OBS-CEN-001 — service HTTP surface exists

At service base `22e862a`, `src/http/mod.rs` mounts four authenticated write
routes and `src/http/handlers/definitions.rs` implements them:

| Required capability | Method and path | Current scope |
|---|---|---|
| create_definition | `POST /internal/v1/domains/{domainId}/definitions` | `workflow.execute` |
| create_draft_version | `POST /internal/v1/domains/{domainId}/definitions/{definitionId}/versions` | `workflow.execute` |
| replace_draft_graph | `PUT /internal/v1/domains/{domainId}/definitions/{definitionId}/draft` | `workflow.execute` |
| publish_version | `POST /internal/v1/domains/{domainId}/definitions/{definitionId}/publish` | `workflow.execute` |

All four require a Direct Machine Token and a server-consumed
`Idempotency-Key`. Actor identity is derived from `AuthenticatedPrincipal`, not
from the request body. The tracked current-state freeze at
`contracts/workflow-http/v1/contract.md` §2.7 records the same route/scope
mapping. `docs/contracts/DEFINITION_SERVICE_CONTRACT_V0_1.md` freezes Domain
Owner authorization, whole-graph replacement, publication validation, and
published graph immutability.

### OBS-CEN-002 — service owns the business rules

`DefinitionService` and `PgDefinitionRepository` enforce Domain Owner checks,
definition/version lifecycle, graph validation, atomic graph replacement,
publication validation/CAS, and database-triggered immutability of non-DRAFT
graph rows (`migrations/0007` plus the parent-move correction in `0008`). These
rules are not Broker responsibilities.

### OBS-CEN-003 — observed service hardening opportunities (not Goal blockers)

The four routes exist. Read-only inspection found four adapter/governance
hardening opportunities:

1. draft/create-version, graph-replace, and publish handlers ignore one or both
   route ownership coordinates (`domainId`, `definitionId`) and authorize only
   the body/version lookup; a mismatched route can therefore name a different
   domain/definition while still mutating an object the caller owns;
2. `governance_with_receipt` opens a receipt/audit transaction but constructs
   `PgDefinitionRepository` from the pool, so the business mutation commits in
   a separate repository transaction; the code comment's single-atomic-unit
   claim is not true;
3. receipt hashes cover only selected identifiers and omit mutation-bearing
   fields such as display name, schemas, nodes, and transitions, so same-key
   different-payload reuse is not reliably classified as
   `idempotency_conflict`;
4. client graph/schema validation errors are converted to
   `internal_consistency_error` instead of the typed 422 families already used
   by the non-governance definition adapter.

None permits bypass of Direct Token, `workflow.execute`, Domain Owner, canonical
object authorization, or server business validation. Broker can bind the exact
current endpoints without duplicating or masking them: route/body fields map
deterministically, current receipt/audit behavior remains service-owned, and
current error codes are preserved. No item proves that the requested legal
author → publish → create-instance chain is unsafe or unusable. They are
`OUT_OF_SCOPE_SERVICE_HARDENING`, not authority for service modification here.

### OBS-CEN-004 — no Broker implementation or accepted authoring Spec

At dsh base `bf2efd5`, `packages/broker/src/capabilities/workflow.js` has no
Definition Authoring manifest. The accepted
`AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1` freezes
`workflow_execute` to exactly `create_instance` and `transition` and leaves
Definition management out of scope. No accepted Spec under `docs/specs/`
authorizes a model-facing Definition Authoring surface.

### OBS-CEN-005 — current scope has explicit service contract basis

The service's tracked HTTP current-state freeze binds all four Definition write
routes to `workflow.execute`, and the handlers enforce that exact scope. This
Goal therefore does not invent a new scope or broaden a Grant. Whether a caller
already has that scope remains auth-service truth; Broker registration never
creates or modifies Grants. A future least-privilege scope split requires its
own accepted service/auth authority and is not part of this Goal.

## Claims and disposition

- **CLM-CEN-001 (SUPPORTED):** all four business capabilities exist in the
  authoritative service, so no new workflow domain model is required.
- **CLM-CEN-002 (SUPPORTED):** model-facing product authority is partial: the
  service surface exists, but dsh-agent-core has neither an implementation
  authority nor a Broker surface.
- **CLM-CEN-003 (SUPPORTED):** no service product-code change is required for
  safe model-facing exposure of the four current operations; OBS-CEN-003 is
  follow-up hardening under separate service authority.
- **CLM-CEN-004 (SUPPORTED):** one `workflow_definition_authoring` capability
  with four operations follows the existing one-capability/one-tool architecture
  and remains separate from the two-operation instance-execution tool.

```text
AUTHORITY_REUSE = MINIMAL_PARENT_BOUNDARY_AMENDMENT_REQUIRED
WHOLE_SUCCESSOR_REQUIRED = NO
SERVICE_CHANGE_REQUIRED_FOR_BUSINESS_GOAL = NO
SERVICE_CHANGE = FORBIDDEN
SERVER_AUTHORITY = PRESERVE
MODEL_CAN_SUPPLY_PRINCIPAL = NO
MODEL_CAN_SUPPLY_CREDENTIAL = NO
SOURCE_IDENTITY_PROPAGATION_BYPASS = NO
LEAST_PRIVILEGE = CURRENT_EXACT_SCOPE_REUSE_WITH_ZERO_GRANT_CHANGE
```
