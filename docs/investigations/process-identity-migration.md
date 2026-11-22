# Process Identity Migration — one Agent = one DSH process 后的最小身份链

> 主题：替换 OpenClaw 的身份迁移调查（docs-only，不实现）。
> 前提已冻结：one long-lived Agent = one OS process = one DSH runtime = one
> security domain；Control Plane（Router）在 Agent 进程外；Agent 进程内的
> agentId / currentInitiator / model·tool arguments 都不是可信身份来源；
> Broker 只能相信进程外给这个 Agent process 的 credential。
> 本轮只调查现状与给出目标最小方案，未修改任何 Auth / Broker / Router / DSH 代码。

## 0. 调查对象与证据基线

| 层 | 真实代码/文档位置 |
|---|---|
| auth-service（签发/principal/grant/OBO） | `auth-service/src/routes/oauth.ts`、`src/lib/oauth/v1/{direct,exchange,signer}.ts`、`docs/contracts/minimal-auth-v1/*`、`prisma/schema.prisma` |
| Broker（openclaw-auth-broker 插件） | `openclaw-adc-canary-extension/broker/src/{index,broker-core,registries,principal-registry,secret-resolver,token-cache}.ts`、`broker/src/adapters/*` |
| OpenClaw Auth 侧（canary 插件/hook 面） | `openclaw-adc-canary-extension/src/{index,tool,auth-service-client,config,secrets,proxy-guard,origin-validator}.ts`、`openclaw.plugin.json` |
| 资源服务消费侧 | `svc-workflow/src/auth/jwks_verifier.rs`、`svc-forum/svc-forum/src/middleware/auth.ts`、`adc-v2/backend/src/v2/auth/obo-provider.ts` |
| DSH 侧控制面与凭据 seam | `dsh-agent-core/packages/agent-router/src/process.js`、`packages/broker/src/{identity,registry,mapping}.js`、`docs/TRUST-BOUNDARY-REPORT.md`、`docs/investigations/identity-auth.md` |
| 存量审计证据 | `openclaw-adc-canary-extension/*.md`（provisioning / zero-secret / privilege-separation 系列报告） |

---

## CURRENT FLOW（今天真实跑着的身份链）

### L0 — OpenClaw Gateway 会话身份（`ctx.agentId`）+ Auth plugin/hook 面

Broker 插件的每个 tool factory 拿到 `ctx.agentId`，注释明确：
"agentId is derived from the Gateway session key and is NOT controllable by
the model or any tool parameter"（`broker/src/plugin-api.ts:43-56`）。
工具 schema 一律 `additionalProperties:false`，不接受 agentId/principalId/
token/audience/scope 等任何身份或路由参数（如 `broker/src/adapters/forum-access.ts:33-39`）。

OpenClaw runtime 侧事实（2026.3.13 dist 实测）：

- `ctx.agentId` 在 tool 构建时由 `resolveSessionAgentId({sessionKey})` 从会话 key
  `agent:<agentId>:<rest>` 解析而来（`dist/session-key-*.js:6-19`、
  `dist/query-expansion-*.js:94-108`）；`senderIsOwner`/`agentAccountId` 来自
  run-context（`dist/manager.runtime-*.js:694-711`）。
- `resolveSessionAgentId` 还接受**显式 `agentId` 覆盖参数**
  （`explicitAgentId ?? parsed.agentId`，`query-expansion-*.js:96-103`），部分
  内建会话定位工具由调用方传入 sessionKey 派生 agentId——`ctx.agentId` 存在
  调用方可影响的通道，进一步坐实「不是认证身份」。
- **Gateway 没有 per-agent 认证边界**：入站认证是单一共享 token/password（或
  trusted-proxy），OpenAI 兼容端点对持 token 者硬编码 `senderIsOwner:true`
  （`dist/gateway-cli-*.js:18110-18128`）。`ctx.agentId` 的可信度只等于会话框架
  本身，任何 gateway token 持有者都能起任意 agent 的会话。
- OpenClaw 插件 hook 系统（`registerHook`/`api.on`，~24 个 hook）提供
  `before_tool_call`（可拦截/改写参数）、owner-only 工具门（`senderIsOwner`）
  等——这是「OpenClaw Auth plugin/hook」的真实形态：**hook 只做策略钩子与归因，
  不含任何 per-agent 身份认证**。
- 插件按 workspace 全局加载（无 per-agent `plugins.entries`），per-agent 门控
  完全委托给插件配置（broker 的 `enabledAgentIds`/`agentClients`）：**当前一个
  Gateway 进程托管全部 Agent 的 broker 插件，可读全部 78 个 agent 的 secret**——
  单点信任域，进程内任何代码即全量身份。
- 另注意：`agent-core/src/hook/`（旧 Rust kernel 的 Hook ABI v0，HMAC
  `x-agent-core-provider-proof`）与本链无关，是旧 Kernel→Harness 的另一个面。

**这一层解决的真实问题**：在「一个可信 Gateway 进程托管所有 Agent 会话」的旧信任
模型里，把「哪个 Agent 会话驱动了这次 tool call」绑定到插件上下文，作为归因与
授权链的起点。它的可信性完全来自"Gateway 进程 = 信任边界"这个前提——而实测
Gateway 本身并无 per-agent 认证，`ctx.agentId` 本质是**会话框架内的归因**，不是
对 Agent 的认证。这正是本轮要替换的前提。

### L1 — per-agent Client/Secret 供给

- `MachinePrincipal`（`principalType=agent`、`agentId`、`ownerUserId`、
  `externalRef=openclaw:agent:<id>`）+ `MachineClient`（`clientId=mc_*`、
  scrypt `secretHash`）+ `MachineAccessGrant`（audience → scopes）在 auth-service
  Postgres（`auth-service/prisma/schema.prisma:105-144, 272-284`）。
- 明文 secret 由 UID502 的 provisioning 脚本直写
  `~/.openclaw/credentials/agent-<id>-secret`（0600，目录 0700），并把
  `{agentId → {clientId, secretRef}}` 写进 `broker/config.json`
  （当前 78 个 agentClients）。
- `broker/authoritative-agent-mapping.json`（v2.0，1102 行）已持有权威绑定：
  `canonical_agent_id → auth_principal_id → openclaw_client_id → credential_ref`。

**这一层解决的真实问题**：把「一个只有 A 知道的 secret」绑定到「A 的 principal」，
并给每个 agent 独立的吊销粒度。secret 是当前唯一真正的身份事实；`agentId` 只是
它的配置索引。

### L2 — Broker 插件（每个 tool call 的路径）

`broker-core.ts:256-335` `authorizedFetch` 顺序：

1. `ctx.agentId` allowlist gate（`enabledAgentIds` / 每 capability `allowedAgentIds`）；
2. capability → target（audience + allowedOrigin）；
3. agent → `{clientId, credentialRef}`；
4. secret 经 OpenClaw SDK `normalizeSecretInputString` 解析一次并缓存
   （`secret-resolver.ts`；`broker-core.ts:400-408` `_resolvedCredentials`）；
5. `POST /oauth/token` `grant_type=client_credentials`（Basic
   `clientId:secret`，`resource=audience`，`scope`）取 RS256 Direct JWT
   （`broker-core.ts:347-393`）；
6. TokenCache（key=`agentId|clientId|audience|scope`，<60s 提前刷新，
   401 → invalidate + 重试一次，`token-cache.ts`）；
7. origin/method/path 校验 + 通用请求绑定（pathParams 占位符精确匹配、
   query 序列化、仅 Idempotency-Key 头）；
8. 带 Bearer 调资源服务，返回消毒后的业务结果（token/secret 永不返回、不落日志）。

适配器：forum_access/read/write/discovery、workflow_*、okr_read、
auth_secret_rotate（505 Trusted Control Plane 专用）。

**这一层解决的真实问题**：凭据收口（secret 只存在于受信插件进程内存，模型不可见）、
能力 ACL（capability → target/scopes/method/path + per-agent 白名单）、
token 缓存（每个 agent+audience+scope 共享，避免每 call 一次签发）、fail-closed
gating（不在白名单 → 工具不可用，且 gate 先于任何 token/fetch）。

### L3 — auth-service（签发与授权裁决）

`POST /oauth/token`（`routes/oauth.ts`）按 `grant_type` 分派：

- **client_credentials**（RFC 6749 §4.4）：校验 client+principal active、
  scrypt secret、audience 注册、machine_access_grants 子集 → 签 Direct JWT
  （`lib/oauth/v1/direct.ts` + `signer.ts:110-152`）：RS256 + kid，
  `iss=auth-service`、`sub=principal UUID`、`aud` 单值（svc-workflow）、
  `principal_type=agent`、`client_id=mc_*`、`scope`、`agent_id`、`jti`、
  `iat/nbf/exp`，TTL 600s。
- **token-exchange**（RFC 8693 OBO，`lib/oauth/v1/exchange.ts`）：Trusted Proxy
  client（service principal + trustedProxy 注册 + delegation_grants +
  accepted_subject_audiences）用 Agent Direct Token 换 OBO JWT：
  `sub=原始 Agent`、`act.sub=Proxy`、`azp/client_id=Proxy client`、
  `token_use=workflow_obo`，TTL ≤300s 且不晚于 source token，
  每次成功/失败写持久 `TokenExchangeAudit`。
- 另有 `/.well-known/jwks.json`（RS256 公钥，供资源服务离线验证）、
  human login/refresh（`oauth-human.ts`，与 agent 路径无关）。
- V1 contract（`docs/contracts/minimal-auth-v1/*`）已冻结但**未生产生效**：
  V0（`WORKFLOW_RS256_MACHINE_TOKEN_JWKS_V0`、`WORKFLOW_AGENT_OBO_TOKEN_EXCHANGE_V0`）
  仍 governing；svc-forum / OpenClaw Credential Broker 是 V1 明确标记的
  Legacy/未迁移消费者（`minimal-auth-v1/v0-to-v1-migration.md:186-195`）。

**这一层解决的真实问题**：资源服务离线验证的**短期签名断言**（一次签发，多个
服务无需回查 auth-service 即可验证签名/iss/aud/scope，并基于 `sub` 做领域授权），
以及 grant/scope 的集中裁决与签发审计。OBO 解决的是"**中间服务代表原始 Agent
调用下游**"——当前唯一消费者是 adc-v2（`adc-v2/backend/src/v2/auth/obo-provider.ts`），
Broker 自己的业务 capability 全部走 Direct client_credentials，从未走 OBO。

### L4 — 资源服务消费侧

- `svc-workflow`：`JwksVerifier`（RS256、kid、精确 issuer/audience=svc-workflow，
  Direct `token_use=access` / OBO `workflow_obo`，`deny_unknown_fields`），
  入口 scope 检查后基于 `sub`（principal UUID）做全部领域授权。
- `svc-forum`：`authRequired/authOptional`（`middleware/auth.ts`）JWKS 验证 +
  JIT `ForumPrincipal`（由 `authSubject` 解析/创建），
  scope guard（requireReadScope/requireWriteScope），领域授权基于本地 principal。
- `svc-okr`：`agent-token-verifier`（同类 JWKS 验证）。

**这一层解决的真实问题**：把「签名断言」翻译成「本地业务主体」并执行领域授权——
这是所有资源服务共同的、不可绕过的最后一公里。

### 每层到底解决什么（一句话汇总）

| 层 | 真实解决的问题 | 依赖的信任前提 |
|---|---|---|
| Gateway session → ctx.agentId（+ hook/owner 门） | 同进程归因（谁驱动了这次调用）；hook 只做策略钩子 | Gateway 进程=信任边界；实测无 per-agent 认证（**本轮作废**） |
| per-agent client/secret | 唯一身份事实 + 每 agent 吊销粒度 | secret 只被受信方持有 |
| Broker | 凭据收口 + 能力 ACL + token 缓存 + fail-closed | 插件运行在受信 Gateway 进程（当前单进程=全部 agent 的 secret） |
| auth-service 签发 | 离线可验证的短期断言 + grant 裁决 + 审计 | 服务端 client→principal 绑定 |
| JWT+JWKS | 资源服务离线验证 + sub 领域授权 | 签名密钥在受信进程 |
| OBO/exchange | 中间服务代表 Agent 调下游（仅 adc-v2 在用） | 受信 proxy 注册 |
| 资源服务 middleware | sub → 本地业务主体 + 领域授权 | 上述全部 |

---

## TARGET MINIMUM FLOW（目标最小身份链）

```text
Control Plane（agent-router，受信，Agent 进程之外）
  ├─ spawn Agent A 的 DSH 进程（已存在：packages/agent-router/src/process.js）
  │    └─ 注入进程凭据 A（spawn env；可选 0600 文件落 A 自己的 DSH_HOME）
  └─ 把 credentialA → principalA（clientId/principal UUID）绑定发布给 Broker

Agent A DSH 进程（不可信：模型 + 自生成插件）
  └─ 通用 Broker tool（薄客户端）: 只从进程注入源读取凭据
       └─ 请求 Broker：(credentialA, capabilityId, params)

Broker（受信；沿用现有 broker-core/registries/adapters 代码资产）
  ├─ 身份 = 出示的进程凭据 A（不再是 ctx.agentId）
  ├─ credentialA → principalA（绑定表；复用 authoritative-agent-mapping.json）
  ├─ capability ACL（现有 registries：capability → target/scopes/method/path）
  ├─ token：client_credentials → auth-service → RS256 Direct JWT（sub=principal A）
  └─ 带 Bearer 调 svc-forum / svc-workflow / svc-okr

auth-service：签发者角色不变（仅 token 缓存 miss 时参与）
资源服务（svc-forum / svc-workflow / svc-okr）：零改动
```

设计要点：

1. **身份唯一来源 = 进程凭据**。A 进程内不存在 B 的凭据；恶意插件/模型最多
   以 A 的身份活动（这正是目标属性）。Broker 忽略任何客户端自报 principal。
2. **auth-service 的 client→principal 绑定是最终兜底**：即使 Broker 绑定表被
   进程内代码篡改（同 OS user 可写），凭据不属于被换绑的 client 时
   `client_credentials` 必然 401——A 无法借用 B 的 clientId+自己的凭据通过
   grant 检查。身份链的信任锚始终在 auth-service 的 secret 校验。
3. **资源服务零改动**：JWT+JWKS+scope+sub 领域授权原样保留，因此
   「凭据→principal」不需要重建成一套新 policy engine。
4. **OBO 不进 agent 路径**：Agent 进程直连 Broker、由 Broker 用自己的 Direct
   token 调服务，不存在"中间服务代表 Agent"的需求；OBO 只留给 adc-v2 的存量
   代理路径。

---

## KEEP（必须保留）

| 机制 | 为什么保留 |
|---|---|
| auth-service 作为签发者（client_credentials + RS256 + JWKS） | 资源服务全部离线验证签名/iss/aud/scope，替换 = 改所有消费方，非最小 |
| MachinePrincipal / MachineClient / MachineAccessGrant | 这是凭据→principal 绑定的服务端事实；删除 = 重建同样的事实于别处 |
| Direct JWT Profile（`token_use=access`、sub、scope、agent_id） | 与 V0 wire 兼容，svc-workflow/svc-forum/svc-okr 已在消费 |
| Broker registries（capability → target/scopes/method/path + per-agent 白名单） | 能力 ACL 的现状载体，与 auth-service grant 是两层防御 |
| Broker TokenCache + 401 重试 + origin/method/path 校验 + fail-closed | 现成且有效，直接复用 |
| 资源服务 sub → 本地业务主体 + 领域授权 | 领域授权最后一公里，不动 |
| auth-service 签发/失败审计（auditLog / TokenExchangeAudit） | 事故追踪依赖 |
| `authoritative-agent-mapping.json` | 现成的 credential→principal 绑定基座（缺的只是凭据本身） |
| 每 capability 的 allowedAgentIds（防御纵深） | 凭据成为主身份后，白名单仍防误暴露 |

## DELETE / LATER REMOVE（可以删 / 以后删）

| 机制 | 判定 | 说明 |
|---|---|---|
| per-agent `secretRef` 经 Gateway 配置分发（`broker/config.json` + `~/.openclaw/credentials/*` 文件树） | **DELETE（agent 路径）** | 改为 spawn 时注入；文件树与 78 项配置映射退役 |
| Broker 以 `ctx.agentId` 作为身份来源 | **DELETE（身份角色）** | 身份改由凭据决定；`agentId` 仅保留作归因/审计字段 |
| per-agent secret 的"进程内常驻缓存 + 重启才生效"（`_resolvedCredentials`） | **DELETE** | 凭据随进程注入、随进程消亡，天然无陈旧缓存问题 |
| OBO/token-exchange（agent 路径） | **LATER REMOVE** | Broker 业务调用从未用 OBO；待 adc-v2 迁移后整链可删（TrustedProxy/DelegationGrant/ExchangeAudit） |
| OpenClaw 侧 canary 插件（`src/`：adc_workflow_read、origin-validator、proxy-guard 等） | **LATER REMOVE** | 被 DSH 侧通用 Broker tool 取代 |
| `auth_secret_rotate` broker tool（505 专用） | **LATER** | 首轮可保留作轮换手段；控制面接管轮换后退役 |
| HS256 / V0 遗留签发路径（llm-todo 等） | **LATER（正交）** | 已在 V1 迁移轨道，与本轮无关 |
| Human login / refresh（`oauth-human.ts`、HumanClient、Session 族） | **保留（非 agent 路径）** | 人类身份与 agent 进程凭据无关，不在删除范围 |

---

## REQUIRED CODE CHANGES（最小改动清单）

目标：第一个真实 Agent 安全调用 Forum/Workflow。按改动大小排序：

### 1. 控制面注入进程凭据（dsh-agent-core，~10 行）

`packages/agent-router/src/process.js` 的 `agentEnv(home, extra)` 已预留 env 注入
seam：spawn 时注入进程凭据（如 `AGENT_CORE_PRINCIPAL`——该变量名已是
`packages/broker/src/identity.js:29` 的占位符约定，或显式
`AGENT_PROCESS_CREDENTIAL`）。值由控制面配置提供（首轮可复用该 agent 现有
client secret；本轮对凭据形态保持 OPEN，见 OPEN QUESTIONS）。

同时把 `credentialA → {agentId, clientId, principalId}` 写入 Broker 绑定表
（首轮可直接在 `authoritative-agent-mapping.json` 基础上加凭据指纹列，由控制面
以受信方式发布，agent 进程不可写）。

### 2. DSH 侧通用 Broker tool 的身份解析（dsh-agent-core，1 个文件）

`packages/broker/src/identity.js` 的 `resolvePrincipal` 目前是占位实现（读
`AGENT_CORE_PRINCIPAL` env），文件头注释已写明最终形态 = 进程凭据 → principal
绑定。替换占位实现：读取进程注入凭据 → 查绑定表 → 产出 principal。tool schema
与 mapping 层已保证模型输入永远不带 principal 字段（`registry.js`/`mapping.js`），
无需改动。

### 3. Broker 侧 identity 源（openclaw-adc-canary-extension/broker 或迁移后代码）

- **凭据成为身份**：`broker-core.authorizedFetch` 的身份输入从 `ctx.agentId`
  改为「出示的进程凭据」；`registries` 增加/复用 credential→agent 绑定查找；
  `ctx.agentId` 只进审计字段。
- **secret 解析替换**：`_resolveCredential` 不再按 `secretRef` 读配置分发文件，
  直接使用出示凭据（或进程 env 中凭据）作为 client secret。
- **入口形态**：若 Broker 继续以进程内插件形态存在（每个 Agent 进程一个实例），
  只需上述两处；若按任务目标图做成进程外 Broker（一个 Broker 服务多个 Agent），
  新增一个薄 HTTP/JSON-RPC 入口把 `(credential, capabilityId, params)` 接到现有
  `authorizedFetch`，adapters/registries/token-cache 全部原样复用。
- 其余（capability ACL、target 校验、token 缓存、fail-closed）零改动。

### 4. auth-service：零代码改动（首轮）

client_credentials + grants + JWKS 原样工作。轮换/吊销走既有 API（见下）。

### 5. 资源服务：零改动

svc-forum / svc-workflow / svc-okr 无感知。

### credential rotation / revoke 最小需要什么

- **轮换**：控制面在下次 spawn 前调用既有轮换路径（auth-service
  `machine-admin client rotate` 或 `auth_secret_rotate` 适配器）生成新 secret，
  注入新 spawn env，杀掉旧进程。旧凭据随旧进程消亡；不存在 broker 内存缓存
  陈旧问题（进程内形态：缓存随进程死；进程外形态：缓存按凭据/agent 分键，
  401 自动失效）。
- **吊销**：disable MachinePrincipal/MachineClient（已存在）→ 新签发立即停止；
  已签 token 最迟 10 分钟过期；同时杀进程、从绑定表移除。V1 合同本就不承诺
  秒级撤销，agent 进程场景无需 introspection/jti denylist。

### 是否需要额外 OS user

**第一个 Agent 不需要。** 单进程部署下没有"别的 Agent 的凭据"可偷，进程凭据
注入即足够（与 TRUST-BOUNDARY-REPORT 方案 B 一致）。

**第二个 Agent 上同一台机器之前需要决策**：当前威胁模型（Agent 进程内可自生成
插件 + `danger-full-access` + 同 OS user）下，A 的进程代码可以枚举文件系统并读取
B 的 0600 凭据文件（同属主，0600 只挡其他 user，不挡同 user）——即使凭据只放
env，Linux 上 `/proc/<B-pid>/environ` 在宽松 ptrace 配置（Yama `ptrace_scope=0`）
下也同 user 可读。即简单 process credential 在**多 Agent 同 user**时被现有威胁
模型明确证伪。届时最小选项：
(a) per-agent OS user（各自 0700 home，凭据不可跨 user 读）；
(b) 收紧进程内文件/进程枚举能力（放弃 danger-full-access）——需另行评估。
本轮不实现、不推荐具体选项，只记录触发条件。

---

## REPO/FILE OWNERSHIP

| 仓库 | 文件 | 所有权变化 |
|---|---|---|
| dsh-agent-core | `packages/agent-router/src/process.js` | 控制面 spawn + 凭据注入（改动点 1） |
| dsh-agent-core | `packages/broker/src/identity.js` | 进程凭据→principal 解析（改动点 2；seam 已存在） |
| dsh-agent-core | `packages/broker/src/{schema,mapping,registry}.js`、`bundle-integration/`、`profile-integration/` | 复用，不动 |
| openclaw-adc-canary-extension | `broker/src/{broker-core,registries,principal-registry,secret-resolver,token-cache}.ts`、`broker/src/adapters/*` | Broker 资产：迁移复用 / 进程外入口（改动点 3） |
| openclaw-adc-canary-extension | `broker/authoritative-agent-mapping.json` | 绑定基座，继续演进 |
| openclaw-adc-canary-extension | `broker/config.json`、`src/`（canary 插件） | 删除/退役（DELETE 清单） |
| auth-service | `src/routes/oauth.ts`、`src/lib/oauth/v1/*`、`prisma/` | 不动（KEEP） |
| svc-forum / svc-workflow / svc-okr | auth middleware / verifier | 不动（KEEP） |

---

## OPEN QUESTIONS

1. **凭据形态**：进程凭据 = 复用现有 client secret（零新增 auth-service 代码，
   绑定链最短），还是独立 opaque bearer（与 client 体系解耦，但需要新的绑定/
   校验机制）？本轮保持 OPEN。
2. **Broker 形态**：进程内（每 Agent 一个实例，凭据只在自己 env 里，改动最小）
   还是进程外（一个 Broker 服务多 Agent，ACL/审计集中，符合任务目标图）？
   首轮建议进程内起步，进程外作为后续收敛。
3. **多 Agent 同 host 的凭据隔离**：第二个 Agent 落地前必须回答 per-agent OS
   user vs 能力收紧（见"额外 OS user"节）。
4. **subagent 语义**：同进程子 agent 共享父凭据 = wire 上呈现父 principal，
   需要独立身份的编排节点由控制面单独起进程——沿用 TRUST-BOUNDARY-REPORT，
   本轮不重复调查。
5. **绑定表发布通道**：credential→principal 绑定由控制面写入 Broker 的方式
   （映射文件 + 重启，还是运行时可更新 API）；agent 进程对绑定表必须只读。
6. **轮换节奏与归属**：首轮沿用 `auth_secret_rotate` 还是控制面直接调
   rotate API；是否需要在 spawn 前强制预轮换（新凭据不进任何旧文件树）。
7. **78 个存量 OpenClaw agent 的迁移**：authoritative-agent-mapping.json 与
   broker/config.json 如何分批演进为新绑定表，OpenClaw 进程退役时序。

---

## 结论

如果只为了让第一个真实 Agent 安全调用 Forum/Workflow，最小需要改三处：
① `packages/agent-router/src/process.js` 在 spawn 时把进程凭据注入 agent 进程 env；
② `packages/broker/src/identity.js` 用进程凭据解析 principal（替换占位实现）；
③ Broker 侧把身份来源从 `ctx.agentId` 换成出示的进程凭据并通过绑定表映射到
principal（复用 `authoritative-agent-mapping.json` + auth-service 既有
client_credentials/JWKS/grant 链）——auth-service、svc-forum、svc-workflow、
svc-okr 与 JWT/JWKS/scope 机制全部零改动。
