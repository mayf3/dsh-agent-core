# Governance Child Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the accepted case-to-child return protocol and verify it using the existing isolated workflow runner.

**Architecture:** Svc owns the immutable Assistance/child relation, terminal proof, review outbox, and explicit linked resolve. Core exposes one typed bind action and delivers a distinct review phase through the existing Owner-wake route. Existing WEC2 performs same-visit resume; neither component performs the original assignee's transition.

**Tech Stack:** Existing Rust/PostgreSQL svc-workflow; JavaScript Core Broker/product-api/production-runtime; existing Python/Node isolated runner.

**Spec:** Core `docs/specs/AGENT_CORE_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1.md` at merged `77963ad0a9862ca4df42fedb8840110de95e80ca`; Svc `docs/specs/SVC_WORKFLOW_GOVERNANCE_CHILD_RETURN_V1.md` at merged `eb4b4a67bfc51159efb609d5b700ded2b063f49f`.

## Global Constraints

- Both authorities are accepted in their owning main branches (Core PR #570; Svc PR #95).
- `production_apply_authority: none`; source and isolated validation only.
- One case has at most one child; one child has at most one case; one relationship layer only.
- Svc remains the sole business-state authority. Existing `workflow.execute` and actual current Domain Owner checks apply; no new grant.
- Bind only an existing nonterminal child in the same Domain, with an exact published terminal acceptance contract.
- Request-time source Context and bind-time child Context remain historical provenance; legitimate same-visit Context revision is allowed.
- A terminal child does not resolve a case. Owner explicitly reviews exact evidence and resolves or escalates.
- `supportingPayload` remains opaque in Broker. Svc enforces `governanceChildReview` only for linked cases.
- Unknown mutation results require authorized readback, not a new mutation or another child. Models do not receive trusted HTTP idempotency keys.
- Existing unlinked cases, initial wake DTO/dedupe, and WEC2/SWEC010 resume remain compatible.
- Child discovery and atomic create-and-bind are not implemented or claimed by this slice.
- Preserve the running A51 harness, candidate bundles, services, and homes. No shared main checkout writes.

## DEVELOPMENT_PREFLIGHT

`GOAL` = implement the accepted GCR/GCRS contracts and their required source tests, then isolated protocol validation.
`CURRENT_GAP` = accepted relation/review protocol has no implementation.
`AUTHORITY_ACTION` = REUSE; `PLAN_LEVEL` = EXEC_PLAN; `ASSURANCE_LEVEL` = CONTROLLED.
`ROUTE_STAGE` = IMPLEMENTATION; `AUTHORITY_ACCEPTED_IN_BASE` = YES.
`EXECUTION_MANDATE` = mayf3's explicit delegated decisions and instruction to continue generic unattended workflow implementation/verification; root directs isolated source work under that mandate.
`IMPLEMENTATION_ALLOWED` = YES; `PRODUCTION_OPERATION_ALLOWED` = NO.
`DONE_WHEN` = both source implementations pass meaningful checks/review, with exact isolated protocol outcome reported separately from business outcome.
`EXPANSION_TRIGGER` = missing normative decision, changed public authority/grant, or production effect; report the concrete dependency instead of inventing a new platform.

## Review Focus

1. Bind versus terminal transaction races must yield either definitive refusal or one durable review obligation; no lost wake.
2. Owner replacement before/after delivery, including switching back to a previous Principal, must preserve responsibility without replay suppression.
3. Missing/malformed selected-route envelopes must fail before transition; valid NOT_ACCEPTED and other terminal routes cannot resolve the source.
4. Same-visit Context repair must remain possible without changing the historical source request or acceptance contract.
5. Initial/unlinked compatibility and transport-unknown readback must remain usable through actual Broker tools.

## Task 1: Svc binding, proof, and durable review

**Workspace:** `/Users/yanfenma/workspace/worktrees/codex-assistance-resume-svc-contract-20261028`, branch `codex/governance-child-return-svc-impl`, base `eb4b4a67bfc51159efb609d5b700ded2b063f49f`.

**Files:** Existing domain/application/http Assistance modules; PostgreSQL `workflow_instance_repository/assistance_transaction`, current-task-input, transition transaction, outbox and `forum_sync`; existing provisioning Owner replacement transaction. Add focused governance-child modules and one next additive migration following the repository's migration ordering and structure guardrails. Extend existing Assistance/outbox/provisioning integration tests and add a focused governance-child integration test module.

**Interfaces:** Produce the exact GCRS bind POST, binding/terminal detail projection, child `governanceParent` projection, closed `GOVERNANCE_CHILD_REVIEW` Owner-wake payload, and linked resolve semantics. Consume the existing Core Owner-wake route; use the complete DTO in accepted Spec §5 verbatim, including recipient-bound `reviewWakeId`. Private helper names are implementation choices; do not change the public contract.

- [ ] Read governing Specs and local governance; emit repository-specific preflight. Record the exact initial head and test/database isolation setup.
- [ ] Add failing service-level tests for bind authorization/closed input/CAS, immutable request-event provenance, one-layer uniqueness, bind/terminal race in both orders, exact selected submission envelope, detail readback, and linked resolve rejection/acceptance. Include legitimate same-visit Context revision and unchanged unlinked resolve.
- [ ] Implement the additive relation, transactional admission, service-derived digest, and authorized projections with existing serialization/idempotency/error patterns. Add no historical backfill.
- [ ] Add failing durable-delivery tests for distinct initial/review identity, repeated terminal/drain retries, stale source, Owner replacement before/after 2xx and switch-away/back, and non-selected or NOT_ACCEPTED terminal outcomes.
- [ ] Implement terminal proof/outbox insertion in the real transition transaction, Owner replacement hook in the real replacement transaction, and current-authority reread/requeue in the existing drain path.
- [ ] Run focused tests during iteration, then the repository's required relevant suite, formatting and structure checks. Use only a fresh isolated test database. Record exact commands/results and unresolved limitations; do not claim runtime adoption.
- [ ] Self-review and commit a complete source candidate. Return report, commit range, and test evidence for independent review; do not merge or deploy.

## Task 2: Core typed bind and review delivery

**Workspace:** `/Users/yanfenma/.codex/worktrees/native-tool-policy-spec/dsh-agent-core`, branch `codex/governance-child-return-core-impl`, base `77963ad0a9862ca4df42fedb8840110de95e80ca`.

**Files:** `packages/broker/src/capabilities/workflow-assistance.js`; `packages/product-api/src/workflow-execution-routes.js`; `packages/production-runtime/src/workflow-execution-runtime.js`; their existing workflow-Assistance capability, API and Owner-wake tests. Add a small dedicated review-DTO/helper module only if required by existing structure guardrails.

**Interfaces:** Consume exact Svc GCRS §5 review DTO and binding/detail responses. Produce `workflow_assistance_action(operation=bind_governance)` with only `assistanceCaseId`, `governanceChildInstanceId`, `acceptanceTransitionId`, `expectedWorkflowStateVersion`, under existing authenticated transport. Preserve opaque supporting payload forwarding. Reuse existing Owner-wake route and service route authentication; create phase/recipient-specific request and correlation IDs as required by Core Spec §3.

- [ ] Read accepted pair and local governance; emit Core preflight before implementation. Preserve the plan file written by root.
- [ ] Add failing real capability/transport tests for typed bind mapping, required/extra fields, existing scope, response preservation, and unchanged unlinked resolve with arbitrary supporting payload.
- [ ] Implement the Broker action without manufacturing identities or adding credentials/grants. Existing read projections pass through the Svc binding and proof.
- [ ] Add failing route/runtime tests for closed initial-versus-review DTO, optional submission ID/digest pairing, invalid identities/digests/phase, canonical enabled Owner mapping, distinct initial/review dedupe, retry coalescing, and reassignment-specific request identity.
- [ ] Implement review wake delivery through the existing route/runtime and `inter_agent` origin. The Owner instruction must use actual existing read tools, exact event/submission references, explicit resolve/escalate, and readback on unknown mutation; no auto-transition or assumed service case-read permission.
- [ ] Run focused tests, then relevant existing Broker/API/runtime regression and structure checks. Record exact commands/results. Self-review and commit; return the source candidate for independent review without merge/deploy.

## Task 3: Paired review and isolated protocol validation

**Owner:** root coordinates; a separate reviewer checks each implementation. The existing runner operator remains the sole writer for test infrastructure.

**Files:** A fresh isolated harness copy after A51 completion; existing governance Definition DTO `/Users/yanfenma/workspace/artifacts/workflow-governance-reuse-readonly-20261028-v2.json`; task-owned run manifests/reports under `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/`.

**Interfaces:** Consume the exact reviewed Core/Svc candidate pair and the existing `hr-rd-definition-repair-v2` graph as a documented derived isolated fixture. Test the accepted existing-child binding segment; child creation/selection must not be mislabeled automatic.

- [ ] Obtain independent affected-contract and code-quality review of each exact source candidate; fix concrete blockers and recheck only affected deltas. Ensure real producer-shaped review DTO reaches the real Core consumer.
- [ ] Prepare a deterministic protocol integration run using real Svc transactions, Core Broker and Owner-wake route. Cover bind→terminal proof→review delivery→Owner exact evidence read→explicit resolve→original same-visit resume, plus negative race/identity/Context/compatibility cases from the Specs.
- [ ] For a native-model run, freeze candidates, definitions, inputs, grants and stopping conditions; use one initial trigger and no external per-node message/transition/resolve/escalation after cutoff. Preparation is supervised and must be reported separately.
- [ ] Preserve natural termination/cleanup, actual loaded-code pins and public tool/SQL/outbox evidence. Audit protocol, autonomous execution and business truth separately. Unknowns remain unknown; a legal human-decision wait is not business completion.
- [ ] Merge source only after review and relevant source checks pass under the user's existing mandate. Report exact acceptance extent and the remaining automatic-create/adoption boundaries. Do not deploy production.
