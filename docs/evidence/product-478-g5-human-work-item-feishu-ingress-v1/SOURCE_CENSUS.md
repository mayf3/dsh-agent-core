# SOURCE_CENSUS — Product #478 (G5) fresh read, 2026-10-07

Bases: dsh-agent-core `origin/main` @ `d1e42f21` (branch
`product-478-g5-human-work-item-feishu-ingress`), svc-workflow `main` @ `88ff814`
(read-only reference), auth-service `main` @ `862ab3*` (read-only reference).

## 1. What already exists (REUSED, zero modification)

### Canonical Workflow (svc-workflow)
- Query: `GET /internal/v1/worklists/assigned-to-me` — actor derived ONLY from
  JWT `sub`; filters `assignee_principal_id = $1 AND node_type <> 'TERMINAL'
  AND cancelled = FALSE AND domains.enabled = TRUE`; limit default/max 20;
  cursor `(created_at, workflow_instance_id)`; response snake_case
  (`items[].detail.{instance, current_node_visit_id, current_visit,
  outgoing_transitions}`, `next_cursor`) — pinned by
  tests/17_workflow_runtime/http/worklists.rs:363-366.
- Transition write: `POST /internal/v1/workflow-instances/{id}/transitions` —
  `workflow.execute` scope; body camelCase `{transitionDefinitionId,
  expectedWorkflowStateVersion, submissionPayload}`; `Idempotency-Key` header
  mandatory; response camelCase `{workflowInstanceId, workflowStateVersion,
  sourceNodeVisitId, currentNodeVisitId, submissionId, eventSequence}`
  (src/http/dto.rs:50-63).
- Authz: assignee check is exact — `current_visit.assignee_principal_id !=
  Some(token sub)` → 403 `principal_not_assignee`
  (transition_transaction.rs:200-202); CAS stale → 409
  `workflow_state_version_conflict`; double-fire → `source_node_terminal`;
  RETURN submissions require `{rootCauseNodeVisitId (UUID of this instance's
  visit), reasonCode, reason[, relatedSubmissionIds]}` → else 422
  `invalid_return_references` (transition_validation.rs:376-436).
- Durable provenance (written in-tx): `workflow_events` with
  `actor_principal_id NOT NULL` + `command_id` + old/new state versions,
  `workflow_command_receipts` (UNIQUE (principal_id, idempotency_key), exact
  replay), `workflow_command_attempt_audits`.
- Verifier gate: BOTH direct (`token_use=access`) and OBO
  (`token_use=workflow_obo`) tokens require claim `principal_type == "agent"`
  (src/auth/jwks_verifier.rs:268-273, :364-369). OBO domain actor = `token.sub`
  (`act.sub` is audit-only).

### Broker gateway (dsh-agent-core main)
- `workflow_my_tasks(list)` GET passthrough, `workflow.read`
  (capabilities/workflow.js:62-88); `workflow_instance_detail(read)` GET
  passthrough (:90-118); `workflow_execute(transition)` POST with trusted
  per-attempt Idempotency-Key, `workflow.execute`
  (capabilities/workflow-execute.js:125-153). Envelope passthrough
  `{ok, result|error{code,status?,detail?,requestId?}}` — stable codes
  preserved verbatim.
- `gateway.execute(call, {agentId})` (gateway.js:225): credential lookup is
  exact-key by agentId in the 505-private store (`AGENT_CORE_CREDENTIALS_FILE`
  → `{version:1, credentials:{<agentId>:{clientId,clientSecret}}}`);
  per-agentId transport + token cache; caller identity NEVER from call
  payload; downstream origin/audience pinned (targets.js svc-workflow →
  127.0.0.1:8989). A non-child caller may call it with an explicit agentId
  (gateway.test.js:101-103 pattern).

### Feishu ingress (dsh-agent-core main)
- Bridge pipeline (feishu-connector/src/bridge.js:371-475): SDK
  normalize/dedup → normalizeToIngressEvent → self-echo drop → group
  fail-closed → requireMentionInGroup → PREBOUND_ONLY ingressGate (required,
  fail-closed) → `config.onEvent(ingress, {classify})`.
- IngressEvent carries `sender.openId`, `messageId`, `channel` ('p2p'|'group'|
  'thread'), `text` (bridge.js:144-173) — sufficient to authorize + parse.
- Outbound: `handle.reply(replyTarget, text, opts)` text-only by default
  (reply cards are eligibility-gated; NOT widened here).
- Router binds `feishu.setCallback(ingressDelivery.onAuthenticatedFeishuIngress)`
  (agent-router/src/index.js:308); published `router.route` =
  `onIngress` (UNauthenticated) — "share delivery mechanics but never share
  the authority to register provenance" (ingress-delivery.js:213-219).
- Compose order: feishu (env-gated) → applyRouter → wireV2IngressGate → …
  (production-runtime/src/compose.js:298-369) — the seam installs after the
  gate wiring, mirroring that pattern.
- Audit/evidence discipline: JSONL rows via appendFileSync under
  `layout.controlDir` (compose.js writeEvidence; paths.js:106-108); open_id is
  redacted to a 6-char prefix in existing logs (ingress-delivery.js:66).

## 2. What does NOT exist (the actual gap)

1. NO Feishu-triggered path to any workflow surface: no command grammar, no
   interception before the per-agent session turn, no
   feishu-openId → authorized-principal binding anywhere.
2. NO human-actor token path: auth-service `MachinePrincipal.principalType`
   enum is `agent|service` only (prisma/schema.prisma:93-96) → no MachineClient
   can belong to a HUMAN principal; OBO subject must be `principal_type=agent`
   (token-exchange.ts:30); svc-workflow rejects non-agent claims. ⇒ A HUMAN
   principal CANNOT be the canonical workflow actor today. Widening this is a
   cross-repo identity-authority contract change (auth-service + svc-workflow)
   — explicitly out of this lane (REMAINING).
3. NO inbound card/button callback surface (EVENT_SURFACE = MESSAGE_ONLY,
   feishu-connector/src/index.js:192-195).
4. NO durable provenance sink for human actions (only the generic JSONL
   evidence/audit discipline to follow).

## 3. Census verdict

Every load-bearing mechanism G5 needs EXISTS except three thin seams:
(a) an authorization binding (feishu open_id → executor principal) — data +
    fail-closed loader;
(b) a strict command seam on the existing bridge onEvent path (p2p only,
    fall-through otherwise);
(c) an additive published router surface (`routeAuthenticated`) so the seam's
    fall-through preserves authenticated-ingress provenance authority.

The canonical transition, CAS, idempotency, error preservation and durable
provenance are already fully provided by svc-workflow + the broker gateway.
