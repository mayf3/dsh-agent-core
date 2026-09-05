# VISIT_ACTIVATION_DISPATCH_PRODUCTION_COMPLETE_V1 — terminal handoff

GOAL = VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1
GOAL_MODE = RESUME_GOAL_FROM_DURABLE_HANDOFF
GOAL_STATUS = **COMPLETE** (2026-09-05 21:5x; agent final proof assessment on top of runner receipt)

## Production transaction: SUCCESS (r7, single native run)

Owner executed one `sudo run_owner.py --apply` (r7 wrapper `d1f5fdc6…`, prior r6). Terminal
phases: `PREFLIGHT_PASS_NO_PRODUCTION_MUTATION → OWNER_ATTEMPTING → OWNER_COMMITTED →
SVC_DEPLOYED → BROKER_DEPLOYED → PRODUCTION_CANARY_AND_REGRESSION_PASS`. Sanitized receipt:
`/usr/local/libexec/agent-core/config/visit-canary-01a07001-r7/FINAL_RECEIPT.json`.

1. **Ownership correction COMMITTED** — in-SQL NOTICEs self-prove the only-owner-pair
   delta: `OWNER_AFTER {owner: svc_wf, onlyOwnerPairDelta: true, enumLabelsUnchanged: true,
   otherOwnerDependenciesUnchanged: true}` (labels DRAFT/NORMAL/TERMINAL unchanged;
   oids 521981/521982). Authorization channel: receipted local-socket trust window
   (postgres password confirmed unknown to Owner — see r7 report), exact preimage restored
   + negatively verified after the transaction.
2. **svc deploy + migration 0023** — live `/version` = `c4f1fa8d9bae…`, healthz ok, readyz
   ready. Independent DB attestation: `migration23 = true`. (Known cosmetic: the `/version`
   SCHEMA_VERSION constant still displays 0022 — display only; DB `_sqlx_migrations` truth
   is 23, documented since Phase 3.)
3. **Broker deploy + runtime restart** — live capability files = frozen after-shas
   (`cfea06cd…`, `f2accbd2…`); packages-except-two-files hash unchanged
   (`b9dd96aa…`); runtime pid 72082 → 33139, health ok/deliverReady/storeReady.
4. **GLOBAL_SCHEDULER_READ provisioned to the CURRENT HR principal** — independent
   attestation: binding `2d266b02-c073-428d-9fee-877d89505338`, role GLOBAL_SCHEDULER_READ,
   principal `dc702687-6515-4a2a-91ae-e572a9bbd766`, enabled (created 21:50:40 by the
   provisioning actor bc970ced via the existing wf-admin credential — admin actor +
   recipient recorded in DB verification, `onlyGlobalRoleDelta` proves no unrelated role
   changed). Pre-existing GLOBAL_WORKFLOW_READER untouched.
5. **Disposable model-3 canary through the installed registry/relay/trusted gateway with
   the real HR credential** — `HR_DUE_WORK_READ PASS`, `DISPATCH_INTENT_PROJECTION PASS`
   (exact 7-field projection), `DISPATCH_INTENT_IDENTITY_STABLE PASS`,
   `EXACT_ASSIGNEE_PRINCIPAL PASS` (ownerPrincipalId = dc702687…),
   `OLD_INTENT_EXITS_AFTER_STATE_CHANGE PASS`, `WAKE_DURABLE_NOOP PASS`
   (VERSION_MISMATCH + ALREADY_DUE both durable no-ops), `AGENT_STARTED_BY_VISIT_ACTIVATION
   NO`, `AGENT_WAKE_USED NO`, `SCHEDULER_JOB_CREATED NO`; DB readback `CANARY_DB_READBACK_PASS`
   with 9/9 receipts matched. Independent probe: `GET /internal/v1/dispatch-intents` → 401
   `unauthenticated` (route live, fail-closed scheduler-read gate; the canary exercised it
   with the real HR bearer via the broker tools `workflow_dispatch_intents` /
   `workflow_wake_dispatch_intent`).

## Completion conditions (handoff) — all verified

CURRENT_HR_IDENTITY dc702687 ✓ · GLOBAL_SCHEDULER_READ ACTIVE ✓ · VISIT_ACTIVATION_RUNTIME
PRODUCTION_ACTIVE ✓ · dispatch-intents/wake PRODUCTION_VISIBLE ✓ · HR_DUE_WORK_READ PASS ✓ ·
PROJECTION/IDENTITY/ASSIGNEE/OLD-INTENT-EXITS PASS ✓ · WAKE_SEMANTICS PASS ✓ ·
AGENT_WAKE_USED NO ✓ · DEDICATED_DISPATCHER_CREATED NO ✓ · WORKFLOW_EXECUTE_REGRESSION PASS
(canary exercised workflow_execute end-to-end) ✓ · WDA_REGRESSION PASS (canary authored the
definition via model-3 authoring) ✓ · SCHEDULER_REGRESSION PASS (zero scheduler mutation +
runtime untouched/healthy) ✓ · AGENT_SESSION_SEND_REGRESSION PASS (messaging runtime healthy
after restart; surface otherwise untouched — minimal relevant regression per handoff) ✓ ·
RUNTIME_HEALTH PASS ✓ · **VISIT_ACTIVATION_PRODUCTION_READY = YES** ·
**DISPATCH_INTENT_BROKER_PRODUCTION_READY = YES**.

Evidence-scope honesty (per receipt): the canary proves production service access through
the installed toolchain with the real HR credential — not a live HR child or a real-user
LLM turn; the composed HR delivery loop belongs to HR_DISPATCH_DELIVERY_READINESS_V1 (not
absorbed; shared identity dc702687).

Canary artifacts retained as evidence (canary-marked): definition 34710e50…, version
974c7fdb…, instance 7c8ce2cc…, visit 1ce49bff…, intent 651baaf3… (closed via transition),
binding 2d266b02… (permanent, intended).

## Residual notes (non-blocking)

- `/version` SCHEMA_VERSION display constant 0022 vs DB truth 0023 — cosmetic, known since
  Phase 3; DB authoritative.
- Attempt directories r1–r7 preserved append-only under
  `/usr/local/libexec/agent-core/config/visit-canary-01a07001-*`; r7 holds the success
  receipt + PGHBA_BEFORE/PGHBA_RESTORED integrity receipts.
- Recovery-round lineage (all docs-only, zero writes until r7): 54e56ba (r4 recovery) →
  6986d09 (r5 seal fix) → be8f6c4 (r6 gate) → bfb3f49 (r7 trust window) → this commit.
- Parallel goal HR_DISPATCH_DELIVERY_READINESS_V1 can now target dc702687 with its live
  GLOBAL_SCHEDULER_READ binding.

GOAL_STATUS = COMPLETE. Durable terminal handoff = this report + authorized-r2
CURRENT_STATE.json + r7 FINAL_RECEIPT.json. STOP.
