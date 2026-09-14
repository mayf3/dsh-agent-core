---
record_id: SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_OWNER_DECISION
record_kind: owner-decision-and-execution-mandate
status: recorded
date: 2026-09-14
owner: mayf3
recorded_by: /root
production_mutation: forbidden
---

# Owner decision record — Scheduler watchdog routing and stuck occurrence recovery V1

## 1. Provenance and legal effect

This is the secret-safe repository record of the direct Owner instruction received in the Codex
task on 2026-09-14. `/root` is the recorder, not the decision maker. The Owner is `mayf3`.

The instruction approves the recommended design direction and authorizes only:

- completion of the governing Spec and design documents;
- candidate implementation planning and test/design refinement;
- independent semantic, safety, failure-mode and accepted-Spec compatibility review of the exact
  Spec HEAD;
- ordinary review-driven Spec revisions without a separate Owner round for every edit.

It does not itself accept the proposed Spec or authorize implementation, merge, deployment,
production store/config mutation, fence release, retry, or current-six reconciliation mutation.

## 2. Frozen Owner rulings

```text
OWNER_DECISION                         = APPROVE_RECOMMENDED_DESIGN
QUARANTINED_UNKNOWN                    = APPROVED
UNPROVEN_TERMINATION                   = NO_BLIND_RETRY + NO_AUTOMATIC_FENCE_RELEASE
FENCE_SCOPE                            = SAME_JOB_ONLY
GLOBAL_SCHEDULER_FENCE                 = FORBIDDEN
REPEATED_USER_ALERT_WHILE_UNCHANGED    = NO
INDEPENDENT_SPEC_REVIEW                = YES
PRODUCTION_MUTATION                    = NO
```

`QUARANTINED_UNKNOWN` must be a first-class queryable health state with Job/occurrence identity,
blocked/reconciliation/evidence/fence/next-schedule/alert fields. It keeps the exact same-Job fence
when termination is unproven and must not block unrelated Jobs, Agents, Scheduler-wide admission,
watchdog, health or readback.

The reconciliation model is exactly:

```text
RECONCILED_SUCCESS
RECONCILED_FAILURE
STILL_IN_FLIGHT
QUARANTINED_UNKNOWN
```

Age/timeout alone never implies failure. Success/failure closes the occurrence and removes that
occurrence's fence contribution; in-flight and quarantined preserve it. Existing accepted exact
termination-only semantics remain authoritative.

For one exact `(jobId, occurrenceId, rootCause)`, symptom facts such as
`EXPECTED_RUN_MISSED` and `ADMISSION_BLOCKED_UNKNOWN` compile into one user-visible root-cause
incident, for example `RUN_STUCK_OUTCOME_UNKNOWN`. An unchanged state produces no repeated user
alert; a material state or escalation-level change may notify.

Notification classes are disjoint:

```text
BUSINESS_OUTPUT                    -> Job configured delivery target
JOB_FAILURE                       -> Job owner / explicit failure target
SCHEDULER_CONTROL_PLANE_INCIDENT  -> dedicated Scheduler ops target / durable incident surface
```

Missing failure target falls to the canonical Scheduler ops sink and creates a visible health
configuration marker. Daily-thought/scratch-agent chats, current chat, last active session and
arbitrary business Agent sessions are forbidden fallbacks.

The canonical health surface must report fleet totals (`enabled`, `healthy`, `degraded`, `blocked`)
and, for every enabled Job, schedule/run/outcome/occurrence/blocker/age/credential/route/runtime/store
state sufficient to answer which Jobs are healthy or broken and why.

## 3. Explicitly withheld authority

```text
PRODUCTION_DEPLOY_AUTHORIZED                     = NO
PRODUCTION_STORE_MUTATION_AUTHORIZED             = NO
PRODUCTION_NOTIFICATION_ROUTE_MUTATION_AUTHORIZED = NO
FENCE_RELEASE_AUTHORIZED                         = NO
CURRENT_SIX_RECONCILIATION_MUTATION_AUTHORIZED   = NO
```

The current six must not be cleared, released, retried, replayed or reconciled by mutation in this
stage. The next Owner gate is one consolidated exact-head packet after both independent reviews
PASS with `BLOCKERS=NONE`; it must not be split into repeated gates.

## 4. Done when for this authoring mandate

```text
governing Spec and design are complete
exact-head semantic/compatibility review = PASS
exact-head safety/failure-mode review = PASS
blocker union = NONE
one consolidated Owner review packet is returned
no product or production mutation occurred
```

