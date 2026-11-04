# Independent R2 affected-delta review

Reviewer: /root/r2_review; author: /root. Read-only independent local collaboration.

schema_version=2; SPEC_GOVERNANCE_MODE=REVIEW; REVIEW_KIND=AFFECTED_CONTRACT;
REVIEW_TARGET_HEAD=d4ecf90aea0a439419d75c97fb15ad1736e3b542+R2-worktree;
harness_sha256=4c69c4a5c6430b2783a56783b34f17b7cb403b5cf7dfb632eb67be3083edc83c;
BASE_HEAD=CURRENT_BASE_HEAD=7a8aaac00d56c4af2892e7097731ecda86a90f1d;
AUTHOR_INDEPENDENCE=PASS; REVIEW_SCOPE=DELTA;
SCOPE_REASON=bounded harness extraction repair; ASSURANCE_LEVEL=DURABLE;
AUTHORITY_REVIEW=PASS; MANDATE_SCOPE_REVIEW=PASS; CONTRACT_REVIEW=PASS;
ACCEPTANCE_COVERAGE_REVIEW=PASS; EVIDENCE_REVIEWABILITY=PASS;
BLOCKERS=0; SPEC_GAPS=0; prior KeyError blocker closed for source delivery;
MERGE_READY=NO (user forbids merge); OPERATION_ALLOWED=NO;
NEXT_ACTION=CONTINUE authorized stage/cached-check/structure/commit/push/PR.

Independent findings (reviewer's returned text persisted by root):

- Recomputed diff against prior source-snapshot.json is exactly harness-only.diff,
  four deleted and three added extraction lines. Removing this selection section
  leaves the whole harness AST identical; all existing assertions/fixtures remain.
- ast.walk(tree) plus the exact six-name FunctionDef whitelist includes close_checks
  at window-selftest.py:291-330 under main/try. Current names are unique and the
  name-set assertion verifies completeness. Existing exec/namespace is unchanged.
- Six product/selftest files match stopped-state hashes. Seven source line counts
  are 300/329/356/111/146/383/432, all <=500.
- C7 focused command rc0; raw stdout/stderr SHA256 match command.json. Literal
  result: C7_FOCUSED_AND_DISPATCH: R6/R7 original cases + stage11 refusal + JSON/NUL + owned release receipt PASS; deletion NOT_EXECUTED
  stderr reports Ran 1 test in 0.081s / OK.
- Isolated c7-focused.json has mapped_diff_empty=true, five rejection cases,
  newest-two/pinned/025 protection and oldest-only list candidate. Generation/bak
  paths preserved, owned mutex released. No production stage was executed.
- Prior PASS command stdout/stderr hashes were reverified. Product sources and
  SyntheticTree/Selftest/Consumers AST are unchanged: reuse 10/10, 7/7 and dry-run
  byte-diff evidence, explicitly as reuse rather than new execution.
- Isolated completion.json contains a product literal productionExecution=EXECUTED.
  This is synthetic consumer output only, never evidence of real production work.
- Final exact commit and remote readback remain to be checked. No merge/runtime
  acceptance is certified by this delta review.
