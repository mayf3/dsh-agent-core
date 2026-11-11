# 合同式交办：xattrfix-r4 — 无属性夹具改一致性断言（监管裁定）→ 全门 → push+PR

## 监管裁定（对 STOPPED-XATTRFIX-R3 的 MINIMAL_CLOSURE 裁定）
macOS 会对新建文件自动重贴 com.apple.provenance（xattr -crs rc=0 也拦不住）——"真无属性夹具"本机不可构造。
**裁定：none 类夹具的断言从"映射为空"改为"源/目标映射一致性"**——
断言 inventory(source).get('none',{}).get('_xattrs_map',{}) 与 inventory(target).get('none',{}) 的
provenance 条目**逐字节相等**（无论 OS 贴了什么），并显式断言两侧都含该 OS 分配属性（证明采集器无漏）。
这不是弱化：生产比对的真实语义就是两侧一致性，不是"必须为空"。

## 任务顺序
1. 修 test_xattrfix_r3.py:84 断言（按裁定；注释锚定本裁定文本）
2. 全 10 用例重跑 → 10/10 PASS 输出原文
3. dry-run 边界输出与原件 diff=∅ → selftest（合规隔离路径）PASS → git diff --check rc0
4. commit（全部拆分+xattr 修复产物）+ push + PR；**不 merge**

## 红线
同 r3（拆分等价性=硬门；零生产接触）；失败即停写 STOPPED-XATTRFIX-R4.md
## 回执（RECEIPT-XATTRFIX-R4.md）
断言 diff、10/10 输出、dry-run diff=∅ 证据、selftest 输出、PR URL、UNKNOWN

## Execution preflight (2026-11-04)

- schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT.
- TARGET_REPOSITORY=mayf3/dsh-agent-core; worktree=/private/tmp/dsh-fleet-window-tools;
  isolated ref=chore/fleet-window-tools; single writer=/root.
- REVIEW_TARGET_HEAD=BASE_HEAD=c4152e9a45e2f1798807492c73516d924dcaf855;
  local origin/main snapshot=7a8aaac00d56c4af2892e7097731ecda86a90f1d.
- GOAL_OR_TARGET: close R3's none-fixture blocker by this Owner ruling, execute
  all inherited equivalence gates, commit/push/create PR, and stop without merge.
  CURRENT_GAP: the R3 batch failed only its empty-map assertion; subsequent
  equivalence, consumer, structure and final-candidate review gates remain open.
- AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE;
  ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES (structure rules).
  PRIMARY_AUTHORITY=CODE_STRUCTURE_GUARDRAILS_V2 and
  CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1 at the exact base. Architecture and
  Current Decisions retain product ownership and UNKNOWN outcome boundaries.
  This one-operation tool repair creates no new long-lived Product Contract.
- MUTATION_AUTHORIZATION=VALID: Owner R4 mandate above, preserving R1/R2/R3 scope.
  ISOLATED_WRITE_SURFACE=YES; IMPLEMENTATION_ALLOWED=YES; MERGE_READY=NO;
  PRODUCTION_OPERATION_ALLOWED=NO; SPEC_GAP_DEPENDENCY=NONE.
- OBSERVATION: inventory stores `{relpath: digest}` under root `_xattrs_map`,
  not under each file record. To implement the ruling's byte equality without
  changing the production schema, use `xattr_values` for both raw none maps,
  assert provenance presence and byte equality on both sides, compare the full
  maps and inventory digests, and retain the original full-inventory equality.
- EVIDENCE_NEEDED: SyntheticTree 10/10 original output; original/candidate
  dry-run stdout/stderr/rc equality; Selftest+Consumers using only unique
  children of /usr/local/v5-boot-isolation/xattr-fix-test; all five files <=500
  lines; git diff --check rc0; exact-commit structure gate and independent review.
- EVIDENCE_REVIEWABILITY=PASS: raw process output and hash-bound results retained
  in that isolation root; source results and review are persisted in the receipt.
- DONE_WHEN: gates pass, receipt includes assertion diff/raw output/PR URL and
  UNKNOWN, all split/xattr products committed and pushed, PR created, no merge.
  EXPANSION_TRIGGER: failed required gate, authority/consumer conflict, candidate
  drift or production dependence -> STOPPED-XATTRFIX-R4.md; stop dependent writes.
- NEXT_REAL_ACTION: execute the ten synthetic cases, then remaining gates in order.
  NEXT_ACTION=CONTINUE. The R3 stopped record remains historical evidence.
