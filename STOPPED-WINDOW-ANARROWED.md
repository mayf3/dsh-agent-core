# STOPPED-WINDOW-ANARROWED

Gate: window-selftest; exit=1
Evidence: /usr/local/v5-boot-isolation/anarrowed-gates-mpzv4wo_

No retry, commit, push, PR or downstream production execution. Production stages NOT_EXECUTED.

## 冻结坐标

- Worktree: `/private/tmp/anarrowed-wt`。
- Branch: `chore/fleet-window-anarrowed`。
- HEAD / implementation parent: `e61458e0666bc6aa962d31561beeff1ada4a4f56`。
- 代码增量尚未提交；没有 push、PR、合并或生产阶段执行。
- 停止原因：用户要求 `window-selftest.py` 全 PASS，实际退出1；
  `REQUIRED_GATE_FAILURE`，交付/合并门为 NO。静态独立审阅没有发现 blocker，
  不能代替本次实际失败的执行门。

## 实际验证

| 门 | 结果 |
|---|---|
| git diff --check | rc0 |
| /bin/bash -n executor | rc0 |
| helper/selftest py_compile（5文件，产物仅隔离目录） | rc0 |
| executor --dry-run（含03b/05b/06a边界） | rc0 |
| governance integrity | rc0 |
| window-selftest | rc1，停于 anarrowed-candidate-state |
| 其中 settlement 负向 suite | rc0 |
| 其中 bootstrap 失败回退 suite | rc0 |
| candidate suite 首个真实启动正例 | FAIL，后面的启动失败与旧v2 reader用例未执行 |
| 后续 stdio canary / 结构门 / 提交 / push / gh PR | NOT_EXECUTED |

主门命令与 stdout/stderr SHA：
`/usr/local/v5-boot-isolation/anarrowed-gates-mpzv4wo_/gates.json`。
Selftest 证据：`/usr/local/v5-boot-isolation/c7-selftest-i64cyf12/`，
特别是 `anarrowed-candidate-state.stdout.log`、`anarrowed-candidate-state.command.json`。
失败候选 fixture：`/usr/local/v5-boot-isolation/anarrowed-candidate-load-26tzVs/`，
完整逐项回执在 `candidate-receipts/candidate-state-receipt.json`。

## 失败的只读诊断

候选使用 `/private/tmp/fleet-v5-prep/scratch/node-runtime/bin/node`，
SHA-256 `c6c9bfa8eb5d0c6799e1fd7e246f5c6036d4863b5d3173625f37d952576ca93b`，
v25.6.1；完整候选代码/reader哈希在上述回执。该 scratch 的 pack provenance 为
`ce1d13c1e8585759c6a5f194fb5553d990574b5b`，仅作隔离机制 fixture，
不是本轮 f6a1f77a 安装候选的生产验收。

实测为 sourceUnchanged=true、originalUnknownPreserved=true、affectedBlocked=true、
unrelatedAllowed=true、globalStoreReady=true、fullRuntimeReady=true、
runtimeUnknownPreserved=true、noReplay=true、noOutbound=true；
processSpawnAttempts/outboundAttempts/businessDispatchAttempts 均为0。
但是 candidateUnchanged/noOverwrite=false，child 实际 code=5、signal=null、
closeObserved=true、timedOut=false；没有取得 cleanShutdown PASS。

恢复副本在完整运行时启动后发生了以下变化：top-level runtimeEpoch/runtimeEpochs、
records[0].bytes/updatedAt/failureReason 变化，并追加
`ownership_check / blocked / runtime_restart_ownership_unavailable`。
initialOutcome 前后均为 `outcome_unknown`，fenceState 前后均为 `active`；
独立 admission-probe 副本与 jobs-copy 字节未变，源 fixture 字节/metadata 未变。
候选 `process-registry.js:60` 的启动阻塞记录路径与该新增 action/reason 对应。

因此失败精确发生在当前新增探针对恢复副本要求字节不变的断言。
这项 Observation 本身尚不能把诊断持久化判为 accepted Product Contract 违约，
也不能自行放宽用户的“不覆盖”要求。下一轮需先按已接受合同核对允许的启动诊断增量，
再决定最小实现或 oracle 修订；本轮未作该选择、未修补、未重跑。

所有旧证据与生产收据保留。`RECEIPT-WINDOW-ANARROWED.md`、代码提交、结构门、
push 与引用 #605 的 PR 尚未交付；不得将本次静态审阅或部分门通过标为完成。
