# SB2 ARTIFACT STATUS — R4 remaining artifacts completed (2026-09-05)

Goal: GLM_LUNA_FALLBACK_PRODUCTION_V1 · All work non-production (制备 only per Owner R4-R6 boundary: no runner bootstrap branch implemented, no unauthorized code frozen).

## Delivered in `deployment-artifacts/model-fleet-glm-luna-activation-prep-r4/`

| Artifact | State | Verification |
|---|---|---|
| CANDIDATE_CONTENT_V2/ (8 blobs from main 513c691 + BLOBS.manifest) | FROZEN | byte-identity vs origin/main git oids: 8/8 exact; SECRET_SCAN 0 hits |
| tools/v2_to_v3_migrator.mjs | READY | sandbox positive (v2→v3 + credentialFile injection + idempotent ALREADY_V3 replay) + negative (v2 credentialFile key rejected = outside v2 whitelist; unknown routeRef rejected; fail-closed exit 3) |
| tools/bootstrap_ten_gate.mjs | READY | sandbox: pre-phase PASS on 91-home fixture; negatives — gate 3 count mismatch, gate 4 byte divergence, gate 6 canonical pre-exist, gate 7 fence gap, gate 9 expired liveness — ALL correctly FAIL (exit 3) |
| tools/sandbox_migration_simulator.mjs | READY | **SIM_ALL_OK 16/16** (×2 runs, deterministic): migrator pos/neg, ten-gate pre pos, FULL migration-cli chain from the frozen candidate blobs over an installed-app-tree base (canonical copy-once 0600, config v3 canonical, fence recorded, artifact receipt exact, 4 canaries, rollback chain), 6 negatives |
| plans/P1_QUIESCE_FENCE.md … P5_FLEET_ROLLOUT_ROLLBACK.md | READY | quiesce/fencing, fresh-gate handoff, canary ladder, 5-agent small batch, fleet waves + stage-scoped rollback matrix; all keyed to CTR-SCA-017/CTR-ACT-006..012 verdict fields |
| bindings/TRANSACTION_BINDINGS.md | NOT_FINAL (by design) | 13 binding names/types/validation contract fixed; production argv values fill only inside the accepted activation round |
| SPEC_AMENDMENT_CANDIDATE.md | CANDIDATE | AMEND-1 blob base → main 513c691 (migration/compose decoupling via 07102da); AMEND-2 compose EXCLUDED from closure (installed e539ef45 stays); AMEND-3 roster N registry-bound (drift③); branch head dc22db8 untouched — Owner adjudicates at acceptance |
| MANIFEST.sha256 | REGENERATED | 36 files, full tree incl. receipts/sandbox_sim_2026-09-05.json |

## Remaining (gated, not artifacts)

- SB1: activation-spec acceptance (exact-head governance gate → Owner), adjudicating SPEC_AMENDMENT_CANDIDATE (V2 closure case) vs base-spec 8-file-with-compose case.
- Owner decision packet items: drift③ registry-N approval; drift ledger D4/D5 recorded in CLOSURE_REFREEZE_V2.md.
- Production apply: HOLD (PRODUCTION_MUTATION_CONCURRENCY=1; higher-priority goal owns the mutation lane). All apply-time mechanics are now script-complete: fresh gate → ten-gate pre → v2→v3 migrator → migration cli (--activate-production) → canaries → batch → waves, each with its receipt.
