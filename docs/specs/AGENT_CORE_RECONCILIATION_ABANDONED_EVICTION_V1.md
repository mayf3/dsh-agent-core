---
spec_id: AGENT_CORE_RECONCILIATION_ABANDONED_EVICTION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec_amendment
implementation_authority: none
revision: r3
revision_date: 2026-11-21
amendment_of: AGENT_PROCESS_LIFECYCLE_HARDENING_V4
amendment_kind: NEW
amendment_route: >-
  V3-adoption bounded route: one atomic Spec-delta-and-code PR under the
  Owner's task authorization (dsh-agent-core#707 structural slice, Owner
  directive 2026-11-20 "继续 #707 P1 原责任" — §三 代次容量修复受控方案).
  The delta must be independently accepted before merge. It does not
  authorize production effects.
scope:
  - reconciliation issuance-generation capacity recovery for
    declaration-abandoned generations (contiguous-prefix eviction of
    settled + declaration-abandoned records)
  - declaration-time unresolvedCount decrement
  - restore-time recount exclusion for declaration-abandoned records
  - registry restore-apply (durable registry re-applied to restored records)
non_goals:
  - any record deletion outside the store's own evictRecord watermark
    machinery (no bare durable-JSON edits)
  - any business-settled semantics for abandoned records (outcome stays
    UNKNOWN; resolution is `evicted` via the watermarks)
  - the admission-fence gate semantics (unchanged: declaration-marked
    records stop blocking NEW-request admission; historical fence query
    stays unchanged)
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
parent_spec_references:
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md
owners:
  - mayf3
date: 2026-11-20
repository: mayf3/dsh-agent-core
authoring_base: 710fa3a9 (production line head; includes accepted #703/#705)
---

# AGENT_CORE_RECONCILIATION_ABANDONED_EVICTION_V1 — abandoned-generation capacity recovery (bounded amendment)

## 0r1. Post-review amendments (independent QA returned BLOCKED with 3 reproduced safety counterexamples; all addressed)

- **Blocker 1 (restore-apply crossing the risk-acceptance boundary)**: r1
  stamped the D6 acceptance audit unconditionally at restore. r2: the durable
  registry entries MAY carry the explicit `ownerRiskAcceptance: true` +
  `decisionRef`; restore-apply stamps the acceptance audit ONLY for entries
  carrying the flag; flag-less (legacy/pre-seeded) entries restore
  MARKER-ONLY — the quarantine boundary is not auto-upgraded. Invalid flag
  shapes fail the store closed at startup.
- **Blocker 2 (UNKNOWN eviction destroying caller-correlation no-replay)**:
  r1 evicted correlated records via plain evictRecord, deleting the
  correlation index entry (the same correlation could re-mint — reproduced).
  r2: correlated records evict through a correlation-preserving arm — the
  index entry stays as the durable no-replay tombstone; re-mints of the same
  correlation reject with RECONCILIATION_CORRELATION_CONFLICT across
  restarts; recountCapacity tolerates watermark-resolvable tombstones.
- **Blocker 3 (marker-only records treated as releasable capacity)**: r1
  evicted any marked record. r2: non-settled records are releasable ONLY
  with BOTH the marker AND the D6 acceptance audit (hasAcceptanceAudit);
  marker-only quarantined records keep blocking admission until their
  declarationId is legally completed (R131 same-key re-invocation with
  ownerRiskAcceptance).

## 0r2. Second-review amendments (QA re-review FAIL at the r1 head; both blockers + coverage matrix addressed)

- **Restore-apply risk-acceptance boundary (QA round-2 blocker 1)**: r1's
  restore-apply stamped the D6 acceptance audit UNCONDITIONALLY for registry
  entries — auto-upgrading legacy/pre-seeded declarations into authorization
  decisions they never carried. r2: the durable registry entry shape admits
  the explicit `ownerRiskAcceptance: true` + `decisionRef` fields
  (validator: exactly the legacy 4-key or the new 6-key shape; invalid flag
  forms fail the store CLOSED at startup — startupBlockedReason =
  durable_store_invalid); restore-apply stamps the acceptance audit ONLY
  for entries with the explicit flag; flag-less entries restore
  MARKER-ONLY. The registry restore-APPLIES to the restored records (the
  heal-at-reopen flow): a declared scope heals its crash-window stamps at
  boot and the retry completes only the unstamped remainder.
- **Correlated-eviction no-replay preservation (QA round-2 blocker 2)**:
  capacity eviction of a CORRELATED abandoned record preserves the caller
  correlation index entry as a durable no-replay tombstone (the index entry
  survives the eviction AND the durable round-trip; the same correlation
  rejects re-mints with RECONCILIATION_CORRELATION_CONFLICT across
  restarts). recountCapacity tolerates watermark-resolvable tombstones; a
  foreign-epoch handle never resolves via this store's watermarks.
- **Coverage corrections**: the two admin-abandonment failures at the r1
  head were NOT pre-existing flake — they were introduced by r1's
  restore-apply superseding the pinned crash-window states. Both rewritten
  to pin the heal-at-reopen flow; the three §3 invariant tests restored;
  new tests: 迟到效果 (late settlement cannot fabricate a business settled
  for an evicted abandoned record), the walk releasable gate
  (marker-only never evicted; honest progress-guard stop), and the
  production-style round-trip (accept → persist → reopen heals → mint
  proceeds → tombstone survives).
- **Epoch-retention semantics (r2 re-review blocker fix)**: correlation
  no-replay tombstones are PERMANENT, so the epochs their handles reference
  are REQUIRED epochs — `compactRuntimeEpochs` never drops a tombstone's
  epoch (dropping one would turn the tombstone into an orphan at the next
  restore: a startup brick the round-4 review probe proved reachable via
  the r2 epoch-membership gate × bounded epoch compaction). Tombstone
  epochs are bounded by the live tombstones themselves; the pathological
  multi-thousand-distinct-epoch case stays fail-loud via the cap check,
  never a silent brick. §3 wording synced with §0r2 (the two
  admin-abandonment tests were rewritten to the heal-at-reopen semantics,
  not "passing unchanged"); §4 now includes durable-file.js (the registry
  validator/writer carrying the 6-key surface).

> 状态：**proposed / docs+code atomic candidate（V3-adoption bounded route）**。
> 独立验收（exact-head semantic review PASS, BLOCKERS=NONE，验收人 ≠ 作者）通过前
> 不 merge。本 delta 不授权任何生产效应。

## 0r3. Third-review amendments (Owner-prescribed first-priority 方案：不相交 `evictedRanges` 区间压缩；both r7 candidates measured FAIL, addressed)

- **The measured r7 failure (metadata sum invariant)**: r7's walk (skip
  unresolved generations, evict resolved ones) fixed the CONTIGUITY half of
  the deadlock but not the CAPACITY half. `evictRecord`'s generation
  bookkeeping moved each fully-evicted generation's entry 1:1 from the live
  `generations` map into the `evictedGenerations` map — the mint-cap sum
  `generations.size + evictedGenerations.size` stayed invariant (probe on the
  real frozen shape: 261 → 261), the walk then threw mid-eviction on the same
  cap ("evicting … would exceed issuance metadata cap"), and the measured
  agt_hr-agent lockout persisted in a different form. The second candidate
  (advancing `evictedThroughGeneration` across the gap) was rejected in
  review: it claims never-issued generations as `evicted` (the
  `never_existed` violation — a handle that never existed must never
  classify as evicted).
- **r8: disjoint `evictedRanges` compression (the Owner-prescribed 方案)**.
  The per-generation `evictedGenerations` map is replaced by
  `evictedRanges`: a sorted list of `[startGeneration, endGeneration, maxSeq]`
  tuples. A fully-evicted generation EITHER advances the contiguous watermark
  (cascading across any range that then touches it) OR merges into the
  ranges — and ranges merge ONLY across generation-ADJACENT runs, so a range
  spans consecutive genuinely-evicted generations and NEVER covers a
  never-issued one: `never_existed` verdicts are preserved exactly. The mint
  cap now counts `generations.size + evictedRanges.length` — one tuple bounds
  arbitrarily many generations, so metadata stops leaking with history depth.
- **Per-range `maxSeq` soundness (re-mint into a compacted generation)**.
  A range's `maxSeq` is the max eviction-time turn-seq of every generation
  merged into it. Re-issuance into a range-covered generation allocates a
  globally-monotonic seq strictly above it, so `classifyHandle` resolves
  `seq <= range.maxSeq` as `evicted` (the old handles) while the re-minted
  live record falls through to its generation entry — the range never
  swallows a live record.
- **Durable migration (bounded, fail-closed)**. The persistence-file schema
  version stays 3: `decodeIssuance` accepts exactly ONE evicted-metadata form
  — the r8 `evictedRanges` tuples or the legacy `evictedGenerations` pairs
  (both or neither fails the store CLOSED at startup, `durable_store_invalid`).
  Legacy pairs convert at restore: generation-adjacent runs merge, and a pair
  sitting at watermark+1 cascades into the watermark (the map entry proved
  that generation was genuinely issued + evicted — the honest case; the
  cascade never touches absent generations). The next persist writes only the
  new form. Restored-cap and mint-cap checks count ranges.
- **Walk semantics (r7 shape retained over r8 metadata)**.
  `evictSettledGenerationForCapacity` iterates every live generation
  (watermark-exclusive), SKIPS unresolved ones (fences stay pinned — they
  need evidence-based settlement or Owner risk acceptance, not
  capacity-pressure eviction), and evicts each fully-resolved generation
  through `evictRecord` / the correlation-preserving arm — which under r8
  actually COMPRESSES the metadata instead of relocating it. Idempotent.

## 1. Goal (measured deadlock)

`MAX_ISSUANCE_GENERATIONS_PER_AGENT = 256` deadlocks an agent whose child
restarts often: every kill leaves an outcome_unknown record pinning its
generation entry, and `evictSettledGenerationForCapacity` only evicted
`state === 'settled'` records — declaration-abandoned records (owner risk
accepted, outcome stays UNKNOWN forever) had NO eviction path. Measured:
agt_hr-agent at the exact 256 cap, ~130-170 admission failures/day since
11-17 (dsh-agent-core#707).

## 2. Exact semantics (controlled recovery, per Owner §三 constraints)

1. **Declaration-time decrement.** Stamping a record with the abandonment
   marker decrements its generation's `unresolvedCount` (owner risk
   acceptance = resolved-for-capacity; the outcome itself stays UNKNOWN).
   Crash-safety: the decrement is runtime state; `recountCapacity` (§2.3)
   re-excludes marked records, so any crash gap self-heals at restart.
2. **Restore-time recount exclusion.** `recountCapacity` no longer counts
   declaration-marked records as unresolved — a declaration survives every
   restart.
3. **Registry restore-apply (r2 boundary).** The durable declaration
   registry is re-applied to the restored records at boot. Entries carrying
   the explicit `ownerRiskAcceptance: true` (+`decisionRef`) stamp the
   marker AND the D6 acceptance audit; entries WITHOUT the flag stamp
   MARKER-ONLY — the admission quarantine semantics are never auto-upgraded
   by a pre-seed (the round-2 review blocker 1 boundary). The registry file
   IS the owner-authorized operation record; pre-seeding it under the
   Owner's directive with the explicit flag is the documented risk
   acceptance.
4. **Span-wide eviction of resolved generations (r3: superseded the
   contiguous-prefix-only walk).**
   `evictSettledGenerationForCapacity` iterates every live generation beyond
   the watermark, SKIPPING unresolved ones (a fence pins only its own
   generation — later fully-resolved generations still release), and evicts
   settled records via `evictRecord` and declaration-abandoned records via
   the correlation-preserving arm (settled AND declaration-abandoned records
   through the store's own watermark machinery; no bare durable-JSON edits).
   Under the r8 ranges metadata each release COMPRESSES the issuance
   metadata (merged range or watermark cascade) instead of relocating it,
   so the walk makes real capacity progress (§0r3).
5. **What is preserved.** The abandoned record's outcome stays UNKNOWN;
   resolution is `evicted` via the watermarks; replay protection (no-replay
   correlation) and audit linkage are unchanged; admission-fence semantics
   unchanged (marked records stop blocking; the historical fence query stays
   unchanged).

## 3. Invariants frozen by tests

`packages/agent-router/test/process-lifecycle/reconciliation-abandoned-eviction.test.js`:

- r0 deadlock frozen: at the 256 cap with every record declaration-abandoned,
  the pre-fix mint throws; post-fix the next NEW-generation mint succeeds;
- an evicted abandoned record resolves `state === 'evicted'` and never as a
  business settled;
- eviction is idempotent; the declaration registry audit linkage survives;
- the existing admin-abandonment suite passes unchanged (marker-only
  quarantine, D6 acceptance stamping, no-replay, restart persistence).

`packages/agent-router/test/process-lifecycle/watermark-gap.test.js` (r8):

- the REAL frozen production shape (watermark 34, fences 70/73/78/86, settled
  92-343, legacy-evicted 38-42 + 50-91, absent 35-37 + 43-49): the mint at
  the 256 cap SUCCEEDS after the walk; the metadata sum drops under the cap;
  the fences stay pinned; the watermark never claims the absent 35-37;
  a second walk is a no-op;
- a range never spans a never-issued generation: phantom handles in the
  43-49 gap classify `never_existed`; a seq beyond the range's maxSeq in a
  compacted generation classifies `never_existed`;
- a re-mint into a range-covered generation stays live (seq monotonicity
  above the range bound) while its old handles stay `evicted`; re-evicting
  merges back into the SAME range and grows its maxSeq;
- legacy durable files migrate at restore (adjacent pairs merge, a
  watermark+1 pair cascades honestly, evicted handles still classify
  `evicted`); the next persist writes only the new form; a both-forms file
  fails the store CLOSED.

## 4. Exact implementation paths

- `packages/agent-router/src/reconciliation/authority-capacity.js`
  (prefix walk: settled + declaration-abandoned records, progress guard)
- `packages/agent-router/src/reconciliation/admin-abandonment.js`
  (unresolvedCount decrement at declaration application; export
  stampCandidate)
- `packages/agent-router/src/reconciliation/store.js`
  (restore-apply of the registry; recount exclusion)
- `packages/agent-router/src/reconciliation/durable-file.js`
  (registry entry validator/writer: the 6-key accepted shape)
- `packages/agent-router/src/reconciliation/authority-capacity.js`
  (compactRuntimeEpochs tombstone-epoch protection; r8
  `markGenerationEvicted` range insert/merge/cascade, `canEvictRecord` range
  membership)
- `packages/agent-router/src/reconciliation/store.js`
  (r8: fresh-issuance `evictedRanges`, mint/restored cap sums count ranges,
  `highestIssuedGeneration` over range ends)
- `packages/agent-router/src/reconciliation/query.js`
  (r8: `classifyHandle` range lookup bounded by the per-range maxSeq)
- `packages/agent-router/src/reconciliation/durable-file.js`
  (r8: `encodeIssuance`/`decodeIssuance` both-forms migration,
  `evictedRangesFromLegacyPairs`)
- `packages/agent-router/test/process-lifecycle/reconciliation-abandoned-eviction.test.js` (NEW)
- `packages/agent-router/test/process-lifecycle/watermark-gap.test.js` (NEW, r8)

## 5. Alternatives and disposition

- Marking abandoned records as business `settled`: rejected — that fabricates
  a business outcome (Owner §三: "不得把 abandonment 偷换成业务 settled").
- Deleting records outside `evictRecord` (direct durable-JSON edits):
  rejected — the red line; eviction via the watermark machinery keeps every
  evicted handle resolvable.
- Raising `MAX_ISSUANCE_GENERATIONS_PER_AGENT`: rejected — delays, not
  removes, the deadlock; the contiguity/abandoned-eviction gap is the defect.
- Advancing `evictedThroughGeneration` across the watermark gap (r7
  watermark-merge candidate): rejected in review — it classifies handles in
  never-issued generations as `evicted` (the `never_existed` violation);
  ranges preserve `never_existed` exactly by merging only adjacent runs.
- Keeping the per-generation evicted map (r7 skip-walk alone): rejected on
  measurement — the map-to-map relocation leaves the mint-cap sum invariant
  (261 → 261) and the deadlock persists in a different form.

## 6. Production-recovery interlock (deployment note, NOT authorized here)

Ops awareness (r2): correlation tombstones of accepted declarations are
permanent and exempt from correlation-index reclaim — correct for no-replay,
but they occupy index slots until the
MAX_CORRELATION_INDEX_ENTRIES_GLOBAL cap, after which new-correlation mints
fail loud (replay protection is never traded for capacity).

With this fix deployed, HR's unlock becomes: declare (or retry)
`hr-unlock-707pathA-20261120` through the admin entry → unresolvedCount
zero → the next mint walks the contiguous prefix → capacity frees → HR
admission recovers. The identity/authorization constraints of that admin
entry (OBS-WA-008 CTO recovery principal) are unchanged.

## 7. Acceptance gate

Independent exact-head semantic review (reviewer ≠ author) must return PASS
with BLOCKERS=NONE on this file + the atomic code commit before merge.
