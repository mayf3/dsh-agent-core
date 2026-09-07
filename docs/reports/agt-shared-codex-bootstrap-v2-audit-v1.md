# AGT_SHARED_CODEX_BOOTSTRAP_V2_AUDIT_V1 — 独立评审记录

> `TASK_NAME = 共享 审计` · 2026-09-03 · docs-only · 独立 reviewer 轮。
> Subject: `docs/specs/AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V2.md` @ exact head
> `d8a4eb143dcac23d46513f959b7e802df015582f`（branch `codex/shared-codex-emergency-bootstrap-amendment-v1`，
> base = origin/main `433b8bd` + proposal 单 commit）。
> 本轮 zero production access beyond read-only fresh facts；zero code change；本文件是唯一交付物。

## 0. VERDICT

```text
REVIEW_VERDICT = PASS
BLOCKER_COUNT = 0
MAJOR_COUNT = 0
MINOR_COUNT = 0
NOTE_COUNT = 5
ACCEPTANCE_READINESS = READY_FOR_OWNER_EXACT_HEAD_ACCEPTANCE
OWNER_ACTION_REQUIRED = EXACT_HEAD_ACCEPTANCE（唯一 Owner gate）
```

## 1. 轮次独立性与方法

- Reviewer 为全新独立 coordinator（MODEL_FLEET_GLM_LUNA_PRODUCTION_V1 PHASE 0 后首轮审计），
  与 authoring 轮（`TASK_NAME = 共享 执行`，2026-09-01）无共享聊天上下文。
- 方法：V2 草案全文逐节读 + 与 accepted V1（origin/main
  `docs/specs/AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1.md` @ `a0ce485`）全文件 diff 逐 hunk 分类
  （35 hunks）+ 关键 production facts fresh re-verify（2026-09-03，只读，metadata/等值判定 only）。

## 2. 机械验证矩阵

| # | 验证项 | 结果 | 依据 |
|---|---|---|---|
| M-1 | Form = COMPLETE_STANDALONE_WHOLE_AUTHORITY（SPEC_GOVERNANCE_V0 §9.2） | PASS | 改变 accepted CTR-SCA-014 的 migration/failure meaning，未原地改写 V1；新 stable ID + frontmatter 完整（spec_id/status/authority 三元组与 V1 同构） |
| M-2 | Proposal 阶段不修改 V1 lifecycle | PASS | fresh fetch：origin/main V1 仍 `status: accepted`、`superseded_by: null`；本分支 diff 不含 V1 文件 |
| M-3 | V1 normative body 保留 | PASS | 35 hunks 全数分类：frontmatter/header（successor 标识）、§1-§3（前任指针 V2-trio→V1、acceptance edges）、§4-§8 纯新增（STATE-SCA-005、OBS-SCA-010/011、CLM-SCA-005/006、EVD-SCA-006、DEC-SCA-006）、CTR-SCA-014 仅 4 处 surgical carve-out（均显式限定 named P0 transaction / `CTR-SCA-017` 分支）、CTR-SCA-017/ACC-SCA-013/ALT-SCA-007 纯新增、§12/§13/§14 对应更新、删除 V1 §15 acceptance record（proposed 状态正确）；CTR-SCA-001..013/015/016 及 §9 其余正文逐字节未动 |
| M-4 | Acceptance transaction edges 原子完整 | PASS | §3：NEW accepted + supersedes=[V1]；OLD_V1 superseded + `superseded_by=AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V2`；README lifecycle mirror；缺 edge abort 语义继承 |
| M-5 | Contract coverage 完整 | PASS | 17/17（新增行 `CTR-SCA-017 → ACC-SCA-013`；CTR-SCA-014/015 行扩展引用 ACC-SCA-013） |
| M-6 | CTR-SCA-017 十门 ⊇ Goal §8 八项必需证明 | PASS | 见 §3 映射 |
| M-7 | Fail-closed 语义 | PASS | 首轮 canonical refresh `refresh_token_reused`/`invalid_grant`/`outcome_unknown` ⇒ `FAIL_CLOSED=YES / AUTO_RETRY=NO / LEGACY_FALLBACK=NO / OPERATOR_BLOCKED=YES`；不重试、不 reauth、不 recopy、不 fallback（Owner 对本 incident 禁 production OAuth 与 canonical reauth 的约束被忠实承载，且 OPERATOR_BLOCKED 终态不弱化通用 CTR-SCA-009） |
| M-8 | 一次性边界 | PASS | 异常仅限 named P0 recovery transaction；十门全过才允许 `CANONICAL_COMMIT_COUNT=1`；pre-commit 门失败 ⇒ commit=0；post-commit drift ⇒ 不激活 + bounded rollback 仅删未激活副本 |
| M-9 | Secret 边界 | PASS | 十门与 fixtures 全部禁止 token/hash/digest 记录；equality 仅判定不落值；本审计轮同样未持久化任何 credential digest |
| M-10 | Fresh-fact conformance（2026-09-03 只读复核） | PASS | canonical 域 ABSENT（OBS-SCA-008 仍真）；per-home OAuth = 91 与 overrides roster 双射（STATE-SCA-001 仍真）；`91/91 byte-equality` fresh 重证成立（STATE-SCA-005 前提新鲜）；十门中的 equality 门在真实事务内仍须重证——本复核不构成门证据 |

## 3. CTR-SCA-017 十门 vs Goal §8 必需项

| Goal §8 | CTR-SCA-017 |
|---|---|
| LEGACY_SNAPSHOT_COUNT = 91 | gate 3 PRODUCTION_INVENTORY_COUNT=91 |
| BYTE_IDENTICAL = 91/91 | gate 4 + gate 10 前后双 fence |
| ACCOUNT_SHAPE_CONSISTENT = YES | gate 5 |
| NO_CONTENT_DRIFT_DURING_WINDOW | gate 7（+ gate 10） |
| NO_INODE_OR_REPLACEMENT_DRIFT | gate 7（device/inode identity fence） |
| NO_KNOWN_PENDING_LUNA_EXECUTION | gate 1 LUNA_DISPATCH_QUIESCED |
| NO_KNOWN_OUTCOME_UNKNOWN_REFRESH | gate 8 KNOWN_REFRESH_EVENT_AFTER_FENCE=NONE |
| NO_COMPETING_REFRESH_WRITER | gate 2 REFRESH_WRITERS_QUIESCED |
| （Goal 之外加强） | gate 6 canonical intent absent、gate 9 liveness、gate 10 双 equality fence、COPY EXACT BYTES ONCE + commit count 1 |

结论：十门为 Goal §8 的严格超集，方向一致，无放松。

## 4. ACC-SCA-013 fixtures 覆盖判定

A（91 等值全过 → PASS 路径 + commit=1 + 零 provider call）、B（90/91 → FAIL + OPERATOR_BLOCKED，
禁止任何 tie-break）、C（fence 间 inode/content 注入漂移 → pre/post 两分支处置）、D（pending/outcome_unknown/post-fence 成功刷新证据 → 全禁）、E（promote 后 canonical-only + 91 child 身份 file-open 审计）、F（首轮刷新成功 → provenance 自新 generation 起、bootstrap 代保持 unproven）、G（首轮刷新 stale/unknown → fail-closed 终态）。与 CTR-SCA-017 门一一对应，fault 边界覆盖 CTR-SCA-015 三窗口。

## 5. Notes（全部非阻塞）

- N-1（操作提示）：gate 3 要求 authoritative Agent registry 展开恰为 91；生产 `homes/` 目录取整 96
  （含 `agt_cto-agent.pre-permrepair-20260822-061954` 备份与 4 个不在 overrides 的 hex 名 home）。
  未来事务必须以 registry（与 overrides roster 同源）为准，不得用目录列表充数。
- N-2（操作提示）：STATE-SCA-005 的 "Luna disabled after rollback" 是 2026-09-01 incident 时点输入；
  2026-09-03 生产为 Luna-only strict 全 fleet 基线（overrides v2 全 `primary=luna`）。gates 1-2 的
  quiesce fence 必须对 LIVE Luna-enabled 状态建立——这比 incident 时点更强，不是矛盾。
- N-3（机械）：本分支目前仅存本地，未 push；acceptance PR 前需 push。
- N-4（Goal 层记录，非本 Spec scope）：main `packages/agent-memory/src/memory.js`（`476d4a4f`）
  为 SIGTRAP 修复前代码，生产装机为修复版（`99d59bde…`）。后续任何 whole-app 部署事务必须执行
  MEMORY_FIX_PRESERVATION_GATE（不得从 main 覆盖该 surface）。
- N-5（操作提示）：`external_authorities` 保持 `c35d7a41`（与 V1 一致）；PR #127 携带的 dsh-codex
  modified 0.2.3-line companion（pin `75d98d5b…`, Yan-Zero/dsh-codex#15）在激活轮需要自己的
  source-stamp/artifact 证明入册（CTR-SCA-013 的 honest provenance 要求），本 Spec 无需改动。

## 6. Boundaries

DOCS ONLY（本文件唯一变更，explicit pathspec commit）。生产访问仅只读 fresh facts
（runtime/服务 liveness、overrides/metadata、91 文件 transient 等值判定）；零 OAuth 操作、
零 credential 内容读取落盘、零 config/进程/生产变更；V1 与其他 authority 文件未动。
dsh-codex/auth-service/svc-workflow 零触碰。

```text
AUDIT = PASS
NEXT_TASK = acceptance packet -> OWNER exact-head acceptance（单一 gate）
```
