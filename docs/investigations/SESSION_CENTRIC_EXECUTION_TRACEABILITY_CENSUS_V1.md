---
spec_id: SESSION_CENTRIC_EXECUTION_TRACEABILITY_CENSUS_V1
status: proposed
spec_kind: investigation
authority_level: evidence
implementation_authority: none
production_apply_authority: none
date: 2026-09-24
authority_driver: SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 (Goal, Owner directive 2026-09-24)
scope: []
governed_by:
  - AGENT_CORE_EXECUTION_HISTORY_QUERY_V1
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_WORKSPACE_SESSION_MODEL_V3
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# SESSION_CENTRIC_EXECUTION_TRACEABILITY_CENSUS_V1 — Session 为锚的执行追溯普查（fresh 2026-09-24，全只读）

> 状态：**proposed（docs-only investigation；`implementation_authority=none`）**。
> 证据方法：fresh `origin/main`（`2a85d065`，2026-09-23 PR #316 merge）源码只读核查，四路并行
> （scheduler 链 / ASM send 链 / workflow 链 / session 面 + 查询层），全部结论附 `file:line`。
> 上游证据底账：`EXECUTION_HISTORY_RECORD_CENSUS_AND_CORRELATION_GAPS_V1.md`（2026-09-18，其 §1-§5
> 生产事实继续有效；本文只记录该文之后的变化与本 Goal 特有的链路矩阵）。
> 本文回答 GOAL §二：七条链 A-G 当前每一跳的坐标字段持久化现状，用
> `PERSISTED_EXACT / OBSERVABLE_ONLY / DERIVED_EXACT / WEAK_JOIN / ABSENT / NOT_APPLICABLE` 分级。

---

## 0. 基线事实（2026-09-18 census 之后的主要变化）

- `832843e0`+`75a0fb27`+`f0c05ce0`+`63611f30`（09-18/19，PR #309）：`AGENT_CORE_EXECUTION_HISTORY_QUERY_V1`
  **已实现并合入 main**——`packages/execution-history`（四根查询核心 + R1-R9 关联 + redact + 隔离索引）、
  broker 双工具 `execution_trace_query`（self）/`execution_history_audit_query`（global）、
  WPA-1（ASM audit 轮转归档，`agent-session/audit.js` archive-on-rotate）。
  ⇒ 原 G1（attempts 无 reader）、G2（audit 轮转丢 join）、G5（无统一查询视图）已在读侧闭合。
- `a5fed401`（09-19）：`self_ops` 模型可见（Tools V4）。
- `2a85d065`（09-23，PR #316）：durable generation restart safety（`turnExecutionId` handle 命名空间 durab­ility 修复）。
- **仍然成立的缺口**（本 census §4）：scheduler self `runs` 投影无 sessionId；pre-start rejection 仍把
  `nativeSessionId` 持久化为 RunRecord.session_id；runtime-evidence invocation 行缺 occurrence/job 坐标；
  workflow `run_delivered.messageId` 生产 seam 永不填充；无任何 "list my sessions" 面；
  `execution.history.read/audit` grant packet 未落地（authsvc 侧部署前置项）。

## 1. SessionRef 与 session 坐标基座

- **SessionRef = (agentId, sessionId)**：`AGENT_CORE_PRODUCT_ARCHITECTURE_V1` §2 FROZEN（product sessionId =
  DSH native sessionId，per-Agent DSH_HOME 作用域，`main` 可并存）。裸 sessionId 非全局唯一。
- Journal 路径：`<root>/homes/<agentId>/sessions/<projectKey>/<sessionId>/session.jsonl`
  （`packages/execution-history/src/loaders/session-journal.js:2-3`；`turn-inspection.js:88-98`）。
- Header（record 0）：`{type:'session', version:0, id, createdAt, delegationDepth, cwd, …}`
  （`packages/session-history/src/snapshot.js:25-65`）。**无 title/kind/archived/lastActiveAt 元数据 store**
  （repo 全树 grep 无命中；D-002 metadata model 显式 DEFERRED，`AGENT_CORE_COMPONENT_MAP_V1.md:44`）。
  `createdAt` 持久（PERSISTED_EXACT）；`lastActive` = 文件 mtime / 末事件 time（DERIVED_EXACT）。
- Session kind：D-008 冻结分类法 `main | cron-run-* | agent-delegation/task-* | background-*`
  （`docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md:247-251`）。从 sessionId 前缀机械可判（DERIVED_EXACT）。

## 2. 链路矩阵（GOAL §二字段清单；现状 @2a85d065）

分级：`PERSISTED_EXACT`（durable 精确坐标）·`OBSERVABLE_ONLY`（仅观测面，无 durable 或短保留）·
`DERIVED_EXACT`（从持久坐标确定性推导）·`WEAK_JOIN`（命名约定/时间近似）·`ABSENT`（不存在）·`N_A`。

### 链 B — Scheduler → Agent（最完整的链）

| 字段 | 现状 | 证据 |
|---|---|---|
| TRIGGER_ID | `occurrenceId='occ:'+sha256-16`（PERSISTED_EXACT） | `occurrence-model.js:78-84` |
| JOB_ID | PERSISTED_EXACT（job.id + occurrence.jobId） | `job-model.js:110-176` |
| OCCURRENCE_ID / RUN_ID | PERSISTED_EXACT（`run:'+occ`；occurrence ledger + history events 永不删） | `occurrence-model.js:86-88`；`history-storage.js:130-143` |
| REQUEST_ID | `=idempotencyKey=occurrenceId`（PERSISTED_EXACT，V3 §5.4） | `occurrence-model.js:198-199` |
| TARGET_AGENT_ID | `job.agentId`（PERSISTED_EXACT，定义时定死） | `job-model.js:86-87` |
| TARGET_SESSION_ID | `nativeSessionId='cron-run-<occ>'`（DERIVED_EXACT 命名；**pre-start rejection 也持久**） | `occurrence.js:163,311`；`history.js:89` |
| SESSION 实际存在性 | **无独立字段**；可由 `state`+`terminalEvidence.kind` 机械推导（pre-start-rejection ⇒ 未创建） | `invoker-outcome.js:78-106`；`occurrence-model.js:26-28` |
| TURN_EXECUTION_ID / MESSAGE_ID | ABSENT（RunRecord 冻结字段集无此二者；runs.jsonl `router_admission` 行有 `reconciliationHandle`，10 MiB 截断） | `history-model.js:85-117`；`store.js:34` |
| RECONCILIATION_HANDLE | OBSERVABLE_ONLY（runs.jsonl router_admission 行 + runtime-evidence invocation 行；**invocation 行缺 occurrenceId/jobId，无法坐标匹配**） | `occurrence.js:175-186`；`scheduler-invoker.js:25-39` |
| DELIVERY_RECEIPT | `deliveryStatus`（PERSISTED_EXACT，V3 冻结） | `occurrence.js:317-322` |
| SESSION_CREATED=NO 溯源 | pre-reserve 拒绝=`slot_accounting`/`retry_admission_failure`（10 MiB 截断 runs.jsonl + `self_ops.job_disposition` 可查）；post-reserve pre-start=`failed`+`terminalEvidence.kind='pre-start-rejection'`+RunRecord.error_code（全 durable） | `slot-accounting.js:105-123`；`diagnosis.js:111-190`；`invoker-outcome.js:78-90` |

自查询现状：`scheduler` 工具 self `runs`（零 Auth，V4 CTR-RESULT-002）返回
`occurrenceProjection`（`projections.js:37-53`）**不含 nativeSessionId**；`self_ops.job_disposition`
已答"为什么没跑"。`execution_trace_query` root=scheduler_run 能解析 session（`scheduler-root.js:75`）
但需 `execution.history.read` grant（未部署），且 join 标 `JOIN_BY_NAME_CONVENTION`/`WEAK_NAME_JOIN`
（`scheduler-root.js:97-99,144-148`）。

### 链 C — Workflow → Agent → 业务提交

| 字段 | 现状 | 证据 |
|---|---|---|
| TRIGGER_ID | `dispatchIntentId`（PERSISTED_EXACT，due feed 7 字段契约） | `judgment.js:22-58` |
| WORKFLOW_INSTANCE_ID / NODE_VISIT_ID | PERSISTED_EXACT（attempts ledger identity 四元组；svc 侧 UNIQUE） | `ledger.js:72-78` |
| ATTEMPT_ID | `wfeat-<sha256(lower(nodeVisitId))[:24]>`，gen>1 `#genN`（PERSISTED_EXACT + DERIVED_EXACT 双路） | `ledger.js:60-70` |
| REQUEST_ID | `=attemptId`（PERSISTED_EXACT） | `engine.js:165` |
| TARGET_SESSION_ID | `run_delivered.sessionId`（恒 `'main'`，WAE 定址约定；PERSISTED_EXACT） | `workflow-execution-runtime.js:132,140-148`；`ingress-delivery.js:437-440` |
| MESSAGE_ID | ledger 字段**存在但生产 seam 永不填**（deliver 收据含 messageId，被丢弃） | `ledger-events.js:190-216`（字段）；`workflow-execution-runtime.js:133-137`（丢弃）；对照 `ingress-delivery.js:484-491`（收据有 messageId） |
| RECONCILIATION_HANDLE | PERSISTED_EXACT（收据携带时） | `ledger-events.js:190-216` |
| 消息 provenance sidecar | 目标 user/message `source={kind:'workflow_execution',workflowInstanceId,nodeVisitId,attemptId}`（机制在 main；现产 0 样本，查询层显式 `CORRELATION_GAP/message_sidecar`） | `session-seam.js:193-198`；`workflow-root.js:89-92` |
| 业务提交 | tool/result `workflowStateVersion` 持久（journal）→ R4 桥 svc `event_sequence`/`command_id`；**command_id 不回 dsh**（svc receipts 无读端点=SOURCE_ABSENT）；broker Idempotency-Key 不落盘 | `session-journal.js:253-264`；`rules.js:156-163`；WAE V2 CTR-WAE-010 |
| SESSION_CREATED=NO 溯源 | `resolution_blocked{code}`（ZERO side effects）/`delivery_failed{reason:'delivery_rejected:<code>'}`（terminal）；**无 SESSION_CREATED 字面词汇，语义由既有 taxonomy 承载** | `engine.js:163-181`；`ledger.js:480-483,449-459` |

### 链 D — agent_session_send（双 Session 链）

| 字段 | 现状 | 证据 |
|---|---|---|
| SOURCE_AGENT_ID | trusted `context.callerAgentId`（PERSISTED_EXACT audit 行） | `gateway.js:264`；`audit.js:214-226` |
| SOURCE_TURN_ID | 目标侧 verbatim（user/message source.correlation）；调用侧仅 `correlationHash=sha256(turnExecutionId)[:16]`（DERIVED_EXACT——caller 持有原像可重算） | `session-seam.js:214`；`audit.js:66-68` |
| REQUEST_ID | PERSISTED_EXACT（audit intent+outcome 行）；**不回 caller**（relay 结果验证器只放行 `{status,targetAgentId,sessionId,messageId[,reply]}`） | `audit.js:234-255`；`relay.js:137-150` |
| TARGET_AGENT_ID / TARGET_SESSION_ID / MESSAGE_ID | PERSISTED_EXACT（首张 proven-receipt outcome 行必须持久三坐标；同步响应即回 caller） | CTR-ASM2-008/009；`provider:251-267,270-272` |
| RECONCILIATION_HANDLE | PERSISTED_EXACT（audit 行；reconcile 读窗 live+.1） | `audit.js:303-339` |
| 保留 | WPA-1 archive-on-rotate 已实现（不再丢 join）；reconcile/turn_inspect 仍只读 live+.1（语义冻结） | `audit.js:60-63,93-180`；EXECUTION_HISTORY_QUERY_V1 §6 |
| caller-side durable 主证据 | ASM audit（live+.1+archive）= 是；turn-recovery correlationIndex（requestId→handle）durable 但 capacity-bounded 且结算即 unlink（不是 history）；F1（durable 记录 callerCorrelation/messageId 入 MANDATORY 字段）仍开放 | `authority-capacity.js:166,173`；`durable-file.js:42-49` |
| 同 turn 双发 | requestId/invocationCorrelation/messageId 三重区分（PERSISTED_EXACT，不串） | `provider:199`；`relay.js:393-399`；SPEC:1009 |

### 链 A — Human/Channel → Agent

| 字段 | 现状 |
|---|---|
| SessionRef | PERSISTED_EXACT（user/message `source={kind:'user'}` 落 journal） |
| 渠道 trigger 外部 ID | ABSENT（notification-ingress 幂等记录 7 天 sweep；journal user 消息无渠道坐标字段）—诚实缺口，本 Goal 不扩渠道写路径 |
| 其余坐标 | N_A（无 scheduler/workflow/send 语义） |

### 链 E/F — 业务提交与结果投递（横切）

- 提交证据：见链 C 行"业务提交"（R4 桥=充分证据链）。
- 投递：scheduler `deliveryStatus`+Feishu deliver；send `replied` 行；workflow 由 agent 自身 transition 驱动
  （完成语义归 svc authority，Session 只串执行面）。

## 3. 现有自查询面盘点（@2a85d065）

| 面 | 域 | 会话可达？ | 阻塞 |
|---|---|---|---|
| `scheduler`(self list/runs) | self 零 Auth | **否**（投影无 sessionId） | V4 投影细化 |
| `self_ops`(status/reconcile_turn/job_disposition) | self 零 Auth | 否（答 blocker 不答 session） | — |
| `agent_session_turn_inspect` | own-dispatch 单轮 | 需自备 (target,sessionId,messageId) | 单轮视窗 |
| `execution_trace_query`(四根) | self，`execution.history.read` | **是**（最强面） | grant packet 未部署 |
| `execution_history_audit_query` | global，`execution.history.audit` | 是（audit≠解密权） | 同上 |
| mobile 8789（session-history HTTP） | human（Binding） | main 单 session 消息 | 非 agent 面；投影丢 provenance |
| **list my sessions** | — | **不存在任何工具** | 本 Goal NEW |

## 4. 缺口结论（喂给 Spec 的最小增量）

- **K1**（读面，self 零 Auth）：无 `MY_SESSIONS` 枚举面 → NEW `agent_session_list`（坐标-only，复用
  `listAgentSessionFiles`/header/session-index，不建新 registry）。
- **K2**（读面，self 零 Auth）：scheduler self `runs` 投影补 `sessionId`+`sessionCreated` disposition
  （从冻结 taxonomy `state`/`terminalEvidence.kind`/`executionOutcome` 推导，不发明新状态；
  V4 CTR-RESULT-002 字段清单为 inclusive，加法细化不改其义）。
- **K3**（证据行加法）：runtime-evidence invocation 行补 `occurrenceId/runId/jobId/requestId`
  （invocation 对象既有字段；loader `runtime-evidence.js:10-14` 已支持）→ scheduler↔session join 从
  纯命名升级为坐标匹配 + journal 存在性证明（`DERIVED_EXACT`，非 fuzzy）。
- **K4**（查询层语义）：scheduler-root 增 `SESSION_CREATED=NO{reason}`/`UNKNOWN` 显式 disposition；
  journal 存在时 join 定级 `DERIVED_EXACT`（确定性派生+存在性证明），仅无 journal 时保持诚实 GAP。
- **K5**（REUSE 修复）：workflow 生产 deliverRun seam 填充 `run_delivered.messageId`（字段已在 WAE V2
  `ledger-events` 契约内，属实现缺口非契约变更）。
- **K6**（保持 ABSENT，如实）：scheduler RunRecord 的 messageId/turnExecutionId（F2）、svc command_id 读端点
  （F6）、渠道 trigger ID——全部维持 SOURCE_ABSENT/记档，不造假、不建第二账本。
