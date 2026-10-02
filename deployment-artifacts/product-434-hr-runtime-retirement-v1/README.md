# PRODUCT_434_HR_RUNTIME_RETIREMENT_V1 — release/retirement packet (FROZEN)

```text
PACKET_ID              = product-434-hr-runtime-retirement-v1
PRODUCT                = mayf3/dsh-agent-core#434 (Core runtime 去特例 — HR 一次性恢复代码退出通用启动与准入路径)
READY_FOR_PRODUCTION_PACKET = YES
READY_FOR_PRODUCTION_APPLY  = NO   (Owner production authorization required; see PROD_AUTH_REQUIREMENT)
PRODUCTION_APPLY       = HOLD
PRODUCTION_MUTATION    = NO       (this packet freeze performed zero production mutation)
CLASSIFICATION         = FULL_RELEASE_PACKET (not VERIFY_ONLY — see INSTALLED_STATE)
GOVERNING_SPECS        = PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 (accepted);
                         SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 §12.2 (accepted, packet binding contract);
                         SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §1 (accepted, preflight/census seam);
                         MRDP baseline #383 / PR #374 (existing release road)
```

## 1. What ships (exact target)

The merged Product #434 head — HR runtime de-specialization r1, already reviewed and merged to main:

| Binding | Value |
|---|---|
| CANDIDATE_HEAD (deploy target) | `daa4c82d0501b4c582b09cb6c0ab07f474659fe1` (= origin/main at freeze time) |
| CANDIDATE_TREE | `80ba798c3a4470078f4cc8479d0f6c6bf6306231` |
| REVIEWED_CANDIDATE_HEAD | `dfb654f895d16a464d134d3b9d493af4802adeac` (PR #438 reviewed head, exact) |
| INTEGRATION_BASE | `d54b8f70a920398e8101c8c3630a82bc70baa391` (PR #438 base) |
| Changed surface | 61 files, +727 / −5,126: 17 HR incident runtime modules + 21 historical operation test files deleted from the runtime import graph; ingress/spawn/prompt gates + parent-rpc stop barrier genericized with exact inert-state parity; legacy durable fields `freshHrCutBinding` / `lineageOperationId` kept as byte-stable load-only receipts |

This is a **full trusted-closure generation install** (the change set is NOT inside the scheduler-watchdog overlay universe, so the overlay-only path cannot ship it). The existing release road is: `scripts/trusted-cp-deploy-install.sh` (root, provenance-pinned, production-deploy mutex) → the EXISTING controlled apply `scripts/scheduler-cp-admission.mjs --apply --source-sha <head>` — the only existing caller of the drain-gated `restartSchedulerProductionRuntime` restart and the only existing W1/W2 re-stamp surface (`watchdogInstall`) → readback.

## 2. Loaded revision / installed state (fresh census 2026-10-03, metadata-only, uid 502, no secrets read)

| Surface | Reading |
|---|---|
| LOADED_REVISION (declaration) | `AGENT_CORE_DEPLOYED_SHA = d602b592fad345fb1c9adebe2bc6611a6f5cfdc2` — identical in `/Library/LaunchDaemons/ai.agent-core.runtime.plist`, watchdog plists W1+W2, and the running process env (`launchctl print system/ai.agent-core.runtime`, pid 45498, state=running, started 2026-10-02 14:35 +0800 as user `authsvc`) |
| Commit identity of stamp | `d602b592` = 2026-09-17 merge (PR #303); **ancestor of CANDIDATE_HEAD with 410 commits between** |
| INSTALLED_STATE | **INSTALLED = NO** for the de-specialization. Production runs a generation 410 commits behind the merged head. Do not assume source merge means installed. |
| Live closure | `/usr/local/libexec/agent-core/app` — exactly **17 package dirs** today (frozen baseline list in README §2 note + RUNBOOK §0). A fresh install of CANDIDATE_HEAD produces **22 dirs** (the head installer copies every `packages/*` dir with a `package.json` = 21, plus the explicit code-only `development-execution` src/ carry); the frozen post-apply expectation is therefore the 22-dir manifest, with the +5 delta (`agent-identity-capabilities`, `development-execution`, `execution-history`, `fixed-operation`, `session-history`) recorded as expected closure growth; live tree is not a git checkout (stamp is a declaration, not provenance) |
| LIVE_SPECIAL_CASE_CENSUS | Live closure **still contains** the removed HR modules on disk: `agent-router/src/fresh-hr-cut-startup.js`, `fresh-hr-ingress.js`, `reconciliation/fresh-hr-lineage.js`, `binding-store-fresh.js`, `production-runtime/src/native-arm64/hr-s256-r2-startup-context.mjs`, `hr-fresh-lineage-startup-context.mjs` (+ remaining hr-* native-arm64 set); live `agent-router/src/index.js` still **imports** them (3 HR import lines at 78/86/87); 9 files under live `agent-router/src` match HR literals. The RUNNING process therefore still loads HR incident modules at boot (all classified SPENT/inert by #228, but present and imported). |
| Live process argv | **Zero** processes carry `--hr-*` / `fresh-hr*` / `hr-s256*` / `agt_hr*` / `hr-admin*` argv (self-match-free scan, 2026-10-03) |
| Live byte drift | Sampled live files (`agent-router/src/index.js`, `binding-store.js`, `scripts/production-runtime.mjs`) match **neither** the declared stamp `d602b592` nor CANDIDATE_HEAD bytes — consistent with historical in-place incident overlays. Consequence: **apply-time PREIMAGE capture of live bytes is mandatory** (RUNBOOK P2); the declared stamp alone is not a rollback artifact. |
| Fleet gate baseline (read-only, unprivileged) | `scripts/scheduler-cp-fleet-gate.mjs --check` @ CANDIDATE_HEAD: G1 PASS, G4 PASS (54 relative imports, 0 unresolved), G5 PASS, BROKER_SHARED_BYTES FAIL — expected pre-deploy (live `packages/broker/src/index.js` = `37501c48…` ≠ pinned production-proven `0720757b…`; head bytes = `69c1672c…`, see RUNBOOK C8) |
| gui/502 runtime | `gui/502/ai.agent-core.runtime` runs (pid 1329) with **no** AGENT_CORE_DEPLOYED_SHA stamp — out of scope for this generation install (dev-facing wrapper runtime, per PDCP census OBS-DCP-004) |
| authsvc-private stores | `/Users/authsvc/.agent-core/` is not readable by uid 502 (fail-closed record). Jobs/binding/reconciliation store censuses are service-identity steps inside the runbook, never uid-502 raw reads. |

## 3. Why FULL_RELEASE_PACKET and not VERIFY_ONLY

VERIFY_ONLY would require production to already run an equivalent/newer tree. It does not: the loaded stamp is 410 commits old, the live closure still contains and imports the deleted HR modules, and live bytes differ from both the declared stamp and the target. The minimum correct action is the full packet below, whose apply retires the HR special-case modules from the loaded generation in one controlled release with prior-image rollback.

## 4. Verification frozen at the candidate head

Prior evidence (recorded on the exact heads, from #228/#229/#230):
- Independent changed-surface review: PASS / BLOCKING = 0 (@ `dfb654f8`).
- Required suites: 71/71 green; full `npm test` failing-file set a strict subset of base `d54b8f70` (49 → 46 env-failing files, zero new failures).
- Repository merge gates on the exact head: SPEC_GATE = PASS, SPEC_COMPLIANCE = PASS, TESTS = PASS (@ `dfb654f8`, #230 receipts).

Fresh test-identity re-run at `daa4c82d` (this freeze, node v26.7.0, non-production; exact file set frozen):
- Canary core suites — `agent-router/test/binding-store.test.js`, `agent-router/test/process-lifecycle/unknown-fence-no-replay.test.js`, `agent-router/test/route-chain/parent-rpc-stop-barrier.test.js`, `agent-router/test/runtime-hygiene/no-hidden-hr-runtime-knowledge.test.js`: **35/35 pass**.
- Drain/quiescence suites — `production-runtime/test/scheduler/restart-drain.test.js` + `agent-router/test/process-lifecycle/restart-quiescence*.test.js` (4 files): **47 tests, 46 pass, 0 fail, 1 skipped** (env-conditional); the drain observe/refuse/receipt semantics (A2/A3/A4 of the drain gate) all green.
- Generic scheduler dispatch — `scheduler/test/schedule.test.js` (cron/every/at kinds): **9/9 pass** (after routine `npm install` providing `croner`).
- Fleet gate readback against live: see §2 (pre-apply baseline receipt).

## 5. Execution authorization

- PROD_AUTH_REQUIREMENT: execution of RUNBOOK §2 requires the standing production authority (Owner-announced P0 release, `PRODUCTION_MUTATION_CONCURRENCY=1`, global production-deploy mutex) and root for the installer/restart steps. This packet freeze ran none of it.
- Post-mutation failure rule (#386 Owner policy 2026-10-02): after apply, the FIRST failed canary → immediate rollback (RUNBOOK §4) if the rollback artifact is viable; no extended in-place investigation on the production writer.
- #434 stays open after apply until INSTALLED/ENABLED/BUSINESS_VERIFIED evidence exists; apply alone does not close it.
