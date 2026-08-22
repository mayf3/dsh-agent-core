---
spec_id: NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
status: accepted
date: 2026-08-22
accepted_date: 2026-08-22
type: implementation-spec (spec only; no implementation this round)
repository: mayf3/dsh-agent-core
base_main: 54ac27ff8a39fe6035b497dc3ae43958479df3db
governing_spec: AGENT_CORE_HARDENING_PROGRAM_V1
scope:
  - notification-ingress service-caller authentication (credential verification, caller identity, allowlist)
  - durable delivery idempotency authority ((callerPrincipalId, requestId) key, crash windows, outcome_unknown)
  - credential boundary (no env injection, operator-owned 0600 config seam, secret non-echo)
  - production composition wiring (verifier/config only)
references:
  - docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md
  - docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md
  - docs/investigations/identity-auth.md
  - docs/investigations/AGENT_PROCESS_INTERACTIVE_TURN_TIMEOUT_INVESTIGATION_V1.md
implementation_authority: contracts
supersedes: []
superseded_by: null
replaces_on_acceptance: informational
accepted_reviewed_base: 54ac27ff8a39fe6035b497dc3ae43958479df3db
accepted_reviewed_head: bbd4d450df58fe734ad4b14db825d0e476600d3f
acceptance_review: "NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1_SPEC_REVIEW（通知 审计）"
acceptance_review_result: PASS
required_fixes: NONE
accepted_by: mayf3
accepted_at: 2026-08-22
---

# NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1 — Notification Ingress 服务认证与持久幂等

> 状态：**accepted**（2026-08-22 acceptance finalize；首次新建 child Spec，authoring 轮 SPEC ONLY）。
> Parent authority：`AGENT_CORE_HARDENING_PROGRAM_V1`（accepted）§2.3 / §3.1 / §4.2 / §5。
> 本轮：**只写 Spec**。不修改产品代码；不创建 idempotency store；不创建真实 service credential；
> 不修改 auth-service production；不修改 production config；不 accepted；不 merge。
> 本 Spec 不修改 Program 的 stable meaning；所有 Program ruling 原样继承。

---

## 0. Authoring Result

```text
SPEC_ID = NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
SPEC_STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts（仅在合法 acceptance + §8 依赖门全部满足后激活）
NEW_SPEC_REQUIRED = YES（main@54ac27f 无任何 notification ingress implementation spec）
REPLACEMENT_REQUIRED = NO（首次新建；无被替换对象）
SUPERSEDES = []
SUPERSEDED_BY = null
PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1（accepted）
PARENT_STABLE_MEANING_MODIFIED = NO
OWNER_DECISION_REQUIRED = NO（inbound verification seam 由既有 authority 唯一确定，候选与裁决见 §4.2）
IMPLEMENTATION_ALLOWED_NOW = NO（§8 依赖门未满足）
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

`AUTH_PROTOCOL_FROZEN = YES`（§4）；`IDEMPOTENCY_STORE_FROZEN = YES`（§5）；
`FAULT_MATRIX_COMPLETE = YES`（§11）；双向 Acceptance coverage 见 §10.3。

---

## 1. Goal

让 `POST /v1/deliver` 从「loopback 上的匿名非幂等 HTTP adapter」升级为：

```text
可信业务服务（svc-forum / svc-workflow）
→ 各自独立 service credential（auth-service 签发的 OAuth2 client）
→ Ingress 在线验证 credential（auth-service token endpoint）
→ credential 映射 caller principal（verified clientId）
→ allowlist {svc-forum, svc-workflow}
→ durable idempotency gate（(callerPrincipalId, requestId)，reserve-before-Router）
→ Router internal deliver primitive（业务无知，零语义变更）
```

修复 Program §2.5 冻结的：

```text
NOTIFICATION_INGRESS_ANONYMOUS_AND_NON_IDEMPOTENT = MUST_FIX
```

在其 implementation accepted 之前（Program §4.2）：

```text
FORUM_NOTIFICATION_CUTOVER = BLOCKED
WORKFLOW_NOTIFICATION_CUTOVER = BLOCKED
```

---

## 2. Frozen Owner Boundaries（Program §2.3 / §2.4 原样继承）

```text
ALLOWED_CALLERS = [svc-forum, svc-workflow]
ANONYMOUS_CALLER = REJECT
AGENT_CALLER = REJECT
CALLER_ID_FROM_BODY = UNTRUSTED
FORUM_AND_WORKFLOW_CREDENTIALS = DISTINCT
RAW_CREDENTIAL_TO_AGENT = FORBIDDEN
LOCALHOST_IS_AUTHENTICATION = NO
FIXED_PROGRAM_PATH_IS_AUTHENTICATION = NO
```

补充继承（Program §2.1 / §2.2）：

```text
AGENT_CAN_READ_NOTIFICATION_CALLER_CREDENTIALS = NO
AGENT_CAN_SELF_ASSERT_SERVICE_IDENTITY = NO
NOTIFICATION_INGRESS_IS_AGENT_DELEGATION_API = NO
```

Router internal deliver primitive 保持业务无知：**不增加任何 Forum / Workflow 特例**
（`ROUTER_SEMANTIC_CHANGE = NONE`，§9.4）。service authentication 与 idempotency 的
owner 是 ingress/auth boundary，不是 Router（Program §3.1 / §7「Agent Router Delivery V0」
disposition 原文：内部 admission primitive 保留；service authentication / idempotency
由 ingress boundary 拥有）。

---

## 3. Current Facts（evidence pinned @ `54ac27f`，OBS 编号见 §12）

### 3.1 Ingress V0 现状

`packages/notification-ingress/src/index.js` 是 `agentRouter.deliver` 之上的 thin HTTP
adapter：`POST /v1/deliver { requestId, agentId, sessionMode, message }`，
默认 `127.0.0.1:8790`，`requestTimeout = 0`。它没有 caller identity、没有 allowlist、
没有 service credential 验证（文件头自述 "127.0.0.1 only, no auth/TLS in V0"）。
仅依赖 loopback bind——loopback 不是 authentication（Program §2.4 ruling 同源）。

### 3.2 Router deliver 现状（零变更对象）

`packages/agent-router/src/index.js` `deliver()` 校验四字段（拒绝 stray `sessionId`）→
`resolveAgentRef` → session 解析（`main` 固定 / `fresh` 由 store 原子 read-or-mint）→
`ensureRunning` → `proc.deliver` → 返回 `{ accepted:true, sessionId }`。accepted 只代表
「消息进入正确 DSH Session 的 inbox」，从不等待 model turn。

失败分类现状（实现必须保守映射，见 C-IDM-008）：

```text
Router 内确定性 pre-admission 拒绝（ admission 未发生，可证明）:
  VALIDATION_ERROR   （四字段/枚举校验，Router deliver 顶部）
  AGENT_NOT_FOUND    （resolveAgentRef，早于 ensureRunning / proc.deliver）

其余一切错误（ensureRunning 失败、deliver receipt 超时、进程/管道故障……）:
  admission 是否发生不可证明 → outcome_unknown 类
```

### 3.3 现有幂等相关状态

- Router 内存 `deliveries` 数组（`agent-router/src/index.js:234`）：仅进程内 evidence，
  重启即失，**不是 durable state**。
- BindingStore `freshSessions`（`packages/agent-router/src/binding-store.js`）：
  `(agentId, requestId) → sessionId` 的 durable 映射，语义是「相同 requestId 重试指向同一
  fresh Session」——**是 session identity 复用，不是 delivery idempotency**：

```text
BindingStore_freshSessions.IS_NOT_DELIVERY_IDEMPOTENCY = YES
```

  它不记录 delivery 是否发生、不记录 outcome、key 不含 caller、无 payload conflict 语义。
  本 Spec 的 idempotency authority 与它并存且互不读取（C-IDM-016）。
- production compose 用 `writeEvidence` 把每次 deliver 写入
  `<root>/control/runtime-evidence.jsonl`（`packages/production-runtime/src/compose.js`）：
  JSONL evidence，**不是 authority store**。

### 3.4 auth-service / machine credential authority 现状

仓库既有 credential authority 链（本 Spec 必须复用、不得另起炉灶）：

- **auth-service**（外部 HTTPS origin）：OAuth2 client credentials 权威。token endpoint
  `POST /oauth/token`（Basic(clientId:clientSecret) + `grant_type=client_credentials` +
  `resource` + `scope`）；management API `/api/v1/principals`、`/api/v1/clients`
  （management token 保护）。
- **既有验证 primitive**：`packages/agent-credential-provisioning/src/auth-client.js`
  `verifyCredential({ credential, resource, scope })` —— 用上述 token endpoint 做一次
  client_credentials mint：`200` = 凭据有效；非 200 返回
  `{ status, oauthError? }`（`KNOWN_OAUTH_ERRORS` =
  `invalid_client | invalid_scope | invalid_grant | invalid_resource | invalid_target |
  temporarily_unavailable`）；transport 失败 = `AUTH_TRANSPORT_FAILURE`；响应体永不回显。
- **principal / client 模型**：`agentcore:v1:principal:<id>` / `agentcore:v1:client:<id>`
  external ref（`packages/agent-credential-provisioning/src/index.js`）。
- **Broker credential seam**（`packages/broker/src/credential.js`）：出站方向——transport
  只认 `getCredential()` 结果，**从不读请求输入里的自报身份**（"caller self-reported
  identity cannot override the credential" 测试在案）。本 Spec 把同一纪律应用到入站。
- **trusted-store 纪律**：`packages/agent-credential-provisioning/src/store-writer.js`
  冻结 `0o700` 目录 / `0o600` 文件 / trustedOwner（owner 必须非 root、非 root writer
  不得指定他人）。

### 3.5 进程环境继承现状

`packages/agent-router/src/process.js` `agentEnv()` 以 `...process.env` 展开（仅剔除
recognized proxy keys 与显式 `omitEnv`）——**Agent child 继承 control plane 的全部全局
env**。因此任何经全局 env 注入的 ingress credential 都会进入 Agent child 环境
（`RAW_CREDENTIAL_TO_AGENT = FORBIDDEN` 违例）。同时 production 以
`DSH_AGENT_CHILD_UID/GID + DSH_AGENT_SPAWN_HELPER` 把 child 落到与 CP（authsvc/505）
不同的固定 uid——CP 属主 `0600/0700` 文件对 child 不可读，这是
`AGENT_CAN_READ_NOTIFICATION_CALLER_CREDENTIALS = NO` 的既有执行路径。

---

## 4. Authentication Contract（AUTH_PROTOCOL_FROZEN = YES）

### 4.1 冻结的认证链

```text
service credential（HTTP Authorization: Basic base64(clientId:clientSecret)）
→ credential verification（auth-service /oauth/token client_credentials 在线 mint，
   带本 surface 专属 audience resource）
→ machine/service principal（verified clientId 即 caller principal 标识）
→ caller identity（clientId 经 operator allowlist 配置映射为 svc-forum / svc-workflow；
   body 中任何 callerId 字段一律 UNTRUSTED、整体忽略）
→ allowlist（仅 [svc-forum, svc-workflow]；已认证但不在 allowlist = 403，
   含 Agent child 的 per-agent client 凭据）
→ idempotency gate（§5；key 的第一维就是 callerPrincipalId）
→ Router internal deliver（业务无知）
```

### 4.2 Inbound verification seam 裁决（OWNER_DECISION_REQUIRED = NO）

任务边界要求：复用仓库已有 auth-service / machine credential authority，不得自行发明
新的本地共享 secret 协议；若既有 authority 无法唯一确定 inbound verification seam 必须
输出 OWNER_DECISION。逐候选裁决如下（不模糊带过）：

| 候选 | 机制 | 裁决 | 理由 |
|---|---|---|---|
| **A（采纳）** | 在线验证：ingress 将 caller 呈现的 Basic credential 送 auth-service token endpoint 做 client_credentials mint（协议与既有 `verifyCredential` primitive 完全一致，含 `resource` audience），`200` 即有效，identity 取 verified clientId | **SELECTED** | auth-service 是既有唯一 credential 权威（Program §2.3「credential 映射 caller principal」）；token-endpoint mint 是仓库既有的、唯一真实存在的 credential 验证 seam（`auth-client.js`）；credential 只存于 caller 与 auth-service，ingress 不存任何 secret；rotation = auth-service 侧换 secret，clientId 不变，天然满足可独立轮换/吊销 |
| B（拒绝） | 本地比对：ingress 持有 svc-forum/svc-workflow secret 副本，timing-safe 比对 | **REJECTED** | 这就是「自行发明的本地共享 secret 协议」——secret 复制进第二个 authority，rotation 需同步改 ingress，blast radius 扩大；与任务边界和 Program §2.3 直接冲突 |
| C（拒绝） | 两跳 bearer：caller 先自行 mint access token 再呈 Bearer，ingress 做 token 校验/introspection | **REJECTED** | 仓库没有 token introspection/签名校验 primitive（`verifyCredential` 是 mint 不是 introspect）；把 OAuth client 流程推给每个 caller 无既有 authority 支撑；收益（省一次 ingress→auth-service 往返）不改变信任模型 |

结论：既有 authority（auth-service + token-endpoint 验证 primitive + Program §2.3 身份链）
**唯一确定** inbound verification seam = 候选 A。

```text
OWNER_DECISION_REQUIRED = NO
SELECTED_SEAM = AUTH_SERVICE_ONLINE_CLIENT_CREDENTIALS_MINT
LOCAL_SHARED_SECRET_PROTOCOL = FORBIDDEN（候选 B）
SELF_MINTED_BEARER_PROTOCOL = FORBIDDEN（候选 C）
```

**部署前置（operations，不属于 repo Owner 决策，但 cutover 前必须完成）**：
auth-service 侧为本 ingress 注册 audience resource（建议
`urn:agent-core:notification-ingress:v1`，实际值由 operator 在 auth config 中冻结），
并分别为 svc-forum / svc-workflow 签发独立 OAuth2 client（credential 只发放给对应服务，
不进入本仓库、不进入 agent-core 任何文件）。这些是 `FORUM/WFLOW_NOTIFICATION_CUTOVER`
解除阻塞时点的 operator checklist 项。

### 4.3 冻结规则

- **C-AUTH-001（凭据呈现）**：`POST /v1/deliver` 必须携带
  `Authorization: Basic base64(clientId:clientSecret)`。缺失 / 非 Basic / base64 / UTF-8 /
  结构损坏 → `401 INVALID_CREDENTIAL`，响应不含任何 header 原文或 secret 片段。
- **C-AUTH-002（验证权威与协议）**：ingress 在 `packages/notification-ingress/src/auth.js`
  实现 token-endpoint 在线验证（协议 = §3.4 primitive：HTTPS origin、Basic、
  `grant_type=client_credentials`、`resource` = auth config audience、固定最小 `scope`）。
  只允许该 endpoint；**禁止**调用 management API（`/api/v1/principals|clients`）——
  service credential provisioning 是 auth-service operator 的工作，不是 ingress 的
  （C-AUTH-014）。实现必须允许注入 `fetchImpl`（与既有 primitive 同构）供测试与
  acceptance driver stub token endpoint。
- **C-AUTH-003（caller identity）**：`callerPrincipalId` = **verified clientId**（从已验证
  credential 得出）。body 中任何自称 caller/service 身份的字段一律 UNTRUSTED、整体忽略、
  不进日志语义字段——credential identity 永远不能被 request body 覆盖。
- **C-AUTH-004（allowlist）**：operator auth config 冻结
  `{ svc-forum: <clientId>, svc-workflow: <clientId> }`。已验证但 clientId 不在 allowlist
  → `403 CALLER_NOT_ALLOWED`（Agent child 的 per-agent client 凭据走此路径被拒，即使其
  audience 碰巧匹配）。
- **C-AUTH-005（audience）**：验证 mint 携带本 surface 专属 audience resource；
  `invalid_target` / `invalid_resource` → `401 INVALID_CREDENTIAL`（凭据对有效但不属于
  本 surface = 对本 surface 无效）。
- **C-AUTH-006（凭据独立）**：svc-forum 与 svc-workflow 必须映射**不同** clientId；
  auth config 校验发现重复 clientId → 配置非法（fail-loud，拒绝挂载该配置）。
  各自 secret 可独立轮换、独立吊销，互不影响。
- **C-AUTH-007（anonymous reject）**：无凭据请求 → `401`。没有任何回退身份源。
- **C-AUTH-008（非身份源）**：loopback 来源、固定程序名、固定 executable 路径
  **都不是 authentication**；它们最多影响 bind 面，永远不参与 caller identity。
- **C-AUTH-009（inconclusive ≠ invalid）**：auth-service transport 失败 / HTTP 5xx /
  `temporarily_unavailable` / 响应畸形 → `503 AUTH_INCONCLUSIVE` fail-loud，**不得**
  误报 401，更不得放行（与既有 `classifyVerificationResult` 的 `inconclusive` 分类同构）。
- **C-AUTH-010（rotation）**：rotation = auth-service 侧更换该 client 的 secret；
  clientId 与 audience 不变 → `callerPrincipalId` 不变 → idempotency key 连续性保持
  （rotation 前后同一次业务重试仍命中同一 record）。ingress 无需重启：下一次请求
  即用新 secret 验证。
- **C-AUTH-011（revoke）**：吊销 / 禁用 client（或其 principal）→ mint 失败
  （`invalid_client` 类）→ `401 INVALID_CREDENTIAL`；已存在的 durable outcome 不受影响。
- **C-AUTH-012（secret 不回显）**：raw credential（Authorization header 值、Basic 明文、
  clientSecret）不得出现在：日志、`error.message`、HTTP 响应、evidence JSONL、
  idempotency store、Agent workspace、Agent child env。统一 redaction helper + 强制测试
  （§10 AC-BND-01）。
- **C-AUTH-013（逐请求验证）**：每个请求都完整验证；**不缓存** credential 或验证结论
  （V1 简化：notification 量级下每请求一次 HTTPS 往返可接受；缓存属未来 amendment
  空间，不是本 Spec 授权项）。
- **C-AUTH-014（management API 禁用）**：ingress 永不调用 principal/client management
  API，永不创建/修改 auth-service 实体。

### 4.4 Auth 配置载体（operator-owned 0600 seam）

```text
文件 = <production-root>/notification-ingress/auth.json
       （compose: opts.notificationIngress.authConfigFile
         ?? process.env.NOTIFICATION_INGRESS_AUTH_CONFIG ?? layout 默认路径）
内容 = { authServiceOrigin   (HTTPS origin，必填)
         audience            (string，必填，如 urn:agent-core:notification-ingress:v1)
         allowlist           ({ svc-forum|svc-workflow : clientId }，必填，两者齐全且互异)
         routerDeadlineMs?   (C-IDM-011 默认外的覆盖)
         retentionMs? / maxRecords? (C-IDM-013 默认外的覆盖) }
权限 = 文件 0600、目录 0700、trustedOwner 校验（非 root、owner=CP 运行账户），
       复用 store-writer.js 冻结的纪律（§3.4）
内容约束 = 不含任何 clientSecret（clientId 是公开标识符；caller 的 secret 只存在于
       caller 与 auth-service）
完整性语义 = allowlist 是身份边界，防篡改即防越权：文件必须只有 CP 账户可写，
       Agent child（不同 uid）不可读写
缺配置 = 合法的未就绪态：ingress 可挂载，但每个 /v1/deliver 一律
       503 AUTH_NOT_CONFIGURED（fail closed per call，never at boot，镜像 Broker
       credentials-file 纪律）；绝不退化为匿名接受
配置非法（结构错/重复 clientId/非 HTTPS origin）= 同 503 AUTH_NOT_CONFIGURED，
       日志说明原因（不含敏感内容）
```

---

## 5. Durable Idempotency Contract（IDEMPOTENCY_STORE_FROZEN = YES）

### 5.1 Authority key 与 payload

```text
IDEMPOTENCY_AUTHORITY_KEY = (callerPrincipalId, requestId)
requestId 必填（V0 既有校验保留：非空字符串）
```

- **C-IDM-002（canonicalization + payloadHash）**：

```text
canonical payload = JSON.stringify({
  agentId, message, requestId, sessionMode     // 固定插入序，UTF-8，无空白
})
payloadHash = sha256(canonical payload) 的 lowercase hex
```

  恰好覆盖四个 wire 契约字段；thin-adapter 本来就忽略的未知字段不参与 hash
  （只有四字段不同才叫 different payload）。delivery 排除在 hash 外
  （delivery 不是 caller 输入）。

### 5.2 Authority store

- **C-IDM-003（store 形态）**：单一 versioned JSON 文档：

```text
路径 = <production-root>/notification-ingress/idempotency.json
形状 = { "version": 1,
         "records": { "<clientId>": { "<requestId>: {
           callerPrincipalId, requestId, payloadHash,
           state: "reserved" | "delivered" | "failed_no_admission" | "outcome_unknown",
           createdAt, updatedAt,
           sessionId?            (delivered)
           failure?{code,httpStatus} (failed_no_admission)
           history?[ {at,from,to,reason} ]  (≤16 条，最旧先淘汰) } } } }
纪律 = 内部 mutation queue 串行化 + 跨进程 advisory lockfile
       （<同目录>/idempotency.lock，取锁后 re-read-latest）+ tmp+rename 原子替换
       + 文件 fsync（首次创建补目录 fsync）——镜像 BindingStore / Scheduler V2 store
       已冻结的持久化纪律
缺失文件 = 合法空库（fresh deployment）
损坏 / version 不识别 / 不可解析 = fail-loud：挂载即抛错，服务不得启动
       （绝不清空重建、绝不带病接受投递）
单进程权威 = 一个 production runtime 恰好挂载一个 notification-ingress 实例
       （compose 结构保证）；lockfile 是防御性串行化，不是多实例授权
```

- **C-IDM-016（与 BindingStore 的边界）**：Router `freshSessions` 的
  `(agentId, requestId)→sessionId` 映射保持原样、**不是** delivery idempotency
  （§3.3）。ingress 永不读取 bindings store；两者按各自语义并存：
  freshSessions 保证「同 requestId 的 fresh 投递命中同一 Session」这一 Router 内部
  session-identity 性质，本 store 保证「同 (caller, requestId) 的业务投递恰好发生一次
  且 outcome durable」。key 维度不同（本 store 含 callerPrincipalId）、记录对象不同
  （delivery outcome 而非 session id）、冲突语义不同（payloadHash 409 而无）。

### 5.3 状态机与投递路径

```text
请求 → 认证（§4）→ body 校验（400，pre-gate，不留状态）
     → idempotency gate（原子，在 mutation queue 内完成判定+预留）
     → [新 key]  durable write state=reserved（reserve-before-Router）
     → router.deliver(...)
         ├─ resolved {accepted,sessionId} → durable write state=delivered(+sessionId)
         │    → 200 {accepted:true, sessionId, outcome:"delivered"}
         ├─ throw VALIDATION_ERROR|AGENT_NOT_FOUND（确定性 pre-admission）
         │    → durable write state=failed_no_admission(+failure)
         │    → 400 / 404（error envelope）
         └─ 其余任何错误 / C-IDM-011 deadline 到期（admission 不可证明）
              → durable write state=outcome_unknown
              → 200 {accepted:false, outcome:"outcome_unknown"}
```

- **C-IDM-004（reserve-before-Router）**：`router.deliver` 被调用之前，
  `state=reserved` 的 durable write 必须已提交。禁止先投递后补记录。
- **C-IDM-005（same key + same payload）**：terminal record 存在且 payloadHash 相同 →
  **不再次调用 Router**，复用原 durable outcome 应答：
  delivered → `200 {accepted:true, sessionId(原值), outcome:"delivered", duplicate:true}`；
  failed_no_admission → 原 4xx error envelope；
  outcome_unknown → `200 {accepted:false, outcome:"outcome_unknown", duplicate:true}`。
- **C-IDM-006（same key + different payload）**：payloadHash 不同 → `409 CONFLICT`
  （无论原 record 处于何种 state；不投递、不改写原 record）。
- **C-IDM-007（state 集与 single-flight）**：非 terminal state 只有 `reserved`；
  terminal = `delivered | failed_no_admission | outcome_unknown`。进程内 per-key
  single-flight：并发的同 key 同 payload 请求等待在飞 attempt 的结果并复用其
  terminal outcome，**不得**在在飞期间自行判 outcome_unknown。
- **C-IDM-008（失败分类）**：只有 Router 的 `VALIDATION_ERROR` 与 `AGENT_NOT_FOUND`
  是 `PROVEN_NO_ADMISSION`（§3.2 的 Router 顺序证据：二者都早于 ensureRunning /
  proc.deliver 抛出）；其余一切错误（含超时、进程故障、未知 code）一律
  outcome_unknown。实现不得扩大 PROVEN 集合；Router 侧若未来调整错误语义，
  该映射必须随独立 review 更新（本 Spec 冻结的是「保守 + 可证明」原则）。
- **C-IDM-009（crash 窗口矩阵）**：

| 窗口 | 时点 | durable 状态 | 后果 |
|---|---|---|---|
| W1 | reserve 提交前崩溃 | 无 record | 干净重试：下一个同 key 请求按新投递走（无双重投递风险） |
| W2 | reserve 提交后、Router 调用前崩溃 | `reserved`（非 terminal） | 重启 sweep（C-IDM-010a）→ `outcome_unknown` |
| W3 | Router 调用进行中崩溃（admission 未知） | `reserved`（非 terminal） | 同 W2 |
| W4 | Router 已 accepted、terminal 写入前崩溃 | `reserved`（非 terminal） | 同 W2：admission 可能已发生但不可证明 → `outcome_unknown`，不自动补投 |

  W2–W4 不可区分是**特性**而非缺陷：单一 durable 事实「非 terminal record + 本进程
  已重启」→ 投递 outcome 不可证明 → 统一 `outcome_unknown`。禁止任何「重启后继续/
  补投 reserved 记录」的自动恢复（那正是双重投递的来源）。
- **C-IDM-010（outcome_unknown 语义）**：
  - 10a 重启 sweep：boot 时把**所有**非 terminal record 原子迁移为
    `outcome_unknown`（reason=`restart_unresolved`）——单进程权威下，重启即宣告
    前一进程的在飞 attempt 全部死亡，非 terminal 即不可证明。
  - 10b `outcome_unknown 不自动重新投递`：对该 key 的后续请求一律复用该
    durable outcome（C-IDM-005），永不触发第二次 Router 调用。
  - 10c 补救 = caller 的业务决策：用**新 requestId** 重新投递（新 key = 新投递）。
    「旧 request 是否真的送达」由 operator 结合 evidence（§5.5）人工判定。
  - 10d `NO_LATE_REWRITE = YES`：deadline 判 unknown 后 Router promise 若迟到
    resolve/reject，只追加 evidence 事件 `late_settled`，**不改写** durable outcome
    （查询语义稳定，避免已应答 caller 的结果翻转；如未来需要 outcome 升级，
    走独立 amendment）。
- **C-IDM-011（Router 等待 deadline）**：ingress 对 `router.deliver` 的等待有上界
  （默认 `300000ms`，auth config 可覆盖；量级依据：initialize 90s + deliver receipt
  30s 为主的 admission 路径 + 余量）。到期 → 该 attempt 判
  `outcome_unknown`（durable + 应答），在飞 Router promise 按 10d 处理。
  server `requestTimeout=0` 保留（handler 自身有界，连接不悬挂）。
- **C-IDM-012（重启持久性）**：所有幂等判定只依赖 durable store；进程重启
  （含 kill -9）后同 key 判定与重启前一致（AC-IDM-03 用真实重启证明）。
- **C-IDM-013（retention / bounded growth）**：

```text
RETENTION_MS 默认 = 604800000（7 天）
MAX_RECORDS 默认 = 100000
sweep 时机 = boot + 周期（每小时）
sweep 对象 = 仅 terminal record；非 terminal 先经 10a 再谈清理
淘汰序 = 先按 terminal 时间超龄，再按最旧 terminal 超量
后果（明示）= 保留窗口是重复保护的地平线：晚于窗口的同 key 请求按新投递处理。
     调大窗口 = 更长保护 + 更大 store，由 operator 权衡；caller 侧本就有
     requestId 新鲜度约束
```

- **C-IDM-014（store 损坏 fail-loud）**：解析失败 / `version` 不识别 / 结构非法 →
  挂载抛错、服务不启动（与 C-IDM-003 同一条纪律的故障侧）。绝不清空、绝不降级为
  内存模式、绝不在 authority 不可用时继续接受投递。
- **C-IDM-015（audit evidence）**：

```text
路径 = <production-root>/notification-ingress/evidence.jsonl（append-only）
事件 ≥ { auth_ok / auth_reject(code,clientId?)（不含 secret）
         idempotency_transition(from,to,reason)
         outcome(delivered|failed_no_admission|outcome_unknown)
         late_settled / sweep_pruned(count) / boot_unresolved_sweep(count) }
轮转 = 单文件 10 MiB 时 rotate，保留最近 2 代
性质 = evidence，NOT authority：任何判定不得读取它；它不参与重启恢复
红线 = 永不写入 credential 材料（C-AUTH-12）
```

---

## 6. Credential Boundary（进程/文件/环境隔离）

- **C-BND-001（env 禁令）**：ingress 的 credential 与 auth 配置**永不**通过全局
  `process.env` 注入。`NOTIFICATION_INGRESS_*` env 仅允许既有非 secret 开关
  （`ENABLED/HOST/PORT`）与路径指针（`AUTH_CONFIG`）；任何承载 secret 的
  ingress env 名都是契约违例（测试断言源码不读、compose 不设此类 env）。
- **C-BND-002（0600 config seam）**：§4.4——operator-owned `0600` 文件 +
  `0700` 目录 + trustedOwner（非 root）+ 不含 secret + 防 Agent 篡改（allowlist
  完整性 = 身份边界完整性）。
- **C-BND-003（composition 只交 verifier/config）**：`packages/production-runtime/
  src/compose.js` 只把 auth config 路径 / store 路径 / 布局交给 ingress 插件；
  不向任何其他组件分发 ingress credential；不新增任何 raw credential 流经
  compose。
- **C-BND-004（Agent child 隔离）**：
  - 结构性：本设计下 agent-core 不持有任何 caller secret，Agent child 无 secret 可窃；
    config（含 allowlist）与 idempotency store 落在 CP 账户 `0700/0600`，child 运行于
    不同 uid（`DSH_AGENT_CHILD_UID`），读不到、改不了。
  - `agentEnv()` **无需修改**（C-BND-001 已保证没有 ingress secret env 可被
    `...process.env` 继承）；AgentProcess 零变更是本 Spec 的显式边界，不是遗漏。
  - Agent child 直接调用 `/v1/deliver`：匿名 → 401；持 per-agent client 凭据 →
    403（C-AUTH-004，AC-AUTH-10）。
- **C-BND-005（redaction）**：`error.message`、日志行、HTTP 响应体在离开 ingress 前
  过 redaction helper：Authorization header 值 / Basic 明文 / clientSecret 模式一律
  不出现；测试用已知 secret 全链路 grep 断言（AC-BND-01）。

---

## 7. HTTP Wire Contract

- **C-WIRE-001（endpoints）**：`GET /health`（无需认证；只暴露
  `{ok, service, deliverReady, authConfigured, storeReady}` 级别的布尔/名称，不暴露
  origin/allowlist 内容）；`POST /v1/deliver`（认证必需）。其余 404/405 维持 V0。
- **C-WIRE-002（status map）**：

```text
401 = 未认证或无效 credential（缺失/畸形/验证失败/audience 不符/已吊销）
403 = 已认证但 caller 不在 allowlist
400 = VALIDATION_ERROR（body 四字段 / sessionMode 枚举）
404 = AGENT_NOT_FOUND（failed_no_admission 复用应答）
409 = idempotency same-key different-payload conflict
500 = INTERNAL_ERROR
503 = AUTH_INCONCLUSIVE（auth-service 不可判）
     | AUTH_NOT_CONFIGURED（缺/非法 auth config）
     | SERVICE_UNAVAILABLE（router.deliver 缺失，V0 既有）
200 = delivered（含 duplicate）与 outcome_unknown 应答
```

- **C-WIRE-003（response envelope）**：成功/unknown 走
  `{accepted, sessionId?, outcome, duplicate?}`；错误维持 V0 既有
  `{error:{code,message}}`。`accepted:true` 的含义与 Router 契约一致（inbox admission，
  非 turn 完成）。
- **C-WIRE-004（body 限制）**：1 MiB body 上限与「只读四字段、未知字段忽略」的
  thin-adapter 语义原样保留。

---

## 8. Dependency Clarification

```text
TECHNICAL_AGENTPROCESS_DEPENDENCY = NO
```

- 本 Spec 的实现不 import、不调用、不等待 AgentProcess 的新 seam；它消费的
  `agentRouter.deliver` 已在 main（AGENT_ROUTER_DELIVERY_V0）。AgentProcess /
  Binding store / kernel / v2-ingress-gate 均零变更。

```text
PROGRAM_IMPLEMENTATION_ORDER_PRECONDITION =
  AgentProcess implementation PASS（Program §5 第 1 步）BEFORE Notification implementation
```

- **Spec authoring 与独立 review 现在允许**（本 PR 即是）；**产品代码不得开工**，
  不得绕过 Hardening Program 的 1→2→3 实施顺序（Program §5）。
- Notification implementation 的启动条件（全部满足才允许）：
  1. 本 Spec 独立 review + accepted + 已进 implementation base branch；
  2. `AGENT_PROCESS_LIFECYCLE_HARDENING_V1` 的 implementation PASS。
- 当前事实（pinned @54ac27f）：AgentProcess child Spec 已 accepted 但
  implementation 尚未 PASS（其实现 PR 未合并）→ `IMPLEMENTATION_ALLOWED_NOW = NO`。

```text
SCHEDULER_DEPENDENCY =
  Scheduler implementation 必须等待 Notification implementation PASS（Program §5
  第 3 步排第 2 步之后；SCHEDULER_TIMEOUT_OUTCOME_V2 的 precondition #4 同源）
```

---

## 9. Expected Implementation Surface

### 9.1 实现面（预计）

```text
packages/notification-ingress/src/index.js        （wire + gate 编排 + health）
packages/notification-ingress/src/auth.js         （验证 client + allowlist + redaction）
packages/notification-ingress/src/idempotency.js  （authority store + 状态机 + sweep）
packages/production-runtime/src/compose.js        （auth config / store 路径接线）
```

### 9.2 测试面（预计）

```text
packages/notification-ingress/test/api.test.js            （wire/status/envelope/body）
packages/notification-ingress/test/auth.test.js           （验证链/401/403/audience/rotation）
packages/notification-ingress/test/idempotency.test.js    （状态机/crash 窗口/retention/损坏）
packages/notification-ingress/test/integration.seam.test.js（认证→gate→router 全链 + secret 非回显）
packages/production-runtime/test/compose.test.js          （composition 只交 config/store 路径）
scripts/notification-ingress-service-auth-v1-verify.mjs   （fault-matrix acceptance driver：
  临时 root + 注入 fetchImpl 的 stub auth-service + recorder 型 agentRouter stub，
  逐条执行 §11 fault matrix 并输出 PASS/FAIL 清单）
```

测试通过注入 `fetchImpl` / stub `agentRouter` 完成（与既有 primitive 同构）；真实
auth-service 与真实 Router 栈的端到端验证属于 implementation PASS 的验收时点，不在
本 Spec 轮。

### 9.3 禁改面

```text
packages/agent-router/**           = NO CHANGE
packages/agent-credential-provisioning/** = NO CHANGE（auth.js 复用其协议，不改动它）
packages/broker/**                 = NO CHANGE
AgentProcess / BindingStore / kernel / v2-ingress-gate = NO CHANGE
auth-service（外部仓库）production = NO CHANGE
```

### 9.4 Router 预期

```text
ROUTER_SEMANTIC_CHANGE = NONE
```

Router 不知道 caller、不知道 Forum/Workflow、不增特例。compose 既有的
`router.deliver` evidence wrapper 维持现状（evidence 而已）。

---

## 10. Contracts 与 Acceptance

### 10.1 Contract 清单（权威编号）

```text
C-AUTH-001 凭据呈现（Basic；缺失/畸形 401）
C-AUTH-002 验证权威（auth-service 在线 mint；management API 禁用 → C-AUTH-014）
C-AUTH-003 caller identity = verified clientId；body 身份 UNTRUSTED
C-AUTH-004 allowlist [svc-forum, svc-workflow]；越权 caller 403
C-AUTH-005 audience 专属 resource；wrong audience 401
C-AUTH-006 forum/workflow 凭据 DISTINCT（clientId 互异，配置校验）
C-AUTH-007 anonymous reject 401
C-AUTH-008 localhost / 固定路径 ≠ authentication
C-AUTH-009 inconclusive → 503 fail-loud（不误报 401）
C-AUTH-010 rotation（clientId 稳定 → key 连续性）
C-AUTH-011 revoke → 401，durable outcome 不受影响
C-AUTH-012 secret 不回显（log/response/store/evidence/env/workspace）
C-AUTH-013 逐请求验证、不缓存
C-AUTH-014 management API 禁用
C-IDM-001  authority key = (callerPrincipalId, requestId)；requestId 必填
C-IDM-002  canonicalization + payloadHash
C-IDM-003  authority store 形态与持久化纪律（损坏 fail-loud）
C-IDM-004  reserve-before-Router
C-IDM-005  same key + same payload → 复用 durable outcome，不二次投递
C-IDM-006  same key + different payload → 409
C-IDM-007  状态机 + per-key single-flight
C-IDM-008  PROVEN_NO_ADMISSION = {VALIDATION_ERROR, AGENT_NOT_FOUND}，保守分类
C-IDM-009  crash 窗口矩阵 W1–W4
C-IDM-010  outcome_unknown（restart sweep / 不自动重投 / 新 requestId 补救 / NO_LATE_REWRITE）
C-IDM-011  Router 等待 deadline（默认 300000ms）→ unknown
C-IDM-012  重启持久性
C-IDM-013  retention / bounded growth（默认 7d / 100k）
C-IDM-014  store 损坏 fail-loud（挂载即抛）
C-IDM-015  audit evidence JSONL（非 authority；无 secret；轮转）
C-IDM-016  BindingStore freshSessions IS_NOT_DELIVERY_IDEMPOTENCY = YES
C-BND-001  env 禁令（无 ingress secret env）
C-BND-002  0600/0700/trusted-owner config seam（无 secret 内容）
C-BND-003  composition 只交 verifier/config
C-BND-004  Agent child 隔离（零 AgentProcess 变更 + uid 边界 + 直接调用被拒）
C-BND-005  redaction（error.message/log/response）
C-WIRE-001 endpoints（/health 无认证、信息受限）
C-WIRE-002 status map（401/403/400/404/409/500/503/200-unknown）
C-WIRE-003 response envelope
C-WIRE-004 body 限制与 thin-adapter 字段语义
```

### 10.2 Acceptance items

```text
AC-AUTH-01 anonymous reject：无 Authorization → 401，无 state 写入            → C-AUTH-007/001
AC-AUTH-02 malformed credential：非 Basic/坏 base64/坏 UTF-8 → 401           → C-AUTH-001
AC-AUTH-03 revoked credential：stub 返回 invalid_client → 401；
           已有 durable record 不被触碰                                      → C-AUTH-011
AC-AUTH-04 wrong audience：invalid_target/invalid_resource → 401             → C-AUTH-005
AC-AUTH-05 authenticated non-allowlisted caller：有效 clientId ∉ allowlist
           → 403                                                             → C-AUTH-004
AC-AUTH-06 svc-forum success：合法凭据 → 200 delivered（Router 收到投递）    → C-AUTH-002/003
AC-AUTH-07 svc-workflow success：同上                                         → C-AUTH-002/004
AC-AUTH-08 distinct credential proof：两服务不同 clientId；配置重复 → 非法   → C-AUTH-006
AC-AUTH-09 body caller spoof ignored：body 携带任意 callerId/service 字段，
           身份仍 = verified clientId，行为不变                               → C-AUTH-003
AC-AUTH-10 Agent child direct call rejected：per-agent client 凭据/匿名 →
           403/401；child env 无 ingress credential                           → C-AUTH-004/C-BND-004
AC-AUTH-11 rotation：stub 换 secret 后新请求 200；同 key 幂等连续            → C-AUTH-010
AC-AUTH-12 inconclusive：stub 5xx/temporarily_unavailable/网络失败 → 503，
           不误报 401，无 state 写入                                          → C-AUTH-009
AC-IDM-01  duplicate same payload：二次请求零 Router 调用，复用原 outcome
           （delivered/failed/unknown 三分支）                               → C-IDM-005
AC-IDM-02  duplicate different payload → 409，原 record 不变                 → C-IDM-006
AC-IDM-03  restart persistence：delivered 后 kill -9 重启，同 key 复用       → C-IDM-012
AC-IDM-04  crash windows：W1（干净重试）/ W2 / W3 / W4（重启后 reserved →
           outcome_unknown，不补投）逐窗口注入证明                            → C-IDM-009/010
AC-IDM-05  outcome_unknown：deadline 到期 / Router 未知错误 → durable unknown；
           同 key 后续请求不触发第二次 Router 调用；late_settled 只进 evidence → C-IDM-010/011
AC-IDM-06  store corruption：写坏 idempotency.json → 挂载抛错、端口不服务   → C-IDM-014/003
AC-IDM-07  retention/bounded：超龄/超量 terminal record 被 sweep；非 terminal
           不被直接清理（先经 restart sweep）                                → C-IDM-013
AC-IDM-08  concurrent single-flight：并发同 key 同 payload 只产生一次
           Router 调用，全部应答同一 terminal outcome                        → C-IDM-007
AC-IDM-09  pre-admission classification：VALIDATION_ERROR/AGENT_NOT_FOUND →
           failed_no_admission 复用 400/404；其余错误 → unknown              → C-IDM-008
AC-BND-01  secret non-echo：已知 secret 全链路（log/响应/store/evidence/
           error.message）grep 不命中                                        → C-AUTH-012/C-BND-005
AC-BND-02  config seam：0600/0700/trustedOwner 校验；缺配置 → 每调用 503
           AUTH_NOT_CONFIGURED；非法配置拒绝                                 → C-BND-002/C-AUTH-014
AC-BND-03  compose 只交 config/store 路径；agentEnv 零变更；
           子进程 env 无 NOTIFICATION_INGRESS_* secret                       → C-BND-001/003/004
AC-CMP-01  Router receives only authenticated admitted delivery：Recorder 型
           agentRouter 断言每次 deliver 调用都有已验证 allowlisted caller +
           已 reserve 的 key                                                → C-AUTH-002/C-IDM-004/§2
AC-CMP-02  ROUTER_SEMANTIC_CHANGE = NONE：agent-router 包 diff 为空          → §9.4
AC-WIRE-01 status/envelope 全表驱动（含 200-unknown 与 409 形状）            → C-WIRE-002/003
```

### 10.3 双向 coverage

- 正向：上表每条 AC 显式标注所验 contract（无孤儿 AC）。
- 反向：每个 contract 至少被一条 AC 覆盖——
  C-AUTH-001→AC-AUTH-02；002→06/07/CMP-01；003→09；004→05/10；005→04；006→08；
  007→01；008→（由 04/05 的语义 + AC-WIRE-01 表驱动承载：任何用例都不以来源/路径
  作为身份）；009→12；010→11；011→03；012→BND-01；013→（06/07 每请求走 stub 计数
  断言）；014→BND-02；C-IDM-001→（01/02 的 key 维度构造：同 requestId 不同 caller
  互不冲突——AC-IDM-02 变体并入 02 表驱动）；002→01/02；003→06；004→CMP-01；
  005→01；006→02；007→08；008→09；009→04；010→04/05；011→05；012→03；013→07；
  014→06；015→（BND-01 的 evidence 分支 + AC-IDM-05 late_settled）；016→（AC-CMP-02
  的零 diff + §5.2 文本边界）；C-BND-001→03；002→02；003→03；004→10/03；005→01；
  C-WIRE-001..004→AC-WIRE-01（表驱动全枚举）。
  覆盖核对结论：`ACCEPTANCE_COVERAGE = BIDIRECTIONAL_COMPLETE`。

---

## 11. Fault Matrix（任务 §9 全项 + 归属）

| # | 故障/场景 | 期望 | AC |
|---|---|---|---|
| F-01 | anonymous reject | 401，无 state | AC-AUTH-01 |
| F-02 | malformed credential | 401 | AC-AUTH-02 |
| F-03 | revoked credential | 401，durable 不动 | AC-AUTH-03 |
| F-04 | wrong audience / caller | 401（audience）/ 403（allowlist） | AC-AUTH-04/05 |
| F-05 | authenticated non-allowlisted | 403 | AC-AUTH-05 |
| F-06 | svc-forum success | 200 delivered | AC-AUTH-06 |
| F-07 | svc-workflow success | 200 delivered | AC-AUTH-07 |
| F-08 | distinct credential proof | 互异 clientId；重复配置非法 | AC-AUTH-08 |
| F-09 | body caller spoof ignored | 身份不变 | AC-AUTH-09 |
| F-10 | Agent child direct call rejected | 401/403 | AC-AUTH-10 |
| F-11 | duplicate same payload | 复用 outcome，零二次投递 | AC-IDM-01 |
| F-12 | duplicate different payload | 409 | AC-IDM-02 |
| F-13 | restart persistence | 幂等判定跨重启成立 | AC-IDM-03 |
| F-14 | each crash window（W1–W4） | §5.3 矩阵 | AC-IDM-04 |
| F-15 | outcome_unknown | durable unknown，不自动重投 | AC-IDM-05 |
| F-16 | store corruption | 挂载 fail-loud | AC-IDM-06 |
| F-17 | credential rotation | 新 secret 生效，key 连续 | AC-AUTH-11 |
| F-18 | credential revoke（流程侧） | 同 F-03 语义 + 已存 record 不失效 | AC-AUTH-03 |
| F-19 | no secret in log/response/env | 全链路 grep 不命中 | AC-BND-01 |
| F-20 | Router receives only authenticated admitted delivery | recorder 断言 | AC-CMP-01 |

补充（非任务清单但由契约派生）：F-21 auth-service 不可判 → 503（AC-AUTH-12）；
F-22 retention 越界清理（AC-IDM-07）；F-23 并发 single-flight（AC-IDM-08）；
F-24 pre-admission 错误分类（AC-IDM-09）；F-25 缺 auth config → 每调用 503（AC-BND-02）。

---

## 12. Observations 与 Evidence

```text
OBS-001  V0 无认证：notification-ingress/src/index.js（@54ac27f，文件头 + handler）
OBS-002  Router 内存 deliveries 数组仅 evidence：agent-router/src/index.js:234
OBS-003  freshSessions = requestId→session 映射（session identity）：
         agent-router/src/binding-store.js（freshSessions 文档与 read-or-mint）
OBS-004  agentEnv 展开 process.env：agent-router/src/process.js:85-92
OBS-005  auth-service 验证 primitive（/oauth/token Basic+client_credentials+
         resource/scope、KNOWN_OAUTH_ERRORS、不回显、fetchImpl 注入）：
         agent-credential-provisioning/src/auth-client.js
OBS-006  Broker 出站身份纪律（不读自报身份）：broker/src/credential.js 文件头
OBS-007  compose 以 env 开关挂载 ingress、无认证配置：
         production-runtime/src/compose.js（NOTIFICATION_INGRESS_*）
OBS-008  compose 对 router.deliver 的 writeEvidence JSONL 非 authority：
         production-runtime/src/compose.js + paths.js（control/runtime-evidence.jsonl）
OBS-009  trusted-store 纪律（0700/0600/trustedOwner 非 root）：
         agent-credential-provisioning/src/store-writer.js
OBS-010  Program §2.3/§3.1/§4.2/§5/§7 rulings：AGENT_CORE_HARDENING_PROGRAM_V1（accepted）
OBS-011  production 布局与 .demo 拒绝：production-runtime/src/paths.js
OBS-012  依赖序事实（notification impl spec 在 main@54ac27f 缺失；1→2→3 顺序）：
         Program §5 + SCHEDULER_TIMEOUT_OUTCOME_V2 authoring 记录
```

Claims：本 Spec 的所有「现状」陈述均由 OBS-001..012 支撑（`SUPPORTED`）；
所有「目标」陈述均为本 Spec 新冻结的契约（以待实现）。无 `OPEN_ASSUMPTION`。
唯一记录在案的外部前提（非假设、非本仓库决策）：auth-service 侧 audience 注册与
两个 service client 的签发（§4.2 部署前置）。

---

## 13. Non-Goals / Prohibitions

本 Spec 不做 / 禁止：

- 不实现任何产品代码（本轮 SPEC ONLY）；
- 不创建 idempotency store、不创建真实 service credential、不改 auth-service
  production、不改 production config；
- 不做 Forum / Workflow credential provisioning（Program §8 Non-Goal；operator 侧工作）；
- 不给 Router 增加 caller / Forum / Workflow 语义（`ROUTER_SEMANTIC_CHANGE = NONE`）；
- 不做 notification queue / retry / dead-letter / notification center
  （V0 Non-goals 继承；幂等补救 = caller 用新 requestId，不是内置重试队列）；
- 不把 Notification Ingress 扩成 Agent-to-Agent delegation API
  （Program §2.2：`NOTIFICATION_INGRESS_IS_AGENT_DELEGATION_API = NO`）;
- 不发明本地共享 secret 协议 / 自铸 bearer 协议（§4.2 候选 B/C 已拒）；
- 不缓存 credential、不做 credential 管理面（C-AUTH-013/014）；
- 不做 outcome_unknown 的自动重投 / late rewrite（C-IDM-010）;
- 不修改 AgentProcess / BindingStore / kernel / v2-ingress-gate / broker；
- 不接受（accept）、不 merge、不 push main。

---

## 14. Validation Record

```text
BASE = origin/main @ 54ac27ff8a39fe6035b497dc3ae43958479df3db（MAIN_AT_START）
WORKTREE = 独立新 worktree（不复用通知调查 worktree）
git diff --check =（提交前执行，结果见提交信息）
python3 .agents/tools/verify_governance.py --target . =（同上）
CHANGED_FILES = docs/specs/NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1.md（仅此一个新文件）
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
CREDENTIAL_CREATED = NO
MERGE_PERFORMED = NO
```

---

## 15. Acceptance Transition（预冻结，本轮不执行）

本 Spec 被接受时（独立 review PASS 后的 acceptance-finalize 轮）执行且仅执行：
`status: proposed → accepted` + acceptance provenance（reviewed head、review 名称、
REQUIRED_FIXES）；语义正文不动。implementation 权限仍受 §8 依赖门约束
（accepted ≠ implementation allowed，直至 AgentProcess implementation PASS）。

---

## 16. Acceptance Record（2026-08-22 acceptance finalize）

```text
ACCEPTANCE_REVIEW = NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1_SPEC_REVIEW（通知 审计）
REVIEWED_BASE_COMMIT = 54ac27ff8a39fe6035b497dc3ae43958479df3db
REVIEWED_SPEC_COMMIT = bbd4d450df58fe734ad4b14db825d0e476600d3f
REVIEW_RESULT = PASS
REQUIRED_FIXES = NONE
ACCEPTED_BY = mayf3（owner-instructed mechanical acceptance finalize）
ACCEPTED_AT = 2026-08-22
CONTRACT_COUNT = 39（C-AUTH-001..014 = 14；C-IDM-001..016 = 16；C-BND-001..005 = 5；C-WIRE-001..004 = 4）
ACCEPTANCE_COUNT = 27（AC-AUTH 12；AC-IDM 9；AC-BND 3；AC-CMP 2；AC-WIRE 1）
ACCEPTANCE_FINALIZE_SEMANTIC_CHANGE = NONE（按 §15 预冻结协议：仅 status flip +
  acceptance provenance，§1–§15 语义正文一字不动）
IMPLEMENTATION_AUTHORITY = contracts（未激活：accepted ≠ implementation allowed——
  需本 Spec 合入 main 且 §8 依赖门满足（AgentProcess implementation PASS）后，
  Notification implementation 才获准；Scheduler implementation 仍等待 Notification PASS）
PR_STATE = OPEN（Draft PR #37）；MERGE_PERFORMED = NO
PRODUCT_CODE_CHANGE = NONE；PRODUCTION_CHANGE = NONE；CREDENTIAL_CREATED = NO
```
