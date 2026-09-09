# AGENT_CREDENTIAL_ROTATION_SEAM_V1 — Deployment Packet

> status: READY_FOR_PRODUCTION_APPLY（2026-09-09）· PRODUCTION_APPLY = **HOLD**
> （等 production slot 显式释放；释放后按 §4 顺序执行，无 auto-apply）
> governing: `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` AMENDMENT_7（accepted，
> PR #223 merged @ d3d1363 + acceptance-header note PR #227 @ 232bc2d）
> evidence: `docs/investigations/AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1.md`
> candidate: `implementation/credential-rotation-seam-v1` @ `f1293eb`
> （base main `232bc2d`；commits `c57f38e` 实现 r1 + `f1293eb` audit-fix r2）
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

## 2. 明确不在本包（NEEDS(e)，auth-service 仓库 EXTERNAL_ONLY）

- 特权 rotation 通道本体（(e)：列级特权分离 + 专用 rotation 身份）。未就绪时
  seam 的 APPLY/ROLLBACK 默认 fail-loud `external_prerequisite_missing(e)`，
  refusal receipt 落账，零 mutation —— 该 fail-closed 行为本身已验收。
- T5/T6/T7（直写拒绝矩阵）与 T8 端到端：NEEDS(e) 后才能执行。
- 完整 DB metadata census（`updated_at > created_at AND rotated_at IS NULL`）：
  仅在 production preflight 需要时执行一次 bounded metadata-only read gate；
  不作为本包前置。

## 3. 验收状态（NOW 项全绿）

| 项 | 状态 | 证据 |
|---|---|---|
| T1 boot/消费面 read-only | PASS | rotation-seam.test.js（gateway 消费后 store byte+mtime 不变） |
| T2 spawn NOOP | 见 debt（结构面=child 零 credential 写；无自动化测试，record-only debt） | — |
| T3/T4 ensure NOOP/singleton | PASS | 既有 PA3/PA2/concurrent-ensure 测试（provisioning.test.js） |
| T5–T8 | NEEDS(e)（外部前置） | spec L4 冻结 |
| T9 swap 失败有界恢复 + split 不静默 | PASS | T9/T9b/T9-inherited-gate |
| T10 operation-id 幂等重放 | PASS | T10（零二次 mutation） |
| T11 p4 形态 fail-before-mutation | PASS | T11 + guard live（p4-final.sh exit 31 实证） |
| T12 fixture rotation 全链 | PASS | T12（COMPLETED receipt 全要素） |

测试：provisioning 包 59/59；CLI selftest 5/5；broker 回归 381/381（零 broker
语义变更——manifest/transport 未动）。

## 4. Apply 顺序（slot 释放后，需 Owner 特权操作逐项授权）

1. fresh readback：`agent-credential-rotate.mjs gate --agent <agt_*> --client-id <mc_*> --db-url ...`
   （GATE 必须 PASS 或以已记账的 reconciliation 状态显式说明）。
2. auth-service (e) 机制落地并验收（其自身治理；AUTH_CHANGE_REQUIRED=
   EXTERNAL_ONLY 不变）——APPLY 的特权通道接线点 =
   `rotation-seam.js` 的 `applyDbRotation`/`rollbackDbRotation` 注入面。
3. 真实 rotation 优先 `DEDICATED FIXTURE principal`（I.5）；对生产 credential
   的任何 rotation 走 I.3 全契约 + 本 CLI。
4. post-verify 读回 receipt 账本 + census（如需，§2 合并 gate）。
5. 回滚：`*.preimage-<operationId>.bak`（0600）+ 通道 rollback 面；
   SPLIT_STATE_OPEN 态 = 先 reconciliation 后再 rotation（seam 自动拒）。

## 5. 已记录 FOLLOW_UP_DEBT（record-only，不阻塞）

EPIPE stdin 加固（CLI 随行项）；L4-T2 自动化覆盖；`.bak` COMPLETED 后清理
策略；readTrustedStore 重复键拒绝；(e) 通道签名带 preimage 指纹；CLI --db-url
改 env/.pgpass；p4-proof.sh 的 curl -u 形态随 fixture runbook 退役；receipt
red-line 增补 secretHash 形状拒绝。
