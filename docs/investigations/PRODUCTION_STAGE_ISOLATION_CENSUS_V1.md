# PRODUCTION_STAGE_ISOLATION_CENSUS_V1

**spec_id (evidence authority for):** `PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1` (draft, `docs/specs/`)
**date:** 2026-09-08
**type:** investigation (evidence authority — grants no implementation permission)
**method:** minimal fresh mechanical enumeration (read-only) + imported incident evidence. Incidents themselves NOT re-investigated, per goal order.
**imported_incidents:** (1) auth deployment candidate/stage polluted during production-slot wait by another Goal's uncommitted modifications; (2) during P9, auth stage bundle observed containing another Goal's 1.11.0 uncommitted modifications; (3) `PRODUCTION_MUTATION_CONCURRENCY = 1` exists for apply, with no equivalent isolation for staging/candidate preparation.

---

## 1. Live production surface map (observed 2026-09-08, read-only)

| Component | Live entrypoint (launchd) | Live pid @ census | Executed bytes live on |
|---|---|---|---|
| auth-service | `/Library/LaunchDaemons/com.auth-service.plist` → `node <stage>/dist/src/server.js`, user `authsvc` | 63442 | `production-auth-service-2cf27a64b17b36592b14634ac1f791f84a10d359/` (git worktree, **12 dirty files**) |
| dsh-agent-core (canonical runtime) | `/Library/LaunchDaemons/ai.agent-core.runtime.plist` → `/usr/local/libexec/agent-core/app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core`, user `authsvc` | 69515 | `/usr/local/libexec/agent-core/app` (root-owned installed closure) |
| dsh-agent-core (user-domain runtime) | `~/Library/LaunchAgents/ai.agent-core.runtime.plist` → wrapper `~/.agent-core/control/agent-core-runtime-glm53-wrapper.zsh` | 35940 | `production-dsh-agent-core/scripts/production-runtime.mjs` (git clone main@549dace, **13 dirty files**, untracked route-chain canary files) — runtime executes from a dirty checkout |
| dsh scheduler-v2 runtime | `~/Library/LaunchAgents/ai.agent-core.scheduler-v2.plist` → `node /Users/yanfenma/workspace/project/dsh-agent-core-main/scripts/production-runtime.mjs --root ~/.agent-core-scheduler-v2` | 60339 | dev checkout `dsh-agent-core-main` (mutable) |
| svc-workflow | `~/Library/LaunchAgents/com.svc-workflow.plist` → `~/.local/services/svc-workflow/svc-workflow` | 34538 | installed binary (sha256 `4e5d764c…`, deployed 2026-09-07 22:56) |
| scheduler operator CLI | `/usr/local/bin/agentcore-cron` (symlink) | n/a | **symlink → `/Users/yanfenma/workspace/project/dsh-agent-core/scripts/agentcore-cron.mjs`** — bytes are the live dev checkout's bytes (checkout currently on docs branch with dirty broker files) |

## 2. Per-component census grid

### 2.1 auth-service

```
SOURCE_CHECKOUT              = /Users/yanfenma/workspace/project/auth-service (github main) + ~40 sibling worktrees
STAGE_LOCATION               = /Users/yanfenma/workspace/project/production-auth-service-<sha-or-tag>-<optional-ts>/ (9 generation dirs retained)
STAGE_OWNER                  = yanfenma (tree) + authsvc (.env, 0600); launchd runs as authsvc from inside the stage dir
STAGE_MUTABLE                = YES — LIVE stage 2cf27a64… is a writable git worktree; 12 dirty files in
                               contract-bundles/minimal-auth-v1/** observed 2026-09-08 while serving pid 63442;
                               .git mtime 09-07 23:08, generated/ mtime 09-08 05:26 (post-cutover mutations into live stage)
BUILD_LOCATION               = in-stage (npm ci + build → dist/, generated/)
DEPENDENCY_INSTALL_LOCATION  = node_modules inside stage (BUILD_MANIFEST: "npm ci 207pkgs; chmod -R a+rX node_modules dist")
PRODUCTION_ENTRYPOINT        = /Library/LaunchDaemons/com.auth-service.plist → dist/src/server.js (plist mtime 09-07 17:07 = last cutover)
PREIMAGE_CAPTURE             = ad hoc: prior stage dirs retained; /Library/LaunchDaemons/com.auth-service.plist.bak-*
POSTIMAGE_MANIFEST           = BUILD_MANIFEST.txt written at build time (SOURCE_COMMIT, REGISTRY_VERSION, RUNTIME_DIGEST,
                               SOURCE_BUNDLE_DIGEST, TOOLCHAIN, BOOT_SMOKE, pending items) — digests only, no per-target file hashes,
                               nothing re-verified after cutover
HASH_GATE                    = NONE standing — build-time digest trusted at apply; verification was per-goal read-back only
WAITING_SLOT_DRIFT_PROTECTION = NONE — imported incidents #1/#2 happened exactly here; census reconfirms live stage is
                               dirty during service (pattern reconfirmed, attribution not re-investigated)
```

### 2.2 svc-workflow

```
SOURCE_CHECKOUT              = /Users/yanfenma/workspace/project/svc-workflow (main @ 88ff814; 3 untracked plan JSONs, no code drift)
STAGE_LOCATION               = /Users/yanfenma/.local/services/svc-workflow/ (svc-workflow binary + releases/ + 15+ ad-hoc backups)
STAGE_OWNER                  = yanfenma (dir world-writable-by-owner only; binary 0755)
STAGE_MUTABLE                = service dir mutable by owner; binary replaced by cp at deploy.
                               releases/ IS content-addressed (sha-named dirs) — but the LIVE binary sha 4e5d764c… has NO
                               matching releases/ entry (verified 2026-09-08): the 09-07 deploy bypassed the release discipline
BUILD_LOCATION               = repo target/release (cargo)
DEPENDENCY_INSTALL_LOCATION  = static Rust binary (no runtime dep tree); node_modules in repo is SDK TS only
PRODUCTION_ENTRYPOINT        = ~/Library/LaunchAgents/com.svc-workflow.plist → ~/.local/services/svc-workflow/svc-workflow (pid 34538)
PREIMAGE_CAPTURE             = timestamped svc-workflow.backup-* binaries/dirs (ad hoc naming, unmapped to source SHA)
POSTIMAGE_MANIFEST           = repo release-artifacts/{SHA256SUMS,provenance.json} exists for SDK tgz; service-dir ledger.json
                               (workflow ledger, not deploy manifest); NO manifest binding live binary ↔ source SHA at cutover
HASH_GATE                    = NONE at install (cp without verify); identity recoverable only by out-of-band shasum forensics
WAITING_SLOT_DRIFT_PROTECTION = PARTIAL — installed artifact is isolated from the repo once cp'd; but a later rebuild+cp
                               overwrite has no gate, and no frozen candidate record exists between build and install
```

### 2.3 dsh-agent-core

```
SOURCE_CHECKOUT              = many long-lived worktrees/clones under ~/workspace/project/ (main repo, production-dsh-agent-core,
                               dsh-agent-core-main, wt-*, …) — shared across Goals
STAGE_LOCATION               = /usr/local/libexec/agent-core/{app,harness} (root-owned installed closure)
STAGE_OWNER                  = root/authsvc after install (uid 502 spot-check enforced by installer) — good
STAGE_MUTABLE                = FS-level NO for agent uid; BUT install source is unsealed: trusted-cp-deploy-install.sh
                               REPO_SRC "default: the repo this script lives in (feature worktree)"; and per-goal partial
                               redeploys ("双文件" targeted file copy) have replaced individual files outside any install run
BUILD_LOCATION               = worktree directly (plain node, no build step; pnpm copy-mode deps)
DEPENDENCY_INSTALL_LOCATION  = /usr/local/libexec/agent-core/harness/node_modules (app/node_modules/@deepseek-ai symlinks into it)
PRODUCTION_ENTRYPOINT        = system domain: ai.agent-core.runtime.plist → app/scripts/production-runtime.mjs (canonical,
                               pid 69515). USER domain: two additional live runtimes execute DIRECTLY from mutable checkouts
                               (pid 35940 ← production-dsh-agent-core dirty clone; pid 60339 ← dsh-agent-core-main checkout)
PREIMAGE_CAPTURE             = ad hoc: plist .bak-*; per-goal rollback packets + rollback rehearsals (e.g. model-fleet ACT_V2)
POSTIMAGE_MANIFEST           = per-goal frozen packets exist (deployment-artifacts/, docs/evidence/*deploy*) but NO standing
                               manifest of the installed closure; two-file partial deploys leave no closure-wide postimage
HASH_GATE                    = per-goal read-back at deploy time; no standing fresh-bytes gate
WAITING_SLOT_DRIFT_PROTECTION = NONE — production-dsh-agent-core (integration clone, live user-domain runtime executes from it)
                               is shared and currently dirty across Goals (13 files)
```

### 2.4 scheduler / control plane

```
SOURCE_CHECKOUT              = dsh-agent-core + worktrees (same as 2.3)
STAGE_LOCATION               = OPERATOR CLI: NONE — /usr/local/bin/agentcore-cron is a symlink into the current dev checkout
                               (verified target: this repo's scripts/agentcore-cron.mjs). Runtime face: inside installed app
                               tree (broker scheduler package). State authority: /Users/authsvc/.agent-core V2 store (authsvc)
STAGE_OWNER                  = CLI symlink owned by yanfenma; store owned by authsvc
STAGE_MUTABLE                = YES — CLI bytes = whatever the checked-out worktree currently holds. Documented incident:
                               symlink served stale dev-worktree bytes (7a4e4864) ≠ live main (b476038a). At census, the
                               target repo is on a docs branch with dirty files ⇒ production operator CLI bytes = docs-branch
                               dirty bytes RIGHT NOW
BUILD_LOCATION               = none (single .mjs run by node-runtime)
DEPENDENCY_INSTALL_LOCATION  = none (stdlib only)
PRODUCTION_ENTRYPOINT        = /usr/local/bin/agentcore-cron (operator face) + scheduler capability in dsh runtime (trusted face)
PREIMAGE_CAPTURE             = none for CLI; store layer has atomic-rename mutation receipts (APPLIED/NOT_APPLIED oracle)
POSTIMAGE_MANIFEST           = none standing; SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 SB4 (accepted) already specifies
                               frozen-artifact pinning + CLI_BYTES_MATCH_EXPECTED / CLI_STORE_TARGET gates — implementation
                               slot-gated, not yet live
HASH_GATE                    = accepted-spec level only (SB4); no mechanical gate running today
WAITING_SLOT_DRIFT_PROTECTION = NONE
```

## 3. Hazard class inventory (goal's six classes)

1. **shared worktree (production-executed):** `production-dsh-agent-core` (pid 35940 executes from it; 13 dirty), `dsh-agent-core-main` (pid 60339 executes from it), `dsh-agent-core` main repo (operator CLI symlink target; docs branch + dirty broker files at census).
2. **shared stage directory:** auth live stage `production-auth-service-2cf27a64…` (12 dirty files in live stage); `production-dsh-agent-core` doubles as stage + runtime root for user domain.
3. **symlink-to-dev-tree production tooling:** `/usr/local/bin/agentcore-cron` → dev checkout (confirmed live).
4. **build output reused across Goals:** dsh partial "双文件" redeploys copy files from an arbitrary worktree into the installed tree; `trusted-cp-deploy-install.sh` defaults REPO_SRC to "the repo this script lives in (feature worktree)" — install ships whatever unsealed bytes the invoking worktree holds.
5. **artifact bytes not frozen:** auth live stage (writable worktree, dirty while serving); svc-workflow live binary has no release record binding it to a source SHA; dsh user-domain runtime executes from a dirty checkout by design of its plist/wrapper.
6. **preflight that trusts prior hash rather than fresh bytes:** BUILD_MANIFEST digests are written at build time and never re-verified at apply; no component has a standing apply-time fresh-bytes gate; svc-workflow install is unverified cp.

## 4. Existing reusable primitives (anti-churn inputs for the Spec)

| Primitive | Where | Reusable for |
|---|---|---|
| BUILD_MANIFEST.txt (source SHA, digests, toolchain, boot smoke) | auth stage dirs | per-generation manifest seed; needs per-file hashes + seal |
| content-addressed `releases/` + `release-artifacts/{SHA256SUMS,provenance.json}` | svc-workflow | generation store layout + hash discipline (deploy must stop bypassing it) |
| root-owned installed closure + uid write spot-check | `/usr/local/libexec/agent-core` (trusted-cp-deploy-install.sh) | isolated mechanism-level immutability for dsh candidate install |
| timestamped binary backups | svc-workflow service dir | rollback preimage (needs frozen manifest + source-SHA binding) |
| per-goal frozen deployment packets + rollback rehearsals | docs/evidence, deployment-artifacts | packet format; apply-contract wording |
| plist `.bak-<reason>-<ts>` preimage convention | LaunchDaemons/LaunchAgents | plist preimage capture |
| store atomic-rename APPLIED/NOT_APPLIED receipts + accepted SB4 CLI pinning | authsvc V2 store; SCHEDULER_CONTROL_PLANE_RELIABILITY_V1 | apply oracle + operator CLI artifact pinning (reuse SB4; do not duplicate) |

## 5. Census conclusion

The isolation gap is structural and uniform: **apply is serialized (concurrency 1), but candidate preparation is not isolated, sealed, or hash-gated anywhere**. All four surfaces keep mutable stage/checkout bytes that other Goals can change during a production-slot wait, and no apply path re-verifies fresh bytes against a frozen record. The Spec draft in `docs/specs/PRODUCTION_STAGE_ISOLATION_AND_ARTIFACT_INTEGRITY_V1.md` is built directly on the primitives in §4 and the hazard classes in §3.
