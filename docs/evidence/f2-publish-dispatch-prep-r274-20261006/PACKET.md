# WORKFLOW_F2_PUBLISH_DISPATCH_PREP_R274 — fresh census + TEST_IDENTITY + frozen real-business packet

```text
PRODUCT          = mayf3/dsh-agent-core#471 (F2: Workflow publish + real Instance/Task + dispatch)
CLAIM            = f2-workflow-publish-prep-r274 (agent-control#466, round cap-20261006T041144Z-274)
DATE             = 2026-10-06
NATURE           = ONE bounded NON-PRODUCTION census/integration-prep action:
                   fresh SOURCE/INSTALLED/ENABLED census + TEST_IDENTITY checks on a
                   disposable DB + freeze of the smallest exact future real-business packet.
PRODUCTION_MUTATION = NO (all production access read-only: HTTP 401/404 probes, launchd/ps/lsof,
                   file greps, one read-only SQL session with default_transaction_read_only=on
                   BEGIN...ROLLBACK against svc prod DSN; no sudo, no restart, no credentials
                   work, no data mutation, no UNKNOWN replay, no Remote Desktop, no process
                   cleanup; agent-control observability files untouched; #490/agent-control#464
                   writer preserved — disjoint lane).
DISPOSABLE_DB    = f2_tid_publish_dispatch_r1 @ 127.0.0.1:55432 (isolated test instance,
                   postgres:postgres per documented conformance pattern) — CREATED, used,
                   DROPPED; 0 databases remain (verified). Production DB is 5432/
                   svc_workflow_dogfood_clean and was never written.
BASES            = svc-workflow github/main 7c533cf (fresh clone) · dsh origin/main 4d9f9c36 ·
                   live production trees (read-only greps) · live DB (read-only SQL)
HISTORICAL_BASE  = WDA_AUTHORING_PRODUCTION_RECOVERY_V1 TERMINAL (dsh 260bcc36, 2026-09-10):
                   the "Draft-v2 / legacy-assignee" lane — v1 draft 2cba2687 published with a
                   STALE legacy assignee 61819256 = by-design dead end; Owner ruling
                   A_WITH_SAFETY_AMENDMENT → v2 65be31fd (identity-only correction, all work
                   steps → canonical 9e3adced), STALE_PRINCIPAL_REFERENCE_COUNT=0 gate, real
                   instance 085b41f2 created + dispatched (HR EAPR + session_send +
                   SELF_TRANSITION 1→2) with durable evidence (deliverable
                   docs/workflow/085b41f2-materials-prep.md). REUSED as the publish/create
                   pattern; NOT the current canonical dispatch subject (pre-0023 old path).
```

## 1. CURRENT_TRUTH (fresh 2026-10-06)

### SOURCE (all three seams merged; nothing to write)

| Seam | svc-workflow main 7c533cf | dsh main 4d9f9c36 |
|---|---|---|
| Publish | lifecycle publish + admission (CTR-CIR-003) + graph validation; e2e `tests/37_authoring_loop_e2e.rs` (5d479d8) in-tree | broker `workflow-definition-authoring.js` (create_draft_version → replace_draft_graph → publish_version) |
| Create | HTTP create tx (workflow_instances writer #1) | broker `workflow_execute` create_instance (production create surface, WECB B6) |
| Dispatch | feed GET /internal/v1/dispatch-intents + wake POST (routes src/http/mod.rs:124-133), activation facts + keyset (0023 line) | broker `workflow_dispatch_intents` + `workflow_wake_dispatch_intent`; WEC execution runtime + assistance merged |

Installed-vs-main svc delta is source-advanced only: 48e09dc (#69 lastAttemptId opaque typing), 6b316a7 (#72 / Product #449 definition-validation fix — #449's lane owns its install), 5d479d8 (#70 test-only). None blocks the three seams.

### INSTALLED

| Piece | State | Receipt |
|---|---|---|
| svc production binary | 9f7c2483 (WEC integration era) | `releases/9f7c2483…/provenance.json`: sourceSha 9f7c2483, treeState clean, built 2026-09-24, migrations 0001–0027 |
| svc migrations | head = 27 (read back from `_sqlx_migrations`) | 0028 owner-assistance NOT applied |
| svc process | PID 25143, launchd com.svc-workflow, started Oct 1, /healthz {"status":"ok"}, :8989 | ps/lsof |
| svc dispatch routes | GET /internal/v1/dispatch-intents → **401 unauthenticated** (present+gated); POST /internal/v1/workflow-instances/{id}/node-visits/{visitId}/wake → **401** (present+gated) | curl, no token sent |
| dsh fleet lane (agent-serving) | PID 1329 (ai.agent-core.runtime, started Oct 1 19:34, :8787/:8791/:8789) from `~/workspace/project/production-dsh-agent-core` (base 549dace 2026-08-21, dirty tree; broker workflow.js mtime Sep 18 09:44 = loaded face). **HAS**: workflow-definition-authoring.js, workflow_execute, workflow_dispatch_intents, workflow_wake_dispatch_intent, WECB execution_class passthrough. **LACKS**: V4 currentExecutorType filter, WEC execution runtime (workflow-execution-runtime.js), product-api workflow-execution-routes.js, workflow-assistance.js | file greps + diff vs main |
| dsh authsvc lane | PID 64187 from `/usr/local/libexec/agent-core/app` (files Sep 24, pre-assistance): WEC traces/kicks routes + runtime + V4 + DIB present; assistance broker face absent; env custody unreadable without sudo (sudo NOT used) → poller config UNKNOWN; standing handoff deliberately keeps WORKFLOW_EXECUTION_POLLER_AGENT_ID unset (503 poller_unconfigured) | ps + file listing |
| dsh scheduler-v2 lane | PID 1328, no workflow/poller env keys | env key-name grep (values never printed) |

### ENABLED (production data, read-only SQL)

| Fact | Value |
|---|---|
| Publish seam usage | 145 PUBLISHED / 23 DRAFT / 5 DEPRECATED definition versions |
| Create seam usage | 599 instances: 578 model-v1, 1 v2, **20 v3 (VISIT_ACTIVATION)** — v3 in build-in-public-dogfood ×16, hr-onboarding ×3, family-home ×1; latest v3 2026-10-05 00:56 |
| Dispatch gate | `GLOBAL_SCHEDULER_READ` enabled bindings = **1** (HR助手, created 2026-09-05 21:50) |
| Dispatch feed state | **3 open DISPATCH_INTENT activations, all due since 2026-10-02** (build-in-public-dogfood) |
| Canonical dispatch cycle ever run | **NO** — `workflow_dispatch_eligibility_events` = 0 rows total (no successful wake/deduction ever); zero WAKE/DISPATCH workflow_events |
| Wake attempts | 25 × WAKE_DISPATCH_INTENT_DENIED (2026-09-20 → 2026-10-02) by five non-granted fleet agents (家庭管家/效率管家/文风分析师/论文导师/agent-d5b3aeb2) — canonical wake REACHED svc and was 403-denied for lack of the binding; never succeeded |
| Activation closures | 174 (visit transitions closed activations directly via workflow_execute; none via feed→wake) |

### Lifecycle truth for #471

```text
SOURCE          = merged (both repos, all three seams)
INSTALLED       = partial  (svc side of dispatch installed+gated; dsh CONSUMER not established:
                             WEC poller absent from fleet lane; broker wake/feed tools present)
ENABLED         = partial  (publish/create enabled with real production usage; dispatch feed
                             gate enabled for exactly 1 principal but never exercised)
BUSINESS_VERIFIED = no     (canonical-path dispatch never executed; the 2026-09-10 WDA proof
                             used the pre-0023 old path)
```

## 2. REMAINING_GAPS (exactly one)

**GAP-D1 — canonical dispatch CONSUMPTION is not established.** Publish ✓ and create ✓ are
source+installed+enabled with durable historical proof. Dispatch: the svc feed is live, gated,
and holding 3 due intents since 2026-10-02, but no authorized consumer exists: (a) the WEC/WAE
poller is not installed on the agent-serving fleet lane, and its enablement is C7 #407's
SINGLE_BLOCKER (POLLER_WHO Owner decision) riding the WEC shared release vehicle (svc 0028 +
binary rolls); or (b) a designated driver holding GLOBAL_SCHEDULER_READ (HR助手 already holds it)
drives the already-installed broker tools. No source change closes D1 — it is install/enable/
authorize, i.e. production-mutation territory: PROD_AUTH=NONE this round.

Non-gaps deliberately NOT acted on: svc installed binary predates #449 fix (that Product owns
its install; canary below avoids v5 distribution-node shapes until it lands); 3 stale due
intents belong to build-in-public-dogfood (#470 F1 adjacent — reconcile before reuse);
`unreviewed-rebuild-eecf3ea1` artifact in svc releases dir (not mine to disposition).

## 3. TESTS (TEST_IDENTITY — zero production data)

Base svc-workflow 7c533cf, cargo 1.98.1, `--locked`, disposable DB f2_tid_publish_dispatch_r1
@ 127.0.0.1:55432 (isolated instance), `TEST_DATABASE_URL` overridden (default 5432 DSN never
used), DB dropped after (0 remain). Transcript: `test-identity-transcript-raw.log`.

| Suite | Result | Proves |
|---|---|---|
| 37_authoring_loop_e2e | **4/4 PASS** | author→validate→publish→instantiate over HTTP; invalid graph = actionable errors zero partial state; instance pins the published version; published-version identity stable (publish/create plumbing + durable receipt semantics) |
| 28_visit_activation_v1 | **9/9 PASS** | due-read gate + 7-field projection; wake applies / durable no-op; activation facts immutable; fail-closed owners; legacy protection (dispatch seam plumbing) |
| 29_dispatch_intent_keyset | **6/6 PASS** | keyset continuation, tie-break, cursor validation, starvation proof, role gate (feed contract) |

19/19 PASS, EXIT=0. dsh-side TEST_IDENTITY reuse: r224 (agent-control#437, fc556b49) already
proved the broker face offline 11/11; this round's live-face greps pin the loaded fleet-lane
broker as carrying the DIB/WDA/WECB surfaces (loaded-identity by process-start < mtime Sep 18).

## 4. FROZEN PACKET — smallest exact future real-business operation

Vehicle decision belongs to Owner/C7 (#407 owns POLLER_WHO + WEC vehicle); #471 rides it.

```text
VEHICLE_A (default, WEC-shared): svc 0028 + svc roll ≥1249ec4 + dsh fleet-lane roll to
  WEC-capable bytes (#454/#435-protected install lane) + POLLER_WHO custody
  (WORKFLOW_EXECUTION_POLLER_AGENT_ID + KICK_TOKEN per O5, 0600 env) → WAE poller consumes
  feed with attempt fencing/escalation/forum projection (full accepted protocol).
VEHICLE_B (minimal bridge): Owner designates the already-granted HR助手 (dc702687) as dispatch
  driver via the ALREADY-INSTALLED fleet-lane broker tools (workflow_dispatch_intents →
  workflow_wake_dispatch_intent → owner agent workflow_execute). Zero deploy. Requires only
  driver custody/credentials (Owner/C7 step). WEC adoption later stays additive.
CANARY (same 5 steps either vehicle, all reusing proven patterns):
  1. PUBLISH via broker workflow_definition_authoring on a REAL business definition;
     identity discipline = WDA v2 pattern: every assignee resolves canonical successor
     lines (Draft-v1 stale-assignee 61819256 dead-end is the known trap);
     STALE_PRINCIPAL_REFERENCE_COUNT=0 read-back gate before instantiation;
     avoid v5 distribution-node shapes until #449's fix is installed.
  2. CREATE via broker workflow_execute create_instance from the PUBLISHED version
     (receipt COMPLETED + INSTANCE_CREATED event).
  3. DISPATCH: consumer polls due feed (GLOBAL_SCHEDULER_READ) → intent appears →
     wake applied → FIRST workflow_dispatch_eligibility_events row (cause WAKE) —
     currently 0 rows ever, so this row IS the durable canonical-dispatch proof →
     owner agent executes its transition via workflow_execute (transition receipt +
     WORKFLOW_TRANSITION_COMMITTED + activation closure).
  4. ACCEPTANCE = the 28/29/37 test-identity semantics observed once live: due read
     returns the intent exactly once; wake replay = applied-once/durable-noop;
     receipts COMPLETED; closure removes it from the due set.
  5. EVIDENCE: svc receipts + event chain + first eligibility event + dsh ledger,
     archived under docs/evidence convention.
ZERO-NEW-ROW VARIANT: wake-target one of the 3 existing due intents (build-in-public-dogfood)
  instead of a fresh create — reconcile ownership with #470 first.
ROLLBACK (data-level; no migration rollback): cancel instance via DOMAIN_OWNER broker face
  (proven 2026-09-14 repair family); deprecate the definition version if needed; wake is
  eligibility-only (no state-machine mutation) → no wake-side rollback; VEHICLE_A failures
  follow the WEC package rollback section (drain-check BEFORE any svc binary rollback;
  0028 leave-forward, never rolled back with WAKE rows present).
GATES: PROD_AUTH=AUTHORIZED for the exact canary attempt; driver/POLLER_WHO designation;
  VEHICLE_A additionally serialized with the C7/#454 shared release lanes.
BOUNDARY: #471 stops at WAITING_PROD_AUTH (+WAITING_EXTERNAL on the vehicle/driver decision).
  NEXT BOUNDED ACTION (post-authorization, one lane): execute the canary exactly as frozen.
```

## 7. Terminal fields

```text
CLASSIFICATION      = INTEGRATE (no IMPLEMENT: zero source gap found on both mains)
REMAINING_GAPS      = exactly GAP-D1 (canonical dispatch consumption: install/enable/authorize)
CODE_CHANGES        = NONE (speculative code forbidden and not needed)
TESTS               = TEST_IDENTITY 19/19 PASS on disposable DB (dropped); production untouched
CHANGED_FILES       = docs/evidence/f2-publish-dispatch-prep-r274-20261006/ (this packet + transcript) only
REVIEW              = self-round only (census+packet, no code) — changed surface = docs/evidence
                      additions; one focused review applies if any future code lane opens
NEXT_BOUNDED_ACTION = Owner/C7: designate VEHICLE (A=WEC shared release incl. POLLER_WHO, or
                      B=HR助手 bridge) → then the frozen canary executes under PROD_AUTH=AUTHORIZED
PRODUCTION_MUTATION = NO
```
