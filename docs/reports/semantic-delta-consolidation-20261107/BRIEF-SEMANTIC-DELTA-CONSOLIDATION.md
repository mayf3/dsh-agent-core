# BRIEF-SEMANTIC-DELTA-CONSOLIDATION — 系统级责任移交语义缺失整合差量评估(只读)

授权: Owner 预授权V2 §5(未授权语义变化→提交精确差量与最小接受路径)。docs-only 只读评估。
工作面: 本worktree(detach @ 2d8ce9d0)。产出=整合差量评估文档。零生产写入。失败即停。

## 输入(全部可只读)
1. PR#643: READBACK_AGING_HANDOFF_V1(proposed, docs/readback-aging-handoff-amend分支)——readback等待超限(aging)触发的系统级Assistance分支提案(新reason READBACK_WAIT_BUDGET_EXHAUSTED)。
2. STOPPED-1377-MINIMPL.md(本worktree): refused记录(visit迁移/assignee不符/实例终态)无既有Assistance可达正例。
3. PR#650分析: 消费者盘点+三分支判定。

## 评估问题
1. **缺失语义的同一性判定**: PR#643的aging触发与#1377的refused-terminal触发——是同一缺失语义的两个触发面(可一份提案覆盖: 同一系统级入口+多reason)还是两个独立缺失(两份提案)? 判据: 入口机制/前置条件/接收方/证据要求是否同构。
2. **整合差量精稿**: 若同一——给出统一提案的差异表(相对PR#643需增补: 第二reason+对应触发定义+负控); 若不同——两份提案的边界划分。
3. **最小接受路径**: docs-first提案(PRCREATE)→独立审查→Owner接受→实现的顺序, 每步的授权者与登记坐标; Svc配对接受面同步提示。
4. **范围外如实清单**: 不在本差量内的相邻诉求(#1379传输/planned恢复/B2自动恢复——均已有或另行处理)。

## 完成定义
SEMANTIC-DELTA-CONSOLIDATION.md(同一性判定+整合精稿或边界划分+接受路径+范围外清单)+RECEIPT。commit到docs分支→push→PR(base main)不合并。零生产写入。失败即停照旧。
