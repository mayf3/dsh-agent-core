# MOBILE_SESSION_HISTORY_RUNTIME_WIRING_SOURCE_FIX_V1 — REPORT

Lane: Mobile Session History owning source lane (source blocker closure only).
Base: canonical `origin/main` = `966c35d9ea996c863ad5202290db2a3a7ac7b67e`
(handoff was cut against `2ee6f47788b51b165267b9edec37ca5656b69954`; the gap
was re-verified present on the fresh head before any change).
Worktree: `/Users/yanfenma/workspace/worktrees/night-mobile-session-history-wiring-v1`
Branch: `goal/night-mobile-session-history-wiring-v1`
Governing specs: `MOBILE_SESSION_HISTORY_V1` (accepted) + sibling
`PRODUCT_API_AUTHENTICATION_V1` (accepted). GOVERNING_SPEC_UNMODIFIED = YES.

## Blocker (handoff deterministic gap #1, SOURCE_FIX_REQUIRED)

`packages/production-runtime/src/compose.js` called `applyProductApi` with
only `workflowAdmission/enabled/host/port` — `productApiCfg.history` never
crossed the composition boundary, so the accepted product-api module's
dedicated history-only Tailnet listener (`HISTORY_LISTENER`) was
unreachable from the production runtime and stayed default-OFF forever.

## Fix (minimal, composition pass-through only)

One config line in `packages/production-runtime/src/compose.js`
(`applyProductApi` call object):

```js
history: productApiCfg.history,
```

All semantics stay owned by the accepted module: default OFF
(`config.history ?? {}`, `enabled !== true` → absent route), fail-closed
mount decisions (empty/wildcard bind host, absent workspaceBootstrap,
missing auth config → 503 `PRODUCT_API_AUTH_NOT_READY`), loopback-only main
server. No env names added, no schema/wire change, no product semantics
extension, compose stays WIRING/LIFECYCLE ONLY.

## Proof

1. **Focused test battery (pinned Node v25.6.1, proxy env unset): 90/90 PASS**
   - `session-history` 33, `product-api` history-auth/history-listener/api/
     scheduler-auth/scheduler-api/scheduler-health 45, production-runtime
     `compose.test.js` 12 (11 pre-existing + 1 new regression test).
2. **Regression test bites (mutation check)**: reverting the compose line
   makes `MOBILE_SESSION_HISTORY_V1: productApi.history crosses the
   composition contract...` FAIL (verified via `git stash` round-trip);
   with the fix it PASSes.
3. **Isolated runtime boot proof** (`BOOT_PROOF_RESULT.json`, exit 0):
   - V1 no history key → no history mount attempt; loopback `/health` 200.
   - V2 `history:{enabled:true,host:''}` → the module applies its own
     fail-closed rule BEFORE any dynamic import; route absent; loopback 200.
   - V3 `history:{enabled:true,host:'127.0.0.1',port:47878}` → the full
     mount path runs through the composition config; listener mounts
     fail-closed (no auth config in the isolated env): history route → 503
     `PRODUCT_API_AUTH_NOT_READY`; the main loopback surface keeps the
     history route ABSENT (404 frozen envelope); loopback `/health` 200.
   - `productionActivation: NONE` — tmp layout, isolated loopback binds only
     (main server on ephemeral port 0; proof listener on fixed port 47878),
     no Tailscale interface, no auth config, no real agent process, no
     deployment mutation.

## Explicitly out of scope (untouched)

- Handoff deterministic gap #2 (`DEPLOYMENT_CAPABILITY_AUTHORITY_REQUIRED`):
  the exact staged `node_modules/@agent-core/session-history` dependency
  link. V3's dynamic import resolves only inside this dev worktree's local
  node_modules links; the staged deployment tree remains without the link.
  This lane performed zero node_modules mutation outside its own worktree's
  local dev/test closure.
- Production deploy/restart/config/credential mutation: none.
- Live `node_modules` edits: none.
- Product semantics: unchanged (pass-through of an already-accepted config
  surface; default-OFF posture byte-identical when the key is absent).

## Handoff

After merge this closes gap #1 only. Gap #2 (exact staged session-history
dependency link authority) remains open and owned by the deployment lane,
which must fresh-check canonical SHA, live WEC generation, closure, rollback
admission and exact package before any deployment.
