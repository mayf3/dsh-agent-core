# Hardender stage report — dsh-trusted-ingress-align-2

Station: hardender (mutation_hardening)
Terminal candidate: HEAD = `997b51e` (sixpack(architect)) on BASE = `16e14233fbac1ccbdc00598097380da659e1ecd2`.
Replacement candidate for dsh-trusted-ingress-align-1 (PR #177 @ `dd100382`; independent review 5123376463: PRODUCT_TEST_FIX=ACCEPT, blocker B1 = QA-theatre fail-open).

## Verdict

【品味评分】🟢 好品味

NO candidate change was needed beyond this report. The accepted alignment is already mutation-tight: every mutant I injected into the affected trusted-context builder (`packages/agent-router/src/ingress-delivery.js:104-111`) was killed by exactly one test — the accepted `TRUSTED_INGRESS` property test — with a clean 8 pass / 1 fail split each time. One strict 6-field `deepEqual` plus the decoy openId and the freeze assertion eliminates the entire mutant class without a single special case. Adding any hardening code would only add drift to a byte-frozen accepted file. The only file this station writes is this report.

## What was checked (all executed on this worktree)

### 1. Accepted alignment re-proven (work item 1 intact)

- Test file blob at HEAD = `fcf899290b6241adc74346773f2c4c625c095223` = blob at accepted PR #177 head `dd100382` (byte-identical re-application).
- `git diff --name-only BASE..HEAD` product delta = exactly `packages/agent-router/test/feishu-regression.test.js`; `src/`, `docs/`, `package.json`, `.github/` untouched (re-swept this station).
- Canonical run: `node --test packages/agent-router/test/feishu-regression.test.js` → **9/9 pass, exit 0** (tests=9 pass=9 fail=0).
- Full agent-router suite (repo glob convention `git ls-files 'packages/agent-router/**/*.test.js'`) → **310 tests / 309 pass / 0 fail / 1 skipped, exit 0**. The single skip is pre-existing and env-dependent (predates BASE; independently observed by the architect station). No new failures vs BASE.

### 2. Mutation hardening — 8 mutants injected into the affected behavior, all KILLED

Method: each mutant was applied to `src/ingress-delivery.js` (temporary in-place edit), the canonical test file was executed, and the file was restored byte-exactly (`git checkout --`, `git diff --quiet` asserted after every probe). Results:

| Mutant | Injected defect (trusted `ingressContext`) | Verdict | Killer |
|---|---|---|---|
| M1 | `feishuSenderOpenId` parsed from untrusted prompt text (`/ou_[A-Za-z0-9_]+/` over `ingress.text`) | **KILLED** (8/1) | TRUSTED_INGRESS decoy (`ou_decoy_id` in text vs `ou_test` expected) |
| M2 | `feishuChatId` sourced from `ingress.conversationId` (the parse regression) | **KILLED** (8/1) | TRUSTED_INGRESS strict `deepEqual` + no-parse assertion |
| M3 | `Object.freeze` dropped (immutability lost) | **KILLED** (8/1) | `Object.isFrozen(trusted) === true` |
| M4 | 6th field `feishuSenderOpenId` dropped | **KILLED** (8/1) | strict `deepEqual` (missing key) |
| M5 | extra 7th field `feishuExtra` sneaks in | **KILLED** (8/1) | strict `deepEqual` (extra key) |
| M6 | `feishuConversationId` sourced from `ingress.chatId` | **KILLED** (8/1) | strict `deepEqual` |
| M7 | `feishuMessageId` silently dropped | **KILLED** (8/1) | strict `deepEqual` |
| M8 | raw message subtype (`'thread'`) leaks as `channelNamespace` | **KILLED** (8/1) | strict `deepEqual` (`'thread'` vs `'feishu'`) |

**Surviving mutants: 0.** Every mutant's sole killer is the accepted `TRUSTED_INGRESS` test — a single tight killer per contract property, which is exactly what you want from a boundary test. Per-mutant limitations: none to record (nothing survived).

### 3. Fail-closed property of the QA gate re-proven first-hand (blocker B1, work item 2)

- Negative probe: expected `feishuSenderOpenId: 'ou_wrong'` injected into the test file, then `bash sixpack-artifacts/qa_required_checks.sh` → **exit 1** with `RESULT: end-to-end verification through the public user boundary = FAIL (real "node --test ..." exited nonzero ...)`. File restored; `git status --porcelain` empty afterwards.
- Script starts with `set -euo pipefail`; the node test invocation is consumed directly in an `if !` guard, never piped away — a nonzero test exit cannot be swallowed.
- No echo/ls theatre: canonical check 1 = real `node --test` exit code; check 2 = mechanical derivation from `git diff --name-only BASE..HEAD` (changed-file list printed as scope rationale; working-tree cleanliness is only reported as an out-of-scope note, never as a CRAP/DRY verdict); check 3 = real assertions (declared-checks set-equality via sorted comparison, entrypoint existence, exec bit).
- Node resolution (work item 3): no `/tmp/node` literal (`grep -c '/tmp/node'` = 0); `SIX_PACK_NODE_PATH` override honored (`SIX_PACK_NODE_PATH="$(command -v node)"` → resolves, prints version `v26.7.0`, exit 0); unavailable binary → **exit 1** with a clear FATAL line.
- Canonical check names declared verbatim in `qa.automation.json` (flat, `entrypoint` = bare filename `qa_required_checks.sh`) and set-equal to the three names the script evaluates and reports — asserted mechanically by the script itself, exit 0 on this tree.

### 4. Post-hardening CRAP/DRY gate — evaluated

- Gate: `<=10` changed-file default. Mechanical set `git diff --name-only BASE..HEAD` = **7 committed files** (1 accepted test file + 6 `sixpack-artifacts/` stage files); projected after this report commits = **8**. Both ≤ 10 → **gate PASS**.
- Non-test product files in the set: 0 → CRAP/DRY/structure = **governed NOT_APPLICABLE** (test-only scope, changed-file list printed by the script), never derived from working-tree cleanliness.
- Final green sweep on the restored terminal tree: canonical file 9/9 exit 0; full suite 310/309/0-fail; `bash sixpack-artifacts/qa_required_checks.sh` → **exit 0** with all three canonical `RESULT:` lines evidence-backed (tests=9 pass=9 fail=0; governed NOT_APPLICABLE; set-equality + exec-bit PASS).

## What was changed

- `sixpack-artifacts/hardender.report.md` (this file) — the only file. All mutation probes were temporary, byte-exact-restored, and verified clean; the terminal tree at handoff is byte-identical to `997b51e` plus this report.

## Required checks (station contract)

- "surviving mutants killed or limitations recorded": 8/8 mutants killed, **0 survivors**, per-mutant killers recorded above; no limitations required.
- "post-hardening CRAP gate (<=10 changed-file default) evaluated": 7 committed (8 projected) ≤ 10 → PASS, recorded above with the mechanical file set.

## Limitations

- Mutation scope was proportionally confined to the affected behavior (the trusted `ingressContext` builder pinned by this task's alignment). A package-wide exhaustive mutation campaign was not run and is not warranted by the one-file test-only delta.
- BASE full-suite comparison was not re-executed in a separate checkout (mandate restricts work to this worktree); the pre-existing status of the single skip rests on the architect station's same-tree observation. Fail count is 0 on this tree either way.
- The task record's "agent-router full suite 240 tests" does not match measured reality on this BASE (310 tests via the repo glob convention; 0 failures, 1 pre-existing skip). Actuals govern; no regression. `node --test <dir>` form also remains broken on this node build (pre-existing, documented in PR #177); the QA script's per-file form is unaffected.
- `send_notification` MCP is not in this station's toolset; pipeline notification is left to the delivery helper.
- Out of station scope (per role boundary): behavior_specification, qa_procedure, implementation, cleanup, architecture, executable_qa_automation ownership, final QA receipt, `sixpack verify`, and commits (delivery helper commits).
