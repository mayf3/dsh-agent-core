---
spec_id: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
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
  - PRODUCTION_RUNTIME_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - repository-maintainers
---

# AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1

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

This Spec is the docs-only authority half of the split required for source candidate
`4595ed3`. That candidate's product code is retained as implementation input, but its
co-located proposed Spec does not authorize that implementation. Product implementation
may be published only after this exact Spec is accepted and present in `main`.

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
- hot activation of the tool/control surface without restarting the production Runtime;
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

- `AGENT_CORE_PRODUCT_ARCHITECTURE_V1` owns the process-external trusted caller
  relationship, Broker/tool boundary, and rule that Agent Core does not recreate the DSH
  tool runtime.
- D-007 `SCHEDULER_OCCURRENCE_OUTCOME_V2` is the current Scheduler authority. Its single
  mutation authority, occurrence evidence, delete semantics, and control operations are
  preserved.
- `SCHEDULER_TIMEOUT_OUTCOME_V2` governs the implemented Scheduler V2 state machine and
  migration/no-catch-up behavior.
- `PRODUCTION_RUNTIME_V1` owns production composition and the single resident Runtime.
- Auth service remains the grant authority for `scheduler.manage:any`; this Spec changes no
  Auth protocol, credential format, or token semantics.
- This Spec is `NEW`: no accepted implementation Spec currently authorizes an Agent-facing
  general self-service Scheduler capability or its trusted current-conversation security
  contract.

## 4. Current State

- `STATE-001` — At repository `mayf3/dsh-agent-core` commit `e40c140`, `main` has the
  Scheduler V2 engine, JobStore control operations, Broker relay, production Runtime, and
  operator CLI, but no model-visible self-service `scheduler` tool. Basis: `OBS-001`,
  `OBS-002`.
- `STATE-002` — Candidate `4595ed3` contains six model-visible manifests
  (`scheduler_create`, `scheduler_list`, `scheduler_runs`, `scheduler_enable`,
  `scheduler_disable`, `scheduler_remove`) plus a proposed Spec in the same commit. Basis:
  `OBS-003`, `OBS-004`.
- `STATE-003` — The active `cron-helper` guidance requires only a unified `scheduler` tool
  and fail-loud behavior when that tool is unavailable. Basis: `OBS-005`.
- `STATE-004` — No production activation or canary evidence for the unified tool exists at
  authoring time. Basis: `OBS-006`.

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

### OBS-005 — Scheduler-only skill rule is active

- Subject: user skill `cron-helper` v4.0.0
- Source revision: local skill content observed 2026-08-27
- Environment: efficiency-agent/DSH skill registry
- Observed at: 2026-08-27
- Method: loaded skill content
- Result: the skill permits only `scheduler(action=...)`, forbids OpenClaw cron, Gateway
  restart, and manual jobs JSON access, and requires exact create evidence.
- Provenance: `/Users/yanfenma/.agents/skills/cron-helper/SKILL.md`

### OBS-006 — Unified production tool is unavailable before implementation

- Subject: current Agent tool catalog
- Source revision: current production session snapshot
- Environment: production DSH session
- Observed at: 2026-08-27
- Method: inspect available tool catalog
- Result: no callable `scheduler` tool is present; production canary cannot be truthfully
  executed before implementation activation.
- Provenance: current session tool inventory

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

### CLM-003 — Hot control-surface activation can preserve the resident engine

- Support state: INFERRED
- Supported by evidence: `EVD-003`
- Contradicted by evidence: none known
- Uncertainty: production activation mechanism must be proven against the deployed Runtime;
  starting a second Runtime or restarting production does not satisfy this Claim

## 7. Evidence relations

### EVD-001 — Candidate inspection supports bounded reuse

- Source observations: `OBS-003`, `OBS-004`
- Target: `CLM-001`
- Relation: SUPPORTS
- Bound coordinates: candidate `4595ed3`, base `e40c140`
- Strength/sufficiency: strong for code shape and governance split
- Limitations: does not establish accepted authority or production conformance
- Provenance: repository diff and source reads

### EVD-002 — Architecture and skill behavior support trusted injection

- Source observations: `OBS-005`, plus Architecture trusted process relationship
- Target: `CLM-002`
- Relation: SUPPORTS
- Bound coordinates: Architecture and active skill observed 2026-08-27
- Strength/sufficiency: strong for the negative trust boundary
- Limitations: does not select a concrete JavaScript property layout
- Provenance: local authorities and skill content

### EVD-003 — Existing reload behavior supports no-restart activation feasibility

- Source observations: `OBS-001`, `OBS-002`
- Target: `CLM-003`
- Relation: SUPPORTS
- Bound coordinates: repository `e40c140`
- Strength/sufficiency: moderate until production canary is executed
- Limitations: source behavior alone is not production activation evidence
- Provenance: Scheduler and production composition source

## 8. Decisions

### DEC-001 — One model-visible tool

- Decision owner: repository maintainers
- Decision: expose exactly one tool named `scheduler`; select behavior through a required
  `action` enum. Existing internal handlers may remain separate.
- Rejected alternative: expose six or seven operation-specific tool manifests.
- Reason: one stable model surface matches the skill contract and avoids catalog sprawl.

### DEC-002 — Closed schema by action

- Decision owner: repository maintainers
- Decision: validate a discriminated union with `additionalProperties: false` at both the
  model schema and trusted handler boundary. Each action accepts only its documented keys.
- Rejected alternative: one permissive bag of optional fields.
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

## 9. Contracts

### CTR-TOOL-001 — Exact model-visible surface

The Broker MUST register exactly one model-visible Scheduler self-service tool named
`scheduler`. It MUST NOT register model-visible tools named `scheduler_create`,
`scheduler_list`, `scheduler_runs`, `scheduler_update`, `scheduler_enable`,
`scheduler_disable`, or `scheduler_remove`. Internal handler names MAY remain unchanged.
`reconcile` MUST NOT be reachable through `scheduler`.

### CTR-TOOL-002 — Action discriminator and closed schemas

`scheduler.action` MUST be required and MUST be one of `create`, `list`, `runs`, `update`,
`enable`, `disable`, `remove`. Validation MUST reject unknown fields and fields belonging to
another action before mutation or grant lookup.

Action schemas:

```text
create required: action, name, schedule_kind, message
create allowed:  action, name, schedule_kind, cron_expr, at, every_ms, timezone,
                 message, timeout, light_context, model, delivery_mode,
                 delivery_target, destination, best_effort, delete_after_run,
                 auto_retry, target_agent_id
list allowed:    action, all_agents
runs allowed:    action, job_id, limit, all_agents
update required: action, job_id
update allowed:  action, job_id, name, schedule_kind, cron_expr, at, every_ms,
                 timezone, message, timeout, light_context, model, delivery_mode,
                 delivery_target, destination, best_effort, delete_after_run,
                 auto_retry, target_agent_id
enable required: action, job_id
disable required: action, job_id
remove required: action, job_id
```

For `schedule_kind=cron`, `cron_expr` and `timezone` MUST be present. For `at`, `at` MUST be
present and normalize to a strictly future instant. For `every`, `every_ms` MUST be a
positive integer. Conditional violations MUST fail as `invalid_arguments`.

`callerAgentId`, `agentId`, `channel`, `to`, `chatId`, `chat_id`, `ingress`, `session`, and
`reconcile` MUST NOT be accepted tool properties.

### CTR-CTX-001 — Trusted caller identity

The Parent Runtime MUST inject non-empty `callerAgentId` from the actual Router/child process
relationship. No tool argument may set or override it. Missing trusted caller identity MUST
fail loud before store access. Self authorization MUST compare `job.agentId` only with this
trusted value.

### CTR-CTX-002 — Trusted current Feishu conversation

For a Feishu ingress turn, the Parent Runtime MAY attach a trusted ingress context containing
the exact ingress chat identifier. When `delivery_target=current_conversation`, the handler
MUST resolve that context to exactly:

```json
{"channel":"feishu","to":"chat:<exact ingress chat id>"}
```

The resolved destination MUST be persisted on the Job. The model MUST NOT provide any part
of the chat identifier. Missing, non-Feishu, malformed, or stale/unbound ingress context MUST
fail loud and MUST NOT create/update a Job.

### CTR-CTX-003 — Other destinations are admin-only

An ordinary Agent MUST use `current_conversation` for announced delivery and MUST NOT specify
`destination` or target another Agent. Explicit other destinations or another
`target_agent_id` require successful `scheduler.manage:any` authorization for the trusted
caller. Denial or Auth uncertainty MUST fail closed.

### CTR-AUTH-001 — Self read and manage scopes

A credentialed ordinary Agent has `scheduler.read:self` and `scheduler.manage:self` only for
jobs whose persisted `agentId` equals trusted `callerAgentId`. `list` and `runs` MUST hide
foreign definitions/evidence. Mutations of a foreign job MUST return a non-leaking denied or
not-found error and MUST NOT mutate or append a success audit record.

### CTR-AUTH-002 — Admin scope

Only a caller for whom the trusted Auth seam authorizes `scheduler.manage:any` MAY use
`all_agents`, create/update for another Agent, mutate another Agent's job, or specify another
delivery destination. Tool arguments MUST NOT assert this scope.

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

### CTR-AUDIT-001 — Mutation audit

Successful create/update/enable/disable/remove MUST append the existing sanitized
self-service mutation audit evidence with operation, job ID, trusted operator Agent ID,
target Agent ID, timestamp, and before/after definition digests as applicable. It MUST NOT
record message bodies, credentials, secrets, or a model-supplied identity.

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

The response MUST be built from the committed persisted definition, not only request input.
`nextRunAt` for an enabled at-job MUST be a strictly future timestamp at commit response
time. `exactPersistedDeliveryDestination` MUST contain the persisted `{channel,to}` for
announce delivery, or an explicit null/not-requested representation for no delivery. A model
or skill MUST NOT report success as “created/configured” when these fields are absent.

### CTR-RESULT-002 — List, runs and lifecycle evidence

`list` MUST return only visible persisted job projections without message bodies. `runs` MUST
return visible occurrence evidence including occurrence ID, run ID, state, execution outcome,
delivery status, and relevant fence/late-settlement projection. `remove` MUST delete only the
definition; occurrence evidence MUST remain queryable under existing evidence retention.

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

### CTR-HOT-001 — No-restart activation

Implementation deployment MUST NOT restart the production Runtime and MUST NOT start a
second Scheduler Runtime or Feishu WebSocket. The activation mechanism MUST add/refresh the
Broker tool/control surface in the existing parent Runtime. A Job committed through the
unified tool MUST be observed by the already-running resident Scheduler on a later tick.

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
occurrence evidence; and no read/write/change to the OpenClaw store during the operation.

### CTR-OPS-001 — Reconcile and CLI boundaries

Reconcile MUST remain Owner/operator-only and absent from the unified tool. The existing CLI
MUST remain control-only and continue to use JobStore control operations. The Agent-facing
skill MUST NOT call the CLI.

### CTR-GOV-001 — Spec/implementation split

The docs-only Spec MUST be independently reviewed, accepted by an authorized maintainer at an
exact revision, and merged into `main` before the implementation PR is based/published. The
implementation PR MUST NOT modify its governing accepted Spec and MUST retain the candidate
product code unless a Contract requires revision.

## 10. Acceptance

### ACC-TOOL-001 — Single manifest and closed union

- Contracts: `CTR-TOOL-001`, `CTR-TOOL-002`, `CTR-OPS-001`
- Method: Broker manifest/unit tests and child tool-catalog integration test
- Environment: clean implementation worktree
- Required evidence: exact implementation commit, test command/output, registered tool names
- Expected result: only `scheduler`; seven valid actions route correctly; unknown/action-wrong
  fields and `reconcile` fail before handler mutation
- Failure condition: any legacy Scheduler tool is model-visible or permissive fields pass

### ACC-CTX-001 — Trusted identity and conversation

- Contracts: `CTR-CTX-001`, `CTR-CTX-002`, `CTR-CTX-003`
- Method: integration tests with trusted Feishu, missing context, non-chat context, forged chat
  fields, explicit destination, self and admin callers
- Environment: Parent Runtime/Broker test composition
- Required evidence: executed tests and persisted job projection
- Expected result: current conversation persists exact injected Feishu destination; forged or
  missing context fails; explicit other destination works only with manage:any
- Failure condition: any model-supplied identity/chat value affects ownership or destination

### ACC-AUTH-001 — Self/admin authorization

- Contracts: `CTR-AUTH-001`, `CTR-AUTH-002`
- Method: unit/integration tests across two Agents plus authorized admin
- Environment: isolated JobStore with real control operations
- Required evidence: store before/after, handler results, grant call record
- Expected result: self access succeeds; foreign ordinary access leaks/mutates nothing; admin
  access succeeds only after trusted grant
- Failure condition: ordinary cross-Agent visibility or mutation

### ACC-MUT-001 — Mutation, update, audit and results

- Contracts: `CTR-MUT-001`, `CTR-MUT-002`, `CTR-AUDIT-001`, `CTR-RESULT-001`,
  `CTR-RESULT-002`
- Method: real Scheduler package tests using a temporary V2 store
- Environment: isolated filesystem
- Required evidence: normalized persisted definitions, audit lines, occurrence records,
  revision values, exact result envelopes
- Expected result: all writes use control ops; update preserves ID and revisions future
  semantics; create/update return every required committed field; remove retains occurrence
- Failure condition: direct store write, missing evidence field, leaked message, replay/fence
  change, or deleted occurrence evidence

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
- Required evidence: Runtime PID/start-time before and after; registered tool catalog; create
  response; committed definition projection; occurrence and delivery evidence; current-group
  message observation; post-run list/runs; OpenClaw store unchanged evidence gathered without
  using it as an operational input
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

- Failure condition: any line differs, evidence is missing, another Runtime is started, or
  legacy store is touched by the operation

### ACC-GOV-001 — Two-stage publication

- Contracts: `CTR-GOV-001`
- Method: inspect git and PR ancestry
- Environment: GitHub repository
- Required evidence: docs-only Spec PR merge commit; accepted exact Spec revision in main;
  separate implementation PR based on that main; governing Spec unchanged in implementation
- Expected result: authority precedes implementation publication
- Failure condition: mixed proposed-Spec implementation merge or discarded candidate code

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
- `ALT-007` — Restart production to load the tool. Rejected by `DEC-005`/`CTR-HOT-001` for
  this rollout; it would not prove hot activation.
- `ALT-008` — Treat candidate `4595ed3` as self-authorizing. Rejected by `DEC-007` and local
  governance.

## 12. Migration, compatibility, and rollback

1. Preserve candidate `4595ed3` as implementation input; do not force-push it away before the
   accepted implementation replacement is durably published.
2. Merge this docs-only Spec first. Acceptance binds an exact reviewed commit and becomes
   active only in `main`.
3. Rebase/port the candidate product and tests onto that accepted main. Remove six manifests
   from model registration, add the unified manifest/dispatcher/update path, and add trusted
   ingress context resolution.
4. Keep existing internal access handlers and CLI when conforming; no Scheduler core rewrite.
5. Activate the control/tool surface in the existing production Runtime without starting a
   second resident engine or Feishu connection.
6. Rollback of tool activation disables/removes the Agent-facing manifest/control surface;
   it MUST NOT delete Jobs/occurrences, mutate Scheduler core, touch OpenClaw store, or restart
   Gateway. A canary Job may be removed only through the unified tool/control operation.
7. No historical OpenClaw job import or compatibility fallback is part of this migration.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Implementation may select the concrete trusted context object/property names and hot-loading
mechanism, provided all Contracts and Acceptance evidence are satisfied.

---

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 17
CONTRACTS_WITH_ACCEPTANCE = 17
AUTHORING_READY_FOR_REVIEW = YES
```
