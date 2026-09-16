---
spec_id: AGENT_CORE_AGENT_DIRECTORY_TOOL_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
scope:
  - mayf3/dsh-agent-core
  - model-facing read-only Agent discovery for canonical internal Agents
    (exact human-reference resolve + list), reusing the Agent Definition as
    the ONLY canonical source
governed_by:
  - AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1
  - AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
external_authorities: []
supersedes: []
superseded_by: null
owners: [mayf3]
date: 2026-09-16
---

# AGENT_CORE_AGENT_DIRECTORY_TOOL_V1

## Goal, authority and evidence

Give canonical internal Agents one stable, read-only discovery primitive — the
`agent_directory` LOCAL broker capability — so a caller that knows only a
human-readable reference (exact canonical `agt_*` id or exact display name)
can obtain the canonical agent_id that every downstream surface
(`agent_session_send.targetAgentId`, workflow assignee, HR dispatch) already
consumes. This changes nothing about WHO the canonical authority is: the
Agent Definition config remains the single source of Agent existence /
identity / enabled truth (AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1; the
agent-definition-config-v1 report freezes "Agent ≠ Auth Principal" and the
zero-production-writer ownership split). The tool is a thin read projection
over the existing `AgentDefinition` snapshot; it creates no second registry,
no table, no cache and no mapping file.

DEVELOPMENT_PREFLIGHT: AUTHORITY_ACTION=NEW (no accepted Spec covers a
model-facing display-name resolution primitive; the accepted
AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1 deliberately rejected fuzzy/display-name
lookup for ITS exact-ID HTTP admission route and this Spec does not reopen
that route); PLAN_LEVEL=EXEC_PLAN; ASSURANCE_LEVEL=CONTROLLED;
DOCS_FIRST_REQUIRED=YES. Base: current main 5c7b6205.

Owner directive AGENT_CANONICAL_IDENTITY_DISCOVERY_TOOL_V1 (2026-09-16)
pre-rules the semantics (unified single tool; resolved/ambiguous/not_found
made explicit; silent selection forbidden; no second registry; no hardcoded
name→UUID maps; no UUID-in-prompt; authorization must not expand existing
boundaries) and orders the lifecycle through implementation, tests, real E2E
and report (acceptance authority basis recorded in the frontmatter at the
acceptance commit).

## Source observations

### OBS-ADT-001

At base, `packages/agent-definition/src/definition.js` `resolveAgentRef`
(exact id bytes first, then case-insensitive exact display name) is the ONE
name→id mapping point; Router `switchAgent` and `deliver`'s channel-ingress
path consume it. It (a) raises `AGENT_NOT_FOUND` for a DISABLED agent,
(b) returns the FIRST name match via `Array.find` — a legal config may
contain duplicate display names because `normalizeDefinition` rejects
duplicate ids only — so a silent wrong-target pick is representable today,
(c) has no machine-readable ambiguity outcome, and (d) falls through an id
match on a DISABLED agent to the name path (id precedence holds only for
enabled ids). The `agent_session_send` A2A admission path is deliberately
EXACT-ID only — the ASM trusted handler rejects any targetAgentId outside
`^agt_[a-z0-9-]+$` and the inter_agent delivery branch resolves by
`resolveAgentById` with the TOCTOU wrong-target rationale
(AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 CTR-EPAR-005) — which is
precisely why the canonical id must be DISCOVERED first when only a human
reference is known. (The existing side-effectful, name-accepting surface
`agent_core_switch_agent` is out of scope for this read primitive.)

### OBS-ADT-002

At base the model-facing read surface is `agent.definition.read`
(`agent_definition_read`, ops list/get; open to every credentialed agent, no
scope; AGENT_DEFINITION_ACCESS_V1 baseline) and the exact-only
`agent_resolve_principal` (Principal UUID → agentId; scope `auth.agent.resolve`;
display-name/fuzzy matching explicitly excluded). No operation anywhere
exposes "human-readable reference → canonical agent_id" with explicit
resolved/ambiguous/not_found semantics to a calling Agent. The list
capability exists; the reference-resolution primitive does not.

### OBS-ADT-003

The internal HTTP route GET /v1/directory/agents/:agentId
(AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1, CTR-IAD-003) freezes the observation
semantics `{agentId, exists, enabled}` — a disabled Agent is `exists:true,
enabled:false`, never silently absent — and freezes the baseline-entitlement
philosophy for canonical directory reads. This Spec reuses both semantics for
the model-facing surface instead of inventing new ones.

## Contracts

### CTR-ADT-001 — Unified read-only discovery surface

One LOCAL broker capability, capability id `agent.directory`, wire toolName
`agent_directory`, with EXACTLY two read-only operations and no other:

- `resolve { query: string }` — one exact reference. Classification, in
  order: (1) exact canonical `agt_*` id byte-equality over the snapshot
  (raw bytes, no trim); (2) otherwise exact display-name equality after
  `trim()` + lowercase fold. Exactly one of:
  - `{ status: 'resolved', agent: { agentId, name, description, enabled } }`
  - `{ status: 'ambiguous', query, candidates: [{ agentId, name, enabled }, ...] }`
    — two or more exact name matches; candidates carry the canonical ids and
    nothing else, in config order; the tool NEVER selects one and NEVER
    guesses.
  - `{ status: 'not_found', query }`
  A non-string, empty or whitespace-only `query` is an `invalid_arguments`
  envelope error (fail-closed), never a `not_found` status. There is no
  substring, prefix, fuzzy or tokenized match of any kind; no alias field is
  invented (the canonical model maintains none); unknown extra arguments are
  rejected by the operation schema.
- `list {}` — `{ agents: [{ agentId, name, description, enabled }, ...] }`
  in config order, INCLUDING disabled agents (`enabled: false` — discovery
  reports existence truth, the caller decides). This is the
  discoverability half of the same primitive; it reads the same snapshot as
  `agent.definition.read list` and that sibling capability remains
  unchanged. The directory result shape (`agentId`/`enabled`) is distinct
  from the sibling definition-read shape (`id`/`disabled`) by design; the
  tool description must say so in one sentence so models never conflate the
  two list surfaces.

`enabled` mirrors the accepted CTR-IAD-003 observation semantics
(`disabled !== true`). The result carries ONLY identity + display + enabled:
no principal, credential, grant, workspace, session, process or config-path
data. Success and status outcomes are result payloads (`ok: true`); the
closed error table is `invalid_arguments`, `unsupported_operation`,
`internal_error` (declared because the gateway converts any thrown local
handler to it and the child relay fail-closes undeclared codes to
`invalid_arguments`, mislabeling a wiring fault as a model input fault) plus
the generic transport codes merged by the existing broker helper.

Manifest shape (binding, mirrors the newest sibling LOCAL capability): the
manifest is PURE DATA with `local: true` (no `http` binding; no
`local.resource` is needed because requiredScopes is empty and resource is
consulted only for the grant check); the `resolve` operation declares
`{ properties: { query: { type: 'string', nonBlank: true } }, required:
['query'], additionalProperties: false }` and `list` declares
`{ properties: {}, required: [], additionalProperties: false }`. The TRUSTED
handler re-validates `query` (non-string / empty / whitespace-only →
`invalid_arguments`) and IS the validation authority — the manifest schema is
the model-facing hint plus defense-in-depth (the gateway performs no
argument-schema re-validation for local non-scheduler capabilities, so a
schema-only implementation would diverge between child and gateway modes).

### CTR-ADT-002 — Authorization = the existing definition-read baseline

The capability declares NO requiredScopes: visibility is byte-identical to
the accepted `agent.definition.read` baseline (every credentialed agent may
read which Agents exist, identity + display + enabled; AGENT_DEFINITION_ACCESS_V1
and the AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1 baseline-entitlement ruling:
canonical directory read is foundational internal information,
PER_CONSUMER_DIRECTORY_GRANT_DECISION_REQUIRED=NO). This creates NO new auth-service
audience, scope, grant or client; NO permission boundary is expanded —
`DISCOVERABLE == the already-accepted definition-read surface`. Caller
identity comes only from the gateway-frozen ACTUAL caller
(`context.callerAgentId`); tool arguments can never select caller, target
credentials or any authorization input. No workspace/tenant narrowing is
invented on top (the runtime has no such ACL layer; inventing one would be a
new permission model, out of scope).

### CTR-ADT-003 — Authoritative observation semantics

Every call synchronously reads ONE coherent `AgentDefinition` snapshot (a
single `listAgents()` read; no `await` between the read and the
classification) and classifies it: exact-id-before-name precedence — UNLIKE
`resolveAgentRef`, whose id precedence holds only for enabled ids and whose
disabled id match falls through to the name path, a disabled id match here
resolves `{ status: 'resolved', agent: { ..., enabled: false } }` and NEVER
falls through to the name path (existence truth per CTR-IAD-003, never
silently `not_found`, never a different agent picked by name); duplicate ids
are structurally impossible (config load fails loud); duplicate names yield
`ambiguous` with every matching candidate in config order. No cache, no
retry, no deferred write-back: every call freshly reads the current config
(the definition service reloads on write already).

### CTR-ADT-004 — Zero side effects and closed file set

No mutation of any file, registry, session, run, scheduler occurrence,
credential or binding; no message delivery; no principal rewrite. The
implementation file set is CLOSED: `packages/broker/src/capabilities/
agent-directory.js` (manifest data), `packages/production-runtime/src/
agent-directory.js` (trusted access provider), the two wiring points
(`packages/broker/src/index.js` DEFAULT_MANIFESTS + fifth local-handler
provider; `packages/production-runtime/src/compose.js` provide), the Spec,
its review/acceptance record, tests, and the goal report. The sibling
surfaces — `agent.definition.read/write`, `agent_resolve_principal`,
`agent_session_send(+reconcile/turn_inspect)`, the HTTP directory route,
Router `resolveAgentRef` — are byte-unchanged.

### CTR-ADT-005 — Downstream canonical-agent_id-only discipline

The tool description must state the model-facing UX law: call
`agent_directory` BEFORE any cross-Agent operation when the target canonical
agent_id is not already known; never guess a UUID; never ask the user for a
UUID; never reuse an id copied from an old conversation; pass the returned
`agent.agentId` VERBATIM as `targetAgentId` (and the equivalent canonical
field of other consumers); do not send to a result whose `enabled` is false.
`agent.agentId` is the ONLY canonical reference field the tool emits; no
`directory_agent_id` / secondary id of any kind may be introduced.

### CTR-ADT-006 — Acceptance boundary

| Acceptance | Contracts | Method/environment/evidence | Expected / failure |
|---|---|---|---|
| ACC-ADT-001 | 001 | manifest + registry/schema pipeline fixtures at implementation head | tool registered in DEFAULT_MANIFESTS for child and gateway modes; operation schemas enforced; no other op exists |
| ACC-ADT-002 | 001, 003 | semantic matrix T1–T12 against a temp Agent Definition config — T1 exact enabled id; T2 exact DISABLED id (→ resolved enabled:false, and when that id string is ALSO another agent's display name, the id match wins, never the name collision); T3 exact name case-insensitive; T4 trimmed/padded name (name path folds trim); T5 duplicate names (→ ambiguous, full candidate set, config order); T6 unknown plain name (→ not_found); T7 agt_-shaped string matching NO id but matching a name (→ resolved by name); T8 whitespace-only query (→ invalid_arguments envelope error, never a status); T9 one agent's id equal to ANOTHER agent's display name (→ resolved by id); T10 padded exact id `" agt_x "` (→ not_found — id path is raw byte equality); T11 unknown agt_-shaped string (→ not_found); T12 `list` order = config order and disabled agents present | resolved/enabled discrimination exact; ambiguity explicit with full candidate set; not_found explicit; invalid input fails closed; id-over-name precedence proven by T2/T9; id-path raw-byte semantics proven by T10 |
| ACC-ADT-003 | 002 | gateway pipeline fixtures with frozen caller context | no-scope LOCAL dispatch succeeds for a credentialed caller; handler receives the frozen actual caller; no caller-controlled authorization input exists |
| ACC-ADT-004 | 004 | file-set diff vs base + config-file write spy | zero writes anywhere; sibling surfaces byte-unchanged |
| ACC-ADT-005 | 005 | composed-runtime A2A E2E over the REAL broker gateway, REAL trusted provider, REAL router admission chain, fake per-agent DSH processes and a stub auth-service (deterministic, no model, no external network) | a caller fixture that knows ONLY the target display name (no agt_* anywhere in caller-side fixtures/prompt) resolves via `agent_directory`, then `agent_session_send` with the returned agentId is received by the target process; failure at any hop is explicit |

## Status and alternatives

Rejected: a second Agent registry or DB table (frozen ownership split);
substring/fuzzy/prefix search and silent first-match directory semantics
(wrong-target family, OBS-ADT-001); a per-consumer lookup identity or
consumer-specific audience/scope (superseded direction, MUST NOT be
re-introduced per AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1); inventing alias
metadata (the canonical model maintains none); hardcoding display_name→UUID
maps or pre-seeding UUIDs into prompts/fixtures; exposing principal,
credential or workspace data through the directory; reusing
`resolveAgentRef`'s throw-based semantics as the wire contract (it cannot
express ambiguity and erases disabled existence).
Non-goals: rewriting workflow/HR/forum consumers (they keep their accepted
authorities; adoption is follow-up debt), production deployment, and any
change to the exact-ID HTTP directory route.

STATUS=proposed; IMPLEMENTATION_ALLOWED_NOW=NO. Requires the independent
semantic review recorded in docs/reviews/
AGENT_CORE_AGENT_DIRECTORY_TOOL_V1_INDEPENDENT_REVIEW.md; the acceptance
commit then records the Owner GOAL-directive authority basis and flips this
header to accepted, after which implementation proceeds on this branch under
GOVERNING_SPEC_UNMODIFIED.
