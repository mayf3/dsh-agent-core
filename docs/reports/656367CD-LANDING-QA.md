# 656367CD-LANDING v2 — independent affected-Contract QA

Recorder: Codex root, recording the independent read-only findings of `/root/qa` on 2026-11-09. The reviewer did not author or mutate the candidate, tests, evidence, or runbook. This is preparation QA, not Product Authority or deployment authorization.

## Coordinates and scope

- Repository/worktree: `mayf3/dsh-agent-core`, `ops-656-landing`, branch `fix/656367cd-landing-prep`.
- Base/integration/observed main: `6ad69d1fa6fa8c7dcfb3b5b61207c7d21a80ecef`.
- Independently reviewed staged tree before this recorder-only receipt: `eebf442311349143675cfc631fdeb436ea67b13e`.
- File-set receipt: [review-target.json](../evidence/656367cd-landing/review-target.json), `fileSetSHA256=7ef263959fc6565bce087b4d4a12d144a2be99d350aaa748bd82658a49717b50`.
- Reviewed PREP SHA256: `6b3ba8e8e5ebd8fe689bd3e7383da252690e8660c8ae6b16bd10cf1e59aa85ed`.
- Final commit Head is bound by the reviewer's final-Head delta recheck in the resulting PR body. No new Product Contracts are accepted here.

## Independent result

```text
REVIEW_KIND = AFFECTED_CONTRACT
REVIEW_SCOPE = DELTA (v1 build blocker closure + v2 candidate/evidence/runbook)
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_AND_CONTRACT = PASS (accepted base; REUSE)
MANDATE_SCOPE = PASS (isolated preparation and Git delivery only)
EVIDENCE_REVIEWABILITY = PASS
FROZEN_BLOCKER_UNION = []
SPEC_GAPS = 0
QA_VERDICT = PASS_FOR_PREPARATION
IMPLEMENTATION_ALLOWED = YES (preparation)
MERGE_READY = NO (task prohibits merge)
OPERATION_ALLOWED = NO (production)
NEXT_ACTION = CONTINUE (commit/push/open PR only)
```

The reviewer independently confirmed:

- lstat identifies the absent-target symlink; Owner v2 explicitly authorizes unlinking it. It was tracked (`mode 120000`, blob `68e992b5dde71d542f0ac5ff5b6b656fb7a0a2aa`), and the deliverable discloses the deletion. No target deletion or npm install occurred.
- Installed/candidate/live inventories each have 1,703 entries. Live and installed preimage remain equal; each scratch tree matches its retained manifest. Candidate differs in exactly event-correlation and state-machine, with the exact Git656 original blobs. Spawn remains installed bytes. Manifest SHA256 values are installed `28acb0fad8bcf3967511db7687ada324b0ccac7296e7af4d5252dd3dbb376454`, candidate `b397e0e4b9c917b8595c7e801ae8964e127c08cf095a191f596992e26e024049`.
- Imports are restricted to frozen scratch event/state/provider-errors modules, guarded by realpath, without following the preserved production/Harness symlinks. No full app, real store constructor, child, or network request was executed.
- On the current production Node binary v25.6.1 (`c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`), RED yields the exact expected normative assertion failure (`late_completed` + success evidence vs termination-only); GREEN passes 16/16 and regression passes 13/13. All raw-log SHA256 values match the test receipt. Initial development-Node evidence is separately retained. The test fixture SHA256 is `0af2944d20cdad6b396c491614fe6ed680676edd3413fb72440cc720f6d0848d`.
- GREEN covers direct and late aborted/disposed/null/other non-outcome reasons; UNKNOWN precedes termination-only settlement, no outcome evidence is fabricated, waiter envelope and partial output remain truthful. Completed/error direct and late behavior remains unchanged.
- Regression covers exact correlation, idle order, later start, gap/missing receipt/multiple executions, no-terminal predicates, settle-once and another unresolved UNKNOWN fence.
- The runbook reuses D547 §5 and accepted DCP CTR-009/012/013. It requires the original authorized chain, mutex, fresh drain/tool isolation/old generation exit, per-slot journal and same-filesystem rename. Two renames are explicitly not whole-release atomic. Reversion is confined to the two window-captured preimages; drift/unproven compatibility stops rollback. No production admission is claimed.

## Limits and follow-up

Synthetic Map/store/execution fixtures establish function mechanism and call order; they do not prove durable-store CAS, real historical-record hashes, Scheduler/runtime business results, or real side-effect/replay counters. The child-exit fix in spawn is outside the two-file scope. External Harness bytes/loading and current drain/tool termination are UNKNOWN. Owner's original three-priority audit coordinate remains a source follow-up; the record clearly attributes only the brief/current request and does not block independent preparation.

Raw `.log` and `.diff` evidence remains byte-preserved. A broad whitespace scan flags legal blank unified-diff context lines (space prefix); the authored-file whitespace check excludes raw log/diff evidence and returns rc0. No build/GREEN/regression failure is hidden by that exclusion. No `packages/`, `scripts/`, or `.agents/` implementation source changed; docs/evidence is excluded by the accepted structure policy, so the currently unqualified legacy structure verifier is not represented as a passed source gate.
