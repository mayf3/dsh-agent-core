# PR #121 Independent Audit R1 — GLM_LUNA_FALLBACK_PRODUCTION_V1

Date: 2026-09-05 · Auditor: independent read-only subagent (fresh context, no shared state with dispatcher).
Object: PR #121 `fix/luna-fallback-candidate-r1` — test-only, two new files (ingress-fallback.test.js / startup-carrier.test.js), verified against clean origin/main 4bb01e0 worktree `/tmp/dsh-glm-luna-recon`.

## VERDICT: PASS — BLOCKER_UNION = ∅ (no fix round, no re-audit required)

## Checklist results

- **A Real production paths**: scenario 7 drives real `ingressDelivery.onIngress` bound by real `apply()` (src/index.js:277) — BindingStore, binding resolution, ingress-delivery, route-chain executor, ProcessRegistry + route gate, reconciliation store all real; fakes confined to documented seams (feishu transport, `processFactory` src/index.js:122-131). Scenario 5 `RpcInitializeFailureProcess extends AgentProcess` overrides only `spawn()` via production `attachChild` (src/process/spawn.js:65), same pattern as existing helpers/fake-child.js; initialize error flows real RPC pending table + `sanitizeProviderError` (src/process/rpc-channel.js:328).
- **B Counter soundness**: scenario 7 `deepEqual` over 10 counters + processes=2 + replies=1 + pinned reply text; scenario 5 `deepEqual` 4 counters + spawned=2 + zai=1. Mutation testing (scratch copy, since deleted): double reply → caught; weakened ambiguous-quota STOP → caught; duplicated route list / back-hop → caught on totalRouteAttempts/attempts/spawned. **No false-pass.**
- **C STOP taxonomy exact**: toolStarted/partialOutput → precedence-1 → POST_ADMISSION_FAILURE (route-chain.js:168-174); terminationProven:false → fail-closed UNKNOWN_FAILURE_CLASS (:194); outcome_unknown envelope → OUTCOME_UNKNOWN (:161-163, checked first). Agrees with quota-classifier.test.js.
- **D Scenario 5 redaction**: secret redacted at RPC boundary (redactSensitiveText Authorization/Bearer), classified provider_unavailable, rethrown FAIL_LOUD (agent-process.js:213-216) → INITIALIZE_PROVIDER_UNAVAILABLE + proven_no_admission (route-chain.js:205-212); terminal at 2 (no next route). Leak channels checked beyond assertions: journal structural-only at every call site, error.routeChain structural, staleSlotAudits not populated (redacted anyway), fatal() string-only. **No forgotten channel.**
- **E Hygiene**: wrapper asserts child.error undefined + child.status 0 with output in message (inner failures fail suite — empirically confirmed); deterministic microtask child; mkdtemp cleanup; DEADLINE_ENV isolation; marker override prevents wrong-marker false-pass. Clean on Node v26.7.0.
- **F Authority conformance**: only whitelisted proven-no-admission classes hop; STOP set asserted negatively; budget=1 enforced; journal structural-only via secret-absence (CTR-IMPL-006). No contradiction with frozen boundary / IMPL V2 vocabulary.

## Non-blocking notes (NOT blockers, not fixed per ANTI_CHURN)

1. spawnSync lacks `timeout` (both wrappers) — bounded in practice by inner deadlines (5s / default 300s); optional hardening `timeout: 120_000`.
2. `node --test test/route-chain/` trailing-slash dir arg fails on Node 26 runner invocation artifact — repo glob/script form works.
3. Negative cases assert counters field-by-field vs whole-object deepEqual — cosmetic.
4. outcome_unknown negative carrier injected at chain boundary, not via real AgentProcess envelope — identical classifier path; real-producer variant already covered by merged quota-classifier suite.
5. Spec prose fragment shows `attemptOutcome = hop:...` vs implementation/tests `fallback:...` — tests match implementation; drift is in spec prose only (FOLLOW_UP_DEBT, doc-only).

## Evidence (observed runs)

- Combined outer mode: 2/2 pass. Isolated child mode: 6/6 (ingress-fallback) + 1/1 (startup-carrier).
- Full route-chain suite WITH PR files: 71/71 pass (69 pre-existing + 2 wrapper); no conflicts/duplication.
- `git diff --stat HEAD -- packages/agent-router/src` empty → test-only confirmed.
