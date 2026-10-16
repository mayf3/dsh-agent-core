# #1156 identity, runtime and HTTPS preparation

Status: read-only evidence plus a proposed activation design. Checked 2026-10-16 UTC. No production source/config/Binding/identity/client/grant changes, no TLS service installed, no OAuth credential POST performed and no business send. Safe evidence files contain no credentials or tokens.

## Correct runtime and endpoints

The original BIP execution line is the system runtime, not the older process on 8787. Parent closure independently correlated BIP PID 67280 to parent PID 43098. This investigation verified the parent listener, supervision unit and persistent root:

| Purpose | Current fact |
|---|---|
| Original runtime | system `ai.agent-core.runtime`, PID 43098, runs as `authsvc` |
| Runtime executable | `/usr/local/libexec/agent-core/node-runtime/bin/node` v25.6.1 |
| Runtime app | `/usr/local/libexec/agent-core/app` |
| Runtime root | `/Users/authsvc/.agent-core` |
| Product API | `http://127.0.0.1:8788` (PID 43098 actual listener; launchd `PRODUCT_API_PORT=8788`) |
| Notification | `127.0.0.1:8790` (same PID) |
| MCP | `127.0.0.1:8950`, PID 41660, `/Users/yanfenma/workspace/project/dot-read-mcp` |
| auth-service | `127.0.0.1:4001`, PID 325, runs as `authsvc`; read-only GET `/api/health` returned 200 |
| Old user runtime | PID 1329, `/Users/yanfenma/.agent-core`, product API 8787; do not route this pilot here |
| Scheduler-v2 | PID 1328, `/Users/yanfenma/.agent-core-scheduler-v2`, notification 8795; its agent registry has one non-BIP agent |

Therefore the MCP proposal must use `endpoint=http://127.0.0.1:8788`. The caller is the existing MCP service user `yanfenma`; the target facade, trusted auth lookup and native journal belong to the system `authsvc` runtime. Files under the old user root cannot prove the original BIP line is ready.

## Target identity and domain

The active auth-service DB has exactly one canonical `agent_id=agt_build-in-public-agent` row: principal `d5b3aeb2-e754-49a9-9914-b963521c0985`, status active, principal type agent, external ref `agentcore:v1:principal:agt_build-in-public-agent`, owner_user_id null. The system registry has the same canonical agent enabled (`disabled=false`). The ownerless principal does not establish a human caller.

The old same-display-name principal `bb9d8f48-7962-4321-8fb1-554bb428c159` is also still active, but its canonical agent_id is `build-in-public-agent` and external ref `openclaw:agent:build-in-public-agent`. It is a distinct identity and must not be used.

The actual svc-workflow process uses `/Users/yanfenma/.local/services/svc-workflow/.env` and database `svc_workflow_dogfood_clean`. The source checkout `.env` points at a different database and was excluded from the final domain evidence. In the active DB, principal d5b3... is enabled AGENT and has one enabled DOMAIN_OWNER role:

`domain_id=f9b5682c-1c9c-5ace-a7b1-01b9a3be5965`, `domain_key=build-in-public-dogfood`, display name `Build in Public Dogfood`, domain enabled.

This business-domain name plus the unique BIP DOMAIN_OWNER role is the concrete basis for choosing that domain for the blog pilot. It is not a claim that an Agent has only one domain: eight other enabled domain bindings are DOMAIN_MEMBER (workflow-todo-dogfood, adc-v2-dogfood, knowledge-curation, okr-dogfood, game-dev, commercial-exploration-dogfood, journal-submission, hr-onboarding). Their IDs and roles are in `workflow-domain-safe.json`. This does not identify a specific publishing workflow instance or grant the caller Workflow write/read expansion.

## Connector and product caller identity

`connector_subject = NOT_ESTABLISHED`. Current MCP HTTP transport validates one server-owned shared secret and yields `authenticatedTransport=true`. It has no stored authenticated subject UUID. Both `~/.config/read-mcp/native-conversation.json` and `native-conversation.client.json` are absent. `caller-token` is opaque and was not displayed.

The existing workflow reader client is `mc_2FQPUAenQVavCaNN2PqC4Wnh`, active, bound to active machine principal `7711a8ed-c538-488b-b569-dcb1253adad8` (`agent_id=dot-read-mcp-reader`, type agent, owner_user_id null). It permits only `resource=svc-workflow`, `scope=workflow.read`. That is an existing reader identity, not proof of the original connector's product caller or permission to communicate. Its credential must not be reused.

No current MCP canonical-subject source binding, no canonical-subject attestation for the reader/target, no matching dedicated product-surface principal, no conversation client and no conversation audience were found by narrow read-only queries. These are scoped absence findings, not claims that the database has no other identities. No existing human UUID can safely be selected from admin/display-name matches.

Recommended identity creation is defined in `AUTH_CCR_DRAFT.md`: one attested connector identity for this original HTTP transport, one separate service/product principal, one dedicated machine client, one audience/grant, one fixed subject/principal/client mapping. UUIDs and client ID are generated by the approved owning operation and read back into a signed/hash-bound non-secret receipt, then rendered automatically into configurations. No UUID is fabricated and the user is not asked to fill a technical placeholder. If transport ownership cannot be attested, provisioning stops with NOT_ESTABLISHED and configurations remain disabled.

## Binding

System `/Users/authsvc/.agent-core/bindings/bindings.json` has 110 Bindings: 90 feishu, 20 mobile, zero mcp. BIP has exactly one current Binding:

`feishu:oc_95bd40ab17712fe0f3a7cf7eb6f4e24a` -> `agt_build-in-public-agent` / `main`, workspace null, updated 2026-10-08T08:41:42.246Z.

It must remain Feishu-owned. The approved Router operation should create only dedicated `mcp:dot-native-conversation-pilot-v1` -> the same canonical BIP / original main in the system root. Creation must use the original Router/supervision lane and preserve all existing rows, sessions and fences. This investigation did not create it. Readback must verify the exact Binding and current main generation; a missing/moved target remains fail-closed.

## Existing HTTPS capabilities and their limits

`auth.mayf3.com` currently has no resolvable DNS record from this host. A normal trusted HTTPS request failed DNS. A diagnostic connection with SNI `auth.mayf3.com` forced to the existing Aliyun host 8.163.44.127 failed certificate verification with self-signed-certificate error; certificate verification was not disabled.

The Aliyun host has nginx 1.24.0 and certbot with an enabled/active certbot.timer. A live remote-forward listener exists on 127.0.0.1:18794; the existing Mac system unit `com.agentcore.auth-tunnel` forwards it to Mac 127.0.0.1:4001. However the dedicated auth SNI block is under `/etc/nginx/disabled-window-pause/auth-hosting.conf`, not the loaded nginx config, and names `/etc/nginx/ssl/auth.shadow-selfsigned.pem`. Loaded nginx has only the default 443 site using `/etc/nginx/ssl/server.crt`; no loaded auth SNI block. The existing Let's Encrypt certificate at `/etc/letsencrypt/live/mayf3.com/fullchain.pem` is valid 2026-08-21 through 2026-11-19 and has only SAN `mayf3.com`. It cannot authenticate `auth.mayf3.com`.

Local Tailscale HTTPS already listens on tailnet IPv4/IPv6 443 and 8443. Its Serve configuration is `macbook-pro.tail84dd3d.ts.net:443` -> 127.0.0.1:3082 and `:8443` -> 127.0.0.1:4319. Neither is auth-service. Those services must not be repurposed for this pilot. The correct read-only CLI is `tailscale --socket=/var/run/tailscaled.sock serve status --json`.

## Recommended HTTPS origin and precise changes

Choose `authServiceOrigin=https://127.0.0.1:4443`. The exact loopback port 4443 was free in a privileged all-user listener check. Recheck immediately before an approved load. A local TLS facade avoids DNS, public hosting and unrelated existing TLS services. It must remain a dedicated auth lookup facade, not a second auth-service.

1. The root-owned launchd unit `/Library/LaunchDaemons/com.agentcore.native-auth-tls.plist` runs as `authsvc`, using `/usr/local/libexec/agent-core/node-runtime/bin/node /usr/local/libexec/agent-core-native-auth-tls/proxy.mjs`. It listens only on 127.0.0.1:4443 and forwards only exact `POST /oauth/token` to existing HTTP auth-service 127.0.0.1:4001. All other paths/methods are rejected before upstream. It performs no OAuth business logic, retries, token/credential caching or fallback.
2. Issue an approved dedicated local CA and a leaf certificate with extendedKeyUsage=serverAuth and SAN IP:127.0.0.1. Trust the CA, not a self-signed leaf. Root CA private key lives only in a root-owned 0700 issuance directory; proxy gets only its leaf key/cert. No key is generated in this preparation. This is a separate private loopback design; it does not activate or modify the public `auth.mayf3.com` hosting contract.
3. Fixed configuration directory `/usr/local/etc/agent-core-native-auth-tls`: public `ca.crt` and `server.crt`, server key `server.key` mode0600 authsvc, directory0750 root:authsvc. Source/app directory is root-owned and not writable by the service. No credential is stored there.
4. Add only `NODE_EXTRA_CA_CERTS=/usr/local/etc/agent-core-native-auth-tls/ca.crt` to the original **system** DSH runtime unit. The current system unit has no NODE_EXTRA_CA_CERTS. Node reads this setting at process startup, so the original governed DSH load is required. Preserve existing BROKER_AUTH_ORIGIN and unrelated machine credentials; only native conversation's config chooses the new HTTPS origin. Never set NODE_TLS_REJECT_UNAUTHORIZED=0.
5. Fixed forwarding headers: preserve only Authorization, Content-Type and Accept required by client_credentials; derive the upstream Host and trusted one-hop forwarding headers, never append client XFF or forward arbitrary caller headers/cookies. The existing auth-service unit has AUTH_HTTP_BIND_HOST=127.0.0.1 and AUTH_TRUST_PROXY_HOPS=1. The facade must not log request URLs, headers, bodies, credential values, response bodies or access tokens. Log only bounded status/error categories.
6. Required approved production writes: install TLS facade app/plist; issue and protect certificates; start that unit; amend system runtime's public CA path; load DSH candidate via its original release process; create the explicitly listed auth audience/principal/client/grant and dedicated Binding; place MCP credential directly in its0600 file. These approvals do not follow automatically from accepted DSH source authority.

Parent is preparing the concrete TLS proxy source and fixtures. This report recommends the fixed interface and operational boundary, not an already-installed service.

## Verification and withdrawal

Before approval, use generated throwaway fixture CA/leaf and an isolated recording HTTP upstream to exercise actual HTTPS Node fetch, SAN/trust failure, exact path/method rejection, Basic/header transit, no upstream retry, timeout, cap, no credential/token logs and removal of untrusted forwarding fields. No live client_credentials request is needed for preparation.

After the separate runtime/permission approval, the owning executor must:

- Check all fixed preimages and port4443 availability, install/start the facade, verify owner/mode and bind-only127.0.0.1. A wrong CA or hostname/IP must fail.
- From the **same DSH Node executable and authsvc trust configuration**, POST form `grant_type=client_credentials&resource=agent-core-mcp-conversation-v1&scope=conversation.access` with the dedicated Basic credential read from its approved private file; never place a secret in argv or print token/body. Require 200, Bearer, positive integer expires_in, expected scope, cache-control=no-store and a nonempty token; record only booleans/status and public identity/contract pins.
- Run wrong client/secret/resource/scope, ungranted/revoked client and TLS-unavailable controls through the DSH adapter. These must give401/403/503 with zero target read/Router calls as appropriate. A GET/health/JWKS success cannot pass this auth acceptance.
- Verify the exact system runtime, original BIP identity/domain/Binding and MCP subject mapping before any separately approved resolve/send/result pilot.

Normal stop-send removes `send` from DSH's client operations and leaves resolve/result and MCP enabled. Preserve all request/source/result records, UNKNOWN, idempotency tombstones and original IDs. Do not revoke the complete client/grant or stop TLS for this routine stop, because those also prevent result authentication.

Full TLS withdrawal is a separate full-disable operation: first disable all native calls or announce/readback that result reads will fail, then stop only `com.agentcore.native-auth-tls`, restore the captured system runtime plist bytes/metadata (including its previous absence of NODE_EXTRA_CA_CERTS) via the original release procedure, verify no4443 listener and that4001/auth-service and unrelated TLS services are unchanged. Keep request/source/result storage. Remove leaf private material only after the approved retention/rollback policy allows it; never remove unrelated CA/certificates. Preserve actual preimage bytes and metadata, not only hashes.

## Real outstanding gates

1. The original connector subject and caller/product-principal ownership have no current attestation or unique mapping.
2. The system runtime has no dedicated MCP Binding.
3. No trusted auth HTTPS origin currently serves the required interface; local facade/cert/CA trust are a concrete proposal, not deployed.
4. Auth-service v1 contract1.12.0 has no `agent-core-mcp-conversation-v1` audience in either generated runtime snapshot or DB. The runtime rejects an unknown audience before client lookup. A DB row alone is insufficient; owning accepted CCR, frozen bundle/runtime source delta, guarded DB reconciliation and auth-service release are required.
5. No dedicated client/grant/secret exists and live POST client_credentials, production DSH load and dot round trip are NOT_RUN.

## Safe evidence

- `runtime-safe.json`: supervision/roots, system registry/Binding exact hashes, auth runtime-contract pins.
- `auth-db-safe.json`: narrow active identity/client/audience/attestation queries, all inside read-only transaction.
- `workflow-domain-safe.json`: live workflow principal and domain-role query, read-only transaction.
- `AUTH_CCR_DRAFT.md`: owning-authority application design, not an accepted contract or production authorization.

System registry SHA256: `e0800b0fde6fc46b2873decd0f83c9b807b48b56cc3c9ad9cf578a5685b5b6fe`.

System Binding SHA256: `eb1a7382cb7f99c5be9ade1315e588a97ed36ce9bbc6bada9e08078becdd2f2d`.

Auth generated runtime file SHA256: `3b9f744c0c317c9c38470d26c6778794e1b85ab1575ec74affea2c3cbcf4f1d5`, runtimeDigest `131105f186688f6020aa3bae56f551ca1762b2a2cd31c29d07e97e7a4244e212`, source bundle digest `b499ac82cfecc34ed181161f1e642c0497f3f780b8c4e7b91af307a55ffb6a80`, reviewed source commit `02bccd428554868125a65800f1334928c80543a2`.
