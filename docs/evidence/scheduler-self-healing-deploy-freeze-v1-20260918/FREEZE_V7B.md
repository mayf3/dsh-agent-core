# FREEZE V7B — ONE-FILE APP-ONLY SEALED GENERATION FOLLOW-UP (2026-09-18)

Closes the single spec-governed gap found by V7 postdeploy acceptance (see
POSTDEPLOY_ACCEPTANCE_V7.md): the live app's broker self-ops manifest predates
the accepted SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 §3 surface. V7B ships
EXACTLY ONE file as a sealed app generation swap; everything else is pinned
unchanged by gates. All V7 principles carried over (no installer, no package
manager, no network, no corepack; atomic renames in one parent dir; automatic
rollback on any post-swap failure).

## Scope ruling (this packet)

```text
TARGET_SOURCE_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6
SCOPE=packages/broker/src/capabilities/self-ops.js ONLY
SOURCE_BYTES_SHA256=b302810c29c92404fcf538819af5bb997410c395fd42d10e93377729d221907a
  (41f354d bytes, commit 7e66c79; adds self_ops operation `job_disposition`; pure manifest, zero imports)
LIVE_PREIMAGE_APP_MANIFEST=c41a90453d0170085b3959943af70b1111c9403b5191e097649e28c01c4e15b7
  (the V7 deployed generation; re-verified intact at 19:4x local before freeze)
TARGET_APP_MANIFEST_SHA256=f261066d77dedb2240c2e328eebbccd26ce7e9a97055212874c0616d248a1a5e
  (computed: live + the ONE file swapped; runbook G9 pins it)
INVARIANTS (G9 + post-swap): scheduler.js stays e3e8dce0…, root package.json stays d5764403…,
  file SET unchanged (no added/removed files), job_disposition string present in the deployed file
NON_TARGET: harness/node-runtime/home/config/helper/routing PRE==POST (routing now pinned at the REAL
  path /usr/local/libexec/agent-core/config/scheduler-routing.json — inside the hashed config/ tree)
DO_NOT_TOUCH: store (jobs.json/runs.jsonl), credentials, plists, HR mitigation (retry.auto stays false)
```

## Out-of-scope disclosures (not touched, owned by their lanes)

The same 246-file census found 28 other live-vs-41f354d diffs: intentional
production pins (production-runtime compose/model-overrides/paths, launchd
script adapters) and OTHER lanes' undeployed features (broker workflow /
workflow-execute / gateway / registry / schema = Domain-Create & archive
lanes; agent-router / agent-memory / provisioning; demo-server; product-api;
scheduler-router; scripts/agentcore-cron) plus ONE live-only file
(production-runtime/src/scheduler-history-runtime.js, a live-side variant).
None is governed by SCHEDULER_SELF_HEALING_FROM_FEISHU_V1; none ships in V7B.

## Gates (all fail-closed, V7 r5 skeleton)

exactly-once noclobber marker (deploy-v7b.auth under scheduler-self-healing-v7b-apponly/) ·
G1 source-file pin (sha b302810c… + job_disposition present) · G2 live == c41a9045… (drift=STOP) ·
G3 mutation/deploy/routing-tx locks ABSENT + engine lease positively HELD by the canonical runtime ·
G4 runtime health (process + 8790 + W2 heartbeat/log) · G5 HR b115cb96 retry.auto==false (frozen to receipt) ·
G6b conflicting mutation process pgrep, self-family excluded (sudo/bash/tee contain "deploy-v7b"; a
concurrent v7b double-run is impossible past G0; stale V7 reruns and installer-family processes DO conflict) ·
G7/G7b no in-flight occurrence · G8 space · G9 manifest==f261066d… + single-file sha + job_disposition present
+ scheduler.js/root-pkg invariants + pm-guard · non-target PRE/POST equality → auto-rollback ·
HR-after re-check → auto-rollback · dual receipts.

## Deployment attempt ledger (2026-09-18)

```text
APP-ONLY V7   11:35:07Z  EXECUTED=PASS  CONSUMED (marker scheduler-self-healing-v7-apponly/receipts/deploy-v7.auth)
INSTALLER V9  ~11:11Z    CONSUMED-FAILED at B2_PREBUILD (pnpm pin mismatch 10.28.1!=11.7.0) — Owner-disclosed;
                         ZERO MUTATION; lane PAUSED_NO_FURTHER_EXECUTION; V9_FURTHER_EXECUTION_AUTHORIZED=NO
THIS PACKET (V7B)       UNCONSUMED — requires FRESH Owner authorization (AUTHORIZED_ATTEMPTS=1 semantics);
                         marker scheduler-self-healing-v7b-apponly/receipts/deploy-v7b.auth
```

## Execution (single attempt)

```text
RUNBOOK=deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v7b.sh
RUNBOOK_SHA256(V7B)=d66c482511140ad87b50dfc46e1e420e0fcd9b4cbf23a8a0f623e2186f4f2ac3 (archived byte-identical copy in this directory;
  pre-review build: G6b self-exclusion fix applied before first fixture run; FIXTURE=PASS observed)
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v7b.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v7b.log
Readbacks: /private/tmp/scheduler-self-healing-deploy-v7b-receipt/deploy-receipt.txt +
  /usr/local/var/agent-core/scheduler-self-healing-v7b-apponly/receipts/deploy-v7b.receipt
ANY exit consumes the authorization (including G1-G9 pre-swap failures = zero mutation).
```

## Reviews

```text
MECHANICAL_REVIEW=PASS / BLOCKERS=NONE — executed-verification on the v7b bytes (d66c4825…):
  full v7→v7b delta inventory zero-regression, FIXTURE rerun, G6b decoy sim both directions,
  marker noclobber sim, independent manifest recomputation (live c41a9045 / target f261066d /
  source b302810c), invariants live-verified, no false-fail/no fail-open. See V7B-REVIEW-MECHANICAL.md
SAFETY_REVIEW=PASS / BLOCKERS=NONE — blast radius confined; one-file diff = pure manifest
  extension (1 hunk, zero imports, gateway old-op wiring unchanged); ten post-swap failure paths
  all auto-rollback w/ forensics; occurrence predicate = exactly the restart-fragile set; routing
  now genuinely covered via config/ tree; reviewer's own /tmp rebuild reproduced both manifests.
  See V7B-REVIEW-SAFETY.md
```
