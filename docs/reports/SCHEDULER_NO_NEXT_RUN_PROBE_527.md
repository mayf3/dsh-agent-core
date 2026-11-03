# #527 no-next-run probe — bounded change record

Current status is in the **Fix continuation verification** section below. The
original stop record is retained as history; its STOP status is not the resumed result.

## PREFLIGHT (2026-11-03)

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
TARGET_REPOSITORY = mayf3/dsh-agent-core
REVIEW_TARGET_HEAD = ce1d13c1e8585759c6a5f194fb5553d990574b5b (initial)
BASE_HEAD = ce1d13c1e8585759c6a5f194fb5553d990574b5b
CURRENT_BASE_HEAD = ce1d13c1e8585759c6a5f194fb5553d990574b5b
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
GOAL_OR_TARGET = enabled Jobs lacking nextRun / any remaining run produce an actionable watchdog incident
CURRENT_GAP = canonical health can have nextExpectedAt=null with no actionable detector fact
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1@0557bd9cc107e7ded05dce6c1a43633b11e779b4
RELATED_AUTHORITIES = SCHEDULER_CONTROL_PLANE_RELIABILITY_V1@5546aa3b4c8587d99e4d44c53fe3cba14c5d2b31; D-009; SCHEDULER_TIMEOUT_OUTCOME_V3
IMPLEMENTATION_AUTHORITY = contracts
ATOMIC_SPEC_IMPLEMENTATION_PERMITTED = NOT_APPLICABLE (REUSE)
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID
MUTATION_AUTHORIZATION = VALID
ISOLATED_WRITE_SURFACE = YES (/tmp/dsh-527-probe; ac-527-no-next-run-probe; sole writer)
CONTROLLED_RUNBOOK_REQUIRED = NO (source/tests/PR only)
SPEC_GAP_DEPENDENCY = NONE
EVIDENCE_REVIEWABILITY = PASS (reproducible local fixtures and retained raw logs)
LIVE_AUTHORITY_GAP = NONE (production not queried)
OWNER_DECISION_REQUIRED = NO
EMERGENCY_STATE = NONE
EMERGENCY_ACTION = NONE
INCIDENT_REFERENCE = #527
BASE_IMPACT = BOUNDED
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (tests/review pending; merge outside this mandate)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = focused RED/GREEN; normal/in-flight/retry/fence exclusions; notification lifecycle; baseline/candidate named failure diff; structure delta; independent review
DONE_WHEN = implementation PR + #527 receipt with authority, actual tests, and exact SHA
EXPANSION_TRIGGER = new policy/threshold/router/dependency/admission semantics or concrete semantic regression
NEXT_REAL_ACTION = test and complete the canonical health detector and its existing notification path
NEXT_ACTION = CONTINUE
```

Authorization: [Owner ruling 6591295098](https://github.com/mayf3/dsh-agent-core/issues/527#issuecomment-6591295098)
and `/tmp/dispatch-527-probe.md`, renewed by the 2026-11-03 continuation request.
Source changes, isolated tests, push, PR, and issue receipt are in scope. Production writes,
deployment, merge, receipt-window changes, and fence changes are outside scope.

Authority basis: accepted `CTR-HEALTH-001` requires one pure projector for watchdog/startup/API/read
tools and `DEGRADED` for schedule defects; `CTR-INCIDENT-001`, `CTR-ALERT-001`, and `CTR-ROUTE-001`
already govern exact job/revision identity, no-repeat lifecycle and authorized control-plane routing.
Reliability V1 §5.5 is an open minimum detector list and §5.6 supplies W1's <=300s cadence and
proactive alerting. D-009 is an occurrence Decision, not standalone implementation authorization.
`ADC_MECHANISM_IMPLEMENTATION_V1` is absent from this repository; the directly applicable accepted
watchdog authority above supplies the coverage. No amendment is needed for this bounded defect
detection; no new severity, escalation threshold, route, or durable field is introduced.

Observation: W1 consumes `createSchedulerHealthRuntime().read().findings`, not the legacy
`evaluateRunHealth()` helper. `canonicalJobFindings()` currently detects missed slots only when a
slot can be derived. A legal never-firing cron has no such slot, and a missing projection before its
next due slot may still look healthy. The implementation belongs in the canonical projector.

Implementation scope: reuse the existing `JOB_CONFIGURATION_INVALID` incident category. Missing
`state.nextRunAtMs` is reported as a projection observation, never proof of inability to execute:
definition + ledger remain admission authority (C-030). Check the existing retry-aware next-run
computation separately for a schedule with no remaining execution opportunity. Disabled jobs,
currently admitted/running jobs, and unresolved UNKNOWN jobs do not generate a second probe
incident. Existing fence/stuck/missed findings remain unchanged. The existing W1 timer, incident
store, C11-R4 projection, and canonical ops route are reused; no dependencies are added.

`命名集 diff=∅` is evaluated as the exact baseline/candidate failing-test-name set difference;
structure finding keys are reported separately. A new probe test is expected RED on base and is
excluded from the pre-existing-test regression comparison.

## Validation and conformance

**STOPPED_WITH_EVIDENCE / CONCRETE_REGRESSION**. Implementation stopped at the first genuine
semantic regression from the candidate full Scheduler suite. No source repair was attempted after
that failure, pursuant to the task's fail-stop boundary. No commit, push, PR, merge or deployment
has occurred; the requested successful PR delivery is not complete.

Raw evidence directory: `/tmp/dsh-527-probe-evidence/`.
Baseline worktree: `/tmp/dsh-527-probe-baseline` at the exact Base above. Both worktrees resolve the
same existing `/tmp/ac720-test-deps/node_modules` (croner 10.0.1) during test execution; dependency
bytes are not changed. The candidate's task-created dependency symlink was removed after stop.
Runtime, installation and business acceptance remain NOT_RUN.

| Observation | Actual result | Evidence |
|---|---|---|
| Final probe tests against exact base source | rc=1, 4 pass / 5 fail / 9 total (expected RED) | `probe-red-final.tap` |
| Probe tests against candidate | rc=0, 9 pass / 0 fail | `probe-green.tap` |
| Baseline full Scheduler package | rc=0, 433 pass / 0 fail | `scheduler-baseline.tap` |
| Candidate full Scheduler package | rc=1, 441 pass / 1 fail / 442 total | `scheduler-candidate.tap` |
| Baseline health-runtime / health-API / health-HTTP consumers | rc=0, 17 pass / 0 fail | `health-consumers-baseline.tap` |
| Candidate same health consumers | rc=0, 17 pass / 0 fail | `health-consumers-candidate.tap` |
| Scheduler failing-test-name comparison | added=1, removed=0; **diff is not empty** | `STOPPED-RECEIPT.json` |
| Health-consumer failing-test-name comparison | diff empty | `STOPPED-RECEIPT.json` |
| Candidate structure gate | NOT_RUN after semantic stop | no PASS claim |

The first GREEN attempt had a test-helper protocol error (`PENDING -> DELIVERED` bypassed the
required durable `OUTCOME_UNKNOWN` attempt stamp). Only that fixture was corrected; its raw failure
is retained in `probe-green-fixture-correction.tap`. The final test file was then run against base
source again for a final, matching RED observation. This fixture correction preceded the full-suite
semantic stop.

### Frozen blocker: P527-HEALTH-THROW

- Class: `CONCRETE_REGRESSION` / `CONTRACT_VIOLATION`.
- Source: accepted `CTR-HEALTH-001`: invalid/incomplete authority must project `UNKNOWN` and
  `complete=false`; existing test T18 exercises the invalid-cron branch.
- Counterexample: enabled Job with `schedule={kind:'cron', expr:'not cron', tz:'Asia/Shanghai'}`.
  Base returns a health row with `health='UNKNOWN'`; candidate `nextRunProbe()` calls
  `computeNextRunAtMsV2()` before preserving the invalid-authority path and lets the Cron parser
  TypeError escape from `canonicalJobFindings()`.
- Impact: canonical health read throws instead of returning the required incomplete/UNKNOWN
  surface. This is an actual behavior change, not a missing path, dependency, or harness problem.
- Evidence: `scheduler-candidate.tap:2275` (failure and stack through `health.js:46/58`);
  exact baseline test passed in `scheduler-baseline.tap`.
- Minimal closure for a later authorized continuation: preserve the projector's existing invalid
  authority / UNKNOWN boundary before evaluating the probe, then prove T18 and the bounded probe
  cases together. This report does not implement that closure.
- Affected readiness: implementation and merge = NO; production = NO.

### Frozen blocker: P527-AT-CATCHUP-FALSE-POSITIVE

- Class: `CONCRETE_REGRESSION`.
- Source: mandate requires normal Jobs not to false-positive; D-009 preserves the existing native
  one-shot catch-up policy (`eligibility.js`: `DEFAULT_AT_CATCHUP_GRACE_MS=15min`).
- Counterexample: enabled one-shot due at `now-60s`, created at `now-1h`, no occurrences, finite
  cached `nextRunAtMs=due`. The existing `naturalCandidate()` still returns `due=true`; the
  next-run projection helper returns `undefined`, and the new probe incorrectly emits
  `JOB_CONFIGURATION_INVALID / no_remaining_run`.
- Impact: a normal Job still eligible for native execution is told it has no remaining run and
  requires operator action. This is a reachable false-positive, not merely an optional hardening
  request.
- Minimal closure for a later authorized continuation: preserve the existing catch-up eligibility
  in probe classification without adding a new grace policy. No repair performed after stop.
- Affected readiness: implementation and merge = NO; production = NO.

Independent reviewer `/root/probe_authority` did not author the source/tests and independently
confirmed both counterexamples against the frozen source hashes. Authority routing remains
`REUSE` (no Spec gap); affected-contract verdict is `REVISE / STOP`, not PASS.

```text
FROZEN_BLOCKER_UNION = [P527-HEALTH-THROW, P527-AT-CATCHUP-FALSE-POSITIVE]
SPEC_GAPS = 0
INDEPENDENT_REVIEW = REVISE
```

Frozen candidate source SHA-256:

```text
health.js = f5d56fe1a82a29af278d06127ccce9e0778a3929363d132cecaa2842218ba588
delivery.js = 4982a6e13e4d4926c52ecc4cd4dd03b3ac0967db994112b11a0ba3ab1802a2e4
no-next-run.test.js = df7900bb2a8a4a6d63fc7134ac19fdb2500a0ea9c97fce186b23d1bd8621af58
```

The source patch and exact three files are copied in the evidence directory, bound by
`STOPPED-RECEIPT.json`. HEAD remains the Base, and source is uncommitted. Raw logs and per-command
JSON retain command, worktree, timestamps, rc and actual counts.

```text
SPEC_GOVERNANCE_MODE = COMPLIANCE
PRIMARY_AUTHORITY = SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1
AUTHORITY_REVISION = 0557bd9cc107e7ded05dce6c1a43633b11e779b4
IMPLEMENTATION_BASE_COMMIT = ce1d13c1e8585759c6a5f194fb5553d990574b5b
IMPLEMENTATION_COMMIT = NOT_COMMITTED (Base + frozen file hashes above)
ENVIRONMENT = isolated local worktrees; existing croner 10.0.1; no real endpoints
EVALUATED_AT = 2026-11-02T23:52:31.998936+00:00
ASSURANCE_LEVEL = DURABLE
REVIEW_SCOPE = AFFECTED
EXECUTION_MANDATE = VALID
RECEIPT = /tmp/dsh-527-probe-evidence/STOPPED-RECEIPT.json
IMPLEMENTATION_STATE = IN_PROGRESS (frozen)
VERIFICATION_STATE = PARTIAL
CONFORMANCE_RESULT = DRIFTED
DONE_WHEN_MET = NO
EXPANSION_TRIGGERED = YES (concrete semantic regression)
IMPLEMENTATION_READY_TO_MERGE = NO
OPERATION_COMPLETE = NOT_APPLICABLE
NEXT_ACTION = STOP
```

Affected-contract evaluation: `CTR-HEALTH-001=DRIFTED`; bounded probe cases for
`CTR-INCIDENT-001`, `CTR-ALERT-001`, `CTR-ROUTE-001`, and reliability V1 §5.6 cadence are verified
only by the isolated focused observations, not product completion or runtime admission. Independent
affected-surface stop diagnosis confirmed the two blockers above; no independent PASS is claimed.
Reviewer-returned command, result and explicit timestamp limitation are preserved as
`independent-stop-review.json` and `at-catchup-counterexample.mjs` in the evidence directory.

## Authorized fix continuation (2026-11-03)

The user renewed execution via `/tmp/dispatch-527-fix.md`: repair the two frozen
blockers with RED→GREEN, retain the probe, compare named Scheduler failures against
the 433/433 baseline, then commit, push, open a PR bearing #527 and post its receipt.
No merge, deployment or production mutation is authorized. Historical stop evidence
above remains unchanged. Contrary to the brief shorthand, the observed starting HEAD
is still `ce1d13c1e8585759c6a5f194fb5553d990574b5b`; the probe is uncommitted. Its three
source hashes exactly match the frozen receipt.

```text
SPEC_GOVERNANCE_MODE = PREFLIGHT
REVIEW_TARGET_HEAD = ce1d13c1e8585759c6a5f194fb5553d990574b5b + frozen source hashes
BASE_HEAD = ce1d13c1e8585759c6a5f194fb5553d990574b5b
CURRENT_BASE_HEAD = ce1d13c1e8585759c6a5f194fb5553d990574b5b (local integration snapshot)
GOAL_OR_TARGET = close P527-HEALTH-THROW and P527-AT-CATCHUP-FALSE-POSITIVE, deliver the probe PR
CURRENT_GAP = invalid cron escapes UNKNOWN boundary; legal native one-shot catch-up is misclassified
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 / CTR-HEALTH-001
RELATED_AUTHORITY = accepted SCHEDULER_OCCURRENCE_OUTCOME_V3 / D-009 section 13.1
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
IMPLEMENTATION_AUTHORITY = contracts
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
EXECUTION_MANDATE = VALID (/tmp/dispatch-527-fix.md; user continuation)
ISOLATED_WRITE_SURFACE = YES (/tmp/dsh-527-probe; ac-527-no-next-run-probe; root sole writer)
SPEC_GAP_DEPENDENCY = NONE
IMPLEMENTATION_ALLOWED = YES
MERGE_READY = NO (verification and independent affected-contract review pending)
OPERATION_ALLOWED = NO
EVIDENCE_NEEDED = separate RED/GREEN; probe 9/9; full Scheduler named-failure equality; health consumers; structure delta; independent review
DONE_WHEN = commit + push + PR bearing #527 + issue receipt with exact SHA and evidence
EXPANSION_TRIGGER = any new genuine semantic failure, authority conflict, or required gate failure
NEXT_ACTION = CONTINUE
```

Plan: (1) preserve regression RED and fix the invalid-authority projection boundary;
(2) preserve regression RED and reuse native eligibility for unrecorded one-shot
catch-up, retaining missing-cache observations; (3) run frozen probe, Scheduler
package and consumer gates, compare exact failure-name sets, review the bounded
delta independently, then deliver commit/push/PR/issue receipt. Expected RED and
unchanged baseline failures are recorded rather than misrepresented as new regressions.
New continuation evidence is retained at `/tmp/dsh-527-fix-evidence/`.

## Fix continuation verification

Both frozen blockers are repaired in the bounded canonical health surface:

- **P527-HEALTH-THROW:** `projectSchedulerHealth()` now passes authority validity
  separately from snapshot completeness. Invalid authority yields incomplete
  `UNKNOWN` rows without re-parsing invalid schedules for findings; valid authority
  with incomplete generation evidence retains its diagnostic findings.
- **P527-AT-CATCHUP-FALSE-POSITIVE:** both schedule readiness and the probe reuse
  `naturalCandidate()` for an `at` Job with no occurrence records. This retains
  native activation and 15-minute grace semantics; it changes no admission, retry,
  grace, fence or production policy. The exact grace boundary is eligible; 1ms
  beyond it and slots at/before activation are not. A finite cached next-run value
  yields HEALTHY during valid catch-up. Missing cache still reports only the
  C-030 `next_run_projection_missing` observation. Existing records cannot gain
  a new catch-up exemption.

The 9-test probe is retained. Its failed-occurrence fixture now carries the required
`terminalEvidence` and asserts complete authority for the retry case, preventing a
vacuous no-probe assertion on malformed authority. No notification behavior changed.
The new regression file contains six behavioral cases, including negative boundaries.

| Executed observation | Result | Raw log |
|---|---|---|
| Invalid-cron regression against frozen probe | rc=1; 0/1 PASS, expected parser TypeError | `invalid-cron-red.tap` |
| Invalid-cron fix + original T18 + incomplete-generation finding | rc=0; 3/3 PASS | `invalid-cron-green.tap` |
| Catch-up RED after correcting terminal-record fixture | rc=1; 2 PASS / 2 expected FAIL | `at-catchup-red-final.tap` |
| Final six regressions | rc=0; 6/6 PASS | `at-catchup-green.tap` |
| Final same-file probe against exact base source | rc=1; 4 PASS / 5 expected FAIL | `probe-base-red-final.tap` |
| Final probe against repaired candidate | rc=0; 9/9 PASS | `probe-green.tap` |
| Full Scheduler baseline, serial worktree execution | rc=0; 433/433 PASS | `scheduler-baseline-serial.tap` |
| Full Scheduler candidate, serial worktree execution | rc=0; 448/448 PASS | `scheduler-candidate-serial.tap` |
| Health runtime / API / HTTP, baseline and candidate | rc=0; 17/17 each | `health-consumers-{baseline,candidate}.tap` |

Scheduler named-failure comparison: baseline `[]`, candidate `[]`, added `[]`,
removed `[]`; **diff=empty**. Candidate adds the retained nine probe tests plus six
regression tests to the existing 433. Consumer failure-name sets are also empty.

Portable evidence: [verification-receipt.json](../evidence/scheduler-no-next-run-527/verification-receipt.json)
and [raw-logs.tar.gz](../evidence/scheduler-no-next-run-527/raw-logs.tar.gz). Receipts
retain actual commands, worktrees, timestamps, exit codes, counts, failing names,
final source SHA-256 and archive SHA-256. Raw local evidence remains under
`/tmp/dsh-527-fix-evidence/`; earlier stop evidence remains untouched under
`/tmp/dsh-527-probe-evidence/`. The retained runner initially parsed TAP only; npm
selected the spec reporter, so npm observations were re-extracted from their raw
logs for both counts and names. Their true rc=1 results were never accepted as PASS.

### Retained failed attempts and scope limits

The first catch-up RED run also had one malformed test fixture lacking the
mandatory failed-occurrence terminal evidence. That fixture alone was corrected
before the final matching RED and implementation. `at-catchup-red.tap` retains
the original 1 PASS / 3 FAIL result.

The first simultaneous Scheduler baseline/candidate runs overlapped supplemental
root `npm test`. They both exited 1: baseline 422 PASS / 11 FAIL / 433 total; candidate
437 PASS / 11 FAIL / 448 total. Their failure-name sets differ by one addition and
one removal; those observations are **not** equal-set or passing results.
Candidate-only: `C11-R1 one-shot semantics preserved: a settled late outcome disables
the one-shot job, never replays it`; baseline-only: `row 10: Router availability and
Scheduler recurring-job availability are reported separately`. Full names and logs
are retained in the receipt/archive, including all unchanged failures.

Independent read-only analysis established that both failures occur while seeding
occurrences, before any canonical health call. Both worktrees have byte-identical
seed tests, harness, Scheduler, eligibility, occurrence and store code. The shared
harness freezes a clock before asynchronous startup but uses real time for create;
its tests then advance the frozen clock by only 61 seconds. A create delay above
1000ms makes the first minute slot not due, producing the observed undefined seed.
A pure-function check reproduced this boundary identically in both trees. The
original runs did not record the actual clock delta, so the specific environmental
trigger remains UNKNOWN. No test or admission code was changed to mask it. After
the root run ended, the fresh serial full-package observations above both passed.

Supplemental root `npm test` ran **on base only**: 3181 reported tests, 2999 PASS,
146 FAIL, 36 SKIP, rc=1. It stalled in two unrelated baseline test processes; only
those exact test children were terminated (see `root-baseline-interruption.json`).
This observation is incomplete, is not a candidate comparison or repository-wide
PASS, and creates no claim that all repository tests pass. All 146 failure names
are retained in the receipt and `root-baseline-failed-names.txt` in the archive.

Remote main was freshly read as `334e5036a11be1b23ff382d2e70cfa6ad4a5e62e`. Its
only change from the task base is the unrelated D-008 switch-source Decision; the
affected Scheduler source and governing D-009/watchdog authorities are unchanged.
The task base stays fixed; no rebase or merge was performed.

Source/isolated mechanism evidence only. Installation, runtime activation, listening
or live business acceptance are NOT_RUN; production mutations, merge and deployment
remain outside this mandate. Structure and independent final-candidate review are
recorded below when complete.
