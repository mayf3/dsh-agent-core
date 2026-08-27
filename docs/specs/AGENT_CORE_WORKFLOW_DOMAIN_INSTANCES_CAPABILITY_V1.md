---
spec_id: AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_CAPABILITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - Broker workflow_domain_instances read-only capability
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_HARDENING_PROGRAM_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_DOMAIN_OWNER_INSTANCE_LIST_V1
    revision: 83fd493db26c5e9b5b00d7e308da3c372c4d9ca4
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_CAPABILITY_V1

> **PROPOSED / DOCS ONLY.** This Spec freezes a candidate Broker capability contract. It does
> not authorize implementation, merge, credential or Grant changes, deployment, restart,
> production database access, or any production action.

## 1. Goal

```text
GOAL = expose one Broker-first read-only tool that lets the authenticated Agent Principal list
       Workflow instances in a Domain only when svc-workflow confirms that Principal is the
       Domain's current enabled DOMAIN_OWNER
TOOL = workflow_domain_instances
SUCCESS_OUTCOME = bounded arguments, Broker-first identity, exact downstream route, precise
                  service error/status/request-id preservation, and zero regression
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
```

Current identity and Domain bindings are not the missing mechanism: direct task evidence reports
`workflow_my_tasks = 200` and nine results from `workflow_my_domains`. The missing mechanism is the
formal `workflow_domain_instances` Broker capability. This Spec does not repeat those runtime
probes and does not use `workflow_instance_detail` with a Domain id.

## 2. Scope and non-goals

### In scope

- one new tool/capability id: `workflow_domain_instances`;
- one operation, `list`, bound to the dedicated service contract route;
- arguments `domainId`, `page`, `limit`, `lifecycle`, and `status` only;
- `workflow.read` token scope through the existing trusted parent Broker credential path;
- local argument validation before token acquisition/HTTP where the manifest can decide locally;
- declared downstream service-code, HTTP-status, sanitized-detail, and `x-request-id` preservation;
- regression tests for existing Workflow capabilities and the generic Broker transport.

### Out of scope

- adding or changing a svc-workflow route in this repository;
- accepting Principal, actor, assignee, credential, token, Authorization, target, URL, method,
  path, scope, or header overrides from model arguments;
- Domain Member or global/coordinator authority; cross-Domain aggregation;
- write operations, transitions, assignments, Domain bindings, credentials, Grants, Auth objects,
  deployment, restart, production database operations, Forum posts, or repeated production probes;
- changing `workflow_instance_detail` to accept a Domain id;
- reading `~/.openclaw/credentials` or adding any OpenClaw credential fallback.

## 3. Authority and dependencies

```text
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
PRIMARY_PARENT_REVISION = 4673778e110debd70095ceffdd866c7dd1c0a334
SECURITY_PARENT = AGENT_CORE_HARDENING_PROGRAM_V1
SECURITY_PARENT_REVISION = f8ec58dad8f51ff1107326723981bb174254f74d
CREDENTIAL_PARENT = AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
CREDENTIAL_PARENT_REVISION = d83a2ff0e9644611707d7481ef88b4d7d49fb68e
AUTHORING_BASE = b620907fc6f58292b6ee096c977f0071921d747e
GOVERNED_BY_SERVICE_CONTRACT =
  mayf3/svc-workflow:SVC_WORKFLOW_DOMAIN_OWNER_INSTANCE_LIST_V1
  @83fd493db26c5e9b5b00d7e308da3c372c4d9ca4
SERVICE_SPEC_BLOB = 9c83d5ee4e45d4ffbbe68cc4db9ab3c7b3e1a9d3
SERVICE_SPEC_STATUS_AT_PIN = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
```

The external service Spec owns service route, authorization, projection, error, pagination, and
zero-write meaning. This repository only owns Broker capability declaration, trusted credential
transport, model-visible validation, and error-envelope preservation. It cannot accept, amend, or
implement the external authority. A future implementation preflight MUST repin the exact accepted
service Spec and exact implemented service revision if either differs from the proposed pin above.

## 4. Current State

### STATE-WDI-001 — Broker has four Workflow read tools but no Domain inventory tool

- Subject: `mayf3/dsh-agent-core` at authoring base
  `b620907fc6f58292b6ee096c977f0071921d747e`.
- Environment: source tree plus direct task-provided bounded runtime results; no new runtime probe.
- Observed at: `2026-08-27T01:36:49Z`.
- Projection: shipped Workflow manifests contain `workflow_my_tasks`,
  `workflow_instance_detail`, `workflow_submission_history`, and `workflow_my_domains`; no
  `workflow_domain_instances` exists. Task evidence says caller identity and Domain bindings are
  functioning.
- Basis: `OBS-WDI-001`, `OBS-WDI-002`, `CLM-WDI-001`, `EVD-WDI-001`.

### STATE-WDI-002 — Current generic error envelope loses required service identity

- Subject/base/environment/time: same source coordinates as `STATE-WDI-001`.
- Projection: non-2xx transport currently maps to `http_4xx`/`http_5xx` with raw body detail; the
  mapping/relay/output envelope carries status and detail but not downstream request-id. Therefore
  a manifest-only addition cannot satisfy the required precise errors.
- Basis: `OBS-WDI-003`, `CLM-WDI-002`, `EVD-WDI-002`.

### STATE-WDI-003 — Broker-first credential path already owns identity

- Subject/base/environment/time: same source coordinates as `STATE-WDI-001`.
- Projection: the child relay carries no credential/token; trusted parent Broker selects a
  credential from actual Agent process relationship and performs client-credentials transport.
- Basis: `OBS-WDI-004`, `CLM-WDI-003`, `EVD-WDI-003`.

## 5. Observations

### OBS-WDI-001 — Current Workflow manifest inventory

- Subject: Workflow capability manifests.
- Repository/source: `mayf3/dsh-agent-core`.
- Commit: `b620907fc6f58292b6ee096c977f0071921d747e`.
- Environment: source inspection.
- Observed at: `2026-08-27T01:36:49Z`.
- Method: inspect `packages/broker/src/capabilities/workflow.js` exports and `manifests` array.
- Result: exactly the four tools named in `STATE-WDI-001` are present; the requested tool is
  absent.
- Provenance: exact file and symbols above.

### OBS-WDI-002 — Bounded caller/runtime evidence supplied by Owner

- Subject: current caller projection and Domain bindings.
- Source: direct task instruction; no new probe performed.
- Environment: current Broker/service runtime as described by Owner.
- Observed at: task receipt on `2026-08-27`.
- Method: Owner-reported calls.
- Result: `workflow_my_tasks` returned 200; `workflow_my_domains` returned nine Domains;
  `workflow_domain_instances` is absent; `workflow_instance_detail` accepts only an instance UUID.
- Provenance: task instruction for this authoring round.

### OBS-WDI-003 — Current transport flattens downstream service errors

- Subject/commit/environment/time: same source coordinates as `OBS-WDI-001`.
- Method: inspect `packages/broker/src/transport.js:535-538`,
  `packages/broker/src/mapping.js:130-143`, `packages/broker/src/relay.js:80-90`, and
  `packages/broker/src/registry.js:70-111`.
- Result: non-2xx errors become canonical HTTP families; raw response body is used as detail;
  downstream `x-request-id` is neither captured nor represented in the wire/output schemas.
- Provenance: exact files and line ranges above.

### OBS-WDI-004 — Existing trusted parent path excludes child credentials

- Subject/commit/environment/time: same source coordinates as `OBS-WDI-001`.
- Method: inspect `packages/broker/src/relay.js:1-33`,
  `packages/broker/src/transport.js:443-506`, and accepted credential authority at
  `d83a2ff0e9644611707d7481ef88b4d7d49fb68e`.
- Result: child relay sends capability/operation/args only; parent credential provider supplies
  client id/secret; Authorization is transport-controlled and absent from model arguments.
- Provenance: exact files and authority revision above.

### OBS-WDI-005 — Service dependency is proposed and exact-pinned

- Subject: `SVC_WORKFLOW_DOMAIN_OWNER_INSTANCE_LIST_V1`.
- Repository/source: `mayf3/svc-workflow`.
- Commit: `83fd493db26c5e9b5b00d7e308da3c372c4d9ca4`.
- Environment: docs-only service Spec branch.
- Observed at: `2026-08-27T01:36:49Z`.
- Method: inspect exact Spec commit and blob
  `9c83d5ee4e45d4ffbbe68cc4db9ab3c7b3e1a9d3`.
- Result: proposed service contract freezes the dedicated route, OWNER authorization, safe
  projection, opaque page token, exact errors, and zero writes; it currently grants no
  implementation authority.
- Provenance: external authority pin in frontmatter and §3.

## 6. Claims and assumptions

### CLM-WDI-001 — The missing capability is Broker registration, not caller recovery

- Support state: SUPPORTED.
- Supported by evidence: `EVD-WDI-001`.
- Contradicted by evidence: none known.
- Uncertainty: runtime report is bounded to the observed caller and time.

### CLM-WDI-002 — Manifest-only work cannot preserve required errors

- Support state: SUPPORTED.
- Supported by evidence: `EVD-WDI-002`.
- Contradicted by evidence: none known.
- Uncertainty: none at the pinned source base.

### CLM-WDI-003 — Reusing Broker-first transport is the only compatible identity path

- Support state: SUPPORTED.
- Supported by evidence: `EVD-WDI-003`.
- Contradicted by evidence: none known.
- Uncertainty: credential/Grant readiness for a specific Agent is runtime state, not authorized by
  this Spec.

### CLM-WDI-004 — Service readiness must precede Broker implementation activation

- Support state: SUPPORTED.
- Supported by evidence: `EVD-WDI-004`.
- Contradicted by evidence: none known.
- Uncertainty: independent service review may revise the proposed external contract, requiring a
  new exact pin here.

## 7. Evidence relations

### EVD-WDI-001 — Tool inventory and bounded runtime report support the missing-capability Claim

- Source observations: `OBS-WDI-001`, `OBS-WDI-002`.
- Target: `CLM-WDI-001`.
- Relation: SUPPORTS.
- Bound coordinates: Broker authoring base and Owner-reported current runtime.
- Strength/sufficiency: sufficient to author the missing capability without repeating probes.
- Limitations: not production conformance evidence.
- Provenance: observations above.

### EVD-WDI-002 — Error-path source supports generic preservation requirement

- Source observations: `OBS-WDI-003`.
- Target: `CLM-WDI-002`.
- Relation: SUPPORTS.
- Bound coordinates: Broker authoring base.
- Strength/sufficiency: direct source evidence.
- Limitations: no future implementation evaluated.
- Provenance: observation above.

### EVD-WDI-003 — Existing credential path supports reuse decision

- Source observations: `OBS-WDI-004`.
- Target: `CLM-WDI-003`.
- Relation: SUPPORTS.
- Bound coordinates: Broker base plus accepted credential authority exact revision.
- Strength/sufficiency: direct source and accepted authority.
- Limitations: does not prove any production Grant exists.
- Provenance: observation above.

### EVD-WDI-004 — External proposed status supports sequencing gate

- Source observations: `OBS-WDI-005`.
- Target: `CLM-WDI-004`.
- Relation: SUPPORTS.
- Bound coordinates: exact service Spec commit/blob.
- Strength/sufficiency: sufficient to block premature implementation/activation.
- Limitations: must be refreshed after external review/acceptance.
- Provenance: observation above.

## 8. Decisions

### DEC-WDI-001 — Add one read-only Broker capability

- Decision owner: `mayf3` (direct task instruction).
- Decision: add capability/tool `workflow_domain_instances`, operation `list`, required scope
  `workflow.read`, bound only to the external service route.
- Rejected alternatives: `ALT-WDI-001`, `ALT-WDI-002`.
- Reason: restores the DOMAIN_OWNER inventory view without adding write or global authority.
- Owner decision remaining: NONE.

### DEC-WDI-002 — Keep identity and credentials entirely outside model input

- Decision owner: `mayf3` plus accepted parent authorities.
- Decision: use the existing trusted parent Broker credential path only; forbid OpenClaw fallback
  and all identity/credential override arguments.
- Rejected alternatives: `ALT-WDI-003`, `ALT-WDI-004`.
- Reason: preserves credential secrecy and actual caller binding.
- Owner decision remaining: NONE.

### DEC-WDI-003 — Preserve declared service diagnostics generically

- Decision owner: `mayf3`.
- Decision: generic HTTP transport may extract only a grammar-bounded service error code,
  sanitized message, numeric HTTP status, and validated downstream `x-request-id`; mapping exposes
  only manifest-declared codes and falls back to declared canonical transport errors.
- Rejected alternatives: `ALT-WDI-005`.
- Reason: precise operational diagnosis without raw body/header/secret leakage.
- Owner decision remaining: NONE.

## 9. Contracts

### CTR-WDI-001 — Capability identity and service binding

The Broker MUST register exactly one additive capability/tool named
`workflow_domain_instances`, with one operation `list` and required scope `workflow.read`. Trusted
manifest data MUST bind:

```text
target = svc-workflow
method = GET
path = /internal/v1/domains/{domainId}/workflow-instances
pathParams = [domainId]
query = [page, limit, lifecycle, status]
```

Model input MUST NOT control target, origin, method, route template, scope, audience, headers, or
Authorization.

### CTR-WDI-002 — Closed argument contract

The model-visible argument object MUST contain only:

```text
domainId: string UUID                              required
page: string opaque service-issued page token      optional
limit: integer 1..100                              optional
lifecycle: active | terminal | all                 optional
status: active | cancelled | archived | all        optional
```

`principalId`, `actorPrincipalId`, `assigneePrincipalId`, assignee override, arbitrary query,
credential, token, Authorization, Domain array, or any unknown property MUST fail locally with
`invalid_arguments` before token acquisition and before service HTTP. `limit < 1` or `limit > 100`
MUST fail locally as `invalid_pagination` before token acquisition and HTTP. `page` is forwarded
verbatim only when it is a bounded string; Broker MUST NOT decode, create, split, or combine it.

### CTR-WDI-003 — Broker-first caller and credential path

Execution MUST use the existing child relay -> trusted parent Broker -> credential store lookup by
actual spawned `agentId` -> client-credentials token -> svc-workflow route chain. The child/model
MUST receive no client secret, access token, credential object, credential-store path, or raw
Authorization. The capability MUST NOT read or fall back to `~/.openclaw/credentials`, Agent
workspace credentials, model arguments, child environment secrets, or self-reported Principal ids.

Credential absence/invalidity and scope denial remain distinct existing Broker/Auth failures; this
Spec creates no credential and grants no scope.

### CTR-WDI-004 — Service authorization remains authoritative

Broker validation establishes only argument shape and transport scope. It MUST NOT infer ownership
from `workflow_my_domains`, cache Domain bindings, convert Member to Owner, or bypass the service.
The authenticated downstream Principal and exact path Domain MUST be evaluated by svc-workflow
under the external service contract. Owning another Domain MUST still produce downstream HTTP 403
`not_domain_owner`.

### CTR-WDI-005 — Success projection is transparent and bounded

On HTTP 200, Broker MUST return the service-owned page JSON without adding fields or fetching
instance details. Each item is expected to contain the fields frozen by the exact external
contract, including workflow instance id, Definition id/stable display, lifecycle, current node,
current assignee, state version, cancelled, archived, and updated timestamp. Broker MUST NOT enrich
items with Context bodies, submissions, events, credentials, tokens, secrets, or data from another
Domain. An empty Domain MUST remain `ok:true` with `result.items=[]` and `next_page=null`.

### CTR-WDI-006 — Closed error envelope and fail-closed declaration

For this capability the manifest MUST declare, at minimum:

```text
invalid_arguments
invalid_pagination
principal_not_found
domain_not_found
not_domain_owner
principal_disabled
unauthenticated
forbidden
invalid_path_parameter
invalid_lifecycle
invalid_status
internal_consistency_error
service_unavailable
http_4xx
http_5xx
malformed_response
transport_failure
credential_unavailable
credential_invalid
scope_denied
```

A downstream service code is surfaced only when it matches the safe service-code grammar and is
present in this manifest's declared table. Unknown codes MUST degrade to the status-appropriate
manifest-declared `http_4xx` or `http_5xx`, never to an undeclared code. Local argument failures
MUST never be relabeled as service errors.

### CTR-WDI-007 — Preserve status and downstream request-id safely

For non-2xx service responses, the model-visible envelope MUST preserve:

```text
error.code
error.status       # exact downstream numeric HTTP status when present
error.detail       # sanitized bounded service message only
error.requestId    # exact downstream x-request-id when valid and present
```

`requestId` MUST come only from downstream `x-request-id`; Broker MUST NOT invent one. Invalid,
missing, control-character-containing, or oversized request ids MUST be omitted. Raw response
headers and raw response bodies MUST NOT cross the transport boundary. Detail MUST redact bearer,
Authorization, token, secret, password, credential, API-key, JWT, and opaque long-secret shapes
and MUST be length-bounded. Relay, mapping, output schema, and renderer MUST preserve the same safe
fields end to end.

### CTR-WDI-008 — Read-only and zero writes

The capability MUST expose GET only and MUST NOT generate an Idempotency-Key, body, transition,
instance mutation, assignment mutation, binding mutation, credential write, Grant write, or local
persistent state. Frozen outcomes:

```text
BROKER_WRITE_COUNT = 0
SERVICE_DATABASE_WRITE_COUNT = 0
WORKFLOW_STATE_CHANGE = NONE
ASSIGNMENT_CHANGE = NONE
DOMAIN_BINDING_CHANGE = NONE
```

### CTR-WDI-009 — Existing capability non-regression

`workflow_my_tasks`, `workflow_my_domains`, `workflow_instance_detail`, and
`workflow_submission_history` MUST retain tool names, operations, argument meanings, required
scopes, success payloads, and service routes. Existing seven Forum tools, OKR capabilities,
calculator fixture, generic credential path, and child relay behavior MUST remain compatible.
Generic error preservation may add safe error fields but MUST NOT leak raw bodies/secrets or change
successful output bytes.

### CTR-WDI-010 — External sequencing gate

No Broker implementation may start, merge, activate, or deploy under this Spec while its
`implementation_authority` is `none`. A later implementation-authorizing revision additionally
MUST pin:

1. an accepted `SVC_WORKFLOW_DOMAIN_OWNER_INSTANCE_LIST_V1` revision;
2. a svc-workflow implementation revision conforming to that exact accepted service contract;
3. an accepted local Broker Spec revision present in the implementation base.

A changed external route, field, pagination, error, or authorization contract requires this local
Spec pin and affected Contracts to be independently reviewed again.

### CTR-WDI-011 — Exact implementation closure

A future implementation is limited to exactly these paths; any expansion requires a separately
reviewed Spec revision before implementation:

```text
packages/broker/src/capabilities/workflow.js
packages/broker/src/transport.js
packages/broker/src/mapping.js
packages/broker/src/schema.js
packages/broker/src/registry.js
packages/broker/src/relay.js
packages/broker/test/capabilities.test.js
packages/broker/test/transport.test.js
packages/broker/test/relay.test.js
```

```text
NEW_TOOL_COUNT = 1
NEW_SERVER_ROUTE_COUNT = 0
CREDENTIAL_STORE_CHANGE = NONE
GRANT_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

Acceptance while `implementation_authority: none` remains unchanged does not authorize edits to
this closure.

## 10. Acceptance

### ACC-WDI-001 — Manifest shape and owner success

- Contracts: `CTR-WDI-001`, `CTR-WDI-002`, `CTR-WDI-005`.
- Method: build/register the manifest and execute against a mock conforming service as an enabled
  owner.
- Expected result: correct GET route/query, `workflow.read`, 200 page, required summary fields, and
  empty Domain preservation.
- Failure condition: wrong route/scope, missing field, enrichment, or incorrect empty result.

### ACC-WDI-002 — Owner-other-Domain and Member denial

- Contracts: `CTR-WDI-004`, `CTR-WDI-006`, `CTR-WDI-007`.
- Method: mock exact 403 `not_domain_owner` responses for (a) owner of another Domain and (b)
  DOMAIN_MEMBER, each with a distinct request-id.
- Expected result: model envelope preserves `not_domain_owner`, status 403, sanitized detail, and
  exact downstream request-id.
- Failure condition: success, camouflage code, generic flattening, or lost/fabricated request-id.

### ACC-WDI-003 — Missing Domain and Principal

- Contracts: `CTR-WDI-006`, `CTR-WDI-007`.
- Method: mock exact 404 `domain_not_found` and 404 `principal_not_found` responses.
- Expected result: each code, 404 status, and request-id remain distinct end to end.
- Failure condition: code collision or `http_4xx` flattening of a declared service code.

### ACC-WDI-004 — Closed arguments and pagination boundaries

- Contracts: `CTR-WDI-002`.
- Method: test limits 1/100, 0/101, valid/invalid enum values, opaque page forwarding, and every
  forbidden identity/assignee/unknown property; count token and service HTTP calls.
- Expected result: boundaries pass; invalid limit is local `invalid_pagination`; forbidden/unknown
  arguments are local `invalid_arguments`; rejected cases make zero token and service calls.
- Failure condition: any forbidden field ignored/forwarded, unsafe limit, or rejected-call I/O.

### ACC-WDI-005 — Credential and secret boundary

- Contracts: `CTR-WDI-003`, `CTR-WDI-007`.
- Method: child relay plus trusted parent test with canary secrets in credential, downstream raw
  body, headers, and message.
- Expected result: only trusted parent reads the configured Broker credential; no OpenClaw path is
  touched; model/RPC/output contains no canary, raw Authorization, token, secret, or raw body.
- Failure condition: fallback read, child-held credential, or sensitive output.

### ACC-WDI-006 — Required page fields and zero writes

- Contracts: `CTR-WDI-005`, `CTR-WDI-008`.
- Method: successful mixed-state page fixture with state_version/cancelled/archived; instrument
  Broker persistence and mock service method/body.
- Expected result: all required fields pass transparently; method is GET, body absent, and every
  write counter is zero.
- Failure condition: missing state fields, POST/body, or any durable write.

### ACC-WDI-007 — Existing Workflow and Broker non-regression

- Contracts: `CTR-WDI-009`, `CTR-WDI-011`.
- Method: run complete Broker tests plus focused assertions for `workflow_my_tasks` and
  `workflow_my_domains`; compare success render bytes; inspect changed path closure.
- Expected result: all tests pass, existing routes/scopes/success bytes are unchanged, and diff is
  contained in the exact closure.
- Failure condition: regression, secret/raw-body leak, or closure expansion.

### ACC-WDI-008 — External sequencing and docs-only authoring gate

- Contracts: `CTR-WDI-010`, `CTR-WDI-011`.
- Method: inspect exact local/external Spec lifecycle, implementation base, Git diff, and runtime
  actions for this authoring PR.
- Expected result: proposed Specs have `implementation_authority:none`; only this docs file changes
  locally; no code, credential, Grant, DB, deploy, restart, Forum post, or runtime probe occurs.
- Failure condition: premature implementation/action or stale external authority pin.

### Contract coverage

| Contract | Acceptance | Evidence class | Covered |
|---|---|---|---|
| `CTR-WDI-001` | `ACC-WDI-001` | manifest/integration | YES |
| `CTR-WDI-002` | `ACC-WDI-004` | validation/I/O counters | YES |
| `CTR-WDI-003` | `ACC-WDI-005` | relay/credential security | YES |
| `CTR-WDI-004` | `ACC-WDI-002` | authorization integration | YES |
| `CTR-WDI-005` | `ACC-WDI-001`, `ACC-WDI-006` | projection/empty/fields | YES |
| `CTR-WDI-006` | `ACC-WDI-002`, `ACC-WDI-003` | error mapping | YES |
| `CTR-WDI-007` | `ACC-WDI-002`, `ACC-WDI-003`, `ACC-WDI-005` | request-id/redaction | YES |
| `CTR-WDI-008` | `ACC-WDI-006` | zero-write instrumentation | YES |
| `CTR-WDI-009` | `ACC-WDI-007` | regression | YES |
| `CTR-WDI-010` | `ACC-WDI-008` | authority/lifecycle inspection | YES |
| `CTR-WDI-011` | `ACC-WDI-007`, `ACC-WDI-008` | diff closure | YES |

## 11. Alternatives and disposition

### ALT-WDI-001 — Reuse `workflow_instance_detail` with a Domain id

- Disposition: rejected.
- Reason: it accepts an instance UUID and is not a Domain-list operation.
- Evidence/Claims considered: `OBS-WDI-002`.
- What would reopen: never within V1; a separate service/tool contract would be required.

### ALT-WDI-002 — Infer Domain inventory from `workflow_my_tasks`

- Disposition: rejected.
- Reason: assigned work is not the Domain's complete instance inventory.
- Evidence/Claims considered: `OBS-WDI-001`, direct Goal.
- What would reopen: none; semantics are distinct.

### ALT-WDI-003 — Accept `principalId` or assignee override

- Disposition: rejected.
- Reason: enables identity substitution or changes query scope.
- Evidence/Claims considered: `CLM-WDI-003`, external service contract.
- What would reopen: separate accepted delegation authority.

### ALT-WDI-004 — Read `~/.openclaw/credentials`

- Disposition: rejected.
- Reason: violates accepted Broker credential ownership and child secret boundary.
- Evidence/Claims considered: `OBS-WDI-004`, accepted parent authorities.
- What would reopen: only a whole-authority successor; not this capability.

### ALT-WDI-005 — Return raw downstream body or flatten all errors

- Disposition: rejected.
- Reason: raw body can leak secrets; flattening loses required diagnosis and request correlation.
- Evidence/Claims considered: `OBS-WDI-003`, direct error contract.
- What would reopen: no V1 reopening; changed envelope requires a successor Spec.

## 12. Migration, compatibility, and rollback

```text
MIGRATION = NONE
COMPATIBILITY = one additive tool; existing successful tool behavior unchanged
ROLLBACK = unregister the additive manifest and revert bounded generic envelope support only under
           a separately authorized implementation rollback
EMERGENCY_CONTAINMENT = stop/disable the capability under incident authority; no credential copy
SERVICE_CODE_CHANGE = NONE IN THIS REPOSITORY
BROKER_CODE_CHANGE = NONE IN THIS AUTHORING ROUND
DATABASE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
READY_TO_MARK_ACCEPTED = NO
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 接入 审计
```
