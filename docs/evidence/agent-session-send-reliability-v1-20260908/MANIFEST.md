# MANIFEST — agent-session-send-reliability-v1-20260908 (Phase 1)

- goal: AGENT_SESSION_SEND_RELIABILITY_V1 (RESUME_GOAL)
- phase: PRODUCTION_TRUTH_AND_EXISTING_AUTHORITY_RECOVERY → ROOT_CAUSE delivered
- fresh-truth base: origin/main @ 1cde3cc (Merge PR #200 sched-cp-rel-amend1)
- live tree compared: /usr/local/libexec/agent-core/app (deployed 2026-09-05 07:02)
- production mutation: NONE (read-only + in-process stubbed probes)
- node for all runs: /usr/local/libexec/agent-core/node-runtime/bin/node (v25.6.1, pinned) + proxy-free env

## Files

- `ROOT_CAUSE_REPORT.md` — authority recovery, live-bytes hash comparison, mechanical call chain,
  the seven REPLY_UNAVAILABLE answers, two-dimension model truth table, classification
  (A + distinct outcome_unknown reconciliation gap), minimal-fix shape.
- `probe/discriminating-failure-injection.mjs` — real-module failure injection (12 cases) over
  accepted implementation with stubbed Router/audit; provenance: imports production-runtime +
  broker sources relative to the worktree root.
- `probe/RUN_OUTPUT.txt` — captured probe output (the mechanical evidence for §4/§5).
- `owner-evidence/collect-production-audit.sh` — Owner-side READ-ONLY audit outcome-mix collector;
  `--selftest` PASS 5/5 on temp fixture; run with `sudo bash <abs path> --run`.

## Baseline suites (fresh origin/main worktree .worktree/sess-send-reliability-v1)

- broker/test/agent-session-messaging.test.js — 14/14 PASS
- production-runtime/test/agent-session-messaging.test.js — 18/18 PASS
- production-runtime/test/agent-session-messaging-integration.test.js — 8/8 PASS
- preconditions discovered for worktree runs: pinned node v25.6.1 (compose gate), proxy env unset
  (compose gate), node_modules hybrid (main repo 49 entries + @deepseek-ai/@larksuite from the
  deployed app tree). Historical "environmental failures" were exactly these preconditions.

## Verdicts

- LIVE_IMPLEMENTATION_EQUALS_ACCEPTED_AUTHORITY = YES (session-send chain byte/semantic equal)
- REPLY_UNAVAILABLE_ROOT_CAUSE = A (post-receipt-only by construction; expression/consumption gap)
- OUTCOME_UNKNOWN_RECONCILIATION = MISSING (new normative semantic → docs-only amendment required)
- DEPLOYMENT_REGRESSION = NO
- PRODUCTION_APPLY = HOLD_WHILE_P0_OWNS_SLOT
