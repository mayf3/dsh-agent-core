# hardender stage report — dsh-trusted-ingress-align-1

Station: hardender (mutation_hardening)
Worktree: sixpack-worktrees/dsh-trusted-ingress-align-1__hardender @ base 797952e (dsh-agent-core)
Incoming candidate: 228bbfe (specifier -> coder -> cleaner -> architect receipt chain)

## What was checked

1. **Incoming candidate state.** Coder's one-line fix (`feishuSenderOpenId: 'ou_test'` into the TRUSTED_INGRESS expected map) is present; required command `PATH=/tmp/node-v25.6.1-darwin-arm64/bin:/usr/bin:/bin node --test packages/agent-router/test/feishu-regression.test.js` → 9/9 pass, exit 0, TRUSTED_INGRESS green. Construction site read and confirmed as the single 6-field frozen literal at `packages/agent-router/src/ingress-delivery.js:104-111`, consumed read-only at `packages/agent-router/src/route-chain.js:353` (`senderOpenId`).
2. **Mutation harness (with control run).** Scratch copy of `packages/` in a temp dir; `node_modules` symlinked to the resolution farm at `/Users/yanfenma/workspace/project/sixpack-worktrees/node_modules` (the only external import in the affected src is `@deepseek-ai/schemastery`, `packages/agent-router/src/index.js:69`). Repo `src/` never touched. **A first harness attempt produced all-KILLED results and was discarded: the no-mutation control run was red (farm not resolvable from the temp dir).** After fixing the symlink, the control run was green (9/9) and all results below are trustworthy. Lesson applied: no control, no data.
3. **Mutant matrix (pre-hardening, against coder's candidate).** Applied to the scratch `ingress-delivery.js` construction site; verdict = focused test exit code (canary-seam run alongside for information):
   - M1 drop `feishuSenderOpenId` → KILLED (deepEqual)
   - M2 remove `Object.freeze` → KILLED (`Object.isFrozen` assertion)
   - M3 `feishuChatId = conversationId?.split(':')[0]` → **SURVIVED** (fixture's `conversationId` prefix `oc_exact_chat` coincides with the true `chatId`; matches the architect's handoff note exactly)
   - M4 `feishuChatId = conversationId` (full reuse) → KILLED (deepEqual + notEqual)
   - M5 `feishuSenderOpenId = prompt-parsed openId ?? ingress.sender?.openId` (prompt self-report BEFORE authenticated metadata — the wrong implementation forbidden by CTR-I2-015) → **SURVIVED** (fixture text contained no `ou_*` token, so no assertion could tell metadata-sourced from prompt-sourced identity)
   - M6 hardcode `'ou_wrong'` → KILLED (deepEqual)
   - canary-seam: structurally independent of this construction site (it builds its own frozen fixture, canary-seam.test.js:62) and green under all mutants; it guards the consumption side, not the construction side.
   - Harness noise: one nondeterministic canary-seam failure was observed in phase B and investigated: pristine canary-seam x5 green, M2-mutant x5 green → one-off flake under harness load, not a deterministic signal. Not a regression (file untouched by this task; green in the worktree runs below).

## What was changed

`packages/agent-router/test/feishu-regression.test.js` — TEST-ONLY hardening of the TRUSTED_INGRESS fixture (lines 163-172), killing both surviving mutants; zero assertions added, removed, or loosened:

```diff
-    conversationId: 'oc_exact_chat:topic_exact',
+    conversationId: 'oc_thread_conv:topic_exact',
     messageId: 'om_exact_message',
     sender: { openId: 'ou_test' },
+    // The text embeds a decoy self-reported open id: feishuSenderOpenId in
+    // the trusted context must come from the authenticated ingress sender
+    // metadata, never from anything the prompt itself reports.
     text: 'thread turn mentions ou_decoy_id',
...
-    channelConversationId: 'feishu:oc_exact_chat:topic_exact',
+    channelConversationId: 'feishu:oc_thread_conv:topic_exact',
     feishuChatId: 'oc_exact_chat',
-    feishuConversationId: 'oc_exact_chat:topic_exact',
+    feishuConversationId: 'oc_thread_conv:topic_exact',
```

- M3 kill: the conversationId prefix (`oc_thread_conv`) no longer coincides with the chatId (`oc_exact_chat`), so a parse-`chatId`-from-`conversationId` mutant now emits `oc_thread_conv` and the exact 6-field deepEqual rejects it. The `notEqual(chatId, conversationId)` assertion is untouched and its "never parsed or reused as chatId" meaning is now actually enforced rather than coincidentally satisfied.
- M5 kill: the prompt now embeds the decoy `ou_decoy_id`; any implementation that sources the sender identity from prompt self-report emits the decoy and fails the deepEqual against the authenticated `ou_test` (verified: prompt-first mutant KILLED post-hardening; metadata-first-with-prompt-fallback remains unobservable-by-design when metadata is present — see limitations).
- Expected map values updated consistently (`channelConversationId`, `feishuConversationId`); the exact 6-field surface `{channelNamespace, channelConversationId, feishuChatId, feishuConversationId, feishuMessageId, feishuSenderOpenId}` is unchanged; `Object.isFrozen(trusted) === true` intact. No other test touched; nothing under `packages/*/src/`, `docs/`, `.github/`, `package.json`.

## Post-hardening verification

- Mutant matrix re-run against the hardened test: M1–M6 all **KILLED** (0 survivors on the affected construction site).
- Required command (worktree): `node --test packages/agent-router/test/feishu-regression.test.js` → `✔ TRUSTED_INGRESS ...`, 9 tests / 9 pass / 0 fail, exit 0.
- Full suite (per-file glob, the working equivalent): `node --test packages/agent-router/test/*.test.js packages/agent-router/test/route-chain/*.test.js packages/agent-router/test/process-lifecycle/*.test.js` → 310 tests / 309 pass / 0 fail / 1 skipped (pre-existing skip; identical to base baseline — nothing that passed at base now fails).
- `git diff 797952e --stat` = this one test file (12 lines) + `sixpack-artifacts/` stage reports. Nothing else.

## Post-hardening CRAP gate (<=10 changed-file default)

- Product/test files changed vs base: **1** (`packages/agent-router/test/feishu-regression.test.js`) — under the 10-file default gate.
- Supporting artifacts: 4 prior station reports + this report under `sixpack-artifacts/` (non-product, mandated by the pipeline).
- Cyclomatic-risk note: the change alters fixture string values only — no branch, loop, or assertion-logic change; CRAP of the tested surface is unchanged and the mutation score on the affected site went 4/6 → 6/6. **Gate: PASS.**

## Limitations

- `node --test packages/agent-router/test/` (directory argument) fails on this Node v25.6.1 build with a content-independent loader error (`Cannot find module .../test`) before any test file loads; pre-existing at base (architect cross-verified on a second package's test dir). The per-file/glob invocation is the working equivalent and was used for all verdicts.
- M5-variant `metadata ?? promptFallback` (metadata first, prompt fallback) is semantically indistinguishable from the accepted implementation whenever the fixture has sender metadata — killing it would require a fixture where authenticated metadata is ABSENT, i.e. an untrusted-ingress case outside the TRUSTED_INGRESS test's contract. The prompt-PRIORITY mutant (the CTR-I2-015-forbidden order) is killed. Recorded, not acted on.
- canary-seam showed one nondeterministic failure under mutation-harness load (5x pristine green, 5x mutant green afterwards). Pre-existing flake candidate, outside this task's authorized files; flagged for QA attention.
- `send_notification` MCP is not available in this station's toolset; notification delivery is left to the pipeline's delivery helper.
