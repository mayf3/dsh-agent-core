---
spec_id: AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
status: proposed
date: 2026-08-25
type: implementation-spec (error preservation + pagination validation; implementation exists as WIP, authority pending this Spec's acceptance)
scope:
  - Broker generic HTTP transport downstream error preservation (service code / status / sanitized detail / x-request-id)
  - wire error envelope extension (code, status, detail, requestId) across mapping / relay / renderer
  - Broker-side pagination bounds validation with declared violation codes (manifest-declarable minimum/maximum/validationError)
  - workflow_my_tasks limit contract (1..20, local fail-fast before token/HTTP)
references:
  - docs/reports/broker-transport-v1.md (descriptive transport V1 report — NOT an implementation authority; its error mapping `http_4xx + raw detail` is SUPERSEDED by this Spec upon acceptance)
  - docs/reports/trusted-credential-broker-integration-v1.md (relay/gateway envelope contract — extended additively with requestId by this Spec)
  - docs/reports/broker-error-preservation-v1.md (implementation evidence report)
  - svc-workflow/src/http/error.rs (error envelope + WorkflowQueryError read-side mapping, line-verified 2026-08-25)
  - svc-workflow/src/http/mod.rs:31-32 (x-request-id via tower-http UUID middleware)
  - docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md (Spec governance; §10 Report ≠ authority)
implementation_authority: none
---

# AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 — Workflow Broker 错误保留与分页校验

> 状态：**proposed**。本 Spec 当前**不授予**任何实现或 production apply 权限。
> `production_apply_authority = none`。
> 一个完整实现已作为 WIP 保存在分支
> `impl/broker-error-preservation-v1-wip`（base b5ab589，broker 包 89/89 测试
> PASS）；该实现**未获授权合并**，accept 本 Spec 是其唯一授权路径。

## 0. 问题（已实证）

svc-workflow 对缺失 projection 的 `workflow_my_tasks` 返回：

```
HTTP 404
{"error":{"code":"principal_not_found","message":"principal not found"}}
x-request-id: <service-generated UUID>
```

实现前（broker-transport-v1.md 行为）模型只看到 `http_4xx`：服务码被压扁、
`x-request-id` 全程丢弃、`detail` 携带未脱敏原始 body、`limit` 无本地校验
（`0/-1/>20` 进入 svc-workflow 后变成泛化 422）。

## 1. 冻结的语义（rulings）

### R1. Downstream service error envelope（模型可见）

HTTP capability 失败时，模型可见 error 信封冻结为：

```
error: { code, status?, detail?, requestId? }
```

- `code`：**已声明（manifest-declared）的下游服务码优先透出**
  （如 `principal_not_found`）；未声明的服务码降级到已声明的
  canonical `http_4xx` / `http_5xx`（status-aware）；
  **fail-closed 不变量保持**——wire 上的每个 code 都必须在 manifest
  错误表内声明；下游 4xx/5xx **绝不**降级为 `invalid_arguments`。
- `status`：上游 HTTP status 原样保留。
- `detail`：**sanitized** 服务 message（脱敏 + 截断）；raw headers /
  raw body **不出 transport 边界**；非 JSON / 空 body 只返回固定占位符。
- `requestId`：**只能来自 downstream `x-request-id` 响应头**，原样透传，
  缺失/非法时省略（允许 null）；**禁止伪造** request-id。

### R2. request-id 端到端传递

`x-request-id` 必须贯穿：transport result → mapping result → child relay
（parent-RPC 信封）→ final renderer。渲染文本包含
`status=<s>` 与 `request_id=<id>`（存在时）。

### R3. 脱敏红线（secret non-disclosure）

`detail` 落 wire 前必须脱敏：`Bearer <token>`（先于 Authorization 头规则）、
`authorization[:=]<值>`、`token/secret/password/credential/api-key` 赋值、
≥40 字符不透明长串（JWT/hex/base64），并截断（500 字符）。整个 error 信封
（不只 detail）不得含任何上述秘密。

### R4. 分页校验（Broker 层 fail-fast）

- manifest 叶子 schema 可声明 `minimum` / `maximum` / `validationError`
  （`validationError` 必须引用 capability 错误表内已声明码）。
- `workflow_my_tasks` 的 `limit` 契约冻结：`1 <= limit <= 20`；
  越界在任何 **token 请求或 HTTP 请求之前**本地返回
  `invalid_pagination`（HTTP call count = 0）；边界值 1 与 20 合法放行。
- **cursor 当前仍不暴露**：transport 只转发 manifest 声明的 query 名，
  `before_created_at` / `before_id`（任何"半个 cursor"）不得到达 svc-workflow。
  cursor 暴露属未来独立授权。

### R5. 非回归

- Forum Broker 非回归：未声明服务码按 R1 降级 `http_4xx` + status + detail；
  calculator/V0 信封与成功渲染字节不变（错误信封为加法扩展）。
- transport 保持 100% 通用：无任何 per-business-system 分支；服务码差异
  全部为 manifest 数据。
- identity / credential seam 零改动。

## 2. Exact implementation file closure

```
packages/broker/src/transport.js
packages/broker/src/mapping.js
packages/broker/src/schema.js
packages/broker/src/registry.js
packages/broker/src/relay.js
packages/broker/src/capabilities/workflow.js
packages/broker/test/transport.test.js
packages/broker/test/capabilities.test.js
packages/broker/test/relay.test.js
docs/reports/broker-error-preservation-v1.md   （evidence report）
```

`CHANGED_FILE_COUNT = 9`（产品+测试；报告另计）。超出此 closure 的改动不在
本 Spec 授权范围内。

## 3. 测试验收（WIP 分支已达成）

- broker 包 89/89 PASS（原 74 + 15 新增）。
- ACs A–F：A 空任务 200；B 404 `principal_not_found` + request-id 保留；
  C invalid limit 本地 fail-fast（token/业务 HTTP 计数 = 0）+ half-cursor
  不转发；D 403 `forbidden` 保留；E 敏感材料整信封不泄漏；F Forum 非回归。

## 4. 边界与不授权项

- `production_apply_authority = none`：accept 前**不得**合并实现 PR、
  **不得** deploy。
- 本 Spec 不覆盖：Principal projection 修复、Domain 迁移、svc-workflow 任何
  改动（WORKFLOW_DB_CHANGE = NONE）、`workflow_submission_history` 的 limit
  bounds（建议后续 amendment）、cursor 暴露、token-endpoint 失败分类
  （origin/main 已有独立改动）。
- `docs/reports/broker-transport-v1.md` 保持 descriptive 历史记录；其错误
  映射行为描述自本 Spec accepted 起视为被取代。
