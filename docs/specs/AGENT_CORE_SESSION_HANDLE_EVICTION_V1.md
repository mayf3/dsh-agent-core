---
spec_id: AGENT_CORE_SESSION_HANDLE_EVICTION_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec_amendment
implementation_authority: none
revision: r1
revision_date: 2026-11-20
amendment_of: AGENT_CORE_AGENT_SESSION_MESSAGING_V2
amendment_kind: NEW
amendment_route: >-
  V3-adoption bounded route: one atomic Spec-delta-and-code PR under the
  Owner's task authorization (dsh-agent-core#705, Owner directive 2026-11-19
  "你提一些issue吧，然后开始考虑修复"). The delta must be independently
  accepted before merge. It does not authorize production effects.
  r1 = post-review amendments (independent exact-head review returned FAIL
  with 2 blockers on r0; both addressed — see §0r1).
scope:
  - demo-server session-seam idle handle eviction (reference-drop only)
  - environment surface for the idle TTL and the handle cap
non_goals:
  - any SESSION_WRITE_CONTRACT change (R1/R2/R3 byte-identical)
  - durable session log truncation or compaction (harness-side, separate)
  - disposal semantics of live handles (unchanged; shutdown path untouched)
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
parent_spec_references:
  - docs/specs/AGENT_CORE_AGENT_SESSION_MESSAGING_V2.md
owners:
  - mayf3
date: 2026-11-20
repository: mayf3/dsh-agent-core
authoring_base: 44309339 (line fix/r128-gh-credential-basline-fix)
---

# AGENT_CORE_SESSION_HANDLE_EVICTION_V1 — seam handle eviction (bounded amendment)

## 0r1. Post-review amendments (independent review FAIL → both blockers addressed)

- **Blocker 1 (env syntax)**: `Number.parseInt` prefix-accepted invalid
  encodings (`'1e6'`→1, `'0x10'`→0 silently disabling the policy). Fixed:
  strict `/^[0-9]+$/` grammar, fail-loud on everything else; test widened.
- **Blocker 2 (cap-path mid-turn eviction)**: r1's `DSH_SEAM_MAX_HANDLES`
  floor-0 cap path evicted handles whose turn was still executing (the idle
  marker measures admission time, not settlement), and re-resuming a
  possibly-still-live prior agent has no qualified safety evidence. Fixed by
  REMOVING the cap path entirely (and the `DSH_SEAM_MAX_HANDLES` surface):
  eviction is TTL-only, and mid-turn eviction is unreachable by construction
  — the default TTL (3600000ms) exceeds the production turn deadline
  (900000ms, deadline-config) by 4×. §6 worst-case claim corrected.

> 状态：**proposed / docs+code atomic candidate（V3-adoption bounded route）**。
> 独立验收（exact-head semantic review PASS, BLOCKERS=NONE，验收人 ≠ 作者）通过前
> 不 merge。本 delta 不授权任何生产效应：生产舰队启用逐出仍走既有生产授权面。

## 1. Goal

The demo-server session seam's `handles` Map is the ONLY strong reference to a
session's full in-RAM log. Scheduled fleets mint one fresh non-main session per
occurrence and never drop them, so a long-lived child accumulates every session
it ever resumed (measured fleet peaks 3.7–5.4GB — dsh-agent-core#701/#703).
The eviction policy bounds that accumulation at the seam layer with ZERO
durability-semantics change.

## 2. Exact semantics

1. **Reference-drop only.** Eviction removes the `sessionId → handle` entry
   and its last-use marker. It NEVER calls `dispose()`: any in-flight work
   still references the handle, so GC liveness keeps it alive until settled;
   disk state (append-only JSONL) is untouched.
2. **Transparent R2 recovery.** The next prompt for an evicted session
   re-resumes via `agents.resume` through the UNCHANGED
   `getOrCreateSession` path — R1/R2/R3 (SESSION_WRITE_CONTRACT) apply
   byte-identically to the fresh handle.
3. **Exemptions.** `main` is never evicted. Sessions with a pending creation
   are skipped by the sweep.
4. **Triggers.** The sweep runs lazily at `getOrCreateSession` entry
   (single-threaded with the seam; no timers added). Idle floor:
   `DSH_SEAM_SESSION_TTL_MS` (default 3600000; `0` disables the policy).
   Mid-turn eviction is unreachable by construction: the idle marker is set
   at admission time and the default TTL exceeds the production turn deadline
   (900000ms) by 4×. There is NO handle-count cap path (r1's floor-0 cap was
   removed on review — see §0r1 blocker 2).
5. **Env surface (fail-loud, strict decimal grammar).**
   `DSH_SEAM_SESSION_TTL_MS` only. Only `/^[0-9]+$/` is accepted; every other
   encoding (including `'1e6'`, `'1.5'`, `'0x10'`, `'3600abc'`, negatives)
   throws at seam construction.

## 3. Invariants frozen by tests

`packages/demo-server/test/session-seam-eviction.test.js`:

- idle non-main handles drop reference-only (`disposed` stays false; the
  session object stays intact for GC liveness);
- the next prompt for an evicted session re-resumes transparently
  (`agents.resume` called, followup delivered, hot handle re-installed);
- `main` survives the sweep; `DSH_SEAM_SESSION_TTL_MS=0` disables entirely;
- (r2) the r1 cap path no longer exists; unmarked handles are never evicted
  (defensive skip) and the TTL>deadline safety relation is frozen;
- invalid env values fail loud at seam construction (TypeError).

Existing seam suites (message-origin, workflow-origin, admission coexistence)
pass unchanged — the R1/R2/R3 contract surface is untouched.

## 4. Exact implementation paths

- `packages/demo-server/src/session-seam.js` (eviction state, sweep, env
  parsing, activity markers)
- `packages/demo-server/test/session-seam-eviction.test.js` (NEW)

## 5. Alternatives and disposition

- Timed sweep (setInterval in the child): rejected — the seam has no timer
  infrastructure and lazy eviction at the natural entry point covers the
  growth driver (session churn) with zero new background work.
- Dispose-on-evict: rejected — an in-flight delivery/turn holding the handle
  would be killed mid-work; reference-drop lets GC liveness do exactly that
  safety job for free.
- Harness-side suffix loading / compaction truncation (#705 remaining anchors,
  deepseek-harness repo): complementary and still required — eviction bounds
  the seam Map; the harness fixes bound the per-session log itself.

## 6. Migration, compatibility, and rollback

Source-only until deployed; production activation requires the standing
production authorization face. Rollback = `DSH_SEAM_SESSION_TTL_MS=0` (env)
or reverting the package deploy. Worst-case behavior delta: an evicted
session's next prompt pays one re-resume (identical to the post-restart
path that is already exercised on every process restart).

## 7. Acceptance gate

Independent exact-head semantic review (reviewer ≠ author) must return PASS
with BLOCKERS=NONE on this file + the atomic code commit before merge;
acceptance binds the reviewed head. Production effect authorization is
expressly out of scope for this amendment.
