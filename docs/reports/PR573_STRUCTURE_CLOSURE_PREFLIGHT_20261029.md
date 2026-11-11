# DEVELOPMENT_PREFLIGHT — PR #573 structure closure

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = 4fe3d0bb7d759fbd2ea15e46211ece4aed97f6ed
BASE_HEAD = 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
CURRENT_BASE_HEAD = 01c1cd0c4a980e1a37878ea5ad05f4d46fb3ba99
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Close two measurable structure violations in PR #573 by moving the newly added Broker projection regression out of transport.test.js and extracting the terminal attempt-cap helper from workflow-execution/src/engine.js; preserve behavior and accepted contracts.
CURRENT_GAP = Base-to-head adds 34 lines to the existing 912-line Broker transport test (head 946) and grows the existing 511-line workflow-execution engine to 525 lines (+20/-6). Both are structural violations under the active guardrail.
OBSERVATIONS = Root fresh numstat and local counts; source-only repo inspection. Broker test direct-child count is already over the V1 limit; place the new test under the existing test/gateway grouping so no new root child is added. workflow-execution/src has 16 direct children and test has 17, leaving room for one focused helper and one focused test.
WORKING_GUESS = NOT_APPLICABLE
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1@accepted-main-01c1cd0 (CTR-GCR-006, ACC-GCR-003; only projection semantics/test fixture placement affected)
RELATED_AUTHORITIES = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2@accepted-main-01c1cd0 (CTR-WEC1-004, CTR-WEC1-005, CTR-WEC1-008); CODE_STRUCTURE_GUARDRAILS_V1@accepted-main
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = NOT_APPLICABLE
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO
OPERATION_ALLOWED = NOT_APPLICABLE
EVIDENCE_NEEDED = Focused Broker transport/body-projection tests; focused workflow-execution tests covering attempt-cap escalation, unknown fence, Owner-resume; diff/line/child/depth checks; exact final commit and independent review.
DONE_WHEN = The Broker transport.test.js no longer grows from base; engine.js is at or below 500 lines; tests preserve the existing projection and WEC behavior; code and regression are committed on this branch for independent review. No push/merge.
EXPANSION_TRIGGER = Any need to change behavior, cap semantics, tool scopes, Svc authority, V1 limits/registry, or other files beyond the bounded extraction.
NEXT_REAL_ACTION = Implement only the two structural extractions and run focused suites.
NEXT_ACTION = CONTINUE
```

Governing Specs are accepted implementation authorities in base. This task changes only placement/organization: GCR typed-current-review projection remains byte-for-byte and pre-HTTP behavior unchanged; WEC terminal attempt-cap handling continues to preserve NEEDS_REVIEW at cap, escalate once, and retain strict Owner-resume evidence, while UNKNOWN and under-cap behavior remain unchanged.

The accepted CODE_STRUCTURE_GUARDRAILS_V1 freezes file max 500, directory max 20, and depth max 4. The current fixed-baseline registry issue remains separately documented and is not being edited here. This bounded work does not change the guardrail, registry, PR metadata, or runtime state. Root authorized source edits and commit only; no push, merge, live run, service, database, home, or production action.
