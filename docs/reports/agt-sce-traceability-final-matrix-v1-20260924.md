# SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1 — Final Matrix & Done-When (§16)

- date: 2026-09-24
- branch: `goal/session-centric-execution-traceability-v1`
- spec: `AGENT_CORE_SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1` (accepted @ `822477ab`)
- implementation: r1 `8070b670` → r2 (review repair) `c85d5ff3`
- acceptance: `docs/reports/agt-sce-traceability-acceptance-v1-20260924.md` (PASS_WITH_HONEST_GAPS)

## 1. Final matrix — TRIGGER → ADMISSION → SESSION → TURN → TOOL/BUSINESS → DELIVERY

分级：EXACT（durable 精确坐标）·PARTIAL（部分坐标 / 派生锚）·GAP（显式缺口，如实）·N_A。
括号内 = 支撑面。所有 GAP 均为系统**显式输出**的缺口（SC-2），无任何模糊关联兜底。

| 路径 | TRIGGER | ADMISSION | SESSION | TURN | TOOL / BUSINESS | DELIVERY |
|---|---|---|---|---|---|---|
| **Scheduler** | EXACT（occurrenceId=run=requestId 持久；invocation 行现携带 occ/run/job/request 坐标 [CTR-SCT-005]） | EXACT（reserve 记录 + slot accounting + `self_ops.job_disposition`；pre-reserve 拒绝=`ADMISSION_REJECTED` 等既有词表） | EXACT（self `runs` 投影 + `sessionCreated` 处置 [CTR-SCT-003/004]；pre-start ⇒ `SESSION_CREATED=NO{pre-start-rejection}`，永不输出伪 sessionId；生产 A1 验证 `DERIVED_EXACT` join） | PARTIAL（reconciliationHandle 在 evidence 行；RunRecord 冻结字段无 messageId/turnExecutionId ⇒ F2 GAP，如实） | N_A（scheduler 无独立业务工具面；turn 内 tool 事件归 journal 面=EXACT） | EXACT（`deliveryStatus` V3 冻结 + Feishu deliver） |
| **Workflow** | EXACT（dispatchIntentId + attempts identity 四元组 + attemptId 派生双路） | EXACT（`attempt_planned`/`resolution_blocked{code}`/`delivery_failed` 全 durable；pre-session ⇒ 无 session 输出，语义=既有 taxonomy） | PARTIAL→EXACT（`run_delivered.sessionId` 持久恒 `main`；`messageId` 生产 seam 现已填充 [CTR-SCT-006]；现产 0 样本 ⇒ 样本面 GAP=G6，如实，机制 fixture T5 已证） | PARTIAL（reconciliationHandle + messageId 收据可见时持久；outcome_unknown 不伪造） | PARTIAL（R4 桥 exact：journal `tool/result.workflowStateVersion` ↔ svc `event_sequence`；svc `command_id` 无读端点 ⇒ SOURCE_ABSENT [F6]，不造第二回执） | EXACT（业务完成以 svc authority 为准：`reconciled`/`stale_superseded`/closures） |
| **agent_session_send** | EXACT（caller trusted identity + source turn；`correlationHash`=DERIVED_EXACT 可重算） | EXACT（L0 denial 行 + L1 intent 行，commit order 冻结） | EXACT 双侧：source=caller journal turn + audit 行；target=`(targetAgentId, sessionId='main')` + native messageId（同步回执 CTR-ASM2-009） | EXACT（messageId=exact-turn 锚；`turn_inspect` 语义不变；同 turn 双发三重区分不串） | N_A | EXACT（outcome 行 accepted/replied/timeout/failed + WPA-1 archive 永久保留；reconcile 读窗不变） |
| **Manual / Human** | PARTIAL（journal user 消息落盘即 trigger 事实；渠道外部 trigger ID 无持久坐标 ⇒ F-SCT-3 GAP，如实） | N_A | EXACT（SessionRef 本体；A4 生产验证 listing+查询全链） | EXACT（journal turn 序 + tool 事件） | EXACT（workflow 类 tool 走 R4 桥） | PARTIAL（渠道投递面归 channel authority，本 Goal 不扩；scheduler Feishu 面=EXACT） |

**仍然存在的 exact GAP 清单（全部显式、全部已记档）**：

1. F2 — scheduler RunRecord 冻结字段集内无 messageId/turnExecutionId（需 RUN_HISTORY 后继 Spec）。
2. F6 — svc `workflow_command_receipts` / activation/closure 无读端点 ⇒ SOURCE_ABSENT（svc 侧独立立项）。
3. F-SCT-3 — 渠道/Human trigger 外部坐标不持久。
4. F-SCT-5 — postdeploy canary invoker 无身份标记（其 occurrence 投影 `created` 忠实于 ledger，execution-history 侧已诚实降级 CORRELATION_GAP）。
5. G6 — Workflow 派发链现产 0 样本（非代码缺口；派发跑通后链路即闭合）。
6. 部署依赖（非代码缺口）：`execution.history.read/audit` auth-service grant packet 未发放（`agent_session_list` 与 scheduler self 面零 Auth，不受阻）。

## 2. Done-When checklist

| Flag | 值 | 证据 |
|---|---|---|
| SESSION_IS_EXECUTION_TRACE_ANCHOR | **YES** | spec §2 SC-1/SC-2 冻结 + census 矩阵 + T1 |
| SELF_AGENT_CAN_LIST_SESSIONS | **YES** | `agent_session_list`（CTR-SCT-002；零 Auth、trusted identity、坐标-only；T1/T6/T7） |
| SELF_AGENT_CAN_QUERY_SESSION_BY_ID | **YES** | `execution_trace_query` root=agent_session（既有；A4 生产验证；grant packet 为部署前置） |
| SCHEDULER_RUN_CAN_RESOLVE_SESSION | **YES** | self `runs` 投影 sessionId+处置（CTR-SCT-004）+ scheduler-root（CTR-SCT-007）；A1 生产 PASS |
| SCHEDULER_PRE_SESSION_FAILURE_IS_EXPLAINABLE | **YES** | T3/T3b（`SESSION_CREATED=NO{pre-start-rejection}`；slot 词表既有）；永不伪造 sessionId |
| AGENT_SESSION_SEND_SOURCE_SESSION_EXACT | **YES** | ASM audit（live+.1+archive）+ correlationHash DERIVED_EXACT；T4 |
| AGENT_SESSION_SEND_TARGET_SESSION_EXACT | **YES** | messageId + sidecar verbatim；T4 + A2 生产 sidecar 反查 |
| WORKFLOW_ATTEMPT_CAN_RESOLVE_SESSION | **YES**（样本面 GAP=G6 如实） | attempts ledger + CTR-SCT-006 messageId 填充；T5 |
| SESSION_CAN_REVERSE_TRACE_TRIGGER | **YES** | session-root R1/R3/R5/R6（既有，本 Goal 验证语义强化） |
| SESSION_CAN_TRACE_BUSINESS_COMMIT_OR_EXPLICIT_GAP | **YES** | R4 桥 + SOURCE_ABSENT（T5/A3） |
| NO_FUZZY_CORRELATION | **YES** | R7 + T8 + blocker 回归测试 + A2 生产 CORRELATION_GAP 证明 |
| NO_SECOND_BUSINESS_LEDGER | **YES** | 全部为读视图/坐标索引/既有字段填充；consumption ban T9 原样 |
| PRIVACY_BOUNDARY_PRESERVED | **YES** | T7 + redaction 原样 + listing 坐标-only + trusted identity |
| FEATURE_READY | **YES** | 全套测试零回归（failing set = pristine main 的既有环境集）+ acceptance + 评审闭环 |
| MERGE_READY | **YES（PR 即 Owner acceptance 门）** | 独立实现评审 round-1 REVISE/1 BLOCKER → r2 修复 → exact-head re-audit |

## 3. Delivery envelope（§15）

```text
FEATURE_NAME = SESSION_CENTRIC_EXECUTION_TRACEABILITY_V1
BASE_ORIGIN_MAIN_SHA = 2a85d0659157a3bab649239158744d5222d86afe
FINAL_SOURCE_SHA = <HEAD at PR>
FINAL_TREE_SHA = <tree of HEAD>
FEATURE_COMMIT_SHA = 8070b670 (r1) + c85d5ff3 (r2) + final matrix/records
MERGED_TO_ORIGIN_MAIN = NO（等待 Owner PR merge）
EXPECTED_PRODUCTION_FILES = packages/execution-history/**（+session-listing, scheduler-root, session-index v2, loaders）
  packages/broker/src/capabilities/execution-history.js（+agent_session_list manifest）
  packages/production-runtime/src/execution-history/runtime.js（+list provider）
  packages/production-runtime/src/scheduler-invoker.js（invocation 行坐标）
  packages/scheduler/src/occurrence.js（request.jobId 一字段）
  packages/scheduler/src/self-service/projections.js（sessionCreated 尾部）
  packages/production-runtime/src/workflow-execution-runtime.js（messageId 透传）
EXPECTED_PRODUCTION_BEHAVIOR = 零 Auth self 列表+查询面可见新工具 agent_session_list；scheduler self runs 多三个字段；
  invocation 证据行多四坐标；workflow run_delivered 带 messageId（收据可见时）；无任何派发/授权/幂等语义变化
TEST_STATUS = 全套 2415 tests（r2 2415：+blocker 回归测试）；失败集与 pristine origin/main 同环境逐文件一致（47 项本机既有环境失败）；新增 17 测试全绿
ACCEPTANCE_STATUS = PASS_WITH_HONEST_GAPS（A1/A4 PASS；A2 PARTIAL-as-designed；A3 GAP=G6 如实）
DEPLOYMENT_DEPENDENCIES = ① auth-service additive grant packet（execution.history.read/audit——EXECUTION_HISTORY_QUERY_V1 §10 既有前置，非本 Spec 新增）；
  ② PRODUCTION_DEPLOY_QUEUE 常规排队；本 Spec 自身零 Auth 面不依赖 grant
ROLLBACK_CONSIDERATIONS = 纯 additive 读面/证据字段，无 schema 迁移；逐项可独立回退；session-index v2 可整目录删除重建
CAN_SHIP_WITH_WHOLE_MAIN = YES
READY_FOR_DEPLOYMENT = YES（merge 后）
WAITING_FOR_PDC_DEPLOYMENT = YES
```

---

## §A. Post-landing correction record (2026-09-24, PR_318_MERGE_BLOCKER_CLOSURE)

`PREVIOUS_REAUDIT_INCOMPLETE = YES`. `NEW_EVIDENCE_SOURCE = GitHub Codex fresh review @ PR #318 exact head d715869e`.

The fresh exact-head review surfaced five concrete findings that the prior internal re-audit (above) had not covered. The sections above are retained as history; they are superseded on the following points only:

| Finding | Class | Prior claim invalidated | Closure |
|---|---|---|---|
| G1 | REPOSITORY_INVARIANT_VIOLATION + REQUIRED_GATE_FAILURE | "MERGE_READY=YES" — the accepted authorizing Spec did not exist in implementation base `2a85d065`; docs-first was violated | Docs-only authority lane (`spec/session-centric-execution-traceability-v1`: census + spec at final reviewed state) lands first; implementation branch reconstructed stacked on it; `IMPLEMENTATION_BASE_CONTAINS_ACCEPTED_SPEC=YES` mechanically verifiable |
| B1 | CONTRACT_VIOLATION (exact join) | "exact scheduler join fully safe" — `byCronOccurrence` suffix fallback + missing owner check promoted `agt_evil/unrelated-<occBody>` to `DERIVED_EXACT` | Exact canonical identity required: decoded native sessionId === `cron-run-<occurrenceId>` AND located-journal agentId === routed/owning agent (occurrence owner → job routing → history run_record agent_id); foreign/suffix counterexample regression test added |
| B2 | CONTRACT_VIOLATION (listing completeness) | "listing correct" — journals created after index build were invisible indefinitely | `ensureFreshSessionIndex` now runs a bounded stat-only journal-inventory comparison and rebuilds on newly-discovered files; discriminating regression test added; index remains coordinate-only/rebuildable, no second registry |
| B3 | Structure gate regression | "structure violations base-identical" — `packages/broker/test` grew 21→22 direct children | Test moved to existing scoped subdirectory `packages/broker/test/capabilities/`; fresh A/B re-run required: `NEW_VIOLATIONS_FROM_THIS_GOAL=0` |
| F1 | CONTRACT_VIOLATION (validation boundary) | implicit — direct parent-RPC pagination was clamped/silently dropped (`limit:0/201/1.5/"10"/null`, `cursor:5/{}/[]` all succeeded) | Trusted handler + core both fail closed with `invalid_arguments`; no clamping; direct-handler regression matrix added |

Corrected gate claims: `SHIP_BLOCKERS=NONE` (above) is superseded by this record until the closure re-audit returns ACCEPT on the exact repaired head; `verify:structure` "no new violations" claim stands corrected — the prior run DID contain a goal-caused violation (B3).

## §B. Closure re-audit record (PR_318_MERGE_BLOCKER_CLOSURE, 2026-09-24)

Fresh independent reviewer context (new session, authored nothing under review) audited the exact repaired head:

```text
REVIEW_TARGET_HEAD       = d25ae10884bc823512a9b46b4916445dc735b0e7
IMPLEMENTATION_BASE_HEAD = a2a53c39ea6081e77badf29fb204d413dab09fe7 (spec/session-centric-execution-traceability-v1 tip)
G1 = PASS  accepted Spec exists in implementation base; merge-base(a2a53c39) contains spec+census; impl diff has ZERO authority-doc changes; corrections appended (original records intact; pre-repair refs preserved as tags pre-repair-pr-head/pre-repair-impl-head)
B1 = PASS  byCronOccurrence = exact canonical only; owner-agent match (occurrence owner → job routing → history run_record agent_id); reviewer-constructed counterexample (agt_evil/unrelated-<occBody> + same-agent suffix decoy) → zero false joins, genuine canonical journal still DERIVED_EXACT; decoys proven joined at d715869e (discriminating)
B2 = PASS  ensureFreshSessionIndex bounded stat-only inventory discovery; constructed new-untouched-journal scenario → discovered on next listing; index stays coordinate-only; no second registry
B3 = PASS  structure verifier vs authority base: 6 violations, goal-caused = 0; broker/test back under its registered ceiling; relocated test green
F1 = PASS  direct parent-RPC handler matrix: 11 invalid pagination inputs → all invalid_arguments; valid faces unchanged; reviewer-executed independently
FULL_TEST_DIFF = DIFF_CAUSED_FAILURES=0 (failing-FILE set byte-identical vs authority-base worktree run; notification-ingress idempotency-recovery confirmed a load-order flake — passes 8/8 isolated on both sides)
SHIP_BLOCKERS = NONE
VERDICT = ACCEPT
```

GitHub-side verification status, stated honestly: the five findings (G1/B1/B2/B3/F1) originate from the GitHub Codex fresh review at the pre-repair head `d715869e` and are each closed above with discriminating evidence. A fresh GitHub Codex review at the repaired head `d25ae108` was requested (`@codex review`, 2026-09-24T00:13Z) and had not been posted at reporting time (~16 min); the Owner should treat its result as the final external check before merging. Nothing in this report rewrites the prior records — corrections are appended (§A above, `post_landing_correction` in the Spec frontmatter).

Corrected delivery state:

```text
AUTHORITY_PR = #319 (spec/session-centric-execution-traceability-v1 → main; docs-only, 2 files)
IMPLEMENTATION_PR = #318 (base = spec/session-centric-execution-traceability-v1, stacked; auto-retargets to main after #319 merges)
IMPLEMENTATION_BASE_CONTAINS_ACCEPTED_SPEC = YES (mechanical: merge-base = authority tip a2a53c39)
FEATURE_READY = YES
MERGE_READY = YES (all §7 gates green; external Codex check on d25ae108 pending at report time — Owner may merge after confirming it introduces no new findings)
SOURCE_READY_AFTER_MERGE = YES
DEPLOYMENT_REQUIREMENT_READY = YES
WAITING_FOR_PDC_DEPLOYMENT = YES (post-merge)
```

## §C. Round-3 closure record — GitHub fresh review @ 70bc04d0 (D1-D4) + final external check

The GitHub Codex fresh review at the round-2 repaired head `70bc04d0` surfaced four further findings, all closed and re-verified:

| Finding | Closure |
|---|---|
| D1 (P1) exact joins exposed the ENCODED directory id (`cron-run-occ~003Aabc`) as the SessionRef | `decodeSegment` applied in the sweep — `to.nativeRef`/`evidenceRefs`/observations now carry the NATIVE id (`cron-run-occ:abc`); regression asserts the colon form |
| D2 (P1) job-level run_record projection required `occurrences.length === 0`, stranding runs beyond the newest-50 ledger slice | projection now admits EVERY job-matching run record (join or honest gap each); regression test with a ledger-absent 4th run |
| D3 (P1) the new inventory check treated an over-cap fleet (4000 files) as permanent drift → rebuild on every query | inventory shares the builder's cap; over-cap fleets retain the cache with an honest `overCap` coverage flag |
| D4 (P2) occurrence coordinate regex matched quoted fake ids in message text | tightened to the real shape (`occ:` + 16 lowercase hex); regression test (fake id never becomes a coordinate) |

External check (the gate required by PR_318_MERGE_BLOCKER_CLOSURE): GitHub Codex fresh review triggered at final head `44529fae` — **zero inline findings** (versus 4 at `70bc04d0`, 5 at `d715869e`).

Final state:

```text
AUTHORITY_PR            = #319 (spec/session-centric-execution-traceability-v1 → main; docs-only)
AUTHORITY_ACCEPTED_HEAD = spec final reviewed state (carried at authority tip 15bfb178)
IMPLEMENTATION_PR       = #318 (base = authority branch; auto-retargets to main after #319)
IMPLEMENTATION_BASE_CONTAINS_ACCEPTED_SPEC = YES (merge-base = authority tip)
FINAL_HEAD              = 44529fae7de8074e23d74abf5da443bd6c7ba7ab
FULL_TEST_DIFF          = DIFF_CAUSED_FAILURES=0 (failing-FILE set identical to the authority base; the four alternating runner flakes — agent-router auto-recovery, notification-ingress idempotency, product-api voice-transcription (native sherpa crash), demo-server real-boot — all pass isolated and touch no diff files)
STRUCTURE_NEW_VIOLATIONS = 0
SHIP_BLOCKERS           = NONE (internal fresh re-audit ACCEPT + GitHub Codex fresh review clean at final head)
FEATURE_READY           = YES
MERGE_READY             = YES (Owner merge order: #319 then #318)
```
