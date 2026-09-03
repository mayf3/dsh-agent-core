---
spec_id: AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-03
scope:
  - packages/broker
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V6
    revision: 22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7
    relation: constrained_by
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_DEFINITION_AUTHORING_HTTP_CONFORMANCE_V1
    revision: aa9b3e116bab8881fe83d6bc400f9a2f6e739066
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1

## 1. Goal

Expose exactly four existing svc-workflow Definition Authoring writes to the
model through the trusted Broker seam:

```text
create_definition
create_draft_version
replace_draft_graph
publish_version
```

The terminal proof is a disposable local chain ending in the already accepted
`workflow_execute(operation="create_instance")` consuming the newly published
version. Production apply is not authorized.

## 2. Scope and non-goals

In scope: four new model-facing Broker manifests, exact service bindings,
strict schemas, trusted identity/credential/idempotency seams, downstream error
preservation, registration, and focused/local integration tests.

Out of scope: adding operations to `workflow_execute`; changing its
`create_instance|transition` semantics; Workflow read tools; archive,
deprecate, revoke, delete, patch-node, patch-edge, Domain management; Grant or
scope mutation; a generic builder/admin framework; deployment or live writes.

## 3. Authority and dependencies

The local Product Architecture requires external products to remain behind the
generic Broker and forbids trusting request-body identity. The accepted
`AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1` remains authoritative
for `workflow_execute`, whose operation list stays exactly
`create_instance|transition`.

The external service owns Definition semantics. This proposed Spec pins the
exact proposed service conformance revision named in frontmatter. Before local
acceptance, that pin must be advanced mechanically to the independently
reviewed, Owner-accepted service head; implementation cannot start earlier.

## 4. Current State

At dsh base `bf2efd52f28a63c95d5b07253031ff793390bd1a` and service
base `22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7`:

- all four service routes exist and use Direct Token, `workflow.execute`,
  Domain Owner authorization, and server-side business rules;
- dsh-agent-core has no corresponding manifests;
- the service adapter has the conformance gaps recorded in
  `WORKFLOW_DEFINITION_AUTHORING_CENSUS_V1` OBS-CEN-003.

## 5. Observations

- **OBS-001:** census OBS-CEN-001/002 records the exact four HTTP bindings and
  service-owned rule boundary.
- **OBS-002:** census OBS-CEN-004 records zero Broker authoring manifests and
  the accepted `workflow_execute` exclusion.
- **OBS-003:** census OBS-CEN-003 records path-binding, transaction, receipt
  hash, and validation-error defects in the service adapter.
- **OBS-004:** existing Broker transport generates `Idempotency-Key` only from
  the trusted side when `http.idempotencyKey=true`; it never sources actor or
  credential fields from model arguments.

## 6. Claims and assumptions

- **CLM-001 (SUPPORTED):** four standalone tools are the minimum packaging:
  every capability is directly discoverable, schemas stay operation-specific,
  and no multi-operation builder or `workflow_execute` contract changes.
- **CLM-002 (SUPPORTED):** reusing the service's currently frozen
  `workflow.execute` route scope creates no new privilege or Grant. The Broker
  requests the exact endpoint scope and a caller without it fails closed.
- **CLM-003 (SUPPORTED):** service rules and typed service errors must pass
  through; implementing lifecycle or graph validation in Broker would create a
  competing authority.
- **OPEN_ASSUMPTION:** none. The external accepted revision pin is an explicit
  lifecycle prerequisite, not an assumption.

## 7. Evidence relations

- **EVD-001:** OBS-001 supports CLM-003 and the four route bindings.
- **EVD-002:** OBS-002 supports CLM-001 and the need for this new Spec.
- **EVD-003:** OBS-003 supports the external conformance dependency and prevents
  premature Broker acceptance.
- **EVD-004:** OBS-004 supports the identity, credential, and trusted
  idempotency contracts below.

## 8. Decisions

- **DEC-001 — packaging:** add four standalone tools named
  `workflow_create_definition`, `workflow_create_draft_version`,
  `workflow_replace_draft_graph`, and `workflow_publish_version`.
- **DEC-002 — authority:** svc-workflow remains the sole business-rule and
  authorization authority. Broker performs only strict argument-shape checks
  already supported by its generic manifest pipeline.
- **DEC-003 — privilege:** request the exact service route scope
  `workflow.execute`; make no Grant change and create no `workflow.admin` or new
  scope. A future scope split is separate authority.
- **DEC-004 — writes:** all four use trusted `Idempotency-Key`; the key is not a
  model argument. Broker automatic retry is forbidden, apart from the existing
  transport's same-key 401 credential refresh behavior for idempotent writes.

## 9. Contracts

### CTR-WDA-001 — create_definition

`workflow_create_definition` has one `create_definition` operation:

```text
POST /internal/v1/domains/{domainId}/definitions
pathParams = [domainId]
body = [definitionKey, displayName, description, metadata]
required = [domainId, definitionKey, displayName]
idempotencyKey = true
requiredScopes = [workflow.execute]
```

It returns the canonical `workflowDefinitionId` needed by the next operation.
The model cannot supply actor, principal, credential, token, audit identity, or
idempotency key.

### CTR-WDA-002 — create_draft_version

`workflow_create_draft_version` has one `create_draft_version` operation:

```text
POST /internal/v1/domains/{domainId}/definitions/{definitionId}/versions
pathParams = [domainId, definitionId]
body = [contextSchema, jsonSchemaDialect, validatorVersion, metadata,
        semanticModelVersion]
required = [domainId, definitionId]
idempotencyKey = true
requiredScopes = [workflow.execute]
```

`semanticModelVersion`, when supplied, is exactly service-supported integer
`1|2`; no ancestry/fork field is invented. Success returns canonical
`definitionVersionId`, version number, and DRAFT status.

### CTR-WDA-003 — replace_draft_graph

`workflow_replace_draft_graph` has one `replace_draft_graph` operation:

```text
PUT /internal/v1/domains/{domainId}/definitions/{definitionId}/draft
pathParams = [domainId, definitionId]
body = [definitionVersionId, contextSchema, nodes, transitions]
required = [domainId, definitionId, definitionVersionId, nodes, transitions]
idempotencyKey = true
requiredScopes = [workflow.execute]
```

This is whole-graph replacement only. Node and transition objects expose
exactly the service DTO fields; every object schema rejects additional
properties. Broker does not add patch behavior or validate graph meaning.
Service failure leaves the prior graph unchanged.

### CTR-WDA-004 — publish_version

`workflow_publish_version` has one `publish_version` operation:

```text
POST /internal/v1/domains/{domainId}/definitions/{definitionId}/publish
pathParams = [domainId, definitionId]
body = [versionId, expectedRevision]
required = [domainId, definitionId, versionId]
idempotencyKey = true
requiredScopes = [workflow.execute]
```

Publication validation and CAS are server-authoritative. Success returns the
canonical version status/digest/published timestamp. There is no broker retry.

### CTR-WDA-005 — strict schema and trusted seams

Every generated tool schema has `additionalProperties=false`, including nested
node and transition objects. Required fields are operation-local. The four
tools contain no `principalId`, `agentId`, `actor`, `subject`, `credential`,
`accessToken`, `clientSecret`, `idempotencyKey`, or trusted audit field.
Identity and credentials come only from the existing caller-bound Broker seam.

### CTR-WDA-006 — downstream errors

The manifests declare and preserve the service's actual typed families:

```text
401 unauthenticated
403 forbidden | direct_token_required | domain_disabled | not_domain_owner
404 definition_not_found
409 definition_key_conflict | definition_not_editable |
    definition_version_immutable | revision_conflict | idempotency_conflict
422 unknown_field | invalid_json | invalid_semantic_model_version |
    graph_validation_failed | schema_validation_failed |
    fixed_principal_invalid | digest_failure
425 command_still_processing
413 size_limit_exceeded
500 internal_consistency_error
503 service_unavailable
```

Only codes mechanically present in the accepted service revision may remain in
the final table. The Broker must not collapse a declared downstream code into a
generic transport error.

### CTR-WDA-007 — registration and compatibility

The four manifests join the existing workflow manifest set and register exactly
once. `workflow_execute` remains one tool with exactly
`create_instance|transition`; `workflow_transition` remains absent; all existing
Workflow read manifests and their semantics are byte-for-meaning unchanged.

### CTR-WDA-008 — local integration chain

A disposable local database/service/Broker test performs, via the public
bindings and trusted credential seam:

```text
create_definition
-> create_draft_version
-> replace_draft_graph
-> publish_version
-> workflow_execute(create_instance)
```

It mechanically reads the generated catalog, invokes all five calls, verifies
the published version is immutable, and verifies the created instance binds
that exact canonical version. It touches no production service, database,
Grant, or credential.

### CTR-WDA-009 — implementation boundary

Allowed dsh code is limited to the Workflow capability manifests, their export
and default-inventory wiring if mechanically required, and focused/integration
tests. Registry, mapping, transport, relay, gateway, or compose algorithms may
change only if a failing acceptance test mechanically proves the existing
generic path cannot host these single-operation manifests; any fix is minimal
and recorded. No service business rule is copied into Broker.

## 10. Acceptance

| ACC | Contract | Required evidence |
|---|---|---|
| ACC-WDA-001 | CTR-WDA-001..004 | generated catalog contains all four tools; fake transport tests prove exact methods/paths/bodies/scopes/results |
| ACC-WDA-002 | CTR-WDA-005 | unknown top-level/nested fields fail before token/HTTP; forbidden identity/credential/key fields absent from schema and wire |
| ACC-WDA-003 | CTR-WDA-006 | one test per real error family proves exact downstream code/status preservation |
| ACC-WDA-004 | CTR-WDA-003..004 | service-backed tests prove invalid replacement is atomic, published replacement is rejected, invalid publish fails closed, CAS conflict preserved |
| ACC-WDA-005 | CTR-WDA-007 | inventory and regression tests prove exact existing write/read surface unchanged |
| ACC-WDA-006 | CTR-WDA-008 | disposable local five-call chain PASS with canonical version/instance readback |
| ACC-WDA-007 | CTR-WDA-009 | structure gate and exact diff scope PASS |

## 11. Alternatives and disposition

- **ALT-001:** add the four operations to `workflow_execute` — rejected; it
  contradicts the accepted exact two-operation contract.
- **ALT-002:** one generic `workflow_admin` or builder engine — rejected as
  excessive privilege and framework scope.
- **ALT-003:** duplicate graph/lifecycle checks in Broker — rejected; creates a
  second business authority and drift risk.
- **ALT-004:** invent a new scope — rejected; the existing service contract has
  an exact scope, and this repository cannot govern auth-service Grants.

## 12. Migration, compatibility, and rollback

The change is additive at the Broker catalog. No persisted data migration,
Grant migration, or production rollout is authorized. Local rollback removes
the four new manifests/wiring and tests; existing tools are untouched.
Production deployment and rollback require a separate authority.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = external accepted revision pin only
```

The pin is filled mechanically after service Spec acceptance and before this
Spec's final acceptance head. It is not delegated to implementation.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = SVC_WORKFLOW_PRODUCT_BOUNDARY_V6 + SVC_WORKFLOW_DEFINITION_AUTHORING_HTTP_CONFORMANCE_V1
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = external accepted revision pin
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 9
CONTRACTS_WITH_ACCEPTANCE = 9
AUTHORING_READY_FOR_REVIEW = YES
```
