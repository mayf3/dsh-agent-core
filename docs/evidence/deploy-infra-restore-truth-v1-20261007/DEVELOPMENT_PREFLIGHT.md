# DEVELOPMENT_PREFLIGHT — Product #477 (G4) deploy-infra restore-truth slice

```text
DEVELOPMENT_PREFLIGHT

Problem =
  B7 fail-closed deploy sequence (2026-10-01/02, Product #414 execution log) proved two
  remaining gaps in the repo's OWN trusted deploy tooling (scripts/trusted-cp-deploy-install.sh):
  (a) NO-MUTATION-RECEIPT: only the §8 /Users/yanfenma late gate carries mutation-truth
      text; the §7 helper gate, §8 symlink-escape gate, §9 uid-502 spot check and ANY
      `set -e` failure after the §1 preimage mv exit with no mutation truth — the exact
      "wrapper reported NOTHING was deployed while the app tree WAS written" class B7
      recorded (its DONE_WHEN item 4).
  (b) PREIMAGE-COMPLETENESS (deploy-infra TOCTOU on the rollback preimage): §1b reuse
      silently mv's node-runtime/harness/.cache OUT of the fresh $BAK, so a later
      restore from that .bak lands without node-runtime (boot-fatal). RESTORE-R1 fired
      live 3× (agent-control#191/#193/#195); the repo tooling still records nothing.

Governing Spec =
  docs/specs/AGENT_CORE_BACKUP_RETENTION_V1.md — status: accepted IN THIS REPO at
  base d1e42f21; EXPECTED_IMPLEMENTATION_FILES names scripts/trusted-cp-deploy-install.sh
  (+ operator helper); failure semantics: a failed deployment must never reduce
  rollback capacity; Pin Model sanctions sidecar markers — covers the reuse record.
  docs/reports/trusted-control-plane-deployment-hardening-v1.md — accepted
  verification record (32/32 PASS) for the installer's own authority surface.
  PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1 (detection-not-prevention,
  receipts doctrine): accepted copy is NOT present in this repo at base d1e42f21
  (canonical copy lives on a shared branch; docs/investigations census OBS-DCP-001:
  do not transplant its acceptance status) — its doctrine is cited as background
  only; acceptance status is NOT claimed for this base.

Spec status = accepted (AGENT_CORE_BACKUP_RETENTION_V1 + hardening record, in-repo);
  stage-isolation doctrine = background citation only, no acceptance claimed here

Relevant investigations =
  docs/investigations/PRODUCTION_STAGE_ISOLATION_CENSUS_V1.md;
  docs/investigations/agent-core-backup-retention-v1-proposal.md;
  B7 evidence on main: docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/
  {OPERATION_PACKAGE_V2.md, PRODUCTION_EXECUTION_LOG-20261002.md, RED_GREEN_WATCHDOG_OWNERSHIP-20261002.txt}

Relevant decisions =
  §5b ownership split per PRODUCTION_INTEGRATION_V1 (unchanged; guarded byte-wise by
  scripts/lib/trusted-cp-watchdog-ownership-guard.test.mjs — kept intact);
  SCHEDULER_INCIDENT_OWNER_GID=20 pin per SCHEDULER_CONTROL_PLANE_RELIABILITY_V1.

Previously rejected alternatives =
  global retention service/DB (rejected, BACKUP_RETENTION_V1 Alternatives);
  auto-rollback inside the installer (never accepted — rollback authority stays the
  operator/preimage mv; this slice adds truth, not auto-repair);
  B7 custody-census readFileSync fix (frozen digest-bound packet material, Product
  #414 lane — OUT OF SCOPE here; do not touch docs/evidence/shared-codex-*).

Frozen boundaries =
  §5b pinned-set shape (guard test extracts its find filters verbatim);
  .backup-meta metadata model untouched (reuse record = spec-sanctioned sidecar file,
  prune-eligibility untouched — uncertain/legacy still KEEP);
  prune/pin semantics byte-identical; no Runtime/Router/Scheduler/Kernel/product change;
  fail-closed exit semantics unchanged (receipt is post-failure truth only);
  exact-path operations only, no wildcard cleanup; PRODUCTION_DEPLOY_LOCK mutex + B6
  composed EXIT cleanup semantics preserved.

Implementation scope =
  scripts/trusted-cp-deploy-install.sh — ADDITIVE only: initialized globals; three
  functions (note_stage / note_preimage_reuse / emit_mutation_receipt); EXIT-trap
  wiring into the EXISTING composed cleanup; one-line stage notes at section
  boundaries; §1b marker writes; new no-root TRUSTED_CP_SELFTEST_RESTORE_TRUTH block;
  header docs.
  scripts/test-trusted-cp-restore-truth-v1.sh — NEW focused RED-first suite.

Out-of-scope =
  B7 frozen packet + custody census script (Product #414 lane, digest-frozen);
  scripts/agent-core-backup-ops.sh (frozen semantics — untouched);
  scripts/production-candidate-runner.mjs (already has TOCTOU gate3b — untouched);
  agent-control relay/dispatcher surfaces (Product #394 / agent-control#506 live writer);
  any production deploy/restart/sudo/credential/data mutation.

New evidence =
  B7 v2.1/v2.2/v2.3 production execution log 2026-10-02 (wrapper-truth defect #191;
  RESTORE-R1 live #193/#195; §5b gid flip #193) — repo tooling never absorbed the
  uniform receipt + preimage-record halves of those lessons.

Need new/amended Spec = NO
  (no frozen semantic changes; the reuse marker uses the Pin Model's sanctioned
  sidecar form; changed file is exactly the spec's expected implementation file.)
```
