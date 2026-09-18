# FREEZE V2 — rebound to the G6 live generation (Owner R-1 closed)

Supersedes FREEZE.md §1-§2 coordinates. R-1 CLOSED by Owner: the 2026-09-18 06:44 action =
WATCHDOG_LARK_V3_G6_NARROW_DEPLOY (source bb5327f, receipts /private/tmp/watchdog-lark-v3-g6-*.log,
rollback tree app.rollback-pre-bb5327f-g6-narrow). G6_POSTDEPLOY_CANARY_CLOSURE=NOT_PROVEN is
TRANSFERRED into this generation's postdeploy acceptance (no retroactive PASS).

## Frozen coordinates (fresh)

```text
TARGET_SOURCE_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6        (= current main, fresh)
FRESH_MAIN_SHA_VERIFIED_AT_FREEZE=41f354d163f532348b2ad1ef33b5ee528655dfc6
CURRENT_LIVE_GENERATION_SOURCE_SHA=bb5327f622a0333f1e11d945319e024a3731f05a  (Owner-attested G6)
CURRENT_LIVE_APP_CONTENT_SHA256=a4fbb630ff3a65605c145b32da0965db632c751aaec9d0d6444c0bdcda8af4a4 (Owner-attested)
CURRENT_LIVE_RUNTIME_PID=53645
PLIST_DECLARED_SHA=d602b592fad345fb1c9adebe2bc6611a6f5cfdc2
PLIST_DECLARED_SHA_STATUS=STALE_GENERATION_METADATA
LIVE_SCHEDULER_SUBTREE_VERIFIED=38 files file-hashed; 31 byte-equal to bb5327f; 7 = older
  narrow-overlay bytes (62905c1-era base + post-62905c1 narrow files: self-ops/index.js,
  slot-accounting.js; invoker-outcome.js absent) — consistent with the multi-narrow-overlay
  production model; NO file matched anything newer than bb5327f.
DEPLOYMENT_SCOPE=bb5327f..41f354d — fresh recomputed: production code delta = packages/scheduler
  ONLY (scheduler.js/eligibility.js/occurrence.js/store.js/self-ops/{index,diagnosis}.js/
  watchdog/admission-isolation.js + tests); zero delta in production-runtime/broker/agent-router/
  scripts; docs ride along inert. (packet v2 recomputed this itself, not inherited.)
```

## Frozen manifests (drift tripwires — recomputed as root at apply time; ANY mismatch = DEPLOY=NO)

```text
EXPECTED_ARTIFACT_MANIFEST_SHA256=ee8e9d23d3bc3eb282db81a92399045f721000d2497b0181cdc108a14c35feb2
  (939 files; expected-artifact-manifest.sha256 — staging tree at 41f354d)
EXPECTED_LIVE_PREIMAGE_MANIFEST_SHA256=66ebc369987bebbfd44549c6d0c8cfc32700decae9b4755ec63913e3a58b6721
  (1131 files; expected-live-preimage-manifest.sha256 — the CURRENT G6 live app generation)
STAGING_DIR=/Users/yanfenma/workspace/project/dsh-selfheal-staging-41f354d (built from git archive of 41f354d)
```

## Execution (the ONE authorized attempt)

```text
AUTHORIZED_DEPLOYMENT_ATTEMPTS=1  TARGET=41f354d163f532348b2ad1ef33b5ee528655dfc6
RUNBOOK=deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v2.sh
  (script sha256=535c44bc2778cfb7d4c6f883f7cf87338b3a6ff5f9cec72576dae5a374ad5717;
   archived copy in this directory)
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v2.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v2.log
Gates (fail-closed, in order): G0 exactly-once authorization marker -> G1/G2/G3 staging manifest +
key hashes vs this packet -> G5 live manifest vs expected-preimage manifest (drift=NO) -> G4 full
preimage capture (app tree + plist + store jobs.json/runs.jsonl + manifests; do-not-touch declared:
harness/W1+W2/spawn-helper/routing-manifest/credentials) -> G6 all four locks ABSENT -> G7 no other
mutation process -> G8 runtime health (process + 8790/health + W2 heartbeat <=15min) -> G9 HR job
b115cb96 retry.auto==false confirmed fresh (scheduleRevision/updatedAtMs frozen into the receipt
for the later bounded re-enable) -> G10 rollback preimage complete -> G11 dependency manifests
identical (offline node_modules reuse safe = GAP-1 closed; harness REUSE path skips pnpm = GAP-1
failure mode from G5 cannot recur).
APPLY: trusted-cp-deploy-install.sh (app closure recopied fresh from staging) -> launchctl kickstart
-k system/ai.agent.core.runtime -> 20s+10s stability + 8790/health + deployed scheduler.js hash ==
frozen target -> 30s -> runs.jsonl tail error scan -> receipt written to .deploy-receipts AND
/private/tmp/scheduler-self-healing-deploy-v2-receipt/ (operator-readable).
ANY gate failure: DEPLOY=NO STOP=YES — receipts and preimage remain; NO_BLIND_RETRY /
NO_MANUAL_LOCK_DELETE / NO_BYPASS; a new deployment requires a NEW packet (new evidence).
POSTDEPLOY: NEW_RUNTIME_SOURCE_SHA verified by deployed-file hashes == 41f354d; full acceptance
(cross-revision error delta=0, global tick continues, unrelated jobs mint, job_disposition v2
available, one-bad-job isolation smoke, W1/W2 health, G6 carry-forward canary obligation) runs
AFTER this script, per Owner authorization. HR retry.auto stays FALSE until POSTDEPLOY_VERIFICATION=PASS;
then the pre-authorized exact bounded mutation via the canonical receipted control surface with
expected_revision anchored to the G9 receipt readback. NO_RUN_NOW/NO_SHELL_RECOVERY/NO_RAW_STORE_EDIT
/NO_MANUAL_FENCE_EDIT/NO_BLIND_RECONCILE during everything that follows.
```

## Non-privileged preflight already executed at freeze (operator, fresh)

production-mutation-locks/ EMPTY (06:44 cleanup) · no deploy/transaction/routing processes running ·
8790/health ok · W2 heartbeat fresh · live scheduler subtree file-verified (see above) ·
staging manifest frozen · FRESH_MAIN_SHA re-fetched at freeze.
