# Hardender stage report — dsh-trusted-ingress-align-2 (corrected replay)

Station: hardender (mutation_hardening)
Terminal candidate: HEAD = `f8120c0` (sixpack(architect), corrected-replay chain
specifier 1b6c9fd -> coder 44e471c -> cleaner f8e58ae -> architect f8120c0)
on BASE = `16e14233fbac1ccbdc00598097380da659e1ecd2`.
Replacement candidate for dsh-trusted-ingress-align-1 (PR #177 @ `dd100382`;
independent review 5123376463: PRODUCT_TEST_FIX=ACCEPT, terminal candidate REVISE,
blocker B1 = QA-theatre fail-open).
Prior hardender receipt (committed at 82e06e1 chain, bound to first-pass Head `997b51e`)
is downstream-obsolete: it predates the corrected specifier replay and references
QA-automation bytes that no longer exist at this Head by design. Not reusable; this
report supersedes it.

## Verdict

【品味评分】🟢 好品味

NO candidate change is needed beyond this report. The accepted alignment is already
mutation-tight: all 8 mutants I injected into the affected trusted-context builder
(`packages/agent-router/src/ingress-delivery.js:104-111`) were killed by exactly one
test — the accepted `TRUSTED_INGRESS` property test — with a clean 8 pass / 1 fail
split each time. One strict 6-field `deepEqual`, the decoy self-reported openId in the
input text, the structurally-distinct `conversationId` vs `chatId`, and the freeze
assertion eliminate the entire mutant class with zero special cases. Injecting any
"hardening code" would only drift a byte-frozen accepted contract. The only file this
station writes is this report.

## What was checked (all executed on this worktree, probes inside the worktree)

### 1. Accepted alignment intact on the replayed candidate

- Target test file blob at HEAD = `fcf899290b6241adc74346773f2c4c625c095223` =
  blob at accepted PR #177 head `dd100382a23509c67a35cf919e8cda07da1d43d0`
  (byte-identical re-application by the coder replay).
- Product-tree delta `git diff --name-only BASE..HEAD -- . ':!sixpack-artifacts'`
  = exactly `packages/agent-router/test/feishu-regression.test.js`. `src/`, `docs/`,
  `package.json`, `.github/` untouched (re-swept this station).
- Canonical run: `node --test packages/agent-router/test/feishu-regression.test.js`
  -> **tests 9 / pass 9 / fail 0, exit 0**.
- Full agent-router suite (explicit file globs over `git ls-files` test patterns;
  directory-form `node --test` remains spuriously broken on this node build,
  pre-existing) -> **310 tests / 309 pass / 0 fail / 1 skipped, exit 0**. The single
  skip is pre-existing and env-dependent (predates BASE; independently observed by the
  replay architect). No new failures vs BASE. (The task record's "240 tests" figure
  does not reproduce under the recorded invocation; 310 is the mechanically observed
  count. The load-bearing assertion — 0 failures, no new failures — holds either way.)

### 2. Mutation hardening — 8 mutants injected into the affected behavior, all KILLED, 0 survivors

Method: each mutant was applied to `src/ingress-delivery.js` (temporary in-place edit;
edit-application asserted, probe output written to `./probe.out` inside the worktree),
the canonical test file executed, and the file restored byte-exactly
(`git checkout --`, `git diff --quiet` asserted after every probe; final
`git status --porcelain` empty). Results:

| Mutant | Injected defect (trusted `ingressContext`) | Verdict | Sole killer |
|---|---|---|---|
| M1 | `feishuSenderOpenId` scraped from untrusted prompt text (`/ou_[A-Za-z0-9_]+/` over `ingress.text`) | **KILLED** (8/1, exit 1) | TRUSTED_INGRESS decoy (`ou_decoy_id` in text vs `ou_test` expected) |
| M2 | `feishuChatId` sourced from `ingress.conversationId` (the parse regression) | **KILLED** (8/1, exit 1) | TRUSTED_INGRESS strict `deepEqual` + no-parse assertion |
| M3 | `Object.freeze` replaced by `Object.assign` (immutability lost) | **KILLED** (8/1, exit 1) | `Object.isFrozen(trusted) === true` |
| M4 | 6th field `feishuSenderOpenId` dropped | **KILLED** (8/1, exit 1) | strict `deepEqual` (missing key) |
| M5 | extra 7th field `feishuExtra: "leak"` sneaks in | **KILLED** (8/1, exit 1) | strict `deepEqual` (extra key) |
| M6 | `feishuConversationId` sourced from `ingress.chatId` | **KILLED** (8/1, exit 1) | strict `deepEqual` |
| M7 | `feishuMessageId` silently dropped | **KILLED** (8/1, exit 1) | strict `deepEqual` |
| M8 | raw ingress channel (`'thread'`) leaks as `channelNamespace` | **KILLED** (8/1, exit 1) | strict `deepEqual` (`'thread'` vs `'feishu'`) |

Every mutant's sole failing test is verbatim
`TRUSTED_INGRESS: exact Feishu chat/conversation/message fields reach the routed turn
without parsing` — one tight killer per contract property, exactly what a boundary
test should be. Per-mutant limitations: none to record (nothing survived).

### 3. Post-hardening CRAP/DRY gate — evaluated on the real changed-file set

- Gate: `<=10` changed-file default. Mechanical set
  `git diff --name-only 16e14233fbac1ccbdc00598097380da659e1ecd2..HEAD` = **8 committed
  files** (1 accepted test file + 7 `sixpack-artifacts/` stage files; this report
  overwrites the stale first-pass hardender report, so the committed set stays 8).
  8 <= 10 -> **gate PASS**.
- Non-test product files in the set: 0 -> CRAP/DRY/structure = **governed
  NOT_APPLICABLE (test-only scope, changed-file list printed above)**. It is never
  derived from working-tree cleanliness; the restored worktree being clean is a probe
  hygiene fact, not a quality verdict.

## What was changed

- `sixpack-artifacts/hardender.report.md` (this file) — the only file, replacing the
  obsolete first-pass hardender report. All mutation probes were temporary,
  byte-exact-restored, and verified clean; no source, spec, manifest, or QA-automation
  bytes were touched. `qa.automation.json` and `qa_required_checks.sh` are
  intentionally absent at this Head: executable QA automation is QA-owned per the
  corrected-replay ownership directive and is created by the QA station after this
  handoff.

## Required checks (station contract)

- "surviving mutants killed or limitations recorded": 8/8 mutants killed, **0
  survivors**, sole killers recorded above; no limitations required.
- "post-hardening CRAP gate (<=10 changed-file default) evaluated": 8 committed files
  <= 10 -> PASS, recorded above with the mechanical changed-file set.

## Limitations

- Mutation scope was proportionally confined to the affected behavior (the trusted
  `ingressContext` builder pinned by this task's alignment). A package-wide exhaustive
  mutation campaign was not run and is not warranted by a one-file test-only delta.
- BASE full-suite comparison was not executed in a separate checkout (mandate restricts
  work to this worktree); the pre-existing status of the single skip rests on the
  replay architect's same-tree observation. Fail count is 0 on this tree either way.
- Fail-closed script probes and QA-gate negative testing are QA-owned this replay and
  were deliberately NOT performed here (station boundary); the QA station runs them on
  the QA-created automation with probe outputs inside the worktree.
- `send_notification` MCP is not in this station's toolset; pipeline notification is
  left to the delivery helper.
- Out of station scope (per role boundary): behavior_specification, qa_procedure,
  implementation_and_unit_tests, cleanup_and_local_quality_checks,
  architecture_and_property_tests, executable_qa_automation, final_qa_receipt,
  `sixpack verify`, and commits (delivery helper commits).
