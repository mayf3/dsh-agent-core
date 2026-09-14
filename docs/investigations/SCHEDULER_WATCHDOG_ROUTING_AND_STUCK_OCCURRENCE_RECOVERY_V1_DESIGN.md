---
design_id: SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_DESIGN
status: owner-direction-approved
date: 2026-09-14
source_head: 49a5d42c053401036550aac84d2427a61832a457
owner_decision: APPROVE_RECOMMENDED_DESIGN (2026-09-14)
production_mutation: forbidden
implementation_authority: none
---

# Scheduler watchdog routing and stuck occurrence recovery — design

## 0. Boundary

This document explains the design selected by the Owner. Normative product authority lives only
in `docs/specs/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1.md`. This design does not
authorize code, deployment, production configuration, Scheduler store access, fence release,
retry, or reconciliation of the six reported occurrences.

```text
OWNER_DIRECTION_APPROVED             = YES
PRODUCTION_MUTATION                   = NO
CURRENT_SIX_RECONCILIATION_MUTATION   = NO
BLIND_RETRY                           = FORBIDDEN
GLOBAL_SCHEDULER_FENCE                = FORBIDDEN
```

## 1. Selected architecture

The system is split into four explicit layers:

```text
authoritative Scheduler state + runtime evidence
  -> pure per-job health projection and detector facts
  -> root-cause incident compiler + durable lifecycle
  -> route-class-specific delivery
```

Facts remain complete and append-only. Incidents answer which root cause a user must act on.
Routes answer who should receive that incident. Health exposes both current state and evidence
without requiring a notification to have been delivered.

This separation fixes the observed failure mode without weakening occurrence authority:

- `EXPECTED_RUN_MISSED` remains a fact;
- `ADMISSION_BLOCKED_UNKNOWN` remains a fact;
- when both describe the same fenced occurrence, they compile to one
  `RUN_STUCK_OUTCOME_UNKNOWN` incident;
- the occurrence remains `outcome_unknown` unless an existing authorized reconciliation path
  obtains trusted outcome or exact termination evidence;
- the same Job remains fenced while termination is unproven; every unrelated Job remains
  eligible under its own independent fence projection.

## 2. Routing model

### 2.1 Route classes

| Class | Source | Destination |
|---|---|---|
| `BUSINESS_OUTPUT` | normal Job execution output | `job.delivery` only |
| `JOB_FAILURE` | occurrence failure or job-local incident | explicit logical-key failure target, else owner target, else canonical ops target |
| `SCHEDULER_CONTROL_PLANE_INCIDENT` | watchdog/runtime/store/routing/readiness incident | canonical Scheduler ops target only |

Neither the incident compiler nor route resolver receives current chat, last active session,
creating session, arbitrary Agent session, or business delivery as fallback inputs. This makes
forbidden fallback mechanically unavailable rather than merely discouraged.

### 2.2 Deployment-owned routing manifest

Routing is stored outside the Scheduler Job document so control-plane ownership cannot be
silently changed through ordinary Job mutation. The candidate format is:

```json
{
  "version": 1,
  "canonicalOpsTarget": { "channel": "feishu", "to": "<ops-target>" },
  "ownerTargets": {
    "<ownerAgentId>": { "channel": "feishu", "to": "<owner-target>" }
  },
  "jobFailureTargets": {
    "<stable-logicalKey>": { "channel": "feishu", "to": "<failure-target>" }
  }
}
```

Examples contain placeholders only; real identifiers remain outside Git and must be redacted in
receipts. `logicalKey`, not name, is the Job join key. Unknown fields, empty destinations,
unsupported channels, an unsupported version, or duplicate normalized keys fail validation.

If a Job-specific or owner failure route is absent, `JOB_FAILURE` goes to the canonical ops target
and health records `alertTargetMissing=true`. If the canonical target itself is absent or invalid,
the incident is durably recorded in the local incident sink, delivery fails loud, and Scheduler
health is degraded. It never falls back to a business chat.

The canonical ops target itself remains Owner-visible, preserving the accepted proactive-alert
obligation; delegates may administer it but delegate-only visibility is invalid. Production routing config is a root/deployer-owned regular
file readable only by W1/W2; incident/outbox state is runtime-owned under a `0700` directory with
`0600` files. No-follow/open-then-fstat checks, non-writable parents, atomic rename and fsync are
required; permission/type/path/hash readback exposes no raw destination.

## 3. Root-cause incident compiler and lifecycle

The detector continues to emit independent facts. A pure compiler groups current facts before
the user-visible lifecycle:

```text
ADMISSION_BLOCKED_UNKNOWN(jobId, occurrenceId)
+ EXPECTED_RUN_MISSED(jobId, derivedUnderAdmissionBlock=true)
-> RUN_STUCK_OUTCOME_UNKNOWN(jobId, occurrenceId)
   symptoms=[ADMISSION_BLOCKED_UNKNOWN, EXPECTED_RUN_MISSED]
```

Occurrence-bound root identity is:

```text
rootIdentity = rootCauseClass + jobId + occurrenceId
```

Job-bound and control-plane roots use stable Job revision or configured/runtime subject identity;
tick time and message text never participate. A durable episode counter starts at one and increments
only after a closed non-occurrence root recurs. The same incident episode produces one open incident. Repeated detector ticks append evidence/readback but
produce no repeated user notification while state and escalation level are unchanged. A new
notification is permitted only for one of these material transitions:

- first opening;
- severity escalation caused by a separately accepted, versioned threshold;
- a different reconciliation state;
- formal-disposition acknowledgment closure;
- natural-recovery closure when no acknowledgment already consumed the episode;
- recurrence under a new occurrenceId.

This V1 defines no elapsed-age severity threshold, so age alone cannot escalate or notify.
Changing only detector tick time, evidence log offset, delivery attempt count, or message rendering
is not a material transition. A failed delivery remains visible in durable health and may be
retried by bounded transport policy, but it does not create a second logical incident.

Every material transition is first committed with a deterministic notification key in the same
atomic incident/outbox document, then sent through an adapter which proves downstream idempotency.
Ambiguous delivery replays only the identical key and payload. This closes the send/commit crash
window without inventing a new incident or transition.

## 4. Unknown occurrence model

`QUARANTINED_UNKNOWN` is a health and incident projection, not a new execution outcome and not a
termination claim. It means all available bounded evidence is insufficient to prove either a
business outcome, exact termination, or current in-flight execution.

```text
UNPROVEN_TERMINATION
-> occurrence outcome remains outcome_unknown
-> exact same-Job admission fence remains
-> no replay and no automatic next occurrence
-> unrelated Jobs and watchdog/readback remain operational
```

Reconciliation first validates all identity/provenance/coherence constraints. Coherent trusted
business outcome enters the classifier first; otherwise coherent trusted exact termination uses the
existing V3 termination-only seam before the classifier; all remaining evidence enters the
classifier. Conflicts are zero-write quarantine. The classifier returns exactly one of:

| Result | Required evidence | Effect |
|---|---|---|
| `RECONCILED_SUCCESS` | trusted exact business success | close success; release same-Job fence |
| `RECONCILED_FAILURE` | trusted exact business failure | close failure; release fence; later behavior follows normal schedule/retry contract |
| `STILL_IN_FLIGHT` | trusted, exact, fresh evidence that this execution is live | preserve occurrence and same-Job fence |
| `QUARANTINED_UNKNOWN` | bounded sources exhausted; no trusted proof of outcome, termination, or current liveness | preserve `outcome_unknown`, same-Job fence, durable degradation and one incident |

Success/failure/termination settlement removes only that occurrence's fence contribution; another
unresolved unknown for the same Job keeps the aggregate fence active. Age/timeout selects when to
reconcile; it never selects a reconciliation result.
Existing V3 exact-termination-only settlement remains the only no-business-outcome release path:
it preserves `outcome_unknown`, records `terminated_without_outcome`, proves the old execution
cannot continue, and permits only the next future natural occurrence. It never replays the old
occurrence.

## 5. Canonical health projection

One pure projector consumes a single consistent snapshot of:

- Job definitions, occurrence records and fences;
- run/history evidence;
- credential readiness by target Agent;
- validated routing manifest and incident ledger;
- runtime and store provenance;
- an injected `nowMs`.

Snapshot acquisition reads start/end generation tokens for every independently mutable source and
may declare complete only when every token matches; it retries the whole acquisition at most twice,
then returns incomplete/unknown rather than combining torn generations. It emits one row for every enabled Job and a summary. The same projector is used by watchdog,
startup readiness, Product API, and audit/self read surfaces so those faces cannot invent
different health meanings.

Primary row health is exclusive:

- `BLOCKED`: admission cannot proceed now because the exact Job has an active occurrence fence or
  required credential is unavailable;
- `DEGRADED`: execution is not currently blocked, but schedule, route, recent failure/miss, or
  runtime/store readiness is unhealthy;
- `UNKNOWN`: required evidence for classification could not be read completely;
- `HEALTHY`: none of the above.

Summary `healthy + degraded + blocked + unknown = enabled`. Diagnostic counters may overlap.
An unreadable or split-brain source returns `complete=false`; it must not manufacture zero unknown.
If the Job document itself is unreadable, even `enabled` is unknowable: counts are null, rows empty,
and a source-qualified census error is returned. If Jobs are readable but another source is not,
every enabled row remains present and affected rows become `UNKNOWN`.

Every row includes:

```text
jobId logicalKey agentId health
lastExpectedAt lastStartAt lastFinishAt lastSuccessAt lastOutcome
currentOccurrence currentBlocker blockedSince blockedAgeMs
lastReconciliationAt lastKnownExecutionEvidence fenceReason
credentialReadiness nextExpectedAt
notificationRoute alertState runtime store
```

For `QUARANTINED_UNKNOWN`, `currentOccurrence` carries `occurrenceId` and
`state=QUARANTINED_UNKNOWN`. `alertState` is structured as
`{lifecycle: OPEN|CLOSED_ACKNOWLEDGED|CLOSED_RECOVERED,
delivery: PENDING|DELIVERED|FAILED|OUTCOME_UNKNOWN, incidentKey, lastTransitionAt}` so transport
failure is not confused with lifecycle closure. Sensitive route
values and provenance identifiers are redacted or represented by stable non-secret labels at
model-facing/self scope.

Global `scheduler.audit` receives the complete enabled fleet. `scheduler.read` receives only rows
owned by its bound Agent. The authenticated Product API exposes `GET /scheduler/health` under the
same gate-before-handler rule as existing Scheduler history routes.

## 6. Startup/readiness behavior

Startup and W1 both run the projector. Readiness requires one readable canonical store/runtime
pair, valid schedules for all enabled Jobs, readable occurrence/fence authority, known credential
readiness, a valid canonical ops route, and a complete health projection. Job-local degraded or
blocked rows are exposed without stopping unrelated Jobs. Global source/provenance ambiguity makes
the readiness projection fail closed, but health/readback and watchdog stay available for
diagnosis.

## 7. Candidate implementation shape

Implementation is deliberately split into focused modules; the detector moves to
`watchdog/index.js` and is not expanded into a mixed I/O monolith.

```text
packages/scheduler/src/watchdog/incident-compiler.js   pure fact -> incident compilation
packages/scheduler/src/watchdog/incident-lifecycle.js  durable state transition model
packages/scheduler/src/watchdog/routing.js             manifest validation/resolution
packages/scheduler/src/watchdog/health.js              fleet/job projection
packages/scheduler/src/watchdog/reconciliation.js      four-state evidence classifier
packages/scheduler/src/watchdog/index.js               moved detector + focused exports
packages/scheduler/src/index.js                        public exports
packages/scheduler/test/watchdog/*.test.js             four moved existing + focused contract tests
packages/product-api/src/scheduler-health-routes.js    health response adapter
packages/product-api/src/scheduler-routes.js           authenticated dispatch integration
scripts/scheduler-watchdog.mjs                         host I/O over the pure modules
scripts/scheduler-cp-preflight.mjs                     relocated watchdog-path census
scripts/scheduler-cp-postrepair.mjs                    relocated watchdog copy/readback path
packages/production-runtime/src/scheduler/health-runtime.js  runtime/store/credential seams
packages/production-runtime/src/paths.js               external config/state locations
```

Because both Scheduler `src/` and `test/` are already at the 20-child cap, implementation replaces
root `src/watchdog.js` with `src/watchdog/index.js`; it moves `watchdog.test.js`,
`watchdog-templates.test.js`, `alert-dedupe.test.js`, and
`disposition-alert-lifecycle.test.js` into the new test directory and updates exact imports. The
host runner and both control-plane preflight/postrepair scripts are the complete executable path
consumer census and move to the new source path. A static census test rejects any remaining
executable reference to `packages/scheduler/src/watchdog.js` or `../src/watchdog.js`. The plan does
not retain both file and directory or add a net root child. The production runtime reuses its
existing `src/scheduler/` directory.

Before implementation, the accepted Spec must be in the integration base and a fresh
`DEVELOPMENT_PREFLIGHT` must freeze the exact changed-path closure. Any necessary change to the
grandfathered `packages/production-runtime/src/compose.js` must be an extraction or non-growing
adapter change and pass the repository structure verifier; the plan grants no registry exception.

## 8. Production migration plan (design only)

1. Build and verify candidate bytes with unit/failure-injection tests; no production access.
2. Produce redacted, deployment-owned routing manifest and permissions; do not alter Job delivery.
3. Under a frozen old-state/evidence/current-fact snapshot, map predecessor active/acknowledged/
   retired fingerprints into canonical incidents: proven-delivered paired symptoms become one
   delivered opening with no re-alert; all-proven-failed delivery becomes one new keyed pending
   intent; any ambiguous identity/delivery evidence aborts with old state preserved.
4. Deploy code/config and migrated incident state in the existing serialized production mutation
   slot with exact artifact and preimage receipts; change no occurrences/fences.
5. Read back runtime/store/config provenance and the complete enabled-job health census.
6. Run one new disposable, side-effect-free canary Job proving route/health and unrelated-Job
   admission while a naturally existing quarantined Job remains fenced. Prove incident compilation
   and no-repeat through read-only replay of a frozen real snapshot; never manufacture unknown or
   use the canary to mutate any of the six occurrences.
7. Abort and roll back code/config together on route leakage, census incompleteness, source drift,
   global admission effect, duplicate incident, or health/readback failure.
8. Only after canary acceptance may a separately authorized six-occurrence recovery packet begin.

Rollback restores the exact previous code/config bytes and preserves the new incident evidence;
it never rewrites the Scheduler Job/occurrence store and never releases a fence.

## 9. Current-six recovery plan (design only)

For suffixes `ca63d1bcd40d255b`, `644e53e01ce45828`, `bf0a2f0c67e3dc7f`,
`1c430519aa95c4d0`, `7fbd2602038a9f1b`, and `8d03136579df49a1`:

1. Use formal authenticated read surfaces to resolve each suffix to one exact full occurrenceId,
   jobId, agentId, run/session coordinates and current fence. Zero or multiple matches abort.
2. Read run ledger, Router/session completion, external side-effect receipts, process/lease/runtime
   evidence and any trusted late outcome. Record gaps rather than infer.
3. Apply ordered dispatch independently: coherent business outcome enters the four-state classifier;
   otherwise coherent exact termination uses the preserved termination-only seam before the
   classifier; remaining evidence receives exactly one four-state result. Conflicts quarantine and
   write nothing. Age alone is never evidence.
4. First mutation candidate must be one Owner-selected canary whose trusted evidence supports the
   exact existing reconciliation operation. Apply once, read back occurrence, fence, audit,
   incident, health and next-natural schedule; abort on any mismatch.
5. Process remaining rows sequentially only after canary acceptance. Never bulk clear, replay, or
   release. A `QUARANTINED_UNKNOWN` row remains fenced and visible.

No step in this section is currently authorized for production mutation.
