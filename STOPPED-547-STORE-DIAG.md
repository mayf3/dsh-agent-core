# STOPPED-547-STORE-DIAG

状态：**STOPPED / 调查未完成**。2026-11-08 14:49:02 +08:00
（`2026-11-08T06:49:02.992836+00:00`）。本报告是停止记录，不是恢复授权。

## 目标、授权和坐标

- Repository：`mayf3/dsh-agent-core`。
- Worktree：`/Users/yanfenma/workspace/project/worktrees/h547-store-diag`。
- Isolated branch：`diag/547-durable-store`。
- Candidate parent / integration base / 当时 remote main：`95a8e1cb512fc99dc018209d837250dd51b4d08f`。
  本地名为 `main` 的 ref 是较旧的 `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`，未拿它替代 remote main。
- 执行授权：[BRIEF-547-STORE-DIAG.md](BRIEF-547-STORE-DIAG.md) 与本次用户明确指令；只读调查、隔离副本、报告、commit/push/PR，不合并。
- 完成条件：一致副本上复现 deployed 同一校验谓词，交付 `DURABLE-STORE-DIAG-547.md` 与 PR；**未达到**。
- 停止条件：用户“失败即停”；本次复制失败触发，未自动重试。

治理路线：`PREFLIGHT / REUSE / BRIEF / DURABLE / OPERATION`。
`AUTHORITY_ACCEPTED_IN_BASE=YES`；`IMPLEMENTATION_ALLOWED=NO`（本任务不改产品实现）；
只读调查在停止前获授权，停止后 `OPERATION_ALLOWED=NO`（仅整理停止记录与交付 PR）；
生产 mutation/recovery/merge 均未获授权。此次无产品 Contract 变更。
直接约束是 accepted `AGENT_PROCESS_LIFECYCLE_HARDENING_V4` C-018/C-019/BOUNDED：
校验前 fail-closed、保留 unresolved evidence/fences；
accepted `HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2` RQ-003 先要求 store validator 通过，
RQ-006 禁止 replay/sweep，其 `production_apply_authority: none` 不授权生产修复。

## 失败原文与范围

执行脚本：[capture.py](docs/evidence/h547-store-diag/capture.py)。
完整带时刻/rc/输出长度与 SHA 的命令记录：[capture-receipt.json](docs/evidence/h547-store-diag/capture-receipt.json)。

失败命令：

```text
sudo -n -u authsvc /bin/cat /Users/authsvc/.agent-core/control/turn-recovery-v3.json.bak-pre-epoch-fix2-20261106
started: 2026-11-08T06:49:02.980745+00:00
ended:   2026-11-08T06:49:02.992776+00:00
rc: 1
cat: /Users/authsvc/.agent-core/control/turn-recovery-v3.json.bak-pre-epoch-fix2-20261106: Permission denied
```

之前只读 `sudo -n -u authsvc /bin/ls -lain /Users/authsvc/.agent-core/control`
的终端输出已显示该历史备份：

```text
355449565 -rw-------   1 0    601   8342435 Nov  6 09:34 turn-recovery-v3.json.bak-pre-epoch-fix2-20261106
```

此行是既有终端观察的摘录，不是从 receipt 中未保留的 stat 原文推导，也未为补报告再次读取生产。
权限失败发生在历史备份；**不是 active store 读失败，也不能据此断言维护入口不可用**。
采集脚本保守选取了全部 `turn-recovery*` 相邻文件（22 个），范围包含历史备份；
其中 root-owned 历史备份并非已确认的启动依赖。没有跳过失败文件缩小范围继续，也没有改权限或身份。

## 已完成的只读观察与未完成部分

在失败前已读完整简报、AGENTS/.agents 入口及相关 authority，读取 deployed 源码并确认路径链：

```text
/usr/local/libexec/agent-core/app/packages/production-runtime/src/paths.js:78-79,107
  root = resolve(rootInput ...)
  turnRecoveryStore: join(root, 'control', 'turn-recovery-v3.json')
.../packages/production-runtime/src/compose.js:334-335
  reconciliationStoreFile: layout.turnRecoveryStore
.../packages/agent-router/src/index.js:194-195,245
  new TurnReconciliationStore({ persistenceFile: recoveryFile })
```

故 active store 是 `/Users/authsvc/.agent-core/control/turn-recovery-v3.json`。
源码约定的 siblings 包含 `.faults.json`（store.js:65）、
`.abandonment-declarations.json`（durable-file.js:71-72）、
可选 `.r28-history.jsonl`（index.js:196-197）及原子写入 `.tmp-<pid>-<time>`（durable-file.js:329-341）。
目录观察未见该 store 的 lock/meta 命名项或 r28-history；不能把其缺席当成一致性证明。

源码读取发现 `store.js:111-121` 将 SyntaxError、TypeError、ReconciliationCapacityError
分类为 `durable_store_invalid`；例如 `durable-file.js:353` 的候选校验为
`parsed.runtimeEpochs.length > RECONCILIATION_CAPS.MAX_RUNTIME_EPOCHS`，
`capacity.js:24` 常量为 `256`。**没有对副本运行它，不能声称它就是本次实际失败谓词。**

前置 `ps -p 396 -o pid=,user=,lstart=,command=` 只读观察：PID 396、authsvc、
`Sun Nov 8 13:56:34 2026`，命令为
`/usr/local/libexec/agent-core/node-runtime/bin/node /usr/local/libexec/agent-core/app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core --catchup 0`。
此前读到 app `pack-provenance.json` 的 `source_head_sha=393a0afccedc5cce7be8b492c82d68d8d52206f6`；
它是磁盘 pack 的声明，不是本次进程加载字节的独立认证。

当前保留 7 个首轮读取副本，均在
`docs/evidence/h547-store-diag/private/store/`，目录 0700、文件 0600、Git ignored，未发布数据内容。
[partial-copy-manifest.json](docs/evidence/h547-store-diag/partial-copy-manifest.json)
仅登记本地字节数/哈希，没有解析记录内容。
active store 的**一次读取**记录为：

```text
source: /Users/authsvc/.agent-core/control/turn-recovery-v3.json
copy: docs/evidence/h547-store-diag/private/store/turn-recovery-v3.json
read: 2026-11-08T06:49:02.882237+00:00 .. 06:49:02.896287+00:00
bytes: 8505790
SHA-256: 85c4b0ce0957c03d6074edd7624ae33e8c2678feb9796087d27c5b7f7cd4b508
consistency: NOT_ESTABLISHED
```

失败位于首轮复制，未执行 middle/after stat、全文件向量二次 hash、目录 membership 收尾认证，
也未复制 deployed source 快照。上述 hash 只证明收到的字节；不能证明一次一致副本，
更不能证明 PID 396 启动时读取了同一内容。

```text
CONSISTENT_COPY = NOT_ESTABLISHED
OFFLINE_SAME_PREDICATE_REPRODUCTION = NOT_RUN
ACTUAL_FAILED_PREDICATE / RECORD / BYTE_COORDINATE = UNKNOWN
DURABLE_STORE_ROOT_CAUSE = UNKNOWN
RECOVERY_EXECUTED = NO
DURABLE-STORE-DIAG-547.md = NOT_PRODUCED
```

## 生产边界与后续最小处理（本次不执行）

本次 `sudo -n -u authsvc` 只用于 ls/stat/cat。没有以 authsvc 执行写命令，
没有修改 `/Users/authsvc/.agent-core` 文件、重启/发信号给 PID 396、裁 epoch、清 fence、
写生产账本或调用 Router。所有任务写入仅在本隔离 worktree。
“零写入”指本次操作者未发起生产写操作，不声称活跃 runtime 在调查期间没有自行写入。

无需新增生产授权的后续工作仅限保存/复核停止证据与交付 PR，本次已执行。
要继续采集，应由原维护责任链先明确**新的恢复调查指令和副本边界**：
是否只采源码实际消费的 active store、faults、declaration registry、存在的 history/lock/meta/tmp，
并把不参与启动的历史备份排除。这个方向不必推断需要 root 权限，但本次失败后未擅自重启采集。
若要求历史备份也必须纳入，应由具备既有合法只读权限的维护方提供副本及哈希收据；
不得通过本任务 chmod/chown 或扩大 sudo 身份绕过。
任何生产修复、恢复或 restart 都需要后续精确操作授权和已定位谓词的恢复方案；当前根因 UNKNOWN，
不提出可执行的 epoch 裁剪/账本变更。Owner 此时最小待决事项是续查范围/只读证据提供者，
不是批准一个尚无证据的恢复动作。

## 交付与复核

只交付停止报告、原始简报、实际执行的采集脚本、脱敏命令收据、partial hash manifest 和独立复核记录。
不提交 private 原始数据；不把本报告命名为诊断完成报告。PR 仅记录阻塞，不合并。
