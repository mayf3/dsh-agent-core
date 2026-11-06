# STOPPED-637 — baseline dependency failure

```text
STATUS = STOPPED
RECORDED_AT_UTC = 2026-11-06T14:02:57Z
REPOSITORY = mayf3/dsh-agent-core
WORKTREE = /private/tmp/h637-fix (shell resolves /tmp/h637-fix)
BRANCH = fix/sched-classify-normal-terminals
HEAD = 09e8f34e8563f4d5e0e41ef96f4cdceb7427db84
BASE_ORIGIN_MAIN = 09e8f34e8563f4d5e0e41ef96f4cdceb7427db84
NODE = v26.7.0
NPM = 11.19.0
PRODUCT_CODE_CHANGED = NO
DEPENDENCIES_INSTALLED_OR_CHANGED = NO
PRODUCTION_READ_OR_MUTATION = NONE
COMMIT = NONE
PUSH = NOT_ATTEMPTED
PR = NOT_CREATED
MERGE = NOT_ATTEMPTED
```

## Stop trigger

The Owner mandate in `BRIEF-637-DEFECT-A.md` and the current task explicitly
requires: “失败即停写 STOPPED-637.md”. The unchanged Scheduler baseline failed
before the defect reproduction or implementation. Work stopped when exit 1
was observed; subsequent actions were read-only failure diagnosis and this
required stop record. No dependency installation, workaround, test retry,
product/test edit, commit, push or PR submission followed the failure.

Command, executed from the worktree above:

```sh
npm run test:scheduler > docs/evidence/issue-637/BASELINE-scheduler.txt 2>&1
```

```text
EXIT_CODE = 1
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'croner' imported from /private/tmp/h637-fix/packages/scheduler/src/schedule.js
ℹ tests 137
ℹ suites 0
ℹ pass 99
ℹ fail 38
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2451.704208
```

The runner counts include failed test-file loads. They are **not** a completed
Scheduler test inventory or the requested 469/469 acceptance result.

Raw unmodified log:
[`docs/evidence/issue-637/BASELINE-scheduler.txt`](docs/evidence/issue-637/BASELINE-scheduler.txt)

```text
SHA256 = 3ba4d3041aa9d958ec59d3e64a437cf9cdf3029d20e9db72857b989b61142434
```

## Authority and preparation completed

- Confirmed the specified branch, HEAD and origin/main baseline; initially
  only the supplied Brief was untracked.
- Read the repository entrypoint, shared/local governance, relevant Product
  Architecture, D-009 and accepted Scheduler implementation Contracts.
- Read live issues #637 and #417 through the GitHub connector. No GitHub
  issue/comment/PR mutation occurred.
- Recorded `REUSE + BRIEF + DURABLE` preflight in the supplied Brief.
- Independent read-only authority review found classifier normalization
  supportable under `SCHEDULER_TIMEOUT_OUTCOME_V3` C-004/C-005/C-008/C-011
  and watchdog `CTR-RECON-001`, without changing Product Contracts.
- Located the real isolated Router persistence fixture:
  `TurnReconciliationStore`, `settleDirect`, durable reopening and
  `resolveCallerCorrelation`; and Scheduler's existing canonical reservation,
  restart sweep and #417 tests. This is preparation, not executed reproduction.

## Remaining work and minimum prerequisite

```text
FINDING_CLASS = REQUIRED_GATE_FAILURE
SOURCE = Owner task: existing Scheduler suite must be green; failure means stop
COUNTEREXAMPLE = unchanged baseline cannot import declared runtime dependency croner
IMPACT = independent reproduction and full Scheduler acceptance cannot execute
MINIMAL_CLOSURE = restore declared dependencies in this isolated worktree, then resume under Owner direction
AFFECTED_READINESS = implementation NO; acceptance NO; push/PR NO; production NOT_AUTHORIZED
```

No #637 RED or GREEN result exists yet. The defect remains unmodified and
unverified in this worktree. `RECEIPT-637.md`, acceptance tests, final review,
push and PR remain unperformed. Existing source and production are unchanged.
The only local additions are the supplied Brief with preflight, this stop
record and the raw baseline log. Do not treat these as a completed delivery.
