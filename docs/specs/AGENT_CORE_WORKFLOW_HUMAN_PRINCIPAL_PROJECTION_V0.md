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
  - one exact-identity svc-workflow HUMAN Principal projection capability
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

svc-workflow already has an allowlisted, `workflow.admin`-protected Principal
provisioning API. The credential-bearing legacy HR runtime has the required
credential, but Agent Core exposes no callable operation for it. The accepted
G2 Human normalization cannot project the already-created canonical Human
identity without exporting a secret or using raw SQL.

This Spec authorizes one bounded operator for exactly one target:

```text
TARGET_PRINCIPAL_ID = 8902db0d-429a-4e37-985c-f8b92d4b78fb
TARGET_PRINCIPAL_TYPE = HUMAN
TARGET_STATUS = active
WIRE_PRINCIPAL_TYPE = human
WIRE_ENABLED = true
WIRE_SOURCE = auth-service
```

## 2. Current evidence

- dsh-agent-core base: `github/main` at
  `4c514bb0c8d3df8668f3058387676d97b17d45c2`.
- svc-workflow authority/wire base: `github/main` at
  `455b9c0e4986aa7264f7ae9deffc7aaae567443f`.
- Existing endpoints are
  `POST /internal/v1/admin/principals` and
  `GET /internal/v1/admin/principals/{principalId}`.
- They require a direct Agent access token, `workflow.admin`, allowlisted token
  subject, and (for POST) trusted `Idempotency-Key`.
- Principal type is immutable. Conflicting type returns
  `409 principal_type_conflict` before Principal mutation, while a durable
  failed command receipt may still be written.
- A same-state POST is result-state idempotent, but it is not a literal no-op:
  it may update provisioning metadata/timestamp and writes a command receipt.
- Broker's generic one-request HTTP manifest cannot perform the required
  GET-preflight -> conditional POST -> GET-readback sequence or map the product
  `status=active` input to the existing `enabled=true` wire field.
- Current shipped manifest inventory is 21. No manifest binds this surface.

## 3. Decision

Add exactly one LOCAL Broker tool:

```text
workflow_human_principal_projection(operation = provision)
```

The model-visible arguments are a closed object containing exactly:

```json
{
  "principalId": "8902db0d-429a-4e37-985c-f8b92d4b78fb",
  "principalType": "HUMAN",
  "status": "active"
}
```

Each property is required and restricted by a single-value enum. No URL,
source, enabled flag, credential, token, caller identity, idempotency key, retry
choice, or readback choice is model input.

The trusted local handler revalidates the exact key set and values as its first
action. Generic child-side validation is defense in depth; the parent RPC path
may be called directly, so only handler validation is authoritative. Invalid
input may encounter the gateway's existing credential/grant admission first,
but it causes zero svc-workflow GET/POST calls and zero business mutation.

## 4. Trusted operator algorithm

The handler derives actual `callerAgentId` only from the gateway context and
uses the existing credential store plus client-credentials token seam for:

```text
resource = svc-workflow
scope = workflow.admin
```

The token and credential remain in the parent runtime.

For one valid invocation the handler performs:

1. One fresh GET of the exact target.
2. If GET returns exact `human + enabled=true`, return `outcome=existing` and
   perform **zero POST**.
3. If GET returns the same UUID with type other than `human`, return
   `principal_type_conflict` and perform **zero POST**.
4. If GET returns `human + enabled=false` or exact `principal_not_found`, send
   exactly one POST with fixed trusted body:

   ```json
   {
     "principalId": "8902db0d-429a-4e37-985c-f8b92d4b78fb",
     "principalType": "human",
     "enabled": true,
     "source": "auth-service"
   }
   ```

5. The POST receives a trusted runtime-generated Idempotency-Key. The model
   cannot provide or alter it. No application-level blind retry is allowed.
6. After every POST response, timeout, or response-loss outcome, perform one
   fresh exact GET. Return `READY` only if that readback is exact
   `{principalId, principalType:"human", enabled:true}`.
7. If readback is absent, malformed, disabled, another UUID/type, or
   unavailable, return `projection_outcome_unknown` or `readback_mismatch` and
   STOP. A later invocation starts again at GET; it never assumes the prior
   POST failed.

The GET contract cannot expose persisted `source`; therefore source is fixed
and command-bound, not claimed as readback-verifiable.

## 5. Authorization and error boundary

- Manifest is `local: {resource:"svc-workflow"}` with
  `requiredScopes:["workflow.admin"]`.
- Gateway admission and handler token acquisition both bind to the actual
  caller. This Spec adds no Grant/allowlist/credential.
- svc-workflow remains sole authority for direct-token, scope, actor allowlist,
  actor-provisioned, validation, immutable type, receipt, and storage behavior.
- Callers without the existing credential and grant fail closed before handler
  business I/O.
- Declared outcomes cover invalid arguments, credential unavailable/invalid,
  access denied, provisioning not allowed/actor not provisioned, target not
  found, type conflict, invalid input/idempotency, command processing/conflict,
  transport/service/consistency failure, malformed response, readback mismatch,
  and projection outcome unknown. Unknown errors are collapsed into a declared
  fail-closed envelope with sanitized detail.
- `principal_type_conflict` means zero Principal/type mutation. It does not
  claim zero durable server write, because svc-workflow may commit a failed
  command receipt.

## 6. Exact implementation closure

After acceptance, implementation may change exactly these nine logical paths
(two are rename pairs):

```text
A packages/broker/src/capabilities/workflow-human-principal-projection.js
M packages/broker/src/index.js
A packages/broker/test/capabilities/workflow-human-principal-projection.test.js
M packages/broker/test/capabilities/manifest-inventory.test.js
R packages/production-runtime/src/agent-principal-resolution.js
  -> packages/production-runtime/src/identity/agent-principal-resolution.js
A packages/production-runtime/src/identity/workflow-human-principal-projection.js
M packages/production-runtime/src/compose.js
R packages/production-runtime/test/agent-principal-resolution.test.js
  -> packages/production-runtime/test/identity/agent-principal-resolution.test.js
A packages/production-runtime/test/identity/workflow-human-principal-projection.test.js
```

- Broker source owns only the exact LOCAL manifest/constants.
- Broker index registers the manifest and adds the provider to the existing
  execute-time local handler resolver.
- `src/identity/` and `test/identity/` are cohesive identity/projection homes.
  The existing Principal-resolution source and test move mechanically into
  them; only relative imports change and all existing assertions remain.
- Production runtime projection source owns the exact validator and algorithm
  in §4.
- Compose supplies only fixed deployed target/auth coordinates and an
  `acquireCallerToken(actual callerAgentId, workflow.admin)` seam using the
  existing credential store/token primitive.
- Dedicated tests own capability and runtime algorithm evidence.
- Aggregate manifest inventory changes exactly `21 -> 22`.
- Each production-runtime root replaces one existing direct file with one
  directory: `src` and `test` therefore remain exactly 20 direct children;
  each new `identity/` directory contains exactly two files.
- No changes to generic schema, mapping, gateway, relay, transport, credential
  store, targets, registry, release scripts, or legacy
  `packages/broker/src/capabilities/workflow.js`.

## 7. Lifecycle and production boundary

This candidate is proposed with no implementation or production authority.
After independent exact-head ACCEPT/BLOCKERS=NONE and explicit Owner exact-head
acceptance, the lifecycle-only acceptance transaction is frozen to:

```text
status: proposed -> accepted
implementation_authority: none -> contracts
production_apply_authority: none  # unchanged
```

It may also add only standard acceptance provenance fields/banner and the
corresponding `docs/specs/README.md` lifecycle row. Normative §§1-12 bytes must
remain unchanged. That acceptance head, once merged to main, authorizes only
the exact implementation closure in §6.

Implementation merge, capability production deployment, and exact Principal
projection are distinct gates. Production deployment requires exact artifact
review plus an accepted production-apply authority or an already-valid
controlled-operation authority. Deployment/reload is one production mutation.
Only after health/readiness readback may a separate mutation invoke this
operator once. It must not normalize any Workflow row in the same mutation.

The operator succeeds only with its own mechanically validated GET readback:

```text
WORKFLOW_PRINCIPAL_PROJECTION = READY
PRINCIPAL_ID = 8902db0d-429a-4e37-985c-f8b92d4b78fb
PRINCIPAL_TYPE = HUMAN
STATUS = active
```

That receipt closes this tool-building Goal. Exact-20 normalization remains a
later independent implementation/production path.

## 8. Frozen boundaries and non-goals

- No generic identity-admin API or Human-management framework.
- No new auth-service/svc-workflow endpoint, protocol, schema, or behavior.
- No raw DB, secret export, fake/second Human identity, Agent conversion, or
  arbitrary Principal UUID/type/status/source mutation.
- No Grant, allowlist, credential, Agent Definition, scheduler, dispatch,
  activation, readiness classifier, or current `agt_hr-agent` permission change.
- No title inference, HR special filter, executor field, Workflow business
  transition, Human completion/evidence, or exact-20 normalization.
- No automatic retry after an unknown write; only exact readback/re-entry.
- No future UUID/state/disable/delete/bulk/discovery support.

## 9. Contracts

`CTR-WHPP-001` — One tool, one operation, and three exact single-value inputs as
defined in §3; handler revalidation is authoritative and precedes business I/O.

`CTR-WHPP-002` — Actual caller identity/credential and `workflow.admin` remain
trusted-seam-only; unauthorized callers fail closed; no new authority is granted.

`CTR-WHPP-003` — Handler uses fixed exact target/path/body/source and never
accepts these wire controls from the model.

`CTR-WHPP-004` — Fresh GET precedes any POST. Existing exact ready state performs
zero POST. Existing conflicting type performs zero POST and zero Principal/type
mutation; a downstream failed receipt is permitted.

`CTR-WHPP-005` — At most one POST occurs per invocation with a trusted
Idempotency-Key and no application-level blind retry.

`CTR-WHPP-006` — Every POST outcome is followed by exactly one fresh GET; READY
is impossible without exact UUID/type/enabled readback. Source is command-bound,
not GET-verifiable.

`CTR-WHPP-007` — Re-entry is state-based and result-state-idempotent. It does not
misstate every POST as a literal storage no-op.

`CTR-WHPP-008` — Implementation closure is exactly §6, inventory is 22, both
production-runtime root child counts remain 20, both identity subdirectories
contain two files, and no generic Broker or svc mechanism changes.

`CTR-WHPP-009` — Deployment, projection, and exact-20 normalization remain
serialized, separate operations.

`CTR-WHPP-010` — Acceptance transaction is exactly §7; review alone grants no
implementation or production authority.

## 10. Acceptance criteria

- `ACC-WHPP-001`: exact manifest validates and default inventory is 22.
- `ACC-WHPP-002`: wrong/missing/extra UUID/type/status fails closed with zero
  svc-workflow call; secret/token/idempotency/source/enabled are not model args.
- `ACC-WHPP-003`: no credential or no `workflow.admin` is denied before handler
  business I/O; actual caller selects the credential.
- `ACC-WHPP-004`: pre-existing exact active Human produces one GET, zero POST,
  `outcome=existing`, and exact readback.
- `ACC-WHPP-005`: pre-existing Agent produces one GET, zero POST, type conflict,
  and no Principal mutation.
- `ACC-WHPP-006`: absent and disabled-Human fixtures produce GET -> one exact
  POST with trusted Idempotency-Key -> GET, then READY only on exact readback.
- `ACC-WHPP-007`: POST 409/timeout/malformed/lost response paths do not retry;
  each performs readback and returns only a truthful terminal/unknown outcome.
- `ACC-WHPP-008`: mismatched/malformed/unavailable readback fails closed and
  never reports READY; response/error detail exposes no credential/token.
- `ACC-WHPP-009`: focused tests, full Broker/runtime tests, structure verifier,
  secret scan, exact-path/rename diff, and Spec compliance PASS. The moved
  Principal-resolution tests remain behavior-identical.
- `ACC-WHPP-010`: independent exact-head implementation review returns
  PASS/BLOCKERS=NONE before any merge/deploy.

## 11. Alternatives considered

- Two exposed HTTP operations — rejected: makes readback prompt convention and
  cannot guarantee existing-ready zero POST.
- Raw DB or credential export — rejected: bypasses authority and trust boundary.
- Grant current business HR `workflow.admin` — rejected: broadens authority to
  solve an invocation defect.
- Generic Principal admin tool — rejected: permits unrelated mutations.
- Generic transport transforms/orchestration — rejected: expands shared
  machinery for one exact projection.
- Same-state POST as “no-op” — rejected: pinned service writes metadata/receipt.
- Literal zero durable writes on type conflict — rejected: immutable type is
  preserved, but a failed receipt is legitimate audit evidence.
- Mix projection with exact-20 Workflow normalization — rejected: violates the
  serialized production boundary.

## 12. Risks and open questions

Risks are bounded by exact arguments, server authorization, one conditional
POST, mandatory readback, and no Grant change. A lost POST response yields
readback-based success or explicit unknown, never guessed success.

There are no open V0 product questions. Supporting another identity or state
requires a new/amended accepted authority. Production deployment authority is
deliberately not created by this implementation Spec.

## 13. Review gate

The read-only Reviewer binds exact HEAD and Spec SHA-256 and verifies:

1. exact upstream endpoint/auth/type semantics;
2. exact target and three-input closure;
3. mechanical preflight/conditional-write/readback algorithm;
4. honest result-state idempotency and type-conflict receipt semantics;
5. no generic admin/transport/identity/Grant expansion;
6. exact structure-safe paths/renames, direct-child counts, and inventory delta;
7. deployment/projection/exact-20 separation;
8. frozen lifecycle transaction and honest current `none` authorities.

Only `FINAL_VERDICT=ACCEPT` and `BLOCKERS=NONE` makes this candidate ready for
Owner exact-head acceptance. Review itself authorizes no implementation or
production action.
