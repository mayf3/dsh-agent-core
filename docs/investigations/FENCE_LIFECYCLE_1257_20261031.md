# #1257 fence lifecycle implementation and evidence

This execution plan/evidence record is not a new implementation authority.

Base: `0386b34a3d1054c71cbe51a2310fdff4d55c992b`, branch
`ac-task/1257-fence-lifecycle`. No production store, service, fence or process
is an execution target. Preserve the original dirty checkout.

## DEVELOPMENT_PREFLIGHT

```text
Problem = incomplete shutdown/error propagation; no safe operator adapter; blocked ingress bypasses alerts
Governing Spec = AGENT_PROCESS_LIFECYCLE_HARDENING_V4 C015-C025/C026;
                 AGENT_DELIVERY_RESILIENCE_V1 CTR-R5
Spec status = accepted in Base
Relevant investigations = AGENT_CORE_OUTCOME_UNKNOWN_PARENT_RUNTIME_RECOVERY_V1;
                          DELIVERY_RACE_1332_20261031
Relevant decisions = D-009 SCHEDULER_OCCURRENCE_OUTCOME_V3 (current; D-007/V2 superseded)
Previously rejected alternatives = PID/epoch/time as exit proof; raw JSON surgery;
                                  blind replay; bypassing UNKNOWN retention
Frozen boundaries = sole store/state machine; exact identity; settle once; no production effects
Implementation scope = complete owned shutdown despite earlier errors;
                       offline exact-handle adapter over already durable proof;
                       blocked ingress into existing four-category alert feed
Out-of-scope = new proof kinds; restart-lost assertion-based recovery;
               scheduler policy; new external notification destination; production rollout
New evidence = Base already has planned-restart census gate and #1332 alert store;
               workflow/scheduler stop errors skip worker cleanup;
               startup blocked ingress bypasses delivery counters
Need new/amended Spec = NO for this bounded adapter/repair
```

## Approach and constraints

Current-main grammar route (the initial bootstrap compatibility preflight
above remains a record, not a replacement authority):

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
BASE_HEAD = 0386b34a3d1054c71cbe51a2310fdff4d55c992b
CURRENT_BASE_HEAD = 0386b34a3d1054c71cbe51a2310fdff4d55c992b (initial fresh fetch)
REVIEW_TARGET_HEAD = pending implementation freeze; see final evidence coordinates
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = source-only #1257 R1/R2/R3; reviewed unmerged PR and issue delivery comment
CURRENT_GAP = teardown can skip/swallow failures; no safe candidate CLI; blocked ingress bypasses alert feed
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V4 accepted in Base
RELATED_AUTHORITIES = AGENT_DELIVERY_RESILIENCE_V1; PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1;
                      D-009 SCHEDULER_OCCURRENCE_OUTCOME_V3; CODE_STRUCTURE_VERIFIER_CONFORMANCE_V1
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO (no Spec edits in this implementation)
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = DURABLE (source/candidate artifacts; no controlled live operation)
EXECUTION_MANDATE = VALID (Owner task in this session, exact branch/effects/Done When)
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO (no controlled operation executed)
SPEC_GAP_DEPENDENCY = NONE for bounded reuse; missing-proof/live adoption remain excluded
EVIDENCE_REVIEWABILITY = PASS (local raw logs, archived sanitized evidence)
LIVE_AUTHORITY_GAP = NONE within source scope
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = mayf3/agent-control#1257
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (not authorized; baseline failures must remain visible)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = RED/GREEN or already-green observations; same-env full comparison; nonauthor review
DONE_WHEN = reviewed PR and exact #1257 comment posted, then stop without merge
EXPANSION_TRIGGER = missing accepted authority; concrete data-loss/security regression; required-gate failure
NEXT_ACTION = CONTINUE within the three bounded source tasks
```

Reuse the existing shutdown/disposer chain, durable record constructors and
settlement authority, deployed loader and #1332 failure feed. Do not introduce
a second recovery schema or a process observer that manufactures proof.
An owner authorization permits an exact operation; it is never termination
evidence. The CLI can only finish settlement/cleanup already justified by the
durable record. In particular, PID absence and a retired epoch cannot prove
`child_real_exit`; restart-lost records without durable proof remain fenced
and require the separately authorized root-custodied quiescence path.

Accepted authority: lifecycle C017/C018 single durable store/CAS, C019 permits
resuming already proven settlement/cleanup, C020-C022 require owned real exit.
R3 uses category `other` with bounded recovery reason; it adds no category,
Feishu destination, reminder or age-based escalation contract.

## Implementation plan

Goal: source implementation, local regression evidence and independent review,
then an unmerged PR and delivery comment on agent-control#1257.

Architecture: thin command adapter over reconciliation modules; complete
shutdown with truthful aggregated errors; shared existing failure counter.
Tech stack: Node ES modules, node:test, local fixture files, isolated Postgres
only where existing integration tests use it.

Review focus: stop failure cannot skip owned worker teardown; real exit and
settlement remain distinct; no arbitrary evidence injection or store race;
deployed schema rejects invalid candidates without changing input; blocked
ingress alerts without prompt/answer/secret leakage or duplicate counting.

### Task 1: R1 reliable runtime drain

- [ ] Add failing shutdown integration cases for earlier stop failure and
  disposer/worker shutdown failure; verify owned cleanup still completes and
  stop result is a failure rather than clean exit.
- [ ] Repair `packages/production-runtime/src/compose.js`, `context.js` and
  `packages/agent-router/src/process-registry-startup.js` only as necessary.
  Preserve exact-owned AgentProcess shutdown and the existing restart gate.
- [ ] Run shutdown, restart-drain, restart-boundary and lifecycle suites;
  record existing already-green coverage separately from new RED/GREEN.
- [ ] Bind the existing controlled restart to an exact native old instance,
  fresh successful boundary receipt and drained census before replacement;
  missing/failed proof refuses bootstrap. Reuse DCP CTR-DCP-012 rather than
  treating native service-unloaded or a PID lookup as worker exit proof.

### Task 2: R2 offline exact-handle reconciliation

- [ ] Add fixture tests under agent-router process-lifecycle for CLI success
  from durable real-exit proof, missing proof/owner auth, stale preimage,
  malformed schema constraints, unrelated handle preservation and output
  collision refusal. First observe each required new behavior failing.
- [ ] Add reconciliation implementation module(s) and a thin
  `scripts/availability-recovery/turn-recovery.mjs` command. Require explicit paths (no production
  defaults), exact handle/preimage/owner authorization, deployed loader
  pre/post candidate validation, compare-before-publish, exclusively created
  durable output, and an audit receipt. Never import/construct the real store
  against the original file while planning, since its constructor restores
  all interrupted records.
- [ ] Invoke the existing state machine on an isolated candidate, restricted
  to the requested handle and already durable proof; leave all other records
  semantically unchanged. Refuse a new assertion of exit, unproven registry
  cleanup, new proof kind, prompt/answer replay or business-outcome upgrade.
- [ ] Verify commands as subprocesses against fixtures and verify rejected
  input preserves exact original bytes.

### Task 3: R3 shared blocked-delivery alert feed

- [ ] Add failing real ingress/startup/fence cases proving the early blocked
  path is absent from current counters.
- [ ] Wire those paths to `reconciliation/delivery-failures.js` using the
  existing categories/threshold feed. Preserve structured diagnostics and
  count a failure once; no message content enters logs.
- [ ] Inject faults and prove an alert is observable within the existing
  300000ms window; keep #1332 transport retry/dead letters unchanged.

### Task 4: verification, independent review and delivery

- [ ] Compare relevant existing suites and full candidate suite to the same
  Base environment; use isolated Postgres for gated integration checks.
- [ ] Run structure/governance checks; freeze exact commit and evidence.
- [ ] Nonauthor independent review; fix blocking findings with regression
  evidence. Record SPEC_COMPLIANCE and material limitations honestly.
- [ ] Push named branch, open PR, post precise issue comment with #527/#1332
  boundaries, then stop. Do not merge or perform production acceptance.

## Initial observations

Existing Base tests: shutdown + restart convergence matrix + restart drain,
20/20 pass (rc0). This is existing green coverage, not a new repair claim.
Current investigation has not accessed production turn-recovery bytes.
