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

## AMENDMENT_2 — TRUSTED CURRENT GOVERNANCE-REVIEW REFERENCE (proposed)

> **AMENDMENT_STATUS = proposed.** This additive candidate is authored against
> accepted Core main `f63eaf6e000d2bbf4343c727d38474147db7f6cb`. It changes no
> Svc Contract and grants no production authority. Implementation is forbidden
> until this amendment is independently reviewed and accepted in the relevant
> authority branch; implementation then requires its own REUSE preflight.

### A2.1 Trigger and bounded decision

`OBS-GCR-003` — The immutable A68 excerpt
`ART/a68-typed-reference-diagnosis-20261029/a68-typed-resolve-excerpt.json`
(SHA-256
`ba18c78480b38f229d6c063735a4bf075fdea34779c52318ec9737237aeaeeef`)
records a successful Owner detail read with the service's terminal-proof
`submissionDigest`, followed 14 seconds later by an explicit resolve whose
typed `submissionDigest` differs at one hexadecimal character. The other four
typed reference fields match. The service returned HTTP 409
`assistance_status_conflict`; the case was not resolved. The excerpt is an
immutable selection from append-only public logs, not a claim about later run
state.

`OBS-GCR-004` — Accepted Core main `f63eaf6e000d2bbf4343c727d38474147db7f6cb`
contains the `CTR-GCR-005` contract for caller-supplied typed resolve values
(§A1.2, lines 412–436); this is authority text, not evidence that a source
projection implementation is present on that main commit. The accepted Svc
detail and resolve contracts remain the source of the immutable review
references and exact five-field validation (`SVC_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1`,
`CTR-GCRS-003`, §4, lines 247–267; `CTR-GCRS-006`, lines 406–447).

`OBS-GCR-005` — Read-only source inspection at the separate, unmerged Core
candidate `be067723947786b392dfe1ac178a98fb5386bad2` found
`packages/broker/src/transport/body-projection.js` and
`packages/broker/src/transport/http.js`. That candidate's body projection
accepts declared current-operation arguments as sources, and its HTTP handler
binds one operation and its current arguments; it has no read-result
association or persistent result store. The file does not exist at accepted
main `f63eaf6e000d2bbf4343c727d38474147db7f6cb`. This source observation is
not accepted-main behavior or implementation authority.

`CLM-GCR-002` — SUPPORTED: an explicitly selected static, same-caller read to
the existing case-detail operation can eliminate model transcription of the
service-owned long digest while preserving both the exact-input behavior of
`CTR-GCR-005` and Svc's strict reference validation. A persistent read-result
vault, model-chosen lookup path, and automatic resolve are unnecessary.

`EVD-GCR-002` — `OBS-GCR-003/004/005` support this bounded caller-input
interoperability delta only; OBS-GCR-005 describes an unmerged source candidate,
not accepted-main implementation. They do not prove that this operation is
implemented, installed, or successful in a native run.

This amendment adds one explicit Broker operation to the existing
`workflow_assistance_action` capability. It does not change the existing
`resolve` operation or its exact typed-input semantics under `CTR-GCR-005`;
does not change the historically opaque behavior when `resolve` omits the typed
input; and does not change the Svc request shape or authority. The new operation
is a separate, explicit Owner action so the `MUST NOT derive` rule for the
caller-supplied `CTR-GCR-005` input remains intact.

Decision: add a separate operation with a static read source. Leaving the
direct path unchanged leaves the demonstrated transcription error reachable;
correcting explicit values or loosening Svc would contradict exact projection
and the service's closed-reference authority; a persistent cache could bind a
stale or other caller's result. A fresh same-caller read inside this distinct
explicit operation avoids those alternatives without changing the old
operation's meaning, so this is an additive `AMEND`, not a partial
supersession.

### A2.2 `CTR-GCR-006` — Explicit resolve from current service review

The existing capability MAY add this distinct operation:

```json
{
  "operation": "resolve_current_governance_review",
  "assistanceCaseId": "<uuid>",
  "expectedWorkflowStateVersion": 3,
  "resolution": {
    "message": "<Owner's explicit resolution>",
    "supportingPayload": { "otherEvidence": "preserved" }
  }
}
```

Calling this operation is the Owner's explicit resolve decision. It MUST NOT
be invoked automatically from a terminal child, a read, an accepted verdict,
elapsed time, or an execution-engine reconciliation. The model-facing
operation MUST instruct the Owner to inspect the exact child terminal event and
Submission through the existing authorized read tools and decide whether to
resolve or escalate before calling it.

The operation MUST use a trusted static read-to-body projection declared in
the Broker manifest. The declaration MUST name exactly the existing
`workflow_assistance_read.detail` read operation and statically bind its
`assistanceCaseId` argument from this operation's `assistanceCaseId`. The
mapping MUST select only these fields from that single fresh response:

| Svc detail source | Existing resolve-body destination |
|---|---|
| `governanceBinding.bindingId` | `resolution.supportingPayload.governanceChildReview.bindingId` |
| `governanceTerminalProof.terminalEventId` | `resolution.supportingPayload.governanceChildReview.terminalEventId` |
| `governanceTerminalProof.submissionId` | `resolution.supportingPayload.governanceChildReview.submissionId` |
| `governanceTerminalProof.submissionDigest` | `resolution.supportingPayload.governanceChildReview.submissionDigest` |
| `governanceBinding.acceptanceContractDigest` | `resolution.supportingPayload.governanceChildReview.acceptanceContractDigest` |

The Broker MUST perform the read for the same actual caller as the resolve
action through the normal gateway authorization path for
`workflow_assistance_read.detail`, including its existing `workflow.read`
authorization. It MUST separately enforce the existing `workflow.execute`
authorization for the resolve action. Both scopes and the Domain Owner check
already exist; this amendment adds no scope, Grant, role, credential, identity
override, service route, or Svc API. A missing read capability or denied read
MUST fail before the resolve POST and MUST NOT fall back to a broader identity
or direct unscoped fetch.

The read-to-body mapping MUST be static trusted manifest data. The caller MUST
not choose a source capability, service route, response path, destination
path, or field mapping. The implementation MUST validate the source operation
as the declared read operation, bind only declared invocation arguments, and
reject unsafe, undeclared, overlapping, or invalid paths before registration.
It MUST use an invocation-local response; it MUST NOT use a cached result from
another call, case, Agent, process, or runtime. It MUST NOT return the full
internal read result as a substitute for the normal read operation.

Before sending the resolve POST, Core MUST verify these predicates against the
single detail response (all paths are relative to that response):

- `detail.assistanceCaseId == requested assistanceCaseId` and
  `detail.status == OWNER_PENDING`.
- `detail.workflowStateVersion == caller expectedWorkflowStateVersion`.
- `detail.governanceBinding.assistanceCaseId == requested assistanceCaseId`
  and `detail.governanceBinding.status == BOUND`.
- `detail.governanceBinding.source.workflowInstanceId == detail.workflowInstanceId`
  and `detail.governanceBinding.source.nodeVisitId == detail.nodeVisitId`.
- `detail.governanceBinding.child.definitionVersionId ==
  detail.governanceTerminalProof.definitionVersionId` and
  `detail.governanceBinding.child.acceptanceTransitionId ==
  detail.governanceTerminalProof.transitionId`.
- `detail.governanceBinding.acceptanceContractDigest ==
  detail.governanceTerminalProof.acceptanceContractDigest`.
- `detail.governanceBinding.currentReview.deliveryStatus == DELIVERED` and
  `detail.governanceBinding.currentReview.reviewStatus == OUTSTANDING`.
- `detail.governanceTerminalProof.verdict == ACCEPTED`.

The five mapped source values in the table above MUST each be present as
strings. The DTO's proof object has no `bindingId`; Core MUST NOT require one or
invent any other proof-to-binding field. The Svc detail contract binds the
proof to the immutable governance relation. Missing, malformed, mismatched,
stale, or non-accepted source evidence MUST stop before POST. A source-state-
version mismatch MUST return `workflow_state_version_conflict`; unusable or
inconsistent review evidence MUST return
`authoritative_reference_unavailable`. Read authorization, visibility, and
transport failures MUST retain their declared failure semantics. None of these
failures may send the resolve request.

For a valid read, Core MUST project the five service-owned values directly into
the existing `resolution.supportingPayload.governanceChildReview` body slot,
using copy-on-write and preserving the Owner's message and every unrelated
payload member. This new operation MUST reject a caller-supplied
`supportingPayload.governanceChildReview` target before the read; it MUST NOT
overwrite, merge, compare-and-correct, or delete one. Its arguments do not
accept a top-level `governanceChildReview` value. The operation MUST send the
caller's original `expectedWorkflowStateVersion` unchanged; it MUST NOT replace
it with the version returned by the read. Svc's existing case, current Owner,
CAS, binding, terminal-event, submission, digest, and `ACCEPTED` checks remain
the final mutation authority. A race after the read is handled by those
existing Svc checks; Core MUST NOT automatically reread and retry.

The operation uses the existing Svc resolve route, payload, `workflow.execute`
action, and transport idempotency behavior. A POST with unknown outcome MUST
follow the existing exact detail/readback and no-new-key/no-replay rules. This
operation adds no automatic transition, no automatic resolve, and no
acceptance decision by Core.

The existing `resolve` operation remains unchanged: when the explicit typed
object is supplied it is projected exactly as supplied under `CTR-GCR-005`,
without read-derived correction; when omitted, legacy resolution input is
forwarded unchanged. The new operation is the only path that performs the
declared current-detail read and read-derived projection.

### A2.3 `ACC-GCR-003` — Current-review read projection conformance

| Contracts | Method | Environment | Required evidence | Expected result | Failure condition |
|---|---|---|---|---|---|
| `CTR-GCR-006` | Static manifest validation, focused Broker tests, then isolated Core-to-Svc linked resolve using the existing service fixture | Local tests and task-owned service/database only; no production | Exact source GET and resolve POST identities/bodies/counts; caller/scope authorization; input immutability; returned Svc receipt and authoritative readback | One explicit `resolve_current_governance_review` call performs one same-caller authorized detail read, projects exactly the five returned service fields, preserves the caller's original expected version and unrelated resolution content, and reaches the unchanged strict Svc resolve successfully when evidence remains current | Any model-selected source/path/mapping; missing or failed read followed by POST; wrong-case/stale/non-accepted source projected; any copied or rewritten version; source data leaked from shared cache; duplicate/implicit resolve; Svc validation weakened; any failure path that sends POST |

Required positive tests MUST assert that a deliberately nontrivial digest read
from Svc reaches the resolve request byte-for-byte, with exactly one source
read and one resolve POST, the original expected version unchanged, siblings
preserved, and no input mutation. The isolated service test MUST read back the
resolved case and same-visit resume evidence using the existing acceptance
fixture.

The operation MUST be admitted only when the exact operation is present in the
caller's frozen native-tool policy; a policy that allows only the existing
`resolve` operation MUST NOT implicitly allow this operation. The changed
`allowedCalls` MUST be covered by the existing `policyDigest`, and the process
MUST use the existing native-policy initialization acknowledgement for the
matching `{version, agentId, policyDigest}` before model work. This amendment
MUST NOT extend that acknowledgement shape with a tool-snapshot field. Broker
manifest registration and generated tool-schema conformance MUST prove that
`resolve_current_governance_review` is an actually registered operation with
the declared arguments; a policy entry alone MUST NOT create a tool operation.
Its Owner review-wake instructions and operation description MUST identify
this operation as the path for resolving a linked accepted child review, while
leaving the Owner's explicit decision requirement intact.

Required negatives MUST assert logical operation invocations separately from
wire requests, not only final errors:

| Condition | Internal detail-operation invocations | Detail GETs sent downstream | Resolve POSTs |
|---|---:|---:|---:|
| Invalid arguments or pre-existing reserved nested target | 0 | 0 | 0 |
| Native policy lacks the exact operation, policy digest/initialization acknowledgement is stale, or Broker registration/schema omits the operation | 0 | 0 | 0 |
| Read-scope authorization or token denial before HTTP | 1 | 0 | 0 |
| Service 404/non-visible case response | 1 | 1 | 0 |
| Read transport failure before request emission | 1 | 0 | 0 |
| Read transport failure after request emission or read HTTP error | 1 | 1 | 0 |
| Wrong case ID, unexpected case status, or state-version mismatch | 1 | 1 | 0 |
| Absent binding/proof, non-`ACCEPTED` verdict, or undelivered/non-outstanding review | 1 | 1 | 0 |
| Mismatched binding/contract digest; missing, non-string, or ambiguous mapped values | 1 | 1 | 0 |
| Unsafe or undeclared static mapping | 0 (registration rejection) | 0 | 0 |

A read authorization denial counts as an attempted internal detail-operation
invocation but MUST NOT be represented as a wire GET. For transport failures,
tests MUST count a GET only if the test transport observed request emission;
all such failures still require zero resolve POSTs. The native policy ack is
only the existing `{version, agentId, policyDigest}` tuple. Broker registration
and generated-schema checks, not an added native-ack field, establish that the
operation is actually exposed.

They MUST also show that the original `resolve` operation does not silently
select this mode, that a bad explicit `CTR-GCR-005` reference is passed to Svc
unchanged and receives Svc's existing rejection, that unlinked opaque resolve
remains unchanged, and that post-POST unknown still follows the current
no-replay behavior.

### A2.4 Compatibility, authority, and lifecycle

This amendment adds only `CTR-GCR-006` and `ACC-GCR-003`. `CTR-GCR-001` through
`CTR-GCR-005`, `ACC-GCR-001` and `ACC-GCR-002`, WEC V2 resume, and the accepted
Svc companion retain their accepted meaning. The operation is an additive
caller-input path to the same explicit Owner action and existing Svc endpoint;
it adds no Service contract, permission, Grant, role, Auth scope, data record,
cache, route, or production authorization. No migration or backfill is
required. The Spec establishes interface authority only; it does not establish
implementation, installation, A68 completion, production adoption, or
business correctness. Any later implementation requires a separate REUSE
preflight after this amendment is accepted.
