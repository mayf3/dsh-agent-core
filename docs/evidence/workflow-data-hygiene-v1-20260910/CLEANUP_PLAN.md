# WORKFLOW_DATA_HYGIENE_V1 — CLEANUP_PLAN (EXACT SET, FROZEN)

- **Status**: v2 · FROZEN for fresh audit (2026-09-10). Supersedes v1 per Owner REVISE ruling (B1–B6 blocker union). The prior independent audit is **SUPERSEDED_BY_NEW_MECHANICAL_EVIDENCE**.
- **Inputs**: `CLASSIFICATION_LEDGER.md` r2 (census facts + metric semantics ACCEPTED, unchanged), `census-raw/` TSVs + sha256 manifest, plus the B-round mechanical evidence below.
- **Discipline**: `PRODUCTION_MUTATION_CONCURRENCY=1`; `READ_BEFORE_WRITE=REQUIRED` per command; `WRITE_SET_MUST_EQUAL_AUDITED_SET=YES` (logical subjects) with command-level admission gates; preimage/postimage captured to `census-raw/execution/` at execution time; drift ⇒ STOP_ON_NEW_EVIDENCE, recompute affected rows only.
- **No DELETE anywhere. No `node_visit.assignee_principal_id` rewrite anywhere.**

## 0. Logical subjects vs commands (B6)

```text
TOTAL_LOGICAL_CLEANUP_SUBJECTS      = 48
  = M1A 8 + M1B 4 (HOLD) + M2 25 + M2A 2 + M3 6 (0 mutation) + M6 9
EXECUTABLE_LOGICAL_SUBJECTS_TODAY   = 21   (M2: 19 actor-ready defs + M2A-1 + … see §4/§5 admission table; M1A/M6/M2A-2 admission-gated)
HELD_LOGICAL_SUBJECTS               = 27   (M1B 4 = M1B_WRITE_SET=HOLD; M6 9 = M6_AUTHORITY_GAP=YES; M1A 8 = gated on M6; M2 6 adc defs gated on M6-1)

TOTAL_PRODUCTION_MUTATION_COMMANDS  = 94 or 101  (mechanically derived, NOT 48)
  = M1A 8 cancels
  + M2 25 defs × 3 commands (create_draft / replace_graph / publish) = 75
  + M2A 2 archives
  + M6 9 subjects × (1 command via coordinator set_domain_owner  |  2 commands via admin
    provisioning disable+grant, replace subjects) = 9 | 16
M1B contributes 0 commands while M1B_WRITE_SET = HOLD.
```

## 1. §M6 — Domain-owner binding repairs, corrected authority model (B3/B4/B5)

```text
M6_STATE_OWNER            = SVC_WORKFLOW   (domain_role_bindings is svc-workflow state)
AUTH_SERVICE_ROLE         = identity authority + JWT/token issuer ONLY
workflow.admin            = a scope gating svc's /internal/v1/admin/* surface — NOT ownership
                            of Workflow domain-role state
M6_MUTATION_SURFACE (both exist in deployed svc source):
  S1 coordinator: PUT /internal/v1/domains/{domainId}/owner  → atomic replace_owner;
     requires workflow.execute + direct token + enabled GLOBAL_WORKFLOW_COORDINATOR
     (server-side global_role_bindings check; coordinator_domains.rs)
  S2 admin provisioning: PUT /internal/v1/admin/domains/{domainId}/owner (+ role-bindings
     POST/DELETE); requires workflow.admin scope (provisioning/mod.rs)
```

### 1a. Actor/authority census (mechanical, 2026-09-10)

| fact | value |
|---|---|
| principals holding `workflow.admin` grants | bc970ced `hr-agent` (LEGACY naked-name, FAIL), 097f197d `thesis-advisor-agent` (LEGACY, FAIL), 858b5fe2 `svc-dogfood-user` (test identity), 9c740a57 `svc-okr-e2e` (test identity) |
| canonical principals' svc-workflow grants | dc702687/`agt_hr-agent`, 4e5a4578/`agt_cto-agent`, b21ddb23/`agt_efficiency-agent`, 208f91e9/`agt_game-producer-agent`, 8402d851, 72ff7ee1, d5b3aeb2, 9ddbb1c7: `workflow.read + workflow.execute` only — **no canonical principal holds workflow.admin** |
| enabled `GLOBAL_WORKFLOW_COORDINATOR` bindings (svc) | 0a9eccd0, 5ccddbaa, cada669b, ce295072 = **principal NOT FOUND in auth** (dead bindings); bc970ced = legacy; **dc702687 NOT granted** |
| `LIVE_COORDINATOR_CONTROL_PLANE_READY` | **NO** (surface deployed in svc; no canonical actor holds the role; WCC goal B1 Owner grant packet pending) |

### 1b. Ruling applied

```text
ACCEPTED_AUTHORITY_REF for M6 via S2   = NONE FOUND that names a canonical actor for these
                                         repairs → S2 as-is = legacy/test-credential path
ACTOR_CANONICAL_STATUS (all S2 actors) = FAIL
⇒ LEGACY_CREDENTIAL_USED_BY_CONVENIENCE = FORBIDDEN (B4: "credential authenticates as
   legacy bc970ced must NOT be treated as harmless")
⇒ M6_AUTHORITY_GAP = YES, exact gap = "canonical-actor authority to repair svc-workflow
   domain-owner bindings for these 9 exact subjects"
HR_RUNTIME_ADMIN_FALLBACK            = NO
PREFERRED GAP RESOLUTION             = consume the already-accepted Coordinator control
                                       plane once: WCC B1 Owner grant (dc702687) ⇒
                                       LIVE_COORDINATOR_CONTROL_PLANE_READY=YES ⇒ S1
                                       (1 atomic command per subject). Fallback = narrow
                                       Owner-authorized one-time binding-repair authority
                                       naming the canonical actor + surface. /admin/* is
                                       NOT broadened by this Goal.
```

### 1c. M6 subjects (two sub-classes, B5)

**M6-BIZ (business-domain repair, 1 subject — semantics narrow: legacy principal → exact canonical successor, no HR takeover):**

| # | domain | binding | current | → new |
|---|---|---|---|---|
| M6-1 | adc-v2-dogfood `22222222-…-0100` | `ab05acde-…` (enabled) | 3e2439d2 (cto-agent legacy; twin proven; successor line registered) | 4e5a4578 `agt_cto-agent` |

**M6-TEST (disposable test domains, 8 subjects — HR operational owner acceptable ONLY after cleanup authority resolution per B4):**

| # | domain | binding | current | → new |
|---|---|---|---|---|
| M6-2..4 | canary-wda-v1-1788583811 / -3998 / -4903 | `1f4a85a6…` / `0110a71a…` / `942b2680…` (enabled) | bc970ced (legacy; successor line registered) | dc702687 `agt_hr-agent` |
| M6-5..7 | assistance-5148b565 / -74a028b0 / -1853d6d7 | `91fa0c02…` / `bf509296…` / `7b59a044…` (enabled) | owner NOT_FOUND in auth (dead) | dc702687 `agt_hr-agent` |
| M6-8..9 | canary-e2e-1784457448 / auth-v1-e2e-readonly | — (no binding) | ownerless | dc702687 `agt_hr-agent` |

Preimages: `census-raw/binding-rows-for-plan.tsv` (+ live re-verified by audit r1). `canary-wda-v1-1788582639` untouched (FOLLOW_UP_DEBT, ledger §10a).

## 2. §M1 — split per B1

### M1A_NORMAL_TEST_CANCEL = 8 (ordinary supported cancel)

Exact mutation: `POST /internal/v1/workflow-instances/{id}/cancel`, reason `WORKFLOW_DATA_HYGIENE_V1 M1A TEST_OR_FIXTURE residue removal (census 2026-09-10)`, actor dc702687 via its own canonical `workflow.execute` credential (mc_IuBMfCYe9…; the legacy-authenticating workflow.admin credential is NOT used — B2/B4 note). Authority: DOMAIN_OWNER-of-domain post-M6 + workflow.execute (cancel.rs). Execution precondition: `AUTH_V1_CANARY_WRITE_ENABLED=true`.

| # | instance | domain (needs) | lifecycle |
|---|---|---|---|
| M1A-1 | 8507658d-b5ab-44bc-83f0-afc97b5fd56c | assistance-1853d6d7 (M6-7) | NON_TERMINAL_CURRENT (draft) |
| M1A-2 | 6671fdb5-eb42-4044-b2e5-4a284c657f91 | assistance-1853d6d7 (M6-7) | NON_TERMINAL_CURRENT (draft) |
| M1A-3 | f5de0535-e448-4cdf-b5ab-9d94843e97cb | assistance-5148b565 (M6-5) | NON_TERMINAL_CURRENT (draft) |
| M1A-4 | 0ce9924d-6f9f-4b30-a838-04644a06d396 | assistance-5148b565 (M6-5) | NON_TERMINAL_CURRENT (draft) |
| M1A-5 | c692ec90-6392-4ec0-bea1-749e83d340cf | assistance-74a028b0 (M6-6) | NON_TERMINAL_CURRENT (draft) |
| M1A-6 | 5fe7570a-dc15-43ae-b5c5-950692951aa3 | canary-wda-v1-1788583811 (M6-2) | NON_TERMINAL_CURRENT (draft) |
| M1A-7 | 5538dca9-9c19-46f9-83ef-41824c7468d8 | canary-wda-v1-1788583998 (M6-3) | NON_TERMINAL_CURRENT (draft) |
| M1A-8 | 9fd262ec-8906-4cbc-8a3f-1ef2321d9715 | canary-wda-v1-1788584903 (M6-4) | NON_TERMINAL_CURRENT (draft) |

Admission per row: owning domain's M6 row applied AND read-back shows canonical enabled owner; preimage = census row (cancelled=false, archived_at=null); postimage = cancelled=true + exactly one CANCEL event + history preserved. No rollback-by-mutation (cancel preserves the row); risk gate = audit REAL_BUSINESS_FALSE_POSITIVE_CHECK + per-row signal re-verification.

### M1B_DANGLING_TEST_FIXTURE = 4 — `M1B_WRITE_SET = HOLD`

Subjects: `91800cbc-6e6c-4b9d-a948-39d8fd271be4`, `8916aa79-22af-4be0-ab2c-fbb66a7ff3f2` (canary-e2e-1784457448), `e7000000-…-e001`, `e7000000-…-e002` (auth-v1-e2e-readonly). Fixture provenance = proven (synthetic ids / canary principals / zero event chain / 1 dangling visit / current_node_visit_id=NULL).

**Narrow existing-surface/authority census (per B1):**

| surface | verdict |
|---|---|
| cancel | **INAPPLICABLE** — `cancel_transaction.rs:308` `current_node_visit_id.ok_or_else(...)` fails on NULL current visit (InternalConsistency class) |
| archive | **INAPPLICABLE** — archive.rs requires terminal state (cancelled OR node_type=TERMINAL); these are neither |
| admin_repair | **INAPPLICABLE** — context repair only |
| admin_recovery | **INAPPLICABLE** — rebuild_projection / admin_emergency_override operate on visits/projections, not row disposition |
| DELETE endpoint | **DOES NOT EXIST** (by design; none invented) |
| accepted fixture-cleanup operation | the 2026-08-29 Owner-executed SERIALIZABLE fixture-cleanup (SVC_WORKFLOW_DOGFOOD_TEST_FIXTURE_RESIDUE_V1 + frozen 224-row allowlist) is the existing operation PATTERN; its allowlist does not cover these 4 rows → pattern ≠ authorization for new rows |

```text
CANCEL = INAPPLICABLE   ARCHIVE = INAPPLICABLE   DIRECT_DB_EDIT = FORBIDDEN (unauthorized)
FAKE_CURRENT_VISIT = FORBIDDEN                   FAKE_BUSINESS_TRANSITION = FORBIDDEN
⇒ AUTHORITY_GAP = DANGLING_TEST_FIXTURE_DISPOSITION_ONLY (exact 4 IDs + preimages)
⇒ M1B_WRITE_SET = HOLD until a separately authorized, evidence-bounded one-time
   maintenance transaction (or an accepted disposition surface) exists.
```

## 3. §M3 — NodeVisit dispositions (6 subjects, 0 DB mutations) — UNCHANGED

cebf4816 = QUARANTINED/DO_NOT_RECOVER (locked); e683189a = QUARANTINE_DO_NOT_RECOVER (frozen evidence); 5709a28e = RECOVER_VIA_WAE_V2 (WAE Subject B); 8816acaf, 64d4b779, 99d369f6 = RECOVER_VIA_WAE_V2. `085b41f2` (bip_gpt6_podcast v2 successor instance) = PRESERVE — healthy, never in any write-set.

## 4. §M2 — Effective-definition repairs (25 subjects × 3 commands)

Per def: (a) create successor DRAFT version, (b) replace graph with canonical fixed principals (substitution set = mechanical twin map; `agent_self_task_v1` partner nodes b6b033c4 → **EXCLUDED as IDENTITY_REPAIR_REQUIRED**), (c) publish (retires stale PUBLISHED version from future materialization; historical versions immutable). Historical versions never rewritten. Actor per domain = canonical enabled DOMAIN_OWNER with own `workflow.execute` credential; authority = WDA definition governance (`definition_governance/`, DOMAIN_OWNER, idempotent+audited).

Admission states (actor scopes freshly established 2026-09-10 from auth grants):

| domain (defs) | owner | execute grant | admission |
|---|---|---|---|
| build-in-public-dogfood (6: bip_article_pipeline_v1/v2, bip_gpt6_podcast_v1_202609, blog_write_review_v1, content_pipeline_v1, podcast_script_v1) | d5b3aeb2 | ✓ | READY |
| journal-submission (4: journal-submission, journal_final_delivery, journal_section_production, research_ideation) | 72ff7ee1 | ✓ | READY |
| knowledge-curation (3: audio-to-knowledge, video-to-knowledge, wiki-compile-review-publish) | 8402d851 | ✓ | READY |
| hr-onboarding (2: agent-onboarding-v1, agent-role-upgrade-v1) | dc702687 | ✓ | READY |
| workflow-todo-dogfood (1: agent_self_task_v1 — partner nodes IDENTITY_REPAIR_REQUIRED-excluded) | b21ddb23 | ✓ | READY (partial scope) |
| commercial-exploration-dogfood (2: biz-explore-v1, biz-publish-v1) | 9ddbb1c7 | ✓ | READY |
| game-dev (1: game_dev_flow_v1) | 208f91e9 | ✓ | READY |
| adc-v2-dogfood (6: adc-backend/frontend/game/miniapp/mobile-dev-v1, project-insight-review-v1) | 4e5a4578 **after M6-1** | ✓ | GATED on M6-1 |

## 5. §M2A — test-definition archives (2 subjects × 1 command)

| # | definition | domain | actor | admission |
|---|---|---|---|---|
| M2A-1 | visit_canary_648a6b90 (PUBLISHED) | hr-onboarding | dc702687 | READY — `POST /internal/v1/domains/{domainId}/definitions/{definitionId}/archive` |
| M2A-2 | test-workflow-v1 (DEPRECATED) | adc-v2-dogfood | 4e5a4578 | GATED on M6-1 |

## 6. EXECUTION_COMMAND_LEDGER (command-level, B6)

Idempotency rule (all commands): deterministic `Idempotency-Key: wdh-v1-<CLASS>-<logical_subject>-<seq>`; receipts land in `workflow_command_receipts` / svc response body; read-back required before next-command admission. Preimage/postimage: frozen census TSVs + per-command captures under `census-raw/execution/`.

| seq block | class | command (count) | authority_ref | actor | next-command admission |
|---|---|---|---|---|---|
| A | M6 | `PUT /internal/v1/domains/{domainId}/owner` per subject (9) — coordinator S1 | WCC accepted coordinator authority + B1 grant (dc702687) — **BLOCKED until LIVE_COORDINATOR_CONTROL_PLANE_READY=YES**; fallback = separate narrow Owner-authorized binding-repair authority (S2 shape: disable+grant, 16 commands) naming canonical actor | dc702687 (post-grant) | each A-row read back: exactly one enabled DOMAIN_OWNER, canonical; then |
| B | M1A | `POST …/workflow-instances/{id}/cancel` (8) | DOMAIN_OWNER-of-domain + workflow.execute | dc702687 | owning domain's A-row applied+read-back; per-row readback cancelled=true, 1 CANCEL event |
| C | M2A | `POST …/definitions/{definitionId}/archive` (2) | definition governance DOMAIN_OWNER | dc702687 / 4e5a4578 | C-1 READY; C-2 gated on A(M6-1); readback archived=true |
| D | M2 | create_draft (25) → replace_graph (25) → publish (25) | WDA definition governance DOMAIN_OWNER | per-domain canonical owner | per def strictly ordered a→b→c; publish readback: new version PUBLISHED, stale version retired; adc 6 defs gated on A(M6-1) |

```text
M6_COMMANDS = 9 (S1) | 16 (S2 fallback)
M1A_COMMANDS = 8      M2_COMMANDS = 75      M2A_COMMANDS = 2      M1B_COMMANDS = 0 (HOLD)
TOTAL_PRODUCTION_MUTATION_COMMANDS = 94 (S1) | 101 (S2) — mechanically derived, never assumed 48
```

## 7. Frozen exclusions (re-affirmed, unchanged)

cebf4816 = QUARANTINED/DO_NOT_RECOVER; 5709a28e = WAE_V2; 085b41f2 = PRESERVE; 6ea453e2 = AMBIGUOUS/EXCLUDED; 3025174e = REAL_BUSINESS/PRESERVE; M4_HUMAN_MUTATION_COUNT = 0; M5_TEST_IDENTITY_REPAIR_COUNT = 0; HISTORICAL_ASSIGNEE_SQL_REWRITE = FORBIDDEN; DELETE_REAL_BUSINESS = FORBIDDEN.

## 8. Sequencing gate (unchanged) + B2 facts

```text
M1_CURRENT_EXECUTABLE_PATH        = DOMAIN_OWNER_ONLY
M1_ACCEPTED_COORDINATOR_PATH      = EXISTS_BUT_NOT_YET_LIVE (accepted authority contains
                                    GLOBAL_WORKFLOW_COORDINATOR → cross-domain cancel/archive;
                                    production activation = separate existing Goal)
LIVE_COORDINATOR_CONTROL_PLANE_READY = NO (no canonical principal granted; WCC B1 pending)

G2 (WORKFLOW_ASSIGNEE_ADMISSION_GUARD_V1) production gate
→ fresh G1 preimage census → write-set re-verification → §A→§B→§C→§D → final read-back
```
