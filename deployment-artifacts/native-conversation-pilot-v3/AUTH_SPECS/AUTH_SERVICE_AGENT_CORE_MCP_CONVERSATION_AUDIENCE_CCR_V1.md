---
spec_id: AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/auth-service
  - one SERVICE-only agent-core-mcp-conversation-v1 audience registration
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
external_authorities:
  - repository: mayf3/dsh-agent-core
    authority_id: DSH_MCP_NATIVE_CONVERSATION_V1
    revision: 44da63d21987bf7115435f0767e7851b9022836a
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1

## 1. Goal

Register exactly one Auth SERVICE audience and opaque scope for the existing
dot-read-mcp → original DSH Product Surface conversation facade. This proposed
owning CCR replaces the application-only draft as the review target; it does
not accept itself, implement its Contracts, alter the frozen Bundle or apply
any production effect. `implementation_authority: contracts` specifies only
the bounded source authority intended **after exact Owner acceptance and merge
into main**. The v2 external draft remains unchanged and non-authoritative.

## 2. Scope and non-goals

Scope is the exact registration, compatible SERVICE client_credentials profile,
append-only version linkage, isolated conformance and generated runtime output.
The future source closure is fixed by CTR-MCC-004.

No Principal/Client/credential/Grant creation, DB reconciliation, identity
attestation operation, TLS/CA/ACL/plist change, load/restart, Binding change or
business send is authorized. No Workflow/history/events, Human/delegation,
website transport, Notification or Agent-caller permission is added. Production
supply/reconciliation needs its own accepted bounded implementation authority
and separately attributable operation mandate; it is not hidden in this CCR.

## 3. Authority and dependencies

The accepted MINIMAL_AUTH_FOUNDATION_V2 incorporates the historical V1 profile,
scope, Grant and freeze laws; its architecture alone does not register this
new resource. Active local governance requires docs-first NEW + CONTROLLED.
No accepted child at the bound base covers this audience. Accepted Notification
and website SERVICE CCRs are compatible examples, not MCP permission.

External DSH r3 CTR-NC-001/002/009 owns the dedicated Basic credential's online
HTTPS check, server-owned connector/client/product mapping, single target,
original Router and separate activation. Its source authority does not create
Auth registration/DB/supply authority. This CCR reciprocates only the exact
Auth audience/profile; it does not accept or amend another repository's Spec.

## 4. Current State

STATE-MCC-001: Auth source base/main is
`57f459804df1b6526a164016ea3aefa12836286d`, tree
`28a7051ad5bd60332f75d04f13140190feb4ae18`, observed 2026-10-16 in an
isolated authoring worktree. Source registry/manifest are 1.12.0, frozen,
with 12 entries and no MCP entry. Registry SHA256 is
`4cbb725bb56f1fd817e8bb2a3fd7b91d1211b5be7e7fd38654947de6a98e86e4`;
manifest SHA256 is
`b2097f32becd48e740054018719abc18c1229aeae4d58813de8fc990c7f10c27`.
This is source evidence, not current production issuance or loaded-memory proof.

## 5. Observations

- OBS-MCC-001: `src/lib/oauth/v1/direct.ts` resolves the requested audience
  from the generated runtime before Client/Grant authorization. An unregistered
  resource cannot be enabled by adding only DB/client/grant rows.
- OBS-MCC-002: `src/lib/oauth/v1/contract.ts:verifyRuntimeSnapshot` supports
  source versions through 1.12.0 and requires a frozen, implementation-authorized
  manifest; `scripts/prepare-minimal-auth-v1.mjs` derives the runtime from the
  entire validated source Bundle. No generator is run or changed by this PR.
- OBS-MCC-003: accepted website CCR CTR-WIAC-004 at this base reserves a
  source candidate 1.13.0 and requires sibling-reservation checks. It has not
  changed the current source Bundle. MCP must not overwrite that reservation
  or implement the website's two entries as a side effect.
- OBS-MCC-004: generic Client creation initializes legacy allowedResources/
  allowedScopes empty; V1 direct authorization uses MachineAccessGrant.
  Existing machine-admin is an Agent-oriented secret-printing tool, not this
  pilot's secure SERVICE supply/delivery vehicle.
- OBS-MCC-005: canonical enrollment source binding is temporary migration
  evidence; its business_subject_id is not an authentication subject and its
  record must not become a permanent runtime authentication/routing lookup.

## 6. Claims and assumptions

CLM-MCC-001 SUPPORTED: the new entry fits the unchanged generic SERVICE direct
profile and requires registration/version/fixture work, not new token semantics.
CLM-MCC-002 SUPPORTED: no current accepted sibling authorizes this registration
or this caller's supply. CLM-MCC-003 OPEN_ASSUMPTION: source version 1.14.0 is
still free at future implementation; acceptance is not a global version lease.

## 7. Evidence relations

EVD-MCC-001: OBS-MCC-001/002 support CLM-MCC-001 at the exact bound source,
sufficient for this docs-first source closure; no issuance/conformance PASS.
EVD-MCC-002: OBS-MCC-003 plus the accepted child inventory support CLM-MCC-002
and the 1.14.0 proposal, not a deployed version. EVD-MCC-003: OBS-MCC-004/005
constrain CTR-MCC-006; unsafe first-secret output or migration-lineage reuse
cannot close a live connector mapping. Reports/inputs are evidence only.

## 8. Decisions

- DEC-MCC-001: one exact SERVICE-only resource/scope; existing direct protocol.
- DEC-MCC-002: one additive source registration; propose 1.14.0 to preserve the
  accepted website's 1.13.0 reservation, without depending on website rollout.
- DEC-MCC-003: registration, registry/supply machinery, production effects and
  actual DSH/dot business acceptance remain separate authority/evidence gates.

## 9. Contracts

### CTR-MCC-001 — Exact registration

The single added entry MUST equal:

```json
{
  "audience_id": "agent-core-mcp-conversation-v1",
  "resource_service": "agent-core-mcp-conversation-v1",
  "scope_namespace": "conversation",
  "accepted_principal_types": ["service"],
  "human_access_enabled": false,
  "machine_access_enabled": true,
  "delegated_access_enabled": false,
  "registered_scopes": ["conversation.access"],
  "status": "active",
  "freeze_ready": true,
  "notes": "Registered by AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1 for one dedicated MCP SERVICE caller to the original DSH native conversation facade; no Human, Agent or delegated access."
}
```

### CTR-MCC-002 — Existing direct protocol and profile

Reuse HTTPS POST `/oauth/token`, Basic client_secret authentication, exact form
`grant_type=client_credentials&resource=agent-core-mcp-conversation-v1&scope=conversation.access`.
Auth checks the active SERVICE Principal, dedicated Client, exact audience and
same-audience active MachineAccessGrant, using existing issuer/RS256/JWKS/TTL/
time/jti/error rules. Existing SERVICE tokens have no agent_id, Human identity,
refresh token or delegated authority. Preserve no-store and Pragma:no-cache.
No new verifier, shared-secret-only bypass or token profile is introduced.

### CTR-MCC-003 — Scope isolation and owner boundaries

Only fully registered and granted requested scope sets issue. Wrong audience,
Agent/Human/delegated profile, wildcard/prefix/alias, duplicate/extra/ungranted
scope, revoked/disabled/missing Client/Principal/Grant or registry mismatch
MUST use existing fail-closed errors, never trim to partial success. The scope
is opaque to Auth and does not establish target/Binding/Workflow/history ACL.
DSH separately enforces one client, subject/scope/product mapping, BIP target
and resolve/send/result/own-result. Website/Notification/Workflow/Agent
credentials and Grants MUST NOT satisfy this resource.

### CTR-MCC-004 — Version, immutability and bounded source closure

At the bound base propose source Bundle/registry **1.12.0 → 1.14.0**; 1.13.0
is the accepted website reservation. Fresh-read source and accepted sibling
reservations before implementation. If website source merges first, preserve
its new entries and re-pin/review that exact implementation Base; do not revert
them. If 1.14.0 is occupied, select the next free minor in a newly pinned,
independently reviewed source plan without changing the entry's semantics.
Website implementation/production is not an MCP prerequisite.

Preserve every pre-existing audience's complete projection, ordering and
profile/scope/Grant/error semantics. Append only CTR-MCC-001. Coherently update
version/digest/freeze/fixture declarations, keep the actual freeze law, add
only the resolved version to the existing runtime compatibility list and
derive the runtime using the existing validated generator. Source version and
generated digest are not production/readiness claims.

Only these 15 source paths are authorized after this Spec is accepted in Base:

```text
contract-bundles/minimal-auth-v1/audience-registry.json
contract-bundles/minimal-auth-v1/contract-manifest.json
contract-bundles/minimal-auth-v1/schemas/contract-manifest.schema.json
contract-bundles/minimal-auth-v1/fixtures/positive-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/negative-token-fixtures.json
contract-bundles/minimal-auth-v1/fixtures/schema-instances.json
contract-bundles/minimal-auth-v1/metadata/freeze-gates.json
contract-bundles/minimal-auth-v1/metadata/consumer-verification-matrix.json
contract-bundles/minimal-auth-v1/metadata/adc-v2-scope-map.json
contract-bundles/minimal-auth-v1/metadata/llm-todo-authorization-candidate.json
contract-bundles/minimal-auth-v1/metadata/change-log.md
contract-bundles/minimal-auth-v1/validate.mjs
src/lib/oauth/v1/contract.ts
tests/oauth/agent-session-inspection-audience-v2.test.ts
tests/oauth/mcp-conversation-audience-v1.test.ts
```

Generated `generated/minimal-auth-v1/runtime-contract.json` is a derived build
artifact with its own hash, not permission to hand-edit a runtime or its flags.
The old session-inspection test permits version-label updates only, preserving
all existing behavior assertions. Existing stale 1.8.0 runtime/candidate tests
and helpers are disclosed pre-existing drift, not silently repaired here.
No accepted Spec, OAuth implementation, schema/migration, generator, API,
reconciliation/supply tool or other product path may change under this closure.
An additional required semantic file change triggers re-PREFLIGHT.

### CTR-MCC-005 — Freeze and focused conformance

Before any future implementation-complete claim, bind accepted Spec revision,
source Base/Head/tree, resolved source version, validated Bundle digest,
generated runtime digest and exact tests. Test the actual generic SERVICE
issuer/loader with isolated keys/DB/credentials; do not substitute a copied
schema or only a registry-text assertion. Existing audience projections and
affected negative guards remain equal. Unrun/stale/broader tests are labeled
accurately; fixture/health/source merge never means live auth acceptance.

### CTR-MCC-006 — No implicit supply or identity conflation

This CCR creates no caller/identity/credential/Grant/DB/secure-delivery authority.
Future supply requires a separately accepted bounded implementation contract,
exact-source plan, current owning mandate, CAS, same-transaction DB audit,
safe first-secret custody, finite attempts and readback-driven UNKNOWN handling.
Do not use secret-printing machine-admin or raw SQL as a substitute. Preserve
empty legacy Client allowedResources/allowedScopes; V1's exact MachineAccessGrant
owns authorization. Do not create a Grant through legacy arrays.

DSH's server-config connector_subject is a stable opaque configuration identity,
not an Auth token sub or enrollment business_subject_id. Its approved original
transport→dedicated client mapping remains owned by DSH/MCP configuration law;
ordinary Auth/DSH runtime must not query a temporary CSESB source binding to
manufacture caller identity. An existing attestation library is mechanism only;
an absent production trust adapter remains an explicit gate.

### CTR-MCC-007 — Separate activation and real authentication

Acceptance/merge grants only CTR-MCC-004 source authority. Production audience
reconciliation, service load, identity/client/Grant supply, secret delivery,
trusted loopback TLS/CA/system env, source ACL, original Router Binding and
first new request all need their own original owner/effect/readback mandates.
No mixed executable-registry/DB state is considered active. Before DSH enable,
the original runtime Node/trust environment must verify real HTTPS POST
client_credentials, exact response shape and negative controls without exposing
credentials/tokens. GET/JWKS/health and synthetic tests cannot pass that gate.

### CTR-MCC-008 — Compatibility, stop-send and rollback

Keep existing audience/Client/Grant/consumer behavior and all historical records.
Normal stop-send is DSH operations minus send, retaining result and MCP enabled,
TLS/credential/read Grant and all request/source/ACK/result/UNKNOWN/tombstones.
Auth client/Grant revocation, audience disable, stopping TLS or MCP=false is
full disable and also blocks result authentication. Source/DB rollback requires
its approved exact generation/forward audit; no raw deletion, fence clearing,
retry with a new client or restoring a wider Grant. Retained data and a loaded
result reader are separate facts.

## 10. Acceptance

All following implementation/runtime checks are **NOT_RUN** in this docs PR.

| ID | Contracts | Method / environment / required evidence | Expected / failure |
|---|---|---|---|
| ACC-MCC-001 | CTR-MCC-001 | future Bundle exact-entry/old-entry projection comparison; record Base/Head and digests | exactly one new entry and old projections equal; any extra/changed field or audience fails |
| ACC-MCC-002 | CTR-MCC-002, CTR-MCC-003 | real generic SERVICE issuer, disposable DB/keys; valid and missing/revoked/wrong profile/resource/scope/credential/Grant/registry negatives | only fully lawful exact request issues unchanged SERVICE token; any inferred/partial access or leaked secret fails |
| ACC-MCC-003 | CTR-MCC-004 | source diff, existing Bundle validator, real generator/loader, version reservation readback | coherent resolved minor and bounded15-path delta; old guards preserved; collision, website mutation or manual generated flag fails |
| ACC-MCC-004 | CTR-MCC-005 | exact source/tree/accepted authority/runtime digest and executed focused evidence | reproducible relevant PASS with unrun/drift limits; source fixture called live/full-suite success fails |
| ACC-MCC-005 | CTR-MCC-006 | authority/code/operation diff audit; separately reviewed supply receipt | no supply/DB/credential effects in CCR; no legacy-array write, lineage-as-auth-sub or invented trust adapter; any conflation fails |
| ACC-MCC-006 | CTR-MCC-007 | original-owner operation receipts and real DSH Node HTTPS POST with safe booleans | all independent gates and true protocol pass; health/GET or mixed state substituted fails |
| ACC-MCC-007 | CTR-MCC-008 | isolated original-result/stop-send controls, later approved exact rollback | send revoked while lawful result remains; preserved data/UNKNOWN, no second send; false reader/recovery or widened Grant fails |

## 11. Alternatives and disposition

Rejected: reuse website/Notification/Workflow/Agent credentials; wildcard
conversation.*; DB-only activation; invent UUIDs from lineage; broaden generic
token or online Grant API; repair unrelated old tests; combine registration
acceptance with production supply. Each crosses an existing authority or hides
an unverified effect. Retain original MCP/Router and distinct legacy identities;
no retirement/deletion or global identity convergence is authorized.

## 12. Migration, compatibility, and rollback

This PR has no runtime migration: docs only, proposed lifecycle, no acceptance.
Future source migration is CTR-MCC-004. DB reconciliation/supply is separately
owned and must preserve its exact absence/existing preimages and audit law.
Source rollback cannot by itself erase/revoke newly written facts; approved
forward disable/revocation and truthful result-read availability remain required.

## 13. Open questions

No technical placeholders or competing entry designs remain. Owner decision:
accept/reject the exact independently reviewed Spec Head for bounded source
registration; do not interpret that acceptance as production supply or load.
Current implementation/operation readiness is NO until exact acceptance in main.
Source version collision follows CTR-MCC-004, not a user-filled version field.
