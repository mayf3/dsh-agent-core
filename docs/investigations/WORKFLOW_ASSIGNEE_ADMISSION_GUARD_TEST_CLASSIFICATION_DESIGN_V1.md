# WORKFLOW_ASSIGNEE_ADMISSION_GUARD_TEST_CLASSIFICATION_DESIGN_V1

MINIMAL_DESIGN r2 (evidence/design authority — NOT implementation authority; becomes
narrow authority candidate(s) only after independent design review PASS and
Owner-sanctioned acceptance).

```text
GOAL = WORKFLOW_ASSIGNEE_ADMISSION_GUARD_V1 · LANE_TEST_CLASSIFICATION
REVISION = r2 (Owner REVISE ruling 2026-09-11: B1–B7 applied; r1 superseded in full)
BASES = svc-workflow github/main dd235dc (fresh repin 2026-09-11) · dsh github/main b1fb7c0
ABSENCE_PRECONDITION = SEALED (census r2 §0: zero class markers in src/+migrations on
  dd235dc; WorkEligibility = {ACTIONABLE_NOW, WAITING_FOR_TIME} only; activation_kind
  is principal-type-derived)
```

## 0. r1 → r2 correction ledger (Owner B1–B6)

| # | r1 claim | r2 disposition |
|---|---|---|
| B1 | "any workflow.execute caller may mark NON_BUSINESS_TEST; SELF_LIMITING=YES" | **RETRACTED.** Marking = Workflow governance decision. WHO_CAN_MARK = enabled DOMAIN_OWNER only (§2). |
| B2 | optional marker ≈ structural guard ("marked test → excluded") | **INSUFFICIENT as claimed.** SUPPORTED_TEST_CANARY_INGRESS_CENSUS = REQUIRED and now DONE exhaustively (§3). Terminal proof target: SUPPORTED_NEW_TEST_CANARY_CREATED_AS_BUSINESS = 0. |
| B3 | "PINNED_ACCEPTED_SURFACES_TOUCHED = NO" | **RETRACTED.** Feed delta narrows the accepted result set of CTR-VAI-009 + CTR-DKC-002 ("unchanged predicate" is explicit frozen text). Authority route: the class candidate AMENDS both accepted specs — no silent override, no unrelated-spec bypass (§4). |
| B4 | instance-level object, thin enum, DEFAULT=BUSINESS | **CONFIRMED** with explicit additions: ZERO_SEPARATE_BACKFILL=YES; HISTORICAL_TEST_ROWS_AUTOMATICALLY_RECLASSIFIED=NO (存量测试垃圾归 WORKFLOW_DATA_HYGIENE_V1); forward-only compatibility only (§5). |
| B5 | HR/TEST visibility not addressed | **T11 STAYS IN GOAL** (it is in the frozen REQUIRED_TEST_MATRIX; Agent does not downgrade it). Closed with minimal positive visibility: `executionClass` added to the already-authorized domain/global safe summaries — class only, zero private detail; touches its accepted contracts → included in the same authority census (§4). |
| B6 | "broker arg decided at candidate freeze iff reviewer asks" | **RETRACTED.** BROKER_COMPANION_DELTA_REQUIRED = **YES**, decided now: broker `workflow_execute.create_instance` IS the normal production create surface, so production closure requires it to express authorized class marking (§6). |
| B7 | (process) | Authority candidate(s) will be authored docs-first on a CLEAN svc-workflow branch cut from github/main dd235dc — never on the mixed-history dsh evidence branch. dsh evidence referenced by exact commit hashes only (§7). |

## 1. The exact invariant this design serves (and nothing else)

```text
TEST_OR_CANARY work → MUST NOT enter the normal BUSINESS production dispatcher
NORMAL BUSINESS work → regresses zero
SUPPORTED_NEW_TEST_CANARY_CREATED_AS_BUSINESS = 0 (structural, provable)
```

Out of scope by Owner ruling: HUMAN_REQUIRED (already structural: principal-type →
activation_kind, CTR-VAI-004), UX display concerns, general taxonomy/framework, blocked
states, name/substring heuristics (never admission-relevant, in code or tests).

## 2. B1 — marking authority (EXACT)

Mechanical reuse census (dd235dc): the enabled-DOMAIN_OWNER in-tx predicate
`EXISTS(domain_role_bindings WHERE domain_id = instance.domain AND principal_id = caller
AND role_key='DOMAIN_OWNER' AND enabled=TRUE)` is the established governance check on
this repo — identical pattern at cancel_transaction.rs:285, archive_transaction.rs:264,
query_visibility.rs:43, query_detail.rs:69, assistance paths. Instance create today
requires only domain membership (validation_helpers::validate_domain_membership,
create_transaction.rs:248) — which is exactly why ordinary-member marking was rejected
in B1 (a member can create work assigned to ANOTHER principal and could otherwise
suppress it from the dispatcher forever).

```text
WHO_CAN_MARK_NON_BUSINESS_TEST =
  the caller holds an ENABLED DOMAIN_OWNER binding on the target domain,
  checked IN the instance-create transaction (same predicate as cancel)
WHO_CANNOT_MARK =
  everyone else — ordinary domain members, plain workflow.execute callers,
  WORKFLOW_ADMIN, GLOBAL_WORKFLOW_COORDINATOR (its accepted scope is the domain
  MANAGEMENT/control-plane surface; it does not cover creation-time classification,
  and it is NOT included by permission-magnitude reasoning), assignment targets,
  and any broker/model caller whose svc identity lacks the binding
ORDINARY CALLER CONTRACT =
  executionClass absent or BUSINESS → normal create (unchanged)
  executionClass = NON_BUSINESS_TEST without DOMAIN_OWNER → denied
  (403 not_domain_owner error family — exact wire code frozen in the candidate;
  403 preferred over 422 because the failure is authorization, not payload shape)
NEW_ROLE = NO · NEW_GRANT = NO · canary env guard NOT reused as authority
  (it is a deployment-global write gate, verified canary_guard.rs:25-40 — it
  classifies nothing and is orthogonal)
```

Rationale: the Owner's own already-trusted lifecycle governance role (cancel/archive/
authoring in that domain) is the narrowest existing authority that matches
"creation-time work-class governance"; marking is deliberately as privileged as
cancelling the same class of work.

## 3. B2 — SUPPORTED_TEST_CANARY_INGRESS_CENSUS (EXHAUSTIVE)

Mechanical basis: the ONLY writers of `workflow_instances` on dd235dc are (grep
`INSERT INTO workflow_instances`): the HTTP create transaction (create_transaction.rs)
and the legacy-import transaction (legacy_import_repository/transaction.rs). Every
ecosystem producer — broker `workflow_execute.create_instance` (model surface, skills,
harnesses), direct HTTP harnesses/conformance tests — funnels through the single HTTP
endpoint; there is no other create surface.

| Ingress | Produces test/canary work? | Classification (B2 taxonomy) |
|---|---|---|
| 1. `POST /internal/v1/workflow-instances` (broker model surface, skills, direct authorized callers, conformance/canary harnesses) | YES — this is where any supported test/canary instance would be born | **AUTHORIZED_TEST_CREATOR_MUST_EXPLICITLY_MARK** — a DOMAIN_OWNER-authorized creator marks NON_BUSINESS_TEST explicitly; unmarked ⇒ BUSINESS |
| 2. Legacy import (library-only; WORKFLOW_MIGRATION SERVICE binding; derived assignee must equal node resolution) | NO — imports pre-existing business snapshots | **OUT_OF_SCOPE_LEGACY_PRODUCER_WITH_EXPLICIT_DISPOSITION** — out of scope, creates BUSINESS, legacy garbage rows are WORKFLOW_DATA_HYGIENE_V1 property |
| 3. SERVER-FORCES classification | — | **UNUSED**: no current accepted mechanism can force class at create (canary guard verified to be an env-global write gate, not a per-request classifier). Kept in the taxonomy for completeness only |

```text
SUPPORTED_TEST_CANARY_INGRESS_SET = {1} (exhaustive for supported producers)
UNMARKED_SUPPORTED_TEST_INGRESS = 0 by construction once the candidate lands:
  every supported producer of test/canary work must ride ingress 1 and either mark
  (governed) or create BUSINESS work (which the dispatcher treats as business — the
  honest status quo, not a test guarantee)
SUBSTRING_INFERENCE = FORBIDDEN (titles/keys/domains/metadata text are never consulted)
```

## 4. B3 + B5 — affected authority map (SAME Goal, artifacts may be many)

The feed delta (`AND wi.execution_class = 'BUSINESS'` in the due set) is result-set
semantic narrowing of TWO accepted contracts:

- CTR-VAI-009 (SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1, accepted): due set = "active
  DISPATCH_INTENT activations with current nextEligibleAt <= authoritative now" —
  gains exactly one conjunct.
- CTR-DKC-002 (SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1, accepted): "The
  result set is the CTR-VAI-009 due set (**unchanged predicate** …) INTERSECTED with
  the exclusive keyset filter" — the class conjunct therefore amends this text too.

```text
AUTHORITY_ACTION = the svc-workflow class candidate carries EXPLICIT amendment
  sections for CTR-VAI-009 and CTR-DKC-002 (governance form: amend-in-candidate,
  precedent = coordinator-control-plane spec amending GLOBAL_WORKFLOW_READER_V1);
  no unrelated new spec silently overrides either
PRESERVED VERBATIM (frozen delta boundary):
  cursor ordering semantics unchanged · keyset continuation unchanged ·
  7-field row shape unchanged unless separately authorized ·
  GLOBAL_SCHEDULER_READ gate unchanged · zero-write feed unchanged ·
  WAE protocol unchanged (CTR-WAE-001b consumes the narrowed feed UNCHANGED)
ONLY feed delta = NON_BUSINESS_TEST excluded from the normal business due set
```

T11 closure (B5): `executionClass` is added, class-only, to the already-authorized
domain/global instance safe summaries so HR can positively classify
DISPATCHABLE / HUMAN / TEST_OR_CANARY / TERMINAL per the Goal's HR_DISPATCH_BOUNDARY:

```text
AFFECTED (read side) = SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1 (summary projection,
  exact field-list section amended in the same candidate) + the dsh-side broker
  capability family for field passthrough (companion delta, §6)
NO private detail, no cross-domain widening, no new read authority:
  the class is a Workflow-DB-owned fact on a summary the caller is already
  authorized to see
```

## 5. Data model (B4-confirmed; exact DDL/naming frozen in the candidate)

```text
workflow_execution_class ENUM('BUSINESS','NON_BUSINESS_TEST')          -- 0026
ALTER TABLE workflow_instances
  ADD COLUMN execution_class workflow_execution_class NOT NULL DEFAULT 'BUSINESS';
AUTHORITATIVE_OBJECT = workflow_instance (stamped in the create transaction)
CLASS_IMMUTABLE = YES (no UPDATE path; existing UPDATE writers untouched)
ZERO_SEPARATE_BACKFILL = YES (column default IS the compatibility story)
HISTORICAL_TEST_ROWS_AUTOMATICALLY_RECLASSIFIED = NO (hygiene goal owns legacy rows)
GENERIC_BUSINESS_CREATE_DEFAULT = BUSINESS
```

## 6. B6 — broker companion closure (DECIDED, not deferred)

```text
BROKER_COMPANION_DELTA_REQUIRED = YES
  broker workflow_execute.create_instance gains ONE optional passthrough arg
  (executionClass; absent ⇒ svc default BUSINESS). Broker performs zero authority
  logic — svc enforces DOMAIN_OWNER in-tx and fail-closed; the arg is not identity
  and touches no identity seam. Read side: domain/global summary passthrough of the
  single class field.
DECIDED NOW because broker create_instance is the normal production create surface;
without it only direct-svc harnesses could produce test-class work and the production
tool surface would not close.
```

## 7. Candidate routing (B7)

```text
MINIMAL_DESIGN r2 = this document (dsh evidence branch, exact commits referenced)
NEXT GATE = independent review OF THIS DESIGN (MINIMAL_DESIGN_REVIEW must be PASS
  with LOAD_BEARING_GAPS = 0)
THEN = author docs-first authority candidate(s) on a CLEAN svc-workflow branch cut
  from github/main dd235dc: the class spec (marking authority §2 + data model §5 +
  feed amendments §4 + summary amendment §4 + T5a–f/T11 test matrix) with the broker
  companion delta as its declared dsh-side counterpart. Exact-head acceptance route
  unchanged. dsh evidence branch stays investigation-only.
```

## 8. Discriminating tests (candidate matrix)

```text
T5a marked instance with due DISPATCH_INTENT → absent from business due feed
T5b marked instance + wake → 200 receipt, STILL absent from business feed, zero WAE admission
T5c unmarked instance → feed behavior byte-identical to today (regression zero)
T5d post-migration existing rows read BUSINESS (default, no backfill pass)
T5e unknown class value at create → 422 invalid_input, zero instance fact
T5f non-owner (incl. member, WORKFLOW_ADMIN, GLOBAL_WORKFLOW_COORDINATOR) marks →
    denied per frozen error family, zero instance fact
T5g DOMAIN_OWNER marks → instance created NON_BUSINESS_TEST (positive authority proof)
T5h marked instance fully visible/executable via its assignee worklist (targeted path intact)
T5i HR-safe summaries expose executionClass; a READER (no scheduler role) still sees class
T5j keyset sweep unchanged on a class-mixed window: cursor walk returns the identical
    BUSINESS row sequence as before the candidate (ordering/continuation preservation proof)
```

## 9. Completion-condition block (Owner's checklist, r2 values)

```text
AUTHORITATIVE_OBJECT = INSTANCE                    ENUM = BUSINESS | NON_BUSINESS_TEST
WHO_CAN_MARK_NON_BUSINESS_TEST = EXACT (enabled DOMAIN_OWNER of the target domain, in-tx)
WHO_CANNOT_MARK = EXACT (§2 — incl. WORKFLOW_ADMIN and GLOBAL_WORKFLOW_COORDINATOR)
SUPPORTED_TEST_CANARY_INGRESS_SET = EXHAUSTIVE ({HTTP create}; §3)
UNMARKED_SUPPORTED_TEST_INGRESS = 0 (structural once candidate lands)
GENERIC_BUSINESS_CREATE_DEFAULT = BUSINESS         CLASS_IMMUTABLE = YES
BUSINESS_FEED_EXCLUSION = EXACT (one due-set conjunct; §4)
AFFECTED_FEED_AUTHORITY_ROUTE = CLOSED (amend CTR-VAI-009 + CTR-DKC-002 in-candidate)
HR_SAFE_CLASSIFICATION_REQUIREMENT = CLOSED (executionClass in domain/global safe summaries)
BROKER_COMPANION_CLOSURE = DECIDED (REQUIRED=YES; §6)
ZERO_SEPARATE_BACKFILL = YES    HISTORICAL_RECLASSIFICATION = NO (hygiene owns legacy)
NEW_IDENTITY_AUTHORITY = NO     NEW_RETRY_ENGINE = NO     NAME_HEURISTIC = NO
NEW_ROLE = NO                   NEW_GRANT = NO           PINNED_SURFACES_TOUCHED = declared, amended, never silent
```
