# Evidence manifest — AGT_CORE_COMBINED_DEPLOY_V2_INDEPENDENT_REVIEW (2026-08-31)

Independent combined deployment review of /tmp/run-agent-core-combined-deploy-v2.sh (sha256 18c1fdc6…).
PRODUCTION_CHANGE = NONE (read-only review: git reads, live-tree hashing as non-root, one read-only runner --check, zero writes, zero sudo, zero reloads).

| file | content |
|---|---|
| 01-runner-seal.txt | runner sha256 seal (dispatch match) + authoring sealed copy equality |
| 02-git-authority.txt | Audit 1: fresh fetch, HEAD_DRIFT result, ancestor checks, PR #127 scope, 9 blob pins, spec statuses, CTR-009 identity authority |
| 03-live-manifest-recompute.txt | Audit 2: independent 132-file live manifest (9ac84954…) via the runner's own algorithm |
| 04-census-live-vs-target.txt | Audit 2: OID census vs TARGET_MAIN (exact 6+3+2 closure; no test files; bundle pin) |
| 05-census-live-vs-newmain.txt | diagnostic: live drift scope vs new main 1fdf8c36 (13 paths) + PR #127 new files (out of authority) |
| 06-target-manifest-derivation.txt | Audit 2: mechanical TARGET manifest derivation (134 / 865b6569… exact) |
| 07-check-run.txt | read-only --check this round: rc=2 at fresh-main gate (fail-closed HEAD_DRIFT) |
| 08-code-content-verification.txt | Audits 4/5: target-blob code content (workflow 7 manifests / single POST; forum packs / scopes; moderator closed list; DEFAULT_MANIFESTS; bundle config; sanitizer wiring) |
