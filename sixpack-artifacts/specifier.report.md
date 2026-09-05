# Specifier stage report — dsh-trusted-ingress-align-2

Station: specifier (behavior_specification, qa_procedure)
Worktree: `sixpack-worktrees/dsh-trusted-ingress-align-2__specifier` @ BASE `16e14233fbac1ccbdc00598097380da659e1ecd2`
Replacement candidate for dsh-trusted-ingress-align-1 (PR #177 @ `dd100382a23509c67a35cf919e8cda07da1d43d0`; independent review 5123376463: PRODUCT_TEST_FIX=ACCEPT, terminal candidate REVISE, blocker B1).

## Authority basis (no spec gap)

No `SPEC_GAP.md` was needed: every behavior written here is decided by accepted authority, nothing invented.

- The product contract (6-field frozen `ingressContext` incl. `feishuSenderOpenId`) is ALREADY in BASE: `packages/agent-router/src/ingress-delivery.js:104-111` (frozen construction; `route-chain.js:352-353` consumes `senderOpenId`). The specifier wrote no product code and invented no contract.
- The test alignment is the exact delta accepted in PR #177 (review disposition PRODUCT_TEST_FIX=ACCEPT), re-applied verbatim per the task record.
- The QA procedure rewrite is prescribed point-by-point by the task record as the fix for review blocker B1 (the PR #177 script was `set -u` only, piped `node --test` into `tail` so failures could not fail the script, used `git diff --stat $(git rev-parse HEAD)`/`ls` as CRAP/DRY "checks", and hardcoded `/tmp/node-v25.6.1-darwin-arm64/bin`).

## What was checked

1. BASE verification: worktree HEAD = BASE `16e1423`; `git diff --name-only BASE..HEAD` is empty at specifier entry (bounded-impact recheck premise confirmed locally).
2. Source contract present at BASE (see ingress-delivery.js above), so the test alignment requires zero product-code change.
3. Extracted the accepted PR #177 test blob from `dd100382` and diffed it against the re-applied file: byte-identical, and the `git patch-id` of (BASE -> new file) equals the patch-id of PR #177's accepted delta (`dc49be13b253540c1d2fdaec2c54b12f2b8c5d4b` both sides).
4. Ran the aligned test file: `node --test packages/agent-router/test/feishu-regression.test.js` -> 9 tests / 9 pass / 0 fail, exit 0.
5. Proved the drift being repaired: with the BASE version of the test file (stashed change, uncommitted), the same command exits 1 with 8/9 (stale 5-field `deepEqual` vs the accepted 6-field implementation). Alignment direction confirmed: base fails, aligned candidate passes.
6. Full agent-router suite (glob form: `node --test packages/agent-router/test/*.test.js packages/agent-router/test/route-chain/*.test.js packages/agent-router/test/process-lifecycle/*.test.js`): 310 tests / 309 pass / 0 fail / 1 skipped (pre-existing skip), exit 0.
7. Scope sweep: `git diff --name-only -- packages/agent-router/src docs package.json .github` -> 0 files; product-tree delta is exactly the one test file (+8/-4). Working tree carries only: M `packages/agent-router/test/feishu-regression.test.js`, new `sixpack-artifacts/qa.automation.json`, new `sixpack-artifacts/qa_required_checks.sh`, this report.
8. Fail-closed property of the QA script verified by negative probes in a THROWAWAY scratch git clone under the session temp dir (not in this worktree; scratch committed nothing to the delivery branch and was deleted afterwards). Script copy with only the BASE const substituted (scratch cannot contain the real BASE object). Results:
   - happy path (committed test-only delta): exit 0; all three canonical RESULT lines present: check 1 = PASS via real `node --test` exit code (evidence `tests=9 pass=9 fail=0` printed), check 2 = governed NOT_APPLICABLE with the mechanical changed-file list printed and explicit "never from working-tree cleanliness" evidence, check 3 = PASS via set-equality + entrypoint/exec-bit assertions.
   - deliberately broken test (`feishuSenderOpenId: 'ou_wrong'`): exit 1, check 1 FAIL — the node test failure fails the script.
   - manifest drift (one declared check name altered): exit 1, check 3 set-equality FAIL.
   - exec bit removed: exit 1, exec-bit assertion FAIL.
   - `SIX_PACK_NODE_PATH` set to a valid node binary: exit 0 (override honored, resolved version printed).
   - `SIX_PACK_NODE_PATH=/nonexistent/node`: exit 1 with clear FATAL diagnostic.
   - non-test product file present in BASE..HEAD: exit 1 — the script refuses to fabricate any CRAP/DRY/structure verdict over product code (fail-closed scope gate).
   - empty BASE..HEAD (nothing committed yet): exit 1 with explicit reason — this is the expected pre-commit behavior; final QA must run on the committed terminal candidate.
9. Forbidden-literal check: `grep -c "/tmp/node" sixpack-artifacts/qa_required_checks.sh` -> 0.

## What was changed

1. `packages/agent-router/test/feishu-regression.test.js` — RE-APPLIED the accepted TRUSTED_INGRESS alignment byte-exact (patch-id-proven): `conversationId` fixture de-coincided to `oc_thread_conv:topic_exact`; input text embeds decoy self-reported `ou_decoy_id`; expected frozen `ingressContext` gains the 6th field `feishuSenderOpenId: 'ou_test'` (authenticated sender metadata only); frozen-names assertion via strict `deepEqual` kept; `Object.isFrozen` kept; no-parse assertion (`feishuChatId != feishuConversationId`) kept. No other test touched.
2. `sixpack-artifacts/qa_required_checks.sh` (new, exec bit set) — FAIL-CLOSED QA procedure per B1:
   - `set -euo pipefail`; any failed check aborts nonzero.
   - Node resolution: `SIX_PACK_NODE_PATH` (binary path) override else `node` from PATH; resolved binary + version printed; clear nonzero FATAL when unavailable. No hardcoded environment paths (zero `/tmp/node` literals).
   - Canonical check 1 "end-to-end verification through the public user boundary": real `node --test packages/agent-router/test/feishu-regression.test.js` on the terminal candidate; its exit code gates the script; counts parsed from the real output into the RESULT evidence line.
   - Canonical check 2 "final CRAP/DRY checks on the terminal candidate": scope computed ONLY from `git diff --name-only 16e14233fbac1ccbdc00598097380da659e1ecd2..HEAD` (the real committed changed-file set, printed verbatim as rationale). Test-only scope -> CRAP/DRY/structure each print governed NOT_APPLICABLE evidence. Any non-test product file in scope -> FAIL + exit 1 (never a fabricated PASS). Working-tree cleanliness is never a verdict source; uncommitted changes produce an evidence note that they are outside the gated scope. Empty diff -> FAIL (no delta to gate).
   - Canonical check 3 "handoff and manifest consistency": real assertions — `qa.automation.json` parses with flat `entrypoint` (bare filename `qa_required_checks.sh`, no slash) + string-array `checks`; entrypoint file exists with exec bit; declared check names are SET-EQUAL (order-insensitive sorted comparison, duplicates caught) to the exact names the script evaluates and reports (single source of truth constants). Any mismatch -> FAIL + exit 1.
3. `sixpack-artifacts/qa.automation.json` (new) — flat manifest: `{"entrypoint": "qa_required_checks.sh", "checks": [<the three canonical check names verbatim>]}`.

## QA mechanical protocol reminders carried forward (per task record)

- The three canonical check names are declared verbatim in both the script and `qa.automation.json`; downstream stations must not rename them.
- `qa.automation.json` stays flat with the entrypoint as bare filename.
- Automation must be committed BEFORE final QA; final QA must run on the committed terminal candidate (the script fail-closes on an empty BASE..HEAD, so a pre-commit run cannot fake a green gate).
- Negative-probe evidence requirement for QA: a deliberately broken test must make `bash sixpack-artifacts/qa_required_checks.sh` exit nonzero (verified here in scratch; QA should re-verify on the terminal tree).

## Limitations

- All executions here are on the UNCOMMITTED specifier worktree state; the delivery helper commits. The QA script's check 2 fail-closes until the delta is committed — the committed terminal candidate is where final QA evidence must be produced.
- The scratch negative probes used a script copy with the BASE constant substituted to the scratch clone's base commit (a clone cannot contain the real BASE object); every other byte of the script was identical. The real worktree run (`bash sixpack-artifacts/qa_required_checks.sh`) currently exits 1 at check 2 for the sole reason that BASE..HEAD is empty pre-commit — by design.
- Test-suite count observation: the task record's DONE_WHEN mentions "agent-router full suite 240 tests"; on this BASE the same glob invocation measures 310 tests (309 pass / 1 pre-existing skip / 0 fail). Reported actuals above govern; no test failed and nothing regressed vs the base baseline (base itself had the TRUSTED_INGRESS test failing, 8/9).
- Node environment note: the BASE commit's node resolution depends on the hoisted store at `../node_modules` (two levels above the worktrees); the script resolves `node` via PATH/SIX_PACK_NODE_PATH only and never assumes that store. Directory-form `node --test packages/agent-router/test/` remains broken on some Node builds (content-independent loader failure, pre-existing, documented in PR #177); the per-file/glob form is the canonical invocation.
- `send_notification` MCP is not available in this station's toolset; pipeline notification is left to the delivery helper.
