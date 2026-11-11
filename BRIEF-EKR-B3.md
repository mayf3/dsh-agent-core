# 合同式交办：EKR P0-B B3 — planned 写入后中断的对账安全（任务书 #1374 §3 B3，不涉 spec 冲突）

## 权威输入
1. gh issue view 1374 --repo mayf3/agent-control ——§3 B3 全文（验收=投递前/投递时/已接纳回执丢失三位置故障注入分别得安全结果）
2. DEFECT-MATRIX.md G4——已核实：fsync 的 attempt_planned 与投递前 delivery_started fence 已存在（"完全没有持久写前记录"反例不成立）；普通 planned/delivery_started 无 linkage 均成 delivery_unverified 非自动安全续投；M 另有 continuePlannedOwnerResume 仅处理 owner_assistance_resolved
3. 已接受权威：WAE V3 相关条款（本单不改其语义）；D-009 三态（UNKNOWN 零写）

## 任务（base 9f04db29，branch ac-ekr-b3）
1. **对账安全实现**：planned/delivery_started 状态的重启后处理——
   通过持久写前记录 + 原发送回执对账，区分三态：确定未发送（可安全续投）/已接纳（结果未知，保留责任等待回执或对账）/结果未知（保留 UNKNOWN 责任）
   ——**不得因重启自动创建新 request 重放原业务操作**
2. 遵守既有 WAE V3 语义边界（如与 CTR 条款相邻，保持现有显式受控操作模式，不新增自动 retry——B3 的范围只是"重启后的对账分类"，不是自动重投）
3. 聚焦测试（任务书 §7.4）：投递前/投递时/已接纳回执丢失三位置故障注入（内存桩+隔离 fixture），分别得安全结果
4. 结构门 + 既有调度回归 + diff check（working+cached）
5. push + PR 引用 #1374 标注 P0-B3；**不 merge**

## 红线
零生产写入；不改 UNKNOWN 语义；不改窗口工具；失败即停写 STOPPED-EKR-B3.md
## 回执（RECEIPT-EKR-B3.md）
base/head SHA、diff、三位置故障注入输出原文、结构门输出、PR URL、UNKNOWN

## Execution preflight (2026-11-05)

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 9f04db29cce44a684b4409fa63b436aaf10dfa52
REVIEW_TARGET_HEAD = 9f04db29cce44a684b4409fa63b436aaf10dfa52 (pre-implementation)
CURRENT_BASE_HEAD = 9f04db29cce44a684b4409fa63b436aaf10dfa52 (task integration snapshot)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Classify interrupted original delivery from durable WAL and exact original Router receipt, without replay.
CURRENT_GAP = Ordinary planned/started without delivered linkage never query original request correlation.
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3 CTR-WAE-002/004/005/006/011/012/013
RELATED_AUTHORITIES = D-009; AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3; Product Architecture V1
IMPLEMENTATION_AUTHORITY = contracts
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (Owner task above; #1374 section 3 B3)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES (/private/tmp/dsh-ekr-b3, ac-ekr-b3, single source writer)
CONTROLLED_RUNBOOK_REQUIRED = NO (source + isolated fixtures only)
SPEC_GAP_DEPENDENCY = NONE
LIVE_AUTHORITY_GAP = NONE
EVIDENCE_REVIEWABILITY = PASS (local reproducible fixtures and raw receipts)
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (not authorized by this task)
OPERATION_ALLOWED = NO (production effects forbidden)
EVIDENCE_NEEDED = Three interruption positions; workflow/scheduler regressions; exact-commit structure gate; independent review; working/cached diff checks.
DONE_WHEN = Safe classification verified, receipt recorded, branch pushed and P0-B3 PR opened referencing #1374, no merge.
EXPANSION_TRIGGER = Authority conflict, required gate failure, production/window-tool write, or automatic replay dependency -> stop and STOPPED-EKR-B3.md.
NEXT_ACTION = CONTINUE
```

WAE V3 CTR-006/012/013 remain controlling: missing linkage still lands terminal
`NEEDS_REVIEW/delivery_unverified`; classification is read-only evidence, never
recovery eligibility. A definite non-send observation is not a recovery permit.
Retain the existing Owner-resume path and explicit controlled recovery unchanged.
Retain historical planned records as UNKNOWN when WAL provenance is absent.
Add an implementation marker to newly planned WAL facts to distinguish these
from historical planned records; no migration, historical rewrite, new state,
new ledger, consumer, timer, or retry operation. Repeated existing reconciliation
passes re-read responsibility and original correlation, including terminal
`delivery_unverified` records, without appending to terminal attempts.
The read-only classification path must not repair torn tails or change ledger
bytes; the pre-existing terminal verdict write remains a separate WAE action.
Router prompt acceptance is not business completion; all business outcomes stay
UNKNOWN in this classification. Original requestId, attemptId and generation
are returned with the observation. No response grants resending.
