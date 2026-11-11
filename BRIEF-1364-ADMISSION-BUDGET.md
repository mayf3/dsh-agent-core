# BRIEF-1364-ADMISSION-BUDGET — 准入预算公平性最小修复（首批交付 A）

授权: Owner 审查增量执行指令②A(rulings[id=owner-20261107-audit-increment-execution])+预授权V1§1。
定义来源: agent-control issue **#1364**(父#1363 D01)正文三轮隔离复现。
停止条件: 失败即停写STOPPED-1364-BUDGET.md; LOAD_BEARING SPEC_GAP同#1376先例停并写最小关闭。

## 环境预置与运行器配方
- node_modules已预链(只验证勿重建); Node v26.7.0目录位置参数陷阱(文件展开); 全仓npm test结构性不可用作门; 噪声: stale-quiescence版本敏感断言不计门。

## 缺陷(矩阵实证坐标)
- `packages/workflow-execution/src/engine.js:129-132,367-379`+`ledger-admission.js:33-37`: created:false/pre_plan_unavailable 仍变同名 action 计入25次预算; 扫描/失败与实际创建未分离; 队首稳定异常项消耗全部预算, 后续正常项连续多轮无法被尝试(队首饥饿)。

## 任务(Owner②A逐字)
1. **复现**: 在当前固定候选(本worktree base 3c1bcf98)复现"稳定异常队首消耗全部预算, 后续正常项连续多轮无法被尝试"——真实失败基线测试(红)。
2. **最小修复**: 区分三类预算——有限扫描预算/失败预算/实际新准入预算; 保证后续正常项在有界轮次内获得机会(如: pre_plan_unavailable不计入实际准入预算+队首异常项有限重试后退避轮转); **禁止**仅增大预算数字/取消工作上限/绕过UNKNOWN边界。
3. 遵守既有合同(AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3:204-207准入语义+D-009); 如发现修复需改accepted语义→只呈精确差量与最小接受路径, 不硬做。
4. 测试: 失败基线(修复前红)+修复后绿+正常项有界轮次获得机会的断言+既有相关套件rc0(文件展开)。
5. 交付: 分支fix/admission-budget-fairness→push开PR(base main)不合并; RECEIPT-1364-BUDGET.md(复现原文+修复diff坐标+测试rc原文+DONE_WHEN对照)。
红线: 失败即停; 不动治理文档/.agents/tools; 不rebase; 零生产写入; PR禁自合并。

## R2 continuation mandate (2026-11-07)

当前用户指令解除 R1 单一夹具失败的停止，仅授权同步恢复状态，不得修改产品断言来迁就夹具。
先取得定向 7/7 rc0，再执行受影响既有套件（显式文件展开）；fetch origin main
（须包含 55f442c7）并评估、整合到本分支，复核 #644 同文件 engine.js 影响，
在整合树重跑定向与相关套件及结构门、独立受影响审查；全部通过后 commit、push、
开 base main 的 PR，不合并。整合采用 merge，不 rebase；新失败仍立即停止并记录。
路线沿用 REUSE / BRIEF / DURABLE，生产和治理修改权限仍为零。
