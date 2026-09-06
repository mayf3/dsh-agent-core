# SPECIFIER QA PROCEDURE — dsh-trusted-ingress-align-2 (human-readable; executable bytes owned by QA station)

```text
TASK_ID = dsh-trusted-ingress-align-2
OWNER_MANDATE = OWNER-MANDATE-2026-09-06-ALIGN2-CORRECTED-REPLAY-WINDOW
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = task record DONE_WHEN + independent review 5123376463 blocker B1
BASE = 16e14233fbac1ccbdc00598097380da659e1ecd2
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
IMPLEMENTED_BY = QA station (owns qa.automation.json + qa_required_checks.sh + qa.report.md)
```

## 0. Ownership boundary (corrected replay)

- The SPECIFIER owns ONLY this procedure text. The executable automation
  (`sixpack-artifacts/qa.automation.json`, `sixpack-artifacts/qa_required_checks.sh`)
  is authored, committed, and certified by the QA station.
- The QA automation previously shipped by the rejected replay attempt
  (singular-key manifest + `set -u`-only script lineage) was DELETED from this
  candidate by the specifier replay. Its bytes are DIAGNOSTIC_EVIDENCE_ONLY and must
  NOT be cherry-picked; QA authors fresh automation to THIS procedure.

## 1. Manifest schema (hard requirement)

`sixpack-artifacts/qa.automation.json` MUST use the runtime-gate schema with the PLURAL
array key, flat, entrypoint as bare filename:

```json
{
  "entrypoints": ["qa_required_checks.sh"],
  "checks": [
    "end-to-end verification through the public user boundary",
    "final CRAP/DRY checks on the terminal candidate",
    "handoff and manifest consistency"
  ]
}
```

- A singular `"entrypoint"` key is REJECTED by the runtime gate ("declares no
  entrypoints"). This exact defect is why the prior attempt was rejected.
- The three canonical check names are declared VERBATIM, in this exact wording; no
  downstream station may rename them.

## 2. Script fail-closed requirements

`qa_required_checks.sh` (exec bit set) MUST:

1. Start with `set -euo pipefail` (or strict equivalent); ANY failed step aborts the
   script nonzero.
2. The `node --test` invocation failure MUST fail the script (no piping the test output
   into `tail`/filters that swallow the exit code; if a pipe is used it must propagate
   `PIPESTATUS`).
3. Resolve node WITHOUT hardcoded environment paths (zero `/tmp/node*` literals):
   `SIX_PACK_NODE_PATH` env override if set, else `node` from PATH; print the resolved
   binary + version; exit nonzero with a clear diagnostic if unavailable.
4. Commitment ordering: automation MUST be committed BEFORE final QA; the gate runs on
   the COMMITTED terminal candidate.

## 3. The three canonical checks (mechanically determined; no echo/ls theatre)

### Check 1 — "end-to-end verification through the public user boundary"

- Real `node --test packages/agent-router/test/feishu-regression.test.js` executed on the
  terminal candidate; its actual exit code gates the script.
- Result line must be evidence-backed with parsed counts, e.g. `RESULT ... PASS
  tests=9 pass=9 fail=0`. Target: 9/9.

### Check 2 — "final CRAP/DRY checks on the terminal candidate"

- Scope is computed MECHANICALLY from the real committed changed-file set:
  `git diff --name-only 16e14233fbac1ccbdc00598097380da659e1ecd2..HEAD`.
- The actual changed-file list is printed as the scope rationale.
- For a test-only scope, CRAP / DRY / structure each print a governed
  `NOT_APPLICABLE` evidence line carrying that rationale.
- Working-tree cleanliness MUST NEVER be reported as a CRAP/DRY PASS.
- A non-test product file appearing in the diff MUST fail the script (fail closed),
  never produce a fabricated verdict.

### Check 3 — "handoff and manifest consistency"

- Real assertion, not prose: the check names declared in `qa.automation.json` must be
  SET-EQUAL (order-insensitive, duplicates rejected) to the exact check names the script
  evaluates and reports (single-source constants shared by both sides of the assertion).
- The entrypoint named in the manifest must exist on disk WITH the exec bit; absence or
  missing exec bit fails the script.
- Any mismatch fails the script nonzero.

## 4. Required negative probes (fail-closed property = QA evidence)

All probes write output files INSIDE the worktree (opencode rejects writes to external
directories such as `/tmp`); use e.g. `./probe.out` and delete scratch files afterwards:

1. Deliberately broken test (e.g. expected `feishuSenderOpenId: 'ou_wrong'`) ->
   script MUST exit nonzero, check 1 reported FAIL.
2. Manifest drift (alter one declared check name) -> script MUST exit nonzero,
   set-equality FAIL.
3. Exec bit removed from the entrypoint -> script MUST exit nonzero.
4. `SIX_PACK_NODE_PATH=/nonexistent/node` -> script MUST exit nonzero with a clear
   diagnostic.
5. Happy path on the committed terminal candidate -> exit 0, all three canonical
   RESULT lines present and evidence-backed.

## 5. Final QA protocol

- Fresh final QA on the UNCHANGED exact certified Head/tree; final QA must not modify
  certified bytes (no self-certification; upstream product bytes are frozen at that
  point).
- `bash sixpack-artifacts/qa_required_checks.sh` -> exit 0 with all three canonical
  check lines present and evidence-backed per Sections 3-4.
- Full agent-router suite re-run: 0 failures, no new failures vs base baseline
  (specifier-recorded base observation: 310 tests / 308 pass / 1 fail (TRUSTED_INGRESS
  gap) / 1 pre-existing skip; post-coder expectation: 309 pass / 0 fail / 1 skip).
- Product-tree diff vs BASE limited to
  `packages/agent-router/test/feishu-regression.test.js`.
- `sixpack verify` PASS.
- Finish with `sixpack-artifacts/qa.report.md` as the station's last action and print
  the FINAL `QA_FINAL_JSON` line binding the certified head/tree.
