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
AMENDMENT_BASE = cf6df95492cd8477302a19e65d024bd5acad5d63
AMENDMENT_TRIGGER = audit comment 5480338347 (REQUEST_CHANGES): Auth blockers 1-5 + cross-spec blocker 12 (auth side)
AMENDMENT_DATE = 2026-09-02
SPEC_STATUS = proposed
IMPLEMENTATION_ALLOWED_NOW = NO
EXECUTED_NOW = NO
```

## 1. Goal

冻结现有 Tailscale Tailnet 网络模式下，Mobile 重开 App 恢复当前 Agent Session 历史所需的
**最小** Product API caller 身份边界：只有「被允许的那台手机 Tailscale Node（以其稳定
Node 标识识别）+ 那个精确的已配置 Mobile surface label」这一 principal 才能通过唯一授权
路由读取当前 Agent 的 main 历史。本 Child 是 `AGENT_CORE_HARDENING_PROGRAM_V1` 指名留下的
认证机制归属：它冻结 Tailnet peer 身份解析（含精确 Tailscale identity 字段与 peer 地址
canonicalization）、Node/surface 精确配对、route admission、denial、auth config
（restart-only immutable generation）、rotation/rollback/revocation 与 auth 日志隐私。它
不实现代码、不启用 endpoint、不修改 Canary，也不授权在本 proposed revision 上实施。

本 Child **只**做三件事：authenticate caller；validate 配置的 Node/surface exact pair；
输出 trusted authContext。它不读取业务 Binding——Binding 的唯一读取者是 History 层
（Owner Cross-Spec Ruling，见 §3.1）。

```text
AUTH_PROFILE = LOCAL_TAILNET_MOBILE_HISTORY_ONLY
LOCAL_TAILNET_IDENTITY_MODE = TAILSCALE_STABLE_NODE_ID_PLUS_EXACT_MOBILE_SURFACE_LABEL
PRINCIPAL = AUTHORIZED_PHONE_NODE_WITH_CONFIGURED_SURFACE_LABEL
TAILNET_MEMBERSHIP_IS_AUTHORIZATION = NO
AGENT_CHILD_DIRECT_ACCESS = FORBIDDEN
AUTH_PROFILE_DEFAULT = DISABLED
AUTH_LAYER_READS_BINDING = NO
BINDING_READ_OWNER = HISTORY_ONLY
ROUTE_PROFILE_MATCH = EXACT_HISTORY_GET_ONLY
L7_PROXY_FOR_LOCAL_PROFILE = FORBIDDEN
DIRECT_PEER_REQUIREMENT = DIRECT_TAILNET_SOCKET_PEER
CONFIG_ACTIVATION_MODE = RESTART_ONLY
CONFIG_GENERATION = IMMUTABLE_PER_PROCESS
REVOCATION_EFFECTIVE_AT = SUCCESSFUL_RUNTIME_RESTART
TAILSCALE_REVISION_OR_VERSION = 1.94.2 (commit 2de4d317a8c2595904f1563ebd98fdcf843da275)
MOBILE_APP_PROCESS_ATTESTATION = OUT_OF_SCOPE_FOR_V1
FORBIDDEN_STATUS = 403 (PRODUCT_API_AUTH_FORBIDDEN)
NOT_READY_STATUS = 503 (PRODUCT_API_AUTH_NOT_READY)
```

## 2. Scope and non-goals

### 2.1 In scope

- 恰好一条授权路由：`GET /v1/agents/{agentId}/sessions/main/messages`，且 profile 匹配
  语义是精确 method+path 匹配；不匹配者不属于本 profile（保持现有行为）；
- 直接 Tailnet peer 连接的 caller 身份解析（TCP remote address 的 canonicalization → 本机
  tailscaled LocalAPI `/localapi/v0/whois` → `apitype.WhoIsResponse.Node.StableID`，字段
  类型 `tailcfg.StableNodeID`；**不使用** transient `tailcfg.Node.ID`）；
- peer 地址 canonicalization：IPv4 / IPv6 / IPv4-mapped IPv6 / scope zone / port
  stripping / canonical textual 与 binary 表示；
- Mobile surface 身份载体 `X-AgentCore-Surface-Id` 的精确 canonical 编码验证与 trusted
  authContext 构造；
- principal claim 的诚实缩窄：授权的是 phone Node + configured surface label，不是精确
  App 进程；
- exact `(tailscaleStableNodeId, surfaceId)` pair 授权；
- Git 之外 auth config 文件的逻辑 schema（含 generation identity）、restart-only 加载与
  readiness 语义；
- admission 顺序、403/503 精确二分、Agent-child/loopback/本机 Node 拒绝；
- 默认关闭与 activation 条件、restart-only 配置轮换/失败替换/回滚/撤销、auth 日志隐私。

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

同样 out of scope：Session 内容、Binding 内容与读取（`BINDING_READ_OWNER =
HISTORY_ONLY`，归 sibling `MOBILE_SESSION_HISTORY_V1`）、History projection、JSONL 读取、
Message ID、pagination；公网 OAuth/Gateway/Product API 公网认证（本轮不设计，
`PUBLIC_OAUTH_IMPLEMENTATION_THIS_ROUND = NONE`）；Mobile App 修改；Mobile App 进程
attestation（`MOBILE_APP_PROCESS_ATTESTATION = OUT_OF_SCOPE_FOR_V1`）；tailscaled 本身的
治理。

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
   依赖双向绑定、下一轮分别独立裁决；任一被拒不使另一份自动获得授权。Binding 读取与
   `agentId = Binding.activeAgent` 比较的 owner 是 History 层；本 Child 不预读 Binding。
4. `mayf3/agent-core-mobile` Mobile consumer 与本机 tailscaled 都是外部依赖坐标，不是本
   仓库 governing authority；本 Child 不治理它们，但对二者的**可观察接口**（surface
   header 格式、LocalAPI whois 响应形状）以实证钉住（`OBS-PA-006`, `OBS-PA-007`）。

### 3.1 PREFLIGHT ownership ruling

现有 packages 无 caller-authentication owner：`product-api` 是被本 Child 约束的 HTTP
adapter；Router/Ingress 拥有 Binding 与路由而非 peer 身份；workspace-bootstrap 只拥有
Home 解析。因此 `PREFLIGHT_MODE = NEW`：Product API 的 admission/auth 层是本 Child 冻结
的新 authority，实现归属 Product API 进程内的独立 auth 前置层（不进入 Router）。

Owner Cross-Spec Ruling（冻结，消除 audit blocker 12 的 auth 侧）：

```text
AUTH_LAYER_READS_BINDING = NO
BINDING_READ_OWNER = HISTORY_ONLY
AUTH_CHILD_RESPONSIBILITY = authenticate caller; validate configured (StableID, surfaceId) pair; output trustedAuthContext
AUTH_CHILD_MUST_NOT = read Binding; compare path agentId against Binding; read Session
```

History 层在收到 trusted authContext 之后自行读取 authoritative Binding 并比较
`agentId = Binding.activeAgent`（字段名以 accepted Current Decision 的 `activeAgent`
为准；sibling Spec 文本内的拼写一致性归 sibling 修订）。本 Child 不是第二个
Session/Binding owner。

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
  （`/usr/local/bin/tailscale`），即实现期存在可用的本地结构化身份接口候选；本轮未调用
  LocalAPI、未读取任何 WhoIs 数据、未记录任何 Node ID 或 Tailnet IP。版本钉住见
  `STATE-PA-005`。
  Basis: `OBS-PA-004`。
- `STATE-PA-005` — 本机 Tailscale 运行版本已实证为 `1.94.2`（commit
  `2de4d317a8c2595904f1563ebd98fdcf843da275`，long `1.94.2-t2de4d317a`，go1.26.0）；
  且 tag `v1.94.2` 源码中：LocalAPI route `/localapi/v0/whois` 返回
  `apitype.WhoIsResponse{Node *tailcfg.Node; UserProfile *tailcfg.UserProfile; CapMap}`；
  `tailcfg.Node` 的稳定标识字段是 `StableID`（类型 `tailcfg.StableNodeID`，string）；
  `tailcfg.Node.ID`（类型 `tailcfg.NodeID`，int64）被上游文档明示「not stable across
  control plane URLs」；WhoIs 解析按 IP 进行（端口在 `ipp.Addr()` 处剥离），无匹配时
  handler 返回 404 "no match for IP:port"。身份字段选择已从「实现期开放」收敛为精确
  字段冻结。
  Basis: `OBS-PA-005`, `OBS-PA-006`, `EVD-PA-005`, `EVD-PA-006`。
- `STATE-PA-006` — Mobile 客户端 surfaceId 的实际线上格式已实证（read-only 代码检查）为
  canonical lowercase UUID v4：36 ASCII 字符、8-4-4-4-12 小写 hex、连字符分隔、version
  nibble `4`、variant nibble ∈ {8,9,a,b}，由 `Random.secure` 生成、本地持久化、不从
  agentId/设备信息推导。surface header 编码冻结必须匹配该客户端现实，不得凭想象改写。
  Basis: `OBS-PA-007`, `EVD-PA-007`。

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
- Result: tailscaled 进程运行中；`/usr/local/bin/tailscale` 存在。未调用 LocalAPI、未读取
  WhoIs、未记录任何 Node ID 或 Tailnet IP。
- Provenance: 本会话 shell 记录

### OBS-PA-005 — 本机 Tailscale 运行版本实证（amendment 新增）

- Subject: 本机 darwin runtime 的 `tailscale` CLI / tailscaled
- Repository/revision: not a repository artifact（环境观察）
- Environment: `darwin 25.6.0 arm64`
- Observed at: `2026-09-02`
- Method: `tailscale version`
- Result: `1.94.2`；`tailscale commit: 2de4d317a8c2595904f1563ebd98fdcf843da275`；
  `long version: 1.94.2-t2de4d317a`；`go version: go1.26.0`。未读取任何节点身份、
  Tailnet IP 或 WhoIs 数据。
- Provenance: 本会话 shell 记录

### OBS-PA-006 — Tailscale v1.94.2 源码中的精确 WhoIs 身份字段（amendment 新增）

- Subject: `tailscale/tailscale` source at tag `v1.94.2`（与 OBS-PA-005 的运行版本同源）
- Repository/revision: `tailscale/tailscale@v1.94.2`（commit `2de4d317a8c2595904f1563ebd98fdcf843da275`）
- Environment: upstream public source read（raw.githubusercontent.com，tag pinned）；本仓库不 vendored、不成为 local authority
- Observed at: `2026-09-02`
- Method: read exact source files:
  - `tailcfg/tailcfg.go`：`type NodeID ID`（附上游注释 "NodeIDs are not stable across
    control plane URLs. For more stable URLs, see [StableNodeID]."）；`type StableNodeID
    string`；`type Node struct { ID NodeID; StableID StableNodeID; Name string; ... }`
    （`StableID` 无自定义 JSON tag，JSON key 即 `StableID`）。
  - `ipn/localapi/localapi.go`：handler 表 `"whois": (*Handler).serveWhoIs`，路由前缀
    `/localapi/v0/`；`serveWhoIsWithBackend` 从 `addr` 参数取 `netip.ParseAddr` /
    `netip.ParseAddrPort`；查询失败时 handler 返回 `404 "no match for IP:port"`。
  - `ipn/ipnlocal/local.go`：`func (b *LocalBackend) WhoIs(proto string, ipp
    netip.AddrPort) (n tailcfg.NodeView, u tailcfg.UserProfile, ok bool)`，内部
    `cn.NodeByAddr(ipp.Addr())` → `cn.NodeByID(nid)`——按 **IP** 解析（端口在 `ipp.Addr()`
    处剥离），在当前 netmap 中查到**恰好一个** Node。
  - `client/tailscale/apitype/apitype.go`：`type WhoIsResponse struct { Node
    *tailcfg.Node; UserProfile *tailcfg.UserProfile; CapMap tailcfg.PeerCapMap }`——
    whois 端点序列化的正是该结构，`Node` 恒非 nil。
- Result: 精确稳定字段 = `WhoIsResponse.Node.StableID`（Go 类型 `tailcfg.StableNodeID`，
  JSON 字符串）；transient 字段 = `Node.ID`（`tailcfg.NodeID`，int64，上游明示跨
  control plane URL 不稳定）。WhoIs 输入语义 = 单个 IP（port 剥离）；结果语义 = 恰好一个
  Node 或明确失败。
- Provenance: `https://raw.githubusercontent.com/tailscale/tailscale/v1.94.2/{tailcfg/tailcfg.go, ipn/localapi/localapi.go, ipn/ipnlocal/local.go, client/tailscale/apitype/apitype.go}`

### OBS-PA-007 — Mobile surfaceId 实际生成格式（amendment 新增，read-only）

- Subject: `mayf3/agent-core-mobile` working tree, `lib/core/surface_identity.dart`
- Repository/revision: `mayf3/agent-core-mobile`（local checkout, read-only；未修改）
- Environment: source read only, no code execution
- Observed at: `2026-09-02`
- Method: read `lib/core/surface_identity.dart`（`_generateOpaqueId`）
- Result: surfaceId 由 `Random.secure` 生成 16 随机字节；`bytes[6] = (bytes[6] & 0x0F) |
  0x40`（version 4）、`bytes[8] = (bytes[8] & 0x3F) | 0x80`（variant 10）；以 Dart
  `toRadixString(16)`（小写 hex、两位补零）拼成 `8-4-4-4-12`、连字符分隔的 36 字符文本；
  首次生成后本地持久化（SharedPreferences key `product_surface.surface_id.v1`），重启复
  用；不从 agentId / device name / Android ID 推导。即 **canonical lowercase UUID v4**。
- Provenance: `/Users/yanfenma/workspace/project/agent-core-mobile/lib/core/surface_identity.dart`（read-only 检查记录）

## 6. Claims and assumptions

### CLM-PA-001 — stable Node ID + exact surface 构成最小充分身份边界

- Support state: INFERRED
- Supported by evidence: `EVD-PA-001`, `EVD-PA-004`, `EVD-PA-005`, `EVD-PA-006`
- Contradicted by evidence: none known
- Uncertainty: 若 WhoIs 对某 peer 返回 unknown/ambiguous，`CTR-PA-002`/`CTR-PA-007` 要求
  归入 not-ready 并 fail closed；tailscaled 行为随版本变化的风险由 revision 钉住与
  implementation-preflight 复核缓解（`CTR-PA-002`）

### CLM-PA-002 — Tailnet membership 单独不构成授权

- Support state: SUPPORTED
- Supported by evidence: `EVD-PA-001`（父 Program 的 `TAILNET` 与 caller-identity 边界）
- Contradicted by evidence: none known
- Uncertainty: none for V1；未来公网 OAuth 是独立 authority

### CLM-PA-003 — `Node.StableID` 是 v1.94.2 WhoIs 链路中唯一满足稳定性要求的节点标识字段

- Support state: SUPPORTED
- Supported by evidence: `EVD-PA-005`（运行版本 = 1.94.2）, `EVD-PA-006`（该 tag 源码中
  `StableNodeID` 的存在与 `NodeID` 的上游非稳定性注释）
- Contradicted by evidence: none known
- Uncertainty: 上游未来版本若改变字段语义，须以新 amendment 重钉；`CTR-PA-002` 已把
  「运行版本 ≠ 钉住版本」定义为 implementation-blocking drift

### CLM-PA-004 — Mobile surfaceId 线上格式是 canonical lowercase UUID v4

- Support state: SUPPORTED
- Supported by evidence: `EVD-PA-007`
- Contradicted by evidence: none known
- Uncertainty: 仅覆盖当前 Mobile 源码状态；若客户端格式演进，须先修订本 Spec 的
  surface 编码冻结（`CTR-PA-003`），不得由实现单方面适配

### CLM-PA-005 — node-scoped configured label principal 是诚实而非夸大的 V1 主张

- Support state: SUPPORTED
- Supported by evidence: `EVD-PA-007`（label 是本机文件中的可复制字符串）, Owner 裁决
  （`DEC-PA-009`）
- Contradicted by evidence: none known
- Uncertainty: 同授权手机上的其它本机进程若读取/复制该 label，可以在身份面上与 App 进程
  不可区分；本 Spec 把这明示为 V1 phone-node trust boundary 内的接受残余风险
  （`CTR-PA-012`），并以 `ACC-PA-Q` 诚实验证，而不是声称不存在的进程隔离

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
- Limitations: 行为语义由 OBS-PA-006 的源码实证补足；本 Child 不基于此 claim 授权任何实现
- Provenance: shell probe output

### EVD-PA-005 — 运行版本实证支撑 revision 钉住（amendment 新增）

- Source observations: `OBS-PA-005`
- Target: `CLM-PA-003`, `CLM-PA-001`
- Relation: SUPPORTS
- Bound coordinates: darwin host, observed `2026-09-02`
- Strength/sufficiency: strong for `TAILSCALE_REVISION_OR_VERSION` 的精确取值
- Limitations: 只证明本机当前版本；不证明未来升级
- Provenance: `tailscale version` output（本会话 shell 记录）

### EVD-PA-006 — 源码实证支撑精确字段冻结（amendment 新增）

- Source observations: `OBS-PA-006`
- Target: `CLM-PA-003`, `CLM-PA-001`
- Relation: SUPPORTS
- Bound coordinates: `tailscale/tailscale@v1.94.2`, observed `2026-09-02`
- Strength/sufficiency: strong——字段名、类型、JSON key、解析路径、失败语义全部来自所读
  源码原文，非记忆
- Limitations: 单一 tag；不覆盖其它版本
- Provenance: upstream source at tag `v1.94.2`（URL 见 OBS-PA-006）

### EVD-PA-007 — Mobile 客户端格式实证支撑 surface 编码冻结（amendment 新增）

- Source observations: `OBS-PA-007`
- Target: `CLM-PA-004`, `CLM-PA-005`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/agent-core-mobile` local checkout, read-only, observed `2026-09-02`
- Strength/sufficiency: strong for 当前客户端格式；surface label 的可复制性直接支持
  principal 缩窄的必要性
- Limitations: 单一源码状态；Mobile 未来改动需回看
- Provenance: `lib/core/surface_identity.dart` read-only 记录

## 8. Decisions

### DEC-PA-001 — 唯一范围：local Tailnet Mobile history only

- Decision owner: repository owner mayf3（Owner Option 1 裁决）
- Decision: 本 Child 只冻结 `LOCAL_TAILNET_MOBILE_HISTORY_ONLY` profile 下恰好一条授权
  路由的身份边界；所有其它 Product API 路由与公网入口不被授权。
- Rejected alternative: 一次冻结全 Product API 认证或公网 OAuth。
- Reason: 当前产品目标只是 Tailnet 下 Mobile 重开恢复历史；扩大范围会引入未裁决的公网
  authority。

### DEC-PA-002 — 身份链来自 socket → tailscaled → `Node.StableID`（精确字段）

- Decision owner: repository owner mayf3
- Decision: 网络身份必须由服务端从 TCP remote peer address 出发，先按 `CTR-PA-013`
  canonicalize，再经本机 tailscaled LocalAPI `/localapi/v0/whois` 结构化接口解析为
  `apitype.WhoIsResponse.Node.StableID`（类型 `tailcfg.StableNodeID`，string）；caller 侧
  任何自我声明均无效。授权与配置只使用 `StableID`；transient `tailcfg.Node.ID`（int64）
  MUST NOT 用于任何授权判定或配置。identity 接口 revision 钉住为 `TAILSCALE_REVISION_OR_VERSION = 1.94.2 (commit 2de4d317a8c2595904f1563ebd98fdcf843da275)`。
- Rejected alternatives: 信任 `X-Forwarded-For`/`X-Real-IP`/自定义 caller header；仅按
  Tailscale IP allowlist；仅按 hostname；仅按 Tailnet membership；解析 `tailscale status`
  人类文本；request body 声明 caller identity；使用 transient `Node.ID`。
- Reason: 只有 socket 对端事实 + tailscaled 权威映射不可被 caller 伪造；`StableID` 是上
  游明确提供的稳定标识，`Node.ID` 被上游明示不稳定。
- Remaining owner input: none

### DEC-PA-003 — Surface 载体与 trusted authContext（Binding 不进入 auth 层）

- Decision owner: repository owner mayf3
- Decision: 新 History GET 请求携带恰好一个 `X-AgentCore-Surface-Id` header；auth 层验证
  canonical 编码与 exact pair 后产出 trusted authContext（`principalType =
  mobile_tailnet_node` / verified surfaceId / authProfile / configGeneration）。History
  service 只消费 trusted context，不再读原始 header；**auth 层不读取 Binding**，
  Binding 读取与 `agentId = Binding.activeAgent` 比较 owner 是 History 层。
- Rejected alternatives: 把 Node ID 直接下传给 History service；让 History service 自行
  验证 header；由 auth 层预读 Binding/比较 agent（audit blocker 12 的双 owner 冲突源）。
- Reason: 保持 auth / history 单一职责边界；Binding 只有唯一 reader。
- Remaining owner input: none

### DEC-PA-004 — exact `(StableID, surfaceLabel)` pair 授权

- Decision owner: repository owner mayf3
- Decision: 只有配置中存在精确 `(tailscaleStableNodeId, surfaceId)` pair 才授权；两个字段
  分别存在不构成授权。
- Rejected alternative: 分别验证「Node 在 allowlist」与「surface 存在」。
- Reason: 防止 allowed Node 搭配任意 surface、surface 被其它 Node 复用、surfaceId 跨设备
  复制。
- Remaining owner input: none

### DEC-PA-005 — auth config 位于 Git 之外，generation 为一等身份

- Decision owner: repository owner mayf3
- Decision: 真实 StableID、surfaceId 与 pair 永不进入 Git；通过单一外置文件
  （`PRODUCT_API_AUTH_CONFIG_FILE`）提供，schema 封闭、fail-loud、权限收紧，且 MUST 含
  显式 `generation` 身份（restart-only 加载，见 `DEC-PA-010`）。
- Rejected alternative: 代码内嵌 allowlist 或 Git 内 config。
- Reason: 设备身份是敏感稳定标识；入库即泄漏；generation 是审计与撤销语义的最小锚点。
- Remaining owner input: none

### DEC-PA-006 — 默认关闭，条件启用

- Decision owner: repository owner mayf3
- Decision: `AUTH_PROFILE_DEFAULT = DISABLED`；只有本 Child 与 History Spec 均 accepted
  并进入 main、两份实现均通过独立审计、且运行时身份链各环节 ready 后，才允许实现期启用。
- Rejected alternative: 接受即默认启用。
- Reason: 父 Program 禁止未认证 exposure；两份 proposed Spec 均未授权实现。
- Remaining owner input: none

### DEC-PA-007 — Route ownership：profile 只匹配精确 history GET（audit blocker 4 修正）

- Decision owner: repository owner mayf3（Owner Cross-Spec Ruling 冻结）
- Decision: `AUTH_PROFILE_MATCHES_ONLY = GET /v1/agents/{agentId}/sessions/main/messages`
  （method + path 全精确）。只有匹配该 route 后，本 Child 的 auth 逻辑才运行。其它任何
  route/method：`NOT_HANDLED_BY_THIS_AUTH_PROFILE`、`PRESERVE_EXISTING_BEHAVIOR`；本
  Child 不得对其强制 403/503。wrong method / wrong route ≠ auth forbidden，只是「不匹配
  此 profile」。
- Rejected alternatives: 全 Product API 统一 auth 栅栏（改变现有 route 行为）；对
  non-profile 请求也返回 403（与 `CTR-PA-001` 的 preserve-existing-behavior 直接冲突，
  是 audit blocker 4 的根源）。
- Reason: 本 Child 是窄 profile 的 caller 身份边界，不是 Product API 全局闸门；状态码
  所有权必须唯一。
- Remaining owner input: none

### DEC-PA-008 — 403/503 精确二分，禁止实现自由选择（audit blocker 4 修正）

- Decision owner: repository owner mayf3（Owner 裁决冻结）
- Decision: profile 匹配的请求上，denial 只有两种且一一对应：
  `403 PRODUCT_API_AUTH_FORBIDDEN` = 身份系统健康但 caller 不被允许；
  `503 PRODUCT_API_AUTH_NOT_READY` = 无法安全完成认证。分类矩阵冻结于 `CTR-PA-007`，
  禁止任何 "403 or 503 implementation choice"。
- Rejected alternatives: 按故障类别自由选择状态；为 surface header 非法引入 400。
- Reason: 消除歧义才能被 acceptance 精确判定（403 matrix / 503 matrix 各自唯一）。
- Remaining owner input: none

### DEC-PA-009 — Principal 缩窄为 Node + configured label（audit blocker 3 修正）

- Decision owner: repository owner mayf3（Owner 裁决冻结）
- Decision: `PRINCIPAL = AUTHORIZED_PHONE_NODE_WITH_CONFIGURED_SURFACE_LABEL`。surfaceId
  是 non-secret configured label；surfaceId ≠ App process credential；surfaceId ≠ App
  attestation。同一授权手机上的其它本机进程若能读取/复制 surface label，在 V1 phone-node
  trust boundary **内**（诚实接受，`CTR-PA-012`）。`MOBILE_APP_PROCESS_ATTESTATION =
  OUT_OF_SCOPE_FOR_V1`；本 Spec 不再声称认证了精确 App 进程。
- Rejected alternatives: 继续声称「精确 Mobile surface/进程」认证（超出证据）；本轮引入
  surface credential 或 attestation 机制（未裁决的新 authority）。
- Reason: header 是 caller-supplied 非 secret 字符串，任何更强的主张都不可证明；诚实缩窄
  才能与 acceptance 一致。
- Remaining owner input: 未来 attestation 是独立 authority 的候选，本轮不设计。

### DEC-PA-010 — Config generation：restart-only、per-process immutable（audit blocker 5 修正）

- Decision owner: repository owner mayf3（Owner 裁决冻结）
- Decision: `CONFIG_ACTIVATION_MODE = RESTART_ONLY`；禁止本 V1 hot reload。进程启动时读
  取**一个**完整配置、验证、构建 immutable `AuthConfigGeneration`；整个进程生命周期
  `AUTH_CONFIG_GENERATION = IMMUTABLE_PER_PROCESS`；每个请求天然使用同一 generation；配
  置文件修改不自动生效，必须 graceful restart 才激活；`REVOCATION_EFFECTIVE_AT =
  SUCCESSFUL_RUNTIME_RESTART`。
- Rejected alternatives: hot reload / file watcher / per-request 重新读盘 / 双 generation
  并存。
- Reason: 结构性关闭 mixed generation、concurrent reload、failed reload、partial
  activation 整类缺陷；撤销语义诚实到 restart。
- Remaining owner input: none

### DEC-PA-011 — Direct peer only；L7 proxy 对 local profile 禁止（audit blocker 2 修正）

- Decision owner: repository owner mayf3（Owner 裁决冻结）
- Decision: Auth profile 只允许 `DIRECT_TAILNET_SOCKET_PEER`；
  `L7_PROXY_FOR_LOCAL_PROFILE = FORBIDDEN`——本 profile 的 Product API 监听必须直接位于
  Tailscale 接口上，不得部署在任何 L7 proxy 之后，且 MUST NOT 读取任何转发 header。判定
  规则是闭合的：身份 = WhoIs(真实 socket peer)；若路径上存在 proxy（phone → proxy node →
  Product API），WhoIs 只能看到 proxy Node，其 StableID 不是配置的 phone StableID →
  403；proxy 转发的「原始 caller」header 一律无效。同一授权 phone Node 内的代理/其它进程
  属于 Node principal trust boundary（`CTR-PA-012`），不得声称精确 App process isolation。
- Rejected alternatives: 允许受信 proxy 并解析其转发头（重新引入可伪造身份面）。
- Reason: WhoIs 所见即 TCP 对端，规则闭合且可被真实 proxy acceptance 证伪
  （`ACC-PA-F`）。
- Remaining owner input: none

## 9. Contracts

### CTR-PA-001 — 唯一授权路由与 profile 匹配语义

本 Child 授权的 route class 恰好是：

```text
GET /v1/agents/{agentId}/sessions/main/messages
```

`ROUTE_PROFILE_MATCH = EXACT_HISTORY_GET_ONLY`：只有 canonical method（`GET`）与
canonical path class（`/v1/agents/{agentId}/sessions/main/messages`，`agentId` 为单段
path 参数）**同时**精确匹配时，请求才进入本 profile 的 admission（`CTR-PA-006`）。任何
其它 method 或 path——含 `GET /v1/agents`、`GET /v1/binding`、`POST /v1/switch-agent`、
`POST /v1/message`、Notification Ingress、Agent-to-Agent delegation、任何公网入口、对
history path 的 wrong-method 变体、以及 session selector ≠ 字面量 `main` 的 path——

```text
PROFILE_MATCH_RESULT = NOT_HANDLED_BY_THIS_AUTH_PROFILE
REQUIRED_BEHAVIOR = PRESERVE_EXISTING_BEHAVIOR
```

即：不得借用本 Child 的 auth profile 获得授权、ready 状态或 403/503 语义；不得因本
Child 的失败而改变行为；它们当前的状态不因本 Child 被合法化或扩张。wrong method /
wrong route ≠ auth forbidden。session selector ≠ `main` 的拒绝语义由 sibling History
Spec 拥有（`400 VALIDATION_ERROR`），不是本 Child 的 403。本 Child 的 auth 日志只针对
profile 匹配的请求。

### CTR-PA-002 — Tailnet peer 身份链与精确 Tailscale identity

网络身份 MUST 按以下链解析，且只在服务端发生：

```text
TCP remote peer address（accepted socket 的真实对端）
→ canonicalization（CTR-PA-013）
→ 本机 tailscaled LocalAPI GET /localapi/v0/whois?addr=<canonical peer IP>
→ apitype.WhoIsResponse（JSON：Node / UserProfile / CapMap）
→ Node.StableID（tailcfg.StableNodeID，string；JSON key "StableID"）
→ exact allowlist match（CTR-PA-004）
```

`TAILSCALE_REVISION_OR_VERSION = 1.94.2 (commit 2de4d317a8c2595904f1563ebd98fdcf843da275;
long 1.94.2-t2de4d317a)`（`OBS-PA-005`）。实现 MUST 钉住并记录该 revision；实现期
preflight MUST 复核运行时 tailscaled 版本——若 ≠ 钉住版本，MUST 先产出修订本 Contract 的
amendment 再实现（implementation-blocking drift）；身份字段语义不得随版本静默漂移。

授权判定 MUST 且只能使用 `WhoIsResponse.Node.StableID`。MUST NOT：使用 transient
`tailcfg.Node.ID`（int64）作为授权或配置标识；接受客户端自我声明的 Node ID/StableID；
信任 `X-Forwarded-For`、`X-Real-IP` 或任何自定义 caller header 作为身份；仅按 Tailscale
IP allowlist；仅按 hostname；仅按 Tailnet membership；解析 `tailscale status` 人类可读
文本作为权威；从 request body、query 或 path 读取 caller identity。WhoIs 查询输入
MUST 且只能是真实 accepted socket 对端地址 canonicalize 后的 IP（端口已剥离）。

连接 MUST 是 `DIRECT_TAILNET_SOCKET_PEER`；`L7_PROXY_FOR_LOCAL_PROFILE = FORBIDDEN`
（`DEC-PA-011`）。WhoIs 结果解析边界 MUST fail closed：查询传输失败（tailscaled 不可达、
超时、HTTP 错误）、响应非合法 `WhoIsResponse` 形状、Node 缺失、StableID 缺失或空、任何
unknown/多候选 ambiguous 结果 → 一律 not-ready（`CTR-PA-007` 503 类），MUST NOT 当作任
何已知 Node。

### CTR-PA-003 — Surface header 精确编码与 trusted authContext

History GET（profile 匹配）请求 MUST 携带恰好一个 `X-AgentCore-Surface-Id` header，值
MUST 是 **canonical lowercase UUID v4**（与 Mobile 客户端实际格式逐字一致，`OBS-PA-007`）：

```text
SURFACE_HEADER = X-AgentCore-Surface-Id
SURFACE_LABEL_FORMAT:
  canonical lowercase UUID v4（RFC 4122 canonical textual form）
  36 ASCII bytes；8-4-4-4-12 小写 hex，U+002D 连字符分隔
  version nibble = '4'；variant nibble ∈ { 8, 9, a, b }
  regex: ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$
SURFACE_HEADER_RULES:
  - 恰好出现一次；缺失、空值、重复 field line、多值、逗号 list 语法全部拒绝；
  - no surrounding whitespace tolerance：auth 层在 HTTP 层 field-value 提取之后 MUST NOT
    再做任何 trim/fold/case 归一；只有与 canonical form 逐字节相等的值通过；任何需要额
    外归一化才能通过的值一律拒绝；
  - 拒绝大写 hex、缺/多连字符、花括号、urn: 前缀、非 ASCII、超长（> 36 bytes 即非法）；
  - 不得从 query、body 或 path fallback；
  - 违规唯一语义 = 403 PRODUCT_API_AUTH_FORBIDDEN（CTR-PA-007）；本 Child 不引入 400。
```

surfaceId 不是 secret，但 MUST 按敏感稳定标识处理：不得写入普通日志、错误响应或指标
标签（`CTR-PA-011`）。配置侧 MUST 存储逐字节相同的 canonical form；匹配是 exact bytes
匹配，双侧都不得做大小写折叠或 trimming。

pair 验证成功后 auth 层 MUST 构造 trusted authContext，schema 恰好为：

```text
TrustedAuthContext {
  principalType    = mobile_tailnet_node
  surfaceId        = <verified configured label（canonical form）>
  authProfile      = local-tailnet-mobile-history-v1
  configGeneration = <config generation 的 digest/id>
}
```

TrustedAuthContext MUST NOT 包含：raw `tailcfg.StableID` 或 `tailcfg.Node.ID`；Binding
数据或引用；agentId 授权结果；Session 数据。raw StableID 只在 auth 层内部使用，或以不
可逆 digest 进入受限审计事件（`CTR-PA-011`）；MUST NOT 下传给 Session history service。

### CTR-PA-004 — exact `(tailscaleStableNodeId, surfaceId)` 精确配对

授权判定 MUST 验证精确 pair `(tailscaleStableNodeId, surfaceId)`：只有配置中存在该精确
pair（`tailscaleStableNodeId` = WhoIs 解析出的 `Node.StableID` 逐字节相等 **且**
`surfaceId` = header 值逐字节相等，且二者属于同一个 `allowedCallers` 条目）才授权。实现
MUST NOT：允许 allowed Node 搭配任意 surface；允许 allowed surface 被任意 Tailnet Node
复用；接受 surfaceId 从另一设备复制后的请求（除非复制者也恰好是被允许的同一 Node——见
`CTR-PA-012` 的诚实边界）；因「两个字段分别存在」而授权一个未声明 pair；用 transient
`Node.ID` 的数值文本充当 `tailscaleStableNodeId` 参与匹配。

### CTR-PA-005 — auth config 文件边界、generation schema 与 readiness

真实 StableID、surfaceId 与 pair MUST NOT 进入 Git。配置 MUST 通过单一明确的外置文件路
径 `PRODUCT_API_AUTH_CONFIG_FILE` 提供，逻辑 schema 恰好为（closed schema）：

```json
{
  "version": 1,
  "generation": "<operator-chosen opaque string/UUID；MUST NOT 含 secret>",
  "profile": "local-tailnet-mobile-history-v1",
  "allowedCallers": [
    { "tailscaleStableNodeId": "<outside-git>", "surfaceId": "<outside-git>" }
  ]
}
```

字段语义冻结：`version` 必须 = `1`；`generation` 必须 = operator 选定的 opaque 非空字
符串（如 UUID），不得含任何 secret，运行时日志只写其 digest（`CTR-PA-011`）；`profile`
必须 = `local-tailnet-mobile-history-v1`；`allowedCallers` 是 exact pair 列表。未知字
段 → reject；重复 pair → reject；空 `allowedCallers` ≠ allow all（空列表 = 没有任何授
权 caller）。

`CONFIG_ACTIVATION_MODE = RESTART_ONLY`：进程启动时读取该文件**一次**，完整验证后构建
immutable `AuthConfigGeneration`；`AUTH_CONFIG_GENERATION = IMMUTABLE_PER_PROCESS`——整
个进程生命周期不重读、不热载、不部分更新；每个请求天然使用同进程的唯一 generation；
运行期对配置文件的任何修改（含轮换写入）都不自动生效。

加载/验证 MUST 满足：文件位于 Git 之外；owner 是 Runtime 受控身份（expected owner）；
mode 不宽于 `0600`；regular file only；禁止 symlink；schema 封闭；fail-loud。缺文件、
权限错误、symlink、非 regular file、JSON 解析错误、未知字段、重复 pair、空 allowlist、
`version`/`profile` 不匹配、`generation` 缺失或空 → `PROFILE_NOT_READY`，即启动 fail
closed：**profile 匹配的 History route 上 auth = `503 PRODUCT_API_AUTH_NOT_READY`**
（`CTR-PA-007`）；同时其它 Product API 现有 route MUST NOT 因该 Child 失败而全部挂掉
（`PRESERVE_EXISTING_BEHAVIOR`，`CTR-PA-001`）。所有配置错误 MUST fail loud，MUST NOT
静默降级为 allow-all 或 loopback 放行。

### CTR-PA-006 — 请求 admission 顺序（Binding 不在链上）

对 profile 匹配的每个请求 MUST 按以下精确顺序执行，任一步失败即按 `CTR-PA-007` 拒绝并
停止：

```text
1. canonical route match（CTR-PA-001；不匹配则整体不属于本 Child）
2. direct socket peer（身份来源 = accepted socket 真实对端；L7 proxy 禁止）
3. canonicalize peer address（CTR-PA-013）
4. WhoIs（CTR-PA-002）
5. StableID 提取（WhoIsResponse.Node.StableID，恰好一个、非空）
6. parse surface header（CTR-PA-003）
7. exact pair match（CTR-PA-004）
8. construct trustedAuthContext（CTR-PA-003）
9. pass to Product API / history adapter
```

Auth 层 MUST NOT（Owner Cross-Spec Ruling）：read Binding；compare path `agentId` 与
Binding；read Session。步骤 9 之后 Binding 读取、`agentId = Binding.activeAgent` 比较
与 history 调用是 History 层的职责（sibling Spec）。

任一步失败时：MUST NOT 读取 Session 文件；MUST NOT 启动 Agent；MUST NOT 调用模型；MUST
NOT 改变 Binding；MUST NOT 改变 limiter 或其它 route 状态；MUST NOT 泄露是否存在某
Agent/Session；MUST NOT 把请求传给 History service。

### CTR-PA-007 — Denial 语义：403/503 精确矩阵

仅适用于 profile 匹配的请求（`CTR-PA-001`）。状态与 code 由本 Spec 冻结，实现不得另行
决定；**禁止 "403 or 503 implementation choice"**；本 Child 对 profile 匹配请求不产生
400/401/404/500 或其它任何状态。

`403 PRODUCT_API_AUTH_FORBIDDEN` —— 身份系统健康（WhoIs 正常解析出唯一 Node 且配置
generation ready），但 caller 不被允许：

```text
403（FORBIDDEN）适用：
- 解析出的 StableID 不等于配置 pair 的 StableID（含：任意未列出的 Tailnet Node、
  proxy Node、Mac 本机 Node、Agent child/本机其它进程经 Tailnet 地址连入、wrong Node +
  allowed surface 的 cross pair）；
- StableID 匹配但 surface header 缺失 / 空 / 重复 / 多值 / 逗号 list / 超长 /
  非 canonical 编码（含大写、空格、错误连字符、非 v4 version/variant、需归一化才可通过
  的任何值）；
- exact pair mismatch（allowed Node + 未配对 label）。
```

`503 PRODUCT_API_AUTH_NOT_READY` —— 无法安全完成认证：

```text
503（NOT_READY）适用：
- tailscaled 不可用（LocalAPI 连接失败/超时）；
- WhoIs 调用失败（HTTP 错误、非合法 WhoIsResponse 响应形状）；
- WhoIs 结果 unknown / ambiguous（无匹配、Node 缺失、StableID 缺失或空、多候选）；
- config absent / invalid / validation failure（PROFILE_NOT_READY，含启动时强制 enable
  失败 closed）；
- profile disabled（route 已挂载但 auth profile 未 ready 的 fail-closed 配置）。
```

补充冻结：profile 未启用时 route 保持 absent/disabled，请求按 `PRESERVE_EXISTING_BEHAVIOR`
（router 现有行为），不产生本 Child 的 503；本 Child 对 profile 匹配请求的输出只有
allow（后续链） / 403 / 503 三种。所有 denial 一并满足：

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
MUST 按 `CTR-PA-007` 拒绝（已解析的本机 Node = 403；unknown/ambiguous = 503）。

### CTR-PA-009 — 默认关闭与 activation 条件

```text
AUTH_PROFILE_DEFAULT = DISABLED
LOCAL_TAILNET_HISTORY_ROUTE_DEFAULT = DISABLED
```

只有以下全部成立才允许实现期启用：本 Child Spec accepted 并进入 main；sibling
`MOBILE_SESSION_HISTORY_V1` accepted 并进入 main；两份实现均通过独立审计；Product API
直接绑定 Tailscale 地址（非公网 wildcard，且无 L7 proxy，`DEC-PA-011`）；tailscaled
identity 接口 ready 且版本 = 钉住 revision；config 文件 valid 且 generation 存在；exact
Node/surface pair 存在；History endpoint acceptance 通过。任一条件不成立时 route MUST
保持 absent/disabled（现有行为）；强制 enable 在 identity/config 未 ready 时 MUST fail
startup closed（matched route 上 `PRODUCT_API_AUTH_NOT_READY`，`CTR-PA-005`/`CTR-PA-007`），
MUST NOT 挂载降级路由，MUST NOT 影响其它现有 route。

### CTR-PA-010 — 配置轮换、失败替换、回滚与撤销（restart-only）

```text
ROTATION_MODE = VERSIONED_CONFIG_ATOMIC_REPLACEMENT_PLUS_GRACEFUL_RESTART
CONFIG_ACTIVATION_MODE = RESTART_ONLY
REVOCATION_EFFECTIVE_AT = SUCCESSFUL_RUNTIME_RESTART
```

轮换协议恰好为：1) 把新配置写入同目录临时文件；2) 对临时文件执行完整 validation
（`CTR-PA-005` 全部规则，含权限/owner/symlink 检查）；3) fsync；4) atomic rename 覆盖
active 文件；5) graceful restart Product API（Canary 按部署流程）；6) 新进程只加载新
generation。旧进程在停止前继续使用内存中的旧 immutable generation；MUST NOT 重读磁盘、
MUST NOT 在同一进程混用新旧 generation。

失败替换：新文件 validation 失败 → MUST NOT 执行 atomic rename；active 文件保持旧内容；
运行中旧进程保持旧 generation 不变。磁盘 active 文件被外部破坏：当前运行进程仍使用内存
immutable generation 直到重启；重启时 invalid file → `PROFILE_NOT_READY` → matched
route auth = 503（`CTR-PA-005`）；MUST NOT 偷偷 fallback 到任何旧磁盘副本/备份。

回滚：上一份**已验证** config → 相同 temp+validate+fsync+rename 协议 → graceful
restart。回滚 MUST NOT 改变 Binding、Session 或消息。轮换/回滚日志只记录 generation
digest 和结果（`CTR-PA-011`），MUST NOT 记录 raw StableID 或 surfaceId。

### CTR-PA-011 — 日志隐私（精确 allowlist）

auth 层日志允许记录且仅允许：

```text
requestId; routeClass; decision (allow|forbidden|not_ready); generationDigest;
principalDigest; surfaceDigest; status; latency
```

MUST NOT 记录：raw `tailcfg.StableID` 或 `tailcfg.Node.ID`；raw surfaceId；peer IP（无
论 raw 或 canonical）；message content；Binding 内容；Session 内容；Authorization
material；config 文件内容；Agent Home 路径。

### CTR-PA-012 — Principal claim：Node + configured label（诚实边界）

```text
PRINCIPAL = AUTHORIZED_PHONE_NODE_WITH_CONFIGURED_SURFACE_LABEL
SURFACE_ID_IS = non-secret configured label（canonical lowercase UUID v4）
SURFACE_ID_IS_NOT = app process credential; app attestation; secret
MOBILE_APP_PROCESS_ATTESTATION = OUT_OF_SCOPE_FOR_V1
```

本 Spec 授权的 principal 是「被允许的手机 Node + 该 Node 上配置的 surface label」，**不
是**精确 App 进程。同一授权手机上的其它本机进程若能读取/复制 surface label 并从同一
Node 发起请求，在身份面上与 App 不可区分——这属于 V1 phone-node trust boundary 的**内
部**，是明示接受的残余风险，不是缺陷。实现与文档 MUST NOT 声称精确 App process
认证/isolation；此类能力（attestation、surface credential）是未来独立 authority，本轮
不设计、不预留接口语义。

### CTR-PA-013 — Peer address canonicalization

WhoIs 查询输入 MUST 由真实 accepted socket remote peer 生成，并 MUST 先按以下规则
canonicalize（规则闭合，不留实现选择）：

```text
CANONICAL_PEER_ADDRESS_RULES:
- 输入 = accepted connection 的 remote peer（IP, port）；port MUST 剥离，只以 IP 参与身份；
- 解析为具体 IP literal（binary 形式）；非 IP literal 一律 admission 失败
  （真实 socket 对端不产生非 IP literal；出现即 fail closed）；
- IPv4：canonical 点分十进制；
- IPv6：canonical 小写、最长零段压缩（RFC 5952 textual form）；
- IPv4-mapped IPv6（::ffff:0:0/96）：MUST unmap 为等价 plain IPv4 后再参与 WhoIs 与
  比较；映射前后的两种文本 MUST 解析为同一身份；
- scope zone：zone 标识符 MUST NOT 参与身份；带 zone 的地址不可能是 tailnet Node 地址，
  按 unknown 结果处理（CTR-PA-007 503 类）；
- canonical textual 表示 = 上述规则的唯一输出；binary 表示 = unmap 后的 4/16 字节网络序；
  比较与查询只允许使用 canonical 形式，MUST NOT 对非 canonical 输入做字符串等价捷径；
- WhoIs addr 参数 = canonical textual IP only（无 port、无方括号、无 zone）。
```

身份输入 MUST NOT 从 XFF / X-Real-IP / 任何转发 header / request body / hostname / DNS
生成。同一物理 peer 的不同文本表示（mapped/unmapped、不同大小写、不同压缩）MUST 解析为
同一身份判定。

## 10. Acceptance

以下全部是未来 Acceptance 定义；本轮没有实现，没有执行。

```text
EXECUTED_NOW = NO
```

### ACC-PA-A — exact allowed phone StableID + exact surface + exact route = allowed

- Contracts: `CTR-PA-001`, `CTR-PA-002`, `CTR-PA-003`, `CTR-PA-004`, `CTR-PA-006`
- Method: 用配置中声明的 exact `(phone StableID, surfaceId)` pair 从该手机发起授权 GET；
  admission trace 必须显示身份取自 `WhoIsResponse.Node.StableID`（`tailcfg.StableNodeID`）
  且经 `CTR-PA-013` canonicalization
- Environment: isolated Tailnet acceptance environment；tailscaled = 钉住 revision
  `1.94.2 (2de4d317a8c2595904f1563ebd98fdcf843da275)` 并记录
- Required evidence: config generation digest（无 raw 值）、请求/响应 envelope、含
  StableID 字段名的 admission 顺序 trace
- Expected result: trusted authContext 形成（`principalType = mobile_tailnet_node`）并
  传给 History adapter；History service 被调用
- Failure condition: 任何 admission 步骤被跳过或顺序改变；身份来自 `Node.ID` 或 header
  自我声明
- EXECUTED_NOW: NO

### ACC-PA-B — allowed Node + wrong surface = 403

- Contracts: `CTR-PA-004`, `CTR-PA-007`
- Method: allowed Node 携带未配对的 surfaceId 发起请求
- Environment: 同 A
- Required evidence: 请求/响应记录、History service 调用计数
- Expected result: `403 PRODUCT_API_AUTH_FORBIDDEN`；History service 调用次数 = 0
- Failure condition: 任何放行或部分读取
- EXECUTED_NOW: NO

### ACC-PA-C — wrong Node + allowed surface = 403（cross pair）

- Contracts: `CTR-PA-004`, `CTR-PA-007`
- Method: 未配置的 Tailnet Node 携带 allowed surfaceId 发起请求
- Environment: 同 A
- Required evidence: 请求/响应记录
- Expected result: `403 PRODUCT_API_AUTH_FORBIDDEN`；surface 存在性本身不产生授权
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

### ACC-PA-E — Mac 本机 Node / loopback / Agent child = 精确状态

- Contracts: `CTR-PA-007`, `CTR-PA-008`
- Method: 分别从（a）Mac 本机 Node 经其 Tailnet 地址、（b）`127.0.0.1` loopback、
  （c）已知 Agent child 进程经本机 Tailnet 地址发起请求
- Environment: 同 A
- Required evidence: 三类 caller 的请求/响应与进程证据、WhoIs 解析记录
- Expected result: （a）（c）解析出本机 Node StableID（非允许 pair）→ `403
  PRODUCT_API_AUTH_FORBIDDEN`；（b）peer 地址无法解析为任何 Node → unknown → `503
  PRODUCT_API_AUTH_NOT_READY`（`CTR-PA-007` 精确分类，不是实现选择）；same uid /
  localhost / known path 不产生任何身份
- Failure condition: same uid / localhost / known path 被当作身份；状态类别与矩阵不符
- EXECUTED_NOW: NO

### ACC-PA-F — 真实 L7 proxy 路径 + 伪造转发 header 无效

- Contracts: `CTR-PA-002`, `CTR-PA-007`
- Method: （a）部署真实 proxy path：phone/client → proxy Node → Product API，phone 携带
  完整合法 pair 与真实 XFF/X-Real-IP 类 header 经 proxy 连接；（b）从任意 caller 直接携
  带伪造 `X-Forwarded-For`/`X-Real-IP`/自定义 caller header 请求
- Environment: 同 A（proxy 为独立 Tailnet Node，非允许 phone）
- Required evidence: 网络拓扑记录、proxy 与 API 两侧的 WhoIs 所见、请求/响应记录
- Expected result: （a）Product API WhoIs 只能看到 proxy Node；proxy Node 不是允许 phone
  StableID → `403 PRODUCT_API_AUTH_FORBIDDEN`；proxy 传递的任何「原始 caller」header
  不影响结果；（b）身份仅由 socket + tailscaled 决定，伪造头不改变结果
- Failure condition: proxy 转发头被信任；proxy 路径获得 phone 身份
- EXECUTED_NOW: NO

### ACC-PA-G — surface header canonical 编码矩阵拒绝

- Contracts: `CTR-PA-003`, `CTR-PA-007`
- Method: 缺失、空值、重复 field line、多值、逗号 list、超长、大写 hex、前后空格、错误
  连字符、花括号、urn: 前缀、非 v4 version/variant nibble、非 ASCII 的
  `X-AgentCore-Surface-Id` 变体逐一请求
- Environment: 同 A
- Required evidence: 请求/响应记录
- Expected result: 全部 `403 PRODUCT_API_AUTH_FORBIDDEN`（唯一语义；无 400）；无
  query/body/path fallback；无任何「归一化后可通过」的值
- Failure condition: 任何 fallback、归一化放行或 400/其它状态
- EXECUTED_NOW: NO

### ACC-PA-H — WhoIs 失败 / unknown / ambiguous = 精确 503

- Contracts: `CTR-PA-002`, `CTR-PA-006`, `CTR-PA-007`
- Method: fault-inject tailscaled 停机、LocalAPI 超时、HTTP 错误、非 WhoIsResponse 形状
  响应、无匹配 peer、Node 缺失、StableID 空、多候选结果
- Environment: 同 A
- Required evidence: fault 注入记录与响应
- Expected result: 上述每类都恰好 `503 PRODUCT_API_AUTH_NOT_READY`（不是 403，也不是实
  现选择）；绝不放行不确定身份
- Failure condition: 不确定身份被当作任意已知 Node；状态与矩阵不符
- EXECUTED_NOW: NO

### ACC-PA-I — config 缺失/无效 = profile not ready，matched route 503，其它 route 不受影响

- Contracts: `CTR-PA-005`, `CTR-PA-007`, `CTR-PA-009`
- Method: 分别以缺文件、宽权限、symlink、目录/设备文件、坏 JSON、未知字段、重复 pair、
  错误 `profile`、错误 `version`、缺 `generation`、空 allowlist 启动；随后请求 history
  route 与其它现有 route（`GET /v1/agents` 等）
- Environment: isolated runtime
- Required evidence: 启动日志（仅 digest 与错误类别）、matched route 与其它 route 的状态
  记录
- Expected result: `PROFILE_NOT_READY`；matched History route auth = `503
  PRODUCT_API_AUTH_NOT_READY`；空 allowlist 不放行任何 caller；其它现有 route 保持现有
  行为（不因该 Child 失败而挂掉）；fail-loud 可观测
- Failure condition: 静默降级、allow-all、其它 route 连带失败、部分生效
- EXECUTED_NOW: NO

### ACC-PA-J — 非 profile route / wrong method 保持现有行为

- Contracts: `CTR-PA-001`, `CTR-PA-006`, `CTR-PA-007`
- Method: 用 exact 合法 pair 请求 `GET /v1/agents`、`GET /v1/binding`、
  `POST /v1/switch-agent`、`POST /v1/message`、history path 的 wrong-method 变体（POST/
  PUT/DELETE）、session selector ≠ `main` 的 path；同时用**无 auth 配置**的基线重复
- Environment: 同 A
- Required evidence: 每个变体在「auth child 启用」与「基线」两种条件下的状态/响应体对比
- Expected result: 逐变体一致——这些请求 `NOT_HANDLED_BY_THIS_AUTH_PROFILE`，
  `PRESERVE_EXISTING_BEHAVIOR`；不因合法 pair 获得授权/ready/403/503 语义；本 Child 未
  为任何其它 route 提供授权或拒绝
- Failure condition: 任何变体因本 Child 的存在而改变状态
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

### ACC-PA-L — restart-only 轮换：新进程用新 generation，旧 pair 失效

- Contracts: `CTR-PA-010`
- Method: 以 temp + validate + fsync + atomic rename 写入新 generation config，然后
  graceful restart；分别用旧 pair 与新 pair 请求
- Environment: isolated runtime
- Required evidence: generation digest 序列、原子替换证据（temp file + rename）、重启证
  据、请求结果
- Expected result: 重启后新 pair allowed；旧 pair `403`；无部分生效窗口；磁盘替换本身
  （不重启）不改变任何请求结果
- Failure condition: 新旧 pair 同时有效；不重启即生效；轮换半生效
- EXECUTED_NOW: NO

### ACC-PA-M — rollback 恢复上一 generation（经 restart）

- Contracts: `CTR-PA-010`
- Method: 轮换后以同协议写回上一已验证 generation 并 graceful restart，再分别验证两 pair
- Environment: isolated runtime
- Required evidence: generation digest 序列、请求结果、Binding/Session/消息不变量
- Expected result: 旧 generation pair 恢复授权、新 pair 失效；Binding、Session 与消息内
  容全程不变
- Failure condition: 回滚改变任何 Binding/Session 状态
- EXECUTED_NOW: NO

### ACC-PA-N — 日志无 raw StableID、surfaceId、IP 或消息

- Contracts: `CTR-PA-011`
- Method: 对 allow/deny/not_ready 全路径采集日志，扫描 raw StableID、raw Node.ID、raw
  surfaceId、peer IP、消息正文、config 内容、Agent Home 路径
- Environment: 同 A
- Required evidence: 日志样本 + 扫描结果
- Expected result: 仅允许字段（requestId、routeClass、decision、generationDigest、
  principalDigest、surfaceDigest、status、latency）出现
- Failure condition: 任何禁止值出现在日志/错误响应/指标标签
- EXECUTED_NOW: NO

### ACC-PA-O — public / non-Tailnet 入口始终不授权

- Contracts: `CTR-PA-001`, `CTR-PA-007`
- Method: 从非 Tailnet 网络（公网/LAN 非 Tailnet 地址）请求该 endpoint；并验证 Product
  API 未绑定公网 wildcard、未部署于 L7 proxy 之后（`DEC-PA-011`）
- Environment: isolated network probes
- Required evidence: 请求/响应与 bind 配置
- Expected result: 非 Tailnet peer 无法解析为 Node → `503 PRODUCT_API_AUTH_NOT_READY`
  （unknown 类，`CTR-PA-007`）；不产生任何授权；无公网 exposure 被引入
- Failure condition: 公网入口复用 local profile 或获得任何授权
- EXECUTED_NOW: NO

### ACC-PA-P — peer 地址 canonicalization 矩阵

- Contracts: `CTR-PA-013`, `CTR-PA-002`, `CTR-PA-007`
- Method: 分别以（a）Tailnet IPv4 peer、（b）Tailnet IPv6 peer、（c）IPv4-mapped IPv6
  形式的同一 peer、（d）同一 Node 的不同 ephemeral source port、（e）带 scope zone 的
  地址（如 link-local 带 zone）发起请求，记录 WhoIs addr 参数的 canonical textual 形式
- Environment: 同 A
- Required evidence: 每个用例的原始 peer 地址类别、canonical 形式、WhoIs 输入、判定结果
- Expected result: （a）（b）各自正确解析；（c）与 plain IPv4 形式解析为**同一**身份；
  （d）port 剥离后不影响判定；（e）按 unknown → `503 PRODUCT_API_AUTH_NOT_READY`；全部
  用例无 XFF/body/hostname/DNS 来源
- Failure condition: mapped/非 mapped 判为不同身份；port 影响身份；zoned 地址产生身份
- EXECUTED_NOW: NO

### ACC-PA-Q — same-phone 信任边界诚实验证（principal 缩窄）

- Contracts: `CTR-PA-012`, `CTR-PA-003`
- Method: 在授权手机上以第二个本机进程读取/复制 surface label，并从同一手机 Node 发起完
  全合法的 GET（同 StableID + 复制的 label）
- Environment: 同 A（第二进程为 acceptance 注入的测试进程）
- Required evidence: 第二进程身份记录、请求/响应、auth 层判定 trace
- Expected result: auth 层判定与 App 进程请求**相同**（pair 匹配则通过）——诚实证明
  principal 是 Node + label 而非 App 进程；文档/实现无「精确 App process 认证」声称；
  `MOBILE_APP_PROCESS_ATTESTATION = OUT_OF_SCOPE_FOR_V1` 被遵守
- Failure condition: 实现声称或表现出超出 Node + label 的进程区分能力
- EXECUTED_NOW: NO

### ACC-PA-R — 403 精确矩阵

- Contracts: `CTR-PA-007`, `CTR-PA-012`, `CTR-PA-004`
- Method: 对 `CTR-PA-007` 403 类每一行逐一触发：未列出 Tailnet Node；proxy Node（ACC-
  PA-F 拓扑）；Mac 本机 Node；Agent child；wrong Node + allowed surface；allowed Node +
  未配对 label；surface header 全部非法变体（ACC-PA-G 集合）
- Environment: 同 A
- Required evidence: 每个用例的状态码 + code 字段
- Expected result: 每个用例恰好 `403 PRODUCT_API_AUTH_FORBIDDEN`，无一 503/400/其它；
  且每个用例满足 `CTR-PA-007` 的 zero-side-effect 不变量
- Failure condition: 任何用例状态或 code 与矩阵不符
- EXECUTED_NOW: NO

### ACC-PA-S — 503 精确矩阵

- Contracts: `CTR-PA-007`, `CTR-PA-005`
- Method: 对 `CTR-PA-007` 503 类每一行逐一触发：tailscaled 停机；WhoIs 超时/HTTP 错误；
  非法响应形状；无匹配；Node 缺失；StableID 空；多候选；config absent/invalid（ACC-PA-I
  集合）；profile disabled（route 已挂载 fail-closed 配置）
- Environment: 同 A
- Required evidence: 每个用例的状态码 + code 字段
- Expected result: 每个用例恰好 `503 PRODUCT_API_AUTH_NOT_READY`，无一 403/400/其它
- Failure condition: 任何用例状态或 code 与矩阵不符
- EXECUTED_NOW: NO

### ACC-PA-T — restart-only generation：旧进程保持、重启激活、撤销生效点

- Contracts: `CTR-PA-005`, `CTR-PA-010`
- Method: 进程运行中以 atomic rename 替换 active config（移除旧 pair / 换新 generation），
  不重启；立即用旧 pair 与新 pair 分别请求；随后 graceful restart，再重复两类请求
- Environment: isolated runtime
- Required evidence: 文件替换证据、重启时间点、各阶段请求结果与 generation digest 日志
- Expected result: 重启前：旧进程继续使用旧 in-memory generation（旧 pair 仍 allowed、
  新 pair 仍 403）——`REVOCATION_EFFECTIVE_AT = SUCCESSFUL_RUNTIME_RESTART`，文件 rename
  本身**不**产生即时撤销；重启后：新 generation 生效（旧 pair 403、新 pair allowed）；
  全程请求都命中同一 process generation，无 mixed generation
- Failure condition: rename 后旧 pair 即被撤销或新 pair 提前生效；同进程混用两代配置
- EXECUTED_NOW: NO

### ACC-PA-U — 失败替换与磁盘破坏：无静默 fallback

- Contracts: `CTR-PA-005`, `CTR-PA-010`
- Method: （a）以 invalid 新配置走 temp+validate 流程，观察 rename 是否发生、运行进程行
  为；（b）运行中外部破坏 active 文件内容，观察运行进程与「重启后」行为
- Environment: isolated runtime
- Required evidence: validation 失败记录、文件状态、两阶段的请求结果
- Expected result: （a）validation 失败 → 不 rename、active 文件保持旧内容、运行进程不
  变；（b）运行进程继续使用内存 immutable generation（不重读磁盘）；重启时 invalid
  file → matched route `503 PRODUCT_API_AUTH_NOT_READY`，MUST NOT 静默 fallback 旧磁盘
  副本/备份
- Failure condition: 失败替换部分生效；运行进程因磁盘破坏而改变行为；重启后悄悄回退旧副本
- EXECUTED_NOW: NO

### ACC-PA-V — 稳定字段绑定：`StableID` 授权、transient `Node.ID` 不匹配

- Contracts: `CTR-PA-002`, `CTR-PA-004`
- Method: （a）检查钉住实现（源码检查/trace）：授权比较与配置匹配的字段是
  `WhoIsResponse.Node.StableID`（`tailcfg.StableNodeID`），`Node.ID` 不进入任何比较；
  （b）运行时负例：构造 `tailscaleStableNodeId` = 该 Node transient `Node.ID` 数值文本
  的配置条目，用真实 pair 请求
- Environment: 同 A
- Required evidence: 源码/trace 记录、负例配置的 generation digest 与请求结果
- Expected result: （a）字段绑定正确；（b）数值文本不与 `StableID` 匹配 → `403
  PRODUCT_API_AUTH_FORBIDDEN`（exact pair mismatch）
- Failure condition: 实现使用 `Node.ID` 或对 transient 数值文本产生匹配
- EXECUTED_NOW: NO

### 10.1 Bidirectional coverage

| Contract | Acceptance coverage |
|---|---|
| `CTR-PA-001` | A, J, O |
| `CTR-PA-002` | A, D, F, H, P, V |
| `CTR-PA-003` | A, G, Q |
| `CTR-PA-004` | A, B, C, R, V |
| `CTR-PA-005` | I, S, T, U |
| `CTR-PA-006` | A, H, J, K |
| `CTR-PA-007` | B, C, D, E, F, G, H, J, K, O, R, S |
| `CTR-PA-008` | E |
| `CTR-PA-009` | I |
| `CTR-PA-010` | L, M, T, U |
| `CTR-PA-011` | N |
| `CTR-PA-012` | Q, R |
| `CTR-PA-013` | P |

Every Acceptance reference resolves to an active Contract, and every active Contract has at
least one Acceptance item.

## 11. Alternatives and disposition

| Alternative | Disposition | Reason |
|---|---|---|
| 公网 OAuth / Gateway 本轮一起做 | REJECTED | owner 裁决 `PUBLIC_OAUTH_AND_GATEWAY = LATER`；不越权设计公网 |
| Tailnet membership 即授权 | REJECTED | membership 是网络可达性，不是 caller identity |
| Tailscale IP allowlist | REJECTED | IP 可变可复用；非 stable identity |
| 信任 XFF / X-Real-IP / 自定义 caller header | REJECTED | caller 可伪造；L7 proxy 对本 profile 整体禁止（`DEC-PA-011`） |
| 允许受信 L7 proxy 并解析其转发头 | REJECTED | WhoIs 只见 TCP 对端；转发头重新引入可伪造身份面；closure 由 `ACC-PA-F` 证伪 |
| transient `tailcfg.Node.ID` 作身份 | REJECTED | 上游明示跨 control plane URL 不稳定；`StableID` 是唯一稳定字段（`OBS-PA-006`） |
| 客户端声明 Node ID / body 声明 identity | REJECTED | 自我声明不构成身份 |
| `tailscale status` 文本解析 | REJECTED | 人类可读文本非权威结构化接口 |
| allowed Node + 任意 surface 分别验证 | REJECTED | 破坏 exact pair，允许 surface 复用/复制 |
| surfaceId 当 secret（bearer token） | REJECTED | Node/surface pair 更窄且不需密钥管理；surfaceId 是 non-secret configured label，仍按敏感稳定标识处理 |
| 继续声称认证精确 App 进程 / 本轮引入 attestation | REJECTED | 不可证明（`OBS-PA-007`）；`MOBILE_APP_PROCESS_ATTESTATION = OUT_OF_SCOPE_FOR_V1`（`DEC-PA-009`） |
| auth 层预读 Binding / 比较 agent | REJECTED | 双 owner + switch race（audit blocker 12）；`BINDING_READ_OWNER = HISTORY_ONLY` |
| config hot reload / watcher | REJECTED | mixed generation / failed reload / partial activation 整类风险；`CONFIG_ACTIVATION_MODE = RESTART_ONLY`（`DEC-PA-010`） |
| 403 or 503 留给实现选择 | REJECTED | 状态语义必须唯一可判定（`DEC-PA-008`） |
| Node ID 下传 History service | REJECTED | 双重 owner；违反 trusted authContext 边界 |
| auth config 入 Git | REJECTED | 敏感稳定标识入库即泄漏 |

Investigation disposition: `NEW`（amendment 关闭 audit comment 5480338347 的 Auth
blockers）；本 proposed Spec ready for independent semantic review，不是 accepted
implementation authority。

## 12. Migration, compatibility, and rollback

- Migration: none。本 Child 只新增 auth 前置层；现有 loopback 产品路径不受影响。
- Compatibility: 现有 `GET /v1/agents`、`GET /v1/binding`、`POST /v1/switch-agent`、
  `POST /v1/message` 的行为不因本 Child 改变（`CTR-PA-001` preserve-existing-behavior；
  `ACC-PA-J` 逐变体验证）。
- Rollout: 默认关闭；activation 条件见 `CTR-PA-009`；配置激活仅经 graceful restart
  （`CTR-PA-005`/`CTR-PA-010`）。
- Rollback: `CTR-PA-010` 的 generation 回滚（temp+validate+fsync+rename + graceful
  restart）+ route disablement；`REVOCATION_EFFECTIVE_AT = SUCCESSFUL_RUNTIME_RESTART`；
  无数据迁移。

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
PUBLIC_OAUTH_AND_GATEWAY remains a future independent authority
MOBILE_APP_PROCESS_ATTESTATION remains a future independent authority
```

Implementation-preflight duty（非规范债务）：实现期 MUST 复核运行时 tailscaled 版本 =
钉住 revision `1.94.2 (2de4d317a8c2595904f1563ebd98fdcf843da275)`，并对实际 peer 验证
WhoIs 响应形状与本 Spec 冻结一致；若版本或形状不同，MUST 先修订本 Spec（amendment）再实
现，不得静默适配。该复核不得改变任何 Contract 语义。

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
AMENDMENT = closed audit comment 5480338347 Auth blockers 1-5 + blocker 12 (auth side)
PRINCIPAL = AUTHORIZED_PHONE_NODE_WITH_CONFIGURED_SURFACE_LABEL
TAILSCALE_STABLE_FIELD = WhoIsResponse.Node.StableID (tailcfg.StableNodeID)
TAILSCALE_REVISION_OR_VERSION = 1.94.2 (commit 2de4d317a8c2595904f1563ebd98fdcf843da275)
SURFACE_FORMAT = canonical lowercase UUID v4 (36 ASCII; regex-frozen)
ROUTE_PROFILE_MATCH = EXACT_HISTORY_GET_ONLY
CONFIG_ACTIVATION_MODE = RESTART_ONLY
CONFIG_GENERATION = IMMUTABLE_PER_PROCESS
REVOCATION_EFFECTIVE_AT = SUCCESSFUL_RUNTIME_RESTART
BINDING_READ_OWNER = HISTORY_ONLY
CONTRACT_COUNT = 13
CONTRACTS_WITH_ACCEPTANCE = 13
ACCEPTANCE_COUNT = 22
BIDIRECTIONAL_COVERAGE = 13/13 Contracts; 22/22 Acceptance references valid
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
MOBILE_CHANGE = NONE
CANARY_CHANGE = NONE
DEPLOYMENT_CHANGE = NONE
MERGE_PERFORMED = NO
```
