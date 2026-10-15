# RUNBOOK — native-conversation-pilot-v1 (PREPARED / ALL APPLY STEPS ON HOLD)

Every step below requires the Owner approvals A1–A6 (README §10). Nothing here has been executed against production.

## P0. Preconditions (verify, do not assume)

- [ ] A1 done: HTTPS auth-service origin reachable from the DSH runtime (`curl -s <origin>/oauth/token` fails closed only on credentials, not on TLS). `auth.js` rejects http/origin-with-path — the pilot cannot enable without this.
- [ ] A2 done: connector subject UUID, DSH product-surface principal, target `domain_id` pinned.
- [ ] A3 done: client minted (client_credentials, only `agent-core-mcp-conversation-v1`/`conversation.access`); secret written ONLY to `~/.config/read-mcp/native-conversation.client.json` (0600, owner-only dir).
- [ ] A4 done: dedicated Binding `mcp:owner-prebound-pilot` exists in `~/.agent-core/bindings/bindings.json` with `activeAgentId=agt_build-in-public-agent`, `activeSessionId=main` (created via the original Router flow, not hand-edited).
- [ ] Baseline census re-run (§1 of README) — if the installed tree/wrapper changed since 2026-10-16, REFREEZE before applying.

## P1. Draft configs (templates in `draft/`; fill placeholders; never commit real secrets)

DSH side (target `~/.agent-core/config/native-conversation.json`, 0600, dir must be owner-only non-symlink — the facade refuses otherwise and fails every request `NOT_PROVISIONED`):

```json
{
  "enabled": true,
  "authServiceOrigin": "<A1 HTTPS origin>",
  "retentionMs": 604800000,
  "maxRecords": 1000,
  "clients": [{
    "clientId": "<A3 client_id>",
    "subject_id": "<A2 connector subject UUID>",
    "communication_scope_id": "mcp-native-conversation-pilot-v1",
    "principal_id": "<A2 DSH product-surface principal>",
    "operations": ["resolve", "send", "result"],
    "targets": [{
      "agent_id": "agt_build-in-public-agent",
      "principal_id": "d5b3aeb2-e754-49a9-9914-b963521c0985",
      "domain_id": "<A2 domain_id>",
      "binding_id": "mcp:owner-prebound-pilot",
      "routing_version": "1"
    }]
  }]
}
```

`retentionMs` (7 days) and `maxRecords` (1000) are the proposed pilot values; at RESOURCE_LIMIT the store rejects NEW keys and never evicts unknown records. Result TTL = retentionMs from first result commit; expiry is explicit (`RESULT_EXPIRED`) and tombstones stay.

MCP side (targets `~/.config/read-mcp/native-conversation.json` + `native-conversation.client.json`, both 0600, ≤16 KiB, no symlinks):

```json
{ "enabled": true, "connector_subject": "<A2 connector subject UUID — identical to DSH subject_id>",
  "endpoint": "http://127.0.0.1:8787", "credential_file": "native-conversation.client.json" }
```

```json
{ "connector_subject": "<same UUID>", "client_id": "<A3 client_id>", "client_secret": "<A3 secret>" }
```

The MCP adapter stays fail-closed until BOTH files exist and the subjects match (`subject_mismatch` otherwise). Tools still surface NOT_PROVISIONED errors before DSH load — expected.

## P2. Preimage capture (mandatory before tree swap)

```bash
cd /Users/yanfenma/workspace/project/production-dsh-agent-core
git rev-parse HEAD            # expect 549dacea… (or re-frozen value)
git status --porcelain | grep -v '^?? node_modules' > /tmp/pilot-preimage-status.txt
# file-level sha256 of every dirty/untracked code file (the deployed overlay is NOT reproducible from HEAD alone)
git status --porcelain | grep -v '^?? node_modules' | awk '{print substr($0,4)}' | while read -r f; do [ -f "$f" ] && shasum -a 256 "$f"; done > /tmp/pilot-preimage.sha256
# archive the full dirty tree (code only) for byte-exact rollback
tar czf ~/agent-core-backups/pre-pilot-native-conversation-$(date +%Y%m%dT%H%M%S).tar.gz \
  --exclude=node_modules --exclude=.git .
shasum -a 256 ~/agent-core-backups/pre-pilot-native-conversation-*.tar.gz | tee /tmp/pilot-preimage-archive.sha256
```

The declared commit alone is NOT a rollback artifact for this runtime (historical in-place overlays); only the captured bytes are.

## P3. Generation swap (wrapper runtime, ONE drain-gated restart)

1. Confirm no in-flight Router turns (original restart-quiescence surface): the runtime's own drain observation must show quiesced before cutover. If the drain surface reports non-quiesced, STOP — do not force.
2. In the production tree: `git fetch origin && git checkout native-conversation-pilot-v1-deploy` pinned at CODE_CANDIDATE `bd8f74c4d8311e9093ec73ffa959b81ca2c25109` (detached or branch at exactly that SHA; record `git rev-parse HEAD^{tree}` = `7e021c7e5b3403e20fa0e587f614d7da3cd8ae1d`).
3. `npm install --no-audit --no-fund` + worktree-local machine bridges (`@deepseek-ai/dsh-tools`, `@larksuite/channel` symlinks as in the candidate worktree).
4. Add ONE line to `/Users/yanfenma/.agent-core/control/agent-core-runtime-glm53-wrapper.zsh` (next to the existing PRODUCT_API_* exports):
   `export PRODUCT_API_CONVERSATION_AUTH_CONFIG_FILE="/Users/yanfenma/.agent-core/config/native-conversation.json"`
5. Restart: `launchctl kickstart -k gui/502/ai.agent-core.runtime` (single restart; keepalive re-spawns the wrapper).
6. Readback (metadata only): wrapper log shows clean boot; `lsof -nP -iTCP:8787 -sTCP:LISTEN` (new pid); `curl -s -X POST http://127.0.0.1:8787/v1/conversation/resolve -H 'Authorization: Basic wrong' -d '{}'` → HTTP 401 `INVALID_CREDENTIAL` envelope with `contract_version=native-conversation-v1` (proves the mount is live and fail-closed); `POST /v1/conversation/send` with a valid-looking body but the MCP credential NOT yet pointed here → 401/403 family, zero Router calls.
7. dot side (A6 gate, separate): connector re-discovery (tools/list), then ONE new stable request end-to-end. 原1135只读保留. No EP49/old-UNKNOWN resend.

## P4. Post-apply census

- `/Users/yanfenma/.agent-core/control/native-conversation/requests.json` created only after the first admission (before that, absent = correct).
- Config file stays 0600 owner-only (facade re-validates per request; a chmod drift fails every call NOT_PROVISIONED — that is the designed failure, not an outage).
- First result: `reply_status` must become `available` only with a readable body/ref from the retained source (never hash-only).

## R. Rollback (README §9; ordered, record-preserving)

1. Send-revoke, reads intact: DSH config `operations` → `["resolve","result"]` (or `["result"]`). Next send → `NO_ACCESS` 403. MCP stays enabled. No restart needed (config is loaded fresh per request).
2. Adapter off: remove the wrapper env line + `launchctl kickstart -k gui/502/ai.agent-core.runtime`. All `/v1/conversation/*` → `NOT_PROVISIONED`. Storage dirs untouched.
3. Tree rollback: only after step 2 — restore P2 preimage (tar or checkout `549dacea` + re-apply overlay from `/tmp/pilot-preimage.sha256`), re-install deps + bridges, remove env line, restart. Never route old keys through another entry/session; never clear UNKNOWN/EP49 records; never delete client+configs as "rollback".
4. MCP side: no rollback needed for 1–2 (it stays enabled and keeps surfacing NOT_PROVISIONED); if the Owner separately decides to hide the tools, that is a dot-read-mcp deployment decision, not part of this packet.
