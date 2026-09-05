# visit-activation-dispatch-v1 — deployment artifact (Phase 3, staging only)

```text
GOAL          = VISIT_ACTIVATION_DISPATCH_PRODUCTION_V1
PHASE         = 3 (source drift analysis + artifact build) — STAGING ONLY,
                PRODUCTION_DEPLOYMENT = HOLD (WDA concurrency gate)
DATE          = 2026-09-05
```

## Target coordinates

| Plane | Target source | Artifact |
|---|---|---|
| svc-workflow | `22e862af8e47050ae1bf9e7c5db7eb22a4d81ee7` (github/main, PR #24 visit-activation-v1) | `releases/22e862af…/svc-workflow` + `migrations/` bundle + `provenance.json` (built by `scripts/release.sh build`, the official trust chain) |
| dsh broker | `ec074d568f7b99ec76118e6d45abab410b55198d` (origin/main) | `workflow.js` (git blob `7a3df429caeb1510ea9c106d53507a62a87d7b5f`, 33119 bytes) |

## Source drift analysis (fresh, 2026-09-05)

### svc-workflow plane — live binary vs target

- Live binary: built 2026-08-30 from `f0c74eefd…` (per its `provenance.json`),
  running since 2026-09-02 18:19 (pid 58020).
- Code drift `f0c74eefd → 22e862af` = **exactly the visit-activation surface**
  (44 code files: migration `0023_visit_activation_v1.sql`, activation facts /
  wake / due-poll store+handlers, VISIT_ACTIVATION_V1 graph validator,
  `GLOBAL_SCHEDULER_READ` role-key admission in the provisioning surface,
  semantic_model_version 3 enums/validators, tests 28 + migration test update).
  The intervening commits (PR #18 V5, #20 V6, #21 v0.4.0, #23 VAI spec) are
  **docs-only** — no code rides along beyond the VAI spec's own scope.
- Schema drift: `_sqlx_migrations` 22 → 23 (migration applies automatically at
  boot; `--migrate` pre-swap mode available).

### dsh broker plane — live manifest vs target

- Live `workflow.js`: git blob `7f55c605…` (24845 B, WDA deploy-r2 artifact,
  sha256 `53286178…`), contains NO `workflow_dispatch_intents` /
  `workflow_wake_dispatch_intent`.
- Target `workflow.js`: git blob `7a3df429…` (33119 B, dsh origin/main
  `ec074d5`), adds exactly the two DIB manifests (additive; no existing
  manifest touched) + tests + manifest-inventory count updates.
- Broker test suite at target commit (fresh worktree, deps installed):
  **336/336 PASS** (`node --test 'packages/broker/test/*.test.js'
  'packages/broker/test/*/*.test.js'`).

## Contents

| File | Meaning |
|---|---|
| `workflow.js` | target broker manifest file (sha256 recorded at stage time: `cfea06cd9ae979803a8e7f89f5784af1b6734d40428a60a752cebcc8b95d5e21`) |
| `sim/run-sim.sh` | Phase 4 scratch-DB boot rehearsal (disposable DB on 127.0.0.1:55432, service port 8991; NO production mutation) |
| `sim/SIM_RESULTS.json` | simulation step-by-step verdicts (written by run-sim.sh) |
| svc binary + provenance | see `~/.local/services/svc-workflow/releases/22e862af…/` (official release staging; written by `release.sh build` only — deploy step NOT run) |

## Build chain notes

- The installed Rust toolchain is `stable-x86_64-apple-darwin` (Rosetta) →
  plain `cargo build --release --locked` inside `release.sh` naturally emits an
  x86_64 Mach-O into `target/release/` — matching the live binary's
  architecture. A `CARGO_BUILD_TARGET` override was tried and is WRONG for this
  script (relocates the output dir; script aborts by design).
- `release.sh deploy` (NOT yet executed) = provenance re-verify → backup →
  install → ledger append → `launchctl kickstart -k gui/$(id -u)/com.svc-workflow`
  → `/version` gitSha + running-binary sha256 + migration bundle verify.
  User-domain, no sudo.
- dsh runtime broker plane deploy reuses the WDA deploy-r2 machinery pattern
  (manifest + preimage + receipt; system-domain restart is an Owner-gated step).

## Explicitly NOT done here

- No deploy, no restart, no ledger append, no DB migration on production,
  no GLOBAL_SCHEDULER_READ binding, no production file writes.
- Workflow Definition Authoring (WDA) goal owns production mutation until it
  clears; this Goal stays at READY_FOR_DEPLOYMENT at most.
