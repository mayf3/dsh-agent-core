# 03_PHASE2_BATCH1 — first bounded CLI normalization batch (FROZEN)

BATCH-1 executed 2026-09-07 08:04–08:07 CST. CLASS B only, one tool at a time, each with
independent install + verification + rollback. No PATH edits, no launchd edits, no
uninstalls, no service mutations. P0 (workflow assignee reconciliation) untouched —
this batch is user-level stateless CLI work, sanctioned to run in parallel.

| TOOL | OLD_PATH (x86_64) | OLD_ARCH | NEW_PATH (arm64) | NEW_ARCH | NEW_VERSION | FUNCTION | PATH_RESOLUTION | ROLLBACK |
|---|---|---|---|---|---|---|---|---|
| uv/uvx | /usr/local/bin/uv | x86_64 | /opt/homebrew/Cellar/uv/0.12.10 | arm64 | 0.12.10 | PASS (venv vs ARM python3.14) | ARM (interactive) | `brew uninstall uv`; Intel copy retained |
| wget | /usr/local/Cellar/wget/1.25.0 | x86_64 | /opt/homebrew/Cellar/wget/1.25.0 | arm64 | 1.25.0 | PASS (http roundtrip r2) | ARM (interactive) | `brew uninstall wget`; Intel retained |
| tmux | /usr/local/Cellar/tmux/3.6a | x86_64 | /opt/homebrew/Cellar/tmux/3.7c | arm64 | 3.7c | PASS (detached session lifecycle) | ARM (interactive) | `brew uninstall tmux`; Intel retained |
| starship | /usr/local/Cellar/starship/1.24.2 | x86_64 | /opt/homebrew/Cellar/starship/1.26.0 | arm64 | 1.26.0 | PASS (preset list) | ARM (interactive; .zshrc:174 name-based init auto-flips) | `brew uninstall starship`; Intel retained |
| cmake | /usr/local/Cellar/cmake/4.3.1 | x86_64 | /opt/homebrew/Cellar/cmake/4.4.3 | arm64 | 4.4.3 | PASS (NONE-language configure) | ARM (interactive) | `brew uninstall cmake`; Intel retained |
| deno | /usr/local/Cellar/deno/2.8.0 | x86_64 | /opt/homebrew/Cellar/deno/2.9.6 | arm64 | 2.9.6 | PASS (offline eval) | ARM (interactive) | `brew uninstall deno`; Intel retained |

Per-tool proof file: raw/32-batch1-proof.txt. Install logs: raw/33. Function tests: raw/34.

## Incidents during batch (honest record)

1. Initial wget function test FAILed due to a defect in the TEST (server root /tmp vs URL
   /etc/hosts → 404), not the tool. Corrected roundtrip r2 = PASS. Test harness defect
   also caused the first batch script to exit early (`exit` inside eval) — fixed by
   subshell isolation in batch1-continue.sh.
2. tmux VERSION line in proof file shows an option error (`--version` unsupported) —
   superseded by corrected `tmux -V` → 3.7c recorded.
3. starship initial function test was a FALSE PASS (`starship preset list` invalid under
   new CLI syntax; `| head -3` masked the exit code). r1-audit caught it; repair pass ran
   corrected `starship preset -l` → PASS (raw/32 repair section).
4. Per-tool HARD_CODED_X64_REFERENCE check was recorded for uv only in the first run and
   omitted from batch1-continue.sh. Repair pass completed it for all six tools → 0 files
   each (raw/32 repair section). The census-level claim (raw/26+27) was independently
   re-verified by the r1 audit.
5. batch1-continue.sh ran unconditional `tmux kill-server`. No harm (raw/02 shows zero tmux
   processes pre-batch), and scripts stay as evidence of what ran; future batches drop it.

## Scope honesty

- PATH_RESOLUTION=ARM holds for interactive/user shells (the user's normal resolution).
  Login non-interactive shells still see /usr/local/bin first (path_helper) — this is the
  deferred PATH normalization (Phase 3/4, gated on Node/Python consumer map + sudo-gated
  /etc/paths decision), documented in 02_CLASSIFICATION.md.
- HARD_CODED_X64_REFERENCE=0 for all six tools, grounded in census raw/26 (profiles,
  launchd) + raw/27 (repo scripts, 565 hits all node-family/DSH-owned, none referencing
  these six CLIs) + per-tool check in raw/32.

## Next phases (same Goal, unchanged)

PHASE 3 developer tools/native-addon-sensitive (claude cask, rustup, bun, Intel Python
consumer map, svc-workflow arm64 rebuild prep) → PHASE 4 launchd/path normalization →
PHASE 5 stateful services (PG/Syncthing packets, cutover slot-gated) → PHASE 6 Intel
Homebrew retirement readiness (gates in dispatch, none met yet by design).
