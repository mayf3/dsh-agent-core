# STOPPED-EKR-B1B4 — required regression gates failed

STATUS = STOPPED
STOP_RULE = user contract: 失败即停写 STOPPED-EKR-B1B4.md
IMPLEMENTATION_ALLOWED_AFTER_FAILURE = NO
MERGE_READY = NO
PRODUCTION_OPERATION_ALLOWED = NO

Repository: mayf3/dsh-agent-core; worktree `/private/tmp/dsh-ekr-b1b4`;
branch `ac-ekr-b1b4`; base/current remote main
`1e7233c7b3b081fd30c94de75cf5ba348e2cb323`; local candidate
`eb790bbe94fcefb0a82ed1aca16414bfc0d5be9d`.

## Concrete failures

1. REQUIRED_GATE_FAILURE — `npm run test:scheduler` exited 1. Source:
   the contract requires existing scheduling regressions. Counterexample:

   ```text
   Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'croner' imported from /private/tmp/dsh-ekr-b1b4/packages/scheduler/src/schedule.js
   ```

   Impact: scheduling compatibility remains unverified. Minimum closure on a
   resumed task: provide the repository's declared dependencies in this isolated
   worktree, then run the required scheduler and scheduler-router suites.
   The `&&` prevented scheduler-router execution. No dependency install or rerun
   was attempted after failure. Full scheduler stdout was not retained because
   redirection applied only to the second command; the terminal excerpt above
   and observed process exit code are the available evidence. Do not claim a
   complete raw scheduler log or a test count.

2. REQUIRED_GATE_FAILURE — the already-started Workflow suite exited 1:
   231 tests, 229 pass, 2 fail. Full original output:
   [workflow-regression.raw.txt](docs/evidence/ekr-b1b4/workflow-regression.raw.txt).
   One file could not load the declared `@deepseek-ai/schemastery` dependency:

   ```text
   Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@deepseek-ai/schemastery' imported from /private/tmp/dsh-ekr-b1b4/packages/agent-router/src/index.js
   ```

3. REQUIRED_GATE_FAILURE — an authored regression assertion is wrong:
   `packages/workflow-execution/test/stale-quiescence.test.js:176` calls
   `.startsWith()` on the Buffer returned by `f.bytes()`:

   ```text
   TypeError: f.bytes(...).startsWith is not a function
   ```

   Impact: the changed UNKNOWN regression cannot certify its intended property.
   Minimum closure on resumption: compare Buffer prefixes or explicitly decode
   UTF-8 before string operations, retaining the assertions that original bytes
   survive and appended records are only permitted responsibility metadata.
   This defect was not repaired after the stop trigger.

## Preserved state and incomplete work

- No source changes after the first observed gate failure. Already-running
  tests were allowed to finish; subsequent writes are stop/receipt/evidence only.
- Focused B1/B4 tests passed 11/11, including actual isolated HTTP503 and process
  exit/restart with the existing engine poller. This does not override failed gates.
- Structure V2: `CANDIDATE_DELTA_PASS_WITH_BASELINE_DEBT`, 0 candidate violations,
  28 inherited debt findings. Governance integrity passed. Both requested diff
  checks passed; cached check excludes `docs/evidence/**` as authorized.
- Independent affected-Contract review of the exact candidate was interrupted;
  it is NOT PASS. Unclosed checks: trusted historical dispatch-baseline evidence
  branch (ACC-006), and B1 still-current responsibility versus the existing stale
  consumer. Neither is asserted to be a proven extra blocker.
- No push, no PR, no merge, no production write, no window-tool change.
- Local candidate commit is retained for resumption; stop/receipt/evidence are
  uncommitted. Original untracked Brief is unchanged.
- Installed/loaded state, actual production UNKNOWN/blocked records, live
  cross-service/DB behavior and unattended business acceptance remain UNKNOWN.

This is a resumable failed candidate, not a completed B1/B4 delivery.
