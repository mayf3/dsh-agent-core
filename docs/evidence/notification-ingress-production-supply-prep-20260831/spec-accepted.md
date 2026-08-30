---
spec_id: AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/auth-service
  - Agent Core Notification Ingress service caller credential and Grant authority
governed_by:
  - MINIMAL_AUTH_FOUNDATION_V2
  - AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1
  - AUTH_SERVICE_DEVELOPMENT_GOVERNANCE_ADOPTION_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1

> **PROPOSED — DOCS / AUTHORITY ONLY.** This child Spec authorizes nothing while
> proposed. `implementation_authority = none` and
> `production_apply_authority = none`. The PR that carries it adds exactly one
> file (this file) and performs no implementation, no Principal/Client/secret/
> Grant creation, no Contract Bundle change, no production apply, no
> deployment, no acceptance finalize, and no merge.

## 1. Goal

为两个独立业务 caller —— `svc-forum` 与 `svc-workflow` —— 冻结通往 Agent Core
Notification Ingress 的**最小 operational authority**：每个 caller 一个独立
service principal、一个独立 dedicated machine client、一个独立 secret、一条唯一
`agent-core-notification-ingress-v1[notification.deliver]` Grant，以及未来 operator
的封闭执行语义（plan / apply / verify / exact-rerun NOOP / conflict refuse）。

```text
CALLERS                      = 2 (svc-forum, svc-workflow; closed set; no substitution)
PRINCIPAL_TYPE               = service (per parent CTR-NI-001/CTR-NI-004)
AUDIENCE                     = agent-core-notification-ingress-v1 (exact)
SCOPES                       = [notification.deliver] (exact; the only registered Scope)
GRANTS_PER_CLIENT            = exactly 1 row, version 1
DISTINCT_SERVICE_PRINCIPAL   = YES (two distinct MachinePrincipal rows)
DISTINCT_CLIENT_ID           = YES (two distinct public clientId values)
DISTINCT_SECRET              = YES (two independent 256-bit RNG draws)
SHARED_AGENT_CREDENTIAL      = NO
SHARED_MANAGEMENT_CREDENTIAL = NO
IMPLEMENTATION_THIS_ROUND    = NONE (docs/authority only)
```

Parent authority: accepted
`AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1`（CTR-NI-004 冻结了
两个 caller 的未来独立 client/Grant requirement；本 Child 把该 requirement 细化为
exact operational model 与 operator closure，不扩大、不改写 parent 的任何 ruling）。

## 2. Scope and non-goals

### In scope

- 只读现状盘点结论（§5–§7）与两个 caller 的 bootstrap 分类（§8）。
- 冻结 exact operational model（§9）：两个 service principal identity、两个
  dedicated client `external_ref`、独立 `clientId` 生成规则、独立 secret 生成/
  哈希/交付规则、两个独立 secret handoff destination、exact Audience/Scope、
  exact apply-time preconditions。
- 冻结未来 operator 的封闭执行闭包（§10）：fixed Git SHA、default read-only plan、
  per-caller 独立 serializable transaction、same-transaction Grant + audit、
  memory-only secret、complete before/after snapshot、exact rerun NOOP、
  conflict fail-closed、rollback / fail-closed residual classification、
  两 caller 独立 rotation/revocation。
- 冻结唯一 Grant target 与禁用 scope 集合（§11）。
- 冻结不可复用身份清单（§12）。

### Non-goals / explicitly not authorized

- 不实现 operator、不创建 Principal/Client/secret/Grant、不修改 Contract Bundle、
  不执行 production apply、不部署、不 accept、不 merge。
- 不注册 Audience（registry delta 属 parent CTR-NI-005 的独立 reviewed versioned
  delta；本 Spec 把「registry 已落地」作为 apply precondition，而不是替代它）。
- 不授予 `notification.*`、wildcard、`auth.identity.provision`、`workflow.*`、
  `forum.*`、delegation/OBO、Human access、其他任何 Audience 的任何 authority。
- 不修改 Agent Core Notification Ingress 的实现（`POST /v1/deliver` 当前 V0 的
  OAuth enforcement wiring 是 agent-core 侧独立未来工作，不属于 auth-service 本
  Spec 的 authority）。
- 不新增数据库表、不修改 schema、不新增 online Grant management API、不使用
  legacy `machine-admin` 通用命令作为执行面。

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/auth-service
AUTHORITY_BRANCH = main
AUTHORING_BASE = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689 (github/main HEAD at authoring)
PRIMARY_PARENT_AUTHORITY = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1 (accepted)
GOVERNING_FOUNDATION = MINIMAL_AUTH_FOUNDATION_V2 (accepted)
PATTERN_AUTHORITY = AUTH_SERVICE_AGENTCORE_TRUSTED_FLEET_GRANT_SUPPLY_V1 (accepted; operator closure pattern)
CLIENT_ID_FORMAT_AUTHORITY = AUTH_SERVICE_AGENTCORE_CANARY_GRANT_SUPPLY_STAGE_W_EXECUTION_V2 (accepted)
SECRET_GRAMMAR = src/lib/oauth/secret.ts (generateClientSecret 256-bit base64url; scrypt salt:hash storage)
```

本 Spec 是 parent CCR 之下的新 bounded child implementation Spec；不 amend、不
supersede parent，不触碰任何 accepted authority 的 normative body。

## 4. Current-state classification summary

```text
SVC_FORUM_CLASSIFICATION    = CLEAN_SERVICE_BOOTSTRAP
SVC_WORKFLOW_CLASSIFICATION = CLEAN_SERVICE_BOOTSTRAP
CONFLICT_FOUND              = NONE
UNKNOWN_FOUND               = NONE
```

两个 caller 均为**全新 service bootstrap**：现状中不存在可复用的 service principal
（不存在名为 svc-forum / svc-workflow 的 service 类型 principal），不存在同名/
同用途 Client，不存在任何 notification Audience 或 Grant。存在的 forum/workflow
相关 principal 全部是 `agent` 类型（属于 Agent fleet / canary / dogfood 身份），
类型不符且被 parent CTR-NI-004 排除，不得复用（§12）。两个 caller 各自新建
service principal + dedicated client，是唯一与现状一致的路径。

## 5. Current State

### STATE-NSC-001 — Notification Audience 尚未注册（registry 与生产库一致缺失）

- Subject: Minimal Auth executable Audience Registry（contract bundle 与 production `auth_audiences`）
- As-of commit: `45b1b890a0fcd3ca1aeb433dee85a0b3ae283689`；production DB observed `2026-08-24`
- Environment: `mayf3/auth-service` github/main；production `agent_dev_center`（read-only `auth_ro` seam）
- Observed: bundle 与 DB 均只含 `svc-workflow`, `svc-okr`, `adc-v2`, `svc-auth`,
  `svc-forum` 五个 active Audience；`agent-core-notification-ingress-v1` 不存在。
  parent CCR 已 accepted 但其 CTR-NI-005 versioned delta 尚未落地。
- Basis: `OBS-NSC-001`, `OBS-NSC-002`, `EVD-NSC-001`

### STATE-NSC-002 — 两个 caller 均无 service principal、无业务 Client

- Subject: `machine_principals` / `machine_clients`
- As-of: production DB observed `2026-08-24`（read-only `auth_ro` seam）
- Observed: principal census = 198 active `agent` + 10 disabled `agent` + 4 active
  `service` + 2 disabled `service`。全部 6 个 service principal 为
  OBO ADC Proxy、V1 E2E Caller（`e2e:e2e-d9940fb6:caller-principal`）、
  Agent Provisioning Broker（`openclaw:broker:provisioning`）、Verify Test、
  2 个 disabled validation canary —— 无一属于 svc-forum / svc-workflow。
  318 个 machine client 中 external_ref 前缀分布为 `agentcore:`×88、`openclaw:`×81、
  `auth:`×1、`e2e:`×1；不存在任何 forum/workflow/notif 命名或等价 Client。
- Basis: `OBS-NSC-003`, `OBS-NSC-004`, `EVD-NSC-002`

### STATE-NSC-003 — Notification Grant 全域为零

- Subject: `machine_access_grants` / `human_audience_grants`
- As-of: production DB observed `2026-08-24`
- Observed: audience `agent-core-notification-ingress-v1` 的 grant 行数 = 0；
  任意 grant 携带 scope `notification.deliver` 的行数 = 0；human grant 相关行 = 0。
- Basis: `OBS-NSC-005`, `EVD-NSC-003`

### STATE-NSC-004 — 两个 caller 的 secret handoff 目标现状不对称

- Subject: svc-workflow 与 svc-forum 的生产部署 secret 消费通道
- As-of: observed `2026-08-24`
- Observed: svc-workflow 以 launchd（`com.svc-workflow`）运行
  `/Users/yanfenma/.local/services/svc-workflow/svc-workflow`，持有既有 0600
  `.env`（`DATABASE_URL`、`WORKFLOW_*`、`AUTH_V1_CANARY_*`），无 OAuth client
  credential 项 —— 存在持久、owner-only 的既有 handoff 通道。svc-forum 以 Docker
  容器 `svc-forum`（127.0.0.1:3460，image `svc-forum:502cfca`）运行，env 经由
  compose 注入（创建时 working dir `/tmp/forum-deploy/svc-forum` —— `/tmp` 易失，
  当前已不存在），容器 env 仅含 `AUTH_JWT_*`/`DATABASE_URL`/`JWT_SECRET` 等，无
  OAuth client credential —— **不存在持久落盘的 handoff 目标**，需 precondition。
- Basis: `OBS-NSC-006`, `OBS-NSC-007`, `EVD-NSC-004`

### STATE-NSC-005 — Agent Core 侧 ingress V0 已存在但无 OAuth enforcement

- Subject: agent-core `packages/notification-ingress`（loopback `127.0.0.1:8790`，唯一端点 `POST /v1/deliver`）
- As-of: observed `2026-08-24`
- Observed: V0 ingress 仅做 body 校验并转发 `agentRouter.deliver`，不校验
  audience/scope/token。OAuth enforcement wiring 是 agent-core 侧独立未来工作；
  本 Spec 只负责 auth-service 侧身份与 Grant authority，不因本 Spec 的任何
  lifecycle 动作而视为 enforcement 已生效。
- Basis: `OBS-NSC-008`, `EVD-NSC-005`

## 6. Observations

### OBS-NSC-001 — Contract bundle Audience list（github/main）

- Source revision: `45b1b890a0fcd3ca1aeb433dee85a0b3ae283689`
- Method: direct inspection of `contract-bundles/minimal-auth-v1/audience-registry.json`
- Result: 5 active audiences（svc-workflow / svc-okr / adc-v2 / svc-auth / svc-forum）；
  `agent-core-notification-ingress-v1` 不存在。

### OBS-NSC-002 — Production `auth_audiences`

- Environment: production `agent_dev_center`, read-only `auth_ro` seam（SELECT only；无 management token；无 mutation）
- Observed at: `2026-08-24`
- Result: `adc-v2`, `svc-auth`, `svc-forum`, `svc-okr`, `svc-workflow`（全部 active）；
  无 notification Audience —— 与 bundle 一致，无 split-brain。

### OBS-NSC-003 — Service principal 全量枚举

- Environment: same read-only seam
- Result（6 行）：
  `a0000000-0000-4000-8000-000000000003` OBO ADC Proxy（active）；
  `c2f94e24-ae2b-4ae1-a925-57ea17589009` V1 E2E Caller（`e2e:e2e-d9940fb6:caller-principal`, active）；
  `857b20c3-8d84-497d-950a-7b185a116687` Agent Provisioning Broker（`openclaw:broker:provisioning`, active）；
  `6aaa6577-b224-4907-a28a-ef3c84450d2a` Verify Test（active）；
  `3a718014-…`（`audit-canary-validation-001`, disabled）；
  `2f81027e-…`（`reauth-canary-validation`, disabled）。
  其中不存在 svc-forum / svc-workflow 的 service 身份。

### OBS-NSC-004 — forum/workflow 命名身份与 Client 全量枚举

- Environment: same read-only seam
- Result: forum/workflow/notif 命中的 principal 共 5 个，全部 `agent` 类型
  （`workflow-provisioning-service`、`canary-e2e-cf1adf8f-svc-workflow-canary`、
  `test-workflow-agent`、`svc-dogfood-user`、`workflow-todo-canary`）；
  client 命中数 = 0。external_ref 前缀普查：`agentcore:` 88、`openclaw:` 81、
  `auth:` 1（`auth:canary:agent:0623ba1a:client:adc-v2`, agent-type Auth Canary）、
  `e2e:` 1；`service:` 前缀不存在（新 namespace 可用且无碰撞）。

### OBS-NSC-005 — Notification Grant 零存在

- Environment: same read-only seam
- Result: `machine_access_grants` 中 audience 命中 0 行、scope `notification.deliver`
  命中 0 行；`human_audience_grants` 命中 0 行。现有 service-type principal 持有的
  grant 仅 `svc-auth[auth.identity.provision]`（provisioning broker 的 active
  `mc_prov_N9NO0yYvw_3fR1ucqusIqw` 与 revoked `mc_qO3Hecl2nAa3NircjiZWYKm5`）。

### OBS-NSC-006 — svc-workflow 部署与 secret 通道

- Method: launchd plist `com.svc-workflow` + 服务目录 inspection（值全部 redacted）
- Result: binary `/Users/yanfenma/.local/services/svc-workflow/svc-workflow`；
  `/Users/yanfenma/.local/services/svc-workflow/.env` 存在（0600, owner yanfenma，
  keys：`DATABASE_URL`、`WORKFLOW_BIND_ADDR`、`WORKFLOW_PORT`、`WORKFLOW_JWKS_URL`、
  `WORKFLOW_JWT_ISSUER`、`WORKFLOW_JWT_AUDIENCE`、`AUTH_V1_CANARY_ENABLED`、
  `WORKFLOW_PROVISIONING_PRINCIPAL_IDS`）—— 无 OAuth client credential。

### OBS-NSC-007 — svc-forum 部署与 secret 通道

- Method: `docker inspect`（env 值 redacted）+ compose labels
- Result: 容器 `svc-forum`（127.0.0.1:3460, image `svc-forum:502cfca`, up）；
  env keys：`AUTH_JWT_AUDIENCE`、`DATABASE_URL`、`JWT_SECRET`、`NODE_ENV`、
  `CORS_ORIGINS`、`AUTH_JWKS_URL`、`AUTH_JWT_ISSUER`；compose project 创建于
  `/tmp/forum-deploy/svc-forum`（+ `/tmp/forum-deploy-override.yml`），该目录现已
  不存在 —— 易失通道，无 OAuth client credential。

### OBS-NSC-008 — Agent Core ingress V0 现状

- Source: `mayf3/dsh-agent-core` working tree（`packages/notification-ingress/src/index.js`、
  `packages/production-runtime/src/compose.js`）
- Result: 默认挂载 127.0.0.1:8790，唯一端点 `POST /v1/deliver`，无 token/scope 校验。

## 7. Evidence relations

### EVD-NSC-001 — Registry 双侧一致缺失支持「audience 落地为 precondition」

- Source observations: `OBS-NSC-001`, `OBS-NSC-002`
- Target: `STATE-NSC-001`, `CLM-NSC-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/auth-service@45b1b89` + production `agent_dev_center` read-only, `2026-08-24`
- Strength/sufficiency: exact for bundle 与 DB 两侧
- Limitations: 不注册、不迁移任何东西

### EVD-NSC-002 — 身份空缺支持 CLEAN_SERVICE_BOOTSTRAP 分类

- Source observations: `OBS-NSC-003`, `OBS-NSC-004`
- Target: `STATE-NSC-002`, `CLM-NSC-002`
- Relation: SUPPORTS
- Bound coordinates: same read-only seam, `2026-08-24`
- Strength/sufficiency: 全量枚举（无抽样推断）
- Limitations: 只证明「当前不存在」，不阻止未来他人创建（apply 时重新校验）

### EVD-NSC-003 — Grant 零存在支持唯一 Grant 目标

- Source observations: `OBS-NSC-005`
- Target: `STATE-NSC-003`, `CLM-NSC-003`
- Relation: SUPPORTS
- Bound coordinates: same seam, `2026-08-24`

### EVD-NSC-004 — handoff 通道现状支持不对称 destination 冻结

- Source observations: `OBS-NSC-006`, `OBS-NSC-007`
- Target: `STATE-NSC-004`, `CLM-NSC-004`
- Relation: SUPPORTS
- Bound coordinates: 本机部署 inspection，`2026-08-24`
- Limitations: svc-forum 的持久 destination 由 precondition 建立后再 apply

### EVD-NSC-005 — Ingress 无 enforcement 支持「authority-only 边界」声明

- Source observations: `OBS-NSC-008`
- Target: `STATE-NSC-005`, `CLM-NSC-005`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/dsh-agent-core` working tree, `2026-08-24`

## 8. Claims and assumptions

### CLM-NSC-001 — apply 前提是 parent 的 registry delta 已落地

- Support state: SUPPORTED（`EVD-NSC-001`）
- Uncertainty: 落地时点不受本 Spec 控制；operator 以 live 校验代替假设。

### CLM-NSC-002 — 两个 caller 均为 CLEAN_SERVICE_BOOTSTRAP

- Support state: SUPPORTED（`EVD-NSC-002`）
- Contradicted by evidence: none
- Uncertainty: apply 时刻的重复校验（CTR-NSC-013）承载时变风险。

### CLM-NSC-003 — 唯一 Grant 目标与现状无冲突

- Support state: SUPPORTED（`EVD-NSC-003`）

### CLM-NSC-004 — handoff destination 可以被精确冻结（workflow 即有；forum 需先建立）

- Support state: SUPPORTED（`EVD-NSC-004`）

### CLM-NSC-005 — 本 Spec 的任何 lifecycle 动作不构成 enforcement 生效

- Support state: SUPPORTED（`EVD-NSC-005`；parent CTR-NI-006 同向）

## 9. Frozen operational model（exact）

### 9.1 svc-forum service principal identity

```text
MODEL            = MachinePrincipal
PRINCIPAL_TYPE   = service
EXTERNAL_REF     = service:v1:principal:svc-forum        (unique; new deterministic namespace)
DISPLAY_NAME     = svc-forum service
AGENT_ID         = NULL
OWNER_USER_ID    = NULL
REQUEST_DIGEST   = NULL
STATUS           = active
```

### 9.2 svc-workflow service principal identity

```text
MODEL            = MachinePrincipal
PRINCIPAL_TYPE   = service
EXTERNAL_REF     = service:v1:principal:svc-workflow     (unique; new deterministic namespace)
DISPLAY_NAME     = svc-workflow service
AGENT_ID         = NULL
OWNER_USER_ID    = NULL
REQUEST_DIGEST   = NULL
STATUS           = active
```

`service:v1:` 是新的 deterministic external_ref namespace，与既有 `agentcore:v1:` /
`openclaw:` / `auth:` / `e2e:` 无碰撞（OBS-NSC-004）；principal 命名绑定 **caller
业务身份**（不绑定 audience），future 其他 agent-core audience 复用同一 principal
时必须另立 reviewed authority。

### 9.3 两个 dedicated Client external_ref 与 clientId 规则

```text
svc-forum client:
  MODEL            = MachineClient
  EXTERNAL_REF     = service:v1:client:svc-forum:agent-core-notification-ingress-v1
  CLIENT_ID        = 'mc_' + exactly 24 chars URL-safe base64 (A-Za-z0-9-_), no padding,
                     crypto RNG, fresh per caller, unique-check with retry (pattern:
                     STAGE_W_EXECUTION_V2 frozen format)
  STATUS           = active
  ALLOWED_RESOURCES = []   (legacy field; stays empty forever)
  ALLOWED_SCOPES    = []   (legacy field; stays empty forever)

svc-workflow client:
  EXTERNAL_REF     = service:v1:client:svc-workflow:agent-core-notification-ingress-v1
  CLIENT_ID        = same generation rule, independent draw, must differ from svc-forum's
  (all other fields identical in shape)
```

### 9.4 独立 secret 规则

```text
GENERATION = src/lib/oauth/secret.ts generateClientSecret() 语义：
            crypto.randomBytes(32) -> base64url（256-bit，独立 draw，两 caller 互不相同）
STORAGE    = secret_hash 列只存 scrypt "salt:hash"（16-byte salt hex, N=16384, r=8, p=1, dklen=64）
             —— 与现有 client secret 存储语法逐字一致；DB 中永不存 raw secret
LIFETIME   = raw secret 仅存在于 operator 进程内存 + 单次写入 §9.5 冻结 destination
DISTINCT_SECRET = YES（两次独立 RNG；禁止复制、派生、共享）
```

### 9.5 两个独立 secret handoff destination

```text
svc-workflow（destination 已存在，freeze 即可）:
  PATH  = /Users/yanfenma/.local/services/svc-workflow/.env
  MODE  = 0600, owner yanfenma（现状保持；operator 仅追加/更新两行，不重写整文件）
  KEYS  = AUTH_NOTIFICATION_INGRESS_CLIENT_ID / AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET

svc-forum（destination 需 precondition 建立；freeze 目标路径与形态）:
  PATH  = /Users/yanfenma/.local/services/svc-forum/notification-ingress.env
  MODE  = 0600, owner yanfenma（apply 前必须已创建且权限正确，否则 refuse）
  KEYS  = AUTH_NOTIFICATION_INGRESS_CLIENT_ID / AUTH_NOTIFICATION_INGRESS_CLIENT_SECRET
  消费  = forum 生产部署（当前 Docker 容器 svc-forum, 127.0.0.1:3460）在容器重建时
          由 owner 经其部署通道读取该文件注入 env；易失的 /tmp compose 通道不是
          合法 destination
```

两个 destination 物理隔离、内容互不含对方条目；secret 不得进入任何 git repo、
镜像、日志、report 或 stdout/stderr。

### 9.6 Exact Audience / Scope / Grant target

```text
每 caller 唯一一条 MachineAccessGrant：
  AUDIENCE_ID = agent-core-notification-ingress-v1   (exact; parent CTR-NI-001)
  SCOPES      = ['notification.deliver']             (exact; the only registered scope)
  VERSION     = 1
其余一切 audience/scope 组合 = forbidden（§11）
```

### 9.7 Exact apply-time preconditions（全部 fail-closed）

```text
P1  production auth_audiences 存在 audience_id='agent-core-notification-ingress-v1'
    且 status='active'，字段与 parent CTR-NI-001 完全一致（parent 的 versioned
    delta 已落地）；否则 refuse。
P2  external_ref 'service:v1:principal:svc-forum' 与 'service:v1:principal:svc-workflow'
    均不存在；否则 refuse（no adopt, no repair）。
P3  external_ref 'service:v1:client:svc-forum:agent-core-notification-ingress-v1' 与
    'service:v1:client:svc-workflow:agent-core-notification-ingress-v1' 均不存在；
    否则 refuse。
P4  不存在任何 active principal（任意类型）已以 agent_id/display_name/external_ref
    冒充 svc-forum / svc-workflow 的 service 业务身份；否则 refuse 并报 conflict。
P5  §9.5 两个 destination 路径存在、owner-only（0600）；svc-forum 侧文件由 owner
    先建；否则 refuse（不代建）。
P6  operator 运行于 clean Git worktree，HEAD = 冻结 SHA；本 Spec 已 accepted 且位于
    implementation base；否则 refuse。
P7  全库 audience='agent-core-notification-ingress-v1' 或 scope 含
    'notification.deliver' 的 grant 行数 = 0（apply 前）；否则 refuse 并报告完整
    碰撞坐标。
P8  DB 连接经由 trusted boundary（authsvc-owned .env / auth_ro 等既有可信通道）；
    server identity 校验通过；否则 refuse。
```

## 10. Future operator closure（本轮不实现）

未来实现限定为**一个封闭三文件闭包**（同 sibling 先例形态）：

```text
scripts/supply-notification-ingress-service-credentials-v1.ts   (offline operator)
scripts/run-notification-ingress-service-credentials-v1-conformance.sh
tests/oauth/supply-notification-ingress-service-credentials-v1.test.ts
```

封闭语义（全部为 MUST）：

```text
MODES          = --plan (default, read-only, zero writes) | --apply | --verify
FIXED_GIT_SHA  = apply 前校验 clean HEAD == 冻结 SHA（spec acceptance 后由
                 implementation review 冻结具体值；本 Spec 不预写未来 SHA）
ACCEPTED_GATE  = apply 前校验本 Spec status=accepted 且在 base branch
ISOLATION      = 每 caller 一个独立 serializable transaction：
                 advisory lock 813_947_205（新值；区别于 201/202/203/813_947_204）
                 + LOCK TABLE + §9 全部 precondition 复核
                 + principal + client + grant + GrantChangeAudit 同事务写入
                 + commit 前 end-state re-select + per-caller commit
                 两 caller 互不嵌套：一个 caller 失败不得伪造另一 caller 成功，
                 成功者照常生效并如实上报
NOOP           = exact rerun（P2/P3 命中由本 operator 前次产物构成、且 grant/audit
                 完全一致）= NOOP，零写入、零 secret 再生成
CONFLICT       = 任何 precondition 失败 = refuse + 零写入 + 完整冲突坐标输出
                 （不含 secret 材料）
SECRET_RULES   = raw secret memory-only；单次原子写（temp 0600 + rename）入 §9.5
                 destination；不落 stdout/stderr/report/日志/DB；
                 report 只含 clientId、principal/client/grant 坐标与 created 标志
OPTIMISTIC     = expected ABSENT -> resulting created（grant version 1；
                 audit change_type=create, before=null,
                 after=complete closed snapshot（含 principal/client/grant 全量
                 非 secret 投影），复用现有 grant_change_audits 封闭 envelope
                 （migration_id/source_git_commit/operator_id/approval_ref/reason）
SNAPSHOTS      = before：P1–P8 全部 absence/consistency 证明；after：两 caller
                 完整行投影（剔除 secret 材料）；report 持久化为 evidence artifact
RESIDUAL       = 事务结果三分类 COMMITTED / ROLLED_BACK / OUTCOME_UNKNOWN
                 （仅限 commit 后连接丢失）；OUTCOME_UNKNOWN 时 operator fail-loud、
                 输出复查指令，禁止猜测、禁止自动重试写路径
ROTATION       = 两 client 独立 rotate/revoke（各自 clientId 单独操作，经独立
                 future authority）；任何共享 rotation/revoke 入口 = forbidden
```

## 11. Grant target 与禁用集

每个 dedicated Client 的**唯一** Grant：

```text
audience = agent-core-notification-ingress-v1
scopes   = [notification.deliver]
```

Forbidden（任何一项出现 = operator refuse + review FAIL）：

```text
notification.*            wildcard / prefix
auth.identity.provision   (svc-auth management authority)
workflow.*                (含 workflow.read/write/execute/admin —— 86 fleet 与 canary 已有)
forum.*                   (含 forum.read/write —— 86 fleet 与 canary 已有)
delegation / OBO
Human Grant (human_audience_grants)
Agent principal Grant     (任何 agent-type principal 不得持有本 audience grant)
其他任何 Audience
```

## 12. 不可复用身份清单（frozen exclusions）

```text
EX-01  86 Agent fleet 的全部 Principal/Client/Credential
       （agentcore:v1:principal|client:agt_*，88 个 client 含 2 canary）
EX-02  svc-auth management 身份：
       principal 857b20c3-8d84-497d-950a-7b185a116687（openclaw:broker:provisioning）
       及其 client mc_prov_N9NO0yYvw_3fR1ucqusIqw（active）/
       mc_qO3Hecl2nAa3NircjiZWYKm5（revoked）—— svc-auth audience 的
       auth.identity.provision 持有者，禁止作为 caller 身份或 secret 复用
EX-03  stock/cto canary client：mc_OcPOL4l-8mUeiFJ0NoDxXHeG（agt_stock_agent）、
       mc_LDcrvuGB18vsjy_SEWfc_C61（agt_cto-agent）
EX-04  agent-type principal（含 workflow-provisioning-service
       00000000-0000-0000-0000-000000000001、svc-dogfood-user、各 canary/test）——
       principal_type 不符 parent CTR-NI-004
EX-05  OBO ADC Proxy / V1 E2E Caller / Verify Test / disabled validation canary
       四类既有 service principal —— 用途无关
EX-06  Auth Canary（auth:canary:agent:0623ba1a:client:adc-v2）
EX-07  legacy allowedResources/allowedScopes 字段（新 client 恒空；数据流零读写）
EX-08  任何形式的 shared secret / shared client（两 caller 之间或与任何第三方之间）
```

## 13. Contracts

### CTR-NSC-001 — Two distinct service principals

未来 operator MUST 为两个 caller 各创建一个独立 `MachinePrincipal`，字段逐字等于
§9.1/§9.2；两 principal UUID 不同；`principal_type=service`；不得复用任何既有
principal。

### CTR-NSC-002 — Two distinct dedicated clients

未来 operator MUST 为两个 caller 各创建一个独立 `MachineClient`，`external_ref`
逐字等于 §9.3，public `clientId` 按 §9.3 规则独立生成且互不相同；legacy 两列恒空。

### CTR-NSC-003 — Two distinct secrets, memory-only handoff

secret 按 §9.4 独立生成；raw secret 不得出现在 DB / stdout / stderr / report /
日志 / 任何 git artifact；单次写入 §9.5 冻结 destination；两 destination 互不混装。

### CTR-NSC-004 — Exact single Grant per client

每 client 恰一条 `MachineAccessGrant`：audience/scopes/version 逐字等于 §9.6；
§11 禁用集出现即 FAIL。

### CTR-NSC-005 — Audience registration is a precondition, not a side effect

operator MUST NOT 注册/修改 Audience 或 Contract Bundle；P1 不满足即 refuse。
Registry 落地只经 parent CTR-NI-005 的独立 reviewed versioned delta。

### CTR-NSC-006 — Closed three-file implementation closure

实现 PR 若获 merge authority，其 product-code 变更 MUST 恰为 §10 三文件；任何
第四文件、schema 变更、online API、`machine-admin` 复用 = out of scope。

### CTR-NSC-007 — Fixed-SHA, default read-only, fail-closed

operator MUST 满足 §10 的 FIXED_GIT_SHA / ACCEPTED_GATE / default `--plan` /
precondition P1–P8 / conflict refuse 语义；无 force / no-repair / no-adopt。

### CTR-NSC-008 — Per-caller transactional isolation and honest reporting

两 caller 独立事务；一个 caller 的失败/回滚 MUST NOT 影响另一 caller 的已提交
结果，MUST NOT 伪造成功；report 按 caller 分别给出
`COMMITTED | NOOP | REFUSED(CONFLICT) | ROLLED_BACK | OUTCOME_UNKNOWN`。

### CTR-NSC-009 — Same-transaction grant + audit

每 caller 事务内 MUST 同事务写入 grant 行与一条封闭 envelope 的
`grant_change_audits`（create, before=null, after=complete 非 secret 快照）；
audit 缺失或 envelope 不闭合 = 事务回滚。

### CTR-NSC-010 — Complete before/after snapshots

operator report MUST 含 P1–P8 before 证明与 after 完整行投影（剔除 secret 材料），
作为 evidence artifact 持久化（不进 git repo 的 secret 材料，坐标可进）。

### CTR-NSC-011 — Independent rotation/revocation

两 client 的 rotate/revoke MUST 各自独立（per-clientId）；不得引入任何共享
credential 生命周期操作。具体 rotate/revoke authority 属独立 future Spec。

### CTR-NSC-012 — No production effect from this Spec's lifecycle

本 Spec 的 propose/review/accept/merge MUST NOT 被解释为身份、credential、Grant、
registry、部署或 enforcement 的生效。

```text
PRODUCTION_GRANT_CHANGE = NONE
PRINCIPAL_CREATED = NO
CLIENT_CREATED = NO
SECRET_CREATED = NO
```

### CTR-NSC-013 — Apply-time re-verification

§9.7 preconditions 在 apply 事务内 MUST 重新以 live 查询验证（本 Spec 的
2026-08-24 观察只是 authoring evidence，不是 apply 时刻的事实）。

## 14. Acceptance（针对未来 implementation/review）

### ACC-NSC-001 — Identity distinctness

- Contracts: CTR-NSC-001, CTR-NSC-002
- Method: machine-compare 两 principal/client 全字段投影。
- Expected: 两 caller 各一行、字段逐字等于 §9.1–§9.3、UUID/clientId 互异。
- Failure: 任一字段漂移、复用、共享。

### ACC-NSC-002 — Grant exactness and prohibition negatives

- Contracts: CTR-NSC-004, CTR-NSC-005, §11
- Method: grant 投影 + 负面矩阵（wildcard / cross-audience / extra scope / agent
  principal / human grant 请求全部 refuse）。
- Expected: 恰两行 grant，scopes 恰为 `['notification.deliver']`；负面全部 fail-closed。

### ACC-NSC-003 — Secret non-disclosure

- Contracts: CTR-NSC-003
- Method: 审查 operator 输出、report、日志、DB dump：raw secret 零出现；
  destination 文件 0600 且只含本 caller 两键。
- Expected: 无泄漏；hash-only in DB。
- Failure: 任何 secret 材料出现在禁区内。

### ACC-NSC-004 — Rerun and conflict semantics

- Contracts: CTR-NSC-007, CTR-NSC-013
- Method: exact rerun = NOOP 零写入；构造 P1–P8 各失败场景 = refuse 零写入。
- Expected: 全部成立。
- Failure: 任何自动修复、adopt、部分写入。

### ACC-NSC-005 — Isolation and honest reporting

- Contracts: CTR-NSC-008, CTR-NSC-009, CTR-NSC-010
- Method: 单 caller 注入失败（如 P5 缺失）观察另一 caller 结果与 report 分类。
- Expected: 另一 caller 独立成功或独立失败，report 如实分列；audit 同事务。

### ACC-NSC-006 — Lifecycle no-production boundary（本 PR 即时生效）

- Contracts: CTR-NSC-012
- Method: diff 审查本 PR。
- Expected: 单一新 spec 文件；无产品代码、DB、credential、grant、deploy、merge。
- Failure: 任何被禁动作出现。

## 15. Alternatives and disposition

### ALT-NSC-001 — 复用既有 agent principal（如 workflow-provisioning-service）

- Disposition: rejected
- Reason: principal_type=service 是 parent CTR-NI-004 的硬性要求；agent 身份混用
  破坏 caller identity separation。

### ALT-NSC-002 — 两 caller 共用一个 client + secret

- Disposition: rejected（同 parent ALT-NI-003）
- Reason: 破坏独立 rotation/revocation 与审计归因。

### ALT-NSC-003 — 复用 svc-auth management credential / provisioning broker

- Disposition: rejected
- Reason: management authority 与业务 caller authority 必须隔离（`auth.identity.
  provision` 不得跨 Audience，parent CTR-NI-003）。

### ALT-NSC-004 — 在本 Spec 内同时注册 Audience（合并 CCR delta）

- Disposition: rejected
- Reason: parent CTR-NI-005 冻结 registry delta 为独立 reviewed versioned
  artifact；合并扩大本 Child 的 blast radius。

### ALT-NSC-005 — secret 经 stdout 一次性打印人工转抄

- Disposition: rejected
- Reason: 违反 memory-only handoff；stdout 进入日志与终端历史即永久化。

### ALT-NSC-006 — 用 machine-admin 通用命令逐条创建

- Disposition: rejected
- Reason: 非封闭闭包、无 fixed-SHA/audit/NOOP 语义、且其 create 语法绑定
  agentId/owner 与 legacy resources/scopes 字段。

## 16. Migration, compatibility, and rollback

```text
MIGRATION_THIS_ROUND   = NONE
DATABASE_CHANGE        = NONE
PRODUCTION_CHANGE      = NONE
PRINCIPAL_CREATED      = NO
CLIENT_CREATED         = NO
SECRET_CREATED         = NO
GRANT_APPLIED          = NO
CONTRACT_BUNDLE_CHANGE = NONE
MERGE_PERFORMED        = NO
ROLLBACK_THIS_ROUND    = delete/revise proposed branch before acceptance
FUTURE_ROLLBACK        = per-caller：revoke client（独立 authority）；audit 行不可变，
                         只前向补偿
```

## 17. Open questions

```text
OPEN_OWNER_DECISIONS       = NONE
NORMATIVE_TBD              = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION       = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

svc-forum destination 文件（§9.5）由 owner 在 apply 前创建是 precondition 而非
open question；其部署通道如何读取该文件属 forum 部署侧操作细节，不影响本 Spec
authority。

## 18. Frozen summary

```text
SPEC_ID                     = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_SERVICE_CREDENTIAL_GRANT_V1
STATUS                      = proposed
PARENT_AUTHORITY            = AUTH_SERVICE_AGENT_CORE_NOTIFICATION_INGRESS_AUDIENCE_CCR_V1 (accepted)
AUTHORING_BASE              = 45b1b890a0fcd3ca1aeb433dee85a0b3ae283689
SVC_FORUM_CLASSIFICATION    = CLEAN_SERVICE_BOOTSTRAP
SVC_WORKFLOW_CLASSIFICATION = CLEAN_SERVICE_BOOTSTRAP
AUDIENCE                    = agent-core-notification-ingress-v1
SCOPES                      = [notification.deliver]
TWO_DISTINCT_CLIENTS        = YES (service:v1:client:svc-forum:agent-core-notification-ingress-v1 |
                                       service:v1:client:svc-workflow:agent-core-notification-ingress-v1)
TWO_DISTINCT_PRINCIPALS     = YES (service:v1:principal:svc-forum | service:v1:principal:svc-workflow)
TWO_DISTINCT_SECRETS        = YES (independent 256-bit draws, memory-only handoff)
FORUM_HANDOFF               = /Users/yanfenma/.local/services/svc-forum/notification-ingress.env (0600, precondition)
WORKFLOW_HANDOFF            = /Users/yanfenma/.local/services/svc-workflow/.env (0600, existing)
IMPLEMENTATION_PERFORMED    = NO
PRODUCTION_APPLY            = NO
PRODUCTION_GRANT_CHANGE     = NONE
CREDENTIAL_CREATED          = NO
GRANT_APPLIED               = NO
MERGE_PERFORMED             = NO
READY_FOR_INDEPENDENT_REVIEW = YES
```

## 19. Acceptance provenance

```text
ACCEPTED_BY   = (pending independent review)
REVIEWED_SPEC_COMMIT = (pending)
REVIEW_VERDICT = (pending)
```
