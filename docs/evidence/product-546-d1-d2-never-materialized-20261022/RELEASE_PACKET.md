# RELEASE_PACKET — Product #546 D1+D2 (non-production candidate)

- DATE = 2026-10-22
- PRODUCT = mayf3/dsh-agent-core#546 (incident 2026-10-21: HR Workflow Dispatcher — stale router process registration + queued-but-never-materialized turn)
- EXECUTION_CLAIM = router-never-materialized-r1623 (round cap-20261021T154403Z-1623)
- BRANCH = `ac-task/1244-d1d2` (authored from github/main 6d96f6d6)
- CANDIDATE_HEAD = `790a034e367e537176e23a0de1658a81e12fbfba` (parent = main tip 6d96f6d6)
- ACCEPTANCE_MODE = TEST_IDENTITY first; **PRODUCTION_MUTATION = NO** (no deploy, no restart, no config/credential/data/fence mutation, no operator reconcile, no UNKNOWN replay performed or authorized by this packet)
- D3 (deployment drain) = OUT OF SCOPE here — belongs to Product #525; no drain/watchdog/platform code added, and no compatibility assertion was required by any test in this candidate.
- D4 (job period / deadline amplification) = diagnostic context only; NO scheduler cadence/deadline policy change (the D2 predicate consumes the already-accepted C-025 `executionDeadlineAtMs`).

## 1. ROOT_CAUSE_D1 (as implemented against)

The Router's process-registry reuse gates (`ensureRunning`, route-gate `resolveSlot`) treated ONLY the observed-exit flag (`processRef.exit`) as death evidence. A slot whose process had provably died by any other exact evidence kept serving the dead registration: a REAP fence whose cleanup CAS was missed stayed `AGENT_PROCESS_REAPING` forever (its `exitPromise` never settles on the blocked-cleanup path, so the legacy `reapExitedSlot` fallback never fires); a terminal-EXITED process with `exit` unset sat in a READY slot and was reused; an OS-dead child (unobserved exit) kept being handed out on every admission attempt — the 2026-10-21 shape ("router 进程注册持续指向已退出的 gen 27", repeated `RPC initialize rejected: AGENT_PROCESS_EXITED` across slots and deployment windows).

## 2. ROOT_CAUSE_D2 (as implemented against)

The scheduler recorded exact start evidence (`onDispatch` → `startedAt`, occurrence admitted→running) but the dispatched turn never minted a Router turn record (mint precedes every prompt byte; fence rejection / dead-process pinning happened between dispatch and mint). The Router readback for the exact triple is `never_existed`, which before this candidate had NO accepted settlement path in either the engine readback consult (bare-identity evidence → quarantine zero-write) or `self_ops.reconcile_turn` (`termination_not_proven`) — the occurrence stayed `outcome_unknown` + fenced until the 60-minute outer deadline created a job-level HUMAN_REQUIRED fence that only an operator could clear.

## 3. CHANGED_FILES (commit 790a034e)

Source (6):
- `packages/agent-router/src/process-registry.js` — `hasExactDeathEvidence()` (observed exit / terminal `EXITED` state / `child.kill(0) === false` ⇒ ESRCH; probe failure or absence is never evidence) + full-identity `reapsSameProcess()`; READY reuse gate now refuses any processRef with exact death evidence; stale-REAP-fence rebuild when the full REAP identity matches AND death is proven — otherwise `AGENT_PROCESS_REAPING` unchanged.
- `packages/agent-router/src/process-registry-route-gate.js` — identical semantics in `resolveSlot` READY + REAP branches; `hasExactDeathEvidence` injected by the registry (direct callers keep the historical exit-flag-only default).
- `packages/scheduler/src/occurrence-model.js` — `TERMINATION_EVIDENCE_KINDS` += `never_materialized` (the ONE spec-bearing vocabulary extension; precedent kind `operator-trusted-evidence` already existed).
- `packages/scheduler/src/self-ops/invoker-outcome.js` — `classifyNeverMaterialized(record, readback, nowMs)` mechanical predicate; `applyTerminationSettlement` optional `opts.actorProvenance` (default unchanged).
- `packages/scheduler/src/occurrence.js` — engine `settleFromReadback`: never-materialized proof routes through the EXISTING CTR-RECON-001 `termination-only` arm → existing C-039 termination-only settlement (actorProvenance `engine-never-materialized-readback`); all other dispositions byte-unchanged.
- `packages/scheduler/src/self-ops/index.js` — `reconcile_turn` gains the never-materialized positive evidence (re-checked under the mutation lock); receipt derives `reconciled_never_materialized` + additive `evidenceKind` field (broker result schema is free-form json); `status()` rows surface the eligibility (`never_materialized_reconcile_available`).

Tests (2 new):
- `packages/agent-router/test/process-lifecycle/stale-registration-recovery.test.js` (5 tests)
- `packages/scheduler/test/self-service/never-materialized-settlement.test.js` (7 tests)

Evidence (4 files): this packet + RED-d1-router.log + RED-d2-scheduler.log + GREEN logs.

## 4. RED (captured before implementation)

- D1 (`RED-d1-router.log`): 4 RED / 1 guard-green — D1-a `ensureRunning` pinned to `AGENT_PROCESS_REAPING` over a proven-dead REAP fence; D1-b admittedAgain reused the terminal-EXITED gen-1 process (1 !== 2); D1-c attempt 0 got the SAME dead gen-1 processRef (incident pin); D1-stale reused the dead generation. D1-negative (live process) was already green and stays green.
- D2 (`RED-d2-scheduler.log`): 4 RED / 3 guards-green — engine consult zero-write on never_existed (quarantine); `reconcile_turn` → `termination_not_proven`; no-replay test could not commit; conflict test lacked the receipt field. The three fail-closed guards (pre-deadline, missing start evidence, live/evicted/restart_lost/mismatch) were green before the change and remain green after.

## 5. SETTLEMENT_RULE (D2, exact) — **VACATED in r2, see §11 P1-2 (never accepted; behavior REMOVED)**

For an unresolved `outcome_unknown` occurrence (fenced, schema v3, owner-matched, no existing settlement), the system commits the **existing C-039 termination-only settlement** (`terminationSettlement`, kind `terminated_without_outcome`, `businessStateAtCommit: 'outcome_unknown'`) with `evidenceKind: 'never_materialized'` **iff all** of:
1. durable start evidence exists — `startedAt` written by the invoker seam (dispatch proven);
2. the occurrence's accepted execution deadline has elapsed — `nowMs >= executionDeadlineAtMs` (the already-accepted bounded condition; no new timer/watcher/cadence);
3. the exact-triple Router readback (existing `resolveCallerCorrelation` authority) returns `never_existed` — no turn record was ever minted for (occurrenceId, runId, requestId) in the Router store's durable history. `restart_lost` / `evicted` / `pending` / mismatch / anything else NEVER qualify.
Business state stays `outcome_unknown` (no fabricated business outcome); the fence is released through the existing ledger rebuild; schedule disposition `recurring_future_natural_only` (one-shot: `one_shot_disabled`); NO automatic retry (retryCandidate requires a failed terminal) and NO replay. Business state stays UNKNOWN and the fence stays up for every unproven shape.

## 6. NO_REPLAY_PROOF

- The settlement writes only the existing occurrence's terminal annotation — no new admission, no re-invocation: `never-materialized-settlement.test.js` "no replay and no parallel writer" asserts invoker call count and occurrence count are unchanged by the settlement, and the next natural slot admits exactly ONE fresh occurrence while the settled record's settlement/history stay untouched.
- Receipts carry `replayOccurrence: false` (engine evidence line asserted in tests); settle-once under `store.mutateDoc` — second engine consult `deepEqual([])`, second `reconcile_turn` replays the same receipt/operationId with zero history growth (C-045), and an existing `child_real_exit` settlement is never overwritten by the never-materialized path (conflict test).
- D1's rebuild never replays turns: it only invalidates a dead registration so the ordinary EMPTY→STARTUP CAS path mints a NEW generation; late old-generation callbacks stay audit-only (D1-stale test).

## 7. TESTS

- RED-first: D1 5 tests (4 RED pre-fix → 5/5 GREEN post-fix); D2 7 tests (4 RED pre-fix → 7/7 GREEN post-fix; the 3 fail-closed guards were green before AND after).
- Focused regressions (this worktree, node v26.7.0): scheduler `test/*.test.js + self-service + watchdog` 428/428; scheduler `cross-agent + self-service` 133/133; scheduler core (occurrence-model, terminal-proof-containment, history, history-durability, scheduler, process-faults) 71/71; scheduler-router 33/33; agent-router process-lifecycle + generation-restart-safety 230/230; agent-router full tree 487 pass / 7 fail where the clean tree at the same HEAD~ fails 9 — **zero new failures, two net fixes**; broker self-ops-v3 5/5 (after installing that package's own deps).
- Pre-existing environmental failures, identical on the clean tree (NOT caused by this candidate): production-runtime compose suites (NODE runtime-version pin vs local node v26), agent-router broker-rpc/credential seam tests (freshly installed nested deps in this worktree).

## 8. REVIEW (independent changed-surface review, 2026-10-22)

REVIEW_VERDICT = **PASS**, LOAD_BEARING_GAPS = **0**. Adversarial checks: no pre-exit EMPTY window (every delete is gated on exact death evidence of the exact processRef; V4 C-006..C-009 respected); kill(0) probe fail-closed (throw/absence/undefined never evidence; legacy fakes unaffected); a LIVE or identity-mismatched REAP fence can never be deleted; a LIVE turn can never satisfy the never-materialized predicate (mint binds the correlation atomically; unresolved records are never evictable; state/predicate guards); business state never fabricated; settle-once holds across engine/self-ops/operator writers; scope clean (no cadence change, no second registry/watcher/timer, no drain platform).
Non-blocking notes recorded (to ride the spec amendment): (1) a SETTLED-then-capacity-evicted router record also reads back `never_existed` — if the whole window had the engine down, `never_materialized` can be a factual mislabel while the disposition and UNKNOWN containment stay correct and the authorized late-business path remains open; (2) engine vs self_ops `evidenceId` inputs differ (occurrenceId vs absent handle) — never both commit, cosmetic; (3) status row shows `QUARANTINED_UNKNOWN` reconciliationState alongside the new blockerCode — cosmetic; (4) C-007 REAP semantics refinement (reject is now death-evidence-gated, post-exit only) — one-line spec note; (5) `hasExactDeathEvidence(null) === true` strictly safer for a hypothetical null-processRef READY slot.

## 9. SPEC_COMPLIANCE — **r1 delta VACATED in r2, see §11 P1-2 / §14 (r2 = PASS with NO spec-bearing delta)**

- Governing accepted Specs: AGENT_PROCESS_LIFECYCLE_HARDENING_V4 (registry C-006..C-009/C-020 — respected; no pre-exit window; no C-020 order change), SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 (CTR-RECON-001 arms reused unchanged), SCHEDULER_TIMEOUT_OUTCOME_V3 + SCHEDULER_TERMINAL_PROOF_AND_UNKNOWN_CONTAINMENT_V1 (business proof ≠ termination proof preserved), AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3 (receipt/settle-once/audit semantics preserved).
- SPEC_COMPLIANCE = **PASS with one declared spec-bearing delta**: `TERMINATION_EVIDENCE_KINDS` += `never_materialized` and `reconcile_turn` positive eligibility extends the V3 "唯一 positive disposition" rule by one mechanically-guarded evidence kind. The reviewer judged it a FAITHFUL extension within the UNKNOWN-containment design (compose of the V3 exact/trusted/current-epoch proof definition + two added mechanical guards; existing C-039 settlement schema; real vocabulary precedent `operator-trusted-evidence`; C-029 anticipates termination-evidence form extensions). Per repo governance, this delta — plus residual note 8(1) — requires accepted Spec amendment BEFORE any production apply; this candidate is non-production and makes no production claim.
- DEVELOPMENT_PREFLIGHT: governing specs/relevant evidence/no-reopened-rejections declared at execution start (2026-10-22, this session); implementation did not modify any governing Spec file.

## 10. OPERATOR OPTIONS (none executed)

- PR-ready candidate: merge branch `ac-task/1244-d1d2` at 790a034e (tests + evidence included).
- Spec amendment lane (required before production adoption): one-point amendment declaring `never_materialized` in the V3/self-ops evidence vocabularies + the retention-race caveat and the C-007 REAP-refinement note.
- Deployment/drain compatibility evidence for #525: not required by this candidate; nothing added.

---

# REVIEW_RECONCILIATION r2 — PR #547 review findings (2026-10-22)

- TRIGGER = PR #547 independent review (codex, exact head `3a2df33d4f5b01623cfba0551f4090fe0bf980ce`, 2026-10-21): four unresolved P1 findings.
- SCOPE = reconcile ONLY the PR #547 findings on the SAME PR; no duplicate PR, no merge, **PRODUCTION_MUTATION = NO**; D3 stays owned by #525.
- R2_HEAD = this packet's commit (parent = `3a2df33d`, the reviewed head — additive only).

## 11. FINDINGS → DISPOSITIONS (all four reproduced before any code change)

**P1-1 kill(0)/`ChildProcess.kill() === false` treated as ESRCH/death — CONFIRMED, FIXED.**
`hasExactDeathEvidence` read any `child.kill(0) === false` as death. `ChildProcess.kill()` reports EVERY undeliverable signal 0 as `false` — EPERM (the process EXISTS, this uid may not signal it) exactly like ESRCH — so a LIVE foreign-uid child would have its registration deleted and a parallel generation spawned.
RED at `3a2df33d` (r2-RED-d1-router.log): "P1-1 a kill(0) === false on a REAL ChildProcess (the EPERM shape…)" + "P1-1 …duck-typed (non-ChildProcess) child…".
FIX: the predicate moved to `process-registry-death-evidence.js`; the OS probe is `process.kill(pid, 0)` — the ONLY surface with an explicit errno — and death requires **exactly `code === 'ESRCH'`**; a delivered probe (success), EPERM, any other throw, a duck-typed/fake child surface (gated on `instanceof ChildProcess`), or a missing/bad pid is NEVER evidence (fail closed). PID reuse can only ever mask a death, never fabricate one. `child.kill(0)` is no longer consulted anywhere.

**P1-2 `never_existed` promoted to termination proof — CONFIRMED, REMOVED (unaccepted settlement behavior).**
The r1 candidate settled `never_existed` (+ startedAt + elapsed deadline) as `never_materialized` termination evidence via the engine consult AND `reconcile_turn`. The accepted contracts say otherwise: SCHEDULER_TIMEOUT_OUTCOME_V3 **C-040**: "pending/restart_lost/evicted/**never_existed**/mismatch/conflict/unsupported 均不是 proof"; SELF_SERVICE_V4 **CTR-V3-RECON-002**: `never_existed` → `termination_not_proven`. The Router also reports `never_existed` after capacity eviction removes a settled record's correlation index, so the state cannot mechanically establish "never materialized" (the r1 packet's own non-blocking note 8(1)).
DISPOSITION: the settlement behavior is **REMOVED from the merge candidate** — `occurrence-model.js`, `occurrence.js`, `self-ops/index.js`, `self-ops/invoker-outcome.js` are reverted byte-for-byte to the accepted base (fail-closed UNKNOWN + fence preserved; `never_existed` → `termination_not_proven`, zero-write). §5 SETTLEMENT_RULE and the §9 "declared spec-bearing delta" are **VACATED** — authority was NOT widened by implementation and no acceptance is invented.
RED at `3a2df33d` (r2-RED-d2-scheduler.log): "D2 guard (C-040): the exact incident shape … stays termination_not_proven" + "D2 guard: the engine readback consult never settles never_existed".
**INTERNAL_DEPENDENCY (exact):** D2's deterministic never-materialized settlement is BLOCKED on an accepted Spec amendment that (a) adds `never_materialized` (or an equivalent mechanically-provable evidence kind that survives router retention eviction) to the V3 termination-evidence vocabulary (`TERMINATION_EVIDENCE_KINDS` / C-040 positive set), and (b) extends the SELF_SERVICE_V4 CTR-V3-RECON-002 negative mapping accordingly. WAKE CONDITION = the existing SCHEDULER_TIMEOUT_OUTCOME_V3 / AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4 Spec owner records durable acceptance of that amendment (or an explicit rejection); only then may the settlement behavior return to this Product's candidate. Until then every `never_existed` unknown stays `outcome_unknown` + fenced (operator C-029 reconcile remains the only release path, as accepted).
The replacement test file `never-materialized-fail-closed.test.js` pins this fail-closed posture INCLUDING the exact incident shape (start evidence + elapsed deadline + `never_existed`) so the settlement cannot silently return without its amendment; the ACCEPTED path (router-reported `terminated_without_outcome`, e.g. `child_real_exit`) is pinned as still settling (regression guard).

**P1-3 REAP-fence cleanup bypassed the exact identity CAS — CONFIRMED, FIXED.**
Both `ensureRunning` and route-gate `resolveSlot` deleted a REAP fence whose full identity matched a proven-dead processRef and immediately minted a new generation. V4 C-007 requires EVERY REAP admission to reject; C-009 permits `REAP → EMPTY` only through the exact identity CAS (generation + entryId + processRef + ownershipToken) as the final step of the process exit sequence after real exit AND reconciliation visibility — and the fence's `reapPromise` must be resolved by that path, not left dangling by an admission-side `delete`. The bypass also omitted `entryId` entirely.
RED at `3a2df33d` (r2-RED-d1-router.log): "D1-a a REAP fence whose cleanup CAS was missed still rejects admission…" (the bounded race fired: admission ran a startup side effect instead of rejecting).
FIX: both sites reverted to the unconditional `AGENT_PROCESS_REAPING` rejection / `{status:'reaping'}` report. A missed cleanup (blocked CAS, crashed exit sequence) now fails closed and loud — every admission rejects until the process-owned cleanup completes or the runtime restarts (the in-memory registry rebuilds empty). The D1 incident fix itself (READY-reuse death-evidence gate) is untouched by this: the 2026-10-21 pin was a READY slot, not a REAP fence.

**P1-4 process-registry.js crossed the 500-line hard limit — CONFIRMED, FIXED.**
467 → 509 physical lines at `3a2df33d`; `CODE_STRUCTURE_GUARDRAILS_V1` §6: a base ≤500 file crossing >500 at head is a hard violation (`NEW_LEGACY_VIOLATION_CROSSED_500`, machine verifier exit 1 — reproduced at `3a2df33d`, r2-RED-structure.log).
FIX: smallest responsibility-preserving split — the death-evidence predicate moved whole to the new 44-line `process-registry-death-evidence.js` (single cohesive responsibility: exact-death-evidence semantics for the reuse gates); `process-registry.js` is now **478 physical lines**; the route gate imports the module directly (its transient injection parameter removed). No broad refactor, no behavior change beyond P1-1/P1-3. Verifier at r2 head: violation set **byte-identical to main's 11 pre-existing directory-class entries** (r2-GREEN-structure.log; base-vs-base fails identically) — this PR introduces ZERO new structure violations.

## 12. R2 GREEN MATRIX (node v26.7.0, this worktree)

- Focused new tests: **14/14** (D1 `stale-registration-recovery.test.js` 10 — probe units + rig fail-closed/rebuild semantics; D2 `never-materialized-fail-closed.test.js` 4) — r2-GREEN-focused.log.
- agent-router process-lifecycle + generation-restart-safety + registry + startup-wedge: **257 pass / 0 fail / 1 skipped** — r2-GREEN-router-lifecycle.log.
- scheduler full tree (core + self-service + watchdog + cross-agent): **425/425** (r1's 428 minus the removed 7 settlement tests plus the 4 fail-closed guards) — r2-GREEN-scheduler.log.
- scheduler-router: **33/33** — r2-GREEN-scheduler-router.log.
- agent-router full tree: 494 pass / 5 fail / 2 skipped, failure set **identical to the pre-fix reviewed head `3a2df33d`** (pre-existing environmental gateway-seam/credential-chain failures, untouched surface) — r2-GREEN-router-full.log.
- Structure verifier: base-relative violation set identical to main (zero new; P1-4 repaired).

## 13. R2 NO_REPLAY / PARALLEL_WRITER PROOF (unchanged invariants, re-pinned)

- D2 fail-closed guards assert `invoker.calls.length === 1` and `listOccurrences().length === 1` after every refused reconcile (the turn is never re-invoked, no parallel admission), plus zero history growth and the fence still up; the accepted-path regression still asserts C-045 settle-once replay (same operationId, zero history growth) and original-history-prefix preservation.
- D1's rebuild still only invalidates a dead READY registration into the ordinary EMPTY→STARTUP CAS path (new generation, no turn replay); late old-generation callbacks stay audit-only (D1-stale).

## 14. R2 REVIEW

**Independent exact-head changed-surface review (fresh reviewer, this worktree HEAD = 413f41f9 + d048174e, 2026-10-22): R2_REVIEW_VERDICT = PASS, LOAD_BEARING_GAPS = 0, SCOPE_CHECK = CLEAN.** Independently reproduced: scheduler src diff vs base = 0 bytes; no `never_materialized`/`reapsSameProcess`/`kill(0)` references anywhere under packages/ at HEAD; both REAP admission sites byte-identical to base; verifier violation sets base-vs-base and base-vs-HEAD identical (11 = 11, exit 1 on pre-existing legacy entries only); focused 14/14, router lifecycle glob 258 tests / 257 pass / 0 fail / 1 skipped; wc -l 478 / 44 / 194; RED logs authenticate the old-head failures (incl. the D1-a bounded race converting the old head's minted startup into a clean failure). Non-blocking notes recorded: (1) `packages/agent-router/test/process-lifecycle` children 23 → 24 vs base (the r1-added stale-registration file) — growth of an already-over-ceiling unregistered legacy directory, mechanically unviolated (no directory MUST_NOT_GROW rule) but against guardrails intent; registry entry requires owner acceptance, consolidation deferred. (2) §5/§9 now carry inline VACATED banners. (3) The deleted r1 test's "missing start evidence" shape collapses into the base negative matrix pinned by self-ops-v3.test.js (never_existed/pending/restart_lost/evicted/unsupported → termination_not_proven; mismatch/conflict → correlation_mismatch) — coverage adequate. (4) EPERM direction verified sound (live foreign-uid child → fail closed; after death → ESRCH). (5) `reapExitedSlot` deletes on processRef identity — base code, unchanged, processRef identity implies the remaining CAS fields; not an r2 defect.

R2 SPEC_COMPLIANCE = PASS: the candidate now contains NO spec-bearing delta — D1 operates entirely within AGENT_PROCESS_LIFECYCLE_HARDENING_V4 C-006..C-009 semantics (reuse-gate death evidence + unconditional REAP rejection), and the scheduler tree is byte-identical to the accepted base. No governing Spec file is modified by this branch.

## 15. R2 EVIDENCE FILES

r2-RED-d1-router.log.txt, r2-RED-d2-scheduler.log.txt, r2-RED-structure.log.txt, r2-GREEN-focused.log.txt, r2-GREEN-router-lifecycle.log.txt, r2-GREEN-scheduler.log.txt, r2-GREEN-scheduler-router.log.txt, r2-GREEN-router-full.log.txt, r2-GREEN-structure.log.txt (+ the base/head violation-set listings r2-GREEN-structure-{base,head}-violations.txt, `diff` = empty). All captured 2026-10-22 at the exact commits named above (`.log.txt` because `*.log` is gitignored repo-wide).
