---
spec_id: AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1
status: proposed
date: 2026-08-27
type: implementation-spec (single read-only broker capability; WIP exists without authority, pending this Spec's acceptance)
scope:
  - packages/broker 新增只读 capability manifest `workflow_domain_instances`（任务语义：domain_instances(domain_id)），代理 svc-workflow 已部署端点 GET /internal/v1/workflow-instances/domain
  - 参数面冻结：domainId（必填）+ limit（可选，1..20 broker-side fail-fast）
  - 错误表冻结（error-preservation 纪律同族）：declared codes only，fail-closed
  - 权限语义冻结：DOMAIN_OWNER 由 svc-workflow 服务端强制；broker 不复制、不放宽
references:
  - svc-workflow/src/http/mod.rs:115-116（路由 /internal/v1/workflow-instances/domain → instances::domain_list）
  - svc-workflow/src/http/handlers/instances.rs:101+（domain_list handler：require_scope workflow.read + 查询委托）
  - svc-workflow/src/application/workflow_instance/query_service.rs:74-98（服务端 check_domain_owner；非 owner → WorkflowInstanceNotFoundOrNotVisible）
  - svc-workflow/src/http/dto.rs:104-118（DomainInstanceQuery：serde camelCase + deny_unknown_fields；domainId 为 wire 参数名）
  - svc-workflow/src/store/postgres/workflow_instance_repository/query_domain_instances.rs:14-26（limit 1..100，默认 20）
  - svc-workflow/src/http/error.rs:503-530（from_query 错误码映射）
  - docs/specs/AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1.md（proposed；本 Spec 复用其分页校验/错误保留机制族）
  - git 33533ce（Broker Transport V1：first-batch workflow 读能力与「cursor 不透出」纪律来源）
implementation_authority: none
---

# AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1 — Domain 实例只读枚举能力

> 状态：**proposed**。本 Spec 当前**不授予**任何实现或 production apply 权限。
> `production_apply_authority = none`。
> 一个完整实现已作为 WIP 保存在 worktree（broker 测试 PASS）；该实现**未获授权
> 合并**，accept 本 Spec 是其唯一授权路径（对齐 ef2bcac WIP-preservation 先例与
> AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 的授权模型）。
>
> 修订（2026-08-27，域查 修订轮）：Owner 裁决
> **P0_REUSE_EXISTING_DOMAIN_LIST_ENDPOINT** 已记录于 §5 —— P0 维持本 Spec 的
> 「绑定现有端点」方案；PR #13 / PR #81 的新专用路由方案不采用；状态仍为
> **proposed**，P0_READY_FOR_REVIEW = YES。

## 0. 问题（已实证）

Domain Owner 当前可用的 broker 能力面：

- `workflow_my_domains` → GET /internal/v1/principals/me/domains（看到自己的 Domain）
- `workflow_my_tasks` → GET /internal/v1/worklists/assigned-to-me（个人任务）

svc-workflow **已部署** `GET /internal/v1/workflow-instances/domain`
（mod.rs:115-116 → handlers/instances.rs `domain_list`），服务端强制
DOMAIN_OWNER（query_service.rs:74-98：`check_domain_owner`，非 owner →
`workflow_instance_not_found_or_not_visible`）。缺口纯在 broker 侧：没有 manifest
暴露该端点，因此 DOMAIN_OWNER 有权限却无法经 broker 枚举 Domain 下实例。

## 1. 冻结的语义（rulings）

### R1. Capability 面（唯一新增）

- id / toolName：`workflow_domain_instances`（沿 first-batch `workflow_*` 命名族；
  即任务语言中的 `domain_instances(domain_id)`）。
- 唯一 operation：`list`。
- http binding：`{ target: 'svc-workflow', method: 'GET',
  path: '/internal/v1/workflow-instances/domain', query: ['domainId', 'limit'] }`。
- requiredScopes：`['workflow.read']`。
- 只读：无 body、无 Idempotency-Key、无写 operation。

### R2. 参数面（冻结）

- `domainId`：必填 string（UUID）。wire 名 = `domainId`（下游 serde
  `rename_all = "camelCase"` + `deny_unknown_fields`；transport 按参数名原样转发，
  不会发出下游拒绝的 `domain_id`）。
- `limit`：可选 integer，1..20，broker-side fail-fast `invalid_pagination`
  （下游实际上限 100；1..20 为 first-batch 冻结的更严合同）。
- **不透出**：cursor（beforeCreatedAt/beforeId）与全部过滤参数
  （lifecycle/status/definitionKey/currentNodeKey/assigneePrincipalId）——沿用
  first-batch「cursor 不透出」纪律（33533ce）；transport 只转发 manifest 声明的
  query 名，未声明参数物理上到不了 svc-workflow。

### R3. 权限（服务端唯一权威）

- DOMAIN_OWNER：允许 —— 由 svc-workflow `check_domain_owner` 强制。
- DOMAIN_MEMBER（非 owner）：维持现状 —— 服务端返回
  `workflow_instance_not_found_or_not_visible`（HTTP 404，error.rs:508-511）；
  member 的合法枚举面仍是 `workflow_my_tasks`。
- Broker 不做、不复制、不缓存任何权限判断；不提供任何以放宽上述语义为效果的
  参数或路径。GLOBAL 列表（global_list）**不在**本 Spec 范围。

### R4. 错误表（declared codes only）

`invalid_arguments`、`unsupported_operation`、`unauthenticated`、`forbidden`、
`principal_not_found`、`principal_disabled`、`internal_consistency_error`、
`service_unavailable`、`invalid_pagination`、`invalid_cursor`、
`workflow_instance_not_found_or_not_visible`。

语义：经 broker 可达的失败按 error-preservation 纪律透出（declared service code
优先，status/sanitized detail/x-request-id 保留；undeclared → fail-closed 降级
`http_4xx`/`http_5xx`）。`workflow_instance_not_found_or_not_visible` 同时覆盖
「非 owner」与「domain 不存在」两种服务端结果（同一错误码）。

### R5. 返回（透传，不 reshape）

`succ { ok: true, result: <Page<DomainInstanceSummary>> }`，原样透传下游
snake_case JSON。模型可见字段映射任务要求：

| 任务要求字段 | 下游字段（snake_case 原样） |
|---|---|
| instance_id | `workflow_instance_id` |
| title | `title` |
| state | `is_terminal` + `current_node`（+ 默认 status=active 过滤语义） |
| current_node | `current_node`（node_id/node_key/display_name/node_type） |
| assignee | `current_assignee_principal_id` |
| updated_at | `updated_at` |

分页推进：next_cursor 存在于 result 中但 cursor 参数不透出 → 本 capability
面向模型的合同为**单页枚举**（默认 20 / 上限 20 一页）；需要翻页能力时须另走
AMEND 扩展 cursor 透出（含 half-cursor 非转发语义），不得在实现中静默添加。

### R6. 只读红线

禁止经本 capability 或其实现触及：Workflow 状态变更、Assignment 变更、Domain
变更、Principal 变更。实现文件不得引入任何 POST/PUT/DELETE 绑定或写 handler。

## 2. Exact implementation file closure

- `packages/broker/src/capabilities/workflow.js`：新增
  `workflowDomainInstancesManifest` 并加入 `manifests` 导出数组（纯数据，零新机制；
  index.js 的 DEFAULT_MANIFESTS 自动纳入，child 模式 relay / gateway 模式 transport
  均为既有泛型路径）。
- `packages/broker/test/capabilities.test.js`：first-batch 计数 12→13；新增
  fixture 测试（query 参数映射 + scope 断言 + 非 owner 404 错误码透出）。

依赖叠加声明：WIP 实现构建于 worktree 中的 error-preservation WIP 之上
（limitProperty bounds / validationError 机制）。若该 Spec 先 accept 并 port，本
Spec 的实现随之获得 broker-side fail-fast；若其被拒，本 manifest 的 bounds 字段
在纯 main schema 上为无害额外字段（原样保留、不触发校验），limit 越界由下游
422 `invalid_pagination` 兜底（码已声明）。两种演化路径下 R2 合同不破。

## 3. 测试验收（WIP 已达成）

- 全部 broker 测试 PASS（基线 89 + 新增 fixture）。
- schema 校验：新 manifest 过 validateManifest；http op target/method 合法。
- fixture：GET /internal/v1/workflow-instances/domain 收到
  `?domainId=<uuid>&limit=<n>`（camelCase 实证）；token 请求 scope=workflow.read；
  非 owner 404 `workflow_instance_not_found_or_not_visible` 端到端透出（code +
  status + request-id）。

## 4. 边界与不授权项

- svc-workflow：**0 改动**（端点已部署；本 Spec 是 broker 侧代理合同）。
- Production：**0 改动**（无 deploy、无 restart、无 job/store 变更）。
- 不授权：global 实例列表、cursor/filter 透出、任何写面、per-capability 鉴权
  逻辑进驻 broker、模型参数携带 identity。
- Merge 授权路径：本 Spec accepted → 实现按 GOVERNING_SPEC_UNMODIFIED 纪律评审
  合并（实现 PR 不得修改本文件）。

## 5. Owner Ruling 修订记录（2026-08-27，域查 修订轮）

OWNER_RULING = **P0_REUSE_EXISTING_DOMAIN_LIST_ENDPOINT**

现有服务端接口 `GET /internal/v1/workflow-instances/domain` 已经满足首要目标：
DOMAIN_OWNER 能列出自己域内实例。Owner 七条裁决逐条落地：

| # | 裁决 | 本 Spec 落地 |
|---|---|---|
| 1 | PR #13（svc-workflow `SVC_WORKFLOW_DOMAIN_OWNER_INSTANCE_LIST_V1`，分支 spec/domain-owner-instance-list-v1）**暂不 acceptance**；定位调整为后续 **P1 enriched contract**，或标记 superseded/hold | P0 不依赖任何 svc-workflow 改动（§4 边界维持）。其 spec/PR 的实际标记动作属 svc-workflow 仓库事务，本轮不动 |
| 2 | PR #81（本仓库 `AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_CAPABILITY_V1`，f5ebb8a）**不采用新专用路由** `/internal/v1/domains/{domainId}/workflow-instances` | 新路由方案让位于本 Spec；d06cc7a 预留的 supersession 决定就此解决：**P0 authority = 本 BROKER_V1**。PR #81 分支/PR 本轮不 push、不修改，其重定位/关闭由 Owner 后续处置 |
| 3 | P0 = Broker capability `workflow_domain_instances` 绑定现有 `GET /internal/v1/workflow-instances/domain` | = R1 原文，零变化 |
| 4 | P0 接受当前服务端语义：非 Owner 返回既有 camouflage 404；当前 summary 字段；当前 created_at cursor；服务端继续验证 DOMAIN_OWNER | R3（404 camouflage + 服务端唯一权威）、R4（同一错误码覆盖非 owner 与 domain 不存在）、R5（summary 透传表）按现状冻结接受；服务端 created_at cursor 现状保留，broker 侧「cursor 不透出 / 单页合同」（R2/R5）不变 |
| 5 | P0 不阻塞于：state_version / cancelled / archived / domain_not_found 与 not_domain_owner 拆分 | 各项全部移出 P0 依赖面；R4 的单码语义（`workflow_instance_not_found_or_not_visible` 同码覆盖两态）按现状接受（实证：PR #13 spec :96-97/:132/:288-290 即这些增强项的出处） |
| 6 | 上述增强另立 **P1 service contract**，不阻塞 Owner 基础查询上线 | P1 = 独立 service contract（PR #13 重定位为其候选载体或后继），与本 Spec 解耦；P0 上线不以 P1 为前置 |
| 7 | 不混入 `workflow_global_instances` | R3「GLOBAL 列表不在范围」维持；`workflow_global_instances`（PR #83）为独立事项，与本 Spec 互不构成依赖或阻塞 |

最终字段（本轮裁决冻结）：

- P0_SERVER_CODE_CHANGE = NONE
- P0_BROKER_TOOL = workflow_domain_instances
- P0_READY_FOR_REVIEW = YES（本 Spec 状态保持 **proposed**，进入 spec review /
  接入 审计轮；proposed → accepted 的翻转仍须独立审计轮 VERDICT 后按既有
  acceptance 事务执行，本轮不做）
- PRODUCTION_CHANGE = NONE

本轮修订边界（DOCS_ONLY）：仅本文件追加修订记录（头部状态引注 + 本 §5）；
frontmatter 与 §0–§4 逐字节保留；packages/、scripts/、svc-workflow 仓库、
production、PR #13/#81/#83 分支与 push 均不动；工作区既有 WIP 实现快照与
未提交状态原样保留。
