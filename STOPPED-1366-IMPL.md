# STOPPED-1366-IMPL

Unexpected required-gate result: workflow-existing. Actual rc=1; expected rc=0; counts={'tests': 333, 'pass': 332, 'fail': 1, 'skipped': 0}.

Source/test writes and PR delivery stopped. Raw: docs/evidence/1366-locktiming/workflow-existing.txt; metadata: workflow-existing.json. No production writes. Owner task failure-stop applies.

## Exact checkpoint

- Worktree: `/private/tmp/h1366-impl`; branch `fix/wec4-lock-timing`.
- Base: `b6ddc2a67ba041b8b13ed33d331104cf809d4985`.
- Candidate: `51149193bc811fff26b2a9afbccad9937e626720` (local commit only).
- Failed gate interval: `2026-11-07T17:40:03.213249+00:00` to `2026-11-07T17:40:39.272040+00:00`.
- Frozen blocker union: `[B1366-001]`; blocking class `REQUIRED_GATE_FAILURE`.
- IMPLEMENTATION_COMPLETE=NO; SOURCE_PR_DELIVERY=NO; MERGE_READY=NO; OPERATION_ALLOWED=NO.
- No push, PR, merge, production installation, production writes, runtime reload, dependency install or rebase occurred. Existing node_modules symlink was only verified.

## Concrete failed observation

`packages/workflow-execution/test/engine.test.js:421`:
`malformed due records are skipped loudly; valid ones still admitted`.
The assertion at line 430 observes `ledger.snapshot().length === 0`, expected `1`.
The sweep still produces one admission-result entry, but final validation refuses the page and appends no plan.

The fixture supplies `[dueIntent({nodeVisitId:'garbage'}), {foo:1}, dueIntent()]`
to both sweep and canonical validation. The first malformed row shares the target
dispatchIntentId; it is not demonstrated to be unrelated to that target.
`packages/workflow-execution/src/owner-assistance-resume-engine.js:87` rejects any
malformed row before considering the valid tuple. No corrective source or fixture
change was made after the gate failed.

Authority to preserve on any explicitly resumed repair: accepted PPR V1's carried
CTR-WAE-001 (malformed sweep records skipped loudly), WEC4 CTR-WEC4-010 (fresh exact
canonical equality, malformed/ambiguous required target proof grants nothing), and
the existing regression assertion. Determine the bounded product/fixture closure
without weakening either requirement; then rerun the failed and invalidated gates.
This is a handoff only, not current permission to repair past the stop.

## Executed evidence and remaining gates

| Gate | Actual result | Raw output |
| --- | --- | --- |
| Initial RED, unchanged worktree product source | expected rc1, 2 failures | `docs/evidence/1366-locktiming/RED.txt` |
| RED rebound to final test inputs and exact base product in isolated temp tree | expected rc1, 2 failures | `docs/evidence/1366-locktiming/RED-final-fixtures.txt` |
| GREEN, actual persistent ledger / separate writer processes and targeted negative/crash cases | rc0, 37/37, zero skipped | `docs/evidence/1366-locktiming/GREEN.txt` |
| Existing workflow suite, 31 explicit files | rc1, 332/333, zero skipped | `docs/evidence/1366-locktiming/workflow-existing.txt` |
| Integration / broker / publication / final delivery review | NOT_RUN after stop | none |

The historical `stale-quiescence.test.js` file was excluded under the mandate's
existing recipe, not counted as passed. Test children alone had the nine proxy
keys removed. Executed Node version was v26.7.0; every command, runtime coordinate,
test/source SHA-256 and raw-output hash is recorded in each adjacent JSON file.

GREEN proves B completed before A's barrier was released in both designated
collection intervals, with the collection lock absent. Each writer delivered once;
Owner evidence was collected exactly once. Date.now has millisecond resolution,
so B completion and the subsequent parent release can carry the same timestamp;
the parent awaited B's completion reply before sending A's release. The separately
injected final-validation wait was 403 ms with B blocked; reacquisition contention
was 163 ms and the changed external version was refused. These are isolated
mechanism observations, not production acceptance or overall implementation PASS.

Verified raw SHA-256:

- RED-final-fixtures: `df775d07c7bc686c8be11d6bbf6d75bd9f1fcfc8537b955054c1fa94307f56fd`.
- GREEN: `a8192dc912e010b439205d05fb51719bc193ea9225d1ee1353b589718e5eda3d`.
- workflow-existing: `dc5f3e476e439f089e8045f6005641ee665616fc8dcc403bd2c198915ecb5916`.

Non-author `/root/authority_and_tests` independently inspected exact candidate
51149193 and persisted logs, without edits or test execution. The primitive lock
boundary and manual structure inspection found no additional concrete blocker;
the failed regression gate prevents acceptance and delivery. No machine structure
PASS is claimed (the repository records V3 verifier qualification as separate work).

Source/test tree remains frozen at the candidate commit. Only raw evidence and
this mandated stop record were written afterward; they remain local untracked
artifacts. `RECEIPT-1366-IMPL.md` is not produced as a successful delivery receipt.

## Historical stop resumed by Owner R2 instruction — 2026-11-08

The original stop above remains unchanged as R1 history. Owner explicitly
authorized diagnosis and repair of this one failed test, then the same delivery.
No product code repair was required: the failing ledger-row expectation did
not account for WEC4's new fail-closed canonical validation of the same malformed
feed. R2 test-only commit: `f1db5b4c382b25ae12769b7e7091de35f2645500`.
R2 workflow 333/333 rc0; integration 29/29 rc0; broker 80/80 rc0. Raw outputs and
exact input-hash bindings are in `docs/evidence/1366-locktiming/r2/`.
Independent affected-Contract semantic review PASS. PR #663 targets main and
remains unmerged. This is no longer an unresolved R1 delivery stop; any new
unexpected required-gate failure still stops the resumed task.
