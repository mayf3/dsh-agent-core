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
IMPLEMENTATION_ALLOWED_NOW = NO
EXECUTED_NOW = NO
```

## 1. Goal

为 Mobile 当前 Binding 指向的 `(agentId, sessionId)` 提供 DSH 原生 Session 的只读聊天历史。
本 Spec 只冻结后端读取、投影、分页、错误和隐私边界；它不实现代码、不部署、不修改
canary，也不授权在本 proposed revision 上实施。

```text
HISTORY_AUTHORITY = DSH_SESSION
HISTORY_REQUEST_SESSION_ID = DSH_NATIVE_TRAJECTORY_ID
SECOND_SESSION_MAPPING = FORBIDDEN
BACKEND_HISTORY_OWNER = @agent-core/session-history (minimal read-only service/module)
PRODUCT_API_ROLE = THIN_ADAPTER
COLD_READ_WITHOUT_AGENT_SPAWN = YES
```

## 2. Scope and non-goals

### 2.1 In scope

- 一个精确只读 HTTP endpoint：
  `GET /v1/agents/{agentId}/sessions/{sessionId}/messages?limit=50&before=<messageId>`；
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
- Product API authentication 协议选择或 loopback 之外的 exposure 变更；history endpoint
  activation nevertheless remains gated by the accepted+implemented authentication authority in
  `CTR-SH-010`；
- 完整 Session 管理组件。

## 3. Authority and dependencies

1. `AGENT_CORE_PRODUCT_ARCHITECTURE_V1` 冻结 DSH 为 Session runtime、product sessionId 与
   DSH native sessionId 相同、Agent Core 不建第二套 Session engine/mapping/history。
2. accepted Current Decision `AGENT_WORKSPACE_SESSION_MODEL_V2` 冻结 Session 是属于 Agent
   的 trajectory，Mobile Human Binding 只持有 `activeAgent` 并始终进入 canonical logical
   `main`；native DSH Session ID 是实现细节。为避免冲突，本 Spec 的 path `sessionId` 只命名
   control plane 已解析出的 **current native trajectory artifact**，不是 Mobile 可选择或
   Binding 可长期持有的第二个产品身份。main reset 后旧 native ID 不再代表 current main；
   本 Spec 不决定 reset、archive 或旧 trajectory 可见性。
3. accepted Program `AGENT_CORE_HARDENING_PROGRAM_V1` 将 Product API 定义为 Product Surface
   Control Plane，并要求未认证状态不得扩大到 loopback 外；本 Spec 不改变该边界。
4. `mayf3/agent-core-mobile@3704bc289a63f66961cc31849459019715d358c1` 是 consumer
   协调坐标，不是本仓库的外部 governing authority。
5. DSH JSONL 格式及 event schema 是运行时依赖，不由本仓库重新治理。本 Spec 通过
   `CTR-SH-003`–`CTR-SH-005` 建立本地、封闭的 compatibility allowlist：production profile
   的 plaintext newline-delimited JSON、首条 header、连续 `seq`，以及本文逐字段列出的
   event shape。实现必须锁定实际 DSH dependency revision并优先复用其公共只读 decoder；
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
游标判定与 fail-closed 归属校验只在该 owner 内发生。它不拥有 Session，不提供写方法，也
不得演化为完整 Session 管理组件。

Product API 只允许调用类似
`sessionHistory.listMessages({ agentId, sessionId, limit, before })` 的只读 service seam，
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

## 8. Decisions

### DEC-SH-001 — DSH Session remains the sole history authority

- Decision owner: `mayf3/dsh-agent-core` maintainers
- Decision: history path `sessionId` is the exact native trajectory artifact ID already resolved for
  the selected Agent’s current canonical main; it is not a durable Human Binding field or a second
  logical-main identity. History is a read-only projection and owns neither Session nor storage.
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

## 9. Contracts

### CTR-SH-001 — Sole authority and backend ownership

The implementation MUST treat the target DSH native Session artifact as the sole history authority.
The path `sessionId` MUST equal the native trajectory artifact ID already resolved by the control
plane for the selected Agent’s current canonical main; Mobile MUST NOT select it, and Human Binding
MUST remain `activeAgent`-only. The implementation MUST NOT create a database, message store,
logical-main→native mapping or cached alternate truth.

`@agent-core/session-history` names one minimal read-only service contract; its implementation MAY be
an internal module or a tiny package, but MUST NOT be an independent Session engine/manager.
It MUST be the only backend owner that reads raw DSH Session records and applies this projection.
Product API, Mobile and connectors MUST NOT parse Session artifacts. The service MUST NOT expose a
Session-management write surface.

### CTR-SH-002 — Exact HTTP contract and validation

Product API MUST expose exactly:

```http
GET /v1/agents/{agentId}/sessions/{sessionId}/messages?limit=50&before=<messageId>
```

`limit` MUST default to `50`, accept integers `1..200`, and reject all other values with
`400 VALIDATION_ERROR`. `before` is optional and exclusive. Success MUST be:

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

Product API MUST only validate/decode HTTP input, call `sessionHistory.listMessages`, and map the
service result/error to the envelope. Minimum errors are:

```text
400 VALIDATION_ERROR
404 AGENT_NOT_FOUND
404 SESSION_NOT_FOUND
500 INTERNAL_ERROR
```

`before` MUST decode as one non-empty UTF-8 message ID of at most 512 bytes; otherwise it is
`400 VALIDATION_ERROR`. An unknown `before` MUST also be `400 VALIDATION_ERROR`; the service MUST
NOT guess a cursor.

### CTR-SH-003 — Cold-read valid complete prefix

A history GET MUST NOT call `agentRouter.ensureRunning`, `AgentProcess.spawn`, any model,
`session/prompt`, or any other admission/write path. It MUST NOT change Binding, Agent Home,
Workspace or Session; MUST NOT write a synthetic closer; MUST NOT repair or truncate a torn record;
and MUST NOT start a cold Agent.

The service MUST use at most two bounded snapshot attempts. For each attempt it MUST open the
artifact read-only, capture `(device,inode,size=S)` from that descriptor, read exactly bytes
`[0,S)`, then re-stat the same descriptor. Same device/inode with final size `>= S` is a stable
prefix; a concurrent append beyond `S` is excluded until the next GET. Replacement, truncation,
short read or identity change retries once, then returns `INTERNAL_ERROR`. No attempt may wait for
an Agent or writer.

The accepted encoding is plaintext newline-delimited JSON used by the production profile. The first
complete line MUST be a DSH v0 header object with `type = session`, `version = 0`, non-empty string
`id`, non-negative integer `createdAt`, integer `delegationDepth >= 0`, and optional string `cwd`,
`parentSession`, `origin`, `agentPreset` plus optional non-negative integer `seedLength`; unknown
header fields or invalid optional values are malformed. Each following newline-terminated storage
record MUST decode through the pinned DSH public decoder into zero or more individual events. Each
expanded event MUST have string `type`, non-negative integer `seq`, non-negative integer millisecond
`time`, and object `data`; expanded `seq` MUST be contiguous and zero-based. Event types outside the
three projection/correlation types in `CTR-SH-004/005` are accepted only as ignored internal events.
Packed chunk rows may decode only to ignored events; they never become messages. A final byte
fragment with no newline is the only
torn-tail case and MUST be ignored. Invalid JSON on a newline-terminated line, unknown/unsupported
format or version, seq gap/duplicate, malformed header/event, or duplicate terminal boundary is
committed corruption and MUST return
`INTERNAL_ERROR`. The service MUST NOT fabricate messages or write repair bytes.

### CTR-SH-004 — User message projection

The projection MUST include only append-surface events satisfying:

```text
event.type = user/message
event.surfaceOp = append
data.source.kind = user
data.id = non-empty string
data.content = array
```

For each included event it MUST:

- concatenate, in block order, every `data.content` block with `type = text` and non-empty `text`;
- omit the event when the resulting text is empty;
- use `user/message.data.id` as `message.id`;
- use `user/message.time`, converted to ISO-8601 UTC, as `createdAt`;
- use the requested `agentId` and `sessionId` and role `user`.

It MUST exclude `agent/inbox/spliced`, `source.kind = plugin`, `source.kind = goal`, system
reminders, memory snapshots and internal events. One logical input represented by
`inbox/spliced + user/message` MUST appear exactly once, from the qualifying `user/message` only.
Text order and bytes MUST otherwise be preserved. This structural predicate is the complete
`direct user` test; content text MUST NOT be inspected to infer source. A structurally malformed
qualifying event MUST return `INTERNAL_ERROR`, not be silently reclassified.

### CTR-SH-005 — Assistant completed-turn projection

The projection MUST group by integer `data.turn`. A turn is eligible only when the complete prefix
contains exactly one later event with `event.type = turn/end`, matching `data.turn`, and
`turn/end.data.reason.kind = completed`. The selected assistant event MUST precede that end event.
Missing, duplicate or out-of-order terminal events make that turn non-projectable; a duplicate
terminal for one turn is committed corruption under `CTR-SH-003`. For each eligible turn it MUST
select the highest-`seq` `assistant/message` with `surfaceOp = append` whose
`data.message.content` contains at least one non-empty `type = text` block, concatenate only those
text blocks in block order, use `data.message.id` as `message.id`, and convert that
`assistant/message.time` to ISO-8601 UTC as `createdAt`.

It MUST exclude `assistant/chunk`, `text-chunks`, `reasoning-chunks`, tool-call, tool-result, usage,
tool-only `assistant/message`, and provisional text from incomplete, failed, blocked, interrupted,
aborted or otherwise non-completed turns. It MUST NOT concatenate chunk/block-end events with the
selected final `assistant/message`, and MUST return at most one assistant message per completed turn.

### CTR-SH-006 — Seq ordering, pagination and stable identity

The service MUST order the full projected sequence by DSH event `seq`, not timestamps. Equal
millisecond timestamps MUST not affect ordering.

- Without `before`, return the final `limit` projected messages.
- With `before`, locate that exact projected `message.id` and return at most `limit` projected
  messages immediately before it.
- Each response’s `messages` MUST be ascending by authoritative `seq`.
- `hasMore` MUST be true exactly when at least one earlier projected message exists before the
  returned page.

For an unchanged valid artifact prefix, repeated reads MUST preserve every `message.id`,
`createdAt`, order and page boundary. Adjacent pages MUST have no duplicate or skipped projected
message. These no-gap guarantees bind one unchanged captured prefix; after reset, compaction or
replacement removes a cursor, that cursor is unknown and MUST fail as `VALIDATION_ERROR` rather
than being remapped. Duplicate projected message IDs within one Session MUST fail closed as
`INTERNAL_ERROR`.

### CTR-SH-007 — Agent/Session identity and path confinement

Before reading history, the service MUST:

1. confirm the Agent Definition exists, otherwise `AGENT_NOT_FOUND`;
2. resolve the target Agent Home only through the configured workspace-bootstrap Home authority;
3. locate the Session artifact only beneath that Agent Home’s configured Session root, using a
   path-safe Session identifier/DSH locator;
4. require the artifact to exist, otherwise `SESSION_NOT_FOUND`;
5. require the Session header `id` to equal requested `sessionId`;
6. require the selected artifact, after canonical filesystem resolution, to remain within the
   target Agent Home and to be the artifact identified by its header/location rules.

Path traversal, symlink escape, duplicate Session IDs, header mismatch, cross-Agent Home access or
arbitrary-file reads MUST fail closed and MUST NOT reveal filesystem paths. A Session found only in
another Agent Home is `SESSION_NOT_FOUND` for the requested Agent.

### CTR-SH-008 — Privacy allowlist

The HTTP response MUST contain only user final text, assistant final completed text, stable message
ID, timestamp, `agentId` and `sessionId`, plus top-level `hasMore`. It MUST NOT project or return
reasoning, system prompts/reminders, tool parameters, tool results, usage, credentials, provider
internal errors, workspace paths, Agent Home paths, raw DSH events, internal PIDs or Session header
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

Because transcripts are private Product Surface data, the history route MUST default disabled and
MUST NOT be activated or deployed until `PRODUCT_API_AUTHENTICATION_V1` (or its accepted whole
successor) is accepted, present in the implementation base, implemented, and proves trusted caller
identity, unauthorized denial, and Agent-child direct-access denial. The authentication owner defines
401/403 details; this Spec MUST NOT invent a competing credential scheme. Loopback alone is never
activation authority, and distinct Agent/Session 404s MUST occur only after authorization.

The implementation MUST NOT modify Router/Ingress/demo-server behavior, Mobile repository, Agent
Home, existing Session files or canary as part of implementing this Contract. Deployment, canary
apply and merge remain separately authorized actions. Rollback is disablement/removal of the new
GET adapter and read-only service; because there is no owned persistence, no data migration or
rollback write is allowed.

## 10. Acceptance

Every item below is a future Acceptance definition. Real transcript verification MUST run under the
same authorized Product Surface access boundary, retain only hashes/counts/redacted excerpts in PR
evidence, and MUST NOT commit raw transcript content.

```text
EXECUTED_NOW = NO
```

### ACC-SH-A — Real stock/main transcript

- Contracts: `CTR-SH-001`, `CTR-SH-004`, `CTR-SH-005`
- Method: run the pinned implementation against a read-only snapshot of real `stock/main`
- Environment: isolated acceptance environment; exact implementation and DSH revisions recorded
- Required evidence: command/request, artifact hash before/after, projected IDs/roles/times/text
- Expected result: direct user and completed-final assistant text are correct and ascending by seq;
  success envelope has only frozen fields and every time is canonical ISO-8601 UTC
- Failure condition: missing, extra, reordered, altered/non-final text, wrong envelope or time conversion
- EXECUTED_NOW: NO

### ACC-SH-B — Real ceo/main isolation

- Contracts: `CTR-SH-001`, `CTR-SH-007`
- Method: independently read `stock/main` and `ceo/main`, including unknown Agent, missing artifact,
  header mismatch and cross-Agent requests
- Environment: isolated acceptance environment
- Required evidence: request/response records with sensitive content redacted, Home/file hashes
- Expected result: histories remain isolated; unknown Agent is `AGENT_NOT_FOUND`; missing or
  cross-Agent artifact is `SESSION_NOT_FOUND`; header/corruption mismatch is `INTERNAL_ERROR`
- Failure condition: any cross-Agent message or artifact is exposed
- EXECUTED_NOW: NO

### ACC-SH-C — No cold spawn or model call

- Contracts: `CTR-SH-003`, `CTR-SH-010`
- Method: count Agent processes and instrument ensureRunning/spawn/model/session-prompt before,
  during and after GET on a cold Agent; fault-inject stable append, replacement, truncation, short
  read, malformed committed JSON, seq gap/duplicate, unsupported format/version and disable rollback
- Environment: canary-equivalent isolated environment, not live canary
- Required evidence: process table, call counters/traces, file hashes
- Expected result: process count/counters stay unchanged; append returns captured prefix; one
  instability retries once; persistent instability/corruption returns `INTERNAL_ERROR`; disablement
  removes the route/service with no data write
- Failure condition: spawn/model/prompt/write/process increase, unbounded retry, corruption accepted,
  or rollback mutates Session data
- EXECUTED_NOW: NO

### ACC-SH-D — Internal-event and privacy exclusion

- Contracts: `CTR-SH-005`, `CTR-SH-008`, `CTR-SH-009`, `CTR-SH-010`
- Method: fixture containing tool/reasoning/chunk/plugin/goal/system/usage/internal-error/path/PID/
  header-cwd/channel-shaped data plus final text; static dependency/changed-surface check; authorized,
  unauthorized and Agent-child HTTP probes against the accepted Product API auth implementation
- Environment: unit and HTTP integration tests
- Required evidence: fixture, response, logs and static changed-file manifest
- Expected result: only an authorized Product Surface caller receives allowlisted fields/text;
  unauthorized and Agent-child callers fail before Agent/Session lookup; no internal/channel data
  leaks; no Feishu/Router/Ingress/demo-server history parsing or mirror path exists
- Failure condition: any forbidden field/event/data or source inference appears
- EXECUTED_NOW: NO

### ACC-SH-E — Inbox deduplication

- Contracts: `CTR-SH-004`
- Method: fixture with one logical input represented by `agent/inbox/spliced` and qualifying
  `user/message`, ordered mixed empty/non-empty text blocks, empty-only message, replace surface,
  plugin/goal/system-reminder/internal user-shaped events and malformed qualifying event
- Environment: unit test
- Required evidence: fixture seqs and projected response
- Expected result: exactly one direct user message with ordered non-empty text and data.id;
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
- Expected result: each completed turn returns only its last non-empty text assistant message;
  failed/incomplete provisional text is absent
- Failure condition: duplicate chunks, earlier assistant candidate, tool-only or provisional text
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
- Method: table tests for limits 1/50/200, invalid values, malformed/oversize cursor, newest page,
  all older pages, same-ms events, unknown/removed before, duplicate projected IDs, unchanged-prefix
  paging and a later concurrent append
- Environment: unit plus HTTP integration tests
- Required evidence: full projected baseline, every page and error response
- Expected result: ascending stable order, exclusive cursor, exact hasMore, no duplicates/gaps;
  unknown cursor is `400 VALIDATION_ERROR`
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
- Expected result: validation/404/500 behavior follows Contracts without reading outside target Home
- Failure condition: arbitrary-file read, cross-Agent read, path disclosure or silent mismatch
- EXECUTED_NOW: NO

### 10.1 Bidirectional coverage

| Contract | Acceptance coverage |
|---|---|
| `CTR-SH-001` | A, B |
| `CTR-SH-002` | H, J |
| `CTR-SH-003` | C, G |
| `CTR-SH-004` | A, E |
| `CTR-SH-005` | A, D, F |
| `CTR-SH-006` | H, I |
| `CTR-SH-007` | B, J |
| `CTR-SH-008` | D |
| `CTR-SH-009` | D |
| `CTR-SH-010` | C, D |

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

Investigation disposition: `NEW`; this proposed Spec is ready for independent semantic review but
is not accepted implementation authority.

## 12. Migration, compatibility, and rollback

- Migration: none. Existing DSH Session artifacts remain byte-unchanged.
- Compatibility: additive GET only; existing Product API endpoints and Binding semantics remain
  unchanged. No channel metadata is promised.
- Rollout: implementation, deployment and canary require later separately authorized rounds.
- Rollback: disable/remove the additive GET adapter and read-only service. No data rollback exists.
- Unknown outcome: a failed read has no persistence side effect; caller may retry. A retry MUST use a
  fresh stable artifact snapshot and MUST preserve IDs for the unchanged prefix.

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
CONTRACT_COUNT = 10
CONTRACTS_WITH_ACCEPTANCE = 10
ACCEPTANCE_COUNT = 10
BIDIRECTIONAL_COVERAGE = 10/10 Contracts; 10/10 Acceptance references valid
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
MOBILE_CHANGE = NONE
CANARY_CHANGE = NONE
DEPLOYMENT_CHANGE = NONE
MERGE_PERFORMED = NO
```
