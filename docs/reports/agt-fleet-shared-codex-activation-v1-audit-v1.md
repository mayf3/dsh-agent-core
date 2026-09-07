# AGT_FLEET_SHARED_CODEX_ACTIVATION_V1_AUDIT_V1 — 独立评审记录

> `TASK_NAME = 激活 审计` · 2026-09-03 · docs-only · ONE independent review（Owner readiness 授权项 2）。
> Subject: `docs/specs/AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1.md` @ branch
> `codex/fleet-shared-codex-auth-activation-v1`（base = main `40d0924` + authoring commit `4361ab8`）。

## 0. VERDICT

```text
REVIEW_VERDICT = PASS_WITH_ONE_MECHANICAL_FIX
BLOCKER_COUNT = 0
MAJOR_COUNT = 0
MINOR_COUNT = 1（M-1，本轮内修复并复验）
NOTE_COUNT = 3
READINESS_IMPACT = NONE（修复为措辞精确化，不改变任何契约语义）
```

## 1. 机械验证矩阵

| # | 验证项 | 结果 | 依据 |
|---|---|---|---|
| M-1 | Authority 边界 | PASS | governed_by 仅 V2（accepted PR #150）；不修改 V2 语义；production_apply_authority=none；HOLD 显式遵守 |
| M-2 | 闭包断言 vs R1 census | PASS | 8 文件/8 blob 与 census 一致；main compose.js（+140 行 session/scheduler 污染）与 main migration-executable（import 重构）显式禁入；memory.js/package.json/tests 禁入 |
| M-3 | 闭包 blob 存在性与可解析性 | PASS | 8 个 `git rev-parse 1fdf8c3:<path>` 全部存在（380f5264 / 4c744186 / a8620ea9 / 4444375d / 34479d81 / 963d03be / 89394ab3 / e2f69dac）；闭包 import 闭合（census MISSING_COUNT=0） |
| M-4 | v2/v3 互斥断言 | PASS | PR127 loader `parsed.version !== 3` throw（model-overrides.js:319）；installed loader `version !== 2` throw ⇒ CTR-ACT-003 同 quiesce 窗口原子升级是必要且充分的 |
| M-5 | runner 机制引用 | PASS | fence 路径、13+4 bindings、PIN（0.2.3 @ 75d98d5b / 2d29f95f…）、switchFleetConfig v3 前置、rollback 拒绝条件——与 `shared-codex-migration-executable.js` 逐项一致 |
| M-6 | bootstrap 分支契约 | PASS（修 M-1 后） | 十门 receipt 为唯一 credential-acquisition authority；bootstrap 模式禁 reauth；V1 provenance/reauth 契约保留（CTR-SCA-008/009 不弱化） |
| M-7 | 十门覆盖 | PASS | CTR-ACT-004（gates 1-2）+ CTR-ACT-006（gates 3-10）= CTR-SCA-017 全集；fail-closed commit=0 语义保留 |
| M-8 | 判别阶梯 | PASS | canaries（CEO/HR/Podcast/Shopping）→ small batch 5（fresh verify 可运行性）→ 91/91；显式禁止 0/91→91/91；阶段 rollback 只回本阶段面 |
| M-9 | Fresh gate 八项 | PASS | CTR-ACT-011 与 Owner 清单逐项一致；drift ⇒ 只调查具体 drift |
| M-10 | Secret 边界 | PASS | CTR-ACT-012 含 p1-originals 处置（不 push/不入 artifact/非必要不读/无 digest） |
| M-11 | 其他 Goal 面 | PASS | §2.2 显式排除；production queue 单写者约束（§3） |
| M-12 | 章节完整性 | PASS | Goal/Scope/Authority/Current-State/12 CTR/6 ACC/Rollback/Open-questions/Authoring-output；ACC 覆盖全部 CTR 的可测子集 |

## 2. M-1（minor，已修复）

CTR-ACT-005 原文「该模式下 `ownerReauthCanonical` binding 若存在 ⇒ fail closed」与 runner
现实冲突：`validateConfig`（executable:49）无条件要求该键存在。修复后契约：bootstrap 模式下
`validateConfig` 豁免 `ownerReauthCanonical`（不要求提供），且 config 若提供该键 ⇒ fail closed
（可执行实现：豁免+拒绝 ≈3 行，仍属 bounded delta 预算）。非 bootstrap 模式 validateConfig
行为不变。

## 3. Notes（非阻塞）

- N-1：R1 census 表中 compose 行的「f5c7a8d3+67 行」指 live blob + delta；闭包 compose 的
  精确 blob = `4c744186…`。artifact manifest 必须按 oid 冻结（CTR-ACT-001 已要求），避免歧义。
- N-2：CTR-ACT-010 的 small-batch GLM 判定依赖 PHASE 2 route 授权轮——spec 已用「按其自身
  授权轮执行」fence，正确地未在本 authority 隐授 route 变更。
- N-3：`switchFleetConfig` 写 config 为 0644（runner 硬编码）；与现生产 config mode 一致，无需
  delta；activation 后如需收紧属独立决定。

## 4. Boundaries

DOCS ONLY（本报告 + 同 branch 上 M-1 修复 commit）。零生产访问、零代码执行、零 secret。
PRODUCTION_CHANGE = NONE。

```text
AUDIT = PASS（M-1 已修）
NEXT = artifact/gate-script/bindings-config 制备（HOLD 下非生产 readiness）
```
