---
spec_id: AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2
status: proposed
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
date: 2026-09-10
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
and nothing else.

New non-goals on top of ALL V1 non-goals (V1 §0 list stands verbatim): no
automatic retry engine of any kind (no re-resolve interval, no backoff, no
queue, no worker, no new scheduler, no watcher); no model-facing recovery
tool; no recovery triggered by poller ticks or reconcile passes; no
identity-truth change (§4); no reclassification of any post-invocation
failure class; no second attempt id, ever; no rewrite of ledger history.

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
`resolve_failed:<code>` classification, and has NO `run_delivered` event.

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

**Code classification.** ALL `resolve_failed:<code>` emissions of the
closed CTR-EPAR-004 taxonomy (`principal_not_found`, `principal_not_agent`,
`principal_disabled`, `agent_mapping_missing`,
`identity_resolution_ambiguous`, `identity_resolution_unavailable`,
`access_denied`, `credential_unavailable`, `credential_invalid`,
`transport_failure`, `target_not_found`, `target_disabled`) belong to the
blocked class. The criterion is the PHASE (pre-admission by construction),
never the error name; no code is special-cased in either direction. The
core condition at RECOVERY time is not the code but the fresh judgment:

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
- `recovery_authorized { attemptId, authorityRef, at }` — appended ONLY by
  the controlled recovery operation of CTR-WAE-013; `authorityRef` is the
  exact governance reference (goal directive / Owner ruling) authorizing
  THIS recovery. Multiple authorization events may exist over an
  attempt's lifetime; none of them can create a second Run — the
  CTR-WAE-002/004 gates are untouched and remain the only admission path.
- `recovery_refused { attemptId, refused: <which precondition>, at }` —
  appended when a recovery execution fails a fresh precondition; the
  attempt then lands terminal NEEDS_REVIEW
  (`recovery_refused:<which>`).

After a successful recovery the attempt proceeds through the UNCHANGED V1
events — `run_delivered` (same attemptId, requestId = attemptId) →
`reconciled` — and its terminal states are exactly V1's
(SETTLED | NEEDS_REVIEW). No new terminal state exists; NEEDS_REVIEW
remains the only human-escalation terminal.

**Mechanical discriminability (frozen contract).** From ledger bytes
alone, the projection must always distinguish (a) PRE_ADMISSION_BLOCKED
(no `run_delivered`, no `delivery_rejected`, no outcome-unknown evidence)
from (b) DELIVERY_STARTED_OR_OUTCOME_UNKNOWN. Ledger bytes alone are
NEVER sufficient to PROVE (a) at recovery time — the fresh Router
correlation query of CTR-WAE-013 (requestId = attemptId; only
"no record ever existed" passes) is a REQUIRED recovery precondition.
Eligibility is a ledger classification; PROVEN_ZERO is proven fresh,
every time.

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
(a named Owner ruling / goal directive). No authorityRef ⇒ refuse, zero
side effects. The operation appends `recovery_authorized` with that
reference before doing anything else.

**Execution sequence (per invocation; single-flight).** Runs under the
SAME per-attempt FIFO chain + cross-process OwnerLock + fresh
replay-under-lock as every V1 mutation (CTR-WAE-002 race machinery,
unchanged):

1. Fresh preconditions (below). ANY failure ⇒ append `recovery_refused`
   ⇒ attempt lands terminal NEEDS_REVIEW. NO fallback, NO partial
   execution.
2. Append `recovery_authorized` (durable).
3. Re-run resolution exactly per CTR-WAE-003 (fresh reads; no cache).
   - Success ⇒ proceed to admission exactly per CTR-WAE-004 — ONE Run,
     same attemptId, `requestId = attemptId`, unchanged sidecar — then
     unchanged V1 events.
   - Failure ⇒ append a fresh `resolution_blocked` with the new code;
     attempt stays blocked; ZERO side effects; no admission.
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
   planned/RESOLUTION_BLOCKED; NO `run_delivered`; NO
   `delivery_rejected`; NO reconciled outcome-unknown handle.
3. Router reconciliation store queried FRESH for
   `requestId = attemptId`: the only passing answer is "no record ever
   existed" (never-existed class). `pending` / `settled` / `evicted` /
   `restart_lost` / unreadable ⇒ REFUSED (the attempt then takes the V1
   outcome-unknown NEEDS_REVIEW path, never recovery). Store unreachable
   ⇒ REFUSED.
4. No reconciliation handle, messageId, or session linkage attributable
   to this attempt exists in Router/session seams.

**Concurrency and crash boundaries (frozen):**

- Concurrent second caller: serialized by the OwnerLock/FIFO machinery;
  observes authorized/in-flight state and no-ops or fails loud; can never
  double-admit (the CTR-WAE-004 gate is the only admission path).
- Replay of the same recovery command AFTER a completed recovery:
  observes `run_delivered`/terminal and is a no-op (`NO_OP_*`), never a
  second Run.
- Crash BEFORE `router.deliver` invocation: ledger + fresh Router-store
  query mechanically prove zero side effect ⇒ recoverable; a later
  authorized invocation proceeds (Owner acceptance case D).
- Crash DURING/AFTER invocation, before receipt durability: the Router
  store holds a record ⇒ outcome UNKNOWN ⇒ NOT recoverable ⇒ reconcile
  lands NEEDS_REVIEW (V1 CTR-WAE-006 stands; Owner acceptance case E).
- NodeVisit moved / assignee changed / any precondition drift before
  recovery ⇒ REFUSED ⇒ NEEDS_REVIEW (Owner acceptance case F).

### CTR-WAE-014 — stability list (what V2 does NOT change)

- CTR-WAE-001 / CTR-WAE-001b (due feed + keyset continuation): verbatim.
- CTR-WAE-004 (Run admission, provenance sidecar, the ASM R4 amendment):
  verbatim — one admission per attempt, unchanged.
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
- D: crash before `router.deliver` invocation → fresh Router-store query
  proves zero → recoverable → later authorized recovery succeeds.
- E: crash during/after invocation before receipt durability → Router
  store shows a record → NOT recoverable → reconcile lands NEEDS_REVIEW;
  recovery invocation on it refuses.
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
