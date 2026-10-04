# W0 RELEASE-SAFETY (Product #430) — DEVELOPMENT_PREFLIGHT + RED/GREEN evidence

Date: 2026-10-02 · Base: origin/main@15cdfc33 · Branch: w0-release-safety-430

```text
DEVELOPMENT_PREFLIGHT

Problem =
  The trusted CP (scheduler-cp / DS tree) deploy creates a full-root preimage
  (mv /usr/local/libexec/agent-core -> agent-core.bak-<ts>) with NO hard
  disk-budget check and no cap on how many full-tree backups may pile up on
  the Data volume; disk exhaustion during the install window kills the deploy
  mid-mutation. W0 RELEASE-SAFETY (Product #430) requires a hard disk-budget +
  full-tree retention cap enforced BEFORE production mutation, reusing
  existing release/DS tooling only (no new backup service/daemon/DB/platform).

Governing Spec = AGENT_CORE_BACKUP_RETENTION_V1
  (docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md) — owns this exact surface
  (EXPECTED_IMPLEMENTATION_FILES = scripts/trusted-cp-deploy-install.sh +
  filesystem operator helper); Scope = backup metadata, pin semantics, normal
  retention, post-verification prune, minimal ops visibility (shell /
  filesystem only).
Spec status = accepted

Relevant investigations =
  docs/investigations/agent-core-backup-retention-v1-proposal.md
  (13-backup inventory, ~1.5–1.7 GiB/backup, unbounded retention,
  blind-mv broken captures)
Relevant decisions =
  none directly on point (backup lifecycle governed by the Spec above);
  PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1 §7 reuse map names
  trusted-cp-deploy-install.sh as the dsh face and §0b establishes the
  pre-mutation fail-closed gate pattern this gate follows.
Previously rejected alternatives =
  global retention service / DB ledger (rejected: shell/filesystem only);
  first-run keep-newest-3-delete-rest (rejected: legacy unprotected);
  data-copy pinning (rejected: pin = metadata/marker only);
  prune-before-install (FORBIDDEN by the accepted Spec — honored here by
  REFUSING at predeploy instead of auto-pruning; cleanup stays an explicit
  operator command on exact paths).
Frozen boundaries =
  pinned (marker OR meta) / legacy (no meta) / rollback_used / unknown-status
  backups KEEP and are never touched by this gate; pin stays metadata/marker
  only (no data copy); no LKG machine inference (FIRST_RELIABLE_PIN still
  requires AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES); NORMAL_RETENTION=3
  post-verified prune unchanged; agent-core.bak-YYYYMMDD-HHMMSS naming /
  rollback compat unchanged; no Runtime/Router/Scheduler/Kernel/
  product-semantics change; no concurrent-deploy guard introduced.
Implementation scope =
  scripts/agent-core-backup-ops.sh: --check-budget admission gate (floor =
  max(60 GiB, 10% of the Data volume); worst-case physical allocation,
  CLONE_PROOF=NONE; full-tree retention cap = live + max 1 pinned known-good
  + max 1 newest immediate-rollback preimage at/above the 20 GiB class;
  JSON receipt: DISK_FREE_BEFORE / LIVE_TREE_BYTES / ESTIMATED_PEAK_BYTES /
  DISK_FREE_AFTER_RESERVATION / retained backups before+after / pin reasons),
  --cleanup-exact (operator exact-path superseded-unpinned cleanup;
  wildcard-free; pinned/legacy/rollback_used/unknown protected; idempotent),
  additive pin_reason metadata; --pin <id> [reason...] backward compatible.
  scripts/trusted-cp-deploy-install.sh: section 0c fail-closed admission gate
  BEFORE the section-1 mv (and before first tree write on fresh installs);
  helper missing = refuse.
Out-of-scope =
  production deploy/restart/sudo/credentials/data mutation; deleting ANY
  production backup in this command; new backup service/daemon/watcher/DB/
  platform; clone-semantics discount (no mechanical proof exists — a future
  amendment may add it); scheduler-cp runtime code (untouched); #414 pinned
  known-good seam and the current immediate preimage behavior (preserved).
New evidence =
  Product #430 owner command (W0 RELEASE-SAFETY): disk exhaustion on the
  trusted deploy path is the release blocker. NOTE: svc-workflow Products
  #430/#386/#414 were NOT machine-readable this session
  (MISSING_WORKFLOW_CAPABILITY — no workflow_read/workflow_execute Broker
  tools in this session; direct API access is forbidden by the
  requirement-client skill). Requirements are grounded in the owner command
  text, which restates them in full, plus the repo authorities above.
Need new/amended Spec = NO
  (additive, fail-closed admission gate inside the accepted Spec's named
  files and scope; no frozen semantic modified: deletions still happen only
  post-verified-success (existing --prune) or by explicit operator
  exact-path command (--cleanup-exact); the gate itself only refuses.)
```

## RED-first evidence

Baseline = origin/main@15cdfc33 (pristine). New suite
`scripts/test-agent-core-deploy-disk-budget-v1.sh` against pristine:

- `--check-budget` = unknown command (helper exit 2) → G1/G2/G3/G4 dynamic
  rows RED; receipt absent → receipt-field rows RED; deploy static rows G7
  RED (no gate in deploy script); G8 pin_reason rows RED; G5 cleanup-exact
  rows RED.
- Already-accepted behavior pins (syntax rows, read-only/no-mutation rows,
  naming rows) GREEN at baseline by construction.

## GREEN evidence (this head)

- `scripts/test-agent-core-deploy-disk-budget-v1.sh` = 64 PASS / 0 FAIL.
- `scripts/test-agent-core-backup-retention-v1.sh` (existing, unchanged) =
  39 passed / 0 failed = PASS (AC1–AC11 + review fixes intact; proves the
  additive pin_reason / --pin [reason...] / budget additions did not disturb
  any frozen semantics).

Coverage map (task requirement → tests):
- projected-space refusal before any mutation → G2 (+G2 live-tree intact,
  no backup created)
- floor = max(60 GiB, 10% Data volume) → static defaults + G2b max() both
  directions + G2 refusal arithmetic
- worst-case physical allocation unless clone proven → G3 (sparse 50 MiB
  counted at logical size; logical > du-physical; clone_semantics_proof=NONE)
- live + 1 pinned + 1 newest preimage cap; third 20+GiB rejected →
  G4a (first admitted) / G4b (pinned+newest admitted) / G4c (refused) with
  exact-path guidance
- exception paths → G4e (open-Product pin exception admits, receipted)
- pinned backups protected → G4d (never in guidance), G5c (cleanup refuses),
  G4f legacy / G4g rollback_used protected + counted fail-safe
- exact-path cleanup after success/failure → G5 (exact removal, siblings
  intact), G5b (idempotent NOOP), G5c (guards; wildcards refused);
  failure path = gate refusal mutates nothing (G2)
- idempotent repeated attempts → G6 (same verdict/measurements; per-attempt
  receipt id)
- receipt fields → G1/G1b (all required keys + structured retained
  before/after + pin_reasons)
- deploy fail-closed integration → G7 (gate precedes the mv; MUTATION TRUTH;
  receipt path; helper-missing refuses; pin-exception seam propagated)
- #414 preservation → G8 (FIRST_RELIABLE_PIN pin_reason additive; --pin
  reason verbatim) + existing suite AC1–AC11 green

## Products note

#430 (this command), #386, #414 referenced per owner command. #414's pinned
known-good seam (AGENT_CORE_VERIFIED_PREDECESSOR_LKG / FIRST_RELIABLE_PIN)
is preserved and extended additively (pin_reason). PRODUCTION_MUTATION=NO.
