# Agent Core on DSH — Broker Transport V1 (authorized HTTP)

> 让 DSH generic Broker capability 真正能够调用现有 Broker / Forum / Workflow / OKR。
> 本轮把 `packages/broker` 从「manifest → tool schema」补成
> 「manifest → tool → **generic authorized HTTP transport** → Broker endpoint →
> structured tool result」，全程零业务系统专用代码。
> 分支：`feat/broker-transport-v1` · 基于 origin/main `542cc4b`。

---

## 0. 结论（TL;DR）

- 审计（`docs/investigations/broker-capability-parity.md`，docs/broker-capability-audit
  分支）的核心实证：35 个已部署 capability，SERVICE GAP = 0，READY = 0，共享 blocker
  是 **P1 = authorized-HTTP 通用传输缺失**。
- 本轮交付 **P1 的最小通用传输**：credential seam → client_credentials token →
  钉死 origin/method/path → Bearer fetch → 结构化结果/错误，加 **12 项首批 registry
  entry**（Forum ×7 / Workflow ×4 / OKR ×1）。
- 测试 55/55 通过（21 项既有 + 26 项 transport + 8 项真实形状 fixture e2e；含审计修复后的 6 项新增回归），
  任务要求的 14 项 PASS 矩阵全部覆盖。
- **不做**：Router credential injection、credential provisioning、auth-service 重构、
  per-business adapter/plugin、grouped tools、35 项补齐、Process Identity 本体。
- 真实本地 Broker 已探活（svc-forum/workflow/auth-service 在线），但部署凭据文件
  对当前会话不可读（0700/root），**未伪造「真实迁移已完成」**；如实记录为
  REAL VERIFICATION = 受凭据可读性阻塞（见 §9）。

---

## 1. CURRENT BROKER FLOW（改动前）

```
manifest（纯数据）──schema.js 校验──▶ registry.js buildToolDefinition
   └─ handlersByCapability（包内静态映射）
            │
            ▼
        handler(operation, args, principal)   ← 进程内纯函数（calculator 模式）
            │
            ▼
   { ok:true, result } | { ok:false, error:{ code } }
```

- 只有 `external.calculator` 一种 capability；handler 只能做进程内计算。
- `identity.js` 的 `resolvePrincipal` 是占位（env `AGENT_CORE_PRINCIPAL`）。
- **没有**：token 获取、凭据解析、fetch、origin/method/path 钉死、Idempotency-Key、
  401 重试、4xx/5xx 映射。审计口径下 READY = 0。

## 2. NEW TRANSPORT FLOW（本轮）

```
manifest（纯数据，可含每 operation 的 http 绑定）──schema.js 校验──▶ registry.js
   │                                                              （含 http 字段校验）
   ├─ 无 http 绑定 ─▶ handlersByCapability（calculator 保留原路径，V0 语义 1:1）
   │
   └─ 有 http 绑定 ─▶ createHttpHandlers(manifest, transport)   ← 通用生成，零业务代码
                              │
                              ▼
                  createHttpTransport（P1 通用传输，一次创建供全部 capability 共用）
   1. op.http 取 targetId → targets.js 解析 allowedOrigin + audience（钉死）
   2. credentialProvider.getCredential() ──▶ 无凭据则 FAIL CLOSED（credential_unavailable）
   3. auth-service client_credentials 换 token（resource=audience, scope=requiredScopes），
      按 (clientId, audience, scope) 缓存
   4. bindRequest：pathParams（精确匹配 + encodeURIComponent）/ query / JSON body
      ——只转发 manifest 声明的参数名
   5. fetch（Authorization: Bearer；写请求 Content-Type: application/json）
   6. 401 → 使缓存失效 → 重新签发一次 → 重试（复用同一 Idempotency-Key）
   7. 非 2xx → http_4xx / http_5xx（带 status + 上游 detail）；JSON 解析失败 → malformed_response；
      网络/超时 → transport_failure
                              │
                              ▼
   { ok:true, result } | { ok:false, error:{ code, status?, detail? } }
```

传输层是**纯数据驱动**：Forum / Workflow / OKR / 未来能力只差 manifest 数据。
`transport.js` 里没有任何 `if (forum|workflow|okr)` 分支（grep 可证）。

## 3. CREDENTIAL SEAM（identity，只留缝不接线）

`src/credential.js`：

```
createCredentialProvider({ injected?, source? }) → { getCredential(): Promise<Credential|undefined> }
Credential = { clientId, clientSecret }
```

- 取值优先级：`injected`（构造时注入：测试 / 未来 Router spawn 注入）→ env 占位
  （`AGENT_CORE_BROKER_CLIENT_ID` / `AGENT_CORE_BROKER_CLIENT_SECRET`，仅开发用）
  → `undefined`（transport **fail-closed**：`credential_unavailable`，绝无匿名请求）。
- `getCredential` 设计为 async：最终 Process Identity 集成可换成读进程凭据文件 /
  DSH `ctx.credentials.resolve`，**transport 契约不变**。
- 本 PR 明确不做：Router spawn credential、provisioning/rotation、credential→principal
  最终绑定、auth-service 重构。
- **纪律（含测试断言）**：tool 参数 schema 无任何 principal/credential 字段；transport
  从不读 `args` 里的 agentId / principalId / sessionKey / credential / idempotencyKey
  （不在绑定列表内的参数根本到不了 wire；`caller 自报 agentId 无法覆盖 credential` 测试
  在 args 里塞满走私身份字段，断言 wire 上仍只有 seam 凭据）。

## 4. REQUEST MAPPING

manifest 每 operation 的可选 `http` 绑定块（schema.js 校验，通用字段扩展）：

```js
http: {
  target: 'svc-forum',                 // targets.js 注册表 targetId（可信配置，模型不可控）
  method: 'GET',                       // GET|POST|PUT|DELETE（钉死）
  path: '/api/threads/{threadId}',     // 路径模板，{name} 占位符
  pathParams: ['threadId'],            // 参数名 → 路径占位符（精确匹配，多/缺/空都是 binding_error）
  query: ['page', 'limit'],            // 参数名 → query（undefined/null/'' 省略）
  body: ['content'],                   // 参数名 → JSON body 对象（写方法；undefined 字段丢弃）
  idempotencyKey: false,               // 通用 Idempotency-Key 开关
}
```

- **为什么现有 schema 无法表达**：V1 manifest 只描述模型侧契约表面（operation +
  参数 schema + 错误码），执行委托给进程内 handler；authorized-HTTP 传输需要一组
  **可信的、模型不可控的**元数据把出站请求钉死（哪个 target / 哪个 method / 哪条 path /
  哪些参数名可以进入 path/query/body）。现有字段没有任何一个能承载它，因此增加
  通用 `http` 块——这是最小扩展，且每项校验 fail-closed（绑定的参数名必须已在
  `arguments.properties` 声明；path 占位符必须全部被 pathParams 覆盖；
  有 http 绑定的 capability 必须声明 `requiredScopes`）。
- 附带 schema 松弛：wire id 允许扁平下划线形式（`forum_read_thread` 等真实
  capabilityId 无点号；原正则强制点号命名）。
- 路径值 `encodeURIComponent` 防注入；URL 由 `allowedOrigin + path + query` 拼装，
  不存在任意 URL fetch 面。

## 5. IDEMPOTENCY

- **服务端真实要求**（实证）：svc-workflow 写面（transitions / cancel / archive /
  assistance / domain ops）要求 `Idempotency-Key` header：1–128 个可见 ASCII 字符，
  缺失 → 400 `missing_idempotency_key`，复用 → 409 `idempotency_conflict`
  （`svc-workflow/src/http/handlers/mod.rs:33-60`）。svc-forum / svc-okr 无此要求。
- **通用实现**（transport.js，单一实现，不 per-capability）：operation 声明
  `idempotencyKey: true` 时，传输层在**可信区**生成
  `ik-<capabilityId>-<ts>-<rand>`（满足服务端 1–128 可见 ASCII 契约），随请求发出；
  **401 重试复用同一把 key**（服务端幂等去重，重试不会重复提交）；模型传入的
  `idempotencyKey` 参数永远被忽略（测试断言）。
- 首批 12 项均为读面 + forum_reply（svc-forum 无 IK 要求），因此首批 entry 不含
  IK 标志；机制由真实形状 fixture 证明（workflow-transition 形状 + mock server，
  断言 key 在 wire 上、401 重试同值、模型值被忽略）。后续写面 entry
  （workflow_transition / create_instance / cancel / archive…）只需在 manifest 里
  打开 `idempotencyKey: true`，零传输层改动。

## 6. ERROR MODEL

wire 信封保持 `{ ok, result | error:{ code } }`，error 增加可选 `status` / `detail`
（向后兼容：V0 只消费 `code`）。传输错误码是**通用表**（`transport.js` 导出，
`withTransportErrors` 通用地并入每个 HTTP capability 的错误表，经 mapping 层
fail-closed 校验后原样透出）：

| code | 触发 |
|---|---|
| `credential_unavailable` | seam 无凭据（fail-closed；含畸形凭据） |
| `binding_error` | path/query/body 绑定失败（缺/多/空 path 参数、未知 target、非法 header） |
| `http_4xx` | 上游 4xx（带 status + 上游 body detail；含 401 重试耗尽） |
| `http_5xx` | 上游 5xx（带 status + detail） |
| `malformed_response` | content-type 为 JSON 但 body 解析失败 |
| `transport_failure` | 网络错误 / 超时 / token 端点不可达或异常 |
| （既有）`invalid_arguments` / `unsupported_operation` | 参数 schema 违规 / 未知 operation |

handler 抛异常仍 fail-closed 到 `invalid_arguments`（V0 语义不变）。

## 7. CAPABILITIES ADDED（首批 12 项）

能力 id / method / path / scope 一律以 `docs/investigations/broker-capability-parity.md`
§1.2（部署 registry）为准，并交叉核对真实服务源码
（svc-workflow `src/http/mod.rs` + handlers、svc-forum `src/{app,routes,middleware}/*.ts`、
svc-okr `src/routes/goals/core.ts`、auth-service `src/routes/oauth.ts`）：

| capabilityId | method / path | scope | 来源核对 |
|---|---|---|---|
| `forum_my_notifications` | GET `/api/me/notifications`（reason/page/limit） | forum.read | me.ts `GET /notifications` + scope-guard |
| `forum_read_thread` | GET `/api/threads/{threadId}` | forum.read | threads.ts:146 |
| `forum_read_transcript` | GET `/api/threads/{threadId}/transcript`（format=md\|json） | forum.read | threads.ts:261 |
| `forum_reply` | POST `/api/threads/{threadId}/messages`（content 必填 + kind/parentId/attachments/metadata） | forum.write | messages.ts POST / |
| `forum_mark_read` | PUT `/api/threads/{threadId}/read` | forum.write | threads.ts:321 |
| `forum_list_threads` | GET `/api/threads`（q/type/status/sort/page/limit） | forum.read | threads.ts list 路由 |
| `forum_search_threads` | GET `/api/search`（q/page/limit） | forum.read | search.ts |
| `workflow_my_tasks` | GET `/internal/v1/worklists/assigned-to-me`（limit） | workflow.read | mod.rs:123 + worklists.rs |
| `workflow_instance_detail` | GET `/internal/v1/workflow-instances/{workflowInstanceId}` | workflow.read | mod.rs:45 + instances.rs |
| `workflow_submission_history` | GET `/internal/v1/workflow-instances/{workflowInstanceId}/submissions`（limit） | workflow.read | mod.rs:111 + submissions.rs |
| `workflow_my_domains` | GET `/internal/v1/principals/me/domains` | workflow.read | mod.rs:137 |
| `okr_read` | GET `/api/goals/mine` | okr.read | goals/core.ts:27 |

文件：`src/capabilities/{forum,workflow,okr}.js`（纯数据）；`targets.js` 携带三个 target
的 allowedOrigin + audience（镜像部署 registry）。默认注册 = calculator + 12（bundle
patch 未改，Config 默认值生效）；**注册不需要凭据，执行无凭据时 fail-closed**。

## 8. TEST EVIDENCE

`cd packages/broker && npm test` → **55/55 PASS**（21 既有 + 26 `test/transport.test.js`
+ 8 `test/capabilities.test.js`，含 §12 审计修复的 6 项新增回归）。

任务要求矩阵（全部 PASS）：

| 要求 | 用例 |
|---|---|
| manifest → DSH tool | capabilities.test：12 manifest 全部过 schema；`forum_reply` buildToolDefinition 出 tool、operation enum、无身份字段 |
| path param mapping | transport.test：`buildPath` 精确匹配/编码/多/缺/空拒绝 + e2e 断言请求路径 |
| query mapping | transport.test：`buildQuery` 省略 undefined/null/'' + e2e 断言 `?tag=hot` |
| JSON body | transport.test：POST body 序列化、undefined 字段丢弃 |
| GET authorized request | transport.test：token(Basic)→Bearer→GET 全链断言 |
| POST authorized request | transport.test：POST + Content-Type: application/json + body 断言 |
| credential 被 transport 使用 | transport.test：provider spy 恰被调 1 次；token 端点收到 Basic(base64(clientId:secret)) |
| caller 自报 agentId 无法覆盖 credential | transport.test：args 塞满 agentId/principalId/sessionKey/credential/IK，wire 上仍只有 seam 凭据 |
| Idempotency-Key | transport.test + capabilities.test：生成、格式、401 重试同值、模型值被忽略 |
| 4xx mapping | transport.test + capabilities.test：`http_4xx` + status + detail（404 经真实 manifest） |
| 5xx mapping | transport.test：`http_5xx` status 500 |
| malformed response | transport.test：200 + `application/json` + 坏 body → `malformed_response` |
| timeout/network failure | transport.test：TimeoutError → `transport_failure`；真实连接拒绝 → `transport_failure` |
| ≥3 真实形状 fixture | capabilities.test：forum_reply（POST+path+body）、workflow_instance_detail（GET+path）、workflow_my_tasks（GET+query）、okr_read（GET 无参）——全部 mock server |

另含：token 缓存（同 (client,audience,scope) 只签发一次；过期重签）、401 重试耗尽 →
http_4xx(401)、未知 target → binding_error、`withTransportErrors` 通用并入错误表、
`createHttpHandlers` 只映射 http 操作、既有 21 项 V0 回归全绿。

**插件级端到端复核**（独立于单测，本机真实 `@deepseek-ai/dsh-tools` + mock 端点）：
`apply()` 注册 13 个编译后 tool；`okr_read` 无凭据执行 → `credential_unavailable`
（fail-closed）；注入凭据 + mock 端点后 `forum_my_notifications` 完整走通
（token req `resource=svc-forum scope=forum.read` → `GET /api/me/notifications?reason=mention`
Bearer → `{ok:true,result}`）。

## 9. REAL VERIFICATION（有尝试，受凭据可读性阻塞）

- 本地真实服务探活：auth-service:4001（`/oauth/token` 无凭据 → 400，契约在岗）、
  svc-forum:3460（200）、svc-workflow:8989（在线）、svc-okr:3459 未响应。
- 部署 registry 可读：`~/.openclaw/openclaw.json` → 87 个 agent client（clientId +
  secretRef），3 targets + authServiceOrigin 与 parity 审计一致。
- **阻塞点**：`~/.openclaw/credentials/`（secret 文件）对当前会话 `Permission denied`
  （0700/root 属主）；auth-service `.env` 同样不可读。无 secret 无法走真实
  client_credentials → **无法在不依赖 P2 真身份接线的前提下安全打真实 Broker**。
- 处置：**不伪造**。真实迁移完成的判定留给凭据可读/可注入之后（见 §10/§11）。

## 10. IDENTITY INTEGRATION NEED（跨 repo/package 改动清单，只记录不实施）

如果明天 Process Identity 把真实 credential 接进来，**本 Broker package 还差什么**
才能让一个真实 Agent 调 Forum/Workflow/OKR：

1. **Broker 侧（本包内，最小）**：把 `createCredentialProvider({ injected })` 的注入点
   接上真实 per-agent 进程凭据。两种等价做法：
   a. Router spawn 时把 `{ clientId, clientSecret }` 作为插件 Config `credential` 注入
      （本包已支持，零代码改动）；
   b. 或实现同一个 `{ getCredential(): Promise<Credential|undefined> }` 契约的新 provider
      （读进程凭据文件 / DSH `ctx.credentials.resolve`），在 `index.js` 换装。
   **除此之外 Broker 包不需要任何其他改动**——12 项 entry、scope、IK、错误模型全齐。
2. **Router（跨包，不实施）**：per-agent DSH 进程 spawn 时注入该 agent 的凭据
   （Plan B：`docs/investigations/identity-auth.md` §7）。这是 P2 的主体，属于
   agent-router / 控制面 ownership。
3. **凭据可读性/安全**：真实部署中 `~/.openclaw/credentials/*` 当前对 agent 会话不可读；
   P2 落地时凭据的分发与读取必须走进程注入（而非共享目录），避免本会话遇到的权限问题。
4. **授权数据**：agent client 的 grant（scope）沿用 auth-service 现状；若某 agent 缺
   `forum.write`/`workflow.execute` 等 scope，由 auth-service 侧授予（不在本包）。
5. **可选后续（非阻塞）**：`workflow.execute` 写面 entry（复用 IK 机制）、opaque cursor
   翻页参数、per-capability allowlist（`forum_admin_unread` 等）、grouped tools。

## 11. DEFERRED CAPABILITIES（明确不做）

❌ Router credential injection · ❌ credential provisioning/rotation 平台 ·
❌ auth-service 重构 · ❌ Forum/Workflow/OKR 专用 plugin · ❌ grouped tools ·
❌ 全 35 capability 补齐 · ❌ watch/unwatch · ❌ workflow timeline ·
❌ workflow 写面（transition/create/cancel/archive/domain ops——机制已备，等下一批 entry）·
❌ OKR write · ❌ Self-Evolution · ❌ Mobile · ❌ Kernel change。

## 12. AUDIT FOLLOW-UP（两轮独立审计后的修复，PR #9 更新）

VERDICT = MERGE AFTER SMALL FIX。整体架构与 Generic Broker 方向不变，无重构、无新安全体系。
本轮只修 4 项 + 一个局部 401 策略收紧：

| 项 | 修复 | 位置 | 测试 |
|---|---|---|---|
| **DOT_SEGMENT_FIX** | `buildPath` 在通用绑定层 fail-closed：path 参数值 `"."` / `".."` → `binding_error`（`encodeURIComponent` 不改写点号，URL normalization 会把 `..` 折叠改写 manifest 钉死的 path） | `transport.js buildPath` | unit：`.`/`..` 拒绝、`a.b`/`a%2F..` 放行；e2e：`.`/`..` → `binding_error` 且 **token/business 请求数均为 0**（不发任何 HTTP 请求） |
| **FORUM_SEARCH_Q_FIX** | `forum_search_threads.q` 改为 required（svc-forum `/api/search` 空 q → 400） | `capabilities/forum.js` | manifest `required=['q']`、tool schema `q.required=true`、缺 q → `invalid_arguments` 且 transport 不执行 |
| **FORUM_REPLY_KIND_FIX** | `forum_reply.kind` 收紧为 reviewer-safe 枚举 `comment|proposal|challenge|clarification|evidence`（真实部署面：OpenClaw broker adapter 与 forum-access skill 的 `ALLOWED_MESSAGE_KINDS` 同源；`system`/`decision` 需 `forum.moderate`，首批只暴露 `forum.write` 路径）——tool schema 不再让模型合法选择必然 403 的 kind | `capabilities/forum.js` | tool schema enum 精确匹配且不含 system/decision；`kind:'system'` → `invalid_arguments` 且 transport 调用数为 0；`kind:'comment'` 放行到达 transport |
| **TOKEN_CACHE_ISOLATION_TEST** | 缓存设计未改（key = `clientId|audience|scope`），只补回归证明 | `transport.js`（无改动） | A→tok-A；B→tok-B（新签发）；A→复用 tok-A（零新 token 请求）；同 client 换 audience / 换 scope 各自新签发。另扩充走私测试：`args.authorization/target/scope` 无法改变 wire 上的 Bearer / pinned path / token 请求的 resource 与 scope |
| **401_RETRY_CHANGE** | **DONE**（局部收紧，几行）：401 重试仅允许 **GET** 或 **idempotencyKey=true** 的写请求；无 IK 的非幂等写遇到 401 直接 fail-closed（`http_4xx` 401），避免已落盘后重试造成双写。当前三个真实 service 均为 auth middleware → business handler，无已复现双写；此收紧是纯防御，不改 401 语义 | `transport.js execute` | 新增：GET 401 → 仍刷新 token 重试一次；POST 无 IK + 401 → 业务请求恰 1 次、token 恰 1 次、结果 `http_4xx`(401)；既有 IK 写 401 重试（同 key 复用）回归不变 |

**本轮明确不做**（审计提出的 hardening/cleanup 全部记录不实施）：mTLS/sidecar/TPM/keyring、
新 credential→principal mapping 表、Auth 重构、response redaction framework、token cache
single-flight、distributed/security policy layer、35 项补齐、三业务专用 plugin；
以及 `Math.random`→crypto UUID、uppercase scope 校验、repeated path placeholder 泛化
（均不因"更完美"主动做）。

**修复后确认**：
- generic transport 仍无 forum/workflow/okr 逻辑特判（grep：通用模块内仅有注释/文档引用）；
- Credential 仍是现有 `{ clientId, clientSecret }` seam，无新增 principal mapping；
- Broker 不新增 principal mapping；Kernel change = NONE（只动 `packages/broker/**` + 本报告）。

---

## 附：本 PR 文件清单

```
packages/broker/src/schema.js        （改）id 语法松弛 + requiredScopes + http 绑定校验
packages/broker/src/mapping.js       （改）transport 错误 status/detail 透传
packages/broker/src/registry.js      （改）output error schema + status/detail
packages/broker/src/index.js         （改）Config(targets/authServiceOrigin/credential) + transport 接线 + 默认 manifests
packages/broker/src/credential.js    （新）身份 seam（最薄可替换）
packages/broker/src/targets.js       （新）target 注册表数据
packages/broker/src/transport.js     （新）P1 通用 authorized HTTP 传输 + createHttpHandlers + 错误表
packages/broker/src/capabilities/forum.js    （新）7 项 manifest
packages/broker/src/capabilities/workflow.js （新）4 项 manifest
packages/broker/src/capabilities/okr.js      （新）1 项 manifest
packages/broker/test/transport.test.js       （新）21 用例
packages/broker/test/capabilities.test.js    （新）7 用例（真实形状 fixture）
packages/broker/package.json        （改）exports
docs/reports/broker-transport-v1.md （新）本报告
```
