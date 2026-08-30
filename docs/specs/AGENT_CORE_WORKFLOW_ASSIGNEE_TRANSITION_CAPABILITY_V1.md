---
spec_id: AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
status: accepted
accepted_date: 2026-08-29
accepted_by: mayf3
accepted_at: 2026-08-29T07:25:51Z
accepted_reviewed_head: 90d414d19f0e3e03810c7ef68cd1bce27819c83e
independent_review_result: PASS
independent_review_blockers: NONE
acceptance_verdict: READY_FOR_ACCEPTANCE_FINALIZE
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
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

> **ACCEPTED（2026-08-29，lifecycle-only acceptance finalize）。** 独立复审绑定
> `90d414d19f0e3e03810c7ef68cd1bce27819c83e`：PASS / BLOCKERS = NONE /
> READY_FOR_ACCEPTANCE_FINALIZE = YES。此次 acceptance 仅变更 lifecycle 与
> provenance，不修改 reviewed semantics；`implementation_authority = none`、
> `PRODUCTION_APPLY_AUTHORITY = none`，因此 acceptance 本身不授权产品实现、
> runtime reload、部署或任何 workflow Grant 变更。

> **REVISE AMENDMENT 2026-08-29（流转 修订）**：按独立审计 REVISE 结论与
> Owner 路线 KEEP_MANIFEST_ONLY_ERROR_ENVELOPE 完成三项 focused fix——
> (1) CAS 错误合同去结构化（信封四要素，OBS-008）；(2)
> `executable_for_actor` 分类冻结 ADVISORY_ONLY（读时 advisory snapshot，
> 三项已知差异）；(3) 错误表移除 `definition_version_draft`（HTTP 层映射
> 500 `internal_consistency_error`）。修订明细与验证见 §15；status 仍为
> proposed，接受仍需独立审计轮。

> **FOCUSED AMENDMENT 2026-08-29（流转 联动 修订，本轮）**：按 shared
> decomposition（PR #107，
> `AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1` §8 步骤 3）对本
> accepted Spec 做 focused in-place amendment，共三项——(1) 实现闭包的测试
> 落点自未登记 legacy 聚合测试文件迁至 decomposition DEC-006 冻结的
> dedicated home
> `packages/broker/test/capabilities/workflow-transition.test.js`（该聚合
> 文件即 pinned 8-path 的 D 行，任何 touch 都触发
> `UNREGISTERED_LEGACY_TOUCHED` 结构死锁）；(2) 新增 aggregate inventory
> 计数授权 14→15（唯一落点 `manifest-inventory.test.js`）；(3) 冻结
> `implementation_authority: none → contracts` 的授权方案（§17 AMEND-3）。
> 产品合同零变化（DEC-001..006、CTR-001..008、§9 写红线、§10 验收语义
> 全部不变）；本修订轮不改 lifecycle 字段——`status` 仍 accepted、
> `implementation_authority` 仍 none，直至 §17 授权方案的 gate 事务。
> 修订明细与验证见 §17。
>
> **AUTHORITY FLIP（2026-08-30，联动 执行 / COORDINATED_ACCEPTANCE_AND_MERGE
> step 4/4）。** 按 §17 AMEND-3 授权方案的 gate 事务：`implementation_authority:
> none -> contracts` 生效（`status` 保持 accepted；`PRODUCTION_APPLY_AUTHORITY`
> 保持 none）。reviewed head = focused-amendment head
> `d1bc0f5b4e56d0eff6a4f14c7a955c4845d1101c`（fresh fetch 核对无漂移）+ 本 flip
> commit。AMEND-3 步骤 2 的独立审计 gate 按 Owner 编排以直接 coordination
> acceptance 执行（Owner-directed；§18 如实记录，不声明任何独立审计 verdict）。
> 实现前置不变：分解 spec 已 accepted 并 merged（PR #107 merge `1fc3ad6`）——dedicated
> home `workflow-transition.test.js` 由拆测 执行 轮创建。完整记录见 §18。

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

**In scope（accept 后的实现闭包；2026-08-29 流转 联动 修订后，见 §17）**：
- `packages/broker/src/capabilities/workflow.js` 新增唯一写 capability
  manifest `workflow_transition`（operation `submit`）并加入 `manifests`
  导出数组——纯 manifest 数据，零新 transport/schema 机制（§4 OBS-004）。
- `packages/broker/test/capabilities/workflow-transition.test.js`：新增
  fixture（§10）——shared decomposition（PR #107）DEC-006 冻结的 dedicated
  home：该文件由 decomposition 8-path 实现创建并先承接 generic
  transition-shaped idempotency fixture，本能力的正式 fixture **只追加**
  该职责，不另建文件。
- `packages/broker/test/capabilities/manifest-inventory.test.js`：aggregate
  manifest 计数断言 **14→15** 的唯一调整点（decomposition DEC-003 冻结该
  文件为 aggregate inventory 唯一 owner；三 spec 联动协调序：13
  →Global Instances V2→ 14 →本 Spec→ 15；Domain Pagination V2 不改变计数）。

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
（ADVANCE/RETURN/TERMINATE 语义规则；ADVANCE 合法性依赖实例 semantics
模式——Legacy(1) 仅 primary ADVANCE、Minimal(2) 任意合法出口 ADVANCE，
:261-266）否则 409 `transition_not_applicable`；CAS 不匹配 → 409
`workflow_state_version_conflict`（**服务端** body 经 `with_details`
携带结构化 `{expected, actual}`，error.rs:200-204——该结构只存在于下游
响应体，Broker 正式错误信封不保留它，OBS-008）；HTTP fail-close 族：
`assistance_open`、`source_node_terminal`、`definition_version_revoked`、
`submission_required`、`submission_validation_failed`、
`size_limit_exceeded`（413，1 MiB）、`invalid_return_references`、
`assignee_resolution_failed`。DRAFT / DEPRECATED definition version 在
domain 层 fail-close，但 HTTP 层映射为 500 `internal_consistency_error`
（error.rs:196-197）——`definition_version_draft` **不会作为 HTTP
service code 返回**，不进入 CTR-005 错误表。

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
TargetAssigneeUnavailable。该投影是**读时 advisory snapshot**，与执行侧
检查**不同源、不等价**，已知差异至少三项：(1) 投影不含 `assistance_open`
检查（blocked 链 query_detail.rs:112-135 无该项，执行侧会 fail-close）；
(2) 投影无条件 block 非 primary ADVANCE（:124-126），而执行侧 Minimal(2)
模式允许任意合法出口 ADVANCE（transition_transaction.rs:261-266）——投影
false 不代表执行侧必然拒绝；(3) 详情读取与执行之间状态可变（TOCTOU）。
因此 `executable_for_actor` 只用于 UI/Agent 预判（DEC-002），投影 true 不
构成执行授权或成功保证——服务端执行事务始终是唯一权威（CTR-003）。

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

OBS-008 — Broker 正式错误信封（accepted ERROR_PRESERVATION 纪律，
committed main `df3b299` 机制逐行验证）：transport 只从下游错误体提取
`code` 与**字符串** `message`（`parseServiceErrorBody` 仅认
`message`/`error`/`detail` 字符串键，transport.js:370-395）；`detail` 是
sanitized 字符串（脱敏 + 截断，:346-356、:429-434）；`requestId` 只来自
下游 `x-request-id` 响应头（:405-410）。下游结构化 `details` 对象（如 CAS
conflict 的 `{expected, actual}`）**不在提取面内、不进入 Broker 信封**；
若要端到端保留结构化 error.details，须扩展
transport/mapping/relay/schema 通用机制——Owner 路线
KEEP_MANIFEST_ONLY_ERROR_ENVELOPE 明确不做（§15）。CAS 冲突恢复路径 =
客户端收到 `workflow_state_version_conflict` 后重新调用
`workflow_instance_detail` 获取最新 `workflow_state_version`（DEC-004）。

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
`executable_for_actor`、不预检。`executable_for_actor` 分类冻结为
**ADVISORY_ONLY**：读时 advisory snapshot，只用于 UI/Agent 预判与导航，
不构成执行授权、不等价于执行侧合法性、不完整保证可执行（OBS-005 三项
已知差异）。即使投影 `true`，服务端仍可合法返回 fail-closed 错误；即使
投影 `false` 或过时，Broker 也不得绕过服务端自行决定可执行性。服务端
执行事务始终是唯一权威（同 DOMAIN_INSTANCES_BROKER_V1 授权模型）。

DEC-003 — Idempotency-Key 由 trusted Broker seam 生成
（manifest `http.idempotencyKey: true` → transport 受信区），模型不能
传入、覆盖或看到；401 retry 复用相同 key（OBS-006 既有语义）。一次
工具调用 = 一个新 key；broker 不跨调用复用 key。

DEC-004 — **禁止 broker 自动 CAS 重试**：`workflow_state_version_conflict`
按 Broker 正式错误信封透出（code + HTTP status + sanitized detail +
downstream requestId；结构化 expected/actual 不保留，OBS-008），由模型
重读 `workflow_instance_detail` 获取最新 `workflow_state_version` 后显式
重提。自动重试会掩盖「transition 是否已生效」的可见性，违背
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
当前节点 + ADVANCE/RETURN/TERMINATE 规则）；CAS。`executable_for_actor`
是读时 advisory snapshot（ADVISORY_ONLY，DEC-002 / OBS-005）：它不由执行
侧检查保证，也不保证执行必过——执行侧合法性只在执行事务内裁决，即使
投影 `true` 服务端仍可合法返回 fail-closed 错误；投影 `false`/过时亦不
授权 Broker 本地拦截。**Domain Owner 替其他 assignee 提交不可能发生**
（Step 7 拒绝非 assignee principal）。

CTR-004 — **Idempotency**。trusted seam 生成（DEC-003）；模型不可传入
或覆盖；401 retry 复用相同 key；服务端 exact replay + deterministic
failure replay（OBS-004）；`idempotency_conflict`（同 key 异 payload）
与 `command_still_processing`（425）原样透出。无 broker 自动 CAS 重试
（DEC-004）。

CTR-005 — **declared 错误表（fail-closed）**。错误信封保持 manifest-only
（code + HTTP status + sanitized detail + downstream requestId，OBS-008），
本 Spec 不要求、也不声称 Broker 保留结构化 error.details（Owner 路线
KEEP_MANIFEST_ONLY_ERROR_ENVELOPE，§15）。
`invalid_arguments`、`unsupported_operation`、`unauthenticated`、
`forbidden`、`credential_unavailable`、`binding_error`、
`malformed_response`、`transport_failure`、`service_unavailable`、
`http_4xx`、`http_5xx`（transport 族 via withTransportErrors +
per-capability 声明的 auth 层码）＋ 写族（OBS-007 stable codes）：
`principal_not_found`、`principal_disabled`、`instance_not_found`、
`current_visit_not_found`、`principal_not_assignee`、`assistance_open`、
`source_node_terminal`、`definition_version_revoked`、
`workflow_state_version_conflict`、`transition_not_applicable`、
`submission_required`、`submission_validation_failed`、
`size_limit_exceeded`、`invalid_return_references`、
`assignee_resolution_failed`、`idempotency_conflict`、
`command_still_processing`、`internal_consistency_error`。
（`definition_version_draft` 不在表内：DRAFT / DEPRECATED definition
version 在 HTTP 层映射为 500 `internal_consistency_error`，不作为 HTTP
service code 返回——OBS-003 / OBS-007，与本表一致。）

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
`outgoingTransitions[]`，以 `executable_for_actor: true` 的出口为优先
预判，取其 `transition_id` 与 `submission_schema`；(2) 以该 exact 值调用
`workflow_transition`。`executable_for_actor` 是读时 advisory snapshot
（ADVISORY_ONLY，DEC-002）：投影 `true` 不保证执行必过（OBS-005 三项已知
差异——投影不含 `assistance_open`、Minimal(2) 非 primary ADVANCE 读/执行
分歧、读取后状态可变——任一命中时服务端仍合法 fail-close）；投影
`false`/过时亦不授权 Broker 本地拦截。收到
`workflow_state_version_conflict` 时，重读 `workflow_instance_detail`
取最新 `workflow_state_version` 后显式重提（DEC-004）。

## 10. Acceptance

ACC-001 — 本 Spec 自身：docs-only authoring PR，exactly 1 commit /
1 Spec 文件；base = current main；governance（vendored bytes + adoption
lock）、structure（verify:structure vs origin/main）、
`git diff --check`、frontmatter schema 校验全部 PASS；无产品代码、无
Grant、无 production 变更。（2026-08-29 REVISE 修订在同一 PR 追加第二个
commit，仍只改本文件，验证同等执行——见 §15。）

ACC-002 —（accept 后，实现轮验收）新增 manifest 过 `validateManifest`
（method POST / body 绑定 / `idempotencyKey: true` boolean）；fixture
断言：POST path/body camelCase（`transitionDefinitionId` /
`expectedWorkflowStateVersion` / `submissionPayload`）、token 请求
scope = `workflow.execute`、`Idempotency-Key` header 存在且模型参数无法
注入、`principal_not_assignee` / `workflow_state_version_conflict` /
`idempotency_conflict` 错误按正式信封端到端透出（code + HTTP status +
sanitized detail + requestId；**不**断言结构化 expected/actual——信封不
保留 error.details，OBS-008）、identity-neutral（args 携带
principalId/agentId 不达 wire）；broker 测试全绿（基线 173 + 新增）。

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

## 15. Amendment record (2026-08-29, 流转 修订)

- 事务：TASK_NAME = 流转 执行，TASK_TYPE = SAFE_REMOTE_RECONCILIATION；
  OLD_REMOTE_HEAD = `fa59f9056223f9f5fcf25577b3e532b21c08fe74`；
  LOCAL_FIX_COMMIT = `2f210c6a2798f6c9c479dc1212fec153c430b68e`（base
  `eb20d0c1863002d845486990e7b3fc69319919f5`）。本轮保留 OLD_REMOTE_HEAD
  已有事实同步，仅机械重放三项 focused fix。独立审计（流转 审计）=
  **REVISE**：ASSIGNEE_AUTHORIZATION /
  IDEMPOTENCY_MODEL / GRANT_BOUNDARY 全 PASS，BLOCKERS = 1、
  REQUIRED_FIXES = 3。Owner 路线 = **KEEP_MANIFEST_ONLY_ERROR_ENVELOPE**：
  不扩展 transport/mapping/relay/schema 支持结构化 error.details——当前
  Broker 正式错误信封只保证 code、HTTP status、sanitized string detail、
  requestId；客户端收到 `workflow_state_version_conflict` 后重新调用
  `workflow_instance_detail` 获取最新状态。
- **Fix 1（CAS 错误合同）**：删除「`workflow_state_version_conflict` 必须
  端到端保留 expected/actual」的全部冻结要求（原 OBS-003 括注、原
  DEC-004、原 ACC-002 fixture）；改为必须保留 code + HTTP status +
  sanitized message/detail + downstream request-id；新增 OBS-008 记录信封
  机制事实（`parseServiceErrorBody` 仅提取字符串 message，结构化 details
  不进信封）；任何文本不再声称 Broker 保留 structured error.details。
  实现闭包保持 manifest + tests，不扩大通用 Broker 机制（§2 不变）。
- **Fix 2（executable_for_actor）**：删除「与执行侧检查同源/等价/保证
  可执行」声称（原 OBS-005、原 CTR-003 blocked-reason 保证句）；分类冻结
  **ADVISORY_ONLY**——读时 advisory snapshot，只用于 UI/Agent 预判，不
  构成执行授权（DEC-002）；记录三项已知差异（OBS-005）：(1) 投影不含
  `assistance_open`；(2) Minimal(2) 非 primary ADVANCE 读侧/执行侧判断
  存在差异；(3) 详情读取后、执行前状态可变。即使投影 true，服务端仍可
  合法返回 fail-closed 错误；即使投影 false/过时，Broker 不得绕过服务端
  自行决定可执行性（CTR-003 / CTR-008）。
- **Fix 3（错误表）**：`definition_version_draft` 自 CTR-005 错误表移除
  ——DRAFT / DEPRECATED definition version 在当前 HTTP 层映射为 500
  `internal_consistency_error`（svc-workflow current `github/main @ fb54f9d`，
  error.rs:196-197 复核），
  不会作为 HTTP service code 返回；OBS-003 fail-close 族同步修正；OBS-007
  stable errors registry（errors.json）本就无此码，与服务端实际实现一致。
  读侧 `DefinitionVersionDraft`（OBS-005 blocked-reason 枚举）是投影面
  事实，保留不动。
- **保持不变**（审计「保持不变」节）：工具 `workflow_transition`、端点
  `POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions`、
  参数面（`workflowInstanceId` / `transitionDefinitionId` /
  `expectedWorkflowStateVersion` / `submissionPayload` 可选）、scope
  `workflow.execute`、actor 仅来自 token、服务端 current-assignee 权威 +
  transition legality + CAS + idempotency + exact replay + deterministic
  failure replay + conflict fail-closed、Idempotency-Key trusted Broker 生成
  模型不可覆盖 + 401 retry 复用同 key、全部禁止清单（actor/principal
  override、Domain Owner 替别人提交、assignment mutation、create_instance、
  Definition management、Coordinator、手工 SQL、Grant change——CTR-002 /
  CTR-007 / DEC-003 / DEC-005）。
- 本轮边界：只修改本 Spec 文件；不实现代码、不接受、不 merge、不授
  Grant、不部署。验证（实测）：`verify_governance.py --target .
  --require-accepted` PASS；`npm run verify:structure`（vs origin/main）
  exit 0（仅预先存在的 FILE_WARNING_LINES WARNING）；frontmatter 过
  `spec-frontmatter.schema.json`（status 仍 proposed、
  implementation_authority 仍 none）；`git diff --check` PASS；Contract /
  Acceptance 条目覆盖扫描 PASS；dangling 引用扫描 PASS；残留扫描
  （expected/actual、definition_version_draft、同源）仅否定/映射/废弃
  注记。
- 冻结字段：STRUCTURED_ERROR_DETAILS_REQUIRED = NO；
  EXECUTABLE_FOR_ACTOR_CLASSIFICATION = ADVISORY_ONLY；
  DEFINITION_VERSION_DRAFT_REMOVED = YES；IMPLEMENTATION_CLOSURE =
  MANIFEST_PLUS_TESTS；OTHER_SEMANTIC_DELTA = NONE；PRODUCT_CODE_CHANGE =
  NONE；GRANT_CHANGE = NONE；PRODUCTION_CHANGE = NONE。接受（proposed →
  accepted）仍需独立审计轮 VERDICT，本轮不做。
- 下一事务：独立 review（流转 审计）→ accepted 后重新执行 implementation-authority gate。

## 16. Acceptance record (2026-08-29)

- REVIEWED_HEAD = `90d414d19f0e3e03810c7ef68cd1bce27819c83e`。
- 流转 审计 = PASS；BLOCKERS = NONE；READY_FOR_ACCEPTANCE_FINALIZE = YES。
- STRUCTURED_ERROR_DETAILS_REQUIRED = NO。
- EXECUTABLE_FOR_ACTOR_CLASSIFICATION = ADVISORY_ONLY。
- DEFINITION_VERSION_DRAFT_REMOVED = YES。
- IMPLEMENTATION_CLOSURE = MANIFEST_PLUS_TESTS。
- SEMANTIC_CHANGE_FROM_REVIEWED_HEAD = NONE；本 transaction 仅写入
  accepted lifecycle mirror 与 review provenance。
- `implementation_authority = none` 与 `PRODUCTION_APPLY_AUTHORITY = none`
  均保持 reviewed value 不变；因此本 acceptance 不自行授予产品实现或部署权限。
- PRODUCT_CODE_CHANGE = NONE；GRANT_CHANGE = NONE；PRODUCTION_CHANGE = NONE。

## 17. Amendment record (2026-08-29, 流转 联动 修订)

- 事务：TASK_NAME = 联动 执行（PR 3/3：Transition focused amendment）；
  TASK_TYPE = DOCS_ONLY_THREE_SPEC_COORDINATION；base = current main
  `f54679cb1a9cb9fe5e4ca38b9b354a5d25ef6221`（fresh-main 独立 worktree）；
  ONE commit / ONE file（本文件）。姊妹协调 PR（同轮 authoring、各自独立
  审计与 acceptance）：Global Instances V2 successor
  （`AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2`）与 Domain
  Pagination V2 successor
  （`AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V2`）。
- 动机（decomposition §8 步骤 3 的明文要求）：本 Spec §2 原把实现 fixture
  冻结在 744 行、未登记 structure-registry 的 legacy 聚合测试文件
  （`capabilities.test.js`）——active `CODE_STRUCTURE_GUARDRAILS_V1` 的机械
  语义 = 该文件只要被触及且 registry 无 entry 即报
  `UNREGISTERED_LEGACY_TOUCHED`，净增/净零/净减均不改判——因此本能力的任何
  实现都会被结构性死锁（PR #101/#102 同文件同 violation class 的已实测
  复现）。shared decomposition（PR #107）已裁决唯一出路，并把 Transition 的
  dedicated home 冻结为其 exact 8-path 闭包的成员（唯一一个由 decomposition
  本身创建、先承接 generic transition-shaped idempotency fixture 的 home）。

### 8-path decomposition pin（逐字冻结）

本修订 pin dsh-agent-core PR #107（branch
`docs/broker-capabilities-shared-decomposition-spec`，authoring-round reviewed
head `deda45d87635c577be37d6402ba1c26c8a483428`，
`AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1` §5）的 exact 8-path
实现闭包：

```text
D packages/broker/test/capabilities.test.js
A packages/broker/test-support/capability-fixtures.js
A packages/broker/test/capabilities/manifest-inventory.test.js
A packages/broker/test/capabilities/forum.test.js
A packages/broker/test/capabilities/okr.test.js
A packages/broker/test/capabilities/workflow-instances.test.js
A packages/broker/test/capabilities/workflow-my-tasks.test.js
A packages/broker/test/capabilities/workflow-transition.test.js
```

本修订不实现、不修改、不预先创建上述任何 path。本文件（含 §17 修订记录）
中该聚合文件的字面路径只出现于非授权语境——上述 pin 的 D 行、本节动机段的
死锁事实描述、AMEND-1 对被替换旧条目的修订对照引用、以及负面禁止纪律
（本轮边界、AMEND-3 失败语义）——零处作为实现落点；§2 In-scope 已不再
包含该路径（修订前的唯一落点引用已由 AMEND-1 替换）。

### AMEND-1（测试落点迁移）

§2 In-scope 第 2 条目原为「`packages/broker/test/capabilities.test.js`：
新增 fixture（§10）」，修订为 dedicated home
`packages/broker/test/capabilities/workflow-transition.test.js`：该文件由
decomposition 8-path 实现创建（先承接既有 generic transition-shaped
Idempotency-Key fixture），本能力的正式 fixture 只追加该职责。**本 Spec
不以该聚合文件作为任何实现落点或闭包成员**；实现 diff 中不得出现该路径。
ACC-002 的 fixture 断言面（POST path/body camelCase、scope、Idempotency-Key
不可注入、错误信封透出、identity-neutral）语义不变，仅物理落点更换；
「基线 173 + 新增」的数值基线以实现时 fresh main 为准（decomposition 后
基线不含该聚合文件，test 数以 gate 输出为准，不硬编码 173）。

### AMEND-2（aggregate inventory 计数授权）

新增授权：aggregate manifest 计数断言 **14→15** 的唯一调整点 =
`packages/broker/test/capabilities/manifest-inventory.test.js`
（decomposition DEC-003 冻结该文件为 aggregate inventory 的唯一 owner，
拆分事务本身保持 13；「后续 capability PR 只能在其 governing Spec 明确
授权时单独调整 inventory count」规则的两个行使者 = Global Instances V2
（13→14）与本修订（14→15）；Domain Pagination V2 扩展现有 manifest、
不改变计数）。实现 diff 中 `manifest-inventory.test.js` 的改动仅限计数
断言值 14→15 与因新 manifest 加入 aggregate 数组所需的导入（若有），
不得改动其 validation assertion 语义。协调序 = decomposition §8 步骤 7
的冻结顺序（PR #101 → PR #102 → Transition）；若实现顺序偏离，计数以
「then-current 值 +1」语义执行，最终态仍为 15。

### AMEND-3（`implementation_authority: none → contracts` 授权方案）

本 Spec 当前 `status: accepted`、`implementation_authority: none`（§16
acceptance 明确不自行授予产品实现权限）。授权方案（单一受控路径，无其它
flip 通道）：

1. **本轮（authoring）**：docs-only Draft PR 记录本修订；lifecycle 字段
   零变化（status 仍 accepted、implementation_authority 仍 none、
   production_apply_authority 仍 none）；不实现、不 merge、不授 Grant。
2. **审计 gate**：独立「流转 审计」轮对本修订后的完整文件给出 PASS
   verdict（BINDING：reviewed head pin、产品合同零变化确认、AMEND-1/2/3
   语义确认）。
3. **authority-flip 事务**：审计 PASS 后，ONE commit / ONE file 的
   lifecycle-only 事务翻转 `implementation_authority: none → contracts` +
   记录 provenance（amendment_reviewed_head 等字段写入本节）；除此之外
   reviewed semantics 逐字节保留。该事务可与同轮姊妹协调 spec（Global
   Instances V2 / Domain Pagination V2 successors）的 acceptance 事务及
   decomposition 本身的 lifecycle-only acceptance（其 §8 步骤 4）在同一
   原子 authority transaction 内协调完成。flip 前 `production_apply_authority`
   保持 none 且 flip 不改变它。
4. **实现前置（flip 不免除）**：本能力的实现 PR 只能从满足以下条件的
   fresh main 开工：(a) decomposition 已 accepted 且其 exact 8-path 实现
   已 merge（dedicated home 已存在、聚合文件已删除、
   `manifest-inventory.test.js` 为 aggregate owner）；(b)
   GOVERNING_SPEC_UNMODIFIED——实现 PR 不得修改本文件。
5. **失败语义**：若 decomposition 最终未 accepted / 未实现，前置永不满足，
   实现不得开工；任何状态下本 Spec 都不授权 touch 未登记 legacy 聚合文件
   或 `.agents/structure-registry.json` / guardrails 规则。

### 保持不变（审计对照面）

工具 `workflow_transition`、端点
`POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions`、
参数面（`workflowInstanceId` / `transitionDefinitionId` /
`expectedWorkflowStateVersion` / `submissionPayload` 可选）、scope
`workflow.execute`、actor 仅来自 token、服务端 current-assignee 权威 +
transition legality + CAS + idempotency + exact replay + deterministic
failure replay + conflict fail-closed、Idempotency-Key trusted Broker 生成
模型不可覆盖 + 401 retry 复用同 key、`executable_for_actor` =
ADVISORY_ONLY、manifest-only error envelope（无结构化 error.details）、
错误表（含 `definition_version_draft` 不在表内）、全部禁止清单
（actor/principal override、Domain Owner 替别人提交、assignment mutation、
create_instance、Definition management、Coordinator、手工 SQL、Grant
change）、§8 DEC-001..006、§9 CTR-001..008、§15 三项 fix、§16 acceptance
记录——均逐字保持。

### 本轮边界与验证

- 只修改本 Spec 文件；不实现代码、不 flip lifecycle 字段、不 merge、
  不授 Grant、不部署；不修改 PR #101/#102/#107；不创建/修改 decomposition
  8-path 任何成员；`.agents/**` 与 `packages/**` 零变化。
- 验证（fresh-main worktree 实测）：frontmatter YAML 解析 PASS（status
  accepted、implementation_authority none 不变）；
  `python3 .agents/tools/verify_governance.py --target .` PASS；
  `npm run verify:structure`（vs origin/main）PASS / 0 violations；
  `git diff --check` PASS；packages/broker `node --test` = 173/173
  PASS（docs-only 无影响复核）。
- 冻结字段：AMENDMENT_KIND = FOCUSED_IN_PLACE；TEST_HOME =
  packages/broker/test/capabilities/workflow-transition.test.js；
  INVENTORY_COUNT_AUTHORITY = 14 -> 15 @ manifest-inventory.test.js（sole
  adjustment point）；AUTHORITY_SCHEME = AUDIT_THEN_LIFECYCLE_FLIP（本节
  AMEND-3）；PRODUCT_CONTRACT_DELTA = NONE；PR_101_MODIFIED = NO；
  PR_102_MODIFIED = NO；PR_107_MODIFIED = NO；PRODUCT_CODE_CHANGE = NONE；
  GRANT_CHANGE = NONE；PRODUCTION_CHANGE = NONE。
- 下一事务：独立 review（流转 审计）→ 通过后按 AMEND-3 执行
  authority-flip 事务（与姊妹 spec / decomposition acceptance 协调）→
  实现前置满足后实现轮（ACC-002/003，dedicated home + inventory 14→15）。

## 18. Authority flip record (2026-08-30, 联动 执行 / COORDINATED_ACCEPTANCE_AND_MERGE)

AUTHORITY_FLIP_TRANSACTION = LIFECYCLE_ONLY，ONE commit，ONE file（本文件）。

- 事务：TASK_NAME = 联动 执行（step 4/4）；per §17 AMEND-3 授权方案第 3 步（gate
  事务）；reviewed head = focused-amendment head
  `d1bc0f5b4e56d0eff6a4f14c7a955c4845d1101c`（fresh fetch 核对无漂移）+ 本 flip
  commit；独立 worktree。
- 生命周期变化（唯一）：
  - `implementation_authority: none -> contracts`（frontmatter 单行翻转原值
    none——§16/§17 记录的 none 成为历史；本 Spec merged on main 起成为
    workflow_transition scope 的实现授权）。
  - `status` 保持 **accepted**（不新增 acceptance 事务；本 flip 是授权 gate，非
    重新 acceptance）。
  - `production_apply_authority` 保持 **none**（deploy / restart / Grant /
    production state 变更仍需独立授权；§16 语义不变）。
- **AMEND-3 步骤 2 的独立审计 gate（如实记录）**：§17 AMEND-3 的授权方案原要求
  独立「流转 审计」轮 PASS 后再 flip；按 Owner 编排（TASK_TYPE =
  COORDINATED_ACCEPTANCE_AND_MERGE，直接协调 acceptance），本事务以
  Owner-directed 直接执行 flip，未运行独立审计轮。本记录**不声明任何独立审计
  verdict**——没有审计 verdict 可记录，不伪造 `independent_review_result` 类字段。
  机械化验证在 reviewed head 与 flip head 全部实测 PASS：frontmatter schema、
  `verify_governance.py`（vendored bytes 匹配）、`npm run verify:structure`
  （0 violations）、`git diff --check`、Broker 基线 `node --test` = 173/173。
- **协调前置（已满足）**：分解 spec
  `AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1` 已 accepted 并 merged
  （PR #107 merge `1fc3ad6`）；姊妹 Global Instances V2（PR #108 merge
  `4283657`）与 Domain Pagination V2（PR #109 merge `92891f8`）已 accepted 并
  merged；inventory 协调序 13 →14（Global V2）→ 15（本 Spec）已由各方 authority
  adopt。
- **实现前置（flip 后仍成立，AMEND-3 第 4 步）**：本能力的实现 PR 只能从满足
  以下条件的 fresh main 开工：(a) 分解 8-path exact closure 已 merge（dedicated
  home `workflow-transition.test.js` 已存在并先承接 generic transition-shaped
  idempotency fixture；legacy 聚合文件已删除；`manifest-inventory.test.js` 为
  aggregate owner）；(b) 本文件 frontmatter 即实现基线上的这个翻转值
  （contracts）；(c) GOVERNING_SPEC_UNMODIFIED——实现 PR 不得修改本文件。
  因此实现轮必须排在拆测 执行 轮（NEXT_TASK = 拆测 执行）之后。
- 语义变化（相对 reviewed focused-amendment head）= AUTHORITY_FIELD_ONLY：
  frontmatter `implementation_authority` 单行翻转 + 头部 AUTHORITY FLIP 注记 +
  本节；§1–§17（含 §2 AMEND-1 落点、AMEND-2 计数授权、AMEND-3 授权方案文字、
  §15 三项 fix、§16 acceptance 记录）逐字节保留；§17 AMEND-3 中「审计 PASS 后
  flip」的表述按既有纪律作为方案原文保留（本事务即该方案 gate 的 Owner-directed
  执行）。
- 事务边界：DOCS_ONLY（1 file）；PRODUCT_CODE_CHANGE = NONE；GRANT_CHANGE =
  NONE；PRODUCTION_CHANGE = NONE；packages/、scripts/、.agents/**、auth-service、
  production 均不动；PR #101/#102 不被本事务修改（PR #102 处置按分解 §8 步骤 7
  属独立未来轮次）。
- Merge：本 commit 之后随即 mark ready 并 merge PR #110（merge commit 为本
  Spec authority flip 的 effective-on-main 坐标）。
