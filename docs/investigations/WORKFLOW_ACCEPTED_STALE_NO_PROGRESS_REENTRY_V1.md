# WORKFLOW_ACCEPTED_STALE_NO_PROGRESS_REENTRY_V1 — Investigation

```text
STATUS        = COMPLETE (fresh investigation, no historical assumptions reused)
DATE          = 2026-09-16
DSH_MAIN_SHA  = 1a1e59b8e41901c57beb8e5306a557350f56bfa9
SVC_MAIN_SHA  = 8c78c8eef68aa2bb92aa66cb3379297a798e88c1
GOAL_MODE     = INVESTIGATE_THEN_MINIMAL_IMPLEMENTATION
PRODUCTION_MUTATION_PERFORMED = NO (all production access read-only)
```

## 1. Business fault

```text
Workflow task dispatch → SEND_CONFIRMED → Agent accepted
→ Agent never transitions / never RETURN / never HUMAN_REQUIRED
→ workflow state frozen for hours
→ dispatcher keeps classifying the task "already dispatched"
→ no error, no recovery, permanent active zombie
```

Real case `44dee9da-c3d4-4beb-a7f7-f68edfceedcf`: accepted, then 7h04m of
zero workflow progress; it only advanced after a human asked (outside any
workflow mechanism) for a re-dispatch. See §7 for the replay.

## 2. Fresh-mapping of the dispatch chain (the Goal's questions 1–8)

### 2.1 Where "already dispatched" suppression actually lives

**DSH-local, not svc-side.** The dispatcher is the workflow-execution engine
poll loop (`packages/workflow-execution/src/engine.js:248` `pollOnce`, 30s
interval), consuming svc's due feed `GET /internal/v1/dispatch-intents`
(predicate: `activation_kind='DISPATCH_INTENT'` AND no closure AND instance
not cancelled/archived AND `execution_class='BUSINESS'` AND
`nextEligibleAt <= now` — svc
`src/store/postgres/workflow_instance_repository/query_dispatch_intents.rs:161`).

The suppression predicate is the local ledger fence
(`packages/workflow-execution/src/ledger.js:250` `beginAttemptIfAbsent`):

```js
const existing = this.#attempt(nodeVisitId)
if (existing !== undefined) {
  return { created: false, attempt: {...existing}, cause: 'already_attempted' }
}
```

Any prior attempt for the nodeVisitId — ACTIVE, SETTLED or NEEDS_REVIEW, any
phase — blocks forever. Consumed at `engine.js:147` → `already_attempted`.

The attemptId is deterministic: `attemptIdFor = sha256(nodeVisitId)`
(`ledger.js:53`), and V2 freezes the invariant
(`docs/specs/AGENT_CORE_WORKFLOW_AGENT_EXECUTION_V2.md` §1):
`ONE_NODE_VISIT → at most ONE deterministic attemptId → at most ONE Agent Run
admission; SECOND_ATTEMPT_ID = FORBIDDEN; SECOND_RUN = FORBIDDEN`. V2 §0
non-goals additionally forbid "no automatic retry engine of any kind … no
recovery triggered by poller ticks or reconcile passes … no second attempt
id, ever".

### 2.2 Where SEND_CONFIRMED / accepted are written

There is no literal `SEND_CONFIRMED` in either repo. The equivalents:

- DSH ledger events in `<root>/workflow-execution/attempts.jsonl`:
  `delivery_started` (write-ahead, before router.deliver;
  `ledger-events.js:92`) and `run_delivered` (router accepted the prompt;
  `ledger-events.js:145`). DSH never reports dispatch status back to
  svc-workflow (broker manifest has only `list` + `wake` for dispatch
  intents, `packages/broker/src/capabilities/workflow.js:343-468`).
- "accepted" = `router.deliver` returning `accepted:true` = the message
  entered the session inbox (`packages/agent-router/src/ingress-delivery.js`).
  It is recorded only in the in-memory reconciliation store
  (`promptReceipt`, never persisted) — svc-workflow has NO acceptance
  concept at all (grep across svc main: no accept/ack/deliver fact; the
  VISIT_ACTIVATION_IMPL_V1 spec explicitly defers "delivery obligation
  acknowledgement/transport protocol" to a later Slice F spec).

### 2.3 Current nodeVisit / state version source

svc `workflow_instances.workflow_state_version` (NOT NULL, CHECK >=1,
`migrations/0003_runtime.sql:19`); every workflow event forces
`event_sequence = new_version = old + 1` (DB CHECK). Read surface for DSH:
`workflow_instance_detail` (broker capability →
`GET /internal/v1/workflow-instances/{id}`) returns full detail with
`instance.workflow_state_version`, `instance.is_terminal`,
`current_node_visit_id` — exactly one read covers the progress probe.

### 2.4 Existing primitives census (Goal question 6)

| primitive | svc dispatch intent | DSH ledger attempt |
|---|---|---|
| dispatch attempt | none (no such concept server-side) | yes: attemptId |
| generation | none | none (single deterministic id) |
| lease | none (ledger header: "no leases, no retries, no heartbeat") | none |
| last_dispatch_at | none | partial: `delivered.atMs` |
| accepted_at | none | memory-only receipt, not persisted |
| state version | instance-level only (transition CAS) | not recorded at dispatch |
| retry count / reason | none | none |

### 2.5 svc transition fencing (Goal questions 7–8)

Present and strong (`transition_transaction.rs`):
- `expected_workflow_state_version` is mandatory (`dto.rs:47-52`,
  `deny_unknown_fields`); `SELECT … FOR UPDATE` on the instance row, then
  exact compare (`:171-178`) → HTTP 409 `workflow_state_version_conflict`
  on mismatch; second CAS on the projection UPDATE (`transition_helpers.rs:239`).
- Authorization = bare assignee compare against the CURRENT visit
  (`:211-213`); the transition command takes no node_visit_id — it operates
  on `instance.current_node_visit_id`.
- Open assistance fail-closes all transitions (`:216-227`) and every
  assistance state change bumps `workflow_state_version`
  (`assistance_transaction.rs:333-352`).
- Wake on an already-due intent is a durable no-op — 200 `wakeApplied=false`
  `ALREADY_DUE`, NO eligibility event, NO version bump
  (`wake_transaction.rs:355-371`). Wake therefore cannot serve stale
  re-entry, and equally does not need to be amended for it.

### 2.6 Zombie routes and why nothing recovers them

1. **Hung turn** (LLM call never returns, process alive): turn-deadline
   watch fires at `turnTimeoutMs` (prod 900s) →
   `markExecutionUnknown` → reconciliation record stays `state:'pending'`
   with `initialOutcome:'outcome_unknown'`, and an **unknown fence** is
   installed on the agent process (`turn-execution.js:383`, `:217`;
   `event-correlation.js:214-229`). Judgment
   (`workflow-execution/src/judgment.js:111`) maps `pending` →
   `ACTIVE/run_running` — forever. The attempt never becomes terminal.
2. **Turn ended without a transition** → reconcile settle probe says
   visit still current → terminal `NEEDS_REVIEW/run_ended_no_submission`
   (`judgment.js:128`).
3. Both classes are then suppressed forever by the §2.1 fence.
4. The ONE controlled recovery op, `recoverAttempt`
   (`workflow-execution/src/recovery.js:117`), refuses everything not in
   `resolution_blocked` phase: a delivered attempt →
   `RECOVERY_INAPPLICABLE delivery_domain:run_delivered`.
5. Control-plane restart moves hung attempts to
   `NEEDS_REVIEW/run_outcome_unknown` (memory-only records lost) — still
   never re-dispatched (terminal refusal, `ledger-events.js:56`).
6. The fence also blocks the agent process itself: after the deadline fires,
   every NEW prompt to that process is rejected
   `AGENT_PROCESS_TURN_FENCED` (`turn-execution.js:169-182`), until the turn
   outcome becomes known (stream terminal+idle or child real exit —
   `event-correlation.js:154`, `spawn.js:175` are the ONLY `releaseFence`
   call sites). A hung-forever turn = a fenced-forever session.

## 3. Findings required by the Goal

```text
CURRENT_DSH_MAIN_SHA = 1a1e59b8e41901c57beb8e5306a557350f56bfa9
CURRENT_SVC_WORKFLOW_MAIN_SHA = 8c78c8eef68aa2bb92aa66cb3379297a798e88c1

CURRENT_DISPATCH_SUPPRESSION_RULE =
  DSH-local ledger existence fence: nodeVisitId has ANY attempt
  (beginAttemptIfAbsent, ledger.js:256) → already_attempted, forever.
  svc keeps the intent due the whole time; suppression is 100% consumer-side.

CURRENT_ACCEPTED_SEMANTICS =
  router.deliver accepted:true = prompt entered the session inbox
  (transport admission only). In-memory receipt; never persisted; svc has
  no acceptance concept; no timeout, no lease, no expiry anywhere.

CURRENT_PROGRESS_SIGNAL =
  none consumed today for dispatch eligibility. The authoritative signals
  exist and are already read by the engine's settle probe: instance detail
  (current_node_visit_id + workflow_state_version + is_terminal) and the
  activation lifecycle (closure ends due-ness).

CURRENT_RETRY_MODEL =
  none. V2 non-goals forbid retry engines; recoverAttempt covers only
  pre-admission resolution_blocked; terminal attempts refuse appends.

ROOT_CAUSE =
  The one-attempt-per-NodeVisit fence is a PERMANENT lifetime invariant
  (V2 §1 frozen gates + deterministic attemptId + terminal refusal), while
  "accepted" is an unverifiable transport admission with no expiry and no
  progress obligation. An accepted-but-stalled run therefore wedges the
  visit out of dispatch eligibility permanently, with three compounding
  locks: (a) the fence, (b) no stale detection ever converts a hung run
  into a terminal verdict (pending→run_running forever), (c) the unknown
  fence keeps rejecting any new prompt to the same session even if a
  redispatch were attempted. Human re-dispatch (nudge or admin MOVE)
  is the only exit — exactly what happened on 44dee9da.

MISSING_PRIMITIVES =
  1. attempt generation (N-th dispatch for one nodeVisit) — absent in both
     repos (single deterministic attemptId).
  2. workflowStateVersionAtDispatch — absent; needed to evaluate "no
     workflow observable progress since that dispatch" (and it is what makes
     HUMAN_REQUIRED/RETURN/terminal exclusion mechanical: assistance ops,
     transitions and admin moves all bump the version or move the visit).
  3. stale settlement event + re-plan admission in the ledger — absent.
  4. a router control seam to settle-once a hung turn's reconciliation
     record and release its unknown fence — absent (fence release only
     happens from stream/exit observations).
  Nothing is missing on svc-workflow: the intent stays due, the version CAS
  fences stale in-flight transitions, and instance detail exposes the probe
  fields. SVC = NO_CHANGE_REQUIRED.
```

## 4. Fencing analysis (Goal §6)

`REDISPATCH_WITHOUT_FENCING_SAFE = YES (at the workflow data layer)` — with
the following precise meaning:

- If the NEW attempt commits a transition first, an old attempt's in-flight
  transition carries the old `expected_workflow_state_version` and is
  rejected 409 inside the `FOR UPDATE` lock (`transition_transaction.rs:171`).
  **STALE_ATTEMPT_REJECTED is already mechanically true.**
- If the OLD attempt's transition lands first (same assignee, same current
  visit, version still matching), it is a legitimate authorized business
  transition; it is not "overwriting the new attempt" because the new
  attempt has committed nothing yet. The engine's progress probe then sees
  the version move / visit close and stands down (no duplicate redispatch).
- Residual window (stale check passes, then old agent transitions between
  check and gen-2 delivery): the gen-2 prompt instructs the agent to read
  instance detail first; the agent's transition with a stale expected
  version 409s and it re-reads per broker guidance. No data corruption is
  reachable: every write path is version-CAS'd and single-current-visit.
- DSH additionally records `workflowStateVersionAtDispatch` per attempt so
  the stale decision is evidence-based, and the re-entry eligibility
  REQUIRES version-unchanged evidence (so redispatch never races a
  progressed workflow).

## 5. Progress definition (Goal §7)

Counted as progress (defeats stale re-entry, mechanically):
- any committed transition (version bump + visit move/closure),
- RETURN (closes the source visit; a new visit+activation takes over),
- HUMAN_REQUIRED / assistance state change (version bump; open assistance
  also fail-closes transitions),
- terminal / cancel / archive (is_terminal, cancelled, archived_at; the
  intent leaves the due feed).

NOT counted as progress (never defeats the stale clock):
- SEND_CONFIRMED / run_delivered, accepted receipt, session aliveness,
  model text, context reads, heartbeats. The engine does not consult any
  router liveness signal for staleness — only the delivered-at timestamp
  age and the svc business evidence. Heartbeat-style renewal cannot exist:
  nothing renews the clock.

## 6. Fair-aging / scheduler boundary (Goal §8–9)

Unaffected. Re-entry only restores eligibility of an already-dispatched
visit; ordering among eligible visits stays the existing due-feed order +
admission bound. No scheduler deployment, watchdog routing, launchd, or
filesystem ownership surface is touched; no new svc writer is introduced
(wake remains the only eligibility writer).

## 7. Real-incident replay: 44dee9da-c3d4-4beb-a7f7-f68edfceedcf

Read-only production evidence, live store
`svc_workflow_dogfood_clean` (svc-workflow 127.0.0.1:8989 backend), queried
2026-09-16 22:18 +08. The DSH-side ledger file is root-owned (LaunchDaemon
runtime) and was NOT read; the DB-side timeline is conclusive on its own.

Timeline (all UTC+8, from workflow_events / workflow_node_visits /
workflow_activations / workflow_activation_closures):

```text
09:01:55  INSTANCE_CREATED (v1)
09:23–10:26  v2..v7 transitions; activations closed TRANSITIONED each step
             (includes two RETURNS: revisits of 6407f2cf and 6a3de756)
10:26:48  visit 4a92031e (node 9cf62a61, num=1, assignee 9e3adced…) created;
          activation 31fbc5ba initial_next_eligible_at = 10:26:48 (due NOW)
10:26:48 → 17:30:46  ZERO events. workflow_state_version frozen at 7 for
          7h04m while the activation stayed open and continuously due.
17:30:46  v8 WORKFLOW_TRANSITION_COMMITTED, actor = 9e3adced… — the
          assignee agent itself, after the Owner's out-of-band "再派一次"
          request. No ADMIN_MOVE closure, no WAKE eligibility event, no
          assistance case: the recovery happened entirely outside any
          workflow mechanism.
17:30–20:15  v9..v12 further transitions/returns; current visit 40473711
          (node 7bf81899, num=4) created 20:15:10.
```

Old rule: from the moment the engine attempted visit 4a92031e (~10:27, the
poll is 30s), every sweep returned `already_attempted` — the intent stayed
due in the feed the entire 7h and was suppressed 100% by the local fence.

New rule (threshold 60m): first REENTRY_ELIGIBLE at ≈ **11:27**
(delivered_at + 60m with version-unchanged + visit-still-current + instance
active + no open assistance), gen-2 redispatch at the next poll — about
**6 hours earlier** than the human-driven recovery, with `dispatch_count=2`,
`retry_reason=stale_no_progress`, `last_dispatch_at` refreshed.

```text
REAL_INCIDENT_REPLAY = SUFFICIENT
  (DB-side evidence conclusive; DSH attempts.jsonl bytes unreadable by
  policy — delivery itself is evidenced by the assignee's own v8 commit
  after the Owner's re-dispatch request and by the Goal's incident record.)
```

Live observation at investigation time (not touched): current visit
40473711's activation had been due for 123 minutes with version frozen at
12 — the same fault pattern recurring in real time under the old rule.

## 8. svc-workflow: NO_CHANGE_REQUIRED

Evidence:
1. Suppression is consumer-side (§2.1); the intent never leaves the due set
   while the visit is current (`query_dispatch_intents.rs:161` predicate has
   no dispatch/ack concept to reset).
2. Old-attempt race fencing already exists: mandatory
   `expected_workflow_state_version` + `FOR UPDATE` + 409
   (§2.5) — satisfies Goal CASE 6 without any new writer.
3. Probe read surface exists: `workflow_instance_detail` carries
   `workflow_state_version`, `is_terminal`, `current_node_visit_id`
   (`query_types.rs:122,200-206`).
4. No migration, no new endpoint, no spec change on svc; wake stays the only
   eligibility writer (CTR-VAI-008), CTR-DKC-004 guarantee 1 untouched,
   CTR-VAI-013 additive-surface clause untouched.
