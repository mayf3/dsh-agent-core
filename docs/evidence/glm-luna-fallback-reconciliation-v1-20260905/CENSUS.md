# GLM_LUNA_FALLBACK_PRODUCTION_V1 — FRESH_RECONCILIATION_TO_CURRENT_MAIN (Phase 1 census)

Date: 2026-09-05 · Mode: RESUME_GOAL · docs-only, zero production mutations.
Prior durable state: `deployment-artifacts/model-fleet-glm-luna-production-goal-state/GOAL_STATE.json` (PHASE_0 snapshot @ main a0ce485, 2026-09-03).

## 1. Authority census (fresh, origin/main = 4bb01e0)

| Authority | Status @ origin/main 4bb01e0 |
|---|---|
| AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V2 | **accepted** 2026-09-03, reviewed head d6550a5b, PR #150 @ main 40d0924 — GOVERNING |
| AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_V2 / _IMPL_V2 / _ACTIVATION_V2 | status: superseded (→ FLEET_SHARED_CODEX_AUTH chain). Behavior lives in merged IMPL (PR #111). |
| AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1 (production-apply authority) | **ABSENT from main — still PROPOSED** on branch `codex/fleet-shared-codex-auth-activation-v1` (4361ab8, reviewed @ dc22db8) |
| production_apply_authority | **none** (V2 header); FLEET_PRODUCTION_APPLY = HOLD (Owner ruling 2026-09-03) |

main advanced a0ce485 → 4bb01e0 (PR #164/#169/#170/#171: governance adoption, model-3 broker authoring — no route-chain/credential surface touched by this goal).

## 2. PR census

| PR | State | Note |
|---|---|---|
| #103 (Route Chain V2 authorities, docs) | MERGED 08-29 f54679c | verified |
| #111 (admission-first terminal-quota fallback + one-shot canary seam) | MERGED 08-30 b53ebd6 | verified; introduced quota-classifier real-process A/B/C/D suite |
| #127 (fleet shared Codex auth implementation) | MERGED 08-31 tree 1fdf8c3 | verified; NOT deployed |
| #150 (SCA V2 authority) | MERGED 09-03 40d0924 | verified |
| **#121** (test(router): Luna fallback carrier + ingress coverage) | **OPEN, DRAFT**, head `fix/luna-fallback-candidate-r1`, last commit 08-31, merge-base 9bb5b97 (08-30 main) | disposition below |

## 3. PR #121 disposition → PR_121_REQUIRED = YES (narrowed delta)

Content: two NEW test files only (no implementation): `ingress-fallback.test.js` (scenario 7) + `startup-carrier.test.js` (scenario 5).

- **Already superseded semantics**: quota classification, unsafe-flag STOP set, redaction, hop-exactly-once are covered on main by merged suites (quota-classifier A–D real-process, route-chain CTR-003/005, canary-seam exact-counts, provider-route redaction).
- **Still-missing combination delta** (no equivalent on main):
  1. scenario 7: real `onIngress` → binding → route chain fallback → real ingress delivery point, asserting ONE_LOGICAL_TURN / NO_DUPLICATE_WORK / NO_DUPLICATE_TOOL / NO_DUPLICATE_EXTERNAL_DELIVERY as exact counter equalities (incl. "one failure receipt, never success plus failure"; 4 negative carriers STOP before Luna acquire);
  2. scenario 5: GLM quota hop → Luna initialize JSON-RPC failure → sanitize/classify/route-gate → terminal at totalRouteAttempts=2, glm53 never reacquired, secret absent from journal + error.
- **Fresh verification (this census)**: both files run on a clean worktree at origin/main 4bb01e0 (deps installed): **7/7 tests PASS** (6+1, wrapper child-process isolation + direct child mode). No rebase needed; API surface (`processFactory`, `resolveRouteChain`, journal fields, `helpers/fake-child.js`) fully compatible.
- Consequence: promote the existing draft head as the test-closure candidate (focused tests already PASS) → next phase: independent audit → blocker union once → merge. Do NOT rewrite.

## 4. Production census (read-only, 2026-09-05)

- Runtime: `ai.agent-core.runtime` **pid 72082**, user authsvc, system domain, app root `/usr/local/libexec/agent-core/app` (matches visit-activation census 09-05; two restarts since GOAL_STATE snapshot 69904 — from other goals' deployments).
- Launchd env route: `DSH_AGENT_PROVIDER=oc-go`, `DSH_AGENT_MODEL=deepseek-v4-flash` — **oc-go implicit default still alive** (V2 target state removes it; apply-time item, not pre-apply).
- svc-workflow 8989 `/healthz` = ok.
- `agent-model-overrides.json`: 0600 authsvc, **EACCES for uid 502 (fail-closed, unchanged drift① from 09-03; mtime still Sep 3 12:56)** — content needs privileged context (planned R4 fresh gate).
- `shared-credentials/openai-codex/` — **ABSENT**: canonical shared Codex credential domain NOT built in production. Per-home OAuth count not listable without privilege (09-03 record: 92 byte-identical). dsh-codex 0.2.3 companion pin 75d98d5b unchanged per record.
- Installed blob drift vs origin/main (git-oid of installed file):

| File | installed | main | verdict |
|---|---|---|---|
| agent-router/src/route-chain.js | 010df799 | e2f69dac | DRIFT — production still breakglass v2 baseline; GLM primary route + quota-hop chain NOT deployed |
| production-runtime/src/model-overrides.js | ea44819a | 380f5264 | DRIFT — v2-only loader installed; v3 credentialFile loader NOT deployed |
| production-runtime/src/compose.js | e539ef45 | c407b064 | **TRIPLE-STALE** — installed is an old staging blob absent from main history; main now carries fleet-migration export (runFleetSharedCodexAuthMigrationV1, v3 overrides) + scheduler-history surface; R4 closure blob 4c744186 differs from installed by 94 lines. **Deployment closure must re-adjudicate the compose face.** |
| agent-provisioning/src/index.js | b1d7b94d | 34479d81 | DRIFT — PR #127 provisioning NOT installed |
| agent-provisioning/src/shared-codex.js | ABSENT | 963d03be | NOT installed |
| agent-router/src/ingress-delivery.js, index.js | 36e8674f / c6806a42 | same | SAME |

Net: production remains the **Luna-only breakglass baseline** (overrides luna primary per 09-03 record; GLM→Luna quota-hop chain, shared credential domain, PR #127 provisioning all ABSENT in production).

## 5. Minimal production closure (what is actually NOT done)

Source side is COMPLETE on main (PR #111 + #127 + accepted V2). Remaining = closure side:

- **SB1** Activation authority: FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1 acceptance (exact-head governance gate → Owner; reviewed head dc22db8 already frozen).
- **SB2** R4 remaining artifacts: v2→v3 migrator validation, 10-gate fresh-gate script, 91-home simulator fixtures, bindings skeleton (NOT_FINAL), 5 plans, MANIFEST.sha256, SECRET_SCAN.
- **SB3** Deployment closure re-freeze: compose face triple-stale (see §4); re-adjudicate installed-vs-main compose strategy (selective closure must still run migration export path).
- **SB4** PR #121: independent audit → one blocker union → merge as test closure (draft head verified green on 4bb01e0).
- **MF** Privileged fresh census (overrides content, 92-home OAuth count) inside the planned privileged gate run.
- **FUD** oc-go implicit default removal + canary/batch plan stay apply-time items per V2; legacy runtime 18234 retirement is another goal's scope.

## 6. Proof obligations status (source/test layer)

- SAFE_QUOTA_HOP / UNSAFE_FAILURE_STOP_CHAIN: PASS at suite level (merged quota-classifier A–D + route-chain stop-set) **and** PR #121 combination level (7/7 green this census).
- ONE_LOGICAL_TURN / NO_DUPLICATE_WORK / NO_DUPLICATE_TOOL / NO_DUPLICATE_EXTERNAL_DELIVERY: PASS at PR #121 scenario 7 exact-counter level (not yet merged → SB4).
- Production-layer proof: deferred to artifact canary seam + apply-time plan (HOLD).

## Verification context

- Fresh main worktree used for PR #121 run: `/tmp/dsh-glm-luna-recon` (detached @ 4bb01e0 + the two PR #121 files; own node_modules).
- Zero production mutations; overrides/credential reads fail-closed and recorded; no credentials read or stored.
