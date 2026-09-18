# V7B — INDEPENDENT PRODUCTION SAFETY REVIEW (2026-09-18, bytes d66c4825…)

SAFETY_REVIEW=PASS — BLOCKERS: NONE

1. BLAST RADIUS CLEAN: writes confined to STATE_ROOT (0700)+marker+hr-job-before+receipt,
   /private/tmp v7b-receipt, /tmp pm-shim, app.next-v7b-$TS + same-parent atomic renames
   (app/rollback-v7b/failed-v7b). ZERO writes to /Users/authsvc/.agent-core, harness,
   node-runtime, config, credentials.
2. ONE FILE = PURE EXTENSION: live(5c5ebc86)→41f354d(b302810c) diff = exactly 1 hunk (added
   job_disposition op); zero imports; status/reconcile_turn byte-equivalent; errorCodes shared;
   consumed as listing-time data (broker src/index.js:63,103 spreads selfOpsManifests); live
   scheduler handler already deployed (V7); live gateway readiness gates only status+reconcile_turn
   (unchanged, old wiring cannot break); worktree gateway readiness addition is another lane's
   undeployed file, correctly NOT shipped. No schema migration. Manifest hashes independently
   recomputed: live=c41a9045, live+one-file=f261066d.
3. ROLLBACK COMPLETE: all ten post-swap failure paths → post_swap_fail → restore + forensic
   failed-v7b-$TS + exit 1; partial-mv path guarded + restore-existence verified with FATAL
   pointer; warning-only rollback-health acceptable (KeepAlive=true verified, W1/W2 supervise).
4. EXACTLY-ONCE SOUND: noclobber marker acquired G0 before all gates; namespace disjoint from
   v5/v6/v7/v7-apponly(consumed)/v8/v9 (ls-verified).
5. G6b SOUND: G0 strictly precedes G6b (double-run already dead); grep -v deploy-v7b masks only
   our sudo/bash/tee family; stale V7 rerun + installer family still conflict → fail-closed.
6. IN-FLIGHT EXACT: OCCURRENCE_STATES={admitted,running,succeeded,failed,outcome_unknown};
   G7/G7b admitted|running = exactly the restart-fragile set; outcome_unknown fenced+reconcilable.
7. HR FREEZE schema-exact (job-model enabled/scheduleRevision/updatedAtMs/retry.auto; startswith
   b115cb96); frozen to receipt; post-swap auto==false re-check → auto-rollback.
8. PM/NETWORK CLEAN: curl only 127.0.0.1:8790/health; shims armed pre-build, checked post-build
   and post-swap.
9. CONTINUITY OK: kickstart label matches plist; outage ~10-20s inside sleeps (~65s to receipt);
   W2 StartInterval=900, routing manifest = config/scheduler-routing.json (root:authsvc 640) inside
   hashed config/ tree — the V7 vacuous-path gap is closed; W2 routing.js has no write primitives.
10. FIXTURE PASS (exit 0). 11. All gates fail-closed; jq-missing fail-closed; renames same-parent
    atomic; space 2x+20MB; live drift between G2 and cp -a caught by G9 pin.

NON_BLOCKING: inert app.next-v7b residue on pre-swap APPLY failure; receipt-copy failure exits 1
after success (readback both paths); engine-lease re-acquire warning-only (acceptance re-checks);
err_tail BRE alternation evidence-only; G6b pgrep error(2) indistinguishable from no-match
(inherited from the PASS predecessor); /tmp fixture dirs not trap-cleaned (inert).

FIXTURE_RERUN: PASS — safe to execute ONCE as root; preconditions independently confirmed.
