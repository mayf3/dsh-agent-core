# #1156 identity/effect audit — 2026-10-16

Auth source inspected: `57f459804df1b6526a164016ea3aefa12836286d`.
DSH accepted contract inspected at
`44da63d21987bf7115435f0767e7851b9022836a:docs/specs/DSH_MCP_NATIVE_CONVERSATION_V1.md`.
No production DB/API calls, issuance, principal/client/grant/Binding creation,
secret readback or transport/business calls were performed. Only one new proposed
Auth Spec and these isolated review artifacts were written.

## What is genuinely reusable

| Mechanism | Real source / authority | Exact non-secret fields / limit |
|---|---|---|
| SERVICE principal creation | `src/routes/idempotent.ts`, `src/lib/oauth/v1/idempotent.ts` | POST `/api/v1/principals`: external_ref, principal_type=service, display_name; optional expected_principal_id claims existing identity, not used here. Output id/principal_type/status/external_ref/created_at/created. Generic primitive; not a safe whole supply operation. |
| Dedicated client creation | Same source | POST `/api/v1/clients`: external_ref, principal_id; optional expected_client_id is internal client row UUID. Output id/client_id/principal_id/status/external_ref/created_at/created; **new create also returns secret**, reuse has no secret. Never call through a model. |
| Management authentication | `src/middleware/v1-management-auth.ts` | Existing svc-auth/auth.identity.provision verification and DB client→principal checks; credential possession is not Human operation approval or attestation authority. |
| V1 direct authorization | `src/lib/oauth/v1/direct.ts` | Resolves generated runtime audience first, then active client/principal, verifier, profile, exact MachineAccessGrant, registry equality and scope. Legacy arrays do not grant this resource. |
| Versioned registry/audit pattern | accepted `AUTH_SERVICE_SVC_FORUM_AUDIENCE_REGISTRY_RECONCILIATION_V1` CTR-RR-004/005 | Existing AuthAudience/AuthSecurityAudit; related table locks before advisory813947203 before snapshot, same-txn audit. Its exact svc-forum effects cannot authorize MCP. |
| Secret-safe supply contract pattern | accepted Notification SERVICE_CREDENTIAL_GRANT Spec | Closed three-file future vehicle; plan/apply/verify; no raw output; exact NOOP/drift/UNKNOWN. Its script is absent at this base and it owns only its two callers. |
| Connector configuration mapping | DSH CTR-NC-001/003 | Verified client uniquely maps to original connector subject, stable scope and product principal via Owner config. Stable subject UUID is generated/approved by original DSH/MCP owning executor, not manually fabricated. |

## What must not be reused

- `machine-admin`: Agent-ID/owner-only creation; secret-printing client create/rotate.
- CSESB `business_subject_id`: enrollment-lineage key, not Auth `sub` or MCP
  authentication subject. Source binding is temporary migration metadata and
  ordinary auth/routing must not read it (DEC-CSESB-003).
- CSESB CLI: import exists; plan/apply/verify require a host-injected trusted
  evidence provider. Direct invocation fails AUTHORITY_NOT_ACCEPTED. No production
  trust adapter is supplied by that CLI; no Principal/client/grant supply occurs.
- Reader7711, targetBIPd5b3, old same-display-name BIP, Notification or Workflow
  credentials: distinct identities and authority, not the original MCP caller.

## Concrete future owner flow, currently NOT_IMPLEMENTED

1. Original DSH/MCP Owner establishes exactly one original transport, allocates and
   persists stable opaque connector UUID, binds it to this pilot's future dedicated
   client/principal and fixed `mcp-native-conversation-pilot-v1` scope. No CSESB
   enrollment is needed. No original transport secret is copied or rotated.
2. Accept/review/merge the separate Audience CCR and new supply child; implement and
   verify their exact independent source closures. Current source1.12→proposed
   MCP1.14 preserves website1.13 reservation without loading website side effects.
3. Original Auth release owner, with separate operation mandate, stops serving and
   runs future `registry plan/apply/verify`: absent INSERT-or-exact-NOOP, one row+one
   same-txn audit, one nonce/fence, CAS and shared lock. Then load and verify the
   matching reviewed runtime via the original release lane before resuming.
4. Separately approved future `supply plan/apply/verify` creates one SERVICE
   principal, dedicated client, exact v1 grant and same-txn audit. New legacy arrays
   are empty; old rows remain untouched. One secret goes only to private root-owned
   escrow and the MCP uid502/gid20 mode0600 credential file. Model-visible outputs
   contain only public IDs, measured pins, exact effects and verifier-match boolean.
5. On commit/file uncertainty keep original secret, fence and disabled configuration;
   read-only reconcile by the same operation. No retry/remint/rotation. Recovery may
   restore only those same proven original bytes with a new exact mandate/CAS.
6. DSH/TLS/source ACL/Binding/config/authentication/live round trip remain their own
   gates. Routine stop removes send only and preserves result/MCP/TLS/credential.

## Review artifacts

- New owning proposal:
  `/Users/yanfenma/workspace/project/auth-service-mcp-conversation-ccr-v1/docs/specs/AUTH_SERVICE_MCP_CONVERSATION_PILOT_SUPPLY_V1.md`
- `PROPOSED_REQUEST.schema.json`: closed discriminated request shapes; no filled IDs.
- `PROPOSED_SUPPLY_RECEIPT.schema.json`: safe success/NOOP receipt schema; no issued
  values and no credential bytes/hash.
- `DOCUMENT_VALIDATION.json`: structure/frontmatter/schema/coverage checks only,
  not semantic acceptance or implementation/runtime conformance.

Real missing items: accepted MCP audience and supply authorities; their source
implementations; actual generated MCP1.14 artifacts/digests; attributable original
transport config receipt/stable UUID; original Owner operation mandates; exact
fresh stop-serving/loaded-runtime/DB/OS permission+escrow readbacks; a safe supply
executor; dedicated principal/client/grant/credential/Binding; live credential
acceptance and actual round trip. None is represented as provisioned by these docs.
