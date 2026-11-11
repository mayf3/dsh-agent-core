# 合同式交办：Execution Kernel Reliability V1 — §1 代码预检（defect-matrix，只读）

## 权威输入
1. gh issue view 1374 --repo mayf3/agent-control ——任务书全文（S1/L1/L2/E1 + P0-A/P0-B/P1-A/P1-B + 反例清单）
2. 审计参考（非开发基线）：core eb8fd189 / svc-workflow 59daec04；本 worktree base = 当前 origin/main（更新）
3. 实际部署版本对照：plist AGENT_CORE_DEPLOYED_SHA = fa4510be（live 树 /usr/local/libexec/agent-core 只读对照）
4. 两轮审计关联单：#1363（D01-D10）+#1354（H01-H08）

## 任务（只读核查；git archive/内存读；不修改任何源码；零生产写入；live 树只读）
对任务书列出的每项反例，在**当前 main** 与**实际部署版本 fa4510be**分别核查是否仍成立：
1. **P0-A 跨 attempt 错误结算**：engine.js/ledger-records.js 现版是否已有 expectedAttemptId/expectedGeneration/CAS 条件？观察者提交路径（turn 回执/恢复/重试）逐个定位
2. **P0-B B1 settle_check_unavailable**：现版结算分支是否区分临时读回失败？持久责任+下次检查时间机制存在吗
3. **P0-B B2 resolution_blocked**：recoverAttempt 的调用者普查（正式调用路径 vs 无）；blocked attempt 现状
4. **P0-B B3 attempt_planned 中断**：planned 写入→投递的持久写前记录存在吗；重启后行为
5. **P0-B B4 版本基线**：版本采样失败后的持久化行为；workflowStateVersion 增长的现有判定逻辑
6. **P1-A Owner obligation**：生产器队首阻塞现状（对照审计 D01 关联）；Owner wake pending/settled/failed 与业务义务的区分现状；HUMAN_REQUIRED 通知/重唤醒路径现状
7. **P1-B 副作用身份**：业务操作 ID/attempt ID/generation 三身份在现版固定操作/command receipt/workflow_operation_effects 的实际形态；外部工具能力分组现状
8. **调度契约**：全部非终态分支清点——每状态的自动消费者/持久触发/关闭条件存在性；调度器重启后重新发现责任的机制现状

每项输出：`defectId / currentCommit(core main sha + deployed fa4510be 分别) / existingContract / reproduction(仍成立|已修复|证据边界) / severity / affectedPath / proposedMinimalChange / regressionTest`
- 部署版本上的核查以**源码读回**为准（fa4510be 的 git archive 内存读），不访问运行进程内存
- 关联单引用：#1364/#1366/#1367/#1358 中已验证的反例可直接引用（注明对应关系），但 current main 的复核必须重做

## 红线
只读；零生产写入；不改源码；无复现的条目记录证据边界不猜测；失败即停写 STOPPED-EKR-PRE.md
## 回执（docs/evidence/ekr-preflight/DEFECT-MATRIX.md + RECEIPT-EKR-PRE.md）
完整 defect-matrix（每项含两版本对照）、八组验证清单引用、证据边界清单、建议修复顺序、UNKNOWN 清单
