# V8 — INDEPENDENT PRODUCTION SAFETY REVIEW (2026-09-19, bytes d618bb55…)

## IMPLEMENTATION_SAFETY_REVIEW=PASS — BLOCKERS: NONE

1. BLAST RADIUS: writes confined to scheduler-self-healing-v8-apponly/ (0700), RB_TMP, pm-shim
   /tmp, app.next/rollback/failed-v8-$TS, kickstart. Store/runs/credentials/plists/home/
   harness/node-runtime/config READ-only.
2. ONE FILE byte-exact vs a5fed40: exactly the `infrastructure: true,` line removed from
   self-ops.js; sole consumer = registry.js:255 visibility filter; schema canonicalization
   no-op when absent; gateway readiness is handler-wired (pinned 4c341db4); execute path
   untouched; agent_session_send_reconcile provably untouched (separate file, keeps flag,
   V8 copies ONLY self-ops.js; regression asserts its absence from the model list).
   Independent 1174-file recompute: live+e7f6105d reproduces 23ed1582 exactly.
3. ROLLBACK: eleven post-swap failure modes → post_swap_fail → restore + forensic
   failed-v8-$TS + exit 1; partial-mv guarded; restore-failure demands manual recovery.
4. EXACTLY-ONCE: noclobber at G0 before all gates; v8-apponly namespace absent/disjoint.
5. G6b: self family excluded; wap/installer/stale-v7 families caught; G2/G9 manifest pins
   mitigate concurrent-mutation residue.
6. IN-FLIGHT: admitted|running = exactly the non-terminal restart-fragile set; jq failure
   fail-closed; G7b adjacent re-check.
7. HR FREEZE: selectors + receipt + post-swap re-check → auto-rollback.
8. PM/NETWORK: curl only 127.0.0.1:8790/health; shims armed/checked ×3.
9. CONTINUITY: kickstart label/plist consistent; outage ≈10-20s; routing pinned via
   config-tree PRE==POST (real file present).
10. FIXTURE=PASS (independent assembly, round-trip).
11. FLEET EXPOSURE structurally safe: universal visibility, caller-scoped enforcement
    (untouched scheduler self-ops layer, opaque foreign denies); sessions need worker
    recycle to SEE the tool — operational, not safety.

## PREREQUISITE (actioned): land/checkout e7f6105d at SOURCE_ROOT before the root run
(resolved — see V8-REVIEW-MECHANICAL.md B1 resolution).

## NON_BLOCKING
PRE-EXECUTION prerequisite was the only action item (resolved); rollback-health warning-only
(restore is hash-verified preimage; manual inspection on warning); receipt-cp failure exits 1
after success (readback both paths).
