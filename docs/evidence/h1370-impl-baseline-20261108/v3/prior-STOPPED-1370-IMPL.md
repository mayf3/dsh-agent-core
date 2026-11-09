# STOPPED-1370-IMPL

状态：**STOPPED v2 — 已重装依赖并注入 NGC_HARNESS_ROOT；同一基线仍 177 PASS / 3 FAIL，未开始产品实现。**

当前结论及续办坐标见文末“v2 续办结果”；以下 v1 原始记录保留为历史证据。

## 授权、坐标与停止依据

- 任务：按根目录 `BRIEF-1370-IMPL.md` 实施 #1370；该简报及本轮用户指令均要求“失败即停”。简报明确“实施前先证明测试可跑”“先跑基线再动手”；用户同时要求取得基线 PASS 原文再动手。
- Worktree：`/Users/yanfenma/workspace/project/worktrees/h1370-impl`
- Branch：`fix/1370-generation-policy-impl`
- HEAD / implementation base / 本轮 remote main 只读核验：`95a8e1cb512fc99dc018209d837250dd51b4d08f`。
- 主权威：accepted `AGENT_CORE_ROUTING_CONFIG_GENERATION_POLICY_V1`，`implementation_authority: contracts`，`production_apply_authority: none`；实施范围 CTR-RCG-001..006 + ACC-RCG-001..006。
- 已完整读取 Brief、AGENTS.md、.agents 入口、spec-governance Skill/PREFLIGHT、政策与 SEMANTIC-VERIFY-1370；已读取架构和直接相关继承合同。未发现需要本次实现裁定的路由权威冲突。
- 记录时间：`2026-11-08T04:01:25.189783+00:00`。

## 实际环境动作

1. `/usr/local/bin/node --version` 输出 `v25.6.1`，rc 0。
2. 发现原 `node_modules` 是指向 `/private/tmp/dsh-ekr-p1-new/node_modules` 的符号链接，且 `@deepseek-ai/schemastery` 不存在。依简报允许的机械安装范围，仅移除本 worktree 的链接（未更改链接目标目录），执行独立安装：

```sh
env PATH="/usr/local/bin:$PATH" npm install --no-package-lock --no-audit --no-fund
```

安装 rc 0，原始输出见 [install.log](docs/evidence/h1370-impl-baseline-20261108/install.log)。未更改 package.json，未生成或更改 lockfile。停止后的 readback 发现原 node_modules 链接受 Git 跟踪；为恢复该机械环境改动，将独立安装完整移动保留至 `/private/tmp/h1370-impl-dependencies-nbpbsmqp/node_modules`，随后按 HEAD 原字节恢复原链接，未改动其外部目标。该缓存供后续环境续接，不代表基线已通过。

3. 在任何产品源码/测试修改之前，使用文件展开运行既有 route 套件：

```sh
/usr/local/bin/node --test packages/agent-router/test/route-chain/*.test.js
```

实际 rc **1**。180 tests / 177 pass / 3 fail / 0 skipped；以下为原始结尾输出，完整原文保存在 [baseline-route.log](docs/evidence/h1370-impl-baseline-20261108/baseline-route.log)。没有 catch-and-skip、过滤失败测试、重跑较小范围充当基线 PASS 或修复失败后继续实施。

```text
ℹ tests 180
ℹ suites 0
ℹ pass 177
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7899.140333

✖ failing tests:

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:14:1
✖ scripted native rounds obtain fresh parent proof after prior settlement through real child transport (4.245166ms)
  AssertionError [ERR_ASSERTION]: paired native build is required; this conformance test must not silently skip
      at TestContext.<anonymous> (file:///Users/yanfenma/workspace/project/worktrees/h1370-impl/packages/agent-router/test/route-chain/native-goal-composed.test.js:15:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1118:25)
      at Test.start (node:internal/test_runner/test:1015:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43
✖ real child timeout removes native queued admission before old owner release (254.689166ms)
  Error: agent agt_cancel-source (generation 1) RPC initialize rejected: AGENT_PROCESS_EXITED
      at AgentProcess.rejectAllPending (file:///Users/yanfenma/workspace/project/worktrees/h1370-impl/packages/agent-router/src/process/rpc-channel.js:358:35)
      at AgentProcess.onChildExit (file:///Users/yanfenma/workspace/project/worktrees/h1370-impl/packages/agent-router/src/process/spawn.js:143:10)
      at ChildProcess.<anonymous> (file:///Users/yanfenma/workspace/project/worktrees/h1370-impl/packages/agent-router/src/process/spawn.js:77:47)
      at Object.onceWrapper (node:events:623:12)
      at ChildProcess.emit (node:events:508:20)
      at ChildProcess._handle.onexit (node:internal/child_process:293:12) {
    code: 'AGENT_PROCESS_EXITED',
    agentId: 'agt_cancel-source',
    processGeneration: 1,
    method: 'initialize',
    evidence: { code: 1, signal: null }
  }

test at packages/agent-router/test/route-chain/native-goal-composed.test.js:74:43
✖ real child cancel removes native queued admission before old owner release (203.118ms)
  Error: agent agt_cancel-source (generation 1) RPC initialize rejected: AGENT_PROCESS_EXITED
      at AgentProcess.rejectAllPending (file:///Users/yanfenma/workspace/project/worktrees/h1370-impl/packages/agent-router/src/process/rpc-channel.js:358:35)
      at AgentProcess.onChildExit (file:///Users/yanfenma/workspace/project/worktrees/h1370-impl/packages/agent-router/src/process/spawn.js:143:10)
      at ChildProcess.<anonymous> (file:///Users/yanfenma/workspace/project/worktrees/h1370-impl/packages/agent-router/src/process/spawn.js:77:47)
      at Object.onceWrapper (node:events:623:12)
      at ChildProcess.emit (node:events:508:20)
      at ChildProcess._handle.onexit (node:internal/child_process:293:12) {
    code: 'AGENT_PROCESS_EXITED',
    agentId: 'agt_cancel-source',
    processGeneration: 1,
    method: 'initialize',
    evidence: { code: 1, signal: null }
  }
```

## Blocker 与完成状态

- `CLASS = REQUIRED_GATE_FAILURE`
- `SOURCE = BRIEF-1370-IMPL.md 环境事实及失败即停；用户关键纪律 2/6`
- `COUNTEREXAMPLE = native-goal-composed.test.js:15 requires paired native build; two initialize calls exit with AGENT_PROCESS_EXITED`
- `IMPACT = 本次既有 route 套件基线非 PASS，实施前置门失败`
- `MINIMAL_CLOSURE = 后续明确授权的环境准备任务提供所需 paired native build/fixture 环境，复跑相同既有套件取得完整 PASS 原文；然后按新续接授权恢复实施。该缺失前置未在本轮修补，native build 的具体绑定仍待核验。`
- `affected_readiness = IMPLEMENTATION_ALLOWED:NO, MERGE_READY:NO`

| 项目 | 实际状态 |
| --- | --- |
| RE_PREFLIGHT route | REUSE / IMPLEMENTATION / contracts / DURABLE；执行门因基线失败关闭 |
| 产品源码、测试、accepted Spec | 无修改 |
| 实现 commit | 未创建 |
| ACC-RCG-001..006 与新增反例测试 | NOT_RUN；未开始编写，无 PASS 声称 |
| 受影响 loader / Default / GPT6 完整回归 | NOT_RUN；不以其他套件结果替代失败基线 |
| IMPL-RECEIPT-1370.md | 未创建；本报告为停止记录，不是实施完成收据 |
| push / PR(base main) | NOT_RUN；未创建实现 PR、未合并 |
| 生产配置、进程、账本、Svc | 零写入；未执行部署、重启、恢复或生产操作 |

当前只新增本停止报告及本轮原始环境/基线证据。未达到任务完成定义，不能标为已实现或已交付。

## 原始证据完整性

证据目录：`docs/evidence/h1370-impl-baseline-20261108/`；机器坐标见 `coordinates.json`。

| 文件 | Bytes | SHA-256 |
| --- | --- | --- |
| `install.log` | 236 | `6e7b05696c84cbcf5a1addbdddad8d861799f2e9d4e6c70a37e96d987704253c` |
| `baseline-route.log` | 31896 | `21b7af30696c046f3095f5a2a5b9c0f4af91ba5626b214113ffc995d1f7f60e6` |


## v2 续办结果（2026-11-08，当前有效停点）

### 授权与坐标

- 本轮授权为用户续办指令及 `BRIEF-1370-IMPL.md` v2：“若注入后仍失败 → 再停写 STOPPED（新证据 = harness 版本配对问题，需配对分析，不盲目重试）”。本轮严格按此条件停止；未开始 CTR-RCG 产品实施。
- 路由沿用 `REUSE / BRIEF / DURABLE / IMPLEMENTATION`；`AUTHORITY_ACCEPTED_IN_BASE=YES`，`IMPLEMENTATION_AUTHORITY=contracts`。accepted 政策及本轮远端 main 只读核验仍为 `95a8e1cb512fc99dc018209d837250dd51b4d08f`，未发现本任务依赖的权威冲突。执行门因基线仍失败关闭，`IMPLEMENTATION_ALLOWED=NO`、`MERGE_READY=NO`、`OPERATION_ALLOWED=NO`、`NEXT_ACTION=STOP`。
- Worktree `/Users/yanfenma/workspace/project/worktrees/h1370-impl`；branch `fix/1370-generation-policy-impl`；HEAD 未变。
- `/usr/local/bin/node` 为 `v25.6.1`；`NGC_HARNESS_ROOT=/Users/yanfenma/workspace/github/deepseek-harness`；harness HEAD 为 `514ab7b0029141b88c807704764d0d3e1eea1da4`；driver `lib/index.js` 存在。

### 实际动作与原文

1. 仅移除本 worktree 的受跟踪 `node_modules` 符号链接，未触碰原链接目标；按 v2 重新执行：

```sh
env PATH="/usr/local/bin:$PATH" npm install --no-package-lock --no-audit --no-fund
```

rc **0**，完整输出为：

```text

added 71 packages in 4s

```

依赖目录留在本 worktree，`@deepseek-ai/schemastery` 已存在；不依赖 `/private/tmp` 缓存。`package.json`、锁文件及 Git index 未改。Git 当前显示 ` D node_modules`，这是受跟踪旧符号链接已移除、本地目录被既有 ignore 规则忽略的环境差量；没有暂存或提交该删除，也没有恢复链接、搬走依赖。

2. 注入变量后只重跑一次同一基线，未过滤测试、未 catch-and-skip、未缩小套件冒充 PASS：

```sh
NGC_HARNESS_ROOT=/Users/yanfenma/workspace/github/deepseek-harness /usr/local/bin/node --test packages/agent-router/test/route-chain/*.test.js
```

开始 `2026-11-08T06:35:30.955566+00:00`，结束 `2026-11-08T06:35:38.741358+00:00`，rc **1**。原文结尾统计：

```text
ℹ tests 180
ℹ suites 0
ℹ pass 177
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7654.42725
```

三项失败均位于 `native-goal-composed.test.js`，全部为：

```text
NATIVE_GOAL_PROTOCOL_UNAVAILABLE: native goal admission protocol is unavailable
```

- `:14:1` scripted native rounds obtain fresh parent proof after prior settlement through real child transport
- `:74:43` real child timeout removes native queued admission before old owner release
- `:74:43` real child cancel removes native queued admission before old owner release

完整测试输出（含全部 180 项、三项错误原文及堆栈）保存在 [v2/baseline-route.log](docs/evidence/h1370-impl-baseline-20261108/v2/baseline-route.log)；坐标及退出码见 [v2/coordinates.json](docs/evidence/h1370-impl-baseline-20261108/v2/coordinates.json)。原 v1 的安装/失败输出未覆盖。

### 新证据与最小闭合

**Observation：** 缺变量的首项断言与 child 初始化退出已不再出现，三项现在均进入 native protocol gate 后失败。fixture 明确从给定 harness root 的 `lib/index.js` 导入 driver，并请求 `enqueueMode: external`。Core `packages/demo-server/src/native-goal-admission.js:17–18` 要求 `parentVersion === 1`、`driver.protocolVersion === 1`、`driver.enqueueMode === 'external'`；`index.js:254` 从 `ctx.get('goalRoundDriver')` 取得 driver。当前 harness 的 driver `lib/index.js` 与 `src/index.ts` 均无 `protocolVersion|enqueueMode|goalRoundDriver|goalRoundEnqueue` 匹配（`rg` rc 1）；harness driver 路径的 Git status 为空，`lib/index.js` 不受 Git 跟踪。因此 HEAD 与文件存在性本身不能证明构建产物满足 Core 所需协议。只读命令及各自 rc、source/build 文件实测 hash 保存在 [pairing-readback.log](docs/evidence/h1370-impl-baseline-20261108/v2/pairing-readback.log)。

**Diagnosis：** 新失败证据支持 native harness/Core 协议版本配对问题，不能再归因于未注入 `NGC_HARNESS_ROOT`。具体合适的 paired source/build revision 尚为 UNKNOWN；本轮没有修补、重建、切换 harness 或盲目重试。

- `CLASS=REQUIRED_GATE_FAILURE`
- `SOURCE=用户续办指令；BRIEF-1370-IMPL.md v2 步骤②④；实施前基线 PASS 门`
- `COUNTEREXAMPLE=注入已核验 harness 后同一 180 项套件仍有三项 NATIVE_GOAL_PROTOCOL_UNAVAILABLE`
- `IMPACT=180 PASS 前置未满足，CTR/ACC-RCG 实施及其交付路径停止`
- `MINIMAL_CLOSURE=由配对分析任务给出与当前 Core native-goal protocol 对应的确切 harness source/build 身份及协议证据，随后在续接范围内复跑同一基线取得 180 PASS 原文；不得仅凭 driver 文件存在、HEAD 或重新 ACK 推断兼容`
- `affected_readiness=IMPLEMENTATION_ALLOWED:NO, MERGE_READY:NO`

### 当前完成状态

| 项目 | 当前事实 |
| --- | --- |
| 依赖重装、变量注入、同一基线重跑 | 已执行；install rc 0，baseline rc 1 |
| 产品源码、行为测试、accepted Spec | 零修改 |
| CTR-RCG-001..006 / ACC-RCG-001..006 / 新反例 | NOT_RUN；未实施，未声称通过 |
| 实现 commit / push / PR / merge | NOT_RUN；失败停点未进入实现交付路径 |
| IMPL-RECEIPT-1370.md | 未创建；STOPPED 不冒充完成收据 |
| 生产配置、进程、账本、Svc | 零写入；未部署、重启、恢复或操作生产 |
| node_modules | 本地安装目录留 worktree；旧链接删除为唯一 tracked 环境差量 |

### v2 原始证据完整性

| 文件 | Bytes | SHA-256 |
| --- | --- | --- |
| `v2/install.log` | 25 | `2c40dcedf18155ec3db9ca5a647250c7782598c6d0023e0fc361c1170803a91a` |
| `v2/baseline-route.log` | 33788 | `59dc2a85c9d755b604449de8392ef2da92ea410765c2c99ec6f182f05727cd27` |
| `v2/pairing-readback.log` | 2527 | `42ff4a9301e105383a98a47e91f158e446aec2660a8d2a79a067a840e1e35f13` |
| `v2/coordinates.json` | 1229 | `7db900b2aae6dd00b6e115c48ddfa641bd24482be7a2e714b90c7d95bd9e94d0` |
