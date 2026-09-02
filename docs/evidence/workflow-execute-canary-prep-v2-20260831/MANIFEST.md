# Evidence manifest — WORKFLOW_EXECUTE_CANARY_V1 fixture prep v2 (2026-08-31)

Preparation round for the combined-deploy canary fixture. PRODUCTION_CHANGE = NONE
this round (provisioning runner prepared + offline-proved; execution requires the
owner sudo command because the canary credential store is authsvc-private 0600).

| file | content |
|---|---|
| run-agent-core-workflow-canary-prep-v2.sh | sealed provisioning runner (owner command `sudo bash /tmp/run-agent-core-workflow-canary-prep-v2.sh`, phrase APPLY WORKFLOW_CANARY_PREP_V2); creates exactly 1 canary + 1 control disposable fixture via POST /internal/v1/workflow-instances as the frozen CTR-009 identity, freezes all facts, generates /tmp/agent-core-workflow-canary-v1.json and validates it with the VERBATIM sealed-runner validator (byte-diff proven); never touches allowlist/reload/transitions/SQL-writes |
| mock-e2e-harness.py | offline verification harness (local mock auth + svc-workflow + credential store + psql stub; sed-transformed runner copy; the sealed runner itself is never executed) |
| mock-e2e-run1-transcript.txt | full-run transcript, fresh path: G0→W8 all PASS, 2 instances created, CANARY_PREREQS_READY=YES |
| mock-e2e-run2-transcript.txt | idempotent rerun: adopts fixtures (SKIP create), config byte-identical (same sha256) |
| mock-generated-config.json | sample generated config (mock UUIDs; demonstrates exact field set/order) |
| negative-tests.txt | wrong phrase rc=1 / allowlist-present rc=1 (refuses) / non-root rc=1 |
| production-posture-read-only.txt | read-only production facts: canary gate env posture, frozen identity + roles, domain/definition graph, census, BLOCKER-1/2 evidence coordinates, prior prereq-v1 runner status (never executed) |

sha256 of each file: see MANIFEST.sha256.
