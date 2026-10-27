---
spec_id: AGENT_CORE_WORKFLOW_CURRENT_INPUT_BROKER_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
accepted_by: mayf3-delegated-codex-maintainer
accepted_at: 2026-10-27
accepted_reviewed_head: 92bf0ff2958052c39def7e9b346286de4707ae89
acceptance_record: https://github.com/mayf3/dsh-agent-core/pull/558
independent_review_result: PASS
scope:
  - read-only current Workflow task input capability
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_CURRENT_TASK_INPUT_V1
    revision: 52fcb13e63ac7c6696f2c3353ab5a09302cf2014
    relation: interoperates_with
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# Workflow current task input through the generic Broker

## 1. Goal

Make the service-selected input for one current Workflow task directly available to an Agent after long history or compaction, without requiring manual pagination or trusting a stale conversational summary.

## 2. Scope and non-goals

One read-only Broker capability and its default registration, tool guidance, transport/error conformance and isolated verification. No new workflow engine, evidence ledger, monitor, semantic acceptance oracle, privilege, history mutation, or production activation. Existing read and execute tools remain available with unchanged contracts.

## 3. Authority and dependencies

Architecture retains external Workflow ownership and the generic manifest-to-tool bridge. `AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1` describes the existing declared-error transport family; this Spec does not change its IDs or authorize a history cursor under its excluded scope.

The external service contract is `SVC_WORKFLOW_CURRENT_TASK_INPUT_V1`, owned by `mayf3/svc-workflow`. Its accepted revision is recorded in `external_authorities` following svc-workflow PR #89. Service identity, snapshot, visibility, selection, digest, completeness, stale and body-change behavior remain service-owned. This Spec only binds the consumer protocol; it cannot authorize changes in svc-workflow.

## 4. Current State

`STATE-CIB-001`: at dsh-agent-core `28eee2403e92f3104fce8e153567b395ee187280`, source inspection on 2026-10-27 shows submission history exposes only instance ID and limit; `workflow_my_tasks` provides richer current data but is a worklist, not exact-instance retrieval. Basis OBS-CIB-001 and OBS-CIB-002. Loaded production manifests are not established by this source observation.

## 5. Observations

- `OBS-CIB-001`: source `packages/broker/src/capabilities/workflow.js` at the above revision declares history query `limit` only. Method: read exact Git snapshot.
- `OBS-CIB-002`: public tester trace in `governance-testing-return-loop-observations.json`, SHA-256 `2de46e59cdee6dae95913d7831bc4a663885da710a57f681ef9f063459a8b29a`, observed 2026-10-27, records full correction returned, later compaction and oldest-six reread, followed by stale RETURN reasons.

## 6. Claims and assumptions

`CLM-CIB-001` (SUPPORTED): a limit-only history tool does not provide bounded exact current-input recovery. This does not prove all stale reasoning disappears with a new tool; actual role consumption and independent semantic evaluation remain necessary.

## 7. Evidence relations

`EVD-CIB-001`: OBS-CIB-001/002 SUPPORT CLM-CIB-001 at the pinned source and historical tester trace. Sufficient for the missing read surface, not proof of deployed remediation or future model behavior. Provenance directory: `/Users/yanfenma/workspace/artifacts/workflow-acceptance-binding-20261027/`.

## 8. Decisions

`DEC-CIB-001`: expose one ordinary manifest-backed GET capability. The service selects and authenticates current facts. Broker forwards declared fields and preserves qualified results; it neither reconstructs a snapshot by looping history nor interprets evidence truth. Decision owner: mayf3/delegated maintainer, acceptance bound in PR.

## 9. Contracts

### CTR-CIB-001 — Wire and scope

Capability ID and tool name MUST be `workflow_current_task_input`, sole operation `read`, required scope `workflow.read`. HTTP target MUST be `svc-workflow`, method GET, path `/internal/v1/workflow-instances/{workflowInstanceId}/current-task-input`. No request body, idempotency key or write operation is permitted. Caller identity MUST use the existing parent-derived Broker identity, never a model-supplied principal.

### CTR-CIB-002 — Exact arguments

`workflowInstanceId` is required. The only optional query parameters are `view`, `expectedNodeVisitId`, `expectedWorkflowStateVersion`, `expectedContextRevisionId`, `submissionIds`, `bodyKind`, `bodyId`, `offset`, `expectedBodySha256`. They MUST retain exact camelCase spelling. `view` is `input|body`; `bodyKind` is `CURRENT_DETAIL|SUBMISSION_PAYLOAD`; coordinates and body IDs are UUID strings, state version is integer >=1, offset is integer >=0. `submissionIds` is the service-defined comma-separated list of at most eight UUIDs; the service validates conditional combinations and membership. The Broker MUST reject undeclared arguments by its existing argument-validation behavior and MUST NOT invent missing coordinates or substitute another instance.

### CTR-CIB-003 — Preserve qualification and errors

Successful JSON MUST be forwarded through the existing generic transport without summarizing, truncating, promoting `INCOMPLETE` to complete, or turning absent/invisible sources into a business defect. Exact current coordinates, source IDs, digest, offsets, selection boundaries and completeness indicators MUST survive transport. Declared service errors MUST include `invalid_current_task_input` (422), `current_task_input_stale` and `current_task_body_changed` (409), `current_task_body_not_found_or_not_visible`, `workflow_instance_not_found_or_not_visible` and `principal_not_found` (404), `restricted_history_not_visible` and `principal_disabled` (403), `internal_consistency_error` (500), and `service_unavailable` (503), preserving HTTP status and sanitized request ID through the existing error envelope. Existing auth/scope errors remain unchanged. Unrecognized service errors retain existing canonical status-class fallback; they MUST NOT become success. No Broker-level automatic retries or fallback to oldest history are introduced.

### CTR-CIB-004 — Usable task guidance

Tool descriptions MUST tell the Agent to read current input for its exact assigned instance before evaluating a Workflow task; use the returned coordinates and precise body descriptors after compaction; treat fixed windows as limited selections rather than all-history completeness. `body` reads require the complete coordinate tuple and expected digest from the descriptor, and following `next_offset` retrieves original bytes. On stale coordinates, reread `input`; on changed body, discard previously assembled chunks and start with a new descriptor. Neither response authorizes workflow transition nor proves semantic evidence correctness. Existing execute/CAS and independent review remain authoritative.

### CTR-CIB-005 — Adoption and unattended claim

Default Broker inventory MUST register the capability once. The paired service must be available before declaring it usable; unavailable deployment MUST remain a capability/environment failure, not a product-verification verdict. A claimed unattended workflow validation MUST show actual governed-role consumption of this capability after a seeded stale opinion/compaction condition and zero per-node external correction. Merely registering the tool, passing mocks or sending dispatch messages is insufficient. Source delivery and production adoption MUST remain distinct.

## 10. Acceptance

- `ACC-CIB-001` maps CTR-CIB-001/002: executed manifest-to-HTTP request test binds the exact path/query/scope; unknown or spoofed identity arguments do not become trusted caller data. Required evidence: candidate SHA, command/exit, observed request. Failure: alternate endpoint, extra write, wrong parameter or caller ownership.
- `ACC-CIB-002` maps CTR-CIB-002/003: executed real generic transport tests cover input, a multi-byte bounded body chunk, stale/body-changed 409, masked 404, restricted 403 and invariant 500. Required evidence: exact payload/status/error assertions. Failure: lost coordinates/digest/qualification, mutated originals, normalized success or hidden error.
- `ACC-CIB-003` maps CTR-CIB-004/005: actual isolated role trial reads a long-history task using the returned current-input/body coordinates, encounters corrected RETURN evidence, and completes or formally escalates on the true remaining gate without per-node root advice. Required evidence: source/service/model pins, initial task, public tool calls and receipt readbacks, intervention counter, real terminal state. Failure: old-opinion resurrection without source reconciliation, absent read, scripted preselected verdict, root per-node rescue or completion inferred from activity.

## 11. Alternatives and disposition

- History cursor only: deferred. It removes a tooling omission but still requires the model to assemble a current snapshot across pages.
- Existing `workflow_my_tasks`: retained for discovery; it cannot guarantee one target survives list limits.
- Another supervisor or evidence ledger: rejected; existing service facts and governance roles already own these responsibilities.

## 12. Migration, compatibility and rollback

Additive source capability. Existing endpoints and write semantics remain unchanged. A deployment plan must pair the accepted service surface and Broker manifest; source merge grants no production activation. Rollback removes only new capability registration and retains all workflow facts and historical receipts. An unsupported server yields an explicit failure, never a silent fallback claiming equivalent evidence.

## 13. Open questions

No open owner decisions or normative placeholders remain. The service contract was accepted and merged in svc-workflow PR #89; its exact revision is pinned above. Independent review and delegated acceptance are recorded in PR #558. Implementation requires this accepted authority to be merged into main.
