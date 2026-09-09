---
spec_id: SCHEDULER_FAILURE_DISPOSITION_ALERT_LIFECYCLE_V1
status: proposed
spec_kind: invariant
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
superseded_by: null
date: 2026-09-10
owners:
  - repository-maintainers
governed_by:
  - AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1
amends_upon_acceptance:
  - SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 (§5.5 run-health detection boundary; §5.6 W1
    alerting — via that spec's own amendment mechanism, NOT by editing it here)
supersedes: []
external_authorities: []
owner_drafting_mandate: >
  Owner ruling 2026-09-10 (PR #222 authority-conflict round):
  DRAFT_MINIMAL_DISPOSITION_ALERT_AUTHORITY = YES. 本文件是 docs-only 候选；
  acceptance 前不改变任何 runtime/detector 行为。
---

# SCHEDULER_FAILURE_DISPOSITION_ALERT_LIFECYCLE_V1

> **状态**：`proposed`（DRAFT，docs-only 候选；零实现授权）。本 Spec 只回答一个语义问题
> 并冻结其答案；acceptance（`accepted`）是进入任何实现 PR 的前置条件。
> 分类说明：`spec_kind: invariant`（本 Spec 冻结的是告警生命周期的长期语义不变式，
> 不携带任何 implementation contract；实现若被授权，将是独立的后续 PR，受本 Spec 的
> §4/§5 边界约束）。

## 1. The one semantic question

> 一个已经由正式 operator disposition 处理、且 failure fact 永久保留的 occurrence，
> 是否还需要持续作为 active alert 重复提醒？

**答案（冻结）**：不需要。Disposition 可以关闭**告警生命周期**（incident/alert layer），
但永不改写**失败事实**（fact layer）。两个 layer 必须显式分离。

## 2. Layer separation（本 Spec 的核心不变式）

```text
FACT LAYER:
  the run failed
  - executionOutcome = failed 是 durable fact，永久保留
  - 任何 disposition 都不得 rewrite failure into success
  - 任何 disposition 都不得 delete / alter audit ledger
  - 任何 disposition 都不得 change occurrence outcome

INCIDENT/ALERT LAYER:
  the owner has already dispositioned this exact failure
  - formal operator disposition MAY acknowledge/close the active incident
  - after acknowledgment: exactly ONE closure notification
    (RECOVERED / ACKNOWLEDGED 语义，渲染区分于新告警)
  - no repeated REMINDER for the SAME occurrence
  - new occurrence ⇒ new fingerprint ⇒ alerts normally
```

## 3. Frozen semantics（Owner 产品方向批准的冻结语义）

1. `executionOutcome=failed` ⇒ failure fact remains durable forever。
2. Formal operator disposition：
   - does NOT rewrite failure into success；
   - does NOT delete audit；
   - does NOT change occurrence outcome；
   - MAY acknowledge/close the active incident。
3. Acknowledgment 之后：恰好一条 closure 通知（RECOVERED/ACKNOWLEDGED），
   同一 occurrence 不再重复 reminder。
4. 新 occurrence ⇒ 新 fingerprint ⇒ 正常告警（NEW → bounded REMINDER → closure）。
5. 探测器（detector）语义与告警生命周期（lifecycle）语义严格分层：
   - **Detector 永远报告 facts**（`RUN_FAILED` 对 terminal failed 无条件可检测，
     与 `lateSettlement` 的任何字段无关——这正是 accepted spec §5.5/§5.6 的现行语义）；
   - **Lifecycle 消费 dispositions**（alert 状态机读正式 disposition 记录来
     acknowledge/close 已通知的 incident）；
   - 禁止在 detector 内部基于 `lateSettlement.basis` 等 bookkeeping 偷偷改变
     fact 的可检测性（2026-09-10 Owner ruling：该做法
     `OPERATOR_RECONCILED_RUN_FAILED_SUPPRESSION = NOT_AUTHORIZED_YET`，
     本 Spec 是其唯一合法替代路径的 authority 候选）。

## 4. What acceptance would authorize（且仅此）

- W1 alert 状态机新增**显式 acknowledgment 转移**：一条已通知（notifiedCount>0）的
  `RUN_FAILED` active alert，在出现对该 occurrence 的**正式 disposition 记录**后，
  转入 closed：恰好一条 closure 通知（渲染带 ACKNOWLEDGED/已处置 语义前缀），
  此后同 occurrence 的重复 finding 静默（fact 仍每轮出现在 evidence log 中）。
- 正式 disposition 的产生路径复用既有 occurrence disposition 工具语义
  （`--disposition` / `--reconcile` 已有的 operator 动作与收据），不新增 mutation 面。
- Closure 通知与 RECOVERED（条件自然消失）在渲染上可区分。

## 5. What this Spec does NOT authorize（明确禁区）

- 不改 `executionOutcome` / occurrence state / audit ledger 的任何字节。
- 不给 detector 增加任何 basis/lateSettlement 条件分支。
- 不在 acceptance 之前回加任何 suppression（PR #222 于 29a0d97 撤销的
  operator-reconciled suppression 保持撤销，直至本 Spec accepted 且实现 PR 通过）。
- 不授权任何生产 mutation；live 刷新仍走 Owner 门控的 postrepair 路径。

## 6. Until-accepted 状态（现行 standing behavior）

```text
terminal failed ⇒ RUN_FAILED 可检测（无条件）
operator-reconciled bookkeeping ⇒ 对 detector 可见性零影响
PR #222 safe head（29a0d97）= 现行实现基线
```

## 7. Acceptance criteria（independent semantic review 必答）

```text
FACT_VS_INCIDENT_SEPARATED           = YES？（§2 两层互不侵蚀）
DETECTOR_PURITY_PRESERVED            = YES？（§3.5 detector 零 basis 分支）
NO_SILENT_FAILURE_POSSIBLE           = YES？（new occurrence 必告警；fact 永在 evidence）
CLOSURE_EXACTLY_ONCE                 = YES？（同一 occurrence 恰一条 closure 通知）
NO_LEDGER_MUTATION_AUTHORIZED        = YES？（§5 禁区完整）
STANDING_BEHAVIOR_UNCHANGED_PRE_ACCEPTANCE = YES？（§6 与 PR #222 head 29a0d97 一致）
```

任一 = NO/UNPROVEN ⇒ SPEC = REVISE。

## 8. 与既有 artifact 的关系

- `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1`（accepted）：本 Spec 不修改其文件；
  accepted 后按其 amendment 机制登记语义 delta（§5.5 detector 边界不动，
  §5.6 alert lifecycle 增 acknowledgment 转移）。
- 背景事故：2026-09-09 reconciled occ 6c4cccaf… 的 bounded REMINDER 循环
  （已在 91cd6f0 时代被错误地用 detector suppression 处理，2026-09-10 撤销）。
  本 Spec 提供的是合法解法：保留 fact 检测、关闭 incident 重复。
- 历史 rejected alternative：detector 内 `lateSettlement.basis=operator-reconcile`
  suppression（rejected 2026-09-10, Owner ruling）——本 Spec 不复活该做法。
