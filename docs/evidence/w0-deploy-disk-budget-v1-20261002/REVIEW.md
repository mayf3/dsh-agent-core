# W0 RELEASE-SAFETY (Product #430) — independent changed-surface review record

Reviewer: independent subagent (fresh context each round; repo read access +
fixture-suite execution only; no tracked-file modification; no production
access). Candidate = 55263a09 (base 15cdfc33), branch w0-release-safety-430.

## Round 1 — verdict REVISE / BLOCKING_ISSUES = 1 (+9 non-blocking)

Verified independently by the reviewer: both suites executed (75/75 and
39/39 at the round-1 head), bash 3.2 compatibility, budget arithmetic by
receipt inspection + hand computation, tree_logical_bytes hand-check,
retention-cap counting, cleanup-exact guards (incl. traversal ids
`bak-../other`, `bak-..`, wildcard chars, symlinked backup), pin union truth
consistency, gate read-only property, 4-file diff contains no
Runtime/Router/Scheduler/Kernel file.

- [B1] scripts/trusted-cp-deploy-install.sh:484 — the 0c gate passed
  `$(dirname "$TRUSTED_ROOT")` as the helper ROOT. With the helper's frozen
  `<ROOT>.bak-<ts>` convention the census globbed `/usr/local/libexec.bak-*`
  (matches nothing) → the full-tree retention cap could NEVER refuse on the
  real deploy path (reviewer simulated the exact deploy invocation shape:
  a fixture correctly refusing rc=5 was ADMITTED through the broken shape);
  LIVE_TREE_BYTES/ESTIMATED_PEAK measured the whole libexec tree; cleanup
  guidance always empty; receipt landed one level above the printed path.
  ROOT CAUSE of the miss: the suite drives the helper directly with the
  correct root and only statically greps the deploy (G7 checked line
  ordering, not the argument).
- [N1] json_str did not delete LF (\012) → a multi-line --pin-exception
  reason could produce invalid receipt JSON (empirically confirmed).
- [N2] pre-existing at base: the adjacent `--write-predecessor` call used the
  same dirname shape → FIRST_RELIABLE_PIN's prior-reliable-pin census matched
  nothing in the real layout (duplicate-pin risk on a second LKG=YES deploy).
- [N3] tree_logical_bytes lacked per-file 4 KiB block rounding (slight
  understatement on many-small-file trees).
- [N4] G4d/f/g asserted rc≠0 but not the refusal verdict.
- [N5] G5c did not assert the wildcard-lookalike sibling survived; G7 did not
  assert the root argument.
- [N6] no test pinned that the pin exception does NOT override the floor.
- [N7] dead `after_lines` local. [N8] flag-like projected path parsed as a
  path. [N9] TAB deleted from reasons (cosmetic lossiness).

## Fixes (commit 55263a09, "independent review round-1 fixes")

B1 fixed (gate anchored on ROOT=$TRUSTED_ROOT; comment documents the
convention; G7 now asserts the exact root argument for BOTH helper calls).
N2 absorbed on the same seam (--write-predecessor anchored on $TRUSTED_ROOT —
restores the spec-intended no-duplicate-FIRST_RELIABLE_PIN census). N1
absorbed (json_str deletes \012; raw <0x20 bytes can never enter the
receipt). N3 absorbed (per-file 4 KiB rounding — strictly more worst-case).
N4/N5/N6 absorbed as strengthened/new tests. N7/N8 absorbed in code.
N9 disposition: TAB deletion RETAINED deliberately — a raw TAB (<0x20) is
invalid inside a JSON string, so deleting is the parser-safe choice (lossy
only cosmetically); accepted by the reviewer in round 2.

## Round 2 — verdict PASS / BLOCKING_ISSUES = 0

Reviewer re-verified fresh at 55263a09:
1. Both suites executed by the reviewer: disk-budget 75/75 PASS (incl. the 11
   new round-1-fix assertions), retention 39/39 PASS.
2. Deploy-shape re-simulation with the corrected root: one existing unpinned
   large predeploy backup + projected one → rc=5 REFUSED_RETENTION_CAP
   (round-1's broken shape admitted it); receipt lands exactly at
   dirname($TRUSTED_ROOT)/agent-core-deploy-budget-receipt.json matching the
   printed path; LIVE_TREE_BYTES = live tree only (sibling backup excluded);
   census + guidance correct. Fresh-install shape (NONE): admit rc=0.
3. write-predecessor root change: backup_id_from_path hits the primary strip;
   with a prior pinned backup the census SEES it and refuses to duplicate the
   pin while metadata still writes pinned=false/status=predeploy; with no
   prior pin FIRST_RELIABLE_PIN + pin_reason establish normally.
4. Fix-diff defect sweep: \012 deletion probe-verified with quotes +
   backslashes + LF; tree_logical_bytes rounding verified exact; `--*`
   projected-path guard cannot collide with deploy args; dead var gone; G7
   greps would catch a B1-class regression; no new blocking issue.
Residual non-blocking from round 2: the second G2d block was vacuous (env var
set, helper reads no env) — CLOSED post-round-2: multi-line reason now passed
through the real --pin-exception CLI carrier (the deploy's forwarding
contract); suite re-run 75/75 with the non-vacuous assertion.

FINAL: INDEPENDENT_CHANGED_SURFACE_REVIEW = PASS / BLOCKING_ISSUES = 0
(round-1 REVISE → all blockers and absorbed notes fixed at 55263a09;
round-2 mechanically re-verified, including the deploy invocation shape that
round-1 proved broken).
