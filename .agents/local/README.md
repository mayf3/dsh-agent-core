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
```

Run the vendored integrity verifier:

```bash
python3 .agents/tools/verify_governance.py --target .
```

After adoption is active on `main`, use `--require-accepted` when verifying the authority branch.

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
9. Report drift; never edit accepted authority to excuse code.
```

Local extensions may refine the vendored governance but may not silently weaken or contradict the pinned distribution. Updating the distribution requires a separate docs-only adoption/update review.
