# PRODUCTION_CANDIDATE_MIGRATION_RUNBOOK_V1

**governing spec:** `docs/specs/PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1.md` (accepted)
**scope:** how each production surface adopts the generation contract for its NEXT candidate. No retroactive re-sealing of live artifacts. All applies are `PRODUCTION_MUTATION_CONCURRENCY = 1` and slot-gated behind P0 `WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1`.

## 0. Common contract (the only new seam)

Runner: `scripts/production-candidate-runner.mjs` (node stdlib only).

```
PREPARE  $ runner prepare --spec <spec.json>   # spec: goalName/sourceRepo/sourceSha/arch/sourceMode
         #                                      targets[]: {sourcePath|fromPath, targetPath, why}
         #                                      optional dependencyClosure {sourcePath, installPath}
         #                                      optional liveRoot (fixtures); default real absolute paths
SEAL     $ runner seal    --gen <genDir>        # MANIFEST.sha256 + seal.json (pins runner sha256)
VERIFY   $ runner verify  --gen <genDir>        # fresh re-hash any time (slot-wait drift check)
APPLY    $ runner apply   --gen <genDir>        # gates: runner-pin → seal → bytes → preimage → closure
         #                                      any drift = FAILED_NO_MUTATION (zero writes)
ROLLBACK $ runner rollback-restore --gen <dir>  # frozen preimage, hash-verified before restore
RECEIPT  $ runner receipt --gen <dir> --type test|audit --file <f>
```

Generation root: `~/workspace/artifacts/production-candidates/<GENERATION_ID>/` (outside every shared checkout and live stage). Any byte change ⇒ prepare a NEW generation (allocator gives g<N+1> per coordinate); never edit a sealed generation. Old generations stay audit-valid forever.

## 1. auth-service (SB-A)

Today: build happens inside the live stage worktree; BUILD_MANIFEST digests are never re-verified at apply (census §2.1). Migration for the next candidate:

1. `prepare` with `sourceMode=worktree` at a clean auth-service checkout (or `git-show` for committed files), `dependencyClosure` = the npm-ci'd `node_modules` built in an isolated dir, targets = `dist/**` + the launchd plist. Reuse the BUILD_MANIFEST field set — it seeds `manifest.toml` 1:1 (SOURCE_COMMIT→SOURCE_SHA, TOOLCHAIN→BUILD_TOOLCHAIN, digests→per-target hashes).
2. `seal` → slot-wait (`verify` at will; bytes frozen).
3. At slot: `apply` into the NEW stage dir (fresh target paths ⇒ preimage ABSENT sentinels), then the plist cutover (plist is its own sealed target; `plist.bak-*` convention stays), then the existing dual-context boot smoke. Rollback = `rollback-restore` + retained prior stage dir.

## 2. svc-workflow (MF-2)

Today: cargo build in a shared checkout, unverified `cp` into the service dir, live binary has no releases entry (census §2.2). Migration:

1. Build `cargo build --release` in a CLEAN worktree (runner `worktree` mode refuses dirty).
2. `prepare` with `fromPath = target/release/svc-workflow`, `targetPath = /Users/yanfenma/.local/services/svc-workflow/svc-workflow`.
3. `seal` → wait → `apply` (preimage gate refuses if the live binary moved since seal). Record the generation in the content-addressed `releases/` layout (copy `candidate/` binary as `releases/<CANDIDATE_HASH>/`) — the deploy bypass closes here.
4. Rollback = `rollback-restore` (replaces ad-hoc timestamped backups; keep them during the transition).

## 3. dsh-agent-core (MF via trusted-cp closure; live-runtime = FU-1)

Today: installer ships whatever worktree bytes invoke it; partial "双文件" redeploys have no closure manifest (census §2.3). Migration:

1. `prepare` from the implementation worktree at a clean HEAD (worktree mode) or from committed SHAs (git-show); `dependencyClosure` = the harness/node_modules closure built in an isolated dir; targets = the exact `/usr/local/libexec/agent-core/{app,harness}` files the closure changes.
2. `seal` → wait → `sudo apply` (root-writable install face; the runner is deterministic hash+copy). Full-closure installs and targeted file redeploys BOTH go through generations — no more unsealed partial copies.
3. `current live-runtime provenance` (user-domain runtime executing from `production-dsh-agent-core`, scheduler-v2 from `dsh-agent-core-main`) is **FU-1/FU-2**, slot-gated — this runbook deliberately does NOT touch runtime ownership.

## 4. Scheduler operator CLI (SB4 packaging; ACTIVE GENERATION FROZEN)

Active sealed generation (2026-09-08 — **CUTOVER DONE**, SCHEDULER_OPERATOR_ARTIFACT_ISOLATION = ADOPTED_PASS):

```
~/workspace/artifacts/production-candidates/PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1--dsh-agent-core--e9e5009--g1   ← ACTIVE, PRODUCTION
  SOURCE_SHA e9e5009 (git-show) · target /usr/local/bin/agentcore-cron (symlink INTO this sealed generation, atomic rename swap)
  candidate = operator CLI + FULL ESM closure (packages/scheduler/src/{store,job-model,schedule}.js from commit tree
              + croner@10.0.1 at candidate/usr/local/packages/scheduler/node_modules — ESM resolves imports from the
              module REAL path, so the closure must mirror repo-relative layout + node_modules ancestor levels)
  CANDIDATE_HASH == production operator bytes = 24ce44e7… · runner pin 90f82a68…
  receipts: suite r3 (47 assertions) + audit r1/r2 + cutover-rollback.json + cutover-receipt.json (9-item post-proof)
superseded (retained):
  …--37d6763--g1  cutover ATTEMPT 1 — FAILED functional smoke (single-file candidate, no ESM closure →
                  ERR_MODULE_NOT_FOUND); rolled back same hour; never adopted. cutover-failed-receipt.json on the generation.
  …--c11ac01--g1 (audited) · …--9c1e981--g1 (first freeze)
```

**MANDATORY pre-cutover step (added after attempt 1):** before ANY link swap, smoke the candidate from INSIDE the
generation — `node <gen>/candidate/<target> --help` and at least one real read-only op (e.g. `list --json` with an
isolated `HOME=`). A link whose target only LOOKS right is not a pass; ESM module resolution and dependency closure
defects surface only by execution. `--help` exits 2 by this CLI's design — judge by output, not exit code.

Cutover (slot-gated, coordinates with SB4 `CLI_BYTES_MATCH_EXPECTED` / `CLI_STORE_TARGET`):

1. `$ runner verify --gen <gen>` — fresh re-hash, must be OK.
2. Replace the worktree symlink with a link INTO the sealed generation (atomic, receipted):
   `sudo ln -sfn <gen>/candidate/usr/local/bin/agentcore-cron /usr/local/bin/agentcore-cron`
   After this, production CLI bytes live in a sealed, read-only-disciplined generation — the symlink-to-dev-worktree violation is retired. (`runner apply` intentionally REFUSES symlinked targets — gate3 `TARGET_IS_SYMLINK` — so the link swap is an explicit, receipted operator step, not a silent write-through.)
3. Verify: `shasum -a 256 $(readlink -f /usr/local/bin/agentcore-cron)` == manifest `CANDIDATE_HASH`; `runner verify --gen <gen>` OK; append the cutover evidence to the generation's receipts.
4. If the dev worktree drifted between seal and cutover, nothing to clean up — the sealed generation never contained worktree bytes.

## 5. Drift during slot wait

At any `verify` before apply: DRIFT ⇒ do not repair. Prepare a new generation (g<N+1>); the drifted one stays for audit. Two Goals preparing concurrently is safe by construction (disjoint per-GENERATION_ID dirs; suite T8).
