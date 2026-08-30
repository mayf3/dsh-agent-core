---
spec_id: AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V2
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
accepted_date: 2026-08-30
accepted_reviewed_head: b8dea71290a99d7534aa2899a5ae7440814e3c45
date: 2026-08-29
type: implementation-spec (Broker-only pagination exposure for an existing read-only endpoint; whole successor of the V1 authority, test home relocated to the shared-decomposition dedicated file)
scope:
  - extend workflow_domain_instances with beforeCreatedAt and beforeId
  - enforce all-or-none cursor presence locally before credential or HTTP work
  - forward the two cursor fields unchanged to the existing svc-workflow Domain list endpoint
references:
  - docs/specs/AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1.md (accepted; current P0 single-page authority)
  - docs/specs/AGENT_CORE_WORKFLOW_GLOBAL_INSTANCES_CAPABILITY_V2.md (sister coordination successor, same authoring round)
  - docs/specs/AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1.md (sister coordination amendment, same authoring round)
  - dsh-agent-core PR #92 / merge ab3437204914aac2f2965f5c31a8aca2a7af735d (deployed workflow_domain_instances implementation)
  - dsh-agent-core PR #107 (shared decomposition spec AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1; authoring-round reviewed head deda45d87635c577be37d6402ba1c26c8a483428)
  - svc-workflow git 6f1f546787bd5fb1644ec91327d3e7374dc28165
  - svc-workflow/src/http/dto.rs:102-118
  - svc-workflow/src/http/handlers/instances.rs:96-155,218-250
  - svc-workflow/src/application/workflow_instance/query_types.rs:42-52
  - svc-workflow/src/store/postgres/workflow_instance_repository/query_domain_instances.rs:14-26,99-195
  - svc-workflow/contracts/workflow-http/v1/openapi.yaml:424-483,1330-1341,2196-2207
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
  - AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_BROKER_V1
external_authorities: []
supersedes:
  - AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V1
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V2

> 状态：**proposed**。本轮只提交 docs-only Draft PR，不实现、不接受、不 merge。
> `PRODUCT_CODE_CHANGE = NONE`；`PRODUCTION_CHANGE = NONE`。
>
> **ACCEPTED（2026-08-30，联动 执行 / COORDINATED_ACCEPTANCE_AND_MERGE）。**
> 本 Spec 生命周期 acceptance：`status: proposed -> accepted`、
> `implementation_authority: none -> contracts`、`PRODUCTION_APPLY_AUTHORITY =
> none` 保持；authoring 轮 reviewed head =
> `b8dea71290a99d7534aa2899a5ae7440814e3c45`（fresh fetch 核对无漂移）+ 本
> acceptance commit。同一原子事务中 V1 完成 supersede 回填
> （`V1.status -> superseded`、`V1.superseded_by -> 本 Spec`、
> `V1.implementation_authority -> none`）。协调前置已满足：分解 spec 已 accepted
> 并 merged（PR #107，merge `1fc3ad6`）；姊妹 Global Instances V2 已 accepted 并
> merged（PR #108，merge `4283657`）。独立审计 verdict 未经独立审计轮产生——本
> acceptance 为 Owner-directed 协调 acceptance（§10 如实记录）。完整记录见 §10。
>
> **WHOLE-SPEC SUCCESSOR。** 本 Spec 是
> `AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V1`（accepted，PR #99 merge
> `c0016c0`，accepted_reviewed_head `2dc70bc`）的 whole successor。本 authoring 轮
> V1 保持 `status: accepted`、`superseded_by: null` 不动；backlink 翻转保留给本
> Spec 的原子 acceptance 事务，且必须与 `V2.status: proposed -> accepted` 原子同
> 事务完成（SPEC_FORMAT_V0 §2.7；Forum Moderation V1→V2 / Global Instances V2 同
> 一先例）。本 Spec 完整重述 V1 的产品合同，独立可读、独立可实现，绝不依赖
> 「V1 继续适用，除了……」。
>
> **与 V1 的唯一差异 = 实现闭包第 4 文件（测试落点），产品合同零变化。** V1 §5
> 四文件闭包要求编辑 744 行、未登记 legacy 的
> `packages/broker/test/capabilities.test.js`，使一切实现都被 active
> `CODE_STRUCTURE_GUARDRAILS_V1` 的 `UNREGISTERED_LEGACY_TOUCHED` 死锁（PR #102
> Draft 即此 blocker）。本 Spec 把该闭包第 4 文件改为 shared decomposition
> （PR #107，`AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1`）DEC-006 冻结
> 的 dedicated home
> `packages/broker/test/capabilities/workflow-domain-pagination-v2.test.js`。
> R1–R6 合同、三个产品源文件（workflow.js / schema.js / mapping.js）的改动面、
> 错误语义与验收门逐字继承 V1。本 Spec 不新增 manifest，**不改变 aggregate
> inventory 计数**（计数协调归姊妹 spec：Global Instances V2 授权 13→14、
> Transition amendment 授权 14→15）。
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
> decomposition 已 accepted 且其 exact 8-path 实现已 merge 到 main（§8 序列）。

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

**V2 增量结论（结构协调）**：V1 的四文件闭包把全部新测试写入未登记 legacy 聚合
文件（`capabilities.test.js`，744 行），与 active 结构守则互斥（PR #102 Draft 实测
`UNREGISTERED_LEGACY_TOUCHED`）。V2 把测试落点迁到 decomposition 冻结的 dedicated
home，其余合同不变；分页产品语义（R1–R6）自 V1 起零变化。

## 1. 服务端真实分页合同（冻结为外部事实；与 V1 逐字一致）

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

## 2. 生产 live proof（2026-08-28，只读；记录继承 V1）

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

## 3. Broker gap 的精确原因（current main `f54679c` 仍成立）

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

结论：服务端没有收到强行添加的 cursor；生产「重复第一页」是 Broker allowlist 行为，
不是服务端忽略 cursor。（V1 于实现基线逐项验证；current main `f54679c` 与之无产品
代码差异——df3b299→f54679c 之间 main 仅 docs commits。）

## 4. P1 Broker 合同（拟冻结；与 V1 R1–R6 逐字一致）

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

## 5. Future implementation closure（accept 后才可执行；**第 4 文件为 V2 唯一闭包差异**）

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
4. `packages/broker/test/capabilities/workflow-domain-pagination-v2.test.js`
   （**V2 新落点**：decomposition DEC-006 冻结的 dedicated home，由首次获授权的
   本 Spec 实现创建——decomposition 本身不创建该空 placeholder；测试职责与 V1
   第 4 文件完全相同）：
   - 工具 schema 暴露精确字段；
   - full cursor 原样进入真实 mock URL query；
   - 两种 half-cursor 均 local `invalid_cursor` 且 token/business HTTP call count = 0；
   - 两页响应保持原样；权限 404 与既有错误保留不回归。

`registry.js` 无需专用改动：现有 generic manifest-to-tool 参数投影会自动暴露新增 properties。
`transport.js` 无需改动：现有 allowlist binding 已能原样转发 manifest 声明的 query 名。
`relay.js` 无需改动：现有 child→parent args relay 与 parent-side validation/binding 足够。

**V2 附加闭包纪律**：本 Spec 不以 `packages/broker/test/capabilities.test.js` 作为
任何实现落点或闭包成员（该文件在实现前置完成时已被 decomposition 8-path 闭包删除，
物理上不存在；本 Spec 中该字面路径只出现于非授权语境——8-path pin 的 D 行、死锁
动机与 §0/§3 历史事实坐标、本条负面纪律——零处作为实现落点授权）。**不改变
aggregate manifest 计数**——`manifest-inventory.test.js`
不在本 Spec 闭包内（本能力扩展现有 manifest，不新增 manifest；计数协调归
Global Instances V2 与 Transition amendment 的 governing Specs）。

若实现需要超出上述闭包，必须先 amendment；不得以「测试便利」扩大到 svc-workflow、权限、
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

V2 附加验收门（结构协调）：

```text
DEDICATED_TEST_HOME_USED = YES (workflow-domain-pagination-v2.test.js, sole test file)
LEGACY_AGGREGATE_FILE_IN_DIFF = NO
MANIFEST_INVENTORY_COUNT_CHANGED_BY_THIS_SPEC = NO
STRUCTURE_GATE_VS_IMPLEMENTATION_BASE = PASS / 0 violations
IMPLEMENTATION_PRECONDITION = DECOMPOSITION_8_PATH_MERGED_ON_MAIN
```

本 proposed Spec 本身不满足实现前置；须经独立「分页 审计」（V2 authority
reconciliation 轮）并完成 acceptance lifecycle 后，且 §8 前置成立，实现 Agent 才可按
GOVERNING_SPEC_UNMODIFIED 纪律开工。

## 7. 本轮最终冻结字段

```text
SERVICE_CURSOR_CONTRACT = beforeCreatedAt(RFC3339 string) + beforeId(UUID string), all-or-none; next_cursor = {created_at: RFC3339 string, id: UUID string} | null
BROKER_CURSOR_GAP_CONFIRMED = YES (current main f54679c: product code identical to V1 authoring base df3b299)
SECOND_PAGE_LIVE_PROOF = PASS (recorded 2026-08-28; inherited from V1)
SERVER_CODE_CHANGE_REQUIRED = NO
SVC_WORKFLOW_CODE_CHANGE = NONE
SPEC_STATUS = proposed
PRODUCT_CONTRACT_DELTA_FROM_V1 = TEST_HOME_ONLY (§5 item 4)
MANIFEST_INVENTORY_COUNT_DELTA = 0
DECOMPOSITION_PIN = PR #107 head deda45d87635c577be37d6402ba1c26c8a483428 (exact 8 paths, verbatim)
AUTHORING_BASE = f54679cb1a9cb9fe5e4ca38b9b354a5d25ef6221 (current main; broker 173/173; structure PASS 0 violations)
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
NEXT_TASK = 分页 审计
```

## 8. Coordination with the shared decomposition（8-path pin 与序列）

本节 pin 并冻结本 Spec 与
`AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1`（PR #107，authoring 轮
reviewed head `deda45d87635c577be37d6402ba1c26c8a483428`）的协调关系：

- **8-path pin（逐字）**：见头部引注（1 delete + 7 add）。本 Spec 的 dedicated home
  （`workflow-domain-pagination-v2.test.js`）为该闭包 DEC-006 home 表预留落点；本
  Spec 不创建、不修改其中任何 path。
- **inventory 协调序（三 spec 联动冻结）**：decomposition 保持 13；Global
  Instances V2（姊妹协调 PR）授权 13→14；Transition amendment（姊妹协调 PR）授权
  14→15；**本 Spec 不改变计数**（扩展现有 manifest，无新增 manifest，
  `manifest-inventory.test.js` 不在闭包内）。
- **生命周期序列（decomposition §8 逐字对齐）**：
  1. 本 docs-only Draft PR（status=proposed）；
  2. 独立「分页 审计」（V2 authority reconciliation 审计轮）；
  3. 与姊妹协调 spec（Global Instances V2 successor、Transition amendment）及
     decomposition 本身的 acceptance 事务协调——可与 decomposition §8 步骤 4
     （其 lifecycle-only acceptance）同一原子 authority transaction 完成；本 Spec
     acceptance 事务同时原子完成 V1 backlink 翻转（`V1.status -> superseded`、
     `V1.superseded_by -> 本 Spec`、`V1.implementation_authority -> none`）；
  4. shared decomposition implementation（其 own audit + merge）——本 Spec 不
     实现、不夹带任何 decomposition 内容；
  5. **本 Spec 的实现前置完成**：fresh main 上 8-path 已 merge
     （legacy 聚合文件不存在；dedicated home 的父目录 `test/capabilities/` 已由
     decomposition 建立）；
  6. 本 Spec fresh-main 实现（恰 §5 四文件闭包；GOVERNING_SPEC_UNMODIFIED）；
     实现 audit + merge；
  7. **PR #102 处置**：PR #102（V1 旧闭包实现，Draft）在本 Spec accepted 后即
     失去 governing authority；其不可在本协调完成前 merge（decomposition §8
     明文）；其后的正确路径 = 按 decomposition §8 步骤 7 rebase/重做到本 Spec 的
     dedicated path（或关闭后由 fresh 实现轮替代）——该处置属于独立未来轮次，
     本 Spec 与本轮均不修改 PR #102 本身（任务边界）。
- **前置失败语义**：若 decomposition 最终未 accepted / 未实现，本 Spec 的实现前置
  永不满足，实现不得开工；本 Spec 任何状态下都不授权 touch 未登记 legacy 聚合
  文件。

## 9. Authoring result

```text
TASK_NAME = 联动 执行（PR 2/3：Domain Pagination V2 successor）
SPEC_KIND_CHANGE = WHOLE_SPEC_SUCCESSOR (supersedes V1; V1 untouched this round)
PRODUCT_CONTRACT_DELTA_FROM_V1 = TEST_HOME_ONLY (§5 closure item 4)
DEDICATED_TEST_HOME = packages/broker/test/capabilities/workflow-domain-pagination-v2.test.js
MANIFEST_INVENTORY_COUNT_DELTA = 0
DECOMPOSITION_PIN = PR #107 head deda45d87635c577be37d6402ba1c26c8a483428 (exact 8 paths, verbatim)
AUTHORING_BASE = f54679cb1a9cb9fe5e4ca38b9b354a5d25ef6221 (current main; broker 173/173; structure PASS 0 violations)
FILES_CHANGED = 1 (this file)
PR_101_MODIFIED = NO / PR_102_MODIFIED = NO / PR_107_MODIFIED = NO
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
NEXT_TASK = 分页 审计
```

## 10. Acceptance Record (2026-08-30, 联动 执行 / COORDINATED_ACCEPTANCE_AND_MERGE)

ACCEPTANCE_TRANSACTION = LIFECYCLE_ONLY + V1 SUPERSEDE BACKLINK，ONE commit，
TWO files（本文件 + `AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V1.md`）。

- 事务：TASK_NAME = 联动 执行（step 3/4）；authoring-round reviewed head =
  `b8dea71290a99d7534aa2899a5ae7440814e3c45`（fresh fetch 核对无漂移）+ 本
  acceptance commit；独立 worktree。
- **原子 backlink（SPEC_FORMAT_V0 §2.7，同一 docs-only change）**：
  - V2：`status: proposed -> accepted`；`implementation_authority: none ->
    contracts`（本 scope 唯一实现授权生效）。
  - V1：`status: accepted -> superseded`；`superseded_by: null ->
    AGENT_CORE_WORKFLOW_DOMAIN_INSTANCES_PAGINATION_V2`；
    `implementation_authority: contracts -> none`（authority 整体移交本 Spec）；
    header 增加 SUPERSEDED 注记；§0–§8 与 acceptance provenance 原样保留。
- **协调前置（已满足）**：分解 spec
  `AGENT_CORE_BROKER_CAPABILITIES_TEST_DECOMPOSITION_V1` 已 accepted 并 merged
  （PR #107 merge `1fc3ad6`）；DEC-006 home（
  `capabilities/workflow-domain-pagination-v2.test.js`）已按本 Spec §5 闭包第 4
  文件采用；姊妹 Global Instances V2 已 accepted 并 merged（PR #108 merge
  `4283657`）。
- **姊妹协调**：Transition amendment（#110）在本事务之后按 Owner 编排顺序
  #108 → #109 → #110 依次 merge；inventory 协调序 = 分解 13 → Global V2 13→14
  → Transition 14→15；**本 Spec 不改变计数**（无新增 manifest）。
- **独立审计状态（如实记录）**：本事务为 Owner-directed 协调 acceptance；独立
  「分页 审计」轮未在本事务之前运行；本记录**不声明任何独立审计 verdict**——
  没有审计 verdict 可记录，不伪造 `independent_audit_result` 类字段。机械化验证
  在 authoring head 与 acceptance head 全部实测 PASS：frontmatter schema、
  `verify_governance.py`（vendored bytes 匹配）、`npm run verify:structure`
  （0 violations）、`git diff --check`、Broker 基线 `node --test` = 173/173。
- 语义变化 = STATUS_MIRROR_AND_PROVENANCE_ONLY + V1 原子 supersede：§0–§9 全部
  冻结内容（§1 服务端合同、§4 R1–R6、§5 四文件闭包、§6 验收门、§8 序列、§9
  authoring result）逐字节保留，body 未改动；正文中 authoring 轮「V1 保持
  accepted 不动 / backlink 保留给未来 acceptance」的表述按既有纪律作为历史记录
  原样保留（本事务即该未来 acceptance）。
- 授权生效语义：本 Spec merged on main 起成为本 scope 的唯一实现授权（R1–R6
  合同 + §5 四文件闭包：workflow.js / schema.js / mapping.js + dedicated home）；
  实现 PR 不得修改本文件（GOVERNING_SPEC_UNMODIFIED）；`production_apply_authority
  = none`——deploy / restart / production state 变更仍需独立授权。
- 实现前置：拆测 执行 轮（NEXT_TASK）先实现分解 spec §5 exact 8-path 闭包并
  merge，随后本 Spec 的实现才可在 fresh main 开工（dedicated home 创建；不触碰
  aggregate inventory 计数）；PR #102（V1 旧闭包实现）按分解 §8 步骤 7 处置属
  独立未来轮次（本事务不修改 PR #102）。
- 事务边界：DOCS_ONLY（2 files）；PRODUCT_CODE_CHANGE = NONE；
  PRODUCTION_CHANGE = NONE；packages/、scripts/、.agents/**、svc-workflow、
  production 均不动；PR #101/#102 不被本事务修改。
- Merge：本 commit 之后随即 mark ready 并 merge PR #109（merge commit 为本
  Spec 的 effective-on-main 坐标）。
