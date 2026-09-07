# WORKFLOW_DISPATCH_ACTIVATION_SOURCE_MERGE_V1 — Fresh-Main Integration Review Record

- TASK_NAME: 整合 review（GOAL 终段：fresh-main integration → integration review → main merge 确认）
- GOAL_MODE: RESUME_GOAL_IF_EXISTING_STATE_FOUND（existing lifecycle 恢复，零重做）
- Review head: dsh-agent-core **main 40d0924**（review 时点 fresh-read，tip 未漂移；tested base == tip）
- Governing authorities: SVC_WORKFLOW_PRODUCT_BOUNDARY_V6 (accepted, svc PR #20) + svc-workflow architecture v0.4.0 (PR #21) + SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1 (svc PR #23/#24, svc main 22e862a) + AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1 (accepted, PR #146 @ 495b163)
- Review nature: docs-only integration review of the ALREADY-MERGED dispatch/activation source against the current fresh main. No code change, no authority change.

## 1. Recovery coordinates (fresh-read 2026-09-03)

| Item | Value |
|---|---|
| CURRENT_MAIN (dsh) | 40d0924 (github/main tip) |
| CURRENT_MAIN (svc) | 22e862a (github/main tip = visit-activation impl merge) |
| CURRENT_AUTHORITY | V6 accepted (svc PR #20) + architecture v0.4.0 (svc PR #21) + VISIT_ACTIVATION_IMPL_V1 accepted/implemented (svc PR #23/#24) + broker spec accepted (PR #146) |
| CURRENT_IMPLEMENTATION_HEAD | b031ecf (impl aaf7a43 + audit b031ecf, merged via PR #148 @ bf2efd5) — verified ancestor of main tip |
| ALREADY_COMPLETED | spec acceptance; svc runtime core (migration 0023 activations/nextEligibleAt, wake, due-poll, 9/9 + audit PASS); broker impl (workflow_dispatch_intents + workflow_wake_dispatch_intent, 8/8); independent broker code audit (BROKER_CODE_AUDIT = PASS, merged record); impl+audit merged to main |
| FIRST_UNFINISHED_PHASE | fresh-main integration（impl merge 后 main 又前进 9 个 PR：#147 #149 #151 #144 #152-154 #156 #157 #150；套件未在 tip 重验）|

## 2. Integration verdict (all checks re-executed at 40d0924, not inherited)

| Check | Result | Evidence |
|---|---|---|
| V6_AUTHORITY | **VALID** | svc main docs/product/SVC_WORKFLOW_PRODUCT_BOUNDARY_V6.md `status: accepted`, supersedes V5, superseded_by null; canonical model = active non-terminal TASK Node Visit → AGENT owner → DISPATCH_INTENT + nextEligibleAt wait primitive + controlled early wake |
| DISPATCH_INTENT_IMPLEMENTATION | **PASS** | `workflow_dispatch_intents` present on main (GET /internal/v1/dispatch-intents, workflow.read, 7-field due-intent passthrough, limit fail-fast, 403 scheduler_read_role_required declared) |
| ACTIVATION_IMPLEMENTATION | **PASS** | `workflow_wake_dispatch_intent` present on main (POST …/node-visits/{nodeVisitId}/wake, workflow.execute, trusted Idempotency-Key, wakeApplied=false = 200 no-op); svc main src/http/handlers/wake.rs + dispatch_intents.rs present |
| BROKER_RUNTIME_CONSUMER | **PASS** | both manifests in workflow `manifests` array → DEFAULT_MANIFESTS via `...workflowManifests`; single-registration asserted in test; svc side enforces GLOBAL_SCHEDULER_READ / scope server-side |
| FOCUSED_TESTS | **PASS** | `node --test test/capabilities/workflow-dispatch-intent.test.js` at 40d0924: **8/8** |
| INDEPENDENT_IMPLEMENTATION_AUDIT | **PASS** | docs/reports/workflow-dispatch-intent-broker-v1-code-audit.md (b031ecf, merged): full CTR-DIB-001..004 matrix; dev-round fixes recorded |
| FRESH_MAIN_INTEGRATION | **PASS** | clean worktree @ 40d0924: full broker suite **336/336 pass / 0 fail**（331 at impl merge + 5 definition-authoring tests from #156；deps zero drift：package.json/package-lock b031ecf→40d0924 无差异）；dispatch 区段与测试文件对 b031ecf **byte-identical**（0 diff lines）——impl merge 后的 broker 漂移仅为 #156 新增 workflow-definition-authoring 能力（error 常量移模块 + manifests 数组加一项），dispatch 语义未动 |
| MAIN_MERGE | **PASS** | dispatch source（7bff970 spec / aaf7a43 impl / b031ecf audit）均为 main tip 40d0924 的祖先（merge bf2efd5, PR #148）；本 review 记录为 goal 终段的 docs-only 收口提交，非代码 merge |
| PRODUCTION_DEPLOYMENT | **NOT_RUN** | GOAL boundary PRODUCTION_APPLY_ALLOWED = NO；deployment 仍归独立 gate（audit record 结语一致） |

## 3. Business contract chain (V6 conformance)

eligible workflow state（svc migration 0023 canonical activation facts + server-authored nextEligibleAt）
→ DISPATCH_INTENT（GET dispatch-intents due poll, 7-field minimum projection, exactly-one activation invariant）
→ activation（wake = controlled early wake: eligibility fact previous→now + one version increment, durable no-op family, idempotency replay）
→ Broker/runtime consumer（两个 broker 工具经 trusted transport + workflow.read/workflow.execute scope 消费 svc 端点；identity 字段 trusted-seam，不 model-facing；无 broker 自动重试）
→ target Agent execution path（assignee 经既有 workflow_my_tasks 可见 work item、经 workflow_execute 执行——production-verified 既有路径，本 goal 未新增执行面）

Non-goals held: workflow_global_instances 保持 scheduler-free（测试 narrowed check 在 main 上 green）；Workflow / Scheduler / Session Messaging 职责未交叉；无 generic workflow execution framework 回潮。

## 4. Anti-goal guard

- **PR #19（SVC_WORKFLOW_DISPATCHABILITY_PROJECTION_V1，OPEN）未复活**：本 round 零接触；dsh main `packages/` + `docs/specs/` grep `dispatchability|dispatchable` = 0 hits；svc main `src/` grep `dispatchable` = 0 hits（V6 已以 accepted V6 取代 V5 read-time projection 方向，runtime 无 dispatchable flag）。
- 无 V5/read-time projection 重新采用；dispatch feed 仅经 canonical due-poll 端点，全局 list/query（workflow_global_instances / domain instances）未冒充 dispatch feed。

## 5. Boundaries

- DOCS ONLY：exactly 1 file（本记录）；PRODUCT_CODE_CHANGE = NONE。
- 用户主 checkout（docs/lark-ux-phase1-v2-spec 分支 + 既有 broker WIP）零接触；review 在独立干净 worktree（/Users/yanfenma/workspace/worktrees/dsh-dispatch-fresh-main-integration，detached @ 40d0924）执行，node_modules 复制自已验证的同依赖 impl worktree（deps zero drift 为复制前提，已机械核实）。
- 生产访问 = NONE（本 round 未读生产、未写生产、未 restart）；svc-workflow/auth-service 仅本地 git 只读。
- 显式 pathspec 提交；不携带任何其他在制变更。

## FINAL

GOAL_STATUS = COMPLETE；WORKFLOW_DISPATCH_ACTIVATION_SOURCE_MERGED = **YES**（V6_AUTHORITY = VALID / DISPATCH_INTENT_IMPLEMENTATION = PASS / ACTIVATION_IMPLEMENTATION = PASS / BROKER_RUNTIME_CONSUMER = PASS / FOCUSED_TESTS = PASS / INDEPENDENT_IMPLEMENTATION_AUDIT = PASS / FRESH_MAIN_INTEGRATION = PASS / INTEGRATION_REVIEW = PASS（本记录）/ MAIN_MERGE = PASS / PRODUCTION_DEPLOYMENT = NOT_RUN）。
