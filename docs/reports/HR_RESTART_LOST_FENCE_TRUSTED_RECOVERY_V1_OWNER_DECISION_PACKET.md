# HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_V1 — OWNER DECISION PACKET

- date: 2026-09-25
- author: coding agent (spec authoring goal); Owner = mayf3
- mode: NO_PRODUCTION_MUTATION / NO_PROTECTED_STORE_EDIT / NO_HR_SPECIAL_CASING / IMPLEMENTATION_STARTED=NO
- candidate spec: `docs/specs/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1.md`
- frozen candidate SHA-256: recorded in §7 (filled after freeze; also in the review request)
- base: original candidate `6ea3476d2e389067e1b7e5686514116da8ce1831`
  (itself from origin/main `b4e8511c533f8fa5be2f48dd56acc16bc79dff39`);
  B1–B3 docs amendment in isolated worktree

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
（bridge / self-ops / occurrence authority / durable validator）学习第二套 proof 通道。
六个 closed set 的 disposition 矩阵见 spec §4（scheduler 侧四处各 +1 行以保证
端到端收敛；`exact_started_then_idle` 的既有缺席维持不变）。

## 3. RESTART_SAFETY_PREREQ（spec RQ-007）

任何作为本机制一部分（或其前置）的 stop/restart 之前，全部成立：

1. `ROUTER_RESTART_SAFETY = PROVEN`：部署二进制含 durable generation floor
   （`highestIssuedGeneration`，main ≥ `2097e4f`；proof-status index:
   `docs/evidence/router-durable-generation-restart-safety-v1-20260921/PROOF_INDEX.md`）。
   As of 2026-09-25 this gate is NOT satisfied: source fix merged and reviewed,
   deployed binary pre-floor, post-deploy proofs 1–9 pending,
   `ROUTER_RESTART_SAFETY = PROVEN 未达成`.
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
六处 +1 行 set 扩展）、fail-closed 全覆盖、且与既有 settle-once/consumer
体系完全同构。否决 Q1 的实际替代方案只有：永久放弃这三个 agent 的
admission（人工重建 agent），或接受一个更弱的猜测性机制——两者都更差。

## 6. Owner recovery packet M1–M7 — located and mapped

The original authoring-session statement that this packet was unavailable is
superseded by the independent review's §3 finding. The authentic Owner packet
is `/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/HR_AGENT_OUTCOME_UNKNOWN_EXACT_RECOVERY_V1/OWNER_DECISION_PACKET-TRUSTED-OPERATOR-RECOVERY-20260925.md`
(SHA-256 `42de489c4ff826fda9aca8478fd345c05cedea7f8db24a2788444b95d1c71a32`),
also pinned by the adjacent single-record s256 binding handoff (SHA-256
`02a12d47e1ba46863e083740b56c2b1701c4a375ff62d0ee0df630bc5b2603d2`).
The original packet and historical commit messages are unchanged.

| Owner envelope | Candidate compliance mapping |
|---|---|
| M1 exact tuple, one record, no sweep | RQ-004 P1–P10 handle binding; RQ-006 and NEG-RQ-010 prohibit by-agent/by-epoch entry points. |
| M2 trusted evidence or exact live ownership, never guesswork | RQ-001–004 add one trusted permanent-quiescence evidence class under Owner acceptance; §3.3 keeps PID/time/new-generation shortcuts rejected. |
| M3 UNKNOWN fails closed | RQ-003 V1–V8 treats UNKNOWN as invalid; zero-write and structured failure. |
| M4 single-writer exclusivity | RQ-004/005 consume at Router startup behind the closed admission barrier with per-record preimage, restore-on-failure, and existing crash cleanup. The in-process startup window substitutes for the packet's external runner. |
| M5 deploy first | RQ-007 keeps the PROVEN restart-safety floor a hard prerequisite; §3 above states it is currently unmet. |
| M6 process gates | §6 deterministic selftests, RQ-005 validation plan, and §9 independent review/Owner gates precede implementation; production apply remains separate. |
| M7 non-attribution | The mechanism issues no signal; RQ-002 controlled-stop receipt, if applicable, is not termination evidence. |

This mapping is a candidate compliance assessment, not Owner acceptance. The
independent review's B1–B3 findings require amendment, re-freeze, and delta
re-review before Q1/Q2 can be presented.

## 7. Handoff

```text
HANDOFF_PATH = docs/specs/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1.md
              (this packet)
HISTORICAL_REVIEW_REQUEST = docs/reviews/HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V1_INDEPENDENT_REVIEW_REQUEST.md
                            (targets PRIOR_SPEC_SHA256; new delta review required)
SPEC_SHA256  = cd359661d9a850ee26cb979d994f321c42b9863092b16ae8cc3c26f96a197c9b
PRIOR_SPEC_SHA256 = 023797c16c2a2b45a458c7b40f1349eaa3d3e08aac342a752c862676e7ed5a41
AMENDMENT_BASE = 6ea3476d2e389067e1b7e5686514116da8ce1831
NEXT_SINGLE_ACTION = independent B1–B3 delta review of this amended frozen SHA;
                     only after PASS with BLOCKERS=NONE may Owner answer Q1/Q2.
IMPLEMENTATION_STARTED = NO
PRODUCTION_MUTATION    = NO
```
