# WORKFLOW_ASSIGNEE_ADMISSION_GUARD_TEST_CLASSIFICATION_DESIGN_V1

MINIMAL_DESIGN (evidence/design authority — NOT implementation authority; becomes a
narrow authority candidate only after Owner-sanctioned review accepts it).

```text
GOAL = WORKFLOW_ASSIGNEE_ADMISSION_GUARD_V1 · LANE_TEST_CLASSIFICATION
DATE = 2026-09-11
BASES = svc-workflow github/main dd235dc · dsh github/main b1fb7c0
ABSENCE_PRECONDITION = SEALED (census r2 §0: zero class markers in src/+migrations on
  dd235dc; WorkEligibility = {ACTIONABLE_NOW, WAITING_FOR_TIME} only, BLOCKED-state
  invention forbidden; activation_kind is principal-type-derived, not class-derived)
```

## 1. The exact invariant this design serves (and nothing else)

```text
TEST_OR_CANARY work → MUST NOT enter the normal BUSINESS production dispatcher
NORMAL BUSINESS work → regresses zero
```

Out of scope by Owner ruling: HUMAN_REQUIRED (already structural via principal-type →
activation_kind; a HUMAN owner can never mint a DISPATCH_INTENT, CTR-VAI-004), UX display
of HUMAN_REQUIRED, any general taxonomy/framework, any blocked state, any name/substring
heuristic.

## 2. Answers to the ruling's six questions

```text
AUTHORITATIVE_OBJECT = the workflow INSTANCE (creation-stamped once, immutable after)
  not definition, not definition_version, no combination in V1.
  Why: the business dispatcher's single choke point is the due-feed predicate, which
  already joins workflow_activations → workflow_instances; the marker must be an
  execution truth of the WORK, and the instance-create transaction is the only moment
  work is born. Definition/version-level classification would add an authoring-surface
  semantic (who may publish a "test version") and a hotter feed join for zero
  additional safety; if ever needed it is a narrow extension of the same enum, not a
  redesign.

PROPAGATION = stamped inside the instance-create transaction (the same tx that resolves
  the entry assignee and mints the activation); thereafter immutable — workflow_instances
  gains no UPDATE path for it, and all existing UPDATE writers (cancel/archive flags,
  state-version CAS) are untouched. Downstream consumers read the stamped value:
  the due-feed predicate excludes non-business rows; nothing recomputes or overrides it.

DEFAULT_FOR_EXISTING_BUSINESS = the column is NOT NULL DEFAULT 'BUSINESS'.
  Every existing row and every un-marked future instance IS business work; zero
  backfill, zero behavior change for unmarked callers.

NON_BUSINESS_TEST_SEMANTIC = an explicit machine-readable marker carried on the
  instance-create request (optional body field; absent ⇒ BUSINESS), stored as a
  two-value enum. TEST_DATA_POLICY compliance: harnesses mark explicitly; the marker
  is the ONLY admission-relevant authority — titles, keys, metadata text, external
  references are never consulted. Naming (e.g. execution_class ∈ {BUSINESS,
  NON_BUSINESS_TEST}) is frozen in the candidate spec, not assumed here.

NORMAL_BUSINESS_DISPATCH = the accepted due-feed contract gains exactly one predicate
  conjunct: only BUSINESS-class instances' DISPATCH_INTENT activations are returned.
  This is the single enforcement point the WAE consumer already depends on
  (CTR-WAE-001b consumes the feed UNCHANGED); marked work therefore cannot be
  admitted, cannot mint a Run, and cannot be woken into the business path
  (a wake on a non-business activation can still append an eligibility event, but the
  business feed will never return that row — inert by construction).

TARGETED_CANARY_EXECUTION = remains possible WITHOUT new machinery: today's accepted
  canary semantics (env-guarded canary write surface, canary database) and every
  existing explicit execution path (a harness reading its own worklist and executing;
  wake-by-ID + a hypothetical future explicitly canary-scoped consumer) are unaffected,
  because the invariant excludes marked work only from the AUTOMATED BUSINESS feed.
  If a future accepted consumer needs an automated canary lane, that is a separate
  narrow delta on that consumer — not part of this candidate.
```

## 3. Minimal data model (preview only; exact DDL frozen in the candidate)

```text
CREATE TYPE workflow_execution_class AS ENUM ('BUSINESS','NON_BUSINESS_TEST');   -- 0026
ALTER TABLE workflow_instances
  ADD COLUMN execution_class workflow_execution_class NOT NULL DEFAULT 'BUSINESS';
-- DB-owned structural fact ⇒ legitimate DATABASE_GUARDS fit (CHECK is inherent in the enum)
```

Surface delta (all svc-side in V1):
1. `POST /internal/v1/workflow-instances` body: optional `executionClass` enum field,
   default BUSINESS, rejected with 422 invalid_input on unknown values.
2. instance-create tx stamps it; no other writer.
3. `query_dispatch_intents` due predicate adds `AND wi.execution_class = 'BUSINESS'`.

Explicitly NOT touched in V1 (each is a pinned accepted surface; expanding any of them
requires its own amendment and is not needed for the invariant):
- the 7-field dispatch-intent feed row shape (SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1),
- domain/global instance summaries (SVC_WORKFLOW_GLOBAL_WORKFLOW_READER_V1 family) —
  HR visibility of test work is therefore "absence from business surfaces", which is
  exactly the safety property; a summary class field is a candidate follow-up ONLY if a
  future accepted HR contract requires positive identification,
- WorkEligibility projection (stays two-variant, no blocked state),
- WAE V2 engine bytes (consumer unchanged),
- activation_kind semantics (HUMAN/AGENT stays principal-type-derived).

Broker/model surface: marking from model-driven harnesses needs an optional passthrough
arg on broker `workflow_execute.create_instance` — the ONE known companion delta; it
carries no identity and no dispatch semantics of its own. V1 minimum ships svc-side
(conformance harnesses hit svc directly); the broker arg joins the candidate's closure
iff the review requires model-surface parity, decided at candidate freeze — not a
second candidate.

## 4. Authority / abuse analysis

- Who may mark NON_BUSINESS_TEST: any caller already holding workflow.execute on the
  domain (no new grant). The only capability marking grants is EXCLUDING one's own new
  instance from automated business dispatch — self-limiting, no privilege direction,
  no way to move someone else's work out of dispatch (creation-only field).
- No cross-service fact: the class is a Workflow-DB-owned fact (unlike canonical Agent
  existence), so the enum/CHECK belongs in the Workflow migration path — consistent
  with NO_NEW_AUTHORITY_PLANES and with the census DATABASE_GUARDS split.
- No second dispatch gate, no retry engine, no consumer change: enforcement = one
  feed predicate conjunct.

## 5. Discriminating tests (T5 family for the candidate's matrix)

```text
T5a marked (NON_BUSINESS_TEST) instance with due DISPATCH_INTENT → absent from feed
    (mechanical: same window returns it with class BUSINESS control present)
T5b marked instance + wake applied (200 receipt) → STILL absent from feed, zero WAE admission
T5c unmarked instance → feed behavior byte-identical to today (regression zero)
T5d existing rows post-migration → all read BUSINESS (default backfill-free)
T5e unknown class value at create → 422 invalid_input, zero instance fact
T5f marked instance is fully visible/executable through its assignee worklist
    (targeted execution path intact)
```

## 6. Candidate routing

```text
MINIMAL_DESIGN = COMPLETE (this document)
next = narrow authority candidate (svc-workflow spec, e.g.
       SVC_WORKFLOW_WORK_EXECUTION_CLASS_V1) containing the exact enum name/DDL,
       request-field contract, feed-predicate contract, and the §5 matrix
       → independent semantic review → Owner exact-head acceptance
IDENTITY_ADMISSION_READY / TEST_CLASSIFICATION_READY signals: unchanged (NO / NO);
  TEST_CLASSIFICATION_READY flips to YES only at accepted+merged+deployed candidate
```
