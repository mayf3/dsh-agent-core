---
spec_id: MOBILE_SESSION_HISTORY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mobile-session-history-read-projection
  - product-api-history-get
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - AGENT_CORE_HARDENING_PROGRAM_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3/dsh-agent-core maintainers
---

# MOBILE_SESSION_HISTORY_V1 — Mobile 当前 Session 只读历史

```text
SPEC_GOVERNANCE_MODE = AUTHOR
PREFLIGHT_MODE = NEW
CHANGE_CLASS = NON_MECHANICAL
AMENDMENT_ID = MOBILE_SESSION_HISTORY_V1_AND_LOCAL_TAILNET_AUTH_CHILD_V2
BASE = 9386ac4e4515ea628e2a450f402b540f165c13c3
PREVIOUS_HEAD = 91a0513f2b90ca924b7a46f455916fe4d5eae550
MAIN_SYNC = 1fdf8c361f2010864f686d8310b68a40df5a5184 (merge commit 044aebd73e991a655f1ec29c1533f92258df90e1)
LIVE_CANARY_BACKEND = 622cb7b6bae7b0b5a9a8713bb5a843ad6a7dc5f1
MOBILE_CONSUMER_BASE = 3704bc289a63f66961cc31849459019715d358c1
SPEC_STATUS = proposed
IMPLEMENTATION_ALLOWED_NOW = NO
EXECUTED_NOW = NO
AUTHORING_MAIN = 205d9f748347542eb0fc88d5689d719849d85b97
AMENDMENT_TRIGGER = audit comment 5480338347 (blockers 6-12 history/cross side)
AMENDMENT_TRIGGER += D-008 authority reconciliation (D-006 / AGENT_WORKSPACE_SESSION_MODEL_V2 superseded whole by D-008 / AGENT_WORKSPACE_SESSION_MODEL_V3)
AMENDMENT_TRIGGER += independent review of ef8fe85 (blocker union = 1: CTR-SH-012 generation reset-provability cited a nonexistent CTR-SH-013 reuse-rejection rule; fixed via HEADER_SUBSET + CONTENT_ANCHOR generation, ACC-SH-N case 3a/8)
AMENDMENT_TRIGGER += PR #145 Codex review blocker union B1/B2/B3 (2026-09-03): B2 full-artifact CONTENT_ANCHOR broke append-stable message identity -> replaced by first-record PREFIX_ANCHOR (append-stable + reset-provable); B1/B3 resolved jointly with sibling auth spec via dedicated history-only Tailnet listener (existing Product API server stays loopback-only) + single route-ownership chain (auth admission -> History selector 400)
AMENDMENT_TRIGGER += PR #145 re-audit of 208f9a9 blocker (2026-09-03): first-record-only anchor left a reset blind spot (identical first record + differing later content + reused rawId could yield same public ID over different content) -> public message ID tuple extended with messageRecordDigest (content binding: same ID iff same role/rawId/record content; cross-generation misread impossible by construction); stale `0d8f050` sibling pins (§1/§3/§3.2/CTR-SH-001) reconciled to in-branch amended sibling; CTR-SH-010 activation wording aligned to HISTORY_LISTENER
AMENDMENT_DATE = 2026-09-03
```

本修订轮（2026-09-03，AMENDMENT_TRIGGER = audit comment `5480338347` + D-008 authority
reconciliation）做两类事：

1. **D-008/V3 authority reconciliation**：accepted Current Decision 已由 D-006/V2 整份更换为
   D-008/V3（standalone Current Authority）。本文全部 session-model 引用重新锚定到 D-008，
   Binding 字段名统一为 D-008 的 accepted 名称 `activeAgent`（非 `activeAgentId`），
   D-008 留给 implementation 的机制（current-main 解析、public ID generation source）在本文
   Contracts 内本地冻结（`CTR-SH-012`/`CTR-SH-013`）。
2. **关闭审计 blocker 6–11（SHIP_BLOCKER depth per reclassification policy）**：deterministic
   current-main resolver（`CTR-SH-013`）、public message ID codec 精确冻结（`CTR-SH-012` 扩充）、
   hardlink escape 排除（`CTR-SH-007`）、bounded decoder seam（`CTR-SH-003`）、assistant
   malformed-correlation 确定性分类（`CTR-SH-005`）、runtime 日志隐私 allowlist（`CTR-SH-014`）。
   其余低优先项归入 §13.1 FOLLOW_UP_DEBT，不消耗 normative blocker effort。

前轮修订关闭独立审计（PR comment `5472147045`，`REQUEST_CHANGES`）的五项 blocker：
Session 身份统一为 logical `main`、精确资源上限、canonical Session root 限制、deterministic
composite 公共 Message ID / stale cursor、Tailnet-local 与公网 activation 拆分。认证身份
边界由 sibling Child `PRODUCT_API_AUTHENTICATION_V1`（proposed；本 PR branch
`goal/mobile-history-integration` 内的联合修订版，演进自 candidate
`0d8f050` + PR #145 review blocker B1/B3 修复）拥有，
本 Spec 只消费其 trusted authContext，并按该 sibling 的边界
（`CTR-PA-006`：Binding 不在 auth 链上，History 层是唯一 Binding reader）划分职责。

## 1. Goal

为 Mobile 当前 Binding 的 `activeAgent` 提供其 current canonical `main` trajectory 的只读
聊天历史。公开接口中的 Session selector 是**逻辑常量** `main`（logical slot），不是 native
trajectory ID：Mobile 永远不接收、保存、构造或发送 native trajectory ID；服务端 trusted
resolver 从 authenticated Binding 出发解析当前 canonical main trajectory。本 Spec 只冻结
后端读取、投影、分页、资源上限、错误和隐私边界；它不实现代码、不部署、不修改 canary，
也不授权在本 proposed revision 上实施。

```text
HISTORY_AUTHORITY = DSH_SESSION
HISTORY_REQUEST_SESSION_ID = LOGICAL_MAIN
PUBLIC_HISTORY_SESSION_SELECTOR = LOGICAL_MAIN
NATIVE_TRAJECTORY_ID = SERVER_INTERNAL_ONLY
MOBILE_NATIVE_SESSION_ID_OWNERSHIP = NONE
SECOND_HISTORY_STORE = FORBIDDEN
SESSION_MAPPING = FORBIDDEN
BACKEND_HISTORY_OWNER = @agent-core/session-history (minimal read-only service/module)
PRODUCT_API_ROLE = THIN_ADAPTER
COLD_READ_WITHOUT_AGENT_SPAWN = YES
```

## 2. Scope and non-goals

### 2.1 In scope

- 一个精确只读 HTTP endpoint（只挂在 sibling auth Child 的专用 history-only Tailnet
  listener 上，`CTR-SH-002`）：
  `GET /v1/agents/{agentId}/sessions/main/messages?limit=50&before=<publicMessageId>`；
- 服务端从 trusted authContext 的 surface Binding 出发解析 current canonical main
  trajectory（`agentId` 必须等于 `Binding.activeAgent`，selector 固定字面量 `main`）；
- 从目标 Agent Home 内、configured Session root 下的 DSH native Session artifact 读取有效
  完整前缀；
- 将允许的最终 user / assistant 文本投影成稳定消息，公共 Message ID 为 deterministic
  composite hash（`CTR-SH-012`）；
- 以 DSH event `seq` 为唯一顺序权威，提供排他 `before` 分页与 stale-cursor 语义；
- fail-closed 的 Agent、Session、归属、header 与路径校验，以及冻结的资源上限（`CTR-SH-011`）；
- 由极小只读 `@agent-core/session-history` service/module 拥有原始 DSH JSONL 读取与投影；
- Product API 仅校验 HTTP 输入、消费 sibling auth Child 的 trusted authContext、调用该
  service、映射 HTTP envelope。

### 2.2 Out of scope

- 第二个聊天数据库、message store、Session registry 或 logical→native 持久 mapping；
- Session create/resume/write/repair/compact/archive/delete；
- Agent 启动、模型调用、prompt、synthetic closer 或 torn record 修补；
- Binding、Agent Home、Workspace、Session artifact 或 canary 修改；
- Mobile repository 修改；
- Feishu connector、Router/Ingress/demo-server 修改；
- Mobile↔Feishu mirror、双写、回流或以 Feishu 作为历史库；
- `mobile`、`feishu`、`senderDisplayName`、`channelConversationId` 等来源字段；
- 通过文本、`@` 占位符或 Binding 猜测 channel；
- Tailscale caller 身份验证、Node allowlist、raw surface header 验证、auth config 与
  OAuth——这些归 sibling Child `PRODUCT_API_AUTHENTICATION_V1` 拥有（见 `CTR-SH-010`）；
- 完整 Session 管理组件。

## 3. Authority and dependencies

1. `AGENT_CORE_PRODUCT_ARCHITECTURE_V1` 冻结 DSH 为 Session runtime、product sessionId 与
   DSH native sessionId 相同、Agent Core 不建第二套 Session engine/mapping/history。
2. accepted Current Decision `AGENT_WORKSPACE_SESSION_MODEL_V3`（D-008，全文
   `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md`；standalone Current Authority，
   整份取代 D-006 / `AGENT_WORKSPACE_SESSION_MODEL_V2`——V2 现为 superseded 历史，
   不再作为 governing 引用）冻结本 Spec 依赖的全部 session-model 语义：
   `SESSION = ONE TRAJECTORY`（D-008 §7）；`main = Agent 的 canonical logical slot 与
   stable address`、`MAIN_SESSION_IDENTITY = LOGICAL_SLOT`、
   `NATIVE_DSH_SESSION_ID = IMPLEMENTATION_DETAIL`（D-008 §8）；main 可 reset、
   `MAIN_RESET_SCOPE = MAIN_ONLY`，reset 机制/scheduler/archive 留给 implementation
   （D-008 §9）；`HUMAN_PRODUCT_SURFACE_BINDING = activeAgent only`（D-008 §18）；
   Mobile `MOBILE_BINDING = SWITCHABLE`、selected Agent → selected Agent/main
   （D-008 §19–§21）。D-008 §29 把 native DSH Session ID mapping 留给未来 implementation
   Spec：本 Spec 的 Decision 是公开 selector 恒为字面量 `main`（`DEC-SH-006`），native
   trajectory ID 只存在于服务端内部解析，永不进入公开接口。D-008 对 current-main 的
   解析机制与 reset 时的身份可区分性留白；本 Spec 在 `CTR-SH-012`/`CTR-SH-013` 内对
   当前行为本地冻结，不扩大到未来 reset generalization。main reset 后旧 trajectory 不再是
   current main；本 Spec 不决定 reset、archive 或旧 trajectory 可见性。Binding 字段一律
   使用 D-008 的 accepted 名称 `activeAgent`。
3. accepted Program `AGENT_CORE_HARDENING_PROGRAM_V1` 将 Product API 定义为 Product Surface
   Control Plane，并要求未认证状态不得扩大到 loopback 外；具体认证协议由其指名的 child
   `PRODUCT_API_AUTHENTICATION_V1` 决定。该 child 现以 proposed 状态与本文同一 branch
   `goal/mobile-history-integration` 联合演进（演进自 candidate `0d8f050`，含 PR #145
   review blocker B1/B3 修复），与本文分开裁决；双向
   ownership 边界见 §3.2，本文引用其 contract IDs 时以本 branch 内的最新 sibling 文本为准。
4. `mayf3/agent-core-mobile@3704bc289a63f66961cc31849459019715d358c1` 是 consumer
   协调坐标，不是本仓库的外部 governing authority。
5. DSH JSONL 格式及 event schema 是运行时依赖，不由本仓库重新治理。本 Spec 通过
   `CTR-SH-003`–`CTR-SH-005` 建立本地 compatibility allowlist：production profile 的
   plaintext newline-delimited JSON、封闭 header 字段、连续 `seq`、封闭的三种
   projection/correlation event shape；其它满足公共 event envelope 的 event type 仅可忽略，
   不属于 projection schema。实现必须锁定实际 DSH dependency revision并优先复用其公共只读 decoder；
   但任何 revision 只有在满足该 allowlist 时才可读取，未知 format/version/shape 一律
   `INTERNAL_ERROR`，不得由实现自行扩大。未固定的本地 Harness checkout 不是 production
   authority。

### 3.1 PREFLIGHT ownership ruling

现有 package 均无合适的完整 owner：

- `product-api` 已冻结为薄 HTTP adapter，不能拥有 JSONL parser 或 projection policy；
- `agent-router` 拥有 Binding/路由/进程生命周期，历史 cold-read 不得进入它的
  `ensureRunning` 路径；
- `workspace-bootstrap` 只拥有 agentId→Workspace/DSH_HOME 映射，不应扩张为消息 parser；
- `agent-memory` 拥有 curated cross-session memory，不得成为第二套 Session history；
- `demo-server` 是 per-Agent live process 的 prompt/session seam，cold-read 不得依赖它。

因此 `PREFLIGHT_MODE = NEW`，裁决一个极小 `@agent-core/session-history` 只读
service/module 为唯一 backend history owner。它可以复用 workspace-bootstrap 的安全 Home
解析和 DSH 的公共只读 decoder，但 raw DSH JSONL 读取、完整前缀选择、message projection、
游标判定与 fail-closed 归属校验只在该 owner 内发生。它可调用 Router 的 existing
read-only Binding lookup，但不得调用 `ensureRunning` 或任何 mutation。它不拥有 Session，
不提供写方法，也不得演化为完整 Session 管理组件。

Product API 只允许调用类似
`sessionHistory.listMessages({ authContext, agentId, limit, before })` 的只读 service seam
（selector 恒为 `main`，不再是调用方参数），并转换 HTTP request/response/error envelope；
Mobile 与 Feishu connector 不得直接解析 Session 文件。

### 3.2 与 sibling Child `PRODUCT_API_AUTHENTICATION_V1` 的双向边界

`PRODUCT_API_AUTHENTICATION_V1`（proposed；本 branch 联合修订版，演进自 candidate
`0d8f050`）拥有：Tailnet peer 身份解析、专用 history-only Tailnet listener、
Node/surface exact pair、route admission、403/not-ready、Agent-child denial、auth config、
rotation/rollback、auth 日志隐私。

本 Spec 拥有：authoritative Binding 读取、path agent 与 Binding 一致、current logical main
解析、Session artifact cold-read、projection、public message identity、pagination、History
privacy。

`MOBILE_SESSION_HISTORY_V1` 不拥有：Tailscale caller 验证、Node allowlist、raw surface
header 验证、auth config、OAuth。`PRODUCT_API_AUTHENTICATION_V1` 不拥有：Session、Binding
内容、History projection、JSONL 读取、Message ID、pagination。必须不存在双重 owner。

按 sibling 的 `CTR-PA-006`（「请求 admission 顺序（Binding 不在链上）」，含
`HISTORY_LISTENER` 全请求 admission 语义），auth 层 MUST NOT read Binding、MUST NOT 比较 path `agentId` 与 Binding、
MUST NOT read Session；Binding 读取与 `agentId = Binding.activeAgent` 比较是本 Spec（History
层）的独占职责，且每个请求 MUST 恰好读取 Binding 一次（ONE authoritative snapshot per
request），MUST NOT 在同一请求内对 Binding 做第二次不一致读取。本 Spec 消费的
trusted authContext schema 以 `CTR-PA-003` 冻结者为准：
`principalType = mobile_tailnet_node`、verified canonical `surfaceId`、
`authProfile = local-tailnet-mobile-history-v1`、`configGeneration`；该 context MUST NOT
含 Binding 数据或引用、agentId 授权结果或 Session 数据。

## 4. Current State

- `STATE-SH-001` — 在 source base
  `mayf3/dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`，Product API
  是 Router/Agent Definition 上的薄 HTTP adapter，且明确声明 `getMessages` 未实现。
  Basis: `OBS-SH-001`, `EVD-SH-001`。
- `STATE-SH-002` — 同一 source base 的生产 profile 把每个 Agent 的原生 Session
  persistence 配置为该 Agent `$DSH_HOME/sessions` 下的 plain JSONL；
  workspace-bootstrap 是安全 `agentId → DSH_HOME` 映射 owner。
  Basis: `OBS-SH-002`, `OBS-SH-003`, `EVD-SH-002`。
- `STATE-SH-003` — `LIVE_CANARY_BACKEND` 是
  `622cb7b6bae7b0b5a9a8713bb5a843ad6a7dc5f1`；本轮只记录该部署 source coordinate，
  未读生产 Session 正文、未执行 runtime history probe、未改变 canary。
  Basis: `OBS-SH-004`。
- `STATE-SH-004` — base 中没有名为 `@agent-core/session-history` 的 package/service，且
  Product API 当前没有该 endpoint；因此本工作是新 authority，不是已有 accepted
  implementation contract 的复用。
  Basis: `OBS-SH-001`, `OBS-SH-005`, `CLM-SH-001`, `EVD-SH-003`。
- `STATE-SH-005` — 本机默认 agents root（`~/.dsh/agents`）在 `2026-08-31` 存在 20 个真实
  `main` trajectory artifact（DSH native 布局
  `sessions/<encoded-cwd>/main/session.jsonl`），最大 size 333,283 bytes、最大 176 行、
  最大单行 41,271 bytes。该 metadata-only 观测（未读取、未输出任何消息正文）是
  `CTR-SH-011` 资源上限的取值基准。
  Basis: `OBS-SH-006`, `EVD-SH-004`。
- `STATE-SH-006` — `docs/specs/PRODUCT_API_AUTHENTICATION_V1.md` 在本 PR 中以 proposed
  状态首次出现；main 上此前不存在该 child authority。
  Basis: `OBS-SH-007`。

## 5. Observations

### OBS-SH-001 — Product API 当前没有 history GET

- Subject: `packages/product-api/src/index.js`
- Repository/revision: `mayf3/dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`
- Environment: source worktree, no runtime execution
- Observed at: `2026-08-30T23:26:26Z`
- Method: read module header, route table and provided service methods
- Result: module lines 9–14 define a thin adapter; lines 39–41 say `getMessages` is deliberately
  not implemented; routed endpoints at lines 233–262 do not include history GET.
- Provenance: `packages/product-api/src/index.js`

### OBS-SH-002 — Production native Session root is per-Agent DSH_HOME

- Subject: production per-Agent Cordis profile
- Repository/revision: `mayf3/dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`
- Environment: source configuration, not deployed-state verification
- Observed at: `2026-08-30T23:26:26Z`
- Method: read production profile Session persistence configuration
- Result: `session-persistence-jsonl.root = dshHomePath('sessions')` and `compression = none`.
- Provenance: `profile-production/cordis.patch.yml:8-25`

### OBS-SH-003 — Workspace bootstrap owns safe Agent Home resolution

- Subject: workspace-bootstrap path service
- Repository/revision: `mayf3/dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`
- Environment: source worktree
- Observed at: `2026-08-30T23:26:26Z`
- Method: read path module and service responsibility comments
- Result: `resolveDshHome` maps a sanitized single-component `agentId` under configured
  agentsHome / `$DSH_AGENTS_HOME` / default root `~/.dsh/agents`; separators, dots, spaces and
  traversal forms are rejected.
- Provenance: `packages/workspace-bootstrap/src/paths.js:20-23,127-145,147-183`

### OBS-SH-004 — Base and canary are distinct pinned source coordinates

- Subject: requested backend base and live canary source revisions
- Repository/revision: `mayf3/dsh-agent-core`
- Environment: local Git object database; no canary mutation
- Observed at: `2026-08-30T23:26:26Z`
- Method: `git show -s --format='%H %cI %s' <base> <canary>` and scoped diff inspection
- Result: both commits resolve; the canary coordinate predates the authoring base, and scoped
  differences are confined to Router/demo-server among the inspected history-adjacent packages.
- Provenance: local Git objects for the two exact SHAs

### OBS-SH-005 — No existing backend history owner exists at base

- Subject: package inventory and Session/history references
- Repository/revision: `mayf3/dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`
- Environment: source worktree
- Observed at: `2026-08-30T23:26:26Z`
- Method: inspect package manifests and search package sources for Product API/session ownership
- Result: existing packages include product-api, router, workspace-bootstrap, memory and
  demo-server, but no read-only Session-history service/module.
- Provenance: `packages/*/package.json`, relevant package source headers

### OBS-SH-006 — 真实 main artifact 的 metadata-only 规模观测

- Subject: 本机默认 agents root 下全部真实 `main` trajectory artifacts
- Repository/revision: not a repository artifact（本机运行时数据，仅 metadata）
- Environment: `darwin 25.6.0 arm64`；`~/.dsh/agents/<agentId>/sessions/<encoded-cwd>/main/session.jsonl`
- Observed at: `2026-08-31T14:40:00Z`
- Method: `find` + `stat -f %z` + `awk` 行数/最大行字节统计；awk 只输出聚合计数，不输出任何行内容
- Result: 20 个 artifact；total 1,946,858 bytes；max size 333,283；max lines 176；max line
  bytes（含换行）41,271。
- Provenance: 本会话 shell 记录（仅数字聚合）

### OBS-SH-007 — Auth Child 首次出现于本 PR

- Subject: `docs/specs/PRODUCT_API_AUTHENTICATION_V1.md` 的存在性
- Repository/revision: `mayf3/dsh-agent-core@main 1fdf8c36`（不存在）与本 PR head（存在）
- Environment: local Git object database
- Observed at: `2026-08-31T14:30:00Z`
- Method: `git cat-file -e` 于 main 与 PR head
- Result: main 上不存在；本 PR 以 proposed 引入。
- Provenance: git 对象库查询

## 6. Claims and assumptions

### CLM-SH-001 — A new narrow read-only owner is required

- Support state: SUPPORTED
- Supported by evidence: `EVD-SH-001`, `EVD-SH-002`, `EVD-SH-003`
- Contradicted by evidence: none known
- Uncertainty: implementation must still pin and verify the exact DSH decoder available in its base

### CLM-SH-002 — Cold artifact read preserves the DSH Session authority boundary

- Support state: INFERRED
- Supported by evidence: `EVD-SH-002`
- Contradicted by evidence: none known
- Uncertainty: conformance requires future process-count, model-call and file-integrity evidence

### CLM-SH-003 — Source-channel metadata is incomplete for V1

- Support state: OPEN_ASSUMPTION
- Supported by evidence: none
- Contradicted by evidence: none known
- Uncertainty: this does not affect V1 Contract meaning because V1 explicitly omits channel metadata;
  persisting `source.channel` requires a separate future amendment

### CLM-SH-004 — deterministic composite hash 公共 ID 可无 store 地避免跨域碰撞

- Support state: INFERRED
- Supported by evidence: `EVD-SH-004`（header/行规模证明 tuple 输入可完全来自内存中的
  已解析记录）
- Contradicted by evidence: none known
- Uncertainty: SHA-256 碰撞概率与 base64url 编码稳定性是密码学常识性结论，实现期须以
  acceptance 验证同 snapshot 稳定性与碰撞 fail-closed

## 7. Evidence relations

### EVD-SH-001 — Product API source supports the missing thin history seam

- Source observations: `OBS-SH-001`
- Target: `CLM-SH-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`,
  source-only, observed `2026-08-30T23:26:26Z`
- Strength/sufficiency: strong for current source behavior
- Limitations: does not prove deployed behavior
- Provenance: `packages/product-api/src/index.js`

### EVD-SH-002 — Home and profile sources support cold-read feasibility

- Source observations: `OBS-SH-002`, `OBS-SH-003`
- Target: `CLM-SH-002`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`,
  production-profile source, observed `2026-08-30T23:26:26Z`
- Strength/sufficiency: sufficient to choose the owning boundary
- Limitations: no runtime filesystem or permission probe was executed
- Provenance: production profile and workspace-bootstrap path source

### EVD-SH-003 — Package inventory supports NEW ownership classification

- Source observations: `OBS-SH-001`, `OBS-SH-005`
- Target: `CLM-SH-001`
- Relation: SUPPORTS
- Bound coordinates: `mayf3/dsh-agent-core@9386ac4e4515ea628e2a450f402b540f165c13c3`,
  source-only, observed `2026-08-30T23:26:26Z`
- Strength/sufficiency: sufficient for PREFLIGHT ownership ruling
- Limitations: future accepted architecture may supersede this proposal before implementation
- Provenance: package manifests and source headers

### EVD-SH-004 — metadata 观测支持资源上限取值

- Source observations: `OBS-SH-006`
- Target: `CLM-SH-004`, `STATE-SH-005`
- Relation: SUPPORTS
- Bound coordinates: 本机 darwin 运行时数据（非 repo artifact），observed `2026-08-31T14:40:00Z`
- Strength/sufficiency: sufficient for ceiling baseline（20 个真实样本 + 10 倍余量）
- Limitations: 样本只覆盖本机当前 fleet；上限本身是 normative 冻结值，不随样本增长
- Provenance: shell 聚合输出（仅数字）

## 8. Decisions

### DEC-SH-001 — DSH Session remains the sole history authority

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: V1 resolves the authenticated Mobile surface's current Binding to `activeAgent`,
  then resolves that Agent's current canonical `main` trajectory server-side. History owns
  neither Session nor storage, and creates no second store or mapping.
- Rejected alternative: second database, message store or logical→native persistent mapping.
- Reason: preserve the accepted DSH-native Session boundary and avoid split truth.
- Remaining owner input: none

### DEC-SH-002 — Minimal backend service owns parsing and projection

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: `@agent-core/session-history` is the minimal read-only backend owner; Product API is a
  thin adapter.
- Rejected alternatives: parser in Mobile, Feishu connector, Product API, Router, memory or
  demo-server.
- Reason: keep policy in one backend owner without expanding any existing component across its
  frozen boundary.
- Remaining owner input: none

### DEC-SH-003 — Cold-read only

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: history reads the valid complete artifact prefix without starting an Agent or writing
  repair data.
- Rejected alternative: resume/start the Agent or reuse the prompt path to obtain history.
- Reason: GET must be observational and safe for cold Agents.
- Remaining owner input: none

### DEC-SH-004 — Public transcript is an allowlisted final-text projection

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: expose only direct user final text and the last non-empty final assistant text from a
  completed turn, with stable public IDs/times and event-seq ordering.
- Rejected alternative: raw events, chunks, reasoning, tools or provisional replies.
- Reason: prevent duplicates and internal-data leakage.
- Remaining owner input: none

### DEC-SH-005 — Channel metadata remains a future amendment

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: V1 returns no source-channel metadata and performs no inference or Feishu mirror.
- Rejected alternative: infer channel from text, placeholders or Binding, or modify ingress now.
- Reason: persisted `source.channel` is partial and requires an independent authority change.
- Remaining owner input: none

### DEC-SH-006 — 公开 Session selector 恒为字面量 `main`（logical slot）

- Decision owner: repository owner mayf3（审计 blocker 1 裁决方向）
- Decision: 公开 path 的 Session selector 只有字面量 `main`；Mobile 只用
  `Binding agentId + literal main` 构造请求；native trajectory ID 由服务端 trusted resolver
  从 authenticated Binding 出发解析，`SERVER_INTERNAL_ONLY`；响应 `sessionId` 恒为 `main`。
  reset / switch away / switch back 之后服务端重新解析 current main，不建立第二个
  logical→native 持久 mapping。
- Rejected alternatives: Mobile 持有/构造 native trajectory token；服务端返回 native ID 供
  后续请求；建立 logical→native mapping store。
- Reason: 与 accepted V3（D-008）「`MAIN_SESSION_IDENTITY = LOGICAL_SLOT`、
  `NATIVE_DSH_SESSION_ID = IMPLEMENTATION_DETAIL`（§8）、Human Binding 只持有 activeAgent
  （§18）」一致；消除 Mobile 发明身份的通道；reset 后旧 native ID 自然失效。
- Remaining owner input: none

### DEC-SH-007 — 资源上限以精确整数冻结并取 10 倍真实样本余量

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: `CTR-SH-011` 冻结八个精确整数字节/数量/时间上限与唯一错误
  `HISTORY_RESOURCE_LIMIT`（HTTP 413），取值对 `OBS-SH-006` 真实样本保留 ≥10 倍余量。
- Rejected alternative: 「合理上限」/implementation-defined 描述。
- Reason: 任意大的有效 Session 不得耗尽 Product API 进程；审计 blocker 2 要求确定性上限。
- Remaining owner input: none

### DEC-SH-008 — 公共 Message ID 是 deterministic composite hash

- Decision owner: repository owner mayf3（审计 blocker 4 裁决方向）
- Decision: 不公开裸 DSH raw message ID；`CTR-SH-012` 冻结
  `msg_sh1_<base64url(SHA-256(canonical_length_prefixed_tuple(...)))>`，tuple 绑定 spec
  常量、agentId、`main`、currentMainGenerationDigest、role 与 rawDshMessageId；无 store、无
  mapping；碰撞 fail-closed；reset 换 generation digest 后旧 cursor 自然 stale。
- Rejected alternatives: 直接返回 raw DSH ID（跨 role/Agent/reset 无全局唯一性证明）；随机
  ID + sidecar store（违反 SECOND_HISTORY_STORE = FORBIDDEN）。
- Reason: 继承 Message API 的全局唯一语义而不新建存储；同 snapshot 稳定、跨域不冲突、reset
  后旧 cursor 必 stale。
- Remaining owner input: none

### DEC-SH-009 — Tailnet-local 与公网 activation 拆分

- Decision owner: repository owner mayf3（Owner Option 1 裁决）
- Decision: `CTR-SH-010` 把 `LOCAL_TAILNET_HISTORY_ACTIVATION`（依赖 sibling auth Child 的
  local profile ready）与 `PUBLIC_HISTORY_ACTIVATION`（等待未来独立公网 authority）分开；
  本 Spec 不再等待公网 OAuth 才允许 Tailnet 激活，也不让公网复用 local profile。
- Rejected alternatives: 一体 gate 在不存在的公网 auth 上（过度阻塞 Tailnet-first 目标）；
  Tailnet membership 即授权（非 caller identity）。
- Reason: 当前产品目标是 Tailnet 模式下 Mobile 重开恢复历史；公网认证是 later 的独立
  authority。
- Remaining owner input: none

### DEC-SH-010 — current-main 解析在本地冻结为唯一 canonical locator + fail-closed（audit blocker 6）

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: D-008 §8/§9 只冻结 main = logical slot、reset 留白；本 Spec 将当前行为的
  server-side resolver 冻结在 `CTR-SH-013`：唯一 canonical candidate path + 全部 confinement
  通过者即 current main；多 main artifact 无启发式选择；reset 无特殊分支，由 stable-snapshot
  协议覆盖；不建持久 mapping。
- Rejected alternative: 启发式（mtime/size/名字序）挑选 current main；跨请求缓存
  logical→native 结果。
- Reason: 非 deterministic 或可 fallback 的解析会造成错误历史或跨 generation 误读
  （reclassification policy 内的 normative blocker）；future reset generalization 超出
  当前行为，归 FOLLOW_UP_DEBT。
- Remaining owner input: none

### DEC-SH-011 — public ID generation 来源本地冻结且不暴露 native id（audit blocker 7）

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: `CTR-SH-012` 的公共 message identity 由三级构成：generation component 取
  current main trajectory 首条完整 record 的 PREFIX_ANCHOR（SHA-256）与 HEADER_SUBSET
  canonical digest 的组合 canonical digest；每条消息另绑定
  `messageRecordDigest`（该消息 raw record 字节的 SHA-256）进入 tuple；
  native DSH session id 是
  SERVER-INTERNAL，只以摘要形式参与，永不出现在 tuple 明文、响应或日志中；wire codec
  （u32 BE length-prefix、fixed order 7 元素、base64url no-pad、51 字符总长）按
  `CTR-SH-012` 精确冻结。
- Rejected alternative: 以 native id 明文作为 generation token；以时间戳作为 generation
  （不 provably 随 reset 变化且引入时钟依赖）；仅以 header 子集
  `{version, id, createdAt, delegationDepth}` 作为 generation 输入（D-008 §9 对 native-id
  复用留白，`createdAt` 同毫秒复用时无法证明 reset 后 digest 变化——独立审计
  blocker，2026-09-03）；以完整 captured artifact bytes 作为 anchor（普通 append 改变
  全部既有公共 message ID，违反 `CTR-SH-006` 稳定性/no-gap 分页——PR #145 review
  blocker B2，2026-09-03）；仅以首条 record anchor 作为身份可区分性来源（首条 record
  逐字节相同、后续内容不同且 rawId 复用的 reset 盲区可产生同 ID 不同内容——PR #145
  re-audit blocker，2026-09-03，由 `messageRecordDigest` 内容绑定闭合）。
- Reason: 公共 message identity 必须对普通 append 完全稳定、又在任何内容差异下可证明
  不同（不依赖 D-008 留白的复用假设、不依赖 reset 语义、不依赖任何存储），同时不泄露
  server-internal 身份；generation（首条 record）+ 内容绑定（每条消息 record 摘要）
  的组合恰好同时满足：同 ID 蕴含同内容（无误读），内容不同蕴含不同 ID（旧 cursor
  fail-closed 409）。
- Remaining owner input: none

## 9. Contracts

### CTR-SH-001 — Sole authority and logical-main identity

The implementation MUST treat the target DSH native Session artifact as the sole history authority.
Product API MUST pass the sibling auth Child's trusted Mobile surface auth context
（schema 按 sibling 的 `CTR-PA-003`：`principalType = mobile_tailnet_node`、
verified canonical `surfaceId`、`authProfile`、`configGeneration`）unchanged to the history
service. The history service MUST derive that surface identity and read its current Binding
through the existing Router read service, exactly once per request（ONE authoritative Binding
snapshot per request；History 层是唯一 Binding reader，`CTR-PA-006` 已禁止 auth 层读 Binding）.
An authorized surface with no Binding MUST return
`SESSION_NOT_FOUND` without Agent/Session lookup; a Binding-read operational failure MUST return
`INTERNAL_ERROR`. For an existing Binding, request `agentId` MUST equal `Binding.activeAgent`
（D-008 §18 accepted 字段名；不得使用 `activeAgentId` 等变体名）.

Session identity MUST follow this frozen chain:

1. Auth Child（`PRODUCT_API_AUTHENTICATION_V1`）验证 `(stableTailscaleNodeId, surfaceId)`
   exact pair；
2. trusted authContext 提供 `surfaceId`；
3. History adapter 读取该 surface 的 authoritative Mobile Binding；
4. path `agentId` 必须等于 `Binding.activeAgent`；
5. logical slot 固定为 `main`（公开 selector 唯一合法值）；
6. Backend trusted resolver 解析该 Agent 当前 canonical main trajectory（native trajectory
   ID 仅存在于服务端内部）；
7. Mobile 永远不接收、保存、构造或发送 native trajectory ID；
8. main reset 后服务端重新解析 current main；
9. switch away / switch back 后服务端重新解析对应 Agent 的 current main；
10. 不建立第二个 logical→native 持久 mapping。

`@agent-core/session-history` names one minimal read-only service contract; its implementation MAY be
an internal module or a tiny package, but MUST NOT be an independent Session engine/manager.
It MUST be the only backend owner that reads raw DSH Session records and applies this projection.
Product API, Mobile and connectors MUST NOT parse Session artifacts. The service MUST NOT expose a
Session-management write surface.

### CTR-SH-002 — Exact HTTP contract and validation

Product API MUST expose exactly:

```http
GET /v1/agents/{agentId}/sessions/main/messages?limit=50&before=<publicMessageId>
```

`agentId` MUST be one non-empty safe component of at most 200 characters under the existing
workspace-bootstrap validator. The route class exposed to the network is
`GET /v1/agents/{agentId}/sessions/{selector}/messages` on the dedicated Tailnet history
listener（`PRODUCT_API_AUTHENTICATION_V1` `CTR-PA-001`：该 listener 上所有请求都进入 auth
admission，selector 值不影响 profile match）；本 Spec 的 input validation 在 auth admission
之后运行。The path Session selector MUST be the literal `main`; any other
value is `400 VALIDATION_ERROR`（该 400 属于本 Spec 的输入校验，发生在 trusted authContext
建立之后，不进入 auth Child 的 403 语义——两份 Spec 对同一请求只有一个 ownership 链：
auth admission → History input validation）。
`limit` MUST default to `50`, accept decimal integers `1..200`, and reject all other values with
`400 VALIDATION_ERROR`. `before` is optional, exclusive, and MUST be a public message ID as
defined by `CTR-SH-012`. Success MUST be:

```json
{
  "messages": [
    {
      "id": "msg_sh1_<base64url>",
      "agentId": "string",
      "sessionId": "main",
      "role": "user | assistant",
      "content": "string",
      "createdAt": "ISO-8601 UTC"
    }
  ],
  "hasMore": true
}
```

The response `sessionId` MUST be the literal `main`; it MUST NOT return any internal native
trajectory ID. `id` MUST be the public composite ID from `CTR-SH-012`, never a raw DSH message ID.

Product API MUST only validate/decode HTTP input, pass the trusted auth context to
`sessionHistory.listMessages`, and map the service result/error to the envelope. It MUST NOT resolve
current main or inspect artifacts itself. After upstream authentication and authorization succeed,
the history handler's exact success/error envelopes are closed; no extra fields are allowed. Its
post-auth errors MUST be:

```text
400 VALIDATION_ERROR
404 AGENT_NOT_FOUND
404 SESSION_NOT_FOUND
409 HISTORY_CURSOR_STALE
413 HISTORY_RESOURCE_LIMIT
500 INTERNAL_ERROR
```

Every post-auth history-handler HTTP error MUST use exactly
`{"error":{"code":"<CODE>","message":"<safe non-empty message>"}}`; no path, cause, stack,
internal ID or extra field is permitted. Upstream 401/403/503 authentication/authorization
responses are owned by the accepted auth authority (`PRODUCT_API_AUTHENTICATION_V1`) and are
outside this post-auth envelope; they MUST occur before Binding, Agent or Session lookup.

`before` MUST decode as one non-empty UTF-8 public message ID of at most 512 bytes; structural
malformation（非法前缀/编码/长度）is `400 VALIDATION_ERROR`. A well-formed public ID that does
not exist in the current main trajectory（含 main reset 后的旧 cursor）is
`409 HISTORY_CURSOR_STALE`; the service MUST NOT guess or remap a cursor, and MUST NOT let a
reset-era cursor accidentally match a same-raw-ID message in a new trajectory. Invalid URL
encoding, empty/overlong path/query values, non-integer/out-of-range `limit`, traversal syntax and
malformed `before` are `400 VALIDATION_ERROR`. After authorization and current-Binding match, a
missing Agent Definition is `404 AGENT_NOT_FOUND`; absent Binding, mismatched agent or absent
artifact is `404 SESSION_NOT_FOUND`. Binding-read operational failure is `500 INTERNAL_ERROR`.
Header/location mismatch, symlink escape, duplicate raw or public message ID in one trajectory,
committed corruption, unsupported format, resource-ceiling violation (`CTR-SH-011`) and
stable-read exhaustion are covered by `CTR-SH-003`/`CTR-SH-011`/`CTR-SH-012`.

### CTR-SH-003 — Cold-read valid complete prefix

A history GET MUST NOT call `agentRouter.ensureRunning`, `AgentProcess.spawn`, any model,
`session/prompt`, or any other admission/write path. It MUST NOT change Binding, Agent Home,
Workspace or Session; MUST NOT write a synthetic closer; MUST NOT repair or truncate a torn record;
and MUST NOT start a cold Agent.

The service MUST use at most two bounded snapshot attempts. Before each attempt it MUST resolve and
stat the canonical pathname and capture pre-open revision
`P=(device,inode,size,mtimeNs,ctimeNs)`, then open that exact artifact read-only with no symlink
following and capture the same descriptor revision `D0`. `P` MUST equal `D0` before reading. It MUST
read exactly `D0.size`（bounded by `MAX_ARTIFACT_BYTES`, `CTR-SH-011`）, then re-stat descriptor as
`D1` and canonical pathname as `P1`. Success requires a full-length read, pathname still inside the
same canonical Agent Home and canonical Session root (`CTR-SH-007`), and `P = D0 = D1 = P1` across
all five revision fields. Any append, replacement, truncation,
truncate-and-regrow, short read or revision/identity change retries once, then returns
`INTERNAL_ERROR`. The promise excludes an adversarial privileged writer able to rewrite bytes while
forging inode timestamps; normal DSH append/rename/truncate concurrency is covered. No attempt may
wait for an Agent or writer.

The accepted encoding is plaintext newline-delimited JSON used by the production profile. The first
complete line MUST be a DSH v0 header object with only the known fields: `type = session`,
`version = 0`, non-empty string `id`, non-negative safe integer `createdAt`, non-negative safe integer
`delegationDepth`, optional strings `cwd`, `parentSession`, `agentPreset`, optional
`origin = subagent`, and optional non-negative safe integer `seedLength`. `-0`, unknown header fields
or invalid optional values are malformed. Each following newline-terminated storage
record MUST decode through the pinned DSH public decoder into zero or more individual events. Each
expanded event MUST have non-empty string `type`, non-negative safe-integer `seq`, non-negative
safe-integer millisecond `time` that is representable as canonical ISO-8601 UTC, and object `data`;
numeric `-0` is invalid; expanded `seq` MUST be contiguous and zero-based. Event types outside the
three projection/correlation types in `CTR-SH-004/005` are accepted only as ignored internal events.
Packed chunk rows may decode only to ignored events; they never become messages. A final byte
fragment with no newline is the only
torn-tail case and MUST be ignored. Invalid JSON on a newline-terminated line, unknown/unsupported
format or version, seq gap/duplicate, malformed header/event, or duplicate terminal boundary is
committed corruption and MUST return
`INTERNAL_ERROR`. The service MUST NOT fabricate messages or write repair bytes.

Bounded decoder seam（count-before-expand；不得先全额分配再计数）: the service MUST consume the
pinned DSH public read-only decoder only through a seam that enforces `CTR-SH-011` ceilings
**before** full materialization. The exact required DSH seam contract is: a public read-only
decode entry point that (a) accepts one newline-terminated storage record of at most
`MAX_RECORD_BYTES` at a time, (b) yields its expanded events one at a time or as a lazily
iterable sequence, and (c) can be aborted by the caller between records and between expanded
events. The service MUST count expanded events incrementally and abort with
`HISTORY_RESOURCE_LIMIT` as soon as `MAX_EXPANDED_EVENT_COUNT` would be exceeded, before the
remaining events of that record are materialized. Honest ceiling statement: per-record JSON
parse itself may transiently allocate up to the record's parsed size（bounded by
`MAX_RECORD_BYTES` pre-parse）; no unbounded allocation above that bound is permitted, and the
service MUST NOT concatenate all records or all expanded events in memory at any point beyond
the frozen per-message/per-response ceilings of `CTR-SH-011`. If the pinned DSH decoder
revision cannot provide (a)–(c), the implementation MUST wrap it with a bounded pre-scan that
counts without materializing, or fail closed `HISTORY_RESOURCE_LIMIT`; it MUST NOT loosen any
ceiling to accommodate the decoder.

### CTR-SH-004 — User message projection

A user event is **relevant** exactly when `event.type = user/message`, `event.surfaceOp = append`,
and `data.source.kind = user`. For every relevant event, before projection the service MUST require
object `data`, non-empty string `data.id`, and array `data.content`; any failure is
`INTERNAL_ERROR`, never a silent exclusion.

For each valid relevant event it MUST:

- require every content item to be an object with non-empty string `type`; for `type = text`, require
  string `text`; ignore objects with any other `type`, then concatenate non-empty text values in block
  order;
- omit the event when the resulting text is empty;
- use `user/message.data.id` as the raw DSH message ID, which MUST be exposed only through the
  public composite ID of `CTR-SH-012`;
- use `user/message.time`, converted to ISO-8601 UTC, as `createdAt`;
- use the requested `agentId`, logical `sessionId = main` and role `user`.

It MUST exclude `agent/inbox/spliced`, `source.kind = plugin`, `source.kind = goal`, system
reminders, memory snapshots and internal events. One logical input represented by
`inbox/spliced + user/message` MUST appear exactly once, from the qualifying `user/message` only.
Text order and bytes MUST otherwise be preserved. This structural predicate is the complete
`direct user` relevance test; content text MUST NOT be inspected to infer source. A malformed
relevant event or content item MUST return `INTERNAL_ERROR`, not be silently reclassified.

### CTR-SH-005 — Assistant completed-turn projection

The projection MUST require every correlated `data.turn` to be a positive safe integer other than
`-0`, and group by that value. A turn is eligible only when the complete prefix contains exactly one
later event with `event.type = turn/end`, matching `data.turn`, and
`turn/end.data.reason.kind = completed`. The selected assistant event MUST precede that end event.
A missing terminal makes that turn non-projectable as provisional. A duplicate terminal or an
assistant candidate at/after its matching terminal is committed corruption under `CTR-SH-003` and
MUST return `INTERNAL_ERROR`. For each eligible turn it MUST
select the highest-`seq` `assistant/message` with `surfaceOp = append`, object `data.message`,
non-empty string `data.message.id`, and array `data.message.content`. Every content item MUST be an
object with non-empty string `type`; a text item MUST have string `text`; objects with any other
`type` are ignored. The candidate qualifies only when at least one text item is non-empty. It MUST
concatenate non-empty text items in order, use `data.message.id` as the raw DSH message ID, which
MUST be exposed only through the public composite ID of `CTR-SH-012`, and convert that
`assistant/message.time` to ISO-8601 UTC as `createdAt`.

It MUST exclude `assistant/chunk`, `text-chunks`, `reasoning-chunks`, tool-call, tool-result, usage,
tool-only `assistant/message`, and provisional text from incomplete, failed, blocked, interrupted,
aborted or otherwise non-completed turns. It MUST NOT concatenate chunk/block-end events with the
selected final `assistant/message`, and MUST return at most one assistant message per completed turn.

Missing / non-integer / unsafe `data.turn` classification（deterministic；不得留给实现决定）:

- an `assistant/message` event whose `data.turn` is absent, or is not a positive safe integer
  other than `-0`, is **non-correlatable**: it MUST be dropped as an ignored internal event
  (never projected, never grouped, never fatal);
- a `turn/end` event whose `data.turn` is absent or is not a positive safe integer other than
  `-0` is **non-correlatable**: it MUST be dropped and cannot terminate any turn; it is not
  committed corruption by itself;
- a `turn/end` whose positive safe-integer `data.turn` matches no assistant candidate is
  ignored;
- an `assistant/message` or `turn/end` that **does** carry a positive safe-integer `data.turn`
  but is otherwise malformed（`data.message` shape, duplicate terminal for the same turn,
  assistant candidate at/after its matching terminal）is committed corruption under
  `CTR-SH-003` and MUST return `INTERNAL_ERROR`, not be silently skipped.

Summary: missing/unsafe correlation keys drop the event; present-but-malformed correlated
payloads fail closed.

### CTR-SH-006 — Seq ordering, pagination and stale cursors

The service MUST order the full projected sequence by DSH event `seq`, not timestamps. Equal
millisecond timestamps MUST not affect ordering.

- Without `before`, return the final `limit` projected messages.
- With `before`, locate that exact **public** projected message ID（`CTR-SH-012`）and return at most
  `limit` projected messages immediately before it.
- Each response's `messages` MUST be ascending by authoritative `seq`.
- `hasMore` MUST be true exactly when at least one earlier projected message exists before the
  returned page. An empty projection returns `messages=[]`, `hasMore=false`; a valid `before` naming
  the first projected message also returns `messages=[]`, `hasMore=false`.

Cursor failure semantics（frozen；不得留给实现决定）:

```text
MALFORMED_CURSOR（结构性非法 public ID）        = 400 VALIDATION_ERROR
WELL_FORMED_BUT_NOT_IN_CURRENT_MAIN（含 reset 后旧 cursor）= 409 HISTORY_CURSOR_STALE
```

For an unchanged valid artifact prefix, repeated reads MUST preserve every public `message.id`,
`createdAt`, order and page boundary. Adjacent pages MUST have no duplicate or skipped projected
message. These no-gap guarantees bind one unchanged captured prefix AND one unchanged
currentMainGenerationDigest; ordinary Session append MUST NOT change any previously issued
public ID（generation 只由 HEADER_SUBSET + PREFIX_ANCHOR 派生，append 不触碰首条
record，且既有消息的 record 字节不变 → `messageRecordDigest` 不变）；after main reset, a
previously issued cursor is valid exactly when the current trajectory contains a message
whose `(role, rawId, messageRecordDigest)` 与签发时完全相同（此时呈现内容逐字节相同，无跨
generation 误读）；every other previously issued public ID（含 rawId 复用但内容不同、
或 rawId 已不存在）is structurally stale and MUST return `409 HISTORY_CURSOR_STALE`
rather than being remapped——即使 reset 复用 native session id 与 `createdAt`。Duplicate
public message IDs within one trajectory snapshot MUST fail closed as
`INTERNAL_ERROR`.

### CTR-SH-007 — Agent/Session identity and canonical Session-root confinement

Before reading history, the service MUST:

1. require trusted authenticated Mobile surface context（来自 auth Child 的 trusted
   authContext，不是原始 header/Node ID）; resolve its current Binding; map absent Binding to
   `SESSION_NOT_FOUND` and Binding-read operational failure to `INTERNAL_ERROR`, both without
   artifact lookup;
2. require request `agentId = Binding.activeAgent` and path selector = literal `main`, otherwise
   `SESSION_NOT_FOUND` without artifact lookup;
3. confirm that matched Agent Definition exists, otherwise `AGENT_NOT_FOUND`;
4. resolve the target Agent Home only through configured workspace-bootstrap Home authority
   (`CANONICAL_AGENT_HOME`)；
5. canonicalize the configured Session root (`CANONICAL_CONFIGURED_SESSION_ROOT`) and require it
   to be a strict subtree of `CANONICAL_AGENT_HOME`；
6. locate only native `main` beneath that exact canonical Session root using the pinned DSH
   locator/encoding; the target artifact (`CANONICAL_TARGET_ARTIFACT`) MUST be a strict descendant
   of `CANONICAL_CONFIGURED_SESSION_ROOT`; a path merely inside the Agent Home but outside the
   Session root MUST NOT be read;
7. require the artifact to exist, otherwise `SESSION_NOT_FOUND`;
8. require Session header `id = main`;
9. require the opened artifact to be the one identified by its header/location rules and to remain
   within the canonical boundaries after open.

Filesystem confinement MUST satisfy all of:

- every path component from `CANONICAL_AGENT_HOME` down to the final file MUST be free of
  symlink/alias（lstat each component; reject any `S_ISLNK`）；
- the final artifact MUST be a regular file only（reject directory、device、fifo 等）；
- the open MUST use safe open/no-follow（`O_NOFOLLOW` 或等价），open 后以 `fstat` 的
  `(device,inode)` 与 pre-open canonical stat 严格一致，关闭 check/open TOCTOU 窗口；
- **hardlink exclusion（cross-root hardlink escape 显式排除）**: the opened artifact MUST have
  `st_nlink = 1`（exactly one directory entry）AND its `st_dev` MUST equal the `st_dev` of the
  canonical configured Session root directory（same filesystem as the confinement root）. Any
  artifact with link count > 1 or on a different device than the Session root is rejected as
  `INTERNAL_ERROR` before any content byte is read. Under the cooperative shared-host threat
  model this is the enforceable control: an attacker able to hardlink an outside file into the
  Session root（link count > 1）or bind-mount/cross-device plant（device mismatch）cannot make
  it readable through the history route. This control excludes cross-root hardlinks explicitly;
  same-root ordinary files with `st_nlink = 1` remain readable;
- any confinement failure MUST occur before any content byte is read；
- header `id`/format/origin 不匹配即 fail-closed；
- cross-Agent Home access MUST be rejected。

Path traversal, `..`、slash、backslash、encoded separator, symlink escape at any component
（含指向 Home 内其它目录的中间 symlink 与指向 Home 外的 symlink）、final symlink、
check/open 之间替换、duplicate Session IDs, header mismatch, cross-Agent Home access or
arbitrary-file reads MUST fail closed and MUST NOT reveal filesystem paths. A Session found only in
another Agent Home is `SESSION_NOT_FOUND` for the requested Agent. All confinement failures MUST
read zero bytes.

### CTR-SH-008 — Privacy allowlist

The HTTP response MUST contain only user final text, assistant final completed text, public message
ID (`CTR-SH-012`), timestamp, `agentId`, logical `sessionId = main`, plus top-level `hasMore`. It
MUST NOT project or return reasoning, system prompts/reminders, tool parameters, tool results,
usage, credentials, provider internal errors, workspace paths, Agent Home paths, raw DSH events,
raw DSH message IDs, native trajectory IDs, internal PIDs or Session header `cwd`. Here
"credentials / paths / provider errors" means separate internal event/header/error fields;
`content` is the byte-preserved selected user data governed by `CTR-SH-004/005`. V1 is not a
semantic DLP/redaction system and MUST NOT inspect prose to guess whether it resembles a secret or
path. Error responses and logs MUST obey the same no-path/no-internal-payload boundary.

### CTR-SH-009 — Channel metadata omission

`SOURCE_CHANNEL_METADATA = PARTIAL`. V1 MUST NOT return `mobile`, `feishu`,
`senderDisplayName`, `channelConversationId` or inferred source metadata. It MUST NOT infer source
from message text, `@` placeholders or Binding. Persisting and exposing `source.channel` remains a
future independent amendment and MUST NOT be added as incidental implementation scope.

### CTR-SH-010 — Feishu, lifecycle and split rollout boundary

`FEISHU_MIRROR = OUT_OF_SCOPE`. Implementation MUST NOT copy Mobile messages to Feishu, use
Feishu as history storage, introduce dual-write/feedback loops, or modify Feishu connector for
history. Multiple Channels may naturally observe one shared DSH Session trajectory when they
actually reference the same `(agentId, main)`; this MUST NOT be represented as a guarantee
that their Bindings are equal。

Rollout boundary 拆分为两个独立 activation:

```text
LOCAL_TAILNET_HISTORY_ACTIVATION =
ALLOWED_ONLY_WHEN_PRODUCT_API_AUTHENTICATION_V1_LOCAL_PROFILE_READY

PUBLIC_HISTORY_ACTIVATION =
FORBIDDEN_UNTIL_PUBLIC_AUTH_READY
```

`LOCAL_TAILNET_HISTORY_ACTIVATION` 允许的全部前提：

- sibling `PRODUCT_API_AUTHENTICATION_V1` accepted 并进入 main；
- 本 History Spec accepted 并进入 main；
- Auth Child 实现通过独立审计；
- History 实现通过独立审计；
- 专用 history-only Tailnet listener（`HISTORY_LISTENER`，sibling `CTR-PA-001`）直接绑定
  Tailscale 地址（非公网 wildcard）；现有 Product API server 保持 loopback-only bind；
- local auth profile ready（config valid、tailscaled identity 接口 ready、exact
  Node/surface pair 存在）；
- exact phone Node/surface pair 通过；
- authoritative Mobile Binding 存在；
- path agent 等于 `Binding.activeAgent`。

任一前提不成立时 history route MUST 保持 disabled/absent；强制 enable 在 auth 未 ready 时
MUST fail startup closed（`PRODUCT_API_AUTH_NOT_READY`），MUST NOT 挂载降级路由。Loopback
alone is never activation authority。

`PUBLIC_HISTORY_ACTIVATION`：public / non-Tailnet 入口 MUST NOT 复用 local auth profile、
MUST NOT 因任何 Node/surface pair 获得授权，并保持 disabled 直到未来独立的公网
OAuth/Gateway/Product API auth authority accepted + implemented；本轮不设计公网 OAuth。

本 Spec 不定义认证算法。History service 的身份输入 MUST 是 trusted authContext
（`CTR-PA-003` schema：`principalType = mobile_tailnet_node`、`surfaceId`、`authProfile`、
`configGeneration`）；它 MUST NOT 自己调用
tailscaled、MUST NOT 自己解析原始 surface header、MUST NOT 自己读取 auth config、MUST NOT
发明竞争性 credential scheme。401/403/503 的细节归 auth Child `CTR-PA-007`。distinct
Agent/Session 404s MUST occur only after authorization。

The implementation MUST NOT modify Router/Ingress/demo-server behavior, Mobile repository, Agent
Home, existing Session files or canary as part of implementing this Contract. Deployment, canary
apply and merge remain separately authorized actions. Rollback is disablement/removal of the new
GET adapter and read-only service; because there is no owned persistence, no data migration or
rollback write is allowed.

### CTR-SH-011 — Frozen resource ceilings

每个请求的 decode/project 工作量 MUST 受以下精确整数上限约束（对 `OBS-SH-006` 真实样本
保留 ≥10 倍余量；禁止「合理上限」或 implementation-defined 表述）：

```text
MAX_ARTIFACT_BYTES                     = 4,000,000
MAX_RECORD_BYTES                       = 512,000
MAX_EXPANDED_EVENT_COUNT               = 20,000
MAX_CONTENT_BLOCKS_PER_MESSAGE         = 4,096
MAX_PROJECTED_TEXT_BYTES_PER_MESSAGE   = 1,000,000
MAX_TOTAL_PROJECTED_TEXT_BYTES_PER_RESPONSE = 8,000,000
MAX_RESPONSE_MESSAGE_COUNT             = 200
MAX_DECODE_WALL_TIME_MS                = 10,000
```

检查点与失败语义 MUST 满足：

- artifact size 在**读取前**检查（超限则不打开读取内容）；
- record length 在 JSON parse 前检查；
- event count 在展开前检查（不得先全部展开再计数）；
- content block count 在逐条投影前检查；
- text bytes 在字符串聚合时增量检查；
- response 消息数与总 text bytes 在响应组装前检查；
- wall deadline 使用 monotonic clock，跨整个 decode/project 流程；
- 任一上限或 deadline 超限：立即 fail-closed，返回唯一错误 `HISTORY_RESOURCE_LIMIT`
  （HTTP `413`，envelope 同 `CTR-SH-002`）；
- 超限响应 MUST NOT 返回部分历史；
- 超限处理 MUST NOT 修改 Session、MUST NOT 启动 Agent、MUST NOT 调用模型；
- 超限 MUST NOT 把正文或路径写日志。

### CTR-SH-012 — Deterministic composite public message identity

```text
PUBLIC_MESSAGE_ID_MODE = DETERMINISTIC_COMPOSITE_HASH
```

公开 Message ID 的精确形式：

```text
msg_sh1_<base64url(
  SHA-256(
    canonical_length_prefixed_tuple(
      "MOBILE_SESSION_HISTORY_V1",
      agentId,
      "main",
      currentMainGenerationDigest,
      role,
      rawDshMessageId,
      messageRecordDigest
    )
  )
)>
```

要求：

**Tuple wire codec（frozen，grammar exact）**

```text
PUBLIC_MESSAGE_ID_VERSION = 1
CODEC_TAG                 = "MSH1" (4 ASCII bytes, no NUL)
ELEMENT_COUNT_FIELD       = unsigned 32-bit big-endian, element count (always 7)
LENGTH_PREFIX             = unsigned 32-bit big-endian byte length, then that many
                            UTF-8 bytes of the element; no terminator, no padding,
                            no escaping; empty element = length 0 (legal)
ELEMENT_ORDER (fixed)     = ["MOBILE_SESSION_HISTORY_V1", agentId, "main",
                             currentMainGenerationDigest, role, rawDshMessageId,
                             messageRecordDigest]
DIGEST                    = SHA-256 over CODEC_TAG || ELEMENT_COUNT_FIELD || elements
                            (concatenated in order)
ENCODING                  = base64url (RFC 4648 §5) WITHOUT padding
OUTPUT                    = "msg_sh1_" + digest, exactly 8 + 43 = 51 ASCII characters;
                            any other length/form is structurally malformed cursor input
```

`messageRecordDigest` = SHA-256（hex 小写）of 该消息对应 raw DSH record 在 `CTR-SH-003`
stable snapshot 中的确切字节。它是内容绑定（PR #145 re-audit blocker 修复）：同
`(generation, agent, main, role, rawId)` 但 record 内容不同 → `messageRecordDigest` 不同
→ 公共 ID 不同；公共 ID 相同当且仅当 role、rawId 与 record 内容全部相同（SHA-256 抗原像
下，同 ID 呈现的消息逐字节相同——跨 generation 误读在构造上不可能，不依赖 reset 语义或
任何存储）。record 字节只以摘要参与，MUST NOT 进入响应或日志。append 不改变既有消息的
record 字节 → `messageRecordDigest` 与全部既有公共 ID 逐字节稳定（与 PREFIX_ANCHOR 的
append-stability 一致）。

base64url 输出长度固定为 43（256 bits）；`=` padding、标准 base64 的 `+`/`/`、大小写混合
编码一律非法（cursor 输入侧为 `400 VALIDATION_ERROR`）。golden vectors 在 acceptance 期
可选，但上述 grammar 是唯一合法编码。

**Generation component（append-stable、reset-provably-changing 且不暴露内部 id）**

- `currentMainGenerationDigest` MUST be present in every tuple（mandatory component）；
- 其来源 MUST 是 `CTR-SH-013` 解析出的 current canonical main trajectory 在 `CTR-SH-003`
  stable snapshot 捕获到的**首条完整 record**，按两级定义冻结：

```text
PREFIX_ANCHOR              = SHA-256(first complete record bytes)（hex 小写；
                             即 CTR-SH-003 stable snapshot 中该 trajectory 的第一条
                             完整 JSONL record 的确切字节；流式计算，随读取进行，
                             无二次 I/O；首条 record 不完整/不存在 → 既有 torn-record
                             规则 fail-closed，不产生 generation）
HEADER_SUBSET_CANONICAL    = JSON canonical form（key 排序、无空白、UTF-8、
                             整数无 -0）of {version, id, createdAt, delegationDepth}
currentMainGenerationDigest = SHA-256(
                               canonical_length_prefixed_tuple(
                                 HEADER_SUBSET_CANONICAL, PREFIX_ANCHOR))（hex 小写）
```

  该定义是无记忆的纯函数：除被捕获的 artifact 首条 record 外不依赖任何存储、缓存或
  历史状态（无 second history store、无 logical→native mapping）；
- **append-stable（CTR-SH-006 稳定性前提）**：普通 Session append 只追加后续 record，
  首条 record 字节不变 → `PREFIX_ANCHOR` 不变 → generation digest 不变 →
  全部既有公共 message ID 与已签发 cursor 逐字节稳定（PR #145 review blocker B2 的
  禁止行为：任何随 append 变化的 transcript suffix 不得参与 generation）；
- current main trajectory 的 native DSH session id 是 SERVER-INTERNAL
  （D-008 §8 `NATIVE_DSH_SESSION_ID = IMPLEMENTATION_DETAIL`）。generation digest MUST 只以
  SHA-256 摘要形式存在：digest 输入/输出 MUST NOT 包含 `cwd`、路径、header 明文或
  transcript 内容（PREFIX_ANCHOR 只以摘要形式参与）；原像抵抗保证 native id 不因 digest
  泄露；
- 该来源与 `messageRecordDigest` 共同提供无条件 reset 可区分性，不依赖 D-008 §9 留白的
  native-id 复用假设：任何跨 cursor 误读都要求新 trajectory 中存在一条
  `(role, rawId, recordDigest)` 与旧消息完全相同的消息——由 SHA-256 抗原像，这蕴含该
  消息 record 字节与旧消息逐字节相同，呈现内容完全相同，不存在「同 ID 不同内容」；
  反之，内容不同的复用 rawId 消息得到不同 `messageRecordDigest` → 不同公共 ID → 旧
  cursor 结构上不匹配，行为是 `409 HISTORY_CURSOR_STALE`（PR #145 re-audit blocker 的
  首记录盲区由内容绑定闭合，不依赖 reset 语义或任何存储）；
- main reset 后（首条 record 不同时）generation digest MUST 与旧 trajectory 不同，旧
  公共 ID 结构上无法匹配新 trajectory，行为是 `409 HISTORY_CURSOR_STALE`；
- reset 后首条 record 逐字节相同（prefix-identical reset）时 generation digest 不变：
  既有 cursor 是否有效完全由 `messageRecordDigest` 内容绑定决定——前缀区域内
  （record 逐字节相同）的旧 cursor 解析到逐字节相同的消息（同一历史，无跨 generation
  误读）；首条 record 相同但后续 record 内容不同（即使 rawId 复用）的旧 cursor 因
  `messageRecordDigest` 不同而结构上无法匹配，行为是 `409 HISTORY_CURSOR_STALE`；
- 同一 snapshot 重复读取的公共 ID 完全稳定；
- 跨 role、跨 Agent、跨 trajectory、reset 前后不冲突（tuple 已绑定全部五维，含内容
  绑定）；
- 不需要数据库、sidecar 或 mapping；
- **碰撞语义**：同一 snapshot 内出现公共 ID 碰撞（同 ID 不同消息）→ 整个请求 fail-closed
  `INTERNAL_ERROR`；跨 snapshot/generation 的 256-bit 哈希碰撞不是本 Spec 可检测或可恢复
  的对象：不同 generation 的旧 cursor 在新 trajectory 中结构上无法匹配，行为是
  `409 HISTORY_CURSOR_STALE`（fail-safe，不是误读）；本 Spec 不为此概率事件增加任何
  运行时检测或存储（FOLLOW_UP_DEBT §13.1 记录，不做 normative 工程）；
- raw DSH message ID MUST NOT 返回 Mobile；客户端 MUST 把公共 ID 视为 opaque；
- 公共 ID MUST NOT 泄露内部路径、`cwd`、native trajectory ID 或 raw DSH ID。

### CTR-SH-013 — Deterministic current-main resolver（fail-closed，server-internal）

服务端 trusted resolver MUST 按以下精确规则选择 current canonical main trajectory
（deterministic、fail-closed、无启发式、无持久 mapping）：

1. 解析输入只有：`CANONICAL_AGENT_HOME`（`CTR-SH-007`）+ canonical configured Session
   root + pinned DSH locator/encoding 产生的**唯一 canonical candidate path**
   `sessions/<encoded-cwd>/main/session.jsonl`（`<encoded-cwd>` 由 workspace-bootstrap
   安全 Home 解析与 pinned DSH encoding 确定，不含任何用户输入）；
2. current main = 打开时存在于该 canonical candidate path、且通过 `CTR-SH-007` 全部
   confinement（含 hardlink exclusion）与 header 校验（header `id = main`）的那一个
   artifact；resolver MUST NOT 缓存跨请求的 logical→native 结果；
3. 若 canonical candidate path 不存在 → `SESSION_NOT_FOUND`（absent main；本 Spec 不创建
   main——creation/resume 属写入路径，归其它 authority）；
4. 若 Session root 下存在**多于一个** header `id = main` 的 artifact（如任何非常规布局
   或 locator 外的 main trajectory）：resolver MUST NOT 按名字、时间、大小或任何启发式
   挑选；只要 canonical candidate path 本身通过全部校验，就以其为 current main 并忽略
   其它 artifact（locator 外文件永不可达，`CTR-SH-007` step 6）；若 canonical candidate
   path 自身校验失败（含 header mismatch）→ `INTERNAL_ERROR`，MUST NOT fallback 到任何
   其它 main artifact；
5. reset 期间/之后：D-008 §9 将 reset 机制留给 implementation；resolver 无 reset 概念，
   每请求按规则 1–4 重新解析。reset 的任何中间文件状态（rename/two-phase write）由
   `CTR-SH-003` 的 stable snapshot 协议覆盖：观察到 revision 变化即重试一次，持续不稳定
   返回 `INTERNAL_ERROR`；reset 后旧 trajectory 不再位于 canonical candidate path，
   自然不再可解析；
6. 旧 trajectory 的任何 artifact（reset 遗留、locator 外）MUST NOT 可经 history route
   读取；不存在任何公共输入可寻址它；
7. resolver 输出（native trajectory 身份、路径、generation digest 输入）MUST NOT 出现在
   HTTP 响应、错误或日志中（`CTR-SH-008`/`CTR-SH-014`）。

### CTR-SH-014 — Runtime log privacy allowlist

Runtime 日志（普通 success 与 error 路径，含 Product API adapter 与
`@agent-core/session-history` service）MUST NOT 记录：任何 transcript/消息正文、任何
public message ID（含 `before` cursor 值）、reasoning/tool/usage 内容、文件路径、Agent
Home 路径、native trajectory ID、raw DSH message ID、Session header 字段、`cwd`、
filesystem topology。每个请求的日志字段 allowlist 恰好为：

```text
- literal route template（不含实际 agentId 的 path shape）
- agentId（已被授权匹配后才可写）
- result: HTTP status + error code（如 409 HISTORY_CURSOR_STALE）
- limit 的数值
- before 是否存在（boolean；不是其值）
- duration ms、artifact byte count、projected message count（纯数字聚合）
- 请求 id / correlation id（调用方生成的不透明 id）
```

`surfaceId` 与任何 auth 输入的日志处理归 sibling auth Child `CTR-PA-011`；本 Spec 侧
MUST NOT 把 trusted authContext 字段值写入 History 日志（boolean/configGeneration digest
除外）。日志规则与 `CTR-SH-011` 的「超限 MUST NOT 把正文或路径写日志」及 `CTR-SH-008`
的 error-response 边界一致并叠加收紧。区分：**acceptance-evidence retention**（§10）允许
在隔离验收环境按需保留 hash/count/redacted excerpt，这是验收证据制度，不改变 runtime
日志 allowlist；production runtime 永不适用该豁免。

## 10. Acceptance

Every item below is a future Acceptance definition. Real transcript verification MUST run under the
same authorized Product Surface access boundary, retain only hashes/counts/redacted excerpts in PR
evidence, and MUST NOT commit raw transcript content.

```text
EXECUTED_NOW = NO
```

### ACC-SH-A — Real current-main transcript via Binding + literal main

- Contracts: `CTR-SH-001`, `CTR-SH-004`, `CTR-SH-005`, `CTR-SH-012`
- Method: from an authenticated Mobile surface, construct the request purely from
  `Binding agentId + literal main`（不发明任何 native ID）; run the pinned implementation against
  a read-only snapshot of the real current main trajectory
- Environment: isolated acceptance environment; exact implementation and DSH revisions recorded
- Required evidence: transient in-process exact-text comparison; persist only command/request,
  artifact hash before/after, public IDs/roles/times and redacted or hashed text assertions
- Expected result: direct user and completed-final assistant text are correct and ascending by
  seq; every `id` is `msg_sh1_…` and `sessionId` is exactly `main`; success envelope has only
  frozen fields and every time is canonical ISO-8601 UTC
- Failure condition: missing, extra, reordered, altered/non-final text, wrong envelope, raw/native
  ID exposure or time conversion error
- EXECUTED_NOW: NO

### ACC-SH-B — Real cross-Agent isolation

- Contracts: `CTR-SH-001`, `CTR-SH-007`
- Method: use distinct authenticated Mobile surfaces currently bound to two different agents to
  read each `main`, then issue Binding-mismatched, unknown Agent, missing artifact, header mismatch
  and cross-Agent requests
- Environment: isolated acceptance environment
- Required evidence: request/response records with sensitive content redacted, Home/file hashes
- Expected result: histories remain isolated; unknown Agent is `AGENT_NOT_FOUND`; missing or
  cross-Agent artifact is `SESSION_NOT_FOUND`; header/corruption mismatch is `INTERNAL_ERROR`
- Failure condition: any cross-Agent message or artifact is exposed
- EXECUTED_NOW: NO

### ACC-SH-C — No cold spawn or model call

- Contracts: `CTR-SH-003`, `CTR-SH-010`, `CTR-SH-011`
- Method: count Agent processes and instrument ensureRunning/spawn/model/session-prompt before,
  during and after GET on a cold Agent; fault-inject stable append, replacement, truncation, short
  read, malformed committed JSON, seq gap/duplicate, unsafe integer/`-0`/unrepresentable time,
  unknown header field, invalid origin, malformed ignored-event envelope, unsupported format/version
  and disable rollback
- Environment: canary-equivalent isolated environment, not live canary
- Required evidence: process table, call counters/traces, file hashes
- Expected result: process count/counters stay unchanged; any revision change retries once; a stable
  second attempt succeeds, while persistent instability/corruption returns `INTERNAL_ERROR`; disablement
  removes the route/service with no data write
- Failure condition: spawn/model/prompt/write/process increase, unbounded retry, corruption accepted,
  or rollback mutates Session data
- EXECUTED_NOW: NO

### ACC-SH-D — Internal-event and privacy exclusion

- Contracts: `CTR-SH-005`, `CTR-SH-008`, `CTR-SH-009`, `CTR-SH-010`
- Method: fixture containing tool/reasoning/chunk/plugin/goal/system/usage/internal-error/path/PID/
  header-cwd/channel-shaped data plus final text; static dependency/changed-surface check; default
  config and forced-enable startup with auth capability absent/not-ready; authorized, unauthorized
  and Agent-child HTTP probes against the accepted Product API auth implementation; authorized
  surface probes with absent Binding and injected Binding-read failure
- Environment: unit and HTTP integration tests
- Required evidence: fixture, response, logs and static changed-file manifest
- Expected result: route is absent by default; forced enable without accepted+implemented auth fails
  startup closed; only an authorized Product Surface caller receives allowlisted fields/text;
  unauthorized and Agent-child callers fail before lookup; absent Binding is `SESSION_NOT_FOUND`
  and Binding-read failure is `INTERNAL_ERROR`; no internal/channel data leaks; no Feishu/Router/
  Ingress/demo-server history parsing or mirror path exists
- Failure condition: route mounts by default/without auth, unauthorized lookup occurs, or any
  forbidden field/event/data/source inference appears
- EXECUTED_NOW: NO

### ACC-SH-E — Inbox deduplication

- Contracts: `CTR-SH-004`
- Method: fixture with one logical input represented by `agent/inbox/spliced` and qualifying
  `user/message`, ordered mixed empty/non-empty text blocks, empty-only message, replace surface,
  plugin/goal/system-reminder/internal user-shaped events and malformed qualifying event
- Environment: unit test
- Required evidence: fixture seqs and projected response
- Expected result: exactly one direct user message with ordered non-empty text and derived public
  ID; excluded/empty surfaces produce none; malformed qualifying input returns `INTERNAL_ERROR`
- Failure condition: duplicate/splice/reminder/internal message, wrong block order or silent malformed skip
- EXECUTED_NOW: NO

### ACC-SH-F — Last final assistant only

- Contracts: `CTR-SH-005`
- Method: completed, failed, blocked, max-tokens, interrupted, aborted and unterminated fixtures with
  chunks, tool-only/multiple assistant messages, mismatched turn IDs, assistant-after-end and duplicate
  terminal events, plus missing `data.turn`, non-integer `data.turn`, `-0`/zero/negative/unsafe
  (non-safe-integer) `data.turn` on `assistant/message` and `turn/end`
- Environment: unit test
- Required evidence: event fixtures and exact projection
- Expected result: each valid completed turn returns only its last non-empty text assistant message;
  failed/incomplete provisional text is absent; missing/non-integer/unsafe `data.turn` events are
  deterministically dropped (never projected, never fatal); malformed correlated payloads and
  duplicate/out-of-order terminal events return `INTERNAL_ERROR`
- Failure condition: duplicate chunks, earlier assistant candidate, tool-only/provisional text, or
  malformed/duplicate terminal accepted or silently skipped; missing/unsafe-turn events raising
  `INTERNAL_ERROR` or being projected
- EXECUTED_NOW: NO

### ACC-SH-G — Torn final record is observational

- Contracts: `CTR-SH-003`
- Method: append a torn final JSONL record to a copied fixture, hash before/after, issue GET
- Environment: read-only fixture test
- Required evidence: bytes/hash before and after, response and parser outcome
- Expected result: incomplete tail is ignored, no fabricated message, bytes unchanged
- Failure condition: error solely for the incomplete tail, projected partial data or any writeback
- EXECUTED_NOW: NO

### ACC-SH-H — Limit/before pagination with public IDs

- Contracts: `CTR-SH-002`, `CTR-SH-006`, `CTR-SH-012`
- Method: table tests for limits 1/50/200, invalid values, malformed/oversize cursor, newest page,
  all older pages, empty projection, before-first empty page, same-ms events, unknown/removed
  before, duplicate projected public IDs, unchanged-prefix paging and a later concurrent append
- Environment: unit plus HTTP integration tests
- Required evidence: full projected baseline, every page and error response
- Expected result: ascending stable order, exclusive cursor, exact hasMore, no duplicates/gaps;
  structurally malformed cursor is `400 VALIDATION_ERROR`; well-formed but absent-in-current-main
  cursor is `409 HISTORY_CURSOR_STALE`
- Failure condition: guessed/remapped cursor, repeated/skipped item, unstable same-ms order or
  wrong hasMore/status
- EXECUTED_NOW: NO

### ACC-SH-I — Repeated-read stable identity

- Contracts: `CTR-SH-006`, `CTR-SH-012`
- Method: repeat identical full/page reads against unchanged artifact hash
- Environment: integration test
- Required evidence: artifact hash and byte-for-byte normalized responses
- Expected result: every public `message.id` and `createdAt` remains stable
- Failure condition: regenerated IDs/times or order/page-boundary drift
- EXECUTED_NOW: NO

### ACC-SH-J — Traversal and cross-Agent fail closed

- Contracts: `CTR-SH-002`, `CTR-SH-007`
- Method: malicious agentId/selector, encoded traversal, `..`/slash/backslash/encoded-separator
  selector or query values, symlink escape, header mismatch, duplicate ID and cross-Agent artifact
  fixtures
- Environment: filesystem integration tests
- Required evidence: fixture topology, requests, error envelopes and no-path-leak log capture
- Expected result: malformed/traversal input is `400 VALIDATION_ERROR`; non-`main` selector is
  `400 VALIDATION_ERROR`; authorized matched Binding with missing definition is
  `404 AGENT_NOT_FOUND`; mismatched agent or missing artifact is `404 SESSION_NOT_FOUND`;
  header/location/symlink/duplicate corruption is `500 INTERNAL_ERROR`; every error has the exact
  safe envelope and no read occurs outside target Home
- Failure condition: arbitrary-file read, cross-Agent read, path disclosure or silent mismatch
- EXECUTED_NOW: NO

### ACC-SH-K — Logical-main identity across reset and switching

- Contracts: `CTR-SH-001`, `CTR-SH-002`
- Method: (1) fresh App start constructs the request with only Binding agentId + literal `main`;
  (2) switch active Agent and re-read（新 Agent 的 current main）; (3) switch back and re-read
  （原 Agent current main 重新解析）; (4) trigger/simulate main reset and re-read; (5) submit an
  old/forged native trajectory ID as selector and as `before`
- Environment: isolated acceptance environment with controlled Binding state
- Required evidence: request construction records（证明无 native ID 参与）、responses、Binding
  状态序列、generation digest 序列
- Expected result: (1)(2)(3)(4) 都以 `main` selector 成功且 `sessionId = main`；reset 后旧
  trajectory 内容不可见；(5) native ID 在 path 中即 `400 VALIDATION_ERROR`（selector 非
  `main`），在 `before` 中为 malformed 或 stale（400/409），无任何路径可表达旧 native
  trajectory
- Failure condition: Mobile 需要发明/保存 native ID 才能完成读取；旧 trajectory 经任何公共
  值可再次寻址；响应泄漏 native ID
- EXECUTED_NOW: NO

### ACC-SH-L — Resource ceiling boundaries

- Contracts: `CTR-SH-011`
- Method: 对八个上限逐一构造恰好等于边界与边界 +1 的 fixture（含单 record 超限、event count
  超限、单 message text 超限、total response text 超限、wall deadline 超限——deadline 用
  fault-injected monotonic clock），在允许时读取 metadata-only 计数核对
- Environment: unit/fixture tests with synthetic artifacts（不使用真实 Session 正文）
- Required evidence: fixture 尺寸参数、响应 envelope、进程计数、Session hash、Binding hash
- Expected result: 每个恰好等于边界的 fixture 成功；每个边界 +1（或超 deadline）返回
  `413 HISTORY_RESOURCE_LIMIT`；所有超限下进程数、Session hash、Binding 均不变；无部分历史
  返回；日志无正文/路径
- Failure condition: 任一上限未在指定检查点拦截、部分返回、或超限触发任何状态变化
- EXECUTED_NOW: NO

### ACC-SH-M — Session-root confinement fixtures

- Contracts: `CTR-SH-007`
- Method: 构造 fixtures：(a) Agent Home 内但在 configured Session root 外的普通文件；(b)
  Session root 中间 symlink 指向 Home 内其它目录；(c) 中间 symlink 指向 Home 外；(d) final
  symlink；(e) check/open 之间替换（TOCTOU 注入）；(f) cross-Agent Home；(g) `..`/slash/
  backslash/encoded separator 变体；(h) Session root 内的 cross-root hardlink
  （`st_nlink > 1`，指向 Home 外同一 filesystem 的文件）；(i) Session root 内 link-count=1
  但 device 与 Session root 不同的 planted artifact
- Environment: filesystem integration tests
- Required evidence: fixture 拓扑、请求与错误 envelope、读取字节计数
- Expected result: 所有变体 fail closed；读取字节数为 0；(a) 不因「仍在 Home 内」被读取；
  (b)(c)(d) 在任何组件级被拒；(e) `fstat` 身份不一致被拒；(f)(g) 被拒；(h) `st_nlink > 1`
  被拒（hardlink exclusion）；(i) device mismatch 被拒；错误不泄露路径
- Failure condition: 任何 fixture 有 ≥1 字节被读取或错误信息泄露路径；hardlink/cross-device
  artifact 被读取
- EXECUTED_NOW: NO

### ACC-SH-N — Public ID uniqueness, collision and stale cursors

- Contracts: `CTR-SH-002`, `CTR-SH-006`, `CTR-SH-012`
- Method: fixtures with (1) user 与 assistant raw DSH ID 相同；(2) 两个 Agent 的 raw DSH ID
  相同；(3) reset 前后 raw DSH ID 相同；(3a) reset 前后 native DSH session id 与
  `createdAt`（同毫秒）均相同、但 trajectory 内容不同——复现独立审计 blocker 场景，
  含首条 record 逐字节相同、后续 record 内容不同且 rawId 复用的盲区变体（PR #145
  re-audit blocker）；
  (4) malformed public ID；(5) reset 前签发的旧
  cursor；(6) 同 snapshot 重复读取；(7) cursor 值逆向检查（无 cwd/路径/native/raw ID 泄露）；
  (8) reset 前后首条 record 逐字节相同、后续内容不同（prefix-identical reset）；(9) 普通
  append：向不变 artifact 追加新 record 后重读
- Environment: unit/fixture tests
- Required evidence: fixture raw ID 布局、公共 ID 输出、generation digest 与
  messageRecordDigest 变化记录、响应
- Expected result: (1)(2)(3) 产生的公共 ID 互不相同；(3a) 内容不同的复用 rawId 消息得到
  不同公共 ID（messageRecordDigest 不同），reset 前 cursor 为
  `409 HISTORY_CURSOR_STALE`；若变体首条 record 亦相同则 generation digest 相同但
  messageRecordDigest 不同——任何场景下都不存在「同公共 ID 对应不同 record 内容」；
  (4) `400 VALIDATION_ERROR`；(5)
  `409 HISTORY_CURSOR_STALE`（即使新 trajectory 存在相同 raw ID）；(6) 公共 ID 逐字节稳定；
  (7) 公共 ID 不含任何内部值；(8) record 内容相同的复用 rawId 消息解析到逐字节相同
  内容；record 内容不同的复用 rawId 消息 ID 不同、旧 cursor
  `409 HISTORY_CURSOR_STALE`；(9) 追加后全部既有公共
  message ID 与旧 cursor 逐字节稳定（无 409、无 ID 漂移），新消息获得新 ID
- Failure condition: 任何跨 role/Agent/reset 碰撞、任何「同公共 ID 对应不同 record
  内容」的场景（含 3a 盲区变体）、(9) 场景下既有 ID 漂移或旧 cursor 变 stale、或内部值
  泄露
- EXECUTED_NOW: NO

### ACC-SH-O — Split activation: local Tailnet vs public

- Contracts: `CTR-SH-010`
- Method: (1) 在 sibling auth Child 的 local profile 各前提逐一满足/缺失时启动 History route；
  (2) 用 exact 合法 pair 走 Tailnet 请求；(3) 用同一 pair 经 public/non-Tailnet 入口请求；
  (4) 检查 History service 是否只接收 trusted authContext（无 tailscaled 调用、无 raw header
  读取、无 auth config 读取的静态/插桩验证）
- Environment: isolated runtime with controlled auth readiness
- Required evidence: 启动配置矩阵、请求/响应、插桩计数
- Expected result: local 前提全满足时 Tailnet 请求成功；(1) 任一前提缺失时 route disabled 或
  startup fail-closed；(3) public 入口不因 local pair 获得授权且 route 不暴露公网；(4)
  History service 输入只有 trusted authContext
- Failure condition: local activation 等待公网 OAuth、public 复用 local profile、或 History
  service 自行做 caller 验证
- EXECUTED_NOW: NO

### ACC-SH-P — Deterministic current-main resolver

- Contracts: `CTR-SH-013`, `CTR-SH-001`
- Method: fixtures with (1) 唯一正常 canonical candidate path；(2) candidate path 缺失
  （absent main）；(3) Session root 内额外的 header `id = main` artifact（locator 外）；
  (4) candidate path header mismatch；(5) reset 中间态（rename/two-phase write 注入，
  稳定后成功）；(6) 同请求内重复解析结果一致性
- Environment: filesystem fixture tests
- Required evidence: fixture 拓扑、解析结果、错误 envelope、无缓存证明（跨请求独立解析）
- Expected result: (1) 唯一解析；(2) `SESSION_NOT_FOUND`；(3) 额外 main artifact 不可达且
  不影响解析；(4) `INTERNAL_ERROR` 且不 fallback 到其它 main artifact；(5) 重试一次或
  fail-closed，reset 后旧 artifact 不可读；(6) 同一 snapshot 解析结果逐字节一致
- Failure condition: 任何启发式选择、fallback、跨请求缓存复用或 locator 外 main 可读
- EXECUTED_NOW: NO

### ACC-SH-Q — Runtime log privacy allowlist

- Contracts: `CTR-SH-014`, `CTR-SH-008`
- Method: 正常 success、每类 post-auth error（400/404/409/413/500）、resource-limit 超限与
  stale-cursor 请求下捕获 stdout/stderr/结构化日志；fixture 正文含 sentinel 字符串与
  public message ID，验证其不出现
- Environment: integration test with log capture
- Required evidence: 完整日志捕获与 allowlist 字段比对、sentinel 扫描结果
- Expected result: 日志只含 allowlist 字段；无 transcript sentinel、无 public ID、无路径、
  无 native/raw ID、无 trusted authContext 字段值
- Failure condition: 任何 sentinel/ID/路径出现在 runtime 日志
- EXECUTED_NOW: NO

### 10.1 Bidirectional coverage

| Contract | Acceptance coverage |
|---|---|
| `CTR-SH-001` | A, B, K, P |
| `CTR-SH-002` | H, J, K, N |
| `CTR-SH-003` | C, G |
| `CTR-SH-004` | A, E |
| `CTR-SH-005` | A, D, F |
| `CTR-SH-006` | H, I, N |
| `CTR-SH-007` | B, J, M |
| `CTR-SH-008` | D, Q |
| `CTR-SH-009` | D |
| `CTR-SH-010` | C, D, O |
| `CTR-SH-011` | C, L |
| `CTR-SH-012` | A, H, I, N |
| `CTR-SH-013` | P |
| `CTR-SH-014` | Q |

Every Acceptance reference resolves to an active Contract, and every active Contract has at least
one Acceptance item.

## 11. Alternatives and disposition

| Alternative | Disposition | Reason |
|---|---|---|
| Product API parses JSONL | REJECTED | violates thin-adapter boundary |
| Mobile or Feishu parses Session files | REJECTED | duplicates backend policy and crosses ownership |
| Router starts/resumes Agent to read history | REJECTED | violates cold-read and process lifecycle boundary |
| Memory becomes history store | REJECTED | curated memory is not Session history |
| New history database/cache | REJECTED | creates second authority and migration burden |
| Full Session management package | REJECTED | exceeds this minimal read-only projection |
| Public path carries native trajectory ID | REJECTED | Mobile 被迫发明/持有身份；与 accepted V3（D-008 §8）logical-slot 模型冲突 |
| Server returns native ID for later requests | REJECTED | 把实现细节提升为公共契约；reset 后即失效 |
| logical→native persistent mapping store | REJECTED | `SESSION_MAPPING = FORBIDDEN`；第二 truth |
| Raw DSH message ID as public ID | REJECTED | 跨 role/Agent/reset 无全局唯一性证明；违反继承的全局唯一契约 |
| Random public ID + sidecar store | REJECTED | 第二 history store；违反 `SECOND_HISTORY_STORE = FORBIDDEN` |
| 「合理」/implementation-defined 资源上限 | REJECTED | 非确定性上限等于无上限 |
| 一体 activation gate 等待公网 auth | REJECTED | 过度阻塞 Tailnet-first 当前目标 |
| Tailnet membership 即授权 | REJECTED | membership 不是 caller identity；归 auth Child 拒绝 |
| Infer channel from text/Binding | DEFERRED TO FUTURE AMENDMENT | source metadata is partial |
| Feishu mirror or dual-write | REJECTED | out of scope and creates split truth |

Investigation disposition: `NEW`; this proposed Spec is ready for independent semantic review but
is not accepted implementation authority.

## 12. Migration, compatibility, and rollback

- Migration: none. Existing DSH Session artifacts remain byte-unchanged.
- Compatibility: additive GET only; existing Product API endpoints and Binding semantics remain
  unchanged. No channel metadata is promised. 公共 Message ID 与 stale-cursor 语义是本 Spec 新
  增接口语义，无旧客户端兼容负担（endpoint 从未部署）。
- Rollout: implementation, deployment and canary require later separately authorized rounds;
  activation 拆分见 `CTR-SH-010`。
- Rollback: disable/remove the additive GET adapter and read-only service. No data rollback exists.
- Unknown outcome: a failed read has no persistence side effect; caller may retry. A retry MUST use a
  fresh stable artifact snapshot and MUST preserve public IDs for the unchanged prefix.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
SOURCE_CHANNEL_METADATA remains future amendment
```

Non-normative implementation debt: the future implementation preflight must pin the exact deployed
DSH package/format revision and choose its public read-only decoder seam; the sibling auth Child's
implementation preflight must pin the exact Tailscale client/LocalAPI revision. Neither choice may
change any Contract above.

### 13.1 FOLLOW_UP_DEBT（本轮按 reclassification policy 移出 normative blocker 范围）

以下项目按审计 reclassification policy 判定为 codec aesthetics / future reset generalization /
generic hardening / extra telemetry，不消耗本轮 normative blocker effort，仅记录债务：

- `FOLLOW_UP_SH-001` — 未来 main reset 机制被独立 authority 定义后（D-008 §29），revisit
  `CTR-SH-013` 是否需要显式 reset-aware 分支（当前行为：locator 重解析已覆盖，无需扩展）。
- `FOLLOW_UP_SH-002` — 跨 generation 256-bit 哈希碰撞的运行时检测/存储防护：概率学上
  不可检测对象，当前 fail-safe 行为（`409 HISTORY_CURSOR_STALE`）已安全；仅当未来出现
  NEW_EVIDENCE 才重开。
- `FOLLOW_UP_SH-003` — public message ID codec 的 golden vectors：语法已精确冻结，
  vectors 作为 acceptance 便利物料在实现轮补充，非 normative。
- `FOLLOW_UP_SH-004` — history 访问 metrics/telemetry（延迟分位、错误率聚合）超出
  `CTR-SH-014` allowlist，属独立 authority 轮。
- `FOLLOW_UP_SH-005` — 通用文件系统加固（inotify/fsevents watching、fingerprinting）超出
  cooperative shared-host threat model 的范围，不做 normative。

## 14. Authoring summary

```text
SPEC_ID = MOBILE_SESSION_HISTORY_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 14
CONTRACTS_WITH_ACCEPTANCE = 14
ACCEPTANCE_COUNT = 17
BIDIRECTIONAL_COVERAGE = 14/14 Contracts; 17/17 Acceptance references valid
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
MOBILE_CHANGE = NONE
CANARY_CHANGE = NONE
DEPLOYMENT_CHANGE = NONE
MERGE_PERFORMED = NO
```
