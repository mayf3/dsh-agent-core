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
  - AGENT_TRUSTED_FLEET_CUTOVER_V1
external_authorities:
  - repository: mayf3/auth-service
    authority_id: MINIMAL_AUTH_FOUNDATION_V2
    revision: d529bd3c28ece3967149ad793794f8dac2020276
    relation: constrained_by
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
- External `MINIMAL_AUTH_FOUNDATION_V2` at `mayf3/auth-service@d529bd3c...` constrains
  audience-scoped Machine Grants and strict scope rejection. Its incorporated
  `grants-and-audiences.md` requires a new resource audience/scope and Grant supply to be
  separately authorized in auth-service. Therefore this Spec defines only Agent Core's
  fail-closed interpretation of `scheduler.manage:any`: until an accepted auth-service CCR
  registers the Scheduler audience/scope and a separately authorized Grant supply provisions
  a caller, production `manage:any` availability is **NONE**. This Spec creates no Auth scope,
  audience, Grant, credential, token, or production Auth mutation.
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
- `STATE-003` — The pinned `cron-helper` bytes require only a unified `scheduler` tool and
  fail-loud behavior when that tool is unavailable. Basis: `OBS-005`.
- `STATE-004` — Current Router source has exact Feishu `chatId` at ingress and a turn-scoped
  parent-only `activeBindingContext`, but only the binding ID is currently propagated. Basis:
  `OBS-006`.

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

A credentialed ordinary Agent has `scheduler.read:self` and `scheduler.manage:self` only for
jobs whose persisted `agentId` equals trusted `callerAgentId`. `list` and `runs` MUST hide
foreign definitions/evidence. Mutations of a foreign job MUST return a non-leaking denied or
not-found error and MUST NOT mutate or append a success audit record.

### CTR-AUTH-002 — Admin scope and external prerequisite

Only a caller for whom the trusted Auth seam authorizes exact scope
`scheduler.manage:any` for the future Scheduler resource audience MAY use `all_agents`,
create/update for another Agent, mutate another Agent's job, or specify another delivery
destination. Tool arguments MUST NOT assert this scope. Auth denial, unavailable audience,
missing Grant, token failure, or uncertainty MUST deny the operation.

This local implementation MUST support the fail-closed seam and tests with an injected Auth
stub, but MUST NOT claim production admin availability. Production admin enablement is
blocked until a separate accepted auth-service CCR registers the Scheduler audience and
scope, its source is implemented/deployed, and a separately authorized Grant supply is
applied. Ordinary self operations do not request `manage:any`.

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

The response MUST be built from the committed persisted definition, not only request input.
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
occurrence evidence; zero Runtime/Agent operational access to the OpenClaw store; and an
independently authorized operator's read-only before/after metadata/hash observation showing
that legacy store bytes did not change. The operator observation is evidence only and MUST
NOT feed Scheduler behavior or expose the store to the Agent.

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
- Method: unit/integration tests across two Agents plus authorized admin
- Environment: isolated JobStore with real control operations
- Required evidence: store before/after, handler results, grant call record
- Expected result: self access succeeds without manage-any token request; foreign ordinary
  access leaks/mutates nothing; injected admin-stub path succeeds only after trusted grant;
  production admin path remains denied while external Scheduler audience/scope/Grant is absent
- Failure condition: ordinary cross-Agent visibility/mutation, tool-asserted scope, or claim of
  production admin availability without accepted/deployed external authority

### ACC-MUT-001 — Mutation, update, audit and results

- Contracts: `CTR-MUT-001`, `CTR-MUT-002`, `CTR-AUDIT-001`, `CTR-FAIL-001`,
  `CTR-RESULT-001`, `CTR-RESULT-002`
- Method: real Scheduler package tests using a temporary V2 store plus fault injection before
  commit, post-commit/pre-audit, post-audit/pre-response, and relay transport loss for every
  mutation action
- Environment: isolated filesystem
- Required evidence: normalized persisted definitions, audit lines/runtime error record,
  occurrence records, revision values, exact result envelopes, control-op/automatic-retry
  call counts, and operator post-delete evidence query
- Expected result: all writes use one control op; automatic mutation retry count is zero;
  update preserves ID/future revision semantics; create/update return every committed field;
  live-handler audit failure returns known commit + `auditStatus=append_failed`; process death
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
  message observation; post-run list plus operator occurrence query; Runtime/Agent file-access
  trace showing zero OpenClaw store access; separately authorized operator read-only
  before/after metadata/hash observation
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
- `ALT-007` — Claim that copying Node files hot-loads a running parent. Rejected by
  `CTR-HOT-001`: current composition has no code/tool HMR. Deployment uses one controlled
  generation replacement; the no-restart proof begins immediately before Job creation.
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
5. Deploy with the existing trusted production procedure and controlled replacement of the
   sole Runtime generation; never overlap a second resident engine or Feishu connection.
   Capture the new generation/PID, then begin the no-restart Job hot-reload canary window.
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

Implementation may select internal JavaScript property names only; the trusted context
fields, lifetime/binding, action schemas, deployment generation boundary, and Job hot-reload
semantics above are normative and may not be weakened.

---

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1
SPEC_KIND = implementation
STATUS = proposed
AUTHORITY_LEVEL = governing_spec
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = mayf3/auth-service#MINIMAL_AUTH_FOUNDATION_V2@d529bd3c28ece3967149ad793794f8dac2020276 (constrained_by)
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 18
CONTRACTS_WITH_ACCEPTANCE = 18
AUTHORING_READY_FOR_REVIEW = YES
```
