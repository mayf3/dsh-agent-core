# 合同式交办：EKR B1/B4 行为实现（任务书 #1374 §3，权威 AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1）

## 权威输入
1. docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1.md（main @ 当前，B1/B4 语义权威；接受记录见 PR #623 评论）
2. gh issue view 1374 --repo mayf3/agent-control ——§3 B1/B4 全文
3. DEFECT-MATRIX.md G2/G5（docs/evidence/ekr-preflight/）——双版本反例坐标
4. #622（CAS 先例）与 #624（B3 对账）的实现模式

## 任务（base=当前 main，branch ac-ekr-b1b4）
1. **B1**（settle_check_unavailable 活性）：临时读回失败→保留"结果未知"持久责任+持久 next-check 时间戳；
   只读对账有界重试（per WAE V1 条款）；到期由现有 due poller 自动再读——**不重跑业务操作、不改 UNKNOWN**
2. **B4**（版本基线活性）：基线缺失→允许补采（delivery 后重试采样）+持久重验责任；同 visit 版本变化→触发
   重新检查+重验权限，**不单独等价业务完成**（保守 predicate 修正为"版本变化→重验"而非"progressed 跳过"）
   ——精确对齐 AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1 的 B4 条款
3. 聚焦测试：503→恢复→自动再读收敛（B1 验收）；缺基线→补采→重验（B4）；版本增长→重验非完成；UNKNOWN 零写回归
4. 结构门+既有调度回归+diff check（working+cached，**证据文件排除项条款**：docs/evidence 内文件不纳入 cached-check）
5. push + PR 引用 #1374 标注 B1/B4；**不 merge**

## 红线
零生产写入；不改窗口工具；不动 #622/#624 已落语义；失败即停写 STOPPED-EKR-B1B4.md
## 回执（RECEIPT-EKR-B1B4.md）
base/head SHA、diff、聚焦测试输出原文、结构门输出、PR URL、UNKNOWN
