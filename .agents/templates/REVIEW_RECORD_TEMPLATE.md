# Review Record

Current structured decisions use route schema v2; legacy inspection is not a readiness result.

## Coordinates

```text
REPOSITORY =
REVIEW_KIND = SPEC | AFFECTED_CONTRACT | CONTROLLED_OPERATION | FINAL_HEAD
REVIEW_TARGET_HEAD =
BASE_HEAD =
CURRENT_BASE_HEAD =
REVIEWER_ID =
AUTHOR_ID =
ASSURANCE_LEVEL =
REVIEWED_AT =
```

## Result

```text
SPEC_REVIEW = ACCEPT | REVISE | NOT_APPLICABLE
AUTHOR_INDEPENDENCE = PASS | FAIL | NOT_REQUIRED
AUTHORITY_REVIEW = PASS | FAIL
PRIMITIVE_BOUNDARY_REVIEW = PASS | FAIL | NOT_APPLICABLE
CONTRACT_REVIEW = PASS | FAIL | NOT_APPLICABLE
ACCEPTANCE_COVERAGE_REVIEW = PASS | FAIL | NOT_APPLICABLE
MANDATE_SCOPE_REVIEW = PASS | FAIL | NOT_APPLICABLE
EVIDENCE_REVIEWABILITY = PASS | FAIL | NOT_APPLICABLE
BASE_IMPACT = NONE | BOUNDED | RELEVANT
REVIEW_SCOPE = NONE | DELTA | FULL
SCOPE_REASON = <when scope is DELTA or FULL>
IMPACT_EVIDENCE = <bound diff / authority / dependency check references>
FULL_REVIEW_BASIS = INITIAL_REVIEW | ACCEPTED_FULL_GATE | UNBOUNDED_IMPACT
                   # only for FULL; Head movement alone is insufficient
BLOCKERS =
SPEC_GAPS =
FOLLOW_UPS =
TOOLING_DEBT =
IMPLEMENTATION_ALLOWED = YES | NO | NOT_APPLICABLE
MERGE_READY = YES | NO | NOT_APPLICABLE
OPERATION_ALLOWED = YES | NO | NOT_APPLICABLE
NEXT_ACTION = CONTINUE | STOP | RE_PREFLIGHT | OWNER_DECISION
```

## Blocking finding

```text
BLOCKER_CLASS = CONTRACT_VIOLATION | REPOSITORY_INVARIANT_VIOLATION |
                CONCRETE_REGRESSION | SECURITY_OR_DATA_LOSS |
                FALSE_EVIDENCE | SCOPE_ESCALATION | REQUIRED_GATE_FAILURE
SOURCE_TYPE = ACCEPTED_PRODUCT_AUTHORITY | ACCEPTED_LOCAL_GOVERNANCE |
              MACHINE_GATE | EXECUTION_MANDATE
SOURCE =
COUNTEREXAMPLE =
IMPACT =
MINIMAL_CLOSURE =
AFFECTED_READINESS = <dependent implementation_allowed / merge_ready / operation_allowed>
```

Non-Blocker kinds are `SPEC_GAP`, `FOLLOW_UP`, and `TOOLING_DEBT`. A load-bearing gap sets dependent readiness to `NOT_READY` but does not let Reviewer write a Contract.

## Stopping Spec gap (only when LOAD_BEARING)

Keep this diagnosis in the same record; no separate proposal is needed merely to explain a stop. Structured keys live under `spec_gap_detail`:

```text
affected_action =
missing_decision =
authority_search = <active authorities examined and the uncovered decision>
counterexample = <reachable failure if that decision remains unresolved>
impact =
minimal_closure =
avoidance_analysis = <can scope reduction or an existing authorized path avoid the dependency?>
```

A missing decision need not cite a nonexistent Contract. An incomplete diagnosis is not execution permission; safely pause the affected work to obtain the missing fact. Existing Blocker sources, exact authorization, and required Evidence remain binding.

## Model convergence exit (conditional)

```text
MODEL_CONVERGENCE_APPLICABLE = YES | NO

# Remaining fields are required only when MODEL_CONVERGENCE_APPLICABLE = YES,
# i.e. the change claims convergence, retirement, or migration completion;
# when NO, skip them.
NEW_PATH_USABLE = PROVEN | NOT_PROVEN | NOT_APPLICABLE
OLD_EXECUTION_PATH_RETIRED = PROVEN | NOT_PROVEN | NOT_APPLICABLE
RECOVERY_DOES_NOT_REVIVE_OLD_PATH = PROVEN | NOT_PROVEN | NOT_APPLICABLE
NEW_PATH_EVIDENCE =
OLD_PATH_EXIT_EVIDENCE =
NON_REVIVAL_EVIDENCE =
```

Each proof binds scope, revision, environment, and observation time. Historical evidence, audits, receipts, and migration records remain valid retention and are not convergence debts; a stable supported public facade is not required to retire. A remaining temporary bridge needs a real consumer and an exit condition, and marks the result a bounded stage, not final convergence.

## Final accepted-Head binding

```text
REVIEWED_SPEC_COMMIT =
FINAL_ACCEPTED_HEAD =
ACCEPTANCE_ACTOR =
ACCEPTED_AT =
SEMANTIC_DELTA_AFTER_REVIEW = NONE | DETECTED
FINAL_HEAD_RECHECK = PASS | FAIL
```
