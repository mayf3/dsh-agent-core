---
spec_id: AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1
status: accepted
date: 2026-09-24
accepted_date: 2026-09-24
accepted_by: mayf3
accepted_reviewed_head: 9b7018e7284e06a738e988c22e7db3a16248e0d4
independent_review_result: PASS
independent_review_blockers: NONE
acceptance_verdict: READY_FOR_ACCEPTANCE_FINALIZE
acceptance_finalize_semantic_change: none
acceptance_authority_basis: >-
  Owner mandate in GPT6_LUNA_AND_REASONING_EFFORT_V1 source-closure instruction on 2026-09-24;
  independent exact-head re-audit accepted 9b7018e7284e06a738e988c22e7db3a16248e0d4 with zero blockers.
type: implementation-spec (NEW dormant route capability; no production apply)
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
supersedes: []
superseded_by: null
governed_by:
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
external_authorities:
  - repository: Yan-Zero/dsh-codex
    authority_id: DSH_CODEX_RELEASE_V1_BASE
    revision: 75d98d5b10bb926d53108e49019668c1bde2a9eb
    relation: patched_from
  - repository: earendil-works/pi
    authority_id: PI_AI_NPM_ARTIFACT_0_87_1
    revision: npm:@earendil-works/pi-ai@0.87.1
    relation: exact_artifact_dependency
scope:
  - dormant source/config capability for openai-codex / gpt-6-luna
  - per-route reasoningEffort for the new GPT-6 Luna tuple only
  - exact patched dsh-codex and pi-ai dependency identities
  - additive extension of agent-model-overrides.json version 3 without changing existing V3 route semantics
owners:
  - mayf3
---

# AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1

> `TASK_NAME = GPT6_LUNA_AND_REASONING_EFFORT_V1` · `AUTHORITY_ACTION = NEW` ·
> `ROUTE_STAGE = AUTHORITY_AUTHORING`。
>
> This authority adds one dormant route capability. It does **not** supersede or amend
> `AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V3`: V3 continues to own canonical OAuth/credential topology,
> refresh semantics, current `gpt-5.6-luna / dsh-codex@0.2.3` production coordinates and all existing
> route-chain safety contracts. This Spec owns only the new GPT-6 tuple, its reasoning dimension and
> the exact dependency bytes needed to make that tuple serviceable.

## 0. Review lineage and frozen blocker union

The first proposal attempted to amend V3 directly at reviewed head
`eabe0062bfa5fdb32da56c267877167b17da3c45` and received independent `REVISE` with three blockers.
This NEW authority is the single blocker-union repair pass required by repository convergence policy.

```text
FROZEN_BLOCKER_UNION =
  B1 authority shape: ordinary AMEND would change V3 route meaning -> use separate NEW capability authority
  B2 dependency identity: patched dsh-codex + pi-ai require exact source/artifact authority
  B3 reasoning proof: all seven values + exact unsupported failure require executable acceptance coverage
NO_OTHER_SEMANTIC_EXPANSION = YES
```
## 1. Goal and non-goals

Goal:

```text
NEW_ROUTE_CAPABILITY =
  routeKind=subscription
  provider=openai-codex
  model=gpt-6-luna
  plugin=dsh-codex
  pluginVersion=0.2.3-dshr1
  credentialFile=V3 canonical shared store
  reasoningEffort=explicit per-route value, default medium for this NEW tuple
```

Non-goals:

```text
PRODUCTION_SWITCH = NO
OWNER_OAUTH_REAUTH = OUT_OF_SCOPE
SECOND_CREDENTIAL_DOMAIN = FORBIDDEN
API_TOKEN_AS_OWNER_OAUTH = FORBIDDEN
SECRET_SCRAPING = FORBIDDEN
DYNAMIC_EFFORT_SELECTION = FORBIDDEN
PROMPT_BASED_REASONING_CONTROL = FORBIDDEN
ROUTE_ORDER_OR_FALLBACK_POLICY_CHANGE = NONE
V3_LEGACY_ROUTE_SEMANTIC_CHANGE = NONE
```

## 2. Authority boundary and precedence
### DEC-G6R-001 — NEW capability, V3 unchanged

V3 remains the authority for credential ownership, shared-store path, refresh/intent/lock behavior,
permissions, redaction, proxy safety and the currently activated `gpt-5.6-luna` tuple. This Spec is
parallel, narrower Product Authority for a route tuple V3 does not define.

The source implementation MAY merge while dormant. Merge alone MUST NOT mutate production config,
restart a runtime, install the new artifact into a live profile or change the active model. A later
Deployment/activation operation must explicitly select the new tuple under its own controlled gate.

### CTR-G6R-001 — legacy route byte/behavior compatibility

A version-3 model override that was valid under V3 and contains the legacy Codex tuple:

```text
provider=openai-codex
plugin=dsh-codex
pluginVersion=0.2.3
reasoningEffort=ABSENT
```

MUST remain valid after this source capability merges. Its resolved process configuration, effective
reasoning behavior and canonical route identity MUST remain byte-equivalent to the pre-change source.
The new capability MUST NOT globally replace the V3 plugin pin or inject a reasoning default into the
legacy tuple.

## 3. Exact GPT-6 route and dependency identity
### DEC-G6R-002 — provider/model/route identity

The only new GPT-6 tuple authorized by this V1 is:

```text
routeKind = subscription
provider = openai-codex
model = gpt-6-luna
plugin = dsh-codex
pluginVersion = 0.2.3-dshr1
credentialFile = /Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
credentialReadiness = deployment-owned existing V3 reference
providerEnv = existing version-3 optional allowlisted proxy block, unchanged
```

No Agent ID is part of this tuple. Selection remains deployment-owned model override configuration.
The tuple does not authorize automatic promotion from `gpt-5.6-luna` or fallback to it.

### DEC-G6R-003 — exact dependency bytes

The patched plugin is an exact derivative of accepted upstream `dsh-codex@0.2.3`:

```text
DSH_CODEX_BASE_SOURCE_COMMIT = 75d98d5b10bb926d53108e49019668c1bde2a9eb
DSH_CODEX_PATCHED_VERSION = 0.2.3-dshr1
DSH_CODEX_PATCHED_SOURCE_COMMIT = 42f14343e1506d7d06216d7fa580cae5161001dc
DSH_CODEX_PATCH_SHA256 = e2936d1620eb203d88541a7d867ad40550e3aff5c7fbc722797d7409e4649305
DSH_CODEX_ARTIFACT_SHA256 = 160bbefcc8ebe8a1a2c966ec89cdc3a723c0a0ef8cb90fe121772b18970830b5
DSH_CODEX_SOURCE_STAMP_SHA256 = 81d0fd12416f94297b50565962bab3f2037278bd1c1da9edf2f0c07d774de4a0
PI_AI_VERSION = 0.87.1
PI_AI_NPM_TGZ_SHA256 = 35b4432f27cc2665f86beebb9af6a39b1251970883c3044bd8be4f4e8c731ca0
PI_AI_OPENAI_CODEX_CATALOG_SHA256 = 4bb30a26d1b40e1f67c9f24891fca0ce25b030bc4cbbb529be78608cd4466fdf
DSH_VERSION = 0.1.0-rc.8
DSH_COMMIT = 514ab7b0029141b88c807704764d0d3e1eea1da4
```

The deployment package MUST contain the exact dsh-codex artifact/patch/source-stamp and MUST bind
pi-ai to the exact 0.87.1 npm artifact hash above. A semver range or an unverified later pi-ai build is
not equivalent evidence. The patched dsh-codex delta is limited to the reasoning-profile config seam
plus dependency compatibility; OAuth/credential/search/image/refresh/lifecycle semantics are unchanged.

### CTR-G6R-002 — tuple-specific pin selection

Source code MUST preserve the V3 `dsh-codex@0.2.3` artifact identity for legacy routes and select the
new exact artifact identity only for the GPT-6 tuple. A single global pin that makes an existing V3
config invalid is forbidden.

## 4. reasoningEffort contract
### DEC-G6R-004 — closed vocabulary and tuple-local default

The version-3 route field is named `reasoningEffort`. For the NEW GPT-6 tuple only, the closed
configuration vocabulary is:

```text
none | minimal | low | medium | high | xhigh | max
```

`reasoningEffort` is optional on the GPT-6 tuple. If absent, its **effective value is `medium`** before
canonical identity and provisioning are computed. This default does not apply to legacy V3 Codex
routes; their absent field remains absent and preserves pre-change behavior.

The field is forbidden on builtin routes, non-dsh-codex subscription routes, and the legacy
`dsh-codex@0.2.3` tuple. Such presence is malformed configuration and fails loud.

### DEC-G6R-005 — authoritative seven-value mapping

Under exact pi-ai 0.87.1 and the frozen rc.8 Harness seam, mapping is:

| `reasoningEffort` | dsh-codex profile value | pi-ai request option / mapping | Codex wire `reasoning.effort` |
|---|---|---|---|
| `none` | `off` | Harness omits `options.reasoning`; pi-ai Codex default | `none` |
| `minimal` | `minimal` | `thinkingLevelMap.minimal = low` | `low` |
| `low` | `low` | `thinkingLevelMap.low = low` | `low` |
| `medium` | `medium` | `thinkingLevelMap.medium = medium` | `medium` |
| `high` | `high` | `thinkingLevelMap.high = high` | `high` |
| `xhigh` | `xhigh` | `thinkingLevelMap.xhigh = xhigh` | `xhigh` |
| `max` | `max` | `thinkingLevelMap.max = max` | `max` |

`none` therefore means **explicit no-thinking at the frozen wire boundary**, not "provider default".
`minimal` and `low` are distinct accepted config spellings even though GPT-6 Luna maps both to wire
`low`; canonical identity uses the configured/effective route value, not the mapped wire alias.

### DEC-G6R-006 — fail-loud, no degradation

Failure semantics are closed:

```text
OUT_OF_VOCABULARY -> AGENT_MODEL_OVERRIDE_INVALID at config/load boundary
VOCABULARY_VALID_BUT_MODEL_UNSUPPORTED -> LlmError code UNSUPPORTED_REASONING_EFFORT
AUTO_CLAMP_OR_DOWNGRADE = FORBIDDEN
AUTO_MODEL_SWITCH = FORBIDDEN
NEW_FALLBACK_CLASS = FORBIDDEN
```

The existing `dsh-llm-pi-ai` request path must call its strict `resolveReasoningLevel`, not pi-ai's
clamping helper. `UNSUPPORTED_REASONING_EFFORT` must occur before provider generation/dispatch. It is
not added to the route-chain proven-no-admission hop allowlist; therefore existing STOP semantics apply.

### CTR-G6R-003 — canonical route identity
For the NEW GPT-6 tuple, canonical identity includes effective `reasoningEffort` before process reuse.
Thus `medium != high` and `none != medium`. Absent and explicit `medium` on the GPT-6 tuple normalize
to the same effective identity. Legacy V3 route identity bytes remain unchanged per `CTR-G6R-001`.

### CTR-G6R-004 — single mechanical passthrough

The only accepted path is:

```text
agent-model-overrides route
  -> effective processConfig.subscription.reasoningEffort
  -> Agent provisioning
  -> dsh-codex profile reasoning
  -> existing dsh-llm-pi-ai profile.reasoning / options.reasoning
  -> pi-ai 0.87.1 model metadata
  -> Codex Responses reasoning.effort
```

Per-Agent code branches, hidden effort environment variables, prompt injection, task-complexity
classification and a second reasoning implementation are forbidden.

## 5. Relation to existing model-override/config contract

### CTR-G6R-005 — version-3 schema remains one authority surface

The top-level config remains exactly `version: 3` with existing `routeCatalog` and `overrides` shapes.
This Spec adds only one route-local optional key, `reasoningEffort`, under the eligibility rules above.
All pre-existing exact-key, duplicate-key, registered-Agent, routeRef, providerEnv, credentialFile,
route-length and canonical-alias checks remain in force.
`reasoningEffort` does not participate in route order. It cannot authorize a hop, change a deadline,
change one-logical-turn semantics or alter Scheduler inheritance.

### CTR-G6R-006 — OAuth / credential custody remains V3-only

This lane MUST NOT create, copy, refresh, scrape or replace an OAuth credential. It MUST NOT create a
second store and MUST NOT use `OPENAI_API_KEY` or any API token as a substitute for Owner OAuth.
The new route references exactly the V3 canonical credential path and inherits all V3 permission,
refresh-intent, same-filename lock, redaction and outcome-unknown contracts unchanged.

If source and Spec closure complete while canonical reauth is pending, the frozen deployment package
may report exactly:

```text
EXTERNAL_BLOCKER = OWNER_AUTH_CANONICAL_OAUTH_REAUTH_PENDING
```

That blocks real-turn deployment acceptance, not source merge.

## 6. Acceptance

### ACC-G6R-001 — legacy compatibility

Against the exact pre-change canonical source, execute fixtures proving an existing V3
`openai-codex / dsh-codex@0.2.3 / reasoningEffort absent` config remains valid and produces identical:

```text
resolved route fields
processConfig subscription fields
canonical route identity bytes
credentialFile/providerEnv behavior
provisioned legacy plugin identity
```

### ACC-G6R-002 — exact dependency and GPT-6 registry proof

Required executed evidence:

- candidate dsh-codex patch/artifact/source-stamp hashes exactly match `DEC-G6R-003`;
- exact pi-ai npm tgz hash and embedded openai-codex catalog hash match `DEC-G6R-003`;
- that catalog resolves `openai-codex / gpt-6-luna` and an unknown model still fails loud;
- deployment/provisioning refuses a pi-ai version/artifact outside the frozen identity.

### ACC-G6R-003 — all seven reasoning mappings

At the real adapter/request boundary with network replaced only by a capture transport, execute all
seven values and assert the exact wire mapping in `DEC-G6R-005`. Also prove absent GPT-6 effort equals
explicit `medium` in resolved route identity and wire request.

### ACC-G6R-004 — unsupported effort failure

Use a catalog model/effort combination that is vocabulary-valid but unsupported (for example a frozen
pi-ai 0.87.1 model lacking `max`). Required result:

```text
ERROR_CODE = UNSUPPORTED_REASONING_EFFORT
PROVIDER_GENERATION_DISPATCH_COUNT = 0
ROUTE_FALLBACK_HOP_COUNT = 0
TERMINAL = FAIL_LOUD
```
### ACC-G6R-005 — invalid field/surface matrix

Execute negative fixtures for:

```text
unknown reasoning value
reasoningEffort on builtin route
reasoningEffort on non-dsh-codex subscription
reasoningEffort on legacy dsh-codex@0.2.3 tuple
GPT-6 tuple with wrong pluginVersion
GPT-6 tuple with non-canonical credentialFile
providerEnv unknown/missing/unsafe keys
```

Every invalid config must fail before target process spawn and must not expose secrets.

### ACC-G6R-006 — lifecycle and unaffected-surface regression

Focused tests must cover create/resume/restart consistency, route-chain STOP/hop invariants,
OPENAI_API_KEY omission, canonical credential path, proxy validation, shared-store boundaries,
non-Codex routes and Scheduler inheritance. Any full-suite failure must be reproduced on pristine base
before it may be classified pre-existing.

### ACC-G6R-007 — source merge and frozen package

Before handoff to Deployment Agent:

```text
SPEC_ACCEPTED = YES
MERGED_TO_CANONICAL_MAIN = YES
FOCUSED_TESTS = PASS
INDEPENDENT_AFFECTED_SURFACE_REVIEW = PASS
DEPLOYMENT_PACKAGE = FROZEN
PRODUCTION_MUTATION = NONE
```
The frozen package binds exact canonical source SHA, exact dependency artifacts and hashes, target
version-3 config, rollback tuple and post-deploy acceptance. A pending Owner/Auth reauth may be the
sole external blocker.

## 7. Rollback and deployment boundary

```text
SOURCE_MERGE_IS_PRODUCTION_APPLY = NO
CURRENT_PRODUCTION_TARGET_REMAINS = gpt-5.6-luna / dsh-codex@0.2.3
GPT6_TARGET = gpt-6-luna / dsh-codex@0.2.3-dshr1 / reasoningEffort=medium
ROLLBACK = restore legacy V3 tuple; no credential mutation
DEPLOYMENT_AUTHORITY = separate Deployment Agent controlled operation
REAL_TURN_ACCEPTANCE_REQUIRES_OWNER_AUTH = YES
```

## 8. Authoring output

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
SPEC_ID = AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1
STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts
PRODUCTION_APPLY_AUTHORITY = none
FROZEN_BLOCKER_UNION_CLOSED_BY_DESIGN = B1+B2+B3
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
PRODUCTION_CHANGE = NONE
```

## 9. Acceptance record

```text
ACCEPTED_BY = mayf3
ACCEPTED_DATE = 2026-09-24
ACCEPTED_REVIEWED_HEAD = 9b7018e7284e06a738e988c22e7db3a16248e0d4
INDEPENDENT_REVIEW = ACCEPT
INDEPENDENT_REVIEW_BLOCKERS = 0
B1_CLOSED = YES
B2_CLOSED = YES
B3_CLOSED = YES
ACCEPTANCE_FINALIZE_SEMANTIC_CHANGE = NONE
IMPLEMENTATION_READY_TO_BEGIN = YES
PRODUCTION_APPLY_AUTHORITY = NONE
```
