# FREEZE V7C — TWO-FILE APP-ONLY SEALED GENERATION (fresh live baseline 2026-09-19)

Supersedes the voided V7B (STALE_PREIMAGE — never executed, marker never created).
Built per Owner directive RESUME_POST_V7_BROKER_JOB_DISPOSITION_CLOSURE from a
FRESH production census at 2026-09-19 07:56 against the current authoritative
generation — NOT inherited from any earlier packet.

## Fresh census verdict (live 6447676c…, runtime pid 12649, health PASS, locks empty, W2 healthy)

```text
packages/scheduler/**  vs cfc2729: ZERO diffs (LIVE_SCHEDULER_JS_SHA=e3e8dce0… == expected;
  poison fix + isolation fully live across the 20:44 and 06:57 external generational swaps)
packages/broker/**     vs cfc2729: 37 files, 32 MATCH, 6 DIFF —
  src/capabilities/self-ops.js   live 5c5ebc86 vs cfc b302810c  ← THIS GOAL (adds job_disposition op)
  src/gateway.js                 live f700960a vs cfc 4c341db4  ← THIS GOAL (adds job_disposition
                                                    readiness gate + operations entry; the diff vs
                                                    live is EXACTLY those two hunks)
  src/capabilities/workflow-execute.js / workflow.js / src/registry.js / src/schema.js
                                 ← OTHER LANES' surfaces (workflow lanes; archive-repair debt).
                                    NOT governed by SCHEDULER_SELF_HEALING_FROM_FEISHU_V1 — UNTOUCHED.
JOB_DISPOSITION_MODEL_VISIBLE=NO   (manifest lacks the operation)
JOB_DISPOSITION_DISPATCHABLE=NO    (gateway readiness excludes it; server-side handler IS live in
                                    the deployed scheduler self-ops/index.js -> createJobDisposition)
PRODUCTION_MUTATION_REQUIRED=YES (minimal TWO-file scope)
```

## Scope ruling (this packet)

```text
TARGET_SOURCE_SHA=41f354d163f532348b2ad1ef33b5ee528655dfc6 — both target bytes verified IDENTICAL
  across 41f354d / cfc2729 / reviewed worktree (fresh-proven accepted target):
  self-ops.js = b302810c29c92404fcf538819af5bb997410c395fd42d10e93377729d221907a
  gateway.js  = 4c341db4d0369811b3df4a4eb7e711af33fdf84abe17a39349c5f75e7830490e
LIVE_PREIMAGE_APP_MANIFEST=6447676c4db88d09e8b4d178d4ee41f0b533c1f078f3b3b5554b05aeadbaaa06
TARGET_APP_MANIFEST_SHA256=2d45fda740f4f8427cac6d953e2dd4fcbc2a36d1c40e70d1861c457678e29764
  (= live + exactly the two files; file SET unchanged; recomputed via the runbook's own
   find -type f pipeline, which reproduces the live 6447676c baseline exactly)
INVARIANTS (G9 + post-swap): scheduler.js stays e3e8dce0…, root package.json stays d5764403…
  (live-verified), file SET unchanged, job_disposition present in BOTH deployed files
NON_TARGET: harness/node-runtime/home/config/helper/routing PRE==POST (routing pinned at the real
  /usr/local/libexec/agent-core/config/scheduler-routing.json)
DO_NOT_TOUCH: store, credentials, plists, WAP's legitimate broker bytes (workflow-execute/workflow/
  registry/schema), HR mitigation (retry.auto stays false)
```

## Gates (all fail-closed; V7 r5/r7b-proven skeleton)

G0 noclobber exactly-once marker (deploy-v7c.auth under scheduler-self-healing-v7c-apponly/) ·
G1 two-file pins (shas + job_disposition greps) · G2 live == 6447676c… (drift=STOP) · G3 locks
ABSENT + engine lease positively held by canonical runtime · G4 runtime health · G5 HR b115cb96
retry.auto==false frozen to receipt · G6b conflicting-mutation pgrep with self-family exclusion
('deploy-v7c'; additionally guards wap-broker-only-deploy and stale v7/v7b reruns; v7c-vs-v7c
double-run blocked by G0) · G7/G7b no in-flight occurrence · G8 space · G9 manifest==2d45fda7… +
both file shas + greps + scheduler.js/root-pkg invariants + pm-guard · non-target PRE/POST
equality → auto-rollback · HR-after re-check → auto-rollback · dual receipts.

## Execution attempt ledger

```text
V7   09-18 11:35:07Z  EXECUTED=PASS (consumed)
V7B  —                STALE_PREIMAGE, never executed, marker never created (zero consumption)
V7C  —                UNCONSUMED — requires FRESH Owner authorization; AUTHORIZED_ATTEMPTS=1;
                      ANY exit consumes (including G1-G9 pre-swap failures = zero mutation)
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v7c.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v7c.log
Readbacks: /private/tmp/scheduler-self-healing-deploy-v7c-receipt/deploy-receipt.txt +
  /usr/local/var/agent-core/scheduler-self-healing-v7c-apponly/receipts/deploy-v7c.receipt
```

## Reviews

```text
RUNBOOK_SHA256(V7C)=0de835fcb45b2873bddf23574fff98210813b52bbc5333f9d29bcfb6927741e2
  (archived byte-identical copy in this directory; fixture-caught source-layout bug fixed before
   first green run; FIXTURE=PASS observed)
MECHANICAL_REVIEW=PASS / BLOCKERS=NONE — executed verification: fixture rerun, full v7b→v7c delta
  inventory zero-regression, independent manifest recomputation (live 6447676c / target 2d45fda7),
  noclobber + G6b decoy sims (wap + v7-family caught, self family excluded), set-u audit, live spot
  checks. See V7C-REVIEW-MECHANICAL.md
SAFETY_REVIEW=PASS / BLOCKERS=NONE — blast radius confined; gateway diff = EXACTLY the two
  job_disposition hunks (presentation-only seam, dispatch generic, live scheduler handler verified);
  independent 1174-file two-hash substitution reproduces the target manifest exactly (WAP bytes
  provably untouchable); eleven post-swap failure modes auto-rollback; W2 read-only to routing.
  See V7C-REVIEW-SAFETY.md
```
