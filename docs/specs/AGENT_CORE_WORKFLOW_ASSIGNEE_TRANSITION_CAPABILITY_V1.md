---
spec_id: AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/dsh-agent-core
  - packages/broker workflow capability surface（新增唯一写工具 workflow_transition）
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1

> **PROPOSED — DOCS ONLY.** 本 Spec 在保持 proposed 期间不创建任何实现
> authority。本 authoring PR 只添加本 Spec 文件，不修改任何产品或测试文件，
> 不执行任何 runtime reload 或部署，不授予任何 workflow scope。
> `implementation_authority = none`、`PRODUCTION_APPLY_AUTHORITY = none`。

## 1. Goal

让**当前节点的 exact assignee** 能够通过正式 Broker 工具提交合法
transition。P0 唯一目标即此，不更多。

Agent 当前可用的 workflow broker 能力面（5 个，全只读）：
`workflow_my_tasks`、`workflow_my_domains`、`workflow_domain_instances`、
`workflow_instance_detail`、`workflow_submission_history`。模型能**看到**
自己作为 assignee 的任务与每实例 current node 的 `outgoingTransitions[]`
（含 `transition_id`、`executable_for_actor`、`submission_schema`），但
**无法提交**任何 transition——缺口纯在 broker 侧 manifest；svc-workflow
执行端点已部署且授权完整（§4）。

## 2. Scope and non-goals

**In scope（accept 后的实现闭包）**：
- `packages/broker/src/capabilities/workflow.js` 新增唯一写 capability
  manifest `workflow_transition`（operation `submit`）并加入 `manifests`
  导出数组——纯 manifest 数据，零新 transport/schema 机制（§4 OBS-004）。
- `packages/broker/test/capabilities.test.js`：新增 fixture（§10）。

**Non-goals（本 Spec 明确不做）**：
- 不改 svc-workflow（端点已部署；本 Spec 是 broker 侧代理合同）。
- 不改 auth-service、不授予任何 Grant——当前 fleet 仅少数 Agent 已有
  `workflow.execute`，Grant rollout 属 auth-service 独立治理（§8 DEC-005）。
- 不做 create_instance、cancel、revise context、assistance、assignment
  变更、Domain 变更、Definition 管理、任何 GLOBAL_COORDINATOR 能力、
  手工 SQL（§9 CTR-007）。
- 不做 broker 侧权限判断、不缓存权限、不放宽服务端语义（CTR-003）。
- 不含 production deploy / restart / store 变更。

## 3. Authority and dependencies

- 治理：`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0`（accepted；本 Spec
  遵循 SPEC_FORMAT_V0 / proposed→accepted 事务纪律）。
- 同族先例（均 accepted，本 Spec 复用其机制族与授权模型）：
  `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`（declared-codes-only
  错误保留 + status/detail/x-request-id 透出）、
  `AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1`（绑定已部署端点的
  broker capability 授权模型：服务端权限唯一权威、broker 零权限逻辑）。
- 外部事实坐标（evidence pin，非 spec authority）：svc-workflow
  `github/main` @ `fb54f9dfaeeec667b8ba72d56d8303390cd189a6`
  （2026-08-28，本轮在该 current-main revision 逐行验证全部 source 坐标）。
- dsh-agent-core 事实坐标：fresh main @
  `df3b299ec5ab78a2f1c944c01803a5e1caf28f85`（PR #94 合并后）。

## 4. Current State

STATE-001 — svc-workflow transition 执行端点已部署并进入正式 HTTP 合同：
`POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions`
（svc-workflow `src/http/mod.rs:49-54`，含 write canary guard；
`contracts/workflow-http/v1/contract.md` §2.2 :70；scope
`workflow.execute` + Idempotency-Key required）。

STATE-002 — dsh-agent-core broker 在 fresh main
（`df3b299`）无任何 transition manifest：`workflow.js` 注册的 5 个
workflow 工具全只读；`workflow.js:29` 注释明示 write surface
（transitions / create_instance / cancel / …）在 first-batch 范围外。

STATE-003 — 本 Spec 的全部写通道机制已在 committed main 存在（OBS-004），
accept 后实现是纯 manifest 数据 + 测试。

STATE-004 — main 测试基线：`node --test packages/broker/test/*.test.js`
@ `df3b299` = **173/173 PASS**（worktree fresh install 后实测，
2026-08-28）。

STATE-005 — sibling authority 状态：fresh main 全部 37 个 Spec 清点，
`AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1` 与
`AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1` 均 **accepted**，但
没有任何 accepted Spec 覆盖 workflow 写/transition 面——本 Spec 是该面的
首个 proposed authority。

STATE-006 — Grant 现况（auth-service 只读查询 2026-08-28，
`machine_access_grants`，audience `svc-workflow`）：fleet 中仅
`agt_build-in-public-agent`（mc_ohDTyGYRpBLI4qN_sVU88aob）与
`agt_hr-agent`（mc_IuBMfCYe9-b522IhSWKBGjyz）持有 v2
`{workflow.read, workflow.execute}`；其余 agt_* client 仅
`{workflow.read}`。无 execute grant 的 Agent 调用本工具在 token 签发处
fail-closed（HTTP capability 路径表现为已声明的 `transport_failure`
"token acquisition failed"）。

## 5. Observations

以下全部在 svc-workflow `github/main` @ `fb54f9d` 上逐行验证：

OBS-001 — 执行 handler（`src/http/handlers/transitions.rs`）：
`require_scope(&principal, "workflow.execute")` :25；`idempotency_key(&headers)`
:26；command 组装 :29-39（`expected_workflow_state_version` :36、
`transition_definition_id` :37、`submission_payload` :38）。actor 取自
`AuthenticatedPrincipal`（token），**从不取自 payload**。

OBS-002 — wire 合同（`src/http/dto.rs:45-51`）：
`ExecuteWorkflowTransitionRequest` 为 serde `rename_all = "camelCase"` +
`deny_unknown_fields`：`transitionDefinitionId: UUID`、
`expectedWorkflowStateVersion: i32`、`submissionPayload?`。响应
`:53-63`（camelCase）：`workflowInstanceId`、`workflowStateVersion`、
`currentContextRevisionId`、`sourceNodeVisitId`、`currentNodeVisitId`、
`submissionId?`、`eventSequence`。

OBS-003 — 服务端原子授权（`transition_transaction.rs`，同一 instance-lock
事务内）：Step 7 :198-202 `current_visit.assignee_principal_id !=
Some(principal_uuid)` → 403 `principal_not_assignee`；Step 10 :247-319
transition 必须属于当前 definition_version 且 source_node = 当前节点
（ADVANCE/RETURN/TERMINATE 语义规则）否则 409 `transition_not_applicable`；
CAS 不匹配 → 409 `workflow_state_version_conflict`（body 携带
expected/actual）；fail-close 族：`assistance_open`、`source_node_terminal`、
`definition_version_revoked`、`definition_version_draft`、
`submission_required`、`submission_validation_failed`、
`size_limit_exceeded`（413，1 MiB）、`invalid_return_references`、
`assignee_resolution_failed`。

OBS-004 — 幂等与 exact rerun（`execute_transition.rs` + receipt）：
request hash 覆盖 principal + key + instance + CAS + transition + payload
（:54）；同 key 同 hash → `Replayed` 原样重放成功结果**或**
`ReplayedFailure` 重放确定性失败（:81）；同 key 不同 payload → 409
`idempotency_conflict`（不透明，error.rs:223-225）；处理中 → 425
`command_still_processing`（error.rs:226-230）。Idempotency-Key header 合同：
必填、1-128 visible ASCII（`handlers/mod.rs:33-59`）。

OBS-005 — 读侧 per-actor 投影：`workflow_instance_detail` 已暴露
`workflow_state_version`（query_types.rs:121，CAS 值来源）与
`outgoingTransitions[]`（:169 `transition_id`、:175
`executable_for_actor`、`submission_schema`、`blocked_reason`）；
`executable_for_actor = blocked_reason.is_none()`（query_detail.rs:145），
blocked 原因族：ActorNotCurrentAssignee / CurrentNodeTerminal /
DefinitionVersionRevoked / DefinitionVersionDraft / AdvanceNotPrimary /
TargetAssigneeUnavailable——与执行侧检查同源，服务端是权威。

OBS-006 — dsh-agent-core broker 写通道机制（fresh main `df3b299`
committed 源逐行验证；transport revision
`c99d76ecb4461a3e4c656a10d91d1a147c9d66c0`，schema current revision
`3dae32ed9ee84fc36d4c94b8862ec9fcc3db20da`）：manifest
`http.idempotencyKey` boolean（schema.js:408-410）→ transport 受信区生成 key（transport.js:626，
`createIdempotencyKey` :470，模型不可控）→ `Idempotency-Key` 经
allowlist 转发（:639，`ALLOWED_REQUEST_HEADERS` :63，
`buildRequestHeaders` :447）→ 401 retry **复用同 key**（:669，仅 GET 与
idempotency-keyed 写重试）；POST + JSON body 绑定（`forum_reply` 先例）。

OBS-007 — 稳定错误码合同：svc-workflow
`contracts/workflow-http/v1/errors.json` 已将本工具所需的全部写族错误
登记为 stable codes（403 `principal_not_assignee`；409
`idempotency_conflict` / `workflow_state_version_conflict` /
`transition_not_applicable` / `assistance_open` / `source_node_terminal` /
`definition_version_revoked`；404 `instance_not_found` /
`current_visit_not_found` / `principal_not_found`；413
`size_limit_exceeded`；422 `submission_required` /
`submission_validation_failed` / `invalid_return_references` /
`assignee_resolution_failed`；425 `command_still_processing`；500
`internal_consistency_error`）。

## 6. Claims and assumptions

CLM-001 — 本 Spec accept 后，exact assignee 无需任何新服务端/Grant 变更
即可经 `workflow_transition` 提交合法 transition（前提：该 Agent 的
client 已有 `workflow.execute` grant，STATE-006）。

CLM-002 — 非 assignee（含 Domain Owner）经本工具提交会被服务端拒绝
（OBS-003 Step 7）；broker 参数面无 actor 字段，模型无法伪造身份
（CTR-002 + identity seam）。

ASM-001 — svc-workflow transition 端点合同保持向后兼容
（`workflow-http/v1` 合同的 stable-codes 纪律）；若未来破坏性变更，
需回本 Spec 走 AMEND。

ASM-002 — auth-service grant rollout 独立推进；本 Spec 不假设任何特定
Agent 获得新 grant。

## 7. Evidence relations

EVD-001 — STATE-001/OBS-001..004/OBS-007 支撑 CLM-001：服务端 API、
授权、CAS、幂等 replay 全部已部署并进入正式合同（source 坐标 §5）。

EVD-002 — OBS-003 Step 7 + CTR-002 参数面支撑 CLM-002：服务端
current-assignee 原子检查以 token principal 为准，payload 无 actor 字段。

EVD-003 — STATE-002/STATE-003/OBS-006 支撑 §9 CTR-001 的「纯 manifest
数据实现」论断：全部机制在 committed main，无新 transport/schema 机制。

EVD-004 — STATE-005 支撑本 Spec 的 authority 必要性：无 accepted Spec
覆盖 workflow 写面，per AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0 实现
被禁止直至本 Spec accepted。

## 8. Decisions

DEC-001 — 执行参数采用 **`transitionDefinitionId`（definition-scoped
UUID）**而非任务建议的 `transitionKey`：执行 API 冻结为 UUID 定位
（dto.rs:48；transition 定义按 definition_version 定位，
transition_transaction.rs Step 10），`transition_key` 是读侧展示字段
（query_types.rs:170）。工具描述引导模型从
`outgoingTransitions[].transition_id` 取值（CTR-008）。

DEC-002 — broker 执行**零权限逻辑**：不复制 assignee 判断、不缓存
`executable_for_actor`、不预检。读侧标志仅是模型导航提示；服务端是
唯一权威（同 DOMAIN_INSTANCES_BROKER_V1 授权模型）。

DEC-003 — Idempotency-Key 由 trusted Broker seam 生成
（manifest `http.idempotencyKey: true` → transport 受信区），模型不能
传入、覆盖或看到；401 retry 复用相同 key（OBS-006 既有语义）。一次
工具调用 = 一个新 key；broker 不跨调用复用 key。

DEC-004 — **禁止 broker 自动 CAS 重试**：`workflow_state_version_conflict`
原样透出（含 expected/actual），由模型重读 `workflow_instance_detail`
后显式重提。自动重试会掩盖「transition 是否已生效」的可见性，违背
fail-closed。

DEC-005 — Grant 不动：本 Spec 及其实现 PR 不授予、不申请、不修改任何
`workflow.execute` grant（auth-service 独立治理）；无 grant 的 Agent
fail-closed（STATE-006）。

DEC-006 — 错误表遵循 accepted 的 error-preservation 纪律：declared
service code 优先（code + status + sanitized detail + x-request-id）；
undeclared → fail-closed 降级 `http_4xx`/`http_5xx`。

## 9. Contracts

CTR-001 — **Capability 面（唯一新增）**。id / toolName =
`workflow_transition`；唯一 operation = `submit`；http binding =
`{ target: 'svc-workflow', method: 'POST',
path: '/internal/v1/workflow-instances/{workflowInstanceId}/transitions',
pathParams: ['workflowInstanceId'],
body: ['transitionDefinitionId', 'expectedWorkflowStateVersion',
'submissionPayload'], idempotencyKey: true }`；requiredScopes =
`['workflow.execute']`。零新机制（EVD-003）。

CTR-002 — **参数面（冻结；wire 名 = 下游 serde camelCase）**：
`workflowInstanceId`（必填，string UUID，path）；
`transitionDefinitionId`（必填，string UUID，body；= instance detail
`outgoingTransitions[].transition_id`）；
`expectedWorkflowStateVersion`（必填，integer ≥ 1，body；CAS 值 =
detail `workflow_state_version`）；`submissionPayload`（可选，json，
body；须满足该出口 `submission_schema`，缺省必填时服务端 422
`submission_required`）。**不接受也不透出**任何 actor / principalId /
assignee / onBehalfOf 类字段——identity 只经 credential seam（token
`sub`），bindRequest 物理上只转发 manifest 声明名。

CTR-003 — **服务端唯一权威**。全部强制在 svc-workflow 原子事务内：
scope `workflow.execute`；actor = exact current assignee（token 派生，
payload 永不参与）；transition 合法性（definition 成员 + source_node =
当前节点 + ADVANCE/RETURN/TERMINATE 规则）；CAS；
`executable_for_actor=true` 由服务端 blocked-reason 族保证
（ActorNotCurrentAssignee 等任一命中即拒）。**Domain Owner 替其他
assignee 提交不可能发生**（Step 7 拒绝非 assignee principal）。

CTR-004 — **Idempotency**。trusted seam 生成（DEC-003）；模型不可传入
或覆盖；401 retry 复用相同 key；服务端 exact replay + deterministic
failure replay（OBS-004）；`idempotency_conflict`（同 key 异 payload）
与 `command_still_processing`（425）原样透出。无 broker 自动 CAS 重试
（DEC-004）。

CTR-005 — **declared 错误表（fail-closed）**。
`invalid_arguments`、`unsupported_operation`、`unauthenticated`、
`forbidden`、`credential_unavailable`、`binding_error`、
`malformed_response`、`transport_failure`、`service_unavailable`、
`http_4xx`、`http_5xx`（transport 族 via withTransportErrors +
per-capability 声明的 auth 层码）＋ 写族（OBS-007 stable codes）：
`principal_not_found`、`principal_disabled`、`instance_not_found`、
`current_visit_not_found`、`principal_not_assignee`、`assistance_open`、
`source_node_terminal`、`definition_version_revoked`、
`definition_version_draft`、`workflow_state_version_conflict`、
`transition_not_applicable`、`submission_required`、
`submission_validation_failed`、`size_limit_exceeded`、
`invalid_return_references`、`assignee_resolution_failed`、
`idempotency_conflict`、`command_still_processing`、
`internal_consistency_error`。

CTR-006 — **返回透传，不 reshape**。succ =
`{ ok: true, result: <ExecuteWorkflowTransitionResponse> }` 原样（OBS-002
camelCase 字段）；`workflowStateVersion` 是**流转后的新版本号**，供下一次
CAS 链接。审计/Receipt 由服务端 command receipt + submission + event
流水承载（响应字段即回执），broker 不新造审计存储。

CTR-007 — **写红线**。禁止经本 capability 或其实现触及：
`create_instance`、cancel、revise context、assistance、assignment 变更、
Domain 变更、Definition 管理（版本发布/吊销）、任意 Coordinator 权限、
手工 SQL、principalId/actor override。实现文件不得出现上述任何端点绑定
或写 handler；唯一写面 = CTR-001 冻结的单端点单 operation。本 Spec 与其
实现 PR 亦不得顺手修改任何 Grant（DEC-005）。

CTR-008 — **模型使用合同（冻结进工具 description）**。两步用法：
(1) `workflow_instance_detail` 读 `workflow_state_version` 与
`outgoingTransitions[]`，选择 `executable_for_actor: true` 的出口，取其
`transition_id` 与 `submission_schema`；(2) 以该 exact 值调用
`workflow_transition`。`executable_for_actor: false` 的出口提交将被
服务端以对应错误拒绝——读侧标志是提示，服务端是权威。

## 10. Acceptance

ACC-001 — 本 Spec 自身：docs-only authoring PR，exactly 1 commit /
1 Spec 文件；base = current main；governance（vendored bytes + adoption
lock）、structure（verify:structure vs origin/main）、
`git diff --check`、frontmatter schema 校验全部 PASS；无产品代码、无
Grant、无 production 变更。

ACC-002 —（accept 后，实现轮验收）新增 manifest 过 `validateManifest`
（method POST / body 绑定 / `idempotencyKey: true` boolean）；fixture
断言：POST path/body camelCase（`transitionDefinitionId` /
`expectedWorkflowStateVersion` / `submissionPayload`）、token 请求
scope = `workflow.execute`、`Idempotency-Key` header 存在且模型参数无法
注入、`principal_not_assignee` / `workflow_state_version_conflict`（含
expected/actual）/ `idempotency_conflict` 错误码端到端透出、
identity-neutral（args 携带 principalId/agentId 不达 wire）；broker
测试全绿（基线 173 + 新增）。

ACC-003 —（accept 后）GOVERNING_SPEC_UNMODIFIED：实现 PR 不得修改本
文件。

## 11. Alternatives and disposition

ALT-001 — 执行参数用 `transitionKey`（string）：**否决**（DEC-001）——
执行 API 冻结为 definition-scoped UUID，key 非唯一定位。
ALT-002 — broker 侧预检 `executable_for_actor` 并本地拦截：**否决**
（DEC-002）——复制权限判断即引入第二权威；服务端原子检查已足够。
ALT-003 — broker 自动 CAS 重试：**否决**（DEC-004）——掩盖生效可见性。
ALT-004 — 本 PR 顺手为 fleet Agent 授 `workflow.execute` grant：**否决**
（DEC-005）——Grant rollout 属 auth-service 独立治理。
ALT-005 — 模型传入 Idempotency-Key 以支持显式 rerun：**否决**（DEC-003）
——key 注入面即重放攻击面；exact rerun 是服务端 key 域内语义。

## 12. Migration, compatibility, and rollback

Not applicable（新增只增不改：新 manifest 独立注册，不触碰既有 5 个只读
工具的任何行为；无数据、无 store、无部署迁移。实现 PR 合并与 production
expose 是 accept 后的独立轮次，回滚 = 移除该 manifest 注册）。

## 13. Open questions

OQ-001 — fleet Grant rollout 的节奏与范围（哪些 Agent 应获
`workflow.execute`）由 auth-service 独立治理决定；本 Spec 不预设答案。
OQ-002 — 若未来出现「模型需要显式 rerun 同一 transition」的产品需求，
须回本 Spec AMEND 引入受控 rerun 语义（当前仅服务端 key 域内 exact
replay，DEC-003）。

## 14. Authoring result

- 本轮 = CLEAN_DOCS_PR_DELIVERY：从 fresh main（`df3b299`，PR #94
  合并后）独立 worktree 交付；承接本地 commit `7a6f5e3`（旧 WIP 分支，
  未 push）的本 Spec 内容，按 SPEC_FORMAT_V0 重排为 13 章节结构并**仅做
  事实坐标同步**（sibling 状态 proposed→accepted、行号漂移、Spec 总数、
  svc-workflow 证据坐标升级为 current `github/main @ fb54f9d`、
  测试基线 173/173、frontmatter 对齐 schema）。
  **P0 合同零变化**：工具名、端点、请求字段、Idempotency-Key 三条、
  必须/禁止清单与 `7a6f5e3` 冻结语义一致。
- FILES_CHANGED = 1（本文件）；PRODUCT_CODE_CHANGE = NONE；
  GRANT_CHANGE = NONE；PRODUCTION_CHANGE = NONE。
- 验证：governance（`verify_governance.py --target . --require-accepted`）
  PASS；`verify:structure`（vs origin/main）PASS；`git diff --check`
  PASS；frontmatter 过 `spec-frontmatter.schema.json`。
- 下一事务：独立 review（流转 审计）→ accepted 后实现轮（ACC-002/003）。
