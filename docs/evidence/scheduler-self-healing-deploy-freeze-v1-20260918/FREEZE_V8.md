# FREEZE V8 — ONE-FILE APP-ONLY SEALED GENERATION (Tools V4 implementation, 2026-09-19)

Authority: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4 ACCEPTED in main (a946be2, lifecycle-only
transaction, validator PASS) + Owner ruling SELF_OPS_MODEL_VISIBLE=YES. Implementation a5fed40
(dual-reviewed SEMANTIC=PASS SAFETY=PASS BLOCKERS=NONE; broker 478/478, scheduler 373/373;
structure gate 0 new violations).

## Scope (fresh baseline 2026-09-19 18:43)

```text
LIVE_PREIMAGE_APP_MANIFEST=2d45fda740f4f8427cac6d953e2dd4fcbc2a36d1c40e70d1861c457678e29764
  (the V7C generation — stable 10+h; runtime pid 76663 alive; health PASS; locks empty)
TARGET_APP_MANIFEST_SHA256=23ed158245424e9e42833fab6f344c8fa68c0e725e9cdc330a4f266882687cf1
  (= live + exactly ONE file; file SET unchanged)
SCOPE=packages/broker/src/capabilities/self-ops.js ONLY
  b302810c… -> e7f6105de4be81e37ccc60e983fe005751880d9b8a0af93c9e0602a78da87620
  (= V7C bytes MINUS the single `infrastructure: true,` line; Tools V4 §V4-DELTA)
INVARIANTS (G9+post): gateway.js 4c341db4… (V7C wiring unchanged), scheduler.js e3e8dce0…,
  root package.json d5764403…, file SET unchanged, job_disposition present in deployed file
NON_TARGET: harness/node-runtime/home/config/helper/routing PRE==POST (real-path pin retained)
DO_NOT_TOUCH: store, credentials, plists, other lanes' broker bytes, HR mitigation
```

## Gates (V7C-proven skeleton, single-file scope)

G0 noclobber exactly-once marker (deploy-v8.auth under scheduler-self-healing-v8-apponly/) ·
G1 source pin (sha e7f6105d… + job_disposition present + infrastructure ABSENT) · G2 live ==
2d45fda7… · G3 locks ABSENT + engine lease held by canonical runtime · G4 runtime health ·
G5 HR retry.auto==false frozen to receipt · G6b conflicting-mutation pgrep (self family
'deploy-v8' excluded; wap-broker-only-deploy + stale v7/v7c reruns + installer family caught) ·
G7/G7b no in-flight occurrence · G8 space · G9 manifest==23ed1582… + self-ops sha + greps +
gateway/scheduler/pkg invariants + pm-guard · non-target PRE/POST → auto-rollback · HR-after →
auto-rollback · dual receipts.

## Attempt ledger

```text
V7 09-18 EXECUTED=PASS (consumed) · V7B VOID (stale preimage, never executed) ·
V7C 09-19 08:34 EXECUTED=PASS (consumed) · THIS V8 UNCONSUMED — attempts=1, any exit consumes.
ROOT COMMAND (single line):
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v8.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v8.log
```

## Reviews

```text
RUNBOOK_SHA256(V8)=d618bb55047d1a52f98e8b1362a08dc4198eb8f7852b7ee96d6d4d762652fa8b
  (archived byte-identical copy in this directory; FIXTURE=PASS)
MECHANICAL_REVIEW=see V8-REVIEW-MECHANICAL.md
SAFETY_REVIEW=see V8-REVIEW-SAFETY.md
```
