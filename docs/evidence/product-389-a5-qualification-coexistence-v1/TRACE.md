# A5 TRACE — candidate/canary qualification vs ordinary fleet admission (current main)

Product: mayf3/dsh-agent-core#389 · Epic #375 (A5) · Goal #386 · Program #382
Base: origin/main `360756e3` (fresh-read 2026-09-30) · Mode: TEST_IDENTITY, non-production
Companion regression: `packages/agent-router/test/process-lifecycle/candidate-qualification-coexistence.test.js` (7/7 PASS)

## 1. Qualification windows (exact source paths)

| Window | Entry/auth path | Phase carrier | Scope of effect |
|---|---|---|---|
| HR R2 trusted startup (`installed`) | `packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs:10` → `authenticateFixedStartupContext` (`hr-s256-r2-startup-context.mjs:137-172`) | operation id `hr-s256-trusted-quiescence-cut-20260925-v1` | successor-entry only; ordinary `scripts/production-runtime.mjs`/`entry.js` never sets it |
| Candidate qualification (`qualification`, non-admin) | `parsedQualificationInvocation` (`--hr-qf-*`, :31-48) → `authenticateQualificationContext` (:193-220) | `context.phase ∈ {deployment_start, restart_a, restart_b}`; role `original_executor_qualification`, procedure `d8cfc5a3…` | read-only CTO-turn readback (see §3.3); deliberately sets NO store state (`:217-219` comment) |
| Fixed-admin canary qualification | `parsedAdminStartupInvocation` (`--hr-admin-*`, :50-79) → role `original_executor_admin_qualification`, procedure `b1a1d5e1…` | same three phases | one private canary turn on `agt_efficiency-agent` (`fixedAdminCanaryProjection`, :357-417) |
| Router-side wiring | `packages/agent-router/src/index.js:280-298` (consume/skip decision), `:313-325` (`fixedAdminRootContext` → registry), `:344` (`qualificationReplyObserver`), `:479` (`publishFixedRuntimeAdmission(service, store, registry.ensureFixedAdminProcess)`) | — | registry reservation + one challenge socket |

Sealed-deploy note: `packages/production-runtime/src/native-arm64/stage.js:86-89` stamps the
production router variant with the single-arg `publishFixedRuntimeAdmission(service)`; the
admin-canary wiring (:479) is the current-main router composition.

## 2. Ordinary admission state machine (the ONLY global gate)

```text
startupBlockedReason = null                     (store.js:64)
  ← durable load parse failure                  (store.js:121 'durable_store_invalid' family)
  ← persistDurable write failure                (store.js:203 'durable_store_unavailable')
businessAdmissionStatus()  → {ready, reason}    (store.js:208-212)
assertBusinessAdmissionReady() → throw
  AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED        (store.js:214-233, envelope not_admitted)
reconciliationRuntimeStatus() →
  health = ready ? 'healthy' : 'blocked'
  businessAdmission = ready ? 'open' : 'fail_closed'   (index.js:447-456)
```

Admission seams that consume the floor (ALL of them; there is no other global gate):

- Feishu ingress: `packages/agent-router/src/ingress-delivery.js:76`
- Delivery V0 (`deliver`): `ingress-delivery.js:334`
- Registry lifecycle entry: `packages/agent-router/src/process-registry.js:33-40` (`assertRecoveryAdmission`) consumed by `ensureRunning` (:230) and route gate `assertRunnable` → `ensureRunningForRoute` (`process-registry-route-gate.js:174-184`)
- Fixed canary pre-admission only: `packages/agent-router/src/process/turn-execution.js:190`

Per-agent fences (never global): `activeFenceForAgent` / `admissionBlockerForAgent`
(`admin-abandonment.js:104`) / fresh-HR `spawnFenceForAgent` (`fresh-hr-lineage.js:155`)
— resolved per agentId from unknown-outcome records.

## 3. Qualification → admission coupling points (complete map)

1. **Canary reservation (private path)** — `process-registry.js:205-210`: with
   `fixedAdminRootContext !== undefined`, `agt_efficiency-agent` is spawnable only through the
   root-held Symbol token; every other caller gets `FIXED_ADMIN_CANARY_PRIVATE_ONLY`. One-shot
   claim: `fixedAdminStartupClaimed` (:260-267) → second root claim = `FIXED_ADMIN_CANARY_NO_REPLAY`.
   Child-side mirror: `turn-execution.js:184-190` (qualified child admits ONLY the fixed canary
   turn) + `parent-rpc-relay.js:76-80` (`FIXED_ADMIN_CANARY_EFFECT_DENIED`).
2. **Canary consumes admission, never drives it** — `fixedAdminCanaryProjection`
   (`hr-s256-r2-startup-context.mjs:373`) asserts `assertBusinessAdmissionReady()` and requires
   `runtime.health === 'healthy' && businessAdmission === 'open'` (:395-396). A pending or failed
   qualification writes NOTHING to the store floor; failure channels are
   `QF_ADMIN_*` rejections → channel destroyed → root UNKNOWN (:445 comment). The canary settles
   `fenceState: 'armed'` (:402) — one-shot, and `ensureFixedAdminProcess` is consumed either way.
3. **Non-admin qualification readback** — `qualificationRuntimeProjection` (:280-320) likewise
   REQUIRES open admission (:300) plus a settled CTO turn; `qualificationReplyObserver` (:323-352)
   is a read-only observer on the resolved-reply seam (`index.js:344`). Failure → socket destroy,
   no store mutation.
4. **Quiescence consumption skip** — `index.js:280-298`: a qualification child
   (`hasFixedQualificationContext()`) does NOT consume `restartQuiescenceEvidenceDir`; ordinary
   children with the dir configured run a deliberately-settlement-incapable consumption
   (audit-only rejections, `startup-recovery.js:15-31`) — no `startupBlockedReason` transition.

**Conclusion of the trace**: pending/failed candidate qualification cannot deny ordinary
admission in current main — isolation is structural (reservation + one-shot private channel +
read-only projections), and the only global gate is the durable-store floor. What current main
lacks is the mechanical proof: zero regression coverage existed for ordinary-traffic coexistence
during qualification pending/failure, and restart_a/restart_b existed only at the durable seal
layer (`test/helpers/quiescence/admin-qualification-seal.test.js`), not at the admission seam.

## 4. Regression added (the material change)

`candidate-qualification-coexistence.test.js` — REAL `createProcessRegistry` + REAL
`AgentProcess` (fake OS children) + ONE real `TurnReconciliationStore`, synthetic identities:

| # | Scenario | Asserts |
|---|---|---|
| 1×3 | pending qualification, phases deployment_start/restart_a/restart_b | ordinary `ensureRunningForRoute('agt_other-agent')` admitted + turn completed + settled record; canary slot EMPTY; store empty |
| 2 | completed restart_a canary, then ordinary traffic | canary settled (armed policy), ordinary turn completes afterwards; exactly 2 settled records |
| 3 | failed canary (unverified child), restart_b | `FIXED_ADMIN_CANARY_CHILD_UNVERIFIED`; zero canary records; ordinary turn completes; retry → `FIXED_ADMIN_CANARY_NO_REPLAY` |
| 4 | bypass attempts | route + direct `ensureRunning('agt_efficiency-agent')` → `FIXED_ADMIN_CANARY_PRIVATE_ONLY`; zero spawn; unrelated agent unaffected |
| 5 | negative control | `startupBlockedReason` set → ordinary admission rejected `AGENT_PROCESS_RECOVERY_STARTUP_BLOCKED` (floor not weakened) |

Result: **7/7 PASS** on fresh main `360756e3` — isolation confirmed present; no source delta
required for this stage (RED iterations were harness-shape only: registry-owned `spawn()` call
and the route-gate `{status:'ready', proc}` wrapper).

## 5. DONE_WHEN ledger

- [x] traced to exact source paths + state transitions (this document §1-§3)
- [x] isolation to the candidate/generation/private canary path verified present at exact
      seams; **zero source delta needed** — the smallest-scope change is the proof itself
      (tests-only); any future deviation is now a RED test
- [x] ordinary unrelated traffic admitted while qualification pending (tests 1×3) and after
      failure (test 3)
- [x] canary fail-closed, no bypass (tests 3-4 + existing fixed-admin-canary/effect-deny suites)
- [x] restart_a/restart_b focused regression at the admission seam (phase matrix + test 3)
- [x] isolated/test-identity E2E: candidate qualification + ordinary coexistence (tests 1-3 at
      registry+process+store integration level, synthetic identities, no production surface)
- [x] reviewed against fresh current main (base `360756e3`; re-verified at commit time)
- [x] no production deploy/restart required; later production verification → WAITING_PROD_AUTH
      with exact release/operation/canary
