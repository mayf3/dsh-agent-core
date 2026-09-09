---
spec_id: AGENT_CORE_WORKFLOW_DOMAIN_MEMBERS_BROKER_V1
status: proposed
date: 2026-09-09
type: implementation-spec (single broker capability `workflow_domain_members`; projection of the svc-workflow DOMAIN_OWNER member-management contract)
scope:
  - packages/broker 新增 capability manifest `workflow_domain_members`
    （operation=list|add|remove），代理 svc-workflow 已部署的
    DOMAIN_OWNER 成员管理端点族 /internal/v1/domains/{domainId}/members[/...]
  - 参数面冻结：list（domainId 必填 + limit 1..100 可选 + beforeCreatedAt/
    beforeId all-or-none cursor 对）；add（domainId+principalId 必填、role
    可选枚举 DOMAIN_MEMBER|DOMAIN_OWNER）；remove（domainId+principalId 必填）
  - 错误表冻结（error-preservation 同族纪律）：declared codes only，fail-closed
  - 权限语义冻结：DOMAIN_OWNER 与 scope 由 svc-workflow 服务端强制；broker
    不复制、不放宽、不判角色、不查库、不从名字猜 principalId
references:
  - svc-workflow src/http/mod.rs:149-162（GET/PUT/DELETE members 路由族）
  - svc-workflow src/http/handlers/domain_members.rs（direct-token 门、
    workflow.read / workflow.execute scope、Idempotency-Key、role body 语法）
  - svc-workflow src/application/domain_membership/mod.rs（add 六步检查序：
    owner→domain→receipt→role 门→principal→is_owner→already_member→insert；
    remove 仅 DOMAIN_MEMBER、member_not_found）
  - svc-workflow docs/specs/SVC_WORKFLOW_DOMAIN_MEMBERSHIP_CONTROL_PLANE_V1.md
    （上游契约 delta：already_member / domain_owner_delegation_forbidden /
    receipt hash 纳入 role）
  - docs/specs/AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1 +
    _PAGINATION_V2（同族 read-capability 与 cursor 纪律先例）
  - docs/specs/AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1（错误保留机制族）
implementation_authority: none
---

# AGENT_CORE_WORKFLOW_DOMAIN_MEMBERS_BROKER_V1 — 域成员管理控制面工具

## 0. 问题（已实证）

DOMAIN_OWNER Agent 现有 broker 面（my_domains / domain_instances / my_tasks）
全部只读。svc-workflow 已部署正式成员管理端点族（list/add/remove，
服务端强制 DOMAIN_OWNER + direct token + Idempotency receipt + durable
audit），但 broker 没有 manifest 暴露它们——Agent 只能靠 Owner/admin/DB
旁路管理域成员。缺口纯在 broker 侧；上游契约 delta（role 语法、
already_member、delegation-forbidden）由 svc-workflow 同轮 spec+实现交付
（本机 30d5cf2，基于 github/main 4bbbbe9）。

## 1. 冻结的语义（rulings）

### R1. Capability 面（唯一新增）

- id / toolName：`workflow_domain_members`（沿 `workflow_*` 命名族）。
- 三个 operation：`list` | `add` | `remove`（selector 默认 `operation`）。
- requiredScopes：`['workflow.read', 'workflow.execute']` —— 一个工具三个
  operation 分属两个下游 scope（list→workflow.read；add/remove→
  workflow.execute），token 按此联合集铸造；每端点的精确 scope 仍由
  svc-workflow 服务端强制（scope 不足时 auth-service 铸 token 即 fail-closed
  → `authorization_denied`）。auth census 实证 fleet agents 同持双 scope。
- http bindings（全部 target=svc-workflow）：
  - list：GET `/internal/v1/domains/{domainId}/members`，
    pathParams=['domainId']，query=['limit','beforeCreatedAt','beforeId']；
  - add：PUT `/internal/v1/domains/{domainId}/members/{principalId}`，
    pathParams=['domainId','principalId']，body=['role']，idempotencyKey=true；
  - remove：DELETE 同 add 路径，pathParams 同，无 body，idempotencyKey=true。

### R2. 参数纪律

- `domainId` / `principalId`：string，必填，逐字进 path（transport 的
  encodeURIComponent + dot-segment 拒绝沿旧）。
- `role`：可选枚举 `DOMAIN_MEMBER | DOMAIN_OWNER`。缺省 = 不发 body 字段
  （svc 默认 DOMAIN_MEMBER，向后兼容）。**broker 不拦截 role=DOMAIN_OWNER**
  ——冻结 single-owner invariant 的 403 `domain_owner_delegation_forbidden`
  是服务端契约结果（上游 spec CTR-DMC-002），broker 仅原样保留错误码；
  在上游 delegation spec 被接受前，该请求在服务端必然 403。
- list 分页沿 domain_instances 同族纪律：limit 1..100（svc members 上界，
  默认 20）broker 侧 fail-fast（`invalid_pagination`）；beforeCreatedAt +
  beforeId all-or-none（`invalid_cursor`），逐字转发。

### R3. 身份纪律（不变量复述，不新增机制）

- caller 身份只来自 trusted seam 的 credential/token（JWT.sub），任何
  callerPrincipalId/actorId 类参数不声明、不转发（transport 白名单外静默
  丢弃 + 测试冻结）。
- target principalId 必须来自正式 identity discovery（Agent Directory
  名字→agentId + 目标 agent 自身 credential self-projection→principalId
  + authsvc directory 反查校验）；工具层只接受 canonical UUID，不接受
  名字，不做转换。

### R4. 错误表（declared only，fail-closed）

`...baseErrors, ...authErrors, ...queryErrors, ...paginationErrors` 加：
`not_domain_owner`(403)、`direct_token_required`(403)、
`domain_owner_delegation_forbidden`(403)、`domain_not_found`(404)、
`principal_not_registered`(404)、`member_not_found`(404)、
`principal_disabled`(403)、`already_member`(409)、`principal_is_owner`(409)、
`idempotency_conflict`(409)、`command_still_processing`(425)、
`invalid_input`(400)。未声明码 → 既有 status-aware fallback（http_4xx/5xx）。

### R5. 薄 broker 复述

不判 DOMAIN_OWNER；不查 DB；不维护 membership；无 admin/run-as/OBO
fallback（svc 端 direct-token 门 + 服务端 owner 检查是唯一权威）；无
hard-coded agent/domain 映射。幂等：transport 的 Idempotency-Key 生成 +
单次 401 重试同键复用沿旧；逻辑重复（already_member）是服务端契约结果，
broker 不预判。

## 2. 测试冻结

- manifest-inventory 18→19；workflow-execute.test 的 readManifestIds 追加
  `workflow_domain_members`（注：该列表现有断言 requiredScopes==['workflow.read']
  需按 R1 调整为对双 scope 工具的显式断言）。
- 新 `workflow-domain-members.test.js`：list query 映射 + path 构建；
  add 的 role body + Idempotency-Key 形状 `ik-workflow-domain-members-*`；
  remove 无 body；already_member / domain_owner_delegation_forbidden /
  not_domain_owner / member_not_found 错误保留（code/status/requestId）；
  impersonation 字段（callerPrincipalId/actorId/agentId）永不落 wire。

## 3. 边界

无 dsh 侧 ACL、无 handler 代码（createHttpHandlers 自动生成）、无
SECOND membership store；生产部署与真实 dogfood 由 Owner slot 门控，
本 Spec 不授予。
