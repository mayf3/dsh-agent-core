# DEVELOPMENT_PREFLIGHT — current governance-review reference

```text
SPEC_GOVERNANCE_MODE = AUTHOR
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = origin/main f63eaf6e000d2bbf4343c727d38474147db7f6cb
BASE_HEAD = f63eaf6e000d2bbf4343c727d38474147db7f6cb
CURRENT_BASE_HEAD = f63eaf6e000d2bbf4343c727d38474147db7f6cb
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
GOAL_OR_TARGET = Add a trusted, explicit route to construct the exact linked governance review reference from the current Svc detail response before Owner resolve.
CURRENT_GAP = CTR-GCR-005 accepts only model-supplied typed values; the accepted static body projection reads only current invocation arguments and has no trusted read-result binding.
AUTHORITY_ACTION = AMEND
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1
RELATED_AUTHORITIES = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2; SVC_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1; accepted Core main f63eaf6e000d2bbf4343c727d38474147db7f6cb
IMPLEMENTATION_AUTHORITY = contracts (only after this amendment is accepted)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = CONTROLLED
EXECUTION_MANDATE = VALID (root delegated docs-only amendment authoring and acceptance preparation; no source/runtime authority in this task)
MUTATION_AUTHORIZATION = VALID (one additive Spec candidate and this preflight record)
ISOLATED_WRITE_SURFACE = YES (dedicated worktree codex/gcr-current-reference-spec from accepted main)
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = LOAD_BEARING
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO (bounded approach selected by root)
EMERGENCY_STATE = NONE
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = Immutable A68 error excerpt; accepted Core CTR-GCR-005 authority; separate read-only observation of unmerged be067 body-projection source; accepted Core WEC/GCR and Svc GCR references; independent review of the proposed amendment.
DONE_WHEN = A docs-only additive amendment defines an explicit same-caller current-detail read/projection operation, preserves direct typed and opaque paths, retains original version CAS and Svc strict validation, and is ready for independent semantic review.
EXPANSION_TRIGGER = No persistent result vault, automatic correction, new permission/scope, Svc relaxation, automatic resolve, runtime mutation, or production authority.
NEXT_ACTION = REVIEW
```

## Bounded evidence

- A68 immutable excerpt: `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/ART/a68-typed-reference-diagnosis-20261029/a68-typed-resolve-excerpt.json`, SHA-256 `ba18c78480b38f229d6c063735a4bf075fdea34779c52318ec9737237aeaeeef`. It records the correct service digest and a one-character-different explicit typed digest, followed by HTTP 409.
- Accepted Core base `f63eaf6e000d2bbf4343c727d38474147db7f6cb`: CTR-GCR-005 defines caller-supplied typed projection authority; it does not contain `packages/broker/src/transport/body-projection.js`. Separate unmerged candidate `be067723947786b392dfe1ac178a98fb5386bad2` contains that source mechanism, which accepts current operation args only and has no read-result association. This source observation is not accepted-main behavior.
- Accepted Svc companion `SVC_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1` §4 exposes immutable binding and terminal-proof references in the existing Owner-visible detail projection. Its closed five-field resolve validation and service-side transaction remain unchanged.

The proposed `resolve_current_governance_review` is a new explicit Broker operation mapped to the existing resolve route. It performs the existing detail read through normal same-caller `workflow.read` authorization, projects the returned service-owned fields, and sends the caller's original expected version through existing `workflow.execute` authorization and Svc CAS. An absent, denied, stale, or inconsistent read results in no resolve POST. The existing `resolve` operation remains unchanged for both direct typed references and historical opaque payloads. This task writes no implementation and touches no run, service, database, or production state.
