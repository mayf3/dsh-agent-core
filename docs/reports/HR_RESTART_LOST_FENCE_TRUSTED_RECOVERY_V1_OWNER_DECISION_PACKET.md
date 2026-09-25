# HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V1 — OWNER DECISION PACKET

- date: 2026-09-25
- author: coding agent (spec authoring goal); Owner = mayf3
- mode: NO_PRODUCTION_MUTATION / NO_PROTECTED_STORE_EDIT / NO_HR_SPECIAL_CASING / IMPLEMENTATION_STARTED=NO
- candidate spec: `docs/specs/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1.md`
- frozen candidate SHA-256: recorded in §7 (filled after freeze; also in the review request)
- base: origin/main `b4e8511c533f8fa5be2f48dd56acc16bc79dff39`, branch
  `goal/hr-restart-lost-fence-trusted-recovery-v1` (isolated fresh worktree)

## 1. Question before the Owner

Runtime restart 后遗留的 durable `outcome_unknown` active fence
（failureReason=`runtime_restart_ownership_unavailable`, terminationEvidence=null,
exitObservedAt=null）在 accepted PLH_V3 契约下永远无法结算：retired epoch 的
live ownership 永久不可重建，而 C-019/C-024 明文禁止 PID/时间/new-generation
捷径，并把这个缺口显式留给了 "a separately accepted trusted mechanism"。

实时受影响记录（同一 class，均 admission-dead）：

```text
turn:961534a5-8c94-487d-8e55-d324a54e821a:a2:g1:s256   (agt_hr-agent)
same class: article-publisher s168, reader-simulator s30
```

候选机制（generic，无任何 per-agent 特判）：

- root-authenticated whole-host quiescence proof bundle（受控停机回执[如涉及]、
  完整 root 进程普查零 runtime 树成员、workspace/session holder 零占用、
  epoch retirement、exact record preimage 绑定，全部 fail-closed 校验）；
- Router startup 消费 bundle，对 ONE exact record 通过既有 settle-once 机器结算为
  `terminated_without_outcome` + 新 evidence kind `restart_quiescence_proven`，
  fence 清除、admission 重开；exitObservedAt 永远保持 null（不伪造 child_real_exit）；
- 业务结局保持 outcome_unknown，零 replay，handle-keyed（无 by-agent sweep）；
  单 host 假设显式成条款（multi-host 下该证据类不充分）。

## 2. Requirement-4 disposition（spec §4）

**NEW_EVIDENCE_CLASS_REQUIRED = YES**：在 C-015 closed vocabulary 追加第 6 个
trusted kind `restart_quiescence_proven`，复用既有 settle-once authority。
独立的 recovery-proof 字段/独立结算 authority 被否决——它会把 C-017 的
single-winner 结算分裂成两条 winning path，并迫使全部 trusted consumer
（bridge / self-ops / durable validator）学习第二套 proof 通道。
四个 closed set 的 disposition 矩阵见 spec §4（scheduler 侧两处各 +1 行以保证
端到端收敛；`exact_started_then_idle` 的既有缺席维持不变）。

## 3. RESTART_SAFETY_PREREQ（spec RQ-007）

任何作为本机制一部分（或其前置）的 stop/restart 之前，全部成立：

1. `ROUTER_RESTART_SAFETY = PROVEN`：部署二进制含 durable generation floor
   （`highestIssuedGeneration`，main ≥ `2097e4f`；evidence:
   docs/evidence/router-durable-generation-restart-safety-v1-20260921）。
   无 floor 的二进制上禁止 recovery restart——generation 重发会同时破坏
   store range 不变量与本机制的 exact identity binding。
2. validator-before-producer 顺序：先部署扩展 durable validator 的二进制，
   才允许任何 settlement 写出新 kind（旧 validator 读到新 kind 会 fail-closed
   `durable_store_invalid`——不损坏但会 admission-block，故 rollback floor
   必须在部署记录中 pin 定）。
3. trusted control plane 部署纪律（TRUSTED_CP_PACK_INPUT_PROVENANCE_V1 安装器、
   production-deploy.lock 不抢不清）。
4. recovery plan 的前置集验证通过后才允许其 stop/restart（RQ-005）。

## 4. SECURITY_TEST_MATRIX

spec §6（ACC-RQ-001..008，含三记录独立结算、端到端 scheduler 收敛、preimage
回滚、validator 顺序）与 §7（NEG-RQ-001..016：bundle 缺失/篡改/custody 无效、
precondition 不匹配、census 非零、self-epoch 拒绝、重放/冲突 immutable、
无 sweep 入口、不可伪造 child_real_exit、controlledStop 绑定、hostId 绑定、
barrier 期间 not_admitted、非 root 无法投放、容量压力不驱逐 unresolved）。

要点：任何 UNKNOWN/invalid 元素 ⇒ zero-write + fail loud，记录保持 blocked；
篡改指示进 structured health，不静默。

## 5. Owner 决策（exact wording）

Owner 逐条回答；任何一条 NO 即整体不落地、candidate 保持 draft：

```text
OWNER_DECISION_Q1 = <YES | NO>
  Q1: ACCEPT the candidate spec HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1
      as the "separately accepted trusted mechanism" of PLH_V3 C-019/C-024 —
      i.e. accept the NEW trusted terminationEvidence kind
      `restart_quiescence_proven` and the startup-consumed root-authenticated
      whole-host quiescence proof, exactly as frozen in the candidate SHA.

OWNER_DECISION_Q2 = <YES | NO>
  Q2: AUTHORIZE implementation (code + tests + evidence tooling) to BEGIN
      only after INDEPENDENT_REVIEW = PASS with BLOCKERS = NONE on the same
      frozen SHA, under the RQ-007 deployment prerequisites, with
      PRODUCTION_MUTATION still separately authorized.

OWNER_DECISION_Q3 (conditional, only if Q1=NO) = <REJECT reason>
```

**Recommendation: Q1 = YES, Q2 = YES.** 理由：该 class 在 accepted 契约下被
证明永久卡死（契约自己命名的机制缺失）；候选机制 truthful（termination-only、
不伪造 child_real_exit、不猜测）、最小（一个 enum 值 + 一个 bundle 消费步 +
两处 +1 行 set 扩展）、fail-closed 全覆盖、且与既有 settle-once/consumer
体系完全同构。否决 Q1 的实际替代方案只有：永久放弃这三个 agent 的
admission（人工重建 agent），或接受一个更弱的猜测性机制——两者都更差。

## 6. Input gap — Owner recovery packet M1–M7

要求中引用的 "current Owner recovery packet M1–M7" 在本 session 可达面内
未找到：repo docs/、.incident-artifacts/、production worktrees、
project 目录平级 worktrees 均无；Agent Forum 需 broker 凭据（本 session
无 forum_* 工具，API 未认证）。本候选因此写成自包含（不依赖该 packet 的
任何未复述约束）。**若该 packet 含额外约束（如三 agent 的处置顺序、
某些记录必须保留 fenced），Owner 须在裁决时附上，candidate 相应修订
（amend）后再 review。** 在此之前，本 packet 不声称已满足 M1–M7。

## 7. Handoff

```text
HANDOFF_PATH = docs/specs/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1.md
              docs/reviews/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1_INDEPENDENT_REVIEW_REQUEST.md
              (this packet)
SPEC_SHA256  = 023797c16c2a2b45a458c7b40f1349eaa3d3e08aac342a752c862676e7ed5a41
BRANCH       = goal/hr-restart-lost-fence-trusted-recovery-v1 (isolated worktree,
               fresh from origin/main b4e8511c)
NEXT_SINGLE_ACTION = dispatch INDEPENDENT semantic review per the request file;
                     then Owner answers Q1/Q2/Q3 above.
IMPLEMENTATION_STARTED = NO
PRODUCTION_MUTATION    = NO
```
