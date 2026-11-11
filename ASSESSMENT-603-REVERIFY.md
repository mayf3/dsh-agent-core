# #603 阶段 A 只读评估与阶段 B 整合计划

阶段 A 完成于 2026-11-07；本文件写入前仅作源码、权威、Git 与远端只读检查，未运行测试、未修改产品代码。授权原文见 [BRIEF](BRIEF-603-REVERIFY.md)。本文件是执行计划和观察，不创设产品权威。

## 坐标与路线

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/h603-reverify
BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
CURRENT_BASE_HEAD = 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed
SOURCE_HEAD = 815ac7c94b1775eec3aa57f19ca8a3842f592217
SOURCE_MERGE_BASE = 44da63d21987bf7115435f0767e7851b9022836a
SOURCE_COMMIT_COUNT = 18
AUTHORITY_ACTION = REUSE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts
EXECUTION_MANDATE = VALID (Owner task; local source, offline gates, push and PR603 update)
ISOLATED_WRITE_SURFACE = YES (new ac-ctr-s4-reverify from exact main above)
SPEC_GAP_DEPENDENCY = NONE (selected CTR-S4 delta)
IMPLEMENTATION_ALLOWED = YES (only after this assessment is persisted)
MERGE_READY = NO (not requested; gates and review pending)
OPERATION_ALLOWED = NO
PRODUCTION_WRITES = FORBIDDEN
NEXT_ACTION = CONTINUE
```

远端 `git ls-remote` 已读回 main 与 source HEAD 同上，目标新分支尚不存在。GitHub PR603 为 OPEN、18 commits。Brief 中的 `26178b4f` 是旧 PR 的 main 对比坐标，不是这 18 个提交的共同祖先；以 `git log --reverse 44da63d2..815ac7c9` 检视逐个 parent patch，避免将 main 演进的反向 diff 当成待整合工作。现有未跟踪 BRIEF 保留原文。

## 当前权威与范围

已读取 `.agents/README.md`、`.agents/local/README.md`、产品 Architecture、Decision index、D-009 相关完整状态/settlement 规则、有关 accepted governing Contracts、spec-governance router 与 PREFLIGHT 模式。

- 产品边界：`AGENT_CORE_PRODUCT_ARCHITECTURE_V1` 的薄组织层、Router 生命周期所有权、唯一现有 Scheduler/Store，不新增平行模型。
- D-009 `SCHEDULER_OCCURRENCE_OUTCOME_V3` §6/6.1 与 `SCHEDULER_TIMEOUT_OUTCOME_V3` C-001..004、C-026、C-038..046；`AGENT_DELIVERY_RESILIENCE_D009_ALIGNMENT_V1` CTR-527D2-001..004 / ACC-527D2-003 是当前政策解释。可信 termination-only 保持 business `outcome_unknown`，追加 terminationSettlement；缺证明零写，不重放、不自动 retry。
- `AGENT_DELIVERY_RESILIENCE_V1` CTR-S1..S5 按上述 accepted alignment 解释；旧 failed amendment 不是当前语义。`SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1` CTR-RECON-001 约束 exact evidence 与 aggregate fence。
- 结构：main 已包含 #642 accepted V3、V2/TE 原子退役和 #645 verifier。V3 CTR-V3TE-001..004 只允许 installer 的指定 blob 转换，固定 baseline、registry、500 行门及可见 debt 不变。README 的 verifier PENDING 描述是 #642 准备时记录；实际 #645 已消费该 accepted/retired chain，不能据旧事实说明回退权威或另改规则。
- B2/#644 和 EKR 已在 base。`AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1` 保留原 Scheduler、same-attempt admission、UNKNOWN、无业务重放边界。本次不修改 workflow/ledger/B2 产品源码，执行其现行回归门。

没有选定 CTR-S4 工作依赖的未决权威冲突。原分支 D-009 相反含义已由本任务 Owner 明确排除，不能再次当待二选一的问题。Broker 非 CTR carryover 的安全呈现/旧 Spec 元数据问题不成为本次实现依赖；该项不整合，不在本次改写其权威。

## 18 commits 逐项处置（按源顺序）

分类：a=仍相关；b=已被取代或已抵消（历史证据仅保留原坐标）；c=需适配。c 中明确标出的非 CTR carryover 不在本次实现范围，不冒称 main 已覆盖。

| Commit | 分类 | 去留、理由、依赖 |
|---|---|---|
| `bd8f74c4` | c，范围外 | native conversation env seam 尚未被 main 覆盖，但与 CTR-S4 无依赖，不整合。另案须依 accepted DSH_MCP_NATIVE_CONVERSATION_V1 及当前 entry 的依赖注入、website/self-stop 配置适配，不能退回旧 entry。 |
| `09c7e8b4` | c，范围外 | history env passthrough 尚未覆盖，依前项与 MOBILE_SESSION_HISTORY_V1 / PRODUCT_API_AUTHENTICATION_V1 的独立授权/default OFF；不整合，不将现有 compose 支持配置误称 env 接线完成。 |
| `c0ec3c27` | b | TEMP stderr diagnostic 被 `4114c55e` 精确撤回，成对净零，不整合。 |
| `c50484b5` | b | main `3e781692` 已删除重复 moderator 配置，文件 blob 同为 `768ddecaea5fedabe3c44cb63c11926cdfb2b885`；不重复修改。 |
| `4114c55e` | b | 对 TEMP diagnostic 的精确 revert；无独立残余，不整合。 |
| `f9e02f87` | b | bind error containment 已由 main `0ffb2175` 覆盖，history-listener blob 同为 `e5e372276bdc4bc61e097466479b82d122976a64`，不重复修改。 |
| `e9a61dee` | c，范围外 | main 没有 retry，源补丁的未取消 timer 可在 close 后重 bind；不能照搬。另案须适配受控 close 和 Product API teardown；非 CTR 依赖，本次不整合。 |
| `1921f879` | c，范围外 | structured diagnostics 尚未覆盖，源补丁未穿透 buildDownstreamError/mapping；当前 AUTHORING_V4 禁止 raw structured details。另案需按安全 detail envelope、manifest opt-in 和明确权威处理；本次不整合，也不声称功能修复。 |
| `5049c6cd` | b | 整段 termination-only→failed D-009 增补作废，不引入、不重写现行 D-009。 |
| `67d2bb08` | a | 保留精确 whitelist token 插入。main installer=`ef5053201e6af88b1edbcdfc33e845f872183b2b`，目标=`356899a8ec0726f245790379429f97dfc6ea3bfb`，mode100644、1315/1315 行。只在 V3 exact tuple 下整合，不附其他 installer 改动。 |
| `32f12a07` | b，历史保留 | 旧 R2 日志/semantic stop 坐标已过期，不复制为新门证据；通过 source Git 历史保留。 |
| `792127d5` | b | missing registry UNKNOWN/零写已由 main `6ca2e54a` 当前 auto-reconcile 覆盖。旧 watchdog policy 路径不重建；旧 failed oracle 丢弃。 |
| `06fc0737` | b，历史保留 | 旧 partial repair/结构 attribution/normalization 只绑定旧源，不复制其 PASS。 |
| `8dfd2854` | c，部分保留 | 仅迁移 runtime 停止排空、拒绝停止后 tick、动态 OFF 锁内复验、单 inFlight、周期校验及对应离线测试。适配当前 composition helper 和现有 main evidence envelope/writer；其余旧 mutation/decoder/eligibility/failed 测试丢弃，见下。 |
| `3b61dd1b` | b，历史保留 | 旧 r3/pin-stop 日志不适用于新坐标，保留 source 历史引用，不冒充重跑结果。 |
| `4c24a9d5` | b | 旧 decoder pin 服务于被否定的 policy-failed/UNKNOWN decoder，当前冻结 snapshot 不动；不刷新 pin。 |
| `e8b086e8` | b | 733 行 snapshot registry 条目基于旧 integration-base，与当前固定 baseline 规则不符；不移植，不改 registry。 |
| `815ac7c9` | b，当前收据另写 | failed 接受元数据、旧 packet/manifest 全不移植。434/32、rc1/11 项结构债仅为旧坐标证据，不作为新门结论；本次生成新收据。 |

旧证据入口：`815ac7c9:docs/reports/CTR_S4_PREPARATION_R2.md`、`815ac7c9:docs/evidence/ctr-s4-prep-r3/`、`815ac7c9:deployment-artifacts/ctr-s4-runtime-prep-v1/`。这些 Git 对象保持不变、可 `git show` 读取；本次不重打旧交付包。

## 阶段 A 的实际缺口与收敛处置

1. installer:627 的共享 whitelist 缺 watchdog。精确保留 `67d2bb08`；V3 的 `DEBT-V3TE-INSTALLER-1315` 仍未关闭，不拆 installer、不改 cap。
2. `auto-reconcile-runtime.js` 启动时固定 enabled，stop 仅 clearInterval；已捕获 callback/排队 mutation 仍可继续、无 receipt drain。`composition-runtime.js:45` 丢弃返回 handle，`compose.js:490` 关闭列表没有该 loop。保留旧修复意图并 MIGRATE 到现有 helper，拒绝停止后工作，排空已 admitted commit/receipt，再 dispose Router。
3. RETAIN main `packages/scheduler/src/auto-reconcile.js` 的唯一政策、exact current Router evidence envelope、锁内复验、NoWrite、ack-loss 和审计结果形态；整个 Scheduler 源码/decoder/快照/registry 不修改。旧 `watchdog/auto-reconcile-mutation.js`/policyUnknown executable 模型 RETIRE（不带入）。旧 definition gates/exact_started_then_idle 不借本次生命周期修复扩张。
4. 不新增平行 Scheduler、bridge、timer 服务或兼容 writer。新增测试放进现有 `scheduler-invoker-canary.test.js`，避免扩张已超宽目录；compose 当前500行，接线在既有行完成，遵守普通门，不申请例外。

## 阶段 B 执行顺序、门与停止边界

本文件持久化后才创建 `ac-ctr-s4-reverify`，从 BASE_HEAD 开始。先精确 installer 补丁，再实现上述 lifecycle/helper teardown，再适配测试；不整 commit cherry-pick。没有 production install/reload/enable、外部业务请求、旧 UNKNOWN replay 或 main/旧 PR head 改写。

所有门使用新 candidate 精确 SHA，原 stdout/stderr、命令、起止 UTC、真实 rc、源码哈希存入 `docs/evidence/603-reverify/`。测试依赖已只读确认：Node26.7.0/npm11.19.0；node_modules 是既有共享只读使用的 symlink，croner 存在，不安装/修改依赖。

依次执行（任一非预期失败立即停止后续门与产品写入，只补 STOPPED/事实收据）：

1. 结构 V3：`node scripts/verify-code-structure.mjs --base 1ff1e81cbd74a51761dab46a5fcee532c41fe4ed --head <candidate> --json`。必须 rc0 / candidate violations=0、精确 whitelist exception、可见 debt；不声称全仓无债。
2. 新增/变化与组合接线：`node --test packages/production-runtime/test/scheduler/scheduler-invoker-canary.test.js packages/production-runtime/test/compose.test.js packages/production-runtime/test/workflow-execution-shutdown.test.js`，另 installer `bash -n` 与精确blob核对；不执行安装器。
3. `npm run test:scheduler`，`npm run test:scheduler-router`。D-009 oracle 包括 auto-reconcile.test.js、terminal-proof-containment、self-service termination、never-materialized、watchdog restart/late-outcome，全部在 Scheduler 全套。新 runtime 用可信 child_real_exit 断言 UNKNOWN+terminationSettlement、无 executionOutcome/lateSettlement、其他 UNKNOWN fence 保留与零重 admission；缺证据原始 store 字节零写。
4. EKR/B2 现行套件：绑定 `EKR_SOURCE_SHA=<candidate> EKR_TEST_SOURCE_SHA=<candidate>`；`node --test packages/workflow-execution/test/observation-cas/*.test.js`；Broker `owner-obligation-attempt.test.js` 与 `owner-obligation.test.js`；workflow `recovery.test.js engine.test.js owner-assistance-resume.test.js owner-assistance-resume-engine.test.js execution-control.test.js runtime-wiring.test.js ledger.test.js`；runtime `workflow-owner-assistance-wake.test.js owner-assistance-resume-evidence.test.js`。这些是当前 B2 R5/EKR 的故障与集成面；不将无关全仓 npm test 冒称执行。
5. 独立 affected-Contract review、exact HEAD/diff whitespace、远端 main 影响复核。若新 candidate 语义变化才重跑受影响门。

完成后写 `RECEIPT-603-REVERIFY.md`：逐 commit 实际处置、逐门 rc 原文和日志哈希、新 HEAD/树、独审与未覆盖面。push 新分支，更新 PR603 正文说明新分支和收据（GitHub不支持修改现有PR head分支）；不 merge、不关闭旧PR、不强推旧head。新分支远端 SHA 读回后停止。

任何真实 required-gate failure 或选定工作上的权威冲突：写 `STOPPED-603-REVERIFY.md`，保留失败输出/候选，标清后续门 NOT_RUN，不修复、不继续 push/PR 写入，待独立续行授权。范围外功能、旧历史日志、生产业务/物理状态均不算本次已覆盖。

## 交付台账环境配方：R7 通用裁定

监管用户 2026-11-07 裁定 `603-R7-RAW-CLASS-001`，全仓后续交付适用：verbatim 机器捕获件在 `docs/evidence/` 下按 `.diff/.stderr/.stdout/.log` 四类豁免 whitespace，固有空白保真；收据/Markdown/JSON/MJS/脚本等编成件仍全量检查。精确命令及九键子进程配方见 [R7 environment-recipe.json](docs/evidence/603-reverify/r7/environment-recipe.json)，授权坐标见 [Brief R7](BRIEF-603-REVERIFY.md#r7-通用监管裁定与续行授权2026-11-07)。R4–R6 原始结果/字节不变；历史逐文件豁免不再控制后续新捕获件。网络操作继承网络环境，Secret 值不记录，不改主机环境或 guard。
