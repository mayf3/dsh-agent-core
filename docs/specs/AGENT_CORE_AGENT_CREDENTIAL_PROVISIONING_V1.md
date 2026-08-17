---
spec_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
status: proposed
---

# Agent Core Agent Credential Provisioning V1

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结，不实现）** · 初版：2026-08-17 ·
> Amendment 1（review FIX round）：2026-08-17，base reviewed HEAD `104555f`
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

**S5 — token endpoint 校验顺序（决定 verification mint 的解释表）**

```text
POST /oauth/token（client_credentials）  (src/lib/oauth/token-issuance.ts:60-155)
  1) client 查找/状态 → 401 invalid_client
  2) secret 验证     → 401 invalid_client
  3) scope 验证      → 400 invalid_scope
⇒ 401 invalid_client = secret 无效；400 invalid_scope = secret 已通过认证、
  仅缺该 scope 的 grant。零 grant 的新 client 也能据此区分
  「credential 有效」与「credential 失效」（Part D verification mint / Part E）。
```

**S6 — external_ref namespace 惯例**

生产已有 colon-namespace 先例 `openclaw:agent:ceo-agent`（auth 侧 opaque，
见 auth-service `docs/audits/AGENT_IDENTITY_DEPLOYMENT_RECONCILIATION_V1_REPORT.md:61`）。
Part C.4 冻结的 `agentcore:v1:*` 前缀与该惯例同构（system:version:kind:key），
并多出 version 段为未来演化留位。

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
4. **ensure 调用体冻结**（Part D 状态机的唯一入参面）：

```text
POST /api/v1/principals body = {
  external_ref: principalExternalRef(agentId),
  principal_type: "service",            // 冻结为 service，见下
  display_name: <Agent Definition display name 或 agentId>   // 仅 cosmetic，不参与匹配/digest
}
POST /api/v1/clients body = {
  external_ref: clientExternalRef(agentId),
  principal_id: <S1 返回的 principal id>
}
```

   - `principal_type` 冻结为 `"service"`：`"agent"` 类型要求 `agent_id` + `owner_user_id`
     （human-owner 概念，Agent Core 不拥有），且会把 `agt_*` 写入 auth 的 legacy
     `agent_id` 列（与 S3 legacy machine-admin 路径共享的 namespace）。`"service"` 使
     requestDigest 恒为 `(service, null, null)`，ensure 永不触发 digest 409。
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
     且 verification mint 证明 secret 有效（200，或 400 invalid_scope —— 见 D.5 解释表）
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
     401 invalid_client（secret 失效）
     → rotate SAME client（同 E 的 rotation seam）→ 新 secret 进内存 →
       atomic rewrite store（Part G）→ 再次 verification mint。
     → FORBIDDEN：创建第二个 client。
```

### D.5 Verification mint（冻结解释表）

ensure 的 validity 检查 = 一次 `POST /oauth/token`（grant_type=client_credentials，
resource/scope 取自已部署 capability manifests 的任一 HTTP 组合；secret 从 trusted
store 读入进程内存构造 Basic header，Part H）。**依据 S5 的校验顺序**冻结解释：

```text
HTTP 200 + access_token      → credential 有效（且覆盖所请求 scope）
HTTP 400 invalid_scope       → credential 有效（client 已通过 secret 认证，仅缺该
                               scope 的 grant）——credential 层 PASS；grant 缺口按
                               Part E 记录，不触发 rotate
HTTP 401 invalid_client      → credential 无效 → 状态 G
网络不可达 / 5xx / malformed  → INCONCLUSIVE：结构化报错退出；不得当作 invalid
                               触发 rotate，也不得当作 valid 记 NO-OP
```

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

### E.4 Grant mutation surface 诚实记录（Amendment 1，源码核实）

- V1 幂等 client 创建（S2）固定 `allowedResources=[] / allowedScopes=[]`——
  **新建 client 不自动拥有 `forum.read` / `forum.write` / … 任何 grant**。
- 业务权限的真实载体是 `MachineAccessGrant`（`(machineClientId, audienceId)` 主键 +
  `scopes[]`，auth-service `prisma/schema.prisma:272-284`）。
- **现状：不存在对 existing client 的正式 grant mutation HTTP/CLI seam**——仅若干
  一次性脚本直连 DB 操作（如 auth-service
  `scripts/provision-domain-owner-machine-clients.ts:445-469`）。即：

```text
formal existing-client grant mutation seam = 当前缺失 / 不完整
```

- 本 Spec **禁止**因此顺手建设：Auth grant platform、auto-grant、Policy Engine。
  grant 配置是 **named external prerequisite**（外部运营商/外部工具动作）。

```text
AGENT_CORE_AUTH_CODE_CHANGE = NONE
EXTERNAL_AUTH_DEPENDENCY =
  (a) existing-client grant mutation seam currently missing/incomplete
      （Forum 正向验收 L3 的前置）
  (b) machine-client secret 的 HTTPS rotation seam currently missing
      （rotation 仅 machine-admin CLI 且 newSecret 走 stdout——与 Part H 冲突；
       状态 E / G 恢复路径与 Part I 依赖该 seam）
AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY
  —— 以上是外部依赖声明，不代表本 Spec 自动授权去改 auth-service；
     Agent Core 仓库/spec 不携带任何 auth-service 代码修改。
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
   第一优先场景）与幂等断言。外部 prerequisite（E.4 (a)/(b)）未就绪时，依赖它的
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

## Acceptance Criteria（Amendment 1 重写 — 分层）

后续 Implementation（在 accepted Spec 之下）按层验收；**L1 不依赖任何 grant 工作，
必须全绿**：

**L1 — Credential V1 自身验收：**

1. `formal Agent exists → ensure`：Auth principal 存在（deterministic external_ref，
   Part C.4）+ machine client 存在 + trusted store entry 存在（keyed by agentId）。
2. `repeated ensure`（≥3 次，含并发/交错执行）：**SAME** principal id、**SAME**
   clientId；Auth 侧不存在同 agentCore external_ref 之外的重复 client/principal。
3. `trusted store`：0600、505-owned；**预置 unrelated canary entry 后 ensure 另一
   agent，unrelated entry 逐字节不变**（Part G 红线）。
4. `child` → cannot read raw secret：`CHILD_SECRET_ENV=ABSENT /
   CHILD_SECRET_FS=ABSENT / A_READ_CREDENTIAL_STORE=DENIED`（V2 同口径）。
5. `Broker` → `loadCredentialFor(agentId)` 成功。
6. `/oauth/token → actually attempted`（`AUTH_TOKEN_MINT_ATTEMPTED = YES`——由
   Broker 真实调用或 L1 verification mint 证明；区别于 Part A 的 NO）。
7. **Missing-store recovery（状态 E）**：手工删除目标 store entry、保留 Auth client
   → ensure → **recover SAME client**（clientId 不变）→ rotate secret → store 恢复
   → verification mint 通过 → **no duplicate client**。
8. **状态 A 负例**：不存在的 agentId → STRUCTURED_REJECT；Auth 侧与 store 均无新建行
   （无 orphan Auth identity）。
9. **store 保护负例**：预置 malformed store → ensure FAIL LOUD 且文件内容不变
   （MUST NOT overwrite）。

**L2 — Grant negative（credential ≠ grant）：**

10. credential exists + requested grant absent → **authorization failure**
    （invalid_scope / scope_denied / access_denied 语义），**≠** `credential_unavailable`。
    （零 grant 新 client 的 verification mint 400 invalid_scope 即为最小证据，D.5。）

**L3 — Forum positive（条件验收）：**

11. **only if** required grant already exists through a **named external prerequisite**
    （Part E.4(a)，外部 grant 配置记录在案）→ Broker → token →
    `forum_list_threads` 到达 svc-forum 并返回业务结果。

**不接受**：fake credential、mock-only Broker、manual bearer、OpenClaw fallback。

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

## Final Output

```text
AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_SPEC_AMENDMENT = PASS

BASE_REVIEWED_HEAD = 104555f
HEAD = docs/agent-core-credential-provisioning-v1-spec（同一 Spec 分支原地 Amendment，不 merge）

ARCHITECTURE_DIRECTION = KEEP（Part B authority 模型 / Part C 四族身份 / trusted 505
    gateway 全部维持；本轮零架构重设计）

PRINCIPAL_ENSURE_SEAM = POST /api/v1/principals → createOrGetPrincipal
    （external_ref DB-UNIQUE 幂等，201/200 + created 标志；principal_type='service'
     冻结；opaque external_ref；RS256 svc-auth + auth.identity.provision）
CLIENT_ENSURE_SEAM = POST /api/v1/clients → createOrGetClient
    （external_ref 幂等；principal 须 active；secret 仅 created=true 时随 HTTPS
     response body 返回一次；新 client allowedResources/allowedScopes=[]；
     正常 ensure 禁用 legacy machine-admin client create 与 expected_* claim）
DETERMINISTIC_EXTERNAL_REF =
    principalExternalRef(agentId) = "agentcore:v1:principal:<agentId>"
    clientExternalRef(agentId)    = "agentcore:v1:client:<agentId>"
    （deterministic / stable / unique / recoverable from agentId；与生产
     openclaw:agent:<name> colon-namespace 惯例同构；实现不得自定 mapping）

ENSURE_STATE_MACHINE = A Agent Definition 缺失 → STRUCTURED_REJECT（无 orphan Auth
    identity）→ B/C createOrGetPrincipal → createOrGetClient → capture secret(HTTPS
    body→内存) → store write → verification mint → D 幂等 NO-OP → E store entry
    missing：recover SAME client（rotate，FORBIDDEN 第二 client/principal）→
    F Auth client missing/revoked/split-brain：fail-loud + 冻结 operator recovery
    （不静默建平行身份）→ G secret invalid：rotate SAME client → atomic rewrite →
    verify；verification mint 解释表：200=valid / 400 invalid_scope=credential 有效
    但 grant 缺失 / 401 invalid_client=invalid / 5xx=INCONCLUSIVE
MISSING_STORE_RECOVERY = 状态 E：raw secret Auth 侧不可读回（仅 secretHash）⇒
    rotate SAME client secret → memory capture → atomic store restore →
    verification mint；no duplicate client

STORE_WRITE_CONTRACT = read existing → validate complete V1（malformed ⇒ FAIL LOUD，
    MUST NOT overwrite）→ preserve every unrelated entry → change only target
    agentId → same-dir private temp（mode 0600 先于任何 secret 内容；owner=trusted
    CP/uid505）→ fsync → atomic rename →（SHOULD）fsync dir
STORE_CONCURRENCY_MODEL = deployment-side 单写者 / 串行化（trusted-dir 0600 lock 或
    operator 串行）；无 distributed lock；Agent Core 运行时保持只读

SECRET_HANDOFF_PATH = auth HTTPS response body → trusted provisioning process memory
    → store writer → uid505-owned 0600 store（唯一持久终点）；verification mint 从
    store 读入内存、in-process 构造 Basic header
SECRET_ARGV_EXPOSURE = FORBIDDEN
SECRET_LOG_EXPOSURE = FORBIDDEN（含 stdout/stderr/audit/错误 detail；日志仅 agentId
    与 clientId）

ROTATION_SEMANTICS = rotate SAME client → capture in memory → atomic RMW store →
    mint verify；Auth 侧旧 secret 立即失效（无 dual-secret grace）；接受 rotate→store
    更新间的短 failure window（credential_invalid 语义，下一调用恢复）；V1 不建
    zero-downtime / dual-secret / orchestration；可 operator-serialized
REVOCATION_SEMANTICS = 先移除 store entry（本地立即 credential_unavailable，无重启）
    → 再 revoke Auth client；revoke 失败本地仍 fail-closed、不回滚 store entry；
    不建 revocation orchestration framework

CREDENTIAL_VS_GRANT_SEPARATION = 维持并强化：credential existence ≠ service grant；
    无 grant ⇒ authorization failure ≠ credential_unavailable；verification mint
    400 invalid_scope 为 credential 有效 + grant 缺失的可区分证据
GRANT_MUTATION_SURFACE = 无正式 seam——V1 幂等建 client 不带 grant
    （allowedResources/allowedScopes=[]）；MachineAccessGrant（(client,audience) PK +
    scopes[]）仅一次性脚本直连 DB 可变，无 HTTP/CLI 管理面
EXTERNAL_AUTH_DEPENDENCY = (a) existing-client grant mutation seam currently
    missing/incomplete；(b) machine-client secret HTTPS rotation seam currently
    missing（仅 machine-admin CLI 且 newSecret 走 stdout，与 Part H 冲突）
AUTH_CHANGE_REQUIRED = EXTERNAL_ONLY（外部依赖声明；不授权本 repo/spec 修改
    auth-service；Agent Core 侧不携带 auth-service 代码变更）

BROKER_CHANGE_SCOPE = YES_MINIMAL：仅三层失败可区分（credential unavailable /
    invalid client ‖ authorization invalid_scope / invalid_resource ‖ downstream
    transport/service failure）；禁止 Broker 创建 credential / auto-grant / IAM
    orchestration / Policy Engine

ACCEPTANCE_COVERAGE = L1 credential 自身（ensure 成功 / repeated ensure 同一身份 /
    store 0600+505+unrelated 保留 / child 隔离三连 ABSENT+DENIED / mint attempted /
    状态 E same-client 恢复 / 状态 A 负例无 orphan / malformed store 不覆写）+
    L2 grant negative（authorization failure ≠ credential_unavailable）+
    L3 forum positive（条件：named external grant prerequisite 就绪 → token →
    forum_list_threads）；不接受 fake credential / mock-only Broker / manual
    bearer / OpenClaw fallback

ROUTER_CHANGE = NONE
RUNTIME_CHANGE = NONE
KERNEL_CHANGE = NONE

SPEC_STATUS = proposed（本轮 SPEC AMENDMENT ONLY，未实施、未 merge）
READY_FOR_INDEPENDENT_RE_REVIEW = YES
```
