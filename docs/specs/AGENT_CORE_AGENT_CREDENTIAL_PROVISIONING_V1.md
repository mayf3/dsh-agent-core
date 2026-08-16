---
spec_id: AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1
status: proposed
---

# Agent Core Agent Credential Provisioning V1

> 性质：**Spec（SPEC ONLY — 本轮只收敛冻结，不实现）** · 日期：2026-08-17
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
> 本轮只新增 `docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md`。
> **不修改 Auth / Broker / Router / Runtime 代码，不改 agents.json / credential store，
> 不启动 runtime，不 merge。** Kernel: **KERNEL_CHANGE = NONE**。

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

本 Spec 冻结 credential provisioning 的 authority 模型、身份映射、onboarding 语义、
grant 分离与 failure semantics，并界定未来 Implementation 的最小 scope。**不建设完整
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

---

## Part B — Authority model（冻结）

```text
PRINCIPAL_AUTHORITY        = Auth（外部 auth-service）—— deployment-side ensure；
                             Agent Core 运行时永远不创建 principal
CLIENT_CREDENTIAL_AUTHORITY = Auth（外部 auth-service）—— machine client + secret；
                             provisioning tooling 经 auth-service 既有注册/管理面创建
TRUSTED_STORE_AUTHORITY    = Deployment / Control Plane（505）—— 唯一写入方把
                             <agentId> → {clientId, clientSecret} 写进
                             AGENT_CORE_CREDENTIALS_FILE（0600、505-owned）；
                             写入值直接来自 auth-service 签发结果，永不经 env/argv/child
BROKER_RESOLUTION          = gateway 按 ACTUAL proc.agentId 经 loadCredentialFor 读取
                             （每次调用重读，支持 rotation）
CHILD_RAW_SECRET_ACCESS    = NO —— child 进程从不持有 raw secret 或 token
                             （V2 验收实证：env/fs/ws 均 ABSENT、store 读取 DENIED）
```

优先模型（与既有代码一致，最小设计）：

```text
Agent onboarding / provisioning（deployment-side）
  → creates / ensures Auth principal + machine client      （auth-service 外部面）
  → secret 直接写入 trusted credential store（505）         （AGENT_CORE_CREDENTIALS_FILE）
  → formal Agent exists ⇒ credential 可在 trusted store 按 agentId resolve
        │
child Agent               → 永远看不见 raw secret
        │
Broker gateway（505）     → loadCredentialFor(agentId) → client_credentials → scoped JWT
```

冻结边界：**不引入新 Auth 系统、不引入 credential→principal 映射表**（auth-service
仍是 client↔principal↔agent_id 绑定的唯一权威）；**不把 secret 交给 child 进程持有**
（维持 trusted gateway 模型，不退回 Process Identity 的 child-held-credential 方案）。

---

## Part C — Identity consistency（冻结稳定映射）

以下各身份**不必字符串相等**——显式拒绝「字符串复用即正确」的默认假设：

```text
AGENT_IDENTITY_TO_AUTH_IDENTITY =
  agentId（agt_*）      = Agent Definition 键 = credential store 键
                          （agentId 是 Agent Core 侧 loadCredentialFor 的 ONLY lookup 键）
  clientId（mc_*）      = auth-service 上注册的 OAuth machine client
                          （store entry 的 clientId 字段）
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

---

## Part D — 已有 Agent onboarding（V1 最小语义）

V1 **不建设完整 IAM 平台**，只冻结下述 lifecycle semantics，并优先解决：

```text
formal Agent exists → required Broker credential 可以被确定性地 provision
```

| 场景 | 语义 | 备注 |
|---|---|---|
| 新 Agent 创建 | `ensureAgentCredential(agentId)`：Agent Definition entry 已存在（创建/reuse 沿用现有 `adoptAgents`/`createAgentInConfig` 的 `agt_*` id 复用规则）→ ensures principal → ensures machine client → 写入 store entry（schema 匹配 `CREDENTIALS_STORE_VERSION=1`）→ **单独**记录 grant（不自动 grant） | deployment-side，幂等，确定性 |
| 已存在 Agent 缺 credential | **backfill**：同一 `ensure` 路径对已在 `agents.json` 但 store 无 entry 的 agent（如 canary `agt_fb78…`）补齐；store 每次调用重读 ⇒ **无需重启**即生效 | 这是本 Spec 的第一优先场景 |
| Agent 被删除 | 从 Agent Definition config 移除（先 `disable`）→ 移除 trusted store entry（fail-closed）→ 是否 revoke auth client/principal 由运营商决定（独立于 Agent Core） | disable/remove 是既有 seam；store entry 移除是新增最小操作 |
| credential revoke | 移除/失效 store entry（之后该 agent 每次 Broker 调用 fail-closed）+ auth-service 侧 revoke client/principal | 两个 authority 各自独立 revoke |
| secret rotate | auth-service 重签 client secret → 更新 store entry；`loadCredentialFor` 每次调用重读 ⇒ 下一调用即用新 secret，**无重启、无缓存** | 既有 store 行为已支持 |

V1 边界：provisioning 是 **deployment-side tooling**（与 `production-agent-provision.mjs`
root seam 同类），**不是**运行时写 store 的服务；Agent Core 运行时保持「store 只读」。
若未来需要 runtime-visible provisioning API，须单独 Spec。

---

## Part E — Grants（credential ≠ grant，必须分离）

```text
CREDENTIAL_EXISTENCE   = trusted store 存在 <agentId> → {clientId, clientSecret}
SERVICE_GRANT          = auth-service 侧该 client 被授予的 scope
                         （forum.read / forum.write / workflow.* …）
```

冻结：

1. **credential provisioning ≠ 自动授予每一个 capability。** provisioning 只保证
   「有身份、能 mint token」；授予哪些 scope 是 auth-service / 业务侧决策。
2. Agent 有 credential 但**没有** `forum.read` grant 时，调用必须得到**授权失败**
   （如 `scope_denied` / `access_denied`），**绝不**再得到 `credential_unavailable`。
   两个 failure mode 必须可区分（Part F）。
3. 现网已有先例（`agent-definition/src/access.js`）：LOCAL capability
   `agent.definition.write` 需要 `agent.definition.write` scope——gateway 经
   auth-service 取 token，失败返回 `access_denied`（`gateway.js:163-186`）。HTTP
   capability 的同类分离由 Part F 冻结。

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
                   内 / 401 invalid_scope                   须能区分出授权语义）
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
- 不在 JWT 里塞业务角色（Domain Owner、Forum role 等保持外部业务系统治理）。
- 不把 Broker 升级成新 Policy Engine——Broker 维持 authorized transport / capability
  seam。
- 不复制 OpenClaw runtime architecture（其 per-peer workspace / per-agent
  auth-profiles 模型只作参考，不移植）。

---

## Scope（未来 Implementation 允许做什么）

允许（优先最小实现，deployment/ops 面 + 最小 broker collateral）：

1. **Provisioning tooling（deployment-side）**：`ensureAgentCredential(agentId)` ——
   经 auth-service 既有管理面 ensures principal + machine client，并把签发结果写入
   trusted store（schema 匹配 `CREDENTIALS_STORE_VERSION=1`，绝对路径、0600、505-owned、
   原子写 tmp+rename）；含 backfill 模式与幂等断言。
2. **最小 Broker error-classification**（Part F）：让 credential/授权/下游三层 failure
   在 wire 上可区分（允许新增 error code，禁止跨层归因）；附带 transport/gateway 测试。
3. **Rotation / revocation runbook** 或最小 helper（store 更新、auth-service 侧 revoke）。
4. **Acceptance driver 的扩展面**：为未来 canary 提供可复现的
   `create/formally provision Agent X → loadCredentialFor(X) 成功 → /oauth/token 被
   尝试 → scoped JWT → forum_list_threads 到达 svc-forum` 验收路径。

**本 Spec 本轮不实施以上任何一项**——它只冻结范围，供后续 Implementation（在
`status: accepted` 之后）执行。

## Non-goals / Frozen boundaries（实现时不得越过）

```text
RUNTIME_CHANGE = NONE
ROUTER_CHANGE = NONE        （Router 已按 ACTUAL proc.agentId 分发，身份决策不变）
AUTH_CHANGE    = NO_IN_REPO （auth-service 是本仓库外 authority；本 Spec 不授权改它）
KERNEL_CHANGE  = NONE
```

- 不引入 child-held-credential；不把 secret 注入 child env/workspace。
- 不新增一卡通映射表 / 新 Auth / 新 principal registry（auth-service 仍是唯一权威）。
- 不自动授予 capability；grant 决策留在 auth-service / 业务侧。
- 不改 Binding / Session / workspace 模型（`AGENT_CORE_BINDING_WORKSPACE_V1` 若被
  accepted，与本 Spec 正交）。

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

## Acceptance Criteria

后续 Implementation（在 accepted Spec 之下）至少证明：

1. `create/formally provision Agent X`：principal 存在（auth-service）、client
   credential 存在于 trusted store（按 `X` 的 agentId resolve）。
2. Broker request from Agent X：`loadCredentialFor(X)` 成功 → `/oauth/token` 被尝试 →
   scoped JWT（audience/scope 来自 targets/manifests）→ `forum_list_threads` 到达
   svc-forum 并返回业务结果。
3. Agent without `forum.read` grant → **授权失败**（可区分于 credential 错误），
   **不再**是 `credential_unavailable`。
4. revocation：移除 store entry / revoke 后，同一 agent 的 Broker 调用 fail-closed。
5. rotation：更新 store entry 后下一调用即生效（无重启）。
6. child 仍拿不到 raw secret（env/fs/workspace 均 ABSENT；store 读取 DENIED）。
7. 现有冻结边界保持：`KERNEL_CHANGE = NONE`、`ROUTER_CHANGE = NONE`、
   无新 Auth / 新 mapping table / 无 OpenClaw fallback。

## Risks

- **provisioning 误把 secret 落进 child 可读位置** → 冻结写入面为 505-private store、
  0600、值直接来自 auth-service，禁止 env/argv/child 途径（沿用 same-uid audit 硬前提）。
- **错误码折叠重演（scope_denied 被掩盖为 transport_failure）** → Part F 冻结层归属与
  可区分要求，实现附带测试。
- **自动 grant 滑入 provisioning** → Part E 冻结 credential ≠ grant，实现必须单列。
- **运行时退化回 child-held-credential** → Security boundaries + Frozen boundaries
  显式禁止回退。
- **身份族乱接（误以为字符串相等即绑定）** → Part C 冻结四族映射与 provision-time
  一次性建立，运行时零换算。

## Related Evidence

- Governing investigation（PASS）：`docs/investigations/test-agent-feishu-product-semantics-v1.md`
  （`FORUM_CREDENTIAL_FAILURE_LAYER = BROKER_GATEWAY_CREDENTIAL_RESOLUTION`；
  `AUTH_TOKEN_MINT_ATTEMPTED = NO`；OpenClaw 身份 vs Agent Core `agt_*` 身份 gap）。
- Trusted gateway 架构（已验收）：`docs/reports/trusted-credential-broker-integration-v1.md`、
  `docs/reports/trusted-credential-505-final-acceptance-v2.md`（505/502 边界、
  CHILD_SECRET_* ABSENT、store 读取 DENIED）。
- 信任边界调查：`docs/investigations/identity-auth.md`（方案 B 冻结）、
  `docs/investigations/same-uid-router-secret-boundary-audit-v1.md`（env/argv 禁止）。
- Frozen 模型：`docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1.md`（D-002：Agent 拥有
  credential，principal/credential/grant → Auth——本 Spec 使其可操作化，**不冲突、
  不 disposition**）。
- 治理：`docs/specs/AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1.md`（Spec 生命周期：
  proposed → accepted；本 Spec 当前 `status: proposed`）。

---

## Final Output

```text
AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_SPEC = PASS

BASE_MAIN = 6b4f50582c4ce5d3e35941d5a838f5ec504ff480
HEAD      = docs/agent-core-credential-provisioning-v1-spec（独立分支，不 merge）

GOVERNING_INVESTIGATION = TEST_AGENT_FEISHU_PRODUCT_SEMANTICS_INVESTIGATION_V1
                          (docs/investigations/test-agent-feishu-product-semantics-v1.md, PASS)

CURRENT_CREDENTIAL_MODEL = trusted 505 gateway mode：
    child(502) → parent-RPC → Router(actual proc.agentId) →
    loadCredentialFor(AGENT_CORE_CREDENTIALS_FILE, agentId) →
    undefined ⇒ fail-closed credential_unavailable（/oauth/token 之前）；
    store = {version:1, credentials:{<agentId>:{clientId,clientSecret}}};
    store+auth-service 均 deployment-owned，无自动 provisioning 路径

PROVISIONING_GAP = Agent 存在性(agents.json, agt_*) 与 Broker credential
    (auth principal + machine client + trusted-store entry) 是两套完全解耦的 authority：
    创建 Agent 的代码路径(adoptAgents/createAgentInConfig/migrate + home/root
    provisioner) 零 credential 写入；Agent Definition config 显式禁止 credential
    字段(config.js:78-84)；auth-service 为外部 authority 且无 Agent Core 创建代码。
    ⇒ formal Agent 存在但 Broker credential 缺失（canary agt_fb78… 实测 credential_unavailable）。

AGENT_IDENTITY_TO_AUTH_IDENTITY =
    store key = agentId(agt_*)  ← Agent Core 唯一 lookup 键(must equal)
    clientId(mc_*) = auth-service OAuth client
    principal id(UUID) = client 绑定的 principal
    JWT sub/agent_id = auth-service 签发 claims
    四族字符串不要求相等；关系在 provisioning 时刻一次性建立并固定

PRINCIPAL_AUTHORITY        = Auth（外部 auth-service）—— deployment-side ensure
CLIENT_CREDENTIAL_AUTHORITY = Auth（外部 auth-service）—— provisioning tooling 经其注册面创建
TRUSTED_STORE_AUTHORITY    = Deployment/Control Plane(505) —— 唯一写入 AGENT_CORE_CREDENTIALS_FILE，
                             0600、值直接来自 auth-service、永不经 env/argv/child

CHILD_RAW_SECRET_ACCESS = NO（V2 验收：env/fs/ws ABSENT，store 读取 DENIED）

NEW_AGENT_PROVISIONING  = ensureAgentCredential(agentId)：existing/ensure agent def →
                          ensure principal+client → write store entry（CREDENTIALS_STORE_VERSION=1）→
                          grant 单列（不自动授予）
EXISTING_AGENT_BACKFILL = 同一幂等 ensure 路径补齐 store entry（canary 场景），store 重读 ⇒
                          无需重启即生效；V1 第一优先
ROTATION_SEMANTICS     = auth-service 重签 secret + 更新 store entry；每调用重读 ⇒ 无重启生效
REVOCATION_SEMANTICS   = 移除 store entry(fail-closed) + auth-service revoke；
                         Agent definition disable 是正交的既有 seam

CREDENTIAL_VS_GRANT_SEPARATION = credential existence ≠ service grant；
    有 credential 无 forum.read ⇒ 授权失败(scope_denied/access_denied)，
    永不 credential_unavailable；先例 = agent.definition.write(access_denied)

BROKER_CHANGE_REQUIRED = YES（最小：error-classification，Part F 三层可区分 + 测试）
AUTH_CHANGE_REQUIRED   = NO_IN_REPO（外部 authority；本 Spec 不授权改 auth-service）
ROUTER_CHANGE_REQUIRED = NO（已按 ACTUAL proc.agentId 分发）

KERNEL_CHANGE = NONE

IMPLEMENTATION_SCOPE = deployment-side provisioning tooling（ensure principal/client +
    trusted-store 写入，schema 兼容 V1）+ 最小 broker error-classification + 测试 +
    rotation/revocation runbook/helper + 未来 canary 验收路径扩展
OUT_OF_SCOPE = 完整 IAM 平台 · Auth redesign · Policy Engine · mTLS/TPM/sidecar ·
    per-agent OS user · OpenClaw credential fallback · human-Feishu credential 复用 ·
    secret-in-workspace/prompt · Binding/workspace/session 模型 · Scheduler · Forum 特性 ·
    Kernel

SPEC_STATUS = proposed（本轮 SPEC ONLY 冻结，未实施、未 merge）
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```