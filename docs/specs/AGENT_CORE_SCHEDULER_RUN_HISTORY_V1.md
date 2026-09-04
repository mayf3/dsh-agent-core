---
spec_id: AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
status: accepted
accepted_date: 2026-09-02
accepted_by: mayf3
accepted_reviewed_base: 840d2f4ad91f8252eb1f163330c041216a0dd9c4
accepted_reviewed_spec_commit: 4c285c6d104b7de301b27b05fa39551ca488a2e5
final_audit: 调度历史 审计（G1 promotion-context independent audit，PASS：
  0 blockers / 0 majors / 3 minors / 3 notes）
final_audit_result: PASS
required_fixes: NONE
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-08-31
revision: r2（2026-09-02 现状事实刷新修订（preparation track）：按 R1 调查
  SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1 + scheduler-code-excerpts 修正三处
  stale 现状事实——S1：§2.1「现行引擎 = pre-D-007」FALSE，BASE 引擎已
  D-007-conformant（occ:/run: 身份、idempotencyKey=occurrenceId、
  reserve-before-Router admission、五 durable states 全可达、fence + late
  settlement），§2.1 以 BASE file:line 重写；S2：「执行记录无 occurrence/run
  身份」FALSE，BASE 已有 v2 occurrence authority ledger（jobs.json 内、
  job 删除后保留）+ runs.jsonl（10MB 轮转）且均携带 occurrenceId/runId，
  缺口陈述改为真实 delta（结构化业务结果摄取、summary/final_status 持久化、
  独立 history store、HTTP 查询 API、scheduler.read/audit/admin token 门、
  真缺的 correlation 字段、job_snapshot）；S3：governed_by D-006 → D-008
  （AGENT_WORKSPACE_SESSION_MODEL_V3，accepted）。r1 的全部目标语义、冻结
  字段集、D-007 状态映射、结构化结果合同、deleteAfterRun 语义、history store
  布局、查询 API 面、权限模型名零变更；仅事实修正所迫的措辞调整。）
task_name: 调度历史 规格
task_type: SPEC_AUTHORING_ONLY
scope:
  - Scheduler 执行历史的 Occurrence / Run 记录模型与冻结字段
  - 任务状态词汇（scheduled/admitted/running/success/failed/timeout/cancelled）
    与 D-007 durable states（admitted/running/succeeded/failed/outcome_unknown）
    的冻结映射
  - 结构化业务结果（counters + final_status PASS/PARTIAL/FAIL）摄取合同
  - deleteAfterRun = 删除 Job Definition、不删除执行历史的查询面语义
  - history store（独立于 jobs.json 与 runs.jsonl）的布局与持久化纪律
  - 只读查询 API：GET /scheduler/runs、GET /scheduler/runs/{run_id}、
    GET /scheduler/occurrences/{occurrence_id}
  - 权限模型：scheduler.read（自己的 runs）/ scheduler.audit（全局 history）/
    scheduler.admin（job definition 变更，本 Spec 无对应端点）
  - Correlation 链（correlation_id / parent_run_id / request_id；与 agent_wake、
    workflow_execute 的 join 合同）
  - 实现闭包（accept 后评审路径）与 fixture 级验收（Case 1–4）
governed_by:
  - docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md（D-007，accepted —
    Current Scheduler Authority；本 Spec 的全部执行语义上位权威）
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md（D-008，accepted
    2026-09-01，standalone Current Authority，BASE 提交 b2e3eb1 — 整份取代
    D-006 / V2；scheduled session 模型上位权威）
  - docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md（accepted — Spec 元治理）
related_specs:
  - docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md（accepted 2026-08-22 —
    SCHEDULER_TIMEOUT_OUTCOME_V1 的 whole-authority replacement（V1 已
    superseded）；D-007 的 governing Spec；timeout/outcome_unknown/fence/
    occurrence authority store 语义出处；implementation_authority: contracts）
  - docs/specs/AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1.md（accepted
    2026-08-28 — agent self-service scheduler 工具面（create/list/runs/
    update/enable/disable/remove）；其 local entitlement 标签
    scheduler.read:self / scheduler.manage:self / scheduler.manage:any 是
    受信本地授权标签、显式非 auth-service token scopes；与本 Spec R8 的
    scope 家族调和义务见 §3 R8）
  - docs/specs/AGENT_CORE_AGENT_WAKE_CAPABILITY_V1.md（staged WIP、proposed、
    不在 BASE — correlation 链下游 agent_wake 合同；其 requestId 派生公式
    'wdhr1:<workflowInstanceId>:<targetAgentId>' 是本 Spec join 合同的对接面，
    以其 accepted 轮冻结文本为准）
  - docs/specs/AGENT_CORE_HR_DISPATCHER_V1.md（staged WIP、proposed r3、
    不在 BASE — Dispatcher 场景与其 §5.1 scheduler.* 工具 / scheduler.manage
    命名，见 §3 R8 调和义务）
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 — Scheduler 结构化执行历史（Occurrence / Run ledger + 只读查询面）

> 状态：**accepted**（2026-09-02 lifecycle acceptance；accepted_by = mayf3；
> accepted_reviewed_base = 840d2f4；accepted_reviewed_spec_commit = 4c285c6）。
> G1 promotion-context independent audit = **PASS**（0 blockers / 0 majors /
> 3 minors / 3 notes；docs/reports/agt-scheduler-run-history-g1-audit-v1.md；
> 前置 preparation audit PREP_AUDIT_SPEC_REVISIONS_V1 亦 PASS）。
> `implementation_authority = contracts`（§2.2 G2：实现闭包按
> GOVERNING_SPEC_UNMODIFIED 评审进行——实现轮不得修改本文件）；
> `production_apply_authority = none`（G3 生产部署 = 独立 operator 轮次，
> 本 Spec 不含）。§0–§9 为 authoring 轮原文（其「proposed / 零实现」表述
> 是 authoring 轮历史记录，acceptance 不改写）；本轮唯一 delta =
> frontmatter 验收元数据 + 本 banner。
> 本分支为 G2 实现 carrier（branch sched/run-history-integration-v1）；
> merge 进 main 与 G3–G5（部署 / scope 供给 / canary）均属独立后续轮次。

## 0. 任务语境与一句话模型

现状（BASE 840d2f4 核查；r2 修正——r1 对现状的两处描述 stale，本节按
SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1 重述）：

Scheduler 引擎**已经是 D-007-conformant**，且执行事实已有两个持久载体：

- **occurrence authority ledger 已存在**：jobs.json 是 version:2 文档
  `{version:2, jobs[], occurrences[], fences{}}`（store.js:12-16），每条
  occurrence 记录携带完整 D-007 身份（occurrenceId `occ:*`、runId
  `run:*`、scheduleRevision、idempotencyKey=occurrenceId、payloadHash、
  state、admittedAt、executionDeadlineAtMs、slot 坐标、history[]；occurrence-
  model.js:248-274）及执行事实（startedAt/endedAt/nativeSessionId/
  deliveryStatus/executionOutcome/terminalEvidence/lateSettlement；
  occurrence.js:293-330）。**deleteAfterRun 只删 definition，ledger 保留**
  （control.js:119-126）——"delete ≠ delete evidence" 在 BASE 已成立。
- **runs.jsonl 已携带 occurrence/run 身份**：append-only + fsync + 10MB
  newest-lines 截断的 evidence log（store.js:33-34, 399-448），事件
  occurrence_reserved / turn_start / router_admission / outcome / delivery /
  late_settlement / store_upgrade / lock_recovery 全部含
  occurrenceId/runId（occurrence.js:104-118, 140, 150-169, 334, 345, 412）。

**因此本 Spec 的价值不是「凭空建立执行事实」，而是补齐 BASE 真实缺失的
查询/语义层**（诚实 delta，逐项）：

1. **结构化业务结果**：无任何摄取点；counters / final_status 概念零实现。
   agent `summary` 不入 scheduler ledger 或 runs.jsonl（仅进 delivery 文本与
   production-runtime 的 invocation evidence 行：occurrence.js:243；
   compose.js:385-413）。
2. **summary / final_status 持久化**：execution outcome 有，业务结果无。
3. **独立 history store**：occurrence ledger 与 job definition 同住
   jobs.json 单文档（D-007 §10.2 选项 1 的实现形态；单文档无界增长、每次
   mutation 全量原子重写，store.js:306-341）；runs.jsonl 是有界 evidence 而
   非可查询投影。二者的存储形态都不能承担「job 删除隔离 + 无界保留 +
   可分页查询」的 history 职责（§3 R5/R6、ALT-005/006/007）。
4. **HTTP 查询 API**：scheduler / scheduler-router 零 HTTP；product-api
   :8787 仅 /health + /v1/{binding,agents,switch-agent,message}
   （product-api/src/index.js:233-258）；notification-ingress :8790 仅
   /health + /v1/deliver（notification-ingress/src/index.js:161,172）。
5. **scheduler.read / scheduler.audit / scheduler.admin token scope 门**：
   不存在。既有授权是两回事——broker capability requiredScopes 先例
   （gateway.js:153-155, 226-249 fail-closed）与 SELF_SERVICE 工具的
   **local entitlement 标签**（scheduler.read:self / scheduler.manage:self /
   scheduler.manage:any——受信本地标签，显式非 auth-service token scopes，
   无全局 audit scope；AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1 L71,
   107-110）。
6. **correlation 字段（真缺的部分）**：correlation_id / parent_run_id 全仓
   零实现（packages/ + scripts grep 0 hits）；request_id 一侧已有原料
   （idempotencyKey = occurrenceId，并经 callerCorrelation 透传 Router 链：
   occurrence-model.js:263；scheduler-router:155-159）——缺的是 retry 链根
   correlation、parent_run_id 与 join 合同。
7. **job_snapshot**：admission 时无 definition 投影；job 删除后
   name/agent_id/schedule/delivery_mode 不可从历史恢复（self-service
   `runs` 对已删 definition 返回 not-found——CTR-RESULT-002；CLI runs 仍
   显示 occurrence 但无 definition 语境）。
8. CLI `runs` 已展示 occurrence 维度（occurrenceId/runId/outcome_unknown/
   fence；scripts/agentcore-cron.mjs:20-24, 257-283——D-007 §12.2 的该义务
   在 BASE 已兑现），但只有 client-side 过滤、无服务端分页/权限/correlation。

目标链（任务冻结；本 Spec 建立查询/语义层，身份与状态事实沿用既有权威
ledger）：

```text
Job Definition
    ↓
Occurrence（一次计划触发）
    ↓
Run（一次真实执行）
    ↓
Session / Agent / Output / Audit
```

一句话：**在 D-007 已冻结且引擎已实现的 occurrence/run 执行语义之上，建立
一层持久的、不可被 job 删除带走的结构化执行历史 ledger（occurrence + run
记录、结构化业务结果、correlation 链），并以 scope-gated 的只读 HTTP API
暴露查询——history 只记录事实、绝不反向 gate admission；一切执行语义权威
仍在 D-007。**

## 1. DEVELOPMENT_PREFLIGHT

```text
DEVELOPMENT_PREFLIGHT

Problem =
  BASE 引擎虽已 D-007-conformant 且 occurrence ledger（jobs.json v2 内）与
  runs.jsonl 均携带 occurrence/run 身份，但执行历史仍不可作为 history 使用：
  无结构化业务结果摄取（summary/final_status 不持久）；ledger 与 job
  definition 同住单文档（无 job 删除隔离的独立布局）；runs.jsonl 是 10MB
  有界 evidence 非查询面；无 HTTP 查询 API；无 scheduler.read/audit/admin
  token scope 门（仅 local entitlement 标签）；correlation_id/parent_run_id
  零实现；admission 无 job_snapshot（删除后 definition 语境不可恢复）。

Governing Spec =
  本 Spec（AGENT_CORE_SCHEDULER_RUN_HISTORY_V1，proposed——本轮产出物）。
  上位权威：D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2（accepted）；
  其 governing Spec SCHEDULER_TIMEOUT_OUTCOME_V2（accepted；V1 已 superseded）。

Spec status =
  本 Spec = proposed（尚无实现许可——本轮是 SPEC_AUTHORING_ONLY）。
  D-007 = accepted（Current Scheduler Authority，不修改、不 amend）。

Relevant investigations =
  docs/investigations/scheduler-replacement-audit.md（D-005 证据基础）
  docs/investigations/scheduler-v2-deploy-target-v1.md（部署现状语境）
  SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1 + evidence/scheduler-code-
  excerpts.md（2026-09-02 R1 调查轮，branch prep/scheduler-semantics-
  investigation-v1——本 r2 的 §2.1 事实来源；本修订轮已对其关键 file:line
  在 BASE 840d2f4 worktree 逐条复核）
  r1 轮 read-only 核查（packages/scheduler、packages/scheduler-router、
  packages/production-runtime、packages/product-api、packages/broker
  capabilities、scripts/agentcore-cron.mjs）

Relevant decisions =
  D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2（accepted — occurrence/run 身份、
  durable states、fence、retry=new occurrence、store 纪律、§12.2 runs CLI
  义务、§10.2 occurrence authority layout——BASE 已按选项 1 实现）
  D-008 AGENT_WORKSPACE_SESSION_MODEL_V3（accepted 2026-09-01，standalone
  Current Authority，supersedes D-006/V2 — per-occurrence fresh non-main
  session；BASE 已实现为 'cron-run-<occurrenceId>'）
  D-005 SCHEDULER_V1（superseded-by-D-007 — 仅历史 rationale）

Previously rejected alternatives =
  D-005/D-007 已拒绝：分布式 job 队列 / Redis / Kafka / DB / K8s CronJob；
  runs.jsonl 作为 occurrence authority；job-level runningAtMs 作为 no-dup。
  本 Spec §6 的新拒绝项与之互补、不重开任何已拒绝项。

Frozen boundaries =
  不修改 D-007；不修改 Job schema（本轮核查结论：实现本 Spec 不需要
  Job schema 变更，见 §4 JOB_SCHEMA_MODIFICATION = NOT_REQUIRED）；
  jobs.json v2 文档格式与既有 {jobs[], occurrences[], fences{}} ledger
  零改动（D-007 §10.1 PRESERVE EXACT；既有 occurrence authority ledger
  原样并存，不迁移不改写）；runs.jsonl 语义与 10MB evidence 纪律不变
  （D-007 §10.3）；Scheduler 保持 product/channel 无知（opaque seam
  纪律）；不建数据库表；API 只读。

Implementation scope =
  （accept 后，§4 闭包）packages/scheduler 新增独立 history store；引擎在
  既有 lifecycle 边界发历史记录；production-runtime 布局 + wiring + 结构化
  结果摄取；product-api 挂载只读 /scheduler/* 路由 + fail-closed token
  门禁；CLI runs 升级读 history。

Out-of-scope =
  D-007 admission idempotency / execution fence 的引擎实现（history 只记录
  不执行；BASE 引擎已实现且不动）；job definition 变更 API；svc-workflow /
  auth-service 任何改动；correlation_id 向 workflow_execute receipt 的
  传播；会话内容读取 API；生产部署与 canary（独立授权轮次）。

New evidence =
  无重开已拒绝提案。r2 修正后的新事实基线（BASE 840d2f4，逐条 file:line
  见 §2.1）：引擎 D-007-conformant（occ:/run: 身份、idempotencyKey=
  occurrenceId、reserve-before-Router、五态全可达、fence、late settlement、
  restart sweep、operator reconcile）；v2 occurrence ledger 在 jobs.json 内
  且 job 删除后保留；runs.jsonl 事件均含 occurrenceId/runId；CLI runs 已
  展示 occurrence 维度；control.js 存在（含 deleteJobOp / submitOneShotOp /
  reconcileOccurrence）；生产 seam 已是 runTurnWithRouteChain + callerCorrelation
  透传；summary 不入 scheduler ledger/runs.jsonl；scheduler 无任何 HTTP 面；
  SELF_SERVICE 工具 local entitlements 非 auth scopes；broker requiredScopes
  门禁先例在（gateway.js）；全仓 correlationId/parentRunId 0 hits。
  （r1 曾记录的「引擎 pre-D-007 / runs.jsonl 无身份 / control.js 不存在」
  为 stale 事实，已在 r2 全文清除。）

Need new/amended Spec = YES（本 Spec 即该新 Spec；在它 accepted 前不得实现）
```

## 2. Authority chain 与依赖事实

### 2.1 依赖事实（r2 重核：2026-09-02，BASE 840d2f4 逐条复核；原始出处 = R1 调查 SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1 + evidence/scheduler-code-excerpts.md）

| 依赖 | 状态（BASE 840d2f4 实况） | 证据 |
|---|---|---|
| D-007（Current Scheduler Authority） | accepted | occurrence/run 身份集 `{jobId, scheduleRevision, occurrenceId, runId, requestId/idempotencyKey, payloadHash, nominalScheduledAt \| retryOfOccurrenceId/catchUpOfNominalAt, admittedAt, nativeSessionId}`（§5）；durable states `admitted/running/succeeded/failed/outcome_unknown`（§6）；`ONE_OCCURRENCE_MAX_RUNS=1`、`RETRY_IDENTITY=NEW_OCCURRENCE`（§4.2/§9）；timeout 无 proven termination = `outcome_unknown`（§8）；execution vs delivery 分离（§11.4，D-007 文件 L670 起）；`deleteAfterRun` 成功后可删 definition、occurrence evidence 保留（§7.3）；§10.2 occurrence authority store layout 二选一——**BASE 已按选项 1（同一 versioned 文档、jobs/occurrences 分列）实现**；runs.jsonl = evidence only、10MB（§10.3）；CLI `runs` 须展示 occurrenceId/runId/outcome_unknown/fence（§12.2，D-007 文件 L718 起）——BASE 已兑现 |
| 现行 scheduler 引擎 | **D-007-conformant**（r2 修正 r1 的「pre-D-007」误记） | 身份：`occurrenceId='occ:'+sha256(len-prefixed(jobId\|scheduleRevision\|kind\|slot))[:16]`（occurrence-model.js:64-71）、`runId='run:'+occurrenceId`（:73-75）、`idempotencyKey=occurrenceId`（:263）、payloadHash 排除 delivery（:102-118）、`nativeSessionId='cron-run-'+occurrenceId`（:87-89，拒绝 'main'）。admission：`reserveOccurrence` 于跨进程 mutation lock（store.mutateDoc，store.js:119-192）内做 coords 幂等去重 + payloadHash 冲突 fail-loud（`OCCURRENCE_PAYLOAD_CONFLICT`）+ 资格重查 + `assertRunnable`，记录以 `state:'admitted'` + 持久化 deadline `executionDeadlineAtMs` 落账（occurrence.js:34-121；occurrence-model.js:248-274）——reserve-before-Router。五态全可达：`OCCURRENCE_STATES`（occurrence-model.js:21）+ 状态机（:35-41，outcome_unknown 只能→succeeded\|failed）；admitted→running 由 invoker start 证据写入（occurrence.js:124-141）；succeeded / failed(带 terminalEvidence) / outcome_unknown 分类（occurrence.js:237-271）；deadline 到期无 termination proof → outcome_unknown + fence（occurrence.js:213-233；occurrence-model.js:317-333）；restart sweep → outcome_unknown(restart_unresolved) + fence 重建（scheduler.js:211-232）；late settlement（occurrence.js:354-424）与 operator reconcile（control.js:175-243，身份=effective OS user）。delivery 分离（occurrence.js:274-290）；deleteAfterRun 只删 definition（control.js:119-126）；引擎决策出自 occurrence ledger、never runningAtMs（scheduler.js:35 注释；全文无 applyRunState/isRunnableJob） |
| occurrence authority ledger | **已存在**（jobs.json v2 内；job 删除后保留） | `{version:2, jobs[], occurrences[], fences{}}`（store.js:12-16；fail-loud 校验 store.js:251-304）；记录字段 occurrenceId/jobId/scheduleRevision/kind/runId/idempotencyKey/payloadHash/state/admittedAt/executionDeadlineAtMs/history[] + slot 坐标（occurrence-model.js:248-274）+ startedAt/endedAt/nativeSessionId/deliveryStatus/executionOutcome/terminalEvidence/lateSettlement（occurrence.js:293-330）；logical coords 唯一性（occurrence-model.js:121-131）；deleteJobOp 仅移除 definition（control.js:119-126）；单文档全量原子重写（store.js:306-341）——无界增长为已知运营风险（R1 调查 A.6-6） |
| runs.jsonl 现行事件 | 有界 evidence 面；**已含 occurrenceId/runId**（r2 修正 r1 的「无身份」误记） | append-only + fsync + 10MB newest-lines 截断（store.js:33-34, 399-448）；best-effort、失败不阻权威状态（occurrence.js:426-432）；事件 occurrence_reserved（occurrence.js:104-118，含 occurrenceId/runId/kind/nominal/scheduleRevision/payloadHash/executionDeadlineAtMs）/ turn_start（:140）/ router_admission×2（:150,:160）/ outcome（:334）/ delivery（:345）/ late_settlement（:412）/ store_upgrade（store.js:179）/ lock_recovery（lock.js）；`summary` 不入 ledger 与 runs.jsonl（occurrence.js:243——仅进 delivery 文本与 production-runtime invocation evidence 行） |
| Job schema | v2 现形（r2 修正 r1 的「D-005 形态、无 scheduleRevision」误记） | `scheduleRevision` 字段已在（job-model.js:102-111，updateJob 递增）；`retry {auto:boolean}` 显式 opt-in（:135-140）；`deleteAfterRun` 对 `at` 缺省 true（:154-156）；payload.timeoutSeconds/lightContext/model（:141-151） |
| 结构化业务结果 | **ABSENT**（真实缺口） | 无摄取点、无 counters/final_status 概念；summary 持久化缺口见上行 |
| scheduler HTTP 面 | **不存在**（r2 复核仍真） | packages/scheduler、packages/scheduler-router 零 HTTP（scheduler-router 为 seam-adapter 库）；常驻引擎内嵌 production-runtime（compose.js:46-48, 385+）；product-api :8787 仅 /health + /v1/{binding,agents,switch-agent,message}（product-api/src/index.js:233-258）；notification-ingress :8790 仅 /health + /v1/deliver（notification-ingress/src/index.js:161,172） |
| production invocation seam | runTurnWithRouteChain 链 | `createRouterInvoker(router)`：`assertRunnable` 拒 unknown（AGENT_NOT_FOUND）/disabled（AGENT_DISABLED）于 start 前（scheduler-router:111-131）；`router.runTurnWithRouteChain(agentId, {sessionId, message, deadlineMs, opts:{callerCorrelation:{occurrenceId,runId,requestId}, onDispatch}})`（:146-166）；`onDispatch` 首次 route dispatch 恰一次 → admitted→running（occurrence.js:124-141）；delivery = `createFeishuDeliver`（compose.js:48）；scheduler 路径不经 router.deliver；compose invoker 观测 wrap（kind 'invocation'，含 summary 字段；compose.js:385-413）；AbortSignal 仅观测、Router/AgentProcess 无取消 seam（scheduler-router:34-40） |
| 现有查询面 | CLI 已含 occurrence 维度；self-service 工具面已 accepted | `agentcore-cron runs` 展示 occurrenceId/runId/state(含 outcome_unknown)/kind/nominal/admitted/started/ended/deliveryStatus/lateSettlement/fence，client-side 过滤（scripts/agentcore-cron.mjs:20-24, 257-283——D-007 §12.2 的 occurrence 维度义务已兑现，client-side 过滤仍真）；`Scheduler.readRunEvidence`（scheduler.js:328-330）；broker self-service create/list/runs/update/enable/disable/remove（accepted AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1；packages/scheduler/src/self-service.js；compose.js:418-429）——local entitlements `scheduler.read:self`/`scheduler.manage:self`/`scheduler.manage:any` **非** auth-service token scopes、无全局 audit scope；definition 删除后 self-service `runs` 返回 not-found（CTR-RESULT-002）——正是本 Spec 查询面要闭合的缺口 |
| token scope 门禁先例 | broker requiredScopes 在；scheduler.read/audit/admin 不存在 | gateway.js：manifest.requiredScopes 存在时先取 token、失败即 access_denied 于 handler 之前（gateway.js:153-155, 226-249）；既有 manifests：workflow.read（capabilities/workflow.js:92 等）、forum.read/forum.write（capabilities/forum.js:38,66,90,117,161）、okr.read（capabilities/okr.js:26）、agent.definition.write（capabilities/agent-definition.js:80） |
| `correlationId` / `parentRunId` | **全仓零实现**（真缺） | packages/ + scripts grep 0 hits（r2 复核）；`requestId` 一侧已有原料：idempotencyKey=occurrenceId（occurrence-model.js:263）并经 callerCorrelation 透传 Router 链（scheduler-router:155-159）；缺的是链根 correlation_id、parent_run_id 与 join 合同 |
| agent_wake | staged WIP（proposed，不在 BASE） | requestId 公式 `'wdhr1:' + workflowInstanceId + ':' + targetAgentId`（该 Spec 冻结文本；以 accepted 轮为准）；L1 audit 五要素；dedupe key = (workflowInstanceId, targetAgentId) |
| HR Dispatcher | staged WIP（proposed r3，不在 BASE） | Dispatcher recurring job 的 round report 写其 workspace round record；其 §5.1 提案工具用 scope `scheduler.read` / `scheduler.manage`（命名调和义务见 R8；注意其对 dispatcher agent 本身 FORBIDDEN 一切 scheduler scope——R-A8） |
| 会话/产物存储 | **D-008**（r2 修正：D-006 已 superseded） | D-008 AGENT_WORKSPACE_SESSION_MODEL_V3 accepted 2026-09-01、standalone Current Authority、整份取代 D-006（docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md L2-9；BASE 提交 b2e3eb1「accept D-008 session model V3」；D-006 文件已标 superseded_by D-008）；per-occurrence fresh non-main session 已实现为 `cron-run-<occurrenceId>`（occurrence-model.js:87-89）；sessions = DSH native `<DSH_HOME>/sessions/<project>/<id>/session.jsonl`；无独立 output artifact 概念；audit 面 = control/runtime-evidence.jsonl + scheduler/runs.jsonl |

### 2.2 Gate 链（冻结；顺序不可跳跃）

```text
G1  本 Spec accepted（评审轮 NEXT_TASK = 调度历史 审计）
G2  实现闭包（§4）按 GOVERNING_SPEC_UNMODIFIED 评审合并（实现 PR 不得修改
    本文件）
G3  部署到生产 lineage = 独立 operator 轮次（本 Spec 不含 production apply
    authority）
G4  auth-service 侧 scheduler.read / scheduler.audit scope 供给 = 外部独立
    轮次（无 grant 时新 API 对一切 caller 401/403 fail-closed——部署先于
    grant 无害）
G5  生产 canary（§5 C 块）= 独立授权轮次；须 G3+G4 之后
```

本 Spec 的 accept（G1）不蕴含 G2–G5 任何一项；反之亦然。

### 2.3 与 D-007 的关系（只引用、不修改；两处任务字面表述的调和）

D-007 是 accepted Current Authority，本 Spec **零修改、零 amend**。任务书的
两处字面表述与 D-007 冻结语义存在出入，本 Spec 按「D-007 优先、任务意图
保全」调和，映射在 §3 R3 冻结：

1. **retry 字面**：任务书写「多个 run 同 occurrence_id、不同 run_id」。
   D-007 冻结 `ONE_OCCURRENCE_MAX_RUNS = 1`、`RETRY_IDENTITY =
   NEW_OCCURRENCE`（retry 是新 occurrence，经 `retryOfOccurrenceId` 链接）。
   → 本 Spec 采用 D-007 形态，任务的意图（重试可见性：parent 链、共享
   correlation、retry_count 正确）经 retry 链派生字段完整交付（R2/R10）。
2. **timeout 字面**：任务书把 `timeout` 列为 status。D-007 冻结
   `TIMEOUT_WITHOUT_PROVEN_TERMINATION = outcome_unknown`、
   `TIMEOUT_IS_ORDINARY_FAILED = NO`。→ `timeout` 不是 durable state，
   是 error_code 分类（R3/R10）。

不构成冲突、仅作显式映射的：`cancelled`（D-007 §8.2——仅 proven
termination 才允许 terminal cancel 结果）、`scheduled`（D-007 durable 记录
自 admitted 起——reserve-before-Router；BASE 引擎同此实现）、
`DELIVERY_FAILED`（D-007 §11.4 delivery 失败不改写 execution outcome）。

## 3. PROPOSED_SPEC — 冻结的核心模型（rulings）

### R1 — Occurrence 记录（一次计划触发；冻结字段）

```text
OccurrenceRecord {
  occurrence_id            # D-007 §5.1 身份；BASE 引擎已铸 occ:/run: 身份
                           # （occurrence-model.js:64-75）——history 原样
                           # 记录（R1a 优先级 1）；见 R1a 派生纪律
  job_id                   # stable jobId
  job_snapshot {           # admission 时冻结的 definition 投影（R5）；job
    name,                  # 删除后历史自包含（BASE ledger 无此投影——真实
    agent_id,              # 缺口 G1，本 Spec 补齐）
    schedule { kind, expr? | at? | everyMs? },
    delete_after_run,
    payload_hash,
    delivery_mode
  }
  schedule_revision        # D-007 §5.2；BASE ledger 已有（job-model.js:111）
  scheduled_at             # nominal slot（ISO instant；retry slot 为该次
                           # retry 的计划时间；BASE 记录为 epoch ms——ISO
                           # 转换属本 Spec 记录层）
  origin                   # natural | retry | catchup（D-007 §4.1；BASE
                           # 字段名 kind，语义等同）
  retry_of_occurrence_id   # 仅 origin=retry（D-007 §9）
  catchup_of_nominal_at    # 仅 origin=catchup
  state                    # D-007 §6 五态 EXACT：
                           # admitted | running | succeeded | failed |
                           # outcome_unknown（BASE OCCURRENCE_STATES 同集，
                           # occurrence-model.js:21）
  fenced                   # boolean（D-007 §8.3 execution fence 活跃；
                           # BASE 由 fences{} 投影可导出
                           # occurrence-model.js:317-333——本 Spec 物化为
                           # 记录字段）
  payload_hash             # D-007 §5（BASE 'sha256:...' 全长格式，
                           # occurrence-model.js:102-118）
  admitted_at
  updated_at
}
```

Occurrence 是 history ledger 中 job definition 与执行之间的锚：
`GET /scheduler/occurrences/{id}` 以它为根聚合 runs、session 链接与结构化
结果。**history 只记录 state/fence 事实，绝不执行 admission idempotency 或
fence 逻辑**（那是 D-007 引擎侧权威、BASE 已实现；本 Spec 边界见 R11）。

### R1a — occurrence/run 身份派生纪律（冻结）

```text
优先级（高→低）：
1. 执行权威提供的身份（V1 唯一预期路径）：BASE occurrence authority
   ledger（jobs.json v2 内，D-007 §10.2 选项 1 实现）已为每次 admission 铸
   造并持久化 occurrenceId（'occ:'+16hex）/runId（'run:'+occurrenceId）/
   scheduleRevision/idempotencyKey(=occurrenceId)（occurrence-model.js:
   248-274）。history 必须原样记录这些字段——两种记录的身份字段必须相等
   （contract：IDENTITY_SOURCE = execution-authority）。当该 authority
   layout 未来演进（含迁往独立 store），同判：以其新身份为准。

2. 权威身份不可得时的确定性派生回退（V1 预期不触发——BASE 引擎恒提供
   权威身份；本公式为 replay/重建等边缘场景冻结，确定性、跨 restart/tick
   稳定，符合 D-007 §5.1 允许的 deterministic derivation；注意其输出空间
   与 BASE 'occ:' 公式不同——回退身份仅存在于 history，绝不回写权威
   ledger）：
   occurrence_id = 'schocc:' + b64url(sha256(jobId \0 schedule_revision \0
                   scheduled_at_iso))[:22]
   run_id        = occurrence_id + ':r1'      # D-007 §4.2 一 occurrence 一 run
   schedule_revision = 'rev:' + sha256(canonical_public_job_definition_at_admission)[:12]
   payload_hash      = 'ph:' + sha256(canonical_payload)[:12]

禁止：
- 仅靠 RAM sequence / 按当前时间重铸（D-007 §5.1 同判）；
- 同一逻辑 slot 出现第二个 occurrence_id；
- 身份字段携带路径分隔符或可被用作文件名以外的语义。
```

同一 `(job_id, schedule_revision, scheduled_at)` 重复观测（restart 后重放、
tick 重入、catch-up 重算）**必须收敛到同一 occurrence_id**：history store
按 occurrence_id upsert-merge（R6），不得产生第二条记录；重复 reserve 事件
按 evidence 追加保留、状态不回退（terminal 不被晚到的 admitted 覆盖——
BASE 状态机同判，occurrence-model.js:35-41）。

### R2 — Run 记录（一次真实执行；冻结字段）

```text
RunRecord {
  identity:
    run_id                  # = 权威 runId（'run:'+occurrenceId，BASE 已铸）
    occurrence_id
    job_id
    session_id              # native session id（BASE 'cron-run-<occ>'，
                            # occurrence-model.js:87-89）
    agent_id

  schedule:
    schedule_revision       # BASE ledger 已有

  model:
    model                   # payload.model as-declared（D-007 §12.4：
                            # passthrough 生产可用性不在本 Spec 验收面；
                            # BASE 仅存于 job payload——per-run 记录为本
                            # Spec 补齐）
    resolved_model          # V1 恒 null（引擎无 resolved model 证据；
                            # DEFERRED—— AMEND 扩展）

  timing:
    scheduled_at            # nominal（= occurrence.scheduled_at）
    admitted_at             # durable reserve 完成时刻（BASE 已有）
    started_at              # 首个可信 start evidence 时刻；BASE 已由
                            # invoker onStart 证据写入（occurrence.js:
                            # 124-141）
    start_evidence          # 'invoker-dispatch' | 'trusted' | null
                            # （BASE 路径 = 'invoker-dispatch'——onDispatch
                            # 首次 route dispatch；权威 trusted start
                            # evidence 落地后 = 'trusted'）
    ended_at                # BASE 已有
    duration_ms             # ended_at - admitted_at（含排队；execution 窗口
                            # 另有 started_at 可算）——本 Spec 物化

  status:
    outcome                 # 权威执行结果（D-007 EXACT；BASE ledger 已有
                            # executionOutcome/state）：
                            # admitted | running | succeeded | failed |
                            # outcome_unknown
    status_view             # 任务面向的派生词汇（R3 映射，只读派生、不落
                            # 盘为权威）：success | failed | timeout |
                            # cancelled | running | admitted

  delivery:
    delivery_status         # D-007 §11.4 EXACT（BASE 已有）：
                            # delivered | not-delivered | not-requested | unknown

  retry:
    retry_count             # retry 链上的位置（首次 = 0；R10 派生）
    retry_of_occurrence_id  # = occurrence.retry_of_occurrence_id（冗余便于
                            # run 级查询；BASE 已有）

  error:
    error_code              # R10 分类表；成功为 null（BASE 无分类码——
                            # 真实缺口，本 Spec 补齐）
    error_message           # 截断上界 2000 chars；非密

  trace:
    correlation_id          # R9；retry 链全員共享链根值（BASE 无——真缺）
    parent_run_id           # R9；retry run 指向被 retry 的 run；链根为 null
                            # （BASE 无——真缺）
    request_id              # admission idempotency key。BASE 已有：
                            # idempotencyKey = occurrenceId（occurrence-
                            # model.js:263）且经 callerCorrelation.requestId
                            # 透传（scheduler-router:155-159）——V1 记录其
                            # 值并置 request_id_source = 'execution-
                            # authority'；未来 seam 提供独立 request id 时
                            # 更新 source；不可得时 null 并置
                            # request_id_source = 'unavailable'（诚实缺口，
                            # 不伪造）

  result:
    result                  # 结构化业务结果（R4）或 null
    result_status           # PASS | PARTIAL | FAIL | null
    result_recorded         # boolean
    result_error_code       # null | UNPARSEABLE | OVERSIZE | INVALID_SCHEMA
}
```

任务书 Run 字段清单（identity/schedule/model/timing/status/delivery/retry/
error/trace/result 十组）逐组映射如上，无一丢弃；`scheduled` 状态与
`resolved_model` 的处置见 R3 与上文 DEFERRED。BASE ledger 已覆盖其中
identity/schedule/timing(status)/delivery/retry 的核心事实——本 Spec 的
增量是 model/分类错误码/trace/结构化 result 与派生视图，而非重造身份。

### R3 — 状态词汇与 D-007 映射（冻结；API 过滤器与展示的唯一定义）

```text
任务词汇          权威落点（durable）                       派生规则（status_view）
---------        --------------------------------------   ----------------------
success          outcome = succeeded                       outcome==succeeded
failed           outcome = failed                          outcome==failed
timeout          error_code = TIMEOUT（分类）              error_code==TIMEOUT
                 outcome = outcome_unknown（无 proven      （无论 outcome 是
                 termination，D-007 §8 缺省）或 failed     outcome_unknown 还是
                 （有 proven termination 时才允许）        failed 均命中）
cancelled        error_code = CANCELLED（分类）            error_code==CANCELLED
                 outcome = failed（proven termination）或
                 outcome_unknown（无证明，D-007 §8.2）
running          outcome = running                         outcome==running
admitted         outcome = admitted                        outcome==admitted
scheduled        —— durable 记录自 admitted 起             V1 恒不命中（保留
                 （D-007 reserve-before-Router；BASE       关键字；见 REJ-004）
                 引擎同此实现）；未来 nominal slot 属
                 job definition projection，不属执行历史
```

- `status` 查询参数接受任务词汇全集 + `outcome_unknown`（审计必需）；解析
  按上表；`scheduled` 在 V1 返回空集并在响应 `notice` 字段说明（不 400）。
- **本 Spec 不新增任何 durable state**；status_view 是只读投影，可由
  outcome + error_code 无损重算。
- `DELIVERY_FAILED`（任务书失败类型之一）：落 `delivery_status =
  not-delivered` + `error_code = DELIVERY_FAILED`，**execution outcome 不变**
  （D-007 §11.4——delivery 失败绝不把 proven succeeded 改写为 failed；
  BASE 引擎同判，occurrence.js:274-290）。

### R4 — 结构化业务结果（冻结摄取合同）

支持（任务示例 = Dispatcher）：`{pages_scanned, instances_found,
domains_found, candidates, wake_sent, skipped, errors, final_status}`。
**禁止只依赖日志文本**——结果必须是 run 记录内的一等结构化字段
（BASE 完全没有此层——真实缺口 G15/G16）。

```text
结果载体（fenced block，agent turn 回复尾部）：
  ```scheduler-result
  { "final_status": "PASS | PARTIAL | FAIL",
    "counters": { "<name>": <integer>, ... },
    "notes": "<可选，≤500 chars 非密文本>" }
  ```

摄取位置 = 受信区（production-runtime 的 invoker wrapper——compose.js:385-413
既有 invoker 观测层是现成挂点；Scheduler core 保持 product 无知，D-007
opaque seam 纪律）：
  1. 取 turn reply 中最后一个 ```scheduler-result fenced block；
  2. 校验：final_status ∈ {PASS, PARTIAL, FAIL}（必填）；
     counters = 扁平 string→integer 映射（V1 冻结；嵌套/任意 JSON = 本
     Spec AMEND）；序列化上界 16KB；整块无秘密（与 audit 行同纪律）；
  3. 通过 → invokeAgent outcome envelope 增量字段 outcome.result（可选、
     additive——seam 扩展，非 Job schema 变更）；Scheduler 视其为 opaque
     JSON 原样持久进 RunRecord.result/result_status/result_recorded=true；
  4. 不通过 → result_recorded=false + result_error_code ∈ {UNPARSEABLE,
     OVERSIZE, INVALID_SCHEMA}；execution outcome 不受影响、delivery 不受
     影响（fail-soft，history 诚实缺口可见）。

计数键注册表：counters 键为 open map（Scheduler 不认识任何业务键）；
Dispatcher 类结果的推荐键集（pages_scanned / instances_found / domains_found
/ candidates / wake_sent / skipped / errors）由 HR_DISPATCHER 及各 job 类
Spec 自行冻结——本 Spec 只冻结信封与 final_status 语义：
  PASS    = 本轮职责全部完成
  PARTIAL = 部分完成（counters.skipped/errors 应可解释缺口）
  FAIL    = 业务失败（execution 可能同时是 succeeded——两者分离：execution
            outcome 是机制事实，final_status 是业务事实）
```

### R5 — deleteAfterRun 语义（冻结）

```text
deleteAfterRun = 删除 Job Definition
              ≠ 删除执行历史
```

BASE 引擎已实现定义侧（本 Spec 不改引擎删除逻辑；
control.js:119-126 deleteJobOp 仅从 `jobs[]` 移除 definition，
`occurrences[]` ledger 原样保留）。执行完成后各层状态：

```text
job definition : deleted（jobs.json jobs[] 中移除——文档格式字节纪律不变）
occurrence     : 保留（既有 authority ledger + history store 双存）
run            : 保留
session        : 保留（DSH native session 不因 job 删除受影响）
output         : 保留（RunRecord.result / result_status——本 Spec 新增层）
audit          : 保留（history events + 既有 evidence 面）
```

BASE 的既有事实：ledger 保留成立，但**查询**在删除后残缺——self-service
`runs` 返回 not-found（CTR-RESULT-002）、CLI runs 只剩 occurrence 裸数据、
definition 语境（name/agent_id/schedule/delivery_mode）无处可查。
历史自包含保障（本 Spec 的补齐点）：occurrence 记录在 admission 时冻结
`job_snapshot`（R1），job 删除后 `GET /scheduler/runs/{run_id}` /
`GET /scheduler/occurrences/{id}` 仍能返回完整 definition 投影。
**job 删除动作不得触及 history store 的任何字节**（AC-007 断言 jobs.json
与 history 的分离）。

### R6 — History store 布局与持久化纪律（冻结）

选址：`<runtime>/scheduler/history/`（production-runtime layout 新增
`historyDir`；与 `jobs.json`、`runs.jsonl` 同级、完全分离）。

```text
scheduler/history/
  events.jsonl             # append-only 不可变事实流（durable authority）
                           #   每行一个事件（JSON + \n），事件类型：
                           #   occurrence_reserved / run_state / run_terminal /
                           #   delivery_outcome / late_settlement /
                           #   result_recorded / fence_event
                           #   每行含 {seq, ts, occurrence_id, run_id, ...}
                           #   seq 单调递增（mutation lock 内分配）
                           #   append 前 fsync（runs.jsonl 同纪律）
                           #   永不截断、永不改写（NO auto-truncation）
  runs-<YYYYMM>.json       # 按月分区的物化投影（query surface）：
                           #   { version: 1, month, last_event_seq,
                           #     records: [RunRecord...] }
                           #   写法 = write-tmp + fsync + atomic rename
                           #   （jobs.json 同纪律，D-007 §10.1 EXACT 手法；
                           #   BASE store.js:306-341 同族实现）
                           #   只有活跃月分区被常态改写；历史月分区仅在
                           #   late settlement / fence 解除时改写该月
```

纪律（全部继承 D-007 §10/§11 的 store 原则，适配到 history）：

```text
单写者：history 的全部写入走同一 mutation authority（与 jobs.json 同一
        跨进程 lockfile 家族——独立 lock 文件 history/.lock，锁内重读最新、
        单增量提交、原子落盘、RAM 仅在 commit 后更新）
事件先行：append event（fsync）→ commit 投影（atomic rename）；
        crash 落在两步之间 = 投影滞后于事件，载入时按 last_event_seq
        重放 events.jsonl 补齐（replay heal；幂等 upsert-merge）
fail-loud：corrupt/不可解析的 events 行 = 跳过该行并 failed-visible 记录
        （evidence 不整体失效）；corrupt 投影分区 = 由 events 重建
不可信视图禁止：occurrence/run 状态与 Job definition 不得被撕裂成 unsafe
        admission 视图（history 不参与 admission，天然满足——R11）
保留策略：默认无上限、无自动删除（与 runs.jsonl 10MB evidence 截断相反
        ——那是 evidence，这是 history）。归档（整月分区外移）= 显式
        operator 授权轮次，本 Spec 不授予任何自动归档/删除权限
runs.jsonl 地位不变：仍是 D-007 §10.3 evidence 面；history 落地后引擎
        继续双写（既有行为零改动），二者互不替代
既有 occurrence authority ledger 地位不变：jobs.json v2 内 ledger 是
        D-007 §10.2 选项 1 的实现、D-007 语义权威；history 与其**并存**
        （不迁移、不改写、不二次记账其状态机），身份经 R1a 优先级 1 对齐
无 DB / 无 Redis / 无 Kafka：单机文件存储（D-007 §10 同判）
```

本 Spec 对 D-007 §10.2 的立场（显式声明，不越权替它做选择）：BASE 已按
选项 1 实现 occurrence authority；history store **不是** D-007 的
occurrence authority store、不改动其既有实现，也不锁定其未来 layout
选择；当该 authority 实现演进时，history 必须改用（或对齐）其身份与
state 事实（R1a 优先级 1），物理合流为同一 store 是允许的收敛路径——
前提是两份合同同时成立。

### R7 — 查询 API（只读；冻结）

挂载点：既有 product-api HTTP server（127.0.0.1:8787，compose 默认挂载）
新增路由组 `/scheduler/*`；既有路由（/health、/v1/*）字节不变。绑定面
维持 127.0.0.1（本机）。**本 API 无任何 mutating 路由**（GET-only 冻结）。

```text
GET /scheduler/runs
  查询参数（全部可选、可组合）：
    job_id=            精确匹配
    agent_id=          精确匹配（scheduler.read 下强制覆写为 caller 自身
                       agent_id——传入不同值 = 403）
    status=            任务词汇 + outcome_unknown（R3 映射解析）
    from= & to=        scheduled_at 时间范围（ISO instant）
    session_id=        精确匹配
    correlation_id=    精确匹配（retry 链整链返回）
    occurrence_id=     精确匹配
    limit=             默认 50，上界 200
    cursor=            不透明分页游标（时间倒序 + tie-breaker run_id）
  响应 200：
    { runs: [RunRecord...], next_cursor: string | null,
      notice?: string }        # status=scheduled 时置说明文案
  排序：scheduled_at 倒序（同刻按 run_id 字典序）

GET /scheduler/runs/{run_id}
  响应 200：
    { run: RunRecord,
      job_snapshot: {...} | null,       # R5；job 仍在时同时给 live 视图
      session: { session_id, agent_id, native: true },  # 链接引用——不返回
                                                       # session 内容（D-008
                                                       # 会话内容面不在本 Spec）
      output: { result, result_status, result_recorded } | null,
      error: { error_code, error_message } | null,
      trace: { correlation_id, parent_run_id, request_id,
               wake_links: [ { target_agent_id, workflow_instance_id,
                               request_id, session_id } ] } }
                       # wake_links 由结构化结果 wake_sent 条目派生（R9）
  404：run_id 未知

GET /scheduler/occurrences/{occurrence_id}
  响应 200：
    { occurrence: OccurrenceRecord,
      runs: [RunRecord...],              # V1 基数 = 1（D-007 §4.2）；
                                         # 数组形态为未来留形不改契约
      retry_chain: [ { occurrence_id, scheduled_at, outcome } ... ],
                                          # 链根→本 occurrence 的全链
      session_links: [...], output: {...} }
  404：occurrence_id 未知

错误表（fail-closed；未列情形 = 500 internal，不降级不吞错）：
  400 invalid_query        # 非法参数（坏 ISO instant、limit>200、未知 status
                           # 词汇以外的结构性错误）
  401 unauthenticated      # 缺 Authorization: Bearer / token 无效 / 验证
                           # seam 未配置（fail-closed）
  403 forbidden            # scope 不足；scheduler.read 越权（agent_id 非
                           # 自身或访问他人 run）
  404 not_found
  500 internal
```

实现读取面：直接读 monthly 投影分区（按时间过滤裁剪扫描范围）；投影
损坏时由 events.jsonl 重建（R6）。**禁止任何仅靠解析日志文本实现的查询
路径**（任务红线；runs.jsonl 不是查询面；既有 CLI 的 client-side 全量
扫描不升级为 HTTP 面——后者读投影）。

### R8 — 权限模型（冻结）

```text
scope            能力                        数据面
-----           --------------------------  --------------------------------
scheduler.read  查看自己的 runs             仅 run.agent_id == caller 绑定
                                            agent 的记录（runs / run detail /
                                            occurrence——occurrence 的
                                            job_snapshot.agent_id 同判）
scheduler.audit 查看全局 execution history  全部 occurrence / run 记录
scheduler.admin 修改 job definition          本 Spec 无对应端点（API 只读）；
                                            语义冻结为对既有 job 控制面
                                            （domain ops / CLI / 未来 HTTP
                                            控制面）的 scope 要求，其接线
                                            归后续 Spec/轮次

禁止：普通 Agent 查看所有 Scheduler history——无 scheduler.audit grant
     的任何 caller 对全局查询 access_denied / 403（结构性，非清单过滤）。
```

机制（复用仓库既有授权先例，不新建授权体系）：

```text
认证 = Authorization: Bearer <auth-service 签发 token>；
       验证 seam = auth-service（具体 introspection/JWKS 契约在实现轮对照
       auth-service 已 merge 合同确定；任何验证失败/未配置 = 401
       fail-closed——与 broker gateway.js requiredScopes 纪律同族：
       gateway.js:153-155, 226-249——scope 缺失即 access_denied、handler
       零执行）
caller agent 绑定 = token principal → agentId 的解析权威在 auth-service；
       无 agent 绑定且无 scheduler.audit 的 principal = 403（名下无 runs）
scope 判定 = token scopes ⊇ {scheduler.read} 或 ⊇ {scheduler.audit}；
       scheduler.audit 蕴含 scheduler.read 数据面的超集
供给 = G4 外部轮次（auth-service grant）；无 grant 部署无害（全 401/403）
product-api 既有无鉴权路由不受影响（只对 /scheduler/* 加门）
```

命名调和义务（跨 Spec，显式记录；两条）：

1. **SELF_SERVICE 工具（accepted）**：AGENT_CORE_SELF_SERVICE_SCHEDULER_
   TOOLS_V1 的 local entitlement 标签 `scheduler.read:self` /
   `scheduler.manage:self` / `scheduler.manage:any` 是受信本地授权标签，
   其 Spec 显式声明**非** auth-service token scopes、无全局 audit 面、
   production `manage:any` 在 auth-service CCR 接通前 = NONE（该 Spec
   L107-110）。本 Spec 冻结的 `scheduler.read/audit/admin` 是 auth-service
   token scope 家族——两套标签同名前缀但不同权威面；实现轮不得把 local
   entitlement 当 token scope 用，也不得让 HTTP 面接受 local 标签
   （fail-closed）。两家族的最终归并（如 audit 能力是否下放 self-service
   面）归后续各自修订轮。
2. **HR_DISPATCHER（staged WIP，proposed r3）**：其 §5.1 提案了
   `scheduler.manage`（scheduler_update_schedule / pause / resume 工具）。
   本 Spec 按任务书冻结 **`scheduler.admin`** 为 job-definition 变更 scope
   名。二者是同一授权家族的两个名字——HR_DISPATCHER 需在其后续修订轮将
   `scheduler.manage` 与 `scheduler.admin` 合并（建议：read/audit/admin
   三分，manage 并入 admin），在其 accepted 前完成即可；本 Spec 不修改
   该文件（同 AGENT_CORE_AGENT_WAKE_CAPABILITY_V1 §2.3 的同步义务模式）。

### R9 — Correlation 链（冻结）

必须支持（任务图）：

```text
Scheduler run
    |
    + agent_wake run
    |
    + workflow_execute receipt
```

```text
correlation_id：
  链根 admission 时确定性铸造：'schcorr:' + <root occurrence_id>；
  root = 沿 retry_of_occurrence_id 回溯到 origin ∈ {natural, catchup} 的
  首个 occurrence（catchup 是独立逻辑执行，自成链根）；
  retry 链全员（各 occurrence 的 run）共享同一 correlation_id（AC-003）。
  （BASE 无此字段——本 Spec 新增；BASE 已有的 request_id=idempotencyKey
  是另一坐标，不混用。）

parent_run_id：
  仅 scheduler run 间使用：retry run 的 parent_run_id = 被 retry
  occurrence 的 run_id（D-007 一 occurrence 一 run 使该映射无歧义）；
  链根 run 为 null。它不是 agent_wake / workflow 的外键。

跨面 join 合同（V1 按 identifier join，不向外部系统传播 correlation_id）：
  J1 scheduler run ↔ agent_wake audit 行：
     join key = request_id。Dispatcher 类 run 的结构化结果 wake_sent
     条目（target_agent_id, workflow_instance_id, request_id, session_id）
     与 agent_wake L1 audit 的 requestId（公式
     'wdhr1:<workflowInstanceId>:<targetAgentId>'，AGENT_CORE_AGENT_WAKE_
     CAPABILITY_V1 冻结文本；该 Spec 现为 staged WIP，以其 accepted 轮
     为准）按字节相等 join；run detail 的 trace.wake_links 即该派生（R7）。
  J2 scheduler run ↔ workflow_execute receipt：
     V1 join key = workflow_instance_id（来自结构化结果 / wake 链）。
     svc-workflow receipt 现不含 correlation_id（r1 轮核查：turn receipt
     仅 messageId）——向其传播 correlation_id 需要 svc-workflow 契约变更，
     OUT_OF_SCOPE_V1，留待后续 AMEND（REJ-008）。查询面按
     workflow_instance_id 聚合呈现。
  J3 scheduler run ↔ Router deliver evidence（kind 'deliver'）：
     request_id 相等即 join（scheduler 执行路径经 runTurnWithRouteChain、
     不经 router.deliver——BASE 的 callerCorrelation 透传
     （scheduler-router:155-159）已把 request_id 带入 Router 链证据；该
     join 在 deliver 侧证据携带同类身份后全面生效；request_id_source
     不可得时诚实为 null，不伪造）。

session 链：run.session_id → DSH native session（D-008，承 D-006 语义）——
run detail 只给链接引用，不复制会话内容。
```

### R10 — 失败与重试记录（冻结分类表）

```text
场景              记录（durable）                                  查询命中
----             ----------------------------------------------   ---------
成功             outcome=succeeded, error_code=null                status=success
超时             error_code=TIMEOUT；outcome=outcome_unknown       status=timeout
                 （无 proven termination，缺省）或 failed（有证明）
异常             outcome=failed, error_code=FAILED                 status=failed
投递失败         delivery_status=not-delivered +                   status=failed（若
                 error_code=DELIVERY_FAILED；outcome 不变           execution 也
                 （D-007 §11.4）                                    failed）；
                                                                 delivery 过滤器
                                                                 not-delivered
取消             error_code=CANCELLED；outcome=failed（proven）    status=cancelled
                 或 outcome_unknown（无证明）
Agent 面拒绝     error_code ∈ {AGENT_NOT_FOUND, AGENT_DISABLED}    status=failed
                 （BASE scheduler-router 既有码：pre-start
                 assertRunnable，scheduler-router:123-131）；
                 AGENT_START_FAILED 为本分类表保留值（V1 无
                 BASE emitter——invoker 侧 start 失败路径若
                 未来出现则归此码；不虚构记录）
重试             retry = 新 occurrence（retry_of_occurrence_id）   同
                 + 新 run_id + 新 request_id（D-007 §9；           correlation_id
                 BASE 新 request_id = 新 occurrenceId 的            整链可查
                 idempotencyKey）；run.parent_run_id = 前次
                 run_id；同 correlation_id；retry_count = 链上
                 位次（root=0，逐次 +1；由 retry 链派生，非
                 独立计数器）
outcome_unknown  outcome=outcome_unknown（fence 事实记录于           status=
                 occurrence.fenced；late settlement 追加事件、     outcome_unknown
                 状态可演进 succeeded|failed、历史审计保留）
```

`retry_count` 一律**派生**（沿 retry 链计数），不维护可漂移的独立计数器
（对齐 D-007「summary 可由 ledger 重建」的派生纪律 §3.1）。

### R11 — 红线（FORBIDDEN；违反 = out-of-spec，审计可见）

```text
R-H1  history 不得 gate / 变更任何 admission 语义：不实现 idempotency、
      fence、no-dup、retry 决策；只记录引擎决策的事实（引擎权威 = D-007，
      BASE 已实现且零改动）。
R-H2  jobs.json v2 文档格式与既有 occurrence ledger 零改动（D-007 §10.1
      PRESERVE EXACT；BASE ledger = {jobs[], occurrences[], fences{}} 原样
      并存、不迁移）；不向 jobs.json 添加任何 history 字段。
R-H3  runs.jsonl 语义与 10MB evidence 截断纪律不变；不得被改造成 history
      authority（D-007 §10.3 同判）。
R-H4  Job schema 零修改（本轮核查：不需要——结构化结果走 outcome envelope，
      身份沿用权威 ledger；若实现轮发现必须改 Job schema：停止并报告，
      走 AMEND）。
R-H5  无数据库表 / 无 Redis / 无 Kafka / 无第二 mutation authority。
R-H6  API 只读：无 POST/PUT/PATCH/DELETE；HTTP 面永不写 job / history。
R-H7  Scheduler core 保持 product 无知：不解析 Dispatcher 计数键、不认识
      workflow / agent_wake / Feishu（结构化结果摄取在 production-runtime
      受信 wrapper，R4）。
R-H8  history 行 / API 响应零秘密：无 token / secret / credential 字段
      （error_message 与 result notes 同 audit 非密纪律）。
R-H9  无鉴权旁路：/scheduler/* 恒经 token 门禁；验证 seam 未配置 = 401
      fail-closed（不允许「本机信任」降级；local entitlement 标签不得
      替代 token scope——R8 调和义务 1）。
```

## 4. IMPLEMENTATION_CLOSURE（G1 accept 后的评审路径；本轮零实现）

```text
NEW   packages/scheduler/src/history.js
        — HistoryStore：events.jsonl append（fsync、seq 分配、永不截断）
          + monthly 投影（write-tmp+fsync+rename）+ replay heal
          + upsert-merge + 查询引擎（filters/pagination/cursor）
        — R1a 身份对齐 helpers（权威身份透传；派生回退仅边缘场景）
MOD   packages/scheduler/src/occurrence.js + scheduler.js
        — 可选 deps.history 注入；在既有 lifecycle 边界发记录（不改任何
          admission/dedup/retry 决策；BASE 边界即 R1 调查 §A.4 流程）：
          reserveOccurrence 提交后（occurrence.js:34-121；既有
          occurrence_reserved evidence 已发）→ history occurrence_reserved
          (admitted)；
          markOccurrenceRunning（occurrence.js:124-141，onDispatch start
          证据）→ history run started(start_evidence='invoker-dispatch')；
          writeOccurrenceOutcome 权威写回提交后（occurrence.js:293-351）→
          run_terminal（含 terminalEvidence 派生 error_code）；
          deliverOccurrence（occurrence.js:274-290）→ delivery_outcome；
          late settlement / operator reconcile（occurrence.js:354-424；
          control.js:175-243）→ late_settlement 事件；
          one-shot 删除分支（applyJobCompletion）→ 仅 job definition
          删除照旧（R5，history 不动）
MOD   packages/scheduler/src/index.js — 导出 HistoryStore
MOD   packages/scheduler/src/seams.js — invokeAgent outcome envelope 增量
        可选 result 字段文档化（additive；fake/noop invoker 兼容）
MOD   packages/production-runtime/src/paths.js — layout.historyDir
MOD   packages/production-runtime/src/compose.js
        — HistoryStore 构造 + 注入 Scheduler；invoker wrapper（compose.js:
          385-413 既有观测 wrap）增加 R4 结构化结果摄取（fenced block
          提取/校验 → outcome.result）
MOD   packages/product-api/src/index.js
        — /scheduler/runs、/scheduler/runs/{run_id}、
          /scheduler/occurrences/{occurrence_id} 三路由 + Bearer token
          fail-closed 门禁 + scope 判定（R7/R8）
MOD   scripts/agentcore-cron.mjs
        — runs 子命令：history store 存在时改读之（BASE 已展示 occurrence
          维度——升级点为服务端过滤/分页 + error_code/status_view +
          结构化 result + correlation 链展示），并保留既有 ledger/evidence
          回退（D-007 §12.2 义务的完整兑现）
NEW   packages/scheduler/test/history.test.js
MOD   packages/scheduler/test/scheduler.test.js（history hook 断言）
MOD   packages/production-runtime/test/compose.test.js（wiring + 摄取）
MOD   packages/product-api/test（路由 + 门禁 fixture）

零改动：job-model.js（Job schema）、jobs.json v2 文档与既有 occurrence
ledger、runs.jsonl 语义、agent-router、broker（scheduler 查询的 broker
capability 暴露 = 后续独立轮次，本 Spec 只冻结 HTTP 合同）、
scheduler-router（callerCorrelation 透传已存在，outcome 透传无需变更——
摄取在 compose wrapper）、auth-service、svc-workflow、feishu-connector、
notification-ingress。
JOB_SCHEMA_MODIFICATION = NOT_REQUIRED（R4/R1a 设计使然；若实现轮推翻
此结论 → 停止并报告，走 AMEND）
```

## 5. ACCEPTANCE_CRITERIA（fixture 级，G1/G2 评审用；生产 canary = 独立轮次）

### 任务 Case → fixture 映射

```text
ACC-001（Case 1 one-shot + deleteAfterRun）
  创建 at one-shot job（deleteAfterRun=true），fake invoker 返回 ok +
  合法 scheduler-result block；执行后断言：
  a) jobs.json 中该 job 已从 jobs[] 移除，文档仍为 {version:2, jobs[],
     occurrences[], fences{}} 同构形态（D-007 §10.1 纪律），既有
     occurrences ledger 原样保留；
  b) history：occurrence（state=succeeded）+ run 各一条；
  c) GET /scheduler/runs/{run_id}（audit token）返回 run_id/occurrence_id/
     session_id/structured output（result+final_status）/job_snapshot
     （name/agent_id/schedule/delete_after_run）/error=null；
  d) GET /scheduler/occurrences/{occurrence_id} 返回 occurrence + runs[] +
     output；retry_chain = [自身]；
  e) GET /scheduler/runs?correlation_id= 命中该 run；
  f) events.jsonl 含 reserved→terminal 事件且 seq 单调；月投影与事件一致。

ACC-002（Case 2 recurring 多次执行）
  cron job（fake clock 推进）连续执行 3 次；断言：3 个独立 occurrence
  （occurrence_id 互异、scheduled_at 各为 nominal slot）、3 个 run；
  每个 occurrence 可单独经 API 查询且互不串扰；?job_id= 列表按
  scheduled_at 倒序返回 3 条；同一 nominal slot 重放（模拟 restart 重派生）
  → upsert-merge 后仍是 3 条、无第二身份（R1a）。

ACC-003（Case 3 失败 + retry + timeout 分类）
  a) 首次执行 error（transient）→ outcome=failed, error_code=FAILED,
     retry_count=0；retry 发生后 → 新 occurrence（retry_of_occurrence_id
     = 首个）+ 新 run_id，parent_run_id = 首个 run_id，correlation_id 与
     首个相同，retry_count=1；?correlation_id= 返回整链 2 条。
  b) timeout 场景（fake invoker 挂起 + timeout race）→
     outcome=outcome_unknown + error_code=TIMEOUT + status_view=timeout
     （status=timeout 过滤器命中）；无自动同 occurrence 重试记录。
  c) delivery 失败 → delivery_status=not-delivered +
     error_code=DELIVERY_FAILED 且 outcome=succeeded 不被改写。

ACC-004（Case 4 Dispatcher 全链 trace——fixture 级）
  dispatcher 类 job（fake invoker 返回含 wake_sent 条目的结构化结果：
  {workflow_instance_id, target_agent_id, request_id:'wdhr1:<wi>:<agt>',
  session_id}）；断言 run detail trace.wake_links 与结果条目一致；
  correlation_id 存在且 = 'schcorr:<root occ>'；以 workflow_instance_id
  经 J1/J2 合同可定位 wake link（fixture 中 agent_wake audit 行以 stub
  数据 join）；（生产版 Case 4 = C 块 canary， gated on HR_DISPATCHER
  激活链，不属本实现轮）。

ACC-005（权限）
  无 token → 401；token 验证 seam 未配置 → 401；无 scheduler.read/audit
  scope → 403；scheduler.read token：列表仅见自身 agent_id 的 runs，
  显式传他人 agent_id → 403，直接 GET 他人 run_id → 403；
  scheduler.audit token：全局可见。普通 Agent token 不可能获得全局视图
  （结构性，非清单过滤）；local entitlement 标签（scheduler.read:self 等）
  对 HTTP 面无效（R8 调和义务 1 的负向断言）。

ACC-006（持久化/一致性）
  crash 注入（事件 append 后、投影 commit 前）→ 重载 replay heal，
  投影追平 last_event_seq；events.jsonl 无截断路径（静态断言：history
  代码无 _truncateRunLog 类调用）；corrupt 事件行 skipped + failed-visible。

ACC-007（deleteAfterRun 隔离）
  one-shot 删除前后，history 目录字节不变（job 删除只写 jobs.json 的
  jobs[]）；jobs.json 始终满足 D-007 §10.1 EXACT 形态、既有 occurrences
  ledger 字段零 diff。

ACC-008（结构化结果纪律）
  超 16KB / 非法 JSON / final_status 缺失 → result_recorded=false +
  对应 result_error_code，execution outcome 与 delivery 不变；
  history 行与 API 响应静态扫描零 secret 字段。

ACC-009（只读红线）
  路由表仅三 GET；无任何写路径；/scheduler/* 恒过门禁（无鉴权旁路
  fixture）。

ACC-010（静态红线）
  无 DB/Redis/Kafka 依赖引入；job-model.js 零 diff；jobs.json 写路径
  零 diff（含既有 occurrence ledger 形态）；runs.jsonl 截断逻辑零 diff；
  scheduler core 无业务键解析。
```

### C 块 — 生产 canary（独立授权轮次，前置 G3+G4；不在实现轮验收）

```text
C-A 真实 one-shot（delivery none）跑通后经 API 查到完整 run（含结构化
    结果若适用）；
C-B 一名真实 agent 持 scheduler.read 只见自身 runs；operator 持
    scheduler.audit 见全局；无 token 访问 = 401；
C-B2 deleteAfterRun job 执行后：jobs.json 无该 job、既有 occurrence
    ledger 保留、history/API 完整可查（含 job_snapshot）；
C-C（gated on HR_DISPATCHER 激活链）生产 Dispatcher 轮次后，经
    correlation_id/workflow_instance_id 走通 scheduler run → wake link →
    目标 agent session 的 trace 查询。
```

## 6. ALTERNATIVES / REJECTED_DESIGNS

```text
ALT-001  retry 表述采用任务字面「多个 run 同 occurrence_id」
         — REJECTED：与 D-007 `ONE_OCCURRENCE_MAX_RUNS=1`、
         `RETRY_IDENTITY=NEW_OCCURRENCE` 直接冲突（accepted authority
         优先；BASE 引擎同此实现）。任务意图（parent/correlation/
         retry_count 可见）由 retry 链派生字段完整交付（R2/R10；§2.3-1）。

ALT-002  timeout 作为顶层 status
         — REJECTED：D-007 冻结 timeout 无 proven termination =
         outcome_unknown、非 ordinary failed。timeout 降为 error_code
         分类 + status_view 派生（R3；§2.3-2）。

ALT-003  用数据库表（SQLite/Postgres）存 history
         — REJECTED：任务明令禁止建表；D-007 禁 DB/Redis/Kafka；单机
         文件 + 原子纪律满足规模（fleet ≤ 数百 job）。

ALT-004  scheduled 作为 durable state（未触发也落记录）
         — REJECTED：D-007 durable 记录自 admitted 起（reserve-before-
         Router；BASE 引擎同此实现）；未触发 slot 是 job definition
         投影（listJobs 面），混入 history 会造出无执行事实的「历史」。
         V1 保留过滤关键字、返回空集 + notice（R3）。

ALT-005  把 history 塞进 jobs.json（扩展既有 v2 文档携带 history 字段）
         — REJECTED：BASE 的 jobs.json 已按 D-007 §10.2 选项 1 承载
         occurrence authority ledger（该 ledger 原样保留、不迁移）；但
         history 不得跟进同一文档——违背 R5 隔离（job 删除必须不动
         history 字节）与 R-H2 红线，且 history 无界增长会放大单文档
         全量原子重写的成本与 crash 窗口（既有 ledger 的该形态已是已知
         运营风险，R1 调查 A.6-6）。独立 store 是本 Spec 立足点。

ALT-006  把 runs.jsonl 升级为 history authority（去截断、加查询）
         — REJECTED：D-007 §10.3 冻结其为 evidence 面（10MB bound；
         best-effort append）；它已携带 occurrenceId/runId（r2 修正后
         事实），但改造会破坏既有 evidence 契约且无法满足可查询投影
         需求。history 独立成店，runs.jsonl 原样双写。

ALT-007  单一无限增长 JSON 文档（全量 atomic rewrite per 事件）
         — REJECTED：O(n) 重写放大 + crash 窗口；改为 events.jsonl
         （append-only WAL）+ 按月投影分区（仅活跃月常态重写，R6）。

ALT-008  history 自动轮转/截断（runs.jsonl 式 10MB bound）
         — REJECTED：审计历史正是本 Spec 要保住的事实；自动删除 =
         自我否定。保留 = 无上限，归档仅 operator 显式轮次（R6）。

ALT-009  仅经 broker capability 暴露查询（不做 HTTP API）
         — REJECTED as V1 形态（任务明确冻结 GET 合同）；HTTP 合同与
         broker 暴露不互斥——broker scheduler 查询 capability = 后续
         独立轮次（§4 零改动清单）。HTTP 先行因其权限模型（read/audit）
         与 operator/agent 双受众更直接；既有 self-service 工具面
         （local entitlements）不含全局 audit 也不含本查询合同，二者
         并存不重叠（R8 调和义务 1）。

ALT-010  查询靠解析 runs.jsonl / 日志文本
         — REJECTED：任务红线（禁止只依赖日志文本）；且 10MB 截断使
         其天然不完整。

ALT-011  Scheduler core 解析业务结果（认识 Dispatcher 计数键）
         — REJECTED：破坏 D-007 product 无知纪律；摄取在 production-
         runtime 受信 wrapper，Scheduler 视 result 为 opaque JSON（R4）。

ALT-012  correlation_id 传播进 svc-workflow workflow_execute receipt
         — DEFERRED（V1 拒绝实现）：需 svc-workflow 契约变更（现 receipt
         仅 messageId，r1 轮核查），跨仓授权；V1 以 workflow_instance_id
         join（R9 J2），传播留待 AMEND。

ALT-013  broker/代码内硬编码 caller allowlist 实现「普通 Agent 禁看全局」
         — REJECTED：双头授权权威（与 agent_wake ALT-007 同判）；单一
         权威 = auth-service grant 面，代码只判 scope（R8）。

ALT-014  agent_wake 产生的 agent session 也铸 scheduler Run 记录
         （「+ agent_wake run」字面化）
         — REJECTED：wake 的执行语义归 Router deliver / agent_wake
         capability（各自已有 audit/evidence 面）；scheduler Run 只属于
         scheduler occurrence。链路由 correlation/join 合同承担（R9），
         不复制第二套执行账本。

ALT-015  scope 命名沿用 HR_DISPATCHER 的 scheduler.manage
         — REJECTED：任务书冻结 scheduler.admin；HR_DISPATCHER（仅
         staged WIP proposed）承担同步修订义务（R8 调和义务 2）。
```

## 7. 与既有权威的一致性核对（non-contradiction）

```text
D-007（accepted）         history 只记录不 gate（R-H1）；五态 EXACT 复用
                          （R1/R3；BASE OCCURRENCE_STATES 同集）；
                          retry=new occurrence（ALT-001）；timeout=
                          outcome_unknown（ALT-002）；delivery 分离
                          （R10）；deleteAfterRun evidence 保留语义被
                          查询面完整兑现（R5；BASE 引擎行为已成立，本
                          Spec 补查询自包含）；jobs.json v2 文档与既有
                          occurrence ledger、runs.jsonl 零改动
                          （R-H2/R-H3）；§10.2 既有选项 1 实现未被越权
                          改动、未来 layout 演进经 R1a 优先级 1 对齐；
                          §12.2 CLI runs 义务完整兑现（§4） ✔
D-008（accepted；         run.session_id 仅链接引用；API 不读会话内容；
supersedes D-006）        per-occurrence fresh session 已由 BASE 实现回
                          （'cron-run-<occ>'），本 Spec 只记录 session_id ✔
SCHEDULER_TIMEOUT_OUTCOME_V2（accepted；  outcome_unknown/fence/terminal
V1 已 superseded）        evidence 词汇原样引用，未重定义 ✔
AGENT_CORE_SELF_SERVICE_  local entitlement 标签与 token scope 家族显式
SCHEDULER_TOOLS_V1        分离（R8 调和义务 1）；其 CTR-RESULT-002 的
（accepted）              post-delete 查询缺口正是本 Spec 查询面闭合对象；
                          不要求其任何变更 ✔
AGENT_CORE_AGENT_WAKE_    join 合同只消费其冻结的 requestId 公式与 L1
CAPABILITY_V1（staged WIP audit 面，不要求其任何变更 ✔
proposed）
AGENT_CORE_HR_DISPATCHER_ 结构化结果键集对其为推荐而非本 Spec 冻结；
V1（staged WIP proposed   scheduler.manage→admin 调和义务显式化（R8）；
r3）                      本轮零修改该文件 ✔
broker 架构纪律           不新增 capability/manifest（后续轮次）；scope
                          命名沿用 <domain>.<verb> requiredScopes 先例
                          （gateway.js fail-closed 同族） ✔
任务书红线                零实现/零 store 修改/零 jobs.json 修改/零 DB/
                          零 API 部署——本轮 docs-only（§8） ✔
```

## 8. 本轮边界（不做清单）

```text
PRODUCT_CODE_CHANGE      = NONE（零 packages/、scripts/ 改动；本轮仅本
                           Spec 文件 + 修订报告 docs/reports/
                           agt-prep-scheduler-spec-revision-v1.md）
SCHEDULER_STORE_CHANGE   = NONE（jobs.json / runs.jsonl / 既有 occurrence
                           ledger 零触及）
JOB_SCHEMA_CHANGE        = NONE（且实现闭包结论 NOT_REQUIRED，§4）
DATABASE / TABLE         = NONE
API / DEPLOY / RESTART   = NONE（GET 合同仅存在于本 Spec 文本）
GRANT / SCOPE_CHANGE     = NONE（scheduler.* scope 供给归 G4 auth-service 轮次）
D-007 / 相关 SPEC 修改    = NONE（SELF_SERVICE / HR_DISPATCHER 调和义务仅
                           记录，不代改）
PRODUCTION_CHANGE        = NONE（零生产访问；本轮全部为仓库内 read-only
                           核查 + 单文件写作）
本 Spec 文件 staged by explicit path only；git diff --cached --check = PASS
```

## 9. Final Output

```text
TASK_NAME = 调度历史 规格
TASK_TYPE = SPEC_AUTHORING_ONLY
SPEC_ID = AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
SPEC_STATUS = proposed（r2——现状事实刷新修订；目标语义与 r1 冻结合同一致）
DELIVERABLE = docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md（单文件）
DELIVERED_SECTIONS = DEVELOPMENT_PREFLIGHT（§1）+ PROPOSED_SPEC（§0、§2、
  §3 R1–R11）+ IMPLEMENTATION_CLOSURE（§4）+ ACCEPTANCE_CRITERIA（§5，
  Case 1–4 → ACC-001..010 + C 块 canary）+ ALTERNATIVES / REJECTED_DESIGNS
  （§6 ALT-001..015）

R2_FACT_FIXES = S1 引擎现状 = D-007-conformant（§0/§1/§2.1，BASE file:line
  逐条引用并经本修订轮 worktree 复核）；S2 执行记录身份 = 既有（v2
  occurrence ledger + runs.jsonl 均含 occurrenceId/runId），缺口重述为
  结构化结果/summary 持久化/独立 history store/HTTP API/token 门/
  correlation 真缺字段/job_snapshot（§0/§1/R2/R5/R6/R11）；S3 governed_by
  D-006 → D-008（§frontmatter/§2.1/§7；关联：SCHEDULER_TIMEOUT_OUTCOME_V1
  → V2、SELF_SERVICE related_spec 增补）

CORE_MODEL = Job Definition → Occurrence → Run → Session/Agent/Output/Audit
OCCURRENCE_FIELDS = occurrence_id / job_id / scheduled_at / schedule_revision
  （+ job_snapshot / origin / retry_of_occurrence_id / state / fenced /
  payload_hash / admitted_at / updated_at）
RUN_FIELDS = 十组冻结（identity / schedule / model / timing / status /
  delivery / retry / error / trace / result，§3 R2）
IDENTITY = IDENTITY_SOURCE = execution-authority（BASE occ:/run: 身份原样
  记录，R1a 优先级 1）；派生回退公式仅边缘场景、不回写权威 ledger
STATUS_MAPPING = 任务词汇 → D-007 五态 + error_code 分类（R3；timeout 与
  cancelled 是分类非状态；scheduled V1 不落 durable）
STRUCTURED_RESULT = scheduler-result fenced block（final_status PASS/
  PARTIAL/FAIL + 扁平 integer counters，16KB，受信 wrapper 摄取，Scheduler
  opaque）——不依赖日志文本
DELETE_AFTER_RUN = 删除 Job Definition ≠ 删除执行历史（BASE 定义删除侧已
  成立）；job_snapshot 使历史自包含；job 删除不触 history 字节
  （R5 / ACC-007）
HISTORY_STORE = scheduler/history/{events.jsonl(append-only,fsync,never
  truncated) + runs-<YYYYMM>.json(月分区原子投影)}；单 mutation authority；
  replay heal；默认无上限保留（归档 = operator 显式轮次）；零 DB；与既有
  jobs.json ledger / runs.jsonl 并存不替代
QUERY_API = GET /scheduler/runs（job_id/agent_id/status/time range/
  session_id/correlation_id 过滤 + 分页游标）+ GET /scheduler/runs/{run_id}
  （run/job_snapshot/session link/output/error/trace）+ GET /scheduler/
  occurrences/{occurrence_id}（occurrence/runs[]/retry_chain/links）；只读
PERMISSIONS = scheduler.read（自己的 runs）/ scheduler.audit（全局）/
  scheduler.admin（job definition 变更——本 Spec 无端点）；普通 Agent 禁看
  全局；Bearer + auth-service scope 门禁 fail-closed；local entitlement
  标签（SELF_SERVICE）与 HR_DISPATCHER scheduler.manage 两条命名调和义务
  已记录（R8）
CORRELATION = correlation_id（retry 链共享链根；BASE 真缺）+ parent_run_id
  （BASE 真缺）+ request_id（BASE 已有 = idempotencyKey，透传在链）；J1
  wake（requestId='wdhr1:<wi>:<agt>' join）/ J2 workflow
  （workflow_instance_id join，传播留 AMEND）/ J3 deliver evidence
RETRY_SEMANTICS = D-007 优先：retry = 新 occurrence + 新 run_id +
  新 request_id，retry_count 沿链派生（任务字面「同 occurrence_id 多 run」
  被 REJECTED，§2.3-1）
JOB_SCHEMA_MODIFICATION = NOT_REQUIRED（若实现轮推翻 → 停止并报告）
AUTHORITY = D-007 不修改、不 amend；既有 occurrence authority ledger 与
  runs.jsonl 零改动；history 不 gate admission（R-H1）
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_CHANGE = NONE
READY_FOR_REVIEW = YES
NEXT_TASK = 调度历史 审计
```
