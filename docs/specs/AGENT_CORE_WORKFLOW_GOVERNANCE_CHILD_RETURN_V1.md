---
spec_id: AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1
title: Owner-bound governance child and return to the originating Workflow visit
status: accepted
accepted_date: 2026-10-28
accepted_at: 2026-10-28T06:04:48Z
accepted_by: Codex root (explicitly delegated by mayf3)
accepted_reviewed_head: 599107b6909e5f3153afd29bc846a122e50ebfd7
accepted_candidate_file_sha256: 44dd889d644b4253c4d516d35665f09a578a584b19fb2db54ecb119758bdd31b
acceptance_review_verdict: PASS
independent_semantic_reviewer: /root/assistance_resume_core_impl_luna
acceptance_delta_class: new_standalone_contract
semantic_delta_after_review: NONE
acceptance_authority_basis: >-
  Root accepted the exact independently reviewed contract under mayf3's explicit
  delegation to complete source work and isolated validation only. The Core
  reviewer returned PASS on accepted_reviewed_head. This lifecycle commit records
  acceptance only; authority is effective after both companion Specs merge, and
  implementation remains separately authorized. Production apply authority is none.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
date: 2026-10-28
revision: r1
candidate_base: 6daf5922a0817115b1a21a459d9643b6fbb6d2b6
scope:
  - packages/broker
  - packages/product-api
  - packages/production-runtime
governed_by:
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2
  - AGENT_CORE_WORKFLOW_CURRENT_INPUT_BROKER_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_EXECUTION_CONTROL_V1
    revision: 1f191156a03d9397b2fb2fdb6c28d6a9621ace95
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1

This accepted additive contract lets a Domain Owner bind one existing,
same-Domain governance WorkflowInstance to one open Assistance case, then
receive a distinct review wake when that child reaches a terminal event. The
Owner must inspect the child's exact final acceptance evidence and explicitly
resolve or escalate the original case. A valid explicit resolve continues to
use the existing WEC V2 / SWEC CTR-SWEC-010 same-visit resume contract. This
accepted candidate becomes active when it and the accepted Svc companion merge
to their authority branches. Implementation remains separately authorized;
production apply authority is none.

## 0. Current state and evidence

`STATE-GCR-001` — At Core `6daf5922a0817115b1a21a459d9643b6fbb6d2b6`, Owner
Assistance actions and `CTR-WEC1-008` same-visit resume are accepted authority;
no governance-child typed action or terminal-review wake phase is authorized
by this proposal's base. This document has no implementation or runtime
acceptance evidence.

`OBS-GCR-001` — Read the accepted V2 Owner wake, resume evidence, and
`workflow_assistance_action` contracts in
`docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2.md`; read the accepted
transparent `workflow_current_task_input` Broker contract in
`docs/specs/AGENT_CORE_WORKFLOW_CURRENT_INPUT_BROKER_V1.md`. The initial
Owner wake uses one case-derived identity and must remain unchanged. The
current-input tool is read-only and transports service facts; it does not
decide semantic correctness.

`OBS-GCR-002` — Read the Broker capability registration and production
workflow-execution route at the pinned candidate base. Existing assistance
actions share `workflow.execute`; the service validates case authority.
Method: local source/Spec inspection only; no service, database, Broker, or
runtime was invoked.

`CLM-GCR-001` — SUPPORTED: a second durable event identity and explicit
Owner decision are required to distinguish child review from the original
case wake while preserving existing resume semantics. Supported by
`OBS-GCR-001` and accepted Svc `CTR-SWEC-009/010` at
`ed9344f4701b416e8cf6d7cd10cc4ae28969ff3f`.

`EVD-GCR-001` — `OBS-GCR-001/002` support `STATE-GCR-001` and
`CLM-GCR-001` only at the cited source snapshots. They do not prove
implementation, delivery, model behavior, or business completion.

## 1. Authority and limits

`AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2` remains authoritative for Owner
Assistance wake delivery and same-visit resume. The companion Svc contract
`SVC_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1` is required for the case/child
relationship, persisted provenance, review outbox,
and final resolve verification. Svc remains the sole business-state authority;
Core only exposes the typed Owner action and delivers the Svc-authorized
review wake. Neither model-authored text nor a terminal child is proof that the
originating problem was repaired.

This contract adds no grant or scope. `workflow_assistance_action` remains
under the existing `workflow.execute` scope, and Svc must independently
authorize the actual caller as current Domain Owner for the exact open case.
Existing unlinked cases keep their current read, resolve, escalate, and resume
behavior. No historical instance is migrated. No reconciler performs a
Workflow transition. This is one relationship layer, not a general obligation,
arbitrary graph migration, or cross-case budget system.

The bind operation accepts only an already-created child instance. Existing
`workflow_definition_read` and `workflow_execute.create_instance` remain the
available Definition read/create path, with the service resolving the entry
assignee. Instance creation may make the child eligible for ordinary dispatch
before a separate bind call; this contract does not add atomic create-and-bind
or prevent an unbound child from starting. If that child reaches terminal
before bind, bind refuses and no automatic replacement is created. A
successful bind requires the exact child to remain nonterminal. Automatic
governance-Definition selection and root-error-to-child creation orchestration
are outside this contract and remain unproven.

## 2. Typed Owner action — `CTR-GCR-001`

Core adds one closed operation to the existing
`workflow_assistance_action` Broker capability:

```json
{
  "operation": "bind_governance",
  "assistanceCaseId": "<uuid>",
  "governanceChildInstanceId": "<uuid>",
  "acceptanceTransitionId": "<uuid>",
  "expectedWorkflowStateVersion": 7
}
```

The Broker forwards only these typed fields through the existing authenticated
Svc transport, together with the existing idempotency key required for a
mutation. It does not accept caller-supplied origin instance, visit,
Context revision, DefinitionVersion, requester, Owner, request digest, Domain,
child DefinitionVersion, terminal event, or acceptance digest. Svc derives and
returns those coordinates from authoritative rows. This operation is not a
new privilege: existing `workflow.execute` and Svc Domain Owner checks both
apply. A malformed, extra-field, foreign-case,
stale-workflow-state-version, or unauthorized request fails closed before
relationship creation.

The Core capability response preserves the Svc binding receipt fields without
summarization. The Owner receives an immutable `bindingId`, source and child
coordinates, child acceptance contract digest, and initial binding status.
The idempotency key is generated inside the trusted HTTP transport and is not
visible to the Agent; no receipt-query tool is added. If bind returns
`transport_failure` or its outcome is otherwise unknown, the Owner reads the
existing `workflow_assistance_read.detail` projection and matches the exact
case, child instance and contract digest. A matching relation proves the bind.
If detail establishes neither a committed relation nor an authoritative
rejection, the outcome remains UNKNOWN: do not invoke bind again with a new
key, create a replacement child, or infer success/failure from tool text.
Core MUST NOT synthesize or infer any missing field.

## 3. Two distinct wake phases — `CTR-GCR-002`

The initial case wake remains exactly the existing
`wfassist-<assistanceCaseId>` request and
`workflow-assistance:<assistanceCaseId>` correlation. Binding a child does not
change or replay that wake.

On Svc's durable review outbox delivery, the existing Owner-wake route accepts
a closed phase `GOVERNANCE_CHILD_REVIEW` DTO. Initial wake DTOs remain exactly
as currently defined, with no phase field. Review DTOs carry the existing
source `workflowInstanceId`, `nodeVisitId`, `assistanceCaseId`,
`ownerPrincipalId`, plus exact `bindingId`, child instance/visit/
DefinitionVersion, terminal event, acceptance transition, current Owner
binding ID as informational metadata, `reviewWakeId`, and the required
`acceptanceContractDigest`. Only `childSubmissionId` and
`childSubmissionDigest` are optional, and they MUST be supplied together.
Its request identity and correlation MUST include the exact binding,
terminal event and recipient identity, and MUST differ from the initial case
wake, for example:

```text
requestId: wfassist-review-<bindingId>-<terminalEventId>-<ownerPrincipalId>-<reviewWakeId>
correlationId: workflow-assistance-review:<caseId>:<bindingId>:<terminalEventId>:<ownerPrincipalId>:<reviewWakeId>
```

The review phase is delivered with the existing `inter_agent` Owner-exception
origin, never as execution of the original visit. Duplicate delivery of the
same `reviewWakeId` to the same Owner Principal coalesces. A later Owner
assignment gets a new recipient-specific event identity even if that Principal
was assigned previously; the Owner-binding ID is informational and MUST NOT be
the deduplication identity because an existing role-binding row may be
reactivated. An earlier recipient's successful delivery cannot suppress the
new Owner's wake. The initial wake cannot
coalesce or suppress review. Svc performs the authoritative pre-delivery
reread, resolves the current Owner Principal through the existing canonical
Principal→Agent authority, and durably reassigns an outstanding review wake
when ownership changes. A prior delivery does not complete the review; the
current Owner receives a recipient-specific wake until explicit resolve or
escalation. Core validates the
closed phase DTO, exact UUIDs, configured service route/authentication, and
resolves the service-supplied Owner Principal through the existing canonical
Principal→Agent authority. Core does not assume or perform an Owner case-read
permission check on behalf of the Svc service. Invalid DTOs or failed
Principal resolution fail closed; transient delivery failures retain existing
retry behavior. The message identifies the exact child
instance, terminal event, acceptance transition and submission coordinates
when present. It instructs the Owner to use the existing Owner inbox/detail
read and authorized Workflow-instance/detail plus Submission reads to inspect
the exact child evidence before taking the existing resolve or escalation
action. Svc's existing Domain Owner detail visibility is the read boundary;
Core does not proxy or broaden it. The existing
`workflow_assistance_read.detail` Broker operation transparently returns the
Svc-added immutable binding and terminal-proof references. They support exact
readback after a lost bind response or Owner change; Core adds no case-read
permission and does not infer a missing binding from message history.

The route's initial closed DTO remains byte-compatible. Its additive review
union MUST require the `GOVERNANCE_CHILD_REVIEW` phase and all phase-specific
coordinates, reject unknown/contradictory fields, and pass the typed review
tuple to the Owner wake runtime. Core does not interpret the submitted verdict
as business truth. It records delivery evidence and preserves the existing
distinction between a delivered message and a completed review.

## 4. Existing resolve and escalation mapping — `CTR-GCR-003`

`workflow_assistance_action.resolve` and `.escalate_to_human` remain the only
Owner decisions. For a linked case, resolve forwards a closed typed
`governanceChildReview` reference containing `bindingId`, terminal event ID,
acceptance submission ID, submission digest, and acceptance contract digest.
The reference is nested under `resolution.supportingPayload` in the existing
`workflow_assistance_action` call. Core forwards that historically opaque
payload unchanged; it cannot identify linked cases from the payload and MUST
not newly reject fields for unlinked cases. Svc first determines whether the
case is linked, then validates the reserved object's closed shape for linked
resolve. Core does not manufacture these values from prose. Svc validates them
and the current Owner/case/source coordinates. A linked resolve without a valid exact
review reference is rejected. If resolve returns `transport_failure` or its
outcome is otherwise unknown, the Owner reads case detail and the existing WEC
resume evidence to establish whether the case resolved and whether the
original visit resumed. The transport-generated idempotency key is not exposed
for caller replay; absent authoritative readback, retain UNKNOWN and do not
submit a new resolve action. Escalation remains available without acceptance
proof and follows current Svc semantics. For an unlinked case, current
CTR-SWEC-010 request shape and behavior are unchanged.

After a valid linked resolve, Core consumes the same authoritative resume
evidence and gates required by CTR-WEC1-008: known settled delivery, fresh
pre-plan read, exact active dispatch, instance, visit and assignee, one
authorized next generation. The existing reconciler still cannot transition
the Workflow; the assigned Agent must use the ordinary authorized transition.

## 5. Delivery and admission invariants — `CTR-GCR-004`

- Only the current Domain Owner may bind, review-wake delivery targets the
  current Owner, and Svc is authoritative for both decisions.
- Binding and delivery are scoped to one open Assistance case and its exact
  originating instance, current visit, DefinitionVersion, requester and
  persisted request-payload digest. The request-time Context is immutable
  provenance from the `ASSISTANCE_REQUESTED` event, not a requirement that the
  source Context remain current: accepted current-task-input permits
  `CONTEXT_REVISED` within the same visit. The Owner resolves against a fresh
  current Context while the original request event/digest remains bound. The
  child terminal proof binds its actual terminal Context revision.
- The child is an existing nonterminal WorkflowInstance in the same enabled
  Domain, is not the source instance, and is bound to an exact published
  child DefinitionVersion and an existing transition whose target node is
  `TERMINAL`, with the required acceptance submission schema. The transition
  effect is not restricted to `TERMINATE`. If the terminal transaction wins
  the bind race, Svc refuses bind; no historic envelope is fabricated. Svc
  returns the exact selected contract and digest.
- A case may bind at most one child; a child may be bound to at most one case.
  Relations are immutable. A child already used as a governance child cannot
  become an origin; a candidate child already used as an origin is rejected.
  Self-links are rejected. Therefore the feature supports only one edge, not
  nested governance. A failed child uses its ordinary Assistance/human path;
  it cannot create a second governance child through this feature.
- Binding locks and rereads the case, origin instance/visit and child in a
  deterministic order. The same transaction creates the immutable relation
  only if the child is nonterminal. If the terminal transaction wins the race,
  binding is definitively refused; if binding wins, the later terminal
  transaction queues exactly one review event. No historical terminal event
  or acceptance envelope is retrofitted, and the race may not lose a review
  event after a successful bind.
- Every child terminal event after binding queues at most one durable review
  event keyed by binding and exact terminal event. Core must not infer an
  acceptance submission from terminal status alone.
- At review delivery and resolve, Svc rereads every bound source and child
  identity/visit/DefinitionVersion coordinate, and verifies the stored
  request-time, bind-time and terminal Context revisions against their
  corresponding persisted events. A later current Context may differ while the
  visit remains current. A source Context revision alone is not identity drift:
  retain the request-time Context and digest as provenance, and have the Owner
  inspect the fresh current source Context before resolving. Any
  identity/visit/version drift, ambiguous event or Submission, incomplete
  provenance, or missing digest fails closed without
  resolving the case or resuming the source visit.

## 6. Acceptance boundary — `ACC-GCR-001`

An isolated end-to-end acceptance must use the real Core Broker action and
real Svc/ Core route: Owner binds an existing same-Domain child; the child
reaches its declared terminal outcome; a distinct review wake is delivered;
Owner reads exact child acceptance evidence and explicitly resolves the same
case; Core verifies Svc's exact evidence and resumes only the original active
visit. The observed run must include one initial trigger and no external
human/Codex per-node reminder, model correction, transition, resolve, or
escalation. Assigned Agents still perform ordinary authorized transitions and
the Owner performs the explicit resolve through the existing native path;
these are required Workflow actions, not external intervention.

Required negative cases include unauthorized Owner, extra/mismatched action
fields, source/child Domain mismatch, self-link, duplicate child/case,
two-node cycle, origin already a child, child already an origin, stale case or
visit, child terminal/bind race in both orderings, repeated terminal/outbox
delivery, initial wake not swallowing review wake, wrong terminal event,
wrong submission/digest/DefinitionVersion, child self-assertion without exact
submission, Owner change before delivery and after successful delivery,
reassignment away and back to the same Principal, no-op Owner replacement,
case resolved before delivery, and linked resolve without exact evidence. It
must also show same-visit source Context revision preserves the original
request provenance and remains reviewable, detail readback recovers a committed
bind after a lost response, and inconclusive bind/resolve readback remains
UNKNOWN without a second mutation call. A real isolated test must also show
that existing unlinked Assistance resolution is unchanged.

The acceptance establishes protocol and evidence binding, not natural-language
business correctness. Any claim that the repair is substantively correct must
be evaluated from its pinned business artifact/source under the relevant
workflow's accepted criteria. Source merge, unit tests, wake delivery, child
terminal status, or this contract alone do not establish autonomous business
completion or production readiness.

## 7. Compatibility and activation

This is additive and becomes active only after both accepted companion Specs
merge into their respective authority branches; implementation is separately
authorized. Existing
outbox rows, initial wake keys, ordinary cases, routes and WEC2 resume behavior
remain unchanged. A partial deployment must fail closed for the new typed
operation; it must not silently emulate a linked review with the initial wake.

No production authorization is granted. There are no remaining normative
decisions delegated to an implementer.

## 8. Decision and alternatives

`DEC-GCR-001` — Add only one immutable relationship edge and one distinct
review-wake phase to existing Owner Assistance and WEC resume machinery.
Decision owner: root accepted this contract under mayf3's explicit delegation
after independent semantic review. Implementation remains separately
authorized. Rejected: automatically accepting a child terminal,
automatic source transition, generic obligation/budget platform, recursive
governance, or reusing the initial wake identity. Each either removes the
Owner decision, broadens authority beyond the observed gap, or can lose the
review event to existing case-wake deduplication.

`ACC-GCR-001` covers `CTR-GCR-001`–`004`; service correctness remains governed
by the separately accepted companion authority. Unit tests alone are
insufficient.

## 9. Migration and rollback

Additive capability and outbox phase only. No backfill or conversion of old
cases is permitted. Rollback disables creation/delivery of new bindings while
retaining persisted binding and receipt facts for authorized reads. Existing
initial wake and unlinked resolve paths remain available. A mixed Core/Svc
deployment must not expose bind unless both companion Specs and exact
compatible implementations are present; unknown phase or missing authority
fails closed.

## 10. Open questions

None. This Spec and its named Svc companion
`SVC_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1` are accepted in their candidate
commits. This authority becomes active only after both merge into their
owning authority branches; source implementation requires its separate
authorization, and production apply authority remains none.

## AMENDMENT_1 — TYPED GOVERNANCE REVIEW INPUT (2026-10-29, accepted)

> **AMENDMENT_STATUS = accepted.** Codex root accepts this additive delta under
> mayf3's explicit delegation on 2026-10-29. Independent reviewer
> `/root/assistance_resume_core_impl_luna` returned PASS on reviewed head
> `c4a81f2fd2984a3f458dc5a673a127909ac14bed`, candidate Spec SHA-256
> `6854c942a6b9b0e492e92c955efb3ae3a3f2c3e1782955f2181aa2a29cc92f66`.
> The review receipt is `ART/gcr-typed-review-spec-20261029/review-delta.md`
> under the task artifact root, SHA-256
> `56c50091d722a20c35fa55a503670e4fa49122b33a9b79fa038acd82bcb37e3d`.
> This acceptance-only commit changes no reviewed contract semantics. The
> amendment becomes active after merge to `main`; implementation requires a
> separate REUSE preflight and remains limited to source and isolated tests.
> Production apply authority is none. The accepted contract above, including
> `CTR-GCR-003` and `ACC-GCR-001`, remains unchanged.

### A1.1 Trigger and bounded decision

A65's frozen Broker trace records the Owner supplying an 11-member
`governanceChildReview` object to `workflow_assistance_action.resolve`; the
accepted Svc shape is closed to five members. Svc rejected the six additional
members before resolving the Assistance case. The five Svc-owned reference
fields were already present. This is a caller-shape interoperability gap: the
accepted Core contract describes a nested opaque reference forwarded unchanged,
while the service accepts only its five-field closed reference. It does not
justify weakening Svc validation or inferring an acceptance from child state.

This amendment adds one opt-in, typed caller input to the existing resolve
operation and a deterministic projection into the existing service request.
It does not change the Owner decision, service authority, or existing action
scope. It does not create a route, API, grant, or automatic resolution path.

### A1.2 `CTR-GCR-005` — Typed resolve projection

`workflow_assistance_action.resolve` MAY accept an optional top-level
`governanceChildReview` object with exactly these required string fields and no
additional fields:

```json
{
  "bindingId": "<uuid>",
  "terminalEventId": "<uuid>",
  "submissionId": "<uuid>",
  "submissionDigest": "<sha256>",
  "acceptanceContractDigest": "<sha256>"
}
```

When this argument is present, Core MUST project those five fields into
`resolution.supportingPayload.governanceChildReview` before sending the
existing resolve request. If `supportingPayload` is absent, Core MUST create it
in a copy-on-write request projection. If it is present as `null`, a primitive,
or an array, Core MUST reject the invocation with `invalid_arguments` before
HTTP. The same `invalid_arguments` result applies when the typed object or
`resolution` has an invalid schema/container shape. A pre-existing
`supportingPayload.governanceChildReview` target, regardless of its value,
MUST instead fail as `binding_error` during request binding, before HTTP; Core
MUST NOT overwrite it. The projection MUST NOT mutate the input arguments, the
caller-owned `resolution`, or an existing `supportingPayload` object. It MUST
preserve the resolution message and every unrelated payload member, and MUST
NOT derive, rewrite, or synthesize any reference value or silently remove
unknown fields. The service remains authoritative for exact UUID, digest,
case, Owner, binding, terminal event, and submission validation.

When the top-level typed argument is omitted, Core MUST preserve the existing
`resolution` argument unchanged, including its historically opaque
`supportingPayload`. In particular, Core MUST NOT newly reject opaque fields
for unlinked cases or infer linked status. Existing unlinked behavior and the
Svc linked-case strict validation under `CTR-GCR-003` remain in force.

This operation retains the existing `workflow.execute` scope, Owner action,
CAS, request route, and transport idempotency behavior. It does not auto-resolve,
change escalation, or authorize production apply. An unknown transport outcome
continues to follow the existing exact detail/readback and no-replay rules.

### A1.3 `ACC-GCR-002` — Projection conformance

| Contracts | Method | Environment | Required evidence | Expected result | Failure condition |
|---|---|---|---|---|---|
| `CTR-GCR-005` | Broker capability schema and HTTP-body projection tests, plus an isolated Core-to-Svc acceptance of the existing explicit Owner resolve | Local focused tests and isolated service fixture; no production | Exact input/output bodies, request count, error codes, input-object immutability, and existing idempotency behavior | Typed five-field input is deterministically projected; absent payload is created in a copy; omitted typed input is passed unchanged; siblings and message are preserved; invalid shapes return `invalid_arguments`; target collision returns `binding_error`; both error classes stop before HTTP | Any extra field accepted, value inferred/changed, input mutated, sibling lost, nested input overwritten, malformed container forwarded, incorrect error classification, or omission changes legacy behavior |

Required negatives include a sixth field in the typed object; each missing required field; non-object/null/array typed value; invalid `resolution`; present `supportingPayload` values of null, primitive, or array; and a pre-existing nested target with equal, different, null, or primitive value. Invalid typed/container shapes MUST return `invalid_arguments`; target collisions MUST return `binding_error`. Each must show zero downstream HTTP requests. Positive cases MUST show that an absent `supportingPayload` is created only in the projected copy and that all five fields reach the service unchanged; unrelated resolution and payload siblings remain byte/JSON-value equivalent, and the input args, resolution, and existing payload objects remain unchanged. The omitted-input case MUST show the existing nested opaque form forwarded unchanged. The existing Svc contract remains responsible for rejecting semantically invalid UUIDs, digests, and mismatched service references.

The end-to-end acceptance under `ACC-GCR-001` remains the protocol acceptance. `ACC-GCR-002` is an added focused contract acceptance and does not by itself establish autonomous business completion or production readiness.

### A1.4 Compatibility, scope, and lifecycle

This is strictly additive to the accepted Core contract: `CTR-GCR-001` through
`CTR-GCR-004`, `ACC-GCR-001`, and `DEC-GCR-001` retain their accepted text and
meaning. `CTR-GCR-003` continues to define the existing opaque nested path and
Svc linked-case authority; `CTR-GCR-005` supplies an explicit opt-in typed
caller path while preserving the legacy path when omitted. The Svc Spec and
implementation are unchanged. No migration is required. This accepted
amendment becomes implementation authority only after merge into the authority
branch; implementation authorization remains a separate action. Production
apply authority remains none.
