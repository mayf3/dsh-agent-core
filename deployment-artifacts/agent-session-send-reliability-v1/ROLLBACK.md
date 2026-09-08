# ROLLBACK — agent-session-send-reliability-v1

Applies to packet r1 (frozen head `1d70571`). Rollback restores the IMMEDIATELY PREVIOUS
deployed generation of the touched production files (the 2026-09-05 standalone deployment,
relay blob `2ec4acf` era), NOT any speculative state.

## Preimage capture (BEFORE apply §D)

```bash
# Run on the host, as root or via the established elevated path, BEFORE D1:
for f in \
  packages/broker/src/capabilities/agent-session-messaging.js \
  packages/broker/src/index.js \
  packages/broker/src/registry.js \
  packages/broker/src/relay.js \
  packages/broker/src/schema.js \
  packages/agent-router/src/parent-rpc-relay.js \
  packages/production-runtime/src/agent-session-messaging.js \
  packages/production-runtime/src/agent-session-messaging-audit.js ; do
  mkdir -p "/var/backups/agent-session-send-reliability-v1-preimage/$(dirname "$f")"
  cp -p "/usr/local/libexec/agent-core/app/$f" "/var/backups/agent-session-send-reliability-v1-preimage/$f"
done
shasum -a 256 /var/backups/agent-session-send-reliability-v1-preimage/packages/*/*/* > \
  /var/backups/agent-session-send-reliability-v1-preimage/PREIMAGE.sha256
```

(Exact elevation/path per the standing deploy runbook; the preimage dir must live OUTSIDE
the app tree.)

## Rollback procedure

```text
R1  stop the canonical production runtime (established launchd path; capture ps + boot args)
R2  restore the preimage bytes over the app tree from
    /var/backups/agent-session-send-reliability-v1-preimage/ (verify against PREIMAGE.sha256)
    — this removes: renderErrorDetail behavior, reconcile capability + infrastructure filter,
    anchor persistence/forwarding. The L1 audit file (agent-session-messaging-audit.jsonl,
    control dir) is NOT touched by either generation's rollback: rows written by the new
    generation carry extra optional fields; the previous generation's append surface simply
    ignores them on read (append-only JSONL, no schema migration in either direction).
R3  restart the runtime; health + tool inventory read-back:
    agent_session_send present (previous bytes); agent_session_send_reconcile gone
R4  evidence: capture `git -C <staging> rev-parse HEAD` + deployed-byte hashes + boot log
    tail into docs/evidence/agent-session-send-reliability-v1-20260908/rollback/
```

## Rollback safety properties

- No store/schema migration exists in either generation: rollback is byte-restoration only.
- Rows written by the new generation (failureCode/failureReason/invocationCorrelation fields)
  are inert for the previous generation's code paths (they never read those fields).
- NO_DELIVERY side effects: the reconcile capability is read-only; rollback cannot strand any
  delivery state. A send in flight across the rollback degrades to the previous generation's
  semantics (lost response ⇒ outcome_unknown/parent_rpc_ambiguous, NO_AUTOMATIC_RETRY) —
  honest, never a duplicate.
