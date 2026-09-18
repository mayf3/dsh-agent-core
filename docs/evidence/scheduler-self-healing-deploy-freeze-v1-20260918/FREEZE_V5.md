# FREEZE V5 — supersedes V4 (V4 superseded BEFORE execution; nothing ran; the single authorized attempt remains unconsumed)

V3's independent review found three mechanical blockers, fixed in V4. V4's independent review then
found ONE remaining guaranteed defect, fixed in V5: the postdeploy deployed-scheduler.js hash
extraction used a space-anchored grep that matches zero lines of FROZEN_KEY_HASHES (paths are
slash-preceded) — it would have fired AFTER apply+restart, consuming the attempt on an
already-mutated system. V5 fixes the extraction (full-path anchor + non-empty assertion) and BOTH
hash-extraction sites are simulation-proven against the frozen digests (G3 loop 7/7, postdeploy
1/1). All other V4 properties re-verified unchanged (manifests reproduce with zero drift, gate
order safe, receipts dual-sited, no lock deletion / store write / HR mutation).
V3 blockers (fixed in V4, re-verified in V5):
1. G3 key-hash gate compared 16-char prefixes against full sha256 digests — guaranteed false-fail.
   V4 pins the FULL 64-char digests (below) and the postdeploy deployed-hash check uses the same
   full form.
2. Rollback preimage was sited inside the installer-mv'd TRUSTED_ROOT. V4 sites marker, receipts
   and the preimage under /usr/local/var/agent-core/scheduler-self-healing-v5/ (outside the moved
   root); operator-readable receipts also in /private/tmp/scheduler-self-healing-deploy-v5-receipt/.
3. The archived runbook copy was missing and its sha256 unpinned. V4 archives the byte-identical
   copy in this directory and pins:
   RUNBOOK_SHA256=8d2ec293d4ec94e82c8a54844ef119bce75ecb5e6f7db22f58d9e3e5dc2633dc

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
e3e8dce0fd8959336521147b639007b82e8ce98d932eca82ca2b98ac2506770d  packages/scheduler/src/scheduler.js
939863a5d706c74c9129a443b00445ea638dd7791c60609259ee80d11006627b  packages/scheduler/src/eligibility.js
5c770d5e99ebc20f794284020aa9cf5471609e9bf7c9e1e2ff3c2be5a8671d25  packages/scheduler/src/watchdog/admission-isolation.js
0fcb6811f53278f23bca7bfed1cd841a1034874054533453935e4c75da4c4293  packages/scheduler/src/self-ops/index.js
4038e4f88086f49bae3e367b1df669e9f874286231b50606397ba5b6c90540df  packages/scheduler/src/self-ops/diagnosis.js
86f547f3ee51b291999432aab119916e98696f1dd4b5a3a9dccb505bc2b9a5a7  packages/scheduler/src/occurrence.js
a8eacf4f16edd207b7181a5fcc47b30a4b26c9e852d335ca2746c88fd4ac3fcc  packages/scheduler/src/store.js
```

## Execution (single authorized attempt — V5)

```text
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v5.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v5.log
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
