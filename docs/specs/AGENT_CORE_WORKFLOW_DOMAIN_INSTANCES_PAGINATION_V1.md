---
spec_id: AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V1
status: proposed
date: 2026-08-28
type: implementation-spec (Broker-only pagination exposure for an existing read-only endpoint)
scope:
  - extend workflow_domain_instances with beforeCreatedAt and beforeId
  - enforce all-or-none cursor presence locally before credential or HTTP work
  - forward the two cursor fields unchanged to the existing svc-workflow Domain list endpoint
references:
  - docs/specs/AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1.md (accepted; current P0 single-page authority)
  - dsh-agent-core PR #92 / merge ab3437204914aac2f2965f5c31a8aca2a7af735d (deployed workflow_domain_instances implementation)
  - svc-workflow git 6f1f546787bd5fb1644ec91327d3e7374dc28165
  - svc-workflow/src/http/dto.rs:102-118
  - svc-workflow/src/http/handlers/instances.rs:96-155,218-250
  - svc-workflow/src/application/workflow_instance/query_types.rs:42-52
  - svc-workflow/src/store/postgres/workflow_instance_repository/query_domain_instances.rs:14-26,99-195
  - svc-workflow/contracts/workflow-http/v1/openapi.yaml:424-483,1330-1341,2196-2207
implementation_authority: none
production_apply_authority: none
---

# AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V1

> 状态：**proposed**。本文件只提出 Broker P1 分页合同，不授予实现、合并、部署、
> restart 或 production apply 权限。
>
> 本轮交付边界：DOCS_ONLY；`PRODUCT_CODE_CHANGE = NONE`；
> `SVC_WORKFLOW_CODE_CHANGE = NONE`；`PRODUCTION_CHANGE = NONE`。

## 0. 问题与结论

已部署的 `workflow_domain_instances` 绑定现有只读端点：

```text
GET /internal/v1/workflow-instances/domain
```

当前 Broker 工具只声明 `domainId`、`limit`，因此模型无法推进服务端已经返回的
`next_cursor`。强行加入未声明的 cursor 参数后仍得到相同第一页，并不能证明服务端忽略
cursor：当前 manifest 的 operation arguments 和 HTTP query allowlist 都没有 cursor 字段，
未声明值不会到达服务端。

调查确认服务端已经完整实现复合 keyset 分页；缺口仅在 Broker 参数面和本地 pair
validation。本 Spec 提议复用现有 endpoint，不启用 svc-workflow PR #13 的专用 opaque
pagination 路线。

## 1. 服务端真实分页合同（冻结为外部事实）

### 1.1 请求

服务端 `DomainInstanceQuery` 使用 `serde(rename_all = "camelCase",
deny_unknown_fields)`，真实 query 参数为：

| 字段 | 类型与约束 | 本 P1 是否暴露 |
|---|---|---|
| `domainId` | UUID string，必填 | 保持 |
| `limit` | integer；服务端 1..100、默认 20；Broker 继续收紧为 1..20 | 保持 |
| `beforeCreatedAt` | RFC 3339 date-time string，可选 | 新增 |
| `beforeId` | UUID string，可选 | 新增 |

`beforeCreatedAt` 与 `beforeId` 是同一个复合 cursor 的两个坐标：必须同给或同缺。
服务端不接受名为 `cursor` 的 query 参数；不得把响应对象整体传为 `cursor`。

服务端 half-cursor 或格式错误返回 HTTP 422、error code `invalid_cursor`：

- 只有 `beforeCreatedAt`：`beforeCreatedAt requires beforeId`；
- 只有 `beforeId`：`beforeId requires beforeCreatedAt`；
- 时间不是 RFC 3339：`beforeCreatedAt must be an RFC 3339 timestamp`；
- id 不是 UUID：`beforeId must be a valid UUID`。

### 1.2 响应

成功响应保持现有 snake_case JSON，不 reshape：

```json
{
  "items": ["<现有 DomainInstanceSummary；结构不变>"],
  "next_cursor": {
    "created_at": "<RFC 3339 UTC date-time string>",
    "id": "<workflow_instance_id UUID string>"
  }
}
```

最后一页必须为：

```json
{
  "items": ["<0..limit items>"],
  "next_cursor": null
}
```

`next_cursor` 非空时精确为 object，且只含：

```text
created_at : RFC 3339 date-time string
id         : UUID string
```

请求映射固定为：

```text
next_cursor.created_at -> beforeCreatedAt
next_cursor.id         -> beforeId
```

不得改名、编码成 opaque string、把 object 整体放入一个 `cursor` 参数，或使用
`updated_at` 作为坐标。

### 1.3 排序与推进

服务端固定执行：

```sql
WHERE (wi.created_at, wi.workflow_instance_id) < (beforeCreatedAt, beforeId)
ORDER BY wi.created_at DESC, wi.workflow_instance_id DESC
LIMIT limit + 1
```

返回前截取前 `limit` 条；仅当读到第 `limit + 1` 条时，才以本页最后一个 item 的
`created_at` 与 `workflow_instance_id` 生成 `next_cursor`。因此相同 `created_at` 下由 UUID
提供稳定 tie-breaker。

每个 HTTP 请求在自己的 REPEATABLE READ transaction 中执行；该 endpoint 不是跨请求的
全局 snapshot token。冻结的可靠性语义是标准 keyset pagination：在被枚举集合不发生删除
或改变可见性的稳定窗口内无重复、无遗漏并稳定终止；并发新增且排序坐标晚于第一页边界的
记录不会被插入后续旧游标页。不得把本 P1 描述为跨整轮强 snapshot 保证。

## 2. 生产 live proof（2026-08-28，只读）

使用正式 DOMAIN_OWNER MachineClient credential，经 OAuth `client_credentials`
（resource `svc-workflow`、scope `workflow.read`）直接调用现有 endpoint；未打印 token、
secret、Authorization 或 DATABASE_URL；未执行任何 Workflow 写入。

探针执行两轮完整 sweep，并要求两轮 instance-id 顺序逐项一致后才判 PASS。脱敏结果：

```text
PAGE_COUNT = 2
PAGE_1_ITEM_COUNT = 20
PAGE_1_NEXT_CURSOR_CREATED_AT = 2026-08-13T22:25:34.354961Z
PAGE_1_NEXT_CURSOR_ID = 153f0eb5-4fba-43e5-95e3-e12e9640fcd6
PAGE_2_ITEM_COUNT = 15
PAGE_2_NEXT_CURSOR_CREATED_AT = null
PAGE_2_NEXT_CURSOR_ID = null
TOTAL_ITEMS = 35
UNIQUE_INSTANCE_IDS = 35
DUPLICATE_COUNT = 0
FINAL_CURSOR_NULL = true
SECOND_PAGE_LIVE_PROOF = PASS
```

证明：第一页真实 `next_cursor` 的 `created_at/id` 分别作为
`beforeCreatedAt/beforeId` 后取得不同的第二页；两页共 35 条、unique 35、duplicate 0；
第二页稳定终止且 `next_cursor = null`。第二轮完整 sweep 与第一轮序列一致，故该稳定窗口内
未观察到遗漏。

## 3. Broker gap 的精确原因

当前 merged/deployed Broker 路径：

1. `packages/broker/src/capabilities/workflow.js` 的 `workflow_domain_instances`
   operation arguments 只有 `domainId`、`limit`，模型工具 schema 因而不接受 cursor 字段；
2. 同一 manifest 的 HTTP binding 固定 `query: ['domainId', 'limit']`；
3. `registry.js` 只把 manifest argument properties 建成模型可见参数；
4. `mapping.js` 对已声明属性做类型/范围校验；未知字段即使绕过模型 schema 进入内部调用，
   也不会自动成为 HTTP binding；
5. `transport.js::bindRequest` 只遍历 `http.query` allowlist 并逐名取值，其他 args 被忽略；
6. child mode 的 `relay.js` 会把 args 送到 trusted parent，但 parent 仍使用相同 manifest 与
   transport allowlist，因此强行传 cursor 仍只会发出 `domainId/limit`。

结论：服务端没有收到强行添加的 cursor；生产“重复第一页”是 Broker allowlist 行为，
不是服务端忽略 cursor。

## 4. P1 Broker 合同（拟冻结）

### R1. 唯一参数面

`workflow_domain_instances` 的 `list` operation 仅允许：

```text
domainId        required string (UUID)
limit           optional integer (1..20)
beforeCreatedAt optional string (RFC 3339)
beforeId        optional string (UUID)
```

不增加 `cursor` 参数，不增加 definition/lifecycle/status/node/assignee 等过滤器。

### R2. Pair validation 必须在本地 fail-fast

- 两个 cursor 字段同缺：第一页，合法；
- 两个 cursor 字段同给：后续页，合法；
- 任一 half-cursor：返回 `{ok:false,error:{code:"invalid_cursor",...}}`；
- half-cursor 必须在 credential lookup、token request 和业务 HTTP request 之前失败；
- half-cursor 的 auth/token/HTTP call count 必须全部为 0；
- 不得把 half-cursor 静默丢弃成第一页请求。

实现必须使用 manifest-declarable、generic 的共现约束；禁止在通用 mapping/transport 内写
`if (capabilityId === 'workflow_domain_instances')` 业务特判。

格式校验至少保持现有 string 类型合同；是否在 Broker 本地进一步验证 RFC 3339/UUID 不得
改变服务端 `invalid_cursor` 语义或产生不同成功请求。pair presence 是本 Spec 强制的本地门。

### R3. 原样转发

合法 full cursor 必须按 manifest query allowlist 原样转发：

```text
beforeCreatedAt=<调用参数原字符串>
beforeId=<调用参数原字符串>
```

不得转换字段名、截断 timestamp precision、重写 timezone、替换 UUID、重新编码成 opaque
cursor，或从其他响应字段推导 cursor。

### R4. 权限和错误语义不变

- DOMAIN_OWNER 校验继续只由 svc-workflow `check_domain_owner` 权威执行；
- Broker 不复制、不缓存、不放宽权限；
- non-owner 与不存在 domain 继续使用既有 camouflage HTTP 404：
  `workflow_instance_not_found_or_not_visible`；
- `invalid_cursor` 加入该 operation 的可达 declared errors；
- 其他现有 auth/query/transport error preservation 合同不变。

### R5. 成功响应不变

Broker 继续原样返回现有 `Page<DomainInstanceSummary>`；不得 reshape `items` 或
`next_cursor`，不得加入自动翻页、聚合页、总数、snapshot token 或新字段。

### R6. 只读和服务端零改动

- HTTP method/path 保持 `GET /internal/v1/workflow-instances/domain`；
- 不引入 POST/PUT/DELETE、body 或 Idempotency-Key；
- 不修改 svc-workflow；
- 不启用、不实现 PR #13 的专用新 endpoint / opaque pagination；
- 不 production apply。

## 5. Future implementation closure（accept 后才可执行）

允许的最小产品/测试文件闭包：

1. `packages/broker/src/capabilities/workflow.js`
   - 增加两个 argument properties；
   - HTTP query allowlist 增加 `beforeCreatedAt`、`beforeId`；
   - operation declared errors 增加 `invalid_cursor`；
   - 声明 generic pair-presence 约束。
2. `packages/broker/src/schema.js`
   - 校验并 canonicalize manifest 的 generic pair-presence 元数据。
3. `packages/broker/src/mapping.js`
   - 在 handler/credential/transport 前执行 generic pair-presence fail-fast。
4. `packages/broker/test/capabilities.test.js`
   - 工具 schema 暴露精确字段；
   - full cursor 原样进入真实 mock URL query；
   - 两种 half-cursor 均 local `invalid_cursor` 且 token/business HTTP call count = 0；
   - 两页响应保持原样；权限 404 与既有错误保留不回归。

`registry.js` 无需专用改动：现有 generic manifest-to-tool 参数投影会自动暴露新增 properties。
`transport.js` 无需改动：现有 allowlist binding 已能原样转发 manifest 声明的 query 名。
`relay.js` 无需改动：现有 child→parent args relay 与 parent-side validation/binding 足够。

若实现需要超出上述闭包，必须先 amendment；不得以“测试便利”扩大到 svc-workflow、权限、
过滤器或成功响应。

## 6. 验收门

未来实现必须同时满足：

```text
SPEC_GATE = PASS
SPEC_COMPLIANCE = PASS
BROKER_TESTS = PASS
FULL_CURSOR_WIRE_QUERY = EXACT
HALF_CURSOR_LOCAL_INVALID_CURSOR = PASS
HALF_CURSOR_TOKEN_CALL_COUNT = 0
HALF_CURSOR_BUSINESS_HTTP_CALL_COUNT = 0
DOMAIN_OWNER_AUTHORITY_UNCHANGED = YES
CAMOUFLAGE_404_UNCHANGED = YES
SUCCESS_RESPONSE_RESHAPE = NONE
SVC_WORKFLOW_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

本 proposed Spec 本身不满足实现前置；须经独立“分页 审计”并完成 acceptance lifecycle 后，
实现 Agent 才可按 GOVERNING_SPEC_UNMODIFIED 纪律开工。

## 7. 本轮最终冻结字段

```text
SERVICE_CURSOR_CONTRACT = beforeCreatedAt(RFC3339 string) + beforeId(UUID string), all-or-none; next_cursor = {created_at: RFC3339 string, id: UUID string} | null
BROKER_CURSOR_GAP_CONFIRMED = YES
SECOND_PAGE_LIVE_PROOF = PASS (20 + 15 = 35; unique 35; duplicate 0; final cursor null; repeated sweep stable)
SERVER_CODE_CHANGE_REQUIRED = NO
SVC_WORKFLOW_CODE_CHANGE = NONE
SPEC_STATUS = proposed
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
NEXT_TASK = 分页 审计
```
