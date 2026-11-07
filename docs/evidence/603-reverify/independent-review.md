# Independent affected-Contract review — stopped candidate

Recorded by root from `/root/audit_gates` final response. This is source-trace evidence, not an executed counterexample or test receipt. Reviewer did not author the product delta.

```text
REVIEW_TARGET_HEAD = 91e224bc079f26cef285cba6da0872cb640ed330 + working product diff
PRODUCT_DIFF_SHA256 = 1c65a0b85be434886c45514b180de860837f5bdd1a0f1147b13d5ba422a42947
REVIEWER_ID = /root/audit_gates
AUTHOR_INDEPENDENCE = PASS
FROZEN_BLOCKER_UNION = [603-REVIEW-001]
CONTRACT_REVIEW = FAIL
MERGE_READY = NO
PUSH_READY = NO
COUNTEREXAMPLE_EXECUTED = NO
TESTS_EXECUTED = NO
```

独立审查最终原文（产品 diff 哈希由 root 在停止后补绑，原审查坐标为 HEAD+working diff）：

> 独立审查结果：**REVISE，冻结 1 个阻断项，停止后续整合。** 我此前用“正常启动后是 V3”排除此路径的判断不成立；composition 在启动检查之前已经创建 timer。
>
> **603-REVIEW-001 — CONTRACT_VIOLATION**
>
> - **来源：** accepted alignment `CTR-527D2-002/003`、`ACC-527D2-004` 要求缺失或无效证据时 occurrence/jobs/fence 字节零写；`SCHEDULER_TIMEOUT_OUTCOME_V3 C-033` 的迁移另有 stop/drain/single-writer 前提。
> - **可达反例：** 合法 version 2 store 包含 recurring `outcome_unknown` 和 fence；auto-reconcile 已显式开启，Router 的两个接口存在，但 correlation 返回 `never_existed`。compose 已挂 timer、尚未调用 `.start()`。interval 进入 `auto-reconcile-runtime.js:47`，`store.loadDoc({force:true})` 经 `store.js:363` 调用 `ensureUpgraded()`，生成 backup/sidecar、添加 `recordSchemaVersion=2`、提交 version 3 并追加迁移 receipt。随后 planner 才因 schema/owner/证据不足选择零目标。**没有可信 reconciliation 证据，jobs.json 字节仍已变化。**
> - **停止/关闭变体：** 在 `loadDoc` 的异步迁移过程中设置 OFF 或调用 stop，wrapper 直到 await 返回才复查，无法阻止上述迁移提交。stop 能等待它完成，但不能兑现此处的零写边界。
> - **回归关系：** base 的 raw snapshot 读取没有自动迁移副效应。新 wrapper 将原本独立的迁移 writer 带入政策规划路径；main 的三态 settlement writer 本身未改。
> - **最小闭合，仅供下一次授权：** 规划使用不会迁移的只读 snapshot，并对 legacy store fail closed；或使 auto-loop 只在正式启动完成合法升级后运行。补充 legacy store + 缺证据，以及异步读期间 OFF/stop 的原始字节不变测试；绑定新 SHA，重测受影响门并独审。本轮不修复、不重跑。
>
> 其余已审生命周期路径成立：单 inFlight、锁内 evidence wrapper、已入场 commit/receipt drain、停止后 callback 拒绝，以及 compose 的 auto→workflow→scheduler→Router 排空顺序。未发现第二个具体阻断项。
>
> 本次审查仅作源码追踪，**未执行反例、测试或任何门，也未写文件**。
