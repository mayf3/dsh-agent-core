# agt-prep-scheduler-semantics-investigation-v1 — Round Report

```text
TASK            = LANE_2 PRODUCTION_RND_SUPPORT_PREPARATION — scheduler semantics
                  investigation (PREPARATION TRACK; production deployment OUT OF SCOPE)
GOAL            = PRODUCTION_RND_PARALLEL_PREPARATION_V1
BASE_COMMIT     = 840d2f4ad91f8252eb1f163330c041216a0dd9c4 (github/main tip)
WORKTREE BRANCH = prep/scheduler-semantics-investigation-v1
METHOD          = static read-only investigation at BASE: packages/scheduler/src/* (15 files),
                  packages/scheduler-router/src/index.js, scripts/agentcore-cron.mjs,
                  packages/broker/src/capabilities/scheduler.js (read-only);
                  docs at BASE (D-007, SCHEDULER_TIMEOUT_OUTCOME_V2/V1, D-005, D-006/V3,
                  cutover-closure + caller-migration reports, self-service tools spec);
                  staged WIP drafts read READ-ONLY in the main checkout (run-history spec,
                  two deploy runbooks, combined-deploy evidence) and explicitly flagged
                  not-at-BASE. Zero live service/port/store queries. No npm install,
                  no test execution, no network. packages/broker/src/capabilities/
                  workflow.js untouched (exclusive to another goal).
```

## Findings summary

1. **Trigger types at BASE = exactly `cron | at | every`** (normalizeSchedule schedule.js:215-247). No `run_once`; one-shot = `at` + `deleteAfterRun` default true. cron: 5-field croner, tz explicit or system-local, OpenClaw-compatible stagger (top-of-hour 300s default, sha256(jobId) offset). `at`: absolute ISO/epoch; offset-less inputs normalize to UTC (flag); relative durations only at submission seams. `every`: anchor-grid ≥1ms. Stale `at` slots >15min never run; retry requires explicit `retry.auto=true`.
2. **D-007 conformance verdict: CONFORMANT.** Deterministic occurrence identity `occ:…` / `run:occ:…` / `idempotencyKey=occurrenceId` / payloadHash (delivery excluded) / fresh non-main session `cron-run-<occId>`; reserve-before-Router admission idempotency inside the cross-process lock (coords dedupe, payload conflicts fail-loud OCCURRENCE_PAYLOAD_CONFLICT, structured collisions); §9.1 state machine enforced fail-loud; all five durable states reachable exactly as D-007 defines (mapping table with file:line in investigation §A.5); timeout without termination proof ⇒ outcome_unknown + fence + trusted late settlement / operator reconcile (OS-user identity only); delivery strictly separated from execution outcome. Flags: 7 ambiguous/undocumented semantics recorded (§A.6), incl. recurring auto-retry having no chain cap and unbounded occurrence-ledger growth inside the single v2 document.
3. **Traceability gap census: 22 items audited (G1-G22); today's records = v2 occurrence ledger inside jobs.json + 10MB runs.jsonl (both already carry occurrenceId/runId) + CLI/self-service reads; NO history store, NO HTTP query API, NO structured business result, NO correlation fields, NO HTTP permission gate.** Truly E2E-blocking set for the draft chain = {G17 history store, G18 query API, G19 HTTP permission gate, G15+G16 structured result ingestion, G13 correlation, G1 job_snapshot}; labels: infrastructure 15, spec 4 (overlapping), authority 1 (auth-service scope supply), test 1 bucket (ACC fixtures absent). Two draft-spec "current state" facts are stale at BASE: the engine is NOT pre-D-007, and runs.jsonl DOES carry occurrence/run identity; CLI runs already shows occurrenceId/runId/outcome_unknown/fence (D-007 §12.2 partially fulfilled).
4. **Production jobs migration list: 6 rows, documents only.** C1 canary `stock-daily-market-brief-001` (cron 44 2 * * 1-5 Asia/Shanghai, agt_stock_agent, announce→stock chat) live in BYPASS runtime since 2026-08-26 with FEISHU_DELIVERY=BLOCKED; C1b production-store creation = plan-only (runbook DRAFT_PENDING_AUDIT/revised, not at BASE); C2 OpenClaw stock jobs + gateway RETIRED 2026-08-18 13:46; C3 workflow-dispatch chain and C4 forum-scheduler chain migrated 08-15 → rolled back 08-15 (5 orphan jobs black-hole proof) → dead after 08-18 retirement, NO documented Agent Core replacement; C5 280-job historical fleet NOT MIGRATED (import FORBIDDEN; D-007 §15 restore gate = 0); C6 orphaned jobs cleaned 08-15. Staleness flags on every row; post-08-31 staged combined-deploy evidence implies a later overlay lineage but no job-level facts usable without live queries (none performed).
5. **Authority determination: PAUSED_AUTHORITY.** AGENT_CORE_SCHEDULER_RUN_HISTORY_V1 = proposed / implementation_authority none / not in git at BASE. No accepted spec at BASE covers history store, /scheduler/* query API, scheduler.read/audit/admin scopes, structured results, or correlation (SCHEDULER_TIMEOUT_OUTCOME_V2 and AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V1 are the nearest accepted authorities; the latter explicitly excludes post-delete history query). Candidate-implementation-eligible blockers: NONE. Draft spec needs a §2.1 fact refresh + D-006→V3 reference update before its audit round.

## Deliverables (committed on prep/scheduler-semantics-investigation-v1)

1. docs/investigations/SCHEDULER_SEMANTICS_PREP_INVESTIGATION_V1.md — sections A-D, all claims evidence-cited.
2. docs/reports/agt-prep-scheduler-semantics-investigation-v1.md — this report.
3. evidence/scheduler-code-excerpts.md — verbatim code excerpts with file:line backing key findings.

## Boundaries honored

Files written only inside the assigned worktree; no push/remote ops; no stash/reset/clean/checkout; staged only the three created files; no touch of /usr/local/libexec/agent-core, launchctl/sudo/osascript, production services/ports/stores, or the workflow-transition goal state root; main checkout strictly read-only; zero live queries (production facts from repo documents only, staleness-flagged); no workflow.js modification proposals.

## TASK_STATUS

```text
INVESTIGATION_PHASE = COMPLETE
IMPLEMENTATION      = PAUSED_AUTHORITY（run-history chain 无 accepted implementation
                      authority；本轮零代码实现，符合 PREPARATION TRACK）
BLOCKERS            = none for this investigation round.
                      Downstream notes: (1) draft spec §2.1 stale facts must be refreshed
                      before its G1 audit; (2) C1b/C3/C4 production-doc staleness means any
                      future production-facing round needs fresh authorized evidence.
```
