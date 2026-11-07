# BRIEF-PLANNED-PROPOSAL — planned 恢复合同提案起草（Owner 裁定④立项, docs-only）

授权: Owner 五件裁定④(rulings[id=owner-20261107-five-decisions])——planned恢复合同立项, docs-first起草走审查(接受仍需Owner)。
工作面: 本worktree(docs-only)。零产品源码, 零生产写入, proposed/零实施权, **不接受**。
停止条件: 失败即停写STOPPED-PLANNED-PROPOSAL.md。

## 背景
- #1377拆分后planned半被 CTR-EKRWAE-004 排除(ordinary planned正向续接无合法自动恢复路径)。
- 需求: blocked/planned 中 **ordinary planned** 状态的合法正向续接(区别于#644已交付的blocked自动恢复)。

## 提案要求(参照#643六约束模式)
1. **语义定义**: ordinary planned 的合法自动恢复触发/条件/边界(与CTR-EKRWAE-004排除项的精确关系——本提案即对该排除的有界解除, 或新增独立路径, 给论证)。
2. **六约束照抄模式**: 触发定义/actor边界(不冒充assignee)/UNKNOWN保全+零重放/交接义务/DTO封闭与向后兼容/与#1379解耦。
3. 前置核验: PR#650分析与#1377 STOPPED中planned相关结论复用; 不得与#644已交付blocked面冲突。
4. 格式: SPEC_FORMAT_V0, SUPERSEDE或AMEND路线论证(参照#653/#655判定模式), proposed/零实施权。

## 交付
docs/specs/ 提案文档(proposed)+RECEIPT-PLANNED-PROPOSAL.md(条款对照+DONE_WHEN+开放问题含Svc配对面如涉)。commit新分支docs/planned-recovery-proposal→push→PR(base main)不合并。
