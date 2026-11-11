# BRIEF-REFUSAL-PROPOSAL — refused-terminal 系统级交接语义提案起草（Owner 裁定②边界确认后第二提案, docs-only）

授权: Owner 五件裁定②(rulings[id=owner-20261107-five-decisions]边界确认采纳PR#653评估: 两独立提案共用机制)+预授权V2 §5。
工作面: 本worktree(docs-only)。零产品源码, 零生产写入, proposed/零实施权, **不接受**。与PR#643(aging)共用系统Assistance机制设计但为**独立提案独立缺口**。
停止条件: 失败即停写STOPPED-REFUSAL-PROPOSAL.md。

## 背景
- STOPPED-1377-MINIMPL: refused记录(B2 terminal recovery_refused, 触发=world-drift拒绝/visit迁移/assignee不符/实例终态)在既有Assistance前置下无可达交接正例——需系统级producer/reason语义。
- PR#653评估: 与aging(等待超限触发)为两个独立缺口, 共用机制(系统 Assistance 入口)。

## 提案要求(与#643同构, 触发不同)
1. **第二reason定义**: 如 RECOVERY_REFUSAL_TERMINAL(命名自定)——触发=blocked恢复被合法拒绝进入终态后责任悬空(与readback等待超限独立)。
2. **六约束照#643模式**: 触发/actor边界/UNKNOWN保全+零重放/交接义务(幂等收据/接收方/答复验证/再触发/失败保留责任)/DTO封闭与向后兼容(旧消费者fail-closed)/与#1379及#643边界解耦(机制复用但提案独立)。
3. 前置核验: STOPPED-1377-MINIMPL.md反例坐标+PR#650分析复用; 与#643的机制共享面如实标注(共用入口设计/独立提案接受)。
4. 格式: SPEC_FORMAT_V0, SUPERSEDE或NEW路线论证, proposed/零实施权。

## 交付
docs/specs/ 提案文档(proposed)+RECEIPT-REFUSAL-PROPOSAL.md(与#643同构对照表+边界划分+开放问题含Svc配对面)。commit新分支docs/refusal-terminal-proposal→push→PR(base main)不合并。
