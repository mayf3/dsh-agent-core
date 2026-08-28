# Agent Core on DSH — Broker 错误保留与分页校验 V1（报错 执行）

> TASK_NAME = 报错 执行 · REPO = mayf3/dsh-agent-core
> 修复 Workflow Broker 将精确服务错误压扁成通用 `http_4xx` 的问题，并补齐
> `workflow_my_tasks` 的分页参数校验。本轮**不负责** Principal projection /
> Domain 迁移，**未修改** svc-workflow，**未 deploy**。
> 基线：branch `docs/lark-ux-phase1-v2-spec` @ b5ab589。

---

## 0. 结论（TL;DR）

- **WORKFLOW_ERROR_PRESERVATION = PASS**：`workflow_my_tasks` 失败时保留
  `http_status` + `service_error_code`（如 `principal_not_found`）+
  `sanitized_detail` + `x-request-id`，模型可见信封与渲染均不再只有 `http_4xx`。
- **REQUEST_ID_PRESERVED = PASS**：transport 读取 svc-workflow 响应
  `x-request-id`（服务端 tower-http UUID，`svc-workflow/src/http/mod.rs:31-32`），
  逐层传递 transport result → mapping result → relay → final renderer；
  缺失时省略（允许 null），**从不伪造**。
- **LIMIT_RANGE_VALIDATION = PASS**：`workflow_my_tasks` 的 `limit` 在 Broker
  层验证 `1 <= limit <= 20`；非法值在**任何 HTTP 请求（含 token 请求）发出前**
  本地 fail-fast 返回 `invalid_pagination`，测试证明 HTTP call count = 0。
- 测试：broker 包 89/89 通过（原 74 + 新增 15）；全仓 473 中 469 通过，
  2 个失败均为**预先存在/环境性**（`agent-provisioning` 的 harness 版本漂移
  rc.5 vs rc.8；以及并行外部审计会话向本仓 `node_modules/@agent-core/` 写入
  `/private/tmp/dgaudit-orderA` 符号链接造成的 EEXIST 竞态——与本轮无关，
  单文件重跑即过）。
- **PRODUCT_CODE_CHANGE = BROKER_ERROR_RENDERING_AND_VALIDATION_ONLY**；
  WORKFLOW_DB_CHANGE = NONE；PRODUCTION_CHANGE = NONE；本轮未 deploy。

---

## 1. 改动前的问题（复现路径）

```
svc-workflow 404 {"error":{"code":"principal_not_found","message":"principal not found"}}
  + x-request-id: <uuid>
        │
        ▼  transport.js execute() 非 2xx 分支（旧）
{ errorCode: 'http_4xx', status: 404, detail: <原始 body 文本，未脱敏> }   ← 无 request-id
        │
        ▼  mapping.js resolveCode → manifest 未声明服务码 → 信封
{ ok:false, error:{ code:'http_4xx', status, detail } }                    ← 压扁
        │
        ▼  registry.js render
"workflow_my_tasks: list() failed: http_4xx"                               ← 模型只见 http_4xx
```

旧实现还有两个附带问题：`detail` 直接携带**原始 body**（未脱敏，可能回显上游
echo 出的凭据材料）；`limit` 无本地校验，`0/-1/21` 会进入 svc-workflow 后变成
泛化 422。

---

## 2. 机制设计（零业务分支，全部走 manifest 数据）

### 2.1 错误保留（transport → mapping → relay → renderer）

- **transport（`src/transport.js`）**：新增纯函数
  - `parseServiceErrorBody(bodyText)`：识别三种 envelope——svc-workflow
    `{"error":{"code","message"}}`、generic `{"code","message"}`、forum/legacy
    `{"error":"slug","message"}`；`code` 仅在匹配安全语法
    `^[a-z][a-zA-Z0-9_]{0,63}$` 时返回（人类散文如 "no such thread" 归为
    message，不是 code）。
  - `sanitizeErrorDetail(text)`：脱敏 + 截断（500 字符）。红线：
    `Bearer <token>`（先于 Authorization 头规则执行，否则只吃掉 "Bearer"
    一词漏掉 token 本体）、`authorization[:=]<值>`、
    `token/secret/password/credential/api-key` 赋值、≥40 字符不透明长串
    （JWT/hex/base64）。**raw body / raw headers 从不进入 detail**——非 JSON
    错误体只返回固定占位符。
  - `extractRequestId(headers)`：`x-request-id` 原样透传（可见 ASCII，
    1..128），缺失/非法 → null，**绝不生成**。
  - `buildDownstreamError(status, bodyText, headers)`：非 2xx 返回
    `{ errorCode: <服务码|http_4xx|http_5xx>, status, detail: <脱敏 message>,
    requestId }`。
- **mapping（`src/mapping.js`）**：transport 错误的 code 解析保持 **fail-closed**
  ——服务码必须在 manifest 错误表内**已声明**才透出；未声明的服务码降级到
  **status-aware canonical fallback**（4xx→`http_4xx`，5xx→`http_5xx`，均由
  `withTransportErrors` 保证已声明），**绝不**降级成 `invalid_arguments`、
  绝不让未声明 code 上 wire。`requestId` 为非空字符串时透传。
- **manifest（`src/capabilities/workflow.js`）**：四个 Workflow 读能力声明
  svc-workflow 读侧真实错误码（证据 `svc-workflow/src/http/error.rs:503-532`
  `WorkflowQueryError` 映射 + `auth/principal.rs` 401 `unauthenticated` +
  `require_scope` 403 `forbidden` + `handlers/worklists.rs` 422
  `invalid_cursor`）：`principal_not_found` / `principal_disabled` /
  `unauthenticated` / `forbidden` / `invalid_pagination` / `invalid_cursor` /
  `internal_consistency_error` / `service_unavailable`，instance 侧另加
  `workflow_instance_not_found_or_not_visible` /（submission_history）
  `restricted_history_not_visible` / `global_coordinator_required`。
- **relay（`src/relay.js`）**：parent 信封中的 `requestId` 原样带回 child
  invoke（两侧共享 DEFAULT_MANIFESTS，故已声明服务码在 child 侧解析一致）。
- **renderer（`src/registry.js`）**：失败渲染从 `failed: <code>` 升级为
  `failed: <code> (status=<s>, request_id=<id>)`；output schema 的 error
  增加 `requestId` 字段；成功渲染与 calculator V0 验收文本字节不变。

模型可见结果（建议形态达成）：

```
code = principal_not_found, status = 404,
request_id = <服务端 uuid>, detail = "principal not found"
```

### 2.2 分页校验（Broker 层 fail-fast）

- manifest 叶子 schema 新增 `minimum` / `maximum` / `validationError`
  （`src/schema.js` 校验：数值边界、`validationError` 必须引用已声明错误码）。
- `workflow_my_tasks` 的 `limit` 声明 `{type:'integer', minimum:1, maximum:20,
  validationError:'invalid_pagination'}`。
- `src/mapping.js` `validateArgumentsDetailed`：越界违规携带声明的
  `validationError` code（附 broker 自产违规消息作 detail），在 child 与
  gateway 两侧的 invoke 内、**任何 token/HTTP 请求之前**执行。
- **cursor**：本批能力未暴露 cursor；transport 只转发 manifest 声明的 query
  名，因此 `before_created_at`/`before_id`（乃至任何"半个 cursor"）**从不**到达
  svc-workflow（测试 C 显式断言出站 query 只有 `limit`）。

### 2.3 守护的不变量

- transport 仍 100% 通用（无 `if (workflow|forum)` 分支；错误码差异全部是
  manifest 数据）。
- `resolveCode` fail-closed 语义不变：wire 上的每个 code 都在 manifest 表内。
- identity/credential seam 零改动；无凭据/token 返回或记录（脱敏测试 E 证明
  整个信封无秘密）。
- 旧行为兼容：未声明服务码 → `http_4xx/http_5xx` + status +（新增）脱敏
  detail/request-id；既有 74 项测试全部原样通过（含 forum 404 形状）。

---

## 3. 测试矩阵（任务 ACs A–F）

| AC | 测试（文件） | 断言要点 | 结果 |
|---|---|---|---|
| A. projection 存在、无任务 | `capabilities.test.js` A | 200 + `items=[]` 透传 | PASS |
| B. projection 缺失 | `capabilities.test.js` B | `principal_not_found` + status 404 + request-id 保留；渲染含 `status=404, request_id=<uuid>` | PASS |
| C. invalid limit | `capabilities.test.js` C + `transport.test.js` bounds | `0/-1/21/999` → 本地 `invalid_pagination`；token 请求数 = 0、业务请求数 = 0；边界 1/20 放行；half-cursor 不转发 | PASS |
| D. downstream 403 | `capabilities.test.js` D | `forbidden` + status 403 + request-id 保留 | PASS |
| E. 敏感内容脱敏 | `capabilities.test.js` E + `transport.test.js` sanitize 单元 | JWT/token/credential 值在整个信封缺席；`[REDACTED]` 标记存在 | PASS |
| F. Forum 非回归 | `capabilities.test.js` F + 既有 forum fixture | 未声明服务码 → 已声明 `http_4xx` + status + detail；forum_reply 成功路径不变 | PASS |
| 补充：instance_detail 404 | `capabilities.test.js`（改写旧测试） | 真实 svc-workflow envelope：`workflow_instance_not_found_or_not_visible` + request-id | PASS |
| 补充：5xx 未声明码 | `transport.test.js` | 降级 `http_5xx`（非 `invalid_arguments`）+ detail | PASS |
| 补充：request-id 缺失/非法 | `transport.test.js` extractRequestId | null，不伪造；非 JSON body 不落 raw | PASS |
| 补充：relay request-id | `relay.test.js` | parent→child 信封保留 requestId | PASS |

- broker 包：**89/89 PASS**（`node --test`，5 个文件）。
- 全仓 `packages/*/test/*.test.js`：473 项，469 过；2 失败均为预先存在/环境性
  （§0），与本轮改动无关（`git stash` 基线复验过 harness 版本漂移失败）。

---

## 4. 改动清单（closure 拆分）

**AUTHORIZED_IMPLEMENTATION_CHANGED_FILES = 9**（未来授权实现 PR 的唯一
product/test closure，与
`AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1` §2 一致）：

```
packages/broker/src/transport.js        （改）错误体解析/脱敏/request-id 提取/非2xx重构 + malformed_response 带request-id
packages/broker/src/mapping.js          （改）validateArgumentsDetailed(bounds+validationError)、requestId 透传、status-aware fallback、违规 detail
packages/broker/src/schema.js           （改）叶子 minimum/maximum/validationError 校验 + validationError 必须引用已声明码
packages/broker/src/registry.js         （改）output schema + 失败渲染诊断
packages/broker/src/relay.js            （改）requestId 透传
packages/broker/src/capabilities/workflow.js （改）读侧错误码表 + limit 1..20 契约
packages/broker/test/transport.test.js       （改）新增/改写
packages/broker/test/capabilities.test.js    （改）ACs A–F
packages/broker/test/relay.test.js           （改）request-id 透传
```

**EXTRA_IMPLEMENTATION_FILE_COUNT = 0**。

- EVIDENCE_ARTIFACT = `docs/reports/broker-error-preservation-v1.md`（本报告）
- EVIDENCE_ARTIFACT_ALREADY_IN_AUTHORITY_PR = YES（随 Spec Draft PR #68 入库）
- EVIDENCE_ARTIFACT_REQUIRED_AS_IMPLEMENTATION_PR_CHANGE = NO（未来实现 PR
  **不含**本文件；证据归 authority PR，实现 closure 严格 = 上述 9 个文件）

svc-workflow / auth-service / 数据库 / 部署：**零改动**。

---

## 5. 治理记录（DEVELOPMENT_PREFLIGHT 摘要 + Authority Gate 结论）

- 相关 artifact（**均为 descriptive report，非 implementation authority**）：
  `docs/reports/broker-transport-v1.md`（transport V1 的历史行为记录——本报告
  描述其错误映射行为被修订：`http_4xx + raw detail` → 保留服务码/status/脱敏
  detail/request-id；该 report 本身不授予也不曾授予实现权限）；
  `docs/reports/trusted-credential-broker-integration-v1.md`（relay/gateway
  信封的历史行为记录——加法扩展 `requestId`）。
- **冻结**：
  - REPORTS_ARE_DESCRIPTIVE = YES
  - REPORT_PASS_IS_IMPLEMENTATION_AUTHORITY = NO
- `docs/specs/` 中无直接 govern broker 错误映射的 accepted Spec（Authority
  Gate 逐项核查：transport / capability-manifest / relay-envelope / renderer
  四项 accepted authority 均为无）。
- OWNER_TASK_IS_AUTHORING_INPUT_ONLY = YES（operator 任务指令只是本报告的
  撰写输入与验收清单来源）
- OWNER_TASK_IS_IMPLEMENTATION_AUTHORITY = NO
- **唯一未来实现 authority**：`AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1`
  **accepted and merged on main**。在此之前，preserved WIP implementation
  （`impl/broker-error-preservation-v1-wip` @ ef2bcac）merge forbidden。
- 未 reopen 任何 rejected 方案。

### 5.1 外部证据 revision 钉定

```
SVC_WORKFLOW_EVIDENCE_REPOSITORY = mayf3/svc-workflow
SVC_WORKFLOW_EVIDENCE_REVISION  = 6f1f546787bd5fb1644ec91327d3e7374dc28165
（本地 checkout mayf3/svc-workflow @ 6f1f546，2026-08-22 提交，
 2026-08-25 line-verified；工作树无相关改动）
```

该 revision 精确绑定以下证据：

- error envelope `{"error":{"code","message","details"?}}`：
  `src/http/error.rs:20-119`（`ApiError` / `ErrorEnvelope` / `from_query_rejection`）
- WorkflowQueryError 读侧映射（`principal_not_found` / `principal_disabled` /
  `workflow_instance_not_found_or_not_visible` / `restricted_history_not_visible` /
  `global_coordinator_required` / `invalid_pagination` /
  `internal_consistency_error` / `service_unavailable`）：
  `src/http/error.rs:503-532`
- auth 层 401 `unauthenticated`：`src/auth/principal.rs:55-63`；
  403 `forbidden`（require_scope）：`src/http/error.rs:72-78`
- x-request-id 中间件（tower-http UUID 生成 + 传播）：
  `src/http/mod.rs:31-32`
- worklist limit（`Option<u32>`，Broker 侧 1..20 为任务冻结契约，
  非服务端反序列化边界）与 cursor 解析（422 `invalid_cursor`）：
  `src/http/handlers/worklists.rs:27-108`、`src/http/dto.rs:88-92`
- `principal_not_found` 行为（缺失 projection → 404 + 该码）：
  `src/http/error.rs:124/175/272/506` 及上述 WorkflowQueryError 映射

- EXTERNAL_EVIDENCE_IS_AUTHORITY = NO（svc-workflow 源码是**证据**，
  不是本仓实现授权；本仓唯一实现 authority 见 §5）
- EXTERNAL_REPOSITORY_OWNERSHIP_PRESERVED = YES（本轮对 svc-workflow
  零改动、零 commit、零 push；其仓库与 revision 归其 owner 所有）

## 6. 遗留 / 建议

- `workflow_submission_history` 也有 `limit` 参数，本轮按任务冻结范围**未**加
  bounds（其非法值仍会到达 svc-workflow 变成 422 `invalid_pagination`——
  现在至少会以服务码+request-id 形式透出）。建议下轮补齐。
- 服务码透出依赖 manifest 声明：svc-workflow 未来新增读侧错误码需同步 manifest
  错误表，否则按设计降级为 `http_4xx/5xx` + status + detail（fail-closed，
  不会误导，但会丢精确码）。
- 外部并行会话正在向本仓 `node_modules/@agent-core/` 写 `/private/tmp/dgaudit-orderA`
  符号链接，干扰 agent-provisioning 的幂等测试（EEXIST）；建议 owner 知悉。

---

TASK_NAME = 报错 执行
WORKFLOW_ERROR_PRESERVATION = PASS
REQUEST_ID_PRESERVED = PASS
LIMIT_RANGE_VALIDATION = PASS
PRODUCT_CODE_CHANGE = BROKER_ERROR_RENDERING_AND_VALIDATION_ONLY
WORKFLOW_DB_CHANGE = NONE
PRODUCTION_CHANGE = NONE
DEPLOYMENT = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 报错 审计
