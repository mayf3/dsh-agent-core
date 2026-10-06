# RED / GREEN record and test matrix — Product #478 (G5)

Run: `cd packages/production-runtime && node --test test/human-work-item-ingress.test.js`

RED phase: authored BEFORE the seam module existed — the suite failed at
import (module not found), then 28/34 after the first implementation pass
(the 6 failures were exactly the contract deltas: parser null/usage split,
fall-through ownership in the caller wrapper, refusal phrasing, wire return
value). GREEN at 34/34; re-run GREEN at 34/34 after the independent review
fix round.

## Matrix (34 tests)

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
| I2 | loader rejects: version≠1, missing fields, duplicate openId, SHARED executorAgentId, non-array, non-object, bad JSON | total fail-closed allowlist |
| I3 | executor identity only in gateway context `{agentId}`, never in call args | trusted credential seam |
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
| Z1 | strict env truthiness ('1'/'true' only); env names frozen | default OFF |
| Z2 | disabled → no setCallback, nothing installed | byte-identical default |
| Z3 | enabled wiring: consumed→true; fall-through→downstream outcome PROPAGATED (value+identity) | bridge error contract preserved |
| Z4 | enabled + broken principals file → throws at wire | fail-loud misconfig |
| Z5 | audit rows durably appended to the JSONL sink and parse back | durable provenance sink |

## Focused regressions (this environment, node v26.7.0 vs pinned runtime v25.6.1)

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
