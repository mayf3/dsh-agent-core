---
spec_id: EXECUTION_HISTORY_RECORD_CENSUS_AND_CORRELATION_GAPS_V1
status: proposed
spec_kind: investigation
authority_level: evidence
implementation_authority: none
production_apply_authority: none
date: 2026-09-18
authority_driver: EXECUTION_HISTORY_CORRELATION_AND_RECONCILIATION_V1 (Goal, Owner directive 2026-09-18)
scope: []
governed_by:
  - AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW deployed lineage f6a7400 (migrations 0001-0026)
    relation: workflow_record_model
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# EXECUTION_HISTORY_RECORD_CENSUS_AND_CORRELATION_GAPS_V1 — 执行记录普查与关联缺口（fresh 2026-09-18，全只读）

> 状态：**proposed（docs-only；`implementation_authority=none`、`production_apply_authority=none`）**。
> 证据方法：三路并行只读核实——① dsh-agent-core `origin/main`（cfc2729）源码面；② svc-workflow 部署代
> f6a7400（本地 git 直接验证迁移清单）；③ 生产 runtime 实测（ps/launchctl/plist/文件系统/HTTP health，
> 全程零写入零重启）。所有"生产事实"均为 2026-09-18 当日读盘/读进程所得，非源码推断。
> 本文是 GOAL「先核实已有实现，再做最小增量」的 §二 交付：回答"当前实际用什么派发路径、各来源已有什么
> 事件/ID/查询/保留、哪些关联可直接建立、哪些缺口真的需要动生产写路径"。
>
> 计数漂移注记（同日语料自然增长，不影响结论）：晚间复核 inter_agent sidecar=37（不变）、
> `workflowInstanceId` 出现文件=669、session.jsonl 总数=673；`workflow_execution` sidecar 仍=0 真实样本
> （唯一 grep 命中为 tool 输出中的巧合文件名）。

---

## 1. 生产 runtime 拓扑（当日实测）

| 进程 | 用户 | root | 端口 | 角色 |
|---|---|---|---|---|
| pid 3380 `production-runtime.mjs --root /Users/authsvc/.agent-core` | authsvc | `/Users/authsvc/.agent-core` | 8790 ingress | **canonical 工具执行域**（LaunchDaemon `system/ai.agent-core.runtime`，`AGENT_CORE_DEPLOYED_SHA=d602b592…`，持 credentials file；scheduler 生产 store=`/Users/authsvc/.agent-core/scheduler/jobs.json` 即 `AGENTCORE_EXPECTED_STORE`） |
| pid 31322 `production-dsh-agent-core/scripts/production-runtime.mjs --root /Users/yanfenma/.agent-core` | yanfenma | `~/.agent-core` | 127.0.0.1:8787 product API、8791 ingress、**100.103.205.36:8789 history** | GUI 产品面（飞书 HR 面历史沿革）；8789=T48 history backend overlay（wrapper 注释 "T48 history backend bounded overlay controlled deploy 2026-09-15"，`PRODUCT_API_HISTORY_ENABLED=1`，fail-closed 403 实测） |
| pid 60339 `…--root /Users/yanfenma/.agent-core-scheduler-v2` | yanfenma | `~/.agent-core-scheduler-v2` | 8795 ingress | scheduler-v2，jobs.json 冻结于 09-07，engine idle |

关键读面事实（影响查询层设计）：
- **`/scheduler/runs` HTTP（:8787，JWT scheduler.read/scheduler.audit）读的是 GUI runtime root**（`~/.agent-core`），
  而 canonical scheduler store 在 authsvc root。系统 daemon `PRODUCT_API_ENABLED=0`（8787 未挂载 scheduler 路由）。
  ⇒ **对 canonical store 的 run history，HTTP 面当前不可用；可用入口 = canonical runtime 内部（broker）或
  authsvc CLI**。scheduler-v2 root 的 `scheduler/history/` 为空目录（09-07 后无运行）。
- `/Users/authsvc/.agent-core/{control,scheduler,logs,workflow-execution,notification-ingress,bindings}` 均 700 authsvc，
  uid 502 不可读；`/Users/authsvc/.agent-core/homes/**` 与 `workspaces/**` world-readable（669 个 session.jsonl、597 MB、
  最早 2026-08-16）。
- authsvc 4001：`/health`=404、`/api/health`=200（path 差异记档）。
- 无任何 newsyslog/logrotate/cron 清理触及 sessions/homes/logs；唯一删数据机制=ASM audit 8 MiB×2 代轮转、
  scheduler runs.jsonl 10 MiB 截断、notification-ingress 幂等记录 7 天 sweep（`idempotency.js DEFAULT_RETENTION_MS`）。
  **执行历史证据深度=舰队年龄（08-16 起），不是保留策略给的。**

## 2. 已有记录清单（按系统，含原生 ID 与保留现状）

### 2.1 dsh-agent-core（origin/main 已实现且随部署在产）

| 记录 | 位置（`<root>`=运行 root） | 关键字段/ID | 保留 |
|---|---|---|---|
| ASM L1 发送审计 | `<root>/control/agent-session-messaging-audit.jsonl`(+`.1`) | phase intent/outcome；`requestId, invocationCorrelation, correlationHash, sourceAgentId, targetAgentId, sessionId, messageId, reconciliationHandle, timeoutMode, startedAtWallMs` | **8 MiB 单代轮转 ⇒ 旧 join 不可逆丢失** |
| Router turn 账 | 进程内 epoch map；durable=`<root>/control/turn-recovery-v3.json` | `reconciliationHandle/turnExecutionId, processGeneration, sessionId, …`；**缺 callerCorrelation/messageId** | 覆盖写，非追加 |
| Workflow 执行账本 | `<root>/workflow-execution/attempts.jsonl`(+lock) | `attemptId='wfeat-'+sha256(nodeVisitId)[:24]`；identity triple `{dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId}`；事件 `attempt_planned/delivery_started/resolution_blocked/recovery_authorized|refused/run_delivered/delivery_failed/reconciled/stale_superseded`；`run_delivered={attemptId, agentId, requestId=attemptId, sessionId, messageId?, reconciliationHandle?, workflowStateVersionAtDispatch}` | append-only，**无任何读取 API** |
| Scheduler 结构化历史 | `<root>/scheduler/history/`：`events.jsonl`(append+fsync 不截断)+`runs-YYYYMM.json` | RunRecord 含 `run_id='run:'+occ, occurrence_id='occ:'+hash16, job_id, session_id='cron-run-<occ>', agent_id, correlation_id='schcorr:<rootOcc>', parent_run_id, request_id=occurrenceId, outcome/status_view, delivery_status, retry_of_occurrence_id, result{final_status, counters, wake_sent[]}` | events 永不删；runs.jsonl(旧)10 MiB 截断 |
| Scheduler occurrence 台账 | `<root>/scheduler/jobs.json` v2 occurrences[] | `occurrenceId, scheduleRevision, state, fenced, startedAt/endedAt, executionOutcome, deliveryStatus, terminalEvidence, nativeSessionId` | 随 job 保留（deleteAfterRun 只删定义） |
| Session journal（Harness） | `<root>/homes/<agentId>/sessions/<projectKey>/<sessionId>/session.jsonl` | 头 `{type:'session',version:0,id,cwd,…}`；事件 `user/message`(含 `data.source={kind:'user'\|'inter_agent'{sourceAgentId,correlation=sourceTurnExecutionId}\|'workflow_execution'{workflowInstanceId,nodeVisitId,attemptId}}`)、`assistant/message`、`turn/start|end`、`tool/call|result`、`agent/inbox/spliced`(messageId) | append-only，无删除机制 |
| Runtime 证据行 | `<root>/control/runtime-evidence.jsonl`；scheduler invoker 另写 `kind:'invocation'`(sessionId, reconciliationHandle, summary, evidence) | | 无轮转 |
| Mobile/session-history 后端 | `@agent-core/session-history` 只读包；`GET /v1/agents/{id}/sessions/main/messages`（Tailnet listener；现产=T48 overlay 8789） | 公共 ID `msg_sh1_<hash>`；**投影只取 `source.kind=='user'` 的 user 消息+最后 assistant 文本，provenance 全部丢弃** | 无 |

实测语料验证：inter_agent sidecar 在 37 个 session 文件真实存在；`workflow_execution` sidecar = **0 文件**
（与"调度→WAE 引擎派发尚未成为生产路径"一致，见 §4-G6）；`workflowInstanceId` 字样出现在 666 个文件——
来源是 **tool call 参数/结果**（workflow_instance_detail/workflow_execute 落盘），本身就是业务坐标的持久锚。

### 2.2 svc-workflow（部署代 f6a7400，migrations 0001-0026 全在产；本地 main=88ff814 落后分叉，不可作依据）

- 事实模型：`workflow_instances`(`workflow_state_version`单调)、`workflow_node_visits`(UNIQUE(instance,node,visit))、
  `workflow_submissions`(UNIQUE(source_node_visit_id))、`workflow_context_revisions`、
  **`workflow_activations`**（0023：`activation_id` PK，`node_visit_id` UNIQUE——每 visit 恰一 activation；
  `activation_kind ∈ {HUMAN_WORK_ITEM, DISPATCH_INTENT}`；wire 上的 `dispatchIntentId == activation_id`）、
  `workflow_activation_closures`（closure_reason+event_id）、`workflow_dispatch_eligibility_events`（WAKE/SCHEDULER_DEFER…）。
- 事件账本 `workflow_events`：`event_sequence == new_workflow_state_version`（不可变触发器），
  **自带 `command_id, causation_id, correlation_id`**；`workflow_command_receipts`（`idempotency_key` UNIQUE(principal,key)、
  `command_type, request_hash, receipt_status, response_*`）；`workflow_command_attempt_audits`、`workflow_security_audits`。
- 读面：`GET /internal/v1/workflow-instances/{id}`（detail）、`/{id}/timeline`（`after=event_sequence` 游标）、
  `/{id}/submissions`、domain/global 列表、worklists、assistance 家族、（branch→部署代已有）`GET /internal/v1/dispatch-intents`
  7 字段投影+`POST .../node-visits/{id}/wake`。keyset 分页；可见性分级（DomainOwnerFull/CurrentAssigneeFull/
  CreatorDraftFull/HistoricalParticipantRestricted），越权读审计。
- 保留：不可变账本，**无任何 prune/TTL**——svc 侧天然满足"不淘汰"。
- **svc 侧没有任何派发投递/消费记录**：activation 只记 owner_principal_id 与 next_eligible_at；WAKE 不携带
  session/message 标识；"从未派发"与"派发后 agent 沉默"在 svc 单侧不可区分。

## 3. 现有可直达的关联（不需新建写路径即可建立）

| 关联 | 机制 | 精度 |
|---|---|---|
| 发送调用 ↔ 目标消息 | ASM L1 audit 行（requestId→sessionId/messageId）+ 目标 session user 消息 `source.correlation=sourceTurnExecutionId` | 精确（但受 8 MiB 轮转窗口限制） |
| workflow visit ↔ 执行 attempt | attempts 账本 identity triple + `attemptId=wfeat-<hash(nodeVisitId)>` 确定性派生 | 精确 |
| attempt ↔ 目标 turn/消息 | `run_delivered{requestId=attemptId, sessionId, messageId, reconciliationHandle}`；目标消息 sidecar `workflow_execution{workflowInstanceId,nodeVisitId,attemptId}` | 精确（sidecar 现产 0 样本，机制在产未练） |
| 调用侧业务提交 ↔ svc 事实 | tool result 直通 svc 响应：`workflowStateVersion == workflow_events.event_sequence` → `command_id` → `workflow_command_receipts`；session journal 持久化了该 tool result | **精确（零 svc 改动的桥）**；broker Idempotency-Key 随机且不落盘，dsh 单侧不留 key（不构成 V1 缺口，约束记档） |
| scheduler occurrence ↔ session | `session_id='cron-run-<occ>'` 命名约定 + scheduler invoker 的 invocation 证据行(sessionId, reconciliationHandle) | 命名级（弱）+证据行辅助 |
| messageId/turn 坐标反向定位 | session journal 全文定位 + ASM audit 反查 + turn-recovery-v3.json（缺 caller 字段，仅 epoch 内精确） | 部分 |
| svc visit ↔ svc 事件/提交 | `workflow_events.source/target_node_visit_id`、submissions.source_node_visit_id、activation UNIQUE(visit) | 精确 |

## 4. 缺口普查（每条附证据；标注是否需要动生产写路径）

- **G1（读取面，非写路径）** attempts.jsonl 无任何 reader（无 HTTP/broker/CLI）；关联数据在盘上但不可查询。
  证据：origin/main 全树 grep 无消费方；reconciliation 仅 engine 内文件扫描。
- **G2（保留，§五C）** ASM audit 8 MiB×2 代轮转：send↔turn join 随轮转永久丢失，而目标 session journal 仍持有
  两侧证据。V2 spec 明示"no retention promise"（CTR-ASM2-011）→ 本 Goal 须以隔离索引/证据副本补保留。
- **G3（关联弱键）** scheduler run ↔ Router turn 无持久 messageId/turnExecutionId（R9-J3 仅以 request_id=occurrenceId
  走 callerCorrelation，而 callerCorrelation 不进 turn-recovery durable 记录）；现靠 `cron-run-<occ>` 命名约定。
- **G4（§五B 候选，写路径）** `turn-recovery-v3.json` durable 记录字段集缺 `callerCorrelation/messageId`
  （durable-file.js:44-58）→ Router 重启后 turn↔caller 关联只能依赖 ASM audit（受 G2 轮转）。
- **G5（读取面）** 无统一查询视图：六套存储、六套 ID 词表（occ:/run:/schcorr: vs wfeat- vs requestId/invocationCorrelation
  vs 原生 messageId/turnExecutionId vs svc UUID），唯一全局持久锚=session source sidecar，但无人索引。
  Goal §五A 明示"允许写入隔离的查询索引、证据副本和报告"→ 以可重建读取视图解决，**不动生产写路径**。
- **G6（事实缺口，如实报告）** `workflow_execution` messageOrigin sidecar 现产 0 样本：调度/WAE 引擎派发链尚未在产
  跑通（broker-only preflight 09-18 才 READY_FOR_AUTHORIZATION）。查询层必须支持"该环节无记录≠未发生/≠失败"
  的显式缺口表达。
- **G7（读取面）** mobile/session-history 投影丢弃 provenance（只投影 kind=user），8789 现产面无法从消息回跳任何
  dispatch/turn/workflow ID。
- **G8（非缺口，记档）** svc 无投递消费记录（§2.2 末）→ 关联落点在 dsh 侧（attempts+sidecar），svc 侧用
  stateVersion/event 桥补齐；不需要 svc schema 变更。
- **G9（保留）** runtime.log 22.5 MB 无轮转、runtime-evidence.jsonl 无轮转——本 Goal 不扩容运行态，只对
  **查询所需关键证据**给最小保留方案（快照进隔离索引），全量日志治理记为后续候选（Goal §八）。

## 5. 访问边界矩阵（合法读取边界，脱敏与权限设计的依据）

| 数据 | uid 502 直读 | 产品入口 | 授权模型 |
|---|---|---|---|
| homes/** session journals | ✅ | agent_session_turn_inspect（own inter_agent，turn-bounded）；mobile 8789（Tailscale WhoIs+Binding） | Broker scope `agent.session.inspect_own_dispatch` |
| control/ ASM audit、attempts、turn-recovery | ❌（700 authsvc） | **仅 canonical runtime 进程内**（broker capability 天然具备） | 新 scope 待 spec 冻结 |
| scheduler jobs.json+history（canonical） | ❌ | HTTP 面不覆盖 canonical root（§1）；CLI 需 authsvc | `scheduler.read`(self)/`scheduler.audit`(global) 语义可复用 |
| svc 事实 | 经 broker 工具 | workflow_instance_detail/submission_history/domain_instances 等 + timeline（HTTP 直连需 JWT） | workflow.read + svc 可见性分级 |

## 6. 对 GOAL §一 七问的当前可答性

1) 来源与准入 —— svc activations/eligibility_events + attempts attempt_planned：**可答（组装即得）**。
2) 谁何时派给谁 —— ASM audit intent 行 + attempts delivery_started/run_delivered：**可答（受 G2 窗口限制）**。
3) 接收/消费/开始 —— 目标 session user 消息+turn/start（sidecar 或 messageId 定位）：**可答**；workflow_execution
   sidecar 现产无样本（G6）。
4) 执行了什么 —— session journal turn/tool call/result 投影：**可答**（现仅 turn_inspect 单轮受限视窗；
   全 session 视窗是查询层增量）。
5) 是否真提交 —— tool result workflowStateVersion → svc event/command receipt 桥：**可答（精确）**。
6) 等待/重试/跳过/失败/未知 —— scheduler history outcome/status_view/delivery_status + attempts 事件词表 +
   svc closures：**可答（组装即得）**。
7) 卡在哪 —— 以上串联+分维判定（§六 规则）：**查询层交付物本体**。

## 7. 结论（喂给 Spec 的最小增量清单）

A. 只读查询层（新建，不动写路径）：统一查询核心（六源装载器+关联解析器+报告器，源标注/边界/缺页可见）+
   broker 只读工具族入口（canonical runtime 内，天然满足访问矩阵）+ 隔离可重建索引。
B. 保留闭环（§五C）：隔离索引兼作 ASM audit 轮转窗口外 send↔turn join 的证据快照基底；保留政策成文
   （起点/周期/覆盖/淘汰），不建第二业务账本、不扩运行态。
C. 写路径修复（§五B，独立评审+授权发布，不包装成只读）：本期**仅核实的候选=G4**（turn-recovery durable 记录
   补 callerCorrelation/messageId 字段）；其余（scheduler run 持久 messageId 等）等真实样本验证后再立项。
D. 明确不做：新账本/新服务/新 Dashboard/授权语义变更/svc schema 变更/自动恢复语义触碰。
