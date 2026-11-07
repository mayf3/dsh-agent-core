# PR #643 Owner 授权接受事务

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 7b5d79c3961625aaade6f3b383b18b2968e82f6c
BASE_HEAD = 3c1bcf98bc40a2c34cca24f241c87d1b12cea216
CURRENT_BASE_HEAD = 24974c720d634b965943e08bfd0862657b9be0e1
GOAL_OR_TARGET = 记录 Owner 已授权的 #643 提案语义限定接受并 push，停等监管合并
CURRENT_GAP = 提案 frontmatter 仍为 proposed，缺少此次 Owner 接受绑定
AUTHORITY_ACTION = AMEND (named proposal lifecycle only; no semantic delta)
PRIMARY_AUTHORITY = Owner ruling owner-20261107-five-decisions items[2] + accepted repository governance
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (this proposal)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED (cross-repository proposal; docs-first only)
DOCS_FIRST_REQUIRED = YES
MUTATION_AUTHORIZATION = VALID (BRIEF-643-ACCEPT.md; Owner ruling and PR transcript)
ISOLATED_WRITE_SURFACE = YES (/private/tmp/h643-accept; detached at reviewed PR head)
CONTROLLED_RUNBOOK_REQUIRED = NO (acceptance metadata only; no implementation/production operation)
ACCEPTANCE_ACTOR = mayf3
ACCEPTANCE_EXECUTOR = /root (transaction executor only)
ACCEPTED_AT = 2026-11-07T12:58:48.337170Z
STATUS_TRANSITION = proposed -> accepted
ACCEPTANCE_SCOPE = 仅限提案语义
ACCEPTANCE_RESTRICTION = WEC/Svc配套权威正式接受前不得实施新reason或用于生产
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
IMPLEMENTATION_ALLOWED = NO
OPERATION_ALLOWED = NO
AUTHORITY_ACTIVE_ON_MAIN = NO_PENDING_REGULATOR_REVIEW_AND_MERGE
MERGE_READY = NO_PENDING_REGULATOR_FINAL_HEAD_REVIEW
MERGE_EXECUTOR = regulator; worker must not merge
EVIDENCE_NEEDED = exact ruling/transcript/source binding; independent lifecycle delta/final-HEAD review; focused docs checks; push receipt
DONE_WHEN = acceptance commit SHA + verbatim frontmatter + push receipt, then STOP
EXPANSION_TRIGGER = authority conflict / body semantic change / non-doc change / required check or review failure
FAILURE_ACTION = stop immediately and write STOPPED-643-ACCEPT.md
NEXT_REAL_ACTION = independent lifecycle delta review, commit, independent final-HEAD recheck, push, STOP for regulator
```

接受授权来自 [原始 Brief](../../../BRIEF-643-ACCEPT.md)、Owner 原件 `/Users/yanfenma/Documents/Codex/2026-10-18/zcode-assist/tools/b7ctl/DISPATCH-REGISTRY.json` 的
`$.rulings[id=owner-20261107-five-decisions] / items[2]`，以及 mayf3 在
[PR #643 评论 6707205612](https://github.com/mayf3/dsh-agent-core/pull/643#issuecomment-6707205612) 的正式接受转录。
Owner 是接受权威，worker 只记录事务。原件只选取此次 ruling，见 [快照](owner-ruling.json)；
canonical 算法及 whole-ruling/item SHA256、观察坐标见 [provenance](acceptance-provenance.json)。
整个 ruling canonical SHA256=`95290062529cf24c31d3c7f6c748a22e5e369d14458cf623f562eee5c90cedc8`；items[2] canonical SHA256=`ffeea11b8bd8b57815eb8fc8c9d0ec32e3528386b04d506d71fd8313e067bba1`。
本次逐字限定为：**WEC/Svc配套权威正式接受前不得实施新reason或用于生产**。

## 接受差量与保全

正式 Spec 仅 `status` 转 accepted，新增 Owner、时间、reviewed HEAD、原件 selector/hash、PR 转录评论和限定接受绑定，
并新增有 marker 的生命周期说明。去除这两部分后，原 frontmatter 与整个正文均可逐字重建为原 PR HEAD；
六份原 PR 文件中的其余五份保持原字节，accepted 父权威和产品源码不变。原文内的 proposed/接受前状态属于原起草时点；
当前事务只接受提案语义，WEC/Svc 配套权威仍须另行合法接受，不推定已关闭 §3.1 的封闭枚举 lifecycle 或配对接受门。
旧 implementation 停点 `STOPPED-1376-BUDGET.md` 与冻结 DW-1..5 不改。

原语义评审继续复用 [RECEIPT-1376-AMEND.md](../../../RECEIPT-1376-AMEND.md)：
reviewed semantic HEAD=`d8fc43ad0fb6cb462bab847416f0371ca92a9b58`，最终 delivery HEAD=`7b5d79c3961625aaade6f3b383b18b2968e82f6c`，
原提案 SHA256=`3ac3478f4e9f71c0fd27276ffd568b3d5f44c135c47d4113f1f64be989d243ad`。此次仅审接受生命周期差量，不重复已通过的原六条款语义审查。

fresh main=`24974c720d634b965943e08bfd0862657b9be0e1` 比原 authoring base 前进；直接相关 Architecture、D-009、Liveness、WEC、WAE 内容未变。
已读取当前 main 的 governance lock/local README 变动：rc.3/adoption 与结构 V3 接受不改变本事务限定接受规则。
不重放历史 corpus 检查，不调用尚待单独适配的旧结构 runner；本次无产品源码或结构差量。
候选自身 vendored integrity 只证明该 HEAD 锁定字节一致，不将旧 proposed lock 冒称 main 当前治理状态。

## 证据与停止边界

实际聚焦检查见 [checks.json](checks.json)；非作者生命周期差量审查原文见 [independent-review.md](independent-review.md)。
产品测试、跨服务执行、安装、生产验证和业务验收均 NOT_RUN，不声称相关 PASS。
`FINAL_ACCEPTED_HEAD` 由包含此事务的 Git commit 对象绑定，不预填自引用 SHA。
commit 后独立最终 HEAD 复核以及实际 push/readback 写入本 worktree 的 `RECEIPT-643-ACCEPT.md`，
其 push 成功不预填进本接受提交；远端 PR HEAD 应等于该 acceptance commit。
worker 在用户要求的 docs-only push 和回执后停止，监管独立决定合并；不启用自动合并、不更新产品协议、不做生产写入。
