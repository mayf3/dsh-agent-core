---
spec_id: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - broker
  - scheduler
  - production-runtime
  - scheduler-skill
  - scripts/agentcore-cron
  - production-canary
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V2
  - SCHEDULER_TIMEOUT_OUTCOME_V2
  - AGENT_TRUSTED_FLEET_CUTOVER_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V2
    revision: 05fcf4074fe15d7f29ce1ef0f68767fbbebd54de
    relation: constrained_by
supersedes:
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
superseded_by: null
owners:
  - mayf3
  - repository-maintainers
---

# AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2

> **Proposed whole-Spec successor.** V1 remains accepted/current and byte-unchanged while V2
> is proposed. Rejected child-proposal heads `be1d7f2695af62c7fc058dd65102747655c779a6`
> and `8f05a1725d3cb3542738938bbe05288604cd3c08` are review history only and grant no
> authority. V2 independently restates the complete active V1 product authority. Its sole
> product semantic delta is the exact external Scheduler proof mapping and the minimum
> whole-document JobStore load/validation needed to select self versus admin authorization;
> authorization may consume only job existence and `job.agentId` from that loaded document.

## 1. Goal

Expose one model-visible Agent Core Scheduler tool named `scheduler`. The tool gives an
Agent a self-scoped control surface for its own Scheduler V2 definitions and occurrence
evidence, while preserving the existing Scheduler engine, JobStore mutation authority,
ownership, audit, occurrence, fence, retry, CLI, and operator-only reconcile semantics.

The tool supports exactly these actions:

```text
create | list | runs | update | enable | disable | remove
```

For a Feishu ingress turn, `delivery_target=current_conversation` is resolved only by the
Parent Runtime from trusted ingress context to the exact persisted destination. The model
never supplies, guesses, or derives the chat identifier.

V2 carries forward the complete accepted V1 product authority, including the original
candidate `4595ed3` provenance, and replaces V1 only through the future atomic transaction in
`CTR-GOV-001`. While proposed, V2 authorizes no implementation. Its exact four-file semantic
delta may be published only after accepted V2 is present in `main`.

## 2. Scope and non-goals

### In scope

- one Broker LOCAL capability manifest with model-visible `toolName: scheduler`;
- action-discriminated, closed-schema request validation;
- trusted Parent Runtime injection of `callerAgentId` and current Feishu conversation;
- `scheduler.read:self`, `scheduler.manage:self`, and `scheduler.manage:any` enforcement;
- reuse of the existing self-service access layer and Scheduler control operations;
- `create`, `list`, `runs`, `update`, `enable`, `disable`, and `remove`;
- exact create/update result evidence;
- Scheduler-only skill guidance and fail-loud retirement of OpenClaw cron paths;
- post-deployment JobStore/tick hot reload without restarting the active canary Runtime generation;
- one production 15-minute one-shot canary after implementation deployment.

### Non-goals

- changing Scheduler due-time, occurrence, fence, timeout, retry, catch-up, session, or
  delivery execution semantics;
- introducing another Scheduler Runtime, another Feishu WebSocket, or another store;
- exposing `reconcile` to a model or ordinary Agent;
- importing historical OpenClaw jobs;
- allowing a model to provide a caller identity or current chat identifier;
- replacing the operator CLI or granting an Agent shell/store access;
- manually editing any Scheduler store;
- restarting OpenClaw Gateway or using it as an activation mechanism.

## 3. Authority and dependencies

- Accepted V1 blob `b3cebc5d3bd64013d8b605311e2cc12cf52cab7f` is the complete
  product-authority baseline copied into this whole successor. V2 was proposed from exact
  dsh-agent-core base `9e15808f336e7964f5059e871c32f25e6045e622`; future review and
  acceptance MUST bind the final V2 head, not this proposal base or either rejected child head.
- `AGENT_CORE_PRODUCT_ARCHITECTURE_V1` owns the process-external trusted caller
  relationship, Broker/tool boundary, and rule that Agent Core does not recreate the DSH
  tool runtime.
- D-007 `SCHEDULER_OCCURRENCE_OUTCOME_V2` is the current Scheduler authority. Its single
  mutation authority, occurrence evidence, delete semantics, and control operations are
  preserved.
- `SCHEDULER_TIMEOUT_OUTCOME_V2` governs the implemented Scheduler V2 state machine and
  migration/no-catch-up behavior.
- `AGENT_TRUSTED_FLEET_CUTOVER_V1` freezes one active `authsvc` production Runtime and
  forbids a second Runtime writer.
- External `MINIMAL_AUTH_FOUNDATION_V2` at exact auth-service head
  `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de` constrains audience-scoped Machine Grants and
  enforces exact scope grammar `^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$`. Therefore V2 preserves
  local predicates `scheduler.read:self`, `scheduler.manage:self`, and
  `scheduler.manage:any`, while the only external proof tuple is exact resource `scheduler`
  plus exact wire scope `scheduler.manage-any`. The two `*:self` labels remain local-only and
  cause zero Auth requests. Exact external success establishes only local
  `scheduler.manage:any`; no alias, translation, fallback, or `scheduler.admin` is permitted.
  Until a separately accepted auth-service CCR registers the audience/scope, its source is
  implemented/deployed, and a separately authorized Grant is supplied/applied, production
  `manage:any` availability is **NONE**. This Spec creates no Auth scope, audience, Grant,
  credential, token, registry/database mutation, deployment, or production Auth mutation.
- V2 is a whole-Spec successor to accepted V1, not a child amendment. While proposed, V1 is
  the sole current authority and remains byte-unchanged. After explicit Owner `mayf3`
  authority, an authorized actor may prepare one lifecycle-only docs commit that atomically
  sets V2 to `accepted` with `implementation_authority: contracts` and acceptance provenance,
  sets V1 to `superseded` with `superseded_by: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`,
  and preserves `production_apply_authority: none`. Before merge, an independent reviewer
  MUST review that newly prepared exact commit head and return `FINAL_HEAD_RECHECK=PASS`,
  proving the exact lifecycle delta, normative-byte invariants, `SEMANTIC_DELTA=NONE`, and no
  base/main authority drift. Only then may the commit merge. No partial/mixed lifecycle or
  pre-recheck merge is valid.
- Authority is acyclic: accepted V1 -> accepted V2 final head -> future auth-service Scheduler
  Audience CCR -> separately authorized auth source/deploy -> separately authorized Grant ->
  separately authorized local activation/canary. The future auth CCR may depend on accepted
  V2; V2 is constrained by current external grammar but does not depend on that future CCR.

## 4. Current State

### STATE-001 — Baseline main lacked the unified model-visible tool
- Subject: dsh-agent-core Scheduler/Broker/Runtime/CLI baseline.
- As of commit or artifact revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`.
- Environment: fresh fetched `origin/main` source snapshot.
- Observed at: 2026-08-27.
- State assertion: Scheduler V2, JobStore operations, Broker relay, production Runtime, and CLI existed, but no model-visible unified `scheduler` tool existed.
- Basis: `OBS-001`, `OBS-002`.

### STATE-002 — Candidate baseline exposed six tool manifests
- Subject: candidate `4595ed3b2063206922f1a3cdda048abe4fa871ab`.
- As of commit or artifact revision: `4595ed3b2063206922f1a3cdda048abe4fa871ab`.
- Environment: local candidate worktree.
- Observed at: 2026-08-27.
- State assertion: six operation-specific Scheduler manifests and a co-located proposed Spec existed; unified action dispatch and update were absent.
- Basis: `OBS-003`, `OBS-004`.

### STATE-003 — Pinned skill requires unified Scheduler access
- Subject: user `cron-helper` skill v4.0.0.
- As of commit or artifact revision: SHA-256 `caec00409d0804985cfa06b9047db1ab8b3382f937de6dce32633f0dce12ec8b`, 6613 bytes.
- Environment: `/Users/yanfenma/.agents/skills/cron-helper/SKILL.md`.
- Observed at: 2026-08-27.
- State assertion: the skill requires only unified `scheduler(action=...)` and fails loud when unavailable.
- Basis: `OBS-005`.

### STATE-004 — Router baseline had exact ingress identity but incomplete propagation
- Subject: Router ingress and Parent RPC context path.
- As of commit or artifact revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`.
- Environment: repository source snapshot.
- Observed at: 2026-08-27.
- State assertion: exact Feishu `chatId` and parent turn-scoped context existed, but only binding ID was propagated.
- Basis: `OBS-006`.

### STATE-005 — Current proof seam uses a grammar-incompatible wire literal
- Subject: Scheduler cross-agent `assertGrant` request versus auth-service scope grammar.
- As of commit or artifact revision: dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`; auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`.
- Environment: isolated read-only source worktrees; no runtime/production mutation.
- Observed at: `2026-09-02T21:23:05Z`.
- State assertion: local `scheduler.manage:any` is sent as wire scope but fails the external grammar; `scheduler.manage-any` satisfies it.
- Basis: `OBS-007`, `OBS-008`, `CLM-004`.

## 5. Observations

### OBS-001 — Main contains Scheduler V2 mutation and evidence authority

- Subject: `packages/scheduler` on `mayf3/dsh-agent-core`
- Source revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`
- Environment: fresh fetched `origin/main`
- Observed at: 2026-08-27
- Method: source inspection of JobStore, control operations, Scheduler and D-007
- Result: create/update/enable/disable/delete use the existing locked mutation authority;
  occurrences and fences share the V2 authority document; deletion retains occurrence
  evidence.
- Provenance: repository source and `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md`

### OBS-002 — Production Runtime already owns the resident Scheduler

- Subject: `packages/production-runtime/src/compose.js`
- Source revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`
- Environment: repository source
- Observed at: 2026-08-27
- Method: source inspection
- Result: production composition constructs one JobStore and one resident Scheduler over
  the production layout; the Scheduler reloads externally committed mutations on tick.
- Provenance: repository source and production-runtime reports

### OBS-003 — Source candidate exposes six tools

- Subject: `packages/broker/src/capabilities/scheduler.js`
- Source revision: `4595ed3b2063206922f1a3cdda048abe4fa871ab`
- Environment: local candidate worktree
- Observed at: 2026-08-27
- Method: full source read
- Result: six manifests expose six tool names; no unified action discriminator or update
  tool exists.
- Provenance: candidate source

### OBS-004 — Source candidate already has reusable self-service access logic

- Subject: `packages/scheduler/src/self-service.js` and CLI changes
- Source revision: `4595ed3b2063206922f1a3cdda048abe4fa871ab`
- Environment: local candidate worktree
- Observed at: 2026-08-27
- Method: full source read
- Result: candidate reuses existing control operations, applies self/manage-any ownership,
  appends audit evidence, preserves occurrence evidence on delete, and adds CLI update;
  current-conversation resolution and unified model manifest are absent.
- Provenance: candidate source

### OBS-005 — Pinned Scheduler-only skill bytes

- Subject: user skill `cron-helper` v4.0.0
- Source revision: SHA-256
  `caec00409d0804985cfa06b9047db1ab8b3382f937de6dce32633f0dce12ec8b`, 6613 bytes
- Environment: `/Users/yanfenma/.agents/skills/cron-helper/SKILL.md`
- Observed at: 2026-08-27
- Method: load complete content, then `shasum -a 256` and `stat`
- Result: the pinned bytes permit only `scheduler(action=...)`, forbid OpenClaw cron,
  Gateway restart, and manual jobs JSON access, and require exact create evidence.
- Provenance: local immutable content digest recorded above; review must re-hash before use

### OBS-006 — Router has turn-scoped parent state and exact ingress fields

- Subject: Router ingress and parent-RPC path
- Source revision: `e40c1400266b57ae7746ac766e6b281cf1fbb943`
- Environment: repository source
- Observed at: 2026-08-27
- Method: inspect `ingress-delivery.js`, `turn-execution.js`, `parent-rpc-relay.js`, and
  Feishu connector bridge
- Result: Feishu ingress carries exact `chatId`, `conversationId`, and message identity;
  `AgentProcess.activeBindingContext` is set only while one routed turn executes and cleared
  in `finally`; parent RPC already binds the actual Agent process. Current code passes only a
  binding ID, so exact trusted delivery context is an additive implementation requirement.
- Provenance: repository source at the pinned revision

### OBS-007 — Current Scheduler reuses the local predicate as wire scope

- Subject: `packages/scheduler/src/self-service.js` cross-agent proof path
- Source revision: blob `4a236fed3b201ac8c4de59d86cbbc414beee4ba7` at dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`
- Environment: isolated dsh-agent-core source worktree
- Observed at: `2026-09-02T21:23:05Z`
- Method: inspect `MANAGE_ANY_SCOPE`, `SCHEDULER_RESOURCE`, `adminAuthorized`, and `loadScopedJob`
- Result: `assertGrant` receives `(callerAgentId, 'scheduler.manage:any', 'scheduler')`; existing job operations call JobStore whole-document load/validation over `{jobs, occurrences, fences}`, then use job existence and `job.agentId` to decide whether admin proof is required
- Provenance: exact source blob and commit named above

### OBS-008 — Auth-service grammar rejects colon and admits hyphen

- Subject: auth-service V1 OAuth scope parser and minimal-auth V1 manifest incorporated by V2 authority
- Source revision: auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`; source blob `f97ddf417f367a9e87d1a271d566b1807c12a84d`; manifest blob `983719d905f9609f6662b71ffb303a817ea292db`
- Environment: isolated auth-service read-only source worktree
- Observed at: `2026-09-02T21:23:05Z`
- Method: inspect parser line 3 and manifest `scope_wire_format.item_pattern`; evaluate both exact literals against `^[a-z][a-z0-9-]*\.[a-z][a-z0-9._-]*$`
- Result: `scheduler.manage:any` does not match; `scheduler.manage-any` matches with namespace/resource `scheduler`
- Provenance: `src/lib/oauth/v1/scope.ts` and `contract-bundles/minimal-auth-v1/contract-manifest.json` at the stated revision/blobs

### OBS-009 — Production composition forwards the requested scope

- Subject: production-runtime self-service Scheduler authorization composition
- Source revision: `packages/production-runtime/src/compose.js` blob `c407b064fe846446888109bcc219514a7d15b094` at dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`
- Environment: isolated dsh-agent-core source worktree; no runtime execution
- Observed at: `2026-09-02T21:23:05Z`
- Method: inspect the composed `assertGrant` transport from Scheduler access to auth request
- Result: composition forwards the requested scope and does not hard-code a Scheduler scope
- Provenance: exact composition source blob and commit named above

## 6. Claims and assumptions

### CLM-001 — Candidate code is reusable but not publishable as-is

- Support state: SUPPORTED
- Supported by evidence: `EVD-001`
- Contradicted by evidence: none known
- Uncertainty: implementation must be re-reviewed after rebasing onto accepted `main`

### CLM-002 — Trusted ingress injection is required for current-conversation safety

- Support state: SUPPORTED
- Supported by evidence: `EVD-002`
- Contradicted by evidence: none known
- Uncertainty: exact internal context object shape is an implementation detail, but its
  trust origin and rejection behavior are normative

### CLM-003 — Job definitions hot-reload after implementation activation

- Support state: SUPPORTED
- Supported by evidence: `EVD-003`
- Contradicted by evidence: none known
- Uncertainty: this Claim is only about JobStore mutation reload after a conforming Runtime
  generation is active; it does not claim that Node code or tool registration hot-loads

### CLM-004 — A distinct exact wire scope resolves the grammar mismatch

- Support state: SUPPORTED
- Supported by evidence: `EVD-004`
- Contradicted by evidence: none known
- Uncertainty: source evidence is bound to pinned revisions; registration, Grant, deployment, and runtime authorization remain separately unproved

### CLM-005 — Whole-document validation is compatible with narrow authorization consumption

- Support state: SUPPORTED
- Supported by evidence: `EVD-005`
- Contradicted by evidence: none known
- Uncertainty: future tests must prove whole-document validation does not let authorization consume or disclose occurrence/history and that denial causes no mutation or success audit

### CLM-006 — Production composition source needs no proof-scope change

- Support state: SUPPORTED
- Supported by evidence: `EVD-006`
- Contradicted by evidence: none known
- Uncertainty: source inspection covers the pinned base; contradictory implementation evidence requires governance STOP

## 7. Evidence relations

### EVD-001 — Candidate inspection supports bounded reuse

- Source observations: `OBS-003`, `OBS-004`
- Target: `CLM-001`
- Relation: SUPPORTS
- Bound coordinates: candidate `4595ed3`, base `e40c140`
- Strength/sufficiency: strong for code shape and governance split
- Limitations: does not establish accepted authority or production conformance
- Provenance: repository diff and source reads

### EVD-002 — Pinned skill and Router observations support trusted injection

- Source observations: `OBS-005`, `OBS-006`
- Target: `CLM-002`
- Relation: SUPPORTS
- Bound coordinates: repository `e40c140`; skill SHA-256 `caec0040...ec8b`
- Strength/sufficiency: strong for the negative trust boundary and available source fields
- Limitations: implementation and concurrency tests must prove the additive context shape
- Provenance: pinned repository source and pinned skill bytes

### EVD-003 — Existing store reload supports post-create no-restart execution

- Source observations: `OBS-001`, `OBS-002`
- Target: `CLM-003`
- Relation: SUPPORTS
- Bound coordinates: repository `e40c140`
- Strength/sufficiency: strong for JobStore mtime/tick reload; production remains to prove
- Limitations: does not support code/tool hot loading; implementation deployment requires a
  controlled replacement of the production Runtime generation
- Provenance: Scheduler and production composition source

### EVD-004 — Local proof source and external grammar support exact scope separation

- Source observations: `OBS-007`, `OBS-008`
- Target: `CLM-004`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core `9e15808f336e7964f5059e871c32f25e6045e622`, auth-service `05fcf4074fe15d7f29ce1ef0f68767fbbebd54de`, observed `2026-09-02T21:23:05Z`
- Strength/sufficiency: strong and sufficient for the exact source/grammar mapping at the pinned revisions
- Limitations: does not establish audience registration, Grant, deployment, or production success
- Provenance: exact repository objects in `OBS-007` and `OBS-008`

### EVD-005 — Existing access sequencing supports bounded authorization consumption

- Source observations: `OBS-007`
- Target: `CLM-005`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core source blob `4a236fed3b201ac8c4de59d86cbbc414beee4ba7`, observed `2026-09-02T21:23:05Z`
- Strength/sufficiency: strong for showing existing JobStore whole-document load/validation precedes consumption of job existence and `job.agentId` to select the self/admin branch
- Limitations: source inspection does not prove future prohibition on occurrence/history projection/query/filter/return or future non-disclosure/no-success-audit behavior
- Provenance: exact source inspection in `OBS-007`

### EVD-006 — Existing scope forwarding supports test-only composition coverage

- Source observations: `OBS-009`
- Target: `CLM-006`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core composition blob `c407b064fe846446888109bcc219514a7d15b094`, observed `2026-09-02T21:23:05Z`
- Strength/sufficiency: strong and sufficient for the pinned composition source shape
- Limitations: does not replace future execution of the composed regression test
- Provenance: exact source inspection in `OBS-009`

## 8. Decisions

### DEC-001 — One model-visible tool

- Decision owner: repository maintainers
- Decision: expose exactly one tool named `scheduler`; select behavior through a required
  `action` enum. Existing internal handlers may remain separate.
- Rejected alternative: expose six or seven operation-specific tool manifests.
- Reason: one stable model surface matches the skill contract and avoids catalog sprawl.

### DEC-002 — Closed schema by action

- Decision owner: repository maintainers
- Decision: the model-facing parameter map advertises only `action` plus documented union
  properties. Because current `defineTool` compiles an implicit-open root, the trusted Broker
  mapping layer authoritatively validates the exact per-action discriminated union with
  `additionalProperties:false` semantics before grant/store access.
- Rejected alternative: one permissive trusted-handler bag of optional fields.
- Reason: action-confused fields, caller identity, and destination spoofing must fail loud.

### DEC-003 — Parent Runtime owns identity and current conversation

- Decision owner: repository maintainers
- Decision: caller Agent and current Feishu conversation are trusted context, not tool
  arguments. `delivery_target=current_conversation` is a symbolic request resolved by the
  Parent Runtime to `{channel:'feishu', to:'chat:<exact chat id>'}`.
- Rejected alternative: model-provided `agentId`, `channel`, `to`, or chat ID.
- Reason: the model is not an identity or ingress authority.

### DEC-004 — Self by default, explicit admin any

- Decision owner: repository maintainers
- Decision: ordinary Agents read/manage only jobs whose `job.agentId` equals trusted
  `callerAgentId`; only an Auth-authorized `scheduler.manage:any` caller may target another
  Agent or another destination.
- Rejected alternative: infer admin from tool arguments or broad local process access.
- Reason: retain least privilege at the Broker boundary.

### DEC-005 — Preserve Scheduler core and operator seams

- Decision owner: repository maintainers
- Decision: all writes reuse the existing JobStore control operations and audit seam;
  reconcile remains operator-only; CLI remains supported.
- Rejected alternative: a second store writer, second Scheduler Runtime, or model reconcile.
- Reason: preserve D-007's single authority and lifecycle semantics.

### DEC-006 — OpenClaw scheduler paths are retired

- Decision owner: repository maintainers
- Decision: model/skill Scheduler operations fail loud unless the unified tool is available.
  OpenClaw cron, OpenClaw cron templates, manual jobs JSON editing, and Gateway restart as
  activation are forbidden.
- Rejected alternative: compatibility fallback to legacy OpenClaw paths.
- Reason: fallback writes the wrong store and can create inert jobs.

### DEC-007 — Governance and production sequence is two-stage

- Decision owner: repository maintainers
- Decision: first merge this docs-only Spec after independent review and maintainer
  acceptance; then publish a separate implementation PR based on accepted `main`; deploy
  only conforming implementation; finally execute the production canary.
- Rejected alternative: use the proposed Spec co-located with candidate code as authority.
- Reason: proposed same-candidate text cannot authorize its own implementation.

### DEC-008 — Separate local authorization name from exact external proof scope

- Decision owner: repository owner `mayf3` / repository maintainers
- Decision: preserve local `scheduler.manage:any`; prove it only with resource `scheduler` and wire scope `scheduler.manage-any`. Preserve both `*:self` labels as local-only.
- Rejected alternative: rename local policy, request colon form, translate aliases, retry/fallback, or introduce `scheduler.admin`.
- Reason: preserve V1 semantics while satisfying the exact external scope grammar without widening authority.

### DEC-009 — Permit whole-document validation but consume only existence and owner

- Decision owner: repository owner `mayf3` / repository maintainers
- Decision: authorization may call the existing JobStore whole-document load/validation over `{jobs, occurrences, fences}`, but may consume only whether the requested job exists and that job's `job.agentId`. If those fields show that admin proof is required, then before exact proof succeeds the authorization path may not project, query, filter, return, disclose, or use occurrence/history as authorization input. Denial performs no mutation or success audit and returns no persisted content. Authorized self history behavior remains unchanged and makes zero Auth requests.
- Rejected alternative: forbid the existing whole-document validation, consume occurrence/history during authorization, or expose the inspected foreign definition.
- Reason: the current JobStore validates one whole document and ownership is persisted in its job definition; permitting that mechanism does not grant occurrence/history visibility or decision authority.

### DEC-010 — Whole-successor acceptance is atomic

- Decision owner: repository owner `mayf3`
- Decision: keep V1 current and untouched while V2 is proposed. After explicit Owner authority, an authorized actor prepares one atomic lifecycle-only docs commit; an independent reviewer must return `FINAL_HEAD_RECHECK=PASS` on that new exact head before merge.
- Rejected alternative: child amendment, early V1 mutation, partial supersession, review only of the proposed pre-lifecycle head, or merge before final-head recheck.
- Reason: one complete current authority plus post-preparation exact-head verification prevents split authority and acceptance-byte drift.

## 9. Contracts

### CTR-TOOL-001 — Exact model-visible surface

The Broker MUST register exactly one model-visible Scheduler self-service tool named
`scheduler`. It MUST NOT register model-visible tools named `scheduler_create`,
`scheduler_list`, `scheduler_runs`, `scheduler_update`, `scheduler_enable`,
`scheduler_disable`, or `scheduler_remove`. Internal handler names MAY remain unchanged.
`reconcile` MUST NOT be reachable through `scheduler`.

### CTR-TOOL-002 — Action discriminator and exact closed schemas

The manifest MUST declare its model selector name as `action`; the generic Broker MUST keep
`operation` as the default selector for every existing manifest. Registry dispatch MUST
remove `action` from business arguments and map it internally to the selected handler. The
model-facing DSH parameter map MUST expose only the selector plus the union of documented
properties as guidance. Because the current `defineTool` API compiles an implicit open root,
the trusted Broker mapping layer is the authoritative enforcement point: before grant/store
access it MUST enforce the exact object-rooted discriminated union below. Every selected
action object and nested object is closed; unknown properties are violations.

Common leaf definitions are exact:

```text
NonEmptyString = {type:string, minLength:1}
action          = enum(create,list,runs,update,enable,disable,remove)
job_id/name/message/model/target_agent_id = NonEmptyString
schedule_kind   = enum(cron,at,every)
cron_expr       = NonEmptyString (standard five-field expression; six-field rejected)
at               = NonEmptyString parsed by existing parseAtToMs
                       (relative positive duration or ISO instant)
every_ms         = integer minimum 1
timezone          = NonEmptyString accepted by existing Scheduler timezone validation
timeout           = integer minimum 1
light_context/best_effort/delete_after_run/auto_retry/all_agents = boolean
limit             = integer minimum 1 maximum 100
delivery_mode     = enum(announce,none,silent)
delivery_target   = const current_conversation
destination       = object, additionalProperties:false,
                    required:[channel,to], properties:{channel:NonEmptyString,to:NonEmptyString}
```

The seven top-level branches are exact:

```text
create:
  action=const create
  required=[action,name,schedule_kind,message]
  allowed=[action,name,schedule_kind,cron_expr,at,every_ms,timezone,message,
           timeout,light_context,model,delivery_mode,delivery_target,destination,
           best_effort,delete_after_run,auto_retry,target_agent_id]

list:
  action=const list
  required=[action]
  allowed=[action,all_agents]

runs:
  action=const runs
  required=[action]
  allowed=[action,job_id,limit,all_agents]

update:
  action=const update
  required=[action,job_id]
  allowed=[action,job_id,name,schedule_kind,cron_expr,at,every_ms,timezone,message,
           timeout,light_context,model,delivery_mode,delivery_target,destination,
           best_effort,delete_after_run,auto_retry,target_agent_id]
  additional rule: at least one mutable property besides action/job_id is required

enable: action=const enable; required=[action,job_id]; allowed=[action,job_id]
disable: action=const disable; required=[action,job_id]; allowed=[action,job_id]
remove: action=const remove; required=[action,job_id]; allowed=[action,job_id]
```

Conditional closure is exact:

1. `schedule_kind=cron` requires exactly `cron_expr` + `timezone` and forbids `at/every_ms`.
2. `schedule_kind=at` requires exactly `at`, forbids `cron_expr/every_ms/timezone`, and the
   normalized instant MUST be later than the control operation's logical mutation timestamp
   (`nowMs`, persisted as `createdAtMs`/`updatedAtMs` by existing control semantics).
3. `schedule_kind=every` requires exactly `every_ms` and forbids
   `cron_expr/at/timezone`.
4. Create always has `schedule_kind`. Update accepts no schedule leaf unless
   `schedule_kind` is present; when present, rules 1–3 require a complete replacement
   schedule. Update never merges an incomplete schedule.
5. Create defaults `delivery_mode=none`, `auto_retry=false`, and
   `delete_after_run=(schedule_kind==at)`. Update preserves every omitted field.
6. `delivery_mode=announce` requires exactly one of `delivery_target` or `destination`;
   `destination` is admin-only. `delivery_mode=none|silent` forbids
   `delivery_target/destination/best_effort`. Update accepts no delivery leaf unless
   `delivery_mode` is present; when present it replaces the complete delivery object.
7. `target_agent_id`, `destination`, and `all_agents=true` invoke the manage-any path;
   their presence never asserts authorization.
8. Empty/whitespace-only strings fail `invalid_arguments` after trimming; normalization
   stores trimmed strings. Unknown, cross-action, nested-unknown, identity, chat, session,
   or reconcile fields fail before store read, grant lookup, or mutation.

Forbidden properties include `callerAgentId`, `caller_agent_id`, `agentId`, `agent_id`,
`channel`, `to`, `chatId`, `chat_id`, `ingress`, `session`, `operation`, and `reconcile`.

### CTR-CTX-001 — Trusted caller and invocation context

The Parent Runtime MUST inject a non-empty context derived only from the actual process slot
and active routed turn:

```text
callerAgentId
processGeneration
turnExecutionId
channelNamespace
channelConversationId
feishuChatId
feishuConversationId
feishuMessageId
```

`callerAgentId` and `processGeneration` come from the actual Router-owned process slot.
`turnExecutionId` comes from that slot's active turn execution. The Feishu fields come from
the ingress object passed to that same turn. No child/model parameter can set or override any
context field. Missing trusted caller/process/turn identity MUST fail before store access.
Self authorization compares `job.agentId` only with trusted `callerAgentId`.

The Router MUST install one immutable `activeIngressContext` together with
`activeBindingContext` immediately before prompt write and clear both in the same `finally`.
The process single-flight queue MUST install the queued turn's own context only after the
prior turn clears. Parent Broker RPC reads context directly from that process object; the
child relay transmits no ingress context. Gateway forwards it only to LOCAL handlers.

### CTR-CTX-002 — Trusted current Feishu conversation

When `delivery_target=current_conversation`, the handler MUST require the active trusted
context to belong to the exact tool-calling `(callerAgentId, processGeneration,
turnExecutionId)` and to have `channelNamespace=feishu` plus a valid exact `feishuChatId`.
It MUST resolve only that field to:

```json
{"channel":"feishu","to":"chat:<exact feishuChatId>"}
```

It MUST NOT parse a chat ID from `channelConversationId` or `feishuConversationId` because a
thread conversation ID may contain topic identity. The committed definition MUST persist the
resolved object. Context is valid only for the active turn; after turn completion, process
generation replacement, queued-turn handoff, or cross-Agent call it MUST fail loud. Context
MUST never be cached as “last conversation,” replayed, or accepted from child RPC params.

### CTR-CTX-003 — Other destinations are admin-only

An ordinary Agent MUST use `current_conversation` for announced delivery and MUST NOT specify
`destination` or target another Agent. Explicit other destinations or another
`target_agent_id` require successful `scheduler.manage:any` authorization for the trusted
caller. Denial or Auth uncertainty MUST fail closed.

### CTR-AUTH-001 — Self read and manage scopes

A credentialed ordinary Agent has local entitlements labelled `scheduler.read:self` and
`scheduler.manage:self` only for jobs whose persisted `agentId` equals trusted
`callerAgentId`. These labels are Agent Core authorization outcomes, not Auth token scopes:
ordinary self operations MUST perform zero token requests. `list` and `runs` MUST hide foreign
definitions/evidence. Mutations of a foreign job MUST return a non-leaking denied or
not-found error and MUST NOT mutate or append a success audit record.

To select self versus admin authorization for an operation on an existing job, the access
layer MAY call the existing JobStore whole-document load and validation, whose returned
document contains `{jobs, occurrences, fences}`. The authorization decision MAY consume from
that document only (a) whether the requested job exists and (b) that job's `job.agentId`.
If those permitted fields show the requested job is foreign and admin proof is required,
then before exact proof succeeds the authorization path MUST NOT project, query, filter,
return, or disclose occurrence/history, and MUST NOT use occurrence/history as authorization
input. Authorized self `runs` behavior remains unchanged and makes zero Auth requests.
Whole-document parsing/validation is permitted but grants no visibility. Denial MUST return
no persisted job/definition/occurrence/history/message/owner content or other public result
and MUST perform no mutation or success audit.

### CTR-AUTH-002 — Admin scope and external prerequisite

Only a caller for whom the trusted Auth seam verifies exact external tuple
`(resource='scheduler', scope='scheduler.manage-any')` MAY establish the existing local
predicate `scheduler.manage:any` and use `all_agents`, create/update for another Agent,
mutate another Agent's job, or specify another delivery destination. Tool arguments MUST NOT
assert either value. The proof path MUST NOT request or accept `scheduler.manage:any` as a
wire scope, translate/normalize an alias, try multiple spellings, fall back after failure, or
introduce `scheduler.admin`. Auth denial, unavailable audience, missing Grant, token failure,
malformed response, or uncertainty MUST deny the operation without disclosure, mutation, or
success audit. The whole-document load/validation permitted by `CTR-AUTH-001` remains allowed,
but the decision may consume only job existence and `job.agentId`; on the admin-required
branch occurrence/history remain forbidden as authorization input or pre-proof output.

This local implementation MUST support the fail-closed seam and tests with an injected Auth
stub, but MUST NOT claim production admin availability. Production admin enablement is
blocked until a separate accepted auth-service CCR registers the Scheduler audience and
scope, its source is implemented/deployed, and a separately authorized Grant supply is
applied. Ordinary self operations make zero Auth requests, including zero requests for
`scheduler.read:self`, `scheduler.manage:self`, or `scheduler.manage-any`.

### CTR-AUTH-003 — Exact V2 delta implementation closure

After future atomic acceptance, the V2 wire-proof/denial delta MUST change product or test
files only in this closed list:

1. `packages/scheduler/src/self-service.js`;
2. `packages/scheduler/test/self-service.test.js`;
3. `packages/scheduler/test/cross-agent.test.js`;
4. `packages/production-runtime/test/compose-cross-agent-history.test.js`.

The production-runtime entry is test-only. `packages/production-runtime/src/compose.js` and
all other product files MUST remain unchanged. Local messages and policy assertions MAY keep
the colon-form label; only `assertGrant` and its resulting token request use the hyphen form.
If implementation requires a fifth file or production composition source change, work MUST
stop for new/amended accepted authority rather than expand this closure.

### CTR-MUT-001 — Existing control operations only

The access layer MUST reuse existing Scheduler operations:

```text
create -> scheduler_create / createJobOp
list   -> scheduler_list
runs   -> scheduler_runs
update -> updateJobOp
enable -> scheduler_enable / enableJobOp
disable-> scheduler_disable / disableJobOp
remove -> scheduler_remove / deleteJobOp
```

All definition mutations MUST use the production Runtime's existing JobStore and its locked
mutation protocol. No direct whole-file writer may be added. The Scheduler engine,
occurrence state machine, fences, retry, catch-up, fresh-session behavior, and delivery seam
MUST remain unchanged.

### CTR-MUT-002 — Update semantics

`update` MUST preserve `jobId`; normalized schedule/payload/target/retry changes MUST follow
existing `updateJobOp` revision semantics and affect future eligible slots only. A past
one-shot MUST be rejected. Update MUST apply the same ownership and destination rules as
create. No update may clear a fence, replay an occurrence, or invoke reconcile.

### CTR-AUDIT-001 — Mutation audit and append failure

Every handler execution that remains alive after a committed
create/update/enable/disable/remove and reaches the audit step MUST attempt exactly one append
of the existing sanitized self-service mutation evidence with operation, job ID, trusted
operator Agent ID, target Agent ID, timestamp, and before/after definition digests as
applicable. It MUST NOT record message bodies, credentials, secrets, or a model-supplied
identity.

Definition/occurrence authority and `runs.jsonl` are not one transaction (D-007 §11.5). When
the handler remains alive and `appendRunEvent` returns/throws failure after a known definition
commit, the failure MUST NOT roll back or deny the known commit and MUST NOT be reported as an
ordinary clean failure. The handler MUST return the committed projection plus
`auditStatus=append_failed`; production Runtime MUST emit a sanitized operator-visible error
containing operation/job ID but no message/secret. The Agent MUST report the mutation as
committed with incomplete audit and MUST NOT retry it. An audit failure before any definition
commit leaves store state unchanged.

A process death after definition commit but before the audit step provides no guarantee that
an append was attempted. That case is governed by `CTR-FAIL-001`: caller outcome unknown,
possible durable audit gap, operator reconciliation required, and no automatic retry. The
Spec does not fabricate an audit event or claim exactly-one append across process death.

### CTR-FAIL-001 — Mutation retry and unknown outcome

Self-service mutations are not generally idempotent and the relay/gateway MUST perform zero
automatic retries. `MUTATION_AUTORETRY = FORBIDDEN`.

- validation/Auth failures occur before mutation and are safe non-commits;
- a known control-op result is returned exactly once, subject to `CTR-AUDIT-001`;
- if transport/process failure prevents the caller from knowing whether the control op
  committed, the result MUST be `mutation_outcome_unknown`; it MUST NOT claim success or
  failure and MUST NOT automatically issue the mutation again;
- after unknown create/update/enable/disable, the next action is `list` (and `runs` when
  applicable) to observe current state before any user-authorized retry;
- after unknown remove, ordinary self scope may no longer authorize the deleted ID, so the
  Agent MUST stop and escalate to operator evidence rather than retry;
- repeated user-directed create is a new mutation and may create another Job; the Agent MUST
  present observed matches and obtain confirmation before retrying an unknown create.

Fault behavior is frozen as: pre-commit failure = no mutation; handler alive +
post-commit audit append returns failure = known commit with `auditStatus=append_failed` and
one attempted append; process death after commit before audit = caller unknown, zero
guaranteed append, durable audit-gap/operator-reconciliation evidence required; post-audit/
pre-response transport loss = unknown to caller but no automatic retry. Explicit later retry
requires the observation rules above. This Spec introduces no durable idempotency table and
no Scheduler schema change.

### CTR-RESULT-001 — Exact create/update evidence

Successful `create` and `update` MUST return all of:

```text
jobId
name
enabled
normalizedSchedule
timezone
nextRunAt
targetAgentId
exactPersistedDeliveryDestination
autoRetry
deleteAfterRun
```

The result additionally carries mandatory `auditStatus`; the ten fields above remain the
user-required committed evidence and may never be omitted.

Their exact JSON wire schema is:

```text
jobId: NonEmptyString                 # committed job.id
name: NonEmptyString                  # committed job.name
enabled: boolean                      # committed job.enabled
normalizedSchedule:
  oneOf:
    {kind:const cron, expr:NonEmptyString, timezone:NonEmptyString}
    {kind:const at, at:NonEmptyString}        # canonical UTC ISO string
    {kind:const every, everyMs:integer>=1}
  each branch additionalProperties:false
timezone: NonEmptyString | null       # cron persisted tz; null for at/every
nextRunAt: NonEmptyString | null      # canonical UTC ISO from persisted nextRunAtMs;
                                      # null only when committed definition has no eligible next run
targetAgentId: NonEmptyString         # committed job.agentId
exactPersistedDeliveryDestination:
  {channel:NonEmptyString,to:NonEmptyString,additionalProperties:false} | null
                                      # committed announce channel/to; null for none/silent
autoRetry: boolean                    # committed job.retry?.auto === true
deleteAfterRun: boolean               # committed job.deleteAfterRun
auditStatus: enum(appended,append_failed)
                                      # append_failed only under CTR-AUDIT-001 known-commit path
```

The top-level result object has exactly these eleven required properties and
`additionalProperties:false`. It MUST be built from the committed persisted definition, not
only request input. `normalizedSchedule.timezone` is named `timezone` in the cron result
projection even though the persisted schedule leaf is `tz`; no `staggerMs` or `anchorMs` is
exposed by this self-service result. Successful enabled create MUST return a non-null eligible
`nextRunAt`. Update returns the committed projection: `nextRunAt:null` is valid when disabled
or when existing Scheduler eligibility/fence semantics yield no eligible next run (including
an unresolved `outcome_unknown` fence). Update MUST NOT clear that fence and MUST NOT turn a
known committed update into failure merely because the next run is null; Acceptance records
the corresponding store fence/state separately without adding a twelfth wire field.

For an enabled at-job, normalized `nextRunAt` MUST be strictly later than the existing
control operation's logical mutation timestamp (`nowMs`, persisted as
`createdAtMs`/`updatedAtMs`). The handler MUST capture one `nowMs` immediately before calling
the control op, validate against that same value, and pass it into the control op; it MUST NOT
claim or infer the later fsync/rename wall-clock instant. Response transmission latency does
not retroactively change this logical-time invariant. The production canary separately
requires `nextRunAt > createResponseObservedAt` by using a 15-minute lead.
`exactPersistedDeliveryDestination` MUST contain the persisted `{channel,to}` for
announce delivery, or an explicit null/not-requested representation for no delivery. A model
or skill MUST NOT report success as “created/configured” when these fields are absent.

### CTR-RESULT-002 — List, runs and lifecycle evidence

`list` MUST return only visible persisted job projections without message bodies. While a Job
definition exists, `runs` MUST authorize through its persisted `job.agentId` and return visible
occurrence evidence including occurrence ID, run ID, state, execution outcome, delivery
status, and relevant fence/late-settlement projection.

`remove` MUST delete only the definition; authoritative occurrence evidence remains retained
under D-007. Because current occurrence records do not carry an immutable Agent owner,
ordinary self-service `runs(job_id=...)` MUST return not-found after definition deletion and
MUST NOT infer authorization from bounded `runs.jsonl`, old request data, name, or chat.
Retained post-delete evidence is operator/audit evidence under existing Scheduler authority;
this Spec does not add a tombstone or change occurrence schema. The production canary's
post-delete evidence check is therefore an independently authorized operator read/query, not
an Agent self-service read.

### CTR-LEGACY-001 — Legacy paths fail loud

Scheduler skill/prompt guidance MUST permit only the `scheduler` tool and MUST explicitly
forbid:

```text
openclaw cron
OpenClaw templates in cron-helper
~/.openclaw/cron/jobs.json
manual editing of any jobs.json
Gateway restart as a Scheduler activation mechanism
```

If `scheduler` is absent or denied, the Agent MUST state that self-service Scheduler is not
safely available and MUST NOT fall back to shell, CLI, curl, direct store access, or legacy
OpenClaw behavior.

### CTR-HOT-001 — Post-deployment Job hot reload without restart

Current Node composition does not hot-load code or tool registrations. A conforming
implementation deployment MAY perform one controlled replacement of the sole `authsvc`
production Runtime generation under the existing deployment/runbook authority; that restart
is deployment, not canary evidence. It MUST NOT overlap two production Runtime writers or
start a second Scheduler Runtime/Feishu WebSocket.

After the conforming Runtime generation and child tool catalog are active, the canary window
begins. From immediately before `scheduler(action=create)` until after occurrence,
delivery, auto-delete, and evidence observation, the production Runtime PID/start time MUST
remain unchanged. The Job committed through the unified tool MUST be observed by that
already-running resident Scheduler on a later mtime/tick reload. Thus
`HOT_RELOAD_WITHOUT_RESTART` means **Job definition reload**, never code/tool hot loading.

### CTR-CANARY-001 — Production one-shot canary

After accepted implementation is deployed, efficiency-agent in the current Feishu group MUST
create exactly one 15-minute `at` Job through:

```text
scheduler(action="create", name="15分钟提醒", schedule_kind="at", at="15m",
  message="⏰ Agent Core Scheduler 自助任务触发成功",
  delivery_mode="announce", delivery_target="current_conversation",
  delete_after_run=true, auto_retry=false)
```

The canary MUST prove: no Runtime restart; production JobStore used; exact trusted chat
persisted; `nextRunAt` strictly future; occurrence created and succeeded; delivery status
`delivered`; message visible in the current group; definition automatically deleted; retained
occurrence evidence; zero Runtime/Agent operational access to the exact legacy path
`/Users/yanfenma/.openclaw/cron/jobs.json`; and unchanged legacy bytes.

The negative-evidence method is frozen:

1. `CANARY_EVIDENCE_OPERATOR` is repository owner `mayf3` or an explicitly delegated
   production operator recorded in the deployment PR/runbook; it is not the Agent/model.
2. Before create, that operator records legacy file existence, size, mtime, inode, and SHA-256
   through a read-only observation, plus production Runtime PID/start time and its current
   descendant PID set.
3. Before create, the operator starts whole-host macOS filesystem tracing with
   `sudo fs_usage -w -f filesystem` (not PID-filtered), records trace PID/start marker, and
   verifies it remains alive. The window ends only after occurrence/delivery/auto-delete and
   operator evidence observation. Non-zero tracer exit, missing start/end marker, truncation,
   or capture gap invalidates the canary.
4. The retained raw trace MUST contain zero event whose path equals or is beneath
   `/Users/yanfenma/.openclaw/cron/`; this covers Runtime, descendants, Agent children, and all
   other host processes rather than relying on an incomplete PID list.
5. After the window, the operator repeats existence/size/mtime/inode/SHA-256. Exact equality
   proves unchanged bytes/metadata; the whole-host trace separately proves zero accesses in
   the bounded window.
6. The raw trace is retained outside Git with SHA-256, byte count, start/end wall times,
   Runtime/descendant snapshots, command, exit status, and operator identity recorded in the
   production evidence report. No legacy bytes/path observation feeds Scheduler behavior or
   becomes visible to the Agent.

### CTR-OPS-001 — Reconcile and CLI boundaries

Reconcile MUST remain Owner/operator-only and absent from the unified tool. The existing CLI
MUST remain control-only and continue to use JobStore control operations. The Agent-facing
skill MUST NOT call the CLI.

### CTR-GOV-001 — Spec/implementation split

While V2 is proposed it has no implementation authority, V1 remains accepted/current, and
V1 MUST NOT be modified. Only after explicit Owner `mayf3` authority, an authorized actor MAY
prepare one atomic lifecycle-only docs commit. Its complete semantic lifecycle delta MUST be:
V2 `proposed -> accepted`; V2 `implementation_authority: none -> contracts`; exact V2
acceptance provenance; V1 `accepted -> superseded`; V1
`superseded_by: null -> AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`; and navigation-only
README lifecycle alignment if needed. V2 MUST retain `production_apply_authority: none`;
V1's existing production-apply meaning MUST remain none without any additional body or
frontmatter change beyond its lifecycle/backlink fields. No other semantic delta is allowed.

Before that prepared commit may merge, an independent reviewer MUST review its new exact
head and return `FINAL_HEAD_RECHECK=PASS`. The recheck MUST prove all of:

1. the lifecycle delta is exactly the closed list above;
2. V2's normative body is byte-identical to the independently reviewed proposed content;
3. V1's normative body is byte-identical to its accepted preimage, with changes limited to
   frontmatter lifecycle/backlink fields;
4. `SEMANTIC_DELTA=NONE` for the acceptance transaction; and
5. the proposed review base and current `main` introduce no authority drift affecting V2.

Any failure, ambiguity, main/base drift, or post-recheck byte change invalidates the gate and
requires a new exact-head recheck. Only the exact head that passed may merge. That merge MUST
precede the four-file delta implementation PR. The implementation PR MUST NOT modify either
governing Spec. Acceptance authorizes no auth-service, Grant, credential, registry/database,
deployment, or production action.

## 10. Acceptance

### ACC-TOOL-001 — Single manifest and closed union

- Contracts: `CTR-TOOL-001`, `CTR-TOOL-002`, `CTR-OPS-001`
- Method: Broker manifest/unit tests and child tool-catalog integration test
- Environment: clean implementation worktree
- Required evidence: exact implementation commit, test command/output, registered tool names,
  generated schema with selector `action`
- Expected result: only `scheduler`; existing non-Scheduler tools retain selector `operation`;
  seven actions route correctly; every unknown/cross-action/nested-unknown/conditional-invalid
  field and `reconcile` fails before store read, grant call, or mutation
- Failure condition: any legacy Scheduler tool is model-visible, any existing capability's
  selector changes, or any permissive field passes

### ACC-CTX-001 — Trusted identity and conversation

- Contracts: `CTR-CTX-001`, `CTR-CTX-002`, `CTR-CTX-003`
- Method: integration tests with trusted Feishu, missing/non-chat context, forged relay/chat
  fields, process-generation replacement, two conversations queued for one Agent, concurrent
  calls from two Agents, stale context replay, explicit destination, self and admin stubs
- Environment: Parent Runtime/Broker test composition
- Required evidence: executed tests, active-turn IDs/context lifecycle trace, and persisted job
  projection
- Expected result: only the exact tool-calling turn's injected `feishuChatId` persists; prior,
  queued, cross-Agent, forged, or missing context fails; thread conversation ID is never parsed
  as chat ID; explicit other destination works only with manage:any
- Failure condition: any model/child-supplied or wrong-turn identity/chat value affects
  ownership or destination

### ACC-AUTH-001 — Self/admin authorization

- Contracts: `CTR-AUTH-001`, `CTR-AUTH-002`
- Method: unit/integration matrix across two Agents plus exact-proof admin, proof denial/error/malformed/unavailable, and assert-fail-if-called self cases
- Environment: isolated JobStore with real control operations
- Required evidence: store before/after, handler results, and per-action Auth token-request
  call records for create/list/runs/update/enable/disable/remove self/admin/negative cases;
  instrumented JobStore/read ledger proving whole-document load/validation and an
  authorization-consumption ledger limited to job existence plus `job.agentId`; occurrence/
  history projection/query/filter/return ledger; mutation/audit ledger
- Expected result: every ordinary self action has Auth request count exactly zero; admin proof
  requests exactly `(scheduler, scheduler.manage-any)` once; only exact success establishes
  local `scheduler.manage:any`; authorization may load/validate `{jobs, occurrences, fences}`
  but consumes only requested-job existence and `job.agentId`; on the admin-required branch,
  before proof it performs zero occurrence/history projection/query/filter/return and does
  not use them as decision input; authorized self history remains unchanged with zero Auth;
  denial returns no persisted content and makes no mutation/success audit; production admin
  stays denied until external audience/scope/deployment/Grant gates pass
- Failure condition: any Auth token request during an ordinary self action, ordinary
  cross-Agent visibility/mutation/success audit, a test that treats permitted whole-document
  load/validation itself as forbidden, authorization consumption beyond existence/`job.agentId`, any
  admin-required pre-proof occurrence/history projection/query/filter/return or decision use,
  colon/alias/fallback/admin wire scope, multiple proof requests, tool-asserted authority, or
  claim of production admin availability without accepted/deployed external authority

### ACC-AUTH-002 — Exact four-file delta and composed proof

- Contracts: `CTR-AUTH-003`
- Method: accepted-base-to-head diff census plus focused Scheduler tests and composed production-runtime cross-agent history test with local OAuth capture
- Environment: isolated implementation worktree under repository-pinned Node with proxy variables unset; disposable stores; no production service
- Required evidence: exact changed-file list, executed commands/results, captured OAuth body and count, execution payload authority-key scan, and HistoryStore queries
- Expected result: only the four named files change; production compose source is unchanged; OAuth body uses `scheduler.manage-any`; local labels remain colon-form; target identity, no source Grant/credential propagation, exactly once/no replay, and linked job/occurrence/run/session/target/correlation/parent/terminal truth remain proved
- Failure condition: fifth file, production compose source edit, wrong/alternate scope, alias/retry, authority leakage, replay, identity mismatch, or missing/broken history linkage

### ACC-MUT-001 — Mutation, update, audit and results

- Contracts: `CTR-MUT-001`, `CTR-MUT-002`, `CTR-AUDIT-001`, `CTR-FAIL-001`,
  `CTR-RESULT-001`, `CTR-RESULT-002`
- Method: real Scheduler package tests using a temporary V2 store plus fault injection before
  commit, post-commit/pre-audit, post-audit/pre-response, and relay transport loss for every
  mutation action
- Environment: isolated filesystem
- Required evidence: normalized persisted definitions, audit lines/runtime error record,
  occurrence records, revision values, exact result envelopes, fenced enabled-update store
  projection proving `nextRunAt:null` without fence clearing, control-op/automatic-retry call
  counts, and operator post-delete evidence query
- Expected result: all writes use one control op; automatic mutation retry count is zero;
  update preserves ID/future revision semantics and unresolved fences; create/update return
  every committed field; enabled create has non-null next run while fenced enabled update may
  return explicit null; live-handler audit failure returns known commit +
  `auditStatus=append_failed`; process death
  post-commit/pre-audit returns caller-unknown with zero guaranteed append and a detectable
  operator reconciliation gap; response loss returns unknown; remove retains operator evidence
  while ordinary post-delete runs returns not-found
- Failure condition: direct store write, automatic retry, false success/failure on unknown,
  missing result field, leaked message, replay/fence change, inferred post-delete ownership,
  or deleted occurrence evidence

### ACC-LEGACY-001 — Retired paths

- Contracts: `CTR-LEGACY-001`
- Method: inspect active skill plus negative behavior test with unified tool absent
- Environment: efficiency-agent skill/runtime fixture
- Required evidence: active skill revision, tool-choice trace, repository/skill scan limited to
  active operational instructions
- Expected result: only Scheduler tool path; fail-loud without it; no active OpenClaw template
- Failure condition: shell/CLI/OpenClaw/jobs JSON/Gateway fallback is offered or executed

### ACC-HOT-001 — Production no-restart canary

- Contracts: `CTR-HOT-001`, `CTR-CANARY-001`
- Method: deployment provenance plus current-group one-shot canary and post-run evidence query
- Environment: production Runtime and `/Users/authsvc/.agent-core/scheduler/jobs.json`
- Required evidence: deployment generation/provenance; then Runtime PID/start-time captured
  immediately before create and after canary completion; registered tool catalog; create
  response; committed definition projection; occurrence/delivery evidence; current-group
  message observation; post-run list plus operator occurrence query; whole-host raw `fs_usage`
  trace with command/operator/start-end markers/exit status/byte count/SHA-256 and zero legacy
  path events; Runtime/descendant PID snapshots; exact operator before/after legacy
  existence/size/mtime/inode/SHA-256 equality; evidence-report retention coordinates
- Expected result:

```text
RUNTIME_RESTARTED = NO
PRODUCTION_STORE_USED = YES
EXACT_CHAT_ID_PERSISTED = YES
OCCURRENCE_CREATED = YES
OCCURRENCE_SUCCEEDED = YES
DELIVERY = delivered
CURRENT_GROUP_VISIBLE = PASS
JOB_AUTO_DELETED = YES
OCCURRENCE_EVIDENCE_RETAINED = YES
OPENCLAW_STORE_UNCHANGED = YES
```

- Failure condition: any line differs; evidence is missing; another Runtime overlaps; tracer
  is late, filtered, truncated, exits non-zero, or has a capture gap; any legacy path event
  appears; or before/after legacy metadata/hash differs

### ACC-GOV-001 — Two-stage publication

- Contracts: `CTR-GOV-001`
- Method: after explicit Owner authority, inspect authorized-actor provenance, the prepared lifecycle-only commit, independent review of that commit's exact head, base/main comparison, git/PR ancestry, and prohibited-effect audit
- Environment: GitHub repository
- Required evidence: reviewed proposed V2 head/body digest; explicit Owner instruction; authorized actor identity; prepared atomic docs commit/head; field-level lifecycle diff; V2 proposed-versus-lifecycle normative-body byte comparison; V1 accepted-preimage-versus-lifecycle normative-body byte comparison; current-main authority diff; independent reviewer result containing `FINAL_HEAD_RECHECK=PASS` and `SEMANTIC_DELTA=NONE`; merge commit; later separate four-file implementation ancestry; zero-effect evidence
- Expected result: V1 remains current/unchanged while V2 is proposed; the authorized actor then prepares exactly one allowed lifecycle commit; before merge an independent reviewer proves on that new exact head that the lifecycle delta is exact, V2 normative body is byte-identical, V1 differs only in frontmatter lifecycle/backlink, semantic delta is none, and base/main have no authority drift; only that passing head merges; production authority stays none
- Failure condition: current-round V1 edit; preparation without explicit Owner authority or by an unauthorized actor; partial/extra lifecycle delta; V2 normative-body drift; V1 body or non-lifecycle-frontmatter drift; missing/failed/stale `FINAL_HEAD_RECHECK`; `SEMANTIC_DELTA` other than `NONE`; base/main authority drift; post-recheck head change; merge before PASS; implementation before accepted V2 reaches main; Spec edit in implementation; or any auth/Grant/credential/registry/database/deploy effect

## 11. Alternatives and disposition

- `ALT-001` — Keep six model-visible tools. Rejected by `DEC-001`: conflicts with the one-tool
  skill and expands model catalog surface.
- `ALT-002` — Let the model provide exact Feishu chat ID. Rejected by `DEC-003`: model text is
  not trusted ingress context.
- `ALT-003` — Use “last channel” implicit state. Rejected: destination is ambiguous and not
  exact persisted evidence.
- `ALT-004` — Grant every Agent `manage:any`. Rejected by `DEC-004`: violates self ownership.
- `ALT-005` — Directly edit production `jobs.json`. Rejected by D-007 and `DEC-005`: bypasses
  mutation authority.
- `ALT-006` — Fall back to OpenClaw cron or restart Gateway. Rejected by `DEC-006`: retired
  wrong-store path and false activation.
- `ALT-007` — Claim that copying Node files hot-loads a running parent. Rejected by
  `CTR-HOT-001`: current composition has no code/tool HMR. Deployment uses one controlled
  generation replacement; the no-restart proof begins immediately before Job creation.
- `ALT-008` — Treat candidate `4595ed3` as self-authorizing. Rejected by `DEC-007` and local
  governance.

## 12. Migration, compatibility, and rollback

1. Preserve candidate `4595ed3` as implementation input; do not force-push it away before the
   accepted implementation replacement is durably published.
2. Keep V2 proposed/none and V1 accepted/current/untouched until explicit Owner authority.
   Then an authorized actor prepares one lifecycle-only docs commit with exactly the
   `CTR-GOV-001` atomic fields. Before merge, an independent reviewer rechecks that new exact
   head and must return `FINAL_HEAD_RECHECK=PASS`, including normative-byte comparisons,
   `SEMANTIC_DELTA=NONE`, and no base/main authority drift. Only that unchanged passing head
   may merge and become active in `main`.
3. Rebase/port the original candidate product and tests onto that accepted main as required
   by the unchanged V1 authority. Implement the V2 proof delta only in the exact four files
   named by `CTR-AUTH-003`; production composition source and `packages/scheduler/src/store.js`
   remain unchanged. Continue using existing whole-document JobStore load/validation, while
   authorization consumes only requested-job existence and `job.agentId`; the admin-required
   branch performs no pre-proof occurrence/history projection/query/filter/return or decision
   use, while authorized self history retains zero-Auth behavior.
4. Keep existing internal access handlers and CLI when conforming; no Scheduler core rewrite.
5. Deploy with the existing trusted production procedure and controlled replacement of the
   sole Runtime generation; never overlap a second resident engine or Feishu connection.
   Capture the new generation/PID, then begin the no-restart Job hot-reload canary window.
6. Rollback of tool activation disables/removes the Agent-facing manifest/control surface;
   it MUST NOT delete Jobs/occurrences, mutate Scheduler core, touch OpenClaw store, or restart
   Gateway. A canary Job may be removed only through the unified tool/control operation.
7. No historical OpenClaw job import or compatibility fallback is part of this migration.
8. V2 proof-delta rollback restores the exact four-file accepted preimage and MUST NOT add
   an alias or dual-scope fallback. Auth registration rollback, Grant revocation, and runtime
   rollback remain separate Owner-authorized operations; local rollback MUST NOT claim those
   external states changed.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Implementation may select internal JavaScript property names only; the trusted context
fields, lifetime/binding, action schemas, deployment generation boundary, and Job hot-reload
semantics above are normative and may not be weakened.

---

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = none
PRODUCTION_APPLY_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = mayf3/auth-service#MINIMAL_AUTH_FOUNDATION_V2@05fcf4074fe15d7f29ce1ef0f68767fbbebd54de (constrained_by)
SUPERSEDES_ON_ATOMIC_ACCEPTANCE = AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
FUTURE_LIFECYCLE_ACTOR = OWNER_AUTHORIZED_ACTOR_ONLY
FUTURE_ACCEPTANCE_COMMIT = SINGLE_LIFECYCLE_ONLY_DOCS_COMMIT
PREMERGE_FINAL_HEAD_RECHECK = REQUIRED
FINAL_HEAD_RECHECK = PENDING
ACCEPTANCE_SEMANTIC_DELTA = NONE_REQUIRED
BASE_MAIN_AUTHORITY_DRIFT = MUST_BE_NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 19
CONTRACTS_WITH_ACCEPTANCE = 19
AUTHORING_READY_FOR_REVIEW = COMPLETED
INDEPENDENT_REVIEW = PENDING
READY_TO_MARK_ACCEPTED = NO
ACCEPTED_REVIEWED_HEAD = NONE
```
