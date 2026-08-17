---
spec_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
status: proposed
---

# Agent Core Agent Credential Provisioning V1

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结，不实现）** · 初版：2026-08-17 ·
> Amendment 1（review FIX round）：2026-08-17，base reviewed HEAD `104555f` ·
> Amendment 2（independent re-review FIX_REQUIRED round，3 factual gaps）：2026-08-18，
> base reviewed HEAD `9a408e0` ·
> Amendment 3（Owner Ruling 修订）：2026-08-18，base HEAD `e6aa7ad`，
> ruling = `AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1`
> 仓库：`mayf3/dsh-agent-core`
> 角色：Credential Provisioning Spec Agent
>
> 本 Spec 回答「这次允许改变什么」：为「每个正式 Agent 都有自己的身份 + 最小权限
> Broker credential」建立实施授权。它是 `docs/investigations/test-agent-feishu-product-semantics-v1.md`
> （evidence authority，PASS）结论 `FORUM_CREDENTIAL_FAILURE_LAYER =
> BROKER_GATEWAY_CREDENTIAL_RESOLUTION` 的收敛。调查细节不在本 Spec 复制，仅作为
> evidence source 引用；本 Spec 在 main 源码上重新做了 source-level trace（Part A），
> 所有事实均可在 main 代码与已入库报告核实。
>
> 本轮只修改 `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md`
> （原地 Amendment，**不创建平行 Spec**）。**不修改 Auth / Broker / Router / Runtime
> 代码，不创建 credential，不改 agents.json / credential store，不启动 runtime，
> 不 merge。** Kernel: **KERNEL_CHANGE = NONE**。

---

## Amendment 1 摘要（2026-08-17，基于 reviewed HEAD 104555f）

初版冻结了 authority 模型（Part B）、身份四族映射（Part C）、onboarding 语义
（Part D 旧表）、grant 分离（Part E）与 failure 层归属（Part F）。Review 一致确认
`PROVISIONING_GAP_CONFIRMED = YES`、`FAILURE_LAYER = BROKER_GATEWAY_CREDENTIAL_RESOLUTION`、
**ARCHITECTURE_DIRECTION = KEEP**。本轮 amendment 只做实现前细节冻结，**不重新设计
任何已冻结方向**：

1. **Part A.4（新增）**：外部 auth-service 两个正式幂等 provisioning seams 的
   源码级核实（`POST /api/v1/principals` / `POST /api/v1/clients`），以及 legacy
   `machine-admin client create` 非幂等、不得用于 ensure 重试的确认。
2. **Part C.4（新增）**：deterministic `external_ref` 格式冻结（Implementation
   Agent 不得自行决定 identity mapping）。
3. **Part D（重写）**：`ensureAgentCredential(agentId)` 冻结为确定状态机 A–G，
   含 missing-store recovery（状态 E）与 fail-loud split-brain 语义（状态 F）。
4. **Part G（新增）**：trusted credential store 写契约（validate-preserve-atomic）。
5. **Part H（新增）**：raw secret handoff 路径冻死 + 禁止清单 + 已知反模式记录。
6. **Part I（新增）**：rotation 语义（Auth 现实：旧 secret 立即失效，无 grace）。
7. **Part J（新增）**：revocation fail-closed 顺序。
8. **Part E.4（新增）**：grant mutation surface 诚实记录
   （`EXTERNAL_AUTH_DEPENDENCY` / `AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY`）。
9. **Acceptance Criteria（重写）**：L1 credential 自身 / L2 grant negative /
   L3 forum positive（条件验收）三层。
10. **Broker collateral 明确为 `YES_MINIMAL`**（Part F 不变，Scope 收紧表述）。

```text
ARCHITECTURE_DIRECTION = KEEP
Principal authority = Auth
Client authority   = Auth
Trusted store authority = trusted Deployment / CP uid505
Broker  = reader / authorized transport
Router  = 不负责 credential
Child   = 不持 raw secret
Credential existence != service grant
KERNEL_CHANGE = NONE
```

本轮 amendment 不允许（也未）借机提出：IAM platform、Policy Engine、sidecar、
mTLS、TPM、per-Agent OS user、OpenClaw fallback、Router credential manager。

---

## Amendment 2 摘要（2026-08-18，基于 reviewed HEAD 9a408e0，FIX_REQUIRED）

Independent re-review（VERDICT = FIX_REQUIRED，ARCHITECTURE_DIRECTION = KEEP）发现
3 个 factual gaps，本轮**只修这三个**，不动其余冻结：

1. **Fix 1 — 真实 token issuance 路径**（Part A.4 S5 重写 + Part D.5 重写）：
   补清 `AUTH_CONTRACT_MODE` 的真实分派（v1 → v1/direct.ts；v0 / v1_shadow →
   legacy `issueToken` / token-issuance.ts；deployed = **v0**）。冻结 legacy 路径
   `principalType != agent → 401 invalid_client` 且该检查发生在 secret 验证
   **之前**；**删除** Amendment 1 的无条件推理「401 invalid_client ⇒ secret
   invalid」。补齐 v1 结果解释（含 `400 invalid_target`、
   `503 temporarily_unavailable`）；Implementation Agent 不得自行猜测错误含义。
2. **Fix 2 — principal profile 与业务 token contract 自洽**（Part C.4 修订）：
   源码核实 audience registry：svc-forum / svc-workflow / adc-v2 仅接受 `agent`，
   svc-okr 接受 `user|agent`，svc-auth 仅接受 `service`。Amendment 1 冻结的
   `principal_type='service'` 与业务 audience **不兼容**（legacy 路径直接 401；
   v1 路径 `audience_profile_not_accepted`）。本轮二选一，**选 A**：
   `principal_type='agent'`，并冻结 `agent_id` / `owner_user_id` 的来源与语义
   （既有产品模型：`agent_id` = agent 身份键；`owner_user_id` = deployment
   bootstrap 输入，引用既有真实 admin 属主用户——生产先例为全部 openclaw agent
   principal 共用的 designated admin owner；**禁止为过 token 检查新建 user**）。
   方案 B（保持 service + registry 前置）记入 Alternatives considered 否决。
   > **Amendment 3 取代注记**：本条中 `owner_user_id` 的 designated-admin-owner
   > 冻结已被 `AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1` 取代——owner 冻结现为
   > **NULL / ABSENT**，复用 designated admin 与新建 user 同遭禁止；
   > `principal_type='agent'` + `agent_id = agt_*` 维持（见 Amendment 3 摘要与 C.4）。
3. **Fix 3 — Acceptance 可达性**（Part E.4 扩充 + Acceptance Criteria 重写）：
   诚实列出**三项**外部前置：(a) 业务 grant/resource 供给（mode-aware 表述）；
   (b) HTTPS rotation seam 缺失；**(c) 新增**——S1/S2 管理面要求 RS256 svc-auth
   token，而 deployed v0 的 `/oauth/token` 对 svc-auth 签 HS256 ⇒ 在 contract
   mode v1 生效（或等价 mint 路径）之前，ensure 的 Auth 侧步骤**不可经 HTTP 执行**。
   L1/L2/L3 全部改为显式 executability 标注；**删除**「L1 必须现在全绿」；
   外部前置未就绪时实现必须 fail-loud `external_prerequisite_missing`。

以下冻结**保持不变**：deterministic external_ref（C.4 前缀格式）、幂等
principal/client ensure（S1/S2，禁 legacy create / 禁 expected_* claim）、
no duplicate identities（状态机 FORBIDDEN 项）、trusted-store 写契约 G1–G8、
single-writer、secret 仅 HTTPS body → memory → 0600 store、no argv/env/stdout/log
secret、same-client rotation 语义、revocation fail-closed 顺序、credential ≠
grant、ROUTER_CHANGE = NONE、RUNTIME_CHANGE = NONE、KERNEL_CHANGE = NONE。
（Amendment 2 变更的只有：C.4 的 principal profile 参数、D.5 解释表、E.4 外部
依赖清单、Acceptance 分层可达性。）

---

## Amendment 3 摘要（2026-08-18，Owner Ruling 修订，base e6aa7ad）

**Ruling：`AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1`**（Owner 决定，效力高于本 Spec
任何既有冻结）：

- Agent Core 的 Agent 是**独立机器身份**；`owner_user_id` **不是** Agent Core 产品
  模型的一部分；Agent 不要求 human owner。
- **不得**为了满足当前 Auth contract 人工绑定 designated admin / fake human
  owner（Amendment 2 的「复用 designated admin owner」冻结随之作废）。
- `owner_user_id` 不决定：Agent ownership / Workspace ownership / Domain
  ownership / Binding / lifecycle authority。
- Target model：`principal_type = agent`、`agent_id = agt_*`、
  **`owner_user_id = NULL / absent`**。
- 若当前 auth-service 不允许 agent principal 缺少 `owner_user_id`：
  `AUTH_AGENT_WITHOUT_HUMAN_OWNER_SUPPORT = NAMED_EXTERNAL_PREREQUISITE`——这是
  Auth contract 需要修正的问题，不得在 Agent Core 用假 owner 绕过。未来 Auth 可
  (A) 允许 agent principal 的 owner optional/null，或 (B) 提供真正无 human owner
  的 machine principal 并允许业务 audience 使用；**具体 Auth 实现方案不在本 Spec
  决定**。

本轮只改 principal profile / external prerequisite / acceptance executability
相关文本；不实现 Auth、不设计 IAM、不改 Broker / Router / Kernel。本轮源码
核实的**owner 支持矩阵**（(d) 的精确范围）：

```text
                       ownerless agent principal（ruling target model）
S1 创建（/api/v1/principals）      支持——ownerUserId ?? null，无强制；DB 列可空
  （idempotent.ts:277-292；schema:109 nullable）；digest=(agent, agt_*) 稳定
Legacy 业务 mint（deployed v0）    支持——L4 只查 principalType==='agent' &&
  agentId，不查 owner（token-issuance.ts:91）
V1 业务/任何 mint（v1/direct）     不支持——assertPrincipalProfile 要求 agent
  profile 必须有 ownerUserId，否则 401 invalid_client (agent_profile_invalid)，
  且该检查先于 secret 验证（direct.ts:72-78）⇒ (d) 恰好只挡 v1 路径
Provisioner 自身（svc-auth，service profile）不受 (d) 影响
```

变更清单：C.4 owner 冻结改 NULL/ABSENT + 删除 designated-admin 复用；E.4 外部
前置增至 (a)-(d)；D.5/状态 G 的 401 归因在 v1 下因 profile 成因不可排除而修正；
Acceptance 可达性按 (a)-(d) 重算；Alternatives / Risks 同步；Final Output 更新。
其余全部冻结（含 Amendment 1/2 的 external_ref、ensure 状态机、store 契约、
secret handoff、rotation/revocation、credential ≠ grant）**不变**。

---

## Problem

真人 Feishu Canary 中，Test Agent 调用 `forum_list_threads` 返回 `credential_unavailable`：

```text
forum_list_threads
  → Broker Gateway
  → loadCredentialFor(AGENT_CORE_CREDENTIALS_FILE, agentId)
  → undefined
  → credential_unavailable          （broker/src/gateway.js:147-159，fail-closed）
AUTH_TOKEN_MINT_ATTEMPTED = NO      （失败发生在 /oauth/token 之前）
```

根因是一个 **provisioning gap**：Formal Agent（`agt_*` Agent Definition）已存在，但
对应 Broker credential（auth principal + machine client + trusted-store entry）不存在。
OpenClaw 身份（`stock-agent` principal + `mc_oc_*` clients）存在，但以不同身份键持有，
不在 Agent Core 的 `agt_*` 命名空间下。

本 Spec 冻结 credential provisioning 的 authority 模型、身份映射、deterministic
ensure 状态机、store 写契约、secret handoff、rotation / revocation 语义、grant
分离与 failure semantics，并界定未来 Implementation 的最小 scope。**不建设完整
IAM 平台，不复制 OpenClaw runtime。**

---

## Part A — 恢复现有 credential architecture（source trace）

### A.1 实际链路（全部 main 源码核实）

```text
DSH per-agent child (502, no credential, no token)
  → parent-RPC 'agent-core/broker'            (agent-router/src/index.js:455-484)
  → Router dispatches with ACTUAL proc.agentId (child 自报身份被忽略/记录)
  → brokerGateway.execute({capabilityId,operation,args}, {agentId})
                                              (broker/src/gateway.js, in-process, 505)
  → loadCredentialFor(credentialsFile, agentId)   (broker/src/credential-store.js:109-113)
  → credential === undefined ⇒ fail-closed credential_unavailable  (gateway.js:156-159)
  → (有 credential 时) requestAccessToken → POST /oauth/token       (broker/src/transport.js:80-124)
  → scoped JWT → pinned downstream (svc-forum 3460 / svc-workflow 8989 / svc-okr 3459)
                                              (broker/src/targets.js)
```

Store 形状（`broker/src/credential-store.js:16`，deployment-owned、0600、505-private、
每次调用重读支持 rotation、损坏 fail-loud）：

```text
{ "version": 1, "credentials": { "<agentId>": { "clientId": "...", "clientSecret": "..." } } }
```

Gateway 只读该 store，**从不注入 child、从不回传模型**；child 侧 Broker 工具是纯
relay（`broker/src/index.js` mode:child），child 无 credential、无 token
（`agent-router/src/process.js:73-89` agentEnv 无任何 credential 注入；V2 验收实测
`CHILD_SECRET_ENV=ABSENT / CHILD_SECRET_FS=ABSENT / A_READ_CREDENTIAL_STORE=DENIED`）。

### A.2 谁创建了什么（Agent Definition vs credential 的两套 authority）

| 面 | Authority / 落点 | 谁写 | 源码证据 |
|---|---|---|---|
| Agent 存在性（id/name/display/default） | `agents.json`（Agent Definition config） | deployment tooling：`adoptAgents` / `writeAgentDefinition` / `createAgentInConfig` / 一次性 `migrate-registry-to-definition.mjs` | `agent-definition/src/config.js:72-184,253-267`；`definition.js:22-26` |
| `agt_*` opaque id 铸造 | `generateAgentId()` = `agt_` + 32 hex | 上述写入路径（deployment/acceptance side） | `agent-definition/src/definition.js:79-92` |
| Auth principal | auth-service（外部，`127.0.0.1:4001`；`machine_principals`） | **无 Agent Core 代码创建** —— 仅 V2 验收人工配对 | `docs/reports/trusted-credential-505-final-acceptance-v2.md` |
| Machine client + secret | auth-service（外部，`machine_clients`） | **无 Agent Core 代码创建** —— 历史 OpenClaw-era 手工注册 | 同上；`docs/investigations/test-agent-feishu-product-semantics-v1.md` §2.3 |
| Trusted-store entry（agentId → clientId/clientSecret） | `AGENT_CORE_CREDENTIALS_FILE`（505 私有，0600） | **无 Agent Core 代码写入** —— 验收/部署手工维护 | `broker/src/credential-store.js`；V2 在 505 zone 手工配对 |
| 业务 grant（scope） | auth-service + downstream scope-guard | auth-service 侧（外部），与本仓库无关 | `capabilities/forum.js`（声明 forum.read/forum.write）；svc-forum scope-guard（外部） |

### A.3 核心回答：为什么创建了 `agt_*` Agent Definition 却没有创建对应 Broker credential？

因为 **Agent 存在性与 Broker credential 是两套完全解耦的 authority，全仓没有任何一条
代码路径在创建 Agent 的同时创建 principal / client / store entry**：

1. Agent Definition config 是 **identity + display only**，且**显式禁止**任何 credential
   字段——`agent-definition/src/config.js:78-84`：*「a persona, workspace, credential
   or runtime field can never sneak in via the writer either」*；`definition.js:26` 明确
   `Principal / credential / grant → Auth`。
2. per-agent home provisioner（`agent-provisioning/src/index.js`）只装 DSH 侧
   settings/credentials(model key)/profile/farm links 与 workspace——**不碰 Broker
   credential**；root 侧 `scripts/production-agent-provision.mjs` 也只 chown home +
   workspace，不写 credential store。
3. production layout（`production-runtime/src/paths.js`）**不含** credential store——
   store 落在 trusted install closure
   （`AGENT_CORE_CREDENTIALS_FILE=/usr/local/libexec/agent-core/config/agent-credentials.json`），
   由 supervision env 注入 compose（`compose.js:154-158`），运行时**只读**。
4. auth-service 是**外部 authority**（本仓库无其源码）；principal/client/grant 的创建
   在本仓库没有对应实现。

⇒ **provisioning gap 是架构性断点，不是某个 bug**：``agt_*`` id 铸造与 credential
supply 之间没有任何 coupling。把 Agent 写进 `agents.json` 从不保证它能调用任何
Broker capability。

### A.4 外部 auth-service 的正式 provisioning seams（Amendment 1 源码核实，2026-08-17）

本轮对当前外部 auth-service 源码（`~/workspace/project/auth-service`）做了重新核实。
以下事实全部为 **source-verified**，是 Part C.4 / Part D 状态机的 seam 依据：

**S1 — 幂等 principal ensure seam（正式、HTTP、幂等）**

```text
POST /api/v1/principals
  → createOrGetPrincipal            (src/lib/oauth/v1/idempotent.ts:107-359;
                                     src/routes/idempotent.ts:48-73)
  → external_ref 幂等：DB-level UNIQUE(machine_principals.external_ref)，
    SELECT→INSERT(P2002)→SELECT 并发安全
  → 响应 {id, principal_type, display_name, status, external_ref, created_at, created}
    201(created=true) / 200(created=false)
  → external_ref 对 Auth 完全 opaque（"Auth does NOT interpret the external_ref"）
  → requestDigest 一致性校验：同 external_ref 携带不同身份 profile → 409
  → 鉴权：v1ManagementAuth —— RS256 token，audience svc-auth，
    scope auth.identity.provision（src/middleware/v1-management-auth.ts）
```

**S2 — 幂等 client ensure seam（正式、HTTP、幂等、secret 一次性）**

```text
POST /api/v1/clients
  → createOrGetClient               (src/lib/oauth/v1/idempotent.ts:373-580;
                                     src/routes/idempotent.ts:77-106)
  → external_ref 幂等（DB UNIQUE(machine_clients.external_ref)）；
    principal 必须存在且 active，否则 404/403
  → clientId = 'mc_' + 24 位随机（auth 侧生成）
  → secret 仅 created=true 时随 HTTPS response body 返回一次
    （routes/idempotent.ts:99-102 "Only return secret on creation (never on reuse/claim)"）
  → 新建 client 固定 allowedResources=[] / allowedScopes=[]——
    "client permissions are managed separately via MachineAccessGrant"
    (idempotent.ts:364-372, 519-527)   ⇒ 见 Part E.4 grant 诚实记录
```

**S3 — legacy 非幂等路径（禁止用于 ensure 重试）**

```text
machine-admin client create → createClient  (src/lib/oauth/service.ts:241-293)
  → 按 agentId 列查 legacy 'agent' principal（assertLegacyAgentPrincipal，
    service.ts:33-44），每次调用 INSERT 全新 client —— 非幂等
  → 且在创建时直接捆绑 resources/scopes（legacy 语义，与 V1 幂等面相反）
⇒ 正常 ensure 路径必须优先使用 S1/S2 幂等 HTTP seam；
  不得用 machine-admin client create 重试创建 client。
```

**S4 — rotation 现实（决定 Part I / 状态 E·G 的外部依赖）**

```text
rotateClientSecret                (src/lib/oauth/service.ts:295-345)
  → 单 secretHash 覆盖：旧 secret 立即失效，无 dual-secret grace
当前暴露面：仅 machine-admin CLI（machine-admin client rotate，
  src/cli/machine-admin.ts:143-152），且 newSecret 以 JSON 打到 stdout
完整 HTTP route surface 枚举（routes/*.ts）：/oauth/token、human OAuth、
  /api/v1/principals、/api/v1/clients、auth/users/roles/service-registrations
  —— 不存在 rotation HTTP seam
```

**S5 — AUTH_CONTRACT_MODE 分派与两条 issuance 路径（Amendment 2 重写，Fix 1）**

Amendment 1 的 S5 只描述了单一校验顺序，并据此推出「401 invalid_client ⇒ secret
invalid」——该推理在 legacy 路径下**不成立**。真实模型（全部源码核实）：

```text
AUTH_CONTRACT_MODE 分派（src/routes/oauth.ts:134-137；src/config/env.ts:13-22）：
  'v1'        → doIssueV1DirectToken   （src/lib/oauth/v1/direct.ts）
  'v0'        → issueToken             （src/lib/oauth/token-issuance.ts，legacy）
  'v1_shadow' → issueToken（返回值来自 legacy）
                + evaluateV1DirectShadow（仅影子比对，不影响响应）
Deployed mode = 'v0'：launchd plist 与 .env 均未设置 AUTH_CONTRACT_MODE（默认 v0，
env.ts:13）；runtime contract 亦标注 auth_token_contract_v1_production_effective=false
（generated/minimal-auth-v1/runtime-contract.json lifecycle）。
```

**Legacy 路径（v0 / v1_shadow；token-issuance.ts:44-156）冻结顺序：**

```text
L1  client 不存在                         → 401 invalid_client
L2  client.status = revoked               → 401 invalid_client
L3  principal.status = disabled           → 401 invalid_client
L4  principalType !== 'agent' 或无 agentId → 401 invalid_client
    ★ 该检查发生在 secret 验证之前（token-issuance.ts:91-106）
L5  secret 验证失败                       → 401 invalid_client
L6  resource ∉ client.allowedResources    → 400 invalid_grant（audit error:
    invalid_resource）
L7  scope ⊄ client.allowedScopes          → 400 invalid_scope
```

**Legacy 冻结推论（替代 Amendment 1 的错误推理）：**

```text
LEGACY_401_SEMANTICS：
  401 invalid_client ∈ {client 不存在, revoked, principal disabled,
                        principal profile ≠ agent, secret invalid} —— 同码多因，
  无 ensure 上下文时不得单凭 401 归因 secret。
  任何 400（invalid_grant / invalid_scope）⇒ secret 已在 L5 通过验证 ⇒
  credential 层有效（400 只能来自 L6/L7，均晚于 secret 验证）。
Legacy 的 grant 校验面是 client.allowedResources / allowedScopes（非
MachineAccessGrant）——idempotent 新建 client 二者皆空（S2）。
```

**V1 路径（AUTH_CONTRACT_MODE='v1'；v1/direct.ts:81-126 + v1/errors.ts）冻结顺序与
错误分类（status 由 STATUS_BY_CODE 决定，禁止实现自行猜测）：**

```text
V1 顺序：
  1) audience 未注册或未开 machine access → 400 invalid_target
     (audience_not_machine_enabled)
  2) client 不存在 / client 或 principal inactive → 401 invalid_client
  3) profile 畸形（agent 缺 agentId/ownerUserId；service 带 agentId）
     → 401 invalid_client (agent_profile_invalid / service_profile_invalid)
  4) secret 验证失败 → 401 invalid_client (credential_invalid)
  5) audience 不接受该 principalType → 400 invalid_target
     (audience_profile_not_accepted) ★ 晚于 secret ⇒ 出现即证明 secret 有效
  6) 无 MachineAccessGrant → 400 invalid_scope (machine_grant_missing)
  7) audience registry 不匹配 → 503 temporarily_unavailable
     (audience_registry_mismatch:*)
  8) grant 状态畸形（version<1 / scopes 空 / 重复 / 未注册）→ 503
     temporarily_unavailable (machine_grant_state_invalid)
  9) 请求 scope ⊄ grant.scopes → 400 invalid_scope (requested_scope_not_granted)

V1_ERROR_CLASSIFICATION（HTTP status 冻结表，v1/errors.ts STATUS_BY_CODE）：
  invalid_client=401 · invalid_grant=400 · invalid_request=400 ·
  invalid_scope=400 · invalid_target=400 · unsupported_grant_type=400 ·
  unsupported_token_type=400 · temporarily_unavailable=503 · server_error=500
V1 冻结推论：任何 400 / 503 ⇒ secret 已通过验证（步骤 5-9 均晚于步骤 4）；
  401 同 legacy 为多因（见 V1 步骤 2-4），仅当 ensure 上下文排除 2/3 后才可
  归因 secret。
```

**S6 — external_ref namespace 惯例**

生产已有 colon-namespace 先例 `openclaw:agent:ceo-agent`（auth 侧 opaque，
见 auth-service `docs/audits/AGENT_IDENTITY_DEPLOYMENT_RECONCILIATION_V1_REPORT.md:61`）。
Part C.4 冻结的 `agentcore:v1:*` 前缀与该惯例同构（system:version:kind:key），
并多出 version 段为未来演化留位。

**S7 — machine audience registry 的 principal profile 契约（Amendment 2，Fix 2 证据）**

```text
来源：generated/minimal-auth-v1/runtime-contract.json（contract bundle 1.2.0，
frozen；经 getV1AudienceDefinitions() 加载，contract.ts:164）：
  svc-workflow | accepted: agent           | scopes: workflow.read/execute/admin
  svc-okr      | accepted: user | agent    | scopes: okr.read/write
  adc-v2       | accepted: agent           | scopes: adc.read/execute
  svc-auth     | accepted: service         | scopes: auth.identity.provision
  svc-forum    | accepted: agent           | scopes: forum.read/write/moderate/admin
（全部 machine_access_enabled=true）
⇒ 业务 audience（svc-forum / svc-workflow / adc-v2；svc-okr 半数）只接受
  'agent' profile；'service' profile 仅 svc-auth（管理面）接受。
```

**S8 — S1/S2 HTTP seam 的可调用性前置（Amendment 2，Fix 3(c) 证据）**

```text
S1/S2（/api/v1/principals、/api/v1/clients）由 v1ManagementAuth 保护：
RS256 + kid（workflow keyring）+ aud=svc-auth + scope auth.identity.provision
（src/middleware/v1-management-auth.ts；v1/signer.ts:252-292 强制 alg=RS256）。
Deployed v0 的 /oauth/token 对非 workflow audience 一律签 HS256
（token-issuance.ts:158-196）⇒ svc-auth 只能拿到 HS256 token ⇒ 被
verifyV1DirectMachineToken 拒绝（'V1 token requires alg=RS256 and kid.'）。
⇒ 在 AUTH_CONTRACT_MODE='v1' 生效（或等价 RS256 svc-auth mint 路径出现）之前，
机器 provisioner 无法经 HTTP 调用 S1/S2（auth-service 自身 conformance 测试是
进程内直调 service 层，不构成 HTTP 面可用的证据）。
⇒ 这不是本 Spec 可在 repo 内解决的项：列为外部前置 (c)（Part E.4）。
```

---

## Part B — Authority model（冻结）

```text
PRINCIPAL_AUTHORITY        = Auth（外部 auth-service）—— deployment-side ensure；
                             Agent Core 运行时永远不创建 principal
CLIENT_CREDENTIAL_AUTHORITY = Auth（外部 auth-service）—— machine client + secret；
                             provisioning tooling 经 auth-service 既有幂等注册面
                             （Part A.4 S1/S2）创建
TRUSTED_STORE_AUTHORITY    = Deployment / Control Plane（505）—— 唯一写入方按
                             Part G 契约把 <agentId> → {clientId, clientSecret}
                             写进 AGENT_CORE_CREDENTIALS_FILE（0600、505-owned）；
                             写入值直接来自 auth-service 签发结果，永不经 env/argv/child
BROKER_RESOLUTION          = gateway 按 ACTUAL proc.agentId 经 loadCredentialFor 读取
                             （每次调用重读，支持 rotation）
CHILD_RAW_SECRET_ACCESS    = NO —— child 进程从不持有 raw secret 或 token
                             （V2 验收实证：env/fs/ws 均 ABSENT、store 读取 DENIED）
```

优先模型（与既有代码一致，最小设计）：

```text
Agent onboarding / provisioning（deployment-side）
  → creates / ensures Auth principal + machine client      （S1/S2 幂等 seam）
  → secret 直接写入 trusted credential store（505）         （AGENT_CORE_CREDENTIALS_FILE，Part G 契约）
  → formal Agent exists ⇒ credential 可在 trusted store 按 agentId resolve
        │
child Agent               → 永远看不见 raw secret
        │
Broker gateway（505）     → loadCredentialFor(agentId) → client_credentials → scoped JWT
```

冻结边界：**不引入新 Auth 系统、不引入 credential→principal 映射表**（auth-service
仍是 client↔principal↔agent_id 绑定的唯一权威）；**不把 secret 交给 child 进程持有**
（维持 trusted gateway 模型，不退回 Process Identity 的 child-held-credential 方案）。

**Provisioner 自身的 bootstrap（诚实记录，非新设计）**：调用 S1/S2 需要一个持有
`auth.identity.provision` scope（audience `svc-auth`）的 provisioning machine
credential。该 credential 属于**deployment bootstrap 输入**（与 supervision env 同类，
operator 一次性配置），不是本 Spec 建设的对象；它按 Part H 同等约束保管（trusted
505 zone、0600、永不经 env/argv 交付给任何 child）。Agent Core 运行时不需要也不持有它。
Amendment 2 补记（S7/S8）：svc-auth audience 仅接受 `service` profile（provisioner
自身的 principal 即为 service 型，与被 provision 的 agent principal 不同族）；且其
RS256 mint 依赖 contract mode v1 生效——即该 bootstrap credential 的可用性同样受
外部前置 (c) 约束。Amendment 3 补记：provisioner 的 service profile 不含 owner
语义，**不受 (d) 影响**。

---

## Part C — Identity consistency（冻结稳定映射）

以下各身份**不必字符串相等**——显式拒绝「字符串复用即正确」的默认假设：

```text
AGENT_IDENTITY_TO_AUTH_IDENTITY =
  agentId（agt_*）      = Agent Definition 键 = credential store 键
                          （agentId 是 Agent Core 侧 loadCredentialFor 的 ONLY lookup 键）
  clientId（mc_*）      = auth-service 上注册的 OAuth machine client
                          （store entry 的 clientId 字段；auth 侧生成 'mc_'+24 随机）
  principal id（UUID）  = auth-service 中该 client 绑定的 principal 实体
  JWT sub / agent_id    = auth-service 签发时决定 claims（绑定在 client↔principal 上）
```

约束：

- **store key 必须等于 Agent Core 的 agentId**——这是 Broker 侧唯一查找点，must be
  exact string equality（`credential-store.js` `store[agentId]`）。
- `agt_*`、`mc_*`、principal UUID、JWT claims 是**四个身份族**；它们之间的关系由
  **provisioning 时刻一次性建立**并固定（client→principal 绑定在 auth-service；
  agentId→client entry 在 trusted store）。任何 run-time 都不做跨族查找或换算。
- 未来验收可校验「同 logical agent」的存在性，但**不要求**四族字符串相等，也**不**在
  JWT 里塞业务角色（遵循 Frozen architecture：Auth = Principal + Client/Secret +
  audience + coarse scopes；业务角色不进入 JWT）。

### C.4 Deterministic external_ref（冻结 — Implementation Agent 不得自行决定 identity mapping）

重新 ensure 时必须能**确定性找回同一身份**。Auth 侧 S1/S2 的幂等键是 `external_ref`
（opaque、DB-UNIQUE），因此冻结如下**纯函数**（从 agentId 可恢复、deterministic、
stable、unique）：

```text
principalExternalRef(agentId) = "agentcore:v1:principal:" + agentId
clientExternalRef(agentId)    = "agentcore:v1:client:" + agentId

示例（canary agt_fb78…）：
  agentcore:v1:principal:agt_fb78…
  agentcore:v1:client:agt_fb78…
```

冻结细则：

1. **格式固定**为上述字面前缀拼接，不引入 agentId 之外的变量（无 display name、
   无时间戳、无随机段）。
2. **recoverable from agentId**：前缀剥离即得 agentId；反之亦然。
3. 与既有生产 namespace 惯例同构（`openclaw:agent:<name>` → `agentcore:v1:<kind>:<agentId>`，
   见 A.4 S6）；`v1` 段为未来 external_ref 格式演化留位（如出现 `v2`，须新 Spec）。
4. **ensure 调用体冻结**（Part D 状态机的唯一入参面；Amendment 2 修订 profile、
   Amendment 3 按 Ruling 修订 owner）：

```text
POST /api/v1/principals body = {
  external_ref: principalExternalRef(agentId),
  principal_type: "agent",              // Amendment 2 冻结，依据见下
  agent_id: agentId,                    // = Agent Core 的 agt_*（见下）
                                         // owner_user_id：不传（absent）——Ruling 冻结，见下
  display_name: <Agent Definition display name 或 agentId>   // 仅 cosmetic，不参与匹配/digest
}
POST /api/v1/clients body = {
  external_ref: clientExternalRef(agentId),
  principal_id: <S1 返回的 principal id>
}
```

   - **`principal_type` 冻结为 `"agent"`（Amendment 2 Fix 2，替代 Amendment 1 的
     `"service"`）**。依据：S7 registry——业务 audience（svc-forum / svc-workflow /
     adc-v2）只接受 `agent`；legacy 路径 L4 对非 agent profile 直接 401（S5）。
     `service` profile 在两条路径下都**无法铸造业务 token**，会使 canary 的
     forum 目标整体依赖 auth registry 变更（更大的 IAM 面改动，违背最小选择）。
     方案 B（保持 service + registry 前置）记入 Alternatives considered 否决。
     Ruling target model 确认 `principal_type = agent`。
   - **`agent_id` 的来源与语义（冻结）**：取值 = Agent Core Agent Definition 的
     `agt_*` 本身。auth 侧 `machine_principals.agent_id` 列（`@unique`，
     prisma schema:108）语义为「该 machine principal 代表的 agent 身份键」——
     既有用法存 openclaw 业务名（`stock-agent` 等，onboard 脚本先例），
     `agt_` 前缀天然构成独立 namespace，无碰撞。它同时满足 legacy L4 的
     「agent 类型必须非空 agentId」。
   - **`owner_user_id` 冻结为 NULL / absent（Amendment 3，依据
     `AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1`，替代 Amendment 2 的
     designated-admin-owner 冻结）**：

```text
AGENT_IDENTITY_REQUIRES_HUMAN_OWNER = NO
OWNER_USER_ID = NULL / ABSENT        （ensure 调用体不携带该字段）
FAKE_ADMIN_OWNER_FORBIDDEN  = YES    （新建 user 与「复用 designated admin
                                      绑定为 Agent owner」均禁止）
owner_user_id 不决定：Agent ownership / Workspace ownership / Domain
ownership / Binding / lifecycle authority（Agent Core 产品模型中该概念不存在）
```

     源码核实（Amendment 3 支持矩阵）：S1 创建**允许** ownerless agent principal
     （`ownerUserId ?? null`，无强制；DB 列 nullable；digest=(agent, agt_*) 稳定）；
     legacy 业务 mint **不查 owner**（L4）；**v1 路径 `assertPrincipalProfile`
     要求 agent 必须有 ownerUserId，否则 401 `agent_profile_invalid`（先于
     secret 验证）**⇒ `AUTH_AGENT_WITHOUT_HUMAN_OWNER_SUPPORT =
     NAMED_EXTERNAL_PREREQUISITE`（外部前置 (d)，E.4；Auth 侧解法 A/B 由 Auth
     决定，不在本 Spec）。
   - **digest 稳定性**：requestDigest = `("agent", agentId)`（owner 恒缺省，
     computePrincipalDigest 对缺失段不参与），两个输入全部冻结 ⇒ repeated
     ensure 永不 digest 409。
   - 正常 ensure **不传** `expected_principal_id` / `expected_client_id`（S1/S2 的
     claim 路径是 operator 对既有手工行的恢复工具，不在冻结 ensure 流内）。
   - **`agt_*` / `mc_*` / principal UUID 字符串不相等是正常的**（Part C）；deterministic
     找回靠 external_ref，不靠字符串相等。

---

## Part D — `ensureAgentCredential(agentId)` 冻结状态机（Amendment 1 重写）

V1 **不建设完整 IAM 平台**。`ensureAgentCredential(agentId)` 是 deployment-side
tooling（与 `production-agent-provision.mjs` root seam 同类），幂等、确定性、
**每次运行重读 trusted store**（与 runtime 的 per-call re-read 语义一致）。它按下列
**固定顺序**执行；状态由幂等 seam 的**响应**判定（created 标志 / status 字段），
不做任何自选的预检查顺序。

```text
ensureAgentCredential(agentId):

STEP 0（状态 A 前置）  读 Agent Definition（agents.json）。
  A. agentId 不在 Agent Definition 中
     → STRUCTURED_REJECT { code: 'agent_not_found', agentId }
     → 不调用任何 Auth seam；绝不创建 orphan Auth identity（无 principal / client / store entry）
     → 终止。

STEP 1  POST /api/v1/principals（S1，body 见 C.4）
  B. created=true（principal 不存在 → 已创建）
  或 created=false（principal 已被确定性找回 —— 同一 external_ref ⇒ 同一 principal UUID）
     → 两者对后续步骤无差别（幂等面的意义正在于此）。
     → principal.status ≠ 'active' ⇒ FAIL-LOUD { code:'auth_principal_not_active' }
       （归入状态 F 家族：split-brain / 外部状态冲突，绝不静默重建第二个 principal）。

STEP 2  POST /api/v1/clients（S2，body 见 C.4）
  C. created=true（client 不存在 → 已创建）
     → secret 从 HTTPS response body 直接进入 provisioning 进程内存（Part H）
     → 按 Part G 契约写 store entry：credentials[agentId] = { clientId, clientSecret }
     → verification mint（Part D.5）→ 成功即完成。
  D. created=false 且 status='active' 且 store entry 存在且 store.clientId === 响应 client_id
     且 verification mint 证明 secret 有效（200，或任一「secret 已验证」类 400 ——
     见 D.5 mode-aware 解释表）
     → NO-OP（幂等成功）：不 rotate、不重写 store、不缓存 token。
  E. created=false 且 status='active' 且 store entry 缺失
     —— 关键恢复路径。raw secret 在 Auth 侧不可读回（仅存 secretHash；
        secret 只在 created=true 时返回一次，S2）。
     → 必须恢复 SAME principal / SAME client：
       1) rotate 该 existing client 的 secret（SAME clientId，禁建新 client；
          rotation seam 见 Part I —— 当前为外部依赖，Part E.4(b)）
       2) 新 secret 经 HTTPS response body 进入进程内存（Part H）
       3) atomic store write 恢复 entry（Part G）
       4) verification mint
     → FORBIDDEN：创建第二个 client；创建第二个 principal；改用 legacy
       machine-admin client create 重建。
  F. store entry 存在，但 Auth 侧 client missing / revoked / 或 store.clientId ≠
     ensure 所得 client_id（split-brain：本地 entry 指向 Auth 不再承认的身份）
     → FAIL-LOUD { code:'auth_client_missing_or_revoked', detail: 仅含 agentId 与
       store.clientId（不含 secret，Part H）}
     → 冻结的 recovery action（operator 显式执行；tooling 只报告、绝不自动执行）：
        a) de-provision：按 Part G 移除 store entry（该 agent 本地即刻 fail-closed），
           之后重新 ensure 会经 B/C 创建全新身份——旧 client 已 missing/revoked，
           不构成平行身份；或
        b) Auth 侧 out-of-band 处置后（revoked 不可逆则只能 a）重跑 ensure。
     → 不静默创建平行身份。
  G. store entry 存在且与 ensure 所得 client 一致，但 verification mint 返回
     401 invalid_client（在 ensure 上下文排除其余 401 成因后归因 secret 失效，
     见 D.5 —— 401 本身是多因码，不得无条件读作 secret invalid）。
     Amendment 3 约束：Ruling profile（ownerless agent）在 v1 路径下必然触发
     401 agent_profile_invalid（先于 secret，direct.ts:72-78），该成因在 (d)
     就绪前**不可排除** ⇒ v1 路径上 (d) 就绪前 401 一律记为 (d) 证据 /
     INCONCLUSIVE，**不得进入状态 G**（不得 rotate）；legacy 路径（L4 不查
     owner）profile 成因不存在 ⇒ 状态 G 可达。
     → rotate SAME client（同 E 的 rotation seam）→ 新 secret 进内存 →
       atomic rewrite store（Part G）→ 再次 verification mint。
     → FORBIDDEN：创建第二个 client。
```

### D.5 Verification mint（Amendment 2 重写 — mode-aware 冻结解释表）

ensure 的 validity 检查 = 一次 `POST /oauth/token`（grant_type=client_credentials，
resource/scope 取自已部署 capability manifests 的任一 HTTP 组合；secret 从 trusted
store 读入进程内存构造 Basic header，Part H）。解释表**按 deployed
AUTH_CONTRACT_MODE 分派**（S5），**Implementation Agent 不得自行猜测错误含义**：

**Legacy 模式（v0 / v1_shadow；deployed 现状）：**

```text
HTTP 200 + access_token      → credential 有效（且 resource/scope 均在
                               client.allowedResources/allowedScopes 内）
HTTP 400 invalid_grant       → secret 已通过 L5 验证 ⇒ credential 层有效；
  （resource 不在 allowed    grant/resource 缺失（L6，audit error invalid_resource）
   Resources）                 ——credential 层 PASS；grant 缺口按 Part E 记录
HTTP 400 invalid_scope       → 同上（L7；secret 已验证，scope 缺失）
HTTP 401 invalid_client      → 多因码（L1-L5：client 不存在/revoked/principal
                               disabled/profile ≠ agent/secret 错）。**仅在 ensure
                               上下文内**——ensure 前序步骤已确认 client+principal
                               active 且 profile 按 C.4 冻结为 agent+agt_*（排除
                               L1-L4）——才可归因 secret 失效 → 状态 G。
                               无该上下文（如 Broker runtime 观察）不得如此归因。
网络不可达 / 5xx / malformed  → INCONCLUSIVE：结构化报错退出；不得当作 invalid
                               触发 rotate，也不得当作 valid 记 NO-OP
```

**V1 模式（AUTH_CONTRACT_MODE='v1'）：**

```text
HTTP 200 + access_token      → credential 有效
HTTP 400 invalid_target      → 分两种：(i) audience 未注册/未开 machine（步骤 1，
                               在 secret 验证之前——若请求的是已部署 manifest 的
                               合法 audience 则不会发生，发生即工具配置错误）；
                               (ii) audience_profile_not_accepted（步骤 5，在
                               secret 验证之后 ⇒ secret 有效；对 C.4 冻结的
                               agent profile + 业务 audience 不应发生，发生即
                               profile/audience 配置漂移，fail-loud 报告）
HTTP 400 invalid_scope       → secret 已验证（步骤 4 之后）；machine_grant_missing
                               或 requested_scope_not_granted —— credential 层
                               PASS；grant 缺口按 Part E 记录
HTTP 503 temporarily_        → secret 已验证（步骤 4 之后）；auth 侧
     unavailable               audience_registry_mismatch / machine_grant_state_
                               invalid —— credential 层对 secret 不下结论（服务端
                               状态问题），按 INCONCLUSIVE-ish 处理：不 rotate、
                               不记 NO-OP，结构化报告
HTTP 401 invalid_client      → 多因码（client/principal inactive、profile 畸形、
                               secret 错）。ensure 上下文排除前两类后归因 secret
                               失效 → 状态 G
                               ★ Amendment 3：Ruling profile（ownerless agent）
                               在 v1 下**必然**落入本码（agent_profile_invalid，
                               步骤 3，先于 secret）——(d) 就绪前该成因不可排除，
                               401 一律记 (d) 证据 / INCONCLUSIVE，不得触发状态
                               G，不得归因 secret（Amendment 3 支持矩阵）
网络不可达 / 其他 5xx         → INCONCLUSIVE（同上）
```

**共同冻结**：401 永远不得在**无 ensure 上下文**时解读为「secret invalid」
（Amendment 1 的无条件推理已删除，见 S5 LEGACY_401_SEMANTICS）；「secret 有效」
的最小充分证据在两种模式下都是**任一晚于 secret 验证的 400**（legacy：
invalid_grant/invalid_scope；v1：invalid_scope 与步骤 5 的 invalid_target）或 200。
**Amendment 3 补充**：v1 路径 + Ruling profile 下，verification mint 在 (d)
就绪前确定性地止步于步骤 3（agent_profile_invalid 401，先于 secret）——secret
有效性在 v1 路径上**不可证明**（只能经 legacy 路径环境或 (d) 之后）；该 401 是
外部前置 (d) 的直接证据，不是 credential 失效。

### D.6 Agent 删除 / disable（既有 seam，引用不变）

从 Agent Definition config 移除（先 `disable`）是既有 seam；store entry 移除与
Auth revoke 按 Part J 的 fail-closed 顺序执行。是否保留 Auth principal/client 由
运营商决定（独立于 Agent Core）。

---

## Part E — Grants（credential ≠ grant，必须分离）

```text
CREDENTIAL_EXISTENCE   = trusted store 存在 <agentId> → {clientId, clientSecret}
SERVICE_GRANT          = auth-service 侧该 client 被授予的 scope
                         （forum.read / forum.write / workflow.* …）
```

冻结：

1. **credential provisioning ≠ 自动授予每一个 capability。** provisioning 只保证
   「有身份、能 mint token」；授予哪些 scopes 是 auth-service / 业务侧决策。
2. Agent 有 credential 但**没有** `forum.read` grant 时，调用必须得到**授权失败**
   （如 `scope_denied` / `access_denied` / `invalid_scope`），**绝不**再得到
   `credential_unavailable`。两个 failure mode 必须可区分（Part F；verification mint
   的 400 invalid_scope 即为最小可区分证据，D.5）。
3. 现网已有先例（`agent-definition/src/access.js`）：LOCAL capability
   `agent.definition.write` 需要 `agent.definition.write` scope——gateway 经
   auth-service 取 token，失败返回 `access_denied`（`gateway.js:163-186`）。HTTP
   capability 的同类分离由 Part F 冻结。

### E.4 Grant mutation surface 诚实记录（Amendment 1 引入，Amendment 2 修订为 mode-aware）

- V1 幂等 client 创建（S2）固定 `allowedResources=[] / allowedScopes=[]`——
  **新建 client 不自动拥有 `forum.read` / `forum.write` / … 任何 grant**。
- 业务权限的载体**随 AUTH_CONTRACT_MODE 分派**（S5）：
  - **legacy（v0 / v1_shadow，deployed 现状）**：mint 校验
    `client.allowedResources` / `client.allowedScopes`（token-issuance.ts:122-156）。
    idempotent 新建 client 二者皆空；`machine-admin client create` 仅在**创建时**
    设置（S3），**无任何对 existing client 的 resources/scopes 更新面**。
  - **v1**：载体为 `MachineAccessGrant`（`(machineClientId, audienceId)` 主键 +
    `scopes[]`，`prisma/schema.prisma:272-284`；direct.ts 步骤 6-9 校验）。
- **现状（两种模式同判）**：不存在对 existing client 的正式 grant mutation
  HTTP/CLI seam——仅若干一次性脚本直连 DB 操作（如 auth-service
  `scripts/provision-domain-owner-machine-clients.ts:445-469`）。即：

```text
formal existing-client grant mutation seam = 当前缺失 / 不完整
```

- 本 Spec **禁止**因此顺手建设：Auth grant platform、auto-grant、Policy Engine。
  grant 配置是 **named external prerequisite**（外部运营商/外部工具动作）。

```text
AGENT_CORE_AUTH_CODE_CHANGE = NONE
EXTERNAL_AUTH_DEPENDENCY =
  (a) 业务 grant/resource 供给前置（mode-aware）：deployed v0 下 = 对 existing
      client 填充 allowedResources/allowedScopes 的正式 seam 缺失；v1 下 =
      MachineAccessGrant 的正式 mutation seam 缺失。（L3 Forum 正向验收的前置）
  (b) machine-client secret 的 HTTPS rotation seam currently missing
      （rotation 仅 machine-admin CLI 且 newSecret 走 stdout——与 Part H 冲突；
       状态 E / G 恢复路径与 Part I 依赖该 seam）
  (c) S1/S2 HTTP seam 的可调用性前置（Amendment 2 新增，S8）：v1ManagementAuth
      要求 RS256 svc-auth token，deployed v0 只能对 svc-auth 签 HS256 ⇒ 在
      AUTH_CONTRACT_MODE='v1' 生效（或等价 RS256 svc-auth mint 路径）之前，
      ensure 的 Auth 侧步骤不可经 HTTP 执行（raw secret 只存在于 S2 的
      HTTPS response body，直连 DB 无法获得 ⇒ 无 HTTP 替代路径）
  (d) AUTH_AGENT_WITHOUT_HUMAN_OWNER_SUPPORT（Amendment 3 新增，依据
      AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1）：Ruling target model =
      principal_type 'agent' + agent_id agt_* + owner_user_id NULL/ABSENT。
      源码核实支持矩阵——S1 创建 ownerless agent **已允许**；legacy 业务 mint
      **不查 owner**（L4）；**v1 路径 assertPrincipalProfile 要求 agent 必须有
      ownerUserId（401 agent_profile_invalid，先于 secret）** ⇒ (d) 恰好只挡
      v1 路径的 token mint（含 verification mint 的 secret 有效性证明）。解法
      由 Auth 决定（Ruling 选项 A：owner optional/null；选项 B：真正无 human
      owner 的 machine principal 且业务 audience 可用）——**本 Spec 不决定 Auth
      实现方案，Agent Core 不得用 designated admin / fake owner 绕过**。
      Provisioner 自身（svc-auth / service profile）不受 (d) 影响。
AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY
  —— 以上是外部依赖声明，不代表本 Spec 自动授权去改 auth-service；
     Agent Core 仓库/spec 不携带任何 auth-service 代码修改。
在 (a)/(b)/(c)/(d) 任一未就绪时，依赖它的实现路径必须 fail-loud
`external_prerequisite_missing`（结构化错误，指明 (a)/(b)/(c)/(d)），不得降级、
不得绕行（禁 legacy create / CLI stdout / 直连 DB / **绑定 admin 或 fake
human owner**）。v1 路径下 (d) 未就绪时观察到的 401 agent_profile_invalid 按
(d) 证据归类（D.5 Amendment 3 补充），不触发状态 G。
```

---

## Part F — Failure semantics（责任层冻结）

未来实现至少能区分下列 failure mode；**不一定本次新增全部错误码，但责任层必须明确**：

```text
failure mode       责任层                                  现网 manifestation
────────────────────────────────────────────────────────────────────────────
principal_missing  Auth（外部）                             token mint 时 client 无
                                                           principal 绑定
credential_missing Broker gateway（505）/ trusted store     credential_unavailable
                                                           （现值，Part A）
credential_invalid Auth（外部）—— client_credentials 拒绝    /oauth/token 401
                                                           invalid_client
token_mint_failed  Auth（外部）—— endpoint 不可达/5xx/       transport_failure
                   malformed                                 （现值，transport.js:429-434）
scope_denied       Auth（外部）—— 请求的 scope 不在 grant    transport_failure（现被折叠；
                   内 / 400 invalid_scope                   须能区分出授权语义）
service_denied     downstream service（svc-forum 等）        http_4xx 403/401（scope-guard）
```

冻结的**层归属**（不得跨层归因）：

- **credential 存在性** → 只能由 Broker gateway 的 store lookup 回答（505）。
- **能否 mint** → 只能由 auth-service token endpoint 回答（外部）。
- **能否执行业务** → 只能由 downstream service 的授权回答（外部）。

实现要求（预期 collateral，见 Scope）：容器化 gateway/transport 的 error-classification
时，`credential_missing` 与授权拒绝（`scope_denied`）必须落在互不相同的错误码，
不得用一个泛化 `transport_failure` 同时掩盖两类语义。

> Amendment 2 模式注记（S5/D.5）：`credential_invalid` 行的「/oauth/token 401
> invalid_client」是**多因码**（legacy 下含 profile/状态类成因，且 profile 检查先于
> secret 验证）；`scope_denied` 行在 deployed legacy 模式的对应 wire 码含
> **400 invalid_grant（resource 缺失）**与 400 invalid_scope（grant 面为
> client.allowedResources/allowedScopes），v1 模式为 400 invalid_scope/
> invalid_target（grant 面为 MachineAccessGrant）。运行时（非 ensure 上下文）对
> 401 的一律归类为 `credential_invalid` family 而不下钻归因 secret。

---

## Part G — Trusted credential store 写契约（Amendment 1 冻结）

TRUSTED_STORE_AUTHORITY（Part B）的唯一写入契约。**红线：provision Agent A 绝不能
把 Agent B/C 的 credential entry 覆盖掉。**

```text
G.1 目标文件 = AGENT_CORE_CREDENTIALS_FILE（绝对路径，broker 侧同一文件；
    所在目录为 505-private trusted 目录，目录本身不得 group/world 可读）。
G.2 写前读：读现有 store 文档（若存在）。
G.3 校验：按 loadCredentialsStore 同等语义做完整 V1 校验——version===1、
    credentials 为 object、每个 entry 均可 normalize（clientId/clientSecret 非空字符串）。
    malformed / 版本不识别 / 任一 entry 损坏
      → FAIL LOUD（CREDENTIALS_STORE_ERROR 同族结构化错误）
      → MUST NOT overwrite；MUST NOT "顺手修复"。
G.4 保留：所有与目标 agentId 无关的 entry 原样保留（clientId/clientSecret 值
    逐项不变）。
G.5 变更：仅目标 agentId 的 entry（写入 {clientId, clientSecret}，或 revocation 时
    删除）；顶层 shape 恒为 { version: 1, credentials: {...} }。
G.6 写入：在 store 同目录创建 private temp file（同 filesystem ⇒ rename 原子性有保证）；
    temp file 创建时即 mode 0600（O_CREAT|O_EXCL），且必须先有 0600 再写入任何
    secret 内容；owner = trusted CP（进程以 505 运行，或 root 运行后 chown 为
    authsvc:authsvc）。
G.7 提交：fsync(temp) → rename(temp, store)（原子替换）→（SHOULD）fsync(store 目录)。
G.8 并发：deployment-side 单写者 / 串行化（同 trusted 目录内 0600 lock 文件，或
    operator 串行执行）。不建设 distributed lock；Agent Core 运行时保持只读。
```

明令禁止：in-place 部分写；跨 filesystem rename；temp 落 `/tmp`；group/world-readable
temp 或 store；以「修复」名义覆写 malformed store。

---

## Part H — Secret handoff 冻死（Amendment 1）

raw secret **唯一允许**的路径（终点唯一）：

```text
auth-service HTTPS response body
  → trusted provisioning process memory（立即消费，不落任何中间态）
  → credential store writer（Part G）
  → uid505-owned 0600 store 文件
```

除该 store 文件外，raw secret **无任何持久化副本**。禁止清单（任何形态，包括
debug/diagnostic/audit 路径）：

```text
argv                          —— 禁止
env                           —— 禁止
stdout / stderr               —— 禁止（含结构化 JSON 输出）
log（任何级别、任何 sink）      —— 禁止（错误 detail / audit 行只允许 agentId 与
                                clientId；clientId 非 secret）
shell substitution            —— 禁止
curl -u client:secret         —— 禁止（Basic header 只允许在进程内由代码构造）
child process 传递             —— 禁止（含 spawn 参数、pipe 到子进程）
Agent workspace               —— 禁止
agents.json                   —— 禁止（config.js:78-84 已显式拒绝 credential 字段）
DSH prompt                    —— 禁止
Feishu / 任何 IM              —— 禁止
OpenClaw credentialRefs       —— 禁止
```

**验证 token 时**（ensure 的 verification mint / acceptance）：从 trusted store 读入
进程内存 → in-process 构造 Basic header → POST /oauth/token。**不把 secret 拼 argv。**

已知反模式（存在于现状，**不得复制**；本契约即为其替代）：

- auth CLI `machine-admin client rotate` 把 newSecret JSON 打到 stdout
  （auth-service `src/cli/machine-admin.ts:143-152`）。
- 仓库验收脚本曾把 secret 拼进 grep argv
  （`scripts/trusted-credential-broker-v1-verify.mjs:394`）。
- V2 验收期形状侦察脚本曾打印 secret 前 40 字符前缀
  （`docs/reports/trusted-credential-505-final-acceptance-v2.md` 运维注记）。

同一 uid 攻击面约束沿用 `same-uid-router-secret-boundary-audit-v1` 硬前提（E1/E2
实证同 uid 经 `ps -E` / `ps -o command=` 全量可读 env/argv）：credential 永不经
env/argv 交付；store 及交付文件 505-owned 0600；Router/工具可执行代码面不得 502 可写。

---

## Part I — Rotation 语义（Amendment 1）

当前 Auth rotation 事实（源码核实，A.4 S4）：

```text
rotate → 旧 secret 立即失效（单 secretHash 覆盖）→ 无 dual-secret grace
```

冻结流程（状态 E / G 共用；亦即运维 rotation runbook 的语义）：

```text
rotate existing client（SAME clientId —— 由 deterministic ensure/external_ref 找回）
  → 新 secret 经 HTTPS response body 进入进程内存（Part H）
  → atomic RMW store（Part G 契约）
  → verification mint（D.5 解释表）
```

- **接受**：rotate 与 store 更新之间存在很短 failure window——窗口内该 agent 的
  Broker 调用以旧 secret mint → 401 invalid_client → 归入 Part F 的
  `credential_invalid` 语义；store per-call re-read ⇒ 更新后下一调用即恢复，无重启。
- V1 **不建设**：zero-downtime rotation、dual-secret system、rotation orchestration
  service。
- **可以** operator-serialized / maintenance-aware（低峰执行、单写者串行，Part G.8）。
- 外部依赖：HTTPS rotation seam 当前缺失（Part E.4(b)）；在其就绪前，状态 E/G 的
  恢复路径与运维 rotation 只能停留在「外部 prerequisite 未满足」的 fail-loud 报告，
  **不得**退回 CLI-stdout 方式取 secret。

---

## Part J — Revocation 语义（Amendment 1）

冻结 **fail-closed 顺序**（顺序本身即安全属性）：

```text
1) remove target store entry（Part G 契约）
   → 本地 Broker 对该 agent 立即 credential_unavailable（无需重启；store 重读）
2) revoke Auth client（外部动作；auth-service revokeClient 为幂等）
```

- 若步骤 (2) 失败：**本地 Agent 仍然 fail-closed**（步骤 (1) 已生效）；记录 pending
  external action；**绝不**把 store entry 恢复回去。
- 不建设 revocation orchestration framework。
- Agent Definition `disable`/remove 是正交的既有 seam（D.6）；三方（Definition /
  store / Auth client）各自独立失效，store-entry 移除永远先行。

---

## Security boundaries（明确禁止）

```text
Forum moderator secret                       —— 禁止
shared system bearer token                   —— 禁止
secret 写入 Agent workspace                  —— 禁止
secret 出现在 DSH prompt                     —— 禁止
hardcoded credential                         —— 禁止
OpenClaw credential fallback                 —— 禁止
human Feishu credential 复用为 Agent credential —— 禁止
Kernel credential store                      —— 禁止（KERNEL_CHANGE = NONE）
secret 经 env / argv / stdout / log / child  —— 禁止（Part H 冻结清单）
```

child Agent **尽量不能读取 raw Broker credential**（冻结目标：与 V2 验收一致的
`CHILD_SECRET_ENV=ABSENT / CHILD_SECRET_FS=ABSENT / A_READ_CREDENTIAL_STORE=DENIED`）。
同一 uid 攻击面约束沿用 `same-uid-router-secret-boundary-audit-v1` 硬前提：
credential 永不经 env/argv 交付、store 505-owned 0600、不允许 child 写 Router 代码面。

---

## Explicit non-goals（V1 不做）

```text
不处理：Binding workspace / Session cwd / Feishu requireMention / reaction/typing /
cards / Scheduler / Forum feature design / Auth redesign / mTLS / TPM / sidecar /
Policy Engine / Kernel
```

- 不做完整 IAM 平台（role/group/permission 管理、admin UI、审计平台）。
- 不做 IAM platform / Policy Engine / sidecar / mTLS / TPM / per-Agent OS user /
  OpenClaw fallback / Router credential manager（Amendment 1 重申）。
- 不在 JWT 里塞业务角色（Domain Owner、Forum role 等保持外部业务系统治理）。
- 不把 Broker 升级成新 Policy Engine——Broker 维持 authorized transport / capability
  seam（Part F 的 error-classification 除外，`BROKER_CHANGE_REQUIRED = YES_MINIMAL`）。
- 不复制 OpenClaw runtime architecture（其 per-peer workspace / per-agent
  auth-profiles 模型只作参考，不移植）。

## Scope（未来 Implementation 允许做什么）

允许（优先最小实现，deployment/ops 面 + 最小 broker collateral）：

1. **Provisioning tooling（deployment-side）**：实现 Part D 冻结状态机的
   `ensureAgentCredential(agentId)`（A–G + D.5 verification mint），经 S1/S2 幂等
   seam，按 Part G 契约写 store，按 Part H 交付 secret；含 backfill 模式（canary
   第一优先场景）与幂等断言。外部 prerequisite（E.4 (a)/(b)/(c)）未就绪时，依赖它的
   分支必须 fail-loud 报 `external_prerequisite_missing` 类结构化错误，不得降级。
2. **最小 Broker error-classification**（Part F，`BROKER_CHANGE_REQUIRED = YES_MINIMAL`）：
   只允许把失败分为三层——credential unavailable / invalid client；authorization
   invalid_scope / invalid_resource；downstream transport/service failure。附带
   transport/gateway 测试。**禁止** Broker 创建 credential / auto-grant / IAM
   orchestration / Policy Engine。
3. **Rotation / revocation runbook 或最小 helper**（Part I / Part J 语义；store 更新
   走 Part G，secret 走 Part H）。
4. **Acceptance driver 的扩展面**：为未来 canary 提供可复现的验收路径（Acceptance
   Criteria 分层）。

**本 Spec 本轮不实施以上任何一项**——它只冻结范围，供后续 Implementation（在
`status: accepted` 之后）执行。

## Non-goals / Frozen boundaries（实现时不得越过）

```text
RUNTIME_CHANGE = NONE
ROUTER_CHANGE = NONE        （Router 已按 ACTUAL proc.agentId 分发，身份决策不变；
                              Router 不负责 credential）
AUTH_CHANGE    = NO_IN_REPO （auth-service 是本仓库外 authority；本 Spec 不授权改它；
                              外部依赖见 Part E.4 EXTERNAL_AUTH_DEPENDENCY，
                              AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY）
KERNEL_CHANGE  = NONE
```

- 不引入 child-held-credential；不把 secret 注入 child env/workspace。
- 不新增一卡通映射表 / 新 Auth / 新 principal registry（auth-service 仍是唯一权威）。
- 不自动授予 capability；grant 决策留在 auth-service / 业务侧。
- 不改 Binding / Session / workspace 模型（`AGENT_CORE_BINDING_WORKSPACE_V1` 若被
  accepted，与本 Spec 正交）。
- Implementation Agent **不得自行决定 identity mapping**（Part C.4 已冻结）。

## Alternatives considered

- **child-held credential（Process Identity 方案 B 早期形态）**：否决——`identity-auth.md`
  已论证单进程 + 动态插件下 A 可伪造 B；V2 已冻结 trusted-gateway（505）模型并验收
  PASS。本 Spec 保持 gateway 模型，**不回退**。
- **人力逐条手工配 store entry 作为长期机制**：否决——canary 的
  `credential_unavailable` 正由此产生；V1 需要确定性 provisioning。
- **把 credential 塞进 agents.json（Agent Definition）**：否决——config 显式禁止
  credential 字段（`config.js:78-84`），且该文件不能被 502 child 相关路径持有 secret
  语义；解耦是 frozen architecture。
- **在 Router 运行时自动创建 principal/client（self-provisioning at spawn）**：否决——
  运行时创建需要持有 auth-service 管理员权限，与「child 不可见 secret / 505 只读
  store」冲突；provisioning 必须是 deployment-side。
- **OpenClaw credential 直接 fallback 给 Agent Core agent**：否决——身份键族不同
  （`stock-agent` vs `agt_*`），且违反最小权限与命名空间隔离。
- **一卡通字符串复用（agt_* == clientId == principal id）**：否决——四族身份不要求
  相等（Part C）；强行相等会把 auth-service 的键设计绑死在 Agent Core 内部形状上。
- **（Amendment 1）用 legacy `machine-admin client create` 兜底 ensure/重试**：否决——
  非幂等（每次 INSERT 新 client，A.4 S3），会产生重复 client 与 grant 捆绑的 legacy
  语义；正常 ensure 必须走 S1/S2。
- **（Amendment 1）用 machine-admin CLI stdout 捕获的方式获取 rotate 后的 secret**：
  否决——违反 Part H（child process + stdout 双禁止）；等待正式 rotation seam
  （E.4(b)）。
- **（Amendment 1）store 写入用「重建整个文件」以外的任何部分写 / 跨目录 temp**：
  否决——Part G 冻结 validate-preserve-atomic 契约。
- **（Amendment 2，Fix 2）方案 B：保持 `principal_type='service'` + 等 audience
  registry 支持 service**：否决——源码核实（S7）业务 audience（svc-forum/
  svc-workflow/adc-v2）现契约只接受 `agent`，svc-okr 接受 user|agent；legacy 路径
  对非 agent profile 直接 401（S5 L4）。选 B 意味着 `BUSINESS_AUDIENCE_ACCEPTS_
  SERVICE_PRINCIPAL` 成为 named external prerequisite，且在其完成前 business token
  mint = NOT IMPLEMENTABLE——把 canary 主目标整体押在 auth registry 变更上，属
  更大的 IAM 面改动；方案 A（agent profile）以最小 auth 侧变更满足现契约。
  （Amendment 3 注：方案 A 的 owner 部分 per Ruling 改为 NULL/ABSENT——「零
  auth 侧变更」不再成立于 v1 路径，差额即外部前置 (d)；principal_type='agent'
  维持。）
- **（Amendment 2，Fix 2；Amendment 3 扩围）为过 token 检查绑定 human owner**：
  否决——**新建 fake user 与「复用 designated admin owner 绑定为 Agent owner」
  均禁止**（`AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1`：owner_user_id 不是 Agent
  Core 产品模型的一部分，Agent 是独立机器身份）。Amendment 2 曾冻结复用
  designated admin owner，Amendment 3 已将其取代为 `owner_user_id = NULL/ABSENT`；
  v1 路径的 owner 要求由外部前置 (d) 解决，不得用 owner 绕过。

## Acceptance Criteria（Amendment 2 重写 — 分层 + 可达性标注）

后续 Implementation（在 accepted Spec 之下）按层验收。**Amendment 2 删除
Amendment 1 的「L1 不依赖任何外部工作、必须全绿」表述**——外部前置
（E.4 (a) grant 供给 / (b) rotation seam / (c) S1/S2 可调用性 /
(d) 无 human owner 支持）尚未存在，
每项验收显式标注当前可达性；外部前置未就绪时对应路径必须 fail-loud
`external_prerequisite_missing`（该 fail-loud 行为本身**是**可验收项）。

**可达性图例**：
`NOW` = 纯 in-repo，实现后即可执行；`NEEDS(c)` = 需 contract mode v1 生效（或
等价 RS256 svc-auth mint 路径）；`NEEDS(c)+(b)` = 另需 rotation seam；
`NEEDS(c)+(a)` = 另需业务 grant/resource 供给；`NEEDS(c)+(d)` = 另需 Auth 支持
无 human owner 的 Agent/machine identity（Amendment 3）。
**路径注记（Amendment 3）**：(d) 只挡 v1 路径的 token mint（ownerless agent 在
legacy 路径不查 owner、S1 创建无障碍）；若 (c) 以「保持 legacy 业务路径 +
仅为管理面提供 RS256 svc-auth mint」方式满足，则带 (d) 的项退化为不带 (d)。
按保守（v1 全量生效）口径标注。

**L1 — Credential V1 自身验收：**

1. `NEEDS(c)` `formal Agent exists → ensure`：Auth principal 存在（deterministic
   external_ref，Part C.4）+ machine client 存在 + trusted store entry 存在
   （keyed by agentId）。
2. `NEEDS(c)` `repeated ensure`（≥3 次，含并发/交错执行）：**SAME** principal id、
   **SAME** clientId；Auth 侧不存在同 agentCore external_ref 之外的重复
   client/principal。
3. `NOW`（store 契约单元级）/ `NEEDS(c)`（端到端）`trusted store`：0600、
   505-owned；G1–G8 契约可对合成 store 单元验证；端到端为**预置 unrelated
   canary entry 后 ensure 另一 agent，unrelated entry 逐字节不变**（Part G 红线）。
4. `NOW`（部署后静态复测）/ `NEEDS(c)`（完整链路）`child` → cannot read raw
   secret：`CHILD_SECRET_ENV=ABSENT / CHILD_SECRET_FS=ABSENT /
   A_READ_CREDENTIAL_STORE=DENIED`（V2 同口径）。
5. `NEEDS(c)` `Broker` → `loadCredentialFor(agentId)` 成功。
6. `NEEDS(c)` `/oauth/token → actually attempted`（`AUTH_TOKEN_MINT_ATTEMPTED =
   YES`——由 Broker 真实调用或 L1 verification mint 证明；区别于 Part A 的 NO）。
   Amendment 3 注：attempt 本身不受 (d) 限制；但 v1 路径下 (d) 未就绪时结果
   **确定性地**为 401 agent_profile_invalid（(d) 证据，D.5），secret 有效性
   证明在 v1 路径需 `NEEDS(c)+(d)`（legacy 业务路径环境仅需 (c)）。
7. `NEEDS(c)+(b)` **Missing-store recovery（状态 E）**：手工删除目标 store
   entry、保留 Auth client → ensure → **recover SAME client**（clientId 不变）→
   rotate secret → store 恢复 → verification mint 通过 → **no duplicate client**。
   在 (b) 就绪前：该路径必须 fail-loud `external_prerequisite_missing(b)` 且
   Auth/store 无任何变更（此降级行为 `NOW` 可验收）。
8. `NOW` **状态 A 负例**：不存在的 agentId → STRUCTURED_REJECT；Auth 侧与 store
   均无新建行（无 orphan Auth identity）——纯工具侧行为，不触 Auth。
9. `NOW` **store 保护负例**：预置 malformed store → ensure FAIL LOUD 且文件内容
   不变（MUST NOT overwrite）——纯工具侧行为。
10. `NOW` **外部前置降级负例**：(a)/(b)/(c)/(d) 任一未就绪时，依赖路径
    fail-loud `external_prerequisite_missing` 且不产生部分副作用（无 Auth
    调用、无 store 写入；状态 A/G 类纯本地分支除外）；v1 路径 (d) 未就绪时
    观察到的 401 agent_profile_invalid 必须归类为 (d) 证据（不 rotate、
    不建平行身份、不绑 owner）。

**L2 — Grant negative（credential ≠ grant）：**

11. `NEEDS(c)+(d)`（保守口径；legacy 业务路径环境为 `NEEDS(c)`）credential
    exists + requested grant absent → **authorization failure**
    （mode-aware：legacy = 400 invalid_grant/invalid_scope；v1 = 400
    invalid_scope/invalid_target——D.5），**≠** `credential_unavailable`。
    （零 grant 新 client 的 verification mint 400 即为最小证据。）
    Amendment 3 注：v1 路径下 (d) 未就绪时 mint 止步于 profile 401（(d) 证据），
    到不了 grant 层 ⇒ grant-negative 信号在 v1 路径需 (d)。
    Broker wire 层的三层错误码区分（Part F）本身 `NOW` 可实现并单元测试
    （构造 transport 响应），端到端信号需 (c)（+(d) 若 v1 路径）。

**L3 — Forum positive（条件验收）：**

12. `NEEDS(c)+(a)+(d)`（保守口径；legacy 业务路径环境为 `NEEDS(c)+(a)`）
    **only if** required grant already exists through a **named external
    prerequisite**（E.4(a)，mode-aware grant 面配置记录在案）→
    Broker → token → `forum_list_threads` 到达 svc-forum 并返回业务结果。
    在 (a)（及 v1 路径下 (d)）就绪前：不得以任何替代手段（见下）伪造绿。

**不接受**（任何层、任何前置状态下）：fake credential、mock-only Broker、
manual bearer、OpenClaw fallback、legacy machine-admin create 兜底、CLI stdout
取 secret、直连 auth DB。

## Risks

- **provisioning 误把 secret 落进 child 可读位置** → Part H 冻结唯一路径 + 禁止清单；
  写入面为 505-private store、0600、值直接来自 auth-service（沿用 same-uid audit
  硬前提）。
- **provision Agent A 覆盖 Agent B/C entry** → Part G validate-preserve-atomic 契约
  + L1-3 验收。
- **错误码折叠重演（scope_denied 被掩盖为 transport_failure）** → Part F 冻结层归属与
  可区分要求，实现附带测试。
- **自动 grant 滑入 provisioning** → Part E 冻结 credential ≠ grant，实现必须单列；
  E.4 诚实记录 grant seam 缺失，禁止顺手建设 grant platform。
- **运行时退化回 child-held-credential** → Security boundaries + Frozen boundaries
  显式禁止回退。
- **身份族乱接（误以为字符串相等即绑定）** → Part C 冻结四族映射与 provision-time
  一次性建立，运行时零换算；C.4 冻结 deterministic external_ref，实现不得自定 mapping。
- **恢复路径退化为重复建 client**（状态 E/G）→ Part D 显式 FORBIDDEN 第二 client/
  principal；L1-7 验收 same-client 恢复。
- **外部 prerequisite 缺失被静默绕过**（rotation/grant seam 未就绪时借道 CLI stdout
  或 legacy create）→ Scope-1 要求 fail-loud `external_prerequisite_missing`；
  Alternatives 重申否决。
- **（Amendment 2）401 多因被误读为 secret invalid**（legacy 下 profile 检查先于
  secret 验证）→ S5 LEGACY_401_SEMANTICS + D.5 mode-aware 表冻结；仅在 ensure
  上下文排除其他成因后才可归因 secret；实现不得自行猜测错误含义。
- **（Amendment 2；Amendment 3 改写）owner 相关错误处理**：v1 路径 (d) 未就绪
  时把 401 agent_profile_invalid 误归因 secret invalid（误触发状态 G rotate）或
  反向回退绑定 admin/fake owner → C.4 冻结 OWNER_USER_ID = NULL/ABSENT +
  FAKE_ADMIN_OWNER_FORBIDDEN = YES；D.5/状态 G/E.4/验收 item 10 冻结该 401 归类
  为 (d) 证据；Ruling 禁止以 owner 绕过。
- **（Amendment 2）在 contract mode v0 下硬跑 ensure**（S1/S2 不可达）→ E.4(c) +
  Acceptance item 10 冻结 fail-loud 降级为可验收行为；禁止直连 DB / in-process
  直调 auth service 层（raw secret 只存在于 HTTPS response body，直连亦不可得）。

## Related Evidence

- Governing investigation（PASS）：`docs/investigations/test-agent-feishu-product-semantics-v1.md`
  （`FORUM_CREDENTIAL_FAILURE_LAYER = BROKER_GATEWAY_CREDENTIAL_RESOLUTION`；
  `AUTH_TOKEN_MINT_ATTEMPTED = NO`；OpenClaw 身份 vs Agent Core `agt_*` 身份 gap）。
- Trusted gateway 架构（已验收）：`docs/reports/trusted-credential-broker-integration-v1.md`、
  `docs/reports/trusted-credential-505-final-acceptance-v2.md`（505/502 边界、
  CHILD_SECRET_* ABSENT、store 读取 DENIED）。
- 信任边界调查：`docs/investigations/identity-auth.md`（方案 B 冻结）、
  `docs/investigations/same-uid-router-secret-boundary-audit-v1.md`（env/argv 禁止；
  未跟踪草稿，结论已由 V2 验收与 ps 实证支撑）。
- 外部 auth-service 源码核实（2026-08-17，Part A.4 S1–S6）：
  `src/lib/oauth/v1/idempotent.ts`、`src/routes/idempotent.ts`、
  `src/middleware/v1-management-auth.ts`、`src/lib/oauth/service.ts`、
  `src/lib/oauth/token-issuance.ts`、`src/cli/machine-admin.ts`、
  `prisma/schema.prisma`、`docs/audits/AGENT_IDENTITY_DEPLOYMENT_RECONCILIATION_V1_REPORT.md`。
- Frozen 模型：`docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`（D-002：Agent 拥有
  credential，principal/credential/grant → Auth——本 Spec 使其可操作化，**不冲突、
  不 disposition**）。
- 治理：`docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`（Spec 生命周期：
  proposed → accepted；本 Spec 当前 `status: proposed`）。

---

## Final Output（Amendment 3 — Owner Ruling 修订）

```text
AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_OWNER_RULING_AMENDMENT = PASS

BASE_HEAD = e6aa7ad
HEAD = docs/agent-core-credential-provisioning-v1-spec（同一 Spec 分支原地 Amendment 3，不 merge）

RULING = AGENT_PRINCIPAL_HUMAN_OWNER_RULING_V1（Owner 决定；owner_user_id 不是
    Agent Core 产品模型的一部分，不决定 Agent/Workspace/Domain ownership、
    Binding、lifecycle authority；未来 Auth 解法 A（agent owner optional/null）
    或 B（无 human owner 的 machine principal + 业务 audience 可用）由 Auth
    决定，本 Spec 不决定 Auth 实现方案）

HUMAN_OWNER_REQUIRED = NO
OWNER_USER_ID_MODEL = NULL_OR_ABSENT（ensure 调用体不携带 owner_user_id；
    digest = (agent, agt_*) 恒稳定）
FAKE_ADMIN_OWNER_FORBIDDEN = YES（新建 user 与复用 designated admin 绑定为
    Agent owner 均禁止；Amendment 2 的 designated-admin-owner 冻结已删除）

AUTH_NO_HUMAN_OWNER_SUPPORT =
    NAMED_EXTERNAL_PREREQUISITE (d)。源码核实支持矩阵：S1 创建 ownerless agent
    已允许（ownerUserId ?? null；DB nullable）；legacy 业务 mint 不查 owner
    （L4 只查 type+agentId）；v1 路径 assertPrincipalProfile 强制 agent 必须有
    ownerUserId（401 agent_profile_invalid，先于 secret 验证）⇒ (d) 恰好只挡
    v1 路径 token mint；provisioner 自身（svc-auth/service profile）不受 (d)。
    外部前置全表：(a) grant mutation/供给 seam（mode-aware）；(b) HTTPS secret
    rotation seam；(c) 管理面 RS256 svc-auth mint / v1 contract 可调用条件；
    (d) 本条。任一未就绪 ⇒ fail-loud external_prerequisite_missing，不得绕行。

L1_EXECUTABILITY =
    SPLIT（不声称现在全绿）：L1-core（ensure 成功[ownerless agent 创建无障碍]/
    幂等同身份/store 0600+505+unrelated 保留/child 隔离/loadCredentialFor）=
    NEEDS(c)；mint attempted = NEEDS(c)（attempt 本身不受 (d) 限制；v1 路径下
    结果确定性为 401 agent_profile_invalid = (d) 证据，secret 有效性证明在 v1
    路径 NEEDS(c)+(d)，legacy 业务路径环境仅需 (c)）；L1-recovery（状态 E
    same-client 恢复）= NEEDS(c)+(b)（就绪前 fail-loud，降级行为 NOW 可验收）；
    纯工具侧负例（状态 A 无 orphan / malformed store 不覆写 / 前置缺失降级
    不产副作用 / 401 agent_profile_invalid 归类 (d) 证据不 rotate）= NOW。
L2_EXECUTABILITY =
    保守口径（v1 业务路径）= NEEDS(c)+(d)：v1 下 (d) 未就绪时 mint 止步于
    profile 401，到不了 grant 层；legacy 业务路径环境 = NEEDS(c)（零 grant 即
    可观察 authorization failure ≠ credential_unavailable）。Broker wire 三层
    错误码区分（Part F）= NOW 可实现并单元测试。
L3_EXECUTABILITY =
    保守口径（v1 业务路径）= NEEDS(c)+(a)+(d)；legacy 业务路径环境 =
    NEEDS(c)+(a)。条件验收：named external grant prerequisite 记录在案后才可
    执行；就绪前不得以 fake credential / mock-only Broker / manual bearer /
    OpenClaw fallback / legacy create / CLI stdout / 直连 DB / 绑定 admin 或
    fake owner 任何替代手段伪造绿。

ARCHITECTURE_DIRECTION = KEEP
ROUTER_CHANGE = NONE
RUNTIME_CHANGE = NONE
KERNEL_CHANGE = NONE

UNCHANGED_FROZEN_ITEMS（维持不变）=
    deterministic external_ref（agentcore:v1:principal|client:<agentId>）·
    principal_type='agent' + agent_id=agt_*（Amendment 2 维持）· 幂等 S1/S2
    ensure（禁 legacy create、禁 expected_* claim）· no duplicate identities ·
    trusted-store 写契约 G1–G8 · single-writer · secret 仅 HTTPS body →
    memory → 0600 store（无 argv/env/stdout/log）· same-client rotation 语义 ·
    revocation fail-closed 顺序 · credential ≠ grant · BROKER_CHANGE =
    YES_MINIMAL

SPEC_STATUS = proposed（本轮 SPEC AMENDMENT ONLY，未实施、未 merge）
READY_FOR_FOCUSED_RE_REVIEW = YES（重点复核：C.4 owner 冻结 NULL/ABSENT 与
    Ruling 一致性、(d) 支持矩阵（S1 创建/legacy L4/v1 assertPrincipalProfile）、
    状态 G 与 D.5 的 401 归因修正、Acceptance (a)-(d) 可达性重算）
```
