---
status: investigation
date: 2026-10-20
production_apply_authority: none
---

# Workflow progress: bounded repair candidate

This record is evidence and a repair plan, not implementation authority.
Base: `6d96f6d6f08c14e894ec4be9eab708ecf5b09635` (local origin/main).

## DEVELOPMENT_PREFLIGHT

Problem = Real executor replies can repeat blockers without an action. Execution
instructions and tool descriptions disagree with actual detail response fields;
Assistance is unnamed in the instruction and absent from sampled live headers.

Governing Spec = accepted AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2,
CTR-WAE-004/008; accepted AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1
(existing transition argument contract). AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1
is context for existing owner read/action tools and delivery responsibilities.

Relevant investigations = HR_DISPATCH_DELIVERY_READINESS_V1; current read-only
evidence captured under /tmp/workflow-readonly-20261020.
Relevant decisions = accepted AGENT_WORKSPACE_SESSION_MODEL_V3 (D-008,
supersedes V2; Workflow remains task authority despite an agent notification);
no changes to session, identity, Scheduler or admission contracts.
Previously rejected alternatives = svc dispatch identity bridge; unknown-outcome
automatic rerun; HR acting as the normal transport/retry daemon (V2 boundaries).

Frozen boundaries = Own Principal, current visit, exact server identifiers,
successful transition receipt as commitment, one version-conflict reread/retry,
existing Assistance API only. No production writes, sends, replay, new API,
permissions, ledger resets, poller enablement or deployments.

Implementation scope = Correct existing instruction and broker description
field paths against raw live responses; name the existing assignee Assistance
tool and distinguish unavailable tools from successful case creation.
Out-of-scope = HR dispatcher implementation/replacement; installing existing
Assistance; owner identity choice; business-instance recovery.
New evidence = Raw response and calls listed below.
Need new/amended Spec = NO for these documentation/instruction corrections.
The HR execution-entry replacement has no confirmed accepted authority and is
therefore a separate proposed decision, not implemented by this candidate.

## Observed evidence

- Article publisher session `main/session.jsonl`, line 26020, captured response
  2026-10-20T02:12:54.345Z: envelope `detail`, fields
  `detail.current_node_visit_id`, `detail.outgoing_transitions[]`, and
  `detail.instance.workflow_state_version`. These are raw keys, independently
  reread; not just the normalized evidence file.
- c423 instance read selected transition `906bebb9-f86b-4d43-9bfe-619327584fae`;
  three historical calls used `906bebb9-f86f-4d43-9bfe-619327584fae` and received
  409. This proves a client identifier mismatch, not the precise server reject
  branch. No transition was retried during this investigation.
- b267: 16 sampled HR-triggered turns completed with no tool calls. Completion
  of the turn does not establish completion of the Workflow.
- Three sampled agent headers expose 77 tools and none named Assistance.
  Installed source is also missing the Assistance module present on main.
  Source correctness alone does not repair this installation gap.
- HR cron 2026-10-19T12:37Z: sends accepted before failed post-send ledger writes.
  Existing execute_round has pre-send claim protection, but that sampled
  execution path did not call it. Current ledger parser already handles the
  historical omitted-visit-key compatibility case; do not "repair" that again.
- content-ops 2bf advanced acquire -> validate -> curve_align. It is a control
  example, not evidence that every Workflow is stuck.

## Implementation plan

Goal: remove misleading execution instructions without changing execution
authority or pretending to deliver missing tools.
Architecture: pure deterministic prompt plus existing broker description.
Tech stack: JavaScript, node:test.
Spec: the accepted authorities named in DEVELOPMENT_PREFLIGHT.

1. Qoder DeepSeek-Flash writes focused failing tests in the isolated worktree.
2. Coordinator runs them and records actual failure.
3. Qoder corrects the instruction and existing tool description. Read current
   response paths, copy transition IDs verbatim, use existing assignee
   Assistance only when available; do not invent a case or successful escalation.
4. Run the focused suites and workflow-execution regression suite.
5. Independently review the final diff and record actual results below.

Review focus: real response envelope versus API prose; current visit changing
after reread; exact ID reuse; missing Assistance; existing one-retry and
unknown-outcome boundaries. These tests validate instructions, not model
compliance or production business completion.

## Remaining delivery work

The HR Dispatcher proposal in the old shared checkout is `proposed`, not an
accepted implementation contract. A new HR send adapter would also contradict
V2's boundary that HR is not the normal dispatch/retry daemon.

The smallest coherent next action is to establish the authoritative runtime and
its WEC execution lane, then deliver the already implemented Assistance closure
through the existing deployment process. HR should observe and handle management
exceptions. A temporary HR lane, if needed before that cutover, needs an explicit
bounded authority and single-writer handoff; merely adding another adapter is
not an approved repair.

Until installation/load and a separately authorized business canary are proven,
production progress remains UNVERIFIED. This candidate does not change it.

## Verification and SPEC_COMPLIANCE

Qoder was invoked with requested model `DeepSeek-Flash`, only Read/Edit/Write,
no MCP servers, no shell tool, no session persistence, and zero model retries.
It wrote the tests and implementation; the coordinator ran tests and verified
raw response evidence. The CLI did not independently attest the backend model
or token usage.

- Corrected final tests against archived baseline source: 3 original pass,
  4 new regressions fail. Candidate instruction tests: 7/7 pass.
- Workflow-execution suite plus broker transition and Assistance suites:
  233/233 pass under Node v26.7.0.
- First combined run had 150 passing tests and 4 file-load failures due to
  missing vendor dependencies in the fresh worktree. The rerun above used
  existing local test dependencies, with all @agent-core links pointing to this
  worktree. No installation script or production package was modified.
- Unchanged HR scripts copied into a separate temporary directory:
  41/41 tests pass. This is baseline validation, not proof of live entry usage.
- Raw outputs: `/tmp/workflow-repair-20261020/corrected-red.txt`,
  `candidate-tests-with-deps.txt`, and `hr-baseline/test-output.txt`.
- Repository structure gate returns STRUCTURE_VIOLATION: 11 violations and
  106 warnings. Running the same checker on the unchanged base returns the
  exact same findings array. This candidate introduces no additional finding;
  the repository-wide gate itself remains failing, not waived or called PASS.
  Evidence: `structure-baseline.json` and `structure-candidate.json` in the
  same temporary evidence directory.

Referenced Spec = accepted authorities in DEVELOPMENT_PREFLIGHT.
Implemented scope = existing instruction and description corrections only.
Acceptance criteria evidence = raw response paths, final diff, red/green tests.
Out-of-spec behavior = NONE.
Rejected alternative accidentally reintroduced = NO.
Frozen boundaries respected = YES.
New architectural decision introduced = NO.
Knowledge artifacts needing update = this investigation; HR workspace guidance
and Assistance deployment closure remain unapplied candidates.
SPEC_COMPLIANCE = PASS for this source candidate only.

Independent review: no ship blockers in the bounded source change. Qoder's
review was checked against raw evidence and the final instructions. The
coordinator adopted its useful test-isolation observation: transition CAS
assertions now match the transition instruction rather than being satisfiable
by the Assistance instruction. Focused tests were rerun after that adjustment.

Unapplied companion documents:

- [HR guidance candidate](../evidence/workflow-progress-repair-20261020/HR-GUIDANCE-CANDIDATE.md)
- [Assistance release closure](../evidence/workflow-progress-repair-20261020/RELEASE-PACKET.md)

These documents are not deployment approval and do not establish a new HR
dispatcher implementation contract.
