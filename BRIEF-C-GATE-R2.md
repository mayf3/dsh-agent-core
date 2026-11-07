# BRIEF-C-GATE-R2 — C gate 修复续做（监管续派）

授权: Owner 委托试点(#642 C gate 修复不等 Owner)+常设预授权 V1 §4(失败自动继续)。
执行身份: 本 worktree worker。停止条件: 失败即停, 在 STOPPED-RC3-CHAIN.md 追加节。

## 背景(上一轮停点, 已监管核实)
- 分支 docs/v3-succession-final: b8333ef4(rc.3 readopt)→21ac77ea(TE_V1 correction)→74523bc9(V3 proposal)=PR #642 head。
- C gate 首次执行 rc2 已停。根因=新增脚本 scripts/governance/validate_v3_succession.py 的 Phase 2 样本把反链插到元数据围栏外（样本构造缺陷, 非 V3 文档缺陷）。
- 失败输出: docs/reports/rc3-chain-20261107/C-native-result.json; 停止记录: STOPPED-RC3-CHAIN.md。
- 当前 staged: BRIEF-C-GATE.md + scripts/governance/validate_v3_succession.py(361 行, 未提交)。

## 任务项
1. 读 STOPPED-RC3-CHAIN.md 与 BRIEF-C-GATE.md, 复核根因定位后再动手。
2. 修复 scripts/governance/validate_v3_succession.py 的 Phase 2 样本构造: 模拟接受后的反链必须写入目标记录元数据围栏(frontmatter `---` 块内)的合法字段位置。禁止放宽任何校验断言来迁就样本; 禁止改 A/B/C 已有文档语义。
3. 静态遗留点核验: V2 基记录若由 V3 载荷 carried(V2_POLICY) 派生, 报告中必须标注 derived-from-carried-policy, 不得伪造成原生 YAML frontmatter 记录。
4. 重跑完整 C gate: 要求 rc=0, 全部负向控制(含 exception_scope / strict_legacy) PASS; 原文输出写 docs/reports/rc3-chain-20261107/。
5. rc0 后提交修复(脚本+新报告; 停止记录保持 untracked 或一并说明), push 更新 PR #642。**不合并**; 独立审查由监管另行安排。

## 红线
失败即停追加 STOPPED-RC3-CHAIN.md; 不动 packages/产品源码; 不 rebase/reset 既有 A/B 提交; 零生产写入; 不伪造哈希/证据; PR #642 只推进不合并。

## 完成定义(验收采信原文)
C gate rc0 原文输出 + 负控 PASS 原文 + 提交 SHA + push 回执(gh pr view 642 headRefOid)。

## R2 resumed PREFLIGHT

The current explicit task resumes the recorded rc2 stop. Prior failed outputs
remain historical evidence. This record relies on the current attributable task;
it does not claim to have independently located the standing-preauthorization
original. The proposed adoption lock grants no additional permission.

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/rc3-chain
BRANCH = docs/v3-succession-final
REVIEW_TARGET_HEAD = 74523bc95e62d6b476af3cff007d88483927ed41
BASE_HEAD = 230de798e340cc6c157e6b21822f0b1fda77e51e
CURRENT_BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
GOAL_OR_TARGET = repair the C fixture and publish actual complete gate evidence
CURRENT_GAP = native V2 backlink inserted outside its metadata in two fixtures
AUTHORITY_ACTION = AMEND (bounded evidence repair to the existing proposal)
PRIMARY_AUTHORITY = accepted local governance and V2/TE at BASE_HEAD
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = YES (predecessors; V3 remains proposed)
IMPLEMENTATION_AUTHORITY = not_applicable (governance evidence only)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
MUTATION_AUTHORIZATION = VALID (current explicit R2 task)
ISOLATED_WRITE_SURFACE = YES
SPEC_GAP_DEPENDENCY = NONE
BASE_IMPACT = NONE (fresh remote coordinates match the prior checkpoint)
IMPLEMENTATION_ALLOWED = NO (no product implementation)
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = full C rc0, all negative controls, source binding, push readback
DONE_WHEN = passing source and raw results committed and pushed to open PR #642
EXPANSION_TRIGGER = failed required gate, authority conflict, unexpected writer/ref
NEXT_ACTION = CONTINUE
```

Source reads confirm V2 uses native `text` fenced metadata, while TE/V3 use real
YAML frontmatter. R2 fixes both V2 fixture insertions at the native closing fence;
it does not convert V2 to YAML or weaken any assertion. V2's base metadata is
read directly from BASE_HEAD, never derived from V3's carried policy. The report
separately labels that carried policy `derived-from-carried-policy` and excludes
it as a base-metadata source. All A/B/C normative bytes remain unchanged.

Publication sequence: stage the corrected source and briefs, run C against that
immutable tree, and only on rc0 commit that exact source tree. Then commit raw
outputs and the factual evidence handoff, preserving a reachable source commit
for reproduction. Independent review is reserved for the regulator after push;
no local support check is claimed as that review or as merge readiness.
