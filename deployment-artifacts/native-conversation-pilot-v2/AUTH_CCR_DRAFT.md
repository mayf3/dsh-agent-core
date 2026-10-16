---
spec_id: AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1
status: draft
authority_level: application_draft_only
implementation_authority: none
production_apply_authority: none
date: 2026-10-16
---

# Auth-service owning CCR request for #1156

This is a fixed owning-authority application draft prepared outside the auth repository. It does not amend accepted contracts, authorize production identity/permission writes or make a new audience usable. DSH accepted source authority and an Owner's config approval are distinct from auth-service accepting/fixing its versioned contract.

## Requested immutable audience

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
  "freeze_ready": true
}
```

Protocol is exactly HTTPS POST `/oauth/token`, Basic client_secret authentication, `Content-Type: application/x-www-form-urlencoded`, form `grant_type=client_credentials&resource=agent-core-mcp-conversation-v1&scope=conversation.access`. No Notification/Workflow resource alias, Agent credential, token exchange or delegated grant. Token/secret are never returned to a model, logged or included in business persistence. DSH performs this online check each call and caches neither credential nor authorization result.

The token audience grants access only to the native conversation facade. DSH separately pins one client→one connector subject→one product principal→one communication scope→one BIP target, allowed operations resolve/send/result and own request/result only. It does not grant Workflow reads/writes, all-main history, events/history endpoints or a second routing line.

## Exact runtime precondition and required bundle delta

Measured active baseline is AUTH_CONTRACT_MODE=v1, bundle/registry1.12.0 and generated runtimeDigest `131105f186688f6020aa3bae56f551ca1762b2a2cd31c29d07e97e7a4244e212`. There are12 audiences and zero conversation entries. Source `authorizeV1DirectToken` finds the audience in the generated runtime contract before consulting the client DB; unknown audience produces invalid_target. Therefore adding a DB audience/client/grant alone cannot close this gate.

Propose the next contract/registry version **1.13.0**, conditional on no intervening accepted version. This number is an application target, not a claim that a bundle exists or is frozen. If1.12.0 preimage is no longer exact, stop and reconcile the owning delta instead of overwriting it. Owning implementation after acceptance must update the audience registry, linked manifest/freeze metadata/schema version enumerations, generated runtime snapshot and runtime version support; build and test the generated artifact consumed from the active service cwd. Pin source commit/tree, bundle digest, generated runtime digest, artifact hashes and targeted positive/negative conformance before seeking auth production loading approval.

The accepted CCR should preserve every existing audience byte-for-byte except necessary version linkage and the one additive entry. Its implementation must not modify its own accepted governing Spec. A separately reviewed versioned production reconciliation must compare expected audience preimage/version, apply only this audience fact plus the exact approved identity/client/grant facts, write same-transaction audit and fail closed on drift. No ad-hoc DB insertion.

## Provisioning and unique mapping without fabricated UUIDs

Measured existing data does **not** establish an original connector_subject or usable product principal. The reader Agent principal7711... and BIP d5b3... must not be adopted as the caller.

Approved owning execution should perform these dependent steps, without user-entered UUIDs:

1. Attest the single original HTTP transport as the Owner-managed `dot-read-mcp` connector running as yanfenma at127.0.0.1:8950, using its existing server-side transport secret reference as an evidence reference only. Never copy that secret. Record the authorized human/operator by the original identity authority; if no authenticated attestor is available, fail NOT_ESTABLISHED. A display name/admin-role match is insufficient.
2. Generate a stable connector subject UUID by the owning identity operation and persist the exact source→subject attestation/reference. It identifies the one original connector transport, not a caller-provided header. Do not rotate the original transport secret or change the connector entry point as part of this step.
3. Create exactly one service-type machine/product-surface principal, `agent_id=null`, external_ref `dot-read-mcp-native-conversation-pilot-v1`, display name `dot native conversation pilot v1`. Bind its business subject/ownership to the same attestation. Store the generated principal UUID as the product principal. No Agent impersonation, delegated human token, Notification client or Workflow reader credential.
4. Create exactly one dedicated active machine client for that new service principal, external_ref `dot-read-mcp-native-conversation-pilot-v1`, allowedResources exactly[`agent-core-mcp-conversation-v1`], allowedScopes exactly[`conversation.access`]. Generate client ID/secret in the owning secure operation. Create exactly one MachineAccessGrant to that audience, scopes exactly[`conversation.access`], version1. No existing grants are widened. Secret is delivered directly only into `/Users/yanfenma/.config/read-mcp/native-conversation.client.json`, regular nonsymlink current-MCP-user-owned mode0600; no secret response is sent through a model/chat/receipt.
5. Generate the stable communication_scope_id once and persist it with the mapping. Use the same value across ordinary configuration revision or process restart. Do not regenerate it for retries.
6. Produce a non-secret receipt with generated connector_subject, product principal ID, client ID, communication_scope_id, attestation/source-binding refs, audience/bundle/runtime pins, exact target agent/principal/domain, Binding ID and routing_version. Verify uniqueness and ownership by readback before automatically rendering DSH and MCP JSON. Configuration generation must consume this receipt, not prompt the user for values.

The selected target is canonical `agt_build-in-public-agent`, active principal `d5b3aeb2-e754-49a9-9914-b963521c0985`, business domain `f9b5682c-1c9c-5ace-a7b1-01b9a3be5965` (build-in-public-dogfood DOMAIN_OWNER). Dedicated Binding proposal is `mcp:dot-native-conversation-pilot-v1` to BIP/main in `/Users/authsvc/.agent-core`, endpoint `http://127.0.0.1:8788`. Creating that Binding belongs to the original Router lane, not this auth migration.

## Operating and revocation semantics

Native DSH configuration starts disabled. After all signed/hash-bound identity/TLS/auth/Binding readbacks pass, production load/enable and the first real round trip require their separate approval. Enabling source/config alone is not business acceptance.

Normal stop-send changes only DSH operations from[`resolve`,`send`,`result`] to[`resolve`,`result`]. Keep auth credential/grant and TLS available, MCP enabled and all original request/source/result/UNKNOWN/tombstone data. This preserves authenticated original-result retrieval. Full client revocation/audience disable stops result access too and must be described as full disable, not normal stop-send. Revocation must fail the next online DSH authorization call, with no authorization cache.

## Required evidence before production acceptance

- Source contract and generated bundle agree on1.13.0 and this exact audience; all other audience contracts preserved. A DB-only row and a health response cannot pass.
- Targeted owning conformance: service principal positive; agent/human/wrong profile negative; exact scope/resource required; wrong/missing/revoked credential/grant rejected; mismatched DB/runtime registry fails closed; no token/secret logging.
- Preimage/version/approval/audit/replay checks on the bounded audience+principal+client+grant operation. Repeated approved operation must read back its one existing result or fail conflict; never mint a second client/mapping on an unknown outcome.
- Actual DSH Node+authsvc environment verifies trusted TLS and real POST client_credentials with the dedicated credential. Record safe response-shape booleans/public identity pins, never token bytes.
- Cross-subject/unmapped client, wrong target/domain/principal/Binding and removed-send controls yield zero target reads/Router admissions. Own result remains authorized after normal stop-send.
- Load/rollback through original auth-service and DSH release owners. Preserve previous source/runtime bytes, plist/CA trust preimage and all business state. Newly granted permission rollback uses owning revocation/audit; no deletion of historical business records.

## Approval separation

A. Auth-service owning authority accepts the CCR and allows its bounded source/bundle implementation. This draft alone grants no such authority.

B. After concrete auth artifacts and conformance exist, Owner separately approves the exact auth runtime load, versioned audience reconciliation, identity/client/grant/attestation and safe credential-file delivery.

C. Original DSH owner separately approves fixed DSH/TLS load, its dedicated Binding and exact enable configuration. New TLS CA/trust/service changes are explicitly included, not implicit.

D. First real resolve/send/result business round trip remains a separate permission/acceptance stage. None was performed in this preparation.
