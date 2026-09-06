---
spec_id: AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: conditional_controlled_operation
scope:
  - mayf3/dsh-agent-core
  - protected exact Agent Definition read for Workflow admission
governed_by: [AGENT_CORE_PRODUCT_ARCHITECTURE_V1]
external_authorities:
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_WORKFLOW_CANONICAL_ADMISSION_V1
    revision: 2af21f87769af50b1c38abcd19655bb28c023e9a
    relation: depends_on
supersedes: []
superseded_by: null
owners: [mayf3]
---

# AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1

## Goal, authority and evidence

Expose the authoritative enabled Agent Definition check to the Workflow backend so assignment admission need not use a public directory, copied registry, HR credentials or a second identity store. Preserve the existing LOCAL agent_resolve_principal and its audience/caller semantics.

DEVELOPMENT_PREFLIGHT: AUTHORITY_ACTION=NEW; PLAN_LEVEL=EXEC_PLAN; ASSURANCE_LEVEL=CONTROLLED; DOCS_FIRST_REQUIRED=YES. Base600d4df9b50fa4b7ffc368020cf0a8840d37346e. Primary parent AGENT_CORE_PRODUCT_ARCHITECTURE_V1 and accepted exact Principal resolver V2 at that base. The external Auth Spec above is proposed, not currently usable authority. All implementation remains blocked until both owning Specs are accepted and merged. Existing shared-host cooperative trust does not permit disclosing service credentials to Agents.

OBS-WAD-001: packages/production-runtime/src/agent-principal-resolution.js at base composes exact Auth relation with local authoritative Definition validation. OBS-WAD-002: packages/product-api/src/index.js exposes a mobile Agent projection without the protected backend contract; LOCAL Broker registration is not an HTTP service API. EVD-WAD-001 supports CLM-WAD-001: a protected exact read in the existing runtime can reuse authoritative state without a new service/store. These observations prove source feasibility only.

DEC-WAD-001 (proposed, owner mayf3): use a dedicated service-only exact read in the existing production server. Workflow independently gets Auth relation as itself and presents only the resulting exact Agent ID. Agent Core does not learn target credentials or grant Workflow any Agent control.

## Contracts

### CTR-WAD-001 — Exact protected surface

GET /v1/workflow-admission/agents/:agentId accepts one exact ID, no body/query/list. After caller authentication, validate existing accepted canonical Agent ID syntax, preserving exact bytes; reject malformed/legacy/prefix-normalized/name input with400 INVALID_AGENT_ID. Do not return a guessed or substituted ID. Mount only on the reviewed production runtime server; loopback placement alone is not authentication. Configure no browser CORS credential access. Do not alter the mobile /v1/agents projection or expose this through Agent tools.

### CTR-WAD-002 — Dedicated caller authorization

Require existing Auth V1 RS256 issuer/JWKS/time/token_use/direct-service profile, exact single audience workflow-agent-admission, principal_type=service, sub=cedb954a-3d99-4e5a-b568-d312441bcc56, client_id=svc-workflow-canonical-admission-v1, scope agent.definition.admission.read, with no delegated/proxy profile. These public caller values are proposed under the pinned Auth Spec, not observed live identities. Require issued-at no older than5seconds with no positive skew allowance extending the age limit; reject future-issued tokens using the existing verifier's time policy. Expired/invalid/signature/issuer/audience/profile errors return401 UNAUTHORIZED; other valid caller or missing required scope returns403 ACCESS_DENIED before target read.

This resource verifies a recently issued service token offline under the existing JWKS contract; it does not claim an instantaneous online Client/Grant revocation check. Auth's paired per-command relation read freshly checks that same Principal/Client. Revocation after issuance/observation has the bounded<=5second race of the complete consumer admission window, not an indefinite cached authorization. Unknown JWKS/signature capability fails closed. No Workflow-audience token, HR token, provisioning identity, source IP or display-name allowlist satisfies this route.

### CTR-WAD-003 — Authoritative exact Agent observation

Read the production runtime's authoritative Agent Definition snapshot, not a filesystem copy supplied by Workflow. Require exactly one exact ID, valid canonical syntax and disabled != true under the existing Definition contract. No row=404 AGENT_NOT_FOUND; duplicate/corrupt snapshot=409 AGENT_DEFINITION_AMBIGUOUS; disabled=409 AGENT_DISABLED; unknown storage/definition error=500 AGENT_DEFINITION_QUERY_FAILED. Success returns exactly {agentId,enabled:true,observationDigest}, where observationDigest is SHA256 of canonical JSON containing only the observed exact ID and effective enabled flag. It is a digest of those observation fields, not a registry epoch or a promise that the registry cannot change. No name/workspace/credential/config/Session data is disclosed.

The check reads one coherent local snapshot synchronously and returns Cache-Control:no-store. A1second operation deadline returns504 AGENT_DEFINITION_TIMEOUT; late result cannot become success. No automatic retry or positive result cache across commands. This route verifies Agent status only; a caller cannot treat it alone as proof of a valid Auth Principal relation. Disabled-after-observation remains a possible later lifecycle change and must be denied by normal dispatch resolution.

### CTR-WAD-004 — Zero side effects and bounded integration

No Agent/session/wake/send/scheduler/definition mutation, credential issuance, identity rewrite or business transition occurs. Only the narrow route, existing verifier/Definition read adapter, minimal server composition and focused tests may change. Freeze exact file closure and comply with structure guardrails; no new generic registry/identity framework. The proposed Auth read grants are not supply authority in this repository. Service secret stays exclusively in Workflow's owner-only backend credential storage and never enters an Agent workspace/session or this route.

### CTR-WAD-005 — Consumer, release and rollback conditions

The consuming Workflow command must obtain fresh Auth relation and this exact Agent observation for every affected identity, authorize its own business actor separately, lock/version-check its state and commit within5seconds from its first admission request start. If deadline, version check or any observation fails, commit zero business writes. No cross-service atomicity is claimed. A grant authenticates the backend validator, not the end user or Domain operation.

Deployment requires accepted owning heads, exact implementation review/tests, target/preimage proof, shared mutation slot IDLE, health and durable receipt/readback. Deploy a bounded reviewed artifact, not whole latest main. Failure withdraws this route and contains dependent Workflow admission; never enable invalid assignments as a fallback. Unknown deployment outcome requires same-attempt observation before retry. Existing LOCAL Broker resolver/HR dispatch remain governed by their accepted authority and normal credentials.

### CTR-WAD-006 — Acceptance boundary

| Acceptance | Contracts | Method/environment/required evidence | Expected / failure |
|---|---|---|---|
| ACC-WAD-001 |001| exact HTTP route fixtures at implementation head | malformed/query/body/list/legacy/name inputs deny; no unintended exposure |
| ACC-WAD-002 |002| real signed V1 fixtures plus verifier failure injection | exact service success; HR/other service/delegated/old/future/expired/wrong issuer or scope deny before target read |
| ACC-WAD-003 |003| authoritative snapshot fixtures and concurrent disable/timeout tests | exact enabled ID only; missing/duplicate/disabled/error differentiate; truthful observation digest and no stale cache |
| ACC-WAD-004 |004| diff/structure gate/write spies/secret sentinels | closed files and zero side effects/disclosure |
| ACC-WAD-005 |005| Workflow consumer integration and controlled release rehearsal | total5second window, stale-version/invalid/unavailable zero business commit, explicit bounded post-observation race, contained rollback |
| ACC-WAD-006 |006| exact head Contract matrix plus target readback | no completion claim from source tests alone; no external authority assumed accepted |

## Status and alternatives

Rejected: public mobile listing, local registry copies, a new generic identity service, HR impersonation, target credential access, using this service token to act on Workflow business tasks. The selected new backend-read capability requires explicit Owner semantic acceptance of the pinned Auth identity/two Grants as well as this route; the Goal's existing permission does not supply it.

STATUS=proposed; IMPLEMENTATION_ALLOWED_NOW=NO; PRODUCTION_READY=NO. Accepted files/maps remain unchanged. This is a proposed dependency of the svc-workflow blocker-union repair, not its fresh independent re-audit.
