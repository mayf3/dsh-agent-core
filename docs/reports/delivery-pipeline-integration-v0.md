# Delivery Pipeline Integration V0 — report

Integration-only closure: combine the three completed deliveries on the
AGENT_DEFINITION_CONFIG_V1 baseline (origin/main 46ca8c1). No Router /
Ingress redesign, no Kernel change.

## Composition (branch `feat/delivery-pipeline-integration-v0`)

| Piece | Origin | Preserved seam |
| --- | --- | --- |
| Agent Definition disabled enforcement | 46ca8c1 (base) | `assertRunnable(agentId)` FIRST in `ensureRunning` — unknown/disabled NEVER spawned |
| Workspace Bootstrap Router Hook | 2fcc3c2 (cherry-picked) | `await workspaceBootstrap.ensure(agentId)` before spawn, post-seed re-check keeps the double-spawn invariant |
| Router Delivery V0 | 15ce043 (cherry-picked) | `agentRouter.deliver({requestId, agentId, sessionMode, message}) -> {accepted, sessionId}` |
| Notification Ingress V0 | d8aaff1 (cherry-picked) | `POST /v1/deliver` thin adapter, localhost only, error envelope `{error:{code,message}}` |

The only index.js conflict (2fcc3c2 vs 46ca8c1) was the `ensureRunning`
comment block — resolved mechanically, keeping BOTH `assertRunnable` and the
workspace seed; the final check -> spawn -> registry.set section stays
synchronous (audit-round-3 double-spawn invariant intact).

## Adaptation to AGENT_DEFINITION_CONFIG_V1 (agent-registry removed)

- `delivery.test.js`: seedDefinition/definitionService fixture pattern
  (router.test.js convention), authored `agt_*` ids, + D10 disabled
  enforcement (deliver rejects disabled at resolveAgentRef AGENT_NOT_FOUND
  before lifecycle; ensureRunning rejects AGENT_DISABLED; zero spawns).
- `agent-router-delivery-v0-verify.mjs`: authors `control/agents.json`,
  re-loads it on the phase-8 control-plane restart.
- `integration.seam.test.js`: defines `agt_demo` in the config, farm links
  `agent-definition` + `broker`; fixes latent never-executed bugs
  (missing `dirname` import, non-iterable object literal, missing broker
  farm link). Env-gated via `NOTIFICATION_INGRESS_INTEGRATION=1`; fails
  loud on a composition without `deliver`.

## Evidence (real DSH)

- Seam (real control plane): `POST /v1/deliver` -> real ingress ->
  real `agentRouter.deliver` -> real AgentProcess -> real DSH inbox ->
  HTTP 200, `accepted: true`, `sessionId` non-empty. PASS.
- Router verify driver REQ1-REQ8: 34/34 PASS — main fixed session
  create/resume, process reuse, fresh minting, requestId retry idempotency,
  kill->respawn->resume, accepted-not-waiting-for-turn (7ms), CP-restart
  mapping persistence.
- HTTP contract: 11/11 — health deliverReady=true (no 503), main 200,
  fresh X / retry / Y, 400 VALIDATION_ERROR (missing requestId, bad
  sessionMode, bad JSON), 404 AGENT_NOT_FOUND (unknown AND disabled).
- Regression: full `npm test` 312 pass / 0 fail / 1 skipped (the
  env-gated seam), router 63/63, definition+ingress+workspace 46/46.

KERNEL_CHANGE = NONE. No merge to main.
