# Internal Agent Directory Authority acceptance

Repository: mayf3/dsh-agent-core. Recorded at 2026-09-06 (batch exact-head acceptance).

Owner dispatch (WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1, CONTINUE_SAME_GOAL) recorded `OWNER_DECISION = BATCH_EXACT_HEAD_ACCEPTANCE = YES` accepting the exact reviewed head `7f620ad87ebadc9571eaf527bc370f259dfd9cc6` as the authority `AGENT_CORE_INTERNAL_AGENT_DIRECTORY_V1`, alongside batch siblings auth `f2b7d4c91ad657464816108062145ae95c21d686` (AUTH_SERVICE_INTERNAL_IDENTITY_DIRECTORY_V1) and svc-workflow `893d36f76702c307ee220dead717f64460b05f49` (SVC_WORKFLOW_CANONICAL_IDENTITY_RECONCILIATION_V2).

Basis: FINAL_HEAD_MECHANICAL_VERIFICATION (fresh independent read-only verifier): `FINAL_HEAD_VERDICT = ACCEPT`, `FINAL_HEAD_SEMANTIC_DRIFT = NONE`, `BLOCKER_UNION = []`, all seven checks PASS. Earlier chain: semantic audit ACCEPT_WITH_BLOCKERS → one bounded repair → fresh re-audit 0 SHIP_BLOCKERS → prescribed residual closure → Owner gate-closure freeze of the baseline directory policy.

Accepted semantics: exact Agent directory read `GET /v1/directory/agents/:agentId` returning exactly `{agentId, exists, enabled}` for any ACTIVE authenticated canonical internal AGENT/SERVICE caller (audience `agent-directory`, scope `agent.directory.read`, baseline entitlement through the existing provisioning machinery, no per-consumer lookup identities); the dedicated Workflow admission caller model (principal cedb954a-3d99-4e5a-b568-d312441bcc56, client svc-workflow-canonical-admission-v1, audience workflow-agent-admission, scope agent.definition.admission.read, 5s issued-at pin, observationDigest) is superseded and MUST NOT be provisioned or reintroduced (never was).

This transaction is lifecycle-only: successor accepted at the exact accepted head; predecessor AGENT_CORE_WORKFLOW_CANONICAL_ADMISSION_V1 superseded_by this authority. Zero normative semantic change. No production mutation occurred.
