---
spec_id: AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1
title: Development execution authority convergence — Core development_execute writer authority retired in favor of the single agent-control development writer; read-only surface compatibility preserved
status: accepted
accepted_date: 2026-10-02
accepted_by: mayf3
acceptance_authority_basis: >-
  Owner directive in the Owner-authored Product mayf3/dsh-agent-core#413 (E12,
  created 2026-10-02): DONE_WHEN A.3 "migrate its active consumer(s) to
  agent-control or disable that start/admission path", A.5 "after cutover, no
  Core API/module may independently launch, continue, cancel, timeout-kill,
  reserve a mutable coding workspace, or declare terminal state for
  source-development workers", A.4 "preserve historical receipts/ledgers as
  read-only evidence", and B.7-B.11 (deterministic local continuation).
  Executed through the Owner's own command bus binding agent-control#218 →
  session sess_267e9d60-ad52-494f-aa18-561b984e536a. Independent
  changed-surface review on the exact implementation head: INDEPENDENT_REVIEW
  recorded in docs/evidence/DEV_EXECUTION_AUTHORITY_CONVERGENCE_V1-20261002/.
spec_kind: implementation
authority_level: governing_spec
implementation_authority: contracts
production_apply_authority: none
repo: mayf3/dsh-agent-core
date: 2026-10-02
candidate_base: 09de835d9549052c60ad6908b7bbdc4f3c743f3b (origin/main)
revision: r1
supersedes: [AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1]
supersession_scope: >-
  Supersedes the OPERATIONAL writer authority of the Development Execution
  Surface (CTR-DES-001 start/continue/cancel admission, CTR-DES-004 worktree
  reservation, CTR-DES-007 terminal declaration incl. orphan-recovery writes,
  and the raw-PID cancel/timeout-kill operations). Does NOT supersede the
  read-only state/receipt semantics (CTR-DES-002 records/receipts as READ
  surface) and imposes no change on the governed business execution specs
  (Workflow Agent Execution, traceability, history query) — business
  Agent/Router/DSH/WEC execution authority remains in Core per #413 A.6.
mandate: >-
  Product #413 (E12, W1, final planned control-plane convergence Product):
  converge source-development execution on ONE authority (agent-control owns
  development command admission, worktree/session identity, ZCode/Codex
  execution and receipts) without a new platform, and remove relay/ChatGPT
  from the deterministic-continuation hot path.
governed_by:
  - AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 (accepted 2026-09-24; operational authority superseded by this Spec)
evidence:
  - docs/investigations/DEV_EXECUTION_AUTHORITY_CONVERGENCE_CENSUS_V1.md
related_repos:
  - repository: mayf3/agent-control
    relation: SOLE development writer authority (Git-backed per #411; per-task worktree reservation per #412); deterministic local continuation per this Spec's counterpart requirement in #413 B
---

# AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1

## 0. Why (evidence-backed)

The census (docs/investigations/DEV_EXECUTION_AUTHORITY_CONVERGENCE_CENSUS_V1.md,
fresh-read at origin/main 09de835d) proves:

1. Core's `development_execute` is a complete second development-writer
   authority in source: broker manifest registered in DEFAULT_MANIFESTS,
   engine mounted unconditionally in the production composition, own ledger,
   own worktree admission/dedupe, raw-PID cancel/timeout kills, orphan-recovery
   terminal writes.
2. It has ZERO actual consumers: the deployed production lineage (514ab7b0)
   predates the package; no `dev-execution/` directory (no repos.json,
   backend.json, ledger, worktrees) exists anywhere; no auth-service
   registration for `development.execute` exists; no execution ever ran.
3. agent-control is the one operating development authority (command bus,
   single-writer admission, per-task worktree reservation, process-group
   ownership, receipts).

Left as-is, any future deploy of a post-09-24 build would silently reactivate
a second development writer. This Spec retires the duplicate authority at the
source while keeping the read surface and any hypothetical history intact.

## 1. CTR-DEC-001 — writer authority retired (Core)

The `development_execute` capability remains mounted and visible so the
refusal is explicit and observable, but:

- `start` MUST refuse with machine error `writer_authority_retired` before any
  other effect: no backend verify, no repo/worktree authority resolution, no
  capacity accounting, no ledger write, no worktree creation, no process spawn.
- `continue` MUST refuse with `writer_authority_retired` (no resume run, no
  ledger write, no queued steering).
- `cancel` MUST refuse with `writer_authority_retired` (no signal, no terminal
  append). Process ownership for any legacy worker belongs to its writer
  authority (agent-control), never to Core.
- The engine MUST default to the retired state (`writerAuthorityRetired`:
  true); production wiring MUST NOT pass an opt-out. The only permitted
  opt-out is inside the hermetic test suite, which exercises the retained
  read-path machinery against a fake backend.
- Orphan recovery on owning-process restart MUST NOT append `OUTCOME_UNKNOWN`
  (or any) ledger lines under retirement: Core never declares terminal state
  for development workers anymore. Non-terminal historical projections stay
  queryable exactly as the ledger recorded them.
- The timeout killer and worktree creation become structurally unreachable
  (no supervised runs, no starts). No new code path may re-arm them.

## 2. CTR-DEC-002 — read-only compatibility (Core)

- Ledger replay, `status`, and `result` keep their existing contracts and are
  the ONLY permitted development-execution operations after cutover. If a
  pre-cutover ledger ever existed (census: none does), its receipts stay
  readable and byte-identical — no rewrite, no deletion, no appended
  reconciliation lines.
- The broker manifest documents `writer_authority_retired` and states that the
  development writer is agent-control. Manifest changes are additive-only.

## 3. CTR-DEC-003 — deterministic local continuation (agent-control)

For the installed local controller only (no dsh source change):

- The minimal mechanically safe case is: a WORK task with a positively
  confirmed resumable session id, an intact per-task worktree reservation, an
  unchanged Product binding (`product_issue` present), no confirmed stop, no
  proven terminal turn result, and a per-attempt local-continuation budget > 0.
- For that case only, the controller loop (monitor) may resume the SAME
  session in the SAME workspace with the ORIGINAL launch prompt — the same
  bound action, re-requested — without any relay/ChatGPT round trip, using the
  existing admission invariants (reserve-before-spawn, single writer, process
  identity capture, receipt comment).
- Everything else still stops for ChatGPT/Owner: missing/ambiguous session
  identity, missing workspace, changed scope, new Product selection, CONTROL/
  CANARY bookkeeping, proven terminal results, stop-confirmed tasks, exhausted
  continuation budget, unreadable state. UNKNOWN preconditions are never
  positively confirmed, so they stop — local code never guesses.
- Relay/outbox remains notification + exceptional planning transport. The
  capacity guard, scheduler receipts, and terminal bookkeeping (#394) are
  unchanged; a deterministic continuation neither requires nor suppresses
  them.
- A terminal command result still never decides BUSINESS_VERIFIED nor creates
  WAITING_OWNER (existing product_linkage guard; regression-tested here).

## 4. Explicit non-goals

No new scheduler/watcher/database/platform/coordinator; no ZCode/Codex adapter
work in Core; no business execution change (Agent/Router/DSH/WEC); no
production deploy/restart; no deletion of history; no reopening of #394; no
change to svc-workflow; no re-enable path short of a NEW superseding Spec.

## 5. Test obligations

Core (RED-first): default-constructed engine refuses start/continue/cancel
with `writer_authority_retired`; restart replay of a non-terminal legacy
ledger performs ZERO ledger writes while status/result stay readable;
historical terminal receipts remain byte-identical; manifest exposes
`writer_authority_retired`; the legacy writer machinery remains covered by the
explicit opt-out suite (existing 22 tests stay green).

agent-control (RED-first): interrupted WORK task with confirmed session +
intact workspace is locally continued (same session, same worktree, same
Product, original prompt) across a controller restart with the relay stubbed
unavailable; ambiguity (no session / stop-confirmed / missing workspace /
second death after budget) stops with a terminal event and NO spawn; a proven
terminal turn result never triggers continuation; product_linkage release
after a terminal result leaves QUEUE_STATE=READY and never sets
WAITING_OWNER/BUSINESS_VERIFIED.

## 6. Acceptance mapping (Product #413 DONE_WHEN)

A.1/A.2 = census investigation; A.3/A.5 = CTR-DEC-001; A.4 = CTR-DEC-002;
A.6 = non-goals (unchanged by construction); B.7-B.11 = CTR-DEC-003;
C.12-C.14 = the agent-control test matrix; C.15 = the Core refusal/read-only
matrix; C.16 = product_linkage regression test; C.17 = #394 suites untouched.
