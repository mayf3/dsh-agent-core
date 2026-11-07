# STOPPED-1365-RETIRE

Gate RED failed its declared expectation. Actual rc=1; counts={'tests': 5, 'pass': 0, 'fail': 5, 'cancelled': 0, 'skipped': 0}.

Raw: docs/evidence/1365-retire/RED.tap
No further repair, commit, push or PR is authorized under failure-stop.

## 具体停止原因与边界

- STOP_CLASS=REQUIRED_GATE_FAILURE（本任务捕获运行器的 RED 结果核验错误；不是新 Product Contract 或 SPEC_GAP）。
- SOURCE=Owner BRIEF-1365-RETIRE「失败即停」及本次落盘 PREFLIGHT 的非预期 RED 停止条件。
- COUNTEREXAMPLE=`scripts/run-1365-retire-gates.py:71` 在计数/rc 核验之外要求 raw 含字面 `broken backend`。Node 实际 JSON 诊断不回显该夹具文本，raw 记录的是 `development-execution: malformed backend.json (...)`，因此 valid=False，捕获运行器 rc1。
- IMPACT=停止最小修复、GREEN、既有套件、结构门、候选审查、commit/push/开 PR。RED 原始测试观察保留，不把捕获失败改写为 PASS；不存在产品源码候选或通过的交付。
- MINIMAL_CLOSURE=需 Owner 恢复指令，仅修正 RED 捕获检查为实际可归因的 backend/history 错误及固定五个用例，保留原始失败记录；再核验/复用当前 RED 后，才继续已经授权的最小修复及全部后续门。当前不实施此修正，也不重跑。
- affected_readiness: IMPLEMENTATION_ALLOWED=NO; PUBLICATION_READY=NO; MERGE_READY=NO; OPERATION_ALLOWED=NO。
- NEXT_ACTION=STOP；无 SPEC_GAP，零生产写入；不 rebase、不合并。

## RED 实测（与运行器失败分开）

执行时间 UTC `2026-11-07T22:46:08.029364+00:00` 到 `2026-11-07T22:46:08.441946+00:00`。
Node=`v26.7.0`，execPath=`/opt/homebrew/Cellar/node/26.7.0/bin/node`，arm64；仅测试子进程清除九键代理变量，实测无残留。依赖预链验证可达，未重建。

```text
cwd=/private/tmp/h1365-retire
branch=fix/retire-executor-decouple
HEAD=b6ddc2a67ba041b8b13ed33d331104cf809d4985
command=python3 scripts/run-1365-retire-gates.py RED
test child=/opt/homebrew/bin/node --test --test-reporter=tap packages/production-runtime/test/development-retirement.test.js
test child rc=1 (expected 1)
tests=5 pass=0 fail=5 cancelled=0 skipped=0 (expected fail=5)
capture runner rc=1 (unexpected; literal diagnostic guard)
```

原始输出：[RED.tap](docs/evidence/1365-retire/RED.tap)，SHA256=`82b3cfff8f012078eca77864d12284d83dfdd5996b2924f317d84ce12108399b`。完整文件哈希、环境、命令与时间：[RED.json](docs/evidence/1365-retire/RED.json)。
RED.json SHA256=`a605f1093ede02443da63d313ccf144a427fc94c91bbf984f1795ba3d0e486be`。

| 用例 | 旧源码实际观察 |
|---|---|
| backend/历史均缺失 | Workflow 可 mount/poll，但创建退役 ledger 目录，零改动断言失败 |
| backend 损坏、历史完好 | `loadBackendConfig → new DevelopmentExecutionEngine → mountDevelopmentExecutionRuntime → mountWorkflowCapabilityRuntime` 抛 malformed backend.json |
| 历史损坏 | `ExecutionLedger.#replayTerminal → new ExecutionLedger → new DevelopmentExecutionEngine → mountDevelopmentExecutionRuntime → mountWorkflowCapabilityRuntime` 抛 corrupt executions.jsonl |
| backend/历史均损坏 | backend 错误先阻断 Workflow mount |
| 默认 Engine、backend/历史均损坏 | 构造器直接抛 malformed backend.json |

## 停止时源码读回

以下文件均与基线逐字节相同（实测，不是根据工作区状态推断）：

| 路径 | SHA256 |
|---|---|
| packages/development-execution/src/engine.js | `65d2965cdb14067cc770eb4cb8b1b3aff32f578e60c026c1e75e6fb8e2107dbe` |
| packages/production-runtime/src/development-execution-runtime.js | `66a6c6ea9dbce25088a694098c91db724dbd2d9342a923c767bb05050ba4b849` |
| packages/production-runtime/src/workflow/capability-runtime.js | `53dbddaa6cdbf140da020515c1a2b45beb7712715f3c4c4624ad65708c576ada` |

只新增/保留 Brief、隔离回归、捕获运行器、RED 原始证据和此停止记录。没有 commit、push、PR、GREEN 或运行时验收。`.agents`、治理文档、backend、ledger 和依赖原件未修改。测试临时目录按 fixture cleanup 清除。

## 独立停止核验

`/root/impact_scan`（未创作本次测试/运行器，read-only，无写入/重跑）独立核对 RED.tap/RED.json、运行器和源码对基线：确认 RED 测试本身符合 rc1/fail5 的预声明，失败来自捕获器额外字符串断言；三份生产源码逐字节不变；确认 REQUIRED_GATE_FAILURE、继续实现/发布=NO；最小恢复须 Owner 解除本次 failure-stop，仅改错误诊断匹配，保留历史原件并重跑同一 RED 后再继续。

## R2 STOP

Gate existing failed its declared expectation. Actual rc=1; counts={'tests': 71, 'pass': 57, 'fail': 14, 'cancelled': 0, 'skipped': 0}.

Raw: docs/evidence/1365-retire/R2-existing.tap
No further repair, commit, push or PR is authorized under failure-stop.

### R2 具体停止原因与边界

- STOP_CLASS=REQUIRED_GATE_FAILURE；SOURCE=本轮 Owner「受影响套件 rc0（文件展开）」及「失败即停」。不是 SPEC_GAP；不把原有配方不兼容当作套件 PASS 或噪声。
- COUNTEREXAMPLE=`R2-existing.tap` 有 14 个 not-ok；全部为 `AGENT_MODEL_OVERRIDE_INVALID` / `NODE_RUNTIME_VERSION: runtime_version_mismatch`，栈从 `compose.js:144` 到版本守卫 `:97`。`compose.js:84` 固定要求真实 `v25.6.1`，捕获器实测真实 `v26.7.0`，在任何 composition mount 前失败。分布：compose-deployment-root 1、compose 9、workflow-execution-shutdown 4。
- OBSERVATION=71 tests / pass57 / fail14 / cancelled0 / skipped0，child rc1、capture rc1；没有基线重跑，不能声称整个候选或既有套件通过。根据错误栈和未改的守卫，只能归因为本次执行的运行器版本不兼容；未发现这 14 项属于退役语义回归的证据。
- IMPACT=立即停止后续修复、重验、结构门、候选最终审查、commit、push、开 PR。当前 IMPLEMENTATION_ALLOWED=NO、PUBLICATION_READY=NO、MERGE_READY=NO、OPERATION_ALLOWED=NO；NEXT_ACTION=STOP。
- MINIMAL_CLOSURE=续派时先核合法真实 Node v25.6.1 及依赖/环境，按既有版本守卫调整该组套件的捕获配方，重新执行受影响门并绑定实际二进制/版本；不得伪造 process.version、删除版本断言、跳过失败项或改产品守卫。该最低恢复步骤仅记录，R2 未执行。
- 当前隔离 worktree=/private/tmp/h1365-retire；branch=fix/retire-executor-decouple；HEAD=b6ddc2a67ba041b8b13ed33d331104cf809d4985；current origin/main=e8d6d333743f812945d47b96ace61b817f35f9cf。不 rebase、不合并、零生产写入。
- 最小源码候选保留但未提交：仅 engine.js 与 development-execution-runtime.js，22 additions / 13 deletions。前者默认退役时不建 backend/可写 ledger，查询现有 static replay；后者惰性提供现有 Engine。Workflow capability、历史格式、管理器、权限、锁架构、.agents、治理文档、既有测试、依赖原件均未改。
- 两份本任务新增测试/捕获器机械移到 `packages/development-execution/test/`，避免 R1 顶层目录宽度债务；RED/GREEN 的位置/哈希差异已在 Brief 解释，断言未改。
- R2 RED=固定五项预期失败/诊断匹配 5/5、capture rc0；R2 GREEN=同五项 pass5、child/capture rc0，含旧写拒绝、历史只读/损坏报错、再次 Workflow poll。以上是离线机制证据，不是完整交付或运行时验收。
- 独立停止核验：`/root/independent_review` 未创作本次源码/测试/捕获器，只读核对 raw/json、两个源码 diff、HEAD、未改边界及 R1 原件；确认 14 项均在版本守卫失败，真实套件门 FAIL，failure-stop 生效。未进行最终候选 PASS 审查。

### R2 原始证据 SHA256

- `RED.tap`: `82b3cfff8f012078eca77864d12284d83dfdd5996b2924f317d84ce12108399b`
- `RED.json`: `a605f1093ede02443da63d313ccf144a427fc94c91bbf984f1795ba3d0e486be`
- `R2-RED.tap`: `68bdad663042f1b4751e8f2440e658a193279697699da3343b7246fcf1822360`
- `R2-RED.json`: `b2c0ea34e1dbaf823b4d820269fbdfd0d4a0dce83a7d2a5c919f04e95d1c8d6e`
- `R2-GREEN.tap`: `82a9c86d2764a0e00b4f17196c7e6baea95e24800f874e6b18a71862a46ed505`
- `R2-GREEN.json`: `18afd79a82a4bdf54cea652301172021a3640b5f8ac41538bb5d8df1751162eb`
- `R2-existing.tap`: `720a5ff9e4e8d97fbb15fd924c1d1e1fc0b198833cb806fcf137400fae3a63f7`
- `R2-existing.json`: `bbb4081af32bc199356699606722e738f709bf3773101cd0cdc045267732c705`

完整停止坐标/源码哈希/门状态见 `docs/evidence/1365-retire/R2-STOP.json`。原 R1 RED.tap/RED.json 未覆盖；STOPPED 原历史正文保留，本节追加。没有 commit/push/PR 或完成版 RECEIPT。

## R3 explicit resumption and stop closure

Owner 2026-11-08 的 R3 续派明确解除上节 Node 版本配方停点，其余失败即停红线继续生效。此追加是新结果，不改写 R1/R2 当时的实际停止状态。

原 existing 八文件以真实 `/usr/local/bin/node`（v25.6.1；execPath=/usr/local/Cellar/node/25.6.1_1/bin/node；x64）重跑：71/71、child/capture rc0；四文件其他面定向抽查 91/91、child/capture rc0；结构门 0 新违规/28 旧债务、rc0；独立 exact-candidate review PASS、0 open blockers/SPEC_GAP。详见 R3-* 证据及 RECEIPT-1365-RETIRE.md。

R2 existing failure=`CLOSED_BY_R3_EXISTING`，产品源码/回归哈希不变，R1/R2 八份原始 raw/json 哈希均与 R2-STOP.json 相等。实际源码已按续派授权提交为 `739fdd3434626b9b215fe1b1557689dfc1eea61b`，普通 push/未合并 PR 的结果以收据后续实际读回为准。当前仅解除已关闭停点，未授权任何新的失败后继续、合并或生产操作。
