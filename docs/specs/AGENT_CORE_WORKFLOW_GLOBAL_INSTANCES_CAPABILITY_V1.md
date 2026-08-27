---
spec_id: AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
date: 2026-08-27
scope:
  - packages/broker
governed_by:
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_HR_DISPATCHER_COORDINATOR_GRANT_V1
    revision: 5efcd814b981706652dcd3ca6c02471cf256239c
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1 — 全域实例只读枚举 Broker 能力

> 状态：**proposed**（revision 4：按 OWNER_RULING = DEDICATED_SYSTEM_AGENT_MODEL
> 与跨仓 authority 拆分 repin——base 同步到 main **e40c140**（含 PR #82
> error-preservation 实现，limit 校验单路径化）；external authority 改指
> SVC_WORKFLOW_HR_DISPATCHER_COORDINATOR_GRANT_V1 @ 5efcd81；本能力保持
> **通用 Coordinator 工具**——服务端 gate 维持部署现状「仅
> GLOBAL_WORKFLOW_COORDINATOR」，svc-workflow 0 改动；不得硬绑定 HR 主会话，
> 详见 DEC-008）。本 Spec 当前不授予任何实现、合并或 production apply 权限。
> `implementation_authority = none`；accept 仅开启按 §9 Contracts 的实现评审路径。
> 姊妹 Spec（未上 main、非本 Spec 的 parent）：`AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1`
>（proposed，domain 维度单页枚举）；两者共享 manifest 家族与错误保留纪律，实现时以
> main 实际基线做计数调和。

## 1. Goal

为持有 svc-workflow `GLOBAL_WORKFLOW_COORDINATOR` 角色（服务端强制）的任意
调用方提供一个、且仅一个新增 Broker 只读能力 `workflow_global_instances`——
**通用 Coordinator 工具，不绑定任何特定 Agent 会话**（DEC-008）——代理
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

- svc-workflow **0 改动**（路由/代码/迁移；端点已部署于 base 2ff81ae，
  mod.rs:119）。
- 任何角色授予/身份变更（由 external authority
  `SVC_WORKFLOW_HR_DISPATCHER_IDENTITY_V1` 独立治理；本能力对任意服务端
  Coordinator 凭据持有者通用，与该身份计划互不依赖）。
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
    2328fa6；**实现已合入 main e40c140（PR #82）**——validationError/
    minimum/maximum 校验、错误信封、脱敏、request-id 传递均已在 main 产品
    代码上生效）：本能力的错误信封（code/status/sanitized detail/requestId）、
    fail-closed 降级、broker-side limit 校验机制族直接继承其 R1–R5。
  - `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`：Broker-first 凭据链
    （trusted store → client_credentials → scoped token）为既有冻结语义。
- `external_authorities`：svc-workflow 侧的 coordinator 授予 Spec
  （proposed，5efcd81）— `interoperates_with`。外部引用不授予本地权威：该
  Spec 按 OWNER_RULING = DEDICATED_SYSTEM_AGENT_MODEL 与跨仓 authority 拆分，
  仅治理「现有 GLOBAL_WORKFLOW_COORDINATOR 角色授予专用 system Agent
  `agt_workflow-dispatcher-hr-agent` 的 principal + HR 主身份不获角色 +
  svc-workflow 0 改动」；其身份/Client/grant 由 mayf3/auth-service
  `AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1`（proposed，PR #31）治理；
  Agent/scheduler 面由 `AGENT_CORE_HR_DISPATCHER_V1`（proposed）治理。
  本能力不依赖上述任何 proposed Spec 即可实现与验收；落地后 dispatcher
  凭据与本能力天然兼容——凭据链对 Coordinator 通用，无需任何 per-agent 适配。
- **通用性时序声明**：本能力在任何时候都按部署现状的服务端契约工作
  （global gate = 仅 GLOBAL_WORKFLOW_COORDINATOR，错误码
  `global_coordinator_required`）；无部署时序分支。
- 实现叠加声明（**已收敛为单路径**）：本 Spec base = main e40c140（含
  PR #82 error-preservation 实现）。`limit` bounds
  （minimum/maximum/validationError）在 main schema 上即时生效——越界在
  token/HTTP 之前本地 fail-fast `invalid_pagination`；仅当下游 422 兜底路径
  保留为防御性回退（码已声明）。CTR-002 合同单一形态。

## 4. Current State

- `STATE-001` — dsh-agent-core main e40c140 上 Broker 暴露 12 个 capability
  manifests（workflow 读族 4 个：my_tasks / instance_detail / submission_history /
  my_domains），无任何 global 列表代理。basis: OBS-008。
- `STATE-002` — svc-workflow github/main 2ff81ae 已部署
  `GET /internal/v1/workflow-instances/global`，服务端强制
  `workflow.read` scope + `GLOBAL_WORKFLOW_COORDINATOR` 角色双闸（部署现状，
  external authority 维持其不变）。basis: OBS-001, OBS-003。
- `STATE-003` — 生产（2026-08-27 只读查询）：principal
  `dc702687-6515-4a2a-91ae-e572a9bbd766`（agt_hr-agent，active）当前无任何
  enabled global 角色绑定，且按 OWNER_RULING 冻结
  **HR_MAIN_COORDINATOR_ROLE = NO**（该身份永不因本 Spec 家族获得该角色）；
  其今日调用该端点必得 403 `global_coordinator_required`。basis: OBS-009。

## 5. Observations

服务端事实（svc-workflow github/main = 2ff81ae47ab068216bd0012fa0e76a45dd2fb572，
逐行 verified 2026-08-27）：

- `OBS-001` — 路由与 handler：`src/http/mod.rs:119` →
  `handlers/instances.rs:158-216` `global_list`；`require_scope(&principal,
  "workflow.read")` 于 instances.rs:177。
- `OBS-002` — wire 参数契约：`GlobalInstanceQuery`（`src/http/dto.rs:118-138`）
  `serde(rename_all = "camelCase", deny_unknown_fields)`：
  `beforeCreatedAt`、`beforeId`、`limit`、`definitionKey`、`lifecycle`、
  `currentNodeKey`、`assigneePrincipalId`（UUID）、`status`。
- `OBS-003` — 服务端授权：`WorkflowInstanceQueryService::list_global_instances`
  （`query_service.rs:103-131`）先 `check_global_workflow_coordinator(actor)`
  （`query_visibility.rs:54-65`，谓词 = 仅
  `GLOBAL_WORKFLOW_COORDINATOR` AND enabled=TRUE）；非持有者 →
  `WorkflowQueryError::GlobalCoordinatorRequired` → HTTP 403
  `global_coordinator_required`（`error.rs:516-519`）。该 gate 为部署现状，
  external authority（SVC_WORKFLOW_HR_DISPATCHER_COORDINATOR_GRANT_V1，
  5efcd81）维持
  服务端 0 改动。
- `OBS-004` — limit 服务端边界：default 20、0 或 >100 → 422
  `invalid_pagination`（`query_global_instances.rs:14-26`；纯 SELECT 投影，
  零写入）。
- `OBS-005` — cursor 复合纪律：`beforeCreatedAt`（RFC 3339）与 `beforeId`
  （UUID）**同给或同缺**；half-cursor / 畸形值 → 422 `invalid_cursor`
  （`instances.rs:218-251`）。
- `OBS-006` — lifecycle/status 枚举：`lifecycle ∈ {active, terminal, all}`、
  `status ∈ {active, cancelled, archived, all}`；非法值 → 422 `invalid_lifecycle`
  / `invalid_status`（`dto.rs:160/189`）。默认语义：二者全缺省 → status=active；
  仅 lifecycle 给定 → status=all（`instances.rs:188-195`）。
- `OBS-007` — Broker 身份纪律（main e40c140）：transport 从不读 `args` 里的
  identity，credential 只来自 trusted identity seam（`transport.js:30`；
  `credential.js:28` `ctx.credentials.resolve`；`transport.js:106` MachineClient
  credential from trusted store）；token 按 manifest.requiredScopes 请求。
- `OBS-008` — main e40c140（含 PR #82）：`schema.js` 已含
  minimum/maximum/validationError 校验（error-preservation 实现已合入）；
  `capabilities.test.js:115` 断言 manifests 计数 = 12；broker 测试基线 159。
- `OBS-009` — 生产只读查询（auth-service DB，2026-08-27）：
  `agt_hr-agent` → principal `dc702687-6515-4a2a-91ae-e572a9bbd766`（active，
  HR助手）；现有绑定 = DOMAIN_OWNER×1（hr-onboarding）+ DOMAIN_MEMBER×8；无
  global 绑定；fleet roster = 86 Agents。**scope 事实（OWNER_RULING 证据）**：
  该 principal 的 client `mc_IuBMfCYe9-b522IhSWKBGjyz`（active）的
  machine_access_grants v2 = **{workflow.read, workflow.execute}**（未撤销）；
  另有 legacy 谱系 principal `bc970ced-710f-4479-9ff0-e295a1c59424`
  （openclaw:agent:hr-agent）持 active client
  `mc_4Ud_9wGR1mwQM9W7s7foX8qp`（{workflow.admin, workflow.read,
  workflow.execute}）——故该角色不得授予 HR 主身份；只读全局查看改由
  **专用 system Agent**（agt_workflow-dispatcher-hr-agent；grant 仅
  {workflow.read} + agent-wake + COORDINATOR 角色，
  结构性不可达写端点）实现，见 external authority。

## 6. Claims and assumptions

- `CLM-001` SUPPORTED — 新增 manifest 为纯数据零新机制：DEFAULT_MANIFESTS 自动
  纳入，child 模式 relay / gateway 模式 transport 均走既有泛型路径（同族
  first-batch + domain-instances 姊妹 Spec 的同一结论；basis: OBS-008）。
- `CLM-002` SUPPORTED — transport 只转发 manifest 声明的 query 名，未声明参数
  物理上到不了 svc-workflow（deny_unknown_fields 兜底前移）。basis: OBS-002/007。
- `CLM-003` SUPPORTED（dual-path 声明消除 OPEN 假设）— §3 的两条演化路径均使
  CTR-002 成立；无待定实现假设。

## 7. Evidence relations

- `EVD-001`：OBS-001/002/003/004/005/006（svc-workflow 2ff81ae 源码行证）→
  支撑 STATE-002 与 §9 全部参数/错误 Contracts。
- `EVD-002`：OBS-007（main e40c140 broker 源码行证）→ 支撑 CTR-003（身份不可
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
- `DEC-004` 授权语义：完全服务端权威——`GLOBAL_WORKFLOW_COORDINATOR` 由
  svc-workflow `check_global_workflow_coordinator` 谓词强制（部署现状，0 改动）；
  非 Coordinator → **fail-closed** 403 `global_coordinator_required`（码声明并
  按 error-preservation R1 保留 status/detail/request-id）。Broker 不做、不复制、
  不缓存任何角色判断，不提供任何以放宽该语义为效果的参数或路径。
- `DEC-008` 通用工具语义（P0 Ruling）：本能力是**通用 Coordinator 工具**——
  调用者身份 = 当前会话经 trusted credential seam 解析出的凭据（OBS-007），
  服务端 Coordinator verification 是唯一授权权威；manifest / 实现中**不得**
  出现任何 HR 主会话、特定 Agent、特定 principal 的硬绑定、特判或 wiring
  （无 per-agent 路由、无 identity 参数、无 HR 专属分支）。未来的
  `agt_workflow-dispatcher-hr-agent` 凭据（external authority 计划）只是又一个
  普通 Coordinator 调用方，不获任何特殊路径。
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
  `global_coordinator_required`、
  `invalid_pagination`、`invalid_cursor`、
  `invalid_lifecycle`、`invalid_status`、`internal_consistency_error`、
  `service_unavailable`（`invalid_lifecycle`/`invalid_status` 为本能力新增声明，
  因本能力首次透出对应参数；canonical `http_4xx`/`http_5xx` 由
  `withTransportErrors` 机制保证）。超出闭包的改动不在本 Spec 授权内。
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
  非 Coordinator 403 `global_coordinator_required` 端到端保留 code + status +
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
- `ACC-002` → CTR-004：非 Coordinator（无 GLOBAL_WORKFLOW_COORDINATOR 绑定）
  403 `global_coordinator_required` 端到端透出（code + status=403 +
  request-id 保留，来自下游 `x-request-id`；fail-closed）。
- `ACC-003` → CTR-002：`limit=0` / `limit=21` 在 error-preservation 基线上
  本地 fail-fast `invalid_pagination`（token/业务 HTTP 计数 = 0）；在未落基线
  上透传后下游 422 `invalid_pagination` 保留。
- `ACC-004` → CTR-002/DEC-002：只给 `beforeCreatedAt` 不给 `beforeId`（half
  cursor）按声明转发，下游 422 `invalid_cursor` 保留；成对 cursor 正常翻页且
  结果含 `next_cursor`。
- `ACC-005` → CTR-003：携带 `assigneePrincipalId` 调用时，token subject /
  credential 不因参数变化（identity 来自 seam 的结构断言）。
- `ACC-006` → CTR-001/007：DEFAULT_MANIFESTS 计数 = 基线 +1（基线 e40c140 =
  12→13；若 domain-instances 姊妹先合并则 13→14，以实现时 main 实测为准）；全部
  broker 测试 PASS。
- `ACC-007` → CTR-005：manifest schema 校验过 validateManifest；operation http
  method = GET、无 idempotency flag 的静态断言。
- `ACC-008` → CTR-007：既有 capability manifest 与其 fixture 字节不变。
- `ACC-009` → CTR-008/DEC-008：manifest / 实现源静态断言——无任何
  agent/principal/会话标识字段或分支（通用工具），无任何 scheduler 绑定或
  mutation 面（Scheduler 零交集）。

（生产侧 AC-1..AC-8 型真机验收归 external authority
`SVC_WORKFLOW_HR_DISPATCHER_IDENTITY_V1` §7；本地验收以上述
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
- `ALT-005` 引入 GLOBAL_WORKFLOW_READER 角色 + 服务端 gate/错误码变更
  （本 Spec revision 2 方案）— **否决 per OWNER_RULING =
  P0_USE_DEDICATED_WORKFLOW_DISPATCHER_IDENTITY**：只读性改由独立 dispatcher
  身份的 credential scope 分离结构性实现，服务端 0 改动、无错误码 churn；
  双码声明（global_read_role_required/global_coordinator_required）随 READER
  方案一并撤回。
- `ALT-006` 将本工具硬绑定 HR 主会话 / HR 专属凭据路由 — **否决**：违反
  DEC-008 通用工具语义（服务端 Coordinator verification 为唯一权威；HR 主身份
  按 P0 Ruling 亦不持有该角色，绑定无意义且越权）。

## 12. Migration, compatibility, and rollback

纯加法 manifest 数据；无 store、无状态、无 schema 破坏；不与任何 deploy/restart
耦合。回滚 = 移除该 manifest 导出与对应测试（单 commit 逆操作）。accept 不含
production apply 权限；生产可见性需独立部署授权（本 Spec 不授予）。

## 13. Open questions

Not applicable — 全部 normative 内容已冻结；唯一外部时序（error-preservation
实现与 domain-instances 姊妹 Spec 谁先落 main）已由 §3 dual-path 与 ACC-006 的
基线实测规则消解。
