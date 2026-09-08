ACTIVE_GENERATION = PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1--dsh-agent-core--e9e5009--g1 (cutover DONE 2026-09-08: /usr/local/bin/agentcore-cron -> this sealed generation; receipts: suite r3 + audit r1/r2 + cutover-receipt.json incl. 9-item post-proof; SCHEDULER_OPERATOR_ARTIFACT_ISOLATION=ADOPTED_PASS)
SUPERSEDED = 37d6763--g1 (sealed; cutover ATTEMPT 1 FAILED functional smoke — missing ESM closure; rolled back same hour, never adopted), c11ac01--g1 (audited), 9c1e981--g1 (first freeze) — all retained
LESSON = multi-file ESM CLI needs full import closure inside candidate/ (packages/scheduler/src from commit tree + croner@10.0.1 at scheduler/node_modules ancestor level) + MANDATORY pre-cutover functional smoke from inside candidate/ (runbook §4)
LOCATION = ~/workspace/artifacts/production-candidates/ (authoritative bytes; production link consumes this generation directly)
FROZEN_AT = 2026-09-08
