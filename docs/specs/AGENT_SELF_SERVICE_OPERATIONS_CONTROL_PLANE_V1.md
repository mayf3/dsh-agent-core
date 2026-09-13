---
spec_id: AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1
status: accepted
date: 2026-09-13
accepted_date: 2026-09-13
independent_program_review: AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1_PROGRAM_REVIEW
independent_program_review_result: PASS
reviewed_program_sha256: 18d5a23fa5e7b6d25eaf7a7e47373adc3b5bc6fa8bbbdadd66e36080f33d8858
owner_rulings:
  - ALLOW_CALLER_SCOPED_SELF_OPS_STATUS_DISCLOSURE=YES
  - ALLOW_SELF_TERMINATION_ONLY_RECONCILIATION=YES
spec_kind: program
authority_level: governing_spec
implementation_authority: none
production_apply_authority: none
scope:
  - self-service operations authority program
  - successor-authority sequencing
  - HR Feishu dogfood terminal gate
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
external_authorities: []
supersedes: []
superseded_by: null
references:
  - docs/investigations/AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1_CENSUS.md
owners:
  - mayf3
---

# AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1

## 0. Authoring result

```text
SPEC_GOVERNANCE_MODE = AUTHOR
AUTHORITY_ACTION = NEW
SPEC_ID = AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1
STATUS = accepted
IMPLEMENTATION_AUTHORITY = none
PRIMARY_PARENT_AUTHORITY = AGENT_CORE_PRODUCT_ARCHITECTURE_V1
EXTERNAL_AUTHORITIES = NONE
PLAN_LEVEL = EXEC_PLAN
ASSURANCE_LEVEL = CONTROLLED
DOCS_FIRST_REQUIRED = YES
OWNER_RULING = ALLOW_CALLER_SCOPED_SELF_OPS_STATUS_DISCLOSURE=YES,
               ALLOW_SELF_TERMINATION_ONLY_RECONCILIATION=YES
OWNER_RULING_SOURCE = Owner instruction in AGENT_SELF_SERVICE_OPERATIONS_CONTROL_PLANE_V1 goal thread,
                      2026-09-13 Asia/Shanghai
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE (child successors are future authorities, not this Program's TBD)
PARTIAL_SUPERSESSION = NONE
CONTRACT_COUNT = 6
CONTRACTS_WITH_ACCEPTANCE = 6
AUTHORING_READY_FOR_REVIEW = YES
INDEPENDENT_PROGRAM_REVIEW = PASS
READY_FOR_ACCEPTANCE = YES
NEXT_ACTION = AUTHOR_SCHEDULER_OCCURRENCE_OUTCOME_V3
```

This accepted Program coordinates authority work only. It grants no product implementation or production
apply authority. It does not amend, refine, or override any accepted Decision or implementation Spec.

## 1. Goal

After all child authorities, implementation, deployment, and dogfood gates are independently satisfied, a
Feishu Agent can inspect, diagnose, safely repair, verify, and report common mechanical Scheduler/turn
problems that belong to itself. The design is generic and contains no HR ID, job ID, Workflow domain,
payload, title, or chat ID special case.

## 2. Scope and non-goals

In scope: coordinate the exact authority-successor sequence, preserve the minimal recommended surface, freeze
program-level safety and rollout gates, and define the terminal HR Feishu evidence standard.

Non-goals: this Program does not define occurrence schema, fence semantics, model-visible field schemas,
authorization predicates, implementation file closure, migration mechanics, or production commands. It does
not authorize code, deployment, sudo, Auth/Grant changes, foreign access, `trigger_once`, runtime reload,
process kill, or incident repair.

## 3. Authority and dependencies

- Parent authority: `AGENT_CORE_PRODUCT_ARCHITECTURE_V1`.
- Current long-lived Decision: `SCHEDULER_OCCURRENCE_OUTCOME_V2` remains accepted/current.
- Current implementation authorities: `SCHEDULER_TIMEOUT_OUTCOME_V2`,
  `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2`, `AGENT_PROCESS_LIFECYCLE_HARDENING_V2`,
  `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1`, and `AGENT_CORE_SCHEDULER_RUN_HISTORY_V1` remain unchanged.
- This Program's future child-authority sequence is governed by DEC-SSO-001 and CTR-PROG-001.
- External authorities: none. This Program creates no Auth audience, scope, Grant, credential, or OBO path.

## 4. Current State

### STATE-001 — Existing self Scheduler control is substantial but intentionally excludes reconcile

- Subject: model-visible Scheduler self-service surface.
- Revision: `github/main@5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`.
- Environment: isolated clean source worktree.
- Observed at: 2026-09-13 Asia/Shanghai.
- Assertion: accepted `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2` provides
  `create|list|runs|update|enable|disable|remove`, derives caller identity from trusted Parent context, and
  explicitly keeps reconcile operator-only.
- Basis: OBS-001, EVD-001.

### STATE-002 — Router already owns exact termination evidence

- Subject: AgentProcess/Router reconciliation store.
- Revision and environment: same as STATE-001.
- Observed at: 2026-09-13 Asia/Shanghai.
- Assertion: exact current-epoch `(occurrenceId, runId, requestId)` correlation resolves to a Router turn
  handle; settled records distinguish `late_completed`, `late_failed`, and
  `terminated_without_outcome` and carry closed termination evidence.
- Basis: OBS-002, EVD-002.

### STATE-003 — Current Scheduler authority cannot represent termination-only fence release

- Subject: D-007 and Scheduler Timeout V2 occurrence/fence contracts.
- Revision and environment: same as STATE-001.
- Observed at: 2026-09-13 Asia/Shanghai.
- Assertion: `executionOutcome` is absent for `outcome_unknown`, terminal values are only
  `succeeded|failed`, the fence projection is active for every unknown without `lateSettlement`, and C-029
  authorizes only an operator-selected `succeeded|failed` reconciliation. A self operation that preserves
  business outcome unknown but releases execution-live risk would change accepted long-lived meaning.
- Basis: OBS-003, EVD-003.

## 5. Observations

### OBS-001

- Subject: accepted unified Scheduler manifest and self-service access layer.
- Source revision: `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`.
- Environment: isolated clean source worktree.
- Observed at: 2026-09-13 Asia/Shanghai.
- Method: source inspection.
- Result: self ownership and single-authority mutation already exist; duplicating them would create churn.
- Provenance: EVD-001 sources.

### OBS-002

- Subject: Router reconciliation query/state-machine and Scheduler invoker correlation.
- Source revision: `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`.
- Environment: isolated clean source worktree.
- Observed at: 2026-09-13 Asia/Shanghai.
- Method: source inspection.
- Result: exact triple resolution exists; Scheduler occurrence authority does not persist a
  `reconciliationHandle`, so a future tool must derive it server-side rather than trust model input.
- Provenance: EVD-002 sources.

### OBS-003

- Subject: current occurrence, fence, and Router late-result contracts.
- Source revision: `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`.
- Environment: isolated clean source worktree.
- Observed at: 2026-09-13 Asia/Shanghai.
- Method: compare D-007 §8, Scheduler Timeout V2 C-022/C-028/C-029, and the Router
  `terminated_without_outcome` contract.
- Result: termination-only is not representable without changing the current Decision and implementation
  authority. Mapping it mechanically to `failed` is also unauthorized because it lacks exact outcome proof.
- Provenance: EVD-003 sources.

## 6. Claims and assumptions

### CLM-001 — Reuse dominates new surface

The only recommended new model-visible capability is a generic `self_ops` tool with `status` and
`reconcile_turn`; existing `scheduler` remains the job list/control tool. `trigger_once` and
`self_runtime_reload` are outside V1.

- Support state: INFERRED.
- Supported by evidence: EVD-001, EVD-002.
- Contradicted by evidence: none known.
- Uncertainty: final field and capability shape belongs to the future whole-authority successors.

### CLM-002 — Product implementation is not currently authorized

The required reconciliation changes a long-lived Current Decision and two accepted implementation Specs.
Repository policy forbids partial supersession. The child authority route is therefore three docs-first,
whole-authority successors, each independently reviewed and atomically accepted before code.

- Support state: SUPPORTED.
- Supported by evidence: EVD-003 and `.agents/local/README.md` whole-authority rule.
- Contradicted by evidence: none known.
- Uncertainty: none for route classification; exact successor content is intentionally not yet authored.

## 7. Evidence relations

### EVD-001

- Source observations: OBS-001.
- Target: STATE-001, CLM-001.
- Relation: SUPPORTS.
- Bound coordinates: source `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`, isolated worktree.
- Strength/sufficiency: strong for current source capability and explicit exclusions.
- Limitations: does not establish production deployment parity.
- Provenance: `docs/specs/AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V2.md` and
  `packages/scheduler/src/self-service/access.js`.

### EVD-002

- Source observations: OBS-002.
- Target: STATE-002, CLM-001.
- Relation: SUPPORTS.
- Bound coordinates: source `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`, isolated worktree.
- Strength/sufficiency: strong for current exact correlation/query mechanics.
- Limitations: Router reconciliation is in-memory and current-epoch only.
- Provenance: `packages/agent-router/src/reconciliation/query.js`,
  `packages/agent-router/src/reconciliation/state-machine.js`, and
  `packages/agent-router/src/process/agent-process.js`.

### EVD-003

- Source observations: OBS-003.
- Target: STATE-003, CLM-002.
- Relation: SUPPORTS.
- Bound coordinates: source `5c7b62055e40e3ad0c7ec80a2896a51fd0e33814`, isolated worktree.
- Strength/sufficiency: controlling accepted authority for the route decision.
- Limitations: does not decide whether the Owner wants the new product meaning.
- Provenance: `docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md` §8 and
  `docs/specs/SCHEDULER_TIMEOUT_OUTCOME_V2.md` C-022/C-028/C-029.

## 8. Decisions

### DEC-SSO-001 — No partial authority override

If the Owner accepts the proposed product direction, the next artifacts are complete standalone successors:

1. `SCHEDULER_OCCURRENCE_OUTCOME_V3` — separates business-outcome uncertainty from proven execution
   termination and completely restates the Current Scheduler Decision;
2. `SCHEDULER_TIMEOUT_OUTCOME_V3` — completely restates occurrence schema, state, fence rebuild,
   reconciliation, retry, rollback, and compatibility contracts under the V3 Decision;
3. `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3` — completely restates the current unified Scheduler tool
   authority and adds only exact caller-owned status/reconciliation consumption.

Each successor remains proposed until its predecessor stays accepted/current. Acceptance is an atomic
whole-authority transaction with backlinks and an independent exact-final-head review.

### DEC-SSO-002 — Minimum recommended surface

Future child authoring should preserve this bounded recommendation from the census:

- reuse `scheduler(list|runs|enable|disable)`;
- add one LOCAL `self_ops(status|reconcile_turn)` capability;
- derive caller identity and Router handle entirely server-side;
- accept only exact `job_id`, `occurrence_id`, and `run_id` for reconciliation;
- allow no model-selected result, evidence note, principal, PID, payload, retry, force, or target Agent;
- exclude `trigger_once`, runtime reload, cancellation, kill, sudo, Auth/Grant changes, and foreign access.

This recommendation is not an implementation contract until the child successors restate and accept it.

### DEC-SSO-003 — UNKNOWN is never ZERO

Future authority must preserve both facts independently:

```text
OLD_EXECUTION_CAN_CONTINUE = NO only with trusted termination proof
OLD_BUSINESS_SIDE_EFFECT = UNKNOWN unless a trusted business receipt proves otherwise
```

Fence release may never assert that the old business action did not occur, authorize blind retry, or erase
the original unknown history.

## 9. Contracts

### CTR-PROG-001 — Authority gate

No product implementation begins until all three whole-authority successors in DEC-SSO-001 are accepted on
`main` with `implementation_authority: contracts` where applicable.

### CTR-PROG-002 — Scope gate

Child authority must reuse the current Scheduler/Router/Broker/store/supervisor seams and must not introduce
a second Scheduler, shadow database, raw store/fence edit, run-as/OBO, copied credential, HR-specific bypass,
or cross-Principal control.

### CTR-PROG-003 — Safety gate

No operation may clear a fence from pending, restart-lost, evicted, never-existed, mismatched, or conflicting
evidence. Termination proof alone never becomes business success, failure, or zero side effects.

### CTR-PROG-004 — Production gate

Implementation, merge, deployment, runtime activation, and HR dogfood are separate gates. Production apply
requires serialized authority, exact preimage/rollback, pinned bytes, readback, health/invariant checks, and a
fresh real canary.

### CTR-PROG-005 — Terminal business gate

`FEISHU_AGENT_SELF_SERVICE_OPERATIONS_READY=YES` requires a real HR Feishu message followed by HR-owned
diagnosis, exact safe repair, readback, and a new natural canonical run/session/disposition. Candidate tests,
merge, deploy, or health alone cannot satisfy it.

### CTR-PROG-006 — Fresh reconciliation evidence gate

The final dogfood must use a current-runtime-epoch termination record. A future controlled runbook must first
consume an already-existing fresh HR incident if one safely exists. Otherwise it must define a separately
Owner-authorized, effect-free HR canary that can produce exactly one `terminated_without_outcome` sample,
with exact identity/correlation, one attempt maximum, bounded timeout, abort conditions, pre/post
Scheduler+Router readback, process-collateral analysis, and rollback. Old/restart-lost/evicted evidence and an
accidentally induced business action are forbidden.

## 10. Acceptance

### ACC-PROG-001 — No implementation before authority

- Contracts: CTR-PROG-001.
- Method: exact-base-to-head diff and ancestry review.
- Environment: source repository and merged `main`.
- Required evidence: three independently reviewed, accepted, merged whole-authority successors and backlinks.
- Expected result: product-code delta before the final authority merge is zero.
- Failure condition: any code, deployment, or partial accepted-authority edit appears early.

### ACC-PROG-002 — Boundary preservation

- Contracts: CTR-PROG-002.
- Method: manifest/schema/source diff, negative authorization tests, store-writer census.
- Environment: isolated implementation candidate.
- Required evidence: one Scheduler/store authority, server-derived caller, zero Auth calls for self actions,
  zero foreign reads/mutations, and no forbidden bridge.
- Expected result: every forbidden alternative is mechanically absent.
- Failure condition: any duplicate authority, identity input, foreign access, credential broadening, or raw
  mutation exists.

### ACC-PROG-003 — Unknown and termination safety

- Contracts: CTR-PROG-003.
- Method: full state/fence/reconciliation transition matrix with fault injection.
- Environment: isolated deterministic Scheduler/Router integration tests.
- Required evidence: exact positive proof, every negative absence state, multi-unknown same-job behavior,
  response-loss readback, no retry, and preserved unknown business-side-effect evidence.
- Expected result: only exact trusted proof changes execution-live eligibility; UNKNOWN is never ZERO.
- Failure condition: time, model text, PID-only observation, missing evidence, or mismatched identity clears a
  fence or asserts a business result.

### ACC-PROG-004 — Controlled rollout

- Contracts: CTR-PROG-004.
- Method: independent implementation audit, deployment preflight/apply/readback, rollback rehearsal, canary.
- Environment: sealed candidate then single active production runtime.
- Required evidence: exact SHAs, actor/authority, preimage, receipt, readback, health, invariant, and rollback.
- Expected result: deployment is reversible and target-bound.
- Failure condition: unknown apply outcome, concurrent writer, stale evidence, missing rollback, or unpinned
  runtime bytes.

### ACC-PROG-005 — HR Feishu dogfood

- Contracts: CTR-PROG-005.
- Method: send exactly `检查一下你自己的定时任务，有问题就自己修复。` through the real HR Feishu
  path, then inspect authoritative post-state.
- Environment: production HR Agent and canonical Scheduler store.
- Required evidence: self status/list, exact canonical/superseded provenance or explicit ambiguity gate,
  self-performed safe disable/reconcile, fence readback, new future-natural occurrence, new session or
  disposition activity, and HR report.
- Expected result: all required HR PASS fields and `OWNER_INTERVENTION_FOR_MECHANICAL_REPAIR=0`.
- Failure condition: an external coding Agent performs the mechanical repair, a title guess selects a job,
  no new run is observed, or success is inferred from chat/health alone.

### ACC-PROG-006 — Fresh effect-free reconciliation sample

- Contracts: CTR-PROG-006.
- Method: execute the independently reviewed controlled canary/runbook once, or bind a fresh genuine HR
  incident that already satisfies the same proof contract.
- Environment: the current production runtime epoch and HR-owned Scheduler/Router correlation.
- Required evidence: effect-free payload proof, exact job/occurrence/run/request/turn binding, attempt count
  `<=1`, bounded timers, pre/post store and Router snapshots, no collateral active turn, rollback receipt, and
  real Feishu visibility.
- Expected result: one current-epoch `terminated_without_outcome` sample is safely available for HR self
  reconciliation without an external Agent performing the repair.
- Failure condition: synthetic local-only evidence, stale/restart-lost handle, more than one attempt,
  non-effect-free payload, ambiguous process ownership, or missing rollback/readback.

## 11. Alternatives and disposition

### ALT-001 — Partial amendments

- Disposition: REJECTED.
- Alternative: partially amend D-007, Scheduler Timeout V2, or Self-Service Scheduler V2.
- Reason: repository policy requires whole-authority supersession for changed long-lived meaning.

### ALT-002 — Termination means failure

- Disposition: REJECTED.
- Alternative: map `terminated_without_outcome` to `failed` without exact failure proof.
- Reason: termination proves the old execution cannot continue, not its business outcome.

### ALT-003 — Model supplies the Router handle

- Disposition: REJECTED.
- Alternative: persist or accept a model-supplied reconciliation handle.
- Reason: the Parent can derive the handle from the exact occurrence/run/request triple; model input weakens
  identity without adding capability.

### ALT-004 — Duplicate Scheduler tool family

- Disposition: REJECTED.
- Alternative: add `self_scheduler_jobs` and a second job-control tool.
- Reason: the accepted unified `scheduler` tool already owns those actions.

### ALT-005 — V1 trigger or reload bridge

- Disposition: REJECTED.
- Alternative: implement `trigger_once` through a shadow one-shot Job, or add synchronous self reload,
  shell/sudo, arbitrary PID kill, or credential/Grant expansion.
- Reason: each path adds unrelated occurrence, lifecycle, or privilege semantics and is unnecessary for the
  natural-run dogfood.

### ALT-006 — Guess canonical identity

- Disposition: REJECTED.
- Alternative: classify canonical/superseded jobs by title, schedule similarity, payload, age, or model
  judgment.
- Reason: display/similarity evidence is not a stable identity or product-decision authority.

## 12. Migration, compatibility, and rollback

This proposed Program changes no runtime or stored data, so its rollback is deletion before acceptance or a
future whole-Spec supersession after acceptance. Each child successor MUST completely define V2 store
migration, compatibility with old readers/writers, fence rebuild across restart, deployment rollback, and the
rule that unresolved V3 evidence forbids rollback to a reader that would reinterpret it. Those details belong
to future child authorities and do not constitute a normative TBD in this no-implementation Program.

## 13. Open questions and acceptance

The Owner decided both independent changes in the Goal thread on 2026-09-13 Asia/Shanghai:

```text
ALLOW_CALLER_SCOPED_SELF_OPS_STATUS_DISCLOSURE = YES
ALLOW_SELF_TERMINATION_ONLY_RECONCILIATION = YES
```

The first decision covers model visibility of the bounded caller-scoped lifecycle/Scheduler status projection.
The second covers exact caller-owned termination-only evidence consumption and fence release. These rulings
authorize only authoring and review of the corresponding clauses in the three whole-authority successors in
DEC-SSO-001. They do not accept those future documents, authorize implementation, grant production apply,
permit outcome selection, or authorize any excluded operation.

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE (no current authority changed by this Program)
PARTIAL_SUPERSESSION = NONE
```
