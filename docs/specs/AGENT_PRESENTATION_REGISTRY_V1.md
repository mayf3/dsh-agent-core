---
spec_id: AGENT_PRESENTATION_REGISTRY_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
scope:
  - deployment-owned read-only Agent Presentation Registry
  - Product API merged Agent presentation view
  - Mobile-oriented visibility, primary-cast, category, alias, and ordering contracts
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_WORKSPACE_SESSION_MODEL_V2
external_authorities:
  - repository: mayf3/agent-core-mobile
    authority_id: MOBILE_PRODUCT_INTEGRATION_V1
    revision: bc1f5bcfdaa25544c0d82aa1d61a40a4b3592b34
    relation: constrained_by
supersedes: []
superseded_by: null
owners:
  - mayf3
date: 2026-08-25
repository: mayf3/dsh-agent-core
authoring_base_main: b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724
references:
  - docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
  - docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V2.md
  - docs/decisions/BINDING_AND_SWITCH_V1.md
  - docs/specs/AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0.md
  - docs/specs/AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3.md
  - docs/specs/AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1.md
---

# Agent Presentation Registry V1

```text
TASK_NAME = 形象 执行
SPEC_GOVERNANCE_MODE = AUTHOR
PREFLIGHT_MODE = NEW
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts
AUTHORING_BASE = b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724
PRODUCT_CODE_CHANGE_THIS_ROUND = NONE
MOBILE_CHANGE_THIS_ROUND = NONE
CANARY_CHANGE_THIS_ROUND = NONE
PRODUCTION_APPLY_AUTHORITY = NONE
```

## 1. Goal

Create one Product Presentation authority, separate from Agent Definition and
Workspace persona, for stable Agent imagery and discovery metadata. Once this exact
Spec is accepted into the authority branch, its Contracts authorize only a later,
bounded implementation in this repository of:

1. a deployment-owned, read-only `agent-presentations.json` reader;
2. the `AgentDefinition LEFT JOIN Presentation by agentId` Product Agent view;
3. the corresponding Product API projection, validation, tests, and local
   configuration seam.

This proposed document does not itself authorize or perform implementation,
deployment, runtime mutation, Mobile changes, or canary changes.

## 2. Scope and non-goals

### 2.1 In scope

- schema, defaults, validation, and lifecycle of `agent-presentations.json`;
- presentation merge semantics and safe degradation;
- backward-compatible expansion of `GET /v1/agents`;
- default, featured, category, search alias, visibility, and deterministic-order rules;
- trusted HTTPS avatar-origin validation;
- the `voiceProfileId` metadata boundary;
- future implementation Acceptance definitions.

### 2.2 Out of scope / forbidden this Spec round

```text
AGENT_DEFINITION_SCHEMA_CHANGE       = NONE
AGENTS_JSON_ROSTER_CHANGE            = NONE
AGENT_PERSONA_CHANGE                 = NONE
WORKSPACE_OR_AGENTS_MD_CHANGE        = NONE
MOBILE_IMPLEMENTATION                = NONE
TTS_OR_STT_IMPLEMENTATION            = NONE
VOICE_AUTHORITY_DEFINITION           = NONE
DYNAMIC_PRESENTATION_WRITE_API       = NONE
ASSET_UPLOAD_OR_EDIT_API             = NONE
ROUTER_CHANGE                        = NONE
BINDING_CHANGE                       = NONE
SESSION_CHANGE                       = NONE
AGENT_SWITCH_PLUGIN_CHANGE           = NONE
RUNTIME_OR_PROCESS_CHANGE            = NONE
DEPLOYMENT                           = NONE
CURRENT_CANARY_CHANGE                = NONE
MERGE_AUTHORITY                      = NONE
```

The Spec MUST NOT be interpreted as permission to put `avatar`, voice, persona, or
other high-frequency presentation fields back into Agent Definition or `agents.json`.
It does not authorize a hard-coded complete `agentId -> presentation` fleet map in
Mobile.

## 3. Authority and dependencies

### 3.1 Preflight result

```text
TARGET_REPOSITORY             = mayf3/dsh-agent-core
BASE_COMMIT                   = b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724
REQUESTED_CHANGE              = new presentation registry and merged Product Agent view Spec
CHANGE_CLASS                  = NON_MECHANICAL
PREFLIGHT_MODE                = NEW
GOVERNANCE_ADOPTION_STATUS    = accepted
PRIMARY_GOVERNING_SPEC        = AGENT_PRESENTATION_REGISTRY_V1 (this proposed Spec)
SPEC_PRESENT_IN_BASE          = NO
SPEC_STATUS_IN_BASE           = NONE
IMPLEMENTATION_ALLOWED        = NO
AUTHORITY_CONFLICT            = NONE
PARTIAL_SUPERSESSION          = NONE
NEXT_ACTION                   = independent review of this exact docs-only revision
```

### 3.2 Ownership classification

| Subject | Authority | This Spec's relation |
|---|---|---|
| Agent identity, existence, stable id, name, description, default, disabled | Agent Definition | preserved; LEFT side and source of truth |
| Agent persona and behavior instructions | Workspace / `AGENTS.md` | excluded |
| avatar, emoji, color, tagline, discovery and voice-profile reference | new Product Presentation authority | owned here |
| Mobile rendering and interaction | `mayf3/agent-core-mobile` future Spec (`MOBILE_AGENT_ROLE_SURFACE_V1`) | external consumer; not authorized here |
| current Agent and Session for a product surface | Router-owned Binding | referenced, not redefined |
| switch mechanics and persisted bookmark | existing Router / Binding authorities | preserved |
| model switch tool | existing `agent-switch` adapter | preserved, no change |
| future TTS/STT and voice semantics | future independent Voice authority | not owned here |

Parent and related authorities are:

- `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md`: UI is presentation only; Router,
  Registry, Workspace, Session, and process responsibilities remain separated.
- `AGENT_WORKSPACE_SESSION_MODEL_V2` (accepted Current Decision): Mobile may switch
  active Agent; Agent/Workspace/Session ownership remains external to presentation.
- `docs/decisions/BINDING_AND_SWITCH_V1.md` (accepted D-004): Router is the sole
  Binding owner and `switchAgent` is the single switch operation.
- `AGENT_PRIMARY_WORKSPACE_OPENCLAW_COMPATIBILITY_V3#CTR-OW-008` (accepted): Agent
  Definition retains membership identity/display boundaries and excludes Workspace,
  credential, runtime, session, and process state.
- `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` (accepted): Agent Definition is
  identity/display membership, never credential authority.

The external authority is the frozen Mobile product baseline
`MOBILE_PRODUCT_INTEGRATION_V1` pinned at revision
`bc1f5bcfdaa25544c0d82aa1d61a40a4b3592b34`. It constrains the Product Agent
representation this Spec may expand (old-client field compatibility) and is the
exact fact input for the Mobile Observations below. The reference is
reference-only: it grants no local supersession authority over this repository.

## 4. Current State

- `STATE-APR-001` — In `mayf3/dsh-agent-core` source at
  `b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`, Agent Definition is a deployment-owned,
  read-only authority for existence, id, name, description, default, and disabled;
  its entry validator permits only `id`, `name`, `description`, and `disabled`.
  Basis: `OBS-APR-001`, `EVD-APR-001`.
- `STATE-APR-002` — At that same source revision, `GET /v1/agents` maps Agent
  Definition records to `id`, `name`, `description`, and constant `avatar: null`;
  there is no Presentation Registry merge. Basis: `OBS-APR-002`, `EVD-APR-002`.
- `STATE-APR-003` — In `mayf3/agent-core-mobile` source at
  `bc1f5bcfdaa25544c0d82aa1d61a40a4b3592b34`, the Agent model consumes `avatar` and
  `description`, while missing avatars fall back to a local name-to-emoji map and
  deterministic local color palette; there is no Presentation Registry. Basis:
  `OBS-APR-003`, `EVD-APR-003`.
- `STATE-APR-004` — At the pinned backend and Mobile revisions, manual switch input
  is target-Agent-only, current/success state derives from Binding, Mobile `_previous`
  is process-memory-only, HTTP `switchSession` is not implemented, and Mobile
  bootstraps its initial default Binding from the first `agents`-array entry
  (`agents[0]`), not from any explicit default-Agent field. Basis:
  `OBS-APR-004`, `EVD-APR-004`.

These source States are descriptive facts only. They do not claim deployed or canary
state and do not prove future Contract conformance.

## 5. Observations

### OBS-APR-001 — Agent Definition's exact schema and ownership boundary

- Subject: Agent Definition source.
- Repository/revision: `mayf3/dsh-agent-core@b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`.
- Source: `packages/agent-definition/src/definition.js:4-59,138-165,168-245` and
  `packages/agent-definition/src/index.js:1-32,74-104`.
- Environment: source repository worktree.
- Observed at: 2026-08-25T13:05:00Z.
- Method: direct source inspection.
- Result: the Definition loads once from a deployment artifact, owns existence/id/name/
  description/default/disabled, rejects unsupported fields including `avatar`, persona,
  workspace, credential, and runtime classes, and has no runtime roster writer.
- Provenance: the cited repository paths at the pinned revision.

### OBS-APR-002 — Product API currently has no presentation merge

- Subject: Product API Agent list projection.
- Repository/revision: `mayf3/dsh-agent-core@b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`.
- Source: `packages/product-api/src/index.js:241-251`.
- Environment: source repository worktree.
- Observed at: 2026-08-25T13:05:00Z.
- Method: direct source inspection.
- Result: `GET /v1/agents` lists Agent Definition entries and emits `avatar: null`;
  no second registry is read or joined.
- Provenance: the cited repository path at the pinned revision.

### OBS-APR-003 — Mobile consumes basic presentation with local fallback

- Subject: Mobile Agent model and avatar renderer.
- Repository/revision: `mayf3/agent-core-mobile@bc1f5bcfdaa25544c0d82aa1d61a40a4b3592b34`.
- Source: `lib/core/models.dart:40-87` and
  `lib/ui/widgets/agent_avatar.dart:5-68`.
- Environment: source repository detached fact worktree.
- Observed at: 2026-08-25T13:05:00Z.
- Method: direct source inspection.
- Result: Agent JSON supports nullable `avatar` and `description`; avatar failure or
  absence uses a local emoji map/default emoji and deterministic local palette; no
  Presentation Registry type or reader is present.
- Provenance: the cited external repository paths at the pinned revision.

### OBS-APR-004 — Existing switch boundary and Mobile back-navigation gap

- Subject: backend switch adapter/Router and Mobile switching code.
- Repository/revisions: `mayf3/dsh-agent-core@b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724` and
  `mayf3/agent-core-mobile@bc1f5bcfdaa25544c0d82aa1d61a40a4b3592b34`.
- Source: backend `packages/agent-switch/src/index.js:1-18,44,69-134`,
  `packages/agent-router/src/binding-resolution.js:180-268`; Mobile
  `lib/ui/agent_switcher_sheet.dart:73-80`, `lib/state/app_state.dart:7-23,55-57,
  109-136,146-157,243-305`, `lib/core/http/http_agent_router.dart:33-44`, and
  `lib/core/http/gate1_api.dart:102-110`.
- Environment: source repository worktrees.
- Observed at: 2026-08-25T13:05:00Z.
- Method: direct source inspection.
- Result: `agent_core_switch_agent` is a Router adapter; manual Mobile switching sends
  only target Agent id; Binding is the UI's current-state source; `_previous` is not
  persisted; “换回来” calls `switchSession`, whose HTTP implementation throws
  `NOT_IMPLEMENTED`; the initial default Binding is bootstrapped by switching to
  `_agents.first.id` (array-first default inference, no explicit default field);
  Router persists per-surface session bookmarks.
- Provenance: the cited paths at the pinned revisions.

### OBS-APR-005 — Production Agent profile includes the switch adapter

- Subject: production per-Agent profile composition.
- Repository/revision: `mayf3/dsh-agent-core@b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`.
- Source: `packages/agent-provisioning/src/index.js:275-293`,
  `bundle-agent-switch/cordis.patch.yml:1-11`, and `profile-production/package.json:7-16`.
- Environment: source repository worktree.
- Observed at: 2026-08-25T13:05:00Z.
- Method: direct source inspection.
- Result: production provisioning links `bundle-agent-switch` and `agent-switch`, and
  the production profile mounts the switch bundle.
- Provenance: the cited repository paths at the pinned revision.

## 6. Claims and assumptions

### CLM-APR-001 — Presentation requires a separate authority

- Support state: SUPPORTED
- Supported by evidence: `EVD-APR-001`, `EVD-APR-002`, `EVD-APR-003`.
- Contradicted by evidence: none known.
- Uncertainty: the future implementation module/configuration names other than the
  frozen artifact filename remain implementation choices inside Contracts.

### CLM-APR-002 — Presentation can be added without changing routing authority

- Support state: SUPPORTED
- Supported by evidence: `EVD-APR-004`, `EVD-APR-005`.
- Contradicted by evidence: none known.
- Uncertainty: natural-language switch reliability belongs to later Mobile Acceptance,
  not this Registry's implementation conformance.

### CLM-APR-003 — A compatible empty-registry mode is required

- Support state: INFERRED
- Supported by evidence: `EVD-APR-002`, `EVD-APR-003`.
- Contradicted by evidence: none known.
- Uncertainty: none normative; `DEC-APR-002` resolves the startup behavior.

## 7. Evidence relations

### EVD-APR-001 — Definition source supports the authority boundary

- Source observations: `OBS-APR-001`.
- Target: `STATE-APR-001`, `CLM-APR-001`.
- Relation: SUPPORTS
- Bound coordinates: backend source revision `b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`.
- Strength/sufficiency: strong for source structure and validators.
- Limitations: does not establish future implementation or deployed state.
- Provenance: `OBS-APR-001` sources.

### EVD-APR-002 — Product API source supports the missing-merge claim

- Source observations: `OBS-APR-002`.
- Target: `STATE-APR-002`, `CLM-APR-001`, `CLM-APR-003`.
- Relation: SUPPORTS
- Bound coordinates: backend source revision `b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`.
- Strength/sufficiency: strong for the current route implementation.
- Limitations: source inspection is not runtime execution.
- Provenance: `OBS-APR-002` source.

### EVD-APR-003 — Mobile source supports the consumer/fallback claim

- Source observations: `OBS-APR-003`.
- Target: `STATE-APR-003`, `CLM-APR-001`, `CLM-APR-003`.
- Relation: SUPPORTS
- Bound coordinates: Mobile source revision `bc1f5bcfdaa25544c0d82aa1d61a40a4b3592b34`.
- Strength/sufficiency: strong for the pinned Mobile source.
- Limitations: does not assert current deployed canary content or behavior.
- Provenance: `OBS-APR-003` sources.

### EVD-APR-004 — Switch sources support separation from presentation

- Source observations: `OBS-APR-004`.
- Target: `STATE-APR-004`, `CLM-APR-002`.
- Relation: SUPPORTS
- Bound coordinates: pinned backend and Mobile source revisions.
- Strength/sufficiency: strong for ownership and current code paths.
- Limitations: no natural-language end-to-end runtime test was executed.
- Provenance: `OBS-APR-004` sources.

### EVD-APR-005 — Profile sources support no adapter change

- Source observations: `OBS-APR-005`.
- Target: `CLM-APR-002`.
- Relation: SUPPORTS
- Bound coordinates: backend source revision `b3a6d4fe089c4b95bdc22df0cabd24eeb3ccb724`.
- Strength/sufficiency: strong for source composition.
- Limitations: does not establish deployment state.
- Provenance: `OBS-APR-005` sources.

## 8. Decisions

### DEC-APR-001 — Product Presentation is a separate deployment authority

- Decision owner: repository owner `mayf3`.
- Decision: create `agent-presentations.json` as a deployment-owned, read-only
  presentation artifact, separate from Agent Definition and Workspace persona.
- Rejected alternative: re-add avatar/voice fields to Agent Definition or `agents.json`.
- Reason: preserve the frozen identity/roster boundary and permit presentation to
  evolve without changing Agent existence, routing, or persona.

### DEC-APR-002 — Optional absence degrades; configured corruption fails loud

- Decision owner: repository owner `mayf3`.
- Decision: no configured registry path means a valid empty Registry and backward-
  compatible null/default presentation. Once a registry path is configured, missing,
  unreadable, malformed, schema-invalid, duplicate-id, or unsafe-asset content fails
  that reader and prevents the dependent Product API from starting. It MUST NOT reset,
  partially load, or silently treat a broken configured artifact as empty.
- Rejected alternative: silently ignore malformed configured data.
- Reason: preserve old deployments without a registry while preventing operator errors
  from becoming an ambiguous partial product view.

### DEC-APR-003 — Product Agent view is a Definition-left join

- Decision owner: repository owner `mayf3`.
- Decision: Product API derives Agent existence/name/description/default/disabled from
  Agent Definition and left-joins Presentation by exact `agentId`.
- Rejected alternative: enumerate presentation entries or Mobile mappings as Agents.
- Reason: only Agent Definition may create or remove Agent membership.

### DEC-APR-004 — Mobile primary cast is curated, not the whole fleet

- Decision owner: repository owner `mayf3`.
- Decision: the primary cast is the default enabled/visible Agent plus enabled/visible
  featured Agents; at most eight entries may be `featured: true`. Remaining enabled and
  visible Agents are reachable by category and name/alias search.
- Rejected alternative: flatten the full fleet onto the Mobile first screen.
- Reason: fleet size is runtime data and must not dictate first-screen density.

### DEC-APR-005 — Voice profile is opaque presentation metadata

- Decision owner: repository owner `mayf3`.
- Decision: `voiceProfileId` is an optional opaque string passed through without parsing,
  provider lookup, or speech behavior.
- Rejected alternative: infer or implement TTS/STT semantics in this Spec.
- Reason: voice execution requires an independent future Voice authority.

### DEC-APR-006 — Existing switch semantics remain untouched

- Decision owner: repository owner `mayf3`.
- Decision: presentation does not redefine switching. Binding change is authoritative;
  model reply text is not proof; the switched Agent handles the next user message;
  same-turn handoff is outside V1; Router bookmarks remain Router-owned.
- Rejected alternative: modify `agent-switch` or infer switch success from model prose.
- Reason: presentation is orthogonal to routing and Session ownership.

## 9. Contracts

### CTR-PRESENTATION-SCHEMA-001 — Registry document and entry schema

The deployment reader MUST accept exactly a JSON object with `version: 1` and
`presentations: []`. A non-authoritative shape example is:

```json
{
  "version": 1,
  "presentations": [
    {
      "agentId": "agt_example",
      "avatarUrl": "https://assets.example.invalid/agents/example.png",
      "emoji": "📚",
      "colorToken": "indigo",
      "tagline": "研究与写作伙伴",
      "voiceProfileId": "mentor-cn-calm-01",
      "featured": true,
      "category": "研究",
      "mobileVisible": true,
      "searchAliases": ["论文导师", "研究导师"],
      "sortOrder": 20
    }
  ]
}
```

Each entry MUST contain one valid `agentId` and MAY contain only:

```text
avatarUrl: string
emoji: string
colorToken: string
tagline: string
voiceProfileId: string (opaque)
featured: boolean
category: string
mobileVisible: boolean
searchAliases: string[]
sortOrder: integer
```

Defaults MUST normalize to `featured=false`, `mobileVisible=true`,
`searchAliases=[]`, and `sortOrder=0`. Optional strings, when present, MUST be
non-empty after trimming; aliases MUST be non-empty strings and duplicate aliases
within an entry MUST be rejected. Unknown fields MUST fail loud. The fields `name`,
`persona`, `workspace`, `credential`, `grant`, `provider`, `model`, `session`,
`runtime`, `process`, and `memory` are forbidden. The artifact MUST remain a
read-only deployment artifact and MUST have no runtime mutation, upload, or edit API.
`voiceProfileId` MUST remain opaque and MUST NOT trigger TTS/STT or provider behavior.

### CTR-PRESENTATION-LOAD-001 — Load lifecycle and failure semantics

If no registry path is configured, the reader MUST expose a valid empty Registry. If
a path is configured, it MUST be an operator-controlled absolute path and the reader
MUST load and validate the whole artifact before publishing any view. A configured
file that is missing, unreadable, malformed JSON, unsupported version, schema-invalid,
duplicate-id, or contains an unsafe avatar URL MUST fail loud and prevent the
dependent Product API from starting. It MUST NOT publish a partial view, reset the
artifact, mutate the file, or silently degrade a configured failure to empty.

### CTR-PRESENTATION-MERGE-001 — Definition-left merged view

The Product Agent view MUST be computed as:

```text
AgentDefinition LEFT JOIN Presentation ON AgentDefinition.id = Presentation.agentId
```

Agent Definition MUST remain authoritative for existence, `id`, `name`,
`description`, default, and disabled. A missing Presentation MUST NOT affect routing
and MUST normalize to `avatar=null`, `featured=false`, `category=null`,
`mobileVisible=true`, `colorToken=null`, `voiceProfileId=null`, `searchAliases=[]`, and
`sortOrder=0`. Presentation MUST NOT create an Agent, replace `description`, or copy,
override, or supply `name`.

### CTR-DUPLICATE-AGENT-001 — Duplicate presentation ids fail loud

The loader MUST reject the entire configured artifact when two entries carry the same
normalized exact `agentId`. It MUST report a stable non-secret error code and MUST NOT
select first-wins, last-wins, or merge entries.

### CTR-UNKNOWN-AGENT-001 — Unknown presentation entries are ignored safely

After schema validation, a Presentation whose `agentId` does not exist in Agent
Definition MUST be excluded from all Product API results and MUST NOT create an Agent.
The implementation MUST emit a redacted warning containing a stable event code and a
non-reversible digest or bounded diagnostic token, but MUST NOT log the full entry,
`tagline`, `voiceProfileId`, aliases, URL, or other payload fields. Unknown entries do
not fail startup because roster and presentation deployment may be rolled out in
separate steps.

### CTR-DISABLED-VISIBILITY-001 — Disabled Agents are not Mobile-routable

An Agent with Agent Definition `disabled=true` MUST NOT appear in the Mobile Product
API switchable list, primary cast, category browse results, or search results,
regardless of Presentation fields. Presentation MUST NOT re-enable or route it.

### CTR-MOBILE-VISIBILITY-001 — Mobile visibility is presentation-only filtering

An enabled Agent with normalized `mobileVisible=false` MUST NOT appear in the Mobile
Product API list, primary cast, category browse results, or search results.
`mobileVisible` MUST NOT change Agent existence, disabled state, Router resolution,
Binding, Session, process lifecycle, or non-Mobile product policy.

### CTR-DEFAULT-AGENT-001 — Default comes only from Agent Definition

`isDefault` and primary-cast default selection MUST be derived by equality with the
Agent Definition default Agent id. Product API and Mobile MUST NOT infer default from
array order, the first Agent, `featured`, `sortOrder`, Presentation content, or a
Mobile constant. The default must already be enabled by Agent Definition; if it is
not Mobile-visible, merged-view construction MUST fail loud rather than silently
invent a replacement default.

### CTR-FEATURED-001 — Curated primary cast and featured limit

The Mobile primary cast MUST be the de-duplicated ordered union of:

```text
default enabled/mobileVisible Agent
+ featured enabled/mobileVisible Agents
```

At most eight Presentation entries may normalize to `featured=true`. A configured
Registry exceeding `MAX_FEATURED=8` MUST fail loud rather than truncate. The default
MAY also be featured but MUST appear once. Enabled/mobileVisible non-primary Agents
MUST remain discoverable through category browse and name/search-alias search; Mobile
MUST NOT be required to flatten the entire fleet on its first screen. Future
Acceptance MUST read the real Agent count from the runtime fixture and MUST NOT encode
historical counts as a Contract.

### CTR-SORT-001 — Deterministic Product Agent ordering

The Product API MUST return deterministic order:

1. the default Agent first;
2. remaining featured Agents by normalized `sortOrder`, then `name`, then `id`;
3. remaining Agents by `category` (null after non-null, Unicode code-point order),
   then normalized `sortOrder`, then `name`, then `id`.

The same comparator MUST be used by primary-cast, category, and search projections
after filtering. Registry input order MUST NOT decide Product order.

### CTR-ASSET-URL-001 — Avatar URL trust boundary

`avatarUrl`, when present, MUST parse as an absolute HTTPS URL whose exact origin is
in a trusted deployment-configured allowlist. Userinfo, fragments, non-default
credentials, unapproved ports, IP-literal hosts, and every non-HTTPS scheme including
`file`, `content`, `data`, and `javascript` MUST be rejected. Redirect handling, if an
implementation fetches or proxies assets, MUST revalidate every hop against the same
allowlist. Product API `avatar` MUST be the validated URL string or `null`; it MUST
never expose an unvalidated value.

### CTR-PRODUCT-API-001 — Backward-compatible Product Agent representation

For every returned Mobile-visible, enabled Agent, `GET /v1/agents` MUST emit:

```text
id: string
name: string
description: string|null
avatar: string|null
isDefault: boolean
featured: boolean
category: string|null
mobileVisible: boolean
colorToken: string|null
voiceProfileId: string|null
searchAliases: string[]
sortOrder: integer
```

`id`, `name`, and `description` MUST come from Agent Definition. `avatar` MUST remain
`string|null` and equal validated `avatarUrl` or `null`. New fields MUST use the
normalized Presentation values. `voiceProfileId` MUST be passed through as opaque
metadata only. The endpoint MUST derive fleet size at runtime and MUST NOT assume a
fixed production count.

### CTR-NO-AUTHORITY-LEAK-001 — Product view leaks no internal authority

Neither `GET /v1/agents`, Registry warnings/errors, nor presentation configuration
MUST expose Workspace or `AGENTS.md` paths, credential/secret/grant data, provider or
model configuration, runtime/process state, internal Session paths, Binding storage,
memory content, or persona instructions. Presentation code MUST NOT write Agent
Definition, `agents.json`, Workspace, Binding, Session, Router, or the switch adapter.

### CTR-BACKWARD-COMPAT-001 — Existing consumers and switch behavior remain compatible

When no Registry is configured, `GET /v1/agents` MUST preserve the existing `id`,
`name`, `description`, and `avatar:null` meanings while adding only ignorable JSON
fields. A client that reads only those four fields MUST continue to work. This Spec
MUST NOT change the `POST /v1/switch-agent` target-Agent-only wire, Router bookmark,
Binding success authority, `agent_core_switch_agent`, next-message effect, or Session
semantics. Same-turn handoff remains unsupported, and model text MUST NOT be treated
as switch proof.

## 10. Acceptance

All items below are future implementation Acceptance definitions. None is claimed
executed or `PASS` by this proposed docs-only change.

### ACC-PRESENTATION-SCHEMA-001 — Validate registry schema and forbidden fields

- Contracts: `CTR-PRESENTATION-SCHEMA-001`.
- Method: future table-driven parser tests covering every allowed field, default,
  type error, unknown field, forbidden field, alias duplicate, and opaque voice value.
- Required evidence: executed command, implementation commit, fixtures, and result log.
- Expected result: valid documents normalize exactly; every invalid case fails loud;
  no file is mutated.
- Failure condition: permissive unknown fields, wrong defaults, voice interpretation,
  or any runtime write path.

### ACC-PRESENTATION-LOAD-001 — Verify optional absence and configured failure behavior

- Contracts: `CTR-PRESENTATION-LOAD-001`.
- Method: future startup/integration matrix for unconfigured, valid, missing,
  unreadable, malformed, unsupported-version, schema-invalid, unsafe-asset, and
  partially valid configured artifacts.
- Required evidence: startup result, Product API availability, stable error code, and
  artifact byte comparison.
- Expected result: unconfigured starts with empty Registry; valid configured starts;
  every configured failure blocks the dependent API with no partial view or write.
- Failure condition: silent empty fallback or partial publication after configured
  failure.

### ACC-PRESENTATION-MERGE-001 — Verify Definition-left join and fallbacks

- Contracts: `CTR-PRESENTATION-MERGE-001`.
- Method: future unit/integration matrix for matched and missing Presentation entries.
- Required evidence: exact Definition/Registry fixtures and merged response.
- Expected result: Definition controls membership/name/description/default/disabled;
  missing presentation produces exact defaults without affecting route calls.
- Failure condition: presentation-created Agent, name override, or routing failure due
  only to missing presentation.

### ACC-DUPLICATE-AGENT-001 — Reject duplicate ids atomically

- Contracts: `CTR-DUPLICATE-AGENT-001`.
- Method: future configured-startup test with duplicate exact `agentId` entries.
- Required evidence: fixture, stable error, API non-start, and zero partial records.
- Expected result: entire artifact fails loud.
- Failure condition: first/last wins, merge, warning-only, or partial API publication.

### ACC-UNKNOWN-AGENT-001 — Ignore unknown entries with redacted warning

- Contracts: `CTR-UNKNOWN-AGENT-001`.
- Method: future integration test with one known and one schema-valid unknown id.
- Required evidence: API response and captured structured warning.
- Expected result: known Agent appears; unknown does not; warning exposes only the
  stable code and bounded digest/token.
- Failure condition: unknown Agent enters API, startup fails solely for unknown
  membership, or payload data appears in logs.

### ACC-DISABLED-VISIBILITY-001 — Exclude disabled Agents

- Contracts: `CTR-DISABLED-VISIBILITY-001`.
- Method: future API/primary/category/search tests with a disabled featured Agent.
- Required evidence: Definition/Registry fixtures and all four projections.
- Expected result: disabled Agent is absent and remains unroutable.
- Failure condition: presentation re-enables or displays it as switchable.

### ACC-MOBILE-VISIBILITY-001 — Exclude mobile-hidden Agents only from Mobile

- Contracts: `CTR-MOBILE-VISIBILITY-001`.
- Method: future Mobile Product API tests with enabled `mobileVisible=false` Agent plus
  direct Definition/Router existence checks.
- Required evidence: response projections and unchanged route/Definition behavior.
- Expected result: absent from Mobile product projections but still defined; no
  routing authority is mutated.
- Failure condition: Agent deletion/disablement or Mobile list leakage.

### ACC-DEFAULT-AGENT-001 — Prove Definition-owned default

- Contracts: `CTR-DEFAULT-AGENT-001`.
- Method: future fixtures where Definition default is not first and has conflicting
  Presentation order/featured values, plus a hidden-default negative fixture.
- Required evidence: Definition default, API order/flags, and startup result.
- Expected result: exact Definition default is first and `isDefault=true`; hidden
  default fails loud.
- Failure condition: first-array or Presentation-selected default/replacement.

### ACC-FEATURED-001 — Enforce primary cast and maximum

- Contracts: `CTR-FEATURED-001`.
- Method: future tests for zero/eight/nine featured entries, default-featured dedupe,
  category discovery, alias discovery, and runtime fleet-size observation.
- Required evidence: fixtures, primary cast, browse/search results, and observed fixture
  count.
- Expected result: primary cast follows the union, eight is accepted, nine fails loud,
  non-primary visible Agents remain discoverable, and no fixed historical fleet count
  appears in implementation/tests.
- Failure condition: truncation, duplicate default, hidden fleet, or hard-coded count.

### ACC-SORT-001 — Prove deterministic ordering

- Contracts: `CTR-SORT-001`.
- Method: future permutation/property tests with tied/missing category and sortOrder.
- Required evidence: multiple input permutations and byte-equal ordered outputs.
- Expected result: every permutation yields the exact Contract comparator order.
- Failure condition: Registry input order or unstable runtime iteration affects output.

### ACC-ASSET-URL-001 — Enforce trusted HTTPS origins

- Contracts: `CTR-ASSET-URL-001`.
- Method: future parser/security matrix covering allowlisted HTTPS, unapproved origin,
  scheme variants, userinfo, fragment, port, IP literal, and redirect hops if fetched.
- Required evidence: allowlist fixture and per-case validation/fetch result.
- Expected result: only exact approved HTTPS origins survive and API emits only
  validated URL or null.
- Failure condition: any forbidden form or redirect escape is accepted/exposed.

### ACC-PRODUCT-API-001 — Verify exact Product Agent fields

- Contracts: `CTR-PRODUCT-API-001`.
- Method: future HTTP contract test against a mixed Definition/Registry fixture.
- Required evidence: request, full JSON response, source fixtures, and runtime-read
  Agent count.
- Expected result: exact required fields/types/sources and validated nullable avatar.
- Failure condition: missing/incompatible field, wrong authority, voice execution, or
  fixed fleet count.

### ACC-NO-AUTHORITY-LEAK-001 — Scan and probe authority boundaries

- Contracts: `CTR-NO-AUTHORITY-LEAK-001`.
- Method: future response/log snapshot tests, forbidden-key recursive assertion over
  owned JSON output, file-byte checks, and changed-file review.
- Required evidence: response/log captures, byte hashes, and implementation diff.
- Expected result: no forbidden internal data and no writes/changes outside the
  accepted implementation scope.
- Failure condition: any internal path/secret/provider/runtime/session/persona leak or
  mutation of Definition/Workspace/Binding/Session/Router/switch adapter.

### ACC-BACKWARD-COMPAT-001 — Prove legacy projection and switch invariants

- Contracts: `CTR-BACKWARD-COMPAT-001`.
- Method: future old-client decoder test against unconfigured Registry plus existing
  switch/Binding regression suite.
- Required evidence: old decoder result, API response, switch request capture, Binding
  transition, and adapter regression result.
- Expected result: old fields retain meaning; added fields are ignorable; switch remains
  target-Agent-only and success is evidenced by Binding change for the next message.
- Failure condition: old client break, changed switch wire/adapter/Session semantics,
  same-turn handoff claim, or model prose accepted as switch proof.

### 10.1 Bidirectional coverage matrix

| Contract | Acceptance |
|---|---|
| `CTR-PRESENTATION-SCHEMA-001` | `ACC-PRESENTATION-SCHEMA-001` |
| `CTR-PRESENTATION-LOAD-001` | `ACC-PRESENTATION-LOAD-001` |
| `CTR-PRESENTATION-MERGE-001` | `ACC-PRESENTATION-MERGE-001` |
| `CTR-DUPLICATE-AGENT-001` | `ACC-DUPLICATE-AGENT-001` |
| `CTR-UNKNOWN-AGENT-001` | `ACC-UNKNOWN-AGENT-001` |
| `CTR-DISABLED-VISIBILITY-001` | `ACC-DISABLED-VISIBILITY-001` |
| `CTR-MOBILE-VISIBILITY-001` | `ACC-MOBILE-VISIBILITY-001` |
| `CTR-DEFAULT-AGENT-001` | `ACC-DEFAULT-AGENT-001` |
| `CTR-FEATURED-001` | `ACC-FEATURED-001` |
| `CTR-SORT-001` | `ACC-SORT-001` |
| `CTR-ASSET-URL-001` | `ACC-ASSET-URL-001` |
| `CTR-PRODUCT-API-001` | `ACC-PRODUCT-API-001` |
| `CTR-NO-AUTHORITY-LEAK-001` | `ACC-NO-AUTHORITY-LEAK-001` |
| `CTR-BACKWARD-COMPAT-001` | `ACC-BACKWARD-COMPAT-001` |

Every Contract has one Acceptance item and every Acceptance item references exactly
one existing Contract. Coverage is structural authoring coverage only, not executed
conformance evidence.

## 11. Alternatives and disposition

### ALT-APR-001 — Put presentation back into Agent Definition

Rejected. It would reopen a frozen schema, couple high-frequency presentation to
existence/routing, and repeat the removed avatar field.

### ALT-APR-002 — Let Mobile own the fleet presentation map

Rejected. Mobile is a consumer, would drift from backend membership, and could create
a second default/name authority.

### ALT-APR-003 — Make Presentation a runtime-writable database

Rejected. V1 needs a reviewed deployment artifact, deterministic startup validation,
and no dynamic upload/edit surface.

### ALT-APR-004 — Infer default from the first API item

Rejected. Array order is presentation; default is Agent Definition authority.

### ALT-APR-005 — Truncate featured entries above eight

Rejected. Silent truncation makes deployment mistakes order-dependent; fail-loud
validation is deterministic.

### ALT-APR-006 — Implement voice or switch behavior here

Rejected. `voiceProfileId` is opaque; Voice, Router, Binding, Session, and switch
semantics have separate authorities.

## 12. Migration, compatibility, and rollback

### 12.1 Future implementation migration

A future implementation MAY introduce a configuration path/allowlist seam and the
reader/Product API merge only after this exact Spec is accepted in its base. Existing
deployments that do not configure a Registry enter the empty-registry compatibility
mode. No `agents.json`, Workspace, Binding, Session, Router, or Mobile migration is
permitted.

### 12.2 Compatibility

- old clients continue to read `id`, `name`, `description`, and `avatar`;
- `avatar` retains `string|null`;
- new JSON fields are additive and ignorable;
- missing Presentation retains route behavior and uses display defaults;
- runtime fleet count remains observed data, never a frozen numeric Contract.

### 12.3 Rollback

The later implementation rollback unit is the presentation reader/Product API merge
and its local configuration. Removing the optional configuration returns to empty-
registry behavior. Rollback MUST NOT rewrite Registry, Agent Definition, Binding,
Session, Workspace, or Mobile state. This proposed docs-only PR requires only Git
revert if rejected; it has no runtime rollback.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS          = NONE
NORMATIVE_TBD                 = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION          = NONE
```

Non-normative follow-up: after this Spec is independently reviewed and accepted, a
separate implementation task may implement only its Contracts. A separate Mobile
Spec (`MOBILE_AGENT_ROLE_SURFACE_V1`, in `mayf3/agent-core-mobile`) may then define
rendering, category/search UI, Binding-driven animation, persisted previous-Agent
navigation, and the future Voice-authority handoff without changing the current
canary in its docs-only round.
