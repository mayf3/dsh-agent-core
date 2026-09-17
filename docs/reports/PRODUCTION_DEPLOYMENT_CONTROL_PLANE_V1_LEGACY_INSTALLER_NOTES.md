# Legacy installer explanatory notes

These exact comment blocks were extracted from the installer at Task4 source
`3f59cf3aa4c11ae2dbec107e1284487b45bac099` to meet the source structure limit.
They preserve historical explanations, not new deployment authority. After
enrollment the source guard denies this legacy installer. No executable line,
here-document or string was moved here.

## Original lines 2–40

```sh
# =============================================================================
# trusted-cp-deploy-install.sh — TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1
#
# One-time (re-runnable) root install of the TRUSTED control-plane closure.
#
# Goal: every piece of code/config the trusted Control Plane (uid 505,
# authsvc) executes BEFORE dropping to the Agent uid (502) must live under a
# protected root that uid 502 cannot modify, replace, or redirect.
#
#   TRUSTED_INSTALL_PATH=/usr/local/libexec/agent-core
#     harness/   self-contained DSH CLI closure (source copy + `pnpm install`
#                with package-import-method=copy so NO hardlink points into a
#                502-owned store)           owner authsvc:authsvc  0755/0644
#     app/       Agent Core closure (packages/bundles/profiles/scripts) with
#                node_modules/@deepseek-ai -> ../../harness/node_modules/@deepseek-ai
#                                           owner authsvc:authsvc  0755/0644
#     home/      the 505 control-plane DSH_HOME (profile + farm -> app/)
#                                           owner authsvc:authsvc
#     config/    production state: Agent Definition (agents.json)/bindings/jobs/
#                credential store   owner authsvc:authsvc  0700/0600
#     .cache/    pnpm cache (root-owned)
#
# Also seeds /Users/authsvc/.dsh/{settings.yaml,.credentials.yaml} (authsvc
# 0600) — the trusted model-route settings source the children copy from.
#
# The dev repo / harness stay uid 502-writable for development; this install
# only ships the minimal execution closure (NOT the monorepos). The Agent
# child (502) may keep reading the trusted closure (world-readable) but can
# never modify it; its own workspace/runtime stays 502-writable as before.
#
# Usage (run as root):
#   sudo ./scripts/trusted-cp-deploy-install.sh [REPO_SRC] [HARNESS_SRC]
#   REPO_SRC    default: the repo this script lives in (feature worktree)
#   HARNESS_SRC default: /Users/yanfenma/workspace/github/deepseek-harness
#
# Verifies at the end: every symlink in the trusted tree resolves INSIDE the
# trusted root (or /usr/local/libexec), and a uid-502 spot check cannot write
# to app/, harness/, home/, config/ or the helper.
# =============================================================================
```

## Original lines 43–47

```sh
# GLOBAL production-deploy mutex (WATCHDOG transaction P1/B7 convergence): every
# entrypoint that replaces the trusted app / routing / restarts the canonical
# runtime shares THIS exact lock. Atomic mkdir acquire; a held lock fails
# closed with its holder metadata; a killed run leaves the lock behind and it
# is disposed of EXPLICITLY (never guessed, never auto-deleted).
```

## Original lines 49–53

```sh
# B7 inherited-lock seam: a parent transaction (run-authorized-transaction.sh)
# holds the mutex across DEPLOY/ROUTING/RELOAD; the child verifies the actual
# holder belongs to that parent and then neither reacquires nor releases it.
# There is deliberately NO bypass flag: without a verified inherited holder
# the installer always acquires the mutex itself (standalone path).
```

## Original lines 140–143

```sh
# AGENT_CORE_BACKUP_RETENTION_V1: deployment backup metadata + pin + post-verified
# retention ops live in the tiny filesystem helper (same dir as this script). It is
# pure shell/filesystem — no package/DB/service/daemon; it neither deletes legacy
# backups nor modifies Runtime/Router/Scheduler/Kernel/product semantics.
```

## Original lines 204–210

```sh
# ---- 1b. reuse the heavyweight closures when their sources are UNCHANGED ----
# The harness closure (1.5G source + offline pnpm install) and the Node
# runtime are DEPENDENCIES of the code under test, not the code under test
# itself. When the harness checkout is at the same commit (and clean) and the
# Cellar node version is identical, mv them back from the backup — an instant
# rename instead of minutes of tar+pnpm. The app closure is ALWAYS recopied
# fresh (that is where the integration changes live).
```

## Original lines 256–260

```sh
# ---- 2b. trusted Node runtime (review blocker fix) --------------------------
# The production Control Plane must NEVER execute /usr/local/bin/node
# (Homebrew, uid-502-writable). Materialize the ACTUAL Node runtime into the
# trusted closure: real files only (cp -RL), no symlink/hardlink back to
# /usr/local/bin, the Cellar, or /Users/yanfenma.
```

## Original lines 334–336

```sh
# Agent existence authority closure (AGENT_DEFINITION_CONFIG_V1): the formal
# Agent Definition package MUST be in the trusted app closure, and the
# removed agent-registry package MUST NOT be (no second Agent authority).
```

## Original lines 348–351

```sh
# PRODUCTION_INTEGRATION_V1 (Task 3): the Production Runtime closure MUST be
# in the trusted app closure — the supervised composition (launchd -> trusted
# Node -> app/scripts/production-runtime.mjs) imports the wiring-only
# production-runtime package and spawns agents with the production profile.
```

## Original lines 365–368

```sh
# @deepseek-ai resolution bridge — INSIDE the trusted root only. The app
# packages resolve @deepseek-ai/* through the harness's full scope farm
# (node_modules/.pnpm/node_modules/@deepseek-ai), exactly like the dev
# setup's bridge; every entry stays inside the trusted harness.
```

## Original lines 372–380

```sh
# third-party runtime deps of the app closure (real copies, dereferenced —
# never symlinks into the 502-owned dev install):
#   @larksuiteoapi/node-sdk  (feishu-connector)
#   croner                   (scheduler)
# third-party runtime deps of the app closure — copy the FULL dev-install
# node_modules surface as REAL dereferenced copies (the dev repo is the
# reference environment where the composition loads; axios/form-data/… are
# transitive deps of @larksuiteoapi). @deepseek-ai stays the in-trusted
# bridge; @agent-core is a dev-only artifact and is skipped.
```

## Original lines 436–441

```sh
# The Agent Definition config is the SINGLE Agent existence authority
# (AGENT_DEFINITION_CONFIG_V1): an empty declarative document until the
# deployment authorizes agents (adoptAgents / seedDefinition). A REINSTALL
# MUST NEVER destroy the deployed definition or the credential store — the
# stable agt_* identities and the 505 credentials survive code refreshes;
# empty documents are seeded only on a fresh install.
```

## Original lines 457–466

```sh
# ---- 5b. 505 production root (PRODUCTION_INTEGRATION_V1, Task 3) -----------
# The supervised Production Runtime (packages/production-runtime) persists
# under $HOME/.agent-core. Under uid 505 (authsvc) that is
# /Users/authsvc/.agent-core. Provision it with the production layout so the
# launchd --trusted unit (which passes --root explicitly) boots onto a fully
# provisioned root. The Agent Definition authority stays a SYMLINK to the
# trusted config/agents.json — the single Agent existence document (never a
# second copy that could drift). Credential store likewise symlinks to the
# trusted config/agent-credentials.json (Broker gateway via
# AGENT_CORE_CREDENTIALS_FILE = that trusted 505-private file).
```

## Original lines 470–472

```sh
# Agent Definition + credential store: single-file authority via symlink to
# the trusted 505-private config (the runtime reads through the link; only the
# trusted config file is written/authoritative).
```

## Original lines 475–483

```sh
# Ownership split (PRODUCTION_INTEGRATION_V1): the 505 control plane owns the
# root + all control state (bindings/scheduler/control/logs); the Agent child
# (uid 502) owns the per-agent workspace + DSH home trees under the same
# production root. workspaces/ + homes/ stay TRAVERSABLE (0755) — the 505
# router's idempotent ensure()/provisionAgentHome must stat through them
# (the posture proven by trusted-credential-505-final-v2-run.mjs; the 505
# PRIVATE dirs are the ones that get go-stripped). A reinstall must never
# steal existing child trees back: chown the two roots only, never -R over
# them; per-agent trees are provisioned by production-agent-provision.mjs.
```

## Original lines 485–490

```sh
# 711 (NOT 700): uid 502 must TRAVERSE the root to reach its own per-agent
# workspace (spawn cwd) and home — run-4's 0700 root blocked the child at
# spawn (cwd EACCES, swallowed spawn error, 90s silent ready() timeout, and a
# delayed unhandled rejection killed the CP minutes later). o+x without o+r:
# others may reach KNOWN paths but cannot LIST the root; every 505-private
# subdir keeps its own 0700.
```

