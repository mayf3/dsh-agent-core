# 合同式交办：523-r3 — 7 个整合独有失败逐个归因与处置

## 背景
STOPPED-523-R2.md：整合 HEAD 492d579d 有 7 个基线没有的失败（broker-rpc×3/delivery×2/feishu-v2-normal×1/primary-workspace×1）；
基线独有 0；因果 UNKNOWN（候选轮共享依赖 vs 基线独立安装，6 错误含 provisioning EEXIST）。

## 任务（逐个失败，顺序：先环境归因再语义归因）
1. **环境归因先行**：在整合 worktree 重跑这 7 个测试（独立安装依赖，不用候选轮共享 dep dir）。
   若重跑通过 → 前轮为环境噪声，记录后按通过处理。
2. **语义归因**（重跑仍失败的）：读失败断言 vs 整合 diff（switchAgentFromTurn 接线）——
   - 失败断言编码的是**整合前行为**且与已接受 D-008 amendment 冲突 → 按 amendment 语义修正测试（逐个列 diff+理由），
     不许改产品源码迁就旧断言
   - 失败暴露**整合引入的真实缺陷**（guard 字节与 main 演进的真实不兼容）→ 最小修复整合侧代码，逐个列 diff+理由
3. 全部处置后：agent-router 包检查重跑，fail 集合必须 ⊆ 基线 13 个；guard 9/9 保持。
4. 达标 → push 492d579d+处置 commits + 开 PR 引用 #523（PR 描述含：7 失败逐条归因表、与基线对照、D-008 语义依据）。
   不达标 → STOPPED-523-R3.md 列残余。

## 红线
零生产写入；失败即停；测试语义修正必须有 D-008 amendment 原文锚点，禁止顺手改无关断言；不弱化 guard
## 回执（RECEIPT-523-R3.md）
7 失败逐条归因表（环境/语义-测试修正/语义-产品修正）、处置 diff、最终包检查输出原文、PR URL 或残余清单

## R3 resumed PREFLIGHT / bounded runbook

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/dsh-523-integration
BRANCH = ac-523-guard-integration
REVIEW_TARGET_HEAD = 492d579d185a524a9b56dd91ce8c3728fe6818a2
BASE_HEAD = f767e8d6608cdb0917aad2d471ba0454d0966a0f
CURRENT_BASE_HEAD = publication readback pending; no assumption of current remote
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Attribute the seven R2 integration-only failures, perform only authorized dispositions, publish source PR if final failures are a subset of the baseline thirteen and guard remains 9/9.
CURRENT_GAP = R1 shared mutable dependencies leave seven failure causes UNKNOWN; R2 baseline has thirteen failures.
OBSERVATIONS = tracked/staged tree clean at 492d579d; node_modules is a symlink to /tmp/dsh-523-impl/node_modules; R1/R2 evidence retained; accepted D-008 amendment is already in exact base.
WORKING_GUESS = provisioning EEXIST may be environmental; independent-install rerun required before attribution.
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = D-008 section 20 accepted amendment, blob 0c3f6f6005794edec2faf666e4fb035a9c87b009 at base
RELATED_AUTHORITIES = D-004 retained Binding ownership/atomicity; D-008 sections 27.3/27.5 dispositions of Binding Workspace V1; local structure V2
IMPLEMENTATION_AUTHORITY = contracts (retained accepted authorities)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (not needed)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (existing actor/capability admission boundary; isolated source only)
EXECUTION_MANDATE = VALID (current user 523-r3 contract, verbatim above; supersedes R2 stop for explicitly authorized R3 actions only)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES (same dedicated integration worktree/ref; one writer; reviewer read-only)
CONTROLLED_RUNBOOK_REQUIRED = YES (steps below)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = local pinned raw logs and Git objects; final observations and review to persist
LIVE_AUTHORITY_GAP = NONE for isolated source task; no production operation authorized
OWNER_DECISION_REQUIRED = NO
IMPLEMENTATION_ALLOWED = YES within specified seven-failure disposition only
MERGE_READY = NO (not authorized)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = independent install provenance, seven focused outcomes, exact reason/diff for any repair, final package TAP and set comparison, guard 9/9, structure/integrity/diff checks, independent affected review, publication readback
DONE_WHEN = RECEIPT-523-R3.md plus branch push/open PR referencing #523 if gates pass; otherwise STOPPED-523-R3.md and residual list
EXPANSION_TRIGGER = install failure, unexplained/unfixable focused failure, authority conflict, guard regression, final failure outside baseline thirteen, required gate failure, production dependency -> stop dependent source/publication and preserve evidence
NEXT_REAL_ACTION = preserve old node_modules symlink outside tree; independent registry install with private store and HOME
NEXT_ACTION = CONTINUE
```

1. Preserve old local dependency symlink by rename into task-specific `/private/tmp/dsh-523-r3-dependencies`; do not modify its target or historical fixtures. Install in this worktree with fresh hoisted node_modules, private store, copy import, ignore scripts, no lockfile, isolated installer HOME. Record commands, times, rc, actual dependency manifests/links and source coordinates.
2. Run exactly the seven named tests selected by full test-name regex from their four files, once, using R2 PATH/TMPDIR and a new empty task-local PRODUCTION_RUNTIME_ROOT; no credentials or HOME inherited. Existing hardcoded `/tmp/home` fixtures remain a recorded limitation, not silently cleaned. Package provisioning may mutate only local test dependency links/fixtures as in R2.
3. A focused PASS is environmental disposition under current contract. For remaining failures inspect assertion and integration diff; change only obsolete assertion with D-008 section-20 original-text anchor, or the smallest proven integration defect. No unrelated assertion/source repair; no weakened guard. Unexpected failure or missing authority stops dependent work.
4. Run guard and original agent-router package command once after dispositions. Compare full failure identities to retained exact-base thirteen; no deletion/filtering of failures. Final subset plus guard 9/9 is required even when package rc is nonzero due to baseline failures. Any failure outside that set stops publication, with no automatic retry.
5. If gate passes, run existing structure/integrity/diff gates and independent bounded review (reviewer authors no semantic code). Preserve source bytes and prior passing evidence unless invalidated; evidence-only final Head gets delta recheck. Commit only explicit R3 dispositions and reviewable receipt/evidence, retaining 492d579d ancestry.
6. Fresh-read remote main/branch/PR; assess relevant base drift. Push exact isolated branch and create one PR referencing #523 with seven-row table, baseline comparison and D-008 basis; no merge, close, deploy, restart, production writes, dispatch or ac1159-deploy access. Record exact branch/PR/base/main readback; resulting merged main remains NOT_CREATED.

Abort/rollback: preserve local candidate, original symlink, fresh dependencies and all raw logs. Do not reset another checkout, repair shared dependencies, erase old STOPPED records, or guess unknown fixture preimages. Failure-stop still permits evidence/receipt writes required by this task.
