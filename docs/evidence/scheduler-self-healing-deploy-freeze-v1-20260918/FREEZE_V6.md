# FREEZE V6 — supersedes V5 (V5 authorization consumed by a FALSE-FAIL gate; zero production mutation occurred)

## What happened to the V5 attempt (new evidence reopening the gate)

The V5 root run executed 2026-09-18 ~10:42+08 and consumed its authorization at G6:
```text
PREFLIGHT_FAIL G6 lock present: /Users/authsvc/.agent-core/scheduler/jobs.json.engine.lock
DEPLOY=NO STOP=YES NO_BLIND_RETRY
```
Root cause (operator error, mine): the V5 gate list mapped the Owner's "SCHEDULER_STORE_LOCK=ABSENT"
onto BOTH store lock files. The engine lease (jobs.json.engine.lock) is NOT a transaction lock — it
is the single-live-engine guard HELD by the live canonical runtime continuously (store.js
acquireEngineLease; scheduler start() asserts it before any admission; OwnerLock proves holder
liveness by pid). Its presence while pid 53645 runs is the healthy steady state; requiring it
absent could only ever be true if the engine were halted. NO production mutation occurred in the
V5 attempt (fail happened before the installer; only additive preimage captures at
/usr/local/var/agent-core/scheduler-self-healing-v5/preimage-20260918T024239Z, retained as
evidence). The consumed V5 marker stays as the record; V6 uses its own marker.

## Corrected gate (V6) + all other gates unchanged

```text
SCHEDULER_STORE_LOCK=ABSENT  → jobs.json.lock (the MUTATION lock) ABSENT   [unchanged]
DEPLOYMENT/PRODUCTION TRANSACTION LOCKS=ABSENT                            [unchanged]
ENGINE LEASE (jobs.json.engine.lock) = MUST BE HELD BY THE LIVE RUNTIME:  [corrected, positive check]
  file exists → parse holder pid → kill -0 alive → ps identity matches
  production-runtime.mjs --root /Users/authsvc/.agent-core
```
Everything else in the V5 runbook is byte-preserved: staging binding (manifest ee8e9d23…, full key
digests), live-preimage drift gate (66ebc369…), full preimage capture, no-conflicting-process,
runtime health (8790/health + W2 heartbeat at the plist-pinned state dir + w2.log freshness),
HR retry.auto==false gate + revision frozen to receipt, preimage completeness, dependency-surface
binding, installer apply + kickstart + stability + deployed-hash verification + runs.jsonl tail
scan + JSON-parse smoke, dual receipts, exactly-once marker (deploy-v6.auth — V6's own).

## Fresh verification at V6 freeze (operator, non-root where applicable)

```text
FRESH_MAIN_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6 (re-fetched)
EXPECTED_ARTIFACT_MANIFEST_SHA256=ee8e9d23… (staging untouched)
EXPECTED_LIVE_PREIMAGE_MANIFEST_SHA256=66ebc369… (recompute at freeze: zero drift)
TARGET_SOURCE_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6
RUNBOOK_SHA256(V6)=8c0c12c339073bec417085578675c9e316a7c31a1899514141316627b5cc8dd0
ARCHIVED COPY=byte-identical, in this directory
```

## Execution (one authorized attempt under V6)

```text
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v6.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v6.log
```
Same fail-closed contract as before: any gate failure => DEPLOY=NO STOP=YES, preimage/receipts
retained, NO_BLIND_RETRY / NO_MANUAL_LOCK_DELETE / NO_BYPASS; a further attempt requires a NEW
packet with new evidence. On PASS: DEPLOYMENT=PASS receipt + postdeploy acceptance (error delta=0,
global tick continues, unrelated jobs mint, job_disposition v2, one-bad-job isolation smoke, W1/W2
health, G6 carry-forward canary obligation) -> HR retry.auto bounded re-enable (canonical receipted
surface, expected_revision anchored to the G9 receipt) -> Phase D real Feishu E2E A-G.
