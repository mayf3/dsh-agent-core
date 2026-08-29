---
spec_id: AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
accepted_date: 2026-08-29
accepted_reviewed_head: cd7a9ae55dd0add8d619ccadabcdadc278124318
independent_audit_result: PASS
independent_audit_blockers: NONE
acceptance_verdict: READY_FOR_ACCEPTANCE_FINALIZE
date: 2026-08-27
scope:
  - packages/broker
governed_by:
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1
    revision: fb54f9dfaeeec667b8ba72d56d8303390cd189a6
    relation: interoperates_with
    # Sole external/upstream normative authority (2026-08-29 reconciliation):
    # the ACCEPTED service spec — merged to svc-workflow main via PR #14 =
    # fb54f9dfaeeec667b8ba72d56d8303390cd189a6 (status: accepted,
    # accepted_date 2026-08-28) — plus its merged compatible implementation
    # (PR #15 = bf875c265843b3e07570a96b734051e9cfe27a43, merged 2026-08-29).
    # No other normative dependency in any direction: identity governance
    # (auth-service), scheduler / HR-dispatcher execution plane (this repo),
    # and agent-wake are NOT dependencies of this Spec — no pin, no DAG edge,
    # no cycle (they are independently governed upstream/downstream concerns).
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1 — 全域实例只读枚举 Broker 能力

> 状态：**accepted**（2026-08-29 lifecycle-only acceptance finalize，PR #83；
> revision 6，按**最终** OWNER_RULING = DUAL_GLOBAL_READER_MODEL
> 修订：服务端 global gate = GLOBAL_WORKFLOW_READER OR GLOBAL_WORKFLOW_COORDINATOR
>（external authority SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1 **已 accepted** @ PR #14
> merge fb54f9dfaeeec667b8ba72d56d8303390cd189a6，兼容服务实现已合入 svc-workflow
> main @ PR #15 merge bf875c265843b3e07570a96b734051e9cfe27a43——双角色谓词与
> `global_read_role_required` 读闸码已在合并源码冻结；双授予——HR 主身份与专用
> Dispatcher Agent 各获 READER，双方均不获 COORDINATOR）；错误表维持双码声明——
> `global_read_role_required`（目标契约）+ `global_coordinator_required`（部署
> 过渡兼容，修订 production 部署完成前的既有部署态）；本能力保持**通用只读
> 工具**，不硬编码 HR 或 Dispatcher（DEC-008）。base = main df3b299（含 PR #82
> error-preservation 实现 + PR #85 domain-instances 接受与实现[已部署]）。
> 后续不再切换身份模型）。
> 独立审计（接入 审计轮，2026-08-29）：AUDIT_RESULT = **PASS** · HEAD_DRIFT =
> **NONE** · DEPENDENCY_MODEL = **CLEAN** · SERVICE_CONTRACT = **VERIFIED** ·
> BROKER_CREDENTIAL_BOUNDARY = **VERIFIED** · IMPLEMENTATION_CLOSURE =
> **EXACT_TWO_FILES** · BLOCKERS = **NONE** · READY_FOR_ACCEPTANCE_FINALIZE =
> **YES**（accepted_reviewed_head =
> `cd7a9ae55dd0add8d619ccadabcdadc278124318`，fresh fetch 后核对无漂移）。
> 本 Spec 自 merged on main 起成为本 scope 的唯一实现授权
> （`implementation_authority = contracts`）；实现按 §2/CTR-001 两文件闭包在
> 独立 worktree 从 fresh merged main 进行，评审按 GOVERNING_SPEC_UNMODIFIED
> 纪律合并（实现 PR 不得修改本文件）。
> `production_apply_authority = none`（deploy / restart / 角色授予 / production
> state 变更仍需独立授权；HR READER 授予与 Dispatcher 身份创建均归 external
> authority 治理，不在本 Spec 授权面内）。
> Acceptance Record 见 §14。
> 姊妹 Spec（已在 main accepted 并实现部署，非本 Spec 的 parent）：
> `AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1`（PR #85，domain 维度单页枚举）；
> 两者共享 manifest 家族与错误保留纪律，计数调和已定（ACC-006：13→14）。
>
> **依赖方向（2026-08-29 reconciliation，冻结）**：本 Spec **唯一**规范性上游 =
> svc-workflow `SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1`（accepted @ fb54f9d）+
> 其已合并兼容服务实现（bf875c2）。本 Spec 对 auth-service 身份治理、本仓
> scheduler / HR-dispatcher 执行面治理、agent-wake 治理均**无规范性依赖**——
> 各自独立治理，无 pin、无 DAG 边、无循环。

## 1. Goal

为持有 svc-workflow global 只读角色（目标契约：`GLOBAL_WORKFLOW_READER` 或
`GLOBAL_WORKFLOW_COORDINATOR`，服务端强制）的任意调用方提供一个、且仅一个新增
Broker 只读能力 `workflow_global_instances`——**通用只读工具，不硬编码 HR 或
Dispatcher，不绑定任何特定 Agent 会话**（DEC-008）——代理
svc-workflow **已部署**的
`GET /internal/v1/workflow-instances/global`，使其可经 Broker-first 凭据链枚举
**所有 Domain** 的 workflow 实例摘要。授权判断完全在 svc-workflow 服务端；
Broker 不复制、不放宽、不缓存任何权限语义。

## 2. Scope and non-goals

In scope（accept 后的实现面，仅此两项文件）：

- `packages/broker/src/capabilities/workflow.js`：新增
  `workflowGlobalInstancesManifest`（纯数据 manifest），加入 `manifests` 导出数组。
- `packages/broker/test/capabilities.test.js`：DEFAULT_MANIFESTS 计数断言 +1，新增
  fixture 测试（见 §10）。

Out of scope / 明确不授权：

- 本 Spec 不授权任何 svc-workflow 改动（external authority 另行治理其受控
  角色注入/gate 代码修改——READER 角色 + 双角色谓词 + 双码契约；端点本身
  已部署于 base 2ff81ae，mod.rs:119，无新路由）。
- 任何角色授予/身份变更（由 external authority
  `SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1` 独立治理；本能力对任意服务端合法
  调用者（READER 或 COORDINATOR 凭据持有者）通用，与任何具体授予互不依赖）。
- 写面：transition / assignment / Domain / provisioning 一概不触及；
  无 POST/PUT/DELETE 绑定、无 Idempotency-Key；**不含任何 Scheduler 写操作**
  （无 scheduler mutation 面、无 job 触发面——本能力与 Scheduler 系统零交集）。
- `workflow.execute` 或任何 scope 提升；本能力 requiredScopes 仅 `workflow.read`。
- 其他既有 capability 的 cursor 透出回溯变更（first-batch「cursor 不透出」纪律对
  既有能力维持不变；本 Spec 的 cursor 透出是**仅限本能力**的显式偏差，见 DEC-002）。
- production deploy / restart / job / store 变更（`production_apply_authority = none`）。
- 其余 85 个 fleet Agent 的任何变化（本 Spec 是 Broker 通用能力面，不含任何
  per-agent 配置）。

## 3. Authority and dependencies

- `governed_by`（均已 accepted，本地权威）：
  - `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`（accepted via PR #68
    2328fa6；**实现已合入 main（PR #82 @ e40c140；当前 main df3b299 保有）**——
    validationError/minimum/maximum 校验、错误信封、脱敏、request-id 传递均已在
    main 产品代码上生效）：本能力的错误信封（code/status/sanitized
    detail/requestId）、fail-closed 降级、broker-side limit 校验机制族直接继承其
    R1–R5。
  - `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`：Broker-first 凭据链
    （trusted store → client_credentials → scoped token）为既有冻结语义。
- `external_authorities`：svc-workflow 侧的最终双读者角色 Spec
  （**accepted**，PR #14 merge fb54f9dfaeeec667b8ba72d56d8303390cd189a6；
  兼容服务实现已合并：PR #15 merge
  bf875c265843b3e07570a96b734051e9cfe27a43，2026-08-29）—
  `interoperates_with`。外部引用不授予本地权威：该 Spec 按
  OWNER_RULING = DUAL_GLOBAL_READER_MODEL（最终，不再切换）引入
  `GLOBAL_WORKFLOW_READER` 只读角色（唯一许可面 = global instance list），服务端
  gate 改为 READER OR COORDINATOR（已在合并实现冻结：
  `query_visibility.rs:60-68` `role_key IN ('GLOBAL_WORKFLOW_READER',
  'GLOBAL_WORKFLOW_COORDINATOR')`），写端点/assistance/provisioning 维持仅
  COORDINATOR（其 403 码 `global_coordinator_required` 在写族保留，
  `error.rs:300-303`）；双冻结授予对象 = HR 主身份（agt_hr-agent /
  dc702687-6515-4a2a-91ae-e572a9bbd766，UUID 已冻结）与专用 Dispatcher Agent
  （agt_workflow-dispatcher-hr-agent，UUID 待身份创建后 amendment 回填，回填前
  不得 role apply）；双方均不获 COORDINATOR；legacy bc970ced 禁授。
  身份/Client/grant 治理与 Agent/scheduler 执行面治理均在本 Spec 依赖面之外
  （2026-08-29 reconciliation：本 Spec 唯一规范性上游 = 上述 accepted 服务 Spec
  + 兼容实现；不 pin、不依赖任何身份/scheduler/wake 治理 Spec，无循环）。
  本能力的实现与本地验收不等待该 READER 修订的 production 部署（双码时序
  声明见下）；落地后 HR 主会话与 dispatcher 凭据都是本工具的普通合法调用方。
- **错误码时序声明**：broker 实现可在 svc-workflow READER 修订部署之前或之后
  落地（修订源码已合并 @ bf875c2；production 部署进度由 external authority
  自行治理）。修订部署前服务端 gate 失败码为 `global_coordinator_required`，
  部署后为 `global_read_role_required`——两码均在本能力错误表声明（CTR-001），
  两种时序下错误保留纪律均成立；最终目标契约为 `global_read_role_required`。
- 实现叠加声明（**已收敛为单路径**）：本 Spec base = main df3b299
  （error-preservation 实现自 e40c140/PR #82 起在 main 生效）。`limit` bounds
  （minimum/maximum/validationError）在 main schema 上即时生效——越界在
  token/HTTP 之前本地 fail-fast `invalid_pagination`；仅当下游 422 兜底路径
  保留为防御性回退（码已声明）。CTR-002 合同单一形态。

## 4. Current State

- `STATE-001` — dsh-agent-core main df3b299 上 Broker 暴露 13 个 capability
  manifests（workflow 读族 5 个：my_tasks / instance_detail /
  submission_history / my_domains / domain_instances），无任何 global
  列表代理。basis: OBS-008。
- `STATE-002` — svc-workflow 已部署
  `GET /internal/v1/workflow-instances/global`（端点自 2ff81ae 起在部署面），
  服务端强制 `workflow.read` scope + global 只读角色双闸（已合并源码 bf875c2：
  `GLOBAL_WORKFLOW_READER` OR `GLOBAL_WORKFLOW_COORDINATOR`，失败码
  `global_read_role_required`；该修订 production 部署完成前的过渡部署态：仅
  `GLOBAL_WORKFLOW_COORDINATOR`，失败码 `global_coordinator_required`）。basis:
  OBS-001, OBS-003。
- `STATE-003` — 生产（2026-08-27 只读查询）：principal
  `dc702687-6515-4a2a-91ae-e572a9bbd766`（agt_hr-agent，active）当前无任何
  enabled global 角色绑定——其今日调用该端点必得 403（码按部署态见
  STATE-002 时序）。按最终 Ruling 计划：**HR_GLOBAL_READER = YES**（获 READER，
  手工只读查看），HR_GLOBAL_COORDINATOR = NO；专用 Dispatcher 计划
  DISPATCHER_GLOBAL_READER_PLAN = YES（UUID 回填前不得 apply），
  DISPATCHER_GLOBAL_COORDINATOR = NO。basis: OBS-009。

## 5. Observations

服务端事实（svc-workflow github/main = bf875c265843b3e07570a96b734051e9cfe27a43
（PR #15 merge，含 accepted READER 修订实现）；HTTP 路由/DTO 面自 2ff81ae 起未变，
逐行 re-verified 2026-08-29）：

- `OBS-001` — 路由与 handler：`src/http/mod.rs:119-120` →
  `handlers/instances.rs:165` `global_list`；
  `require_scope(&principal, "workflow.read")` 于 instances.rs:177。
- `OBS-002` — wire 参数契约：`GlobalInstanceQuery`（`src/http/dto.rs:125-138`）
  `serde(rename_all = "camelCase", deny_unknown_fields)`：
  `beforeCreatedAt`、`beforeId`、`limit`、`definitionKey`、`lifecycle`、
  `currentNodeKey`、`assigneePrincipalId`（UUID）、`status`。
- `OBS-003` — 服务端授权（bf875c2 已合并实现，re-verified 2026-08-29）：
  `WorkflowInstanceQueryService::list_global_instances`
  （`query_service.rs:111-131`）先
  `query_visibility::check_global_workflow_read_role(...)`
  （`src/store/postgres/workflow_instance_repository/query_visibility.rs:60-68`，
  谓词 = `role_key IN ('GLOBAL_WORKFLOW_READER','GLOBAL_WORKFLOW_COORDINATOR')`）；
  非持有者 → `WorkflowQueryError::GlobalCoordinatorRequired` → HTTP 403
  `global_read_role_required`（`error.rs:516-519`；变体名保留、wire 码已按
  accepted external authority 改为读闸码）。修订 production 部署完成前的既有
  部署态仍发 403 `global_coordinator_required`；coordinator 写端点与
  assistance 路径维持仅 COORDINATOR（写族码 `global_coordinator_required` 于
  `error.rs:300-303` 保留）。
- `OBS-004` — limit 服务端边界：default 20、0 或 >100 → 422
  `invalid_pagination`（`src/store/postgres/workflow_instance_repository/
  query_global_instances.rs:15-25`；纯 SELECT 投影，零写入）。
- `OBS-005` — cursor 复合纪律：`beforeCreatedAt`（RFC 3339）与 `beforeId`
  （UUID）**同给或同缺**；half-cursor / 畸形值 → 422 `invalid_cursor`
  （`instances.rs:222-251` parse_domain_cursor）。
- `OBS-006` — lifecycle/status 枚举：`lifecycle ∈ {active, terminal, all}`、
  `status ∈ {active, cancelled, archived, all}`；非法值 → 422 `invalid_lifecycle`
  / `invalid_status`（`dto.rs:160/189`，bf875c2 re-verified 行号不变）。默认语义：
  二者全缺省 → status=active；仅 lifecycle 给定 → status=all
  （`instances.rs:185-192`）。
- `OBS-007` — Broker 身份纪律（main df3b299）：transport 从不读 `args` 里的
  identity，credential 只来自 trusted identity seam（`transport.js:47-48`
  identity-neutral 纪律声明；`credential.js:26-29` `ctx.credentials.resolve`
  契约；`transport.js:124` MachineClient credential from trusted store、
  `:604` `credentialProvider.getCredential()`）；token 按
  manifest.requiredScopes 请求。
- `OBS-008` — main df3b299（error-preservation 实现自 PR #82/e40c140 起在
  main 生效）：`schema.js` 已含 minimum/maximum/validationError 校验
  （`schema.js:175-182` 声明检查 / `:301-302` 越界 fail-fast）；
  `capabilities.test.js:116-118` 断言 manifests 计数 = 13；broker 测试基线
  173（packages/broker `node --test`，2026-08-29 fresh-main 实测 173 pass /
  0 fail）。
- `OBS-009` — 生产只读查询（auth-service DB，2026-08-27）：
  `agt_hr-agent` → principal `dc702687-6515-4a2a-91ae-e572a9bbd766`（active，
  HR助手）；现有绑定 = DOMAIN_OWNER×1（hr-onboarding）+ DOMAIN_MEMBER×8；无
  global 绑定；fleet roster = 86 Agents。**scope 事实（OWNER_RULING 证据）**：
  该 principal 的 client `mc_IuBMfCYe9-b522IhSWKBGjyz`（active）的
  machine_access_grants v2 = **{workflow.read, workflow.execute}**（未撤销）；
  另有 legacy 谱系 principal `bc970ced-710f-4479-9ff0-e295a1c59424`
  （openclaw:agent:hr-agent）持 active client
  `mc_4Ud_9wGR1mwQM9W7s7foX8qp`（{workflow.admin, workflow.read,
  workflow.execute}）——故 COORDINATOR（兼 gate 写端点）不得授予任何 HR 谱系
  身份；最终模型 = DUAL_GLOBAL_READER：HR 主身份与专用 Dispatcher Agent
  （agt_workflow-dispatcher-hr-agent，计划 grant 仅 {workflow.read} +
  agent-wake）各获只读 GLOBAL_WORKFLOW_READER，双方零写可达，见 external
  authority。

## 6. Claims and assumptions

- `CLM-001` SUPPORTED — 新增 manifest 为纯数据零新机制：DEFAULT_MANIFESTS 自动
  纳入，child 模式 relay / gateway 模式 transport 均走既有泛型路径（同族
  first-batch + domain-instances 姊妹 Spec 的同一结论；basis: OBS-008）。
- `CLM-002` SUPPORTED — transport 只转发 manifest 声明的 query 名，未声明参数
  物理上到不了 svc-workflow（deny_unknown_fields 兜底前移）。basis: OBS-002/007。
- `CLM-003` SUPPORTED — 外部时序均被显式声明消解：error-preservation 实现已
  落地 main（PR #82 起在 base 内，limit 校验单路径）；svc-workflow READER
  修订已合并（bf875c2），其 production 部署的先/后由双码声明覆盖（§3）。
  无待定实现假设。

## 7. Evidence relations

- `EVD-001`：OBS-001/002/003/004/005/006（svc-workflow bf875c2 源码行证，
  re-verified 2026-08-29）→
  支撑 STATE-002 与 §9 全部参数/错误 Contracts。
- `EVD-002`：OBS-007（main df3b299 broker 源码行证）→ 支撑 CTR-003（身份不可
  替换）与 CTR-006（Broker-first 凭据）。
- `EVD-003`：OBS-008 → 支撑 STATE-001、CLM-001、§3 dual-path。
- `EVD-004`：OBS-009（生产只读查询）→ 支撑 STATE-003 与 external authority 的
  negative control 现状。

## 8. Decisions

- `DEC-001` capability 面：id / toolName = `workflow_global_instances`（沿
  `workflow_*` 命名族）；唯一 operation `list`；http binding
  `{ target: 'svc-workflow', method: 'GET', path: '/internal/v1/workflow-instances/global' }`；
  `requiredScopes: ['workflow.read']`；只读（无 body、无 Idempotency-Key）。
- `DEC-002` 参数面（按服务端契约冻结，wire 名 camelCase）：`limit`（可选
  integer 1..20，broker fail-fast `invalid_pagination`；服务端实际上限 100）、
  `lifecycle`（可选枚举）、`status`（可选枚举）、`definitionKey`（可选 string）、
  `currentNodeKey`（可选 string）、`assigneePrincipalId`（可选 UUID，**仅结果
  过滤**，见 DEC-003）、cursor `beforeCreatedAt` + `beforeId`（可选，
  **同给或同缺**）。**显式偏差声明**：first-batch「cursor 不透出」纪律
  （33533ce / error-preservation R4）对本能力**局部放开**——全域枚举必须可翻页，
  且放开仅限本 capability；half-cursor 纪律原样保留（只透出成对 cursor，缺半边
  由下游 422 `invalid_cursor` 拒绝，码已声明）。其余既有能力的 cursor 不透出
  不变。
- `DEC-003` 身份不可替换：`assigneePrincipalId` 是且仅是服务端结果过滤参数；
  调用者身份只能来自 trusted credential seam（OBS-007 结构性保证），模型不得、
  也不可能经参数冒充其他 principal。
- `DEC-004` 授权语义：完全服务端权威——global 只读角色闸（目标契约：
  `GLOBAL_WORKFLOW_READER` OR `GLOBAL_WORKFLOW_COORDINATOR`；部署过渡期：仅
  COORDINATOR）由 svc-workflow 服务端谓词强制；非合法调用者 → **fail-closed**
  403（目标码 `global_read_role_required`，过渡码 `global_coordinator_required`；
  双码均声明并按 error-preservation R1 保留 status/detail/request-id）。Broker
  不做、不复制、不缓存任何角色判断，不提供任何以放宽该语义为效果的参数或路径。
- `DEC-008` 通用工具语义（最终 Ruling）：本能力是**通用只读工具**——
  调用者身份 = 当前会话经 trusted credential seam 解析出的凭据（OBS-007），
  服务端角色 verification 是唯一授权权威；manifest / 实现中**不得**
  出现任何 HR 主会话、Dispatcher、特定 Agent、特定 principal 的硬绑定、特判
  或 wiring（无 per-agent 路由、无 identity 参数、无专属分支）。HR 主会话
  （获 READER 后）与 `agt_workflow-dispatcher-hr-agent` 都只是本工具的普通
  合法调用方，不获任何特殊路径。
- `DEC-005` 只读红线：GET-only manifest，零写 operation；服务端该路径为纯
  SELECT 投影（OBS-004），全链路零数据库写入。
- `DEC-006` 凭据红线：Broker-first——沿用既有 identity seam（trusted store →
  `client_credentials` → scope=`workflow.read` token）；本能力及其实现**不得**
  读取 `~/.openclaw/credentials`（505-private zone，能力层按设计不可读），不得
  引入任何直接凭据文件访问。
- `DEC-007` 返回面：`succ { ok: true, result: <Page<DomainInstanceSummary>> }`
  原样透传（snake_case 下游 JSON：`workflow_instance_id` / `title` /
  `is_terminal` / `current_node` / `current_assignee_principal_id` /
  `created_at` / `updated_at` + `next_cursor`），不 reshape；翻页经 DEC-002 的
  成对 cursor 参数推进。

## 9. Contracts

- `CTR-001`（实现闭包）— 恰好两文件：
  `packages/broker/src/capabilities/workflow.js`（新增
  `workflowGlobalInstancesManifest` 纯数据 + `manifests` 数组追加）与
  `packages/broker/test/capabilities.test.js`（计数 +1、新增 fixture）。manifest
  错误表声明：`invalid_arguments`、`unsupported_operation`、`unauthenticated`、
  `forbidden`、`principal_not_found`、`principal_disabled`、
  `global_coordinator_required`、`global_read_role_required`、
  `invalid_pagination`、`invalid_cursor`、
  `invalid_lifecycle`、`invalid_status`、`internal_consistency_error`、
  `service_unavailable`（`invalid_lifecycle`/`invalid_status` 为本能力新增声明，
  因本能力首次透出对应参数；`global_read_role_required` 为 external authority
  修订部署后的目标契约码，`global_coordinator_required` 为修订前部署的过渡
  现实码——双码并申以覆盖 §3 时序声明的两种部署态；canonical `http_4xx`/
  `http_5xx` 由 `withTransportErrors` 机制保证）。超出闭包的改动不在本 Spec
  授权内。
- `CTR-002`（参数校验）— `limit` 声明 `{type:'integer', minimum:1, maximum:20,
  validationError:'invalid_pagination'}`；在 error-preservation 实现已落的
  基线上，越界在任何 token/HTTP 请求之前本地 fail-fast；未落基线上该字段无害、
  由下游 422 `invalid_pagination` 兜底（dual-path，§3）。枚举/UUID/RFC3339
  格式校验不在 broker 复制——非法值透传后由下游 422 已声明码拒绝
  （fail-closed 保留 status/detail/requestId）。
- `CTR-003`（身份负面合同）— 任何实现不得让 `assigneePrincipalId`（或任何
  参数）影响调用者身份、credential 选择或 token subject；身份唯一来源为
  trusted seam（OBS-007）。
- `CTR-004`（错误保留）— 继承 accepted
  `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1` R1–R5 全部纪律；
  非合法调用者 403 端到端保留 code（按部署态为
  `global_read_role_required` 或 `global_coordinator_required`）+ status +
  sanitized detail + `x-request-id`（不伪造、不降级为 `invalid_arguments`/
  `forbidden` 之外的码；scope 403 仍为 `forbidden`）。
- `CTR-008`（通用性 + Scheduler 负面合同，对应 DEC-008）— manifest 与实现中
  不得存在任何 Agent/principal/会话硬绑定或特判；不得包含任何 Scheduler 写
  操作或 scheduler mutation 面（本能力与 Scheduler 系统零交集）；静态断言：
  manifest 无 scheduler 相关绑定、无 per-agent 配置字段。
- `CTR-005`（只读 + 零写）— manifest 无 POST/PUT/DELETE 绑定、无
  `idempotencyKey` flag；fixture 断言下游仅收到 GET；服务端零写入路径不被
  触发。
- `CTR-006`（凭据链）— token 请求 scope 恰为 `workflow.read`；credential
  解析仅经 `ctx.credentials.resolve`（或既有注入 seam）；不得新增文件系统
  凭据读取，不得读取 `~/.openclaw/credentials`。
- `CTR-007`（非回归）— 既有 12 个 manifest 字节不变；calculator/forum 渲染与
  错误信封行为不变（纯加法）。

## 10. Acceptance

- `ACC-001` → CTR-001/006：fixture 中 token 请求 scope=`workflow.read`；下游
  收到 `GET /internal/v1/workflow-instances/global` 且 query 名全为 camelCase
  声明集（`limit`/`lifecycle`/`status`/`definitionKey`/`currentNodeKey`/
  `assigneePrincipalId`/`beforeCreatedAt`/`beforeId`）。
- `ACC-002` → CTR-004：非合法调用者（无 READER 亦无 COORDINATOR）403 端到端
  透出（code = fixture 所模拟部署态的声明码
  `global_read_role_required` / `global_coordinator_required` + status=403 +
  request-id 保留，来自下游 `x-request-id`；fail-closed）。
- `ACC-003` → CTR-002：`limit=0` / `limit=21` 在 error-preservation 基线上
  本地 fail-fast `invalid_pagination`（token/业务 HTTP 计数 = 0）；在未落基线
  上透传后下游 422 `invalid_pagination` 保留。
- `ACC-004` → CTR-002/DEC-002：只给 `beforeCreatedAt` 不给 `beforeId`（half
  cursor）按声明转发，下游 422 `invalid_cursor` 保留；成对 cursor 正常翻页且
  结果含 `next_cursor`。
- `ACC-005` → CTR-003：携带 `assigneePrincipalId` 调用时，token subject /
  credential 不因参数变化（identity 来自 seam 的结构断言）。
- `ACC-006` → CTR-001/007：DEFAULT_MANIFESTS 计数 = 基线 +1（基线 df3b299 =
  13→14；domain-instances 姊妹已 accepted 合并并实现，计数调和已定）；全部
  broker 测试 PASS。
- `ACC-007` → CTR-005：manifest schema 校验过 validateManifest；operation http
  method = GET、无 idempotency flag 的静态断言。
- `ACC-008` → CTR-007：既有 capability manifest 与其 fixture 字节不变。
- `ACC-009` → CTR-008/DEC-008：manifest / 实现源静态断言——无任何
  agent/principal/会话标识字段或分支（通用工具），无任何 scheduler 绑定或
  mutation 面（Scheduler 零交集）。

（生产侧 AC-1..AC-8 型真机验收归 external authority
`SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1` §7；本地验收以上述
fixture 为准，不要求 test-app/生产环境。）

## 11. Alternatives and disposition

- `ALT-001` 单页枚举（沿用 first-batch cursor 不透出）— **否决**：全域跨 86
  Agent fleet 的多 Domain 枚举没有翻页即不可用；偏差被显式冻结且仅限本能力
  （DEC-002）。
- `ALT-002` 新增 svc-workflow 路由 — **否决**：端点已部署（STATE-002）；本任务
  明令不得新增路由。
- `ALT-003` Broker 侧角色判断/缓存 — **否决**：违反服务端唯一权威纪律
  （DEC-004；同族 DOMAIN_OWNER 先例同判）。
- `ALT-004` 直接读取 `~/.openclaw/credentials` 或直连 token 端点 — **否决**：
  违反 Broker-first 凭据链与 505-private 分区纪律（DEC-006）。
- `ALT-005` 身份模型演化弧（如实记录）：r2 引入 GLOBAL_WORKFLOW_READER 单授
  予方案 → r3 按 P0_USE_DEDICATED_WORKFLOW_DISPATCHER_IDENTITY 撤回（改
  coordinator-to-dispatcher，服务端 0 改动）→ **最终 OWNER_RULING =
  DUAL_GLOBAL_READER_MODEL 恢复并定稿 READER 方案**（双授予：HR 主身份 +
  Dispatcher；双方不获 COORDINATOR；服务端受控代码修改，无 migration）。
  本 Spec 以最终裁决为准；双码声明（global_read_role_required /
  global_coordinator_required）恢复。coordinator 授予任何 HR 谱系或 dispatcher
  的方案族全部 REJECTED。
- `ALT-006` 将本工具硬编码 HR / Dispatcher / 专属凭据路由 — **否决**：违反
  DEC-008 通用只读工具语义（服务端角色 verification 为唯一权威；HR 主身份与
  dispatcher 都是普通合法调用方，无专属路径）。

## 12. Migration, compatibility, and rollback

纯加法 manifest 数据；无 store、无状态、无 schema 破坏；不与任何 deploy/restart
耦合。回滚 = 移除该 manifest 导出与对应测试（单 commit 逆操作）。accept 不含
production apply 权限；生产可见性需独立部署授权（本 Spec 不授予）。

## 13. Open questions

Not applicable — 全部 normative 内容已冻结；外部时序（svc-workflow READER
修订的 production 部署先/后）已由 §3 双码时序声明消解；domain-instances
姊妹 Spec 已 accepted 合并并实现（计数调和见 ACC-006）。

## 14. Acceptance Record（2026-08-29，接入 执行轮）

ACCEPTANCE_TRANSACTION = LIFECYCLE_ONLY，ONE commit，ONE file（本文件）。

- 独立审计（接入 审计轮）：AUDIT_RESULT = **PASS**；HEAD_DRIFT = **NONE**；
  DEPENDENCY_MODEL = **CLEAN**；SERVICE_CONTRACT = **VERIFIED**；
  BROKER_CREDENTIAL_BOUNDARY = **VERIFIED**；IMPLEMENTATION_CLOSURE =
  **EXACT_TWO_FILES**；BLOCKERS = **NONE**；READY_FOR_ACCEPTANCE_FINALIZE =
  **YES**。
- accepted_reviewed_head = `cd7a9ae55dd0add8d619ccadabcdadc278124318`
  （PR #83 审计时 head；fresh fetch 后核对无漂移）。
- 规范性服务坐标（审计轮冻结）：SERVICE_SPEC =
  `fb54f9dfaeeec667b8ba72d56d8303390cd189a6`（svc-workflow accepted
  `SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1`，PR #14 merge）；
  SERVICE_IMPLEMENTATION = `bf875c265843b3e07570a96b734051e9cfe27a43`
  （svc-workflow PR #15 merge，兼容实现）。
- 语义变化 = STATUS_MIRROR_AND_PROVENANCE_ONLY：本事务仅翻转 status
  （proposed → accepted）与 implementation_authority（none → contracts）、
  记录 acceptance provenance（frontmatter 字段 + 头部引注 + 本节）；§1–§13
  全部冻结内容（§8 DEC-001..008、§9 CTR-001..008、§10 ACC-001..009、
  §11 ALT-001..006、§12/§13）逐字节保留；正文中先于 acceptance 的条件句按
  既有纪律作为历史记录原样保留。
- 授权生效语义：本 Spec merged on main 起成为本 scope 的唯一实现授权
  （§2/CTR-001 恰好两文件闭包：`packages/broker/src/capabilities/workflow.js` +
  `packages/broker/test/capabilities.test.js`）；实现 PR 不得修改本文件
  （GOVERNING_SPEC_UNMODIFIED）；`production_apply_authority = none` ——
  deploy / restart / 角色授予 / production state 变更仍需独立授权（HR 主身份
  READER 授予与专用 Dispatcher Agent 身份创建/授予均归 external authority
  `SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1` 及身份治理，不在本 Spec 授权面内）。
- 事务边界：DOCS_ONLY；PRODUCT_CODE_CHANGE = NONE；SERVER_CODE_CHANGE =
  NONE；PRODUCTION_CHANGE = NONE；packages/、scripts/、svc-workflow /
  auth-service 仓库、production、其他 PR 分支均不动；工作区既有 WIP 实现快照
  与未提交状态原样保留。
- Merge：本 commit 之后随即 mark ready 并 merge PR #83（merge commit 为本
  Spec 的 effective-on-main 坐标，记录于 merge 后的 main lineage）。
