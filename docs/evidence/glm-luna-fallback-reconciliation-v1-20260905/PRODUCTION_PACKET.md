# PRODUCTION PACKET — GLM_LUNA_FALLBACK_PRODUCTION_V1 (FROZEN 2026-09-05)

GOAL_PHASE = **READY_FOR_PRODUCTION_SLOT** · PRODUCTION_APPLY_ALLOWED = **NO** (HOLD while HR_DISPATCH_DELIVERY_READINESS_V1 owns the mutation lane; auto-resume on PRODUCTION_RUNTIME_LOCK = IDLE — no Owner prompt needed).

## 1. Authority (ACCEPTED_AND_MERGED)

- AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V1 — Owner exact-head acceptance `b5717e3345ad98b063709f995750f8ddf934437f`; merged via PR #175 (main 797952e); ancestor-verified.
- Governing parent: AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V2 (accepted, PR #150).
- Accepted semantics frozen verbatim in the spec frontmatter `acceptance_semantics` block (fleet 92 exact; compose EXCLUDED; v2→v3 atomic; SAFE_QUOTA_HOP preserved; STOP_CHAIN; ONE_LOGICAL_TURN + NO_DUPLICATE_* REQUIRED; TEN_GATE_BOOTSTRAP REQUIRED; no reauth; concurrency 1).

## 2. Source (AUDITED, MERGED)

- CTR-ACT-005 bounded bootstrap runner delta: PR #176 merged @ main **16e1423**; independent audit R1 **PASS / BLOCKER_UNION empty** (fail-closed completeness, legacy byte-identical else-branch, boundary = exactly 2 files); focused tests 8/8, legacy suite 11/11, full production-runtime 148/149 (1 pre-existing env gap, A/B-verified on pristine base), structure gate PASS, sandbox bootstrap chain SIM 22/22.
- PR #121 test closure merged @ 513c691 (safe-hop / STOP_CHAIN / ONE_LOGICAL_TURN / NO_DUPLICATE combination proof, 7/7).

## 3. Deployment closure (CANDIDATE_CONTENT_V2, byte-frozen to main 16e1423)

8 blobs, `BLOBS.manifest` byte-identity 8/8: route-chain e2f69dac · model-overrides 380f5264 · provisioning index 34479d81 + shared-codex 963d03be + plugin-artifact 89394ab3 · migration-cli a8620ea9 + **migration-executable 6e29b5f8 (incl. accepted bootstrap delta)** + shared-codex-migration 70e74439. compose.js EXCLUDED (installed e539ef45 stays). memory.js structurally untouched (apply-time gate: MEMORY_JS_BEFORE=AFTER=99d59bdeb055e18d7827d5529f2505783252e6b75124f8fb45c91d5a96bf2b7d). SECRET_SCAN 0 hits.

## 4. Transaction mechanics (FINAL)

- Bindings: `deployment-artifacts/model-fleet-glm-luna-activation-prep-r4/bindings/` — TRANSACTION_BINDINGS.md FINAL + 13 ops-scripts + `bootstrap-transaction-config.template.json` (root=/, CANDIDATE_DIR override supported by the simulator).
- Gate scripts: `tools/bootstrap_ten_gate.mjs` (CTR-SCA-017 ten-gate receipt, now carrying `inventory_paths`) + `tools/fresh_production_gate.mjs` (CTR-ACT-011 eight items).
- Plans: P1 quiesce/fence → P2 fresh gate → P3 canaries CEO/HR/Podcast/Shopping → P4 small batch (5) → P5 fleet waves 92/92 + stage-scoped rollback (canonical NEVER rolls back).

## 5. Apply-time fresh gates (ALL must PASS before any mutation; any FAIL ⇒ OPERATOR_BLOCKED)

`AUTHORITATIVE_REGISTRY_COUNT=92` · `92ND_AGENT=agt_huanhuan-thought-agent` · `ROSTER_92_IDENTITY_CLOSURE=PASS` · `ROSTER_BIJECTION=PASS` · `PER_HOME_OAUTH_COUNT=92` · `BYTE_EQUALITY_92=PASS` · `CANONICAL_DOMAIN_PRESTATE=EXPECTED(ABSENT)` · `CURRENT_ROUTE_BASELINE=EXPECTED` · `RUNTIME_HEALTH=PASS` · `MEMORY_FIX_PRESERVED=PASS` · `CLOSURE_PREIMAGES=MATCH` (installed-vs-V2-blob ledger re-read). **Roster drifted away from exact 92 ⇒ FAIL_CLOSED** (no N/N generalization; a new semantic reconciliation would be a separate Owner gate).

## 6. Execution sequence (single quiesce window, concurrency=1)

quiesce (P1) → eight-item fresh gate + ten-gate `pre` receipt (P2, expected-count 92) → install 8-blob closure → run `v2_to_v3_migrator.mjs` (version:3 + credentialFile injection, one atomic step) → `shared-codex-migration-cli.js migrate <config> --activate-production` (bootstrap mode: quiesce re-confirm → fence → copy-once → Model A probes → switchFleetConfig re-affirm → pinned artifact → restart → 4 canaries → fleet health) → ten-gate `post` fence (gate 10) → P3/P4/P5 ladder → terminal proofs (`AGENTS_CANONICAL=92/92`, `PER_HOME_RUNTIME_OAUTH_USE=0`, canonical 0700/0600, MEMORY_JS gate, receipts archived).

## 7. Production terminal target (goal completion — not merely credential migration)

CANONICAL_SHARED_CODEX_CREDENTIAL=PRODUCTION_ACTIVE · AGENTS_CANONICAL=92/92 · PER_HOME_RUNTIME_OAUTH_USE=0 · GLM_PRIMARY=PRODUCTION_ACTIVE (zai/glm-5.3 via its own authorized route round) · LUNA_FALLBACK=PRODUCTION_ACTIVE (openai-codex/gpt-5.6-luna) · SAFE_QUOTA_HOP/UNSAFE_FAILURE_STOP_CHAIN=PRODUCTION_PASS (canary seam, P4 `QUOTA_FALLBACK_SEMANTICS`/`OUTCOME_UNKNOWN_STOP`) · ONE_LOGICAL_TURN + NO_DUPLICATE_*=PASS · RUNTIME_HEALTH=PASS ⇒ `GLM_LUNA_FALLBACK_PRODUCTION_READY=YES` ⇒ GOAL_STATUS=COMPLETE → durable terminal handoff.
