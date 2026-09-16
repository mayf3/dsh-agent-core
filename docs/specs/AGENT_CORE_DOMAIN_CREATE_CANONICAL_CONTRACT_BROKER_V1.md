---
spec_id: AGENT_CORE_DOMAIN_CREATE_CANONICAL_CONTRACT_BROKER_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core
  - packages/broker workflow_domain_admin `create` operation schema（唯一改动面）
governed_by:
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
amends:
  - mayf3/dsh-agent-core AGENT_CORE_WORKFLOW_COORDINATOR_CONTROL_PLANE_BROKER_V1
    CTR-DCP-001（create body 冻结条款）。该条款原文预留路径："若未来要
    server-generated domainId，另做小型 contract amendment，本轮不夹带"——
    本 Spec 即该预留 amendment，触发 evidence = Owner goal directive
    DOMAIN_CREATE_CANONICAL_CONTRACT_ALIGNMENT_V1（2026-09-16）。
companion_specs:
  - mayf3/svc-workflow SVC_WORKFLOW_DOMAIN_CREATE_CANONICAL_CONTRACT_V1 (proposed;
    upstream wire authority——broker schema 逐字镜像其 CTR-DCC-001)
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_DOMAIN_CREATE_CANONICAL_CONTRACT_V1
    relation: depends_on
    note: create wire/authorization 上游权威；本 Spec 零授权复制、零语义再判定
supersedes: []
superseded_by: null
owners:
  - mayf3
date: 2026-09-16
product_direction: DOMAIN_CREATE_CANONICAL_CONTRACT_ALIGNMENT_V1 (Owner goal directive, 2026-09-16)
---

# AGENT_CORE_DOMAIN_CREATE_CANONICAL_CONTRACT_BROKER_V1

> **PROPOSED — INERT until independent review + Owner exact-head acceptance.**

## 1. Problem

`workflow_domain_admin.create` 现要求 model 提供 `domainId`（新资源 UUID
主键，CTR-DCP-001 V1 冻结），与上游 canonical 契约（server-generated
domainId、creator-becomes-owner）drift：正常
`create(domainKey, displayName, enabled)` 在 broker 本地参数校验即报
`invalid_arguments`。这是 LANE_I 复用 admin provisioning DTO 的历史
形状，非调用方错误。

## 2. CTR-DCA-001 — create operation wire（取代 CTR-DCP-001 的 create 行）

```text
create   POST /internal/v1/domains                    workflow.execute
         body（svc CTR-DCC-001 逐字镜像；Idempotency-Key，trusted）：
           domainKey    string   required
           displayName  string   optional
           enabled      boolean  required
         domainId：从 arguments.properties 与 http.body 双双移除。
         bindRequest 只转发 body 列表字段 ⇒ model 侧即使残余携带 domainId
         也结构性到不了 wire（与 identity 字段同机制的机械保证）。

Response = svc 原文 { domainId, domainKey, displayName, enabled,
ownerPrincipalId }，Broker 原样转发，不投影、不裁剪、不富化。
Authorization = ZERO-REPLICATED（svc 端 direct-token + enabled AGENT +
creator-becomes-owner；broker 只声明下游错误码）。
```

operations 其余五个（list/get/update/get_owner/set_owner）与
workflow_domain_members / workflow_domain_binding_reconcile 全部
零改动。错误码表不变（`invalid_arguments` 已在列；svc 侧新行为只
复用既有码 `unknown_field` 400 / `domain_identity_conflict` 409 /
`idempotency_conflict` 409，经 transport errors 原样透传）。

## 3. 兼容与退出（减法收敛，无双轨）

- 旧 caller-supplied domainId 契约**整体移除**：schema required 收敛为
  `['domainKey','enabled']`；不做 `domainId` optional 兼容、不做映射层。
- 既有合法读面（list/get/get_owner/my_domains/domain_instances）与写面
  （update/set_owner）行为零回归（既有测试字节级保持）。

## 4. Acceptance

| ID | 证明 |
|---|---|
| ACC-DCA-001 | manifest 校验通过；create wire binding = `{POST /internal/v1/domains, body:[domainKey,displayName,enabled], idempotencyKey:true}` |
| ACC-DCA-002 | `execute({operation:'create', domainKey, displayName, enabled})` 转发 body 逐字段精确、IK header 在、响应原文透传 |
| ACC-DCA-003 | 调用方残余携带 `domainId` 参数 → 不上 wire（结构性不可达） |
| ACC-DCA-004 | 缺 domainKey/enabled → broker 本地 `invalid_arguments`（先于任何 token/HTTP 工作） |
| ACC-DCA-005 | 既有 20+ domain_admin/members/reconcile 测试零回归 |

## 5. What this PR changes

```text
packages/broker/src/capabilities/workflow.js            create operation schema+描述；manifest 头注
packages/broker/test/capabilities/workflow-domain-admin.test.js   create 测试族重写 + ACC-DCA-003/004
docs/specs/AGENT_CORE_DOMAIN_CREATE_CANONICAL_CONTRACT_BROKER_V1.md（本文件）
```

PRODUCTION_MUTATION_BY_THIS_BRANCH = NO（broker 部署单独 slot-gated）。
