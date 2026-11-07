# RECEIPT-603-REVERIFY — R3

```text
STATUS = STOPPED_REQUIRED_GATE_FAILURE
TASK_DONE = NO
STAGE_A = COMPLETE_PRESERVED
STAGE_B = INCOMPLETE
SPEC_GOVERNANCE_MODE = COMPLIANCE
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
IMPLEMENTATION_STATE = COMPLETE (selected source delta only)
VERIFICATION_STATE = PARTIAL
CONFORMANCE_RESULT = UNKNOWN (full applicable gates incomplete)
HEAD = 91e224bc079f26cef285cba6da0872cb640ed330
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed (fresh GitHub read during R3)
BRANCH = ac-ctr-s4-reverify
WORKTREE = /private/tmp/h603-reverify
VERIFICATION_SNAPSHOT = 0f25ce5270c0964476184af509c5857acbdf1527
VERIFICATION_TREE = 63534a3f954004da8967cd1284df8915d11d5603
FROZEN_BLOCKER_UNION = [603-REVIEW-001] (closed)
R2_ENVIRONMENT_ATTRIBUTION = CONFIRMED_BY_OWNER
OPEN_BLOCKER = 603-R3-GATE-001 / REQUIRED_GATE_FAILURE
PUSH_READY = NO
MERGE_READY = NO (not authorized)
OPERATION_ALLOWED = NO
PRODUCTION_WRITES = 0
COMMIT_TO_BRANCH = NOT_ATTEMPTED
PUSH = NOT_ATTEMPTED
PR_UPDATE = NOT_ATTEMPTED
MERGE = NOT_ATTEMPTED
```

R3 沿用阶段 A 与 R2 候选，**没有修改产品代码**。按 Owner 指定六键代理清理前缀，并选择本机已有 Node v25.6.1 后，变化门仍实际 rc1（40 项，27 PASS，13 FAIL）；13 项均被 `NO_PROXY: runtime_proxy_env_present` 拒绝。按本轮末尾“失败即停照旧”停止后续门、commit、push 和 PR 写入，只保存事实和只读审查。因此本文件是停止收据，不是全部完成或交付 PASS。

## 授权、源码绑定与历史保留

[R3 授权](BRIEF-603-REVERIFY.md)保留 `REUSE + EXEC_PLAN + DURABLE` 与 `IMPLEMENTATION` 范围；accepted D-009、CTR-527D2-001..004、DEFAULT OFF、唯一 writer、UNKNOWN 与无 replay 不变。R2 收据和停止记录按原字节保存为 [prior receipt](docs/evidence/603-reverify/r3/prior-RECEIPT-603-REVERIFY.md) / [prior stopped](docs/evidence/603-reverify/r3/prior-STOPPED-603-REVERIFY.md)，R1 记录仍在 r2/prior-*。

启动前逐一计算六个产品/测试/installer 文件 SHA256，并将其工作字节与 R2 验证 snapshot 的 Git blob 实际比较，全部相同。R2 已通过的源码独审和结构门可复用，未重做修复。snapshot 是无 ref 的验证 commit 对象，分支 HEAD 仍为阶段 A；不能称为本轮正式交付 commit。R3 的 Brief、收据及证据不在旧验证树中，运行坐标绑定相同产品字节，不声称文档也在旧树内。

- 六产品文件 hash/blob/行数保持 [R2 coordinates](docs/evidence/603-reverify/r2/candidate-coordinates.json) 不变。
- 四产品 diff SHA256=`0648557ec25d8be06447fff0b29ff9af61bc234ab0fcaa5170fcc3f333c0b5ad`，本轮独立审查复核相同。
- 本轮实际使用 `/usr/local/bin/node` → `/usr/local/Cellar/node/25.6.1_1/bin/node`，实测 `v25.6.1`；无依赖安装，无主机 PATH/代理配置修改。
- R3 fresh GitHub main commit 查询读回 `1ff1e81cbd74a51761dab46a5fcee532c41fe4ed`，与 base 相同。PR603 只读查询仍 OPEN、merged=false、旧 head `ac-ctr-s4-runtime-prep` / `815ac7c94b1775eec3aa57f19ca8a3842f592217`。响应摘要另存 readback 文件。

## Proxy 环境处置与有效负向证据

用户指定前缀已**逐字按六键执行**；测试子进程再设置 `PATH=/usr/local/bin:$PATH`，两个 EKR SHA 绑定旧验证 snapshot。完整实际 argv、时间、rc 和 hash 见 [command.json](docs/evidence/603-reverify/r3/changed-runtime.command.json)。没有打印代理地址、凭据或其他 env 值。

```sh
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy   PATH="/usr/local/bin:$PATH"   EKR_SOURCE_SHA=0f25ce5270c0964476184af509c5857acbdf1527   EKR_TEST_SOURCE_SHA=0f25ce5270c0964476184af509c5857acbdf1527   node --test packages/production-runtime/test/scheduler/scheduler-invoker-canary.test.js packages/production-runtime/test/compose.test.js packages/production-runtime/test/workflow-execution-shutdown.test.js
```

`packages/agent-router/src/process/env.js:13-23` 的 `RECOGNIZED_PROXY_ENV_KEYS` 共九键，额外包括 `NO_PROXY`、`no_proxy`、`NODE_USE_ENV_PROXY`。当前 shell 前两者存在、后者不存在；六键清理仍非 guard 所需的完全清洁环境。主 agent 开跑前漏核了完整清单；并行只读清单审查在命令运行期间确认了此事实，没有据此偷偷改命令或重跑。

R2 `HTTP_PROXY` 拒绝原文完整保留于 [stdout](docs/evidence/603-reverify/r2/changed-runtime.stdout.log)，SHA256=`e85b02077794a5111c30c28446d10e21b66e63b2bda9a089c0912ae22c543814`。按 Owner 裁定，它是 guard 拒绝继承代理 env 的有效负向证据。R3 的 `NO_PROXY` 拒绝再次直接证明同一前置守卫有效；这两项负向机制证据不能代替组合门 rc0。

最小后续环境前缀如下，**本轮未执行**：

```sh
env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u ALL_PROXY -u all_proxy   -u NO_PROXY -u no_proxy -u NODE_USE_ENV_PROXY PATH="/usr/local/bin:$PATH" <原门命令>
```

不得修改 guard、mock 版本或全局修改主机环境来闭合。

## 本轮实际门、完整原文与停止范围

| 门 | 实际结果 | Evidence |
|---|---|---|
| R2 零写修复与独立源码审查 | 保持 PASS，产品字节未变；本轮不重做源码修复 | [R2 source review](docs/evidence/603-reverify/r2/independent-source-review.md) |
| R2 structure | 复用 rc0；candidate violations=0，baseline debt=28，resolved debt=0；本轮未重跑 | [R2 command](docs/evidence/603-reverify/r2/structure.command.json) / [完整 stdout](docs/evidence/603-reverify/r2/structure.stdout.log) |
| R3 changed-runtime | **rc1 / 40 total / 27 pass / 13 fail** | [command](docs/evidence/603-reverify/r3/changed-runtime.command.json) / [完整 stdout](docs/evidence/603-reverify/r3/changed-runtime.stdout.log) / [完整 stderr](docs/evidence/603-reverify/r3/changed-runtime.stderr.log) |
| 独立 D-009 affected writer 静态审查 | PASS，0 blocker / 0 Spec gap；无 shell rc | [D-009 review](docs/evidence/603-reverify/r3/independent-d009-review.md) |
| 独立本轮日志复核 | 见持久化 review；不替代失败门 | [gate review](docs/evidence/603-reverify/r3/independent-gate-review.md) |
| installer bash -n / 精确 blob 命令门 | NOT_RUN；已知旧 blob 相同不冒充新命令 rc0 | 失败即停 |
| Scheduler 全套 | NOT_RUN | 失败即停 |
| Scheduler-Router 全套 | NOT_RUN | 失败即停 |
| EKR observation-cas / Broker / workflow / runtime 指定套件 | NOT_RUN；SHA env 存在不代表套件通过 | 失败即停 |
| 完整 D-009 动态符合性 | NOT_RUN；本轮 runtime 子用例和独审静态 PASS 只作部分证据 | 失败即停 |
| syntax / governance / whitespace / final HEAD 复审 | NOT_RUN，无最终交付 HEAD | 失败即停 |

本轮未改写的原始 summary：

```text
ℹ tests 40
ℹ suites 0
ℹ pass 27
ℹ fail 13
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10511.528
```

本轮实际 V2 零写子用例输出：

```text
✔ CTR-S4 V2 load without trusted evidence is pure and preserves the store hash and all files (17.887209ms)
ℹ V2 missing-evidence SHA256 before=10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df after=10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df; mutations=0; upgrades=0
✔ CTR-S4 malformed load returns UNKNOWN without normalizing or writing its bytes (18.946917ms)
```

这些是失败整门内实际 PASS 子用例，不是独立命令 rc0。13 个组合入口均在 compose 的 assertTargetProxyRuntime 提前拒绝，未到达完整接线/stop/drain 断言。stdout SHA256=`322961da1758057ceef5526e234a66575c30f78056cf784123d37005f6f3e65c`；stderr 为空、SHA256=`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。UTC：2026-11-07T04:43:19.129300+00:00 至 04:43:29.874522+00:00。

## 阶段 A 逐 commit 处置（R2 原表保留）

以下沿用阶段 A 的原处置和 R2 的实际集成状态，R3 没有任何新产品增量；其中“compose 被环境 guard 拒绝”在本轮仍成立，不能升级为完整动态 PASS。


| 源commit | 分类 | R2当前实际结果 |
|---|---|---|
| `bd8f74c4` | c 范围外 | native env seam未整合，不声称main已覆盖 |
| `09c7e8b4` | c 范围外 | history env seam未整合 |
| `c0ec3c27` | b | TEMP diagnostic与revert净零，不整合 |
| `c50484b5` | b | main已覆盖moderator清理，不重复修改 |
| `4114c55e` | b | 精确revert，无独立残余 |
| `f9e02f87` | b | main已覆盖bind containment，不重复修改 |
| `e9a61dee` | c 范围外 | history retry及close/timer适配另案，未整合 |
| `1921f879` | c 范围外 | structured diagnostic安全适配另案，未整合 |
| `5049c6cd` | b | 作废D-009 failed增补未引入 |
| `67d2bb08` | a | 精确whitelist已在候选，blob=356899a8ec0726f245790379429f97dfc6ea3bfb、mode100644、1315行；结构门命中exact exception；未运行installer |
| `32f12a07` | b | 历史日志保留source Git对象，不复制旧PASS |
| `792127d5` | b | 复用main当前UNKNOWN/零写政策，不重建旧watchdog policy |
| `06fc0737` | b | 旧attribution仅历史保留 |
| `8dfd2854` | c 部分保留 | 生命周期/动态OFF/单inFlight/period/receipt drain在当前helper落地；runtime用例PASS，compose被环境guard拒绝，完整集成未验证 |
| `3b61dd1b` | b | 旧r3/pin-stop日志仅历史保留 |
| `4c24a9d5` | b | 旧decoder pin未引入；snapshot不改 |
| `e8b086e8` | b | 旧733行registry条目未引入；registry不改 |
| `815ac7c9` | b | 旧failed接受元数据/packet不移植；本收据独立如实记录 |


## D-009 与未覆盖面

独立 `/root/d009_audit` 核对当前唯一 policy、occurrence、自助/operator 和 Router readback writer。termination-only 只追加 `terminationSettlement` 与 UNKNOWN→UNKNOWN history；business failed 只由可信 exact failure 或既有合法业务/操作者结算选择；锁内复验、NoWrite 与 aggregate fence 保留。具体文件行、四项 accepted authority Git blob 坐标见静态 review；未发现 termination-only→failed 写入路径，不等于全套动态符合性通过。

`603-R3-GATE-001` 的 SOURCE 是本轮全门 rc0 和失败即停要求，COUNTEREXAMPLE 是本轮实际变化门 rc1；IMPACT 为 STAGE_B_COMPLETE / DELIVERY_READY / PUSH_READY = NO；MINIMAL_CLOSURE 是在续行授权下用九键完全清洁子进程环境重跑变化门，再依阶段 A 顺序续全部 NOT_RUN 门。没有权威冲突或已证实的产品回归。

四项范围外 carryover、28 项结构债仍保留。没有提交、push、更新/关闭/合并 PR，没有安装、部署、启用、业务请求或 UNKNOWN 重放。源码静态 PASS、纯读子用例 PASS、结构 candidate delta PASS 与运行时/业务验收分别报告，不互相替代。完整恢复入口仍为本 worktree 原候选和本收据。
