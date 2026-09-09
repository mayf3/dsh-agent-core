---
spec_id: AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-10
revision: r3
revision_date: 2026-09-10
revision_note: >-
  r3 = independent review r2 blocker-union closure (3 ship blockers,
  records on PR #236 conversation): (1) restructured as a WHOLE-AUTHORITY
  successor — V1's full contract set is carried forward in this document
  (carried sections marked), supersedes replaces partial amendment, the
  ASM R4 source-kind extension and the external svc keyset-continuation
  consumption are inherited unchanged; (2) CTR-WAE-013 now defines a
  single ENTRY-STATE DISPATCH with exact outcomes (no-op on terminal
  replays preserving V1 terminal append-refusal; RECOVERY_INAPPLICABLE
  no-append when delivery-domain evidence exists, owned by unchanged V1
  reconcile; recovery_refused + terminal only for world-drift on an
  eligible-shaped attempt), plus dispatch-table tests; (3) lifecycle
  ordering unified to the Owner §13 sequence everywhere (controlled
  deployment -> identity repair through its own authority -> per-subject
  recovery). r2 had already closed the r1 PROVEN_ZERO window (durable
  pre-invocation delivery_started write-ahead on EVERY admission path;
  Router correlation query demoted to secondary one-directional gate) and
  the r1 taxonomy misquote; the r2 review explicitly confirmed both
  closed with no remaining invoked-yet-recoverable window.
supersedes:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V1 (accepted @ main f14d625, PR
    #219): WHOLE-AUTHORITY successor transaction. When this document is
    accepted and merged, V1 ceases to be authority in full; this document
    carries V1's complete contract set forward (verbatim unless explicitly
    marked as a V2 successor note) and changes ONLY the provably
    pre-admission resolution-failure recovery semantics. At acceptance
    time the accepted V1 file gains a reciprocal superseded-by backlink
    (§8; this candidate does not modify the accepted V1 file itself).
amends:
  - AGENT_CORE_AGENT_SESSION_MESSAGING_V1 — INHERITED VERBATIM from the
    superseded V1: the R4 trusted message-origin sidecar extension from
    ONE kind (`inter_agent`) to TWO (`+ workflow_execution`) is carried
    forward UNCHANGED (see CTR-WAE-004). No other R4 semantic changes.
external:
  - svc-workflow SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1
    (consumed UNCHANGED by CTR-WAE-001b; inherited from V1)
authoring_authority_basis: >-
  Owner ruling 2026-09-10: DRAFT_MINIMAL_SUCCESSOR_AUTHORITY = APPROVED.
  This is authoring authority ONLY — it is NOT exact-head acceptance and
  NOT implementation authority. The same ruling froze PR #224 at
  b3483d9592b19a17a121db71889681675fc1ac0b (CURRENT_PR_224_ACCEPTANCE =
  NO, CURRENT_PR_224_MERGE = NO, IMPLEMENTATION_BEFORE_SUCCESSOR_ACCEPTANCE
  = NO, PRODUCTION_APPLY = NO), named this successor
  AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2, allowed the formal-amendment or
  successor form ("必须形成明确 successor authority"), and ordered that no
  further commits be made to PR #224 for review-passing purposes.
external_note: >-
  "Minimal" in this successor means the SEMANTIC delta is minimal (only
  the recovery semantics of CTR-WAE-002/003/005 plus the single
  CTR-WAE-006 exception that follows from them, and the one mechanical
  fence — the delivery_started write-ahead record — needed to make
  pre-admission provable). It does NOT mean a partial amendment of an
  accepted authority: per repository governance
  (.agents/README.md standing order 6; .agents/local/README.md authority
  rules) a change to accepted contract semantics is enacted by a
  whole-authority supersession transaction, which is the form of this
  document, exactly as AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2
  superseded V1 of that authority before it.
implementation_basis: >-
  Pure docs candidate on github/main 1328bd1 parent line. Per the
  repository Development Grammar (.agents/README.md,
  AGENT_DEVELOPMENT_GOVERNANCE_V1) and local governance
  (.agents/local/README.md), merge / implementation authority is an
  ACCEPTED Spec only. No implementation exists under this Spec; PR #224
  stays frozen and may only be rebased/ported AFTER this Spec is accepted,
  restricted to the accepted delta (§8).
frozen_implementation_candidate: NONE
---

# AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 — whole-authority successor (minimal semantic delta: pre-admission recovery)

## 0. What this successor is — and the one semantic it changes

This document SUPERSEDES accepted AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V1
in full. V1's architecture, reuse map, due-feed contract, keyset
continuation, admission/provenance contract, reconcile judgment, settle
probe, Assistance boundary, boundaries-kept contract, and SETTLED
semantics are carried forward VERBATIM (§2–§3 below; each carried section
is marked). The architecture is NOT reopened; nothing is redesigned.

The ONE semantic changed — closing the Owner-ruled `REAL_SEMANTIC_GAP`
(2026-09-10): under V1, a canonical-resolution failure lands terminal
NEEDS_REVIEW and the fenced attempt can never execute, even after
identity/mapping repair, because the fence rightly forbids a second
attempt. The composed real-world deadlock:

```
canonical Principal resolution unavailable
→ attempt minted (deterministic fence)
→ terminal NEEDS_REVIEW under V1
→ identity/mapping later repaired through its own authority
→ the SAME NodeVisit can nevertheless NEVER execute
   (a second attempt is forbidden by CTR-WAE-002 — correctly)
```

The fence is right; the terminality is wrong. A resolution failure that
mechanically happens BEFORE any delivery admission has zero external side
effect by construction, so recovering it can never double-deliver. V2
changes exactly that class: **provably pre-admission resolution failure
becomes a recoverable-blocked LIVE phase of the SAME attempt, continuable
only through an explicit, governance-authorized, controlled recovery**
(CTR-WAE-011/012/013) — and nothing else.

Making "pre-admission" PROVABLE is itself part of this successor: every
admission path gains exactly one durable pre-invocation delivery-start
record (write-ahead intent, CTR-WAE-012/013), so "never invoked" becomes
a ledger-provable fact rather than an inference from silence — without
it, an invocation that crashed before its Router record was minted would
be indistinguishable from no invocation at all.

New non-goals on top of ALL V1 non-goals (carried in §0.1): no automatic
retry engine of any kind (no re-resolve interval, no backoff, no queue,
no worker, no new scheduler, no watcher); no model-facing recovery tool;
no recovery triggered by poller ticks or reconcile passes; no
identity-truth change (§4); no reclassification of any post-invocation
failure class; no second attempt id, ever; no rewrite of ledger history.

### 0.1 V1 §0 carried forward (verbatim, unchanged)

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
replacement for judgment work. Explicit non-goals (carried; V1's list
plus this successor's additions in §0): lease/renew, heartbeat,
generation/fencing protocols, retry engines, reassignment, worker pools,
load balancing, parallel workflows, SLA/escalation, outbox/event bus, new
databases or services, agent ACK/heartbeat tools, generic operators.

Business consistency stays ENTIRELY with svc-workflow's existing state
version / idempotency-key / transaction semantics. The design is
optimistic on reads (re-polling, re-reading, machine re-checks are always
safe) and conservative on writes (DSH never schedules a second attempt
for the same NodeVisit; unknown outcomes never produce a second
execution).

## 1. Frozen invariants (gates this successor may never move)

```
ONE_NODE_VISIT
→ at most ONE deterministic attemptId   (CTR-WAE-002 formula unchanged)
→ at most ONE Agent Run admission       (CTR-WAE-004 gate unchanged)

SECOND_ATTEMPT_ID = FORBIDDEN
SECOND_RUN        = FORBIDDEN
UNKNOWN_DELIVERY  = NEVER ZERO SIDE EFFECT
```

Recovery continues the SAME attempt through the SAME deterministic id. It
is not, and must never degenerate into, "failed attempt → create second
attempt". V1's fence machinery (beginAttemptIfAbsent, FIFO chain,
cross-process OwnerLock, fresh replay under the lock) is carried forward
unchanged and is the mechanical reason the invariant survives recovery.

Identity remains independently authoritative (Owner ruling §9): the exact
resolver authority (AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2) stands
untouched; resolution is re-executed fresh at recovery, never cached, never
substituted; no Principal→agent map may be hardcoded anywhere in engine,
config, or tests; the canonical id is expected EVIDENCE to assert against,
never an input.

## 2. Reuse map (carried verbatim from V1 §1 — unchanged)

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

## 3. Contracts (carried from V1; V2 successor notes mark every change)

### CTR-WAE-001 — due-feed consumption (carried verbatim — unchanged)

The engine polls `workflow_dispatch_intents.list` through the broker gateway
(token + HTTP stay in the trusted parent transport; no new HTTP client, no
new scope handling). The poller Principal must hold the server-side
GLOBAL_SCHEDULER_READ binding (deployment provisioning, out of scope here).
Malformed feed records are skipped loudly, never admitted, never silently
dropped. No assignee/due filters are requested; the svc-workflow API surface
is extended ONLY by the keyset continuation of §CTR-WAE-001b (external
`SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1`), nothing else.

### CTR-WAE-001b — keyset continuation (carried verbatim — unchanged)

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

### CTR-WAE-002 — the one-attempt fence (carried; V2 successor note appends the recovery carve-out)

`attemptId = wfeat-<sha256(lowercase(nodeVisitId)).slice(0,24)>` —
deterministic, clock-free, stable across pollers/restarts. The ledger's
`beginAttemptIfAbsent` is the ONLY way to mint an attempt; it appends
`attempt_planned` iff the NodeVisit has NO attempt yet. ANY existing attempt —
ACTIVE, SETTLED or NEEDS_REVIEW — blocks a second one. Duplicate triggers
(re-poll, second dispatch intent for the same visit, HR double-fire,
post-restart replay) therefore cannot create a second execution on the DSH
path. Race safety: in-process FIFO chain + cross-process OwnerLock + fresh
replay under the lock before every mutation.

**V2 successor note (recovery carve-out; the fence itself is unchanged).**
"ANY existing attempt blocks a SECOND one" is restated as permanent: the
fence still guarantees at most one attempt per NodeVisit and, with
CTR-WAE-004, at most one Run admission per attempt. What changes (and only
in CTR-WAE-011) is the STATE a resolution-phase failure lands in: it no
longer terminates the attempt. Recovery never mints a second attempt id
and never bypasses `beginAttemptIfAbsent`.

### CTR-WAE-003 — canonical assignee resolution (carried; V2 successor note amends the failure destination)

`ownerPrincipalId` resolves through the agent-principal-resolution authority
(auth-service is the identity authority; the local definition registry proves
deliverability). Resolution failure ⇒ the attempt lands NEEDS_REVIEW
(`resolve_failed:<code>`) with ZERO Runs admitted. No display-name fallback,
no agent reassignment, no retry (V1).

**V2 successor note (the amendment).** The final sentence is superseded:
a resolution failure now lands the RESOLUTION_BLOCKED live phase of the
SAME attempt (CTR-WAE-011), not terminal NEEDS_REVIEW. ZERO Runs admitted
on failure stands exactly. "No display-name fallback, no agent
reassignment" stand exactly. "No retry" is restated as: no AUTOMATIC retry
of any kind, ever — the ONLY continuation is the explicit, authorized,
controlled recovery of CTR-WAE-013, which is not a retry engine.

### CTR-WAE-004 — Run admission and provenance (carried; V2 successor note declares the write-ahead sequence addition)

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
Agent Definition id exactly as before. The instruction text carries the
exact coordinates and the special semantics (acknowledgments are not facts;
the transition receipt is the only commitment; version-conflict allows
exactly one re-read+retry; blocked work goes to the existing Assistance
surface, never a fabricated submission).

**V2 successor note (one declared sequence addition; the admission gate is
unchanged).** The delivery SEQUENCE gains exactly one durable pre-invocation
append: the `delivery_started` write-ahead record (CTR-WAE-012/013),
appended BEFORE any `router.deliver` call on EVERY admission path. It
changes no admission semantics, adds no field to the Router call, and is
invisible to the Router; it exists because it is the mechanical fence that
makes pre-admission provable (without it, "never invoked" would be an
inference from silence and an invoked-but-crashed delivery could be
wrongfully recovered).

### CTR-WAE-005 — ledger linkage (carried; V2 successor note adds the recovery lifecycle)

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

**V2 successor note (lifecycle extension; nothing removed).** The event
stream gains the recovery lifecycle of CTR-WAE-012 (`delivery_started`,
`resolution_blocked`, `recovery_authorized`, `recovery_refused`). The
append-only, torn-tail-tolerant, terminal-refusing, fact/ID-only rules and
the three-state machine (ACTIVE | SETTLED | NEEDS_REVIEW; no new terminal
state) are unchanged. Historical V1-ledger events are never rewritten,
truncated, or deleted; only the projection's state mapping for the
`resolve_failed:` reason family changes (CTR-WAE-011).

### CTR-WAE-006 — reconcile judgment (carried; V2 successor note adds ONE exception row)

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

**V2 successor note (the single exception).** A RESOLUTION_BLOCKED attempt
has no Run linkage BY CONSTRUCTION, so the first row ("no verified Run
linkage → NEEDS_REVIEW `delivery_unverified`") MUST NOT fire on it — it
would silently recreate the V1 terminality on the next pass. Reconcile
SKIPS blocked attempts (leaves them blocked, counts them loud in engine
status). Every other row, the read-only discipline, and the no-wake rule
stand. Reconcile never performs recovery. A `delivery_started` attempt is
NOT exempt (it takes the unchanged rows, e.g. `delivery_unverified` while
pending evidence).

### CTR-WAE-007 — settle probe and the visibility invariant (carried verbatim — unchanged)

The probe reads instance detail AS THE TARGET AGENT (at admission the agent
IS the due visit's canonical assignee; node-visit rows are immutable). Wire
shapes: `full` carries `current_node_visit_id` (strict lowercase compare ⇒
settled iff different); `historical_participant` carries no visit id but
mechanically PROVES our visit is no longer current — if it were still
current, its (immutable) assignee, our agent, would hold CurrentAssigneeFull.
Unreadable states (error, missing fields, unknown visibility) are
`unavailable` ⇒ NEEDS_REVIEW, never silently settled. The probe never calls
`wake` (reconcile must not mutate eligibility).

### CTR-WAE-008 — Assistance (carried verbatim — unchanged)

Directly reused: the target Agent opens existing assistance cases with its
own Principal when blocked; no BLOCKED/report/resume machinery is added here.
svc-workflow currently exposes no machine-checkable per-instance assistance
query, so V1 reconcile cannot distinguish "open assistance" from other
no-submission ends — both land NEEDS_REVIEW (HR classifies via its existing
Assistance inbox; manager-level work stays with HR per the goal's
HR_AFTER_V1). This is the V1 boundary, ruled NOT a blocker; no fake probe, no
API expansion.

### CTR-WAE-009 — boundaries kept (carried; V2 successor note adds the no-auto-recovery carve-out)

No svc-workflow semantic change beyond the external keyset-continuation
contract; no second transition write entry; broker manifests unchanged;
Scheduler unchanged and not a dispatcher; HR is not the normal
transport/retry daemon anymore (manager work only); no Redis/Postgres/
new service; outcome-unknown and side-effect-unknown never auto-rerun; no
automatic agent switching.

**V2 successor note.** The V2 carve-out is explicit: pre-admission-blocked
attempts never AUTO-recover — recovery is only ever the explicit
CTR-WAE-013 operation carrying an authorityRef. No other boundary moves.
The seven-field svc due-feed projection is untouched; no lineage-resolved
Principal is added to the feed; resolver choice stays a dsh-consumer
decision. The earlier svc dispatch identity-bridge proposal remains
REJECTED (violated the svc architecture's seven-field projection, exact-
resolution V2, and the accepted reconciliation lineage's "not a Principal
resolver" clause); reopening it would require NEW_EVIDENCE — none exists.
AGENT_CORE_AGENT_SESSION_MESSAGING_V1 receives no further amendment (the
R4 extension inherited via CTR-WAE-004 is the last word). Assignment data
on existing instances is NEVER changed to bypass resolution.

### CTR-WAE-010 — SETTLED semantics (carried verbatim — unchanged)

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

### CTR-WAE-011 — pre-admission recoverable boundary (NEW; amends the destinations fixed by CTR-WAE-002/003)

**Definition (resolution-phase failure).** A resolution failure is an
emission of the CTR-WAE-003 resolution phase. By engine construction that
phase strictly precedes any `router.deliver` invocation (CTR-WAE-004), so
at the moment of failure no delivery admission side effect exists. Ledger
shape: the attempt has phase `planned`, carries a
`resolve_failed:<code>` classification, has NO `run_delivered` event, and
has NO durable pre-invocation delivery-start record (CTR-WAE-012/013) —
that record is what makes "never invoked" mechanically provable at all;
without it, "no delivery evidence in the ledger" would be unprovable
silence, not PROVEN_ZERO.

**Reclassification (the amendment).** Such an attempt lands in phase
`RESOLUTION_BLOCKED` of state ACTIVE — a live, continuable phase — NOT in
terminal NEEDS_REVIEW. V1's terminal reading of `resolve_failed` is hereby
superseded. Every post-invocation failure class keeps V1 semantics
exactly: `delivery_rejected:<code>` and all delivery/outcome-unknown paths
remain terminal NEEDS_REVIEW, fail-closed, non-recoverable.

**Historical ledgers (projection-only).** V1-era ledger events
`delivery_failed{reason:"resolve_failed:<code>"}` already on disk are
NOT rewritten, truncated, or deleted (bytes unchanged). The replay
projection changes only their STATE MAPPING: reason prefix
`resolve_failed:` projects to ACTIVE/RESOLUTION_BLOCKED; every other
`delivery_failed` reason (`delivery_rejected:*` and any other) keeps
projecting terminal NEEDS_REVIEW. The discrimination is mechanical
(reason-prefix, deterministic at replay, no human input). Recovery
eligibility of a HISTORICAL attempt rests on exactly this event evidence:
the `resolve_failed` emission proves the engine was still in the
resolution phase when the attempt's single V1 pass ended, so deliver was
never reached. A historical attempt with NO `resolve_failed` event
(planned-only) is NOT eligible — its zero-invocation status is unprovable
retroactively without the V2 write-ahead record — and keeps the V1
terminal paths (reconcile `delivery_unverified` → NEEDS_REVIEW).
Conservative false refusals are the correct failure direction; the
reverse is forbidden.

**Code classification.** ALL `resolve_failed:<code>` emissions belong to
the blocked class, where `<code>` ranges over the resolution-phase failure
vocabulary exactly as fixed by the identity authorities: the Auth-target
codes of AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 CTR-EPAR-004
(`principal_not_found`, `principal_not_agent`, `principal_disabled`,
`agent_mapping_missing`, `identity_resolution_ambiguous`, and
`identity_resolution_unavailable` for every 500/504/timeout/malformed
read), the preserved Broker responsibilities named in that same clause
(`credential_missing`, `credential_invalid`, `access_denied`,
`transport_failure`), and the local-definition layer codes
(`target_not_found`, `target_disabled`). Implementation-level naming
aliases (e.g. the broker capability manifest renders the
credential-absence responsibility as `credential_unavailable`) do NOT
change the classification; classification keys on the resolution PHASE
(pre-admission by construction), never on the code string, and no code is
special-cased in either direction. The core condition at RECOVERY time is
not the code but the fresh judgment:

```
EXTERNAL_DELIVERY_SIDE_EFFECT = PROVEN_ZERO
```

which is established per CTR-WAE-013's entry dispatch at every recovery
invocation. A blocked attempt is therefore ELIGIBLE — never automatically
recoverable.

### CTR-WAE-012 — ledger recovery lifecycle (NEW; extends CTR-WAE-005)

The event stream stays append-only, torn-tail-tolerant, terminal-refusing,
and fact/ID-only (no workflow context, no message bodies). NO truncation,
NO reset, NO deletion, NO historical rewrite — of any event, ever.

Indicative event additions (exact names/fields are an implementation-
investigation decision; the CONTRACT semantics below are frozen):

- `delivery_started { attemptId, at }` — the durable WRITE-AHEAD INTENT
  record, appended BEFORE any `router.deliver` invocation on EVERY
  admission path — the original path included, not only recovery. At most
  ONE per attempt; a second is a corrupt-ledger fail-loud. Its presence
  unconditionally classifies the attempt
  DELIVERY_STARTED_OR_OUTCOME_UNKNOWN: never recovery-eligible, whatever
  any other store answers; reconcile treats it under the UNCHANGED V1
  rows (`delivery_unverified` family). Its absence on a blocked attempt
  is the mechanical proof of never-invoked.
- `resolution_blocked { attemptId, code, at }` — appended when the
  resolution phase fails; attempt phase = RESOLUTION_BLOCKED (ACTIVE).
  Repeated resolution failures (e.g. each authorized recovery that fails
  resolution again) append fresh events; a second `attempt_planned` for
  the same NodeVisit remains impossible (CTR-WAE-002 unchanged).
- `recovery_authorized { attemptId, authorityRef, at }` — appended ONLY
  by the controlled recovery operation of CTR-WAE-013, ALWAYS AFTER its
  fresh preconditions pass and ALWAYS BEFORE any resolution/delivery
  re-execution (never on the refusal or no-op paths); `authorityRef` is
  the exact governance reference (goal directive / Owner ruling)
  authorizing THIS recovery. Multiple authorization events may exist over
  an attempt's lifetime; none of them can create a second Run — the
  CTR-WAE-002/004 gates are untouched and remain the only admission path.
- `recovery_refused { attemptId, authorityRef, refused: <which>, at }` —
  appended ONLY on the world-drift refusal path of the CTR-WAE-013 entry
  dispatch (an eligible-shaped attempt whose instance/visit/assignee
  reality drifted); it carries the same `authorityRef` for audit; the
  attempt then lands terminal NEEDS_REVIEW (`recovery_refused:<which>`).
  Terminal attempts NEVER receive this event (entry dispatch E3 no-ops —
  the V1 terminal append-refusal is preserved, which is exactly why
  refused-once attempts cannot be re-refused or re-run).

After a successful recovery the attempt proceeds through the UNCHANGED
events — `run_delivered` (same attemptId, requestId = attemptId) →
`reconciled` — and its terminal states are exactly V1's
(SETTLED | NEEDS_REVIEW). No new terminal state exists; NEEDS_REVIEW
remains the only human-escalation terminal.

**Mechanical discriminability (frozen contract).** The projection must
always distinguish, mechanically, (a) PRE_ADMISSION_BLOCKED from (b)
DELIVERY_STARTED_OR_OUTCOME_UNKNOWN. The PRIMARY fence is the durable
pre-invocation `delivery_started` record: because it is appended BEFORE
`router.deliver` is invoked on EVERY admission path, its ABSENCE is
mechanical proof that no invocation was even attempted (any invocation
attempt must first append it — there is no invocation-to-record crash
window left), and its PRESENCE unconditionally places the attempt in
class (b). The fresh Router correlation query (requestId = attemptId;
only "no record ever existed" passes) remains a REQUIRED SECONDARY gate
whose ONLY legal effect is to refuse recovery: it is one-directional and
can never override the ledger — a never-existed store answer with a
`delivery_started` record present (e.g. after a correlation-index
restart/loss) still refuses. Ledger class (a) determines ELIGIBILITY;
PROVEN_ZERO is proven fresh at every recovery invocation and is never a
persistent property of an attempt.

### CTR-WAE-013 — the controlled recovery operation (NEW; the anti-retry-engine contract)

**Surface.** Exactly ONE narrow internal/control-plane operation of the
workflow-execution engine (the existing control-plane/CLI seam class). It
MUST NOT be: a model-facing broker tool or capability; reachable from any
Agent tool surface; invoked by the poller tick; invoked by reconcile; or
invoked by any timer/watcher/queue. There is no scheduling semantics of
any kind between explicit authorized invocations: a blocked attempt simply
waits, loudly visible in engine status/reports (visibility is not
triggering).

**Authorization (call gate).** Every invocation MUST carry an explicit
`authorityRef` (a named Owner ruling / goal directive). No authorityRef ⇒
refuse the call with zero side effects and NOTHING appended (dispatch E1).

**Entry-state dispatch (frozen; evaluated under the SAME per-attempt FIFO
chain + cross-process OwnerLock + fresh replay-under-lock as every V1
mutation — CTR-WAE-002 race machinery, unchanged; evaluated in order,
first match wins):**

| # | entry state | outcome | ledger effect |
|---|---|---|---|
| E1 | no/empty authorityRef | refuse the call | none |
| E2 | no attempt exists for the nodeVisitId | `NO_OP_NO_ATTEMPT` | none |
| E3 | attempt is TERMINAL (SETTLED, or NEEDS_REVIEW of any cause incl. prior `recovery_refused`) | `NO_OP_TERMINAL` | none — the V1 terminal append-refusal is preserved; a replayed recovery command can never un-terminal or re-append |
| E4 | attempt non-terminal but delivery-domain evidence exists: any `delivery_started` / `run_delivered` / `delivery_rejected` / reconciled outcome-unknown handle in the ledger, OR the fresh Router correlation query answers anything other than "no record ever existed" (pending/settled/evicted/restart_lost), OR the store is unreachable | `RECOVERY_INAPPLICABLE:<evidence-class>` | none from the recovery operation — recovery simply does not apply; the attempt remains owned by the UNCHANGED V1 machinery (reconcile lands the V1 verdict: `delivery_unverified`, `run_running`, `run_outcome_unknown`, `settle_check_unavailable`, …). Appending a refusal here would mislabel a delivery-domain attempt as a failed recovery |
| E5 | attempt is eligible-shaped (phase planned/RESOLUTION_BLOCKED with `resolve_failed` evidence per CTR-WAE-011, no delivery-domain evidence, store never-existed) BUT the world has drifted: instance gone, NodeVisit no longer current (`nodeVisitId` exact-compare), `assigneePrincipalId` changed, or a business transition past the visit is observed | `RECOVERY_REFUSED:<which>` | append `recovery_refused {authorityRef, which}` ⇒ attempt lands terminal NEEDS_REVIEW — it can never validly execute, so the human path is correct |
| E6 | eligible-shaped and world intact | PROCEED | append `recovery_authorized {authorityRef}` (durable) → re-run resolution exactly per CTR-WAE-003 (fresh reads; no cache): failure ⇒ append fresh `resolution_blocked` with the new code, attempt stays blocked, ZERO side effects; success ⇒ append `delivery_started` (durable, BEFORE any deliver call) ⇒ invoke delivery exactly per CTR-WAE-004 — ONE Run, same attemptId, `requestId = attemptId`, unchanged sidecar ⇒ `run_delivered` and unchanged V1 events on success, `delivery_failed{reason:"delivery_rejected:<code>"}` (terminal, V1 semantics) on synchronous rejection |

Every Owner §8 precondition is enforced inside this dispatch (E4 carries
the zero-delivery-evidence family; E5 carries the instance/visit/assignee/
transition family). There is NO path on which a precondition failure still
leads to delivery: E4/E5/E1 all end without admission. Caller outcomes are
exactly: `RECOVERED_RUN_ADMITTED` (E6 delivered) | `STILL_BLOCKED:<code>`
(E6 re-blocked) | `RECOVERY_REFUSED:<which>` (E5) |
`RECOVERY_INAPPLICABLE:<evidence-class>` (E4) | `NO_OP_*` (E2/E3) |
call-refused (E1).

**Concurrency and crash boundaries (frozen):**

- Concurrent second caller: serialized by the OwnerLock/FIFO machinery;
  observes the dispatch outcome of the post-first-caller state (no-op,
  inapplicable, or a fresh block) and can never double-admit (the
  CTR-WAE-004 gate is the only admission path).
- Crash BEFORE the durable `delivery_started` append (including
  before/inside re-resolution): the ledger mechanically proves
  never-invoked, and the fresh Router-store query confirms ⇒ still
  eligible; a later authorized invocation proceeds (Owner acceptance case
  D).
- Crash AFTER `delivery_started` is durable, at ANY point before
  `run_delivered` is durable (including during the `router.deliver` call
  and before receipt durability): class DELIVERY_STARTED_OR_OUTCOME_UNKNOWN
  ⇒ the ledger record alone puts every later invocation on E4 ⇒ never
  recoverable, EVEN IF the Router store later answers "no record ever
  existed" (its answer is never primary) ⇒ reconcile lands NEEDS_REVIEW
  (V1 CTR-WAE-006 stands; Owner acceptance case E).
- NodeVisit moved / assignee changed / any world drift before recovery ⇒
  E5 REFUSED ⇒ NEEDS_REVIEW (Owner acceptance case F).

## 4. Identity boundary (record-only; NO identity semantics in this successor)

The dogfood deadlock has an identity half that this successor deliberately
does NOT solve (Owner ruling §9/§10). Recorded facts:

- The historical assignment Principal
  `61819256-07e1-4bd0-adea-e93e51243fa1` maps, in Auth, to a legacy-
  grammar (non-canonical) agent_id; it therefore fails the exact
  resolver's canonical-agent gate
  (AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2 CTR-EPAR-003 — stored
  value is returned verbatim and never rewritten; grammar/canonicality
  fail-closed), classified `agent_mapping_missing`.
- The canonical id `agt_writing-style-analyst-agent` is held by the
  formal successor Principal (recorded in goal evidence, prefix
  `9e3adced…`), which is an enabled member of the subject domain; the
  Workflow lineage for the historical Principal already exists and is not
  in dispute here.
- Auth enforces `machine_principals.agent_id @unique` (prisma schema,
  recorded frozen in AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1): two
  Principals cannot hold one canonical id simultaneously.

**Determination (Owner ruling §10 branch taken):** repairing that mapping
CONFLICTS with accepted authority — the `@unique` constraint makes the
direct repair collide with the successor Principal's holding, and no
accepted authority defines an authorized agent_id rebind operation
(AGENT_CORE_AGENT_CREDENTIAL_PROVISIONING_V1 governs the credential/secret
lifecycle and freezes auth-service as the sole binding authority without a
rebind path; the resolution V2 spec governs read-side exactness only and
forbids rewriting stored values at resolution time). Therefore: STOP on
identity; a SEPARATE `IDENTITY_AUTHORITY_SUCCESSOR_REQUIRED` must carry
the exact conflicting clauses. It is out of scope here and MUST NOT be
folded into this successor or its implementation.

**Consequence for recovery (fail-closed by design).** Until identity is
repaired through its own valid authority, an authorized recovery of a
blocked dogfood attempt re-runs resolution, fails with the same
`agent_mapping_missing`-class code, appends a fresh `resolution_blocked`,
and admits ZERO Runs — idempotent, loud, correct. Recovery authorization
and identity repair are independent acts under independent authorities;
neither approximates nor substitutes for the other.

## 5. Required dogfood (acceptance-gated; NO replacement instances)

Subjects (frozen by Owner ruling §11; full UUIDs from recorded artifacts,
not guessed):

```
Subject A = cebf4816-c664-40cb-9b61-3fa330ad1c39
Subject B = 5709a28e-3938-4b0e-b878-59711f5341e8
common assignee Principal = 61819256-07e1-4bd0-adea-e93e51243fa1
```

Per subject, the required terminal proof:

```
formal exact resolver → SAME canonical Agent
  (agt_writing-style-analyst-agent asserted as EXPECTED EVIDENCE only)
→ one explicitly authorized controlled recovery (authorityRef on record)
→ exactly ONE Agent Run (one attemptId, one run_delivered)
→ target-own-context verification (the Run executes as the canonical
  Agent's own Principal context)
```

Lifecycle order is the Owner §13 sequence, uniformly (see §7): controlled
deployment (step 12) → identity repair through its own authority (step
13) → per-subject recovery (step 14) → target-own-context verification
(step 15). In the window between deployment and identity repair, an
authorized recovery re-blocks fail-closed with zero Runs (§4) — that is
the designed behavior, not a defect. No replacement workflow instance, no
assignee change, no direct DB write, no display-name fallback, no
hardcoded mapping — the Owner's §14 refusal list is adopted verbatim as
successor boundaries.

## 6. Tests (acceptance-critical; a happy-path-only suite is a REVISE)

V1 §4's suite is carried (port keeps it green): ledger
fence/dedupe/concurrency/restart/torn-tail/terminal-refusal; judgment
tables (incl. run completed + "完成了" + visit still current ⇒
NEEDS_REVIEW, never rerun); instruction determinism/semantics; engine
chain; Router workflow-execution-origin tests; demo-server session-seam
tests; the B2 starvation and continuation suites. Added by this
successor, each mechanically asserted in
`packages/workflow-execution/test/`:

- A: resolution fails → ZERO Run → (simulated) identity repair → explicit
  authorized recovery → exactly ONE Run, same attemptId, unchanged events
  thereafter.
- B: recovery command replay after completed recovery → `NO_OP_TERMINAL`,
  no ledger append, no duplicate Run, no second admission.
- C: two concurrent recovery invocations → exactly one recovery owner
  (OwnerLock/FIFO serialization proven), at most one Run.
- D: crash before the durable `delivery_started` append (including
  before/inside re-resolution) → ledger mechanically proves never-invoked,
  Router-store never-existed passes as the secondary gate → still
  eligible → later authorized recovery succeeds.
- E: crash after the `delivery_started` append, before `run_delivered`
  durability (any point, including during the deliver call) → every later
  invocation lands E4 → NOT recoverable → reconcile lands NEEDS_REVIEW.
- STORE-FALSE-NEGATIVE (r1 blocker-2 regression): a `delivery_started`
  record present AND the fresh Router correlation query answers "never
  existed" (restarted/lost correlation index) → dispatch E4 STILL applies
  → no recovery, no append; a second Run is impossible.
- ENTRY-DISPATCH TABLE: E1 no-authorityRef refuses with zero appends; E2
  no-attempt no-ops; E3 terminal no-ops with zero appends (asserting the
  V1 terminal append-refusal survives); E4 delivery-domain evidence (each
  class) yields `RECOVERY_INAPPLICABLE` with zero appends and the
  unchanged reconcile verdict; E5 world drift yields `recovery_refused`
  append + terminal NEEDS_REVIEW with the exact `<which>`.
- Blocked-attempt reconcile exemption: RESOLUTION_BLOCKED never takes the
  `delivery_unverified` NEEDS_REVIEW verdict; `delivery_started` attempts
  still do.
- Historical projection: a V1-era
  `delivery_failed{reason:"resolve_failed:…"}` projects to
  ACTIVE/RESOLUTION_BLOCKED with ledger bytes unchanged;
  `delivery_rejected:*` keeps projecting terminal NEEDS_REVIEW; a
  historical planned-only attempt (no `resolve_failed`) is NOT
  recovery-eligible (E4/E5 cannot be reached; V1 terminal paths only).
- Lifecycle integrity: at most one `delivery_started` per attempt (second
  = corrupt fail-loud); `recovery_authorized` never precedes its passing
  preconditions and never appears on E1–E5 paths; `resolution_blocked`
  re-appends never re-mint `attempt_planned`.
- Authorization discipline: no-authorityRef invocation refused with zero
  side effects; `recovery_authorized` records the exact reference.
- Surface discipline (negative existence assertion): no model-facing
  tool/manifest exposes recovery; poller tick and reconcile passes never
  invoke it.
- Identity-unrepaired behavior: authorized recovery re-blocks with the
  fresh code and admits ZERO Runs (fail-closed proof).

Affected regression at port time: broker / scheduler / agent-router /
demo-server / production-runtime suites under the pinned node with proxy
env stripped; pre-existing baseline failures documented, not caused.

## 7. Production wiring (carried from V1 §3; recovery-operation mounting and the unified deployment order added)

`production-runtime/src/workflow-execution-runtime.js` mounts the engine
with real seams; `compose.js` mounts it after the broker gateway +
agent-principal-resolution rows and starts/stops it with the runtime.
Enabled only when `WORKFLOW_EXECUTION_POLLER_AGENT_ID` (or compose
`workflowExecution.pollerAgentId`) is configured; otherwise the mount is
honest-disabled (ledger evidence-only, `start()` logs the disabled line,
never fakes liveness). Deployment prerequisites (out of scope here): the
poller agent's credential in the canonical store + GLOBAL_SCHEDULER_READ
binding + `auth.agent.resolve` grant + the external keyset-continuation
svc-workflow deployed first (§CTR-WAE-001b).

The recovery operation mounts with the engine (no additional enable flag):
it is individually inert without an explicit authorityRef per invocation,
which is the authorization mechanism. PRODUCTION_APPLY_ALLOWED = NO for
the authoring goal.

**Deployment order of record (Owner §13 sequence, identical in §5 and
§8):** svc keyset-continuation build first (already-deployed prerequisite)
→ (12) controlled deployment of this successor's implementation → (13)
identity repair through its own valid authority (separate successor;
`IDENTITY_AUTHORITY_SUCCESSOR_REQUIRED`) → (14) per-subject recovery of
Subjects A/B (§5) → (15) target-own-context verification. In the window
between (12) and (13), authorized recovery re-blocks fail-closed with
zero Runs — designed behavior (§4).

## 8. Governance sequencing (frozen; from the Owner ruling §13)

1. PR #224 stays frozen at `b3483d9592b19a17a121db71889681675fc1ac0b`.
2. THIS document is the step-2 product (docs-only successor authority
   candidate).
3. Independent semantic review of this exact head (reviewer did not
   author the delta).
4. Exact successor head returned to the Owner.
5. Owner exact-head acceptance (THE gate; this document's `proposed`
   status carries no authority until then).
6. Merge successor authority. At merge, the accepted V1 file gains a
   reciprocal superseded-by backlink pointing at this Spec (this
   candidate does not modify the accepted V1 file itself — the backlink
   is the acceptance-time transaction, mirroring V1's own ASM R4
   backlink obligation); the inherited ASM R4 amendment relationship
   continues to hold unchanged via CTR-WAE-004.
7. Rebase/port the frozen PR #224 implementation onto the accepted base.
8. Implement ONLY the accepted recovery delta (CTR-WAE-011/012/013).
9. Focused + regression + §6 crash/concurrency/dispatch matrix.
10. Independent implementation review.
11. Merge.
12. Controlled deployment.
13. Identity repair through its own valid authority (separate successor —
    `IDENTITY_AUTHORITY_SUCCESSOR_REQUIRED`; MUST NOT ride this Spec).
14. Recover existing Subjects A/B (§5).
15. Target-own-context verification.

Steps 4/5 may never be skipped. Nothing in this document authorizes
implementation, deployment, identity mutation, or production writes.
