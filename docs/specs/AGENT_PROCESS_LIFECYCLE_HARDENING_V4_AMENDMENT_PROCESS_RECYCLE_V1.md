---
spec_id: AGENT_PROCESS_RECYCLE_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec_amendment
implementation_authority: none
revision: r0
revision_date: 2026-11-20
amendment_of: AGENT_PROCESS_LIFECYCLE_HARDENING_V4
amendment_kind: NEW
amendment_route: >-
  V3-adoption bounded route: one atomic Spec-delta-and-code PR under the
  Owner's task authorization (dsh-agent-core#703, Owner directives
  2026-11-19 "你提一些issue吧，然后开始考虑修复" and "可以啊，你反正修复不成功就回退呗").
  The delta must be independently accepted before merge. It does not
  authorize production effects: deployment/activation of the sweep on the
  production fleet remains behind the standing production authorization
  face (window SOP / explicit Owner directive).
scope:
  - registry-level idle READY generation retirement (recycle sweep)
  - reuse-gate semantics for a retire-requested generation
  - per-generation recycle bookkeeping on AgentProcess
  - environment surface for thresholds and the kill-switch
non_goals:
  - any new lifecycle state (EMPTY/STARTUP/READY/REAP unchanged)
  - any change to C-020 exit settlement order or REAP discipline
  - session-history retention itself (dsh-agent-core#705/#706 own that)
  - parent-runtime memory (#702), arm64 migration (#704)
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
parent_spec_references:
  - docs/specs/AGENT_PROCESS_LIFECYCLE_HARDENING_V4.md
owners:
  - mayf3
date: 2026-11-20
repository: mayf3/dsh-agent-core
authoring_base: 44309339 (line fix/r128-gh-credential-basline-fix)
---

# AGENT_PROCESS_RECYCLE_V1 — idle-generation recycle (bounded V4 amendment)

> 状态：**proposed / docs+code atomic candidate（V3-adoption bounded route）**。
> 独立验收（exact-head semantic review PASS, BLOCKERS=NONE）通过前不 merge。
> 本 delta 不授权任何生产效应：生产舰队启用 sweep 仍走既有生产授权面。

## 1. Goal

Long-lived READY child processes accumulate unbounded RAM (append-only
session history held for the child's lifetime; measured peaks 3.7–5.4 GB on
the production fleet, dsh-agent-core#701/#703). The recycle policy bounds
that accumulation at the lifecycle layer by retiring idle READY generations
through the EXISTING graceful shutdown path, so every generation restarts
from a small footprint without any new lifecycle state.

## 2. Exact semantics

1. **Bookkeeping (per generation).** `AgentProcess` gains `retireRequested`
   (init `false`) and `recycleState = { settledTurns, spawnedAtWallMs }`.
   `finishExecution` increments `settledTurns` (optional-field guarded so
   duck-typed test fakes stay safe). No other writer exists.
2. **Eligibility (pure, `recycleEligibility`).** A process is recyclable iff:
   state `READY`; `exit === undefined`; `retireRequested === false`;
   AND idle — `turnInFlight === false`, `turnQueueEntries` empty,
   `executions` empty, `activeUnknownFences` empty; AND
   (`settledTurns >= maxTurns` OR `age >= maxAgeMs`).
3. **Sweep (registry method `recycleSweep(config)`).** Iterates lifecycle
   slots; for each READY+eligible process it sets `retireRequested = true`
   and invokes `proc.shutdown()` — the existing performShutdown
   (DRAINING freeze → graceful RPC → real exit → SIGKILL grace fallback),
   whose settlement runs the UNCHANGED C-020 exit order and installs REAP.
   The sweep is the ONLY writer of `retireRequested`. It never kills
   directly, never deletes a slot, never mints generations.
4. **Reuse gate.** `ensureRunning` treats a READY slot whose process has
   `retireRequested === true` as non-reusable: it transparently waits
   (bounded `RECYCLE_WAIT_BUDGET_MS = 10000`) for `shutdownPromise` to
   settle, then re-enters the lifecycle read — EMPTY → fresh generation,
   REAP → the standard structured `AGENT_PROCESS_REAPING` rejection. It
   NEVER mints a parallel generation. (Today the sweep's shutdown settles
   the REAP install synchronously, so later arrivals observe the normal
   REAP fence; the wait branch is the frozen defense-in-depth invariant.)
5. **Mount.** The router mount runs an unref'd `setInterval` sweep with
   `parseRecycleConfig(process.env)`; sweep errors are logged, never fatal.
6. **Environment surface (fail-loud on invalid integers).**
   `DSH_AGENT_RECYCLE=off` (kill-switch, default on),
   `DSH_AGENT_RECYCLE_MAX_TURNS` (default 20),
   `DSH_AGENT_RECYCLE_MAX_AGE_MS` (default 86400000),
   `DSH_AGENT_RECYCLE_SWEEP_MS` (default 300000),
   `DSH_AGENT_RECYCLE_WAIT_BUDGET_MS` (default 10000).

## 3. Invariants frozen by tests

`packages/agent-router/test/process-lifecycle/recycle.test.js`:

- eligibility matrix: thresholds (turns OR age), the idle composite
  (turn-in-flight / queued / tracked executions / unknown fences all block),
  non-READY / exiting / already-retiring all ineligible;
- config: kill-switch, per-field overrides, TypeError on invalid values;
- registry: an idle over-threshold READY generation retires (retireRequested
  + shutdown invoked + slot REAP); admission during the recycle REAP rejects
  `AGENT_PROCESS_REAPING`; after REAP→EMPTY the next demand spawns a fresh
  generation (not retiring, counters zero);
- busy generations (any in-flight surface) are never touched; non-READY
  slots never scanned; the sweep is idempotent (re-touch never re-shuts-down);
- the REAL AgentProcess `finishExecution` drives `settledTurns`.

## 4. Exact implementation paths

- `packages/agent-router/src/process/recycle.js` (NEW: config + eligibility)
- `packages/agent-router/src/process/agent-process.js` (bookkeeping fields)
- `packages/agent-router/src/process/event-correlation.js` (settledTurns increment)
- `packages/agent-router/src/process-registry.js` (reuse-gate branch,
  bounded wait, `recycleSweep`)
- `packages/agent-router/src/index.js` (mount timer + env config)
- `packages/agent-router/test/process-lifecycle/recycle.test.js` (NEW)

## 5. Alternatives and disposition

- Kill-based recycle (SIGKILL idle children): rejected — bypasses C-020
  settlement and the graceful child-side dispose of session handles.
- Session-history retention fixes only (#705/#706): kept as the structural
  root-cause track; recycle is the lifecycle-layer bound that holds even
  before those land, and remains valuable after (peak-bounding).
- External ops watchdog restarting children: rejected — outside the
  lifecycle authority (would SIGKILL through the registry's single-writer
  ownership model instead of the graceful path).

## 6. Migration, compatibility, and rollback

Source-only until deployed; production activation requires the standing
production authorization face. Rollback = `DSH_AGENT_RECYCLE=off` (env,
no restart beyond the env reload) or reverting the package deploy. The
sweep only ever retires idle generations; worst-case behavior degradation
is a bounded-wait delay (≤10s) or a structured `AGENT_PROCESS_REAPING`
rejection on demand arrival — the same rejection shape the REAP fence
already defines.

## 7. Acceptance gate

Independent exact-head semantic review (reviewer ≠ author) must return
PASS with BLOCKERS=NONE on this file + the atomic code commit before merge;
acceptance binds the reviewed head. Production effect authorization is
expressly out of scope for this amendment.
