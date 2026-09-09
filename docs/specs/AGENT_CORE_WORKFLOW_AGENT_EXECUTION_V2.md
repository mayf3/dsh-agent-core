---
spec_id: AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-10
revision: r2
revision_date: 2026-09-10
revision_note: >-
  r2 = independent semantic review r1 blocker-union closure (4 ship
  blockers, recorded on PR conversation): (1) explicit amendment-form
  governance basis added (§0.1); (2) EXTERNAL_DELIVERY_SIDE_EFFECT =
  PROVEN_ZERO made mechanically establishable via a durable pre-invocation
  delivery-start record on EVERY admission path — the Router-store
  never-existed query alone had an invocation-to-record crash window (the
  reviewer's counterexample) and is demoted to a secondary, never-primary,
  gate; (3) one deterministic refusal/authorization ordering (fresh
  preconditions first; recovery_refused carries authorityRef); (4) the
  CTR-EPAR-004 taxonomy quoted at spec level with implementation naming
  aliases declared non-classifying.
supersedes: []
amends:
  - AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V1 (accepted @ main f14d625, PR #219):
    NARROW successor amendment. ONLY the provably pre-admission
    resolution-failure recovery semantics change (CTR-WAE-002 wording
    carve-out, CTR-WAE-003 failure classification, CTR-WAE-005 ledger
    lifecycle, plus the CTR-WAE-006 reconcile exception that follows from
    them). Every other V1 contract, boundary, and non-goal stands verbatim.
    This is NOT a redesign and NOT a whole-spec supersession
    (supersedes: []).
authoring_authority_basis: >-
  Owner ruling 2026-09-10: DRAFT_MINIMAL_SUCCESSOR_AUTHORITY = APPROVED.
  This is authoring authority ONLY — it is NOT exact-head acceptance and NOT
  implementation authority. The same ruling froze PR #224 at
  b3483d9592b19a17a121db71889681675fc1ac0b (CURRENT_PR_224_ACCEPTANCE = NO,
  CURRENT_PR_224_MERGE = NO, IMPLEMENTATION_BEFORE_SUCCESSOR_ACCEPTANCE = NO,
  PRODUCTION_APPLY = NO) and ordered that no further commits be made to it
  for review-passing purposes.
external: []
implementation_basis: >-
  Pure docs candidate on github/main 62236a7. Per the repository Development
  Grammar (.agents/README.md, AGENT_DEVELOPMENT_GOVERNANCE_V1) and local
  governance (.agents/local/README.md), merge / implementation authority is
  an ACCEPTED Spec only. No implementation exists under this Spec; PR #224
  stays frozen and may only be rebased/ported AFTER this Spec is accepted,
  restricted to the accepted delta (§7).
frozen_implementation_candidate: NONE
---

# AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2 — pre-admission recovery successor (minimal)

## 0. Summary, the real gap, non-goals

V1 (accepted) conflates two provably different failure classes into one
terminal outcome. CTR-WAE-003 sends EVERY canonical-resolution failure to
terminal NEEDS_REVIEW, and CTR-WAE-002 fences ANY existing attempt forever.
The composed real-world deadlock, confirmed by real business dogfood and
ruled REAL_SEMANTIC_GAP = YES by the Owner (2026-09-10):

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
changes exactly one semantic: **provably pre-admission resolution failure
becomes a recoverable-blocked LIVE phase of the SAME attempt, continuable
only through an explicit, governance-authorized, controlled recovery** —
and nothing else. Making "pre-admission" PROVABLE is itself part of this
amendment: every admission path gains exactly one durable pre-invocation
delivery-start record (write-ahead intent, CTR-WAE-012/013), so "never
invoked" becomes a ledger-provable fact rather than an inference from
silence — without it, an invocation that crashed before its Router record
was minted would be indistinguishable from no invocation at all.

New non-goals on top of ALL V1 non-goals (V1 §0 list stands verbatim): no
automatic retry engine of any kind (no re-resolve interval, no backoff, no
queue, no worker, no new scheduler, no watcher); no model-facing recovery
tool; no recovery triggered by poller ticks or reconcile passes; no
identity-truth change (§4); no reclassification of any post-invocation
failure class; no second attempt id, ever; no rewrite of ledger history.

### 0.1 Governance form: amendment, not supersession (r1 blocker 1 closure)

This successor changes accepted meaning, so its authority form is declared
explicitly instead of being left to inference:

- The Owner authoring ruling of 2026-09-10 explicitly authorizes this form:
  "若 repo governance 更适合正式 amendment，可采用 amendment，但必须形成明确
  successor authority" — this document IS that explicit successor authority,
  for exactly the clauses named in frontmatter `amends`.
- The repository's whole-authority supersession rule
  (`.agents/local/README.md`) governs "accepted long-lived meaning" — the
  Product Architecture and standalone long-lived Current Decisions layer.
  This candidate changes NONE of that layer: no Architecture clause, no
  Decision, no standalone long-lived authority is touched. What changes is
  implementation-contract scope inside one accepted implementation Spec
  (AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V1), and the accepted V1 chain
  itself provides the governing precedent for exactly that pattern: the
  accepted external spec SVC_WORKFLOW_DISPATCH_INTENT_KEYSET_CONTINUATION_V1
  amends the single contract CTR-VAI-009 of accepted
  SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1 (`supersedes: []`), and V1 itself
  amends the accepted AGENT_CORE_AGENT_SESSION_MESSAGING_V1 R4 enumeration.
- Specific governs general: for the recovery semantics of CTR-WAE-002 /
  CTR-WAE-003 / CTR-WAE-005 (plus the single CTR-WAE-006 exception that
  follows from them), THIS document is the successor authority and V1's
  text is superseded exactly there; for everything else V1 remains the
  governing authority verbatim. Where the two texts could be read to
  conflict, this document's stability list (CTR-WAE-014) resolves the
  reading.

## 1. Frozen invariants (gates this successor may never move)

```
ONE_NODE_VISIT
→ at most ONE deterministic attemptId   (V1 CTR-WAE-002 formula unchanged)
→ at most ONE Agent Run admission       (V1 CTR-WAE-004 gate unchanged)

SECOND_ATTEMPT_ID = FORBIDDEN
SECOND_RUN        = FORBIDDEN
UNKNOWN_DELIVERY  = NEVER ZERO SIDE EFFECT
```

Recovery continues the SAME attempt through the SAME deterministic id. It
is not, and must never degenerate into, "failed attempt → create second
attempt". V1's fence machinery (beginAttemptIfAbsent, FIFO chain,
cross-process OwnerLock, fresh replay under the lock) is reused unchanged
and is the mechanical reason the invariant survives recovery.

Identity remains independently authoritative (Owner ruling §9): the exact
resolver authority (AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V2) stands
untouched; resolution is re-executed fresh at recovery, never cached, never
substituted; no Principal→agent map may be hardcoded anywhere in engine,
config, or tests; the canonical id is expected EVIDENCE to assert against,
never an input.

## 2. Contracts

### CTR-WAE-011 — pre-admission recoverable boundary (amends CTR-WAE-002 + CTR-WAE-003)

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
amended. Every post-invocation failure class keeps V1 semantics exactly:
`delivery_rejected:<code>` and all delivery/outcome-unknown paths remain
terminal NEEDS_REVIEW, fail-closed, non-recoverable.

**Historical ledgers (projection-only).** V1-era ledger events
`delivery_failed{reason:"resolve_failed:<code>"}` already on disk are
NOT rewritten, truncated, or deleted (bytes unchanged). The replay
projection changes only their STATE MAPPING: reason prefix
`resolve_failed:` projects to ACTIVE/RESOLUTION_BLOCKED; every other
`delivery_failed` reason (`delivery_rejected:*` and any other) keeps
projecting terminal NEEDS_REVIEW. The discrimination is mechanical
(reason-prefix, deterministic at replay, no human input) and satisfies the
Owner's requirement that PRE_ADMISSION_BLOCKED and
DELIVERY_STARTED_OR_OUTCOME_UNKNOWN be mechanically distinct facts.
Recovery eligibility of a HISTORICAL attempt rests on exactly this event
evidence: the `resolve_failed` emission proves the engine was still in
the resolution phase when the attempt's single V1 pass ended, so deliver
was never reached. A historical attempt with NO `resolve_failed` event
(planned-only) is NOT eligible — its zero-invocation status is
unprovable retroactively without the V2 write-ahead record — and keeps
the V1 terminal paths (reconcile `delivery_unverified` → NEEDS_REVIEW).
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

which is established per CTR-WAE-013's preconditions at every recovery
execution. A blocked attempt is therefore ELIGIBLE — never automatically
recoverable.

**Reconcile interlock (the single CTR-WAE-006 exception).** A
RESOLUTION_BLOCKED attempt has no Run linkage BY CONSTRUCTION, so V1
reconcile's "no verified Run linkage → NEEDS_REVIEW `delivery_unverified`"
row MUST NOT fire on it — it would silently recreate the V1 terminality on
the next pass. Amendment: reconcile SKIPS blocked attempts (leaves them
blocked, counts them loud in engine status). Every other reconcile rule,
including read-only discipline and the no-wake rule (CTR-WAE-007), stands.
Reconcile never performs recovery.

### CTR-WAE-012 — ledger recovery lifecycle (amends CTR-WAE-005)

The event stream stays append-only, torn-tail-tolerant, terminal-refusing,
and fact/ID-only (no workflow context, no message bodies). NO truncation,
NO reset, NO deletion, NO historical rewrite — of any event, ever.

Indicative event additions (exact names/fields are an implementation-
investigation decision; the CONTRACT semantics below are frozen):

- `resolution_blocked { attemptId, code, at }` — appended when the
  resolution phase fails; attempt phase = RESOLUTION_BLOCKED (ACTIVE).
  Repeated resolution failures (e.g. each authorized recovery that fails
  resolution again) append fresh events; a second `attempt_planned` for
  the same NodeVisit remains impossible (CTR-WAE-002 unchanged).
- `delivery_started { attemptId, at }` — the durable WRITE-AHEAD INTENT
  record, appended BEFORE any `router.deliver` invocation on EVERY
  admission path — the original V1-style path included, not only
  recovery. At most ONE per attempt; a second is a corrupt-ledger
  fail-loud. Its presence unconditionally classifies the attempt
  DELIVERY_STARTED_OR_OUTCOME_UNKNOWN: never recovery-eligible, whatever
  any other store answers; reconcile treats it under the UNCHANGED V1
  rows (`delivery_unverified` family). Its absence on a blocked attempt
  is the mechanical proof of never-invoked.
- `recovery_authorized { attemptId, authorityRef, at }` — appended ONLY
  by the controlled recovery operation of CTR-WAE-013, ALWAYS AFTER its
  fresh preconditions pass and ALWAYS BEFORE any resolution/delivery
  re-execution (never on the refusal path); `authorityRef` is the exact
  governance reference (goal directive / Owner ruling) authorizing THIS
  recovery. Multiple authorization events may exist over an attempt's
  lifetime; none of them can create a second Run — the CTR-WAE-002/004
  gates are untouched and remain the only admission path.
- `recovery_refused { attemptId, authorityRef, refused: <which
  precondition>, at }` — appended when a recovery execution fails a
  fresh precondition (it carries the same `authorityRef` for audit); the
  attempt then lands terminal NEEDS_REVIEW (`recovery_refused:<which>`).

After a successful recovery the attempt proceeds through the UNCHANGED V1
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
PROVEN_ZERO is proven fresh at every recovery execution and is never a
persistent property of an attempt.

### CTR-WAE-013 — the controlled recovery operation (new; the anti-retry-engine contract)

**Surface.** Exactly ONE narrow internal/control-plane operation of the
workflow-execution engine (the existing control-plane/CLI seam class). It
MUST NOT be: a model-facing broker tool or capability; reachable from any
Agent tool surface; invoked by the poller tick; invoked by reconcile; or
invoked by any timer/watcher/queue. There is no scheduling semantics of
any kind between explicit authorized invocations: a blocked attempt simply
waits, loudly visible in engine status/reports (visibility is not
triggering).

**Authorization.** Every invocation MUST carry an explicit `authorityRef`
(a named Owner ruling / goal directive). No authorityRef ⇒ refuse with
zero side effects and NOTHING appended.

**Execution sequence (per invocation; single-flight; ONE deterministic
order — fresh preconditions strictly precede authorization, authorization
strictly precedes re-execution).** Runs under the SAME per-attempt FIFO
chain + cross-process OwnerLock + fresh replay-under-lock as every V1
mutation (CTR-WAE-002 race machinery, unchanged):

1. Fresh preconditions (below). ANY failure ⇒ append
   `recovery_refused {authorityRef, refused: <which>}` ⇒ attempt lands
   terminal NEEDS_REVIEW. NO fallback, NO partial execution; NO
   `recovery_authorized` is written on the refusal path.
2. All preconditions pass ⇒ append `recovery_authorized` (durable) —
   this operation is the event's ONLY writer, always here, never
   earlier.
3. Re-run resolution exactly per CTR-WAE-003 (fresh reads; no cache).
   - Success ⇒ append the durable `delivery_started` write-ahead record
     BEFORE any `router.deliver` call ⇒ then invoke delivery exactly per
     CTR-WAE-004 — ONE Run, same attemptId, `requestId = attemptId`,
     unchanged sidecar ⇒ on success append `run_delivered` and proceed
     through unchanged V1 events; on synchronous rejection append
     `delivery_failed{reason:"delivery_rejected:<code>"}` (terminal
     NEEDS_REVIEW, V1 semantics unchanged).
   - Failure ⇒ append a fresh `resolution_blocked` with the new code;
     attempt stays blocked; ZERO side effects; no admission; no
     `delivery_started` was written.
4. Return an explicit outcome to the caller
   (`RECOVERED_RUN_ADMITTED` | `STILL_BLOCKED:<code>` |
   `RECOVERY_REFUSED:<which>` | `NO_OP_ALREADY_DELIVERED/TERMINAL`).

**Fresh preconditions (each mechanically verified at execution time):**

1. Workflow instance still exists; the NodeVisit is still current
   (`nodeVisitId` exact-compare against svc's current visit);
   `assigneePrincipalId` unchanged; instance state-version shows no
   business transition past the visit.
2. Ledger projection: attempt exists for that nodeVisitId with the
   deterministic attemptId; attempt is non-terminal with phase
   planned/RESOLUTION_BLOCKED; NO `delivery_started` record; NO
   `run_delivered`; NO `delivery_rejected`; NO reconciled outcome-unknown
   handle. (For a HISTORICAL V1-era attempt, eligibility additionally
   requires the `resolve_failed` event per CTR-WAE-011.)
3. Router reconciliation store queried FRESH for
   `requestId = attemptId`: the only passing answer is "no record ever
   existed" (never-existed class). `pending` / `settled` / `evicted` /
   `restart_lost` / unreadable ⇒ REFUSED (the attempt then takes the V1
   outcome-unknown NEEDS_REVIEW path, never recovery). Store unreachable
   ⇒ REFUSED. This gate is SECONDARY and one-directional: it may only
   refuse; it can never override the ledger's `delivery_started` record
   or convert a delivery-started attempt into a recoverable one.
4. No reconciliation handle, messageId, or session linkage attributable
   to this attempt exists in Router/session seams.

**Concurrency and crash boundaries (frozen):**

- Concurrent second caller: serialized by the OwnerLock/FIFO machinery;
  observes authorized/in-flight state and no-ops or fails loud; can never
  double-admit (the CTR-WAE-004 gate is the only admission path).
- Replay of the same recovery command AFTER a completed recovery:
  observes `run_delivered`/terminal and is a no-op (`NO_OP_*`), never a
  second Run.
- Crash BEFORE the durable `delivery_started` append (including
  before/inside re-resolution): the ledger mechanically proves
  never-invoked, and the fresh Router-store query confirms ⇒ recoverable;
  a later authorized invocation proceeds (Owner acceptance case D).
- Crash AFTER `delivery_started` is durable, at ANY point before
  `run_delivered` is durable (including during the `router.deliver` call
  and before receipt durability): class DELIVERY_STARTED_OR_OUTCOME_UNKNOWN
  ⇒ NOT recoverable — the ledger record alone refuses recovery, EVEN IF
  the Router store later answers "no record ever existed" (its answer is
  never primary) ⇒ reconcile lands NEEDS_REVIEW (V1 CTR-WAE-006 stands;
  Owner acceptance case E).
- NodeVisit moved / assignee changed / any precondition drift before
  recovery ⇒ REFUSED ⇒ NEEDS_REVIEW (Owner acceptance case F).

### CTR-WAE-014 — stability list (what V2 does NOT change)

- CTR-WAE-001 / CTR-WAE-001b (due feed + keyset continuation): verbatim.
- CTR-WAE-004 (Run admission gate, provenance sidecar, the ASM R4
  amendment): the admission gate and sidecar are verbatim — one admission
  per attempt, unchanged, no new Router-call field. The delivery SEQUENCE
  gains exactly one durable pre-invocation append: the `delivery_started`
  write-ahead record (CTR-WAE-012/013). Declared here, not silent,
  because it is the mechanical fence that makes pre-admission provable;
  it is invisible to the Router and changes no admission semantics.
- CTR-WAE-006: unchanged EXCEPT the single blocked-attempt exemption
  defined in CTR-WAE-011.
- CTR-WAE-007 (settle probe / no wake), CTR-WAE-008 (Assistance),
  CTR-WAE-010 (SETTLED semantics): verbatim.
- CTR-WAE-009 restated with the V2 carve-out: outcome-unknown and
  side-effect-unknown never auto-rerun (V1, stands); pre-admission-blocked
  attempts never AUTO-recover (V2, explicit) — recovery is only ever the
  explicit CTR-WAE-013 operation.
- svc-workflow: NO change of any kind. The seven-field due-feed projection
  (Architecture CTR-ARCH-013) is untouched; no lineage-resolved Principal
  is added to the feed; resolver choice stays a dsh-consumer decision. The
  earlier svc dispatch identity-bridge proposal remains REJECTED (violated
  CTR-ARCH-013, exact-resolution V2, and the accepted reconciliation
  lineage's "not a Principal resolver" clause); reopening it would require
  NEW_EVIDENCE — none exists.
- AGENT_CORE_AGENT_SESSION_MESSAGING_V1: no further amendment (V1's R4
  extension to `workflow_execution` remains the last word).
- Assignment data: the historical assignee on existing instances is NEVER
  changed to bypass resolution.

## 3. Identity boundary (record-only; NO identity semantics in V2)

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
folded into V2 or its implementation.

**Consequence for recovery (fail-closed by design).** Until identity is
repaired through its own valid authority, an authorized recovery of a
blocked dogfood attempt re-runs resolution, fails with the same
`agent_mapping_missing`-class code, appends a fresh `resolution_blocked`,
and admits ZERO Runs — idempotent, loud, correct. Recovery authorization
and identity repair are independent acts under independent authorities;
neither approximates nor substitutes for the other.

## 4. Required dogfood (acceptance-gated; NO replacement instances)

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

Ordering: the identity repair happens through its own authority FIRST;
V2 implementation deploys under its own gates; then per-subject recovery.
No replacement workflow instance, no assignee change, no direct DB write,
no display-name fallback, no hardcoded mapping — the Owner's §14 refusal
list is adopted verbatim as V2 boundaries.

## 5. Tests (acceptance-critical; a happy-path-only suite is a REVISE)

Each item mechanically asserted in `packages/workflow-execution/test/`
(ported onto the accepted implementation base):

- A: resolution fails → ZERO Run → (simulated) identity repair → explicit
  authorized recovery → exactly ONE Run, same attemptId, V1 events
  thereafter.
- B: recovery command replay after completed recovery → no-op, no
  duplicate Run, no second admission.
- C: two concurrent recovery invocations → exactly one recovery owner
  (OwnerLock/FIFO serialization proven), at most one Run.
- D: crash before the durable `delivery_started` append (including
  before/inside re-resolution) → ledger mechanically proves never-invoked,
  Router-store never-existed passes as the secondary gate → recoverable →
  later authorized recovery succeeds.
- E: crash after the `delivery_started` append, before `run_delivered`
  durability (any point, including during the deliver call) → NOT
  recoverable → reconcile lands NEEDS_REVIEW; recovery invocation on it
  refuses.
- STORE-FALSE-NEGATIVE (r1 blocker-2 regression): a `delivery_started`
  record present AND the fresh Router correlation query answers "never
  existed" (restarted/lost correlation index) → recovery STILL refuses →
  NEEDS_REVIEW; a second Run is impossible.
- Historical planned-only attempt (no `resolve_failed` event) → NOT
  recovery-eligible → V1 terminal paths only.
- F: NodeVisit moved / assignee changed before recovery →
  RECOVERY_REFUSED → terminal NEEDS_REVIEW.
- Blocked-attempt reconcile exemption: RESOLUTION_BLOCKED never takes the
  `delivery_unverified` NEEDS_REVIEW verdict; other attempts still do.
- Historical projection: a V1-era
  `delivery_failed{reason:"resolve_failed:…"}` projects to
  ACTIVE/RESOLUTION_BLOCKED with ledger bytes unchanged;
  `delivery_rejected:*` keeps projecting terminal NEEDS_REVIEW.
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

## 6. Production wiring

The recovery operation mounts with the engine (V1 §3 wiring unchanged,
fail-closed, honest-disabled without poller config) but has NO additional
enable flag: it is individually inert without an explicit authorityRef per
invocation, which is the authorization mechanism. Deployment remains
slot-gated; PRODUCTION_APPLY_ALLOWED = NO for the authoring goal. The
deployment order of record: identity repair (own authority) → svc
keyset-continuation build (already deployed prerequisite of V1) → WAE V2
implementation → per-subject recovery → target-own-context verification.

## 7. Governance sequencing (frozen; from the Owner ruling §13)

1. PR #224 stays frozen at `b3483d9592b19a17a121db71889681675fc1ac0b`.
2. THIS document is the step-2 product (docs-only successor authority
   candidate).
3. Independent semantic review of this exact head (reviewer did not
   author the delta).
4. Exact successor head returned to the Owner.
5. Owner exact-head acceptance (THE gate; this document's `proposed`
   status carries no authority until then).
6. Merge successor authority.
7. Rebase/port the frozen PR #224 implementation onto the accepted base.
8. Implement ONLY the accepted recovery delta (CTR-WAE-011/012/013).
9. Focused + regression + §5 crash/concurrency matrix.
10. Independent implementation review.
11. Merge.
12. Controlled deployment.
13. Identity repair through its own valid authority (separate successor —
    `IDENTITY_AUTHORITY_SUCCESSOR_REQUIRED`; MUST NOT ride this Spec).
14. Recover existing Subjects A/B (§4).
15. Target-own-context verification.

Steps 4/5 may never be skipped. Nothing in this document authorizes
implementation, deployment, identity mutation, or production writes.
