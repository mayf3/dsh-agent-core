# WORKFLOW_DATA_HYGIENE_V1 — CLEANUP_PLAN (EXACT SET, FROZEN)

- **Status**: FROZEN for audit · **r3 (2026-09-11, Owner REVISE_ON_NEW_EVIDENCE ruling — blocker union B1–B7 applied)**. INDEPENDENT_AUDIT r1/r2 = SUPERSEDED_BY_NEW_MECHANICAL_EVIDENCE (r2 asserted `all 12 M1 endpoints are /cancel = PASS` + `COMMAND_LEDGER_COMPLETE = PASS` + `SHIP_BLOCKERS = 0`, disproven by the B1/B3 source censuses below). CLEANUP_PLAN r2 @ `6936306` = REVISE (superseded in place). Production execution is **NOT authorized by this document** — sequencing gate §5 AND the per-family HOLD gates (§M1/§M6) apply.
- **Inputs**: `CLASSIFICATION_LEDGER.md` r2 (frozen), `census-raw/` TSVs + sha256 manifest.
- **Mutation discipline**: `PRODUCTION_MUTATION_CONCURRENCY=1`; `READ_BEFORE_WRITE=REQUIRED` per row (re-read the row immediately before mutating; membership drift ⇒ STOP_ON_NEW_EVIDENCE, recompute affected rows only); `WRITE_SET_MUST_EQUAL_AUDITED_SET=YES`; preimage/postimage of every row frozen to `census-raw/execution/{pre,post}/` at execution time.
- **No DELETE anywhere in this plan.** Every mutation is a governance-state transition that preserves the row and its history.

## Counts (r2 — logical subjects vs command-level mutations are DISTINCT dimensions)

r2's `TOTAL_LOGICAL_CLEANUP_SUBJECTS = 48` prose MIXED cleanup targets with
disposition-only rows and is revoked (Owner B4). Frozen distinct metrics (B4):

```text
CLEANUP_TARGET_SUBJECTS               = 48   (M1 12 + M2 25 + M2A 2 + M6 9)
DISPOSITION_ONLY_SUBJECTS             = 6    (M3 ledger dispositions; 0 DB mutations)
TOTAL_TRACKED_HYGIENE_SUBJECTS        = 54
(M4/M5 remain zero-mutation classes; no artificial subject rows.)

TOTAL_PRODUCTION_MUTATION_COMMANDS = 98 (r2) is REVOKED (Owner B2: four of the twelve
M1 cancels are mechanically inapplicable — see §M1B). Per-subject disposition after the
B1/B3/B5 blocker union (B6; mechanically derived — see EXECUTION_COMMAND_LEDGER r3):

  READY_MUTATION_SUBJECTS       = 24  (M2 23 canonical repairs + M2A-1)
  DEPENDENCY_GATED_SUBJECTS     = 12  (M1A 8 + M6-1 + M2A-2 + M2 identity-blocked 2)
  NO_MUTATION_SUBJECTS          = 12  (M1B 4 + M6-2..9 8)
  TOTAL_READY_MUTATION_COMMANDS  = 70  (M2 23x3 + M2A-1 1)
  TOTAL_GATED_MUTATION_COMMANDS  = 10  (M1A 8x1 + M6-1 apply + M2A-2 1; identity-blocked
                                        subjects carry ZERO commands — HOLD before cmd 1)
  FINAL_TOTAL_MUTATION_COMMANDS  = UNRESOLVED — frozen only when every subject has an
                                   exact legal sequence (M1B 4 + the 2 identity-blocked
                                   M2 subjects pending)
  (read-only steps — reconcile plan, get_owner read-backs — are verification, NOT
   mutation commands; ledger r3 = 96 rows total = 80 mutation commands + 16
   read-only/disposition records)
```

EXECUTION_COMMAND_LEDGER = `execution-command-ledger.tsv` (generated, mechanical) +
`build-execution-command-ledger.mjs` (deterministic derivation from census TSVs) +
`execution-command-summary.json`. Every command row freezes: subject_id / sequence_no /
operation (fresh source-census command names — broker manifest
`workflow_definition_authoring` 4 ops + svc endpoints; NOT guessed) / endpoint / method /
authority_ref / server_side_role / expected_preimage / idempotency_anchor (fresh
Idempotency-Key per command, trusted seam) / success_receipt / expected_postimage /
next_step_admission_condition.

`WRITE_SET_MUST_EQUAL_AUDITED_SET` (r2 definition) means: (a) the LOGICAL SUBJECT SET is
unchanged versus this audited plan, AND (b) the executed COMMAND SEQUENCE exactly matches
this audited EXECUTION_COMMAND_LEDGER (no extra commands, no reordered dependencies, no
substituted operations).

## §M6 — Domain-owner binding repairs (r3: 9 rows → 1 retained + 8 REMOVED)

**r3 MINIMALITY RULING (Owner B5) — applied.** The accepted
`SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1` authorizes cross-domain cancel/archive AND that
authorization is **already implemented and deployed** at `6dc1027`: the cancel/archive
transactions gate on `DOMAIN_OWNER of the instance's domain OR enabled
GLOBAL_WORKFLOW_COORDINATOR` (CTR-CP-001 W-widening,
`cancel_transaction.rs:280-293`, source-verified 2026-09-11). What is NOT yet in place is
the `GLOBAL_WORKFLOW_COORDINATOR` role GRANT itself (five-gate bootstrap: 4/5 gates passed;
Owner authorization packet outstanding). Therefore the r2 rationale "take ownership solely
to unlock M1 cancel/archive" does NOT survive: once the grant completes, the coordinator
cancels cross-domain directly, and the takeover rows are REMOVED:

```text
M6-1  RETAINED — business-domain canonical CTO repair (adc-v2-dogfood):
      independently justified governance repair, not an M1 unlock
      (M2A-2 archive depends on it; dependency recorded).
M6-2..4  REMOVE_FROM_PLAN — unlock-only for M1-6..8 in canary-wda-v1-* test
      domains; those domains hold no other governed state after M1 cleanup
      (disposable residue); no accepted operation requires DOMAIN_OWNER there.
M6-5..7  REMOVE_FROM_PLAN — unlock-only for M1-1..4 in assistance-* test domains
      (dead-owner bindings); the coordinator role — five-gate grant bootstrap — covers those cancels directly;
      dead-owner binding rows persist untouched as history (DEC-CP-007 repairable
      input for any future authority).
M6-8..9  REMOVE_FROM_PLAN — ownerless e2e domains whose ONLY hygiene rows are the
      M1B dangling instances (no reachable mutation surface exists at any
      ownership level — see §M1B census); ownership grants nothing executable.
```

M6 subjects M6-2..9 remain TRACKED (they stay inside CLEANUP_TARGET_SUBJECTS = 48) as
NO_MUTATION_DISPOSITION rows in the r3 ledger with per-row removal reasons. M6-1 rows in the
ledger = plan (read-only) + apply (the single retained M6 mutation command) + read-back.

**r2 AUTHORITY RE-MAP (Owner ruling B1).** Authority-layer map, frozen:

```text
Principal UUID -> canonical Agent mapping   = auth-service authority
Workflow Domain / DOMAIN_OWNER / DOMAIN_MEMBER bindings
                                            = svc-workflow authority
```

§M6 mutations are **Workflow-Domain binding governance** and therefore map to the
**accepted `SVC_WORKFLOW_COORDINATOR_CONTROL_PLANE_V1`** (svc main `dd235dc`, deployed
live @ gitSha `6dc1027`) and its Broker surfaces — NOT to auth-service, NOT to
`workflow.admin` scope (that scope is not the Domain-role authority owner), NOT to direct
DB writes. Narrowest atomic path chosen per row (r3: operative for **M6-1 only**; the M6-2..9
projections below are retained solely inside the labelled historical block):

- **M6-1..M6-7** (a disabled/stale/dead-owner enabled binding EXISTS):
  `workflow_domain_binding_reconcile(operation=plan -> operation=apply, role=DOMAIN_OWNER)`
  — the reconcile-apply is the narrowest path that ATOMICALLY disables the old binding and
  establishes the canonical one inside one transaction behind an exact-preimage
  re-assertion (409 `binding_conflict`, zero mutation on drift). Source principal
  `enabled` is NOT required (accepted DEC-CP-007) — the dead-owner rows (M6-5..7,
  principal NOT_FOUND in auth directory but FK-present in svc `principals`) are exactly
  the repairable input this contract was built for.
- **M6-8..M6-9** (NO binding row at all — reconcile preimage impossible):
  `workflow_domain_admin(operation=set_owner)` — the narrow establishing path.

> **HISTORICAL_R2_CENSUS_RECORD_ONLY · NON_EXECUTABLE · SUPERSEDED_BY_R3**
> The following r2 table is the census record of the B-round design. The M6-1 row remains
> the operative execution spec (retained canonical CTO owner repair). The M6-2..9 rows are
> **REMOVE_FROM_PLAN / NO_MUTATION_DISPOSITION** — they are NOT intended binding repair
> targets; no command exists for them and none may be derived from this table.

Per-row frozen execution fields (full expansion in EXECUTION_COMMAND_LEDGER):

| # | domain (provenance) | broker operation(s) | svc endpoint | actor | server-side role requirement | idempotency | preimage assertion | receipt/audit | post-readback |
|---|---|---|---|---|---|---|---|---|---|
| M6-1 | adc-v2-dogfood (**canonical twin repair**: legacy cto `3e2439d2` → canonical `agt_cto-agent` `4e5a4578`; NOT an HR takeover) | binding_reconcile plan→apply (role=DOMAIN_OWNER) | POST `/internal/v1/domains/{domainId}/binding-reconcile/{plan,apply}` | GLOBAL_WORKFLOW_COORDINATOR = dc702687 (agt_hr-agent) | GLOBAL_WORKFLOW_COORDINATOR (server-side binding check; accepted CTR-CP-001/DEC-CP-008) | fresh Idempotency-Key on apply; plan is read-only/none | in-tx: binding `ab05acde…` enabled=TRUE role=DOMAIN_OWNER principal=`3e2439d2` | receipt command_type=`domain.binding_reconcile` + audit `binding_reconciled` (authorityBasis=GLOBAL_WORKFLOW_COORDINATOR, rationale=CANONICAL_TWIN_REPAIR) | GET owner → exactly one enabled owner `4e5a4578` |
| M6-2..4 | canary-wda-v1-… test domains (**canonical twin repair**: `bc970ced` → `dc702687` agt_hr-agent, same lineage) | same as M6-1 | same | same | same | same | bindings `1f4a85a6…`/`0110a71a…`/`942b2680…` per binding-rows-for-plan.tsv | same | GET owner → `dc702687` |
| M6-5..7 | assistance-* test domains (**operational owner for cleanup**: dead owner NOT_FOUND in auth, FK-present in svc) | same as M6-1 | same | same | same | same | bindings `91fa0c02…`/`bf509296…`/`7b59a044…` enabled=TRUE (dead principals) | same (rationale=OPERATIONAL_OWNER_TEST_DOMAIN) | GET owner → `dc702687` |
| M6-8..9 | canary-e2e-… / auth-v1-e2e-readonly test domains (no binding row) | workflow_domain_admin set_owner | PUT `/internal/v1/domains/{domainId}/owner` | same | same | fresh Idempotency-Key | census: zero DOMAIN_OWNER rows exist | receipt (admin/coordinator receipt machinery) + audit | GET owner → `dc702687` |

**Test-domain / ownerless HR-as-operational-owner rationale (per row, provenance frozen) — HISTORICAL_R2_CENSUS_RECORD_ONLY / NON_EXECUTABLE / SUPERSEDED_BY_R3:**
M6-2..M6-4 domain keys match the census TEST_DOMAIN_RE (`canary-wda-v1-*`); M6-5..7 match
`^assistance-`; M6-8..9 match `canary-e2e-*` / `auth-v1-e2e-readonly`. Every one is a
test/probe domain; HR operational ownership exists solely to unlock §M1/§M2A cleanup in
that domain and carries no business-domain authority.

**GATE:**

```text
M6_PRODUCTION_MUTATION = HOLD
  until LIVE_COORDINATOR_CONTROL_PLANE_READY = YES
  (= coordinator bootstrap grant completed AND broker control-plane surface deployed)
```

Rollback per row: re-apply prior binding state through the same coordinator authority
(binding rows are never deleted; old rows persist with enabled=false as history).

> **r3 STATUS MARKER**: this table is retained as the r2 CENSUS RECORD. Per the B5
> minimality ruling, rows M6-2..9 are **REMOVE_FROM_PLAN** — no mutation is authorized for
> them; only M6-1 proceeds (DEPENDENCY_GATED on the coordinator grant bootstrap; its ledger
> rows are the only M6 mutation commands). M6-2..9 are zero-command
> NO_MUTATION_DISPOSITION records in the r3 ledger.

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

M6-1 (the only retained binding-repair target): preimage = frozen `census-raw/binding-rows-for-plan.tsv`; postimage = exactly one enabled DOMAIN_OWNER for adc-v2-dogfood, canonical principal `4e5a4578`, old binding `enabled=false` preserved as history. REAL_BUSINESS_DOMAIN_BINDING_REPAIR_TARGETS = **M6-1 only**. Rollback = re-apply prior binding state via the same accepted coordinator authority (GLOBAL_WORKFLOW_COORDINATOR surface; binding rows are never deleted; NO legacy workflow.admin credential fallback). `canary-wda-v1-1788582639` deliberately untouched (its 3 test instances are TERMINAL history → preserve; no unlock needed).

## §M1 — Test instances (r3: split into M1A 8 ordinary cancels + M1B 4 dangling, Owner B1)

**M1A — ordinary supported cancel (8 rows, M1-1..8; all NON_TERMINAL_CURRENT with a current
NodeVisit — cancel precondition met).**

Exact mutation: `POST /internal/v1/workflow-instances/{id}/cancel` with reason string
`WORKFLOW_DATA_HYGIENE_V1 M1 TEST_OR_FIXTURE residue removal (census 2026-09-10)`, executed
by dc702687 (`agt_hr-agent`) under the accepted coordinator widening — which IS
implemented and deployed at `6dc1027`: the cancel transaction's governance-write role check
is `DOMAIN_OWNER of the instance's domain OR enabled GLOBAL_WORKFLOW_COORDINATOR`
(`cancel_transaction.rs:280-293`, CTR-CP-001 W-widening; source-verified 2026-09-11).
Execution preconditions: the `GLOBAL_WORKFLOW_COORDINATOR` five-gate grant bootstrap
completed (4/5 gates passed per the coordinator goal record; the Owner authorization packet
is outstanding) ⇒ **M1A rows are DEPENDENCY_GATED**, and
`AUTH_V1_CANARY_WRITE_ENABLED=true` (verify once before the batch).

**M1B — NON_TERMINAL_DANGLING rows (4: M1-9..12) — Owner B1 narrow census outcome.**

Mechanical facts (census rows + svc source `src/domain/workflow_instance/errors.rs`):
`current_node_visit_id = NULL`, lifecycle = NON_TERMINAL_DANGLING, TEST_OR_FIXTURE fixture
provenance proven (test_domain / test_creator / synthetic_instance_id signals). Therefore
(at the deployed generation `6dc1027`, verified in
`src/store/postgres/workflow_instance_repository/cancel_transaction.rs:318`):

```text
NORMAL_CANCEL  = INAPPLICABLE (cancel requires a current NodeVisit;
               a NULL current visit fails with
               CancelWorkflowInstanceError::InternalConsistency(
                 "instance has no current node visit"))
NORMAL_ARCHIVE = INAPPLICABLE (archive requires cancelled or terminal
               => ArchiveWorkflowInstanceError::InstanceNotTerminal)
DIRECT_DB_EDIT      = FORBIDDEN
FAKE_CURRENT_VISIT  = FORBIDDEN
FAKE_TRANSITION     = FORBIDDEN
```

Narrow existing-authority/surface census for exactly these four rows (svc-workflow source at the deployed generation `6dc1027`,
HTTP router `src/http/mod.rs`, 50 `.route()` registrations, full enumeration): the ONLY
reachable instance-mutation surfaces are `/cancel` and `/archive` (both inapplicable
above);
`admin_recovery` (`rebuild_projection`, `admin_emergency_override`) and `admin_repair`
(`repair_context` plan/apply) application-layer functions exist in
`src/application/workflow_instance/` but have **NO HTTP route** (not reachable by any
caller; not an existing surface). No instance delete endpoint exists.

```text
CENSUS_OUTCOME = NARROW_ONE_TIME_AUTHORITY_REQUIRED
(documented zero-mutation alternative: EXPLICIT_PRESERVE_QUARANTINE — leave the four
 test-fixture rows quarantined in place as documented residue; the choice between a
 narrow one-time authority and explicit preserve-quarantine is a separate future
 Owner gate and MUST NOT be assumed by this plan)
M1B_MUTATION_SEQUENCE   = UNRESOLVED
M1B_PRODUCTION_MUTATION = HOLD
```

M1A rows:

**M1A rows (M1-1..8 only):** classification = TEST_OR_FIXTURE with mechanical provenance
signals (ledger); current_state preimage = census row (cancelled=false, archived_at=null,
current visit per TSV); **expected postimage = cancelled=true + exactly one CANCEL event**,
cancel_reason as above, cancelled_by=dc702687, all payload/context/visit history preserved.
Rollback = none applicable — cancel preserves the row and history; the REAL_BUSINESS risk
gate is the audit's `REAL_BUSINESS_FALSE_POSITIVE_CHECK` plus per-row read-before-write
re-verification of the classification signals.

**M1B rows (M1-9..12):** **expected postimage = CURRENT STATE UNCHANGED; mutation commands
= 0; disposition = HOLD** (see the M1B census outcome above). No ordinary cancel/archive
instruction applies to these rows.

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

## §M2 — Effective-definition repairs (r3: 23 READY + 2 identity-blocked) + test-def archives (2 rows)

**r3 split (Owner B3).** The 25 subjects become:

```text
M2_CANONICAL_DEFINITION_REPAIRS     = 23  (READY — 3 authoring commands each)
M2_IDENTITY_BLOCKED                 = 2  (audit-r4-adopted; both DEPENDENCY_GATED, ZERO commands)  (agent_self_task_v1 AND agent-role-upgrade-v1 —
    audit r4 finding adopted: the latter's effective PUBLISHED graph also carries
    unresolved fixed-principal b6b033c4 nodes at ceo_approve/ceo_verify with no mechanical
    twin; both subjects are DEPENDENCY_GATED with ZERO commands, HOLD before command 1,
    deferred to the normal provisioning authority; no generic identity-repair framework)
```

**M2B identity disposition (existing identity authority answer, captured read-only in
`census-raw/auth-resolution-all-principals-20260910.tsv`):** the fixed-principal partner
nodes reference `b6b033c4-90ba-40aa-a338-304da442cab7` (龙虾合伙人) — an ACTIVE machine
principal whose authority resolution carries **NO canonical Agent mapping** (the previously
floated candidate `25a6789f` / `agt_ceo-agent` is NOT the authority). This is the
RETURNS_NO_PROVEN_SUCCESSOR branch of the Owner ruling:

```text
IDENTITY_MAPPING_GUESS = FORBIDDEN
M2B_SEQUENCE_START = HOLD (before command 1 — no dangling successor DRAFT may be created)
M2B executable commands in this ledger = 0 (subject row = DEPENDENCY_GATED record)
```

BOTH identity-blocked subjects (agent_self_task_v1 AND agent-role-upgrade-v1) are deferred
to the normal provisioning authority: only when that authority establishes a canonical
Agent identity for `b6b033c4` (or an Owner-ruled successor) may their graph/postimage and
command ledgers be regenerated mechanically. No generic
identity-repair framework is opened by this plan.

**Command sequence (B2 — fresh source census, command names NOT guessed).** Each of the
23 READY subjects expand to exactly THREE production mutation commands on the WDA authoring
surface (broker manifest `workflow_definition_authoring`, svc endpoints live):

```text
1. workflow_definition_authoring(operation=create_draft_version)
   POST /internal/v1/domains/{domainId}/definitions/{definitionId}/versions
2. workflow_definition_authoring(operation=replace_draft_graph)
   PUT  /internal/v1/domains/{domainId}/definitions/{definitionId}/draft
3. workflow_definition_authoring(operation=publish_version)
   POST /internal/v1/domains/{domainId}/definitions/{definitionId}/publish
```

23 READY subjects × 3 commands = 69 (+ M2B agent_self_task_v1 DEPENDENCY_GATED with ZERO commands — sequence HOLD before command 1). Executor per def = that domain's canonical enabled
DOMAIN_OWNER (adc defs authorized by `4e5a4578` **after M6-1**). Authority: definition
governance = DOMAIN_OWNER, idempotent+audited (`src/application/definition_governance/`);
**AUTHORITY_GAP = NO**. Rollback = prior versions are immutable and intact; a bad successor
version is itself retired via the same authoring authority.
why_real_business_is_not_deleted: versioned repair is additive; no row of any version is
modified or deleted.

**Special admission override (recorded honestly, unchanged from r1):**
`agent_self_task_v1` partner_check/partner_accept nodes point at `b6b033c4` (anomalous
agent_id=self-UUID; **no mechanical twin**). Its 3-command sequence is
**ADMISSION-GATED (r3 — superseding the r2 wording)**: the agent_self_task_v1 subject has NO
executable commands in the r3 ledger. Per Owner B3 the whole authoring sequence HOLDS
**before command 1** — no draft is created, so there is no cmd-2 to block. Identity
disposition: auth exact-resolution returns NO canonical Agent mapping for b6b033c4
(RETURNS_NO_PROVEN_SUCCESSOR); IDENTITY_MAPPING_GUESS = FORBIDDEN; deferred to the normal
provisioning authority.

Special sub-row (r3): `agent_self_task_v1` partner_check/partner_accept nodes point at
`b6b033c4` (anomalous agent_id=self-UUID; **no mechanical twin**). Both nodes =
**IDENTITY_REPAIR_REQUIRED** — but the successor identity is NOT guessed and NOT chosen here:
the auth exact-resolution authority returns NO canonical mapping (RETURNS_NO_PROVEN_SUCCESSOR
branch), so the subject is DEPENDENCY_GATED with ZERO commands until the normal provisioning
authority establishes the identity. The def's mechanical nodes (95eab282→b21ddb23 twin)
belong to the 23 READY repairs.

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

## Audit answer contract (r2 — B3 wording, supersedes r1 assertion set)

The r1 claim `ZERO_REAL_BUSINESS_MUTATION_TARGETS` is **REVOKED** — M2/M6 legitimately
touch real-business governance state. The r2 assertions are enumerated per surface:

```text
REAL_BUSINESS_INSTANCE_CANCEL_TARGETS        = 0
REAL_BUSINESS_INSTANCE_ARCHIVE_TARGETS       = 0
REAL_BUSINESS_INSTANCE_DELETE_TARGETS        = 0   (no DELETE exists anywhere)

REAL_BUSINESS_DEFINITION_REPAIR_TARGETS      = the exact audited M2 set only
                                               (25 BUSINESS_STALE_FIXED_CONFIG defs,
                                               mechanically enumerated from
                                               definition-classification.tsv)

REAL_BUSINESS_DOMAIN_BINDING_REPAIR_TARGETS  = **M6-1 only** (adc-v2-dogfood canonical
                                               twin repair; M6-2..9 = REMOVE_FROM_PLAN /
                                               NO_MUTATION_DISPOSITION — no repair targets)

REAL_BUSINESS_GOVERNANCE_REPAIR_IS_NON_DESTRUCTIVE                                  = YES
HISTORICAL_DEFINITION_VERSION_REWRITE                                               = NO
HISTORICAL_NODEVISIT_REWRITE                                                        = NO
DOMAIN_OWNER_REPLACEMENT_MATCHES_CANONICAL_SUCCESSOR_OR_EXPLICIT_OPERATIONAL_OWNER  = YES
  (M6-1..M6-4 = canonical successor/twin repairs — M6-1 is the adc-v2-dogfood legacy-cto
   -> canonical agt_cto-agent owner repair, NOT an HR takeover; M6-5..M6-9 = explicit
   operational-owner establishment on test/ownerless domains, each with frozen
   test-domain provenance and cleanup-only rationale)
```

Unchanged invariants:

```text
IDENTITY_AUTHORITY_BYPASS            = NO  (all principal mappings = auth twin map / registered
                                            successor lines; b6b033c4 left to identity authority)
HISTORICAL_ASSIGNEE_REWRITE          = NO  (no node_visit mutation anywhere)
TEST_CLASSIFICATION_SUPPORTED        = YES (every M1 row carries mechanical signals, zero
                                            title-string classifications)
HUMAN_REQUIRED_CLASSIFICATION_SUPPORTED = YES (ledger §7)
SHIP_BLOCKERS                        = PENDING — FINAL_CURRENT_HEAD_AUDIT not yet run
                                            (INDEPENDENT_AUDIT_R1 = SUPERSEDED;
                                             INDEPENDENT_AUDIT_R2 = SUPERSEDED;
                                             later convergence reviews = INPUT_TO_CURRENT_HEAD)
```

## §r3 — Blocker-union closure record (Owner REVISE_ON_NEW_EVIDENCE 2026-09-11)

```text
B1  M1 split            = DONE (M1A 8 ordinary cancels / M1B 4 dangling; census outcome
                          NARROW_ONE_TIME_AUTHORITY_REQUIRED, alternative
                          EXPLICIT_PRESERVE_QUARANTINE; M1B_MUTATION_SEQUENCE = UNRESOLVED;
                          M1B_PRODUCTION_MUTATION = HOLD; DIRECT_DB_EDIT / FAKE_CURRENT_VISIT /
                          FAKE_TRANSITION = FORBIDDEN)
B2  98-command total    = REVOKED (r3 ledger: 70 READY + 10 GATED mutation commands;
                          FINAL total stays
                          UNRESOLVED until M1B/M2B dispositions land)
B3  M2B identity        = HOLD recorded (RETURNS_NO_PROVEN_SUCCESSOR branch;
                          IDENTITY_MAPPING_GUESS = FORBIDDEN; 0 executable commands;
                          deferred to the normal provisioning authority)
B4  count semantics     = FROZEN (CLEANUP_TARGET_SUBJECTS = 48; DISPOSITION_ONLY = 6;
                          TOTAL_TRACKED_HYGIENE_SUBJECTS = 54; no mixed summation)
B5  M6 minimality       = M6-1 RETAINED (business-domain canonical CTO repair);
                          M6-2..9 REMOVE_FROM_PLAN with per-row recorded reasons
                          (unlock-only / no-executable-cleanup; deployed svc cancel/archive
                          widening IS implemented+deployed at 6dc1027
                          (cancel_transaction.rs:280-293); the outstanding dependency is the
                          GLOBAL_WORKFLOW_COORDINATOR five-gate grant bootstrap — the
                          takeover, not the grant, is what B5 removes)

M6 authority terminology (frozen; replaces the r2 "M6_AUTHORITY_GAP" framing):
  M6_PRODUCT_AUTHORITY               = CLOSED (the accepted coordinator contract plus the
                                       deployed W-widening at 6dc1027 already authorize
                                       the operation)
  M6_IMPLEMENTATION                  = DEPLOYED (svc 6dc1027: cancel widening
                                       cancel_transaction.rs:280-293 + binding_reconcile /
                                       set_owner surfaces)
  M6_CANONICAL_EXECUTION_ACTOR_READY = NO
  M6_BLOCKER                         = GLOBAL_WORKFLOW_COORDINATOR_GRANT_PENDING
                                       (execution/adoption readiness — NOT missing
                                       product authority; no legacy workflow.admin
                                       credential fallback)
B6  ledger regenerated  = DONE (execution-command-ledger.tsv r3: 96 rows = 80 mutation commands (70 READY + 10 GATED) + 16 read-only/disposition records; every row
                          carries mutation_class = READY | DEPENDENCY_GATED |
                          NO_MUTATION_DISPOSITION; builder updated mechanically)
B7  audit r3            = PENDING — runs only after this r3 revision passes the Owner
                          exact-head gate (the blocker union above is closed in the plan;
                          the audit validates the closure)
```

```text
GOAL_STATUS = ACTIVE
DEPENDENCY_WAIT = NO
PRODUCTION_APPLY_ALLOWED = NO
DURABLE_GUARD / M1B MUTATION = HOLD
NEXT = Owner exact-head acceptance of this r3 revision → ONE independent audit r3
       (required proofs per Owner B7) → only then true dependency wait
```
