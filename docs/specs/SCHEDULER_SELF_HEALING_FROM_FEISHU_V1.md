---
spec_id: SCHEDULER_SELF_HEALING_FROM_FEISHU_V1
title: Scheduler Self-Healing from Feishu — cross-revision retry expiry, tick failure isolation, job_disposition v2
status: accepted
spec_kind: implementation
authority_level: governing_spec
proposed_date: 2026-09-17
accepted_date: 2026-09-17
accepted_by: mayf3
accepted_reviewed_head: 3b65db3ac5d48e1cb7671c0a7ca85b066d557a01
independent_review_result: PASS
implementation_authority: contracts
production_apply_authority: none
scope:
  - packages/scheduler — retry minter stale-revision policy, tick admission-failure classification, self_ops job_disposition diagnosis surface
  - packages/broker — self_ops manifest passthrough (no schema change)
governed_by: []
external_authorities: []
owners:
  - mayf3
governs:
  - packages/scheduler/src/eligibility.js
  - packages/scheduler/src/scheduler.js
  - packages/scheduler/src/occurrence.js
  - packages/scheduler/src/self-ops/index.js
  - packages/broker/src/capabilities/self-ops.js
related_specs:
  amends_behavior_of:
    - SCHEDULER_TIMEOUT_OUTCOME_V3        # C-009 retry policy tightening (refuse stale), C-026 admission refusal surface
    - SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1  # slot-accounting receipts extended (evidence only)
  preserves:
    - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3   # frozen schemas/authority/receipt/idempotency untouched; this Spec is the FIRST normative authority for the self_ops.job_disposition surface (§3) — regularizes the pre-existing live operation (review note N1)
    - AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1
supersedes: []
superseded_by: null
---

# SCHEDULER_SELF_HEALING_FROM_FEISHU_V1

**ACCEPTED for implementation, tests, independent review and non-production
verification.** Owner accepted reviewed candidate `3b65db3` (byte-identical
normative content of implementation candidate head `e0ad1e3`) via the docs-only
acceptance lane on 2026-09-17. The lifecycle merge activates
`implementation_authority: contracts`; production deployment/mutation and
re-enabling `retry.auto` in production remain forbidden until the separately
gated deployment phase (PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1) plus postdeploy
verification PASS.

## §0 第一条真实 counterexample（production evidence, NOT 猜测）

```text
HR job, retry.auto=true
failed predecessor occ:a7c646cf2c5ea8f3 @ scheduleRevision=1
job updated -> scheduleRevision=2
deterministic illegal retry candidate occ:8ac05871…（derived under the CURRENT revision）
→ store retry-predecessor invariant rejects（correct）
→ throw escapes the tick
→ global tick aborts every tick（753,986+ occurrences ≈ every 2s since 2026-09-13 07:47）
→ fleet-wide zero mint；retry 永不落盘（mutation pre-commit abort，盘上 store 始终自洽）
```

本 Spec 的产品目标：用户在飞书问「为什么这个 Agent 昨晚没跑 / 恢复它」，owning Agent 仅凭正式
工具面（`self_ops.job_disposition` / `self_ops.status` / `self_ops.reconcile_turn`）即可给出 exact
diagnosis 并执行合法、receipted、幂等的恢复；任何 job-local 故障不得拖死全局 tick。

## §1 C-SH-001 — STALE_RETRY_AFTER_SCHEDULE_REVISION（毒点修复语义）

本条与已评审的 SCHEDULER_RETRY_MINTER_CROSS_REVISION_FIX（fa65ee5..b3ae557）同义整合：采用其
`staleRevision` 判定、`retry_superseded_by_revision` 证据事件与 `retry_stale_schedule_revision`
锁内 refusal 命名；`STALE_RETRY_AFTER_SCHEDULE_REVISION` 保留为 job_disposition v2 的诊断层
classification 词汇（§3）。

1. `retryCandidate` 在最新 terminal-failed 前驱的 `scheduleRevision !== job.scheduleRevision`
   时，该 retry candidate 判定为 **STALE / EXPIRED BY REVISION CHANGE**：
   - MUST NOT mint（不会产生非法 occurrence record）；
   - MUST NOT throw out of the global tick；
   - MUST leave a durable explainable disposition：runs.jsonl 追加
     `retry_superseded_by_revision` 事件（`jobId`、`retryOfOccurrenceId`=前驱、
     `predecessorScheduleRevision`、`jobScheduleRevision`），按 engine session ×
     (jobId, predecessor→current revision) 去重（append 成功才 mark）；
   - reserve 锁内重检同判定时 typed refusal `retry_stale_schedule_revision`（第二道防线）；
   - current Job 的 natural schedule 在当前 revision 下继续（不做历史补跑）。
2. 依据：V3 C-009/C-023 对前驱资格仅要求 exists + terminal-failed + 直接链，**无任何条款要求跨
   revision 必须铸造**；D-007 §7.5 禁止同一 recovery window 内 retry 与 natural 冲突——本条以
   durable skip 消解该冲突。store 的 retry-predecessor invariant（前驱须同 revision）保持 fail-loud，
   作为持久 authority 的最后防线，本条使其在 mint 之前即不可达。
3. 禁止：blind retry、改写前驱 revision、伪造 failed、删除历史 occurrence、raw store edit。

## §2 C-SH-002 — tick 失败隔离（ONE_BAD_JOB != GLOBAL_TICK_FAILURE）

1. reserve 阶段错误分类为且仅为两类，归属函数 `classifyAdmissionFailure(error, candidate)`：
   - `job_local`：可归因于本 candidate 自身坐标/agent ——
     `OCCURRENCE_STRUCTURED_COLLISION` / `OCCURRENCE_PAYLOAD_CONFLICT`（attempted/existing 命中本
     candidate 的 jobId），或「invalid retry predecessor for occ:X」且 occ:X 等于本 retry candidate
     的 derived identity 或其前驱 id。处置：该 candidate 记 durable receipt
     （`ADMISSION_INTERRUPTED`/`ADMISSION_REJECTED`），**tick 继续**，其余 candidates 各自依自身 merits 处理。
   - `global`（默认，含一切不可归类者）：store 读写/解析/校验、锁、fs、authority integrity。
     处置：受影响 candidate 记 `ADMISSION_INTERRUPTED`，未尝试 candidates 记
     `SKIPPED_POLICY`（reason=fail-closed propagation），追加 `global_tick_blocked` 证据事件
     （session 内去重），错误继续传播（fail-closed 保持 fail-loud）。
2. invoker `assertRunnable` 在 C-026 锁内验证失败时转为 **typed refusal**
   （`agent_not_runnable: <reason>` → `ADMISSION_REJECTED` receipt），不再是 tick-aborting throw。
   pre-start fail-closed 语义不变：无 Router 调用、无 occurrence 落盘、job 保持 enabled。
3. Supersession 声明：scheduler.js 原 reserve-loop 的「错误无条件传播出 tick」行为（注释误引
   “ACC-032/CROSS-AGENT”——V2 ACC-032 实为 CLI projection，无任何 spec 条款冻结 tick-abort）由本条
   取代；原 slot-accounting 测试 R3 所冻结的 fail-loud 传播语义同步更新为「receipted + isolated，
   sibling 照常 mint」。
4. `global_tick_blocked` / `retry_superseded_by_revision` 均为 runs.jsonl 追加型证据（V3 C-035「至少记录」
   开集的 additive 扩展），不改变 admission 政策、不重放 slot、不改 occurrence schema。

## §3 C-SH-003 — `self_ops.job_disposition` v2 输出（additive）

在既有 frozen-in-practice 字段（`jobId/expectedSlot/expectedSlotIso/slotClassification/admissionStatus/
occurrenceId/invocationStatus/durableReason/recoveryClassification?/recommendedSafeAction/fenceStatus/nextRun/
rootCause?/lastProvenStage/firstMissingStage`）之上**只增不改**：

```text
scheduleRevision              integer — job 当前 scheduleRevision
retryState {                  — stale/retry 轴（ledger + 证据派生）
  autoRetry                   boolean
  retryPredecessor            occurrenceId | null
  retryPredecessorRevision    integer | null
  currentScheduleRevision     integer
  staleRetryExpired           boolean
}
classification?               "STALE_RETRY_AFTER_SCHEDULE_REVISION"（活体判定或历史证据/毒点 receipt 命中时出现）
lastProvenStage / firstMissingStage   每个分支必答；枚举：
  TICK_OBSERVED | SCHEDULE_CALCULATION | DUE_SLOT_DETECTION | ADMISSION | ADMISSION_RESERVATION
  | EXECUTION_OUTCOME | EXECUTION_OUTCOME_RECORDED | PREDECESSOR_TERMINAL_OUTCOME | NONE
globalSchedulerHealth         "healthy" | "degraded"（近 10min 有 global_tick_blocked）| "unavailable"（近 10min 有 engine_lease_lost）
jobLocalHealth                "healthy" | "stale_retry_isolated"（活体 stale）| "quarantined_unknown"（fence）
recoveryEligibility           "SELF_RECONCILE_AVAILABLE" | "SELF_HEALED_NO_MUTATION_REQUIRED"
                            | "NONE_REQUIRED" | "HUMAN_REQUIRED"
```

规则：活体 stale（最新 terminal 仍为旧 revision failed）→ `SELF_HEALED_NO_MUTATION_REQUIRED` +
`stale_retry_isolated`；历史 stale（证据/receipt）保留 `classification`/`retryState` 但 eligibility 回落
`NONE_REQUIRED`；fence + router `terminated_without_outcome` → `SELF_RECONCILE_AVAILABLE`；fence + 证据
不足 → `HUMAN_REQUIRED`（fail-closed）。读侧权威不变：仅 caller-owned job 可查（opaque
`not_found_or_not_owned`），零跨 agent 披露。

## §4 C-SH-004 — recovery 矩阵（复用既有 surface，禁平行体系）

| 族 | 语义 | 正式操作 | receipt / 幂等 |
|---|---|---|---|
| R1 terminated_without_outcome | trusted termination proof → termination settlement → fence release，no blind retry | 既有 `self_ops.reconcile_turn`（CTR-V3-RECON-001） | 既有 CTR-V3-RECON-002 + CTR-V3-IDEMP-001（operationId 派生、byte-equivalent replay、零二次写） |
| R2 stale cross-revision retry | C-SH-001：不铸造 + durable disposition；**无 persisted 毒点需要清除** | 无 mutation —— `job_disposition` v2 回答 `SELF_HEALED_NO_MUTATION_REQUIRED` + 下一自然 slot | `retry_superseded_by_revision` 证据即 disposition |
| R3 stuck/fenced + sufficient proof | 同 R1 路径 | `reconcile_turn` | 同 R1 |
| R4 insufficient proof | 不得强解 | `reconcile_turn` 拒绝：`termination_not_proven` 等，zero-write；diagnosis 回 `HUMAN_REQUIRED` | 拒绝即 receipt，store byte 不变 |
| R5 runtime unhealthy | 全局健康不得伪装成 job 故障 | `job_disposition` v2 `globalSchedulerHealth` + `self_ops.status.runtime.health` | 诊断只读 |

禁止（重申 CP/Tools V3）：新增临时 shell/raw JSON/一次性脚本/operator-only shortcut/第二套 reconcile 模型；
本 Spec **不**新增任何 mutation action。

## §5 验收矩阵

| # | 场景 | 判定 |
|---|---|---|
| T1 | Job A rev1 failed + bump rev2 + retry.auto；Job B healthy due | A 无 retry mint、poison derived id 不存在于 store、`retry_superseded_by_revision` 落证据、B 照常 mint、tick 完成（真实 RED→GREEN） |
| T2a | A 的 agent 不可运行；B/C due | A `ADMISSION_REJECTED(agent_not_runnable)`、B/C mint、tick 完成 |
| T2b | 注入 job-local reserve throw（structured collision） | A `ADMISSION_INTERRUPTED`、B/C mint、tick 完成 |
| T2c | 注入不可归类 store 错误 | tick reject 保持、未尝试者 `SKIPPED_POLICY`、`global_tick_blocked` 落证据 |
| T2-classifier | 归属函数单元矩阵 | poison id 绑定本 candidate 才 job_local；错名/异 job/natural/不可归类一律 global |
| T3/T3b | `job_disposition` 活体 + 历史 stale | §3 字段全答；活体=SELF_HEALED、历史=NONE_REQUIRED 且 classification 保留 |
| T4 | diagnose → `reconcile_turn` → readback | 全链正式工具面；receipt 字段全（operationId/fenceBefore/fenceAfter/committedAt/evidenceRef） |
| T5 | 证据不足 | 拒绝 + zero mutation + `HUMAN_REQUIRED` |
| T6 | 同坐标重放 | byte-equivalent receipt、零二次写 |

## §6 DONE 映射（Goal §16）

`CROSS_REVISION_RETRY_POISON=FIXED`（T1）；`ONE_BAD_JOB_CAN_STOP_GLOBAL_TICK=NO`（T2*）；
`DUE_SLOT_SILENTLY_LOST=NO`（既有 slot accounting + 本 Spec 两类新证据事件）；
`MISSED_RUN_EXPLAINABLE_FROM_FEISHU=YES`（T3/T3b）；`SAFE_RECOVERY_FROM_FEISHU=YES`（T4）；
`RECOVERY_REQUIRES_SHELL=NO`（§4 无新 shell 面）；`RECOVERY_RECEIPT=YES`/`RECOVERY_IDEMPOTENT=YES`（T4/T6）；
`INSUFFICIENT_EVIDENCE_FAILS_CLOSED=YES`（T5）。REAL_FUTURE_SLOT/REAL_FEISHU_* 三项属 production E2E，
按 Owner gate（PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1）执行后回填。

## §7 不变性 preserved（明示不触碰）

fence 语义与 `GLOBAL_SCHEDULER_FENCE=FORBIDDEN`；termination-only settlement 的 business-state 不可
升级裁决（Owner P1）；delivery 与 execution 分离（D-007 §11.4）；Tools V3 冻结的 closed schema/七动作/
`status|reconcile_turn` 面、CTA authority matrix、reconcile 幂等公式；Feishu 路由与 CTR-ROUTE-001；
migration/store fail-loud authority 规则。One-shot（`at`）在 revision bump 后不再有未来 slot 属既有
natural 语义，本 Spec 不改。

## §8 Lifecycle gate block

```text
OPEN_OWNER_DECISIONS = NONE_FOR_IMPLEMENTATION
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

由 independent exact-head review（candidate `3b65db3`）certified；证言与 N1-N8 处置记录见
`docs/reports/SCHEDULER_SELF_HEALING_FROM_FEISHU_V1_AUTHORING.md`。
