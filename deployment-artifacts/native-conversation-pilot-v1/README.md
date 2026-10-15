# DSH_MCP_NATIVE_CONVERSATION_PILOT_V1 — fixed deployment packet (FROZEN, draft-config only)

```text
PACKET_ID                   = native-conversation-pilot-v1
GOVERNING_SPEC              = DSH_MCP_NATIVE_CONVERSATION_V1 r3 (accepted, in main @ 44da63d2)
MCP_SIDE_CONTRACT           = mayf3/dot-read-mcp docs/DSH_NATIVE_CONVERSATION_INTEGRATION_V1 (accepted)
EXECUTION_LINE              = agent-control #1156 (single line; original controller receipt sess_8fd7bbdd, 2026-10-15T16:11Z)
READY_FOR_PRODUCTION_PACKET = YES
READY_FOR_PRODUCTION_APPLY  = NO    (Owner production authorization required; see §8)
PRODUCTION_APPLY            = HOLD
PRODUCTION_MUTATION         = NO    (this freeze performed zero production mutation:
                                     no config file written, no Binding created, no
                                     auth-service resource/client/grant created, no
                                     launchd change, no restart, zero messages sent)
```

## 1. Installed baseline (生产实装哈希, fresh census 2026-10-16)

| Surface | Reading |
|---|---|
| Production runtime | launchd `gui/502/ai.agent-core.runtime`, pid 1329 (user yanfenma), running since 2026-10-01 19:34:27 +0800 |
| Program | `/Users/yanfenma/.agent-core/control/agent-core-runtime-glm53-wrapper.zsh` → `node scripts/production-runtime.mjs --root /Users/yanfenma/.agent-core` |
| Installed tree | `/Users/yanfenma/workspace/project/production-dsh-agent-core` @ git `549dacea95f918416dc06a534a21d8e16be5ce83` **plus uncommitted local overlay** (branch main, dirty) |
| Overlay census | 67 code files (24 modified tracked + 43 untracked code files incl. `packages/agent-router/src/process/`, `route-chain.js`, product-api history/voice/admission modules) + 1 tracked deletion (`packages/broker/test/capabilities.test.js`); `node_modules` excluded. Per-file sha256 frozen in `BASELINE_OVERLAY.sha256` (sha256 of the manifest = `081c59195ed8ed4b320e1ce6ae8338e1c5f18e16336185c675f1fc73530ff1e9`) |
| Runtime node | `/usr/local/libexec/agent-core/node-runtime/bin/node` = v25.6.1 (= `TARGET_PROXY_NODE_VERSION` in compose.js; the runtime guard rejects any other version) |
| product-api | loopback **127.0.0.1:8787** LISTEN (pid 1329) — pilot endpoint base. Existing extra surfaces: history listener `100.103.205.36:8789` (T48 overlay, untouched), notification ingress (own port, untouched) |
| Conversation state | ABSENT from the installed tree (pre-#512 base). The pilot slice is NOT loaded anywhere: `/v1/conversation/*` does not exist in pid 1329; no `native-conversation` state dirs under `~/.agent-core/control/` |

The system-level `ai.agent-core.runtime` (pid 43098, user authsvc, `/usr/local/libexec/agent-core/app`, stamp `d602b592`) is a separate runtime with its own root (`/Users/authsvc/.agent-core`); it does not serve 8787 and is out of scope for this packet.

## 2. Candidate (候选包哈希, exact coordinates)

| Binding | Value |
|---|---|
| BASE_MAIN (accepted conversation source) | `44da63d21987bf7115435f0767e7851b9022836a` (PR #512 merge; tree `071dce2d0134f722e19ae7f7b1d039e4e189dcd7`, re-verified via clean worktree at freeze) |
| CODE_CANDIDATE (deploy tree) | `bd8f74c4d8311e9093ec73ffa959b81ca2c25109`, tree `7e021c7e5b3403e20fa0e587f614d7da3cd8ae1d` — branch `native-conversation-pilot-v1-deploy` = BASE_MAIN + exactly one commit (entry seam, §3) |
| PACKET_COMMIT | the commit containing this packet (next commit on the same branch; exact HEAD/tree recorded in the #1156 backfill) |
| Candidate tree sha256 (deploy tree, tracked files) | computable from CODE_CANDIDATE tree hash `7e021c7e5b3403e20fa0e587f614d7da3cd8ae1d` (git tree-hash is the package identity; worktree-local node_modules is untracked and machine-local) |
| dot-read-mcp side | origin/main `90cc8ed` (docs-only rollback-guidance correction); deployed instance runs the byte-identical adapter (working tree 46cbba8; `git diff 46cbba8..90cc8ed` touches only `docs/NATIVE_CONVERSATION_PILOT_SOURCE.md`) |

Why a full-tree candidate and not an overlay of the #512 slice onto 549dace+overlay: the conversation implementation depends on post-549dace Router modularization (process/ split, route-chain, reconciliation store). The live tree carries a mid-September overlay state of those modules that does not match either 549dace or 44da63d2 (673-file tree delta live→candidate), so the slice cannot be cleanly overlaid; the minimum correct ship is the full CODE_CANDIDATE generation with preimage capture (RUNBOOK §P2).

## 3. Complete change scope (完整改动范围)

Already merged in BASE_MAIN (PR #512, 23 files +1299/−15 — runtime/Router/persistence child all included):

- `packages/product-api/src/conversation/*` — facade: auth.js (frozen CTR-NC-001 protocol: per-request Basic → HTTPS `/oauth/token` client_credentials, `resource=agent-core-mcp-conversation-v1`, `scope=conversation.access`, strict 200/bearer/expires check, no caching; single client, single target, `operations ⊆ {resolve,send,result}`), service.js (reserve/digest idempotency, exact-reply reconcile, result TTL, redaction), store.js, http.js (loopback-only, 1 MiB cap), protocol.js, native-proof.js, runtime.js (mount; `enabled !== true` → null)
- `packages/agent-router/src/conversation/*` — source.js (request-owned source retention child: per-request sha256-named 0600 files, 1 MiB visible-reply cap, pending→completed/failed/interrupted/unrecoverable/expired state machine), persistence.js (private atomic storage primitives), surface.js (`sendProductSurface`: re-verified dedicated Binding + main session, fence/admission/mint-capacity checks, zero Router-call bypass)
- Router/demo-server seams (`agent-router/src/index.js`, `process/turn-execution.js`, `demo-server/*`), compose.js wiring (`mountConversationRuntime` + `conversationSourceDir` passthrough), tests (pilot 335 lines, native-source-fault, route-chain seam/source)

Added by CODE_CANDIDATE (the only delta over BASE_MAIN, 2 files):

- `packages/production-runtime/src/entry.js` — `productApiCompositionFromEnv(env)`: composes `productApi.conversation={enabled:true,authConfigFile}` **only** when the supervision unit exports `PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE`; absent/empty env returns `{}` (byte-identical pre-pilot composition; CTR-NC-001 default-OFF preserved). A set path is validated per request by the facade's own 0600/directory checks — a bad file fails requests `NOT_PROVISIONED`, never boot.
- `packages/production-runtime/test/entry-conversation-env.test.js` — focused seam tests (4).

No other file differs from BASE_MAIN. Scheduler, production stores, old requests, UNKNOWN fences, EP49 records: untouched.

## 4. Actual ports (实际端口)

| Port | Surface | Status at freeze |
|---|---|---|
| 127.0.0.1:8787 | DSH product-api (pilot `/v1/conversation/{resolve,send,result}` base) | LISTEN (pid 1329); conversation routes absent until apply |
| 100.103.205.36:8789 | product-api history listener (T48 overlay) | existing, untouched by this packet |
| 127.0.0.1:8950 | dot-read-mcp MCP HTTP (launchd `com.mayf3.dot-read-mcp.v1`, pid 41660) | existing; native adapter present, disabled |
| 127.0.0.1:4001 | auth-service (user authsvc, pid 325) | **HTTP only — see §7 prerequisite** |
| 8933 | OpenAI tunnel-client health UI (owner terminal) | existing, untouched |

## 5. Identity mapping (身份映射)

| Role | Value | State |
|---|---|---|
| Pilot target canonical agent | `agt_build-in-public-agent` | VERIFIED (`~/.agent-core/agents.json`, `disabled:false`; registry note "imported from OpenClaw agent build-in-public-agent") |
| Existing surface Binding (unchanged, stays Feishu-owned) | `feishu:oc_95bd40ab17712fe0f3a7cf7eb6f4e24a` → activeAgentId `agt_build-in-public-agent`, activeSessionId `main` | VERIFIED (`~/.agent-core/bindings/bindings.json`, 109 bindings, all `feishu:`/`mobile:`; zero `mcp:` bindings) |
| BIP agent principal | `d5b3aeb2-e754-49a9-9914-b963521c0985` | VERIFIED by execution-line session sess_8fd7bbdd (read-only psql @2026-10-15T16:3xZ: active; re-verify at provisioning) |
| Legacy same-name principal | `bb9d8f48` (`build-in-public-agent`) | EXCLUDED — must not be referenced by any pilot config |
| DSH product-surface principal (config `clients[0].principal_id`) | Owner to pin at provisioning | DRAFT placeholder |
| Connector subject UUID (`subject_id` / MCP `connector_subject`) | Owner to pin at provisioning (same UUID both sides; MCP schema requires UUID) | DRAFT placeholder |
| Target `domain_id` | Owner to pin (BIP agent's workflow domain) | DRAFT placeholder |
| Communication scope id | `mcp-native-conversation-pilot-v1` (stable string; must never change across restarts/config revisions) | DRAFT (name proposed, Owner accepts) |

## 6. Dedicated Product Surface Binding — plan only (专用 Binding 方案，不创建)

- Binding id convention: `mcp:owner-prebound-pilot` (matches the accepted pilot source report placeholder). Created BY THE OWNER through the original Router flow into `~/.agent-core/bindings/bindings.json`; this packet does not create it.
- Binding MUST bind: channelConversationId `mcp:owner-prebound-pilot`, activeAgentId `agt_build-in-public-agent`, activeSessionId `main`. The facade/surface re-check `binding.activeAgentId === agent && binding.activeSessionId === 'main'` on every resolve/send and re-check after async workspace bootstrap; any movement rejects (`CONVERSATION_BINDING_INVALID`/`_CHANGED`, zero admission).
- The Feishu binding above is NOT reused and NOT modified (CTR-NC-002: dedicated Binding, separate from phone/other surfaces; Router remains sole owner; no target without Binding can send).
- MCP never passes surfaceId (adapter schema has no such field; strict zod rejects extras — validated §7).

## 7. New permission list — draft only (新增权限清单，不写授权)

Auth-service currently has NO `agent-core-mcp-conversation-v1` resource (verified read-only by execution-line session sess_8fd7bbdd; consistent with Spec "auth-service owning authority 接受并实际配置前保持 disabled"). To be provisioned by the Owner, exactly:

1. NEW resource `agent-core-mcp-conversation-v1` (does not reuse the Notification or agent-directory resources).
2. NEW scope `conversation.access` under that resource only.
3. ONE client (client_credentials grant), restricted to exactly that (resource, scope). Naming per MCP schema charset `[A-Za-z0-9._-]`. The secret is delivered ONLY into `~/.config/read-mcp/native-conversation.client.json` (0600); it never enters DSH config, logs, chat, or business records (DSH config stores clientId + mapping, never the secret).
4. Pilot operations granted: `resolve`, `send`, `result` (own-requests only). NOT granted: `read_agent_history`, `get_agent_message_events` (tools not registered in this slice), full-main history, fresh/archive sessions, cross-subject or cross-agent targets, any workflow write.
5. Notification resource/allowlist, svc-workflow `workflow.read`, and all existing grants unchanged.

**PREREQUISITE (specific missing item, blocks enablement — not resolvable by this packet):** CTR-NC-001 freezes "受信HTTPS auth-service" and `auth.js` hard-rejects non-https origins (`NOT_PROVISIONED`); the local auth-service is HTTP `http://127.0.0.1:4001` with no TLS front (tailscaled not running for a serve-front on this host). Before any enablement the Owner must provision a trusted HTTPS origin for auth-service (e.g., tailnet TLS front in front of 4001) and pin it as `authServiceOrigin`. Until then conversation stays disabled by construction.

## 8. Targeted isolated verification (针对性隔离验证，all executed at CODE_CANDIDATE)

Environment: candidate worktree `dsh-agent-core-pilot-deploy-v1`, production node binary v25.6.1, proxy env unset (repo runtime guard), machine-local test bridges (node_modules/@deepseek-ai/dsh-tools, @larksuite/channel — worktree-local, untracked). Zero production load, zero sends, no credential read.

| Check | Result |
|---|---|
| `node --test` conversation pilot + native-source-fault + route-chain conversation-runtime-seam + conversation-source + production-runtime compose regression + new entry seam tests | **38/38 pass** |
| DSH config schema (`validateConfig`): valid draft accepted; http origin / 2 clients / 2 targets / disabled → `NOT_PROVISIONED`; rollback shape (`operations:['resolve','result']`) accepted | **6/6** |
| MCP config schema (verbatim replica of module-private zod schemas @46cbba8): valid drafts accepted; non-loopback endpoint / https endpoint / extra key (strict) / secret with newline / bad client_id charset rejected | **7/7** |
| `verify-code-structure.mjs --base 44da63d2 --head bd8f74c4` | **zero new violations**: 11 violations / 106 warnings, byte-identical to base@44da63d2 (779→780 in-scope files = the one added test file); baseline violations pre-date this packet, registry/limits unchanged |
| Negative state census: `~/.config/read-mcp/` has no native-conversation files; binding store has zero `mcp:` bindings; auth-service lacks the resource; installed tree lacks the conversation slice | confirmed |

Remaining NOT_RUN (separate gates, never claimed here): production loading, live HTTPS auth verification, dedicated Binding creation, dot real roundtrip (ACC-001..003/007), EP49/UNKNOWN recovery path.

## 9. Rollback (回退) — explicit, result-preserving

Ordered from least to most invasive; every step preserves ALL original records (requests.json idempotency tombstones incl. UNKNOWN, source artifacts, result refs — never deleted; legal read grant still补取):

1. **Revoke send, keep result reads**: edit DSH `native-conversation.json` `clients[0].operations` from `["resolve","send","result"]` to `["resolve","result"]` (or `["result"]`) — next request fails `NO_ACCESS` 403 with zero target reads / zero Router calls (facade re-checks per call; no cache). MCP side stays `enabled:true`, untouched.
2. **Disable the adapter entirely**: remove `PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE` from the wrapper env + restart → every `/v1/conversation/*` returns `NOT_PROVISIONED`; storage under `~/.agent-core/control/native-conversation/` untouched.
3. **Code rollback**: revert CODE_CANDIDATE to the pre-pilot tree only with the adapter disabled (step 2 first); restore preimage captured in RUNBOOK §P2; never route old request keys through another entry/session; never clear UNKNOWN/EP49 records.
4. **Never** as rollback: delete client + both config files (destroys result reads), delete records to free capacity, re-send old numbers, or map old-generation cursors to new sessions (CTR-NC-009).

## 10. Approval checklist for the Owner (一次批准所需全部决定)

| # | Decision | Values |
|---|---|---|
| A1 | Provision HTTPS auth-service origin (§7 prerequisite) | Owner picks mechanism + pins `authServiceOrigin` |
| A2 | Pin connector subject UUID + DSH product-surface principal + target domain_id | fills the three DRAFT placeholders (§5) |
| A3 | Mint client + secret (§7 items 2–3), secret → MCP credential file only | client_id recorded in both configs |
| A4 | Create dedicated Binding via original Router flow (§6) | `mcp:owner-prebound-pilot` → agt_build-in-public-agent / main |
| A5 | Authorize production load: tree swap + wrapper env + restart (RUNBOOK) | one drain-gated restart of `gui/502/ai.agent-core.runtime` |
| A6 | Authorize first real send (single Agent, one new stable request; 原1135只读保留) | separate approval per CTR-NC-009 staging |

Until A1–A6 are separately approved: packet stays frozen, PRODUCTION_APPLY=HOLD, nothing in this packet writes to production.
