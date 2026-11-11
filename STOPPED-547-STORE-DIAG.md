> v5 状态指针：用户已明确恢复并重定义失败语义；本文件下方 v1–v4 STOPPED 均为当时历史记录。v5 已完成白名单采集和真实 scratch QA（141 checks），两次本地 harness 错误有解释且原文保留，见 D-STORE-QA-547.md；没有生产操作或业务恢复结论。

# STOPPED-547-STORE-DIAG

最新状态：**v4 STOPPED / 当前快照 QA 未完成**，见文末 v4 节。下文 v1/v2/v3 原始停点保留。

v1 状态：**STOPPED / 调查未完成**。2026-11-08 14:49:02 +08:00
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

## v2 STOPPED — 历史文件名 `unblock` 被误识别为 lock

v2 授权：用户 2026-11-08 续办指令及 brief v2，缩小到源码实际消费集，排除
root `.bak` 历史备份，三遍一致性、离线同谓词复现、零生产写入、失败再停。
本轮 parent `7d5979a94096ea4ffd41bbc5f2e29e0773916fb9`，分支/隔离 worktree 不变；
remote main fresh read 为 `95a8e1cb512fc99dc018209d837250dd51b4d08f`。
现有 PR [#670](https://github.com/mayf3/dsh-agent-core/pull/670) 续记，不合并。

采集窗口：`2026-11-08T07:00:23.742502+00:00 .. 07:00:24.956394+00:00`
（北京时间 15:00:23..15:00:24）。97 个命令全部 rc=0；其中 95 个
`sudo -n -u authsvc` 仅 ls/stat/cat，另两个为同一 PID 的前后 ps。
没有 root 身份命令，也没有读取任何 `.bak` 内容。

### 实际失败与停止动作

这是本轮采集器的范围错误，**不是生产 store 的失败谓词**。
[capture-v2.py:54](docs/evidence/h547-store-diag/capture-v2.py) 的实际执行原文：

```python
auxiliary = '.tmp-' in name or 'lock' in name.lower() or 'history' in name.lower()
```

可达反例：`turn-recovery-v3.pre-fleet-unblock-20261002-111745.json` 含 `lock`
子串，但它是历史副本；没有证据表明 deployed 启动读取它。
实际 selected=4，期望本次观察到的实际消费文件=3；多出的 1 个文件为 authsvc 属主、0600，
2,536,800 bytes，SHA-256
`fd682125eb0a37f08223f98b78ad3b50c5db2ad7d4af3b02998b824ede81f6bb`。
它被三遍复制、每遍两次读取；不是跳过权限失败后继续，也不是读了 root 历史备份。

采集器未把此语义错误识别为异常，故原始 receipt 的 `status=PASS` 只表达其机器检查结果。
操作者事后检查 receipt/file set 时发现错误，立即停止后续诊断：无进一步生产读取、
无重采、无源码 import/同谓词离线校验。只整理本地停止材料、独立复核和 PR。
原始脚本与 receipt 原样保留，不能把 receipt 的 PASS 升格为范围/任务 PASS。

```text
FINDING = SCOPE_ESCALATION
SOURCE = 用户 v2 + BRIEF-547-STORE-DIAG.md 的源码实际消费集边界
COUNTEREXAMPLE = capture-v2.py:54 接纳 pre-fleet-unblock 历史文件
IMPACT = 多读一个非消费文件；诊断流程未按约定范围执行
MINIMAL_CLOSURE = 维持 STOP；责任链明确后续仅用已取得的三个必要文件
                  还是另行采集；任何后续采集先修正精确命名规则并本地核对清单
affected_readiness = [diagnostic_continuation, diagnostic_completion]
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
```

### 三遍实际结果（不撤销真实观察，也不声称范围合规）

[capture-v2-receipt.json](docs/evidence/h547-store-diag/capture-v2-receipt.json)
包含逐文件 pre-stat、复制、post-stat、第二源读取、final stat；三遍完整 SHA/stat 向量与前后目录
membership 相同；源码 18 个文件复制前后字节 hash 相同；PID 前后 ps 相同。
这是短窗口的稳定读取证据，不是原子文件系统快照，也不证明启动时/停点之后内容相同。

下表每个文件的三个 `pass-N` 副本及六次源读取 hash 均相同。生产路径前缀为
`/Users/authsvc/.agent-core/control/`；本地前缀为
`docs/evidence/h547-store-diag/private/v2/pass-{1,2,3}/`。

| 文件 | bytes | 实测 SHA-256 |
|---|---:|---|
| `turn-recovery-v3.json` | 8507342 | `682f7d8af8c537a341346b880f99ce75135f21ce71e48992a97936f9771a5a2b` |
| `turn-recovery-v3.json.abandonment-declarations.json` | 3137 | `28ba4a74693d23ad0fc3338d77d2f5c72a35c1ae43970dfb2b4f854d6c727cc1` |
| `turn-recovery-v3.json.faults.json` | 119 | `40952f56c38ee736955e9e9f2da6dee59ee984bb69456a0ac9659c3412730e93` |
| 越界历史副本 `turn-recovery-v3.pre-fleet-unblock-20261002-111745.json` | 2536800 | `fd682125eb0a37f08223f98b78ad3b50c5db2ad7d4af3b02998b824ede81f6bb` |

首轮 v1 `85c4b0ce…` 单读副本保留，不与 v2 混同。v2 私有目录 0700、文件 0600，Git ignored；
仅发布脚本、路径、时间、stat、hash 与停止事实，未发布 raw store/source 副本。
检查副本时仅 JSON 解析取得顶层计数（epochs=256、records=5320、issuance=93、correlationIndex=3985），
**没有调用 deployed validator**；这些计数不能证明其他谓词通过，不能推断故障已消失。

### 新线索与当前未知

- **11-06 手术痕迹**：v1 ls 原始观察的 root-owned
  `.bak-pre-epoch-fix2-20261106` 文件名，及 v2 listing 中继续存在的该名字，
  支持“存在 epoch-fix2 手术命名痕迹”；操作者、授权、具体改动及其与故障因果均 UNKNOWN。
  本轮没有读取该 root 文件。相同 listing 还出现 `.bak-pre-r129-fence-repair-20261108`；
  这也仅是名字线索，不证明修复内容或授权有效。
- **今日重启**：前后 ps 都显示 PID 396、authsvc，启动
  `Sun Nov 8 13:56:34 2026`，`--root /Users/authsvc/.agent-core --catchup 0`。
  重启者/授权 UNKNOWN。仅凭这次 ps 不能认定故障已清除。
- **磁盘源码变化**：本轮快照 `pack-provenance.json` 声明
  `source_head_sha=08102a550cf2f5e14646c6858786d7fe7a50c61d`，
  `main_repo_head_sha=393a0afccedc5cce7be8b492c82d68d8d52206f6`，
  `integration_note=R129-D minimal cherry-pick of 42487e65 onto 393a0afc ...`。
  这些是磁盘声明，不是本轮核实的部署授权或进程加载认证；PID loaded bytes=UNKNOWN。
  源码全文件 SHA 在 receipt 中。本轮实际 `store.js` 为
  `1c38068b26142d454c99cf1d670bfd3693dda2e32a084f68942109385defd0e3`，
  `durable-file.js` 为 `db854ee6061c7f8a56d48f686905d667353c9930bfcd64c95464752075542a1c`。
- 本轮源码分类坐标是 `store.js:117-121`，候选 epoch 上限是
  `durable-file.js:360`，常量仍为 `capacity.js:24` 的 256；不沿用 v1 行号。
  未运行，故**实际失败谓词/记录/字段/字节坐标仍 UNKNOWN**。

### 未完成项与续办最小方案（不执行）

```text
CONTENT_CONSISTENCY = THREE_PASS_STABLE
CAPTURE_SCOPE = FAIL
OFFLINE_SAME_PREDICATE_REPRODUCTION = NOT_RUN
ACTUAL_FAILED_PREDICATE / RECORD / FIELD / BYTE = UNKNOWN
DURABLE_STORE_ROOT_CAUSE = UNKNOWN
RECOVERY_EXECUTED = NO
DURABLE-STORE-DIAG-547.md = NOT_PRODUCED
DONE_WHEN = NOT_MET
```

最小续办可由责任链明确是否允许仅用现有副本中的三个实际消费文件继续离线分析，
从而不必再次读生产。若要求新采集，先改成由源码命名规则导出的精确 allowlist，
以现有本地目录清单检验 `unblock` 等历史名称必被排除；不得直接重跑本轮脚本。
同谓词复现须包含 deployed reader、registry、authority/capacity 与 startup 内存路径；
构造器可能写文件，不能直接以捕获文件路径实例化。

只有未来完成离线校验且无失败，才可以如实写“现象可能被重启清除/仅启动窗口出现”；
验证先绑定当前进程 loaded bytes 与启动/健康证据，再在另有授权的全新请求上观察真实 admission/readback。
不得 replay 旧 UNKNOWN、清 fence、裁 epoch 或为验证而重启。当前不提出生产恢复操作；
任何 restart/账本修改/恢复均须后续精确维护链/Owner 授权，本任务没有执行这些动作。

## v3 STOPPED — 本地源码查询错误，尚未采集当前快照

本轮用户明确恢复 v3 只读诊断，root 已读 v3 与 v1/v2 停点；执行 parent
`c8036802f1543b108eddce3f8fce474bdc2d4d99`，分支/worktree/PR #670 不变。
本轮候选查重已确认 main `42487e65` 三件套，不实施重复修复。

helper `/root/offline_design_review` 的已执行工具 `exec_command`（chunk `d460e0`）原文：

```text
rg -n 'fault|r28|history|businessAdmissionStatus|assertBusiness' packages/agent-router/src/reconciliation/store.js packages/agent-router/src/index.js packages/agent-router/src/reconciliation/authority-capacity.js packages/agent-router/src/reconciliation/dispatch-faults.js
rc=2
rg: packages/agent-router/src/reconciliation/dispatch-faults.js: No such file or directory (os error 2)
```

错误发生时刻 UNKNOWN，wall time `0.000002834s`；root 固定停止收据时读取时钟为
`2026-11-08 07:13:49 UTC`，不冒充错误时刻。该 helper 在同一 exec 内随后完成
三条已安排的本地 Spec sed 读取，均 rc=0，之后未继续工具调用；不是逐命令立即停止。
这是本地检索引用错误，导致 fault-sidecar 完整实现核查未完成，**不是 store 失败谓词**。
root 收到报告后停止依赖的新鲜采集和离线验证，没有修正路径后重跑。

```text
V3_PRODUCTION_READ_COMMANDS = 0
V3_PRODUCTION_WRITE_COMMANDS = 0
V3_AUTHSVC_COMMANDS = 0
FRESH_CONSISTENT_COPY = NOT_RUN
FOUR_CURRENT_RECORD_FACTS = NOT_VERIFIED
FULL_STORE_LOAD / BLOCKING / NO_REPLAY / NARROW_TOLERANCE = NOT_RUN
RECOVERY / CUTOVER / RESTART = NOT_EXECUTED
DONE_WHEN = NOT_MET
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
```

未执行的 `capture-v3.py` 仅是精确白名单草稿，未运行 `--check`，无 v3 capture receipt。
v1/v2 脚本/receipt/私有副本原样保留，不将旧稳定观察升格为当前 QA。
仅继续整理既有观察、独立复核停止材料和更新 PR，不开展新诊断。
[D-STORE-QA-547.md](D-STORE-QA-547.md) 明确四条待核事实和安全发布缺项；不是诊断完成报告。
错误收据见 [stop-v3-receipt.json](docs/evidence/h547-store-diag/stop-v3-receipt.json)。

## v4 STOPPED — root 本地目录查询错误，尚未采集或验证

本轮用户 v4 指令恢复只读诊断，执行 parent
`71fce950e249ef8e36a9d255e4cfdc97fdc70532`，沿用隔离 worktree/分支/PR #670。
root 已读 BRIEF v4、D 报告续办配方及治理入口；尚未完成相关 authority 重读、
白名单独立核对或本地反例验证。没有执行 capture-v3.py（包括 --check）。

root 在 functions.exec 中执行的本地命令原文：

```sh
cat .agents/skills/spec-governance/modes/preflight.md && sed -n '1,75p' .agents/local/README.md && rg --files docs/evidence/h547-store-diag && rg --files docs/architecture docs/decisions docs/specs | rg 'ARCHITECTURE|PROCESS_LIFECYCLE_HARDENING_V4|HR_RESTART_LOST_FENCE_TRUSTED_RECOVERY_SPEC_V2|547|FENCE'
```

失败输出逐字原文：

```text
rg: docs/architecture: No such file or directory (os error 2)
```

该命令仍输出了三个匹配 Spec 路径，不能据此当成完整查询成功。
root 当时只转发 exec_command.output，未保留外层 exit status 或内部 rg status；
二者均为 UNKNOWN_NOT_RETAINED，不重新执行获取 rc，不把系统错误码 2 冒充 shell rc。
错误时刻 UNKNOWN；停止收据时钟 `2026-11-08 07:28:00 UTC` 仅固定记录时间。
这是 root 的查询路径错误，不是 v3 的文件名笔误复发，也不是生产 validator 失败。
local README 已给出实际 Architecture 入口；停止后没有修正路径继续调查。

root 在观察 stderr 后发送停止通报并打断 `/root/review_capture`。helper 只执行本地只读文档/文件名/HEAD 读取，
更正自报为四次 exec_command，均 rc=0、无内部查询错误；未完成白名单结论。并行读取可能在 root 观察前已完成，
不声称逐命令即时停止。停点之后仅保存材料、读取现有 PR 和独立复核包装。

```text
V4_PRODUCTION_READ_COMMANDS = 0
V4_AUTHSVC_COMMANDS = 0
V4_PRODUCTION_WRITE_COMMANDS = 0
V4_FRESH_CAPTURE = NOT_RUN
FULL_STORE_CONSTRUCTOR_LOAD = NOT_RUN
FOUR_CURRENT_RECORD_FACTS = NOT_VERIFIED
BLOCKING / NO_REPLAY / NARROW_TOLERANCE = NOT_RUN
RECOVERY / CUTOVER / RESTART = NOT_EXECUTED
DONE_WHEN = NOT_MET
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP
```

计数只描述本轮操作者动作，不推断历史 UNKNOWN 的业务效果或生产 runtime 是否自行写入。
既有 v1/v2/v3 evidence 原件保持不变；没有用历史副本/投影填当前矩阵。
收据见 [stop-v4-receipt.json](docs/evidence/h547-store-diag/stop-v4-receipt.json)。
