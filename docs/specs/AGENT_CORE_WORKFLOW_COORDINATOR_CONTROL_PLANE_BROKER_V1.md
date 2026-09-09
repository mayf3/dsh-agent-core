---
spec_id: AGENT_CORE_WORKFLOW_COORDINATOR_CONTROL_PLANE_BROKER_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core
  - packages/broker workflow coordinator control-plane capability surface
    （新增 grouped 工具 workflow_domain_admin / workflow_domain_members /
    workflow_domain_binding_reconcile）
governed_by:
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1
    revision: proposed@github/main-4bbbbe9-line (pin finalized at acceptance)
    relation: depends_on
    note: upstream wire/authorization authority（domain list/get/update、
      get owner、binding reconcile、member/cancel/archive coordinator
      放宽）；本 Spec authoring 时 status=proposed，acceptance 时 repin
      其 accepted main head——同 GLOBAL_INSTANCES_CAPABILITY_V2 对
      SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1 的 pin 纪律
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1
    revision: f900586fe198b3a1e1a069fe8ccc3690a481612a
    relation: interoperates_with
  - repository: mayf3/auth-service
    authority_id: AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V2
    revision: 87beb7783d7e81bdf479cbb109c42cac86a9bfbf
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
date: 2026-09-09
product_direction: WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 (Owner goal directive, 2026-09-09)
---

# AGENT_CORE_WORKFLOW_COORDINATOR_CONTROL_PLANE_BROKER_V1

> **STATUS = proposed（docs-only Draft PR）。** 本轮只提交 docs-only Draft
> PR：不实现、不接受、不 merge、不部署、不改任何 grant。
> `implementation_authority: none`、`production_apply_authority: none`。
> 独立语义 review + Owner exact-head acceptance 后，acceptance 事务
> （frontmatter 翻转 + 外部权威 repin）方使本 Spec 成为实现权威。

## 1. Goal

为持有 svc-workflow `GLOBAL_WORKFLOW_COORDINATOR`（以及 member 面的
DOMAIN_OWNER）角色提供**恰三个**新 Broker grouped 只读/治理能力，把 Owner
Goal Directive `WORKFLOW_COORDINATOR_CONTROL_PLANE_V1` 的控制面对接到
Agent 面：

```text
workflow_domain_admin(operation = list | get | create | update | get_owner | set_owner)
workflow_domain_members(operation = list | add | remove)
workflow_domain_binding_reconcile(operation = plan | apply)
```

授权判断完全在 svc-workflow 服务端（role bindings + coarse scope）；
Broker 不复制、不放宽、不缓存任何权限语义；caller identity 与
Idempotency-Key 只经 trusted credential/transport seam。不出现任何
`if agent == HR` 特判——HR 只是当前 coordinator 角色的实际 holder。

跨域 cancel/archive **不在本 Spec**：它走
`AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1` §25 focused
amendment（`workflow_execute` 四 operation 集），本 Spec 与其互为姊妹
delta，合起来构成 directive 的完整 Agent 面。

## 2. Scope and non-goals

**In scope（accept 后的实现闭包）：**

- `packages/broker/src/capabilities/workflow.js`：新增三个纯数据
  manifest（`workflowDomainAdminManifest`、`workflowDomainMembersManifest`、
  `workflowDomainBindingReconcileManifest`）并加入 `manifests` 导出数组。
- dedicated test homes（decomposition DEC-006 纪律，由本 Spec 实现创建）：
  `packages/broker/test/capabilities/workflow-domain-admin.test.js`、
  `packages/broker/test/capabilities/workflow-domain-members.test.js`、
  `packages/broker/test/capabilities/workflow-domain-reconcile.test.js`。
- `packages/broker/test/capabilities/manifest-inventory.test.js`：
  aggregate 计数 **18 → 21** 的唯一调整点（本 Spec 显式授权值 = 21）。
- `packages/broker/src/transport.js` / `mapping.js`：**零语义变化**——
  既有 trusted Idempotency-Key flag、错误信封提取、query 白名单转发机制
  原样复用；若实现证明需要纯机械适配（如 DELETE method），适配本身不得
  改变既有 manifest 行为。

**Non-goals：**

- 不实现/不代理 svc-workflow 任何新端点逻辑；svc 侧权威见外部 authority
  `SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1`。
- 不新增 workflow 写工具或并行 cancel/archive 面（§1，§25 amendment
  领域）。
- 无 DB/admin/run-as/legacy 旁路；不复用 `/internal/v1/admin/*`。
- 无 name→UUID 猜测：一切 principal 输入必须来自
  `agent_resolve_principal`（EXACT_PRINCIPAL_AGENT_RESOLUTION_V2）或上游
  工具响应中的精确 UUID 字段；Broker 不做发现、不缓存 owner。
- 无 delete/purge/retention/bulk SQL；无 cleanup 状态机；无 durable
  cleanup-request subsystem（dispatch 传输复用 `agent_session_send`）。
- 不改 scheduler/forum/okr/authoring 等既有 manifest 一字节。

## 3. Authority and dependencies

- 上游 wire/授权权威：`SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1`
  （proposed→acceptance repin；其 CTR-CP-002 wire contract 与 CTR-CP-003
  error table 是本 Spec 的逐字输入）。
- 姊妹写面：`AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1` §25
  （proposed amendment；governed_by 关系）。
- 既有只读面：`AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2`
  （accepted）提供 global read；本 Spec 不重复其任何能力。
- identity 解析：`AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2`
  （accepted，`agent_resolve_principal`，scope `auth.agent.resolve`）。
- dispatch 传输：`AGENT_CORE_AGENT_SESSION_MESSAGING_V1`（既有
  `agent_session_send`；routing 链 = global read → owner lookup →
  resolve → send，本 Spec 不建新传输）。
- 错误信封治理：`AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`
  （accepted；declare-then-resolve 纪律，§9 CTR-004）。
- 部署顺序（§12）：svc backend → role grant → dsh broker → HR audience
  grant → runtime read-back。本 Spec 的实现 merge 不早于 svc 权威
  acceptance；生产部署另受 P0 slot 纪律约束。

## 4. Current State（dsh census, fresh read-back @ origin/main 232bc2d）

| # | Capability | Class | Evidence |
|---|---|---|---|
| D1 | workflow_execute cancel/archive ops | C(op 级) | manifest 冻结二 operation；svc 端点已在（§25 amendment 领域） |
| D2 | workflow_domain_admin | C | 无；svc 侧 create/set-owner 已有（A），list/get/update/get_owner 为 svc C 类新端点 |
| D3 | workflow_domain_members | C | 无；svc 侧三端点已有（B 类放宽） |
| D4 | workflow_domain_binding_reconcile | C | 双侧均缺（svc 新 plan/apply + 本 broker 面） |
| D5 | workflow_global_instances | A | V2 accepted、live |
| D6 | agent_resolve_principal | A | V2 accepted、live（scope `auth.agent.resolve`） |
| D7 | agent_session_send | A | accepted、live |
| D8 | workflow_instance_detail | A | accepted、live（Owner 执行前证据核验面） |
| D9 | inventory | — | `manifest-inventory.test.js` 断言 `all.length === 18`（fresh @232bc2d） |

## 5. Observations

- OBS-DCP-001 — svc coordinator 写面（create/set-owner）已是
  `workflow.execute` + direct token + Idempotency-Key receipt 形态；
  本 Spec 的 create/set_owner operation 是纯 expose（A 类复用）。
- OBS-DCP-002 — transport 层 `http.idempotencyKey` flag 已为
  workflow_execute 提供 trusted 幂等 seam；三个新 manifest 的写 operation
  （create/update/set_owner/add/remove/apply）逐字复用，零新机制。
- OBS-DCP-003 — svc member add 幂等（重复 add 稳定成功）、remove 只碰
  `DOMAIN_MEMBER`；broker add/remove 无需本地去重或守卫（服务端权威）。
- OBS-DCP-004 — 既有 workflow manifests 的错误声明表模式
  （baseErrors/authErrors/queryErrors + per-family codes）可直接容纳
  svc CTR-CP-003 新码（`domain_owner_missing`/`binding_conflict`/
  `identity_not_found`/`invalid_input`）；无新码发明，全部对拍 svc
  error.rs。
- OBS-DCP-005 — manifest 层 `requiredScopes` 是 manifest 级（非
  per-operation）；三 grouped 工具内部混读/写 scope。见 DEC-DCP-004。

## 6. Claims and assumptions

- CLM-DCP-001 — 三 manifest 全部为「manifest + 既有 transport/mapping
  机制」的纯数据增量；registry.js 的 manifest→tool 管线零语义变化。
- CLM-DCP-002 — svc 权威 acceptance 时其 wire contract 与本 Spec §9
  CTR 表逐字一致（repin 只动 revision 字段，不动语义）。
- ASSUMPTION-DCP-001 — HR main principal 的 scope 集
  {workflow.read, workflow.execute} 保持（svc OBS-CP-005）。

## 7. Evidence relations

- EVD-DCP-001 — D2–D4 缺口的证据 = origin/main 232bc2d 的
  `capabilities/workflow.js` manifest 全集（无 coordinator 面）+ svc
  github/main 4bbbbe9 路由表（§4 census）。
- EVD-DCP-002 — inventory 18 的证据 =
  `packages/broker/test/capabilities/manifest-inventory.test.js:16`
  （fresh read-back）。

## 8. Decisions

- DEC-DCP-001（grouped 形态）— 恰三个 grouped 工具，operation discriminator
  与 `workflow_execute` 同模式；不为每个 operation 开独立 toolName
  （工具面爆炸拒绝）。
- DEC-DCP-002（identity 输入纪律）— 所有 principal UUID 参数在 manifest
  description 冻结「must come from `agent_resolve_principal` or an exact
  upstream UUID field」；Broker 不做名字解析、不猜测、不缓存
  （directive §11；`identity_not_found`/`identity_ambiguous` 中，后者
  属 discovery 面，broker 对 svc exact-UUID 错误只透传声明码）。
- DEC-DCP-003（授权零复制）— Broker 不声明、不预判 DOMAIN_OWNER/
  COORDINATOR 语义；授权失败一律透传服务端码（`not_domain_owner`、
  `global_coordinator_required`、`forbidden`）。负向安全边界由服务端
  保证（svc ACC-CP-004..006）。
- DEC-DCP-004（scope 声明粒度）— V1 manifest 级 `requiredScopes` 机制
  不扩展 per-operation scope：`workflow_domain_admin` 与
  `workflow_domain_binding_reconcile` 声明
  `['workflow.read','workflow.execute']`（HR 现状两者兼有）；精细的
  per-endpoint scope + role 执行完全在服务端（svc CTR-CP-002/003）。
  per-operation scope 声明机制若未来需要，另行走 registry schema
  amendment，不在本 Spec 夹带。
- DEC-DCP-005（update 范围镜像）— `workflow_domain_admin.update` 仅暴露
  `displayName`（svc DEC-CP-003 镜像）；`enabled`/`domainKey`/
  `domainId` 不可改。
- DEC-DCP-006（reconcile 输入冻结）— plan/apply 暴露恰
  `{domainId, role, fromPrincipalId, toPrincipalId, reason}`；apply 叠加
  trusted Idempotency-Key；plan 无幂等键（纯只读）。
- DEC-DCP-007（expose ≠ grant）— 本 Spec 只交付 manifest 能力；哪个
  audience/ principal 能看到这些工具由 auth-service 侧 grant 决定
  （directive §14 的 runtime read-back 在部署阶段验收）。V1 grant 面：
  coordinator（HR）；DOMAIN_OWNER 的 members 工具 exposure 为潜在后续
  grant 变更，非代码变更。
- DEC-DCP-008（cleanup routing 复用）— 跨域治理编排（discover →
  classify → owner lookup → resolve → dispatch → verify）由
  既有工具组合完成（global_instances + 本 Spec get_owner +
  resolve_principal + session_send + §25 cancel/archive +
  global_instances read-after-write），不新建 cleanup 专用工具。

## 9. Contracts

### CTR-DCP-001 — workflow_domain_admin wire（对拍 svc CTR-CP-002）

```text
list       GET   /internal/v1/domains                      workflow.read
           query: limit, beforeCreatedAt, beforeId (paired)
get        GET   /internal/v1/domains/{domainId}           workflow.read
create     POST  /internal/v1/domains                      workflow.execute
           body: {domainKey, displayName}（Idempotency-Key，trusted）
           注：svc ProvisionDomainRequest 现契约要求的 domainId 等字段
           按 svc 权威原文沿用（若其 acceptance 收窄为服务端生成，
           本 operation 入参随其 repin 对齐——语义权威在 svc）
update     PATCH /internal/v1/domains/{domainId}           workflow.execute
           body: {displayName}（Idempotency-Key，trusted）
get_owner  GET   /internal/v1/domains/{domainId}/owner     workflow.read
set_owner  PUT   /internal/v1/domains/{domainId}/owner     workflow.execute
           body: {newOwnerPrincipalId}（Idempotency-Key，trusted）
```

返回体 = svc 原文（最小治理 metadata：domainId/domainKey/displayName/
enabled/createdAt/updatedAt；owner：domainId/ownerPrincipalId/
ownerDisplayName/ownerEnabled）；Broker 原样转发，不投影、不裁剪、
不富化。

### CTR-DCP-002 — workflow_domain_members wire

```text
list   GET    /internal/v1/domains/{domainId}/members                  workflow.read
       query: limit, beforeCreatedAt, beforeId (paired)
add    PUT    /internal/v1/domains/{domainId}/members/{principalId}    workflow.execute
       （Idempotency-Key，trusted；重复 add 稳定成功语义 = 服务端）
remove DELETE /internal/v1/domains/{domainId}/members/{principalId}    workflow.execute
       （Idempotency-Key，trusted；只移除 DOMAIN_MEMBER）
```

### CTR-DCP-003 — workflow_domain_binding_reconcile wire

```text
plan   POST /internal/v1/domains/{domainId}/binding-reconcile/plan   workflow.read
       body: {role, fromPrincipalId, toPrincipalId, reason}
       （纯只读；返回 sourceBindingExists/sourceEnabled/
        targetPrincipalExists/targetPrincipalEnabled/
        targetHasEnabledBinding/singleOwnerInvariantOk/plan/blockers[]）
apply  POST /internal/v1/domains/{domainId}/binding-reconcile/apply  workflow.execute
       body 同 plan（Idempotency-Key，trusted）
       （返回 {outcome: applied|already_applied|noop, ...}；
        replay 返回原 outcome）
```

role ∈ {`DOMAIN_OWNER`, `DOMAIN_MEMBER`}；owner 迁移语义 =
svc `replace_owner` 原子复用；member 迁移 = 单事务 disable+establish
（svc DEC-CP-005/006）。

### CTR-DCP-004 — error declarer 表（全部对拍 svc，无新码发明）

三 manifest 公共叠加：baseErrors / authErrors / queryErrors（既有）。
per-operation 家族码：

```text
domain family:    domain_not_found, domain_disabled, invalid_input,
                  idempotency_conflict, command_still_processing,
                  domain_owner_missing(get_owner)
members family:   domain_not_found, principal_not_registered,
                  principal_disabled, principal_is_owner, not_domain_owner,
                  global_coordinator_required, idempotency_conflict,
                  command_still_processing, invalid_cursor
reconcile family: domain_not_found, identity_not_found, binding_conflict,
                  not_domain_owner, global_coordinator_required,
                  invalid_input, idempotency_conflict,
                  command_still_processing
```

最终逐码清单以 svc 权威 acceptance 版 error.rs 为准做机械对拍
（实现轮义务，ACC-DCP-003）。

### CTR-DCP-005 — inventory 授权

`manifest-inventory.test.js` 计数断言 **18 → 21**，唯一落点、唯一授权值
（decomposition DEC-003 纪律第二次行使）。

## 10. Acceptance

- ACC-DCP-001 — 三 manifest 注册后 inventory===21；`assertValidManifest`
  全过；既有 18 manifest 字节零回归。
- ACC-DCP-002 — 每工具 schema：principal 入参仅 UUID；无 name/displayName
  →UUID 通道；写 operation 无 model 可达 Idempotency-Key/actor 字段。
- ACC-DCP-003 — error 表逐码对拍 svc error.rs（含 HTTP status）；
  未声明码落到通用 `http_4xx/5xx` 信封（error-preservation 现状）。
- ACC-DCP-004 — fixture 级 wire 断言：method/path/query/body 逐条对拍
  CTR-DCP-001..003；cursor 只成对转发；未声明 query 名不转发（transport
  白名单现状回归）。
- ACC-DCP-005 — 负面：无 scope/role 的 caller 在服务端 fail-closed 的码
  被信封原样保留（`not_domain_owner` / `global_coordinator_required`），
  Broker 不吞不改。
- ACC-DCP-006 — 部署后（§12 顺序走完）HR runtime 真实 read-back：
  工具可见可调（directive §14「不能只把代码 merge」）；该验收在部署轮
  出收据，不在本 docs PR。

## 11. Alternatives and disposition

- 每 operation 独立 toolName（workflow_domain_list、
  workflow_set_owner…）— **rejected**：工具面爆炸；与 `workflow_execute`
  的 grouped discriminator 先例相反。
- 单一巨型 `workflow_coordinator(operation=…14 项)` 工具 — **rejected**：
  domain 管理 / member 管理 / reconcile 是三类不同授权与审计语义；
  directive §5/§6/§9 亦按三工具形态提出。
- Broker 缓存 owner/domain 投影 — **rejected**：directive 明文
  （「Broker 不查询 DB，不维护 owner cache，不猜 owner」）。
- per-operation scope 声明机制 — **deferred**（DEC-DCP-004）。
- 自建 cleanup request 持久层 — **rejected**：directive non-goals；
  session dispatch 不足的证据出现前不做。

## 12. Migration, compatibility, and rollback

- 顺序：① svc 权威 acceptance+实现部署 → ② role grant（coordinator→HR，
  separately owner-authorized）→ ③ 本 Spec acceptance+实现 merge →
  ④ broker 部署（P0 slot 纪律）→ ⑤ HR audience grant 更新 →
  ⑥ runtime read-back 收据 → ⑦ dogfood（directive §16/§17/§18）。
- 兼容：纯增量三 manifest；既有工具/transport/mapping 零语义变化；
  rollback = broker 部署回滚（新工具消失，无数据遗留——Broker 无状态）。
- svc 未部署新端点期间，本能力不可部署（对未知路径的调用只会产生
  404 噪声）；实现 merge 与部署之间允许间隔，部署门禁在 ④。

## 13. Open questions

- DOMAIN_OWNER 对 `workflow_domain_members` 的 grant exposure（DEC-DCP-007）
  ——等真实 owner 自治需求出现。
- `workflow_domain_admin.create` 入参形状随 svc acceptance 收窄
  （服务端生成 domainId 与否）——repin 时对齐。
- reconcile 批量 plan——无需求不做（svc §13 同源）。

## 14. What this PR changes

```text
DOCS ONLY — adds exactly this file.
DSH_CODE_CHANGE (this PR) = NONE
GRANT_CHANGE = NONE
PRODUCTION_CHANGE = NONE
INVENTORY_AUTHORIZED_VALUE = 21 (activation-time)
READY_FOR_INDEPENDENT_REVIEW = YES
STATUS = proposed
```
