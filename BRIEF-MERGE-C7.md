# 合同式交办：#617 冲突解决 — C7 stage_13 逻辑移植进拆分结构

## 背景
分支 chore/fleet-window-tools（执行器拆分+xattr 修复）与 main（97fa15a1，含 C7 的 stage_13 R6/R7 增强）
冲突：C7 改的是旧单体文件 stage_13 段，本分支已重构为模块结构。

## 任务
1. git merge origin/main（97fa15a1）→ 解决冲突：**C7 的 R6/R7 语义必须完整移植进新模块结构**
   （stage_13 收账在拆分后的对应位置；R6 命名集 diff=∅ 断言 + R7 两代保留仅列清单——语义逐条对照 PR #615 的 diff）
2. 移植后全门重跑：合成 10/10 + dry-run 边界 diff=∅（vs 原 974 行原件语义）+ selftest 7/7 + 结构门（全文件 ≤500）+ cached diff-check rc0
3. push + 更新 PR #617；**不 merge**（监管验收后代行）

## 红线
15 节点语义 + C7 R6/R7 语义都不许丢（两份权威都要在）；失败即停写 STOPPED-MERGE.md
## 回执（RECEIPT-MERGE.md）
冲突解决 diff、双语义对照确认、全门输出原文、UNKNOWN

## PREFLIGHT / bounded plan (2026-11-04)

- schema_version=2; SPEC_GOVERNANCE_MODE=PREFLIGHT; TARGET_REPOSITORY=mayf3/dsh-agent-core.
- Isolated worktree=/private/tmp/dsh-fleet-window-tools; ref=chore/fleet-window-tools;
  single writer=/root; initial REVIEW_TARGET_HEAD=d4ecf90aea0a439419d75c97fb15ad1736e3b542.
- Requested main=97fa15a138e4aafe7d566fc3c3d387c3594e87ba (#615);
  fetched BASE_HEAD=CURRENT_BASE_HEAD=7a8aaac00d56c4af2892e7097731ecda86a90f1d.
  The intervening #616 adds only PRODUCTION_442_OPTIONAL_ADAPTER_EFFECT_BOUNDARY_V2.md;
  no fleet-window or applicable authority change. Merge current origin/main.
- AUTHORITY_ACTION=REUSE; PLAN_LEVEL=BRIEF; ASSURANCE_LEVEL=DURABLE;
  ROUTE_STAGE=IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE=YES.
- PRIMARY_AUTHORITY=accepted local CODE_STRUCTURE_GUARDRAILS_V2; related accepted
  Architecture ownership/UNKNOWN boundaries and BACKUP_RETENTION_V1 protections.
  PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 retains production_apply_authority:none;
  this task neither activates its controller nor changes its Contracts.
  Owner mandate above authorizes bounded source reconciliation, tests, commit/push
  and PR #617 update, with no PR merge or production effects.
- MUTATION_AUTHORIZATION=VALID; EXECUTION_MANDATE=VALID for this bounded source task;
  ISOLATED_WRITE_SURFACE=YES; IMPLEMENTATION_ALLOWED=YES; MERGE_READY=NO;
  PRODUCTION_OPERATION_ALLOWED=NO; SPEC_GAP_DEPENDENCY=NONE.
- GOAL_OR_TARGET: one split executor containing both the xattr repair and all C7
  R6/R7 behavior. CURRENT_GAP: competing mechanical extraction plus C7 op changes.
- Observation: the original execution already uses 180s; its dry-run says 150s.
  #615 also changes display text and adds the previously unlisted 05b boundary.
  The present mandate explicitly requires original dry-run byte equality; retain
  that display, adopt C7 implementation/usage/selftest and 180s pure validation.
  This is not a claim that the historical display accurately describes all effects.
- Convergence: MIGRATE C7 state/helper consumers to window_helper_core.py and
  window_helper.py; RETIRE duplicate executable state/helper modules; RETAIN the
  original C7 extraction map as historical evidence with an explicit migration note.
- Plan: merge without committing; port C7 functions/ops and consumers; adapt exact
  dual-baseline gates; run SyntheticTree 10, literal original dry-run comparison,
  Selftest+Consumers 7 and focused isolated C7 checks; stage all changes, cached
  diff-check, exact-tree structure gate, independent affected-surface review;
  commit/push/update #617 and fresh-read remote state.
- EVIDENCE_NEEDED: raw process argv/cwd/time/rc/stdout/stderr; conflict/source diff;
  original 974-line and C7 exact function/op comparisons; source hashes/line counts;
  independent review; full receipt with UNKNOWN. Existing untouched oversized code
  remains visible baseline debt; every changed executable file must be <=500 lines.
- DONE_WHEN: all required gates pass, RECEIPT-MERGE.md persisted, branch pushed,
  PR #617 updated and open/unmerged. EXPANSION_TRIGGER: first required-gate failure,
  actual authority conflict, semantic loss, or required production effect -> stop
  dependent writes and record STOPPED-MERGE.md; no corrective gate retries.
- EVIDENCE_REVIEWABILITY=PASS; LIVE_AUTHORITY_GAP=NONE within source scope;
  NEXT_REAL_ACTION=merge and resolve the known source conflict; NEXT_ACTION=CONTINUE.
