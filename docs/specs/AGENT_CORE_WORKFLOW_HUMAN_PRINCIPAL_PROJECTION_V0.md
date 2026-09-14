---
spec_id: AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0
status: proposed
date: 2026-09-14
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core
  - one exact-identity svc-workflow principal projection Broker capability
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_HUMAN_EXECUTOR_NORMALIZATION_V0
    revision: 455b9c0e4986aa7264f7ae9deffc7aaae567443f
    relation: enables
  - repository: mayf3/svc-workflow
    authority_id: IDENTITY_PROVISIONING_API_V0
    revision: 455b9c0e4986aa7264f7ae9deffc7aaae567443f
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0

> **PROPOSED / DOCS ONLY.** This candidate changes no runtime, credential,
> Principal, Workflow, deployment, or production state. Independent exact-head
> review and Owner exact-head acceptance are required before implementation.

## 1. Problem

svc-workflow already exposes an allowlisted, `workflow.admin`-protected Principal
provisioning API. The credential-bearing legacy HR runtime has the required
credential, but Agent Core exposes no callable Broker operation for the endpoint.
The accepted G2 Human normalization therefore cannot project the already-created
canonical Human identity without exporting a secret or using raw SQL.

This Spec authorizes the smallest possible bridge for exactly one target:

```text
TARGET_PRINCIPAL_ID = 8902db0d-429a-4e37-985c-f8b92d4b78fb
TARGET_PRINCIPAL_TYPE = human
TARGET_STATUS = active
WIRE_ENABLED = true
WIRE_SOURCE = auth-service
```

## 2. Current evidence

- dsh-agent-core base: `github/main` at
  `4c514bb0c8d3df8668f3058387676d97b17d45c2`.
- svc-workflow authority and wire contract: `github/main` at
  `455b9c0e4986aa7264f7ae9deffc7aaae567443f`.
- Existing wire endpoints:
  `POST /internal/v1/admin/principals` and
  `GET /internal/v1/admin/principals/{principalId}`.
- POST requires direct Agent access token, `workflow.admin`, allowlisted token
  subject, and trusted `Idempotency-Key`. It is an idempotent upsert; an existing
  same UUID with another type returns `409 principal_type_conflict` without a
  type mutation.
- The shared Broker HTTP transport already supplies credential-isolated OAuth,
  trusted idempotency key generation/reuse, fixed target/path binding, declared
  error preservation, and fail-closed structural/enum validation.
- Current shipped manifest inventory is 21. No current manifest binds either
  Principal admin endpoint.
- `packages/broker/src/capabilities/workflow.js` is registered legacy above its
  ceiling and must not be touched or grown for this capability.

## 3. Decision

Add exactly one grouped Broker tool:

```text
workflow_principal_projection
  operation = provision | read
```

It is a pure manifest over the existing generic authorized-HTTP transport. No
new transport, schema, credential, identity, auth-service, or svc-workflow
mechanism is introduced.

### 3.1 Exact bounded arguments

`provision` requires a closed argument object with all five properties below:

| Model argument | Allowed value | Wire behavior |
|---|---|---|
| `principalId` | exact target UUID only | POST body |
| `principalType` | `human` only | POST body |
| `status` | `active` only | validation only; not forwarded |
| `enabled` | `true` only | POST body |
| `source` | `auth-service` only | POST body |

The apparently redundant `status` and `enabled` are intentional: the product
contract names the state `active`, while the existing svc wire contract names
the same projection bit `enabled`. Both are required single-value enums. This
keeps the user-visible contract explicit without adding a transform mechanism.

`read` requires a closed argument object whose only property is `principalId`,
also restricted to the exact target UUID. It calls the existing GET endpoint.

Any UUID, type, status, enabled value, source, unknown property, or missing
property outside this exact contract fails locally before credential lookup,
token mint, or HTTP.

### 3.2 Authorization and identity

- `requiredScopes = ["workflow.admin"]`.
- The credential comes only from the existing trusted per-Agent credential
  seam. No secret, token, caller Principal, or client id is accepted as model
  input or returned in results.
- svc-workflow remains the only authority for direct-token, allowlist,
  provisioning-actor, scope, and type-conflict checks.
- This Spec grants no scope, adds no allowlist entry, and does not convert or
  impersonate any Agent Principal.

### 3.3 Idempotency and readback

- `provision` sets manifest `http.idempotencyKey = true`; the trusted transport
  generates the key and reuses it on its single authorized 401 refresh retry.
- Same existing UUID/type/state/source is an idempotent upsert/no-op at the
  service authority.
- `principal_type_conflict` is declared and preserved; the service guarantees
  zero type write on this conflict. The Broker never retries it as a new command.
- A successful POST is not the G2 projection gate. The caller must immediately
  invoke `read` and mechanically require the exact UUID, type `human`, and
  `enabled: true`. A timeout/unknown POST outcome also proceeds to exact GET
  readback before any deliberate replay.

## 4. Exact implementation closure

After acceptance, implementation may change exactly these four paths:

```text
A packages/broker/src/capabilities/workflow-principal-projection.js
M packages/broker/src/index.js
A packages/broker/test/capabilities/workflow-principal-projection.test.js
M packages/broker/test/capabilities/manifest-inventory.test.js
```

- The new source file owns the one manifest and exports its one-element manifest
  array.
- `index.js` imports and spreads that array into default manifests.
- The dedicated test file owns all capability-specific tests.
- Inventory changes exactly `21 -> 22`.
- `packages/broker/src/capabilities/workflow.js`, transport, schema, mapping,
  gateway, credential store, registry, release scripts, and all other paths are
  byte-unchanged.

## 5. Production execution boundary

Implementation merge, production deployment, and the production projection are
three distinct gates.

This proposed lifecycle has `implementation_authority: none` and
`production_apply_authority: none`. Owner acceptance may authorize the four-file
implementation closure. Production deployment still requires exact artifact
review and an accepted production-apply authority or other already-valid
controlled-operation authority.

If later deployment is authorized, the first production mutation is only the
capability deployment/reload. After health/readiness readback, a separate second
production mutation may invoke `provision` once for the exact target and then
invoke read-only `read`. It must not normalize any Workflow row in the same
mutation.

Successful readback closes and stops this tool-building Goal:

```text
WORKFLOW_PRINCIPAL_PROJECTION = READY
PRINCIPAL_ID = 8902db0d-429a-4e37-985c-f8b92d4b78fb
PRINCIPAL_TYPE = HUMAN
STATUS = active
```

## 6. Frozen boundaries and non-goals

- No generic identity-admin API or Human-management framework.
- No new auth-service or svc-workflow endpoint/protocol/schema.
- No raw DB access, secret export, fake identity, second Human identity, or
  Agent-to-Human conversion.
- No arbitrary Principal UUID/type/status/source mutation.
- No grants, allowlist, credential, agent-definition, scheduler, dispatch,
  activation, or readiness-classifier change.
- No title inference, HR special filter, new executor field, Workflow business
  transition, Human completion/evidence, or exact-20 normalization in this
  capability implementation or projection transaction.
- No change to the current canonical `agt_hr-agent` grant set. The callable
  surface succeeds only inside an already credentialed and server-authorized
  runtime; all other callers fail closed.

## 7. Contracts

`CTR-WHPP-001` — Tool identity is exactly
`workflow_principal_projection`; operations are exactly `provision|read`.

`CTR-WHPP-002` — Provision arguments are closed and restricted to the exact five
single values in §3.1; read is closed and exact-UUID-only. Invalid input causes
zero credential, token, and downstream calls.

`CTR-WHPP-003` — POST is pinned to svc-workflow, exact admin path, exact four
wire body fields, `workflow.admin`, and trusted Idempotency-Key. `status` is not
forwarded.

`CTR-WHPP-004` — GET is pinned to the exact admin read path and exact target UUID.

`CTR-WHPP-005` — Credential and caller identity remain trusted-seam-only; the
capability neither exports secrets nor grants authority.

`CTR-WHPP-006` — Declared service errors include authorization/allowlist,
validation, receipt, not-found, type-conflict, consistency, and availability
families plus canonical transport errors. Undeclared errors fail closed through
the existing Broker envelope.

`CTR-WHPP-007` — `principal_type_conflict` is a terminal zero-write stop. POST
success or unknown outcome never substitutes for exact GET readback.

`CTR-WHPP-008` — Implementation closure is exactly §4 and inventory is 22;
generic Broker behavior and the legacy workflow manifest file do not change.

`CTR-WHPP-009` — Production capability deployment and exact Principal projection
are serialized separate mutations. The later exact-20 Workflow normalization is
outside both.

## 8. Acceptance criteria

- `ACC-WHPP-001`: manifest schema validation PASS; default inventory exactly 22.
- `ACC-WHPP-002`: all out-of-contract values and unknown/missing arguments fail
  before credential/token/HTTP; valid exact values pass.
- `ACC-WHPP-003`: wire fixture observes exact POST method/path/body, scope
  `workflow.admin`, and a trusted non-model Idempotency-Key; no `status` field is
  forwarded.
- `ACC-WHPP-004`: read fixture observes exact GET path and returns the canonical
  service response without reshaping.
- `ACC-WHPP-005`: exact repeated projection is harmless/no-op; mocked
  `principal_type_conflict` is preserved and causes no follow-up write.
- `ACC-WHPP-006`: credential unavailable, insufficient scope, allowlist denial,
  malformed response, and unknown downstream errors fail closed and redact
  secret canaries.
- `ACC-WHPP-007`: focused tests, complete Broker tests, structure verifier, and
  secret scan PASS; exact changed files equal §4.
- `ACC-WHPP-008`: independent exact-head review reports PASS/BLOCKERS=NONE and
  verifies every frozen non-goal.

## 9. Alternatives considered

- Raw DB insert/update — rejected: bypasses the accepted provisioning authority,
  audit, type-conflict, and idempotency contracts.
- Export the HR credential to Codex — rejected: violates the trusted credential
  boundary.
- Grant `workflow.admin` to the current business HR Agent — rejected: broadens
  authority to solve an invocation-surface defect.
- Generic Principal management tool — rejected: permits unrelated Principal
  mutations and creates a management framework beyond this one projection.
- Add transform/constants to generic Broker transport — rejected: the five
  exact-value argument contract achieves the wire mapping without changing
  shared machinery.
- Add the manifest to legacy `workflow.js` — rejected: violates its structural
  ceiling and mixes admin projection with the business workflow surface.
- Combine projection with exact-20 Workflow normalization — rejected: violates
  one-production-mutation-at-a-time and obscures independent readback.

## 10. Risks

- A model-visible admin tool is high privilege. Single-value closed arguments,
  exact endpoint binding, service-side `workflow.admin`/allowlist enforcement,
  and no Grant change constrain it to one harmless idempotent target.
- A POST response can be lost. Exact GET readback is authoritative; no new
  command identity is created merely because a response is missing.
- A pre-existing different type signals corrupted assumptions. The service
  conflict is preserved and the Goal stops with zero type write.

## 11. Open questions

None for the V0 contract. Any request to support another UUID, another state,
disable, conversion, deletion, bulk projection, or discovery requires a new or
amended accepted authority.

## 12. Review gate

The independent Reviewer is read-only and binds the exact branch HEAD and this
file's SHA-256. It must verify:

1. existing svc wire/authorization carriage is exact;
2. exact target/type/status/source are closed locally;
3. no generic admin, transport, identity, or Grant expansion exists;
4. idempotency, type-conflict zero-write, and fresh readback are complete;
5. implementation closure and inventory delta are exact;
6. deployment, projection, and exact-20 mutation remain separate;
7. `implementation_authority=none` and `production_apply_authority=none` remain
   honest in the proposed candidate.

Only `FINAL_VERDICT=ACCEPT` and `BLOCKERS=NONE` make the candidate ready for
Owner exact-head acceptance. Review does not itself authorize implementation or
production.
