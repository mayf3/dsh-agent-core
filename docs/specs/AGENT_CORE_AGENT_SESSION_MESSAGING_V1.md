---
spec_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: none
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

## 1. Goal and problem

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

The Goal is to define exactly one generic, private, authenticated Agent-to-Agent Messaging capability
whose Session, Run, provenance, execution-identity, timeout, failure, and audit behavior is complete enough
to implement without hidden chat context. This Goal does not itself authorize implementation; only the
lifecycle gate in §8C can do so after independent review and Owner acceptance.

## 1A. Scope and non-goals

In scope is only the capability summarized by the frontmatter `scope` list and frozen by `R1`–`R12`:
`agent_session_send`, target canonical-main reuse, one new Run/Turn per send, runtime-owned provenance,
target-owned execution identity, receipt-only and bounded one-reply modes, authorization, reconciliation,
failure mapping, and audit.

Out of scope is the unchanged list in §6, including arbitrary Session targeting, fresh Messaging Sessions,
Delegation, Scheduler/Cron execution, active-run steering, watch/announce/replay, external delivery,
impersonation/OBO, self-send, automatic ping-pong, durable restart recovery, and any new subsystem. This
section indexes §6 and does not add, remove, or reinterpret a non-goal.

## 2. Authority, dependencies, and disposition

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

## 3. Current State and current-main findings

- `STATE-MSG-001` — At `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`,
  accepted/current D-008 is the controlling product-model authority: Messaging targets the target Agent's
  canonical main while Delegation and Cron retain their distinct non-main models. Basis: `OBS-MSG-001`,
  `CLM-MSG-001`, `EVD-MSG-001`.
- `STATE-MSG-002` — At the same source revision, current Router/demo-server behavior already supplies
  canonical-main selection, existing-main reuse, absent-main establishment, ordered next-Run delivery, and
  bounded reconciliation state. Basis: `OBS-MSG-002`, `OBS-MSG-003`, `CLM-MSG-002`, `CLM-MSG-003`,
  `EVD-MSG-002`, `EVD-MSG-003`.
- `STATE-MSG-003` — At the same source revision, exact trusted `inter_agent` provenance propagation and a
  race-safe bounded exact-reply wait helper remain implementation gaps. Basis: `OBS-MSG-003`,
  `OBS-MSG-004`, `CLM-MSG-003`, `CLM-MSG-004`, `EVD-MSG-003`, `EVD-MSG-004`.
- `STATE-MSG-004` — At proposed publication head
  `54d3145258c8798e29c1688c1cb93b3647fe3de7`, the content-addressed source r2 normative span was preserved
  byte-for-byte and carried no implementation or production authority. Basis: `OBS-MSG-005`,
  `CLM-MSG-005`, `EVD-MSG-005`, plus the exact frontmatter provenance in this Spec.
- `STATE-MSG-005` — At `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`,
  accepted Process Lifecycle authority defines `terminated_without_outcome` as a terminal reconciliation
  state distinct from success and failure; reviewed proposed head
  `361540bc3799bb7166c0bf6592826a0573b6c95e` did not classify it and contained overlapping R8 predicates.
  Basis: `OBS-MSG-006`, `CLM-MSG-006`, `EVD-MSG-006`.
- `STATE-MSG-006` — At the same repository revision, the generic non-Scheduler child relay converts any
  parent-RPC rejection/channel loss to `invalid_arguments`, even though the parent handler and B delivery may
  already have occurred. This is an implementation gap for `agent_session_send`, not reusable correct
  behavior. Basis: `OBS-MSG-007`, `CLM-MSG-007`, `EVD-MSG-007`.

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

## 3A. Observations

### OBS-MSG-001 — D-008 is accepted/current and explicitly aligns source r2

- Subject: `AGENT_WORKSPACE_SESSION_MODEL_V3` and the repository Current Decision index.
- Source revision: `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`.
- Environment: fresh, clean, detached repository worktree; documentation authority inspection only.
- Observed at: `2026-08-31T23:00:34Z`.
- Method: inspect D-008 frontmatter, §27.7, §27.8, and `docs/decisions/README.md` at the exact revision.
- Result: D-008 is accepted/current; §27.7 records content-addressed source r2 alignment `PASS` without
  accepting or authorizing this implementation Spec; §27.8 fixes PR #130 disposition to `CLOSE`.
- Provenance: `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3.md` and
  `docs/decisions/README.md` at the source revision above.

### OBS-MSG-002 — Current main already owns canonical-main delivery mechanics

- Subject: Agent Router delivery, AgentProcess turn execution, and demo-server main-Session seam.
- Source revision: `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`.
- Environment: source/test inspection in the same fresh worktree; no production or live Agent invocation.
- Observed at: `2026-08-31T23:00:34Z`.
- Method: inspect `packages/agent-router/src/ingress-delivery.js:173-285`,
  `packages/agent-router/src/process/turn-execution.js:133-341`,
  `packages/demo-server/src/session-seam.js:77-166`, and the existing process-delivery tests.
- Result: `sessionMode='main'` selects logical main, starts/reuses the target process, resumes or creates
  target main, single-flights concurrent creation, and admits distinct ordered prompt executions.
- Provenance: exact files and line coordinates listed above at the source revision.

### OBS-MSG-003 — Reconciliation exposes bounded authoritative state but no bounded wait helper

- Subject: Agent Router turn-reconciliation interface and retained final-output projection.
- Source revision: `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`.
- Environment: source/test inspection in the same fresh worktree; no production state read or write.
- Observed at: `2026-08-31T23:00:34Z`.
- Method: inspect the exact reconciliation handle returned by delivery, `getTurnReconciliation`,
  `readFinalAssistantOutput`, `onTurnReconciled`, and `turnExecutionSnapshot` definitions and tests.
- Result: the Router distinguishes pending, complete, failed, truncated, evicted, restart-lost, and absent
  outcomes, but has no Promise helper that closes the read/subscribe race under one reply deadline.
- Provenance: `packages/agent-router/src/ingress-delivery.js`,
  `packages/agent-router/src/process/turn-execution.js`, and their tests at the source revision.

### OBS-MSG-004 — Current prompt path cannot carry trusted inter-Agent provenance

- Subject: Router `deliver` through demo-server `createUserMessage` prompt construction.
- Source revision: `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`.
- Environment: source inspection in the same fresh worktree; no runtime mutation.
- Observed at: `2026-08-31T23:00:34Z`.
- Method: trace the message parameter from Router admission to `session/prompt` and `createUserMessage`.
- Result: the path carries only string content and constructs `source:{kind:'user'}`; it has no trusted,
  structured `inter_agent` sidecar or exact source-turn correlation.
- Provenance: the code excerpt and file coordinates in §3.4 at the source revision.

### OBS-MSG-005 — Source r2 normative span is content-addressed and preserved

- Subject: local source r2 and its proposed publication at
  `54d3145258c8798e29c1688c1cb93b3647fe3de7`.
- Artifact revisions: source r2 SHA-256
  `20820492d1b65842b0c607ee013baca1d5a3d6377b072d8914405eabff99d169`; proposed publication Git blob
  `99335fc8df7811bde4847d3e132bab3d0fb14343`.
- Environment: read-only local source plus fresh PR-head worktree.
- Observed at: `2026-08-31T23:00:34Z`.
- Method: hash the complete source, then byte-compare from `## 4. Frozen capability contract` through the
  byte immediately before `## 8. Predicted implementation scope — not authorized`.
- Result: the 17,143-byte source/publication span is byte-identical with SHA-256
  `f1af8b47ee64238118cd0ac13b67a8b27f2d4c601395611a9ec88dec5f8215a8`.
- Provenance: D-008 §27.7, this Spec's frontmatter, the content-addressed local source r2, and PR #133 head
  `54d3145258c8798e29c1688c1cb93b3647fe3de7`.

### OBS-MSG-006 — Reviewed R8 classification is not exhaustive or mutually exclusive

- Subject: accepted `AGENT_PROCESS_LIFECYCLE_HARDENING_V2` reconciliation model and R8 at reviewed PR #133
  head `361540bc3799bb7166c0bf6592826a0573b6c95e`.
- Source revisions: `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6` and proposed head
  `361540bc3799bb7166c0bf6592826a0573b6c95e`.
- Environment: fresh, clean, independent documentation worktree; no runtime or production mutation.
- Observed at: `2026-08-31T23:26:32Z`.
- Method: compare Process Lifecycle C-015–C-019 and `readFinalAssistantOutput` with the R8 closed mapping,
  then enumerate `outputState × terminalState × truncated` predicates.
- Result: accepted authority includes terminal `terminated_without_outcome`; R8 omitted it. R8 also mapped
  every `available + truncated=true` to `reply_unavailable` while separately mapping
  `available + terminalState in {failed,late_failed}` to `target_run_failed`, so failed/late-failed retained
  output with `truncated=true` matched both branches.
- Provenance: `docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V2.md` C-015–C-019 and
  `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md` R8 at the stated commits.

### OBS-MSG-007 — Generic relay currently misclassifies ambiguous non-Scheduler loss

- Subject: child-side Broker relay and its fixed behavior tests for non-Scheduler capabilities.
- Source revision: `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`.
- Environment: fresh, clean source worktree; source/test inspection only; no Broker or Agent invocation.
- Observed at: `2026-08-31T23:26:32Z`.
- Method: inspect `packages/broker/src/relay.js:157-195` and
  `packages/broker/test/relay.test.js:87-100,119-127`, then compare Scheduler mutation-loss handling in
  `packages/broker/test/scheduler-capability.test.js:123-166`.
- Result: for every non-Scheduler capability, a rejected parent request or missing/unstructured response is
  returned as `invalid_arguments`; only Scheduler mutations preserve ambiguity as
  `mutation_outcome_unknown`. The relay therefore cannot distinguish proven pre-handler invalid input from a
  parent-RPC deadline/channel loss after possible handler execution and target delivery.
- Provenance: exact code/tests and line coordinates above at the stated revision.

## 3B. Claims and assumptions

### CLM-MSG-001 — The frozen Messaging model conforms to D-008

- Support state: `SUPPORTED`.
- Supported by evidence: `EVD-MSG-001`.
- Contradicted by evidence: none known.
- Uncertainty: D-008 alignment is product-model authority only; it does not prove implementation
  conformance or grant implementation authority.

### CLM-MSG-002 — Existing main delivery mechanics are the correct bounded reuse seam

- Support state: `SUPPORTED`.
- Supported by evidence: `EVD-MSG-002`.
- Contradicted by evidence: none known.
- Uncertainty: source/test inspection establishes the pinned revision only; future source drift requires a
  new implementation-base conformance check.

### CLM-MSG-003 — Exact-reply waiting is a thin orchestration gap, not a new state authority

- Support state: `SUPPORTED`.
- Supported by evidence: `EVD-MSG-003`.
- Contradicted by evidence: none known.
- Uncertainty: implementation must still demonstrate the frozen race, deadline, truncation, and terminal
  mappings through executed tests.

### CLM-MSG-004 — Structured trusted provenance is required and prompt text is insufficient

- Support state: `SUPPORTED`.
- Supported by evidence: `EVD-MSG-004`.
- Contradicted by evidence: none known.
- Uncertainty: the exact DSH declaration-augmentation seam must be verified at the pinned implementation
  dependency revision without expanding the protocol boundary.

### CLM-MSG-005 — Governance remediation can preserve source r2 normative meaning

- Support state: `SUPPORTED`.
- Supported by evidence: `EVD-MSG-005`.
- Contradicted by evidence: none known.
- Uncertainty: any future byte delta inside the frozen span invalidates this Claim and requires a fresh
  semantic review against the content-addressed source.

### CLM-MSG-006 — R8 requires one authoritative exhaustive classification supplement

- Support state: `SUPPORTED`.
- Supported by evidence: `EVD-MSG-006`.
- Contradicted by evidence: none known.
- Uncertainty: none for the accepted lifecycle states and exact reviewed R8 predicates; future lifecycle
  authority changes require a fresh alignment review.

### CLM-MSG-007 — Ambiguous relay loss cannot truthfully be invalid arguments

- Support state: `SUPPORTED`.
- Supported by evidence: `EVD-MSG-007`.
- Contradicted by evidence: none known.
- Uncertainty: source inspection does not determine whether any particular lost call reached B; that exact
  inability to prove delivery or non-delivery is the `outcome_unknown` condition.

`OPEN_ASSUMPTION = NONE`; no unsupported assumption changes authority or Contract meaning.

## 3C. Evidence relations

### EVD-MSG-001 — D-008 observations support the model-alignment Claim

- Source observations: `OBS-MSG-001`.
- Target: `CLM-MSG-001`.
- Relation: `SUPPORTS`.
- Bound coordinates: `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`, D-008
  §27.7/§27.8, documentation worktree, observed `2026-08-31T23:00:34Z`.
- Strength/sufficiency: sufficient for canonical-main Messaging, distinct Delegation/Cron Session classes,
  content-addressed r2 alignment, and PR #130 disposition.
- Limitations: does not accept this proposed Spec and does not establish code/runtime conformance.
- Provenance: `OBS-MSG-001` sources.

### EVD-MSG-002 — Delivery observations support reuse of current main mechanics

- Source observations: `OBS-MSG-002`.
- Target: `CLM-MSG-002`.
- Relation: `SUPPORTS`.
- Bound coordinates: source/test files at
  `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`, observed
  `2026-08-31T23:00:34Z` in the fresh source worktree.
- Strength/sufficiency: sufficient to select the existing Router/process/demo-server seam rather than a new
  Session or Scheduler subsystem.
- Limitations: source inspection is not production evidence and does not prove a future implementation.
- Provenance: `OBS-MSG-002` sources.

### EVD-MSG-003 — Reconciliation observations support the bounded-helper Claim

- Source observations: `OBS-MSG-003`.
- Target: `CLM-MSG-003`.
- Relation: `SUPPORTS`.
- Bound coordinates: Agent Router reconciliation source/tests at
  `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`, observed
  `2026-08-31T23:00:34Z`.
- Strength/sufficiency: sufficient to identify both the authoritative state seam and the missing race-safe
  wait orchestration.
- Limitations: the proposed helper remains unimplemented and requires executed race/fault tests.
- Provenance: `OBS-MSG-003` sources.

### EVD-MSG-004 — Prompt-path observations support the provenance-gap Claim

- Source observations: `OBS-MSG-004`.
- Target: `CLM-MSG-004`.
- Relation: `SUPPORTS`.
- Bound coordinates: Router-to-demo-server prompt path at
  `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`, observed
  `2026-08-31T23:00:34Z`.
- Strength/sufficiency: sufficient to reject a text-prefix provenance design and require a trusted structured
  sidecar bounded by R3/R4.
- Limitations: does not select an external repository type change or authorize dependency modification.
- Provenance: `OBS-MSG-004` sources.

### EVD-MSG-005 — Content hashes support preservation of the frozen normative body

- Source observations: `OBS-MSG-005`.
- Target: `CLM-MSG-005`.
- Relation: `SUPPORTS`.
- Bound coordinates: source r2 SHA-256
  `20820492d1b65842b0c607ee013baca1d5a3d6377b072d8914405eabff99d169`, PR #133 reviewed head
  `54d3145258c8798e29c1688c1cb93b3647fe3de7`, observed `2026-08-31T23:00:34Z`.
- Strength/sufficiency: byte-level proof for R1–R12, result/error, non-goals, and original Acceptance scenarios.
- Limitations: does not cover lifecycle/grammar material outside the 17,143-byte span and becomes stale if
  that span changes.
- Provenance: `OBS-MSG-005` sources and recorded digests.

### EVD-MSG-006 — Lifecycle comparison supports a binding R8 classification supplement

- Source observations: `OBS-MSG-006`.
- Target: `CLM-MSG-006`.
- Relation: `SUPPORTS`.
- Bound coordinates: accepted Process Lifecycle at
  `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`, proposed Messaging head
  `361540bc3799bb7166c0bf6592826a0573b6c95e`, observed `2026-08-31T23:26:32Z`.
- Strength/sufficiency: direct finite-state comparison proves one missing terminal class and one overlapping
  predicate; sufficient to require the explicit matrix in §8A.
- Limitations: evaluates the proposed Contract text, not an implementation or production runtime.
- Provenance: `OBS-MSG-006` sources.

### EVD-MSG-007 — Relay source and tests support the ambiguous-loss gap Claim

- Source observations: `OBS-MSG-007`.
- Target: `CLM-MSG-007`.
- Relation: `SUPPORTS`.
- Bound coordinates: Broker relay source/tests at
  `mayf3/dsh-agent-core@433b8bd06a163badae322da9db012b9851e148b6`, observed
  `2026-08-31T23:26:32Z`.
- Strength/sufficiency: direct branch and assertion evidence establishes current non-Scheduler
  `invalid_arguments` behavior and its contrast with Scheduler mutation uncertainty.
- Limitations: does not prove whether any individual lost request reached B and grants no permission to edit
  relay code in this docs-only task.
- Provenance: `OBS-MSG-007` sources.

## 3D. Decisions

### DEC-MSG-001 — Use canonical-main Messaging, not fresh execution

- Decision owner: repository Owner through accepted/current D-008; this child Spec remains proposed.
- Decision: `agent_session_send` targets only the target Agent's canonical main and each send creates one new
  Run/Turn in that logical main, as frozen by R1–R4 and R10.
- Rejected alternatives: `agent_wake`, arbitrary Session targeting, new Session per message, or reuse of
  Delegation/Cron non-main models.
- Reason: preserve the D-008 product-model boundary and reuse the current main delivery seam.
- Owner input remaining: exact-head Spec acceptance only; no unresolved normative choice.

### DEC-MSG-002 — Separate source provenance from target execution identity

- Decision owner: repository Owner through accepted/current D-008 alignment; this child Spec remains proposed.
- Decision: runtime-owned source Agent/turn provenance accompanies the message while B's own credential,
  Principal, grants, and workspace govern B's execution, as frozen by R3–R6.
- Rejected alternatives: prompt-text provenance, caller-supplied provenance, A impersonation/OBO, credential
  selection from message origin, or grant inheritance.
- Reason: make origin auditable without crossing the target Agent security boundary.
- Owner input remaining: exact-head Spec acceptance only; no unresolved normative choice.

### DEC-MSG-003 — Use receipt-only or one bounded exact reply

- Decision owner: repository Owner through D-008 alignment and the preserved lifecycle authority; this child
  Spec remains proposed.
- Decision: timeout zero waits for a real inbox receipt; positive timeout waits from receipt for the exact
  Run's complete successful non-truncated final output through the sole reconciliation authority, as frozen
  by R7–R10.
- Rejected alternatives: parent-queue acceptance, active steering, poll stores, retries/replay, watch,
  cancellation of B, multiple replies, or late external announcement.
- Reason: preserve exact admission/outcome truth and bounded caller waiting without a second state machine.
- Owner input remaining: exact-head Spec acceptance only; no unresolved normative choice.

### DEC-MSG-004 — Keep external delivery isolated and audit intent/outcome

- Decision owner: repository Owner; this child Spec remains proposed.
- Decision: no Binding/Product-Surface mutation occurs, and bounded secret-free two-level intent/outcome audit
  behavior remains exactly as frozen by R11/R12.
- Rejected alternatives: `onIngress`, copied external reply routes, Feishu/Forum/Workflow/Scheduler delivery,
  message-content audit, or rewriting a proven receipt because of a later audit append failure.
- Reason: keep the capability private, generic, non-forgeable, and operationally reconcilable.
- Owner input remaining: exact-head Spec acceptance only; no unresolved normative choice.

### DEC-MSG-005 — Classify terminal outcome before output availability or truncation

- Decision owner: repository Owner; this child Spec remains proposed.
- Decision: §8A is the binding, mutually exclusive, exhaustive interpretation of R8. Terminal outcome is the
  primary classification axis; output availability and `truncated` qualify only that outcome. In particular,
  failed/late-failed always map to `target_run_failed`, while `terminated_without_outcome` always preserves
  `outcome_unknown`, regardless of retained or truncated text.
- Rejected alternatives: output-state-first predicates that overlap terminal failure, omitting
  `terminated_without_outcome`, treating captured text as success, or treating proven termination as a proven
  business failure.
- Reason: preserve the accepted Process Lifecycle distinction between outcome evidence, termination evidence,
  and bounded final-output retention.
- Owner input remaining: exact-head Spec acceptance only; no unresolved normative choice.

### DEC-MSG-006 — Parent-RPC ambiguity is outcome unknown and never auto-retried

- Decision owner: repository Owner; this child Spec remains proposed.
- Decision: `invalid_arguments` is permitted only for authoritative validation rejection that proves zero
  parent-handler execution and zero Router/target delivery. Once the child relay's request may have entered the
  parent-RPC channel, deadline, channel loss, missing response, or malformed/unstructured response that cannot
  prove zero execution must return `outcome_unknown`; automatic retry/re-invocation/replay count is zero.
- Rejected alternatives: current generic non-Scheduler `invalid_arguments` fallback, guessing non-delivery,
  silently retrying, or deduplicating a later explicit call as though it were the original send.
- Reason: B may already have received and executed the message; false invalid-input classification invites a
  duplicate send and contradicts the accepted Process Lifecycle unknown-outcome discipline.
- Owner input remaining: exact-head Spec acceptance only; no unresolved normative choice.

`DEC-MSG-001`–`DEC-MSG-004` index the unchanged source-r2 Contracts. `DEC-MSG-005` and `DEC-MSG-006`
provide the binding parent-authority clarifications required by independent review, outside the byte-frozen
source span; they do not change its bytes or broaden capability scope.

## 3E. Contracts

`R1` through `R12` in §4 are the twelve stable Contract IDs for this Spec; their global identities are
`AGENT_CORE_AGENT_SESSION_MESSAGING_V1#R1` through
`AGENT_CORE_AGENT_SESSION_MESSAGING_V1#R12`. The closed success/error envelopes in §5 and the explicit
non-goals in §6 qualify those Contracts and remain part of their frozen meaning. Contract IDs must not be
renumbered or reused after acceptance. Formal Acceptance mappings are recorded after the unchanged source
span in §8B.

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

## 8A. Binding R8 reconciliation classification and relay-ambiguity discipline

This section is a normative clarification of R2, R7, R8, R10, and R12 under accepted Process Lifecycle
authority. It preserves the frozen source-r2 bytes while closing the reviewed result-classification and
parent-RPC ambiguity gaps. It adds no API field, retry mechanism, Session mode, public reconciliation
surface, or implementation authority.

### 8A.1 Admission and child-to-parent relay classification

The capability first classifies whether execution is proven impossible or may already have occurred:

```text
authoritative child-side schema rejection before parent-RPC request write
  -> invalid_arguments; parent handler count=0; Router delivery count=0; target mutation count=0

authoritative parent-side credential/grant/target/input rejection with proven zero Router delivery
  -> exact structured denial/error; Router delivery count=0; target mutation count=0

parent-RPC request proven not written, or proven rejected before parent handler entry with zero execution
  -> not_admitted(reason=parent_rpc_not_sent); Router delivery count=0; target mutation count=0

parent returns proven not_admitted / zero target prompt bytes
  -> not_admitted

real target inbox receipt returned
  -> admission proven; timeoutSeconds=0 returns accepted; timeoutSeconds>0 enters exact-handle reply wait

parent-RPC request may have been written, but deadline/channel loss/missing or malformed transport envelope
prevents proof of either parent-handler non-execution or target non-delivery
  -> outcome_unknown(reason=parent_rpc_ambiguous)
```

`invalid_arguments` is therefore never a generic transport fallback for `agent_session_send`. It is valid
only when authoritative validation proves the request was invalid before any possible execution. After a
parent-RPC request may have entered the channel, absence of a trustworthy response is not evidence that B
did not receive the message.

For `parent_rpc_ambiguous`:

```text
AUTOMATIC_RELAY_RETRY = 0
AUTOMATIC_HANDLER_REINVOCATION = 0
AUTOMATIC_ROUTER_REDELIVERY = 0
AUTOMATIC_PROMPT_REPLAY = 0
MODEL_VISIBLE_ERROR_CLASS = outcome_unknown
```

The trusted runtime retains its bounded L0/L1 request/correlation evidence for operations reconciliation
when available, but does not expose an internal request id or reconciliation handle in the model-visible
error. A later explicit model call is a new send and new Run; it must not be presented as a safe retry or be
silently deduplicated against the ambiguous call. This Spec adds no public inspect/retry operation.

Relay ambiguity does not rewrite a parent-side L1 business outcome that the parent already proved. The parent
retains its exact `accepted`, `not_admitted`, or terminal outcome record; the child returns `outcome_unknown`
when that proof did not cross the response channel. When no parent outcome is available, bounded sanitized
relay evidence records `parent_rpc_ambiguous`. R12's separate rule still applies: audit-append failure after a
proven receipt never converts that proven business result to unknown.

### 8A.2 Mutually exclusive and exhaustive R8 matrix

After a real receipt, terminal outcome is classified before output availability. `truncated` is consulted
only after a success terminal is proven. The complete valid Cartesian result space is:

| Reconciliation/output state | `terminalState` | `truncated` | Exact tool result |
|---|---|---:|---|
| `available` | `completed` or `late_completed` | `false` | `{status:'replied',reply:text}` |
| `available` | `completed` or `late_completed` | `true` | `reply_unavailable(reason=truncated)` |
| `no_output` | `completed` or `late_completed` | not applicable | `reply_unavailable(reason=no_output)` |
| `available` | `failed` or `late_failed` | `false` or `true` | `target_run_failed` |
| `no_output` | `failed` or `late_failed` | not applicable | `target_run_failed` |
| `available` | `terminated_without_outcome` | `false` or `true` | `outcome_unknown(reason=terminated_without_outcome)` |
| `no_output` | `terminated_without_outcome` | not applicable | `outcome_unknown(reason=terminated_without_outcome)` |
| `pending` | not terminal | not applicable | continue exact-handle wait; final read at reply deadline then `{status:'timeout'}` if still pending |
| delivery result `not_admitted` | not applicable | not applicable | `not_admitted` |
| `evicted` | not available | not applicable | `reply_unavailable(reason=evicted)` |
| `restart_lost` | not available | not applicable | `reply_unavailable(reason=restart_lost)` |
| `never_existed` | not available | not applicable | `reply_unavailable(reason=never_existed)` |

The rows are disjoint by ordered classification:

```text
1. proven admission state / parent-RPC ambiguity
2. terminalState = success | failure | terminated_without_outcome | not terminal
3. output state = available | no_output | absence state
4. truncated only within available + success
```

Consequences:

- The frozen R8 predicate `available + truncated=true` is restricted to
  `terminalState in {completed,late_completed}`; it is not a terminal-state-independent branch.
- `available + failed|late_failed + truncated=true` matches only `target_run_failed`; truncation never masks
  a proven target failure.
- `terminated_without_outcome` matches only `outcome_unknown`, with or without retained/truncated text;
  termination proof is not success/failure proof and retained text is not returned as a reply.
- unknown terminal values, malformed combinations, or unstructured reconciliation output after possible
  admission fail closed as `outcome_unknown(reason=reconciliation_invariant)` with zero automatic retry;
  they never fall through to `invalid_arguments`, `replied`, or empty success.
- `timeout`, `outcome_unknown`, and every failure/absence result produce no replay, second Router delivery,
  second Session, external announce, cancellation, or active steering.

### 8A.3 Current implementation gap

At base `433b8bd06a163badae322da9db012b9851e148b6`, `packages/broker/src/relay.js` applies
`invalid_arguments` to non-Scheduler request rejection and missing/unstructured parent responses. That
behavior is explicitly non-conforming for `agent_session_send`; it must not be reused unchanged. The future
implementation must give this local capability an exact ambiguity-preserving relay result or a generic
equivalent that does not weaken other capability contracts. This observation grants no code-change authority
while the Spec remains proposed.

## 8B. Formal Acceptance records and bidirectional Contract coverage

The original Cases A–I and additional mandatory cases in §7 remain the frozen behavioral scenarios. The
records below qualify those scenarios with stable Acceptance IDs, Contract references, verification
methods, environments, required evidence, expected results, and failure conditions. They define future
conformance evidence; they are not claims that an implementation already exists or passes.

### ACC-MSG-001 — Capability identity and inventory

- Contracts: `R1`.
- Existing scenario coverage: Cases A–I invoke the same capability entrypoint; this item adds the manifest
  and inventory gate required before any scenario execution.
- Method: load the Broker manifest/inventory and execute local-handler resolution tests that assert the exact
  capability id, tool name, operation, kind, local resource, required scope, and single handler resolution.
- Environment: isolated repository test workspace at the exact implementation commit whose base contains
  accepted D-008 and an accepted exact revision of this Spec; no production services or credentials.
- Required evidence: exact implementation commit, manifest bytes, inventory output, resolver test command,
  complete stdout/stderr, exit status, and test report.
- Expected result: exactly one `agent_session_send` local capability resolves with
  `operation=send`, `local.resource=agent-session-messaging`, and only `agent.session.send` as required scope.
- Failure condition: any missing/duplicate capability, mismatched field, remote relay substitution, or
  resolution outside the authenticated local-capability path fails acceptance.

### ACC-MSG-002 — Closed model-visible input and authoritative validation

- Contracts: `R2`.
- Existing scenario coverage: Case G plus the invalid-input matrix implied by R2.
- Method: execute schema and direct parent-RPC negative tests for missing fields, wrong types, target pattern
  and length, UTF-8 byte bounds, NUL, timeout bounds, timeout omission, and every undeclared property.
- Environment: isolated Broker/production-runtime fixture at the exact implementation commit; Router
  delivery, request-id generation, audit success, and target mutation counters instrumented; no production.
- Required evidence: exact commit, generated model schema, full test matrix, command, stdout/stderr, exit
  status, and zero-side-effect counter assertions for every rejected input.
- Expected result: only the exact three-field input is accepted and every invalid or extra-property case
  returns `invalid_arguments` before any side effect.
- Failure condition: any forbidden field is visible/accepted, timeout defaults, byte/NUL bounds are wrong, or
  a rejected call generates an id, success audit, Router delivery, or target mutation.

### ACC-MSG-003 — Runtime-derived source identity and correlation

- Contracts: `R3`.
- Existing scenario coverage: Case G and the additional onward-A2A source-turn case.
- Method: execute parent-RPC tests from direct and delivery-originated source Runs, including forged source
  fields/text, stale/missing/generation-mismatched `turnExecutionId`, self-send, and valid exact source proof.
- Environment: isolated parent-runtime/Router fixture with deterministic AgentProcess generations and
  execution maps at the exact implementation commit; no external ingress or production writes.
- Required evidence: exact commit, fixture identities/generations, command, stdout/stderr, exit status,
  captured trusted invocation metadata, delivery counts, and resulting sanitized message-source records.
- Expected result: valid calls derive actual A plus its exact live source `turnExecutionId`, fresh runtime
  request id, `sessionMode='main'`, and `kind='inter_agent'`; missing/stale proof and self-send fail pre-delivery.
- Failure condition: model input controls a trusted field, correlation is not the exact source turn, a stale
  source delivers, self-send delivers, or a valid onward-A2A source depends on external ingress context.

### ACC-MSG-004 — Strict trusted provenance propagation

- Contracts: `R4`.
- Existing scenario coverage: Cases G and I plus the additional onward-A2A source-turn case.
- Method: execute Router→route admission→AgentProcess→session/prompt→demo-server propagation tests with
  valid, omitted, malformed, oversized, unknown-field, and mutation-after-call sidecars.
- Environment: isolated pinned Router/demo-server dependency fixture at the exact implementation commit;
  existing non-A2A callers included; no external channel or production state.
- Required evidence: exact commit and pinned dependency revision, type/declaration diff when needed, full
  command/stdout/stderr/exit status, layer-by-layer captured metadata, and durable created-message records.
- Expected result: exact allowlisted detached/frozen `inter_agent` provenance reaches durable message source;
  omission preserves `source:{kind:'user'}` and malformed or unknown metadata fails closed.
- Failure condition: provenance is only prompt text, any layer accepts/forwards unknown business fields,
  caller mutation changes accepted metadata, existing callers regress, or Router learns Product-Surface data.

### ACC-MSG-005 — Target-owned execution security identity

- Contracts: `R5`.
- Existing scenario coverage: Case H.
- Method: have B process A's accepted message and invoke an authenticated Broker probe while instrumenting
  parent caller derivation, credential lookup, Principal/grant evaluation, and workspace selection.
- Environment: isolated multi-Agent auth/Broker fixture with distinct A/B credentials, Principals, grants,
  and workspaces at the exact implementation commit; secret values redacted; no production credentials.
- Required evidence: exact commit, fixture identity map without secrets, command, stdout/stderr, exit status,
  redacted credential-selector trace, authorization decision, and workspace/caller assertions.
- Expected result: provenance names A while callerAgentId, credential, Principal, grants, and workspace all
  belong to B; child self-report and origin metadata cannot alter execution identity.
- Failure condition: any A credential/Principal/grant/workspace is selected or inherited, B can impersonate A,
  or targetAgentId/source metadata becomes Broker caller identity.

### ACC-MSG-006 — Capability authorization and fail-closed denial

- Contracts: `R6`.
- Existing scenario coverage: Cases F and H.
- Method: execute positive and negative authorization matrices for exact send grant, missing/invalid
  credential, denied grant, invalid/disabled/missing target, invalid input, and unrelated Session permissions.
- Environment: isolated Broker/Auth/Router fixture with synthetic non-secret credentials and distinct grants
  at the exact implementation commit; no live auth-service or production mutation.
- Required evidence: exact commit, fixture grant matrix, command, stdout/stderr, exit status, L0 denial
  evidence, handler/delivery/mutation counters, and returned structured error classes.
- Expected result: only an actual caller with valid credential and exact `agent.session.send` grant reaches the
  handler; every denial is correctly classified with zero Router delivery and zero target mutation.
- Failure condition: Session read/list permission implies send, a denial delivers/mutates, target selection
  alters caller authority, or any credential/grant failure is treated as success.

### ACC-MSG-007 — Receipt-only result is bound to real inbox acceptance

- Contracts: `R7`.
- Existing scenario coverage: Cases C and E.
- Method: execute immediate, queued-busy, queue-cap, pre-receipt failure, and real-receipt fixtures at
  `timeoutSeconds=0`, distinguishing parent queue admission from `session/prompt` receipt.
- Environment: isolated Router/AgentProcess/demo-server fixture with controllable FIFO and receipt barriers at
  the exact implementation commit; no production Agent invocation.
- Required evidence: exact commit, fixture timing/barrier trace, command, stdout/stderr, exit status,
  reconciliation handle, queue/delivery/prompt counters, and returned model-visible envelope.
- Expected result: `{status:'accepted'}` appears only after the exact real inbox receipt and never waits for
  model start/completion/reply; pre-receipt rejection produces its exact failure rather than acceptance.
- Failure condition: queue admission is mislabeled accepted, accepted precedes the real receipt, reply/idle is
  awaited, or the success envelope exposes an internal id/identity/handle.

### ACC-MSG-008 — Positive timeout returns only one exact successful complete reply

- Contracts: `R8`.
- Existing scenario coverage: Case D plus every terminal/truncation/restart/timeout case in §7 and the binding
  §8A.2 matrix.
- Method: table-drive the complete valid Cartesian space: `available × {completed,late_completed,failed,
  late_failed,terminated_without_outcome} × {truncated=false,true}`; `no_output ×` the same five terminal
  states; `pending` before and at the reply deadline; `not_admitted`; `evicted`; `restart_lost`;
  `never_existed`; plus unknown terminal and malformed/unstructured reconciliation shapes. Assert exactly one
  selected result branch for every fixture.
- Environment: isolated deterministic reconciliation fixture at the exact implementation commit with the
  reply deadline beginning at a controlled real receipt; no production execution.
- Required evidence: exact commit, generated fixture list proving every combination above, receipt/deadline
  timestamps, command, stdout/stderr, exit status, authoritative final-output snapshots, selected-branch count,
  returned envelope/error, and prompt/replay/external-delivery counters for each fixture.
- Expected result: the §8A.2 row is selected exactly once for every valid combination; only
  `available + completed|late_completed + truncated=false` returns `{status:'replied',reply}`;
  failed/late-failed always return `target_run_failed`; `terminated_without_outcome` and malformed post-
  admission states return `outcome_unknown`; still-pending final read returns `{status:'timeout'}`; every
  replay/redelivery/external-delivery counter remains zero.
- Failure condition: any fixture selects zero or multiple rows; failed/late-failed plus `truncated=true` becomes
  `reply_unavailable`; any `terminated_without_outcome` combination is missing or becomes success/failure;
  retained text from a non-success terminal is returned; queue time consumes the reply deadline; malformed
  post-admission state becomes `invalid_arguments`; timeout/unknown cancels, retries, replays, announces, or
  causes a second delivery; or any state becomes empty success.

### ACC-MSG-009 — Race-safe exact-handle wait lifecycle

- Contracts: `R9`.
- Existing scenario coverage: Case D and the additional settled-before-subscribe,
  settle-between-read/subscribe, and timeout/event-race cases.
- Method: use deterministic barriers/fake timers to force each read→subscribe→read race position, unrelated
  handle events, matching settlement, timer settlement, and every error exit.
- Environment: isolated unit fixture over the sole Router reconciliation authority at the exact implementation
  commit; no network, model, external channel, or production state.
- Required evidence: exact commit, seeded race schedule, command, stdout/stderr, exit status, read/event/timer
  trace, once-guard settlement count, and listener/timer disposal assertions.
- Expected result: every schedule settles exactly once from authoritative exact-handle state, performs the
  final pre-timeout read, ignores unrelated events, and disposes listener/timer on every exit.
- Failure condition: lost settlement, duplicate result, wrong-handle result, poll loop/second cache, premature
  timeout, or any leaked listener/timer fails acceptance.

### ACC-MSG-010 — Canonical-main reuse, FIFO, and no automatic cycles

- Contracts: `R10`.
- Existing scenario coverage: Cases A, B, and E plus the additional self-send and two-send cases.
- Method: execute existing-main, absent-main concurrent first sends, busy target, queue cap/fence, two distinct
  request ids, explicit cyclic calls, and self-send fixtures with Session/Run/prompt counters.
- Environment: isolated multi-Agent Router/demo-server concurrency fixture at the exact implementation commit;
  no Scheduler, Workflow, external channel, or production processes.
- Required evidence: exact commit, concurrency schedule, command, stdout/stderr, exit status, target Session
  ids, Run/Turn ordering, prompt/delivery counters, receipt points, and rejection results.
- Expected result: one target canonical main is reused/atomically established; each accepted send produces one
  ordered next Run/Turn; busy work is not steered; cap/fence/self-send fail without target prompt bytes.
- Failure condition: a send creates a fresh Session, two sends deduplicate, busy work is steered, queue receipt
  is called inbox acceptance, rejection writes prompt bytes, or the capability automatically cycles/replays.

### ACC-MSG-011 — Binding and Product-Surface isolation

- Contracts: `R11`.
- Existing scenario coverage: Case I and the additional late-result-after-timeout case.
- Method: send from direct and externally-originated A turns while snapshotting all Binding, ingress context,
  reply-route, Feishu, Forum, Scheduler, and Workflow call/mutation counters before and after B completion and
  late completion.
- Environment: isolated Router/demo-server integration fixture with fake Product-Surface adapters at the exact
  implementation commit; real external services and production stores disabled.
- Required evidence: exact commit, adapter fixtures, pre/post snapshots, command, stdout/stderr, exit status,
  deliver-vs-onIngress trace, and zero-call/byte-identical mutation assertions.
- Expected result: A2A uses generic `deliver`; Binding/external routes remain byte-identical; the requested
  exact reply can return only in the tool result; all Product-Surface call/mutation counts remain zero.
- Failure condition: any `onIngress`, Binding/context/reply-route mutation, synthesized external id, external
  delivery, or ancestry value influencing routing/reply behavior fails acceptance.

### ACC-MSG-012 — Two-level two-phase audit truth and secrecy

- Contracts: `R12`.
- Existing scenario coverage: Case F plus the additional intent-append and outcome-append failure cases.
- Method: execute validation/credential/grant denials, intent append failure, pre-receipt delivery failure,
  accepted/replied/timeout/terminal outcomes, and post-receipt outcome append failure with ordered audit sinks.
- Environment: isolated Broker/capability/Router fixture with deterministic failing audit sink at the exact
  implementation commit; synthetic secrets/message text; no production audit store.
- Required evidence: exact commit, fixture configuration, command, complete stdout/stderr, exit status,
  ordered sanitized L0/L1 records, Router/receipt counters, degradation signal, and secret-content scan.
- Expected result: authoritative pre-handler denials are L0; L1 intent precedes delivery; failed intent gives
  zero delivery; outcomes preserve exact business truth; post-receipt append failure emits sanitized
  degradation without rewriting the result; forbidden content never appears.
- Failure condition: delivery occurs without successful L1 intent, audit order is wrong, a proven receipt is
  rewritten, an unknown outcome is guessed, any secret/message/history/route leaks, or audit failure is silent.

### ACC-MSG-013 — Parent-RPC loss preserves send ambiguity and forbids duplicate retry

- Contracts: `R2`, `R7`, `R8`, `R10`, `R12`.
- Existing scenario coverage: Cases C and D plus the §7 no-replay/second-delivery additional cases and the
  binding §8A.1 relay classification.
- Method: instrument child schema validation, parent-RPC request-write boundary, parent handler entry, Router
  delivery, target receipt, response write, and child relay result. Execute: proven child-side invalid input;
  rejection before request write; parent deadline before handler entry with proof; parent deadline after
  handler entry; channel loss after B receipt but before response; request rejection with unknown write state;
  missing response; malformed/unstructured transport/parent envelopes; and a later explicit second call.
- Environment: isolated Broker/AgentProcess/production-runtime/Router fixture at the exact implementation
  commit with deterministic RPC barriers and B receipt counters; no production services or credentials.
- Required evidence: exact commit, relay source/test diff, complete fixture matrix, exact command,
  stdout/stderr, exit status, request-write/handler/delivery/receipt/response counters, model-visible error,
  L0/L1 correlation/audit evidence, automatic retry/re-invocation/replay counts, and explicit-second-call Run
  identities.
- Expected result: only proven validation/non-execution fixtures return `invalid_arguments` or their exact
  pre-delivery denial; every loss lacking proof of zero parent execution and zero B delivery returns
  `outcome_unknown`; automatic retry, handler re-invocation, Router redelivery, and prompt replay counts are
  zero; a later explicit call is a distinct send/Run and is not described as a safe retry.
- Failure condition: the current generic relay behavior—non-Scheduler request rejection/channel loss or
  missing/unstructured response returning `invalid_arguments`—is observed for `agent_session_send`; any
  ambiguous loss claims not-admitted/failed/no-side-effect; any automatic second attempt occurs; B receives
  duplicate prompt bytes from one tool call; or internal correlation/secret material becomes model-visible.

### Contract-to-Acceptance coverage

| Contract | Acceptance | Existing scenarios | Covered |
|---|---|---|---|
| `R1` | `ACC-MSG-001` | Cases A–I capability entrypoint | YES |
| `R2` | `ACC-MSG-002`, `ACC-MSG-013` | Case G + invalid-input/relay-loss matrices | YES |
| `R3` | `ACC-MSG-003` | Case G + onward-A2A additional case | YES |
| `R4` | `ACC-MSG-004` | Cases G, I + onward-A2A additional case | YES |
| `R5` | `ACC-MSG-005` | Case H | YES |
| `R6` | `ACC-MSG-006` | Cases F, H | YES |
| `R7` | `ACC-MSG-007`, `ACC-MSG-013` | Cases C, E + relay-loss matrix | YES |
| `R8` | `ACC-MSG-008`, `ACC-MSG-013` | Case D + terminal/timeout/relay-loss cases | YES |
| `R9` | `ACC-MSG-009` | Case D + race additional cases | YES |
| `R10` | `ACC-MSG-010`, `ACC-MSG-013` | Cases A, B, E + self/two-send/no-retry cases | YES |
| `R11` | `ACC-MSG-011` | Case I + late-result additional case | YES |
| `R12` | `ACC-MSG-012`, `ACC-MSG-013` | Case F + audit-failure/relay-loss cases | YES |

### Scenario-to-Contract coverage

| Existing scenario | Contracts | Acceptance records |
|---|---|---|
| Case A — existing B main | `R1`, `R10` | `ACC-MSG-001`, `ACC-MSG-010` |
| Case B — absent B main and concurrent first sends | `R10` | `ACC-MSG-010` |
| Case C — receipt-only | `R7` | `ACC-MSG-007`, `ACC-MSG-013` |
| Case D — one bounded reply | `R8`, `R9` | `ACC-MSG-008`, `ACC-MSG-009`, `ACC-MSG-013` |
| Case E — B busy | `R7`, `R10` | `ACC-MSG-007`, `ACC-MSG-010` |
| Case F — unauthorized sender | `R6`, `R12` | `ACC-MSG-006`, `ACC-MSG-012` |
| Case G — unforgeable provenance | `R2`, `R3`, `R4` | `ACC-MSG-002`, `ACC-MSG-003`, `ACC-MSG-004` |
| Case H — target-owned execution identity | `R5`, `R6` | `ACC-MSG-005`, `ACC-MSG-006` |
| Case I — external route isolation | `R4`, `R11` | `ACC-MSG-004`, `ACC-MSG-011` |
| §7 additional mandatory cases | `R2`, `R3`, `R6`, `R8`, `R9`, `R10`, `R11`, `R12` | `ACC-MSG-002`, `ACC-MSG-003`, `ACC-MSG-006`, `ACC-MSG-008`, `ACC-MSG-009`, `ACC-MSG-010`, `ACC-MSG-011`, `ACC-MSG-012`, `ACC-MSG-013` |

```text
ACTIVE_CONTRACTS = 12
ACCEPTANCE_RECORDS = 13
CONTRACTS_WITH_ACCEPTANCE = 12
UNRESOLVED_ACCEPTANCE_REFERENCES = 0
UNMAPPED_EXISTING_SCENARIOS = 0
```

## 8C. Predicted implementation scope details — not authorized

Only a future atomic Owner acceptance transaction, after independent review, may change this Spec from
`status: proposed` / `implementation_authority: none` to `status: accepted` /
`implementation_authority: contracts`. The accepted Spec must then be present in the exact implementation
base that already contains accepted/current D-008 before its bounded Contracts may activate. Predicted
code scope is:

```text
packages/broker
  - agent_session_send local capability manifest and inventory tests
  - reuse the existing local relay transport path, but not its generic non-Scheduler invalid_arguments fallback
  - exact agent_session_send parent-RPC ambiguity -> outcome_unknown + zero automatic retry mapping/tests
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

## 9. Alternatives and disposition — reused and retired agent_wake research

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
5. error mapping for Router `outcome_unknown` and reply reconciliation absence states;
6. §8A.2's mutually exclusive/exhaustive matrix, including every failed/late-failed truncation combination
   and every `terminated_without_outcome` output combination;
7. parent-RPC ambiguous-loss classification, zero automatic retry/re-invocation/redelivery/replay, and the
   explicit non-conformance of the current generic non-Scheduler `invalid_arguments` fallback.

```text
TASK_NAME = 会话 执行
OPENCLAW_MODEL = reuse target Agent main Session; each send creates one new Run/Turn, not one new Session; timeout=0 returns after receipt, timeout>0 may wait for that exact Run's one reply
CURRENT_ROUTER_REUSE = PARTIAL
PROVENANCE_GAP = YES
WAIT_REPLY_GAP = YES
R8_CLOSED_CLASSIFICATION = TERMINAL_OUTCOME_FIRST + OUTPUT_STATE_SECOND + TRUNCATION_ONLY_FOR_SUCCESS
TERMINATED_WITHOUT_OUTCOME = outcome_unknown; retained/truncated text is not a reply
PARENT_RPC_AMBIGUITY_GAP = YES
PARENT_RPC_AMBIGUITY_RESULT = outcome_unknown
AUTOMATIC_RELAY_RETRY = 0
ACCEPTANCE_RECORDS = 13
PROPOSED_SPEC = AGENT_CORE_AGENT_SESSION_MESSAGING_V1
SPEC_STATUS = proposed
SOURCE_R2_SHA256 = 20820492d1b65842b0c607ee013baca1d5a3d6377b072d8914405eabff99d169
FRESH_AUTHORING_BASE = 433b8bd06a163badae322da9db012b9851e148b6
DECISION_ALIGNMENT_STATUS = SATISFIED_BY_D008
PR130_DISPOSITION = CLOSE
PROPOSED_IMPLEMENTATION_AUTHORITY = none
IMPLEMENTATION_AUTHORITY_ON_FUTURE_ACCEPTANCE = contracts
ACTIVE_IMPLEMENTATION_AUTHORITY_WHILE_PROPOSED = NONE
OWNER_ACCEPTANCE_REQUIRED = YES
IMPLEMENTATION_SCOPE = Broker local capability + trusted provenance sidecar + thin reconciliation wait helper + production wiring/tests; no new Session/Scheduler subsystem
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 会话 审计
```

## 11. Migration, compatibility, and rollback

```text
PROPOSED_SPEC_MIGRATION = none
PRODUCT_MIGRATION_AUTHORIZED = NO
CURRENT_CALLER_COMPATIBILITY = unchanged
CURRENT_SESSION_COMPATIBILITY = unchanged
CURRENT_EXTERNAL_ROUTE_COMPATIBILITY = unchanged
ROLLBACK_BEFORE_ACCEPTANCE = revert/close the complete docs-only proposal
ROLLBACK_AFTER_ACCEPTANCE = immutable authority; use a complete standalone successor and atomic whole-authority supersession
IMPLEMENTATION_ROLLBACK = future implementation/conformance responsibility; not authorized by this proposed Spec
```

Compatibility is already frozen by R4, R10, and R11: existing callers that omit `messageOrigin` keep direct
user source semantics; Messaging adds no arbitrary or fresh Session behavior; Delegation/Cron Session
classes, Binding, external ingress/reply routes, and every existing Product Surface remain unchanged.

There is no data migration, Session rewrite, backfill, Grant mutation, credential migration, deployment, or
production action in this proposed-Spec lifecycle. If a future accepted implementation cannot satisfy these
compatibility constraints, it fails the relevant Acceptance records rather than silently widening scope.

## 12. Open questions and acceptance readiness

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
EXTERNAL_AUTHORITY_TBD = NONE
ACTIVE_IMPLEMENTATION_AUTHORITY_WHILE_PROPOSED = NONE
OWNER_ACCEPTANCE_REQUIRED = YES
```

The review focus in §10 asks the independent reviewer to verify frozen choices; it does not delegate any
normative choice to implementation. A semantic delta anywhere in the Spec after review invalidates that
review. Acceptance, if authorized, must bind the exact final head and atomically perform the lifecycle
transition described in §8C together with required acceptance provenance and lifecycle mirrors; no product
implementation, merge, or production authority exists in the current proposed state.
