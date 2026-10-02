# DEV_EXECUTION_AUTHORITY_CONVERGENCE_CENSUS_V1

- investigation_id: DEV_EXECUTION_AUTHORITY_CONVERGENCE_CENSUS_V1
- date: 2026-10-02
- status: accepted-as-evidence
- evidence_for: AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1
- product: mayf3/dsh-agent-core#413 (E12)
- read_head: origin/main 09de835d9549052c60ad6908b7bbdc4f3c743f3b (dsh-agent-core), mayf3/agent-control main ec9b3ad5f02d8ef90b508d933acffb83ed7edd06
- method: fresh read of Product #413/#386/#411/#412/#394, the full DES source tree, every referencing file, the deployed production tree (read-only), controller state (read-only), and agent-control runtime source. Zero mutation of production, DS, credentials, or the shared W1 release lane.

## 1. What "Core Development Execution" is

`AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1` (accepted 2026-09-24, accepted_reviewed_head e3393e7c) + `packages/development-execution`:

- Broker capability `development_execute` (start/status/continue/cancel/result), scope `development.execute`, resource `development-execution`.
- Engine with its own state machine (QUEUED/STARTING/RUNNING/WAITING/SUCCEEDED/FAILED/CANCELLED/OUTCOME_UNKNOWN), append-only ledger `<root>/dev-execution/executions.jsonl`, dedupe by (caller, dedupeKey), restart orphan recovery that **appends** `OUTCOME_UNKNOWN` terminals.
- Worktree authority: Operator `repos.json` allowlist + fresh `git worktree add` per execution + `maxWorktrees` capacity.
- Codex backend adapter: pinned `codex exec` spawn, raw-PID `process.kill(pid, SIGKILL)` for cancel and timeout, resume-based continue.

Every item the Product calls a duplicate development-writer authority is present: **development start, admission (allowlist/capacity/dedupe), continue, cancel, timeout-kill, worktree reservation, terminal-state declaration, raw-PID process operations.**

## 2. CONSUMER CENSUS (source — exhaustive)

| # | Surface | File:line | Role |
|---|---|---|---|
| S1 | Manifest registration | `packages/broker/src/index.js:56,96` (`developmentExecuteManifest` in DEFAULT_MANIFESTS) | capability advertised to every gateway caller |
| S2 | Manifest definition | `packages/broker/src/capabilities/development-execute.js` | tool contract |
| S3 | Production mount | `packages/production-runtime/src/compose.js:65,511` (`mountDevelopmentExecutionRuntime`) | constructs engine unconditionally in composition |
| S4 | Handler map | `packages/production-runtime/src/development-execution-runtime.js:23-41` (`developmentExecutionAccess`) | start/continue/cancel/status/result wiring |
| S5 | Gateway resolver merge | `packages/production-runtime/src/broker-composition.js:49` | handlers reachable from gateway |
| S6 | Layout dir | `packages/production-runtime/src/paths.js:103` (`<root>/dev-execution`) | ledger/config/worktrees root |
| S7 | Engine module | `packages/development-execution/src/{engine,authority,ledger,codex-backend,index}.js` | the writer machinery |
| S8 | Tests | `packages/development-execution/test/development-execution.test.js` | hermetic 22 |

No other file in `packages/`, `scripts/`, or `examples/` references the surface (grep `development.execute|development-execution|developmentExecution|mountDevelopmentExecution`, 2026-10-02). The B7 v2.2 pack gate (Product #414) merely **carries** the package inside the packed app closure because S3/S4 import it relatively; it is not a consumer.

## 3. CONSUMER CENSUS (runtime — actual callers)

1. **Production live tree** `/usr/local/libexec/agent-core`: the deployed app closure (`app/packages/`, 17 packages) contains **NO `development-execution` package** (directly verified 2026-10-02, read-only). The production source stamp `514ab7b0…` recorded by Product #414's rollback evidence is NOT resolvable as a git object in this repository (different lineage), so the stamp itself is recorded here as reported provenance only — the load-bearing evidence is the direct live-tree verification above: the mounted runtime cannot expose the capability.
2. **No `dev-execution/` directory exists** in the live tree, in any backup tree checked, or anywhere under `~/workspace` (find, maxdepth 3): no Operator `repos.json`, no `backend.json`, no `executions.jsonl`, no worktrees ⇒ **zero executions have ever run through this surface** and no historical receipts exist in Core.
3. **Auth-service registration**: the DES Spec itself scoped resource/scope registration to §12 "production rollout, out of scope for merge"; no registration artifact exists in the repo (no seed/migration referencing `development.execute` outside the broker manifest). Even on a mounted build, every call would fail closed `access_denied`.
4. **agent-control** (`~/workspace/agent-control`, installed from mayf3/agent-control main `ec9b3ad`, live controller PID since 2026-10-02 11:18): the sole development command admission/execution/receipt authority actually operating — GitHub command bus (`mayf3/agent-control` issues), single-writer admission, per-task worktree reservation (E11), process-group ownership, receipts.
5. Business Agent/Router/DSH runtime execution (Router → dsh CLI children) and WEC attempt/effect-fence live in Core but are **business execution**, explicitly out of scope for #413 A.6 — not development-writer authority.

## 4. Classification (per #413 A.2)

| Surface | Class | Disposition |
|---|---|---|
| Broker manifest + gateway exposure (S1/S2/S5) | **latent live admission path** (would go live on next deploy of a post-09-24 build) | keep tool surface, WRITER OPERATIONS REFUSE (`writer_authority_retired`); reads stay |
| Production mount/engine (S3/S4/S6/S7) | **latent live writer** (same condition) | engine default = writer authority retired: start/continue/cancel refuse; no ledger append of any kind (orphan recovery included); status/result read-only |
| Ledger replay + status/result (S7) | **read-only/history compatibility** | preserved verbatim; replay never mutates under retirement |
| Writer machinery internals (backend adapter, worktree creation, timeout killer) | **dead once admission refuses** (unreachable: start refuses before verify/authority/worktree; no supervised runs ⇒ no timers/kills) | retained in-tree only as read-only-path + hermetic-test machinery; zero production wiring reaches them with the flag on |
| Historical receipts/ledgers | **none exist** (census §3.2) | read-only preservation rule still encoded (replay-only) |

## 5. AUTHORITY_BEFORE → AUTHORITY_AFTER

AUTHORITY_BEFORE (source-effective): TWO development-writer authorities — agent-control (operating) + Core `development_execute` (registered in DEFAULT_MANIFESTS + mounted in composition; latent only because the deployed lineage predates it).

AUTHORITY_AFTER: ONE development-writer authority — agent-control. Core's `development_execute` remains visible but refuses start/continue/cancel with `writer_authority_retired`, never writes its ledger, never kills processes, never reserves worktrees, never declares terminal states; status/result serve whatever history exists, read-only. Business Agent/Router/DSH/WEC execution authority untouched.

## 6. Relay/ChatGPT hot path (agent-control side)

Fresh read of controller.py (installed tree): an accepted `continue` command is already executed fully locally (queue poll → admission → spawn). The hot-path dependency is **upstream of admission**: only ChatGPT can create the continuation command issue (terminal event → outbox → dispatcher → chatgpt-relay → ChatGPT → new issue), so an interrupted-but-resumable task waits on a relay/ChatGPT round trip even when the next action is mechanically determined. Product #413 B removes exactly that dependency for the bound case; ambiguity still stops for ChatGPT/Owner.

## 7. Development preflight (summarized; full record in the superseding spec)

- Governing accepted Spec for the affected surface: AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 — its operational authority is what #413 retires ⇒ need new/amended Spec = YES ⇒ SUPERSEDE route (RKGV1 §5: "方向实质改变 → SUPERSEDE（新 Spec，旧 Spec 标 superseded）"), authored as AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1 with acceptance basis = Owner Product #413 DONE_WHEN (Owner-authored 2026-10-02) + independent changed-surface review.
- Rejected alternatives not reopened: none affected. #394 stays closed; its liveness behavior is preserved (capacity guard, receipts, terminal bookkeeping unchanged).
- agent-control side is governed by the #411/#412 accepted local-control-plane Products + Product #413 B; no dsh docs/specs artifact governs that repo.
