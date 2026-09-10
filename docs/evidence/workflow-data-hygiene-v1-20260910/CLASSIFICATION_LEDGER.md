# WORKFLOW_DATA_HYGIENE_V1 — PRODUCTION_CENSUS_AND_CLASSIFICATION_LEDGER

- **Status**: FROZEN (census phase deliverable; read-only; zero production mutation)
- **Census taken**: 2026-09-10 22:1x–23:0x (+08), production svc-workflow DB `svc_workflow_dogfood_clean` (read-only queries as `svc_wf`), auth authority DB `agent_dev_center` (read-only as `auth_ro`)
- **Live snapshot basis**: every instance with `cancelled=false AND archived_at IS NULL` at census time (338 rows)
- **Determinism**: classification produced by `build-classification-ledger.mjs` from the frozen TSVs; re-run byte-identical (verified). Input hashes: `census-raw/MANIFEST.sha256`.
- **Sanitization**: IDs, counts, classes, agent_ids only. No credentials, no payloads, no personal data.

## Resolution semantics (`agent_resolve_principal`)

Mechanical check substituted per EXISTING_COORDINATES (Principal→canonical Agent authority = auth-service):

```
PASS    := machine_principals.status='active' AND agent_id ~ ^agt_[a-z0-9-]+$
FAIL    := otherwise (NOT_FOUND | legacy naked-name agent_id | disabled)
SUCCESSOR_LINE := svc workflow_identity_successor_lines row (identity_repair_v1 registrations, 2026-09-07/08)
UNIQUE_TWIN    := exactly one active auth principal with agent_id = 'agt_' + legacy_name
```

## Boundary metrics at census (pre-cleanup)

| Metric | Value | Composition |
|---|---|---|
| ACTIVE_AGENT_ASSIGNEE_UNRESOLVABLE | **6** | all `STALE_IDENTITY_UNIQUE_SUCCESSOR` (4 successor-line-registered principals) |
| ACTIVE_TEST_OR_FIXTURE_BUSINESS_INSTANCES | **38** | 30 TERMINAL + 8 NON_TERMINAL |
| AGENT_TASK_WITHOUT_CANONICAL_ACTIVE_AGENT (future config) | **25 defs** + 1 domain-owner binding (adc-v2-dogfood) | PUBLISHED configs with FAIL fixed principals |
| HUMAN_TASK_MISCLASSIFIED_AS_AGENT | **0** | personal_quick_item_v1 = accepted human-work carrier (no agent execution node; work outside workflow); agent_self_task content spot-checked = agent work |
| REAL_BUSINESS_INSTANCE_DELETED_BY_CLEANUP | 0 (invariant) | enforced by cleanup policy |
| HISTORICAL_AUDIT_CHAIN_BROKEN | 0 (invariant) | enforced by cleanup policy |

## Instance classification (338 live)

| Class | Count | Notes |
|---|---|---|
| REAL_BUSINESS | 217 | incl. 273-4 = mostly TERMINAL completed history (277 total TERMINAL across classes) |
| HUMAN_REQUIRED | 77 | personal_quick_item_v1 instances; **61 created by legacy `efficiency-manager` (95eab282)** — historical-creator provenance only; **all 19 NON_TERMINAL (DRAFT) visits already carry canonical assignee b21ddb23 (`agt_efficiency-agent`)** → identity-healthy, waiting on human, not stuck |
| TEST_OR_FIXTURE | 38 | every row carries mechanical provenance signal (test domain / test definition / key-level metadata marker / test-creator principal / synthetic instance id). 30 TERMINAL, 8 NON_TERMINAL (5 assistance DRAFT + 3 canary-wda DRAFT) |
| STALE_IDENTITY_UNIQUE_SUCCESSOR | 6 | see below |
| STALE_IDENTITY_UNRESOLVED | 0 | in non-test active set |

### The 6 stale-identity business instances (WAE-lane / blocked visits)

| instance | domain | definition | current node | assignee (auth agent_id) | successor line |
|---|---|---|---|---|---|
| cebf4816 | build-in-public-dogfood | bip_gpt6_podcast_v1_202609 | step_1/TASK | 61819256 (writing-style-analyst-agent) | →9e3adced REGISTERED; already QUARANTINED+DO_NOT_RECOVER by WDA recovery goal |
| 5709a28e | build-in-public-dogfood | bip_article_pipeline_v1 | reviewing/NORMAL | 61819256 (writing-style-analyst-agent) | →9e3adced REGISTERED; WAE Subject B |
| 8816acaf | journal-submission | journal_final_delivery | language_polish/NORMAL (FIXED_PRINCIPAL) | 61819256 (writing-style-analyst-agent) | →9e3adced REGISTERED |
| e683189a | hr-onboarding | retrospective-action | final_verify/NORMAL (WORKFLOW_CREATOR) | 3e2439d2 (cto-agent) | →4e5a4578 REGISTERED; frozen as prior-goal evidence |
| 64d4b779, 99d369f6 | adc-v2-dogfood | project-insight-review-v1 | publish/NORMAL (DOMAIN_OWNER) | 3e2439d2 (cto-agent) | →4e5a4578 REGISTERED; **root cause = adc-v2-dogfood enabled DOMAIN_OWNER binding still legacy (see below)** |

These remain **explicitly blocked, fail-closed on dispatch** (resolution FAIL ⇒ not silently dispatchable). Recovery path = accepted WAE V2 controlled recovery (owned by WORKFLOW_AGENT_EXECUTION goal for Subjects A/B); adc×2 additionally need the owner-binding fix for future visits.

### Root-cause finding: adc-v2-dogfood domain owner binding

The 2026-08-25 fleet cutover migrated enabled DOMAIN_OWNER bindings of the other 6 business domains to canonical `agt_` principals, but **adc-v2-dogfood's enabled DOMAIN_OWNER is still 3e2439d2 (cto-agent, legacy)**. Unique canonical twin 4e5a4578 (`agt_cto-agent`, active). This is the mechanical cause of the 2 stale adc visits.

### Identity registry state

- Successor lines registered: 4 (61819256→9e3adced, 3e2439d2→4e5a4578, bc970ced→dc702687, 4684680a→9df952bc)
- Auth-wide legacy naked-name principals: 117; **87 have UNIQUE active `agt_` twin**, 30 NO_TWIN (test/synthetic/service identities), 0 AMBIGUOUS
- Principals vanished from auth (NOT_FOUND) appearing in live data: confined to assistance-* instances (12f26d3b, 73ebfa8f, e43f9801, 771546ea — all TEST class), synthetic fixture ids (10000000-*, bbbbbbbb-*), and one smoke-test definition fixed principal (e5efd1a7). **None in the business active set.**
- Goal-named stale candidates coverage: 61819256 ✓registered-successor; 3e2439d2 ✓registered; 097f197d/fe2bfbbb/d2bec623/6ccdae57/d1ffc337 = legacy active with unique twins (config-level surfaces only, no live business visit); e43f9801 = NOT_FOUND, appears only in TEST-class assistance instances.

## Definition classification (70 non-archived)

| Class | Count | Notes |
|---|---|---|
| BUSINESS_CLEAN | 17 | no stale fixed principals in any version |
| BUSINESS_STALE_FIXED_CONFIG | 25 | PUBLISHED configs referencing legacy principals (twin exists for all observed); spans adc-* ×5, project-insight-review, bip family ×6, journal family ×4, biz ×2, knowledge ×3, hr ×2, agent_self_task, game_dev_flow (duplicate of adc-game-dev, 0 instances) |
| TEST_DEFINITION | 26 | inside test domains (canary_wda_*, assistance-def-*, auth e2e defs, hr-e2e-loop, smoke-test-def…) |
| TEST_DEFINITION_IN_BUSINESS_DOMAIN | 2 | `visit_canary_648a6b90` (hr-onboarding, PUBLISHED), `test-workflow-v1` (adc-v2-dogfood, DEPRECATED) |

Domains: 7 business (knowledge-curation 110 / workflow-todo-dogfood 97 / build-in-public-dogfood 39 / journal-submission 30 / adc-v2-dogfood 24 / hr-onboarding 14 / commercial-exploration-dogfood 4 live), 13 enabled test/e2e domains, 11 disabled test domains, 2 near-empty ambiguous (`game-dev` 1 dup def 0 instances, `okr-dogfood` 0/0).

## Provenance-rule compliance

- Test classification never from title strings: the only title-signal row (`6ea453e2` "Credential separation canary test", no stronger provenance) is **flagged AMBIGUOUS for the plan/audit**, not classified TEST mechanically.
- Regex false-positive exclusion demonstrated: `3025174e` (wiki real-compile-review, business) matched only inside a draft-file path substring → correctly REAL_BUSINESS under key-level marker rules.

## Authority map (first cut, for AUTHORITY_GAP_RESOLUTION)

| Mutation class | Existing authority (first cut) | Gap? |
|---|---|---|
| M1 cancel/archive 38 test instances out of active projection | instance cancel/archive surfaces exercised by e2e (CANCEL_NEG/ARCHIVE_NEG paths); DATABASE_CLEANUP_POLICY bounded transaction as fallback with preimage/postimage | TBD at plan freeze (cross-domain coordinator role scope to verify) |
| M2 adc-v2-dogfood DOMAIN_OWNER rebind →4e5a4578 | auth-service domain-role administration (accepted provisioning channel) | none expected |
| M3 repair 25 defs' PUBLISHED stale FIXED_PRINCIPAL | WDA definition authoring (per-domain owner, new version publish) | none mechanically; execution volume |
| M4 register successor lines for twins used by M3 defs | identity_repair_v1 accepted path (4 existing registrations) | none expected |
| M5 recover/hold 6 stale business visits | WAE V2 controlled recovery (accepted); Subjects A/B owned by WORKFLOW_AGENT_EXECUTION goal (slot-gated) | none; boundary permits explicit IDENTITY_REPAIR_REQUIRED/WAE-lane hold |
| M6 archive 2 test defs in business domains; disable/archive test domains | WDA archive path (domain owner); domain governance | TBD at plan freeze |

## FROZEN INPUTS

`census-raw/` (16 TSV/JSON + script, sha256 in `census-raw/MANIFEST.sha256`):
live-instances-census (338), active-definition-assignee-config (772), active-definitions-inventory (70), fixed-principal-configs-all, stale-fixed-principal-configs, domains-inventory (36), successor-lines (4), auth-resolution-all-principals (62), auth-all-machine-principals (208), legacy-twin-map, domain-bindings-business, assistance-case-map (12), live-test-marked-instances (18), instance/definition/principal-classification (ledger outputs), ledger-summary.json.
