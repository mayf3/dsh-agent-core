# RED / GREEN record and test matrix — Product #478 (G5)

Run: `cd packages/production-runtime && node --test test/human-work-item-ingress.test.js`

RED phase: authored BEFORE the seam module existed — the suite failed at
import (module not found), then 28/34 after the first implementation pass
(the 6 failures were exactly the contract deltas: parser null/usage split,
fall-through ownership in the caller wrapper, refusal phrasing, wire return
value). GREEN at 34/34; re-run GREEN at 34/34 after the independent review
fix round.

## r2 (parent-review repair, exact base eee7535 → ba818c84)

Six new tests + two tightened tests were authored FIRST against the
unmodified parent head and observed RED (8 fail / 32 pass; log preserved in
the repair session as /tmp/g5-red-r2.log):

| # | RED scenario (parent review demand) | RED failure at base |
|---|--------------------------------------|---------------------|
| DR1 | canonical transition success + reply delivery failure → success receipt row persisted anyway; never misclassified `internal_error`; reply_failure row linked by commandId | no success row existed at all (audit ran only after the throwing reply) |
| DR2 | audit-sink failure on canonical success (both real modes: appender throws / returns `{ok:false}`) → log + user-visible disclosure, canonical truth intact, never rendered as transition failure | no disclosure; sink failure silently swallowed |
| DR3 | duplicate complete after a reply-failure success → exactly one canonical success row; retry refused from FRESH server state; both lost replies recorded; zero `internal_error` rows | zero rows for both commands |
| P3 | provenance rows carry unambiguous identity + canonical linkage (humanPrincipalId, executorAgentId, originalMessageId, commandId, sourceNodeVisitId, currentNodeVisitId, reasonCode, rootCauseNodeVisitId) — not only the 6-char openId prefix | fields absent (`undefined`) |
| P4 | error and reply-failure rows carry the same identity fields | rows absent / fields absent |
| Z6 | REAL audit sink failure (unwritable path) returns `{ok:false}` instead of being swallowed; reply discloses the provenance gap | appender swallowed internally |
| I2+ | loader now REJECTS principals entries without a non-empty `humanPrincipalId` (unambiguous durable human provenance is required; fail-closed) | loader accepted them |
| Z5+ | wired JSONL row carries `humanPrincipalId` end-to-end | field absent |

GREEN after the repair commit: 40/40 (same command, same environment).

## Matrix (40 tests)

| # | Test | Pins |
|---|------|------|
| G1 | exact forms parse; UUID normalized lowercase | grammar authority |
| G2 | non-`/work` text → null; `/work` namespace tail → usage; transitionKey charset/length; reason ≤ 2000 | fall-through domain vs command intent; bounded echo/bodies |
| A1 | allowlisted + grammar → consumed; fall-through never runs | consumption rule |
| A2 | UNMAPPED sender: exact grammar AND malformed command both fall through, zero receipts, zero gateway calls | no seam-existence leak; allowlist precedes usage |
| A3 | allowlisted, non-grammar → falls through | normal agent turns unchanged |
| A4 | allowlisted, malformed → usage reply, no gateway call | guidance without side effects |
| A5 | group/thread NEVER consumed (allowlisted + exact grammar) | p2p-only boundary |
| I1 | exact-string lookup only (no prefix/case-fold) | identity authority |
| I2 | loader rejects: version≠1, missing fields, MISSING/EMPTY humanPrincipalId, duplicate openId, SHARED executorAgentId, non-array, non-object, bad JSON | total fail-closed allowlist; mandatory unambiguous human provenance |
| I3 | executor identity only in gateway context `{agentId}`, never in call args; humanPrincipalId never a workflow input | trusted credential seam; provenance-only human identity |
| Q1 | query → `workflow_my_tasks list limit=10`; snake_case item formatting (id, node, version, actions) | canonical query surface |
| Q2 | empty worklist explicit reply | query semantics |
| Q3 | query failure → verbatim code, single attempt | error preservation |
| C1 | complete = fresh detail read → executable ADVANCE → transition with THAT read's version (CAS) | canonical transition |
| C2 | several executable ADVANCE, no key → disambiguation reply, 1 read, NO write | no blind writes |
| C3 | explicit transitionKey selects exactly that transition | deterministic selection |
| C4 | no executable ADVANCE → refusal with blocked_reason, NO write | server-authoritative refusal |
| R1 | reject → RETURN transition + `{rootCauseNodeVisitId: current_node_visit_id, reasonCode: 'HUMAN_REJECT', reason}` | svc-workflow RETURN contract |
| R2 | no executable RETURN → refusal, NO write | — |
| S1 | stale version → `workflow_state_version_conflict` verbatim, exactly one write attempt | CAS/duplicate refusal |
| S2 | `source_node_terminal` verbatim | terminal refusal |
| S3 | foreign/absent instance → 404 family verbatim | no cross-instance leakage |
| S4 | `principal_not_assignee` verbatim | server-side assignee authority |
| S5 | `assistance_open` verbatim | assistance fail-close |
| S6 | detail read failure → NO write ever attempted | read-before-write gate |
| D1 | no idempotencyKey/Idempotency-Key anywhere in the call | trusted broker key seam |
| D2 | two distinct commands = two canonical attempts; 2nd surfaces server CAS verdict | no seam-side dedup state |
| P1 | audit row: kind/action/instance/transition/outcome/receipts; openId ≤6-char prefix; full openId & secrets absent | closed provenance rows |
| P2 | error rows carry verbatim code; fall-through never audits | audit boundary |
| P3 | rows carry unambiguous identity + canonical linkage (r2) | durable human/executor/message/receipt provenance |
| P4 | error + reply-failure rows carry the same identity (r2) | no identity-less rows |
| DR1 | canonical success + reply failure → receipt row persisted, no misclassification (r2) | durability independent of delivery |
| DR2 | audit-sink failure (throw + `{ok:false}`) → truthful log + reply disclosure, canonical truth intact (r2) | audit failure surfaced, never fabricated |
| DR3 | duplicate retry after reply-failure success → 1 success row, fresh-state refusal, both deliveries recorded (r2) | retry truthfulness, no seam-side state |
| Z1 | strict env truthiness ('1'/'true' only); env names frozen | default OFF |
| Z2 | disabled → no setCallback, nothing installed | byte-identical default |
| Z3 | enabled wiring: consumed→true; fall-through→downstream outcome PROPAGATED (value+identity) | bridge error contract preserved |
| Z4 | enabled + broken principals file → throws at wire | fail-loud misconfig |
| Z5 | audit rows durably appended to the JSONL sink and parse back; row carries humanPrincipalId | durable provenance sink |
| Z6 | real audit-sink failure → `{ok:false}` surfaced in log + reply, canonical truth intact (r2) | sink failure never swallowed |

## Focused regressions r2 (side-by-side vs pristine eee7535, identical node_modules)

- seam suite 40/40 PASS (the lane's own surface).
- production-runtime compose-level suites (compose / compose-deployment-root /
  feishu-optional-adapter-startup / feishu-missing-impl-startup): failure
  sets byte-IDENTICAL between pristine eee7535 and the repair head (19
  environmental failures: NODE_RUNTIME_VERSION runtime_version_mismatch pin
  and pre-existing baseline defects) — zero lane effect.
- packages/broker: 504/504 PASS.
- packages/feishu-connector: 262/263 — the single failure
  (AC-CURRENT-MAIN-FULL-TURN-PROMISE) is the SAME pre-existing failure
  recorded in r1 (needs the real DSH harness); identical on pristine base.
- packages/agent-router: no NEW failures — 7 failures shared byte-identically
  with the pristine base; the base additionally showed 5 flaky failures
  (process-spawn/session tests) that PASS on the repair head.

r1 environment note kept for provenance: the r1 focused-regression section
below records the same discipline against origin/main @ d1e42f21.

### r1 focused regressions (original lane, base origin/main d1e42f21)

- seam suite 34/34 PASS (the lane's own surface).
- packages/broker: 492/493 (1 pre-existing env-flake, passes in isolation;
  fails identically on pristine origin/main).
- packages/feishu-connector: 262/263 (1 pre-existing: full-turn test needs
  the real DSH harness; fails identically on pristine origin/main).
- packages/agent-router: 189/197 (7 env failures; pristine main shows 8 —
  zero new failures from the additive `routeAuthenticated` export).
- production-runtime: seam suite + v2-ingress-gate 13/13 PASS; all
  composeProductionRuntime-level suites fail at
  `assertTargetProxyRuntime → NODE_RUNTIME_VERSION runtime_version_mismatch`
  BEFORE any lane code runs — the pinned TARGET_PROXY_NODE_VERSION=v25.6.1
  gate (pre-existing environment constraint, not a lane effect).

