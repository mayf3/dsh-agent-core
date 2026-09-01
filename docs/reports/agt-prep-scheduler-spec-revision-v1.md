# agt-prep-scheduler-spec-revision-v1 — AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 draft r1 → r2 revision report

- ROUND: PRODUCTION_RND_PARALLEL_PREPARATION_V1 / LANE_2 = PRODUCTION_RND_SUPPORT_PREPARATION (PREPARATION TRACK — production deployment OUT OF SCOPE)
- BRANCH: `prep/scheduler-spec-revision-v1` @ BASE 840d2f4ad91f8252eb1f163330c041216a0dd9c4 (github/main tip), worktree-isolated
- TASK_TYPE: SPEC_AUTHORING_ONLY（docs-only；目标 = 刷新 staged WIP draft spec 的 stale 现状事实；零实现、零 authority 变更）
- PRIMARY INPUT: draft r1（user checkout staged WIP，not at BASE）+ R1 调查 `SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1.md` + `scheduler-code-excerpts.md`（branch `prep/scheduler-semantics-investigation-v1`）
- DELIVERABLE: `docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md`（r2，new file at BASE——draft r1 不在 BASE，本分支新增）+ 本报告

```text
DEVELOPMENT_PREFLIGHT

Problem =
  draft r1（proposed、implementation_authority none）的 §2.1 现状事实相对
  BASE 840d2f4 有三处 proven-stale（S1/S2/S3），须在其 G1 审计前刷新，
  否则审计会建立在错误基线上。

Governing Spec =
  本轮产出 = draft r2（仍 proposed）。上位权威不动：D-007
  SCHEDULER_OCCURRENCE_OUTCOME_V2（accepted）。

Spec status = draft r2 proposed；implementation_authority = none；
  production_apply_authority = none（frontmatter 未变）。

Boundaries = 仅本 worktree 写入；无 push/remote/stash/reset；无 npm/test/
  network/live 查询；/usr/local/libexec 与 launchctl 未触；workflow.js 只读
  未触；user checkout 只读。
```

---

## 1. Mandatory fact fixes applied

### S1 — "现行引擎 = pre-D-007" is FALSE at BASE → rewritten as D-007-conformant

Sections touched: frontmatter（revision 记录）、§0 现状段、§1 preflight
（Problem / New evidence / Frozen boundaries / Implementation scope /
Out-of-scope）、§2.1（表行「现行 scheduler 引擎」整行重写 + 新增表行
「occurrence authority ledger」「现有查询面」）、§2.3、R1/R1a/R2/R4/R5/R6/R10/R11
措辞、§4 闭包（lifecycle 边界名修正）、§6 ALT-001/004/005 前提、§7。

What changed（r2 §2.1 现在断言，全部经本修订轮在 BASE worktree 自行复核）：

- 身份：`occ:`/`run:` 确定性身份（packages/scheduler/src/occurrence-model.js:64-75）、
  `idempotencyKey = occurrenceId`（occurrence-model.js:263）、payloadHash 排除
  delivery（occurrence-model.js:102-118）、`nativeSessionId='cron-run-<occ>'`
  （occurrence-model.js:87-89）。
- Admission：reserve-before-Router——`reserveOccurrence` 于跨进程 mutation
  lock（packages/scheduler/src/store.js:119-192）内 coords 去重 +
  `OCCURRENCE_PAYLOAD_CONFLICT` fail-loud + `state:'admitted'` +
  持久化 `executionDeadlineAtMs`（packages/scheduler/src/occurrence.js:34-121;
  occurrence-model.js:248-274）。
- 五 durable states 全可达：`OCCURRENCE_STATES`（occurrence-model.js:21）+
  状态机（:35-41）；running 由 invoker start 证据写入（occurrence.js:124-141）；
  succeeded/failed/outcome_unknown 分类（occurrence.js:237-271）；deadline 到期
  无 termination proof → outcome_unknown + fence（occurrence.js:213-233;
  occurrence-model.js:317-333）；restart sweep（scheduler.js:211-232）；
  late settlement（occurrence.js:354-424）+ operator reconcile（control.js:175-243）。
- r1 的具体 stale 断言清除：「no-dup 仍是 state.runningAtMs（isRunnableJob
  L112）」「fire=标记 runningAtMs L404-416 → applyRunState L659-713」
  「control.js 不存在」——BASE scheduler.js 仅 345 行、无 applyRunState/
  isRunnableJob，L35 注释即「execution decision is made from the occurrence
  ledger, never runningAtMs」；control.js 存在（243 行，含 deleteJobOp/
  submitOneShotOp/reconcileOccurrence）。
- 连带事实修正：R10 表中 AGENT_START_FAILED 不再标注为「scheduler-router
  既有码」——BASE 只有 AGENT_NOT_FOUND / AGENT_DISABLED
  （scheduler-router:123-131）；该码改标为「分类表保留值、V1 无 BASE emitter」。
  §4 闭包的引擎挂钩点从 r1 的虚构名（_fireJobs/applyRunState）改为 BASE
  真实函数（reserveOccurrence / markOccurrenceRunning /
  writeOccurrenceOutcome / deliverOccurrence / applyJobCompletion）。
  R1a 的「pre-authority 引擎回退派生」重排为「权威身份透传（优先级 1，
  V1 唯一预期路径）+ 权威身份不可得时的派生回退（V1 预期不触发）」，回退
  公式逐字保留（冻结合同不弃），并显式声明回退身份不回写权威 ledger。

### S2 — "执行记录无 occurrence/run 身份" is FALSE at BASE → gap statements restated as the true delta

Sections touched: §0（现状整节重写为「已有事实 + 诚实 delta 八项」）、§1
preflight（Problem / New evidence）、§2.1（ledger 行、runs.jsonl 行、CLI 行、
self-service 行）、R1（job_snapshot 标注为真实缺口）、R2（逐组注明 BASE
已有/真缺）、R5（BASE 定义删除已成立；缺的是删除后查询自包含）、R6（新增
「既有 ledger 并存不替代」纪律与 §10.2 立场更新）、R7（尾注：既有 CLI
client-side 扫描不升级为 HTTP 面）、R11（R-H2 改为「v2 文档格式与既有
ledger 零改动、不新增 history 字段」）、§5（ACC-001a / ACC-007 / ACC-010
的 jobs.json 断言改为 {version:2, jobs[], occurrences[], fences{}} 形态、
ledger 字段零 diff）、§6 ALT-005/ALT-006 前提、§9。

What changed：

- 已有事实（自验 file:line）：v2 occurrence ledger 在 jobs.json 内
  （store.js:12-16 `{version:2, jobs[], occurrences[], fences{}}`；字段面
  occurrence-model.js:248-274 + occurrence.js:293-330），job 删除后保留
  （control.js:119-126 deleteJobOp 仅移除 definition）＝ D-007 §10.2 选项 1
  已实现；runs.jsonl append-only + fsync + 10MB newest-lines 截断
  （store.js:33-34, 399-448；best-effort occurrence.js:426-432），事件
  occurrence_reserved/turn_start/router_admission/outcome/delivery/
  late_settlement/store_upgrade 均含 occurrenceId/runId（occurrence.js:
  104-118, 140, 150/160, 334, 345, 412; store.js:179）。
- 真实 delta（r2 §0 逐项）：① 结构化业务结果摄取（counters/final_status
  零实现）；② summary/final_status 持久化（summary 仅进 delivery 文本与
  production-runtime invocation evidence 行——occurrence.js:243;
  compose.js:385-413）；③ 独立 history store（ledger 与 definition 同住
  单文档、全量原子重写 store.js:306-341；runs.jsonl 是有界 evidence 非查询面）；
  ④ HTTP 查询 API（scheduler/scheduler-router 零 HTTP；product-api 仅
  /health+/v1/*，index.js:233-258；notification-ingress 仅 /health+
  /v1/deliver，index.js:161,172）；⑤ scheduler.read/audit/admin token 门
  （SELF_SERVICE 的 scheduler.read:self 等是 local entitlement 标签、显式
  非 auth scopes、无全局 audit——该 accepted spec L71,107-110）；⑥
  correlation 真缺字段（correlationId/parentRunId 全仓 grep 0 hits——自验；
  request_id 一侧已有原料 idempotencyKey=occurrenceId 且经 callerCorrelation
  透传 scheduler-router:155-159）；⑦ job_snapshot（删除后 definition 语境
  不可恢复；self-service runs post-delete not-found = CTR-RESULT-002）；
  ⑧ CLI runs 已展示 occurrence 维度（agentcore-cron.mjs:20-24,257-283——
  D-007 §12.2 该义务已兑现）但仅 client-side 过滤。
- 提案价值重述（诚实基线）：本 Spec 不是「凭空建立执行事实」，而是给
  已 D-007-conformant 的引擎补查询/语义层；one-sentence model 保留，
  措辞改为「D-007 已冻结且引擎已实现的执行语义之上」。

### S3 — governed_by D-006 → D-008

Sections touched: frontmatter（governed_by、related_specs）、§2.1（会话行）、
R7（run detail 的 D-006 引用）、R9（session 链句）、§7（一致性核对行）。

What changed：

- `governed_by` 现引 docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md
  （D-008，accepted 2026-09-01，standalone Current Authority，BASE 提交
  b2e3eb1「accept D-008 session model V3」——自验 git log + 文件头 L2-9；
  D-006 文件已标 superseded_by D-008——自验其 L3-4）。per-occurrence fresh
  non-main session 语义经 D-008 承接（且 BASE 已实现为 cron-run-<occ>）。
- 连带 stale 引用修正（同性质）：related_specs 的 SCHEDULER_TIMEOUT_OUTCOME_V1
  → **V2**（V1 已 superseded 2026-08-22，V2 = whole-authority replacement、
  accepted、implementation_authority: contracts——自验两文件 frontmatter；
  §1 preflight / §7 同步）；related_specs 增补 accepted 的
  AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1（R8 与其命名/权威面调和义务，
  见下）；agent_wake / HR_DISPATCHER 两条 related_specs 标注为「staged WIP、
  不在 BASE」（二者在 BASE 不存在——自验 ls；其内容只在 user checkout）。

## 2. Additional consistency fixes forced by the above (logged)

- R8：gateway.js 引用从 r1 的「L164-186」修正为实况「requiredScopes 先取
  token、失败 access_denied 于 handler 前（gateway.js:153-155, 226-249）」；
  requiredScopes 先例列举更新为自验集合（workflow.read capabilities/
  workflow.js:92、forum.read/write、okr.read、agent.definition.write）。
- R8 新增调和义务 1：SELF_SERVICE local entitlement 标签 ≠ token scopes，
  HTTP 面不接受 local 标签（fail-closed）；ACC-005 增加对应负向断言。
- R2 request_id 措辞：BASE 已有 idempotencyKey=occurrenceId 并透传——
  request_id_source 缺省 'execution-authority'；不可得才 null/'unavailable'
  （诚实缺口语义保留，字段集不变）。
- §7 一致性核对表增加 D-008 行、SELF_SERVICE 行；D-007 行更新为「既有
  选项 1 实现未被越权改动」。

## 3. Intentionally NOT changed (r1 frozen semantics preserved)

- spec_id / status: proposed / SPEC_AUTHORING_ONLY posture /
  implementation_authority: none / production_apply_authority: none /
  owners / scope 列表 / task_name。
- 冻结字段集：OccurrenceRecord（R1）、RunRecord 十组（R2）、R1a 回退派生
  公式（'schocc:'/'rev:'/'ph:' 逐字保留，仅定位重述为边缘回退）、R3 状态
  映射表、R4 结构化结果合同（fenced block/final_status/16KB/扁平 counters/
  fail-soft 错误码）、R5 deleteAfterRun 语义、R6 history store 布局
  （events.jsonl + runs-<YYYYMM>.json + 纪律全集）、R7 查询 API 面
  （三 GET + 参数 + 错误表）、R8 权限模型名（scheduler.read/audit/admin）、
  R9 correlation 链与 J1/J2/J3 join 合同、R10 分类表（值集不变）、R11
  红线（编号与语义不变，仅 R-H2/R-H9 事实措辞）、§2.2 Gate 链 G1–G5、
  §2.3 两处 D-007 调和、ACC-001..010 + C 块、ALT-001..015 编号与裁定
  （前提句随事实修正）、§8 零改动清单。
- 不提出任何对 packages/broker/src/capabilities/workflow.js 或任何引擎
  文件的修改；§4 零改动清单保持并强化（含既有 occurrence ledger）。

## 4. Verification method

- 所有关键 file:line 引用在本修订轮 worktree（BASE 840d2f4）以 sed/grep
  逐一复核；R1 调查报告 + evidence 摘录作为出处索引（其与 worktree 实况
  零分歧）。复核未覆盖的少量次要引用（如 store.js:251-304 校验、
  lock.js 行号、scheduler-router:260-308 deliver 区段、eligibility.js
  行号）保留 R1 调查的引用并标注其出处属性。
- 无任何 live 查询 / 网络 / 测试执行；生产服务未触。

## 5. Terminal state

```text
TASK_STATUS = COMPLETE（docs-only）
IMPLEMENTATION = PAUSED_AUTHORITY（draft 仍 proposed；G1 审计前零实现许可）
SPEC_DELIVERED = docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md（r2）
REPORT_DELIVERED = docs/reports/agt-prep-scheduler-spec-revision-v1.md（本文件）
BOUNDARIES_HONORED = worktree-only writes; local git add/commit only;
  no push/remote; no npm/test/network/live queries; no production touch;
  packages/broker/src/capabilities/workflow.js read-only untouched;
  user checkout read-only untouched
READY_FOR = 调度历史 审计（G1），以 r2 事实基线评审
```
