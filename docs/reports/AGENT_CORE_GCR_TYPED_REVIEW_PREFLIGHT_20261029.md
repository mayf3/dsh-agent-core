# DEVELOPMENT_PREFLIGHT — GCR typed review input amendment

SPEC_GOVERNANCE_MODE = PREFLIGHT + AUTHOR
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = d6333b267cd0f2294c0d3cf5e791945d9ec2a1aa (candidate base)
BASE_HEAD = d6333b267cd0f2294c0d3cf5e791945d9ec2a1aa
CURRENT_BASE_HEAD = d6333b267cd0f2294c0d3cf5e791945d9ec2a1aa
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = YES (base GCR contract)
GOAL_OR_TARGET = Add a closed, opt-in typed input for Owner-supplied governance-child review evidence to the existing resolve action.
CURRENT_GAP = The accepted Core contract forwards an opaque nested payload unchanged; the accepted Svc contract accepts only the five-field closed reference. A65's resolve was rejected before case mutation because the model supplied six additional fields.
OBSERVATIONS = A65 trace `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/e2e-runs/trial-20261027-a65/control/broker-public.jsonl`, SHA-256 `a2e108f3a7f32affb1655477c6f863a2a25d0811382a497354c9265077f4625d`: call `16edc2b6-9555-4d08-8dbc-cca79b0f7f77` at `2026-10-28T15:40:47.727Z` supplied all five Svc reference fields plus six extras; response at `.739Z` was HTTP 400 `governanceChildReview must be a closed unique reference`, request `5cf1eba6-5aad-49bf-889c-56d4a8b8bb3a`. Accepted Svc `SVC_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1` §7 defines the closed five-field object; accepted Core `AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1` §4 / `CTR-GCR-003` defines unchanged opaque nested forwarding.
WORKING_GUESS = NONE
AUTHORITY_ACTION = AMEND
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1@r1
RELATED_AUTHORITIES = SVC_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1@1f191156a03d9397b2fb2fdb6c28d6a9621ace95; AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2; AGENT_CORE_WORKFLOW_CURRENT_INPUT_BROKER_V1
IMPLEMENTATION_AUTHORITY = contracts (base only; proposed delta is not yet accepted)
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (docs-only amendment authoring in the isolated Core worktree)
MUTATION_AUTHORIZATION = VALID (candidate documentation only)
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = LOAD_BEARING for changed projection behavior; NONE for docs-only authoring
EVIDENCE_REVIEWABILITY = PASS (A65 trace and both accepted Specs are retrievable)
LIVE_AUTHORITY_GAP = DETECTED (new typed behavior requires amendment acceptance)
OWNER_DECISION_REQUIRED = YES (independent review and explicit owner acceptance)
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = A65 frozen trace; no recovery or replay requested
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = NO
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = Independent semantic review of the exact proposed delta; owner acceptance bound to exact reviewed head; implementation authorization separately recorded.
DONE_WHEN = Proposed `CTR-GCR-005` and `ACC-GCR-002` are reviewable on the isolated branch with the accepted contract text and IDs preserved.
EXPANSION_TRIGGER = A reviewer finds the proposed behavior conflicts with a higher accepted authority or requires changing Svc contract semantics.
NEXT_REAL_ACTION = Independent semantic review of the exact candidate.
NEXT_ACTION = REVIEW

## Short Change Brief

**Decision and scope.** Propose a docs-only additive amendment to the accepted Core GCR Spec. The optional top-level typed object is projected into the existing nested service field only when explicitly supplied. Omission preserves the legacy opaque argument unchanged. Conflicts and malformed projection containers fail locally before HTTP. Svc continues to own linked-case detection and exact reference validation.

**A65 evidence.** The frozen Owner resolve request included all five Svc fields and six extra members (`childWorkflowInstanceId`, `definitionVersionId`, `nodeVisitId`, `terminalNodeVisitId`, `transitionId`, `verdict`). Svc returned HTTP 400 for the closed unique reference shape. The request did not resolve the case. This amendment changes the Core caller contract so an Owner can submit the service-owned reference without loosening Svc validation.

**Compatibility and non-goals.** Existing accepted `CTR-GCR-001`–`004`, `ACC-GCR-001`, and `DEC-GCR-001` remain textually unchanged. No new route, scope, grant, auto-resolve, service API, generic identifier-format subsystem, or production authority is proposed. No runtime or A65 operation is part of this work.

**Review gates.** The exact candidate requires independent semantic review and explicit owner acceptance. No implementation may start under this proposal before that acceptance and a separate implementation authorization.
