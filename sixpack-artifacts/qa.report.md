# QA stage report — dsh-trusted-ingress-align-1

Station: QA (executable_qa_automation, final_qa_receipt)
Worktree: sixpack-worktrees/dsh-trusted-ingress-align-1__qa @ base 797952e (dsh-agent-core)
Incoming terminal candidate: 3dd7e95 (specifier -> coder -> cleaner -> architect -> hardender receipt chain)

## What was checked

1. **TRUSTED_INGRESS alignment (the task's core criterion).** The expected map in `packages/agent-router/test/feishu-regression.test.js` (lines 177-184) is the exact accepted 6-field surface `{channelNamespace, channelConversationId, feishuChatId, feishuConversationId, feishuMessageId, feishuSenderOpenId}`, including `feishuSenderOpenId: 'ou_test'` sourced from authenticated ingress sender metadata — matching the accepted implementation (`ingress-delivery.js:104-111` frozen construction, `route-chain.js:353` consumption as `senderOpenId`) and the newer `route-chain/canary-seam.test.js:62` frozen fixture. Aligned with authority AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2 (commit bd0eeae, PR #103); no owner acceptance or merge authority claimed here.
2. **Forbidden-change sweep.** `git diff 797952e --stat`: product side = ONLY `packages/agent-router/test/feishu-regression.test.js` (12 lines); rest is `sixpack-artifacts/` stage reports. Zero changes under `packages/*/src/`, `docs/`, `.github/`, `package.json`. No other test touched.
3. **Assertion integrity.** `assert.equal(Object.isFrozen(trusted), true)` intact (line 185); `assert.notEqual(trusted.feishuChatId, trusted.feishuConversationId)` with its "thread conversation identity must never be parsed or reused as chatId" message intact (lines 186-187). Nothing loosened, removed, or added. Diff vs base is fixture-value-only (`conversationId`/`channelConversationId`/`feishuConversationId` de-coincided + decoy `ou_decoy_id` in text + the `feishuSenderOpenId` map field).
4. **End-to-end verification through the public user boundary.** Required command `PATH=/tmp/node-v25.6.1-darwin-arm64/bin:/usr/bin:/bin node --test packages/agent-router/test/feishu-regression.test.js` → `✔ TRUSTED_INGRESS: exact Feishu chat/conversation/message fields reach the routed turn without parsing`, 9 tests / 9 pass / 0 fail, exit 0.
5. **No regressions vs base baseline.** Working glob invocation `node --test packages/agent-router/test/*.test.js packages/agent-router/test/route-chain/*.test.js packages/agent-router/test/process-lifecycle/*.test.js` → 310 tests / 309 pass / 0 fail / 1 skipped (pre-existing skip), exit 0 — identical to the base baseline; nothing that passed at base now fails.
6. **Directory-mode invocation parity.** `node --test packages/agent-router/test/` fails on this Node v25.6.1 build with a content-independent loader error (`'test failed'` at `packages/agent-router/test:1:1`) before any test file loads. Reproduced identically on the completely untouched `packages/agent-router/test/process-lifecycle/` dir → pre-existing at base, not introduced by this task. This is why the check verdicts use the per-file/glob form.
7. **Final CRAP/DRY on the terminal candidate.** Product/test files changed vs base: 1 (a test file; fixture string values only — no branch/loop/assertion-logic change, CRAP of the tested surface unchanged). `git diff --stat HEAD -- packages/` (working tree vs HEAD) is empty — the terminal candidate tree is clean. Gate: PASS.
8. **Handoff and manifest consistency.** Five prior station reports present (specifier, coder, cleaner, architect, hardender); this report + executable automation completes the six-station receipt chain. `qa_required_checks.sh` is executable (shebang + exec bit) and lives flat in `sixpack-artifacts/`; `qa.automation.json` declares the bare-filename entrypoint `{"entrypoints": ["qa_required_checks.sh"]}`.

## What was changed

No code change was required at this station: the terminal candidate already contains the exact TEST-ONLY alignment prescribed by the task record (applied by coder, hardened by hardender). QA verified it rather than re-doing it. QA additions are report/automation artifacts only:

- `sixpack-artifacts/qa_required_checks.sh` (new, executable, run from worktree root; output excerpt below)
- `sixpack-artifacts/qa.automation.json` (new, exactly `{"entrypoints": ["qa_required_checks.sh"]}`)
- `sixpack-artifacts/qa.report.md` (this file)

## qa_required_checks.sh output excerpt

```
== end-to-end verification through the public user boundary ==
✔ DISABLED_ENFORCEMENT: an existing binding to a disabled Agent rejects the ingress and NEVER spawns
✔ DISABLED_ENFORCEMENT: an unknown agent behind an existing binding also never spawns
ℹ tests 9
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
== final CRAP/DRY checks on the terminal candidate ==
product-code diff above must be empty except test file
== handoff and manifest consistency ==
qa.automation.json  qa_required_checks.sh  qa.report.md  + 5 prior station reports
```

(Script exit status: 0; `TRUSTED_INGRESS` passes inside the 9/9. Full untruncated run captured in the station session log.)

## Limitations

- `node --test packages/agent-router/test/` (directory argument) cannot execute on this Node v25.6.1 build (content-independent loader failure, pre-existing at base, reproduced on untouched dirs). The glob/per-file invocation is the working equivalent and was used for all pass/fail verdicts; the dir-mode failure is therefore not a signal about this candidate.
- `git diff --stat $(git rev-parse HEAD) -- packages/` inside `qa_required_checks.sh` shows working-tree-vs-HEAD (empty = clean tree, as prescribed). The base comparison used for criterion 2 is `git diff 797952e --stat`, reported above.
- The pre-existing 1 skipped test and the canary-seam nondeterministic flake candidate flagged by the hardender (under mutation-harness load only; green in all worktree runs here) are outside this task's authorized files and were not acted on.
- `send_notification` MCP is not available in this station's toolset; notification delivery is left to the pipeline's delivery helper.

## Receipt

- Terminal candidate: 3dd7e95 (unchanged by QA — no product/test file modified at this station).
- QA automation entrypoint: `qa_required_checks.sh` (flat, executable, declared in `qa.automation.json`).
- Final QA receipt binds this unchanged head/tree; no owner acceptance or merge authority claimed.
