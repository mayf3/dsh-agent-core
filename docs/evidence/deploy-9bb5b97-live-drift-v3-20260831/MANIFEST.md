# MANIFEST — deploy-9bb5b97-live-drift-v3-20260831

Investigation round: LIVE_MANIFEST_DRIFT_AND_DEPLOY_V3_PREP (2026-08-31). All production access read-only.

Files:
  live-manifest-20260831.txt
  three-way-comparison.txt
  model-overrides-diff-9bb5b97-vs-live.txt
  production-timeline.txt
  main-advanced-9386ac4.txt
  v3-check-run.txt
  run-agent-core-deploy-9bb5b97-v3.sh

live-manifest-20260831.txt        — live app manifest recomputed non-root with the runner algorithm (132 lines; sha256 of this file == 9ac84954… == reported LIVE digest)
three-way-comparison.txt          — reconstructions A/B/C + per-path OID table + model-overrides.js blob history + all-object search
model-overrides-diff-9bb5b97-vs-live.txt — unified diff 9bb5b97 vs live (exactly the 3-line guard removal)
production-timeline.txt           — ledger, backup READMEs/listings, backup blob cross-check, /tmp script sha256s, recent-mtime app files, fleet overrides state, health
main-advanced-9386ac4.txt         — github/main 9bb5b97..9386ac4 log + diffstat (2 app-surface files, undeployed)
v3-check-run.txt                  — v3 --check run transcript (rc=0 PASS, read-only)
run-agent-core-deploy-9bb5b97-v3.sh — sealed byte-identical copy of the v3 runner (sha256 a4b74918…)
