# BRIEF-1366-LOCKTIMING-IMPL — WEC V4 锁时序实现（#1366 最小修复, 双writer硬门）

授权: Owner 审查增量③(第三优先)+裁定④(WEC V4 accepted: 有界解锁授权)+预授权V2 §5(§3B实施权由accepted Contracts承接)。
权威: AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4(accepted, main b6ddc2a6, PR#655 842行)——行为差量严格限两类读取(远端pre-plan/evidence采集期间释放admission lock→重新获取→精确校验前置→变化走既有拒绝路径)。
工作面: 本worktree(detach @ main b6ddc2a6)。node_modules已链(只验证)。零生产写入。
停止条件: 失败即停写STOPPED-1366-IMPL.md; SPEC_GAP同前例停。

## 环境配方
node_modules已预链(只验证); Node v26.7.0文件展开运行器(目录参数陷阱); 九键清洁env配方(HTTP_PROXY等九键会触发集成预检); Node v25.6.1在/usr/local/bin可用于要求v25.6.1的门; 全仓npm test结构性不可用作门; 噪声: stale-quiescence版本敏感断言不计门。

## 背景(矩阵+分析坐标)
- `packages/workflow-execution/src/ledger.js:106-112,258-270`: 同一ledger FIFO/OwnerLock跨策略/计划准备/解析/投递等await。
- `packages/scheduler/src/store/lock.js:290-297`: 部分实例持Domain排他锁跨远端等待。
- **#657分析已核**: #644的blocked自动恢复与planned恢复(本任务无关面)不共享这些锁面。
- **#1367已合(24974c72)**: 诊断读取已分离——本任务的锁面是admission/recovery写路径, 与诊断只读正交。

## 任务(逐项)
1. **RED基线**: 隔离持久存储双writer测试——writer A持锁做远端await期间, writer B(无关任务)无法推进(队头阻塞实测红)。
2. **最小实现(WEC V4 §有界解锁)**: 远端pre-plan/evidence采集期间释放admission lock→采集完成后重新获取→精确校验前置(观察坐标+代际/revision核对)→一致继续/变化走既有拒绝路径; **仅限两类远端读取调用模式**, 不外推其他锁持有段; 单writer/UNKNOWN/D-009边界不变。
3. **实际双writer硬门测试**(裁定④要求, 不能静态审查替代): 隔离持久存储双writer实测——A远端等待期间B推进成功→A完成后精确重检通过或拒绝——红→绿。
4. 回归: 既有全套件rc0(文件展开)+受影响面定向; 不动#1367诊断只读分离(已合正交面)。
5. 交付: 分支fix/wec4-lock-timing→push开PR(base main)不合并→RECEIPT-1366-IMPL.md(RED/GREEN原文+diff坐标+DONE_WHEN对照+双writer硬门原文)。
红线: 失败即停; 不动治理文档/.agents/tools; 不rebase; PR禁自合并; 锁架构整体重构不混入(仅两类读取)。

## Implementation preflight — 2026-11-08

- TARGET_REPOSITORY = mayf3/dsh-agent-core
- BASE_HEAD = b6ddc2a67ba041b8b13ed33d331104cf809d4985; CURRENT_BASE_HEAD = same at entry.
- ISOLATED_WRITE_SURFACE = /private/tmp/h1366-impl, fix/wec4-lock-timing.
- GOAL_OR_TARGET = eliminate admission head-of-line waiting only in the two WEC4 collection intervals, with exact locked validation and single-writer appends.
- CURRENT_GAP = engine detail/evidence collection currently runs inside ledger FIFO/OwnerLock.
- SPEC_GOVERNANCE_MODE = PREFLIGHT; AUTHORITY_ACTION = REUSE; PLAN_LEVEL = BRIEF; ASSURANCE_LEVEL = DURABLE.
- ROUTE_STAGE = IMPLEMENTATION; AUTHORITY_ACCEPTED_IN_BASE = YES; IMPLEMENTATION_AUTHORITY = contracts.
- PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V4 accepted-r4 at BASE_HEAD, CTR-WEC1-008 / CTR-WEC4-010, ACC-WEC4-002..005.
- RELATED_AUTHORITIES = Product Architecture V1, D-009, accepted PPR V1 / SRE V2 / Owner Workflows V2; existing recovery and diagnostic separation retained.
- MUTATION_AUTHORIZATION = VALID (Owner task reproduced above); EXECUTION_MANDATE = VALID; CONTROLLED_RUNBOOK_REQUIRED = NO (isolated source/test and authorized unmerged PR only).
- SPEC_GAP_DEPENDENCY = NONE found; LIVE_AUTHORITY_GAP = NONE observed; EVIDENCE_REVIEWABILITY = PASS via checked-in sanitized raw logs and executable fixtures.
- IMPLEMENTATION_ALLOWED = YES; MERGE_READY = NO until evidence and independent review; OPERATION_ALLOWED = NO.
- EVIDENCE_NEEDED = expected RED on unchanged product source, both real process GREEN intervals, stale local/external refusal, same-visit/case contention, crash/replay, existing explicit-file workflow/integration/broker gates and independent affected-contract review.
- DONE_WHEN = gates rc0, raw evidence and receipt persisted, branch pushed and PR against main open and unmerged.
- EXPANSION_TRIGGER = new protocol/DTO/lock service, changes outside the two collection reads, authority conflict, or unexpected required-gate failure; stop dependent writes and record STOPPED-1366-IMPL.md.
- NEXT_REAL_ACTION = capture expected RED using actual isolated persistent ledger and two writers; an expected RED observation is the requested baseline, not an unexpected gate failure.

Implementation boundary: capture policy, positive reconciliation/quiescence and Principal resolution under the existing lock; release FIFO and OwnerLock only for detail/evidence collection; reacquire through existing mutate/fresh replay, compare detached relevant predecessor and budget/proof facts, then use existing canonical due feed plus target-Principal detail for fresh dispatch/identity/version validation. Final validation may wait under lock and its timing must be reported. Original completion callback, WAL, delivery, dispatch-time capture and restart checks stay held.

Regression recipe: explicit files from docs/evidence/1367-readsep/r7/{workflow,integration,broker}.json; workflow v26.7.0, integration/broker v25.6.1. Remove HTTP_PROXY, HTTPS_PROXY, http_proxy, https_proxy, ALL_PROXY, all_proxy, NO_PROXY, no_proxy, NODE_USE_ENV_PROXY from test children only. Historical stale-quiescence.test.js is excluded, not passed. No npm-test directory discovery, dependency install, production write or runtime reload.

## R2 continuation — single failed test, 2026-11-08

Owner's current task resumes the R1 failure-stop only to diagnose and correct the
single `engine.test.js:421` failure, obtain the existing 333-test gate rc0 and
affected-suite rc0, then commit/push/open an unmerged PR against main and finish
`RECEIPT-1366-IMPL.md`. Any new unexpected required-gate failure stops delivery.
No rebase, source expansion, diagnostic-read change or production apply.

Route remains REUSE / BRIEF / DURABLE / IMPLEMENTATION under the same accepted
WEC4 and PPR Contracts; base b6ddc2a67ba041b8b13ed33d331104cf809d4985,
R1 head 51149193bc811fff26b2a9afbccad9937e626720. Fresh GitHub compare on R2
entry reports main identical to base; #655 and #657 are merged in that order.
The same isolated branch/worktree remains the single write surface.

Diagnosis: R1 raw failure is `engine.test.js:430` (ledger row count 0), while
`:429` (`admissions.length === 1`) passed. The fixture supplies malformed and
valid rows with the same dispatch ID on every feed read. WEC4
`CTR-WEC4-010` steps 2/4 and refusal (Spec lines 563–598) forbid treating that
malformed/ambiguous canonical read as equality. PPR `CTR-WAE-001` (lines
679–688) still requires malformed scan rows to be skipped loudly. No product
or admission-count behavior is changed: update this test to assert both the
initial refusal with zero plan/delivery and the later ordinary clean sweep's
fresh successful admission. Independent read-only diagnosis: agent
`/root/diagnose_counter`, agreement on both authority coordinates and repair.

R1 raw logs and STOPPED receipt remain historical; R2 gate outputs go under
`docs/evidence/1366-locktiming/r2/` to preserve the original 332/333 rc1.
Unchanged R1 product/fixture hashes permit explicit rebind of already-passed
37-test GREEN and two-writer RED evidence; no unchanged mechanism is rerun
solely for a receipt/test Head change. Independent affected-Contract review and
final-Head delta check remain required before the delivery is complete.
