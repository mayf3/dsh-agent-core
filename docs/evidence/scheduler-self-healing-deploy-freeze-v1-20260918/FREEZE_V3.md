# FREEZE V3 — supersedes V2 (V2 superseded BEFORE execution; nothing ran)

V2's independent re-review found two gates GUARANTEED to false-fail against the frozen live
system (W2-heartbeat path pointed at a stale dev artifact; G11 whole-file package.json equality
impossible against the legitimate narrow-overlay live tree). Per V2's own rule ("any failure →
new packet"), V3 supersedes it. The single authorized attempt (target 41f354d,
AUTHORIZED_DEPLOYMENT_ATTEMPTS=1) attaches to V3. V2 remains in history as superseded evidence.

## Coordinates (unchanged from V2, re-verified fresh)

```text
TARGET_SOURCE_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6   (= FRESH_MAIN_SHA at freeze)
CURRENT_LIVE_GENERATION_SOURCE_SHA=bb5327f622a0333f1e11d945319e024a3731f05a
CURRENT_LIVE_APP_CONTENT_SHA256=a4fbb630ff3a65605c145b32da0965db632c751aaec9d0d6444c0bdcda8af4a4
CURRENT_LIVE_RUNTIME_PID=53645
PLIST_DECLARED_SHA=d602b592… = STALE_GENERATION_METADATA
LIVE_APP_MANIFEST_RECOMPUTED_AT_V3_FREEZE=66ebc369… — ZERO drift since V2 freeze
DEPLOYMENT_SCOPE=bb5327f..41f354d = packages/scheduler-only production delta (fresh recomputed)
EXPECTED_ARTIFACT_MANIFEST_SHA256=ee8e9d23… (939 files, unchanged)
EXPECTED_LIVE_PREIMAGE_MANIFEST_SHA256=66ebc369… (1131 files, unchanged, re-verified at V3)
```

## V2→V3 corrections (mechanical re-review findings)

1. G8 W2-heartbeat path: v2 hardcoded a stale dev artifact (/usr/local/var/scheduler-watchdog/
   w2.heartbeat, mtime 09-08). V3 derives the state dir from the installed W2 plist
   (SCHEDULER_WATCHDOG_STATE_DIR=/Users/authsvc/.agent-core/control/scheduler-watchdog, verified
   in the plist), checks w2.heartbeat there (root-readable), adds w2.log freshness ≤30min +
   "suppressed_or_healthy" tail assertion. Heartbeat age limit relaxed to 3600s (cadence not
   contractual); log freshness is the health signal.
2. G11 replaced: whole-file package.json equality was impossible (live root package.json is
   legitimately older-generation narrow-overlay bytes, frozen honestly in the preimage manifest —
   drift there is STILL caught by G5). V3 gates the dependency surface instead:
   (a) staging package.json sha256 == d57644033f2ed7458272262dedad91c1cabc86aa51bc75bcc1f35184029299cd
       (= bb5327f's, byte-for-byte — dependency manifest unchanged across the whole deploy scope);
   (b) MAIN_REPO explicitly bound to /Users/yanfenma/workspace/project/dsh-agent-core (the G6-lineage
       third-party node_modules surface — the same effective surface G6 deployed from), with
       croner + @larksuiteoapi/node-sdk presence pre-gated and versions recorded in the receipt.
3. Exactly-once marker, receipts and the rollback preimage RE-SITED to
   /usr/local/var/agent-core/scheduler-self-healing-v2/ (outside the installer's mv'd
   TRUSTED_ROOT — v2 sited them inside and the installer moves that whole tree into .bak-<ts>);
   operator-readable receipts ALSO written to /private/tmp/scheduler-self-healing-deploy-v3-receipt/.
   Marker write error-checked (v2 could silently disable exactly-once).
4. Runbook gaps 4-7 now evidenced INLINE: rollback command printed in the receipt (rsync --delete
   from the preimage dir + plist restore + kickstart); R-1 attribution recorded; RB5 readback smoke
   (runs.jsonl tail parses as JSON object post-deploy); DO_NOT_REENABLE_HR_RETRY_AUTO=true printed
   in the receipt. Daemon label typo fixed (system/ai.agent-core.runtime, hyphens).

## Execution (single authorized attempt — V3)

```text
RUNBOOK=deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v3.sh
RUNBOOK_SHA256(at commit)=see deployment-artifacts copy; archived copy in this directory
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v3.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v3.log
Gates: G0 exactly-once marker → G1/G2/G3 staging manifest + 7 key hashes → G5 live preimage drift
→ G4 full preimage capture (app+plist+store; do-not-touch declared: harness/W1+W2/spawn-helper/
routing-manifest/credentials) → G6 four locks ABSENT → G7 no conflicting mutation process →
G8 runtime health → G9 HR b115cb96 retry.auto==false + revision frozen → G10 preimage complete →
G11 dependency surface bound. THEN apply (installer) + kickstart + stability + deployed-hash
verification + runs.jsonl tail scan + JSON-parse smoke + receipts.
Any gate failure: DEPLOY=NO STOP=YES, preimage/receipts retained, NO_BLIND_RETRY /
NO_MANUAL_LOCK_DELETE / NO_BYPASS; new attempt requires a NEW packet with new evidence.
Postdeploy acceptance (after this script): per Owner authorization — error delta=0, global tick
continues, unrelated jobs mint, job_disposition v2 available, one-bad-job isolation smoke,
W1/W2 health, G6 carry-forward canary obligation; HR retry.auto stays FALSE until
POSTDEPLOY_VERIFICATION=PASS, then the exact bounded canonical re-enable anchored to the G9
receipt; then Phase D real Feishu E2E A-G (canary first; no run-now / shell recovery / raw store
edit / manual fence edit / blind reconcile).
