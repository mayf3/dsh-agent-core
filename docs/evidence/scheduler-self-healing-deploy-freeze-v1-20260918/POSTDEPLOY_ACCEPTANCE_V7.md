# V7 POSTDEPLOY ACCEPTANCE — TIER-1 RECORD + GAP FINDING (2026-09-18)

V7 execution: Owner terminal, exact frozen command, runbook sha cb0f12b2… —
**DEPLOYMENT=PASS at 2026-09-18T11:35:07Z** (receipts: /private/tmp/scheduler-self-healing-deploy-v7-receipt/deploy-receipt.txt
+ /usr/local/var/agent-core/scheduler-self-healing-v7-apponly/receipts/deploy-v7.receipt [root 0700]).

## Deployed facts (root-side receipt)

```text
DEPLOYED_APP_MANIFEST_SHA=c41a90453d0170085b3959943af70b1111c9403b5191e097649e28c01c4e15b7  == frozen target EXACT
DEPLOYED_SCHEDULER_JS=e3e8dce0fd8959336521147b639007b82e8ce98d932eca82ca2b98ac2506770d      == frozen target EXACT
RUNTIME_PID=3380 (started 19:33:46 local; stable; health ok at 19:39+)   ENGINE_LEASE_PID=3380 (re-acquired, no warning)
ROLLBACK_GENERATION=/usr/local/libexec/agent-core/app.rollback-v7-20260918T113325Z (V7 preimage, preserved)
NON_TARGET_PRE_POST: harness/node-runtime/home/config/helper ALL byte-equal PRE==POST
  (routing pinned the wrong legacy path /Users/authsvc/.agent-core/scheduler/routing.json → empty==empty vacuous;
   the REAL routing manifest config/scheduler-routing.json is INSIDE the hashed config/ tree → covered)
HR_JOB_BEFORE={"id":"b115cb96-8a4f-49be-9baa-519223022b59","retry":{"auto":false},"scheduleRevision":3,"updatedAtMs":1789646913132,"enabled":true}
HR_JOB_AFTER ={"retry":{"auto":false},"scheduleRevision":3}   → mitigation intact; bounded re-enable anchor frozen
ERROR_TAIL_COUNT_LAST200=0 (T+90s)   RUNS_JSONL_PARSE_SMOKE=OK   PM_GUARD=CLEAN
```

## Structural verification (unprivileged, post-swap)

- packages/scheduler subtree == 41f354d EXACTLY (built manifest equality; zero scheduler diffs in the 246-file census).
- src/self-ops/{diagnosis,invoker-outcome}.js + src/watchdog/{admission-isolation,slot-accounting}.js + src/history/* present;
  diagnosis.js=4038e4f8… admission-isolation.js=5c770d5e… == G6c pins.
- No app.failed-v7-* (no rollback triggered). apponly state dir 0700 root (durable receipt unreadable unprivileged — by design).
- w2.log continuously `suppressed_or_healthy`; ZERO EXPECTED_RUN_MISSED / tick-failed / GLOBAL_FATAL signatures post-deploy.

## Acceptance verdicts (Owner's seven items)

| Item | Verdict |
|---|---|
| CROSS_REVISION_POISON_ERROR_DELTA=0 | PASS (receipt scan 0 @T+90s + W2 clean window + suite RED→GREEN on these exact bytes) |
| GLOBAL_TICK_CONTINUES=YES | PASS (runtime 3380 stable, engine lease held, W2 healthy, zero alarm signatures) |
| UNRELATED_JOBS_MINT=YES | PENDING live numbers — store 0700 unprivileged; census line prepared (reads jobs.json/runs.jsonl as authsvc) |
| JOB_DISPOSITION_V2 | **BLOCKED — GAP FOUND (see below)** |
| ONE_BAD_JOB_ISOLATION | bytes live + suite-proven (T2a/T2b) + live negative evidence; full live proof lands in E2E |
| W1_W2 | PASS (w2.log fresh+healthy; root-side heartbeats pinned by plist) |
| G6_CARRY_FORWARD_CANARY | carried into the REAL natural future slot proof (Phase D / step 6) |

**POSTDEPLOY_VERIFICATION=WITHHELD** (not a deployment failure — one spec-governed surface missing, below).
Per Owner sequence + spec header, **HR retry.auto re-enable stays FROZEN** until verification PASS.

## GAP FOUND — broker self-ops manifest is stale (the ONE spec-governed miss)

Postdeploy census: all 246 packages/+scripts files of the live app compared byte-wise vs 41f354d → 29 DIFF:

- packages/scheduler: ZERO diffs (the poison fix + isolation are fully live).
- 28 non-scheduler diffs = intentional production pins (production-runtime compose/model-overrides/paths, scripts
  launchd adapters) + OTHER lanes' undeployed features (broker workflow/workflow-execute/gateway/registry/schema =
  Domain-Create & archive lanes; agent-router/memory/provisioning; demo-server; product-api; scheduler-router;
  scripts/agentcore-cron). NOT touched; NOT this spec's governed set; each stays with its own lane.
- **Exactly ONE diff is governed by SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 `governs:`**:
  packages/broker/src/capabilities/self-ops.js — live = 62905c1-era (5c5ebc86…, status+reconcile_turn only),
  41f354d = b302810c… (adds the job_disposition operation, commit 7e66c79 — already in main lineage pre-bb5327f).
  Root cause: the freeze's delta claim ("bb5327f..41f354d touches scheduler only") was computed against the WRONG
  base — the true preimage was the 62905c1-era narrow-closure mixture, whose broker predates bb5327f.
- Impact: agents' self_ops tool surface lacks job_disposition → spec §3 v2 cannot go live → REAL_FEISHU_DIAGNOSIS
  impossible. The old manifest is dispatch-compatible with the new scheduler (pure manifest, zero imports; runtime
  stable), so nothing is broken — the surface is simply absent.
- FIX = V7B: same app-only sealed-generation mechanics, scope = that ONE file. Target manifest computed from the
  LIVE generation + the single file: f261066d77dedb2240c2e328eebbccd26ce7e9a97055212874c0616d248a1a5e.
  See FREEZE_V7B.md.
