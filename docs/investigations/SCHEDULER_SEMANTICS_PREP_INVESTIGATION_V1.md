# SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1 — Scheduler semantics, traceability gap census, production-job migration list, authority determination

- ROUND: PRODUCTION_RND_PARALLEL_PREPARATION_V1 / LANE_2 = PRODUCTION_RND_SUPPORT_PREPARATION (PREPARATION TRACK — production deployment OUT OF SCOPE)
- BASE_COMMIT = 840d2f4ad91f8252eb1f163330c041216a0dd9c4 (github/main tip), worktree branch `prep/scheduler-semantics-investigation-v1`
- METHOD: static read-only investigation. Zero live service/port queries. packages/broker/src/capabilities/workflow.js untouched (other goal's exclusive file).
- TASK_TYPE: INVESTIGATION_DOCS_ONLY（零产品代码改动；本轮仅新增本文件 + docs/reports/agt-prep-scheduler-semantics-investigation-v1.md + evidence/scheduler-code-excerpts.md）

```text
DEVELOPMENT_PREFLIGHT

Problem =
  生产 RnD 并行准备需要精确掌握：Scheduler 在 BASE 的真实触发/执行/结果语义、
  相对 staged draft spec（AGENT_CORE_SCHEDULER_RUN_HISTORY_V1）的可追溯性缺口、
  已知生产 scheduler jobs 的文档化迁移状态、以及本轮可实现性权威判定。

Governing authorities =
  D-007 SCHEDULER_OCCURRENCE_OUTCOME_V2（accepted — Current Scheduler Authority）
  SCHEDULER_TIMEOUT_OUTCOME_V2（accepted，implementation_authority: contracts）
  AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1（accepted，implementation_authority: contracts）
  D-005 SCHEDULER_V1（superseded，仅历史 rationale）

Spec status =
  AGENT_CORE_SCHEDULER_RUN_HISTORY_V1（staged WIP draft，proposed，
  implementation_authority: none，not in git at BASE）→ 实现本轮 PAUSED_AUTHORITY。

Boundaries honored = 仅本 worktree 写入；无 push/remote；无 live 查询；
  无 npm install / 无测试执行；workflow.js 只读未触。
```

---

## A. CURRENT SEMANTICS AT BASE (code evidence, BASE 840d2f4)

### A.1 Trigger types — exactly three: `cron` | `at` | `every` (NO `run_once`)

`normalizeSchedule` (packages/scheduler/src/schedule.js:215-247) is the single canonicalizer; any other kind throws (`schedule.kind must be cron|at|every`, schedule.js:246). One-shot semantics do NOT have a dedicated kind: a one-shot is `kind:'at'` with `deleteAfterRun` defaulting to true for `at` jobs (packages/scheduler/src/job-model.js:154-155).

| kind | parse rule | evidence |
|---|---|---|
| `cron` | expr must be exactly 5 fields (schedule.js:236-237); evaluated with `croner` (`new Cron(expr, {timezone, catch:false})`, schedule.js:88); validated eagerly at normalize (schedule.js:243); optional `tz` (schedule.js:239-240); optional `staggerMs` (schedule.js:240-241) | schedule.js:233-244 |
| `at` | `parseAbsoluteTimeMs` accepts: pure-digit epoch-ms (schedule.js:37-41); ISO with Z/offset (schedule.js:45); **date-only `YYYY-MM-DD` → `T00:00:00Z`** and **offset-less datetime → `Z` (UTC)** (schedule.js:42-43). normalizeSchedule for job definitions requires an ABSOLUTE instant — relative durations are rejected here (schedule.js:219-222). Relative durations ("15m") are resolved only at the submission seams: `submitOneShotOp` uses `parseAtToMs(input.at, nowMs)` (packages/scheduler/src/control.js:130-131; parseAtToMs schedule.js:64-72) and the broker self-service schema documents "Future ISO instant or positive relative duration such as 15m" (packages/broker/src/capabilities/scheduler.js, `at` arg). `at` fires only if strictly future (schedule.js:174-177). | schedule.js:33-47, 218-224, 173-177 |
| `every` | `everyMs` ≥ 1 (schedule.js:227-228); optional `anchorMs` ≥ 0 (schedule.js:229-230); fixed-rate grid `anchor + k*everyMs` strictly after now (computeEveryNext schedule.js:149-162); fallback anchor = job `createdAtMs` (opts.fallbackAnchorMs, schedule.js:178-179; caller eligibility.js:177-178) | schedule.js:149-162, 225-231 |

**Stagger (cron only)**: effective stagger = explicit `staggerMs` > auto 300s for recurring top-of-hour expressions (minute field `0` + hour field contains `*`, schedule.js:94-99, 102-107) > 0; per-job offset = `sha256(jobId)` first uint32 `% staggerMs` (schedule.js:110-114) — stable across restarts, matching OpenClaw (`DEFAULT_TOP_OF_HOUR_STAGGER_MS = 300*1000`, schedule.js:25). `computePreviousRunAtMs` (catch-up basis) is cron-only (schedule.js:191-192).

**Timezone handling**: cron resolves `tz` field, defaulting to `Intl.DateTimeFormat().resolvedOptions().timeZone` = deployment system-local timezone (schedule.js:74-78) — deployment-dependent (both deploy runbooks pin `tz: Asia/Shanghai` explicitly, e.g. quick-restore runbook §3 JSON). `at` is epoch-based except the UTC normalization of offset-less inputs (flag below, A.6-1). `every` is tz-free epoch math.

**Refire gap**: next natural slot must be ≥ `MIN_REFIRE_GAP_MS` = 2000ms after last terminal run end (schedule.js:27; eligibility.js:109-114).

### A.2 Due eligibility & occurrence kinds

Occurrence kinds: `natural | retry | catchup` (packages/scheduler/src/occurrence-model.js:20). Due pre-scan (packages/scheduler/src/eligibility.js:121-139): enabled + most-recent nominal slot ≤ now + slot strictly after max(last-terminal-end+2s, revision activation boundary) (eligibility.js:109-114); `every` additionally holds admission until `endedAt + everyMs` (eligibility.js:129-134); `at` slots older than `DEFAULT_AT_CATCHUP_GRACE_MS` = 15min are stale and never execute (eligibility.js:33, 135-137) — stale one-shots stay unexecuted per D-007 §7.3. Retry candidate requires explicit `job.retry.auto === true` (eligibility.js:147; job-model.js:135-140 — absent = AUTO_RETRY_DEFAULT NO per C-009/D-007 §7.5). Backoff tables: one-shot [30s,60s,300s] max 3, recurring [30s,60s,5m,15m,60m] (eligibility.js:29-31); retry = NEW occurrence linked by `retryOfOccurrenceId` (occurrence-model.js:70-76).

### A.3 Occurrence identity + admission idempotency

- `occurrenceId = 'occ:' + sha256(len-prefixed(jobId|scheduleRevision|kind|slot)).hex[:16]`; slot = nominal (natural) / `retryOfOccurrenceId` (retry) / `catchUpOfNominalAt` (catchup) (occurrence-model.js:56-76). Deterministic across ticks/restarts/reloads (C-023).
- `runId = 'run:' + occurrenceId` (occurrence-model.js:78-80); `idempotencyKey = occurrenceId` (buildOccurrenceRecord occurrence-model.js:263; validated occurrence-model.js:183).
- `payloadHash = 'sha256:' + sha256(canonicalJSON({agentId, payload{kind,message,timeoutSeconds,lightContext,model}}))` — delivery excluded (occurrence-model.js:102-118, C-024).
- `nativeSessionId = 'cron-run-' + occurrenceId` (occurrence-model.js:87-89, C-031 fresh non-main per occurrence; validate rejects 'main', occurrence-model.js:191-194).
- Logical coordinates: natural & catchup share the nominal slot space — at most ONE record per `(jobId, revision, nominal)` regardless of kind (occurrence-model.js:121-131; store duplicate-coordinate enforcement maps catchup→natural key, packages/scheduler/src/store.js:269-275).
- **Reserve (admission idempotency authority)** — `reserveOccurrence` (packages/scheduler/src/occurrence.js:34-121), entirely inside the cross-process mutation lock (`store.mutateDoc`, store.js:119-192): (1) coords lookup → same id + same payloadHash ⇒ `deduped:true` (occurrence.js:51-61); same id + different payloadHash ⇒ `OCCURRENCE_PAYLOAD_CONFLICT` fail-loud (occurrence.js:54-59); coords/id collision ⇒ `OCCURRENCE_STRUCTURED_COLLISION` (occurrence-model.js:138-147; occurrence.js:62-63); (2) full eligibility re-check (enabled/revision/fence/no-non-terminal/retry-or-natural match, occurrence.js:65-84); (3) `invoker.assertRunnable(agentId)` (occurrence.js:97); (4) record pushed with `state:'admitted'` and persisted deadline `executionDeadlineAtMs = admittedAt + timeoutMs` (occurrence-model.js:248-274, C-025 reserve-before-Router per D-007 §11.2).
- Process-level defense-in-depth: scheduler-router bridge keeps a per-process `PROCESS_ADMISSIONS` map keyed by `requestId` with payload fingerprint; same key + different payload ⇒ `OCCURRENCE_PAYLOAD_CONFLICT`, same key ⇒ returns the existing promise (packages/scheduler-router/src/index.js:43-45, 206-226). Header notes cross-process durability remains the ledger + AgentProcess caller-correlation authority (scheduler-router:43-44).
- Single-live-engine guard: engine lease verify before every admission; lost lease halts admission fail-loud (packages/scheduler/src/scheduler.js:89-136; lease mechanics store.js:104-117; OwnerLock packages/scheduler/src/lock.js).

### A.4 Execution flow

1. Engine loop: 1s interval tick (scheduler.js:52, 144-150), single-flight with rerun-pending coalescing (scheduler.js:157-174), lease assert (scheduler.js:177), re-load latest doc each tick (scheduler.js:179).
2. Candidate scan per job: skip disabled / fenced / has-non-terminal-occurrence (scheduler.js:182-183; `hasNonTerminalOccurrence` eligibility.js:52-54); retry candidate takes priority (scheduler.js:184-188); else natural candidate (scheduler.js:189-195); concurrency cap 5 (scheduler.js:53, 199).
3. Startup (`start`, scheduler.js:89-112): engine lease → `ensureUpgraded()` (v1→v2 upgrade, packages/scheduler/src/store-migration.js) → load → **mandatory** `_sweepUnresolved()` (every admitted/running record ⇒ `outcome_unknown`, reason `restart_unresolved`, fences rebuilt — scheduler.js:211-232) → optional `_startupCatchup()` (at most the most recent eligible missed slot per job, as kind `catchup` — scheduler.js:235-262; disabled in production via `--catchup 0` per runbooks).
4. Run occurrence (occurrence.js:144-193): `router_admission` attempted evidence (occurrence.js:148-155) → `_invokeWithDeadline` (occurrence.js:196-235) → `_classifyOutcome` (occurrence.js:237-271) → `router_admission` terminal-phase evidence (occurrence.js:158-169) → delivery (occurrence.js:170, 274-290) → authoritative writeback (occurrence.js:171, 293-351) → if `outcome_unknown` from timeout, spawn late-settlement watcher on the still-running invocation promise (occurrence.js:174-176, 354-375). Crash guard: any engine exception ⇒ `outcome_unknown` writeback (occurrence.js:178-189).
5. Timeout enforcement: persisted deadline at admission; `timeoutMs = executionDeadlineAtMs - now` passed to the invoker (occurrence.js:208); `Promise.race` against a deadline timer that aborts the `AbortSignal` and resolves `{status:'outcome_unknown', TIMEOUT_ERROR_TEXT='cron: job execution timed out', __timedOut}` (occurrence.js:213-233; constants occurrence.js:21-22). Default timeout `AGENT_TURN_SAFETY_TIMEOUT_MS` = 3600s (occurrence.js:21; occurrence-model.js:254-256); per-job override `payload.timeoutSeconds` (job-model.js:141-147; occurrence.js:47-49, 93-95). The real bridge adds a 30s margin to the Router chain deadline (scheduler-router:146).
6. Session spawn path (real wiring): `createRouterInvoker(router)` → `router.runTurnWithRouteChain(agentId, {sessionId, message, deadlineMs, opts:{callerCorrelation:{occurrenceId,runId,requestId}, onDispatch}})` (scheduler-router:147-166); explicit `request.model` ⇒ STRICT_CHAIN_MODE single attempt (scheduler-router:151-154); `onDispatch` fires exactly once on first route attempt dispatch ⇒ scheduler `onStart` ⇒ admitted→running (scheduler-router:160-165; occurrence.js:124-141); `assertRunnable` rejects unknown (AGENT_NOT_FOUND via definition.getAgent) / disabled (AGENT_DISABLED) pre-start (scheduler-router:111-131). Delivery: `createFeishuDeliver(feishu)` → `feishu.reply(...)`; announce+ok carries presentation intent `{cardEligible:true, source:'scheduler'}` (scheduler-router:260-308). AbortSignal: bridge only OBSERVES abort (records `aborted`); Router/AgentProcess has NO cancellation seam (scheduler-router:34-40, 137-140).
7. Completion side effects for one-shots (`at`): succeeded + deleteAfterRun ⇒ job definition REMOVED, occurrences retained (occurrence.js:434-453 `applyJobCompletion`; delete path control.js:119-126 is definition-only). Delivery failure can never rewrite execution outcome (D-007 §11.4; occurrence.js:273-290).

### A.5 Outcome determination → D-007 vocabulary mapping (all claims file:line)

D-007 durable vocabulary `{admitted, running, succeeded, failed, outcome_unknown}` (docs/decisions/SCHEDULER_OCCURRENCE_OUTCOME_V2.md §6, L325-333). Code state set: occurrence-model.js:21. State machine §9.1: occurrence-model.js:35-41 (outcome_unknown ⇒ only succeeded|failed via settlement, NEVER admitted). Every path:

| outcome path | mapped durable state | evidence |
|---|---|---|
| durable reserve (before Router) | `admitted` | occurrence-model.js:257-269 (`state:'admitted'`, history starts `admitted`); store validate occurrence-model.js:215-216 |
| trusted start evidence (invoker `onStart` / bridge `onDispatch`) | `admitted → running` | occurrence.js:124-141 `markOccurrenceRunning` (only from `admitted`, sets `startedAt`); scheduler-router:160-165; synthesized running before terminal of a started run occurrence.js:309-318 |
| invoker returns `status:'ok'` | `succeeded` (`executionOutcome:'succeeded'`) | occurrence.js:238-245; writeback occurrence.js:319-328; terminal state must equal executionOutcome (validate occurrence-model.js:203) |
| proven pre-start rejection (`!started && outcome.started===false`) | `failed` + terminalEvidence kind `pre-start-rejection` | occurrence.js:254-270 (kind pick at 267); bridge `started:false` scheduler-router:192 |
| started run terminal failure WITH termination proof (`terminationEvidence ∈ {exact_terminal_then_idle, exact_queued_removal, child_real_exit, cancellation_ack}`) | `failed` + terminalEvidence kind `turn-terminal` | occurrence.js:23-31 (set), 254-270; bridge provenTerminal gate scheduler-router:181-186; validate: failed requires terminalEvidence occurrence-model.js:202 |
| deadline expiry WITHOUT termination proof | `outcome_unknown` (+ fence) | occurrence.js:220-230 (timer), 246-252 (classify); fence = unresolved unknown rebuild occurrence-model.js:317-333; tick skips fenced jobs scheduler.js:182 |
| invoker-reported `outcome_unknown` / generic failure without proof | `outcome_unknown` | occurrence.js:246-260; bridge unproven post-dispatch error ⇒ unknown scheduler-router:184-186 |
| engine crash guard | `outcome_unknown` | occurrence.js:178-189 |
| restart with record still admitted/running | `outcome_unknown` (`restart_unresolved`) | scheduler.js:211-232 |
| late trusted settlement of unknown | `outcome_unknown → succeeded|failed`, basis `trusted-late-evidence` | occurrence.js:354-424 (settlement authority fields occurrence.js:397-404); validate occurrence-model.js:228-240 |
| operator reconcile | `outcome_unknown → succeeded|failed`, basis `operator-reconcile`, identity = effective OS user only (never request body) | packages/scheduler/src/control.js:160-243 (identity capture 185-192) |
| delivery outcome (separate axis) | `deliveryStatus ∈ {delivered, not-delivered, not-requested, unknown}` — never rewrites execution outcome | occurrence.js:273-290; set at occurrence-model.js:24; written occurrence.js:319-328 |

Validation is fail-loud (`OCCURRENCE_STORE_CORRUPT`) on any authority-field corruption, identity mismatch, illegal transition, or history discontinuity (occurrence-model.js:161-242; invoked from store `_validateDocument` store.js:259-263).

### A.6 Ambiguous / undocumented semantics (flags)

1. **`at` UTC normalization**: date-only and offset-less ISO inputs silently become UTC (schedule.js:42-43). A job authored as `2026-08-20T09:00:00` (intending local 09:00) fires at 09:00Z. Undocumented in D-007 §3.4 ("at = 单一绝对 instant").
2. **cron tz default = system-local of the deploying process** (schedule.js:74-78): semantics differ across environments unless `tz` pinned. Runbooks pin `Asia/Shanghai` (quick-restore §3); D-007 §3.4 documents the default but the dependency is operationally fragile.
3. **No `run_once`**: one-shot = `at` + `deleteAfterRun` default true (job-model.js:154-155). Any caller expecting a `run_once` kind fails normalize (schedule.js:246).
4. **Invoker `ok` ⇒ succeeded without running evidence**: `classifyOccurrenceOutcome` returns succeeded for `status:'ok'` regardless of `__started` (occurrence.js:238-245). This trusts the invoker's terminal success receipt as the receipt itself (consistent with D-007 §6 succeeded "可信 terminal success"; admission-receipt-loss only arises when no receipt returns). Not a violation; a trust-boundary note.
5. **Recurring auto-retry has no chain-length cap**: `retryCandidate` enforces exhaustion only for `at` (eligibility.js:151-153); for recurring jobs `backoffForRetry` clamps to the last table entry (eligibility.js:72-76) and the chain can grow indefinitely while each retry fails. D-007 §7.5 gives the recurring table without a max count — behavior is table-faithful but the unbounded chain is undocumented.
6. **Occurrence ledger growth**: v2 store keeps ALL occurrence records forever inside the single `jobs.json` document (no pruning anywhere in packages/scheduler/src; full atomic rewrite per mutation, store.js:306-341). This is D-007 §10.2 option 1 and satisfies "delete ≠ delete evidence", but unbounded growth of a single-rewrite document is an operational risk (the draft spec itself rejects this shape for history, ALT-005/ALT-007).
7. **runs.jsonl append is best-effort**: append failure never blocks authoritative state (occurrence.js:426-432; store.js:399-414 returns {ok:false}) — per D-007 §11.5, but consumers must not treat runs.jsonl as complete.

---

## B. TRACEABILITY GAP CENSUS — current records vs staged draft chain

### B.1 What exists today (BASE)

1. **Occurrence authority records** — inside the versioned v2 store document `{version:2, jobs[], occurrences[], fences{}}` (store.js:12, 25-27; fail-loud validation store.js:251-304). Per-record fields (occurrence-model.js:150-153 required + optional written at occurrence.js:300-309 / occurrence-model.js:281-310): `occurrenceId, jobId, scheduleRevision, kind, runId, idempotencyKey, payloadHash, state, admittedAt, executionDeadlineAtMs, history[]`, plus slot coordinate (`nominalScheduledAt|retryOfOccurrenceId|catchUpOfNominalAt`), `startedAt, endedAt, nativeSessionId, deliveryStatus, executionOutcome, terminalEvidence{kind,detailRef}, lateSettlement{resolvedTo,resolvedAt,basis,evidenceRef}`. D-007 §10.2 layout option 1 (single document, separate jobs/occurrences). Survives job deletion (deleteJobOp control.js:119-126 removes only the definition).
2. **runs.jsonl evidence log** — append-only, fsync, bounded 10MB with newest-lines-preserving truncation (store.js:33-34, 399-448). Event actions at BASE: `occurrence_reserved` (occurrence.js:104-118), `turn_start` (occurrence.js:140), `router_admission` attempted+terminal (occurrence.js:148-169), `outcome` (occurrence.js:332-342), `delivery` (occurrence.js:343-349), `late_settlement` (occurrence.js:410-420; control.js:232-236), `store_upgrade` (store.js:177-182), `store_rollback_v2_to_v1` (store-migration.js:251), `lock_recovery`/`lock_unverifiable` (lock.js:172, 208, 248). All execution events carry `occurrenceId`/`runId`. **No agent reply text / summary is persisted anywhere** (classify `summary` feeds delivery only, occurrence.js:243, 282-284; never written to store or log).
3. **Derived job.state projection** — cache only, rebuildable from the ledger (eligibility.js:203-229; C-030).
4. **Query surfaces** — CLI `agentcore-cron runs` (occurrence dimension incl. outcome_unknown/fence; client-side filtering of store occurrences + last `limit*4` events, scripts/agentcore-cron.mjs:20-24, 257-283); `Scheduler.readRunEvidence` (scheduler.js:328-330); broker self-service tools `create/list/runs/update/enable/disable/remove` (packages/broker/src/capabilities/scheduler.js manifest; packages/scheduler/src/self-service.js) governed by accepted AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1 with LOCAL entitlements `scheduler.read:self` / `scheduler.manage:self` / `scheduler.manage:any` — explicitly NOT auth-service token scopes.
5. **No HTTP surface** — packages/scheduler and packages/scheduler-router contain zero HTTP (scheduler-router is a seam-adapter library, scheduler-router:1-41). product-api/notification-ingress own the only HTTP faces (per draft spec §2.1, consistent with BASE tree).

### B.2 Per-field gap census vs AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 (staged draft §3 R1-R10, R6 store, R7 API, R8 permissions, R9 correlation, R10 classification)

Legend: {infrastructure}=code/store surface missing; {spec}=pure derivation/naming contract; {authority}=external grant/scope supply; {test}=fixture/acceptance coverage. "E2E block?" = would the run-history chain E2E (draft Case 1-4 / ACC-001..010) pass without it.

| # | draft item | gap at BASE | label | E2E block? |
|---|---|---|---|---|
| G1 | R1 `job_snapshot` (definition projection frozen at admission) | absent — only payloadHash binds payload; after deletion, name/agent_id/schedule/delivery_mode unrecoverable from history | infrastructure | YES for ACC-001c/d (post-delete self-contained query) |
| G2 | R1 `scheduled_at` ISO + `origin` naming | present as epoch + `kind` (`natural/retry/catchup` ≡ origin); ISO conversion trivial | infrastructure (minor) | NO |
| G3 | R1 `fenced` boolean | derivable from `fences` projection; not a record field | infrastructure (minor) | NO |
| G4 | R1 `updated_at` | absent (history[] supersedes) | spec (cosmetic) | NO |
| G5 | R2 distinct RunRecord entity | run co-located in occurrence record (ONE_OCCURRENCE_MAX_RUNS=1); no separate run row for the monthly projection | infrastructure | NO (shape choice; identity already 1:1) |
| G6 | R2 `model` / `resolved_model` | payload.model lives on the job; not recorded per run; resolved_model has no source | infrastructure | NO (resolved_model DEFERRED by draft) |
| G7 | R2 `start_evidence` provenance (`invoker-dispatch` vs `trusted`) | startedAt exists; provenance label absent | infrastructure (minor) | NO |
| G8 | R2 `duration_ms` | derivable (endedAt-admittedAt); not materialized | infrastructure (minor) | NO |
| G9 | R3 `status_view` derived vocabulary (success/failed/timeout/cancelled/running/admitted; scheduled=never) | absent (query-time derivation only) | spec | NO |
| G10 | R2 `delivery_status` | EXISTS (record field + delivery event) — no gap | — | — |
| G11 | R2 `retry_count` / `retry_of_occurrence_id` | retryOfOccurrenceId EXISTS; retry_count derivable along chain (eligibility.js:60-70) | infrastructure (minor) | NO |
| G12 | R10 `error_code` classification (TIMEOUT/CANCELLED/FAILED/DELIVERY_FAILED/AGENT_NOT_FOUND/AGENT_DISABLED/AGENT_START_FAILED) | absent — only free-text `reason` / `terminalEvidence.detailRef` / raw error strings | infrastructure + spec | Partially (timeout/cancelled filters need it) |
| G13 | R9 `correlation_id` / `parent_run_id` / wake_links (J1/J2/J3) | ZERO implementation repo-wide (grep 0 hits in packages/scheduler*, confirmed draft §2.1 on this point) | infrastructure | YES for ACC-004 / correlation queries |
| G14 | R2 `request_id` | EXISTS as idempotencyKey (= occurrenceId), recorded in events, forwarded as callerCorrelation.requestId (scheduler-router:155-159); `request_id_source` provenance absent | infrastructure (minor) | NO |
| G15 | R4 structured business result (`scheduler-result` block, final_status PASS/PARTIAL/FAIL, counters, 16KB, trusted-wrapper ingestion) | ABSENT entirely — summary not even persisted; no ingestion point in production-runtime invoker wrapper | infrastructure | YES for Case-4-class E2E |
| G16 | R2 `result` / `result_status` / `result_recorded` / `result_error_code` | absent (depends on G15) | infrastructure | YES (same as G15) |
| G17 | R6 history store `scheduler/history/{events.jsonl + runs-<YYYYMM>.json}` (append-only, never truncated, monthly projections, replay heal) | ABSENT — today: occurrence ledger inside jobs.json v2 (single-doc unbounded rewrites) + 10MB-bounded runs.jsonl | infrastructure | YES (the chain's storage substrate) |
| G18 | R7 GET /scheduler/runs, /scheduler/runs/{run_id}, /scheduler/occurrences/{occurrence_id} (filters/cursor/404) | ABSENT — no HTTP surface in scheduler/scheduler-router | infrastructure | YES (the chain's query face) |
| G19 | R8 Bearer + auth-service scopes `scheduler.read` / `scheduler.audit` / `scheduler.admin`, fail-closed on /scheduler/* | ABSENT at HTTP level. PARTIAL at tool level: local entitlements scheduler.read:self / manage:self / manage:any implemented and governed by an accepted spec, but they are not auth scopes; no global audit scope; no HTTP gate. Scope SUPPLY (grants) = auth-service external round | infrastructure + authority | YES for ACC-005 (401/403 gates) |
| G20 | R9 J1 wake join / J2 workflow_instance_id join | absent; join targets themselves are proposed-only specs (agent_wake r1; HR dispatcher r3) | infrastructure + spec | NO for Case 1-3; YES for canary C-C |
| G21 | D-007 §12.2 CLI runs shows occurrenceId/runId/outcome_unknown/fence | ALREADY IMPLEMENTED at BASE (agentcore-cron.mjs:20-24, 257-283) — draft spec §0/§2.1 claim ("CLI runs 客户端过滤/仅 job-level") is STALE on the occurrence-dimension point; client-side filtering remains true | — (no gap; stale draft fact) | — |
| G22 | R5 deleteAfterRun = definition deleted, history survives | HOLDS at BASE (control.js:119-126; occurrences retained; quick-restore F4 smoke job auto-deleted with evidence intact). Queryability post-delete limited: self-service `runs` returns not-found after definition deletion (accepted spec CTR-RESULT-002), CLI runs still shows occurrences; `job_snapshot` absent (G1) so definition context lost | infrastructure (via G1) | covered by G1 |

**Counts by primary label**: infrastructure 14 (G1, G2, G3, G5, G6, G7, G8, G11, G12, G13, G14, G15, G16, G17, G18 — of which E2E-blocking majors: G17, G18, G13, G15/G16, G1); spec 3 (G4, G9, G12-co, G20-co); authority 1 (G19 supply side); test 1 bucket (fixtures ACC-001..010 all absent — nothing testable exists yet).

**Truly-blocking set for a final run-history-chain E2E**: {G17 history store, G18 query API, G19 HTTP permission gate, G15+G16 structured result ingestion, G13 correlation, G1 job_snapshot}. None of these blocks the EXISTING scheduler execution E2E, which is independently proven (quick-restore F1-F6 PASS incl. real smoke occurrence `occ:d8ed792724b99cc6 succeeded`, quick-restore runbook §8).

---

## C. ACTIVE PRODUCTION JOBS MIGRATION LIST (repo documents ONLY — zero live queries)

Sources cited per row. Staleness column flags docs whose facts are superseded relative to later-dated repo documents or whose files are not at BASE.

| # | Job / chain | Schedule | Caller / engine | Status per docs | Source | Stale? |
|---|---|---|---|---|---|---|
| C1 | `stock-daily-market-brief-001` (每日市场简报, agent `agt_stock_agent`, cron `44 2 * * 1-5` tz Asia/Shanghai, timeoutSeconds 1800, announce → feishu `chat:oc_0480991b97f1e27c96514ac66b4f122c`) | weekday 02:44 CST | Agent Core Scheduler V2 — BYPASS runtime `ai.agent-core.scheduler-v2` (yanfenma-owned, ingress 8795, --catchup 0) since 2026-08-26 20:20-40 | Created as the single canary job; `FEISHU_DELIVERY = BLOCKED` (cli_a9d7 WS held by authsvc production runtime; one-app-one-connection); first run window 2026-08-27 02:44; smoke one-shot `occ:d8ed792724b99cc6 succeeded` | docs/runbooks/deploy-scheduler-v2-quick-restore-v1.md §3, §4, §8 (STAGED/UNTRACKED WIP — not at BASE) | YES — post-08-26 production state not documented at BASE; staged combined-deploy evidence (2026-08-31) implies a later overlay lineage (github/main@2392a41, 134-file target) — actual current production runtime/store UNVERIFIABLE from BASE docs |
| C1b | Same job id in the PRODUCTION store `/Users/authsvc/.agent-core/scheduler/jobs.json` | same | production daemon `system/ai.agent-core.runtime` after 35-file overlay | PLANNED ONLY: create exactly one job (frozen fields identical); whole plan `DRAFT_PENDING_AUDIT` → revised; NEXT_TASK = 调度 正式部署复审; final store state = exactly 1 job | docs/runbooks/deploy-scheduler-v2-production-v1.md §2.3 P3, §5-1, §7 (STAGED WIP — not at BASE; revision commit 91fe202 exists on a non-main branch, NOT ancestor of BASE) | YES — plan-only; execution unproven from BASE docs |
| C2 | OpenClaw stock-agent production jobs (7 entries, 6 enabled; incl. the stock daily brief) | various | OpenClaw gateway (com.openclaw.gateway) | Stock brief side-disabled 2026-08-26 (bak `jobs.json.bak-scheduler-v2-quick-restore-20260826T202949`); **entire OpenClaw gateway RETIRED 2026-08-18 13:46** (jobs.json frozen 13:48, no process) → remaining definitions on disk but NOT executing | quick-restore runbook §0 Preflight, §8; caller-migration report §2/§5 (report at BASE) | cutover-closure report (AT BASE, 08-15) still lists LIVE_CALLER=OPENCLAW — superseded by the 08-18 retirement recorded in the (not-at-BASE) runbook |
| C3 | Workflow-dispatch chain: recurring dispatch + per-event one-shots for product-manager / arch-reviewer / article-publisher-agent / content-ops-agent / build-in-public-agent | launchd `com.openclaw.workflow-dispatcher` every 30min → unified-dispatcher.py + check-dispatch-health.py → `at` one-shots (+15m) | launchd scripts → OpenClaw cron → gateway agentTurn | Callers migrated to `agentcore-cron` 2026-08-15 (migration PASS) then **ROLLED BACK same day 12:52** after 5 orphaned agentcore at-jobs (due 12:58:53) had NO executor — the black-hole proof; chain restored to OpenClaw writers; afterwards killed by the 08-18 OpenClaw retirement → per available docs, workflow dispatch currently has NO live executor | docs/reports/openclaw-scheduler-caller-migration-v1.md §1-§3; docs/reports/scheduler-production-cutover-closure-v1.md §1.3-1.7, §3, §4 (both AT BASE); quick-restore §0 (retirement) | closure report's "restored and live" ending is stale post-08-18 |
| C4 | Forum-scheduler chain: hourly unread scan over 26 agents → notify jobs (observed: podcast-producer / writing-style-analyst) | launchd `com.openclaw.forum-scheduler` hourly → forum-scheduler.sh v5 → `openclaw cron add` | same as C3 | Migrated to v6 2026-08-15, rolled back to v5 12:52 same day; live again under OpenClaw until the 08-18 retirement → per available docs, forum notification scheduling has NO live executor | cutover-closure §1.1, §1.7, §3.1, §3.4, §4; caller-migration report §1, §2 | same staleness as C3 |
| C5 | Historical OpenClaw fleet: 280 jobs (140 enabled) | — | OpenClaw gateway | Import into Agent Core FORBIDDEN in both deploy rounds (`OPENCLAW_IMPORT = FORBIDDEN`); D-007 §15 rulings: definition-only import after review, NO_CATCH_UP (94 missed occurrences), stale one-shots DO_NOT_IMPORT, missing-agentId BLOCKED, `READY_TO_RESTORE_BEFORE_HARDENING = 0` → migration status = NOT MIGRATED, no import authority granted | D-007 §15 (L826-961); production runbook §6; quick-restore §6 | none (ruling-level, still current authority) |
| C6 | 5 orphaned workflow-dispatch at-jobs in `~/.agent-core/scheduler/jobs.json` (12:43 2026-08-15) | one-shot 12:58:53 CST | none (no resident engine) | cleaned to 0 at 12:52:27 with backup `jobs.json.bak-closure-v1-20260815-125227`; historical evidence only | cutover-closure §1.3, §3.2 | historical |

Migration/ownership summary from docs: the ONLY scheduler job with a documented live path after 2026-08-26 is C1 (bypass runtime, delivery blocked); C3/C4 chains and C2 remainder are documented dead post-08-18; C1b (production store) remains plan-only in the latest at-hand documents; the 2026-08-31 staged combined-deploy evidence suggests a later combined production overlay but contains no job-level facts I may rely on without live queries (and its files are staged WIP, not at BASE).

---

## D. AUTHORITY DETERMINATION

1. **Staged draft spec** `AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md`: frontmatter `status: proposed`, `implementation_authority: none`, `production_apply_authority: none` (draft §frontmatter L3-7; §0 banner L52-57; §8 zero-change list L933-946; gate chain G1-G5 L173-187). NOT in git at BASE (`git ls-files`/`git cat-file -e 840d2f4:<path>` negative; staged 'A' in the main checkout only). → **Candidate implementation = PAUSED_AUTHORITY this round.** Confirmed.
2. **Staleness found in the draft spec relative to BASE** (must be re-verified at its G1 audit round):
   - §2.1 "现行 scheduler 引擎 = pre-D-007（runningAtMs no-dup；无 occurrenceId/runId/scheduleRevision；control.js 不存在）" — FALSE at BASE: D-007 engine fully implemented (occurrence-model.js:21, 56-76; occurrence.js:34-121; control.js exists with reconcile).
   - §0/§2.1 "runs.jsonl 无 occurrenceId/runId" — FALSE at BASE (all execution events carry them, occurrence.js:104-169, 332-349).
   - `governed_by`/references cite D-006 — D-006 (AGENT_WORKSPACE_SESSION_MODEL_V2) is **superseded 2026-09-01** by AGENT_WORKSPACE_SESSION_MODEL_V3 (accepted, standalone Current Authority) at BASE.
   - §2.1 "scheduler HTTP 面 不存在 / broker scope 门禁先例" — still true at BASE, but the accepted AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1 tool surface (local entitlements) post-dates parts of its fact table and is not reflected.
3. **Search for accepted specs already covering scheduler traceability / query APIs** (candidate-implementation-eligible blockers):
   - `SCHEDULER_TIMEOUT_OUTCOME_V2` — accepted, implementation_authority: contracts; scope = occurrence authority store / timeout / session / migration / CLI projection (frontmatter scope L15-21). Contains NO history store, NO HTTP query API, NO structured business result, NO correlation chain (grep across the file: only occurrence-record `history[]` transitions, L674-678, 766, 783-784, 812, 841).
   - `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1` — accepted, implementation_authority: contracts; covers agent self-service tool actions create/list/runs/update/enable/disable/remove with local entitlements scheduler.read:self / scheduler.manage:self / scheduler.manage:any (§2, CTR-AUTH-001/002). Explicitly: local labels are NOT auth token scopes; `runs` after definition deletion returns not-found (CTR-RESULT-002) and post-delete evidence reads are "an independently authorized operator read/query" — precisely the gap the draft run-history spec targets. No GET /scheduler/* HTTP contract, no scheduler.audit, no structured result, no correlation.
   - Full-text search across docs/specs/*.md and docs/decisions/*.md at BASE for `scheduler/runs | run_history | run history | history store`: no accepted implementation spec covers them (only the staged proposed draft).
   - → **candidate-implementation-eligible blockers: NONE.** Every item in the Section-B blocking set (G17, G18, G19, G15/G16, G13, G1) has ZERO accepted implementation authority at BASE.
4. Adjacent accepted authority that a future implementation MUST respect (not enabling work): D-007 §10.1/§10.3 (jobs.json bytes / runs.jsonl evidence discipline), D-007 §10.2 (occurrence authority layout choice already realized as option 1), SCHEDULER_TIMEOUT_OUTCOME_V2 occurrence schema/state machine, SELF_SERVICE tools spec's authorization model and naming (`scheduler.read:self`...) which the draft's R8 `scheduler.read/audit/admin` naming must be reconciled with (same family, different label space — same class of reconciliation duty as the draft's HR_DISPATCHER `scheduler.manage` note, R8).

---

## Verdict

- BASE engine is D-007-conformant across identity, idempotency, five-state machine, timeout/fence/late-settlement, delivery separation, deleteAfterRun evidence survival (Section A mapping table; every path file:line-cited).
- The run-history chain (draft spec) has 6 truly E2E-blocking infrastructure gaps (G17/G18/G19/G15+G16/G13/G1); the largest single divergence from the draft's mental model is that the ledger already exists (in jobs.json v2) and runs.jsonl already carries occurrence/run identity — the draft's §2.1 fact base is stale and needs refresh before its audit.
- Production job reality per docs: one canary job live in a bypass runtime with delivery blocked; all OpenClaw-carried chains retired 2026-08-18 with no documented Agent Core replacement for workflow/forum dispatch.
- IMPLEMENTATION this round = PAUSED_AUTHORITY (no accepted spec authorizes any Section-B blocking item).
