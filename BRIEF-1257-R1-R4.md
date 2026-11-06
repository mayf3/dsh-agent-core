# 合同式交办：#1257 fence 生命周期治理 R1-R4（2026-11-07）

## 背景（与状态取证互补）
真实生产状态含 3 条畸形记录（blocked+pending+cleared，#605 STATE-FORENSICS-V1 已坐实 writer 侧根因：markFenceCleared 无 guard + restart 无 drain）。本单交付**系统性治理**：graceful drain 固化 + 官方 reconcile CLI + 监控告警 + 离线校验惯例。

## R1 重启规程固化
- 发布/运维脚本含 drain 步骤：SIGTERM 优雅停 → 等待全部 worker 退出确认 → 再拉起；禁止 SIGKILL 路径
- 交付物：drain-then-restart 脚本（scripts/ 下，生产 runbook 引用）+ 单元测试（drain 完成前不重启）

## R2 官方 turn-recovery reconcile CLI
- dsh-agent-core 新 operator CLI（如 `scripts/turn-recovery-reconcile.mjs`）：输入 handle + 终止证据；内置 assertDurableRecord 同源 schema 校验（复用 packages/agent-router/src/reconciliation/durable-file.js 的 assertDurableRecord/readDurableRecoveryStore）与结算状态机闭集校验（queryState/settlement/attemptedActions）；产出审计回执；校验失败拒绝写入
- 支持本次三笔同型结算（blocked+pending+cleared 的合法处置路径——须符合 D-009 三态与 #624/#625 语义；exitObservedAt=null 的记录按其证据类型处理，不伪造 child_real_exit）

## R3 监控告警
monitor 模式增加：runtime.err.log 中 RECOVERY_STARTUP_BLOCKED / outcome_unknown fence 计数告警（fence 出现即推送治理通知）

## R4 离线校验惯例
RUNBOOK 文档：任何 turn-recovery store 人工/脚本变更先部署版 loader 验证再重启（write to docs/ or scripts/ runbook）

## 验收（issue 逐字）
- R1：drain 步骤入脚本；一次完整重启后 0 条新 outcome_unknown（模拟重启测试验证）
- R2：CLI 完成三笔同型结算并通过自身校验；错误输入（缺字段/错枚举）被拒且不影响原文件
- R3：人为制造 blocked 投递，告警路径可见（测试级验证）

## 工作面
/tmp/h1257（branch feat/recovery-governance-r1-r4，base origin/main 230de798 含 #637/#639/#640 修复）。node_modules 已链接

## 交付
R1-R4 实现 + 测试 + RECEIPT-1257.md（全门输出原文）+ push + PR 引 #1257（gh 超时提交即停）

## 红线
零生产写入；不动生产状态文件；不放宽 D-009 语义（exitObservedAt=null 不伪造 child_real_exit）；失败即停写 STOPPED-1257.md

## Current PREFLIGHT (2026-11-07)

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 230de798e340cc6c157e6b21822f0b1fda77e51e
CURRENT_BASE_HEAD = 230de798e340cc6c157e6b21822f0b1fda77e51e (local origin/main; remote refresh pending)
REVIEW_TARGET_HEAD = BASE_HEAD until source freeze
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V4@BASE_HEAD C015-C025
RELATED_AUTHORITIES = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 CTR-DCP-012; AGENT_DELIVERY_RESILIENCE_V1 CTR-R5; D-009; SCHEDULER_TIMEOUT_OUTCOME_V3
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (lock proposed; no Spec delta authorized here)
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (user's exact task above)
MUTATION_AUTHORIZATION = VALID (isolated source, fixtures, evidence, push and unmerged PR)
ISOLATED_WRITE_SURFACE = YES (/private/tmp/h1257, feat/recovery-governance-r1-r4)
CONTROLLED_RUNBOOK_REQUIRED = NO (no live operation)
SPEC_GAP_DEPENDENCY = NONE for existing drain/failure-feed/offline-validation adapters; R2 malformed-source eligibility under read-only review
EVIDENCE_REVIEWABILITY = PASS (repository fixtures, full raw gate output)
LIVE_AUTHORITY_GAP = NONE within authorized source reuse
OWNER_DECISION_REQUIRED = NO for reuse
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = #1257
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = YES for R1/R3/R4 reuse; R2 dependent delta awaits authority/proof classification
MERGE_READY = NO
OPERATION_ALLOWED = NO
GOAL_OR_TARGET = source R1-R4 plus fixture acceptance, raw receipt, push and unmerged PR
CURRENT_GAP = prior #592 implemented core mechanisms; this task needs a named restart script, malformed-record eligibility resolution and monitor consumer
EVIDENCE_NEEDED = simulated complete restart and no new unresolved UNKNOWN; three proof-correct fixture dispositions; invalid-input source preservation; blocked-alert injection; structure/integrity; independent affected-contract review
DONE_WHEN = requested source and tests pass, exact review/receipt retained, pushed PR references #1257
EXPANSION_TRIGGER = authority conflict, missing load-bearing proof contract, any required gate failure, gh timeout
NEXT_REAL_ACTION = reuse accepted drain barrier; inspect malformed-source proof eligibility before R2 writes
NEXT_ACTION = CONTINUE on independent authorized work
```

Execution plan: (1) reuse the existing controlled restart barrier through a named
scripts/ adapter and the existing failure feed through a monitor adapter; (2)
resolve exact malformed-record eligibility without inventing proof, then implement
only authorized R2 delta; (3) update the existing offline runbook; (4) run bounded
gates once, archive complete output, independent semantic review, commit/push/PR.
Any failed required gate stops mutation except the requested STOPPED record.

Convergence: RETAIN the existing sole Router durable loader/state machine and
controlled deployment restart; MIGRATE the existing admission script's restart
call to the named adapter. RETAIN #624/#625 Workflow observation obligations;
no Workflow/Scheduler state or production path is a write target. No second
schema, proof taxonomy, external notification destination or persistent daemon.
The new outer script has no forced-kill/undrained bypass; PLH C020's existing
exact-owned worker escalation contract is unchanged.

R2 classification resolved: REUSE PLH_V4 C016/C017/C019. An explicitly authorized
batch may restore only the known illegal `blocked+pending+cleared` projection
to active in an isolated temporary file, validate the whole document with the
pinned loader, and resume settlement from already durable exact evidence. No
schema relaxation, original-store write or new proof kind. Pending null-exit
records require an already durable `exact_started_then_idle` or
`exact_queued_removal`; root-quiescence assertion strings are refused and still
require the accepted verifier. Missing proof refuses the entire batch. The
three-record acceptance is fixture evidence; actual production eligibility is
UNKNOWN because this task does not read production records or proof bundles.
SPEC_GAP_DEPENDENCY = NONE within these bounds.
IMPLEMENTATION_ALLOWED = YES for the bounded R2 candidate repair as well.
