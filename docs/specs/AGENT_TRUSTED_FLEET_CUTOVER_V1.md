---
spec_id: AGENT_TRUSTED_FLEET_CUTOVER_V1
status: proposed
type: bounded-fleet-cutover-spec
review_status: READY_FOR_INDEPENDENT_REVIEW
implementation_authority: none
production_apply_authority: none
owner_intent_provenance: direct Owner instruction, session 2026-08-22
phases:
  - BASIC_RUNTIME_AND_ACCOUNT_RESTORE
  - WORKFLOW_FORUM_GRANT_RESTORE
authority_dependencies:
  - AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2@261a80e66e52bf60d43980e9d22fe37dc793e5be
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1@d83a2ff0e9644611707d7481ef88b4d7d49fb68e
  - AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1_PHASE_A@83d10b8ad8d10595d18c190190ff99f9cfcd5185
---

# Agent Trusted Fleet Cutover V1

> **PROPOSED / DOCS-ONLY / NO IMPLEMENTATION OR PRODUCTION AUTHORITY.**
>
> 本修订仅冻结 exact 86 Trusted Fleet 的两阶段恢复计划，并关闭已由 accepted
> authority 与最新 production read-only inventory 消除的旧 blocker。本修订不实现、
> 不 accept、不 merge、不 production apply，不创建 Principal/Client/Credential/Grant，
> 不写 Agent Definition/Home/Workspace/Binding，不 reload/restart Runtime。

## 0. Lifecycle and owner ordering

```text
TASK_NAME = 注册 执行
STATUS = proposed
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none

RESTORE_BASIC_OPERATION_FIRST = YES
RESTORE_WORKFLOW_FORUM_SECOND = YES
PHASE_2_BLOCKS_PHASE_1 = NO

IMPLEMENTATION_AUTHORIZED_NOW = NO
PRODUCTION_CHANGE = NONE
NEXT_TASK = 注册 审计
```

本文件描述的 “MUST / SHALL / authorized scope” 仅冻结未来 acceptance 与独立 execution
authority 的最大允许范围；在本文件仍为 `proposed` 且 `implementation_authority=none`
时，任何 apply 均未获授权。

## 1. Pinned authority graph

开工前已在 `origin/main@6df9df8cae64c0768b29a4267258af67535daae8`
重新核对以下 revisions 均为 main ancestors：

| Authority / implementation | Exact revision | Status and relationship |
|---|---|---|
| `AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2` | acceptance-finalize/main revision `261a80e66e52bf60d43980e9d22fe37dc793e5be`; independently reviewed semantic revision `ae77eccf242d3b7401bb8110d4496897cc807ca7` | accepted/current whole-authority Workspace replacement; REUSE; its own `implementation_authority=none` is preserved |
| `AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1` Amendment 6 | current accepted revision / file last change `d83a2ff0e9644611707d7481ef88b4d7d49fb68e`; reviewed semantic revision `5d1285195f8c2e3eb88ea606be09671b074f68d4` | accepted Phase-A clean-bootstrap authority; REUSE only |
| Phase-A implementation, PR #17 | final merged implementation head `83d10b8ad8d10595d18c190190ff99f9cfcd5185`; merge commit `79cc8e861cbb16755370b0e9f30ef3fb47c56fa6` | present on main; exact clean-bootstrap implementation baseline |
| Phase-A trusted-store hardening | `d8cb1b0d2536c424653bd514486490ea16208c56` | present on main; current post-merge UTF-8/atomic replacement hardening applied to the Phase-A store writer |
| this Spec | Draft PR #47 exact head after this revision | proposed child; grants no current implementation or production authority |

Authority consequences:

```text
WORKSPACE_AUTHORITY_PRESENT = YES
PHASE_A_AUTHORITY_PRESENT = YES
WORKSPACE_WHOLE_AUTHORITY_BLOCKER = CLOSED
CREDENTIAL_RECONCILIATION_CHILD_NEEDED = NO
PHASE_B_REQUIRED_COUNT = 0
PARENT_CLIENT_ROUTE_BLOCKED_COUNT = 0
```

The prior blanket authority-insufficiency assertion, fleet Phase-B credential blocker, and parent
client-ID route blocker are removed because they are no longer true. Grant state remains unknown,
but is isolated to Phase 2 and MUST NOT block Phase 1.

Acceptance of this proposed child would still not itself approve a production run. A separately
reviewed execution/runbook authority and explicit production approval remain required before apply.

## 2. Pinned production read-only inventory

The completed redacted inventory is immutable evidence for this proposal:

```text
INVENTORY_RESULT_SHA256 = 56a75dde3942e4d0b1acdb822c664de32770b5f5b4ce848769c32e4b2f5e8419
INVENTORY_SCRIPT_SHA256 = 58ab3c2854c6b74cd30eb41c71618be7df310dec1aec11c23e57f619db04b664
INVENTORY_GENERATED_AT = 2026-08-22T15:25:22.725Z
EXACT_ROSTER_SHA256 = f046d18f76da838ba94775af7c960d0ee548f2e392c22e6c7b0e3add36cb8e5f
TOTAL = 86
CLASS_A_CLEAN_BOOTSTRAP_COUNT = 86
CLASS_B_EXISTING_MATCH_COUNT = 0
CLASS_C_RECONCILIATION_COUNT = 0
CLASS_D_ERROR_COUNT = 0
PARENT_CLIENT_ROUTE_BLOCKED_COUNT = 0
GRANT_UNKNOWN_COUNT = 86
```

`EXACT_ROSTER_SHA256` is SHA-256 of the compact JSON array of §3 IDs in listed order. Every
inventory row is exactly:

```text
principal = ABSENT
client = ABSENT
credential = ABSENT
client_id_match = NOT_APPLICABLE
grant_state = UNKNOWN
classification = CLASS_A_CLEAN_BOOTSTRAP
```

The evidence reports zero Definition, credential, Binding, Grant, and Runtime mutation and no
production secret exposure. The inventory result and script digests were independently recomputed
before this docs revision and matched the values above.

## 3. Exact 86 frozen Agent IDs

This ordered array is the complete and only fleet. Count must equal 86, entries must be unique,
and every future plan/apply must match both this array and `EXACT_ROSTER_SHA256`. Count-only or
mutable discovery MUST NOT widen the set.

```json
[
  "agt_ceo-agent",
  "agt_stock-agent",
  "agt_research-agent",
  "agt_knowledge-curator-agent",
  "agt_daily-thought-agent",
  "agt_efficiency-agent",
  "agt_lobster-agent",
  "agt_itops-agent",
  "agt_healthcheck-agent",
  "agt_hr-agent",
  "agt_security-agent",
  "agt_skill-engineer-agent",
  "agt_discipline-coach-agent",
  "agt_blog-agent",
  "agt_education-agent",
  "agt_psychology-agent",
  "agt_game-dev-agent",
  "agt_finance-agent",
  "agt_devtools-agent",
  "agt_voice-tech-agent",
  "agt_image-gen-agent",
  "agt_email-manager-agent",
  "agt_account-manager-agent",
  "agt_shopping-list-agent",
  "agt_feishu-expert-agent",
  "agt_podcast-producer-agent",
  "agt_soul-questioner-agent",
  "agt_lobster-guide-agent",
  "agt_article-publisher-agent",
  "agt_travel-planner-agent",
  "agt_agent-dev-engineer",
  "agt_paper-reviewer-agent",
  "agt_3d-print-agent",
  "agt_writing-style-analyst-agent",
  "agt_family-doctor-2-agent",
  "agt_feishu-expert-2-agent",
  "agt_reimbursement-expert",
  "agt_mobile-app-engineer",
  "agt_miniapp-game-engineer",
  "agt_trend-tracker",
  "agt_biz-explorer",
  "agt_video-producer",
  "agt_creative-writer",
  "agt_test-engineer",
  "agt_learning-expert",
  "agt_content-ops-agent",
  "agt_finance-housekeeper-agent",
  "agt_quant-trading-agent",
  "agt_novel-writer",
  "agt_frontend-react-engineer",
  "agt_open-source-agent",
  "agt_smart-home-agent",
  "agt_product-manager",
  "agt_product-designer",
  "agt_qa-reviewer",
  "agt_investment-debater",
  "agt_backend-engineer-2",
  "agt_qa-reviewer-2",
  "agt_social-butterfly-agent",
  "agt_arch-reviewer",
  "agt_explorer",
  "agt_ppt-designer",
  "agt_training-expert-agent",
  "agt_needs-radar-agent",
  "agt_delivery-review-agent",
  "agt_course-community-agent",
  "agt_biz-product-designer",
  "agt_private-chef-agent",
  "agt_course-community-agent-2",
  "agt_book-deconstructor-agent",
  "agt_build-in-public-agent",
  "agt_job-watch-agent",
  "agt_search-expert-agent",
  "agt_transcript-editor-agent",
  "agt_home-repair-agent",
  "agt_sales-copy-agent",
  "agt_hao-yang-mao-agent",
  "agt_family-steward-agent",
  "agt_video-model-expert",
  "agt_game-designer-agent",
  "agt_game-producer-agent",
  "agt_reader-simulator-agent",
  "agt_thesis-advisor-agent",
  "agt_biz-reviewer",
  "agt_translator-agent",
  "agt_translation-qa-agent"
]
```

Explicit exclusions include existing trusted identities such as `agt_stock_agent` and
`agt_cto-agent`; they are not members of this exact fleet and MUST NOT be changed by this plan.
A 87th identity, replacement identity, normalized/renamed identity, duplicate, missing member,
or digest mismatch fails before mutation.

## 4. Global frozen boundaries

```text
PRESERVE_EXACT_AGENT_ID = REQUIRED
REPLACEMENT_IDENTITY = FORBIDDEN
LEGACY_CREDENTIAL_COPY = FORBIDDEN
LEGACY_SECRET_REUSE = FORBIDDEN
LEGACY_HOME_COPY = FORBIDDEN
OLD_USER_RUNTIME_ENABLE = FORBIDDEN
GENERAL_MIGRATION_API = FORBIDDEN
BLIND_WORKSPACE_COPY = FORBIDDEN
CONFLICTING_BINDING_OVERWRITE = FORBIDDEN
RERUN_AFTER_SUCCESS = NOOP
```

No secret, token, credential, auth/session state, runtime state, legacy profile, or legacy settings
may be copied into Trusted state. Every side effect must be exact-roster bounded, plan-digest bound,
fail-loud, no-clobber, staged, and independently auditable.

## 5. Phase 1 — BASIC_RUNTIME_AND_ACCOUNT_RESTORE

### 5.1 Scope and order per exact Agent

Phase 1 is the only first operational objective. For each exact row it freezes this ordered work:

1. apply the existing accepted Phase-A clean-bootstrap Principal/Client/Credential path;
2. preserve the exact `agent_id` and restore its Agent Definition;
3. regenerate Trusted home through the formal Trusted provisioner;
4. regenerate Trusted profile from Trusted deployment source only;
5. regenerate Trusted settings from Trusted deployment source only;
6. create the Trusted primary Workspace;
7. import only the minimal curated persona set in §5.3;
8. restore only its exact non-conflicting `OLD_ONLY` Feishu Binding under §5.4;
9. perform controlled reload, or controlled restart only where the formal reload seam reports
   reload unsupported;
10. pass spawn preflight and a real Feishu basic reply;
11. rerun the exact plan and prove `NOOP`.

No Phase 2 Grant may be required to declare Phase 1 basic operation ready.

### 5.2 Phase-A clean bootstrap reuse

All 86 rows are Class A. The future operator MUST call only the accepted Phase-A clean-bootstrap
path and preserve its frozen sequence and guards. For each exact `agent_id`:

```text
Principal.external_ref = "agentcore:v1:principal:" + agent_id
Principal.principal_type = agent
Principal.agent_id = exact agent_id
Principal.owner_user_id = ABSENT
Client.external_ref = "agentcore:v1:client:" + agent_id
```

The newly issued Client secret may exist only in the accepted Trusted handoff path and is written
only into the `authsvc` trusted credential store through the accepted validate-preserve-atomic
writer. It MUST NOT enter child env/argv/stdout/stderr, Agent home/Workspace, logs, reports,
checkpoints, shell output, or a legacy credential path.

```text
CREDENTIAL_RECONCILIATION_CHILD_NEEDED = NO
PHASE_B_REQUIRED_COUNT = 0
PARENT_CLIENT_ROUTE_BLOCKED_COUNT = 0
LEGACY_CREDENTIALS_COPIED = 0
REPLACEMENT_IDENTITIES_CREATED = 0
```

Any row no longer matching inventory Class A at execution preflight is drift and blocks that row
and fleet progression; it MUST NOT silently enter Phase-B reconciliation or create a second
identity. This proposal does not authorize execution of existing-credential State D/E/F/G paths.

### 5.3 Trusted home, profile, settings, and primary Workspace

Reuse every security Contract in accepted `AGENT_PRIMARY_WORKSPACE_CURATED_IMPORT_V2`. Trusted
home/profile/settings are regenerated, never copied. The active primary Workspace is created and
owned under Trusted Runtime; a legacy path remains source-only and can never become active primary.

This child narrows the accepted maximum curated policy to exactly five root persona files:

```text
AGENTS.md
SOUL.md
IDENTITY.md
USER.md
MEMORY.md
```

No subtree import is authorized by this child. Each file remains subject to the accepted manifest,
positive allowlist, regular-file/no-link, bounds, secret scanning, no-clobber publication, and
opaque evidence rules. Missing/unsafe required content, source drift, or non-equivalent destination
content fails loud without overwrite. No legacy home byte is eligible.

### 5.4 Exact Feishu Binding restoration

Phase 1 may restore only immutable-plan rows that are proven exact `OLD_ONLY` Feishu Binding
records for a member of §3. Each restored row MUST preserve its exact channel conversation key and
exact `agent_id` and MUST set:

```text
Binding.workspace = null
Effective workspace = resolve the Agent's Trusted primary Workspace by the accepted primary-workspace rule
```

No historical/external Workspace path may be written into a Binding. Existing equivalent target
Binding is `NOOP`; a non-equivalent occupied target is `BINDING_CONFLICT` and remains unchanged.
The two already-known conflicting bindings (`feishu:oc_92332...` and `feishu:oc_9dd74...`) stay
frozen for separate Binding authority: no auto-overwrite, delete, reassign, merge, or fallback.
They are not allowed to widen or weaken the exact Phase 1 plan.

First canary Binding is pinned exactly:

```text
agent_id = agt_build-in-public-agent
binding = feishu:oc_95bd40ab17712fe0f3a7cf7eb6f4e24a
Binding.workspace = null
```

### 5.5 First canary gate

`agt_build-in-public-agent` is the only first mutation subject. Before any remaining Agent may be
mutated it MUST report all:

```text
ACCOUNT_READY = YES
CREDENTIAL_READY = YES
DEFINITION_READY = YES
HOME_READY = YES
PROFILE_READY = YES
SETTINGS_READY = YES
WORKSPACE_READY = YES
SPAWN_PREFLIGHT = YES
BINDING_READY = YES
REAL_FEISHU_BASIC_REPLY = PASS
```

Path existence alone is not readiness. Home/profile/settings/Workspace must be inspected against
the Trusted source, content projection, ownership, mode, and accepted authority. The real reply must
traverse the restored exact Binding and basic runtime path; a mock, manual bearer, direct service
call, alternate Agent, or Phase 2 Grant-dependent reply is not evidence.

Canary failure stops before remaining-85 mutation. Canary PASS permits the remaining 85 to run in
a bounded reviewed order with the same gates and fail-loud semantics.

### 5.6 Phase 1 completion

Phase 1 completion requires:

```text
ACCOUNT_READY_COUNT = 86
CREDENTIAL_READY_COUNT = 86
BASIC_RUNTIME_READY_COUNT = 86
BINDING_READY_COUNT = 86
REAL_FEISHU_BASIC_REPLY_PASS_COUNT = 86
CONTROLLED_RELOAD_OR_RESTART = PASS
EXACT_RERUN = NOOP
```

`BASIC_RUNTIME_READY` is a roll-up only when Definition, Trusted home/profile/settings, primary
Workspace, spawn preflight, and basic runtime reply all pass for the exact row. Unknown/partial
outcome is never counted ready. Phase 1 must produce an immutable redacted mapping of exact 86
`agent_id -> newly created client_id` for Phase 2 planning; it must not contain secrets.

## 6. Phase 2 — WORKFLOW_FORUM_GRANT_RESTORE

### 6.1 Isolation from Phase 1

Current Grant state is `UNKNOWN` for all 86 because the read-only observation seam was unavailable.
This uncertainty is retained only as a Phase 2 item:

```text
GRANT_STATE = UNKNOWN
PHASE_2_BLOCKS_PHASE_1 = NO
```

Phase 2 planning starts only after Phase 1 succeeds and produces all exact 86 Client IDs. This Spec
does not infer, copy, union, or mutate Grants.

### 6.2 Canonical redacted Grant plan

After Phase 1, a read-only planner must create one canonical redacted plan bound to:

- this exact 86 roster and `EXACT_ROSTER_SHA256`;
- Phase 1's accepted immutable `agent_id -> client_id` output;
- the exact allowed audience/scope tuples below;
- an explicit row for each actual exact client and no other client;
- a canonical plan digest and independent review evidence;
- no secret, bearer, credential, raw legacy Grant, unrelated client, or wildcard.

The plan MUST fail on missing/duplicate Client ID, roster mismatch, client-to-Agent mismatch,
unknown existing Grant state, plan drift, unexpected scope, or any non-exact target. Existing Grant
state must be observed through an accepted read-only seam before a future apply authority decides
`CREATE` versus `NOOP`.

### 6.3 Separate bounded fleet Grant authority

Grant application requires a new, independent, accepted, exact-plan-bound fleet Grant authority.
It is not granted by this proposed Spec and must authorize only actual §3 rows and only:

```yaml
svc-workflow:
  - workflow.read

svc-forum:
  - forum.read
  - forum.write
```

Forbidden:

```text
BLANKET_GRANT = FORBIDDEN
WILDCARD = FORBIDDEN
LEGACY_SCOPE_COPY = FORBIDDEN
LEGACY_SCOPE_UNION = FORBIDDEN
forum.admin = FORBIDDEN
forum.moderate = FORBIDDEN
workflow.execute = FORBIDDEN
```

Any existing unexpected Grant is fail-loud and outside automatic reconciliation. The independent
Grant authority must define create/noop/conflict semantics, apply/recovery behavior, a bounded
canary/order, production approval, and negative evidence that no other Principal/Client/Audience/
Scope changed.

Phase 2 completion target:

```text
WORKFLOW_READY_COUNT = 86
FORUM_READY_COUNT = 86
```

Workflow ready requires the exact client to pass a real `workflow.read` operation and no disallowed
workflow scope. Forum ready requires real `forum.read` and `forum.write` operations and no
`forum.admin`/`forum.moderate` or other unplanned scope. Credential existence alone is not Grant
readiness.

## 7. Staging, drift, recovery, and NOOP

A future implementation-authorizing child/runbook may not weaken this stage order:

1. `PLAN_READ_ONLY`: verify exact roster/digests, authorities, current Class-A state, Definition,
   Trusted sources, curated manifests, exact Binding plan, Runtime invariants, and zero conflicts.
2. `CANARY_PHASE_1`: apply only Build in Public and pass all §5.5 gates.
3. `FLEET_PHASE_1`: apply remaining 85 in bounded order and pass §5.6.
4. `PHASE_1_RERUN`: exact reviewed rerun must be `NOOP` with zero duplicate identity, zero new
   secret, zero overwrite, and zero unrelated mutation.
5. `GRANT_PLAN_READ_ONLY`: generate the canonical redacted exact-86 Grant plan; no mutation.
6. `PHASE_2`: only after a separate accepted bounded Grant authority and explicit production
   approval; this proposed PR never enters it.

Every stage revalidates exact immutable inputs and source identities. Unknown/partial outcome stops
forward mutation and reports the last known checkpoint. Recovery is forward-only/no-clobber and
must not delete pre-existing Trusted state, restore legacy bytes, reactivate old Runtime, auto-fix a
conflicting Binding, copy a legacy credential, or create a replacement identity.

## 8. Acceptance requirements for this proposed revision

Independent `注册 审计` must verify at least:

1. frontmatter remains `status: proposed` and `implementation_authority: none`;
2. exact §3 roster count is 86, unique, digest-matches, and includes the canary;
3. both supplied inventory digests match and all 86 rows are Class A;
4. accepted Workspace authority, accepted Phase-A authority, merged implementation head/merge, and
   current hardening revision are exact main ancestors;
5. no obsolete blanket authority-insufficiency, credential Phase-B, or parent-route blocker remains normative;
6. Phase 1 includes account/credential/Definition/home/profile/settings/Workspace/spawn/Binding/
   real-Feishu reply and exact rerun NOOP;
7. persona import is narrowed to the five listed root files and retains V2 safety Contracts;
8. Binding workspace is null/primary-rule and the two known conflicts remain frozen;
9. Grant unknown is Phase-2-only and cannot block Phase 1;
10. allowed Phase 2 scopes are exact and every forbidden scope/mechanism is explicit;
11. the diff is docs-only and contains no implementation, acceptance, merge, or production apply.

Failure of any item returns `FIX_REQUIRED`; it does not authorize an apply.

## 9. Fixed review handoff

```text
OLD_HEAD = b0feb030f315cf8565974b8ce0c9064b679d3b15
NEW_HEAD = <commit created by this docs-only revision>

EXACT_86_FROZEN = YES
INVENTORY_DIGEST_PINNED = YES

WORKSPACE_AUTHORITY_PRESENT = YES
PHASE_A_AUTHORITY_PRESENT = YES

CLEAN_BOOTSTRAP_COUNT = 86
PHASE_B_REQUIRED_COUNT = 0
PARENT_CLIENT_ROUTE_BLOCKED_COUNT = 0

PHASE_1_BASIC_RESTORE_FROZEN = YES
PHASE_2_GRANT_RESTORE_FROZEN = YES
PHASE_2_BLOCKS_PHASE_1 = NO

READY_FOR_INDEPENDENT_REVIEW = YES
IMPLEMENTATION_AUTHORIZED_NOW = NO
PRODUCTION_CHANGE = NONE
```
