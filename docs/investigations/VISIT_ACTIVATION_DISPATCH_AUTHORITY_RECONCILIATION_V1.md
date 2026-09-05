# VISIT_ACTIVATION_DISPATCH_AUTHORITY_RECONCILIATION_V1 — Phase 2 authority reconciliation

```text
GOAL = VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1 (P0, OWNER_DISPATCH_UNIT = GOAL)
PHASE = 2 (authority reconciliation; READ-ONLY evidence, no production mutation)
DATE = 2026-09-05
UPSTREAM = docs/investigations/VISIT_ACTIVATION_DISPATCH_PRODUCTION_CENSUS_V1.md
           (dsh e552694)
```

## R1 — Deploy authority vehicle

Both governing specs declare `production_apply_authority: none` and list
production apply as a separate gate (DIB spec §4: "production apply（部署为独立
gate）"; VAI spec header: "Production apply … separately gated and NOT authorized
here"). **This Owner-dispatched Goal (OWNER_DISPATCH_UNIT = GOAL, P0) is that
separate gate**: it is the authority vehicle for the production deployment round,
executed autonomously up to READY_FOR_DEPLOYMENT with `PRODUCTION_DEPLOYMENT =
HOLD` while WDA occupies production mutation, and executed only after the WDA gate
clears (concurrency = 1).

Two deploy planes, each with proven precedent machinery:

| Plane | Target | Precedent pattern |
|---|---|---|
| svc-workflow (user-domain) | new binary at `/Users/yanfenma/.local/services/svc-workflow/svc-workflow` + boot-time migration | 13-entry JSONL deploy `ledger.json` (fields: `deployedAt, sourceSha, artifactSha256, previousArtifactSha256, verification{healthz,readyz,authHttpStatus,schemaVersion,regression…}`); `releases/<sourceSha>/` staging dirs; migrations run automatically at boot (`src/main.rs`: `migrations::run(&pool)` before serve) with a `--migrate` migrate-only mode for a pre-swap schema step |
| dsh runtime broker (system-domain) | `/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow.js` + runtime restart | WDA deploy-r2 (`deployment-artifacts/workflow-definition-authoring-v1-deploy-r2/`): DEPLOYMENT_MANIFEST + preimage bundle + apply script + DEPLOYMENT_RECEIPT (status DEPLOYED, old_pid→pid_after, sha256, catalog_ok) |

## R2 — GLOBAL_SCHEDULER_READ supply

### R2.1 Mechanism (code-frozen, no new code needed)

`src/domain/provisioning/mod.rs` (svc `22e862a`): `GLOBAL_SCHEDULER_READ` is a
first-class provisioning role constant — "No binding is created by code or
migration; supply stays with the separately gated provisioning authority."

Supply flow (all gates verified in source):

```text
PUT /internal/v1/admin/global-role-bindings/{principalId}
  body {roleKey: "GLOBAL_SCHEDULER_READ", enabled: true}
  headers: Idempotency-Key (required), direct agent access token
gates: workflow.admin scope + JWT.sub ∈ WORKFLOW_PROVISIONING_PRINCIPAL_IDS
       + principal_type=AGENT + direct token (no OBO)
```

Live allow-list (read-only, from service `.env`): `00000000-…-0001`
(workflow-provisioning-service, active), `10000000-…-0001` and `10000000-…-0101`
(no active principal), **`bc970ced-710f-4479-9ff0-e295a1c59424` = `hr-agent`
(HR助手, active)**. → An active, production-hardened provisioning executor
channel already exists (hr-agent's client + `workflow.admin`).

Also required for the poll itself: the caller's token must carry `workflow.read`
(broker face CTR-DIB-001); wake requires `workflow.execute` (CTR-DIB-002).
Verification of the designated caller's grants is a Phase 5 item.

### R2.2 Designation (WHO holds the binding) — OPEN, Owner packet item

V6 §7 constraints (quoted in census §3): the Scheduler permission belongs to a
dedicated Agent Principal identified by "a repository-owned docs-only designation
root"; `EXISTING_BUSINESS_OR_CANARY_AGENT_REUSE = FORBIDDEN_BY_DEFAULT`;
`NEW_GLOBAL_WORKFLOW_COORDINATOR_GRANTS_AUTHORIZED = NO` (unaffected — we grant
SCHEDULER_READ, not COORDINATOR). No designation root exists today (fresh grep of
both mains: V3–V6 mention the requirement; no designating artifact found).

Candidates:

| Option | Subject | For | Against |
|---|---|---|---|
| A (recommended) | `hr-agent` = `bc970ced-…` (HR助手) | already THE HR orchestration agent; active member of the provisioning allow-list (admin-channel actor); already carries legacy `GLOBAL_WORKFLOW_COORDINATOR` (pre-existing compatibility debt, not a new coordinator grant); zero new identity work → smallest production surface change for a P0 | violates the V6 default against reuse of an existing agent → requires an explicit Owner deviation ruling recorded in the designation root |
| B | NEW dedicated agent (V6 default path) | clean split-permission carrier, no deviation needed | costs a full identity-bootstrap round (accepted pattern precedent: `AGENT_CORE_WORKFLOW_ADMIN_AGENT_BOOTSTRAP_V1` → agt_workflow-admin-agent: Agent Definition + auth-service principal/client + trusted credential store), i.e. another Owner-authorized execution chain before this Goal can verify |

Recommendation: **A for this Goal**, with the deviation ruling + exact coordinates
(principal UUID, client, scopes) frozen in a docs-only designation root carried in
the Owner packet; B recorded as FOLLOW_UP_DEBT if the fleet later wants a
single-purpose scheduler reader. FINAL DECISION = Owner packet item (V6 reserves
designation to "a later designation authority"; not self-designatable here).

## R3 — Cursor contract reconciliation

The Goal requires the due query to yield a "cursor". The frozen contracts (svc
`22e862a` handler/store + dsh DIB external-authority pin) provide a **limit-only
ordered poll** (limit 1..100 default 50, `ORDER BY nextEligibleAt, activation_id`)
with no wire cursor. v0.4.0 §5.11 states: "Exact transport, cursor, acknowledgement,
and retry scheduling remain for the **implementation and external authorities**."
→ the accepted limit-only implementation is architecture-conformant; the cursor is
an external-authority-layer concern.

**RULING (proposal for Owner packet confirmation):**

```text
DISPATCH_CURSOR = CLIENT_SIDE_CHECKPOINT over the deterministic
                  (nextEligibleAt ASC, dispatchIntentId ASC) order
CONFORMANCE     = deterministic ordering + identity stability (see R4);
                  re-observation of an ACTIVE intent across polls is BY DESIGN
                  (level-triggered due poll, not an edge feed)
REJECTED        = wire-level cursor param (would require AMEND of both accepted
                  specs; no NEW_EVIDENCE of scale need)
HONEST BOUNDARY = no server-side "after" filter ⇒ with >100 simultaneously due
                  intents the tail is unreachable (head-of-line). Acceptable in
                  the bounded single-user deployment envelope (V6); drain is via
                  closure/wake. Recorded as known scale boundary, not a defect.
```

Acceptance step 4 ("cursor 正确") operationalizes as: repeated limited polls
return deterministic order; the checkpoint + identity dedup yields exactly-once
observation of each active intent; after a state change the intent leaves the due
set (step 8).

## R4 — Exactly-once coordinate

```text
DISPATCH_IDEMPOTENCY_COORDINATE = dispatchIntentId
  (= workflow_activations.activation_id — server-generated UUID PK, immutable,
     unique, DB-enforced; composite context: workflowInstanceId + nodeVisitId)
```

Derivation: the activation is created atomically with Visit entry
(`activation_facts.rs`, exactly-one-canonical-activation invariant, v0.4.0 §5.7);
closures are linked 1:1 (`workflow_activation_closures`, at most one per
activation); the due predicate excludes closed activations and
cancelled/archived instances; eligibility events rewrite `nextEligibleAt` without
changing identity. Delivery retry preserves the same Dispatch Intent and
nodeVisitId, "never creates a duplicate activation" (v0.4.0 §5.11).
Phase 5 proof obligations: (i) repeated polls → same identity set; (ii) after
visit closure → the activation never reappears as the same eligible work.

## R5 — Forbidden routes: non-restoration record

- The 2026-08-27/28 "HR dispatcher v1" chain — dsh `AGENT_CORE_HR_DISPATCHER_V1`
  draft (Scheduler WAKE-node unified dispatcher, DAG WAKE→31→14→83→87), auth
  `AUTH_SERVICE_AGENTCORE_HR_DISPATCHER_IDENTITY_V1` (accepted, but its §3 grant
  entry 2 normatively requires the **`agent-wake` audience / `agent.wake` scope**,
  PR #32) and its downstream svc PR #14 / dsh PR #83/#87 — is the **old
  dispatch route: DO_NOT_RESTORE** per this Goal. The accepted-but-wake-tainted
  identity authority is therefore NOT usable as-is for this Goal; if designation
  Option B is chosen, identity work follows the workflow-admin bootstrap pattern
  instead, with no `agent.wake` scope anywhere.
- No `dispatchableOnly` flag exists in either merged main (grep 0 hits in
  capability faces). Legacy `com.openclaw.workflow-dispatcher` LaunchDaemon:
  not loaded, not running (residue plist only).

## Phase 2 verdict

```text
AUTHORITY_RECONCILED   = YES for mechanism (R1 deploy planes, R2.1 supply flow,
                         R3 cursor ruling, R4 coordinate, R5 fences)
OPEN_ITEMS             = designation A|B (Owner packet), WDA completion gate
                         (HOLD), execution authorization for the system-domain
                         restart step, designated caller's workflow.read/execute
                         grant verification (Phase 5)
NEXT                   = Phase 3 drift analysis + three-piece artifact
                         (svc binary @ 22e862a + migration 0023 + broker
                          workflow.js @ dsh main) → simulation → review →
                         Owner packet → READY_FOR_DEPLOYMENT
OWNER_ACTION_REQUIRED  = NONE yet (packet at end of Phase 4)
```

---

## ADDENDUM (round-3 fresh check, 2026-09-05): model-3 authoring gap blocks production acceptance steps 1–2

Fresh re-verification during the HOLD round surfaced a precondition gap that the
round-1/2 evidence masked (the scratch simulation seeded its definition via SQL,
exactly like `tests/28_visit_activation_v1.rs`, so no API path was exercised):

- At the deploy target svc `22e862a`, `create_draft_version` validates
  `semanticModelVersion ∈ {1, 2}` only (`src/http/handlers/definitions.rs:268-277`
  — "semanticModelVersion must be 1 (Legacy) or 2 (Minimal)"); no other accepted
  endpoint sets a definition version's semantic model. The VAI impl spec is the
  "phase-1 **runtime core**" slice; model-3 (VISIT_ACTIVATION_V1) definition
  authoring was never in any accepted surface.
- Consequence: after deploying planes 1–3, production can poll/wake/report, but
  **no VISIT_ACTIVATION_V1 instance can ever be created** (no model-3 definition
  can exist), so Goal acceptance steps 1–2 (create disposable visit → due
  activation) have an unsatisfied precondition. The visit_activation graph
  validator IS already wired into draft+publish dispatch (`publish.rs:74`), so
  the authoring-side constraint is a policy line in the handler, not missing
  machinery.

Options for the Owner (DECISION 3 in the packet):

| Option | Path | Cost |
|---|---|---|
| 3a | Spec AMEND (new mini-spec or VAI amendment) authorizing `semanticModelVersion: 3` through create_draft_version; rebuild + redeploy the svc artifact | clean, audited; adds one rebuild/redeploy cycle to this Goal |
| 3b | Owner-authorized disposable SQL seed of ONE model-3 definition for verification only | no code change; writes production DB outside the service command surface (against governance spirit) |
| 3c | Defer acceptance steps 1–8 to the authoring-integration slice; this Goal completes planes 1–3 + broker-face production verification (tools visible, binding-gated poll 200/403) and stops short of final COMPLETE | goal cannot reach COMPLETE this round |

WDA gate re-checked 2026-09-05 ~12:20: `CANARY_RESULT.json` still ABSENT; WDA
scripts updated 11:25–11:26 (canary debugging in progress) — HOLD stands.
Production drift probe: live routes still pre-merge (route_not_found), DB max
migration still 22, GLOBAL_SCHEDULER_READ bindings still 0, runtime pid 72082
healthy — census findings unchanged.
