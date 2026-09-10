# WORKFLOW_ASSIGNEE_ADMISSION_GUARD_CENSUS_V1

Investigation (evidence authority — grants NO implementation permission).

```text
GOAL = WORKFLOW_ASSIGNEE_ADMISSION_GUARD_V1
PHASE = AUTHORITY_AND_WRITE_PATH_CENSUS (read-only; zero mutation anywhere)
DATE = 2026-09-10
BASES READ =
  svc-workflow github/main dd235dc (true current main authority: migrations 0001–0025,
    dispatch-intent feed, wake, visit activation, CIR V2 admission, successor lines;
    the locally checked-out main 88ff814 is STALE+DIVERGED and was used only to confirm
    shared-lineage facts — every load-bearing claim below re-verified on dd235dc)
  dsh-agent-core 4d36c45 (current main authority incl. WAE V2 implementation PR #246;
    the working tree at 5697208 predates it — all dsh reads via git show 4d36c45:<path>)
  auth-service github/main (contains accepted AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1;
    branch codex/internal-identity-directory-spec-v1 is an ancestor) + branch
    codex/workflow-canonical-admission-auth-accepted-v1 (acceptance record cf5294a)
  broker / workflow-execution / product-api @ dsh 4d36c45
METHOD = mechanical source census (4 parallel read-only passes) + governing-spec contract
  extraction; every claim carries file:line or spec §; absences state the grep that failed.
```

---

## 0. R2 — MECHANICAL_REVISE (Owner census ruling 2026-09-11)

CENSUS_CORE_DISCOVERY = ACCEPTED · CENSUS_FINAL_CLASSIFICATION = MECHANICAL_REVISE.
Three r1 Gate-A claims are RETRACTED; root cause recorded; fresh repins frozen.

Retracted (r1 §2.4/§3.3/§6/§7):

```text
GATE_A_AUTHORITY_GAP = YES        → RETRACTED
GATE_A_IMPLEMENTATION_GAP = YES   → RETRACTED
PUBLISH_UNIQUE_TOCTOU = YES       → RETRACTED
"two narrow authority candidates" → RETRACTED (exactly one possible: TEST_OR_CANARY)
```

Root cause (mechanical): the Definition-side census pass executed on the STALE local
svc main (88ff814) and its findings were carried forward without re-verification on
the true authority base github/main. The github/main delta pass covered
dispatch/activation/successor seams but was never re-pointed at the definition
publish path. Current-main evidence (all re-verified 2026-09-11 on dd235dc):

```text
GATE_A_AUTHORITY = SVC_WORKFLOW_CANONICAL_IDENTITY_RECONCILIATION_V2 / CTR-CIR-003
GATE_A_SOURCE_IMPLEMENTATION = PRESENT
GATE_A_PRODUCTION_ADOPTION = UNVERIFIED
```

Mechanical proof of PRESENT (dd235dc):
- `src/application/definition/lifecycle/publish.rs:29-43,110-171` — `admission` is the
  CTR-CIR-003 gate; `collect_definition_publish_identity_literals` (every FIXED_PRINCIPAL
  id + every identity literal in context-schema defaults/enums/examples for
  INSTANCE_INPUT_PRINCIPAL keys) → `admission.admit(...)` BEFORE the publishing
  transaction → `admission.check_commit_budget()`; dormant mode =
  `AdmissionGate::disabled()` preserves pre-admission behavior.
- `src/store/postgres/definition_repository/lifecycle_transactions.rs:143-171` —
  statement deadline bound to the remaining admission budget (the 5 s
  admission-through-commit bound), budget re-checked before commit, no-op dormant;
  then FOR UPDATE + DRAFT verify + re-read + digest recompute; a graph drift after
  admission fails the digest consistency check, so no un-admitted literal can commit.
- `tests/32_definition_publish_admission.rs` (+ `tests/31_admission_wiring.rs`): 
  PUBLISH_ADMITS_EVERY_IDENTITY_LITERAL (directory sees exactly the two distinct
  principals) · PUBLISH_REJECTED_FAILS_CLOSED_ZERO_DELTA (HTTP **422 admission_rejected**,
  version stays DRAFT, receipt rolls back, same idempotency key retryable) ·
  PUBLISH_INVALID_SCHEMA_LITERAL_FAILS_VALIDATION (422 graph_validation_failed
  INSTANCE_INPUT_LITERAL_NOT_UUID, zero directory traffic — validation precedes
  admission) · PUBLISH_DORMANT_WHEN_DISABLED. The r1 "opaque 404 / 500 mapping
  anomaly" notes describe 88ff814, NOT current main.

TOCTOU correction: remote directory observations open BEFORE the publishing
transaction BY DESIGN — that is the existing CTR-CIR-003 conformance seam; the in-tx
digest/precondition fence + commit-budget re-check close the window. Remote identity
calls are NOT forced inside the locked DB transaction, and this Goal will not move them there.

Fresh repins (Owner ruling §7):

```text
SVC_CURRENT_MAIN = dd235dc (re-fetched 2026-09-11; still tip; dd235dc confirmed)
DHS_CURRENT_MAIN = b1fb7c0 (dsh origin/main tip; 4d36c45 = historical WAE merge base —
  packages/workflow-execution, product-api workflow-admission.js, WAE V2 + EAPR V2 specs
  are byte-identical 4d36c45→b1fb7c0, verified via empty git diff; cite b1fb7c0 going forward)
EVIDENCE_COMMIT = 8dc489e — REMOTE_BRANCH_VISIBLE = YES
  (github/goal/workflow-assignee-admission-guard-v1 pushed; remote tip 58c3305,
  8dc489e reachable beneath it; the tip carries one WORKFLOW_DATA_HYGIENE_V1 audit
  commit from a separate lane that had landed on the same local branch — left intact)
```

TEST_OR_CANARY exact absence — SEALED on current main: `git grep -i
"work_class|workClass|execution_class|executionClass|business_class|is_test|isTest|is_canary"`
over dd235dc src/+migrations/ = zero hits (combined with r1 Q8: WorkEligibility has
exactly two variants with BLOCKED-state invention forbidden; activation_kind is
principal-type-derived, not business/test-derived).

Frozen terminal classification (Owner ruling §8):

```text
GATE_A_NEW_AUTHORITY_REQUIRED = NO
GATE_A_NEW_IMPLEMENTATION_REQUIRED = NO
GATE_A_PRODUCTION_ADOPTION_REQUIRED = YES
GATE_B_NEW_AUTHORITY_REQUIRED = NO
GATE_B_NEW_IMPLEMENTATION_REQUIRED = NO
GATE_B_PRODUCTION_ADOPTION_REQUIRED = YES
GATE_C_NEW_AUTHORITY_REQUIRED = NO
TEST_OR_CANARY_NEW_SEMANTIC = YES only after final exact absence/concept census (absence now sealed)
CROSS_DOMAIN_DETAIL_WIDENING = NO
NEW_IDENTITY_AUTHORITY = NO
NEW_RETRY_ENGINE = NO
```

Lane structure (SAME Goal, no sub-goals):

```text
LANE_IDENTITY_ADMISSION = EXISTING_AUTHORITY_ADOPTION
  (A+B adoption proofs: deploy/current-binary verification → enable existing admission →
   controlled negative/positive tests; required proof = invalid/stale publish → 422/zero
   publish · invalid/stale create → zero instance/visit · invalid/stale transition target
   → zero next visit · valid canonical workflow → unchanged success;
   WORKFLOW_ADMISSION_ENABLED effective · directory dependencies reachable · canonical
   SERVICE identity/grants correct · failure fail-closed · zero runtime fact on rejection;
   does NOT wait for the work-class candidate)
LANE_DISPATCH = EXISTING_WAE_ADOPTION (consume WAE V2 production readiness/adoption
  evidence; no second dispatch gate, no second retry/recovery protocol)
LANE_TEST_CLASSIFICATION = MINIMAL_DESIGN → narrow authority candidate
  (see WORKFLOW_ASSIGNEE_ADMISSION_GUARD_TEST_CLASSIFICATION_DESIGN_V1)
```

Readiness signals published for WORKFLOW_DATA_HYGIENE_V1 (updated as lanes close):

```text
IDENTITY_ADMISSION_READY = NO   (source+authority present; production adoption unverified)
TEST_CLASSIFICATION_READY  = NO (classification does not exist yet)
```

---

## 1. Authority map (what is ALREADY accepted — reuse first)

| Authority | Repo / status | What it freezes that this Goal needs |
|---|---|---|
| SVC_WORKFLOW_CANONICAL_IDENTITY_RECONCILIATION_V2 | svc github/main, **accepted** | **The admission pattern.** CTR-CIR-003: within the command, after request identity/schema authorization and BEFORE db commit, obtain exact Auth relation/type/status/cardinality + Agent Definition existence/enabled for EVERY distinct Agent Principal; fail ⇒ zero business delta. Names the two directory dependencies (identity-directory / auth.directory.read; agent-directory / agent.directory.read), 5 s total admission bound, ≤8 in-flight reads, no retry, no cross-command cache, in-tx precondition re-lock, observation discard on tuple drift. Explicitly: "A dispatch-only check is insufficient." Applied (inside CIR scope) to corrected-source publish, direct creation, revision, revise-and-transition, ordinary future transitions, admin moves, bounded repair operator. |
| AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1 | auth github/main, **accepted** | `GET /api/v1/directory/principals/{principalId}/agent` → `{principalId, agentId, principalStatus}`; generic internal AGENT/SERVICE callers; baseline entitlement supply vehicle implemented (commit 7285e16). "Auth never manufactures a successor." |
| AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1 | dsh 4d36c45 (packages/product-api/src/workflow-admission.js), CTR-IAD-001..004 | `GET /v1/directory/agents/{agentId}` — generic internal directory read over the Agent Definition registry: exists + enabled + uniqueness, one synchronous snapshot, audience `agent-directory`, scope `agent.directory.read`, 1 s deadline. (The superseded dedicated-caller workflow-admission route is retired in-file.) |
| SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1 | svc github/main, **accepted** | CTR-VAI-003/004: `workflow_activations.activation_kind ∈ {HUMAN_WORK_ITEM, DISPATCH_INTENT}`, derived ONLY from the resolved canonical Principal type (HUMAN→HUMAN_WORK_ITEM, AGENT→DISPATCH_INTENT); owner resolution failure (missing/disabled/SERVICE/not HUMAN-or-AGENT) **commits nothing** (deterministic `owner_resolution_failed` class, zero facts). CTR-VAI-008/009: wake no-op semantics; due feed returns active DISPATCH_INTENT only, 7 fields, GLOBAL_SCHEDULER_READ fail-closed. |
| SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1 | svc github/main, **accepted** | Due-feed keyset contract; **deploy order: svc before the dsh poller** (CTR-WAE-001b consumes it UNCHANGED). |
| SVC_WORKFLOW_WORK_ELIGIBILITY_PROJECTION_V1 | svc github/main, **accepted** | `WorkEligibility = ACTIONABLE_NOW | WAITING_FOR_TIME` on detail + domain/global list surfaces; **"NO BLOCKED state … inventing one is forbidden by the product direction"** — a hard boundary any Gate-B state design must respect. |
| SVC_WORKFLOW_PRINCIPAL_SUCCESSOR_MIGRATION_V1 | svc github/main, **accepted** | One-time, evidence-pinned successor transfer; successor visit APPENDED, history never rewritten; NEW principal re-verified exists+enabled+type in-tx. |
| SVC_WORKFLOW_CANONICAL_IDENTITY_RECONCILIATION_V2 §CTR-CIR-001/002/006/007 (offline operator) | svc github/main, **accepted** | `identity_repair_v1` bin: plan/apply/verify; sole writer of `workflow_identity_successor_lines` (0025, append-only, UNIQUE(source), classifications STALE_PRINCIPAL_WITH_UNIQUE_REPAIR / MECHANICALLY_PROVEN_SUCCESSOR, evidence JSONB). One-edge resolve helper `identity_successor.rs:32-49` (old→new only; absent source → None). Successor canonicalization at admission is EXPLICIT, evidence-backed lineage — never silent substitution. |
| AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 | dsh main 4d36c45, **accepted** (Owner exact-head @11023c6) | **Gate C semantics.** CTR-WAE-002 one-attempt fence; CTR-WAE-003 fresh resolution, failure ⇒ ZERO Runs; V2 delta: pre-admission resolution failure = recoverable-blocked LIVE phase `resolution_blocked` of the SAME attempt (not terminal), continuable ONLY via CTR-WAE-011/012/013 controlled recovery (explicit `authorityRef`, E1–E6 fresh preconditions, delivery_started write-ahead fence, no second attempt id). NO automatic retry ever. `production_apply_authority: none`; deployment order frozen (svc keyset first). |
| AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 | dsh 4d36c45, **accepted** | `agent_resolve_principal` = Auth read + local Agent-Definition exact-ID/enabled check (CTR-EPAR-003/004/005); codes principal_not_found / principal_not_agent / principal_disabled / agent_mapping_missing / identity_resolution_ambiguous / identity_resolution_unavailable / target_not_found / target_disabled. Read-only; not a lease. |
| AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1 | dsh 4d36c45, **accepted** | Step 7 exact-UUID transition admission (actor == current-visit assignee, token-derived, 403 principal_not_assignee); assignment 变更 out of boundary; no successor/stale-assignee clauses (that material lives in WAE V2 §4 / CIR V2). |
| AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4 | dsh 4d36c45, **accepted** | Broker-side authoring; svc remains sole validation authority (DEC-002, CTR-WDA-008); graph failures 422 `graph_validation_failed`; **fixed-principal rejection stays opaque 404** (CTR-WDA-004); "unknown/disabled valid-shaped principals are rejected solely by the existing service identity checks with the existing opaque error. **No principal enumeration oracle**" (CTR-WDA-010); authoring-time identity discovery stop-on-gap guidance (CTR-WDA-011). |
| AUTH_SERVICE_WORKFLOW_CANONICAL_ADMISSION_V1 | auth branch cf5294a (accepted 2026-09-06 batch, SHA 0899cec0…; svc 0a85e909 + auth 2af21f87 + dsh bc88cc81) | SUPERSEDED as direction by CIR V2 §14 (dedicated admission identity cedb954a…/workflow-*-admission audiences retired, never provisioned; must NOT be provisioned). Historical record only. |
| AGENT_CORE_HR_DISPATCHER_V1 | dsh working tree, **proposed** (NOT accepted; implementation_authority none) | HR = dual GLOBAL_WORKFLOW_READER; no coordinator grant yet; consumes workflow_global_instances summary; principal→agent roster is a local governed file. Not authority for this Goal. |

---

## 2. Supported write-path census (dd235dc unless noted)

Legend: RES = canonical resolution call; TX = transaction boundary; RACE = exposure; FAIL = failure result; RUN = can a Run/dispatch-side effect already exist.

### 2.1 Definition create
- Assignee source: NONE (body = definitionKey/displayName/description/metadata only).
- Validation: length checks + DB unique key (23505→409); actor enabled + domain enabled + DOMAIN_OWNER (governance mod.rs:137-174; definition_crud.rs:16-51). RES: n/a. TX: receipt tx wraps only receipt/audit; write on pool. RACE: key uniqueness DB-protected. FAIL: 403/409/404. RUN: impossible (no version yet).

### 2.2 Definition draft version create
- No assignee fields; version hardwired DRAFT (definition_crud.rs:147-148); semanticModelVersion ∈ {absent,1,2,3-on-0023-line} validated handler-side. FAIL: 404/409/422 invalid_semantic_model_version. RUN: impossible (DRAFT uninstantiable).

### 2.3 Definition update (replace_draft_graph) — THE assignee intake path
- Assignee source: `nodes[].assigneeRefType|fixedPrincipalId|assigneeInputKey` (commands.rs:42-58). DRAFT-only; DB trigger 0007/0008 additionally blocks graph writes to non-DRAFT parents (incl. the 0008 re-parenting escape fix).
- Validation: shape enums (parse_assignee_ref service.rs:215-279), Legacy assignee rules (assignee_validation.rs:22-181), Minimal V2 validator (minimal_validator.rs:70-313), input-schema coverage for INSTANCE_INPUT_PRINCIPAL keys, JSON-Schema compile.
- RES: **NONE at draft save** — `fixed_principal_id` never checked against `principals` here. TX: own repo tx (graph_write.rs:28-143, FOR UPDATE + DRAFT re-verify). RACE: owner/domain checks pre-tx only (admitted in-code comment draft_graph.rs:34-37); no assignee check to race. FAIL: GraphValidationFailed surfaces as **500 internal_consistency_error** on the governance path (governance mod.rs:122-126 → error.rs:404-406) — mapping anomaly, not a validation hole. RUN: impossible.

### 2.4 Definition publish/enable
> R2 RETRACTION: this subsection describes **88ff814 (stale main)**, not the current
> authority. On dd235dc the publish path DOES run the CTR-CIR-003 admission gate over
> every identity literal before the tx, with an in-tx budget/digest fence and
> `422 admission_rejected` fail-closed zero-delta semantics — see §0. Kept verbatim
> below only as the stale-base audit trail.

- Flow: handler definitions.rs:344-378 → publish.rs:25-125 → atomic_publish_inner (lifecycle_transactions.rs:148-301; FOR UPDATE, DRAFT re-verify, domain+owner+digest+expectedRevision all IN-tx, single UPDATE to PUBLISHED, commit).
- Validation: full graph+schema re-validation (:66-84); **the ONLY assignee check is `validate_fixed_principals` (publish.rs:87 → validation.rs:62-96): FIXED_PRINCIPAL nodes only, local `principals` table existence+enabled, executed PRE-TX (outside the atomic publish tx)**. WORKFLOW_CREATOR / DOMAIN_OWNER / INSTANCE_INPUT_PRINCIPAL nodes get NO check at publish. **No principal_type='AGENT' filter anywhere in any definition assignee path** (grep principal_type|PrincipalType::Agent across src: only JWT/auth + provisioning) — any enabled HUMAN or SERVICE principal is accepted as a FIXED_PRINCIPAL assignee at publish. **No canonical resolution call** (svc's only outbound HTTP is JWKS + the dormant CIR admission client; publish does not use the latter).
- RACE: **YES** — existence/enabled checked pre-tx can flip before the PUBLISHED commit. FAIL: FixedPrincipalInvalid → **404 definition_not_found** (governance mod.rs:109-115) — error-semantics anomaly. RUN: afterwards any PUBLISHED version is instantiable (definition_lookup.rs:74-78); DEPRECATED still allows transitions; REVOKED blocks new transitions only.
- State machine: DRAFT→PUBLISHED→(DEPRECATED)→REVOKED enforced by 0006 trigger; no "current version" pointer exists — consumers pin explicit version ids; multiple PUBLISHED versions can coexist. Archive (0011) blocks authoring but NOT instantiation/transitions.

### 2.5 Instance creation
- Entry assignee resolved IN-TX (create_transaction.rs:298-322): resolve_assignee (WORKFLOW_CREATOR→caller; DOMAIN_OWNER→enabled binding+enabled principal; FIXED_PRINCIPAL / INSTANCE_INPUT_PRINCIPAL→exact UUID + `verify_principal_enabled` fail-closed; input grammar UUID-string-only, validation_helpers.rs:100-171) + `validate_owner_is_human_or_agent` (model3; activation_facts.rs:210-247 — SERVICE rejected). INSTANCE_INPUT_PRINCIPAL forbidden as entry (VISIT_ACTIVATION). **CIR admission gate** (create_transaction.rs:339-363): when `WORKFLOW_ADMISSION_ENABLED=1`, directory double-read per distinct Agent Principal before first write; failure rolls back EVERYTHING (zero delta, no receipt). Dispatch intent minted in-tx for model3 (Step 11b :446-475): activation kind DISPATCH_INTENT iff owner principal_type=AGENT, `initial_next_eligible_at=NOW()` (server-authored; born due).
- FAIL: 422 `assignee_resolution_failed`. RUN: none before commit. RACE: resolution and write are one tx; the CIR gate re-locks and discards observations on drift.

### 2.6 Transition to next node
- One tx (transition_transaction.rs): receipt/idempotency → instance lock → CAS → cancelled/terminal checks → **caller enabled (403 principal_disabled) → Step 7 actor==current-visit assignee (403 principal_not_assignee, :197-202)** → assistance fail-close → version status gate → effect validation → **Step 13 successor resolution IN-TX (:453-500; resolve_assignee + verify_principal_enabled_for_transition, 422 assignee_resolution_failed)** → owner HUMAN/AGENT check → **CIR admission (:502-513, rollback on failure)** → close source activation (:539) → insert successor visit (:571) → insert activation (:599) → projection CAS → event → receipt → commit.
- **Identity failure ⇒ 422, whole tx rolled back: NO visit, NO activation/intent, NO wake, NO Run.** A disabled current assignee blocks advancing the active visit at Step 6 (403), independent of successor resolution.

### 2.7 NodeVisit creation/activation
- Visits are INSERT-only (zero UPDATE statements repo-wide); no status column — "current" = instances.current_node_visit_id; non-terminal visits must carry assignee via 0010 trigger fn_check_node_visit_assignee. Exactly 4 writers: instance create, transition, admin_emergency_override (:378), legacy import (:116) — each covered in its own row. One activation row per visit (uq_activation_node_visit), append-only fact tables (0023 triggers).

### 2.8 Assignee replacement where supported
- **No ordinary reassignment API exists** (CIR V2 non-goals; grep confirms). Replacement happens ONLY via: (a) offline `identity_repair_v1` (successor LINES table — future resolution aliasing, no visit rewrite); (b) one-time PRINCIPAL_SUCCESSOR_MIGRATION tool (appends successor visit; never edits history); (c) WORKFLOW_ADMIN `admin_emergency_override` MOVE_TO_NODE — library-only (no HTTP/CLI route), single tx, admin binding+enabled+type≠SERVICE checks, projection-replay consistency check, CAS; **freshly re-resolves the target assignee in-tx** (`resolve_non_terminal_assignee` authorization.rs:123-171 + enabled re-check :159-170 — it never accepts an arbitrary principal id) and creates a new visit (:377-390). (d) legacy import: SERVICE principal + WORKFLOW_MIGRATION binding; derived-assignee must EQUAL node resolution (validation.rs:347-382).

### 2.9 Dispatch admission (svc side)
- Wake `POST /internal/v1/workflow-instances/{id}/node-visits/{visitId}/wake` (mod.rs:122-125): workflow.execute + direct token + GLOBAL_SCHEDULER_READ (denial audited); tx: receipt → cause → actor enabled → instance lock → find DISPATCH_INTENT activation → no-op classification {INSTANCE_CLOSED, ACTIVATION_CLOSED, VISIT_NOT_CURRENT, VERSION_MISMATCH, ALREADY_DUE} (durable 200 wakeApplied:false receipts) → eligibility event (cause WAKE) → commit. **Wake does NO assignee-identity resolution** — by design; identity admission lives at create/transition and at the consumer.
- Due feed `GET /internal/v1/dispatch-intents` (workflow.read + in-snapshot GLOBAL_SCHEDULER_READ): 7 fields incl. ownerPrincipalId (raw, NO successor enrichment), due predicate unclosed DISPATCH_INTENT ∧ instance live ∧ effective nextEligibleAt ≤ now. HUMAN_WORK_ITEM and closed/cancelled work are structurally absent from the feed.
- There is NO `dispatch_intents` table — the intent IS a `workflow_activations` row (kind DISPATCH_INTENT).

### 2.10 Dispatch admission (dsh side — WAE V2 engine, packages/workflow-execution @ 4d36c45)
- pollOnce: reconcile → keyset sweep of due feed (admission bound 25/poll; skipped stay due). Per intent inside one ledger lock: `beginAttemptIfAbsent` (attempt minted, deterministic fence) → **fresh `resolvePrincipalToAgent` (engine.js:113) = broker `agent_resolve_principal` (Auth directory read + Agent-Definition exact-ID/enabled, no cache)** → failure ⇒ phase `resolution_blocked`, outcome blocked, **ZERO Runs, exempt from reconcile** (engine.js:190-205) → success ⇒ `recordDeliveryStarted` durable write-ahead fence BEFORE router.deliver → run_delivered | delivery_failed (terminal NEEDS_REVIEW). Historical `resolve_failed:` reasons reproject bytes-unchanged to resolution_blocked; new-path refuses them fail-loud. NO auto-retry (no leases/timers beyond re-poll). Recovery `recoverAttempt({nodeVisitId, authorityRef})` is control-plane only (never a model/tool surface), E1–E6 fresh preconditions, E5 drift ⇒ recovery_refused ⇒ terminal, E6 re-resolves fresh and re-fences.
- Router second identity gate (ingress-delivery.js:305-334): exact Agent-Definition ID, AGENT_NOT_FOUND / AGENT_DISABLED before any prompt byte.

### 2.11 Recovery admission
- Admin recovery: REBUILD_PROJECTION (read-consistency rebuild, no visit/assignee writes) + ADMIN_EMERGENCY_OVERRIDE (§2.8c; re-resolves fresh in-tx). `repair-context` CLI touches context only. No recovery op bypasses identity resolution. dsh-side WAE recovery is the Gate-C controlled path (§2.10).

---

## 3. Where the Goal's invariants already hold vs. actual gaps

### 3.1 Gate B (NodeVisit materialization) — ALREADY SATISFIED at the existing transaction seam
Local facts prove the gate belongs exactly where it already is: the successor visit and its activation are created in the SAME transaction as the fresh resolution (§2.6), and failure commits nothing (422, zero visit / zero intent / zero run / zero wake). Successor canonicalization is explicit evidence-backed lineage (0025 + identity_repair_v1), satisfying "no silent successor substitution"; stale cached resolution is impossible (no cache exists on these paths). **No new gate code is required for Gate B semantics** — what remains is (i) production activation of the dormant CIR admission gate (directory-level canonical + enabled), and (ii) discriminating tests. The eligible runtime state today without WORKFLOW_ADMISSION_ENABLED: local-table enabled checks pass a stale-but-enabled principal whose Agent Definition/auth relation has since drifted — precisely the gap the dormant gate closes at the same seam.

### 3.2 Gate C (Dispatch) — AUTHORIZED AND IMPLEMENTED, awaiting production adoption
WAE V2 semantics (resolution_blocked / ZERO Runs / no auto-retry / authorityRef-gated recovery) are implemented at dsh main 4d36c45 and are exactly the Goal's Gate C. Production apply is separately gated (WAE V2 §7: svc keyset build deployed first, poller prerequisites, PRODUCTION_MUTATION slot) and owned by the WAE deployment lane — this Goal must not duplicate that authority. Residual for THIS Goal: the production E2E rows of the terminal boundary ride that same adoption window.

### 3.3 Gate A (Definition publish admission) — REAL GAP, requires narrow authority

> **R2: SUPERSEDED by §0 — Gate A authority (CTR-CIR-003) and source implementation
> (publish.rs / lifecycle_transactions.rs / tests/31+32, all on dd235dc) are PRESENT;
> only production adoption remains. The narrow-authority-candidate conclusion below is
> RETRACTED and applies to nothing.**

Q8 cross-check result: **no accepted spec freezes publish-time canonical identity admission for ordinary authoring publish.**
- Today (§2.4): only FIXED_PRINCIPAL is checked, local-table only, pre-tx (TOCTOU), with no AGENT-type constraint and anomaly error mapping (404 for a bad assignee; 500 for graph validation).
- CTR-CIR-003 freezes the admission PATTERN and applies it to corrected-source publish inside the reconciliation scope; WDA V4 pins svc as validation owner and forbids a principal-enumeration oracle; VISIT_ACTIVATION + CIR admission cover everything downstream of publish.
- Therefore Gate A = **narrow authority candidate at the existing publish transaction seam** (atomic_publish_inner), reusing the CTR-CIR-003 admission shape (in-command directory reads for every distinct Agent Principal, fail ⇒ zero delta) + AGENT-typed owner requirement, with the pre-tx race folded in-tx. OPEN design questions for MINIMAL_DESIGN: whether WORKFLOW_CREATOR/DOMAIN_OWNER/INSTANCE_INPUT_PRINCIPAL nodes are admitted at publish (creator/owner are principal-resolvable in-DB; input principals are creation-time inputs — Goal's "Draft authoring may preserve unresolved work only if explicitly non-runnable" applies) and how failure surfaces without breaking CTR-WDA-004's opacity contract (that contract governs the BROKER mapping; a new svc-side code may still be carried opaquely).

### 3.4 HUMAN_REQUIRED — structurally enforced at runtime, implicit at authoring
`activation_kind` is derived ONLY from the resolved principal type (CTR-VAI-004); HUMAN work never enters the dispatch feed; wake targets DISPATCH_INTENT only; SERVICE owners are rejected at both create and transition. So "HUMAN_REQUIRED misrouted to Agent dispatch = 0" holds by construction TODAY for every post-0023-model path, and "no fake Agent Principal" holds (human principal, no agent mapping needed). What does not exist is an explicit authoring-time HUMAN_REQUIRED declaration (nodes carry only assignee_ref_type; human/agent is a property of the resolved principal, not of the node). Any explicit marker is a schema semantic → belongs in the same narrow authority candidate as Gate A; the DB-owned guard shape (kind ↔ eligibility CHECK) already exists on workflow_activations (chk_activation_kind_eligibility).

### 3.5 TEST_OR_CANARY work class — FULLY ABSENT (second real gap)
No machine-readable work-class exists anywhere (grep canary/test/fixture across svc migrations/src: env-only canary write guard + prose). No accepted spec freezes one; WorkEligibility explicitly forbids a BLOCKED state but says nothing against an orthogonal work-class field. Required per Goal: explicit marking so TEST/CANARY work cannot enter the normal BUSINESS dispatcher. Design constraints inherited from census: the dispatcher boundary is the due-feed predicate (query_dispatch_intents.rs) + the WAE consumer; a work_class column on the intent-producing fact (or on instances/definitions) with feed/dispatch filtering is the minimal seam; name heuristics are forbidden as authority (TEST_DATA_POLICY).

### 3.6 HR boundary — existing surfaces already carry most of the classification
HR-safe today (no new authority needed to READ): workflow_global_instances / domain summaries now include `current_assignee_canonical_agent_id` (successor-enriched, ce922a6) + WorkEligibility (ACTIONABLE_NOW / WAITING_FOR_TIME) via ELIGIBILITY_FACT_JOINS; dispatchability = the GLOBAL_SCHEDULER_READ-gated due feed (7 fields incl. nodeVisitId); TERMINAL = is_terminal; HUMAN work = absence from the intent feed. RESOLUTION_BLOCKED is visible only as "intent stays due while the dsh-side attempt sits blocked" (WAE ledger is dsh-local; svc has no blocked state — by WorkEligibility's frozen direction). Per the Goal, any additional datum must first pass the "exact minimal datum required" proof — deferred to MINIMAL_DESIGN; no cross-domain detail expansion is implicated by this census.

---

## 4. Race / TOCTOU register
1. publish validate_fixed_principals pre-tx (§2.4) — the only admission TOCTOU found in svc; folded into Gate A candidate scope.
2. replace_draft_graph owner/domain checks pre-tx (admitted in comment, draft_graph.rs:34-37) — out of Goal scope (no assignee fact at stake) but recorded.
3. WAE engine: attempt-before-resolution is safe by construction (zero-side-effect failure class + delivery_started fence + reconcile exemption).
4. EAPR/directory reads: serializable single read / 5 s bound / no reuse across commands (CTR-CIR-003) — sound; activation of the gate is the open item, not its shape.

## 5. Deployment / adoption state (facts known from this sandbox)
- svc production runs a build NEWER than local main (dispatch-intents route live per prior goal evidence) but its exact deployed commit and `WORKFLOW_ADMISSION_ENABLED` state CANNOT be verified without privileged access — fresh read-back required at AUTHORIZED_DEPLOYMENT.
- dsh WAE engine + product-api directory route: merged at 4d36c45, NOT production-applied (separate lane holds PRODUCTION_APPLY).
- auth directory route + entitlement supply: accepted and merged on auth github/main; production deployment state unverified from here.
- Local svc checkout is stale/diverged — future svc work MUST branch from github/main (dd235dc or later).

## 6. Three-gate freeze (PHASE OUTPUT)

```text
GATE A (Definition publish admission) = R2: AUTHORITY+IMPLEMENTATION PRESENT (CTR-CIR-003
  @ dd235dc, dormant-by-default) — only PRODUCTION ADOPTION required; see §0.
  [r1 text below RETRACTED, kept for audit trail]
  seam = existing atomic_publish_inner publish transaction (dd235dc lifecycle_transactions.rs:148-301)
  shape = CTR-CIR-003 admission pattern, in-tx, every distinct Agent Principal,
          AGENT-typed owner check, fail ⇒ publish denied / zero delta
  folded in = pre-tx race fix + honest failure mapping (respecting CTR-WDA-004 opacity)
  open items for MINIMAL_DESIGN = non-FIXED ref-type treatment at publish;
          TEST/CANARY class field placement (same candidate, one schema semantic)

GATE B (NodeVisit materialization) = ALREADY_AT_EQUIVALENT_SEAM — NO new gate
  seam = existing instance-create / transition transactions (resolution, HUMAN/AGENT
         owner check, CIR admission, visit+intent insert, all one tx; fail = zero facts)
  remaining = production activation of WORKFLOW_ADMISSION_ENABLED (adoption window)
          + discriminating tests (T6/T10 rows) — no new semantics

GATE C (Dispatch admission) = ALREADY_AUTHORIZED_AND_IMPLEMENTED (WAE V2)
  seam = WAE engine admission + Router exact-ID gate (dsh 4d36c45)
  remaining = production adoption owned by the WAE deployment lane (svc-first deploy
          order); this Goal contributes its E2E rows to that window, no second authority

HUMAN_REQUIRED = runtime classification ALREADY structural (activation_kind);
          explicit authoring marker = optional same-candidate schema semantic
TEST_OR_CANARY = ABSENT — narrow authority candidate required (work-class field +
          feed/dispatcher filtering; no name heuristics)
NO_NEW_AUTHORITY_PLANES = confirmed feasible: gates consume the accepted directory
          authorities; no HR identity authority, no workflow-DB identity mapping,
          no second principal registry, no run-as/OBO, no global detail superuser.
```

## 7. Consequences for the lifecycle

> R2: superseded by §0 — one lane pair is pure adoption (identity admission: A+B),
> one lane is WAE adoption reuse (dispatch), and exactly one possible new semantic
> (TEST_OR_CANARY) proceeds MINIMAL_DESIGN → candidate only if absence remains proven
> (absence now sealed on current main). The r1 "two narrow authority candidates" line
> below is RETRACTED.

```text
AUTHORITY_AND_WRITE_PATH_CENSUS = COMPLETE (this document)
MINIMAL_DESIGN next inputs = §3.3/§3.5/§6 open items
AUTHORITY phase = REQUIRED (two narrow candidates: publish admission semantics;
          work-class semantics) — per GOAL AUTHORITY_POLICY (existing authority does
          not permit these two; everything else reuses accepted contracts)
IMPLEMENTATION homes = Gate A + work class → svc-workflow (+ broker mapping only if
          the model surface must carry the class); tests T1–T12 per REQUIRED_TEST_MATRIX
PRODUCTION phases = BLOCKED_BY the existing adoption windows (svc deployment window +
          WAE lane slot + privileged read-backs); no polling
GOAL_STATUS at end of census = ON_TRACK (census closed, two narrow authorities pending)
OWNER_ACTION_REQUIRED (now) = NONE — authority candidates follow the frozen
          candidate → independent semantic review → Owner exact-head acceptance route
PRODUCTION_APPLY_ALLOWED = NO (nothing to apply yet)
```
