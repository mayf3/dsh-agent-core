# V7 r5 — INDEPENDENT PRODUCTION SAFETY REVIEW (final bytes)

Date: 2026-09-18 · Subject: scheduler-self-healing-deploy-v7.sh sha256
cb0f12b203bc8caddcbc7b595537f8a764082e519009d9a4557f5f83c8283f40 (worktree copy cmp-identical
to the archived copy) · Reviewer: independent agent; blast radius / rollback completeness /
fail-closedness charter; read-only outside /tmp sandboxes, no sudo, production_main never
executed.

## SAFETY_REVIEW=PASS — BLOCKERS: NONE

## Checklist verdicts (line numbers refer to scheduler-self-healing-deploy-v7.sh)

1. BLAST RADIUS — PASS. Production writes: STATE_ROOT dir/marker/hr-job-before.json/receipt
   (:180-191, :264, :397), RB_TMP receipt (:182, :396), /tmp pm-shim (:58-64), build under
   $TRUSTED_ROOT/app.next-v7-$TS with rm confined to that new path (:71-79), generation renames
   app↔app.rollback-v7-ts↔app.failed-v7-ts (:94-95, :101-102, :337-343), launchctl kickstart
   (service state only). NO write path exists to /Users/authsvc/.agent-core (store/runs),
   harness/, node-runtime/, home/, config/, credentials — all read-only (:261, :294, :324, :357,
   :361-363, :374; :328-332, :365-370).
2. STORE INTEGRITY — PASS. jq/tail read-only on jobs.json/runs.jsonl. G7/G7b predicate
   admitted|running (:294, :324) matches exactly the restart-fragile states: OCCURRENCE_STATES =
   {admitted, running, succeeded, failed, outcome_unknown} with no scheduled/dispatched state
   (occurrence-model.js:21,42-43). Unresolved outcome_unknown is durable+fenced (fences rebuilt
   on load store.js:237-238; admissions refused while fenced occurrence.js:67-68) so a restart
   over it strands nothing — the guard is not false-quiet for the hazard it targets (engine crash
   guard occurrence.js:204 fires only for killed admitted/running turns). Store writes are
   atomic temp+rename (store.js:319-330).
3. OWNERSHIP — PASS. chown -R authsvc:authsvc covers exactly the two cp-created paths (:78-80)
   under the root guard; everything else arrives via cp -a preserving ownership (live app
   verified uniformly authsvc:authsvc; mv preserves; plist UserName=authsvc KeepAlive=true; no
   logs/caches live inside app/).
4. ROLLBACK COMPLETENESS — PASS. All 8 post-swap failure modes route to post_swap_fail:
   kickstart (:345), runtime missing (:348), pid instability (:351), health (:352), deployed
   scheduler.js (:354), non-target drift (:373), HR retry change (:375), pm guard (:377) →
   restore with failed generation preserved for forensics (:101-102 via :201) → kickstart →
   health readback → exit 1. Restore failure exits FATAL naming app_rb (:202). Partial mv
   handled with post-restore existence verification (:338-343); same-filesystem renames atomic;
   rm -rf "$APP" (:340) can only run when APP is nonexistent or the half-swapped next.
   Rollback-health being warning-only is acceptable: preimage verified healthy, launchd
   KeepAlive + ThrottleInterval=10s auto-retries, W1/W2 supervise.
5. EXACTLY-ONCE — PASS. noclobber O_EXCL create (:186-187) atomic against double execution;
   consumed at G0 before any gate; every exit path leaves it. Namespace
   scheduler-self-healing-v7-apponly verified absent today and disjoint from the consumed
   installer v7/v8 namespaces.
6. NO BLIND RETRY / NO LOCK DELETION — PASS. rm targets are only the build output, the
   scheduler subtree inside it, and the partial-mv APP (:71, :73, :340) — no lock/marker is ever
   deleted or rewritten. G3 (:225-241) requires locks absent and the engine lease positively
   held: numeric pid, kill -0 alive, ps identity production-runtime.mjs + /Users/authsvc/.agent-core
   (validated against real pid 67556 cmdline).
7. HR FREEZE — PASS. Selectors match the real schema exactly: enabled (job-model.js:32),
   scheduleRevision (:33), retry{auto:boolean} (:37,:149-152), updatedAtMs (:53), top-level
   jobs[] (store.js:26,:257). Fail-closed on absent job, jq parse error, or non-false retry.auto
   (:261-263); post-swap re-check (:374-375).
8. PM/NETWORK — PASS. curl exactly 3×, only http://127.0.0.1:8790/health (:206, :246, :352); no
   wget/ssh/nc/git anywhere; pm names only in comments/shim creation. PATH reset (:31) then shim
   dir prepended (:64) guarantees shim-first resolution; guard checked pre (:319) and post (:377).
9. CONTINUITY — PASS. Post-swap sleeps total ~65s; actual outage ≈10-20s (kill → KeepAlive
   respawn, ThrottleInterval 10s). W2 (StartInterval 900, root, runs from app/scripts whose bytes
   are pinned identical by G9) only writes heartbeat/evidence/alert outbox; routing.json is
   read-only to it — it cannot spuriously break the routing PRE/POST equality (:333/:370-373), so
   no spurious-rollback vector. A W2 spawn landing in the sub-second swap window fails once and
   retries in 900s.
10. FIXTURE HONESTY — PASS. Fixture proves pm-guard armed, manifest-exact build against an
    independently assembled expected tree, added/removed scheduler files, sibling/root-pkg
    integrity, swap+restore round-trip. It cannot exercise chown-under-root; the id -u guard
    (:78) keeps paths byte-equivalent because the manifest hashes file contents only — the chown
    is a single auditable root line. Independently, the reviewer's own /tmp rebuild reproduced
    TARGET_APP_MANIFEST c41a9045… exactly, and live app == 66ebc369…, staging == ee8e9d23… —
    G1/G2/G9 will pass as frozen.
11. Other — G5/G7 fail-closed on unreadable/corrupt store (jq failure → empty/999 → fail).
    Receipt cp failure after a healthy deploy exits loudly without rolling back (:397-398) —
    correct.

## NON_BLOCKING_NOTES / RESIDUAL_RISKS

- RB_TMP is a fixed-name /private/tmp path created with mkdir -p (:182); a hostile LOCAL account
  could symlink-plant deploy-receipt.txt for a root clobber at :396. Requires local interactive
  access + advance knowledge; impact is a root file overwrite after verification succeeds, not
  deploy subversion. Recommend mktemp in any future rev.
- Receipt in /private/tmp is world-readable; contains only hashes/pids/job-id — no secrets.
- head -1 (:261, :374) freezes/rechecks only the first b115cb96* job if multiple existed;
  single-job assumption (store not readable unprivileged).
- G7b→swap micro-TOCTOU (a new admission in the sub-second pre-kickstart window) is inherent;
  consequence is a fenced, reconcilable outcome_unknown, not corruption.
- pm-guard polices only the script's own PATH, not the launchd-spawned runtime (plist PATH
  includes node-runtime/bin); accepted by freeze scope (app closure invokes no pm).
- /tmp litter: PM_GUARD_DIR and fixture fail-path sandbox intentionally kept for forensics; no
  fail-path artifact /tmp/sched-v7-built.lines was created.
- Post-swap engine-lease mismatch is warning-only (:358) — correct; the new runtime re-acquires
  asynchronously (re-checked in acceptance).

FIXTURE_RERUN: PASS (exit 0, sandbox cleaned, no production path touched).
