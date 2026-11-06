# 合同式交办：#637 SCHED DEFECT-A —— classifyRouter 纳入普通终态（2026-11-07）

## 缺陷（Owner 亲自登记，内存级复现已验证）
Router 返回普通终态（completed/failed/not_admitted）时，Scheduler classifyRouter（packages/scheduler/src/self-ops/diagnosis.js L40-62）按 unsupported 丢弃、不调用结算 → 已结束 occurrence 永久保持 → 后续自然调度被 fence 永久拦截。实证：job f0fb5c6c（EP05）137 次运行后冻结不再触发。

## 修复要求（issue 逐字）
- 沿现有可信结算接口做**最小修复**：普通终态（completed/failed/not_admitted）纳入可结算分类
- **不得放宽**身份、来源、终止证明或 UNKNOWN 保护（真 UNKNOWN/身份不符/证据冲突仍拒绝）
- 在当前代码上独立复现后修复（内存级复现场景已在 issue 验证：completed→unsupported、failed→unsupported、not_admitted→unsupported、late_completed→正常识别）

## 实施线
复用 #417（Scheduler trusted late-outcome self-heal）既有接口/测试模式，扩展覆盖面至普通终态。

## 验收场景（issue 逐字，全部要测试）
1. Router 普通终态已落盘、Scheduler 写回前重启：正确结算旧 occurrence，后续自然周期继续
2. 真 UNKNOWN / 身份不符 / 证据冲突：仍拒绝，不盲目重放
3. 重复 tick / 重复对账：不重复结算、不重复投递

## 工作面
/tmp/h637-fix（branch fix/sched-classify-normal-terminals，base origin/main 09e8f34e）

## 交付
修复 + 验收场景测试 + 既有 Scheduler 套件全绿（469/469 或当前全量）+ RECEIPT-637.md（RED→GREEN 原文、diff、既有套件计数）+ push + PR 引 #637（gh 超时提交即停）

## 红线
不放宽 UNKNOWN/身份/终止保护；不动 production；不 merge PR；失败即停写 STOPPED-637.md

## Implementation preflight (2026-11-06)

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 09e8f34e8563f4d5e0e41ef96f4cdceb7427db84
BASE_HEAD = 09e8f34e8563f4d5e0e41ef96f4cdceb7427db84
CURRENT_BASE_HEAD = 09e8f34e8563f4d5e0e41ef96f4cdceb7427db84
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = settle exact trusted normal Router terminal readbacks through the existing #417 path
CURRENT_GAP = completed/failed/not_admitted are classified unsupported and keep a restart-orphan fence
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = SCHEDULER_TIMEOUT_OUTCOME_V3@base (C-004/005/008/011/021/028/033/040/043/044)
RELATED_AUTHORITIES = SCHEDULER_OCCURRENCE_OUTCOME_V3 D-009; SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 CTR-RECON-001; AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (not needed for REUSE; proposed governance adoption is not activation)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (Owner task and issue #637)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES (/tmp/h637-fix, fix/sched-classify-normal-terminals, exact base above)
CONTROLLED_RUNBOOK_REQUIRED = NO (source/tests/receipt/push/PR only)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS (isolated local stores and tracked raw logs)
LIVE_AUTHORITY_GAP = NONE (no live operation)
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = #637; implementation seam #417 / merged PR #418
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (not authorized by this task)
OPERATION_ALLOWED = NO (production forbidden)
EVIDENCE_NEEDED = current-base RED with real isolated Router/Scheduler persistence, three acceptance scenarios, Scheduler baseline/full GREEN, independent affected-contract review, structure gate
DONE_WHEN = minimal fix + acceptance tests + current Scheduler suite green + RECEIPT-637.md + push + PR referencing #637
EXPANSION_TRIGGER = authority conflict, safety relaxation, unexpected test/gate failure, submission timeout or other failed delivery
NEXT_REAL_ACTION = execute unchanged Scheduler baseline and reproduce normal-terminal restart fence on isolated storage
NEXT_ACTION = CONTINUE
```

The independent read-only authority review supports REUSE. Normal terminal
vocabulary maps into the existing business settlement classes only after the
unchanged exact owner/correlation checks. Preserve `lateOutcome ?? outcome`:
Router late settlement legitimately retains the original `outcome_unknown`.
No second reconciler, store, retry policy, production operation or Spec delta.
Existing direct and late terminal representations are RETAINed as distinct
Router lifecycle facts; both use the one existing Scheduler settlement path.
Expected defect assertions in the designated RED run are reproduction evidence,
not an unexpected failure. Any unexpected failure stops subsequent work and
is recorded in STOPPED-637.md.
