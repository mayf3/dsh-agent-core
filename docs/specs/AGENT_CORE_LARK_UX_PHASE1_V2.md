---
spec_id: AGENT_CORE_LARK_UX_PHASE1_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - mayf3/dsh-agent-core
  - packages/feishu-connector
  - packages/agent-router/src/index.js
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_LARK_UX_PHASE1_V2

## 1. Goal

在不改变 Agent Core 产品路由、身份 authority、Phase A foundation 或其他发送路径的前提下，
为飞书 Agent 成功回复激活两项第一轮 UX：SDK-native Markdown 渲染，以及 group/topic 中自动
mention 触发该 turn 的人类发送者。

```text
GOAL = MARKDOWN_AGENT_REPLY_AND_TRIGGER_SENDER_AUTO_MENTION
SUCCESS_OUTCOME = REVIEWABLE_CONTRACTS_WITH_REAL_TEST_APP_GATES
PRODUCT_SEMANTIC_CHANGE = NONE
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORING_CLASSIFICATION = AMEND_PROPOSED_SPEC_FOR_FORMAT_RECONCILIATION
```

## 2. Goals / Scope and non-goals

### In scope

- Agent turn 的飞书成功回复默认使用 SDK built-in Markdown 原语。
- group/topic 成功回复自动 mention 触发该 turn 的发送者。
- connector 从 `IngressEvent.sender.openId` 机械建立 ReplyTarget mention context。
- `packages/agent-router/src/index.js` 的一个成功回复调用点传递最小 UX intent。
- SDK-native format-error、target-revoked 与 bounded transport retry 合同。
- unit/integration、dedicated test app 与 production-canary 前置 gate。

### Out of scope

- per-group no-mention、typing reaction、streaming/thinking/approval card、file/media delivery、
  `/cd`、`/model`、`/status`、ConversationSessions 或第二 Agent lifecycle；
- failure receipt、unbound receipt、startup/configuration failure、scheduler/proactive notification 的
  Markdown 或自动 mention；
- Router 身份解析、AgentProcess、Binding Store、PREBOUND_ONLY、Workspace/Session、Kernel、
  ingress gate 或依赖坐标变更；
- custom Markdown converter、raw client、direct node SDK、第二 outbound transport、
  `resolveMentionsInText`、roster/name-to-identity resolution；
- 本轮 implementation、test-app 执行、deployment、production mutation、acceptance-finalize 或 merge。

## 3. Authority and dependencies

```text
GOVERNED_BY =
  AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2
  AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
LOCAL_AUTHORITY_BOUNDARY =
  MAY_DEFINE_DSH_AGENT_CORE_OUTBOUND_UX_ONLY
  MUST_NOT_DEFINE_EXTERNAL_SDK_AUTHORITY_OR_EXPAND_ROUTER_PRODUCT_OWNERSHIP
IMPLEMENTATION_AUTHORITY = CONTRACTS_ONLY_AFTER_ACCEPTANCE_AND_MAIN_BASE_PRECONDITIONS
SUPERSEDES_OR_AMENDS = AMENDS_PROPOSED_SELF_WITH_SEMANTIC_DELTA_NONE
PHASE_A_PRECONDITION =
  UX_ACCEPTED_EXACT_CONTENT_ON_MAIN
  AND_PHASE_A_FOUNDATION_IMPLEMENTATION_PRESENT_ON_SAME_MAIN_BASE
OWNER_DECISION_REQUIRED = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
EXTERNAL_AUTHORITIES = NONE
```

`AGENT_CORE_PRODUCT_ARCHITECTURE_V1` 保持 Channel 只负责传输/展示、Router 只表达路由与进程
调度意图的层次边界。accepted `AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2` 提供 Phase A、
IngressEvent parity、ReplyTarget 与 SDK source/runtime pin；本 Spec 仅激活其明确排除的 Phase B
第一轮 UX。accepted `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` 规定本文结构和 lifecycle，
不提供产品行为 authority。

SDK reviewed source `bd24f6742513769c80b5401b96ad464d74dd2027` 与 runtime
`ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f` 是 dependency/source-evidence 坐标，不是本地
governing authority。PR #23 / `cce18f3aa8c0836d3255c0514de86bda4dbd961b` 只能作为历史
source evidence。PR #27 / `e20545eff93c0a40e48426a1f4d22c4fec2edb02` 只能作为当前 Phase A
candidate evidence；PR、branch 或 candidate SHA 都不是 implementation hard precondition。

## 4. Current State

### STATE-LUX-001 — PR #24 is a proposed Draft authority candidate

- Subject: `AGENT_CORE_LARK_UX_PHASE1_V2` on PR #24
- As of commit/artifact: `810eaab2a877a7313446a71f1b1f8c951e5e0920`
- Environment: GitHub `mayf3/dsh-agent-core`, PR #24, base `main`
- Observed at: `2026-08-21T00:11:24Z`
- Projection: the Spec is `proposed`, the PR is Draft, and no implementation is authorized.
- Basis: `OBS-LUX-001`, `CLM-LUX-001`, `EVD-LUX-001`.

### STATE-LUX-002 — Current main contains governance and accepted Phase A Spec authority

- Subject: repository authority branch
- As of commit/artifact: `origin/main@82abe6489fc33f624aec74cea6cfb4f6d100f4b9`
- Environment: fetched local remote-tracking ref
- Observed at: `2026-08-21T00:11:24Z`
- Projection: governance adoption and accepted V2 Spec content are present; neither historical Phase A
  evidence head nor current PR #27 candidate head is an ancestor of this main snapshot.
- Basis: `OBS-LUX-002`, `OBS-LUX-009`, `CLM-LUX-007`, `EVD-LUX-008`.

### STATE-LUX-003 — Candidate Phase A exposes the narrow reply seam

- Subject: PR #27 candidate source tree
- As of commit/artifact: `e20545eff93c0a40e48426a1f4d22c4fec2edb02`
- Environment: GitHub PR #27 Draft candidate, not main authority
- Observed at: `2026-08-21T00:11:24Z`
- Projection: success and failure paths share `feishu.reply`; ReplyTarget receives full ingress at the
  Router boundary but currently projects no sender mention context; scheduler uses a literal target.
- Basis: `OBS-LUX-006`, `OBS-LUX-007`, `EVD-LUX-006`.

### STATE-LUX-004 — UX remains unimplemented by this Spec round

- Subject: authoring worktree at previous PR head
- As of commit/artifact: `810eaab2a877a7313446a71f1b1f8c951e5e0920`
- Environment: docs-only reconciliation worktree
- Observed at: `2026-08-21T00:11:24Z`
- Projection: this round changes one Spec file and makes no product, dependency, test-app, deployment,
  production, acceptance, or merge mutation.
- Basis: `OBS-LUX-001`; direct Git diff provenance required by `ACC-BOUNDARY-001`.

## 5. Observations

### OBS-LUX-001 — PR #24 exact Head and Draft lifecycle

- Subject: PR #24 metadata
- Repository/source: GitHub `mayf3/dsh-agent-core`
- Commit/artifact: `810eaab2a877a7313446a71f1b1f8c951e5e0920`
- Environment: GitHub pull request API
- Observed at: `2026-08-21T00:11:24Z`
- Method: fetch `origin`, then query PR number, head OID, base, and Draft flag.
- Result: head is exact, base is `main`, `isDraft=true`.
- Provenance: PR #24 metadata and local fetched refs.

### OBS-LUX-002 — Latest main governance coordinates

- Subject: repository authority branch and governing files
- Repository/source: `mayf3/dsh-agent-core`
- Commit/artifact: `origin/main@82abe6489fc33f624aec74cea6cfb4f6d100f4b9`
- Environment: fetched Git object database
- Observed at: `2026-08-21T00:11:24Z`
- Method: read `AGENTS.md`, `.agents/README.md`, `.agents/local/README.md`,
  `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0`, `SPEC_FORMAT_V0`, AUTHOR mode, and current template.
- Result: current grammar requires typed stable primitives, explicit Evidence relations, stable Contract
  IDs, bidirectional Acceptance coverage, and truthful proposed lifecycle.
- Provenance: named files at the pinned main revision.

### OBS-LUX-003 — SDK Markdown primitive is built in

- Subject: reviewed SDK outbound Markdown surface
- Repository/source: `larksuite/channel-sdk-node` evidence adopted by accepted V2 and the Lark SDK investigation
- Commit/artifact: source `bd24f6742513769c80b5401b96ad464d74dd2027`; runtime
  `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`
- Environment: reviewed source/runtime evidence, not a live Feishu client
- Observed at: `2026-08-19`
- Method: inspect persisted review of `send({ markdown })`, `markdownToPost`, sender and splitter.
- Result: the SDK maps Markdown to a post containing a native `md` element, performs native chunking,
  and exposes an optional converter that Agent Core need not set.
- Provenance: Lark SDK investigation and accepted `AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2`.

### OBS-LUX-004 — SDK mention primitive accepts identity-bearing entries

- Subject: reviewed SDK outbound mention surface
- Repository/source: same reviewed SDK coordinates as `OBS-LUX-003`
- Commit/artifact: source `bd24f6742513769c80b5401b96ad464d74dd2027`
- Environment: reviewed source evidence
- Observed at: `2026-08-19`
- Method: inspect persisted review of `SendOptions.mentions`, mention composition, Markdown and text paths.
- Result: explicit openId-bearing entries render as Feishu `<at>` elements; name-based
  `resolveMentionsInText` is separate and can remain disabled.
- Provenance: accepted V2 dependency pin and persisted SDK investigation/review evidence.

### OBS-LUX-005 — SDK owns target-revoked, format and transport policies

- Subject: reviewed SDK outbound failure pipeline
- Repository/source: same reviewed SDK coordinates as `OBS-LUX-003`
- Commit/artifact: source `bd24f6742513769c80b5401b96ad464d74dd2027`; runtime
  `ab028f9dbcc09effbdfa4c9885cdcc1f5ecc623f`
- Environment: reviewed source/runtime evidence
- Observed at: `2026-08-20`
- Method: inspect persisted review of `sender.ts`, `retry.ts`, and `errors.ts`.
- Result: target-revoked can remove `replyTo` and send at same-chat top level; format error has one logical
  Markdown-to-text fallback; `rate_limited` and `unknown` use bounded attempts with `maxAttempts=3`;
  permission denied is non-fallback fail-loud.
- Provenance: previous focused PR #24 rulings and accepted SDK evidence documents.

### OBS-LUX-006 — Router success and failure calls share one connector seam

- Subject: Agent Router outbound calls
- Repository/source: `mayf3/dsh-agent-core`
- Commit/artifact: PR #27 candidate `e20545eff93c0a40e48426a1f4d22c4fec2edb02`
- Environment: source tree only
- Observed at: `2026-08-21T00:11:24Z`
- Method: inspect `packages/agent-router/src/index.js` success and catch paths.
- Result: success and deterministic failure both call `feishu.reply`; only the success call site knows
  that Markdown and automatic-mention intents apply.
- Provenance: candidate source around the two `feishu.reply` calls.

### OBS-LUX-007 — ReplyTarget can mechanically carry sender.openId

- Subject: IngressEvent-to-ReplyTarget seam and proactive caller
- Repository/source: `mayf3/dsh-agent-core`
- Commit/artifact: PR #27 candidate `e20545eff93c0a40e48426a1f4d22c4fec2edb02`
- Environment: source tree only
- Observed at: `2026-08-21T00:11:24Z`
- Method: inspect connector `replyTargetFor(ev)`, `handle.reply(..., opts={})`, V2 IngressEvent parity,
  and scheduler literal ReplyTarget construction.
- Result: `replyTargetFor` receives the full event whose accepted ABI includes `sender.openId`; the
  connector reply seam already has opts; scheduler constructs a target without ingress sender identity.
- Provenance: connector core/index, scheduler-router source and accepted V2 Contract C.

### OBS-LUX-008 — Native client behavior needs real test-app evidence

- Subject: table rendering, clickable mention, notification, topic placement and revoked fallback
- Repository/source: Feishu real client behavior
- Commit/artifact: not yet executed for a future implementation commit
- Environment: dedicated test app required
- Observed at: `2026-08-21T00:11:24Z`
- Method: inventory outcomes dependent on a real Feishu service/client rather than source inspection.
- Result: these outcomes require executed test-app evidence; this Spec does not claim they already pass.
- Provenance: accepted V2 create-thread gate and prior PR #24 acceptance table.

### OBS-LUX-009 — PR #27 is candidate evidence, not current main state

- Subject: Phase A candidate and main ancestry
- Repository/source: GitHub PR #27 and fetched Git graph
- Commit/artifact: PR #27 `e20545eff93c0a40e48426a1f4d22c4fec2edb02`; main
  `82abe6489fc33f624aec74cea6cfb4f6d100f4b9`
- Environment: GitHub metadata and local Git ancestry check
- Observed at: `2026-08-21T00:11:24Z`
- Method: query PR #27 and run ancestry checks for PR #27 and historical `cce18f3`.
- Result: PR #27 is open Draft; neither candidate head is a main ancestor.
- Provenance: PR #27 metadata and `git merge-base --is-ancestor` exit status `1`.

## 6. Claims and assumptions

### CLM-LUX-001 — Proposed Draft status carries no implementation authority

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUX-001`
- Contradicted by evidence: none known
- Uncertainty: none for the pinned metadata and grammar.

### CLM-LUX-002 — SDK-native Markdown is the minimal single rendering authority

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUX-002`
- Contradicted by evidence: none known
- Uncertainty: native GFM table behavior remains a test-app gate.

### CLM-LUX-003 — sender.openId is sufficient for identity-safe automatic mention

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUX-003`
- Contradicted by evidence: none known
- Uncertainty: clickable mention and notification require real-client verification.

### CLM-LUX-004 — One Router success-call intent seam is necessary and sufficient

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUX-004`
- Contradicted by evidence: none known
- Uncertainty: future implementation must re-inventory the exact main-base seam.

### CLM-LUX-005 — Logical fallback and SDK transport attempts are distinct layers

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUX-005`
- Contradicted by evidence: none known
- Uncertainty: attempt counts must bind to the reviewed runtime in future evidence.

### CLM-LUX-006 — Visible exactly-once is not supportable for ambiguous unknown

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUX-005`, `EVD-LUX-009`
- Contradicted by evidence: none known
- Uncertainty: response loss cannot establish whether the service accepted a message.

### CLM-LUX-007 — Stable implementation readiness is a same-main-base property

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUX-008`
- Contradicted by evidence: none known
- Uncertainty: a fresh preflight must evaluate the future base.

### CLM-LUX-008 — Dedicated test-app evidence is necessary

- Support state: SUPPORTED
- Supported by evidence: `EVD-LUX-007`
- Contradicted by evidence: none known
- Uncertainty: test-app execution remains future implementation work.

### CLM-LUX-009 — Legacy zero-transport-retry and visible-exactly-once proposition

- Support state: OPEN_ASSUMPTION
- Supported by evidence: none
- Contradicted by evidence: `EVD-LUX-009`
- Uncertainty: this historical proposition is rejected by `DEC-LUX-005` and creates no normative TBD.

## 7. Evidence Relations

### EVD-LUX-001 — Lifecycle evidence supports proposed-only state

- Source observations: `OBS-LUX-001`, `OBS-LUX-002`
- Target: `CLM-LUX-001`, `STATE-LUX-001`
- Relation: SUPPORTS
- Bound coordinates: PR #24 `810eaab2a877a7313446a71f1b1f8c951e5e0920`, main
  `82abe6489fc33f624aec74cea6cfb4f6d100f4b9`, observed `2026-08-21T00:11:24Z`
- Strength/sufficiency: sufficient for observed lifecycle
- Limitations: future metadata must be re-queried.
- Provenance: GitHub metadata and current governance files.

### EVD-LUX-002 — SDK Markdown supports single-authority rendering

- Source observations: `OBS-LUX-003`
- Target: `CLM-LUX-002`
- Relation: SUPPORTS
- Bound coordinates: reviewed SDK source/runtime pins in `OBS-LUX-003`
- Strength/sufficiency: strong for primitive and ownership boundary
- Limitations: does not prove real-client table rendering.
- Provenance: persisted SDK investigation and accepted V2.

### EVD-LUX-003 — Mention and ingress evidence supports openId authority

- Source observations: `OBS-LUX-004`, `OBS-LUX-007`
- Target: `CLM-LUX-003`
- Relation: SUPPORTS
- Bound coordinates: reviewed SDK source pin and PR #27 candidate source
- Strength/sufficiency: sufficient for proposed identity dataflow
- Limitations: notification remains unexecuted.
- Provenance: accepted V2 parity and SDK mention evidence.

### EVD-LUX-004 — Shared reply seam supports D-U1

- Source observations: `OBS-LUX-006`, `OBS-LUX-007`
- Target: `CLM-LUX-004`
- Relation: SUPPORTS
- Bound coordinates: PR #27 candidate `e20545eff93c0a40e48426a1f4d22c4fec2edb02`
- Strength/sufficiency: sufficient to distinguish success without Router identity authority
- Limitations: candidate code must be rechecked on future main.
- Provenance: Router and connector source.

### EVD-LUX-005 — SDK failure pipeline supports layered retry semantics

- Source observations: `OBS-LUX-005`
- Target: `CLM-LUX-005`, `CLM-LUX-006`
- Relation: SUPPORTS
- Bound coordinates: reviewed SDK pins in `OBS-LUX-005`
- Strength/sufficiency: sufficient to freeze fallback versus transport ownership
- Limitations: runtime counts require future executed evidence.
- Provenance: SDK review and focused Owner rulings.

### EVD-LUX-006 — Candidate source supports seam State

- Source observations: `OBS-LUX-006`, `OBS-LUX-007`
- Target: `STATE-LUX-003`
- Relation: SUPPORTS
- Bound coordinates: PR #27 candidate `e20545eff93c0a40e48426a1f4d22c4fec2edb02`
- Strength/sufficiency: strong for that source tree
- Limitations: does not establish main or production state.
- Provenance: exact source reads.

### EVD-LUX-007 — Native outcomes support test-app necessity

- Source observations: `OBS-LUX-008`
- Target: `CLM-LUX-008`
- Relation: SUPPORTS
- Bound coordinates: this proposed Spec and accepted V2 precedent
- Strength/sufficiency: sufficient to require, not satisfy, future gates
- Limitations: a test definition is not runtime Evidence.
- Provenance: acceptance inventory and accepted V2 gate.

### EVD-LUX-008 — Main/candidate coordinates support stable precondition

- Source observations: `OBS-LUX-002`, `OBS-LUX-009`
- Target: `CLM-LUX-007`, `STATE-LUX-002`
- Relation: SUPPORTS
- Bound coordinates: main `82abe6489fc33f624aec74cea6cfb4f6d100f4b9`, PR #27 `e20545eff93c0a40e48426a1f4d22c4fec2edb02`
- Strength/sufficiency: sufficient to show PR identity is not stable authority
- Limitations: future implementation readiness is unevaluated.
- Provenance: metadata, ancestry and lifecycle rules.

### EVD-LUX-009 — Bounded retry contradicts the legacy absolute proposition

- Source observations: `OBS-LUX-005`
- Target: `CLM-LUX-009`
- Relation: CONTRADICTS
- Bound coordinates: reviewed SDK pins in `OBS-LUX-005`
- Strength/sufficiency: sufficient to reject zero retry and visible exactly-once claims
- Limitations: cannot reveal service-side result after response loss.
- Provenance: SDK retry/error evidence and Owner ruling.

### Evidence relation index

| Evidence | Source | Relation | Target |
|---|---|---|---|
| `EVD-LUX-001` | `OBS-LUX-001`, `OBS-LUX-002` | SUPPORTS | `CLM-LUX-001`, `STATE-LUX-001` |
| `EVD-LUX-002` | `OBS-LUX-003` | SUPPORTS | `CLM-LUX-002` |
| `EVD-LUX-003` | `OBS-LUX-004`, `OBS-LUX-007` | SUPPORTS | `CLM-LUX-003` |
| `EVD-LUX-004` | `OBS-LUX-006`, `OBS-LUX-007` | SUPPORTS | `CLM-LUX-004` |
| `EVD-LUX-005` | `OBS-LUX-005` | SUPPORTS | `CLM-LUX-005`, `CLM-LUX-006` |
| `EVD-LUX-006` | `OBS-LUX-006`, `OBS-LUX-007` | SUPPORTS | `STATE-LUX-003` |
| `EVD-LUX-007` | `OBS-LUX-008` | SUPPORTS | `CLM-LUX-008` |
| `EVD-LUX-008` | `OBS-LUX-002`, `OBS-LUX-009` | SUPPORTS | `CLM-LUX-007`, `STATE-LUX-002` |
| `EVD-LUX-009` | `OBS-LUX-005` | CONTRADICTS | `CLM-LUX-009` |

## 8. Decisions

### DEC-LUX-001 — Activate only Markdown and triggering-sender mention

- Decision owner: `mayf3`
- Decision: first-round UX contains exactly the two outcomes in §2.
- Rejected alternatives: `ALT-LUX-008`
- Reason: preserve Phase B backlog and Phase A boundary.
- Owner decision remaining: NONE

### DEC-LUX-002 — Use SDK-native rendering and mention primitives

- Decision owner: `mayf3`
- Decision: SDK built-ins are the single rendering, mention, fallback and retry authority.
- Rejected alternatives: `ALT-LUX-001`, `ALT-LUX-004`
- Reason: avoid a second renderer, transport or identity resolver.
- Owner decision remaining: NONE

### DEC-LUX-003 — Identity authority is IngressEvent.sender.openId

- Decision owner: `mayf3`
- Decision: connector projects only valid `sender.openId` into ReplyTarget mention context.
- Rejected alternatives: `ALT-LUX-002`, `ALT-LUX-004`
- Reason: keep identity out of Router and avoid name-derived impersonation.
- Owner decision remaining: NONE

### DEC-LUX-004 — D-U1 approves one minimal Router success seam

- Decision owner: `mayf3`
- Decision: `D-U1 = APPROVED`; only the successful-reply call may pass rendering and
  `autoMentionTriggerSender` intents, never identity.
- Rejected alternatives: `ALT-LUX-002`, `ALT-LUX-003`
- Reason: success/failure meaning exists only at the Router call site.
- Owner decision remaining: NONE

### DEC-LUX-005 — Accept logical fallbacks and bounded transport retry

- Decision owner: `mayf3`
- Decision: one logical target-revoked fallback and one logical format fallback coexist with SDK-owned
  attempts bounded by `maxAttempts=3`; visible exactly-once is not claimed.
- Rejected alternatives: `ALT-LUX-005`, `ALT-LUX-006`
- Reason: preserve reviewed SDK behavior and truthful unknown outcomes.
- Owner decision remaining: NONE

### DEC-LUX-006 — Preserve excluded callers

- Decision owner: `mayf3`
- Decision: failure, unbound, startup/configuration and scheduler/proactive paths remain plain text/no mention.
- Rejected alternatives: `ALT-LUX-003`, `ALT-LUX-008`
- Reason: UX activation is success-reply-only.
- Owner decision remaining: NONE

### DEC-LUX-007 — Gate implementation on same-main-base content

- Decision owner: `mayf3`
- Decision: implementation starts only from a main descendant containing accepted exact UX content and
  Phase A foundation implementation on that same base.
- Rejected alternatives: `ALT-LUX-007`
- Reason: PR identity is not durable repository authority.
- Owner decision remaining: NONE

### DEC-LUX-008 — Require dedicated test-app verification

- Decision owner: `mayf3`
- Decision: real-client rendering, mention, notification, topic and failure cases are mandatory.
- Rejected alternatives: unit/mock-only acceptance.
- Reason: source/test definitions do not establish native behavior.
- Owner decision remaining: NONE

## 9. Alternatives

### ALT-LUX-001 — Custom converter, raw client or direct node SDK

- Disposition: rejected
- Reason: creates a second rendering/transport authority.
- Evidence/Claims considered: `CLM-LUX-002`
- What would reopen: new independently governed authority.

### ALT-LUX-002 — Router passes identity or arbitrary mention targets

- Disposition: rejected
- Reason: expands Router authority and permits identity injection.
- Evidence/Claims considered: `CLM-LUX-003`, `CLM-LUX-004`
- What would reopen: new Owner decision and superseding authority.

### ALT-LUX-003 — Connector globally defaults automatic mention

- Disposition: rejected
- Reason: default-on mentions failures; default-off cannot activate successes.
- Evidence/Claims considered: `CLM-LUX-004`
- What would reopen: none within this scope.

### ALT-LUX-004 — Resolve plaintext names or roster identities

- Disposition: rejected
- Reason: names are not trusted identity authority.
- Evidence/Claims considered: `CLM-LUX-003`
- What would reopen: separately governed identity product.

### ALT-LUX-005 — Connector retry, second fallback or replay

- Disposition: rejected
- Reason: duplicates SDK ownership and adds delivery attempts.
- Evidence/Claims considered: `CLM-LUX-005`, `CLM-LUX-006`
- What would reopen: new idempotency authority with service evidence.

### ALT-LUX-006 — Claim visible exactly-once

- Disposition: rejected
- Reason: ambiguous unknown cannot prove remote acceptance.
- Evidence/Claims considered: `CLM-LUX-006`, `CLM-LUX-009`
- What would reopen: service-supported idempotency/result protocol.

### ALT-LUX-007 — PR #23 or PR #27 as hard precondition

- Disposition: rejected
- Reason: PRs/candidates are evidence, not main authority.
- Evidence/Claims considered: `CLM-LUX-007`
- What would reopen: never; stable condition is content on main.

### ALT-LUX-008 — Expand to other Phase B/proactive UX

- Disposition: rejected
- Reason: exceeds frozen scope and changes product semantics.
- Evidence/Claims considered: `CLM-LUX-001`
- What would reopen: new or superseding Spec.

## 10. Contracts

### CTR-MARKDOWN-001 — Successful Agent replies use SDK-native Markdown

The Feishu Agent successful-reply path MUST call the SDK with Markdown intent. Headings, emphasis, lists,
quotes, inline/fenced code, links, simple tables and mixed Chinese/English MUST remain eligible for native
rendering. This Contract MUST NOT apply to excluded receipt/proactive paths.

### CTR-MARKDOWN-HEADING-001 — All six Markdown heading levels remain distinct

The SDK-native Markdown path MUST preserve and render every heading level from `# Heading 1` through
`###### Heading 6`. H1, H2, H3, H4, H5 and H6 MUST each remain recognizable as their corresponding
heading level; the connector MUST NOT flatten them into one level or plain body text.

### CTR-MARKDOWN-NESTED-LIST-001 — One nested list level is mandatory

`NESTED_LIST_DEPTH_REQUIRED = 1`. The SDK-native Markdown path MUST preserve one nested level for both
unordered and ordered lists. Parent/child hierarchy, item order and item text MUST NOT be flattened,
reordered or lost.

### CTR-MARKDOWN-CODE-LANGUAGE-001 — Fenced-code language tags are preserved

Fenced code with an explicit language tag, including a `python` fence, MUST preserve the opening and
closing fences, the language tag and all code content. SDK-native long-message splitting MUST close and
reopen a split fence without dropping or changing its language tag.

### CTR-MARKDOWN-LINK-001 — Markdown link URLs are byte-stable

`LINK_URL_PRESERVATION = BYTE_STABLE`. The Markdown link display text and exact input URL MUST be
preserved through Agent Core and the SDK send input. Query parameters, fragments and percent encoding
MUST NOT be lost, rewritten, decoded/re-encoded a second time, or replaced by another redirect URL.
Feishu client-side click handling is outside this byte-stability obligation.

### CTR-MARKDOWN-002 — SDK is the single rendering authority

Agent Core MUST leave `config.markdownConverter` unset and MUST NOT add a custom converter, raw client,
direct node SDK fallback, streaming card, or second outbound transport. Native table failure MUST stop for
Owner review and MUST NOT authorize a local converter.

### CTR-MARKDOWN-003 — SDK-native long-content fidelity

The connector MUST retain SDK chunk limit `3500` and native splitting. In-limit content MUST remain one
message; over-limit content MUST be complete, ordered and code-fence-safe, including fence close/reopen,
language-tag and link preservation. Mentions MUST follow native first-chunk-only behavior. Normal
continuations remain anchored; revoked targets use
`CTR-TARGET-REVOKED-001`.

### CTR-MARKDOWN-LONG-TABLE-001 — Long-message fidelity includes a simple table

The greater-than-3500-character Markdown path MUST include and preserve at least one simple table together
with a language-tagged fenced-code block, a byte-stable link and the first-chunk automatic mention.
Across all chunks, table content, code, link, mention placement and source order MUST remain complete with
no content loss.

### CTR-AUTO-MENTION-001 — Group/topic success mentions triggering sender

When intent requests mention, target is group/thread, and valid triggering sender openId exists, connector
MUST create one native mention of that sender. The mention MUST be clickable and the mentioned user MUST
receive the Feishu-native notification in both group and topic test-app cases. Failure of native
notification is a stop condition requiring Owner disposition; it MUST NOT degrade to plain `@name` text.

### CTR-AUTO-MENTION-CODE-FENCE-001 — Automatic mention stays outside code fences

The generated mention token MUST be placed outside every fenced-code block, MUST NOT alter code content,
and MUST remain outside code after long-message splitting. Automatic mention remains first-chunk-only.

### CTR-AUTO-MENTION-NOTIFICATION-001 — Native notification is mandatory

For a valid `IngressEvent.sender.openId`, group and topic automatic mentions MUST be real clickable Feishu
mentions and MUST notify the mentioned user through the native client. If a trusted openId is missing or
invalid, the connector MUST create no mention and MUST NOT fabricate a name-based replacement.

### CTR-TOPIC-CONTINUITY-001 — Subsequent topic ingress preserves conversation identity

After the bot replies inside a topic, a user's next message in that same topic MUST normalize to the
correct `threadId`; its `conversationId` MUST remain `chatId:topic:threadId`, MUST resolve the same
prebound Binding, and MUST NOT degrade to the containing group conversation.

### CTR-AUTO-MENTION-002 — P2P and missing identity never fabricate mention

P2P MUST NOT auto-mention. A valid triggering identity MUST match
`^(?:ou_|on_)[A-Za-z0-9_-]+$`; missing/invalid `sender.openId` MUST yield no mention without name
substitution, roster lookup, inferred identity or body mutation.

### CTR-AUTO-MENTION-003 — Mention identity is openId only

`IngressEvent.sender.openId` is the sole identity authority. Connector MAY mechanically carry it in
ReplyTarget context. It MUST NOT carry sender name/arbitrary targets and MUST keep
`resolveMentionsInText` disabled so model `@name` remains text.

### CTR-ROUTER-INTENT-001 — One success call passes UX intent only

The only allowed Router code change is the Agent successful-reply call in
`packages/agent-router/src/index.js`, adding intent equivalent to
`ux: { rendering: 'markdown', autoMentionTriggerSender: true }`.

### CTR-ROUTER-INTENT-002 — Router does not own identity

Router MUST NOT pass openId, sender name, mention identity or targets. Connector ReplyTarget context
MUST derive identity mechanically from `IngressEvent.sender.openId`.

### CTR-ROUTER-INTENT-003 — Failure call remains byte-preserved

Router deterministic failure-receipt call and every other Router file MUST remain byte-preserved.
`ROUTER_AUTHORITY_CHANGE` and `ROUTER_PRODUCT_ROUTING_CHANGE` are `NONE`.

### CTR-RECEIPT-001 — Excluded callers remain plain text/no mention

Router failure receipt, unbound `INGRESS_GATE_REJECTED_REPLY`, startup/configuration failures,
scheduler delivery and proactive notification MUST remain plain text, MUST NOT auto-mention, and MUST
retain existing call sites without UX opts.

### CTR-TARGET-REVOKED-001 — One logical same-chat top-level fallback

When original reply target is revoked/deleted/unavailable and SDK classifies `target_revoked`, SDK MUST
perform exactly one logical fallback: remove `replyTo` and send the same Agent answer at same-chat top
level. Each attempt MUST preserve chat, content, rendering and generated mentions. Cross-chat is forbidden.
Thread/reply anchor preservation is not guaranteed because the anchor is unavailable.

### CTR-TARGET-REVOKED-002 — Connector adds no second fallback

Connector MUST NOT retry, add another target-revoked fallback, use raw/direct SDK, or automatically
replay. Failed SDK fallback MUST fail loud subject only to `CTR-TRANSPORT-RETRY-001`.

### CTR-TRANSPORT-RETRY-001 — SDK owns bounded transport retry

Reviewed SDK MAY retry `rate_limited` and `unknown`. Total transport attempts per send leg MUST be
bounded by `maxAttempts=3`; same-chat/content/rendering/mention preservation applies per attempt.
Connector-owned retry is `NONE`.

### CTR-TRANSPORT-RETRY-002 — Exhaustion and ambiguity are truthful

After attempts exhaust, operation MUST fail loud; connector retry and automatic replay MUST be zero.
Ambiguous unknown MUST end as `OUTCOME_UNKNOWN`. Visible exactly-once is `NOT_CLAIMED` where remote
acceptance cannot be proven.

### CTR-PERMISSION-ERROR-001 — Permission denied fails loud

`permission_denied` MUST fail loud and MUST NOT remove `replyTo`, switch top-level, invoke format fallback,
or be masked by connector.

### CTR-FORMAT-FALLBACK-001 — One logical Markdown-to-text fallback

SDK `format_error` MUST invoke exactly one logical Markdown-to-text fallback while preserving the same
Agent answer and already-generated outbound mentions; Markdown source characters in plain text are
acceptable. Exactly-once applies only to the logical transition; transport attempts follow
`CTR-TRANSPORT-RETRY-001`. Connector fallback/retry/replay MUST be zero.

### CTR-PHASE-A-PRECONDITION-001 — Same-main-base precondition

Implementation MUST start only from a main descendant containing this Spec's accepted exact content and
Phase A foundation implementation on that same base. PR number, branch, historical head or unmerged
accepted-looking document MUST NOT satisfy it. Fresh preflight MUST re-inventory callers and D-U1 seam.

### CTR-BOUNDARY-001 — Implementation scope remains narrow

After all authority gates, implementation MAY change `packages/feishu-connector/**`, direct tests, and
only the `CTR-ROUTER-INTENT-001` Router call. It MUST NOT change AgentProcess, Binding, PREBOUND_ONLY,
workspace/session, scheduler-router, broker, product API, notification ingress, Kernel, dependencies or
other Phase B behavior.

### CTR-TEST-APP-001 — Real-client gates precede production canary

Every mandatory test-app case in §13 MUST pass against pinned implementation/runtime before canary. Unit
or mock evidence MUST NOT substitute for table, mention, notification, topic, revoked, permission, format
or exhausted-attempt behavior.

### CTR-ROLLBACK-001 — Restore previous verified commit

Implementation MUST add no persistent product state or Binding migration. Rollback MUST restore the
previous verified deployment commit; no dual flag/data migration is authorized.

## 11. Acceptance Criteria

### ACC-MARKDOWN-001 — Native Markdown surface

- Contracts: `CTR-MARKDOWN-001`, `CTR-MARKDOWN-002`
- Method: send-plan tests and real-app heading/list/quote/emphasis/code/link checks.
- Environment: pinned implementation/runtime and real Feishu group.
- Required evidence: commit, SDK coordinate, message IDs and client captures.
- Expected result: native rendering; no custom/raw/direct transport.
- Failure condition: required raw Markdown or second renderer/transport.

### ACC-MARKDOWN-HEADINGS-H1-H6 — Six-level heading fidelity

- Contracts: `CTR-MARKDOWN-001`, `CTR-MARKDOWN-HEADING-001`, `CTR-TEST-APP-001`
- Method: send one document containing `#` through `######` headings with distinct labels.
- Environment: dedicated test app and real Feishu client.
- Required evidence: exact input, message ID and capture showing all six labeled levels.
- Expected result: H1–H6 each render as the corresponding distinct heading level.
- Failure condition: any level is missing, flattened, reordered or rendered as ordinary body text.

### ACC-MARKDOWN-NESTED-LIST-001 — One-level ordered and unordered nesting

- Contracts: `CTR-MARKDOWN-001`, `CTR-MARKDOWN-NESTED-LIST-001`, `CTR-TEST-APP-001`
- Method: send unordered and ordered lists, each with one nested child level and unique item text.
- Environment: dedicated test app and real Feishu client.
- Required evidence: exact input, message ID and capture showing parent/child hierarchy and order.
- Expected result: `NESTED_LIST_DEPTH_REQUIRED = 1`; both list kinds preserve hierarchy, order and text.
- Failure condition: flattening, reordering, missing child/item text or loss of ordered-list numbering.

### ACC-MARKDOWN-CODE-LANGUAGE-001 — Language-tagged fenced code

- Contracts: `CTR-MARKDOWN-CODE-LANGUAGE-001`, `CTR-MARKDOWN-003`, `CTR-TEST-APP-001`
- Method: send a normal `python` fenced block containing `print("hello")`, then repeat with the fence
  crossing the SDK long-message split boundary.
- Environment: dedicated test app with observable input/chunks.
- Required evidence: exact input, chunk payloads/order, message IDs and client captures.
- Expected result: fences, `python` tag and code bytes remain present; split fences close/reopen safely.
- Failure condition: untagged fence, changed/lost code, lost language tag or unsafe chunk boundary.

### ACC-MARKDOWN-LINK-BYTE-STABLE — Link text and URL preservation

- Contracts: `CTR-MARKDOWN-LINK-001`, `CTR-MARKDOWN-003`, `CTR-TEST-APP-001`
- Method: send a link whose URL contains query parameters, fragment and percent encoding in both normal
  and long-message inputs.
- Environment: send-plan integration evidence plus dedicated test app.
- Required evidence: exact source URL, SDK input/chunks, message ID, clickable-link capture and destination observation.
- Expected result: display text is preserved; Agent Core/SDK input URL is byte-identical, including query,
  fragment and percent encoding; no replacement redirect URL is introduced.
- Failure condition: any input rewrite, parameter/fragment loss, double encoding or redirect substitution.

### ACC-MARKDOWN-TABLE — Native simple-table gate

- Contracts: `CTR-MARKDOWN-001`, `CTR-MARKDOWN-002`, `CTR-TEST-APP-001`
- Method: send GFM pipe table via real SDK and inspect client.
- Environment: dedicated test app.
- Required evidence: coordinates, message ID and capture.
- Expected result: simple table renders as table.
- Failure condition: non-table rendering stops for Owner review; no local fallback.

### ACC-MARKDOWN-LONG-001 — Long-content fidelity

- Contracts: `CTR-MARKDOWN-003`
- Method: send in-limit and >3500 mixed Markdown.
- Environment: integration and dedicated test app.
- Required evidence: ordered IDs, reconstruction and captures.
- Expected result: one in-limit message; complete ordered safe chunks; mention first chunk only.
- Failure condition: truncation, reorder, broken fence/link, duplicate mention or wrong conversation.

### ACC-MARKDOWN-LONG-WITH-TABLE-001 — Long mixed-content closure

- Contracts: `CTR-MARKDOWN-003`, `CTR-MARKDOWN-LONG-TABLE-001`, `CTR-MARKDOWN-CODE-LANGUAGE-001`,
  `CTR-MARKDOWN-LINK-001`, `CTR-AUTO-MENTION-CODE-FENCE-001`, `CTR-TEST-APP-001`
- Method: send a greater-than-3500-character group reply containing one simple table, a language-tagged
  code fence, a query/fragment/percent-encoded link and automatic triggering-sender mention.
- Environment: dedicated test app with SDK chunk observation and real Feishu clients.
- Required evidence: exact source, ordered chunk/message IDs, reconstructed content, mention position,
  table/code/link captures and recipient observation.
- Expected result: table remains complete; fence/tag/link survive; mention is outside code and only first
  chunk; chunk order matches source; no content is lost.
- Failure condition: table omitted/broken, content loss/reorder, code/link mutation or misplaced/duplicate mention.

### ACC-GROUP-AUTO-MENTION — Group triggering-sender mention

- Contracts: `CTR-AUTO-MENTION-001`, `CTR-AUTO-MENTION-003`, `CTR-ROUTER-INTENT-001`, `CTR-ROUTER-INTENT-002`
- Method: human triggers group turn; inspect sender/recipient clients.
- Environment: dedicated test app with two users.
- Required evidence: ingress openId, outbound ID, clickable mention and notification capture.
- Expected result: first chunk mentions only triggering sender with native notification.
- Failure condition: missing/wrong/non-clickable/name-derived/extra mention.

### ACC-MENTION-OUTSIDE-CODE-FENCE-001 — Mention placement is code-safe

- Contracts: `CTR-AUTO-MENTION-CODE-FENCE-001`, `CTR-MARKDOWN-003`, `CTR-TEST-APP-001`
- Method: send normal and long group/topic replies whose content begins with and spans fenced code.
- Environment: dedicated test app with outbound chunk inspection.
- Required evidence: exact source, chunk payloads, mention position and rendered code capture.
- Expected result: real mention is outside all fences, first chunk only; code bytes are unchanged.
- Failure condition: mention inside code, code mutation, mention after first chunk or duplicate mention.

### ACC-NATIVE-MENTION-NOTIFICATION-001 — Group/topic native notification

- Contracts: `CTR-AUTO-MENTION-001`, `CTR-AUTO-MENTION-NOTIFICATION-001`,
  `CTR-AUTO-MENTION-002`, `CTR-AUTO-MENTION-003`, `CTR-TEST-APP-001`
- Method: execute separate group and topic turns from a real human account; repeat with missing/invalid openId.
- Environment: dedicated test app with the mentioned user's real Feishu client.
- Required evidence: ingress openId, group/topic message IDs, clickable mention captures, recipient native
  notification evidence and missing-ID outbound payload.
- Expected result: both valid-ID cases notify the correct user with a clickable mention; missing/invalid ID
  emits no mention and no plain-name substitute.
- Failure condition: either native notification absent, mention non-clickable/wrong, or identity fabricated;
  failure requires stop and `OWNER_DECISION_REQUIRED` rather than text degradation.

### ACC-TOPIC-AUTO-MENTION — Topic triggering-sender mention

- Contracts: `CTR-AUTO-MENTION-001`, `CTR-AUTO-MENTION-003`, `CTR-ROUTER-INTENT-001`, `CTR-TARGET-REVOKED-001`
- Method: normal topic turn, then separate revoked-target case.
- Environment: dedicated test app.
- Required evidence: thread/root/chat/message IDs, mention and notification capture.
- Expected result: normal reply/mention stays topic; revoked fallback stays same chat with anchor exception.
- Failure condition: normal escape, wrong mention or cross-chat fallback.

### ACC-TOPIC-INGRESS-CONTINUITY-001 — Subsequent topic message keeps Binding identity

- Contracts: `CTR-TOPIC-CONTINUITY-001`, `CTR-TEST-APP-001`
- Method: bot replies in a topic; the user sends a subsequent message in that topic; observe normalization
  and Binding resolution.
- Environment: dedicated test app with a prebound topic conversation.
- Required evidence: chatId, expected/actual threadId and conversationId, ingress record, Binding key/row
  lookup, Router target and client captures.
- Expected result: bot reply stays topic; subsequent ingress has correct threadId and
  `conversationId = chatId:topic:threadId`, resolves the same prebound Binding and does not become group.
- Failure condition: missing/wrong threadId, group conversationId, different Binding or main-chat escape.

### ACC-P2P-NO-MENTION — P2P structural exclusion

- Contracts: `CTR-AUTO-MENTION-002`
- Method: P2P with deliberately true UX intent.
- Environment: seam test and dedicated app.
- Required evidence: payload and capture.
- Expected result: no `<at>`/mention.
- Failure condition: any auto-mention.

### ACC-IDENTITY-OPENID — Identity and missing-ID behavior

- Contracts: `CTR-AUTO-MENTION-002`, `CTR-AUTO-MENTION-003`, `CTR-ROUTER-INTENT-002`
- Method: renamed account, absent/invalid openId, model `@name` text.
- Environment: integration and dedicated app.
- Required evidence: ingress fields, ReplyTarget, mention entries and capture.
- Expected result: valid openId selects correct user; invalid ID no mention; name stays text.
- Failure condition: name/roster/self-claim inference, fabricated ID or Router identity.

### ACC-FAILURE-RECEIPT-NO-MENTION — Router failure remains plain text

- Contracts: `CTR-ROUTER-INTENT-003`, `CTR-RECEIPT-001`
- Method: force deterministic delivery failure; inspect call and receipt.
- Environment: integration and dedicated app.
- Required evidence: exact Router diff, connector input and capture.
- Expected result: unchanged call, plain text, no mention.
- Failure condition: UX opts, Markdown or mention.

### ACC-UNBOUND-PROACTIVE-NO-MENTION — Other callers unchanged

- Contracts: `CTR-RECEIPT-001`, `CTR-BOUNDARY-001`
- Method: exercise unbound and scheduler/proactive; inspect diff/payload.
- Environment: unit/integration and receipt app case.
- Required evidence: call-site diff, inputs and capture.
- Expected result: plain text/no mention/no opts; call sites byte-preserved.
- Failure condition: changed caller, Markdown or mention.

### ACC-ROUTER-INTENT-001 — D-U1 minimal seam

- Contracts: `CTR-ROUTER-INTENT-001`, `CTR-ROUTER-INTENT-002`, `CTR-ROUTER-INTENT-003`, `CTR-BOUNDARY-001`
- Method: exact diff and seam tests.
- Environment: future main-descendant branch.
- Required evidence: file list, call arguments, identity-flow assertions.
- Expected result: one success call adds two intents; no identity; failure/other Router bytes unchanged.
- Failure condition: extra Router change or identity/target value.

### ACC-TARGET-REVOKED-SAME-CHAT — Revoked target fallback

- Contracts: `CTR-TARGET-REVOKED-001`, `CTR-TARGET-REVOKED-002`, `CTR-TRANSPORT-RETRY-001`, `CTR-TRANSPORT-RETRY-002`, `CTR-TEST-APP-001`
- Method: revoke original and execute normal, rate-limited and ambiguous variants.
- Environment: dedicated group/topic app with attempt visibility.
- Required evidence: chat IDs, replyTo absence, attempts, payload comparison, native mention/notification,
  connector counters and final error.
- Expected result: one logical same-chat top-level fallback; payload preserved per attempt; SDK <=3;
  connector fallback/retry/replay zero; unknown is `OUTCOME_UNKNOWN`.
- Failure condition: cross-chat, payload loss, connector resend, false exactly-once or hidden failure.

### ACC-SDK-ATTEMPTS-EXHAUSTED — Independent bounded-attempt gate

- Contracts: `CTR-TRANSPORT-RETRY-001`, `CTR-TRANSPORT-RETRY-002`, `CTR-TEST-APP-001`
- Method: independently force `rate_limited` and ambiguous `unknown` through reviewed runtime.
- Environment: dedicated test app, not embedded only in revoked happy path.
- Required evidence: exactly three SDK attempts per exhausted leg, connector counters, terminal class and replay audit.
- Expected result: attempts `3`, fail-loud, connector retry `0`, replay `0`; unknown `OUTCOME_UNKNOWN`.
- Failure condition: wrong/unbounded count, connector attempt, replay, swallowed error or exactly-once claim.

### ACC-PERMISSION-ERROR-001 — Permission denial does not degrade

- Contracts: `CTR-PERMISSION-ERROR-001`, `CTR-TEST-APP-001`
- Method: induce permission-denied.
- Environment: dedicated test app.
- Required evidence: attempt/fallback trace and observable error.
- Expected result: fail-loud without top-level/text degradation.
- Failure condition: fallback, masking or connector retry.

### ACC-FORMAT-FALLBACK-001 — One logical format fallback

- Contracts: `CTR-FORMAT-FALLBACK-001`, `CTR-TRANSPORT-RETRY-001`, `CTR-TEST-APP-001`
- Method: induce format error and separately observe retryable transport.
- Environment: dedicated app with attempt instrumentation.
- Required evidence: one Markdown-to-text transition, SDK trace and connector counters.
- Expected result: one logical transition; SDK policy per leg; connector retry/replay zero.
- Failure condition: second logical fallback, connector fallback or transport-count conflation.

### ACC-PHASE-A-PRECONDITION-001 — Same-main-base preflight

- Contracts: `CTR-PHASE-A-PRECONDITION-001`
- Method: fetch/pin future base; verify accepted blob, foundation files and callers.
- Environment: future implementation base from main.
- Required evidence: exact SHA, accepted blob, implementation paths and checks.
- Expected result: both conditions on one base and D-U1 seam intact.
- Failure condition: PR substituted for content, missing condition or seam drift.

### ACC-BOUNDARY-001 — File and persistent-state boundary

- Contracts: `CTR-BOUNDARY-001`, `CTR-ROLLBACK-001`
- Method: changed-file/diff and state/migration inventory.
- Environment: future implementation branch.
- Required evidence: files, dependency diff, migrations and rollback record.
- Expected result: authorized connector/tests and one Router call only; no state.
- Failure condition: forbidden path, dependency, migration or broader Router change.

### Contract coverage

| Contract | Acceptance coverage | Covered |
|---|---|---|
| `CTR-MARKDOWN-001` | `ACC-MARKDOWN-001`, `ACC-MARKDOWN-TABLE` | YES |
| `CTR-MARKDOWN-HEADING-001` | `ACC-MARKDOWN-HEADINGS-H1-H6` | YES |
| `CTR-MARKDOWN-NESTED-LIST-001` | `ACC-MARKDOWN-NESTED-LIST-001` | YES |
| `CTR-MARKDOWN-CODE-LANGUAGE-001` | `ACC-MARKDOWN-CODE-LANGUAGE-001`, `ACC-MARKDOWN-LONG-WITH-TABLE-001` | YES |
| `CTR-MARKDOWN-LINK-001` | `ACC-MARKDOWN-LINK-BYTE-STABLE`, `ACC-MARKDOWN-LONG-WITH-TABLE-001` | YES |
| `CTR-MARKDOWN-002` | `ACC-MARKDOWN-001`, `ACC-MARKDOWN-TABLE` | YES |
| `CTR-MARKDOWN-003` | `ACC-MARKDOWN-LONG-001` | YES |
| `CTR-MARKDOWN-LONG-TABLE-001` | `ACC-MARKDOWN-LONG-WITH-TABLE-001` | YES |
| `CTR-AUTO-MENTION-001` | `ACC-GROUP-AUTO-MENTION`, `ACC-TOPIC-AUTO-MENTION` | YES |
| `CTR-AUTO-MENTION-CODE-FENCE-001` | `ACC-MENTION-OUTSIDE-CODE-FENCE-001`, `ACC-MARKDOWN-LONG-WITH-TABLE-001` | YES |
| `CTR-AUTO-MENTION-NOTIFICATION-001` | `ACC-NATIVE-MENTION-NOTIFICATION-001` | YES |
| `CTR-AUTO-MENTION-002` | `ACC-P2P-NO-MENTION`, `ACC-IDENTITY-OPENID` | YES |
| `CTR-AUTO-MENTION-003` | group/topic/identity Acceptances | YES |
| `CTR-TOPIC-CONTINUITY-001` | `ACC-TOPIC-INGRESS-CONTINUITY-001` | YES |
| `CTR-ROUTER-INTENT-001` | group and Router Acceptances | YES |
| `CTR-ROUTER-INTENT-002` | group/identity/Router Acceptances | YES |
| `CTR-ROUTER-INTENT-003` | failure and Router Acceptances | YES |
| `CTR-RECEIPT-001` | failure and unbound/proactive Acceptances | YES |
| `CTR-TARGET-REVOKED-001` | topic and revoked Acceptances | YES |
| `CTR-TARGET-REVOKED-002` | revoked Acceptance | YES |
| `CTR-TRANSPORT-RETRY-001` | revoked/exhausted/format Acceptances | YES |
| `CTR-TRANSPORT-RETRY-002` | revoked/exhausted Acceptances | YES |
| `CTR-PERMISSION-ERROR-001` | permission Acceptance | YES |
| `CTR-FORMAT-FALLBACK-001` | format Acceptance | YES |
| `CTR-PHASE-A-PRECONDITION-001` | Phase A precondition Acceptance | YES |
| `CTR-BOUNDARY-001` | Router/unbound/boundary Acceptances | YES |
| `CTR-TEST-APP-001` | dedicated app Acceptance items | YES |
| `CTR-ROLLBACK-001` | boundary Acceptance | YES |

## 12. Implementation Boundary

```text
FUTURE_ALLOWED_PATHS =
  packages/feishu-connector/**
  packages/feishu-connector/test/**
  packages/agent-router/src/index.js  # one successful-reply call only
FUTURE_FORBIDDEN_PATHS =
  packages/agent-router/** except that call
  packages/scheduler-router/**
  AgentProcess Binding PREBOUND_ONLY Workspace Session Kernel ingress-gate
  dependency coordinates production configuration
CURRENT_AUTHORING_ROUND = SPEC_ONLY
PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
TEST_APP_EXECUTION = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
MERGE = NONE
```

Implementation MUST stop for independent Owner/review disposition if SDK public surfaces cannot satisfy a
Contract, table rendering fails, either future-base precondition is absent, or the seam has drifted.

## 13. Test-App Gates

These are mandatory definitions, not executed Observations or conformance Evidence in this proposed Spec.

| Case | Acceptance | Required live result |
|---|---|---|
| `TEST-LUX-MD-SURFACE` | `ACC-MARKDOWN-001` | heading/list/quote/emphasis/code/link native |
| `TEST-LUX-MD-HEADINGS-H1-H6` | `ACC-MARKDOWN-HEADINGS-H1-H6` | H1, H2, H3, H4, H5 and H6 all render distinctly |
| `TEST-LUX-MD-NESTED-LISTS` | `ACC-MARKDOWN-NESTED-LIST-001` | ordered/unordered depth 1 hierarchy, order and text preserved |
| `TEST-LUX-MD-CODE-LANGUAGE` | `ACC-MARKDOWN-CODE-LANGUAGE-001` | `python` fence/tag/code preserved normally and across split |
| `TEST-LUX-MD-LINK-BYTE-STABLE` | `ACC-MARKDOWN-LINK-BYTE-STABLE` | display text and exact query/fragment/percent-encoded URL preserved |
| `TEST-LUX-MD-TABLE` | `ACC-MARKDOWN-TABLE` | GFM table renders as table; otherwise stop |
| `TEST-LUX-MD-LONG` | `ACC-MARKDOWN-LONG-001` | complete ordered safe chunks; mention first only |
| `TEST-LUX-MD-LONG-WITH-TABLE` | `ACC-MARKDOWN-LONG-WITH-TABLE-001` | >3500 input includes intact table/code/link/mention in source order with no loss |
| `TEST-LUX-GROUP-MENTION` | `ACC-GROUP-AUTO-MENTION` | clickable sender mention plus notification |
| `TEST-LUX-TOPIC-MENTION` | `ACC-TOPIC-AUTO-MENTION` | normal reply/mention stays topic |
| `TEST-LUX-MENTION-OUTSIDE-CODE` | `ACC-MENTION-OUTSIDE-CODE-FENCE-001` | mention remains outside code, first chunk only, code unchanged |
| `TEST-LUX-NATIVE-NOTIFICATION` | `ACC-NATIVE-MENTION-NOTIFICATION-001` | group and topic recipients receive native notification; missing ID creates none |
| `TEST-LUX-TOPIC-CONTINUITY` | `ACC-TOPIC-INGRESS-CONTINUITY-001` | subsequent ingress keeps threadId, topic conversationId and same Binding |
| `TEST-LUX-P2P-NO-MENTION` | `ACC-P2P-NO-MENTION` | no mention even with intent |
| `TEST-LUX-IDENTITY` | `ACC-IDENTITY-OPENID` | renamed user works by openId; invalid ID no mention |
| `TEST-LUX-RECEIPTS` | receipt Acceptances | plain text, no mention |
| `TEST-LUX-TARGET-REVOKED` | `ACC-TARGET-REVOKED-SAME-CHAT` | one logical same-chat fallback; no connector resend |
| `TEST-LUX-SDK-ATTEMPTS-EXHAUSTED` | `ACC-SDK-ATTEMPTS-EXHAUSTED` | independent rate-limited/unknown; 3 SDK attempts; fail-loud; connector/replay 0 |
| `TEST-LUX-PERMISSION` | `ACC-PERMISSION-ERROR-001` | fail-loud without top-level/text degradation |
| `TEST-LUX-FORMAT` | `ACC-FORMAT-FALLBACK-001` | one logical Markdown-to-text; transport SDK-owned |

All MUST pass before production canary. Ambiguous unknown remains `OUTCOME_UNKNOWN` and MUST NOT become
a visible-exactly-once claim.

### Semantic closure matrix

| Audit omission | CTR | ACC | Test gate |
|---|---|---|---|
| H1–H6 headings | `CTR-MARKDOWN-HEADING-001` | `ACC-MARKDOWN-HEADINGS-H1-H6` | `TEST-LUX-MD-HEADINGS-H1-H6` |
| one-level nested lists | `CTR-MARKDOWN-NESTED-LIST-001` | `ACC-MARKDOWN-NESTED-LIST-001` | `TEST-LUX-MD-NESTED-LISTS` |
| language-tagged fence | `CTR-MARKDOWN-CODE-LANGUAGE-001` | `ACC-MARKDOWN-CODE-LANGUAGE-001` | `TEST-LUX-MD-CODE-LANGUAGE` |
| byte-stable link URL | `CTR-MARKDOWN-LINK-001` | `ACC-MARKDOWN-LINK-BYTE-STABLE` | `TEST-LUX-MD-LINK-BYTE-STABLE` |
| mention outside fence | `CTR-AUTO-MENTION-CODE-FENCE-001` | `ACC-MENTION-OUTSIDE-CODE-FENCE-001` | `TEST-LUX-MENTION-OUTSIDE-CODE` |
| mandatory native notification | `CTR-AUTO-MENTION-NOTIFICATION-001` | `ACC-NATIVE-MENTION-NOTIFICATION-001` | `TEST-LUX-NATIVE-NOTIFICATION` |
| long text with table | `CTR-MARKDOWN-LONG-TABLE-001` | `ACC-MARKDOWN-LONG-WITH-TABLE-001` | `TEST-LUX-MD-LONG-WITH-TABLE` |
| subsequent topic threadId | `CTR-TOPIC-CONTINUITY-001` | `ACC-TOPIC-INGRESS-CONTINUITY-001` | `TEST-LUX-TOPIC-CONTINUITY` |

```text
SEMANTIC_CLOSURE_MATRIX = 8/8
PRODUCT_SEMANTIC_CHANGE = NONE
```

## 14. Risks / Rollback

| Risk | Contract / gate |
|---|---|
| Native table failure | `CTR-MARKDOWN-002`, `ACC-MARKDOWN-TABLE`; stop |
| Mention escapes normal topic | `CTR-AUTO-MENTION-001`, topic Acceptance |
| Name becomes identity | `CTR-AUTO-MENTION-003`, identity Acceptance |
| Failure/proactive opted in | `CTR-RECEIPT-001`, receipt Acceptances |
| Logical fallback confused with attempts | format and retry Contracts |
| Revoked fallback crosses chat/duplicates | revoked Contracts/Acceptance |
| Ambiguous result reported exactly once | `CTR-TRANSPORT-RETRY-002` |
| Router authority expands | Router Contracts/Acceptance |
| PR identity substitutes for main | Phase A precondition Contract |

```text
MIGRATION = NONE
PERSISTENT_STATE_CHANGE = NONE
COMPATIBILITY = UNOPTED_CALLERS_REMAIN_BYTE_COMPATIBLE
ROLLBACK = RESTORE_PREVIOUS_VERIFIED_DEPLOYMENT_COMMIT
EMERGENCY_CONTAINMENT = DISABLE_OR_ROLL_BACK_UX_WITHOUT_DATA_MIGRATION
```

## 15. Semantic Migration Map

Old labels map to stable V0 primitives without changing meaning. Old IDs are historical aliases only.

| OLD_SECTION_OR_ID | NEW_STABLE_ID |
|---|---|
| `§0 Final Output` | `STATE-LUX-001`, `STATE-LUX-004`, `CLM-LUX-001` |
| `§0.1 Authority and Dependencies` | `STATE-LUX-002`, `CLM-LUX-001`, `CLM-LUX-007`, `DEC-LUX-007` |
| `§1 Problem and Positioning` | `OBS-LUX-003`, `OBS-LUX-006`, `DEC-LUX-001` |
| `§2 Frozen Owner Rulings` | `DEC-LUX-001`, `DEC-LUX-002`, `DEC-LUX-003`, `DEC-LUX-004`, `DEC-LUX-005`, `DEC-LUX-006`, `DEC-LUX-007`, `DEC-LUX-008` |
| `Contract U1 / §3` | `CTR-MARKDOWN-001`, `CTR-MARKDOWN-HEADING-001`, `CTR-MARKDOWN-NESTED-LIST-001`, `CTR-MARKDOWN-CODE-LANGUAGE-001`, `CTR-MARKDOWN-LINK-001`, `CTR-MARKDOWN-002`, `CTR-MARKDOWN-003`, `CTR-MARKDOWN-LONG-TABLE-001`, `CTR-TARGET-REVOKED-001`, `CTR-TARGET-REVOKED-002`, `CTR-TRANSPORT-RETRY-001`, `CTR-TRANSPORT-RETRY-002`, `CTR-PERMISSION-ERROR-001`, `CTR-FORMAT-FALLBACK-001` |
| `Contract U2 / §4` | `CTR-AUTO-MENTION-001`, `CTR-AUTO-MENTION-CODE-FENCE-001`, `CTR-AUTO-MENTION-NOTIFICATION-001`, `CTR-TOPIC-CONTINUITY-001`, `CTR-AUTO-MENTION-002`, `CTR-AUTO-MENTION-003`, `CTR-RECEIPT-001` |
| `§5 Reply Seam / D-U1` | `DEC-LUX-004`, `CTR-ROUTER-INTENT-001`, `CTR-ROUTER-INTENT-002`, `CTR-ROUTER-INTENT-003` |
| `§6 Implementation Scope` | `CTR-BOUNDARY-001`, `CTR-ROLLBACK-001` |
| `AC-MARKDOWN-HEADING` | `CTR-MARKDOWN-HEADING-001`, `ACC-MARKDOWN-HEADINGS-H1-H6` |
| `AC-MARKDOWN-LIST` | `CTR-MARKDOWN-NESTED-LIST-001`, `ACC-MARKDOWN-NESTED-LIST-001` |
| `AC-MARKDOWN-CODE-FENCE` | `CTR-MARKDOWN-CODE-LANGUAGE-001`, `ACC-MARKDOWN-CODE-LANGUAGE-001` |
| `AC-MARKDOWN-LINK` | `CTR-MARKDOWN-LINK-001`, `ACC-MARKDOWN-LINK-BYTE-STABLE` |
| `AC-MARKDOWN-TABLE` | `ACC-MARKDOWN-TABLE` |
| `AC-MARKDOWN-LONG-CHUNKING` | `CTR-MARKDOWN-003`, `CTR-MARKDOWN-LONG-TABLE-001`, `ACC-MARKDOWN-LONG-001`, `ACC-MARKDOWN-LONG-WITH-TABLE-001` |
| `AC-MARKDOWN-TEXT-FALLBACK` | `ACC-FORMAT-FALLBACK-001` |
| `AC-TARGET-REVOKED-SAME-CHAT-FALLBACK` | `ACC-TARGET-REVOKED-SAME-CHAT` |
| `AC-SDK-ATTEMPTS-EXHAUSTED` | `ACC-SDK-ATTEMPTS-EXHAUSTED` |
| `AC-GROUP-AUTO-MENTION-SENDER` | `CTR-AUTO-MENTION-CODE-FENCE-001`, `CTR-AUTO-MENTION-NOTIFICATION-001`, `ACC-GROUP-AUTO-MENTION`, `ACC-MENTION-OUTSIDE-CODE-FENCE-001`, `ACC-NATIVE-MENTION-NOTIFICATION-001` |
| `AC-TOPIC-AUTO-MENTION-SENDER` | `CTR-AUTO-MENTION-NOTIFICATION-001`, `CTR-TOPIC-CONTINUITY-001`, `ACC-TOPIC-AUTO-MENTION`, `ACC-NATIVE-MENTION-NOTIFICATION-001`, `ACC-TOPIC-INGRESS-CONTINUITY-001` |
| `AC-P2P-NO-MENTION` | `ACC-P2P-NO-MENTION` |
| `AC-UNBOUND-RECEIPT-NO-MENTION` | `ACC-UNBOUND-PROACTIVE-NO-MENTION` |
| `AC-FAILURE-RECEIPT-NO-MENTION` | `ACC-FAILURE-RECEIPT-NO-MENTION` |
| `AC-MISSING-SENDER-ID-NO-FABRICATED-MENTION` | `ACC-IDENTITY-OPENID` |
| `AC-MENTION-USES-OPEN-ID-NOT-NAME` | `ACC-IDENTITY-OPENID` |
| `AC-EXISTING-CALLERS-UNCHANGED` | `CTR-ROUTER-INTENT-003`, `CTR-RECEIPT-001`, `ACC-FAILURE-RECEIPT-NO-MENTION`, `ACC-UNBOUND-PROACTIVE-NO-MENTION` |
| `AC-SINGLE-RENDER-AUTHORITY` | `CTR-MARKDOWN-002`, `ACC-MARKDOWN-001`, `ACC-MARKDOWN-TABLE` |
| `AC-ROUTER-DIFF-MINIMAL` | `ACC-ROUTER-INTENT-001` |
| `AC-NO-NEW-PERSISTENT-STATE` | `ACC-BOUNDARY-001` |
| `T-MD-HEADING` | `CTR-MARKDOWN-HEADING-001`, `ACC-MARKDOWN-HEADINGS-H1-H6` |
| `T-MD-CODE` | `CTR-MARKDOWN-CODE-LANGUAGE-001`, `ACC-MARKDOWN-CODE-LANGUAGE-001` |
| `T-MD-LINK` | `CTR-MARKDOWN-LINK-001`, `ACC-MARKDOWN-LINK-BYTE-STABLE` |
| `T-MD-TABLE` | `ACC-MARKDOWN-TABLE` |
| `T-MD-LONG` | `CTR-MARKDOWN-LONG-TABLE-001`, `ACC-MARKDOWN-LONG-001`, `ACC-MARKDOWN-LONG-WITH-TABLE-001` |
| `T-MD-FALLBACK` | `ACC-FORMAT-FALLBACK-001` |
| `T-TARGET-REVOKED` | `ACC-TARGET-REVOKED-SAME-CHAT` |
| `T-SDK-ATTEMPTS-EXHAUSTED` | `ACC-SDK-ATTEMPTS-EXHAUSTED` |
| `T-MT-GROUP` | `CTR-AUTO-MENTION-CODE-FENCE-001`, `CTR-AUTO-MENTION-NOTIFICATION-001`, `ACC-GROUP-AUTO-MENTION`, `ACC-MENTION-OUTSIDE-CODE-FENCE-001`, `ACC-NATIVE-MENTION-NOTIFICATION-001` |
| `T-MT-TOPIC` | `CTR-TOPIC-CONTINUITY-001`, `CTR-AUTO-MENTION-NOTIFICATION-001`, `ACC-TOPIC-AUTO-MENTION`, `ACC-TOPIC-INGRESS-CONTINUITY-001`, `ACC-NATIVE-MENTION-NOTIFICATION-001` |
| `T-MT-P2P` | `ACC-P2P-NO-MENTION` |
| `T-MT-RECEIPT` | `ACC-FAILURE-RECEIPT-NO-MENTION`, `ACC-UNBOUND-PROACTIVE-NO-MENTION` |
| `T-MT-IDENTITY` | `ACC-IDENTITY-OPENID` |
| `§8 Ordering with Phase A` | `DEC-LUX-007`, `CTR-PHASE-A-PRECONDITION-001`, `ACC-PHASE-A-PRECONDITION-001` |
| `§9 Non-Goals and Prohibitions` | `DEC-LUX-001`, `CTR-BOUNDARY-001`, `ALT-LUX-001`, `ALT-LUX-008` |
| `§10 Risks` | `CTR-MARKDOWN-002`, `CTR-TARGET-REVOKED-001`, `CTR-TRANSPORT-RETRY-002`, `CTR-ROLLBACK-001` |
| `§11 Review and Acceptance` | `STATE-LUX-001`, `CLM-LUX-001`, `DEC-LUX-007` |
| `§12 Related` | `OBS-LUX-002`, `OBS-LUX-003`, `OBS-LUX-009` |

## 16. Unresolved Authority Conflicts / Open Questions

```text
UNRESOLVED_AUTHORITY_CONFLICT = NONE
OWNER_DECISION_REQUIRED = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
```

`CLM-LUX-009` is not an open normative choice: `DEC-LUX-005` rejects it. PR #23 and PR #27 remain
evidence only. If future main conflicts with any Contract or authority, implementation MUST stop.

### Review history — SPEC_FORMAT_V0 final review closure

```text
REVIEWED_HEAD = 07cd5b1999dcb6a6fc500de5c3ec6302840764aa
REVIEWER_IDENTITY = CODEX_PR24_SPEC_FORMAT_V0_FINAL_REVIEW_2026_08_21
REVIEW_VERDICT = FIX_REQUIRED
BLOCKERS =
  PRODUCT_SEMANTIC_MIGRATION_NARROWED
  MIGRATION_MAP_TARGETS_NOT_STABLE
DISPOSITION =
  SEMANTIC_ITEMS_RESTORED_8_OF_8
  MIGRATION_MAP_INVALID_TARGETS_REPLACED_WITH_EXISTING_STABLE_IDS_2_OF_2
PRODUCT_SEMANTIC_CHANGE = NONE
```

This history records the incoming review; it does not change the Spec to accepted and does not itself
constitute a focused re-review verdict for the amended Head.

## 17. Final Output / Lifecycle

```text
SPEC_ID = AGENT_CORE_LARK_UX_PHASE1_V2
SPEC_FORMAT = SPEC_FORMAT_V0
SPEC_STATUS = proposed
PR = #24
PR_DRAFT = YES
SEMANTIC_ITEMS_RESTORED = 8/8
MIGRATION_MAP_NATURAL_LANGUAGE_TARGETS = 0
SEMANTIC_CLOSURE_MATRIX = 8/8
D_U1 = APPROVED
ROUTER_CHANGE_REQUIRED = YES_MINIMAL
ROUTER_AUTHORITY_CHANGE = NONE
ROUTER_PRODUCT_ROUTING_CHANGE = NONE
OWNER_DECISION_REQUIRED = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PRODUCT_SEMANTIC_CHANGE = NONE
IMPLEMENTATION_PROGRESS = NOT_STARTED
VERIFICATION_COVERAGE = NOT_RUN
CONFORMANCE_RESULT = UNKNOWN
IMPLEMENTATION_AUTHORIZED_NOW = NO
IMPLEMENTATION_AUTHORIZED = NO
ACCEPTANCE_FINALIZED = NO
PRODUCT_CODE_CHANGE = NONE
DEPENDENCY_CHANGE = NONE
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE
MERGE = NONE
READY_TO_MARK_ACCEPTED = NO
READY_FOR_INDEPENDENT_SPEC_REVIEW = YES
```

Independent semantic review MUST bind the exact final Spec commit/base and verify migration, primitive
typing, authority and every Contract/Acceptance mapping before a separate Owner acceptance-finalize.
Proposed/Draft status is intentional until that lifecycle step.
