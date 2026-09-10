# WORKFLOW_DATA_HYGIENE_V1 — PRODUCTION_CENSUS_AND_CLASSIFICATION_LEDGER

- **Status**: FROZEN · r2 (r2 = MECHANICAL_LEDGER_FIX per Owner ruling 2026-09-10: lifecycle and business classification are now two orthogonal dimensions; facts unchanged, wording/metrics regenerated deterministically)
- **Census taken**: 2026-09-10 22:1x–23:0x (+08), production svc-workflow DB `svc_workflow_dogfood_clean` (read-only as `svc_wf`), auth authority DB `agent_dev_center` (read-only as `auth_ro`)
- **LIVE_ROW basis**: every instance with `cancelled=false AND archived_at IS NULL` at census time = **338**
- **Determinism**: `build-classification-ledger.mjs` over frozen TSVs; re-run byte-identical; hashes in `census-raw/MANIFEST.sha256`
- **Sanitization**: IDs / counts / classes / agent_ids only

## Vocabulary (frozen)

```text
LIVE_ROW               = DB-present instance row, cancelled=false AND archived_at=null (any lifecycle state)
NON_TERMINAL           = not yet in terminal lifecycle state (= NON_TERMINAL_CURRENT ∪ NON_TERMINAL_DANGLING)
NON_TERMINAL_CURRENT   = has a live current node visit (dispatch-relevant)
NON_TERMINAL_DANGLING  = no current node visit pointer (never entered / incomplete; NOT terminal history)
DISPATCH_ELIGIBLE_ACTIVE = NON_TERMINAL_CURRENT ∧ ¬QUARANTINED ∧ agent_resolve_principal(current assignee)=PASS
                         (FAIL rows are fail-closed: zero activation footprint mechanically verified 2026-09-10)
QUARANTINED            = non-terminal but explicitly barred from dispatch/recovery unless a future
                         authority changes the disposition (overlay flag, NOT an exclusive class)
```

## 1. Exclusive primary business classes (mutually exclusive, summing)

| Class | Rows |
|---|---|
| REAL_BUSINESS | 217 |
| HUMAN_REQUIRED | 77 |
| TEST_OR_FIXTURE | 38 |
| STALE_IDENTITY_UNIQUE_SUCCESSOR | 6 |
| STALE_IDENTITY_UNRESOLVED | 0 |
| **SUM (mechanically asserted by builder)** | **338 = LIVE_ROWS** ✓ |

## 2. Lifecycle projection (orthogonal dimension)

| Lifecycle | Rows |
|---|---|
| TERMINAL | 273 |
| NON_TERMINAL_CURRENT | 61 |
| NON_TERMINAL_DANGLING | 4 |
| **SUM** | **338** ✓ |
| QUARANTINED (overlay ⊂ NON_TERMINAL_CURRENT) | 1 (cebf4816, DO_NOT_RECOVER per WDA recovery goal ruling) |
| DISPATCH_ELIGIBLE_ACTIVE | 47 |

## 3. Class × lifecycle matrix (exhaustive cross-check)

| Class | TERMINAL | NON_TERMINAL_CURRENT | NON_TERMINAL_DANGLING | Σ |
|---|---|---|---|---|
| REAL_BUSINESS | 193 | 24 | 0 | 217 |
| HUMAN_REQUIRED | 54 | 23 | 0 | 77 |
| TEST_OR_FIXTURE | 26 | 8 | 4 | 38 |
| STALE_IDENTITY_UNIQUE_SUCCESSOR | 0 | 6 | 0 | 6 |
| STALE_IDENTITY_UNRESOLVED | 0 | 0 | 0 | 0 |
| **Σ** | **273** | **61** | **4** | **338** |

r1 wording errors corrected here: “217 REAL_BUSINESS（含 277 TERMINAL）” was a dimension conflation (277 was the all-class terminal count incl. 4 dangling rows mislabeled); the 4 canary-e2e/auth-e2e no-visit fixture rows are NON_TERMINAL_DANGLING (each has 1 dangling visit, no current pointer, zero event chain — not terminal history).

## 4. Frozen boundary metrics

```text
ACTIVE_AGENT_ASSIGNEE_UNRESOLVABLE = 0
  semantics: DISPATCH_ELIGIBLE row with FAIL assignee — strict dispatch projection.
  No dispatch-eligible row has an unresolvable assignee: all 14 NON_TERMINAL_CURRENT FAIL rows
  are fail-closed (zero activations, mechanically verified).
  Supporting disposition set (NOT silent): NON_TERMINAL_STALE_ASSIGNEE_TOTAL = 6
    = 5 business blocked (RECOVER_VIA_WAE_V2 dispositions, CLEANUP_PLAN §M3)
    + 1 QUARANTINED (cebf4816, QUARANTINE_DO_NOT_RECOVER — never counted as normal active-dispatch)
  Terminal condition: metric stays 0 AND all 6 dispositions remain explicitly frozen.

ACTIVE_TEST_OR_FIXTURE_BUSINESS_INSTANCES = 12
  = 8 NON_TERMINAL_CURRENT (5 assistance DRAFT + 3 canary-wda DRAFT)
  + 4 NON_TERMINAL_DANGLING (canary-e2e ×2, auth-v1-e2e-readonly ×2)
  The 26 TERMINAL test rows are history → PRESERVE, NO MUTATION by default (Owner ruling M1).
  All 12 have zero activation footprint (mechanically verified 2026-09-10).

AGENT_TASK_WITHOUT_CANONICAL_ACTIVE_AGENT (future-config surface) = 25 defs + 1 domain-owner binding
HUMAN_TASK_MISCLASSIFIED_AS_AGENT = 0
REAL_BUSINESS_INSTANCE_DELETED_BY_CLEANUP = 0 (invariant, enforced by plan design)
HISTORICAL_AUDIT_CHAIN_BROKEN = 0 (invariant, enforced by plan design)
```

## 5. Resolution semantics (`agent_resolve_principal`)

```text
PASS    := machine_principals.status='active' AND agent_id ~ ^agt_[a-z0-9-]+$
FAIL    := otherwise (NOT_FOUND | legacy naked-name | disabled | anomalous agent_id)
SUCCESSOR_LINE := svc workflow_identity_successor_lines row (4 rows, identity_repair_v1 2026-09-07/08, audited)
UNIQUE_TWIN    := exactly one active auth principal with agent_id = 'agt_' + legacy_name (87/117 legacy; 0 ambiguous; 30 NO_TWIN all test/synthetic/service identities)
```

## 6. The 6 NON_TERMINAL stale-assignee rows (disposition set, CLEANUP_PLAN §M3)

| instance | domain | current node | assignee (auth agent_id) | successor | disposition (frozen) |
|---|---|---|---|---|---|
| cebf4816 | build-in-public-dogfood | step_1/TASK | 61819256 (writing-style-analyst-agent) | 9e3adced ✓reg | **QUARANTINE_DO_NOT_RECOVER** (carried from WDA recovery goal; not counted as normal active-dispatch) |
| e683189a | hr-onboarding | final_verify/NORMAL | 3e2439d2 (cto-agent) | 4e5a4578 ✓reg | **QUARANTINE_DO_NOT_RECOVER** (frozen evidence, workflow-assignee-identity goal) |
| 5709a28e | build-in-public-dogfood | reviewing/NORMAL | 61819256 (writing-style-analyst-agent) | 9e3adced ✓reg | **RECOVER_VIA_WAE_V2** (WAE Subject B, that goal owns execution) |
| 8816acaf | journal-submission | language_polish/NORMAL | 61819256 (writing-style-analyst-agent) | 9e3adced ✓reg | **RECOVER_VIA_WAE_V2** (business, historical blocked visit) |
| 64d4b779 | adc-v2-dogfood | publish/NORMAL | 3e2439d2 (cto-agent) | 4e5a4578 ✓reg | **RECOVER_VIA_WAE_V2** (root cause = M6 binding; future visits fixed by M6) |
| 99d369f6 | adc-v2-dogfood | publish/NORMAL | 3e2439d2 (cto-agent) | 4e5a4578 ✓reg | **RECOVER_VIA_WAE_V2** (same) |

No `node_visit.assignee_principal_id` is ever SQL-rewritten (FORBIDDEN). Dispositions are ledger facts; recovery executions belong to the accepted WAE V2 authority.

## 7. HUMAN_REQUIRED confirmation (M4 basis)

- `personal_quick_item_v1` = open(DRAFT, WORKFLOW_CREATOR) → completed/cancelled(TERMINAL). **No agent execution node exists** — the work happens outside the workflow; the instance is the human-work tracking shell. This is the system's accepted HUMAN_REQUIRED carrier.
- All 23 NON_TERMINAL human DRAFT visits already carry canonical assignee b21ddb23 (`agt_efficiency-agent`) — WORKFLOW_CREATOR resolution rebound post-cutover. Identity-healthy; the items wait on the human, which is their design.
- Canonical efficiency-agent's existence ≠ authorization to perform purchasing/payment/real-name/medical actions for the human; no routing grants that. MUTATION_REQUIRED = NO for all 77.
- Permanent admission schema = separate Goal `WORKFLOW_ASSIGNEE_ADMISSION_GUARD_V1` (not ours).

## 8. Identity registry state (M5 basis)

- Principals vanished from auth (NOT_FOUND): confined to TEST-class rows (assistance instances 12f26d3b/73ebfa8f/e43f9801/771546ea; synthetic fixture ids 10000000-*/bbbbbbbb-*; smoke-test def principal e5efd1a7). **BUSINESS_ACTIVE_CONTAMINATION = 0** → IDENTITY_REPAIR = NO for all of them; they exit with M1 test cleanup. No formal identity is manufactured for test garbage.
- Exception recorded: `b6b033c4` (龙虾合伙人, agent_id=self-UUID anomaly) — FAIL, **no mechanical twin**; appears in `agent_self_task_v1` PUBLISHED config (partner_check/partner_accept). Candidate successor 25a6789f (`agt_ceo-agent`) exists but the mapping is not mechanically provable from the twin rule → the two partner nodes are sub-rows of M2 marked **IDENTITY_REPAIR_REQUIRED** (identity-authority confirmation needed; no guessing).

## 9. Definition classification (70 non-archived; M2 basis)

| Class | Count |
|---|---|
| BUSINESS_CLEAN | 17 |
| BUSINESS_STALE_FIXED_CONFIG (PUBLISHED effective version carries legacy/anomalous fixed principals) | 25 |
| TEST_DEFINITION (inside test domains) | 26 |
| TEST_DEFINITION_IN_BUSINESS_DOMAIN (visit_canary_648a6b90 PUBLISHED in hr-onboarding; test-workflow-v1 DEPRECATED in adc-v2-dogfood) | 2 |

Historical immutable versions are NEVER rewritten; repair = canonical successor version → publish → stale version retires from future materialization (versioned/immutable by design). Per-def effective versions: `census-raw/effective-published-versions.tsv`.

Root-cause finding retained: **adc-v2-dogfood enabled DOMAIN_OWNER binding = legacy 3e2439d2** (fleet-cutover miss; the other 6 business domains + game-dev are canonical). Unique twin 4e5a4578 active → M6 repair unambiguous.

## 10. Provenance-rule compliance

- `6ea453e2` ("Credential separation canary test"): title-only signal, no stronger provenance → CLASSIFICATION=AMBIGUOUS, **MUTATION_WRITE_SET=EXCLUDED**. Not re-heuristicked in r2. Label note: the frozen TSV carries the builder's nearest exclusive class `HUMAN_REQUIRED` (the mechanical vocabulary has no AMBIGUOUS class); AMBIGUOUS is the governing overlay for this row, and write-set exclusion holds under either label (HUMAN_REQUIRED ⇒ M4=0 mutations regardless).
- `3025174e` (wiki real-compile-review): stronger evidence (real draft file path under key-level scan exclusion) → REAL_BUSINESS=PRESERVE. Not re-heuristicked in r2.

## 10a. FOLLOW_UP_DEBT (registered, not in write-set)

- `canary-wda-v1-1788582639` still has an enabled legacy DOMAIN_OWNER binding (`4602e257…`, bc970ced) — same defect class as M6-2..M6-4; untouched here because its 3 test instances are all TERMINAL history (no unlock needed). Sweep in a follow-up binding-repair pass.
- 61 HUMAN_REQUIRED rows carry historical legacy creators (`stale_creator_on_open_node` provenance signal, mostly TERMINAL history); non-load-bearing — the 23 NON_TERMINAL human visits all resolve canonical (§7).

## 10b. B-round authority amendments (Owner REVISE 2026-09-10; evidence: census-raw/workflow-admin-holders-census.tsv, svc-global-role-bindings.tsv, canonical-actor-workflow-grants.tsv)

```text
M6_STATE_OWNER = SVC_WORKFLOW; AUTH_SERVICE_ROLE = identity authority + JWT/token issuer only.
M1_CURRENT_EXECUTABLE_PATH = DOMAIN_OWNER_ONLY
M1_ACCEPTED_COORDINATOR_PATH = EXISTS_BUT_NOT_YET_LIVE (accepted coordinator authority contains
  cross-domain cancel/archive; svc coordinator surface today = create_domain + set_domain_owner)
LIVE_COORDINATOR_CONTROL_PLANE_READY = NO — enabled GLOBAL_WORKFLOW_COORDINATOR bindings exist
  only for principals NOT FOUND in auth (0a9eccd0/5ccddbaa/cada669b/ce295072 = dead) + legacy
  bc970ced; dc702687 (canonical agt_hr-agent) is NOT granted (WCC B1 Owner packet pending).
workflow.admin holders = legacy (bc970ced, 097f197d) and test identities (svc-dogfood-user,
  svc-okr-e2e) ONLY; canonical principals hold workflow.read + workflow.execute on svc-workflow.
⇒ M6_AUTHORITY_GAP = YES (canonical-actor binding-repair authority); legacy/test credentials
  must NOT be used for M6 (LEGACY_CREDENTIAL_USED_BY_CONVENIENCE = FORBIDDEN).
⇒ M1B (4 NON_TERMINAL_DANGLING fixtures): cancel INAPPLICABLE (cancel_transaction.rs:308 NULL
  current visit), archive INAPPLICABLE (terminal-only), no disposition surface exists;
  AUTHORITY_GAP = DANGLING_TEST_FIXTURE_DISPOSITION_ONLY; M1B_WRITE_SET = HOLD.
```

## 11. FROZEN INPUTS

`census-raw/` (TSV/JSON + builder, sha256 in `MANIFEST.sha256`): live-instances-census (338), instance/definition/principal-classification, ledger-summary, effective-published-versions (26), binding-rows-for-plan (9 domains), domains-inventory (36), successor-lines (4), auth-resolution (62), auth-all-machine-principals (208), legacy-twin-map, domain-bindings-business, assistance-case-map, live-test-marked-instances, fixed/stale principal configs.
