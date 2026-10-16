# Independent review of #1156 v2 auth/TLS/config surfaces

Reviewed 2026-10-16. This reviewer did not author or modify the reviewed files. Production writes, live credential requests, identity changes, service starts/restarts and business sends: NONE. Fixtures and evidence were written only below `/tmp/pilot1156-release/other-surfaces/`.

Final result: **PASS for these preparation surfaces after independent correction readback**. The three findings below were returned to the implementer, corrected by the implementer, and independently rechecked. No unresolved blocking implementation finding remains in these six reviewed surfaces. The auth audience/service-principal proposal is structurally compatible with the existing auth-v1 contract; it remains an owning CCR draft and does not authorize implementation or enablement. This is not a production-readiness result.

Final reviewed proxy SHA256: `3383006de6cbb60115319087790600e46c0eb342ef32af7fc5eca9540fae70bb`.

Final reviewed renderer SHA256: `95200b3d3c981b0e5af122ac36f5b09ef3313a1d1b91a6d1c584f2da51dedf18`.

## CLOSED finding 1 — derive the documented trusted proxy hop

Location: `tls/token-proxy.mjs` lines 25–27; `IDENTITY_AND_HTTPS.md`, recommended design item 5; `tls/token-proxy.test.mjs` forwarded-header expectation.

The design requires discarding caller forwarding headers and deriving a trusted one-hop forwarding identity. The implementation correctly discards untrusted `Forwarded`/XFF/cookies, but sends no `X-Forwarded-For` or `X-Forwarded-Proto` replacement. An independent recording upstream observed both headers absent. The current test explicitly expects `forwarded:null`, so it endorses the missing trusted-hop behavior.

This is observable with the existing auth-service configuration: `AUTH_TRUST_PROXY_HOPS=1`; auth-service `src/config/trust-proxy-hops.ts` lines 37–58 installs the degraded-identity alarm for requests lacking the edge-injected XFF. `src/server.ts` sets one-hop proxy trust. The new facade would trigger the missing-edge alarm and collapse rate-limit attribution to the socket loopback address. The review does **not** claim the missing header alone makes `/oauth/token` reject: current direct-token authorization does not depend on `req.secure`.

Required correction: derive a single XFF from this TLS socket's observed remote address and XFP from the actual HTTPS listener, keep the upstream Host selected by the fixed HTTP destination, and continue dropping all caller-provided forwarding/cookie headers. Extend the recording fixture to prove exactly this fixed hop and forged-header removal.

Evidence: `other-surfaces/proxy-wire-check.json`, original reviewed proxy SHA256 `5a0a8b5167b71564d9aaa8261d3a727eb92d5da232c332d6d4aefb270b29c89e`. No live auth-service request was made.

Correction independently verified: the final proxy derives XFF `127.0.0.1` from its TLS socket and XFP `https`; client-supplied `Forwarded` and cookies remain absent. Current evidence is `proxy-wire-check.json`; the original failure evidence is retained as `proxy-wire-check-before.json`. The implementation test now expects the trusted derived hop.

## CLOSED finding 2 — retain the frozen OAuth no-cache response header

Location: `tls/token-proxy.mjs` lines 9–12 and 34.

The proxy synthesizes `Content-Type` and `Cache-Control:no-store` while discarding the auth endpoint's `Pragma:no-cache`. The independent fixture upstream returned both cache headers, but the TLS client observed `pragma:null`. Existing auth-service `/oauth/token` sets both headers (`src/routes/oauth.ts`, token handler), `MACHINE_CLIENT_CREDENTIALS_V0.md` line 55 freezes both, and minimal-auth-v1 conformance requires the frozen OAuth status/error/cache headers.

Required correction: return `Pragma:no-cache` along with `Cache-Control:no-store` for token and error responses, and exercise the actual TLS response headers. This can be a fixed public response header; it requires no token parsing or arbitrary upstream-header forwarding.

The existing `no-store` response and lack of proxy logging are good protections; the finding is precise protocol preservation, not an assertion that a token was cached or disclosed.

Correction independently verified: the current isolated TLS response includes `Cache-Control:no-store` and `Pragma:no-cache`. Source readback also confirms the shared rejection helper and forwarded JSON response both set these headers. Auth-service's actual token-handler header lines are 70–71.

## CLOSED finding 3 — renderer permits output inside running source directories

Location: `scripts/render-configs.py` lines 35–40.

The script says it cannot write a production path, but its prefix blacklist covers the system app and home/config roots while omitting measured live source directories. Valid fixture input with `--output /Users/yanfenma/workspace/project/dot-read-mcp/__review_no_write__` or the corresponding child of `production-dsh-agent-core` reaches `out.mkdir`. These are the running MCP source directory and the historical GUI production checkout. The script would create a new directory and its draft files there. It does not overwrite an existing directory because `exist_ok=False`; nevertheless that is a production filesystem write contrary to the stated offline boundary.

Reproduction intercepted `Path.mkdir` before any actual write. Neither test path was created. The true `/usr/local/libexec/agent-core/app` control path was correctly rejected. Evidence: `other-surfaces/renderer-path-check.json` records the exact renderer hash and intercepted outcomes.

Required correction: confine outputs to a canonical independent offline/package generation root, or reject every measured runtime cwd/source as well as protected config directories. Preserve fresh-directory creation, no symlink ancestors, 0700 directory and 0600 JSON behavior. Ordinary macOS `/tmp` is a symlink to `/private/tmp`; canonicalizing the known temporary root avoids rejecting an otherwise safe offline output, without permitting an output to resolve into a production root.

Correction independently verified: output is now allowed only in a new descendant of `/Users/yanfenma/workspace/project/pilot1156-fixed-v2/generated-configs`; the allow-root itself is rejected. Repeated intercepted-first-write checks reject the live MCP repository, old GUI production tree, true system app and arbitrary temporary output. Only the fixed offline descendant reaches the write boundary, intercepted before mutation. Current evidence is `renderer-path-check.json`; original evidence is preserved as `renderer-path-check-before.json`.

## Auth-v1 and identity assessment

No contradictory service-principal requirement was found:

- auth-service `src/lib/oauth/v1/direct.ts` explicitly supports principalType `agent|service`, and rejects `service` when `agentId` is non-null. The draft's service principal with `agent_id=null` matches this profile.
- Actual audience-registry schema accepts the proposed wire ID, `scope_namespace=conversation`, scope `conversation.access`, accepted principal type `service`, machine-only direct grant and no human/delegated access.
- `authorizeV1DirectToken` looks up the generated audience before the client DB, then checks active principal/client, Basic credential, accepted profile, MachineAccessGrant and DB/runtime audience equality. The draft correctly identifies why a DB-only insertion cannot enable this audience.
- Current runtime version support ends at 1.12.0. The draft's conditional 1.13.0 owning delta expressly includes registry/manifest/schema/freeze/generated-runtime and runtime-supported-version changes; it does not claim a bundle already exists.
- The draft correctly separates the existing reader Agent, the BIP target Agent, original transport subject and new product caller principal, and requires an authenticated exact attestation rather than selecting an admin/display-name UUID.
- The new audience and identity/client/grant facts remain `implementation_authority:none` and `production_apply_authority:none` in this outside-repo application draft. Acceptance and a concrete auth artifact/reconciliation/load remain real gates. DSH r3 source acceptance does not grant auth-service implementation or provisioning authority.

Authoring clarification recommended: identify the new `connector_subject` explicitly as the persistent business-subject coordinate bound by the typed Auth attestation to the new service principal. Auth's existing canonical-subject model has `business_subject_id`, `subject_attestation_id`, typed target and source binding as distinct coordinates. Do not interchange their UUIDs. Likewise persist the plan's fixed `mcp-native-conversation-pilot-v1` communication scope rather than interpreting the CCR's word “generate” as rotating it. These are clarity items for the owning CCR; no live UUID was invented here.

## Trust, withdrawal and result retention assessment

The proposal specifies an exact HTTPS origin `https://127.0.0.1:4443`, CA-signed leaf with SAN IP:127.0.0.1/serverAuth, fixed certificate/key locations, a dedicated authsvc launchd service, TLS termination at the loopback facade and fixed forwarding to 127.0.0.1:4001. DSH Node trust uses its startup `NODE_EXTRA_CA_CERTS`; certificate verification is not disabled. Existing public/Tailscale services are not repurposed. The plist's deployed program path agrees with the written installation plan.

The TLS design and renderer initial-disabled configs remain preparation artifacts. Actual certificate issuance, protected service/config writes, trust adoption and exact original DS config effect are not performed or implied. Real positive/negative POST client_credentials through the same DSH Node/authsvc trust environment remains NOT_RUN and necessary before enablement.

Normal stop-send correctly retains TLS, auth credential/grant, MCP enabled and `result`, along with requests, source/results, tombstones and UNKNOWN. The text correctly calls TLS withdrawal/full client revocation a full disable that also prevents result authorization. It preserves record bytes and calls for exact plist/trust preimage restoration through the original owner; it does not promise result API availability when the reader/TLS is disabled.

The B7 e29 retained custody, unresolved original DS config fixed effect and source cross-UID issue are separate blockers tracked by the parent task. None is discharged by this review.

## Renderer and independent verification

The renderer did not create identities, issue credentials, authenticate a receipt, change Bindings, enable configs or output a client secret. In the initial isolated positive run, both JSON outputs were disabled and mode0600; the credential-delivery note was mode0600. After the output-root correction, an independent current-code run intercepted mkdir/write_text/chmod and confirmed the same disabled JSON bodies and explicit mode0600 calls without creating files outside this review's temporary directory. Test UUIDs were isolated fixture-only and are not proposed production identities. The renderer explicitly disclaims receipt authentication; any production consumption still requires the original executor to verify the owning signed/hash-bound receipt and unique mapping.

Independent commands/evidence:

```sh
/usr/local/libexec/agent-core/node-runtime/bin/node /tmp/pilot1156-release/other-surfaces/check-proxy-wire.mjs
```

- `proxy-wire-check-before.json`: original missing trusted hop/Pragma reproduced; zero production requests.
- `proxy-wire-check.json`: current real HTTPS fixture verifies derived trusted hop, forged-header removal and both cache headers; zero production requests.
- `renderer-path-check-before.json`: original intercepted-first-write defect; zero production writes.
- `renderer-path-check.json`: current fixed offline-root allowlist verified with six intercepted cases; zero production writes.
- `renderer-offline-check.json`: initial positive canonical temporary output, disabled JSON, mode0600, no secret field/output.
- `renderer-current-content-check.json`: current renderer bodies and mode calls verified with filesystem writes intercepted.

Reviewed files were not edited by this reviewer. The implementer's corrections were independently rechecked at the final hashes above. New changes after these hashes require their own relevant readback. Owning auth CCR/artifacts/attestation/provisioning, trusted TLS production load, real POST acceptance, original DS config effect, B7 custody and first business round trip remain separate unresolved production gates. This report does not claim enable-ready or production acceptance.
