# MANIFEST — local-arm64-normalization-v1-20260907

Goal: LOCAL_NATIVE_ARM64_PLATFORM_NORMALIZATION_V1 (NEW_GOAL, P1_PLATFORM_PARALLEL)
Date: 2026-09-07
Round r1: FRESH_HOST_ARCHITECTURE_CENSUS → dependency graph → classification →
PHASE 2 BATCH-1 (six CLASS B CLIs normalized to ARM-native).

Contents:
- 00_CENSUS.md — structured census of record (required fields + headline findings)
- 01_DEPENDENCY_GRAPH.md — active infrastructure dependency graph (D1–D11)
- 02_CLASSIFICATION.md — A–H classification frozen pre-mutation; batch-1 designation
- 03_PHASE2_BATCH1.md — BATCH-1 per-tool closure (frozen)
- 04_AUDIT_TRAIL.md — r1 audit REJECT → bounded repair → re-audit ACCEPT (final)
- MANIFEST.sha256 — sha256 of all files in this directory tree
- scripts/ — census-part1.sh, census-part2.sh (read-only), batch1-cli-normalize.sh,
  batch1-continue.sh (the only mutation-bearing scripts, scope = six ARM brew installs)
- raw/ — 33 raw evidence files (numbering skips 28; sanitized: plists + profiles
  redacted; no credentials)

Mutation boundary of this round:
- Installed via /opt/homebrew/bin/brew: uv, wget, tmux, starship, cmake, deno (ARM-native).
- NOTHING uninstalled. NOTHING restarted. NO PATH/launchd/profile edits. NO sudo.
- DSH/Agent Core production surfaces (authsvc runtime, scheduler runtime, luna harness,
  dsh-lark, postgres, syncthing, tailscaled, svc-workflow, irbridge, videobridge,
  article-review-canary) UNTOUCHED — evidence only.

Post-batch production health check obligation: production services were never touched;
no health delta possible from this round (user-level CLI installs only).
