---
spec_id: AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1
status: accepted
date: 2026-08-25
accepted_date: 2026-08-27
amendments:
  - AMENDMENT_1 (2026-09-09, structural-diagnostics manifest opt-in; status ACCEPTED — Owner decision AMENDMENT_1_ACCEPTED, 见文末 AMENDMENT_1 节)
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
accepted_reviewed_head: efc815a14f6642b724e6d21301995b7ea8c9ebab
independent_audit_result: PASS
independent_audit_blockers: NONE
acceptance_verdict: READY_FOR_ACCEPTANCE
---

# AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 — Workflow Broker 错误保留与分页校验

> 状态：**accepted**（2026-08-27 lifecycle-only acceptance finalize，PR #68）。  
> 独立审计：AUDIT_RESULT = PASS · BLOCKERS = NONE · READY_FOR_ACCEPTANCE = YES。  
> 本 Spec 自 merged on main 起成为本 scope 的唯一实现授权；preserved WIP
> （`impl/broker-error-preservation-v1-wip` @ ef2bcac）在此授权下移植到
> fresh main。`production_apply_authority = none`（deployment 仍需独立授权）。

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

**AUTHORIZED_IMPLEMENTATION_CHANGED_FILES = 9**（授权实现 PR 的唯一
product/test closure）：

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
```

- **EXTRA_IMPLEMENTATION_FILE_COUNT = 0**；超出此 closure 的改动不在本 Spec
  授权范围内。
- EVIDENCE_ARTIFACT = `docs/reports/broker-error-preservation-v1.md`
- EVIDENCE_ARTIFACT_ALREADY_IN_AUTHORITY_PR = YES（随本 Spec PR #68 入库）
- EVIDENCE_ARTIFACT_REQUIRED_AS_IMPLEMENTATION_PR_CHANGE = NO（未来实现 PR
  **不含** evidence report；实现 closure 严格 = 上述 9 文件）

## 2a. 外部证据 revision 钉定（证据，非授权）

```
SVC_WORKFLOW_EVIDENCE_REPOSITORY = mayf3/svc-workflow
SVC_WORKFLOW_EVIDENCE_REVISION  = 6f1f546787bd5fb1644ec91327d3e7374dc28165
```

该 revision 精确绑定（line-verified 2026-08-25，文件:行号清单见 evidence
report §5.1）：error envelope（`src/http/error.rs:20-119`）、
WorkflowQueryError 读侧映射（`error.rs:503-532`）、auth 层
`unauthenticated`/`forbidden`（`auth/principal.rs:55-63`、
`error.rs:72-78`）、x-request-id 中间件（`http/mod.rs:31-32`）、
worklist limit/cursor 契约（`handlers/worklists.rs:27-108`、
`http/dto.rs:88-92`，其中 **limit 1..20 是 Broker 侧任务冻结契约**，非该
revision 的服务端反序列化边界）、`principal_not_found` 行为（缺失
projection → 404 + 该码）。

- **EXTERNAL_EVIDENCE_IS_AUTHORITY = NO**：svc-workflow 源码只构成证据；
  本 Spec 的实现授权来自自身 accepted and merged on main，别无来源。
- **EXTERNAL_REPOSITORY_OWNERSHIP_PRESERVED = YES**：本 Spec 及其实现均对
  svc-workflow 零改动；该仓库归其 owner 所有。

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

---

## AMENDMENT_1（2026-09-09）— structural-diagnostics manifest opt-in

> **AMENDMENT_STATUS = ACCEPTED（2026-09-09，Owner decision token
> `AMENDMENT_1_ACCEPTED`，docs-only lifecycle acceptance transaction——本
> commit 仅镜像状态与 provenance，R6/A1 语义正文零改动）。**
>
> ACCEPTANCE_PROVENANCE：
> ```text
> AUTHORITY_ACCEPTED        = YES
> AUTHORITY_ACCEPTED_COMMIT = 2a3a107（PR #225 docs commit，Owner 所见 exact head）
> IMPLEMENTATION_COMMIT     = 09d9eb3（与 authority 同分支 stacked）
> IMPLEMENTATION_ACCEPTED   = ONLY_AFTER_INDEPENDENT_IMPLEMENTATION_AUDIT
>                             （独立 Reviewer 审 exact implementation head 09d9eb3；
>                              audit ACCEPT/BLOCKERS=[] 才继续 merge/integration；
>                              Owner acceptance 不构成 implementation 已审计）
> EXACT_HISTORICAL_INVOCATION_PAYLOAD = NOT_RECOVERED（caller transcript 未取；
>                             生产 E2E 关闭该剩余不确定性；不为取 transcript 请求 sudo）
> ```

### A1.0 触发证据（已实证，read-only）

- 生产 `workflow_definition_authoring.replace_draft_graph`（draft
  `2cba2687-073a-420e-a49c-ab271d1583aa`，model 3）的多次真实调用全部在
  Broker 内部以**裸 `invalid_arguments`**（无 detail）拒绝；svc-workflow
  访问日志中该 definition **零** `PUT /draft` 记录（拒绝发生在任何下游
  HTTP 之前）。
- 离线复现（live 字节 == main ac6f727，`/usr/local/libexec/agent-core/app`
  树逐文件 diff 相等）证明：structural 违规（unknown property /
  missing required / 标量类型错误）在 `mapping.js` `validateInvocation`
  中走 `structural.code === undefined` 分支，violations 字符串被丢弃，
  error envelope 仅剩 `{ code: 'invalid_arguments' }`；
  `registry.js` CTR-WDA-007(b) 渲染端因此**无从渲染** detail。
- 与 accepted `AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4`
  CTR-WDA-007(b) 的 mandate（对 replace_draft_graph 本地
  `invalid_arguments` 附 nonempty safe bounded detail）存在实现缺口。
  V4 的 CTR-WDA-007 产品代码边界（manifest + linear compiler + gateway
  wiring + registry 呈现例外）**不覆盖** `mapping.js`，而缺陷恰在
  mapping 层 → 需要本修正案授权。

### A1.1 新增 ruling R6 — manifest-declarable structural diagnostics

沿 R4 的 manifest 声明式元数据模式，新增一个 optional arguments 级
manifest 元数据字段：

```
structuralDiagnostics: true   // 只允许在 operation arguments 根声明；
                              // 缺省 = false（行为与今天逐字节一致）
```

- 当某 operation 的 `arguments.structuralDiagnostics === true` 且
  structural violations 存在且无 `validationError` 声明码解析时，
  `mapping.js` `validateInvocation` 返回的 error envelope 附着
  `detail = violations.join('; ')`，**硬上限 500 字符**（超长截断，
  与 R3 截断纪律一致）。
- `detail` 内容仅为 Broker 自产的违规字符串（property path +
  违规原因），不含任何凭据/身份/下游 body；R3 整信封脱敏红线照常
  适用于该字段。
- 有 `validationError` 声明码的越界类（R4 既有路径）行为不变
  （已附 detail）。
- **模型可见参数 schema 零变化**：`structuralDiagnostics` 是 manifest
  元数据，不是 argument property；`properties` / `required` /
  `additionalProperties` / 嵌套 `items` 形状逐字节不变（CTR-WDA-002
  冻结面不受影响）。
- **未声明该字段的 capability 信封字节不变**（R5 非回归强化：
  calculator/V0、Forum、Scheduler 等全部 capability 的 structural
  失败 envelope 仍为裸 `{ code }`，现有 deepEqual pin 全部保持）。
- 渲染端零改动：`registry.js` 既有 CTR-WDA-007(b) 授权路径
  （authoring + replace_draft_graph + 本地 invalid_arguments）本就
  渲染 `error.detail`；本修正案只是让 detail 真正到达该路径。
  其他 capability 的模型可见文本不变（render 不读未授权场景的
  detail）。
- 无 per-business-system 分支：机制 100% 由 manifest 数据驱动
  （R5 通用性纪律保持；`mapping.js` / `schema.js` 不出现任何
  capability id 判断）。

### A1.2 授权的实现闭包（本修正案生效后）

```
packages/broker/src/mapping.js            （R6 detail 附着，≤8 行）
packages/broker/src/schema.js             （structuralDiagnostics 校验 + canonical 保留）
packages/broker/src/capabilities/workflow-definition-authoring.js
                                          （replace_draft_graph arguments 声明 structuralDiagnostics: true）
packages/broker/test/capabilities/workflow-authoring-structural-diagnostics.test.js
                                          （focused 新增）
```

`AMENDMENT_1_ADDED_FILE_COUNT = 4`（在原 §2 九文件 closure 之外的
增量；原 closure 中 transport/registry/relay/workflow.js 本修正案
**零触碰**）。

说明：`workflow-definition-authoring.js` 的 manifest 数据改动由
accepted `AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4` CTR-WDA-007
产品代码白名单（"the Workflow Authoring manifest"）授权；
`mapping.js` / `schema.js` 由本 Spec（含本修正案）授权。

### A1.3 验收（AMENDMENT_1 focused ACs）

- SD-1：replace_draft_graph 带 unknown root property（如 `graph` 包装）
  → envelope `{ code: 'invalid_arguments', detail: 'unknown property
  "graph"' }`；registry 渲染文本含该 detail。
- SD-2：缺 required（如 `definitionVersionId`）→ detail 命名该属性。
- SD-3：replace_draft_graph 带 `semanticModelVersion`（属于
  create_draft_version 的参数误带到 replace）→ detail
  `unknown property "semanticModelVersion"`。
- SD-4：未 opt-in 的 operation（同 manifest 的 create_definition 等）
  同类违规 → envelope 仍为裸 `{ code: 'invalid_arguments' }`
  （无 detail）。
- SD-5：calculator/V0 既有 deepEqual envelope pin 全部不变
  （`test/broker.test.js` 原样通过）。
- SD-6：schema.js 校验 fail-closed——`structuralDiagnostics: false`
  或非布尔 → manifest 校验失败；canonical 输出仅在 true 时保留该键。
- SD-7：detail 500 字符硬上限（病理深路径违规被截断，无异常抛出）。
- SD-8：broker 包全套件相对 pristine main 基线的通过集不变
  （基线 4 个 index.js 相关 pre-existing 失败如实记录，非本修正案
  引入；其余 345 PASS 保持）。

### A1.4 边界与不授权项

- `production_apply_authority = none`（沿用本 Spec；部署需独立授权）。
- 不改任何 validation predicate（违规判定逻辑零变化；只有违规的
  **呈现**从丢弃变为附着）。
- 不改模型可见 schema / 注册计数 / dispatch 语义 / credential seam。
- 不引入通用 error 转发策略或 registry redesign（渲染端零改动）。
- svc-workflow 零改动（WORKFLOW_DB_CHANGE = NONE 延续）。
