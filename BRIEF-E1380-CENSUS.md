# BRIEF-E1380-CENSUS — 跨 attempt 业务效果承接证据核查（#1380 首步，只读）

## 授权
#1380 原任务（最小接线/证据核查，非断言普遍漏洞）；#1374 §5 E1。只读普查 + docs PR 不合并；生产写入=0。

## 任务（per #1380 历史证据与限制）
审计基线 eb8fd189 / Workflow 59daec04 已老——以 main HEAD 重核：
1. **attempt-identity 现状**：main 的 packages/workflow-execution/src/attempt-identity.js 当前 attemptId 生成/变化语义（与 eb8fd189 版对照差异）
2. **workflow_operation_effects 现状**：该机制在 main 的实现坐标、覆盖的操作类别、记录存储（ledger-events.js 现状对照）
3. **六对原/替代发布实例核查**（#1374 §2 #1380 证据）：只读 DB（本地 PG svc_workflow_dogfood_clean，只读查询）核对六对实例的当前状态/事件/是否发生重复发布的实际效果证据（不重放不修改）
4. **幂等读回与 UNKNOWN 边界现状**：现有 dedupeKey/operationKey 语义与 UNKNOWN 边界在 main 的实现坐标
5. **结论**：#1380 最小接线还差什么（≤5 行）+ 已有可复用清单

## 边界
只读；不改代码；DB 只读查询；PR 只含简报+报告；坐标齐全；UNKNOWN 如实；push 失败 bundle /tmp/transfer-e1380.bundle

## 工具指令
shell git/gh；psql 用 /opt/homebrew/bin/psql + 本地凭据（sudo 可用）；禁 MCP github。
