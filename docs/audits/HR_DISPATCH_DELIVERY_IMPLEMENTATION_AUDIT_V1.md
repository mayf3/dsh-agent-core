# HR_DISPATCH_DELIVERY_READINESS_V1 — implementation audit record

ONE independent implementation audit executed 2026-09-05 (read-only auditor
agent_a62b06ae) across the three implementation branches, after all three
authority candidates were Owner-accepted and merged. This record is the
durable transcript; it is not itself acceptance authority and authorizes no
production action.

## Coordinates

```text
REVIEW_KIND = IMPLEMENTATION (cross-repo)
AUTHORITIES =
  AGENT_CORE_EXACT_PRINCIPAL_AGENT_RESOLUTION_V1 @ dsh main 51dafbe (accepted)
  AUTH_SERVICE_EXACT_AGENT_PRINCIPAL_RESOLUTION_V1 @ auth main bb5b6f2 (accepted)
  AUTH_SERVICE_HR_AGENT_SESSION_SEND_GRANT_V1 @ auth main bb5b6f2 (accepted)
IMPLEMENTATION_HEADS =
  DSH_LANE_B = codex/principal-agent-resolution-impl-v1 @ 4438806
  AUTH_LANE_B = codex/principal-resolution-impl-v1 @ 566f916
  AUTH_LANE_A = codex/hr-send-grant-impl-v1 @ 8e58fcf
REVIEWER_ID = agent_a62b06ae (independent subagent, read-only)
AUDITED_AT = 2026-09-05
```

## Verdicts

```text
DSH_VERDICT = PASS
AUTH_LANE_B_VERDICT = PASS
AUTH_LANE_A_VERDICT = PASS
BLOCKER_UNION = [] (frozen; empty — no repair round required)
MECHANICAL_FIXES = [
  both auth grant vehicles: explicit machineClient.findMany select projections
  so secretHash is never fetched into memory (nothing secret was ever printed
  or persisted — hardening, no semantic change),
  Lane A vehicle header runbook note: rollback after HR Principal disable
  refuses IDENTITY_DRIFT; revocation then needs a separately authorized
  operation (never this path).
]
FOLLOW_UP_DEBT = [
  dsh provider maps the (unreachable by construction) definition-identity
  mismatch branch to identity_resolution_unavailable where CTR-EPAR-004 names
  identity_resolution_ambiguous for registry corruption — fail-closed either
  way, same-family microscopic variant;
  dsh broker manifest principalId lacks a pattern (broker validator cannot
  express it; authoritative grammar check runs in the trusted handler);
  ACC-EAPR-006's external-ref/provisioning regression suite to be executed at
  the merge/acceptance round (diff touches none of those files).
]
READY_FOR_BLOCKER_REPAIR = YES (nothing to repair beyond mechanical fixes)
```

## Gates rerun by the auditor (all green)

- dsh: verify-code-structure PASS (base 51dafbe, head 4438806); focused
  suites 37/37 (3 broker manifest + 12 provider + 5 ingress-exact-id +
  9 message-origin + 8 ASM integration) under production node v25.6.1 with
  proxy env unset.
- auth Lane B: MINIMAL_AUTH_V1_BUNDLE_VALID=true; tsc clean; focused tests
  37/37.
- auth Lane A: vehicle tests 23/23; MINIMAL_AUTH_V1_BUNDLE_VALID=true.

## Key audit confirmations

- dsh: exact-ID admission guard scopes to inter_agent origins only with
  non-A2A behavior byte-equivalent; provider composes fixed origin/path,
  redirect rejection, ≤5s bounded deadline, closed two-field validation with
  case-insensitive canonical echo and stored-id grammar, exact error mapping,
  local getAgent+enabled strictly after Auth success, no retry/cache/writes,
  token never surfaced; ASM three-field schema, authorization, receipt,
  exactly-once and no-replay contracts untouched.
- auth Lane B: registry delta = entry verbatim + one additive minor
  1.7.0→1.8.0 with all linked surfaces in lockstep and no reservation
  collision; resolver enforces grammar/400s before any query, V1 RS256
  reuse, explicit projections, Serializable read-only two-row-bound forward +
  reverse reads, exact status/code table, 500-never-absence, 504 late
  settlement absorbed, zero writes (write-spy); route envelope {error: CODE};
  grant vehicle = one Serializable tx (audience row if absent + exact tuple +
  grant_change_audits), unique-binding DB verification, env gate refusal
  before any DB connection, audit-replay guard.
- auth Lane A: tombstone-as-version-0 interpretation verified SOUND against
  prisma schema (no revoked_at column; Spec §12 pins operative semantics to
  version<1 denial); plan census four-way classification; apply CAS create/
  reactivate with same-tx nonce-unique AuthSecurityAudit carrying the exact
  bounded reasons; NOOP write-free; rollback receipt+postimage guarded,
  never DELETE; OUTCOME_UNKNOWN stops without retry.
- Cross-cutting: zero privilege creep (only the two declared HR tuples added
  anywhere), no second identity store, no migration/schema change in any diff.

## Post-audit mechanical repair + FINAL_HEAD_RECHECK

Both mechanical fixes were applied in the current candidates (ANTI_CHURN:
mechanical fixes stay in-candidate; no new Spec/Goal):

```text
AUTH_LANE_A_FINAL_HEAD = codex/hr-send-grant-impl-v1 @ bcb5c26
AUTH_LANE_B_FINAL_HEAD = codex/principal-resolution-impl-v1 @ cc0f2ec
DSH_FINAL_HEAD = codex/principal-agent-resolution-impl-v1 @ 4438806 (unchanged;
  the auditor's own gate rerun at this head is the FINAL_HEAD_RECHECK)
RECHECK = tsc clean; Lane A 23/23; Lane B 37/37;
  MINIMAL_AUTH_V1_BUNDLE_VALID=true (both auth branches); no semantic delta
  (projection + comment only) — FINAL_HEAD_RECHECK = PASS
```

## Boundary

HR_AGENT_DELIVERY_IMPLEMENTATION_READY = YES (source-side). Production apply,
the controlled runbook rounds (isolated-DB conformance, production read-only
census, CTR-HRG-004 token proof, CTR-HRG-006 canary, ACC-EAPR-007 rehearsal)
remain separately gated by the shared production mutation slot
(VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1 owns it; fresh
VISIT_ACTIVATION_PRODUCTION_READY=YES + DISPATCH_INTENT_BROKER_PRODUCTION_READY=YES
+ PRODUCTION_RUNTIME_LOCK=IDLE required) and native Owner authorization where
privileged access is required. This record authorizes none of those steps.
