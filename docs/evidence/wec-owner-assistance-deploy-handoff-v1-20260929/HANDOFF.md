# WEC_OWNER_ASSISTANCE_DEPLOY_HANDOFF_V1 — minimal deployment-ready handoff

```text
PURPOSE           = Minimal deployment-ready handoff for the MERGED cross-repo
                    Domain Owner Assistance feature (svc-workflow PR #68 + dsh PR #351),
                    consumable by the main Deployment Agent. This session performed
                    ZERO production mutation: read-only git/spec/code verification only.
REUSE (no new system):
  Base package    = mayf3/svc-workflow @ 1249ec42
                    docs/deployment/WORKFLOW_EXECUTION_CONTROL_V1_DEPLOYMENT_PACKAGE.md
                    (existing WEC package: strict order, Step 0-3 mechanics, production
                    prerequisites, rollback section — REUSED verbatim; this handoff adds
                    ONLY the owner-assistance delta rows on top of it).
  Handoff format  = docs/evidence/wec-phase2-auth-forum-handoff-freeze-v1-20260925/HANDOFF.md
                    (same feature line; its O4/O5/O6b Owner items are cited, not re-derived).
  Deploy packets  = dsh-agent-core deployment-artifacts/<feature-vN>/ convention (not used
                    here: that format is for byte-swap transactions with preimage/target
                    hashes; this feature deploys as repo-pinned binaries + one migration).
THIS_DOC           = decision/record artifact. It authorizes NOTHING by itself.
PRODUCTION_MUTATION = NO. No commit made; working-tree file only.
```

## 1. Required output fields (terminal, as of 2026-09-29)

```text
HANDOFF_LOCATION = mayf3/dsh-agent-core
                   docs/evidence/wec-owner-assistance-deploy-handoff-v1-20260929/HANDOFF.md
                   (this file; evidence authority). Deployment executes FROM the pinned
                   repos per SOURCE_PINS; the svc base package supplies step mechanics.

SOURCE_PINS      = (fresh-verified 2026-09-29 via github fetch of both repos)
  svc-workflow   : PR #68 merge = 1249ec4215f63f1d9688cac02935055366994cc1
                   (== github/main HEAD; branch zcode/owner-pending-system-escalation-v1-20260928;
                   impl head 20ebd70). Delta: migrations/0028_owner_assistance_wake_outbox.sql,
                   src/forum_sync.rs (deliver_owner_assistance_wake + run_once arm),
                   src/store/postgres/outbox.rs (queue_owner_assistance_wake,
                   ON CONFLICT DO NOTHING), execution_escalation/transition_transaction
                   (OWNER_PENDING semantics + owner_principal_id in response),
                   SVC_WORKFLOW_EXECUTION_CONTROL_V1 amendment (OWNER_PENDING replaces
                   auto-HUMAN_REQUIRED; due-set excludes ANY open assistance case).
  dsh-agent-core : PR #351 merge = 6d1fa72d961f33f1748981b06e40ad9f95ec3916
                   (branch zcode/domain-owner-assistance-v1-20260928).
                   Deploy base = origin/main fbd2e399 (main advanced past #351 via
                   #352/#353). Owner-assistance surfaces re-verified BYTE-IDENTICAL
                   between 6d1fa72d and fbd2e399 today:
                     packages/broker/src/capabilities/workflow-assistance.js    9e23713095bce22c…
                     packages/product-api/src/workflow-execution-routes.js      be1588cbdbc38e4a…
                     packages/production-runtime/src/workflow-execution-runtime.js 7aa82e216d1f327b…
                   ⇒ build the dsh binary from fbd2e399; re-run this 3-file blob
                   comparison at deploy time as the drift gate (any drift ⇒ STOP).
  migration      : 0028_owner_assistance_wake_outbox.sql @ 1249ec42 — widens
                   workflow_outbox outbox_kind CHECK to include 'OWNER_ASSISTANCE_WAKE'
                   (drop + re-add constraint; no data change, no backfill).
  specs          : SVC_WORKFLOW_EXECUTION_CONTROL_V1 @1249ec42 (accepted, amended by #68);
                   AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V1 @6d1fa72d (accepted, amended
                   by #351: durable owner wake, wfassist-<caseId>, closed wake payload).
  review         : independent cross-repo review = PASS / 0 blockers (Owner-provided
                   canonical fact; NOT re-run in this session).

DEPLOY_ORDER     = (strict; steps 1-3 are safe with the blocker OPEN — feature ships
                   dormant/fail-closed; steps 4-5 are gated on SINGLE_BLOCKER)
  0. PREFLIGHT (read-only): (a) svc prod migration head == 0027 before applying 0028;
     (b) dsh live-face probe: unauthenticated GET /workflow-execution/traces → 401,
     NOT 404 (O6-style gate). If 404, the WEC BASE package (steps 0-3) must complete
     first — this handoff rides on top of it, it does not replace it; (c) svc .env
     (0600 surface) resolves kick config: WORKFLOW_EXECUTION_KICK_URL + KICK_TOKEN
     present (deliver_owner_assistance_wake hard-fails its rows otherwise).
  1. svc: apply migration 0028. Old-binary-safe: the constraint only WIDENS the
     allowed kind set; pre-#68 binaries insert only FORUM_EVENT/EXECUTION_KICK.
  2. svc: roll binary @ 1249ec42 (WORKFLOW_PORT 8989 unchanged; base package Step 3
     mechanics). From here OWNER_PENDING cases + OWNER_ASSISTANCE_WAKE rows can
     exist; undelivered rows durably retry until the dsh side answers 2xx.
  3. dsh: roll binary/product-api built from fbd2e399 (wake route + broker
     workflow_assistance_read/action + runtime wake all ride the same binary).
     Keep WORKFLOW_EXECUTION_POLLER_AGENT_ID UNSET in this step: poller stays
     disabled (ledger evidence-only), wake route answers 503 poller_unconfigured,
     zero owner prompts fire — fail-closed, svc rows keep retrying.
  4. Auth/poller grant — ONLY after Owner designates poller WHO (SINGLE_BLOCKER):
     provision/extend the designated identity per the FROZEN REQUIRED_SCOPES poller
     row (wec-phase2 handoff §1, accepted authority): svc-workflow
     [workflow.read, workflow.execute] + GLOBAL_SCHEDULER_READ binding +
     auth.agent.resolve + agent.session.send; svc-forum +[forum.read, forum.write];
     MUST NOT be hr-agent/efficiency-agent (O4); MUST NEVER join
     FORUM_OPERATOR_AGENT_IDS (O6b). Then set WORKFLOW_EXECUTION_POLLER_AGENT_ID
     (0600 .env custody) and mint WORKFLOW_EXECUTION_KICK_TOKEN per O5 (from the
     designated poller identity; lifetime ≤ access-token TTL). NO new secret kind.
  5. Canary (§2) → evidence recorded under this repo docs/evidence convention.

CANARY           = (see §2 — two ingress entries: system attempt-limit + RETURN-limit;
                   assertions: OWNER_PENDING, outbox delivery once, inter_agent owner
                   wake once, duplicate wake suppression, resolve, escalate_to_human,
                   HUMAN_REQUIRED visibility, plus the fail-closed negatives)

ROLLBACK         = (see §3 — svc binary rollback is the HAZARD case: old binary
                   marks unknown outbox kinds delivered ⇒ fail-SILENT wake loss;
                   drain-check required BEFORE svc binary rollback. Migration 0028
                   is leave-forward and must NOT be rolled back with WAKE rows present.)

SINGLE_BLOCKER   = POLLER_WHO_OWNER_DECISION
                   Owner (with Auth) must designate the Phase 3 poller identity (WHO)
                   + additive grant delta. This is ONE decision, not a gate family:
                   deploy steps 1-3 intentionally do not need it (dormant + fail-closed),
                   step 4 cannot start without it, and canary POSITIVE wake assertions
                   (§2) need it. Everything else — including all fail-closed negatives —
                   is executable now. No other open item; no new gate invented.

READY_FOR_DEPLOYMENT_AGENT = YES (blocker carried, not hidden)
                   Steps 0-3 + fail-closed negatives: executable immediately.
                   Steps 4-5: gated on POLLER_WHO_OWNER_DECISION only.
                   PRODUCTION_MUTATION = NO in this authoring session; nothing committed.
```

## 2. Canary definition (execution belongs to the deployment window)

Both entries may share one low-risk real workflow class (base package Step C
discipline). Entry B's case creation works from step 2 onward; its owner wake +
resolve assertions need step 4. Entry A needs the poller enabled end-to-end.

### Entry A — system attempt-limit ingress (dsh-side fence, CTR-WEC1-004)

```text
A1 pick a dispatchable visit on a low-risk real workflow; drive/wait attempts to
   exhaustion at DSH_WORKFLOW_MAX_ATTEMPTS_PER_VISIT (existing env; fence-level).
A2 observe the escalation receipt {escalated, assistanceCaseId, workflowStateVersion,
   eventSequence, ownerPrincipalId}; case created OWNER_PENDING with provenance
   source=execution_policy (attemptCount/lastAttemptId recorded). The system does
   NOT auto-escalate to HUMAN_REQUIRED anymore (spec amendment, #68).
A3 canonical forum thread shows EXACTLY ONE owner_attention_requested event
   (outbox event_key assistance_requested:<caseId>).
A4 exactly ONE workflow_outbox row of kind OWNER_ASSISTANCE_WAKE
   (event_key owner-assistance:<caseId>); after dsh answers 200 it is marked
   delivered exactly once.
A5 the owner agent receives EXACTLY ONE inter_agent prompt in its main session
   (sourceAgentId = designated poller; correlation workflow-assistance:<caseId>;
   request id wfassist-<caseId>). Re-delivery/replay ⇒ reused=true, no second
   prompt (dsh correlation dedupe).
A6 owner workflow_assistance_read owner_inbox lists the case; detail visible.
   Negative: a non-owner agent sees the case invisible AND its resolve/escalate
   → not_domain_owner (server-side; mirrors the cancel governance family).
A7 owner workflow_assistance_action resolve with expectedWorkflowStateVersion CAS
   ⇒ case resolved; the visit becomes dispatchable again (open-assistance
   due-set exclusion lifts).
```

### Entry B — RETURN-limit ingress (svc-side, committing tx of the max-th RETURN)

```text
B1 RETURN the instance until returnCount+1 == max ⇒ that committing tx opens an
   OWNER_PENDING case on the TRANSITION TARGET visit (source=return_policy) and
   queues the forum row + WAKE row, same mechanics as A3/A4.
B2 the NEXT RETURN ⇒ deterministic 409 return_policy_exhausted, no side effects.
B3 owner wake + resolve identical to A5-A7.
B4 escalate_to_human on a (fresh) case ⇒ status HUMAN_REQUIRED (explicit owner
   action only); the visit is then excluded from the due set (no dispatch into an
   open assistance case, CTR-SWEC-006 amendment A); HUMAN_REQUIRED visible in
   owner_inbox AND on the canonical thread.
```

### Fail-closed matrix (assert as negatives; executable after steps 1-3)

```text
owner_principal missing in payload      → dsh owner_principal_missing, ZERO delivery,
                                          route 503, svc row stays pending/retrying.
owner principal disabled/unresolvable   → agent_resolve_principal error code passes
                                          through verbatim (e.g. principal_disabled;
                                          test-pinned in workflow-owner-assistance-wake
                                          .test.js), ZERO delivery, 503, retries
                                          (recovers if the principal is re-enabled).
poller WHO unset / grant missing        → poller_unconfigured 503 (fail-closed); the
                                          whole dispatch poll stays disabled (ledger
                                          evidence-only) so attempt-limit ingress
                                          cannot fire; RETURN-limit cases still form
                                          svc-side with wake rows retrying.
wake endpoint non-2xx (ANY status incl. 4xx) → svc keeps the row pending
                                          (attempt_count++, next_attempt_at backoff,
                                          last_error recorded) and retries every poll
                                          tick. WAKE is correctness-path (explicit in
                                          deliver_owner_assistance_wake), unlike
                                          latency-only kicks which absorb 4xx.
duplicate wake                          → two independent layers: svc outbox
                                          ON CONFLICT (outbox_kind, event_key)
                                          DO NOTHING (one row per case, ever) + dsh
                                          wfassist-<caseId> correlation reuse.
```

## 3. Rollback notes

```text
dsh binary → pre-#351 face:
  wake route 404 ⇒ svc WAKE rows get non-2xx and KEEP RETRYING (fail-VISIBLE durable
  backlog, zero loss); workflow_assistance tools disappear (owner_inbox/actions
  unavailable; cases remain OWNER_PENDING, svc stays authoritative). Attempt-limit
  fence (CTR-WEC1-004) predates #351 and is unaffected.

svc binary → pre-#68 face (THE rollback window):
  HAZARD: the OLD binary's run_once already treats unknown outbox kinds as
  "marked delivered to avoid an endless loop" (verified at 1249ec42^1 forum_sync.rs).
  Any UNDELIVERED OWNER_ASSISTANCE_WAKE row at rollback time is therefore
  fail-SILENTLY swallowed — the Domain Owner prompt is lost (the case itself stays
  OWNER_PENDING and remains visible via owner_inbox/forum; only the notification is
  lost). MANDATORY pre-rollback drain check:
    SELECT event_key, attempt_count, last_error FROM workflow_outbox
    WHERE outbox_kind = 'OWNER_ASSISTANCE_WAKE' AND delivered_at IS NULL;
  ⇒ zero rows: rollback safe. ⇒ nonzero: delay rollback or notify the affected
  owners out-of-band, then roll back.

migration 0028:
  LEAVE-FORWARD. Do NOT pair it with the binary rollback: the constraint is
  additive and harmless to old binaries, and re-tightening the CHECK fails while
  ANY OWNER_ASSISTANCE_WAKE rows exist. Roll it back only in a dedicated step
  after the drain check returns zero (normally: never).

poller/env:
  Unset WORKFLOW_EXECUTION_POLLER_AGENT_ID ⇒ poller disabled, wakes 503, svc rows
  retry — fully resumable posture; re-set to resume without data loss.
```

## 4. Required env/config (no new secrets)

```text
svc (.env 0600 surface, existing keys only):
  WORKFLOW_EXECUTION_KICK_URL  — reused; wake endpoint is DERIVED: parse KICK_URL,
                                 force path to /workflow-execution/owner-assistance-wakes,
                                 strip query/fragment (deliver_owner_assistance_wake).
  WORKFLOW_EXECUTION_KICK_TOKEN— reused verbatim as the wake Bearer; 5s timeout.
dsh (existing keys; nothing new):
  WORKFLOW_EXECUTION_POLLER_AGENT_ID — the WHO (unset until DEPLOY_ORDER step 4).
  DSH_WORKFLOW_MAX_ATTEMPTS_PER_VISIT / DSH_WORKFLOW_STALE_NO_PROGRESS_MS /
  DSH_WORKFLOW_RETRY_DELAY_MS — unchanged by this feature.
Auth: owner-facing tools use the pre-existing workflow.read / workflow.execute
  scopes (capability-level split: read=inbox/detail, action=resolve/escalate);
  NO new scope, NO new secret is introduced by this feature. The only NEW grant
  surface is the poller identity additive delta (DEPLOY_ORDER step 4, frozen row).
```

## 5. Provenance (this authoring session, 2026-09-29)

```text
Fresh fetches: dsh-agent-core origin/main = fbd2e399 (post-#351);
               svc-workflow github/main = 1249ec42 (== PR #68 merge).
Verified today: PR #351 merge SHA + 19-file stat; PR #68 merge SHA + 12-file stat;
  migration 0028 full text; workflow_outbox DDL (0027: delivered_at/attempt_count/
  event_key, partial index on undelivered); pre-#68 unknown-kind arm
  (fail-silent swallow); deliver_owner_assistance_wake (path derivation, Bearer
  reuse, every-non-2xx-retries comment); outbox insert ON CONFLICT DO NOTHING;
  dsh wake function + 4 test cases (exact resolution, dedupe, admission-on-error,
  principal_disabled passthrough); product-api wake route (Bearer gate first,
  closed payload, 503 mapping); 3-file blob equality 6d1fa72d == fbd2e399;
  wec-phase2 HANDOFF (O4/O5/O6b, REQUIRED_SCOPES poller row, live-face probe).
Constraints honored: no deploy/restart; no production/sudo/credential access;
  no commit; no new deployment system; single working-tree handoff file.
```
