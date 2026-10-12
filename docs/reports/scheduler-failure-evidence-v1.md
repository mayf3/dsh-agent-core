# Generic terminal failure evidence repair

Attributable task authorization: the Owner's 2026-10-12 request in this chat:
"对于 hr 应该是失败了就跳过，下一次还能正常执行调度 ... 通用的修复，而不是 hardcode 了 hr 的 agent".
This bounded source repair and isolated verification implement the already accepted
terminal-failure behavior. Production installation and historical occurrence
settlement are separate operations outside this task's execution effects.

## Change Brief / DEVELOPMENT_PREFLIGHT

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = fa4510beb6b01e5c40000a2ae36a62c526759e76 plus isolated working diff
BASE_HEAD = fa4510beb6b01e5c40000a2ae36a62c526759e76
CURRENT_BASE_HEAD = fa4510beb6b01e5c40000a2ae36a62c526759e76
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = terminal failure ends one occurrence; future natural scheduling continues for arbitrary Agents
CURRENT_GAP = failed caller evidence is snapshotted before durable settlement and terminal field updates
OBSERVATIONS = real installed modules reproduce failed/null proof -> UNKNOWN; main producer has the same ordering
WORKING_GUESS = exact v6 durable Router snapshot still unreadable; not a premise for the generic repair
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = AGENT_PROCESS_LIFECYCLE_HARDENING_V4@r0 C-010/C-015/C-018
RELATED_AUTHORITIES = SCHEDULER_TIMEOUT_OUTCOME_V3 C-004/C-009/C-028
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NO
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES
CONTROLLED_RUNBOOK_REQUIRED = NO
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS
LIVE_AUTHORITY_GAP = NONE
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = agent-control#547 and user-provided occ:d62eb7d3c3b891c0
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = producer RED/GREEN; real process/bridge/store/Scheduler next-natural and peer isolation; affected regression; independent delta review
DONE_WHEN = committed failure evidence matches durable exact proof; generic recurring next slot and peer succeed without retry or manual recovery
EXPANSION_TRIGGER = a required change to unknown semantics, retry policy, public enums, identity or durable schema
NEXT_REAL_ACTION = add failing evidence assertions, move snapshot after successful settlement, verify
NEXT_ACTION = CONTINUE
```

Rejected alternative: termination proof alone must not become business failure.
Known failed envelopes are already preserved by the current bridge (PR #299);
this repair additionally fixes the producer's stale/null proof for existing
consumers. No Agent identity or provider error-code branch is added.

Plan:
- [x] Pin caller proof and terminal phase; verify the old producer fails.
- [x] Move only the failed-branch evidence snapshot after durable settlement and terminal stamps.
- [x] Verify arbitrary Agents, retry absent/false, next natural slots, peer isolation,
      durable-settlement failure, existing bridge compatibility and affected regressions.
- [x] Independently review the bounded diff and record source/runtime limits.

## Cause and scope

The reproducible generic defect is in
`packages/agent-router/src/process/event-correlation.js`'s direct-failure branch.
It builds `error.evidence` before `settleDirect()` and before stamping
`execution.terminationEvidence` and `execution.phase`. The caller receives
`terminationEvidence:null, phase:running` while the Router store already says
`outcome:failed, terminationEvidence:exact_terminal_then_idle`.

The installed bridge requires that proof to preserve the error as an ordinary
failure. Without it, the bridge returns `outcome_unknown`; Scheduler then fences
the recurring job, preventing future natural slots. The current main bridge
already preserves authoritative failed envelopes (PR #299), but the producer
still violates the evidence contract. Fixing the producer also restores the
existing bridge's exact-turn terminal-failure path.

The only production-source change moves the snapshot below successful durable
settlement and the terminal stamps. It does not add an Agent ID, provider code,
error-message whitelist, new retry, fence deletion, replay, or schema change.
If persistence fails, terminal proof is not published to the caller. Exact
correlation, ordered terminal-then-idle proof, and genuinely unknown outcomes
retain their existing semantics.

This is a Scheduler job liveness failure, not evidence that the entire Scheduler
process crashed: the peer job continues in the acceptance tests, and the supplied
production snapshot reports the separate daily archival job succeeded. HR's
Dispatcher is a workflow dependency, so its job-local fence can stall the
workflows that depend on it.

## Verification evidence

Environment: isolated branch `codex/scheduler-failure-evidence-20261012`, base
`fa4510beb6b01e5c40000a2ae36a62c526759e76`, Node `v26.7.0`. Installed root dependencies
using `npm install --ignore-scripts --no-package-lock` only in this worktree.
The fixtures run the real AgentProcess class with a controllable fake OS child,
the real bridge and Scheduler, and temporary durable Router/Scheduler stores.
They do not prove a real child boot or production business E2E.

Before the production edit:

- Correlation regression: 9 PASS / 2 FAIL; both new terminal-proof assertions
  received `null` instead of `exact_terminal_then_idle`.
- Real AgentProcess -> current bridge -> Scheduler: 0 PASS / 2 FAIL at the
  caller-proof assertion, despite the durable Router record being failed.
- The same test importing the installed bridge: 0 PASS / 2 FAIL because the first
  occurrence became `outcome_unknown` rather than `failed`.

After the edit:

- Correlation and the initial next-slot regression: 13/13 PASS.
- Final acceptance file: 3/3 PASS against the installed bridge, independently
  repeated by the reviewer. The test-only module override imports that file;
  all processes, jobs and stores are local disposable fixtures, not production.
- Affected regressions: **531/531 PASS**, zero failures or skips. Command:
  `node --test --test-concurrency=1 packages/scheduler/test/*.test.js packages/scheduler/test/*/*.test.js packages/scheduler-router/test/*.test.js`
  plus AgentProcess lifecycle `correlation`, `late-settlement`, `timeout`,
  `pipe-failure`, `rpc`, `shutdown`, `unknown-fence-no-replay`,
  `unknown-fence-repair`, `evidence-caps`, and `auto-recovery-v3-persistence` files.
  Raw log: `/tmp/scheduler-failure-evidence-20261012-affected-test.log`.
- Positive acceptance uses two arbitrary Agent IDs and two different provider
  errors, with retry absent and `retry.auto:false`. It reopens the Router's
  temporary disk store and checks the exact failed proof. It checks concurrent
  ticks, no retry between natural slots, `failed -> succeeded` at the exact next
  nominal slot, immutable previous occurrence, fresh occurrence/request/session,
  one prompt per natural occurrence, no process kill, and continued peer success.
- Negative acceptance uses a real caller-bound expiry with no terminal proof:
  Router stays pending, Scheduler keeps only that job fenced, does not replay its
  prompt at the next slot, and the peer completes both natural slots.
- Full `npm test` was attempted but is **not a passing full-suite result**.
  It encountered missing workspace/DSH/Feishu dependencies, Harness setup
  failures, broker seam failures, and a real production-profile boot test's
  90-second timeout. The incomplete run was stopped rather than changing unrelated
  environment or product surfaces. Log:
  `/tmp/scheduler-failure-evidence-20261012-full-test.log`.
  Independent comparison at the exact clean base reproduced the two selected
  broker seam failures identically (0 PASS / 2 FAIL in both base and candidate):
  existing assertions expect older error text instead of canonical readback's
  `STILL_UNKNOWN` details. The probe confirmed one create plus one list readback,
  with no mutation replay. Those files are unchanged by this candidate.

`EVD-SFE-001`: the RED/GREEN caller assertions support Lifecycle V4 C-010/C-015;
`EVD-SFE-002`: the temporary disk readback and persistence-failure fault support
C-018; `EVD-SFE-003`: next-slot and UNKNOWN-isolation acceptance plus affected
regressions support Timeout V3 C-004/C-009/C-028. Sufficiency is bounded to this
source delta at the pinned base, not live incident closure.

## Independent review and integrity

Independent reviewer `/root/spec_contract` did not author the source or tests.
Review: PASS, no must-fix findings; existing accepted implementation Contracts
and the user mandate cover the one-line move, with no new/amended Spec required.
The reviewer independently ran 31/31 lifecycle/acceptance tests and the installed
bridge compatibility's 3/3 tests. Reviewed source SHA-256:
`47693d4d79af4e0643078e4f178bd341457b8418c07892d1a65d846f07af58bc`.
Final acceptance test SHA-256:
`b22b3630a352dad89f20dc9d899dcb225a375bb3ffce3fa0f32a52a264897afc`.

`git diff --check`: PASS. `python3 .agents/tools/verify_governance.py --target .`:
PASS, vendored bytes match the lock. The optional `--require-accepted` check
fails because the governance adoption V3 and lock remain **proposed**. This
report does not activate or rely on that proposal as accepted implementation
authority; the product repair reuses already accepted Lifecycle/Timeout Specs.
The prior accepted adoption V2 remains the active local governance authority.
No governance or Spec files are changed. Structure verification at implementation
commit `b148068ba39959a7e12b3e9b7e06471a57435875` reports 10 violations; an
independent exact base-vs-base check reports the same 10 with identical directory
counts. **No new or worsened structure violations** were introduced. The edited
source is 422 lines, edited correlation test 244 lines, and new acceptance test
190 lines. Raw JSON files:
`/tmp/scheduler-failure-evidence-20261012-structure-base.json` and
`/tmp/scheduler-failure-evidence-20261012-structure-candidate.json`.
The final documentation-only amendment preserves all reviewed code/test hashes.
Merge and deployment have not been performed; full-suite/structural baseline
limits are not represented as passing gates.

## Production evidence and remaining work

These observations explain why repeated job version replacement has not repaired
the underlying chain; they do not claim the production incident is settled:

- System runtime PID 39856 declared deployed SHA
  `d602b592fad345fb1c9adebe2bc6611a6f5cfdc2`, but the readable installed bridge's
  SHA-256 was `b8ca13b573edf586dfd90060e05dde6678a793fa9ad032d9e458ffea89548bbe`
  and its content did not match that declared revision. The installed producer
  also has the snapshot-order defect. A consistent, verified artifact installation
  is required; a job rename or new v7 does not repair those modules.
- The readable v6 session for `occ:d62eb7d3c3b891c0` has an exact `turn/end`
  with `PI_AI_ERROR: Internal Server Error` at its last row. The canonical Router
  durable record and Scheduler store were permission-denied to this investigation.
  Therefore the exact production correlation/idle proof remains unverified;
  the isolated generic reproduction, not an invented production disposition,
  establishes the evidence for the source repair.
- The supplied/readable status reports v5 disabled/fenced and v6 enabled/fenced,
  `activeFenceCount:2`, `unresolvedUnknownCount:2`, and no reconciliation candidate.
  The old self-ops classifier does not accept a direct failed Router disposition
  as its automatic late-settlement case. A source repair does not retroactively
  transform either historical UNKNOWN or remove their fences.
- The HR recurring job's recorded policy has `retry.auto:true`. The requested
  behavior of skipping the failed round and waiting for the next natural slot
  uses the existing generic configuration `retry.auto:false` (or no retry policy).
  This repair deliberately does not overwrite explicit retry policy globally or
  mutate the production job. Changing that job configuration must use its normal
  authorized update surface, with readback.

Relevant issue history: [PR #299](https://github.com/mayf3/dsh-agent-core/pull/299)
preserves failed envelopes; [Issue #417](https://github.com/mayf3/dsh-agent-core/issues/417)
addresses late reconciliation; [Issue #425](https://github.com/mayf3/dsh-agent-core/issues/425)
and [Issue #426](https://github.com/mayf3/dsh-agent-core/issues/426) address specific
restart/lifecycle paths. [PR #504](https://github.com/mayf3/dsh-agent-core/pull/504)
is an unintegrated unsupported-disposition diagnostic helper, not an implemented
recovery/settlement/fence-release mechanism.
[agent-control Issue #547](https://github.com/mayf3/agent-control/issues/547)
records HR recurrence/version work; recent comments take precedence over stale
body summaries.
Existing work should be integrated and verified against the exact installed
artifact rather than reimplemented or treated as production proof.

To complete production recovery: install the reviewed consistent artifact;
read back the actual module provenance; settle each old fence only through an
accepted exact-evidence recovery route; configure the requested retry policy;
then observe a real failed round followed by the next natural successful slot and
a continuing independent job. No such deployment, reconciliation, retry, reset,
or production configuration change was executed in this task.
