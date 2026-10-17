---
spec_id: MOBILE_SESSION_HISTORY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mobile-session-history-read-projection
  - product-api-history-get
  - mobile-session-history-tailnet-admission
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_WORKSPACE_SESSION_MODEL_V2
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
BASE = 9386ac4e4515ea628e2a450f402b540f165c13c3
LIVE_CANARY_BACKEND = 622cb7b6bae7b0b5a9a8713bb5a843ad6a7dc5f1
MOBILE_CONSUMER_BASE = 3704bc289a63f66961cc31849459019715d358c1
SPEC_STATUS = proposed
AMENDMENT_ID = MOBILE_SESSION_HISTORY_V1_AFTER_INDEPENDENT_REVIEW_V2
AMENDMENT_BASE = 91a0513f2b90ca924b7a46f455916fe4d5eae550
INDEPENDENT_REVIEW_COMMENT_ID = 5472147045
CURRENT_MAIN_AT_AMENDMENT = 1aa8248893766aaf1caae17b2905e40061f0a147
CURRENT_MAIN_HISTORY_RELEVANT_DRIFT = NO
IMPLEMENTATION_ALLOWED_NOW = NO
EXECUTED_NOW = NO
```

## 1. Goal

为 Mobile 当前 Binding 的 `activeAgent` 提供其 current canonical logical `main` 的只读
聊天历史。公开 path `sessionId` 是逻辑槽位选择器，V1 只允许 literal `main`；native DSH
trajectory identity 只由后端 trusted current-main resolver 获得，绝不进入 Mobile 请求、响应、
Binding、缓存或公共 cursor。
本 Spec 只冻结后端读取、投影、分页、错误和隐私边界；它不实现代码、不部署、不修改
canary，也不授权在本 proposed revision 上实施。

```text
HISTORY_AUTHORITY = DSH_SESSION
HISTORY_REQUEST_SESSION_ID = LOGICAL_MAIN
NATIVE_TRAJECTORY_ID = SERVER_INTERNAL_ONLY
SECOND_HISTORY_STORE = FORBIDDEN
SESSION_MAPPING = FORBIDDEN
BACKEND_HISTORY_OWNER = @agent-core/session-history (minimal read-only service/module)
PRODUCT_API_ROLE = THIN_ADAPTER
COLD_READ_WITHOUT_AGENT_SPAWN = YES
CURRENT_NETWORK_MODE = TAILSCALE
TAILSCALE_HISTORY_ACTIVATION = ALLOWED_WHEN_LOCAL_IDENTITY_READY
PUBLIC_HISTORY_ACTIVATION = FORBIDDEN_UNTIL_AUTH_READY
```

## 2. Scope and non-goals

### 2.1 In scope

- 一个精确只读 HTTP endpoint：
  `GET /v1/agents/{agentId}/sessions/main/messages?surfaceId=<surfaceId>&limit=50&before=<publicMessageId>`；
- 从目标 Agent Home 内的 DSH native Session artifact 读取有效完整前缀；
- 将允许的最终 user / assistant 文本投影成稳定消息；
- 以 DSH event `seq` 为唯一顺序权威，提供排他 `before` 分页；
- fail-closed 的 Agent、Session、归属、header 与路径校验；
- 由极小只读 `@agent-core/session-history` service/module 拥有原始 DSH JSONL 读取与投影；
- Product API 仅校验 HTTP 输入、调用该 service、映射 HTTP envelope。

### 2.2 Out of scope

- 第二个聊天数据库、message store、Session registry 或 Session mapping；
- Session create/resume/write/repair/compact/archive/delete；
- Agent 启动、模型调用、prompt、synthetic closer 或 torn record 修补；
- Binding、Agent Home、Workspace、Session artifact 或 canary 修改；
- Mobile repository 修改；
- Feishu connector、Router/Ingress/demo-server 修改；
- Mobile↔Feishu mirror、双写、回流或以 Feishu 作为历史库；
- `mobile`、`feishu`、`senderDisplayName`、`channelConversationId` 等来源字段；
- 通过文本、`@` 占位符或 Binding 猜测 channel；
- 公网 OAuth/Gateway/Product API auth 协议设计或部署；public activation 仍由 `CTR-SH-013`
  禁止，local Tailnet history 仅使用本 Spec 冻结的 endpoint-local device+surface admission；
- 完整 Session 管理组件。

## 3. Authority and dependencies

1. `AGENT_CORE_PRODUCT_ARCHITECTURE_V1` 冻结 DSH 为 Session runtime、product sessionId 与
   DSH native sessionId 相同、Agent Core 不建第二套 Session engine/mapping/history。
2. accepted Current Decision `AGENT_WORKSPACE_SESSION_MODEL_V2` 冻结 Session 是属于 Agent
   的 trajectory，Mobile Human Binding 只持有 `activeAgent` 并始终进入 canonical logical
   `main`；native DSH Session ID 是实现细节。故公开 selector 固定为 logical `main`，后端每次
   请求都从权威 Binding + accepted current-main resolver 解析 current native trajectory。
3. D-006 §25 把 native-ID mechanism 留给 Implementation Spec；本 Spec 不新建持久 mapping，
   只要求实现复用 implementation base 中 accepted current-main authority/resolver。若该
   resolver 或可区分 reset generation 的稳定 header identity 不存在，implementation MUST
   STOP；不得退化成 Mobile 传 native ID、literal-native shortcut 或 sidecar mapping。
4. accepted Program `AGENT_CORE_HARDENING_PROGRAM_V1` 将 Product API 定义为 Product Surface
   Control Plane，并要求 loopback 外具备 trusted caller identity、拒绝 Agent child。V2
   amendment 仅为 history route 冻结 exact Tailscale Node ID + exact Mobile surface Binding 的
   local identity boundary；Tailnet membership 本身绝非授权，也不扩张其它 Product API。
   `DEC-SH-009`/`CTR-SH-013` 是该 route 的独立、bounded、equivalent-authentication child，完整
   覆盖 Program §6.1 的 caller identity、等价机制、allowlist、403、Agent-child denial、raw
   credential confinement、rollback 与 rotation；保留 generic/public
   `PRODUCT_API_AUTHENTICATION_V1` 的 ID 与 authority，不做 partial supersession。
5. `mayf3/agent-core-mobile@3704bc289a63f66961cc31849459019715d358c1` 是 consumer
   协调坐标，不是本仓库的外部 governing authority。
6. DSH JSONL 格式及 event schema 是运行时依赖，不由本仓库重新治理。本 Spec 通过
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
`sessionHistory.listMessages({ authContext, agentId, sessionId, limit, before })` 的只读 service seam，
并转换 HTTP request/response/error envelope；Mobile 与 Feishu connector 不得直接解析
Session 文件。

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
  未读生产 Session、未执行 runtime history probe、未改变 canary。
  Basis: `OBS-SH-004`。
- `STATE-SH-004` — base 中没有名为 `@agent-core/session-history` 的 package/service，且
  Product API 当前没有该 endpoint；因此本工作是新 authority，不是已有 accepted
  implementation contract 的复用。
  Basis: `OBS-SH-001`, `OBS-SH-005`, `CLM-SH-001`, `EVD-SH-003`。
- `STATE-SH-005` — independent review at head
  `91a0513f2b90ca924b7a46f455916fe4d5eae550` is `REQUEST_CHANGES`; current main
  `1aa8248893766aaf1caae17b2905e40061f0a147` has no history-relevant drift; metadata-only largest
  observed stock/ceo main artifact is `2107863` bytes.
  Basis: `OBS-SH-006`, `OBS-SH-007`, `OBS-SH-008`, `EVD-SH-004`, `EVD-SH-005`。

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
  agentsHome / `$DSH_AGENTS_HOME` / default root; separators, dots, spaces and traversal forms
  are rejected.
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

### OBS-SH-006 — stock/main and ceo/main size metadata only

- Subject: current production stock/main and ceo/main Session artifacts
- Environment: local production filesystem metadata only; no file content read or output
- Observed at: `2026-08-31T01:30:14Z`
- Method: resolve already-known exact artifact coordinates, then `stat` size/mtime/inode only
- Result: stock/main = `174282` bytes; ceo/main = `2107863` bytes; a legacy stock-main coordinate =
  `292331` bytes. Largest observed artifact = `2107863` bytes; no message body, record or header was read.
- Provenance: local filesystem metadata observation retained only as aggregate sizes in this Spec

### OBS-SH-007 — Amendment PR and independent review coordinates

- Subject: Draft PR #124 and independent review comment `5472147045`
- Repository/revision: `mayf3/dsh-agent-core@91a0513f2b90ca924b7a46f455916fe4d5eae550`
- Observed at: `2026-08-31T00:13:12Z`
- Method: GitHub PR/comment metadata read
- Result: PR OPEN/DRAFT/UNMERGED at exact expected head; audit result `REQUEST_CHANGES` with five
  blockers: logical-main identity, resource ceilings, exact Session-root confinement, public message
  identity/cursor safety, and Tailnet-first activation.
- Provenance: `https://github.com/mayf3/dsh-agent-core/pull/124#issuecomment-5472147045`

### OBS-SH-008 — Current main drift is history-irrelevant

- Subject: authority branch drift after independent review
- Repository/revision: `mayf3/dsh-agent-core@1aa8248893766aaf1caae17b2905e40061f0a147`
- Observed at: `2026-08-31T01:30:14Z`
- Method: fetch `origin/main`; inspect commits since the review coordinate recorded in comment
  `5472147045`
- Result: current main equals the review’s recorded current main. The intervening PRs concern
  fleet-shared Codex auth and workflow transition, not history paths, Session persistence,
  workspace-bootstrap ownership or this Spec’s authority graph.
- Provenance: local Git objects and independent review comment

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

### CLM-SH-004 — Frozen byte ceilings preserve at least tenfold observed headroom

- Support state: SUPPORTED
- Supported by evidence: `EVD-SH-004`
- Contradicted by evidence: none known
- Uncertainty: future growth beyond the frozen ceiling requires a new reviewed Spec revision, not a
  silent implementation increase

### CLM-SH-005 — Tailnet membership alone cannot authorize private history

- Support state: SUPPORTED
- Supported by evidence: `EVD-SH-005`
- Contradicted by evidence: none known
- Uncertainty: local Tailscale identity lookup availability/config readiness remains future
  implementation conformance, not current runtime state

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

### EVD-SH-004 — Metadata sizes support deterministic resource headroom

- Source observations: `OBS-SH-006`
- Target: `CLM-SH-004`
- Relation: SUPPORTS
- Bound coordinates: metadata-only observation at `2026-08-31T01:30:14Z`
- Strength/sufficiency: 64 MiB artifact, 48 MiB record/total-text and 32 MiB per-message-text
  ceilings provide 31.84×, 23.88× and 15.92× headroom over the largest observed whole artifact
- Limitations: no production content, record count or block count was read; event/block/text ceilings
  are conservative deterministic owner choices validated later with synthetic fixtures
- Provenance: `OBS-SH-006`

### EVD-SH-005 — Review and Hardening boundary support exact Tailnet identity

- Source observations: `OBS-SH-007`, `OBS-SH-008`
- Target: `CLM-SH-005`
- Relation: SUPPORTS
- Bound coordinates: PR #124 review at head
  `91a0513f2b90ca924b7a46f455916fe4d5eae550`; current main
  `1aa8248893766aaf1caae17b2905e40061f0a147`
- Strength/sufficiency: sufficient to reject membership-only authorization and split local/public
  activation profiles without changing the accepted trusted-caller requirement
- Limitations: does not prove any current node allowlist, surface config or lookup service is ready
- Provenance: independent review comment `5472147045` and `AGENT_CORE_HARDENING_PROGRAM_V1`

## 8. Decisions

### DEC-SH-001 — DSH Session remains the sole history authority

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: public `sessionId` is the logical slot literal `main`. The backend resolves the authorized
  surface Binding to `activeAgent`, then uses the accepted server-side current-main resolver to obtain
  the current native trajectory and generation identity on every request. Mobile never receives,
  constructs, caches or selects native identity. History owns neither Session nor storage.
- Rejected alternative: second database, message store or Session mapping.
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
  completed turn, with stable IDs/times and event-seq ordering.
- Rejected alternative: raw events, chunks, reasoning, tools or provisional replies.
- Reason: prevent duplicates and internal-data leakage.
- Remaining owner input: none

### DEC-SH-005 — Channel metadata remains a future amendment

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: V1 returns no source-channel metadata and performs no inference or Feishu mirror.
- Rejected alternative: infer channel from text, placeholders or Binding, or modify ingress now.
- Reason: persisted `source.channel` is partial and requires an independent authority change.
- Remaining owner input: none

### DEC-SH-006 — Deterministic resource ceilings

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: freeze the exact ceilings in `CTR-SH-011`; every breach is HTTP 413
  `HISTORY_RESOURCE_LIMIT`, with no partial response or Session read/write escalation.
- Rejected alternative: retry-only bounds, implementation-selected limits or unbounded full-log parse.
- Reason: largest metadata-observed artifact is 2107863 bytes; selected byte ceilings give at least
  15.92× headroom while bounding allocation and decode work.
- Remaining owner input: none

### DEC-SH-007 — Exact Session-root confinement

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: canonical Agent Home, configured Session root and target artifact are distinct checked
  authorities; target open is component-safe and confined to the exact Session root before byte 1.
- Rejected alternative: treating any path inside Agent Home as an allowed Session artifact.
- Reason: Home containment alone admits unrelated or aliased files.
- Remaining owner input: none

### DEC-SH-008 — Composite public message identity

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: public IDs use deterministic `msg_sh1_` SHA-256 digests of a canonical length-prefixed
  tuple across Agent, current-main generation, role and raw DSH message ID; trajectory and raw message
  identities are represented only by one-way digests.
- Rejected alternative: expose raw DSH IDs without a pinned global uniqueness guarantee.
- Reason: prevent cross-role, cross-Agent and post-reset collisions without store or mapping.
- Remaining owner input: none

### DEC-SH-009 — Tailnet-local and public activation are separate

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: for this history GET only, this Implementation Spec is the bounded independent child
  authority satisfying `AGENT_CORE_HARDENING_PROGRAM_V1` §6.1’s minimum authentication obligations
  through an equivalent local mechanism: exact configured phone Node ID + exact configured surface +
  authoritative Binding. Arbitrary Tailnet membership, loopback, host and Agent children are denied.
  It neither claims/supersedes the reserved generic `PRODUCT_API_AUTHENTICATION_V1` ID nor authorizes
  any other/public route; public/non-Tailnet activation remains blocked on that later authority.
- Rejected alternative: membership-only authorization or forcing current private use to wait for
  public OAuth/Gateway.
- Reason: preserve trusted caller identity while enabling the current private daily-use target.
- Remaining owner input: none

## 9. Contracts

### CTR-SH-001 — Sole authority and backend ownership

The implementation MUST treat the server-resolved current DSH native Session artifact as the sole
history authority. After `CTR-SH-013` admission, Product API MUST pass the trusted Mobile
`surfaceId`, path `agentId`, logical selector `main`, limit and cursor unchanged to the history service.
The history service MUST read that surface’s current authoritative Binding through the Router read
service. Absent Binding is generic `HISTORY_ACCESS_DENIED` without Agent/Session lookup; Binding-read failure is
`INTERNAL_ERROR`. Path `agentId` MUST equal `Binding.activeAgentId`, otherwise generic
`403 HISTORY_ACCESS_DENIED` before artifact lookup.

The service MUST then invoke the accepted server-side current-main resolver for that Agent on every
request and receive `{ nativeSessionId, generationHeaderTuple, artifactLocation }`; the tuple is
exactly the ordered header-field input `G` in `CTR-SH-012`, not a second identity. Mobile MUST
NOT send or receive any field in that result. Reset immediately invalidates the old trajectory and
its cursors; switch-away/switch-back always repeats Binding and current-main resolution. Forged,
expired or old native IDs cannot be expressed by the public API. If the resolver or a reset-distinct
stable generation header identity is unavailable, the request fails `INTERNAL_ERROR` and
implementation activation MUST STOP. No database, message store, logical-main→native mapping,
sidecar or cached alternate truth is permitted.

`@agent-core/session-history` names one minimal read-only service contract; its implementation MAY be
an internal module or a tiny package, but MUST NOT be an independent Session engine/manager.
It MUST be the only backend owner that reads raw DSH Session records and applies this projection.
Product API, Mobile and connectors MUST NOT parse Session artifacts. The service MUST NOT expose a
Session-management write surface.

### CTR-SH-002 — Exact HTTP contract and validation

Product API MUST expose exactly:

```http
GET /v1/agents/{agentId}/sessions/main/messages?surfaceId=<surfaceId>&limit=50&before=<publicMessageId>
```

`agentId` MUST be one non-empty safe component of at most 200 characters under the existing
workspace-bootstrap validator. The path slot MUST equal literal `main`; any other `sessionId` is
`400 VALIDATION_ERROR`. `surfaceId` is required, non-empty, opaque UTF-8 of at most 256 bytes, and
MUST be used only by `CTR-SH-013` admission/Binding lookup. `limit` defaults to `50`, accepts decimal
integers `1..200`, and all other values are `400 VALIDATION_ERROR`. `before` is optional and exclusive.
Success MUST be:

```json
{
  "messages": [
    {
      "id": "string",
      "agentId": "string",
      "sessionId": "string",
      "role": "user | assistant",
      "content": "string",
      "createdAt": "ISO-8601 UTC"
    }
  ],
  "hasMore": true
}
```

Product API MUST only validate/decode HTTP input, execute the selected `CTR-SH-013` admission
profile, pass its trusted admission context to `sessionHistory.listMessages`, and map the service
result/error to the envelope. It MUST NOT resolve current main or inspect artifacts. After admission
succeeds, the history handler’s exact envelopes are closed; no extra fields are allowed. Errors are:

```text
400 VALIDATION_ERROR
403 HISTORY_ACCESS_DENIED
404 AGENT_NOT_FOUND
404 SESSION_NOT_FOUND
409 STALE_HISTORY_CURSOR
413 HISTORY_RESOURCE_LIMIT
500 INTERNAL_ERROR
```

Every history/admission HTTP error MUST use exactly
`{"error":{"code":"<CODE>","message":"<safe non-empty message>"}}`; no path, cause, stack,
Node ID, surface ID, native trajectory/message ID or extra field is permitted. Local Tailnet admission
uses only generic `403 HISTORY_ACCESS_DENIED`; public auth may return its accepted 401/403 envelope
before Binding, Agent or Session lookup.

`before` MUST be one opaque `msg_sh1_` ID of exactly 95 ASCII bytes. Invalid URL/base64url/tuple
encoding, any path selector other than `main`, missing/invalid `surfaceId`, empty/overlong values,
invalid `limit`, slash/backslash/dot segment or unknown current-generation raw message are
`400 VALIDATION_ERROR`. A well-formed cursor whose generation digest differs from current main
is `409 STALE_HISTORY_CURSOR`; it MUST NOT be guessed or remapped. Admission mismatch/failure is
`403 HISTORY_ACCESS_DENIED` before Binding lookup. After admission, missing Agent Definition is
`404 AGENT_NOT_FOUND`; absent Binding or path-agent mismatch is generic `403 HISTORY_ACCESS_DENIED`;
absent current-main artifact is `404 SESSION_NOT_FOUND`. Any ceiling breach is `413 HISTORY_RESOURCE_LIMIT`. Binding/resolver
operational failure, header/root/location mismatch, symlink/alias escape, duplicate composite ID,
committed corruption, unsupported format and stable-read exhaustion are `500 INTERNAL_ERROR`.

### CTR-SH-003 — Cold-read valid complete prefix

A history GET MUST NOT call `agentRouter.ensureRunning`, `AgentProcess.spawn`, any model,
`session/prompt`, or any other admission/write path. It MUST NOT change Binding, Agent Home,
Workspace or Session; MUST NOT write a synthetic closer; MUST NOT repair or truncate a torn record;
and MUST NOT start a cold Agent.

The service MUST use at most two bounded snapshot attempts. Each attempt begins with one authoritative
current-main resolve `R0={agentId,nativeSessionId,generationHeaderTuple,artifactLocation}` and computes
`G0` exactly by `CTR-SH-012`; this is the sole meaning of the resolver’s generation identity. It then
stats the canonical pathname and captures pre-open revision
`P=(device,inode,size,mtimeNs,ctimeNs)`, opens that exact artifact read-only with no symlink following,
and captures descriptor revision `D0`. `P` MUST equal `D0` before reading. It reads exactly `D0.size`,
re-stats descriptor as `D1` and pathname as `P1`, validates the decoded header equals R0’s exact
`generationHeaderTuple`, then performs an authoritative atomic
`validateCurrentMain(agentId,nativeSessionId,G0)` as the final operation before committing response
bytes. That validation is the GET linearization point: a reset that completes first must invalidate
G0; a reset that begins later is ordered after this GET. An accepted current-main resolver MUST expose
this atomic generation-token validation/lease seam; absence stops implementation.

Success requires full-length read, target still inside the exact configured Session root,
`P = D0 = D1 = P1` across all five revision fields, matching header tuple and successful final current-
main validation. Append, replacement, truncation, truncate-regrow, short read, path/revision/header/
current-generation change discards the complete attempt and retries once from a new R0; a second
failure is `INTERNAL_ERROR`. No discarded projection or cursor may reach the client. The promise
excludes a privileged writer able to forge inode timestamps; normal append/rename/truncate/reset
concurrency is covered. No attempt waits for an Agent or writer.

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
`INTERNAL_ERROR`. Implementation MUST pin the exact deployed DSH revision and prove its public row
decoder satisfies this allowlist. It MUST use that public decoder plus local validation/projection;
an unavailable/incompatible public decoder stops implementation and activation. An ad-hoc replacement
parser or silent allowlist widening is forbidden. The service MUST NOT fabricate messages or write
repair bytes.

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
- retain `user/message.data.id` only as internal `rawDshMessageId`, then derive public `message.id`
  exactly through `CTR-SH-012`;
- use `user/message.time`, converted to ISO-8601 UTC, as `createdAt`;
- use the requested `agentId` and `sessionId` and role `user`.

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
concatenate non-empty text items in order, retain `data.message.id` only as internal
`rawDshMessageId`, derive public `message.id` through `CTR-SH-012`, and convert that
`assistant/message.time` to ISO-8601 UTC as `createdAt`.

It MUST exclude `assistant/chunk`, `text-chunks`, `reasoning-chunks`, tool-call, tool-result, usage,
tool-only `assistant/message`, and provisional text from incomplete, failed, blocked, interrupted,
aborted or otherwise non-completed turns. It MUST NOT concatenate chunk/block-end events with the
selected final `assistant/message`, and MUST return at most one assistant message per completed turn.
A malformed `assistant/message` or `turn/end` carrying a relevant `data.turn` MUST return
`INTERNAL_ERROR`, not be silently skipped.

### CTR-SH-006 — Seq ordering, pagination and stable identity

The service MUST order the full projected sequence by DSH event `seq`, not timestamps. Equal
millisecond timestamps MUST not affect ordering.

- Without `before`, return the final `limit` projected messages.
- With `before`, locate that exact projected `message.id` and return at most `limit` projected
  messages immediately before it.
- Each response’s `messages` MUST be ascending by authoritative `seq`.
- `hasMore` MUST be true exactly when at least one earlier projected message exists before the
  returned page. An empty projection returns `messages=[]`, `hasMore=false`; a valid `before` naming
  the first projected message also returns `messages=[]`, `hasMore=false`.

For an unchanged valid current-main generation and artifact prefix, repeated reads MUST preserve
every composite public `message.id`, `createdAt`, order and page boundary. Adjacent pages MUST have
no duplicate or skipped projected message. Reset/generation replacement immediately makes every old
cursor `409 STALE_HISTORY_CURSOR`; coincidental raw-ID reuse MUST NOT match. A well-formed current-
generation cursor whose raw ID is absent is `400 VALIDATION_ERROR`. Duplicate composite public IDs
within one generation are `INTERNAL_ERROR`.

### CTR-SH-007 — Agent/Session identity and exact-root confinement

Before reading artifact byte 1, the service MUST:

1. consume only trusted admission context from `CTR-SH-013`; resolve the supplied exact `surfaceId`’s
   current Binding; map absent Binding/path-agent mismatch to generic `HISTORY_ACCESS_DENIED` and
   operational failure to `INTERNAL_ERROR`, without artifact lookup;
2. confirm matched Agent Definition; resolve `AGENT_HOME` only through workspace-bootstrap authority;
3. call the accepted current-main resolver and obtain the current native header identity and configured
   `SESSION_ROOT`; no caller value may influence either path;
4. reject request agent/session/surface input containing slash, backslash, dot segment, NUL, alias or
   traversal syntax; public session selector must be logical literal `main`;
5. canonicalize `AGENT_HOME`, `SESSION_ROOT` and `TARGET_ARTIFACT` independently; require canonical
   Session root to be a strict descendant of canonical Agent Home and target to be a strict descendant
   of that exact canonical Session root—not merely somewhere inside Agent Home;
6. reject every symlink, mount/alias escape or non-directory intermediate component. Walk from trusted
   handles component-by-component with no-follow semantics, then open the final regular file read-only
   with no-follow and compare opened-handle identity to the pre-open target. If the runtime cannot
   provide a race-safe equivalent to directory-handle/openat-style traversal, implementation MUST STOP;
7. after steps 1–6 safely open the exact regular file, read only the bounded first header record;
   reject header ID/generation/format/origin mismatch before any event/body record. Header native ID
   stays server-internal and must match the resolver result, not public logical `main`.

Every path/root/component/open-identity rejection in steps 1–6 occurs with artifact `bytesRead = 0`.
Header rejection in step 7 necessarily reads only the bounded header record and zero event/body bytes.
Both expose no path and map to `CTR-SH-002`. A file inside Agent Home but outside exact configured
Session root is forbidden. No fallback scan outside that root is allowed.

### CTR-SH-008 — Privacy allowlist

The HTTP response MUST contain only user final text, assistant final completed text, stable message
ID, timestamp, `agentId` and `sessionId`, plus top-level `hasMore`. It MUST NOT project or return
reasoning, system prompts/reminders, tool parameters, tool results, usage, credentials, provider
internal errors, workspace paths, Agent Home/Session-root paths, raw DSH events, raw DSH message or
native trajectory IDs, Tailscale Node IDs, configured `surfaceId`, internal PIDs or Session header
`cwd`. Here “credentials / paths / provider errors” means separate internal event/header/error
fields; `content` is the byte-preserved selected user data governed by `CTR-SH-004/005`. V1 is not a
semantic DLP/redaction system and MUST NOT inspect prose to guess whether it resembles a secret or
path. Error responses and logs MUST obey the same no-path/no-internal-payload boundary.

### CTR-SH-009 — Channel metadata omission

`SOURCE_CHANNEL_METADATA = PARTIAL`. V1 MUST NOT return `mobile`, `feishu`,
`senderDisplayName`, `channelConversationId` or inferred source metadata. It MUST NOT infer source
from message text, `@` placeholders or Binding. Persisting and exposing `source.channel` remains a
future independent amendment and MUST NOT be added as incidental implementation scope.

### CTR-SH-010 — Feishu, lifecycle and rollout boundary

`FEISHU_MIRROR = OUT_OF_SCOPE`. Implementation MUST NOT copy Mobile messages to Feishu, use
Feishu as history storage, introduce dual-write/feedback loops, or modify Feishu connector for
history. Multiple Channels may naturally observe one shared DSH Session trajectory when they
actually reference the same `(agentId, sessionId)`; this MUST NOT be represented as a guarantee
that their Bindings are equal.

History activation is governed only by the two explicit profiles in `CTR-SH-013`. The route remains
default-disabled; Tailnet-local conditional activation does not authorize Feishu, other Product API
routes, loopback, host processes or public exposure. Agent/Session lookup and distinct 404s occur only
after the selected profile admits the caller.

The implementation MUST NOT modify Router/Ingress/demo-server behavior, Mobile repository, Agent
Home, existing Session files or canary as part of implementing this Contract. Deployment, canary
apply and merge remain separately authorized actions. Rollback is disablement/removal of the new
GET adapter and read-only service; because there is no owned persistence, no data migration or
rollback write is allowed.

### CTR-SH-011 — Deterministic resource ceilings

The following decimal byte/count limits are immutable V1 Contract values:

```text
MAX_ARTIFACT_BYTES = 67108864                 # 64 MiB; 31.84× largest metadata-observed artifact
MAX_RECORD_BYTES = 50331648                   # 48 MiB; excluding terminating newline
MAX_EXPANDED_EVENT_COUNT = 1000000
MAX_CONTENT_BLOCKS_PER_MESSAGE = 2000000
MAX_PROJECTED_TEXT_BYTES_PER_MESSAGE = 33554432
MAX_TOTAL_PROJECTED_TEXT_BYTES = 50331648
MAX_RAW_DSH_MESSAGE_ID_BYTES = 512
MAX_RESPONSE_MESSAGE_COUNT = 200
MAX_DECODE_CPU_OR_WALL_DEADLINE = 10000ms     # monotonic wall deadline for the whole read/decode/project
```

Metadata-only basis: largest observed production artifact is 2107863 bytes. Thus artifact, record,
per-message text and total-text ceilings provide respectively 31.84×, 23.88×, 15.92× and 23.88×
headroom over that whole artifact and necessarily at least that headroom over each contained byte
value. No production content was read. Packed rows invalidate any event-count inference from file
bytes, so no such inference is claimed: event/block/count/deadline limits are conservative owner
choices and MUST be exercised directly with synthetic public-decoder fixtures at exact boundaries.

All byte counts use UTF-8 bytes, not code points. The overall deadline starts before the first
filesystem metadata operation and includes both snapshot attempts through completed envelope
construction. Before reading/allocating an artifact, the service MUST reject stat size above
`MAX_ARTIFACT_BYTES`. It MUST stream with bounded chunks; count record bytes before JSON parse,
expanded events before retaining/expanding the next event, content-array length before iterating,
per-message text bytes before concatenation and raw message-ID bytes before hashing/retaining,
total projected text before retaining the next message, and response count before envelope construction. Packed rows MUST be charged by expanded event count.

Equality with every ceiling is allowed; ceiling+1 is HTTP `413 HISTORY_RESOURCE_LIMIT`. Deadline
expiry uses the same status/code. Any breach aborts the whole response: no partial messages, cursor or
fabricated history; no Agent/model/start; no Session/Binding/Home write or repair. Logs contain only
the stable code and exceeded ceiling name—never content, IDs or paths. Process count and Session bytes
remain unchanged; temporary bounded buffers MUST be released after failure, with no retained growth.

### CTR-SH-012 — Deterministic public Message ID and cursor

The DSH raw message ID remains server-internal. Define `LP(x)` as ASCII decimal UTF-8 byte length,
then `:`, then exact UTF-8 bytes of `x`. Concatenation order is fixed and no delimiter other than each
length prefix exists. Base64url is RFC 4648 URL-safe encoding without padding; SHA-256 output is 32
bytes.

The current-main generation identity is:

```text
G = LP("gen_sh1")
  || LP(header.version decimal)
  || LP(header.id)
  || LP(header.createdAt decimal)
  || LP(header.parentSession or "")
  || LP(header.seedLength decimal or "")
  || LP(header.origin or "")
  || LP(header.delegationDepth decimal)
  || LP(header.agentPreset or "")

generationDigest = base64url(SHA-256(G))        # exactly 43 ASCII characters
currentMainGenerationIdentity = "gen_sh1_" + generationDigest
```

The resolver returns the exact ordered `generationHeaderTuple` fields used by G; the service computes
and validates G/digest itself. `header.id` is native current trajectory identity and never leaves the
server. The exact pinned DSH/current-main authority MUST prove this tuple stable within one trajectory
and distinct after every main reset; otherwise implementation stops rather than adding a mapping.

For each projected message:

```text
P = LP("msg_sh1")
  || LP(agentId)
  || LP(currentMainGenerationIdentity)
  || LP(role)                    # exact "user" or "assistant"
  || LP(rawDshMessageId)

messageDigest = base64url(SHA-256(P))           # exactly 43 ASCII characters
PUBLIC_MESSAGE_ID = "msg_sh1_" + generationDigest + "_" + messageDigest
```

A public ID is therefore exactly 95 ASCII bytes and contains only two one-way digests; it does not
reversibly expose Agent, native trajectory or raw message identity. The client treats it as opaque and
never synthesizes it. Encoding is deterministic and store-free; same snapshot repeats exactly, while
role, Agent and generation inputs prevent cross-role/cross-Agent/reset collisions under SHA-256.
Duplicate P/messageDigest in one generation is `INTERNAL_ERROR`.

Malformed prefix, total length, separator, digest length or base64url is `VALIDATION_ERROR`. The
visible generationDigest may be compared only to the newly server-resolved digest: mismatch is
`STALE_HISTORY_CURSOR`; matching generation with no projected messageDigest match is
`VALIDATION_ERROR`. Role is not caller-selected and has no separate cursor error class. Old cursors
cannot match a new trajectory even when raw IDs repeat.

### CTR-SH-013 — Split Tailnet-local and public activation

Two profiles are mutually exclusive:

```text
LOCAL_TAILNET_IDENTITY_MODE = TAILSCALE_NODE_ID_ALLOWLIST_PLUS_EXACT_SURFACE_BINDING
LOCAL_TAILNET_ACTIVATION = CONDITIONAL_ALLOWED
ARBITRARY_TAILNET_MEMBER_ACCESS = FORBIDDEN
AGENT_CHILD_ACCESS = FORBIDDEN
PUBLIC_HISTORY_ACTIVATION = FORBIDDEN_UNTIL_PUBLIC_AUTH_READY
```

**LOCAL_TAILNET_ACTIVATION.** This paragraph is the endpoint-local equivalent-authentication child
contract required by `AGENT_CORE_HARDENING_PROGRAM_V1` §6.1; it is not generic Product API auth. The
route remains absent until this Spec is accepted, present in the implementation base, implemented,
compliance-proven and runtime-ready. It is default-disabled and MAY activate only when all
Git-external local configuration is present: exact Mac Tailscale bind address, Mac stable Node ID,
finite allowlist mapping exact phone stable Tailscale Node ID to exact allowed `surfaceId`, and an
available local Tailscale identity resolver. The listener binds only the configured Mac Tailscale
address—not wildcard, loopback, LAN or public addresses. For every request, before Binding lookup,
the backend MUST resolve the socket remote address through the local Tailscale identity authority
within 2000ms monotonic wall time and obtain one certain stable Node ID. It admits only an exact configured phone Node ID whose mapped
surface equals required query `surfaceId` and whose authoritative Mobile Binding exists. That Binding
provides trusted `activeAgent`; path `agentId` must match it.

Tailnet membership alone is never authorization. Unlisted nodes, wrong/absent surface, absent Binding,
Mac’s own Node ID/address, loopback, host-local calls, Agent child/other Agent processes, uncertain or
failed identity lookup, stale/missing config and path-agent mismatch all fail before Session lookup
with generic `403 HISTORY_ACCESS_DENIED`; no Node/surface/Binding detail is disclosed. Config and
allowlist stay outside Git. Logs MUST NOT record remote address, Node ID, surface ID, message/cursor
or path. Product API consumes only the verified Node-ID assertion; no Tailscale key/raw credential is
available to Product API, Agent child, workspace, logs or response. Local denial uses 403 rather than
401 because no challenge/credential-presentation protocol exists. The local profile authorizes only
this history GET and no other Product API route.

Allowlist/surface rotation MUST be atomic and versioned outside Git: mark readiness false and unmount
the route, replace one complete config snapshot, validate listener/self-node/phone-node/surface
invariants, then remount. Old Node/surface access MUST be denied before the new snapshot is ready;
never union old and new allowlists. Rollback is route disablement plus restoration of the last known-
good complete external config, without Session writes. Tailscale cryptographic key rotation remains
owned by Tailscale; any uncertain peer identity keeps the route disabled.

**PUBLIC_NETWORK_ACTIVATION.** Every non-Tailnet, Gateway or public listener remains disabled until a
separate public OAuth/Gateway/Product API auth authority is accepted, implemented and deployed and
supplies trusted Mobile surface context plus Agent-child denial. This Spec neither designs nor
implements that authority. Local readiness MUST NOT be reused as public authorization, and public
readiness is not a prerequisite for the exact local profile above.

## 10. Acceptance

Every item below is a future Acceptance definition. Real transcript verification MUST run under the
same authorized Product Surface access boundary, retain only hashes/counts/redacted excerpts in PR
evidence, and MUST NOT commit raw transcript content.

```text
EXECUTED_NOW = NO
```

### ACC-SH-A — Real stock/main transcript

- Contracts: `CTR-SH-001`, `CTR-SH-004`, `CTR-SH-005`
- Method: from an admitted Mobile surface bound to stock, request only public logical `stock/main`
  against a read-only snapshot; verify no request/response contains native trajectory identity
- Environment: isolated acceptance environment; exact implementation and DSH revisions recorded
- Required evidence: transient in-process exact-text comparison; persist only command/request,
  artifact hash before/after, IDs/roles/times and redacted or hashed text assertions
- Expected result: only bound stock/logical `main` succeeds; server resolves current trajectory;
  direct user and completed-final assistant text are correct and ascending by
  seq; success envelope has only frozen fields and every time is canonical ISO-8601 UTC
- Failure condition: missing, extra, reordered, altered/non-final text, wrong envelope or time conversion
- EXECUTED_NOW: NO

### ACC-SH-B — Real ceo/main isolation

- Contracts: `CTR-SH-001`, `CTR-SH-007`
- Method: use distinct admitted Mobile surfaces currently bound to stock and ceo to read each
  `main`, then issue Binding-mismatched, unknown Agent, missing artifact, header mismatch and
  cross-Agent requests
- Environment: isolated acceptance environment
- Required evidence: request/response records with sensitive content redacted, Home/file hashes
- Expected result: histories remain isolated; unknown matched Agent is `AGENT_NOT_FOUND`; absent
  Binding/path-agent cross-read is `HISTORY_ACCESS_DENIED`; missing current artifact is
  `SESSION_NOT_FOUND`; header/corruption mismatch is `INTERNAL_ERROR`
- Failure condition: any cross-Agent message or artifact is exposed
- EXECUTED_NOW: NO

### ACC-SH-C — No cold spawn or model call

- Contracts: `CTR-SH-003`, `CTR-SH-010`
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
  header-cwd/channel/native-ID/Node-ID/surface-shaped data plus final text; static dependency and
  changed-surface check
- Environment: unit and HTTP integration tests
- Required evidence: fixture, response, logs and static changed-file manifest
- Expected result: only allowlisted public fields/text appear; no internal/channel/native/network
  identity leaks; no Feishu/Router/Ingress/demo-server history parsing or mirror path exists
- Failure condition: any forbidden field/event/data/source inference appears or logs reveal content,
  path, native ID, Node ID or surface ID
- EXECUTED_NOW: NO

### ACC-SH-E — Inbox deduplication

- Contracts: `CTR-SH-004`
- Method: fixture with one logical input represented by `agent/inbox/spliced` and qualifying
  `user/message`, ordered mixed empty/non-empty text blocks, empty-only message, replace surface,
  plugin/goal/system-reminder/internal user-shaped events and malformed qualifying event
- Environment: unit test
- Required evidence: fixture seqs and projected response
- Expected result: exactly one direct user message with ordered non-empty text and deterministic
  `msg_sh1_` public ID derived from internal data.id;
  excluded/empty surfaces produce none; malformed qualifying input returns `INTERNAL_ERROR`
- Failure condition: duplicate/splice/reminder/internal message, wrong block order or silent malformed skip
- EXECUTED_NOW: NO

### ACC-SH-F — Last final assistant only

- Contracts: `CTR-SH-005`
- Method: completed, failed, blocked, max-tokens, interrupted, aborted and unterminated fixtures with
  chunks, tool-only/multiple assistant messages, mismatched turn IDs, assistant-after-end and duplicate
  terminal events
- Environment: unit test
- Required evidence: event fixtures and exact projection
- Expected result: each valid completed turn returns only its last non-empty text assistant message;
  failed/incomplete provisional text is absent; malformed correlated messages and duplicate/out-of-order
  terminal events return `INTERNAL_ERROR`
- Failure condition: duplicate chunks, earlier assistant candidate, tool-only/provisional text, or
  malformed/duplicate terminal accepted or silently skipped
- EXECUTED_NOW: NO

### ACC-SH-G — Torn final record is observational

- Contracts: `CTR-SH-003`
- Method: append a torn final JSONL record to a copied fixture, hash before/after, issue GET
- Environment: read-only fixture test
- Required evidence: bytes/hash before and after, response and parser outcome
- Expected result: incomplete tail is ignored, no fabricated message, bytes unchanged
- Failure condition: error solely for the incomplete tail, projected partial data or any writeback
- EXECUTED_NOW: NO

### ACC-SH-H — Limit/before pagination

- Contracts: `CTR-SH-002`, `CTR-SH-006`
- Method: table tests for limits 1/50/200, invalid values, malformed/oversize `msg_sh1_` cursor,
  newest/all older pages, empty projection, before-first empty page, same-ms events, unknown current-
  generation cursor, stale generation cursor, duplicate public IDs and unchanged-prefix paging
- Environment: unit plus HTTP integration tests
- Required evidence: full projected baseline, every page and error response
- Expected result: ascending stable order, exclusive cursor, exact hasMore and no duplicates/gaps;
  unknown current cursor is `400 VALIDATION_ERROR`, stale generation is `409 STALE_HISTORY_CURSOR`
- Failure condition: guessed cursor, repeated/skipped item, unstable same-ms order or wrong hasMore
- EXECUTED_NOW: NO

### ACC-SH-I — Repeated-read stable identity

- Contracts: `CTR-SH-006`
- Method: repeat identical full/page reads against unchanged artifact hash
- Environment: integration test
- Required evidence: artifact hash and byte-for-byte normalized responses
- Expected result: every `message.id` and `createdAt` remains stable
- Failure condition: regenerated IDs/times or order/page-boundary drift
- EXECUTED_NOW: NO

### ACC-SH-J — Traversal and cross-Agent fail closed

- Contracts: `CTR-SH-002`, `CTR-SH-007`
- Method: malicious agentId/sessionId, encoded traversal, symlink escape, header mismatch, duplicate
  ID and cross-Agent artifact fixtures
- Environment: filesystem integration tests
- Required evidence: fixture topology, requests, error envelopes and no-path-leak log capture
- Expected result: malformed/traversal/non-`main` input is `400 VALIDATION_ERROR`; absent Binding or
  path-agent mismatch is `403 HISTORY_ACCESS_DENIED`; admitted matched Binding with missing definition
  is `404 AGENT_NOT_FOUND`; missing current artifact is `404 SESSION_NOT_FOUND`; header/location/
  symlink/duplicate corruption is `500 INTERNAL_ERROR`;
  every error has the exact safe envelope and no read occurs outside exact configured Session root
- Failure condition: arbitrary/root-external/cross-Agent read, path disclosure or silent mismatch
- EXECUTED_NOW: NO

### ACC-SH-K — Logical current-main lifecycle

- Contracts: `CTR-SH-001`, `CTR-SH-002`, `CTR-SH-006`, `CTR-SH-012`
- Method: synthetic trusted Binding/current-main resolver fixture: App open on Agent A; switch to B;
  switch back to A; reset A sequentially and concurrently between R0/read/final validation to a new
  trajectory generation; request non-`main` path; inspect Mobile
  request/response schema
- Environment: unit plus HTTP integration tests; no real Session read
- Required evidence: resolver call trace, Binding revisions, public requests/responses and old cursor
- Expected result: every attempt re-resolves Binding/current main; switch/back follows current Agent;
  concurrent reset invalidates/discards R0 before response and retries at most once; completed reset
  hides old trajectory and old cursor returns `STALE_HISTORY_CURSOR`; non-`main` is `VALIDATION_ERROR`;
  Mobile never creates/sends/receives native trajectory ID
- Failure condition: cached trajectory, old history after reset, native ID on wire or second mapping
- EXECUTED_NOW: NO

### ACC-SH-L — Exact resource boundaries

- Contracts: `CTR-SH-003`, `CTR-SH-011`
- Method: independently exercise each guard with a valid synthetic public-decoder/clock fixture at
  exact ceiling and ceiling+1; include artifact, single record, packed expanded events, content blocks,
  per-message text, raw message ID, total projected text, response count and deadline. A guard fixture
  need not simultaneously reach unrelated ceilings
  and deterministic monotonic deadline expiry
- Environment: resource-instrumented unit/integration tests
- Required evidence: allocation counters/high-water mark, error envelopes, process/model counters and
  fixture/session hashes before/after
- Expected result: exact equality is not rejected by the exercised guard (and valid end-to-end
  equality fixtures succeed); +1 or deadline >10000ms returns `413 HISTORY_RESOURCE_LIMIT` with no
  partial body; allocation/expansion is rejected at the prescribed pre-check; process count and Session bytes
  remain unchanged; bounded temporary memory is released and retained-memory baseline is unchanged
- Failure condition: partial history, unbounded/retained growth, spawn/model/write, wrong status/code or
  content/path in logs
- EXECUTED_NOW: NO

### ACC-SH-M — Exact Session-root and zero-read rejection

- Contracts: `CTR-SH-007`
- Method: filesystem fixtures for Agent-Home-inside/Session-root-outside file, Session-root intermediate
  symlink to another Home directory, symlink outside Home, mount/alias escape, check/open TOCTOU
  replacement, cross-Agent Home, slash/backslash/dot traversal and valid exact-root artifact
- Environment: filesystem integration tests with byte-read instrumentation
- Required evidence: canonical topology without sensitive host paths, open trace, bytes-read counter,
  response envelope and file hashes
- Expected result: every path/root/open invalid case is rejected with artifact `bytesRead=0`; only
  exact canonical root opens. A header mismatch reads at most the bounded header and zero body-event
  bytes; valid header matches resolver native ID/generation/format/origin
- Failure condition: any invalid path reads one byte, header failure reads an event/body byte, fallback
  scans, alias escapes, or paths leak
- EXECUTED_NOW: NO

### ACC-SH-N — Composite public ID collision and cursor safety

- Contracts: `CTR-SH-006`, `CTR-SH-012`
- Method: fixtures with user/assistant raw-ID collision, two-Agent collision, reset-generation collision,
  repeated unchanged reads, malformed tuple/prefix/base64url and old/current unknown cursors
- Environment: pure unit plus pagination integration tests
- Required evidence: canonical LP bytes, generation digest, public IDs and exact error envelopes
- Expected result: IDs differ across role/Agent/generation, repeat exactly within a snapshot, expose no
  native/path data; malformed is `VALIDATION_ERROR`, old generation is `STALE_HISTORY_CURSOR`, unknown
  current raw ID is `VALIDATION_ERROR`
- Failure condition: collision, reset reuse, raw DSH ID exposed as public ID, store/mapping, or cursor remap
- EXECUTED_NOW: NO

### ACC-SH-O — Tailnet-local and public activation matrix

- Contracts: `CTR-SH-001`, `CTR-SH-007`, `CTR-SH-013`
- Method: table tests for allowed phone Node+exact surface, allowed Node+wrong surface, unlisted Tailnet
  node, Mac host Node/address, Agent child, other Agent process, loopback, identity lookup failure/
  uncertainty/2000ms timeout, absent/not-ready config, authorized/absent Binding, path-agent mismatch,
  atomic allowlist/surface rotation and rollback, and non-Tailnet/Gateway/public listener
- Environment: socket/admission integration harness with synthetic Tailscale identity authority
- Required evidence: bind addresses, generic envelopes, zero downstream lookup counters and redacted logs
- Expected result: only exact phone Node+surface+Binding is admitted locally; every denial is generic
  `403 HISTORY_ACCESS_DENIED` before Session lookup; route defaults disabled; public listener stays
  absent until separately accepted+implemented+deployed public auth; rotation has no old/new union and
  disables before replacement; logs contain no identity/content
- Failure condition: membership-only access, host/loopback/Agent-child access, config-in-Git, identity
  disclosure, public activation or any denied request reaching Session lookup
- EXECUTED_NOW: NO

### 10.1 Bidirectional coverage

| Contract | Acceptance coverage |
|---|---|
| `CTR-SH-001` | A, B, K, O |
| `CTR-SH-002` | H, J, K |
| `CTR-SH-003` | C, G, L |
| `CTR-SH-004` | A, E |
| `CTR-SH-005` | A, D, F |
| `CTR-SH-006` | H, I, K, N |
| `CTR-SH-007` | B, J, M, O |
| `CTR-SH-008` | D |
| `CTR-SH-009` | D |
| `CTR-SH-010` | C, D |
| `CTR-SH-011` | L |
| `CTR-SH-012` | H, I, K, N |
| `CTR-SH-013` | O |

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
| Infer channel from text/Binding | DEFERRED TO FUTURE AMENDMENT | source metadata is partial |
| Feishu mirror or dual-write | REJECTED | out of scope and creates split truth |
| Public raw DSH message ID | REJECTED | global cross-role/Agent/reset uniqueness is not proven |
| Tailnet membership as authorization | REJECTED | membership does not identify the allowed phone/surface |
| Delay all history until public OAuth | REJECTED | exact Tailnet-local identity can safely enable current private use |

Investigation disposition: `NEW`; this proposed Spec is ready for independent semantic review but
is not accepted implementation authority.

## 12. Migration, compatibility, and rollback

- Migration: none. Existing DSH Session artifacts remain byte-unchanged.
- Compatibility: additive GET only; existing Product API endpoints and Binding semantics remain
  unchanged. Public selector is logical `main`; public IDs are new opaque `msg_sh1_`; no channel
  metadata is promised.
- Rollout: local Tailnet implementation may later activate only after `CTR-SH-013` conformance and
  separate deployment authorization. Public activation requires later public-auth authority.
- Rollback: disable/remove the additive GET adapter and read-only service. No data rollback exists.
- Unknown outcome: a failed read has no persistence side effect; caller may retry. A retry MUST use a
  fresh stable current-main snapshot and MUST preserve IDs only for the unchanged generation/prefix.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
SOURCE_CHANNEL_METADATA remains future amendment
```

Non-normative implementation debt: the future implementation preflight must pin the exact deployed
DSH package/format revision and choose its public read-only decoder seam. That choice may not change
any Contract above.

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
CONTRACT_COUNT = 13
CONTRACTS_WITH_ACCEPTANCE = 13
ACCEPTANCE_COUNT = 15
BIDIRECTIONAL_COVERAGE = 13/13 Contracts; 15/15 Acceptance references valid
SESSION_IDENTITY_MODEL = LOGICAL_MAIN_PUBLIC_SERVER_RESOLVED_NATIVE
RESOURCE_CEILINGS = COMPLETE
SESSION_ROOT_CONFINEMENT = PASS
PUBLIC_MESSAGE_ID_MODE = DETERMINISTIC_COMPOSITE
LOCAL_TAILNET_IDENTITY_MODE = TAILSCALE_NODE_ID_ALLOWLIST_PLUS_EXACT_SURFACE_BINDING
TAILSCALE_HISTORY_ACTIVATION = ALLOWED_WHEN_LOCAL_IDENTITY_READY
PUBLIC_HISTORY_ACTIVATION = FORBIDDEN_UNTIL_AUTH_READY
DSH_DEPENDENCY_AUTHORITY = PASS_WITH_EXACT_IMPLEMENTATION_PIN_GATE
DECODER_OWNERSHIP = DSH_PUBLIC_ROW_DECODER_PLUS_LOCAL_VALIDATION_PROJECTION
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
MOBILE_CHANGE = NONE
CANARY_CHANGE = NONE
SESSION_DATA_CHANGE = NONE
DEPLOYMENT_CHANGE = NONE
MERGE_PERFORMED = NO
```
