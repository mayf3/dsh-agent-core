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

Pending-acceptance draft pointer (not authority): the `#441` consolidation
candidate at `docs/AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md` §7 — currently
Draft PR #446 — is 待审/unaccepted. It grants no authority until Owner
acceptance via `AGENT_REPO_KNOWLEDGE_GOVERNANCE_V1`; reviewers may read it as
a written candidate only, never as accepted law. This pointer lives here
because the vendored `.agents/README.md` is integrity-locked.

Local rules:

- an implementation Spec may refine Architecture or a Current Decision, but may not silently contradict it;
- changing accepted long-lived meaning requires a new whole-authority supersession transaction;
- a Program Spec with `implementation_authority: none` coordinates work but does not authorize product implementation;
- an accepted-looking document on an unmerged branch is not active authority;
- code, tests, reports, and runtime evidence may prove conformance or drift but do not rewrite normative authority.

## Bounded-development route (effective on V3 adoption only)

These local choices become active only with the accepted
`AGENT_DEVELOPMENT_GOVERNANCE_ADOPTION_V3` and accepted lock merged into `main`.
Until then, the authority branch's existing rules remain controlling.

- `REUSE` inside an accepted implementation Contract needs no new Spec or
  standalone Spec review merely because code changes. Use focused tests and the
  review required by its Assurance level.
- Explicitly permit one atomic Spec-delta-and-code PR for bounded
  `AMEND/NEW + ROUTINE/DURABLE` work under the owner's task authorization. The
  delta must be independently accepted before merge; it cannot contradict
  Architecture, replace accepted meaning, widen privileges, change Secret/Grant
  boundaries, introduce destructive migration, or authorize production effects.
- `CONTROLLED` and `SUPERSEDE` remain docs-first. Implementation and production
  permissions are separate; missing production permission does not itself stop
  unrelated authorized nonproduction work.
- Review the affected change and invalidated dependencies. A new SHA alone does
  not require a full audit. Use the vendored explicit scope/impact checks.
- Ordinary tasks use the existing PR/Brief; no mandatory extra Agent formation,
  full-corpus review, or new control-plane document is introduced here.

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

For an authorized recovery, keep the old `outcome_unknown` record and its
business-side-effect uncertainty; do not replay its prompt or tools, erase it,
or infer success or failure from termination-only evidence. Before admitting an
explicitly new Session, Turn, or request, the exact mandate/runbook must prove
that both the old worker and its already-dispatched tool operations are
terminated or isolated from external effects, or that each actual write/delivery
boundary rejects the old identity. An epoch gate that only suppresses replies
is insufficient. If this proof is unavailable, keep the affected fence and stop.

Label offline tests as mechanism evidence. Claim live recovery only after a
fresh, explicitly new request succeeds through the authorized path with
attributable readback; do not count an old UNKNOWN replay as that request.
Protected-record hash forensics remain a prerequisite only for an accepted
recovery path that requires them, not a universal prerequisite for every
authorized recovery mode. Apply each selected path's mandatory gates without
delaying safe recovery for optional governance work.

### Recovery and deployment reuse handoff

Apply the existing recovery-first and proportional-review rules to the actual
execution path, not only to source readiness. For the affected incident, record
these facts in the existing handoff/Brief; no second queue, ledger, or mandatory
standalone report is needed:

- Distinguish accepted design, source readiness, installed callable capability,
  and live business acceptance. An offline test or merged reader is not a live
  recovery result. Attach time/revision-bound evidence; do not invent a percentage
  complete or call an unverified downstream path the last blocker.
- Before investing in a new recovery component, check its end-to-end call path:
  installed entrypoint, caller/operation scope, artifact/host constraints, result
  query, and failure exit. Use existing authorized observations; inaccessible
  evidence remains an explicit gap, not permission for a new protected read.
- Separate ordinary application release, business-state recovery, and deployment
  controller/profile changes. Prefer existing admitted mechanisms; explain a
  concrete shared-capability gap before proposing another incident-specific
  installer or privileged binding. Risk alone does not require a new Product Spec.
- Keep the old business turn, bootstrap transaction, and controller update as
  distinct evidence subjects. No journal status grants retry, a replacement ID,
  fence clearing, or new admission; apply the selected accepted path's conditions.
  The old business outcome may remain UNKNOWN under the recovery rule above.
- Carry incident history and unresolved dependencies across task/PR handoffs.
  Renaming a task does not erase failed attempts or restart an incident from zero.
  Reuse still-valid evidence and review only affected changes; this does not
  waive real blockers or add a new global review counter.

The [HR recovery/deployment reuse handoff](../../docs/reports/HR_RECOVERY_DEPLOYMENT_REUSE_HANDOFF_20260929.md)
records the motivating evidence and bounded follow-up objectives. Its proposed
implementation work is not Product Authority or production authorization. It must
not become an additional prerequisite for an already-safe authorized recovery.

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

### Convergence checkpoint (effective on V3 adoption only)

Retain review/repair history for the same business outcome across candidate
renames. Repetition without new evidence calls for reassessing scope or choosing
an existing simpler recovery path; it is not progress merely because another
report exists. This is diagnostic guidance, not a universal numeric cutoff.
Task-specific budgets require applicable authorization; they neither waive real
Blockers nor forbid an otherwise authorized necessary repair solely by round count.
Do not stop a usable service merely because a development candidate is paused.
The old three-round local guard remains controlling before V3 is active on main.

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
1. Read only the current task, relevant local authorities, and required evidence.
2. Classify Authority, Plan, and Assurance independently.
3. REUSE: implement within the accepted base Contracts; no new Spec for internal choices.
4. AMEND/NEW: use the active local atomic permission only where applicable.
5. CONTROLLED/SUPERSEDE or no active atomic permission: keep the docs-first boundary.
6. Review the actual affected surface; acceptance is by the authorized maintainer.
7. Run relevant tests and report implementation, installation, and business results separately.
8. Scope any real blocker to dependent work; do not restart unrelated completed checks.
9. Prefer existing safe recovery; optional generalized maintenance stays separate.
10. DONE_WHEN met without a valid EXPANSION_TRIGGER -> STOP.
```

Local extensions may refine the vendored governance but may not silently weaken or contradict the pinned distribution. Updating the distribution requires a separate docs-only adoption/update review.
