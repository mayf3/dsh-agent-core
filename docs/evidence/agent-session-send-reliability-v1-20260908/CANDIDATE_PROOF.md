# CANDIDATE PROOF — AGENT_SESSION_SEND_RELIABILITY_V1 (frozen head 1d70571)

- date: 2026-09-09 (re-stamped after AMENDMENT_2; candidate `impl/agent-session-send-reliability-v1`, PR #203; authority now r5 = AMENDMENT_1 accepted @8994aa5 + AMENDMENT_2 accepted @f4ebfee/PR #212)
- authority read-back: PR #202 **MERGED** @ `8994aa5`; main frontmatter `amendment_status: accepted` (finalize `db93649`); **zero main drift after db93649** at stamping time
- Owner ruling preserved as closed fact: `REPLY_UNAVAILABLE_MEANS_DELIVERED = YES` (never re-investigated)

Every REQUIRED gate below is stamped by named, re-runnable mechanical evidence (not narrative).
Fresh stamp runs: pinned node v25.6.1 + proxy-free env, worktree at `aa3f63c`.

## Gate → evidence

| Gate | Verdict | Mechanical evidence |
|---|---|---|
| REPLY_UNAVAILABLE_MEANS_DELIVERED | **PASS** | `mapFinalAssistantOutputToOutcome` reachable only after `receipt.accepted===true` (production-runtime/src/agent-session-messaging.js wait branch); probe FROZEN_RUN_OUTPUT cases 3–6 (no_output/truncated/evicted/restart_lost all DELIVERED); §5.1 normative row |
| DELIVERY_STATUS_UNAMBIGUOUS | **PASS** | §5.1 total mapping incl. internal_error three-way split + gateway catch-all=UNKNOWN; broker conversion-table test (13 shapes, `agent-session-messaging.test.js` 'reconciled conversions for every outcome row class'); no fabricated DELIVERED / no duplicate-licensing NOT_DELIVERED (rotation-expired + corrupt-integrity tests) |
| REPLY_STATUS_INDEPENDENT | **PASS** | DELIVERED held across TIMEOUT/TARGET_FAILED/NO_OUTPUT/TRUNCATED/UNKNOWN (probe cases 1–6; conversion table); timeout is a SUCCESS envelope; reply text never fabricated after loss (`replyTextAvailable:false` row) |
| EXACTLY_ONCE_SESSION_DELIVERY | **PASS** | Probe CASE A (frozen): response lost → EXACTLY ONE read-only lookup → reconciled DELIVERED, send executed exactly once, same anchor; one handler invocation ⇒ exactly one `router.deliver` (probe T9 + production-runtime deliver-once tests) |
| NO_AUTOMATIC_RETRY | **PASS** | relay never re-issues the send at either capture point (broker tests assert per-leg counts: send×1 + lookup×1); dark lookup degrades to the honest `parent_rpc_ambiguous` terminal (probe CASE G2) |
| NO_DUPLICATE_DELIVERY | **PASS** | reconcile is read-only (zero Router delivery in `agent_session_send_reconcile.lookup`); inbox count 1 / Run count 1 hold in CASE A composition; NOT_DELIVERED requires clean integrity + proven coverage (never licensed by rotation expiry or corruption) |
| lost before receipt → reconcile NOT_DELIVERED (provable) | **PASS** | intent-append strictly precedes delivery ⇒ absence proves non-entry under coverage; broker CASE B test (coverage → NOT_DELIVERED/NOT_WAITED) |
| STILL_UNKNOWN explicit, no blind replay | **PASS** | intent-without-outcome → UNKNOWN; unbounded/corrupt/expired coverage → UNKNOWN; UNKNOWN is final (probe CASE G2; broker conversion rows) |
| SESSION_PROVENANCE | **PASS** | trusted `messageOrigin {kind:'inter_agent', sourceAgentId, correlation}` sidecar tests (production-runtime suite + probe CASE 12); identity never from model args (R2/R3 tests) |
| TARGET_RUN_CORRELATION | **PASS** | exact-Run reply wait via `reconciliationHandle` (R9 waiter tests; L1 outcome rows carry the handle; probe AT_THAT_POINT TARGET_RUN_ID_KNOWN=YES) |
| RECEIPT_CHAIN | **PASS** | frozen commit order tests: L1 intent BEFORE delivery (failure ⇒ zero deliveries), outcome after receipt preserving proven results (R12 tests + §5.2 field persistence tests) |
| E-class full injection (receipt→loss→reconcile→1 inbox→1 Run) | **PASS at unit composition** — broker CASE A + production-runtime deliver-once; the single integrated live injection is the §E2 Owner-gated A2A canary at apply time (packet §E) |

## Fresh stamp runs (this date, frozen head)

- probe `discriminating-failure-injection.mjs` (12 cases, real modules + stubbed seams): **exit 0**, output `FROZEN_RUN_OUTPUT.txt`
- broker agent-session-messaging 22/22 · production-runtime unit 24/24 + integration 8/8 · agent-router broker-rpc 11/11 + message-origin (incl. anchor-forwarding test)
- full-package counts at freeze (recorded in PR #203): broker 375/375 · agent-router 311/311 · scheduler 191/191 · scheduler-router 22/22 · production-runtime 181/188 (2 A/B-identical pre-existing on base db93649)

## AMENDMENT_2 (r5, accepted via PR #212 @ f4ebfee) — AGENT_PROCESS_EXITED unified matrix

Real incident corpus: `agt_soul-questioner-agent` gen2 — `RPC session/prompt rejected: AGENT_PROCESS_EXITED`.
`AGENT_PROCESS_EXITED` is a REASON, never a delivery status (PROCESS_EXIT_REASON_VISIBLE = PASS:
reason rides render detail + L1 rows; delivery is never read from it).

| Unified matrix row | Verdict | Mechanical evidence |
|---|---|---|
| reply_unavailable(<reason>) → DELIVERED + reply failure | **PASS** (unchanged) | §5.1 post-receipt-only construction; probe cases 3–6 |
| target_run_failed after receipt → DELIVERED + TARGET_FAILED | **PASS** | R8 mapping (late_failed → target_run_failed); conversion-table row (DELIVERED/TARGET_FAILED); T_PROCESS_EXIT_2 late_failed variant |
| AGENT_PROCESS_EXITED before/at receipt (Router C-004/C-017 boundary doctrine: stdin in-flight writes cannot prove zero bytes) | **PASS as UNKNOWN → reconcile** | T_PROCESS_EXIT_1: error outcome_unknown UNMARKED (no fabricated phase), L1 row failureCode outcome_unknown without post_receipt, reconcile of that row ⇒ UNKNOWN (NOT_DELIVERED never fabricated); structured proven rejections keep not_admitted (NOT_DELIVERED) |
| AGENT_PROCESS_EXITED after receipt (mid-turn death, terminated_without_outcome) | **PASS as DELIVERED + UNKNOWN** | T_PROCESS_EXIT_2: canonical render marker 'after a proven inbox receipt (delivery was proven)', L1 row failureReason 'post_receipt', §5.3 lookup converts DELIVERED + UNKNOWN; delivery count 1, NO_AUTO_RETRY |
| transport/parent-response ambiguity → UNKNOWN → reconcile | **PASS** | probe CASE A (reconciled DELIVERED) + CASE G2 (explicit UNKNOWN terminal) |
| TRUE_UNCERTAINTY → STILL_UNKNOWN + NO_BLIND_REPLAY | **PASS** | T_PROCESS_EXIT_3: intent-without-outcome ⇒ outcome null (STILL_UNKNOWN terminal); unmarked outcome_unknown ⇒ UNKNOWN; NO_BLIND_REPLAY asserted at every capture point |
| AGENT_PROCESS_EXITED_DELIVERY_STATUS_UNAMBIGUOUS | **PASS** | every process-exit shape resolves to exactly one §5.1 row (unmarked pre-receipt = UNKNOWN; post_receipt = DELIVERED + UNKNOWN; late_failed = DELIVERED + TARGET_FAILED; structured = NOT_DELIVERED) — conversion table + T_PROCESS_EXIT_1/2/3 |
| OUTCOME_UNKNOWN_RECONCILIATION | **PASS** | §5.3 lookup + conversion (probe CASE A; broker table); STILL_UNKNOWN explicit and final |

## Verdict

```text
ALL_REQUIRED_CANDIDATE_PROOF_GATES = PASS
READY_FOR_PRODUCTION_APPLY = YES
PRODUCTION_APPLY = HOLD (slot held by PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1 bounded adoption)
GOAL_STATUS = BLOCKED_BY_DEPENDENCY — release agent, no polling, no slot preemption
```
