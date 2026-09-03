---
spec_id: AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-03
scope: [packages/broker]
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V6
    revision: 22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7
    relation: constrained_by
supersedes: []
superseded_by: null
owners: [repository-maintainers]
---

# AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1

## 1. Goal and boundary

Expose four existing svc-workflow writes through one model-facing capability:

```text
workflow_definition_authoring(operation = create_definition |
  create_draft_version | replace_draft_graph | publish_version)
```

Prove a disposable local author → publish → unchanged
`workflow_execute(operation="create_instance")` chain. Production apply is not
authorized.

In scope: one Broker manifest/four operations, current service bindings, strict
model schemas, trusted identity/credential/idempotency seams, current error
preservation, wiring, focused tests, and local E2E. Out of scope: svc-workflow
code; any `workflow_execute` change; reads/archive/deprecate/revoke/delete;
model-3 enablement; CAS, transaction/audit, receipt, scope, Grant, credential,
or generic schema-framework redesign; deployment/live writes.

## 2. Authority and reclassification

The accepted parent explicitly excluded Definition management from its
implementation scope. Its DEC-010 unified the instance-execution operations
`create_instance|transition`; it did not define authoring semantics. The focused
§23 amendment makes that boundary explicit without replacing or changing
`workflow_execute`.

The current endpoints are existing service-owned contracts. No reviewed finding
proves Broker cannot safely bind them while svc-workflow remains sole identity,
authorization, validation, lifecycle, persistence, audit, and receipt authority.

```text
AUTHORITY_MEANING = A_WITH_MINIMAL_CLARIFICATION
WHOLE_SUCCESSOR_REQUIRED = NO
SERVICE_CHANGE_REQUIRED_FOR_BUSINESS_GOAL = NO
SERVICE_CHANGE = FORBIDDEN
```

At dsh `bf2efd52f28a63c95d5b07253031ff793390bd1a` and svc-workflow
`22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7`:

| Operation | Exact current endpoint |
|---|---|
| `create_definition` | `POST /internal/v1/domains/{domainId}/definitions` |
| `create_draft_version` | `POST /internal/v1/domains/{domainId}/definitions/{definitionId}/versions` |
| `replace_draft_graph` | `PUT /internal/v1/domains/{domainId}/definitions/{definitionId}/draft` |
| `publish_version` | `POST /internal/v1/domains/{domainId}/definitions/{definitionId}/publish` |

All require Direct Machine Token, `workflow.execute`, Domain Owner authorization,
and server-consumed `Idempotency-Key`; actor identity comes from the token. Where
a current path coordinate is descriptive rather than consumed, Broker forwards
one deterministic mapping and never infers or authorizes object relationships.

## 3. Decisions

- **DEC-001:** add exactly one capability/tool, `workflow_definition_authoring`,
  with four operations, following ONE CAPABILITY → ONE TOOL / MULTI-OPERATION.
- **DEC-002:** Broker performs shape validation and transport mapping only;
  svc-workflow remains the sole business/security authority.
- **DEC-003:** use current exact scope `workflow.execute`; no scope/Grant change.
- **DEC-004:** trusted Broker generates the key; it is not a model argument. No
  automatic business retry except existing same-key 401 credential refresh.
- **DEC-005:** expose service-supported semantic models `1|2`; keep
  `expectedRevision` optional and preserve `revision_conflict` when supplied.

## 4. Contracts

### CTR-WDA-001 — exact bindings

```text
create_definition:
  path [domainId]
  body [definitionKey, displayName, description?, metadata?]
  required [domainId, definitionKey, displayName]
create_draft_version:
  path [domainId, definitionId]
  body [contextSchema?, jsonSchemaDialect?, validatorVersion?, metadata?,
        semanticModelVersion?]
  required [domainId, definitionId]; semanticModelVersion enum [1,2]
replace_draft_graph:
  path [domainId, definitionId]
  body [definitionVersionId, contextSchema?, nodes, transitions]
  required [domainId, definitionId, definitionVersionId, nodes, transitions]
publish_version:
  path [domainId, definitionId]
  body [versionId, expectedRevision?]
  required [domainId, definitionId, versionId]
```

All set `idempotencyKey=true`, `requiredScopes=['workflow.execute']`, and pass
response JSON through unchanged.

### CTR-WDA-002 — strict model schema

Every operation root has `additionalProperties=false`. Generated model schema
uses the existing recursive `items`/`properties` renderer. Node items have:

```text
required: node_key, display_name, order_index, node_type
optional: assignee_ref_type, fixed_principal_id, assignee_input_key, instructions,
          primary_advance_transition_key, metadata
node_type: DRAFT | NORMAL | TASK | TERMINAL
assignee_ref_type: WORKFLOW_CREATOR | DOMAIN_OWNER | FIXED_PRINCIPAL |
                   INSTANCE_INPUT_PRINCIPAL
additionalProperties: false
```

Transition items have:

```text
required: transition_key, display_name, source_node_key, target_node_key,
          transition_effect
optional: submission_schema, metadata
transition_effect: ADVANCE | RETURN | TERMINATE
additionalProperties: false
```

The outer handler body is camelCase, while these nested service structs use the
snake_case names shown above; tests pin that exact mixed wire shape. No generic
recursive validator is authorized. Current service validation remains
authoritative for graph meaning and rejects invalid graphs.

### CTR-WDA-003 — trusted seams

Schemas contain no `principalId`, `agentId`, `actor`, `subject`, credential,
token, secret, `idempotencyKey`, or trusted audit identity. Principal/credential
come only from the caller-bound seam. Transport generates one fresh key per
logical call and reuses it only for the existing idempotent 401 refresh path.

### CTR-WDA-004 — actual errors

Declare `invalid_arguments`, transport fallbacks, and current endpoint codes:

| HTTP | Codes |
|---|---|
| 400 | `unknown_field`, `invalid_json`, `missing_idempotency_key`, `invalid_idempotency_key` |
| 401 | `unauthenticated` |
| 403 | `forbidden`, `direct_token_required`, `domain_disabled` |
| 404 | `definition_not_found` |
| 409 | `definition_key_conflict`, `definition_not_editable`, `definition_version_immutable`, `revision_conflict`, `idempotency_conflict` |
| 413 | `size_limit_exceeded` |
| 422 | `invalid_semantic_model_version` |
| 425 | `command_still_processing` |
| 500 | `internal_consistency_error` |
| 503 | `service_unavailable` |

Tests assert only codes reachable per operation. Undeclared downstream codes
fail closed through existing `http_4xx|http_5xx`. Current graph/schema/fixed-
principal/digest failures mapped by service to `internal_consistency_error` stay
unchanged. Detail remains behind the existing sanitized transport boundary.

### CTR-WDA-005 — compatibility

`workflow_execute` remains exactly `create_instance|transition`;
`workflow_transition` remains absent. Existing read tools and service wires are
unchanged. The new capability registers exactly once.

### CTR-WDA-006 — local proof

The disposable test invokes all four authoring operations (model 2), then
`workflow_execute(create_instance)`. Catalog and canonical readback prove the
instance binds the exact published version. It also proves invalid graph
rejection, published immutability, supplied stale-CAS preservation, root unknown
field rejection, nested closed item schemas in catalog, identity-field
exclusion, and no auto retry. No production resource is used.

### CTR-WDA-007 — implementation boundary

Product code is limited to Workflow manifest/export/inventory wiring and tests.
Registry, mapping, transport, relay, gateway, or compose algorithms may change
only after a failing acceptance test proves the existing path cannot host this
manifest and the Spec returns to review. No svc-workflow code is authorized.

## 5. Acceptance

| ACC | Evidence |
|---|---|
| ACC-WDA-001 | catalog has one tool/four operations; fake transport proves exact method/path/body/scope/result |
| ACC-WDA-002 | catalog proves exact nested item schemas; legal graph expressible; service rejects invalid graph |
| ACC-WDA-003 | identity/credential/key absent from schema/wire; trusted key behavior passes |
| ACC-WDA-004 | operation fixtures prove current status/code preservation and fallback |
| ACC-WDA-005 | inventory/regression proves existing surface unchanged and one new tool once |
| ACC-WDA-006 | disposable local five-call chain and negative/security assertions PASS |
| ACC-WDA-007 | structure and exact diff-scope gates PASS |

## 6. Frozen blocker disposition

| Finding | Classification | Disposition |
|---|---|---|
| BU-001 single-write-tool conflict | SHIP_BLOCKER | §23 amendment; no successor |
| BU-002 model-3 | FOLLOW_UP_DEBT | use supported model 2 |
| BU-003 required CAS | FOLLOW_UP_DEBT | current optional field |
| BU-004 transaction/audit | OUT_OF_SCOPE_SERVICE_HARDENING | no service change |
| BU-005 receipt hash/version | OUT_OF_SCOPE_SERVICE_HARDENING | no service change |
| BU-006 recursive array schema | MECHANICAL_FIX | existing renderer; no framework |
| BU-007 error truth/redaction | SHIP_BLOCKER | current table/fallback only |
| BU-008 proposed service pin | MECHANICAL_FIX | removed |
| BU-009 400/422 drift | MECHANICAL_FIX | corrected above |
| BU-010 dedicated scope | FOLLOW_UP_DEBT | current scope; zero Grant change |

This is the complete review union for this round.

## 7. Lifecycle

No data, service, scope, Grant, credential, production, or deployment change is
authorized. Owner acceptance of the independently reviewed exact authority head
is required before implementation. After acceptance, implementation receives
one independent code audit and stops at
`WORKFLOW_DEFINITION_AUTHORING_READY_FOR_INTEGRATION = YES`.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts
EXTERNAL_AUTHORITIES = SVC_WORKFLOW_PRODUCT_BOUNDARY_V6@22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 7
CONTRACTS_WITH_ACCEPTANCE = 7
AUTHORING_READY_FOR_REVIEW = YES
```
