---
spec_id: AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
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
  - AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2

> **PROPOSED — DOCS ONLY.** This proposal creates no active implementation
> authority while it remains proposed. This authoring PR adds exactly this Spec,
> changes no product or test file, performs no runtime reload or deployment, and
> grants no Forum scope. `PRODUCTION_APPLY_AUTHORITY = none`.
>
> **WHOLE-SPEC SUCCESSOR.** This Spec is the whole successor of
> `AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1` (accepted at merge
> `97ff7863e9ca93f139818d11233ce3c08fdf438f`). On this authoring round V1 keeps
> `status: accepted`, `superseded_by: null`; the backlink flip
> (`V1.superseded_by -> AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2`) is
> reserved to the future V2 acceptance transaction and MUST be atomic with
> `V2.status: proposed -> accepted` (see §12.2). This Spec restates V1's complete
> product Contract so it is independently readable and independently
> implementable; it never relies on "V1 continues to apply except …".
>
> **GOVERNANCE RULING (2026-08-29).** Independent implementation audit
> (版管 审计, against implementation PR #97 head
> `ad4e9e316aa445609f31e2522f64bf53f72db2ad`) returned **REVISE** with two
> blockers: (1) the implemented Bearer/Basic redaction regex lacks the
> case-insensitive flag, leaking model-visible auth material for
> `basic …`/`bearer …`/mixed-case schemes; (2) the implementation cannot
> simultaneously satisfy V1's nine-file closure and
> `CODE_STRUCTURE_GUARDRAILS_V1` (four machine violations). The owner ruling
> therefore is: no in-place edit of accepted V1, no prose-only partial
> amendment, author this whole successor instead. PR #97 is NOT modified by this
> round and stays DRAFT / NOT FOR MERGE until V2 is accepted (§12.3).

## 1. Goal

Define the complete repo-local Contract for exposing already-deployed `svc-forum`
operations through the generic Agent Core Broker without creating a Forum backend
route or a second business adapter. Restated verbatim in normative meaning from
V1 §1; the model-visible surface, scopes, visibility boundary, and server reuse
are unchanged.

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

V2 changes exactly two things relative to V1 and nothing else:

```text
V2_CHANGE_A = exact implementation closure corrected 9 files -> 12 files so a
  faithful implementation can pass CODE_STRUCTURE_GUARDRAILS_V1 (§15 proof)
V2_CHANGE_B = sanitizer auth-scheme matching frozen as explicitly
  case-insensitive, with a mandatory six-case test matrix and an explicit
  no-security-regression clause for the pre-existing stronger redactions
OTHER_SEMANTIC_DRIFT = NONE (§16 coverage audit)
```

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
- No generic Broker change beyond the three bounded deltas in `CTR-FMC-013`; the
  sanitizer delta of `CTR-FMC-013` is implemented in a dedicated new module
  (per `CTR-FMC-014`), not by growing `transport.js`.
- No runtime reload, Agent Core deployment, `svc-forum` deployment, or Itops
  cutover.
- No creator self-service resolve decision. Broker V1 deliberately narrows
  resolve and archive to the moderator pack; V2 preserves that narrowing.
- No in-place edit of accepted `AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1`
  and no prose-only partial amendment of it (owner governance ruling; the only
  legal vehicle for these corrections is this whole successor).
- No modification of PR #97 (`impl/forum-moderation-capabilities-v1`, head
  `ad4e9e316aa445609f31e2522f64bf53f72db2ad`) by this or any V2-authoring
  round; no fix commits land on it before V2 acceptance.
- No change to `CODE_STRUCTURE_GUARDRAILS_V1`, `.agents/structure-registry.json`,
  or any frozen limit of the structure rule: the closure in `CTR-FMC-014` is
  sized to pass the existing gate as-is (`NO_REGISTRY_CHANGE = YES`, §15.6).

## 3. Authority and dependencies

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
AUTHORING_BASE = df3b299ec5ab78a2f1c944c01803a5e1caf28f85
CLASSIFICATION = WHOLE_SPEC_SUCCESSOR
SUPERSEDES = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1 (accepted merge 97ff7863e9ca93f139818d11233ce3c08fdf438f)
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1
PROCESS_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
REPOSITORY_BINDING_RULE = .agents/local/CODE_STRUCTURE_GUARDRAILS_V1 (baseline d506f81105e8aa05177a01b817ebe11dcc076ba5)
NON_NORMATIVE_ARCHITECTURE_CONTEXT = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
```

The accepted Hardening Program governs the Broker credential/secret boundary.
The frozen-draft Product Architecture is retained only as non-normative design
context for the generic Broker placement; it is not declared as this Spec's
accepted parent. This Spec owns only the Agent Core capability, bounded generic
transport additions, and child visibility decision. It does not accept, amend,
or supersede an Agent Forum or Auth authority. `CODE_STRUCTURE_GUARDRAILS_V1`
is a repository-local binding rule (not a governing Spec); V2 conforms to it and
does not modify it.

### 3.1 Pinned deployed external implementation

The consumed API is pinned to the actual local production deployment observed in
the V1 authoring round and re-observed for this V2 authoring round, not to a
floating branch:

```text
SVC_FORUM_REPOSITORY = mayf3/agent-forum
SVC_FORUM_DEPLOYED_SOURCE_REVISION = 502cfca5a180d6c49fe75dfc270fd117f279ccfb
SVC_FORUM_IMAGE_TAG = svc-forum:502cfca
SVC_FORUM_IMAGE_ID = sha256:93a9eda5b4adb1edbb186e511c801f482d2c702e6079c1faa6dc357e56ec6f97
SVC_FORUM_CONTAINER_CREATED = 2026-08-14T00:26:34.979779587Z
SVC_FORUM_OBSERVED_AT = 2026-08-27T01:34:09Z (V1)
SVC_FORUM_REOBSERVED_AT = 2026-08-29T00:00:00Z (V2 authoring; read-only docker ps/inspect:
  container svc-forum still Up, image svc-forum:502cfca, image id and created
  timestamp byte-identical to the V1 pin — the pin is still current)
```

This is a pinned external implementation dependency and Observation coordinate,
not a local authority over `mayf3/agent-forum`. Any future implementation against
a different Forum revision requires a new exact compatibility observation before
merge.

## 4. Current State

- `STATE-FMC-001` — Agent Core `main@df3b299` ships exactly seven Forum
  manifests and registers the default manifest set in every child. Basis:
  `OBS-FMC-001`, `OBS-FMC-002`, `EVD-FMC-001`; re-resolved at the V2 authoring
  base (§15.2: `forum.js` blob `f068c171c2c8bd66b774c197bdbae09d1bcf809b` and
  `index.js` blob `6c4a60af4c529dd052ad45bd641213d40ee6800c` — the seven-manifest
  state is unchanged since the V1 authoring base `b620907f`).
- `STATE-FMC-002` — production `svc-forum` is running source revision
  `502cfca5...` through image `sha256:93a9eda...`; the required backend routes
  already exist. Basis: `OBS-FMC-003`, `OBS-FMC-004`, `EVD-FMC-002`, and the
  2026-08-29 re-observation in §3.1.
- `STATE-FMC-003` — deployed resolve/archive accept `forum.write`, while delete,
  report moderation, pin/feature, and admin unread enforce moderation. This is a
  descriptive server state, not the Broker authorization decision. Basis:
  `OBS-FMC-004`, `CLM-FMC-001`, `EVD-FMC-003`.
- `STATE-FMC-004` — every child receives `DSH_AGENT_ID`; current Broker child
  registration does not use it to filter Forum tools. Basis: `OBS-FMC-002`,
  `OBS-FMC-005`.
- `STATE-FMC-005` (new in V2) — the V1-authorized implementation PR #97 (head
  `ad4e9e316a...`, DRAFT, unmerged) fails the repository structure gate with
  exactly four violations and implements the sanitizer auth-scheme redaction
  case-sensitively; it therefore cannot merge as-is. Basis: `OBS-FMC-006`,
  `OBS-FMC-007`, `EVD-FMC-005`.

## 5. Observations

### OBS-FMC-001 — Existing Forum manifest surface

- Subject: `packages/broker/src/capabilities/forum.js`
- Repository/revision: `mayf3/dsh-agent-core@b620907fc6f58292b6ee096c977f0071921d747e` (V1 authoring; blob re-resolved identical at `df3b299`)
- Blob: `f068c171c2c8bd66b774c197bdbae09d1bcf809b`
- Method: source inspection
- Result: exactly seven manifests exist:
  `forum_my_notifications`, `forum_read_thread`, `forum_read_transcript`,
  `forum_reply`, `forum_mark_read`, `forum_list_threads`,
  `forum_search_threads`.

### OBS-FMC-002 — Default registration behavior

- Subject: `packages/broker/src/index.js`
- Repository/revision: `mayf3/dsh-agent-core@b620907fc6f58292b6ee096c977f0071921d747e` (V2 authoring base blob `6c4a60af4c529dd052ad45bd641213d40ee6800c` at `df3b299`)
- Blob: `06f939588f573fa4becafe1a0743cf2a85d2db02` (at V1 base)
- Method: source inspection
- Result: `DEFAULT_MANIFESTS` includes all Forum manifests; child mode registers
  every selected manifest, while gateway mode executes the same set.

### OBS-FMC-003 — Production deployment identity

- Subject: local production `svc-forum` container bound to `127.0.0.1:3460`
- Environment: Docker Compose project `svc-forum-deploy`
- Observed at: `2026-08-27T01:34:09Z` (re-observed 2026-08-29, unchanged)
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

### OBS-FMC-006 — Structure-gate run on the V1 implementation head (new in V2)

- Subject: `scripts/verify-code-structure.mjs` (rules `CODE_STRUCTURE_GUARDRAILS_V1`)
- Command: `node scripts/verify-code-structure.mjs --base <main@df3b299> --head ad4e9e316a...`
- Method: machine verifier, mechanical reproduction in the V2 authoring round
  (2026-08-29); exit code 1, `violations: 4`:
  1. `NEW_LEGACY_VIOLATION_CROSSED_500` `packages/broker/src/capabilities/forum.js` 246 -> 708
  2. `MUST_NOT_GROW` `packages/broker/src/transport.js` 727 -> 804
  3. `UNREGISTERED_LEGACY_TOUCHED` `packages/broker/test/capabilities.test.js`
  4. `MUST_NOT_GROW` `packages/broker/test/transport.test.js` 912 -> 1019
- Result: the V1 nine-file closure cannot be implemented inside
  `CODE_STRUCTURE_GUARDRAILS_V1`; full measurement table and per-path necessity
  proof in §15.

### OBS-FMC-007 — Sanitizer auth-scheme case-sensitivity defect (new in V2)

- Subject: `packages/broker/src/transport.js` at PR #97 head `ad4e9e316a...`
- Method: source inspection of the sanitizer added by PR #97
- Result: the spec-policy step-1 pattern is declared
  `const SPEC_AUTH_SCHEME_RE = /\b(Bearer|Basic)[ \t]+[^ \t\r\n,;]+/g` —
  **no `i` flag**. The added test even records the misreading ("NOTE: the frozen
  CTR-FMC-012 pattern is case-sensitive (Bearer|Basic)"). Consequences, traced
  input-by-input:
  - `basic QUJDREVG` — step 1 no match; step 2 no keyed shape; step 3 no ≥24-char
    run; second-layer rules contain no standalone-`basic` pattern (only
    `authorization[:=] …`-anchored schemes and a `bearer`-word rule) — the
    credentials pass to the model **unredacted**;
  - `bearer <token>` — step 1 no match; the second-layer
    `/bearer\s+[A-Za-z0-9._~+/=-]+/gi` cannot match `<token>` (its value class
    excludes `<`), and short tokens are below every other threshold — unredacted;
  - mixed-case `Bearer`/`Basic` (`BeArEr`, `bAsIc`, …) — same non-match paths.
  This violates V1 `CTR-FMC-012`, whose step 1 already reads "case-insensitively
  match `\b(Bearer|Basic)[ \t]+[^ \t\r\n,;]+`"; V2 removes the ambiguity
  (`CTR-FMC-012` restated in §9) rather than changing the accepted normative
  meaning.

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

### CLM-FMC-004 — The gate-compliant closure is sufficient without touching the structure rule (new in V2)

- Support state: SUPPORTED
- Supported by: `EVD-FMC-005` (§15 line budgets measured from the PR #97 content:
  every closure path stays under its binding ceiling at the measured base, with
  the four violations removed by the four-file split, not by any registry or rule
  change)
- Uncertainty: line budgets must be re-measured at the future implementation PR's
  merge base; the binding rule is the machine gate, not this table (§15.1).

## 7. Evidence relations

### EVD-FMC-001 — Broker source supports the current-surface State

- Source observations: `OBS-FMC-001`, `OBS-FMC-002`
- Target: `STATE-FMC-001`
- Relation: SUPPORTS
- Bound coordinates: Agent Core `b620907f` / `df3b299`, blobs in §5
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

### EVD-FMC-005 — Structure-gate measurements support the corrected closure (new in V2)

- Source observations: `OBS-FMC-006`, `OBS-FMC-007`
- Target: `STATE-FMC-005`, `CLM-FMC-004`
- Relation: SUPPORTS
- Bound coordinates: `verify-code-structure.mjs` run
  base `df3b299ec5ab78a2f1c944c01803a5e1caf28f85` head
  `ad4e9e316aa445609f31e2522f64bf53f72db2ad`; line-count measurements in §15
- Strength: direct machine-verifier evidence, mechanically reproduced
- Limitation: §15 budgets are measured at `df3b299`; the future implementation
  PR re-runs the gate against its own merge base (§15.1).

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

### DEC-FMC-004 — Closed twelve-file, gate-compliant implementation (replaces V1's nine-file decision)

- Decision owner: `mayf3`
- Decision: the future implementation may modify exactly the twelve files in
  `CTR-FMC-014` — eight existing files plus exactly four new files — and no
  thirteenth file is implicitly allowed. The four new paths exist because, and
  only because, the structure gate mechanically forbids hosting their content in
  the V1 closure's files (proof per path in §15.4).
- Rejected alternative (V1 form): keep the nine-file closure and let the
  implementation violate `CODE_STRUCTURE_GUARDRAILS_V1` — rejected: the gate is
  an active repository binding rule; a Spec cannot license its violation.
- Reason: V1's `CTR-FMC-014` was authored before the structure gate existed on
  main; the gate is now active and the closure must be sized to pass it without
  touching the rule or its registry.

### DEC-FMC-005 — Whole-successor discipline (new in V2)

- Decision owner: `mayf3`
- Decision: V2 whole-supersedes V1; V1 is never edited in place and no
  prose-only partial amendment of V1 is created. V1 keeps
  `status: accepted`, `superseded_by: null` until a future V2 acceptance
  transaction flips both lifecycle fields atomically (§12.2).
- Rejected alternatives: in-place edit of accepted V1 (breaks the acceptance
  transaction discipline); partial amendment (would leave two half-authorities
  for one capability surface).
- Reason: owner governance ruling 2026-08-29 recorded in the header.

### DEC-FMC-006 — Case-insensitive auth-scheme redaction with frozen matrix and no security regression (new in V2)

- Decision owner: `mayf3`
- Decision: the sanitizer's step-1 auth-scheme match is case-insensitive in every
  casing, replacement preserves the scheme spelling as written, and the six-case
  matrix of `CTR-FMC-012` is mandatory test evidence. The pre-existing stronger
  redaction layer (password / api-key / token / secret / credential keyed forms,
  scheme-prefixed `authorization[:=]` values including NTLM / Digest / DPoP and
  peers, ≥40-char opaque runs) remains in force after the spec layer;
  removing, weakening, or reordering it behind the spec layer is a security
  regression and FORBIDDEN.
- Rejected alternative: keep the case-sensitive PR #97 reading — rejected: it
  leaks `basic`/`bearer`/mixed-case credentials model-visibly and contradicts
  the accepted V1 contract.
- Reason: `OBS-FMC-007`; audit blocker 1.

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

### CTR-FMC-009 — Resolve/archive remain moderator-only in Broker

Both resolve and archive MUST live exclusively in the moderator pack and MUST
require all three moderator scopes even though revision `502cfca5...` currently
guards those routes with `forum.write`. They MUST NOT appear in the normal pack.

### CTR-FMC-010 — Existing seven Forum tools are invariant

The names, operations, routes, manifest schemas, scope arrays, registration
selection, success results, error codes, and error status fields of the seven
tools in `OBS-FMC-001` MUST remain unchanged. Existing safe error detail remains
unchanged unless the exact global sanitizer in `CTR-FMC-012` redacts/truncates it;
that security transformation is the sole permitted envelope delta. All
pre-existing Broker tests MUST continue to pass, with exactly one bounded
exception: the pre-existing truncation assertion in
`packages/broker/test/transport.test.js` (`/\[truncated\]$/`) MUST be updated to
the exact code-point contract of `CTR-FMC-012` step 4 (first 500 Unicode code
points, no trailing marker); that single assertion update is the only permitted
edit to that file (see `CTR-FMC-014`).

### CTR-FMC-011 — Identity and credential boundary is unchanged

No new tool parameter or body/query/path field may contain `agentId` for caller
identity, `principalId`, `clientId`, credential, token, secret, or Authorization.
Caller identity MUST continue to come from actual Router process identity and the
trusted credential store; the child MUST remain credential-less.

### CTR-FMC-012 — Secret and Authorization non-disclosure (restated; step 1 disambiguated by V2)

For every new tool success and failure path, model-visible output, rendered
output, thrown error, stderr/stdout, and test diagnostics MUST contain none of:
client secret, access token, raw `Authorization`, Basic material, Bearer
material, or credential-store content. A normal successful business response is
permitted and is not diagnostic leakage. Before an error `detail` becomes
model-visible, one shared sanitizer MUST apply this exact ordered policy:

1. case-insensitively match `\b(Bearer|Basic)[ \t]+[^ \t\r\n,;]+` and replace
   it with the matched scheme spelling plus one space and `<AUTH_REDACTED>`.
   **V2 disambiguation (normative meaning unchanged from V1): "case-insensitively"
   means the compiled pattern carries the case-insensitive flag — JavaScript
   literal form `/\b(Bearer|Basic)[ \t]+[^ \t\r\n,;]+/gi` — so every casing of
   the scheme word matches: `bearer`, `Bearer`, `BeArEr`, `bEaReR`, `basic`,
   `Basic`, `BaSiC`, `bAsIc`, … The replacement MUST preserve the scheme
   spelling exactly as it appeared in the input (`basic QUJDREVG` →
   `basic <AUTH_REDACTED>`). A case-sensitive implementation is a contract
   violation (model-visible secret leak), not an acceptable reading;**
2. match
   `(^|[^A-Za-z0-9_.-])([A-Za-z_][A-Za-z0-9_.-]*)([ \t]*[:=][ \t]*)("(?:\\.|[^"\\])*"|[^ \t\r\n,;]+)`;
   apply it only when lowercased group 2 contains at least one exact substring
   `authorization`, `token`, `secret`, or `credential`; replace with groups 1,
   2, and 3 byte-for-byte followed by `<SENSITIVE_REDACTED>` (quotes around the
   removed value are not retained);
3. replace every remaining maximal run matching
   `[A-Za-z0-9._~+/-]{24,}={0,2}` with `<OPAQUE_REDACTED>`;
4. truncate the result to the first 500 Unicode code points using code-point, not
   UTF-16 code-unit, counting; the result is exactly the first 500 code points
   with no appended truncation marker.

The sanitizer is idempotent; its three replacement literals are exempt from the
opaque-run rule. Raw upstream headers MUST never cross the transport boundary.
Existing error code/status fields remain unchanged.

**Mandatory case matrix (V2, `CASE_INSENSITIVE_AUTH_SCHEME = FROZEN`).** The
implementation's test suite MUST contain explicit assertions that each of the
following inputs is redacted by step 1 to `<scheme-as-written> <AUTH_REDACTED>`:

```text
lowercase    bearer  e.g. 'failed with bearer dGhpcyBpcyBhIHNlY3JldA'
uppercase    Bearer  e.g. 'failed with Bearer dGhpcyBpcyBhIHNlY3JldA'
mixed-case   Bearer  e.g. 'failed with BeArEr dGhpcyBpcyBhIHNlY3JldA'
lowercase    basic   e.g. 'failed with basic QUJDREVG'
uppercase    Basic   e.g. 'failed with Basic QUJDREVG'
mixed-case   Basic   e.g. 'failed with BaSiC QUJDREVG'
```

**No security regression (V2 explicit).** The pre-existing stronger redaction
layer that PR #97 documented as running after the spec policy — password /
api-key / token / secret / credential keyed assignments, scheme-prefixed
`authorization[:=]` values (Basic/Bearer/Digest/DPoP/HoBA/Mutual/Negotiate/
NTLM/SCRAM-SHA-1/SCRAM-SHA-256/VAPOP and a generic fallback), and ≥40-character
opaque runs — MUST remain in force with its existing semantics, still effective
after the spec layer. Removing, weakening, skipping, or reordering-away that
layer behind the spec layer is FORBIDDEN (`SECURITY_REGRESSION = FORBIDDEN`).
The composition order is frozen: spec-policy steps 1–3, then the pre-existing
layer, then step-4 truncation.

### CTR-FMC-013 — Three bounded generic Broker deltas

The only generic semantic changes authorized are:

1. schema and transport method allowlists add exact uppercase `PATCH`;
2. string leaf schemas gain optional `nonBlank: boolean`, enforced as specified
   by `CTR-FMC-006`;
3. upstream/transport error detail is sanitized as specified by `CTR-FMC-012`.

Registry, relay, gateway, target, token cache, timeout, retry, request pinning,
identity resolution, error codes, HTTP status propagation, success mapping, and
all behavior outside these three deltas MUST remain unchanged. New HTTP bindings
MUST use existing `pathParams`, `query`, and `body` mappings only. Delta 3's
implementation lives in the dedicated sanitizer module required by
`CTR-FMC-014` (`packages/broker/src/error-detail-sanitizer.js`), with
`transport.js` reduced to the import/call seam; this changes the closure's file
list only, not the delta's semantics or its three-step scope.

### CTR-FMC-014 — Exact implementation closure (V2: twelve files; replaces V1's nine-file closure)

A future implementation PR, after an independently reviewed acceptance
transaction against this Spec, MAY change exactly these twelve files and no
others (`IMPLEMENTATION_CLOSURE_COUNT = 12`, `EXTRA_FILE_COUNT = 0`):

```text
# ── existing files, modified ───────────────────────────────────────────────
packages/broker/src/capabilities/forum.js          # 7 first-batch + 5 normal manifests (<= 500 lines)
packages/broker/src/index.js                       # config + child selection + gateway wiring
packages/broker/src/schema.js                      # nonBlank validation + PATCH allowlist
packages/broker/src/mapping.js                     # nonBlank local enforcement
packages/broker/src/transport.js                   # PATCH allowlist + sanitizer import/call seam; MUST NOT GROW
packages/broker/test/broker.test.js                # registration/config/visibility tests (<= 500 lines)
packages/broker/test/transport.test.js             # ONLY the one truncation assertion update; MUST NOT GROW
bundle-broker/cordis.patch.yml                     # moderator list config mapping
# ── new files ──────────────────────────────────────────────────────────────
packages/broker/src/capabilities/forum-moderation.js   # the 8 moderator manifests (sole responsibility)
packages/broker/src/error-detail-sanitizer.js          # complete two-layer sanitizeErrorDetail (sole responsibility)
packages/broker/test/forum-capabilities.test.js        # Forum tool matrix tests (sole responsibility)
packages/broker/test/generic-deltas.test.js            # the three bounded generic deltas' tests (sole responsibility)
```

Per-file boundaries (each also mechanically enforced by
`CODE_STRUCTURE_GUARDRAILS_V1` at the implementation PR's merge base; §15):

- `forum.js` — keeps the seven existing manifests plus the five normal-pack
  manifests and the `manifests` / `normalManifests` exports. Head physical lines
  MUST stay ≤ 500 (`NEW_LEGACY_VIOLATION_CROSSED_500` otherwise; measured budget
  ≈ 431 lines from the PR #97 content, §15.4).
- `forum-moderation.js` (new) — sole owner of the eight moderator manifests, the
  shared `moderatorScopes` constant, and the `moderatorManifests` export. MUST
  NOT import or re-export normal-pack manifests. ≤ 500 lines (budget ≈ 290).
- `error-detail-sanitizer.js` (new) — sole owner of the complete
  `sanitizeErrorDetail` implementation: the `CTR-FMC-012` spec-policy layer, the
  preserved pre-existing redaction layer, and the code-point truncation helpers.
  ≤ 500 lines (budget ≈ 140).
- `transport.js` — limited to: adding exact uppercase `PATCH` to
  `ALLOWED_METHODS`; importing `sanitizeErrorDetail` from
  `error-detail-sanitizer.js` and calling it at the existing error-detail seam;
  optionally re-exporting `sanitizeErrorDetail` for import stability
  (`transport.test.js` is its only external importer, verified at `df3b299`);
  and removing the relocated inline sanitizer code (`DETAIL_MAX_LENGTH`,
  `DETAIL_REDACTIONS`, the `sanitizeErrorDetail` body). Head physical lines MUST
  NOT exceed the merge-base count, added lines ≤ 100, and added+deleted ≤ 20% of
  base (gate `MUST_NOT_GROW` / `MUST_SPLIT`; budget ≈ 686 ≤ 727 at `df3b299`).
- `schema.js`, `mapping.js` — limited to the `CTR-FMC-013` deltas exactly as in
  V1 (nonBlank validation; PATCH in `HTTP_METHODS`; nonBlank enforcement).
- `index.js` — limited to config validation (`forumModeratorAgentIds`), normal
  pack default registration, the moderator selection seam
  (`resolveForumModeratorRegistration` and the `apply()` child/gateway wiring).
  ≤ 500 lines (budget ≈ 333).
- `broker.test.js` — limited to registration/config/visibility/apply-mode tests
  for the normal and moderator packs. ≤ 500 lines (budget ≈ 490).
- `transport.test.js` — limited to the single truncation-assertion update
  permitted by `CTR-FMC-010`; every new test goes to `generic-deltas.test.js`.
  Head physical lines MUST NOT exceed the merge-base count (budget 912 → 912,
  net zero).
- `forum-capabilities.test.js` (new) — sole owner of the Forum capability test
  matrix: manifest-schema validation for all 13 new manifests, exact tool
  ids/scopes, identity-field absence, seven-tool frozen-projection regression,
  and per-pack wire-shape execution tests (PR #97's `capabilities.test.js`
  additions relocate here wholesale). ≤ 500 lines (budget ≈ 365).
- `generic-deltas.test.js` (new) — sole owner of the tests for the three bounded
  generic deltas: `ALLOWED_METHODS` PATCH positive/negative, schema PATCH-binding
  and `nonBlank` validation tests, and the full sanitizer unit matrix including
  the six-case matrix, idempotency, code-point truncation, layer-2
  no-regression, and downstream-error canary tests (PR #97's
  `transport.test.js` additions relocate here wholesale). ≤ 500 lines
  (budget ≈ 115).
- `cordis.patch.yml` — limited to mapping the closed moderator-Agent list into
  Broker config.

`packages/broker/test/capabilities.test.js` is NOT in the closure: at `df3b299`
it is a 744-line unregistered legacy file, and the structure gate classifies any
touch as `UNREGISTERED_LEGACY_TOUCHED`; the implementation MUST NOT modify it
(PR #97's additions to it relocate to `forum-capabilities.test.js`).
`.agents/structure-registry.json` is NOT in the closure
(`NO_REGISTRY_CHANGE = YES`): no new path needs an exception, and
`NEW_FILE_OVER_500` / `NEW_LEGACY_VIOLATION_CROSSED_500` files can never be
registered anyway. Any need for a thirteenth file, a registry edit, or different
production wiring requires a new Owner decision and a new/revised independently
reviewed Spec.

### CTR-FMC-015 — Auth prerequisite fails closed

Moderator-tool execution MUST remain unavailable unless Auth has both registered
`forum.moderate` for `svc-forum` and supplied it to the exact moderator Client.
Broker code MUST NOT bypass, emulate, or downgrade this prerequisite. Tool
visibility does not prove grant availability. (Read-only production cross-check
recorded in V1 §15.5 — 2026-08-28, still the latest observation: zero
`forum.moderate` grants; the prerequisite remains hard-unavailable until the
Auth-side sister spec is implemented and separately applied.)

### CTR-FMC-016 — Lifecycle and production separation

While this Spec is proposed, implementation authority is none. A future
acceptance transaction must bind the independently reviewed exact head and may
activate `implementation_authority: contracts`; it MUST leave
`PRODUCTION_APPLY_AUTHORITY = none` and MUST flip V1's `superseded_by`
atomically per §12.2. Code merge, bundle deployment, moderator-list
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
V2 addition: every code Acceptance round MUST also run
`node scripts/verify-code-structure.mjs --base <merge-base> --head <head>` and
record `STRUCTURE_GATE = PASS` (exit 0; warnings allowed) as required evidence
(see `ACC-FMC-010`).

### ACC-FMC-001 — Normal capability matrix

- Contracts: `CTR-FMC-001`, `CTR-FMC-002`, `CTR-FMC-013`
- Environment: shared hermetic Broker environment above.
- Method: execute create/watch/unwatch/report/stats through real tool definitions
  and authorized transport; include PATCH allowlist negative/positive controls.
- Required evidence: five canonical manifests, token requests, HTTP captures, and
  `schema`/`transport` method tests (in `forum-capabilities.test.js` and
  `generic-deltas.test.js`).
- Expected result: exact method/path/query/body/scope and success envelopes; no
  backend code or route.
- Failure condition: route/scope mismatch, PATCH unavailable, or business adapter.

### ACC-FMC-002 — Normal Agent negative moderation surface

- Contracts: `CTR-FMC-003`, `CTR-FMC-004`, `CTR-FMC-009`, `CTR-FMC-015`
- Environment: shared environment with exact moderator, ordinary, absent,
  duplicate-list, malformed, non-`agt_*`, and empty-config cases.
- Method: build child sets for every case and exercise writer-only credentials.
- Required evidence: tool-name projections, config errors, token/business counters
  (in `broker.test.js`).
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

### ACC-FMC-009 — Secret non-disclosure (V2: adds the frozen case matrix)

- Contracts: `CTR-FMC-011`, `CTR-FMC-012`, `CTR-FMC-013`
- Environment: shared environment with unique canaries in credential, token,
  Authorization, every new tool's error detail, headers, and thrown causes.
- Method: run success plus 4xx/5xx/token/network/malformed failures for all 13 new
  tools; capture model envelope, renderer, error, stdout, and stderr.
- Required evidence: channel-by-channel canary scan and sanitizer unit matrix —
  the unit matrix MUST include the six-case matrix frozen in `CTR-FMC-012`
  (lowercase `bearer`, uppercase `Bearer`, mixed-case `Bearer`, lowercase
  `basic`, uppercase `Basic`, mixed-case `Basic` — each redacted by step 1 to
  `<scheme-as-written> <AUTH_REDACTED>`), the layer-2 no-regression assertions
  (password / api-key / NTLM / Digest forms still redacted), idempotency, and
  the exact 500-code-point truncation.
- Expected result: zero secret/Auth canary; permitted success business results
  unchanged; error detail redacted and <=500 code points; all six scheme-case
  inputs redacted by step 1.
- Failure condition: any canary/raw Authorization leak, any scheme casing that
  escapes step 1, any layer-2 regression, or success-body corruption.

### ACC-FMC-010 — Existing seven zero regression and exact closure (V2: 12 files + structure gate)

- Contracts: `CTR-FMC-010`, `CTR-FMC-013`, `CTR-FMC-014`
- Environment: clean worktree and complete Broker package suite.
- Method: compare seven canonical projections to base, run all Broker tests,
  inspect the diff closure, and run the structure gate.
- Required evidence: projection diff, full test log, twelve-file name-status
  (`git diff --name-status <merge-base>...<head>` — exactly the twelve paths of
  `CTR-FMC-014`, no additions, no deletions of existing paths), and
  `verify-code-structure` output with `STRUCTURE_GATE = PASS` (exit 0).
- Expected result: seven projections byte-equivalent; suite passes; exactly
  twelve authorized files, only three generic semantic deltas, zero structure
  violations.
- Failure condition: existing-tool drift, test failure, thirteenth file, extra
  delta, or any structure-gate violation.

### ACC-FMC-011 — Lifecycle boundary

- Contracts: `CTR-FMC-016`
- Environment: Spec authoring PR and later implementation PR metadata; production
  state checked only through separately authorized read-only evidence.
- Method: inspect lifecycle fields, diff, and side-effect declarations.
- Required evidence: exact Spec/implementation heads and PR file lists.
- Expected result: authoring PR adds one Spec; implementation/production none in
  this round; later implementation still has production authority none; V1's
  `superseded_by` flips only in the V2 acceptance transaction.
- Failure condition: product file in authoring PR, any implicit deploy/apply, or
  a premature V1 backlink flip.

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
- `ALT-FMC-007` (V2) — edit accepted V1 in place to fix the closure and the
  sanitizer ambiguity: **rejected** by the owner governance ruling; accepted
  Specs are changed only by supersession or amendment transactions, never
  in-place during a REVISE round.
- `ALT-FMC-008` (V2) — prose-only partial amendment of V1: **rejected**; it would
  leave the nine-file closure and the corrected closure both half-authoritative
  and keeps the same misreading risk for future implementers.
- `ALT-FMC-009` (V2) — satisfy the structure gate by registry exceptions or a
  new `CODE_STRUCTURE_GUARDRAILS_V2`: **rejected**; §6 of the rule forbids
  registering new/over-500 growth (`NEW_FILE_OVER_500` cannot be excused;
  nothing "grows into" grandfather status), and changing a frozen rule value to
  license one PR is disproportionate — the split closure passes the existing
  gate unchanged.
- `ALT-FMC-010` (V2) — keep all thirteen manifests in `forum.js`: **rejected**;
  measured 708 > 500 lines = `NEW_LEGACY_VIOLATION_CROSSED_500` (§15.3).
- `ALT-FMC-011` (V2) — host the new tests in `capabilities.test.js` /
  `transport.test.js` as PR #97 did: **rejected**; `UNREGISTERED_LEGACY_TOUCHED`
  and `MUST_NOT_GROW` respectively (§15.3).
- `ALT-FMC-012` (V2) — defeat the line limits by minification, statement
  packing, or generated-file banners: **rejected**; §8 of the rule flags
  `MAX_STATEMENTS_PER_LINE` and fake-generated claims as violations
  (anti-evasion).

## 12. Migration, compatibility, and rollback

### 12.1 Implementation migration (restated from V1)

- Source implementation, if later authorized, is additive and limited to §9.
- Existing seven tools and all non-Forum manifests remain invariant.
- Deploy/configure/reload is not authorized by this Spec. A later production
  action must pin the reviewed implementation commit and set the moderator list
  exactly to `agt_course-community-agent-2` only after the exact Auth grant has
  separate apply authority.
- Rollback of a future code deployment is the exact prior Broker package/bundle
  revision. Grant rollback is owned by Auth and is not coupled automatically.
- No automatic fallback may expose moderator tools fleet-wide.

### 12.2 V1 → V2 supersession transaction (new in V2)

- While V2 is proposed, V1 remains the active accepted authority for the Forum
  capability surface; nothing in this round changes any runtime or code state.
- The only legal supersession is one future docs-only acceptance transaction,
  after an independent V2 audit round returns PASS, that atomically: flips
  `V2.status: proposed -> accepted`, activates
  `V2.implementation_authority: none -> contracts`, and flips
  `V1.superseded_by: null -> AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2`
  (backlinks change atomically in the same docs-only change, per
  `SPEC_FORMAT_V0` §2.7). A V2 acceptance that leaves V1's backlink unset (or a
  backlink flip without V2 acceptance) is invalid.
- After V2 acceptance, the implementation authority for the Forum surface is V2
  alone; V1 remains on disk as historical superseded authority.

### 12.3 PR #97 disposition (new in V2)

- PR #97 (`impl/forum-moderation-capabilities-v1`, head
  `ad4e9e316aa445609f31e2522f64bf53f72db2ad`, DRAFT) implements V1's contracts
  but fails the structure gate and the sanitizer contract; it MUST NOT be merged
  as-is and MUST NOT receive fix commits before V2 acceptance
  (`PR_97_CHANGED = NO` for every V2-authoring round).
- After V2 acceptance, a fresh implementation PR from fresh merged main realizes
  the twelve-file closure; PR #97's reusable content is relocated per
  `CTR-FMC-014` (moderator manifests to `forum-moderation.js`, sanitizer to
  `error-detail-sanitizer.js`, capability tests to `forum-capabilities.test.js`,
  delta tests to `generic-deltas.test.js`, the case matrix added). Whether PR #97
  is then closed superseded or rebased onto that PR is an Owner decision outside
  this Spec's authority.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE (whole-Spec supersession only)
PRODUCTION_APPLY_AUTHORITY = none
```

Non-normative follow-up: independently review this exact Spec head, then perform
a separate owner acceptance transaction (which also flips V1's `superseded_by`)
before any implementation begins.

## 14. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_HARDENING_PROGRAM_V1
SUPERSEDES = AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1 (whole; backlink reserved to acceptance)
EXTERNAL_AUTHORITIES = NONE (pinned external implementation dependency in §3.1)
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 16
CONTRACTS_WITH_ACCEPTANCE = 16
IMPLEMENTATION_CLOSURE_COUNT = 12
EXTRA_FILE_COUNT = 0
CASE_INSENSITIVE_AUTH_SCHEME = FROZEN
OTHER_SEMANTIC_DRIFT = NONE
PR_97_CHANGED = NO
AUTHORING_READY_FOR_REVIEW = YES
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
NEXT_TASK = 版管 审计
```

---

## 15. Structure-gate mechanical evidence (V2 change A proof)

### 15.1 Method and binding precedence

All numbers below were produced mechanically in this authoring round (2026-08-29)
by `git show | wc -l` (physical lines) and by running
`scripts/verify-code-structure.mjs --base df3b299ec5ab78a2f1c944c01803a5e1caf28f85 --head ad4e9e316aa445609f31e2522f64bf53f72db2ad`.
The gate — re-run at the future implementation PR's merge base — is the binding
rule; this table is its measured justification at `df3b299`. The gate's
per-run semantics relied on here (read from the verifier source): a legacy
>500-line file touched by the diff is `MUST_NOT_GROW` when head physical lines
exceed base physical lines, `MUST_SPLIT` when added > 100 or added+deleted >
20% of base; an unregistered legacy >500 file touched at all is
`UNREGISTERED_LEGACY_TOUCHED`; a ≤500-line file crossing 500 is
`NEW_LEGACY_VIOLATION_CROSSED_500`; a new file > 500 is `NEW_FILE_OVER_500`.

### 15.2 Base measurements at `df3b299` (V2 authoring base)

```text
packages/broker/src/capabilities/forum.js    246 lines  blob f068c171 (≤500; registered: no)
packages/broker/src/index.js                 248 lines  blob 6c4a60af (≤500)
packages/broker/src/schema.js                421 lines  (≤500)
packages/broker/src/mapping.js               241 lines  (≤500)
packages/broker/src/transport.js             727 lines  (registered legacy: YES, ceiling 580 recorded at rule baseline)
packages/broker/test/broker.test.js          274 lines  (≤500)
packages/broker/test/capabilities.test.js    744 lines  (registered legacy: NO — unregistered)
packages/broker/test/transport.test.js       912 lines  (registered legacy: YES, ceiling 733 recorded at rule baseline)
registry: .agents/structure-registry.json = 17 file entries / 2 directory entries; rules_version CODE_STRUCTURE_GUARDRAILS_V1
```

### 15.3 PR #97 measurements and the four violations (reproduced)

```text
git diff --numstat --no-renames df3b299 ad4e9e3:
  bundle-broker/cordis.patch.yml                +6   -0
  packages/broker/src/capabilities/forum.js   +462   -0   -> 708 lines  VIOLATION NEW_LEGACY_VIOLATION_CROSSED_500 (246 -> 708)
  packages/broker/src/index.js                 +90   -5   -> 333 lines  ok (≤500)
  packages/broker/src/mapping.js                +5   -0   -> 246 lines  ok
  packages/broker/src/schema.js                +14   -2   -> 433 lines  ok
  packages/broker/src/transport.js             +84   -7   -> 804 lines  VIOLATION MUST_NOT_GROW (727 -> 804)
  packages/broker/test/broker.test.js         +216   -0   -> 490 lines  ok (≤500, warning zone)
  packages/broker/test/capabilities.test.js   +353   -0   -> 1097 lines VIOLATION UNREGISTERED_LEGACY_TOUCHED (744 at base, no registry entry)
  packages/broker/test/transport.test.js      +108   -1   -> 1019 lines VIOLATION MUST_NOT_GROW (912 -> 1019)
verify-code-structure exit = 1, violations = 4 (exactly the four above), warnings = 35 (pre-existing)
```

### 15.4 Necessity proof for each new/replaced closure path

Each new path exists exactly because the gate mechanically forbids hosting its
content in a V1-closure path; each kept path is the maximal set that can legally
host its content:

1. `forum-moderation.js` (new) — necessary: PR #97's thirteen-manifest `forum.js`
   measures 708 lines; the gate makes any ≤500-at-base file that crosses 500 a
   violation and forbids registering it. Split point measured from the PR #97
   content: lines 1–431 (header, shared error table, seven first-batch manifests,
   `manifests`, five normal manifests, `normalManifests`) stay in `forum.js`
   (431 ≤ 500); lines 433–708 (moderator scopes/errors, eight moderator
   manifests, `moderatorManifests`) move to the new file (276 lines + own
   header/imports ≈ 290 ≤ 500). Sole responsibility: the moderator pack.
2. `error-detail-sanitizer.js` (new) — necessary: `transport.js` is a registered
   legacy file whose any growth is `MUST_NOT_GROW`; PR #97 added 84 sanitizer
   lines to it (727 → 804). Relocating the complete sanitizer (spec-policy layer
   ≈ 84 lines + the pre-existing `DETAIL_MAX_LENGTH` / `DETAIL_REDACTIONS` /
   `sanitizeErrorDetail` block ≈ 45 lines at base + module header) into one
   module ≈ 140 ≤ 500 leaves `transport.js` with a ≈3-line import/call/(re-)export
   seam and a net-negative delta (budget ≈ 686 ≤ 727; added ≈ 6 ≤ 100;
   added+deleted ≈ 51 ≤ 145).
3. `forum-capabilities.test.js` (new) — necessary: V1's test home
   `capabilities.test.js` is a 744-line **unregistered** legacy file; any touch
   is `UNREGISTERED_LEGACY_TOUCHED`. PR #97's +353 Forum capability tests
   relocate here (≈ 365 ≤ 500 with header).
4. `generic-deltas.test.js` (new) — necessary: `transport.test.js` is a
   registered legacy file that must not grow (912 → 1019 violation); PR #97's
   +104 generic-delta tests (PATCH allowlist, schema PATCH-binding, schema
   `nonBlank`, sanitizer matrix incl. the V2 six-case matrix, code-point
   truncation, downstream-error canary) relocate here (≈ 115 ≤ 500).
5. `transport.test.js` (kept, single-edit) — the pre-existing
   `sanitizeErrorDetail` truncation test asserts `/\[truncated\]$/`, which the
   exact code-point contract (step 4, no marker) makes fail; the single
   assertion update is the only necessary touch (budget 912 → 912 net zero;
   added 1 ≤ 100; changed 2 ≤ 182 → `GRANDFATHERED_TOUCHED`).
6. `broker.test.js` (kept) — 274 at base; the registration/config/visibility
   tests (+216 in PR #97) fit legally (490 ≤ 500), so a separate registration
   test file is NOT necessary and is therefore NOT added (no speculative path).
7. `forum.js`, `index.js`, `schema.js`, `mapping.js`, `transport.js`,
   `cordis.patch.yml` (kept) — each hosts content the gate allows at its
   measured budget (431 / 333 / 433 / 246 / ≈686 / +6).

### 15.5 Directory and depth effects at the closure head

```text
packages/broker/src/            15 -> 16 immediate children (limit 20; warning threshold >16) — no warning, no violation
packages/broker/src/capabilities/ 5 -> 6 children — ok
packages/broker/test/            9 -> 11 children — ok
max directory depth from module root: 2 (capabilities/, test/) — ok (limit 4)
```

### 15.6 Registry and rule non-change

```text
NO_REGISTRY_CHANGE = YES   (.agents/structure-registry.json not in closure; no entries added/edited)
NO_RULE_CHANGE = YES       (.agents/local/CODE_STRUCTURE_GUARDRAILS_V1 untouched; no V2 rule authored)
NO_ANTI_EVASION = YES      (no minification / statement packing / generated banners / copy-split; §11 ALT-FMC-012)
```

## 16. V1 → V2 whole-supersession coverage audit

Mechanical entity coverage (every V1 normative entity must appear in V2 with
preserved meaning unless it is one of the two authorized changes):

| V1 entity | V2 location | Disposition |
|---|---|---|
| §1 goal block (5 frozen counts) | §1 | preserved verbatim |
| §2.1 in-scope / §2.2 non-goals | §2.1 / §2.2 | preserved; V2 adds successor-discipline non-goals |
| §3 authority block + §3.1 pin | §3 / §3.1 | preserved; base updated to `df3b299`; pin re-observed 2026-08-29 |
| STATE-FMC-001..004 | §4 | preserved (001 blob re-resolved) ; V2 adds STATE-FMC-005 |
| OBS-FMC-001..005 | §5 | preserved verbatim; V2 adds OBS-FMC-006/007 |
| CLM-FMC-001..003 | §6 | preserved verbatim; V2 adds CLM-FMC-004 |
| EVD-FMC-001..004 | §7 | preserved; V2 adds EVD-FMC-005 |
| DEC-FMC-001..003 | §8 | preserved verbatim |
| DEC-FMC-004 (nine-file closure) | §8 DEC-FMC-004 | REPLACED (twelve-file; authorized change A) |
| — | §8 DEC-FMC-005/006 | new successor/sanitizer decisions |
| CTR-FMC-001..011 | §9 | preserved verbatim-normative; CTR-FMC-010 gains the one bounded transport.test.js assertion exception |
| CTR-FMC-012 | §9 CTR-FMC-012 | preserved; step 1 disambiguated + six-case matrix + no-regression clause (authorized change B; normative meaning already case-insensitive in V1) |
| CTR-FMC-013 | §9 CTR-FMC-013 | preserved; delta-3 location note added |
| CTR-FMC-014 (nine files) | §9 CTR-FMC-014 | REPLACED (twelve files; authorized change A) |
| CTR-FMC-015..016 | §9 | preserved (016 gains the atomic-backlink sentence) |
| §9.1 thirteen routes | §9.1 | preserved verbatim |
| ACC-FMC-001..008 | §10 | preserved (test-file homes named per new closure) |
| ACC-FMC-009 | §10 ACC-FMC-009 | preserved + six-case matrix evidence required |
| ACC-FMC-010 | §10 ACC-FMC-010 | preserved + twelve-file closure + STRUCTURE_GATE evidence |
| ACC-FMC-011 | §10 | preserved + backlink-flip failure condition |
| ALT-FMC-001..006 | §11 | preserved verbatim; V2 adds ALT-FMC-007..012 |
| §12 migration/rollback | §12.1 | preserved verbatim-normative |
| §13 open questions | §13 | preserved (all NONE) |
| §14 authoring result | §14 | V2 fields |
| V1 §15/§16 (revision/acceptance records) | §3.1, §15, §17 | historical records remain in V1 file (byte-preserved there); V2 cites them |

```text
V1_ENTITY_COUNT = 53 normative entities inventoried mechanically
  (4 STATE + 5 OBS + 3 CLM + 4 EVD + 4 DEC + 16 CTR + 11 ACC + 6 ALT; plus the
  13-route inventory §9.1 and the §1 frozen-count block compared byte-for-byte)
V2_COVERED = 53 / 53 (regex inventory of every (STATE|OBS|CLM|EVD|DEC|CTR|ACC|ALT)-FMC-### id in V1, each found in V2)
ROUTE_INVENTORY_BYTE_IDENTICAL = YES (§9.1 text block)
GOAL_COUNTS_IDENTICAL = YES (§1 block)
CHANGED_ENTITIES = exactly 3: DEC-FMC-004 (replaced), CTR-FMC-014 (replaced), CTR-FMC-012 (disambiguated + matrix + no-regression clause)
CHANGED_ENTITY_AUTHORITY = V2_CHANGE_A (DEC-004, CTR-014) + V2_CHANGE_B (CTR-012)
OTHER_SEMANTIC_DRIFT = NONE (audited §16.1)
```

### 16.1 Semantic-drift audit method

Beyond entity presence, the drift audit compared the normative payload tables
byte-for-byte between V1 and V2: the five-tool table and argument leaves
(`CTR-FMC-002`), the eight-tool table and argument leaves (`CTR-FMC-003`), the
moderator visibility rules (`CTR-FMC-004`), the scope bans (`CTR-FMC-005`), the
`nonBlank` semantics (`CTR-FMC-006`), the action enum (`CTR-FMC-007`),
soft-delete (`CTR-FMC-008`), resolve/archive narrowing (`CTR-FMC-009`), the
seven-tool invariance (`CTR-FMC-010`), the identity boundary (`CTR-FMC-011`),
the sanitizer steps 2–4 and replacement literals (`CTR-FMC-012`), the three
deltas (`CTR-FMC-013`), the Auth prerequisite (`CTR-FMC-015`), lifecycle
separation (`CTR-FMC-016`), the thirteen-route inventory (§9.1), and the
goal-block counts (§1). All are byte-identical in normative meaning; the only
textual deltas inside them are the V2 change-B annotations in `CTR-FMC-012`
step 1 and the bounded `transport.test.js` assertion exception in
`CTR-FMC-010`. `OTHER_SEMANTIC_DRIFT = NONE`.

## 17. Successor authoring record (2026-08-29, 版管 修订)

```text
AUTHORING_KIND = WHOLE_SPEC_SUCCESSOR_AUTHORING (docs-only)
AUTHORING_BASE = df3b299ec5ab78a2f1c944c01803a5e1caf28f85 (github/main fetched fresh this round)
BRANCH = docs/forum-moderation-capabilities-v2
PR_KIND = DRAFT (NOT FOR MERGE until independent 版管 审计 PASS + acceptance transaction)
FILES_CHANGED_BY_THIS_ROUND = exactly one: docs/specs/AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V2.md (this file)
V1_FILE_TOUCHED = NO (AGENT_CORE_FORUM_MODERATION_CAPABILITIES_V1.md byte-preserved; still status=accepted, superseded_by=null)
PR_97 = #97 impl/forum-moderation-capabilities-v1, HEAD ad4e9e316aa445609f31e2522f64bf53f72db2ad, DRAFT, NOT FOR MERGE, NOT MODIFIED (PR_97_CHANGED = NO)
AUDIT_INPUT = 版管 审计 = REVISE, BLOCKERS = 2 (sanitizer case-sensitivity; structure gate vs nine-file closure)
GOVERNANCE_RULING = whole-Spec successor; no in-place V1 edit; no prose-only partial amendment
V2_CHANGE_A = implementation closure 9 -> 12 files (§15 proof; IMPLEMENTATION_CLOSURE_COUNT = 12; EXTRA_FILE_COUNT = 0)
V2_CHANGE_B = CASE_INSENSITIVE_AUTH_SCHEME = FROZEN (six-case matrix + layer-2 no-regression; §9 CTR-FMC-012)
VERIFICATIONS_RUN = frontmatter YAML parse; entity coverage §16; semantic-drift §16.1;
  verify_governance; verify:structure (base github/main); git diff --check;
  closure mechanical count; dangling-reference scan (§18 of the PR description / commit)
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE (svc-forum read-only re-observation only: docker ps / docker inspect, no writes)
GRANT_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 版管 审计
```
