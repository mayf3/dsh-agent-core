# DEVELOPMENT_PREFLIGHT — Product #478 (G5 Human Work Item Feishu action ingress)

```text
DEVELOPMENT_PREFLIGHT

Problem =
  Authorized Human principal cannot act on canonical Workflow work items from
  Feishu. svc-workflow already owns the canonical worklist query
  (GET /internal/v1/worklists/assigned-to-me) and transition write
  (POST /internal/v1/workflow-instances/{id}/transitions; CAS
  expectedWorkflowStateVersion + mandatory Idempotency-Key + durable
  provenance in workflow_events / workflow_command_receipts), and the broker
  gateway already exposes both as workflow_my_tasks / workflow_instance_detail /
  workflow_execute(transition). But NO path exists from a Feishu human message
  to those surfaces: every inbound Feishu message is routed into a per-agent
  DSH session turn, there is no Feishu-identity → authorized-principal
  binding, and no human-action ingress exists.

Governing Spec =
  NO accepted Spec yet covers a human work-item ingress (this is exactly why
  Product #478 sat in deferred Epic G). This lane REUSES — without amending —
  these accepted authorities:
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1 (accepted
    2026-08-29): broker workflow_execute(transition) wire contract, trusted
    Idempotency-Key seam, error-envelope preservation, identity travels only
    via the credential seam (never model input).
  - AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0 (accepted 2026-09-14):
    canonical HUMAN principal 8902db0d-429a-4e37-985c-f8b92d4b78fb is the
    Owner-authorized test identity (ACCEPTANCE_MODE=TEST_IDENTITY).
  - AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 / LARK_UX_PHASE1_V3: the
    feishu-connector bridge pipeline (normalize → self-echo → group gate →
    PREBOUND_ONLY ingressGate → onEvent) and text-reply surface this lane
    extends compositionally.
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1: downstream stable error
    codes surface verbatim; never translated or retried.

Spec status =
  GOVERNING = accepted (the reused surfaces above). For the NEW seam:
  Need new/amended Spec = YES — a candidate spec outline is included in this
  evidence directory; the PR stays UNMERGED until the Owner/spec path accepts
  it (merge-gate G2). Non-production lane per #478 (PROD_AUTH=NONE,
  ACCEPTANCE_MODE=TEST_IDENTITY); the owner command-bus instruction
  (agent-control#492) authorizes exactly this bounded implementation/test/
  review lane with do-NOT-merge.

Relevant investigations =
  - docs/investigations/WORKFLOW_ASSIGNEE_ADMISSION_GUARD_CENSUS_V1 (writer
    census discipline reused for the zero-production-effect argument)
  - fresh census in SOURCE_CENSUS.md (this directory): svc-workflow main
    @ 88ff814 HTTP/authz/idempotency/provenance surface; dsh-agent-core main
    @ d1e42f21 feishu-connector bridge, agent-router delivery, broker gateway
    manifests, compose wiring.

Relevant decisions =
  - WORKFLOW_TRANSITION_WRITE_PATH_FLEET_OPEN_V1 (docs/decisions,
    2026-09-02): workflow.execute write path is fleet-open; effective writers
    = workflow.execute grantees.
  - WORK_ELIGIBILITY §3 (amend-by precedent for shared-struct closure; cited
    by the admission-guard design line).

Previously rejected alternatives =
  - None rejected for G5 itself. Explicitly NOT REOPENED here: any
    human-impersonation token path (minting tokens whose sub = a HUMAN
    principal): auth-service MachinePrincipal.principalType enum is
    agent|service only (prisma/schema.prisma:93-96) and svc-workflow's Auth V1
    verifier rejects principal_type != "agent" (jwks_verifier.rs:268-273,
    :364-369) — widening that is a NEW identity-authority contract, out of
    this lane, listed as REMAINING work, not silently assumed.

Frozen boundaries =
  - Actor of the canonical transition = the principal of the allowlisted
    executor credential (AGENT-type, machine seam) — NOT the HUMAN principal.
    The human's authorization is bound at the ingress (frozen allowlist of
    feishu open_id → executorAgentId); durable human-action provenance =
    ingress audit JSONL (redacted open_id prefix) + the canonical
    svc-workflow receipt ids returned in the reply.
  - p2p text messages only; strict `/work` grammar; anything else (including
    `/work` text from a NON-allowlisted sender) falls through to the Router
    byte-identically. Zero default production behavior change: the seam is
    installed only when HUMAN_WORK_ITEM_INGRESS_ENABLED is explicitly truthy.
  - No new ingress platform, scheduler, DB, workflow engine, governance
    layer, or parallel state machine. No work-item numbering session state.
  - This PR must NOT modify any existing accepted Spec file.

Implementation scope =
  - packages/production-runtime/src/human-work-item-ingress.js (NEW seam
    module: grammar parser, allowlist loader, action handler, wiring fn)
  - packages/agent-router/src/index.js (ADDITIVE published surface
    routeAuthenticated = ingressDelivery.onAuthenticatedFeishuIngress so the
    composition wrapper can fall through WITHOUT losing authenticated-ingress
    provenance authority)
  - packages/production-runtime/src/compose.js (optional env-gated wiring
    step, mirroring the V2 ingress-gate pattern; disabled by default)
  - packages/production-runtime/test/human-work-item-ingress.test.js
    (RED-first matrix)
  - evidence docs in this directory

Out-of-scope =
  - svc-workflow / auth-service changes (human-actor token contract)
  - Feishu interactive cards / card.action.trigger inbound callbacks
  - production credential provisioning for any executor principal
  - production deploy/restart/install; PR merge; real-human Feishu rollout
  - historical reclassification or migration of existing HUMAN-assigned
    visits (e.g. the exact-17 normalization set)

New evidence =
  - See SOURCE_CENSUS.md: svc-workflow auth chain (auth-service principal_type
    enum, svc-workflow verifier agent-only gate) proves the HUMAN-principal-
    as-actor path does not exist today; the executor-principal seam is the
    only change that reuses 100% existing mechanisms.

Need new/amended Spec = YES (candidate outline included; merge gated on its
acceptance — implementation in this NON-PRODUCTION lane proceeds under the
owner command-bus instruction with do-NOT-merge).
```

## r2 delta preflight — PR #492 integration-review repair (same Product, same PR)

```text
DEVELOPMENT_PREFLIGHT (r2, bounded repair)

Problem =
  Parent read-only integration review of exact PR #492 head eee7535
  (recorded on agent-control#492) identified two load-bearing gaps in the
  seam this PR introduces:
  G1. The canonical success receipt was audited only AFTER the Feishu reply.
      A reply failure routed a KNOWN canonical success into the generic
      internal_error path (misclassification + lost receipt); a second
      reply failure skipped the audit row entirely; audit-write failures
      were silently swallowed.
  G2. Audit rows carried only a 6-char openId prefix — no humanPrincipalId,
      no executorAgentId, no original messageId, no canonical
      submission/source-visit linkage — so durable human provenance was
      not unambiguous.

Governing Spec = unchanged (same REUSE set as r1; no accepted Spec file is
  touched). The two gaps are defects inside the NOT-YET-ACCEPTED candidate
  surface (human-work-item-ingress.js + its evidence docs), repaired under
  the same owner command-bus mandate (agent-control#495, claim
  g5-feishu-review-fix-r323, Product #478 round 323: "SAME-Product
  continuation — PR #492 integration-review repair").

Authority action = REUSE (no accepted Contract meaning changes; the
  candidate spec outline is amended BEFORE acceptance — the amendment
  narrows/strengthens the candidate's own provenance and ordering clauses;
  actor semantics stay exactly as r1 froze them).

Actor contract (RE-FROZEN, honesty guard) =
  The canonical workflow ACTOR remains the allowlisted executor principal's
  credential (agentId-keyed gateway context). humanPrincipalId is REQUIRED
  allowlist metadata for unambiguous durable provenance of the requesting
  human; it NEVER reaches the gateway call payload and NEVER becomes the
  workflow actor. No Human-principal canonical actor semantics are claimed
  anywhere; exact-assignee semantics remain server-authoritative.

Implementation scope (r2) =
  - packages/production-runtime/src/human-work-item-ingress.js
    (audit-before-reply ordering on every handled path; reply delivery
    isolated so it can never erase/misclassify a canonical result; audit
    sink failures returned — not swallowed — and truthfully surfaced in
    log + user reply without fabricating transition failure; commandId
    linkage; provenance identity/linkage fields on every row; loader
    requires humanPrincipalId)
  - packages/production-runtime/test/human-work-item-ingress.test.js
    (RED-first: canonical-success+reply-failure, audit-failure, duplicate
    retry after reply failure, provenance identity/linkage, real-sink
    failure surfacing, loader tightening)
  - evidence docs in this directory (review record r2, RED_GREEN matrix,
    spec-candidate outline amendment, publish packet head update)
  NO other surface (compose.js, agent-router, feishu-connector, broker)
  is modified; default OFF and the authorization boundary are untouched.

Out-of-scope (r2) = same as r1, unchanged. No merge, deploy, restart,
  provisioning, credential, data mutation, or production enablement.

DONE_WHEN (r2) =
  New RED-first tests pass (GREEN after the fix), full lane suite GREEN,
  focused regressions match the r1 pre-existing-failure baseline,
  independent changed-surface review of the repair reports no load-bearing
  gap, PR #492 updated at a new exact head (still DRAFT, not merged).
```
