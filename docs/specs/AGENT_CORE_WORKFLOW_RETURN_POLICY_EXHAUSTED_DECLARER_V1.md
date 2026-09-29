---
spec_id: AGENT_CORE_WORKFLOW_RETURN_POLICY_EXHAUSTED_DECLARER_V1
title: Workflow RETURN-policy-exhausted broker declarer row (single svc-owned 409 code passthrough)
status: accepted
accepted_date: 2026-09-29
accepted_by: mayf3
accepted_reviewed_head: 18606722baa32900bfd4ee813bb6248564cb1732
independent_review: ACCEPT
independent_review_record: mayf3/agent-control#75 issue comment 5890655398
  (2026-09-29T12:50:21Z; SPEC_RECOMMENDATION = Accept at 18606722 with
  SEMANTIC_DELTA_AFTER_FINAL_REVIEW = NONE vs review semantic head c703d9ea;
  OWNER_ACCEPTANCE_READY = yes; 0 blockers)
independent_review_blockers: 0
acceptance_record: mayf3/dsh-agent-core#370 issue comment 5890714275
  (Owner ACCEPT_EXACT_HEAD 18606722baa32900bfd4ee813bb6248564cb1732,
  2026-09-29T12:54:04Z; acceptance limited to exactly one broker declarer row
  for svc-owned 409 return_policy_exhausted with verbatim error identity/status
  propagation and fail-closed behavior preserved for every other undeclared
  code; grants no production authority — accepted Spec must be present in the
  implementation base before the implementation PR merges)
spec_kind: implementation
authority_level: governing_spec
date: 2026-09-29
type: implementation-spec (one declared error row on the existing workflow_execute
  manifest transition family + its verbatim passthrough regression; zero broker
  authority logic, zero wire-contract change)
repo: mayf3/dsh-agent-core
base_head: 5c5f6ce6 (github/main)
implementation_authority: contracts
production_apply_authority: none
scope:
  - exactly one declarer row (code return_policy_exhausted, HTTP 409) added to
    the workflow_execute manifest transition-family errors table (DEC-RPE-002)
  - verbatim passthrough of that declared svc-owned code with the upstream HTTP
    status, sanitized detail and downstream x-request-id preserved; no broker
    rewriting, wrapping, retry, or classification (DEC-RPE-003)
  - fail-closed degradation to http_4xx/http_5xx preserved for every other
    undeclared service code (DEC-RPE-004)
governed_by:
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1 (the unified
    workflow_execute write tool whose transition-family declarer table this Spec
    extends by exactly one svc-owned row; its FOLLOW_UP_DEBT(2) requires a spec
    round for every declarer-table widening — this is that round)
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 (R1: declared service codes
    surface verbatim; undeclared codes fail closed to http_4xx — mirrored as
    DEC-006 of AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1)
  - AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1 (the owner-assistance feature slice
    whose svc-side counterpart introduced the RETURN-limit ingress)
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_EXECUTION_CONTROL_V1 (accepted; amendment merged
      as PR #68, canonical main 5d479d8 — deterministic 409
      `return_policy_exhausted` on the RETURN beyond the per-edge policy limit;
      error.rs from_transition: `E::ReturnPolicyExhausted { limit }` ->
      CONFLICT / code `return_policy_exhausted`; execute_transition.rs maps the
      store variant (409, "return_policy_exhausted"))
    revision: 5d479d834c098c301cd11993c5682c3b7da94480
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_RETURN_POLICY_EXHAUSTED_DECLARER_V1 — one declarer row for the RETURN-policy-exhausted service code

## 1. Goal

Make the real svc-workflow `409 return_policy_exhausted` refusal survive the
DSH broker end-to-end as the precise stable error code, instead of degrading to
the generic `http_4xx`, while changing nothing else.

Observed gap (evidence, non-blocking; both coordinates reviewable):
(1) docs/evidence/wec-owner-assistance-deploy-handoff-v1-20260929/HANDOFF.md
§2 Entry B2 — the WEC owner-assistance canary definition pins the expected
refusal: the NEXT RETURN beyond the per-edge limit ⇒ deterministic
`409 return_policy_exhausted`, no side effects. (2) The base-tree wire
degradation is mechanically reproducible: at base `5c5f6ce6` a
`return_policy_exhausted` response on the transition seam resolves to
`http_4xx` + 409 — running the CTR-RPE-004 regression against base fails RED
exactly there (declaration missing; passthrough yields `http_4xx`), and passes
with the declarer row. Fail-closed, HTTP status preserved, refusal
deterministic — but the model and the owner-assistance diagnostics lose the
code-level identity of a REAL, already-accepted svc behavior.

## 2. Non-goals (hard fences)

- NO change to RETURN attempt policy, budgets, limits, or retry semantics —
  the limit lives and is enforced solely in svc-workflow.
- NO change to the owner-assistance state machine (OWNER_PENDING / wake /
  resolve / escalate_to_human) — broker-side zero contact.
- NO change to HTTP status behavior: the svc status (409) is preserved
  verbatim by the existing transport; this Spec only stops the CODE rename.
- NO new error envelope capability: KEEP_MANIFEST_ONLY_ERROR_ENVELOPE holds
  (no structured `{limit}` details are retained broker-side; the sanitized svc
  message already carries the limit text).
- NO change to any argument, path, CAS, Idempotency-Key, scope, or grant.
- NO widening beyond this one code: every other undeclared service code keeps
  failing closed to `http_4xx`/`http_5xx` (regression-pinned).

## 3. Decisions

DEC-RPE-001 — declarer-only. The broker validates nothing and enforces
nothing new; svc-workflow is the sole authority for RETURN policy (mirrors
DEC-WECB-001 passthrough-only and CTR-003 of the transition Spec).

DEC-RPE-002 — exactly one new declared row on the `workflow_execute` manifest
transition family: `return_policy_exhausted`, description dictated from the svc
authority (`RETURN policy limit reached ... ; the loop escalates to a human`,
HTTP 409). No other family, manifest, or operation is touched.

DEC-RPE-003 — verbatim passthrough discipline per
AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1: declared code + upstream
HTTP status + sanitized detail + downstream x-request-id survive unchanged;
no broker rewriting, wrapping, retry, or classification. The refusal remains
terminal (exactly one downstream request).

DEC-RPE-004 — fail-closed preserved for the rest of the table: an undeclared
transition service code still resolves to the canonical `http_4xx` with the
status preserved. Declaring one real code does not wildcard the table.

## 4. Contracts

### CTR-RPE-001 — declarer row

The `workflow_execute` manifest `errors` table gains exactly one row:

```
{ code: 'return_policy_exhausted',
  description: 'RETURN policy limit reached for this edge; the loop escalates to a human (HTTP 409).' }
```

placed in the transition family after `invalid_return_references`. The
`transition` operation schema (arguments, required list, http binding) is
byte-unchanged.

### CTR-RPE-002 — verbatim passthrough

A svc response `409 {"error":{"code":"return_policy_exhausted",...}}` with an
`x-request-id` resolves through `invoke()` to the broker error envelope
`{code: 'return_policy_exhausted', status: 409, detail: <sanitized svc
message>, requestId: <x-request-id>}` — never `http_4xx`.

### CTR-RPE-003 — fail-closed negative

An undeclared service code on the same seam resolves to
`{code: 'http_4xx', status: 409, ...}` (canonical degradation unchanged).

### CTR-RPE-004 — test obligations

Focused regression at the real mapping/transport seam (mock svc-workflow HTTP
server + `createHttpTransport` + `wire()` + `definition.execute()`), covering
declaration freeze (CTR-RPE-001), verbatim passthrough (CTR-RPE-002), and the
fail-closed negative (CTR-RPE-003); plus the full broker package regression
with zero failures.

## 5. Acceptance

- Independent review + Owner acceptance of this proposal (status proposed ->
  accepted) gates the merge of the implementation riding this proposal. The
  implementation does not modify any existing governing Spec file
  (GOVERNING_SPEC_UNMODIFIED); the declarer-table widening is authorized by
  THIS Spec alone, per the transition Spec FOLLOW_UP_DEBT(2) rule that an
  implementation round must not widen the table on its own authority.
- PRODUCTION_APPLY_AUTHORITY = none: deployment/restart remains a separate
  authorization; this Spec and its implementation are non-production only.

## 6. Alternatives and disposition

ALT-RPE-001 — leave the code undeclared (status quo): rejected — a real,
accepted svc behavior loses its stable identity on the model-facing wire and
in operator diagnostics; the canary explicitly records the declaration as the
prescribed follow-up.

ALT-RPE-002 — broker-side structured retention of `{limit}`:
rejected — violates KEEP_MANIFEST_ONLY_ERROR_ENVELOPE (OBS-008); the sanitized
svc message already carries the human-readable limit.

ALT-RPE-003 — declare the whole svc error.rs family preemptively: rejected —
speculative surface without an accepted svc counterpart per code; exactly the
"自行扩表" the transition Spec forbids.
