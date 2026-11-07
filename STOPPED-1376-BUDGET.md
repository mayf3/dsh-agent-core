# STOPPED-1376-BUDGET

Status: STOPPED_BEFORE_IMPLEMENTATION / load-bearing handoff authority dependency.
Recorded at: 2026-11-07T01:45:01Z. This is not a test failure or a completed implementation.

## Coordinates and authorization

- Repository: `mayf3/dsh-agent-core`; sole write surface: `/private/tmp/h1376-budget`.
- BASE_HEAD = REVIEW_TARGET_HEAD = CURRENT_BASE_HEAD = `3c1bcf98bc40a2c34cca24f241c87d1b12cea216`.
- Current remote `main` was verified with `git ls-remote origin refs/heads/main`; local `main` is stale and was not used as the authority snapshot.
- HEAD remains detached at the provided base. No branch, commit, push, PR, merge, deployment, or production mutation was performed.
- Mandate: the user's BRIEF-1376-WAIT-BUDGET, also present as the pre-existing untracked `BRIEF-1376-WAIT-BUDGET.md`; ordinary R&D / deliver PR, no self-merge, failure means stop and write this file.
- The accepted, implementation-authorizing Recovery Liveness Spec is present in HEAD; its acceptance alignment note binds PR #623 / merge `2d550bc8147c877db33886fccb85e00a64353e66`. Historical authoring-stage prose is not mistaken for current acceptance status.

## Readiness failure and exact counterexample

Finding: **load-bearing SPEC_GAP at the existing legal system Assistance handoff boundary**. The Core Spec decides the obligation to preserve responsibility and escalate reliably, but the inspected existing callable path does not supply the required lawful readback-aging ingress. No production call was made to manufacture a rejection.

Reachable counterexample from the accepted model:

1. Original attempt generation = 1, configured maxAttemptsPerVisit = 3; the business request has already been delivered.
2. Settlement read fails with 503 and remains unavailable through a proposed finite wait deadline. Business outcome and side effects remain UNKNOWN. No existing Assistance case is known.
3. Deadline expiry supplies neither an exhausted business-attempt policy nor a fresh instance-detail version.
4. The system handoff ingress accepts only attempt/stale-loop exhaustion. The ordinary assignee ingress instead needs the real current assignee and fresh version CAS. Neither prerequisite follows from aging.
5. A new local callback, pending notification, ACK, or invented handoff receipt cannot transfer this obligation. Suppressing further reads would silently abandon it.

This is a source/authority counterexample, not an executed runtime fault-injection claim.

## Authority and implementation evidence

| Source | Finding |
|---|---|
| Recovery Liveness V1 §2, lines 52-59 | Other accepted boundaries and Svc business ownership remain active; no expanded business-effect permission. |
| CTR-EKRWAE-001, lines 175-187 | Exact identity, UNKNOWN, no replay or fence changes; B1/B4 target-Agent access is read-only. |
| CTR-EKRWAE-003, lines 201-216 | Responsibility transfers only through legally delivered handoff with subsequent consumer, reply verification, and retrigger path. |
| CTR-EKRWAE-007, lines 276-285 | Upgrade through an existing lawful Owner/Assistance path; queued/ACK is insufficient; delivery failure retains automatic responsibility and next trigger. |
| Recovery Liveness V1 §8 crosswalk | Does not replace WEC V3 CTR-WEC1-005's attempt-limit system ingress, or grant the poller an assignee write role. |
| WEC V3 CTR-WEC1-005, lines 152-168 | System `workflow_execution_escalation.create` is triggered when the visit attempt limit is reached. |
| WEC V3 CTR-WEC1-008, lines 238-256 | Policy evidence DTO is closed; reason is ATTEMPTS_EXHAUSTED or STALE_LOOP_EXHAUSTED. |
| WAE V3 CTR-WAE-008, lines 363-372 | The target Agent opens Assistance with its own Principal when blocked. |
| `packages/broker/src/capabilities/workflow/dispatch.js:180-225` | Existing system ingress reports exhausted execution-attempt policy; reason enum accepts only ATTEMPTS_EXHAUSTED / STALE_LOOP_EXHAUSTED. |
| `packages/broker/src/capabilities/workflow/assistance.js:283-346` | Ordinary Assistance open requires current assignee identity and fresh expectedWorkflowStateVersion CAS. |
| `packages/production-runtime/src/workflow-execution-runtime.js:339-373` | Actual mounted engine handoff calls the system ingress as poller, then wakes the case Owner. It cannot create a readback-aging case without a valid ingress. Returned ok/case/Owner fields do not independently prove the full CTR-007 transfer. |

The issue and its sole comment were fetched through the connected GitHub tools, including all comment pages:

- https://github.com/mayf3/agent-control/issues/1376
- https://github.com/mayf3/agent-control/issues/1376#issuecomment-6645082629

The comment requires aging independent of failure counts and a durable next intention; it is delivery definition, not authority to widen Svc's closed system protocol or impersonate an assignee.

## Alternatives considered and minimum closure

- **Do not use a new reason against the old ingress:** it is outside its closed protocol.
- **Do not relabel wait expiry as ATTEMPTS_EXHAUSTED / STALE_LOOP_EXHAUSTED:** in the counterexample the required execution-policy fact has not occurred.
- **Do not call as the target Agent merely because gateway accepts agentId:** permission to perform original-target readback is not permission to perform assignee business writes. Persistent 503 also leaves the fresh CAS version unavailable.
- **Do not replace Assistance with a direct message or local status:** that does not provide the accepted consumer/reply/retrigger obligation.
- **Do not deliver only timestamp fields and claim the task complete:** safe isolated aging metadata could be implemented separately, but it cannot remove this task's reliable-handoff dependency; the mandate requires stop on failure.

Minimum closure, owned by the relevant Core/Svc Product Authorities: identify an already accepted equivalent handoff path at exact base with callable evidence, or accept a bounded readback-aging branch on the existing system Assistance path. Bind its legitimate trigger/reason/actor, original identity and UNKNOWN, idempotent service receipt/readback, receiver/consumer, reply verification/retrigger, and delivery-failure retention. This needs no second ledger, platform, blind business retry, or change to #1379 transport. Any new cross-repository protocol/permission delta must pass the applicable docs-first route before this implementation resumes.

## Route and stop

```text
INITIAL_AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_CORE_WORKFLOW_RECOVERY_LIVENESS_V1@3c1bcf98bc40a2c34cca24f241c87d1b12cea216
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE (persistent responsibility metadata; source work only)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
SPEC_GAP_DEPENDENCY = LOAD_BEARING (lawful readback-aging handoff ingress)
IMPLEMENTATION_ALLOWED = NO (dependent reliable-handoff implementation)
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = RE_PREFLIGHT (minimum handoff boundary closure; no authority authored here)
```

Independent read-only reviewer: collaboration agent `/root/contract_review`; did not author a semantic delta, edit files, execute tests, or perform production operations. It independently confirmed the same counterexample and minimum closure; this is preflight review, not a completed candidate assurance PASS.

Stop source: user AGENTS.md requires “When authority conflicts or drift are found, stop the dependent work and report the concrete conflict”. The applied skill is `.agents/skills/spec-governance/SKILL.md`, selected mode `.agents/skills/spec-governance/modes/PREFLIGHT.md`, which says: “Do not start semantic implementation or mutation when the relevant readiness flag is `NO`.” No authority files or `.agents/tools` were modified.

Tests: NOT_RUN; no test process was started, so test rc is NOT_APPLICABLE, not 0. Docker/compose: NOT_RUN, no Docker availability claim and no SKIP-as-PASS. No original business operation, Router/Scheduler protected state, node_modules, or other checkout was mutated.

See `RECEIPT-1376-BUDGET.md` for frozen DONE_WHEN and unmet delivery gates.
