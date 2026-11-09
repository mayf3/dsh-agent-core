# 合同式交办：EKR-B3-r2 — 修 sender fixture 协议前置 → 三位置验收 → 提交推送（完成授权）

## 背景（先读 STOPPED-EKR-B3.md）
第三位置（accepted_receipt_lost）的 sender fixture 跳过了真实协议前置（markAdmitted/markPromptWriteAttempted），
7 断言测的不是真场景。源码候选本身无语义阻塞（既有回归 285/285+454/454+40/40+结构 rc0 全过）。

## 监管裁定（完成授权）
1. **修 sender fixture**：按真实协议序 mintTurnExecution → markAdmitted → markPromptWriteAttempted → markPromptReceipt → interruption
2. 重跑第三位置验收（重开后的 durable receipt 必须反映真前置——非 not_admitted/prompt_write_not_attempted）
3. 新测试回执绑精确新 candidate SHA + 独立复核受影响 delta
4. 全部过 → stage 全部 → cached diff-check rc0 → commit → push → PR 引用 #1374 标注 P0-B3
5. **不 merge**（监管验收后代行）

## 红线
产品文件从已验证候选态起不再改动（只动 fixture）；失败即停写 STOPPED-EKR-B3-R2.md
## 回执（RECEIPT-EKR-B3-R2.md）
fixture diff、三位置全 PASS 输出、独立复核、PR URL、UNKNOWN

## Resumed execution preflight (2026-11-05)

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 9f04db29cce44a684b4409fa63b436aaf10dfa52
PRIOR_CANDIDATE_HEAD = f31ba0ea8033ffe97363ba001cc8772154b6f320
CURRENT_BASE_HEAD = 2d550bc8147c877db33886fccb85e00a64353e66
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Close B3-REVIEW-001 using the real sender protocol; publish reviewed P0-B3 candidate without merge.
CURRENT_GAP = accepted_receipt_lost fixture omitted admission and attempted-write preconditions.
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3 CTR-WAE-002/004/005/006/011/012/013 at integration base
RELATED_AUTHORITIES = D-009; WEC V3; Product Architecture V1 at integration base
IMPLEMENTATION_AUTHORITY = contracts
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (Owner completion authorization above)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES (/private/tmp/dsh-ekr-b3, ac-ekr-b3, root is the sole fixture writer)
CONTROLLED_RUNBOOK_REQUIRED = NO (isolated fixture and repository delivery only)
SPEC_GAP_DEPENDENCY = NONE
LIVE_AUTHORITY_GAP = NONE
EVIDENCE_REVIEWABILITY = PASS (durable temporary Router/ledger and retained raw logs)
BASE_IMPACT = NONE (fresh origin/main leaves relevant authority bytes unchanged; docs/decisions/RECEIPT-WAE.md is an added delivery receipt, not an authority delta)
IMPLEMENTATION_ALLOWED = YES (fixture only; product files frozen at prior candidate)
MERGE_READY = NO (explicitly forbidden)
OPERATION_ALLOWED = NO (production effects forbidden)
EVIDENCE_NEEDED = Exact new candidate SHA; three-position output; reopened real-protocol receipt assertions; independent affected-delta and final-head review; working/cached diff checks.
DONE_WHEN = All gates pass, all authorized artifacts committed and pushed, PR references mayf3/agent-control#1374 and P0-B3, receipt records URL and UNKNOWN.
EXPANSION_TRIGGER = Any required gate failure, product-file change, authority conflict, production/window mutation or replay dependency -> STOPPED-EKR-B3-R2.md and stop.
NEXT_ACTION = CONTINUE
```

Retain the original STOPPED and receipt as historical failure evidence. Reuse
the unchanged product-source regressions (285/285, 454/454, 40/40) through an
explicit product-byte identity check; rerun affected fixture and exact-candidate
structure gate. Candidate snapshots may be minted as immutable Git objects
before testing; advance the delivery branch only after the required gates pass.
Final evidence-only delivery changes receive an independent delta recheck.
