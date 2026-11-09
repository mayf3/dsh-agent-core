# Execution Kernel Reliability V1 — §1 缺陷矩阵（停止快照）

STATUS = STOPPED / INCOMPLETE

本文件只记录本轮停止前取得的源码证据及内存隔离结果。**不是完整预检通过，不是产品修复，不是运行时或业务验收。** 停止原因见 [STOPPED-EKR-PRE.md](../../../STOPPED-EKR-PRE.md)，验证覆盖与原始结果见 [RECEIPT-EKR-PRE.md](RECEIPT-EKR-PRE.md)。

## 1. 版本、来源和方法

| 坐标 | 本轮实测值 |
|---|---|
| Core main，简称 M | `eb8fd18934d827cec98faacaef987869c5cb92e7` |
| Core 部署声明提交，简称 D | `fa4510beb6b01e5c40000a2ae36a62c526759e76` |
| 工作树 / 分支 / HEAD | `/private/tmp/dsh-ekr-preflight` / `ac-ekr-preflight` / M |
| 开始时远端 | `git ls-remote origin refs/heads/main` = M；本地 origin/main = M |
| 任务书 | [agent-control #1374](https://github.com/mayf3/agent-control/issues/1374)，读取的 `updatedAt=2026-11-04T15:41:55Z` |
| 部署声明 | `/Library/LaunchDaemons/ai.agent-core.runtime.plist`、`ai.agent-core.scheduler-watchdog-w1.plist`、`ai.agent-core.scheduler-watchdog-w2.plist` 的 `EnvironmentVariables.AGENT_CORE_DEPLOYED_SHA` 均为 D |
| svc-workflow | 分组停止前只读确认远端 main = `59daec042786f0416a6a9061c0b638ba56c0d83e`；本地 HEAD `88ff8145` 未冒充 main；服务端深入核查未完成 |

版本比较使用 `git archive <exact SHA>` → Python `tarfile.open(fileobj=io.BytesIO(...))` → 内存取文件；没有将源码解压到另一个源码树。初始治理/路径定位也读过本工作树文件，其 HEAD 为 M。没有 fetch、reset、checkout、提交、生产故障注入或生产状态 API 调用。只读磁盘对照位于 `/usr/local/libexec/agent-core/app`，不访问进程内存。

“仍成立”均注明证据层级；“证据边界”不等于已修复，也不等于不存在。下表的 severity 是 #1374 的修复优先级及本次源码影响判断，不是线上事故概率。每项的 `currentCommit=M / D` 均指上述完整 SHA。

## 2. 权威与路由

已读 `.agents/README.md`、`.agents/local/README.md`、Product Architecture、Current Decisions 索引、Spec-governance router 与 PREFLIGHT 模式，以及直接相关 WAE V3 / WEC V3 / Owner Workflows V2。代码、测试、审计单及本报告都不改写 accepted Contract。

本次采用 `PREFLIGHT / REUSE / BRIEF / ROUTINE` 进行授权范围内的只读调查和报告写入；`IMPLEMENTATION_ALLOWED=NO`、`OPERATION_ALLOWED=NO`、`MERGE_READY=NOT_APPLICABLE`。本次用户交办与既有 `BRIEF-EKR-PREFLIGHT.md` 是报告写入授权，不授权产品实现。隔离写入面就是本工作树；既有 Brief 保留。

**后续实现的具体冲突：** WAE V3 `CTR-WAE-006` 明文规定 probe unavailable → `NEEDS_REVIEW / settle_check_unavailable`；`CTR-WAE-011/013` 明文限定 resolution recovery 为带 `authorityRef` 的显式受控操作，禁止自动 retry；SRE V2 `CTR-SRE-002` 的 conservative predicate 明确缺 baseline/同 visit 版本变化不能 stale redispatch。#1374 B1/B2/B4 要求的新活性行为不能直接以 REUSE 实现；应先走 accepted authority 的正式变更/whole successor 路由。预检不修改语义，可以记录这些差异。此处不自行起草或接受新 Spec。D 归档对应 WAE V2，不能把后来 V3 能力一概算作已部署。

## 3. 双版本 defect-matrix（停止前证据）

### G1 / EKR-P0-A — 跨 attempt 旧观察提交

- **currentCommit：** M / D。
- **existingContract：** WAE `CTR-WAE-002/004/005` 的 attempt/admission 身份与 ledger 边界，WEC continuation / Owner-resume 的 generation 边界；#1374 S1 是本次目标，不代替 accepted authority。
- **reproduction：** 两版本均“仍成立：源码确认 + 内存 fixture 可达”。M `packages/workflow-execution/src/ledger-records.js` 的 `recordReconciled`；D 的同名方法仍内联在 `ledger.js`。原子 mutate 内仅比较 `ACTIVE` 与 `expectedPhase`，没有 `expectedAttemptId` / `expectedGeneration`。旧 attempt 1 的观察在 fresh attempt 2 同 phase 时可以被接受。已执行 fixture 两版均 `committed:true`；同代合法提交也 `true`。fixture 的存储层是替身，不是完整真实 ledger 或跨进程复现。
- **severity：** P0；提交结算可能污染新 attempt。
- **affectedPath：** 正常 turn 观察 M `engine.js:254–291` → `ledger-records.js:64–88`；D `engine.js:261–298` → `ledger.js:472–497`。stale/run-ended retry：M `terminal-attempt-operations.js:15–32` → `ledger-records.js:100–120`；D `engine.js:247–253,310–330` → `ledger.js:507–528`。`recordStaleSuperseded` 已比较 state + phase + delivered.atMs；时间戳不同会拒绝，跨代碰撞本轮未复现。controlled recovery 两版 `recovery.js:107–235` 在原锁中 fresh 读取并用 attemptId 作 requestId，不等同于锁外旧观察提交。`recordProgressCheckpoint` 已检查 attemptId 和 reporter/session；不能把该路径也判为无身份保护。escalation M `engine.js:88` → `ledger-records.js:132–160` / D `engine.js:87` → `ledger.js:684` 的 lastAttemptId 是存档字段、未作为 CAS；此路径未动态复现。
- **proposedMinimalChange：** 在现有原子提交边界带入并比较 attemptId/generation，必要时加入 visit/record version，返回可识别 stale observation，不改新代；沿实际观察者逐一传参。保留既有锁及 UNKNOWN，不新增全局锁。
- **regressionTest：** 控制两观察者交错，先读 generation 1，再合法进入 generation 2 同 phase，旧提交拒绝且新 attempt 完全不变；同代提交通过；并发调度、turn 观察、stale/continuation/Owner-resume 各入口覆盖。定义已列，真实 ledger/多进程版本未执行。

### G2 / EKR-P0-B1 — settle_check_unavailable

- **currentCommit：** M / D。
- **existingContract：** WAE V3 `CTR-WAE-006`（§3 judgment 表，323–339）明确 probe unavailable → terminal `NEEDS_REVIEW / settle_check_unavailable`；WEC `CTR-WEC1-002/004` 区分 OUTCOME_UNKNOWN，自动 continuation 仅针对 `run_ended_no_submission`。
- **reproduction：** 两版本均“仍成立：源码确认 + 纯函数/候选 fixture”。临时不可用与需人工判断同样进入 terminal NEEDS_REVIEW；该投影在提取的 `listActiveFresh/listStaleCandidatesFresh/listRunEndedCandidatesFresh` 中均不再入选（各 0）。未发现持久 next-check 时间及针对该 judgment 的自动只读再查责任。没有执行真实 503 HTTP→恢复 E2E。
- **severity：** P0 活性断点；UNKNOWN 保护本身应保留。
- **affectedPath：** M `engine.js:220–227,277–291,302–319`、`judgment.js:343–371`、`ledger.js:427–473`；D `engine.js:229–236,284–298,309–333`、`judgment.js:172–200`、`ledger.js:652–730`。
- **proposedMinimalChange：** 先解决上述 accepted 语义冲突；在既有 ledger/reconciler 中保存“未知结果、仅再读”的持久责任和下次检查时间，有界退避；不得借临时错误重新执行原业务操作。
- **regressionTest：** 持久存储 + 实际入口注入一次 503；重启后依赖恢复，仅自动 readback 收敛，原 operation/request 不新增；长期不可用保留责任/升级。本轮只做内存分支验证。

### G3 / EKR-P0-B2 — resolution_blocked

- **currentCommit：** M / D。
- **existingContract：** WAE `CTR-WAE-011/012/013`：同 attempt、投递前 resolution 失败可显式受控恢复；带 authorityRef、原 request identity、fresh world/Router evidence 校验；明确不是 poller 自动 retry。
- **reproduction：** 两版本均“仍成立：源码调用者普查”，不是“recoverAttempt 不存在”。生产 JS/TS/MJS 引用只有 engine 构造/导出与 runtime 转发；其余为测试。M `workflow-execution-runtime.js:456`，D `:417` 转发 `recoverAttempt`，未发现正式自动消费者。`recovery.js` 两版字节相同。没有读取生产 ledger，当前 blocked attempt 数量、ID、年龄均 UNKNOWN。
- **severity：** P0 活性目标差距；无自动消费者符合当前明确限制，不能直接报原契约违规。
- **affectedPath：** `packages/workflow-execution/src/recovery.js`、engine export、production-runtime recovery forwarding。
- **proposedMinimalChange：** 先接受新的治理恢复触发语义，再将安全 eligible 集合接入既有 Scheduler；保持 authority、同 request/attempt/generation 和零投递/旧执行停止/副作用证据；证据不足可靠升级。禁止简单循环调用 recoverAttempt。
- **regressionTest：** 解析依赖恢复后，无人工调用得到合法继续；delivery-domain evidence/未知 correlation/世界漂移一律阻止不安全重投；持久重启再发现。未动态执行。

### G4 / EKR-P0-B3 — planned 写入后中断

- **currentCommit：** M / D。
- **existingContract：** WAE `CTR-WAE-002/004/012/013` 写前 intent、`delivery_started` 与一 attempt 一 admission；WEC `CTR-WEC1-008` Owner-resolved planned 专门恢复。
- **reproduction：** 两版本均“部分仍成立”。已存在 fsync 的 `attempt_planned` 和投递前 `delivery_started` fence，因此“完全没有持久写前记录”反例不成立。内存 judgment 验证：普通 planned 或 delivery_started 无 linkage 均成为 `delivery_unverified`，不是自动安全续投。M 另有 `continuePlannedOwnerResume` 专门处理 `owner_assistance_resolved` 的 planned；不能推广为一般 planned 自动恢复。真实崩溃三位置/原发送回执对账未执行，记证据边界。
- **severity：** P0；应区分安全断档与避免 UNKNOWN 重放的正确 fence。
- **affectedPath：** M `ledger-admission.js`（先 append planned，complete callback 提供 recordDeliveryStarted）、`ledger-records.js` 的 `continuePlannedOwnerResume`；D 对应逻辑内联在 `ledger.js`；`judgment.js` / engine restart reconcile。
- **proposedMinimalChange：** 复用既有 WAL、原 attempt/request correlation 与受控恢复 gate，给确定未发送、已接纳、未知结果各建合法后继责任；不新建 request 盲重放。普通 planned 的后续自动化须先核 accepted 契约。
- **regressionTest：** 投递前、进入投递、已接纳丢回执三位置用真实隔离进程故障注入；分别证明只在确定未发送时合法续投、已接纳关联原 receipt、UNKNOWN 仅回查/升级。未执行真实故障注入。

### G5 / EKR-P0-B4a、B4b — 基线缺失与仅版本变化

- **currentCommit：** M / D。
- **existingContract：** WAE settle probe；WEC `CTR-WEC1-008` preDeliveryWorkflowStateVersion 写前基线；SRE V2 `CTR-SRE-002` conservative predicate，CASE4/CASE3b/CASE5c 明确 assistance/human version bump 或缺 baseline 不作 stale redispatch。后续改变此语义也需要 governing authority 正式路由。
- **reproduction：** 两版本均“源码仍见反例，动态证据边界”。两版 `judgment.js:140–156`：缺 baseline → unavailable；同 visit、非业务终态时仅版本不等 → progressed，甚至下降也满足不等。这**不写 SETTLED**，而是使 stale/fast-continuation 要求的 stale_confirmed 不满足。M `engine.js:138–160` / D `:134–156` 在 successful delivery 后 best-effort 采样，失败仅日志，linkage 省略基线；两版 `recovery.js:212–218` 的成功 recovery 也不传 dispatch baseline。未见补采原基线记录路径。B4 harness 在断言前 SyntaxError，不能据此声称动态复现成功。
- **severity：** P0。
- **affectedPath：** `judgment.js` 的 stale/version 判定、engine 基线采样/写入、Owner resume pre-plan。
- **proposedMinimalChange：** 缺基线保留可触发的只读对账/升级责任，不能事后伪造原基线；版本变化只触发重检，业务进展须以实际 nodeVisit/合法 transition/执行事件或结果证明。先核对 accepted stale/settle 意义，必要时正式变更。
- **regressionTest：** 一次采样失败后重启仍可被处理；同 visit 仅版本增长/下降不使未完业务永久退出集合；真实 transition 仍正确关闭。**本轮未运行到有效断言。**

### G6 / EKR-P1-A — Owner obligation、公平性、通知闭环

- **currentCommit：** M / D；Svc main 独立列于 §1。
- **existingContract：** accepted Owner Workflows V2：业务义务由 Svc durable workflow/effect/STOP relation 承载，Core 不另建 case executor；WEC owner assistance；WAE due 消费/准入。
- **reproduction：** 两版本“部分源码仍成立，通知后半闭环证据边界”。D01 条件仍在：M `engine.js:374–394`（关键 `389`）/ D `:377–397`（关键 `392`）只排除 already_attempted/deferred_quiescence，pre_plan_unavailable 和捕获异常消耗默认 25 新准入预算；健康队尾可能饿死。Owner wake 对 Router correlation pending 或 settled 直接视为 ok/reused，未检查 settled turn 是否失败：M runtime `:116–117,141–142`；D `:120–121,144–145`。稳定 request=`wfassist-${assistanceCaseId}`（M `:111` / D `:115`）。源码**没有将 wake settled 直接写成义务 COMPLETED**；这是投递去重/ack，失败后业务责任是否由其他机制接管尚未全部核清。
- **Svc producer 独立反例：** 在 Svc current main，`src/main.rs:61` 正式调用 `owner_obligation::reconcile::reconcile_configured`；`owner_obligation/reconcile.rs:74–87` 先 cleanup，按 `created_at,intent_id LIMIT 64` 稳定取 PENDING，循环 `materialize(...).await?`；`:227` 的 5xx 原样 Err，坏队首可中断整批。cleanup `:243–261` 单项 cancel 错误也可提前中断。这是静态可达，未做数据库故障注入，#1364 的动态结果不能冒充此 Rust 路径结果。Svc 实际部署 SHA 未核，不能当作 D 配套运行事实。
- **通知和终态已存机制：** Svc `forum_sync.rs:1188–1189` HTTP 2xx 被算投递成功，`:1038–1064` mark_delivered；非 2xx Owner wake 已有持久 backoff，不能说未送达均丢失。Core M `assistance.js:75–78,200–204` / D `workflow-assistance.js:60–63,125–129` 有 Owner inbox 和显式 escalate_to_human。Svc `forum_sync.rs:773–777,888–896` 有 HUMAN_REQUIRED 通知/outbox；`query_dispatch_intents.rs:129–132,181–184` open assistance 排除普通 dispatch。人工答复认证→验证→重唤醒的完整调用链仍 UNKNOWN。Svc accepted Owner V3 §8/§10 指定 STOPPED absorbing、automatic handoff/automatic HUMAN_REQUIRED deferred；不能假定可自动重开终态。
- **severity：** P1；D01 与本任务公平性同源。
- **affectedPath：** Core engine 准入循环、`packages/production-runtime/src/workflow-execution-runtime.js` Owner review wake；Svc obligation producer 深入核查未完成。
- **proposedMinimalChange：** 区分有界扫描/失败预算与实际 admission，并加入逐项错误隔离/公平续扫；wake delivery lifecycle 与业务 obligation outcome 分开；通过既有 service workflow/receipt 建合法后继或可靠升级，不改 immutable STOP。
- **regressionTest：** 持续异常头部超过预算仍在有界轮次触达健康候选；Owner wake settled-but-failed 不清义务；未送达保持责任；HUMAN_REQUIRED 通知、答复、验证、重唤醒闭环。当前 main 未重跑 D01 原审计脚本，不搬用旧结果为 fresh PASS。

### G7 / EKR-P1-B — 三身份与跨 attempt 副作用

- **currentCommit：** M / D；Svc main 独立列于 §1。
- **existingContract：** Owner Workflows V2 已要求跨 attempt/RETURN/Owner changes 的稳定 effect、原 command receipt/result 回查、UNKNOWN readback-only、禁止变 body/key 重试；Svc 是 command/effect 存储权威。
- **reproduction：** **M 已有 managed 三操作稳定 effect/原 receipt 的源码机制；D 缺这些桥接文件；一般外部工具仍证据边界。** 两版 `packages/fixed-operation/src/index.js:1–11` 与 production-runtime 的 `fixed-operation-runtime.js:1–5` 明确 fixture-only，不能用作一般生产副作用保证。M `owner-obligation-guard.js:90–92` trusted origin 有 workflowInstanceId/nodeVisitId/attemptId，不含 generation；`:145–156` endpoint 以 managed visit + slot 执行，业务 key 不取 attemptId；`:159–163` 对 prior success 要求原 effectId/commandId/resultDigest/result。D 中 guard/owner-obligation bridge 不存在，不能宣称已部署 M 能力。
- **Svc 源码形态：** current main `migrations/0031_owner_obligation_workflows.sql:70–75` 定义 PREPARED/STARTED/SUCCEEDED/REJECTED_ZERO_FACTS/UNKNOWN，独立 effect_id、真实 command_id、result/result_digest；唯一语义键 `(case_id,managed_instance_id,definition_version_id,node_definition_id,slot_key,logical_occurrence)`，无 Owner/visit/attempt/generation/CAS/input digest，first_authorizing_visit 只是 provenance。`:86–107` 固定 identity/input 和成功/确定拒绝结果，并令 STOPPED/RETIRED/COMPLETED absorbing。`owner_obligation/effects.rs:118–132` FOR UPDATE 同键，intent digest 冲突拒绝、成功回放原结果、其余未知不重做；`:166–172` concrete_request_digest 与业务 identity 分离，command key=`owner-effect:{effect}`；`:228–271` 绑定真实 command receipt、STARTED、实际事实/原 receipt/SUCCEEDED 同事务提交；`:276–294` 确定 <500 与 5xx 区别处理。三个生产 operation 是 CREATE_WORKFLOW_INSTANCE / RESOLVE_WORKFLOW_ASSISTANCE / ESCALATE_WORKFLOW_ASSISTANCE_TO_HUMAN（`:193–198`）。未执行真实 DB、丢回执和并发测试。
- **severity：** P1（任务优先级），具体缺陷严重度待源码/隔离证据。
- **affectedPath：** Core managed workflow Broker wrapper / attempt identity；Svc fixed operations、command receipts、`workflow_operation_effects`；外部工具清单尚未完整验证。
- **proposedMinimalChange：** 优先复用已核到的 managed effect/receipt 机制，不据一般工具的 UNKNOWN 直接提出补丁。工具按“幂等键+回查 / 仅回查 / 均无”逐项列证据；第三类 UNKNOWN 保留责任并有权对账或升级。三身份仍须分开：业务语义 effect/operation 稳定，attempt 每次独立，generation 表达执行代际；不能因 managed origin 未含 generation 就抹去后两者的结算安全要求。
- **regressionTest：** 外部成功但回执丢失，generation N+1 发现原效果且无第二效果；body 冲突拒绝；非幂等不可查操作保留 UNKNOWN。真实 DB/跨服务验证未执行。

### G8 / EKR-SCHED — 全部非终态、持久触发、重启再发现

- **currentCommit：** M / D。
- **existingContract：** WAE/WEC states、Scheduler outcome/occurrence 契约、D009 精确 Router 证据 gate、Owner Workflows V2；具体状态全集映射尚未完成。
- **reproduction：** **两版本“部分源码确认 + 全量表证据边界”。** 既有 due poller、持久 ledger 与 fresh 候选读取存在，不能说系统没有自动推进机制。B1/B2/ordinary planned 的消费者缺口如上；不能宣称所有未完责任重启均能收敛。M 的 H04 生命周期反例重新以内存真实 mount 函数验证成立：stop 不等在途，stop 后显式 tick 仍执行。D 提交没有该 auto-reconcile 文件，故 H04 对 D 本身为不存在该实现/不适用，而非“已修复”。live 另有实现，见 §5，不能替代 D。
- **severity：** P1（H04）；完整状态审计未完成，其他状态保留各自级别。
- **affectedPath：** M `packages/production-runtime/src/scheduler/composition-runtime.js:44–46` 丢弃 mount 句柄；`scheduler/auto-reconcile-runtime.js:47–78` 无 stopped/inFlight drain；engine/reconciler/Scheduler/Owner producer 全集尚未审完。
- **proposedMinimalChange：** H04 保留句柄，拒绝新 tick→停止定时器→等待在途→销毁依赖，沿现有 manager 收敛；状态表补齐后才提出其余最小 delta。保留 D009 证据门禁与 UNKNOWN，不新增 Scheduler 或 ledger。
- **regressionTest：** 停止期间正在 settlement，stop 返回后无 admission/write；所有持久非终态在重启后由实际入口重新发现或可靠等待/升级；公平性、异常依赖恢复、正常路径。仅 H04 内存 mount 验证已执行，真实进程/存储重启未执行。

## 4. 状态—消费者—触发覆盖（不完整，禁止作为全集）

| 状态/责任 | M 自动消费者/前置 | D 对照 | 持久触发/失败后责任/关闭边界 |
|---|---|---|---|
| due、尚无 attempt | 既有 poller；合法 fresh intent/assignee/policy 与准入 fence | 机制存在 | ledger planned 写前；D01 可导致公平性问题；完整重启测试未做 |
| ACTIVE planned | 普通 planned 无自动新 request 重投；Owner-resolved planned 有专门路径 | 普通 planned 无安全自动重投证据 | linkage 不足→delivery_unverified；原请求未发送与UNKNOWN不能混同 |
| ACTIVE resolution_blocked | recoverAttempt 可调用但无正式自动调用者；显式 authorityRef | 同 | accepted 契约禁止自动 retry；world/correlation 不满足保留 fence/拒绝 |
| ACTIVE delivery_started | 原请求/Router correlation 观察 | 同 | 写前 fence 存在；无 linkage→delivery_unverified，不能重新发新 request |
| ACTIVE run_delivered / run_running | 既有 reconcile 观察 run 与业务 probe | 同 | 本轮未完成全部 failure/close 分支及持久 next-trigger 核查 |
| NEEDS_REVIEW settle_check_unavailable | 不在上述三个自动候选集合 | 同 | 无有效 next-check 机制证据；任务要求与现契约意义冲突 |
| terminal run_ended_no_submission | WEC bounded continuation、quiescence/limit | 机制存在 | 一定条件可新 generation；cap escalation；完整复核未完成 |
| stale_no_progress | 同 phase 原子结算后可在 proof/limit gate 下再入 | 机制存在 | 旧观察跨代污染风险；版本判定 B4 尚无动态证明 |
| Owner wake pending / settled | correlation 可被视为成功复用 | 同 | 不等价于 obligation 处理完；失败 turn 与通知再唤醒闭环未审完 |
| Scheduler unresolved outcome_unknown | M 有默认关闭的证据门控 auto-reconcile | D 无该模块 | live 文件另行存在；实际启用、合法读回与业务结果均 UNKNOWN |
| Scheduler admitted/running → restart | 两版 `scheduler.js:357–380` 持久改为 outcome_unknown；`:258–269` 先对账并保留 fence | 同构 | `reason=restart_unresolved: no termination proof at recovery`，不重投；M occurrence-model `:49–53` 禁 UNKNOWN→admitted，`:372` rebuildFences 重新建 fence |
| Svc PENDING INTAKE/REVIEW | 现有 `src/main.rs:61` producer 从 DB 行重查 | 配套 Svc 部署 UNKNOWN | materialize→MATERIALIZED；确定 <500→BLOCKED_KNOWN；5xx 提前终止批次；未做真实重启 |
| Svc MATERIALIZED | Core WAE 执行业务 workflow | 配套 Svc 部署 UNKNOWN | `owner_obligation/intents.rs:193–198` 仅真实 managed terminal Event 将其 COMPLETED |
| Svc BLOCKED_KNOWN | 当前已读 pending 查询只选 PENDING；全仓消费者普查未完成 | 配套 Svc 部署 UNKNOWN | 不得由未发现直接断言绝对无消费者；自动触发 UNKNOWN |
| Svc RETIRED/STOPPED | RETIRED cleanup cancel 有原 receipt；STOPPED 是吸收态 | 配套 Svc 部署 UNKNOWN | 不得非法重开；cleanup 单项错误会中断；合法后继需 authority/入口 |
| Svc effects PREPARED/STARTED/UNKNOWN | narrow GET 可读，execute 拒绝未知重做 | D 缺 managed Core bridge | 自动有权对账消费者未审完，保留 UNKNOWN；SUCCEEDED 原结果回查且 immutable |
| 其他 Scheduler / Owner / HUMAN_REQUIRED 状态 | UNKNOWN | UNKNOWN | 全集尚未完成；消费者、权限、下次触发、关闭条件均不得补猜 |

## 5. 部署声明与 live 只读对照

以下只是文件字节 readback，不是加载证明，也不是全树一致性证明。

| 相对 `app/` 文件 | M SHA-256 | D SHA-256 | live SHA-256 / 结果 |
|---|---|---|---|
| `packages/workflow-execution/src/engine.js` | `8e561cadf878d5a0109a94ce84e5980866c0044cf8af46002c0da024322a47ee` | `e6036cb481c6c004d9cc085790ba279311096c5cdc46886be32a6d2319a93abc` | 与 D 相同 |
| `packages/workflow-execution/src/ledger.js` | `7ef343723833edb5c53fc487c9973799450a7479c9e96d0d5548e0cab5db5d2f` | `61f14e6cbdc1e04f7db516eb9e7c8db827e0b5b153b4a7b123d72506dd51ea27` | 与 D 相同 |
| `packages/production-runtime/src/workflow-execution-runtime.js` | `d5549e4226c6f802c9ca075486ce26b640c42ceb301e3c4667112877a3801842` | `e39fc25dc28263b6a090ec4993c7d4072a8be2b3229514fb742310bed0fe260c` | 与 D 相同 |
| `packages/workflow-execution/src/ledger-records.js` | `33992ffc8e4f94be92201dcb42d699110e75848f7cdda7043620a0f9d5b518e8` | 不存在（内联逻辑） | 不存在 |
| `packages/workflow-execution/src/ledger-admission.js` | `7ea4e189e195de6e79e364885362fc3f19d76436d76c59a24754d5d9b457cfbf` | 不存在（内联逻辑） | 不存在 |
| `packages/production-runtime/src/scheduler/auto-reconcile-runtime.js` | `c85b4d75a8b4b559a47c15ceae32f1b20a60c44ea3d05b546fd21f550051aab7` | 不存在 | `90f968d2d65d29b6016e31b043a8d5ab417b99d1940ca658389d9cd7b7904b8d`，独立文件 |
| `packages/production-runtime/src/scheduler/composition-runtime.js` | `11f5ac94c4c841b67993eb1f78b74b6ef09aca28e24ba617c164e638857b5c00` | 不存在 | 不存在 |

live auto-reconcile 文件只读见 `stopped`、`inFlight`、`async stop()`、`await inFlight`（70–117）；本轮未动态验证其正确性。不得将 main H04 结论直接说成 live 缺陷，也不得因这些词存在就称 live 已通过。

## 6. 旧审计关联（非 fresh PASS）

- [#1363](https://github.com/mayf3/agent-control/issues/1363) D01–D10 与 [#1354](https://github.com/mayf3/agent-control/issues/1354) H01–H08 均已读取；其原固定基线是 Core b40a495d / Svc 59daec04，而非将本轮 M 直接当作旧审计执行坐标。
- [#1364 / D01](https://github.com/mayf3/agent-control/issues/1364)：原审计三轮隔离复现 25 异常饿死第 26 健康；本轮 M/D 重新读到计数条件，未重跑原完整 engine 脚本。
- [#1366 / D03](https://github.com/mayf3/agent-control/issues/1366)：ledger FIFO/OwnerLock 跨外部 await 及部分 Svc Domain 锁，与调度可达性/公平性有关；本轮未重做其串行/DB 验证，不建议直接删锁。
- [#1367 / D04](https://github.com/mayf3/agent-control/issues/1367)：fresh snapshot 可能走 repair 写路径。为守只读红线，本轮没有调用 live `snapshotFresh`、ledger loader 或受保护状态 seam；只读 archive 和磁盘源码。原 truncate/append 实验不搬为本轮结果。
- [#1358 / H04](https://github.com/mayf3/agent-control/issues/1358)：auto-reconcile 生命周期，与 P0-A 同属观察者生命周期问题，但**不是**跨 attempt 错结算的直接证明；本轮 main mount 重新验证，D 模块不存在，live 是另一文件。

## 7. 证据边界、UNKNOWN 与建议接续顺序

完整消费者/触发/权限/关闭条件全集、Svc effect/receipt 完整消费链和动态验证、真实 blocked 积压、HUMAN_REQUIRED 闭环、外部工具三分类、真实进程/数据库/跨服务复现、live 加载身份/开关状态/业务效果均 UNKNOWN 或未完成。Svc managed effect schema/核心事务 join 已有 §3/G7 的静态证据；不能将已读源码也说成全无证据。没有一个 UNKNOWN 被按“零”“已修复”或“自动恢复 PASS”处理。

建议下一轮先明确停止后的接续授权并修复隔离 harness，重做 B4；随后优先完成 P0-A 的完整观察者调用图及真实原子 ledger 交错证据。B1/B2 先解决 accepted 语义与目标的冲突，再设计既有调度上的持久 readback/恢复责任。B3 保全 WAL/request identity，再做三位置崩溃；B4 用业务事实替代单纯版本变化；然后完成 D01 公平性/Owner outcome、Svc effects/工具能力分组；最后补齐状态全集及隔离真实进程重启/正常路径。此顺序只用于后续规划，不授权本轮继续。

## 8. 已有回归测试定位（只读发现，未运行原测试套件）

| 组 | 已有测试及其证明边界 |
|---|---|
| G1 | `stale-reentry.test.js` M:474 / D:475 仅 changed-snapshot loser；`engine.test.js` M:179 / D:175 为 admission 中不抢先结算；不能代替旧 generation 观察交错 |
| G2 | `engine.test.js` M:310 / D:302；`judgment.test.js:137–140`；`stale-quiescence.test.js` M:157 / D:156 均证明 unavailable 保守不重投，不证明自动恢复 |
| G3 | `recovery.test.js`、`runtime-wiring.test.js` 有显式恢复、安全门与并发测试；没有正式自动消费者证明 |
| G4 | `recovery.test.js` M:185,258 / D:181,254 明确 started/planned 不自动恢复；`engine.test.js` M:375 / D:361 是 delivered restart；`ledger.test.js:133,164,251` 是 replay/torn-tail/fsync，不能代替三位置故障注入 |
| G5 | `stale-reentry.test.js` CASE3b / CASE5c 明确版本变化和缺基线 never stale；`execution-control.test.js` Case3 / Case7 区分 ended continuation / UNKNOWN；本轮 B4 新 harness 失败 |
| G6 | Core `production-runtime/test/workflow-owner-assistance-wake.test.js`；Svc `tests/owner_obligations/{intents,review,stops,independent_counterexamples}.rs`；`forum_sync.rs:1473` owner_wake_keeps_non_success_retryable、`:2136` ignored DB recovery test；未执行 |
| G7 | Core `broker/test/capabilities/workflow-execution/owner-obligation.test.js`、`fixed-operation/test/receipt-provenance.test.js`；Svc owner_obligations counterexamples；未执行 |
| G8 | 原 Scheduler/真实进程完整 regression 目录未完成枚举；本轮只执行下述 receipt 中的 H04 内存 mount；正常路径及重启持久性测试未执行 |

除注明 Core 包前缀外，G1–G5 测试位于 `packages/workflow-execution/test/`。存在测试定义不等于本轮测试执行。


## 9. R3 续作记录（追加；§1–§8 原停止快照保持原字节）

R3 mandate：根目录 `BRIEF-EKR-PRE-R3.md`。前两轮 STOP 为历史记录，R3 的继续授权和停机粒度以本轮 mandate 为准。`rg` 无命中、路径定位和临时 harness 环境错误如实记录，不自动升级为产品验证失败。仅四类条件停止依赖工作：无法解释的产品断言失败、必须改产品源码才能继续、必需依赖缺失/矛盾、要求执行被禁止操作。

本轮为 `COMPLIANCE / REUSE / BRIEF / ROUTINE`，只核查已有实现和 accepted Contracts；不创建/修改 Product Authority。M、D 坐标沿用 §1 exact SHA，不把本分支后来报告提交算作产品版本。R3 中 COMPLETE 只表示 §1 只读预检各组完成并列出证据边界，不能表示 #1374 §2–§9 完成、反例消除、真实存储/进程故障测试、产品符合性、合并或生产验收。

### 9.1 G5 / EKR-P0-B4 — harness 修复与双版本重跑

- **currentCommit：** M / D（§1 完整 SHA）。
- **existingContract：** §2 的 WAE/WEC/SRE accepted 边界保持；`CTR-SRE-002` 的保守 stale 判定不在本任务中改变。
- **harness diff：** [b4-harness.diff](b4-harness.diff)。原命令从上一轮实际执行记录恢复，保存在 [b4-harness.before.py.txt](b4-harness.before.py.txt)；修复版 [b4-harness.py](b4-harness.py)。只将先 SOURCE 后 REV 改为先 REV 后 SOURCE，并传播子进程非零 rc。未重新运行已知损坏的旧脚本。
- **reproduction：** 两版有效动态结果相同：缺 baseline → unavailable；同一未终态 visit 的版本 7→8 和 9→8 均 → progressed。该 progressed 只抑制 stale reentry，不等于 SETTLED/business completion。反例仍成立于内存纯函数范围；缺失基线的真实持久重启及最终活性未验证。
- **severity / affectedPath：** P0；`packages/workflow-execution/src/judgment.js:140–156`，engine dispatch baseline 采样与 recovery 路径沿用 §3/G5。
- **proposedMinimalChange：** 沿用 §3/G5；先通过 governing authority 路由，不能在当前预检中修改 conservative predicate。
- **regressionTest：** 本轮已运行三个原 harness 场景，两版 Node rc=0，外层 rc=0；真实依赖/持久采样失败/进程重启结果 UNKNOWN。
- **OBS-EKR-R3-G5 / EVD-EKR-R3-G5：** archive judgment.js → SRE conservative predicate，关系 SATISFIES（当前分支行为）/ INCONCLUSIVE（#1374 最终活性目标）。原始 stdout 如下，另存 [g5-b4.raw.txt](g5-b4.raw.txt)。

```text
REV eb8fd189 RC 0 {"sourceSha":"eb8fd189","testName":"EKR-PRE-B4-pure-source","faultInjection":["missing dispatch baseline","same current visit version 7→8","same current visit version 9→8"],"initialState":{"visit":"11111111-1111-1111-1111-111111111111","terminal":false,"version":8},"actualResult":{"missing":{"kind":"unavailable","reason":"stale_check_unavailable: no workflowStateVersionAtDispatch recorded at delivery"},"increased":{"kind":"progressed","reason":"workflow_state_version advanced (7 -> 8) since dispatch"},"decreased":{"kind":"progressed","reason":"workflow_state_version advanced (9 -> 8) since dispatch"}},"expectedResult":"observed current source matches conservative baseline exclusion and version-inequality suppression; demonstrates EKR liveness gap, no repair claimed","rawReceipt":"stdout only; data URL import of archive judgment.js; no filesystem writes"}
 
REV fa4510be RC 0 {"sourceSha":"fa4510be","testName":"EKR-PRE-B4-pure-source","faultInjection":["missing dispatch baseline","same current visit version 7→8","same current visit version 9→8"],"initialState":{"visit":"11111111-1111-1111-1111-111111111111","terminal":false,"version":8},"actualResult":{"missing":{"kind":"unavailable","reason":"stale_check_unavailable: no workflowStateVersionAtDispatch recorded at delivery"},"increased":{"kind":"progressed","reason":"workflow_state_version advanced (7 -> 8) since dispatch"},"decreased":{"kind":"progressed","reason":"workflow_state_version advanced (9 -> 8) since dispatch"}},"expectedResult":"observed current source matches conservative baseline exclusion and version-inequality suppression; demonstrates EKR liveness gap, no repair claimed","rawReceipt":"stdout only; data URL import of archive judgment.js; no filesystem writes"}
 
```


### 9.2 G2/B1、G3/B2、G4/B3 — R3 完成结果

分组记录原文见 [G2-G4-R3.md](G2-G4-R3.md)；以下并入其结果，全部原始输出在 [g2-g4.raw.txt](g2-g4.raw.txt)。

### EKR PRE R3 — G2/B1、G3/B2、G4/B3 续作

STATUS = COMPLETE_FOR_AUTHORIZED_SOURCE_AND_MEMORY_SCOPE

这是只读预检证据完成状态，产品活性目标仍有缺口。不是源码修复、完整回归、真实进程/数据库/跨服务验证、部署或业务通过。G1 原文未改动。

#### 坐标、权限与方法

- `SPEC_GOVERNANCE_MODE=COMPLIANCE`；`AUTHORITY_ACTION=REUSE`；`PLAN_LEVEL=BRIEF`；`ASSURANCE_LEVEL=ROUTINE`。授权来自 `BRIEF-EKR-PRE-R3.md` 及用户 R3 交办，仅准许报告和内存 harness；`IMPLEMENTATION_ALLOWED=NO`、`OPERATION_ALLOWED=NO`。
- M=`eb8fd18934d827cec98faacaef987869c5cb92e7`；D=`fa4510beb6b01e5c40000a2ae36a62c526759e76`。这是本次交接固定源码坐标，不声明当前远端或 live 正在加载该版本。
- M 当前 accepted WAE V3 blob=`ffa4defa97973b8c25240c2a4e7191dc6fee4167`，WEC V3 blob=`f7623521fd031f661ecc74fe61cf9ec52e69ba13`；D 对照 WAE V2。WAE `CTR-WAE-006/012/013` 和 WEC `CTR-WEC1-002/004` 保守结算、原请求及恢复权限边界保持。
- 执行时间：`2026-11-04T16:06:36Z` 前完成；工作树 `/private/tmp/dsh-ekr-preflight`，分支 `ac-ekr-preflight`，本组不提交、不 push、不创建 PR。
- [harness](g2-g4-harness.py) 逐版 `git archive` 到内存；真实 `engine.js`、`recovery.js`、`judgment.js` 和无 I/O 帮助模块通过 data URL 导入。为避免加载真实 ledger 的文件/锁依赖，只从该版 `ledger.js` 提取两个常量、三个 `list*Fresh` 原方法，候选查询的 `mutate`、状态提交、Router、Principal、detail 和 delivery 均是内存替身。
- [原始 stdout](g2-g4.raw.txt) 保留两个 Node 的 `RC 0`、每版 6 条 Observation（B2 gate Observation 内含 9 个 case）、源文件 SHA-256、输入和实际结果。没有外层 rc 掩盖子进程错误。

| 工件 | 字节 | SHA-256 |
|---|---:|---|
| `g2-g4-harness.py` | 14478 | `c5dff39cdb572fccdb6f57b89e1872858614b1a6e99f1f0d494be919d59c32db` |
| `g2-g4.raw.txt` | 31117 | `ac4a910c9f28a943410bd8b4546adabc6885ef1acb2b5266ee7d06b4c86e7dbe` |

#### G2 / EKR-P0-B1 — 临时 503 后的再发现

`currentCommit=M / D`；`severity=P0`；`existingContract=CTR-WAE-006/007, CTR-WEC1-002/004`。

两版同结果。真实 engine 对 settled turn 的 detail seam 注入 `{ok:false,code:'http_503'}`，一次 reconcile 将 attempt 记为 `NEEDS_REVIEW / settle_check_unavailable`。把该内存状态 JSON 重建为新 query/engine，detail 改为健康后跑 `pollOnce`：`active=0, stale=0, runEnded=0`，`readsAfterRecovery=0, deliveriesAfterRecovery=0`。这不是“重试成功”；它复核了已有缺口：技术性读失败仍退出自动候选，没有本 harness 所见的再查触发。正常对照使用同版实际 engine，visit 已移动时得到 `SETTLED`。

- `affectedPath`：M `engine.js:240–319`、D `engine.js:257–333`；503 probe M `:220–227` / D `:229–236`；judgment M `:347–362` / D `:176–191`；原候选查询 M `ledger.js:427–473` / D `:652–730`。
- `reproduction`：仍成立，真实无 I/O 模块 + 原候选查询方法 + 内存提交 fixture；不是实际 HTTP503、durable ledger 或服务重启。
- `proposedMinimalChange`：沿既有 ledger/reconcile 保留 UNKNOWN 的持久再读责任和下次检查触发；改变 accepted terminal 语义前须正式路由，不可直接在 REUSE 下修产品，不重发未知业务操作。
- `regressionTest`：后续必须在获准隔离持久环境验证真实入口 503→依赖恢复→重启后仅 readback 收敛；本轮只完成上述范围。
- `EVD-EKR-R3-G2`：原始 `G2-B1-503-then-dependency-recovered-memory-reconstruction` 支持当前 WAE unavailable 分支，亦支持与 #1374 B1 活性目标的差距；不支持业务恢复 PASS。

#### G3 / EKR-P0-B2 — 自动消费者与显式恢复 gate

`currentCommit=M / D`；`severity=P0`；`existingContract=CTR-WAE-011/012/013`。

两版依赖健康的 `resolution_blocked` attempt 连跑 3 次真实 `pollOnce`，每次 `blocked=1`，累计 `read=0 / resolve=0 / delivery=0`，attempt 保持原身份/phase。源码调用者普查覆盖各版 archive 中 `packages/`、`scripts/` 的 `.js/.ts/.mjs/.cjs`，排除 test 目录后仅有：

| 路径 | M 行 | D 行 | 意义 |
|---|---:|---:|---|
| `workflow-execution/src/recovery.js` | 107、239 | 107、239 | 定义/返回 |
| `workflow-execution/src/engine.js` | 439、453 | 459、473 | 构造/返回 |
| `production-runtime/src/workflow-execution-runtime.js` | 456 | 417 | 直接转发 |

未见上述集合外另一个正式自动调用点；不能把控制面方法已存在称自动消费者已存在。WAE V3 `CTR-WAE-013` 本来就禁止 poll/reconcile/timer 自动调用，因此这是任务书目标与现 accepted 语义的差距，不是凭任务书推断原 Contract 违规。

9 个显式内存恢复 case 在两版均符合真实 `recovery.js`：

| case | 实际 outcome / 写入 | delivery |
|---|---|---:|
| 无 authorityRef | `REFUSED_CALL`，零事件 | 0 |
| Router pending | `RECOVERY_INAPPLICABLE:router_correlation:pending`，零事件 | 0 |
| never_existed 但带 handle | `RECOVERY_INAPPLICABLE:attributable_delivery_evidence`，零事件 | 0 |
| 身份仍不可解析 | `STILL_BLOCKED:unavailable`，仅 resolution_blocked | 0 |
| visit 已移动 | `RECOVERY_REFUSED`，仅 recovery_refused | 0 |
| assignee 漂移 | `RECOVERY_REFUSED`，仅 recovery_refused | 0 |
| world read 503 | `RECOVERY_REFUSED:instance_state_unavailable:http_503` | 0 |
| 验证后身份再次失效 | `STILL_BLOCKED:flap`，recovery_authorized→resolution_blocked | 0 |
| 全部 gate 健康且显式授权 | `RECOVERED_RUN_ADMITTED`，recovery_authorized→delivery_started→run_delivered | 1 |

成功 case 使用原 `requestId='original-attempt'`，provenance 中保留原 attempt/visit/instance。这里的 `authorityRef='fixture-authority'` 只传入隔离替身，不构成真实恢复授权。

- `affectedPath`：两版相同 `recovery.js:107–235`；blocked skip M `engine.js:255–258` / D `:262–265`；正式转发见表。
- `reproduction`：无自动消费者的源码清点 + 三次真实 poll 内存验证；显式安全 gate 已存在且本次内存观察正常。
- `proposedMinimalChange`：先正式接受合法自动触发/权限语义，再接入既有调度，保持同 request/attempt 身份、fresh world、零投递及 UNKNOWN gate；不得简单循环调用现 `recoverAttempt`。
- `regressionTest`：后续在真实隔离 ledger/Router 存储及多进程交错下验证 gate/at-most-once 与重启触发；本轮不作这些声明。
- `EVD-EKR-R3-G3`：原始 `G3-B2-*` 两条 Observation 只支持源码消费者/gate 结论，不支持无人值守恢复或真实存储原子性。

#### G4 / EKR-P0-B3 — 三个中断位置

`currentCommit=M / D`；`severity=P0`；`existingContract=CTR-WAE-005/006/012/013`。

使用真实 `admitDueIntent` 闭包，在内存 ledger 或 Router seam 返回未完成 Promise 暂停，获取 JSON 状态后重建 engine。没有 kill/崩溃真实进程；`attempt_planned` 和 append/fsync 由替身表示，不能当作真实持久写前记录验收。

| 位置 | 暂停前事件/调用数 | 重建后显式 recover | reconcile / 后续 poll |
|---|---|---|---|
| planned 后，尚未进入执行 closure | attempt_planned；0 delivery | `RECOVERY_INAPPLICABLE:not_pre_admission_blocked` | `NEEDS_REVIEW/delivery_unverified`；0 新 delivery |
| 已进入 deliver、尚无 receipt | attempt_planned→delivery_started→router_invoked_pending；1 delivery | `RECOVERY_INAPPLICABLE:delivery_domain:delivery_started` | 同上；0 新 delivery |
| Router seam 表示已接纳，receipt 未返 | attempt_planned→delivery_started→router_accepted_no_receipt；1 delivery | 同上 | 同上；0 新 delivery |

三处两版结果一致。重建后 `correlationReads=0`：没有 `delivered` linkage 时 engine 的 query helper 不向 Router 发 correlation 读请求；即使 fixture Router 知道 settled，也不能自行得出“原 receipt 已对账”。本轮证明不盲目新建 delivery 的当前分支，未证明区分三类中断并继续收敛。M 的 `owner_assistance_resolved` planned 专门续作路径不在这三个 ordinary planned case 内，不能将本结论覆盖它。

- `affectedPath`：写前 fence 调用 M `engine.js:130–131` / D `:126–127`；reconcile M `:279–291` / D `:286–298`；judgment M `:347–349` / D `:176–178`。实际 file/fsync 实现在 M `ledger-admission.js` 与 D `ledger.js`，本 harness 没有执行文件层。
- `reproduction`：ordinary planned/started 的保守停留已由真实 engine 内存 seam 复核；实际崩溃和 durable receipt 链仍属证据边界。
- `proposedMinimalChange`：保留原 WAL/request，先正式厘清 ordinary planned continuation 与 accepted gates；确定未发送才可有权续投，已接纳只关联原 receipt，UNKNOWN 仅原入口回查/升级，不换 identity 重做。
- `regressionTest`：真实进程在 append-before-send、invocation、accept-without-receipt 三处故障注入，使用可信隔离持久存储验证原 receipt/query 和责任再发现。本轮未运行。
- `EVD-EKR-R3-G4`：原始三个 `G4-B3-*` Observation 仅支持内存 seam 下保守不重投，不支持持久恢复完成。

#### UNKNOWN 与纪律记录

- UNKNOWN：live blocked 实际 ID/数量/年龄、live 加载/开关、真实 HTTP503、ledger fsync/OwnerLock/损坏恢复、多进程竞争、真实进程崩溃/重启、DB、跨服务、原 receipt durable 回查及业务效果；没有把 UNKNOWN 归零。
- 三组 current-source 观察断言全部执行，两个 Node 均 rc=0；rc=0 代表观测与已读源码吻合，产品 #1374 活性目标仍未满足。没有无法解释的产品断言失败，没有为继续而改动产品源码。
- 探索性失败：一次 `head packages/workflow-execution/src/owner-resume.js` 路径不存在，组合命令 rc=1；随后 `rg`/源码 import 定位真实 `owner-assistance-resume-engine.js`。按 R3 裁定属于路径探索，不触发停机。没有隐藏原错误或将探索 rc 记成产品失败。
- 写入严格限制为本说明、harness 和 raw 文件；未编辑原 matrix、G1、产品代码、tests、配置、refs；没有真实生产/服务/DB/网络副作用。


### 9.3 G6/P1-A、G7/P1-B — R3 完成结果与 Svc 状态全集

分组原文：[G6-G7-R3.md](G6-G7-R3.md)。以下为该分组追加证据；原始结果链接在文中。

### G6/G7 — EKR-preflight-r3 continuation

STATUS = COMPLETE_WITH_EXPLICIT_EVIDENCE_BOUNDARIES

This records completion of the authorized bounded source/in-memory preflight; it is not product repair, Svc DB verification, production acceptance or an assertion that all obligations converge.

Coordinates: Core M=`eb8fd18934d827cec98faacaef987869c5cb92e7`; Core declared-deployed source D=`fa4510beb6b01e5c40000a2ae36a62c526759e76`; independent Svc source S=`59daec042786f0416a6a9061c0b638ba56c0d83e`. Svc checkout HEAD `88ff8145eb0842b4ce759117caf4b05f9012ebdc` was not treated as main or deployed. Source was read from exact `git archive` bytes in memory; no source tree extracted, no DB/service/network/production API invoked. Only this report, the harness and raw observation file were written by this sub-audit. Evaluation environment: Node `v26.7.0`, Python local process, vm modules with no filesystem/network interface. Cron is a fail-loud nonexecuting link stub. Ledger module is not evaluated; only its two literal exports are parsed from the relevant exact source (`3`, `stale_no_progress`).

Governance: AGENTS/shared/local governance, relevant Core Product Architecture/D-008, Core Owner Workflows V2 and Svc Product V13/Architecture V0.4.7/Owner Workflows V3 read; `spec-governance / COMPLIANCE`, bounded source assessment under the R3 mandate. No Product Contract is changed. Svc Owner V3 preserves semantic-effect identity/readback-only UNKNOWN and explicitly defers automatic handoff, changed-body recovery, arbitrary external payment/publishing and automatic HUMAN_REQUIRED (lines 418–422). Existing absorbing STOP cannot be silently reinterpreted as automatically retryable.

#### G6 / P1-A

##### Executed observations

| Observation | M raw lines | D raw lines | Actual result |
|---|---:|---:|---|
| 25 `pre_plan_unavailable` candidates then tail sentinel, three fresh polls | 30 | 70 withdrawn for this branch | M first 25 only; D synthetic shape is unsupported and is not evidence of a D pre-plan failure branch |
| 25 candidate-local thrown dependency failures then same tail, three polls | 31 | 71 | Same result; error consumes admission counter |
| All preceding candidates return `already_attempted` control, three polls | 66 | 72 | All 26 reached each poll, including identical tail sentinel |
| Owner wake pending correlation | 32 | 73 | `ok:true,reused:true`, 0 new deliveries |
| Owner wake settled correlation carrying synthetic failed outcome | 33 | 74 | `ok:true,reused:true`, 0 new deliveries; failed business/turn payload is not inspected by this function |
| No correlation, successful delivery seam | 34 | 75 | 1 delivery, `ok:true` |
| Delivery throws, no correlation after | 35 | 76 | 1 attempted delivery, `ok:false,code:owner_wake_failed` |
| Delivery throws, settled failed correlation appears after | 36 | 77 | 1 attempted delivery, `ok:true,reused:true` |

Raw: [g6-g7.raw.txt](g6-g7.raw.txt). The first runs used field name `healthyTailReached`; the control establishes only discovery reachability. The tail stub itself returns `already_attempted`: these results do **not** establish a healthy successful admission. Final control and D results use the precise name `tailSentinelReached`. Real engine instructions/loop executed with memory-only ledger candidate/begin seams; no actual storage producer, persisted fairness cursor or restart was tested. Source basis: M `packages/workflow-execution/src/engine.js:374–397` (count at 389 and catch at 393); D same file `377–400` (count 392 and catch 396). This confirms a reachable candidate-starvation counterexample, not an actual production backlog. **D-specific correction:** D `engine.js:164–177` has no `pre_plan_unavailable` result branch. Raw line 70 injected an unsupported no-attempt result, so line 177 throws while reading `attemptId`, then the poll catches `engine_error`. It is not evidence of a real D pre-plan failure path. That interpretation is withdrawn. D fairness evidence remains the explicit candidate-local throw case (71), the tail-discovery control (72), and the source budget logic. Earlier matrix §3/G6 wording that attributes `pre_plan_unavailable` to both versions must be read with this R3 correction; historical text is preserved. Final harness checks this exact-version branch and omits unsupported D mode; the invalid raw observation stays readable.

Owner wake source: M `packages/production-runtime/src/workflow-execution-runtime.js:111–117,134–149`; D `115–121,137–152`. Stable case request ID + Router acknowledgement do not prove obligation completion. The function does not write Svc obligation `COMPLETED`; the static Svc completion producer below must remain distinct.

##### Svc producer and notification closure (S source only)

Full prefix `R=src/store/postgres/workflow_instance_repository/` below:

- `src/main.rs:61` invokes configured obligation reconcile. `R/owner_obligation/reconcile.rs:79–87` runs cleanup then stable `ORDER BY created_at,intent_id LIMIT 64` PENDING batch and uses `materialize(...).await?` per item. `:218–227` makes deterministic <500 `BLOCKED_KNOWN` but propagates 5xx. `:243–261` cleanup cancellation also propagates a single item error. These are source-confirmed head-of-batch failure paths. No Rust/SQL fault injection was run, and Core fairness does not prove this Rust result dynamically.
- `R/owner_obligation/intents.rs:193–198` marks a MATERIALIZED intake/review COMPLETED only from actual managed terminal event coordinates. `:202–208` retires current responsibilities on source lifecycle changes while protecting own successful review effect. Core wake ack is not this completion producer.
- `src/forum_sync.rs:888–896,1005–1067` drains OWNER_ASSISTANCE_WAKE through durable outbox. Success marks delivered; every non-2xx wake is retryable without kick-only dead-letter cap. `:1167–1200` uses HTTP success only, not business outcome. Thus non-delivery is not simply lost, but successful HTTP delivery can stop outbox retries before business responsibility is solved.
- HUMAN_REQUIRED is rendered as a Forum event (`src/forum_sync.rs:773–777`) and ordinary dispatch excludes open assistance (`R/query_dispatch_intents.rs:129–132,181–184`; resume evidence also excludes open cases). HTTP `GET /internal/v1/assistance-cases/human-required` is read-only (`src/http/mod.rs:101–104`; handler `assistance.rs:255–269`). It does not authenticate/consume a human answer as a resolving command.
- Existing resolve can accept HUMAN_REQUIRED when the same current visit still matches: `R/assistance_transaction/checks.rs:83–100`. Actual resolve requires enabled actor = effective Domain Owner (`write.rs:272–290`), validates payload/governance proof (`:247–253,293–305`), writes actual resolution receipt/Event and closes the case (`:327–355`). Its HTTP handler requires `workflow.execute` and trusted idempotency (`src/http/handlers/assistance.rs:170–178`), not anonymous Forum text.
- Source search over all S `src/**/*.rs` found the above read/resolve/outbox paths; no separate dedicated human-answer ingestion/validation/re-wake path was established. Human answer -> authenticated Owner action -> exact evidence validation -> re-wake remains **UNKNOWN as an autonomous end-to-end chain**, not proven absent in every external application. Managed STOPPED/RETIRED/COMPLETED absorbing rules remain binding; a legacy resolve entry does not authorize reopening stopped managed responsibility.

Severity: P1. Minimum proposed direction remains candidate-local failure isolation and a bounded fair rescan without replacing the scheduler, plus separating delivery acknowledgement from durable business responsibility. Any new automatic HUMAN_REQUIRED/handoff/STOP recovery semantics requires the accepted authority route first. Regression still needed beyond this scope: real Svc DB batch-failure/restart, finite fairness progress, human authenticated closure and actual successor responsibility.

#### G7 / P1-B

##### Three identities and two different generations

| Identity | Actual source shape | Meaning/boundary |
|---|---|---|
| Business semantic effect | S migration 0031 and `R/owner_obligation/effects.rs:118–132` unique `(case_id,managed_instance_id,definition_version_id,node_definition_id,slot_key,logical_occurrence=1)` | Stable across visit/RETURN/attempt/Owner/CAS; original command/result remains authority |
| WAE attempt / generation | M `ledger-admission.js:52–78`, `attemptIdFor(nodeVisitId,generation)` | One attempt identity and bounded progression generation for same workflow visit; fresh generation is not a new business effect |
| Router processGeneration / runtimeEpoch | M `packages/agent-router/src/reconciliation/store.js:13–20,280–325` | Process lifetime generation + control-plane epoch + turn sequence identify execution/reconciliation, independent of WAE generation |
| Core trusted managed origin | M `owner-obligation-guard.js:90–92` closed `{kind,workflowInstanceId,nodeVisitId,attemptId}` | No WAE generation field here. That does not erase WAE attempt/generation or replace exact Router execution identity |
| Fixture invocationId | M/D fixed-operation registry hashes definition + inputDigest + trusted workflow (`registry.js:124–134` in M) | Fixture-only, includes attempt-related workflow context, and has no durable Svc effect claim; not a production business-effect ID |

Svc S `effects.rs:118–132` locks stable key, rejects changed business digest, reads original success, and refuses other outcomes as UNKNOWN. `:166–172` separates concrete request digest from effect and derives `owner-effect:{effect}` command key. `:228–271` joins actual command receipt, STARTED, business facts, original result and SUCCEEDED in one transaction; `:276–294` distinguishes known rejection from unknown service failure. This is static evidence; transaction atomicity, response loss, parallel claims and restart correctness remain **UNKNOWN dynamically**.

##### Executed real Core guard / memory Svc responses

M raw lines 38–46 run real guard, schema/mapping/registry code. Each `callCase` is an independent fixture: first-response-loss and next-attempt-success cases do not share a persistent Svc effect state. They are separate Core response-branch checks, not one continuous response-loss/restart scenario:

- First NOT_STARTED create forwards one exact slot request and returns actual stub result; simulated lost response preserves `transport_failure` (38–39).
- A different attempt ID with an existing Svc SUCCEEDED projection performs one guarded POST replay/readback and preserves original effect/command/result (`replayed:true`, line 40). **It does issue one POST**. The stub supplies Svc replay semantics; this does not prove a second real business effect was prevented by Rust.
- Changed body returns Svc `idempotency_conflict` unchanged (41); mismatched original receipt identity is rejected (42).
- UNKNOWN, STARTED, PREPARED and REJECTED_ZERO_FACTS projections issue zero writes and fail closed (43–46).
- D has no managed guard/registry capability at that revision (raw 79); no M feature is attributed to D deployment.
- Generic trusted Idempotency-Key function creates distinct invocation keys (M raw 47; D 100): invocation keys are not stable semantic effect keys. M `transport/http.js:169–171,247–263` reuses one key only during one 401 retry; D `transport.js:433,589` same principle.

Severity: P1 priority from task; verified managed Core mechanisms must be reused rather than described as entirely absent. Proposed minimum: retain existing stable Svc mechanism for three managed operations; do not infer universal external-tool dedupe from generic transport keys or fixed-operation fixtures. Preserve UNKNOWN and reconcile/escalate only through an authorized existing consumer. Regression still needed: actual Svc DB response-loss/concurrent claim/RETURN/new attempt and immutable original receipt readback.

#### Bounded per-operation tool inventory

Inventory is **all pure-data exports of `packages/broker/src/capabilities/manifests.js`**: M 69 capabilities / 119 operations (raw 37), D 65 / 110 (raw 78). It includes optional moderator manifests and does not assert runtime enablement. It excludes calculator fixture, native filesystem/shell/MCP, custom plugins, external application consumers and any live allowlist. Those surfaces remain UNKNOWN; this is not a platform-wide tool census.

Classes: `①候选` = manifest has trusted invocation key plus named domain readback; `②候选` = no stable cross-attempt business key shown, named readback projection exists; `③未证` = no exact joined receipt/effect readback established in this bounded audit. **Every candidate is UNCERTIFIED for cross-attempt external-effect safety.** A key bit alone does not certify class①; ordinary domain reads may need missing ID/receipt/correlation to resolve a response-loss event. `READ_ONLY`/`FIXTURE_ONLY`/`RETIRED_WRITE` are outside the business-effect classes. M managed create/resolve-current-review/escalate has the stronger static Svc + Core stub evidence described above; DB conformance remains UNKNOWN. POST `workflow_domain_binding_reconcile.plan` is an expressly read-only plan operation.

Source families: M `capabilities/workflow/execute.js:100–201`, `assistance.js:130–277`, `definition-authoring.js:108–164`, `domains.js:108–338`; D inline `capabilities/workflow-execute.js`, `workflow-assistance.js`, `workflow-definition-authoring.js`, `workflow.js`. Forum bindings are in `forum.js` + `forum-moderation.js` + `forum-notifications.js`; workbench in `life-workbench.mjs`; local tools in their namesake manifest and runtime seam. Exact method/path/key flags for each operation are preserved in raw inventory JSON.

| Capability.operation | M / D | Wire / key | Candidate class | Available read projection / limitation |
|---|---|---|---|---|
| `agent.definition.read.get` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent.definition.read.list` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent.definition.write.create` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | agent.definition.read get/list; current config not exact operation receipt |
| `agent.definition.write.disable` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | agent.definition.read get/list; current config not exact operation receipt |
| `agent.definition.write.set_default` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | agent.definition.read get/list; current config not exact operation receipt |
| `agent.definition.write.update` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | agent.definition.read get/list; current config not exact operation receipt |
| `agent.directory.list` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent.directory.resolve` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent_resolve_principal.resolve` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent_resolve_principal_by_agent.resolve` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent_session_dispatch_status.status` | yes / absent | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent_session_list.list` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent_session_send.send` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | agent_session_send_reconcile.lookup/turn_inspect; original request coordinates required |
| `agent_session_send_reconcile.lookup` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `agent_session_turn_inspect.inspect` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `development_execute.cancel` | yes / yes | LOCAL / no manifest key | RETIRED_WRITE | Retired writer; not an effect retry route |
| `development_execute.continue` | yes / yes | LOCAL / no manifest key | RETIRED_WRITE | Retired writer; not an effect retry route |
| `development_execute.result` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `development_execute.start` | yes / yes | LOCAL / no manifest key | RETIRED_WRITE | Retired writer; not an effect retry route |
| `development_execute.status` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `execution_history_audit_query.node_history` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `execution_history_audit_query.query` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `execution_trace_query.node_history` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `execution_trace_query.query` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `fixed_operation.fixture_echo` | yes / yes | LOCAL / no manifest key | FIXTURE_ONLY | No production durable effect guarantee |
| `fixed_operation.fixture_sum` | yes / yes | LOCAL / no manifest key | FIXTURE_ONLY | No production durable effect guarantee |
| `forum_admin_unread.unread` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_archive_thread.archive` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_audit_logs.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_close_thread.close` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_create_thread.create` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_delete_message.delete_message` | yes / yes | DELETE / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_delete_thread.delete_thread` | yes / yes | DELETE / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_handle_report.handle` | yes / yes | PATCH / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_hide_thread.hide` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_list_threads.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_mark_read.mark_read` | yes / yes | PUT / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_moderation_queue.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_my_notifications.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_notification_read.read` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_notifications.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_notifications_read.read_batch` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_pin_or_feature_thread.set_featured` | yes / yes | PATCH / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_pin_or_feature_thread.set_pinned` | yes / yes | PATCH / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_read_thread.read` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_read_transcript.read` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_reply.reply` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_report_content.report` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_resolve_thread.resolve` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_restore_thread.restore` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_search_threads.search` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_stats.stats` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `forum_unwatch_thread.unwatch` | yes / yes | DELETE / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `forum_watch_thread.watch` | yes / yes | PUT / no manifest key | ②候选 / UNCERTIFIED | forum_read_thread/transcript/notifications/reports; current state is not exact command receipt |
| `okr_read.read` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `scheduler.clone_disabled` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | scheduler.list/runs plus logical key/revision; no business-side-effect outcome proof |
| `scheduler.create` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | scheduler.list/runs plus logical key/revision; no business-side-effect outcome proof |
| `scheduler.disable` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | scheduler.list/runs plus logical key/revision; no business-side-effect outcome proof |
| `scheduler.enable` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | scheduler.list/runs plus logical key/revision; no business-side-effect outcome proof |
| `scheduler.list` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `scheduler.remove` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | scheduler.list/runs plus logical key/revision; no business-side-effect outcome proof |
| `scheduler.runs` | yes / yes | LOCAL / no manifest key | READ_ONLY | Authorized store read and occurrence projection; M/D self-service/access.js:252–279 |
| `scheduler.update` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | scheduler.list/runs plus logical key/revision; no business-side-effect outcome proof |
| `self_ops.job_disposition` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | self_ops.status/exact reconciliation; controlled execution evidence required |
| `self_ops.reconcile_turn` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | self_ops.status/exact reconciliation; controlled execution evidence required |
| `self_ops.status` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `workbench_propose.entry` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | workbench_read.entries/proposals/explain; exact lost-response correlation unverified |
| `workbench_propose.proposal` | yes / yes | POST / no manifest key | ②候选 / UNCERTIFIED | workbench_read.entries/proposals/explain; exact lost-response correlation unverified |
| `workbench_read.entries` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workbench_read.explain` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workbench_read.proposals` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workbench_read.search` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_assistance_action.bind_governance` | yes / absent | POST / key | ①候选 / UNCERTIFIED | workflow_assistance_read.detail/inbox; exact request/receipt join unverified |
| `workflow_assistance_action.create_and_bind_governance_child` | yes / absent | POST / key | ①候选 / UNCERTIFIED | workflow_assistance_read.detail/inbox; exact request/receipt join unverified |
| `workflow_assistance_action.escalate_to_human` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_assistance_read.detail/inbox; exact request/receipt join unverified |
| `workflow_assistance_action.resolve` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_assistance_read.detail/inbox; exact request/receipt join unverified |
| `workflow_assistance_action.resolve_current_governance_review` | yes / absent | POST / key | ①候选 / UNCERTIFIED | workflow_assistance_read.detail/inbox; exact request/receipt join unverified |
| `workflow_assistance_read.detail` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_assistance_read.owner_inbox` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_assistance_request.open` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_assistance_read.detail/inbox; exact request/receipt join unverified |
| `workflow_current_task_body_complete.read` | yes / absent | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `workflow_current_task_input.read` | yes / absent | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_definition_authoring.create_definition` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_definition_read Version/graph; exact response-loss receipt join unverified |
| `workflow_definition_authoring.create_draft_version` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_definition_read Version/graph; exact response-loss receipt join unverified |
| `workflow_definition_authoring.publish_version` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_definition_read Version/graph; exact response-loss receipt join unverified |
| `workflow_definition_authoring.replace_draft_graph` | yes / yes | PUT / key | ①候选 / UNCERTIFIED | workflow_definition_read Version/graph; exact response-loss receipt join unverified |
| `workflow_definition_read.get_definition` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_definition_read.get_definition_version` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_definition_read.list_definitions` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_dispatch_intents.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_dispatch_intents.list_ready` | yes / absent | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_domain_admin.create` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_domain_admin/get_owner/members; exact operation join unverified |
| `workflow_domain_admin.get` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_domain_admin.get_owner` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_domain_admin.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_domain_admin.set_owner` | yes / yes | PUT / key | ①候选 / UNCERTIFIED | workflow_domain_admin/get_owner/members; exact operation join unverified |
| `workflow_domain_admin.update` | yes / yes | PATCH / key | ①候选 / UNCERTIFIED | workflow_domain_admin/get_owner/members; exact operation join unverified |
| `workflow_domain_binding_reconcile.apply` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_domain_admin/get_owner/members; exact operation join unverified |
| `workflow_domain_binding_reconcile.plan` | yes / yes | POST / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_domain_instances.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_domain_members.add` | yes / yes | PUT / key | ①候选 / UNCERTIFIED | workflow_domain_admin/get_owner/members; exact operation join unverified |
| `workflow_domain_members.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_domain_members.remove` | yes / yes | DELETE / key | ①候选 / UNCERTIFIED | workflow_domain_admin/get_owner/members; exact operation join unverified |
| `workflow_execute.archive_instance` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_instance_detail/submission_history; exact create response-loss ID/join may be missing |
| `workflow_execute.cancel_instance` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_instance_detail/submission_history; exact create response-loss ID/join may be missing |
| `workflow_execute.create_instance` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_instance_detail/submission_history; exact create response-loss ID/join may be missing |
| `workflow_execute.transition` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_instance_detail/submission_history; exact create response-loss ID/join may be missing |
| `workflow_execution_escalation.create` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_assistance_read.detail/inbox; exact request/receipt join unverified |
| `workflow_global_instances.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_human_principal_projection.provision` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | Fixed provision readback seam; not general business-effect dedupe |
| `workflow_instance_detail.read` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_my_domains.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_my_tasks.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_owner_obligation.read` | yes / absent | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_owner_obligation.read_effect` | yes / absent | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_progress.checkpoint` | yes / yes | LOCAL / no manifest key | ②候选 / UNCERTIFIED | read_current; checkpoint attempt identity, not external business effect |
| `workflow_progress.read_current` | yes / yes | LOCAL / no manifest key | READ_ONLY | Local read seam; runtime availability unverified |
| `workflow_submission_history.list` | yes / yes | GET / no manifest key | READ_ONLY | No business write in manifest |
| `workflow_wake_dispatch_intent.wake` | yes / yes | POST / key | ①候选 / UNCERTIFIED | workflow_dispatch_intents.list; no generic stable-effect proof |

#### Harness failures, limitations and stop ruling

All errors remain in raw append-only history. Initial inventory loader misresolved bare `croner` as a relative package path (raw 9–28); after fail-loud Cron stub, M full run rc=0 (50). D engine import then needed its literal `STALE_NO_PROGRESS_JUDGMENT` export (51–63); repaired by parsing exact-version ledger constants. M additional tail control alone rc=0 (67), avoiding repeat of passed managed scenarios. D then executed throw-fairness/control/wake/inventory and absent-managed result (68–79; pre-plan case 70 excluded as unsupported), followed by an old-vs-new transport layout lookup error (80–98). Correct exact D inline transport was selected; D affected transport-only rerun rc=0 (101). These are explained harness/path errors, not unexplained product-source validation failures. Separately, independent review identified D pre-plan fixture incompatibility and withdrew that interpretation as described above; D throw-case evidence remains valid. The first shell invocation ended in `tail`, so its outer shell rc was 0 although the harness propagated Node rc=1 internally; later shell invocations explicitly capture and return harness rc. No outer rc=0 is used to mask the raw child failure. No claim of zero failed commands is made. The final harness can run both full revisions, skipping unsupported D pre-plan fixture; this evidence intentionally reuses earlier passed observations and reruns only repaired dependencies/added control. Commands in order: `python3 docs/evidence/ekr-preflight/g6-g7-harness.py` (twice, first `>` then `>>` raw capture); `python3 docs/evidence/ekr-preflight/g6-g7-harness.py --revision eb8fd18934d827cec98faacaef987869c5cb92e7 --only-control`; `python3 docs/evidence/ekr-preflight/g6-g7-harness.py --revision fa4510beb6b01e5c40000a2ae36a62c526759e76`; `python3 docs/evidence/ekr-preflight/g6-g7-harness.py --revision fa4510beb6b01e5c40000a2ae36a62c526759e76 --only-transport` (all later captures `>>` preserve history).

Exploration noise: nonexistent `packages/broker/src/capabilities/workflow-execution/owner-obligation-guard.js`, `packages/broker/manifests`, Svc shorthand `src/owner_obligation/reconcile.rs`, scheduler `src/validation.js`, and D missing guard path were corrected to archive paths. A Python exploratory non-raw regex emitted SyntaxWarning. A `rg` against D self-service barrel had no match; its actual `self-service/access.js:252–279` was then verified read-only for scheduler.runs. No missing dependent product data was inferred from a path guess; all required fixed revision objects exist. These do not trigger the R3 stopping conditions.

UNKNOWN: live loaded SHA and allowlist; Svc deployed SHA; actual backlog; actual DB/Svc transaction concurrency/restart/fault injection; old attempt/Router execution termination; all native/MCP/plugin side effects; arbitrary external operation readback; human-answer autonomous ingestion/authentication/verification/re-wake; actual unattended business closure. No production action, restart, retry, fence clear or UNKNOWN replay was performed.

Artifacts: harness SHA-256 `d9e9bdbdd40efce31c8c0d244d906c05e324722b1e1fdf4377a11321ff2010d4`; raw SHA-256 `f16e67a3b4a3beb0313d13a361d308793ccbdf1482e45b48a13ca1d80d102dbe`. Reproduction: `python3 docs/evidence/ekr-preflight/g6-g7-harness.py` (stdout contains original JSON observations, stderr experimental VM warning; nonzero Node result propagated). Product source unchanged by this sub-audit.


#### Svc bounded state-to-consumer/trigger closure inventory (R3 appendix)

This appendix completes **enumeration and static consumer mapping** for the S-owned obligation/effect/assistance states delegated from G8. It does not close dynamically unknown liveness, storage or production claims. Source coordinate remains S only. Search scope: all archived S `src/**/*.rs` plus `migrations/**/*.sql`; exact state strings, UPDATE/INSERT/SELECT transitions, `intents::completed/retire/stop`, `reconcile_configured/pending`, effect execute/read and outbox preparation/settlement callers. No tests, local checkout HEAD or external consumer were used as production state evidence. No located consumer means **UNKNOWN / none established in this bounded source search**, not proof that no external operator/application exists.

Authoritative storage enumerations: migration `0031_owner_obligation_workflows.sql:35` has seven intent states including UNKNOWN; `:71` has five effect states; `src/domain/workflow_instance/assistance.rs:11–25` has four Assistance states. `workflow_owner_managed_instances` has no independent durable `state` column: its four exposed states below are computed projection, never a second executor. Schema-admitted PREPARED/STARTED/UNKNOWN rows are not a claim that such a row was durably observed in production.

Common entries and permission gates:

- `main.rs:49–64` starts a producer loop every 2s, with missed ticks skipped; each tick calls `reconcile_configured`, logs errors and continues. `owner_obligation/reconcile.rs:25–35` uses only the trusted configured actor; absent actor still runs mismatch-stop check and does no materialization. `:96–117` locks Domain/intent and rechecks enabled AGENT policy actor, approved policy digest, enabled Domain/effective Owner and current source case/visit. Global read permission alone is not write authority.
- Managed relation/effect HTTP reads require `workflow.read` (`http/handlers/owner_obligation.rs:31,49`), with existing instance visibility checked in `owner_obligation/reads.rs:42–65`. Effect writes require `workflow.execute` (`handler:60`); `effects.rs:84–118` locks authoritative source/managed coordinates, requires actor=current Owner=current managed assignee, exact current visit and approved slot/descriptor/arguments, then checks the stable effect key. None of these readers grants retry authority.
- `forum_sync.rs:1205–1233` starts its own configured outbox loop; pass panics are contained. Svc restart reconstructs producers/readers from DB rows through these startup entries; actual process/DB restart was not executed. A global timer rescanning persisted rows is distinct from a durable per-responsibility next-check field.

`R/` below is `src/store/postgres/workflow_instance_repository/`.

| Persistent obligation intent state (all seven) | Consumer / permission and prerequisites | Durable next trigger / failure responsibility | Closing condition / explicit boundary |
|---|---|---|---|
| PENDING INTAKE/REVIEW | Configured policy producer, `reconcile.rs:79–87,96–117`; exact approved actor/source/Owner/visit | Durable row, 2s global rescan; no per-intent next-check/backoff timestamp. 5xx remains unresolved and can abort stable first-64 batch | Original command/managed birth -> MATERIALIZED (`:199–200`); deterministic <500 -> BLOCKED_KNOWN (`:218–224`); invalid source -> RETIRED; actor mismatch -> STOPPED |
| MATERIALIZED INTAKE/REVIEW | Actual managed Workflow current visit consumed by existing Core WAE; S completion producer `assistance_transaction/governance_child/terminal.rs:101–106` -> `intents.rs:193–198` | Durable managed workflow/intent and existing due feed; producer cleanup checks source lifecycle. No separate intent retry/materialization | Actual managed terminal event -> COMPLETED; source lifecycle -> RETIRED, actual policy/Owner/bounds failure -> absorbing STOPPED; wake ack does not complete |
| BLOCKED_KNOWN | Not selected by producer PENDING query. Case projection retains it (`case_projection.rs:35–55`) | Failure receipt/outcome retained; automatic retry/re-materialization consumer not established. Migration `0031:100` forbids return to PENDING | Existing direct source-lifecycle retire can preserve closure (`intents.rs:202–208`), where applicable; automatic business recovery remains UNKNOWN |
| UNKNOWN | Read projection admits it (`case_projection.rs:35–55`); no automatic UNKNOWN-specific producer found | Responsibility retained; no located durable next-check/authorized readback scheduler; `0031:100` forbids UNKNOWN -> PENDING | Authorized evidence/closure path not established by this source search; source-lifecycle retire may record actual closure, never blind retry or assumed zero |
| STOPPED (including STOP-kind sidecar) | Existing reads/current Owner visibility; actual Owner change/execution/RETURN/policy mismatch producers establish STOP provenance | Absorbing state (`0031:94–100`); no automatic reopen. Durable stop remains visible even before managed birth | No in-place reopen; legal successor would require its own accepted authority/entry. Stop is not business success |
| RETIRED | Configured cleanup finds retired managed children (`reconcile.rs:243–261`), exact approved configured actor | Durable row; periodic cleanup uses stable `owner-cleanup:{intent}` cancel command. Single cleanup error can defer remaining work | Each actual child cancellation/terminal closes child resource; intent remains absorbing RETIRED, not reset to PENDING |
| COMPLETED | Read-only historical projection; original managed terminal Event remains cause | No future execution responsibility for this intent; history retained/immutable | Absorbing completion (`0031:94–100`); not equivalent to entire source business case completion |

| Durable effect state (all five) | Consumer / permission and prerequisites | Durable next trigger / failure responsibility | Closing condition / explicit boundary |
|---|---|---|---|
| PREPARED | Internal effect transaction prepares stable slot (`effects.rs:166–172`); authorized GET can project state | No automatic scanner/reexecute located; a later same-key execute returns outcome_unknown (`:118–132`) | Actual transaction may continue to STARTED then success/known rejection; no claimed persisted PREPARED in live DB; a surviving uncertain effect is readback-only |
| STARTED | Same transaction binds actual command receipt (`effects.rs:228–239`); authorized GET | No located automatic settlement consumer/next-check timer; later execute is UNKNOWN, not a second business command | Actual same command/facts transaction -> SUCCEEDED or REJECTED_ZERO_FACTS; ambiguous outcome never assumed rollback |
| UNKNOWN | Authorized effect GET; same-key execute rejects as `outcome_unknown` (`effects.rs:118–132`) | No specific UNKNOWN transition producer or automatic reconciling scanner established in archived source; keep original identity/responsibility | No new body/key/attempt identity retry; actual command/readback or authorized escalation required, automatic closure UNKNOWN |
| SUCCEEDED | `reads.rs:108–125` joins original successful receipt/result; guarded same-semantic effect execute returns original result (`effects.rs:124–127`) | No repeat business effect; immutable (`0031:87–93`). Same guarded POST may read/replay original receipt | Original effect/command/result/digest preserved; conflicting body rejected before replay |
| REJECTED_ZERO_FACTS | `reads.rs:126–132` validates original completed non-2xx with zero business events; execute returns `OPERATION_REJECTED_ZERO_FACTS` (`effects.rs:129–130`) | Immutable known failure; no automatic retry. New current attempt does not reset it | Existing rejected outcome stays; changed-input correction/recovery not authorized by current Owner contract |

| Assistance state (all four) | Consumer / permission and prerequisites | Durable next trigger / failure responsibility | Closing condition / explicit boundary |
|---|---|---|---|
| OWNER_PENDING | Current Owner inbox/detail; legacy durable wake; opted-in intake producer routes true Workflow instead of naked chat (`Owner V3:305` and `governance_child/review.rs:32–34`) | Owner wake retry uses outbox `next_attempt_at`; case itself has no response-validation retry clock established. Open case excludes ordinary source dispatch (`query_dispatch_intents.rs:129–132,181–184`) | Authenticated current Owner exact CAS + proof resolves or explicitly escalates (`assistance_transaction/write.rs:247–355`); lifecycle voids it; successful wake alone leaves pending |
| HUMAN_REQUIRED | Human-required authorized minimal read/Forum notification; current Owner resolve may accept this state (`checks.rs:92–96`) | Open-case fence remains; durable FORUM_EVENT retries are notification responsibility only. No human-answer ingestion/authenticated automatic re-wake chain established | Actual authorized resolve -> RESOLVED, source lifecycle -> VOIDED. Managed stopped intent is not reopened by this status; automatic HUMAN_REQUIRED/handoff deferred by authority |
| RESOLVED | Current same-visit resume evidence read (`query_owner_assistance_resume_evidence.rs`); Core existing Owner-resume WEC route can consume exact resolution proof | Durable resolution receipt/Event; no assistance-owned resend of original business operation. Core due/reconcile machinery determines lawful resume | Case closed; proof must match current world and existing Core gates. Its own successful managed review effect can finish REVIEW (`owner_obligation/reads.rs:67–84`) without second resolve |
| VOIDED | Historical detail/projection and source-lifecycle cleanup | Durable void provenance; no ordinary source-work retry responsibility | `assistance_transaction.rs:452–465` voids only open cases and retires dependent responsibility; no reopening inferred |

| Derived managed/read or review projection | Consumer / prerequisite | Trigger / closure |
|---|---|---|
| Managed ACTIVE | `owner_obligation/reads.rs:73–84,166–175`; live managed/source relation or own successful REVIEW effect | Projection only. Existing current-visit WAE handles execution; not a new durable intent state |
| Managed STOPPED | Exact intent STOPPED | Absorbing stop projection, authorized reads only |
| Managed RETIRED | Live predicate false / retired relation | Read projection, separately retained child-cleanup responsibility; no implied automatic business successor |
| Managed COMPLETED | Exact intent COMPLETED or managed current node TERMINAL (`reads.rs:169–170`) | Historical actual terminal state; no repeat operation |
| Review delivery PENDING / DELIVERED / RETIRED | `assistance_transaction/governance_child.rs:98–102` derives from row retirement and outbox delivered_at; `review.rs:76–155` revalidates before delivery | Outbox scheduled retry until delivered/suppressed; retired delivery is not completed business review |
| Review business OUTSTANDING / RESOLVED / ESCALATED / VOIDED | `governance_child.rs:99` derives from actual Assistance status | No independent review executor. OUTSTANDING persists despite delivery ack; other values follow real case transition |

Owner/Forum notification transport states are flag predicates, not a business-state enum: outbox PENDING means `delivered_at IS NULL AND dead_lettered_at IS NULL AND next_attempt_at<=now()` (`src/store/postgres/outbox.rs:157–187`); transient claim is transaction `FOR UPDATE SKIP LOCKED` (190–213), automatically released on connection loss; delivered is actual acknowledged HTTP (215–226). Failure persists attempts/error plus exponential next_attempt_at capped at 600s (229–255). OWNER_ASSISTANCE_WAKE and FORUM_EVENT pass no retry cap (`forum_sync.rs:1051–1064`) so do not become dead-lettered from ordinary retry exhaustion; generic latency-only EXECUTION_KICK can dead-letter after 12 and is outside business-completion proof. Existing dead-letter flags never authorize automatic replay; any manual requeue is not performed or authorized here.

Static scope closure: intent 7/7, effect 5/5, Assistance 4/4 enumerated, plus derived managed/review projections and notification transport predicates. Consumer gaps are explicit UNKNOWN rather than omitted rows. Svc deployed identity, real persisted rows, exact runtime configuration and actual recovery/notification/business outcomes remain UNKNOWN.


### 9.4 G8 — Core 调度状态全集与双版本内存验证

分组原文：[G8-R3.md](G8-R3.md)。以下为该分组追加证据；原始结果链接在文中。

### G8 / EKR-SCHED — R3 bounded state inventory and isolated execution

STATUS = COMPLETE (this source-preflight group, with the UNKNOWN boundaries below)

Coordinates: M=`eb8fd18934d827cec98faacaef987869c5cb92e7`; D=`fa4510beb6b01e5c40000a2ae36a62c526759e76`. Evaluator: `schedule_inventory` child of the R3 primary agent. Node `v26.7.0`, Python `3.14.7`. No product file was edited. The original matrix/G1 and prior receipts were not edited by this group.

Governance: `.agents/README.md`, `.agents/local/README.md`, Product Architecture (external Workflow remains owned by Svc; Broker acts with trusted identity), D-009, Spec-governance COMPLIANCE mode. Relevant accepted Contracts in M: WAE V3 CTR-WAE-001/001b/002/004/005/006/011/012/013; WEC V3 CTR-WEC1-002/004/005/006/008; SRE V2 CTR-SRE-002/003; Scheduler Timeout Outcome V3 C-001/002/003/005/006/008/026/027/029/039; D009 Alignment CTR-527D2-001..004. This report assesses the exact source behavior; it does not authorize changing any Contract. D retains its own archived WAE/WEC implementation and is not assumed to implement M-only Owner resume or readiness extensions.

The bounded inventory is complete for the WAE ledger's state/phase/judgment classes and Scheduler occurrence states found in the two archived Core packages. Svc obligation/effect/assistance states belong to G6/G7; Router reconciliation dispositions are inputs to these consumers, not additional Scheduler business states. Completeness of this table is not a claim of runtime recovery or product conformance PASS.

#### 1. WAE state and responsibility inventory

Source completeness basis: M `ledger-events.js:97–335` / D `:95–314` enumerate the ledger events and the only base states `ACTIVE`, `NEEDS_REVIEW`, `SETTLED`; M `projection.js:23–41` gives the derived labels; D preserves the earlier projection. A `run_running` judgment is a reconcile observation, not an extra durable phase. `recovery_authorized` annotates an existing blocked attempt; `progress_checkpoint` and `escalation_requested` annotate responsibility and never prove business completion.

All file paths in this section are under `packages/workflow-execution/src/` unless prefixed otherwise. Line pairs mean M / D, respectively.

| Durable class / responsibility | Actual automatic consumer and trigger | Permission / next failure responsibility / close condition | M versus D evidence |
|---|---|---|---|
| Fresh Svc due activation, no Core attempt; pre-plan unavailable | Interval `pollOnce` and coalesced kick read Svc due feed again; fresh pages restart from page one each poll. No fabricated attempt when planning proof is unavailable. | Poller Principal and server-side global scheduler read; canonical assignee resolved separately. Due responsibility remains in Svc until business predicates change. No persisted per-item retry timer in Core before attempt exists. | M engine `325–402`, runtime `245–278`; D engine `346–422`, runtime `224–243`. M uses `list_ready` validated READY projection and accepted execution policy/pre-plan evidence; D uses its older due feed. Budget/fairness gap belongs to G6. |
| ACTIVE / ordinary planned | Startup reconcile and each poll enumerate `listActiveFresh`; without verified Run linkage, judgment becomes NEEDS_REVIEW / delivery_unverified. | Ordinary planned is not a safe automatic resend authorization. Original attempt remains recorded; no new request is minted by reconciliation. | M engine `240–299`, judgment `343–350`; D engine `257–306`, judgment `172–179`. |
| ACTIVE / planned, retryReason owner_assistance_resolved | M first reconcile loop calls `continuePlannedOwnerResume` before normal judgment. | Exact never_existed-only correlation, fresh matching due identity, current assignee/visit and unchanged preDeliveryWorkflowStateVersion; durable delivery_started before dispatch. Failed proof retains responsibility; does not infer zero effects from missing data. | M engine `241–250`; `owner-assistance-resume-engine.js:83–158`; ledger `275–276`. This path is absent in D. |
| ACTIVE / resolution_blocked (including historical resolve_failed projection) | Enumerated each reconcile, counted blocked and deliberately skipped. Explicit `recoverAttempt` exists; no automatic production caller was found. | CTR-WAE-013 authorityRef + exact fresh world/Router absence gate. Same attempt/request. Resolution fails → blocked again; world drift → recovery_refused terminal review; delivery domain → recovery inapplicable and existing reconcile owns it. | M engine `255–258`, export `438–453`, runtime forwarding `456`; D `262–265`, runtime `417`. M/D recovery.js identical per prior matrix; accepted anti-auto-retry meaning retained. |
| ACTIVE / delivery_started, no delivered linkage | Startup/periodic reconcile applies delivery_unverified and exits ACTIVE. | Write-ahead fence proves possible invocation; unknown must not be resent. Subsequent auto-readback responsibility for this terminal judgment was not found in the three candidate sets. | M ledger-events `162–175`, engine `260–299`; D ledger-events `141–154`, engine `267–306`. |
| ACTIVE / run_delivered, Router pending (derived RUNNING) | Every reconcile queries exact delivered handle/caller correlation; old delivered age also permits a stale business probe. | Target Agent identity reads instance detail. Positive business progression/terminal Svc facts are distinguished from Router activity. Pending normally stays ACTIVE. Stale re-entry requires unchanged baseline/version and proven quiescence before another generation. Missing baseline/version change suppresses stale eligibility (G5). | M engine `198–237,260–275`; owner-resume query `60–74`; D engine `197–245,267–282`. Owner-resume generations are excluded from ordinary stale loop in M. |
| ACTIVE / run_delivered, Router settled/lost | Same reconcile loop performs target-Agent settle probe. | Historical-participant visibility or a different current visit → SETTLED; ended+same visit → run_ended_no_submission; unreadable probe → settle_check_unavailable; lost outcome+same visit → run_outcome_unknown. The ordinary settle probe does not inspect is_terminal; that field belongs to the separate stale probe's progressed result and suppresses stale re-entry. No automatic second delivery from this probe. | M/D judgeSettleFromDetail `67–88`; M judgment `343–378`, engine `277–299`; D judgment `172–207`, engine `284–306`. |
| NEEDS_REVIEW / run_ended_no_submission (derived RUN_ENDED_NO_TRANSITION) | Stale candidate loop and retryDelay loop read fresh terminal candidates; business stale predicate gates continuation. | Retry delay is 60s default; max attempts comes from applicable policy. At limit, idempotent Svc Owner assistance is requested; failed escalation remains retriable through existing due/candidate entrypoints. Quiescence and identity gates precede new generation. | M ledger `441–473`, terminal-attempt-operations `24–32`, engine `303–319,68–101`; D ledger `666–678,722–732`, engine `310–341`. M excludes Owner-resume attempts from these ordinary candidate sets. |
| NEEDS_REVIEW / settle_check_unavailable | Not in ACTIVE, stale-terminal, or run-ended candidate predicates. | Persisted unknown/review record remains; no next-check timestamp/automatic readback consumer for this judgment was found. This behavior is required by current CTR-WAE-006; changing liveness semantics needs authority routing (matrix §2). | M ledger `427–473`, D `652–678,722–732`; G2 provides dynamic evidence. |
| NEEDS_REVIEW / run_outcome_unknown | Same candidate exclusion as above. | Original run/outcome remains unknown; explicit business/termination facts required. Never admitted as a retry by the ordinary run-ended path. | Same exact predicates; M projection `33–37` groups it as OUTCOME_UNKNOWN. |
| NEEDS_REVIEW / delivery_unverified or delivery_failed | Same candidate exclusion, except legacy resolve_failed was already reclassified ACTIVE blocked on replay. | Terminal ambiguity/rejection is retained; cannot assume a new request is safe. Generic automatic return to ACTIVE was not found. | M ledger-events `264–285`, D `243–264`; judgment and candidate predicates above. |
| NEEDS_REVIEW / recovery_refused | Not automatically retried by poller; explicit refusal is durable. | Fresh world no longer authorizes this original visit/assignee. Human/Owner business path owns closure; no reopening of old admission via recovery. | M ledger-events `201–214`; D `180–193`; recovery Contract E5. |
| System escalation / derived OWNER_PENDING | Core records the Svc assistance fact after successful call; Svc owns assistance state. M fresh due/resume proof can authorize one Owner-resolved generation. | Wake pending/settled is not business obligation completion. Human escalation/answer/validation responsibility is covered in G6. An escalation annotation is not a new Core state or case executor. | M engine `68–101`, projection `27–37`, resume-engine `77–80`; D escalation path exists, M-only resume proof is absent. |
| SETTLED / stale_no_progress (business still unfinished) | New due sweep may begin generation N+1 after existing stale marker, identity, policy-limit, quiescence and plan gates. | Prior attempt stays terminal; only the exact legal successor is minted. At cap the existing escalation mechanism owns handoff. | M ledger-admission `33–84`, ledger-events `106–125`; D ledger inline predecessor/generation guard and stale re-entry path; prior G1 retains cross-attempt weakness. |
| SETTLED / business_commitment_observed | Terminal; no attempt replay. Svc may independently issue a new visit's activation. | Means visit moved past original commitment, not business quality/whole-workflow success. | WAE CTR-WAE-010; M/D judgeSettleFromDetail and ledger terminal guards. |

Persistent trigger and restart scope: M `ledger.js:154–195,257–269` / D `:158–199,261–273` replay JSONL under the existing FIFO/OwnerLock. The `*Fresh` methods call mutate, which may repair a torn tail: they were **not called against a filesystem ledger here**. M runtime `463` / D `424` starts the engine; startup reconcile M `461–470` / D `481–490` rediscovers the same candidate classes; interval defaults to 30s and kicks are coalesced. M stop `474–487` / D `494–507` drains active poll/startup reconcile. Source existence does not establish production enablement, timer liveness, physical durability, or recovery of excluded terminal unknown classes.

#### 2. Scheduler occurrence inventory

M `occurrence-model.js:48–68` / D `:42–62` define exactly five business states: admitted, running, succeeded, failed, outcome_unknown. Termination settlement is a separate annotation, not a sixth outcome. Scheduler main-loop file is byte-identical in M/D: SHA-256 `778a8ebc2e67284dbd771c522359dd04150b3c892d03ffe36aa4dbb73b8f3943`.

| State / responsibility | Automatic consumer / durable trigger | Permission and failure responsibility | Close/restart behavior and source |
|---|---|---|---|
| Due natural / explicit policy retry candidate, not yet reserved | Engine timer default 1s; tick re-reads latest document, then authoritative reserve rechecks within store mutation. | Enabled job, no same-job fence/nonterminal record, current revision, unique logical coordinate, runnable target. Ordinary failure retry requires explicit job.retry.auto; retry is new occurrence. | Both `scheduler.js:215–325`; reserve M `occurrence-reservation.js:13–116`, D inline occurrence reserve. Job-local failure isolation continues bounded work; global fatal aborts tick, existing durable records retained. |
| admitted | Real invocation path, with durable record committed before call. onStart records running; deadline/outcome writes exact occurrence/run identity. | No second admission for same coordinates. Pre-start proven rejection may fail; unproven failure stays unknown. | Restart before proof: `start:139–154` mandates `_sweepUnresolved:357–383` → outcome_unknown+fence. No re-admission. |
| running | Same invocation/absolute execution deadline; outcome and late watcher consume original promise. | Timeout/abort request alone does not prove termination. Result writeback re-reads latest state and exact run/payload/revision. | Restart → unknown+fence; successful proof → succeeded, proven terminal failure → failed; otherwise unknown. M occurrence `50–147,170–220` / D `163–261,284–334`. |
| outcome_unknown, no trusted termination or business settlement | Every tick optionally consults exact Router readback before new admission; absent lookup is fail-closed. Optional separate default-off policy mount in M; explicit operator/self reconcile also exists. | Tick has engine lease, owned exact occurrence/run/request; Router proof must match trusted current evidence. pending/mismatch/lost/unavailable keeps record/fence; no blind retry. In-memory consult rate limit defaults 60s and resets after restart; target identities are rediscovered from durable doc. | M occurrence `360–429` / D `474–543`; scheduler `258–274`; model M `372+` / D `365+` rebuilds fence. Source consumer exists in **both** M and D, independent of M-only extra policy mount. |
| outcome_unknown + trusted terminationSettlement | Business uncertainty remains visible; future natural eligibility can resume. M auto-policy planner can later accept exact late business outcome; current built-in unresolved-only tick loop excludes already terminated unknowns. Explicit operator business settlement also permits businessUnknown without lateSettlement. | No same occurrence retry; one-shot disable policy and recurring future-natural-only policy. Termination != business outcome. No inference from restart_lost/evicted/missing evidence. | M/D eligibility `41–59` treats terminated unknown operationally terminal. M control `365–416` / D same entry lines; unknown→admitted transition absent. Actual future scheduling after such settlement was not dynamically exercised here. |
| succeeded | No replay. Natural future slot computed from definition and terminal end/refire gap; one-shot success disables/deletes per policy, preserves occurrence evidence. | Delivery status is separate; announce failure cannot erase execution success. | M occurrence `150–167,440–468`; D equivalent `264–281,554–582`. Restart sweep leaves succeeded unchanged. |
| failed | No same occurrence replay. Only explicit retry policy can mint a separate retry occurrence with predecessor link; normal future natural schedule follows defined hold/backoff. | Non-idempotent default auto retry is off. Revision-stale retry predecessor is receipted and not minted. | Both eligibility `148–191` and scheduler `276–291`; restart sweep leaves failed unchanged. |

Permissions and triggers outside main tick: operator reconcile is control-only, exact occurrence+run, required evidence note, trusted effective OS user captured by function; both `control.js:334–416`. Caller self reconcile derives caller from trusted context, checks ownership twice and demands exact trusted termination proof; both `self-ops/index.js:159–202`. M extra policy mount `production-runtime/src/scheduler/auto-reconcile-runtime.js:37–78` is default OFF, 15-minute default interval, retry-next-tick on error; exact evidence gates are in `scheduler/src/auto-reconcile.js:35–98,134–173`. D lacks this extra module/composition mount, but still has the built-in tick readback consumer above. M composition `44` discards extra mount handle and its stop only clears timer; prior H04 fixture evidence remains valid and is not rerun here. This report makes no claim about live tree or loaded production code.

#### 3. Executed observations and limits

`g8-harness.py` runs `git archive <exact SHA> packages/scheduler/src` into Python memory and links original JS modules in a VM. Native bindings allowed to product module graph are crypto plus a forbidden OS-identity stub. Cron construction and interval creation throw; only every-schedule behavior is exercised. Product storage, lease, Router and history seams are memory-only; no product filesystem API is linked, no service is started, no DB/live/process state is accessed. The memory store serializes clone/apply commits; it cannot establish fsync, locks across processes, crash consistency, or full JobStore validation.

Command used for persisted raw output: `python3 docs/evidence/ekr-preflight/g8-harness.py > docs/evidence/ekr-preflight/g8.raw.txt` (`rc=0`). Initial console execution also returned 0; repeat produced the reviewable raw artifact. Both Node child processes returned 0; Python propagates a child nonzero immediately.

- OBS-G8-R3-M / OBS-G8-R3-D: actual Scheduler start + sweep transforms admitted/running into unknown, retains three fences, preserves succeeded/failed, and performs zero startup invocations. One normal every slot admits once and succeeds; repeated same-slot tick and second engine constructed over the same **memory** document perform no extra invocation. stop followed by tick admits nothing.
- OBS-G8-R3-OUTCOME: actual classifier maps unproven error to unknown, definite pre-start rejection to failed, and outcome_unknown with termination evidence still to unknown. Actual state machine refuses unknown→admitted. No fixture rewrites product behavior.
- EVD-G8-R3-001: SATISFIES the bounded mechanisms of Scheduler C-001/002/003/006/008 and restart rules at M/D in this injected environment. It is INCONCLUSIVE for persisted-store, real process/Router/DB and runtime deployment conformance. Overall product conformance remains UNKNOWN/DRIFTED as independently documented in G1–G7/H04; these mechanism PASS results do not close those defects.

Raw results are preserved verbatim in [g8.raw.txt](g8.raw.txt), including both full revision coordinates, node return codes, observed states/fences/call counts and explicit `filesystemLedger:false`, `realProcessRestart:false`, `productionWrites:0`.

UNKNOWN / not executed: real JobStore persistence and fsync/rename/lock behavior; real process crash/restart; runtime configuration, current epoch lookup availability and enablement; actual timers/clock progress; cron/at scheduling execution; true Router/agent execution or external effects; termination-only→future natural tick and late business settlement integrated execution; production backlog/fairness/consumer uptime; Svc durable DB and cross-service notification/result closure; physical business acceptance. No UNKNOWN is treated as zero or PASS.

Exploration log (non-product failures, continued under R3): `rg` guessed unprefixed WAE/WEC Spec filenames that do not exist (`rc=2`), then located actual `AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3.md` and `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md`; one filename regex returned no matches (`rc=1`), preventing the dependent `&&` reads in that exploratory call, which were subsequently read explicitly; `sed` guessed `test/restart-recovery.test.js` and `test/engine.test.js` absent (`rc=1`), then actual `test/scheduler.test.js` was located. Expected absent D files were recorded as ABSENT through read-only git-object lookup and were not dependency failures. No product assertion failed.

SHA-256 at report assembly: harness `6a3c16fb7e6a04bad2f8dc6b48dbeed02e3ff11df04661785a3233b43b20403e`; raw `6b70a306436e639d166bb57f229da082eea1c105879135925ca1ec4508cf474b`.


### 9.5 R3 最终预检定稿

R3_FINAL_STATUS = COMPLETE

COMPLETE_SCOPE = #1374 §1 / 本轮只读源码 + 内存桩预检与缺陷处置清点

PRODUCT_SOURCE_CHANGED = NO
PRODUCTION_WRITES = 0
PRODUCT_REPAIRED = NO
PERSISTENT_PROCESS_DB_E2E_VERIFICATION = NOT_RUN
OVERALL_PRODUCT_CONFORMANCE = UNKNOWN
IMPLEMENTATION_MERGE_PERMISSION = NONE
MERGE = FORBIDDEN

G1 原文及 §1–§8 原始停止快照全部保持原字节；本轮只追加 §9。矩阵原前 29,999 字节 SHA-256=`94826f2b25bb60905cd04289c73f12abad2d1d097c62a109b2b449141563973d`。历史 `STATUS=STOPPED/INCOMPLETE` 描述前两轮快照；本节为 R3 预检完成状态，不把历史失败改写为 PASS。

- G2/G3/G4：双版本真实无 I/O engine/recovery/judgment + 原 candidate methods + 内存提交完成；原目标缺口仍在。B2 的显式恢复 gate 存在且已核，不能误称完全无恢复方法。
- G5：恢复原 harness 并修替换顺序，双版本有效运行完成。
- G6/G7：Core 源码/内存桩、Svc 源码、bounded Broker 工具 M119/D110 operations、Svc intent7/effect5/Assistance4 状态及派生/通知责任全部清点；自动消费者/精确副作用回查未建立证据的格子明确 UNKNOWN。D 不支持 pre_plan_unavailable 的 synthetic case 已撤回相应解释；tail sentinel 只证明候选发现，不是健康业务准入。
- G8：Core WAE state/phase/judgment、Scheduler 五态与消费者/前置权限/触发/失败责任/关闭边界清点完成。**D 缺额外 policy mount 不等于 D 无自动读回：M/D 都有内置 tick Router readback。** 普通 settle 与 stale 的 terminal 判定也已分开。真实 store/process restart 不在本轮证据内。
- G1 沿用前轮有效范围且未重跑；其真实 ledger/多进程缺口继续保留。所有正常对照、缺陷观察、独立 review 的适用范围见本轮 [回执](RECEIPT-EKR-PRE-R3.md)。

下一步只完成本次授权的证据 commit/push/PR 引用 mayf3/agent-control#1374，然后停止。任何产品修复、authority successor、真实隔离持久环境测试、合并、安装/部署及 UNKNOWN 业务恢复均不由本 COMPLETE 授权。
