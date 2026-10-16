# MCP conversation Auth implementation plan — source preparation only

Base: `57f459804df1b6526a164016ea3aefa12836286d` / tree `28a7051ad5bd60332f75d04f13140190feb4ae18`.
Authority route: NEW + EXEC_PLAN + CONTROLLED. Both new MCP Specs remain proposed; this plan has no Product Authority. Current implementation and operation readiness are NO. No source, Bundle, generated runtime, DB, Principal, Client, credential or Grant changes have been made.

## Before implementation

1. Independent semantic review binds the exact proposed Spec Head and Base. Owner accepts that exact content, then the accepted snapshot must be merged into Auth main. A proposed `implementation_authority: contracts` describes intended authority after acceptance; it cannot enable work now. The external v2 application draft remains unchanged and non-authoritative.
2. Re-read main, active accepted authorities, Bundle version/digests and sibling reservations. Current Bundle is1.12.0; website CCR already reserves1.13.0. The recommended MCP candidate is1.14.0, appending only MCP to the current12 entries. Website rollout is not a prerequisite. If website source lands first, preserve its entries, re-pin the new Base and review the exact delta; if1.14 is occupied, resolve the next free minor with a new exact source plan.
3. Create a separate implementation branch from the accepted authority main. Do not implement on the docs branch or edit its governing accepted Spec. Production source/runtime is a separate coordinate and remains unchanged.

## Registration deliverable

- Copy the exact CTR-MCC-001 entry into the registry, preserving old audience projections/order and all frozen profiles/Scopes/Grants. Never alias the website transport or Notification resource.
- Change only CTR-MCC-004's15 paths. Update manifest/schema/version/fixture/freeze linkage, closed validator expectations and the runtime compatibility list together. Preserve all old validation assertions. The existing session-inspection test may update version labels only.
- Use the existing prepare/validation flow in the isolated implementation directory. The actual future commands are `npm run contract:v1:validate`, `npm run contract:v1:prepare`, and the new focused `tests/oauth/mcp-conversation-audience-v1.test.ts` plus directly affected session-inspection test, through the repository's existing tsx runtime. These commands have NOT_RUN status for MCP because no implementation authority is active yet.
- The new test must exercise `authorizeV1DirectToken`/the real generic issuer and real runtime loader, using isolated keys/credential/DB fixture. Verify a valid SERVICE Client+MachineAccessGrant and missing/revoked/wrong profile, wrong resource/scope/credential, unknown/extra/mixed scopes, registry mismatch and no secret exposure. Inspect actual signed claims/profile and unchanged Cache-Control/Pragma behavior; a copied schema or registry-only assertion is insufficient.
- Generate `generated/minimal-auth-v1/runtime-contract.json` using the existing validated generator. Pin Base/Head/tree, accepted Spec hash, actual resolved version, source Bundle digest, generated runtime digest and build artifact hashes. Do not hand-set freeze bits or disguise an unfrozen candidate as a valid runtime snapshot. Freeze review/provenance must follow the owning accepted process and name its measured source revision.
- Source1.14 support and a generated artifact still do not prove the service is loaded or the production DB has a matching row.

## Reconciliation / secure supply deliverable

Use the separately accepted `AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1` only after it is accepted/merged. Its bounded vehicle must implement its exact registry write set and one SERVICE principal/client/Grant with original Owner evidence, lock/CAS/transaction audit and a durable first-secret handoff. It cannot be replaced by generic backfill, machine-admin, raw SQL or a new management API.

Generic service Client creation initializes legacy allowedResources/allowedScopes empty; V1 authorization reads MachineAccessGrant. Keep those legacy arrays untouched. Treat CSESB business_subject_id/source-binding as temporary enrollment evidence, never connector authentication identity. The existing canonical enrollment CLI currently has no production trustedEvidenceProvider adapter; do not present it as an executable attestation route.

Connector_subject is a separate stable opaque DSH/MCP configuration UUID, derived by an approved owning configuration operation and mapped to one original authenticated transport and dedicated verified client. It is not an Auth token sub or Agent/reader principal. Its nonsecret configuration receipt may feed the already frozen v2 offline renderer; `source_binding_ref` denotes the approved DSH configuration-binding record, not a CSESB permanent auth lookup.

## Validation and integration boundaries

- Only new/affected source and security paths need new tests. Existing runtime/candidate tests/helpers contain pre-existing1.8.0 assertions although current Bundle is1.12.0; this is observed source drift, not an executed test failure. Do not repair them under the15-path authority. Report any encountered failure with exact coordinates; expanding that closure requires explicit re-PREFLIGHT.
- No production credential, DB URL, private key, token, raw proof or secret-bearing HTTP response enters a model, log, PR or package. Future tests use disposable identities and storage.
- Build/issuer fixture, loaded Auth/source-registry-DB equality, real DSH HTTPS POST, original Router/Binding/source readiness and dot's first real business reply remain separate evidence layers.
- Registration source and secure supply source may be reviewed independently. Real operations remain bounded by the original Auth/DSH owning mandate and the currently active B7/DS release lane; no source acceptance bypasses those gates.

## Completion receipt

The future implementer reports exact accepted Spec/Base/Head/tree, changed path list, preserved old-entry digests, resolved version, Bundle/runtime/build hashes, focused positive/negative counts and unrun limits. Current docs preparation must report all those implementation fields as NOT_RUN rather than fill them with old1.12 or v2 fixture results.
