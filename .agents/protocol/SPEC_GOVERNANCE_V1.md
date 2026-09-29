# Spec Governance Protocol V1

```text
PROTOCOL_VERSION = 1.0.0
GOVERNING_AUTHORITY = AGENT_DEVELOPMENT_GOVERNANCE_V1
STATUS = accepted
ENFORCEMENT_LEVEL = manual_semantic_policy_plus_deterministic_integrity
```

This protocol turns Development Grammar V1 into a repository workflow. The executable router is `.agents/skills/spec-governance/SKILL.md`; formal governing-Spec syntax remains `.agents/protocol/SPEC_FORMAT_V0.md`.

## Scope

This protocol governs authority discovery/mutation, one-operation mandates, three-axis routing, compact execution artifacts, governing-Spec lifecycle, load-bearing gaps, Evidence reviewability, live-authority gaps, emergency containment, exact-Head review, proportional conformance, and exact-revision consumer adoption.

It does not prescribe a central registry, project manager, GitHub App, merge broker, WORM store, fixed Agent count, or semantic CI oracle.

## Required consumer surfaces

```text
AGENTS.md
.agents/README.md
.agents/local/README.md
.agents/governance.lock.json
.agents/protocol/SPEC_GOVERNANCE_V1.md
.agents/protocol/SPEC_FORMAT_V0.md
.agents/skills/spec-governance/SKILL.md
.agents/skills/spec-governance/modes/<MODE>.md
.agents/tools/verify_governance.py
.agents/tools/validate_governance_route.py
docs/specs/README.md
```

## PREFLIGHT

Before non-trivial implementation, configuration, schema, behavior-defining tests, or operation:

1. bind target repository, candidate Head, Base snapshot, and current Base tip;
2. state Goal/target and Current Gap;
3. read local precedence and exact relevant authorities;
4. separate Observations from Working Guesses when interpretation changes routing;
5. classify exactly one Authority action;
6. classify Plan from execution complexity;
7. classify Assurance from failure consequence;
8. check route stage, authority acceptance in base, implementation authority, mutation authorization, isolated write surface, Controlled Runbook, load-bearing gap, Evidence reviewability, live authority gap, emergency containment, and stop controls;
9. select the shortest authorized route.

### Authority action

```text
REUSE | AMEND | SUPERSEDE | NEW
```

Named proposed target:

```text
same scope + same ownership + same bounded Decision identity -> AMEND
changed scope or ownership or bounded Decision identity      -> NEW
```

Accepted authority:

```text
same decided behavior, no meaning change -> REUSE
strictly additive new IDs under unchanged accepted Decisions -> AMEND
changed accepted meaning -> SUPERSEDE
no accepted owner for independent decision -> NEW
```

`AMEND_OR_NEW_PENDING_OWNERSHIP` is investigation-only and cannot cross a readiness boundary.

### Plan and Assurance

```text
PLAN_LEVEL = NONE | BRIEF | EXEC_PLAN
ASSURANCE_LEVEL = ROUTINE | DURABLE | CONTROLLED
```

A Controlled Runbook is required for a controlled operation but does not force `EXEC_PLAN`.

### Required PREFLIGHT output

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = <owner/repository>
REVIEW_TARGET_HEAD = <sha | NOT_APPLICABLE>
BASE_HEAD = <sha | NOT_APPLICABLE>
CURRENT_BASE_HEAD = <sha | NOT_APPLICABLE>
ROUTE_STAGE = AUTHORITY_AUTHORING | IMPLEMENTATION | OPERATION
AUTHORITY_ACCEPTED_IN_BASE = YES | NO | NOT_APPLICABLE
GOAL_OR_TARGET = <outcome>
CURRENT_GAP = <gap>
AUTHORITY_ACTION = REUSE | AMEND | SUPERSEDE | NEW |
                   AMEND_OR_NEW_PENDING_OWNERSHIP
PRIMARY_AUTHORITY = <ID@revision | NONE>
RELATED_AUTHORITIES = <IDs@revisions | NONE>
IMPLEMENTATION_AUTHORITY = contracts | none | unknown | not_applicable
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = YES | NO
PLAN_LEVEL = NONE | BRIEF | EXEC_PLAN
ASSURANCE_LEVEL = ROUTINE | DURABLE | CONTROLLED
EXECUTION_MANDATE = VALID | INVALID | NOT_APPLICABLE
MUTATION_AUTHORIZATION = VALID | INVALID | NOT_APPLICABLE
ISOLATED_WRITE_SURFACE = YES | NO | NOT_APPLICABLE
CONTROLLED_RUNBOOK_REQUIRED = YES | NO
SPEC_GAP_DEPENDENCY = NONE | NON_LOAD_BEARING | LOAD_BEARING
EVIDENCE_REVIEWABILITY = PASS | FAIL | NOT_APPLICABLE
LIVE_AUTHORITY_GAP = NONE | DETECTED
OWNER_DECISION_REQUIRED = YES | NO
EMERGENCY_STATE = NONE | ACTIVE
EMERGENCY_ACTION = NONE | ROLLBACK | DISABLEMENT | SHUTDOWN |
                   REVOCATION | ISOLATION | CONTAINMENT
INCIDENT_REFERENCE = <reference | NOT_APPLICABLE>
IMPLEMENTATION_ALLOWED = YES | NO | NOT_APPLICABLE
MERGE_READY = YES | NO | NOT_APPLICABLE
OPERATION_ALLOWED = YES | NO | NOT_APPLICABLE
EVIDENCE_NEEDED = <items>
DONE_WHEN = <condition>
EXPANSION_TRIGGER = <condition | NOT_APPLICABLE>
NEXT_ACTION = CONTINUE | STOP | RE_PREFLIGHT | OWNER_DECISION
```

## Artifact selection

- **Change Brief** — bounded reason, route, scope, Evidence, and stop boundary.
- **ExecPlan** — phases, dependencies, checkpoints, migration/rollback, re-PREFLIGHT triggers.
- **Execution Mandate** — attributable authorization and limits for one mutation.
- **Controlled Runbook** — exact dangerous-operation steps, aborts, receipts, and post-state verification.
- **Standing Spec / Spec delta** — only for new or changed long-lived obligations.
- **Receipt / Conformance Record** — what occurred and what it verifies.
- **Investigation** — non-authoritative durable findings.

Default authoring route:

```text
REUSE -> no new Spec
AMEND/NEW + ROUTINE/DURABLE -> Spec delta and code may share one atomic PR if local authority permits
AMEND/NEW + CONTROLLED -> docs-first
SUPERSEDE -> docs-first whole-authority successor
```

Stage rules:

```text
AMEND/NEW + CONTROLLED
+ AUTHORITY_ACCEPTED_IN_BASE = NO
-> ROUTE_STAGE = AUTHORITY_AUTHORING
-> IMPLEMENTATION_ALLOWED = NO
-> OPERATION_ALLOWED = NO

SUPERSEDE
-> ROUTE_STAGE = AUTHORITY_AUTHORING
-> same-stage implementation and operation forbidden

authority accepted, later implementation/operation begins
-> new task
-> AUTHORITY_ACTION = REUSE
-> AUTHORITY_ACCEPTED_IN_BASE = YES
```

For `AMEND/NEW + ROUTINE/DURABLE`, an atomic Spec-delta-and-code PR is valid only when local authority explicitly permits it. It MUST NOT be inferred merely from low risk.

## Governing-Spec authoring

The Author resolves ownership and load-bearing normative decisions before implementation depends on them. Formal Specs follow `SPEC_FORMAT_V0.md` and preserve Goal, scope/non-goals, authority, qualified knowledge where load-bearing, Decisions, Contracts, Acceptance with Required Evidence and negative controls, alternatives, migration/compatibility/rollback, and open owner decisions.

A named proposal can be `AMEND` only inside its declared scope, ownership, and bounded Decision identity. Accepted meaning is immutable under the same stable IDs.

## Load-bearing gaps

Reviewer may identify a missing long-lived decision but cannot author it in Review. If implementation, merge, or operation depends on it:

```text
SPEC_GAP_DEPENDENCY = LOAD_BEARING
AUTHORITY_ACTION = AMEND | SUPERSEDE | NEW
at least one applicable readiness flag = NO
all readiness flags = NOT_APPLICABLE  # forbidden
NEXT_ACTION = RE_PREFLIGHT
```

`REUSE` and unresolved `AMEND_OR_NEW_PENDING_OWNERSHIP` are invalid at the readiness boundary. `OWNER_DECISION_REQUIRED = YES` may coexist when ownership or containment requires Owner input, but it does not replace `NEXT_ACTION = RE_PREFLIGHT`. The owning Author/Owner resolves the action or removes the dependency.

A structured stopping gap also records `spec_gap_detail`: `affected_action`, `missing_decision`, `authority_search`, `counterexample`, `impact`, `minimal_closure`, and `avoidance_analysis`. These are a compact dependency diagnosis in the same record, not a new Spec or approval. Explain why the current action needs the missing decision and why scope reduction or an existing authorized path does or does not avoid it. No nonexistent Contract ID is required. Missing diagnosis fails record validation but never makes uncertain work safe or authorizes proceeding. Supply the missing fact without expanding into hypothetical platform design.

## Evidence reviewability

Evidence for acceptance/conformance is accessible to the independent Reviewer, reproducible in an authorized environment, or represented by a sanitized coordinate-bound receipt from a legally independent actor.

- inaccessible/unverifiable/unknown provenance required material -> `REQUIRED_GATE_FAILURE`;
- fabrication/material distortion/false execution claim -> `FALSE_EVIDENCE`.

Do not expose Secrets.

## Live authority gap

When live state exists without accepted Product Authority:

1. record exact Observation;
2. freeze expansion;
3. neither auto-delete nor permanently grandfather;
4. obtain attributable scope-bound Owner containment with expiry/closure condition;
5. close long-lived meaning docs-first;
6. perform minimum reconcile after acceptance;
7. independently verify conformance;
8. end containment and stop.

## Emergency containment

Before normal Product Authority is available, emergency action is limited to rollback, disablement or shutdown, revocation, isolation, or equivalent containment. It requires attributable Owner authorization and an incident reference, introduces no durable new behavior, and records that permanent repair must return through normal PREFLIGHT and Product Authority. It cannot authorize feature implementation or merge.

Positive route:

```text
incident + Owner authorization + containment-only action
+ durable new behavior = NO
+ normal authority reconciliation required
-> emergency operation may proceed under a valid controlled mandate/runbook
```

Missing incident reference, missing Owner authorization, or durable new behavior MUST fail.

## Implementation

Implementation records primary/related authorities, Base, implementation commit, Authority action, Plan, Assurance, route stage, authority acceptance in base, and mutation authorization. Before any mutation, attributable authorization MUST bind target, scope, allowed/forbidden effects, and Done When. Every write MUST use an isolated worktree or equivalent isolated write surface. Controlled mutation additionally requires actor/role, environment, exact operation or operation class, abort conditions, Secret handling, receipt requirements, validity/attempt bounds, and an exact Controlled Runbook.

A Task, Issue, PR, or Change Brief MAY carry the general authorization; a separate large mandate document is not mandatory. `NOT_APPLICABLE` cannot be used while implementation or operation is allowed.

If a load-bearing gap appears, stop only dependent semantic work and re-PREFLIGHT. Do not rewrite accepted authority to excuse code or expand into optional infrastructure without an observed Expansion Trigger.

## Review

Review binds exact candidate/Base coordinates and is independent where Durable/Controlled assurance, authority acceptance, or local policy requires it.

A Blocker uses one closed class:

```text
CONTRACT_VIOLATION
REPOSITORY_INVARIANT_VIOLATION
CONCRETE_REGRESSION
SECURITY_OR_DATA_LOSS
FALSE_EVIDENCE
SCOPE_ESCALATION
REQUIRED_GATE_FAILURE
```

Every Blocker records `SOURCE`, `COUNTEREXAMPLE`, `IMPACT`, and `MINIMAL_CLOSURE`. Legal sources are accepted Product Authority, accepted local governance/invariant authority, a pre-existing active machine gate, or a valid Execution Mandate. Investigation preference, proposed tests, task product prose, Reviewer preference, and Review comments are not Product-Contract sources.

`SPEC_GAP`, `FOLLOW_UP`, and `TOOLING_DEBT` are non-Blocker finding kinds, though a load-bearing gap still makes readiness false and needs the dependency diagnosis above. A `SPEC_GAP` finding marked `load_bearing: true` must agree with the top-level dependency classification.

Current and resumed decisions use route schema v2. Every open Blocker must name dependent boundaries in `affected_readiness`: none may be `YES` and at least one must be `NO`; absent, empty, malformed, or N/A-only scope is invalid. The default validator and current JSON Schema require v2. Historical v1 records are inspected only through `validate_route(record, legacy_inspection=True)` or CLI `--legacy-inspection`, with output explicitly not valid for current readiness. This invocation option is not a record-supplied provenance flag. It neither rewrites history nor grants permission; a resumed decision creates a current v2 record with real scope and authorization.

## Candidate, Base, and acceptance

```text
REVIEW_TARGET_HEAD = exact candidate under review
BASE_HEAD = integration snapshot
CURRENT_BASE_HEAD = current branch tip at impact recheck
```

Unrelated Base movement gets a bounded conflict/authority/behavior/Evidence check, not automatic full review. Candidate semantic change, relevant authority change, affected behavior/Evidence change, or real conflict invalidates affected review.

For structured movement/review records, declare:

```text
review.scope = NONE | DELTA | FULL
review.scope_reason = bounded scope and why it is sufficient
review.impact_evidence = exact diff / authority / dependency / evidence check references
review.full_review_basis = INITIAL_REVIEW | ACCEPTED_FULL_GATE | UNBOUNDED_IMPACT
                          # required only for FULL
```

`full_rereview_required` remains a compatibility field, derived from `scope == FULL`, not from Head movement. A changed candidate or relevant Base impact requires at least `DELTA`; receipt/lifecycle-only changes still require final-Head recheck. Semantic repairs invalidate affected review and require independent delta review, not reuse of an old recommendation. `FULL` requires the identified basis and bounded applicable matrix; a mere new SHA is not a basis. Unchanged legacy records without a new scope remain valid. Old movement records and stopping gaps must supply these details when resumed under this distribution; historical records are not rewritten.

Acceptance additionally binds:

```text
FINAL_ACCEPTED_HEAD
ACCEPTANCE_ACTOR
ACCEPTED_AT
SEMANTIC_DELTA_AFTER_REVIEW
```

Any semantic delta invalidates the recommendation. Lifecycle-only acceptance still receives independent final-Head recheck.

## Conformance

Standard review covers affected Contracts and directly dependent invariants. Use a full matrix for controlled operations, releases, explicit full audits, or unbounded surfaces. Identify that complete applicable matrix against the current operation/release scope before execution; it is not automatically the entire system. Reuse unaffected evidence with an explicit coordinate/impact check. Re-run only invalidated checks and time-sensitive pre-state/authority/runtime checks required by that matrix.

A Conformance Record binds exact authority revision, implementation revision, environment, evaluated time, implementation state, verification state, `conformance_result`, executed Observations, and Evidence.

```text
conformance_result = UNKNOWN | VERIFIED | DRIFTED
```

Changed coordinates do not inherit old `VERIFIED`.

## Stop and adoption

```text
DONE_WHEN met + EXPANSION_TRIGGER not fired = STOP
```

Optional platform work, extra fault research, Agent availability, sunk cost, and unrequested cleanup are not progress.

Resume from one current delivery record as described in the grammar's Bounded delivery loop. Freeze its accepted scope and applicable gates; new real risks still stop dependent work, while reviewer preferences do not add gates. Keep all valid blockers visible even when prioritizing one. Count unsuccessful repair/review rounds against the original delivery goal across candidate renames; at three rounds make a scope/split/authority/abandon decision, not another unbounded expansion. Continue the next authorized gated action; do not substitute another unchanged report for execution. Recovery using existing accepted mechanisms and valid controlled authorization need not wait for optional redesign.

These cross-turn controls are Agent policy, not an implemented scheduler or persistent delivery ledger. The route validator checks the supplied record; it does not prove history, authorization, or that a real operation occurred.

A consumer adopts exact bytes and source commit through its own local acceptance. Preparing vendored files is not acceptance. No bulk historical rewrite is required.

## Deterministic versus semantic enforcement

Tools may check file integrity, pins, enums, structured contradictions, lifecycle closure, required coordinates, blocker shape, and declared readiness consistency. They cannot decide true authority ownership, Claim justification, Contract completeness, or real Evidence sufficiency.
