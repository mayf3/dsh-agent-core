# ACTIVATION_V2_PREDEPLOYMENT_CLOSURE_20260906 — GLM_LUNA_FALLBACK_PRODUCTION_V1

```text
GOAL_STATUS = ACTIVE
CURRENT_PHASE = READY_FOR_PRODUCTION_SLOT
LANE = (A) realigned to accepted AGENT_CORE_FLEET_SHARED_CODEX_AUTH_ACTIVATION_V2 @161e2ff
PRODUCTION_APPLY = HOLD_BY_OWNER · PRODUCTION_MUTATION = NONE · OWNER_ACTION_REQUIRED = NONE
```

## 1. Lane decision (recorded, not recreated)
After the supersession gate-return (AUTHORITY_SUPERSESSION_RECONCILIATION_20260906.md, 6a6870d),
the Goal's own terminal condition `ACCEPTED_AUTHORITY = MERGED / CURRENT` is only reachable under
the current accepted authority, so the predeployment lane realigned to ACTIVATION_V2
(yanfenma unified backend 127.0.0.1:8787, registry 88, ONE_CANONICAL_OWNER_REAUTH, bootstrap NOT
selected, Luna = agt_stock_agent + agt_ceo-agent + agt_cto-agent migration; /Users/authsvc/** untouched).
The V1-frame packet (14c0c7a) remains frozen as the authsvc-domain closure of record.

## 2. Mechanical §4 drift found and honored (fresh proof over frozen text)
- Real installed config = `{"version":1,"overrides":{…}}` (549dace v1 loader accepts ONLY version 1;
  at most the agt_cto-agent override). Spec §4 said "schema v2". The domain migration is therefore
  v1→v3 (+ legacy-v2 whitelist reuse); the migrator accepts both, apply-time fresh census decides.
- CTR-ACT2-001 seam check vs 549dace FAILED as feared: the deployed compose consumes flat
  `override.plugin/pluginVersion/providerEnv` + `CHATGPT_SUBSCRIPTION_V1.credentialFile`, which the
  v3 loader no longer exposes ⇒ the sanctioned minimal compose adjustment is part of the closure
  (549dace bytes + resolveProcessConfig hunk only; 391→398 lines).
- Loader route-identity dedup forces distinct `credentialReadiness` per identical Luna route —
  documented in the focused tests and enforced by the migrator (ROUTE_IDENTITY_DUPLICATE fail-closed).

## 3. Implementation (CTR-ACT2-002 — the only product-code delta)
dsh PR #187 merged @ main **34b2b49** (branch head 06f094e):
- CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE → /Users/yanfenma/.agent-core/... (model-overrides.js + agent-provisioning/shared-codex.js)
- executable: SHARED_CONFIG_PATH/FENCE_PATH → /Users/yanfenma/.agent-core/...; CANARIES → STOCK,CEO,CTO
  (CTR-ACT2-005 order); probeAuthsvcControlPlane → probeCanonicalOwnerControlPlane.
- EXPECTED_FLEET=92 untouched (bootstrap-only, unreachable in the selected normal path); PIN unchanged;
  selection/quiesce/fence/atomic/rollback semantics byte-verbatim; compose-frame op-runner untouched.

## 4. Tests + audit chain
- Focused 28/28 (incl. new realignment suite: constants, authsvc rejection, canary order STOCK→CEO→CTO,
  92-gate bootstrap-only via 1-candidate normal path, migrated real-snapshot v3 load with
  providerEnv+canonical passthrough, route-dedup + authsvc-credentialFile negatives).
- production-runtime 167 tests / 165 pass / 0 fail / 2 skipped; route-chain + provisioning 84/85 with
  1 pre-existing env gap A/B-identical on base 600d4df.
- Independent implementation audit: ACCEPT_WITH_BLOCKERS (exactly 1 blocker: vacuous canary-order
  assertion in the sandbox E2E receipt — evidence defect, ordering semantics independently proven)
  → ONE bounded repair (fail-loud assert_receipt + corrected pattern) → fresh re-audit ACCEPT /
  BLOCKERS empty (verifier re-ran the E2E; receipts genuine, non-vacuous).

## 5. ACC-ACT2-001..004/005 evidence
- ACC-ACT2-001: 11/11 closure blobs byte-identical to merged main 34b2b49; compose = 549dace + minimal
  delta; UNRELATED exclusion by import-closure proof (12 blobs, node: builtins + repo-relative only).
- ACC-ACT2-002/003: focused suite above; migrator v1→v3 on the REAL redacted snapshot
  (v3 exact output, canonical credentialFile, providerEnv carried, routes cto-luna/stock-luna/ceo-luna).
- ACC-ACT2-004: sandbox E2E (549dace tree + closure install + fixture root): reuse branch reauth=0 AND
  domain-expected reauth branch reauth=exactly-1, canary order evidence, canonical 0600, fence durable,
  rollback rehearsal PASS (canonical retained), zero-per-home fail-closed negative. Receipt:
  deployment-artifacts/model-fleet-glm-luna-activation-v2-r1/receipts/sandbox_e2e_2026-09-06.log.
- ACC-ACT2-005: secret scan zero hits across the artifact set.
- Census (preparation, read-only): census/PREIMAGE_CENSUS_20260906.txt — checkout prestate (3 PRESENT
  hashed / 9 ABSENT), config v1 sha256, registry 88, canonical ABSENT, single per-home store,
  control plane pid 18234 uid502, checkout HEAD 549dace. Packet §1 mandates a fresh re-census at apply.

## 6. READY_FOR_PRODUCTION_SLOT conditions
ACCEPTED_AUTHORITY=MERGED/CURRENT (ACTIVATION_V2 @161e2ff, superseded_by=null) ·
CTR_ACT_005=IMPLEMENTED_AND_MERGED (PR #187 @34b2b49; realigned to the accepted normal-reauth path) ·
BINDINGS=FINAL (TRANSACTION_BINDINGS.template.json + RELEASE_MANIFEST) · FOCUSED_TESTS=PASS ·
TEN_GATE_SIMULATION=N/A→SUPERSEDED_BY_SANDBOX_E2E (bootstrap branch not selected in this domain; the
ten-gate/receipt machinery stays byte-verbatim and bootstrap-only) · ROLLBACK_SIMULATION=PASS ·
IMPLEMENTATION_AUDIT=PASS · BLOCKERS=0 · ARTIFACT=FROZEN (MANIFEST.sha256, 20 files) ·
PRODUCTION_PACKET=READY (PRODUCTION_PACKET_ACT_V2.md) · SECRET_SCAN=PASS · PRODUCTION_MUTATION=NONE.
```
