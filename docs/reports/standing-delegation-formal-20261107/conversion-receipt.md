# 常设授权总裁定格式转换（proposed）

```text
GOAL_OR_TARGET = 八节Owner总裁定逐字正式化、接受事务、索引发现和控制绑定清单，push新分支与PR，不合并
CURRENT_GAP = 裁定尚无本仓正式Spec与受审接受事务；实际G01控制绑定尚未证明
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
PRIMARY_AUTHORITY = Owner mayf3 ruling owner-20261107-standing-delegation + accepted local governance
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_AUTHORITY = none
EVIDENCE_NEEDED = 八项逐字/hash/schema/覆盖/现有权威不变/独立exact HEAD/接受事务/final-HEAD/commit push PR原文rc
DONE_WHEN = 全部必需链rc0 + proposed/accepted commit + 独审原文 + push/OPEN未合PR + RECEIPT及控制清单
EXPANSION_TRIGGER = 权威冲突、语义差量、产品或生产写入、必需门失败
STOP_RULE = 失败即停，写STOPPED-DELEGATION-FORMAL.md；不重试失败的必需执行步骤
ACCEPTANCE_AUTHORITY = Owner mayf3原裁定本尊
ACCEPTANCE_EXECUTOR = /root，只转换和记录接受事务，不自授接受权
```

来源观察 `2026-11-07T15:03:30.507148+00:00`，canonical SHA256 `01cc059c2bf0e0493588f00032ca06eb73e3a0a13cb33f4078996fdccb79dad3`。
[provenance](source-provenance.json) 保存整条快照hash、逐项hash、来源selector、观察时点、
固定base和实际源码blob。源 `items[0..7]` 无任何字符编辑，包在正式Spec八块marker内；
新增十三节仅承载格式、来源、Contract/Acceptance映射与事实边界。

固定工作面 `24974c720d634b965943e08bfd0862657b9be0e1`；远端 main 已增加 #643 接受事务至 `9df5bd2fdea17f04bcd1762cd6800c350efcf9c3`。
该前移仅新增十三个docs文件，不修改本任务权威/索引；#643配套实施限制保持，不合入或
改写其语义。本任务保留用户指定base，不重启已通过工作。

[控制绑定清单](control-bindings.md) 区分现有源码、手工政策和未验证适配。
实际控制缺口不阻止本次docs-only记录已决定语义，仍阻止依赖该资格的签发/生产动作。
新增Owner重复审批次数=0。未查询生产、未创建主体、未任命、未签发、未加载。

必需执行原文由 `/private/tmp/delegation-formal-evidence/run.py` 逐项记录stdout/stderr/rc；
任一非零立即写STOP并禁止继续依赖执行。完整链保存在同目录 `chain.jsonl`，
提交前快照及最终链在根RECEIPT/PR持久回执绑定。只读发现中的无匹配/错误路径及无关目录
权限错误不作为验收成功证据，未触发任何产品或生产效果；必需接受/检查/提交/发布步骤不重试。

## 原接受事务先例

#648 [接受收据](../sra-v1-formalization-20261107/acceptance-transaction.md) 的
Owner authority / worker executor / reviewed proposed / final accepted Git对象模型沿用。
#643 对原文提案的有条件接受可在精确远端Git对象及Owner
[正式转录](https://github.com/mayf3/dsh-agent-core/pull/643#issuecomment-6707205612)核对。
不把这些先例授权套用为本轮接受权；本轮接受权直接来自独立的八节Owner裁定。
