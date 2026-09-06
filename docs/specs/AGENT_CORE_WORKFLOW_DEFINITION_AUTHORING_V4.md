---
spec_id: AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-06
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
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_DEFINITION_GRAPH_DIAGNOSTICS_V1
    revision: 0d56d1e32b5bea5a65ef32706bc70449910866f0
    relation: depends_on
supersedes: [AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V3]
superseded_by: null
owners: [repository-maintainers]
---

# AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4

## 1. Goal

Make common linear Definition authoring accessible through business-level steps,
with actionable canonical validation errors. Preserve the four existing operations
of `workflow_definition_authoring` and all instance-execution semantics.

## 2. Scope and non-goals

Whole-authority successor to V3. Retain all four operations, full/linear forms,
canonical graph output, service models, diagnostics, identity and lifecycle contracts.
The sole new permission is CTR-WDA-007's narrow authoring-only model presentation
correction at the existing registry boundary. No generic presentation framework is added.
No new tool/operation, graph model, validator, service endpoint, store, lifecycle,
permission, routing framework, generic DSL, scheduler or execution change.

## 3. Authority and dependencies

V3 is accepted on dsh main at `600d4df9b50fa4b7ffc368020cf0a8840d37346e`.
Its CTR-WDA-004/011 require actionable model-visible diagnostics and guidance, but
CTR-WDA-007 expressly forbids registry changes. Actual model-facing evidence found
that registry normalization drops the top description and output rendering drops
safe error detail. Existing manifest/handler changes alone cannot restore the latter
without misusing frozen error-code, status or request-id semantics. V4 changes only
this load-bearing implementation boundary; it does not retroactively authorize the
held implementation candidate. All other standing V3 Contracts remain unchanged.

Parent AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1 DEC-011 and Product
Architecture retain ownership of the same authoring family and caller-bound seams.
The compiler remains a pure capability handler; service canonical models/validator
remain the sole business authority. The paired diagnostics authority is accepted on
svc main `0d56d1e32b5bea5a65ef32706bc70449910866f0`, retaining reviewed semantic head
`78323394c6c6d82a14657bdfd6589419fdbb6dff`. No svc semantic or implementation change
is part of this successor.

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

## 4. Current state, observations and evidence

- OBS-WDA-101: read-only Git inspection on 2026-09-06 at dsh
  `a95410e6c771c11f786a2f9a024b18931fecfdb4`: V2 accepted and manifest has four
  operations, full-graph shape, model enum 1/2/3 without default guidance.
- OBS-WDA-102: same date, read-only filesystem SHA256 of
  `/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow-definition-authoring.js`
  equals source manifest: `60ad96c940249559e0a9563a1b3b75b474ded3a59df99f953272b0e703ca956c`.
  This proves deployed file identity only, not process reload or runtime health.
- OBS-WDA-103: service `e297ff1f3913133058d97bb30bcf8f63b3e137f9`,
  `src/http/handlers/definitions.rs` defaults omitted semanticModelVersion to 1;
  model 3 validator requires TASK/TERMINAL with entry first TASK, primary ADVANCE
  and fixed canonical owner references; no artificial DRAFT start exists in 3.
- OBS-WDA-104: dsh source `gateway.js` builds generic HTTP handlers and
  `transport.js` reads only top-level service error message; the unchanged detail
  sanitizer redacts opaque strings of 24+ characters. A long rule code embedded
  verbatim in prose therefore cannot be relied on for model visibility.
- CLM-WDA-101 (SUPPORTED): B is mechanical description conformance, A/C require
  changed authoring authority. EVD-WDA-101: OBS-101/103 support this route against
  V2 DEC-002/CTR-001/002/004 at the named revisions. Sufficient for docs-first
  routing, insufficient for runtime acceptance.
- CLM-WDA-102 (SUPPORTED): model 3 already represents the requested bounded linear
  case. EVD-WDA-102: OBS-103 and accepted CTR-VAI-011 support this mapping. No new
  graph semantics are needed. First work TASK is the conceptual start.

- OBS-WDA-105: after controlled deployment of dsh main `600d4df9b50fa4b7ffc368020cf0a8840d37346e`
  authoring files and svc `0d56d1e32b5bea5a65ef32706bc70449910866f0`, a normal Feishu
  HR Agent request on 2026-09-06 emitted an actual tool header with authoring description
  `undefined`. The service returned canonical `graph_validation_failed` 422; the model
  output showed code/status/request-id but no rule correction. The model used legacy
  full graph input and stopped. Definition/draft exist; no publication or instance.
- OBS-WDA-106: exact base source `schema.js` validates but omits description from its
  normalized manifest; `registry.js` interpolates the missing value and omits error.detail.
  Independent review of held candidate `d2aabd7d34191585137bfeef4156381f1091ca6b`
  found functional tests pass but CTR-WDA-007 prohibits its registry modification.
- CLM-WDA-103 (SUPPORTED): a narrow registry presentation exception is required to
  fulfill unchanged CTR-WDA-004/011 through the existing normal model-facing envelope.
  EVD-WDA-103 binds OBS-105/106 to CTR-WDA-007 and this route. The committed
  `docs/reports/WORKFLOW_AUTHORING_MODEL_PRESENTATION_V4.md` pins sanitized evidence,
  source coordinates, methods, limitations and the held/no-merge disposition.

## 5. Execution route

`SUPERSEDE / EXEC_PLAN / CONTROLLED`, docs-first. Owner attachment dispatch in
Goal WORKFLOW_AUTHORING_USABILITY_PRODUCTION_V1 authorizes investigation, docs,
independent review, bounded repair and subsequent delivery under accepted Contracts.
No further product repair, implementation integration or deployment may rely on V4
before exact-head acceptance, lifecycle finalization and main integration. The held
registry candidate is evidence only and has no merge/deployment authority.

## 6. Previously rejected alternatives

V2 rejects a generic authoring framework and silently mapping model 3 to 2.
Both remain rejected. NEW_EVIDENCE=OBS-WDA-101/103 demonstrates a bounded handler
using existing model 3 without a new tool or framework. Full-graph escape hatch stays.

## 7. Evidence limits

Source/live-file observations do not claim production service diagnostics, Agent
E2E or deployment. Those require executed observations at implementation/operation.

## 8. Decisions

- **DEC-001:** retain exactly one `workflow_definition_authoring` capability/tool
  with exactly four operations, following ONE CAPABILITY → ONE TOOL / MULTI-OPERATION.
- **DEC-002:** Broker performs shape validation, bounded linear compilation under CTR-WDA-010, and transport mapping;
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
  body allowed fields [definitionVersionId, contextSchema?, nodes?, transitions?,
                       steps?, terminalOutcome?]
  required [domainId, definitionId, definitionVersionId]; then exactly one input form:
  full: nodes + transitions
  linear: steps + terminalOutcome
  additionalProperties=false; exactly-one-form and full-form compatibility are frozen
  by CTR-WDA-010. The linear form is compiled into canonical nodes + transitions
  before the existing service HTTP request; steps/terminalOutcome are input fields,
  not additional service wire fields. Linear input/output obligations are CTR-WDA-010.
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
recursive validator is authorized. The linear input has the exact closed nested shape
and bounded validation defined in CTR-WDA-010; existing full input remains compatible. Current service validation remains
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
| 422 | `invalid_semantic_model_version`, `graph_validation_failed` |
| 425 | `command_still_processing` |
| 500 | `internal_consistency_error` |
| 503 | `service_unavailable` |

Tests assert only codes reachable per operation. Undeclared downstream codes
remain fail-closed through existing `http_4xx|http_5xx`. Canonical graph failures
on draft replacement/publication use the service-owned 422 `graph_validation_failed`
after the service diagnostics dependency is accepted and integrated. The existing
sanitized top-level service message carries an actionable rule identity: long codes
are rendered as reversible space-separated rule tokens by the service; raw stable
codes remain in the service's structured details. The Broker MUST prove rule identity
and correction survive its real sanitizer and normal model-facing envelope.
No generic transport/sanitizer relaxation, raw `details` forwarding, SQL, stack trace,
private identity or credential exposure is allowed. Non-graph schema/digest failures
keep existing 500 mapping; fixed-principal rejection stays opaque 404
`definition_not_found`; invalid enum parsing stays its existing failure. New diagnostics
never turn a rejected graph into success or weaken canonical validation.

### CTR-WDA-005 — compatibility

`workflow_execute` remains exactly `create_instance|transition`;
`workflow_transition` remains absent. Existing read tools and service wires are
unchanged. The existing capability remains registered exactly once.

### CTR-WDA-006 — retained model-2 local proof

The disposable test invokes all four authoring operations (model 2), then
`workflow_execute(create_instance)`. Catalog and canonical readback prove the
instance binds the exact published version. It also proves invalid graph
rejection, published immutability, supplied stale-CAS preservation, root unknown
field rejection, nested closed item schemas in catalog, identity-field
exclusion, and no auto retry. No production resource is used.

### CTR-WDA-007 — implementation boundary

Product code is limited to the Workflow Authoring manifest, a dedicated pure
linear compiler/handler module, minimal gateway handler wiring, dedicated focused
tests/integration scripts, and the following narrow existing-registry presentation
exception, all within existing structure limits. Gateway may select that capability
handler using the existing caller-bound transport, only for this capability.

Only for wire capability id AND tool name both `workflow_definition_authoring`, the
existing registry may (a) retain the already type-validated raw authoring description
in the model tool definition, and (b) append a nonempty safe bounded error.detail to
normal model output for service-owned `graph_validation_failed` with HTTP 422, or
locally rejected `invalid_arguments` on `replace_draft_graph` with no downstream
HTTP status. Detail must pass the existing unchanged sanitizer and bounds. Preserve
code, status and request-id meanings; never expose raw structured service details.
Unknown/disabled principal errors, other server errors and all other capabilities'
description/schema/success/error rendering remain unchanged. Do not change input
schema, validation predicates, registration count or dispatch semantics through this
exception. It is not a generic hook, error forwarding policy or registry redesign.

No other registry changes, mapping changes, generic transport/sanitizer/relay algorithm
changes, credential resolution changes, schemas of other capabilities, or svc-workflow
implementation changes are authorized. Existing full-graph HTTP bindings remain
byte-for-meaning unchanged. Do not grow over-limit legacy files or create a generic
hook framework.

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

### CTR-WDA-010 — bounded linear form and deterministic canonical output

`replace_draft_graph` accepts exactly one of:

- full form: existing `nodes` and `transitions`, no `steps` or `terminalOutcome`;
- linear form: `steps` and `terminalOutcome`, no `nodes` or `transitions`.

Both require existing `domainId`, `definitionId`, `definitionVersionId`; optional
`contextSchema` keeps its existing meaning. Root unknown fields are rejected.
`steps` is an array of 1..32 closed objects, each containing only required
`displayName` (1..200 Unicode code points, nonblank), `assigneePrincipalId` (canonical
UUID text, no display-name resolution), `instructions` (1..4000 Unicode code points,
nonblank). `terminalOutcome` is a required nonblank string of 1..200 code points.
Strings are preserved verbatim after checking nonblank; there is no intent rewriting.
Identity supplied here is a work assignment, never caller/actor/auth identity.

The caller creates the draft explicitly with `semanticModelVersion=3`. The linear
form has no model-version selector and never edits/guesses the stored version's model.
Wrong-model targets remain subject to canonical service rejection; no fallback occurs.

For N steps, generate N TASK nodes named `step_1`..`step_N`, order indices 0..N-1,
with exact FIXED_PRINCIPAL references and supplied display names/instructions. Generate
one TERMINAL node `done`, order N, display_name=terminalOutcome, no owner or primary.
Generate exactly N ADVANCE transitions `advance_1`..`advance_N`, display_name=`继续`,
from each step to its successor (last to `done`). Each TASK's
`primary_advance_transition_key` is its own outgoing transition key. First TASK is the
unique entry/start. Do not generate a DRAFT, phantom step, RETURN, TERMINATE effect,
condition, submission schema, context value, metadata intent or extra work instruction.
Use existing snake_case nested fields and camelCase envelope. Same input produces
byte-equivalent ordered graph JSON; service-generated UUIDs remain service-owned.

The handler submits exactly one existing replace-draft HTTP request through the
same trusted transport. The service must run the canonical validator before persistence;
compiler success alone is never validation success. Return the existing service response
unchanged. Publish and instantiate remain separate existing calls; no multi-write saga,
auto-publish, hidden retry, permission expansion or local definition store is introduced.

Malformed/mixed/empty/oversized input, unknown nested fields, bad UUID shape and
unsupported branch/loop/effect fields return local `invalid_arguments` with bounded
static actionable detail and field/index location before HTTP/credential acquisition.
Complex structures are directed to the existing full form; they are never flattened.
Unknown/disabled valid-shaped principals are rejected solely by the existing service
identity checks with the existing opaque error. No principal enumeration oracle.

### CTR-WDA-011 — model-facing guidance and identity discovery

Tool/operation guidance must explain full versus linear forms, the exact supported
sequence, explicit model 3 for linear authoring, separate publish/exact-version instantiate,
and correction from service rules. `semanticModelVersion` description states omission
means Legacy 1, 2 means Minimal, 3 means Visit Activation; the integer is a semantic
choice, not a quality/newness ranking. Do not alter enum/default injection or old wires.
Only directly verified adjacent default descriptions may change. Lane B alone changes
no schema shape, auth or service behavior; Lane C's new input form is separately governed.
Use `workflow_my_domains` and canonical DOMAIN_OWNER records; do not require Owner UUID
input or route by display names. Resolve intended Agent assignments through existing
canonical identity discovery. If exact resolution is unavailable, stop with an explicit
identity gap; do not invent a principal or request new permission silently.

## 10. Acceptance

| ACC | Evidence |
|---|---|
| ACC-WDA-001 | catalog has one tool/four operations; fake transport proves exact method/path/body/scope/result |
| ACC-WDA-002 | catalog proves exact nested full/linear schemas; legal graph expressible; service rejects invalid graph |
| ACC-WDA-003 | identity/credential/key absent from schema/wire; trusted key behavior passes |
| ACC-WDA-004 | operation fixtures prove current status/code preservation and fallback |
| ACC-WDA-005 | inventory/regression proves existing surface unchanged and existing tool registered once |
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

### ACC-WDA-010 — compiler and canonical integration

Contracts: CTR-WDA-010, CTR-WDA-002/003/005/007. Method: deterministic boundary tests
and actual gateway -> HTTP -> disposable svc/PostgreSQL author/replace/publish/instantiate
chain; mutate expanded graph for canonical rejection. Environment: isolated candidate
and disposable database only. Evidence: exact SHAs, commands, generated catalog, output
JSON, transport calls, canonical readback and unchanged-state negatives. Expected: 1,
2 and 32 steps produce specified graph; first TASK entry; exact assignments/instructions;
32 bound/empty/mixed/unknown/nested/UUID/oversize negatives have zero HTTP/token calls;
wrong model/unknown principal/unauthorized domain fail closed; full form remains unchanged.
No compiler-only pass substitutes for validator execution. Any mismatch, extra write,
retry, leaked identity, accepted invalid graph or canonical bypass fails acceptance.

### ACC-WDA-011 — diagnostics and model guidance

Contracts: CTR-WDA-004/007/008/010/011. Method: before/after catalog and handler capture,
actual service error through Broker sanitizer AND the registered tool's output renderer.
Environment: isolated local composed stack. Exercise real registration, relay/gateway,
and model-facing rendering, not only the intermediate gateway result.
Evidence: exact source/service/authority SHAs, schema semantic comparison excluding
description text for Lane B, omission/1/2/3 wire assertions; representative entry, unknown
transition target, primary relationship, cycle/connectivity and assignee-form failures.
Expected: stable rule identity and static correction visible; invalid state not persisted;
sensitive raw strings absent; no default/schema/auth change from descriptions. Fail on
opaque guessing, sanitizer-erased identity, enum/default injection or exposed internals.
Also require actual top-level model description to retain the accepted linear/model-3/
publish guidance; graph422 output to retain safe named rule and correction; malformed
linear output to identify a bounded local field/index without any credential/HTTP call.
Negative discriminator: pristine V3 registry loses description/detail and must fail this
presentation test. Compare an unrelated capability's description, error and success
rendering byte-for-byte; any change outside the exact authoring exception fails.

## 11. Delivery and production acceptance

A controlled operation under the Owner's Goal mandate follows accepted authority,
focused tests, one independent implementation audit, frozen blocker union, one bounded
repair and one fresh re-audit if required, then merge/build/deploy. It binds deployed
preimages, exact artifact provenance, health baseline, production lock census and slot,
serialized apply, durable receipt/readback, independent post-state verification, and
rollback. Unknown apply outcome requires reconciliation, never blind replay. Production
permission comes from the mandate/runbook, not this Spec.

Normal Agent E2E starts with the natural-language two-Agent business request in the Goal.
The Agent discovers canonical domain/assignees, creates definition and model-3 draft,
supplies steps without full graph JSON, gets canonical validation success, publishes,
and instantiates the exact published version. Record model tool trace and authoritative
readback. One bounded downstream HR discovery -> exact target execution -> self-transition
smoke proves readiness without reopening those dependencies. An internal runner alone
cannot satisfy this terminal test. Local tests never stand in for production evidence.

### ACC-WDA-012 — production terminal proof

Contracts: all affected CTR-WDA-001..011 and this section's delivery boundary. Method:
normal model-facing Agent request and canonical readbacks; bounded downstream smoke.
Environment: production after controlled apply. Evidence: exact deployed hashes, Agent
session/request identifiers, sanitized tool sequence, published/instance version IDs,
HR discovery and target self-transition receipts, post-apply health. Expected: user needs
no internal UUID, Agent writes no full graph for supported linear case, no blind retry,
validation/publish/exact-version instantiate/downstream smoke/health all pass. Failure:
any absent receipt, internal-runner substitute, identity guessing, broadened permission,
invalid graph accepted, mismatched version or unhealthy runtime. Remain INCOMPLETE.

## 12. Compatibility, rollback and authority lifecycle

Existing full-graph four-operation callers and the V3 linear compiler remain compatible.
There is no database migration, graph/model rewrite or execution change. A V4 registry
rollback restores its exact prior file, preserving all V3 authoring/service functionality;
it can restore the known missing guidance/error text, so usability is then INCOMPLETE.
Existing published versions and instances remain valid. Service diagnostics and its
compatible receipt decoder remain unchanged by this registry-only operation.

Proposed V4 does not retire V3. After independent exact-head semantic ACCEPT, Owner
accepts that exact reviewed head. Then V4 becomes accepted and V3 superseded/backlinked
in one docs-only lifecycle transaction, with independent lifecycle recheck and main
merge before implementation integration. V3 semantic body remains immutable. Already
accepted svc authority stays active without another acceptance or service semantic head.

## 13. Authoring result

SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts (effective only after acceptance in base)
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
OPEN_OWNER_DECISIONS = exact reviewed semantic head acceptance
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 11
CONTRACTS_WITH_ACCEPTANCE = 11
AUTHORING_READY_FOR_REVIEW = YES
NEXT_ACTION = INDEPENDENT_SEMANTIC_REVIEW
