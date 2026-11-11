# STOPPED — #605 R2 compatible reader and writer guard

STATUS = STOPPED_REQUIRED_TARGETED_SUITE_RC1
Observed at: 2026-11-07T11:50:26.286481+08:00

## Coordinates, mandate and stop condition

- Worktree: `/private/tmp/h605-r2`; repository `mayf3/dsh-agent-core`.
- Branch: `fix/compat-reader-writer-guard`; HEAD/base: `4f7df01bcf087075c114901a96a7a54573110f61`.
- Owner authorization: BRIEF-605-R2 and original read-only
  `/private/tmp/h605-compat/BRIEF-605-COMPAT.md`, product lane #605 plus standing
  preauthorization V1 section 1. Source/tests and unmerged PR preparation only.
- Binding instruction: “失败即停写 STOPPED-605-R2.md”. The permitted
  stale-quiescence version-sensitive assertion noise does not describe the
  observed prompt pre-write deadline failure below.
- No required gate was rerun after its failure. This file is the only repository
  write after that failure; remaining actions were read-only evidence/hash checks.

## Prerequisite gate PASS; old stop is closed

`489ce93b3d075e51a28430f619b902077999d910` (#642) is an ancestor of this base.
The lock is accepted `2.0.0-rc.3`; validator lines 58–67 and 195–214 support
list-containing-object correction. TE_V1 frontmatter is superseded,
supersedes=[] and superseded_by=CODE_STRUCTURE_GUARDRAILS_V3; accepted V3 names
both V2 and TE_V1, with reciprocal predecessor backlinks.
Fresh GitHub connector read of #642 issuecomment-6701773166 confirms final
independent review, six conditions met, and merge 489ce93b. Historical pending
text is not treated as a new authority gap.

Actual original-TE frontmatter was obtained by `git show 3c1bcf98:docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md`;
only its supersedes was changed in a temporary JSON candidate. The current
unmodified CLI with `--format-correction-spec CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1`
returned rc=0:

```text
old TE from git show 3c1bcf98; only supersedes -> []
FORMAT_CORRECTION: CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.supersedes -> []
Spec transition is a valid whole-authority lifecycle state

rc=0
```

`python3 .agents/tools/verify_governance.py --target . --require-accepted` rc=0:

```text
vendored governance bytes match governance.lock.json and adoption is accepted

rc=0
```

## Actual source changes (uncommitted; no delivery PASS)

- Exact legacy tuple is decoded without normalizing original durable facts;
  query snapshot derives `legacyFormat=unproven_fence_clear` and recovering state.
- Agent admission quarantines this tuple before cleared/abandonment skipping;
  normal active-fence abandonment behavior remains unchanged.
- Startup `markRecoveryBlocked` leaves this historical tuple untouched.
- `markFenceCleared` now throws `RECONCILIATION_FENCE_CLEAR_UNPROVEN` unless
  authoritative settlement and a trusted termination-evidence kind are present;
  guard precedes the cleared idempotent return. The sole source caller
  `releaseFence` performs durable cleanup before local deletion, preserving the
  local fence on rejection or persistence failure. Existing stream/real-exit
  paths already settle before release; EMPTY/ownership loss is not evidence.
- Two old multi-fence fixture paths now assert unproven-clear rejection and
  provide exact settlement before testing successful release.
- Four focused synthetic tests and a seven-row real-input matrix were added.
  Matrix source is written but **NOT EXECUTED**.

Independent read-only affected-Contract review reported no reachable semantic
blocker in the inspected diff (`FROZEN_BLOCKER_UNION=[]`), without executing
tests. This is source review only; required executed evidence and final-HEAD
review remain incomplete. It does not replace the regulator-assigned independent
product-semantic acceptance gate from the original mandate.

## Required-gate failure: targeted regression rc=1

Runtime: Node v26.7.0. Explicit file expansion was used; no directory positional
argument was passed. Exact command:

```text
COMMAND: node --test --test-concurrency=1 packages/agent-router/test/runtime-hygiene/recovery-compat.test.js packages/agent-router/test/process-lifecycle/timeout.test.js packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js packages/agent-router/test/process-lifecycle/unknown-fence-no-replay.test.js packages/agent-router/test/process-lifecycle/admin-abandonment.test.js
```

Executed result: 42 tests, 41 PASS, 1 FAIL, cancelled=0, skipped=0, process rc=1.
All four newly added focused tests passed, as did the repaired multi-fence tests
and the other selected existing tests. One pre-existing test in
`packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js:11`
failed at its 25ms prompt deadline before prompt bytes were written:

```text
✖ failing tests:

test at packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js:11:1
✖ V3 parsed terminal and child exit remain uncommitted together when durable settlement fails (340.67225ms)
  Error [AgentProcessEnvelopeError]: request session/prompt deadline expired before write (agent agt_fx)
      at envelopeCarrier (file:///private/tmp/h605-r2/packages/agent-router/src/process/state-machine.js:30:17)
      at AgentProcess.request (file:///private/tmp/h605-r2/packages/agent-router/src/process/rpc-channel.js:239:29)
      at AgentProcess.promptWrite (file:///private/tmp/h605-r2/packages/agent-router/src/process/prompt-write.js:20:30)
      at AgentProcess.runPromptExecution (file:///private/tmp/h605-r2/packages/agent-router/src/process/turn-execution.js:320:34)
      at AgentProcess.drainTurnQueue (file:///private/tmp/h605-r2/packages/agent-router/src/process/turn-execution.js:218:15)
      at file:///private/tmp/h605-r2/packages/agent-router/src/process/turn-execution.js:171:12
      at new Promise (<anonymous>)
      at AgentProcess.enqueuePromptExecution (file:///private/tmp/h605-r2/packages/agent-router/src/process/turn-execution.js:140:12)
      at AgentProcess.turn (file:///private/tmp/h605-r2/packages/agent-router/src/process/agent-process.js:262:17)
      at TestContext.<anonymous> (file:///private/tmp/h605-r2/packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js:20:26) {
    status: 'not_admitted',
    envelope: 'not_admitted',
    reconciliationHandle: 'turn:epoch-atomic-exit:a1:g1:s1',
    code: 'AGENT_PROCESS_RPC_DEADLINE',
    proven: 'zero_byte',
    method: 'session/prompt'
  }

rc=1
```

`BLOCKER_CLASS=REQUIRED_GATE_FAILURE`.
`SOURCE`: required related-suite rc0 plus the explicit fail-stop instruction.
`COUNTEREXAMPLE`: executed process rc1 with the error above.
`IMPACT`: related-suite rc0 and DONE_WHEN cannot be claimed. The seven real-copy
matrix rows, full Router/Scheduler suites, rollback and delivery remain unverified.
`MINIMAL_CLOSURE`: a new authorized resume must diagnose this recorded deadline
failure at pinned candidate/base coordinates, then complete the still-unexecuted
mandatory gates. Whether the failure is base/environment timing sensitivity or a
candidate regression remains **UNKNOWN**; no base comparison or rerun occurred.
`IMPLEMENTATION_ALLOWED=NO` for further writes in this stopped run;
`MERGE_READY=NO`; `OPERATION_ALLOWED=NO`; `NEXT_ACTION=STOP`.

## DONE_WHEN / outstanding matrix

| Requirement | Current result |
| --- | --- |
| rc.3 + TE_V1/V3 prerequisite | PASS, rc0, fresh coordinates above |
| Reader + guard source | Implemented in uncommitted diff; source-only |
| New targeted synthetic tests | 4 PASS within failed 42-test run |
| Related selected regression suite | FAIL, rc1 (41/42) |
| Real-copy decode | NOT_EXECUTED (JSON inventory/hash is not decoder acceptance) |
| Real-copy cold startup | NOT_EXECUTED |
| Real-copy restart projection | NOT_EXECUTED |
| Agent isolation | NOT_EXECUTED; input also contains legal stock Agent fence |
| Old-operation no replay | NOT_EXECUTED on real copy; synthetic old suite PASS |
| Negative persistence | NOT_EXECUTED on real copy; new synthetic test PASS |
| Rollback | NOT_EXECUTED; planned base behavior is fail-closed, not availability PASS |
| Full Scheduler/Router suites | NOT_EXECUTED |
| Final independent product review / exact HEAD | INCOMPLETE / PENDING regulator |
| RECEIPT-605-R2.md / commit / push / PR | NOT_EXECUTED |

## Read-only input provenance and final hashes

Input is Owner-designated sanitized material; no independent manifest binds it to
inaccessible production originals. Production-original hashes and runtime state
remain UNKNOWN. No Store constructor was run against the designated input.
The matrix has not run even against its planned temporary copies. No input
was opened for writing. Fresh hashes still exactly match the prior checkpoint:

| Path relative to `/private/tmp/w6-state-compat-readable/sanitized/` | Bytes | SHA256 |
| --- | ---: | --- |
| `control/turn-recovery-v3.json` | 10700760 | `1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a` |
| `control/turn-recovery-v3.json.abandonment-declarations.json` | 4062 | `139348609fb6e4936cb2339450ad47ef23869a9337f08f8a76bf1b27501839d3` |
| `control/turn-recovery-v3.json.faults.json` | 147 | `1177da0f7dbe7b722ec2dce5ae6a404d2a0460d05bb901f0493dec3f180d3486` |
| `scheduler/jobs.json` | 7016723 | `5fe2b0d530f271e5c9c0c0f41e62b0732c9735580d4d0ff12dabb1de26609d77` |

JSON inventory: Router 5227 records / 93 issuance Agents; Scheduler v3 59 jobs /
5002 occurrences / 7 fences. Anomalies remain indices 5124/5125/5127 for
agt_needs-radar-agent / agt_lobster-agent / agt_agent-dev-engineer, each
blocked/pending/cleared, initialOutcome=outcome_unknown, null exitObservedAt /
terminationEvidence / settlementResult, with existing adminAbandonment retained.
Another legitimate unresolved fence belongs to agt_stock_agent; it is not a new
compatibility regression. Old business outcomes remain UNKNOWN.

## Reviewable evidence and resumable worktree

Full logs remain accessible outside Git as permitted by shared grammar:

| Log path | Bytes | SHA256 |
| --- | ---: | --- |
| `/private/tmp/h605-r2-evidence/format-correction.log` | 207 | `aec7e89c0a05fd8e23707755b6c9de6f8e27c2b2e987e6aa2179e2da0dbc15f6` |
| `/private/tmp/h605-r2-evidence/governance.log` | 84 | `4042e700a6bac3446d8ab409f1f8ce1b9c6bdfa55a1ffbcc11ebc235599ab99e` |
| `/private/tmp/h605-r2-evidence/targeted.log` | 6724 | `9ed2ebb35f3f555a3bef4c53226a81fc1db1f4d26b07caef25d0065b8b8c76ec` |

Current artifact hashes:

| Path relative to worktree | SHA256 |
| --- | --- |
| `BRIEF-605-R2.md` | `04a0b0118f966c2309c4d7a8ce2f27f844e23f8dcaef547d5a840f9488db40de` |
| `packages/agent-router/src/reconciliation/admin-abandonment.js` | `6703f5f995ef2ea2922504fbc383f2841ead53b8f83c6e23ccf3fe167b639eb7` |
| `packages/agent-router/src/reconciliation/durable-file.js` | `576bd8822fc90b9da3fbf11fd191e9ee78461d67c1d47c40840c3b97ca675161` |
| `packages/agent-router/src/reconciliation/query.js` | `3725875b5df2d02099b4bb766a92679aa770d946012a10f1a1c325f0a111ae63` |
| `packages/agent-router/src/reconciliation/state-machine.js` | `a65c0d05b502e58e0cd34efdd6c574b4eee809b6d0c5eab028a8d78cb9ca6098` |
| `packages/agent-router/test/process-lifecycle/timeout.test.js` | `7fff46af7ce99a06edf618250af63d22880ed613b4168faa0f01a6d762df4099` |
| `packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js` | `5b6d522685edc20e6e9e829d5a09c438ffabe145f0135be94af36a3de0c03dcb` |
| `packages/agent-router/test/runtime-hygiene/recovery-compat.test.js` | `b93650a57fc0e3f2de1c0000e66e01b0de5a155c0e06458aa1a68586191a2adf` |
| `scripts/availability-recovery/compat-reader-matrix.test.mjs` | `8645d1bf9c23c90192c897e524cbc66bbd249679b4c2c558f509d53c98303fe9` |

Pre-stop status (STOPPED file itself not yet present):

```text
 M packages/agent-router/src/reconciliation/admin-abandonment.js
 M packages/agent-router/src/reconciliation/durable-file.js
 M packages/agent-router/src/reconciliation/query.js
 M packages/agent-router/src/reconciliation/state-machine.js
 M packages/agent-router/test/process-lifecycle/timeout.test.js
 M packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js
?? BRIEF-605-R2.md
?? packages/agent-router/test/runtime-hygiene/recovery-compat.test.js
?? scripts/availability-recovery/compat-reader-matrix.test.mjs
```

No commit, push, PR, merge, deployment, production write, service restart,
production fence clear, deletion, settlement or old-operation replay occurred.
No governing authority, vendored tool, lock, registry, or dependency was changed.
The original brief/stop worktree and designated input were read-only.


---

# R3 current stop — required real-copy decode matrix failed

STATUS = STOPPED_R3_REQUIRED_MATRIX_DECODE_RC1
OBSERVED_AT = 2026-11-07T03:56:10.432261+00:00

This is the current R3 record. The preceding R2 stop is retained as history;
its 41/42 blocker was resumed by the Owner and the targeted gate now passes.
The new matrix failure below is not covered by the special baseline exemption.

## Exact coordinates and R3 mandate

- Repository/worktree: mayf3/dsh-agent-core, `/private/tmp/h605-r2`.
- Branch: `fix/compat-reader-writer-guard`.
- HEAD/base/current remote main (fresh ls-remote before matrix):
  `4f7df01bcf087075c114901a96a7a54573110f61`.
- Runtime: Node v26.7.0, macOS, Asia/Shanghai.
- Owner's R3 request authorizes three clean-base attribution runs, restoring the
  diff, an in-contract reader repair if all three pass, and then the existing
  mandatory gates, commit/push/unmerged PR. Its final explicit instruction is
  “红线照旧; 失败即停”. Production changes, original-record edits and merge
  remain forbidden. The baseline three-run diagnosis is the explicit exception
  allowing those three attempts despite a baseline failure; it is not a generic
  waiver for another failed gate.
- Source-only route continues REUSE / BRIEF / DURABLE under the authorities
  pinned in this Brief. No Spec or product meaning was changed.

## Attribution: three clean-base raw results, no pre-existing exemption

`git stash push --include-untracked` created
`0843eb7a3c8add0b6b1900a39d7553865c755bc9`.
HEAD was the exact base above and `git status --porcelain` was empty before
all three runs. `git stash pop --index` returned rc0; all ten original
modified/untracked file SHA256 values matched the saved pre-stash manifest.

MANDATE_CLASSIFICATION = REGRESSION
PRE_EXISTING_EXEMPTION = NO
HISTORICAL_SLOW_OPERATION_CAUSAL_MECHANISM = NOT_ESTABLISHED

All three clean-base observations are reproduced verbatim:

### Clean-base attempt 1

```text
COMMAND: node --test --test-concurrency=1 "--test-name-pattern=V3 parsed terminal and child exit remain uncommitted together when durable settlement fails" packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js
STARTED_AT: 2026-11-07T03:52:27.617022+00:00
BASE_HEAD: 4f7df01bcf087075c114901a96a7a54573110f61
✔ V3 parsed terminal and child exit remain uncommitted together when durable settlement fails (66.975375ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 119.36925

rc=0
```

### Clean-base attempt 2

```text
COMMAND: node --test --test-concurrency=1 "--test-name-pattern=V3 parsed terminal and child exit remain uncommitted together when durable settlement fails" packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js
STARTED_AT: 2026-11-07T03:52:27.761661+00:00
BASE_HEAD: 4f7df01bcf087075c114901a96a7a54573110f61
✔ V3 parsed terminal and child exit remain uncommitted together when durable settlement fails (63.238458ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 107.551

rc=0
```

### Clean-base attempt 3

```text
COMMAND: node --test --test-concurrency=1 "--test-name-pattern=V3 parsed terminal and child exit remain uncommitted together when durable settlement fails" packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js
STARTED_AT: 2026-11-07T03:52:27.899706+00:00
BASE_HEAD: 4f7df01bcf087075c114901a96a7a54573110f61
✔ V3 parsed terminal and child exit remain uncommitted together when durable settlement fails (59.3925ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 102.731708

rc=0
```

The phrase “25ms prompt deadline” from the handoff does not match the actual
code. The fourth argument 25 is callerWaitTimeoutMs (agent-process.js:252–262);
pre-write request takes the minimum of 250ms receipt and 70ms turn deadline.
The latter starts before markAdmitted and markPromptWriteAttempted, which each
perform synchronous persistence with file and directory fsync. Thus an expiry
before write means this anchored 70ms budget was consumed; it is not evidence
of an old prompt being admitted or replayed.

External, temporary instrumentation of the same one-record pre-write path,
using exact base blobs via a Node module load hook and the restored candidate,
did not reproduce the historical expiry. At request time the base retained
51ms and candidate 54ms; the deadline-interval admission projection measured
0.00525ms and 0.020709ms, respectively. No new I/O or module cycle was found
in the reader delta; the durable decoder runs on load, not in serialization.
These two samples do not identify which historical synchronous operation
stalled. They must not be presented as a proven fsync fault or a proven causal
reader slowdown. The user-defined regression classification above remains in
force and cannot be converted into pre-existing from this observation.

The first external profiler attempt exited rc13 because unref'ed production
timers did not keep its standalone top-level await alive. The corrected
external harness held a keepalive; both profile invocations then returned rc0.
This was diagnostic harness setup, not a product gate, and changed no test.

## Bounded R3 reader repair and targeted gate

- Restore original agentId/initialOutcome filters before compatibility work in
  admissionBlockerForAgent; evaluate the exact legacy predicate only for
  cleared UNKNOWN records. Ordinary prompt admission no longer enters the
  added legacy decoder.
- Short-circuit the shared predicate for non-cleared/non-UNKNOWN records.
  This only reorders existing conjuncts and does not expand accepted tuples.
- No R3 test changes, deadline increases, persistence suppression, evidence
  relaxation or business outcome fabrication. The two R2 fixture repairs
  remain as previously recorded; the persistence-seams test is byte-identical
  to base.
- Independent read-only R3 delta review found FROZEN_BLOCKER_UNION=[] and
  SPEC_GAPS=0. It did not execute tests and does not replace the separately
  regulator-assigned independent product-semantic acceptance gate. There is
  no final commit or final-HEAD review.

Exact original 42-test selection after the repair, raw command/result:

```text
COMMAND: node --test --test-concurrency=1 packages/agent-router/test/runtime-hygiene/recovery-compat.test.js packages/agent-router/test/process-lifecycle/timeout.test.js packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js packages/agent-router/test/process-lifecycle/unknown-fence-no-replay.test.js packages/agent-router/test/process-lifecycle/admin-abandonment.test.js
STARTED_AT: 2026-11-07T03:55:01.915554+00:00
✔ declaration unblocks admission for one agent; historical fence query and other agents unchanged (1.659084ms)
✔ declaration is idempotent per declarationId and does not restamp (0.186375ms)
✔ a NEW unknown after a declaration fences the agent again; a further declaration abandons only it (0.265792ms)
✔ abandonment persists across restarts; late old results stay isolated; no-replay keeps correlation (96.784292ms)
✔ declaration validation: arguments and admission readiness fail loud (0.190208ms)
✔ durable validator rejects a malformed abandonment marker and accepts the closed shape (49.219167ms)
✔ review r4130766501 regression: retrying a COMPLETED declaration never adopts a later unknown turn (0.478208ms)
✔ scope binding survives restart: retry after reopen still cannot adopt a later unknown (81.071916ms)
✔ partial-write recovery: retry completes exactly the registered original scope (58.07675ms)
✔ a declarationId bound to another agent fails loud and never restamps (0.637541ms)
✔ marker-only reconstruction: a store with no registry file still binds retries to the marker scope (82.305625ms)
✔ empty-scope declaration registers its (empty) operation: later turns are never adopted (0.563791ms)
✔ durable validator rejects a malformed scope registry fail-closed (59.294208ms)
✔ rollback/reupgrade regression: the scope registry survives an old-binary rewrite of the recovery file (100.07425ms)
✔ entry-gate projection: stuck fences without durable exit evidence are reported; observed exits are not (41.907833ms)
✔ owner risk acceptance stamps an explicit audit decision and fabricates no exit evidence (1.803ms)
✔ declaration scope matches the admission blocker: settled records with an active fence are abandonable (84.328458ms)
✔ V3 parsed terminal and child exit remain uncommitted together when durable settlement fails (57.283917ms)
✔ V3 over-cap durable record keeps startup business admission fail closed (18.22825ms)
✔ V3 unavailable durable path keeps startup business admission fail closed (0.491833ms)
✔ V3 restored durable fence blocks the real outer entry with closed structured diagnostics (37.691667ms)
✔ V3 invalid durable store blocks the real outer entry before route execution (0.612166ms)
✔ V3 old-generation cleanup cannot clear a newer generation fence (0.684541ms)
✔ PROMPT_RECEIPT_NEVER_REPLIES (turn path): receipt unknown stays fenced until hard-deadline REAP (109.828875ms)
✔ DELIVER_TIMEOUT_USES_PROMPT_RECEIPT_FIELD: the config field is the binding receipt deadline (182.9175ms)
✔ DELIVER_CANNOT_BYPASS_UNKNOWN_FENCE: a second deliver while unknown is not_admitted with write delta 0 (186.197458ms)
✔ B06: settling one of multiple unresolved unknowns does not release the others (1.90925ms)
✔ UNKNOWN_REJECTS_QUEUED_TURNS: B/C write delta 0; A late_completed (72.804166ms)
✔ crash-orphaned UNKNOWN stays fenced across restarts; no gate replays or settles it (46.742ms)
✔ admin abandonment unblocks admission only; the UNKNOWN record is never settled or erased (78.906542ms)
✔ restart-quiescence evidence without an authenticated context settles nothing (fail-closed) (0.481042ms)
✔ UNKNOWN_FENCE_SELF_LOCK_REPAIRED: idle before the same-batch turn/end settles late and releases the fence without any new admission (86.473875ms)
✔ RECEIPT_CORRELATION_MISSING: terminal present but receipt never correlated — pending, no fake release (82.118375ms)
✔ LATER_TURN_STARTED: a later turn/start after the terminal never settles the old turn (81.832958ms)
✔ MULTI_UNKNOWN_ISOLATED: releasing one fence never releases another (C-016) (2.885541ms)
✔ CHILD_EXIT_SETTLES_TERMINATED_WITHOUT_OUTCOME: fence released, no new admission needed (123.818166ms)
✔ RELEASE_SENDS_NOTHING_NEW: deliver-mode late settlement produces no second business prompt and no duplicate delivery (153.628125ms)
✔ classifyUnknownFence covers the six bounded, secret-free categories (0.614542ms)
✔ exact legacy tuple decodes without normalization; malformed neighbors still fail closed (42.25975ms)
✔ writer rejects pending/partial evidence and a prior bad clear with zero persistent/local effect (56.892292ms)
✔ fence persistence failure rolls back the durable transition and retains the local fence (49.075166ms)
✔ normal abandonment and exact settlement retain their distinct admission semantics (82.100959ms)
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2545.366375

rc=0
```

This proves 42/42 at this candidate, rc0, without a pre-existing exemption.
It does not prove the historical delay's causal mechanism has been isolated.

## New required gate failure — real-copy MATRIX decode

The matrix runner was configured to stop at the first nonzero row. Only decode
was invoked. It copied Owner-designated inputs into a mkdtemp directory and
cleaned that temporary directory; the source remained read-only.

```text
COMMAND: COMPAT_STATE_INPUT=/private/tmp/w6-state-compat-readable/sanitized/ node --test --test-concurrency=1 "--test-name-pattern=^MATRIX decode$" scripts/availability-recovery/compat-reader-matrix.test.mjs
STARTED_AT: 2026-11-07T03:55:33.104387+00:00
✖ MATRIX decode (103.938542ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 155.838125

✖ failing tests:

test at scripts/availability-recovery/compat-reader-matrix.test.mjs:106:1
✖ MATRIX decode (103.938542ms)
  Error: scheduler store: occurrence authority corrupted (fail loud, not an empty store): occurrence occ:a92a1eb6c2bb41c0: history must begin with admitted
      at failLoud (file:///private/tmp/h605-r2/packages/scheduler/src/store.js:20:19)
      at JobStore._validateDocument (file:///private/tmp/h605-r2/packages/scheduler/src/store.js:268:9)
      at JobStore._readDocRaw (file:///private/tmp/h605-r2/packages/scheduler/src/store.js:240:12)
      ... 3 lines matching cause stack trace ...
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    cause: Error: occurrence occ:a92a1eb6c2bb41c0: history must begin with admitted
        at corrupt (file:///private/tmp/h605-r2/packages/scheduler/src/occurrence-model.js:179:25)
        at validateOccurrenceRecord (file:///private/tmp/h605-r2/packages/scheduler/src/occurrence-model.js:241:55)
        at JobStore._validateDocument (file:///private/tmp/h605-r2/packages/scheduler/src/store.js:266:9)
        at JobStore._readDocRaw (file:///private/tmp/h605-r2/packages/scheduler/src/store.js:240:12)
        at async JobStore.loadDoc (file:///private/tmp/h605-r2/packages/scheduler/src/store.js:362:24)
        at async TestContext.<anonymous> (file:///private/tmp/h605-r2/scripts/availability-recovery/compat-reader-matrix.test.mjs:120:15)
        at async Test.run (node:internal/test_runner/test:1404:7)
        at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
      code: 'OCCURRENCE_STORE_CORRUPT'
    }
  }

rc=1
```

Read-only confirmation coordinate in the unchanged designated input:
`/private/tmp/w6-state-compat-readable/sanitized/scheduler/jobs.json`,
`occurrences[0]`, occurrence `occ:a92a1eb6c2bb41c0`,
job `scheduler-v2-production-smoke-1787790545613`, state `failed`.
Scheduler's unchanged validator rejects the first history transition unless
`to == admitted` (occurrence-model.js:241). No Scheduler source changed.
That fact alone is not an authorized pre-existing gate exemption. No clean-base
matrix rerun, input repair, history rewrite or Scheduler validator relaxation
was attempted after failure.

The failed row had reached Router decoder count/issuance/target assertions
before JobStore.loadDoc rejected Scheduler history. This is partial diagnostic
progress only; MATRIX decode is FAIL, not PASS.

BLOCKER_CLASS = REQUIRED_GATE_FAILURE
SOURCE = mandatory real-copy decode row plus Owner's final fail-stop instruction
COUNTEREXAMPLE = exact command above returned rc1, OCCURRENCE_STORE_CORRUPT
IMPACT = complete mandatory seven-row matrix and delivery are not established
MINIMAL_CLOSURE = Owner-authorized resume diagnosing/dispositioning this exact
  Scheduler-copy history rejection without weakening accepted semantics,
  editing protected originals, fabricating history or silently dropping the row
AFFECTED_READINESS = matrix/delivery/commit/push/PR
IMPLEMENTATION_ALLOWED = NO for dependent continuation in this stopped run
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP

Only this STOPPED record was written in the repository after the required-gate
failure. Subsequent actions were read-only evidence/hash checks. The specific
three-baseline-run exception cannot be extended to this different gate.

## Current DONE_WHEN accounting

| Requirement | R3 observation |
| --- | --- |
| Stash, clean pinned base, three exact-test runs | COMPLETE, rc0/rc0/rc0; raw output above |
| Restore original changes | COMPLETE, stash pop rc0, all ten hashes equal |
| Attribution | Regression under Owner rule; no pre-existing exemption; historical causal mechanism unproven |
| In-contract reader repair | Implemented; independent source delta review found no blocker |
| Original targeted suite | PASS 42/42, rc0 |
| Real-copy decode | FAIL, rc1, exact Scheduler history rejection above |
| Real-copy cold-start | NOT_EXECUTED |
| Real-copy restart | NOT_EXECUTED |
| Real-copy Agent isolation | NOT_EXECUTED |
| Real-copy no replay | NOT_EXECUTED |
| Real-copy negative persistence | NOT_EXECUTED |
| Real-copy rollback | NOT_EXECUTED |
| Full Router/Scheduler/Scheduler-Router suites | NOT_EXECUTED |
| Final assigned independent review | NOT_EXECUTED |
| RECEIPT-605-R2.md / commit / push / PR | NOT_EXECUTED; stopped before these actions |

Work remains uncommitted and reviewable in the same worktree. Source
implementation, targeted tests, complete copy-matrix acceptance, installation
and live business recovery are distinct; only the first two have evidence here.
No production reads/writes, production process starts/restarts, fence clear,
record deletion, settlement, old-operation replay, deployment or merge occurred.
Original three records and business UNKNOWN remain unchanged. The full source
input is not production provenance: protected-production original hashes and
current live runtime state remain UNKNOWN.

## Fresh read-only input hashes after failure

| Relative source path | Bytes | SHA256 | Matches R2 checkpoint |
| --- | ---: | --- | --- |
| `control/turn-recovery-v3.json` | 10700760 | `1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a` | True |
| `control/turn-recovery-v3.json.abandonment-declarations.json` | 4062 | `139348609fb6e4936cb2339450ad47ef23869a9337f08f8a76bf1b27501839d3` | True |
| `control/turn-recovery-v3.json.faults.json` | 147 | `1177da0f7dbe7b722ec2dce5ae6a404d2a0460d05bb901f0493dec3f180d3486` | True |
| `scheduler/jobs.json` | 7016723 | `5fe2b0d530f271e5c9c0c0f41e62b0732c9735580d4d0ff12dabb1de26609d77` | True |

## Raw evidence retrieval and hashes

All raw logs and the pre-stash manifest are under `/private/tmp/h605-r3-evidence`.
`r3-stop-evidence.json` binds observation time, input/log hashes, HEAD, status
and tracked diff hash. `pre-stash-manifest.json` binds restored file bytes.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| `/private/tmp/h605-r3-evidence/baseline-1.log` | 571 | `e0fae0134c2b369c17f0d6f055b6f2e4dfe5c936002c7e9aa13d1a9701c7e4a5` |
| `/private/tmp/h605-r3-evidence/baseline-2.log` | 569 | `dfff0499ec5d8970869d340db752769e09450320a7069e3c79d468d4b3551e5f` |
| `/private/tmp/h605-r3-evidence/baseline-3.log` | 570 | `98ef88a10eb22b75e1ed176b63eeaa0ad4c7e936c8c78634a01913d1b7d61a5e` |
| `/private/tmp/h605-r3-evidence/matrix-decode.log` | 2065 | `e9b55aa5509e2c28d59d315711797b2594999081159b3f6710ecb4f68b663f43` |
| `/private/tmp/h605-r3-evidence/prewrite-profile-base.log` | 1770 | `0988cb68cef2c20a3e270993d34d6991c3d096b967238091c28bdc0dd2743f2d` |
| `/private/tmp/h605-r3-evidence/prewrite-profile-candidate.log` | 1759 | `ca86cf1e505b4cbdf249a2c19013b9e32e806851d93e62bddfeb905a443be7e1` |
| `/private/tmp/h605-r3-evidence/stash-pop.log` | 1032 | `e097b5cfae87ba94a9360ad5b1e8f43b392247d9d3254ded8a8e159c680ce420` |
| `/private/tmp/h605-r3-evidence/stash-push.log` | 121 | `f6cee3c29b7da946c25f8e9453fda2f0665ffa2119708734b065b0b87a7913e4` |
| `/private/tmp/h605-r3-evidence/targeted.log` | 5055 | `5b636915a4aad5949fee3de50e95751be5e707721bf21b33aae597a1b6663145` |

Tracked binary diff SHA256 at stop:
`6867d2ddbf5db8daec0b47118eb7a3b193c13aeb80afdd8c4ff4c7ef6d0c32e9`.
Untracked source/test/Brief files are additionally bound below; this stop file
is excluded from its own hash table.

| Worktree-relative path | SHA256 |
| --- | --- |
| `BRIEF-605-R2.md` | `46e76cc511bfe63fe1703588fa57a00fa7ddf417740998c2aab937e37db14b6b` |
| `packages/agent-router/src/reconciliation/admin-abandonment.js` | `62237fb500694f95d894f0f75516ee97fee05cd961971156783120bcbe059710` |
| `packages/agent-router/src/reconciliation/durable-file.js` | `576bd8822fc90b9da3fbf11fd191e9ee78461d67c1d47c40840c3b97ca675161` |
| `packages/agent-router/src/reconciliation/query.js` | `3725875b5df2d02099b4bb766a92679aa770d946012a10f1a1c325f0a111ae63` |
| `packages/agent-router/src/reconciliation/state-machine.js` | `516abc6eb5176d606b2673ad8b5d50564b7f9fc344261b370809a6d84e16fb3f` |
| `packages/agent-router/test/process-lifecycle/timeout.test.js` | `7fff46af7ce99a06edf618250af63d22880ed613b4168faa0f01a6d762df4099` |
| `packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js` | `5b6d522685edc20e6e9e829d5a09c438ffabe145f0135be94af36a3de0c03dcb` |
| `packages/agent-router/test/runtime-hygiene/recovery-compat.test.js` | `b93650a57fc0e3f2de1c0000e66e01b0de5a155c0e06458aa1a68586191a2adf` |
| `scripts/availability-recovery/compat-reader-matrix.test.mjs` | `8645d1bf9c23c90192c897e524cbc66bbd249679b4c2c558f509d53c98303fe9` |

Timestamp precision note: the targeted.log wrapper sampled its STARTED_AT field after the subprocess returned. It is an observation/completion timestamp, not the actual test start. The baseline and matrix wrapper timestamps were sampled before invocation. Raw logs above are preserved unchanged.

Read-only source refinement: the first occurrence history contains `{from:null,to:"[redacted]"}` followed by `{from:"admitted",to:"[redacted]"}`. Thus the exact designated sanitized copy has a redacted enum where the unchanged Scheduler validator requires `admitted`. This does not prove production history is corrupt; production-original provenance and enum values remain UNKNOWN. No input bytes were repaired or substituted. The full transition projection is retained in /private/tmp/h605-r3-evidence/scheduler-failure-coordinate.json.


---

# R4 current stop — decode green, required cold-start matrix rc1

STATUS = STOPPED_R4_REQUIRED_MATRIX_COLD_START_RC1
OBSERVED_AT = 2026-11-07T04:05:18.075873+00:00

## Coordinates and supervisory mandate

- Repository/worktree: `mayf3/dsh-agent-core`, `/private/tmp/h605-r2`.
- Branch: `fix/compat-reader-writer-guard`; HEAD/base: `4f7df01bcf087075c114901a96a7a54573110f61`.
- Fresh `git ls-remote origin refs/heads/main` before implementation returned
  the same base. Runtime: Node v26.7.0; macOS; Asia/Shanghai.
- Authorization coordinate: current Owner message headed
  `R4续派(监管裁定, 选项a通用规则)`, persisted verbatim in
  `BRIEF-605-R2.md` section `R4 supervisory resume — 2026-11-07`.
- R4 mandates arbitrary invalid history enum values to become explicitly
  unverifiable history with UNKNOWN retained, no fabricated admitted, no
  placeholder-literal coupling; structurally unusable records still fail loud.
- R4 accepts R3 attribution: three clean-base rc0 runs imply REGRESSION,
  followed by bounded repair and original targeted 42/42 rc0. The R3 raw logs,
  stash restoration and causal limitation above remain authoritative evidence;
  those baseline runs were not repeated. Historical timing causality is UNKNOWN.
- Existing source-only scope continues. No production mutation or merge.
  Binding instruction remains “失败即停照旧”.

## R4 implementation at stop (uncommitted, not delivered)

- Added `decodeOccurrenceRecord` as a read-only compatible projection. It
  clones the input, preserves raw history and business/settlement facts, and
  derives `historyVerification={status:'unverifiable',outcome:'UNKNOWN',
  invalidEnumEntries:[...]}` from enum membership, with no placeholder check.
- Public JobStore read opts into compatible decoding. Mutation, migration and
  projection rebuild retain strict authority validation. A diagnostic marker
  cannot permit a write or become execution/termination evidence.
- Usable unknown enum values include arbitrary strings, null, numbers,
  booleans, objects and arrays. Missing identity/history fields, unusable entry
  shape/time, invalid settlement authority, and independently provable illegal
  history constraints still fail loud. No history item is synthesized.
- Added five focused Scheduler tests (including nine invalid `to` values),
  and strengthened real-copy decode to compare every original Scheduler fact
  and fence and require explicit unverifiable markers.

## Executed targeted gate — 64/64 rc0

This includes the original 42-test Router selection, 17 existing occurrence
model tests, and five new Scheduler history-compat tests. No test deadline or
persistence requirement was relaxed.

```text
COMMAND: node --test --test-concurrency=1 packages/scheduler/test/history-compat.test.js packages/scheduler/test/occurrence-model.test.js packages/agent-router/test/runtime-hygiene/recovery-compat.test.js packages/agent-router/test/process-lifecycle/timeout.test.js packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js packages/agent-router/test/process-lifecycle/unknown-fence-no-replay.test.js packages/agent-router/test/process-lifecycle/admin-abandonment.test.js
STARTED_AT: 2026-11-07T04:03:30.907394+00:00
✔ declaration unblocks admission for one agent; historical fence query and other agents unchanged (1.885833ms)
✔ declaration is idempotent per declarationId and does not restamp (0.209ms)
✔ a NEW unknown after a declaration fences the agent again; a further declaration abandons only it (0.274333ms)
✔ abandonment persists across restarts; late old results stay isolated; no-replay keeps correlation (131.584334ms)
✔ declaration validation: arguments and admission readiness fail loud (0.211583ms)
✔ durable validator rejects a malformed abandonment marker and accepts the closed shape (70.013125ms)
✔ review r4130766501 regression: retrying a COMPLETED declaration never adopts a later unknown turn (0.477875ms)
✔ scope binding survives restart: retry after reopen still cannot adopt a later unknown (80.258833ms)
✔ partial-write recovery: retry completes exactly the registered original scope (58.262333ms)
✔ a declarationId bound to another agent fails loud and never restamps (1.101333ms)
✔ marker-only reconstruction: a store with no registry file still binds retries to the marker scope (83.4385ms)
✔ empty-scope declaration registers its (empty) operation: later turns are never adopted (0.365ms)
✔ durable validator rejects a malformed scope registry fail-closed (56.886791ms)
✔ rollback/reupgrade regression: the scope registry survives an old-binary rewrite of the recovery file (101.649708ms)
✔ entry-gate projection: stuck fences without durable exit evidence are reported; observed exits are not (42.063083ms)
✔ owner risk acceptance stamps an explicit audit decision and fabricates no exit evidence (1.435083ms)
✔ declaration scope matches the admission blocker: settled records with an active fence are abandonable (83.305291ms)
✔ V3 parsed terminal and child exit remain uncommitted together when durable settlement fails (62.667333ms)
✔ V3 over-cap durable record keeps startup business admission fail closed (18.529667ms)
✔ V3 unavailable durable path keeps startup business admission fail closed (0.556166ms)
✔ V3 restored durable fence blocks the real outer entry with closed structured diagnostics (44.006125ms)
✔ V3 invalid durable store blocks the real outer entry before route execution (0.52175ms)
✔ V3 old-generation cleanup cannot clear a newer generation fence (0.430625ms)
✔ PROMPT_RECEIPT_NEVER_REPLIES (turn path): receipt unknown stays fenced until hard-deadline REAP (109.942584ms)
✔ DELIVER_TIMEOUT_USES_PROMPT_RECEIPT_FIELD: the config field is the binding receipt deadline (182.516875ms)
✔ DELIVER_CANNOT_BYPASS_UNKNOWN_FENCE: a second deliver while unknown is not_admitted with write delta 0 (185.063459ms)
✔ B06: settling one of multiple unresolved unknowns does not release the others (1.717667ms)
✔ UNKNOWN_REJECTS_QUEUED_TURNS: B/C write delta 0; A late_completed (74.019625ms)
✔ crash-orphaned UNKNOWN stays fenced across restarts; no gate replays or settles it (43.456ms)
✔ admin abandonment unblocks admission only; the UNKNOWN record is never settled or erased (84.083708ms)
✔ restart-quiescence evidence without an authenticated context settles nothing (fail-closed) (0.48675ms)
✔ UNKNOWN_FENCE_SELF_LOCK_REPAIRED: idle before the same-batch turn/end settles late and releases the fence without any new admission (87.615541ms)
✔ RECEIPT_CORRELATION_MISSING: terminal present but receipt never correlated — pending, no fake release (83.4355ms)
✔ LATER_TURN_STARTED: a later turn/start after the terminal never settles the old turn (82.726083ms)
✔ MULTI_UNKNOWN_ISOLATED: releasing one fence never releases another (C-016) (3.169125ms)
✔ CHILD_EXIT_SETTLES_TERMINATED_WITHOUT_OUTCOME: fence released, no new admission needed (125.01725ms)
✔ RELEASE_SENDS_NOTHING_NEW: deliver-mode late settlement produces no second business prompt and no duplicate delivery (152.289792ms)
✔ classifyUnknownFence covers the six bounded, secret-free categories (1.007167ms)
✔ exact legacy tuple decodes without normalization; malformed neighbors still fail closed (44.565ms)
✔ writer rejects pending/partial evidence and a prior bad clear with zero persistent/local effect (59.925291ms)
✔ fence persistence failure rolls back the durable transition and retains the local fence (44.489625ms)
✔ normal abandonment and exact settlement retain their distinct admission semantics (79.207084ms)
✔ R4 arbitrary non-enum history to values decode as unverifiable without inventing admission (1.974667ms)
✔ R4 invalid from/final enums retain their raw values; marker is recomputed, never trusted (0.160125ms)
✔ R4 structurally unusable records and independently provable corruption still fail loud (0.493041ms)
✔ R4 redacted late-settlement linkage is unverifiable while settlement authority stays strict (0.149292ms)
✔ R4 JobStore read/restart preserves raw UNKNOWN fences; strict mutation rejects with zero file writes (13.376875ms)
✔ ACC-023 identity derivation is deterministic per logical coordinates (1.01825ms)
✔ ACC-023 runId/idempotencyKey derive from occurrenceId; session is fresh + non-main (0.10975ms)
✔ ACC-023 natural/catchup jointly occupy the nominal slot space; retry occupies its predecessor (0.319458ms)
✔ ACC-023 structured collision error is fail-loud and structured (0.235708ms)
✔ ACC-006 state machine: legal transitions and hard rejections (0.058083ms)
✔ ACC-006 applyTransition appends history and rejects illegal transitions (0.266417ms)
✔ ACC-006 late settlement leaves the unknown history auditable (0.071458ms)
✔ ACC-022 buildOccurrenceRecord carries every authority field (C-022) (0.266458ms)
✔ ACC-022 corrupt occurrence records fail loud on validation (authority corruption) (0.167542ms)
✔ ACC-006/011 unknown-to-terminal history without trusted lateSettlement fails loud (0.138417ms)
✔ ACC-004/022 failed authority requires a valid terminalEvidence kind (0.142167ms)
✔ ACC-022 default timeout falls back to the safety timeout (C-025) (0.065833ms)
✔ ACC-024 payloadHash: canonical JSON, key order irrelevant, delivery excluded (0.0705ms)
✔ ACC-024 canonicalJSON sorts keys recursively (0.028792ms)
✔ ACC-028 rebuildFences derives fences from unresolved unknowns only (0.069375ms)
✔ ACC-028 isUnresolvedUnknown + terminal helpers (0.032584ms)
✔ findOccurrenceByCoords locates records by logical coordinates (0.079042ms)
ℹ tests 64
ℹ suites 0
ℹ pass 64
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2736.043167

COMPLETED_AT: 2026-11-07T04:03:33.677027+00:00
rc=0
```

## Seven-row matrix — exact executed output

### 1. decode — PASS rc0

```text
COMMAND: COMPAT_STATE_INPUT=/private/tmp/w6-state-compat-readable/sanitized/ node --test --test-concurrency=1 '--test-name-pattern=^MATRIX decode$' scripts/availability-recovery/compat-reader-matrix.test.mjs
STARTED_AT: 2026-11-07T04:03:50.261329+00:00
decoded Router=5227/93 Scheduler=59/5002/7 unverifiableHistory=5002; all original facts/fences and input hashes unchanged
✔ MATRIX decode (202.101167ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 264.392875

COMPLETED_AT: 2026-11-07T04:03:50.554757+00:00
rc=0
```

### 2. cold-start — FAIL rc1; immediate stop

```text
COMMAND: COMPAT_STATE_INPUT=/private/tmp/w6-state-compat-readable/sanitized/ node --test --test-concurrency=1 '--test-name-pattern=^MATRIX cold-start$' scripts/availability-recovery/compat-reader-matrix.test.mjs
STARTED_AT: 2026-11-07T04:03:50.555139+00:00
✖ MATRIX cold-start (205.794833ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 257.727125

✖ failing tests:

test at scripts/availability-recovery/compat-reader-matrix.test.mjs:143:1
✖ MATRIX cold-start (205.794833ms)
  AssertionError [ERR_ASSERTION]: opening the store does not repair historical facts
  + actual - expected

  + '29502793cc56d7662abd794f283b6fd929abc4c4c597002d89354eec5b516222'
  - '1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a'

      at TestContext.<anonymous> (file:///private/tmp/h605-r2/scripts/availability-recovery/compat-reader-matrix.test.mjs:148:10)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1397:25)
      at Test.start (node:internal/test_runner/test:1257:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:387:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: '29502793cc56d7662abd794f283b6fd929abc4c4c597002d89354eec5b516222',
    expected: '1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a',
    operator: 'strictEqual',
    diff: 'simple'
  }

COMPLETED_AT: 2026-11-07T04:03:50.842020+00:00
rc=1
```

Rows 3–7 (restart, isolation, no-replay, negative-persistence, rollback) were
NOT_EXECUTED. Full Router/Scheduler/Scheduler-Router suites were NOT_EXECUTED.
No required gate was retried after rc1; no source, test, Brief or receipt was
edited after failure. Only this repository STOPPED append was written;
read-only evidence/hash inspection and an external evidence manifest followed.

## Concrete blocker and limitations

BLOCKER_CLASS = REQUIRED_GATE_FAILURE
SOURCE = required seven-row matrix and Owner's fail-stop instruction
COUNTEREXAMPLE = MATRIX cold-start rc1 at compat-reader-matrix.test.mjs:148;
  immediately after fx.open('compat-cold'), copied Router whole-file SHA256
  changed from 1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a
  to 29502793cc56d7662abd794f283b6fd929abc4c4c597002d89354eec5b516222
IMPACT = complete cold-start/matrix/full-suite delivery is unproven;
  commit/push/PR/receipt completion is blocked
MINIMAL_CLOSURE = authorized resume diagnoses this exact cold-start write,
  determines which facts/serialization changed without altering protected
  originals or weakening UNKNOWN/termination protection, then completes gates
AFFECTED_READINESS = cold-start/matrix/full-suites/delivery/commit/push/PR
IMPLEMENTATION_ALLOWED = NO for dependent continuation in this stopped run
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP

The in-memory assertProtected check immediately before the failed file-hash
assertion passed. The subsequent registry startup and persisted full-record
comparisons were not reached. Therefore a changed whole-file hash proves a
write to the temporary copy, but does not establish which field changed or
that any protected record was rewritten. Cause remains UNKNOWN. Do not label
it a harmless serialization change or a proven product regression without
new evidence. The fixture removed its temporary directory in teardown; no
post-failure matrix rerun or substitute input was used to reconstruct it.

## Independent read-only affected-delta review

Internal reviewer `/root/review_authority`, non-author of the semantic delta,
returned AUTHOR_INDEPENDENCE=PASS and NEW_CONCRETE_SEMANTIC_BLOCKERS=0 against
base above and tracked diff hash below. It executed no tests and wrote no
files. It confirmed read/write separation, raw history preservation, general
enum membership detection, marker recomputation, strict structure/settlement
validation and no invented admission. This is source review only, not final
Head acceptance or the regulator-assigned independent product review.

One interpretation uncertainty remains recorded: known illegal edges and
independently provable inconsistencies still fail despite a separate invalid
enum. Reviewer found no concrete blocker but did not equate this narrower
proof-preserving behavior with every possible reading of “结构上可处置”. No
scope expansion or new authority was inferred from that observation.

## Current DONE_WHEN

| Requirement | R4 result |
| --- | --- |
| R3 attribution + bounded repair + 42/42 | Accepted and retained, not rerun |
| General history-enum compatibility | Implemented, uncommitted; five new tests PASS |
| Targeted related selection | PASS 64/64 rc0 |
| Real-copy decode | PASS rc0; 5002 unverifiable histories, every raw fact/fence preserved |
| Real-copy cold-start | FAIL rc1; temporary Router copy whole-file hash changed |
| Real-copy restart | NOT_EXECUTED |
| Real-copy Agent isolation | NOT_EXECUTED |
| Real-copy no replay | NOT_EXECUTED |
| Real-copy negative persistence | NOT_EXECUTED |
| Real-copy rollback | NOT_EXECUTED |
| Full Router/Scheduler/Scheduler-Router suites | NOT_EXECUTED |
| Final assigned independent product review / final Head review | NOT_EXECUTED |
| RECEIPT-605-R2.md | NOT_CREATED; complete delivery not established |
| commit / push / PR | NOT_EXECUTED due fail-stop |

No production read/write, service restart, fence clear, record deletion,
settlement, old-operation replay, deployment or merge occurred. Original
source input stayed read-only; all four hashes below match R2/R3 checkpoints.
Production-original provenance and current live business recovery remain UNKNOWN.

## Evidence and fresh input hashes

Raw logs and `r4-stop-evidence.json` are under `/private/tmp/h605-r4-evidence`.
The manifest binds time, input/log/artifact hashes, tracked diff and Git status.

| Log | Bytes | SHA256 |
| --- | ---: | --- |
| `/private/tmp/h605-r4-evidence/matrix-cold-start.log` | 1506 | `a154cebc50cca6a43b2c321a10c881ee5dd285519305a34ca614d1a72c705e8d` |
| `/private/tmp/h605-r4-evidence/matrix-decode.log` | 576 | `ef7289ed21a80850c56a36bb7a36a39249d5bf84da95e8b5ef6c0dccbe7b0e84` |
| `/private/tmp/h605-r4-evidence/targeted.log` | 7190 | `0100cc0b3da4bc9ee030493fe2f96fd0275b6abe1ed8fbc1c3cb596803febeb5` |

| Input relative to sanitized/ | Bytes | SHA256 |
| --- | ---: | --- |
| `control/turn-recovery-v3.json` | 10700760 | `1488d505a69c65c417af96be0da05fb40b52fb2adc2c1cbd3d88d4dd3e85864a` |
| `control/turn-recovery-v3.json.abandonment-declarations.json` | 4062 | `139348609fb6e4936cb2339450ad47ef23869a9337f08f8a76bf1b27501839d3` |
| `control/turn-recovery-v3.json.faults.json` | 147 | `1177da0f7dbe7b722ec2dce5ae6a404d2a0460d05bb901f0493dec3f180d3486` |
| `scheduler/jobs.json` | 7016723 | `5fe2b0d530f271e5c9c0c0f41e62b0732c9735580d4d0ff12dabb1de26609d77` |

Tracked binary diff SHA256: `6bba9f69fbd2b93e286a73b369432a8afe60dac40df6d1a4e43927d68ed42ab5`.

| Worktree-relative artifact | SHA256 |
| --- | --- |
| `BRIEF-605-R2.md` | `f8fb6f1d8310e50a5adefcd4c00efd938192f838250c181d6e6e1980e284f22e` |
| `packages/agent-router/src/reconciliation/admin-abandonment.js` | `62237fb500694f95d894f0f75516ee97fee05cd961971156783120bcbe059710` |
| `packages/agent-router/src/reconciliation/durable-file.js` | `576bd8822fc90b9da3fbf11fd191e9ee78461d67c1d47c40840c3b97ca675161` |
| `packages/agent-router/src/reconciliation/query.js` | `3725875b5df2d02099b4bb766a92679aa770d946012a10f1a1c325f0a111ae63` |
| `packages/agent-router/src/reconciliation/state-machine.js` | `516abc6eb5176d606b2673ad8b5d50564b7f9fc344261b370809a6d84e16fb3f` |
| `packages/agent-router/test/process-lifecycle/timeout.test.js` | `7fff46af7ce99a06edf618250af63d22880ed613b4168faa0f01a6d762df4099` |
| `packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js` | `5b6d522685edc20e6e9e829d5a09c438ffabe145f0135be94af36a3de0c03dcb` |
| `packages/agent-router/test/runtime-hygiene/recovery-compat.test.js` | `b93650a57fc0e3f2de1c0000e66e01b0de5a155c0e06458aa1a68586191a2adf` |
| `packages/scheduler/src/occurrence-model.js` | `9d4faed6f2ccd8843c5be6fd5baff070efb449ec3ff56c318a2f88ca99e7474a` |
| `packages/scheduler/src/store.js` | `db512f94c11cf2f3fadaa7b56850ddda762a94afb1b577a762c49c0a724b4f03` |
| `packages/scheduler/test/history-compat.test.js` | `301d4fe9419700eab1833d642efc6b02570c197b09f659713d2aba9bd11dedc6` |
| `scripts/availability-recovery/compat-reader-matrix.test.mjs` | `01f7a6708cafd421e83f1fd31301a02ce8a805404648d290d414224b00ae6831` |

STOPPED excludes itself from its hash table. Current resumable Git status:

```text
 M packages/agent-router/src/reconciliation/admin-abandonment.js
 M packages/agent-router/src/reconciliation/durable-file.js
 M packages/agent-router/src/reconciliation/query.js
 M packages/agent-router/src/reconciliation/state-machine.js
 M packages/agent-router/test/process-lifecycle/timeout.test.js
 M packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js
 M packages/scheduler/src/occurrence-model.js
 M packages/scheduler/src/store.js
?? BRIEF-605-R2.md
?? STOPPED-605-R2.md
?? packages/agent-router/test/runtime-hygiene/recovery-compat.test.js
?? packages/scheduler/test/history-compat.test.js
?? scripts/availability-recovery/compat-reader-matrix.test.mjs
```


# R5 — diagnostic-first resume stopped at new cold-start rc1 (2026-11-07)

STATUS = STOPPED_REQUIRED_COLD_START_RC1_HARNESS_OVERCONSTRAINT
HEAD/base = 4f7df01bcf087075c114901a96a7a54573110f61
BRANCH/worktree = fix/compat-reader-writer-guard / /private/tmp/h605-r2

R5 原变异归因完成，判定 (b)：7 个 finalAssistantOutputEvidence 在 serializer
round-trip 中被写成 null。255 叶字段清单与原 before/新复现 after 见
`docs/evidence/605-r5/router-open-diff.json`。R4 历史 after 已被 teardown 删除，
R5 时间相关复现哈希不同，不冒称取回原 R4 bytes。
最小 serializer 修复保留既有 validated digest，相关新测试 PASS；targeted 48/48 rc0。
修复后 5227 records、七 digest、三 protected records 全保留。
矩阵使用 `/private/tmp/h605-r5-evidence/continuation` 同一副本：decode rc0；
cold-start 主体完成 protected3/readiness/spawn0，但 after hook rc1。

本轮 root 新增 helper `compat-store-facts.mjs:18` 过严，拒绝 index4765
agt_stock_agent 的合法 32 项 ownership_check blocked ring shift/append 和 updatedAt。
新变化不改业务 facts、UNKNOWN、identity、settlement、termination、fence 或 digest。
完整日志 `/private/tmp/h605-r5-evidence/matrix-cold-start.log` SHA256
969bd462304d5407dda2ca4353f7196ab4a50999bd0327cf2b128a9b82bd0a91。
最终 snapshot `/private/tmp/h605-r5-evidence/after-registry-cold-start.json` SHA256
c43e83044b8bca34208b295615ea49feb4f04b8716a1d60a8c747e4f7f5f624c。
停后只读第二结构化 diff 见 registry-cold-start-diff.json：34 叶变更，均为时间/有界 audit。

BLOCKER_CLASS = REQUIRED_GATE_FAILURE
SOURCE = 原任务书 :20/:26/:29 与 Owner R5“失败即停照旧”
COUNTEREXAMPLE = compat-reader-matrix.test.mjs:43 after hook → compat-store-facts.mjs:18 rc1
IMPACT = cold-start 完整 PASS、余五项矩阵、全套、commit/push/PR 尚未完成
MINIMAL_CLOSURE = 新授权续跑时只修 harness 对已证明合法的有界 audit/timestamp 的限定，
  从保留副本继续，不改 UNKNOWN/identity/termination/fence/原记录、不放宽非法历史写入
AFFECTED_READINESS = cold_start,matrix,full_suites,delivery,commit,push,pr
IMPLEMENTATION_ALLOWED = NO for dependent continuation
MERGE_READY = NO
OPERATION_ALLOWED = NO
NEXT_ACTION = STOP

独立 reviewer 已确认：PRODUCT_SEMANTIC_BLOCKERS_FOUND=0，但必需门 rc1 不可记 PASS；
ACCEPTANCE_COVERAGE_REVIEW=FAIL，source-only PASS 不替代矩阵或最终产品验收。
未在 rc1 后修改代码/测试或重试。后续矩阵/full suites/commit/push/PR 均 NOT_EXECUTED。
完整收据/原文/依据/字段归因/哈希和 UNKNOWN 见 `RECEIPT-605-R2.md`。
原始输入四个 SHA256 仍与 R2/R3/R4 相同；无生产操作、replay、部署或 merge。

# R6 required-gate stop

{
  "label": "full-router",
  "command": [
    "node",
    "--test",
    "--test-concurrency=1",
    "packages/agent-router/test/binding-store.test.js",
    "packages/agent-router/test/broker-rpc.test.js",
    "packages/agent-router/test/child-env.test.js",
    "packages/agent-router/test/deadline-config.test.js",
    "packages/agent-router/test/default-model-route.test.js",
    "packages/agent-router/test/delivery.test.js",
    "packages/agent-router/test/feishu-regression.test.js",
    "packages/agent-router/test/feishu-ux-seam.test.js",
    "packages/agent-router/test/feishu-v2-normal.test.js",
    "packages/agent-router/test/generation-restart-safety.test.js",
    "packages/agent-router/test/luna-credential-chain.test.js",
    "packages/agent-router/test/primary-workspace.test.js",
    "packages/agent-router/test/process-delivery.test.js",
    "packages/agent-router/test/process-descriptors.test.js",
    "packages/agent-router/test/process-lifecycle/admin-abandonment.test.js",
    "packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence-seams.test.js",
    "packages/agent-router/test/process-lifecycle/auto-recovery-v3-persistence.test.js",
    "packages/agent-router/test/process-lifecycle/auto-recovery-v3.test.js",
    "packages/agent-router/test/process-lifecycle/correlation.test.js",
    "packages/agent-router/test/process-lifecycle/evidence-caps.test.js",
    "packages/agent-router/test/process-lifecycle/feishu-reply-delivery-result.test.js",
    "packages/agent-router/test/process-lifecycle/ingress-exact-id.test.js",
    "packages/agent-router/test/process-lifecycle/late-settlement.test.js",
    "packages/agent-router/test/process-lifecycle/message-origin.test.js",
    "packages/agent-router/test/process-lifecycle/pipe-failure.test.js",
    "packages/agent-router/test/process-lifecycle/restart-convergence-matrix.test.js",
    "packages/agent-router/test/process-lifecycle/restart-quiescence-salvaged.test.js",
    "packages/agent-router/test/process-lifecycle/restart-quiescence.test.js",
    "packages/agent-router/test/process-lifecycle/rpc.test.js",
    "packages/agent-router/test/process-lifecycle/shutdown.test.js",
    "packages/agent-router/test/process-lifecycle/stale-registration-recovery.test.js",
    "packages/agent-router/test/process-lifecycle/startup.test.js",
    "packages/agent-router/test/process-lifecycle/timeout.test.js",
    "packages/agent-router/test/process-lifecycle/unknown-fence-no-replay.test.js",
    "packages/agent-router/test/process-lifecycle/unknown-fence-repair.test.js",
    "packages/agent-router/test/process-lifecycle/v5-ingress-correlation.test.js",
    "packages/agent-router/test/process-lifecycle/workflow-execution-origin.test.js",
    "packages/agent-router/test/process-registry.test.js",
    "packages/agent-router/test/process-startup-wedge.test.js",
    "packages/agent-router/test/reconciliation-store.test.js",
    "packages/agent-router/test/route-chain/blocked-delivery-alerts.test.js",
    "packages/agent-router/test/route-chain/canary-seam.test.js",
    "packages/agent-router/test/route-chain/conversation-runtime-seam.test.js",
    "packages/agent-router/test/route-chain/conversation-source.test.js",
    "packages/agent-router/test/route-chain/delivery-race-repro.test.js",
    "packages/agent-router/test/route-chain/delivery-readiness.test.js",
    "packages/agent-router/test/route-chain/delivery-resilience.test.js",
    "packages/agent-router/test/route-chain/ingress-fallback.test.js",
    "packages/agent-router/test/route-chain/native-goal-admission.test.js",
    "packages/agent-router/test/route-chain/native-goal-composed.test.js",
    "packages/agent-router/test/route-chain/parent-rpc-stop-barrier.test.js",
    "packages/agent-router/test/route-chain/process-registry-route-gate.test.js",
    "packages/agent-router/test/route-chain/provider-route.test.js",
    "packages/agent-router/test/route-chain/quota-classifier.test.js",
    "packages/agent-router/test/route-chain/reconcile-batch.test.js",
    "packages/agent-router/test/route-chain/reconcile-cli.test.js",
    "packages/agent-router/test/route-chain/route-chain.test.js",
    "packages/agent-router/test/route-chain/startup-carrier.test.js",
    "packages/agent-router/test/route-chain/switch-workspace-guard.test.js",
    "packages/agent-router/test/router.test.js",
    "packages/agent-router/test/runtime-hygiene/no-hidden-hr-runtime-knowledge.test.js",
    "packages/agent-router/test/runtime-hygiene/recovery-compat.test.js",
    "packages/agent-router/test/single-flight.test.js",
    "packages/agent-router/test/workspace-binding.test.js"
  ],
  "cwd": "/private/tmp/h605-r2",
  "startedAt": "2026-11-07T04:19:45.773846+00:00",
  "head": "4f7df01bcf087075c114901a96a7a54573110f61",
  "log": "/private/tmp/h605-r6-evidence/full-router.log",
  "routerBeforeSHA256": "0d5976f37179bedb2247120a3ce0009c35d6def54bec32990e6fed7a59558cc8",
  "rc": 1,
  "finishedAt": "2026-11-07T04:20:21.495398+00:00",
  "logSHA256": "ac1b00609c56c1df3f611e07a75d7e5a6e694445ee2b34c6875c589a0dc5abdd",
  "routerAfterSHA256": "0d5976f37179bedb2247120a3ce0009c35d6def54bec32990e6fed7a59558cc8"
}

Immediate fail-stop: no retry, later gate, commit/push/PR. Raw output: /private/tmp/h605-r6-evidence/full-router.log

## R6 finalized checkpoint

CURRENT_STATUS=STOPPED_REQUIRED_FULL_ROUTER_RC1
Task①helper DONE: 32 entries/65536 UTF-8 JSON bytes cap (Router V4:1420-1421),
only append + oldest audit prefix rotation; business/evidence facts and records retained.
Helper 4/4 rc0; seven-row matrix covered (R5 decode reused, R6 six rows rc0).
Full Router 64 files: rc1, 626 tests /614 pass /10 fail /2 skipped.
No failure exemption/baseline attribution; exact causes/UNKNOWN and raw output in current
RECEIPT-605-R2.md and docs/evidence/605-r6/full-router.log.
SOURCE=Owner original full-suite rc0 requirement + R6失败即停照旧;
BLOCKER_CLASS=REQUIRED_GATE_FAILURE; affected_readiness=full_suites,delivery,commit,push,pr;
IMPLEMENTATION_ALLOWED=NO(dependent continuation); MERGE_READY=NO; OPERATION_ALLOWED=NO;
NEXT_ACTION=STOP. No retry/repair/environment change, Scheduler suites, commit/push/PR.
Independent reviewer /root/authority_review_r6 confirms source boundary PASS and
acceptance coverage FAIL. Final HEAD remains 4f7df01bcf087075c114901a96a7a54573110f61.
Final retained-copy SHA256=0d5976f37179bedb2247120a3ce0009c35d6def54bec32990e6fed7a59558cc8;
5227 records, 3 full protected records, 7 historical digests preserved. Production UNKNOWN.

## R7 authorized resumption supersedes the R6 delivery stop

R7 Owner mandate performed exact clean-base attribution (10/10 pre-existing),
stash restoration and affected gates. All required delivery gates now rc0 after
only the explicitly authorized exclusions; no new required gate failed.
R2–R6 stop entries above are historical and unchanged. Current result and
remaining commit/push/PR/final-Head readback are in RECEIPT-605-R2.md.

Historical text above retains its meaning; Markdown trailing whitespace only
was normalized for presentation. Exact pre-R7 original receipt/STOPPED bytes and
SHA256 are archived in docs/evidence/605-r7/historical-markdown-originals.json.

R7 SOURCE_DELIVERY_COMPLETE: source commit42487e65 pushed; PR#646 open on main,
unmerged by live readback. Historical stops above remain preserved; no active
required-gate blocker for this authorized source task. See completed RECEIPT.
