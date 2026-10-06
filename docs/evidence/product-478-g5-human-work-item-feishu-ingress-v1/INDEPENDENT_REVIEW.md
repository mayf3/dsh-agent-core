# INDEPENDENT_REVIEW — Product #478 (G5) changed-surface review r1

Reviewer: independent agent (fresh context, no shared state with the
implementing session). Scope: full diff vs d1e42f21 (2 modified files +
2 new code files + evidence docs) with cross-repo authority checks against
svc-workflow main @ 88ff814 and auth-service main.

## Verdict history

- **r1: REVISE / LOAD_BEARING_GAPS = 2** — checklist A–K: 11× PASS; defects:
  2 load-bearing + 5 minor.
- **r1 fixes applied (commit 322bff68)** — both load-bearing gaps repaired
  and pinned non-vacuously; 4 of 5 minors fixed; 1 deferred with reason.

## r1 load-bearing gaps (both real, both fixed)

1. **BLOCKER — reply path broken against the real connector.** The seam sent
   `reply(replyTargetFor(ingress), text)` without chaining
   `.replyTo(ingress.messageId)`. The real `replyTargetToSdkSend` throws
   `unknown ReplyTarget kind "undefined"` on a kind-less target
   (feishu-connector/src/core.js:441; every existing caller chains
   `.replyTo(...)` — ingress-delivery.js:196, bridge.js:514). Net effect had
   this shipped enabled: every command consumed, zero user-visible replies,
   receipts lost, and NO success audit rows (send precedes auditRow). The
   tests missed it because the fake reply accepted any target. FIX:
   `send()` now mirrors the Router's construction exactly; `fakeFeishu.reply`
   now throws on a target without a resolved `replyTo` — every reply-touching
   assertion is now non-vacuous.
2. **MAJOR — fall-through swallowed the downstream outcome.** The wire
   wrapper did `await downstream(...); return false`, suppressing the value
   AND any throw. The bridge inspects the onEvent callback's outcome to
   surface delivery failures as channel errors exactly once
   (feishu-connector/src/bridge.js:464-472) — swallowing it would change the
   Router's failure semantics for every unconsumed message while enabled.
   FIX: the wrapper now returns the downstream outcome unchanged (value and
   throw identity); Z3 pins outcome identity propagation.

## r1 minors

- FIXED: explicit enablement without a Feishu channel now fails loud at
  compose (was a silent skip).
- FIXED: reject `reason` bounded at 2000 chars in the grammar (server
  `size_limit_exceeded` remains the outer authority; the seam no longer
  ships unbounded bodies).
- FIXED: `transitionKey` restricted to `/^[A-Za-z0-9._-]{1,64}$/` before it
  can be echoed into any reply.
- FIXED: loader rejects a shared `executorAgentId` across principals (one
  executor identity per human; a shared executor would merge worklists).
- DEFERRED (accepted, NON-PRODUCTION lane): audit JSONL has no size
  cap/rotation — MUST be added before any production promotion (existing
  rotation discipline: agent-session audit.js rotation pattern).

## Post-fix verification

- Seam suite 34/34 PASS (incl. new pins: outcome propagation, kind-validating
  reply fake, shared-executor rejection, grammar bounds).
- compose module load re-verified (`node --check` + import).
- No other surface touched by the fix commit (3 files: seam module, its
  test, compose block).
