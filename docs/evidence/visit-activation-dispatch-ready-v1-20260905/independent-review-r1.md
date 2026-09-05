# Independent Review — VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1

Commits verified: svc-workflow `22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7` (remote `github` = https://github.com/mayf3/svc-workflow.git, merge PR #24) and dsh `ec074d568f7b99ec76118e6d45abab410b55198d`. All line numbers below are as of those commits.

## 1. Dispatch-intents handler: dual gate, fail-closed, no role mapping — PASS
- `src/http/handlers/dispatch_intents.rs:25` — `require_scope(&principal, "workflow.read")?`.
- `src/store/postgres/workflow_instance_repository/query_dispatch_intents.rs:53-58` — inside the REPEATABLE READ snapshot: `query_visibility::check_global_scheduler_read(...)`; `if !has_role { return Err(WorkflowQueryError::SchedulerReadRoleRequired) }`.
- `src/store/postgres/workflow_instance_repository/query_visibility.rs:81-96` — the SQL matches `role_key = 'GLOBAL_SCHEDULER_READ' AND enabled = TRUE` only; doc comment (lines 77-80) states explicitly "GLOBAL_WORKFLOW_READER / GLOBAL_WORKFLOW_COORDINATOR bindings are NOT mapped onto it (V6 §8; no automatic role mapping)".
- 403 mapping: `src/http/error.rs:562-565` (`from_query`: `SchedulerReadRoleRequired => forbidden("scheduler_read_role_required", ...)`); also `src/http/error.rs:435-438` for the wake path.

## 2. Due-intent projection: exactly 7 camelCase fields, ordering, limit, predicate — PASS
`src/store/postgres/workflow_instance_repository/query_dispatch_intents.rs`:
- Lines 18-35: struct `DueDispatchIntent`, `#[serde(rename_all = "camelCase")]` + explicit sqlx renames — exactly 7 fields: `dispatchIntentId`, `nodeVisitId`, `workflowInstanceId`, `ownerPrincipalId`, `nextEligibleAt`, `createdAt`, `updatedAt`. Nothing else is selected or serialized.
- Line 100: `ORDER BY "nextEligibleAt", a.activation_id`; line 101: `LIMIT $1`.
- Limit: `dispatch_intents.rs:27-31` — `unwrap_or(50)`, `(1..=100)` else 422 `invalid_pagination`.
- Due predicate, lines 88-99: `activation_kind = 'DISPATCH_INTENT'` (88), `c.activation_id IS NULL` (89, no closure), `wi.cancelled = FALSE` (90), `wi.archived_at IS NULL` (91, not archived), effective `COALESCE(latest eligibility event, initial_next_eligible_at) <= now()` (92-99).

## 3. PUT global-role-bindings accepts GLOBAL_SCHEDULER_READ with full gating — PASS
- `src/http/handlers/provisioning/global_role_bindings.rs:19` (PUT route doc), lines 35-44: roleKey accepted set = COORDINATOR / READER / `GLOBAL_SCHEDULER_READ_ROLE` (constant = `"GLOBAL_SCHEDULER_READ"`, `src/domain/provisioning/mod.rs:54`); else 422 `role_key_invalid`. Route registered `src/http/mod.rs:250`.
- Gating via `ProvisioningAuth` (`src/http/handlers/provisioning/mod.rs`): `authorize_provisioning` requires `workflow.admin` scope; allowlist `state.provisioning_config.is_allowed` (env `WORKFLOW_PROVISIONING_PRINCIPAL_IDS`, required, `src/application/provisioning/config.rs:18-36`); extractor requires enabled actor with `principal_type == "AGENT"`; `authorize_provisioning` rejects `principal_type != "agent" || token_use != "access" || delegating_principal_id.is_some()` (only direct agent access tokens, no OBO).

## 4. Wake endpoint: GLOBAL_SCHEDULER_READ + Idempotency-Key + durable no-op — PASS
- `src/http/handlers/wake.rs` — `require_scope("workflow.execute")` + `require_direct_token` + `require_global_scheduler_read` (server-side binding via `src/store/postgres/provisioning_repository/mod.rs:95-106`, `role_key = 'GLOBAL_SCHEDULER_READ' AND enabled = TRUE`); missing role → 403 `scheduler_read_role_required` with durable `workflow_security_audits` row.
- Idempotency-Key required: `idempotency_key(&headers)?` → 400 `missing_idempotency_key` when absent (`provisioning/mod.rs`).
- `src/store/postgres/workflow_instance_repository/wake_transaction.rs:360-361` (`VERSION_MISMATCH`), `:362-364` (`ALREADY_DUE`), `:372-391` — durable no-op: `wakeApplied: false` body, `WAKE_NO_OP` attempt audit, receipt completed with status 200, no version increment/event/fact (doc lines 11-13, 34). Handler returns `Json(...)` → HTTP 200.

## 5. Migration 0023 + EXPECTED_MIGRATION_VERSION — PASS
- `migrations/0023_visit_activation_v1.sql` exists at the commit. Line 84: `CREATE TYPE activation_kind AS ENUM ('HUMAN_WORK_ITEM', 'DISPATCH_INTENT')`; lines 86-99: `CREATE TABLE workflow_activations` with `CONSTRAINT uq_activation_node_visit UNIQUE (node_visit_id)` (line 99); line 116: `workflow_activation_closures`; line 136: `workflow_dispatch_eligibility_events`.
- `src/http/mod.rs:29`: `pub const EXPECTED_MIGRATION_VERSION: i64 = 23;`.

## 6. dsh workflow.js manifests — PASS
`packages/broker/src/capabilities/workflow.js` at ec074d56:
- `workflow_dispatch_intents` (lines 459-505): `requiredScopes: ['workflow.read']` (469); single operation `list`, `method: 'GET'`, `path: '/internal/v1/dispatch-intents'` (499-500); `query: ['limit']` only (501), sole arg `limit` 1-100 (485-491); declared errors include `scheduler_read_role_required` (473) and `invalid_pagination` (474); passthrough documented ("passed through verbatim: the broker never filters, orders, augments, or caches", 446-450), `result: { type: 'json' }` (495); no bespoke mapping layer exists (workflow.js is the only broker src file referencing dispatch intents).
- `workflow_wake_dispatch_intent` (lines 526-576): `requiredScopes: ['workflow.execute']` (535); POST path with `pathParams: ['workflowInstanceId', 'nodeVisitId']` (569-570); `body: ['expectedWorkflowStateVersion', 'cause']` (571); `idempotencyKey: true` (572, trusted seam); model args are exactly workflowInstanceId / nodeVisitId / expectedWorkflowStateVersion / cause (556-562) — no principalId/agentId/actor/assignee; "the broker performs NO automatic retry (command_still_processing passes through)" (522-524), `command_still_processing` declared pass-through (546).
- Bonus check: the artifact copy `/Users/yanfenma/workspace/deployment-artifacts/visit-activation-dispatch-v1/workflow.js` is byte-identical to the git version.

## 7. Spec doc + registration — PASS
- `docs/specs/AGENT_CORE_WORKFLOW_DISPATCH_INTENT_BROKER_V1.md` at ec074d56: `status: accepted` (line 3); `external_authorities` pins `repository: mayf3/svc-workflow`, `revision: 22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7`, `relation: interoperates_with` (lines 15-19).
- Registration: `workflow.js:588-589` adds both manifests to the exported `manifests` array; `packages/broker/src/index.js:59` imports it (`manifests as workflowManifests`) and line 89 spreads `...workflowManifests` into `DEFAULT_MANIFESTS` (lines 85-94) — the pre-existing spread. `registry.js` contains no dispatch-intent-specific code (only generic "multi-operation dispatch" comments) and `ec074d56^..ec074d56` touched neither registry.js nor workflow.js; manifests were introduced in `aaf7a43` whose message confirms "registry.js algorithm untouched".

## 8. SIM_RESULTS.json sanity check — PARTIAL FAIL (discrepancy)
`/Users/yanfenma/workspace/deployment-artifacts/visit-activation-dispatch-v1/sim/SIM_RESULTS.json`:
- PASS: `allOk: true`; exactly 19 steps, every `ok: true`; `binarySourceSha: 22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7` matches the deploy target; `migrations_0023_applied` shows `maxVersion: 23`; wake no-op steps 17-18 present.
- FAIL: the 7 projection keys are NOT listed in any due_poll step. Step 12 `due_poll_sees_entry_intent` records only `{step, ok}`; step 13 `identity_stable_across_polls` records only a `dispatchIntentId`. The full key set appears nowhere in the file. Root cause in `sim/run-sim.sh:165-168`: the runner computes `KEYS` via jq and only `echo`s "projection keys: $KEYS" — it never asserts them against the expected 7-key set and never writes them into the step record; `sim/svc-sim.log` (server-side only) also lacks it. So the artifact does not evidence that the wire projection matched claim 2. (Minor: `SIM_RESULTS.json.new` is an identical NDJSON duplicate.)

## Verdict
All 7 source-code/spec claims (items 1-7) PASS against the pinned commits. The single discrepancy is evidentiary: SIM_RESULTS.json verifies 19/19 ok with the correct binary SHA, but contains no 7-key projection listing or assertion in the due_poll step, so that part of the record's sim evidence is unsupported by the artifact.

REVIEW_RESULT = FAIL

Discrepancies found:
1. SIM_RESULTS.json due_poll steps do not list (or assert) the 7 projection keys required to match claim 2 — `run-sim.sh:166-168` computes and echoes `KEYS` but does not assert or record them. Remedy: re-run the sim with a hard assertion (`keys | sort | join(",")` compared to the canonical 7-key string) recorded into the step, or amend the record to drop the unsupported key-listing claim.
2. (Non-blocking) `SIM_RESULTS.json.new` is a stale duplicate of SIM_RESULTS.json in the artifact directory; remove or reconcile for cleanliness.

Note: if the record is corrected per item 1, the substantive deploy readiness of both pinned revisions is fully supported by source verification — no code-level discrepancy was found in claims 1-7.