# AGENT_CREDENTIAL_ROTATION_SEAM_V1 — Deployment Packet

> status（2026-09-09 docs-only conformance fix，对齐 accepted AMENDMENT_7）：
> **READY_FOR_PRODUCTION_PACKET = YES** · **READY_FOR_PRODUCTION_APPLY = NO** ·
> **PRODUCTION_APPLY = HOLD** · **GOAL_STATUS = BLOCKED_BY_DEPENDENCY** ·
> **OWNER_ACTION_REQUIRED = NONE**
> （等 production slot 显式释放；释放 ≠ production apply authorization，
> 释放后仍须按 §4 真实顺序逐项验收；无 auto-apply）
> governing: `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` AMENDMENT_7（accepted，
> PR #223 merged @ d3d1363 + acceptance-header note PR #227 @ 232bc2d）
> evidence: `docs/investigations/AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1.md`
> coordinates（两个概念不得混写）:
> - `IMPLEMENTATION_CANDIDATE` = `f1293eb`（base main `232bc2d`；commits
>   `c57f38e` 实现 r1 + `f1293eb` audit-fix r2）——实现代码的固定 candidate；
> - `PACKET/PR_EXACT_HEAD` = 本包修复提交（≠ candidate；以 PR #228 head 为准）。
>   `f1293eb..d433f14` 仅新增本 packet（77 行，无代码变更）；本次修复同样
>   docs-only，不产生任何实现 delta。
> audit: independent implementation audit REVISE（2 SB + 4 MF）→ union 一次 →
> delta re-audit **READY_FOR_PRODUCTION_PACKET / 0 blocker**（2026-09-09）

## 1. 本包交付什么

Canonical operator ROTATION seam（AMENDMENT_7 I.3/I.4 产品化）：

- `packages/agent-credential-provisioning/src/rotation-seam.js` —
  GATE（scrypt 单代证明 + receipt 交叉核对，每次接触先于任何 mutation）→
  PLAN（deterministic operationId + preimage 指纹冻结）→
  GENERATE（内存内 32B base64url + auth secret.ts 精确 scrypt 格式）→
  APPLY（特权 (e) 通道 + store 原子换装；换装失败 → 有界恢复：
  preimage 回滚 DB + 原子还原 store → ROLLED_BACK；回滚不能完成 →
  SPLIT_STATE_OPEN receipt + recovery artifacts，绝不静默）→
  VERIFY（双侧 readback + MINT_VERIFY + REAL_AUTH_CALL_VERIFY，缺一即
  VERIFY_INCOMPLETE fail-closed）→ RECEIPT（append-only JSONL，仅指纹，
  secret 字段拒收）。
- `scripts/agent-credential-rotate.mjs` — operator CLI（rotate/gate/
  receipts/selftest；secret 全程进程内，Part H 红线合规）。
- `replaceCredentialForAgent`（store-writer）：同一受信纪律的原地替换写面。
- p4-final.sh（repo 外事故 artifact）FAIL_CLOSED 处置：无条件
  pre-mutation refusal exit 31，证据主体保留；p4-proof.sh 验证无 rotation 面。

## 2. 明确不在本包（外部前置，auth-service 仓库 EXTERNAL_ONLY）

- 特权 rotation 通道本体（(e)：列级特权分离 + 专用 rotation 身份）。未就绪时
  seam 的 APPLY/ROLLBACK 默认 fail-loud `external_prerequisite_missing(e)`，
  refusal receipt 落账，零 mutation —— 该 fail-closed 行为本身已验收。
- T5/T6/T7 与 T8 端到端：外部前置满足前不可执行——executability 逐项表达见
  §3（严格镜像 accepted Spec L4-T5..T8，无新 dependency 模型）。
- 完整 DB metadata census（`updated_at > created_at AND rotated_at IS NULL`）：
  仅在 production preflight 需要时执行一次 bounded metadata-only read gate；
  不作为本包前置。

## 3. 验收状态（NOW 项全绿；executability 按 accepted Spec L4 逐项表达）

| 项 | 状态 | 证据 |
|---|---|---|
| T1 boot/消费面 read-only | PASS | rotation-seam.test.js（gateway 消费后 store byte+mtime 不变） |
| T2 spawn NOOP | 见 debt（结构面=child 零 credential 写；无自动化测试，record-only debt） | — |
| T3/T4 ensure NOOP/singleton | PASS | 既有 PA3/PA2/concurrent-ensure 测试（provisioning.test.js） |
| T5 = NEEDS(e)（直写拒绝） | 不可执行（外部前置） | spec L4-T5 |
| T6 = NEEDS(e)（hash-only 拒绝） | 不可执行（外部前置） | spec L4-T6 |
| T7 = NEEDS(e)（hash+rotated_at 缝外拒绝） | 不可执行（外部前置） | spec L4-T7 |
| T8 canonical rotate 全契约 | 见下方精确分解（spec L4-T8 原文镜像） | spec L4-T8 |
| T9 swap 失败有界恢复 + split 不静默 | PASS | T9/T9b/T9-inherited-gate |
| T10 operation-id 幂等重放 | PASS | T10（零二次 mutation） |
| T11 p4 形态 fail-before-mutation | PASS | T11 + guard live（p4-final.sh exit 31 实证） |
| T12 fixture rotation 全链 | 两层表述，见下方（不得笼统写 PASS） | spec L4-T12 |

**T8（canonical rotate 全契约）dependency expression = accepted Spec L4-T8 精确
语义**：

```text
T8 canonical rotate full contract =
  mutation mechanics: NEEDS(e)

  verify chain additionally requires:
    NEEDS(c)
    + NEEDS(d) when using ownerless-agent fixture
      （ownerless agent-profile 的 v1 mint 先受 (d) profile validation 门控，D.5）
    + NEEDS(a) only when the chosen REAL_AUTH_CALL_VERIFY uses a business
      audience requiring that grant

  alternatively:
    service-profile dedicated fixture may avoid (d)/(a),
    but does NOT avoid (e) or the management/verification prerequisite
    actually used.

  两种承载二选一，验收时声明。
```

**T12 两层表述（不得把 fixture/stub 的成功冒充 production canonical rotation
E2E）**：

```text
T12 helper / sandbox / fixture mutation mechanics = PASS
     （T12 receipt 全要素；fixture store + stub DB）

T12 real mint + real auth-call chain =
     CONDITIONAL / NOT_YET_PRODUCTION-PROVEN
     prerequisites follow accepted Spec:
       ownerless-agent carrier → NEEDS(c)+(d)
       service-profile fixture → declare carrier explicitly; (d) may not apply
```

测试：provisioning 包 59/59；CLI selftest 5/5；broker 回归 381/381（零 broker
语义变更——manifest/transport 未动）。（以上均为 helper/sandbox/fixture 面；
不构成 production rotation E2E。）

## 4. Apply 真实顺序（slot 释放 ≠ production apply authorization）

```text
production slot release
→ auth-service prerequisite (e) 按其自身 authority/spec 实现并验收
→ 选择并记录 T8/T12 verification carrier
   （ownerless-agent fixture vs service-profile fixture，二选一，显式声明）
→ fresh verify 本次实际需要的 (c)/(d)/(a)
→ T5/T6/T7 + T8 full contract 真实验收
→ dedicated fixture-first canonical rotation（I.5；对生产 credential 的任何
   rotation 走 I.3 全契约 + 本 CLI）
→ receipt/readback/post-verify
→ only then production credential rotation may become READY_FOR_PRODUCTION_APPLY
```

操作细节（并入上列相应步骤，均为既有语义）：

1. 每轮 rotation 前的 fresh readback：`agent-credential-rotate.mjs gate
   --agent <agt_*> --client-id <mc_*> --db-url ...`（GATE 必须 PASS 或以已记账
   的 reconciliation 状态显式说明）。
2. (e) 机制在 auth-service 仓库按其自身治理落地（AUTH_CHANGE_REQUIRED=
   EXTERNAL_ONLY 不变）——APPLY 的特权通道接线点 =
   `rotation-seam.js` 的 `applyDbRotation`/`rollbackDbRotation` 注入面。
3. post-verify 读回 receipt 账本 + census（如需，§2 合并 gate）。
4. 回滚：`*.preimage-<operationId>.bak`（0600）+ 通道 rollback 面；
   SPLIT_STATE_OPEN 态 = 先 reconciliation 后再 rotation（seam 自动拒）。

## 5. 已记录 FOLLOW_UP_DEBT（record-only，不阻塞）

EPIPE stdin 加固（CLI 随行项）；L4-T2 自动化覆盖；`.bak` COMPLETED 后清理
策略；readTrustedStore 重复键拒绝；(e) 通道签名带 preimage 指纹；CLI --db-url
改 env/.pgpass；p4-proof.sh 的 curl -u 形态随 fixture runbook 退役；receipt
red-line 增补 secretHash 形状拒绝。
