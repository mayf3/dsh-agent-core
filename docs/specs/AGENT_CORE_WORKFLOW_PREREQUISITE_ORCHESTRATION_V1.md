---
spec_id: AGENT_CORE_WORKFLOW_PREREQUISITE_ORCHESTRATION_V1
title: Owner-selected governance child creation and prerequisite-ready dispatch
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
date: 2026-10-29
revision: r1
candidate_base: 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
scope:
  - packages/broker/src/capabilities/workflow-assistance.js
  - packages/broker/src/capabilities/workflow.js
  - packages/production-runtime/src/workflow-execution-runtime.js
governed_by:
  - AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2
supersedes: []
superseded_by: null
owners:
  - mayf3
external_authorities: []
---

# AGENT_CORE_WORKFLOW_PREREQUISITE_ORCHESTRATION_V1

This proposed Contract authorizes a later bounded Core implementation of two
behaviors: a running Domain Owner Agent may use existing published-definition
reads and one atomic Svc operation to create and bind a governance child; and
the normal due poll admits only work for which Svc reports typed `READY`.
The paired Svc Spec is required and its exact reviewed head must be pinned by
the paired acceptance record. This candidate does not bind a companion base or
claim a candidate file exists at its predecessor base. It grants no production
authority and does not claim unattended end-to-end business success.

## 1. Goal

Allow one normal Owner Agent run to select one exact compatible published
governance Definition, atomically create and bind its child through Svc, and
allow later dispatch only when the authoritative Svc prerequisite projection
is `READY`. Ordinary dependent workflows use the same readiness gate.

## 2. Scope and non-goals

Scope is the existing Core assistance Broker capability and existing due poll
consumer. Non-goals are a selector/policy registry, new role/scope/Grant,
business-specific Definition constants, new Core/Svc wait ledger, outbox,
retry timer, change to WEC attempt semantics, raw-due fallback, automatic
recovery of `CLOSED`/`UNKNOWN`/indefinite `WAITING`, or production apply.

## 3. Authority and dependencies

This is `AUTHORITY_ACTION=NEW`, `PLAN_LEVEL=EXEC_PLAN`,
`ASSURANCE_LEVEL=CONTROLLED`; route stage is `AUTHORITY_AUTHORING` and the new
authority is not accepted in this base. Governing parents are Core GCR V1 and
WEC V2. Paired Svc `SVC_WORKFLOW_PREREQUISITE_ORCHESTRATION_V1` is required for the atomic
command and readiness wire contract; its exact reviewed head must be bound in
the paired acceptance record. Acceptance in a docs-only branch does
not activate implementation authority; production apply stays none.

## 4. Current State

`STATE-WPOC-001` — At Core candidate base
`01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99`, GCR V1 is the current child
relationship Contract and WEC V2 is the current attempt/resume Contract. Their
accepted meanings do not authorize automatic Definition selection,
create-and-bind, or prerequisite-gated due admission. No implementation or
runtime acceptance for this proposed Spec has run.

## 5. Observations

- `OBS-WPOC-001` — Read-only inspection of GCR V1 §1 at the pinned Core base:
  bind accepts an already-created child and excludes automatic governance
  Definition selection and atomic create-and-bind.
- `OBS-WPOC-002` — Read-only inspection of WEC V2 §§1 and 3–5 at the pinned
  Core base: attempt/retry fences are applied in the existing dispatch path;
  no accepted dependency-wait state or Svc readiness gate is defined.
- `OBS-WPOC-003` — Read-only inspection of paired Svc GCR V1 §1, VAI V1
  CTR-VAI-009 and WEP V1: create-bind is excluded and the existing due/eligibility
  views are time-only. These exact Svc base facts are recorded in the paired
  proposed Spec and must be rechecked at implementation preflight.

No service, database, Broker, model, or runtime was invoked for these
observations.

## 6. Claims and assumptions

- `CLM-WPOC-001` (INFERRED) — A READY-only Svc read before Core attempt
  planning avoids consuming a WEC attempt while a prerequisite is false.
  Basis: `OBS-WPOC-002` and paired proposed Svc Contract; this is a design
  inference until exact-head conformance is executed.
- `CLM-WPOC-002` (INFERRED) — Existing published-definition read and existing
  Owner write scope can support bounded Owner selection without a new policy
  registry, provided Svc revalidates all coordinates and current case Owner.
  Independent review must confirm this remains within accepted GCR authority.

Assumption: implementation can compose existing Svc transaction helpers into
one atomic operation and filter readiness before paging; if not, implementation
stops for authority review.

## 7. Evidence relations

- `EVD-WPOC-001` — `OBS-WPOC-001/002` support `STATE-WPOC-001` and
  `CLM-WPOC-001` at the exact pinned Spec revisions. Sufficient to identify
  the authority gap; insufficient to claim implementation or runtime behavior.
- `EVD-WPOC-002` — `OBS-WPOC-003` supports `CLM-WPOC-002` only as a cross-repo
  proposal dependency; it is not acceptance evidence.

## 8. Decisions

- `DEC-WPOC-001` — Define a new additive Core Contract; leave GCR V1 and WEC
  V2 unchanged and require the paired Svc authority.
- `DEC-WPOC-002` — Reuse existing Owner tool permissions and ordinary polling;
  use no selector registry, Core wait state, or raw due fallback.
- `DEC-WPOC-003` — Keep `CLOSED`, `UNKNOWN` and indefinite `WAITING` as visible
  stop states without claiming automatic recovery.

## 9. Contracts

### CTR-WPOC-000 — Existing-authority boundary

Accepted GCR V1 permits binding an already-created child and expressly excludes
automatic Definition selection, root-error-to-child orchestration, and atomic
create-and-bind. Its existing create-then-bind sequence can expose the child to
dispatch before binding. WEC V2 owns attempts only after normal dispatch
planning and provides no dependency-wait state. These exclusions are the gap;
this Spec adds a narrow new Contract and does not amend the meanings of GCR,
WEC, or Svc's time-only due read.

This Contract adds no role, Grant, scope, selector registry, Definition-name
convention, new Core ledger, retry budget, or Owner-wake identity. The Owner
Agent uses the existing `workflow_definition_read` and ordinary authorized
case/instance reads. The existing `workflow.execute` scope and Svc's current
Domain Owner authorization remain the write boundary. Svc is the only business
state authority and revalidates all submitted coordinates.

### CTR-WPOC-001 — Definition selection and atomic create-bind

For an open GCR case, the current Domain Owner Agent MUST inspect the case's
authoritative source facts and read published Definition versions and their
exact Context/transition schemas through the existing Definition-read
capability. It MUST select one exact published same-Domain child
`definitionVersionId` and one exact terminal `acceptanceTransitionId` whose
published schema declares the closed GCR acceptance envelope required by GCR
V1. It MUST NOT infer a Definition ID from a name, workflow text, or model
output alone. The agent compares exact case source facts, published schemas,
terminal-transition shape, and acceptance-task fit. If those facts select one
candidate, it proceeds even if other published Definitions pass generic
schema checks. If multiple candidates remain compatible after that comparison
and no exact choice is present in authoritative case/input facts, unresolved
ambiguity stops before mutation. Unreadable schema, foreign/disabled Domain,
or unclear fit also stops before mutation and leaves the existing Assistance
path unchanged. No ranking heuristic, ID/name convention, or selector registry
is introduced. This is a bounded use of the Owner's
existing create-and-bind authorization, not a new policy registry or approval.

Core exposes one closed operation on the existing
`workflow_assistance_action` capability:

```json
{
  "operation": "create_and_bind_governance_child",
  "assistanceCaseId": "<uuid>",
  "definitionVersionId": "<exact published same-Domain version uuid>",
  "contextPayload": {
    "workflowPrerequisite": {
      "kind": "TERMINAL_SUBMISSION",
      "workflowInstanceId": "<already-existing same-Domain instance uuid>",
      "definitionVersionId": "<exact upstream version uuid>",
      "transitionId": "<exact terminal transition uuid>"
    }
  },
  "acceptanceTransitionId": "<uuid>",
  "expectedWorkflowStateVersion": 7
}
```

The Broker accepts exactly these fields, validates UUIDs and closed object
shape, forwards them once through the existing authenticated Svc route with
the trusted transport's existing idempotency key, and returns the Svc receipt
without synthesizing coordinates. It does not accept caller-supplied source
instance, visit, requester, Owner, Domain, Context revision, binding ID,
terminal event, Submission ID, digest, or child acceptance digest. There is no
fallback to separate create followed by bind.

On deterministic rejection the operation returns the authoritative rejection
and no child is dispatched. On timeout, transport failure, or any ambiguous
result, the Agent MUST read exact Assistance case detail and match the same
case, child instance, Definition version, binding, acceptance digest, and
prerequisite coordinates. A matching durable receipt proves commit. If readback
does not prove commit or an authoritative rejection, the outcome stays
`UNKNOWN`; no new-key call, replacement child, or inferred success is allowed.
Same-key/same-body replay and changed-body conflict follow the Svc Spec.

For ordinary non-GCR creation, the existing `workflow_execute.create_instance`
operation remains the route. If the chosen published Definition explicitly
opts its Context schema into the Svc prerequisite contract, Core passes that
closed Context unchanged. Core does not create a governance case or special
child for ordinary work.

### CTR-WPOC-002 — READY-only due admission

The existing Core due poll MUST use the additive Broker operation
`workflow_dispatch_intents.list_ready`, mapped to the paired Svc
`GET /internal/v1/dispatch-intents/ready` projection. This distinct closed
route returns only active, time-due intents whose prerequisite is `READY`.
Existing `workflow_dispatch_intents.list` retains the raw time-only due
meaning. The request uses the existing scheduler read authentication and
bounded `limit`, `afterNextEligibleAt`, and `afterDispatchIntentId` keyset
arguments; the pair is both-or-neither and copied exactly from the last
returned row. Each row preserves the existing due-intent coordinates and adds
literal `readinessStatus: "READY"`. Core MUST NOT call the legacy raw due
endpoint as an automatic fallback if the new endpoint fails, is unavailable,
returns an unknown status, or has an invalid page. Such work remains
undispatched; report the read failure through the existing scheduler error
path. The raw due API continues to serve its existing time-only consumers and
is not reinterpreted.

Dependency-free, time-due work remains included. Svc orders by
`(nextEligibleAt, dispatchIntentId)`, filters active + time-due + prerequisite
READY before applying `limit`, and accepts the existing both-or-neither
keyset pair `afterNextEligibleAt`/`afterDispatchIntentId`. Core drains pages for
one poll, setting the pair to the exact last row returned, and stops when the
returned page is shorter than the requested limit. A WAITING/CLOSED/UNKNOWN
prefix therefore cannot consume a page or starve a later READY row. A new normal poll starts from the first page and recomputes readiness;
malformed/repeated cursor handling remains fail-closed.

Only returned `READY` intents may enter existing WEC attempt planning, Router
delivery, or retry logic. `WAITING`, `CLOSED`, `UNKNOWN`, missing status, and
projection failure cause zero new attempts and zero Router calls. No Core
waiting ledger, attempt generation, wake, or retry timer is created. The next
normal poll rereads Svc state; after a supplier commits the named terminal
Submission, Svc can return the same dependent intent as `READY` and Core uses
the existing WEC fences.

### CTR-WPOC-003 — Existing authority and compatibility

GCR's distinct terminal-review wake, evidence inspection, explicit resolve or
escalation, and same-visit WEC resume remain unchanged. GCR's existing bind
operation remains available for already-created children; this new operation
is the only authorized automatic create-and-bind route. WEC attempt caps,
`outcome_unknown` fences, same-visit resume rules, and existing Router
admission remain unchanged. This Spec creates no automatic re-entry from an
unknown attempt.

An ordinary workflow with no prerequisite remains dispatchable when time-due.
An ordinary workflow with a prerequisite follows the same Svc READY projection
as a GCR child; its readiness is not contingent on an Assistance case. No Core
logic special-cases A64/A69 or business Definition IDs.

## 10. Acceptance — ACC-WPOC-001

The later implementation PR MUST provide exact-head Core tests and a paired
isolated Svc acceptance proving:

| Contract | Method / environment | Required evidence | Expected result | Failure condition |
|---|---|---|---|---|
| CTR-WPOC-000 | Exact-base authority/compatibility review | Diff shows GCR/WEC/raw-due meanings unchanged | Additive Contract only; existing authorization boundaries remain | Any partial supersession, new privilege, or changed retry/due meaning |
| CTR-WPOC-001 | Focused Broker tests and paired isolated Owner→Svc call | Exact input/output, candidate reads, request count, receipt/readback | One exact Definition and one atomic create-bind; unknown remains fenced | Separate create/bind, inferred ID, extra field, or new-key retry |
| CTR-WPOC-002 | Runtime poll tests with fake/isolated Svc pagination | Calls, page tokens, attempt ledger, Router deliveries | Only READY rows reach existing WEC planning; page scan reaches later READY | Raw fallback, non-READY attempt, or blocked-prefix starvation |
| CTR-WPOC-003 | Existing workflow regression plus paired native run | Dependency-free, non-GCR and GCR receipts; WEC/GCR same-visit evidence | Existing flows remain compatible; same typed gate serves both workflow kinds | Any regression to existing retry, review, resolve, or dispatch behavior |

1. a fresh native run starts with no governance child; the Owner Agent first
   creates an ordinary supplier through existing `workflow_execute.create_instance`,
   then reads the exact published child Definition/schema and calls one atomic
   create-bind operation using the returned actual supplier Instance ID; one
   child and one binding receipt result, with no separate child create call;
2. ambiguous operation response is resolved only by exact case-detail
   readback; unknown remains fenced and no new idempotency key is issued;
3. ordinary dependency-free work still dispatches; ordinary dependent work and
   a GCR child both use the same READY-only due consumer;
4. repeated polls while prerequisite is WAITING yield zero Core attempts and
   zero Router deliveries; after the real upstream terminal Submission commits,
   a later normal poll dispatches the same intent once using the actual Svc
   receipt;
5. one poll with more WAITING rows than page capacity still reaches a later
   READY row; restart followed by a fresh poll reconstructs the same readiness
   without a Core wait ledger;
6. existing WEC retry/UNKNOWN fences, GCR terminal review and explicit
   same-visit resolve remain compatible.

The acceptance run MUST start from one initial trigger, no precreated child,
and include a normal upstream supplier workflow completion. Its fixture may
create that supplier as the first normal Owner action so the terminal receipt
is not already present when the child is created; this is a test arrangement,
not a product-selection rule. It MUST not use external per-node correction.
Source tests or an isolated mechanics PASS do not establish an unattended
business outcome. CLOSED/UNKNOWN and indefinite WAITING are readable stop
states; this Contract claims no automatic recovery, timeout success, or
indefinite-wait escalation.

## 11. Alternatives and disposition

- `ALT-WPOC-001` — Add a new selector/policy registry or role: rejected for
  this bounded decision. Existing Owner reads and Svc's current Owner checks
  are sufficient to exercise existing create-and-bind authority; ambiguity
  stops before mutation.
- `ALT-WPOC-002` — Add a Core waiting ledger, timer or wake/outbox: rejected.
  Svc is authoritative and the existing poll can recompute state without a
  second source of truth.
- `ALT-WPOC-003` — Reuse raw time-only due reads as fallback: rejected because
  it would bypass the new readiness gate.

## 12. Migration, compatibility, and rollback

No Core or Svc historical Instance migration is authorized. This is an
additive Broker operation and a new read route consumer; existing GCR bind,
review/resolve, WEC attempt/retry, dependency-free dispatch, and Svc raw due
semantics remain unchanged. Implementation rollout/rollback and deployment
are outside this proposed authority and require a separate implementation
mandate; rollback may not trigger raw-due fallback.

## 13. Open questions

No normative decision remains open in this proposal. Implementation preflight
must verify one exact compatible published Definition can be established and
that Svc transaction composition and READY-before-pagination are feasible.
Failure of either check stops implementation and returns for a new authority
review; neither is a license to weaken the Contract.

Implementation surface and stop conditions

Expected Core touch points are limited to the existing assistance and
dispatch-intent Broker capabilities and
`workflow-execution-runtime.js` due-page reader, with focused capability and
runtime tests. Before attempt planning, Core rechecks the exact dependent
tuple, configured runtime binding, Domain enablement, and current authorization
through existing WEC/Svc validation. An exact upstream terminal proof is
immutable once committed; later source archival cannot revoke readiness. No
Core wait truth or lease is added. Do not add WEC state or change attempt-ledger
semantics. If Core cannot enforce READY-only polling without a bypassing raw
fallback, stop and revise this Contract before implementation. If published
Definition reads cannot establish one exact compatible candidate, stop before
create.

This Spec is a proposed new authority. Implementation requires this exact Spec
and its Svc companion to be accepted in the implementation base, followed by
an exact-scope implementation mandate. Production apply authority remains
`none`.
