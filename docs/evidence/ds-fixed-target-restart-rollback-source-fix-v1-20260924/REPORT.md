# DS_FIXED_TARGET_RESTART_ROLLBACK_SOURCE_FIX_V1 — lane report (2026-09-24, night)

Lane: independent Deployment System development/review lane. Scope: close the Router/Archive-shared release blocker in the **Deployment System source** (bounded restart selection pinned to the exact WEC tree). Production mutation performed by this lane: **NO**.

## Blocker and authority

- Installed DS `942ac3751661e0e941387c5e3db5bef6f4054e1004a35627dce91386a3c76d30` gates `wait_for_unload=True` on the WEC workspace bridge artifact digest only; non-WEC fixed-target DEPLOY and both ROLLBACK restart sites take the default restart (historical `RESTART_BOOTSTRAP_FAILED:5` after WEC v3 swap).
- Governing accepted spec: `docs/specs/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1.md` (origin/main `2ee6f47788b51b165267b9edec37ca5656b69954`), CTR-DCP-011/012/013. **No spec amendment required** — the fix reuses the already-reviewed `restart_runtime(wait_for_unload=True)` for the existing `scheduler-whole-main` fixed profile; no caller-selected restart mode, no new protocol field, no generic service-management surface.
- Worktree for repo-side work: `/Users/yanfenma/workspace/worktrees/night-ds-fixed-target-restart` (detached at origin/main `2ee6f477`); DS source lives outside the dsh repo at `/Users/yanfenma/workspace/artifacts/AGENT_CORE_DEPLOYMENT_SYSTEM_V1/`.

## What the prior lane had produced (freshly re-verified this lane)

- Source-fix candidate `b4b65201498c4ec959c391e59e86322931ab3638a475f6c0c0b2fdeddc8eb437` (predicate `fixed_tree_restart_required` + three restart call sites), independently reviewed **PASS** (`ds-fixed-target-restart-candidate-20260924/review/…`), source freeze record `94e7866d…`.
- Execution packages v1→v3; v3 frozen runner received independent **FIX_REQUIRED** (V3-R01/R02/R03/R04), with the explicit instruction that V3-R03 must not be silently downgraded and DS_UPDATE stays parked until closed.

## This lane's work

1. Re-verified all prior hashes fresh; installed preimage unchanged; v1–v3 never executed (no `*-run` dirs, operation ID absent everywhere).
2. Re-ran RED/GREEN: baseline+focused regression = 5 expected failures (3× `bootout,bootstrap` missing bounded wait; 2× unload UNKNOWN/timeout wrongly COMPLETE) — the historical failure mode; candidate = 124 tests OK + 31/31 + 5/5.
3. Built v4 runner closing all four v3 findings: exact single-artifact inventories (package dir + private 0700 staging copy + re-verify before invocation), fixed minimal env + `python3 -I` re-exec for runner and all children, INTENT durability anchored via parent-dir fsync, and CTR-DCP-011 bounded recovery (≤3 read-only probes under the held mutation lock → `APPLIED_VERIFIED` / `NOT_APPLIED_VERIFIED` / durable `QUARANTINE.json`, never silent lock release), successor lane interlock (quarantine / unresolved-INTENT / unparseable-RESULT), SIGINT/SIGTERM blocked via `pthread_sigmask` across the evidence+mutation+recovery window.
4. New focused tests `test_ds_update_runner_v4.py`: 22 tests (COMPLETE / APPLIED_VERIFIED / NOT_APPLIED_VERIFIED / QUARANTINE paths, interlocks, inventories, env, mask, fsync-order surfaces).
5. Independent affected-surface review round 1: **FIX_REQUIRED** — 2 blockers (runner matched its own ps line in `no_competing_writer` → deterministic self-abort; second signal during recovery escaped the handler and released the lock without QUARANTINE/RESULT) + plan/implementation prose divergences. All fixed; re-frozen (runner `dd78a37a…`, tests `7d4cd1d4…`, plan `63102dd5…`, `PACKAGE.json` status `FROZEN_PENDING_WHOLE_PACKAGE_REVIEW_R2`); combined suite 146 OK.
6. Independent round-2 delta re-review: **overall PASS** (all five gates PASS; record `ds-fixed-target-restart-successor-20260924-v4/review/INDEPENDENT-V4-RUNNER-R2-REVIEW-20260924.md`, sha256 `a5cff10858ba67a68e6867fc3c2bc7cf95842eabc8cd6cc5f9bb238e0108970f`; two non-blocking observations: parent-shell argv self-match aborts fail-safe pre-mutation — direct invocation form prescribed; unbound companion files are inert).

## Disposition

`AUTHORITY_STATUS=ADEQUATE_NO_AMENDMENT_NEEDED`; source fix ready and review-PASS; v4 execution package frozen; deployment handoff written (`ds-fixed-target-restart-successor-20260924-v4/DEPLOYMENT-HANDOFF.md`, final state `…-v4/FINAL-STATUS.md`). Production apply is explicitly out of this lane's authority: DS_UPDATE execution, capture/admission and the Router release remain with the Deployment Agent through existing DS/Bridge authority, one release at a time.
