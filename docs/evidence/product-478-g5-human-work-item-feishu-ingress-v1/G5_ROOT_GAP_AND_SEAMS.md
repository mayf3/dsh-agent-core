# G5 ROOT_GAP and smallest-seam design — Product #478

## ROOT_GAP (one sentence)

A Feishu human message has no authorized, identity-bound, non-session path to
the canonical workflow worklist/transition surfaces, and no token path exists
today by which the HUMAN principal itself could be the canonical workflow
actor — so the smallest honest seam binds the human's Feishu identity to an
authorized executor principal at the ingress and drives the EXISTING canonical
query/transition machinery through the EXISTING broker gateway.

## Why the actor is an executor principal (frozen for this lane)

- svc-workflow executes a transition ONLY as the token `sub`, and only if it
  equals the current visit's assignee (403 `principal_not_assignee`).
- auth-service cannot bind a MachineClient to a HUMAN principal (enum
  agent|service only), and svc-workflow's Auth V1 verifier only admits
  `principal_type=agent` claims — for direct AND OBO tokens.
- Therefore "the HUMAN principal's own UUID as workflow actor" requires a new
  identity-authority contract (auth-service minting + svc-workflow verifier).
  That is REMAINING work (see REMAINING_DONE_WHEN in the lane report); this
  lane does NOT impersonate, does NOT mint claims, does NOT touch either
  authority.

## The three seams (all in dsh-agent-core, one branch)

### S1 — Authorization binding (data, fail-closed)

`HUMAN_WORK_ITEM_INGRESS_PRINCIPALS_FILE` (JSON):

```json
{ "version": 1,
  "principals": [
    { "feishuOpenId": "ou_exact…", "executorAgentId": "agt_…",
      "humanPrincipalId": "8902db0d-429a-4e37-985c-f8b92d4b78fb" } ] }
```

- Exact string match on `ingress.sender.openId`; Map lookup; NO substring/
  prefix/case-fold inference (matches the data-hygiene "substring inference
  forbidden" rule).
- Loader is total-fail-closed: wrong version, duplicate openIds, missing
  fields, non-object → load error. When the feature is explicitly enabled a
  broken file FAILS LOUD at compose (misconfiguration must not silently run
  unmapped); when not enabled nothing is read.
- `humanPrincipalId` is REQUIRED provenance metadata (r2: the loader
  fail-closes on a missing/empty value — without it the durable trail would
  carry only a redacted openId prefix, which is not unambiguous human
  provenance; the canonical test identity per PROJECTION_V0); it is NEVER
  used for authorization and NEVER enters a gateway call payload.

### S2 — Command seam (strict grammar, p2p-only, fall-through default)

Grammar (exact, anchored, case-sensitive prefix `/work `):

```
/work help
/work query
/work complete <workflowInstanceId-uuid> [<transitionKey>]
/work reject <workflowInstanceId-uuid> <reason (rest of line, non-empty)>
```

- p2p text messages ONLY; group/thread NEVER handled.
- Consumption rule (the entire authorization boundary):
  handle ⟺ channel=p2p AND text matches the grammar AND sender.openId is in
  the allowlist. Everything else falls through byte-identically to the
  Router's authenticated callback (`routeAuthenticated`), so an unauthorized
  `/work …` message behaves EXACTLY as today (zero unintended production
  effects).
- A command-shaped message from an ALLOWLISTED sender with bad arguments gets
  a usage reply (consumed; no gateway call) — the human clearly intends a
  work-item action.

### S3 — Actions (all through gateway.execute with the executor agentId)

- query → `workflow_my_tasks {operation:'list', limit:10}`; formats
  `items[].detail` (snake_case wire) with instance id, node display name,
  state version and executable actions.
- complete → `workflow_instance_detail {read}` (fresh read) → pick executable
  ADVANCE transition (exactly one; if several, reply asks for
  `<transitionKey>`; if none, surface `blocked_reason`) →
  `workflow_execute {operation:'transition', workflowInstanceId,
  transitionDefinitionId, expectedWorkflowStateVersion}` (CAS; trusted
  per-attempt Idempotency-Key minted broker-side).
- reject → same detail read → executable RETURN transition → transition with
  `submissionPayload = {rootCauseNodeVisitId: <current_node_visit_id>,
  reasonCode: 'HUMAN_REJECT', reason: <user text>}` (svc-workflow RETURN
  contract, transition_validation.rs:376-436).
- Errors are NEVER translated or retried: the stable downstream code
  (`principal_not_assignee`, `workflow_state_version_conflict`,
  `source_node_terminal`, `instance_not_found`,
  `workflow_instance_not_found_or_not_visible`, `invalid_return_references`,
  `assistance_open`, transport codes…) is surfaced verbatim in the reply and
  audit row.
- Duplicate handling: same-message redelivery is deduped by the SDK/bridge
  layer BEFORE the seam; two distinct commands are two canonical attempts —
  the server's receipt replay / CAS / terminal rules make the outcome
  deterministic; the seam keeps no state (no parallel state machine).

### Provenance (r2-amended)

- Canonical/durable: svc-workflow `workflow_events` + `workflow_command_receipts`
  (actor = executor principal, in-transaction, replayable).
- Ingress-side durable: one closed JSONL command row per handled command at
  `<controlDir>/human-work-item-audit.jsonl` — `{ts, kind, commandId,
  openIdPrefix (6 chars; full openId never persisted), channel,
  humanPrincipalId, executorAgentId, originalMessageId, action,
  workflowInstanceId?, transitionId?, outcome, code?,
  canonicalOutcome? ('unresolved' only), eventSequence?,
  workflowStateVersion?, sourceNodeVisitId?, currentNodeVisitId?,
  submissionId?, currentContextRevisionId?, reasonCode?, rootCauseNodeVisitId?}`;
  secret-free. A reply delivery failure appends a linked
  `human_work_item_reply_failure` row (same identity + commandId + bounded
  error) — it never rewrites the command row.
- DURABILITY ORDER (r2): the command row is persisted BEFORE any Feishu
  reply attempt, so a reply failure can never erase, skip, or misclassify a
  known canonical success. Audit-sink write failures are returned (never
  swallowed) and surfaced truthfully: log line + a reply disclosure line —
  the canonical result itself is never rendered as a failure.
- The success reply carries the canonical receipt ids
  (`workflowStateVersion`, `sourceNodeVisitId`, `eventSequence`), binding the
  human action to the durable workflow receipt.

### Wiring (compose)

After `wireV2IngressGate`, env-gated:
`HUMAN_WORK_ITEM_INGRESS_ENABLED` (strict truthy: '1'/'true') AND
`HUMAN_WORK_ITEM_INGRESS_PRINCIPALS_FILE` present ⇒ install wrapper
(`feishu.setCallback(humanFirst → routeAuthenticated)`); otherwise the
callback chain is untouched (default OFF = byte-identical production).

## Explicit non-goals

Feishu interactive cards; human-actor token contract; production executor
credential provisioning; real-human rollout; historical visit migration;
group-chat flows; localization of the grammar.
