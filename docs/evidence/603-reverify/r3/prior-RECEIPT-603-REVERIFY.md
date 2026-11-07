# RECEIPT-603-REVERIFY — R2

```text
STATUS = STOPPED_REQUIRED_GATE_FAILURE
TASK_DONE = NO
STAGE_A = COMPLETE_PRESERVED
STAGE_B = INCOMPLETE
HEAD = 91e224bc079f26cef285cba6da0872cb640ed330
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed (fresh GitHub readback)
BRANCH = ac-ctr-s4-reverify
WORKTREE = /private/tmp/h603-reverify
SOURCE_PR_HEAD = 815ac7c94b1775eec3aa57f19ca8a3842f592217
VERIFICATION_SNAPSHOT = 0f25ce5270c0964476184af509c5857acbdf1527
VERIFICATION_TREE = 63534a3f954004da8967cd1284df8915d11d5603
FROZEN_BLOCKER_UNION = [603-REVIEW-001] (closed)
OPEN_BLOCKER = 603-R2-GATE-001 / REQUIRED_GATE_FAILURE
PRODUCTION_WRITES = 0
COMMIT_TO_BRANCH = NOT_ATTEMPTED
PUSH = NOT_ATTEMPTED
PR_UPDATE = NOT_ATTEMPTED
MERGE = NOT_ATTEMPTED
```

零写修复、独立源码审查和新增负向实测通过；阶段B未完成。结构门rc0后，变化/组合门实际rc1（40项，27通过，13失败），按本轮“失败即停”停止，未提交交付、push或更新PR603。完整阻断见[STOPPED](STOPPED-603-REVERIFY.md)。阶段A `91e224bc` 及18项评估不重做、不改写。R1原收据和停止记录按原字节保存在[r2证据目录](docs/evidence/603-reverify/r2/)的prior-*文件中，R1 diff/坐标/独审均保留。

## 路线、实际修复与坐标

本轮Owner续行授权已持久化于[BRIEF](BRIEF-603-REVERIFY.md)。沿用 `REUSE + EXEC_PLAN + DURABLE / IMPLEMENTATION`；accepted CTR-527D2 evidence-gated、DEFAULT OFF和D-009当前三态不改，无Spec变更或生产操作。

规划读取改为现有纯 `store._readDocRaw()`，不调用会自动升级的 `loadDoc()`；其调用链只读文件、parse和内存校验。V1/V2返回 `UNKNOWN/store_requires_scheduler_upgrade`，V2格式和缺失identity原样保留；解析失败返回 `UNKNOWN/auto_reconcile_pass_failed`，不normalize落盘。C-033正式Scheduler启动迁移不属本自动读路径，未改其全局行为。只有合法V3才进入既有planner；configured显式开启、exact trusted current Router证据及锁内复验仍是settlement必要条件。Store/decoder/normalizer、Scheduler writer、snapshot、registry和D-009权威文件没有修改，没有引回termination-only→failed或重试/重放。

分支HEAD仍为阶段A `91e224bc`。结构verifier仅接受commit ref，因此创建无ref的验证commit对象 `0f25ce52`，parent=`91e224bc`，并未推进分支或将其作为已完成产品commit。所有已执行门绑定其源字节。随后收据/日志不在该验证树内，不能倒写进验证坐标。最终交付HEAD尚不存在。

- working diff SHA256：`a66f5396f2568e0e1f1989cbef7b7558124e38505f4134272e574b3a9c32cfa8`。
- 四产品文件独审diff SHA256：`0648557ec25d8be06447fff0b29ff9af61bc234ab0fcaa5170fcc3f333c0b5ad`。
- [原始候选diff](docs/evidence/603-reverify/r2/candidate-working.diff)及[逐文件SHA256/blob/行数、验证树、UTC](docs/evidence/603-reverify/r2/candidate-coordinates.json)。
- Node实测`v26.7.0`、npm`11.19.0`；使用已有依赖，未安装/修改依赖。
- [main新鲜读回](docs/evidence/603-reverify/r2/main-readback.json)与base相同。最初git ls-remote尝试没有保存可引用的完成结果，不据其声称rc0或远端状态；本次main坐标依据GitHub plugin实际响应。

## 阶段A逐commit实际处置

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

所有选定“仍相关/需适配部分”已由独审静态核对落地：installer exact tuple、loop handle返回、compose先drain loop再workflow/scheduler/Router、stop拒绝新工作并等待receipt、单inFlight、动态开关锁内复验、最小60秒周期。compose500行、canary383行、shutdown279行，没有新目录子项。源码落地与完整动态验证分开报告。

## 实际门与原文

| 门 | 结果 | 完整原文/命令/UTC/rc/hash |
|---|---|---|
| structure | **rc0** | [structure.command.json](docs/evidence/603-reverify/r2/structure.command.json) / [stdout](docs/evidence/603-reverify/r2/structure.stdout.log) / [stderr](docs/evidence/603-reverify/r2/structure.stderr.log) |
| changed-runtime | **rc1** | [changed-runtime.command.json](docs/evidence/603-reverify/r2/changed-runtime.command.json) / [stdout](docs/evidence/603-reverify/r2/changed-runtime.stdout.log) / [stderr](docs/evidence/603-reverify/r2/changed-runtime.stderr.log) |
| 独立affected-Contract源码delta | PASS，0新blocker/Spec gap；非shell命令，无rc | [源码独审](docs/evidence/603-reverify/r2/independent-source-review.md) |
| 独立日志复核 | REQUIRED_GATE_FAILURE，PUSH_READY=NO | [门结果独审](docs/evidence/603-reverify/r2/independent-gate-review.md) |
| installer bash -n及精确blob命令门 | NOT_RUN；blob仅只读核对，不冒称syntax门通过 | 失败后停止 |
| Scheduler全套 | NOT_RUN / rc=NOT_APPLICABLE | 失败后停止 |
| Scheduler-Router全套 | NOT_RUN / rc=NOT_APPLICABLE | 失败后停止 |
| EKR observation-cas、Broker、workflow、runtime指定完整面 | NOT_RUN / rc=NOT_APPLICABLE | 失败后停止 |
| 完整D-009动态符合性 | NOT_RUN；仅runtime三态等子用例PASS | 不能推导完整套件结果 |
| syntax/governance/whitespace、最终HEAD复审 | NOT_RUN / rc=NOT_APPLICABLE | 失败后停止，无最终交付HEAD |

结构门命令：

```sh
node scripts/verify-code-structure.mjs --base 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed --head 0f25ce5270c0964476184af509c5857acbdf1527 --json
```

实际 `rc=0`，`candidate_result=CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`，summary：`{"exit_code": 0, "in_scope_files": 980, "candidate_violations": 0, "baseline_debt": 28, "resolved_debt": 0}`。exact whitelist exception命中，28项历史债可见，不是全仓无债。

变化门命令：

```sh
node --test packages/production-runtime/test/scheduler/scheduler-invoker-canary.test.js packages/production-runtime/test/compose.test.js packages/production-runtime/test/workflow-execution-shutdown.test.js
```

实际rc1，原始summary：

```text
ℹ tests 40
ℹ suites 0
ℹ pass 27
ℹ fail 13
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10188.918042
```

新负向用例**原始执行输出**：

```text
✔ CTR-S4 V2 load without trusted evidence is pure and preserves the store hash and all files (19.856ms)
ℹ V2 missing-evidence SHA256 before=10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df after=10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df; mutations=0; upgrades=0
✔ CTR-S4 malformed load returns UNKNOWN without normalizing or writing its bytes (17.790167ms)
```

异步纯读OFF/stop、排队OFF、stop拒绝未来tick/等待receipt、success/failure/termination-only三态、late business append、UNKNOWN历史与aggregate fence也实际PASS。它们是失败整门内的子用例PASS，不是独立负向命令rc0，也不等于完整D-009符合性通过。

13个失败均在compose入口被 `AGENT_MODEL_OVERRIDE_INVALID / HTTP_PROXY: runtime_proxy_env_present` 拒绝；含新增compose drain用例，未到达挂载/内部drain断言。分类为required gate环境前提失败，不据此声称产品回归，也不能跳过当PASS。stderr为空，失败信息位于stdout。

`603-REVIEW-001` 已有源码和动态负向闭合；新 `603-R2-GATE-001` 的 SOURCE为Owner/ASSESSMENT全门rc0且失败即停要求；COUNTEREXAMPLE为上述实际rc1；IMPACT为完整组合门未通过；affected_readiness=[STAGE_B_COMPLETE, DELIVERY_READY, PUSH_READY]=NO。

最小后续须续行授权下使用满足既有guard的隔离测试环境：无所有recognized proxy环境键，Node精确`v25.6.1`，再重跑失败门并续NOT_RUN门。当前Node26与要求25.6.1的差异是静态前置条件；本轮先因HTTP_PROXY拒绝，未实测去代理后的版本失败。未修改主机环境或production guard，未重跑。

## 完整性与未覆盖面

结构stdout SHA256=`0a57b28a5f641d4f698300ef08ad7dfefebd30642bcf4026615a2a8355800b3c`；变化stdout SHA256=`e85b02077794a5111c30c28446d10e21b66e63b2bda9a089c0912ae22c543814`。两个stderr均为空，SHA256=`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。每门完整argv、开始/结束UTC、真实rc和日志hash见command.json。runner设置了EKR_SOURCE_SHA/EKR_TEST_SOURCE_SHA绑定验证snapshot，但EKR未执行，变量存在不代表套件通过。

正式commit、push、新分支远端读回、PR603更新均未进行；旧PR未关闭/合并。没有打包、installer执行、部署、启用、业务请求或旧UNKNOWN重放。四项范围外carryover、28项结构债及后续全部动态门仍未闭合。源码/部分离线验证不等于安装、运行时或业务验收。

恢复入口为本worktree当前候选、验证snapshot和本收据；保留阶段A，不重新引入D-009 failed死条文，不将部分PASS复制成全门通过。
