---
spec_id: SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1
status: proposed
date: 2026-09-14
spec_kind: implementation
authority_level: governing_spec
authority_action: SUPERSEDE
implementation_authority: none
production_apply_authority: none
owner_direction: APPROVE_RECOMMENDED_DESIGN (2026-09-14)
independent_spec_review: PASS by /root/spec_semantic_review at 63d59b52858ef1f8b41f26ff7a36443185fcd7d9; blockers none
independent_safety_review: PASS by /root/spec_safety_review at 63d59b52858ef1f8b41f26ff7a36443185fcd7d9; blockers none
owners:
  - mayf3
  - repository-maintainers
scope:
  - scheduler-watchdog
  - scheduler-health-readback
  - scheduler-notification-routing
  - scheduler-unknown-occurrence-reconciliation
  - product-api-scheduler-health
governed_by:
  - AGENT_CORE_PRODUCT_ARCHITECTURE_V1
  - SCHEDULER_OCCURRENCE_OUTCOME_V3
  - SCHEDULER_TIMEOUT_OUTCOME_V3
external_authorities: []
compatible_with:
  - SCHEDULER_CONTROL_PLANE_RELIABILITY_V1
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3
  - AGENT_CORE_SCHEDULER_RUN_HISTORY_V1
supersedes:
  - SCHEDULER_FAILURE_DISPOSITION_ALERT_LIFECYCLE_V1
superseded_by: null
references:
  - docs/investigations/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_ROOT_CAUSE.md
  - docs/investigations/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_DESIGN.md
  - docs/reports/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_OWNER_DECISION.md
  - docs/reviews/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_REVIEWS.md
---

# SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1

## 0. Authority state

```text
SPEC_STATUS                         = proposed
OWNER_DESIGN_DIRECTION_APPROVED     = YES
READY_FOR_INDEPENDENT_REVIEW        = YES
IMPLEMENTATION_ALLOWED              = NO
PRODUCTION_DEPLOY_ALLOWED           = NO
PRODUCTION_STORE_MUTATION_ALLOWED   = NO
FENCE_RELEASE_ALLOWED               = NO
CURRENT_SIX_RECONCILIATION_ALLOWED  = NO
```

This Spec freezes the selected design for review. Acceptance, implementation, deployment, and
production reconciliation are distinct gates. While proposed, it changes no standing runtime
behavior. The Owner authorized completing this Spec, candidate implementation planning,
test/design refinement and independent exact-head review only.

## 1. Goal

The product MUST make every enabled Scheduler Job's health queryable, keep unknown execution safe,
compile symptoms into one root-cause incident, and route each notification class only to an
authorized destination.

## 2. Scope and non-goals

In scope:

- same-Job fencing and first-class `QUARANTINED_UNKNOWN` health;
- four-result reconciliation classification;
- fact-to-root-cause incident compilation and no identical repeat notification;
- business/job-failure/control-plane route separation;
- complete enabled-job health/readback and startup readiness;
- candidate code/test plan and controlled production/recovery plans.

Out of scope and forbidden:

- changing `outcome_unknown` into failure from age/timeout;
- blind retry, catch-up, or replay of an unknown occurrence;
- global Scheduler or unrelated-Job fencing;
- detector fact suppression or audit/history rewriting;
- session/chat-derived notification fallback;
- direct raw-store or ad-hoc shell mutation;
- any current production deployment, route edit, fence release, or mutation of the six reported
  occurrences.

## 3. Authority and dependencies

### 3.1 Preserved authorities

`SCHEDULER_OCCURRENCE_OUTCOME_V3` and `SCHEDULER_TIMEOUT_OUTCOME_V3` remain current for occurrence,
outcome, retry, fence, exact-termination and reconciliation mutation semantics. This Spec adds no
new mutation surface. `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3` retains caller-owned access and
authorization boundaries. `AGENT_CORE_SCHEDULER_RUN_HISTORY_V1` retains authenticated history
semantics and is extended only by the health read contract below.

`SCHEDULER_CONTROL_PLANE_RELIABILITY_V1` keeps pure detection, desired-state monitoring, W1/W2
liveness, direct Feishu alerting, fail-loud park/nonzero behavior and Owner-visible proactive
alerting. `CTR-ROUTE-001` is a new compatible destination-selection constraint: its canonical ops
target MUST itself remain Owner-visible. Delegates MAY administer that Owner-visible surface but
delegate-only visibility is forbidden. This does not remove
or weaken the predecessor's alert audience, channel, detectors or delivery-failure obligations.

### 3.2 Whole-Spec successor

This Spec is the complete successor to `SCHEDULER_FAILURE_DISPOSITION_ALERT_LIFECYCLE_V1` because
the prior `NEW -> bounded REMINDER -> closure` rule conflicts with the Owner's new no-repeat rule.
Upon acceptance, the prior Spec MUST atomically become superseded with mutual backlinks. Until that
transaction, the prior Spec remains current and this proposal has no runtime authority.

The successor preserves and restates all prior load-bearing invariants:

```text
failure fact is durable and never rewritten
detectors emit facts without disposition-dependent suppression
formal disposition may acknowledge/close an incident
acknowledgment or recovery produces exactly one closure transition notification
new occurrenceId produces a new incident normally
audit/occurrence ledger mutation by alert lifecycle is forbidden
```

The only replaced semantic is user-visible reminder behavior:

```text
OLD: unchanged open incident may emit bounded REMINDER
NEW: unchanged state and unchanged escalation level emit no repeated user alert
```

## 4. Current State

- `STATE-001` — Source candidate is fresh `origin/main`
  `49a5d42c053401036550aac84d2427a61832a457`, in the isolated authoring worktree, observed
  2026-09-14. Basis: `OBS-001`, `EVD-001`.
- `STATE-002` — Production notification configuration, complete enabled-Job census and current-six
  occurrence evidence are unverified in this task because no formal global Scheduler audit/read
  surface is exposed. Basis: `OBS-004`, `EVD-004`.
- `STATE-003` — Current production mutation authority for this Goal is none. Basis: the Owner
  mandate recorded in `OBS-005`.

These statements describe coordinates; they do not create runtime or product authority.

## 5. Observations

### OBS-001 — Exact source baseline

- Subject: repository Scheduler/watchdog source.
- Source revision: `49a5d42c053401036550aac84d2427a61832a457`.
- Environment: isolated local Git worktree.
- Observed at: 2026-09-14 Asia/Shanghai.
- Method: fresh fetch, exact commit resolution and source/test inspection.
- Result: source behaviors below are present at that revision.
- Provenance: referenced root-cause investigation §§1–5.

### OBS-002 — One global watchdog destination and two symptom fingerprints

- Subject: watchdog runner, detectors and lifecycle.
- Source revision: `49a5d42c053401036550aac84d2427a61832a457`.
- Environment: repository source and focused local tests.
- Observed at: 2026-09-14 Asia/Shanghai.
- Method: inspect `scripts/scheduler-watchdog.mjs` and `packages/scheduler/src/watchdog.js`.
- Result: one `SCHEDULER_WATCHDOG_ALERT_TO` receives W1/W2; `EXPECTED_RUN_MISSED` and
  `ADMISSION_BLOCKED_UNKNOWN` are emitted and fingerprinted separately; unchanged alerts may
  generate hourly reminders.
- Provenance: root-cause investigation §§1–2.

### OBS-003 — Existing occurrence authority preserves unknown safely

- Subject: accepted Scheduler occurrence/reconciliation semantics and implementation.
- Source revision: `49a5d42c053401036550aac84d2427a61832a457`.
- Environment: repository authority and source.
- Observed at: 2026-09-14 Asia/Shanghai.
- Method: inspect D-009, Timeout V3, occurrence model, eligibility and reconciliation paths.
- Result: unresolved unknown retains a same-Job fence; trusted exact termination-only settlement
  can release it without rewriting business outcome or replaying the old occurrence.
- Provenance: root-cause investigation §3 and referenced accepted authorities.

### OBS-004 — Complete fleet health and live six-row evidence are unavailable

- Subject: current authenticated Scheduler Product API/tool surface.
- Source revision: `49a5d42c053401036550aac84d2427a61832a457`.
- Environment: current Codex tool inventory plus repository source.
- Observed at: 2026-09-14 Asia/Shanghai.
- Method: inspect routes and available formal scheduler/self-ops tools; do not substitute raw-store
  or shell access.
- Result: no all-enabled health endpoint or formal global audit tool is callable in this task.
- Provenance: root-cause investigation §§4 and 6.

### OBS-005 — Owner design and mutation boundary

- Subject: `SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1` mandate.
- Source revision: Owner decision message dated 2026-09-14.
- Environment: this authoring task.
- Observed at: 2026-09-14 Asia/Shanghai.
- Method: direct Owner ruling.
- Result: recommended design and independent review are approved; production deployment/store
  mutation/fence release/current-six mutation remain explicitly unauthorized.
- Provenance:
  `docs/reports/SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_OWNER_DECISION.md`;
  no secret-bearing runtime material.

## 6. Claims and assumptions

### CLM-001 — Symptom-level dedupe causes duplicate user incidents

- Support state: SUPPORTED.
- Supported by evidence: `EVD-001`.
- Contradicted by evidence: none known.
- Uncertainty: exact live destination value is not proven; source mechanism is proven.

### CLM-002 — Root-cause compilation can remove duplicate alerts without suppressing facts

- Support state: SUPPORTED.
- Supported by evidence: `EVD-002`.
- Contradicted by evidence: none known.
- Uncertainty: implementation conformance remains future work.

### CLM-003 — Same-Job quarantine is the only safe default without termination proof

- Support state: SUPPORTED.
- Supported by evidence: `EVD-003`.
- Contradicted by evidence: none known.
- Uncertainty: each of the six live occurrences still needs exact evidence classification.

There are no `OPEN_ASSUMPTION` items that alter Contract meaning.

## 7. Evidence relations

### EVD-001 — Source observations support the routing/dedupe root-cause claim

- Source observations: `OBS-001`, `OBS-002`.
- Target: `CLM-001`.
- Relation: SUPPORTS.
- Bound coordinates: repository source at
  `49a5d42c053401036550aac84d2427a61832a457`, inspected 2026-09-14.
- Strength/sufficiency: strong for source mechanism and candidate design need.
- Limitations: does not establish the exact current production environment value or current count.
- Provenance: root-cause investigation §§1–2 plus focused baseline tests recorded there.

### EVD-002 — Layer separation supports root-cause compilation

- Source observations: `OBS-002`, `OBS-003`.
- Target: `CLM-002`.
- Relation: SUPPORTS.
- Bound coordinates: accepted authority and repository source at the baseline in `OBS-001`.
- Strength/sufficiency: strong for preserving detector facts while changing incident identity.
- Limitations: candidate tests and production canary have not run.
- Provenance: root-cause investigation §§2–3 and prior accepted lifecycle Spec.

### EVD-003 — Existing occurrence authority supports same-Job quarantine

- Source observations: `OBS-003`, `OBS-005`.
- Target: `CLM-003`.
- Relation: SUPPORTS.
- Bound coordinates: accepted D-009/Timeout V3 in the baseline plus Owner ruling 2026-09-14.
- Strength/sufficiency: strong for the normative safe default.
- Limitations: no classification of the six current occurrences is implied.
- Provenance: root-cause investigation §3 and the persisted Owner decision record in `OBS-005`.

### EVD-004 — Tool/route census supports the current evidence gap

- Source observations: `OBS-004`.
- Target: `STATE-002`.
- Relation: SUPPORTS.
- Bound coordinates: source/tool inventory inspected 2026-09-14.
- Strength/sufficiency: strong for this task's access boundary.
- Limitations: does not claim the production state itself is unhealthy or unchanged.
- Provenance: root-cause investigation §§4 and 6.

## 8. Decisions

### DEC-001 — Preserve same-Job fence under unproven termination

- Decision owner: mayf3.
- Decision: project `QUARANTINED_UNKNOWN` and retain only the exact same-Job fence.
- Rejected alternative: timeout-derived failure/release or global admission fence.
- Reason: avoid duplicate side effects without stopping unrelated work.

### DEC-002 — Compile root cause before user-visible lifecycle

- Decision owner: mayf3.
- Decision: retain all detector facts but create one incident per exact
  `(jobId, occurrenceId, rootCauseClass)` and no unchanged repeat alert.
- Rejected alternative: symptom-class fingerprints plus periodic reminders.
- Reason: one actionable cause must not look like multiple failures.

### DEC-003 — Use three disjoint routing classes

- Decision owner: mayf3.
- Decision: separate business output, Job failure and Scheduler control-plane destinations, with a
  deployment-owned canonical ops target.
- Rejected alternative: one global business chat or session-derived fallback.
- Reason: routing ownership follows message meaning and remains auditable.

### DEC-004 — Make health a canonical product surface

- Decision owner: mayf3.
- Decision: one pure complete projector serves startup, watchdog, authenticated API and read tools.
- Rejected alternative: discover stuck Jobs only through chat alerts or ad-hoc store inspection.
- Reason: health must be queryable, consistent and safe during incident delivery failure.

### DEC-005 — Keep reconciliation evidence-based and mutation-compatible

- Decision owner: mayf3.
- Decision: use the exact four-result classifier while preserving existing V3 mutation paths.
- Rejected alternative: manufacture failure, add a new mutation operation, or bulk clear fences.
- Reason: unknown external side effects require proof before release.

## 9. Contracts

### 9.1 Normative definitions

```text
FACT                       = detector observation retained in durable evidence
INCIDENT                   = root-cause-oriented user/operator state compiled from facts
ROUTE_CLASS                = BUSINESS_OUTPUT | JOB_FAILURE | SCHEDULER_CONTROL_PLANE_INCIDENT
SAME_JOB_FENCE             = admission fence keyed by exact jobId/occurrence authority
QUARANTINED_UNKNOWN        = health/incident projection; not an execution outcome
MATERIAL_TRANSITION        = open, separately authorized severity escalation,
                             reconciliation-state change, acknowledgment closure,
                             natural-recovery closure, or a new incident episode
CANONICAL_OPS_TARGET       = deployment-owned dedicated Scheduler ops destination
COMPLETE_CENSUS            = one classified row for every enabled Job from one consistent source snapshot
```

### CTR-FENCE-001 — Unknown preserves only the exact Job fence

If exact termination is not proven, an `outcome_unknown` occurrence MUST retain its existing
same-Job admission fence. The fence MUST prevent only later overlapping occurrences of the same
exact `jobId`. It MUST NOT block unrelated jobs, unrelated agents, global Scheduler admission,
watchdog execution, startup diagnostics, or health/readback.

```text
UNPROVEN_TERMINATION        -> NO_BLIND_RETRY
UNPROVEN_TERMINATION        -> NO_AUTOMATIC_FENCE_RELEASE
FENCE_SCOPE                 = SAME_JOB_ONLY
GLOBAL_SCHEDULER_FENCE      = FORBIDDEN
```

Fence lookup and projection MUST remain keyed by exact Job/occurrence authority; Agent identity,
name, logicalKey similarity, notification target, or shared runtime MUST NOT widen its scope.

### CTR-QUARANTINE-001 — First-class visible health state

When bounded reconciliation cannot prove business success, business failure, exact termination, or
fresh current execution, the Job MUST project:

```text
state = QUARANTINED_UNKNOWN
```

The authoritative occurrence remains `outcome_unknown` and the same-Job fence remains. Health MUST
expose at least:

```text
jobId occurrenceId state blockedSince lastReconciliationAt
lastKnownExecutionEvidence fenceReason nextExpectedAt alertState
```

`nextExpectedAt` is the next nominal schedule opportunity, not proof that admission will occur
while the fence remains. `lastKnownExecutionEvidence` MUST be structured, source-qualified,
timestamped and secret-safe; missing evidence MUST be explicit. `alertState` MUST be structured as
`{lifecycle, delivery, incidentKey, lastTransitionAt}` where lifecycle is
`OPEN|CLOSED_ACKNOWLEDGED|CLOSED_RECOVERED` and delivery is
`PENDING|DELIVERED|FAILED|OUTCOME_UNKNOWN`; transport failure MUST NOT be
confused with lifecycle closure. The state is durable across watchdog/runtime restart and queryable
without relying on chat delivery.

### CTR-RECON-001 — Ordered settlement dispatch and exact four-result classifier

Reconciliation MUST first validate exact identity, evidence provenance/freshness and cross-source
coherence. Any identity mismatch or mutually conflicting trusted evidence is zero-write and enters
`QUARANTINED_UNKNOWN`. Coherent evidence is dispatched in this exact order:

1. trusted exact business outcome enters the four-result classifier as success or failure;
2. otherwise, trusted exact current-epoch termination without business outcome is handled by the
   existing V3 termination-only settlement seam and does not enter the classifier;
3. otherwise, the remaining evidence enters the classifier for current liveness or quarantine.

The classifier's input domain therefore excludes a validated termination-only disposition and it
MUST return exactly one of these four results:

1. `RECONCILED_SUCCESS`: trusted exact business success closes the occurrence as success and
   removes only this occurrence's fence contribution.
2. `RECONCILED_FAILURE`: trusted exact business failure closes the occurrence as failure and
   removes only this occurrence's fence contribution; later scheduling/retry follows existing
   normal contracts.
3. `STILL_IN_FLIGHT`: trusted exact fresh execution evidence proves the occurrence remains live;
   keep the fence.
4. `QUARANTINED_UNKNOWN`: bounded sources are exhausted without trusted proof of outcome,
   termination, or current liveness; preserve `outcome_unknown`, keep the same-Job fence, record
   durable health degradation, and open/update one deduplicated incident.

After any success, failure or termination-only settlement, the aggregate same-Job fence clears only
when no other unresolved unknown occurrence for that exact Job retains a fence contribution. A
second unresolved unknown MUST keep the Job fenced.

Age/timeout MAY trigger classification. It MUST NOT itself
prove failure, success, termination, or current execution. Conflicting, stale, cross-occurrence, or
identity-incomplete evidence MUST NOT release a fence.

The ordered termination-only branch records `terminated_without_outcome`, leaves business outcome
unknown, removes only that occurrence's fence contribution because continuation is impossible,
never retries the old occurrence, and permits the next future natural occurrence only if no other
same-Job fence contribution remains. A late business outcome available at classification time wins
the first branch; a trusted late business outcome arriving after termination settlement follows
accepted V3 late-settlement semantics without replay.

### CTR-INCIDENT-001 — Root-cause compilation before lifecycle

Detector facts remain independently recorded. Before user-visible lifecycle/dedupe:

```text
ADMISSION_BLOCKED_UNKNOWN(jobId, occurrenceId)
+ EXPECTED_RUN_MISSED(jobId, derivedUnderAdmissionBlock=true)
-> RUN_STUCK_OUTCOME_UNKNOWN(jobId, occurrenceId)
```

The second fact appears in incident detail as a symptom. It MUST NOT create a second incident.
Root-cause identity for occurrence-bound incidents is the exact tuple:

```text
(jobId, occurrenceId, rootCauseClass)
```

No grouping by suffix, Job name, Agent, chat, or time window is permitted. A new occurrenceId is a
new incident even for the same Job/root cause. Facts which do not share exact root-cause identity
remain distinct incidents.

Every incident has a closed canonical root identity:

```text
occurrence-bound = (rootCauseClass, jobId, occurrenceId)
job-bound        = (rootCauseClass, jobId, jobRevision)
control-plane    = (rootCauseClass, subjectKind, stableSubjectId)
```

`stableSubjectId` is a fixed configured/runtime identity such as `watchdog:w1`, `watchdog:w2`,
`scheduler-runtime`, `canonical-store`, or `alert-routing`; tick timestamp and message text are
forbidden identity inputs. One root identity initializes durable `episode=1` on first open and
increments it only on `CLOSED_* -> OPEN`; `incidentId=(rootIdentity,episode)`. Repeated ticks in one episode cannot create
a new incident. Occurrence-bound incidents never reopen after a terminal disposition; a later
occurrence uses its new occurrenceId.

### CTR-ALERT-001 — Durable no-repeat lifecycle

For one incident identity, first opening MUST create exactly one durable logical notification intent
when a valid authorized route exists. With unchanged state and escalation level:

```text
REPEATED_USER_ALERT = NO
```

Permitted later logical notifications are limited to material transitions defined in §3. Age alone,
tick time, log offset, render text, or delivery-attempt count is not material. This V1 defines no
elapsed-age severity threshold. A future severity threshold requires separately accepted,
versioned Product Authority; crossing an authorized threshold may emit once per level.

Lifecycle is exact:

```text
OPEN -> CLOSED_ACKNOWLEDGED   # formal disposition; exactly one acknowledged transition intent
OPEN -> CLOSED_RECOVERED      # fact naturally disappears; exactly one recovery transition intent
```

`CLOSED_ACKNOWLEDGED` consumes the closure: later disappearance is silent. There is never both an
acknowledgment and recovery notification for one episode. A closed occurrence-bound incident cannot
reopen; a recurrent non-occurrence root cause opens the next monotonic episode.

Each material transition has deterministic
`notificationKey=hex(sha256(UTF8(canonical-json-v1({incidentId,transitionRevision,
transitionKind,routeClass}))))`; canonical JSON recursively sorts object keys, preserves array
order and inserts no insignificant whitespace. Incident state and
an outbox intent containing that key MUST commit atomically and durably before external I/O. Delivery
MUST pass the same key to an adapter/downstream that proves idempotent acceptance. A crash or
ambiguous response replays only the same key/payload; it MUST NOT mint a new transition, key, incident
or user-visible duplicate. Definitive delivery failure is durable in `alertState` and health. If a
valid route is unavailable, the intent remains durably failed/pending in the local ops sink and
delivery fails loud; becoming valid is a material routing transition that retries the same logical
opening intent, not a second opening.

No adapter lacking demonstrable end-to-end idempotency may cross the production gate. The lifecycle
never changes detector facts, execution outcome, fence state or audit history.

### CTR-ROUTE-001 — Three disjoint notification classes

1. `BUSINESS_OUTPUT` MUST use only the Job's explicitly configured `job.delivery` target.
2. `JOB_FAILURE` MUST resolve in order: explicit stable-`logicalKey` failure target, Job owner
   target, canonical Scheduler ops target. Falling to ops MUST set a durable per-Job
   `alertTargetMissing` health marker.
3. `SCHEDULER_CONTROL_PLANE_INCIDENT` MUST use only the canonical Scheduler ops target. That target
   MUST be a dedicated surface directly visible to the Owner. Delegates MAY administer the same
   Owner-visible surface, but a delegate-only destination is invalid. A durable
   local sink supplements delivery failure but does not replace proactive Owner visibility.

The versioned routing manifest is deployment-owned, outside the Job store, validated before use,
and joined by exact stable `logicalKey`/owner identity. Owner identity for V1 is the Job's exact
persisted `agentId`; no new Job owner field is introduced. The closed manifest shape is:

```json
{
  "version": 1,
  "canonicalOpsTarget": { "channel": "feishu", "to": "<non-empty target>" },
  "ownerTargets": {
    "<exact agentId>": { "channel": "feishu", "to": "<non-empty target>" }
  },
  "jobFailureTargets": {
    "<exact logicalKey>": { "channel": "feishu", "to": "<non-empty target>" }
  }
}
```

All three top-level maps/objects are required; the two override maps MAY be empty. Unknown fields,
duplicate normalized keys, unsupported versions/channels and empty destinations fail validation.
The runtime layout resolves one absolute routing-manifest path; environment may select that path
but MUST NOT supply an alternate destination or fallback. Secrets and target identifiers MUST NOT
be committed or emitted unredacted in evidence.

Production file controls are mandatory: the manifest MUST be a regular non-symlink file owned by
the deployment authority, readable only by the exact W1/W2 runtime principals (maximum mode `0640`),
and every parent directory MUST reject group/world writes. Incident/outbox authority, lock and local
ops sink MUST be regular non-symlink files in a runtime-owned `0700` directory with maximum mode
`0600`. Readers MUST use no-follow/open-then-fstat identity checks; writers MUST lock, write a same-
filesystem temporary file, fsync file and directory, and atomically rename. Ownership, mode, file
type, resolved path and content hash are read back without exposing target values. Any mismatch
fails route/readiness closed and leaves watchdog/health diagnostic reads available.

The resolver MUST NOT accept these as inputs or fallbacks:

```text
daily-thought-agent group
随想记录员所在群
current chat
last active session
creating session
arbitrary business Agent session
job.delivery for control-plane incidents
```

If canonical ops routing is missing/invalid, the incident MUST enter the durable local Scheduler
ops sink, delivery MUST fail loud, and health MUST mark configuration missing. No forbidden fallback
is allowed. Routing failure MUST NOT stop watchdog or health/readback.

### CTR-HEALTH-001 — Canonical complete enabled-Job surface

One pure health projector MUST be the semantic source for watchdog, startup readiness, Product API,
and scheduler read tools. It consumes one consistent snapshot of Job/occurrence/fence state,
history, credentials, routing/incident state and runtime/store provenance.

Snapshot acquisition MUST bind every independently mutable source to a stable generation token
(authoritative document revision or content hash; append-only history may use its locked inode/size/
tail-hash generation). One attempt reads all start tokens, captures and validates all sources, then
re-reads all end tokens. It may return `complete=true` only when every required token is available,
all start/end tokens match, and runtime/store provenance identifies one canonical pair. On drift it
retries the entire acquisition at most two times; a third drift or a source without a trustworthy
token returns `complete=false`, projects affected rows `UNKNOWN`, and fails startup readiness. It
MUST NOT combine generations into a purported state or report `unknown=0` from a torn snapshot.
Tokens/hashes stay internal or are secret-safe in the response.

It MUST return:

```text
enabled healthy degraded blocked unknown complete generatedAt
```

If the canonical Job document is unreadable or lacks a trustworthy stable generation, it cannot
enumerate the fleet: `complete=false`, the five counts are `null`, rows are empty, and a secret-safe
`censusError` identifies the failed source. It MUST NOT report zeros. If the Job document is stable
but another required source is incomplete, it still emits one row per enabled Job, marks affected
rows `UNKNOWN`, and keeps integer counts.

and one row per enabled Job containing at least:

```text
jobId logicalKey agentId health
lastExpectedAt lastStartAt lastFinishAt lastSuccessAt lastOutcome
currentOccurrence currentBlocker blockedSince blockedAgeMs
lastReconciliationAt lastKnownExecutionEvidence fenceReason
credentialReadiness nextExpectedAt notificationRoute alertState runtime store
```

`currentOccurrence` MUST include exact `occurrenceId` and projected state when present.
`notificationRoute` MUST include `{class, source, status, targetRef}` where `source` is
`job_delivery|job_failure_override|owner|canonical_ops|local_ops_sink`, `status` exposes missing or
invalid configuration, and `targetRef` is a stable secret-safe label rather than a raw target ID.

Primary `health` is exclusive: `BLOCKED` when admission is currently impossible because this Job
has an active fence or required credential is unavailable; `DEGRADED` for a non-blocking schedule,
route, recent run or runtime/store defect; `UNKNOWN` when required evidence is incomplete; otherwise
`HEALTHY`. Whenever counts are integers, they MUST satisfy:

```text
healthy + degraded + blocked + unknown = enabled
```

Diagnostic counters MAY overlap. Incomplete/unreadable/split-brain input MUST set `complete=false`
and MUST NOT manufacture `unknown=0`. Full Goal acceptance requires a fresh complete census with
`unknown=0`.

Global `scheduler.audit` may read the complete fleet. `scheduler.read` MUST be structurally limited
to the bound Agent's rows. Auth verification MUST occur before health projection/lookup. Product API
MUST expose authenticated `GET /scheduler/health`; no mutating HTTP route is authorized.

### CTR-READY-001 — Startup self-check without fleet-wide admission coupling

Startup MUST use the canonical projector to verify canonical runtime/store provenance, readable
occurrence/fence authority, computable schedules, credential readiness and routing readiness.
Global source/provenance ambiguity fails readiness closed. A Job-local blocked/degraded state MUST
remain isolated to that Job and MUST NOT stop unrelated admission. Watchdog and authenticated
health/readback MUST remain operable when Job health is degraded or blocked.

Startup readiness, per-Job health, and actual execution admission are separate outputs; an unhealthy
Job row does not authorize mutation or broad process shutdown.

### CTR-DURABILITY-001 — State and restart behavior

Routing configuration and incident lifecycle state MUST be separate from the Job/occurrence store.
Writes MUST be atomic/locked under existing repository patterns. Restart MUST preserve open incident
identity, notification idempotency, escalation level, reconciliation timestamp, delivery state and
closure state. Corrupt/unsupported state fails loud and degrades health; it MUST NOT reset dedupe,
release a fence, or disable unrelated Jobs.

Cutover from the predecessor fingerprint state is a read-only-to-Scheduler, versioned incident-state
migration under a frozen snapshot of old alert state, watchdog evidence and current compiled facts:

1. map every legacy active/acknowledged/retired fingerprint to exactly one new canonical root
   identity; the two unknown-occurrence symptoms map to one incident;
2. use delivery evidence, never `notifiedCount` alone: any proven delivered member seeds the combined
   opening as `DELIVERED` and MUST NOT re-alert; all members proven failed/parked seed one pending new
   keyed intent; acknowledged maps to `CLOSED_ACKNOWLEDGED`; retired-without-current-fact maps to
   `CLOSED_RECOVERED`;
3. any zero/multiple identity match, missing/ambiguous delivery evidence, corrupt predecessor state,
   or source-generation drift aborts cutover with old state byte-preserved and health/readiness
   failed—no blanket delivered seed and no empty reset;
4. write the new state atomically, retain a hash-addressed backup of predecessor state/evidence, then
   read back every active incident/key/status before enabling new delivery.

Migration MUST NOT change a Job, occurrence, fence, schedule, detector fact or delivery target. A
crash before commit resumes old behavior; after commit, replay reads the new durable outbox and uses
the same notification keys.

## 10. Acceptance

### 10.1 Required candidate test matrix

Every test injects time, stores and I/O; no production endpoint or store is used.

```text
T01 six occurrences x two symptoms -> exactly six root-cause incidents
T02 one quarantined Job -> unrelated Job admits/runs normally
T03 same Job later overlapping occurrence -> blocked while termination unproven
T04 QUARANTINED_UNKNOWN restart -> fence and one incident persist
T05 age/timeout alone -> never RECONCILED_FAILURE and never fence release
T06 trusted success -> RECONCILED_SUCCESS, close, exact fence release
T07 trusted failure -> RECONCILED_FAILURE, close, exact fence release
T08 trusted fresh live evidence -> STILL_IN_FLIGHT and fence retained
T09 exhausted/ambiguous/stale/conflicting evidence -> QUARANTINED_UNKNOWN
T10 unchanged incident across ticks/restart -> no repeated user alert
T11 material escalation/acknowledgment/recovery -> exactly one transition alert each
T12 business output, Job failure and control-plane incident resolve to their allowed routes only
T13 missing Job/owner route -> canonical ops + durable config marker; no business/session fallback
T14 missing canonical ops route -> durable local incident + degraded health + fail-loud delivery
T15 complete health census -> one row per enabled Job and exclusive counts sum to enabled
T16 health row exposes every CTR-HEALTH/CTR-QUARANTINE required field with secret-safe projection
T17 scheduler.read cannot see foreign rows; scheduler.audit can; auth gate runs first
T18 invalid schedule/credential missing/runtime-store mismatch -> deterministic health/readiness
T19 health/watchdog remain readable/runnable with one quarantined Job
T20 exact termination-only settlement -> old occurrence not replayed; next future natural slot only
T21 notification transport retry uses stable idempotency key and creates no duplicate logical alert
T22 disabled/unrelated Agent/Job does not inherit another Job's fence or incident
T23 two unknowns on one Job; settling either by success/failure/termination removes only its
    contribution and aggregate fence remains until the other settles
T24 ordered evidence dispatch covers success, failure, termination-only, live, unknown and every
    conflict; exactly one path wins and negative/conflict paths are zero-write
T25 occurrence/job/control-plane identity is stable across ticks; only closed non-occurrence
    recurrence increments episode
T26 crash before/after intent commit, send acceptance and delivered commit -> same notificationKey,
    payload and one downstream-visible message
T27 populated legacy active/acknowledged/retired migration, paired-symptom collapse, delivered/
    failed/ambiguous evidence and crash resume obey CTR-DURABILITY
T28 malformed/truncated/unsupported incident state, torn atomic write and concurrent writer ->
    fail loud, degraded health, preserved dedupe/fence and unrelated admission
T29 mutation injected between start/capture/end token for every mutable health source -> bounded
    full retry or complete=false; torn snapshot never returns unknown=0
T30 routing/incident path symlink, owner/group/mode/type/parent-write/extended-ACL mismatch -> fail
    closed with secret-safe readback and no forbidden delivery
T31 every new incident with valid route -> exactly one opening intent; invalid route -> durable
    failed/pending intent, nonzero delivery outcome and visible health
T32 acknowledgment closes exactly once and suppresses later recovery; natural recovery closes once
    when no acknowledgment occurred
T33 unreadable/untokened Job document -> complete=false, null counts, empty rows and censusError;
    readable Jobs plus missing secondary source -> complete fleet rows with affected UNKNOWN
T34 tracked executable path census after watchdog move -> zero old-path consumers; package and root
    test globs execute every moved watchdog test; preflight/postrepair resolve the new path
```

Mandatory acceptance headline:

```text
SAME_JOB_FENCE_ONLY       = YES
UNRELATED_JOB_ISOLATION   = PASS
```

### ACC-FENCE-001 — Same-Job isolation

- Contracts: `CTR-FENCE-001`, `CTR-QUARANTINE-001`, `CTR-RECON-001`.
- Method: unit/state-machine tests T02–T09, T19–T20 and T23–T24 with injected
  restart/evidence conflicts.
- Environment: hermetic candidate test stores and fake runtimes; no production access.
- Required evidence: exact implementation/spec heads, executed command/output, transition rows,
  store diffs proving only the target fence changes when authorized.
- Expected result: unknown keeps only its Job fenced; all four classifier outcomes match evidence.
- Failure condition: age-derived result, cross-Job block, replay, unproven release, or missing health.

### ACC-INCIDENT-001 — One root cause and no unchanged repeat

- Contracts: `CTR-INCIDENT-001`, `CTR-ALERT-001`, `CTR-DURABILITY-001`.
- Method: tests T01, T04, T10–T11, T21 and T25–T28/T31–T32 across repeated ticks,
  migration, corruption, crash points and process restart.
- Environment: hermetic clocks, incident store and delivery fake.
- Required evidence: exact heads, executed output, incident keys/state revisions and delivery
  idempotency records.
- Expected result: six paired facts create six incidents; only material transitions notify once.
- Failure condition: symptom duplicate, unchanged reminder, restart duplicate, fact suppression or
  history mutation.

### ACC-ROUTE-001 — Route confinement and missing-target behavior

- Contracts: `CTR-ROUTE-001`, `CTR-DURABILITY-001`.
- Method: table/failure-injection tests T12–T14, T21, T26 and T30–T31 over every
  precedence/fallback, permission and transport-crash branch.
- Environment: hermetic manifest and delivery fake with forbidden destinations instrumented.
- Required evidence: executed output, normalized route decisions, zero calls to forbidden sinks,
  durable configuration/delivery state.
- Expected result: each class reaches only allowed targets; missing routes remain durable/fail-loud.
- Failure condition: business/session fallback, silent loss, secret exposure, or watchdog/readback stop.

### ACC-HEALTH-001 — Complete, access-controlled health/readiness

- Contracts: `CTR-HEALTH-001`, `CTR-READY-001`, `CTR-QUARANTINE-001`.
- Method: tests T15–T19, T22, T29–T30 and T33 plus Product API auth-first integration tests.
- Environment: hermetic fleet snapshot, credential/routing/runtime/store fakes.
- Required evidence: executed output, exact response schema, count equation, authorization call order,
  self/audit result comparison and failure projections.
- Expected result: every enabled Job has one complete secret-safe row; isolation and auth hold.
- Failure condition: omitted/duplicated row, fabricated unknown zero, foreign disclosure, readiness
  divergence, or Job-local defect stopping global admission/readback.

### ACC-GOV-001 — Docs-first lifecycle and authority boundary

- Contracts: every `CTR-*` in this Spec.
- Method: exact-head independent semantic/compatibility and safety/failure-mode reviews, Spec syntax
  and transition checks, plus candidate diff scope review and executable path census T34 before
  implementation.
- Environment: repository exact candidate/base heads; read-only production boundary.
- Required evidence: reviewer identities/heads/verdicts/blockers, validation outputs, Owner acceptance
  record and atomic successor backlinks if accepted.
- Expected result: both reviews PASS, blockers none, no implementation or production mutation before
  the required gates.
- Failure condition: partial supersession, unresolved conflict/TBD, unauthorized mutation, or a
  Contract without executable acceptance coverage.

## 11. Alternatives and disposition

- `ALT-001` — Keep symptom fingerprints and tune reminder interval: rejected; it preserves duplicate
  incidents and makes silence depend on timing.
- `ALT-002` — Release fences after a maximum age: rejected; age cannot prove termination or absence
  of external side effects.
- `ALT-003` — Stop the whole Scheduler while any Job is unknown: rejected; it violates exact
  same-Job isolation and increases blast radius.
- `ALT-004` — Send every failure to `job.delivery` or current chat: rejected; business and control
  ownership differ and session-derived routes are unstable.
- `ALT-005` — Store route/incident state inside the Job document: rejected; it couples ordinary Job
  mutation to control-plane ownership and recovery evidence.

## 12. Migration, compatibility, and rollback

### 12.1 Candidate implementation scope

After this Spec is accepted in the integration base and a new implementation mandate is granted,
the candidate MAY change only the following planned surfaces, subject to fresh preflight/mechanical
census:

```text
packages/scheduler/src/watchdog/
packages/scheduler/src/watchdog.js -> packages/scheduler/src/watchdog/index.js (move; no retained root file)
packages/scheduler/src/index.js
packages/scheduler/test/watchdog.test.js -> packages/scheduler/test/watchdog/watchdog.test.js
packages/scheduler/test/watchdog-templates.test.js -> packages/scheduler/test/watchdog/templates.test.js
packages/scheduler/test/alert-dedupe.test.js -> packages/scheduler/test/watchdog/alert-dedupe.test.js
packages/scheduler/test/disposition-alert-lifecycle.test.js -> packages/scheduler/test/watchdog/disposition-alert-lifecycle.test.js
packages/scheduler/test/watchdog/*.test.js
packages/product-api/src/scheduler-health-routes.js
packages/product-api/src/scheduler-routes.js
packages/product-api/test/scheduler-health*.test.js
scripts/scheduler-watchdog.mjs
scripts/scheduler-cp-preflight.mjs
scripts/scheduler-cp-postrepair.mjs
packages/production-runtime/src/scheduler/health-runtime.js
packages/production-runtime/src/paths.js
minimal non-growing runtime wiring proven necessary by fresh census
deployment templates/config schema for the external routing manifest
```

The move removes the existing root watchdog file before adding its directory; moving all four root
watchdog tests likewise avoids net root-child growth. The host runner, preflight and postrepair
scripts MUST update their exact source-path references in the same candidate. A static tracked-file
census MUST prove no executable consumer retains `packages/scheduler/src/watchdog.js` or
`../src/watchdog.js`; docs/history references are excluded. The existing production-runtime
`scheduler/` directory is reused. The implementation MUST use focused modules, keep every new file within
structure limits, add no structure-registry exception, and avoid growth of grandfathered files.
Any new mutation operation,
Job schema field, public scope, secret-bearing Git config, broad runtime refactor, or change to
occurrence/retry semantics is an expansion trigger requiring re-preflight and authority review.

### 12.2 Production migration and rollback contract (not currently authorized)

Any future production execution requires a separate exact mandate and serialized mutation slot.
The packet MUST bind candidate artifact hashes, integration base, live preimage, actor, canonical
runtime/store, routing-config preimage, incident-state preimage, aborts, rollback bytes and receipts.

Required order:

1. deploy verified code and deployment-owned route config without changing Job delivery,
   occurrences or fences;
2. read back exact runtime/store/config provenance and complete enabled-job census;
3. run one new disposable side-effect-free canary, never one of the six unknown occurrences;
4. prove route/health and unrelated admission from the canary; prove dedupe and same-Job fence by
   passive readback plus read-only replay of a frozen real quarantined snapshot—no synthetic
   incident and no forced `outcome_unknown`;
5. accept or roll back code/config atomically; preserve incident evidence and Job/occurrence store.

Abort on drift, incomplete census, route leakage, duplicate incident, any unrelated admission impact,
health/readback loss, unexpected Scheduler store delta, or lost rollback ability. Rollback MUST NOT
release a fence, rewrite an occurrence, delete evidence, or retry work.

### 12.3 Current-six recovery contract (not currently authorized)

The six suffixes are evidence locators only, never mutation identities:

```text
ca63d1bcd40d255b  644e53e01ce45828  bf0a2f0c67e3dc7f
1c430519aa95c4d0  7fbd2602038a9f1b  8d03136579df49a1
```

A future read phase MUST resolve each to exactly one full occurrenceId/jobId and collect current
occurrence, fence, run/session, side-effect, credential, route and runtime evidence through formal
authenticated surfaces. Zero/multiple matches, stale target, unavailable authority, conflicting
evidence, or changed live preimage aborts. Alert text and age are insufficient evidence.

For each row, first apply `CTR-RECON-001` evidence validation and ordered dispatch: coherent exact
termination-only evidence goes to the preserved V3 settlement seam and does not enter the four-result
classifier; every remaining row receives exactly one of the four results. Conflict is
`QUARANTINED_UNKNOWN` and zero-write. Any later mutation is sequential and separately receipted. One Owner-selected evidence-backed row
is canary; after exact post-state acceptance, remaining rows proceed one at a time. `QUARANTINED_UNKNOWN`
rows remain fenced. Bulk clear, blind replay, manufactured failure, manual raw-store edits and
automatic fence release are forbidden.

### 12.4 Acceptance and implementation gates

Before Owner Spec acceptance:

```text
independent semantic/compatibility review exact HEAD = PASS
independent safety/failure-mode review exact HEAD     = PASS
review blocker union                                 = NONE
```

Acceptance MUST atomically record the exact reviewed head, change this Spec to accepted, activate
`implementation_authority: contracts` only if the Owner explicitly grants it, and mark
`SCHEDULER_FAILURE_DISPOSITION_ALERT_LIFECYCLE_V1` superseded with mutual backlinks. Production
apply authority remains none unless explicitly granted; candidate verification never implies
production authorization.

Full product completion additionally requires candidate tests, independent implementation review,
serialized production deployment receipts, a fresh complete health census, canary proof, and
individually evidence-backed disposition of all six occurrences. Health checks alone are not E2E
acceptance.

### 12.5 Independent review questions

Both reviewers MUST bind answers to one exact commit and report blockers explicitly.

```text
R1 Does QUARANTINED_UNKNOWN preserve outcome uncertainty and the same-Job fence?
R2 Are age-, timeout-, ambiguity-, route-based and cross-occurrence fence releases impossible?
R3 Is unrelated-Job/Agent/global admission isolation mechanically testable?
R4 Are fact, incident, notification attempt and route layers non-conflated?
R5 Is more than one logical incident or unchanged user alert impossible for one root cause episode?
R6 Is every business/current/session-derived control-plane fallback mechanically impossible?
R7 Is missing routing durable, visible and non-silent without stopping health/watchdog?
R8 Is the health census complete, access-controlled, consistent and non-fabricating?
R9 Are ordered termination dispatch and the four classifier results exhaustive, exclusive and evidence-based?
R10 Are prior fact/detector/closure/audit invariants preserved by the successor?
R11 Are production migration, non-synthetic canary, rollback and current-six sequencing safe and unambiguous?
R12 Does the proposed state authorize zero implementation/production mutation today?
```

Any `NO` or `UNPROVEN` is `REVISE`; only all `YES` with `BLOCKERS=[]` is `PASS`.

## 13. Open questions

```text
OPEN_OWNER_DECISIONS          = NONE
NORMATIVE_TBD                 = NONE
UNRESOLVED_AUTHORITY_CONFLICT = NONE
PARTIAL_SUPERSESSION          = NONE
```

Non-normative production coordinates remain intentionally unknown until authorized preflight:
exact canonical ops target, live runtime/store generation, full enabled census, current mutation
slot holder, canary identity and current-six evidence. These values cannot change the Contracts;
they are required future execution inputs and absence today authorizes no operation.
