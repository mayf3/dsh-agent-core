---
spec_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V2
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-14
revision: r4
revision_date: 2026-09-14
scope:
  - target Agent canonical main Session messaging
  - receipt-only and bounded one-reply delivery
  - trusted inter-agent and workflow-execution provenance
  - delivery and reply outcome reconciliation
  - stable accepted-delivery trace coordinates
  - caller-owned exact-turn read-only inspection
supersedes:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1
superseded_by: null
supersession_note: >-
  Whole-authority successor to accepted V1 r5. V1 remains active until an atomic
  Owner acceptance transaction accepts this V2 and records the reciprocal V1
  backlink.
related_specs:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2
  - AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V2
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
external_authorities: []
related_decisions:
  - AGENT_WORKSPACE_SESSION_MODEL_V3
owners:
  - mayf3
accepted_date: 2026-09-14
accepted_by: mayf3
accepted_reviewed_head: b9893400a98f627aa2ce6411e078d6ef03749288
independent_review_result: PASS
independent_review_blockers: NONE
acceptance_authority_basis: >-
  OWNER_DECISION=ACCEPT on 2026-09-14 accepted exact independently reviewed
  HEAD b9893400a98f627aa2ce6411e078d6ef03749288 for autonomous bounded
  implementation. This acceptance authorizes authority housekeeping,
  implementation, focused tests, independent review, bounded repair, merge,
  deployment preparation, and reversible production canary within the frozen
  Session/Dispatch Traceability scope. It does not authorize product-semantic
  expansion, credential/security-policy mutation, destructive production work,
  dispatch ledger, retry engine, Scheduler redesign, full Session browsing, or
  Workflow Execution redesign.
authoring_authority_basis: >-
  Owner decision 2026-09-14 resumed DISPATCH_SESSION_TRACEABILITY_V0 and
  authorized the minimum authority-authoring and independent-review chain. This
  is authoring authority only, not exact-head acceptance, implementation
  authority, Grant authority, merge authority, or production apply authority.
transition_correction_authority_basis: >-
  OWNER_DECISION=AUTHORIZE_MINIMAL_AUTHORITY_TRANSITION_CORRECTION on
  2026-09-14 authorizes only removal of the invalid requirement to mutate
  historical V1 implementation_authority, plus fresh exact-head review. It does
  not authorize implementation, merge, deployment, production mutation, or any
  additional product-semantic change.
authoring_base: 4c514bb0c8d3df8668f3058387676d97b17d45c2
whole_authority_note: >-
  This document carries the complete current Agent Session Messaging contract.
  It is not a partial overlay. Its only semantic additions over accepted V1 r5
  are the CTR-ASM2-008/009 trace-coordinate persistence/return clauses and
  CTR-ASM2-010 through CTR-ASM2-016: a separately granted caller-owned
  exact-turn inspector.
---

# AGENT_CORE_AGENT_SESSION_MESSAGING_V2

## 0. Lifecycle and one-line model

This is a **proposed whole-authority successor** to accepted
`AGENT_CORE_AGENT_SESSION_MESSAGING_V1` r5. V1 remains active and byte-unchanged
while this candidate is proposed. No product code may be implemented from this
document until an independent semantic review passes and Owner `mayf3` accepts
the exact reviewed head through the atomic transaction in §12.

```text
Agent A calls agent_session_send(targetAgentId=B, message, timeoutSeconds)
→ trusted runtime proves A and A's active source turn
→ Router selects B canonical main Session
→ exactly one new B Run/Turn receives one durable native user message
→ every proven-delivery success returns the existing target/session/message ids
→ a separately granted read-only tool may inspect only that caller-owned turn
→ stop; no replay, retry, browsing, mutation, or automatic second message
```

The trace coordinate is:

```text
targetAgentId + sessionId + messageId
```

`sessionId='main'` identifies B's long-lived container. `messageId` is the
existing native `session/prompt` receipt ID persisted on the exact target user
message; it is the stable exact-turn anchor. This V2 does not mint a dispatch ID.

## 1. Goal

V2 carries forward all accepted V1 r5 behavior:

- target canonical `main` reuse; one send creates one Run/Turn, not one Session;
- the closed send argument surface and target-owned execution identity;
- trusted `inter_agent` provenance and the accepted
  `workflow_execution` extension carried by Workflow Agent Execution V2;
- receipt-only and bounded one-reply modes;
- exact delivery/reply outcome classification and structured errors;
- bounded outcome reconciliation, audit, no replay, and no automatic retry;
- no caller-selected Session, impersonation, target credential use, active-run
  steering, Scheduler ownership, Workflow business semantics, or external push.

The only V2 additions are:

1. every successful envelope representing a proven inbox receipt returns the
   already-existing `targetAgentId`, `sessionId`, and native receipt `messageId`;
2. one independently authorized, read-only capability resolves that exact
   coordinate to a strictly bounded projection of the one associated turn.

`AGENT_WORKSPACE_SESSION_MODEL_V3` remains unchanged. No Decision amendment and
no new Session subsystem are required.

## 2. Scope and non-goals

In scope: the complete Agent Session Messaging authority carried from V1 r5,
additive trace fields on proven-delivery success, and one independently granted
exact-turn read-only inspector.

Out of scope: arbitrary Session targeting; Session list/search or full-history
browsing; per-send Session creation; dispatch ledger, claim, lease, tombstone,
consumption key, or retry engine; active-run steering/cancellation/watch;
Scheduler redesign; Workflow Execution rebuild or business fields; Workflow
read/transition grants; impersonation or target grant inheritance; external
push; UI/analytics/fleet search; new retention policy; and production apply.

## 3. Authority and dependencies

Primary predecessor is accepted
`AGENT_CORE_AGENT_SESSION_MESSAGING_V1` r5. Accepted
`AGENT_WORKSPACE_SESSION_MODEL_V3` fixes canonical-main reuse and one
Run/Turn per send. Accepted `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` owns Router
turn-execution/reconciliation semantics. Accepted
`AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2` contributes the unchanged
`workflow_execution` origin shape and forbids further edits to V1, which is why
this artifact is a whole-authority successor.

Owner `mayf3` owns acceptance. This proposed document has no implementation,
Grant, merge, or production authority.

## 4. Current State

- `STATE-ASM2-001` — Subject: Agent Session Messaging authority. As of
  `origin/main@4c514bb0c8d3df8668f3058387676d97b17d45c2`, accepted V1 r5 remains
  current and closes success envelopes without trace coordinates. Basis:
  `OBS-ASM2-001`, `CLM-ASM2-001`.
- `STATE-ASM2-002` — Subject: trace identifiers in the current source tree.
  Same base/environment, observed 2026-09-14: native `messageId` exists before
  accepted return and is retained with the target message, while Router
  reconciliation is current-epoch memory. Basis: `OBS-ASM2-002`,
  `OBS-ASM2-003`, `CLM-ASM2-002`.
- `STATE-ASM2-003` — Subject: existing canary report. Owner-supplied historical
  characterization says the coordinate in NOTE-ASM2-001 resolved to completed
  turn 67, but the retained production artifact is not a review gate for this
  candidate. Basis: `NOTE-ASM2-001` only.

## 5. Observations

All observations were re-read at `authoring_base` and are evidence, not runtime
or implementation authority.

### OBS-ASM2-001 — current send projection drops existing coordinates

- Subject/source revision: dsh-agent-core
  `4c514bb0c8d3df8668f3058387676d97b17d45c2`.
- Environment/observed at: local read-only source worktree, 2026-09-14.
- Method: exact source read of production handler and Broker relay validator.
- Result: the handler mints `requestId`, calls Router, then projects receipt-only
  success to `{status:'accepted'}`; relay validates the old closed shape.
- Provenance: `packages/production-runtime/src/agent-session-messaging.js` and
  `packages/broker/src/relay.js` at the bound revision.

### OBS-ASM2-002 — receipt fields at the current boundaries

- Subject/source revision: target receipt chain at the same source revision.
- Environment/observed at: local read-only source worktree, 2026-09-14.
- Method: exact read of Router ingress, turn execution, and session seam.
- Result: target `AgentProcess.deliver` receipt already contains:

```text
accepted
sessionId
messageId
reconciliationHandle
evidence
```

- Result continued: Router `deliver` currently returns `accepted`, `sessionId`, optional `status`,
`reconciliationHandle`, and `evidence`; it records/logs `messageId` but omits it
from its returned object. Therefore implementation must forward the existing
native `messageId` one layer further; it must not generate another identifier.
- Provenance: `packages/agent-router/src/process/turn-execution.js`,
  `packages/agent-router/src/ingress-delivery.js`, and
  `packages/demo-server/src/session-seam.js` at the bound revision.

### OBS-ASM2-003 — stability of candidate anchors

- Subject/source revision: identifier lifecycle at the same source revision.
- Environment/observed at: local source worktree, 2026-09-14.
- Method: exact source read of ID creation, receipt forwarding, reconciliation
  storage, Session journal persistence, and the corresponding committed tests.
- Result:
  - `reconciliationHandle == turnExecutionId` exists before prompt bytes and is
  available at receipt, but its query authority is current-runtime memory;
  after a Router epoch change it honestly resolves `restart_lost`.
  - `requestId` exists before delivery and is persisted in rotating ASM audit,
  but current target Session events do not persist a durable
  `requestId -> native turn` mapping.
  - `messageId` is created by the target session seam, returned by the real prompt
  receipt, and persisted verbatim in the target Session journal's inserted/user
  message. It survives Router restart and mechanically resolves to the native
  turn within `(targetAgentId, sessionId)`.
- Provenance: Router reconciliation store/query, ASM audit, session seam, and
  their committed tests at the bound revision.

Hence `messageId` is the V2 exact-turn anchor. `requestId` and
`reconciliationHandle` remain internal evidence and are not competing public
dispatch IDs.

### NOTE-ASM2-001 — owner-supplied canary characterization, non-gating

- Subject: Workflow `1a25ed0d-dce6-461c-9c84-b76b352165ec` dispatch turn.
- Source/environment: Owner report received 2026-09-14. The production target
  artifact is not committed to this branch and was not independently retrievable
  during candidate review. This note is context, not an Observation, Evidence
  relation, Claim support, or Acceptance prerequisite.
- Reported result:

```text
targetAgentId = agt_build-in-public-agent
sessionId = main
messageId = cc095c89-520c-4bab-86f7-d4a90bacd898
resolved native turn = 67
turn state = completed
```

The Owner reports that the persisted turn contained the exact user message,
`turn/start`, Workflow read tool call/result, assistant messages, final response,
and `turn/end`. No normative conclusion depends on that report. Implementation
acceptance uses the accessible, sanitized fixture required by ACC-ASM2-007.

## 6. Claims and assumptions

### CLM-ASM2-001 — current accepted success is not dispatch-traceable

- Support state: SUPPORTED
- Supported by evidence: `EVD-ASM2-001`
- Contradicted by evidence: none known
- Uncertainty: none for the bound source revision

### CLM-ASM2-002 — native messageId is the smallest stable exact-turn anchor

- Support state: SUPPORTED
- Supported by evidence: `EVD-ASM2-002`
- Contradicted by evidence: none known
- Uncertainty: trace remains readable only while the underlying target
  trajectory is legally retained; V2 creates no retention promise

### CLM-ASM2-003 — one turn can be projected without adjacent history

- Support state: OPEN_ASSUMPTION
- Supported by evidence: none yet
- Contradicted by evidence: none known
- Uncertainty: implementation acceptance must supply the accessible fixture and
  negative adjacency proof in ACC-ASM2-007; corrupt or ambiguous journals fail
  closed

## 7. Evidence relations

### EVD-ASM2-001 — source projection supports the current-gap Claim

- Source observations: `OBS-ASM2-001`, `OBS-ASM2-002`
- Target: `CLM-ASM2-001`
- Relation: SUPPORTS
- Bound coordinates: dsh-agent-core
  `4c514bb0c8d3df8668f3058387676d97b17d45c2`, observed 2026-09-14
- Strength/sufficiency: direct source proof of the omitted output fields
- Limitations: does not prove a future implementation
- Provenance: exact files named in the source observations

### EVD-ASM2-002 — identifier lifecycle supports messageId selection

- Source observations: `OBS-ASM2-002`, `OBS-ASM2-003`
- Target: `CLM-ASM2-002`
- Relation: SUPPORTS
- Bound coordinates: source base and retained-event schema read at that base
- Strength/sufficiency: direct creation/receipt/persistence/restart semantics
- Limitations: no new retention guarantee; lawful deletion ends readability
- Provenance: exact source files and committed tests named by the observations

## 8. Decisions

### DEC-ASM2-001 — reuse native messageId as the public turn anchor

- Decision owner: repository owner `mayf3`
- Decision: expose the existing target receipt `messageId`; derive native
  `turnId` only during inspection.
- Rejected alternative: expose ephemeral reconciliation handle or mint a new ID.
- Reason: native message identity is already exact and durable in the target
  journal while retained.

### DEC-ASM2-002 — require an independent inspection grant

- Decision owner: repository owner `mayf3`
- Decision: inspection uses a scope independent from `agent.session.send` and
  additionally proves caller ownership from durable message provenance.
- Rejected alternative: treat send grant or coordinate possession as read power.
- Reason: preserve least privilege and prevent cross-Agent history browsing.

### DEC-ASM2-003 — inspect one turn through an allowlisted projection

- Decision owner: repository owner `mayf3`
- Decision: resolve one message to one native turn and return only the fields
  required for delivery/work/failure diagnosis, with explicit bounds.
- Rejected alternative: expose raw JSONL or full `main` history.
- Reason: the Goal is observability for one dispatch, not Session browsing.

### DEC-ASM2-004 — observability does not own delivery recovery

- Decision owner: repository owner `mayf3`
- Decision: query is zero-mutation and never licenses resend.
- Rejected alternative: add ledger, claim, lease, retry, or Workflow logic.
- Reason: keep existing no-replay/outcome-unknown safety boundaries unchanged.

## 9. Contracts

### 9.1 Existing send contracts carried forward

### CTR-ASM2-001 — closed model arguments and validation

The model-facing send capability remains exactly:

```text
agent_session_send({
  operation: 'send',
  targetAgentId: string matching ^agt_[a-z0-9-]+$, 5..128 chars,
  message: string,
  timeoutSeconds: required integer 0..300 with no default
})
```

Unknown fields are rejected. `timeoutSeconds` is mandatory; omission is invalid.
Message text must be nonblank, contain no NUL, and be 1..65536 UTF-8 bytes. The
trusted handler's first action performs the exact property/type/range, UTF-8 byte,
NUL, and target-grammar validation before request-ID generation, Router delivery,
audit success, or any other side effect. Broker/child validation is defense in
depth and direct parent RPC cannot bypass this authoritative validation. The
caller cannot supply `sessionId`, `messageId`,
`requestId`, source identity, Principal, credential, provenance, channel,
workspace, reconciliation handle, or turn ID. Self-send is rejected before any
target prompt byte because it would deadlock the per-process queue.

### CTR-ASM2-002 — trusted caller and authorization

The parent RPC derives caller Agent identity from the actual child process
binding and validates the active source `turnExecutionId`. Child-reported
identity is never trusted. The gateway obtains A's credential and requires:

```text
resource = agent-session-messaging
scope = agent.session.send
```

Missing/invalid credentials, denied grant, malformed input, disabled/missing
target, stale source-turn proof, or self-send fail closed before Router delivery.
The send grant conveys no Session-list, history-read, target-credential,
impersonation, Scheduler, Workflow, or inspection authority.

### CTR-ASM2-003 — target, Session, workspace, and execution identity

Router resolves the exact enabled target Agent ID and alone selects
`sessionMode='main'`, so `sessionId='main'`. Existing main is resumed; absent main
is atomically created. The target's Agent Definition determines its canonical
workspace and isolated DSH home. One accepted send creates exactly one new
Run/Turn in that Session and never a per-send Session.

For the target Run:

```text
execution callerAgentId = B
credential / Principal / grants = B's
workspace / DSH home = B's
source metadata = A only
```

A's credential, Principal, or grants are never inherited by B.

A2A uses Router `deliver`, never external `onIngress`. It MUST NOT resolve,
create, update, or switch ChannelConversation Bindings; set external ingress or
reply context; synthesize Feishu identifiers; invoke external reply; or create
Forum, Scheduler, or Workflow state. External ancestry is read-only telemetry.

### CTR-ASM2-004 — trusted message origin

The runtime, not model input, attaches exactly one of these allowlisted shapes:

```text
{kind:'inter_agent', sourceAgentId:A, correlation:<A source turnExecutionId>}

{kind:'workflow_execution', workflowInstanceId:<uuid>,
 nodeVisitId:<uuid>, attemptId:'wfeat-<24hex>'}
```

For `inter_agent`, `sourceAgentId` uses the canonical Agent Definition identity
semantics for the trusted runtime-derived caller: an opaque string matching
`^agt_[A-Za-z0-9_-]+$`. It does not use the narrower model-facing
`targetAgentId` grammar or its 5..128-character input bound. `correlation` is the
non-empty opaque, runtime-proven source `turnExecutionId` and must satisfy the
existing turn-execution bound. For
`workflow_execution`, both instance/visit fields are UUID strings and `attemptId`
matches `^wfeat-[0-9a-f]{24}$`.

Every layer exact-allowlists the applicable keys and values, rejects every
unknown field/kind or malformed/bound-violating value, constructs a detached
copy, and applies `Object.freeze` before forwarding. The trusted handler, Router
admission, and session seam each validate independently; mutation of the caller's
original object after any boundary cannot change forwarded or persisted bytes.
The Router handles both origins as generic shape validation only. The session
seam persists the detached accepted shape verbatim as user-message source
metadata. It never selects target identity, authorization, credential, routing,
retry, or business action. Callers omitting this trusted sidecar retain the
existing `{kind:'user'}` source behavior.

### CTR-ASM2-005 — admission and send modes

Only the real target `session/prompt` receipt proves acceptance. Parent queue
admission is insufficient. Proven zero-byte rejection is `not_admitted`; an
unprovable process/write boundary is `outcome_unknown`, never fabricated as
not-delivered.

For `timeoutSeconds=0`, return immediately after the real inbox receipt. It does
not wait for model start, turn completion, idle, final response, Workflow action,
or target failure.

If B is busy, the send waits in the existing bounded parent-owned FIFO and is
written only after the active Run reaches the required terminal/idle boundary.
It MUST NOT steer or splice into the active Run. Queue admission is not an inbox
receipt. Queue-cap/fence rejection writes zero target prompt bytes. The queued
entry continues to own its position until its own Run terminates or becomes an
honest unknown.

For `timeoutSeconds>0`, after receipt wait only for this exact target execution's
single aggregated final assistant reply. The positive reply deadline starts only
when the real inbox receipt is proven; pre-receipt FIFO/admission time consumes
none of the 0..300-second reply-wait budget. Router admission and turn deadlines
remain independent. Timeout ends the wait only; it does not cancel or replay the
turn.

### CTR-ASM2-006 — result and error model

V2 keeps V1's delivery/reply outcome model:

```text
DELIVERY = NOT_DELIVERED | DELIVERED | UNKNOWN
REPLY    = NOT_WAITED | REPLIED | TIMEOUT | TARGET_FAILED |
           NO_OUTPUT | TRUNCATED | UNKNOWN
```

Required structured errors remain:

```text
invalid_arguments
credential_unavailable
credential_invalid
access_denied
target_not_found
target_disabled
self_send_not_supported
not_admitted
queue_capacity_exceeded
target_run_failed
reply_unavailable
outcome_unknown
internal_error
transport_failure
unsupported_operation
```

`AGENT_PROCESS_EXITED` is a reason, never a delivery dimension. A post-receipt
unknown is `DELIVERED + UNKNOWN`; a pre-receipt process-boundary unknown remains
`UNKNOWN + UNKNOWN`; a structured proven rejection remains `NOT_DELIVERED`.
Provider details are sanitized and bounded. Message bodies, credentials, token
material, hidden reasoning, and raw provider payloads never appear in errors.

The total mapping is:

```text
accepted                         -> DELIVERED + NOT_WAITED
replied                          -> DELIVERED + REPLIED
timeout                          -> DELIVERED + TIMEOUT
reply_unavailable(truncated)     -> DELIVERED + TRUNCATED
reply_unavailable(no_output)     -> DELIVERED + NO_OUTPUT
reply_unavailable(evicted|
  restart_lost|never_existed)    -> DELIVERED + UNKNOWN
target_run_failed                -> DELIVERED + TARGET_FAILED
not_admitted|queue_capacity_exceeded
                                 -> NOT_DELIVERED + NOT_WAITED
target/credential/grant/input/
  transport/unsupported failure -> NOT_DELIVERED + NOT_WAITED
pre-receipt outcome_unknown      -> UNKNOWN + UNKNOWN
post-receipt outcome_unknown     -> DELIVERED + UNKNOWN
pre-delivery internal_error      -> NOT_DELIVERED + NOT_WAITED
post-receipt malformed receipt   -> DELIVERED + UNKNOWN
unproven gateway internal_error  -> UNKNOWN + UNKNOWN
```

Available complete output is `replied` only for terminal state
`completed|late_completed` with `truncated=false`. Failed/late-failed output is
`target_run_failed`; completed with no output is `reply_unavailable(no_output)`;
terminated-without-outcome is `outcome_unknown`; retained partial/truncated text
never becomes a successful reply.

### CTR-ASM2-007 — reconciliation and no replay

The existing `agent_session_send_reconcile` remains a read-only discovery
capability for the V1 invocation-correlation/audit chain. It never issues another
send. Rotating evidence that no longer exists resolves honestly to UNKNOWN. The
Router in-memory reconciliation handle may report pending, settled, evicted,
restart_lost, or never_existed; none licenses automatic retry.

One send invocation causes at most one inbox receipt and at most one target Run.
Unknown outcome never means safe-to-resend. Reconciliation, trace inspection, and
Workflow reads never consume or mutate delivery state.

The bounded reply helper MUST preserve the V1 race closure: read authoritative
output; subscribe for the exact handle; read again after subscription; wait only
to the remaining deadline; on matching settlement read authority again; perform
one final read before timeout; settle through a once-guard; always clear timer and
listener. It owns no poll loop, second cache, or durable state.

For the lost/unusable parent-RPC response seam only, child
`invocationCorrelation` remains a trusted-channel-only per-invocation anchor.
It is minted once by the child runtime for exactly one send invocation, is never
model-visible, and is persisted verbatim on both the L1 intent and every L1
outcome row. It confers no identity: lookup is always bound to the same
gateway-derived caller.

The sibling infrastructure-only reconcile capability performs exactly one lookup
as the same gateway-derived caller against retained live + `.1` L1 audit. Its
manifest remains `infrastructure:true`, is excluded from model tool inventory,
and remains gateway-executable over the trusted channel. A `reconciled` parent
result is malformed: only the child relay may synthesize `reconciled`, and only
at the existing transport-loss or structurally-unusable-parent-envelope capture
points. Reconcile never returns or reconstructs reply text and never sends.

The child-synthesized closed base projections are:

```text
intent + outcome(accepted) ->
  {status:'reconciled', delivery:'DELIVERED', replyStatus:'NOT_WAITED'}
intent + outcome(replied) ->
  {status:'reconciled', delivery:'DELIVERED', replyStatus:'REPLIED',
   replyTextAvailable:false}
intent + outcome(timeout) ->
  {status:'reconciled', delivery:'DELIVERED', replyStatus:'TIMEOUT'}
intent + outcome(failed) ->
  the exact DELIVERY/REPLY pair from CTR-ASM2-006 plus persisted failureCode
  and, when applicable, failureReason
intent present, outcome absent ->
  {status:'reconciled', delivery:'UNKNOWN', replyStatus:'UNKNOWN'}
intent absent with provable retained-window coverage ->
  {status:'reconciled', delivery:'NOT_DELIVERED', replyStatus:'NOT_WAITED'}
intent expired/outside provable coverage ->
  {status:'reconciled', delivery:'UNKNOWN', replyStatus:'UNKNOWN'}
```

A failed post-receipt unknown persists `failureCode:'outcome_unknown'` and
`failureReason:'post_receipt'`, therefore reconciles to `DELIVERED + UNKNOWN`.
Process exit is reason evidence, never delivery state; the reason is taken from
the authoritative reconciliation snapshot (`terminationEvidence`/`errorClass`),
not inferred from an event payload. The caller-visible failure render includes
the bounded structured code/reason detail. These fields make every V1 outcome
surface-decidable and keep provider/infrastructure internals hidden.

L1 lookup reads both live and one-deep `.1` files. Control-plane restart alone
does not erase evidence. Intent absence proves NOT_DELIVERED only when those files
provably cover the invocation window; rotation/expiry yields UNKNOWN. UNKNOWN is
final for that invocation and never licenses replay.

### CTR-ASM2-008 — audit and bounded operations evidence

L0 operations evidence retains validation/credential/grant denials. L1 ASM
intent/outcome rows retain V1's sanitized, bounded, rotating behavior and fields:
source/target Agent IDs, opaque request/correlation identifiers, timeout mode,
coarse outcome, timestamps/duration, structured failure code/reason where
required, and internal reconciliation evidence. The closed coarse outcome is
`accepted|replied|timeout|denied|failed`.

Commit order remains: authoritative validation/auth; append intent; on intent
append failure return `internal_error` with zero Router delivery; call Router;
append the proven receipt or definitive failure outcome; for wait mode append the
final reply/timeout/failure outcome. An outcome append failure after a proven
receipt is signaled but never rewrites the business result. Audit stores no
message text, credentials, tokens, or full history.

For every V2 proven inbox receipt, the first proven-receipt outcome row MUST
persist the exact `targetAgentId`, `sessionId`, and `messageId` coordinate before
the handler settles any normal `accepted`, `replied`, or `timeout` result. All
later outcome rows for that invocation repeat the coordinate verbatim. If that
required append fails, delivery truth remains DELIVERED and operations evidence
records degradation, but the handler returns a post-receipt `outcome_unknown`
instead of an untraceable normal success. It never re-delivers.

This adds three fields to the existing bounded rotating outcome evidence; it is
not a dispatch ledger and is not the authority for turn content. The target
Session journal remains the content authority, and rotation still limits later
reconciliation.

### 9.2 V2 trace-coordinate contract

### CTR-ASM2-009 — proven-delivery success returns existing IDs

Every normal success that follows a proven target inbox receipt returns the same
three-field trace coordinate:

```text
timeoutSeconds = 0:
  {status:'accepted', targetAgentId, sessionId, messageId}

timeoutSeconds > 0, exact reply available:
  {status:'replied', reply, targetAgentId, sessionId, messageId}

timeoutSeconds > 0, reply wait expired:
  {status:'timeout', targetAgentId, sessionId, messageId}
```

Every child-synthesized reconciled envelope appends exactly one of these closed
trace variants to its CTR-ASM2-007 base projection:

```text
V2 retained proven-receipt outcome:
  traceCoordinate:{targetAgentId, sessionId, messageId}

legacy pre-V2 row, rotated coordinate, or delivery not proven:
  traceCoordinate:null, traceStatus:'unavailable'
```

`traceStatus` is absent when `traceCoordinate` is present. No other null/omission
combination is valid. For a retained V2 row whose delivery is DELIVERED, missing
coordinate fields make reconciliation `DELIVERED + UNKNOWN` with
`traceCoordinate:null, traceStatus:'unavailable'`; the reader never guesses.

Field semantics:

- `targetAgentId` is the exact resolved target used by Router;
- `sessionId` is the exact target-scoped native Session ID (`main` for A2A);
- `messageId` is the exact native target user-message ID returned by
  `session/prompt` and persisted in that Session;
- all three are non-empty strings and must be forwarded verbatim;
- `messageId`, not `reconciliationHandle`, is the durable exact-turn anchor;
- no `turnId` is returned at acceptance because native turn assignment may not
  yet have occurred; inspection later returns `resolvedTurnId` when available.

A malformed proven-delivery receipt missing any coordinate is
`outcome_unknown` with delivery already marked proven where applicable; it must
never produce `{status:'accepted'}` with guessed IDs.

### 9.3 V2 bounded exact-turn inspection

### CTR-ASM2-010 — independent capability and grant

Expose one LOCAL, read-only capability:

```text
agent_session_turn_inspect({targetAgentId, sessionId, messageId})

resource = agent-session-messaging
scope = agent.session.inspect_own_dispatch
```

The argument object is exact and rejects unknown fields. All three coordinates
are required non-empty strings; `targetAgentId` must match the exact Agent ID
grammar, and `sessionId/messageId` are opaque values, never filesystem paths.

The inspection scope is independent from `agent.session.send`: neither implies
the other. Caller identity is derived only from the trusted parent process
binding. The query never accepts caller-supplied identity, Principal, credential,
workspace, home path, source metadata, or authorization evidence.

### CTR-ASM2-011 — ownership proof and opaque denial

The runtime resolves the target's canonical workspace and DSH home from the
target Agent Definition; callers cannot select a filesystem root. Before any
Session read, the inspector scans the existing ASM L1 audit live file and its
one-deep `.1` generation in deterministic oldest-to-newest row order, always to
the end of both available generations and never stopping early on a match. Each
file is accepted only within the existing `AUDIT_FILE_MAX_BYTES = 8,388,608`;
an oversized/malformed generation fails closed as `inspection_unavailable`.
Eligibility requires exactly one retained V2 coordinate row whose trusted
`sourceAgentId`, `targetAgentId`, `sessionId`, and `messageId` equal the trusted
caller and exact request.

Missing, foreign-owned, wrong-target/session, duplicate, and unsupported-origin
coordinates therefore execute the same bounded audit stages, make zero target
Session/trajectory reads, and return byte-identical `not_found_or_not_owned`.
Grant denial happens before coordinate resolution, returns `access_denied`, and
makes zero audit or Session reads; it reveals grant state, not coordinate
existence.

Only an eligible coordinate reaches the target-scoped Session locator. The
locator may return at most one exact retained trajectory artifact for
`(targetAgentId, sessionId)` without directory enumeration, content search, or
multi-trajectory scan. Current canonical `main` is the required V0 path. A reset
or archived trajectory is readable only when the existing target-scoped store
can resolve that one artifact directly; otherwise inspection fails honestly as
`inspection_unavailable`. V2 adds no archive index or retention promise.

The one selected artifact is processed sequentially under the existing Router
process-evidence caps, reused verbatim as query caps:

```text
maximum complete Session records decoded = 10,000
maximum Session UTF-8 bytes read           = 8,388,608
maximum one Session record                 = 1,048,576 UTF-8 bytes
maximum serialized inspection response     = 1,048,576 UTF-8 bytes
```

Crossing a record/byte cap, encountering an oversized record, or needing a
second artifact returns `inspection_unavailable`; partial results are forbidden.
The reader never crosses the target Agent/canonical workspace boundary and never
searches message text. Exactly one persisted message must match.

Inspection is authorized only if the located durable message proves:

```text
source.kind == 'inter_agent'
AND source.sourceAgentId == trusted callerAgentId
```

Possessing or guessing a coordinate is insufficient. Once an audit-eligible
artifact is read, absent/foreign/malformed durable message provenance, duplicate
message ID, or unsupported provenance still fails closed. Failures known from
the bounded eligibility pass use `not_found_or_not_owned`; inability to complete
the bounded authoritative artifact read uses `inspection_unavailable`. Neither
response claims that delivery failed or retry is safe. V2 creates no new
retention policy and promises no recovery after lawful deletion or rotation.

`workflow_execution` messages are not inspectable through this caller-owned A2A
surface because they have no originating Agent source identity. Adding an
operator or Workflow-execution inspector requires separate future authority.

### CTR-ASM2-012 — exact turn resolution

For an owned message, the reader resolves only the native turn started for that
message. The implementation must use DSH session sequence/order, never wall-clock
proximity: locate the unique `agent/inbox/spliced` insertion carrying `messageId`;
require the same ID on the corresponding durable `user/message`; select the first
subsequent `turn/start` only when no different inbox insertion or competing turn
start intervenes; then bind only events whose native `data.turn` equals that turn
through its matching `turn/end`. The exact prompt message is included by ID even
though DSH's `user/message` event does not itself carry `data.turn`. Missing start
means `accepted_not_started`; ambiguous, duplicate, or corrupt association fails
closed as `trace_unresolvable`.

Honest states are:

```text
accepted_not_started  # receipt message exists; no associated turn/start yet
running               # associated turn/start exists; no turn/end
completed             # associated turn/end reason.kind == completed
failed                # associated turn/end has another terminal reason
```

`resolvedTurnId`, `startedAt`, and `endedAt` are nullable until supported by the
observed events. A missing terminal event is never represented as completion.

### CTR-ASM2-013 — allowlisted turn-only projection

Success returns:

```text
{
  status: 'found',
  targetAgentId,
  sessionId,
  messageId,
  resolvedTurnId,
  turnState,
  startedAt,
  endedAt,
  stopReason,
  messages,
  toolCalls,
  toolResults,
  finalResponse,
  truncated,
  originalBytes,
  omittedRecords
}
```

The projection contains only:

- the exact matched caller message;
- visible `assistant/message` text belonging to `resolvedTurnId`;
- `tool/call` name, call ID, and arguments belonging to that turn;
- `tool/result` call ID and visible result content belonging to that turn;
- the last visible assistant text as `finalResponse`;
- `turn/start`, `turn/end`, and sanitized terminal reason needed for state/times.

The nested record schemas and their canonical key order are closed:

```text
messages[]    = {seq, role, messageId, text}
toolCalls[]   = {seq, callId, name, argumentsJson}
toolResults[] = {seq, callId, text, isError}

seq           = non-negative integer journal sequence
role          = 'user' | 'assistant'
messageId     = string for the exact user message, otherwise null
callId/name   = non-empty sanitized string
argumentsJson = canonical compact JSON string or null; object keys are sorted
                lexicographically at every depth and array order is retained
text          = visible redacted text string
isError       = boolean
```

Each record contains exactly those keys in the displayed order; raw event fields
are neither copied nor accepted. Arrays are ascending by `seq`. `finalResponse`
is exactly the last assistant `text`, or null when none exists.

It explicitly excludes every other turn, Session headers beyond the returned
coordinate, system/developer prompts, reasoning blocks, assistant chunks,
encrypted replay/provider state, signatures, usage/accounting, raw internal
events, credentials, tokens, environment, and filesystem paths.

All visible strings pass the existing secret/error redaction boundary before any
measurement. Serialization is canonical compact JSON in the field order shown
above; object keys inside records use the contract-declared order and arrays use
ascending journal sequence. UTF-8 bytes of that serialization are authoritative.

`originalBytes` is the byte length of the fully populated, post-redaction
measurement form with `truncated:false`, `originalBytes:0`, and
`omittedRecords:[]`. It therefore reveals no pre-redaction secret length and is
not recursively defined. A non-truncated result replaces the zero with this
number; the final serialized result must still be at most **1,048,576 UTF-8
bytes**.

If the final serialized result would exceed the cap, apply this deterministic
whole-record algorithm:

1. retain the coordinate, state, times, stop reason, truncation fields, and an
   initially empty bounded `omittedRecords` array;
2. consider the complete `finalResponse` first, then complete message/tool
   records in descending journal sequence; include a candidate only if the
   canonical final result remains within the cap;
3. if `finalResponse` does not fit, return `finalResponse:null` and append
   `{kind:'finalResponse', seq:null, id:null,
   reason:'record_exceeds_budget', redactedBytes:N}`;
4. for each other omitted record append the same bounded shape with `kind`, its
   `seq`, opaque record/call `id` or null, literal
   `reason:'record_exceeds_budget'`, and post-redaction `redactedBytes`;
   if omission metadata itself would exceed the cap, replace all remaining
   entries by one exact `{kind:'remaining', reason:'metadata_budget', count:N}`;
5. set `truncated:true` and the previously computed `originalBytes`.

No string or JSON record is partially cut or partially parsed. Oversized raw
events are redacted and measured, then represented only by the omission metadata
above. If the mandatory shell plus one bounded aggregate omission record cannot
fit, fail with `inspection_unavailable`; never emit an over-cap success.

### CTR-ASM2-014 — zero mutation and no browsing

Inspection must not:

- start, resume, wake, interrupt, or otherwise contact the target process;
- append, consume, repair, compact, or rewrite Session/audit/Workflow state;
- invoke any target tool or Workflow read/transition;
- list Sessions, search by text/time/workflow ID, or read adjacent turns (the
  bounded exact-ID lookup in the one mechanically selected target artifact is
  not a list or content search);
- return a whole `main` Session or offer pagination into unrelated history;
- retry delivery, create a dispatch claim, or decide whether resend is safe.

The implementation may read an already-live persistence service or the canonical
on-disk Session store read-only. If neither can prove the coordinate, it returns
an honest bounded error; it never starts the Agent to make the query work.

### CTR-ASM2-015 — enforced non-goals

This whole authority does not add:

- arbitrary Session targeting, Session list/search, or full-history browsing;
- per-send/fresh Session creation for A2A messaging;
- a dispatch ledger, claim, lease, tombstone, consumption key, or retry engine;
- active-run steering, cancellation, interruption, watch, or streaming;
- Scheduler redesign, Workflow Execution rebuild, or Workflow business fields;
- Workflow read/transition permission, target grant inheritance, OBO, or
  impersonation;
- automatic Feishu/Forum/Workflow notification or multi-turn ping-pong;
- durable Router wait/reconciliation storage or indefinite trace retention;
- UI, analytics, fleet-wide search, or operator/admin history access;
- any production apply authority.

### CTR-ASM2-016 — inspection errors and privacy

The inspection capability exposes only:

```text
invalid_arguments
credential_unavailable
credential_invalid
access_denied
not_found_or_not_owned
trace_unresolvable
inspection_unavailable
internal_error
```

Errors are sanitized and bounded. `not_found_or_not_owned` is deliberately
non-distinguishing. `inspection_unavailable` means the authoritative read surface
could not be reached; it must not be rewritten as not received, not started, or
safe to resend. No failure mutates or consumes the trace.

### CTR-ASM2-017 — implementation boundary after acceptance

Only after §12 acceptance may a separate implementation branch touch the minimum
surface needed to satisfy these contracts. Predicted surfaces are:

```text
Router deliver receipt: forward existing messageId
production send handler: success projections
existing ASM audit outcome: required retained targetAgentId/sessionId/messageId linkage
Broker relay/result validator and model rendering
new exact read-only capability manifest + handler + trusted gateway context
target Session read-only resolver/projector
focused unit/integration/structure tests
```

The implementation branch must not modify this governing Spec. Exact paths are
not implementation authority until fresh code preflight confirms them. Discovery
of a required ledger, new identifier, target process start, full-history read, or
Workflow/Scheduler semantic change is a scope escalation and stops implementation.

## 10. Acceptance

### ACC-ASM2-001 — carried send contract remains intact

- Contracts: `CTR-ASM2-001`, `CTR-ASM2-002`, `CTR-ASM2-003`,
  `CTR-ASM2-004`, `CTR-ASM2-005`
- Method: existing V1 unit/integration suites plus focused negative tests for
  closed arguments (including missing timeout and target IDs with uppercase,
  underscore, fewer than 5 or more than 128 characters), trusted identity/origin,
  exact target, self-send, main reuse, zero-byte rejection, and receipt-only
  versus bounded-wait timing. Mutate each caller-owned origin object after trusted
  handler, Router, and session-seam validation for both `inter_agent` and
  `workflow_execution`; persisted bytes must remain the detached frozen value.
  Hold a send in busy FIFO longer than most of its positive timeout, then prove
  the full reply deadline begins only at actual receipt. Separately prove a
  canonical valid source ID such as `agt_Source_A` passes through trusted
  provenance, `agt_bad!` fails before Router delivery, and the narrower valid
  target `agt_target-agent` continues to pass while uppercase/underscore target
  input remains rejected.
- Environment: isolated test runtime at the implementation commit
- Required evidence: commands, exit status, test counts, implementation commit,
  and source diff showing no caller-selected identity/session/credential path
- Expected result: all carried cases pass byte-for-byte except the explicitly
  additive V2 success fields
- Failure condition: any V1 r5 behavior, WAE origin shape, or D-008 main/turn
  invariant regresses; invalid input causes request-ID/audit/Router side effects;
  origin alias mutation changes persisted bytes; or pre-receipt queue time
  consumes the positive reply deadline

### ACC-ASM2-002 — carried outcome, reconciliation, and audit safety

- Contracts: `CTR-ASM2-006`, `CTR-ASM2-007`, `CTR-ASM2-008`
- Method: execute a total caller-visible delivery/reply/failure mapping and the
  existing discriminating reconcile matrix, including same-caller binding,
  infrastructure-tool hiding, malformed parent `reconciled` rejection,
  structured render detail, verbatim invocationCorrelation on intent/outcome,
  authoritative process-exit reason, live+`.1` lookup, audit append-failure,
  rotation, and no-replay cases
- Environment: isolated production-runtime/Router/Broker test harness
- Required evidence: exact tests/results and write-count proof showing no second
  Router delivery during reconcile or inspection
- Expected result: delivery/reply dimensions and errors remain honest; post-
  receipt facts are not rewritten; unknown never auto-retries
- Failure condition: fabricated not-delivered/completed state, duplicate send,
  bare outcome with an inferential delivery phase, parent-produced reconciled
  envelope, model-visible reconcile tool, raw sensitive detail, or audit failure
  changing proven delivery truth

### ACC-ASM2-003 — success returns the existing stable coordinate

- Contracts: `CTR-ASM2-009`
- Method: focused unit and integration tests for accepted/replied/timeout and
  post-receipt failures, malformed receipts, two sends to the same main,
  Router/process restart, and deliberately lost parent responses for each normal
  outcome. Force the required coordinate-outcome append to fail.
- Environment: isolated runtime using real session persistence semantics
- Required evidence: exact receipt and caller envelopes proving verbatim
  `targetAgentId/sessionId/messageId`, journal readback, and zero new ID mint
- Expected result: every normal proven-delivery success returns the same
  coordinate model; the coordinate is persisted before settlement and survives
  parent-response loss in the closed reconciled shape; legacy/rotated evidence
  returns exactly `traceCoordinate:null, traceStatus:'unavailable'`; append
  failure returns post-receipt unknown without changing DELIVERED or redelivering;
  two sends share `main` but have distinct persisted `messageId`; native turn ID
  is derived only later
- Failure condition: missing/guessed coordinate, public reconciliation handle,
  handler-minted ID, or requestId presented as an already durable turn link

### ACC-ASM2-004 — authorization and exact-turn ownership fail closed

- Contracts: `CTR-ASM2-010`, `CTR-ASM2-011`, `CTR-ASM2-012`
- Method: gateway/handler integration tests with independent send/inspect grants,
  trusted caller bindings, own and foreign provenance, wrong target/session,
  missing/expired/duplicate IDs, pre-start/running/terminal turns, and one
  mechanically located retained trajectory. For foreign, missing, wrong-session,
  and unsupported-origin requests, fully scan both bounded audit generations in
  the same deterministic order without early exit; inject fixed audit I/O and
  compare stage/counter traces plus coarse latency distributions. Grant-denied
  requests exercise one common pre-resolution path for existing and missing IDs.
- Environment: isolated multi-Agent production-layout fixture; no real grants
- Required evidence: request/result matrix, exact audit bytes/rows-read and
  Session-locator/read counters, target-process spawn counters, byte-identical
  foreign/missing/wrong-coordinate responses, equal negative-path stage traces,
  and bounded timing characterization; no constant-time claim is required
- Expected result: only the trusted originating caller with the inspect grant can
  resolve its message; all ownership-ineligible coordinates use the same bounded
  work and make zero target Session reads; grant denial makes zero audit/Session
  reads; states and derived turn ID are honest
- Failure condition: send implies inspect, coordinate possession implies access,
  early-exit existence oracle, differing negative-path work counters, unbounded
  audit/trajectory scan, timestamp guessing, cross-Agent lookup, or target startup

### ACC-ASM2-005 — projection is turn-bounded, safe, and explicitly bounded

- Contracts: `CTR-ASM2-013`, `CTR-ASM2-016`
- Method: fixture containing adjacent turns, messages, tool calls/results,
  reasoning, encrypted replay, usage, secrets, oversized final response and
  oversized individual records, multibyte UTF-8, exact boundary sizes, and
  failures; golden-check the exact nested schemas/key order and independently
  recompute canonical post-redaction measurement bytes. Exercise exact
  10,000-record / 8,388,608-input-byte / 1,048,576-single-record boundaries and
  each +1 failure with instrumented read/decode counters.
- Environment: isolated target Session corpus
- Required evidence: exact JSON result, byte counts, redaction assertions, and
  negative assertions for turns before/after the target; selected-artifact count
  equals one and no directory/list/multi-trajectory read occurs
- Expected result: requested turn messages/tool activity/final response are
  readable; excluded data is absent; cap/truncation metadata is deterministic
- Failure condition: adjacent history, system/developer/reasoning/provider data,
  secret/path disclosure, pre-redaction byte leakage, nondeterministic ordering,
  undeclared nested key, partial record/string, cap overrun, silent truncation,
  output above 1,048,576 bytes, or more than one trajectory touched

### ACC-ASM2-006 — inspector remains observability-only

- Contracts: `CTR-ASM2-014`, `CTR-ASM2-015`, `CTR-ASM2-017`
- Method: before/after filesystem and process-state comparison around successful
  and failed inspection; source/static checks for forbidden surfaces
- Environment: isolated runtime with stopped target Agent and immutable fixtures
- Required evidence: zero spawn/resume/wake/tool/Workflow/session writes, no list
  or full-history/directory-enumeration capability, focused diff, and structure
  verifier result
- Expected result: query is repeatable, non-consuming, and zero mutation
- Failure condition: any target activation, state write, retry, ledger/claim,
  browsing surface, Scheduler/Workflow semantic change, or Spec edit in impl

### ACC-ASM2-007 — accessible exact-turn characterization fixture

- Contracts: `CTR-ASM2-009`, `CTR-ASM2-011`, `CTR-ASM2-012`,
  `CTR-ASM2-013`, `CTR-ASM2-014`
- Method: commit a secret-safe synthetic target Session fixture containing three
  adjacent turns whose middle turn reproduces the event topology needed for a
  Workflow-read dispatch; run the production resolver against the fixture by its
  exact target/session/message coordinate
- Environment: repository fixture at the implementation commit, available to
  every reviewer; no production artifact, send, or production write
- Required evidence: immutable fixture path and SHA-256, resolver command/result,
  exact projected start/end sequence numbers, included middle-turn call/result
  IDs, and negative assertions that every preceding/following-turn ID and unique
  marker is absent
- Expected result: the exact coordinate resolves only the middle turn and answers
  receipt, start, invoked Workflow read, result, terminal response/state, and
  diagnostic stop reason without adjacent history
- Failure condition: inaccessible fixture, mutable/unhashed evidence, resend,
  mutation, inability to isolate the middle turn, or any adjacent marker exposure

## 11. Alternatives and disposition

### ALT-ASM2-001 — return only `sessionId='main'`

Rejected: target-scoped Session identity does not distinguish repeated sends.

### ALT-ASM2-002 — expose `reconciliationHandle` as the durable anchor

Rejected: it is current-Router-epoch authority and becomes `restart_lost`.

### ALT-ASM2-003 — expose only `requestId`

Rejected for V0: current durable target journal has no stable requestId-to-turn
mapping. Adding such a mapping duplicates the already-persisted native message ID.

### ALT-ASM2-004 — mint a new dispatch/turn identifier

Rejected: native `messageId` already supplies the required durable exact anchor.

### ALT-ASM2-005 — reuse `agent.session.send` for inspection

Rejected: delivery authority must not imply another Agent's history-read power.

### ALT-ASM2-006 — return the full target `main` history

Rejected: it exposes unrelated months of conversation and is unnecessary for
exact-dispatch diagnosis.

### ALT-ASM2-007 — add ledger, retry, lease, or Scheduler/Workflow semantics

Rejected: observability does not license a new dispatch system.

## 12. Migration, compatibility, and rollback

### 12.1 Independent review and compatibility gate

The independent reviewer must bind an exact candidate commit and verify:

```text
WHOLE_AUTHORITY_CARRIAGE = V1 r5 + workflow_execution origin, no regression
SEMANTIC_DELTA = trace coordinate + caller-owned exact-turn inspection only
TRACE_ANCHOR = existing durable native messageId, not reconciliationHandle
SEND_AND_INSPECT_GRANTS = independent
OWNERSHIP = trusted caller identity + durable sourceAgentId equality
QUERY_SCOPE = one exact turn, no list/search/adjacent history
SENSITIVE_SURFACES = excluded and redacted
BOUNDS = deterministic and explicit
QUERY_MUTATION = zero
RETRY_OR_LEDGER = absent
PRODUCTION_APPLY_AUTHORITY = none
```

The first review freezes one blocker union. At most one union repair and one exact
new-head re-audit are allowed. A non-converged candidate stops as
`PAUSED_CONVERGENCE_GUARD`.

### 12.2 Atomic Owner acceptance path

An independent PASS makes this candidate `AUTHORITY_ACCEPT_READY`; it does not
accept it. Owner `mayf3` must explicitly accept the exact reviewed head.

The subsequent lifecycle-only transaction is atomic:

1. V2 `status: proposed -> accepted`;
2. V2 `implementation_authority: none -> contracts`;
3. add accepted date/by/reviewed-head/verdict provenance;
4. V1 `status: accepted -> superseded`;
5. V1 `implementation_authority: contracts` remains byte-for-byte unchanged as
   immutable historical metadata; V1's `superseded` status makes it inactive;
6. V1 `superseded_by: null -> AGENT_CORE_AGENT_SESSION_MESSAGING_V2`;
7. preserve both normative bodies byte-for-byte in that transaction;
8. final-head reciprocal-link and semantic-byte check passes before merge.

Acceptance does not grant production apply. The existing V1 deployment authority
freezes an older schema/release closure and cannot deploy V2. Any production
activation requires separate current authority, exact release bytes, rollback,
readback, and fresh canary proof.

### 12.3 Rollback boundary

Before acceptance, rollback is deletion/closure of this proposed branch with V1
unchanged. After acceptance but before implementation, rollback requires a new
whole-authority successor; accepted V2 bytes are immutable. Implementation
rollback restores the last conformant V1-runtime behavior only under separate
release authority and must not claim V2 conformance. Production rollback is not
authorized by this Spec.

## 13. Open questions and authoring result

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

```text
GOAL = DISPATCH_SESSION_TRACEABILITY_V0
AUTHORITY_ACTION = SUPERSEDE
CANDIDATE = AGENT_CORE_AGENT_SESSION_MESSAGING_V2
TRACE_COORDINATE_MODEL = targetAgentId + sessionId + messageId
SESSION_ID = target-scoped native main
TURN_ANCHOR = native receipt messageId
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
IMPLEMENTATION_ALLOWED_NOW = NO
READY_FOR_INDEPENDENT_REVIEW = YES
```
