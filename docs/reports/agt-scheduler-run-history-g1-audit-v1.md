# agt-scheduler-run-history-g1-audit-v1 — independent G1 audit of AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 (r2, proposed)

- AUDITOR: independent G1 audit subagent (goal SCHEDULER_TRACEABILITY_READY_FOR_INTEGRATION_V1); did NOT author the audited artifact; all load-bearing facts re-verified by fresh reading, not taken from prior reports
- AUDIT OBJECT: `docs/specs/AGENT_CORE_SCHEDULER_RUN_HISTORY_V1.md` r2 — status `proposed`, `spec_kind: implementation`, `implementation_authority: none`, `production_apply_authority: none`, SPEC_AUTHORING_ONLY. This audit gates lifecycle acceptance (G1: proposed → accepted).
- AUDITED HEAD: worktree `sched/run-history-integration-v1` @ `4c285c6` (packages/ and scripts/ byte-identical to BASE `840d2f4`; `git diff 840d2f4 4c285c6 --stat` = 5 ADDED docs/evidence files only)
- BASE: github/main `840d2f4ad91f8252eb1f163330c041216a0dd9c4`
- BOUNDARY: this audit added exactly one file (this report); zero modifications to any existing file; no commits; read-only cross-repo reads (auth-service, svc-forum)

## METHOD

1. Full read of the audit object (1215 lines) plus every authority it cites: D-007 `SCHEDULER_OCCURRENCE_OUTCOME_V2.md` (accepted, full read), D-008 `AGENT_WORKSPACE_SESSION_MODEL_V3.md` (accepted 2026-09-01; header + model read), `SCHEDULER_TIMEOUT_OUTCOME_V2.md` (accepted 2026-08-22, whole-authority replacement of V1 — frontmatter/authority map read), `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1.md` (accepted 2026-08-28, full read).
2. Independent re-verification of every load-bearing §2.1 code claim at this worktree by reading the cited source myself: `store.js` (full), `occurrence-model.js` (full), `occurrence.js` (full), `control.js` (full), `job-model.js` (full), `scheduler.js` (full), `seams.js` (full), `scheduler-router/src/index.js` (full), `product-api/src/index.js` (full), `production-runtime/src/compose.js` (full), `production-runtime/src/paths.js` (full), `broker/src/gateway.js` (grant path), `scheduler/src/self-service.js` (access layer), `scripts/agentcore-cron.mjs` (runs subcommand).
3. Negative claims re-proven by grep: `correlationId|parentRunId` and `correlation_id|parent_run_id` = 0 hits in packages/ + scripts/; `applyRunState|isRunnableJob` = 0 hits; zero `createServer|listen(` in packages/scheduler + packages/scheduler-router.
4. Promotion-context cross-checks (read-only): auth-service machine-token facts (`src/lib/oauth/workflow-signer.ts` claims list; `src/routes/well-known.ts` JWKS route) and the svc-forum fleet precedent (`svc-forum/src/lib/auth-jwt.ts` — jose `createRemoteJWKSet`/`createLocalJWKSet` + `jwtVerify`, RS256).
5. Feasibility review of §4 IMPLEMENTATION_CLOSURE against the real tree (every listed path exists or is marked NEW) and §5 ACC-001..010 for fixture-level executability (fake invoker / fake clock / local API tests, per `seams.js` createFakeInvoker and scheduler deps `nowMs`/`deadlineSetTimeout`).
6. The prior PREP_AUDIT (`0bd94f1:docs/reports/agt-prep-audit-pr139-scheduler-spec-r2.md`, PASS) was read last and used only as a cross-reference; every fact it reports that this audit relies on was independently re-derived above.

## VERDICT: **PASS**

- Blockers: **0**
- Majors: **0**
- Minors: **3** (M-1, M-2, M-3)
- Notes: **3** (N-1, N-2, N-3)

No contradiction with any accepted authority; no BASE factual claim failed to reproduce; every goal requirement covered; every ACC fixture-testable as written; no missing integration point forcing out-of-spec changes (JOB_SCHEMA_MODIFICATION = NOT_REQUIRED holds).

---

## PER-SECTION FINDINGS

### Frontmatter + §0/§1 (context, preflight) — PASS

- Perimeter correct: `status: proposed`, no authority granted, §8 zero-change list consistent with the audited branch (5 added docs files, zero product code).
- §0 "BASE 引擎已 D-007-conformant" claim set reproduces at BASE: identity derivation `occ:`+sha256(len-prefixed coords)[:16] (occurrence-model.js:56-58 encodeCoords, :70-76 deriveOccurrenceId), `run:` derivation (:78-80), `idempotencyKey = occurrenceId` (:263, validated :183), `nativeSessionId = 'cron-run-'+occ` (:87-89) rejecting 'main' (:191-194).
- Honest-delta list (§0 items 1–8) verified item-by-item: summary not persisted anywhere (classify `summary` at occurrence.js:243 feeds delivery text :282-284 and compose evidence only); occurrence ledger lives inside jobs.json v2 (store.js:26); runs.jsonl is 10MB-bounded evidence (store.js:33-34, :399-448) that DOES carry occurrenceId/runId on every execution event (occurrence.js:104-118, :140, :150-169, :334, :345, :412); zero HTTP in scheduler/scheduler-router; product-api routes exactly /health + /v1/{binding,agents,switch-agent,message} (product-api/src/index.js:233-258); notification-ingress /health + /v1/deliver (notification-ingress/src/index.js:161,172); no token scope gate exists anywhere for scheduler HTTP; correlation/parent_run 0 hits (grep re-proven); job_snapshot absent (ledger records carry no definition projection — occurrence-model.js:248-274); CLI runs already shows the occurrence dimension (agentcore-cron.mjs:20-24, 257-283).

### §2.1 dependency-fact table — PASS (with M-1 anchor nit)

All load-bearing rows re-verified fresh:

| §2.1 claim | Independent result |
|---|---|
| D-007 identity set / five durable states / ONE_OCCURRENCE_MAX_RUNS=1 / RETRY_IDENTITY=NEW_OCCURRENCE / timeout→outcome_unknown / §11.4 delivery separation / §7.3 deleteAfterRun evidence retention / §10.2 option 1 / §12.2 CLI duty | All reproduce in D-007: §5 (L275-284), §6 (L328-333), §4.2 (L251-253), §9+§21 (L539-544, L1113), §8 (L476-478), §11.4 (L670-679), §7.3/§9.1 (L426-428, L548-551), §10.2 (L590-591), §12.2 (L718-737) |
| reserve-before-Router | `reserveOccurrence` runs entirely inside `store.mutateDoc` (cross-process OwnerLock + re-read-latest + atomic commit, store.js:119-192): coords dedup occurrence.js:51-61, `OCCURRENCE_PAYLOAD_CONFLICT` :54-58, eligibility recheck :65-84, `assertRunnable` :97, record pushed `state:'admitted'` with persisted `executionDeadlineAtMs` :86-99 + occurrence-model.js:248-274 — REPRODUCED |
| Five states reachable | `OCCURRENCE_STATES` occurrence-model.js:21; state machine :35-41 (outcome_unknown → succeeded\|failed only); admitted→running from start evidence occurrence.js:124-141; succeeded/failed(terminalEvidence)/outcome_unknown classification :237-271; deadline-without-proof → outcome_unknown :213-233 + fences occurrence-model.js:317-333; restart sweep scheduler.js:211-232; late settlement occurrence.js:354-424; operator reconcile control.js:175-243 (identity = effective OS user :186-192) — REPRODUCED |
| deleteJobOp removes ONLY the definition | control.js:119-126 exact; engine one-shot delete branch `applyJobCompletion` splices `doc.jobs` only (occurrence.js:434-453) — REPRODUCED |
| Job schema v2 shape | scheduleRevision job-model.js:102-111 (bumped updateJobOp control.js:70-72); retry {auto} :135-140; deleteAfterRun default true for `at` :154-155; payload.timeoutSeconds/lightContext/model :141-151 — REPRODUCED |
| runs.jsonl discipline | append + fsync store.js:399-414; 10MB newest-lines truncation :416-448; best-effort occurrence.js:426-432 — REPRODUCED |
| production seam | `createRouterInvoker` assertRunnable rejects AGENT_NOT_FOUND/AGENT_DISABLED (scheduler-router:125-131); `runTurnWithRouteChain` with `callerCorrelation {occurrenceId, runId, requestId}` :154-159; `onDispatch` once :160-165; AbortSignal observed-only, no cancel seam (:33-40); delivery via createFeishuDeliver :260-308; compose wrapper compose.js:386-412 — REPRODUCED |
| CLI + self-service + scope precedents | cmdRuns occurrence dimension (agentcore-cron.mjs:257-283); `Scheduler.readRunEvidence` scheduler.js:328-330; self-service access layer (self-service.js; wired compose.js:431-451 with auth-service grant via credential store — manage:any decided by auth-service, fail-closed); broker requiredScopes fail-closed precedent gateway.js:153-155 (doc) + :226-249 (grant check before handler); manifests workflow.read (workflow.js:92), forum.read/write (forum.js:38/66/90/117/161), okr.read (okr.js:26), agent.definition.write (agent-definition.js:80) — ALL REPRODUCED |
| D-008 / D-006 | D-008 header "accepted 2026-09-01, standalone Current Authority, 整份取代 D-006/V2"; D-006 file carries `superseded_by: D-008`; acceptance commit b2e3eb1 git-verified; cron = "fresh non-main Session per execution" (V3 §0) — REPRODUCED |
| agent_wake / HR_DISPATCHER staged WIP | Neither file exists in docs/specs/ at this head — "不在 BASE" claims correct; wake requestId formula correctly marked "以其 accepted 轮为准" |

**M-1 (minor, citation precision — inherits prep-audit F-B1 class):** four anchor ranges are slightly off while the substance is correct: (a) "v2 文档 `{version:2, jobs[], occurrences[], fences{}}`（store.js:12-16）" — STORE_VERSION=2 is at :12 but the literal doc shape is `emptyDoc()` at store.js:26 (validate :251-304); (b) "runId='run:'+occurrenceId（occurrence-model.js:73-75）" — deriveRunId is at :78-80; (c) self-service wiring cited "compose.js:418-429" — actual creation/injection at :431-451 (:418-421 is the deliver seam); (d) "记录字段 … lateSettlement（occurrence.js:293-330）" — the terminal writeback covers startedAt/endedAt/nativeSessionId/deliveryStatus/executionOutcome/terminalEvidence; lateSettlement is written by applyTransition in the settlement path :391-408. No factual error in any case; recommend an r3 (or implementation-round) anchor touch-up.

### §2.2/§2.3 (gate chain, D-007 reconciliation) — PASS

- G1..G5 ordering sound; accept grants no implementation/deployment/grant/canary authority.
- §2.3 reconciliation is faithful: task-literal "many runs per occurrence" rejected per D-007 `ONE_OCCURRENCE_MAX_RUNS=1`/`RETRY_IDENTITY=NEW_OCCURRENCE`; task-literal `timeout` status demoted to error_code classification per `TIMEOUT_WITHOUT_PROVEN_TERMINATION = outcome_unknown` / `TIMEOUT_IS_ORDINARY_FAILED = NO`; `cancelled` mapped only via proven-termination (D-007 §8.2); `DELIVERY_FAILED` never rewrites execution outcome (D-007 §11.4). All consistent with the accepted decision text.

### §3 R1/R1a (Occurrence record + identity discipline) — PASS

- Field set is a superset of the BASE ledger fields with honest annotations of which fields exist vs. are new (job_snapshot/fenced/updated_at new; identity/state/timing from authority ledger).
- R1a priority 1 (IDENTITY_SOURCE = execution-authority, verbatim reuse of `occ:`/`run:` ids) is the correct posture; the `schocc:` fallback is deterministic, explicitly edge-case-only, and forbidden from writing back to the authority ledger — no D-007 §5.1 violation (D-007 allows deterministic derivation and forbids RAM-sequence/time-remint; the fallback honors both).

### §3 R2/R3 (Run record; status mapping) — PASS

- Ten-group RunRecord covers every task-required traceability field (see coverage table). `resolved_model = null` V1 is honest (BASE has no resolved-model evidence; payload.model passthrough unproven per D-007 §12.4).
- R3 mapping: status_view is a read-only projection recomputable from outcome + error_code; no new durable state; `scheduled` returns empty set + notice (not 400) — consistent with reserve-before-Router (durable record starts at admitted, D-007 §11.2); timeout filter hits both outcome_unknown and proven-failed — consistent with D-007 §8.

### §3 R4 (structured business result) — PASS

- The `scheduler-result` fenced-block contract with PASS/PARTIAL/FAIL + flat integer counters, 16KB bound, ingestion in the production-runtime trusted wrapper, Scheduler-opaque result: HR statistics stay out of scheduler core (goal requirement satisfied; R-H7, ALT-011, ACC-010 "scheduler core 无业务键解析").
- Feasibility verified: the compose invoker wrapper (compose.js:389-409) sees the complete outcome envelope and returns it — extracting the fenced block from `outcome.summary` and setting `outcome.result` is a purely additive wrapper change; `seams.js` INVOKE_CONTRACT output is a plain JS envelope (status/summary/error/sessionId/durationMs/started/reconciliationHandle/evidence) — an optional `result` field is additively extensible and unread by `classifyOccurrenceOutcome` (occurrence.js:237-271) until the modified code reads it; fake/noop invokers unaffected.

### §3 R5/R6 (deleteAfterRun; history store) — PASS

- R5 matches verified BASE behavior (delete removes definition only, occurrences retained) and correctly identifies the real gap as post-delete queryability (CTR-RESULT-002 — confirmed in the accepted SELF_SERVICE spec, "ordinary self-service runs MUST return not-found after definition deletion").
- R6 layout (`scheduler/history/{events.jsonl + runs-<YYYYMM>.json}`, append-fsync-never-truncate + monthly atomic projection + replay heal, own lock in the same lockfile family, no DB/Redis/Kafka, unlimited retention) violates nothing in D-007 §10: history is explicitly NOT the occurrence authority (R6 closing paragraph + R-H2), jobs.json v2 and runs.jsonl remain byte-disciplined. paths.js `resolveProductionLayout` (paths.js:71-97) is the natural place for `historyDir` — listed in §4.
- D-007 §10.4 ("Job definition与 occurrence state都只能通过 Scheduler mutation authority写入") is not breached: history is neither a job definition nor occurrence authority state, and its writer is the same engine process family with its own lock.

### §3 R7/R8 (query API; permissions) — PASS

- Mounting on the existing product-api server is additive: routes are a plain if/else chain over `createServer` (product-api/src/index.js:230-276); existing routes byte-unchanged is achievable; GET-only freeze is auditable (ACC-009).
- R8 scope family (scheduler.read / scheduler.audit / scheduler.admin) with Bearer + fail-closed 401/403, caller binding authority in auth-service, structural (not list-filtered) denial for global views, and the explicit negative rule that local entitlement labels are invalid on the HTTP face — all consistent with the accepted SELF_SERVICE spec (its L107-113: labels "are not token scopes and are never requested from auth-service"; production manage:any = NONE until auth-service CCR) and with the gateway.js requiredScopes fail-closed precedent. The reconciliation duties (SELF_SERVICE labels; HR_DISPATCHER scheduler.manage → scheduler.admin) are recorded without modifying those files — correct posture for both accepted and staged-WIP authorities.

### §3 R9/R10/R11 (correlation; failure classes; red lines) — PASS

- correlation_id/parent_run_id are declared as真缺 BASE fields (grep re-proven 0 hits); request_id correctly anchored to the existing idempotencyKey=occurrenceId with callerCorrelation passthrough (occurrence-model.js:263; scheduler-router:154-159); J1/J2 joins are identifier-based with no cross-system propagation (J2 deferred to AMEND — matches "svc-workflow receipt carries only messageId" and ship-first boundaries); ALT-014 correctly refuses a second execution ledger for wake runs.
- R10 classification table is consistent with D-007 (timeout/cancelled as classifications, not states; AGENT_START_FAILED honestly marked as a reserved value with no BASE emitter — BASE emits only AGENT_NOT_FOUND/AGENT_DISABLED at scheduler-router:125-131).
- R-H1..R-H9 red lines are the right invariants and each is statically or fixture-checkable (ACC-006/007/008/009/010).

### §4 IMPLEMENTATION_CLOSURE — FEASIBLE (no missing integration point)

- Every listed path exists in the tree or is correctly marked NEW: packages/scheduler/src/{occurrence.js, scheduler.js, index.js, seams.js} present; history.js NEW (absent ✓); production-runtime paths.js + compose.js present; product-api/src/index.js present; scripts/agentcore-cron.mjs present; tests scheduler.test.js / compose.test.js / product-api/test present; history.test.js NEW (absent ✓). Scheduler constructor already takes a deps bag (scheduler.js:38-67) — optional `deps.history` injection is additive; lifecycle hook points cited (reserve commit :100-121, markRunning :124-141, writeback :293-351, deliver :274-290, settlement :354-424, reconcile control.js:175-243, applyJobCompletion :434-453) all exist exactly as named.
- **JOB_SCHEMA_MODIFICATION = NOT_REQUIRED holds:** identity comes from the authority ledger; the structured result travels in the outcome envelope (not the Job); job_snapshot can be captured at admission from the in-lock job definition (reserveOccurrence returns the committed job, occurrence.js:119-120); CLI history reads derive from the new store + existing layout root. No D-007 amendment is forced anywhere: the zero-change list (job-model.js, jobs.json v2, runs.jsonl, scheduler-router, broker, auth-service, svc-workflow, feishu-connector, notification-ingress) is exactly the set this audit confirmed needs no change for the stated design.
- **N-2 (note):** §4 does not spell out how product-api receives the HistoryStore query handle. The established pattern (`ctx.provide('selfServiceSchedulerAccess', …)` at compose.js:433) makes this a one-line composition detail inside already-listed files; no out-of-spec change is forced. Implementation round should state it.

### §5 ACCEPTANCE_CRITERIA — all fixture-testable (see table below); §6 ALT-001..015 — PASS

- ALT rulings are each anchored to a verified authority fact (ALT-001/002 to D-007 constants; ALT-005/006/007 to the store realities verified above; ALT-012 to the J2 deferral). No rejected alternative reopens a D-005/D-007-rejected item (distributed queues, runs.jsonl-as-authority, runningAtMs no-dup all remain rejected).

### §7/§8/§9 — PASS

- §7 consistency table rows all reproduce (no superseded authority cited as current; D-006 only as superseded-by-D-008; TIMEOUT_OUTCOME_V2 correctly identified as the whole-authority replacement of V1 — V2 frontmatter `supersedes: [SCHEDULER_TIMEOUT_OUTCOME_V1]`, accepted 2026-08-22).
- §8 zero-change declaration matches the audited branch reality. §9 Final Output is an accurate summary; `READY_FOR_REVIEW = YES` / `NEXT_TASK = 调度历史 审计` consistent with this round.

---

## GOAL_REQUIREMENTS coverage table

| # | Goal requirement | Spec section(s) | Satisfied |
|---|---|---|---|
| 1 | Minimal traceability fields: jobId, occurrenceId, runId, sessionId, agentId, scheduled/admitted/started/ended timestamps, status/outcome, error, final/structured result, correlation/parent linkage | R1 (job_id, occurrence_id, scheduled_at, state, admitted_at) + R2 (run_id/occurrence_id/job_id/session_id/agent_id; scheduled_at/admitted_at/started_at/ended_at/duration_ms; outcome + status_view; error_code/error_message; result/result_status; correlation_id/parent_run_id/request_id) | YES — every named field present; retry linkage via retry_of_occurrence_id/parent_run_id/correlation_id (R9/R10) |
| 2 | deleteAfterRun deletes the definition but never deletes run-history evidence | R5 + R-H2 + ACC-007 + C-A2 (BASE delete-side already holds: control.js:119-126, occurrence.js:434-453 — verified) | YES |
| 3 | HR business statistics NOT hardcoded in scheduler core (belongs to HR structured result) | R4 (open counter map; Scheduler opaque; final_status semantics only) + R-H7 + ALT-011 + ACC-010 | YES |
| 4 | Legal trigger semantics = repo accepted contract (cron \| at \| every; one-shot = at + deleteAfterRun) | §2.1 Job schema row (job-model.js facts) + R1 job_snapshot.schedule {kind, expr?\|at?\|everyMs?} + ACC-001 (at one-shot + deleteAfterRun); no new trigger kind anywhere; engine conformant (schedule normalize rejects other kinds per investigation A.1, consistent with D-007 §3.4) | YES |
| 5 | Scheduler does scheduling + run evidence only; no arbitrary cross-agent scheduling; HR later contacts other agents via agent_session_send (out of scope) | §0 one-line model; R-H1 (history never gates); R-H6 (GET-only); R9 joins identifier-based, J2 propagation deferred (ALT-012); ALT-014 (no second execution ledger for wake runs); §2.2 G4/G5 external rounds; scheduler.admin frozen endpoint-less (R8) | YES — out-of-scope explicitly preserved (§1 Out-of-scope, §4 zero-change list) |
| 6 | Ship-first: no unrelated refactors (forum/fleet/generic observability/workflow dispatch policy) | §8 (zero product change this round) + §4 zero-change list (broker/forum/workflow/auth-service/svc-workflow/feishu-connector/notification-ingress untouched; no observability framework; no workflow dispatch policy) | YES |

---

## ACC feasibility table (fixture level: fake invoker / fake clock / local API tests)

| ACC | Executable as written | Fixture mechanics (verified seams) |
|---|---|---|
| ACC-001 (one-shot + deleteAfterRun, full chain) | YES | `createFakeInvoker` with scripted ok + scheduler-result in summary (seams.js:57-73); fake clock via deps.nowMs; jobs.json shape + history + local product-api route assertions; delete side already real (occurrence.js:434-453) |
| ACC-002 (recurring ×3 + replay upsert-merge) | YES | cron candidate computation is deterministic under fake nowMs (tick-driven, scheduler.js:157-208); R1a determinism makes replay-merge assertable |
| ACC-003 (failure/retry/timeout/delivery) | YES | proven failure via `{status:'error', started:false}` → pre-start-rejection (occurrence.js:254-270); retry via job.retry.auto=true; timeout race via injected `deadlineSetTimeout` (scheduler.js:55-56) + hanging fake invoker (timeout path :213-233 verified); delivery throw → not-delivered without outcome rewrite (:274-290) |
| ACC-004 (Dispatcher trace, fixture) | YES | fake invoker summary carries fenced block with wake_sent entries; wake_links + correlation_id assertions; agent_wake audit rows are stub data (join by identifier, no external system) |
| ACC-005 (permissions) | YES with injected verifier stub | 无 token→401 and seam-unconfigured→401 are directly testable; scope cases need an injectable token-verification stub — same pattern the accepted SELF_SERVICE spec mandates for its Auth seam ("tests with an injected Auth stub", CTR-AUTH-002) — a normal fixture requirement, not a gap; negative local-label assertion testable |
| ACC-006 (crash injection / replay heal / never-truncate) | YES | history store is a new unit-testable class: write events without committing projection → reload heals via last_event_seq; corrupt-line skip; static grep for `_truncateRunLog`-class calls |
| ACC-007 (deleteAfterRun isolation) | YES (see M-3) | byte-snapshot of history dir + jobs.json shape/diff assertions; both the control delete path (control.js:119-126) and engine auto-delete are locally exercisable |
| ACC-008 (structured-result discipline) | YES | oversize/invalid/missing-final_status summaries via scripted fake invoker; outcome/delivery invariance asserted from the ledger; static secret scan |
| ACC-009 (read-only red line) | YES | route-table introspection + negative-method probes against the locally mounted server (product-api test harness already exists: packages/product-api/test/api.test.js) |
| ACC-010 (static red lines) | YES | git zero-diff on job-model.js / jobs.json write path / runs.jsonl truncation; dependency manifest scan; business-key grep in scheduler core |

No criterion is untestable as written → no (d)-class blocker.

**M-3 (minor):** ACC-007's "one-shot 删除前后，history 目录字节不变" is ambiguous for the auto-delete path because the definition splice happens inside the same `writeOccurrenceOutcome` mutation whose run_terminal history event is emitted after that commit (§4 hook order). A fixture convention is needed: measure after history events quiesce (then assert no delete-induced change) and/or assert isolation via a control-only `deleteJobOp`. Both are executable; the criterion needs its timing stated in the implementation round.

**M-2 (minor, form):** frontmatter `date: 2026-08-31` was not bumped for the r2 revision (2026-09-02 appears only in the `revision:` text). Content-wise the revision record is complete.

---

## N-1 — judgment on the R8 auth-service deferral (promotion-context cross-check, coordinator fact re-verified)

The coordinator's facts reproduce read-only in the sibling repos: auth-service issues RS256 v1 machine tokens whose claim set is exactly `iss / sub / aud / principal_type / client_id / token_use / type / version / scope / agent_id` (`/Users/yanfenma/workspace/project/auth-service/src/lib/oauth/workflow-signer.ts:9-10,48`; `token-exchange.ts:247-252`), with JWKS published at `/.well-known/jwks.json` (`src/routes/well-known.ts`). The fleet precedent for inbound verification in TypeScript is real: svc-forum `src/lib/auth-jwt.ts` verifies RS256 tokens via jose `createRemoteJWKSet` (production) / `createLocalJWKSet` (tests) + `jwtVerify`.

Judgment: the deferral of the exact introspection/JWKS contract to the implementation round is **acceptable, not a promotion blocker**. What acceptance needs frozen is frozen now: fail-closed 401 on any verification failure or unconfigured seam (R-H9), the scope family and data-plane semantics (R8), auth-service as the sole grant/binding authority, structural denial for global views, and the negative rule against local entitlement labels on the HTTP face. The remaining unknown is a mechanism detail with a proven in-fleet pattern (svc-forum) and a repo-internal fail-closed precedent (gateway.js:226-249), and G4 makes scope supply an external round regardless — deploying before grant is harmless (all 401/403). ACC-005 is executable now with an injected stub, so no acceptance evidence is deferred.

## N-3 (note)

`resolved_model` V1 = null is honest and correctly DEFERRED (no resolved-model evidence exists at BASE; D-007 §12.4 keeps payload.model passthrough unproven). `status_view` is losslessly recomputable from outcome + error_code; no new durable state is introduced anywhere — the spec's "不新增任何 durable state" claim is consistent with R1/R2/R3.

## Boundary compliance (this audit)

Single file added: `docs/reports/agt-scheduler-run-history-g1-audit-v1.md`. Zero modifications to the spec, decisions, code, tests, or any other file; no commits; no network; no production access. Cross-repo reads (auth-service, svc-forum) were read-only.

## REQUIRED_FIXES

**NONE** (PASS). Recommended (non-blocking, may be folded into the implementation round or a future doc touch-up):
1. M-1 — correct the four citation anchors (store.js:26; occurrence-model.js:78-80; compose.js:431-451; lateSettlement write site occurrence.js:391-408).
2. M-2 — bump frontmatter `date` on the next revision.
3. M-3 — state the ACC-007 fixture timing convention (measure after history-event quiesce, and/or assert isolation via control-only deleteJobOp).
4. N-2 — name the product-api ↔ HistoryStore wiring seam (ctx.provide pattern) in the implementation round.
