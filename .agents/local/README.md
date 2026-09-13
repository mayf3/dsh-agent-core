# Repository-local governance — dsh-agent-core

This file is owned by `mayf3/dsh-agent-core`. It is not part of the vendored distribution and is not overwritten by governance updates.

## Repository identity

```text
REPOSITORY = mayf3/dsh-agent-core
AUTHORITY_BRANCH = main
GOVERNANCE_LOCK = .agents/governance.lock.json
ADOPTION_ACTIVATION = accepted lock + accepted adoption Spec merged into main
```

A proposed lock on a feature branch is only an adoption candidate. It is not active repository authority.

## Authority precedence

```text
explicit Product Direction authority, when one is accepted
> accepted Product Architecture and standalone long-lived Current Decisions
> accepted implementation-authorizing Specs
> code, tests, runtime state, migration records, and operational evidence
```

Current repository authority locations:

```text
PRODUCT_DIRECTION = NONE_STANDALONE
PRODUCT_ARCHITECTURE = docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md
ROADMAP / STRATEGIC_CONTEXT = docs/AGENT_CORE_ROADMAP_V1.md
CURRENT_DECISION_INDEX = docs/decisions/README.md
DECISIONS = docs/decisions/
SPECS = docs/specs/
```

Local rules:

- an implementation Spec may refine Architecture or a Current Decision, but may not silently contradict it;
- changing accepted long-lived meaning requires a new whole-authority supersession transaction;
- a Program Spec with `implementation_authority: none` coordinates work but does not authorize product implementation;
- an accepted-looking document on an unmerged branch is not active authority;
- code, tests, reports, and runtime evidence may prove conformance or drift but do not rewrite normative authority.

## Acceptance and review actors

```text
SPEC_ACCEPTANCE_ACTORS = repository owner mayf3, or an explicitly authorized maintainer recorded in the PR
INDEPENDENT_SEMANTIC_REVIEWER = a reviewer who did not author the reviewed semantic delta
MECHANICAL_EXEMPTION_REVIEWERS = independent reviewer; final disposition by mayf3 or an authorized maintainer
EMERGENCY_AUTHORIZATION_ACTORS = mayf3 or an explicitly authorized maintainer
```

A review recommendation does not itself perform acceptance. Acceptance must bind the reviewed commit and the final accepted head.

## Governing and persistence locations

```text
SPECS = docs/specs/
INVESTIGATIONS = docs/investigations/
LONG_LIVED_DECISIONS = docs/decisions/
IMPLEMENTATION_CONFORMANCE = implementation PR record
CROSS_ENVIRONMENT_OR_PRODUCTION_CONFORMANCE = docs/reports/ plus pinned runtime provenance
SEMANTIC_REVIEW_RECORD = persistent PR conversation or docs/reports/
EMERGENCY / INCIDENT_REFERENCE = persistent issue, PR, or report
```

## Code structure rules

Binding repository-local rule: [`.agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md`](CODE_STRUCTURE_GUARDRAILS_V1.md)
(frozen file/directory/depth limits, legacy policy, exception registry, anti-evasion
rules). Entry point for the rule:

```text
RULE = .agents/local/CODE_STRUCTURE_GUARDRAILS_V1.md
EXCEPTION_REGISTRY = .agents/structure-registry.json
VERIFIER = node scripts/verify-code-structure.mjs --base <ref> --head <ref> [--json]
NPM = npm run verify:structure
```

Raw logs may remain outside Git, but every load-bearing Observation or Evidence relation must retain enough provenance to retrieve and interpret the source.

## Legacy transition

Before this adoption candidate, the repository had a local bootstrap in `AGENTS.md`, `.agents/README.md`, and two helper templates, governed by `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`.

This adoption is forward-only:

```text
NO_BULK_HISTORY_REWRITE = YES
EXISTING_ACCEPTED_ARTIFACTS_REMAIN_HISTORICAL_AUTHORITIES_UNTIL_EXPLICITLY_TOUCHED = YES
NEW_PARTIAL_SUPERSESSION = FORBIDDEN
```

Existing prose that describes partial supersession is legacy state. It is not a template for new work. When such an authority must change, create a complete standalone replacement and perform an atomic whole-authority supersession.

The pre-adoption local helpers:

```text
.agents/templates/development-preflight.md
.agents/templates/spec-compliance.md
```

remain compatibility aids only. They are not authority. New work uses the vendored Skill modes and templates.

At local adoption acceptance, `AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V0` supersedes `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1` as the repository's development-governance authority. The old Spec remains historical rationale.

## Enforcement maturity

Actual enforcement is:

```text
ENFORCEMENT_LEVEL = MANUAL_POLICY
DISTRIBUTION_INTEGRITY_CHECK = AVAILABLE
SPEC_FRONTMATTER_SCHEMA = AVAILABLE_REFERENCE
SEMANTIC_SPEC_VERIFIER = NOT_IMPLEMENTED
BASE_BRANCH_GATE = NOT_IMPLEMENTED
REQUIRED_BRANCH_PROTECTION = NOT_ENABLED
AUTOMATIC_SPEC_ACCEPTANCE = NO
CODE_STRUCTURE_VERIFIER = AVAILABLE (scripts/verify-code-structure.mjs; run via npm run verify:structure)
```

Run the vendored integrity verifier:

```bash
python3 .agents/tools/verify_governance.py --target .
```

After adoption is active on `main`, use `--require-accepted` when verifying the authority branch.

## Delivery convergence and proportional rollout

These repository-local rules refine review and rollout behavior without weakening the vendored blocker classes, Product Authority precedence, or Controlled-operation gates. They never authorize merge, deployment, or mutation while a known binding Blocker remains open.

### Recovery first when accepted mechanisms already exist

For an active availability incident, if an existing accepted operator/admin mechanism can safely restore service without changing long-lived Product Contracts, restore the service first and keep the permanent redesign in a separate lane.

```text
SAFE_EXISTING_RECOVERY_PATH = prefer now
LONG_TERM_REDESIGN = separate lane
INCIDENT_RECOVERY_MUST_NOT_WAIT_FOR_OPTIONAL_GOVERNANCE_WORK = YES
```

This does not permit blind retry, destructive repair, privilege bypass, or reinterpretation of an unknown external side effect.

### Release governance is not Product Authority

A rollout, canary, dogfood, or one-operation safety concern remains a Controlled-operation concern unless it creates a genuinely load-bearing long-lived Product Contract.

Do not invent persistent product state, a new durable protocol, or a new Product Spec solely to make a bounded release procedure easier to prove when an exact Execution Mandate / Controlled Runbook can contain the risk.

If review proves that a long-lived Product Contract is genuinely missing, stop and re-PREFLIGHT through `AMEND`, `SUPERSEDE`, or `NEW`; do not smuggle that contract into a release document.

```text
RELEASE_GOVERNANCE_IS_NOT_PRODUCT_AUTHORITY = YES
ONE_OPERATION_RISK_DEFAULT_HOME = mandate/runbook/receipt
PERSISTENT_PRODUCT_PROTOCOL_FOR_RELEASE_ONLY = FORBIDDEN
```

### Freeze the review blocker union

The first independent review of a candidate records the complete known ship-blocker set as `FROZEN_BLOCKER_UNION`.

The normal repair cycle is:

```text
initial independent review
-> freeze blocker union
-> one blocker-union repair pass
-> one exact-head re-audit
```

A re-audit may add a new ship blocker only when it is a valid blocker under the vendored grammar and has a concrete, reachable counterexample against the current affected surface. Reviewer preference, speculative hardening, hypothetical races without a reachable current counterexample, and optional robustness improvements are `FOLLOW_UP`, not reasons to restart the candidate indefinitely.

A newly discovered concrete `SECURITY_OR_DATA_LOSS`, `FALSE_EVIDENCE`, `REQUIRED_GATE_FAILURE`, `CONTRACT_VIOLATION`, `REPOSITORY_INVARIANT_VIOLATION`, `CONCRETE_REGRESSION`, or `SCOPE_ESCALATION` remains blocking; this section never suppresses a real blocker.

### Convergence guard

A review/fix round is counted when a review produces a blocker that causes candidate semantics or rollout protocol to change and the candidate is then re-reviewed.

After three such rounds without reaching the intended readiness boundary:

```text
GOAL_STATUS = PAUSED_CONVERGENCE_GUARD
FOURTH_SEMANTIC_EXPANSION_IN_SAME_CANDIDATE = FORBIDDEN
```

The next action MUST be one of:

1. shrink to a smaller independently useful live slice;
2. split an optional/high-risk capability into a later Goal;
3. re-PREFLIGHT a genuinely independent missing Product Contract;
4. abandon the candidate.

`PAUSED_CONVERGENCE_GUARD` does not waive an unresolved blocker and does not authorize shipping. It prevents an unbounded sequence of “review -> invent more protocol -> review again” inside one candidate.

### Minimum live slice first

When a merged capability is decomposable and the full rollout keeps expanding the proof surface, deploy the smallest independently useful low-risk slice first.

Default order:

```text
read-only visibility/status
-> one bounded exact mutation canary, if needed
-> broader self-service mutations only after the earlier slice is live and proven
```

Optional dogfood, critical-job mutation, broad admin behavior, or unrelated compatibility work MUST NOT gate a read-only slice unless an accepted Product Contract explicitly requires atomic delivery.

Each production slice keeps its own Controlled-operation gate, rollback/readback, and receipts.

### Proportional re-review

Intermediate re-audits review:

- the frozen blocker closures;
- semantics changed by the repair;
- directly dependent Evidence/invariants invalidated by that repair.

Do not rerun unrelated prior mechanisms merely because the candidate Head changed mechanically. The final Controlled production boundary still runs the complete applicable matrix required by accepted authority.

### Stop discipline

Once `DONE_WHEN` is met and no valid `EXPANSION_TRIGGER` fired, stop. Do not convert optional hardening discovered during review into mandatory same-Goal work.

## Local operating loop

```text
1. PREFLIGHT: discover Product Architecture, Current Decisions, related investigations, and governing Specs.
2. Classify exactly one of REUSE / AMEND / SUPERSEDE / NEW.
3. UNCERTAIN about mechanical = NON_MECHANICAL.
4. No accepted implementation-authorizing Spec in base = no implementation.
5. Review the exact Spec commit independently.
6. Authorized maintainer accepts the exact final head.
7. Implement against the pinned Spec revision.
8. Produce Contract-by-Contract conformance evidence.
9. Apply blocker-union freeze / convergence guard / minimum-live-slice rules when review or rollout starts expanding.
10. Report drift; never edit accepted authority to excuse code.
11. DONE_WHEN met without a valid EXPANSION_TRIGGER -> STOP.
```

Local extensions may refine the vendored governance but may not silently weaken or contradict the pinned distribution. Updating the distribution requires a separate docs-only adoption/update review.
