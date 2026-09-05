# VISIT_ACTIVATION_DISPATCH_READY_V1 — deployment readiness evidence (Phases 3–4)

```text
GOAL = VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1
DATE = 2026-09-05
STATUS = READY_FOR_DEPLOYMENT (deployment itself HOLD: WDA gate)
```

## Phase 3 — artifact (three pieces)

| Piece | Value |
|---|---|
| svc-workflow binary | `~/.local/services/svc-workflow/releases/22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7/svc-workflow`, sha256 `5c31e2390ba01da7ae954d6093d7bbe61826fb692116a187ac8b1833d2c2f3fb`, Mach-O x86_64 (matches live arch), provenance.json treeState=clean, built by official `scripts/release.sh build` |
| migration bundle | `releases/22e862af…/migrations/` max=0023 (`0023_visit_activation_v1.sql`), digest `e3e80314…` |
| broker workflow.js | dsh origin/main blob `7a3df429…` staged as `deployment-artifacts/visit-activation-dispatch-v1/workflow.js`, sha256 `cfea06cd…` (adds exactly the two DIB manifests) |

Drift analysis: svc code drift `f0c74eefd(live) → 22e862af(target)` = exactly the
visit-activation surface (44 code files; intervening V5/V6/v0.4.0/spec commits are
docs-only). Broker drift live `7f55c605`(WDA artifact) → target `7a3df429` = the two
DIB manifests + tests + inventory counts, additive only.

Broker test suite at target commit: **336/336 PASS** (fresh worktree).

Known cosmetic issue (accepted-main state, not fixed here): `src/http/mod.rs:28
SCHEMA_VERSION = "0022"` lags `EXPECTED_MIGRATION_VERSION = 23` — `/version`
displays the stale constant; DB truth (`_sqlx_migrations`) is authoritative.

## Phase 4 — scratch-DB simulation (SIM_ALL_OK, 20/20 steps)

Method: the staged binary booted from the release staging dir (NOT deployed)
against a disposable DB `svc_workflow_sim_vad1` on the test PG instance
127.0.0.1:55432, port 8991. Token: **SIMULATION ONLY** — locally generated RSA
JWKS + self-signed JWT (credential dir `/Users/yanfenma/.openclaw/credentials` is
authsvc-owned 0700, unreadable from the agent shell; the production JWKS protocol
path is exercised daily by existing production routes, and Phase 5 production
verification uses the real broker/auth chain). Scratch env otherwise production
parity (issuer/audience/AUTH_V1 flags; provisioning allowlist set to the simulated
actor).

Proven (steps in SIM_RESULTS.json):

1. Boot: healthz ok; `_sqlx_migrations` max = 23 (0023 applied); `/version`
   gitSha = 22e862af…, treeState clean.
2. Fail-closed gate: due poll BEFORE binding → 403 `scheduler_read_role_required`.
3. Supply flow: `PUT /internal/v1/admin/global-role-bindings/{principalId}`
   roleKey GLOBAL_SCHEDULER_READ → 200 (real admin API; gates: workflow.admin +
   allowlist + direct AGENT token).
4. Due poll after binding → 200 `{"items":[]}`.
5. VISIT_ACTIVATION_V1 definition seeded (TASK|TERMINAL, semantic model 3);
   `POST /internal/v1/workflow-instances` → 201, stateVersion 1.
6. Due poll shows the entry DISPATCH_INTENT with EXACTLY the 7-field v0.4.0 §5.7
   projection — asserted in-record (`projection_exact_7_fields`): createdAt,
   dispatchIntentId, nextEligibleAt, nodeVisitId, ownerPrincipalId, updatedAt,
   workflowInstanceId.
7. **Identity stable across polls** — same dispatchIntentId on repeated reads.
8. Transition advance-1 → stateVersion 2; closed intent LEAVES the due set;
   work-node intent appears with exact assignee `ownerPrincipalId` (fixed
   principal of the node — no guessing).
9. Wake: stale expectedWorkflowStateVersion → 200 `wakeApplied=false`,
   reason VERSION_MISMATCH (durable no-op); already-due → 200 ALREADY_DUE.
10. Archive on active activation → 409 fail-closed (active_activation_exists).

Net: the Goal's acceptance script (steps 1–8) rehearses green end-to-end on the
real artifact; DISPATCH_IDEMPOTENCY_COORDINATE = `dispatchIntentId` empirically
holds (steps 7–8).

**Production precondition caveat (found in the round-3 fresh check, 2026-09-05):**
the scratch rehearsal seeded its definition via SQL (mirroring tests/28); the
deploy target's authoring API caps `semanticModelVersion` at {1, 2}
(`definitions.rs:268-277`), so production has NO path to a model-3 definition
until an amendment (3a), an Owner-authorized seed (3b), or the authoring slice
(3c) lands. Recorded as packet DECISION 3; does not invalidate the artifact or
the runtime-contract evidence above.

## Deployment plan (Phase 5 — HOLD until WDA gate clears)

```text
WDA_GATE (fresh 2026-09-05): CANARY_RESULT.json still absent (Owner-run canary
pending); production runtime pid 72082 healthy. PRODUCTION_DEPLOYMENT = HOLD.
```

Plane 1 — svc-workflow (user domain, no sudo, official pipeline):
`./scripts/release.sh deploy 22e862af…` → `./scripts/release.sh verify 22e862af…`
(backup → install binary+migrations → ledger append → kickstart -k
gui/$(id -u)/com.svc-workflow → /version gitSha + running-binary sha256 +
migration bundle checks; boot auto-applies 0023). Rollback: release.sh backup
restore + restart (equal-face); 0023 is additive, legacy paths never touch the
new tables.

Plane 2 — dsh broker (system domain, Owner-gated like WDA deploy-r2):
apply staged `workflow.js` to
`/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js`
with preimage bundle + receipt; restart runtime; catalog proof: both new tools
visible, all prior tools unchanged (manifest-inventory parity).

Plane 3 — grant: GLOBAL_SCHEDULER_READ binding for the designated principal via
the provisioning API (mechanism proven in sim step 3). **OPEN = designation**
(reconciliation doc Option A hr-agent bc970ced recommended / Option B new
dedicated agent per V6 default; Owner ruling required either way).

Production verification (minimal, after all three planes): disposable
VISIT_ACTIVATION_V1 instance with AGENT owner → broker tool
`workflow_dispatch_intents` reads due intent (7-field projection) → double read
identity stability → minimal wake → workflow_execute transition → intent leaves
due set. No full HR → Agent dispatch loop in this Goal.

## Independent review (round 1, read-only subagent, 2026-09-05)

`independent-review-r1.md`: source-level claims 1–7 ALL PASS against the pinned
commits (dual fail-closed gates with no role auto-mapping; exact 7-field
projection/ordering/limit/predicate; provisioning gating; wake durable no-op
semantics; migration 0023 + EXPECTED_MIGRATION_VERSION=23; broker manifests
CTR-DIB-001/002 conformance incl. no-retry + trusted Idempotency-Key + absence
of model identity args; accepted spec pin + registration via pre-existing
spread, registry.js untouched; artifact workflow.js byte-identical to git).

Verdict r1 = FAIL on ONE evidentiary gap only: SIM_RESULTS.json did not
assert/record the 7 projection keys. REMEDY APPLIED: `run-sim.sh` now
hard-asserts the key set and records a `projection_exact_7_fields` step;
simulation re-run → **SIM_ALL_OK 20/20** (see SIM_RESULTS.json in this
directory). Review round 2 disposition: all reviewer findings addressed;
READY_FOR_DEPLOYMENT stands.
