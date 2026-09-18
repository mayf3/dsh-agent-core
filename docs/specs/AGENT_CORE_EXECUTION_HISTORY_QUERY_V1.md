---
spec_id: AGENT_CORE_EXECUTION_HISTORY_QUERY_V1
status: proposed
spec_kind: spec
authority_level: implementation
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-18
authority_driver: EXECUTION_HISTORY_CORRELATION_AND_RECONCILIATION_V1 (Goal, Owner directive 2026-09-18)
scope:
  - packages/execution-history (NEW)
  - packages/broker/src/capabilities/execution-history.js (NEW)
  - packages/broker/src/capabilities/index.js (wiring only)
  - packages/production-runtime/src/compose.js (wiring only)
  - packages/production-runtime/src/agent-session/audit.js (WRITE_PATH_AMENDMENT_1: archive-on-rotate)
governed_by:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
  - MOBILE_SESSION_HISTORY_V1
  - SVC_WORKFLOW deployed lineage f6a7400 contract bundle 1.8.0
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_EXECUTION_HISTORY_QUERY_V1 — 执行历史统一只读查询与保留闭环

> **一句话**：在 canonical runtime 内新增只读 broker 工具 `execution_trace_query`，把已有的六套执行记录
> （ASM 发送审计、workflow 执行账本、scheduler 结构化历史、session journals、runtime 证据行、svc-workflow
> 事实面）组装为可分页、可回查证据、分维判定的执行轨迹；同时用一处最小写路径修订（ASM 审计轮转改为
> 归档而非丢弃）关闭 send↔turn join 的保留缺口。**不建第二业务账本，不改任何既有派发/授权/幂等语义。**

## 0. Preflight 锚点

- Evidence authority: `docs/investigations/EXECUTION_HISTORY_RECORD_CENSUS_AND_CORRELATION_GAPS_V1.md`（本文全部
  生产事实引用以该文 §1-§5 为准，不重复）。
- Governing boundaries reused（不改其冻结语义）：
  - ASM V2（CTR-ASM2-*）：`agent_session_send` / `agent_session_turn_inspect` / `agent_session_send_reconcile`
    行为与 reconcile 的 live+.1 读取窗口 **不变**；本 Spec 不新增 dispatch ID，messageId 仍是 exact-turn 锚。
  - SCHEDULER_RUN_HISTORY R9：`correlation_id/parent_run_id/request_id` 语义不变；J2（跨系统投递到 svc
    receipts）继续 **不做**——本 Spec 对 svc 的关联全部是 **读时组装**（stateVersion==event_sequence 桥），不写 svc。
  - MOBILE_SESSION_HISTORY：其"无 browsing"非目标是该 Spec 投影面的边界；本 Spec 的轨迹组装不提供全量
    session 浏览（见 §4 视窗规则），8789 面不动。
- WRITE_PATH_AMENDMENT_1 是本 Spec 唯一生产写路径变更，独立小节（§6）+ 独立评审项；其余全部只读。

## 1. 目标与非目标

**目标（冻结）**
- G1 统一只读查询入口：一个 broker 工具 `execution_trace_query`，四种查询根
  （workflow_instance / agent_session / scheduler_run / message），结构化 JSON 与人类可读报告同一核心。
- G2 保留闭环：ASM 审计轮转不再丢数据（归档追加）；关键证据保留起点/周期/覆盖成文（§7）。
- G3 证据可信：reportId、查询边界、源标注（PRIMARY_PERSISTED / LIVE_OBSERVATION / RECOVERY_SYNTHETIC）、
  分维判定、缺页/截断/读失败可见、§5 认知规则全部结构化落地。
- G4 隔离索引：session 反查索引（rebuildable），位于 runtime 私有 control 区；生产执行路径零依赖。

**非目标（冻结，违者 SPEC_COMPLIANCE=FAIL）**
- 不新建服务/账本/事件总线/图数据库/Dashboard；不改 svc schema；不改授权/幂等/未知结果语义；
- 不做自动重派/自动修复/解 fence；查询结果 **不得** 被任何派发、推进、恢复逻辑消费（§3.5）；
- 不提供跨 agent 私人 session 的全文浏览（视窗规则 §4.3）；不动 8789 mobile 面；
- 不做 scheduler run→messageId 的写路径补录（等真实样本核实后另立 amendment）；
- 不替换 HR 派发、不新建调度 Agent。

## 2. 新包 `packages/execution-history/`

只读查询核心。模块（全部纯函数 + 注入式文件访问，便于隔离测试）：

```
packages/execution-history/src/
  index.js              # 公共 API: queryExecutionTrace({root, ...}) -> TraceResult
  loaders/
    session-journal.js  # homes/**/session.jsonl 装载 + 事件解码（DSH v0 兼容 allowlist 同 session-history）
    asm-audit.js        # control/agent-session-messaging-audit.jsonl + .1 + archive（§6 后）
    attempts-ledger.js  # workflow-execution/attempts.jsonl
    scheduler-history.js# scheduler/history/events.jsonl + runs-YYYYMM.json
    runtime-evidence.js # control/runtime-evidence.jsonl（scheduler invocation 行）
    svc-facts.js        # 经注入的 svc 读接口（broker 复用现有 workflow read transport/credential seam）
  correlate.js          # 关联解析：root → 相邻记录闭包（§3 关联规则）
  rules.js              # §5 认知规则 → 判定引擎（分维 verdict）
  report.js             # TraceResult -> 结构化 JSON | 人类报告（同一中间模型）
  redact.js             # §4.3 内容可见性/脱敏
  session-index.js      # 隔离索引（§8）
```

- 所有装载器返回统一 `SourceRecord { source, kind, nativeId, nativeSeq, observedAtUtc, raw, provenanceClass }`，
  `provenanceClass ∈ {PRIMARY_PERSISTED, LIVE_OBSERVATION, RECOVERY_SYNTHETIC}`（Goal §六：三源分标）。
- 读失败策略：单源损坏/权限缺失/截断 → 该源标 `SOURCE_DEGRADED{reason}` 并继续其余源；**绝不**静默降级为
  "已查全"。缺文件=SOURCE_ABSENT（≠记录不存在）。

## 3. 关联规则（复用事实，不创造状态；全部为读时推导）

R1 发送↔消息：ASM audit 行 requestId ↔ 目标 session user 消息（`source.kind='inter_agent'` 且
`sourceAgentId` 匹配、`correlation` ↔ 调用侧 turnExecutionId/audit correlationHash），或 messageId 精确匹配。
R2 visit↔attempt：`attemptId='wfeat-'+sha256(nodeVisitId)[:24]` 确定性派生 + attempts identity triple 精确匹配。
R3 attempt↔执行面：`run_delivered{requestId=attemptId, sessionId, messageId, reconciliationHandle}` →
session journal 定位 +（在轮转/归档窗口内）ASM audit 反查调用链。
R4 业务提交↔svc：session journal 的 `workflow_execute.*` tool call/result 直通 svc 响应 →
`workflowStateVersion` ↔ `workflow_events.event_sequence` ↔ `command_id` ↔ `workflow_command_receipts`。
R5 scheduler occurrence↔session：`session_id='cron-run-<occ>'` 命名 + runtime-evidence invocation 行
（sessionId/reconciliationHandle）辅助确认；命名匹配单独出现时标注 `JOIN_BY_NAME_CONVENTION`（弱键显式降级）。
R6 反向定位：root=message{messageId|reconciliationHandle|requestId} → session journal 全文 + ASM audit
（live/.1/archive）+ attempts run_delivered + turn-recovery-v3.json（命中标注 LIVE_OBSERVATION，重启失效语义）。
R7 禁猜：时间接近、agent 名称相似、标题/正文语义 **不得** 作为关联依据；无法建立关联时输出
`CORRELATION_GAP{stage, knownFacts}`，不造链。
R8 correlation 不承担授权/幂等职责：授权仍由 broker scope + svc 可见性 + 文件访问边界决定；幂等仍由
Idempotency-Key/svc receipts 决定。

## 4. 查询面（broker 工具清单）

### 4.1 `execution_trace_query`（唯一新工具；scope：`execution.history.read`）

```jsonc
{
  "root": "workflow_instance | agent_session | scheduler_run | message",
  // root=workflow_instance: { workflowInstanceId, includeVisits?, includeSubmissions?, cursor?, limit? }
  // root=agent_session:    { agentId, sessionId, cursor?, limit? }
  // root=scheduler_run:    { jobId? , occurrenceId?, runId?, cursor?, limit? }  // 至少一个
  // root=message:          { messageId } | { reconciliationHandle } | { requestId }
  "view": "structured | report",       // 同一核心，两种渲染；默认 structured
  "reportOptions": { "audience": "owner | agent" }   // report 视图用
}
```

结果（structured）固定顶层：
```jsonc
{
  "reportId": "ehq-<sha256(root+args+readBoundary)[:16]>",   // 同查询+同边界可重复
  "queryRoot": {...}, "readBoundary": { "asOfUtc": ..., "sources": [{name, status: OK|DEGRADED{reason}|ABSENT, coverageUtc}] },
  "summary": { "fiveDimensions": { "schedulingAdmission": ..., "agentExecution": ...,
                "businessProgress": ..., "messageDelivery": ..., "evidenceIntegrity": ... } },
  "timeline": [ {order, nativeRefs, atUtc, provenanceClass, kind, brief} ],   // 原生序号保留；跨系统顺序仅 NON_AUTHORITY 参考
  "correlations": [ {rule: "R1..R8", from, to, evidenceRefs} ],
  "gaps": [ {code: "CORRELATION_GAP|SOURCE_DEGRADED|SOURCE_ABSENT|TRUNCATED|RETENTION_LOSS_PRE_V1", ...} ],
  "nextCursor": ...
}
```

### 4.2 鉴权与所有权（结构化规则，沿用既有模式）

- `execution.history.read`（self）+ `execution.history.audit`（global，运维/Owner 面）。
  两 scope 为 **新增** auth-service grant（additive packet，部署前置项，走既有 Owner 授权流程）。
- root=agent_session：`agentId == caller` 或持 audit scope，否则 `forbidden_not_owner`（403 族）。
- root=scheduler_run：job 的 routing agent == caller 或持 audit scope（对齐 scheduler.read 自限语义）。
- root=workflow_instance：caller 需能通过 svc 可见性（用 caller 自己的 credential 走既有 svc read transport；
  svc 侧裁决，查询层不复制授权逻辑）。
- root=message：messageId 所在 session 的所有权规则同 agent_session。
- caller 身份一律取 gateway 实际进程身份，永不取模型参数（既有 broker 纪律）。

### 4.3 内容可见性与脱敏（§六"能看 Workflow ≠ 能看 Agent 私人历史"）

- 轨迹中的他者 session（经 R1/R3 关联进来、非 caller 所有的）：只含 **坐标与摘要**——messageId、turn 序号、
  时间、tool 名、状态码、错误码、**workflow 相关 tool call 的参数坐标字段**（workflowInstanceId/transitionId/
  stateVersion）与**结构性结果字段**（stateVersion、submission 坐标）；正文/完整参数/私有 tool 内容一律
  `redacted`。audit scope 持有人同样适用（audit ≠ 解密权）。
- 自有 session（agentId==caller）：turn-bounded 全内容（对齐 turn_inspect 既有 caps：10k 记录/8 MiB 文件/
  1 MiB 记录/1 MiB 响应；超限即 TRUNCATED 可见）。
- 隔离测试必须含越权投影断言（§9-T6）。

### 4.4 错误表（结构化，全部本地判定）

`invalid_arguments`（root/参数不合法）、`forbidden_not_owner`(403)、`workflow_instance_not_found`(404)、
`session_not_found`(404)、`scheduler_record_not_found`(404)、`message_not_found`(404)、
`downstream_unavailable`(503，svc 不可达时降级为仅本地面+GAP 注记，不硬失败)、`history_unavailable`(503，
全部源 ABSENT/DEGRADED 时)。

### 4.5 消费禁令

查询核心 **只被** broker 工具调用。scheduler/dispatcher/workflow engine/notification-ingress **禁止** import
本包（结构测试断言 import 图；Goal §四"统一查询层只是可重建的读取视图"的机械化表达）。

## 5. 判定规则（rules.js 冻结语义；全部来自 Goal §六）

- `NO_RECORD_FOUND ≠ EVENT_DID_NOT_HAPPEN`：报 `SOURCE_ABSENT/RETENTION_LOSS_PRE_V1`，verdict=`UNKNOWN`。
- `ACCEPTED ≠ STARTED ≠ BUSINESS_DONE`：accepted（ASM/ATTEMPT delivery 面）、started（目标 turn/start）、
  business committed（svc event/command receipt）三态分开。
- `OUTCOME_UNKNOWN ≠ NO_SIDE_EFFECTS`：fence/unknown 输出 `UNKNOWN_OUTCOME{observableEvidence[]}`。
- 超时无 transition **永不**自动授权重派（查询层根本不产生授权输出）。
- 人工等待（assistance OWNER_PENDING/HUMAN_REQUIRED）、未到期（next_eligible_at 未至）、合法跳过
  （closure_reason/eligibility cause）判定为 `LEGAL_WAIT/SKIPPED`，非失败。
- 时间展示一律 UTC ISO-8601，同时保留原生序号（event_sequence/seq/visit_number）；跨系统时钟只给
  `NON_AUTHORITY` 参考序，不参与精确因果断言。
- report 视图五维分离输出：调度/准入、Agent 执行、业务推进、消息/结果投递、证据完整性；
  诊断均附 `ruleId`（R1-R8/S1-S8）与证据引用（nativeRefs）。

## 6. WRITE_PATH_AMENDMENT_1 — ASM 审计轮转归档（唯一写路径变更）

- 现状：`audit.js` 8 MiB 轮转仅保留 live+.1 两代，更早内容 **物理丢弃** ⇒ send↔turn join 随时间不可逆丢失
  （evidence §4-G2）。
- 修订：轮转时将当前代内容 **追加** 至 `control/agent-session-messaging-audit-archive.jsonl`（append-only，
  原子 append + fsync；失败则轮转照旧发生并在 runtime-evidence 记 `ASM_ARCHIVE_APPEND_FAILED`——归档是
  best-effort 增强，绝不阻塞发送主路径）。
- 读面影响：`execution_trace_query` 读 live+.1+archive；`agent_session_send_reconcile` **保持 live+.1 不变**
  （reconcile 语义零变化）；`agent_session_turn_inspect` 不读审计归档。
- 保留政策：archive 文件不轮转不删除；>1 GiB 时由 FOLLOW_UP 另立政策（本期只报告体积）。
- 评审要求：本节改动需独立 diff 评审（旋转原子性、append 失败路径、并发 append 与既有锁语义），
  作为 merge gate 的显式条目；**不得** 与查询核心拆成"只读"名义绕过评审。

## 7. 保留与覆盖（Goal §五C 交付）

| 证据 | 起点policy | 周期/淘汰 | 覆盖声明 |
|---|---|---|---|
| ASM audit（live/.1/archive） | V1 部署刻起 archive 全量累积 | 不淘汰（>1 GiB 另议） | V1 前已轮转丢失的行=`RETENTION_LOSS_PRE_V1` 永久缺口，如实报告，不补账 |
| session journals | 既状（append-only 无删除） | 无 | 全量可达 08-16 起 |
| attempts/history/events | 既状（append-only/永不截断） | 无 | 全量 |
| session-index（§8） | 首次查询/构建起 | 可随时删除重建 | 派生视图，非证据本体 |
| svc 事实 | 既状（不可变账本） | 无 | 全量 |

## 8. 隔离索引（rebuildable read view）

- 位置 `<root>/control/execution-history-index/sessions.idx.jsonl`：每 session 文件一行
  `{agentId, sessionId, projectKey, file, size, mtimeMs, messages: [{seq, messageId?, kind, sourceKeys?, workflowInstanceId?, occurrenceId?}]}`。
- 构建触发：查询时懒构建 + 按 (size,mtime) 失效重扫；并发安全（单 lock 文件）；**可整目录删除重建**，
  生产执行路径零依赖（§4.5 断言）。内容只含坐标键，不含正文 ⇒ 无新增隐私面。

## 9. 测试与验收

**隔离测试（fixtures=临时 root，零生产副作用）**
- T1 多 attempt/重入：同 visit 两次 attempt（stale_superseded 链）全保留且可分页重放。
- T2 回执丢失/未知：run_delivered 无 messageId + fence outcome_unknown → UNKNOWN_OUTCOME+证据行列出。
- T3 正常完成/明确失败/人工等待三态分维正确（assistance case 不误判失败）。
- T4 分页/重复采集/进程重启：cursor 稳定、重复查询 reportId 一致（边界相同）、索引删后重建等价。
- T5 轮转/缺失/损坏/权限：audit archive 追加失败、session 文件截断、某源 0700、svc 503 → 全部可见降级，
  绝不输出"已查全"。
- T6 越权投影：非 owner 调他者 session root=403；audit scope 读他者 session 时正文=redacted 断言。
- T7 消费禁令：import 图断言（§4.5）。
- T8 WPA-1：archive-on-rotate 原子性/失败续行/reconcile 读窗不变。

**真实样本验收（§七；Phase A=部署前只读核实，Phase B=部署后经产品入口）**
- A1（Phase A）Workflow 链：真实 instance（当前已获准读取的 BIP/todo 域样本）——visit→attempt→session tool
  result→svc event/command receipt 全链 + report。
- A2（Phase A）Scheduler 链：HR `b115cb96` 历史 occurrence（含 fence/unknown 证据）+ `cron-run-*` session
  对齐（经既有授权读取路径；canonical store 不可读时按访问矩阵降级并如实标注）。
- A3（Phase A）A2A 发送：FLEET-E2E 真实样本（content-ops session inter_agent 落盘）——来源调用↔目标消息
  精确配对，同父 turn 多任务不混淆。
- A4（Phase A）独立 session：非 workflow 的真实 session（如 stock/needs-radar）独立还原输入/执行/结果。
- B1-B4（Phase B，部署后）：以上四链改经 `execution_trace_query` 产品入口重放（Owner 或获权 agent 实调）。
- 验收铁律：每条关键结论附证据引用；证据不足必须显式 UNKNOWN；不为验收制造生产副作用、不开新派发模式。

## 10. 部署与授权

- 部署前置：① auth-service additive grant packet（两新 scope）；② PRODUCTION_DEPLOY_QUEUE 排队
  （serialize mutation；本 Spec 实现合入 main 与生产 apply 分记）；③ 部署后 Phase B 验收。
- 回滚：纯 additive 工具+WPA-1 可独立回退（archive 文件保留不删）。

## 11. FOLLOW_UP_DEBT（不阻塞本期）

- F1 turn-recovery-v3 durable 记录补 callerCorrelation/messageId（等真实重启场景核实后立项）。
- F2 scheduler run 持久 messageId/turnExecutionId 写路径（R9-J3 强化）。
- F3 mobile 8789 投影 provenance 暴露（独立产品决策）。
- F4 archive >1 GiB 保留政策；F5 runtime.log 轮转治理。
