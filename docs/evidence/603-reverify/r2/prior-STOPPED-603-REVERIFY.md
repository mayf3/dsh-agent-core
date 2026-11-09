# STOPPED-603-REVERIFY

```text
STATUS = STOPPED_REQUIRED_REVIEW_FAILURE
STOP_REASON = 603-REVIEW-001 / CONTRACT_VIOLATION / CONCRETE_REGRESSION
DATE = 2026-11-07 (Asia/Shanghai)
WORKTREE = /private/tmp/h603-reverify
BRANCH = ac-ctr-s4-reverify
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
HEAD = 91e224bc079f26cef285cba6da0872cb640ed330
CANDIDATE = HEAD + preserved uncommitted working diff (UNVERIFIED)
STAGE_A = COMPLETE (18 commits; committed assessment)
STAGE_B = INCOMPLETE / STOPPED
FROZEN_BLOCKER_UNION = [603-REVIEW-001]
CONTRACT_REVIEW = FAIL (independent source review; no process rc)
MERGE_READY = NO
PUSH_READY = NO
PRODUCTION_WRITES = 0
```

用户 BRIEF 明定“失败即停写 STOPPED-603-REVERIFY.md”。本次在独立受影响合同审查失败时停止：不修复产品、不再运行门、不提交未验证产品、不 push、不更新 PR603、不 merge。所有产品和测试修改保留为本 worktree 的未提交候选。仅补本停止记录、事实收据和坐标绑定的证据快照。

## 603-REVIEW-001：规划读取引入自动迁移写入

独立审查者 `/root/audit_gates`（未编写产品 delta）；根 agent 源码复核后接受此阻断。此前以“正常启动后的输入为 V3”排除该路径的临时判断已撤回，不作为通过结论。

- 当前候选 `packages/production-runtime/src/scheduler/auto-reconcile-runtime.js:47` 从 base 的 raw snapshot 读取改成 `await store.loadDoc({ force: true })`，在返回后才检查 stopped/configured，再查询政策证据。
- `packages/scheduler/src/store.js:362–365` 在 v1/v2 上调用 `ensureUpgraded()`；`store/store-migration.js:44` 的该方法走 mutateDoc，产生备份/sidecar、升级文档、原子提交和迁移日志。
- `composition-runtime.js:44` 在 compose 时已挂 timer；正式 runtime `.start()` 和可选 schedulerHealth/readiness 检查发生在之后。mount 不要求 V3 输入，不能用已启动假设排除 pre-start 路径。
- 可达输入：合法 V2 store 包含 recurring UNKNOWN/fence；flag=on；Router 接口存在但 exact readback 为 `never_existed`。timer 先触发 store 升级写入，随后 planner 才零目标。迁移 await 期间 OFF/stop 也只能等待后复查，无法阻止该写入。
- 这违反 accepted alignment `CTR-527D2-002/003` / `ACC-527D2-004` 的缺证据原始字节零写要求；C-033 的正式迁移前提也没有由自动规划路径建立。base 的 raw 读取没有该副效应。

这是源码调用链支持的具体反例，**尚未执行故障注入**，不冒称实际生产或隔离运行已发生迁移。main 的 D-009 三态 writer 没改；没有重新引入 termination-only→failed。

## 后续门

结构 V3、变化测试、Scheduler 全套、Scheduler-Router、EKR/B2、D-009动态符合性、syntax/governance/diff gates 均 **NOT_RUN**；没有 rc0/rc1 可报告，未执行反例。审查 FAIL 没有 shell rc，不能伪造“全门 rc0”。零远端写入；PR603 原 head 保持 `815ac7c9`，本地新分支尚未推送。

最小续行闭合（仅供后续授权，不在本轮执行）：规划改用非迁移只读 snapshot 并对 legacy fail closed，或将 loop admission 绑定正式启动完成的合法升级；增加 legacy+缺证明及异步读期间 OFF/stop 的字节不变测试。新 SHA 下按计划执行受影响门与独审；既有阶段 A 不重做。完整事实见 [收据](RECEIPT-603-REVERIFY.md)。
