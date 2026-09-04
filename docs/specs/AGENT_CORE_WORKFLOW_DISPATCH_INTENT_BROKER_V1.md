---
spec_id: AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
accepted_date: 2026-09-02
accepted_reviewed_head: 9e15808f336e7964f5059e871c32f25e6045e622
date: 2026-09-02
scope:
  - packages/broker
governed_by:
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1
    revision: 22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1 — Dispatch Intent read + wake Broker capabilities (Slice F, minimal)

> 状态：**accepted**（Owner ruling `KEEP_ACCEPTED_V6` 委派的自主链；authoring head
> `9e15808` fresh 核对无漂移 + 本 acceptance commit）。`implementation_authority:
> contracts`；`PRODUCTION_APPLY_AUTHORITY = none`。
>
> 本 Spec 是 V6 §18 Slice F 的**最小** Broker authority：只把 svc-workflow 已接受的
> Dispatch Intent 读端点与 wake 命令暴露为两个**新** Broker 能力，让 Agent 工具面
> 与 service 实现同步。不改写、不伪装、不扩展 svc-workflow 的授权模型。

## 1. Background and authority alignment

Accepted svc-workflow `SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1`（svc main `22e862a`）落地了
accepted v0.4.0 canonical activation model 的 phase-1 runtime core：

- `GET /internal/v1/dispatch-intents?limit=N` — active due DISPATCH_INTENT 的
  Scheduler 读（server 端 fail-closed `GLOBAL_SCHEDULER_READ` 门控；投影恰为
  v0.4.0 §5.7 最小 7 字段）；
- `POST /internal/v1/workflow-instances/{workflowInstanceId}/node-visits/{nodeVisitId}/wake`
  — 受控 early-wake 命令（server 端同一门控；stale/closed/mismatch 为 durable no-op）。

Owner ruling（2026-09-02）：Broker **不得**通过修改现有 `workflow_global_instances` /
`workflow_domain_instances` 伪装 dispatch feed；若现有 accepted Broker authority 未覆盖
Dispatch Intent 消费能力，则只建立本最小 authority。机械核查：dsh main `9e15808` 的
`docs/specs/` 与 `packages/broker/` 无任何 DISPATCH_INTENT / wake / scheduler-read
Broker capability（grep 0 命中于 capability 面）→ **AUTHORITY = GAP**，本 Spec 补齐。

svc-workflow 侧边界保持：这两个 Broker 工具是**兼容/诊断面之上的新增消费能力**，
不是 svc-workflow 授权的扩展——caller 仍须持有 server 端独立授予的
`GLOBAL_SCHEDULER_READ` binding（Slice B/C 供给，不在本 Spec 范围）。

## 2. Contracts

### CTR-DIB-001 — `workflow_dispatch_intents` read capability

New manifest `workflow_dispatch_intents` (toolName 同名), additive to
`packages/broker/src/capabilities/workflow.js`:

```text
requiredScopes = ['workflow.read']
operation list → GET /internal/v1/dispatch-intents
query: [limit]                       # optional, 1..100; server validates (422 invalid_pagination)
result: passthrough of the response body (items[] with exactly
        dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId,
        nextEligibleAt, createdAt, updatedAt)
```

- 纯透传：Broker 不过滤、不排序、不补字段、不缓存（error-preservation CTR-003 同族）。
- Declared errors: `scheduler_read_role_required`（403，caller 无
  `GLOBAL_SCHEDULER_READ`，含仅持 `GLOBAL_WORKFLOW_READER` 的 caller），
  `invalid_pagination`（422），auth/transport family。

### CTR-DIB-002 — `workflow_wake_dispatch_intent` write capability

New manifest `workflow_wake_dispatch_intent`:

```text
requiredScopes = ['workflow.execute']
operation wake → POST /internal/v1/workflow-instances/{workflowInstanceId}/node-visits/{nodeVisitId}/wake
pathParams: [workflowInstanceId, nodeVisitId]
body: [expectedWorkflowStateVersion, cause]     # cause optional
args: workflowInstanceId (UUID string), nodeVisitId (UUID string),
      expectedWorkflowStateVersion (integer >= 1, required), cause (string, optional)
idempotencyKey: true                            # trusted seam generates Idempotency-Key
result: passthrough ({wakeApplied, reason?, workflowInstanceId, nodeVisitId,
        workflowStateVersion?, eventSequence?, nextEligibleAt?})
```

- 模型面禁止：principalId / agentId / actor / assignee / Idempotency-Key
  （trusted seam only，与 workflow_execute 同纪律）。
- Broker 不做 wake 语义校验（UUID/格式由 server fail-closed；CTR-002 同族）；
  **无 broker 自动重试**（DEC-004）：`command_still_processing`（425）原样上抛。
- Declared errors: `scheduler_read_role_required`（403）、`principal_not_found` /
  `instance_not_found` / `dispatch_intent_not_found`（404）、`principal_disabled`
  （403）、`invalid_cause`（422）、`idempotency_conflict`（409）、
  `command_still_processing`（425）、auth/transport family。
- `wakeApplied=false` 的 durable no-op 是 **200 成功响应**，Broker 原样透传
  （reason 字段可辨），不是 error。

### CTR-DIB-003 — Registration and inventory

Both manifests join the workflow manifest set (`workflow.js` `manifests` array →
`DEFAULT_MANIFESTS` via the existing spread). No registry.js algorithm change
（CTR-011 recompute loop already covers single-operation manifests）；no gateway /
relay change；`manifest-inventory` test counts updated additively.

### CTR-DIB-004 — Non-goals (Owner ruling fences)

- 不修改 `workflow_global_instances` / `workflow_domain_instances` / 任何现有 manifest；
- 不实现 Scheduler policy（fairness / quota / retry / mapping / delivery）；
- 不新增 svc-workflow 授权面或本地鉴权判断（server-side enforcement only）;
- 不触碰 gateway / relay / transport / schema / mapping 框架代码。

## 3. Acceptance

| ACC | Owning contract | Method / expected |
|---|---|---|
| ACC-DIB-001 | CTR-DIB-001 | Broker test: GET passthrough of a 2-item due page (exact 7-field keys preserved); 403 `scheduler_read_role_required` envelope preserved fail-closed; 422 invalid_pagination preserved; scope = workflow.read |
| ACC-DIB-002 | CTR-DIB-002 | Broker test: POST wake → path params + body {expectedWorkflowStateVersion, cause} only; trusted Idempotency-Key sent, fresh per call, no retry on 425; 200 wakeApplied=true passthrough; 200 wakeApplied=false (durable no-op) passthrough as success; 404 dispatch_intent_not_found envelope preserved; model-supplied principalId/agentId/idempotencyKey ignored and absent from wire |
| ACC-DIB-003 | CTR-DIB-003 | manifest-inventory updated; both tools registered exactly once in DEFAULT_MANIFESTS; existing 309-test baseline green |
| ACC-DIB-004 | CTR-DIB-004 | mechanical diff: zero changes outside packages/broker additive surface + test files + inventory counts |

## 4. Out of scope / FOLLOW_UP_DEBT

- `GLOBAL_SCHEDULER_READ` grant supply（svc-workflow Slice B/C + designation root）；
- svc-workflow SCHEDULER_DEFER（future-dated eligibility）命令及其 Broker 面；
- Dispatcher/HR policy 一切语义（V6 §8A 明确 external ownership）；
- production apply（部署为独立 gate）。
