# STOPPED — #637 R2

```text
STATE = STOPPED
STOP_OBSERVED_AT = 2026-11-06T14:19:14Z
WORKTREE = /private/tmp/h637-fix
BRANCH = fix/sched-classify-normal-terminals
HEAD = 09e8f34e8563f4d5e0e41ef96f4cdceb7427db84
BASE_HEAD = 09e8f34e8563f4d5e0e41ef96f4cdceb7427db84
PRODUCT_CHANGE = UNCOMMITTED_MINIMAL_CANDIDATE
ACCEPTANCE = NOT_PASSED
COMMIT = NOT_PERFORMED
PUSH = NOT_PERFORMED
PR = NOT_SUBMITTED
PRODUCTION_WRITES = ZERO
MERGE = NOT_PERFORMED
```

## Stop trigger

The R2 mandate says “失败即停写 STOPPED-637-R2.md”. The first GREEN
attempt returned exit 1 with three unexpected acceptance assertion failures.
Product/test writes and further tests/gates/delivery stopped at that result.
Subsequent work was read-only diagnosis and this required stop record.
The earlier designated RED failures are the expected defect reproduction;
they are distinct from this GREEN-attempt failure.

I introduced an incorrect equality assertion in
`packages/scheduler/test/watchdog/normal-terminal-restart.test.js:161`:

```js
assert.equal(fresh.nominalScheduledAt, next)
```

`next` was captured from the derived `job.state.nextRunAtMs`. Existing
`computeNextRunAtMsV2` in `packages/scheduler/src/eligibility.js:198` includes
the `every` terminal hold (`operationalEndedAt + everyMs`), while
`naturalCandidate` at line 126 assigns the anchor-aligned natural nominal
slot. Those are different coordinates in this fixture. Read-only source
inspection explains the 1000 ms difference; no assertion or product repair
was made after the failure and no rerun verified a corrected test.

Independent read-only diagnosis confirmed this exact calculation and cited
D-009 lines 201 and 476–483: `nextRunAtMs` is a projection, not occurrence
identity; the `every` anchor grid and terminal hold coexist. No change to
eligibility/schedule semantics is indicated by this assertion failure. The
independent reviewer did not run tests or issue a final candidate PASS.

## Executed evidence

All commands ran in the worktree above using the supplied shared
`node_modules` symlink. R1 evidence and stop record were preserved.

| Phase | Command | Exit | Tests | Pass | Fail | Skipped/cancelled |
|---|---|---:|---:|---:|---:|---:|
| Unchanged R2 baseline | `npm run test:scheduler` | 0 | 454 | 454 | 0 | 0/0 |
| Designated RED | `node --test packages/scheduler/test/watchdog/normal-terminal-restart.test.js` | 1 | 18 | 15 | 3 expected | 0/0 |
| First GREEN attempt | same focused command after classifier change | 1 | 18 | 15 | 3 unexpected | 0/0 |

RED raw excerpt (all three ordinary terminals failed at the same intended
defect assertion):

```text
AssertionError [ERR_ASSERTION]: ordinary Router terminal must settle the restart orphan
completed:    actual 'outcome_unknown', expected 'succeeded'
failed:       actual 'outcome_unknown', expected 'failed'
not_admitted: actual 'outcome_unknown', expected 'failed'
ℹ tests 18
ℹ pass 15
ℹ fail 3
```

First GREEN-attempt raw excerpt (all three now failed later at line 161):

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected
+ 1800000120000
- 1800000121000
ℹ tests 18
ℹ pass 15
ℹ fail 3
```

The full verbatim output, stack traces and timings remain in the raw files
below. The file named `R2-GREEN-normal-terminal.txt` records a **failed GREEN
attempt**, not a passing result.

```text
docs/evidence/issue-637/R2-BASELINE-scheduler.txt
SHA256 = 8eff968da7ff35576d76fa24ecd4d3c40566a78d0a81de6cce60fba5b7aadbdb
docs/evidence/issue-637/R2-RED-normal-terminal.txt
SHA256 = 6a4bf68c34b436102cbdcb594fdbcd1d36ea182f37994a98d0b6f995cb469440
docs/evidence/issue-637/R2-GREEN-normal-terminal.txt
SHA256 = 182ccf4199a3a8c92ac262cfebdd58e1dfe884ef6cbea6ad550e17bf586e8d61
```

## Candidate and practical limits

- The source change is confined to `classifyRouter`: normalize completed
  to late_completed, and failed/not_admitted to late_failed, after unchanged
  Agent/exact-correlation checks. Preserve `lateOutcome ?? outcome` and the
  existing termination-evidence/handle gate. No second reconciler or writer.
- New tests use real disposable Scheduler and Router files. A real isolated
  child exits immediately after Router `settleDirect`, before returning to
  Scheduler; the real lease re-adoption and restart sweep recover the orphan.
- In the failed GREEN attempt, the three positive cases passed the earlier
  assertions for business settlement, exact fence release, caller-self
  business_outcome_available with byte-identical zero-write, no old delivery,
  repeated tick/reconciliation zero-write, and one settlement across restart.
  Each reached a second natural occurrence, then failed the timestamp equality.
  Assertions after line 161 were not reached and remain unverified.
- Thirteen negative subcases and lateOutcome precedence passed both runs;
  those subcases retain UNKNOWN/fence and actual authoritative bytes.
- Independent initial authority review supports REUSE + BRIEF + DURABLE with
  no authority conflict. This is not a final candidate assurance PASS.
- `git diff --check` returned 0. No post-change full Scheduler suite,
  scheduler-router suite, structure gate or final exact-candidate review ran.

Frozen candidate files:

```text
packages/scheduler/src/self-ops/diagnosis.js
SHA256 = 28467820bf0a2fa82fe25de8146e4591b8d3b17d6bf8a197946a9f4035b3d33a
packages/scheduler/test/watchdog/normal-terminal-restart.test.js (220 lines)
SHA256 = 93b129c4bde683d059a13866eb13081722270d8764402f68b68c58419cb39379
```

## Remaining prerequisite

```text
FINDING_CLASS = REQUIRED_GATE_FAILURE
SOURCE = R2 Owner mandate: acceptance tests and existing suites green; failure means stop
COUNTEREXAMPLE = first post-fix focused run failed 3/18 at test line 161
IMPACT = no accepted GREEN, full regression, final receipt, commit/push or PR
MINIMAL_CLOSURE = resume authorization; correct nominal-slot versus admission-time assertion, then finish pending gates
AFFECTED_READINESS = acceptance NO; delivery NO; production NOT_AUTHORIZED
```

The pending correction should compare the fresh nominal against the defined
natural slot grid and the old occurrence/settlement boundary, separately from
the earliest admission-time projection. It must preserve the one fresh
invocation/delivery and no-replay assertions. This is a proposed next action,
not an executed fix. `RECEIPT-637.md` has not been created; R2 is not complete.
