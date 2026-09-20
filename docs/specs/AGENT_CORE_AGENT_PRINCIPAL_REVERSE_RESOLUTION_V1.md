---
spec_id: AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1
status: accepted
accepted_date: 2026-09-21
accepted_by: mayf3
accepted_reviewed_spec_commit: da38d7d
acceptance_review_verdict: PASS
acceptance_review: independent two-round semantic review (round-1 head 1a8e6fa = ACCEPT / 0 blockers / 5 non-blocking; the one recommended hardening — principalStatus value domain in CTR-APR-003 item 5 — applied as round-2 head da38d7d and re-confirmed ACCEPT / 0 blockers; reviewer = independent Agent not authoring the change, SPEC_GOVERNANCE_MODE=REVIEW)
acceptance_authority_basis: >-
  Owner exact-head acceptance via GOAL AGENT_PRINCIPAL_REVERSE_LOOKUP_DELIVERY_V1
  (OWNER_DECISION APPROVE_NARROW_REVERSE_READ_PATH, 2026-09-21) — persistent Owner
  authorization. Auth upstream verified accepted-in-main during review:
  AUTH_SERVICE_IDENTITY_DIRECTORY_REVERSE_RESOLUTION_V1 accepted at auth main
  862eab3 (reviewed head cf9b474, impl b1aa0ae ACCEPT/0 blockers); live Auth
  route deployment remains a separately authorized controlled operation with its
  packet at
  /Users/yanfenma/workspace/deployment-artifacts/auth-service-idr-reverse-resolution-v1-deploy/.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - mayf3/dsh-agent-core
  - exact Agent ID → Principal UUID reverse read capability (model-facing, read-only)
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_IDENTITY_DIRECTORY_REVERSE_RESOLUTION_V1
    revision: cf9b474ac76cb189e5cac20554bb31b09b5e82db
    relation: depends_on
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1
    revision: f2b7d4c91ad657464816108062145ae95c21d686
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1

## 1. Goal, mandate and route

Given one exact Agent ID, a model resolves the exact stored Auth Agent Principal
UUID through the Auth identity-directory reverse read, so a consumer can hand the
UUID verbatim to Workflow without ever guessing, storing, or embedding one.

```text
MASTER_GOAL = AGENT_PRINCIPAL_REVERSE_LOOKUP_DELIVERY_V1
BASE = f7bb435 (dsh-agent-core main)
AUTHORITY_ACTION = NEW
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
IMPLEMENTATION_ALLOWED_NOW = NO
PRODUCTION_APPLY_ALLOWED_NOW = NO
TOOL_NAME = agent_resolve_principal_by_agent
```

Owner direction 2026-09-21 (`APPROVE_NARROW_REVERSE_READ_PATH`): target boundary
`identity-directory` × `auth.directory.read`; NO new identity registry, NO new
scope, NO new audience, provisioning scope FORBIDDEN for model reads; the tool is
named `agent_resolve_principal_by_agent` — a strict-canonical-lifecycle claim is
FORBIDDEN until the canonical lifecycle is production-effective.

The upstream Auth dependency is accepted in auth main 862eab3 (spec reviewed head
cf9b474; route implemented and independently reviewed ACCEPT/0 blockers at
b1aa0ae; production deployment is a separately authorized controlled operation
with its packet prepared). Implementation here must preserve the pinned Auth
revision semantics; semantic movement upstream requires re-preflight.

## 2. Ownership, scope and non-goals

Auth is the sole Principal-mapping authority; this Spec adds ONE broker-local
read-only capability that consumes the Auth identity-directory reverse route. It
does not dispatch work, send messages, mutate Sessions, resolve humans, or touch
the forward sibling `agent_resolve_principal` (UUID → agentId), whose live
deployment debt remains OUT OF SCOPE per the Owner's mandate.

The capability is the reverse-direction sibling of
AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1/V2 and mirrors its trusted-seam
design: caller identity, token acquisition, Auth origin, and Agent Definition
validation are ALL runtime-derived — never tool arguments.

Non-goals: no display-name or fuzzy resolution (that is `agent_directory`'s
resolve/list over the local Agent Definition registry, upstream of this tool);
no external_ref handling; no canonical lifecycle claims; no caching of
resolutions; no retry of the Auth read.

## 3. Contracts

### CTR-APR-001 — Model-facing surface

One LOCAL capability, one READ-ONLY operation `resolve`:

```json
{ "agentId": "agt_travel-planner-agent" }
```

The manifest declares: `id = 'agent_resolve_principal_by_agent'`,
`toolName = 'agent_resolve_principal_by_agent'`, `local.resource =
'identity-directory'` (the auth-service audience), `requiredScopes =
['auth.directory.read']`, and the closed error table of CTR-APR-004. The
model-visible argument schema accepts EXACTLY one property `agentId` (string,
the CTR-APR-002 grammar), `additionalProperties: false`. The tool description
MUST instruct the model: when downstream Workflow needs a Principal UUID and only
an Agent name or Agent ID is known, first resolve the exact agentId through
`agent_directory`, then call this tool; never guess or embed a UUID.

No URL, audience, scope, credential, token, external_ref, or principal-override
argument exists; anything beyond the single `agentId` is `invalid_arguments`.

### CTR-APR-002 — Exact input grammar

The exact Agent ID grammar is the accepted stored-id grammar `^agt_[a-z0-9-]+$`
with length 5..128 — the same grammar the Auth reverse route enforces
(CTR-IDR-003). No trimming, no case rewriting, no substring or prefix semantics.
Violations are rejected by the trusted handler before any token acquisition or
transport (`invalid_arguments`), mirroring the forward sibling's first-action
validation.

### CTR-APR-003 — Trusted seam and composition

Trusted seam (mirrors the forward sibling, CTR-EPAR-001..005):

1. Caller identity = the gateway-frozen ACTUAL caller (`context.callerAgentId`);
   the `agentId` argument names the TARGET to resolve and NEVER selects caller
   credentials, source identity, or any authorization input.
2. Token = acquired by the runtime for the ACTUAL caller through the injected
   `acquireCallerToken` seam with EXACTLY `resource: 'identity-directory'`,
   `scope: 'auth.directory.read'`; the token stays in the trusted parent
   transport and never reaches the model.
3. Auth origin = the fixed configured auth-service origin
   (`brokerAuthServiceOrigin`); never a tool argument; unconfigured origin =
   `transport_failure`, fail-closed per call.
4. ONE fixed-path Auth read:
   `GET {origin}/api/v1/directory/agents/{agentId}/principal`, one attempt, no
   retry, bounded deadline ≤ 5000 ms, `redirect: 'error'`.
5. Response validation: HTTP 200 requires a JSON object with EXACTLY the keys
   `principalId`, `agentId`, `principalStatus`; `principalId` must be a
   canonical UUID; `agentId` must exactly equal the requested agentId (byte
   equality — the Auth exact-equality proof is re-verified client-side);
   `principalStatus` must be `active` or `disabled` (the CTR-IDR-003 value
   domain); anything else is `identity_resolution_unavailable`. No success is
   ever fabricated from a partial or malformed response.
6. Composition with the local Agent Definition registry (deliverability, same
   closed pattern as the forward sibling's CTR-EPAR-003): after a valid Auth
   answer, one synchronous exact `definition.getAgent(agentId)` must succeed and
   the record must not be `disabled === true`; failure = `target_not_found`,
   disabled = `target_disabled`, identity drift = `identity_resolution_unavailable`.
   A public Auth answer alone NEVER succeeds.
7. Disabled TARGET classification: the Auth identity-directory family returns a
   disabled target as 200 directory data (`principalStatus: 'disabled'`). This
   tool classifies that outcome as the error `principal_disabled` — matching the
   forward sibling's closed error family — so a model can never route a disabled
   Agent's Principal UUID downstream.

Closed behavior: read-only (no Session mutation, no Workflow transition, no
scheduler job, no message send, no registry change); no cache — every call
freshly reads Auth and the Definition registry.

### CTR-APR-004 — Closed error taxonomy

```text
invalid_arguments                  input is not exactly {agentId} or violates the CTR-APR-002 grammar
credential_unavailable             no trusted caller credential is bound
credential_invalid                 the trusted caller credential was rejected by auth-service
access_denied                      the caller lacks auth.directory.read on the auth-service side
agent_not_found                    no Principal exists for the exact agentId (auth 404 AGENT_NOT_FOUND)
principal_not_agent                the relation row is not an AGENT Principal (auth 422)
principal_disabled                 the AGENT Principal exists but is disabled (auth 200 principalStatus=disabled)
identity_resolution_ambiguous      the exact agentId relation is ambiguous (auth 409)
identity_resolution_unavailable    the Auth read failed, timed out, or returned a malformed/mismatched body; nothing is retried or fabricated
target_not_found                   no Agent Definition exists for the resolved exact agentId
target_disabled                    the resolved Agent Definition exists but is disabled
transport_failure                  the auth-service/broker transport failed before the Auth read could be classified
unsupported_operation              the execute-time local handler is not resolvable (missing or miswired provider)
internal_error                     the trusted handler failed before producing a resolution outcome
```

Success envelope (broker standard): `{ ok: true, result: { agentId, principalId } }`
— exactly two fields; `principalId` is the exact stored Auth Agent Principal
UUID. No `principalStatus` on success (a disabled target never succeeds — see
CTR-APR-003 item 7). Failure envelope: `{ ok: false, error: { code, detail } }`.

### CTR-APR-005 — Implementation closure

Exact changed-file set (bounded; no other file may change):

| File | Change |
|---|---|
| `docs/specs/AGENT_CORE_AGENT_PRINCIPAL_REVERSE_RESOLUTION_V1.md` | this Spec |
| `docs/specs/README.md` | one index row (carried by the acceptance docs-only change) |
| `packages/broker/src/capabilities/agent-principal-reverse-resolution.js` | new pure-data manifest (shape of the forward sibling's manifest) |
| `packages/broker/src/capabilities/manifests.js` | CLOSURE-CORRECTION-APR-001 (bounded): one additive re-export line — the plugin entry imports ONE manifest surface through this pure re-export hub (CODE_STRUCTURE_GUARDRAILS_V1 barrel limit), so a new capability family appends exactly one line here per the hub's own header contract |
| `packages/broker/src/index.js` | additive: import + append to `DEFAULT_MANIFESTS` |
| `packages/production-runtime/src/identity/agent-principal-reverse-resolution.js` | new trusted provider (shape of the forward sibling's provider) |
| `packages/production-runtime/src/compose.js` | additive: one `ctx.provide('agentPrincipalReverseResolutionAccess', …)` wiring with the identity-directory token seam |
| `packages/broker/test/agent-principal-reverse-resolution.test.js` | new manifest/structural tests |
| `packages/production-runtime/test/identity/agent-principal-reverse-resolution.test.js` | new provider unit tests under the family's `identity/` test directory, mirroring the forward sibling's layout (synthetic fixtures; production canary Principal UUIDs FORBIDDEN as constants) |

CLOSURE-CORRECTION-APR-001 (2026-09-21, mechanical): discovered during
implementation — the broker plugin imports manifests exclusively through the
pure re-export hub `packages/broker/src/capabilities/manifests.js` (its header
contract: "New capability families append exactly one line here plus the
DEFAULT_MANIFESTS entry"). This correction adds that one-line re-export to the
closure; no semantic delta.

No change to the forward sibling's manifest/provider/tests, no registry or
grant-supply change, no Agent Definition change. Production deployment proceeds
only through the existing Production Deployment Control Plane for the fleet
runtime; source merge alone never implies production readiness
(`FORWARD_TOOL_DEPLOYMENT_REPAIR = OUT_OF_SCOPE` per the Owner mandate; it is not
a mechanical prerequisite of this capability because this capability declares its
own manifest and handler).

### CTR-APR-006 — Acceptance boundary

| Acceptance | Contracts | Method | Expected |
|---|---|---|---|
| ACC-APR-001 | 001/002 | manifest structural tests | tool registered in DEFAULT_MANIFESTS; argument schema exactly {agentId}; error table exact; description carries the agent_directory-first guidance |
| ACC-APR-002 | 003/004 | provider unit tests over injected fetch/token/definition seams | success `{agentId, principalId}`; every error branch of the taxonomy reachable and mapped; agentId equality re-verified; disabled→`principal_disabled`; deadline ≤5s, one attempt; zero writes; token never exposed |
| ACC-APR-003 | 003 | composed E2E with real Auth (production or production-equivalent) for the two canary agentIds | UUID comes ONLY from the Auth route response; no UUID preseeded in prompt/fixture (`TARGET_UUID_PRESEEDED = NO`); `UUID_GUESSED = NO` |
| ACC-APR-004 | 005 | exact diff vs frozen closure | bounded file set; sibling surfaces untouched |
| ACC-APR-005 | all | production deployment readback through the control plane | model-facing tool live; E2E-1/E2E-2 pass against production Auth |

## 4. Alternatives

Rejected: reusing `agent_resolve_principal` (opposite direction); a raw Auth HTTP
tool with caller-supplied URL/scope (unbounded surface); resolving through the
svc-workflow principals projection (not the identity authority); a
`agent_resolve_canonical_principal` name or any canonical-lifecycle claim
(Owner semantic correction — strict canonical foundation is not
production-effective); provisioning-scope credentials (Owner forbidden);
UUID-in-prompt or preseeded-UUID test designs (forbidden).

STATUS=accepted (2026-09-21; reviewed head da38d7d; independent review
ACCEPT/0 blockers). Implementation proceeds under
`implementation_authority: contracts` within CTR-APR-001..005 only; production
deployment of the fleet runtime remains a separately authorized controlled
operation through the existing Production Deployment Control Plane.
