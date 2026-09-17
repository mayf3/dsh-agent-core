# SCHEDULER_RETRY_MINTER_CROSS_REVISION_FIX_V1 — Evidence Record

Date: 2026-09-17 · Branch: `goal/scheduler-retry-minter-cross-revision-v1` (base `origin/main` = `bb5327f`) · Lane: B of the Owner-approved "先 A 再 B" sequence under `SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1` (WGR §goal; A = interim mitigation already applied in production).

## 1. Incident (production, fleet-wide)

- Production runtime err log: **753,986** consecutive `tick failed: scheduler store: occurrence authority corrupted: invalid retry predecessor for occ:8ac05871baf1a522` (2 s tick cadence).
- Hard proof of origin (root, brute-force derivation over the deployed formula): `occ:8ac05871baf1a522` = `deriveOccurrenceId([job b115cb96…, revision 2, 'retry', occ:a7c646cf2c5ea8f3])` — a retry candidate derived by the tick for job `b115cb96…` ("HR 内容 Workflow 派发试运行", every-30m, `retry.auto=true`), whose terminal failed predecessor `occ:a7c646cf2c5ea8f3` sits at **scheduleRevision 1** while the job had been edited to **revision 2**.
- Mechanism: `retryCandidate` proposed a retry stamped with the job's CURRENT revision (2) referencing the rev-1 predecessor; the JobStore occurrence-authority invariant (predecessor must share `scheduleRevision`) failLoud-threw inside the reserve write path → mutation refused (`mutationOutcome=not_committed`; disk + store cache stayed clean — verified: 416 persisted occurrences, 0 referrers of the poisoned id, fences clean) → error propagated through the candidates loop (receipting later candidates `SKIPPED_POLICY 'tick aborted…'`) → re-thrown to `tick().catch` → every tick died. Full-stop window measured 2026-09-17 ~07:00→12:08Z (zero mints fleet-wide); earlier ticks partially minted jobs ordered before the poisoned candidate.

## 2. Plan A (interim mitigation, production-applied 2026-09-17)

Canonical `updateJobOp` set `retry.auto=false` on the poisoned job (revision 2→3), making the retry derivation inert at source. Post-A verification (Owner-run root script): err-log 20 s delta = **0** (pre-fix ≈ 2,800 B/10 s), 8790 health ok, occurrence total 416→**419** with fresh mints at 12:08–12:09Z. **retry.auto stays false until B is deployed.**

## 3. The fix (this branch) — derivation-side only

- `packages/scheduler/src/eligibility.js` `retryCandidate`: a terminal predecessor whose `scheduleRevision ≠ job.scheduleRevision` yields `{ exhausted: true, staleRevision: true, chain, terminal, retryOfOccurrenceId, predecessorScheduleRevision }` — never mintable on the existing `exhausted` gate, so every consumer (tick detection, control-plane reserve, `computeNextRunAtMsV2`) stays closed by construction.
- `packages/scheduler/src/scheduler.js` tick detection: durable `retry_superseded_by_revision` run event (`store.appendRunEvent`, fields ts/action/jobId/retryOfOccurrenceId/predecessorScheduleRevision/jobScheduleRevision — no payload or user content), deduped **per engine session per superseded state** (`(jobId, predRev→jobRev)`, marked only on successful append), then falls through to natural minting — the job's slots resume.
- `packages/scheduler/src/occurrence.js` reserve: stale-specific refusal `retry_stale_schedule_revision` (defense in depth behind the detection gate).
- Store invariant **UNCHANGED** (store.js untouched; failLoud remains the last line of defense). No schema/persisted-shape/API change; retry opt-in policy (D-007 §7.5 code anchor; superseded-by D-009 semantics respected — occurrences stay bound to their creation revision) and backoff tables untouched. No historical reclassification; the production store needs NO repair (it was never poisoned).

## 4. RED-first verification

`packages/scheduler/test/retry-stale-revision.test.js` (5 tests):

1. Production-shape repro: failed occ at rev1 + schedule edit → rev2 + retry.auto, clock past backoff — pre-fix `await tick()` REJECTS with the exact production error `invalid retry predecessor` (healthy trailing job starved); post-fix: tick resolves, natural rev-2 occurrence minted, no retry record, healthy job minted, supersession event fields exact, next tick stable.
2. Dedup: 'at'-job stale state persists across two ticks → exactly ONE receipt (per engine session).
3. Unit: stale marker shape (`exhausted:true`, `staleRevision:true`, no `due`/`eligibleAtMs`); same-revision unchanged (`due:true`); opt-in policy intact (null without `retry.auto`).
4. Projection (non-vacuous 'at'-kind witness): mintable retry replaces projection (31,500); stale equals the retry-disabled projection.
5. Defense-in-depth: directly proposed cross-revision candidate through `_reserve` refused with `retry_stale_schedule_revision`, nothing persisted.

## 5. Reviews

Two INDEPENDENT fresh-context reviewers (no shared conclusions), both on `fa65ee5`:

- Semantic review: **PASS / 0 blockers** (consumer enumeration complete incl. re-exports and projection consumers; gate ordering safe; store invariant untouched; ACC-009 byte-identical; RED test statically verified as a true reproduction).
- Safety review: **PASS / 0 blockers** (no new store write path; fail-safe direction proven for every consumer branch; appendRunEvent cannot throw; per-job try/catch still bounds; no secrets; once-per-session dedup cannot hide safety evidence; deterministic clock-controlled tests; zero normative contract/schema change per .agents/README.md REUSE).
- 3 NON_BLOCKING findings absorbed in `9fbc75a` (mark-on-ok receipt, non-vacuous projection test, reserve refusal test); delta re-reviewed by both reviewers.

## 6. Suite

`scheduler` 355 (incl. 5 new) + `scheduler-router` 29 = **385 pass / 0 fail**. `production-runtime` 87 pass / 8 module-resolution failures pre-existing on pristine `origin/main` (`@larksuite/channel` unavailable in a fresh worktree; proven via stash — unrelated to this diff).

## 7. Deployment status

DEPLOYED=NO. Production still runs the pre-fix binary; the only protected job is the one whose `retry.auto` was set false under Plan A. Any OTHER job that (a) has `retry.auto=true`, (b) suffers a failed occurrence, and (c) gets its schedule edited before the retry fires would re-trigger the tick death. Deployment requires Owner authorization + production queue slot; after deploy, Plan A's `retry.auto=false` may be re-enabled (independent mutation).
