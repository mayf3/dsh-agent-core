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

## 5. SETTLEMENT_RULE (D2, exact)

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

## 9. SPEC_COMPLIANCE

- Governing accepted Specs: AGENT_PROCESS_LIFECYCLE_HARDENING_V4 (registry C-006..C-009/C-020 — respected; no pre-exit window; no C-020 order change), SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1 (CTR-RECON-001 arms reused unchanged), SCHEDULER_TIMEOUT_OUTCOME_V3 + SCHEDULER_TERMINAL_PROOF_AND_UNKNOWN_CONTAINMENT_V1 (business proof ≠ termination proof preserved), AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3 (receipt/settle-once/audit semantics preserved).
- SPEC_COMPLIANCE = **PASS with one declared spec-bearing delta**: `TERMINATION_EVIDENCE_KINDS` += `never_materialized` and `reconcile_turn` positive eligibility extends the V3 "唯一 positive disposition" rule by one mechanically-guarded evidence kind. The reviewer judged it a FAITHFUL extension within the UNKNOWN-containment design (compose of the V3 exact/trusted/current-epoch proof definition + two added mechanical guards; existing C-039 settlement schema; real vocabulary precedent `operator-trusted-evidence`; C-029 anticipates termination-evidence form extensions). Per repo governance, this delta — plus residual note 8(1) — requires accepted Spec amendment BEFORE any production apply; this candidate is non-production and makes no production claim.
- DEVELOPMENT_PREFLIGHT: governing specs/relevant evidence/no-reopened-rejections declared at execution start (2026-10-22, this session); implementation did not modify any governing Spec file.

## 10. OPERATOR OPTIONS (none executed)

- PR-ready candidate: merge branch `ac-task/1244-d1d2` at 790a034e (tests + evidence included).
- Spec amendment lane (required before production adoption): one-point amendment declaring `never_materialized` in the V3/self-ops evidence vocabularies + the retention-race caveat and the C-007 REAP-refinement note.
- Deployment/drain compatibility evidence for #525: not required by this candidate; nothing added.
