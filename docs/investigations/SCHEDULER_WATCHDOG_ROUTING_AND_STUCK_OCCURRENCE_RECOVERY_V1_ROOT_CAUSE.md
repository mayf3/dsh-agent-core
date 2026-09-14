---
investigation_id: SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1_ROOT_CAUSE
status: evidence-complete-source-side-live-census-blocked
date: 2026-09-14
evidence_head: 49a5d42c053401036550aac84d2427a61832a457
production_scheduler_mutation: none
implementation_authority: none
---

# Scheduler watchdog routing and stuck occurrence recovery — root cause investigation

## 0. Evidence boundary

This artifact records source-side facts from a fresh `origin/main` and the Owner-supplied
production symptom set. It is an Investigation, not a Spec: it does not authorize product code,
deployment, Scheduler store access, fence release, retry, or reconciliation.

```text
SOURCE_HEAD                         = 49a5d42c053401036550aac84d2427a61832a457
OWNER_REPORTED_NOTIFICATIONS        = 12
OWNER_REPORTED_DISTINCT_JOBS        = 6
OWNER_REPORTED_DISTINCT_OCCURRENCES = 6
PRODUCTION_SCHEDULER_MUTATION       = NO
DIRECT_PRODUCTION_STORE_ACCESS      = NO
FRESH_GLOBAL_CENSUS                 = BLOCKED_TOOL_UNAVAILABLE
```

The current Codex session exposes neither the formal global `scheduler` read surface nor an
operator/audit `self_ops` surface. The Scheduler skill forbids substituting shell, CLI, or direct
`jobs.json` access. Therefore this investigation does not claim that the Owner-supplied six are
still the complete live blocked set.

## 1. Confirmed root cause — unrelated Agent chat receives control-plane alerts

The W1/W2 host runner has exactly one user-visible destination:

```text
SCHEDULER_WATCHDOG_ALERT_TO
```

`scripts/scheduler-watchdog.mjs` reads that variable into one global `ALERT_TO` and sends every
W1/W2 notification to it through `im.message.create`. The W1 and W2 launchd templates describe the
same placeholder as `__OWNER_CHAT_ID__`. There is no source-side distinction among:

- normal business output;
- one Job's failure target;
- Scheduler control-plane incidents;
- durable ops-only fallback.

There is also no resolver that rejects current-session, last-active-session, creating-Agent, or
daily-thought fallback identities. If `ALERT_TO` is configured to the daily-thought group, all
watchdog findings go there by construction. The observed destination is consistent with this
single-sink design, but the exact live environment value remains unverified until a formal
production readback is available.

Normal Scheduler business delivery is a separate seam. `packages/scheduler-router/src/index.js`
maps `job.delivery.to` to Feishu delivery, so changing the watchdog control-plane route must not
change explicit business delivery.

```text
NOTIFICATION_ROUTING_ROOT_CAUSE = ONE_GLOBAL_WATCHDOG_CHAT_WITH_NO_ROUTE_CLASSIFICATION
LIVE_ALERT_TO_VALUE             = UNVERIFIED
```

## 2. Confirmed root cause — two notifications for one occurrence

`evaluateRunHealth()` intentionally emits both facts for the reported state:

1. `ADMISSION_BLOCKED_UNKNOWN` for an enabled Job with an `outcome_unknown` occurrence;
2. `EXPECTED_RUN_MISSED` when the next nominal slot is overdue while that fence blocks admission.

The facts are valid, but the alert lifecycle treats them as independent incidents. The current
`findingFingerprint()` includes the finding class:

```text
<finding.class>|<jobId>|<occurrenceId-or-runId>
```

Consequently the same `(jobId, occurrenceId)` produces two active fingerprints. The current
lifecycle also emits `reminder` after `SCHEDULER_WATCHDOG_REMINDER_MS` (default one hour), so an
unchanged unresolved occurrence is not permanently quiet after its first notification.

For the Owner-reported batch, the source behavior explains the arithmetic exactly:

```text
6 occurrences
x 2 symptom-class fingerprints
= 12 notifications
```

```text
DUPLICATE_ALERT_ROOT_CAUSE = DEDUPE_AFTER_SYMPTOM_CLASSIFICATION_WITH_CLASS_IN_KEY
```

The evidence/fact layer should continue recording both facts. The missing layer is a root-cause
incident compiler before user-visible lifecycle/dedupe.

## 3. Confirmed root cause — `outcome_unknown` can hold admission indefinitely

The occurrence authority correctly treats unresolved `outcome_unknown` as non-terminal. Fence
projection is rebuilt from unresolved unknown occurrences, and eligibility refuses a later
same-Job occurrence while a fence exists. This prevents duplicate unknown side effects.

The failure is not that a timeout is classified unknown. The failure is operational closure:

- age alone cannot prove termination;
- no automatic retry is safe;
- without trusted late outcome or exact termination evidence, the fence remains;
- current watchdog visibility is noisy and routed to a business chat rather than a canonical
  health/ops surface.

Current accepted V3 semantics already provide the safe positive path:

```text
trusted exact termination without business outcome
-> occurrence business state remains outcome_unknown
-> terminationSettlement = terminated_without_outcome
-> fence released
-> old occurrence never retried
-> recurring Job continues at the next future natural slot only
```

Therefore this Goal must not introduce `outcome_unknown -> failed` coercion, timeout-based fence
release, or replay. If termination is not proven, the safe disposition is a visible quarantined
health/incident state while the fence remains. `QUARANTINED_UNKNOWN` should be a health/incident
projection, not a new occurrence execution outcome.

```text
OUTCOME_UNKNOWN_ROOT_CAUSE = SAFE_FENCE_WITHOUT_COMPLETE_VISIBLE_RECONCILIATION_LIFECYCLE
```

## 4. Confirmed product gap — no all-enabled health census

The authenticated Product API currently exposes:

- `GET /scheduler/runs`;
- `GET /scheduler/runs/{run_id}`;
- `GET /scheduler/occurrences/{occurrence_id}`.

It does not expose a canonical all-enabled Job health view. The generic `/health` endpoint proves
runtime service health, not per-Job schedule, credential, route, occurrence, or fence health.

The W1 detector emits findings but does not produce one normalized row for every enabled Job. Its
desired-state manifest intentionally covers critical inventory, not the complete enabled fleet.
Thus neither ordinary watchdog messages nor the current history API can answer, in one read:

> Which enabled jobs are healthy, which are broken, and why?

```text
ALL_ENABLED_JOB_HEALTH_SURFACE = ABSENT
UNKNOWN_JOB_HEALTH_COUNT       = UNPROVEN
```

## 5. Confirmed product gap — startup readiness is incomplete

Production composition creates the Scheduler over the canonical layout and mounts credential and
history seams. W1 separately probes store readability, a global credential-file existence check,
desired-state validity, and runtime HTTP health.

There is no single startup projection that proves all of the following together before declaring
Scheduler readiness:

- every enabled schedule is computable;
- every enabled target Agent has credential readiness;
- every notification route resolves without a forbidden chat fallback;
- admission/occurrence authority is readable and internally consistent;
- runtime/store provenance matches the canonical expected pair.

The present `/health` response therefore cannot establish end-to-end Scheduler readiness.

## 6. Current six — evidence level

The Owner supplied these exact occurrence suffixes:

```text
ca63d1bcd40d255b
644e53e01ce45828
bf0a2f0c67e3dc7f
1c430519aa95c4d0
7fbd2602038a9f1b
8d03136579df49a1
```

For each, the current evidence proves only:

```text
OWNER_REPORTED_FINDINGS = EXPECTED_RUN_MISSED + ADMISSION_BLOCKED_UNKNOWN
FRESH_RUN_LEDGER_READ    = NOT_AVAILABLE
SIDE_EFFECT_EVIDENCE     = NOT_YET_READ
RECONCILIATION_RESULT    = NOT_YET_DETERMINED
SAFE_TO_RELEASE_FENCE    = NOT_YET_DETERMINED
SAFE_TO_RUN_NEXT         = NOT_YET_DETERMINED
```

No occurrence may be reconciled from the alert text alone.

## 7. Authority census

Relevant accepted authorities on fresh main:

- `SCHEDULER_CONTROL_PLANE_RELIABILITY_V1`: W1/W2, detection, Owner alerting,
  desired-state and credential visibility;
- `SCHEDULER_FAILURE_DISPOSITION_ALERT_LIFECYCLE_V1`: fact/incident separation and formal
  acknowledgment lifecycle;
- `SCHEDULER_OCCURRENCE_OUTCOME_V3` + `SCHEDULER_TIMEOUT_OUTCOME_V3`: exact termination-only
  settlement, unknown preservation, safe fence release;
- `AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V3`: caller-owned `self_ops` status/reconcile boundary;
- `AGENT_CORE_SCHEDULER_RUN_HISTORY_V1`: authenticated Scheduler run/occurrence read surface.

None freezes the complete requested contract for:

- business/job-failure/control-plane route separation;
- missing alert-target fallback to a canonical ops surface;
- symptom facts collapsed into one root-cause incident;
- zero identical reminder for an unchanged occurrence;
- a complete all-enabled Job health census;
- startup route/credential/provenance self-check.

```text
EXISTING_ACCEPTED_SPEC_SUFFICIENT = NO
NEW_OR_AMENDED_SPEC_REQUIRED      = YES
IMPLEMENTATION_ALLOWED_NOW        = NO
```

## 8. Source baseline

Fresh isolated worktree:

```text
WORKTREE = /Users/yanfenma/workspace/worktrees/scheduler-watchdog-routing-stuck-recovery-v1
BRANCH   = codex/scheduler-watchdog-routing-stuck-recovery-v1
HEAD     = 49a5d42c053401036550aac84d2427a61832a457
```

Relevant baseline tests:

```text
SCHEDULER_TESTS        = PASS 252/252
SCHEDULER_ROUTER_TESTS = PASS 22/22
SCHEDULER_API_AUTH     = PASS 33/33
```

The repository-wide test command is not green on this fresh install because the repository does
not install several existing integration/private dependencies (`@agent-core/workspace-bootstrap`,
`@deepseek-ai/dsh-tools`, `@larksuite/channel`) and has host-dependent audio/native-closure tests.
Those failures predate this Goal and are not evidence about Scheduler behavior. They must remain a
separate baseline limitation; focused green suites cannot be used to claim repository-wide green.

## 9. Next gates

1. Owner confirms the unresolved-unknown quarantine invariant: no termination proof means the
   same-Job fence remains.
2. Author a governing Spec that freezes routing, incident, health, startup, reconciliation
   projection, persistence, authorization, rollout, and the full regression matrix.
3. Independent exact-head Spec review and Owner acceptance.
4. Emit `DEVELOPMENT_PREFLIGHT`; only then begin TDD implementation in this isolated worktree.
5. Keep production mutation at NO until the independent root transaction is resolved and the
   production slot is free.
6. Obtain a formal global read surface, run the fresh census, and reconcile the six only from
   exact trusted evidence.

