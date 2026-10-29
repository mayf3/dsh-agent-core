---
spec_id: AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
title: Accepted whole-authority successor to AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
scope:
  - workflow-execution-control
date: 2026-10-29
revision: draft-1
candidate_base: 45268be276276462bd71040f0cd51b28a7764fe0
governed_by:
  - AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1
paired_authority: SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1
external_authorities: []
supersedes:
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2
superseded_by: null
owners:
  - mayf3
acceptance_authority_basis: >-
  Root acceptance under user-delegated authority; ROOT_OWNER_ACCEPTANCE.json SHA-256 43eef302fb86cf131106fd6d39c0e338abc0acf9f14fb0210a5e51918d91448e; reviewed semantic Svc b115c0641e4c2b6b965a6a3cd24252734754c14f and Core 0629858c08029ebcaed39b012b4c4a2a2a8078fb. Lifecycle transaction only; no production apply authority.
---

# AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3 — accepted whole-authority successor

Accepted whole-authority successor. Root acceptance under the user-delegated authority, recorded in `ROOT_OWNER_ACCEPTANCE.json` (SHA-256 `43eef302fb86cf131106fd6d39c0e338abc0acf9f14fb0210a5e51918d91448e`), binds the independently reviewed semantic heads Svc `b115c0641e4c2b6b965a6a3cd24252734754c14f` and Core `0629858c08029ebcaed39b012b4c4a2a2a8078fb`. This lifecycle-only transaction records acceptance and reciprocal predecessor links. Accepted governing Specs with `implementation_authority: contracts` authorize later source implementation within their Contracts once present in its base; Product, Architecture, and Storage authority retain `implementation_authority: none`. Production apply, migration execution, deployment, and A75 mutation remain unauthorized. It carries forward the predecessor contracts with the explicitly stated bounded additions below; the predecessor source remains unchanged.

## Bounded contract delta

Both intake and separate review execute through existing WEC policy and bounded mechanisms. Opted-in initial wake is routed to the real intake workflow and never also drives naked chat. A turn delivery or `completed` result does not complete the Svc obligation. Only a real Svc command receipt joined to published required operation permits progress; failure/cap/Owner change is represented by a durable Svc STOP, not local needs_review alone. Preserve explicit resolve-before-resume and existing HUMAN_REQUIRED guard; no automatic phase re-prompt. Paired Spec §§4–9.

Paired authority reference: `AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1 §§1,5,7–9,11–14; preserves WEC V2 whole body`.
The predecessor contracts are carried forward below with only the bounded successor changes stated above; the predecessor source remains unchanged. This successor is accepted in the same paired lifecycle transaction that records the reciprocal predecessor backlink. Acceptance is not implementation or conformance evidence.

Predecessor source: `docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2.md` at `45268be276276462bd71040f0cd51b28a7764fe0`; original file SHA-256 `54795015fa96399714d8a5b910e3292a267cb1dc39d6c8227efc5ef7e09b1648`.

## Complete predecessor body carried forward verbatim

# AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2

This whole-authority successor carries V1's execution control authority and
adds only CTR-WEC1-008's explicit Owner-resume path and its necessary budget,
ledger-baseline and stale-path exclusions. V1 remains the historical source
of its original acceptance; unchanged contracts retain their IDs. The
companion CTR-SWEC-010 and Core stale-reentry V2 must be accepted before this
new path may be implemented. This proposal authorizes no production action.

## 0. Intent

The workflow control plane must be able to answer, from system-owned facts
alone: which NodeVisit is dispatched to whom, at which generation, in which
session the Run happened, whether the Run really occurred, why nothing
completed, and when Domain Owner attention or an explicit human escalation
exists. The Agent never reports any of these; the system derives them. This
Spec is the dsh-agent-core slice: it exposes the existing execution ledger as
a stable read model, adds a deterministic execution-state projection,
extends the stale-reentry exception with bounded policy-driven continuation
for `run_ended_no_submission`, opens OWNER_PENDING assistance at the attempt
limit, durably wakes the authoritative Domain Owner, accepts push-first kicks,
and projects execution facts as human-readable forum messages. It creates NO second execution ledger and NO second
duplicate fence.

## 1. Frozen boundaries (inherited, untouched)

- BUSINESS_STALENESS != EXECUTION_TERMINATION (AGENT_CORE_WORKFLOW_STALE_REENTRY_V2):
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
| NEEDS_REVIEW with recorded system assistance fact | `OWNER_PENDING` |
| terminal, judgment `stale_no_progress` | `STALE_NO_PROGRESS` |
| terminal SETTLED, judgment `business_commitment_observed` | `SETTLED` |
| terminal SETTLED, judgment `stale_no_progress` | `STALE_NO_PROGRESS` |

`ELIGIBLE` (due, not yet attempted) is a svc-workflow activation fact and is
deliberately NOT projected here. `HUMAN_REQUIRED` is also NOT inferred from
the dsh execution ledger: it exists only after an explicit Domain Owner
assistance escalation in authoritative svc-workflow state. The projection
never mutates the ledger.

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

- A terminal NEEDS_REVIEW attempt with judgment `run_ended_no_submission`,
  unless it was admitted by CTR-WEC1-008 Owner-resume, becomes re-entry-eligible
  when `now - reconciled.atMs >= retryDelayMs`.
  Eligibility is realized through the EXISTING stale-reentry machinery: the
  reconcile second pass settles the visit's eligibility, and the due sweep
  mints generation N+1 through the same fence + quiescence gate.
- `run_outcome_unknown` NEVER becomes re-entry-eligible. No timeout, no
  policy, no operator convenience changes this.
- The automatic-continuation fence refuses to mint
  `generation > maxAttemptsPerVisit` (`cause: 'attempt_limit_reached'`).
  CTR-WEC1-008 supplies a distinct one-generation Owner authorization without
  resetting that automatic budget.

### CTR-WEC1-005 Attempt-limit owner assistance

When a visit's attempt limit is reached (a generation == maxAttempts attempt
settles NEEDS_REVIEW, or a stale settlement finds generation == maxAttempts),
the engine invokes `workflow_execution_escalation.create`. Authoritative
svc-workflow opens/replays one `OWNER_PENDING` case and returns
`{assistanceCaseId, ownerPrincipalId, ...}`. Agent Core resolves the exact
Principal UUID through the existing Principal→Agent authority, then delivers
one stable Domain Owner wake using request id `wfassist-<assistanceCaseId>` and
an `inter_agent` origin. It MUST NOT use `workflow_execution` origin, because
the Domain Owner is an exception handler, not the original NodeVisit executor.

Only after the owner wake is proven admitted (or already pending/settled under
the same request id) is the append-only escalation fact recorded in the
execution ledger. Resolution/wake failure is retried on a later pass; no blind
second prompt is sent after an outcome-unknown delivery whose caller
correlation proves admission. Domain Owner may resolve the assistance or
explicitly escalate it to `HUMAN_REQUIRED` through svc-workflow.

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
  limit owner-attention request (OWNER_PENDING), reconciled settled.

### CTR-WEC1-008 Owner-resolved same-visit resume

An explicit authorized Domain Owner resolve may authorize exactly one next
generation for the same active dispatch intent, workflow instance, visit,
and assignee Principal. The predecessor MUST be the latest attempt, terminal
`NEEDS_REVIEW/run_ended_no_submission`, with known delivery and a fresh
Router reconciliation result positively `settled`. Pending, unknown,
unavailable or ambiguous delivery/execution facts, including
`run_outcome_unknown`, are ineligible. The broader stale-path quiescence
alternatives do not substitute for this path's positive settled proof.

The two eligible ingress kinds are an ordinary Assistance request opened by
the authenticated current assignee, and CTR-WEC1-005 `execution_policy`
assistance. The policy requester is not presumed to be the executor. In both
cases svc must attest an explicit resolve authorized for the exact Domain;
no extra rule requires the Domain Owner and executor to be different
Principals. Neither model/prompt text nor elapsed time grants permission.

Before appending `attempt_planned` for EVERY new attempt (generation 1,
stale re-entry, and Owner-resume), Core MUST perform a fresh pre-plan read of
the exact current activation/visit/assignee and workflow state version while
holding the existing ledger admission lock. It durably records that version
as `preDeliveryWorkflowStateVersion` in the same planned append, before any
Router delivery invocation. Failed or mismatching reads mint and deliver
nothing. This is distinct from post-delivery
`workflowStateVersionAtDispatch` and MUST NOT be reconstructed from a later
read. Legacy events without the new field remain readable but cannot be the
predecessor of an Owner-resume.

Core consumes the read-only svc companion below; it adds no Core product-api
endpoint and does not widen the existing seven-field due DTO.

```text
GET /internal/v1/dispatch-intents/{dispatchIntentId}/owner-assistance-resume-evidence
query: previousAttemptId=<opaque attempt ID string>&preDeliveryWorkflowStateVersion=<integer>
scope: workflow.read + direct token + enabled GLOBAL_SCHEDULER_READ binding
200 {"evidence": null | {
  "dispatchIntentId": UUID, "workflowInstanceId": UUID, "nodeVisitId": UUID,
  "ownerPrincipalId": UUID, "activationState": "ACTIVE", "workflowStateVersion": integer,
  "assistanceCaseId": UUID, "requestEventSequence": integer,
  "resolutionEventSequence": integer, "requesterPrincipalId": UUID,
  "resolverPrincipalId": UUID, "ingress": "assignee" | "execution_policy",
  "reason": null | "ATTEMPTS_EXHAUSTED" | "STALE_LOOP_EXHAUSTED",
  "lastAttemptId": null | opaque attempt ID string
}}
```

The request and response are closed shapes. `dispatchIntentId` is the exact
path UUID; `previousAttemptId` is the non-empty opaque Core attempt ID
(currently `wfeat-*`), not a UUID. Versions and sequences are integers on the
svc workflow-state-version scale. `reason` and `lastAttemptId` are present
and null for `ingress: assignee`; for `execution_policy` both are non-null,
the reason is one of the two enumerated policy reasons, and `lastAttemptId`
is the persisted policy value, never an echo of the query parameter.

Svc's exact provenance and selection obligations are CTR-SWEC-010. Core
requests evidence with the latest attempt's own ID and durable pre-delivery
baseline, under the same admission lock. It accepts only a matching active
dispatch/instance/visit/assignee tuple, with
`baseline < requestEventSequence < resolutionEventSequence <= workflowStateVersion`.
The evidence's current version must equal the fresh pre-plan version stored
for the new attempt; a version/identity mismatch rejects that planning pass.
For ordinary ingress, Core requires `requesterPrincipalId == ownerPrincipalId`
and the two nullable fields to be null; there is no persisted ordinary
attempt-ID claim. For policy ingress, Core additionally requires the
non-null persisted `lastAttemptId == previousAttemptId` and the exact policy
reason. In the DTO, `ownerPrincipalId` means the activation's assignee;
`resolverPrincipalId` is the separately authorized resolving Domain Owner.

One locked durable `attempt_planned` append mints generation N+1 and consumes
the permit together. It contains the new baseline, unchanged identity,
`previousAttemptId`, `retryReason: owner_assistance_resolved`, and
`assistanceResume` containing the exact returned evidence DTO. The existing
ledger reducer/fence MUST reject a reused case ID, mismatched predecessor or
identity, missing/invalid baseline or sequence proof, nonterminal/unknown
predecessor, or duplicate generation. No second consumption ledger or side
store is introduced. Replaying the same case, event pair, due row, or restart
cannot mint again. If several old cases qualify, one is consumed; the new
baseline is at least their already-observed resolution versions, so none of
those old cases can authorize the following generation.

This permit may authorize the next generation immediately after generation
1, before or at the automatic cap, or after the cap. It never resets the
monotonic generation counter or automatic `maxAttemptsPerVisit` budget.
Each case authorizes at most one generation; this is not a claim that the
whole system terminates after finitely many distinct Owner authorizations.
This path MUST NOT append `stale_superseded` or treat Assistance activity as
satisfying the stale predicate. An Owner-resumed attempt that ends without
submission is excluded from automatic stale/policy continuation: another
generation requires a new case requested after that attempt's own baseline
and a new explicit authorized resolve.

For an Owner-resume plan durably appended but with no `delivery_started`,
restart processing MUST perform the following check BEFORE ordinary
reconciliation terminalizes that planned attempt. Query the existing Router
caller-correlation seam for the exact `requestId = attemptId`. Only a
positive `never_existed` result with no attributable execution, handle,
message, or session fields, plus a fresh read of the exact same active
dispatch/instance/visit/assignee and a workflow state version equal to the
stored `preDeliveryWorkflowStateVersion`, permits delivery under the SAME
attempt ID. Fresh canonical Principal-to-Agent resolution and write-ahead
`delivery_started` still precede delivery. This creates no generation and
consumes no second permit. Any query error, unknown or other correlation,
attributable execution field, missing proof/baseline, or identity/version
mismatch falls through to existing reconciliation, which MUST durably append
its normal `reconciled` event with `NEEDS_REVIEW/delivery_unverified`; no
delivery is attempted. A crash before `attempt_planned` consumes nothing.
Once `delivery_started` exists, all existing unknown/delivery replay fences
remain unchanged; this exception never replays such a delivery.

## 3. Data model changes

The existing append-only JSONL ledger gains
`preDeliveryWorkflowStateVersion` on every new `attempt_planned`, and the
Owner-resume fields defined by CTR-WEC1-008 only on Owner-resume plans.
Legacy rows remain readable, with no invented baseline or permit. The
single ledger remains the source of execution evidence and permit
consumption; `escalation_recorded` remains the escalation event. New state file
`forum-projection-state.json` (regenerable; loss ⇒ at-least-once re-post
with server-side read-before-write dedupe, never a business fact).

## 4. API changes

- ADD `GET /workflow-execution/traces` (loopback product-api; CTR-WEC1-003).
- ADD `GET /workflow-execution/attention` (loopback product-api; same gate as
  CTR-WEC1-003; zero-parameter read-only selection over CTR-WEC1-001/002
  projection).
- ADD `POST /workflow-execution/kicks` (loopback product-api; CTR-WEC1-006).
- CONSUME svc-workflow
  `GET /internal/v1/dispatch-intents/{dispatchIntentId}/owner-assistance-resume-evidence`
  with CTR-WEC1-008's exact query and response envelope. This adds no Core
  product-api route, broker action, Auth scope, or role.
- ADD internal `POST /workflow-execution/owner-assistance-wakes` (same
  `workflow.execute` bearer gate): closed payload
  `{workflowInstanceId,nodeVisitId,assistanceCaseId,ownerPrincipalId,reason?}`;
  non-2xx remains retryable for the svc durable outbox.
- ADD broker manifest `workflow_execution_escalation` (create; target
  svc-workflow; scope `workflow.execute`) — companion svc endpoint.
- ADD least-privilege assistance tools over existing svc-workflow APIs:
  `workflow_assistance_read` (`workflow.read`: owner_inbox/detail) and
  `workflow_assistance_action` (`workflow.execute`: resolve/escalate_to_human).
  svc-workflow server-side Domain Owner bindings remain the authorization
  authority; no new Auth scope or role is created.
- WIDEN `forum_threads.list` manifest query list with `contextType`,
  `contextId` (additive; the svc-forum API already accepts them).

## 5. Test obligations

- Projection/state-table unit tests (all rows of the CTR-WEC1-002 table).
- Engine policy tests: run_ended re-entry after delay (Goal Case 3),
  limit → OWNER_PENDING fact once (Case 4), outcome_unknown never re-enters
  (Case 7), fence limit refusal, kick coalescing (Case 1/2 support),
  restart: projection recovers from replayed file (Case 9).
- Owner-wake tests: exact Principal→Agent resolution, stable request-id dedupe,
  lost delivery receipt with proven admission, failed resolution retryability,
  and the closed product-api wake payload/gate.
- Assistance broker tests: read/action scope split, existing svc routes,
  idempotent owner actions, no model-carried authority inputs.
- Poster tests: dedupe by eventKey, forum down = no execution effect,
  late thread appears = events eventually posted (Case 8 agent side).

- ACC-WEC1-008-001 (CTR-WEC1-008): actual engine/ledger tests in an isolated
  environment prove one next generation from each ingress after generation 1
  and at the automatic cap, positive settled execution and exact post-baseline
  Owner proof; generation/budget stay monotonic and ordinary null fields are
  accepted only with current-assignee provenance. Evidence: input service and
  Router facts, resulting ledger lines, attempt IDs and delivery counts.
- ACC-WEC1-008-002 (CTR-WEC1-008): replay the same case, event pair and due row,
  reload the ledger, and provide multiple old resolved cases; at most one new
  generation is planned. Changed dispatch/instance/visit/assignee, forged
  ordinary policy payload, wrong policy attempt ID, pre-baseline events,
  non-resolved cases, legacy missing baseline, unknown/pending execution and
  elapsed time alone mint/deliver nothing. An Owner-resumed no-submission
  result cannot automatically stale-redispatch; only a fresh case plus resolve
  may authorize another generation.
- ACC-WEC1-008-003 (CTR-WEC1-008): fault-inject before plan, after Owner plan
  and before delivery_started, and after delivery_started. Only positive
  caller-correlation never_existed without execution fields plus exact fresh
  identity/version resumes the same planned ID; negative/error cases persist
  reconciled NEEDS_REVIEW/delivery_unverified and deliver zero times. Baseline
  read failure writes no plan, and gen1/stale/Owner plans all persist their
  baseline before Router delivery. Evidence: durable replay and crash traces.
  Any missing required ledger fact or unexpected delivery fails acceptance;
  isolated tests establish mechanism evidence, not production outcome.
