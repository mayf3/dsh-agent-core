# SPECIFIER BEHAVIOR SPEC — TRUSTED_INGRESS test alignment (dsh-trusted-ingress-align-2)

```text
TASK_ID = dsh-trusted-ingress-align-2
OWNER_MANDATE = OWNER-MANDATE-2026-09-06-ALIGN2-CORRECTED-REPLAY-WINDOW
AUTHORITY_ACTION = REUSE
PRIMARY_AUTHORITY = PR #177 accepted PRODUCT_TEST_FIX (review 5123376463: PRODUCT_TEST_FIX=ACCEPT) + BASE product code
BASE = 16e14233fbac1ccbdc00598097380da659e1ecd2
PLAN_LEVEL = BRIEF
ASSURANCE_LEVEL = DURABLE
IMPLEMENTED_BY = coder station (this file specifies; it does not implement)
```

## 1. Product contract (NOT invented; already in BASE, unchanged by this task)

For a Feishu thread entry routed through agent-router, `route()` spawns a turn whose
`opts.ingressContext` is an `Object.freeze`d object with EXACTLY these 6 fields:

| # | field | value |
|---|-------|-------|
| 1 | `channelNamespace` | `'feishu'` |
| 2 | `channelConversationId` | `'feishu:' + input.conversationId` |
| 3 | `feishuChatId` | authenticated ingress `input.chatId` |
| 4 | `feishuConversationId` | authenticated ingress `input.conversationId` (NEVER derived by parsing `chatId`) |
| 5 | `feishuMessageId` | authenticated ingress `input.messageId` |
| 6 | `feishuSenderOpenId` | authenticated ingress `input.sender.openId` (NEVER taken from message text) |

Source coordinates verified at BASE:
- construction: `packages/agent-router/src/ingress-delivery.js:104-111` (`ingressContext: Object.freeze({...})`, `feishuSenderOpenId: isFeishuEntry ? ingress.sender?.openId : undefined`)
- consumption: `packages/agent-router/src/route-chain.js:353` (`senderOpenId: opts?.ingressContext?.feishuSenderOpenId`)

Trusted-context security property (the load-bearing behavior): `feishuSenderOpenId` is
authenticated sender METADATA from the ingress envelope. Prompt/text content is untrusted
data; a self-reported open id inside the message text MUST NEVER reach the trusted context.

## 2. CURRENT_GAP (observed at corrected-specifier Head, reverted-to-BASE test file)

- `packages/agent-router/test/feishu-regression.test.js` (test at line 158,
  `TRUSTED_INGRESS: exact Feishu chat/conversation/message fields reach the routed turn
  without parsing`) still asserts a STALE 5-field expected `ingressContext` and uses a
  fixture where `conversationId === '<chatId>:topic_exact'`, so the no-parse property is
  not actually exercised (the values coincide by construction).
- Observation (this worktree, node v26.7.0):
  `node --test packages/agent-router/test/feishu-regression.test.js` -> exit 1,
  `tests 9 / pass 8 / fail 1`; the failing test is exactly the TRUSTED_INGRESS test
  (`AssertionError: Expected values to be strictly deep-equal`).
- Full agent-router baseline at this state: 310 tests / 308 pass / 1 fail (that same
  test) / 1 skipped (pre-existing) / exit 1.

## 3. Required test change (deterministic; coder applies EXACTLY this, byte-for-byte)

File: `packages/agent-router/test/feishu-regression.test.js`, ONLY the TRUSTED_INGRESS
test. The aligned test must assert, in this exact form:

Input fixture:

```js
const input = {
  channel: 'thread',
  chatId: 'oc_exact_chat',
  conversationId: 'oc_thread_conv:topic_exact',   // MUST differ from chatId-derived value
  messageId: 'om_exact_message',
  sender: { openId: 'ou_test' },
  // The text embeds a decoy self-reported open id: feishuSenderOpenId in
  // the trusted context must come from the authenticated ingress sender
  // metadata, never from anything the prompt itself reports.
  text: 'thread turn mentions ou_decoy_id',
}
```

Expected trusted context (EXACT 6-field strict deepEqual; no extra/missing/reordered fields):

```js
const trusted = spawns.turns[0].opts.ingressContext
assert.deepEqual(trusted, {
  channelNamespace: 'feishu',
  channelConversationId: 'feishu:oc_thread_conv:topic_exact',
  feishuChatId: 'oc_exact_chat',
  feishuConversationId: 'oc_thread_conv:topic_exact',
  feishuMessageId: 'om_exact_message',
  feishuSenderOpenId: 'ou_test',
})
```

Assertions that MUST remain in the test:
- `assert.equal(Object.isFrozen(trusted), true)` (frozen names unchanged)
- `assert.notEqual(trusted.feishuChatId, trusted.feishuConversationId, ...)` (no-parse assertion)

Byte-exact reference: this delta is identical to the accepted PR #177 PRODUCT_TEST_FIX
(blob `fcf899290b6241adc74346773f2c4c625c095223` for the whole aligned file at the
pre-replay candidate head). No other test in the file may change.

## 4. Failure cases that MUST fail the aligned test (enumerated)

1. Stale 5-field expectation (missing `feishuSenderOpenId`) -> strict deepEqual fails.
2. Trusted context taking the open id from message text -> gets `ou_decoy_id`, not
   `ou_test` -> deepEqual fails (decoy tripwire).
3. `feishuConversationId` derived by parsing `chatId` -> yields
   `'oc_exact_chat:topic_exact'`, expected `'oc_thread_conv:topic_exact'` -> fails
   (the fixture de-coincidence makes parse-coincidence impossible).
4. Frozen-ness dropped -> `Object.isFrozen` assertion fails.
5. Any field rename / extra field / missing field -> deepEqual fails.

## 5. Acceptance criteria (recorded)

1. `node --test packages/agent-router/test/feishu-regression.test.js` on the aligned
   candidate -> 9/9 pass, exit 0.
2. Full agent-router suite -> 0 failures, no new failures vs the base baseline recorded
   in Section 2 (expected post-fix: 309 pass / 0 fail / 1 pre-existing skip / 310 total).
3. Product-tree diff vs BASE for the whole terminal candidate is limited to
   `packages/agent-router/test/feishu-regression.test.js`; ZERO changes to
   `packages/agent-router/src/**`, `docs/`, `package.json`, `.github/`.
4. Scope of the coder change: the single test file; nothing else.

## 6. STOP boundary

Once Section 5 criteria 1-2 hold and the diff scope matches criterion 3, the coder
station is DONE. No product code, no docs, no manifest or automation bytes are authorized
by this spec (automation is owned by the QA station per the corrected-replay mandate).
