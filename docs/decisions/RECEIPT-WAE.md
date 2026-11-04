# RECEIPT-WAE — #1374 B1/B2/B4 docs-first authority candidate

本回执是交付 Evidence，不是 Product Authority、Owner acceptance、实现授权或业务验收。

## 交付坐标

| 项 | 实测值 / 边界 |
|---|---|
| Repository / worktree | `mayf3/dsh-agent-core` / `/private/tmp/dsh-ekr-wae` |
| Branch / target | `ac-ekr-wae-docs` → `main` |
| Authoring / review base | `9f04db29cce44a684b4409fa63b436aaf10dfa52` |
| Reviewed semantic head | `aeb645868ce3f98ff54f2b631f34c069d38fb04a` |
| PR | https://github.com/mayf3/dsh-agent-core/pull/623 |
| Task / Owner ruling | [mayf3/agent-control#1374](https://github.com/mayf3/agent-control/issues/1374)，mayf3 2026-11-04 下达；本次合同要求 docs-only、条款 SUPERSEDE、不 merge |
| Spec path / stable ID | [AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1](../specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md) / `docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md` |
| Spec SHA-256 | `c65d901a0e8fb4b5b633ae97e48c93f93fdac1ddb02e38a44e9baeac93c5f51f` |
| Spec metadata | `status: proposed` / `implementation_authority: none` / `production_apply_authority: none` |
| Route | AUTHOR / SUPERSEDE（明确交办的条款范围例外）/ BRIEF / CONTROLLED / AUTHORITY_AUTHORING |
| Contracts / acceptance definitions | `CTR-EKRWAE-001..007` / `ACC-EKRWAE-001..008`，7/7 Contracts 有覆盖；定义不冒充执行结果 |
| Original untracked input | `BRIEF-WAE.md` 保留原样、不纳入提交；SHA-256 `0671a618edd6ab7ff2cbe63e0756aaa7be0da73f9dce0ef930c7d4b4af4e71cb` |
| Acceptance placeholder | Spec §3；Owner 裁定依据溯及 #1374，精确 reviewed/accepted/merge 绑定由监管验收后的接受事务完成 |

交付提交在语义提交之后仅增加本回执；最终交付 SHA 与独立 final-head delta recheck 结果
绑定于此 PR 的最终描述。这样不在回执内伪造包含自身内容的预知提交哈希。Spec 的接受记录
继续占位；本回执中的真实评审坐标不把 proposed 改为 accepted。

## 实际文档差量

B1：UNKNOWN 结果保留、持久 next-check 与有界只读再读，重启自动再发现；历史 terminal
只开放责任/观察/可信关闭事实追加，不重开 admission。B2：既有 Scheduler 纳入安全 blocked
attempt，同一正式 recoverAttempt gate；PROVEN_ZERO、停止/副作用证据与原 identity/generation
不变，只允许从未投递的首次 admission；人工显式 authorityRef 升级路径保留。B4：补采/重验
有来源，晚样本不冒充原 baseline；version-only 只触发重检，未完业务持续在处理集合。

三条均不重放业务操作。D-009/alignment 的三态与无证据零 authoritative reconciliation 写入
保留；next-check 责任元数据不授权 business/termination settlement、Router/Scheduler
occurrence/fence/nextRun 修补。#610/#611 是 alignment 的接受来源；#616 属 #442 接受载体，
不把其 merge 误用为 D009_ALIGNMENT 的来源。

## 冲突对照表（Spec §8 原样摘录）

WAE/SRE 坐标均绑定上述 base；`CTR-001` 等短写指本候选 `CTR-EKRWAE-001` 等完整 ID。
R-B1/R-B2/R-B4 对应 #1374 正文 §3 的原文，候选 §8 已逐字引用。

| 旧条款 / base 坐标与冲突 | 新语义及保留关系 | Owner 原文锚点 / 新 Contract |
|---|---|---|
| WAE CTR-WAE-006:323–349：terminal/lost + probe unavailable → terminal NEEDS_REVIEW；只允许 terminal-verdict 写入；blocked 仅 skip、never recovery | 临时不可用保留 UNKNOWN 与持久只读下一检查责任；reconciler 可处理责任元数据，B2 由既有 Scheduler 调用同一正式安全 gate；不把 blocked 当 delivery_unverified | R-B1/B2；CTR-EKRWAE-002..005 |
| WAE CTR-WAE-005:301–321、CTR-WAE-012:484–487、SRE §1:98–99：terminal-refusing、三态/历史保全 | 仅为 B1/B4 的责任登记、只读观察和可信关闭事实开放追加；保留旧 verdict/event 字节与未知副作用，不 un-terminal 为可执行 attempt；其他 terminal append refusal 保留 | R-B1/B4；CTR-001/003/006 |
| WAE CTR-WAE-007:351–361：unavailable ⇒ NEEDS_REVIEW | unavailable 不能视作业务事实；临时读失败不等于人工裁决需求，必须有下次只读检查；目标 Agent 身份、visibility invariant、no wake 原义保留 | R-B1；CTR-001/002 |
| WAE CTR-WAE-011:420–482：blocked eligible，never automatically recoverable | 仅 PROVEN_ZERO 的原 blocked attempt 可经可信 Scheduler trigger 重入同一恢复 gate；原身份、停止证明、副作用状态保全；历史 planned-only 仍不适用 | R-B2；CTR-004/005 |
| WAE CTR-WAE-013:547–604：禁止 poll/reconcile/timer 调用；authorityRef E1；E2–E6 与 WAL/crash gate | 新增可信自动调用授权分支，保留显式 authorityRef 人工升级路径；共享 E2–E6 的安全条件、既有锁和 WAL；无任一合法授权 E1 仍零写拒绝 | R-B2；CTR-001/004/005 |
| WAE:75–90、CTR-WAE-003:250–256、CTR-WAE-009:374–387：只准 explicit controlled recovery、no automatic retry ever | 只让位于本文同 attempt、投递前、有限频率的自动 resolution 恢复；不增加新 scheduler/retry engine，不自动修身份或恢复 delivery-domain attempt | R-B2；CTR-004/005 |
| WAE CTR-WAE-012:507–528：recovery_authorized 只携每次显式 authorityRef；NEEDS_REVIEW 是唯一 human escalation terminal | 自动路径须记录可信规则引用、触发来源、精确 attempt/generation 与 gate 证据；人工路径保留显式 authorityRef。NEEDS_REVIEW 标签本身不证明人工责任已送达 | R-B1/B2；CTR-003/005/007 |
| WAE:679–737 的 entry/authorization/surface oracle、756–757 inert-without-authorityRef | 无授权仍零写；允许经过正式可信自动授权且安全 gate 全通过的 Scheduler 调用；禁止模型调用与一切不安全 retry 的负例继续有效；新增 §10 反例 | R-B2；CTR-004/005 |
| WAE:647–677 的历史 Subjects A/B dogfood、deployment/recovery 顺序 | RETAIN 历史特定受控操作要求；本文不替代该操作 mandate、不启动两实例、不追认历史部署或身份修复 | R-B2 的安全边界；CTR-001/004 |
| SRE CTR-SRE-002:139–190：缺 baseline 则 NEVER stale-eligible；相等版本才可 stale | 保留无可靠原 baseline/版本不等不得 stale redispatch；必须补采/重验、持久再查或可靠升级，禁止“没有基线所以永久不处理”；晚采样不能冒充 dispatch-time baseline | R-B4；CTR-006/007 |
| SRE CTR-SRE-005:283–306、CASE3/4:322–323：assistance/version change defeats staleness | version-only（含增长、下降、assistance-only）只触发重检，不单独证明业务完成或责任关闭；原 stale 谓词不满足时仍保留只读处理责任；真实业务事实照常结算 | R-B4；CTR-001/006 |
| WEC V3 CTR-WEC1-002/004/008:101–151,204–233；SRE CTR-SRE-003/004 | PRESERVE：OUTCOME_UNKNOWN 不变可执行；Owner-resume 要正面 settled proof 和原 pre-plan baseline；本文不扩大 stale/Owner-resume admission 或将 late baseline 替换 preDeliveryWorkflowStateVersion | R-B1/B2/B4 不重放；CTR-001/004/006 |
| D-009 §8.4/8.5；D009_ALIGNMENT CTR-527D2-002/003 | PRESERVE：可信业务结果、可信 exact termination-only、无可信证据三分；无证据零 authoritative reconciliation 写入，UNKNOWN/fence/history 不改；责任元数据不是 settlement 权限 | 全部三条安全边界；CTR-001/003 |

## 独立语义评审（已执行）

```yaml
schema_version: 2
SPEC_GOVERNANCE_MODE: REVIEW
REVIEW_KIND: SPEC
SPEC_REVIEW: ACCEPT
REVIEW_TARGET_HEAD: aeb645868ce3f98ff54f2b631f34c069d38fb04a
BASE_HEAD: 9f04db29cce44a684b4409fa63b436aaf10dfa52
CURRENT_BASE_HEAD: 9f04db29cce44a684b4409fa63b436aaf10dfa52
REVIEWER_ID: /root/authority_audit
AUTHOR_ID: /root
AUTHOR_INDEPENDENCE: PASS
ASSURANCE_LEVEL: CONTROLLED
AUTHORITY_REVIEW: PASS
PRIMITIVE_BOUNDARY_REVIEW: PASS
CONTRACT_REVIEW: PASS
ACCEPTANCE_COVERAGE_REVIEW: PASS
MANDATE_SCOPE_REVIEW: PASS
EVIDENCE_REVIEWABILITY: PASS
BASE_IMPACT: NONE
REVIEW_SCOPE: FULL
FULL_REVIEW_BASIS: INITIAL_REVIEW
FROZEN_BLOCKER_UNION: []
BLOCKERS: 0
SPEC_GAPS: 0
FOLLOW_UPS: 0
TOOLING_DEBT: 0
IMPLEMENTATION_ALLOWED: NO
MERGE_READY: NO
OPERATION_ALLOWED: NO
NEXT_ACTION: CONTINUE
```

Reviewer 未参与语义起草、未修改文件，独立核对 Owner 原文、所有受影响依赖、UNKNOWN 零写、
B2 首次 admission/停止证明、B4 基线与进展及每条验收覆盖。此 ACCEPT 是评审建议；
允许继续回执/push/open PR 交付，不能代行 Owner acceptance 或 merge。

## 验证与保全（已执行）

| Check | Executed result |
|---|---|
| `python3 .agents/tools/verify_governance.py --target . --require-accepted` | rc=0；vendored bytes 匹配 lock，adoption accepted |
| Python yaml + jsonschema 验证 `.agents/schemas/spec-frontmatter.schema.json` | rc=0；proposed/none、无 whole-Spec supersedes、7 CTR/8 ACC、引用存在、输入字节保全断言通过 |
| 独立 schema / metadata / reference / 新稳定 ID 唯一性复核 | PASS；Reviewer 对 exact semantic head 执行，不只复述作者结论 |
| `git diff --cached --check` / exact semantic diff | rc=0；仅新增 355 行 Spec；零源码、原权威不改 |
| `node scripts/verify-code-structure.mjs --base 9f04db29cce44a684b4409fa63b436aaf10dfa52 --head aeb645868ce3f98ff54f2b631f34c069d38fb04a --json` | rc=0；`CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`；candidate violations=0，baseline debt=28；不是全仓零债务 |
| `git ls-remote origin refs/heads/main` at semantic review | `9f04db29cce44a684b4409fa63b436aaf10dfa52`，base 未移动 |
| `git push -u origin ac-ekr-wae-docs` | rc=0；已推送 semantic head |
| `gh pr create --repo mayf3/dsh-agent-core --base main --head ac-ekr-wae-docs ...` | rc=0；实际创建 PR #623；最终 receipt commit 另 push 并读回 |

查 CI 配置目录时 `.github/workflows` 不存在（只读 `rg` 发现 rc=2）；这是目录探测结果，
不是本任务 required gate 失败，不从缺目录推断 CI PASS。结构检查的已有 baseline debt 也不
变成本 docs-only 候选的失败。未发生文档语义/授权/必需验证失败；无 STOPPED-WAE.md。

以下原始输入逐一与 `git show <base>:<path>` 作字节比较，保持不变；哈希为本轮实测：

| Input | SHA-256 |
|---|---|
| `docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md` | `c5d39e390026807b9e471a6875f5e0e9d15432f21a3d177733bf422fc751a1e6` |
| `docs/specs/AGENT_CORE_WORKFLOW_STALE_REENTRY_V2.md` | `509836b6c6105c7b553e5e28c297c9762ca24b8c6e2aa0f05029ba0efc88728d` |
| `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md` | `03469e9f53ccf53f23de3a552270a4bb82f1922b6979108fe01083488c3335d4` |
| `docs/specs/AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1.md` | `d8b07bc5ed280dae767015dbb437e1d52e596d3e84148f448593290beb3ba0ca` |
| `docs/evidence/ekr-preflight/DEFECT-MATRIX.md` | `d93f59d3fa9abce433d92c16230fd012a944df00644c453b8574df8567807b7b` |

## UNKNOWN / 未执行

- Owner/授权 maintainer 的候选接受及最终 accepted head：UNKNOWN，待监管验收后接受事务绑定。
- 实现修复、真实 Scheduler→恢复入口、持久数据库/真实进程故障回归、跨服务 E2E：NOT_RUN；
  不能从文档评审、预检内存桩结果或 helper 存在推断为 PASS。
- 已安装版本、运行时已装载/启用、当前生产 blocked/UNKNOWN 存量与业务结果：UNKNOWN；
  本任务未读取生产 ledger、未改生产、未恢复或重放任何业务操作。
- #1374 整体目标、实际无人值守恢复、生产业务验收：UNKNOWN；只完成其 B1/B2/B4 权威候选交付。
- CI 状态必须以 PR 实际读回为准；无执行状态不能标 CI PASS。

本次两份 tracked 文档均在 docs/ 下；原未跟踪 BRIEF 保留。后续顺序为监管验收 →
获授权者补绑接受与 merge → 包含 accepted successor 的 base 上另行实现；本任务不 merge、
不启用 auto-merge、不修改其他 worktree。终态回读与最终交付头独审结果见 PR。
