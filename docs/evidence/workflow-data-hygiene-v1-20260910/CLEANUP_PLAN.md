# WORKFLOW_DATA_HYGIENE_V1 — CLEANUP_PLAN (EXACT SET, FROZEN)

- **Status**: FROZEN for audit · r1 (2026-09-10). Production execution is **NOT authorized by this document** — sequencing gate §5 applies.
- **Inputs**: `CLASSIFICATION_LEDGER.md` r2 (frozen), `census-raw/` TSVs + sha256 manifest.
- **Mutation discipline**: `PRODUCTION_MUTATION_CONCURRENCY=1`; `READ_BEFORE_WRITE=REQUIRED` per row (re-read the row immediately before mutating; membership drift ⇒ STOP_ON_NEW_EVIDENCE, recompute affected rows only); `WRITE_SET_MUST_EQUAL_AUDITED_SET=YES`; preimage/postimage of every row frozen to `census-raw/execution/{pre,post}/` at execution time.
- **No DELETE anywhere in this plan.** Every mutation is a governance-state transition that preserves the row and its history.

## Counts

```text
M1_TEST_CLEANUP_WRITE_COUNT            = 12   (instance cancels; 0 deletes)
M2_EFFECTIVE_DEFINITION_REPAIR_COUNT   = 25   (canonical successor versions; 1 def partially IDENTITY_REPAIR_REQUIRED)
M2A_TEST_DEFINITION_ARCHIVE_COUNT      = 2    (test defs inside business domains)
M3_NODEVISIT_DISPOSITION_COUNT         = 6    (ledger dispositions; 0 DB mutations)
M4_HUMAN_MUTATION_COUNT                = 0
M5_TEST_IDENTITY_REPAIR_COUNT          = 0
M6_DOMAIN_OWNER_BINDING_MUTATION_COUNT = 9    (4 rebinds + 3 dead-owner repairs + 2 grants)

TOTAL_PRODUCTION_WRITE_SET             = 48
```

## §M6 — Domain-owner binding repairs (9 rows, run FIRST — M1/M2 depend on them)

Executor: auth-service domain-role administration channel with `workflow.admin` scope (agt_hr-agent credential `mc_4Ud_…` is provisioned with workflow.admin). **AUTHORITY_GAP = NO**: this is the same governance that executed the 2026-08-25 fleet cutover (6 business domains + game-dev already canonical) and the d5b3aeb2 bip-domain owner takeover. Not identity authority, not DB superuser — binding administration only.

| # | domain (domain_id) | subject (binding_id) | current_state | exact_mutation | new principal (canonical) |
|---|---|---|---|---|---|
| M6-1 | adc-v2-dogfood (`22222222-…-0100`) | `ab05acde-524f-40b4-a904-eb8882db791b` | enabled DOMAIN_OWNER = 3e2439d2 (cto-agent, legacy; twin proven; successor line registered) | disable legacy binding, grant DOMAIN_OWNER to canonical twin | 4e5a4578-0645-4133-bd35-b80e453dfee9 (`agt_cto-agent`, active) |
| M6-2 | canary-wda-v1-1788583811 (`ac4d950e-…`) | `1f4a85a6-8010-445c-a30c-5ff01c4579be` | enabled DOMAIN_OWNER = bc970ced (hr-agent legacy; successor line registered) | same as M6-1 | dc702687-6515-4a2a-91ae-e572a9bbd766 (`agt_hr-agent`) |
| M6-3 | canary-wda-v1-1788583998 (`5464e4e1-…`) | `0110a71a-cf1d-45e5-aa03-539098eff4bf` | same as M6-2 | same | dc702687 (`agt_hr-agent`) |
| M6-4 | canary-wda-v1-1788584903 (`6af3320d-…`) | `942b2680-82d1-4033-ad07-39f694bbb002` | same as M6-2 | same | dc702687 (`agt_hr-agent`) |
| M6-5 | assistance-5148b565-… (`a002d794-…`) | `91fa0c02-d2da-4735-bb1e-c76a109bc20c` | enabled DOMAIN_OWNER = 7e016259 (**NOT_FOUND in auth** — dead owner) | disable dead binding, grant canonical operational owner | dc702687 (`agt_hr-agent`) |
| M6-6 | assistance-74a028b0-… (`3270e4fb-…`) | `bf509296-a419-4565-b551-2f623c7be189` | enabled DOMAIN_OWNER = f7226497 (**NOT_FOUND**) | same | dc702687 (`agt_hr-agent`) |
| M6-7 | assistance-1853d6d7-… (`350fd0d0-…`) | `7b59a044-3528-49a5-b584-2fb3f9af2cb7` | enabled DOMAIN_OWNER = 9d63fca9 (**NOT_FOUND**) | same | dc702687 (`agt_hr-agent`) |
| M6-8 | canary-e2e-1784457448 (`ed99dcba-…`) | — (no binding row) | **no DOMAIN_OWNER at all** | grant canonical operational owner | dc702687 (`agt_hr-agent`) |
| M6-9 | auth-v1-e2e-readonly (`e2000000-…`) | — (no binding row) | **no DOMAIN_OWNER at all** | grant canonical operational owner | dc702687 (`agt_hr-agent`) |

Every row: preimage = frozen `census-raw/binding-rows-for-plan.tsv`; postimage = exactly one enabled DOMAIN_OWNER per domain, canonical principal, old binding `enabled=false` preserved as history. Rollback = re-apply prior binding state via the same workflow.admin authority (binding rows are never deleted). `canary-wda-v1-1788582639` deliberately untouched (its 3 test instances are TERMINAL history → preserve; no unlock needed).

## §M1 — Test-instance cancels (12 rows)

Exact mutation: `POST /internal/v1/workflow-instances/{id}/cancel` with reason string `WORKFLOW_DATA_HYGIENE_V1 M1 TEST_OR_FIXTURE residue removal (census 2026-09-10)`, executed by dc702687 (`agt_hr-agent`, DOMAIN_OWNER of each domain after §M6) **using dc702687's own active `workflow.execute` credential** — distinct from the `workflow.admin` credential (`mc_4Ud_…`, which authenticates as legacy bc970ced) that is used ONLY for §M6 binding administration. Authority: svc-workflow cancel = DOMAIN_OWNER-of-domain + `workflow.execute` scope (`src/application/workflow_instance/cancel.rs` — "Only DOMAIN_OWNER may cancel instances in their domain"). Execution precondition: `AUTH_V1_CANARY_WRITE_ENABLED=true` (canary_write_guard is a global write gate — verify once before the batch).

All 12 rows: classification = TEST_OR_FIXTURE with mechanical provenance signals (ledger); current_state preimage = census row (cancelled=false, archived_at=null, current visit per TSV); expected postimage = cancelled=true, cancel_reason as above, cancelled_by=dc702687, exactly one CANCEL event appended, all payload/context/visit history preserved. Rollback = none applicable — cancel preserves the row and history, so a disputed cancel is re-examined from evidence, not reversed by mutation; the REAL_BUSINESS risk gate is the audit's `REAL_BUSINESS_FALSE_POSITIVE_CHECK` plus per-row read-before-write re-verification of the classification signals.

| # | instance | domain | lifecycle |
|---|---|---|---|
| M1-1 | 8507658d-b5ab-44bc-83f0-afc97b5fd56c | assistance-1853d6d7-… | NON_TERMINAL_CURRENT (draft) |
| M1-2 | 6671fdb5-eb42-4044-b2e5-4a284c657f91 | assistance-1853d6d7-… | NON_TERMINAL_CURRENT (draft) |
| M1-3 | f5de0535-e448-4cdf-b5ab-9d94843e97cb | assistance-5148b565-… | NON_TERMINAL_CURRENT (draft) |
| M1-4 | 0ce9924d-6f9f-4b30-a838-04644a06d396 | assistance-5148b565-… | NON_TERMINAL_CURRENT (draft) |
| M1-5 | c692ec90-6392-4ec0-bea1-749e83d340cf | assistance-74a028b0-… | NON_TERMINAL_CURRENT (draft) |
| M1-6 | 5fe7570a-dc15-43ae-b5c5-950692951aa3 | canary-wda-v1-1788583811 | NON_TERMINAL_CURRENT (draft) |
| M1-7 | 5538dca9-9c19-46f9-83ef-41824c7468d8 | canary-wda-v1-1788583998 | NON_TERMINAL_CURRENT (draft) |
| M1-8 | 9fd262ec-8906-4cbc-8a3f-1ef2321d9715 | canary-wda-v1-1788584903 | NON_TERMINAL_CURRENT (draft) |
| M1-9 | 91800cbc-6e6c-4b9d-a948-39d8fd271be4 | canary-e2e-1784457448 | NON_TERMINAL_DANGLING |
| M1-10 | 8916aa79-22af-4be0-ab2c-fbb66a7ff3f2 | canary-e2e-1784457448 | NON_TERMINAL_DANGLING |
| M1-11 | e7000000-0000-4000-8000-00000000e001 | auth-v1-e2e-readonly | NON_TERMINAL_DANGLING |
| M1-12 | e7000000-0000-4000-8000-00000000e002 | auth-v1-e2e-readonly | NON_TERMINAL_DANGLING |

The 26 TERMINAL test instances: **NO MUTATION — history preserved** (Owner ruling M1). `6ea453e2` (AMBIGUOUS): **EXCLUDED from write-set**.

## §M2 — Effective-definition repairs (25 rows) + test-def archives (2 rows)

Exact mutation per def: via WDA authoring authority (domain owner creates successor DRAFT version with canonical fixed principals substituted per the mechanical twin map, then publishes; publish retires the stale PUBLISHED version from future materialization — historical versions remain immutable). Executor per def = that domain's canonical enabled DOMAIN_OWNER (adc defs authorized by 4e5a4578 **after M6-1**). Authority: definition governance = DOMAIN_OWNER, idempotent+audited (`src/application/definition_governance/`); **AUTHORITY_GAP = NO**. Rollback = prior versions are immutable and intact; a bad successor version is itself retired via the same authoring authority. why_real_business_is_not_deleted: versioned repair is additive; no row of any version is modified or deleted.

Per-def effective versions and stale-node counts: `census-raw/effective-published-versions.tsv` + `census-raw/definition-classification.tsv` (25 defs: adc-backend/frontend/game/miniapp/mobile-dev-v1, project-insight-review-v1, bip_article_pipeline_v1/v2, bip_gpt6_podcast_v1_202609, blog_write_review_v1, content_pipeline_v1, podcast_script_v1, biz-explore-v1, biz-publish-v1, game_dev_flow_v1, agent-onboarding-v1, agent-role-upgrade-v1, journal-submission, journal_final_delivery, journal_section_production, research_ideation, audio-to-knowledge, video-to-knowledge, wiki-compile-review-publish, agent_self_task_v1).

Special sub-row (recorded honestly): `agent_self_task_v1` partner_check/partner_accept nodes point at `b6b033c4` (anomalous agent_id=self-UUID; **no mechanical twin**). Those two nodes = **IDENTITY_REPAIR_REQUIRED** (candidate 25a6789f/`agt_ceo-agent` requires identity-authority confirmation — NOT guessed). The def's mechanical nodes (95eab282→b21ddb23 twin) repair normally.

| # | definition | domain | exact_mutation |
|---|---|---|---|
| M2A-1 | visit_canary_648a6b90-ff57-4945-8c2d-12a1bcbd6ed4 (PUBLISHED) | hr-onboarding | `POST /internal/v1/domains/{domainId}/definitions/{defId}/archive` by dc702687 (owner). Archive adds governance metadata; no state change; no history loss. Rollback = same-channel governance action. |
| M2A-2 | test-workflow-v1 (DEPRECATED) | adc-v2-dogfood | archive by 4e5a4578 after M6-1. Same semantics. |

## §M3 — Stale NodeVisit dispositions (6 rows, 0 DB mutations)

Dispositions frozen in `CLASSIFICATION_LEDGER.md` §6: cebf4816 + e683189a = QUARANTINE_DO_NOT_RECOVER; 5709a28e + 8816acaf + 64d4b779 + 99d369f6 = RECOVER_VIA_WAE_V2 (execution owned by WORKFLOW_AGENT_EXECUTION goal, slot-gated). `HISTORICAL_ASSIGNEE_SQL_REWRITE = FORBIDDEN` — no `node_visit.assignee_principal_id` is touched by this Goal ever.

## §M4 — HUMAN_REQUIRED (0 mutations)

Confirmed in ledger §7. `M4_HUMAN_MUTATION_COUNT = 0`.

## §M5 — Disappeared principals in test data (0 identity repairs)

`BUSINESS_ACTIVE_CONTAMINATION = 0` proven (ledger §8). `M5_TEST_IDENTITY_REPAIR_COUNT = 0`; they exit with §M1. No formal identity manufactured for test garbage.

## §5 Sequencing gate (G2 before G1 execution)

Even after INDEPENDENT_AUDIT returns SHIP_BLOCKERS=0, production execution of this plan is **dependency-gated**:

```text
G2: WORKFLOW_ASSIGNEE_ADMISSION_GUARD_V1 (separate Goal) reaches a production gate that
    blocks NEW stale/unroutable assignments from being created
→ fresh G1 preimage census (re-run census queries; verify live set still matches frozen TSVs
   modulo expected drift; WRITE_SET_MUST_EQUAL_AUDITED_SET re-verified)
→ §M6 → §M1 → §M2 one-time production cleanup (PRODUCTION_MUTATION_CONCURRENCY=1)
→ final read-back → TERMINAL_ACCEPTANCE
```

Rationale (Owner ruling): avoid cleaning legacy residue while the authoring path still mints new stale assignments. G2 not being ready does NOT block this Goal's source/authority/audit work — it gates only the G1 production mutation.

## Audit answer contract

```text
REAL_BUSINESS_DELETE_RISK            = NO  (no DELETE exists in the plan; cancels touch only
                                            TEST-class rows with mechanical provenance)
IDENTITY_AUTHORITY_BYPASS            = NO  (all principal mappings = auth twin map / registered
                                            successor lines; b6b033c4 left to identity authority)
HISTORICAL_ASSIGNEE_REWRITE          = NO  (no node_visit mutation anywhere)
TEST_CLASSIFICATION_SUPPORTED        = YES (every M1 row carries mechanical signals, zero
                                            title-string classifications)
HUMAN_REQUIRED_CLASSIFICATION_SUPPORTED = YES (ledger §7)
SHIP_BLOCKERS                        = to be set by INDEPENDENT_AUDIT
```
