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

## r2 review — parent integration-review repair (base eee7535 → ba818c84)

Reviewer: independent agent (fresh context, no shared state with the
implementing session; mechanically re-ran suites and re-verified RED
non-vacuity against the pristine base source in a scratch dir).

Scope: the r2 repair diff (2 files: human-work-item-ingress.js + its test)
against the parent integration review of exact PR head eee7535 (recorded on
agent-control#492), which identified two load-bearing gaps.

### Verdict: ACCEPT / LOAD_BEARING_GAPS = 0

Checklist (all PASS, evidence at exact lines in the review record):

- A. GAP-1 closure — canonical receipt row persisted BEFORE any reply attempt
  on every handled path; `deliver()` isolation means a reply failure can
  neither erase, skip, nor reclassify a known canonical success; no
  post-success path writes outcome 'error'/'internal_error'.
- B. Audit-failure truthfulness — appender returns `{ok:false}` instead of
  swallowing; both sink-failure modes surface in log + reply disclosure and
  are never rendered as a transition failure; canonical truth always delivered.
- C. Unresolved path honesty — outer catch now records
  `canonicalOutcome:'unresolved'` BEFORE the non-throwing delivery; only
  genuinely unknown-outcome failures (gateway transport throws) reach it.
- D. GAP-2 closure — every row carries commandId + openIdPrefix (redacted) +
  channel + humanPrincipalId + executorAgentId + originalMessageId; transition
  success rows add the full canonical receipt linkage (eventSequence,
  workflowStateVersion, sourceNodeVisitId, currentNodeVisitId, submissionId
  and currentContextRevisionId when present) and reject rows add
  reasonCode='HUMAN_REJECT' + rootCauseNodeVisitId; reply-failure rows carry
  the same identity + commandId linkage + bounded error.
- E. Actor semantics — executorAgentId still travels ONLY via gateway context
  agentId; humanPrincipalId never enters a gateway payload or reply text; no
  Human-principal canonical actor claim anywhere; loader tightening
  (humanPrincipalId REQUIRED) is fail-closed, not a widening.
- F. Default OFF + boundaries — wire gate, fail-loud misconfig, and
  downstream-outcome fall-through unchanged; compose.js / agent-router
  untouched by the diff.
- G. RED non-vacuity — mechanically verified: the NEW test file run against
  the BASE source produces exactly the 8 expected failures
  (I2, P3, P4, DR1, DR2, DR3, Z5, Z6).
- H. GREEN — 40/40 on the repair head.
- I. No scope creep — diff is exactly the two files; no new dependency,
  store, state machine, scheduler, or production surface (only state added:
  a per-handler commandSeq integer for row linkage).
- J. No new defect — commandId uniqueness, JSONL integrity under disclosure,
  deliver isolation, error-path ordering, JSON serialization hazards all
  checked.

Non-blocking notes (recorded for the Owner, no gate impact):

1. FOLLOW_UP — sink-fail + reply-fail simultaneously leaves only the log
   line (no durable row, no user disclosure). Inherent without an
   outbox/dead-letter sink; fold into the ALREADY-DEFERRED
   audit-rotation-before-enablement gate.
2. FOLLOW_UP — commandId is unique per handler instance; two handler
   instances sharing one audit file within the same millisecond could
   collide. Exactly one handler is wired per compose today.
3. minor — `log` is assumed non-throwing (default is a noop; injected logs
   are well-behaved).
4. informational — principals-file schema tightened (humanPrincipalId
   mandatory): state it in the enablement runbook; default-OFF, no migration
   risk.
5. informational — production-runtime package-wide suites carry pre-existing
   environmental failures (NODE_RUNTIME_VERSION pin), byte-identical on the
   pristine base; unrelated to this seam.
