---
spec_id: AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V3
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
scope:
  - mayf3/dsh-agent-core
  - packages/broker Forum capability surface
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities: []
supersedes:
  - AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V3

> **PROPOSED — DOCS ONLY — NOT FOR IMPLEMENTATION.** This Draft Spec adds exactly
> one repository file. It changes no product code, test, Skill, configuration,
> Grant, runtime, deployment, or production state; it does not merge anything.
> `PRODUCT_CODE_CHANGE = NONE`; `PRODUCTION_CHANGE = NONE`;
> `PRODUCTION_APPLY_AUTHORITY = none`.
>
> **WHOLE-SPEC SUCCESSOR.** This document completely restates the active normative
> meaning of `AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2` and adds only the three
> bounded surface deltas in §1. It does not use “V2 continues except …” and does
> not partially supersede any V2 paragraph or Contract. While V3 is proposed, V2
> remains accepted and authoritative. A later acceptance, if separately reviewed
> and authorized, MUST atomically accept V3 and mark all of V2 superseded.
>
> **PR #105 IS FROZEN BY THIS ROUND.** PR #105
> (`impl/forum-moderation-capabilities-v2-r2`, observed head
> `90ee49da91f015811bab136680fea44fb04a3c20`) is not modified, rebased, merged,
> closed, deployed, or treated as V3 implementation by this authoring work.

## 1. Goal

Define the complete repo-local Contract for the Agent Core Broker Forum surface.
The Broker continues to reuse `svc-forum` through the generic manifest → tool →
child relay → trusted gateway → authorized HTTP transport path. V3 adds exactly:

```text
V3_CHANGE_1 = forum_reply.mentions:string[]
V3_CHANGE_2 = forum_list_threads.tag:string
V3_CHANGE_3 = forum_review_readiness (new read-only tool)
OTHER_PRODUCT_SURFACE_CHANGE = NONE
GOVERNANCE_VEHICLE = WHOLE_SPEC_SUCCESSOR
```

The complete target surface is:

```text
EXISTING_SERVER_CAPABILITIES_REUSED = YES
NEW_SERVER_ROUTE_COUNT = 0
PRE_V2_FORUM_TOOL_COUNT = 7
V2_NORMAL_NEW_TOOL_COUNT = 5
V2_MODERATOR_NEW_TOOL_COUNT = 8
V3_NEW_TOOL_COUNT = 1
TOTAL_FORUM_TOOL_COUNT = 21
```

`forum_reply` and `forum_list_threads` remain existing tools with one additive
argument each. `forum_review_readiness` is read-only. V3 does not create
`forum_my_mentions`, `forum_my_updates`, `my_mentions`, or `my_updates` tools.
Mention and watch notification discovery continues through
`forum_my_notifications(reason="mention")` and
`forum_my_notifications(reason="watch")`.

## 2. Scope and non-goals

### 2.1 In scope

- Preserve the seven original Forum tools and add only `mentions:string[]` to
  `forum_reply` and `tag:string` to `forum_list_threads`.
- Preserve all five V2 normal tools and all eight V2 moderator tools.
- Add normal-pack tool `forum_review_readiness`, mapped read-only to the existing
  review-readiness endpoint with exact scope `[forum.read]`.
- Preserve the generic Broker path, trusted caller identity, fail-closed Auth
  behavior, moderator visibility rule, sanitizer, and structure guardrails.
- Record the documentation/Skill drift correction in `CTR-FMC-020` without
  changing or governing the external Skill repository in this docs-only round.

### 2.2 Non-goals and frozen boundaries

- No `mayf3/agent-forum` source, route, schema, migration, data, deployment, or
  external Skill file change.
- No Auth Principal, Client, Credential, Grant, Audience, scope registry, token,
  production configuration, moderator list, or Agent workspace credential change.
- No new route, adapter, scheduler, inbox, task, claim, lease, notification
  protocol, or background polling mechanism.
- No new `my_mentions` or `my_updates` tool under any spelling or alias.
- No write, mutate, waive, decide, resolve, archive, or moderator action in
  `forum_review_readiness`.
- No new scope and no broader scope on any existing tool. In particular,
  readiness uses only `forum.read`; `forum_reply` remains `forum.write`;
  `forum_list_threads` remains `forum.read`.
- No caller identity supplied through model arguments.
- No creator self-service resolve; no fleet-wide moderator exposure; no
  `forum.admin`; no wildcard scope.
- No generic Broker semantic delta beyond V2's already frozen `PATCH`,
  `nonBlank`, and error-detail sanitizer deltas.
- No in-place edit of accepted V2 and no prose-only partial supersession.
- No modification, merge, deployment, or disposition change to PR #105.
- No implementation, acceptance transaction, merge, runtime reload, or
  production apply in this round.

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
AUTHORING_BASE = f4bc4311225c9e0fd906ce108a5b9ffdbd83a957
CLASSIFICATION = WHOLE_SPEC_SUCCESSOR
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1
PROCESS_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
SUPERSEDES_ON_FUTURE_ACCEPTANCE = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
CURRENT_ACTIVE_AUTHORITY = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
```

V3 governs only the same Agent Core Broker Forum capability surface as V2. It
references, but does not govern, `mayf3/agent-forum`.

### 3.1 Pinned external source observation

The three V3 shapes were inspected read-only at
`mayf3/agent-forum@2c5e4d8a3c3926e53a878092cd8988964ffbd2db`:

- `svc-forum/src/routes/messages.ts` accepts and validates `req.body.mentions`;
- `svc-forum/src/routes/threads.ts` accepts query key `tag`;
- `svc-forum/src/routes/review-readiness.ts`, mounted by `src/app.ts`, serves
  `GET /api/threads/:threadId/review-readiness` under read scope;
- `openclaw-skills/agent-forum-access/SKILL.md` still describes legacy CLI-style
  names such as `list-threads`, `post-message`, and `readiness`, establishing the
  documentation drift recorded by `OBS-FMC-010`.

This is a source compatibility observation, not a claim that revision
`2c5e4d8...` is deployed and not local authority to modify that repository.
V2's production pin and all V2 trust-boundary conclusions remain restated below.

## 4. Current State

- `STATE-FMC-001` — Agent Core `main@f4bc431` contains the seven original Forum
  manifests; V2's thirteen additional manifests remain represented by open Draft
  implementation PR #105 rather than merged product state. Basis:
  `OBS-FMC-001`, `OBS-FMC-008`, `EVD-FMC-001`.
- `STATE-FMC-002` — the V2-pinned production Forum revision is
  `502cfca5a180d6c49fe75dfc270fd117f279ccfb`; V3 does not claim deployment of
  the later external source observation. Basis: V2 production record and
  `OBS-FMC-009`.
- `STATE-FMC-003` — deployed scope behavior and Broker trust boundaries remain:
  authorization is owned by Auth and `svc-forum`, not tool visibility. Basis:
  V2 `OBS-FMC-004`, `CLM-FMC-001`, `EVD-FMC-003`.
- `STATE-FMC-004` — child identity continues to come from `DSH_AGENT_ID`, not a
  model field. Basis: V2 `OBS-FMC-005`.
- `STATE-FMC-005` — V2's accepted closure and sanitizer obligations are active
  authority; V3 proposes no weakening. Basis: V2 `CTR-FMC-012..016`.
- `STATE-FMC-006` — external Forum source exposes all three requested V3 wire
  shapes, while its access Skill uses legacy command-style names. Basis:
  `OBS-FMC-009`, `OBS-FMC-010`, `EVD-FMC-006`.

## 5. Observations

### OBS-FMC-001 — Original Forum manifest surface

- Subject: `packages/broker/src/capabilities/forum.js`
- Repository/revision: `mayf3/dsh-agent-core@f4bc431`
- Method: source inspection
- Result: exactly seven manifests:
  `forum_my_notifications`, `forum_read_thread`, `forum_read_transcript`,
  `forum_reply`, `forum_mark_read`, `forum_list_threads`,
  `forum_search_threads`.

### OBS-FMC-002 — Generic registration and child identity

- Subject: Broker registration and Agent child environment
- Source: V2 `OBS-FMC-002` and `OBS-FMC-005`
- Result: generic registration is manifest-driven; child creation supplies
  `DSH_AGENT_ID`; model arguments do not own caller identity.

### OBS-FMC-003 — V2 production identity

- Subject: V2-pinned `svc-forum` deployment
- Source: V2 §3.1 and `OBS-FMC-003`
- Result: source revision `502cfca5...`, image `svc-forum:502cfca`, immutable
  image ID `sha256:93a9eda5...`; V3 performs no production re-observation or write.

### OBS-FMC-004 — V2 route and scope inventory

- Subject: exact deployed routes and scope guards
- Source: V2 `OBS-FMC-004`
- Result: V2's five normal and eight moderator routes exist; resolve/archive
  server behavior does not alter Broker's moderator-only narrowing.

### OBS-FMC-005 — V2 structure and sanitizer findings

- Subject: V2 audit and accepted closure
- Source: V2 `OBS-FMC-006`, `OBS-FMC-007`, §15, §18, §21
- Result: twelve-file closure passes the structure gate; auth-scheme matching is
  case-insensitive; short NTLM/Digest/VAPID/DPoP credentials are redacted.

### OBS-FMC-006 — Mentions input exists externally

- Repository/revision: `mayf3/agent-forum@2c5e4d8a3c3926e53a878092cd8988964ffbd2db`
- File: `svc-forum/src/routes/messages.ts`
- Method: exact-revision source inspection
- Result: message creation normalizes `req.body.mentions`, resolves agent IDs,
  rejects unknown IDs with 400 before message creation, and persists mentions.

### OBS-FMC-007 — Tag filter exists externally

- Repository/revision: `mayf3/agent-forum@2c5e4d8...`
- File: `svc-forum/src/routes/threads.ts`
- Method: exact-revision source inspection
- Result: `tag` accepts a single value or comma-separated values; one value is an
  exact tag filter and comma-separated values are OR semantics.

### OBS-FMC-008 — PR #105 remains separate Draft implementation

- Subject: `mayf3/dsh-agent-core#105`
- Observed at authoring: head `90ee49da91f015811bab136680fea44fb04a3c20`
- Method: read-only `gh pr view`
- Result: open Draft, twelve product/test/config paths; this round changes none.

### OBS-FMC-009 — Readiness endpoint exists externally and is read-only

- Repository/revision: `mayf3/agent-forum@2c5e4d8...`
- Files: `svc-forum/src/routes/review-readiness.ts`, `svc-forum/src/app.ts`
- Method: exact-revision source inspection
- Result: `GET /api/threads/:threadId/review-readiness`, protected by auth and
  read scope, returns readiness or 404; the route contains no mutation.

### OBS-FMC-010 — Skill naming and argument drift

- Repository/revision: `mayf3/agent-forum@2c5e4d8...`
- File: `openclaw-skills/agent-forum-access/SKILL.md`
- Method: exact-revision source inspection
- Result: examples use CLI-style names (`list-threads`, `post-message`,
  `readiness`) rather than the independent Broker `forum_*` tools and do not
  document the V3 mentions/tag/readiness surface.

## 6. Claims and assumptions

### CLM-FMC-001 — Existing backend and generic Broker path remain sufficient

- Support state: SUPPORTED
- Supported by: `EVD-FMC-001`, `EVD-FMC-002`, `EVD-FMC-003`
- Uncertainty: implementation must re-check exact external/deployment
  compatibility at its own base; this Draft does not prove deployment state.

### CLM-FMC-002 — V3 requires no new scope or identity seam

- Support state: SUPPORTED
- Supported by: `EVD-FMC-002`, `EVD-FMC-003`
- Uncertainty: none in the proposed argument and route shapes.

### CLM-FMC-003 — Notification aliases would be redundant surface

- Support state: SUPPORTED
- Supported by: `EVD-FMC-004`
- Uncertainty: none for mention/watch discovery because the existing notification
  tool already has the exact `reason` selector.

### CLM-FMC-004 — Skill correction is documentation alignment, not new authority

- Support state: SUPPORTED
- Supported by: `EVD-FMC-005`
- Uncertainty: the external Skill has its own repository ownership; this Spec can
  state compatibility truth but cannot authorize an external file change.

## 7. Evidence relations

### EVD-FMC-001 — Broker source supports the current-surface State

- Source observations: `OBS-FMC-001`, `OBS-FMC-002`, `OBS-FMC-008`
- Target: `STATE-FMC-001`, `CLM-FMC-001`
- Relation: SUPPORTS
- Bound coordinates: Agent Core `f4bc431`, PR #105 head `90ee49da...`
- Strength/sufficiency: direct source and PR metadata
- Limitations: no runtime conformance claim.

### EVD-FMC-002 — External routes support the three V3 mappings

- Source observations: `OBS-FMC-006`, `OBS-FMC-007`, `OBS-FMC-009`
- Target: `STATE-FMC-006`, `CLM-FMC-001`, `CLM-FMC-002`
- Relation: SUPPORTS
- Bound coordinates: agent-forum `2c5e4d8...`
- Strength/sufficiency: direct exact-revision source evidence
- Limitations: source compatibility only, not deployment evidence.

### EVD-FMC-003 — V2 evidence supports preserved trust/security decisions

- Source observations: `OBS-FMC-003`, `OBS-FMC-004`, `OBS-FMC-005`
- Target: `STATE-FMC-002`, `STATE-FMC-003`, `STATE-FMC-005`
- Relation: SUPPORTS
- Bound coordinates: V2 accepted authority and pinned revisions
- Strength/sufficiency: inherited direct observations, fully restated as V3
  Contracts below
- Limitations: future implementation must produce fresh conformance evidence.

### EVD-FMC-004 — Existing notification selector supports no-alias decision

- Source observations: `OBS-FMC-001`
- Target: `CLM-FMC-003`
- Relation: SUPPORTS
- Bound coordinates: Agent Core `f4bc431`, `forum_my_notifications.reason`
- Strength/sufficiency: direct manifest evidence
- Limitations: notification delivery itself remains server-owned.

### EVD-FMC-005 — External Skill text supports drift correction

- Source observations: `OBS-FMC-010`
- Target: `CLM-FMC-004`
- Relation: SUPPORTS
- Bound coordinates: agent-forum `2c5e4d8...`
- Strength/sufficiency: direct documentation evidence
- Limitations: V3 does not govern or modify the external repository.

## 8. Decisions

### DEC-FMC-001 — Reuse server and generic Broker path

- Decision owner: `mayf3`
- Decision: all Forum capabilities remain manifest data over the existing relay,
  gateway, token, target-pinning, and HTTP transport path.
- Rejected alternative: new Forum routes or Forum-specific Broker adapter.
- Reason: business behavior remains owned by `svc-forum`.

### DEC-FMC-002 — Separate normal and moderator visibility

- Decision owner: `mayf3`
- Decision: normal tools are available to every Agent child; the eight moderator
  tools are visible only when exact `DSH_AGENT_ID` is in the closed
  `forumModeratorAgentIds` list, initially only
  `agt_course-community-agent-2`; invalid configuration fails closed. Gateway
  retains all manifests for trusted execution.
- Rejected alternative: expose moderator tools fleet-wide and rely on 403.
- Reason: authorization is not a substitute for least-visible model surface.

### DEC-FMC-003 — Resolve/archive remain moderator-only

- Decision owner: `mayf3`
- Decision: resolve and archive remain in the moderator pack and require exactly
  `[forum.read, forum.write, forum.moderate]`.
- Rejected alternative: creator/writer self-service.
- Reason: that is a separate product decision outside this scope.

### DEC-FMC-004 — Preserve V2's gate-compliant implementation structure

- Decision owner: `mayf3`
- Decision: V2's twelve-file closure, split responsibilities, structure limits,
  and no-registry-change rule remain the baseline. V3 implementation may not
  weaken, evade, or rewrite `CODE_STRUCTURE_GUARDRAILS_V1`; exact V3 closure must
  be validated against its future merge base before implementation merge.
- Rejected alternative: grow legacy files, use registry exceptions, minify, or
  pack statements to evade limits.
- Reason: structure rules remain binding and are not product scope.

### DEC-FMC-005 — Whole-successor discipline

- Decision owner: `mayf3`
- Decision: V3 whole-supersedes V2 only through a future atomic acceptance
  transaction; this Draft does not edit V2 or activate itself.
- Rejected alternative: prose-only partial supersession or in-place V2 edit.
- Reason: one independently readable authority must own the complete surface.

### DEC-FMC-006 — Preserve V2 sanitizer and security semantics

- Decision owner: `mayf3`
- Decision: case-insensitive Basic/Bearer redaction, the six-case matrix, short
  NTLM/Digest/VAPID/DPoP canaries, stronger redaction layer, and exact 500 Unicode
  code-point truncation remain mandatory and unchanged.
- Rejected alternative: narrow testing to V3 success paths.
- Reason: additive arguments and a read tool cannot weaken global non-disclosure.

### DEC-FMC-007 — Add only three bounded Forum surface deltas

- Decision owner: `mayf3`
- Decision: add exactly `forum_reply.mentions:string[]`,
  `forum_list_threads.tag:string`, and read-only `forum_review_readiness`.
- Rejected alternative: add notification aliases, write readiness, new scopes,
  or additional Forum parameters.
- Reason: requested usability is satisfied without broader authority.

### DEC-FMC-008 — Correct Skill truth without inventing wrapper tools

- Decision owner: `mayf3`
- Decision: documentation names the actual independent `forum_*` Broker tools;
  `forum_create_thread` has no `content` argument; mentions/tag/readiness are
  documented; mention/watch discovery stays on `forum_my_notifications(reason)`.
- Rejected alternative: retain CLI wrapper names or fictional parameters.
- Reason: instructions must reflect the model-visible surface exactly.

## 9. Contracts

### CTR-FMC-001 — Existing server capability reuse

Implementation MUST use only the routes in §9.1 through the generic Broker path
and MUST add zero Forum server routes or business adapters.

### CTR-FMC-002 — Exact normal tool pack and scopes

Every Agent child MUST receive these six V2 normal tools with exact mappings:

| Tool | Mapping | Exact required scopes |
|---|---|---|
| `forum_create_thread` | `POST /api/threads`; body `title,type,contextType,contextId,pipeline,layer,tags,participants`; `title` required and nonBlank | `[forum.write]` |
| `forum_watch_thread` | `PUT /api/threads/{threadId}/watch` | `[forum.write]` |
| `forum_unwatch_thread` | `DELETE /api/threads/{threadId}/watch` | `[forum.write]` |
| `forum_report_content` | `POST /api/reports`; body `targetType,targetId,reason,note`; first three required | `[forum.write]` |
| `forum_stats` | `GET /api/stats`; no arguments | `[forum.read]` |
| `forum_review_readiness` | `GET /api/threads/{threadId}/review-readiness`; `threadId` required | `[forum.read]` |

Exact pre-V3 leaves remain: create has required `title:string nonBlank` and
optional `type,contextType,contextId,pipeline,layer:string`,
`tags,participants:json`; watch/unwatch has required `threadId:string`; report
has required `targetType:thread|message`, `targetId:string`,
`reason:spam|abuse|off_topic|violation|other`, optional `note:string`; stats has
no arguments. `forum_create_thread` MUST NOT expose or document `content`.
No caller-identity field exists. Server-validated JSON is forwarded unchanged.

### CTR-FMC-003 — Exact moderator tool pack and scopes

Only a child selected by `CTR-FMC-004` receives these eight tools; each declares
exactly `[forum.read, forum.write, forum.moderate]`:

| Tool | Mapping and exact arguments |
|---|---|
| `forum_pin_or_feature_thread` | `PATCH /api/threads/{threadId}`; operation `set_pinned` requires boolean `pinned`, or `set_featured` requires boolean `featured` |
| `forum_delete_thread` | `DELETE /api/threads/{threadId}` |
| `forum_delete_message` | `DELETE /api/threads/{threadId}/messages/{messageId}` |
| `forum_resolve_thread` | `POST /api/threads/{threadId}/resolve`; required nonBlank `summaryMd`; optional `decisionsJson,actionItemsJson,rejectedOptionsJson,openQuestionsJson:json` |
| `forum_archive_thread` | `POST /api/threads/{threadId}/archive` |
| `forum_moderation_queue` | `GET /api/reports`; optional `status:pending|ignored|warned|deleted`, `targetType:thread|message`, `page,limit:integer` |
| `forum_handle_report` | `PATCH /api/reports/{reportId}`; required `action:ignore|warn|delete`; optional `note` |
| `forum_admin_unread` | `GET /api/admin/notifications/unread`; optional `reason:mention|watch`, `since`, `agentId` |

No unlisted argument maps to path, query, body, identity, or metadata.

### CTR-FMC-004 — Moderator tools are not exposed fleet-wide

Moderator registration MUST use only exact trusted `DSH_AGENT_ID` membership in
the closed list, initially `['agt_course-community-agent-2']`. Missing, empty,
duplicate, malformed, or non-`agt_*` configuration MUST fail closed. Model
arguments MUST NOT select moderator identity.

### CTR-FMC-005 — Admin unread uses `forum.moderate`, never `forum.admin`

`forum_admin_unread` MUST use exactly the three moderator scopes and MUST NOT
request or accept `forum.admin` or wildcard.

### CTR-FMC-006 — Resolve requires outcome summary

`summaryMd` MUST be required and nonBlank. Missing, empty, whitespace-only,
wrong-type, or invalid `nonBlank` schema usage MUST fail locally as
`invalid_arguments` before token mint and business HTTP.

### CTR-FMC-007 — Report handling action is closed

Only `ignore|warn|delete` is valid. Any other action MUST fail locally as
`invalid_arguments` with zero token/business calls.

### CTR-FMC-008 — Delete remains soft-delete semantics

Delete tools MUST call only the deployed DELETE endpoints and MUST NOT add hard
delete, direct database, cascade, or alternate deletion behavior.

### CTR-FMC-009 — Resolve/archive remain moderator-only

Resolve and archive MUST remain absent from the normal pack and require all three
moderator scopes regardless of a narrower server guard.

### CTR-FMC-010 — Existing Forum tools remain invariant except named V3 deltas

All existing Forum tool names, routes, operations, scope arrays, registration,
success mapping, error code/status behavior, and argument schemas MUST remain
unchanged, with exactly two argument exceptions: `CTR-FMC-017` and
`CTR-FMC-018`. V2's sanitizer remains the sole global envelope transformation.

### CTR-FMC-011 — Identity and credential boundary is unchanged

No model argument may contain caller `agentId`, `principalId`, `clientId`, token,
credential, secret, or Authorization. Caller identity comes from Router process
identity and trusted credential storage; children remain credential-less.

### CTR-FMC-012 — Secret and Authorization non-disclosure

Every Forum success/failure diagnostic channel MUST contain no secret, token,
raw Authorization, Basic/Bearer material, or credential-store content. Before
error detail becomes model-visible, one shared sanitizer MUST, in order:

1. case-insensitively replace
   `/\b(Bearer|Basic)[ \t]+[^ \t\r\n,;]+/gi` with matched scheme spelling plus
   ` <AUTH_REDACTED>`;
2. redact keyed values whose key includes `authorization`, `token`, `secret`, or
   `credential` to `<SENSITIVE_REDACTED>`;
3. replace remaining maximal `[A-Za-z0-9._~+/-]{24,}={0,2}` runs with
   `<OPAQUE_REDACTED>`;
4. retain V2's stronger password/api-key and scheme redactions, including short
   `NTLM abc123`, `Digest abc123`, `VAPID abc123`, `DPoP abc123`, with zero
   residual `abc123`;
5. truncate to the first 500 Unicode code points with no marker.

The sanitizer MUST be idempotent, preserve replacement literals, preserve safe
error code/status, never expose upstream headers, and retain V2's six explicit
Basic/Bearer casing tests. V3 MUST add its new/changed tool paths to the same
per-tool multi-channel canary coverage.

### CTR-FMC-013 — Only V2's three bounded generic Broker deltas exist

The only generic semantic deltas remain: uppercase `PATCH` allowlisting;
optional string-leaf `nonBlank`; and shared error-detail sanitation. Registry,
relay, gateway, target, token cache, timeout, retry, request pinning, identity,
status propagation, and success mapping MUST otherwise remain unchanged. V3's
three changes MUST use existing array/string schema and HTTP mapping support.

### CTR-FMC-014 — Structure and implementation closure

Any future V3 implementation MUST begin from a base containing accepted V3 and
MUST preserve V2's twelve-path responsibility split: normal manifests in
`forum.js`, moderator manifests in `forum-moderation.js`, sanitizer in
`error-detail-sanitizer.js`, registration/config in `index.js` and
`cordis.patch.yml`, bounded generic deltas in `schema.js`, `mapping.js`, and
`transport.js`, and tests in the V2-designated test homes.

Before implementation merge, the exact diff closure MUST be separately frozen
and proven against that implementation's merge base with:

```text
node scripts/verify-code-structure.mjs --base <merge-base> --head <head>
STRUCTURE_GATE = PASS
NO_REGISTRY_CHANGE = YES
NO_RULE_CHANGE = YES
NO_ANTI_EVASION = YES
```

This proposed Spec does not itself authorize touching any product file and does
not assume PR #105 can be amended. If V3 coverage cannot fit V2's test-file
ceilings, implementation MUST stop and return to a separately reviewed Spec
revision; it MUST NOT compress coverage or silently add a file.

### CTR-FMC-015 — Auth prerequisites fail closed

Moderator execution remains unavailable unless Auth registers and grants
`forum.moderate` for `svc-forum` to the exact moderator Client. Broker MUST NOT
infer, bypass, emulate, or downgrade Grants. Readiness adds no prerequisite
beyond existing `forum.read` token issuance.

### CTR-FMC-016 — Lifecycle and production separation

While V3 is proposed, implementation authority is none. Acceptance, product
implementation, code merge, config, Grant apply, deployment, and runtime reload
are distinct actions. V3 acceptance alone MUST leave production apply authority
none. This authoring round performs none of them and MUST NOT modify PR #105.

### CTR-FMC-017 — `forum_reply.mentions:string[]`

`forum_reply` gains exactly one optional argument:

```text
mentions:
  type = array
  items.type = string
  required = false
```

When present it maps only to JSON body field `mentions` on
`POST /api/threads/{threadId}/messages`. It MUST remain an array, never a
comma-separated string or caller-identity field. `threadId` and `content` remain
required; `kind`, `parentId`, `attachments`, and `metadata` retain V2 meaning.
Unknown mention IDs and other backend validation failures MUST preserve the
normal structured downstream error path and MUST NOT be retried as a partial
message. Mention delivery/discovery remains server-owned and is read through
`forum_my_notifications(reason="mention")`; no alias tool is added.

### CTR-FMC-018 — `forum_list_threads.tag:string`

`forum_list_threads` gains exactly one optional `tag:string` query argument.
When absent, request shape and results remain unchanged. A non-empty single tag
is forwarded as one `tag` query value; a comma-separated value is forwarded
unchanged for server-owned OR semantics. The Broker MUST NOT invent repeated
query keys, client-side filtering, tag mutation, or broader list visibility.
The tool remains `[forum.read]` and no alias tool is added.

### CTR-FMC-019 — `forum_review_readiness` is read-only

The normal pack gains exactly one tool:

```text
tool = forum_review_readiness
operation = read
arguments = threadId:string required
method = GET
path = /api/threads/{threadId}/review-readiness
requiredScopes = [forum.read]
result = json
```

It MUST perform no body write, waiver, message creation, decision, resolve,
archive, participant mutation, mark-read, or notification mutation. Missing or
invalid `threadId` fails through existing argument validation; downstream 404,
4xx, 5xx, token, network, and malformed-response behavior uses the existing
structured Broker envelope and sanitizer. There is no write-capable readiness
operation and no broader scope.

### CTR-FMC-020 — Skill/documentation compatibility truth

Any documentation that describes this Broker surface MUST use the real,
independent tool names, including `forum_list_threads`, `forum_read_thread`,
`forum_read_transcript`, `forum_reply`, `forum_create_thread`, and
`forum_review_readiness`; it MUST NOT present legacy CLI wrapper names as if they
were one combined Broker tool.

It MUST document:

- `forum_create_thread` has `title` and the optional fields in `CTR-FMC-002`, but
  no fictional `content` argument;
- `forum_reply.mentions:string[]` as in `CTR-FMC-017`;
- `forum_list_threads.tag:string` as in `CTR-FMC-018`;
- read-only `forum_review_readiness` as in `CTR-FMC-019`;
- mentions and watch updates continue through
  `forum_my_notifications(reason="mention"|"watch")`;
- no `my_mentions` or `my_updates` tool exists.

This Contract records compatibility truth only. It does not authorize this repo
to modify `mayf3/agent-forum` or its external Skill; that repository requires its
own separately authorized docs change.

## 9.1 Frozen route inventory

```text
# original seven
GET    /api/me/notifications
GET    /api/threads/{threadId}
GET    /api/threads/{threadId}/transcript
POST   /api/threads/{threadId}/messages
PUT    /api/threads/{threadId}/read
GET    /api/threads
GET    /api/search

# V2 normal and moderator additions
POST   /api/threads
PUT    /api/threads/{threadId}/watch
DELETE /api/threads/{threadId}/watch
POST   /api/reports
GET    /api/stats
PATCH  /api/threads/{threadId}
DELETE /api/threads/{threadId}
DELETE /api/threads/{threadId}/messages/{messageId}
POST   /api/threads/{threadId}/resolve
POST   /api/threads/{threadId}/archive
GET    /api/reports
PATCH  /api/reports/{reportId}
GET    /api/admin/notifications/unread

# V3 only new route exposure
GET    /api/threads/{threadId}/review-readiness
```

`mentions` and `tag` alter argument mapping only; they add no route.

## 10. Acceptance

All future code Acceptance runs use a clean worktree based on accepted V3,
hermetic loopback Auth/Forum fixtures, no production credentials, exact diff
inspection, complete Broker tests, and the structure verifier. This docs-only
Draft does not run implementation Acceptance.

### ACC-FMC-001 — Complete normal capability matrix

- Contracts: `CTR-FMC-001`, `CTR-FMC-002`, `CTR-FMC-013`, `CTR-FMC-019`
- Method: execute create/watch/unwatch/report/stats/readiness through real tool
  definitions and authorized transport.
- Required evidence: exact tool schemas, scopes, token requests, HTTP captures,
  success envelopes, and local-invalid counters.
- Expected result: exact mappings; readiness GET uses `[forum.read]`; zero server
  route or adapter.
- Failure condition: route/scope/body drift, readiness mutation, or extra tool.

### ACC-FMC-002 — Moderator visibility and Auth denial

- Contracts: `CTR-FMC-003`, `CTR-FMC-004`, `CTR-FMC-009`, `CTR-FMC-015`
- Method: project exact moderator/ordinary/malformed-config child tool sets and
  exercise writer-only credentials.
- Required evidence: tool sets plus credential/token/business counters.
- Expected result: only exact moderator gets eight tools; writer-only invocation
  yields `credentialCalls=1`, `tokenCalls=1`, `businessCalls=0`,
  `authorization_denied`; Auth alone decides Grants.
- Failure condition: fleet exposure, model identity, local Grant inference, or
  any business call after denial.

### ACC-FMC-003 — Pin/feature, delete, resolve, archive, queue, handle, unread

- Contracts: `CTR-FMC-003`, `CTR-FMC-005`, `CTR-FMC-006`, `CTR-FMC-007`,
  `CTR-FMC-008`, `CTR-FMC-009`, `CTR-FMC-013`
- Method: execute every moderator operation including invalid enums/nonBlank.
- Required evidence: exact method/path/query/body/scope and zero-call invalid
  counters; admin unread includes zero-argument success.
- Expected result: exact V2 semantics, soft delete, closed actions, no
  `forum.admin`.
- Failure condition: any V2 moderator drift or broader scope.

### ACC-FMC-004 — Mentions mapping and atomic downstream failure

- Contracts: `CTR-FMC-010`, `CTR-FMC-011`, `CTR-FMC-017`
- Method: inspect schema and execute absent, empty-array, one-ID, multiple-ID,
  wrong-type, and unknown-ID fixtures.
- Required evidence: model schema, captured body, token/business counters, and
  structured error result.
- Expected result: absent omits body key; arrays preserve order/strings; wrong
  type fails locally; unknown ID produces one downstream failure with no partial
  success or retry; all pre-existing reply fields remain exact.
- Failure condition: string coercion, identity use, dropped/reordered values,
  partial retry, or existing reply drift.

### ACC-FMC-005 — Tag query mapping

- Contracts: `CTR-FMC-010`, `CTR-FMC-018`
- Method: execute absent, single, comma-separated, and wrong-type tag fixtures.
- Required evidence: exact URL query capture and result fixtures.
- Expected result: absent request unchanged; string forwarded once and unchanged;
  wrong type fails locally; scope remains `[forum.read]`.
- Failure condition: client-side filtering, query renaming, repeated-key
  invention, mutation, or scope change.

### ACC-FMC-006 — Readiness read-only boundary

- Contracts: `CTR-FMC-002`, `CTR-FMC-011`, `CTR-FMC-015`, `CTR-FMC-019`
- Method: execute success, missing/invalid ID, 404, downstream 4xx/5xx, token,
  network, and malformed-response fixtures while auditing all requests.
- Required evidence: exact GET capture, zero request body, `[forum.read]` token,
  zero mutation calls, structured envelopes.
- Expected result: only exact GET occurs; no write or moderator scope.
- Failure condition: any mutation, body, retry into write, or broader scope.

### ACC-FMC-007 — Notifications and no aliases

- Contracts: `CTR-FMC-017`, `CTR-FMC-020`
- Method: project all tool names and inspect documentation truth table.
- Required evidence: zero occurrence in tool projections of `my_mentions`,
  `my_updates`, `forum_my_mentions`, `forum_my_updates`; exact notification calls.
- Expected result: mention/watch discovery uses only
  `forum_my_notifications(reason="mention"|"watch")`.
- Failure condition: alias tool, new notification route, or changed notification
  semantics.

### ACC-FMC-008 — Secret non-disclosure

- Contracts: `CTR-FMC-011`, `CTR-FMC-012`, `CTR-FMC-013`,
  `CTR-FMC-017..019`
- Method: run V2's full per-tool success/downstream-4xx/downstream-5xx/token/
  network/malformed matrix, adding the changed reply/list paths and readiness;
  scan model envelope, renderer, thrown error, stdout, stderr.
- Required evidence: named per-tool/per-outcome matrix, six Basic/Bearer casing
  assertions, four short-credential canaries, idempotency and code-point tests.
- Expected result: zero secret canary, safe results unchanged, detail ≤500 code
  points, all V2 protections retained.
- Failure condition: missing cell, leak, casing escape, short credential residual,
  or success-body corruption.

### ACC-FMC-009 — Existing surface zero regression and closure

- Contracts: `CTR-FMC-010`, `CTR-FMC-013`, `CTR-FMC-014`
- Method: compare canonical projections, run full Broker suite, inspect exact diff,
  and run structure verifier against implementation merge base.
- Required evidence: projection diff, test log, name-status, structure output.
- Expected result: only three V3 surface deltas; V2 behavior unchanged;
  structure pass; no rule/registry change.
- Failure condition: any fourth delta, test failure, unauthorized file, or gate
  violation.

### ACC-FMC-010 — Skill/documentation drift truth

- Contracts: `CTR-FMC-002`, `CTR-FMC-017..020`
- Method: review exact documentation against model-visible tool definitions.
- Required evidence: name/argument matrix and external-repository ownership note.
- Expected result: real independent `forum_*` names; no create-thread `content`;
  mentions/tag/readiness present; notification reason flow preserved; no claim
  that this repo changed the external Skill.
- Failure condition: wrapper-name fiction, fictional parameter, missing V3 field,
  alias tool, or cross-repository authority claim.

### ACC-FMC-011 — Lifecycle and PR #105 boundary

- Contracts: `CTR-FMC-005`, `CTR-FMC-016`
- Method: inspect Spec lifecycle, authoring diff, PR #105 head, and side effects.
- Required evidence: exact commits and PR file lists.
- Expected result: this round adds one Spec file; V2 remains accepted; PR #105
  remains at observed head and Draft; product/production changes none.
- Failure condition: product/test/Skill file in this PR, V2 edit, PR #105 change,
  acceptance, merge, implementation, deploy, or apply.

## 11. Alternatives and disposition

- `ALT-FMC-001` — add backend routes: **rejected**; observed source already owns
  the wire behavior and this repo does not govern it.
- `ALT-FMC-002` — expose moderator tools fleet-wide: **rejected**; least-visible
  surface remains required.
- `ALT-FMC-003` — writer resolve/archive: **rejected**; separate product decision.
- `ALT-FMC-004` — `forum.admin` or wildcard: **rejected**; scope expansion is
  forbidden.
- `ALT-FMC-005` — credentials in child/Broker args: **rejected** by trusted
  identity and credential boundaries.
- `ALT-FMC-006` — generic transport refactor: **rejected**; existing schema and
  mapping support all V3 shapes.
- `ALT-FMC-007` — edit V2 or partially supersede it in prose: **rejected**;
  accepted authority changes by whole successor transaction.
- `ALT-FMC-008` — add `my_mentions`/`my_updates`: **rejected**; existing
  notification reason selector is sufficient.
- `ALT-FMC-009` — make readiness write-capable: **rejected**; requested surface is
  read-only and existing `forum.read` is sufficient.
- `ALT-FMC-010` — retain legacy Skill command names or fictional create-thread
  `content`: **rejected**; documentation must match independent Broker tools.
- `ALT-FMC-011` — modify PR #105: **rejected for this task**; it is an existing
  V2 implementation Draft and is explicitly frozen.
- `ALT-FMC-012` — implement/merge/deploy together with Spec authoring:
  **rejected** by lifecycle separation.

## 12. Migration, compatibility, and rollback

### 12.1 Proposed-state compatibility

This Draft changes no active authority or runtime. V2 stays accepted; PR #105
stays Draft and untouched. There is no migration or rollback action in this round.

### 12.2 Future V2 → V3 supersession transaction

Only a future docs-only transaction after independent semantic review may
atomically perform:

```text
V3.status: proposed -> accepted
V3.implementation_authority: none -> contracts
V2.status: accepted -> superseded
V2.implementation_authority: contracts -> none
V2.superseded_by: null -> AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V3
```

A partial transaction is invalid. After acceptance, V3 alone governs new Forum
implementation; V2 remains historical. Production apply authority remains none.

### 12.3 Future implementation compatibility

A separately authorized implementation starts from fresh main containing accepted
V3. Existing seven tools, all V2 normal/moderator tools, non-Forum manifests,
identity, scopes, errors, sanitizer, and visibility remain compatible. Only the
three deltas in §1 may appear. Any required backend or external Skill change is
owned by `mayf3/agent-forum` and needs separate authority there.

### 12.4 Future rollback

Rollback of a later Broker deployment is the exact prior Broker package/bundle
revision. Grant rollback remains Auth-owned. No fallback may expose moderator
tools fleet-wide, add notification aliases, broaden readiness, or retain partial
message writes after mention validation failure.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
PRODUCTION_APPLY_AUTHORITY = none
PR_105_CHANGED = NO
```

## 14. V2 → V3 whole-supersession coverage audit

| V2 normative area | V3 location | Disposition |
|---|---|---|
| Goal, server reuse, generic path, tool counts | §1 | fully restated; count adds one V3 tool |
| Scope/non-goals/trust boundaries | §2 | fully restated; no scope broadening beyond three deltas |
| Authority/external ownership | §3 | fully restated; V3 source observation added |
| State/Observations/Claims/Evidence | §§4–7 | V2 load-bearing meaning restated; V3 observations added |
| DEC-FMC-001..006 | §8 | fully restated in normative meaning |
| V2 five normal tools | `CTR-FMC-002` | fully restated; readiness added; create-thread no-content made explicit |
| V2 eight moderator tools | `CTR-FMC-003..009` | fully restated unchanged |
| Seven-tool invariance | `CTR-FMC-010` | restated with only named V3 exceptions |
| Identity/security/generic deltas | `CTR-FMC-011..013` | fully restated unchanged |
| Structure/closure | `CTR-FMC-014` | V2 responsibilities and gate preserved; implementation must re-freeze exact future diff |
| Auth/lifecycle | `CTR-FMC-015..016` | fully restated unchanged; PR #105 frozen |
| — | `CTR-FMC-017` | new: reply mentions |
| — | `CTR-FMC-018` | new: list tag |
| — | `CTR-FMC-019` | new: read-only readiness |
| Skill compatibility truth | `CTR-FMC-020` | drift explicitly documented; no external authority expansion |
| Complete route inventory | §9.1 | all V2 routes restated; one readiness GET added |
| Acceptance obligations | §10 | complete V2 behavior plus three deltas and Skill drift |
| Alternatives | §11 | V2 alternatives retained in meaning; V3 alternatives added |
| Migration/rollback/lifecycle | §12 | fully restated for V3 whole successor |

```text
V2_ACTIVE_CONTRACTS_RESTATED = 16 / 16
V3_NEW_PRODUCT_SURFACE_DELTAS = 3 / 3
MY_MENTIONS_NEW_TOOL = NO
MY_UPDATES_NEW_TOOL = NO
READINESS_WRITE_OPERATION = NO
SCOPE_EXPANSION = NO
PARTIAL_SUPERSESSION = NONE
```

## 15. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V3
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1
SUPERSEDES = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2 (whole, only on future atomic acceptance)
EXTERNAL_AUTHORITIES = NONE (read-only pinned source observation only)
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 20
CONTRACTS_WITH_ACCEPTANCE = 20
V3_PRODUCT_SURFACE_DELTA_COUNT = 3
PR_105_CHANGED = NO
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
AUTHORING_READY_FOR_REVIEW = YES
NEXT_TASK = 坛面 审计
```
