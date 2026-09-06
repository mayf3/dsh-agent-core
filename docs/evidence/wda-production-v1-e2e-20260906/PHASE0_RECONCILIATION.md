# RECONCILIATION — WORKFLOW_DEFINITION_AUTHORING_PRODUCTION_V1 Phase 0 (fresh, 2026-09-06)

OLD_GOAL_STATE = NON_AUTHORITATIVE（旧 WDA goal 已 archive）。以下全部来自 fresh current truth。

## ALREADY_COMPLETED

1. **Accepted Authority 现行 = AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V2**（accepted 2026-09-05 @092d9c16，supersedes V1）：
   4 ops（create_definition / create_draft_version / replace_draft_graph / publish_version）、scope 恒 `workflow.execute` 零 Grant 变更（DEC-003）、publish 后 version 不可变（409 definition_version_immutable）、instance 必须绑 exact published version（CTR-WDA-006/009）、唯一 delta = semanticModel enum 1|2|3。
   位置：`dsh-agent-core-main/docs/specs/AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V2.md`。
2. **Authoring 生产部署 + catalog 机械证明**（旧 goal 2026-09-05，REUSE_IF_CURRENT = CURRENT）：2 文件闭包部署生产（broker），catalog 恰 4 authoring ops / wex 2 ops / workflow_transition standalone ABSENT；canary 五步链 PASS + PUBLISHED_VERSION==INSTANCE_DEFINITION_VERSION binding PASS（cc3403c6）。证据：`deployment-artifacts/workflow-definition-authoring-v1-deploy-r2/`（TERMINAL/MANIFEST/CANARY_RESULT）。
3. **执行链全部 production-proven（冻结依赖，不重开）**：Scheduler→HR→workflow_global_instances→ACTIONABLE_NOW→exact assignee→Principal→Agent resolution→agent_session_send→target self-transition→actor==assignee enforcement→authoritative advance（STEADY-STATE-R1 PASS，`dsh-agent-core-main/docs/investigations/HR_DISPATCH_DELIVERY_READINESS_V1.md` L510-596）。
4. **授权面已开放**：fleet-wide `workflow.execute` grant（Owner ruling WORKFLOW_TRANSITION_WRITE_PATH_FLEET_OPEN_V1，2026-09-02 applied）；HR（agt_hr-agent）持 GLOBAL_WORKFLOW_COORDINATOR/READER + workflow.admin/read/execute；canary 授权用 hr-agent machine credential（旧 canary 同配方）。
5. **INSTANCE_INPUT_PRINCIPAL 语义已实现且 fail-closed 已测**（svc 套件：非法 UUID / ghost / disabled assignee 全拒；DRAFT assignee 必须 WORKFLOW_CREATOR；恰一 DRAFT 入口 + ≥1 TERMINAL + 无环）。

## CURRENT_PRODUCTION_READY_SURFACES（fresh census 2026-09-06）

- svc-workflow live `http://127.0.0.1:8989` — version 0.3.1，gitSha e297ff1（work-eligibility release，healthz/readyz ok）。
- auth-service live `:4001`（hr-agent client mc_4Ud_9wGR1mwQM9W7s7foX8qp，secret Owner-only）。
- Broker catalog：workflow_execute(create_instance/transition) + workflow_global_instances（GLOBAL_READER/COORDINATOR 服务端 enforcement）+ authoring 4 ops。
- 目标 Agent 候选（canonical、active）：agt_blog-agent `fd58881a-fdba-4ef2-9a80-b733671f24f1`（steady-state 实证执行者）+ agt_efficiency-agent `b21ddb23-42f6-47c4-a27f-bc44950e554c`。
- ⚠ huanhuan（agt_huanhuan-thought-agent）在 auth 无 active principal → 弃选。
- 图语义 **无 parallel branches**（SVC_WORKFLOW_PRODUCT_BOUNDARY_V6 明示排除）→ 并行证明走 **fallback：1 Definition + 2 独立 instance**（规格明示允许，零架构扩张）。

## FIRST_GENUINELY_MISSING_CAPABILITY

把既有 authoring 能力与既有执行链**首次端到端串起来的生产 E2E**：
authorized authoring（INSTANCE_INPUT_PRINCIPAL Definition + 负面证明）
→ publish/绑定证明 → 2 instance 分派给 2 个不同 canonical Agent → 两项 work 同一周期 ACTIONABLE_NOW
→ Owner 真实飞书 HR operating flow 一轮并行派发 → 双 Agent 各自执行 + self-transition → 权威推进 + exactly-once 计数。

NEW_AUTHORITY_REQUIRED = **NO**（REUSE-FIRST resolution A：EXISTING_PRODUCTION_CAPABILITY_SUFFICIENT）。
