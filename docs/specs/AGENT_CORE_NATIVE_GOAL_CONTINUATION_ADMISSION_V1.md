---
spec_id: AGENT_CORE_NATIVE_GOAL_CONTINUATION_ADMISSION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
owners: [mayf3]
date: 2026-10-27
repository: mayf3/dsh-agent-core
authoring_base: 28eee2403e92f3104fce8e153567b395ee187280
scope:
  - native same-session goal continuation entry into Router-owned prompt admission
  - consumer integration with an awaited native goal enqueue extension
  - exact-round lifecycle proof and isolated conformance
governed_by:
  - AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V4
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V2
related_specs: []
external_authorities: []
supersedes: []
superseded_by: null
---

# Native goal continuation admission V1

## 1. Goal

Enable a native goal's later automatic turns to use valid parent-owned source execution proof, without human prompts at each turn or changing the messaging guard.

## 2. Scope and non-goals

Architecture remains controlling: DSH owns goal/loop/inbox/session history; Router owns process/admission; Broker owns external capabilities. No new goal scheduler, grant, business ledger, Session identity mapping, parent-spawn permission, HR task policy, historical recovery, or production operation is included. In particular this does not retry the old HR cron occurrence or settle any historical UNKNOWN.

## 3. Authority and dependencies

**Proposed, docs-first; no implementation or production activation is authorized by this draft.** On acceptance and merge, this independent integration Contract permits Agent Core to consume one awaited native goal enqueue extension and route each continuation through its existing Router admission owner. It does not replace the native goal driver or make an entire goal one execution.

`AUTHORITY_ACTION=NEW`, `PLAN_LEVEL=EXEC_PLAN`, `ASSURANCE_LEVEL=CONTROLLED`, `ROUTE_STAGE=AUTHORITY_AUTHORING`, `AUTHORITY_ACCEPTED_IN_BASE=NO`. The task authorizes this draft and isolated documentation only. Exact-head acceptance belongs to `mayf3` or an explicitly delegated maintainer under repository-local rules; independent review is not acceptance.

The missing decision is permission and lifecycle for a **runtime-origin continuation entry after the previous source execution has settled**. Lifecycle V4 C-010/C-013 require new prompt paths to use owned admission, but do not alone authorize this new child-to-parent entry. This additive integration leaves their one-execution-per-matched-native-turn, queue, deadline, settlement, reconciliation and UNKNOWN/fence semantics unchanged. Messaging V2 CTR-ASM2-002 still rejects missing/stale source proof before any target delivery. No model-supplied turn ID becomes authority. If implementation needs to change either accepted meaning, re-PREFLIGHT to the appropriate whole-authority successor; this Spec cannot silently do so.

The upstream `deepseek-harness` enqueue hook is a dependency. Its source work must follow that repository's AGENTS/protocol and the attributable task mandate. This consumer Spec does **not** claim authority over that repository. The inspected source is `514ab7b0029141b88c807704764d0d3e1eea1da4`, `packages/goal/goal-round-driver/src/index.ts`; a new isolated fork candidate must be pinned for implementation evidence. Installed artifacts are not patched.

## 4. Current State

**STATE-NGC-001 —** Agent Core continuation integration is unimplemented at source `28eee2403e92f3104fce8e153567b395ee187280`, inspected locally on 2026-10-27; the native dependency source is `514ab7b0029141b88c807704764d0d3e1eea1da4`. Basis: OBS-NGC-002 and CLM-NGC-001. These are source coordinates, not a claim about loaded production memory. This draft's tests are all NOT_RUN.

## 5. Observations

**OBS-NGC-001 —** Subject: HR native cron session `cron-run-occ:f68f63be76a3736a`; environment: existing public session journal, read-only sanitized audit; source/provenance: `hr-native-goal-source-proof-investigation-20261027.json`, SHA256 `924ec72bed473ab5dd5fae4aa2a45cb2ce188c31c4130e1b11583e96a6fa3288`, retained under `/Users/yanfenma/workspace/artifacts/workflow-acceptance-binding-20261027/`. Method/result: the sealed audit counted five accepted sends in the initial native turn, then fifteen `trusted source turn proof missing or stale` failures across its next three automatic goal turns. Observation date: 2026-10-27; exact event timestamps and sequence coordinates remain in that source, not a newly invented runtime observation.

**OBS-NGC-002 —** Subject: enqueue/proof source path; environment: clean Agent Core source worktree and read-only upstream source; inspected on 2026-10-27, recorded at `2026-10-27T01:00:31Z`; revisions: Agent Core `28eee2403e92f3104fce8e153567b395ee187280`, native source `514ab7b0029141b88c807704764d0d3e1eea1da4`. Method/result: source read shows `packages/demo-server/src/index.js` scopes RPC proof to incoming `session/prompt`; `session-seam.js` calls native followup; `packages/goal/goal-round-driver/src/index.ts:174–192` reserves and directly invokes synchronous `agent.followup(message)`. Native `agent/pre-step` follows `turn/start`; no awaited enqueue extension exists in the inspected driver. Provenance: those exact pinned source files and the investigation above.

## 6. Claims and assumptions

**CLM-NGC-001 — SUPPORTED:** the inspected source lacks the proposed pre-enqueue parent-admission integration. Supported by EVD-NGC-002; no contrary source observation found. This is not proof that every historical failed RPC had absent metadata: the error coalesces missing and stale proof, and historical loaded-memory binding remains UNKNOWN.

**CLM-NGC-002 — INFERRED:** this missing integration can explain the recorded later-turn failures and justifies the bounded integration decision. Supported by EVD-NGC-001/002; no contrary observation found. Exact historical absent-versus-stale classification and causal runtime readback remain UNKNOWN, and are not prerequisites for testing the explicit future Contract.

## 7. Evidence relations

| ID | Source observation → target; relation | Coordinates, sufficiency, limitations and provenance |
|---|---|---|
| EVD-NGC-001 | OBS-NGC-001 → CLM-NGC-002; SUPPORTS | Exact public HR session in the SHA-pinned audit, 2026-10-27. Strong for observed successes/failures, insufficient to distinguish absent from stale parent proof or certify loaded modules; provenance is the sealed audit and its public-event references. |
| EVD-NGC-002 | OBS-NGC-002 → CLM-NGC-001 / CLM-NGC-002; SUPPORTS | The two source revisions in OBS-NGC-002. Sufficient for missing source integration, supports the causal inference only; not executed conformance or production binding. Provenance: pinned demo-server, parent-relay and native-driver source. |

## 8. Decisions

**DEC-NGC-001 —** Use a native **awaited enqueue extension**, not an async monkeypatch of `followup(): void`. Native driver retains its current round selection, durable checkpoint, reservation, cap, cancellation and pre-step checks. Its pending admission belongs to that same reservation and teardown lifecycle. Standalone native composition retains its explicit native mode; Agent Core composition explicitly requires the parent-owned provider. There is one active driver, not two alternative implementations of the same goal policy.

Proposed interface names are implementation coordinates, not model tools:

1. Native driver calls an awaited `enqueue({ agent, message, signal, commit })`. `message` is the exact native message; `commit()` is a driver-owned, at-most-once closure that rechecks the exact live reservation and then synchronously performs native `followup` of that object. Its result distinguishes enqueued, definitely not enqueued and outcome unknown. The driver awaits completion, tracks invalidation and abort, and never treats an ignored Promise as synchronous success.
2. Agent Core provider registers a bounded process-local opaque reservation, retaining that exact message and closure. It requests the private parent RPC `agent-core/nativeGoalContinuation` for its own already-live session. The request contains the reservation ID, exact session/message/goal/revision/round, and immutable prompt content/digest needed for input bounds and consistency. Identity and process generation come from the actual parent-owned child, never these fields. This is no Broker capability or model-facing endpoint.
3. Parent applies stop, generation, lineage, UNKNOWN, queue-cap and input gates, and routes through the same `AgentProcess` admission queue in receipt-only mode. It mints a new execution, records it, establishes watermark/matcher/deadlines, then writes `session/prompt` with a private exact-reservation sidecar. It neither directly calls child `followup` nor reuses the previous turn's handle.
4. Child handles that sidecar only against its live reservation registry and matching session/immutable message. Within the incoming new handle's AsyncLocalStorage context it calls the driver closure once, returning the **original messageId** only after native enqueue. It does not reconstruct a generic user/workflow message or change goal source/content. Parent binds this receipt and tracks terminal/UNKNOWN with the existing machinery. RPCs in that native turn consequently carry the new handle.

The parent may wait for its old execution to settle/release without awaiting the new turn's terminal in the callback response. The child must remain able to process the incoming `session/prompt` while its outbound admission RPC is pending. That cycle is tested explicitly; returning a receipt does not release the parent queue early.

## 9. Contracts

### CTR-NGC-001 — entry eligibility and authority

Only the installed runtime integration on the bound, READY AgentProcess may request this entry, for an already-live native session owned by that same process generation and an active, armed exact native goal reservation. The parent validates wire shape and actual caller/generation; the child driver validates goal authority and reservation again at commit. No caller can select another Agent, create/resume a different Session through this entry, inject a turn handle, claim channel ingress provenance, or gain a Broker grant. A stop/fence, missing required integration, malformed or mismatched reservation fails closed before enqueue. Native default mode is not an Agent Core fallback when parent-owned mode is required.

### CTR-NGC-002 — one new owned execution per round

Every enqueued automatic round uses the existing bounded parent queue and a distinct Router-minted execution/handle before prompt bytes, with exact watermark, session, original messageId, goal source and turn correlation. Existing Lifecycle V4 deadlines, single-flight ownership and terminal/UNKNOWN settlement apply without extension of a prior execution. Admission must not deadlock on the previous queue owner or allow an unrelated queued prompt to execute under the continuation's proof. Broker source verification remains unchanged: new valid proof works; previous settled, foreign-generation and absent proof fail before target delivery.

### CTR-NGC-003 — awaited reservation, cancellation and at-most-once commit

Driver pending admission is part of its existing exact reservation, not a second goal state machine. Goal edit/revision change, pause, block, completion, cancellation, disposal, competing ordinary input and plugin teardown invalidate or suppress the pending round according to native authority. Recheck after every await and immediately before commit; preserve native pre-step checks as well. Invalidated work cannot later enqueue through a delayed reply. Teardown aborts pending admission, prevents late commit and awaits bounded completion. Duplicate reservation requests, callbacks or receipts cannot enqueue twice or mint a second execution for the same attempt. An unaccepted stale reservation does not consume `roundsStarted`.

### CTR-NGC-004 — bounded failure and reconciliation

Reuse existing queue/input/RPC limits and absolute deadlines; every pending reservation and wait is bounded. Pre-write cancellation must remove/reject that exact queued entry so timeout cannot leave a late prompt write. Once write/enqueue acceptance is uncertain, preserve existing `outcome_unknown` and reconciliation/fence authority; disarm automatic continuation rather than replaying, changing request identity, or treating silence as rejection. A lost final admission response after proven enqueue must not cause another commit. The exact execution's native evidence may reconcile it; loss of a callback alone does not prove zero side effects. Retain the original failure and sanitized coordinates, and never clear a fence merely because the goal is blocked/disarmed. Definite pre-enqueue denial also stops/disarms this automatic attempt; this slice adds no automatic retry policy.

### CTR-NGC-005 — composition and compatible activation

Agent Core must verify the native awaited-hook capability and parent/child continuation protocol at initialization, before enabling automatic goal admission. Missing or incompatible required components reject activation of this path with a concrete diagnostic; they cannot silently use direct native `followup`. Preserve ordinary non-goal prompt behavior. Rollout/rollback preparation binds both repository commits, built artifacts, selected profile and loaded child generation. A composition lacking the bridge cannot inherit armed automatic authority from the new composition. Existing native resume/load disarming remains in force. Production application, restart, credential/grant changes and recovery remain outside this Spec's permission. Normal provider authentication through an already authorized path is not prohibited; authorization for secret export, credential copying or new access is not implied.

### CTR-NGC-006 — evidence and real automatic Round 2

Sanitized receipts expose enough to join process generation, native goal/revision/round, original messageId, new execution handle, queue/write/receipt/terminal outcome and stop/reconciliation disposition. Do not persist reasoning, request headers, secrets or fabricated provenance as evidence. Source tests, boot, scripted-model tests and a successful initial turn are distinct from the required real-model native continuation evidence. Verify a continuation **after** the prior execution settled; neither manually calling parent prompt twice nor two scheduler jobs proves this Contract. No result certifies semantic business acceptance or remediation of the old HR occurrence.

## 10. Acceptance

All methods use owned isolated test homes/workspaces, an isolated parent Router and explicit test Agents, not existing production homes, fleet, services, workflow instances or external messaging targets. A synthetic, unregistered test home may use the normal same-user canonical root when existing workspace authority requires that path; path placement does not enroll it in the production fleet. Reuse only already authorized provider authentication references, without copying credentials or printing secret values. Deterministic cases use a scripted provider. The real-model case uses an explicitly authorized existing provider path with bounded spend/time and no exposed credentials. Record commands, source/artifact/profile pins, actual exit and public events; an unexecuted or skipped required case remains NOT_RUN.

| Acceptance | Contracts | Method and required evidence | Expected result / failure condition |
|---|---|---|---|
| ACC-NGC-001 | 001, 002 | Composed parent/native-driver test: initial turn settles, then native rounds 1 and 2; join original messages, parent admission/write/settlement and outgoing Broker proof. Include absent/stale/foreign proof negatives. | Different valid handles per matched turn, prior execution settled before later admission, actual source send accepted; invalid proofs cause zero target deliveries. Missing relation or reuse of old handle fails. |
| ACC-NGC-002 | 001, 003 | Await-barrier tests with the real native driver: edit goal while waiting; cancel/pause/block/complete; dispose/unload; competing ordinary prompt. Preserve before/after goal/queue/events and exact callback count. | Invalidated reservation never commits late, cap/round count stays native-correct, ordinary input retains its own execution, shutdown finishes bounded. A post-invalidation enqueue or abandoned live wait fails. |
| ACC-NGC-003 | 002, 004 | Delayed parent idle/queue release, occupied queue, stop/fence/cap denials, queued-request deadline, and parent request while child awaits callback. Observe real queue ordering, writes and receipts. | No deadlock, no write without admission, no early queue release, no post-deadline orphan write, unchanged limits. Timeout alone cannot become definite non-enqueue. |
| ACC-NGC-004 | 003, 004, 006 | Inject lost response before enqueue and after accepted enqueue; duplicate request/callback; delayed commit after cancellation; reconcile exact receipt/terminal using native and Router records. | At most one enqueue/execution per attempt; uncertainty retained until exact evidence; no automatic replay or replacement key; fences and history preserved. Merely asserting UNKNOWN without executing fault fails. |
| ACC-NGC-005 | 001, 005 | Composition matrix: matching pair, old native/no hook, missing provider, old parent/no protocol, resume/restart with old artifacts; ordinary user and inter-agent controls. | Required-mode incompatibility is visible and blocks automatic path; zero silent direct continuation; controls preserve old semantics; no inherited armed state. A boot-only handshake is insufficient. |
| ACC-NGC-006 | 002, 006 | Real provider + real native GoalService/driver + real demo-server/Router/Broker, two isolated test Agents. One initial instruction starts a bounded goal; its automatic rounds 1 and 2 each request a distinct nonce via existing messaging tool from test peer. No per-round human prompt. Capture public source and peer messages, exact parent handles, receipts, loaded pins, exit/cleanup. | Both automatic rounds execute after prior matched turn settlement with distinct valid proof and target acceptance; no manual Round 2 injection or scripted-model substitution. A refusal/provider failure is recorded as such, not mechanism PASS; bounded failures stop the run. |

## 11. Alternatives and disposition

**ALT-NGC-001 — rejected:** async monkeypatch of `followup(): void`; the existing driver does not await its result and can retire/change a private reservation while the wrapper waits. `AgentSetup` can install a wrapper before publication but does not solve that lifecycle mismatch.

**ALT-NGC-002 — rejected:** grant proof from `pre-step`, reuse the previous handle, or weaken the messaging guard. These violate before-prompt admission or active exact-turn proof. A new local replacement goal driver would duplicate native ownership and is outside scope.

**ALT-NGC-003 — selected:** DEC-NGC-001's minimal awaited native extension, consumed by the existing Router lifecycle owner. Cross-repository source work has its own task mandate/protocol; this Spec constrains consumer compatibility, not upstream authority.

### Implementation surface (bounded by the Contracts)

Agent Core: `packages/demo-server/src/index.js` (private RPC context/capability handshake), `session-seam.js` plus a small dedicated native reservation/provider module; `packages/agent-router/src/parent-rpc-relay.js` (bound runtime entry), `process/turn-execution.js` (sidecar through the same queue), the minimum protocol/composition/provisioning wiring and focused tests. Reuse current reconciliation records; a bounded in-flight reservation table is transport correlation, not a durable goal/dispatch ledger. Do not overload Scheduler-specific caller-index identity fields merely to avoid naming this distinct transport correlation.

Native dependency: minimal awaited extension and reservation lifecycle integration in `packages/goal/goal-round-driver`, its focused tests and package documentation/build outputs under its own protocol. No `agent-loop` redesign, monkeypatch, second goal driver, tool policy change, or installation write is required by this design. If the new hook cannot preserve native reservation semantics, return to design review rather than silently replacing the driver.

## 12. Migration, compatibility, and rollback

Convergence: RETAIN native goal authority and existing Router/Broker primitives; MIGRATE Agent Core automatic goal enqueue from direct local enqueue to the required provider; RETAIN explicit standalone native mode outside this Agent Core composition. Direct fallback inside the migrated composition must cease, including restart/recovery. This is a permanent supported integration boundary, not an incident-specific compatibility layer.


CTR-NGC-005 is the compatibility gate: pair activation is required for Agent Core automatic continuation; incompatible rollback cannot silently restore direct execution or inherited armed authority. This document grants no production deployment or rollback operation.

## 13. Open questions

No unresolved normative choice is delegated to implementation: DEC-NGC-001 and CTR-NGC-001–006 freeze the selected boundary. Candidate hook API spelling, built hashes and test run receipts are delivery inputs, presently NOT_RUN, not accepted evidence. The historical missing/stale distinction remains explicitly UNKNOWN. A need to change V4 execution units, native goal policy or permissions triggers re-PREFLIGHT.

Ready for independent authority review when this exact draft and its evidence are available. Implementation readiness remains NO until acceptance is merged in the governing base and a new implementation preflight binds both candidates. Completion of this slice requires the acceptance matrix and independent review; it does not require or authorize production deployment or a business workflow PASS.
