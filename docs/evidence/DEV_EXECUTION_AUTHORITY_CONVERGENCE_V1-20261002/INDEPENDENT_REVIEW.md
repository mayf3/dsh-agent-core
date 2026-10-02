# INDEPENDENT_REVIEW — AGENT_CORE_DEVELOPMENT_EXECUTION_AUTHORITY_CONVERGENCE_V1

- review_id: INDEPENDENT_REVIEW_E12-20261002
- product: mayf3/dsh-agent-core#413 (E12)
- reviewer: independent changed-surface reviewer lane (separate agent, read-only; author session sess_267e9d60-ad52-494f-aa18-561b984e536a)
- r1 reviewed heads:
  - dsh-agent-core `ba0768f2` (branch e12-dev-exec-authority-collapse-20261002, base origin/main 09de835d)
  - agent-control `9e695b5` (branch e12-deterministic-continuation-20261002; parent ef8a2a0 = byte re-pin of live-installed #394 drift, faithful-copy claim reviewer-verified)

## Round 1 — VERDICT: REVISE / LOAD_BEARING_GAPS = 2

Independently verified by the reviewer (not trusted from commit messages):

- Core retirement sound: refusal-before-effect at engine.js start/continue/cancel; orphan recovery skipped ⇒ ledger never appended; timeout-kill/cancel-kill structurally unreachable under retirement; production wiring byte-unchanged; census wiring line-claims exact; deployed live tree `/usr/local/libexec/agent-core/app/packages/` (17 packages) contains NO development-execution package; supersede transaction frontmatter-only, body byte-identical; legacy test diff = 8 opt-out lines only; manifest additive; suites 29/29 re-run by reviewer.
- agent-control continuation: child_env_for verbatim move; strict-positive eligibility; budget single-increment; second-writer admission safe; relay independence proven with stubs; C.16 linkage test added; 46/46 focused tests re-run by reviewer.
- Dispatcher `test_3_relay_blocked_40s…` failure cannot be caused by the E12 diff (imports dispatcher.py only; byte-identical across base/head/live).

### Load-bearing gaps found (r1)

1. **GAP 1 (P0, empirically reproduced by reviewer)** — controller.py: `deterministic_continue`'s terminal-prior-record admission lets `ensure_no_writer` → `reconcile_terminal` set `stop_confirmed=True` on the re-owned record; the reserve-before-spawn update never cleared it, so the first monitor tick with the live continued writer falsely classified it FAILED (false receipt, issue closed, agent:failed label, pl_release, child handle dropped while running) — defeating #413 B.8/C.12 in the main path.
2. **GAP 2 (governance/evidence)** — the new spec's frontmatter cited an INDEPENDENT_REVIEW evidence path that did not exist at the reviewed head and recorded no `accepted_reviewed_head`.

Non-blocking notes (r1): census §3.1 lineage stamp 514ab7b0 not resolvable in this repo (provenance annotation required — conclusion independently confirmed against the live tree instead); snapshot-restore omitted stop_confirmed ("verbatim" inexact on the refusal path); pre-existing post-spawn identity window (same class as start_execution); codex tasks always have turn "unknown" (bounded by budget); engine constructor mkdirs the ledger dir (no append).

## Round 1 → 2 fixes

- GAP 1: `stop_confirmed` added to the admission snapshot (verbatim restore on refusal) and explicitly cleared in the reserve-before-spawn update after successful admission; new happy-path regression `test_continued_writer_stays_running_across_next_monitor_ticks` (monitor driven past the continuation while the resumed writer is alive: stays running, no terminal receipt/label, handle retained). agent-control fix commit: "E12 r1-review fixes … closes GAP 1".
- GAP 2: this evidence file committed; census §3.1 provenance annotation added (live-tree verification is the load-bearing evidence; the unresolvable stamp marked as reported provenance only); `accepted_reviewed_head` recorded in the spec frontmatter at r2.

## Round 2 — VERDICT: (recorded after re-review below)
