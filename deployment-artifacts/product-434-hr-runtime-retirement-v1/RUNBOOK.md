# RUNBOOK — PRODUCT_434_HR_RUNTIME_RETIREMENT_V1

Existing-surface operation: ONE trusted-closure generation install + ONE planned drain-gated restart + readback canaries + armed prior-image rollback. No new tooling is introduced by this packet; every step names an existing, trusted surface. Root steps are Owner-executed under the standing production authority; this runbook itself was frozen without executing any of them.

## §0 Frozen constants

```text
CANDIDATE_HEAD           = daa4c82d0501b4c582b09cb6c0ab07f474659fe1
CANDIDATE_TREE           = 80ba798c3a4470078f4cc8479d0f6c6bf6306231
PRIOR_GENERATION_STAMP   = d602b592fad345fb1c9adebe2bc6611a6f5cfdc2   (current AGENT_CORE_DEPLOYED_SHA on runtime + W1 + W2)
LIVE_ROOT                = /usr/local/libexec/agent-core/app
NODE_BIN                 = /usr/local/libexec/agent-core/node-runtime/bin/node
RUNTIME_LABEL            = system/ai.agent-core.runtime
RUNTIME_PLIST            = /Library/LaunchDaemons/ai.agent-core.runtime.plist
WATCHDOG_LABELS          = ai.agent-core.scheduler-watchdog-w1, ai.agent-core.scheduler-watchdog-w2
PROD_MUTEX               = /usr/local/var/agent-core/production-mutation-locks/production-deploy.lock
ARTIFACTS_DIR            = /var/db/agent-core/deployments/PRODUCT_434_HR_RUNTIME_RETIREMENT_V1
API_HEALTH               = http://127.0.0.1:8787/health                (unauthenticated boot probe, product-api)
SCHED_HEALTH             = http://127.0.0.1:8787/scheduler/health      (Bearer + scheduler.read/scheduler.audit scope; service identity)
EXPECTED_17_PACKAGES     = agent-credential-provisioning agent-definition agent-memory agent-provisioning
                           agent-router agent-switch broker demo-server feishu-connector notification-ingress
                           owner-guard product-api production-runtime scheduler scheduler-router
                           workflow-execution workspace-bootstrap
HYGIENE_EXEMPT_FILES     = packages/product-api/src/agent-process-admin-routes.js (agt_hr-agent, AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1 pin)
                           packages/product-api/src/index.js (agt_hr-agent, same pin)
                           packages/production-runtime/src/scheduler/deployment-runtime-restart.js (/Users/authsvc, human-run deploy surface)
EXPECTED SPOT DIGESTS (sha256 of file bytes at CANDIDATE_HEAD; verify post-apply):
  858237a53fc612acc8130f59b1f8c4fc6215174d8bc1d36d53bef621705f63b1  packages/agent-router/src/index.js
  4fe013a03dcbc0a6a8503c4a8ed83a869835557decc84a6b7b63ba9ef5194cf5  packages/agent-router/src/binding-store.js
  1ac2e0e03a405d8d84a0dc52116c0b84318009726f8a0457032341d8875e021a  packages/agent-router/src/parent-rpc-relay.js
  87abee00c4c4911bca44b002ecfdc1815eb680f8c1fd18444d32ba06c38334ae  packages/agent-router/src/process-registry.js
  6e079adcc807c772e2a360db9c4e4efcd06070397ef196f53f9173ab9b643342  packages/agent-router/src/process/state-machine.js
  01eab5d3e535f2b05fd15960e396376a2db339676a2a5f57993a189c868484f6  packages/agent-router/src/ingress-delivery.js
  016ef8a6b26a4567dc7075c6dd039e05bf8217b80869d47a1882e66ac2c85b0f  packages/production-runtime/src/scheduler/restart-drain.js
  953c919d280c1599324dda67b814af3838a67b62ddd3f112d16c9c1013cd4903  packages/production-runtime/src/scheduler/deployment-runtime-restart.js
  6a35dab738acdbdfd9bb9abe5632a9b949426bca15f09a73383428e4762c8588  scripts/production-runtime.mjs
  81be1a2be2dc7c79a3bdb5301b4fbb05b8c9eccc3656250b3fa6ed6cd1966f21  packages/product-api/src/agent-process-admin-routes.js
BROKER_INDEX_SHA_AT_HEAD = 69c1672cb1c96732e20555975a687a134e949277684e272e541c02ce2e1b4fc7
```

## §1 P — Preflight (read-only unless stated; abort on any GATE fail)

- **P0 Mutex + release**: verify `PROD_MUTEX` is free; Owner announces P0 release (`PRODUCTION_MUTATION_CONCURRENCY=1` — nothing else mutates production during this operation).
- **P1 Source identity**: prepare REPO_SRC = a clean checkout at exactly `CANDIDATE_HEAD`; `scripts/lib/trusted-source-git-stamp.sh REPO_SRC` must emit `daa4c82d0501b4c582b09cb6c0ab07f474659fe1` + dirty-count `0`. Record `EXPECTED_SOURCE_SHA=daa4c82d0501b4c582b09cb6c0ab07f474659fe1`, `EXPECTED_SOURCE_TREE=80ba798c3a4470078f4cc8479d0f6c6bf6306231` (installer provenance env; REPO_SRC is explicit-only by `TRUSTED_CP_PACK_INPUT_PROVENANCE_V1` — never defaulted).
- **P2 PREIMAGE = the rollback artifact (REQUIRED because live bytes ≠ declared stamp)**: as root, byte-snapshot into `ARTIFACTS_DIR/preimage/`: the full `LIVE_ROOT/packages` and `LIVE_ROOT/scripts` trees, `RUNTIME_PLIST`, and (service identity, authsvc) digests of the durable stores: scheduler jobs store, binding store (legacy `freshHrCutBinding` receipt), reconciliation persistence (UNKNOWN fence records). Record sha256 manifest. Deletions/deltas of stores are NOT expected from this install (stores live outside `LIVE_ROOT`); any store digest change across apply is a C5/C6 canary fail.
- **P3 Baseline census (read-only)**: current `AGENT_CORE_DEPLOYED_SHA` readbacks (plist + `launchctl print system/ai.agent-core.runtime`) = `PRIOR_GENERATION_STAMP`; 17-package census; HR-module presence census (README §2 rows are the frozen baseline); self-match-free process argv HR-pattern scan = 0; `scripts/scheduler-cp-fleet-gate.mjs --check` (G1/G4/G5 PASS, BROKER_SHARED_BYTES baseline recorded).
- **P4 Drain readiness**: the restart census needs the durable turn-recovery + jobs stores readable by the service identity; verify no in-flight incident/rollback state (`/var/db/agent-core/deployments/...` phase files) is UNRESOLVED. If any unresolved phase exists → STOP (blocked, do not deploy over an open generation).

## §2 A — Apply (root; ONE install + ONE restart)

- **A1 Install**: as root, run the EXISTING installer once:
  `EXPECTED_SOURCE_SHA=daa4c82d0501b4c582b09cb6c0ab07f474659fe1 EXPECTED_SOURCE_TREE=80ba798c3a4470078f4cc8479d0f6c6bf6306231 scripts/trusted-cp-deploy-install.sh <REPO_SRC>` (under `PROD_MUTEX`, which the installer acquires; provenance validation `validate_pack_source` must PASS or abort with zero mutation).
- **A2 Restart (drain-gated, the existing planned-restart path)**: via `packages/production-runtime/src/scheduler/deployment-runtime-restart.js` `restartSchedulerProductionRuntime` with `sourceSha=daa4c82d…`: the `enforceRestartDrainGate` census→drain (default 60 s window, 2 s poll) must drain or REFUSE **before** any plist mutation (`RESTART_DRAIN_UNDRAINED` = stop, do not force); `acceptUndrainedRestart` only as the A4 emergency path WITH a restart-boundary receipt naming the previous epoch. The restart quiesces `system/ai.agent-core.runtime` (+ watchdogs via the deployment-launchd adapter), then writes `AGENT_CORE_DEPLOYED_SHA=daa4c82d…` into `RUNTIME_PLIST` with per-key readback assert.
- **A3 Boot readback**: `launchctl print system/ai.agent-core.runtime` → `state = running`, new pid, env `AGENT_CORE_DEPLOYED_SHA = daa4c82d…`; plist key = same value. Exactly ONE restart for this operation.

## §3 C — Canaries (post-apply; ANY fail → §4 rollback immediately, per #386 post-mutation failure rule)

- **C1 authsvc boots with the expected 17 packages**:
  `launchctl print system/ai.agent-core.runtime` state=running with `AGENT_CORE_DEPLOYED_SHA=daa4c82d…`; `ls -1 LIVE_ROOT/packages` sorts identical to `EXPECTED_17_PACKAGES` (exactly 17, no extras/omissions); `curl -fsS http://127.0.0.1:8787/health` → ok; `scripts/scheduler-cp-fleet-gate.mjs --check` G1 PASS. Watchdog plists W1/W2 re-stamped to the same SHA.
- **C2 ordinary non-HR cron/every/at scheduling remains generic**:
  (i) test-identity: `packages/scheduler/test/schedule.test.js` (cron/every/at dispatch semantics) 9/9 at CANDIDATE_HEAD (already recorded at freeze); (ii) live: via the EXISTING postdeploy canary seam `scripts/lib/scheduler-postdeploy-canary-control.mjs --source-sha daa4c82d… --agent <non-HR test agent>` run as the scheduler service identity — one disposable, side-effect-free canary job; (iii) service-identity `scripts/scheduler-cp-census.mjs` shows the jobs-store delta vs P2 preimage = only the expected canary job (no HR job touched).
- **C3 HR admission state unchanged; no hidden runtime branch**:
  (i) service-identity jobs census: `agt_hr-agent` critical job (`logicalKey agt_hr-agent:hr-workflow-auto-dispatch`) identical to preimage (enabled, agentId, runPolicy grace 30 / max-consecutive-failures 2 — the `scripts/lib/admission-lib.mjs` desired-state freeze); (ii) HR-literal census of live `packages/*/src` + `scripts/production-runtime.mjs`: zero hits outside exactly `HYGIENE_EXEMPT_FILES` (banned set per `packages/agent-router/test/runtime-hygiene/no-hidden-hr-runtime-knowledge.test.js`); (iii) the deleted module files are ABSENT from the live tree (fresh-hr-cut-startup.js, fresh-hr-ingress.js, reconciliation/fresh-hr-lineage.js, binding-store-fresh.js, native-arm64 hr-* set, demo-server/fixed-admin-tool-free.js); (iv) test-identity: hygiene guard 35-core suite green at head (recorded).
- **C4 legacy `freshHrCutBinding` / `lineageOperationId` durable bytes load byte-stably / fail closed on corruption**:
  (i) boot success itself is the load proof (any drift fails the store load loud `CORRUPT_STORE` — there is no silent-ignore path, `packages/agent-router/src/binding-store.js` §legacy contract); (ii) binding-store digest unchanged pre→post apply (P2 manifest, service identity); (iii) test-identity at head (recorded): byte-stable round-trip across persist/restart, drift (`preimageSha256` mutation) → `CORRUPT_STORE`, dangling conversation ref → `CORRUPT_STORE`, empty `lineageOperationId` marker → `CORRUPT_STORE`. Corruption injection happens ONLY as test identity, never against the live store.
- **C5 old UNKNOWN does not replay**:
  (i) test-identity at head (recorded): restart-lost `outcome_unknown` stays fenced across restarts (admission/prompt/spawn gates reject `AGENT_PROCESS_TURN_FENCED` with `fencedBy` = old handle), second mint for the same coordinates → `RECONCILIATION_CORRELATION_CONFLICT`, fence durable across fresh store instances; (ii) live: reconciliation persistence digest unchanged pre→post apply (P2 manifest) — records were never rewritten by the install; (iii) **a live replay/settle attempt against the old UNKNOWN is FORBIDDEN forever** (this canary is structural + test-identity by design).
- **C6 old-handle history reads still work**:
  via the EXISTING non-consuming read surface (`router.getTurnReconciliation(oldHandle)` — `packages/agent-router/src/reconciliation/query.js` contract; AGENT_PROCESS_LIFECYCLE_HARDENING_V3 C-018/C-019/C-026), executed as the authsvc service identity through the runtime's existing authenticated API surface: snapshot resolves with the same handle, a second identical read returns the identical snapshot (repeatable, non-consuming), `unresolvedRecoveryRecords()` count unchanged, record state still `recovering`. No settle/abandon/mutating call may be issued against the old handle during or after this operation (the D6 abandonment channel remains available to the Owner per AGENT_PROCESS_ADMIN_TURN_ABANDONMENT_V1 but is NOT part of this runbook).
- **C7 old worker/effect fences remain effective**:
  (i) post-apply spot digests == frozen values for `parent-rpc-relay.js`, `process-registry.js`, `process/state-machine.js`, `ingress-delivery.js` (the generalized stop barrier + gate chain bytes); (ii) test-identity at head (recorded): draining/exited/exit-observed children of an ORDINARY (non-HR) agent lose broker+switch at the stop barrier (`PROCESS_STOP_BARRIER_EFFECT_DENIED`) before gateway lookup; live READY child keeps ordinary semantics; (iii) fleet gate G4 (import closure) + G5 (symbols load + child-mode apply rehearsal) PASS post-apply.
- **C8 no unrelated Agent regression**:
  (i) `scripts/scheduler-cp-fleet-gate.mjs --check` post-apply: G1/G4/G5 PASS and `BROKER_EXPECTED_INDEX_SHA=69c1672c…` (BROKER_INDEX_SHA_AT_HEAD) → BROKER_SHARED_BYTES PASS. Provenance note: the gate's built-in hash is the older production-proven repair bytes; the gate documents that the expectation "advances only via a recorded production overlay/admission" — this generation install IS that recorded admission, so the packet pins the head digest explicitly and the install receipt (A1/A3 readbacks) is the advancing record. (ii) The privileged gates G2/G3/G6/G7 (journal + run-ledger + crash-signature scan) run in the Owner's sudo window per the fleet gate's own contract. (iii) Jobs census delta vs P2 = expected-only (no other agent's job enabled/disabled/retimed). (iv) Full-suite no-new-failure property at this exact head already recorded (#230); no test beyond the named canaries is required by this packet.

## §4 R — Rollback (armed before A1; deterministic; stores format-identical in both directions)

- **R1 Trigger**: ANY C1–C8 fail, or boot failure, or drain-gate abort after A1 mutated the tree. Do not keep the production writer occupied for diagnosis (post-mutation failure rule).
- **R2 Prior release image restore**: as root, re-run the SAME installer against the prior generation: `EXPECTED_SOURCE_SHA=d602b592fad345fb1c9adebe2bc6611a6f5cfdc2 scripts/trusted-cp-deploy-install.sh <clean checkout at d602b592…>`; then byte-restore any `LIVE_ROOT` file whose P2 preimage digest differs from the fresh d602b592 image (the historical incident overlays) — restoring the EXACT pre-apply bytes, not the idealized stamp. (`scripts/scheduler-cp-rollback.mjs` remains available for SCPR-scoped artifacts; its invariants bind: rollback MUST NOT release a fence, rewrite an occurrence, delete evidence, or retry work.)
- **R3 One rollback restart**: same drain-gated path as A2 with `sourceSha=d602b592…`; plist per-key readback assert.
- **R4 Rollback readback**: C1 (17 packages + running + stamp `d602b592…`), health probe, fleet gate baseline restored (BROKER_SHARED_BYTES back to pre-apply reading), store digests unchanged vs P2. Release the P0 slot only after R4 is green.

## §5 Explicitly forbidden during this operation

UNKNOWN replay or any settle/rewrite of old recovery records; raw-store edits (stores are touched only by the runtime or service-identity census reads); credential reads (tokens/secrets stay inside the existing auth seams; SCHED_HEALTH bearer token is obtained by the service identity, never handled by the operator in plaintext); sudo beyond the installer/restart/rollback steps; broad cleanup; Remote Desktop; second concurrent production mutation; a second restart (one install, one restart, one rollback-restart max); deleting or barrel-re-adding the retired modules instead of the clean generation install.

## §6 Receipts to append after execution

A1 installer output + provenance validation, A2 drain-gate census/receipt + plist readback, A3 boot readback, C1–C8 outputs, ARTIFACTS_DIR preimage manifest sha256, R-section if triggered. #434 remains open until INSTALLED/ENABLED/BUSINESS_VERIFIED are separately evidenced; apply receipts are generation evidence, not business acceptance.
