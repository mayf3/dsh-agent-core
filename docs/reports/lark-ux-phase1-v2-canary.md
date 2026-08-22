# LARK_UX_PHASE1_V2 — implementation validation & canary status

```text
REPORT_ID = LARK_UX_PHASE1_V2_CANARY_V1
DATE = 2026-08-22
ROUND = 体验执行（final implementation）
GOVERNING = AGENT_CORE_LARK_UX_PHASE1_V2 (accepted) +
            AGENT_CORE_LARK_UX_PHASE1_V2_HEADING_NORMALIZATION_AMENDMENT (accepted, contracts)
BASE_MAIN = b8b6fb586b38b10cd88db964be78544385bb4a0f
BRANCH = feat/lark-ux-phase1-v2-final
DEDICATED_TEST_APP_CANARY = BLOCKED_PENDING_DEDICATED_TEST_APP_CREDENTIALS
```

## 1. Implementation validation (executed, this candidate)

| Suite | Node | Result |
|---|---|---|
| dedicated UX tests — connector (`test/ux-phase1-v2.test.js`) | v26.7.0 | 26/26 PASS |
| dedicated UX tests — Router seam (`test/feishu-ux-seam.test.js`) | v26.7.0 | 4/4 PASS |
| feishu-connector full | v26.7.0 | 162/162 PASS, 0 skip |
| agent-router full | v26.7.0 | 111/111 PASS, 0 skip |
| production-runtime full | v25.6.1 (frozen) | 42 PASS / 0 fail / 2 skip |
| serialized full repository (`node --test 'packages/*/test/*.test.js'`) | v25.6.1 (frozen) | 653 tests / 649 PASS / 1 FAIL / 3 skip |
| real Binding read-only replay (`real-binding-replay.test.js`) | v26.7.0 | 1/1 PASS |
| governance verifier | — | PASS (vendored bytes match lock; adoption accepted) |
| accepted spec blob equality (parent / amendment vs main) | — | MATCH / MATCH (`91513d140bfeb2747326a465bdc01d72c899c864` / `9785c8a55f0028ca345e458f2a49f6de2b4939b3`) |
| syntax (`node --check`) + JSON | — | PASS |
| `git diff --check` | — | PASS |
| gitleaks (changed files) | — | CLEAN |
| credential literal scan | — | 0 hits |
| forbidden-surface diff | — | NONE (only feishu-connector/**, agent-router/src/index.js success call, related tests) |

### The single full-repo failure is pre-existing environment drift

`packages/agent-provisioning/test/provisioning.test.js:90` asserts
`readHarnessIdentity()` equals a hardcoded fixture `{ version: 0.1.0-rc.5, commit: a12bb03… }`.
The repo's own production pin moved to `0.1.0-rc.8 / 514ab7b…` in commit `e865fb8`
("align Luna runtime pin with DSH rc.8") without updating this fixture, and the local
harness checkout is at `0.1.0-rc.8 / f77b5a2…`. Proven pre-existing: the test fails
IDENTICALLY on this branch with all UX changes stashed, and in the main repo checkout;
this branch touches no agent-provisioning file. Fixing the fixture is outside this
round's allowed paths (would require an out-of-scope docs/test change per §二).

Environment repairs performed for this round (no repo changes): restored the canonical
dev-resolution bridge (`node_modules/@deepseek-ai -> harness pnpm store`, per
`scripts/install-integration.mjs`) which had gone missing and broke `child-env` T3/T4
real child boots; ran the production-runtime and full-repo suites under the frozen
Node `v25.6.1` (`/usr/local/bin/node`) with proxy env vars removed, per
`docs/runbooks/feishu-production-cutover-v1.md`.

## 2. UX contract implementation summary (unit/integration-verified)

- Router seam: exactly ONE success-call change adding
  `{ ux: { rendering: 'markdown', autoMentionTriggerSender: true } }`; failure receipt
  call byte-preserved (2 args); ux object verified to carry intent flags only (no
  identity/protocol values); `packages/agent-router/src/index.js` is the only Router
  source file changed; `process.js` untouched.
- Mention identity: `replyTargetFor` derives `triggerSenderOpenId` from
  `IngressEvent.sender.openId` only (`^(?:ou_|on_)[A-Za-z0-9_-]+$`); missing/invalid →
  no mention, no name fallback, no body mutation; mention entry is openId-carrying only
  (no name); activation = intent AND group/thread AND valid openId; p2p structurally
  excluded; `resolveMentionsInText` stays off; scheduler literal targets carry no
  context.
- Markdown: `ux.rendering=markdown` maps to `channel.send(to, { markdown }, opts)`;
  `config.markdownConverter` unset; chunk limit 3500 (SDK native); heading native
  normalization per the amendment (labels/order/treatment preserved; distinctness not
  required; verified `#`→`####`, `##..######`→`#####` payload); bold/italic/quote/
  inline-code/nested-lists/python-fence/link-byte-stability/table/CJK verified into
  the md payload; >3500 comprehensive case (table+python fence+query/fragment/percent
  link+mention+CJK) chunk-ordered, fence close/reopen with language tag, mention
  first-chunk-only outside fences.
- SDK error contracts (real pinned SDK OutboundSender, stubbed transport):
  target_revoked → exactly one logical same-chat top-level fallback with
  content/rendering/mentions preserved; rate_limited exhausted → exactly 3 SDK
  attempts, fail-loud, connector retry 0; ambiguous unknown → rejects
  (OUTCOME_UNKNOWN semantics), connector replay 0; permission_denied → fail-loud, no
  replyTo removal / top-level / format fallback; format_error → exactly one logical
  post→text fallback preserving the same answer. Connector adds zero
  retry/fallback/replay in every path.
- Excluded callers: unbound receipt / Router failure receipt / no-ux callers verified
  plain text with no mention (V0 byte-compatible plans).

## 3. Dedicated test-app canary — BLOCKED

The 18 mandatory real-client gates (§十二) were NOT executed. Reason:

- The dedicated non-production Agent Core test App used by the Phase A final canary
  (appId sha256 `57350f752227fdb435306a277dcfcb7fbc110877ef33d6a4d346cb47c552a592`,
  credential file `/private/tmp/pr27-test-app-canary-20260821/feishu-test-app-creds.json`,
  plus its `FEISHU_FINAL_CANARY_GROUP` / `FEISHU_FINAL_CANARY_P2P` chat coordinates)
  no longer exists on this machine — the /private/tmp directory was reclaimed.
- The ONLY credential file still on disk (`~/.dsh/feishu-creds.json`) is the
  PRODUCTION App (`cli_a9d7…`, held by the OpenClaw gateway) — explicitly forbidden
  by this round (不得使用 production App), as is the standalone pilot App
  (`cli_aa0e3dda8778dd11`).

To complete the canary the Owner must re-provide (input only the Owner holds):

1. the dedicated test-App credentials (appId/appSecret) — verified against the
   sha256 pin above or a successor dedicated app pinned by a new evidence record;
2. the dedicated GROUP and P2P chat ids for that App (plus a topic-capable group);
3. a human sender account performing the real ingress turns, and the mentioned
   user's real Feishu client for the native-notification observation gates (7/8/18).

Frozen-execution prerequisites already verified present on this machine:
frozen Harness checkout `a12bb03…` at `/private/tmp/dsh-harness-rc5-pr27-audit` (clean),
codex fallback plugin tree + auth (for the openai-codex/gpt-5.6-luna route),
`~/.openclaw/openclaw.json` production-identity source for isolation comparison,
frozen Node v25.6.1.

No secret, token, Authorization value, real personal name, or private message
content appears in this report. Platform IDs are either hashed or already-public
non-production identifiers from prior accepted evidence records.

## 4. Round ledger

```text
PRODUCT_CODE_CHANGE = YES (3 product files: agent-router/src/index.js [1 call site],
                             feishu-connector/src/core.js, feishu-connector/src/index.js)
TEST_CHANGE = YES (2 new dedicated UX test files, 30 tests)
DEPENDENCY_CHANGE = NONE (package.json / lockfiles untouched; SDK pin ab028f9 unchanged)
SDK_CHANGE = NONE
PHASE_A_FOUNDATION_REGRESSION = NONE (Phase A suites fully green)
ACCEPTED_SPEC_CHANGE = NONE (parent + amendment blobs match main)
DEPLOYMENT = NONE
PRODUCTION_STATE_CHANGE = NONE (production App never touched)
MERGE = NONE
SECRET_DISCLOSURE = NONE
```
