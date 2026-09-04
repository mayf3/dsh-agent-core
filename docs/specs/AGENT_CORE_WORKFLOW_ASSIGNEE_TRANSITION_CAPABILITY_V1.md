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

> **REVISE AMENDMENT 2026-08-31（执行 修订，本轮）。** 独立审计对 2026-08-31
> 平行 spec 草案（`AGENT_CORE_WORKFLOW_EXECUTE_CAPABILITY_V1`，工作区草稿、
> 从未 commit/push/PR）给出 **REVISE**：其立项前提「old spec proposed / zero
> implementation / no accepted authority」在 github/main 已失效——本 Spec
> 2026-08-29 accepted、2026-08-30 authority flip（§18）、2026-08-31 实现已
> merge（PR #125，§4 STATE-007）。该草案本轮**撤回删除**，其「supersede old
> proposed spec」模型作废；本 Spec 保持 workflow 写面**唯一 governing
> authority**（`supersedes: []` / `superseded_by: null` 不变）。本轮 focused
> in-place amendment 四项——(1) DEC-007 命名与 alias 裁决（KEEP
> `workflow_transition`，任务语言名 `workflow_execute` 仅为 alias，不开第二
> 写入口）；(2) STATE-007 证据刷新（main workflow manifests = 7 / shipped
> 总量 15；PR #125 merge `1aa8248`）；(3) CTR-009 rollout canary gate
> （`workflow_execute_canary_v1`，治理合同，非产品代码）；(4) OBS-009 审计
> 回执字段映射。dispatch 修订六项中「错误合同删除 `definition_version_draft`」
> 与「CAS 描述区分服务端内部细节 vs Broker 信封」已由 §15 Fix 1/Fix 3 满足，
> 本轮零改动、仅记录确认。产品合同零变化（DEC-001..006、CTR-001..008 全部
> 不变）；lifecycle 字段零变化（status accepted、implementation_authority
> contracts、production_apply_authority none）。修订明细与处置对照见 §19。

> **OWNER PRODUCT AMENDMENT 2026-09-02（工具 修订，本轮）。** Owner 产品裁决：
> Workflow 写面最终只有一个模型工具——canonical tool = **`workflow_execute`**
> （判别器 `operation`，不引入 `action`），operations 冻结为
> **`create_instance` + `transition`** 二项。本修订**反转 §19 DEC-007 的命名
> 裁决**（`workflow_transition` KEEP 作废；其理由「不开第二写入口」恰由本
> 裁决继承——`workflow_execute` 是**替代**而非并存，`workflow_transition`
> 在同一次切换中退出模型工具面，**不得并存形成第二写入口**），并解除
> CTR-007 写红线中对 `create_instance` 的禁止（该 operation 经本修订授权，
> 红线其余项全部维持）。全部安全合同不变：trusted identity seam /
> `workflow.execute` scope / server-side authorization / transition CAS /
> trusted Idempotency-Key / no automatic retry / Grant 不自动扩大 / write gate
> / svc-workflow 最终权威。create_instance 合同按 **CASE A** 冻结（svc-workflow
> `POST /internal/v1/workflow-instances` 已存在，服务端零改动）。修订明细
> 见 §21；status 仍 accepted，接受需独立审计轮。

> **ACCEPTED FOCUSED AMENDMENT 2026-09-03（Definition Authoring boundary）。**
> 本轮仅澄清 DEC-010 的“唯一写工具”是唯一 **instance-execution** 写工具；
> Definition management 在本 Spec 中一直明确 out-of-scope，可由独立 governing
> Spec 授权一个 `workflow_definition_authoring` 工具。`workflow_execute` 仍恰为
> `create_instance|transition`，全部既有合同不变。见 §23；本段尚未受理，需绑定
> exact reviewed head `6aadb57f887e91c41dbfeb35fd505ba8deb6ec73` 的独立审阅
> PASS 后由 Owner mayf3 接受；acceptance record 见 §24。

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

STATE-007 —（2026-08-31 刷新，执行 修订轮；dsh-agent-core `github/main` @
`4d7ca24` fresh fetch 核对）**实现已 merge**：PR #125
"feat(broker): add workflow_transition capability"（merge commit
`1aa8248893766aaf1caae17b2905e40061f0a147`，2026-08-31T00:05:31Z），files
= `packages/broker/src/capabilities/workflow.js` +
`packages/broker/test/capabilities/workflow-transition.test.js` +
`packages/broker/test/capabilities/manifest-inventory.test.js`——与 §2
In-scope（§17 AMEND-1 dedicated home + AMEND-2 计数授权）的闭包一致。
`workflow.js` 现注册 **7 个 workflow manifests**（STATE-002 的 5 只读 +
`workflow_global_instances`（Global Instances V2，PR #108）+
`workflow_transition`（本 Spec，唯一写工具））；aggregate shipped manifests
= **15**（`manifest-inventory.test.js` 断言 `all.length === 15`）。主
manifest 错误表与 CTR-005 逐码一致（无 `definition_version_draft`；
`canary_read_only` 未声明——处置见 CTR-009 注记）。

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

OBS-009 — 审计回执面（2026-08-31 执行 修订轮新增实证；svc-workflow
`github/main` @ `f0c74ee` 核对，canary/audit 相关文件自 `88ff814` 起
zero drift，坐标在两 revision 均有效）：每次 execute——**成功、确定性失败、
replay 三态都算**——在服务端产生 command receipt + attempt audit：

- `workflow_command_receipts`（`command_id`、`principal_id` FK、
  `idempotency_key`、`command_type`、`request_hash`、`receipt_status`；
  ON CONFLICT `(principal_id, idempotency_key)` DO NOTHING——
  transition_receipt.rs:30-33）；
- `workflow_command_attempt_audits`（audit_id / command_id / principal_id /
  idempotency_key / attempt_type，transition_receipt.rs:121-138）；
- 成功态事实行：`workflow_submissions`（transition_helpers.rs:172）、
  `workflow_node_visits`（新 visit，:209）、`workflow_events`（:308-316：
  `event_sequence`、`actor_principal_id`、`command_id`、`transition_effect`、
  `source_node_visit_id` / `target_node_visit_id`、`from_node_id` /
  `to_node_id`、`old_workflow_state_version` / `new_workflow_state_version`、
  `event_data` + `event_data_digest`）；
- 确定性失败态：`persist_deterministic_failure` 先以错误 status +
  response digest 完成 receipt 并 commit 再返回错误
  （transition_validation.rs:579-596）——**拒绝本身可审计**。

审计字段 ↔ 任务合同映射（「每次 execute 产生 command receipt + audit
record，含 caller principal / instance / transition / before version /
after version / result」）：caller principal = receipts.`principal_id` +
events.`actor_principal_id`；instance = events.`workflow_instance_id`；
transition = request_hash 全量覆盖 + events.`command_id` /
`transition_effect` / from/to node；before/after version =
events.`old_workflow_state_version` / `new_workflow_state_version`（after =
响应 `workflowStateVersion`）；result = receipts.`receipt_status` +
response digest。CTR-006 的「响应字段即回执、broker 不新造审计存储」维持
不变，本条为其提供字段级证据。

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

DEC-007 — **命名与 alias 裁决（2026-08-31 执行 修订轮）**：唯一写工具名
保持 **`workflow_transition`**——已随 PR #125 实现并 merge（STATE-007），
tool id / wire 合同 / 测试断言 / inventory 计数全部锚定该名。任务语言名
`workflow_execute` 是本能力在 dispatch 与 canary 计划语境下的 **alias**，
不是第二个工具：**不 rename、不建 alias 工具、不开第二个 execute 写入口**
（backward compatibility 冻结）。scope `workflow.execute` 本就是服务端
合同名（require_scope），与 broker 工具名不需一致（读侧先例：
`workflow.read` scope 对 5 个只读工具）。canary 计划名
`workflow_execute_canary_v1`（CTR-009）所验收的工具即 `workflow_transition`。

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

CTR-009 — **Rollout canary gate（治理合同，非产品代码；2026-08-31 执行
修订轮新增）**。`workflow.execute` 授予**不默认铺开全 fleet**（DEC-005
Grant 边界不变）；rollout 走 `workflow_execute_canary_v1`，由三层既有
fail-closed 闸门承载，**broker 侧零 per-identity 逻辑**（DEC-002 / CTR-003
纪律不变，manifest 对全 fleet 可见但无 grant 即 fail-closed）：

1. **svc-workflow 全局写闸门**：`AUTH_V1_CANARY_WRITE_ENABLED`（默认
   false）——全部 transition 写在 token 验证前 403 `canary_read_only`
   （`src/http/canary_guard.rs:29-46`，挂载于 transitions 路由
   `mod.rs:49-54`，STATE-001）。单开关全局 kill / enable。
2. **svc-workflow per-identity allowlist**：
   `AUTH_V1_CANARY_ALLOWED_SUB` / `AUTH_V1_CANARY_ALLOWED_CLIENT_ID`
   非空时，claims 精确匹配才通过（`jwks_verifier.rs:298-306`）——
   **不改 auth-service 即可把有效面收窄到单一 canary identity**（即使
   多名 Agent 持有 grant，STATE-006 的两名持有者亦被收窄）。
3. **auth-service grant 供给**（DEC-005）：scope `workflow.execute` 的
   `machine_access_grants` 决定谁能取得 token；无 grant → token 签发处
   fail-closed（STATE-006）。

canary 验收流（**后续独立执行轮次**，须 Owner 单独下令；
`production_apply_authority` 仍 none，本条不授权执行）：G0 只读 gate
（写闸门配置核实 / allowlist 值核实 / grant census 只读复核 / canary 对象
选测试性质 domain——默认 canary identity = `agt_build-in-public-agent`，
任意时刻至多一个 canary identity）→ A 经 `workflow_instance_detail` 读
`workflow_state_version = V` 与出口 T（executable_for_actor 仅 advisory，
DEC-002）→ B 以 `workflow_transition` 提交 → 断言响应
`workflowStateVersion == V+1`、`eventSequence` 存在、
`currentNodeVisitId != sourceNodeVisitId` → C 重读 detail 复核 version
与新 current node visit → D 只读 SQL 复核 receipt / event 行（OBS-009
字段映射；只读账号、零写）。失败即停（不重试不绕行）；全局 abort =
`AUTH_V1_CANARY_WRITE_ENABLED` 置 false（即时 403）。

注记（如实记录，不改实现）：`canary_read_only` 当前**未**在 CTR-005 声明、
主 manifest（PR #125）亦未声明——闸门关闭时按 undeclared 降级 `http_4xx`
透出，fail-closed 语义不受影响，仅损失码级可读性；若未来要求声明该码，
须回本 Spec AMEND 并走独立实现轮（本轮不授权任何代码变化）。

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

## 19. Amendment record (2026-08-31, 执行 修订)

- 事务：TASK_NAME = 执行 修订，TASK_TYPE = SPEC_AMENDMENT_ONLY；触发 =
  独立审计 **REVISE**（对象：2026-08-31 平行 spec 草案
  `AGENT_CORE_WORKFLOW_EXECUTE_CAPABILITY_V1`——其立项前提「old spec
  proposed / zero implementation / no accepted authority」在 github/main
  已全部失效：本 Spec 2026-08-29 accepted（§16）、2026-08-30 authority
  flip 至 contracts（§18）、2026-08-31 PR #125 实现已 merge（STATE-007））。
- **治理关系修正（本节核心）**：平行 spec 草案本轮**撤回删除**（工作区
  未提交草稿，从未 commit / push / PR，删除无迁移成本）；该草案对本文件
  作出的 `status: superseded` + `replaced_by` 翻转一并还原为 github/main
  accepted 内容。本 Spec 保持 workflow 写面**唯一 governing authority**
  （frontmatter `supersedes: []` / `superseded_by: null` 不变）；本轮为
  **focused in-place AMEND**，非 supersede、非新建平行 Spec。

### dispatch 六项处置对照

| # | dispatch 要求 | 处置 |
|---|---|---|
| 1 | 删除错误声明（old spec proposed / zero implementation / no accepted authority） | 平行 spec 草案整文件删除（错误声明的唯一载体）；本文件 STATE 条目均为 dated pins，无失实声称 |
| 2 | 处理 workflow_transition 已存在（rename / alias / backward compat） | **DEC-007：KEEP**——不 rename、不建 alias 工具、不开第二写入口；`workflow_execute` 冻结为任务语言 alias；backward compatibility 以 tool id / wire 合同 / 测试 / inventory 计数锚定 |
| 3 | 刷新 Broker evidence（main workflow manifests = 7，非旧 4） | **STATE-007**：7 个 workflow manifests / shipped 总量 15；PR #125 merge `1aa8248`（文件闭包与 §2 一致）；「4 manifests」是平行草案基于 stale local HEAD 的错误计数 |
| 4 | 错误合同删除 `definition_version_draft` | **已由 §15 Fix 3 / CTR-005 满足**（HTTP 层映射 500 `internal_consistency_error`）；PR #125 主 manifest 逐码一致（本轮复核）；本轮零改动 |
| 5 | CAS 描述区分 service internal details vs Broker visible envelope | **已由 §15 Fix 1 满足**：OBS-003（服务端 body 结构化 `{expected, actual}`，仅存在于下游响应体）+ OBS-008（Broker 信封四要素：code + status + sanitized detail + requestId，不保留结构化 details）+ DEC-004（恢复路径 = 重读 detail）；本轮零改动 |
| 6 | 保留安全合同（seam / assignee gate / CAS / submission schema / audit receipt / canary gate） | 全部维持：CTR-002（identity 只经 credential seam + submission schema 参数面）、CTR-003（服务端唯一权威 assignee gate）、DEC-004（CAS 禁自动重试）、CTR-006 + **OBS-009**（audit receipt 字段级细化）、**CTR-009**（canary gate 新增）。无任何放宽 |

### 保持不变（审计对照面）

frontmatter lifecycle 字段（status: accepted、implementation_authority:
contracts、production_apply_authority: none）、DEC-001..006、CTR-001..008、
§1–§14、§15 / §16 / §17 / §18 全部历史记录——逐字保持；§4 / §5 / §8 / §9
仅**追加** STATE-007 / OBS-009 / DEC-007 / CTR-009，不改动既有条目。

### 本轮边界与验证

- DOCS_ONLY：只改本文件 + 删除工作区未提交的平行 spec 草案；不实现代码
  （PR #125 之后 `packages/**` 零变化）、不 flip lifecycle、不 merge、不授
  Grant、不部署；auth-service / svc-workflow / production 零接触（svc-workflow
  仅本地只读 diff 核对 zero drift）。
- 事实核对（fresh fetch 实测）：dsh-agent-core `github/main` @ `4d7ca24`
  （PR #126 已合并）；本文件 main 版 frontmatter = accepted / contracts；
  PR #125 state=MERGED、merge `1aa8248`、files 三项与 §2 闭包一致；
  `workflow.js` 7 manifests、`manifest-inventory.test.js` 断言 15；主 manifest
  错误表无 `definition_version_draft`。svc-workflow `github/main` @ `f0c74ee`，
  canary / audit 相关源文件自 `88ff814` 起 zero drift（OBS-009 / CTR-009 坐标
  有效）。
- 机械验证：frontmatter YAML 解析 PASS（lifecycle 字段与 main 逐字一致）；
  `git diff --check` PASS；§19 对照表与正文条目交叉引用扫描 PASS。

### 冻结字段

AMENDMENT_KIND = GOVERNANCE_RELATION_REVISE；PARALLEL_SPEC_DISPOSED =
DELETED_UNCOMMITTED；TOOL_NAME = workflow_transition（KEEP，DEC-007）；
TASK_ALIAS = workflow_execute；CANARY_PLAN = workflow_execute_canary_v1
（CTR-009，design-only）；PRODUCT_CONTRACT_DELTA = NONE；
PRODUCT_CODE_CHANGE = NONE；GRANT_CHANGE = NONE；PRODUCTION_CHANGE = NONE。

- 下一事务：独立 acceptance review（本修订）→ 通过后本节成为 accepted
  amendment；`workflow_execute_canary_v1` 执行轮须 Owner 单独下令（届时另行
  授权，本 Spec 不自行授权 production 写）。

## 20. Amendment acceptance record (2026-08-31, 执行 接受)

- 事务：TASK_NAME = 执行 接受，TASK_TYPE = ACCEPTANCE_FINALIZE；对象 = §19
  amendment（REVISE AMENDMENT 2026-08-31，执行 修订轮）。执行 审计 = **PASS**；
  AMENDMENT_VALID = YES；BLOCKERS = NONE。
- AMENDMENT_AUTHORED_AGAINST = `github/main` @ `4d7ca24`（authoring 与本
  acceptance 轮两次 fresh fetch 核对，main 与该文件均零漂移）。amendment
  delta = **纯追加**（STATE-007 / OBS-009 / DEC-007 / CTR-009 + 头部 REVISE
  AMENDMENT banner + §19 记录；frontmatter 与 main 逐字一致，0 删除）。
  amendment 未单独 commit，审计对象即工作区 diff；本 acceptance 与 amendment
  由同一**单文件 commit** 落地（+174/-0 量级，docs-only）。
- 受理语义（成为本 accepted Spec 的组成部分）：**DEC-007**（`workflow_transition`
  KEEP——唯一写入口；`workflow_execute` 仅为任务语言 alias；不建
  workflow_execute manifest、不开第二写面）、**CTR-009**（canary gate
  design-only，`workflow_execute_canary_v1` 执行须 Owner 另行下令）、
  **STATE-007**（证据刷新：PR #125 / 7 workflow manifests / inventory 15）、
  **OBS-009**（审计回执字段映射）。
- Lifecycle 不变：status = accepted；implementation_authority = contracts；
  production_apply_authority = none。
- 边界：DOCS_ONLY（本文件为唯一变更文件）；packages/ 零变化；PR #125 不动；
  无 deploy；无 canary write。PRODUCT_CODE_CHANGE = NONE；GRANT_CHANGE =
  NONE；PRODUCTION_CHANGE = NONE。
- Merge：本 commit 经单一 PR merge 至 main（merge commit 即本 amendment
  acceptance 的 effective-on-main 坐标）。

## 21. Amendment record (2026-09-02, 工具 修订 — unified write tool)

- 事务：TASK_NAME = 工具 执行（Spec amendment），TASK_TYPE =
  SPEC_AMENDMENT_ONLY；触发 = **Owner 产品裁决（NEW_OWNER_PRODUCT_RULING）**：
  Workflow 写面最终只能有一个模型工具 `workflow_execute`，本轮实现
  `workflow_execute(operation="create_instance")` 与
  `workflow_execute(operation="transition")`；当前 `workflow_transition`
  在同一次切换中退出模型工具面，不得与 `workflow_execute` 并存形成第二
  写入口。产品 blocker：`DOWNSTREAM_NEEDS_WORKFLOW_EXECUTE = YES` /
  `CREATE_INSTANCE_NOT_EXPOSED = YES`。
- **治理关系**：本 Spec 仍为 workflow 写面唯一 governing authority
  （`supersedes: []` / `superseded_by: null` 不变）；本轮 focused in-place
  AMEND，不新建平行 Spec。2026-08-31 被撤回的平行草案
  `AGENT_CORE_WORKFLOW_EXECUTE_CAPABILITY_V1` 的拒绝理由是「第二写入口」；
  本轮 Owner 裁决明确 `workflow_execute` 是**统一/替代**入口而非第二入口，
  构成 NEW_EVIDENCE，拒绝前提不复存在。
- 前置事实核对（本轮只读探查，非新调查 Goal）：svc-workflow（本地 repo
  `/Users/yanfenma/workspace/project/svc-workflow`）`POST
  /internal/v1/workflow-instances` **已存在**（CASE A）：route
  `src/http/mod.rs:37-43`，handler `src/http/handlers/instances.rs:26-76`，
  DTO `src/http/dto.rs:12-31`，事务
  `workflow_instance_repository/create_transaction.rs`，错误映射
  `src/http/error.rs:121-167`（`from_create`）。服务端零改动，本轮实现
  仅补 broker binding。

### DEC-010 — 统一写工具裁决（Owner 产品裁决，2026-09-02）

OLD（§19 DEC-007，就此作废）：固定 `workflow_transition`，禁止
`workflow_execute` manifest。

NEW：Workflow 只允许一个 write entry，其 canonical model tool 为
**`workflow_execute`**；`workflow_transition` 被其 `transition` operation
**替代**，在同一次切换中退出模型工具面，不得并存形成第二写入口。

`workflow_execute` operations 冻结为恰好两项（本轮）：

1. `create_instance`
2. `transition`

判别器 = 现有 broker 术语 **`operation`**（不引入新 `action` 判别器，
不改 registry/mapping 全局协议）。模型侧工具签名即
`workflow_execute(operation="create_instance"|"transition", ...)`。

### CTR-010 — workflow_execute capability 面（唯一写工具）

- id / toolName = `workflow_execute`；requiredScopes =
  `['workflow.execute']`；沿用既有 broker 架构 **ONE CAPABILITY → ONE
  TOOL / MULTI-OPERATION DISPATCH**（不重构）。
- **transition operation**：HTTP binding、arguments、errors、idempotency、
  trusted identity behavior 从已生产验证的 `workflow_transition`
  （CTR-001..CTR-009 全部合同）**逐项迁移，不重新设计**：
  `POST /internal/v1/workflow-instances/{workflowInstanceId}/transitions`，
  args `workflowInstanceId` / `transitionDefinitionId` /
  `expectedWorkflowStateVersion` / `submissionPayload`，
  `http.idempotencyKey: true`（trusted seam 生成，模型不可见不可传），
  错误表 = CTR-005 全量迁移。
- **create_instance operation**（CASE A，合同按 svc-workflow 现有 domain
  model 冻结，不另造第二套数据模型）：
  - HTTP binding：`{ target: 'svc-workflow', method: 'POST', path:
    '/internal/v1/workflow-instances', idempotencyKey: true }`（服务端
    要求 Idempotency-Key 1-128 visible ASCII，`handlers/mod.rs:33-59`；
    trusted seam 生成语义同 CTR-004）。
  - 模型可控参数（wire 名 = 下游 serde camelCase +
    `deny_unknown_fields`，`dto.rs:12-21`）：`domainId`（必填 UUID）、
    `definitionVersionId`（必填 UUID，= accepted Definition 的
    PUBLISHED version）、`contextPayload`（必填 JSON，须过 entry node
    context schema）、`metadata`（必填 JSON，≤64 KiB，超限 413
    `size_limit_exceeded`）、`externalReference`（可选，≤512 chars）、
    `externalUrl`（可选）。
  - **禁止模型控制**（不进参数面，与 CTR-002 同纪律）：`principalId`、
    `agentId`、`actor`、assignee、trusted provenance、Idempotency-Key——
    identity 只经 credential seam（token `sub`）；initial assignee 由
    服务端按 entry node assignee ref 解析（`resolve_assignee`，
    create_transaction.rs:267；V2 minimal definitions 禁 DOMAIN_OWNER
    assignee ref，:251-255），broker 零权限逻辑。
  - 初始语义（服务端事务冻结）：`workflowStateVersion = 1`、首条
    context revision（revision 1）、entry node 首 visit、`eventSequence
    = 1` + 初始创建事件；creator = authenticated principal
    （`created_by_principal_id` / context revision `created_by` / event
    `actor_principal_id`）。
  - scope / 授权：`require_scope workflow.execute`（instances.rs:32）；
    principal 须存在且为该 domain 活跃成员（403
    `domain_membership_required` / `cross_domain_violation`）。
  - declared 错误表（fail-closed，`error.rs:121-167`）：transport 族
    （CTR-005 不变）＋ create 族：`principal_not_found`、
    `principal_disabled`、`domain_not_found`、`domain_disabled`、
    `domain_membership_required`、`cross_domain_violation`、
    `definition_version_not_found`、`version_not_published`、
    `context_validation_failed`、`assignee_resolution_failed`、
    `size_limit_exceeded`、`idempotency_conflict`、
    `command_still_processing`、`internal_consistency_error`、
    `service_unavailable`（信封四要素纪律 OBS-008 不变）。
  - 返回透传不 reshape：201 + `{ workflowInstanceId,
    workflowStateVersion, currentContextRevisionId, currentNodeVisitId,
    eventSequence }`（`dto.rs:23-31`）；`workflowStateVersion` 供首次
    transition CAS 链接。
  - 幂等：CTR-004 语义逐项适用（one call = one fresh trusted key；
    exact replay / deterministic failure replay / `idempotency_conflict`
    / 425 原样透出；no broker auto retry）。
- **切换语义**：`workflow_transition` manifest 与 `workflow_execute`
  不得并存于 shipped 工具面；实现 PR 必须在同一次变更中移除
  `workflow_transition` 独立 manifest，transition 语义经
  `workflow_execute(operation="transition")` 承载。6 个既有 read tools
  保持原样（零回归）。

### CTR-011 — registry coarse-required 处置纪律

不预先修改 `registry.js`。实现轮先写真实 multi-operation tool test：
`create_instance` 不提供 transition-only 参数、`transition` 不提供
create-only 参数时 DSH host 是否放行。host 正常 → `REGISTRY_CHANGE =
NONE`；host 因 coarse required schema 真正拒绝 → 只做最小修复：工具级
required 仅含「所有 operations 都声明且都要求」的参数；mapping 层保持
per-operation 严格 validation。禁止扩张为 schema framework 重构。

### 范围围栏（FOLLOW_UP_DEBT，本轮全部不做）

`workflow_query`、6 read tools 收敛、Forum 工具收敛、Scheduler 工具
收敛、其他 workflow actions（assign/cancel/archive）、通用 capability
framework、registry 重构——全部 FOLLOW_UP_DEBT。判别器：每发现一个问题先问
`DOES_THIS_BLOCK_CREATE_INSTANCE_OR_UNIFIED_WRITE_TOOL_SHIPPING`；NO 即
记 debt 不处理。

### 实现与验收围栏

- 最低测试 = 12 项 ship blocker：单写工具暴露；`workflow_transition`
  不再独立暴露；create_instance 可调用；transition 与生产行为等价；
  per-op strict validation；`workflow.execute` scope 正确；trusted
  identity 不暴露；trusted Idempotency-Key；create exactly once；
  transition exactly once；6 read tools 无回归；DSH host 可正确调用两
  operations。全 PASS 即停止开发，不加 adversarial matrix。
- Skill（todo-client / requirement-client）对齐到真实生产工具
  `workflow_execute`（definitionVersionId / contextPayload / RETURN /
  CAS recovery / domain mapping 留在 Skill，不塞 tool schema）。
- 部署复用既有已验证 production deployment machinery；部署后验证
  `WORKFLOW_EXECUTE_VISIBLE = YES` /
  `WORKFLOW_EXECUTE_CREATE_INSTANCE_CALLABLE = YES` /
  `WORKFLOW_EXECUTE_TRANSITION_CALLABLE = YES` /
  `WORKFLOW_TRANSITION_STANDALONE_VISIBLE = NO` / `GRANT_CHANGED = NO` /
  `UNRELATED_PRODUCTION_MUTATION = NONE`，并跑 dedicated E2E
  （create_instance → disposable instance → transition → V→V+1 exactly
  once）。
- 与 §19 冲突处置：DEC-007 命名裁决与 CTR-007 中「禁止 create_instance」
  由本节**替代**；CTR-001..009 其余全部合同对 transition operation 继续
  有效并被本修订继承。DEC-005（Grant 不动）、CTR-009（canary gate）不受
  本修订影响（写闸门现况按 fe1bed8 Owner ruling fleet-open，非本 Spec
  授权变更）。

### 本轮边界与验证

- DOCS_ONLY：本轮只改本文件；不实现代码、不 flip lifecycle、不部署、
  不动 Grant；svc-workflow / auth-service / production 零接触（svc-workflow
  仅本地只读代码核对）。
- 工作区既有 WIP（broker 未提交修改、未跟踪 docs）不在本轮闭包内，
  保持原样；本轮 amendment 落在含 §19/§20 的当前工作区文件之上。
- 机械验证：`git diff --check`（显式 pathspec commit）。

### 冻结字段

AMENDMENT_KIND = OWNER_PRODUCT_RULING_IN_PLACE；TOOL_NAME =
workflow_execute（canonical，替代 workflow_transition）；OPERATIONS =
[create_instance, transition]；DISCRIMINATOR = operation；CASE_A =
YES（backend create 已存在）；REGISTRY_CHANGE = PENDING_TEST（CTR-011
纪律）；PRODUCT_CODE_CHANGE = NONE（本轮）；GRANT_CHANGE = NONE；
PRODUCTION_CHANGE = NONE；FOLLOW_UP_DEBT = [workflow_query, read-tool
收敛, forum/scheduler 收敛, assign/cancel/archive, capability framework,
registry 重构]。

- 下一事务：独立审计（本修订）→ 通过后 lifecycle acceptance →
  final-head 审计 → merge → 实现（实现完成后不回询 Owner，直达
  WORKFLOW_EXECUTE_PRODUCTION_READY）。

## 22. Amendment acceptance record (2026-09-02, 工具 接受)

- 事务：TASK_NAME = 工具 接受，TASK_TYPE = ACCEPTANCE_FINALIZE；对象 = §21
  amendment（OWNER PRODUCT AMENDMENT 2026-09-02，工具 修订轮）。独立审计
  （TASK_NAME = 工具 审计）= **PASS**；BLOCKERS = NONE；AMENDMENT_VALID =
  YES。
- Authoring 与审计对象 = commit `ce37352`（fresh-main mechanical replay）：
  025eefc（stale base fe1bed8，非 main 祖先）按 GOAL phase-1 规则机械重放
  至 fresh current main `840d2f4`（PR #136 merge）之上；spec 文件与 025eefc
  **逐字节一致**，SEMANTIC_DELTA_FROM_025EEF = NONE；delta vs main =
  纯追加（header banner + §21，186 insertions / 0 deletions，0 删除；
  frontmatter 与 main 逐字一致）。本 acceptance 与 amendment 由同一
  单文件 commit 落地。
- 受理语义（成为本 accepted Spec 的组成部分）：**DEC-010**（统一写工具
  `workflow_execute`——operations 恰为 `create_instance` + `transition`，
  判别器 `operation`；`workflow_transition` 同一次切换退出模型工具面，
  不得并存）、**CTR-010**（capability 面冻结：transition 从
  CTR-001..009 逐项迁移；create_instance CASE A 绑定既有 svc-workflow
  `POST /internal/v1/workflow-instances`，服务端零改动）、**CTR-011**
  （registry test-first 最小修复纪律）。§19 DEC-007 命名裁决与 CTR-007
  create_instance 禁止由 §21 替代；其余合同全部继承。
- 审计对照（8 项 checklist 全 no-blocker）：DEC-007 替代一致性；唯一写
  入口三处显式（banner / §21 / CTR-010 切换语义）；operations 恰两项；
  transition 合同逐项对 CTR-001..009 验证；create_instance 全部断言对
  svc-workflow 真实源码逐条核实（含 15/15 错误码 exact match
  from_create、初始语义 stateVersion=1 / revision 1 / visit 1 /
  eventSequence=1、服务端 resolve_assignee）；安全边界零漂移；范围围栏
  无偷偷扩张；机械验证 PASS（diff --check、frontmatter 不变、单文件）。
- FOLLOW_UP_DEBT（审计记录，非阻断，不得据本轮实现扩张）：(1) §21 两处
  行号 citation 微偏（create route 实为 mod.rs:36-40；resolve_assignee
  调用实为 create_transaction.rs:268）——verified 不误导；(2) create 面
  handler 级 `missing_idempotency_key` / `invalid_idempotency_key` /
  `invalid_input`（externalReference>512）不在 CTR-010 declared 表——经
  trusted seam 不可达或按 DEC-006 fail-closed 降级 `http_4xx`，与已上线
  transition 面同 posture；如需 declared 须未来 spec 轮，实现轮不得自行
  扩表；(3) §21 中 fe1bed8 引用不在 main lineage（该句明示非本 Spec 授权
  变更）——未来机会再锚定；(4) frontmatter scope 行文仍提
  `workflow_transition`——纯追加约束下保持不变，以 DEC-010 为准，未来
  frontmatter-permitted amendment 再修。
- Lifecycle 不变：status = accepted；implementation_authority = contracts；
  production_apply_authority = none（本 acceptance 不授权部署；部署走
  独立 deployment authority 轮）。
- 边界：DOCS_ONLY（本文件为唯一变更文件）；packages/ 零变化；无 deploy；
  无 canary write。PRODUCT_CODE_CHANGE = NONE；GRANT_CHANGE = NONE；
  PRODUCTION_CHANGE = NONE。
- Merge：本 commit 经单一 PR merge 至 main（merge commit 即本 amendment
  acceptance 的 effective-on-main 坐标）。

## 23. Focused amendment (2026-09-03, Definition Authoring boundary)

This section was independently reviewed at exact head
`6aadb57f887e91c41dbfeb35fd505ba8deb6ec73` and accepted by Owner mayf3. It
clarifies the boundary of
DEC-010 without replacing this Spec or changing any accepted instance-execution
contract.

### DEC-011 — write-family boundary clarification

DEC-010's “one Workflow write entry” means one **instance-execution** model tool:
`workflow_execute`, with exactly `create_instance|transition`. Definition
management was explicitly excluded from this Spec (§2/§9 and prior amendment
scope) and is a separate product capability family.

One independently governed tool `workflow_definition_authoring`, containing
only `create_definition|create_draft_version|replace_draft_graph|publish_version`,
may therefore coexist with `workflow_execute`. It is not an alias, replacement,
or added operation of `workflow_execute`, and it does not reopen transition or
instance-execution semantics.

This is a bounded additive clarification: `workflow_execute` name, operations,
wire bindings, identity seam, error contracts, inventory presence, and absence
of `workflow_transition` remain byte-for-meaning unchanged. Definition Authoring
implementation authority exists only in a separately accepted governing Spec.

```text
AMENDMENT_STATUS = accepted
AUTHORITY_MEANING = INSTANCE_EXECUTION_WRITE_FAMILY_ONLY
WHOLE_SUCCESSOR_REQUIRED = NO
WORKFLOW_EXECUTE_CHANGE = NONE
PRODUCTION_APPLY_AUTHORITY = none
```

## 24. Amendment acceptance record (2026-09-03, Definition Authoring boundary)

- Reviewed semantic head = `6aadb57f887e91c41dbfeb35fd505ba8deb6ec73`;
  independent re-review = **PASS**; ship blockers = **NONE**.
- Owner mayf3 explicitly accepted that exact head on 2026-09-03.
- This finalize changes lifecycle/provenance only. §23 semantics are unchanged;
  `workflow_execute` remains exactly `create_instance|transition` and
  production apply authority remains none.
- The separately accepted `AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V1` is the
  only implementation authority for the new Definition Authoring family.
