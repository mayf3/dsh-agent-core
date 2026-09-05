# Specifier station report — dsh-trusted-ingress-align-1

```text
STATION = specifier
TASK_ID = dsh-trusted-ingress-align-1
WORKTREE = dsh-trusted-ingress-align-1__specifier
HEAD = 797952e (== task target revision; worktree clean at station entry)
BASE_HEAD = 797952e
OWNERSHIP = behavior_specification, qa_procedure
NOT_OWNED = implementation_and_unit_tests, cleanup, architecture, hardening, executable QA, final receipt
```

## 1. What was checked (Observations, with coordinates)

| # | Observation | Source | Result |
|---|---|---|---|
| O1 | TRUSTED_INGRESS test at `packages/agent-router/test/feishu-regression.test.js:158` deepStrictEquals the routed `ingressContext` against a **5-key** allowlist (`feishu-regression.test.js:174-180`); `feishuSenderOpenId` is absent | test file at HEAD 797952e | confirmed stale |
| O2 | Accepted implementation builds a **6-key** frozen ingressContext: `feishuSenderOpenId: isFeishuEntry ? ingress.sender?.openId : undefined` at `packages/agent-router/src/ingress-delivery.js:104-111` (comment lines 101-103: authenticated sender identity, never prompt self-report) | src at HEAD | confirmed |
| O3 | `feishuSenderOpenId` is consumed: `senderOpenId: opts?.ingressContext?.feishuSenderOpenId` at `packages/agent-router/src/route-chain.js:353` (CTR-I2-015 canary binding input) | src at HEAD | confirmed |
| O4 | Newer conformance test asserts the surface **with** `feishuSenderOpenId` and `Object.freeze`: `packages/agent-router/test/route-chain/canary-seam.test.js:61-63` | test at HEAD | confirmed |
| O5 | Authority exists and is accepted in base: `AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2` (`docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2.md`), merged via PR #103 (merge f54679c) per `docs/specs/README.md:83` and bd0eeae commit message; spec normative text ~lines 299-312 mandates `senderOpenId` from "existing authenticated Feishu ingress metadata, never prompt self-report" | docs at HEAD | confirmed; NOT a invented contract |
| O6 | Implementation commit bd0eeae exists in history (first impl round under IMPL V2) | `git log` | confirmed |
| O7 | Baseline run (fixed node v25.6.1): `PATH=/tmp/node-v25.6.1-darwin-arm64/bin:/usr/bin:/bin node --test packages/agent-router/test/feishu-regression.test.js` → **tests 9 / pass 8 / fail 1**; sole failure TRUSTED_INGRESS, `ERR_ASSERTION deepStrictEqual` at line 174; diff shows actual contains `+ feishuSenderOpenId: 'ou_test'`, expected omits it | executed this station | baseline pinned |
| O8 | Dir-wide baseline: `node --test packages/agent-router/test/*.test.js packages/agent-router/test/*/*.test.js` → **tests 310 / pass 308 / fail 1** (the 1 = TRUSTED_INGRESS). Matches task-record base baseline "only TRUSTED_INGRESS fails" | executed this station | baseline pinned |
| O9 | Directory-form invocation `node --test packages/agent-router/test/` (and without trailing slash) fails with `MODULE_NOT_FOUND` on node v25.6.1 in this environment; the glob form (O8) and the single-file form (O7) work | executed this station | environment note for QA |

## 2. Governance classification

```text
AUTHORITY_ACTION = REUSE              # accepted IMPL V2 + merged implementation already decide the behavior; test realigns to it, no Contract meaning change
PRIMARY_AUTHORITY = AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_IMPL_V2 (accepted, in base 797952e; impl commit bd0eeae)
ROUTE_STAGE = IMPLEMENTATION
AUTHORITY_ACCEPTED_IN_BASE = YES
PLAN_LEVEL = BRIEF                    # this task record + this spec
ASSURANCE_LEVEL = ROUTINE             # test-only, readily reversible
SPEC_GAP = NONE                       # no undocumented contract invented; every required field is authority-backed (O5) and implemented (O2)
BLOCKER = NONE
```

## 3. Behavior specification (deterministic — handoff to coder)

### 3.1 Contract under test

For a trusted Feishu ingress turn, the routed turn options carry a frozen
`opts.ingressContext` object whose observable surface is **exactly** these 6 keys
(built at `ingress-delivery.js:104-111`):

| key | value in the TRUSTED_INGRESS fixture |
|---|---|
| `channelNamespace` | `'feishu'` |
| `channelConversationId` | `'feishu:oc_exact_chat:topic_exact'` |
| `feishuChatId` | `'oc_exact_chat'` |
| `feishuConversationId` | `'oc_exact_chat:topic_exact'` |
| `feishuMessageId` | `'om_exact_message'` |
| `feishuSenderOpenId` | `'ou_test'` (from fixture input `sender: { openId: 'ou_test' }`, test line 166) |

Authority for the 6th key: IMPL V2 CTR-I2-015 (O5), implementation bd0eeae (O2),
consumer route-chain.js:353 (O3), newer conformance test canary-seam.test.js:62 (O4).

### 3.2 The one prescribed change (TEST-ONLY)

File: `packages/agent-router/test/feishu-regression.test.js`, test `TRUSTED_INGRESS`
(line 158). In the `assert.deepEqual(trusted, {...})` expected object (lines 174-180),
add exactly one key so the allowlist becomes the 6-key map of §3.1:

```js
  assert.deepEqual(trusted, {
    channelNamespace: 'feishu',
    channelConversationId: 'feishu:oc_exact_chat:topic_exact',
    feishuChatId: 'oc_exact_chat',
    feishuConversationId: 'oc_exact_chat:topic_exact',
    feishuMessageId: 'om_exact_message',
    feishuSenderOpenId: 'ou_test',
  })
```

Nothing else changes: no other test in the file, no helper, no import, no
`packages/*/src/`, no `docs/`, no `.github/`, no `package.json`.

### 3.3 Assertions that MUST remain byte-identical (never loosened)

- `assert.equal(Object.isFrozen(trusted), true)` (line 181) — freeze not weakened.
- `assert.notEqual(trusted.feishuChatId, trusted.feishuConversationId, ...)` (lines 182-183) — thread conversation identity never parsed/reused as chatId.
- The test name and all other tests (8 currently passing) stay intact.

## 4. Failure cases enumerated

| id | case | detection |
|---|---|---|
| F1 | ingressContext surface mismatch: any missing / extra / renamed key or wrong value vs §3.1 | Gate A fails (`deepStrictEqual` at line 174) |
| F2 | freeze weakened or removed | Gate A fails on `Object.isFrozen` (line 181); Gate D diff inspection |
| F3 | chatId derived/parsed from conversationId (thread identity reuse) | Gate A fails on `notEqual` (line 182) |
| F4 | collateral regression: any of the 8 currently-passing tests in this file, or any other test passing at base, fails | Gate A / Gate C fail |
| F5 | scope violation: changed file outside `packages/agent-router/test/feishu-regression.test.js` + `sixpack-artifacts/*` | Gate B fails |
| F6 | environment gate failure: imports unresolvable / runner cannot start | run itself errors (REQUIRED_GATE_FAILURE of the run, not a product failure) |

## 5. QA procedure / acceptance criteria (deterministic)

All runs from the task worktree root, fixed node:

```bash
export PATH=/tmp/node-v25.6.1-darwin-arm64/bin:/usr/bin:/bin
```

- **Gate A (binding DONE_WHEN)**: `node --test packages/agent-router/test/feishu-regression.test.js`
  → exit 0; summary `tests 9 / pass 9 / fail 0`; TRUSTED_INGRESS listed as passing.
- **Gate B (scope)**: `git status --porcelain` (and `git diff --name-only` vs base_head 797952e)
  → exactly `packages/agent-router/test/feishu-regression.test.js` plus `sixpack-artifacts/*` stage reports; nothing else.
- **Gate C (no collateral)**: `node --test packages/agent-router/test/*.test.js packages/agent-router/test/*/*.test.js`
  → fail count ≤ base baseline (O8: 310/308/1); after the fix expect 310 pass / 0 fail, and in any case no test passing at base (O8) that now fails.
  Do NOT use the directory form `node --test packages/agent-router/test/` — it is unusable on this node build (O9).
- **Gate D (assertions intact)**: inspect the diff — sole hunk is the §3.2 one-key addition; lines 181-183 byte-identical; no assertion deleted, reordered, or loosened; no other test file touched.

## 6. What this station changed

- Created `sixpack-artifacts/specifier.report.md` (this file). Nothing else.
- The test-file edit itself is deliberately NOT made here: `implementation_and_unit_tests`
  is outside specifier ownership. The coder station applies §3.2 exactly.
- No root-level `plan.md` / `todo.md` / `validation_layout.py` were created because the
  task DONE_WHEN restricts the diff to the test file plus `sixpack-artifacts/` stage reports;
  this report carries the plan, specification, and QA procedure instead.

## 7. Limitations

- Directory-form `node --test <dir>` fails on node v25.6.1 here (O9); Gate C uses the glob form. The binding Gate A command is verified working (O7).
- Dir-wide baseline (O8) was captured once at this station; QA re-runs Gate C after the fix and compares against this recorded baseline and its own fresh base observation if base moved.
- The `agent-notification` MCP tool (`send_notification`) is not available in this station's toolset; the completion notification could not be sent from here and must be sent by a station/helper that has the tool.
- Proxy env vars irrelevant for these tests (no network); verified not needed for O7/O8.
