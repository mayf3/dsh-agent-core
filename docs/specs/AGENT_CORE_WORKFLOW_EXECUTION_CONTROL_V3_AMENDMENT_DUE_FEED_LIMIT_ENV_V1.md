---
spec_id: AGENT_CORE_WORKFLOW_EXECUTION_DUE_FEED_LIMIT_ENV_V1
status: proposed
spec_kind: implementation
authority_level: governing_spec_amendment
implementation_authority: none
revision: r0
revision_date: 2026-11-20
amendment_of: AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3
amendment_kind: NEW
amendment_route: >-
  V3-adoption bounded route: one atomic Spec-delta-and-code PR under the
  Owner's task authorization (dsh-agent-core#707 fix anchor ③, Owner
  directives 2026-11-19/20). The delta must be independently accepted before
  merge. It does not authorize production effects.
scope:
  - production-runtime workflow-execution poller: due-feed batch size env
    surface (WORKFLOW_EXECUTION_DUE_FEED_LIMIT) replacing the hardcoded 100
non_goals:
  - any change to admission semantics, cursor protocol, or the reconciliation
    issuance/fence machinery (see dsh-agent-core#707 root cause for the
    parallel generation-ratchet track)
  - scheduler occurrence lifecycle (a separate deferral-design track)
governed_by:
  - AGENT_CORE_HARDENING_PROGRAM_V1
parent_spec_references:
  - docs/specs/AGENT_CORE_WORKFLOW_EXECUTION_CONTROL_V3.md
owners:
  - mayf3
date: 2026-11-20
repository: mayf3/dsh-agent-core
authoring_base: 710fa3a9 (production line head; includes accepted #703/#705)
---

# AGENT_CORE_WORKFLOW_EXECUTION_DUE_FEED_LIMIT_ENV_V1 — poller batch size env (bounded amendment)

> 状态：**proposed / docs+code atomic candidate（V3-adoption bounded route）**。
> 独立验收（exact-head semantic review PASS, BLOCKERS=NONE，验收人 ≠ 作者）通过前
> 不 merge。本 delta 不授权任何生产效应。

## 1. Goal

The workflow-execution poller's per-sweep due-feed batch size was hardcoded
(`DUE_FEED_LIMIT = 100`). Measured fleet behavior (dsh-agent-core#707): a
batch of 100 poured into a child whose serialized turn queue holds 64
(C-013) deterministically overflows the queue, and the rejected overflow
re-enters the due feed — a permanent rejection steady-state (HR: ~130-170
failures/day). Slice ③ makes the batch size an env-configurable deployment
knob so the effective value can respect the child queue cap (≤64 minus
headroom) without a code change.

## 2. Exact semantics

1. `WORKFLOW_EXECUTION_DUE_FEED_LIMIT` (strict positive integer via the
   module's existing `resolvePositiveInt`: decimal grammar, surrounding
   whitespace trimmed per the shared resolver contract, ≥1, fail-loud
   TypeError at module load). Unset/'' → fallback **100** (byte-identical
   default; no behavior change when unset).
2. The effective value is logged at poller start (existing line, now shows
   the configured value).
3. No admission/cursor semantics change: the existing `maxAdmissions`
   bound-and-stay-due behavior is untouched (it is already backoff-safe —
   unadmitted items stay due and are re-discovered next sweep).

## 3. Invariants frozen by tests

`packages/production-runtime/test/workflow-due-feed-limit.test.js`:
unset/'' → 100; valid override ('16'/'100'/'1'); strict grammar
('0'/'1e6'/'abc'/'-5'/'1.5'/'0x10'/'3600abc' all TypeError naming the env);
shared-resolver trim contract (' 16' → 16); module default resolves from
the real env at load time.

## 4. Exact implementation paths

- `packages/production-runtime/src/workflow-execution-runtime.js` (env
  surface, exported `resolveDueFeedLimit` + `DUE_FEED_LIMIT`)
- `packages/production-runtime/test/workflow-due-feed-limit.test.js` (NEW)

## 5. Deployment note (NOT part of this authorization)

Production relief requires setting `WORKFLOW_EXECUTION_DUE_FEED_LIMIT` ≤ the
child queue cap minus headroom in the runtime bootstrap env — that env
change rides the standing production authorization face, as does #707
path A (reconciliation abandonment, separately gated by owner risk
acceptance).

## 6. Acceptance gate

Independent exact-head semantic review (reviewer ≠ author) must return PASS
with BLOCKERS=NONE on this file + the atomic code commit before merge.
