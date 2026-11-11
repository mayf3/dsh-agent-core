# BRIEF-642-PHASE2 — V3 继任 Phase 2 退役事务（Owner 已接受, docs-first 全链）

授权: Owner 2026-11-07 处置第2条(rulings[id=owner-20261107-642-643-1377]; PR#642 comment-6701500077 誊录件)。
工作面: 本 worktree, 分支 docs/v3-succession-final(PR#642)。docs+治理工具面 only, 零产品源码。
停止条件: 失败即停追加 STOPPED-RC3-CHAIN.md; 权威冲突即停。

## Owner 接受坐标(已锁定)
- 接受对象: 精确已审语义 7f36750bf08d308cd7f648153e24c0b0e528e4c6。
- 接受范围: V2 完整继承/TE_V1 精确例外吸收/整权继任; 500上限/固定基线/registry/反规避/fail-closed/一次性blob约束全保持。
- Phase 2 六条件(全部满足后才可合并, 合并由监管执行, 你不合并):
  1. V3 accepted 化(状态变更+接受记录: 精确 head+Owner 裁定坐标=PR#642 comment-6701500077+registry rulings id)
  2. V2 与 TE_V1 原子 superseded, **双向回链**(V2/TE 获 SUPERSEDED_BY→V3; V3 携带对前任的 reciproc al backlinks; 三文件原子提交, 不得拆分泄漏中间态)
  3. 更新实际权威索引(local README/Current Decision index 等, 以仓库实际索引结构为准)
  4. **本次治理分发采用状态合法闭合**: governance.lock.json 的 adoption.status=proposed 不得冒充有效——按合法接受流程落 accepted 化记录(精确 lock SHA+来源 commit b8333ef4+本裁定坐标); 校验器版本与分发 manifest 一致性复核
  5. 完整生命周期校验(既有 validate/verify 工具 rc0 原文: verify_governance/validate_spec_transition/结构门/C gate 如适用)
  6. 最终 HEAD **独立复核**(由监管另派独立审查, 你交付后如实收尾)
- 之后: 监管按现有合并授权合 main → 独立任务 verifier 适配 → #603 重验。

## 红线
零产品源码; 不动 .agents/tools 语义(版本一致性复核只读); 不 rebase 既有 5 提交; C gate 如因文档变更失效须重跑并归档新证据; 负向控制不放宽; PR 推进不合并; 零生产写入。

## 完成定义
Phase2 提交 SHA + 全部工具 rc0 原文 + 双向回链坐标清单(前后 blob/行号) + 索引更新坐标 + adoption闭合记录坐标 + RECEIPT-642-PHASE2.md; push 更新 PR#642。

## Execution coordinates and gate applicability

SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = SUPERSEDE (Owner-accepted structural successor); REUSE (explicit distribution update)
ROUTE_STAGE = AUTHORITY_AUTHORING
PLAN_LEVEL = EXEC_PLAN (tool preparation, atomic lifecycle, evidence, push)
ASSURANCE_LEVEL = DURABLE
REVIEWED_SEMANTIC_HEAD = 7f36750bf08d308cd7f648153e24c0b0e528e4c6
BASE_HEAD = 230de798e340cc6c157e6b21822f0b1fda77e51e
CURRENT_BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
FINAL_INDEPENDENT_REVIEW = PENDING_REGULATOR
MERGE_AUTHORITY = NONE_FOR_THIS_WORKER
PRODUCT_IMPLEMENTATION = FORBIDDEN
PRODUCTION_WRITES = FORBIDDEN

Live GitHub read confirms PR #642 OPEN/unmerged at the reviewed semantic head,
and comment 6701500077 is the Owner-attributed regulatory transcription of the
2026-11-07 ruling. Its 03:13:36Z timestamp is the transcription time, not a
claimed original signature time. Registry ruling ID is supplied by this mandate;
the external registry itself is not independently read in this worktree.

The existing structure CLI requires V2 ACCEPTED at candidate head and an
accepted TE document byte-identical across comparison endpoints. It cannot
validate the actual retirement state; Owner explicitly reserves verifier
adaptation for a separate post-main task. Under “结构门…如适用”, run that CLI
on the new governance-tool increment before retirement, then bind it to the
final lifecycle tree through a measured zero source delta. Do not run or claim
a final-head old-CLI PASS. Keep the original C gate and all its controls
unchanged; rerun it against the exact reviewed proposal. A separate native
Phase2 gate validates the real retired native V2 and raw TE/V3 metadata, full
carry, acceptance, backlinks, lock, indices and preservation.

The governing-Spec-only transition CLI is applicable to the complete five-record
adoption graph. It cannot represent native V2 as governing_spec; the structural
transaction is therefore checked by the native gate, never by fabricated YAML
or a falsely labeled governing-only CLI result.

AD3 CTR-AD3-001 explicitly permits later explicit updates. Preserve its original
rc.1 pin and all Contracts; append a coordinate-bound rc.3 update acceptance
record, retaining the preparation record at b8333ef4. Lock schema permits only
status/accepted_by/accepted_at acceptance edits; detailed provenance belongs in
the adoption Spec and receipt. Main activation and final independent review
remain pending after this worker's delivery.
