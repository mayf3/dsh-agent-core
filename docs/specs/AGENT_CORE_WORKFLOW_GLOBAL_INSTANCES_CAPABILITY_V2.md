---
spec_id: AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
date: 2026-08-29
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
supersedes:
  - AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2 — 全域实例只读枚举 Broker 能力（dedicated test home successor）

> 状态：**proposed**。本轮只提交 docs-only Draft PR，不实现、不接受、不 merge。
> `PRODUCT_CODE_CHANGE = NONE`；`PRODUCTION_CHANGE = NONE`。
>
> **WHOLE-SPEC SUCCESSOR。** 本 Spec 是
> `AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V1`（accepted，PR #83 merge
> `32cd0f3`）的 whole successor。本 authoring 轮 V1 保持 `status: accepted`、
> `superseded_by: null` 不动；backlink 翻转（`V1.superseded_by -> 本 Spec`）保留给
> 未来本 Spec 的原子 acceptance 事务，且必须与 `V2.status: proposed -> accepted`
> 原子同事务完成（SPEC_FORMAT_V0 §2.7；Forum Moderation V1→V2 同一先例）。本 Spec
> 完整重述 V1 的产品合同，独立可读、独立可实现，绝不依赖「V1 继续适用，除了……」。
>
> **与 V1 的唯一差异 = 实现闭包的测试落点与 inventory 归属（结构协调），产品合同
> 零变化。** V1 §2/CTR-001 冻结的两文件闭包要求编辑 744 行、未登记 legacy 的
> `packages/broker/test/capabilities.test.js`，使一切实现都被 active
> `CODE_STRUCTURE_GUARDRAILS_V1` 的 `UNREGISTERED_LEGACY_TOUCHED` 死锁（PR #101
> Draft 即此 blocker）。本 Spec 把测试落点改到 shared decomposition
> （PR #107，`AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1`）DEC-006 冻结的
> dedicated home `packages/broker/test/capabilities/workflow-global-instances-v2.test.js`，
> 并把 aggregate manifest 计数断言（13→14）的唯一落点改到该 decomposition DEC-003
> 冻结的 aggregate owner
> `packages/broker/test/capabilities/manifest-inventory.test.js`。工具合同、wire
> 参数、错误表、授权语义、DEC-001..008 / CTR-002..008 语义逐字继承 V1（见 §8/§9）。
>
> **8-path decomposition pin（PR #107 exact closure，逐字冻结）。** 本 Spec pin
> dsh-agent-core PR #107（branch
> `docs/broker-capabilities-shared-decomposition-spec`，authoring-round reviewed head
> `deda45d87635c577be37d6402ba1c26c8a483428`，
> `AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1` §5）的 exact 8-path
> 实现闭包：
>
> ```text
> D packages/broker/test/capabilities.test.js
> A packages/broker/test-support/capability-fixtures.js
> A packages/broker/test/capabilities/manifest-inventory.test.js
> A packages/broker/test/capabilities/forum.test.js
> A packages/broker/test/capabilities/okr.test.js
> A packages/broker/test/capabilities/workflow-instances.test.js
> A packages/broker/test/capabilities/workflow-my-tasks.test.js
> A packages/broker/test/capabilities/workflow-transition.test.js
> ```
>
> 本 Spec 不实现、不修改、不预先创建上述任何 path；本 Spec 的实现前置 = 该
> decomposition 已 accepted 且其 exact 8-path 实现已 merge 到 main（§14 序列）。

## 1. Goal

为持有 svc-workflow global 只读角色（目标契约：`GLOBAL_WORKFLOW_READER` 或
`GLOBAL_WORKFLOW_COORDINATOR`，服务端强制）的任意调用方提供一个、且仅一个新增
Broker 只读能力 `workflow_global_instances`——**通用只读工具，不硬编码 HR 或
Dispatcher，不绑定任何特定 Agent 会话**（DEC-008）——代理 svc-workflow **已部署**
的 `GET /internal/v1/workflow-instances/global`，使其可经 Broker-first 凭据链枚举
**所有 Domain** 的 workflow 实例摘要。授权判断完全在 svc-workflow 服务端；
Broker 不复制、不放宽、不缓存任何权限语义。

（与 V1 §1 目标逐字一致；本 Spec 的增量目标只有结构协调一项：把该能力的实现
测试落点与 inventory 计数从 legacy 聚合文件迁移到 decomposition 冻结的
dedicated/aggregate home，解除 `UNREGISTERED_LEGACY_TOUCHED` 死锁。）

## 2. Scope and non-goals

In scope（accept 后的实现面，恰好两文件 + 一处 aggregate 计数调整）：

- `packages/broker/src/capabilities/workflow.js`：新增
  `workflowGlobalInstancesManifest`（纯数据 manifest），加入 `manifests` 导出数组。
  （与 V1 相同。）
- `packages/broker/test/capabilities/workflow-global-instances-v2.test.js`：
  本能力全部 fixture 测试（§10）的**唯一**落点——decomposition DEC-006/ACC-008
  冻结的 dedicated home，由首次获授权的本 Spec 实现创建（decomposition 本身不
  创建该空 placeholder）。
- `packages/broker/test/capabilities/manifest-inventory.test.js`：aggregate
  manifest 计数断言 **13→14** 的唯一调整点——decomposition DEC-003 冻结该文件为
  aggregate inventory 的唯一 owner；本 Spec 是「后续 capability PR 只能在其
  governing Spec 明确授权时单独调整 inventory count」规则的首次行使（授权值 =
  14）。

**本 Spec 不以 `packages/broker/test/capabilities.test.js` 作为任何实现落点、
测试落点或闭包成员**（V1 正是因此死锁，OBS-010）；该文件在实现前置完成时已被
decomposition 8-path 闭包删除，物理上不存在。本 Spec 中该字面路径只出现于
非授权语境——8-path pin 的 D 行、死锁动机与 STATE/OBS 历史事实坐标、
ACC/DEC/CTR/ALT 的负面禁止与 rejected-alternative 记录、§14 前置描述——
零处作为实现落点授权（审计可按「实现闭包/授权语境出现次数 = 0」机械复核）。

Out of scope / 明确不授权（与 V1 逐字一致，另加结构协调边界）：

- 本 Spec 不授权任何 svc-workflow 改动（external authority 另行治理其受控
  角色注入/gate 代码修改；端点本身已部署，无新路由）。
- 任何角色授予/身份变更（由 external authority
  `SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1` 独立治理；本能力对任意服务端合法
  调用者（READER 或 COORDINATOR 凭据持有者）通用，与任何具体授予互不依赖）。
- 写面：transition / assignment / Domain / provisioning 一概不触及；
  无 POST/PUT/DELETE 绑定、无 Idempotency-Key；**不含任何 Scheduler 写操作**
  （无 scheduler mutation 面、无 job 触发面——本能力与 Scheduler 系统零交集）。
- `workflow.execute` 或任何 scope 提升；本能力 requiredScopes 仅 `workflow.read`。
- 其他既有 capability 的 cursor 透出回溯变更（first-batch「cursor 不透出」纪律对
  既有能力维持不变；本能力的 cursor 透出是**仅限本能力**的显式偏差，见 DEC-002）。
- production deploy / restart / job / store 变更（`production_apply_authority = none`）。
- 其余 85 个 fleet Agent 的任何变化（本 Spec 是 Broker 通用能力面，不含任何
  per-agent 配置）。
- **结构协调边界（本 Spec 新增）**：不实现、不修改、不预创建 decomposition 的
  8-path 闭包任何成员；不修改 `.agents/structure-registry.json` 或
  `CODE_STRUCTURE_GUARDRAILS_V1` 规则（decomposition DEC-007 同判）；不修改、
  不关闭、不 merge PR #101（其按 V1 旧闭包实现，处置见 §14）；不实现
  Domain Pagination V2、Transition amendment 或任何姊妹协调 Spec 的内容。

## 3. Authority and dependencies

- `governed_by`（均已 accepted，本地权威；与 V1 一致）：
  - `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`（accepted via PR #68
    2328fa6；实现已合入 main（PR #82 @ e40c140，当前 main f54679c 保有））：
    本能力的错误信封（code/status/sanitized detail/requestId）、fail-closed
    降级、broker-side limit 校验机制族直接继承其 R1–R5。
  - `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1`：Broker-first 凭据链
    （trusted store → client_credentials → scoped token）为既有冻结语义。
- `external_authorities`：svc-workflow 侧的最终双读者角色 Spec
  （**accepted**，PR #14 merge `fb54f9dfaeeec667b8ba72d56d8303390cd189a6`；
  兼容服务实现已合并：PR #15 merge
  `bf875c265843b3e07570a96b734051e9cfe27a43`）— `interoperates_with`。外部引用
  不授予本地权威；该 Spec 按 OWNER_RULING = DUAL_GLOBAL_READER_MODEL（最终）引入
  `GLOBAL_WORKFLOW_READER` 只读角色（唯一许可面 = global instance list），服务端
  gate = READER OR COORDINATOR，写族维持仅 COORDINATOR；双冻结授予对象 = HR 主
  身份与专用 Dispatcher Agent，双方均不获 COORDINATOR；legacy bc970ced 禁授。
  身份/Client/grant 治理与 Agent/scheduler 执行面治理均在本 Spec 依赖面之外。
  本能力的实现与本地验收不等待该 READER 修订的 production 部署（双码时序声明
  见下）。
- **错误码时序声明（与 V1 一致）**：broker 实现可在 svc-workflow READER 修订
  部署之前或之后落地。修订部署前服务端 gate 失败码为
  `global_coordinator_required`，部署后为 `global_read_role_required`——两码均在
  本能力错误表声明（CTR-001），两种时序下错误保留纪律均成立；最终目标契约为
  `global_read_role_required`。
- **结构协调依赖（本 Spec 新增；非产品依赖）**：本 Spec 的测试落点与 inventory
  归属决策来源于 shared decomposition Spec
  `AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1`（PR #107，authoring 轮
  reviewed head `deda45d87635c577be37d6402ba1c26c8a483428`，status proposed——
  非 `governed_by` 成员：该 Spec 未 accepted，且其自身 §8 步骤 3 将本类 successor
  列为其 authority-reconciliation 前置而非下游）。若该 decomposition Spec 在
  acceptance 前发生 §5 8-path 闭包或 DEC-006 home 表的实质修订，本 Spec 必须
  同步 amendment 后才可进入 acceptance。

## 4. Current State

- `STATE-001` — dsh-agent-core current main `f54679c`（2026-08-29 fresh fetch 实测）
  上 Broker 暴露 13 个 capability manifests（workflow 读族 5 个：my_tasks /
  instance_detail / submission_history / my_domains / domain_instances），无任何
  global 列表代理。basis: OBS-008。
- `STATE-002` — svc-workflow 已部署
  `GET /internal/v1/workflow-instances/global`（端点自 2ff81ae 起在部署面），
  服务端强制 `workflow.read` scope + global 只读角色双闸（已合并源码 bf875c2：
  `GLOBAL_WORKFLOW_READER` OR `GLOBAL_WORKFLOW_COORDINATOR`，失败码
  `global_read_role_required`；该修订 production 部署完成前的过渡部署态：仅
  `GLOBAL_WORKFLOW_COORDINATOR`，失败码 `global_coordinator_required`）。basis:
  OBS-001, OBS-003。
- `STATE-003` — 生产（2026-08-27 只读查询）：principal
  `dc702687-6515-4a2a-91ae-e572a9bbd766`（agt_hr-agent，active）当前无任何
  enabled global 角色绑定。按最终 Ruling 计划：**HR_GLOBAL_READER = YES**，
  HR_GLOBAL_COORDINATOR = NO；专用 Dispatcher 计划
  DISPATCHER_GLOBAL_READER_PLAN = YES（UUID 回填前不得 apply），
  DISPATCHER_GLOBAL_COORDINATOR = NO。basis: OBS-009。
- `STATE-004`（本 Spec 新增）— 结构基线（main `f54679c`，2026-08-29 实测）：
  `packages/broker/test/capabilities.test.js` = 744 physical lines、18 个 test
  block、未登记 structure-registry legacy；packages/broker `node --test` =
  173/173 PASS；`npm run verify:structure`（pristine main）= PASS / 0
  violations；df3b299→f54679c 之间 main 无任何 packages/ 或 scripts/ 变化
  （纯 docs commits）。V1 旧闭包对该文件的任何 touch 都触发
  `UNREGISTERED_LEGACY_TOUCHED`——PR #101（Draft）已实测复现。basis: OBS-010。

## 5. Observations

服务端事实（svc-workflow github/main = `bf875c265843b3e07570a96b734051e9cfe27a43`
（PR #15 merge）；HTTP 路由/DTO 面自 2ff81ae 起未变；V1 于 2026-08-29 逐行
re-verified，本 Spec 继承其验证，坐标不变）：

- `OBS-001` — 路由与 handler：`src/http/mod.rs:119-120` →
  `handlers/instances.rs:165` `global_list`；
  `require_scope(&principal, "workflow.read")` 于 instances.rs:177。
- `OBS-002` — wire 参数契约：`GlobalInstanceQuery`（`src/http/dto.rs:125-138`）
  `serde(rename_all = "camelCase", deny_unknown_fields)`：
  `beforeCreatedAt`、`beforeId`、`limit`、`definitionKey`、`lifecycle`、
  `currentNodeKey`、`assigneePrincipalId`（UUID）、`status`。
- `OBS-003` — 服务端授权（bf875c2 已合并实现）：
  `WorkflowInstanceQueryService::list_global_instances`
  （`query_service.rs:111-131`）先
  `query_visibility::check_global_workflow_read_role(...)`
  （`src/store/postgres/workflow_instance_repository/query_visibility.rs:60-68`，
  谓词 = `role_key IN ('GLOBAL_WORKFLOW_READER','GLOBAL_WORKFLOW_COORDINATOR')`）；
  非持有者 → `WorkflowQueryError::GlobalCoordinatorRequired` → HTTP 403
  `global_read_role_required`（`error.rs:516-519`）。修订 production 部署完成前的
  既有部署态仍发 403 `global_coordinator_required`；coordinator 写端点与
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
  / `invalid_status`（`dto.rs:160/189`）。默认语义：二者全缺省 → status=active；
  仅 lifecycle 给定 → status=all（`instances.rs:185-192`）。

Broker 侧事实（V1 pin 于 main df3b299；本 Spec 在 current main `f54679c`
re-verified——df3b299→f54679c 无产品代码变化，全部行号锚点复核有效）：

- `OBS-007` — Broker 身份纪律：transport 从不读 `args` 里的 identity，credential
  只来自 trusted identity seam（`transport.js:47-48` identity-neutral 纪律声明；
  `credential.js:26-29` `ctx.credentials.resolve` 契约；`transport.js:124`
  MachineClient credential from trusted store、`:604`
  `credentialProvider.getCredential()`）；token 按 manifest.requiredScopes 请求。
- `OBS-008` — schema/基线：`schema.js` 已含 minimum/maximum/validationError 校验
  （`schema.js:175-182` 声明检查 / `:301-302` 越界 fail-fast）；
  aggregate manifests 计数现值 = 13（现由
  `packages/broker/test/capabilities.test.js:116-118` 断言
  `[...forumManifests, ...workflowManifests, ...okrManifests].length = 13`；该
  断言按 decomposition DEC-003 迁往 `manifest-inventory.test.js` 后由本 Spec
  授权调整为 14）；broker 测试基线 173（packages/broker `node --test`，
  2026-08-29 fresh-main f54679c 实测 173 pass / 0 fail）。
- `OBS-009` — 生产只读查询（auth-service DB，2026-08-27）：
  `agt_hr-agent` → principal `dc702687-6515-4a2a-91ae-e572a9bbd766`（active，
  HR助手）；现有绑定 = DOMAIN_OWNER×1（hr-onboarding）+ DOMAIN_MEMBER×8；无
  global 绑定；fleet roster = 86 Agents。scope 事实：该 principal 的 client
  `mc_IuBMfCYe9-b522IhSWKBGjyz`（active）的 machine_access_grants v2 =
  **{workflow.read, workflow.execute}**（未撤销）；另有 legacy 谱系 principal
  `bc970ced-710f-4479-9ff0-e295a1c59424`（openclaw:agent:hr-agent）持 active
  client（{workflow.admin, workflow.read, workflow.execute}）——故 COORDINATOR
  不得授予任何 HR 谱系身份；最终模型 = DUAL_GLOBAL_READER。
- `OBS-010`（本 Spec 新增）— 结构死锁事实（main `f54679c` 实测 + PR #101 报告）：
  active verifier 机械语义 = head 中仍超 500 行的 base legacy 文件只要被触及且
  registry 无 entry 即报 `UNREGISTERED_LEGACY_TOUCHED`，净增/净零/净减均不改判；
  `capabilities.test.js`（744 行、未登记）即该类文件。V1 闭包要求 touch 它
  （计数 +1 与新 fixtures 均在其内），故 V1 闭包与 guardrails 结构性互斥；唯一
  已裁决出路 = shared decomposition（PR #107）+ 本类 authority reconciliation。
  basis: STATE-004、PR #101 KNOWN_CONFLICT 段、decomposition §2。

## 6. Claims and assumptions

- `CLM-001` SUPPORTED — 新增 manifest 为纯数据零新机制：DEFAULT_MANIFESTS 自动
  纳入，child 模式 relay / gateway 模式 transport 均走既有泛型路径。basis:
  OBS-008。
- `CLM-002` SUPPORTED — transport 只转发 manifest 声明的 query 名，未声明参数
  物理上到不了 svc-workflow（deny_unknown_fields 兜底前移）。basis: OBS-002/007。
- `CLM-003` SUPPORTED — 外部时序均被显式声明消解：error-preservation 实现已
  落地 main；svc-workflow READER 修订已合并（bf875c2），其 production 部署的
  先/后由双码声明覆盖（§3）。无待定实现假设。
- `CLM-004`（本 Spec 新增）SUPPORTED — 结构协调可行：decomposition PR #107 的
  scratch probe 已实测其 8-path 闭包（1 delete + 7 add，各新文件 <500 行，
  18/18 moved tests PASS，173/173 Broker PASS，test-block byte identity
  SHA-256 `e4c0e7971f43c7f5ad0e7f25d30f371da9da9fa584ef4d2444b52b4ef02901a4` 前
  后一致，structure gate PASS / 0 violations）；本 Spec 的 dedicated home 与
  aggregate inventory 落点均为该闭包显式预留（DEC-006 home 表 + DEC-003 唯一
  owner），无新增机制需求。basis: OBS-010、PR #107 §6。

## 7. Evidence relations

- `EVD-001`：OBS-001/002/003/004/005/006（svc-workflow bf875c2 源码行证）→
  支撑 STATE-002 与 §9 全部参数/错误 Contracts。
- `EVD-002`：OBS-007（main f54679c broker 源码行证）→ 支撑 CTR-003（身份不可
  替换）与 CTR-006（Broker-first 凭据）。
- `EVD-003`：OBS-008 → 支撑 STATE-001、CLM-001。
- `EVD-004`：OBS-009（生产只读查询）→ 支撑 STATE-003 与 external authority 的
  negative control 现状。
- `EVD-005`（本 Spec 新增）：OBS-010 + STATE-004（main f54679c 结构实测）+
  PR #107 §6 scratch evidence → 支撑 CLM-004 与 §14 sequencing 前置的可满足性。

## 8. Decisions

**DEC-001..008 与 V1 逐字一致（产品合同冻结重述）。**

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
- `DEC-008` 通用工具语义（最终 Ruling）：本能力是**通用只读工具**——调用者身份
  = 当前会话经 trusted credential seam 解析出的凭据（OBS-007），服务端角色
  verification 是唯一授权权威；manifest / 实现中**不得**出现任何 HR 主会话、
  Dispatcher、特定 Agent、特定 principal 的硬绑定、特判或 wiring（无 per-agent
  路由、无 identity 参数、无专属分支）。HR 主会话（获 READER 后）与
  `agt_workflow-dispatcher-hr-agent` 都只是本工具的普通合法调用方，不获任何特殊
  路径。
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
- `DEC-009`（本 Spec 新增；结构协调）dedicated test home + aggregate inventory
  唯一调整权：本能力全部 fixture 测试唯一落点 =
  `packages/broker/test/capabilities/workflow-global-instances-v2.test.js`
  （decomposition DEC-006 home 表 Global Instances V2 行，逐字采用）；aggregate
  manifest 计数 13→14 的唯一调整点 =
  `packages/broker/test/capabilities/manifest-inventory.test.js`（decomposition
  DEC-003）。实现前置 = decomposition 8-path 已 merge（§14）。禁止：在
  dedicated home 之外新增本能力 fixture；借 inventory 调整顺手接入/删除/重排
  其他 manifest；重新创建 `capabilities.test.js` 或其任何 shim/re-export/
  loader/同名替代（decomposition DEC-001 同判）。

## 9. Contracts

- `CTR-001`（实现闭包；**与 V1 的唯一合同差异**）— 恰好两文件：
  `packages/broker/src/capabilities/workflow.js`（新增
  `workflowGlobalInstancesManifest` 纯数据 + `manifests` 数组追加）与
  `packages/broker/test/capabilities/workflow-global-instances-v2.test.js`
  （新建，本能力全部 fixture，见 §10）；另在
  `packages/broker/test/capabilities/manifest-inventory.test.js` 内将 aggregate
  计数断言 13→14（该文件其余 assertion 语义不变）。manifest 错误表声明：
  `invalid_arguments`、`unsupported_operation`、`unauthenticated`、`forbidden`、
  `principal_not_found`、`principal_disabled`、`global_coordinator_required`、
  `global_read_role_required`、`invalid_pagination`、`invalid_cursor`、
  `invalid_lifecycle`、`invalid_status`、`internal_consistency_error`、
  `service_unavailable`（`invalid_lifecycle`/`invalid_status` 为本能力新增声明，
  因本能力首次透出对应参数；`global_read_role_required` 为 external authority
  修订部署后的目标契约码，`global_coordinator_required` 为修订前部署的过渡
  现实码——双码并申以覆盖 §3 时序声明的两种部署态；canonical `http_4xx`/
  `http_5xx` 由 `withTransportErrors` 机制保证）。超出闭包的改动不在本 Spec
  授权内。
- `CTR-002`（参数校验）— `limit` 声明 `{type:'integer', minimum:1, maximum:20,
  validationError:'invalid_pagination'}`；越界在任何 token/HTTP 请求之前本地
  fail-fast；枚举/UUID/RFC3339 格式校验不在 broker 复制——非法值透传后由下游
  422 已声明码拒绝（fail-closed 保留 status/detail/requestId）。
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
- `CTR-009`（本 Spec 新增；dedicated home 纪律）— 实现必须且只能新建
  `packages/broker/test/capabilities/workflow-global-instances-v2.test.js` 作为
  本能力 fixture 的唯一文件（该文件在实现前置完成时不存在——decomposition
  明确不创建该 placeholder，ACC-008）；diff 中不得出现
  `packages/broker/test/capabilities.test.js`（已被前置删除，不存在可 touch
  对象）；`manifest-inventory.test.js` 的改动仅限计数断言值 13→14 与因新
  manifest 加入 aggregate 数组所需的导入（若有），不得改动其 validation
  assertion 语义。

## 10. Acceptance

- `ACC-001` → CTR-001/006：fixture 中 token 请求 scope=`workflow.read`；下游
  收到 `GET /internal/v1/workflow-instances/global` 且 query 名全为 camelCase
  声明集（`limit`/`lifecycle`/`status`/`definitionKey`/`currentNodeKey`/
  `assigneePrincipalId`/`beforeCreatedAt`/`beforeId`）。
- `ACC-002` → CTR-004：非合法调用者（无 READER 亦无 COORDINATOR）403 端到端
  透出（code = fixture 所模拟部署态的声明码
  `global_read_role_required` / `global_coordinator_required` + status=403 +
  request-id 保留，来自下游 `x-request-id`；fail-closed）。
- `ACC-003` → CTR-002：`limit=0` / `limit=21` 本地 fail-fast
  `invalid_pagination`（token/业务 HTTP 计数 = 0）。
- `ACC-004` → CTR-002/DEC-002：只给 `beforeCreatedAt` 不给 `beforeId`（half
  cursor）按声明转发，下游 422 `invalid_cursor` 保留；成对 cursor 正常翻页且
  结果含 `next_cursor`。
- `ACC-005` → CTR-003：携带 `assigneePrincipalId` 调用时，token subject /
  credential 不因参数变化（identity 来自 seam 的结构断言）。
- `ACC-006` → CTR-001/007（**落点更新，语义同 V1**）：aggregate manifest 计数
  断言 = 13→14，唯一落点 `manifest-inventory.test.js`（协调序见 §14：本 +1
  先于 Transition 的 14→15；Pagination V2 不改变计数）；全部 broker 测试 PASS
  （数值基线以实现时 fresh main 为准——decomposition 后基线不含
  capabilities.test.js，test 文件与 test 数以 gate 输出为准，不硬编码 173）。
- `ACC-007` → CTR-005：manifest schema 校验过 validateManifest；operation http
  method = GET、无 idempotency flag 的静态断言。
- `ACC-008` → CTR-007：既有 capability manifest 与其 fixture 字节不变。
- `ACC-009` → CTR-008/DEC-008：manifest / 实现源静态断言——无任何
  agent/principal/会话标识字段或分支（通用工具），无任何 scheduler 绑定或
  mutation 面（Scheduler 零交集）。
- `ACC-010`（本 Spec 新增）→ CTR-009/DEC-009：diff name-status 恰为
  CTR-001 闭包（workflow.js + 新建 dedicated home + manifest-inventory 计数
  调整）；`packages/broker/test/capabilities.test.js` 不出现于 diff；structure
  gate（vs 实现基线）exit 0 / 0 violations；dedicated home 文件 <500 physical
  lines。

（生产侧 AC-1..AC-8 型真机验收归 external authority
`SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1` §7；本地验收以上述 fixture 为准，
不要求 test-app/生产环境。）

## 11. Alternatives and disposition

- `ALT-001` 单页枚举（沿用 first-batch cursor 不透出）— **否决**：全域跨 86
  Agent fleet 的多 Domain 枚举没有翻页即不可用；偏差被显式冻结且仅限本能力
  （DEC-002）。
- `ALT-002` 新增 svc-workflow 路由 — **否决**：端点已部署（STATE-002）；无新
  路由授权。
- `ALT-003` Broker 侧角色判断/缓存 — **否决**：违反服务端唯一权威纪律
  （DEC-004；同族 DOMAIN_OWNER 先例同判）。
- `ALT-004` 直接读取 `~/.openclaw/credentials` 或直连 token 端点 — **否决**：
  违反 Broker-first 凭据链与 505-private 分区纪律（DEC-006）。
- `ALT-005` 身份模型演化弧（如实记录）：r2 单授 READER → r3 撤回改
  coordinator-to-dispatcher → **最终 OWNER_RULING = DUAL_GLOBAL_READER_MODEL
  定稿**（双授予：HR 主身份 + Dispatcher；双方不获 COORDINATOR；服务端受控
  代码修改，无 migration）。coordinator 授予任何 HR 谱系或 dispatcher 的方案族
  全部 REJECTED。
- `ALT-006` 将本工具硬编码 HR / Dispatcher / 专属凭据路由 — **否决**：违反
  DEC-008 通用只读工具语义。
- `ALT-007`（本 Spec 新增）维持 V1 闭包（继续编辑 capabilities.test.js）—
  **否决**：与 active guardrails 结构性互斥（OBS-010），PR #101 已实测死锁；
  违反 decomposition DEC-001/DEC-006。
- `ALT-008`（本 Spec 新增）registry exception / 改 ceiling / 改 verifier —
  **否决**：decomposition ALT-001 已拒绝且 DEC-007 禁止；本 Spec 闭包不含
  `.agents/**`。
- `ALT-009`（本 Spec 新增）对 V1 做 focused in-place amendment 而非 whole
  successor — **否决**：V1 是 accepted 且 `implementation_authority: contracts`
  的在权 authority，其 CTR-001 冻结闭包是被审计接受的 stable ID；按
  SPEC_FORMAT_V0 §14.1 该 ID 不得在原 spec 内收窄/改写，闭包面变化属
  SUPERSEDE 边界（§14.3「changed authorization/lifecycle semantics」）；
  whole successor（本 Spec）是唯一合规路径（Forum V1→V2 同先例）。
- `ALT-010`（本 Spec 新增）在本 PR 顺手实现 decomposition 或修改 PR #101 —
  **否决**：任务与 decomposition §8 序列均禁止；实现与结构前置必须分离
  （§14）。

## 12. Migration, compatibility, and rollback

纯加法 manifest 数据；无 store、无状态、无 schema 破坏；不与任何 deploy/restart
耦合。回滚 = 移除该 manifest 导出与对应测试 + inventory 计数回退（单 commit
逆操作）。accept 不含 production apply 权限；生产可见性需独立部署授权（本 Spec
不授予）。authority 迁移：本 Spec accepted 起，本 scope 实现授权整体由 V1 移交
本 Spec（V1 → superseded，原子 backlink）；PR #101 作为 V1 旧闭包的实现 Draft
按 §14 处置。

## 13. Open questions

Not applicable — 产品 normative 内容已冻结（继承 V1）；外部时序由 §3 双码声明
消解；结构协调由 §14 序列显式冻结，无待定 owner decision。

## 14. Coordination with the shared decomposition（8-path pin 与序列）

本节 pin 并冻结本 Spec 与
`AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1`（PR #107，authoring 轮
reviewed head `deda45d87635c577be37d6402ba1c26c8a483428`）的协调关系：

- **8-path pin（逐字）**：本 Spec 头部引注与 decomposition §5 完全一致的
  exact closure（1 delete + 7 add，见上）。本 Spec 的 dedicated home
  （`workflow-global-instances-v2.test.js`）与 aggregate owner
  （`manifest-inventory.test.js`）均为该闭包成员/预留落点；本 Spec 不创建、
  不修改其中任何 path。
- **inventory 协调序（三 spec 联动冻结）**：decomposition 保持 13；本 Spec
  授权 13→14；Transition amendment（姊妹协调 PR）授权 14→15；Domain
  Pagination V2 successor（姊妹协调 PR）不改变计数（扩展现有 manifest）。
  三者均以 `manifest-inventory.test.js` 为唯一调整点。
- **生命周期序列（decomposition §8 逐字对齐）**：
  1. 本 docs-only Draft PR（status=proposed）；
  2. 独立「接入 审计」（本 Spec 的 authority reconciliation 审计轮）；
  3. 与姊妹协调 spec（Pagination V2 successor、Transition amendment）及
     decomposition 本身的 acceptance 事务协调——可与 decomposition §8 步骤 4
     （其 lifecycle-only acceptance）同一原子 authority transaction 完成；
     本 Spec acceptance 事务同时原子完成 V1 backlink 翻转
     （`V1.status -> superseded`、`V1.superseded_by -> 本 Spec`、
     `V1.implementation_authority -> none`——authority 整体移交本 Spec；
     Forum V1→V2 acceptance 先例同构）；
  4. shared decomposition implementation（其 own audit + merge）——本 Spec 不
     实现、不夹带任何 decomposition 内容；
  5. **本 Spec 的实现前置完成**：fresh main 上 8-path 已 merge
     （`capabilities.test.js` 不存在；`manifest-inventory.test.js` 为 aggregate
     owner，计数 13）；
  6. 本 Spec fresh-main 实现（恰 CTR-001 闭包；GOVERNING_SPEC_UNMODIFIED——
     实现 PR 不得修改本文件）；实现 audit + merge；
  7. **PR #101 处置**：PR #101（V1 旧闭包实现，Draft）在本 Spec accepted 后
     即失去 governing authority；其不可在本协调完成前 merge（decomposition
     §8 明文）；其后的正确路径 = 按 decomposition §8 步骤 7 rebase/重做到本
     Spec 的 dedicated path（或关闭后由 fresh 实现轮替代）——该处置属于独立
     未来轮次，本 Spec 与本轮均不修改 PR #101 本身（任务边界）。
- **前置失败语义**：若 decomposition 最终未 accepted / 未实现，本 Spec 的实现
  前置永不满足，实现不得开工；本 Spec 保持 proposed/accepted 均不授权 touch
  `capabilities.test.js`（其已按 V1 路线死锁，见 ALT-007）。

## 15. Authoring result

```text
TASK_NAME = 联动 执行（PR 1/3：Global Instances V2 successor）
SPEC_KIND_CHANGE = WHOLE_SPEC_SUCCESSOR (supersedes V1; V1 untouched this round)
PRODUCT_CONTRACT_DELTA_FROM_V1 = TEST_HOME_AND_INVENTORY_LOCATION_ONLY
DEDICATED_TEST_HOME = packages/broker/test/capabilities/workflow-global-instances-v2.test.js
INVENTORY_COUNT_AUTHORITY = 13 -> 14 @ manifest-inventory.test.js (sole adjustment point)
CAPABILITIES_TEST_JS_IN_IMPLEMENTATION_CLOSURE = NO (literal path appears only in non-authorizing contexts: the pinned 8-path D-line, deadlock motivation, STATE/OBS factual coordinates, negative contracts, rejected-alternative records, and precondition prose; zero occurrences as an authorized touch target)
DECOMPOSITION_PIN = PR #107 head deda45d87635c577be37d6402ba1c26c8a483428 (exact 8 paths, verbatim)
AUTHORING_BASE = f54679cb1a9cb9fe5e4ca38b9b354a5d25ef6221 (current main; broker 173/173; structure PASS 0 violations)
FILES_CHANGED = 1 (this file)
PR_101_MODIFIED = NO / PR_102_MODIFIED = NO / PR_107_MODIFIED = NO
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
NEXT_TASK = 接入 审计
```
