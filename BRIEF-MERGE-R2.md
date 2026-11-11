# 合同式交办：merge-r2 — 脚手架查找修复（AST 遍历）→ C7 门 → 提交推送 → PR 更新（完成授权）

## 背景（先读 STOPPED-MERGE.md）
合并已解决于工作副本（冲突标记消除、index UU 未 stage）；10/10 + dry-run diff=∅ + selftest 7/7 +
双基线对照 + 7 文件 ≤500 全过。唯一失败 = C7 定向门 KeyError：测试脚手架在 main.body 直接找
`close_checks`，而该函数嵌套在 main 的 try 内未被编译进 namespace——**脚手架查找 bug，非产品问题**。

## 监管授权（一次完成，不再中途停）
1. **修脚手架查找**：test_xattrfix_r3.py 的函数提取改为 AST 遍历（ast.walk 找 FunctionDef 嵌套定义，
   含 try 内嵌套），保证 `close_checks` 与其他迁移函数可被定位编译——只改脚手架提取逻辑，不改产品文件
2. 重跑 C7 定向门 → PASS 原文
3. **完成提交**：stage 全部（合并解决+脚手架修复）→ cached diff-check rc0 → commit（消息含双语义保全说明）
   → push → 更新 PR #617 描述（注明 C7 语义移植位置）
4. **不 merge**（监管验收后代行）

## 红线
产品文件（拆分模块）从合并解决态起不再改动；脚手架修改仅限提取逻辑；失败即停写 STOPPED-MERGE-R2.md（含 AST 方案细节）
## 回执（RECEIPT-MERGE-R2.md）
脚手架 diff、C7 门 PASS 原文、commit/push 回执、PR 状态、UNKNOWN


## PREFLIGHT / resumed bounded route (2026-11-04)

- schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; repository=mayf3/dsh-agent-core.
- Worktree=/private/tmp/dsh-fleet-window-tools; ref=chore/fleet-window-tools; only writer=/root.
- REVIEW_TARGET_HEAD=d4ecf90aea0a439419d75c97fb15ad1736e3b542;
  BASE_HEAD=CURRENT_BASE_HEAD=MERGE_HEAD=7a8aaac00d56c4af2892e7097731ecda86a90f1d.
- AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE;
  ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES.
- Reuse BRIEF-MERGE-C7.md accepted local structure/Architecture/backup protections;
  no new Product Contract, no production implementation delta. Relevant authority bytes
  and runtime boundaries stay unchanged. User renewal above supersedes the prior stop
  only for the exact extraction repair and remaining source-delivery steps.
- MUTATION_AUTHORIZATION=VALID; EXECUTION_MANDATE=VALID; ISOLATED_WRITE_SURFACE=YES;
  IMPLEMENTATION_ALLOWED=YES; PRODUCTION_OPERATION_ALLOWED=NO; MERGE_READY=NO.
- GOAL_OR_TARGET=repair nested AST function extraction, pass C7, commit/push all resolved
  source, update PR617, persist receipt; CURRENT_GAP=KeyError close_checks from main.body lookup.
- OBSERVATION=all seven source bytes equal archived merge-resolution snapshot; unique
  selected FunctionDefs include close_checks at window-selftest.py:291 inside main/try.
  WORKING_GUESS=NOT_APPLICABLE; SPEC_GAP_DEPENDENCY=NONE; EVIDENCE_REVIEWABILITY=PASS;
  LIVE_AUTHORITY_GAP=NONE; OWNER_DECISION_REQUIRED=NO; BASE_IMPACT=BOUNDED.
- AST plan: walk the selftest AST, select only named require/sha/save/rejected/
  pure_functions/close_checks FunctionDefs, verify complete function-name set, compile
  those definitions only into the same isolated namespace. Do not execute main/try.
- All product/source files except test_xattrfix_r3.py are frozen. Its delta is restricted
  to function selection; retain all test assertions and fixtures.
- EVIDENCE_NEEDED=R2-only scaffold diff, unchanged product hashes, C7 raw argv/time/rc/
  stdout/stderr, independent delta review, cached diff-check, exact-tree structure gate,
  commit/push receipts, fresh PR state and explicit UNKNOWN. Rebind unaffected prior
  SyntheticTree10/dry-run empty/Selftest+Consumers7 evidence; no gratuitous reruns.
- Sequence: repair -> C7 -> independent delta review -> stage all -> cached diff-check
  and structure -> commit preserving both semantics -> push -> PR body update/readback.
- DONE_WHEN=all authorized delivery steps and RECEIPT-MERGE-R2.md complete, PR open/unmerged.
  EXPANSION_TRIGGER=required gate failure, actual authority conflict, product-file delta
  or need for production effect; immediately stop dependent mutations, preserve AST
  details and evidence in STOPPED-MERGE-R2.md. No corrective gate retry in this mandate.
- NEXT_REAL_ACTION=bounded extraction repair; NEXT_ACTION=CONTINUE.
