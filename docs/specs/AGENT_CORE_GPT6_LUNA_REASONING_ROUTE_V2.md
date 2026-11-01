---
spec_id: AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V2
status: proposed
acceptance_status: PENDING_OWNER_EXACT_HEAD_ACCEPTANCE
acceptance_status_scope: Owner direction dated 2026-11-01 authorizes direction A and docs authoring; exact-head acceptance remains pending
ACCEPTANCE: PENDING_OWNER_EXACT_HEAD_ACCEPTANCE
owner_direction_date: 2026-11-01
owner_exact_head_acceptance: pending
acceptance_final_head: PENDING_FINAL_HEAD_OF_PR_601
acceptance_head_binding: Owner must bind the reviewed commit and final accepted PR head in PR 601; this placeholder is not acceptance
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-11-01
scope:
  - complete dormant GPT6 reasoning capability and explicit ordinary fleet identity migration
governed_by:
  - AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V4
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
external_authorities:
  - repository: mayf3/dsh-codex
    authority_id: DSH_CODEX_SHARED_AUTH_PROTECTION_RESTORE_V1
    revision: 7cfa139e111956a7193622afc734126b52d7bf07
    relation: constrained_by
supersedes:
  - AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V2

Whole-authority replacement candidate for `AGENT_CORE_GPT6_LUNA_REASONING_ROUTE_V1` at main `3a1282b35e7b852f51cd14284ea91fd77a13543e`.
The `acceptance_status` records the supplied Owner D14 direction designation. `status: proposed`
is deliberate: no exact-byte Owner acceptance or predecessor backlink is invented. This file and
its three peer successors activate only in the atomic transaction in
[AGENT_CORE_D14_FLEET_GENERATION_SUCCESSION_V1](AGENT_CORE_D14_FLEET_GENERATION_SUCCESSION_V1.md). They are complete replacement texts, not clause overlays.
The old authority remains current until that transaction enters main. No implementation or
production admission is authorized by this branch. All inherited observations remain historical
at their original coordinates and are not new runtime verification.

## 0. Historical V1 review lineage (not this draft review)

The first proposal attempted to amend V3 directly at reviewed head
`eabe0062bfa5fdb32da56c267877167b17da3c45` and received independent `REVISE` with three blockers.
V1 was the NEW authority used for that historical repair. This V2 is a complete SUPERSEDE candidate;
its current review and lifecycle gates are the D14 transaction's, not that old review result.

```text
HISTORICAL_V1_FROZEN_BLOCKER_UNION =
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
  credentialFile=SCA V4 canonical shared store
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
ORDINARY_FLEET_IDENTITY_CHANGE = explicit D14 migration only; no effort/model/credential-policy change
```

## 2. Authority boundary and precedence
### DEC-G6R2-001 — independent dormant capability and explicit fleet identity succession

SCA V4 remains the authority for credential ownership, shared-store path, refresh/intent/lock behavior,
permissions, redaction, proxy safety and the currently activated `gpt-5.6-luna` tuple. This Spec is
parallel, narrower Product Authority for a route tuple SCA V4 does not define.

The source implementation MAY merge while dormant. Merge alone MUST NOT mutate production config,
restart a runtime, install the new artifact into a live profile or change the active model. A later
Deployment/activation operation must explicitly select the new tuple under its own controlled gate.

### CTR-G6R2-001 — ordinary fleet migration and absent-effort behavior

The normal fleet tuple after the D14 controlled migration is the exact accepted gen-032/0.3.2
identity in CTR-D14-001. Migration MUST explicitly update obsolete legacy0.2.3 route artifact fields
and bind the before/after config under CTR-D14-005; no existing0.2.3 identity may silently resolve
to0.3.2 bytes. Preserve provider/model, precedence, route source/order, credential domain, proxy
semantics and absent reasoningEffort. The old byte-equivalent resolved/provisioned0.2.3 identity
requirement is replaced only for this explicit migration. A stale unmigrated pin is refused, and a
rollback0.2.3 candidate remains subject to complete CTR-D14-007 qualification.

## 3. Exact GPT-6 route and dependency identity
### DEC-G6R2-002 — provider/model/route identity

The only new GPT-6 tuple retained by this V2 is:

```text
routeKind = subscription
provider = openai-codex
model = gpt-6-luna
plugin = dsh-codex
pluginVersion = 0.2.3-dshr1
credentialFile = /Users/yanfenma/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
credentialReadiness = deployment-owned existing same-domain reference
providerEnv = existing version-3 optional allowlisted proxy block, unchanged
```

No Agent ID is part of this tuple. Selection remains deployment-owned model override configuration.
The tuple does not authorize automatic promotion from `gpt-5.6-luna` or fallback to it.

### DEC-G6R2-003 — exact dependency bytes

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

### CTR-G6R2-002 — independent dormant tuple remains exact

The dormant GPT6 tuple remains `gpt-6-luna / dsh-codex@0.2.3-dshr1` with every source/patch/archive/
pi-ai/Harness digest in DEC-G6R2-003 unchanged. Gen-032 MUST NOT substitute for that artifact, inherit
its reasoning capability, or receive its identity. No automatic GPT6 activation is authorized.
The ordinary fleet tuple uses CTR-D14-001, while the dormant tuple remains separately selected and
validated. A shared current/home that resolves gen-032 cannot satisfy the dormant tuple's pin.
Its deployment needs a separately bound exact artifact path and controlled operation; it may not
change fleet current merely to satisfy that dormant route.

## 4. reasoningEffort contract
### DEC-G6R2-004 — closed vocabulary and tuple-local default

The version-3 route field is named `reasoningEffort`. For the NEW GPT-6 tuple only, the closed
configuration vocabulary is:

```text
none | minimal | low | medium | high | xhigh | max
```

`reasoningEffort` is optional on the GPT-6 tuple. If absent, its **effective value is `medium`** before
canonical identity and provisioning are computed. This default does not apply to ordinary fleet Codex
routes; their absent field remains absent and preserves pre-change behavior.

The field is forbidden on builtin routes, non-dsh-codex subscription routes, and the ordinary fleet
`dsh-codex@0.3.2` tuple. Such presence is malformed configuration and fails loud.

### DEC-G6R2-005 — authoritative seven-value mapping

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

### DEC-G6R2-006 — fail-loud, no degradation

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

### CTR-G6R2-003 — canonical route identity
For the NEW GPT-6 tuple, canonical identity includes effective `reasoningEffort` before process reuse.
Thus `medium != high` and `none != medium`. Absent and explicit `medium` on the GPT-6 tuple normalize
to the same effective identity. Ordinary fleet identity changes only by the explicit D14 migration per `CTR-G6R2-001`; absent effort remains absent.

### CTR-G6R2-004 — single mechanical passthrough

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

### CTR-G6R2-005 — version-3 schema remains one authority surface

The top-level config remains exactly `version: 3` with existing `routeCatalog` and `overrides` shapes.
This Spec adds only one route-local optional key, `reasoningEffort`, under the eligibility rules above.
All pre-existing exact-key, duplicate-key, registered-Agent, routeRef, providerEnv, credentialFile,
route-length and canonical-alias checks remain in force.
`reasoningEffort` does not participate in route order. It cannot authorize a hop, change a deadline,
change one-logical-turn semantics or alter Scheduler inheritance.

### CTR-G6R2-006 — OAuth / credential custody remains SCA V4-only

This lane MUST NOT create, copy, refresh, scrape or replace an OAuth credential. It MUST NOT create a
second store and MUST NOT use `OPENAI_API_KEY` or any API token as a substitute for Owner OAuth.
The new route references exactly the SCA V4 canonical credential path and inherits all SCA V4 permission,
refresh-intent, same-filename lock, redaction and outcome-unknown contracts unchanged.

If source and Spec closure complete while canonical reauth is pending, the frozen deployment package
may report exactly:

```text
EXTERNAL_BLOCKER = OWNER_AUTH_CANONICAL_OAUTH_REAUTH_PENDING
```

That blocks real-turn deployment acceptance, not source merge.

## 6. Acceptance

### ACC-G6R2-001 — explicit fleet migration and tuple separation

In an isolated version3 loader/provisioning/reuse fixture at exact candidate coordinates, execute
old0.2.3 config + gen-032 refusal; explicit authorized migration to descriptor-bound0.3.2 success
only with all protection gates; and unchanged consistent tuple behavior. Compare provider/model,
route source/order, credential/proxy and absent effort before/after. Record artifact/config hashes,
commands, exit codes, real provisioning identity, zero provider dispatch on negatives and zero
payload writes. Wrong source/archive/Harness, stale pin, dormant0.2.3-dshr1 routed to gen-032 or
injected legacy effort fails acceptance. No old byte-equality assertion is reused for changed identity.

### ACC-G6R2-002 — exact dependency and GPT-6 registry proof

Required executed evidence:

- candidate dsh-codex patch/artifact/source-stamp hashes exactly match `DEC-G6R2-003`;
- exact pi-ai npm tgz hash and embedded openai-codex catalog hash match `DEC-G6R2-003`;
- that catalog resolves `openai-codex / gpt-6-luna` and an unknown model still fails loud;
- deployment/provisioning refuses a pi-ai version/artifact outside the frozen identity.

### ACC-G6R2-003 — all seven reasoning mappings

At the real adapter/request boundary with network replaced only by a capture transport, execute all
seven values and assert the exact wire mapping in `DEC-G6R2-005`. Also prove absent GPT-6 effort equals
explicit `medium` in resolved route identity and wire request.

### ACC-G6R2-004 — unsupported effort failure

Use a catalog model/effort combination that is vocabulary-valid but unsupported (for example a frozen
pi-ai 0.87.1 model lacking `max`). Required result:

```text
ERROR_CODE = UNSUPPORTED_REASONING_EFFORT
PROVIDER_GENERATION_DISPATCH_COUNT = 0
ROUTE_FALLBACK_HOP_COUNT = 0
TERMINAL = FAIL_LOUD
```
### ACC-G6R2-005 — invalid field/surface matrix

Execute negative fixtures for:

```text
unknown reasoning value
reasoningEffort on builtin route
reasoningEffort on non-dsh-codex subscription
reasoningEffort on ordinary fleet dsh-codex@0.3.2 tuple
GPT-6 tuple with wrong pluginVersion
GPT-6 tuple with non-canonical credentialFile
providerEnv unknown/missing/unsafe keys
```

Every invalid config must fail before target process spawn and must not expose secrets.

### ACC-G6R2-006 — lifecycle and unaffected-surface regression

Focused tests must cover create/resume/restart consistency, route-chain STOP/hop invariants,
OPENAI_API_KEY omission, canonical credential path, proxy validation, shared-store boundaries,
non-Codex routes and Scheduler inheritance. Any full-suite failure must be reproduced on pristine base
before it may be classified pre-existing.

### ACC-G6R2-007 — source merge and frozen package

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
ORDINARY_FLEET_TARGET_AFTER_D14_GATES = gpt-5.6-luna / gen-032 / dsh-codex@0.3.2
GPT6_TARGET = gpt-6-luna / dsh-codex@0.2.3-dshr1 / reasoningEffort=medium
ROLLBACK = complete qualified generation + matching expected descriptor under CTR-D14-007; no credential mutation
DEPLOYMENT_AUTHORITY = separate Deployment Agent controlled operation
REAL_TURN_ACCEPTANCE_REQUIRES_OWNER_AUTH = YES
```
