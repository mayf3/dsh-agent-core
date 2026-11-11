# 合同式交办：dsh#523 审定 guard 整合回 main（Owner 已裁定"按既有路径整合"）

## 背景（先读）
gh issue view 523 --repo mayf3/dsh-agent-core（重点最后一条 REMOTE_FALLBACK 回执的精确坐标）。
已审定源：PR #607，head `ecff3b50195ff6f8649ff7896ac7a3f1a1b3bdd5`（merge e754229b，在堆叠基 issue523/d008-switch-amendment-20261103 上）；保留其携带的已接受 D-008 amendment。

## 任务（base = 整合时 current main，起点 f767e8d6，branch ac-523-guard-integration）
1. 从 PR #607 分支 cherry-pick/整合审定字节到 current main：packages/agent-router/src/binding-resolution.js（含 switchAgentFromTurn）、index.js 接线、route-chain/switch-workspace-guard.test.js。
2. 字节保真优先：整合后逐一比对审定 blob（172859f3/d0a8ca89/测试文件在位）；如因 main 演进必须改字节，只改最小必要并明确列出 diff+理由。
3. 只重跑受影响检查（agent-router 包测试 + guard 测试）+ 既定有界独审范围；不整仓重跑。
4. push branch 到 origin + 开 PR 引用 mayf3/dsh-agent-core#523（标题注明 Owner 2026-11-04 裁定整合）；**不 merge、不碰生产**。
5. 回执必须含关单前置的精确 readback：整合后三文件的 blob SHA + main 预期 SHA。

## 红线
零生产写入/不碰 ac1159-deploy 活跃区/失败或 UNKNOWN 即停写 STOPPED-523.md/不伪造 readback
## 回执（RECEIPT-523.md）
整合 SHA 映射表（审定 blob → 新 main blob）、受影响检查输出原文、readback、UNKNOWN 清单


## Current integration PREFLIGHT / bounded source runbook

```text
schema_version = 2
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/dsh-523-integration
BRANCH = ac-523-guard-integration
BASE_HEAD = f767e8d6608cdb0917aad2d471ba0454d0966a0f
CURRENT_BASE_HEAD = f767e8d6608cdb0917aad2d471ba0454d0966a0f (fresh origin ls-remote + fetch)
REVIEWED_SOURCE = ecff3b50195ff6f8649ff7896ac7a3f1a1b3bdd5
REVIEWED_SOURCE_PARENT = fa7fea60374b64b6f869c418c4c6a7a9b98b3022
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Integrate the three reviewed #607 guard files onto current main; publish source PR and exact receipt, no merge.
CURRENT_GAP = main lacks switchAgentFromTurn, parent-RPC wiring, and regression file.
OBSERVATIONS = #606 accepted D-008 amendment is on main; source-parent..main changes only #527 scheduler; router and affected authorities are byte-identical to source-parent.
WORKING_GUESS = NOT_APPLICABLE
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = accepted D-008 section 20 amendment at base f767e8d6608cdb0917aad2d471ba0454d0966a0f, Decision blob 0c3f6f6005794edec2faf666e4fb035a9c87b009
RELATED_AUTHORITIES = retained D-004 ownership/atomicity; Binding Workspace V1 resolution/session invariants as disposed by D-008 sections 27.3/27.5; accepted local structure rule V2
IMPLEMENTATION_AUTHORITY = contracts (existing accepted legacy authorities, retained as authorities under local transition rule; no Spec delta)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (not needed)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (actor/capability admission boundary; isolated source only)
EXECUTION_MANDATE = VALID (current user task + Owner issuecomment-6622744977)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES (initial tracked tree clean; only provided BRIEF-523.md untracked)
CONTROLLED_RUNBOOK_REQUIRED = YES (bounded steps below)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS (pinned prior PR + local Git objects; new raw checks and independent review will be persisted)
LIVE_AUTHORITY_GAP = NONE (production and controller reservation state are not dependencies of this explicit isolated source mandate)
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = mayf3/dsh-agent-core#523
BASE_IMPACT = BOUNDED (scheduler-only; affected router/authority bytes unchanged)
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (verification pending; no merge authorized in this task)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = exact three-blob equality; guard test; all agent-router package tests; existing structure/integrity gates; bounded independent exact-head review; origin/PR/main readback
DONE_WHEN = branch pushed, open PR to main referencing #523 with Owner 2026-11-04 integration title, receipt with exact blobs/base/readback/raw check evidence; no merge/production action
EXPANSION_TRIGGER = any failed required check, UNKNOWN required source coordinate, authority conflict, byte conflict, or production-effect requirement -> STOP and write STOPPED-523.md
NEXT_REAL_ACTION = restore only three reviewed files, verify blob identity, commit, run affected checks sequentially
NEXT_ACTION = CONTINUE
```

Authorization: [Owner 2026-11-04 ruling](https://github.com/mayf3/dsh-agent-core/issues/523#issuecomment-6622744977), [last REMOTE_FALLBACK](https://github.com/mayf3/dsh-agent-core/issues/523#issuecomment-6595432739), and the verbatim task above. Actor: this source integration worker; independent reviewer is read-only, not another source owner or production writer.

Allowed operation class: isolated source restore/commit, local fixture tests, evidence files, one branch push and one PR. No merge, issue closure, production write, deployment/restart, credential read, controller dispatch, or access to ac1159-deploy. No secret values needed or recorded.

Bounded sequence (one integration/check attempt):
1. Preserve provided Brief; append this route. Reuse original #607 isolated dependency directory through a local node_modules symlink; record exact package versions. No install scripts or dependency edits.
2. Restore only binding-resolution.js, index.js and route-chain/switch-workspace-guard.test.js from reviewed head. Compare complete Git blob IDs, preserve accepted D-008 bytes, and commit only named paths plus this Brief.
3. Run guard test, then all agent-router test files only; log stdout/stderr verbatim with rc, time, Node version and exact source coordinates. No baseline failure waiver: any nonzero check stops subsequent source writes, commits, push and PR; retain raw evidence and write STOPPED-523.md/RECEIPT-523.md.
4. If successful, run accepted structure candidate-delta/integrity/diff checks only; bounded independent exact-head affected-Contract review and final evidence-only delta review. Stop on concrete blocker.
5. Recheck current remote main and source bytes; push exact branch, create one PR, then fresh-read origin branch, PR head/base, current main and three blobs. Preserve future merge SHA as not yet created; expected main preimage is the exact current base, never fabricate a merged readback.

Rollback: source branch/commits remain isolated and reviewable; no other checkout or ref is reset. On failure leave candidate intact with stop receipt, no blind retries or baseline repairs.

Prior #607 RED/GREEN/review evidence is retained at pinned reviewed source, docs/evidence/binding-switch-523-20261103; it is not represented as freshly executed evidence. Source-parent..main impact recheck justifies reusing unchanged historical mechanisms without full-repository reruns.

Recorded UTC: 2026-11-04T04:51:21.699695+00:00
