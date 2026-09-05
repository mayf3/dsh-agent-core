# AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1 — independent review record

Review executed 2026-09-05 by an independent read-only reviewer agent
(agent_7e9d0f53) against the exact reviewed head. This record is the durable
transcript of that review; it is not itself acceptance authority.

## Coordinates

```text
REPOSITORY = mayf3/dsh-agent-core
REVIEW_KIND = SPEC
REVIEW_TARGET_HEAD = f3b11d78f4e38aa9f60caa0d9b3c5ce7dc6abfa2
BASE_HEAD = 1912d582888455a049838f376759b62f295b341b (== origin/main)
REVIEWER_ID = agent_7e9d0f53 (independent subagent, read-only)
AUTHOR_ID = mayf3
ASSURANCE_LEVEL = CONTROLLED
REVIEWED_AT = 2026-09-05
REVIEW_ROUND = 1 (first independent review; no prior audit round)
```

## Result

```text
SPEC_REVIEW = ACCEPT
AUTHOR_INDEPENDENCE = PASS
AUTHORITY_REVIEW = PASS
PRIMITIVE_BOUNDARY_REVIEW = NOT_APPLICABLE
CONTRACT_REVIEW = PASS
ACCEPTANCE_COVERAGE_REVIEW = PASS
MANDATE_SCOPE_REVIEW = PASS
EVIDENCE_REVIEWABILITY = PASS
UPSTREAM_PIN_CONSISTENCY = PASS (one-for-one vs auth candidate
  AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1 @ 0359575: YES; declared
  500/504 -> identity_resolution_unavailable grouping at the dsh broker
  boundary is fail-closed and never maps into missing/success)
BASE_IMPACT = NONE
BLOCKERS = []
SPEC_GAPS = [
  SPEC_GAP-1 (non-blocking) / CTR-EPAR-004 names `credential_missing` among
  "existing Broker" responsibilities, but the broker capability error table at
  base uses `credential_unavailable`
  (packages/broker/src/capabilities/agent-session-messaging.js:41);
  `credential_missing` exists only in agent-provisioning/shared-codex.js:35-36
  and agent-router/src/process/provider-errors.js:27. Substance (preserve
  credential-failure fail-closed responsibilities) unaffected; the new tool
  declares its own error table anyway. Closure: implementation preflight aligns
  the new capability manifest's error naming with the sibling ASM manifest.
]
FOLLOW_UPS = [
  At acceptance time, re-pin the final accepted Auth revision per the
  candidate's own §1 requirement (semantic movement => re-preflight).
  During implementation, align the new capability manifest's `local.resource`
  value with the auth-service registered audience_id
  `agent-principal-resolution` (gateway.js:252-261 passes
  manifest.local.resource into requestAccessToken).
  Optionally harmonize CTR-EPAR-004's `credential_missing` naming to
  `credential_unavailable` at the broker layer to match the sibling ASM
  manifest.
]
TOOLING_DEBT = [
  scripts/verify-code-structure.mjs FILE_MAX_LINES=500 with several base files
  already at/over limit (packages/agent-router/src/route-chain.js exactly 500,
  process-registry.js 495, binding-store.js 508, packages/broker/src/
  transport.js 690, capabilities/workflow.js 590) — the candidate's "keep
  capability data out of over-limit legacy files" constraint is correct and
  leaves effectively zero headroom in those files; new capability code must go
  into new focused files.
]
IMPLEMENTATION_ALLOWED = NO (waits Owner exact-head acceptance + merge)
MERGE_READY = YES
OPERATION_ALLOWED = NO
NEXT_ACTION = CONTINUE (Owner exact-head acceptance gate)
```

## Findings narrative (reviewer's check record)

1. Source observation accuracy — PASS. At base 1912d58:
   packages/agent-credential-provisioning/src/index.js:177-185 calls
   management.ensurePrincipal({external_ref: principalExternalRef(agentId),
   principal_type: 'agent', agent_id: agentId, ...}) — exact Agent Definition
   ID supplied to Auth. packages/agent-definition/src/definition.js:330-343
   getAgent doc + body: "Disabled agents resolve" and exact-id find returning a
   spread copy; :376-392 resolveAgentRef does exact-id first then
   case-insensitive display-name fallback (:384-391); :213 throws duplicate
   agent id (CORRUPT_CONFIG). packages/agent-router/src/ingress-delivery.js:280
   is exactly `agent = resolveAgentRef(agentRef)`. Substance accurate
   throughout. (Actual package is `agent-definition`, not `agent-registry`;
   candidate cites bare "definition.js" — shorthand-path nit only.)
2. TOCTOU validity — PASS. resolveAgentRef (definition.js:384-385) falls
   through the exact branch when the exact id is absent-or-disabled and matches
   by display name, so a previously-resolved ID deleted before send can match
   another Agent whose name equals the ID string — ingress-delivery.js:280
   resolves once at admission with no later re-resolve (the `agent` copy from
   :280 is used for all side effects at :302, :311-318, :324), so the family is
   precisely "name-fallback-capable admission resolution." CTR-EPAR-005's guard
   (exact ID + enabled at admission, resolved record ID == requested ID, fail
   before prompt byte/Session/run) changes only the resolution semantics inside
   deliver(); it touches no message field. ASM R2's three fields,
   authorization (gateway requiredScopes grant check, gateway.js:248-281),
   receipt (:455-469, :565-569), R12 commit order
   (production-runtime/src/agent-session-messaging.js:21-26) and no-replay
   (:527) untouched. The onIngress channel path uses binding.activeAgentId from
   resolveChannelConversation (ingress-delivery.js:64-75), not resolveAgentRef,
   so "general UI/name navigation unchanged" matches the code layout.
3. Upstream pin consistency — PASS. Verified against auth candidate at
   0359575: route GET /api/v1/agent-principals/:principal_id/agent (CTR-EAPR-002),
   audience agent-principal-resolution + scope auth.agent.resolve (CTR-EAPR-001),
   200 body exactly {"principalId","agentId"} (CTR-EAPR-003:162), errors
   PRINCIPAL_NOT_FOUND/IDENTITY_RESOLUTION_AMBIGUOUS/PRINCIPAL_NOT_AGENT/
   PRINCIPAL_DISABLED/AGENT_MAPPING_MISSING (CTR-EAPR-003), 500
   IDENTITY_RESOLUTION_QUERY_FAILED / 504 IDENTITY_RESOLUTION_TIMEOUT with
   5-second deadline (CTR-EAPR-004) — matching CTR-EPAR-002/003/004 one-for-one
   with the declared lowercase collapse that never maps to missing/success.
   UUID validation "as Auth's CTR-EAPR-002" matches the registered grammar.
   Auth candidate front matter status: proposed with matching spec_id.
   CTR-EPAR-002's "existing service-origin authority" corresponds to real
   accepted material: NOTIFICATION_INGRESS_SERVICE_AUTH_AND_IDEMPOTENCY_V1
   (status: accepted) fixes auth-service as the external HTTPS origin authority
   (:174, :304, :318), and the accepted provisioning spec freezes Auth as
   binding authority.
4. ASM non-interference — PASS. AGENT_CORE_AGENT_SESSION_MESSAGING_V1
   (accepted): R2 "Model-visible input is exactly three fields" with targetAgentId
   string required ^agt_[a-z0-9-]+$, 5..128 chars (:318-321) — the DEC/CTR
   claim that targetAgentId (not display name) is already the wire requirement
   is true (:375, :891). ASM :125 assigns target resolution to
   agentRouter.deliver (Router-owned), so the admission guard is a
   Router-policy repair, not an ASM schema change. Candidate grammar in
   CTR-EPAR-003 matches R2 exactly; production-runtime's own TARGET_AGENT_ID_RE
   confirms it.
5. Trusted credential seam realism — PASS. packages/broker/src/identity.js:
   identity acquired at a single seam and "The adapter NEVER reads identity
   from model input (tool parameters / prompt / header)"; no capability passes
   authorization via args today (gateway.js:26 child-supplied identity fields
   rejected; :294 "Forward the Parent-owned invocation context, not anything
   from args"). Local capability grant flow exists: manifest.requiredScopes +
   manifest.local.resource -> requestAccessToken({credential,
   authServiceOrigin, resource, scope}) with deny mapping
   credential_invalid/transport_failure/access_denied (gateway.js:248-281).
   Composed provider precedent: production-runtime/src/agent-session-messaging.js
   is an in-process trusted LOCAL provider with runtime-derived
   caller/correlation at the parent-RPC boundary (:13-27). A new read
   capability composes the same way with no new credential store.
6. Fail-closed completeness — PASS. Walked CTR-EPAR-001..007 against listed
   adversarial branches: wrong principalId in a 200 body (must match canonical
   requested UUID), extra response fields (exactly two), agentId grammar
   violation (ASM grammar, no rewriting), non-JSON/malformed body and 500/504
   (identity_resolution_unavailable, never missing/success),
   disabled-between-read-and-send (admission-time enabled check ->
   target_disabled, existing ASM error code, agent-session-messaging.js:45),
   no automatic retry/background resolver. Refresh-interleaving clause
   mechanically implementable: getAgent returns a defensive copy
   (definition.js:342) and reload() (definition.js:313-317) is synchronous
   within one event-loop tick (triggered only by the access.js mutation seam
   after a write), so either a coherently captured copy or a pre-side-effect
   revalidation is directly implementable.
7. Minimal privilege + scope — PASS. Whole file read-only: §2 non-goals and
   CTR-EPAR-001 enumerate zero writes; CTR-EPAR-006 bounds closure and forbids
   ASM core rewrite/scheduler changes/schema migration/refactor; no second
   identity store anywhere. CTR-EPAR-007 canary constraints match the master
   goal's LANE C rules; auth candidate (:188) symmetrically confirms "Lane A
   separately owns HR's send Grant."
8. Front matter + acceptance coverage — PASS. governed_by:
   AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 (accepted) and
   AGENT_CORE_AGENT_SESSION_MESSAGING_V1 (accepted) at docs/specs/;
   AGENT_CORE_PRODUCT_ARCHITECTURE_V1 exists at docs/ (frozen docs-only draft
   with authority amendment) and is already listed under governed_by by
   accepted-convention specs (e.g., docs/specs/AGENT_CORE_LARK_UX_PHASE1_V2.md:17).
   external_authorities shape matches the established four-key convention (cf.
   AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1). ACC-EPAR-001..006 cover
   CTR-EPAR-001..007: 7/7 is true — ACC-EPAR-003's Contracts column is
   "CTR-EPAR-003/004" and its method genuinely exercises both. §2 citations of
   the provisioning spec (:636-637, :662-674) verified accurate.
   CTR-EPAR-006's structure-verifier constraint consistent with
   scripts/verify-code-structure.mjs (FILE_MAX_LINES=500, registry
   .agents/structure-registry.json) and base files already at/over limit.
   OPEN_OWNER_DECISIONS = NONE justified (all four decisions name proposed
   owner mayf3 with acceptance as the Owner act).
9. Governance form — PASS. All sections present; observations reproduce via
   git show BASE:path — every load-bearing citation reproduced at base. Route
   fields consistent with status: proposed and the AGENTS.md gate. Diff is
   exactly one new 262-line docs file on base 1912d58 == origin/main; HEAD
   verified f3b11d7.

## Reviewer verdict statement

No blockers found. The candidate is internally coherent, its base observations
are accurate, its upstream pin is one-for-one against the auth candidate at
0359575, and its production gates and canary constraints match the master goal.
Recommendation: proceed to Owner acceptance; re-pin the Auth revision if the
auth candidate moves semantically before acceptance. This ACCEPT is the
independent review verdict only — Owner exact-head acceptance remains required.

## Final accepted-Head binding

```text
REVIEWED_SPEC_COMMIT = f3b11d78f4e38aa9f60caa0d9b3c5ce7dc6abfa2
FINAL_ACCEPTED_HEAD = (pending Owner acceptance)
ACCEPTANCE_ACTOR = (pending)
ACCEPTED_AT = (pending)
SEMANTIC_DELTA_AFTER_REVIEW = NONE (record commit is non-normative)
FINAL_HEAD_RECHECK = (at acceptance)
```
