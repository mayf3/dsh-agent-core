---
spec_id: AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-09
accepted_date: 2026-09-09
acceptance_authority_basis: >-
  Owner exact-head acceptance (PR mayf3/dsh-agent-core#219, ACCEPT=YES at
  2f1329b69fea2601fa539bbba269f6ca341cafbb, second gate after the first
  REVISE round closed B-O1 + the governance-citation mechanical item); prior
  chain: independent semantic review REVISE -> fix -> delta re-review
  ACCEPT_READY. This commit is the lifecycle transaction only: the accepted
  contract text is byte-identical to the accepted head except this
  frontmatter.
accepted_reviewed_head: 2f1329b69fea2601fa539bbba269f6ca341cafbb
revision: r2
revision_date: 2026-09-09
revision_note: >-
  r2 = blocker-union closure (Owner review 2026-09-09): B1 authority
  sequencing (this Spec is now authored as a pure docs candidate on the
  implementation base 4dac90d BEFORE any implementation authority exists; the
  prior in-goal r1 authorship that treated the Owner goal directive as
  implementation authority is corrected here — see §0.1) + B2 due-intent
  starvation (keyset continuation consumption, §CTR-WAE-001b) + non-blocker
  convergence (SETTLED semantics, §CTR-WAE-010). No redesign; the r1
  architecture and frozen implementation candidate are carried unchanged
  except where this Spec says otherwise.
supersedes: []
superseded_by: AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 (accepted 2026-09-10, PR
  mayf3/dsh-agent-core#236 at 11023c6fd112f48e2d1de84f6a27048f8049df6c;
  whole-authority successor — this Spec remains accepted history and proof
  provenance but is no longer current authority; mechanical pointer only,
  no semantic change to the accepted bytes)
amends:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1 (accepted R4 trusted message-origin
    sidecar: extends the exact source-kind enumeration from ONE kind
    (`inter_agent`) to TWO (`+ workflow_execution`); no other R4 semantic —
    exact-allowlist, freeze, fail-loud rejection, control-plane-only — is
    changed. See CTR-WAE-004.)
external:
  - svc-workflow SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1 (candidate,
    same closure round; amends CTR-VAI-009 of accepted
    SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1 — keyset continuation contract this
    Spec's CTR-WAE-001b consumes)
implementation_basis: >-
  This Spec is the implementation-authority candidate for
  WORKFLOW_AGENT_EXECUTION_V1. Per the repository's current Development
  Grammar V1 (`.agents/README.md`, governing authority
  `AGENT_DEVELOPMENT_GOVERNANCE_V1`) and repository-local governance
  (`.agents/local/README.md`), merge / implementation authority is an
  ACCEPTED Spec only; the Owner goal directive ordered the goal but does not
  itself constitute product implementation authority. A frozen implementation candidate exists out-of-band (see §0.1)
  and NOTHING from it enters any base until this Spec is accepted.
frozen_candidate:
  branch: implementation/workflow-agent-execution-v1
  head: 0806c71
  base: 4dac90d
  state: FROZEN 2026-09-09 (no further commits; minimal replay onto the
    accepted-Spec base is the only permitted future use)
---

# AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V1

## 0. Summary and non-goals

A THIN infrastructure module (`packages/workflow-execution`) connects
svc-workflow's Agent-owned NodeVisit / DISPATCH_INTENT due feed to
dsh-agent-core Agent Runs:

```
Workflow transition (existing, agent-owned)
→ new NodeVisit + DISPATCH_INTENT (existing svc-workflow VISIT_ACTIVATION_V1)
→ DSH due-feed poll (existing broker capability + minimal keyset continuation,
   §CTR-WAE-001/001b)
→ atomic one-attempt-per-NodeVisit fence (ledger)
→ canonical assignee resolution (existing auth-service authority)
→ Agent Run admission (existing router.deliver, NEW trusted provenance kind)
→ NodeVisit → Attempt → Run linkage (append-only ledger)
→ target Agent re-reads the workflow with its OWN Principal and commits via
   workflow_execute.transition (existing, the ONLY write path)
→ next NodeVisit repeats.
```

This is NOT a new workflow engine, NOT a task platform, and NOT an HR
replacement for judgment work. Explicit non-goals (V1): lease/renew,
heartbeat, generation/fencing protocols, retry engines, reassignment, worker
pools, load balancing, parallel workflows, SLA/escalation, outbox/event bus,
new databases or services, agent ACK/heartbeat tools, generic operators.

Business consistency stays ENTIRELY with svc-workflow's existing state
version / idempotency-key / transaction semantics. The design is optimistic
on reads (re-polling, re-reading, machine re-checks are always safe) and
conservative on writes (DSH never schedules a second attempt for the same
NodeVisit; unknown outcomes never produce a second execution).

### 0.1 Governance and sequencing record (B1 closure)

The first implementation round (commits b1f0bf9 + 0806c71, branch
`implementation/workflow-agent-execution-v1`, cut from 4dac90d) was produced
while this Spec existed only as an in-goal `proposed` draft, and interpreted
the Owner goal directive as implementation authority. That was a sequencing
violation of this repository's governance (`no accepted implementation-
authorizing Spec in base = no implementation`): a goal/task/prompt does not
create product authority. The review caught it (blocker B1). Closure, as
ruled by the Owner:

1. the implementation candidate is FROZEN at 0806c71 — not deleted, not
   rewritten, not merged;
2. this r2 Spec candidate is authored as a PURE DOCS change on the
   implementation base 4dac90d (= origin/main at authoring time);
3. an independent semantic review of this exact head runs BEFORE acceptance;
4. the Owner exact-head acceptance gate is the ONLY path to implementation
   authority;
5. upon acceptance and merge into the implementation base, the frozen commits
   are minimally replayed/ported (plus the §CTR-WAE-001b continuation work),
   affected tests are re-run, and ONE independent implementation re-audit is
   performed;
6. the architecture investigation already done stands — this closure does not
   reopen design.

## 1. Reuse map (frozen)

| Concern | Frozen seam |
|---|---|
| due feed | broker capability `workflow_dispatch_intents` op `list` (limit 1..100 + keyset continuation §CTR-WAE-001b; svc-workflow GLOBAL_SCHEDULER_READ binding enforced server-side) |
| assignee mapping | `agentPrincipalResolutionAccess` (`AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2`, which supersedes V1 and retains CTR-EPAR-005): auth-service exact UUID read + local definition deliverability |
| Run admission | `router.deliver({requestId, agentId, sessionMode:'main', message}, {messageOrigin})` — AGENT ROUTER DELIVERY V0 |
| run outcome | Router reconciliation store: `getTurnReconciliation` / `resolveCallerCorrelation` (handle first, exact requestId correlation as restart fallback) |
| settle probe | broker capability `workflow_instance_detail` op `read`, executed AS THE TARGET AGENT |
| transition | `workflow_execute.transition` called by the target Agent itself (its own Principal; `WORKFLOW_TRANSITION_WRITE_PATH_FLEET_OPEN_V1`: no second write entry) |
| Assistance | existing Workflow Assistance surface, opened by the target Agent; no new state machine here |
| ledger discipline | scheduler V2 patterns: OwnerLock (`SIGKILL_LOCK_FILE_WINDOW` hardened) + append+fsync event log + replay projection |

## 2. Contracts

### CTR-WAE-001 — due-feed consumption

The engine polls `workflow_dispatch_intents.list` through the broker gateway
(token + HTTP stay in the trusted parent transport; no new HTTP client, no
new scope handling). The poller Principal must hold the server-side
GLOBAL_SCHEDULER_READ binding (deployment provisioning, out of scope here).
Malformed feed records are skipped loudly, never admitted, never silently
dropped. No assignee/due filters are requested; the svc-workflow API surface
is extended ONLY by the keyset continuation of §CTR-WAE-001b (external
`SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1`), nothing else.

### CTR-WAE-001b — keyset continuation (B2 starvation closure; consumes the external svc-workflow contract)

The feed is a single ordered window (`(nextEligibleAt, dispatchIntentId)`,
limit ≤ 100) with no server-side state; if more than one window of due
intents exists and every intent in the first window already has an attempt,
intents beyond the first window are INVISIBLE — a confirmed starvation that
violates work-discovery completeness. Minimal closure (scoped by the goal's
continuation exception; required by Owner ruling B2, 2026-09-09):

- The external svc-workflow contract adds optional keyset continuation
  parameters `afterNextEligibleAt` + `afterDispatchIntentId` (both-or-neither;
  exclusive row-value keyset on the feed's existing order). The dsh consumer
  sweep pages: first request without cursor; while a page is FULL
  (items == limit), request the next page with the cursor taken from the
  LAST item's EXACT returned `nextEligibleAt` string + `dispatchIntentId`
  (byte-exact round-trip, never reformatted); a short page ends the sweep.
- Exhaustion is "short page"; the API adds NO page/count/offset/totalPages
  anywhere (that is an svc-side CTR, restated here as a consumer-side
  constraint: the consumer never sends or expects such fields).
- The sweep has NO finite page cap: it pages until a SHORT page
  (exhaustion) or a per-request error (logged loud; the normal tick retries
  the next sweep). The keyset strictly advances, so any static or
  slower-growing due set terminates the sweep; a feed growing faster than
  page reads is not a real V1 scenario and is observable as a
  never-completing sweep (the single-flight tick guard prevents overlapping
  sweeps). NO persistent cursor, NO queue, NO lease — the non-goals stand.
  The admission bound still counts only NEW attempts per sweep;
  already-attempted replays are free.
- Starvation invariant (mechanically testable, REQUIRED): with > 100 due
  intents where the first 100 already have attempts, the sweep still
  discovers intents 101+ (consumer-side stub test; the svc side proves the
  keyset endpoint itself).
- Deployment order: svc-workflow with the accepted keyset continuation
  deploys BEFORE the dsh poller is enabled in that environment. No
  consumer-side feature flag.
- Consumer-visible feed safety (restated from the external CTR-DKC-004):
  an already-RETURNED due row's key never moves backward (wake is a durable
  no-op on due rows); mid-sweep entries (woken deferred intents, brand-new
  activations) land at/after the cursor EXCEPT long-transaction timestamp
  skew and exact-timestamp ties, which stay due and are caught by the next
  sweep; each sweep restarts cursorless and, with continuation, is
  exhaustive — and the one-attempt fence (CTR-WAE-002) dedupes any repeated
  observation anyway.

### CTR-WAE-002 — the one-attempt fence

`attemptId = wfeat-<sha256(lowercase(nodeVisitId)).slice(0,24)>` —
deterministic, clock-free, stable across pollers/restarts. The ledger's
`beginAttemptIfAbsent` is the ONLY way to mint an attempt; it appends
`attempt_planned` iff the NodeVisit has NO attempt yet. ANY existing attempt —
ACTIVE, SETTLED or NEEDS_REVIEW — blocks a second one. Duplicate triggers
(re-poll, second dispatch intent for the same visit, HR double-fire,
post-restart replay) therefore cannot create a second execution on the DSH
path. Race safety: in-process FIFO chain + cross-process OwnerLock + fresh
replay under the lock before every mutation.

### CTR-WAE-003 — canonical assignee resolution

`ownerPrincipalId` resolves through the agent-principal-resolution authority
(auth-service is the identity authority; the local definition registry proves
deliverability). Resolution failure ⇒ the attempt lands NEEDS_REVIEW
(`resolve_failed:<code>`) with ZERO Runs admitted. No display-name fallback,
no agent reassignment, no retry (V1).

### CTR-WAE-004 — Run admission and provenance

One admission per attempt: `router.deliver` with `requestId = attemptId`,
`sessionMode: 'main'` (canonical main session), the deterministic instruction
message, and the NEW trusted sidecar shape

```
messageOrigin = { kind: 'workflow_execution', workflowInstanceId: <uuid>,
                  nodeVisitId: <uuid>, attemptId: 'wfeat-<24hex>' }
```

exact-allowlisted, frozen, malformed-rejected in BOTH the Router
(`ingress-delivery.js`) and the session seam (`session-seam.js`); the
exact-id admission gate (AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
CTR-EPAR-005 TOCTOU family) applies to it. Unknown origin kinds stay
rejected. The session journal stamps the message `source` verbatim — this is
the runtime-owned workflow provenance on the Run; it is NEVER model input.

AMENDMENT DECLARATION (vs accepted AGENT_CORE_AGENT_SESSION_MESSAGING_V1):
this contract extends R4's frozen source-kind enumeration from one trusted
kind (`inter_agent`) to two (`workflow_execution`). Nothing else about the
R4 sidecar changes: exact-allowlist, Object.freeze detach, fail-loud
malformed rejection, control-plane-only provenance. On R4's genericity rule
("the Router must not learn Workflow/Forum/Feishu/Scheduler semantics"):
the Router's treatment of `workflow_execution` is SHAPE VALIDATION ONLY
(UUID / `wfeat-` grammar checks) — no workflow-aware routing, admission, or
retry decision is derived from the sidecar; routing stays keyed on the exact
Agent Definition id exactly as before.
The instruction text carries the exact coordinates and the special semantics
(acknowledgments are not facts; the transition receipt is the only commitment;
version-conflict allows exactly one re-read+retry; blocked work goes to the
existing Assistance surface, never a fabricated submission).

### CTR-WAE-005 — ledger linkage

Append-only `workflow-execution/attempts.jsonl` + `attempts.lock`
(OwnerLock). Event kinds: `attempt_planned`, `run_delivered`
(`{agentId, requestId, sessionId, reconciliationHandle?, messageId?}`),
`delivery_failed`
(terminal NEEDS_REVIEW), `reconciled` (terminal verdict). Replay tolerates a
torn tail; terminal attempts REFUSE further appends fail-loud (a late writer
would mean someone is trying to re-run a settled/reviewed NodeVisit). The
ledger records facts and IDs only — never workflow context, message bodies,
or business state. State machine: ACTIVE | SETTLED | NEEDS_REVIEW (whole V1;
CTR-WAE-010 defines what SETTLED does and does not mean).

### CTR-WAE-006 — reconcile judgment (deterministic)

Per ACTIVE attempt, per pass:

| turn state (Router store) | settle probe | verdict |
|---|---|---|
| no verified Run linkage | — | NEEDS_REVIEW `delivery_unverified` |
| `pending` | (not spent) | ACTIVE `run_running` |
| `settled` | visit moved past ours | SETTLED `business_commitment_observed` |
| `settled` | visit still current | NEEDS_REVIEW `run_ended_no_submission` |
| `evicted` / `restart_lost` / `never_existed` | visit moved past ours | SETTLED (business fact beats lost linkage) |
| `evicted` / `restart_lost` / `never_existed` | visit still current | NEEDS_REVIEW `run_outcome_unknown` |
| any terminal/lost | probe unavailable | NEEDS_REVIEW `settle_check_unavailable` |

Unknown outcome NEVER becomes "not delivered, so run it again". A model
reply ("收到"/"完成了") is never consulted: the settle fact is workflow
state only. Reconcile is read-only except when landing a terminal verdict.

### CTR-WAE-007 — settle probe and the visibility invariant

The probe reads instance detail AS THE TARGET AGENT (at admission the agent
IS the due visit's canonical assignee; node-visit rows are immutable). Wire
shapes: `full` carries `current_node_visit_id` (strict lowercase compare ⇒
settled iff different); `historical_participant` carries no visit id but
mechanically PROVES our visit is no longer current — if it were still
current, its (immutable) assignee, our agent, would hold CurrentAssigneeFull.
Unreadable states (error, missing fields, unknown visibility) are
`unavailable` ⇒ NEEDS_REVIEW, never silently settled. The probe never calls
`wake` (reconcile must not mutate eligibility).

### CTR-WAE-008 — Assistance

Directly reused: the target Agent opens existing assistance cases with its
own Principal when blocked; no BLOCKED/report/resume machinery is added here.
svc-workflow currently exposes no machine-checkable per-instance assistance
query, so V1 reconcile cannot distinguish "open assistance" from other
no-submission ends — both land NEEDS_REVIEW (HR classifies via its existing
Assistance inbox; manager-level work stays with HR per the goal's
HR_AFTER_V1). This is the V1 boundary, ruled NOT a blocker; no fake probe, no
API expansion.

### CTR-WAE-009 — boundaries kept

No svc-workflow semantic change beyond the external keyset-continuation
contract; no second transition write entry; broker manifests unchanged;
Scheduler unchanged and not a dispatcher; HR is not the normal
transport/retry daemon anymore (manager work only); no Redis/Postgres/
new service; outcome-unknown and side-effect-unknown never auto-rerun; no
automatic agent switching.

### CTR-WAE-010 — SETTLED semantics (non-blocker convergence; no state expansion)

`SETTLED` means exactly: THIS attempt no longer needs to process the
NodeVisit, because authoritative workflow state has moved past the visit
(different `current_node_visit_id`, or the visibility invariant). It is a
fact about the ATTEMPT's closure, not about the transition's authorship.

`SETTLED != COMPLETED_BY_THIS_ATTEMPT`. Without exact transition-receipt
evidence (command id / receipt linkage tying the committed transition to
this attempt's Run), NOTHING may claim that this attempt's Run performed the
transition — not ledger fields, not logs, not reports. V1 collects no such
receipt linkage (`workflow_execute` receipts are the target Agent's tool
results; the engine never sees them as machine input), so V1 NEVER asserts
completion attribution. The actor is unknown-by-V1 and may be this Run,
another actor, or an admin action.

Minimal provenance (already carried by the ledger, frozen as-is): the
`reconciled` event records `judgment` + `reason`, where
`business_commitment_observed` reads as "a business commitment was observed
in authoritative state (actor unspecified)" and `reason` ∈
{`node_visit_no_longer_current`, `assignee_no_longer_current: …`}. No new
ledger field, no new state, no rename of the judgment vocabulary is
required by this Spec.

## 3. Production wiring (fail-closed)

`production-runtime/src/workflow-execution-runtime.js` mounts the engine with
real seams; `compose.js` mounts it after the broker gateway +
agent-principal-resolution rows and starts/stops it with the runtime.
Enabled only when `WORKFLOW_EXECUTION_POLLER_AGENT_ID` (or compose
`workflowExecution.pollerAgentId`) is configured; otherwise the mount is
honest-disabled (ledger evidence-only, `start()` logs the disabled line,
never fakes liveness). Deployment prerequisites (out of scope here): the
poller agent's credential in the canonical store + GLOBAL_SCHEDULER_READ
binding + `auth.agent.resolve` grant + the external keyset-continuation
svc-workflow deployed first (§CTR-WAE-001b); PRODUCTION_APPLY_ALLOWED = NO
for this goal.

## 4. Tests

`packages/workflow-execution/test/` (r1 baseline 33 assertions; port keeps
them green): ledger fence/dedupe/concurrency/restart/torn-tail/terminal-
refusal; judgment tables (incl. the goal-required negative: run completed +
"完成了" + visit still current ⇒ NEEDS_REVIEW, never rerun); instruction
determinism/semantics; engine chain (admission, provenance, happy settle,
duplicate triggers, outcome unknown, probe failure, unresolvable assignee,
rejected delivery, restart reconcile, feed failure, malformed records,
admission bound). Router: `test/process-lifecycle/workflow-execution-origin.test.js`.
demo-server: `test/session-seam-workflow-origin.test.js`.

Required by r2 (B2 + convergence):
- STARVATION TEST (consumer-side stub): > 100 due intents, first 100 already
  attempted ⇒ the sweep still discovers intents 101+ (mechanical proof of
  §CTR-WAE-001b's invariant).
- Continuation unit tests: full-page cursor handoff (cursor = EXACT last-item
  strings), short-page termination, NO finite page cap (a stub feed with more
  full pages than any historical bound, e.g. >100, is still consumed to
  exhaustion), both-or-neither cursor propagation, per-request-error loud
  stop.
- svc-workflow side (external spec): keyset endpoint tests incl. tie-break
  at equal `nextEligibleAt`, 422 on half-cursor, first-window-occupied
  second-window-visible proof.

Affected regression at the port: broker / scheduler / agent-router /
demo-server / production-runtime suites under the pinned node with proxy env
stripped; pre-existing baseline failures documented, not caused.

## 5. Acceptance-unlocks resumption (mechanical; runs only after this Spec is accepted and merged)

At acceptance/merge time, the accepted
`AGENT_CORE_AGENT_SESSION_MESSAGING_V1.md` R4 gains a reciprocal amended-by
backlink (this candidate does not modify the accepted spec file itself).

1. Replay/port the frozen commits (b1f0bf9, 0806c71) onto the accepted-Spec
   base; NO redesign, NO V1 expansion.
2. Implement §CTR-WAE-001b consumer continuation + its tests (incl. the
   starvation test) — the only new code.
3. Re-run affected focused tests + affected regression.
4. ONE independent implementation re-audit (blocker union must be empty).
5. Re-declare READY_FOR_INTEGRATION. PRODUCTION_APPLY stays forbidden.
