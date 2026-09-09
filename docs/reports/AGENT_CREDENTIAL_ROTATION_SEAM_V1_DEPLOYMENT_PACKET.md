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

---

# CROSS-REPO CONSOLIDATION（2026-09-09，STEP 8 —— 本文件升级为唯一 production packet）

本 packet 由 LANE A packet 扩展为覆盖双 lane 的**唯一** cross-repo production packet
（governing goal `AGENT_CREDENTIAL_DRIFT_BOOT_HOOK_ROOT_CAUSE_V1`，
CURRENT_PHASE = CROSS_REPO_INTEGRATION_AND_ACCEPTANCE）。

## 6. 冻结的 accepted heads（fresh read-back 2026-09-09）

```text
AMENDMENT_7_MERGED      = YES（dsh #223 @137819b ∈ main@892a26a；acceptance 镜像 #227）
GOVERNING_SPEC          = docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md（current main accepted bytes）
DSH_LANE_A              = PR #228 head d433f14f1d28c5a40440e5cd527a1c4ca77f8298（merge a068c51；audit PASS/0 blocker）
AUTH_LANE_B             = auth-service PR #65 head 0e551c5（merge 5e07df5；independent audit r1 REVISE(2SB+6MC) → union fix 0e551c5 → delta re-audit ACCEPT/0 blocker）
DB_MIGRATION            = auth-service prisma/migrations/20260909010000_machine_credential_rotation_seam/migration.sql
AUTH_ENFORCEMENT        = 列级特权分离（NOLOGIN machine_credential_owner 持 machine_clients）+ SECURITY DEFINER rotate_machine_client_secret() + receipt 表（operation_id UNIQUE 幂等重放）+ guard trigger（SET ROLE 复现被 role-GUC 检查拒绝）
ROTATION_OPERATOR       = scripts/agent-credential-rotate.mjs（本仓）经 privileged-channel-psql.js 接线 (e) 通道 —— ONE_SUPPORTED_ROTATION_ENTRY
STORE_INSTALLER         = replaceCredentialForAgent（受信纪律原子换装，preimage 备份 .preimage-<operationId>.bak）
WIRING                  = dsh PR #231（feature/credential-seam-wiring-v1）
```

## 7. T1–T12 最终矩阵（唯一权威版本）

| T | 项 | 结果 | exact test | repo@SHA |
|---|---|---|---|---|
| T1 | boot no rotation | PASS | `rotation-seam.test.js` "T1 gateway 消费后 store byte+mtime 不变" | dsh@d433f14 |
| T2 | spawn no rotation | PASS | `agent-credential-rotation/test/credential-integrity.test.js`（T2 copyOnce + T2b 不凭空造凭据）| dsh@#231 head（本 wiring PR）|
| T3 | ensure existing NOOP/fail-loud | PASS | `provisioning.test.js` PA3（existing_credential_resolution_required）+ enforcement 上下文 | dsh@d433f14 |
| T4 | concurrent ensure safe | PASS | `provisioning.test.js` PA2（concurrent ensure singleton）| dsh@d433f14 |
| T5 | direct hash update rejected | PASS | `secret-mutation-enforcement.test.ts` T5 | auth@0e551c5 + cross-repo E |
| T6 | hash-only ORM bypass rejected | PASS | `secret-mutation-enforcement.test.ts` T6 | auth@0e551c5 |
| T7 | hash+rotated_at bypass rejected | PASS | `secret-mutation-enforcement.test.ts` T7 + cross-repo E | auth@0e551c5 |
| T8 | canonical rotate 全契约 | PASS | `secret-mutation-enforcement.test.ts` T8（恰一次/rotated_at 前移/audit 带 receipt lineage/单 receipt）+ cross-repo A | auth@0e551c5 + dsh@#231 |
| T9 | partial failure recoverable | PASS | `rotation-seam.test.js` T9/T9b/T9-gate + cross-repo D | dsh@d433f14 + dsh@#231 |
| T10 | replay idempotent | PASS | `secret-mutation-enforcement.test.ts` T10 + `rotation-seam.test.js` T10 + cross-repo B | auth@0e551c5 + dsh@两处 |
| T11 | business-Agent proof rejected | PASS | `rotation-seam.test.js` T11 + p4-final.sh exit-31 live + cross-repo F | dsh@d433f14 |
| T12 | fixture proof PASS | PASS | `rotation-seam.test.js` T12 + cross-repo A（fixture principal 全链）| dsh@d433f14 + dsh@#231 |

## 8. ORDERED APPLY（load-bearing：AUTH ENFORCEMENT FIRST）

```text
1. AUTH ENFORCEMENT FIRST —— auth-service #65 merge 后，在 auth 生产库执行
   admin 三步握手 + migration 20260909010000（§11.3）；禁先部署 DSH operator。
2. verify ordinary direct write blocked —— enforcement 套件对生产库跑一遍
   （或复用 T5/T6/T7 语义的只读验证）+ 封印断言（pg_has_role=false / SET ROLE 拒绝）。
3. DSH canonical operator —— 本仓 wiring PR #231 merge 后，
   agent-credential-rotate.mjs selftest + gate（--db-url 即自动接线 (e) 通道）。
4. cross-repo canary fixture rotation —— DEDICATED FIXTURE principal（I.5），
   A 全链（DB advance exactly once / store match / MINT / REAL_AUTH_CALL）。
5. DB/store/mint/auth verify —— post-verify 读 receipt 账本 + metadata census。
```

## 9. Fleet metadata census（STEP 7 —— 唯一 bounded Owner native read-only gate）

`scripts/agent-credential-metadata-census.mjs`（selftest 3/3；metadata-only：
无 secret bytes——hash 仅进程内 scrypt 配对验证 + 12-hex 指纹）。Owner 单命令：

```bash
DATABASE_URL=<auth DATABASE_URL> sudo -u authsvc /usr/local/bin/node \
  /Users/yanfenma/workspace/project/dsh-agent-core/scripts/agent-credential-metadata-census.mjs \
  --store /usr/local/libexec/agent-core/config/agent-credentials.json --out /tmp/cred-census.json
```

谓词 = spec 冻结的 `updated_at > created_at AND rotated_at IS NULL`；分类
KNOWN_HISTORICAL_INCIDENT / ACTIVE_DRIFT / LEGACY_INCOMPLETE_METADATA / OTHER；
`FLEET_METADATA_CENSUS=PASS` ⇔ ACTIVE_DRIFT=0。

## 10. ROLLBACK（冻结）

- DSH：store 侧 `.preimage-<operationId>.bak`（0600）+ 通道 rollback 面
  （rollbackDbRotation：DB 收敛到 store 持有 generation，receipted
  `<operationId>:rollback`，重放幂等）；SPLIT_STATE_OPEN = 先 reconciliation。
- AUTH：migration 不可逆（owner 转移）——回滚 = 契约 §11 明示的 DDL 级操作
  （machine_credential_owner 持有；普通 DML 面不变，撤销 (e) 需显式重授，
  属 owner 级 DDL 审计事件）。
