---
spec_id: AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1
title: Workflow execution-class broker companion (create_instance executionClass passthrough + summary field)
status: proposed
spec_kind: implementation
authority_level: governing_spec
date: 2026-09-11
type: implementation-spec (one optional model-facing argument + its transport mapping + summary passthrough documentation; zero authority logic in the broker)
repo: mayf3/dsh-agent-core
base_head: be5a331 (github/main, re-fetched 2026-09-11)
implementation_authority: none
production_apply_authority: none
governed_by:
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1 (§21/§25 — the unified
    workflow_execute write tool whose create_instance schema this Spec extends)
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 (error-family passthrough)
  - AGENT_CORE_WORKFLOW_DEFINITION_AUTHORING_V4 (svc-workflow remains the sole
    business/security authority — DEC-002/CTR-WDA-008, unchanged here)
external_authorities:
  - repository: mayf3/svc-workflow
    authority_id: SVC_WORKFLOW_WORK_EXECUTION_CLASS_V1 (accepted @ c2cd6f5, Owner
      exact-head a62e12a — CTR-WEC-002 marking authority, CTR-WEC-004 summary
      visibility, CTR-WEC-006 broker companion DECLARATION; this Spec is the
      dsh-side counterpart that declaration names)
    relation: depends_on
supersedes: []
superseded_by: null
owners:
  - mayf3
---

# AGENT_CORE_WORKFLOW_EXECUTION_CLASS_BROKER_V1 — broker companion for the work execution class

## 1. Goal

Close the production tool surface for the accepted work-execution-class semantic
(CTR-WEC-006 of the svc authority): a model-facing harness must be able to mark a
newly created workflow instance `NON_BUSINESS_TEST` through the normal broker
create surface, and HR/global consumers must see the class in the summaries the
broker already returns. The broker gains ZERO authority logic — svc-workflow
enforces everything and fails closed.

The invariant: only an authorized (DOMAIN_OWNER per the svc authority) caller can
mark work non-business, ordinary callers regress byte-identically, and the broker
neither weakens nor hides any svc error family.

## 2. Scope and non-goals

In scope: one optional argument on `workflow_execute.op=create_instance`
(`executionClass`, closed enum `BUSINESS | NON_BUSINESS_TEST`, default-absent =
svc default BUSINESS); its `http.body` mapping entry; the descriptive field lists
for the domain/global instance summaries updated to document `execution_class`
(pass-through of the svc response — the broker does not project or filter it); a
broker schema test covering absent/present/invalid values and error passthrough;
structure-gate compliance.

Out of scope (frozen): no transition/cancel/archive/wake surface changes; no
assignee/identity parameters (the create surface remains identity-free — identity
travels only through the credential seam); no broker-side authority evaluation of
DOMAIN_OWNER (svc decides; the broker never judges role); no worklist or dispatch
surface change; no summary filtering or blocked state; no retry of any error;
no dsh-side deployment claim (production apply is separately gated end-to-end).

## 3. Decisions

DEC-WECB-001: passthrough-only. The broker validates SHAPE (closed enum, optional)
and forwards; svc is the sole enforcement point (CTR-WEC-002). A broker-side role
check would duplicate authority — forbidden. DEC-WECB-002: absent argument ⇒ the
mapped svc body OMITS `executionClass` entirely (wire-identical to today; no
`BUSINESS` literal is ever injected client-side, keeping request-hash identity
exact per CTR-WEC-002). DEC-WECB-003: an invalid enum value fails broker-side as
`invalid_arguments` BEFORE transport (structural validation, the same treatment as
every other schema-typed argument); svc-side unknown-string values still fail
closed with 422 for any non-broker caller. DEC-WECB-004: error passthrough is
byte-preserving per AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 — the frozen
create error table gains three DECLARED codes that are svc-owned and passed
through verbatim: 422 `invalid_input`, 403 `not_domain_owner`,
409 `idempotency_conflict` (the last already declared). DEC-WECB-005: summary
passthrough is documentation-only — the transport already returns the svc JSON
envelope, so `execution_class` appears automatically; only the documented field
lists change.

## 4. Contracts

### CTR-WECB-001 — create_instance argument

`workflow_execute.op=create_instance` accepts one additional OPTIONAL argument
`executionClass` (string, enum `BUSINESS | NON_BUSINESS_TEST`). Absent ⇒ the svc
body omits the field (DEC-WECB-002). Present ⇒ forwarded verbatim in the mapped
svc body (`http.body` list gains `executionClass`). No other argument, default,
or mapping changes. The argument is NOT identity and MUST NOT select caller
credentials or actor fields.

### CTR-WECB-002 — closed-enum structural validation

Broker-side `invalid_arguments` for any value outside the two-element enum,
rejected before transport (structural shape validation only — DEC-WECB-003).
This is a shape gate, not an authority gate.

### CTR-WECB-003 — error passthrough

The svc-owned error families 403 `not_domain_owner`, 422 `invalid_input`
(executionClass), and 409 `idempotency_conflict` pass through the broker envelope
verbatim with no rewriting, wrapping, retry, or classification change
(AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 discipline).

### CTR-WECB-004 — summary passthrough documentation

The documented field lists for `workflow_domain_instances` and
`workflow_global_instances` summaries gain `execution_class` (svc response
pass-through). The broker performs no projection, filtering, or renaming; absent
on pre-deploy svc binaries exactly as documented in the svc contract changelog
1.7.0 (deployment transition window).

## 5. Acceptance mapping

| ACC | Contracts | Method / environment | Expected / failure condition |
|---|---|---|---|
| ACC-WECB-001 | CTR-WECB-001/002 | broker manifest/schema unit tests, isolated | absent arg ⇒ mapped body has NO executionClass key; `executionClass:"NON_BUSINESS_TEST"` ⇒ forwarded verbatim; `"SOMETHING_ELSE"` ⇒ broker `invalid_arguments` before any HTTP |
| ACC-WECB-002 | CTR-WECB-003 | mapping/error-table tests + live error-table fixtures | the three declared codes pass through verbatim; no new broker-side classification/retry |
| ACC-WECB-003 | CTR-WECB-004 | summary passthrough tests against recorded svc payloads | `execution_class` appears when present; absent-field tolerated (transition window); no filtering |
| ACC-WECB-004 | all | structure verifier + full broker suite | structure gate PASS; no unrelated surface delta (exact diff review) |

Coverage: CTR-WECB-001..004 all covered; 4/4.

## 6. Alternatives and disposition

ALT-WECB-001 (broker-side DOMAIN_OWNER check before transport) — REJECTED:
duplicates svc authority in the broker; wrong layer (CTR-WEC-002 places the
governance decision in the svc transaction). ALT-WECB-002 (always send
`executionClass:"BUSINESS"` when absent) — REJECTED: injects a literal the caller
never supplied and perturbs svc request-hash identity for legacy receipts. 
ALT-WECB-003 (new dedicated marking tool) — REJECTED: surface multiplication; the
unified write entry exists precisely to keep the write face single.

## 7. Lifecycle

```text
OPEN_OWNER_DECISIONS = NONE
NORMATIVE_TBD = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE (the svc authority DECLARED this counterpart in CTR-WEC-006; nothing here amends svc semantics)
PARTIAL_SUPERSESSION = NONE (extends the §25 create_instance surface additively; the ASSIGNEE_TRANSITION authority is not superseded)
IMPLEMENTATION_READY = NO (activates on acceptance with implementation_authority: contracts)
PRODUCTION_READY = NO (production_apply_authority: none — deployment follows the svc-side adoption window)
```
