---
spec_id: AGENT_CORE_SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1
status: accepted
accepted_reviewed_head: 822477ab (round-2 exact-head re-audit ACCEPT / SHIP_BLOCKERS=NONE / load_bearing_gaps=0)
review_record: round-1 (independent reviewer, 41688795) REVISE / 1 load-bearing SPEC_GAP (CTR-SCT-005 jobId premise false — request object lacks jobId; occurrence.js outside scope) + 1 SPEC_GAP (origins.user not derivable from existing index keys) + 4 NOTE/FOLLOW_UP (R5 wording, canary invoker known-limitation, census citations history.js:89→history/history-model.js:88 + runtime-evidence 3-key reality, §11 typo); frozen_blocker_union=0 BLOCKER; all fixed in r2 822477ab; round-2 mechanical re-verification of G1-G6 against diff = ACCEPT, no new blocker in changed text (V4 CTR-MUT-001 frozen semantics untouched; loader additions read-side only)
implementation_review: implementation r1 (8070b670) independent contract-by-contract review round-1 = REVISE / frozen_blocker_union=[1 BLOCKER: CONCRETE_REGRESSION/CONTRACT_VIOLATION — scheduler-root pending-gap flush bounded by the newest-10 sweep silently dropped the session gap in rotated-occurrence/ledger-absent/over-window worlds] + 2 SPEC_GAP (real ~003A segment encoding made anomalies.idMismatch always-on for healthy scheduler sessions; CTR-SCT-003 outcome_unknown annotations not surfaced) + notes. Repair pass r2 (c85d5ff3): unbounded post-sweep gap flush + sweep-bound wording; decodeSegment before id-mismatch/coordinate derivation; terminationSettled surfaced on both projection faces (CTR-SCT-004 tail completed); exact-args rejection in listHandle; per-list truncation flags; fixtures moved to the real segment encoding; discriminating blocker regression test added. Round-2 exact-head re-audit at c85d5ff3 = ACCEPT / SHIP_BLOCKERS=NONE / load_bearing_gaps=0 (B1 closed with world-a/world-b probes incl. 12/12 over-window gaps; B2 verified on real production homes, idMismatch 2→0; no new blockers; failing-suite delta zero diff-caused; verify:structure violations confirmed base-identical pre-existing state — commit-message gate claim in c85d5ff3 corrected here).
round3_correction: GitHub Codex fresh review @ repaired head 70bc04d0 (2026-09-24) surfaced four further findings, closed in the same stacked implementation lane: D1 exact scheduler joins must expose the NATIVE (decoded) session id in nativeRef/evidenceRefs — the physical directory encoding is not a SessionRef; D2 the job-level run_record projection covers EVERY job-matching run record (the newest-50 ledger slice must not strand older runs without a session answer); D3 the fleet index inventory check shares the builder's file cap (over-cap fleets retain the cache with an honest overCap flag instead of rebuilding every query); D4 occurrence coordinate keys match the real id shape (occ:+16 hex) so quoted fake ids in message text never become listing coordinates (the authoritative join face remains the canonical cron-run-<occ> identity).
post_landing_correction: PREVIOUS_REAUDIT_INCOMPLETE=YES. NEW_EVIDENCE_SOURCE = GitHub Codex fresh review @ PR #318 exact head d715869e (2026-09-24). Fresh findings supersede the internal SHIP_BLOCKERS=NONE: G1 REPOSITORY_INVARIANT_VIOLATION/REQUIRED_GATE_FAILURE — the accepted authorizing Spec did not exist in the implementation base 2a85d065 (docs-first violated; candidate self-acceptance cannot self-authorize); B1 byCronOccurrence suffix fallback promoted a foreign/suffix-compatible journal to DERIVED_EXACT (e.g. agt_evil/unrelated-<occBody>); B2 ensureFreshSessionIndex was blind to journals CREATED after index build; B3 packages/broker/test children 21 to 22 broke the directory ceiling (prior base-identical claim was wrong — the delta was in this directory); F1 trusted list handler silently clamped/dropped invalid direct parent-RPC pagination. Closure (PR_318_MERGE_BLOCKER_CLOSURE): docs-only authority lane (this branch: census + spec at final reviewed state) lands first; implementation branch reconstructed stacked on it (base contains the accepted Spec); B1 exact canonical identity (decoded sessionId === cron-run-<occ>) + owner-agent match from occurrence/job/run_record; B2 bounded journal-inventory discovery in ensureFreshSessionIndex; B3 test moved to test/capabilities/; F1 authoritative fail-closed validation matrix. History is appended, never rewritten.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-24
authority_driver: SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 (Goal, Owner directive 2026-09-24)
scope:
  - packages/execution-history (session listing core + scheduler-root disposition/join semantics)
  - packages/broker/src/capabilities/execution-history.js (agent_session_list manifest only)
  - packages/broker/src/index.js (manifest registration wiring only)
  - packages/production-runtime/src/execution-history/runtime.js (handler wiring only)
  - packages/scheduler/src/self-service/projections.js (occurrence projection enrichment only)
  - packages/scheduler/src/occurrence.js (invokeWithDeadline request: additive jobId field only)
  - packages/production-runtime/src/scheduler-invoker.js (invocation evidence row additive fields)
  - packages/production-runtime/src/compose.js (wiring only)
  - packages/production-runtime/src/workflow-execution-runtime.js (deliver receipt messageId plumb)
  - packages/workflow-execution/src/engine.js (run_delivered messageId field pass-through only)
  - packages/execution-history/src/session-index.js + src/loaders/session-journal.js (extractor keys: user-origin + occurrenceIds [occ:+16hex]; decodeSegment; byCronOccurrence exact canonical identity; ensureFreshSessionIndex bounded journal-inventory discovery + shared builder cap with overCap retention — B2/D3 closures, round-2/3 corrections)
  - packages/execution-history/src/session-listing.js (NEW: caller-subtree direct-scan listing core — C1/C2 closure, never builds/reads the fleet index)
  - packages/execution-history/src/loaders/runtime-evidence.js (additive runId coordinate key parse only)
  - packages/execution-history/src/loaders/scheduler-store.js (additive fences exposure only)
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_EXECUTION_HISTORY_QUERY_V1
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V2
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - AGENT_WORKSPACE_SESSION_MODEL_V3
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 — Session 为锚的执行追溯：自查询面、调度链会话暴露与诚实 no-session 处置

> **一句话**：把 `(agentId, sessionId)` 确立为所有真实 Agent 执行的统一追溯锚——新增 self 零 Auth 的
> `agent_session_list`（MY_SESSIONS，坐标-only 派生视图，不建第二 registry）；scheduler self `runs`
> 投影暴露 `sessionId` + 诚实 `sessionCreated` 处置（含 `SESSION_CREATED=NO{persisted reason}`）；
> runtime-evidence invocation 行补齐既有 invocation 对象已持有的 occurrence/run/job/request 坐标；
> execution-history scheduler-root 按 journal 存在性给出精确/诚实降级的会话关联；workflow 生产
> `run_delivered` 填充契约内既有 `messageId` 字段。**不建第二业务账本，不改任何既有 stable ID 的
> 语义，查询结果继续禁止被派发/恢复逻辑消费。**

## 0. Preflight 锚点

- Evidence authority: `docs/investigations/SESSION_CENTRIC_EXECUTION_TRACEABILITY_CENSUS_V1.md`
  （本文全部现状/缺口引用以该文 §0-§4 为准，编号 K1-K5）；上游底账
  `EXECUTION_HISTORY_RECORD_CENSUS_AND_CORRELATION_GAPS_V1.md`（2026-09-18）继续有效。
- Governing boundaries reused（不改其冻结语义）：
  - **EXECUTION_HISTORY_QUERY_V1**：四根查询、R1-R9 关联规则、§4.3 可见性/redaction、§4.5 消费禁令、
    §8 隔离索引、WPA-1 归档——R1-R4/R6-R9 原样 REUSE；R5 按 D-SCT-5 做严格加法精化
    （journal 存在性证明使"命名匹配单独出现"的弱键触发条件不再可达；`JOIN_BY_NAME_CONVENTION`
    标签词表保留用于无证明残态）；其余为查询语义加法细化（K4/K5），
    不触碰其冻结非目标（仍不做 scheduler run→messageId 写路径补录=F2，仍不做跨 agent 全文浏览）。
  - **ASM V2（CTR-ASM2-*）**：send 行为、结果字段集、reconcile live+.1 读窗、无 dispatch ID 铸造
    ——零变化。send 链的 exact 双 Session 证据 = 既有 ASM audit（live+.1+archive）+ 同步回执，
    本文不新增 send 写路径。
  - **SCHEDULER_RUN_HISTORY_V1 R2**：RunRecord 字段集**冻结，本文不加字段**（R9 correlation 语义不变）。
  - **SELF_SERVICE_SCHEDULER_TOOLS_V4 CTR-RESULT-002**：self `runs` 零 Auth、投影字段清单为
    inclusive（"including occurrence ID, run ID, state, execution outcome, delivery status, and
    relevant fence/late-settlement projection"）——本文的投影加法（CTR-SCT-004）是对该 inclusive
    清单的细化，不改变任何既有字段语义、不改变 Auth 模型。
  - **SCHEDULER_OCCURRENCE_OUTCOME_V3**：`DURABLE_EXECUTION_STATES`、`terminalEvidence.kind`、
    `terminationSettlement`、fence 语义全部原样复用；`nativeSessionId (after known; evidence, not
    product authority)` 的 evidence 定位正是 CTR-SCT-004 处置映射的依据。
  - **WORKFLOW_AGENT_EXECUTION_V2**：`run_delivered {agentId, requestId, sessionId,
    reconciliationHandle?, messageId?}` 契约本就含 `messageId?`（ledger-events 事件词表）——
    CTR-SCT-006 是该既有可选字段的生产 seam 填充，属实现缺口修复，非契约变更。
  - **AGENT_WORKSPACE_SESSION_MODEL_V3（D-008）**：SessionRef=(agentId, sessionId)、trajectory-only、
    `main` 逻辑槽、taxonomy——原样复用；listing/GC 的实现细节 D-008 §29 明示留给 implementation
    spec，本文即该实现授权之一（仅 read-only listing，不做 GC/archive）。
- 本 Spec 与既有 authority 的关系声明：**REUSE 为主体 + 五处严格加法（K1-K5）；无 SUPERSEDE；
  无对任何既有 stable ID 的收窄/改义。** 若独立评审认定 CTR-SCT-004 的 inclusive-list 读法
  不成立，则该条降级为对 V4 的 §14.2 型 AMEND 记录，不改变其余条款。

## 1. 目标与非目标

**目标（冻结）**
- G1 SC-1/SC-2 不变量机械化（§2）：任何真实进入 Agent Run/Turn 的执行可机械落位
  SessionRef；未入 Session 的执行返回诚实 no-session 处置；SessionRef 双向可溯。
- G2 `agent_session_list`（MY_SESSIONS）：self 零 Auth、trusted identity、坐标-only 派生视图。
- G3 scheduler self `runs` 暴露 sessionId + sessionCreated 处置；pre-session 失败可解释
  （沿用既有 taxonomy，不发明新状态）。
- G4 invocation 证据行坐标补齐 → scheduler↔session 关联升级为确定性派生 + 存在性证明；
  无存在性证明时诚实 GAP，绝不以命名约定冒充 exact。
- G5 workflow `run_delivered.messageId` 生产填充；业务提交证据继续走 R4 桥 + SOURCE_ABSENT 诚实缺口。

**非目标（冻结，违者 SPEC_COMPLIANCE=FAIL）**
- 不新建 Session Registry / Session Ledger / Execution Graph / Event Bus / 第二套任何业务历史；
- 不改 RunRecord 冻结字段集、不改 occurrence schema、不改 svc schema；
- 不改 ASM send/reconcile/turn_inspect 语义与结果字段集；不铸造新 dispatch ID；
- 查询/listing 结果不得被 scheduler/dispatcher/workflow engine/notification-ingress/recovery 消费
  （EXECUTION_HISTORY_QUERY_V1 §4.5 消费禁令全文适用并扩展到 CTR-SCT-002 的输出）；
- 不做跨 agent session 枚举或全文浏览；mobile 8789 面不动；
- 不做 F1（turn-recovery MANDATORY 字段扩集）、F2（RunRecord 加 messageId/turnExecutionId）、
  渠道 trigger 坐标持久化——全部记 FOLLOW_UP（§9），本期如实保持 ABSENT；
- 无 production mutation / deploy / grant 发放（`execution.history.read/audit` grant packet 仍是
  EXECUTION_HISTORY_QUERY_V1 §10 既有部署前置项，见 §8）。

## 2. 冻结不变量（Goal §三 SC-1/SC-2 的规范形态）

**SC-1 Actual Agent execution must have SessionRef**
任何真正进入 DSH Agent Run/Turn 的执行，必须存在 durable `(agentId, sessionId)` 坐标——
由既有持久化承载（scheduler `nativeSessionId`+invocation 证据、workflow `run_delivered.sessionId`、
ASM audit outcome 行、session journal 本体），本文不新增账本，只要求各读面能机械重组它。
执行在 Session 创建前失败时（admission rejected / invalid target / pre-start rejection /
resolution_blocked / legal skip），**任何读面不得输出该执行的 sessionId**（不得以派生命名冒充已存在），
必须输出：

```text
SESSION_CREATED = NO
REASON = <exact persisted reason，取自既有 taxonomy>
```

scheduler 域合法 reason 词表 = 既有 authority 冻结值：
`pre-start-rejection`（occurrence terminalEvidence.kind）与 pre-reserve 槽位分类
`ADMISSION_REJECTED | ADMISSION_INTERRUPTED | SKIPPED_POLICY | MISSED_BEFORE_OCCURRENCE | ENGINE_HALTED | DETECTION_INTERRUPTED`
（`self_ops.job_disposition` 既有词表）；workflow 域 = `resolution_blocked{code}` / `delivery_failed{reason}`；
ASM 域 = 既有 15 码错误表（denial/failed 行）。executionOutcome 不明时输出
`SESSION_CREATED = UNKNOWN`（+fence 状态），不猜。
**按链路的责任面（S2 closure）**：显式 `sessionCreated` 处置投影授权在 scheduler 读面
（CTR-SCT-003/004/007）。workflow 与 ASM 链的等价不伪造保证由既有契约承载：workflow 的
`resolution_blocked{code}`/`delivery_failed{reason}` 是持久处置且无 `run_delivered` 即无任何
SessionRef 输出；ASM 的 denial/failed 行不携带 sessionId，proven receipt 之前无坐标输出——
两者即 SC-1 在其链路上的形态，不要求新增字面 `SESSION_CREATED=NO` 投影。

**SC-2 SessionRef must be bidirectionally traceable**
从 `(agentId, sessionId)` 必须能反查 trigger/source（scheduler 坐标 / workflow 坐标 / send 坐标 /
user 消息）、关联 request/correlation、消息与 turn、关键 tool 调用、业务提交证据或显式
`SOURCE_ABSENT`；反向（job/occurrence/run、attempt、requestId、messageId、turn）在证据充分时
必须定位到 exact SessionRef。关联强度分级（冻结）：

```text
EXACT            persisted 坐标直连（messageId、requestId、identity triple、audit 行）
DERIVED_EXACT    确定性函数派生 + 存在性证明（cron-run-<occ> 命名 + journal/turn 证据存在）
WEAK_JOIN        仅命名约定/无存在性证明 —— 必须显式标注，不得记为成功关联
ABSENT           无 durable 证据 —— GAP/SOURCE_ABSENT，如实输出
```

时间接近、名称相似、标题/正文语义、模型自述永远不构成关联依据（R7 禁猜全文适用）。

## 3. Decisions

- **D-SCT-1（trusted self identity）**：`agent_session_list` 的 agentId 一律取 gateway 信任进程关系
  派生的 `context.agentId`，永不取模型参数；工具不接受任何身份入参。既有
  `execution_trace_query` root=agent_session 的显式 `{agentId, sessionId}` 入参**保持兼容不变**
  （自校验 `agentId == caller`，GOAL §四"不私自破坏 accepted API"）。
- **D-SCT-2（零 Auth self 面）**：`agent_session_list` 走 scheduler self-service 同款零 Auth 模式
  （V4 CTR-AUTH-002 先例：ordinary self operations MUST perform zero token requests）；
  跨 agent 枚举面不存在（无入参即无从越权）。
- **D-SCT-3（listing = 派生视图；round-3 修订，B-A closure）**：listing 数据 100% 派生自
  **caller 子树直扫**（journal 文件枚举 + header + 有界坐标抽取，见 CTR-SCT-002 数据源纪律）；
  与全局 session-index 完全解耦——listing 不构建、不读取、不刷新 fleet 索引（fleet 索引仅供
  既有查询根使用）。不新增任何持久存储。
- **D-SCT-4（不发明新状态）**：sessionCreated 处置词表 = `{created, not_created, pending, unknown}`，
  reason 一律取既有 taxonomy 原值（SC-1 词表），不做同义改写。
- **D-SCT-5（关联定级以存在性证明为准）**：`cron-run-<occ>` 命名仅是确定性派生函数；只有 journal
  / turn 证据实际存在才可定级 `DERIVED_EXACT`；命名+无证据 = `WEAK_JOIN` 显式缺口
  （此为对既有 `JOIN_BY_NAME_CONVENTION` 行为的精化：从"一律弱键"改为"有存在性证明即精确、
  无证明即诚实缺口"）。

## 4. Contracts

### CTR-SCT-001 — SessionRef 身份与碰撞

一切本 Spec 读面的 session 键 = `(agentId, sessionId)` 二元组；裸 sessionId 不作全局键。
不同 Agent 的同名 session（如双 `main`、同 `cron-run-<occ>` 不可能跨 agent 碰撞但 `main` 必然碰撞）
必须作为不同实体返回/查询，任何 join 不得仅凭 sessionId 跨 agent 连边。
验证：§6-T1。

### CTR-SCT-002 — `agent_session_list` 工具（MY_SESSIONS）

- 注册：`packages/broker` capability 族 `execution-history` 新 manifest；
  `requiredScopes: []`（零 Auth）；`local: {resource: 'execution-history'}`；模型可见（非 infrastructure）。
- 入参（round-3 修订，A1 closure）：Broker `buildToolDefinition` 恒注入 required selector
  （默认键名 `operation`）并据此 dispatch——零键调用无法选中 handler。故合法调用 =
  `{operation:'list', cursor?, limit?}`（selector 由 dispatch 剥离，trusted handler 仅见
  cursor/limit）；selector 之外的业务键封闭集 = `{cursor, limit}`，任何其他键 →
  `invalid_arguments`。`cursor` 必须是与 `nextCursor` 相同的
  validated tuple 格式——base64url 编码的 `<有限毫秒时间戳>:<sessionId>`（输入与输出同一格式，
  round-3 修订，B-C），或省略；`limit` 为 1..200 整数或省略；两者均不 clamp、不静默丢弃。
- 身份：`viewer.agentId = trustedContext.agentId`；缺失/非法 → `forbidden_not_owner`（fail closed）。
- 输出（坐标-only，固定字段集）：

```jsonc
{
  "agentId": "<caller>",
  "sessions": [ {
    "sessionId": "...",                  // 目录名经 DSH 段编码解码（见上）；header id 权威（不一致才标 anomaly）
    "kind": "main | scheduler | other",  // 'main' 精确；'cron-run-' 前缀 → scheduler；其余 → other（不冒认 D-008 未核实前缀）
    "createdAtUtc": "...",               // header.createdAt（PERSISTED_EXACT；header 缺失 → null + anomaly 计数）
    "lastActiveAtUtc": "...",            // journal mtime（DERIVED_EXACT）
    "origins": {                         // 来自 session-index 坐标键（不读正文）
      "user": true|false,
      "inter_agent": true|false,
      "workflow_execution": true|false
    },
    "schedulerOccurrenceIds": ["occ:..."],        // ≤10，超限 schedulerOccurrenceIdsTruncated=true
    "schedulerOccurrenceIdsTruncated": true|false,
    "workflowInstanceIds":  ["..."],              // ≤10，超限 workflowInstanceIdsTruncated=true
    "workflowInstanceIdsTruncated": true|false
  } ],
  "truncated": false,
  "nextCursor": null,                    // keyset 游标 = base64url("<lastActiveAtMs>:<sessionId>")
                                         // —— 时间与 sessionId 两个分量都编码在内（round-3 修订，A4），
                                         // 同毫秒并列时消费方按 sessionId 分量继续，绝不重复/跳过行
  "anomalies": { "headersMissing": 0, "idMismatch": 0 }   // 诚实计数，不静默
}
```

- 排序：`lastActiveAtUtc` 倒序、同刻按 `sessionId` 字典序；单响应上限 200 条，超限
  `truncated:true` + `nextCursor`（keyset 续读，全序确定）。
- sessionId 规范化：目录名按 DSH 段编码（canonical encoder =
  `packages/session-history/src/dsh-compat.js encodeSegment`，`:` → `~003A` 等 `~XXXX` hex 形式）
  **解码后**参与 header-id 比较与一切坐标派生；健康编码对永不计入 anomaly；仅解码后仍与 header id
  不一致才计 `idMismatch` 并以 header id 为准（既有解析规则）。
- 数据源纪律（round-2 修订，C1/C2 closure）：**caller 子树直读**——枚举并只读
  `homes/<callerAgentId>/sessions/**`（readdir+stat + header ≤4KiB + 每文件有界坐标扫描）。
  **绝不构建、读取或刷新全局 fleet 坐标索引**（构建它需要读其他 Agent 的 journal 内容 =
  caller 可触发的跨 Agent 扫描，违反本契约边界；其 fleet 级文件上限也会截断 caller 自己的
  完整列表）。`origins`/坐标键由**结构化 journal 解析**
  （loadSessionJournal + projectJournal 的已识别事件字段：message provenance source、
  toolCallCoordinates、workflowCoordinates）在 caller 子树内直接产出——**不接受对序列化字节的
  raw-text regex 匹配作为 listing 输出依据**（E2 closure：消息正文引用坐标字符串不得污染
  追溯视图），best-effort、缺失记 false/空且不报错。
  列表因此天然发现新建 journal（无索引 staleness），且不受任何 fleet cap 截断。
  **聚合预算（S3 closure）**：扫描分两相——phase 1 仅 stat 级（readdir/lstat/realpath：confinement、
  keyset 过滤、排序），phase 2（header + 结构化坐标扫描）只对进入当前页的行执行；单请求的内容
  读取量与响应行数成正比（≤ limit 个文件），对大会话集重复调用的总成本有界且由 keyset 续读均摊。
- **Confined reader（round-3 修订，A3 closure；B-B 再收紧）**：caller 子树内的每一个 journal
  文件在读取前必须通过 confinement 预检——**canonical-root binding**：解析全部路径成分（含
  中间目录 symlink）后的真实路径必须仍位于 `homes/<callerAgentId>/sessions/` 之内（把祖先目录
  换成指向其他 Agent 目录的 symlink 会因前缀绑定失败而跳过）；`lstat` 必须为普通文件
  （symbolic link 一律拒绝）、`nlink === 1`（hardlink 一律拒绝）；打开后 `fstat` 的
  device/inode/size 必须与预检一致；最终组件以 `O_NOFOLLOW` 打开（kernel 级绑定，realpath/open
  窗口内的最终组件 swap 直接 open 失败）；坐标扫描结束后复核文件未发生变化。任何不满足 →
  跳过该 journal（不输出其任何坐标）。测试必须含跨 Agent symlink、hardlink 与祖先目录
  symlink-swap 反例 fixture（§6）。已知的残余窗口：realpath 校验与 open 之间本机并发
  ancestor-rename——当前 cooperative shared-host trust domain（Product Architecture V1 /
  HARDENING_PROGRAM amendment 的既定威胁模型）下不作对抗性防御，记为已知限制（E1 closure）。
- 错误表（封闭；round-2 修订，C4 closure）：`invalid_arguments`、`forbidden_not_owner`、
  `credential_unavailable`（gateway 在 local capability 上先加载 caller credential，可能失败——
  必须声明，防止 child relay 把真实失败降级为 invalid_arguments）、`history_unavailable`
  （caller homes 根不可读时）。cursor 解码出的时间戳必须为有限毫秒值，否则
  `invalid_arguments`（C5：非有限值会使 keyset 比较恒 false、首页无限重复）。
- 隐私：输出不含任何消息正文、tool 参数/结果、模型输出；仅坐标与布尔 presence。
  输出仅供 caller 自身消费，消费禁令同非目标。

### CTR-SCT-003 — 调度链会话处置映射（冻结表）

输入 = occurrence ledger 记录既有字段 `{state, executionOutcome, terminalEvidence?.kind,
nativeSessionId, fences, terminationSettlement?}`（无任何写路径变化）。scheduler 自查询面
（self `runs` 投影与 execution-history scheduler-root 同表适用）：

| 既有状态组合 | sessionId 输出 | sessionCreated | REASON 输出 |
|---|---|---|---|
| `state='succeeded'` | nativeSessionId | created | — |
| `state='running'` | nativeSessionId | created | — |
| `state='failed'` + `terminalEvidence.kind='turn-terminal'` | nativeSessionId | created | — |
| `state='failed'` + `terminalEvidence.kind='pre-start-rejection'` | **null** | **not_created** | `pre-start-rejection`（+error_code 原值） |
| `state='failed'` + 其他 terminalEvidence.kind | nativeSessionId | unknown | — |
| `state='outcome_unknown'` | nativeSessionId | unknown | — （+fenceActive、terminationSettlement 有无） |
| `state='admitted'` | null | pending | — |

规则：`not_created` 时**任何面不得输出 sessionId**（含 execution-history 的 timeline 关联——
不产生 R5 关联，只产生 disposition 行）；`unknown` 不猜方向。pre-reserve 从未铸造 occurrence
的失败继续由既有 `self_ops.job_disposition`（slot 分类词表）回答，本表不重复其职责。
late-settlement 证据补充（S1 closure）：超时后 late settlement 若收到确定性未开始证明
（`routerEnvelope='not_admitted'` 或 `started=false`），writer 按 OCCURRENCE_OUTCOME_V3 的既有
分类法持久 `terminalEvidence.kind='pre-start-rejection'`（非泛化 late-settlement）——本表第 4 行
随之把该 occurrence 映为 `not_created`，未创建的 sessionId 不会被任何读面输出。
已知局限（如实记档，F-SCT-5）：postdeploy canary invoker 的 reserved 身份不触碰 AgentProcess
却会 terminalize `succeeded` 并持久 nativeSessionId——此类 occurrence 的投影按表输出
`created`（忠实于 ledger 既有证据），但 session 实际不存在；execution-history scheduler-root
侧因 journal 不存在仍降级为诚实 `CORRELATION_GAP`（不产生假 exact）。消除该边差需 canary
invoker 身份标记，记 FOLLOW_UP 不阻塞本期。

### CTR-SCT-004 — self `runs` 投影加法

`occurrenceProjection`（`packages/scheduler/src/self-service/projections.js`）在既有字段后追加：

```jsonc
"sessionId": "cron-run-occ:... | null",     // CTR-SCT-003 列语义；not_created 恒 null
"sessionCreated": "created | not_created | pending | unknown",
"sessionNotCreatedReason": "pre-start-rejection",  // 仅 not_created 时存在
"terminationSettled": true|false            // C-039 terminationSettlement 有无（CTR-SCT-003 unknown 行注记的落实）
```

Auth 模型零变化（self 零 Auth；foreign/all_agents 仍需 `scheduler.audit` 精确 wire proof）；
`all_agents=true` 审计投影追加同两字段（审计也受同表约束——audit ≠ 造证权）。

### CTR-SCT-005 — invocation 证据行坐标补齐

`<root>/control/runtime-evidence.jsonl` 的 `kind:'invocation'` 行追加 `occurrenceId, runId, jobId,
requestId` 四字段。 Plumbing 路径（precise）：evidence writer（observed invoker wrap）只看得到
`invokeWithDeadline` 构造的 invocation **request 对象**，该对象既有字段为
`{agentId, sessionId, occurrenceId, runId, requestId, payloadHash, message, model, timeoutMs,
deliveryTarget, signal, onStart}`——即 `occurrenceId/runId/requestId` writer 已在手；
**`jobId` 不在 request 上**（只在外层 job 实参与 router callerCorrelation 之外），故本 Spec
在 `packages/scheduler/src/occurrence.js` 的 request 构造处做**仅一字段加法**（`jobId`），
writer 随即四键齐写。纪律不变：evidence 写入继续 best-effort try/catch，写失败不得影响调用
成败语义；任何路径上某键不可得时该键省略（诚实 absent），旧行（无新字段）继续可读。
消费方（execution-history `runtime-evidence` loader）既有解析键为 `sessionId/reconciliationHandle/
occurrenceId/requestId/jobId`，本 Spec 加法补 `runId` 键（scope 已列）；scheduler-root 的坐标
匹配由此自然生效；坐标匹配是 `DERIVED_EXACT` 的辅助证据，非必要条件。

### CTR-SCT-006 — workflow `run_delivered.messageId` 生产填充

`workflow-execution-runtime` 的 deliverRun seam 从 `router.deliver` 收据透传 `messageId`
（收据本就携带，`ingress-delivery` 返回 `{accepted, sessionId, messageId, ...}`），engine 写入
既有 `run_delivered` 事件字段。冻结：`outcome_unknown` 路径（收据丢失）messageId 继续 absent，
**不得伪造**；旧行不受影响；attemptId/requestId/sessionId/reconciliationHandle 语义零变化。

### CTR-SCT-007 — execution-history scheduler-root 关联精化

- journal 存在（`cron-run-<occ>` 会话文件定位成功或 turn 证据存在）：correlation `R5` 定级
  `DERIVED_EXACT`（不再输出 `JOIN_BY_NAME_CONVENTION`）。
- journal 不存在且 CTR-SCT-003 判 `created|unknown`：输出 `CORRELATION_GAP{stage:'session_journal',
  knownFacts}`（保留既有 gap 形态），不定级 exact。**flush 无界**：journal sweep 有 sweep bound
  （newest-N/caps），凡 owe session answer 的 run_record——occurrence rotation、超出 sweep window、
  ledger-absent history-only world——其 gap 必须在 sweep 结束后统一 flush；有界 sweep 不得静默吞掉
  SC-2 缺口。knownFacts.reason 只陈述"sweep bound 内未定位到"，不得断言 journal 不可读。
- CTR-SCT-003 判 `not_created`：**不产生 R5 关联**，输出 disposition 行
  `{SESSION_CREATED:'NO', REASON}`。
- invocation 行坐标匹配（CTR-SCT-005 后）作为 `knownFacts` 证据引用输出。
- R1/R2/R3/R4/R6-R9 全部不变。

### CTR-SCT-008 — 双向追溯矩阵（REUSE 声明 + 本 Spec 增量）

| 查询方向 | 入口（全部既有 REUSE，除标注 NEW） | 链路 |
|---|---|---|
| SESSION → triggers/messages/tools/business | `execution_trace_query` root=agent_session | session-root R1/R3/R4/R5 既有 |
| SCHEDULER job/occ/run → SessionRef | self `runs`（CTR-SCT-004 NEW 字段）；`execution_trace_query` root=scheduler_run（CTR-SCT-006 NEW 处置） | scheduler-root |
| WORKFLOW attempt → SessionRef | `execution_trace_query` root=workflow_instance | attempts ledger + R2/R3 + CTR-SCT-005 messageId |
| SEND requestId/messageId → 双 SessionRef | `execution_trace_query` root=message | message-root R1（caller-side ASM audit 为主证据；sidecar 为补充） |
| MESSAGE → SessionRef | root=message / journal 定位 | 既有 |
| SESSION 枚举（NEW） | `agent_session_list` | CTR-SCT-002 |

## 5. 与消费禁令/权威边界的关系

- 新增 listing 与全部投影字段是**读视图**；scheduler/dispatcher/workflow engine/recovery 的 import 图
  继续被 `consumption-ban` 结构测试断言禁止触及 execution-history 包（含新 listing 模块）。
- Scheduler / Workflow / svc 业务事实继续归原 authority；Session 面只回答"谁、在哪个 Session、
  执行时发生了什么"；业务完成语义仍以 svc authority 为准（"Agent 说完成"不是完成证据）。
- caller identity 全链 trusted（gateway 冻结纪律不变）；audit scope ≠ 解密权（redact 全文适用）。

## 6. 测试与验收（隔离 fixtures，零生产副作用）

- **T1 身份碰撞**：两 agent fixtures 各持 `main`（及同 partyId 的 `cron-run-*`）→ listing 只返回
  caller 自己的；`execution_trace_query` root=agent_session 跨 agent → 403；任何关联不得跨 agent
  仅凭 sessionId 连边。
- **T2 scheduler→session**：真实形态 fixture（reserve→start→outcome）：self `runs` 返回
  sessionId+created；scheduler-root 给 `DERIVED_EXACT` + journal 内容可达。
- **T3 scheduler no-session**：(a) pre-start-rejection fixture → 投影 `sessionId:null` +
  `not_created{pre-start-rejection}`，scheduler-root 无 R5、有 disposition；(b) pre-reserve 拒绝
  → `job_disposition` 槽位词表（既有断言加固）；任何输出面无凭空 sessionId。
- **T4 send 双 Session 链**：同源 turn 连续两次 send → 两个 requestId/messageId 各自 exact 配对
  （既有 relay/provider fixtures 扩展断言）；message-root 经 ASM audit（含 archive 行）重建
  source(turn)→request→target(session,message) 双向链；archive-only 证据（WPA-1）可重建。
- **T5 workflow**：deliver 收据含 messageId → `run_delivered.messageId` 持久且 R3 链完整；
  收据无 messageId（outcome_unknown 形态）→ 字段 absent 不伪造；业务未提交时五维判定
  `businessProgress ≠ BUSINESS_DONE`（既有 R4 断言加固）。
- **T6 restart**：新查询上下文（模拟进程重启）从 durable 证据（attempts ledger / scheduler history
  events / ASM audit live+.1+archive / journals）重建全部链路，结果与重启前一致；listing 与
  session-index 解耦（caller 子树直扫）——索引删除或存在均不改变 listing 结果。
- **T7 privacy**：listing 无任何 foreign 会话行；执行既有 redaction/越权投影断言（非 owner 403、
  audit 读他者正文 redacted）。
- **T8 no fuzzy join**：删除 session journal / 删除 invocation 坐标后，对应关联变为
  `CORRELATION_GAP`/`WEAK_JOIN` 显式缺口，判定不因时间接近而成功。
- **T9 no second authority**：consumption-ban import 图断言扩展覆盖新 listing 模块；查询输出
  不进入任何派发/恢复决策路径。

## 7. 真实样本验收（§13；全只读，不为验收制造生产副作用）

- **A1**：真实 scheduler job → occurrence/run → SessionRef（self `runs` 新字段 + execution-history；
  canonical root 不可读时按访问矩阵降级并如实标注 degraded 范围）。
- **A2**：真实 agent_session_send 样本（既有 FLEET-E2E / content-ops inter_agent 落盘）→
  source SessionRef + requestId + target SessionRef + messageId 全链 exact。
- **A3**：真实 workflow attempt（现产有样本则验；无则显式 GAP 记档，G6 语义）→ SessionRef →
  workflow_execute result → svc event 桥或显式 SOURCE_ABSENT。
- **A4**：一个非 workflow 真实 session（如 stock/needs-radar）→ sessionId 查询内容 + listing 出
  该 session（kind/createdAt/lastActive 正确）。

## 8. 部署与回滚

- 纯 additive 读面/证据字段；无 schema 迁移；逐项可独立回退。
- 部署前置依赖（非本 Spec 新增，沿用 EXECUTION_HISTORY_QUERY_V1 §10）：auth-service additive
  grant packet（`execution.history.read` / `execution.history.audit`）——该两 scope 的工具族
  已在产代码中，grant 发放属 authsvc 侧 Owner 授权流程；本 Spec 的零 Auth 面
  （agent_session_list、self runs 投影）不依赖该 packet。
- 生产 apply 仍走 PRODUCTION_DEPLOY_QUEUE + 独立验收；`production_apply_authority: none`。

## 9. FOLLOW_UP_DEBT（不阻塞本期）

- F-SCT-1 = 既有 F1：turn-recovery durable MANDATORY 字段补 callerCorrelation/messageId
  （caller-side send 链的冗余证据层；ASM audit archive 已满足本 Goal 主证据要求）。
- F-SCT-2 = 既有 F2：scheduler RunRecord 冻结字段集扩 messageId/turnExecutionId（需未来
  RUN_HISTORY 后继 Spec，本文禁止触冻结字段）。
- F-SCT-3：渠道/Human trigger 外部坐标持久化（notification-ingress 幂等记录 7 天 sweep 之外）。
- F-SCT-4：`kind` 细分 D-008 `agent-delegation/task-*`、`background-*` 前缀核实后细化
  （现按 CTR-SCT-002 保守归 `other`）。
- F-SCT-5：postdeploy canary invoker 身份标记，使 canary occurrence 的 `sessionCreated`
  处置可判 `not_created`（见 CTR-SCT-003 已知局限；现状其对 session 无副作用，execution-history
  侧已诚实降级）。

## 10. 被拒绝的替代方案

- 新建 Session Registry/元数据 store：违反 §11 非目标与 D-008"不建 mapping layer"——拒绝。
- 扩 RunRecord/occurrence schema 携带 messageId：触 SCHEDULER_RUN_HISTORY R2 冻结字段集
  与 OCCURRENCE_OUTCOME_V3 稳定身份清单——拒绝（记 F-SCT-2）。
- 修改 ASM send 结果集回传 requestId：触 CTR-ASM2-009 冻结结果字段集——拒绝；requestId 经
  root=message 查询可得，链路完整。
- 以 elapsed-time/name 兜底补关联：违 R7——拒绝。
- 预填 `execution.history.read` grant 或绕过 gateway scope 检查：授权归 authsvc Owner 流程——拒绝。

## 11. Open owner decisions

- 无。CTR-SCT-004 对 V4 CTR-RESULT-002 inclusive 清单的读法已在 §0 显式声明并给出降级路径
  （评审若不认可 → 按 §14.2 型 AMEND 记录补 V4 amendment 注记，契约本身不变）。
