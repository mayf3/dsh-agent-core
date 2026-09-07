# AGENT_SESSION_SEND_RELIABILITY_V1 — Production Truth, Authority Recovery, and Root Cause (Phase 1)

- date: 2026-09-08
- goal: AGENT_SESSION_SEND_RELIABILITY_V1 (RESUME_GOAL, phase-locked to PRODUCTION_TRUTH_AND_EXISTING_AUTHORITY_RECOVERY)
- fresh-truth refs: `origin/main @ 1cde3cc` (Merge PR #200), live production tree `/usr/local/libexec/agent-core/app` (deployed 2026-09-05 07:02)
- production mutation: **NONE** (read-only truth + isolated in-process probes only)
- probe: [`probe/discriminating-failure-injection.mjs`](probe/discriminating-failure-injection.mjs) · output: [`probe/RUN_OUTPUT.txt`](probe/RUN_OUTPUT.txt)

## 1. Verdict (one paragraph)

The observed production `reply_unavailable` is **NOT a delivery ambiguity**. Mechanically, in both the
accepted Authority and the deployed bytes, `reply_unavailable` is created ONLY after the target inbox
receipt was proven (`receipt.accepted === true`), during reply-wait settlement. It therefore always
already means `DELIVERY = DELIVERED`. The production blocker is **expression + consumption** (root-cause
class A): the caller-visible envelope does not carry a delivery dimension, and the model-visible render
even drops the structured `reason` (truncated / no_output / evicted / restart_lost / never_existed), so
HR cannot read what the system already knows and (correctly) refuses to guess. Separately, the probe
proves a second, genuinely-uncertain seam: a lost parent-RPC response surfaces as `outcome_unknown`
(`parent_rpc_ambiguous`) with **no bounded reconciliation**, even though the receipt facts exist
parent-side — the exact seam SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 §5.2 closed for scheduler
mutations, deliberately left verbatim for session send ("outside this spec's scope"). That gap is a new
normative semantic (CASE A/G bounded reconciliation + requestId anchor) and requires a docs-only Spec
amendment before implementation.

```text
ROOT_CAUSE_CLASSIFICATION = A   # reply_unavailable already = DELIVERED; expression/consumption defect
SECOND_SEAM (distinct)    = outcome_unknown has no bounded reconciliation (goal CASE A/G unmet)
DEPLOYMENT_REGRESSION     = NO  # live session-send chain is byte/semantically equal to origin/main
```

## 2. Current Authority (fresh-recovered, none rewritten)

| Artifact | Status | Role |
|---|---|---|
| `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V1` | **accepted r3** (2026-09-02, `accepted_reviewed_head eaa3e3d9`, review PASS) | capability semantics authority (implementation_authority: contracts) |
| `docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_DEPLOYMENT_V1` | accepted r3 (2026-09-04 amendments) | authority OF RECORD for the paused Lane B generation; its 28-file closure marked STALE by the standalone ruling |
| `docs/specs/AGENT_SESSION_SEND_STANDALONE_DEPLOYMENT_AUTHORITY_V1` | **accepted r2** (2026-09-05) | CURRENT deployment authority (standalone; no fleet/forum/history bytes); production_apply_authority: contracts |
| `docs/decisions/AGENT_WORKSPACE_SESSION_MODEL_V3`, `docs/decisions/AGENT_SESSION_CHANNEL_MODEL_V1` | on main | decision alignment (target = canonical main; one send = one new Run/Turn) |
| external: `mayf3/auth-service` `AGENT_SESSION_SEND_OPERATIONAL_GRANT_V1` | PR #50 merged | grant authority (`agent.session.send`) |

Prior lifecycle NOT redone: PR #130 closed obsolete; implementation landed via the 会话 修复 chain
(relay blob `2ec4acf` = commit 8258acb); deployments 2026-09-03/09-05; A2A canary PASS recorded under
the ASM standalone goal.

## 3. Live bytes vs accepted implementation (mechanical hash comparison)

Deployed tree `/usr/local/libexec/agent-core/app` (root-owned, files 2026-09-05 07:02) vs `origin/main` blobs:

```text
MATCH  packages/broker/src/capabilities/agent-session-messaging.js   (manifest, §5 error table)
MATCH  packages/production-runtime/src/agent-session-messaging.js     (trusted handler)
MATCH  packages/production-runtime/src/agent-session-reply-wait.js    (R9 waiter + R8 mapping)
MATCH  packages/production-runtime/src/agent-session-messaging-audit.js (L0/L1 evidence)
MATCH  packages/agent-router/src/process/turn-execution.js            (FIFO queue, receipt minting)
MATCH  packages/agent-router/src/reconciliation/ (state machine)      (via query.js semantics check)
MATCH  packages/demo-server/src/session-seam.js                       (messageOrigin → inter_agent source)
DIFF→semantic-equal  packages/broker/src/relay.js                    (live = 会话 修复 blob 2ec4acf; the 184-line
                                                       delta vs main is scheduler-only: SCHEDULER_MUTATIONS
                                                       export, reconcileAfterLostResponse, evidence file.
                                                       Session-send paths (uncertainSessionSend /
                                                       ambiguousError / validSessionSendResult /
                                                       validDeclaredFailure) are preserved verbatim; live
                                                       ternary form produces the identical outcome_unknown
                                                       envelope for the send loss path.)
DIFF→main-ahead      packages/broker/src/gateway.js, transport.js, production-runtime/src/compose.js,
                     agent-router/src/ingress-delivery.js (comment-only)   # scheduler gate / sanitizer
                                                       extraction / workflow admission / overrides v3 —
                                                       none touch the session-send chain
```

```text
LIVE_IMPLEMENTATION_EQUALS_ACCEPTED_AUTHORITY = YES
DEPLOYMENT_REGRESSION (class D)               = NO
```

## 4. Mechanical call chain and the seven answers

```text
model tool invocation (args: targetAgentId, message, timeoutSeconds — exactly 3 fields, R2)
→ harness builtin tool (broker registry buildToolDefinition; relay for local manifests, G8 path)
→ child relay (broker/src/relay.js createRelayHandlers; transport loss ⇒ outcome_unknown/parent_rpc_ambiguous)
→ parent gateway execute-time local handler (gateway.js localHandlerResolver; L0 denial hook)
→ agentSessionMessagingAccess.send (production-runtime/src/agent-session-messaging.js)
   ├─ R2 authoritative validation            fail → invalid_arguments (0 deliveries)
   ├─ R3 trusted identity + source-turn proof fail → internal_error (0 deliveries); self-send rejected
   ├─ R12 L1 intent audit append             fail → internal_error (0 deliveries)
   ├─ ONE agentRouter.deliver(main)          throw → target_not_found/target_disabled/not_admitted/
   │                                                queue_capacity_exceeded/outcome_unknown (mapDeliverError)
   ├─ receipt.accepted===true required       malformed → internal_error (DELIVERED, evidence-only)
   ├─ timeoutSeconds=0 → {status:'accepted'} (receipt-only)
   └─ timeoutSeconds>0 → R9 waiter over readFinalAssistantOutput/onTurnReconciled
          ├─ replied          → {status:'replied', reply}
          ├─ deadline         → {status:'timeout'}  (SUCCESS envelope — Run keeps running)
          ├─ target_run_failed / not_admitted / reply_unavailable(reason) / outcome_unknown
          └─ every terminal → L1 outcome audit row (result + reconciliationHandle retained)
```

```text
REPLY_UNAVAILABLE_CREATED_AT =
  inside send() AFTER router.deliver() returned receipt.accepted === true, at reply-wait
  settlement (agent-session-reply-wait.js mapFinalAssistantOutputToOutcome lines 42-72).

REPLY_UNAVAILABLE_CONDITIONS =
  timeoutSeconds > 0 (wait_reply mode) AND receipt proven AND the exact Run's final-output
  snapshot settles to one of: truncated | no_output | evicted | restart_lost | never_existed.
  NEVER in receipt_only mode; NEVER pre-receipt (those are their own codes); NOT on deadline
  (deadline is the success envelope {status:'timeout'}).

AT_THAT_POINT:
  INBOX_RECEIPT_EXISTS       = YES (proven — it is the only path into the wait)
  TARGET_RUN_EXISTS          = YES (Run admitted at inbox; evidence may be lost, Run was created)
  TARGET_RUN_ID_KNOWN        = YES internally (audit L1 outcome row carries reconciliationHandle);
                               NO model-visibly (R7 forbids exposing the handle)
  TARGET_RUN_STATUS          = terminal (completed/failed) or evidence-lost (evicted/restart_lost/
                               never_existed) per reason
  FINAL_OUTPUT_STATUS        = the reason itself (truncated / no_output / evicted / restart_lost /
                               never_existed)
  PARENT_RPC_STATUS          = irrelevant here (reply_unavailable is created parent-side AFTER
                               delivery and passed through as a declared manifest failure; a lost
                               PASS-BACK would instead surface as outcome_unknown/parent_rpc_ambiguous)
  DELIVERY_CAN_BE_RECONCILED = YES — delivery is ALREADY PROVEN at that point; nothing to reconcile.
                               The only truly unreconciled state today is outcome_unknown (CASE A/G).
```

Reason → mechanism (reconciliation-store epoch/issuance rules): `evicted` = legally evicted resolved
record under RECONCILIATION_CAPS (unresolved records are never evictable — capacity pressure fails loud
at admission instead); `restart_lost` = handle epoch ≠ current runtime epoch (control-plane restart);
`never_existed` = handle never minted/malformed/beyond issuance watermark (post-receipt occurrence would
be a contract anomaly; delivery was still proven). In production the plausible dominant causes of
`reply_unavailable` are `restart_lost` (runtime restarts between send and reply) and `evicted`
(busy targets under per-agent record caps) — distribution requires the production audit file
(§7).

## 5. The two-dimension model — what is already mechanical vs what is missing

Derivable TODAY from the closed §5 taxonomy (probe cases 1-10):

| caller-visible | DELIVERY | REPLY |
|---|---|---|
| `{status:'accepted'}` (timeout=0) | DELIVERED | NOT_WAITED |
| `{status:'replied', reply}` | DELIVERED | REPLIED |
| `{status:'timeout'}` | DELIVERED | TIMEOUT |
| `reply_unavailable(reason)` | DELIVERED | per reason |
| `target_run_failed` | DELIVERED | TARGET_FAILED |
| `not_admitted` / `queue_capacity_exceeded` / `target_not_found` / `target_disabled` / `self_send_not_supported` / `invalid_arguments` / `credential_*` / `access_denied` / `transport_failure` / `unsupported_operation` | NOT_DELIVERED (proven zero-byte / pre-handler) | NOT_WAITED |
| `outcome_unknown` | UNKNOWN | UNKNOWN |
| `internal_error` | **AMBIGUOUS** (pre-delivery = NO; post-receipt malformed-receipt = YES) | UNKNOWN |

```text
DELIVERY_STATUS_UNAMBIGUOUS (code-taxonomy level) = YES, except one edge:
  internal_error after a proven acceptance collides with pre-delivery internal_error.
EXPRESSION GAPS (class A substance):
  E1. The delivery dimension is only implicit (code⇒dimension is Authority-derived knowledge,
      not surface). HR treating reply_unavailable as "maybe not delivered" is a rational
      response to an envelope that does not say DELIVERED.
  E2. The model-visible render (broker/src/registry.js renderError) prints code (+status/
      request_id) and drops error.detail — the reason (truncated vs evicted vs no_output) is
      invisible to the model; `authoringDiagnostic` detail passthrough is workflow-authoring-only.
RECONCILIATION GAP (distinct new semantic):
  R1. outcome_unknown has NO bounded read-back (probe CASE 9/10): parent truth DELIVERED with
      zero caller-visible delivery answer; requestId anchor never reaches the child on the loss
      path; scheduler mutations reconcile, session send keeps the ambiguous envelope verbatim.
```

Exactly-once (probe CASE 11): one `send()` invocation ⇒ exactly ONE `router.deliver` (mechanical);
relay transport-loss never auto-retries; a replayed relay invocation reaches the parent as a NEW send
(fresh runtime requestId per call) — `SAME_LOGICAL_INVOCATION_TRANSPORT_REPLAY` vs
`SECOND_INTENTIONAL_SEND` is distinguishable only by the caller choosing not to re-send
(NO_AUTOMATIC_RETRY discipline), because no correlation anchor is visible across the loss. The audit
L1 chain (intent row: requestId + correlationHash; outcome row: result + reconciliationHandle)
retains the evidence an anchor-based reconciliation needs.

## 6. Classification and disposition

```text
CURRENT_CLASSIFICATION = split, per the two seams the probe discriminated:
  reply_unavailable blocker  → IMPLEMENTATION_OR_DEPLOYMENT_GAP (class A: expression/consumption;
                               Authority already correct; NO spec rewrite, NO rename)
  outcome_unknown CASE A/G   → NEW NORMATIVE SEMANTIC (bounded reconciliation + requestId anchor
                               not derivable from accepted AGENT_CORE_AGENT_SESSION_MESSAGING_V1 r3)
                               → docs-only AMENDMENT required before implementing reconciliation
PRODUCTION_APPLY            = HOLD_WHILE_P0_OWNS_SLOT (unchanged)
```

Minimal implementation shape (post-amendment, no wire break):
- E1/E2: pass the structured reason through the model-visible render for this capability and state
  the code⇒DELIVERY mapping as normative text (amendment), keeping §5 envelopes closed.
- R1: requestId-anchored bounded read-back over the existing L1 audit chain (+ reconciliation-store
  lookup) exposed as a read-only discovery surface on the SAME trusted channel, returning
  DELIVERED | NOT_DELIVERED | STILL_UNKNOWN(+evidence); STILL_UNKNOWN ⇒ NO_AUTOMATIC_RETRY unchanged.

## 7. Evidence inventory and residuals

- `probe/discriminating-failure-injection.mjs` + `probe/RUN_OUTPUT.txt` — real-module failure injection,
  12 cases, in-memory stubs, zero production mutation.
- Baseline suites on fresh `origin/main` worktree (pinned node v25.6.1 + proxy-free env — both are
  REQUIRED; the historical "environmental failures" were exactly these two preconditions):
  broker agent-session-messaging **14/14**, production-runtime agent-session-messaging **18/18**,
  agent-session-messaging-integration **8/8**.
- Production outcome-mix (send volume; accepted/replied/timeout/failed counts) — pending Owner-side
  read: `/Users/authsvc/.agent-core/control/agent-session-messaging-audit.jsonl` is authsvc-only
  (drwx--x--x; no passwordless sudo). Read-only collector:
  [`owner-evidence/collect-production-audit.sh`](owner-evidence/collect-production-audit.sh) (offline
  `--selftest` PASS 5/5). NOT a root-cause dependency — the mechanical classification above is
  byte/semantics-proven. NOTE: the audit rows carry `result:'failed'` WITHOUT the reply_unavailable
  reason, so the per-reason live distribution is not recoverable from any persisted surface today —
  that visibility gap is itself part of finding E2 (the fix must persist/surface the reason).
