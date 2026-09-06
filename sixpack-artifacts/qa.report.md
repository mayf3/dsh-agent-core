# QA REPORT — dsh-trusted-ingress-align-2 (corrected replay window)

```text
TASK_ID = dsh-trusted-ingress-align-2
OWNER_MANDATE = OWNER-MANDATE-2026-09-06-ALIGN2-CORRECTED-REPLAY-WINDOW
ROLE = QA (owns executable_qa_automation; final_qa_receipt)
HEAD = b44bf04 (unchanged upstream candidate: specifier -> coder -> cleaner -> architect -> hardender)
BASE = 16e14233fbac1ccbdc00598097380da659e1ecd2
UPSTREAM QA AUTOMATION AT START = none (deleted by specifier replay; prior attempt bytes DIAGNOSTIC_EVIDENCE_ONLY, not cherry-picked)
```

## 1. What this station created (ownership: executable QA automation)

| File | Content |
|---|---|
| `sixpack-artifacts/qa.automation.json` | Runtime-gate schema: plural `"entrypoints": ["qa_required_checks.sh"]` + verbatim three canonical checks. |
| `sixpack-artifacts/qa_required_checks.sh` | Exec-bit fail-closed automation (set -euo pipefail), authored fresh to the specifier procedure. |
| `sixpack-artifacts/qa.report.md` | This report. |

No upstream product bytes were modified: `git status` shows only the three QA files as
new; `git diff` over tracked files is empty; the product-tree diff vs BASE remains
exactly `packages/agent-router/test/feishu-regression.test.js`.

## 2. Fail-closed properties of `qa_required_checks.sh`

- `set -euo pipefail`; every step's real exit code gates the script; single
  `fail()` path emits an evidence-backed `RESULT ... FAIL` line and exits 1.
- Node resolution: `SIX_PACK_NODE_PATH` override if set, else `node` from PATH;
  resolved binary + version printed (`NODE resolved: node (v26.7.0)`); unresolvable
  binary => `FATAL ...` + exit 1. Zero `/tmp/node*` literals (grep-verified).
- Canonical check 1: real `node --test --test-reporter=tap
  packages/agent-router/test/feishu-regression.test.js`; captured via command
  substitution with `||` (no pipe can swallow the exit code); counts parsed from the
  script's own output; `fail != 0 || pass != tests || tests == 0` => FAIL.
- Canonical check 2: scope computed MECHANICALLY from
  `git diff --name-only BASE..HEAD`; the actual changed-file list is printed; product
  scope (sixpack-artifacts/ excluded) is asserted test-only — any non-test product file
  FAILS the script (no fabricated verdict). Governed `NOT_APPLICABLE` lines for
  crap/dry/structure carry that mechanical rationale. Working-tree cleanliness is never
  consulted as CRAP/DRY evidence.
- Canonical check 3: single node assertion — manifest schema (exactly one bare
  `qa_*.sh` entrypoint string), declared checks SET-EQUAL (order-insensitive,
  duplicates rejected) to the three canonical names the script itself evaluates and
  reports (single-source bash constants passed as argv), and each declared entrypoint
  exists with the exec bit (`fs.accessSync(X_OK)`). Any drift => nonzero with both
  sets printed.

## 3. Probe evidence (all probe outputs written INSIDE the worktree as `./probe.out`, then deleted; every mutated file restored byte-exact and `git diff --quiet` verified)

| # | Probe | Expected | Observed |
|---|---|---|---|
| 1 | `feishuSenderOpenId: 'ou_test'` -> `'ou_wrong'` in the target test | script exits nonzero, check 1 FAIL | `PROBE1_RC=1`, `RESULT end-to-end verification ... FAIL: node --test ... exited nonzero`; test file restored byte-exact |
| 2 | one declared check name drifted in `qa.automation.json` | script exits nonzero, set-equality FAIL | `PROBE2_RC=1`, `SET-EQUALITY FAIL: declared=[...] script-evaluated=[...] drift=[...]` |
| 3 | exec bit removed from entrypoint | script exits nonzero | `PROBE3_RC=1`, `ENTRYPOINT NOT EXECUTABLE (exec bit required)`; bit restored (`rwxr-xr-x`) |
| 4 | `SIX_PACK_NODE_PATH=/nonexistent/node` | script exits nonzero, clear diagnostic | `PROBE4_RC=1`, `FATAL: node binary not resolvable: '/nonexistent/node' ...` |
| 5 | happy path on terminal candidate | exit 0, all three canonical RESULT lines | exit 0; all three evidence-backed lines present (see section 4) |

Fail-closed property is thereby DEMONSTRATED, not asserted: the same script that exits
0 on the terminal candidate exits nonzero on each of the four injected defects.

## 4. Verification results on the terminal candidate (HEAD b44bf04)

- `bash sixpack-artifacts/qa_required_checks.sh` -> **exit 0** with:
  - `RESULT end-to-end verification through the public user boundary PASS tests=9 pass=9 fail=0 via real node --test packages/agent-router/test/feishu-regression.test.js`
  - `RESULT final CRAP/DRY checks on the terminal candidate NOT_APPLICABLE (governed: test-only product scope per mechanical BASE..HEAD diff) crap=NOT_APPLICABLE dry=NOT_APPLICABLE structure=NOT_APPLICABLE` + full changed-file list printed
  - `RESULT handoff and manifest consistency PASS manifest set-equality asserted (declared == script-evaluated) + entrypoint present with exec bit`
- Full agent-router suite (`node --test` over `git ls-files` test globs, explicit file
  form): **310 tests / 309 pass / 0 fail / 1 skipped (pre-existing, env-dependent,
  predates BASE) / 0 cancelled**, exit 0. No new failures vs BASE. The coder alignment
  fixes exactly the stale 5-field expectation and nothing else (probe 1 flips exactly
  check 1).
- Product-tree diff `git diff --name-only BASE..HEAD -- . ':!sixpack-artifacts'` =
  exactly `packages/agent-router/test/feishu-regression.test.js`. `src/`, `docs/`,
  `package.json`, `.github/` untouched.
- Manifest `qa.automation.json` uses the runtime-gate plural `"entrypoints"` schema;
  entrypoint is a bare filename with exec bit; automation committed BEFORE final QA
  (delivery helper commits; this station performs no git commit/push).

## 5. Limitations (recorded, not worked around)

1. `sixpack verify` was NOT reproducible from inside this station: the local runtime
   workspace task registry is empty (`status` -> `"tasks": {}`), so
   `sixpack verify --task-id dsh-trusted-ingress-align-2 .` returns
   `{"rejected": "WORKFLOW_INVALID", "detail": "unknown task ..."}`. Verify/merge
   authority belongs to the delivery helper/host which owns the registry; this station
   claims no acceptance or merge authority. All other DONE_WHEN evidence above is
   mechanically reproduced here.
2. Directory-form `node --test packages/agent-router/test/` spuriously fails on this
   node build (pre-existing, observed by cleaner/hardender independently); the full
   suite was therefore run over explicit file globs.
3. The task record's "agent-router full suite 240 tests" figure does not reproduce
   under the canonical invocation (310 tests observed; 240-figure already flagged stale
   by cleaner and hardender). The load-bearing assertion — 0 failures, no new failures
   vs base — holds.

## 6. Final QA receipt

Fresh final QA re-runs `bash sixpack-artifacts/qa_required_checks.sh` read-only on the
UNCHANGED exact Head/tree and prints the machine-bindable
`QA_FINAL_JSON` line as the last line of stdout. Per the FINAL-RUN ZERO-MUTATION
DIRECTIVE the final run creates/modifies/touches/deletes NO file — the report above is
final; the final run only re-verifies and prints the receipt line.
