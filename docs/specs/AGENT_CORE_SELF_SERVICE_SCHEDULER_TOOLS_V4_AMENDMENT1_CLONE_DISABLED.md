---
spec_id: AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4_AMENDMENT1_CLONE_DISABLED
title: Scheduler capability — eighth action `clone_disabled` (same-Owner atomic disabled clone)
status: proposed  # DRAFT / PENDING_ACCEPTANCE — this candidate authorizes NO production claim
candidate_date: 2026-10-11
candidate_base: a96900bd7a0a2ecb30b6b8bd5f7a27d06b8837b1  # current accepted main head this draft was authored against
candidate_head: see PR (branch ac-547/clone-disabled-v1)
amends:
  - AGENT_CORE_SELF_SERVICE_SCHEDULER_TOOLS_V4  # status stays accepted; THIS file never modifies V4's body
related:
  - SCHEDULER_CONTROL_PLANE_RELIABILITY_V1  # §5.1 logical key / §5.2 outcome state machine / §5.3 readiness — reused unchanged
spec_kind: amendment-candidate
authority_level: pending_governing_spec
implementation_authority: none-until-accepted  # implementation exists on the candidate branch as Owner-pre-authorized SOURCE work (private#547), explicitly UNINSTALLED / UNENABLED
production_apply_authority: none
owners:
  - mayf3
---

# AMENDMENT1_CLONE_DISABLED (DRAFT / PENDING_ACCEPTANCE)

> **Lifecycle truth (normative for this candidate):** V4 remains `accepted` and its frozen
> 7-action union (`create | list | runs | update | enable | disable | remove`) remains the ONLY
> accepted contract until this amendment is accepted through the normal review path. Nothing in
> this candidate may be cited as accepted, installed, or enabled. The implementation on the
> candidate branch is Owner-pre-authorized SOURCE work (private agent-control#547) and is
> truthful state **SOURCE / UNINSTALLED / UNENABLED**. Acceptance of this file is the single
> step that would promote the union to eight actions.

## A1. Motivation (one paragraph)

An Agent owning a job whose full agent-turn prompt has no legal external source (the text lives
only in the stored payload) cannot create a successor job without re-authoring the prompt, and
`create` is born-enabled by contract. A same-Owner server-side atomic clone into a permanently
disabled target closes exactly this gap: the hidden payload bytes are copied inside the store
boundary, the caller never supplies or receives prompt text, and the successor stays inert until
a separate, explicitly-authorized enable.

## A2. Exact delta to the frozen contract

1. **Action union**: `create | list | runs | update | enable | disable | remove` → the same
   seven **plus** `clone_disabled`. All seven existing actions' schemas, semantics, and error
   tables are UNCHANGED. `self_ops` (status | reconcile_turn | job_disposition) is untouched.
2. **New operation schema** (closed, `additionalProperties:false`):
   ```text
   clone_disabled:
     job_id            string, required   — the OWNED source job id
     expected_revision {schedule_revision:int>=1, updated_at_ms:int>=1}, required
                                          — exact two-field CAS observed before the clone
     new_logical_key   string, required   — stable logical identity of the TARGET (§5.1 semantics)
     new_name          string, optional   — display name only; defaults to the source name
   ```
   No definition leaves, no `target_agent_id`, no `destination`, no admin path exist on this
   action. Trusted caller identity continues to come only from Parent Runtime context.
3. **Error table**: reuses the existing closed codes only — `invalid_arguments`,
   `access_denied`, `job_not_found`, `validation_error`, `logical_key_conflict`,
   `stale_target_conflict`, `capability_unavailable`, `mutation_not_applied`
   (+ `mutation_outcome_unknown` via the §5.2 state machine). No new error code.
4. **Semantics** (all enforced in ONE store transaction — lock + re-read-latest):
   - **Judgment order (frozen)**: trusted caller → argument shape → source visible+owned
     (opaque: missing ⇒ `job_not_found`, foreign ⇒ `access_denied` "no visible job with id";
     a held `scheduler.admin` proof is NEVER consulted — clone has no allowAny path) →
     exact two-field CAS (stale ⇒ `stale_target_conflict`, zero write) → elapsed one-shot rule
     (below) → **locked** re-verify of ownership and CAS → logical-key dedup → insert.
   - **Logical-key dedup (§5.1 reuse)**: same `new_logical_key` + equal desired projection
     (`agentId/schedule/payload/delivery/retry/deleteAfterRun`) ⇒ `already_applied` — the
     original target is answered again, zero duplicate job, the retry's audit event carries
     `alreadyApplied:true` (never a second committed mutation). Same key + differing
     projection ⇒ `logical_key_conflict`, zero write. A source change after a first clone makes
     the same-key retry lose to the CAS first (stale) and then conflict (fresh CAS) — the stale
     path must never silently answer the outdated clone.
   - **Copy whitelist (definition bytes only)**: `name` (or `new_name`), `agentId` (== caller ==
     source owner), `schedule` (stored bytes; `every.anchorMs` phase and `cron` expr/tz/stagger
     preserved verbatim — no anchor reset, no immediate trigger, no backlog), `payload`
     (stored bytes incl. the hidden `message`; `timeoutSeconds/lightContext/model` preserved),
     `delivery` (trusted binding stays with the same owner), `retry`, `deleteAfterRun`,
     `description`. NOT copied: id (fresh uuid), logicalKey (the new one), enabled (forced
     false), scheduleRevision (fresh 1), createdAt/updatedAt/revisionActivatedAt (clone time —
     first future slot only, ever), `state` (empty — no due slot, `nextRunAt:null` is legal for
     a disabled job), occurrences/fences/runs/history/execution state, and migration gates.
   - **Elapsed one-shot rule**: source `schedule.kind === 'at'` whose instant is already past is
     precisely rejected (`validation_error`) — cloning it would mint a permanently dead
     definition. Future one-shots copy verbatim. The existing `normalizeJob` validator runs at
     full strength; this amendment lowers nothing.
   - **Prompt secrecy**: the payload message crosses neither request nor response nor audit;
     audit events carry digests only (existing `definitionDigest` behavior).
   - **Mutation state machine (§5.2, unchanged)**: `clone_disabled` joins `SCHEDULER_MUTATIONS`
     — readiness gate (§5.3), strict committed-shape validation (the committed clone must be
     `enabled:false` and `nextRunAt:null`; anything else is unprovable), and lost-response
     reconcile by the NEW logical key: found+disabled ⇒ APPLIED (synthetic result), absent ⇒
     `mutation_not_applied` (retry-safe with the SAME key), found+enabled ⇒ STILL_UNKNOWN.
     An UNKNOWN outcome never auto-retries with a different key.
5. **Source invariants**: the source job's bytes, its unresolved UNKNOWN occurrences, fences,
   run evidence and history are untouched by a clone (the transaction only appends the new
   job). Cloning does NOT transfer or resolve anything: a fenced source stays fenced, and a
   clone of an unknown-fenced job must not be described as safe-to-enable by virtue of the
   clone itself.

## A3. Non-goals

No enable/disable semantics change; no fence clearing; no automatic migration of any job; no
new scope, grant, wire scope, or admin capability; no cross-agent cloning; no second scheduler
surface — the one existing `scheduler` capability grows one action.

## A4. Acceptance evidence on the candidate branch (SOURCE-level, not production)

18-test isolated battery + 60-test targeted regression (seven/eight-action pins, permission
idempotence, relay state machine, gateway readiness) — all green; structure-gate diff adds zero
new violations (two 500-line crossings repaired by mechanical splits, mirroring AMENDMENT_3 C2
practice). RED evidence and exact commands live in the PR and the private#547 record.

## A5. Acceptance path (the only promotion step)

Normal spec review of THIS file (independent review → Owner acceptance → atomic docs merge that
flips `status: proposed → accepted` and records the V4 `amendments[]` backlink). Only after that
merge may the union be described as eight actions in production terms; deployment then follows
the existing release process (no second installer; rollback = revert of the code PR, the
feature is purely additive and old binaries simply answer `unsupported_operation` to the new
action).
