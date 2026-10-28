# Workflow attempt-cap Owner-resume REUSE brief

This brief records the required DEVELOPMENT_PREFLIGHT and bounded implementation route for PR #573. It is not Product Authority, merge approval, or production authority.

## DEVELOPMENT_PREFLIGHT

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = e2b6622cf9110587fe69d2d577b9534b6beadf55 (before repair)
BASE_HEAD = f63eaf6e000d2bbf4343c727d38474147db7f6cb (origin/main)
CURRENT_BASE_HEAD = f63eaf6e000d2bbf4343c727d38474147db7f6cb (fresh at preflight)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = Let a resolved execution-policy case authorize one safe same-visit generation after automatic attempt-cap exhaustion.
CURRENT_GAP = At the cap, terminal NEEDS_REVIEW/run_ended_no_submission is first converted to SETTLED/stale_no_progress; Owner-resume requires the exact prior NEEDS_REVIEW state and is therefore unreachable.
OBSERVATIONS = A67 gen3 ended run_ended_no_submission at 16:43:01.376Z; stale_superseded was appended at 16:44:02.125Z before ATTEMPTS_EXHAUSTED at 16:44:02.223Z. Owner resolved the matching same-visit policy case at 16:44:43.884967Z. The case's attempt and intent IDs match gen3. Due polling continued, but no resume evidence read or gen4 plan followed. Read-only diagnosis: ART/a67-resume-diagnosis-20261029/A67_OWNER_POLICY_SAME_VISIT_RESUME.md.
WORKING_GUESS = NOT_APPLICABLE; the state gate and event order reproduce the observed no-resume path in source.
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2 @ f63eaf6e000d2bbf4343c727d38474147db7f6cb
RELATED_AUTHORITIES = AGENT_CORE_WORKFLOW_STALE_REENTRY_V2 @ f63eaf6e000d2bbf4343c727d38474147db7f6cb; SVC_WORKFLOW_EXECUTION_CONTROL_V1 / CTR-SWEC-010 @ f2ebf07e302d410016b3fd1024d652375cef8541 (read-only companion contract)
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID — root directed the sole isolated implementation in this worktree for PR #573.
MUTATION_AUTHORIZATION = VALID — only code/test/brief changes on this exact branch/worktree; no merge, runtime, service, database, or deployment effects.
ISOLATED_WRITE_SURFACE = YES — /Users/yanfenma/.codex/worktrees/native-tool-policy-spec/dsh-agent-core @ codex/gcr-typed-review-impl, initial HEAD e2b6622cf9110587fe69d2d577b9534b6beadf55.
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS — source event order, current accepted Spec, A67 append-only attempt ledger, owner case DB facts, and resume evidence request log are available by exact coordinates.
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = NOT_APPLICABLE
BASE_IMPACT = BOUNDED — existing accepted authority and intended branch only.
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = Red/green engine regression for cap case; negative regression that a truly stale-superseded generation and UNKNOWN execution cannot resume; focused affected workflow-execution tests; exact diff/HEAD verification.
DONE_WHEN = A cap-exhausted terminal NEEDS_REVIEW attempt opens/replays its policy case before stale_superseded, preserving the strict Owner-resume predecessor; one authorized resolved case admits exactly one next generation; stale-superseded and UNKNOWN predecessors remain fenced; tests pass and the exact isolated diff is reviewable.
EXPANSION_TRIGGER = Any change to WEC/SRE/service contracts, generic eligibility of SETTLED/stale attempts, unknown-delivery rules, runtime rollout, merge, or deployment.
NEXT_REAL_ACTION = Write and run the cap-ordering regression before changing implementation.
NEXT_ACTION = CONTINUE
```

## Governing intent and frozen boundaries

The accepted WEC2 is present on `origin/main` and declares `implementation_authority: contracts`. CTR-WEC1-005 explicitly allows escalation when a generation at the configured cap settles `NEEDS_REVIEW`; CTR-WEC1-008 allows the policy ingress only for the latest terminal `NEEDS_REVIEW/run_ended_no_submission` predecessor and authorizes one monotonically increasing generation. The accepted SRE V2 preserves the distinct stale-path quiescence fence. This change uses the direct cap-escalation branch and leaves the existing Owner evidence, fresh identity/version read, settled Router proof, one-use ledger consumption, and unknown fences intact.

No relevant rejected proposal was found. No Product Architecture or current Decision changes are needed; Workflow instance and transition ownership stays external to Agent Core. Svc source, live service, A67 runtime, credentials, merge, and deployment are outside scope; the authorized Core source and test changes are in this isolated worktree.

## Implementation result

- `packages/workflow-execution/src/engine.js`: after positive stale/run-ended confirmation, a terminal generation at the automatic attempt cap now invokes the existing idempotent escalation before stale supersession. The latest `NEEDS_REVIEW/run_ended_no_submission` predecessor remains available to the existing exact Owner-resume gate. Below-cap stale handling is unchanged; UNKNOWN is still excluded. A recorded escalation skips redundant calls.
- Regression coverage: cap escalation → resolved execution-policy proof → one same-visit next generation; a true higher-generation predecessor rejects older-generation policy evidence; `run_outcome_unknown` performs no Owner-evidence read or delivery. Existing WEC1-005 and AC2 expectations now assert the preserved terminal state and `OWNER_PENDING` projection.
- TDD evidence: the new engine test failed before implementation because gen3 became `SETTLED`; it passes after the ordering change.
- Validation: focused affected tests passed 31/31; the complete `packages/workflow-execution/test/*.test.js` suite passed 245/245; `git diff --check` passed.
- Authority and limits: reuse of accepted `AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V2` CTR-WEC1-005/008 and `AGENT_CORE_WORKFLOW_STALE_REENTRY_V2`; no Spec change. Source change is isolated and reviewable; no merge, deployment, service write, or A67 action.
- Commit: one source/test/evidence commit on `codex/gcr-typed-review-impl`; exact SHA is reported with the handoff.
