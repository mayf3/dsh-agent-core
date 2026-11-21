---
spec_id: AGENT_CORE_RECONCILIATION_ABANDONED_EVICTION_V1
status: accepted
spec_kind: implementation
authority_level: governing_spec_amendment
implementation_authority: none
revision: r7
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

## 0r4. Fourth-review amendments (Owner counterexamples P0-A/P0-B/P1-C/P1-D at the r8 head; all reproduced and addressed)

- **P0-A (range maxSeq cannot prove full handle identity)**: r8's
  `[start, end, maxSeq]` tuple answered `seq <= rangeMax` for EVERY
  generation under the range — the dense-run counterexample (mint g10:s1,
  g11:s2, g12:s3, evict → `[10,12,3]`; query the never-issued `g10:s3`)
  classified a phantom identity as `evicted`, widening C-018 semantics.
  Reproduced against the REAL production preimage: `g38:s1383` (the seq
  belongs to g39) classified `evicted` under r8's run-max 4662. r9 tuples
  are `[startGeneration, endGeneration, perGenMaxSeqs]` where
  `perGenMaxSeqs[i]` is the EXACT eviction-time turn-seq bound of
  generation `startGeneration + i` — the IDENTICAL predicate the legacy
  per-generation map answered (`seq <= maxSeq_g`), preserving C-018 handle
  identity bit-for-bit; the phantom `g38:s1383` classifies `never_existed`.
  Merging composes the bounds array slot-by-slot; a re-eviction of a
  re-minted generation OVERWRITES only its own slot (no unbounded array
  growth — the r8 draft's concat violated `length === end-start+1`).
- **P0-B (over-cap legacy durable load)**: r8's decode checked
  `legacyPairs + live > 256` BEFORE conversion — the real production file
  (agt_hr-agent at exactly 43 + 213 = 256, one non-contiguous eviction from
  257) would be rejected at the plain constructor load, bricking the
  upgrade before compression ever ran. r9: per-tuple validation, THEN
  conversion, THEN caps on the COMPRESSED form (tuple count at the
  restored-cap check; exactness arrays bounded by the new frozen
  `MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT = 16384` — 64x the measured
  production state — enforced fail-loud at eviction and restore, never a
  silent forgetting). Live generation entries stay capped 1:1 (they are
  live metadata, never compressible). Verified against the frozen
  production preimage (sha256 5d3d2eb2…, read-only copy, isolated load):
  startup-clean, 6 tuples carrying the exact 43 bounds, new-generation mint
  proceeds.
- **P1-C (fixture legality)**: the r8 fixture injected a range covering the
  LIVE fence generations — not a legal legacy state (the production file's
  real 43-entry list EXCLUDES the live fences 70/73/78/86, confirming the
  legality shape). The frozen fixture now seeds exactly the production
  list; tests assert no range covers a live fence and pin the explicit
  old/new turnSeq boundary for legal re-issuance into a compacted
  generation.
- **P1-D (D6 necessity falsified)**: `admissionBlockerForAgent` skips
  declaration-MARKED records (marker-only included) — only UNMARKED
  outcome_unknown fences block admission. The production fences are ALL
  marker-only (verified in the preimage). Empirically (test + real
  preimage): with the fences marker-only and NO new D6, the settled
  generations compress, a NEW HR generation mints (real preimage:
  gen302:s4947), and admission recovers. The claim "three D6 risk
  acceptances are a necessary precondition for HR admission recovery" is
  FALSIFIED. D6 acceptance remains only the path to RELEASING the
  quarantined generations' own capacity (the P0 walk gate is unchanged);
  unmarked UNKNOWN fences still block admission (unchanged semantics,
  frozen by test).
- **Rollback boundary (Owner addendum)**: after a persist writes the r9
  layout the legacy `evictedGenerations` field is gone; a PRE-r8 binary's
  validator (base 24401a34: `!Array.isArray(evictedGenerations)` →
  TypeError) fails the store CLOSED at startup — never a silent misread.
  Rollback = the established paired binary+preimage deploy discipline.
  Note (pre-existing, independent of this slice): a legacy file at 257+
  metadata entries already fails the OLD binary's own restore cap, so the
  old-binary restart of HR was already one eviction away from bricking
  before this work; the upgrade window is the recovery.



## 0r5. Fifth-review amendments (Owner residual-identity ruling + P0/P1/P2 at the r9 head; all reproduced and addressed)

- **P0 ruling (contract question, Owner directive 2026-11-21)**: a
  never-minted complete `(generation, turnSeq)` pair must NEVER be asserted
  as executed — where historical evidence is insufficient, execution identity
  is not fabricated from upper bounds. The r9 per-generation UPPER bound
  (inherited from the legacy maxSeq predicate) reproduced both residual
  counterexamples: `g11:s1` (s1 belongs to g10) and — after a same-
  generation re-issuance took s4 — `g10:s3`, both classified `evicted` on
  never-minted identities. r10 stores EXACT per-generation ISSUED INTERVALS
  (`[minSeq, maxSeq]`, unioned across re-issuance incarnations; an
  incarnation's interval is dense under the durable overlapping-intervals
  poison rule, so the union is exactly the generation's issued seq set —
  interior holes classify `never_existed`). NEW evictions are exact.
  LEGACY-pair migration maps each generation to `[[1, maxSeq]]` — the
  honest no-lower-bound-evidence representation: below-min phantoms on
  MIGRATED data keep the legacy verdict (disclosed residual; the legacy
  data cannot prove tighter), and every seq the legacy form answered
  `evicted` still answers `evicted`. Transient in-memory interleaved
  intervals cannot persist (the T8 poison rule) and live records are
  classified by the record-first guard before any interval logic.
- **P1 (long-term liveness)**: the historical gaps blocked the watermark at
  34 forever, so r9's hot intervals grew one entry per evicted generation.
  r10 adds (a) the PROVEN-ABSENCE LEDGER — a generation above the watermark
  with no entry, no live record, no range coverage, and an issuance trace
  above it was never issued (every full eviction leaves a durable trace);
  ledgered generations classify `never_existed` forever, so the watermark
  crosses ONLY proven absence and never widens a gap generation (the
  rejected r7 watermark-merge lacked exactly this); the watermark stops at
  the first real span — gaps BETWEEN ranges need no ledger (the fall-through
  already answers `never_existed`); (b) VERSIONED RETENTION — when the hot
  interval budget crosses `ARCHIVE_TRIGGER_INTERVALS` (12288), the coldest
  fully-resolved tuples move (whole, oldest first, `ARCHIVE_BATCH_INTERVALS`
  per pass) into the immutable, still-queryable `evictedArchives`: exact
  facts retained at O(bytes) cost, NEVER dropped — indefinite operation
  with zero identity loss; the hot cap (16384) and ledger cap (4096) stay
  fail-loud backstops; (c) the issuance metadata cap now counts LIVE
  generations only — resolved history no longer consumes it (the measured
  #707 256-cap lockout is structurally removed), while genuinely
  live-saturated agents still fail loud exactly as the accepted admission
  discipline requires.
- **P2 (release/rollback consistency)**: persists are DUAL-WRITTEN — the
  legacy `evictedGenerations` pairs are re-derived from the ranges and
  archives (each generation's slot max), so a pre-r8 binary can LOAD the
  file; both-forms files must be CONSISTENT (per-generation equality with
  the slot maxima) — inconsistency fails the store CLOSED. Records and
  correlations ride the unchanged record format, so a rollback loses NO new
  responsibility at the load boundary. The window is QUANTIFIED, not
  unconditional: the old loader's own 256 metadata budget (pairs + live)
  holds at deploy time (production: 43 + 213 = 256), NARROWS as recovered
  generations mint (257 after the first), and REOPENS after a full
  compaction walk (live drops to the fences + working set). The old binary's
  own capacity deadlock resumes on this shape regardless — rollback is an
  emergency lane. Documented drift under an old binary: ledgered-gap
  phantoms answer `evicted` (it has no ledger concept) and legacy-form
  bounds are maxima-only — non-live classes, never a silent corruption.
- **Owner risk-decision update (2026-11-21)**: with the four marker-only
  fences retained (never deleted — original state, successor
  responsibility, and no-replay constraints unchanged) and ZERO new D6,
  the real preimage admits a new HR generation (gen302:s4947). The three
  risk acceptances are no longer an HR-recovery precondition and are
  withdrawn from the queue.
- **Acceptance distinction (binding on the reviewer)**: "solves HR's
  current capacity fault" and "indefinitely preserves the original C-018
  identity semantics" are SEPARATE verdict lines; they must not be merged
  into one unconditional PASS. Production adoption stays with the existing
  lawful release-authorization chain; no unapproved CTO risk acceptance and
  no direct durable edits.

## 0r6. Sixth-review amendments (Owner P0-A/P0-B/P0-C + P1 at the r10 head; all reproduced, all FAIL→PASS at the r11 head)

- **P0-A (interleaved same-generation issuance)**: the incarnation span
  `[minSeq, maxSeq]` is NOT dense — mints allocate turn-seqs globally, so
  `g10:s1, g11:s2, g10:s3` left g10's interval `[1,3]` claiming the
  never-minted `g10:s2` as `evicted` (reproduced at r10). r11: every
  generation entry carries its EXACT `issuedIntervals` (each mint merges its
  own `[seq, seq]`), eviction copies the entry's intervals into the slot
  (union across incarnations), the query fall-through consults the intervals
  instead of the span, and the cross-generation poison rule upgrades from
  span overlap to INTERVAL-SET disjointness — the interleaved state is now
  loadable AND exact instead of rejected at restart (the Owner ruled a
  restart failure is not a safety answer; the T8 fixture flips to the exact
  semantics).
- **P0-B (archive broke the r10 self-reload)**: encode expanded hot+archive
  into the legacy pairs while decode's consistency gate covered only hot
  ranges → any archive pass made the binary reject its own persist
  (reproduced). r11: the dual-write expansion is HOT-ONLY (bounded by the
  hot budget; archived generations intentionally carry no legacy pair —
  old-binary drift documented, safer direction) and the gate enforces
  EQUALITY with the hot ranges' per-generation maxima (QA review finding:
  the gate is stricter than this delta's original subset wording — any
  missing OR contradicting pair fails the store CLOSED; the encode always
  writes the full expansion, so the equality gate never rejects an honest
  persist). Capacity
  alignment: the decode's new-form cap now matches the mint (LIVE
  generations only); archives carry their own budget.
- **P0-C (archive + re-issuance lost old identity)**: the covering lookup
  checked only the FIRST covering tuple, so a post-archive re-issuance's
  hot tuple shadowed the archived incarnation (`g10:s1` flipped `evicted` →
  `never_existed`; reproduced). r11: the identity fact is the UNION of
  EVERY covering tuple (hot + archive) — verified across archive, archive +
  re-issuance, and durable reload.
- **P1 (bounded retention contract — the joint bounds)**:
  `hot intervals ≤ MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT (16384)` —
  bounded in steady state by the ARCHIVE_TRIGGER (12288) + batch (4096)
  compaction, which now runs to completion (whole batches until hot ≤
  trigger) and no longer blocks on pins (the r10 pin-proximity guard
  starved the archive behind the permanent fences — removed); `ledger ≤
  4096` (one number per proven-absent generation; production: 69);
  `archive ≤ MAX_ARCHIVE_INTERVALS_PER_AGENT (262144)` — the fail-loud
  operator-rotation horizon (~6 MB of retained exact facts per agent);
  `legacy dual-write pairs ≤ hot` (bounded, archive excluded). Evidence at
  the permanent-fence shape: 10k REAL mints (282 s, dominated by the
  baseline per-mint whole-file durability write, not by retention) end with
  hot exactly 10000 in one tuple, ledger 69, fences pinned, admission
  recovered, exact probes green, file 402 KB; the 100k resolved-generation
  retention run (19 ms, injection-driven through the same walk/compaction
  path) holds hot in 8.5k–12.1k across all ten segments with the archive
  absorbing 90200 intervals and every cold/late probe exact. The walk's
  O(entries × records) scan was also fixed to a single records pass
  (quadratic → linear at retention scale).
- **QA blocker 3 (budget throw fabricated identities)**: the intervals-cap
  throw fired AFTER `generations.delete`/`records.delete`, leaving a
  trace-less genuinely-issued generation that the next compaction ledgered
  as never-issued (a real handle durably fabricated to `never_existed`;
  QA-reproduced end-to-end). r11: the budget gate precedes EVERY mutation —
  the caller's transactional snapshot rolls the eviction back cleanly on
  the untouched state.
- **Mint hardening (QA finding 6)**: `mintTurnExecution` refuses
  `processGeneration <= evictedThroughGeneration` (out-of-allocator-
  contract input used to create below-watermark live entries and persist-
  invalid tuples; now a fail-loud TypeError).


> 状态：**accepted（Owner 采纳 2026-11-21）/ docs+code atomic candidate（V3-adoption bounded route）**。
> 独立验收（exact-head semantic review PASS, BLOCKERS=NONE，验收人 ≠ 作者）已通过（r12 终审 @ `ef76165b`，含 B1/B2 回归负控 7 形态 FAIL→PASS）。
> 采纳回执：Owner 四项决定（2026-11-21）第 1 项——采纳 spec r7 @ `ef76165b`，登记进入正式发布授权链；
> **采纳 ≠ 生产换装批准**：换装仍走既有授权链排窗；归档轮转修正案独立提交，默认不授权。

## 0r7. Seventh-review amendments (Owner regression negatives B1/B2 at the 35c44e1c head; both reproduced, both FAIL→PASS at the r12 head)

- **B1 (transactional snapshot missed evictedArchives)**: `snapshotAuthority`
  spread-shared the archive array by reference — a transaction that mutated
  the archive (the capacity walk runs inside the mint transaction) could not
  be rolled back by `restoreAuthority`; the Owner reproduced the leak at
  35c44e1c. r12: the snapshot deep-copies the archive exactly like the hot
  ranges (tuples → slots → intervals). Frozen tests: the full-rollback
  invariant (mutate archive → restore → deep-equal pre-state) and the REAL
  transactional path — live generations at the cap, the mint's walk archives
  a batch, the final persist throws (`disk full`), the transactional catch
  restores the archive AND the hot ranges unchanged, settled handles keep
  their verdicts (at 35c the archive leaked through the shared reference).
- **B2 (archive budget breakthrough)**: the r11 gate ran AFTER the previous
  batch and before the next — one batch could overflow the horizon silently
  (Owner-reproduced: 262144 + moved batch = 274594, walk COMPLETED, an
  unloadable state nearly written). r12: the batch is PEEKED and budget-
  checked by its ACTUAL increment BEFORE any state modification — at the
  horizon the walk fails LOUD on the UNTOUCHED state (ranges, archive and
  accounting unchanged; the durable file stays loadable; the mint's
  transactional snapshot rolls back cleanly). This is the designed operator-
  rotation stop (§0r6), never a silent overflow. Contract symmetry: the
  archive budget is now enforced on BOTH decode forms (the r11 check existed
  only on the legacy branch). Frozen tests: archive staged exactly at the
  horizon → the walk throws `RECONCILIATION_CAPACITY_EXHAUSTED` (operator
  rotation message) with ranges/archive deep-equal pre-state; persist +
  reload clean; the stop is idempotent; the mint path rolls back without
  drift (via the B1 transaction test's staging).
- Reviewer note (Owner): 35c44e1c was not docs-only — it also touched
  store.js (the mint's issuedIntervals merge); the r12 delta review covers
  the final head against f46a3a2f AND 35c44e1c.

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

`packages/agent-router/test/process-lifecycle/watermark-gap.test.js` (r10):

- the REAL frozen production shape (watermark 34, fences 70/73/78/86, settled
  92-343, legal 43-bound legacy-evicted list excluding the live fences,
  absent 35-37 + 43-49): the mint at the 256 cap SUCCEEDS after the walk;
  the metadata sum drops under the cap; the fences stay pinned; the
  watermark never claims the absent 35-37; a second walk is a no-op;
- P0-A exactness (BOTH Owner counterexamples, verbatim): the dense-run
  [10,12] never-minted g10:s3 AND the upper-bound g11:s1 classify
  `never_existed`; after a same-generation re-issuance the g10:s3 phantom
  still classifies `never_existed` (interval unions across incarnations);
  real minted seqs classify `evicted`; the absent 35-37/43-49 gaps stay
  `never_existed` (ledgered or uncovered);
- a re-mint into a range-covered generation stays live (seq monotonicity
  above its own generation's bound) while its old handles stay `evicted`;
  re-evicting merges back and overwrites ONLY that generation's bound;
- P0-B: a legacy durable file OVER the 256 metadata sum LOADS (per-tuple
  validation, conversion, caps on the compressed form); capacity is
  recovered on that shape; persists are DUAL-WRITTEN with CONSISTENT legacy
  expansion (old-binary rollback lane) and INCONSISTENT dual forms fail
  the store CLOSED;
- P1: the proven-absent prefix LEDGERS honestly (never_existed forever;
  the watermark never claims a gap generation) and the versioned-retention
  archive keeps archived handles exactly resolvable (zero identity loss,
  indefinite operation);
- legacy migration: adjacent pairs merge with EXACT bounds preserved, a
  watermark+1 pair cascades honestly, evicted handles still classify
  `evicted`; the next persist writes only the new form; a both-forms file
  fails the store CLOSED;
- P1-D: marker-only fences do NOT block admission (HR recovers with NO new
  D6); unmarked UNKNOWN fences still block (unchanged).

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
- `packages/agent-router/src/reconciliation/capacity.js`
  (r9: `MAX_EVICTED_GENERATION_BOUNDS_PER_AGENT` frozen cap)
- `packages/agent-router/src/reconciliation/authority-capacity.js`
  (compactRuntimeEpochs tombstone-epoch protection; r9
  `markGenerationEvicted` range insert/slot-compose/cascade with exact
  per-generation bounds, `canEvictRecord` range membership)
- `packages/agent-router/src/reconciliation/store.js`
  (r8: fresh-issuance `evictedRanges`, mint/restored cap sums count ranges,
  `highestIssuedGeneration` over range ends)
- `packages/agent-router/src/reconciliation/query.js`
  (r9: `classifyHandle` range lookup against the EXACT per-generation bound —
  identical predicate to the legacy per-generation map)
- `packages/agent-router/src/reconciliation/durable-file.js`
  (r9: `encodeIssuance`/`decodeIssuance` two-form migration — convert FIRST,
  cap the compressed form; `evictedRangesFromLegacyPairs` 1:1 exact bounds)
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
