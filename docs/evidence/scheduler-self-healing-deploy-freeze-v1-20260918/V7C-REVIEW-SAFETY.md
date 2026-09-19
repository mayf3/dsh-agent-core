# V7C — INDEPENDENT PRODUCTION SAFETY REVIEW (2026-09-19, bytes 0de835fc…)

SAFETY_REVIEW=PASS — BLOCKERS: NONE

1. BLAST RADIUS: writes confined to scheduler-self-healing-v7c-apponly/ (0700; marker/h_JOB/receipt),
   /private/tmp v7c-receipt, /tmp pm-shim, app.next/rollback/failed-v7c-$TS, kickstart. ZERO writes to
   /Users/authsvc/.agent-core, harness, node-runtime, home, config, helper, credentials, plists, store.
2. TWO FILES PROVEN: self-ops.js = 1 hunk vs live (pure manifest op, zero imports, listing-time data via
   broker index.js selfOpsManifests spread); gateway.js = EXACTLY two hunks inside availabilitySnapshot()
   (readiness conjunct + operations entry) — presentation-only booleans on the §5.3.1 seam; ops loop and
   credentialsFileConfigured untouched; no other capability's readiness changes. Dispatch generic
   (handlersForCall().self_ops); deployed scheduler handler job_disposition→createJobDisposition live
   (self-ops/index.js L78/L268, diagnosis.js L65). Manifest arithmetic proven by independent substitution:
   1174-file set, two frozen hashes → 2d45fda7 exact — WAP's divergent bytes (workflow-execute/workflow/
   registry/schema) provably untouchable. Modes: live 644 authsvc:authsvc; root cp+chown reproduces exactly.
3. ROLLBACK: eleven post-swap failure modes → post_swap_fail → restore + forensic failed-v7c-$TS + exit 1;
   partial-mv guarded + existence-verified with manual-recovery pointer; warning-only rollback health
   acceptable (KeepAlive=true verified; W2 StartInterval=900 verified).
4. EXACTLY-ONCE: noclobber at G0 before all gates; namespace disjoint from all prior packets (v7b-apponly
   confirmed never created).
5. G6b: wap-broker-only-deploy + scheduler-self-healing-deploy families caught; self-exclusion masks only
   our own sudo/bash/tee; G0 precedes G6b so v7c-vs-v7c blocked upstream.
6. IN-FLIGHT: admitted|running = exactly the non-terminal restart-fragile set; outcome_unknown terminal-fenced.
7. HR FREEZE: selectors match job-model schema; frozen to receipt; post-swap auto==false re-check.
8. PM/NETWORK: curl only 127.0.0.1:8790/health ×3; shims armed pre-build, checked post-build + post-swap.
9. CONTINUITY: kickstart label matches plist; W2 routing.js imports only read primitives — cannot spuriously
   break non-target equality; routing pinned at the real config/scheduler-routing.json.
10. FIXTURE=PASS (independent expectation path, full round-trip).

NON_BLOCKING: G6b spoofing cmdline theoretical (mitigated by G0/G2/G9); G7b→swap seconds-wide TOCTOU
(consequence = fenced reconcilable outcome_unknown); receipt-cp failure exits 1 after success (readback
both paths); W2 firing inside the window could false-fail pid stability → fail-safe rollback; engine-lease
warning-only; /tmp litter; non-root could not read G3/G5/G7 live data (fail-closed pre-swap gates).

FIXTURE_RERUN: PASS — cleared for the single authorized root execution.
