---
spec_id: AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1
title: Workflow Execution Control — execution trace read model, system-owned execution state projection, policy-driven continuation and escalation, push-first kick, forum execution-event projection
status: accepted
accepted_date: 2026-09-24
accepted_by: mayf3
accepted_reviewed_head: e28c7666eb305dfb208da89cf9890cf85f9b08af
acceptance_authority_basis: >-
  Owner ACCEPT via GOAL = WORKFLOW_EXECUTION_CONTROL_V1_CLOSURE_AND_DEPLOYMENT_
  READINESS (2026-09-24): "当前整体设计与实现方向接受，可以进入最终 closure / merge /
  deployment-ready 阶段", bound to the implementation head
  e28c7666eb305dfb208da89cf9890cf85f9b08af (feature branch
  goal/workflow-execution-control-v1 based on origin/main 2a85d065). This
  commit is the acceptance lifecycle transaction ONLY: the contract body is
  byte-identical to the reviewed head except this frontmatter. Preceding
  mandate record (proposal): GOAL = WORKFLOW_EXECUTION_CONTROL_V1 (2026-09-24),
  Scopes B/C/D/E/F/G agent-core side; §10 explicit non-goals; §11 invariants;
  §12 Cases 1-10; §13 slice order.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
date: 2026-09-24
candidate_base: 2a85d0659157a3bab649239158744d5222d86afe (origin/main)
revision: r1
governed_by:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 (accepted)
  - AGENT_CORE_WORKFLOW_STALE_REENTRY_V1 (accepted)
  - AGENT_PROCESS_LIFECYCLE_HARDENING_V3 (accepted)
companion_specs:
  - repository: mayf3/svc-workflow
    spec_id: SVC_WORKFLOW_EXECUTION_CONTROL_V1 (proposed, same date)
  - repository: mayf3/agent-forum
    spec_id: AGENT_FORUM_WORKFLOW_INSTANCE_CONTEXT_V1 (proposed, same date)
---

# AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1

## 0. Intent

The workflow control plane must be able to answer, from system-owned facts
alone: which NodeVisit is dispatched to whom, at which generation, in which
session the Run happened, whether the Run really occurred, why nothing
completed, and when a human is required. The Agent never reports any of
these; the system derives them. This Spec is the dsh-agent-core slice: it
exposes the existing execution ledger as a stable read model, adds a
deterministic execution-state projection, extends the stale-reentry
exception with a bounded policy-driven continuation for
`run_ended_no_submission`, escalates to svc-workflow at the attempt limit,
accepts push-first kicks, and projects execution facts as human-readable
forum messages. It creates NO second execution ledger and NO second
duplicate fence.

## 1. Frozen boundaries (inherited, untouched)

- BUSINESS_STALENESS != EXECUTION_TERMINATION (AGENT_CORE_WORKFLOW_STALE_REENTRY_V1):
  the unknown fence is absolute. `outcome_unknown` is never policy-retried;
  C-013/015/016 termination-evidence discipline stands byte-for-byte.
- One attempt per NodeVisit (`beginAttemptIfAbsent`); generation N+1 only
  supersedes a terminal attempt through the SAME fence; the CTR-SRE-004
  quiescence gate stands.
- The ledger (`attempts.jsonl`, append-only) stays the only execution
  evidence store. Everything in this Spec is a projection, a policy gate,
  or an outbound projection — never a second store of record.
- Router admission seam, reconciliation store, and session semantics are
  read-only from here.

## 2. Requirements (CTR-WEC1-*)

### CTR-WEC1-001 Execution trace read model

A pure projection module derives, from ledger facts only, per
`workflowInstanceId`:

```
{ workflowInstanceId, generatedAt, nodeVisits: [ {
    nodeVisitId, attemptId, generation, dispatchIntentId, ownerPrincipalId,
    agentId?, sessionId?, reconciliationHandle?, messageId?,
    executionState, attemptCount, escalation?,
    startedAt, updatedAt } ] }
```

- `attemptCount` = number of generations planned for the visit (system
  counted; never agent-reported).
- All fields come from the ledger projection; absent facts stay absent
  (no inference, no defaults that look like facts).

### CTR-WEC1-002 Execution state projection

`executionState` is deterministically derived per visit:

| Ledger facts | executionState |
|---|---|
| ACTIVE, phase `resolution_blocked` | `BLOCKED` |
| ACTIVE, phase `delivery_started` | `DISPATCHED` |
| ACTIVE, phase `run_delivered` | `RUNNING` |
| ACTIVE, phase `planned` | `DISPATCHED` |
| NEEDS_REVIEW, judgment `run_ended_no_submission` | `RUN_ENDED_NO_TRANSITION` |
| NEEDS_REVIEW, judgment `run_outcome_unknown` | `OUTCOME_UNKNOWN` |
| NEEDS_REVIEW, judgment `delivery_unverified` / `settle_check_unavailable` / `delivery_failed` phase | `OUTCOME_UNKNOWN` |
| NEEDS_REVIEW with recorded escalation fact | `HUMAN_REQUIRED` |
| terminal, judgment `stale_no_progress` | `STALE_NO_PROGRESS` |
| terminal SETTLED, judgment `business_commitment_observed` | `SETTLED` |
| terminal SETTLED, judgment `stale_no_progress` | `STALE_NO_PROGRESS` |

`ELIGIBLE` (due, not yet attempted) is a svc-workflow activation fact and is
deliberately NOT projected here. The projection never mutates the ledger.

### CTR-WEC1-003 HTTP trace surface

`GET /workflow-execution/traces?workflowInstanceId=<uuid>[&nodeVisitId=<uuid>]`
on the product-api loopback server (127.0.0.1:8787). Bearer-token gate
reusing the existing scheduler token verifier seam; unconfigured verifier or
any verification failure = 401 fail-closed; token must carry
`workflow.execute`. Errors use the frozen product-api envelope. Read-only.

### CTR-WEC1-004 Policy-driven continuation (run_ended_no_submission only)

Config: `maxAttemptsPerVisit` (default 3, min 1; env
`DSH_WORKFLOW_MAX_ATTEMPTS_PER_VISIT`), `retryDelayMs` (default 60_000; env
`DSH_WORKFLOW_RETRY_DELAY_MS`).

- A terminal NEEDS_REVIEW attempt with judgment `run_ended_no_submission`
  becomes re-entry-eligible when `now - reconciled.atMs >= retryDelayMs`.
  Eligibility is realized through the EXISTING stale-reentry machinery: the
  reconcile second pass settles the visit's eligibility, and the due sweep
  mints generation N+1 through the same fence + quiescence gate.
- `run_outcome_unknown` NEVER becomes re-entry-eligible. No timeout, no
  policy, no operator convenience changes this.
- The fence refuses to mint `generation > maxAttemptsPerVisit`
  (`cause: 'attempt_limit_reached'`).

### CTR-WEC1-005 Attempt-limit escalation

When a visit's attempt limit is reached (a generation == maxAttempts
attempt settles NEEDS_REVIEW, or a stale settlement finds generation ==
maxAttempts), the engine invokes the escalation seam exactly once per visit
(idempotent): a `workflow_execution_escalation.create` broker call
(companion spec svc endpoint) carrying `{workflowInstanceId, nodeVisitId,
attemptCount, lastAttemptId, dispatchIntentId, reason}`. The outcome is
recorded in the ledger as an append-only escalation fact (idempotent per
visit — a second escalation call for an already-escalated visit is a no-op).
Escalation failure is logged and retried on later passes; execution state is
never advanced by escalation failure or success — only svc-workflow's
assistance fact and the version bump gate further business behavior.

### CTR-WEC1-006 Push-first kick

`POST /workflow-execution/kicks` on the product-api loopback server: body
`{workflowInstanceId, nodeVisitId, dispatchIntentId}` (all UUID). Gated like
CTR-WEC1-003. Effect: ONE coalesced engine poll trigger (a poll already in
flight or armed coalesces — kicks never stack). The kick is a latency
optimization ONLY: the poll loop remains the correctness path; a lost or
dropped kick is invisible to semantics. No new duplicate lock is introduced
(any double trigger meets the existing one-attempt fence).

### CTR-WEC1-007 Forum execution-event projection

A forum projection module converts ledger lifecycle events into
human-readable messages on the canonical workflow thread:

- Thread resolution: `forum_threads.list` broker capability with
  `contextType=workflow_instance&contextId=<workflowInstanceId>` (manifest
  query list widened additively). The module NEVER creates threads — the
  canonical binding is owned by svc-workflow. No thread found ⇒ skip and
  retry later.
- Message: `forum_threads.reply` with `kind=comment` and metadata
  `{workflowInstanceId, nodeVisitId, eventKey, eventType}`. `eventKey` is
  the sha256 of the raw ledger line — the dedupe identity. Posted keys are
  persisted in `<workflowExecutionDir>/forum-projection-state.json`
  (offset + posted-key window) so restart does not re-post or skip.
- Posting failures never propagate into the engine, the ledger, or any
  execution decision. A periodic reconcile pass re-scans the bounded tail
  of the ledger for unposted events.
- Events covered: attempt planned (dispatched to Agent X, #N), run
  delivered (session linked), run ended without transition, delivery
  failed / resolution blocked (execution blocked), stale superseded, attempt
  limit escalation (HUMAN_REQUIRED requested), reconciled settled.

## 3. Data model changes

None in the ledger schema (append-only JSONL unchanged; new event kinds
`escalation_recorded` only). New state file
`forum-projection-state.json` (regenerable; loss ⇒ at-least-once re-post
with server-side read-before-write dedupe, never a business fact).

## 4. API changes

- ADD `GET /workflow-execution/traces` (loopback product-api; CTR-WEC1-003).
- ADD `POST /workflow-execution/kicks` (loopback product-api; CTR-WEC1-006).
- ADD broker manifest `workflow_execution_escalation` (create; target
  svc-workflow; scope `workflow.execute`) — companion svc endpoint.
- WIDEN `forum_threads.list` manifest query list with `contextType`,
  `contextId` (additive; the svc-forum API already accepts them).

## 5. Test obligations

- Projection/state-table unit tests (all rows of the CTR-WEC1-002 table).
- Engine policy tests: run_ended re-entry after delay (Goal Case 3),
  limit → escalation once (Case 4), outcome_unknown never re-enters
  (Case 7), fence limit refusal, kick coalescing (Case 1/2 support),
  restart: projection recovers from replayed file (Case 9).
- Poster tests: dedupe by eventKey, forum down = no execution effect,
  late thread appears = events eventually posted (Case 8 agent side).
