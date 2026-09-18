---
spec_id: AGENT_CORE_EXECUTION_HISTORY_QUERY_V1
status: accepted
accepted_reviewed_head: 6bcb933 (round-2 ACCEPT; non-blocking nits absorbed in this acceptance commit)
review_record: round-1 REVISE/7 load-bearing gaps (jobs.json loader absent; reportId wall-clock self-contradiction; pagination undesigned; WPA-1 dedupe/ordering unspecified; R2 attemptId formula wrong for gen>1; svc-facts transport underspecified + receipts over-promise; single-tool dual-scope not an existing enforcement pattern) + messageId-namespace omission → all fixed in r2 6bcb933; round-2 mechanical re-verification ACCEPT/0 load-bearing (6 non-blocking nits absorbed here: pre-append trigger wording, checkpoint reset at rename, dedupe denial-row approximation, A1 events-bridge wording, R1-R9 ruleId stale ref, §7 reachability cross-ref)
spec_kind: spec
authority_level: implementation
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-18
authority_driver: EXECUTION_HISTORY_CORRELATION_AND_RECONCILIATION_V1 (Goal, Owner directive 2026-09-18)
scope:
  - packages/execution-history (NEW)
  - packages/broker/src/capabilities/execution-history.js (NEW)
  - packages/broker/src/index.js (manifest registration wiring only)
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

> **一句话**：在 canonical runtime 内新增只读 broker 工具族（`execution_trace_query` self 域 +
> `execution_history_audit_query` global 域，同一查询核心），把已有的六套执行记录
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
- G1 统一只读查询入口：broker 工具族（self+audit 两清单、同一核心），四种查询根
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
    asm-audit.js        # control/agent-session-messaging-audit.jsonl + .1 + archive（§6 后）；行级去重（§6）
    attempts-ledger.js  # workflow-execution/attempts.jsonl
    scheduler-history.js# scheduler/history/events.jsonl + runs-YYYYMM.json
    scheduler-store.js  # <root>/scheduler/jobs.json（只读、in-process）——job 级准入事实/从未 reserve 的
                        # occurrence/ownership 判定所需的 routing agent；history 事件只覆盖
                        # occurrence_reserved 之后，缺失本装载器则 Q1/Q7 对从未运行的 job 不可答
    runtime-evidence.js # control/runtime-evidence.jsonl（scheduler invocation 行）
    svc-facts.js        # 经注入的 svc 读接口：复用既有 per-caller credential seam（transportFor(agentId)）；
                        # instance detail / submissions 走既有 broker 读工具同路径；
                        # **timeline 是本能力内部的 NEW 直接 svc HTTP 调用**（GET
                        # /internal/v1/workflow-instances/{id}/timeline，after=event_sequence 游标——部署代
                        # f6a7400 契约面已有该端点，但今日无任何 broker 工具暴露它；本 Spec 不新增 broker
                        # 读工具，唯一新工具仍是 execution_trace_query 族，见 §4.2）；
                        # svc `workflow_command_receipts` 与 activation/closure 明细表 **无读端点**：
                        # 一律 SOURCE_ABSENT 显式标注（R4/§7），不伪造。
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
R2 visit↔attempt：以 append-only 账本 identity triple 扫描为 **权威 join**；attemptId 派生仅作 gen-1 优化：
`attemptId = 'wfeat-' + sha256(lowercase(nodeVisitId))[:24]`；generation N>1 材料 =
`lowercase(nodeVisitId) + '#gen' + N`（ledger.js 实装公式——R2 不得用裸 sha256(nodeVisitId) 覆盖 N>1）。
R3 attempt↔执行面：`run_delivered{requestId=attemptId, sessionId, messageId, reconciliationHandle}` →
session journal 定位 +（在轮转/归档窗口内）ASM audit 反查调用链。
R4 业务提交↔svc：session journal 的 `workflow_execute.*` tool call/result 直通 svc 响应 →
`workflowStateVersion ↔ workflow_events.event_sequence ↔ command_id` 事件桥（"是否真提交"的充分证据）。
`workflow_command_receipts` 无读端点 ⇒ ** receipts 关联显式 SOURCE_ABSENT**（不做 svc 写路径、FOLLOW_UP F6）。
R5 scheduler occurrence↔session：`session_id='cron-run-<occ>'` 命名 + runtime-evidence invocation 行
（sessionId/reconciliationHandle）辅助确认；命名匹配单独出现时标注 `JOIN_BY_NAME_CONVENTION`（弱键显式降级）。
R6 反向定位：root=message{messageId|reconciliationHandle|requestId} → session journal 全文 + ASM audit
（live/.1/archive）+ attempts run_delivered + turn-recovery-v3.json。turn-recovery durable 记录分类为
PRIMARY_PERSISTED 并附 **coverage-write + 结算后 unlink + 缺 callerCorrelation/messageId 字段（F1）** 三项 caveat。
R7 禁猜：时间接近、agent 名称相似、标题/正文语义 **不得** 作为关联依据；无法建立关联时输出
`CORRELATION_GAP{stage, knownFacts}`，不造链。
R8 correlation 不承担授权/幂等职责：授权仍由 broker scope + svc 可见性 + 文件访问边界决定；幂等仍由
Idempotency-Key/svc receipts 决定。
R9 ID 命名空间（native vs display）：查询坐标一律 **native** messageId（目标 DSH 在 session/prompt 回执铸造、
经 `agent/inbox/spliced` 事件与 ASM audit/reconciliationHandle 落盘的 ID）；mobile 面展示用 `msg_sh1_*`
公共 ID **不是** 查询根——携带 `msg_sh1_` 前缀的输入返回 `ID_NAMESPACE_MISMATCH`（422 族）并说明换算
不可行（公共 ID 是内容哈希，非可逆坐标）。scheduler run / router turnExecutionId / harness turn 序号
分属不同命名空间，timeline 中各自保留原生标识，不互相改写。

## 4. 查询面（broker 工具清单）

### 4.1 查询坐标与结果形状

**root 可见域（冻结）**：工具只看 **本 runtime root**（canonical 部署中=authsvc root）。GUI root、
scheduler-v2 root 的数据不在查询域内；跨 root 需求=非目标（记档）。

```jsonc
{
  "root": "workflow_instance | agent_session | scheduler_run | message",
  // root=workflow_instance: { workflowInstanceId, includeVisits?, includeSubmissions?, cursor?, limit? }
  // root=agent_session:    { agentId, sessionId, cursor?, limit? }
  // root=scheduler_run:    { jobId? , occurrenceId?, runId?, cursor?, limit? }  // 至少一个；jobId-only
                            // 命中从未运行的 job 时由 scheduler-store 装载器回答准入事实（§2）
  // root=message:          { messageId } | { reconciliationHandle } | { requestId }   // 全部 native 坐标（R9）
  "view": "structured | report",       // 同一核心，两种渲染；默认 structured
  "reportOptions": { "audience": "owner | agent" }   // report 视图用
}
```

结果（structured）固定顶层：
```jsonc
{
  // reportId 确定性：hash 输入 = root + args + **sourceGenerationToken**（各源 file size/mtime/行数快照）。
  // **wall-clock asOfUtc 不参与 hash**（否则同边界重复查询必得不同 ID，T4 不可满足）。
  // asOfUtc 记录在 readBoundary 体内供人读，不入 hash。
  "reportId": "ehq-<sha256(root+args+sourceGenerationToken)[:16]>",
  "queryRoot": {...}, "readBoundary": { "asOfUtc": ..., "sourceGenerationToken": {...},
                "sources": [{name, status: OK|DEGRADED{reason}|ABSENT, coverageUtc}] },
  "summary": { "fiveDimensions": { "schedulingAdmission": ..., "agentExecution": ...,
                "businessProgress": ..., "messageDelivery": ..., "evidenceIntegrity": ... } },
  "timeline": [ {order, nativeRefs, atUtc, provenanceClass, kind, brief} ],
  "correlations": [ {rule: "R1..R9", from, to, evidenceRefs} ],
  "gaps": [ {code: "CORRELATION_GAP|SOURCE_DEGRADED|SOURCE_ABSENT|TRUNCATED|RETENTION_LOSS_PRE_V1|JOIN_BY_NAME_CONVENTION", ...} ],
  "nextCursor": ...
}
```

**分页语义（冻结）**
- 边界冻结：首次查询确定 `sourceGenerationToken`；同 token 的后续页 **不重读源的新增数据**（新增数据
  属于新边界=新 reportId）。
- cursor=**向量游标** `{perSource: {sourceName: {file?, lastSeq|lastOffset}}}`；页窗口定义在 **合并序** 上：
  每源按其原生序（event_sequence/seq/visit_number）保持；跨源交错按 `(atUtc, sourceRank, nativeSeq)` 排序，
  该交错序显式标 `NON_AUTHORITY`（满足"不跨系统时钟推精确顺序"，同时给分页一个确定性全序）。
- 关联闭包（R1-R9）**每页都对冻结边界全量计算**（不随页窗裁剪）——闭包确定性由边界冻结保证，T4 可断言。
- timeline 单条目上限与总条目 caps 沿用 turn_inspect 量级（10k/8 MiB/1 MiB），超限=TRUNCATED 可见。

### 4.2 工具族与鉴权（机制如实对齐既有 gateway 能力）

- **两个 broker 工具，同一查询核心**（gateway `requiredScopes` 是 all-or-nothing 单请求检查，无 per-op
  scope、handler 亦无法探测"是否另持某 scope"——故不做单工具双 scope）：
  - `execution_trace_query`，`requiredScopes: ['execution.history.read']`——**self 域**：session root 必须
    `agentId == caller`；scheduler root 必须 job 的 routing agent == caller；workflow root 用 caller 自己的
    credential 过 svc 可见性；message root 所在 session 同 session 规则。
  - `execution_history_audit_query`，`requiredScopes: ['execution.history.audit']`——**global 域**：
    跨 agent/跨 job 查询；**内容投影仍受 §4.3 redaction 约束（audit ≠ 解密权）**。
  - caller 身份一律取 gateway 信任进程关系派生的 `context.agentId`，永不取模型参数（gateway.js 既有纪律）。
- 两 scope 为 **新增** auth-service grant（additive packet，部署前置项，走既有 Owner 授权流程）。
- svc 读取用 caller 自己的 credential seam（transportFor(agentId)）；timeline 为能力内部直接调用（§2）。

### 4.3 内容可见性与脱敏（§六"能看 Workflow ≠ 能看 Agent 私人历史"）

- 轨迹中的他者 session（经 R1/R3 关联进来、非 caller 所有的）：只含 **坐标与摘要**——messageId、turn 序号、
  时间、tool 名、状态码、错误码、**workflow 相关 tool call 的参数坐标字段**（workflowInstanceId/transitionId/
  stateVersion）与**结构性结果字段**（stateVersion、submission 坐标）；正文/完整参数/私有 tool 内容一律
  `redacted`。audit scope 持有人同样适用（audit ≠ 解密权）。
- 自有 session（agentId==caller）：turn-bounded 全内容（对齐 turn_inspect 既有 caps：10k 记录/8 MiB 文件/
  1 MiB 记录/1 MiB 响应；超限即 TRUNCATED 可见）。**显式声明**：这是相对 turn_inspect"own-dispatch 单轮"
  视窗的特权扩张（自有 session 全轮），依据=Goal §三要求独立 session 可完整还原；跨 agent 非目标不变。
- 隔离测试必须含越权投影断言（§9-T6）。

### 4.4 错误表（结构化，全部本地判定）

`invalid_arguments`（root/参数不合法）、`id_namespace_mismatch`(422，`msg_sh1_*` 等 display ID 入参，R9)、
`forbidden_not_owner`(403)、`workflow_instance_not_found`(404)、
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
  诊断均附 `ruleId`（R1-R9）与证据引用（nativeRefs）。

## 6. WRITE_PATH_AMENDMENT_1 — ASM 审计轮转归档（唯一写路径变更）

- 现状：`audit.js` 8 MiB 轮转 `renameSync(live, live+'.1')` 直接覆盖旧 `.1` ⇒ 两代之前内容物理丢弃 ⇒
  send↔turn join 随时间不可逆丢失（evidence §4-G2）。audit.js 今日 **无锁**（单进程同步 append），
  `readGeneration` 对单条坏行整代抛错（:157-186）。
- 修订语义（按序）：
  1. 轮转触发条件不变（pre-append 检查 `size + rowBytes > maxBytes`，audit.js:56-66 原语义）。
  2. 归档先于 rename：把 live 文件 **尚未归档的字节区间** `[archivedUpToBytes, size)` 追加到
     `control/agent-session-messaging-audit-archive.jsonl`，append+fsync；随后 **原子写 checkpoint**
     `…-archive.pos`（temp+rename：`{archivedUpToBytes}`）；最后 `renameSync(live, live+'.1')`，
     **rename 同时重置/代键化 checkpoint**（新 live 代从 0 起，旧代 offset 不得带入下一代——失败路径
     "归档失败但 rename 成功"后尤其可达，否则区间错位）。
  3. **崩溃窗口与幂等**：append 成功但 checkpoint 未落 → 下次轮转按 checkpoint 会重追加同一区间
     ⇒ archive 中可能出现重复行。接受该窗口（每次崩溃至多一代重复），由 **读取端行级去重** 兜底：
     asm-audit 装载器对 live+.1+archive 全部行按整行内容 hash 去重（行无原生 uuid）。**接受的近似**：
     同毫秒内两条全等 denial 行（appendDenial 无 requestId）会被合并少计一条——有界、与关联无关，
     接受。checkpoint 落盘先于 rename ⇒ rename 后内容必已入 archive（无丢失窗口）。
  4. 归档失败（append/fsync/ checkpoint 任一抛错）：轮转 **照常继续**（rename 照做，避免阻塞发送主路径），
     在 runtime-evidence 记 `ASM_ARCHIVE_APPEND_FAILED{bytesAttempted}`；丢失窗口=该代内容（下次成功后
     恢复）。归档是 best-effort 增强，绝不改变发送路径成败语义。
  5. 读端容错：archive 中单条坏行/截断行 → 跳过该行并计 `skippedLines`，源状态 `SOURCE_DEGRADED`，
     **不** 整代抛错（与 audit.js readGeneration 行为有意不同，仅用于历史查询路径）。
- 读面影响矩阵：`execution_trace_query`/`execution_history_audit_query` 读 live+.1+archive（去重后）；
  `agent_session_send_reconcile` **保持 live+.1 不变**（reconcile 语义零变化）；`agent_session_turn_inspect`
  不读审计归档。
- 保留政策：archive 文件不轮转不删除；>1 GiB 时由 FOLLOW_UP F4 另立政策（本期只报告体积）。
- 已知代价（如实记档）：归档为同步读+append，单次至多 ~8 MiB，会瞬时阻塞 runtime 事件循环；按当前发送
  量（8 MiB/多周）频率可接受。
- 治理交叉引用：本节 **amends** ASM V1 部署授权的"单代 .1 轮转"契约（R12 family）与 ASM V2 的
  "no archive index or retention promise"表述（该表述是"不承诺"而非"禁止"；修订经本 Spec 评审授权）。
- 评审要求：本节改动需独立 diff 评审（触发条件/区间计算/checkpoint 原子性/失败路径/去重正确性/
  reconcile 窗口不变性），作为 merge gate 的显式条目；**不得** 与查询核心拆成"只读"名义绕过评审。

## 7. 保留与覆盖（Goal §五C 交付）

| 证据 | 起点policy | 周期/淘汰 | 覆盖声明 |
|---|---|---|---|
| ASM audit（live/.1/archive） | V1 部署刻起 archive 全量累积 | 不淘汰（>1 GiB 另议） | V1 前已轮转丢失的行=`RETENTION_LOSS_PRE_V1` 永久缺口，如实报告，不补账 |
| session journals | 既状（append-only 无删除） | 无 | 全量可达 08-16 起 |
| attempts/history/events | 既状（append-only/永不截断） | 无 | 全量 |
| session-index（§8） | 首次查询/构建起 | 可随时删除重建 | 派生视图，非证据本体 |
| svc 事实 | 既状（不可变账本） | 无 | svc 自身账本全量；**查询可达性见 §2/R4**（receipts/activation/closure 无读端点=SOURCE_ABSENT） |

## 8. 隔离索引（rebuildable read view）

- 位置 `<root>/control/execution-history-index/sessions.idx.jsonl`：每 session 文件一行
  `{agentId, sessionId, projectKey, file, size, mtimeMs, messages: [{seq, messageId?, kind, sourceKeys?, workflowInstanceId?, occurrenceId?}]}`。
- 构建触发：查询时懒构建 + 按 (size,mtime) 失效重扫；并发安全（单 lock 文件）；**可整目录删除重建**，
  生产执行路径零依赖（§4.5 断言）。内容只含坐标键，不含正文 ⇒ 无新增隐私面。

## 9. 测试与验收

**隔离测试（fixtures=临时 root，零生产副作用）**
- T1 多 attempt/重入：同 visit 两次 attempt（stale_superseded 链）全保留且可分页重放；attemptId 按
  R2（gen1 派生 + genN `#genN` 材料）与 identity-triple 扫描双路一致。
- T2 回执丢失/未知：run_delivered 无 messageId + fence outcome_unknown → UNKNOWN_OUTCOME+证据行列出。
- T3 正常完成/明确失败/人工等待三态分维正确（assistance case 不误判失败）。
- T4 分页/重复采集/进程重启：向量 cursor 稳定；同 sourceGenerationToken 下重复查询 reportId 一致、
  跨页结果拼接=全量；关联闭包跨页不变；索引删后重建等价。
- T5 轮转/缺失/损坏/权限：audit archive 追加失败、archive 坏行（跳过+DEGRADED 计数）、session 文件截断、
  某源 0700、svc 503 → 全部可见降级，绝不输出"已查全"。
- T6 越权投影：非 owner 调他者 session root=403；audit 工具读他者 session 时正文=redacted 断言。
- T7 消费禁令：import 图断言（§4.5）。
- T8 WPA-1：archive-on-rotate 原子性/区间幂等（模拟 checkpoint 缺失重轮转→读端去重后无重复）/失败续行/
  reconcile 读窗不变（reconcile 结果在 archive 存在与否下一致）。
- T9 命名空间：`msg_sh1_*` 入参 → id_namespace_mismatch；native messageId 三源（ASM audit、
  inbox/spliced、session journal）互证。

**真实样本验收（§七；Phase A=部署前只读核实，Phase B=部署后经产品入口）**
- A1（Phase A）Workflow 链：真实 instance（当前已获准读取的 BIP/todo 域样本）——visit→attempt→session tool
  result→svc event（含 command_id）桥全链 + report（receipts 环节按 R4=SOURCE_ABSENT 显式标注）。
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
- F6 svc 读端点缺口：`workflow_command_receipts` 与 activation/closure 明细表无任何读 API
  （R4/§2 已按 SOURCE_ABSENT 处理）；若未来需要 command 级回执/receipt 关联，须 svc 侧独立立项。
