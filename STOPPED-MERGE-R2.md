# STOPPED-MERGE-R2 — cached diff-check failure

状态：STOPPED_REQUIRED_GATE_FAILURE。2026-11-04；唯一写者 /root。
Worktree=/private/tmp/dsh-fleet-window-tools；ref=chore/fleet-window-tools。
HEAD=d4ecf90aea0a439419d75c97fb15ad1736e3b542；
MERGE_HEAD=7a8aaac00d56c4af2892e7097731ecda86a90f1d。

## Completed before this stop

- Only scaffold extraction changed: test_xattrfix_r3.py lines 370-372 use
  ast.walk(tree), exact FunctionDef whitelist require/sha/save/rejected/pure_functions/
  close_checks, then assert selected function names are complete. Main and its try
  are never executed; selected definitions compile into the existing namespace.
  Four removed/three added extraction lines; all existing test bodies remain.
- C7 focused fresh execution rc0; original KeyError blocker is closed. Exact PASS
  stdout/stderr and argv/timestamps/hashes are in the R2 report directory.
- Six product/selftest files unchanged byte-for-byte from stopped merge resolution;
  target harness SHA256=4c69c4a5c6430b2783a56783b34f17b7cb403b5cf7dfb632eb67be3083edc83c.
- Independent affected-delta review PASS; prior unchanged 10/10, 7/7, dry-run empty
  evidence rebound explicitly as reused, not fresh execution.
- git add -A rc0; raw evidence additionally staged with git add -f rc0.
  Unmerged index now empty; merge resolution is staged, not committed.

## First new failure / frozen blocker

CLASS=REQUIRED_GATE_FAILURE
SOURCE=User merge-r2 execution mandate: cached diff-check rc0 and failure-immediate-stop red line.
COUNTEREXAMPLE=git diff --cached --check returned rc2; stdout reports trailing whitespace
at docs/reports/c7-selftest-20261104/SOURCE.diff lines 235,254,291,990,1007.
Each line is exactly one ASCII space. This file is byte-identical to accepted
MERGE_HEAD and its staged blob: 89e7151d024130de40432c0339d94d260b90a37e.
SHA256=fe03b79b898a0622ddd1f19196aff4b0bc7a7b0ed46b2845e91b2d62fd3bc5c1.
IMPACT=Required source-delivery gate is not satisfied; cannot commit/push/update PR
under this attempt. This is not a product-behavior or AST-repair failure.
MINIMAL_CLOSURE=An attributable renewal explicitly covering the five historical
SOURCE.diff whitespace lines (preserving the original evidence/hash) and resuming
remaining gates/delivery. Do not silently alter historical evidence, suppress the
required check, or retry under the stopped attempt.
affected_readiness=[COMMIT_READY,PUSH_READY,PR_UPDATE_READY,MERGE_READY]
COMMIT_READY=PUSH_READY=PR_UPDATE_READY=MERGE_READY=NO.
FROZEN_BLOCKER_UNION=[REQUIRED_GATE_FAILURE: cached diff-check rc2 / inherited SOURCE.diff whitespace].

No product/index write or gate retry after failure. No commit, push, PR update,
abort/reset, PR merge, production executor, cleanup or new canary executed.
Exact-tree structure gate NOT_RUN; seven-file <=500 check is a current read-only
measurement and prior test evidence, not a new repository-wide structure PASS.
PR #617 fresh readback remains open, merged=false, mergeable=false,
head=d4ecf90aea0a439419d75c97fb15ad1736e3b542. Its body is unchanged.
Runtime/installation/production acceptance and business outcome remain UNKNOWN.
NEXT_ACTION=STOP. Full evidence and original output: RECEIPT-MERGE-R2.md.
