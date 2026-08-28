---
spec_id: AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
status: proposed
date: 2026-08-28
type: implementation-spec (single write broker capability; NO WIP implementation exists — this Spec is the sole forward authority)
scope:
  - packages/broker 新增唯一一个写 capability manifest `workflow_transition`（任务语义：transition 提交），代理 svc-workflow 已部署端点 POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions
  - 参数面冻结：workflowInstanceId（path）+ transitionDefinitionId + expectedWorkflowStateVersion（CAS）+ submissionPayload（可选）
  - Idempotency 冻结：transport 受信区生成 Idempotency-Key（manifest `http.idempotencyKey: true`），模型不可见、不可注入
  - 错误表冻结（error-preservation 纪律同族）：declared codes only，fail-closed
  - 权限语义冻结：actor = current assignee 由 svc-workflow 服务端在原子事务内强制；broker 不复制、不放宽、不提供任何 actor/principal 参数
references:
  - svc-workflow @ 6f1f546787bd5fb1644ec91327d3e7374dc28165（main，本轮证据坐标）
  - svc-workflow/src/http/mod.rs:49-50（路由 POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions → transitions::execute）
  - svc-workflow/src/http/handlers/transitions.rs:18-44（handler：require_scope("workflow.execute") :25 + idempotency_key :26 + path_uuid :27 + command 组装 :29-39）
  - svc-workflow/src/http/handlers/mod.rs:33-48（Idempotency-Key：必填、1-128 visible ASCII、非法即 400）
  - svc-workflow/src/http/dto.rs:44-51（ExecuteWorkflowTransitionRequest：serde camelCase + deny_unknown_fields；:53-63 响应 camelCase）
  - svc-workflow/src/application/workflow_instance/execute_transition.rs:49-85（request hash → principal 预检 → 原子事务 → Executed/Replayed/ReplayedFailure 三态）
  - svc-workflow/src/store/postgres/workflow_instance_repository/transition_transaction.rs:196-202（Step 7：current_visit.assignee_principal_id != principal → 403 principal_not_assignee）；:247-310（Step 10：transition 必须属于 definition 且 source_node = 当前节点，ADVANCE/RETURN/TERMINATE 规则，否则 transition_not_applicable）
  - svc-workflow/src/domain/workflow_instance/errors.rs:478-500（全部 transition 错误码）；src/http/error.rs:153-160（409 idempotency_conflict 不透明；425 command_still_processing）
  - svc-workflow/src/application/workflow_instance/query_types.rs:163-177（OutgoingTransitionItem：transition_id/transition_key/executable_for_actor/blocked_reason/submission_schema）；:115-127（WorkflowInstanceSummary.workflow_state_version = CAS 值来源）
  - svc-workflow/src/store/postgres/workflow_instance_repository/query_detail.rs:145（executable_for_actor = blocked_reason.is_none()，读侧 per-actor 投影）
  - dsh-agent-core packages/broker/src/transport.js @ HEAD（84d71fe 一线）：:427 http.idempotencyKey 受信区生成、:440 header 附加、:470 401 重试复用同 key、:248 buildRequestHeaders allowlist、:271 createIdempotencyKey
  - dsh-agent-core packages/broker/src/schema.js @ HEAD :360-361（idempotencyKey boolean 校验）
  - dsh-agent-core packages/broker/src/capabilities/workflow.js @ HEAD :17（first-batch 明示 write surface 不在范围 → 本 Spec 是其首个受控开放）
  - docs/specs/AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1.md（proposed；错误保留/分页校验机制族）
  - docs/specs/AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1.md（proposed；同族 sibling Spec 的授权模型与文风基准）
implementation_authority: none
---

# AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1 — Assignee 流转提交能力

> 状态：**proposed**。本 Spec 当前**不授予**任何实现或 production apply 权限。
> `implementation_authority = none`、`production_apply_authority = none`。
> 本轮无 WIP 实现（与 DOMAIN_INSTANCES_BROKER_V1 不同）：accept 是实现的唯一前置。

## 0. 问题（已实证）

Agent Core broker 现有 workflow 能力面（5 个，全只读）：

- `workflow_my_tasks` / `workflow_instance_detail` / `workflow_submission_history`
  / `workflow_my_domains` / `workflow_domain_instances`（GET，scope workflow.read）

模型能**看到**自己作为 assignee 的任务与每个实例 current node 的
`outgoingTransitions[]`（含 `transition_id`、`executable_for_actor`、
`submission_schema`），但**无法提交**任何 transition——first-batch 明示将 write
surface 排除在外（capabilities/workflow.js:17）。svc-workflow 侧执行端点**已部署**
（mod.rs:49-50），且服务端授权完整（§1 R3）。缺口纯在 broker 侧：没有 manifest
暴露该端点。

P0 唯一目标：让**当前节点的 exact assignee** 通过正式 Broker 工具提交合法
transition。本 Spec 不授予 Domain Owner 代其他 assignee 操作的任何路径（服务端
本身也会拒绝，§1 R3）。

## 1. 冻结的语义（rulings）

### R1. Capability 面（唯一新增，broker 首个 workflow 写工具）

- id / toolName：`workflow_transition`（沿 `workflow_*` 命名族；即任务语言中的
  `workflow_transition`）。
- 唯一 operation：`submit`。
- http binding：`{ target: 'svc-workflow', method: 'POST',
  path: '/internal/v1/workflow-instances/{workflowInstanceId}/transitions',
  pathParams: ['workflowInstanceId'],
  body: ['transitionDefinitionId', 'expectedWorkflowStateVersion',
  'submissionPayload'], idempotencyKey: true }`。
- requiredScopes：`['workflow.execute']`（服务端 require_scope 同名，transitions.rs:25）。
- 零新机制：POST + body 绑定沿 `forum_reply` 先例；`idempotencyKey: true` 受信区
  机制已在 committed main HEAD（transport.js:427/:440/:470、schema.js:360-361），
  本 Spec 实现为**纯 manifest 数据**，不新增 transport/schema 机制。

### R2. 参数面（冻结；wire 名 = 下游 serde camelCase）

| 参数 | 必填 | 类型 | 语义与来源 |
|---|---|---|---|
| `workflowInstanceId` | 是 | string (UUID) | path 参数；实例 id |
| `transitionDefinitionId` | 是 | string (UUID) | body；= instance detail `outgoingTransitions[].transition_id`（**注意：是 UUID，不是 transition_key**——执行 API 冻结为 definition-scoped UUID，见 R2.1） |
| `expectedWorkflowStateVersion` | 是 | integer ≥ 1 | body；CAS 值 = instance detail `workflow_state_version`（query_types.rs:121） |
| `submissionPayload` | 否 | json | body；须满足该出口 `submission_schema`；出口声明必填而缺省 → 服务端 422 `submission_required` |

- **不透出 / 不接受**：任何 actor / principalId / assignee / onBehalfOf 类字段。
  Identity 只经 credential seam（transport credentialProvider → token `sub`），
  参数面物理上无该字段，模型无法注入（沿 registry.js「Identity discipline」与
  transport bindRequest 只转发 manifest 声明名的机制）。
- **不接受** `transitionKey`（string）作为执行参数：服务端执行合同冻结为
  `transition_definition_id` UUID（dto.rs:48；definition_version_id 联合定位于
  transition_transaction.rs:249-251）。`transition_key` 是读侧展示字段
  （query_types.rs:170）。R2.1 记录该偏差：任务建议字段名 `transitionKey` 不采用，
  以服务端实际 wire 合同为准。

### R3. 权限（服务端唯一权威；broker 零权限逻辑）

全部由 svc-workflow 在**同一原子事务**（instance 锁内）强制，broker 不复制、不
缓存、不放宽、不预检（读侧 `executable_for_actor` 仅是模型导航提示）：

1. scope `workflow.execute`（require_scope；不足 → 403 `forbidden`）。
2. actor = exact current assignee（transition_transaction.rs:196-202：
   `current_visit.assignee_principal_id != Some(principal_uuid)` → 403
   `principal_not_assignee`）。**Domain Owner 非 assignee 提交同样被拒**——
   「替其他 assignee 流转」在本合同下不可能发生。
3. transition 合法性：属于当前 definition_version 且 source_node = 当前节点、
   ADVANCE/RETURN/TERMINATE 语义规则（Step 10，:247-310 → 409
   `transition_not_applicable`）。
4. CAS：`expected_workflow_state_version` 不匹配 → 409
   `workflow_state_version_conflict`（body 携带 expected/actual）。
5. 附加 fail-close：`assistance_open`、`source_node_terminal`、
   `definition_version_revoked`、`definition_version_draft`、
   `invalid_return_references`、`assignee_resolution_failed`、
   `submission_required`、`submission_validation_failed`、`size_limit_exceeded`
   （1 MiB）。

Agent Client grant 侧（rollout 依赖，非本 Spec 实现面）：auth-service
`machine_access_grants`（audience `svc-workflow`）2026-08-28 实查——fleet 中仅
`agt_build-in-public-agent`（mc_ohDTyGYRpBLI4qN_sVU88aob）与 `agt_hr-agent`
（mc_IuBMfCYe9-b522IhSWKBGjyz）持有 v2 `{workflow.execute, workflow.read}`；其余
agt_* client 仅 `{workflow.read}`。无 execute grant 的 agent 调用本工具将在 token
签发处 fail-closed（HTTP capability 路径上表现为已声明的 `transport_failure`
"token acquisition failed"）。Grant 供给/变更治理属 auth-service 仓库，本 Spec
不动。

### R4. Idempotency（受信区生成；模型不可控）

- manifest 声明 `idempotencyKey: true` → transport 在受信区以
  `createIdempotencyKey(manifest.id, clock, rand)` 生成（1-128 visible ASCII，满足
  服务端合同），作为 `Idempotency-Key` header 发送（allowlist 唯一项）。
- **模型不可见、不可注入**：参数面无 key 字段；bindRequest 不转发 header；模型
  无法选择、复用或猜测他人 key。
- **一次工具调用 = 一个新 key**；broker 不跨调用复用/缓存 key。401 token 刷新
  重试复用**同一** key（transport HEAD 既有语义，服务端去重兜底）。
- 服务端 exact rerun 语义（继承，非 broker 实现）：同 key + 同 request hash →
  原样重放成功结果**或**确定性失败（execute_transition.rs:78-84 Replayed /
  ReplayedFailure）；同 key 不同 payload → 409 `idempotency_conflict`（不透明，
  不泄漏原 hash）；命令处理中 → 425 `command_still_processing`。
- **禁止 broker 自动 CAS 重试**：`workflow_state_version_conflict` 原样透出给模型
  （携带 expected/actual），由模型重读 `workflow_instance_detail` 后显式重提。
  自动重试会掩盖「transition 是否已生效」的可见性，违背 fail-closed。

### R5. 错误表（declared codes only；error-preservation 纪律同族）

`invalid_arguments`、`unsupported_operation`、`unauthenticated`、`forbidden`、
`credential_unavailable`、`binding_error`、`malformed_response`、
`transport_failure`、`service_unavailable`、`http_4xx`、`http_5xx`（transport 族
via withTransportErrors + per-capability 声明的 auth 层码）＋ transition 写族
（全部已在 svc-workflow errors.rs:478-500 + error.rs:153-160 实证）：

`principal_not_found`、`principal_disabled`、`instance_not_found`、
`current_visit_not_found`、`principal_not_assignee`、`assistance_open`、
`source_node_terminal`、`definition_version_revoked`、`definition_version_draft`、
`workflow_state_version_conflict`、`transition_not_applicable`、
`submission_required`、`submission_validation_failed`、`size_limit_exceeded`、
`invalid_return_references`、`assignee_resolution_failed`、
`idempotency_conflict`、`command_still_processing`、
`internal_consistency_error`。

语义：declared service code 优先透出（code + status + sanitized detail +
x-request-id）；undeclared → fail-closed 降级 `http_4xx`/`http_5xx`。

### R6. 返回（透传，不 reshape）

`succ { ok: true, result: <ExecuteWorkflowTransitionResponse> }`，原样透传下游
camelCase JSON：`workflowInstanceId`、`workflowStateVersion`（**流转后的新版本号**，
供下一次 CAS 链接）、`currentContextRevisionId`、`sourceNodeVisitId`、
`currentNodeVisitId`、`submissionId?`、`eventSequence`。审计/Receipt 由服务端
command receipt + submission + event 流水承载（响应字段即回执），broker 不新造
审计存储。

### R7. 写红线（本 Spec 明确不授权）

禁止经本 capability 或其实现触及：`create_instance`、cancel、revise context、
assistance、assignment 变更、Domain 变更、Definition 管理（版本发布/吊销）、
任意 GLOBAL_COORDINATOR 能力、手工 SQL。实现文件不得出现上述任何端点绑定或
写 handler；本 capability 的唯一写面 = §R1 冻结的单端点单 operation。

### R8. 模型使用合同（description 冻结要点）

工具 description 必须指引两步用法：(1) 先 `workflow_instance_detail` 读
`workflow_state_version` 与 `outgoingTransitions[]`（选择
`executable_for_actor: true` 的出口，取其 `transition_id` 与 `submission_schema`）；
(2) 以该 exact 值调用 `workflow_transition`。`executable_for_actor: false` 的出口
提交将被服务端以对应错误拒绝（`principal_not_assignee` /
`transition_not_applicable` 等）——读侧标志是提示，服务端是权威。

## 2. Exact implementation file closure（accept 后）

- `packages/broker/src/capabilities/workflow.js`：新增
  `workflowTransitionManifest`（withTransportErrors 包装）并加入 `manifests`
  导出数组；头注释的「write surface 不在范围」说明同步收窄为本工具已开放。
  纯数据，零新机制；index.js DEFAULT_MANIFESTS 自动纳入，child relay / gateway
  transport 均为既有泛型路径。
- `packages/broker/test/capabilities.test.js`：first-batch 计数 +1；新增 fixture：
  POST body camelCase 实证（transitionDefinitionId / expectedWorkflowStateVersion /
  submissionPayload）、token 请求 scope=workflow.execute、`Idempotency-Key`
  header 存在且模型参数无法注入、`principal_not_assignee` /
  `workflow_state_version_conflict`（含 expected/actual）/ `idempotency_conflict`
  错误码端到端透出、参数面无 principal 类字段（identity-neutral 断言）。

依赖叠加声明：错误保留/分页机制族来自 proposed 的
AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1（其 accept 与否不阻塞本工具——
本 manifest 在纯 main schema 上即可实现，undeclared 错误由 `http_4xx`/`http_5xx`
兜底；两者 accept 后自然叠加 detail/request-id 保留）。

## 3. 测试验收（accept 后达成）

- 全部 broker 测试 PASS（基线 + 新增 fixture）。
- schema 校验：新 manifest 过 validateManifest（method POST / body 绑定 /
  idempotencyKey boolean 合法）。
- fixture：mock svc-workflow 断言 method/path/body/header/scope 全匹配
  §R1/§R2/§R4；identity-neutral（args 携带 principalId/agentId 不达 wire）。

## 4. 边界与不授权项

- svc-workflow：**0 改动**（端点已部署；本 Spec 是 broker 侧代理合同）。
- auth-service：**0 改动**（grant 供给是 rollout 依赖，另仓治理）。
- Production：**0 改动**（无 deploy、无 restart、无 store/job 变更；实现 PR 合并
  与 production expose 是后续独立轮次）。
- 不授权：本 Spec 自身的实现（accept 前禁止开工）；create_instance / Definition
  管理等任何 R7 红线项混入；per-capability 鉴权逻辑进驻 broker；模型参数携带
  identity；broker 自动 CAS 重试。
- Merge 授权路径：本 Spec accepted → 实现按 GOVERNING_SPEC_UNMODIFIED 纪律评审
  合并（实现 PR 不得修改本文件）。

## 5. 调查结论快照（2026-08-28，本 Spec 的立项证据）

- SERVICE_API_EXISTS = YES（POST /internal/v1/workflow-instances/{id}/transitions，
  mod.rs:49-50，已部署）。
- SERVICE_AUTHORIZATION_CORRECT = YES（scope + exact-assignee + transition
  合法性 + CAS + 幂等 replay 全部服务端原子事务内强制；executable_for_actor 为
  读侧同源投影，query_detail.rs:145）。
- ACCEPTED_AUTHORITY_EXISTS = NO（全仓 18 Spec 无 accepted 覆盖 workflow 写能力；
  两个 workflow broker sibling 均 proposed）。
- BROKER 未暴露 manifest：无（registry 全量注册 5 只读工具；无隐藏 transition
  manifest；transport idempotencyKey 机制已在 committed HEAD 待用）。
