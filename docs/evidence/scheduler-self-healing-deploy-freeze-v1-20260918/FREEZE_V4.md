# FREEZE V4 — supersedes V3 (V3 superseded BEFORE execution; nothing ran)

V3's independent review found three mechanical blockers, all fixed in V4 (no production action
was ever taken; the single authorized attempt is unconsumed):
1. G3 key-hash gate compared 16-char prefixes against full sha256 digests — guaranteed false-fail.
   V4 pins the FULL 64-char digests (below) and the postdeploy deployed-hash check uses the same
   full form.
2. Rollback preimage was sited inside the installer-mv'd TRUSTED_ROOT. V4 sites marker, receipts
   and the preimage under /usr/local/var/agent-core/scheduler-self-healing-v4/ (outside the moved
   root); operator-readable receipts also in /private/tmp/scheduler-self-healing-deploy-v4-receipt/.
3. The archived runbook copy was missing and its sha256 unpinned. V4 archives the byte-identical
   copy in this directory and pins:
   RUNBOOK_SHA256=480070671aea81c4129c3bb4bdca6aa6f3d09217f5cbba762d42be61bcc28dd5

## Frozen coordinates and manifests (unchanged from V2/V3, re-verified at V4 freeze)

```text
TARGET_SOURCE_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6   (= FRESH_MAIN_SHA)
CURRENT_LIVE_GENERATION_SOURCE_SHA=bb5327f622a0333f1e11d945319e024a3731f05a
CURRENT_LIVE_APP_CONTENT_SHA256=a4fbb630ff3a65605c145b32da0965db632c751aaec9d0d6444c0bdcda8af4a4
CURRENT_LIVE_RUNTIME_PID=53645
PLIST_DECLARED_SHA=d602b592… = STALE_GENERATION_METADATA
DEPLOYMENT_SCOPE=bb5327f..41f354d = packages/scheduler-only production delta (fresh recomputed)
EXPECTED_ARTIFACT_MANIFEST_SHA256=ee8e9d23d3bc3eb282db81a92399045f721000d2497b0181cdc108a14c35feb2 (939 files)
EXPECTED_LIVE_PREIMAGE_MANIFEST_SHA256=66ebc369987bebbfd44549c6d0c8cfc32700decae9b4755ec63913e3a58b6721 (1131 files)
STAGING_DIR=/Users/yanfenma/workspace/project/dsh-selfheal-staging-41f354d
```

## Key scheduler file digests (FULL sha256, pinned)

```text

```

## Execution (single authorized attempt — V4)

```text
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v4.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v4.log
```

Gates (fail-closed, in order): G0 exactly-once marker (consumed on any exit) → G1/G2/G3 staging
manifest + full key digests → G5 live preimage drift (fresh manifest == frozen 66ebc369) → G4 full
preimage capture (app tree + plist + jobs.json + runs.jsonl + manifest; do-not-touch declared:
harness / W1+W2 plists+copies / spawn helper / scheduler-routing manifest / credentials) → G6 four
locks ABSENT → G7 no conflicting mutation process → G8 runtime health (process + 8790/health +
W2 heartbeat ≤3600s at the plist-pinned state dir + w2.log ≤1800s + suppressed_or_healthy tail) →
G9 HR job b115cb96 retry.auto==false confirmed fresh (revision+updatedAtMs frozen into receipt for
the bounded re-enable) → G10 preimage complete → G11 dependency surface bound (staging
package.json == d5764403… == bb5327f's; MAIN_REPO=/Users/yanfenma/workspace/project/dsh-agent-core
croner/@larksuiteoapi presence + versions recorded).
APPLY: trusted-cp-deploy-install.sh (app closure recopied fresh from staging; harness REUSE skips
pnpm) → launchctl kickstart -k system/ai.agent-core.runtime → 20s/10s pid stability + 8790/health
+ deployed scheduler.js full-hash == pinned → 30s → runs.jsonl tail error scan + JSON-parse smoke →
receipts (root + operator copies).
ANY failure: DEPLOY=NO STOP=YES; preimage/receipts retained; NO_BLIND_RETRY / NO_MANUAL_LOCK_DELETE
/ NO_BYPASS; a new attempt requires a NEW packet with new evidence.
Postdeploy acceptance then runs per Owner authorization (error delta=0, global tick continues,
unrelated jobs mint, job_disposition v2, one-bad-job isolation smoke, W1/W2 health, G6
carry-forward canary obligation); HR retry.auto stays FALSE until POSTDEPLOY_VERIFICATION=PASS,
then the exact bounded canonical re-enable anchored to the G9 receipt; then Phase D real Feishu
E2E A-G (canary first; no run-now / shell recovery / raw store edit / manual fence edit / blind
reconcile).
