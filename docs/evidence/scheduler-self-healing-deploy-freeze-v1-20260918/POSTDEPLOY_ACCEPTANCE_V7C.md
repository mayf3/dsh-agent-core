# V7C POSTDEPLOY ACCEPTANCE — CLOSED (2026-09-19)

V7C executed by Owner 08:32-08:34 local (COMMITTED_AT=2026-09-19T00:34:10Z):
DEPLOYED_APP_MANIFEST=2d45fda7… exact · self-ops=b302810c… / gateway=4c341db4… exact ·
scheduler.js=e3e8dce0… unchanged · runtime pid 76663 stable (engine lease re-acquired) ·
routing PRE==POST=41a1d510… (real-path pin, non-empty) · non-target surfaces byte-equal ·
HR anchor frozen unchanged · ERROR_TAIL=0 · PM_GUARD=CLEAN ·
rollback generation app.rollback-v7c-20260919T003225Z preserved.

## Seven acceptance items — ALL CLOSED

| Item | Verdict | Evidence |
|---|---|---|
| CROSS_REVISION_POISON_ERROR_DELTA=0 | PASS | receipt T+90s=0 + census live: 0 tick-failure signatures since V7C; 4281 runs events, 0 unparseable |
| GLOBAL_TICK_CONTINUES=YES | PASS | pid 76663 stable, health ok, W2 suppressed_or_healthy |
| UNRELATED_JOBS_MINT=YES | PASS | mint machinery live under the new runtime: HR occurrence minted 00:40:16Z with the FULL event chain (slot_accounting×2, router_admission×2, occurrence_reserved, turn_start, outcome, delivery) → succeeded; fleet breadth accrues across 40 enabled jobs |
| JOB_DISPOSITION_V2 | PASS (structural) | surface LIVE: self-ops.js b302810c (1 job_disposition) + gateway.js 4c341db4 (2) deployed+hash-pinned; dispatch generic (handlersForCall); server handler live (self-ops/index.js → createJobDisposition). Live behavioral proof lands in the Phase D Feishu diagnosis leg |
| ONE_BAD_JOB_ISOLATION | PASS | suite-proven bytes live (T2a/T2b) + zero global-tick events since V7C |
| W1_W2 | PASS | heartbeat/log fresh + healthy throughout |
| G6_CARRY_FORWARD_CANARY | PASS | the HR occurrence IS the real end-to-end chain on the deployed scheduler bytes (admitted→turn→outcome→delivery, succeeded) |

**POSTDEPLOY_VERIFICATION=PASS** (census 2026-09-19 08:4x: 44 jobs/40 enabled; 670 occurrences
failed 48 / succeeded 618 / outcome_unknown 4; 1 fresh occurrence since V7C = full chain succeeded).

## HR bounded re-enable (pre-authorized step 4) — DONE with receipt

REENABLE_COMMITTED_AND_VERIFIED: retry.auto false→true, scheduleRevision 3→4,
updatedAtMs=1789779023244, revisionActivatedAtMs set, readback==receipt, exact job only
(b115cb96-8a4f-49be-9baa-519223022b59), evidence appended to runs.jsonl.
New anchor {rev4, 1789779023244}. 04:42 slot now has full retry-proof potency.

## OPEN ITEM — G7/G7b anomaly (self-reported, bounded consequence)

c9d52a33 (platform-data-cdp-daily, agt_content-ops-agent) occurrence occ:3ac47524eceae156 was
admitted 00:30:01Z — BEFORE V7C script start 00:32:25Z — yet G7 and G7b both PASSed. If the turn
was in-flight (admitted/running) at gate time, both gates should have stopped the packet; if the
turn had already completed, the gates are fine. Consequence materialized as ONE fenced
outcome_unknown (crash-guard reap at boot) — reconcilable, zero corruption; it is now the Phase D
REAL_FEISHU_RECOVERY target. Forensics instrument ready (census 'timeline' mode: runs.jsonl
00:25-00:45Z window + full occurrence/job records). If a gate gap is confirmed, the fix lands in a
future runbook revision — this packet's outcome is unaffected.

## Phase D state

腿① recovery target selected: c9d52a33 / agt_content-ops-agent (reconcile doubles as healing the
V7C-restart casualty). 腿② HR diagnosis line issued. 腿③ 04:42 slot census pending tomorrow.
