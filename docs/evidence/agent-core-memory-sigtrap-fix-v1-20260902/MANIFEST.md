# MANIFEST — agent-core-memory-sigtrap-fix-v1-20260902

TASK_NAME = 崩溃 执行 (AGENT_CORE_MEMORY_SIGTRAP_FIX_V1, GOAL_DRIVEN_PRODUCTION_FIX)
Production change: `/usr/local/libexec/agent-core/app/packages/agent-memory/src/memory.js`
(replaced with audited artifact, sha256 `99d59bdeb055e18d7827d5529f2505783252e6b75124f8fb45c91d5a96bf2b7d`,
root:wheel 0644, 27874 bytes) + in-place repair of the four specified corrupted
MEMORY.md files (each with immutable 0400 timestamped backup + sha256 sidecar).
All other production surfaces untouched. Report: `docs/reports/agt-core-memory-sigtrap-fix-v1.md`.

## Contents

| file | description |
|---|---|
| `commits.txt` | fix branch commits over origin/main (d4802a9 + revise c21c8f3) |
| code record | fix branch `agent-memory-sigtrap-fix-v1` commits d4802a9 + c21c8f3 on top of origin/main 840d2f4 (commits.txt); full diff kept out of git on purpose (unified-diff blank context lines trip --check) — available at `~/workspace/sigtrap-fix-v1-sandbox/deploy/logs/full-diff-vs-base.patch` and regenerable via `git diff 840d2f4..c21c8f3` |
| `test-run-83.txt` | full agent-memory suite run, 83/83 PASS (production node runtime, sequential) |
| `census.mjs` + `census-{hr,efficiency,shopping,ceo}-MEMORY.md.json` | read-only census over isolated copies: entry counts, amplified-source layers (max 25), unique recovery candidates |
| `agent-memory-sigtrap-migration-v1.mjs` | sealed copy of the r2 migration tool (sha256 `0c0945bb1579235ab9e526471a5ab39696d99060ceffad9ee2c5832e78250a02`) |
| `migration-drill.txt` | Phase 4/5 drill on four isolated real copies: ALL PASS (dry-run purity, apply, mode preservation, 100x real-disk writeEntries byte-idempotent, backup sha==preimage, exact rollback, idempotent re-apply) |
| `dryrun-report-{hr,efficiency,shopping,ceo}.json` | independent auditor's own dry-run reports (rewrites 10/9/3/1, 0 ambiguous, refused=null) |
| `audit-r1-verdict.txt` | independent audit r1: AUDIT_PASS, REQUIRED_FIXES=none |
| `audit-r2-verdict.txt` | independent delta re-audit r2: RE_AUDIT_PASS (all r1 recommendations adopted) |
| `root-step.sh` | root-side step script (preimage verify -> audited install -> verify -> kickstart; bash + set -euo) |
| `run-sigtrap-fix-deploy-v1.sh` | full transaction runner (dialog variant; aborted pre-mutation when owner was away; superseded by the two-script owner execution) |
| `post-root-steps.sh` not sealed separately — identical logic to the runner's P3-P6, full transcript below | |
| `owner-execution-transcript.txt` | verbatim owner-executed output (both scripts) + honest note on the aborted zero-mutation dialog attempt |
| `post-root-20260902T043920.log` | complete post-root execution log (P3a/P3b/P4/P5/P6, POSTVERIFY_ALL_PASS) |
| `apply-report-ceo-only-survivor.json` | the only surviving apply-time report (per-agent report filenames collided in the shared report dir — hr/efficiency/shopping apply reports overwritten; their content is reproducible byte-identically and fully covered by dryrun reports + backups + drills; honest gap, noted) |
| `production-post-state.txt` | installed artifact ls/sha, runtime state pid 75917, four files post-state (sizes/shas/mode/uid, tmp_residue=0) |
| `canary-watch.mjs` + `canary-watch-run2.txt` + `canary-watch-result.json` | production canary observation (writes after 04:41:30Z verified with the INSTALLED code): **observedTurns=1 (agt_ceo-agent real turn 12:53 local): parse/renderFixpoint/stable/writeDrill all PASS, entries 112->115, size 51151->52226, maxSource 51 — MEMORY_PERSISTENCE via a real repaired-agent turn, AGENT_PROCESS_SURVIVES=YES** |

## Verification quick facts

- installed memory.js sha256 = `99d59bdeb055e18d7827d5529f2505783252e6b75124f8fb45c91d5a96bf2b7d` (== audited HEAD c21c8f3 blob)
- live preimage before install = `239cd5ed488886ee9c66900112e7203ce7b6a9432efa1365d550787a2bfeabcc` (== base 840d2f4)
- four MEMORY.md migrated shas: hr `da831a34…`, efficiency `fbf1e471…`, shopping `c9a20704…`, ceo `bd3a866b…` — byte-identical to the sandbox drill outputs (41,365 / 37,926 / 57,416 / 51,151 bytes)
- NEW_MEMORY_SIGTRAP after deploy = 0; runtime pid 75917 running
- pre-migration backups (0400 + sidecar): `~/workspace/sigtrap-fix-v1-sandbox/deploy/migration-backups/agt_*/MEMORY.md.pre-sigtrapfix-v1-*`
