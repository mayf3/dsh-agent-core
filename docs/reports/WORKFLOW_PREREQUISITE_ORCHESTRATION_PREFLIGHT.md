# Workflow prerequisite orchestration — Core preflight

```text
GOAL/TARGET = Propose a new Core Contract for Owner-selected exact published
  Definition + atomic Svc governance-child create/bind, and READY-only due admission.
CURRENT_GAP = Accepted GCR V1 permits only pre-created-child bind and excludes
  automatic selection/create-bind; accepted WEC V2 has no pre-dispatch dependency gate.
BASE = 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
AUTHORITY_ACTION = NEW
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO
SPEC_GAP_DEPENDENCY = LOAD_BEARING
EXECUTION = docs only in isolated worktree; no code, acceptance, merge, push,
  live execution, or production apply.
```

Direct authority evidence: `AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1`
§1 excludes automatic Definition selection and atomic create-bind;
`AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2` continues to own attempt planning,
retry and unknown fences after dispatch. Neither owns readiness-gated due
admission. The paired proposed Svc Contract is required. `NEW + CONTROLLED`
therefore remains docs-first; proposed `implementation_authority: contracts`
will authorize only a later bounded implementation after acceptance in base
and a separate mandate. Production authority remains none.

## Bounded outcome

Add one proposed Core Spec, one index entry, and this preflight plus a bounded
implementation plan. Touch only the existing assistance capability and due
poll consumer in a later implementation. No selector registry, new scope,
Core wait ledger, WEC mutation, raw-due fallback, or production permission.

```text
SPEC_GOVERNANCE_MODE = AUTHOR
SPEC_ID = AGENT_CORE_WORKFLOW_PREREQUISITE_ORCHESTRATION_V1
STATUS = proposed
IMPLEMENTATION_AUTHORITY = contracts
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1
EXTERNAL_AUTHORITIES = mayf3/svc-workflow SVC_WORKFLOW_PREREQUISITE_ORCHESTRATION_V1 @ c8937e567a429160779ee7db0cb7b53efbe8ed3e
DOCS_FIRST_REQUIRED = YES
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 4
CONTRACTS_WITH_ACCEPTANCE = 4
AUTHORING_READY_FOR_REVIEW = YES
NEXT_ACTION = REVIEW
```
