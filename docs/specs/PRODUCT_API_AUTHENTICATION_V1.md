---
spec_id: PRODUCT_API_AUTHENTICATION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - product-api-local-tailnet-mobile-history-authentication
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3/dsh-agent-core maintainers
---

# PRODUCT_API_AUTHENTICATION_V1 — Tailnet-local Mobile History 身份边界 Child

```text
SPEC_GOVERNANCE_MODE = AUTHOR
PREFLIGHT_MODE = NEW
CHANGE_CLASS = NON_MECHANICAL
BASE = 044aebd73e991a655f1ec29c1533f92258df90e1 (91a0513f synced with 1fdf8c36)
AUTHORING_MAIN = 1fdf8c361f2010864f686d8310b68a40df5a5184
SPEC_STATUS = proposed
IMPLEMENTATION_ALLOWED_NOW = NO
EXECUTED_NOW = NO
```

## 1. Goal

冻结现有 Tailscale Tailnet 网络模式下，Mobile 重开 App 恢复当前 Agent Session 历史所需的
**最小** Product API caller 身份边界：只有「被允许的那台手机 Tailscale Node + 那个精确
Mobile surface + 该 surface 的权威 Binding」才能通过唯一授权路由读取当前 Agent 的 main
历史。本 Child 是 `AGENT_CORE_HARDENING_PROGRAM_V1` 指名留下的认证机制归属：它冻结
Tailnet peer 身份解析、Node/surface 精确配对、route admission、denial、auth config、
rotation/rollback 与 auth 日志隐私。它不实现代码、不启用 endpoint、不修改 Canary，也不
授权在本 proposed revision 上实施。

```text
AUTH_PROFILE = LOCAL_TAILNET_MOBILE_HISTORY_ONLY
LOCAL_TAILNET_IDENTITY_MODE = TAILSCALE_STABLE_NODE_ID_PLUS_EXACT_MOBILE_SURFACE
TAILNET_MEMBERSHIP_IS_AUTHORIZATION = NO
AGENT_CHILD_DIRECT_ACCESS = FORBIDDEN
AUTH_PROFILE_DEFAULT = DISABLED
```

## 2. Scope and non-goals

### 2.1 In scope

- 恰好一条授权路由：`GET /v1/agents/{agentId}/sessions/main/messages`；
- 直接 Tailnet peer 连接的 caller 身份解析（TCP remote address → 本机 tailscaled
  LocalAPI/WhoIs 结构化接口 → stable Tailscale Node ID）；
- Mobile surface 身份载体 `X-AgentCore-Surface-Id` 的验证与 trusted authContext 构造；
- exact `(stableTailscaleNodeId, surfaceId)` pair 授权；
- Git 之外 auth config 文件的逻辑 schema、加载与 readiness 语义；
- admission 顺序、denial 状态码、Agent-child/loopback/本机 Node 拒绝；
- 默认关闭与 activation 条件、配置轮换与回滚、auth 日志隐私。

### 2.2 Out of scope

`ALL_OTHER_PRODUCT_API_ROUTES = OUT_OF_SCOPE_AND_NOT_AUTHORIZED_BY_THIS_SPEC`。本 Child
不授权以下任何现有路由，它们当前的状态不因本 Child 被合法化或扩张：

```text
GET /v1/agents
GET /v1/binding
POST /v1/switch-agent
POST /v1/message
Notification Ingress
Agent-to-Agent delegation
任何公网入口
```

同样 out of scope：Session 内容、Binding 内容、History projection、JSONL 读取、Message
ID、pagination（归 sibling `MOBILE_SESSION_HISTORY_V1`）；公网 OAuth/Gateway/Product API
公网认证（本轮不设计，`PUBLIC_OAUTH_IMPLEMENTATION_THIS_ROUND = NONE`）；Mobile App
修改；tailscaled 本身的治理。

## 3. Authority and dependencies

1. `AGENT_CORE_HARDENING_PROGRAM_V1`（accepted，`main@1fdf8c36`）把 Product API 分类为
   `AUTHENTICATED_PRODUCT_SURFACE_CONTROL_PLANE`，当前状态
   `TRANSITIONAL_UNAUTHENTICATED_LOOPBACK`，目标状态
   `AUTHENTICATED_PRODUCT_SURFACE_CONTROL_PLANE`；`AGENT_CHILD_DIRECT_ACCESS =
   FORBIDDEN`、`EXPOSURE_BEYOND_LOOPBACK_BEFORE_AUTH = FORBIDDEN` 是上位边界。该
   Program 明文把具体认证协议（bearer、surface session credential 或等价机制）留给独立
   `PRODUCT_API_AUTHENTICATION_V1` child Spec 决定——本 Spec 就是该 child。
2. `AGENT_CORE_PRODUCT_ARCHITECTURE_V1`（accepted）冻结 Product API 为 Product Surface
   control plane 的 thin adapter 边界；本 Child 不改变该边界。
3. Sibling 依赖：proposed `MOBILE_SESSION_HISTORY_V1`（同 PR #124）的
   `LOCAL_TAILNET_HISTORY_ACTIVATION` 以本 Child 的 local profile ready 为前提；本 Child
   的 trusted authContext 是 History service 的唯一身份输入。两份 Spec 同为 proposed、
   依赖双向绑定、下一轮分别独立裁决；任一被拒不使另一份自动获得授权。
4. `mayf3/agent-core-mobile` Mobile consumer 与本机 tailscaled 都是外部依赖坐标，不是本
   仓库 governing authority；本 Child 不治理它们。

### 3.1 PREFLIGHT ownership ruling

现有 packages 无 caller-authentication owner：`product-api` 是被本 Child 约束的 HTTP
adapter；Router/Ingress 拥有 Binding 与路由而非 peer 身份；workspace-bootstrap 只拥有
Home 解析。因此 `PREFLIGHT_MODE = NEW`：Product API 的 admission/auth 层是本 Child 冻结
的新 authority，实现归属 Product API 进程内的独立 auth 前置层（不进入 Router）。它不是
第二个 Session/Binding owner：它验证 caller 并产出 trusted authContext，然后才允许读取
authoritative Binding。

## 4. Current State

- `STATE-PA-001` — 在 `mayf3/dsh-agent-core@1fdf8c36`，`AGENT_CORE_HARDENING_PROGRAM_V1`
  为 accepted 且其 Product API 约束仍是 `TRANSITIONAL_UNAUTHENTICATED_LOOPBACK` →
  `AUTHENTICATED_PRODUCT_SURFACE_CONTROL_PLANE`，认证机制归属本 Child。
  Basis: `OBS-PA-001`, `EVD-PA-001`。
- `STATE-PA-002` — 同一 main 上不存在 `docs/specs/PRODUCT_API_AUTHENTICATION_V1.md`，也
  没有同 stable ID 的其它 authority；本 Child 是新 authority。
  Basis: `OBS-PA-002`, `EVD-PA-002`。
- `STATE-PA-003` — PR #124 head `91a0513f` 的 `MOBILE_SESSION_HISTORY_V1` `CTR-SH-010`
  把 history route activation 绑定在「accepted + implemented 的
  `PRODUCT_API_AUTHENTICATION_V1`」上，而 main 上尚无该 child——即当前 Tailnet history
  被阻塞等待本 Child。
  Basis: `OBS-PA-003`, `EVD-PA-003`。
- `STATE-PA-004` — 本机 darwin 运行环境存在 tailscaled 进程与 `tailscale` CLI
  （`/usr/local/bin/tailscale`），即实现期存在可用的本地结构化身份接口候选；本轮未调用、
  未读取任何 WhoIs 数据、未钉住 revision。
  Basis: `OBS-PA-004`。

## 5. Observations

### OBS-PA-001 — Hardening Program 把认证机制留给本 Child

- Subject: `docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md` Product API 约束段落
- Repository/revision: `mayf3/dsh-agent-core@1fdf8c361f2010864f686d8310b68a40df5a5184`
- Environment: source worktree, no runtime execution
- Observed at: `2026-08-31T14:30:00Z`
- Method: `git show` + grep of the exact constraint blocks
- Result: 文本含 `PRODUCT_API_CLASSIFICATION = AUTHENTICATED_PRODUCT_SURFACE_CONTROL_PLANE`、
  `CURRENT_PRODUCT_API_STATE = TRANSITIONAL_UNAUTHENTICATED_LOOPBACK`、
  `AGENT_CHILD_DIRECT_ACCESS = FORBIDDEN`、`EXPOSURE_BEYOND_LOOPBACK_BEFORE_AUTH =
  FORBIDDEN`，并声明「bearer、surface session credential 或等价机制由独立
  `PRODUCT_API_AUTHENTICATION_V1` child Spec 决定」。
- Provenance: `docs/specs/AGENT_CORE_HARDENING_PROGRAM_V1.md`（main@1fdf8c36）

### OBS-PA-002 — main 上不存在本 Child 或同 stable ID authority

- Subject: `docs/specs/` tree at main
- Repository/revision: `mayf3/dsh-agent-core@1fdf8c361f2010864f686d8310b68a40df5a5184`
- Environment: local Git object database
- Observed at: `2026-08-31T14:30:00Z`
- Method: `git cat-file -e origin/main:docs/specs/PRODUCT_API_AUTHENTICATION_V1.md`（失败）
  与 `git grep PRODUCT_API_AUTHENTICATION origin/main -- docs/`（仅 Hardening Program 自身）
- Result: 无该文件；无同 stable ID authority；唯一提及者是父 Program 的指名。
- Provenance: 本地 Git 对象库

### OBS-PA-003 — History proposal 把 activation 绑定在本 Child 上

- Subject: PR #124 head 的 `MOBILE_SESSION_HISTORY_V1`
- Repository/revision: `mayf3/dsh-agent-core@91a0513f2b90ca924b7a46f455916fe4d5eae550`
- Environment: source worktree
- Observed at: `2026-08-31T14:30:00Z`
- Method: read `CTR-SH-010`
- Result: history route 默认 disabled，activation 要求 `PRODUCT_API_AUTHENTICATION_V1`
  accepted + present + implemented + ready；main 无该 child，故 Tailnet history 当前被阻塞。
- Provenance: `docs/specs/MOBILE_SESSION_HISTORY_V1.md` @ 91a0513f

### OBS-PA-004 — 本机存在 tailscaled 与 CLI

- Subject: 本机 darwin runtime
- Repository/revision: not a repository artifact（环境观察）
- Environment: `darwin 25.6.0 arm64`, host of mayf3 development
- Observed at: `2026-08-31T14:35:00Z`
- Method: `pgrep -l tailscaled`、`which tailscale`
- Result: tailscaled 进程运行中（pid 836）；`/usr/local/bin/tailscale` 存在。未调用
  LocalAPI、未读取 WhoIs、未记录任何 Node ID 或 Tailnet IP。
- Provenance: 本会话 shell 记录

## 6. Claims and assumptions

### CLM-PA-001 — stable Node ID + exact surface 构成最小充分身份边界

- Support state: INFERRED
- Supported by evidence: `EVD-PA-001`, `EVD-PA-004`
- Contradicted by evidence: none known
- Uncertainty: tailscaled LocalAPI 的确切 revision 行为须在实现期钉住验证；若 WhoIs 对
  某 peer 返回 unknown/ambiguous，`CTR-PA-002` 要求 fail closed

### CLM-PA-002 — Tailnet membership 单独不构成授权

- Support state: SUPPORTED
- Supported by evidence: `EVD-PA-001`（父 Program 的 `TAILNET` 与 caller-identity 边界）
- Contradicted by evidence: none known
- Uncertainty: none for V1；未来公网 OAuth 是独立 authority

## 7. Evidence relations

### EVD-PA-001 — 父 Program 观察支持身份边界 Claim

- Source observations: `OBS-PA-001`
- Target: `CLM-PA-001`, `CLM-PA-002`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/dsh-agent-core@1fdf8c36`, source-only, observed `2026-08-31T14:30:00Z`
- Strength/sufficiency: strong for authority ownership and boundary shape
- Limitations: 不证明 tailscaled 实际行为
- Provenance: Hardening Program text

### EVD-PA-002 — main 观察支持 NEW 分类

- Source observations: `OBS-PA-002`
- Target: `CLM-PA-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/dsh-agent-core@1fdf8c36`, observed `2026-08-31T14:30:00Z`
- Strength/sufficiency: sufficient for PREFLIGHT = NEW
- Limitations: 只覆盖当前 main
- Provenance: git object database query

### EVD-PA-003 — History 阻塞观察支持本 Child 的必要性

- Source observations: `OBS-PA-003`
- Target: `CLM-PA-001`
- Relation: SUPPORTS
- Bound coordinates: PR #124 @ 91a0513f, observed `2026-08-31T14:30:00Z`
- Strength/sufficiency: strong for the activation dependency
- Limitations: sibling 仍是 proposed
- Provenance: PR #124 head tree

### EVD-PA-004 — 本机环境观察支持 LocalAPI 可用性候选

- Source observations: `OBS-PA-004`
- Target: `CLM-PA-001`
- Relation: SUPPORTS
- Bound coordinates: darwin host, observed `2026-08-31T14:35:00Z`
- Strength/sufficiency: weak——只证明存在性，不证明接口行为
- Limitations: revision 未钉住；本 Child 不基于此 claim 授权任何实现
- Provenance: shell probe output

## 8. Decisions

### DEC-PA-001 — 唯一范围：local Tailnet Mobile history only

- Decision owner: repository owner mayf3（Owner Option 1 裁决）
- Decision: 本 Child 只冻结 `LOCAL_TAILNET_MOBILE_HISTORY_ONLY` profile 下恰好一条授权
  路由的身份边界；所有其它 Product API 路由与公网入口不被授权。
- Rejected alternative: 一次冻结全 Product API 认证或公网 OAuth。
- Reason: 当前产品目标只是 Tailnet 下 Mobile 重开恢复历史；扩大范围会引入未裁决的公网
  authority。

### DEC-PA-002 — 身份链来自 socket → tailscaled → stable Node ID

- Decision owner: repository owner mayf3
- Decision: 网络身份必须由服务端从 TCP remote peer address 出发，经本机 tailscaled
  LocalAPI/WhoIs 结构化接口解析为 stable Tailscale Node ID；caller 侧任何自我声明均无效。
- Rejected alternatives: 信任 `X-Forwarded-For`/`X-Real-IP`/自定义 caller header；仅按
  Tailscale IP allowlist；仅按 hostname；仅按 Tailnet membership；解析 `tailscale status`
  人类文本；request body 声明 caller identity。
- Reason: 只有 socket 对端事实 + tailscaled 权威映射不可被 caller 伪造。
- Remaining owner input: none

### DEC-PA-003 — Surface 载体与 trusted authContext

- Decision owner: repository owner mayf3
- Decision: 新 History GET 请求携带恰好一个 `X-AgentCore-Surface-Id` header；auth 层验证
  后产出 trusted authContext（principalType/surfaceId/authProfile），History service 只消费
  trusted context，不再读原始 header。
- Rejected alternative: 把 Node ID 直接下传给 History service，或让 History service 自行
  验证 header。
- Reason: 保持 auth 与 history 的单一职责边界，避免双重 owner。
- Remaining owner input: none

### DEC-PA-004 — exact Node/surface pair 授权

- Decision owner: repository owner mayf3
- Decision: 只有配置中存在精确 `(stableTailscaleNodeId, surfaceId)` pair 才授权；两个字段
  分别存在不构成授权。
- Rejected alternative: 分别验证「Node 在 allowlist」与「surface 存在」。
- Reason: 防止 allowed Node 搭配任意 surface、surface 被其它 Node 复用、surfaceId 跨设备
  复制。
- Remaining owner input: none

### DEC-PA-005 — auth config 位于 Git 之外

- Decision owner: repository owner mayf3
- Decision: 真实 Node ID、surfaceId 与 pair 永不进入 Git；通过单一外置文件
  （`PRODUCT_API_AUTH_CONFIG_FILE`）提供，schema 封闭、fail-loud、权限收紧。
- Rejected alternative: 代码内嵌 allowlist 或 Git 内 config。
- Reason: 设备身份是敏感稳定标识；入库即泄漏。
- Remaining owner input: none

### DEC-PA-006 — 默认关闭，条件启用

- Decision owner: repository owner mayf3
- Decision: `AUTH_PROFILE_DEFAULT = DISABLED`；只有本 Child 与 History Spec 均 accepted
  并进入 main、两份实现均通过独立审计、且运行时身份链各环节 ready 后，才允许实现期启用。
- Rejected alternative: 接受即默认启用。
- Reason: 父 Program 禁止未认证 exposure；两份 proposed Spec 均未授权实现。
- Remaining owner input: none

## 9. Contracts

### CTR-PA-001 — 唯一范围与授权路由

本 Child 授权的 route class 恰好是：

```text
GET /v1/agents/{agentId}/sessions/main/messages
```

`AUTHORIZED_ROUTE` 之外的任何方法或路径（含 `GET /v1/agents`、`GET /v1/binding`、
`POST /v1/switch-agent`、`POST /v1/message`、Notification Ingress、Agent-to-Agent
delegation、任何公网入口）MUST NOT 借用本 Child 的 auth profile 获得授权、ready 状态或
403/503 语义；它们当前的状态不因本 Child 被合法化或扩张。path 中 session selector 只有
字面量 `main`；其它值不属于本 Child 的授权面（由 sibling History Spec 以
`400 VALIDATION_ERROR` 拒绝，非本 Child 的 403）。

### CTR-PA-002 — Tailnet peer 身份链

网络身份 MUST 按以下链解析，且只在服务端发生：

```text
TCP remote peer address
→ 本机 tailscaled LocalAPI / WhoIs 结构化身份接口
→ stable Tailscale Node ID
→ exact allowlist match
```

实现 MUST NOT：接受客户端自我声明的 Node ID；信任 `X-Forwarded-For`、`X-Real-IP` 或任何
自定义 caller header 作为身份；仅按 Tailscale IP allowlist；仅按 hostname；仅按 Tailnet
membership；解析 `tailscale status` 人类可读文本作为权威；从 request body、query 或 path
读取 caller identity。连接 MUST 是直接 Tailnet peer；经 L7 proxy 的连接 MUST 拒绝。若
tailscaled 查询失败、返回 unknown、ambiguous 或多个候选 Node，MUST fail closed。实现期
MUST 钉住实际使用的 Tailscale client / LocalAPI revision 或可验证版本并记录；本轮不实现、
不钉住。

### CTR-PA-003 — Surface header 与 trusted authContext

History GET 请求 MUST 携带恰好一个 `X-AgentCore-Surface-Id: <opaque surfaceId>` header：

- 恰好出现一次；缺失、空值、重复、多值、超长（> 512 bytes）或非法编码全部拒绝；
- 不得从 query、body 或 path fallback；
- surfaceId 不是 secret，但 MUST 按敏感稳定标识处理：不得写入普通日志、错误响应或指标
  标签；
- Product API auth 层验证 pair（`CTR-PA-004`）成功后 MUST 构造 trusted authContext：

```text
principalType = mobile_surface
surfaceId     = verified opaque id
authProfile   = local-tailnet-mobile-history-v1
```

- 原始 stable Tailscale Node ID MUST NOT 下传给 Session history service；它只在 auth 层内部
  使用，或以不可逆 digest 进入受限审计事件。

### CTR-PA-004 — exact Node/surface 精确配对

授权判定 MUST 验证精确 pair `(stableTailscaleNodeId, surfaceId)`：只有配置中存在该精确
pair 才授权。实现 MUST NOT：允许 allowed Node 搭配任意 surface；允许 allowed surface 被
任意 Tailnet Node 复用；接受 surfaceId 从另一设备复制后的请求；因「两个字段分别存在」而
授权一个未声明 pair。

### CTR-PA-005 — auth config 文件边界与 readiness

真实 Node ID、surfaceId 与 pair MUST NOT 进入 Git。配置 MUST 通过单一明确的外置文件路径
`PRODUCT_API_AUTH_CONFIG_FILE` 提供，逻辑 schema 至少为：

```json
{
  "version": 1,
  "profile": "local-tailnet-mobile-history-v1",
  "allowedCallers": [
    { "tailscaleNodeId": "<outside-git>", "surfaceId": "<outside-git>" }
  ]
}
```

加载 MUST 满足：文件位于 Git 之外；owner 是 Runtime 受控身份；mode 不宽于 `0600`；regular
file only；禁止 symlink；schema 封闭；重复 pair fail-loud；未知字段 fail-loud；空
allowlist 不等于 allow all（空 allowlist = 没有授权 caller）。缺文件、权限错误、JSON 解析
错误、`version`/`profile` 不匹配时 `AUTH_PROFILE_READY = NO`，且 auth profile 未 ready 时
History route MUST NOT 激活（`CTR-PA-009`）。所有配置错误 MUST fail loud，MUST NOT 静默
降级为 allow-all 或 loopback 放行。

### CTR-PA-006 — 请求 admission 顺序

对每个请求 MUST 按以下精确顺序执行，任一步失败即按 `CTR-PA-007` 拒绝并停止：

1. canonical method/path 匹配；
2. 确认当前只处理 History allowlisted route（`CTR-PA-001`）；
3. 确认连接为直接 Tailnet peer，不经过 L7 proxy；
4. 从 socket remote address 查询 tailscaled identity；
5. 取得 stable Node ID；
6. 读取并验证 exact surface header（恰好一个，非空，合法编码）；
7. exact Node/surface pair match（`CTR-PA-004`）；
8. 构造 trusted authContext（`CTR-PA-003`）；
9. 此后才允许读取 authoritative Mobile Binding；
10. path `agentId` 必须等于 `Binding.activeAgent`；
11. 此后才允许调用 Session history service。

任一步失败时：MUST NOT 读取 Session 文件；MUST NOT 启动 Agent；MUST NOT 调用模型；MUST
NOT 改变 Binding；MUST NOT 改变 limiter 或其它 route 状态；MUST NOT 泄露是否存在某
Agent/Session；MUST NOT 把请求传给 History service。

### CTR-PA-007 — Denial 语义

所有未通过 `CTR-PA-006` 的请求 MUST 返回 `403`，错误 code 为
`PRODUCT_API_AUTH_FORBIDDEN`，包括但不限于：任意未列出的 Tailnet Node；allowed Node +
wrong surface；wrong Node + allowed surface；缺失/重复/malformed surface header；Mac 本机
Node；loopback caller；Agent child；其它同机进程；spoofed forwarding headers；以非
allowlisted 方法或 route 企图复用该 profile。

auth subsystem 未 ready（config 缺失/无效、tailscaled 接口不可用）时 MUST 返回唯一选定
状态 `503`，错误 code 为 `PRODUCT_API_AUTH_NOT_READY`。两个状态与 code 由本 Spec 冻结，
实现不得另行决定。

所有 denial 一并满足：

```text
ZERO_HISTORY_READ
ZERO_AGENT_SPAWN
ZERO_MODEL_CALL
ZERO_BINDING_MUTATION
```

### CTR-PA-008 — Agent child denial

`AGENT_CHILD_DIRECT_ACCESS = FORBIDDEN`。实现 MUST NOT 以 localhost、same uid、known
executable、known cwd 或 fixed binary path 作为合法身份。Agent child 即使经本机 Tailscale
地址访问，也 MUST NOT 匹配手机 Node ID；若身份解析结果为本机 Node、未知、多个或不确定，
MUST 拒绝。

### CTR-PA-009 — 默认关闭与 activation 条件

```text
AUTH_PROFILE_DEFAULT = DISABLED
LOCAL_TAILNET_HISTORY_ROUTE_DEFAULT = DISABLED
```

只有以下全部成立才允许实现期启用：本 Child Spec accepted 并进入 main；sibling
`MOBILE_SESSION_HISTORY_V1` accepted 并进入 main；两份实现均通过独立审计；Product API
直接绑定 Tailscale 地址（非公网 wildcard）；tailscaled identity 接口 ready；config 文件
valid；exact Node/surface pair 存在；authoritative Binding 存在；History endpoint
acceptance 通过。任一条件不成立时 route MUST 保持 absent/disabled；强制 enable 在
identity/config 未 ready 时 MUST fail startup closed（`PRODUCT_API_AUTH_NOT_READY`），MUST
NOT 挂载降级路由。

### CTR-PA-010 — 轮换与回滚

```text
ROTATION_MODE = VERSIONED_CONFIG_ATOMIC_REPLACEMENT
```

轮换协议至少要求：新配置先在临时文件完整验证；fsync + atomic rename（或等价原子替换）；
新旧 generation 可明确识别；restart/reload 行为必须明确，禁止悄悄部分生效；轮换后旧
Node/surface pair 立即不再授权；回滚恢复上一个已验证 generation；回滚 MUST NOT 改变
Binding、Session 或消息；轮换/回滚日志只记录 generation digest 和结果，MUST NOT 记录 raw
Node ID 或 surfaceId。

### CTR-PA-011 — 日志隐私

auth 层日志允许记录且仅允许：`requestId`、normalized route class、decision =
allow/deny/not_ready、auth profile version / generation digest、caller identity digest、
surface digest、status、latency。MUST NOT 记录：raw Tailscale Node ID、raw surfaceId、
Tailnet IP、message body、Session content、Authorization material、config 文件内容、Agent
Home 路径。

## 10. Acceptance

以下全部是未来 Acceptance 定义；本轮没有实现，没有执行。

```text
EXECUTED_NOW = NO
```

### ACC-PA-A — exact allowed phone Node + exact surface + exact route = allowed

- Contracts: `CTR-PA-001`, `CTR-PA-002`, `CTR-PA-003`, `CTR-PA-004`, `CTR-PA-006`
- Method: 用配置中声明的 exact `(phone Node, surfaceId)` pair 从该手机发起授权 GET
- Environment: isolated Tailnet acceptance environment；tailscaled revision 已钉住并记录
- Required evidence: config generation digest（无 raw 值）、请求/响应 envelope、admission
  顺序 trace
- Expected result: trusted authContext 形成，Binding 匹配，History service 被调用
- Failure condition: 任何 admission 步骤被跳过或顺序改变
- EXECUTED_NOW: NO

### ACC-PA-B — allowed Node + wrong surface = 403

- Contracts: `CTR-PA-004`, `CTR-PA-007`
- Method: allowed Node 携带未配对的 surfaceId 发起请求
- Environment: 同 A
- Required evidence: 请求/响应记录、History service 调用计数
- Expected result: `403 PRODUCT_API_AUTH_FORBIDDEN`；History service 调用次数 = 0
- Failure condition: 任何放行或部分读取
- EXECUTED_NOW: NO

### ACC-PA-C — wrong Node + allowed surface = 403

- Contracts: `CTR-PA-004`, `CTR-PA-007`
- Method: 未配置的 Tailnet Node 携带 allowed surfaceId 发起请求
- Environment: 同 A
- Required evidence: 请求/响应记录
- Expected result: `403 PRODUCT_API_AUTH_FORBIDDEN`
- Failure condition: surface 存在性被当作授权
- EXECUTED_NOW: NO

### ACC-PA-D — arbitrary Tailnet member = 403

- Contracts: `CTR-PA-002`, `CTR-PA-007`
- Method: 同 Tailnet 内任意未配置成员 Node 发起请求
- Environment: 同 A
- Required evidence: 请求/响应记录
- Expected result: `403 PRODUCT_API_AUTH_FORBIDDEN`；membership 本身不产生任何授权效果
- Failure condition: Tailnet membership 被当作授权
- EXECUTED_NOW: NO

### ACC-PA-E — Mac 本机 / loopback / Agent child = 403

- Contracts: `CTR-PA-007`, `CTR-PA-008`
- Method: 从 Mac 本机 Node、`127.0.0.1` loopback、以及已知 Agent child 进程分别发起请求
- Environment: 同 A
- Required evidence: 三类 caller 的请求/响应与进程证据
- Expected result: 全部 `403 PRODUCT_API_AUTH_FORBIDDEN`；本机 Node 解析不产生手机 Node 匹配
- Failure condition: same uid / localhost / known path 被当作身份
- EXECUTED_NOW: NO

### ACC-PA-F — spoofed XFF / forwarded / caller headers 无效

- Contracts: `CTR-PA-002`, `CTR-PA-007`
- Method: 携带伪造 `X-Forwarded-For`、`X-Real-IP`、自定义 caller header 的请求
- Environment: 同 A
- Required evidence: 请求/响应记录
- Expected result: 身份仅由 socket + tailscaled 决定；伪造头不改变结果
- Failure condition: 任何 header 影响身份解析
- EXECUTED_NOW: NO

### ACC-PA-G — missing / duplicate / malformed surface header 拒绝

- Contracts: `CTR-PA-003`, `CTR-PA-007`
- Method: 缺失、空值、重复、多值、超长、非法编码的 `X-AgentCore-Surface-Id` 变体
- Environment: 同 A
- Required evidence: 请求/响应记录
- Expected result: 全部 `403 PRODUCT_API_AUTH_FORBIDDEN`；无 query/body/path fallback
- Failure condition: 任何 fallback 或部分验证通过
- EXECUTED_NOW: NO

### ACC-PA-H — tailscaled 查询失败 / ambiguous / unknown = fail closed

- Contracts: `CTR-PA-002`, `CTR-PA-006`
- Method: fault-inject tailscaled 查询失败、unknown peer、ambiguous 多 Node 结果
- Environment: 同 A
- Required evidence: fault 注入记录与响应
- Expected result: 拒绝（not-ready 或 forbidden，按故障类别）；绝不放行不确定身份
- Failure condition: 不确定身份被当作任意已知 Node
- EXECUTED_NOW: NO

### ACC-PA-I — config absent / wrong mode / symlink / malformed / empty = not ready

- Contracts: `CTR-PA-005`, `CTR-PA-009`
- Method: 分别以缺文件、宽权限、symlink、坏 JSON、错误 profile、空 allowlist、重复 pair、
  未知字段启动/热载
- Environment: isolated runtime
- Required evidence: 启动/加载日志（仅 digest 与错误类别）、route 状态
- Expected result: `AUTH_PROFILE_READY = NO`；route 不激活；空 allowlist 不放行任何 caller；
  fail-loud 可观测
- Failure condition: 静默降级、allow-all、部分生效
- EXECUTED_NOW: NO

### ACC-PA-J — non-history route 或 wrong method 不得借用该 profile

- Contracts: `CTR-PA-001`, `CTR-PA-006`, `CTR-PA-007`
- Method: 用 exact 合法 pair 请求 `GET /v1/agents`、`GET /v1/binding`、
  `POST /v1/switch-agent`、`POST /v1/message` 及 wrong-method History 路径变体
- Environment: 同 A
- Required evidence: 请求/响应记录
- Expected result: 这些路由不因合法 pair 获得授权/ready/403 语义变化；状态保持其现有行为
- Failure condition: 本 Child 的 profile 为任何其它 route 提供授权
- EXECUTED_NOW: NO

### ACC-PA-K — denial 时 History service 调用次数 = 0，Session 读取字节 = 0

- Contracts: `CTR-PA-006`, `CTR-PA-007`
- Method: 对 B–J 各 denial 类别插桩 History service 调用计数与 Session 文件读取字节
- Environment: 同 A
- Required evidence: 计数器与字节计数（全程为 0）、进程/Binding 不变量
- Expected result: 所有 denial 满足 `ZERO_HISTORY_READ / ZERO_AGENT_SPAWN /
  ZERO_MODEL_CALL / ZERO_BINDING_MUTATION`
- Failure condition: 任何 denial 路径触发了 lookup、读取或状态变化
- EXECUTED_NOW: NO

### ACC-PA-L — exact pair 轮换后旧 pair 失效，新 pair 生效

- Contracts: `CTR-PA-010`
- Method: 以 atomic replacement 写入新 generation config；分别用旧 pair 与新 pair 请求
- Environment: isolated runtime
- Required evidence: generation digest 序列、原子替换证据（temp file + rename）、请求结果
- Expected result: 新 pair allowed；旧 pair 立即 `403`；无部分生效窗口
- Failure condition: 新旧 pair 同时有效或轮换半生效
- EXECUTED_NOW: NO

### ACC-PA-M — rollback 恢复旧 generation

- Contracts: `CTR-PA-010`
- Method: 轮换后执行回滚到上一已验证 generation，再分别验证两 pair
- Environment: isolated runtime
- Required evidence: generation digest 序列、请求结果、Binding/Session/消息不变量
- Expected result: 旧 generation pair 恢复授权、新 pair 失效；Binding、Session 与消息内容
  全程不变
- Failure condition: 回滚改变任何 Binding/Session 状态
- EXECUTED_NOW: NO

### ACC-PA-N — 日志无 raw Node ID、surfaceId、IP 或消息

- Contracts: `CTR-PA-011`
- Method: 对 allow/deny/not_ready 全路径采集日志，扫描 raw Node ID、raw surfaceId、
  Tailnet IP、消息正文、config 内容、Agent Home 路径
- Environment: 同 A
- Required evidence: 日志样本 + 扫描结果
- Expected result: 仅允许字段（requestId、route class、decision、digest、status、latency）
  出现
- Failure condition: 任何禁止值出现在日志/错误响应/指标标签
- EXECUTED_NOW: NO

### ACC-PA-O — public / non-Tailnet 入口始终拒绝

- Contracts: `CTR-PA-001`, `CTR-PA-007`
- Method: 从非 Tailnet 网络（公网/LAN 非Tailnet 地址）请求该 endpoint；并验证 Product API
  未绑定公网 wildcard
- Environment: isolated network probes
- Required evidence: 请求/响应与 bind 配置
- Expected result: 公网/非 Tailnet caller 不被本 Child 授权；无公网 exposure 被引入
- Failure condition: 公网入口复用 local profile 或获得任何授权
- EXECUTED_NOW: NO

### 10.1 Bidirectional coverage

| Contract | Acceptance coverage |
|---|---|
| `CTR-PA-001` | A, J, O |
| `CTR-PA-002` | A, D, F, H |
| `CTR-PA-003` | A, G |
| `CTR-PA-004` | A, B, C |
| `CTR-PA-005` | I |
| `CTR-PA-006` | A, H, J, K |
| `CTR-PA-007` | B, C, D, E, F, G, J, K, O |
| `CTR-PA-008` | E |
| `CTR-PA-009` | I |
| `CTR-PA-010` | L, M |
| `CTR-PA-011` | N |

Every Acceptance reference resolves to an active Contract, and every active Contract has at
least one Acceptance item.

## 11. Alternatives and disposition

| Alternative | Disposition | Reason |
|---|---|---|
| 公网 OAuth / Gateway 本轮一起做 | REJECTED | owner 裁决 `PUBLIC_OAUTH_AND_GATEWAY = LATER`；不越权设计公网 |
| Tailnet membership 即授权 | REJECTED | membership 是网络可达性，不是 caller identity |
| Tailscale IP allowlist | REJECTED | IP 可变可复用；非 stable identity |
| 信任 XFF / X-Real-IP / 自定义 caller header | REJECTED | caller 可伪造 |
| 客户端声明 Node ID / body 声明 identity | REJECTED | 自我声明不构成身份 |
| `tailscale status` 文本解析 | REJECTED | 人类可读文本非权威结构化接口 |
| allowed Node + 任意 surface 分别验证 | REJECTED | 破坏 exact pair，允许 surface 复用/复制 |
| surfaceId 当 secret（bearer token） | REJECTED | 父 Program 允许等价机制，但 Node/surface pair 更窄且不需密钥管理；surfaceId 仍按敏感稳定标识处理 |
| Node ID 下传 History service | REJECTED | 双重 owner；违反 trusted authContext 边界 |
| auth config 入 Git | REJECTED | 敏感稳定标识入库即泄漏 |

Investigation disposition: `NEW`；本 proposed Spec ready for independent semantic review，
不是 accepted implementation authority。

## 12. Migration, compatibility, and rollback

- Migration: none。本 Child 只新增 auth 前置层；现有 loopback 产品路径不受影响。
- Compatibility: 现有 `GET /v1/agents`、`GET /v1/binding`、`POST /v1/switch-agent`、
  `POST /v1/message` 的行为不因本 Child 改变。
- Rollout: 默认关闭；activation 条件见 `CTR-PA-009`。
- Rollback: `CTR-PA-010` 的 generation 回滚 + route disablement；无数据迁移。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
PUBLIC_OAUTH_AND_GATEWAY remains a future independent authority
```

Non-normative implementation debt: 实现期 preflight 必须钉住实际 Tailscale client /
LocalAPI revision、验证 WhoIs 对 phone peer 的返回形状，并把 revision 记录进实现 PR。该
选择不得改变任何 Contract 语义。

## 14. Authoring summary

```text
SPEC_ID = PRODUCT_API_AUTHENTICATION_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1
EXTERNAL_AUTHORITIES = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 11
CONTRACTS_WITH_ACCEPTANCE = 11
ACCEPTANCE_COUNT = 15
BIDIRECTIONAL_COVERAGE = 11/11 Contracts; 15/15 Acceptance references valid
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
MOBILE_CHANGE = NONE
CANARY_CHANGE = NONE
DEPLOYMENT_CHANGE = NONE
MERGE_PERFORMED = NO
```
