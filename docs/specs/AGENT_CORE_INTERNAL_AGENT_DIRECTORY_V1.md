---
spec_id: AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - mayf3/dsh-agent-core
  - generic authenticated internal exact Agent directory read (exists/enabled)
governed_by: [AGENT_CORE_PRODUCT_ARCHITECTURE_V1]
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
    revision: e8ae1949ef330bd44b0e0d185053b39e18cab3f3
    relation: depends_on
supersedes:
  - AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1

## Goal, authority and evidence

Expose the authoritative canonical Agent existence/enabled check as a minimal internal
directory read available to ANY authenticated canonical internal Agent or SERVICE caller,
so no consumer needs a dedicated per-purpose lookup identity. Agent Core remains
authoritative for canonical Agent Definition existence/enabled truth; this changes WHO
may perform the safe read, not HOW status is observed.

Owner direction 2026-09-06 (WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1,
CONTINUE_SAME_GOAL): canonical identity lookup is foundational internal directory
information; the previously accepted dedicated-caller model
(AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1 @ bc88cc81, caller pinned to the single
SERVICE principal cedb954a-3d99-4e5a-b568-d312441bcc56 / client
svc-workflow-canonical-admission-v1, audience workflow-agent-admission, scope
agent.definition.admission.read, 5-second token age) is SUPERSEDED_DIRECTION_PENDING.
Nothing is deleted; the branch-local implementation (dda69b5, unmerged) is reused.

DEVELOPMENT_PREFLIGHT: AUTHORITY_ACTION=SUPERSEDE (read-authorization model changed by
Owner direction; observation semantics unchanged); PLAN_LEVEL=EXEC_PLAN;
ASSURANCE_LEVEL=CONTROLLED; DOCS_FIRST_REQUIRED=YES. Base: current main 4b8726b plus
branch-local head dda69b5. Mechanical reconciliation evidence:
docs/investigations/INTERNAL_IDENTITY_DIRECTORY_RECONCILIATION_V1.md in mayf3/svc-workflow
(disposition CASE C: at base, /v1/agents is unauthenticated and strips the disabled flag;
/scheduler/* serves run history under a different accepted authority; the LOCAL broker
resolver inherits the auth-side agent-only/HR-grant chain; no generic internal read
existed).

## Contracts

### CTR-IAD-001 — Exact directory surface

GET /v1/directory/agents/:agentId accepts one exact ID, no body/query/list. After caller
authentication, validate existing accepted canonical Agent ID syntax preserving exact
bytes; reject malformed/legacy/prefix-normalized/name input with 400 INVALID_AGENT_ID;
never return a guessed or substituted ID. Mount only on the reviewed production runtime
server; loopback placement alone is not authentication; no browser CORS credential
access; the mobile /v1/agents projection is not altered and remains unauthenticated
presentation data.

### CTR-IAD-002 — Generic internal caller authorization

Require the existing Auth V1 RS256 issuer/JWKS/time/token_use direct-machine profile
(scheduler-auth verifier), exact single audience `agent-directory`, scope
`agent.directory.read`, caller principal_type agent or service, with the verifier's
existing time policy (the superseded 5-second issued-at pin is retired; consumers bound
their own per-command freshness where their owning contracts require it). Expired/
invalid/signature/issuer/audience/profile errors return 401 UNAUTHORIZED; an otherwise
valid caller missing the required scope returns 403 ACCESS_DENIED before the target
read. Offline JWKS verification retains the bounded revocation race already accepted for
the scheduler surfaces; no Workflow-audience token, human token, provisioning identity,
source IP or display-name allowlist satisfies this route.

### CTR-IAD-003 — Authoritative exact Agent observation

Read the production runtime's authoritative Agent Definition snapshot synchronously and
coherently; require exactly one exact ID with valid canonical syntax. Duplicate/corrupt
snapshot=409 AGENT_DEFINITION_AMBIGUOUS; unknown storage/definition error=500
AGENT_DEFINITION_QUERY_FAILED; 1-second operation deadline=504
AGENT_DEFINITION_TIMEOUT with late results never becoming success. Success returns
exactly {agentId, exists, enabled} where exists reflects snapshot presence and enabled
reflects disabled != true; a missing exact ID returns 200 with {agentId, exists:false,
enabled:false} (existence is the authorized minimal datum; no error-shape guessing), and
a disabled Agent returns {agentId, exists:true, enabled:false}. The superseded
observationDigest field is dropped. No name/workspace/credential/config/session data is
disclosed. Cache-Control: no-store; no automatic retry; no positive result cache across
commands; this route verifies Agent status only and never proves an Auth Principal
relation.

### CTR-IAD-004 — Zero side effects and bounded integration

No Agent/session/wake/send/scheduler/definition mutation, credential issuance, identity
rewrite or business transition occurs. The bounded adaptation of the branch-local
implementation is: route prefix rename to /v1/directory/agents, caller-predicate
generalization (audience/scope per CTR-IAD-002, accept agent and service principals,
drop the pinned constants and the 5-second iat check), response reshaped to
{agentId, exists, enabled} with missing-ID converted from 404 to 200 exists:false, and
matching test updates. Freeze exact file closure; comply with structure guardrails; no
new generic registry/identity framework; the Auth directory grant registrations are not
supply authority in this repository.

### CTR-IAD-005 — Consumer, release and rollback conditions

Consumers (Workflow admission, HR, Scheduler, Forum, other canonical callers) must
authorize their own business actor separately, obtain fresh observations for every
affected identity within their own command window, and commit only on exists==true &&
enabled==true where their owning contract so requires. Deployment requires accepted
owning heads, exact implementation review/tests, target/preimage proof, shared mutation
slot IDLE, health and durable receipt/readback; deploy a bounded reviewed artifact, not
whole latest main. Failure withdraws this route; never enable invalid assignments as a
fallback. Existing LOCAL Broker resolver/HR dispatch remain governed by their accepted
authority.

### CTR-IAD-006 — Acceptance boundary

| Acceptance | Contracts | Method/environment/evidence | Expected / failure |
|---|---|---|---|
| ACC-IAD-001 |001| exact HTTP route fixtures at implementation head | malformed/query/body/list/legacy/name inputs deny; no unintended exposure |
| ACC-IAD-002 |002| real signed V1 fixtures for agent AND service callers plus verifier failure injection | both caller types succeed; human/wrong-audience/wrong-scope/expired deny before target read |
| ACC-IAD-003 |003| authoritative snapshot fixtures + concurrent disable/timeout tests | exists/enabled discriminate missing/disabled/enabled; no stale cache; late result denied |
| ACC-IAD-004 |004| diff/structure gate/write spies/secret sentinels | closed file set; zero side effects/disclosure; digest absent |
| ACC-IAD-005 |005| consumer integration at pinned accepted owning heads | Workflow admission fail-closed intact; varied internal callers resolve; no premature Goal completion |

## Status and alternatives

Rejected: keeping the dedicated single-caller admission route (Owner-superseded);
authenticating the mobile /v1/agents projection (changes its accepted Gate-1 contract);
local registry copies; a new generic identity service; fuzzy/display-name lookup;
anonymous existence probing. Acceptance obligation: the acceptance transaction must atomically flip the predecessor
AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1 to superseded_by this Spec's accepted head in
the same docs-only change, and pin this Spec's exact reviewed head into any consuming
authority's external_authorities revision field.

STATUS=proposed; IMPLEMENTATION_ALLOWED_NOW=NO;
PRODUCTION_READY=NO. Requires independent semantic review and exact-head Owner
acceptance before implementation continues under it. The superseded parent's pinned
caller objects and audience workflow-agent-admission are retired by this document.
