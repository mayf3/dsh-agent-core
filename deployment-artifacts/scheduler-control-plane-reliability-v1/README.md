# SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 — production deployment packet (templates)

Status: TEMPLATES ONLY. Every install/apply step here is SLOT-GATED behind
P0 (PRODUCTION_MUTATION_CONCURRENCY = 1) + fresh census, per spec §8.
Source authority: docs/specs/SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.md (accepted).

Contents:
- desired-state.example.json — schema example; production manifest is Owner-frozen at preflight.
- ai.agent-core.scheduler-watchdog-w1.plist.tmpl — SB3 watchdog (authsvc, 5m).
- ai.agent-core.scheduler-watchdog-w2.plist.tmpl — SB5 second observer (root, 15m; mutual heartbeat).
- RUNBOOK.md — the frozen apply/rollback sequence (written at packet round; not in this commit).

Apply sequence (summary — the RUNBOOK is normative):
1. Freeze desired-state manifest (Owner reviews critical inventory; one-shot logicalKey
   backfill for legacy jobs via updateJobOp, audited).
2. Install pinned CLI: replace /usr/local/bin/agentcore-cron symlink (currently -> stale dev
   worktree 7a4e4864) with the live-app tree copy (b476038a+); set AGENTCORE_EXPECTED_STORE.
   Proof gates: CLI_BYTES_MATCH_EXPECTED / CLI_STORE_TARGET=CANONICAL /
   CLI_MUTATION_SEMANTICS_MATCH_BROKER.
3. Deploy broker/scheduler sources (readiness gate + reconcile) with ONE runtime restart.
4. Install W1/W2 launchd jobs from these templates; verify mutual heartbeats; fire TEST-G/H.
5. Post-verify: §6 eight CAN_* questions via the §7 test evidence; rollback = per-step
   preimages (plist unload, CLI symlink restore, manifest removal) — each reversible.
