# FREEZE V9 — ONE-FILE APP-ONLY SEALED GENERATION (G5 anchor corrected, 2026-09-19)

V8 fail-closed at G5 (zero mutation, authorization consumed by exactly-once discipline):
V8's G5 asserted the PRE-re-enable HR state (retry.auto==false) but the Owner-authorized
bounded re-enable had already landed (rev4/auto:true/updatedAtMs=1789779023244, receipt
REENABLE_COMMITTED_AND_VERIFIED). Packet-authoring miss (V8 inherited the V7C-era G5);
consequence bounded: zero production writes, live unchanged.

## V9 = byte-identical to V8 EXCEPT G5

```text
G5 (pre-swap): assert HR b115cb96 == AUTHORIZED RE-ENABLE ANCHOR
  {enabled==true, retry.auto==true, scheduleRevision==4, updatedAtMs==1789779023244}
  — fail-closed on drift (anchor from the receipted re-enable; if the unified/
  other lanes touch the store again, G5 stops the packet)
G5 freezes the full state to hr-job-before.json (receipt)
POST-SWAP: require the FULL anchor to persist (retry.auto==true && rev==4 &&
  updatedAtMs==1789779023244) else AUTO-ROLLBACK — stronger than V8's auto-only check
EVERYTHING ELSE: byte-identical to V8 (sha d618bb55…), same ONE-file scope
  (self-ops.js b302810c→e7f6105d), same invariants/gates/G6b/fixture semantics.
```

## Coordinates (fresh at authoring)

```text
LIVE_PREIMAGE=2d45fda7… (unchanged; V8 zero mutation confirmed: live manifest recomputed)
TARGET_APP_MANIFEST_SHA256=23ed158245424e9e42833fab6f344c8fa68c0e725e9cdc330a4f266882687cf1
SOURCE pin=e7f6105d… (Tools V4 accepted bytes, bound in freeze worktree 3d9dbc7)
RUNBOOK_SHA256(V9)=0389fc1561562af1854c9fd16b528f79614f4047c62526afb115d80f7efd7f49
  (archived byte-identical copy; FIXTURE=PASS; attempts=1, any exit consumes)
ROOT COMMAND:
  sudo bash /Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/deployment-artifacts/scheduler-self-healing-v1/scheduler-self-healing-deploy-v9.sh 2>&1 | tee /private/tmp/scheduler-self-healing-deploy-v9.log
```

## Reviews

```text
NARROW_DELTA_REVIEW(V8→V9)=see V9-REVIEW-NARROW.md (G5 anchor + mechanical renames only)
CARRY_FORWARD: V8 dual reviews (MECHANICAL PASS-after-B1 / SAFETY PASS) remain valid for all
carried gates — V9 changes ONLY the G5 anchor semantics and packet naming.
```
