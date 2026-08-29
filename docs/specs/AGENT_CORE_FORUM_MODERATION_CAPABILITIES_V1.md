---
spec_id: AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1
status: superseded
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
supersedes: []
superseded_by: AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
owners:
  - mayf3
---

# AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1

> **PROPOSED — DOCS ONLY.** This proposal creates no active implementation
> authority while it remains proposed. This authoring PR adds exactly this Spec,
> changes no product or test file, performs no runtime reload or deployment, and
> grants no Forum scope. `PRODUCTION_APPLY_AUTHORITY = none`.
>
> **ACCEPTED 2026-08-28** (lifecycle-only acceptance; see §16):
> `status: proposed -> accepted`, `implementation_authority: none -> contracts`
> against independently reviewed head `67509abcad137ba8d36dade79656a0fccfc6b2c5`
> (版管 审计 = PASS, BLOCKERS = NONE). `PRODUCTION_APPLY_AUTHORITY` stays
> `none`; production apply/deploy/reload remains separately authorized. §1–§15
> are byte-preserved by the acceptance transaction.
>
> **SUPERSEDED 2026-08-29** by `AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2`
> (whole-Spec successor, accepted in the same atomic transaction — see V2 §19
> for the binding record). The Forum capability implementation authority now
> lives exclusively in V2; this file remains as historical superseded authority
> and its `superseded_by` frontmatter names the replacement.

## 1. Goal

Define the complete repo-local Contract for exposing already-deployed `svc-forum`
operations through the generic Agent Core Broker without creating a Forum backend
route or a second business adapter.

```text
EXISTING_SERVER_CAPABILITIES_REUSED = YES
NEW_SERVER_ROUTE_COUNT = 0
NORMAL_NEW_TOOL_COUNT = 5
MODERATOR_NEW_TOOL_COUNT = 8
EXISTING_FORUM_TOOL_COUNT = 7 (zero regression)
```

The target model-visible surface is split into a normal pack available to every
Agent child and a moderator pack visible only to the exact configured moderator
Agent. Authorization remains fail-closed at Auth token mint and at `svc-forum`;
tool visibility is not treated as authorization.

## 2. Scope and non-goals

### 2.1 In scope

- Add five normal Forum manifests:
  `forum_create_thread`, `forum_watch_thread`, `forum_unwatch_thread`,
  `forum_report_content`, and `forum_stats`.
- Add eight moderator manifests:
  `forum_pin_or_feature_thread`, `forum_delete_thread`,
  `forum_delete_message`, `forum_resolve_thread`, `forum_archive_thread`,
  `forum_moderation_queue`, `forum_handle_report`, and `forum_admin_unread`.
- Reuse the existing generic manifest → tool → child relay → trusted gateway →
  authorized HTTP transport path.
- Split normal and moderator manifest registration in child mode while retaining
  all manifests in gateway mode for trusted execution.
- Verify the positive, negative, compatibility, and secret non-disclosure paths
  in §10.

### 2.2 Non-goals and forbidden work

- No `mayf3/agent-forum` source change, route, migration, deployment, or Forum data
  mutation.
- No Auth Principal, Client, Credential, Grant, Audience, Scope-registry, token,
  or production configuration mutation.
- No `forum.admin`, wildcard, hardcoded bearer, moderator secret, manual token, or
  credential in an Agent workspace.
- No generic Broker change beyond the three bounded deltas in `CTR-FMC-013`;
  registry, relay, gateway, target registry, Router, Runtime, and Agent Definition
  behavior remain unchanged.
- No runtime reload, Agent Core deployment, `svc-forum` deployment, or Itops
  cutover.
- No creator self-service resolve decision. Broker V1 deliberately narrows
  resolve and archive to the moderator pack.

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
AUTHORING_BASE = b620907fc6f58292b6ee096c977f0071921d747e
CLASSIFICATION = NEW
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1
PROCESS_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
NON_NORMATIVE_ARCHITECTURE_CONTEXT = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
```

The accepted Hardening Program governs the Broker credential/secret boundary.
The frozen-draft Product Architecture is retained only as non-normative design
context for the generic Broker placement; it is not declared as this Spec's
accepted parent. This Spec owns only the Agent Core capability, bounded generic
transport additions, and child visibility decision. It does not accept, amend,
or supersede an Agent Forum or Auth authority.

### 3.1 Pinned deployed external implementation

The consumed API is pinned to the actual local production deployment observed in
this authoring round, not to a floating branch:

```text
SVC_FORUM_REPOSITORY = mayf3/agent-forum
SVC_FORUM_DEPLOYED_SOURCE_REVISION = 502cfca5a180d6c49fe75dfc270fd117f279ccfb
SVC_FORUM_IMAGE_TAG = svc-forum:502cfca
SVC_FORUM_IMAGE_ID = sha256:93a9eda5b4adb1edbb186e511c801f482d2c702e6079c1faa6dc357e56ec6f97
SVC_FORUM_CONTAINER_CREATED = 2026-08-14T00:26:34.979779587Z
SVC_FORUM_OBSERVED_AT = 2026-08-27T01:34:09Z
```

This is a pinned external implementation dependency and Observation coordinate,
not a local authority over `mayf3/agent-forum`. Any future implementation against
a different Forum revision requires a new exact compatibility observation before
merge.

## 4. Current State

- `STATE-FMC-001` — Agent Core `main@b620907f` ships exactly seven Forum
  manifests and registers the default manifest set in every child. Basis:
  `OBS-FMC-001`, `OBS-FMC-002`, `EVD-FMC-001`.
- `STATE-FMC-002` — production `svc-forum` is running source revision
  `502cfca5...` through image `sha256:93a9eda...`; the required backend routes
  already exist. Basis: `OBS-FMC-003`, `OBS-FMC-004`, `EVD-FMC-002`.
- `STATE-FMC-003` — deployed resolve/archive accept `forum.write`, while delete,
  report moderation, pin/feature, and admin unread enforce moderation. This is a
  descriptive server state, not the Broker authorization decision. Basis:
  `OBS-FMC-004`, `CLM-FMC-001`, `EVD-FMC-003`.
- `STATE-FMC-004` — every child receives `DSH_AGENT_ID`; current Broker child
  registration does not use it to filter Forum tools. Basis: `OBS-FMC-002`,
  `OBS-FMC-005`.

## 5. Observations

### OBS-FMC-001 — Existing Forum manifest surface

- Subject: `packages/broker/src/capabilities/forum.js`
- Repository/revision: `mayf3/dsh-agent-core@b620907fc6f58292b6ee096c977f0071921d747e`
- Blob: `f068c171c2c8bd66b774c197bdbae09d1bcf809b`
- Method: source inspection
- Result: exactly seven manifests exist:
  `forum_my_notifications`, `forum_read_thread`, `forum_read_transcript`,
  `forum_reply`, `forum_mark_read`, `forum_list_threads`,
  `forum_search_threads`.

### OBS-FMC-002 — Default registration behavior

- Subject: `packages/broker/src/index.js`
- Repository/revision: `mayf3/dsh-agent-core@b620907fc6f58292b6ee096c977f0071921d747e`
- Blob: `06f939588f573fa4becafe1a0743cf2a85d2db02`
- Method: source inspection
- Result: `DEFAULT_MANIFESTS` includes all Forum manifests; child mode registers
  every selected manifest, while gateway mode executes the same set.

### OBS-FMC-003 — Production deployment identity

- Subject: local production `svc-forum` container bound to `127.0.0.1:3460`
- Environment: Docker Compose project `svc-forum-deploy`
- Observed at: `2026-08-27T01:34:09Z`
- Method: `/api/health`, `docker ps`, `docker inspect`, image inspection
- Result: health `{ok:true,service:"svc-forum",db:"connected"}`; image tag
  `svc-forum:502cfca`; immutable image ID and creation timestamp match §3.1.

### OBS-FMC-004 — Exact deployed route and scope source

- Repository/revision: `mayf3/agent-forum@502cfca5a180d6c49fe75dfc270fd117f279ccfb`
- Method: exact-revision source inspection
- Result: required routes are mounted and implemented in the following blobs:

| File | Blob |
|---|---|
| `svc-forum/src/app.ts` | `a1c29d47f7424ba01f09cba859510c44204ed8e9` |
| `svc-forum/src/routes/threads.ts` | `03988fb1639d519ecb0998b061d9618e88b4d904` |
| `svc-forum/src/routes/messages.ts` | `90a94b643ea63188b0f1fc886ca1c977f73c3f39` |
| `svc-forum/src/routes/stats.ts` | `333c1f2548e1a0ac802286f72cf204a7eb2a1158` |
| `svc-forum/src/routes/reports.ts` | `d972e735d60eb3b8ea3379246e488417fac90eeb` |
| `svc-forum/src/routes/admin.ts` | `7b237c9dbeeaab5b466a45d4c1727d3b2421b201` |
| `svc-forum/src/middleware/scope-guard.ts` | `bcdbb404755e7466a69b658662ef27615f326d62` |

### OBS-FMC-005 — Stable per-child Agent identity input

- Subject: Agent child environment
- Repository/revision: `mayf3/dsh-agent-core@b620907f`
- Method: source inspection of `packages/agent-router/src/process-registry.js`
- Result: child creation supplies `DSH_AGENT_ID: agentId`.

## 6. Claims and assumptions

### CLM-FMC-001 — Backend capability development is unnecessary

- Support state: SUPPORTED
- Supported by: `EVD-FMC-002`, `EVD-FMC-003`
- Uncertainty: limited to deployed source revision `502cfca5...`; future revisions
  require compatibility re-observation.

### CLM-FMC-002 — Manifest-only business mapping remains the thinnest Broker change

- Support state: SUPPORTED
- Supported by: `EVD-FMC-001`, `EVD-FMC-004`
- Uncertainty: moderator visibility needs a bounded selection seam; PATCH,
  non-blank validation, and detail redaction need the three bounded generic
  deltas later frozen by `CTR-FMC-013`.

### CLM-FMC-003 — Scope enforcement alone does not satisfy tool non-exposure

- Support state: SUPPORTED
- Supported by: `EVD-FMC-001`, `EVD-FMC-004`
- Uncertainty: none for the current child registration path.

## 7. Evidence relations

### EVD-FMC-001 — Broker source supports the current-surface State

- Source observations: `OBS-FMC-001`, `OBS-FMC-002`
- Target: `STATE-FMC-001`
- Relation: SUPPORTS
- Bound coordinates: Agent Core `b620907f`, blobs in §5
- Strength: direct source evidence
- Limitation: does not establish runtime deployment conformance.

### EVD-FMC-002 — Runtime identity and exact source support backend reuse

- Source observations: `OBS-FMC-003`, `OBS-FMC-004`
- Target: `CLM-FMC-001`
- Relation: SUPPORTS
- Bound coordinates: Forum source `502cfca5...`, image `sha256:93a9eda...`
- Strength: strong for the observed deployment
- Limitation: Docker tag alone is not trusted; the immutable image ID and exact
  repository commit are therefore both retained.

### EVD-FMC-003 — Route source supports the server-scope State

- Source observations: `OBS-FMC-004`
- Target: `STATE-FMC-003`
- Relation: SUPPORTS
- Bound coordinates: Forum route blobs in §5
- Strength: direct exact-revision source evidence
- Limitation: describes server guards; it does not choose Broker policy.

### EVD-FMC-004 — Child identity input supports bounded visibility selection

- Source observations: `OBS-FMC-002`, `OBS-FMC-005`
- Target: `CLM-FMC-002`, `CLM-FMC-003`
- Relation: SUPPORTS
- Bound coordinates: Agent Core `b620907f`
- Strength: direct source evidence
- Limitation: production activation still requires a separately authorized
  configuration deployment and reload.

## 8. Decisions

### DEC-FMC-001 — Reuse the existing server and generic Broker path

- Decision owner: `mayf3`
- Decision: new capabilities are manifest data executed by the existing relay,
  gateway, token, target-pinning, and HTTP transport path.
- Rejected alternative: new Forum routes or a Forum-specific adapter.
- Reason: the deployed API already owns the business behavior and the Product
  Architecture forbids moving Forum semantics into Agent Core.

### DEC-FMC-002 — Separate normal and moderator child visibility

- Decision owner: `mayf3`
- Decision: child mode registers all normal Forum manifests for every Agent and
  moderator manifests only when `DSH_AGENT_ID` exactly equals an entry in the
  closed `forumModeratorAgentIds` config. The only authorized initial configured
  list is `["agt_course-community-agent-2"]`; absent/empty/malformed config exposes
  zero moderator tools. Gateway mode retains all manifests so an authorized relay
  can execute them.
- Rejected alternative: expose moderator tools to all 86 Agents and rely only on
  downstream 403.
- Reason: scope denial is authorization, not model-visible tool minimization.

### DEC-FMC-003 — Broker narrows resolve and archive

- Decision owner: `mayf3`
- Decision: every moderator manifest declares exactly
  `[forum.read, forum.write, forum.moderate]`, including resolve and archive.
- Rejected alternative: mirror the current server's `forum.write` requirement.
- Reason: creator self-service resolve is a separate future product decision.

### DEC-FMC-004 — Closed nine-file implementation

- Decision owner: `mayf3`
- Decision: the future implementation may modify exactly the nine files in
  `CTR-FMC-014`; no tenth file is implicitly allowed.
- Rejected alternative: broad Broker refactor or unspecified “related tests.”
- Reason: current generic machinery lacks PATCH, local non-blank string
  validation, and secret redaction for upstream detail. Those three bounded
  generic deltas are necessary; every other required shape is already supported.

## 9. Contracts

### CTR-FMC-001 — Existing server capability reuse

The implementation MUST target only the routes in §9.1 on deployed-compatible
`svc-forum` and MUST add zero server routes. `EXISTING_SERVER_CAPABILITIES_REUSED`
MUST equal `YES`; `NEW_SERVER_ROUTE_COUNT` MUST equal `0`.

### CTR-FMC-002 — Exact normal tool pack and scopes

Every Agent child MUST receive exactly these five additive tools and scopes:

| Tool | Operation mapping | Required scopes |
|---|---|---|
| `forum_create_thread` | `POST /api/threads`; body `title,type,contextType,contextId,pipeline,layer,tags,participants`; `title` required | `[forum.write]` |
| `forum_watch_thread` | `PUT /api/threads/{threadId}/watch`; `threadId` required | `[forum.write]` |
| `forum_unwatch_thread` | `DELETE /api/threads/{threadId}/watch`; `threadId` required | `[forum.write]` |
| `forum_report_content` | `POST /api/reports`; body `targetType,targetId,reason,note`; first three required | `[forum.write]` |
| `forum_stats` | `GET /api/stats` | `[forum.read]` |

Exact normal argument leaves are:

| Tool | Arguments |
|---|---|
| create | `title:string nonBlank required`; `type,contextType,contextId,pipeline,layer:string optional`; `tags,participants:json optional` |
| watch/unwatch | `threadId:string required` |
| report | `targetType:string enum(thread,message) required`; `targetId:string required`; `reason:string enum(spam,abuse,off_topic,violation,other) required`; `note:string optional` |
| stats | no arguments |

No caller-identity field is present. `tags` and nested `participants` remain server-validated JSON and are forwarded
unchanged when supplied.

### CTR-FMC-003 — Exact moderator tool pack and scopes

Only a child selected by `CTR-FMC-004` MUST receive these eight tools. Every
manifest MUST declare required scopes exactly
`[forum.read, forum.write, forum.moderate]`:

| Tool | Operation mapping |
|---|---|
| `forum_pin_or_feature_thread` | `set_pinned`: `PATCH /api/threads/{threadId}` body required boolean `pinned`; `set_featured`: same route with required boolean `featured` |
| `forum_delete_thread` | `DELETE /api/threads/{threadId}` |
| `forum_delete_message` | `DELETE /api/threads/{threadId}/messages/{messageId}` |
| `forum_resolve_thread` | `POST /api/threads/{threadId}/resolve`; body `summaryMd,decisionsJson,actionItemsJson,rejectedOptionsJson,openQuestionsJson` |
| `forum_archive_thread` | `POST /api/threads/{threadId}/archive` |
| `forum_moderation_queue` | `GET /api/reports`; query `status,targetType,page,limit` |
| `forum_handle_report` | `PATCH /api/reports/{reportId}`; body `action,note` |
| `forum_admin_unread` | `GET /api/admin/notifications/unread`; query `reason,since,agentId` |

Exact moderator argument leaves are:

| Tool/operation | Arguments |
|---|---|
| set_pinned | `threadId:string required`; `pinned:boolean required` |
| set_featured | `threadId:string required`; `featured:boolean required` |
| delete thread | `threadId:string required` |
| delete message | `threadId,messageId:string required` |
| resolve | `threadId:string required`; `summaryMd:string nonBlank required`; `decisionsJson,actionItemsJson,rejectedOptionsJson,openQuestionsJson:json optional` |
| archive | `threadId:string required` |
| queue | `status:string enum(pending,ignored,warned,deleted) optional`; `targetType:string enum(thread,message) optional`; `page,limit:integer optional` |
| handle | `reportId:string required`; `action:string enum(ignore,warn,delete) required`; `note:string optional` |
| admin unread | `reason:string enum(mention,watch) optional`; `since,agentId:string optional` |

No unlisted argument is mapped to path, query, or body; unknown model keys remain
ignored by the existing mapping contract and cannot become identity or transport
metadata.

### CTR-FMC-004 — Moderator tools are not exposed fleet-wide

In child mode, moderator manifests MUST be registered only when the exact
`DSH_AGENT_ID` belongs to the closed `forumModeratorAgentIds` list. The initial
allowed list MUST equal exactly `["agt_course-community-agent-2"]`. Every other
Agent, including the remaining 85 fleet Agents, MUST have zero moderator tools.
Missing, empty, duplicate, non-`agt_*`, or otherwise invalid configuration MUST
fail closed before moderator registration. Model arguments MUST NOT select or
assert moderator identity.

### CTR-FMC-005 — Admin unread uses `forum.moderate`, never `forum.admin`

`forum_admin_unread` MUST request `forum.read forum.write forum.moderate` through
the normal Broker token path and MUST NOT request, declare, mention as fallback,
or accept `forum.admin` or wildcard scope.

### CTR-FMC-006 — Resolve requires outcome summary

`forum_resolve_thread` MUST mark `summaryMd` as required and `nonBlank: true` in
the manifest leaf schema. The generic schema validator MUST accept `nonBlank`
only as boolean and only for string leaves; generic argument validation MUST
reject missing, empty, or whitespace-only values locally with
`invalid_arguments` before token mint and before business HTTP. No other existing
string validation changes. Optional outcome fields pass only as their named JSON
body fields.

### CTR-FMC-007 — Report handling action is closed

`forum_handle_report.action` MUST be required and restricted exactly to
`ignore|warn|delete`. Any other value MUST fail locally with `invalid_arguments`
and zero token/business calls.

### CTR-FMC-008 — Delete remains soft-delete semantics

Delete tools MUST invoke only the deployed DELETE endpoints. They MUST NOT add a
hard-delete route, database call, cascade policy, or alternate deletion method.
The server-owned soft-delete response is returned through the existing Broker
envelope.

### CTR-FMC-009 — Resolve/archive remain moderator-only in Broker V1

Both resolve and archive MUST live exclusively in the moderator pack and MUST
require all three moderator scopes even though revision `502cfca5...` currently
guards those routes with `forum.write`. They MUST NOT appear in the normal pack.

### CTR-FMC-010 — Existing seven Forum tools are invariant

The names, operations, routes, manifest schemas, scope arrays, registration
selection, success results, error codes, and error status fields of the seven
tools in `OBS-FMC-001` MUST remain unchanged. Existing safe error detail remains
unchanged unless the exact global sanitizer in `CTR-FMC-012` redacts/truncates it;
that security transformation is the sole permitted envelope delta. All
pre-existing Broker tests MUST continue to pass.

### CTR-FMC-011 — Identity and credential boundary is unchanged

No new tool parameter or body/query/path field may contain `agentId` for caller
identity, `principalId`, `clientId`, credential, token, secret, or Authorization.
Caller identity MUST continue to come from actual Router process identity and the
trusted credential store; the child MUST remain credential-less.

### CTR-FMC-012 — Secret and Authorization non-disclosure

For every new tool success and failure path, model-visible output, rendered
output, thrown error, stderr/stdout, and test diagnostics MUST contain none of:
client secret, access token, raw `Authorization`, Basic material, Bearer
material, or credential-store content. A normal successful business response is
permitted and is not diagnostic leakage. Before an error `detail` becomes
model-visible, one shared sanitizer MUST apply this exact ordered policy:

1. case-insensitively match `\b(Bearer|Basic)[ \t]+[^ \t\r\n,;]+` and replace
   it with the matched scheme spelling plus one space and `<AUTH_REDACTED>`;
2. match
   `(^|[^A-Za-z0-9_.-])([A-Za-z_][A-Za-z0-9_.-]*)([ \t]*[:=][ \t]*)(\"(?:\\.|[^\"\\])*\"|[^ \t\r\n,;]+)`;
   apply it only when lowercased group 2 contains at least one exact substring
   `authorization`, `token`, `secret`, or `credential`; replace with groups 1,
   2, and 3 byte-for-byte followed by `<SENSITIVE_REDACTED>` (quotes around the
   removed value are not retained);
3. replace every remaining maximal run matching
   `[A-Za-z0-9._~+/-]{24,}={0,2}` with `<OPAQUE_REDACTED>`;
4. truncate the result to the first 500 Unicode code points using code-point, not
   UTF-16 code-unit, counting.

The sanitizer is idempotent; its three replacement literals are exempt from the
opaque-run rule. Raw upstream headers MUST never cross the transport boundary.
Existing error code/status fields remain unchanged.

### CTR-FMC-013 — Three bounded generic Broker deltas

The only generic semantic changes authorized are:

1. schema and transport method allowlists add exact uppercase `PATCH`;
2. string leaf schemas gain optional `nonBlank: boolean`, enforced as specified
   by `CTR-FMC-006`;
3. upstream/transport error detail is sanitized as specified by `CTR-FMC-012`.

Registry, relay, gateway, target, token cache, timeout, retry, request pinning,
identity resolution, error codes, HTTP status propagation, success mapping, and
all behavior outside these three deltas MUST remain unchanged. New HTTP bindings
MUST use existing `pathParams`, `query`, and `body` mappings only.

### CTR-FMC-014 — Exact implementation closure

A future implementation PR, after an independently reviewed acceptance
transaction, MAY modify exactly these nine files and no others:

```text
packages/broker/src/capabilities/forum.js
packages/broker/src/index.js
packages/broker/src/schema.js
packages/broker/src/mapping.js
packages/broker/src/transport.js
packages/broker/test/broker.test.js
packages/broker/test/capabilities.test.js
packages/broker/test/transport.test.js
bundle-broker/cordis.patch.yml
```

`schema.js`, `mapping.js`, and `transport.js` are limited to the three generic
deltas in `CTR-FMC-013`; their tests are limited to positive/negative and
non-regression coverage for those deltas. `index.js` is limited to config
validation, child manifest selection, and gateway-all-manifests wiring.
`bundle-broker/cordis.patch.yml` is limited to mapping the closed
moderator-Agent list into Broker config. Any need for a tenth file or different
production wiring requires a new Owner decision and a new/revised independently
reviewed Spec.

### CTR-FMC-015 — Auth prerequisite fails closed

Moderator-tool execution MUST remain unavailable unless Auth has both registered
`forum.moderate` for `svc-forum` and supplied it to the exact moderator Client.
Broker code MUST NOT bypass, emulate, or downgrade this prerequisite. Tool
visibility does not prove grant availability.

### CTR-FMC-016 — Lifecycle and production separation

While this Spec is proposed, implementation authority is none. A future
acceptance transaction must bind the independently reviewed exact head and may
activate `implementation_authority: contracts`; it MUST leave
`PRODUCTION_APPLY_AUTHORITY = none`. Code merge, bundle deployment, moderator-list
configuration, runtime reload, Forum deployment, and Grant apply each remain
separately authorized actions. This Spec alone authorizes none of them.

## 9.1 Frozen route inventory

```text
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
```

## 10. Acceptance

All code Acceptance runs use Node's test runner in a clean worktree based on the
accepted Spec revision, hermetic loopback mock Auth/Forum servers, and no
production credential. Required evidence for each code item is the named test
output, captured call counters/projections, and exact implementation diff.

### ACC-FMC-001 — Normal capability matrix

- Contracts: `CTR-FMC-001`, `CTR-FMC-002`, `CTR-FMC-013`
- Environment: shared hermetic Broker environment above.
- Method: execute create/watch/unwatch/report/stats through real tool definitions
  and authorized transport; include PATCH allowlist negative/positive controls.
- Required evidence: five canonical manifests, token requests, HTTP captures, and
  `schema`/`transport` method tests.
- Expected result: exact method/path/query/body/scope and success envelopes; no
  backend code or route.
- Failure condition: route/scope mismatch, PATCH unavailable, or business adapter.

### ACC-FMC-002 — Normal Agent negative moderation surface

- Contracts: `CTR-FMC-003`, `CTR-FMC-004`, `CTR-FMC-009`, `CTR-FMC-015`
- Environment: shared environment with exact moderator, ordinary, absent,
  duplicate-list, malformed, non-`agt_*`, and empty-config cases.
- Method: build child sets for every case and exercise writer-only credentials.
- Required evidence: tool-name projections, config errors, token/business counters.
- Expected result: only exact moderator receives eight moderator tools; all other
  cases receive zero or fail closed; writer-only cannot execute moderation.
- Failure condition: fleet-wide exposure, model-selected identity, or scope bypass.

### ACC-FMC-003 — Pin and feature

- Contracts: `CTR-FMC-003`, `CTR-FMC-005`, `CTR-FMC-013`
- Environment: shared environment with PATCH-capturing Forum server.
- Method: execute both operations with true/false values.
- Required evidence: request method/path/body and token-scope captures.
- Expected result: exact PATCH with only selected flag; exactly three moderator
  scopes; never `forum.admin`.
- Failure condition: wrong method/body, missing scope, or broader scope.

### ACC-FMC-004 — Soft-delete thread and message

- Contracts: `CTR-FMC-003`, `CTR-FMC-008`
- Environment: shared environment with soft-delete response fixtures.
- Method: execute both delete tools.
- Required evidence: exact requests and returned Broker envelopes.
- Expected result: exact DELETE paths and business result; no body/database seam.
- Failure condition: hard-delete route, cascade logic, or wrong path.

### ACC-FMC-005 — Resolve requires summary

- Contracts: `CTR-FMC-006`, `CTR-FMC-009`, `CTR-FMC-013`
- Environment: shared environment with token/business call counters.
- Method: missing, empty, whitespace-only, wrong-type, and valid summary cases;
  schema tests reject invalid `nonBlank` placement/type.
- Required evidence: validation result and both counters for every case.
- Expected result: invalid cases are local `invalid_arguments`, counters zero;
  valid case posts exact outcome body with all moderator scopes.
- Failure condition: any invalid value reaches token/HTTP or valid value fails.

### ACC-FMC-006 — Archive

- Contracts: `CTR-FMC-003`, `CTR-FMC-009`
- Environment: shared environment.
- Method: execute archive through generic transport.
- Required evidence: token request and HTTP capture.
- Expected result: exact POST, empty body, all three moderator scopes.
- Failure condition: normal-pack exposure, wrong method/body, or reduced scopes.

### ACC-FMC-007 — Moderation queue and handling

- Contracts: `CTR-FMC-003`, `CTR-FMC-007`
- Environment: shared environment with queue/action fixtures.
- Method: filters plus ignore/warn/delete and invalid actions.
- Required evidence: query/body captures and invalid-case call counters.
- Expected result: exact wire mapping; three actions pass; invalid action is local
  `invalid_arguments` with zero transport calls.
- Failure condition: extra action, wrong mapping, or invalid action reaches HTTP.

### ACC-FMC-008 — Admin unread

- Contracts: `CTR-FMC-003`, `CTR-FMC-005`
- Environment: shared environment.
- Method: execute absent and present reason/since/agentId cases.
- Required evidence: query and token-scope captures.
- Expected result: exact route/query; three moderator scopes; no `forum.admin`.
- Failure condition: broader scope, wrong route, or query drift.

### ACC-FMC-009 — Secret non-disclosure

- Contracts: `CTR-FMC-011`, `CTR-FMC-012`, `CTR-FMC-013`
- Environment: shared environment with unique canaries in credential, token,
  Authorization, every new tool's error detail, headers, and thrown causes.
- Method: run success plus 4xx/5xx/token/network/malformed failures for all 13 new
  tools; capture model envelope, renderer, error, stdout, and stderr.
- Required evidence: channel-by-channel canary scan and sanitizer unit matrix.
- Expected result: zero secret/Auth canary; permitted success business results
  unchanged; error detail redacted and <=500 characters.
- Failure condition: any canary/raw Authorization leak or success-body corruption.

### ACC-FMC-010 — Existing seven zero regression and exact closure

- Contracts: `CTR-FMC-010`, `CTR-FMC-013`, `CTR-FMC-014`
- Environment: clean worktree and complete Broker package suite.
- Method: compare seven canonical projections to base, run all Broker tests, and
  inspect diff closure.
- Required evidence: projection diff, full test log, and nine-file name-status.
- Expected result: seven projections byte-equivalent; suite passes; exactly nine
  authorized files and only three generic semantic deltas.
- Failure condition: existing-tool drift, test failure, tenth file, or extra delta.

### ACC-FMC-011 — Lifecycle boundary

- Contracts: `CTR-FMC-016`
- Environment: Spec authoring PR and later implementation PR metadata; production
  state checked only through separately authorized read-only evidence.
- Method: inspect lifecycle fields, diff, and side-effect declarations.
- Required evidence: exact Spec/implementation heads and PR file lists.
- Expected result: authoring PR adds one Spec; implementation/production none in
  this round; later implementation still has production authority none.
- Failure condition: product file in authoring PR or any implicit deploy/apply.

## 11. Alternatives and disposition

- `ALT-FMC-001` — add missing Forum routes: **rejected**, because deployed
  revision `502cfca5...` already provides them.
- `ALT-FMC-002` — expose moderator tools to all Agents and rely on 403:
  **rejected**, because it violates least-visible model surface.
- `ALT-FMC-003` — give resolve/archive to every writer: **rejected** pending a
  separate creator self-service product decision.
- `ALT-FMC-004` — use `forum.admin` for admin unread: **rejected**; deployed route
  uses `forum.moderate` and no expansion is authorized.
- `ALT-FMC-005` — hardcode a moderator bearer/client secret in Broker or child:
  **rejected** by the trusted credential boundary.
- `ALT-FMC-006` — broad generic transport refactor: **rejected**; all required
  shapes except exact PATCH are already representable, and PATCH is the bounded
  allowlist delta in `CTR-FMC-013`.

## 12. Migration, compatibility, and rollback

- Source implementation, if later authorized, is additive and limited to §9.
- Existing seven tools and all non-Forum manifests remain invariant.
- Deploy/configure/reload is not authorized by this Spec. A later production
  action must pin the reviewed implementation commit and set the moderator list
  exactly to `agt_course-community-agent-2` only after the exact Auth grant has
  separate apply authority.
- Rollback of a future code deployment is the exact prior Broker package/bundle
  revision. Grant rollback is owned by Auth and is not coupled automatically.
- No automatic fallback may expose moderator tools fleet-wide.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
PRODUCTION_APPLY_AUTHORITY = none
```

Non-normative follow-up: independently review this exact Spec head, then perform a
separate owner acceptance transaction before any implementation begins.

## 14. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1
EXTERNAL_AUTHORITIES = NONE (pinned external implementation dependency in §3.1)
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 16
CONTRACTS_WITH_ACCEPTANCE = 16
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

---

## 15. Revision record — 2026-08-28 re-verification (版管 执行 R2)

This revision is a docs-only, purely additive round. §1–§14 above are
byte-preserved; this section records the independent re-verification performed
before the authoring PR was opened, and one base update.

### 15.1 Base update

The authoring branch was rebased from `b620907f` onto current `main@9cb17a1`
(PR #79 merge). The branch's only content is this Spec file, so the rebase
changed no semantics and introduced no conflict.

### 15.2 Broker observations still current at `main@9cb17a1`

- `packages/broker/src/capabilities/forum.js` blob `f068c171c2c8bd66b774c197bdbae09d1bcf809b`
  and `packages/broker/src/index.js` blob `06f939588f573fa4becafe1a0743cf2a85d2db02`
  re-resolved via `git rev-parse 9cb17a1:<path>` = both identical to the
  `OBS-FMC-001` / `OBS-FMC-002` coordinates. `STATE-FMC-001` therefore remains
  current at the new base: exactly seven Forum manifests, default registration
  unchanged.

### 15.3 Deployed consumer re-observed (2026-08-28)

- `docker ps` / `docker port svc-forum`: container `svc-forum` still runs image
  `svc-forum:502cfca` (image id
  `sha256:93a9eda5b4adb1edbb186e511c801f482d2c702e6079c1faa6dc357e56ec6f97`,
  created `2026-08-14T00:26:34.979779587Z`), bound `3460/tcp -> 127.0.0.1:3460`,
  matching `targets.js` `svc-forum` origin and §3.1 exactly. The pinned revision
  in §3.1 is unchanged; no new compatibility observation is required.

### 15.4 Independent route re-extraction (2026-08-28)

The complete `svc-forum@502cfca5...` route table was independently re-extracted
from source (app.ts mounts + threads/messages/reports/stats/admin route files +
scope-guard / forum-writer middleware) and re-compared against §9.1,
`CTR-FMC-002`, and `CTR-FMC-003`. Verified verbatim matches include:

- all thirteen frozen routes and their guards;
- `forum.moderate` exactly for queue / handle-report (stacked with
  `forum.write`), thread/message delete, and all of `/api/admin/*`;
- resolve (`summaryMd` required) and archive guarded only by `forum.write`
  server-side — confirming `CTR-FMC-009`'s Broker-side narrowing decision;
- report reasons `spam|abuse|off_topic|violation|other`, queue statuses
  `pending|ignored|warned|deleted`, handle action exactly `ignore|warn|delete`;
- thread soft delete = `status='deleted'`; message soft delete = `deletedAt`
  timestamp — no hard-delete seam anywhere;
- admin unread is the only `/api/admin` route and requires `forum.moderate`;
  **no route anywhere in the deployed service requires `forum.admin`** (zero
  occurrences of that literal in source) — confirming `CTR-FMC-005`.

### 15.5 Production read-only identity/grant cross-check (2026-08-28)

Read-only `SELECT` queries against the production auth database (read-only
role; no write, no secret material read or reproduced) confirmed:

```text
PRINCIPAL_UUID(agt_course-community-agent-2) = 9f7cf4c5-7b2c-4239-9993-d9b2a2e0df56
CLIENT(mc_hvEfjkJ5BTKA8HZXRmbzNVw0).internal_id = 7f35380c-f155-4275-b29f-307a3335775a
CLIENT.external_ref = agentcore:v1:client:agt_course-community-agent-2
CLIENT.status = active, revoked_at = null
CLIENTS_OF_TARGET_PRINCIPAL = exactly 1 (no client-side ambiguity)
GRANTS(client) = svc-forum[forum.read,forum.write]@v1 ; svc-workflow[workflow.read]@v1
AUDIENCE(svc-forum).registered_scopes = {forum.read,forum.write}, status=active, version=1
GRANTS_CONTAINING_forum.moderate = 0 rows (today)
```

Consequences recorded for review:

- `CTR-FMC-015`'s Auth prerequisite is **not currently satisfied** (expected):
  `forum.moderate` is neither registered for `svc-forum` nor granted to any
  client. V1 token minting additionally fails closed for any grant row carrying
  an unregistered scope (`machine_grant_state_invalid`,
  `src/lib/oauth/v1/direct.ts` scope-subset check), so the Broker-side
  `forum.moderate` prerequisite correctly remains hard-unavailable until the
  Auth-side spec is implemented and separately applied.
- Near-collision principals exist and are explicitly non-target:
  `course-community-agent-2` **without** the `agt_` prefix
  (`132ab857-35ab-408b-b909-bc0b1deab55b`, principal of the legacy
  `mc_oc_IV5jxnaVRJKwUmMMwQEiOqjd` client), `course-community-agent`, and
  `agt_course-community-agent`. `CTR-FMC-004`'s closed list matches on the exact
  `agt_course-community-agent-2` string only; no prefix-less or display-name
  resolution is representable.

### 15.6 Sister-spec linkage

The Auth prerequisite (register `forum.moderate` for `svc-forum` at Bundle
`1.5.0` after the reserved `1.4.0`, then supply the single exact moderator
Grant) is specified in `mayf3/auth-service` proposed Spec
`AUTH_SERVICE_FORUM_MODERATOR_GRANT_SUPPLY_V1` (authored on branch
`docs/forum-moderator-grant-supply-v1`, same round). Neither spec authorizes
the other's implementation; both stay `proposed` with
`implementation_authority: none`.

### 15.7 Revision result

```text
REVISION_ROUND = 2 (版管 执行 re-verification)
REBASED_BASE = 9cb17a1 (from b620907f; spec content unchanged by rebase)
SPEC_SECTIONS_1_14 = BYTE_PRESERVED
FRESH_EVIDENCE_ADDED = OBS(15.2,15.3,15.4,15.5)
AUTH_PREREQUISITE_CURRENTLY_SATISFIED = NO (expected; sister spec governs)
STATUS = proposed (unchanged)
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
GRANT_CHANGE = NONE
PRODUCTION_CHANGE = NONE
```

---

## 16. Acceptance Record (2026-08-28, 版管 执行 Part A)

```text
ACCEPTANCE_KIND = LIFECYCLE_ONLY
ACCEPTED_SPEC = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1
REVIEWED_HEAD = 67509abcad137ba8d36dade79656a0fccfc6b2c5
PR = mayf3/dsh-agent-core#93 (exactly one file: this Spec)

INDEPENDENT_AUDIT = 版管 审计
AUDIT_VERDICT = PASS
NORMAL_TOOL_FAST_PATH = PASS
MODERATOR_TOOL_BOUNDARY = PASS
IMPLEMENTATION_CLOSURE = COMPLETE
BLOCKERS = NONE
READY_FOR_ACCEPTANCE_FINALIZE = YES
PRODUCTION_CHANGE = NONE

LIFECYCLE_TRANSITIONS = exactly two:
  status: proposed -> accepted
  implementation_authority: none -> contracts
PRODUCTION_APPLY_AUTHORITY = none (unchanged)
SEMANTIC_CHANGE_FROM_REVIEWED_HEAD = NONE (tools, scopes, routes, contracts,
  closures, §1-§15 body byte-preserved; only frontmatter lifecycle fields,
  header status note, and this Record added)
REQUIRED_FIXES = NONE

IMPLEMENTATION_GATE = open: implementation may begin from fresh merged main
  against the frozen nine-file closure (CTR-FMC-014) and three bounded generic
  deltas (CTR-FMC-013) only.
```
