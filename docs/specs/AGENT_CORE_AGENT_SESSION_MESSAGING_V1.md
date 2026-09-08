---
spec_id: AGENT_CORE_AGENT_SESSION_MESSAGING_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-08-31
revision: r5
revision_date: 2026-09-09
amendment2_ref: r5 = AMENDMENT_2 (owner goal AGENT_SESSION_SEND_RELIABILITY_V1, real incident
  corpus agt_soul-questioner-agent gen2 'RPC session/prompt rejected: AGENT_PROCESS_EXITED';
  docs-only: §5.1 outcome_unknown phase split + AGENT_PROCESS_EXITED matrix rows, §5.2
  post_receipt reason marker, §5.3 conversion row, §7 T_PROCESS_EXIT cases; accepted r4
  semantics otherwise unchanged)
amendment_ref: r4 = AMENDMENT_1 (owner goal AGENT_SESSION_SEND_RELIABILITY_V1; docs-only:
  §5.1 two-dimension result model, §5.2 failure-code visibility, §5.3 bounded outcome
  reconciliation with child-minted invocationCorrelation anchor + agent_session_send_reconcile
  discovery capability; accepted semantics of §0-§4/§6 unchanged, except that §5.2 additively
  extends the R12 evidence shape (failureCode + invocationCorrelation fields on L1 rows) and §5.3
  adds exactly one child-synthesized caller-visible reconciled envelope)
amendment_status: accepted
amendment2_status: accepted
amendment2_accepted_date: 2026-09-09
amendment2_accepted_reviewed_head: 1411c48
amendment2_acceptance_authority_basis: >-
  owner goal directive 2026-09-09 pre-ruled the exact semantics (AGENT_PROCESS_EXITED is a
  reason, never a delivery status; CASE A/B/C required; delivery must be mechanically visible
  post-receipt) and ordered this goal's lifecycle including implementation; autonomous chain:
  independent review r1 REVISE (1 blocker) -> fix 0a2891d -> re-audit REVISE (2 one-line
  residuals) -> fix 1411c48 -> final verification ACCEPT blockers NONE; docs-only,
  WIRE_BREAK/GRANT_CHANGE/PRODUCTION_CHANGE = NONE
amendment_accepted_date: 2026-09-08
amendment_accepted_by: mayf3
amendment_accepted_merge: 8994aa587ed9328540e793c77128210a9abac8e3 (PR #202, normal merge path;
  Owner ruling AMENDMENT_1_ACCEPTED 2026-09-08 — six-point acceptance incl.
  REPLY_UNAVAILABLE_MEANS_DELIVERED=YES as accepted historical fact; implementation now authorized
  on a separate branch under GOVERNING_SPEC_UNMODIFIED)
amendment_independent_review: r1 REVISE (3 blockers, all mechanical) -> blocker union fixed once
  @ 725b252 -> re-audit ACCEPT (blockers NONE; 3 cosmetic notes absorbed in the follow-up commit,
  zero semantic delta). Reviewer mechanically re-verified against the real implementation:
  production-runtime agent-session-messaging/reply-wait/audit, broker relay/gateway/registry/schema/
  index, agent-router parent-rpc-relay + reconciliation.
amendment_reviewed_head: 725b252
amendment_acceptance_path: owner merge of this docs-only branch flips amendment_status to accepted;
  implementation of §5.1-§5.3 is authorized only AFTER that acceptance (separate implementation
  branch; GOVERNING_SPEC_UNMODIFIED applies to it)
amendment_goal: AGENT_SESSION_SEND_RELIABILITY_V1
accepted_date: 2026-09-02
accepted_by: mayf3
accepted_at: 2026-09-02T11:47:15Z
accepted_reviewed_head: eaa3e3d9754a608946165841408d01035a6e1b25
independent_review_result: PASS
independent_review_blockers: NONE
acceptance_verdict: READY_FOR_ACCEPTANCE_FINALIZE
acceptance_finalize_semantic_change: none
acceptance_authority_basis: >-
  owner goal AGENT_SESSION_SEND_READY_FOR_INTEGRATION_V1 (autonomous chain:
  promotion/fresh-head review -> independent audit PASS -> lifecycle acceptance
  -> final-head audit -> implementation -> independent implementation audit;
  production deployment NOT_RUN; main merge NOT_RUN by this chain)
task_name: 会话 规格
task_type: SPEC_AUTHORING_ONLY
scope:
  - agent_session_send broker local capability
  - target Agent canonical main Session reuse with one new Run/Turn per send
  - runtime-owned inter_agent provenance and target-owned execution identity
  - receipt-only and bounded one-reply modes
  - thin reconciliation wait helper
  - authorization, audit, error, and acceptance contracts
  - "AMENDMENT_1: two-dimension DELIVERY/REPLY result model over the closed taxonomy"
  - "AMENDMENT_1: structured failure-code visibility in model render and L1 outcome rows"
  - "AMENDMENT_1: bounded outcome reconciliation (agent_session_send_reconcile discovery capability + invocationCorrelation anchor)"
  - "AMENDMENT_2: outcome_unknown phase split (post-receipt = DELIVERED + UNKNOWN) and AGENT_PROCESS_EXITED matrix rows (Router admission doctrine respected; reason visible, never a delivery dimension)"
supersedes: []
superseded_by: null
related_specs:
  - AGENT_CORE_AGENT_WAKE_CAPABILITY_V1 (Draft PR #130; close as obsolete)
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V2
related_decisions:
  - AGENT_WORKSPACE_SESSION_MODEL_V3 (D-008, accepted 2026-09-01; supersedes AGENT_WORKSPACE_SESSION_MODEL_V2 whole)
owners:
  - repository-maintainers
change_log:
  - revision: r5 (AMENDMENT_2)
    date: 2026-09-09
    kind: docs-only semantic amendment (owner goal AGENT_SESSION_SEND_RELIABILITY_V1); trigger
      corpus = real incident agt_soul-questioner-agent gen2 ('RPC session/prompt rejected:
      AGENT_PROCESS_EXITED'); adds §5.1a and the §5.1 outcome_unknown phase split, §5.2
      post_receipt marker, §5.3 conversion row, §7 T_PROCESS_EXIT cases, §12 record
    semantic_delta: the five §12 SEMANTIC_DELTA items (post-receipt outcome_unknown ->
      DELIVERED + UNKNOWN via markers; AGENT_PROCESS_EXITED classified per the Router's settled
      C-004/C-017 admission doctrine — reason visible, never a delivery dimension; structured
      proven rejections keep not_admitted)
    wire_break: NONE; grant_change: NONE; production_change: NONE
  - revision: r4 (AMENDMENT_1)
    date: 2026-09-08
    kind: docs-only semantic amendment (owner goal AGENT_SESSION_SEND_RELIABILITY_V1); §0-§4/§6
      accepted semantics unchanged (§5.2 additively extends the R12 evidence shape; §5.3 adds one
      child-synthesized reconciled envelope); adds §5.1-§5.3 and §7 reliability cases
    evidence_base: docs/evidence/agent-session-send-reliability-v1-20260908 (branch
      docs/agent-session-send-reliability-v1-evidence @ 24e28ae; live tree
      /usr/local/libexec/agent-core/app 2026-09-05 vs origin/main 1cde3cc hash-comparison;
      12-case discriminating failure-injection probe; baseline suites 14/14, 18/18, 8/8)
    root_cause_finding: reply_unavailable is post-receipt-only by construction (class A
      expression/consumption); the ambiguous seam (outcome_unknown after a lost parent-RPC
      response) has no bounded reconciliation — a NEW normative semantic required before
      implementation
  - revision: r3
    date: 2026-09-02
    kind: docs-only revision against R1 preparation investigation; no authority change
      (implementation_authority and production_apply_authority remain none)
    audit_base: github/main 840d2f4ad91f8252eb1f163330c041216a0dd9c4
    investigation_input: AGENT_SESSION_MESSAGING_PREP_INVESTIGATION_V1 (R1; branch
      prep/session-messaging-investigation-v1 @ 04e0c81)
    fixes:
      - "F10 (major): whole-authority alignment to accepted D-008 AGENT_WORKSPACE_SESSION_MODEL_V3 — frontmatter related_decisions V2→V3; §2.2 rewritten to record that the alignment has been executed at BASE (TARGET_MAIN freeze V3:363-376, one send = one new Run/Turn V3:371-372/387, agent_session_send naming V3:381-388, §29 implementation deferral V3:976-999); §10 review-gate item 1 updated to match"
      - "F9 (minor): §4 R1 and the §8 MOD list now include the packages/broker/src/index.js localHandlerResolver closure generalization (BASE index.js:272-275 is a closed two-service merge) alongside the reused relay"
      - "F12 (minor): §4 R2 states explicitly that the byte-length (1..65536 UTF-8) and NUL-forbidden message rules are enforced by the trusted agent_session_send handler, not by broker structural validation (mapping.js:99-106 supports minLength/nonBlank only; no maxLength, byte-length, or NUL check)"
      - "F19 (minor): §4 R8 adds a terminalState terminated_without_outcome row (state-machine.js:13) mapped to outcome_unknown per the outcome_unknown-family convention; §7 mandatory-case list updated"
      - "F22 (minor): §4 R12 and §8 mark the L0/L1 audit surface as NEW code, citing the scheduler self-service precedent (self-service.js:235 appendAudit; production-runtime compose.js:440-450 sanitized onAuditFailure wiring pattern)"
      - "F23 (minor): §5 adds transport_failure and unsupported_operation to the required error taxonomy with emission sites (gateway.js:171-174, 246-248) and the rationale for taxonomy membership over remapping; §4 R12 coarse audit-result mapping clarified"
      - "F8/G8 (note): §8 adds local-manifest relay-path test coverage to the predicted scope (BASE relay tests are http-only)"
---

# AGENT_CORE_AGENT_SESSION_MESSAGING_V1

> 状态：**accepted r4（AMENDMENT_1 已接受，PR #202 @8994aa5）+ r5 AMENDMENT_2 PROPOSED（2026-09-09，owner goal
> AGENT_SESSION_SEND_RELIABILITY_V1）**。r3 的 accepted 语义（§0-§4/§6，2026-09-02 lifecycle
> acceptance finalize）不变；r4 只新增 §5.1（两维结果模型的 normative 映射）、§5.2（failure-code
> 可见性：模型渲染 + L1 outcome 行持久化）、§5.3（bounded outcome reconciliation：child-minted
> invocationCorrelation 锚 + agent_session_send_reconcile 只读 discovery capability）与 §7
> AMENDMENT_1 验收用例。证据基线：`docs/evidence/agent-session-send-reliability-v1-20260908`
> （live 树与 origin/main 字节比对 + 12 例判别性 failure injection）。r3 独立审计绑定
> `eaa3e3d9754a608946165841408d01035a6e1b25`（PR #138）**PASS**；AMENDMENT_1 已于 2026-09-08 经独立评审
> PASS 后 accepted（PR #202 @8994aa5），§5.1-§5.3 实现授权已在独立 impl 分支进行；r5 新增的
> §5.1a/§5.2-AMENDMENT_2 部分仍为 PROPOSED，接受前不授予实现权限。

> 状态：**accepted r3（2026-09-02 lifecycle acceptance finalize）**。独立审计绑定
> `eaa3e3d9754a608946165841408d01035a6e1b25`（branch `prep/session-spec-revision-v1` / PR #138）：
> **PASS**（0 blocker / 0 major / 2 minor F1·F2 / 3 note；报告
> `docs/reports/agt-prep-audit-pr138-session-spec-r3.md` @ commit `0bd94f1`；
> audit BASE `github/main 840d2f4`，acceptance 时 main 未漂移）。acceptance 仅变更
> lifecycle 与 provenance 字段，reviewed semantics 零改动
> （`acceptance_finalize_semantic_change: none`）；`implementation_authority: contracts`
> 按 owner goal `AGENT_SESSION_SEND_READY_FOR_INTEGRATION_V1` 的自主链授权按本 Spec
> contracts 实现；`production_apply_authority: none` 不变——本链不部署、不 merge main、
> 不变更 Grant/credential/production state。F1（PR #130 disposition 注记）与 F2
> （§3 证据行锚点）为已记录 non-blocking note，属 FOLLOW_UP_DEBT。
>
> 起草历史：r2 基于 `origin/main@1a9b81de19c2bf4af01f62f6189acffc1bb6839d`；r3 全部 BASE 事实
> 已由 R1 调查在 `github/main@840d2f4ad91f8252eb1f163330c041216a0dd9c4` 重新核实（
> `AGENT_SESSION_MESSAGING_PREP_INVESTIGATION_V1`，branch `prep/session-messaging-investigation-v1`）。
>
> r3 authoring 时点：`PRODUCT_CODE_CHANGE = NONE`；`PRODUCTION_CHANGE = NONE`。

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

r2 gated acceptance on a future whole-authority Decision to replace the accepted per-task non-main
A2A model of `AGENT_WORKSPACE_SESSION_MODEL_V2 §11`. **That alignment has since been executed at
BASE** and no longer blocks this Spec:

- `AGENT_WORKSPACE_SESSION_MODEL_V3` (decision id `D-008`) is **accepted** (2026-09-01, acceptance
  commit `b2e3eb1`) and supersedes `D-006` / `AGENT_WORKSPACE_SESSION_MODEL_V2` **as a whole**
  (V3 frontmatter: “整份取代 D-006 / V2”, supersedes declaration at V3 lines 14–15);
- V3 freezes the messaging Session scope this Spec implements
  (`AGENT_WORKSPACE_SESSION_MODEL_V3` §Agent-to-Agent Messaging freeze block, lines 363–376):

  ```text
  AGENT_TO_AGENT_MESSAGING_SESSION_SCOPE = TARGET_MAIN          (V3:366)
  AGENT_TO_AGENT_MESSAGING_TARGET = TARGET_AGENT_CANONICAL_MAIN (V3:367)
  existing main → resume; absent main → establish/create        (V3:369-370)
  one send → one new target Run/Turn                            (V3:371)
  one send → NOT one new Session                                (V3:372)
  ```

- V3 names this Spec's generic primitive and restates the model (V3:381–388):
  `agent_session_send → messaging → target main → one send = one new Run/Turn, not one new Session`;
- V3 explicitly defers every implementation concern — `agent_session_send` implementation, Broker
  manifest / local capability wiring, Router change, trusted inter-agent provenance representation,
  reconciliation/wait helper, authorization/grant profile, reply/timeout contract, and self-send/cycle
  policy — to its §29 future-boundaries list (V3:976–999; `agent_session_send implementation` at
  V3:981). This Spec is exactly that deferred implementation contract;
- V3 records `AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r2` as a read-only proposed input that was not
  accepted or implemented in that round (V3:19–22); this r3 revision is the docs-only continuation
  that R1's investigation found necessary before acceptance;
- V3 §12 keeps Agent-to-Agent **Delegation** per-task non-main
  (`AGENT_TO_AGENT_DELEGATION_SESSION_SCOPE = PER_TASK`, V3:395–405). This Spec implements only the
  Messaging primitive and must not be read as touching Delegation.

Therefore the r2 whole-authority gate is discharged:

```text
DECISION_ALIGNMENT_REQUIRED = NO   # executed at BASE by accepted D-008 / V3 (supersedes V2 whole)
GOVERNING_DECISION = AGENT_WORKSPACE_SESSION_MODEL_V3 (D-008, accepted)
IMPLEMENTATION_BEFORE_SPEC_ACCEPTANCE = FORBIDDEN
IMPLEMENTATION_AUTHORITY = NONE    # unchanged; D-008 §29 defers implementation to future boundaries
```

Cron/Scheduler per-execution fresh Session semantics are not challenged (V3 §0: cron → fresh
non-main Session per execution, V3:57–58).

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
supports local-capability relay; `relay.js` is not an implementation gap (BASE `relay.js:153-155`
relays local-manifest operations). The execute-time resolver, however, is a **closed two-service
merge** at BASE — `packages/broker/src/index.js:272-275` merges only
`agentDefinitionAccess` and `selfServiceSchedulerAccess` handlers — so serving a new
`agentSessionMessagingAccess` provider requires a small generalization edit to that closure
(plus a `ctx.provide` in the composition). That `packages/broker/src/index.js` edit is part of the
predicted scope in §8.

### R2 — Model-visible input is exactly three fields

```text
targetAgentId  string   required  ^agt_[a-z0-9-]+$, 5..128 chars
message        string   required  1..65536 UTF-8 bytes; NUL forbidden; newline/tab allowed
timeoutSeconds integer  required  0..300 inclusive
```

`timeoutSeconds` has no default: omitting it is invalid. The message limit is intentionally below the
Router's current 1 MiB prompt ceiling so one Agent-facing call cannot consume the whole process evidence
budget.

**Enforcement locus for message size/NUL rules (F12):** the 1..65536 UTF-8 byte bound and the
NUL-forbidden rule are enforced by the **trusted `agent_session_send` handler** as first-action
authoritative validation. Broker structural validation cannot express these rules at BASE: the string
validator supports only `minLength` (UTF-16 code units) and `nonBlank` — there is no `maxLength`, no
byte-length check, and no NUL check (`packages/broker/src/mapping.js:99-106`). Any manifest-level
string bounds are defense-in-depth only and are never authoritative for byte-length or NUL; only the
handler's UTF-8 byte measurement and NUL rejection are.

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

Closed mapping (F19 adds the `terminated_without_outcome` row):

```text
available + terminalState in {completed, late_completed} + truncated=false
  -> {status:'replied', reply:text}

available + truncated=true
  -> reply_unavailable(reason=truncated)

available + terminalState in {failed, late_failed}
  -> target_run_failed                  # retained text is not returned as success

available + terminalState = terminated_without_outcome
  -> outcome_unknown                    # terminated with no proven outcome; any retained text
                                        # is never returned as success

no_output + terminalState in {completed, late_completed}
  -> reply_unavailable(reason=no_output)

no_output + terminalState in {failed, late_failed}
  -> target_run_failed

no_output + terminalState = terminated_without_outcome
  -> outcome_unknown

not_admitted
  -> not_admitted

evicted | restart_lost | never_existed
  -> reply_unavailable(reason=<state>)

pending
  -> continue waiting until event or reply deadline
```

Rationale for the F19 rows: `terminated_without_outcome` is a real late terminal outcome at BASE
(`packages/agent-router/src/reconciliation/state-machine.js:13`, `LATE_OUTCOMES`); r2's table had no row
for it, so a settled Run with that outcome matched nothing. It maps to `outcome_unknown` because the Run
terminated without a proven completed/failed outcome — exactly the proven-vs-unknown distinction this
contract preserves. It is never silently converted to `replied`, `target_run_failed`, or an empty reply,
and the truncated-text rule above still forbids returning retained text as success.

Thus a bounded tail with `truncated:true` is never silently called the exact reply, and text emitted before
a failed Run never becomes a successful tool result.

The handler must not replay the message, open a second Session, prompt A, prompt B again, or deliver to an
external channel. On reply-wait timeout:

```text
{ status: 'timeout' }
```

The timeout stops only A's wait. It does not cancel B's Run, active-steer it, or later push its output to A,
Feishu, Forum, or any other Product Surface. A later explicit tool call is a new send and a new Run.

Terminal failure/no output/evicted/restart-lost/terminated-without-outcome states return distinct
structured failures; none is silently converted to an empty reply or success.

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

**The L0/L1 audit surface is NEW code.** BASE has no durable capability-audit append surface in Broker or
Router. The two-phase pattern follows the existing scheduler self-service precedent: the `appendAudit`
evidence append with explicit append/append-failed status
(`packages/scheduler/src/self-service.js:235`) and the sanitized operations-visible failure wiring in the
production-runtime composition (`packages/production-runtime/src/compose.js:440-450`, `onAuditFailure`).
V1 reuses that pattern, not the scheduler's store: scheduler audit events remain scheduler-owned.

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

The coarse L1 `result` vocabulary stays closed as written (F23 does not grow it): `denied` records
authorization-class failures (`credential_unavailable`, `credential_invalid`, `access_denied`); `failed`
records every other terminal failure class — including the §5 classes `transport_failure`,
`unsupported_operation`, `not_admitted`, `queue_capacity_exceeded`, `target_run_failed`,
`reply_unavailable`, `outcome_unknown`, and `internal_error`. The model-visible envelope carries the
exact §5 class; L1 keeps the coarse bucket so the audit vocabulary stays closed.

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
transport_failure          # F23
unsupported_operation      # F23
internal_error
```

F23 taxonomy decision — `transport_failure` and `unsupported_operation` are **added to the taxonomy**
(not remapped onto existing outcomes), because both are permanent, precisely-defined emissions of this
capability's own gateway pipeline, and the existing envelope machinery would otherwise mislabel them:

- `transport_failure` — emitted when the auth-service/broker transport fails during the LOCAL grant
  check, before any handler runs (`packages/broker/src/gateway.js:246-248`). It must not degrade to
  `access_denied`: a grant-check outage is not an authorization fact, and reporting it as a denial would
  falsely tell the calling Agent it lacks permission. It must not collapse into `internal_error` either:
  the transport-outage signal is operations-visible state that `internal_error` would hide.
- `unsupported_operation` — emitted when the execute-time local handler cannot be resolved (missing or
  miswired provider; `packages/broker/src/gateway.js:171-174`). It must stay distinct from caller error:
  the fail-closed downgrade path surfaces undeclared codes as `invalid_arguments`
  (`packages/broker/src/mapping.js:146-153`), which would misreport a deployment/wiring gap as a model
  input fault.

Both classes are declared in the capability's manifest error table, keeping the model-visible vocabulary
closed (declared codes only; no free-form errors). A `transport_failure` is retryable only as a new
explicit send; no error path automatically retries a message whose admission may have occurred.

Error translation must preserve the distinction between proven zero delivery and unknown outcome. No
error path automatically retries a message whose admission may have occurred.

### 5.1 AMENDMENT_1 — two-dimension result model (normative mapping)

The capability MUST let a caller answer two independent questions mechanically, without inference from
one to the other: `WAS_MESSAGE_DELIVERED` and `DID_TARGET_REPLY`. The closed §5 parent-answered
envelope vocabulary is NOT extended (the single §5.3 child-synthesized `reconciled` exception is
scoped there); the two dimensions are defined by this normative, total mapping over it. Implementations
and callers MUST treat this table as the delivery/reply semantics of every code:

```text
DELIVERY_STATUS ∈ { DELIVERED, NOT_DELIVERED, UNKNOWN }
REPLY_STATUS    ∈ { NOT_WAITED, REPLIED, TIMEOUT, TARGET_FAILED, NO_OUTPUT, TRUNCATED, UNKNOWN }

{status:'accepted'}                        -> DELIVERED   + NOT_WAITED     (timeoutSeconds=0; receipt proven)
{status:'replied', reply}                  -> DELIVERED   + REPLIED
{status:'timeout'}                         -> DELIVERED   + TIMEOUT        (post-receipt; wait expired only)
reply_unavailable(truncated)               -> DELIVERED   + TRUNCATED
reply_unavailable(no_output)               -> DELIVERED   + NO_OUTPUT
reply_unavailable(evicted|restart_lost|
                  never_existed)           -> DELIVERED   + UNKNOWN        # evidence loss is never a reply fact
target_run_failed                          -> DELIVERED   + TARGET_FAILED
not_admitted | queue_capacity_exceeded     -> NOT_DELIVERED + NOT_WAITED   (proven zero prompt bytes)
target_not_found | target_disabled |
self_send_not_supported | invalid_arguments|
credential_unavailable | credential_invalid|
access_denied | transport_failure |
unsupported_operation                      -> NOT_DELIVERED + NOT_WAITED   (pre-handler / pre-delivery)
outcome_unknown (pre-receipt admission
               unproven)                   -> UNKNOWN     + UNKNOWN        (§5.3 reconciliation applies;
                                                                            AMENDMENT_2: includes process-boundary
                                                                            rejections — see the rows below)
outcome_unknown (post-receipt: receipt
               proven in the SAME invocation,
               exact Run later terminated
               without outcome — incl. target
               process death)             -> DELIVERED   + UNKNOWN        (AMENDMENT_2 phase split; canonical
                                                                            markers: render detail "after a proven
                                                                            inbox receipt" + audit failureReason
                                                                            'post_receipt'; same evidence-loss
                                                                            doctrine as evicted/restart_lost)
internal_error (pre-delivery emission)     -> NOT_DELIVERED + NOT_WAITED   (audit intent append failure;
                                                                              Router delivery count is zero)
internal_error (post-receipt malformed
               receipt)                    -> DELIVERED   + UNKNOWN        (canonical detail marker:
                                                                              "after a proven inbox acceptance")
internal_error (gateway catch-all, detail
               "local capability failed
               before commit")             -> UNKNOWN     + UNKNOWN        (unproven handler progress: the
                                                                              handler may have thrown pre- or
                                                                              post-receipt — never classified)
```

The `not_admitted` row is proven for pre-receipt emissions; a post-receipt `not_admitted` from the wait
settlement is mechanically unreachable today (every `settleDirect('not_admitted')` is a pre-write
zero-byte rejection) and is defensive-only.

`reply_unavailable` is by construction **post-receipt-only**: it is created exclusively after
`receipt.accepted === true`, at reply-wait settlement (`R8` closed mapping), and therefore always means
`DELIVERY = DELIVERED`. A caller MUST NOT treat `reply_unavailable`, `{status:'timeout'}`,
`target_run_failed`, or any reply-side state as evidence of non-delivery; `NO_AUTOMATIC_REPLAY` and
`NO_AUTOMATIC_RETRY` remain binding.

### 5.1a AMENDMENT_2 — AGENT_PROCESS_EXITED rows (unified delivery matrix)

Real incident corpus (owner goal AGENT_SESSION_SEND_RELIABILITY_V1, 2026-09-09):
`agt_soul-questioner-agent` generation 2 — `RPC session/prompt rejected: AGENT_PROCESS_EXITED`.
`AGENT_PROCESS_EXITED` is a process/runtime failure REASON; it MUST NEVER itself be a delivery
status. The delivery dimension is decided per the Router's OWN settled admission doctrine
(C-004/C-017: a write at the process/stdin boundary — in-flight at exit, or to an already-exited
process — cannot PROVE zero bytes; only a STRUCTURED rejection proves non-entry):

```text
structured pre-receipt rejection (SESSION_WORKSPACE_MISMATCH, proven_zero_byte_rejection,
AGENT_NOT_FOUND / AGENT_DISABLED, …)           -> NOT_DELIVERED + NOT_WAITED   (proven-zero-byte family:
                                                                            not_admitted / target_not_found /
                                                                            target_disabled; unchanged)
AGENT_PROCESS_EXITED at the admission boundary (in-flight at exit / process already dead)
                                           -> UNKNOWN     + UNKNOWN        (admission unproven by Router
                                                                            doctrine; §5.3 reconcile;
                                                                            STILL_UNKNOWN => NO_BLIND_REPLAY —
                                                                            fabricating NOT_DELIVERED here is
                                                                            the duplicate-licensing direction)
inbox receipt proven, target process exits mid-turn
    late settlement = late_failed          -> DELIVERED   + TARGET_FAILED  (target_run_failed; unchanged)
    late settlement = terminated_without_
    outcome (typical death), or the
    missing-handle / defective-terminal
    branches                               -> DELIVERED   + UNKNOWN        (post-receipt outcome_unknown row;
                                                                            reason visible — PROCESS_EXIT_REASON_
                                                                            VISIBLE — but never as delivery;
                                                                            a wait that merely EXPIRES on a
                                                                            still-pending Run stays {status:'timeout'}
                                                                            = DELIVERED + TIMEOUT per §5.1)
```

Exit-race note: when the child's `settleLate` wins before the pending-RPC rejection surfaces,
the capability seam may observe the exit as a plain declared-failure carrier — the §5.1
classification above is envelope-independent (the capability's default row catches both shapes
as unproven admission).

Unified matrix (normative): `reply_unavailable(<reason>) -> DELIVERED + reply failure`;
`target_run_failed (post-receipt) -> DELIVERED + TARGET_FAILED`; `AGENT_PROCESS_EXITED before/at
receipt -> UNKNOWN -> reconcile` (NOT_DELIVERED only via §5.3 when the L1 chain proves non-entry);
`AGENT_PROCESS_EXITED after receipt -> DELIVERED + UNKNOWN` (late_failed ⇒ DELIVERED +
TARGET_FAILED); `transport/parent-response ambiguity -> UNKNOWN -> reconcile`. A caller never
infers delivery from an error string: every row above is decidable from the closed code + the
§5.2 canonical markers.

### 5.2 AMENDMENT_1 — structured failure-code visibility

Two visibility requirements so the §5.1 mapping is decidable from surfaces, not from code reading:

1. **Model-visible render.** The child-side tool render for this capability's declared failures MUST
   include the structured detail (e.g. `reply_unavailable (truncated)`, `outcome_unknown
   (parent_rpc_ambiguous …)`), not the bare code. This is render text of the already-closed envelope;
   no new envelope field is introduced.
2. **L1 outcome rows.** The L1 `outcome` audit row for a `failed` result MUST additionally persist the
   structured failure code (bounded, secret-free, e.g. `failureCode: 'reply_unavailable'`), and the
   intent/outcome rows MUST persist the §5.3 `invocationCorrelation`. Without this, the per-reason
   delivery history is unrecoverable from evidence (finding E2 of the phase-1 investigation: today's
   `result:'failed'` bundles all reply-side failures and no persisted surface records the reason).
   AMENDMENT_2: a post-receipt `outcome_unknown` row MUST persist `failureReason: 'post_receipt'`
   (mirroring the internal_error split) so the §5.1 phase split and the §5.3 conversion are
   surface-decidable; a process-exit reason (`AGENT_PROCESS_EXITED` / router unknown source) rides
   the row and the render detail as REASON ONLY — never as a delivery dimension
   (PROCESS_EXIT_REASON_VISIBLE). The mechanical reason source is the reconciliation record's
   settled snapshot (`terminationEvidence` / `errorClass`, reachable via `getTurnReconciliation`)
   — `readFinalAssistantOutput` exposes only `terminalState`; implementers must read the
   authoritative snapshot, never map from event payloads (R9.5).

### 5.3 AMENDMENT_1 — bounded outcome reconciliation (CASE A–G)

The ambiguous seam is the lost/unusable **parent-RPC response** for an already-executed send. For that
seam only:

```text
ANCHOR (new, trusted-channel-only):
  invocationCorrelation = opaque child-minted id minted by the calling runtime for EXACTLY ONE
  agent_session_send RPC invocation; carried at the parent-RPC trusted boundary (like rpcMeta, never
  a model-visible argument — R2 untouched); persisted verbatim in the L1 intent and outcome rows.
  Spoof-resistance: the lookup is bound to the GATEWAY-DERIVED caller (sourceAgentId from the trusted
  context, never from arguments) — a caller can only ever reconcile its own sends; the anchor
  correlates rows, it confers no identity.

RECONCILE SURFACE (new, read-only):
  sibling LOCAL capability agent_session_send_reconcile, operation lookup,
  args = { invocationCorrelation }, requiredScopes = ['agent.session.send'].
  Executed in the parent gateway against the SAME L1 audit chain. It MUST NOT be presented as a
  model tool: the manifest carries an `infrastructure: true` marker and the broker tool
  presentation (index.js plugin apply — "manifests to register as tools", each mapping to ONE
  tool) filters such manifests out of the model inventory, while the gateway keeps
  validating/executing them over the trusted RPC channel (apply() and the gateway receive the RAW
  manifests, so the filter sees the marker; caveat: validateManifest's allowlist rebuild drops
  unknown top-level keys, so any future path that round-trips manifests through it BEFORE apply()
  would silently lose the marker — the one-line schema copy for `infrastructure` is then required).
  Read-only: zero Router delivery, zero Session mutation, bounded single exact-key lookup.

RELAY DUTY (mirrors SCHEDULER §5.2):
  At the two unknown capture points (transport loss; structurally unusable parent envelope), the child
  relay issues EXACTLY ONE lookup over the same channel as the SAME caller, then converts.
  Envelope scoping: §5.1's closed vocabulary remains untouched; AMENDMENT_1 adds EXACTLY ONE new
  caller-visible result shape, the `reconciled` envelope below, and it is CHILD-SYNTHESIZED ONLY —
  the parent can never return it (a `reconciled` result in a parent envelope fails
  validSessionSendResult and degrades to the ambiguous error, as today), and the two capture points
  are the only sites that produce it:
    intent + outcome(accepted)          -> {status:'reconciled', delivery:'DELIVERED',   replyStatus:'NOT_WAITED'}
    intent + outcome(replied)           -> {status:'reconciled', delivery:'DELIVERED',   replyStatus:'REPLIED',
                                            replyTextAvailable:false}                   # text never persisted
    intent + outcome(timeout)           -> {status:'reconciled', delivery:'DELIVERED',   replyStatus:'TIMEOUT'}
    intent + outcome(failed)            -> delivery/replyStatus per §5.1 from the persisted failureCode
                                           (+failureReason; AMENDMENT_2: failureCode outcome_unknown
                                           with failureReason 'post_receipt' => DELIVERED + UNKNOWN)
    intent present, outcome absent      -> {status:'reconciled', delivery:'UNKNOWN',     replyStatus:'UNKNOWN'}
    intent row absent WITHIN RETAINED
    EVIDENCE (live .jsonl + rotated .1) -> {status:'reconciled', delivery:'NOT_DELIVERED', replyStatus:'NOT_WAITED'}
                                           # intent append strictly precedes delivery, so absence proves
                                           # the send never entered the handler — but ONLY while the
                                           # retention window provably covers the invocation window
  Lookup persistence honesty: the L1 chain is FILE-BACKED (rotating JSONL inside the control dir:
  live file + one-deep `.1` at the 8 MiB cap) and SURVIVES control-plane restarts — the lookup MUST
  read both files; refusing surviving evidence would be dishonest. Rotation is the only evidence
  loss: an intent row expired by rotation MUST NOT be reported NOT_DELIVERED (that is the dangerous
  direction — it licenses a duplicate send); an expired anchor resolves to UNKNOWN. NOT_DELIVERED
  therefore requires provable retention coverage of the invocation window. Durable persistence
  BEYOND the rotating evidence window remains a §6 non-goal. UNKNOWN is final for that invocation:
  NO_AUTOMATIC_RETRY; the caller may only issue a NEW explicit send.

CASE CONTRACT (goal AGENT_SESSION_SEND_RELIABILITY_V1):
  A receipt committed + response lost  -> reconcile DELIVERED, target inbox count 1, Run count 1,
                                          no redelivery.
  B lost before receipt (provable)     -> NOT_DELIVERED; only UNKNOWN when unprovable.
  C receipt + reply deadline           -> DELIVERED + TIMEOUT.
  D receipt + Run failed               -> DELIVERED + TARGET_FAILED.
  E receipt + completed, no output     -> DELIVERED + NO_OUTPUT.
  F truncated output                   -> DELIVERED + TRUNCATED.
  G receipt unprovable                 -> UNKNOWN via §5.1/§5.3; bounded reconciliation as above;
                                          UNKNOWN is final => NO_AUTOMATIC_RETRY, evidence retained
                                          (L1 rows + reconcile conversion are the evidence chain).
```

`SAME_LOGICAL_INVOCATION_TRANSPORT_REPLAY` (suppressed: relay never re-issues the send; reconciliation
is read-only) and `SECOND_INTENTIONAL_AGENT_SESSION_SEND` (a new invocationCorrelation, a new Run) stay
distinguishable by the anchor. Exactly-once is unchanged: one send invocation ⇒ at most one inbox
receipt and at most one target Run; reconciliation NEVER re-delivers.


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
- `failed`, `late_failed`, `no_output`, `truncated`, `evicted`, `restart_lost`, `never_existed`, and
  `terminated_without_outcome` never become successful replies;
- a Run settling to `terminated_without_outcome` returns `outcome_unknown` in both receipt-then-wait and
  already-settled orderings (F19);
- a grant-check transport outage surfaces as `transport_failure`, never as `access_denied`; a missing
  handler provider surfaces as `unsupported_operation`, never as `invalid_arguments` (F23);
- an Agent whose source Run itself came from A2A can send onward with an exact runtime-proven source-turn
  correlation, without propagating Binding or external-route leaves;
- L1 intent append failure causes zero Router deliveries; outcome append failure after receipt preserves the
  proven business result and emits operations-visible degradation;
- target reply-wait timeout does not cancel, replay, announce, or externally deliver the late result.

### AMENDMENT_1 mandatory cases (goal AGENT_SESSION_SEND_RELIABILITY_V1)

> Naming note: "CASE A–G" and "T1–T14" below are the OWNER GOAL's enumerations
> (AGENT_SESSION_SEND_RELIABILITY_V1 REQUIRED TESTS / OUTCOME RECONCILIATION), deliberately distinct
> from the r3 §7 scenarios "Case A–I" above.

- §5.1 mapping is mechanically exercised for every envelope: each caller-visible code/shape resolves to
  the normative DELIVERY_STATUS × REPLY_STATUS pair by a total test (T1–T6, T11–T14 analogues);
- receipt committed + parent response deliberately dropped → single reconcile lookup converts to
  `{status:'reconciled', delivery:'DELIVERED', …}`, target inbox count = 1, target Run count = 1,
  duplicate delivery = 0 (CASE A; T7);
- response lost before handler entry (no intent row) → reconcile `NOT_DELIVERED`, delivery count = 0
  (CASE B; T8); intent row present without outcome row → reconcile `UNKNOWN`, never fabricated
  DELIVERED/NOT_DELIVERED;
- reply deadline expiry after receipt → `{status:'timeout'}` and delivery dimension DELIVERED with
  delivery count remaining 1 (CASE C; T3);
- Run failed / no_output / truncated → DELIVERED + TARGET_FAILED / NO_OUTPUT / TRUNCATED respectively
  (CASES D–F; T4–T6);
- duplicate RPC replay of the SAME invocation → exactly one inbox receipt and one target Run; the
  replay is answered without a second Router delivery (T9);
- true unresolved ambiguity (intent row expired out of the rotating retention window; unusable
  lookup) → reconcile UNKNOWN is final, no automatic replay of any kind fires (T10); a control-plane
  restart does NOT by itself destroy evidence (file-backed L1 rows are read across restarts);
- `invocationCorrelation` is absent from every model-visible schema surface (R2 closure intact) and is
  persisted in intent + outcome rows; `agent_session_send_reconcile` is filtered from the model tool
  inventory via the `infrastructure: true` marker (still gateway-executable over the trusted channel);
- the model-visible render carries the structured failure detail for declared failures (§5.2), and L1
  outcome `failed` rows persist `failureCode` (§5.2);
- a real production `reply_unavailable` reproducer classifies mechanically as DELIVERED + <reason> via
  §5.1 without any caller-side inference (T14).

### AMENDMENT_2 mandatory cases (real incident corpus: AGENT_PROCESS_EXITED)

- T_PROCESS_EXIT_1: target process dead/dead-dying at the admission boundary → the Router's
  admission-unproven classification yields `outcome_unknown` (UNKNOWN + UNKNOWN), delivery count
  provably not claimable either way by the caller, §5.3 reconcile runs read-only, and STILL_UNKNOWN
  ⇒ NO_BLIND_REPLAY; a STRUCTURED proven rejection in the same seam still returns not_admitted
  (NOT_DELIVERED, delivery count 0, Run count 0);
- T_PROCESS_EXIT_2: inbox receipt committed → target process exits before the final reply → the
  post-receipt row applies: render detail marks delivery proven ('after a proven inbox receipt'),
  audit row carries failureCode outcome_unknown + failureReason 'post_receipt', §5.3 lookup converts
  to `{status:'reconciled', delivery:'DELIVERED', replyStatus:'UNKNOWN'}`, delivery count 1,
  NO_AUTO_RETRY holds; a late_failed settlement instead yields target_run_failed (DELIVERED +
  TARGET_FAILED);
- T_PROCESS_EXIT_3: ambiguity at the receipt/process-exit boundary → UNKNOWN → bounded reconcile →
  deterministic where the evidence allows, STILL_UNKNOWN otherwise, NO_BLIND_REPLAY;
- PROCESS_EXIT_REASON_VISIBLE: the process-exit reason is preserved in the model-visible render
  detail AND the L1 row, and is never presented as a delivery status.

## 8. Predicted implementation scope — not authorized

After this Spec is independently accepted (the governing Decision alignment already exists as accepted
D-008 / V3 per §2.2), predicted code scope is — implementation itself remains unauthorized until a
separate implementation-authority grant exists:

```text
packages/broker
  - agent_session_send local capability manifest and inventory tests
    (manifest error table declares transport_failure / unsupported_operation — F23)
  - reuse existing local relay (relay.js:153-155 already relays local manifests);
    no relay.js repair; add local-manifest relay-path test coverage — BASE relay
    tests are http-only (F8/G8 note)
  - localHandlerResolver closure generalization in packages/broker/src/index.js:
    BASE index.js:272-275 is a closed two-service merge (agentDefinitionAccess +
    selfServiceSchedulerAccess) and cannot resolve a third provider name without
    this edit; extend it to admit agentSessionMessagingAccess (F9)
  - authoritative trusted-handler validation tests

packages/production-runtime
  - agentSessionMessagingAccess local handler provider/wiring
    (ctx.provide pattern, BASE compose.js:433-450)
  - L0/L1 audit append surface: NEW code — no generic capability-audit surface
    exists at BASE; follows the scheduler self-service precedent
    (self-service.js:235 appendAudit; sanitized onAuditFailure wiring
    compose.js:440-450) without reusing the scheduler store (F22)
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

Current main already contains the local capability relay fix and the execute-time local handler resolver
mechanism identified during PR #130 research. No `relay.js` repair should be reintroduced unless a fresh
current-main audit finds a new defect; the resolver closure edit above is the only predicted
`packages/broker/src` source change besides the manifest.

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

1. that the recorded whole-authority alignment matches this Spec's contract — accepted D-008 /
   `AGENT_WORKSPACE_SESSION_MODEL_V3` freezes `AGENT_TO_AGENT_MESSAGING_SESSION_SCOPE = TARGET_MAIN`
   and “one send = one new Run/Turn, not one new Session” (V3:363–376, 381–388), supersedes V2 whole,
   and defers implementation to V3 §29 (V3:976–999) — and that no further Decision amendment is required
   for acceptance (F10; replaces r2's review item on authoring the transition);
2. the frozen `timeoutSeconds=0..300` bound and receipt-relative reply deadline;
3. exact DSH `inter_agent` message-source augmentation at the pinned runtime version;
4. whether self-send rejection is sufficient for V1 queue safety;
5. error mapping for Router `outcome_unknown`, `terminated_without_outcome` (F19), and reply
   reconciliation absence states.

```text
TASK_NAME = 会话 规格
OPENCLAW_MODEL = reuse target Agent main Session; each send creates one new Run/Turn, not one new Session; timeout=0 returns after receipt, timeout>0 may wait for that exact Run's one reply
CURRENT_ROUTER_REUSE = PARTIAL
PROVENANCE_GAP = YES
WAIT_REPLY_GAP = YES
GOVERNING_DECISION = AGENT_WORKSPACE_SESSION_MODEL_V3 (D-008, accepted; supersedes V2 whole)
DECISION_ALIGNMENT_REQUIRED = NO
PROPOSED_SPEC = AGENT_CORE_AGENT_SESSION_MESSAGING_V1
PR130_DISPOSITION = CLOSE
IMPLEMENTATION_SCOPE = Broker local capability + resolver closure generalization + trusted provenance sidecar + thin reconciliation wait helper + NEW L0/L1 audit surface + production wiring/tests; no new Session/Scheduler subsystem
PRODUCT_CODE_CHANGE = NONE
PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
NEXT_TASK = 会话 审计
```

## 11. AMENDMENT_1 record (r4 — ACCEPTED via PR #202 @ 8994aa5; AGENT_SESSION_SEND_RELIABILITY_V1)

```text
AMENDMENT_1_GOAL = AGENT_SESSION_SEND_RELIABILITY_V1
AMENDMENT_1_CLASSIFICATION =
  reply_unavailable production blocker -> IMPLEMENTATION/EXPRESSION gap (class A):
    post-receipt-only by construction; §5.1 makes the already-true semantics normative
  outcome_unknown reconciliation -> NEW NORMATIVE SEMANTIC (§5.3): not derivable from accepted r3;
    mirrors the SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.2 state machine with a session-send anchor
DEPLOYMENT_REGRESSION = NO (live tree 2026-09-05 session-send chain == origin/main 1cde3cc,
  hash-compared; evidence: docs/evidence/agent-session-send-reliability-v1-20260908)
WIRE_BREAK = NONE at the parent-answered surface (the closed §5 vocabulary every normal send response
  uses is unchanged; the anchor lives at the parent-RPC trusted boundary; reconcile surface is
  infrastructure-only). EXACTLY ONE new child-synthesized caller-visible shape is added by §5.3 (the
  `reconciled` envelope at the two unknown capture points) — see §5.3 Envelope scoping.
DEPLOYMENT_AUTHORITY_NOTE = implementing §5.3 after acceptance requires a fresh authority round under
  AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY_V1 (its AUTHORIZED_RELEASE_SOURCE is frozen);
  this amendment changes no production bytes and grants no deployment authority.
NEW_CAPABILITY = agent_session_send_reconcile (LOCAL, read-only, `infrastructure: true` manifest
  marker filtered from tool presentation, gateway-executable)
GRANT_CHANGE = NONE (reuses agent.session.send; no new native/admin authorization)
PRODUCTION_CHANGE = NONE (this amendment is docs-only; implementation follows acceptance;
  production apply remains HOLD_WHILE_P0_OWNS_SLOT per the owner goal)
ANTI_CHURN_MAP =
  SHIP_BLOCKER = §5.1 normative mapping + §5.3 reconciliation (unblocks unattended HR dispatch)
  MECHANICAL_FIX = §5.2 visibility (render detail + failureCode persistence)
  FOLLOW_UP_DEBT = production per-reason distribution read (Owner-side collector, selftest PASS)
READY_FOR_INDEPENDENT_REVIEW = YES
```

AMENDMENT_1 review must specifically decide:

1. whether the §5.1 total mapping is exhaustive and correct for every closed-taxonomy emission,
   including the `internal_error` pre-delivery vs post-receipt split;
2. whether the child-minted `invocationCorrelation` anchor is spoof-resistant enough given the existing
   R3 trusted-channel proof (child identity is gateway-derived; the anchor only correlates rows);
3. whether reconcile-once (exactly one lookup per unknown capture point) is sufficient without a
   bounded retry of the lookup itself on transient lookup failure;
4. whether `replyTextAvailable:false` (reply text never persisted) is the honest terminal for a lost
   `replied` response, or whether callers require a follow-up read surface (V1 answer: no — non-goal);
5. rotation-honesty: the L1 chain is file-backed and survives restarts (lookup MUST read live + `.1`);
   the accepted terminal is that an anchor expired by ROTATION resolves to UNKNOWN (never
   NOT_DELIVERED — the duplicate-licensing direction), i.e. durable persistence beyond the rotating
   evidence window stays a §6 non-goal while surviving evidence is always read.


## 12. AMENDMENT_2 record (r5, PROPOSED — AGENT_SESSION_SEND_RELIABILITY_V1, AGENT_PROCESS_EXITED corpus)

```text
AMENDMENT_2_TRIGGER = real production incident agt_soul-questioner-agent gen2
  ('RPC session/prompt rejected: AGENT_PROCESS_EXITED'); owner directive adds it to this goal's
  failure corpus with required CASE A/B/C semantics
SEMANTIC_DELTA =
  1. §5.1 outcome_unknown row split by phase: post-receipt (receipt proven in-invocation)
     -> DELIVERED + UNKNOWN (was unconditionally UNKNOWN + UNKNOWN — the accepted r4 mapping
     conflated proven-delivery unknowns with unproven admissions; independent-implementation-audit
     r1 had recorded the conflation as conservative-acceptable; the incident corpus proves it
     hides a PROVEN delivery fact from the caller, which the owner directive forbids)
  2. §5.1a AGENT_PROCESS_EXITED rows: process-boundary rejections follow the Router's settled
     admission doctrine (C-004/C-017 — stdin in-flight writes cannot prove zero bytes), so
     NOT_DELIVERED is NEVER fabricated at that boundary; structured proven rejections keep
     not_admitted; post-receipt death rides the post-receipt row (late_failed keeps
     target_run_failed naturally)
  3. §5.2 failureReason 'post_receipt' marker on post-receipt outcome_unknown rows + render detail
     'after a proven inbox receipt' (mirrors the accepted internal_error split pattern)
  4. §5.3 conversion: outcome_unknown + post_receipt => DELIVERED + UNKNOWN
  5. §7 T_PROCESS_EXIT_1/2/3 + PROCESS_EXIT_REASON_VISIBLE
BOUNDARY = process lifecycle root cause / restart / canonical-main recovery belong to
  AGENT_PROCESS_EXITED_RECOVERY_V1 — this amendment only consumes its mechanical evidence classes
WIRE_BREAK = NONE (codes unchanged; phase split is marker-decidable per §5.2)
GRANT_CHANGE = NONE; PRODUCTION_CHANGE = NONE
READY_FOR_INDEPENDENT_REVIEW = YES
```

AMENDMENT_2 review must specifically decide:

1. whether the post-receipt DELIVERED + UNKNOWN classification is honest (vs fabricating
   TARGET_FAILED for a store that does not claim a Run failure);
2. whether the Router C-004/C-017 boundary doctrine is correctly consumed (no Router change
   implied) and NOT_DELIVERED is never fabricated at the process boundary;
3. whether the post_receipt marker pattern is surface-decidable enough for the caller;
4. whether late_completed/late_failed settlements still route through the unchanged R8 mapping.
