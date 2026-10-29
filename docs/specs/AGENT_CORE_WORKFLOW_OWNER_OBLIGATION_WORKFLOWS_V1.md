---
spec_id: AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1
title: Core broker and execution companion for Svc-owned Owner obligation Workflows
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
scope:
  - managed-workflow-broker
  - owner-obligation-read-capability
  - trusted-write-routing
date: 2026-10-29
revision: draft-3
candidate_base: 45268be276276462bd71040f0cd51b28a7764fe0
governed_by:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V3
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
  - AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V2
  - AGENT_CORE_WORKFLOW_PREREQUISITE_ORCHESTRATION_V4
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V2
  - AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1
  - AGENT_CORE_TRUSTED_NATIVE_TOOL_POLICY_V1
paired_authority: SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1
external_authorities: []
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1 — proposed paired broker/execution contract

`status: proposed` is deliberate. This is a docs proposal only, not implementation or production authority. Accepted predecessors remain effective in the candidate base until complete successors are independently reviewed, accepted by the authorized Owner, and merged with reciprocal lifecycle links. The A75 evidence is recorded in `docs/investigations/A75_OWNER_OBLIGATION_NEW_EVIDENCE_20261029.md`; it shows partial unattended nonprogress, not a cause inferred from model text.

## Goal

Give an opted-in Owner request a real bounded Workflow path whose required work is admitted from trusted node contracts and completed only against real Svc receipts, so the Owner's successfully ended turn cannot leave an unrecorded obligation.

## Scope and non-goals

Scope is the Core side of the exact Svc-owned intake/review singletons: trusted managed-turn routing, current-owner bounded reads, effect-result passthrough, existing WAE/WEC execution, and no-bypass behavior. Non-goals are source implementation, production activation, policy provisioning, new model-facing write tool, flat plan/catalog language, Core business-state machine, automatic Owner handoff, replay after UNKNOWN, or mutation/replay of A75.

## Authority and dependencies

This proposal is governed by the proposed Core WAE V3, WEC V3, GCR V2, WPO V4, Assignee Transition Capability V2 whole successors, and the accepted `AGENT_CORE_TRUSTED_NATIVE_TOOL_POLICY_V1` at base `45268be276276462bd71040f0cd51b28a7764fe0` (§§2–4); it is paired with proposed Svc `SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1`. Every predecessor remains accepted/current and unmodified in base `45268be276276462bd71040f0cd51b28a7764fe0` until the exact paired set is accepted and lifecycle-merged. Current broker mapping input is frozen in the author addenda cited at the end.

## Current State

- Core proposal base: `45268be276276462bd71040f0cd51b28a7764fe0`.
- Svc proposal base: `f5e7f328ccba5f6e0d752abf74e68558ef38ca0f`.
- A75 actual report: normal Owner turn ended after one supplier create; no consumer/GCR creation was observed and source case remained `OWNER_PENDING`. WAIT/READY exercise is UNKNOWN. Run exited naturally; no rerun is in scope.
- No Core implementation or production conformance is claimed by this Spec.

## Observations

`docs/investigations/A75_OWNER_OBLIGATION_NEW_EVIDENCE_20261029.md` records the exact native and read-only Svc evidence pins. Its scope is observational; it does not infer the model's reason for stopping or retroactively classify an unobserved WAIT/READY state.

## Claims and assumptions

- `CLM-CORE-OWNER-001` — SUPPORTED only for the cited A75 run: normal completion of the observed Owner turn did not complete the business case. This does not establish why it ended.
- `CLM-CORE-OWNER-002` — OPEN_ACTIVATION until future independent implementation/runtime evidence: native-source review supports an immutable exact model-tool allowlist, but A75 had read/write tools and did not satisfy the proposed activation boundary. Actual policy-generation ACK, synthetic deny probe, non-model-writable Broker/module/policy configuration, and redacted environment key-name readback must all be evidenced before producer activation. An ordinary Svc JWT alone does not prove that boundary; no OS same-UID/ACL split is required.

## Evidence relations

The A75 report, evidence JSON, natural-exit receipt, and read-only Svc snapshot are pinned in the Investigation Record. They SUPPORT `CLM-CORE-OWNER-001` for the observed run only. They do not support implementation correctness, service availability, WAIT/READY, or autonomous closure.

## Decisions

Reuse actual published Workflow instances and existing WAE/WEC/GCR/QA/RETURN. Preserve existing write entries and route managed requests through a trusted local wrapper. Add only the `workflow_owner_obligation` read capability. Svc remains the owner of intent, effect, case, receipt, policy, STOP, and current readiness truth.

## 1. Goal, scope, and selected direction

Reuse published Workflows, NodeVisits, independent QA, ADVANCE/RETURN, existing WAE/WEC execution and settlement, and existing typed Governance Child Review (GCR) actions. Svc owns persistent intake/review/effect responsibilities and is authoritative for current Owner, case, receipt, effect, and business-state facts. Core supplies trusted workflow execution provenance, closed Broker projections, and normal bounded execution of the true intake and separate review Workflow singletons.

There is no flat required-work catalog, second plan/template/materializer language, generic `resultOf` resolver, parallel plan-completeness evaluator, or Core case/phase continuation engine. The original Owner wake remains `inter_agent`; it does not become source-visit `workflow_execution`. For opted-in cases, the intake Workflow is the sole initial execution path; terminal review uses a separate real Workflow, not a second GCR child.

## 2. Managed turn provenance and operation admission

For a managed intake or review turn, Core resolves `{kind:'workflow_execution',workflowInstanceId,nodeVisitId,attemptId}` only through the existing trusted `workflowExecutionContextAccess`; model arguments cannot create, omit, replace, or delete these coordinates. Core obtains the service-owned current managed relation and exact published node contract, including its closed `workflowOperation` descriptor. The model cannot select a slot, operation descriptor, occurrence, or alternate plan.

The managed path uses these existing model-visible write entries and retains their current closed business arguments and `workflow.execute` scope:

| Existing capability and operation | Registry key used by the managed effect | Managed behavior |
|---|---|---|
| `workflow_execute`, `operation="create_instance"` | `workflow.create_instance` | The local trusted wrapper reads the exact node declaration, verifies pinned `targetDefinitionVersionId` and `targetDefinitionDigest`, derives managed workflow coordinates from the authoritative Svc relation, then performs exactly one same-caller `workflow_assistance_read.detail({assistanceCaseId: managedRelation.caseId})` using `workflow.read`. It verifies the returned case, source instance, source visit, current source visit, BOUND lineage, and current Owner context against the managed relation before routing the existing create DTO through the guarded effect endpoint. Unmanaged calls keep their current route. |
| `workflow_assistance_action`, `operation="resolve_current_governance_review"` | `workflow.assistance.resolve_current_review` | Unmanaged/non-opted-in calls preserve the existing trusted current-review read/projection and its `DELIVERED`/`OUTSTANDING` requirements. A trusted ACTIVE managed REVIEW turn instead requires the service-owned `currentNode.reviewAdmission` projection plus the same-caller Assistance detail read; it copies the exact five immutable proof fields and routes one guarded effect request. Caller-supplied or fabricated review references do not replace either projection. |
| `workflow_assistance_action`, `operation="escalate_to_human"` | `workflow.assistance.escalate_to_human` | Route the existing exact assistance DTO through the same guarded effect endpoint. |

For the managed REVIEW alternative, Core requires exact trusted instance/visit/current managed version, `managedRelation.caseId == arguments.assistanceCaseId == detail.assistanceCaseId`, and `reviewAdmission.source == detail/governanceBinding.source` including DefinitionVersion. The projected Owner Principal must equal the caller Principal from the existing trusted identity seam; detail/binding child acceptance transition, Definition and contract must match the verified terminal proof. Reject any caller-provided `resolution.supportingPayload.governanceChildReview`; copy exactly the five proof fields into that reserved object. The source CAS in the managed effect envelope and projected `arguments.expectedWorkflowStateVersion` both remain the explicit model CAS and are independently checked by Svc. If the stable effect read returns the exact `SUCCEEDED` result for this same slot, Core completes the review node from that original receipt without requesting a new ADMISSIBLE projection or issuing another resolve.

No `workflow_operation_effect.execute` model tool is added, and the fixture-only `fixed_operation` model tool is not exposed as a production create path. A production descriptor and asynchronous durable handler may reuse its registry, schema, and trusted-context validation patterns under this Spec's new authority. Other managed source/case writes, including generic create attempts that evade the declared node slot, are routed through the declared guard or refused with `GOVERNED_OPERATION_REQUIRED`. Existing transitions remain on the existing `workflow_execute` capability; Svc's required-operation acceptance guard prevents direct transition from bypassing a required action. Generic capabilities continue to serve unrelated unmanaged workflows.

For the internal effect request, `managedInstanceId` and `nodeVisitId` come from actual runtime provenance, `slotKey` and `{key,version,hash}` come from the exact published node, and actor comes from the existing credential seam. Core constructs exactly:

```json
{
  "expectedWorkflowStateVersion": 17,
  "expectedSourceWorkflowStateVersion": 8,
  "operation": {"key": "workflow.create_instance", "version": 1, "hash": "<published-hash>"},
  "arguments": {"domainId": "<uuid>", "definitionVersionId": "<uuid>", "initialContext": {}}
}
```

The internal endpoint is `POST /internal/v1/workflow-instances/{managedInstanceId}/node-visits/{nodeVisitId}/operation-effects/{slotKey}:execute`; its body is closed with `additionalProperties:false`. The managed workflow state version is taken from the one fresh authoritative managed read. For existing assistance actions, `expectedSourceWorkflowStateVersion` must equal the caller's explicit `expectedWorkflowStateVersion`; a detail read may check equality but must not replace a stale caller CAS. For ordinary create, whose existing DTO has no CAS, Core performs exactly one same-caller `workflow_assistance_read.detail({assistanceCaseId})` using the case ID from the managed relation and takes `expectedSourceWorkflowStateVersion` from that returned `workflowStateVersion`. It verifies `assistanceCaseId`, `workflowInstanceId`, `nodeVisitId`, `currentNodeVisitId`, `governanceBinding` and source lineage against the managed relation before constructing the envelope. The detail read and managed read are not claimed to share a DB snapshot; Svc independently locks and rechecks both source and managed versions plus lineage in the effect transaction. Any drift receives the actual Svc rejection; Broker does not reread or retry.

For ordinary-create descriptors the exact published node also pins `targetDefinitionVersionId` and `targetDefinitionDigest`; the business DTO must select that same immutable published Version, and another target is rejected. The two policy-selected managed Versions carry a closed `x-workflow-owner-obligation-role-v1` enum (`INTAKE` or `REVIEW`) and cannot be created by an ordinary create call. Their graph cannot select an auto-intake target, arbitrary dynamic target, or another create operation. Managed creates may create only a pinned ordinary dependency leaf, whose lineage is recorded by Svc; a leaf cannot create another workflow. `arguments` contains the existing operation's fully projected business DTO, after the existing resolve-current-review projection if applicable. There is no universal business materializer. Forward the existing auth principal and `workflow.execute` credential seam; Svc independently checks current Owner, case, managed visit, descriptor, effect, pinned target, and command authority. Preserve actual receipts, errors, optional `admissionObservation` presence/absence, and existing GCR `prerequisiteReadiness` without synthesis.

## 3. Trusted boundary and no bypass

The service JWT does not identify a Core turn. Broker obtains invocation provenance from the trusted local runtime seam and does not forward model-supplied provenance. The managed wrapper also runs for ordinary `workflow_execute` calls made inside a managed turn, including calls that attempt an undeclared create or omit the trusted origin; these are guarded or refused instead of falling through to the generic route. Non-managed routing stays unchanged.

The activation gate is the measured model-tool-reachable boundary: the actual native immutable exact allowlist exposes only the closed workflow Broker surface and prevents file/exec/HTTP/MCP escape; active policy-generation ACK is present; a non-sensitive synthetic deny probe is observed; Broker/module/policy configuration is not model-writable; and environment readback exposes key names only, never values. A75 itself retained read/write access and fails this gate. No OS same-UID/ACL separation or new native feature is required. The ordinary Svc JWT alone is insufficient proof of a Core turn. No Auth-service scope, Grant, role, credential, or identity override is added.

## 4. Read-only Owner-obligation capability

Add one read-only capability with manifest `id`/`toolName="workflow_owner_obligation"`, selector `operation`, `requiredScopes=["workflow.read"]`, and JSON result type. Its only operations and arguments are:

| Operation | Exact arguments | Remote binding |
|---|---|---|
| `read` | `{ "workflowInstanceId": "<uuid>" }` | `GET /internal/v1/workflow-instances/{workflowInstanceId}/owner-obligation` |
| `read_effect` | `{ "workflowInstanceId": "<uuid>", "effectId": "<uuid>" }` | `GET /internal/v1/workflow-instances/{workflowInstanceId}/operation-effects/{effectId}` |

Each operation has a closed schema (`additionalProperties:false`) with exactly the listed required UUID-format strings. Requests have no body, query parameters, or Idempotency-Key. Preserve the actual closed Svc DTO, typed state, and declared deterministic/transport errors; do not infer success or add coordinates. Svc independently applies current enabled Owner or authorized managed-assignee visibility. `workflow.read` is not global enumeration or a new permission grant.

The `read` response is the paired Svc closed shape `{version:1,managedKind,workflowInstanceId,definitionVersionId,caseId,policyDigest,state,currentNode?,stop?}`. `managedKind` is `INTAKE|REVIEW|DEPENDENCY`; state is `ACTIVE|STOPPED|RETIRED|COMPLETED`. Present `currentNode` is `{nodeVisitId,nodeDefinitionId,workflowStateVersion,operation?,reviewAdmission?}`; a present operation is `{slotKey,allowedOperations,targetDefinitionVersionId?,targetDefinitionDigest?,effect}`. The optional closed `reviewAdmission` is present only for an admissible active REVIEW resolve node and has exactly `{version:1,status:'ADMISSIBLE',source:{workflowInstanceId,nodeVisitId,definitionVersionId},owner:{principalId,bindingId},proof:{bindingId,terminalEventId,submissionId,submissionDigest,acceptanceContractDigest}}`; all fields are required when present, with no null/partial values. Svc derives it from the actual review singleton, current visit/node/slot, case, binding, terminal Event/Submission, verified accepted proof and current Owner under one authorization-consistent snapshot. It is permission to attempt a guarded action, not a wake/delivery receipt or completion. A present operation's `effect` is a closed union: `NOT_STARTED` only after Svc proves no claim under the exact stable key; `PREPARED|STARTED|UNKNOWN` with the actual `effectId` and only stored request/command coordinates; `SUCCEEDED` with actual `effectId`, `commandId`, request digest, result, and result digest; or `REJECTED_ZERO_FACTS` with actual failure receipt facts. Absence of `commandId` is never proof of zero effects. Present `stop` is `{code,responsibilityId,ownerReplacementCommandId?,nodeVisitId?,attemptId?,effectId?}` with unavailable coordinates omitted.

This exact relation lookup derives the stable effect key from managed relation + published node/slot + logical occurrence 1, excluding current visit, attempt, and Owner. Thus a lost first response is discoverable by calling `read(workflowInstanceId)` without guessing an effect ID; `read_effect` is used when the ID is known. Missing/corrupt relations, storage outages, ambiguous commits, or unproven lineage fail closed as UNKNOWN and may not be projected as `NOT_STARTED`. Claiming the effect is atomic under its unique key in Svc. `read_effect` is authorized effect readback, never command replay. Core emits no fake UUID, null proof, success envelope, or inferred command fact.

## 5. Durable effect and receipt joins

The accepted WAE ledger remains workflow-attempt/quiescence evidence only; its attempt or invocation ID is not a durable business-effect key. The Svc effect key is stable across current NodeVisit, attempt, Router turn, Owner/assignment epoch, CAS version, and input digest. Core reads the Svc result and never creates a replacement identity after RETURN, Owner change, response loss, UNKNOWN, or known zero-fact rejection. The earlier design's proposed cross-RETURN per-logical-action admission counter is superseded: no new Svc admission-claim route or trusted-native-attempt claim is added. The actual WAE ledger admits at most three attempts per real NodeVisit using its existing lock; managed policy freezes that actual limit at three regardless of higher global overrides.

Svc effect state `SUCCEEDED` contains the original command and real result. `REJECTED_ZERO_FACTS` is a known deterministic failure and is terminal for this V1 required action; do not automatically retry a new CAS, changed body, or key. `STARTED`/`UNKNOWN` is readback-only until actual authority resolves the original outcome. Core's required-operation advancement and terminal acceptance join the node declaration to actual Svc command receipt and business facts, never to model text or Context claims. No successful-looking envelope is allowed when receipt coordinates are unknown.

## 6. Singleton execution, responsibilities, and normal control

Both intake and review are ordinary published Workflow instances executed through the existing WAE/WEC path and budgets. The request wake is routed to the actual intake singleton; a terminal fact creates one separate review singleton. The review is not a second GCR child. Duplicate/restart/replay follows the Svc responsibility and effect identities; Core ledger loss cannot mint a fresh child or reset a business effect.

Delivery, Router quiescence, action receipt, and satisfaction of the case are distinct facts. A wake acknowledgement or model `completed` result does not satisfy an Owner/business obligation. Existing ADVANCE/RETURN and independent QA remain authoritative for graph progress; the new service-owned gates join required operations to actual receipts. Existing explicit Owner resolution remains required; Core does not resolve cases or infer business correctness.

## 7. Late UUID and typed node readiness

The paired Svc contract defines the closed node-only `workflowPrerequisiteGate` and evaluates the current prerequisite inside its existing READY-only due query. Core consumes the existing due feed unchanged: a non-READY managed node is absent from dispatchable rows, so it produces zero WAE attempts and zero Router deliveries. No new readiness tool, field in `list_ready`, source receipt coordinate, or Scheduler projection is added. Core does not infer readiness from Context, a predicted UUID, prior model output, or a terminal-looking message. Existing prerequisite parsing, proof visibility, query-before-LIMIT, and current snapshot semantics remain Svc-owned.

This gate applies only to the exact managed intake node and does not relax the existing WPO V3 root create marker, ordinary `admissionObservation` behavior, or GCR `prerequisiteReadiness` mapping. Ordinary dependent creates continue to require actual supplier IDs under existing authority.

## 8. Owner replacement, UNKNOWN, and bounded stop

V1 does not hand off a managed NodeVisit on Owner replacement. Svc fences the old Owner in the replacement transaction and persists `OWNER_CHANGED_UNSUPPORTED`; the current Owner may read the bounded stop/effect projections. A→B→A, no-op, or replay cannot reset effects or budgets. No new visit, workflow, recipient, effect key, or fake `HUMAN_REQUIRED` transition is created. Prior pending/unknown execution remains fenced under existing quiescence and Svc authority.

The finite bound reuses actual producers: each managed TASK NodeVisit has at most three WEC admissions in the existing Core ledger, and each managed RETURN edge permits at most three actual Svc RETURN Events. Publication validates the managed graph's full ADVANCE subgraph is acyclic and all nonterminal normal paths reach terminal. For `T` TASK nodes and `E_RETURN` declared RETURN edges, admitted TASK turns are bounded by `3 * T * (1 + 3 * E_RETURN)`. This is an upper bound; it does not promise every attempt or task succeeds. Stable effects remain unique regardless of visits/admissions; Owner replacement does not start a new budget.

There is no new Svc admission-claim API. The real execution-escalation transaction writes one typed STOP for the actual managed cap exhaustion; the real transition transaction that commits a RETURN limit writes `RETURN_LIMIT_REACHED` against that Event/target visit; the deterministic effect-rejection receipt transaction writes `OPERATION_REJECTED_ZERO_FACTS`; and a genuinely unresolved result remains UNKNOWN. These producers preserve existing Event/receipt cardinalities and never synthesize a fresh HUMAN_REQUIRED transition. Owner-visible STOP is served only through existing authorized inbox/detail and the narrow managed relation.

UNKNOWN is readback-only. Known deterministic zero-fact rejection is preserved as a distinct stopped disposition; the model cannot change the body and retry. Cap exhaustion, unsupported Owner change, and other terminal failures produce one durable Svc STOP relation visible through the existing authorized surfaces, not just local `needs_review` or silent completion. A policy-specific reconciler may invoke only the exact pinned internal policy producer authorized by the immutable Owner publication receipt; it uses the existing enabled `pm` Principal when fresh preflight proves the exact identity and policy, never impersonates Owner or upgrades global scheduler read into generic write access. Missing proof fails closed. Intake/review and effect-created leaf dependencies cannot recursively create additional GCR obligations; review is not a child, and leaf dependencies are barred from creating further workflow instances. Core creates no compensation or cancellation beyond existing receipted authority.

## 9. Review's own completion

The review Workflow explicitly calls existing `resolve_current_governance_review` or `escalate_to_human` using the trusted projection and records its actual Svc effect receipt. If that exact effect resolves the source case, the review may read back the matching receipt and complete its own slot. An unrelated resolution/VOID retires the stale review instead. Escalation permits only its actual typed outcome; it is not a fabricated source resolution.

## 10. Acceptance matrix for counterexamples

| Contract | Method | Environment | Required evidence | Expected result | Failure condition |
|---|---|---|---|---|---|
| Singleton intake/review and normal execution | Duplicate/restart/concurrency and actual runtime-provenance tests | Isolated paired Core/Svc fixture | Exact `AUTO_CREATE_AND_BIND_OWNER_INTAKE` two-event receipt, separate `AUTO_CREATE_OWNER_REVIEW` one-event receipt, workflow provenance | One intake child and one review; existing WAE/WEC executes them | Duplicate child/review, second binding, wrong command identity/cardinality, dual naked chat or fake workflow identity |
| Existing write entries and trusted routing | Manifest/schema/transport checks for each existing write mapping in managed and unmanaged turns | Isolated Core Broker + Svc HTTP | Tool manifest, trusted context, single same-caller detail request, exact reviewAdmission/detail join, actual request/response and Svc receipt | Ordinary create uses one detail read for source CAS; explicit assistance CAS is preserved; managed REVIEW uses exact projection; legacy path remains strict; managed operation routes through exact guard | New write tool, caller-selected slot/context, generic create bypass, reread/retry, source CAS rewrite, legacy gate relaxed, or unmanaged behavior changed |
| Durable effect | Same effect across attempt/RETURN/Owner changes; lose initial response and call read | Isolated paired Core/Svc with real receipt store | Effect DTO, unique key, original receipt/result and readback trace | Original effect/result discovered without guessing ID | Identity reset, duplicate supplier, fabricated result/future UUID, false NOT_STARTED or changed-body replacement |
| Required action acceptance | Attempt ADVANCE/completion with real, absent, wrong and mismatched receipt | Isolated paired transaction fixture | Svc receipt/Event/Submission and rejection/success response | Only joined actual effect facts permit progression | Model text, Context UUID or missing receipt passes |
| Credential/trust boundary | Verify actual policy-generation ACK, synthetic non-sensitive deny probe, model-tool reachability, write-protection of Broker/module/policy config, and env key-name-only readback | Isolated runtime using the actual native immutable exact allowlist | Tool inventory, ACK/probe receipt, config write-denial evidence, redacted env readback, Svc request log | Only the closed workflow Broker is reachable and provenance is wrapper-derived | A75-style read/write tools, model-writable config, exposed env value, file/exec/HTTP/MCP escape, or Svc JWT treated as turn proof |
| UNKNOWN and failure | Fault-inject known failure, response loss, in-flight ambiguity; inspect current effect read | Isolated paired service fixture | Original receipt state and exact response/readback | UNKNOWN is readback-only; known deterministic zero-fact failure stays distinct | UNKNOWN converted to absent/zero; new key/body; local stop substitutes for Svc receipt |
| Node readiness | Missing/wrong binding at entry, wrong-slot/foreign-domain/WAITING/READY supplier before due-page limit | Isolated Svc source/dependent database fixture | Actual producer receipt, effective Context, atomic entry rejection/success, source proof, snapshot, due-page and zero-attempt trace | Missing/mismatched binding fails before visit transition; real WAITING binding may enter but remains absent from dispatch; Core uses unchanged READY-only projection | Fake UUID/proof, transition facts commit without binding, non-READY attempt, or readiness not rechecked by Svc |
| Owner replacement and bounds | Materialization/replacement both commit orders including no managed ID, A→B→A/no-op/replay plus graph cycle and actual WAE/RETURN stop tests | Isolated paired Core/Svc fixture | Owner command, original intent STOP provenance, per-Visit WAE admission, Svc RETURN Event and graph validation evidence | No handoff/reset; prebirth stop preserves absent coordinates; finite bound uses existing actual producers | Old-owner write, invented ID/claim, lost responsibility, uncounted cycle, cap reset, recursion, false HUMAN_REQUIRED |
| Review cleanup | Managed REVIEW with no wake row; resolve through its own operation then complete, lose first response and read back; contrast unrelated resolve/VOID | Isolated paired runtime | Exact reviewAdmission/detail join, Svc-verified proof, actual receipt/Event and review completion facts | Legacy delivery gate stays strict; managed review uses one guarded source effect and its own SUCCEEDED readback finishes the slot without a second projection/action | Fake delivery/proof, second resolve, own action strands review, or unrelated case change is credited |

Publication receipt/error mapping, managed read union, WAE/RETURN bounds, real STOP producers, service Principal seam, and leaf/fork termination are pinned by immutable producer-discovery addendum SHA-256 `874e36341a4ef0e390aafebae090f482a986def3faea665ca0d99cf108c55823`. Exact storage entities, receipt/Event matrix, and implementation/activation stage correction are pinned by storage/stage addendum SHA-256 `8eab0f233793e1704c3612e1659f0c69c0e4323b45b0f1d395c8f9fec8a8ab06`. The exact current addition remains proposal-only and requires independent review. No tests or runtime conformance are claimed by this proposal.

## 11. Authority and lifecycle

This Spec is paired with `SVC_WORKFLOW_OWNER_OBLIGATION_WORKFLOWS_V1`. Its whole-authority closure includes proposed successors to Core WAE V2, WEC V2, GCR V1, WPO V3, and Assignee Transition Capability V1. The latter explicitly amends CTR-010 to route managed calls through the guarded local wrapper while retaining the unified existing `workflow_execute` write entry. Every successor must preserve the complete accepted predecessor body, amendments, and rejected alternatives; no partial supersession is intended.

The exact internal wire and Svc-owned command/Event/storage details are fixed by the paired proposal, four frozen author design inputs, and the separately pinned review-gap closure proposal. Svc remains the authority for those service-owned facts; Core only transparently forwards its closed read DTOs and preserves existing write routes. The accepted trusted-native authority is pinned to the exact Core file and source hashes in the paired Investigation Record; these source pins establish the dispatch-policy mechanism only, not activation readiness. No implementation, production activation, credential provisioning, migration, or A75 replay is authorized here.

## Alternatives and disposition

- A flat obligation catalog, generic template/materializer, or `resultOf` resolver would create a second workflow language and is rejected; the selected published graph and real receipt lineage already define work.
- A second Core case/phase executor would move business authority out of Svc and is rejected; Core uses only existing WAE/WEC.
- A new model-facing effect execute tool would expose caller-controlled slot/context and duplicate the write surface; it is rejected in favor of the existing write entries plus trusted local wrapper.
- Automatic Owner handoff or a new cross-RETURN claim counter would add an unaccepted budget/identity mechanism; V1 stops on actual Owner replacement and reuses actual WAE/Svc RETURN producers.

## Migration, compatibility, and rollback

This Core contract adds no Core database table or migration. The two read operations are additive under `workflow.read`; existing write-tool IDs, argument DTOs, and `workflow.execute` scopes remain unchanged. Managed wrapper routing applies only when trusted workflow provenance and the Svc managed relation identify an opted-in managed turn; unmanaged calls retain existing behavior. No accepted Core predecessor, historical tool result, WAE ledger entry, or A75 artifact is rewritten. Any later code rollback must remove only the new managed wrapper/read capability after the paired Svc contract is disabled under its separately reviewed rollback; it cannot reset a successful/UNKNOWN Svc effect or reroute an existing obligation to naked chat.

## Open questions

No normative V1 choice remains open in this Core proposal. Runtime credential isolation and service actor correctness are fail-closed implementation activation gates, not accepted claims. The exact five Svc relation schemas and command/Event closure are specified in paired Svc Spec §§3–4, 11–12, 15 and Storage Contract V0.3; they require independent whole-pair review before acceptance.

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION = NONE
```

Design inputs:

- `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a75-owner-wake-mechanism-diagnosis-20261029/preferred-owner-obligation-workflows-v1-design.md`, SHA-256 `db3c63991d816e11e31d94d24e312a60c9204d0cec0e160cd6dbbef0db4dd717`.
- `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a75-owner-wake-mechanism-diagnosis-20261029/owner-obligation-v1-broker-mapping-addendum.md`, SHA-256 `34cf1f937d50c6f5bb45b4fba3d008e320b283507778552194617663104f955f`.
- `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a75-owner-wake-mechanism-diagnosis-20261029/owner-obligation-v1-producer-discovery-addendum.md`, SHA-256 `874e36341a4ef0e390aafebae090f482a986def3faea665ca0d99cf108c55823`.
- `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a75-owner-wake-mechanism-diagnosis-20261029/owner-obligation-v1-storage-and-stage-corrections.md`, SHA-256 `8eab0f233793e1704c3612e1659f0c69c0e4323b45b0f1d395c8f9fec8a8ab06`.

```text
IMPLEMENTATION_ALLOWED = NO
PRODUCTION_APPLY_ALLOWED = NO
A75_REPLAY_OR_MUTATION = FORBIDDEN
ACCEPTANCE = NONE (independent proposal review and Owner lifecycle action pending)
```
