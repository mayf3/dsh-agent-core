# Evidence manifest — AGT_CORE_COMBINED_DEPLOY_V2_AUTHORING (2026-08-31)

Authoring round for the combined Workflow+Forum production deploy runner.
PRODUCTION_CHANGE = NONE (read-only authoring; runner never applied).

| file | content |
|---|---|
| census-live-manifest.txt | freshly recomputed production app manifest (132 files, sha256 9ac84954…) |
| census-target-manifest.txt | mechanically derived TARGET manifest (134 files, sha256 865b6569…) |
| census-diff.txt | exact OID census live vs github/main@2392a41 + classification inputs |
| check-output.txt | read-only `--check` execution (CHECK=FAIL fail-closed: canary config not yet generated; all other gates PASS) |
| smoke-sim-output.txt | combined smoke program executed against the real TARGET_MAIN blobs in a simulated live-layout tree (all sections PASS) |
| validator-fixtures-output.txt | canary prereq validator fixture matrix (valid/placeholder/secret/wrong-identity/missing) |
| receipt-template.json | the new durable receipt template (also embedded in the runner) |
| run-agent-core-combined-deploy-v2.sh | sealed byte-identical copy of the new runner |

sha256 of each sealed file: see MANIFEST.sha256.
