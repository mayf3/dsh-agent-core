# BRIEF-1376-WAIT-BUDGET — B1/B4 剩余义务: 有界等待+可靠交接（实现派发）

授权: Owner 常设授权#1(交付PR禁自合并)+常设预授权V1§1(常规研发)。
实现权威: `docs/specs/AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1`(accepted, 在base main)。
交付定义来源: agent-control issue **#1376** 正文+评论 6645082629(明确等待预算/aging与可靠交接)。
停止条件: 失败即停写 `STOPPED-1376-BUDGET.md`。

## 背景(监管只读矩阵实证坐标, base=3c1bcf98)
- 已交付面: 持久再观察/真实隔离进程重启503/基线隔离/代际CAS —— `packages/workflow-execution/src/recovery/readback.js:26-86`、`readback-ledger.js:18-104`、`engine.js:305,448-457`、`test/observation-cas/readback-restart.test.js`。
- **剩余缺口(本任务范围)**:
  1. `readback.js:69-74` 仅限制退避间隔, 无等待期限/超限处置——需等待预算(aging)与超限后的**可靠交接**(按 Spec 定义的义务移交面, 不得静默失活/不得伪造业务结果/UNKNOWN 如实保留)。
  2. `readback-ledger.js:55-64` 未保存首次等待时间/期限/送达交接证据——需落账(证据字段), 支撑验收读回。
- 明确不在范围: Wake 传输面(#1379)、B2 自动恢复接线(#1377)、 Owner/权限变化与节点前进两类独立验收的场景扩展(如实留待, 不虚报完成)。

## 任务项
1. 先读实现权威 Spec + issue #1376 全文与评论, 写出本次交付的 DONE_WHEN(对照 Spec 条款), 落在收据里。
2. 实现等待预算+aging+超限可靠交接+账面证据字段; 遵守 D-009 三态与 UNKNOWN 边界(不重放/不清 fence/不伪造结果)。
3. 测试: 新增针对性用例(预算内等待/超限交接/账面证据读回)+既有 observation-cas 全套件 rc0; 如涉 compose 需 Docker 而环境无 Docker, 如实记录 SKIP 原因, 不得伪装通过。
4. 交付: 收据 `RECEIPT-1376-BUDGET.md`(DONE_WHEN+测试原文 rc+变更文件清单+HEAD SHA); 开分支 `feat/readback-wait-budget`; push 并开 PR(base main), **PR 不合并**(监管验收后另行处理)。

## 红线
失败即停; 不动治理文档/.agents/tools; 不 rebase main; 零生产写入; 单写面=本 worktree; node_modules 已链好勿动; 测试失败如实报 rc 与原文。
