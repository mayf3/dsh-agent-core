# 合同式交办：2.0.0-rc.3 消费者重新采用 + TE_V1 格式更正 + standalone V3（常设预授权 §2 全链，2026-11-07）

## 前置状态（全部就绪）
- 上游 2.0.0-rc.3 已合并（格式更正分类已扩展至 list[dict]，151/151 OK）
- TE_V1 当前非法形态 = supersedes: list[dict]（#635 写入）
- Owner 常设预授权 V1 §2：机械性格式更正+校验器适配+消费者采用一次完成全链授权

## 任务（一个 PR 三提交，基于最新 main 230de798）
1. **提交 A（rc.3 重新采用）**：vendor.py --apply（源 /tmp/adg-vendor-rc3 @ c1fad89，2.0.0-rc.3）→ verify_governance rc0
2. **提交 B（TE_V1 格式更正）**：TE_V1 对象/列表含对象式 supersedes → `supersedes: []`；校验 `python3 .agents/tools/validate_spec_transition.py --base <main JSON导出> --candidate <更正后JSON导出> --format-correction-spec CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1` rc0（全量元数据忠实 JSON 导出：git show base/candidate 前言解析为 JSON 数组，保真全部字段形状）
3. **提交 C（standalone V3 proposal）**：新建 .agents/local/CODE_STRUCTURE_GUARDRAILS_V3.md（proposed；supersedes 列表含 V2 与 TE_V1；正文=V2 全部有效规范逐字携带+例外条款+TE_V1 吸收条+继任关系节——R1/R2 草稿复用）+ validate rc0
4. push origin docs/v3-succession-final + gh PR（标题 V3 succession chain: rc.3 readopt + TE_V1 correction + standalone V3；**不合并**——独立审查后 Owner 正式接受 V3 触发 Phase 2 退役事务）

## 红线
TE_V1 语义/接受历史零变化（仅格式更正+更正注记）；零产品源码改动（.agents 治理工具/文档除外）；零生产写入；失败即停写 STOPPED-RC3-CHAIN.md


## Resumption PREFLIGHT (2026-11-07)

The repeated current Owner instruction resumes the stopped task. The prior
`STOPPED-RC3-CHAIN.md` is preserved as history, not a current success receipt.

```text
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/rc3-chain
BRANCH = docs/v3-succession-final
BASE_HEAD = 230de798e340cc6c157e6b21822f0b1fda77e51e
CURRENT_BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
SOURCE_HEAD = c1fad8976e50e96adb27a4c7e2dd4f97bf2e899e
GOAL_OR_TARGET = one unmerged PR with A/B/C, actual validation evidence
CURRENT_GAP = rc.2 lock and malformed TE metadata; standalone V3 absent
AUTHORITY_ACTION_A_B = REUSE (explicit mechanical adoption/correction mandate)
AUTHORITY_ACTION_C = SUPERSEDE
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = YES (V2/TE and adoption governance; V3 is proposed)
PRIMARY_AUTHORITY = accepted local README, V2, TE_V1, adoption V3 at BASE_HEAD
IMPLEMENTATION_AUTHORITY = not_applicable (no product implementation)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (no product code in this task)
PLAN_LEVEL = EXEC_PLAN (the existing three sequential commits and later Phase 2)
ASSURANCE_LEVEL = DURABLE
MUTATION_AUTHORIZATION = VALID (current explicit Owner task, bounded docs/tools)
ISOLATED_WRITE_SURFACE = YES (this worktree and branch; main is untouched)
CONTROLLED_RUNBOOK_REQUIRED = NO (no operation or production write)
BASE_IMPACT = BOUNDED (new remote commits do not change relevant authorities)
MERGE_READY = NO (Owner acceptance and review reserved; do not merge)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = source/manifest binding, A integrity, B faithful metadata gate,
                  C faithful predecessor/successor gate, exact-Head review
DONE_WHEN = A/B/C rc0, branch pushed, unmerged PR opened with evidence
EXPANSION_TRIGGER = failed required gate, authority conflict, changed source or
                    affected authority; stop writes and record exact failure
```

Fresh `git ls-remote` succeeded: remote main is CURRENT_BASE_HEAD and the target
branch was absent. Preserve the explicitly requested BASE_HEAD; the intervening
changes are availability-recovery source/tests/runbook work, with zero delta in
AGENTS.md, .agents/, docs/specs/, docs/decisions/, or Product Architecture.

Execution order: A vendor and integrity gate, then commit A; B only TE supersedes
format and appended historical correction note, faithful full-field export and
gate, then commit B; C proposed whole-authority successor and gate, then commit C;
independent affected-surface review, push and PR. Phase 2 acceptance/backlinks/
retirement and implementation remain outside this task.

Convergence dispositions: RETAIN accepted V2 and TE during proposal preparation;
MIGRATE their complete current meaning into the proposed standalone V3; RETIRE
only in a later Owner-accepted atomic Phase 2. No temporary executable bridge.

C has a concrete preflight input limitation, independently confirmed read-only:
V2 has no YAML frontmatter and declares itself a repository-local binding rule;
the rc.3 JSON validator requires referenced predecessors in both arrays as
`governing_spec`. No such V2 record will be fabricated. C-dependent work remains
paused pending an actual authorized faithful representation or a clarified gate.
A/B do not depend on this limitation and continue under their explicit mandate.
The standing-preauthorization original was not located; this record relies on
the current attributable task, not a claim to have verified that original.


## A/B executed observations

- A: `b8333ef4` from the exact requested parent; vendor apply rc0, then
  `python3 .agents/tools/verify_governance.py --target .` rc0.
  Source head, manifest, lock hash and adoption status are persisted in
  `docs/reports/rc3-chain-20261107/A-receipt.json` and its raw verifier output.
- B: faithful full-field TE frontmatter exported from `git show` at main base
  `230de798e340cc6c157e6b21822f0b1fda77e51e` and staged candidate tree
  `0570bc32de2e5b6d22fdf48d0e727369eec3933f`. No field was pruned or shape-normalized.
  Only the TE record is affected and present in those arrays; this is not a C
  predecessor-graph check. The exact required rc.3 transition command returned
  rc0 and emitted `FORMAT_CORRECTION`. Both arrays, document/blob/JSON hashes,
  preservation assertions and command/result are in `B-*` evidence files.
- B preserves every other metadata field and every byte of the pre-existing
  document body. It replaces the supersedes span and appends the correction note.
  No standalone V3 acceptance, retirement, product-source change or production
  effect is claimed. C's independently confirmed raw-input limitation remains.
