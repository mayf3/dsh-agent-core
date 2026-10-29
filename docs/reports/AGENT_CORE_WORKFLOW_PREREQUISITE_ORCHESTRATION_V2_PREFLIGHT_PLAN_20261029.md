# DEVELOPMENT_PREFLIGHT — Core prerequisite companion reference successor

DEVELOPMENT_PREFLIGHT

GOAL/TARGET = Keep Core prerequisite orchestration paired to the Svc authority that can satisfy its already accepted atomic create-bind and typed readiness Contracts.
CURRENT_GAP = Core WPO V1 pins Svc WPO V1, whose accepted create-bind Contract cannot satisfy PostgreSQL's global one-Event index and whose UNKNOWN DTO cannot report unrecoverable coordinates without lying or erroring.
AUTHORITY_ACTION = SUPERSEDE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
ROUTE_STAGE = AUTHORITY_AUTHORING
AUTHORITY_ACCEPTED_IN_BASE = NO (Core WPO V2 is proposed)
BASE = b8e58012de75f98825f2d1fd734e9eb0dfe8cdfa
ACCEPTED_CORE_AUTHORITY = AGENT_CORE_WORKFLOW_PREREQUISITE_ORCHESTRATION_V1
PROPOSED_CORE_SUCCESSOR = AGENT_CORE_WORKFLOW_PREREQUISITE_ORCHESTRATION_V2
PAIRED_SVC_CANDIDATE = SVC_WORKFLOW_PREREQUISITE_ORCHESTRATION_V2 (paired with Product V10, Architecture V0_4_5 and Storage Contract V0.2)
FEASIBILITY_REPORT_SHA256 = 8a9ad9365ec8186cd0c1e1b4e4f9797d60dcff203220db6b85c856ffbcf99e7f
ATOMIC_FEASIBILITY_BLOCKER_SHA256 = acf9064f83cd642a0111147d47fa880d942892454ce80d9d25e3376ee7bbb641
DOCS_FIRST_REQUIRED = YES
IMPLEMENTATION_ALLOWED = NO
CODE_OR_TEST_CHANGE_ALLOWED = NO
DATABASE_OR_SERVICE_OPERATION_ALLOWED = NO
PRODUCTION_APPLY = NONE
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
PARTIAL_SUPERSESSION = NONE

## Scope and plan

The exact Core code behavior remains unchanged: one Owner operation still
selects a compatible published Definition and invokes the atomic Svc route;
the due consumer still accepts only rows with literal readinessStatus: READY;
the request/response and all WEC/WAE attempt, retry, unknown-outcome and
same-visit semantics stay as in V1. Core does not consume the new Svc unknown
variant as a scheduler row.

This docs-only successor changes the active companion authority pointer and
acceptance-evidence map to Svc WPO V2. Its paired acceptance must also cite
Svc CTR-SWPO-007/008, exact source/Event lineage evidence, successful-2xx and
deterministic-non-2xx receipt outcomes, command-row serialization/concurrent
ordinary-command cardinality evidence, and the all-or-none UNKNOWN read-model
tests. It does not expand Core wire, grant, wait state or implementation
scope.

1. Preserve the complete Core WPO V1 body and add the V2 pair mapping above.
2. Update only the Core Specs index so V1 remains current and proposed V2 is
   visible as its whole successor.
3. Stop for paired independent review and later Owner acceptance. No Core
   implementation, source test, migration, or runtime run occurs in this task.

Implementation remains forbidden until the accepted Core and Svc successors
and all Svc Product/Architecture/Storage parents are present in implementation
bases and a separate exact-scope mandate is issued.

SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORING_READY_FOR_REVIEW = YES after artifact/scope/index checks
NEXT_ACTION = REVIEW
