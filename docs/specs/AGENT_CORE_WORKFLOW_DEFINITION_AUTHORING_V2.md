---
spec_id: AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V2
status: accepted
accepted_date: 2026-09-05
accepted_by: mayf3
accepted_reviewed_head: 092d9c16a4ec0f6e8f60468373b1560f7e846565
independent_review_result: PASS
independent_review_blockers: NONE
acceptance_delta_class: lifecycle_provenance_only
semantic_delta_from_reviewed_head: none
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-05
scope: [packages/broker]
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_PRODUCT_BOUNDARY_V6
    revision: 22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7
    relation: constrained_by
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1
    revision: 22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7
    relation: constrained_by
supersedes: [AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1]
superseded_by: null
owners: [repository-maintainers]
---

# AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V2

## 1. Goal

Expose the same four service writes through one `workflow_definition_authoring`
tool: `create_definition | create_draft_version | replace_draft_graph |
publish_version`. Extend the existing draft-version surface to formally accept
and transmit model 3 (`VISIT_ACTIVATION_V1`) without changing service-owned
meaning, and prove the disposable author/publish/create chain.

## 2. Scope and non-goals

The full existing Broker authoring authority is carried forward. The only new
product delta is model 3 acceptance/unchanged transmission and its focused proof.
Existing manifest, four bindings, strict shape validation, error mapping and
trusted caller/credential/idempotency seams remain frozen. No model 4, new tool,
operation, generic framework, service code, publication lifecycle, workflow_execute,
Session Messaging, Scheduler, Auth/Grant, live write or deployment is authorized.
Service-side decoder/validation repairs belong to its own accepted authority.

## 3. Authority and dependencies

This is a whole-authority successor. V1 DEC-005 and CTR-WDA-001 explicitly limit
models to 1/2, so adding 3 changes accepted meaning and cannot use additive
AMEND or an independent supplement to override V1. All V1 obligations remain
below except that bounded model enum expansion. Existing stable IDs refer to
this new Spec identity; V1 itself remains immutable while proposed.

The accepted parent excludes Definition management from its own implementation
scope; its DEC-010 remains the instance-execution pair `create_instance|transition`.
This successor remains a separate authoring authority and does not modify it.
Product Architecture keeps external service semantics outside Agent Core.
The pinned service CTR-VAI-001 defines 3 = VISIT_ACTIVATION_V1; CTR-VAI-002/004
own model-3 graphs. This Spec neither creates nor changes that meaning.

The exact retained endpoint bindings are:

| Operation | Endpoint |
|---|---|
| create_definition | POST /internal/v1/domains/{domainId}/definitions |
| create_draft_version | POST /internal/v1/domains/{domainId}/definitions/{definitionId}/versions |
| replace_draft_graph | PUT /internal/v1/domains/{domainId}/definitions/{definitionId}/draft |
| publish_version | POST /internal/v1/domains/{domainId}/definitions/{definitionId}/publish |

All four endpoints require Direct Machine Token, `workflow.execute`, Domain Owner
authorization and server-consumed `Idempotency-Key`; token supplies actor identity.
Broker forwards deterministic path/body mapping without authorizing relationships.
Service stays the sole identity, authorization, validation, lifecycle, persistence,
audit and receipt authority. Acceptance of this Spec does not grant production
apply authority or claim downstream implementation complete.

## 4. Current State

STATE-WDA-001: Broker source/authority at
`ec074d568f7b99ec76118e6d45abab410b55198d`, local read-only Git observation on
2026-09-05, accepts models 1/2. Basis OBS-WDA-001 and CLM-WDA-001. No production
state is inferred from these source observations.

## 5. Observations

- OBS-WDA-001: source `mayf3/dsh-agent-core@ec074d568f7b99ec76118e6d45abab410b55198d`,
  local Git inspection 2026-09-05: V1 DEC-005/CTR-WDA-001 and
  `packages/broker/src/capabilities/workflow-definition-authoring.js` encode 1/2.
  Method: read exact files; provenance: those Git blobs.
- OBS-WDA-002: source `mayf3/svc-workflow@22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7`,
  local `git show` 2026-09-05: accepted
  `docs/specs/SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1.md#CTR-VAI-001` explicitly
  defines 3 = VISIT_ACTIVATION_V1, preserves 1/2, rejects unknown runtime values;
  CTR-VAI-002 owns TASK/TERMINAL graphs. Provenance: exact Git blob.

## 6. Claims and assumptions

CLM-WDA-001 — SUPPORTED: Broker needs a successor to admit 3; service already
owns exact model-3 semantics. Evidence EVD-WDA-001; no contradicting authority
found in the targeted WDA/Workflow artifacts. Limitation: source authority is not
proof of runtime conformance; downstream repair and executed local proof remain
implementation gates. No normative open assumption is used.

## 7. Evidence relations

EVD-WDA-001: OBS-WDA-001/002 SUPPORT CLM-WDA-001 at their exact repository SHAs,
local Git environment, 2026-09-05. Sufficient for bounded authority routing and
semantic ownership; insufficient for deployment or runtime completion. Provenance
is the exact versioned authority/source paths in those observations.

## 8. Decisions

- **DEC-001:** add exactly one capability/tool, `workflow_definition_authoring`,
  with four operations, following ONE CAPABILITY → ONE TOOL / MULTI-OPERATION.
- **DEC-002:** Broker performs shape validation and transport mapping only;
  svc-workflow remains the sole business/security authority.
- **DEC-003:** use current exact scope `workflow.execute`; no scope/Grant change.
- **DEC-004:** trusted Broker generates the key; it is not a model argument. No
  automatic business retry except existing same-key 401 credential refresh.
- **DEC-005:** expose service-owned semantic models `1|2|3`; model `3` is
  `VISIT_ACTIVATION_V1` under the pinned svc-workflow authority; keep
  `expectedRevision` optional and preserve `revision_conflict` when supplied.

## 9. Contracts

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
  required [domainId, definitionId]; semanticModelVersion enum [1,2,3]
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
fail closed through existing `http_4xx|http_5xx`. Current graph/schema/digest
failures mapped by service to 500 `internal_consistency_error` stay unchanged;
fixed-principal rejection is deliberately opaque 404 `definition_not_found`;
invalid node-type or transition-effect parsing currently becomes 503
`service_unavailable`. Detail remains behind the existing sanitized transport
boundary. Operation fixtures pin these current outcomes without relabeling them.

### CTR-WDA-005 — compatibility

`workflow_execute` remains exactly `create_instance|transition`;
`workflow_transition` remains absent. Existing read tools and service wires are
unchanged. The new capability registers exactly once.

### CTR-WDA-006 — retained model-2 local proof

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

### CTR-WDA-008 — exact model-3 passthrough and compatibility

For `create_draft_version`, Broker MUST accept integer `semanticModelVersion=3`
and forward JSON number `3` unchanged to the existing endpoint. Explicit `1` and
`2` MUST remain accepted and unchanged. When omitted, Broker MUST omit the field
and preserve the service's existing default. Values `0`, `4`, `"3"`, `null`, and
non-integers MUST fail local shape validation without a service write. There is
no coercion or translation to model 2. Other operations MUST NOT gain a
semantic-model parameter. Graph validation, Definition read/decode, persistence,
publication, and activation semantics remain owned by svc-workflow. Broker MUST
preserve service rejection through CTR-WDA-004; no fallback to a Legacy model or
automatic write retry is introduced.

### CTR-WDA-009 — composed model-3 proof

A disposable local chain MUST use the actual Broker tool for all four authoring
operations with model 3, then the unchanged `workflow_execute(create_instance)`.
Canonical service readback MUST show exact published Definition Version identity
and model 3 on the resulting version/instance. The model-3 graph uses accepted
`TASK | TERMINAL` semantics. A model-3-invalid graph MUST remain rejected by the
service. No direct database insertion or bypass authoring API may substitute for
this proof. Service conformance fixes MUST be integrated under that repository's
own accepted authority before this evidence can pass. Production E2E remains a
separate controlled operation under an attributable mandate.

## 10. Acceptance

| ACC | Evidence |
|---|---|
| ACC-WDA-001 | catalog has one tool/four operations; fake transport proves exact method/path/body/scope/result |
| ACC-WDA-002 | catalog proves exact nested item schemas; legal graph expressible; service rejects invalid graph |
| ACC-WDA-003 | identity/credential/key absent from schema/wire; trusted key behavior passes |
| ACC-WDA-004 | operation fixtures prove current status/code preservation and fallback |
| ACC-WDA-005 | inventory/regression proves existing surface unchanged and one new tool once |
| ACC-WDA-006 | disposable local five-call chain and negative/security assertions PASS |
| ACC-WDA-007 | structure and exact diff-scope gates PASS |


### New acceptance mappings

- **ACC-WDA-008** — Contracts: CTR-WDA-008, CTR-WDA-001, CTR-WDA-002,
  CTR-WDA-003, CTR-WDA-004, CTR-WDA-005. Method: actual generated catalog plus
  handler/fake-transport tests. Environment: isolated local Broker candidate.
  Required evidence: exact implementation SHA, executed command/results,
  catalog enum, recorded method/path/body/scope and call count.
  Expected result: integer 1/2/3 unchanged, omission preserved, 0/4/string/null/
  fraction rejected with zero writes; identity/key excluded and all old wires
  unchanged. Failure condition: coercion, default injection, model 4 acceptance,
  extra tool/operation, altered trust/retry/error seam, or negative request sent.
- **ACC-WDA-009** — Contracts: CTR-WDA-009, CTR-WDA-006, CTR-WDA-007.
  Method: focused real HTTP local composed author/publish/create/readback test;
  focused legacy test and diff/structure gate. Environment: disposable local
  PostgreSQL and svc-workflow with local JWKS/token plus real Broker handlers.
  Required evidence: exact Broker/service/authority SHAs, executed commands,
  sanitized request/readback records, graph rejection and old regression results.
  Expected result: exact model 3 version/instance identity through official paths,
  service-owned invalid graph rejection, model 2 and trusted seams preserved.
  Failure condition: Legacy fallback, permissive enum without downstream proof,
  manual database substitute, scope expansion, or broken retained contract.

For retained ACC-WDA-001..007, Methods and Expected results are the corresponding
Evidence cells above; Environment is isolated local tests/service simulation;
Required evidence is executed command, exact implementation revision and
sanitized assertions/HTTP readback; any unmet cell fails its identically numbered
CTR-WDA-001..007. Unaffected historical evidence may be reused only when the
implementation audit proves the new delta does not invalidate it; the old full
production canary is not repeated by this authoring change.

## 11. Alternatives and disposition

- ALT-WDA-001: REUSE/additive supplement rejected because it contradicts the
  existing explicit 1/2 contract; whole successor preserves authority closure.
- ALT-WDA-002: map 3 to 2 or relax only the schema without service proof rejected:
  accepted service authority distinguishes Minimal from Visit Activation.
- ALT-WDA-003: generic model framework/new authoring tool rejected as unrelated.
- V1's former BU-002 model-3 follow-up is addressed solely by this successor.
  Former CAS, transaction/audit, receipt, scope and service hardening debts remain
  outside this change; no frozen Phase 2–4 work is reopened.

## 12. Migration, compatibility, and rollback

No database migration or persisted model rewrite is authorized here. Omitted
model defaults and explicit 1/2 behavior remain unchanged. Broker rollback restores
its prior manifest and leaves any persisted model-3 records intact; rollback does
not downgrade or convert those records, and temporarily removes ability to author
new model-3 versions through Broker. Service/runtime rollback compatibility is a
separate controlled deployment gate, never inferred from this Spec.

Docs-first acceptance transaction: independent exact-head review, Owner exact-head
acceptance, then lifecycle-only V2 `accepted` and V1 `superseded` with backlink to
V2 in the same docs-only commit; independent final-head lifecycle recheck and
merge to main precede implementation. A proposed successor does not retire V1.
Implementation then uses REUSE at that accepted authority revision, focused tests,
one independent affected-contract audit and integration. Deployment requires a
separate exact artifact/preimage/rollback/health gate under the Goal mandate.

## 13. Open questions

OPEN_OWNER_DECISIONS = NONE (Owner accepted exact reviewed head on 2026-09-05)
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE

SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE
STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
CONTRACT_COUNT = 9
CONTRACTS_WITH_ACCEPTANCE = 9
AUTHORING_READY_FOR_REVIEW = YES
NEXT_ACTION = INDEPENDENT_FINAL_HEAD_RECHECK
