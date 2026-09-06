# TERMINAL — WORKFLOW_DEFINITION_AUTHORING_PRODUCTION_V1

**GOAL_STATUS = COMPLETE**（2026-09-06；REAL_PRODUCTION_E2E_COMPLETE 达成）

## FINAL_HANDOFF

| 字段 | 结果 |
|---|---|
| AUTHORING | PRODUCTION_PASS（authorized agent 经生产 API 走完 create_definition → create_draft_version → replace_draft_graph → publish_version 全链） |
| VALIDATION | PASS（现行 canonical validator；INVALID_DEFINITION fail-closed 实证） |
| PUBLICATION | PASS（publish 后 version 不可变；publishedVersionId 回查一致） |
| VERSION_IDENTITY | PASS（PUBLISHED_VERSION_ID == INSTANCE_DEFINITION_VERSION_ID，双 instance detail 回查 + 终态复验） |
| INSTANTIATION | PASS（2/2 instance 自 exact published version 创建） |
| HR_FEISHU_OPERATION | PASS（3 轮真实 Owner 飞书交互；最终轮 HR 一轮并行派发 2 条） |
| AUTONOMOUS_EXECUTION | PASS（双目标 Agent 各自执行并以自身身份自推进） |
| PARALLEL_DISPATCH | PASS（规格 fallback 路径：1 Definition + 2 独立 instance；HR 同轮派发、互不等待） |
| EXACTLY_ONCE | PASS（每 work：1 publish / 1 instance / 1 HR 派发决策 / 1 send / 1 run / 1 自推进 transition；timeline 计数机械断言） |
| PRODUCTION_HEALTH | PASS（svc healthz/readyz ok + production-runtime 进程存活，verify 内断言） |
| OWNER_ACTION_REQUIRED | NONE |

**WORKFLOW_DEFINITION_AUTHORING_PRODUCTION_READY = YES**

## 生产坐标（一次性 canary，保留 fixture，无 delete/archive）

- domain `0aa0532a-fb56-43b7-be69-1638e66df456`（key `canary-wda-prod-v1-1788668907`）
- definition `c6552b9d-0437-43d2-b056-d40329b213ab` / published version `de38aebc-8f14-493a-a608-78b7bffff0fb`
- instance A `3b44f839-0ce2-435c-9439-2a93f8029c49` → agt_blog-agent（`fd58881a`）：creator kick → 自推进 → **done/TERMINAL**
- instance B `adea4ad4-ba6d-4920-991a-46a6b9cee341` → agt_efficiency-agent（`b21ddb23`）：同上
- creator/provisioner = bc970ced（legacy hr principal；client `mc_FdRIJ…` + `wf-admin-hr-agent-secret`）
- 域 owner 终态 = bc970ced（verify 开头自动从 dc702687 还原，`OWNER_RESTORED_FOR_VERIFY=PASS`）

## 执行链证据（全部收据化）

1. **Authoring E2E（apply 12/12 PASS）**：`APPLY_RECEIPT.json`；图 = DRAFT(WORKFLOW_CREATOR) → NORMAL(INSTANCE_INPUT_PRINCIPAL, key `assigneePrincipalId`, `contextSchema.required` 覆盖) → TERMINAL。GLOBAL_READBACK：2 × current_node=do / eligibility=ACTIONABLE_NOW / exact assignee（`global.json`）。
2. **负面证明（真实错误码如实记录）**：INVALID_DEFINITION → 500 fail-closed（svc 映射瑕疵，FOLLOW_UP_DEBT）；DRAFT_NOT_PUBLISHED → 409 `version_not_published`；UNKNOWN_ASSIGNEE → 422 `assignee_resolution_failed`；NON_ASSIGNEE_TRANSITION → 403 `principal_not_assignee`。WAITING_FOR_TIME=NOT_DISPATCHED：本 Definition 无 timed node（不适用）；DISPLAY_NAME_FALLBACK=NO（HR 回执）。
3. **飞书真实操作流**：`HR_FEISHU_TRANSCRIPT.md`（3 轮）。终轮 HR：DISPATCHED_COUNT=2，同轮各派 1 次（nodeVisitId/assignee/canonical Agent 全精确），DUPLICATE_SEND=NO、DISPLAY_NAME_FALLBACK=NO、HR_PROXY_TRANSITION=NO、派完即止不等结果。
4. **执行与自推进（verify 全绿）**：`VERIFY_RECEIPT.json`；timeline 事件链每 instance 恰 2 次 `WORKFLOW_TRANSITION_COMMITTED(ADVANCE)`：#1 创建者 start→do（bc970ced）、#2 自推进 do→done（actor==assignee：fd58881a / b21ddb23）→ `is_terminal=true`，current_node=done（`TIMELINE_A/B.json`、`VERIFY_DETAIL_A/B.json`）。svc 生产日志佐证：05:01:20Z fd58881a、05:01:40Z b21ddb23 各一次 transition POST（各自 client）。

## 飞书体验质量观察（按规格，只观察不重构）

HR 正确理解请求；只选 ACTIONABLE_NOW；每条跳过均给出理由；无多余技术输出；无"是否继续"；不等 Agent 完成。发现的问题分类：

- **MECHANICAL_FIX**：HR 指令层把 "canary" 一律视为勿派（第一轮 0 派发），需 Owner 明确授权后才派——建议 HR 运行时策略区分"可弃置安全 canary"与"危险变更"。
- **FOLLOW_UP_DEBT**：调度器详情可见性缝——全局发现面可见但 detail 仅 assignee/domain-owner（契约 §4.6 设计内），HR 派发前需成为域 owner（本次经 provisioning 门控 transfer 解决）；其余域的 404 为设计内 fail-closed，非缺陷。
- **FOLLOW_UP_DEBT**：svc 图校验失败映射 500 `internal_consistency_error` 且不给规则名（排障靠本地同款二进制二分复现，harness 留档 `deployment-artifacts/wda-production-v1-e2e-r1/local-repro/`）。
- **FOLLOW_UP_DEBT**：global_instances 每页 20 条有 next_cursor，HR 未全量扫描（本 Goal 无影响）。

## 复用与边界声明

- REUSE-FIRST 判定 A（EXISTING_PRODUCTION_CAPABILITY_SUFFICIENT）：零产品代码变更、零新 Authority、零 Grant/scope 变更（唯一授权动作 = 一次性 canary 域内的 owner transfer，provisioning 门控、双向收据化）。
- 并行 fan-out 采用规格允许的 fallback（图语义无并行分支，V6 明示排除；未为测试实现并行图语义）。
- 本 Goal 不拥有/未改动：HR 发现、workflow_global_instances、eligibility、Visit Activation、dispatch intents、Principal→Agent 解析、agent_session_send、transition、actor==assignee enforcement、Scheduler V2。
- 本地复现战（排障收据，非生产变更）：production 同款二进制 + docker scratch PG，二分定位图 JSON 双错（自环 target + H-2b required 缺失）——见 PHASE0_RECONCILIATION.md 与 local-repro/。

## FOLLOW_UP_DEBT 汇总

1. HR 运行时策略：canary 语义细分（MECHANICAL_FIX）。
2. 派发角色可见性：若 HR 需常态化派发非自建域工作，需产品决策（当前设计内 404）。
3. svc 图校验错误映射（500 → 4xx + 规则名透出）。
4. global_instances 全量扫描/翻页体验。
