# STOPPED — Execution Kernel Reliability V1 §1

STATUS = STOPPED

本轮依 Owner 任务书 [#1374](https://github.com/mayf3/agent-control/issues/1374) 及本次交办的“失败即停”停止。完整 defect-matrix 与八组验证尚未完成；不得作为实现、合并、部署或生产恢复的准入证明。

## 坐标与停止原因

- 工作树：`/private/tmp/dsh-ekr-preflight`；分支：`ac-ekr-preflight`。
- HEAD / origin/main / `git ls-remote origin refs/heads/main`：`eb8fd18934d827cec98faacaef987869c5cb92e7`（本轮开始时一致，未 fetch/reset/checkout）。
- 部署源码对照：`fa4510beb6b01e5c40000a2ae36a62c526759e76`，通过 `git archive` 内存读取；plist 声明已只读核对。
- 失败位置：组 5 / B4 的内存纯函数验证 harness，非产品源码运行失败。
- 实际失败：两个 Node 子进程均 `rc=1`，`SyntaxError: missing ) after argument list`，`Node.js v26.7.0`。外层 Python 未转抛，最终 `rc=0`；不能以外层成功掩盖子进程失败。
- 原因：先替换 `SOURCE` 注入源码，再替换 `REV`，误改源码字符串 `NEEDS_REVIEW`，形成 `NEEDS_"fa4510be"IEW`。断言未运行，B4 无有效动态结果。
- 动作：主审收到失败后通知三个分组停止所有进一步源码核查及测试；未修 harness、未重跑、未补做其余验证，仅整理既得证据和本回执。

## 边界与执行偏差

未修改源码、测试、配置、Git refs 或生产状态；未启动服务、未调用生产读回 API、未访问运行进程内存、未执行恢复/投递/重试。唯一预定持久写入为本 STOP 文件及 `docs/evidence/ekr-preflight/` 下的报告。

前面的路径探索也曾产生不存在目录/文件的 `rg` 非零返回和归档路径 `KeyError`。当时将其视为路径定位信息继续，停机口径过窄；若“失败”涵盖任意探索命令失败，这些就是更早的停机点。因此本轮停机纪律不记 PASS，不能声称全过程零失败。新增报告不会抹去该偏差。

本次 live 只读比较定位到 `/usr/local/libexec/agent-core/app`。engine、ledger、workflow-execution-runtime 三文件与 `fa4510be` 相同；live 另有该提交不存在的 scheduler auto-reconcile 文件。这不证明 live 全树等于该 SHA，也不证明正在运行的进程加载了这些磁盘文件。

## 交接

- [部分缺陷矩阵](docs/evidence/ekr-preflight/DEFECT-MATRIX.md)：保留双版本静态发现、已执行的隔离结果和证据边界。
- [执行回执](docs/evidence/ekr-preflight/RECEIPT-EKR-PRE.md)：列出八组覆盖状态、失败与 UNKNOWN。
- 本轮不继续源码审计或执行 §2–§9；后续接续必须承认本停止记录及未验证项，不将本轮包装为完整预检通过。
