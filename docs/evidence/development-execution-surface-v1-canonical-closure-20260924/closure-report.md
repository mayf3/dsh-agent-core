# DEVELOPMENT_EXECUTION_SURFACE_V1 — Canonical Source Closure (Night, 2026-09-24)

GOAL = DEVELOPMENT_EXECUTION_SURFACE_V1_CANONICAL_SOURCE_CLOSURE_NIGHT

## Outcome

- MERGED_TO_CANONICAL_MAIN = YES — PR #324 (`goal/development-execution-surface-v1`) merged into
  origin/main at **2ee6f47788b51b165267b9edec37ca5656b69954** (2026-09-24 22:58:39 +0800).
  This closure ran AFTER that merge: fresh-fetched, verified the merge is the exact reviewed
  candidate (branch tip 79bce966 fully contained; zero unmerged commits), then validated the
  final head. The merge itself was performed by the parallel integration agent earlier tonight.
- FINAL_CANONICAL_SHA = 2ee6f47788b51b165267b9edec37ca5656b69954 (origin/main HEAD at closure).
- Accepted authority: `docs/specs/AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1.md`
  (status: accepted, accepted_by mayf3, accepted_reviewed_head **e3393e7c**, acceptance basis:
  IMPLEMENTATION_COMPLETE=YES, DOGFOOD 15/15 PASS real codex exec two agents,
  INDEPENDENT_REVIEW=PASS with B1–B3 fixed, BLOCKERS=0, CTO_SPECIFIC_PRODUCT_CODE=ZERO).

## Evidence-carryover proof (reviewed head → final head)

- `git diff e3393e7c 2ee6f477 -- packages/development-execution/src
  packages/development-execution/package.json` is EMPTY: the DES engine / authority / ledger /
  codex-backend sources are byte-identical to the dogfooded reviewed head. The acceptance
  DOGFOOD (15/15, real `codex exec`, agent #1 AND agent #2, candidateSha git-observed,
  cross-process ledger re-read — commit 6bb7ee55) therefore covers the engine/backend path at
  the final head unchanged.
- Delta e3393e7c → 2ee6f477 is integration-only: latest-main integration (Modularity Phase A
  generic `resolveLocalHandlers` seam in broker/index.js; DES handler moved into
  broker-composition.js; compose keeps both WEC + DES wirings) plus the DES test now injecting
  the LOCAL handler through that same seam (79bce966). All covered by the regression below.

## Final-head verification (this closure, independent re-run)

Environment: worktree
`/Users/yanfenma/workspace/worktrees/night-development-execution-surface` @ 2ee6f477 (shared
working tree untouched), pinned runtime **Node v25.6.1** (`TARGET_PROXY_NODE_VERSION`), proxy
env vars unset (production-runtime asserts a clean proxy environment).

- TESTS (focused, final head 2ee6f477):
  - development-execution suite: **16/16 PASS** (incl. capacity enforcement B1, restart
    persistence B2, receipt tests-field B3, gateway fail-closed without grant + stub-auth e2e
    landing the start in the engine, zero-persona sweep)
  - broker suite: **370/370 PASS** (manifest registered in DEFAULT_MANIFESTS, local handler
    chain, gateway scopes)
  - production-runtime suite: **129 PASS / 0 FAIL / 1 skipped** (compose.test.js 11/11 —
    production compose with the DES mount; skip is pre-existing env-gated, unrelated)
- DOGFOOD = CARRIED (15/15 real-codex at e3393e7c, DES src byte-identical at 2ee6f477; see
  above) + final-head hermetic end-to-end green. A FRESH real-codex dogfood at 2ee6f477 was
  NOT re-run tonight: this machine only holds the operator `~/.codex` credential and the goal
  bans credential mutation; running `codex exec` can rotate tokens in that store. Listed as a
  recommended pre-deploy step for the deployment owner (below).
- INDEPENDENT_REVIEW (this closure, affected-surface, final head): PASS.
  - development_execute is the governed entry: broker capability, requiredScopes
    `['development.execute']`, every op argument schema `additionalProperties:false` —
    binaryPath/credentialPath/env/shell are structurally unrepresentable; caller identity comes
    from gateway trusted context, never args.
  - ONE executor, no second ungoverned path: single system-pinned codex adapter
    (`--ignore-user-config`, workspace-write sandbox, never danger-full-access, scrubbed env,
    worktree = only writable path at the exact baseSha, HEAD verified before start).
  - Broker stays semantics-free: Phase A generic `resolveLocalHandlers` seam; DES enters as one
    more LOCAL provider (`developmentExecutionAccess`) exactly like self_ops/scheduler — no
    special-casing, absent seam ⇒ fail closed.
  - Kernel: ZERO changes in the merge. production-runtime changes are thin additive
    composition (compose mount refuses honestly with `config_missing` until the Operator
    provisions `dev-execution/{repos.json,backend.json}` — no auto-enable).
  - No scope expansion: closed multi-op enum (start/status/continue/cancel/result), zero-persona
    sweep green. Deployment System: untouched by DES. svc-workflow: UNCHANGED (spec-mandated).

## Deployment notes (for the deployment owner — production rollout is OUT OF SCOPE for merge)

Per spec §12, preconditions before production enable:
1. auth-service: register resource `development-execution` + scope `development.execute`; grant
   to authorized agent principals via the existing provisioning authority.
2. Operator provisions `<runtime-root>/dev-execution/repos.json` (repo allowlist) and
   `dev-execution/backend.json` (pinned codex binary + version + CODEX_HOME path). CODEX_HOME
   provisioning is an Operator action (ChatGPT subscription OAuth); system-service, not an
   agent persona — revisit under FLEET_SHARED_CODEX_AUTH if needed.
3. RECOMMENDED pre-deploy: one fresh real-codex dogfood at 2ee6f477 with the operator provision
   above (isolated, non-production, per spec §11 — including the second-agent identity pass).
4. `dev-execution/worktrees/` retention is Operator-managed.

Known follow-up debt (recorded at e3393e7c, non-blocking, do NOT silently expand): gateway
validateInvocation parity, backend timeoutMs wiring, resume-path coverage.

## Artifacts

- closure-report.md — this report
- MANIFEST.md — artifact inventory
- MANIFEST.sha256 — content hashes
