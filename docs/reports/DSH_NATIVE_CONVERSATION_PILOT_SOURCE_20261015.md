# Native conversation pilot — source candidate, 2026-10-15

Authority: accepted `DSH_MCP_NATIVE_CONVERSATION_V1` r3, main `37880d9c03ef0d2ed16e6b93cd4ff0b565c6bf53`. Owner's 2026-10-15 mandate authorizes this isolated source implementation only. Production loading, permission/config provisioning and real Agent sends are NOT_RUN. EP49 and UNKNOWN records were not replayed.

## Implemented slice

`POST /v1/conversation/resolve`, `/send`, `/result` return direct JSON with `contract_version=native-conversation-v1`. Default OFF, loopback callers only. Workflow resolution, fresh/archive selection, reply_to, nonempty workflow_refs, general history and events are explicitly unsupported in this slice.

Composition passes `productApi.conversation={enabled:true,authConfigFile:<absolute private path>}` to the new runtime mount. This is a future configuration contract, not a provisioning operation. No environment secret or runtime credential is read during source tests. Config is loaded afresh on every request from a regular owner-only 0600 file in an owner-only directory:

```json
{
  "enabled": true,
  "authServiceOrigin": "https://approved-auth-origin.example",
  "retentionMs": 604800000,
  "maxRecords": 1000,
  "clients": [{
    "clientId": "dedicated-mcp-client",
    "subject_id": "original-connector-subject",
    "communication_scope_id": "stable-approved-pilot-scope",
    "principal_id": "approved-product-principal",
    "operations": ["resolve", "send", "result"],
    "targets": [{
      "agent_id": "agt_verified-business-agent",
      "principal_id": "verified-agent-principal",
      "domain_id": "approved-domain",
      "binding_id": "mcp:owner-prebound-pilot",
      "routing_version": "1"
    }]
  }]
}
```

Only one client and one target are admitted by this pilot. These placeholders do not create identities, grants or Bindings. The original auth-service must separately accept/configure the resource `agent-core-mcp-conversation-v1` and scope `conversation.access`. Each request performs the fixed HTTPS client_credentials verification; token responses are discarded, not cached or persisted. Verified clientId selects the server-owned subject/scope/principal mapping. A handle never supplies authorization.

The Router owns the new Product Surface seam. It verifies the existing dedicated Binding and exact Agent, resolves its existing workspace, uses the original admission chain/queue/fence, and holds the human surface context through the receipt-only turn lifetime. It never auto-switches or creates a Binding. Child startup must report source-retention protocol v1; unsupported children reject before prompt bytes.

The demo-server reserves a request-owned source artifact before `followup`, then durably retains matching native user/turn/visible-assistant/terminal facts before emitting those native events to the parent. Its generation derives from the canonical immutable session header, separately from process generation. The Router's formal source reader accepts trusted request/Agent coordinates, never model paths/session IDs. Replies are redacted before the facade result is durably committed. Original assistant IDs remain unknown if absent; the separate stable projection namespace is explicit. The result store keys subject/scope/request_id, retains idempotency tombstones, and rejects new reservations at capacity. The fixed storage ceiling is 64 MiB; no unknown record is evicted to make room.

Result content is paginated at 6144 UTF-8 bytes. Result TTL is fixed at initial projection commit and returned to callers. Native source is retained without expiry until acknowledgement of that durable result, then shares its expiry. Expired source/result reads explicitly fail; idempotency tombstones stay. Duplicate callbacks do not renew the result TTL.

## Evidence and limits

- Initial actual HTTP RED: the native route returned 404 instead of fail-closed 503. New service/source assertions also failed before implementation; later targeted RED demonstrated completed native turn plus incomplete source incorrectly remained pending.
- Focused new mechanism tests and directly affected original regression tests pass. Exact commands, logs, counts and commit coordinates are in `/tmp/dsh-native-pilot-impl-report-20261015.json`.
- A real filesystem failure at source turn-end leaves an incomplete source while original Router execution can complete: formal query reports `RESULT_UNRECOVERABLE`, retains known execution facts and never sends again. This negative control does not claim successful recovery of missing bytes.
- A real filesystem failure only at facade result commit reports `RESULT_PERSIST_FAILED`; restored storage repairs the original result from its retained source with one send total.
- Both full `npm test` attempts are TIMEOUT/FAIL, never full-suite PASS. Detailed failure output exposed an implementation regression: a receipt-generation expression was accidentally inserted in a timeout callback without that variable in scope. That line was removed and all original process-lifecycle tests were rerun, separately from environment/harness failures. The first full attempt also lacked a test dependency; the second ran after a test-local ignored harness dependency link. No unrelated production code was repaired.
- The structure verifier has baseline violations; the candidate's temporary extra test directory was removed and the tests moved into the existing route-chain directory. No registry or limits were changed.

No source fixture is a loaded-runtime or dot/real-Agent acceptance. Required live identity/grant, worker/storage ownership, installed source protocol, load, real native receipt/reply timing and recovery proofs remain NOT_RUN. Source write failure is explicitly unavailable and blocks claiming the successful recovery acceptance or expanding activation.

## Disable / rollback

Remove `send` from the current config's operations to deny new admission immediately while separately allowed result reads continue. Disabling the adapter denies all of its endpoints. Neither operation deletes requests, source artifacts, result refs or UNKNOWN tombstones. Roll back code only with the new adapter disabled; preserve the native-conversation storage and do not route old keys through another entry/session. Deployment remains the user's operation.

## Frozen review repair, after a6f1b074

The first independent review required NC-PILOT-B001/B002/B003; an independently reproduced token redirect violation was added in the same bounded repair wave. The original candidate and its evidence stay recorded in the implementation receipt.

- B001: formal source read failures are classified instead of swallowed. The original Router proof is checked against the retained Agent/session/message/request coordinates before projecting native unknown, failed or terminated facts. Source I/O failure and native outcome uncertainty carry diagnostics and query-original-only recovery conditions; no new send occurs. A proven accepted receipt alone no longer claims that execution has started.
- B002: the source selects the last nonempty visible assistant text in the exact turn and retains its original message association across legal empty/reasoning/tool-only completion anchors. A wholly empty completion explicitly has no visible reply. Coverage and the existing 1 MiB source limit are returned; neither empty text nor truncated/missing bytes become available business replies.
- B003: the native seam returns its actual created/resumed/hot-reuse disposition and concrete reason through receipt, retained source and result. A missing reset/generation-change cause stays explicitly unknown. The scoped continuation identifies the original result and requires a freshly authorized resolve for follow-up to current main; it does not grant historical-generation resume.
- Authentication: the fixed canonical `/oauth/token` request now uses `redirect: error`, so redirects cannot carry the credential into another path. No new identity, resource, grant, history or scheduling surface was added.

The new counterexamples were executed RED before repair. The bounded Source/regression set and original process-lifecycle set were rerun after the receipt change; exact counts and log hashes are in the appended fix-wave receipt. Full `npm test` was not repeated. Production loading, real Agent/dot acceptance and independent re-audit remain separate gates.
