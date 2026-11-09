# STOPPED-603-REVERIFY — R2

```text
STATUS = STOPPED_REQUIRED_GATE_FAILURE
TASK_DONE = NO
DATE = 2026-11-07 (Asia/Shanghai)
WORKTREE = /private/tmp/h603-reverify
BRANCH = ac-ctr-s4-reverify
HEAD = 91e224bc079f26cef285cba6da0872cb640ed330
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed (fresh GitHub readback)
VERIFICATION_SNAPSHOT = 0f25ce5270c0964476184af509c5857acbdf1527
VERIFICATION_TREE = 63534a3f954004da8967cd1284df8915d11d5603
SNAPSHOT_ROLE = unreferenced verifier commit object; not branch/delivery commit
STAGE_A = COMPLETE_PRESERVED
STAGE_B = INCOMPLETE
FROZEN_BLOCKER_UNION = [603-REVIEW-001] (closed)
OPEN_BLOCKER = 603-R2-GATE-001 / REQUIRED_GATE_FAILURE
CONTRACT_REVIEW = PASS (source delta)
STRUCTURE_GATE = rc0 / candidate violations 0 / visible baseline debt 28
CHANGED_RUNTIME_GATE = rc1 / 40 tests / 27 pass / 13 fail
PUSH_READY = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
PRODUCTION_WRITES = 0
COMMIT_TO_BRANCH = NOT_ATTEMPTED
PUSH = NOT_ATTEMPTED
PR_UPDATE = NOT_ATTEMPTED
```

本轮Owner授权修复R1零写阻断并续阶段B，同时保留“失败即停”。首次required命令门失败后停止后续门、源码修复、正式commit、push和PR写入；仅只读归因并补事实收据。未清理或修改主机代理环境，未绕过production guard，未重跑。

## 603-R2-GATE-001

- CLASS: REQUIRED_GATE_FAILURE。
- SOURCE: ASSESSMENT阶段B第2门及本轮Owner“失败即停”执行边界。
- COUNTEREXAMPLE: 变化/compose/shutdown完整命令实际rc1，13项在compose `assertTargetProxyRuntime()` 提前抛出 `AGENT_MODEL_OVERRIDE_INVALID`，消息均为 `HTTP_PROXY: runtime_proxy_env_present`。
- IMPACT: 完整组合/drain动态门未通过，不得声称全门rc0或提交/推送交付；不是已证实的本次产品回归。
- MINIMAL_CLOSURE: 续行授权下使用满足既有guard的隔离测试环境重跑失败门，再续NOT_RUN门；所有recognized proxy环境键须不存在，Node须精确v25.6.1。当前实际v26.7.0，本轮第一失败为HTTP_PROXY，去代理后的Node失败未执行。不得修改生产guard闭合。
- affected_readiness: STAGE_B_COMPLETE / DELIVERY_READY / PUSH_READY = NO。

原始argv、UTC、rc、完整stdout/stderr及hash：[失败命令记录](docs/evidence/603-reverify/r2/changed-runtime.command.json)、[完整stdout](docs/evidence/603-reverify/r2/changed-runtime.stdout.log)。

原603-REVIEW-001已闭合：自动规划纯 `_readDocRaw()`，legacy/解析失败返回UNKNOWN，不调用自动迁移loadDoc；未改全局Store/decoder。V2缺证据负向实际PASS，前后SHA256均为 `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`，mutation/upgrade=0且目录hash集合不变。其他runtime三态/UNKNOWN/OFF/stop等用例PASS；不是完整组合门通过。

结构V3实际rc0，0新违规、28项可见债，installer exact tuple命中。独立源码审查PASS，独立日志复核判定required gate失败，均保存在[r2证据目录](docs/evidence/603-reverify/r2/)。后续installer syntax、Scheduler、Scheduler-Router、EKR/B2、完整D-009、syntax/governance/whitespace和final HEAD门全部NOT_RUN。

R1收据/停止记录已原字节保存在r2目录的prior-*文件中。当前完整事实见[RECEIPT](RECEIPT-603-REVERIFY.md)。
