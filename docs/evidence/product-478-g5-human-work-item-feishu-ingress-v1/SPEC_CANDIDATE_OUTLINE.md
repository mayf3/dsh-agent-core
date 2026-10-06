# SPEC CANDIDATE OUTLINE — AGENT_CORE_HUMAN_WORK_ITEM_INGRESS_V1 (draft, NOT accepted)

> Status: `proposed (draft)` — authored inside the NON-PRODUCTION
> implementation lane per Product #478. This file is NOT in docs/specs/ and
> modifies NO accepted Spec. It is the candidate the Owner/reviewer path can
> promote to docs/specs/AGENT_CORE_HUMAN_WORK_ITEM_INGRESS_V1.md (with the
> full frontmatter + independent review) BEFORE this PR merges (merge-gate
> G2: no implementation merges without an accepted governing Spec).

spec_id: AGENT_CORE_HUMAN_WORK_ITEM_INGRESS_V1 (candidate)
spec_kind: implementation
scope: mayf3/dsh-agent-core — composition-level human work-item command seam
  (production-runtime) + additive agent-router published surface
governed_by (planned):
  - AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1 (reuse: the
    transition wire contract, trusted Idempotency-Key seam, error envelope)
  - AGENT_CORE_WORKFLOW_BROKER_ERROR_PRESERVATION_V1 (verbatim codes)
  - AGENT_CORE_WORKFLOW_HUMAN_PRINCIPAL_PROJECTION_V0 (canonical HUMAN
    test identity provenance metadata)
  - AGENT_CORE_LARK_CHANNEL_SDK_INTEGRATION_V2 / LARK_UX_PHASE1_V3
    (bridge pipeline + reply surface reuse)

## Frozen decisions (what the candidate will say)

1. Consumption rule (authorization boundary): a Feishu message is consumed
   iff channel=p2p ∧ text under the strict `/work` namespace ∧
   sender.openId is an EXACT key of the version-1 principals allowlist
   (array form; total fail-closed load; one executor identity per human;
   humanPrincipalId is provenance metadata, never authorization).
2. Actor: the canonical workflow actor is the allowlisted executor
   principal's credential (existing machine seam). The HUMAN principal is
   NOT the workflow actor — widening that requires an auth-service +
   svc-workflow identity-authority contract (explicitly future work;
   `principal_type=agent` verifier gate and agent|service MachinePrincipal
   enum are EXTERNAL authorities this Spec does not amend).
3. Actions: query/complete/reject ONLY through the existing broker gateway
   manifests (`workflow_my_tasks`, `workflow_instance_detail`,
   `workflow_execute transition`) with fresh-read CAS
   (expectedWorkflowStateVersion from the same action's detail read) and the
   exact svc-workflow RETURN submission contract for reject
   ({rootCauseNodeVisitId, reasonCode: 'HUMAN_REJECT', reason}).
4. Errors: stable downstream codes surface VERBATIM; never retried, never
   translated, never mapped (BUSINESS error preservation inherited).
5. Idempotency/duplicates: no seam-side state; bridge owns message dedup;
   broker mints the per-attempt Idempotency-Key; server CAS/receipts own
   duplicate semantics.
6. Provenance: canonical = svc-workflow workflow_events +
   workflow_command_receipts (actor = executor principal); ingress-side =
   closed JSONL rows at control/human-work-item-audit.jsonl (6-char openId
   prefix, receipt ids; size cap REQUIRED before any production promotion);
   success replies carry the canonical receipt ids.
7. Wiring: compose-level, default OFF (strict env HUMAN_WORK_ITEM_INGRESS_ENABLED
   ∈ {1,true}); requires HUMAN_WORK_ITEM_INGRESS_PRINCIPALS_FILE; every
   misconfiguration fails loud; fall-through returns the downstream outcome
   unchanged (bridge error contract preserved).
8. agent-router: ONE additive published surface `routeAuthenticated`
   (the exact bound onAuthenticatedFeishuIngress reference) for
   composition-level fall-through; the unauthenticated `route` is never used
   for channel fall-through.
9. Out of scope (frozen): Feishu interactive cards; human-actor token
   contract; executor credential provisioning (existing provisioning specs
   apply when the Owner authorizes it); production rollout; historical
   HUMAN-assigned visit migration.
