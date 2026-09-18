# V7 r5 — INDEPENDENT MECHANICAL REVIEW (final bytes)

Date: 2026-09-18 · Subject: scheduler-self-healing-deploy-v7.sh sha256
cb0f12b203bc8caddcbc7b595537f8a764082e519009d9a4557f5f83c8283f40 (worktree copy cmp-identical
to the archived copy) · Reviewer: independent agent, execution-based verification, read-only
outside /tmp sandboxes, no sudo, production_main never executed.

## MECHANICAL_REVIEW=PASS — BLOCKERS: NONE

## Gate inventory (each verified fail-closed; every failure path exits non-zero; pre-swap
failures print "DEPLOY=NO STOP=YES NO_BLIND_RETRY" via fail(); post-swap print
"DEPLOY=NO STOP=YES (rolled back…)" via post_swap_fail; no path continues past a failed check)

G0 exactly-once noclobber marker :180-192 · G1 staging frozen :214-217 · G2 live preimage
:220-222 · G3 locks + engine-lease identity (kill -0 + ps identity) :225-242 · G4 runtime health
(pgrep / 8790 / plist state-dir / W2 heartbeat ≤3600s / w2.log ≤1800s / healthy tail) :245-258 ·
G5 HR b115cb96 retry.auto==false + revision freeze to receipt :261-265 · G6b conflicting
mutation-process pgrep :269-272 · G6c staging key pins :274-289 · G7 in-flight bounded wait
:292-300 · G8 space :303-307 · G9 build + frozen manifest + scheduler.js + root pkg + pm-guard
:310-320 · G7b in-flight re-check adjacent to swap :324-326 · G6 non-target PRE hashes :328-334 ·
APPLY atomic renames + partial-mv restore w/ existence verification :337-344 · post checks
:345-398 (kickstart, pid stability ×2, health, deployed scheduler.js sha, non-target PRE==POST,
HR-after, final pm-guard, dual receipt).

## Key verifications performed

- bash -n OK; both copies cmp-identical; sha matches freeze pin.
- --fixture-selftest → FIXTURE=PASS rc=0. Expected-tree is a genuinely independent inline
  plain-copy assembly (:148-154) never calling build_app_next, plus direct byte assertions;
  pm-guard arms fake pnpm/corepack/npm/npx/yarn (exit 99) and is checked after build AND after
  restore (fixture) and after build AND at end (production).
- G6c simulation in /tmp with the verbatim loop: all 7 keys resolve with no space in rel;
  leading-space line and wrong-hash line both fail with the NO_BLIND_RETRY banner.
- Marker noclobber simulation: first create succeeds (marker 0600, dir 0700), second run fails
  EXACTLY_ONCE, concurrent double-start → exactly one winner.
- All FROZEN_* constants byte-match FREEZE_V7.md (41f354d / ee8e9d23 / 66ebc369 / c41a9045 /
  d5764403 / e3e8dce0).
- Live recomputation (read-only): manifest_of(app)=66ebc369… ✓; manifest_of(staging, 939
  files)=ee8e9d23… ✓; all 7 G6c key files hash-match ✓; 3 mutation locks ABSENT ✓; launchd label
  ai.agent-core.runtime exists ✓; live runtime pid 67556 cmdline matches G3/G4/pgrep patterns
  (dev runtimes under /Users/yanfenma correctly do NOT match) ✓; G6b pattern matches nothing ✓;
  space 13.4 GB free vs ~111 MB needed ✓.
- No guaranteed false-fail: every binary exists under the line-31 PATH (jq=/usr/bin/jq,
  shasum=/usr/bin/shasum); BSD sort -z / stat -f '%m' / date +%FT%TZ verified; PlistBuddy
  state-dir key read works.
- set -uo pipefail audit: every variable local-declared or initialized before use; every
  must-abort command explicitly || fail / || post_swap_fail / || exit; only display-only commands
  swallow rc.

## NON_BLOCKING_NOTES

1. :338 swap_out assigned, never read (dead, set-u-safe).
2. :328-333/:365-373 non-target PRE/POST equality is vacuous only in the degenerate case of a
   surface missing at BOTH captures (pre-existing damage, not deploy-caused; G4 backstops
   harness/node-runtime); routing.json has no separate existence check.
3. :358 post-swap engine-lease pid mismatch is WARNING-only — by design, re-checked in
   acceptance.
4. :363 RUNS_JSONL_PARSE_SMOKE=FAIL can coexist with DEPLOYMENT=PASS (informational evidence).
5. :397-398 receipt-copy failure after a healthy swap exits 1 without the NO_BLIND_RETRY banner
   (marker already consumed; harmless).
6. FREEZE_V7.md does not itself pin the scheduler.js digest (runbook heredoc does; verified
   against actual staging bytes) — doc-coverage note only.
7. A failed pre-swap APPLY leaves app.next-v7-<ts> behind (inert; retries take a new TS);
   fixture failure path writes fixed-path /tmp/sched-v7-built.lines.
8. /Users/authsvc/.agent-core is drwx--x--x: engine-lock contents, CANONICAL_STORE jq inputs and
   w2.heartbeat mtime were NOT independently verifiable unprivileged (they execute as root);
   world-readable W2 log fresh (716s) and healthy.
9. :347/:350 pgrep | head -1 takes the lowest pid — a pathological lingering stale process could
   satisfy pid-stability, but health + deployed-sha checks backstop and every failure direction
   is rollback (safe).

FIXTURE_RERUN: PASS (pm-guard clean, manifest-exact build, added/removed files correct,
swap+restore round-trip OK).
