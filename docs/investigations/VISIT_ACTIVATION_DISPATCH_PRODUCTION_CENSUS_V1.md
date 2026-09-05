# VISIT_ACTIVATION_DISPATCH_PRODUCTION_CENSUS_V1 — Fresh read-only census

```text
GOAL = VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1 (P0, OWNER_DISPATCH_UNIT = GOAL)
PHASE = 1 (fresh census, READ-ONLY, zero production mutation)
DATE = 2026-09-05
METHOD = fresh probes only (git fetch + rev-parse, live HTTP probes, live process
         inspection, read-only SQL against the production svc-workflow DB);
         no memory-recalled state accepted without fresh verification
```

## 1. Source state (fresh-fetched mains)

| Item | Value | Evidence |
|---|---|---|
| CURRENT_SVC_WORKFLOW_MAIN | `22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7` | github/main, 2026-09-03 "Merge pull request #24 from mayf3/impl/visit-activation-v1" |
| CURRENT_DSH_MAIN | `ec074d568f7b99ec76118e6d45abab410b55198d` | origin/main, 2026-09-05 "Merge pull request #169 … adopt-development-governance-v1.0.3" |
| VISIT_ACTIVATION_SOURCE_MERGED | **YES** | svc main tree: `docs/specs/SVC_WORKFLOW_VISIT_ACTIVATION_IMPL_V1.md` (status: accepted, 2026-09-02), `migrations/0023_visit_activation_v1.sql`, `src/http/handlers/dispatch_intents.rs`, `src/http/handlers/wake.rs`, `src/store/postgres/workflow_instance_repository/query_dispatch_intents.rs`, routes registered in `src/http/mod.rs:123-127` |
| DISPATCH_INTENT_BROKER_SOURCE_MERGED | **YES** | dsh origin/main tree: `docs/specs/AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1.md` (status: accepted, 2026-09-02; external authority pinned at svc `22e862a`), `packages/broker/src/capabilities/workflow.js` contains `workflow_dispatch_intents` (workflow.read → GET /internal/v1/dispatch-intents) and `workflow_wake_dispatch_intent` (workflow.execute → POST …/wake), tests `workflow-dispatch-intent.test.js` present |

Authority chain is clean: dsh DIB spec `external_authorities` pins exactly svc main
`22e862a` (relation `interoperates_with`) — the two merged heads are the pinned pair.
Both specs declare `production_apply_authority: none` (production apply is separately
gated — this Goal is the vehicle for that gate).

## 2. Live production state (fresh probes, 2026-09-05)

| Item | Value | Evidence |
|---|---|---|
| Runtime | pid 72082, started 2026-09-05 10:56:00, `system/ai.agent-core.runtime`, health `{"ok":true}` @ 127.0.0.1:8790 | equals the WDA deploy-r2 restart (63411→72082); WDA production mutation is DONE, remaining WDA item is the Owner-run canary script (API-level, not runtime mutation) |
| LIVE_VISIT_ACTIVATION | **ABSENT** | three independent layers, all pre-merge: (a) live svc-workflow binary `/Users/yanfenma/.local/services/svc-workflow/svc-workflow` built 2026-08-30 21:30, process started 2026-09-02 18:19 (pid 58020, user domain, listens 127.0.0.1:8989); (b) live HTTP probes return `route_not_found` for GET `/internal/v1/dispatch-intents?limit=1` and POST `…/wake` while `/healthz` = ok (router itself lacks the routes); (c) production DB: `to_regclass('workflow_activations')` and `to_regclass('workflow_dispatch_eligibility_events')` both NULL — `_sqlx_migrations` max version = 22, `0023_visit_activation_v1` NOT applied |
| workflow_dispatch_intents tool | **ABSENT** | live broker `/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js` (24845 bytes, mtime 2026-09-05 10:55, git blob `7f55c605`) has 0 hits for both tool names; its sha256 prefix `5328617808f3ec7b` matches `workflow-definition-authoring-v1-deploy-r2/DEPLOYMENT_MANIFEST_R2.json` — live face is exactly the WDA artifact, which predates DIB |
| workflow_wake_dispatch_intent tool | **ABSENT** | same file, 0 hits |
| Legacy dispatcher | not running | `pgrep -fl workflow-dispatcher` empty; `/Library/LaunchDaemons/com.openclaw.workflow-dispatcher.plist` present but service not loaded/running (residue only) |

## 3. Auth / grant state

| Item | Value | Evidence |
|---|---|---|
| AUTH / GRANT READY | **NO** | production DB `global_role_bindings` exists (migration 20) but `GLOBAL_SCHEDULER_READ` rows = **0**; enabled roles today: `GLOBAL_WORKFLOW_COORDINATOR`×5, `GLOBAL_WORKFLOW_READER`×1. Server gate `check_global_scheduler_read` is fail-closed with **no automatic role mapping** (GLOBAL_WORKFLOW_READER / COORDINATOR do NOT satisfy it), so every due poll / wake by any existing principal would 403 `scheduler_read_role_required` even after deployment |
| Due-poll caller scopes | broker face needs `workflow.read` (poll) / `workflow.execute` (wake) — both scope families already granted to existing workflow callers; the binding gap is the server-side `GLOBAL_SCHEDULER_READ`, whose provisioning owner/principal is an open decision for the Authority phase |

## 4. Contract shape of the frozen due read (for the exactly-once coordinate)

`query_dispatch_intents.rs` (svc `22e862a`): singular due predicate = active
DISPATCH_INTENT activation AND effective nextEligibleAt ≤ now(); ordered by
`(nextEligibleAt, activation_id)`; projection is EXACTLY the v0.4.0 §5.7 minimum 7
fields: `dispatchIntentId, nodeVisitId, workflowInstanceId, ownerPrincipalId,
nextEligibleAt, createdAt, updatedAt`. Closures (`workflow_activation_closures`) drop
an activation from the due set; eligibility events rewrite nextEligibleAt.

- ASSIGNEE_PRINCIPAL_AVAILABLE = **YES** (at source): `ownerPrincipalId` is the
  resolved visit owner Principal (validated HUMAN-or-AGENT against the principals
  table at visit entry) — an exact Principal ID, no title/metadata guessing.
- DUE_QUERY_READY = **YES** at source / **NO** at production (route absent).
- CURSOR_PAGINATION = **MISSING**: the frozen contract is a limit-only poll
  (limit 1..100, default 50); there is no cursor token. Exactly-once therefore rests
  on the stable identity `dispatchIntentId` (activation UUID PK) + closure semantics.
  The Goal text requires a "cursor" in the due-query info set — this is a
  **contract-level reconciliation item** for the Authority phase (client-side
  `(nextEligibleAt, dispatchIntentId)` checkpoint vs spec AMEND), to be settled
  before artifact freeze.

DISPATCH_IDEMPOTENCY_COORDINATE (candidate, to be proven in later phases):
`dispatchIntentId` (= `workflow_activations.activation_id`, DB-enforced unique,
immutable) with composite context `(workflowInstanceId, nodeVisitId)`; re-poll
returns the same identity while active; visit closure removes it from the due set
and it never returns as the same eligible work.

## 5. Census verdict fields

```text
VISIT_ACTIVATION_SOURCE = MERGED (svc github/main 22e862af, spec accepted 2026-09-02)
DISPATCH_BROKER_SOURCE = MERGED (dsh origin/main ec074d5, spec accepted 2026-09-02)
LIVE_PRODUCTION_STATE = ABSENT (service binary/routes/migration all pre-merge;
                          broker manifest = WDA artifact without DIB tools;
                          runtime pid 72082 healthy, WDA mutation complete)
AUTH_STATE = NOT READY (GLOBAL_SCHEDULER_READ = 0 bindings, fail-closed 403 for all
             current principals; provisioning owner unset)
FIRST_GAP = production deployment gap (svc binary + migration 0023 + broker manifest
            all behind merged source); second-order contract gap: no cursor token in
            frozen due-read contract (reconcile vs Goal requirement before artifact)
CAN_PROGRESS_WITHOUT_RUNTIME_MUTATION = YES (authority reconciliation, drift analysis,
            artifact, simulation, review, Owner packet all runnable read-only)
OWNER_ACTION_REQUIRED = NONE (this round)
PRODUCTION_RUNTIME_LOCK = IDLE (WDA deploy r2 complete 2026-09-05 10:56; remaining
            WDA canary is Owner-run, API-level)
FIRST_UNFINISHED_PHASE = Phase 2 Authority reconciliation, then Phase 3 artifact
```

## 6. Method / safety notes

- All probes read-only: `git fetch`, HTTP GET/POST-to-null-UUID route probes (no
  auth presented, no state touched), `ps`/`lsof`/`plutil`/`launchctl print`, and
  `psql` SELECT/`to_regclass` only against the production svc-workflow DB.
- One redaction miss: the DB URL echo in the transcript exposed the local
  svc-workflow DB credential before the host (127.0.0.1, user-domain service).
  Credential unchanged, nothing stored in this repo; flag for hygiene follow-up.
- No code, grant, credential, plist, or service state was changed.
- Old `dispatchableOnly` / `agent_wake` / dedicated-Dispatcher routes: NOT restored,
  not present in either main; legacy `com.openclaw.workflow-dispatcher` daemon is
  inert (recorded as residue).
