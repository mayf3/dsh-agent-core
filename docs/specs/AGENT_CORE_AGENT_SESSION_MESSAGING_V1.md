---
spec_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-08-31
revision: r2
alignment_date: 2026-09-01
source_r2_sha256: 20820492d1b65842b0c607ee013baca1d5a3d6377b072d8914405eabff99d169
fresh_authoring_base: 433b8bd06a163badae322da9db012b9851e148b6
task_name: 会话 执行
task_type: SPEC_AUTHORING_ONLY
scope:
  - agent_session_send broker local capability
  - target Agent canonical main Session reuse with one new Run/Turn per send
  - runtime-owned inter_agent provenance and target-owned execution identity
  - receipt-only and bounded one-reply modes
  - thin reconciliation wait helper
  - authorization, audit, error, and acceptance contracts
supersedes: []
superseded_by: null
related_specs:
  - AGENT_CORE_AGENT_WAKE_CAPABILITY_V1 (Draft PR #130; close as obsolete under D-008)
governed_by:
  - AGENT_WORKSPACE_SESSION_MODEL_V3
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
external_authorities: []
related_decisions:
  - AGENT_WORKSPACE_SESSION_MODEL_V3
owners:
  - repository-maintainers
---

# AGENT_CORE_AGENT_SESSION_MESSAGING_V1

> 状态：**proposed r2 / D-008-aligned publication**。D-008 已对内容寻址的 r2
> （SHA-256 `20820492d1b65842b0c607ee013baca1d5a3d6377b072d8914405eabff99d169`）完成
> Model authority alignment；本轮只把该 r2 发布为待独立审阅的 governing Spec，并对齐
> authority/lifecycle 元数据。`R1–R12`、Cases A–I 与 additional mandatory cases 的语义
> delta 为 `NONE`。本 Spec 在 `proposed` 状态下不是 active implementation authority，
> 不授予实现、合并、Grant、部署或 production apply 权限。
>
> 调查基线：`origin/main@1a9b81de19c2bf4af01f62f6189acffc1bb6839d`；本轮 fresh
> authoring base：`origin/main@433b8bd06a163badae322da9db012b9851e148b6`（含 D-008
> accepted/current merge）。
>
> `PRODUCT_CODE_CHANGE = NONE`；`PRODUCTION_CHANGE = NONE`。

## 0. Owner Ruling 与一句话模型

Owner 已终止 `agent_wake` primitive。Scheduler 拥有“什么时候启动一次 Agent 工作”；Workflow
拥有工作状态；Forum 拥有公开多人协作；本 Spec 只拥有 Agent 之间的私下定向 Session
Messaging。

```text
Agent A calls agent_session_send(targetAgentId=B, message, timeoutSeconds)
→ trusted runtime derives source identity and correlation
→ B canonical main Session (reuse existing; atomically create when absent)
→ exactly one new B Run/Turn for this send
→ timeoutSeconds=0: return after inbox receipt
→ timeoutSeconds>0: wait for this exact Run's one aggregated final assistant reply
→ stop; no automatic second A→B or B→A turn
```

OpenClaw reference model, limited to the facts supplied for this task:

```text
target = Session/model context, not external channel
agentId-only target = target Agent main Session
main exists -> reuse
main absent -> atomically create
one send -> one new Run/Turn, not one new Session
timeout=0 -> accepted receipt only
timeout>0 -> optionally wait for one reply
inter-agent input -> trusted provenance, not direct-user provenance
```

V1 intentionally does **not** copy OpenClaw arbitrary `sessionKey`, label, watch, announce,
ping-pong, active-run steering, or historical-session targeting.

## 1. Problem

`agent_wake` modeled “start one fresh Session for one task”. That overlaps Scheduler `run_once` and
misplaces a scheduling concern in an Agent-facing primitive. The missing generic primitive is instead:

```text
one authenticated Agent sends one private message to another Agent's main Session
```

Current main already owns most execution mechanics:

- `agentRouter.deliver({requestId, agentId, sessionMode:'main', message})` resolves the target,
  starts/reuses the process, fixes `sessionId='main'`, and returns a real inbox receipt;
- demo-server resumes existing `main`, creates it when absent, and single-flights concurrent creation;
- every delivery mints an exact reconciliation handle and retains bounded final assistant output;
- Broker derives caller identity from the actual spawned process and can grant-gate local capabilities.

Two gaps prevent direct exposure as the new capability:

1. the prompt protocol collapses the message to string content and demo-server always writes
   `source:{kind:'user'}`; trusted `inter_agent` provenance is lost;
2. reconciliation has snapshots and an event subscriber, but no race-safe bounded “wait for this exact
   delivery's final reply” helper.

## 2. Authority and disposition

### 2.1 Governance classification

```text
AUTHORITY_CLASSIFICATION = NEW
PUBLICATION_ALIGNMENT_CLASSIFICATION = AMEND
PR130_DISPOSITION = CLOSE
```

Draft PR #130 proposes a different product primitive and has never been active authority: its Spec is
`proposed`, absent from `origin/main`, and grants no implementation or production authority. Under the
current governance grammar, changing a proposed authority is normally AMEND, while SUPERSEDE changes
accepted normative meaning. Here the product exits `agent_wake` entirely and introduces a separately
named capability with different purpose, Session mode, parameters, reply contract, and security
provenance. Therefore:

- close/withdraw Draft PR #130 as obsolete;
- preserve its reusable investigation findings in this Spec;
- do not mutate PR #130 into `agent_session_send`;
- do not claim an atomic supersession transition against active authority, because PR #130 was never
  accepted/merged authority.

Frontmatter keeps `supersedes: []`; PR #130 appears only under `related_specs`, because a never-accepted
proposal is not an authority-graph predecessor.

### 2.2 Decision alignment gate

Accepted/current `AGENT_WORKSPACE_SESSION_MODEL_V3` D-008 is the whole-authority successor that
superseded V2 and froze the required distinction: Messaging targets the target Agent's canonical main
and starts one new Run/Turn in that same logical main; Delegation remains per-task non-main; Cron remains
per-execution non-main. D-008 §27.7 independently classified the content-addressed r2 alignment as PASS
and explicitly routed its publication into this separate governance round. No partial supersession or
mixed V2/V3 model is used here.

```text
DECISION_ALIGNMENT_REQUIRED = YES
DECISION_ALIGNMENT_STATUS = SATISFIED_BY_D008
CURRENT_DECISION = AGENT_WORKSPACE_SESSION_MODEL_V3 / D-008 / accepted-current
ACTIVE_IMPLEMENTATION_AUTHORITY_WHILE_PROPOSED = NONE
IMPLEMENTATION_BEFORE_SPEC_ACCEPTANCE = FORBIDDEN
```

Cron/Scheduler per-execution fresh Session semantics are not challenged.

## 3. Current-main findings

### 3.1 Router main reuse

Current `agentRouter.deliver` is the sole delivery primitive to reuse:

```text
validate request
→ resolve target Agent
→ reconciliation capacity precheck
→ sessionId = 'main'
→ resolve target Agent default workspace
→ routeChain.admitWithRouteChain
→ AgentProcess.deliver
→ bounded per-process prompt queue
→ session/prompt
→ demo-server getOrCreateSession('main')
→ followup(message)
→ receipt
```

Evidence:

- `packages/agent-router/src/ingress-delivery.js:173-285`;
- `packages/agent-router/src/process/turn-execution.js:133-195,205-341`;
- `packages/demo-server/src/session-seam.js:77-166`.

`main` semantics already satisfy:

- live existing handle -> reuse;
- persisted existing Session -> resume;
- absent Session -> create;
- concurrent process startup -> one STARTUP result;
- concurrent first `main` creation -> one `pendingCreations` result;
- two sends -> same Session but two ordered messages/Runs; `requestId` does not deduplicate main
  messages.

No Session subsystem or Scheduler subsystem is needed.

### 3.2 Busy semantics are queue/next-run, not active steering

Current hardening makes **all** prompt-producing paths share one bounded AgentProcess FIFO. A delivery to
busy B:

1. waits in B's parent-owned queue;
2. does not write into or steer B's active Run;
3. is written to `session/prompt` only after the active Run reaches exact terminal/idle;
4. returns inbox receipt only after `followup()` accepts the new message;
5. continues to own the queue until its own Run reaches terminal or `outcome_unknown`.

Evidence: `packages/agent-router/src/process/turn-execution.js:133-195,279-292` and
`packages/agent-router/test/process-delivery.test.js:67-90`.

The early V0 report statement that delivery bypasses single-flight is stale and must not govern V1.

### 3.3 Reconciliation seam

Current main exposes:

```text
agentRouter.getTurnReconciliation(handle)
agentRouter.readFinalAssistantOutput(handle)
agentRouter.onTurnReconciled(listener) -> disposer
agentRouter.turnExecutionSnapshot(handle)
```

A delivery receipt returns its exact `reconciliationHandle`. Final output is accumulated only from events
correlated by watermark + target session + receipt message id + turn number. `readFinalAssistantOutput`
is non-consuming and distinguishes `available`, `pending`, `no_output`, `evicted`, `restart_lost`, and
`never_existed`.

There is no existing Promise helper that safely combines these seams with a timeout. Therefore
`WAIT_REPLY_GAP = YES`, but the gap is an orchestration helper, not a new store or state machine.

### 3.4 Provenance seam

Current path accepts only a string and ultimately constructs:

```js
createUserMessage({
  content: [{ type: 'text', text: message }],
  source: { kind: 'user' },
})
```

Therefore `PROVENANCE_GAP = YES`. A textual prefix such as `[From agent A]` is not provenance: it can be
forged by model input and cannot support audit or authorization.

## 4. Frozen capability contract

### R1 — Capability identity

```text
id = toolName = agent_session_send
operation = send
kind = broker local capability
local.resource = agent-session-messaging
requiredScopes = ['agent.session.send']
```

The existing Broker child relay and execute-time local handler resolution are reused. Current main already
supports local-capability relay; `relay.js` is not an implementation gap. The production composition may
add an `agentSessionMessagingAccess` handler provider to the existing execute-time resolver.

### R2 — Model-visible input is exactly three fields

```text
targetAgentId  string   required  ^agt_[a-z0-9-]+$, 5..128 chars
message        string   required  1..65536 UTF-8 bytes; NUL forbidden; newline/tab allowed
timeoutSeconds integer  required  0..300 inclusive
```

`timeoutSeconds` has no default: omitting it is invalid. The message limit is intentionally below the
Router's current 1 MiB prompt ceiling so one Agent-facing call cannot consume the whole process evidence
budget.

The trusted handler's first action must reject missing, mistyped, out-of-range, NUL-containing, or
undeclared properties before request-id generation, Router delivery, audit success, or any other side
effect. Child validation is defense-in-depth only; direct parent-RPC calls must not bypass authoritative
validation.

The model-visible schema physically excludes:

```text
sessionKey, sessionId, label, sessionMode,
sourceAgentId, sourceSessionRef, principalId,
requestId, correlation, provenance, binding,
channel, replyRoute, workflowInstanceId, reason
```

### R3 — Trusted runtime-derived fields

The trusted parent runtime derives:

```text
sourceAgentId = actual calling AgentProcess agentId
sourceCorrelation = opaque exact source turnExecutionId
requestId = fresh opaque runtime-generated id for this send
sessionMode = 'main'
messageOrigin = {
  kind: 'inter_agent',
  sourceAgentId,
  correlation: sourceCorrelation
}
```

The parent-RPC boundary must extend its trusted invocation context with the exact `rpcMeta.turnExecutionId`
only after proving that it belongs to the actual source AgentProcess generation, is present in that
process's execution map, and is not settled. This correlation path must work for a source Run that itself
originated through delivery; it cannot depend on external `activeIngressContext` being present. Missing or
stale source execution proof fails before Router delivery.

`sourceAgentId`, correlation, requestId, Session selection, credential, Principal, grants, and external
route are never read from tool arguments or message text. `targetAgentId` is only the routing target and
never becomes caller identity.

V1 rejects `targetAgentId === sourceAgentId`. This avoids guaranteed self-deadlock under the current
per-process queue while preserving the intended A→B primitive. Supporting self-next-turn messaging would
require a separately specified queued-receipt contract; it must not be smuggled into `accepted:true`.

### R4 — Minimal generic provenance extension

The Router/session protocol receives one optional, parent-owned message-source sidecar separate from the
string:

```text
agentRouter.deliver(
  { requestId, agentId, sessionMode, message },
  { messageOrigin }                 # trusted control-plane argument, not model input
)

→ route admission opts.messageOrigin
→ AgentProcess prompt opts.messageOrigin
→ session/prompt sibling metadata messageOrigin
→ demo-server createUserMessage(... source = validated messageOrigin)
```

Exact V1 source contract:

```text
kind = inter_agent
sourceAgentId = actual A
correlation = opaque exact runtime-owned source turnExecutionId
```

Every layer must exact-allowlist, bound, detach/freeze, and reject malformed trusted metadata. Unknown
business fields are not forwarded. Existing callers that omit the sidecar retain `source:{kind:'user'}`.
The extension is generic protocol metadata; Router must not learn Workflow, Forum, Feishu, or Scheduler
semantics.

If the pinned DSH message-source type requires declaration augmentation, implementation may add the
smallest merge-extensible `inter_agent` source declaration in Agent Core's integration boundary. It must
not encode provenance only in prompt text and must not require a new Session subsystem.

### R5 — Execution identity remains the target Agent

For the Run created in B:

```text
message provenance sourceAgentId = A
execution callerAgentId = B
credential selected = B credential
Principal / grants = B Principal / grants
workspace = B workspace
```

A's identity is origin metadata only. It is forbidden as credential selector, Principal, impersonation,
OBO token, or grant inheritance. Existing parent-RPC and Broker behavior remains authoritative:

- parent Router derives caller from the actual process spawning relationship;
- child self-reported identity fields are ignored;
- gateway loads credentials by actual caller Agent id;
- Auth remains the sole grant authority.

### R6 — Authorization

`agent.session.send` is independent from all Session read/list/history permissions. Missing credential,
invalid credential, denied grant, invalid/disabled target, or invalid input fails closed before delivery.

V1 defines only capability-level send authorization. It does not create a per-target ACL language. A
caller without the exact send grant has zero Router delivery calls and zero target Session mutation.
Possession of the send grant does not imply permission to:

- list B Sessions;
- read B history;
- name any B Session;
- inspect B reconciliation records;
- use B credential or grants.

### R7 — timeoutSeconds = 0

```text
call Router deliver(main)
→ wait until the exact session/prompt receipt proves inbox acceptance
→ return { status: 'accepted' }
```

It does not wait for model start, model completion, idle, or reply. “Fire-and-forget” means reply is not
awaited; it does not permit fabricating acceptance before a real receipt. If B is busy, the call may remain
pending behind B's existing bounded FIFO until the message reaches the inbox or admission fails.

The result does not expose requestId, Session id, source identity, Principal, or reconciliation handle.
The runtime retains the handle for audit/reconciliation.

### R8 — timeoutSeconds > 0

After the real inbox receipt, the handler waits for the exact returned reconciliation handle. The timeout
is a reply-wait bound and starts at receipt; it does not alter Router's existing admission and turn
deadlines.

Success result:

```text
{ status: 'replied', reply: <one aggregated final assistant output string> }
```

“One reply” means one tool result containing the exact Run's complete aggregated assistant text. It does
not mean the Run emitted only one assistant event. `readFinalAssistantOutput().state='available'` alone is
not sufficient proof: the helper must inspect both terminal state and truncation metadata.

Closed mapping:

```text
available + terminalState in {completed, late_completed} + truncated=false
  -> {status:'replied', reply:text}

available + truncated=true
  -> reply_unavailable(reason=truncated)

available + terminalState in {failed, late_failed}
  -> target_run_failed                  # retained text is not returned as success

no_output + terminalState in {completed, late_completed}
  -> reply_unavailable(reason=no_output)

no_output + terminalState in {failed, late_failed}
  -> target_run_failed

not_admitted
  -> not_admitted

evicted | restart_lost | never_existed
  -> reply_unavailable(reason=<state>)

pending
  -> continue waiting until event or reply deadline
```

Thus a bounded tail with `truncated:true` is never silently called the exact reply, and text emitted before
a failed Run never becomes a successful tool result.

The handler must not replay the message, open a second Session, prompt A, prompt B again, or deliver to an
external channel. On reply-wait timeout:

```text
{ status: 'timeout' }
```

The timeout stops only A's wait. It does not cancel B's Run, active-steer it, or later push its output to A,
Feishu, Forum, or any other Product Surface. A later explicit tool call is a new send and a new Run.

Terminal failure/no output/evicted/restart-lost states return distinct structured failures; none is
silently converted to an empty reply or success.

### R9 — Race-safe wait helper

A thin helper over the existing sole reconciliation authority is required:

```text
waitForFinalAssistantReply(handle, deadline)
1. readFinalAssistantOutput(handle)
2. if terminal, settle immediately
3. subscribe onTurnReconciled and filter exact handle
4. read again after subscription to close read→subscribe race
5. install remaining-deadline timer
6. on matching event, read authoritative output again
7. before declaring timeout, perform one final read
8. settle through one once-guard
9. clear timer and dispose listener on every exit path
```

The helper owns no second output cache, no durable state, no poll loop, and no external delivery. A control
plane restart may produce `restart_lost`; V1 does not add reconciliation persistence.

### R10 — Busy, queue, and cycle behavior

```text
ACTIVE_RUN_STEERING = NO
BUSY_POLICY = EXISTING_BOUNDED_FIFO_NEXT_RUN
QUEUE_RECEIPT_IS_INBOX_RECEIPT = NO
AUTO_REPLAY_AFTER_FENCE = NO
```

Only the real `session/prompt` receipt is reported as `accepted`. Parent queue admission alone must never
be mislabeled accepted. Queue-cap or fence rejection gives zero target prompt bytes.

Automatic A→B→A→B ping-pong is forbidden. V1 performs exactly one outbound admission and at most one
reply wait. Explicit cyclic Agent tool calls can still contend on existing queues; V1 adds no cycle solver,
watch loop, or active-run steering. Self-send is rejected by R3.

### R11 — External delivery and Binding isolation

A2A uses generic `deliver`, never `onIngress`. It must not:

- resolve, create, update, or switch ChannelConversation Binding;
- set `activeBindingContext` or external ingress context;
- synthesize Feishu chat/conversation/message ids;
- call `feishu.reply`;
- copy an external reply target into B's Run;
- create Forum posts, Scheduler Jobs, or Workflow state.

An ancestry trace may record that A's turn originally came from an external ingress, but it is read-only
telemetry and cannot participate in routing or reply decisions. Existing external routes remain unchanged.

### R12 — Audit

Audit uses a two-level, two-phase contract.

**L0 Broker evidence** records validation, credential, and grant denials that occur before the local handler.
**L1 capability evidence** is bounded and secret-free:

```text
kind = agent_session_send
phase = intent | outcome
sourceAgentId
targetAgentId
runtime request/correlation hash or opaque id
timeoutMode = receipt_only | wait_reply
result = accepted | replied | timeout | denied | failed   # outcome only
reconciliationHandle (internal outcome evidence only)
timestamps / duration
```

Commit order is frozen:

1. after authoritative argument/auth checks and before Router delivery, append L1 `intent`;
2. if the intent append fails, return `internal_error` with Router delivery count zero;
3. call Router delivery;
4. after a real receipt or definitive pre-receipt failure, append the corresponding L1 `outcome`;
5. for wait mode, append the final `replied`, `timeout`, or structured failure outcome.

A real inbox receipt is irreversible. If an outcome append fails after receipt, the already-proven business
result remains `accepted`, `replied`, `timeout`, or its exact terminal failure; it must not be rewritten as
`not_admitted` or `outcome_unknown`. The successful intent row plus an operations-visible sanitized
append-failure signal makes the audit degradation visible without falsifying delivery. V1 does not add an
`auditStatus` field to model-visible business envelopes.

Message text, credentials, token material, full Session history, and external reply targets are excluded.

## 5. Result and error contract

Model-visible success envelopes are closed:

```text
timeoutSeconds = 0:
  { status: 'accepted' }

timeoutSeconds > 0 and exact reply available:
  { status: 'replied', reply: string }

timeoutSeconds > 0 and reply bound expires:
  { status: 'timeout' }
```

Required structured error classes:

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
outcome_unknown
target_run_failed
reply_unavailable
internal_error
```

Error translation must preserve the distinction between proven zero delivery and unknown outcome. No
error path automatically retries a message whose admission may have occurred.

## 6. Explicit non-goals

V1 does not support:

- arbitrary `sessionKey`, `sessionId`, label, historical Session targeting, Session listing, or history
  read;
- fresh Session or per-task Session creation;
- active-run steering, interruption, cancellation, or watch;
- automatic announce to Feishu, Forum, Workflow, Scheduler, or any external channel;
- Scheduler Job creation or Workflow-specific fields;
- caller-supplied source identity, Principal, credential, grant, requestId, or provenance;
- OBO/impersonation or grant inheritance;
- self-send;
- automatic multi-turn ping-pong;
- streaming multiple replies;
- durable wait recovery across control-plane restart;
- new Session, Scheduler, Workflow, Forum, mailbox, or external-delivery subsystem.

## 7. Acceptance scenarios

### Case A — existing B main

```text
GIVEN B main exists
WHEN A sends one message to B
THEN sessionId remains B main
AND no new Session is created
AND exactly one new B Run/Turn is admitted for the send
```

### Case B — absent B main and concurrent first sends

```text
GIVEN B main does not exist
WHEN concurrent authorized Agents first send to B
THEN exactly one B process startup generation is shared
AND exactly one B main Session is created
AND every accepted send is a distinct ordered Run/Turn in that same main
```

### Case C — receipt-only

```text
GIVEN timeoutSeconds=0
WHEN the target inbox returns its real receipt
THEN the tool returns {status:'accepted'} without waiting for reply/idle/completion
AND a parent-queue-only receipt is never accepted
```

### Case D — one bounded reply

```text
GIVEN timeoutSeconds>0
WHEN this exact B Run completes with assistant output before the reply deadline
THEN the tool returns exactly one {status:'replied', reply}
AND no second A→B, B→A, or external delivery is automatically triggered
```

### Case E — B busy

```text
GIVEN B has an active Run
WHEN A sends to B
THEN B's active Run is not steered
AND the message follows existing bounded FIFO next-Run semantics
AND accepted is returned only after real inbox receipt
AND positive timeout reply deadline starts at that receipt, so pre-receipt queue time does not consume it
AND timeoutSeconds=0 also returns only after that receipt
AND queue cap/fence rejection causes no target prompt write
```

### Case F — unauthorized sender

```text
GIVEN A lacks agent.session.send authorization
WHEN A targets B
THEN result is access_denied
AND Broker handler/Router delivery/target Session mutation counts are all zero
```

### Case G — unforgeable provenance

```text
GIVEN A sends arbitrary message text and forbidden extra arguments
WHEN B receives an accepted message
THEN durable source.kind = inter_agent
AND source.sourceAgentId = actual A
AND correlation is runtime-owned
AND no model argument or text can alter those fields
```

### Case H — target-owned execution identity

```text
GIVEN B handles A's message and calls a Broker tool
THEN parent callerAgentId = B
AND B credential/Principal/grants are used
AND A credential/Principal/grants are never selected or inherited
```

### Case I — external route isolation

```text
GIVEN A's source turn may have originated from Feishu or another surface
WHEN A sends to B
THEN every existing Binding and external reply route is byte-for-byte unchanged
AND B's reply returns only through this tool wait result when requested
AND no Feishu/Forum/Scheduler/Workflow delivery occurs
```

### Additional mandatory cases

- self-send fails before Router delivery;
- two sends with different runtime request ids create two Runs in one main, not one deduplicated Run;
- already-settled-before-subscribe and settle-between-read-and-subscribe both return the same exact reply;
- timeout/event race settles tool result exactly once and always disposes listener/timer;
- `failed`, `late_failed`, `no_output`, `truncated`, `evicted`, `restart_lost`, and `never_existed`
  never become successful replies;
- an Agent whose source Run itself came from A2A can send onward with an exact runtime-proven source-turn
  correlation, without propagating Binding or external-route leaves;
- L1 intent append failure causes zero Router deliveries; outcome append failure after receipt preserves the
  proven business result and emits operations-visible degradation;
- target reply-wait timeout does not cancel, replay, announce, or externally deliver the late result.

## 8. Predicted implementation scope — not authorized

Only after this Spec is independently reviewed, Owner-accepted, and present in the exact implementation
base that already contains accepted/current D-008 may its bounded `implementation_authority: contracts`
activate. Predicted code scope is:

```text
packages/broker
  - agent_session_send local capability manifest and inventory tests
  - reuse existing local relay
  - authoritative trusted-handler validation tests

packages/production-runtime
  - agentSessionMessagingAccess local handler provider/wiring
  - trusted request/correlation generation
  - exact grant/error/audit mapping
  - thin race-safe reconciliation wait helper

packages/agent-router
  - exact source-turn proof in trusted parent-RPC context
  - optional trusted messageOrigin sidecar through deliver/route/process prompt path
  - strict propagation and identity-isolation tests
  - no Session or Scheduler subsystem

packages/demo-server
  - validated session/prompt messageOrigin mapping to inter_agent message source
  - create/resume/concurrency/provenance tests

integration tests
  - Cases A–I and additional mandatory cases
```

Current main already contains the local capability relay fix and execute-time local handler resolver
mechanism identified during PR #130 research. No `relay.js` repair should be reintroduced unless a fresh
current-main audit finds a new defect.

```text
KERNEL_CHANGE = EXPECTED_NONE
SESSION_SUBSYSTEM_CHANGE = NONE
SCHEDULER_SUBSYSTEM_CHANGE = NONE
PRODUCT_CODE_CHANGE = NONE   # this authoring task
PRODUCTION_CHANGE = NONE
```

## 9. Reused and retired agent_wake research

### Reused

```text
REUSED_AGENT_WAKE_RESEARCH =
- Broker local capability manifest / child relay / parent gateway shape
- execute-time local handler resolution to avoid sibling-load races
- caller identity from actual AgentProcess spawning relationship
- credential -> scope/grant -> local handler fail-closed ordering
- targetAgentId is route target, never caller identity
- trusted-side request/correlation generation
- full authoritative validation at parent handler boundary
- Router error translation and bounded control-plane audit discipline
- no workspace mutation, no external delivery, no direct process spawn
```

### Retired

```text
agent_wake
workflowInstanceId
reason
sessionMode=fresh
wdhr1 request formula
workflow dispatcher-only caller model
fresh-session dedupe key
wake-specific audit/canary/prompt template
```

## 10. Review gate and final fields

Independent review must specifically decide:

1. exact alignment with accepted/current D-008, including canonical-main Messaging while Delegation and
   Cron retain their separate non-main semantics;
2. the frozen `timeoutSeconds=0..300` bound and receipt-relative reply deadline;
3. exact DSH `inter_agent` message-source augmentation at the pinned runtime version;
4. whether self-send rejection is sufficient for V1 queue safety;
5. error mapping for Router `outcome_unknown` and reply reconciliation absence states.

```text
TASK_NAME = 会话 执行
OPENCLAW_MODEL = reuse target Agent main Session; each send creates one new Run/Turn, not one new Session; timeout=0 returns after receipt, timeout>0 may wait for that exact Run's one reply
CURRENT_ROUTER_REUSE = PARTIAL
PROVENANCE_GAP = YES
WAIT_REPLY_GAP = YES
PROPOSED_SPEC = AGENT_CORE_AGENT_SESSION_MESSAGING_V1
SPEC_STATUS = proposed
SOURCE_R2_SHA256 = 20820492d1b65842b0c607ee013baca1d5a3d6377b072d8914405eabff99d169
FRESH_AUTHORING_BASE = 433b8bd06a163badae322da9db012b9851e148b6
DECISION_ALIGNMENT_STATUS = SATISFIED_BY_D008
PR130_DISPOSITION = CLOSE
IMPLEMENTATION_AUTHORITY_ON_ACCEPTANCE = contracts
ACTIVE_IMPLEMENTATION_AUTHORITY_WHILE_PROPOSED = NONE
OWNER_ACCEPTANCE_REQUIRED = YES
IMPLEMENTATION_SCOPE = Broker local capability + trusted provenance sidecar + thin reconciliation wait helper + production wiring/tests; no new Session/Scheduler subsystem
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 会话 审计
```
