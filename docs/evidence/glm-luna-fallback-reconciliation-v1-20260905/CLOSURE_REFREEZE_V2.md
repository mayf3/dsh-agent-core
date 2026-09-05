# DEPLOYMENT_CLOSURE_REFREEZE_V2 — GLM_LUNA_FALLBACK_PRODUCTION_V1

Date: 2026-09-05 · Basis: fresh origin/main **513c691** (post PR #121 merge; pure test addition, blob oids unaffected) + installed app `/usr/local/libexec/agent-core/app` read-only census (runtime authsvc 72082).
Supersedes: the R4 8-blob closure in `deployment-artifacts/model-fleet-glm-luna-activation-prep-r4/` (its compose blob and migration-executable blob are stale; see drift ledger).

## FROZEN FILE SET (8 blobs, selective per-file closure — matches installed-app narrow deployment mechanism)

| # | File | main blob (frozen) | installed today |
|---|---|---|---|
| 1 | packages/agent-router/src/route-chain.js | e2f69dac | 010df799 (breakglass v2 baseline) |
| 2 | packages/production-runtime/src/model-overrides.js | 380f5264 | ea44819a (v2-only loader) |
| 3 | packages/agent-provisioning/src/index.js | 34479d81 | b1d7b94d |
| 4 | packages/agent-provisioning/src/shared-codex.js | 963d03be | ABSENT |
| 5 | packages/agent-provisioning/src/plugin-artifact.js | 89394ab3 | ABSENT |
| 6 | packages/production-runtime/src/shared-codex-migration-cli.js | a8620ea9 | ABSENT |
| 7 | packages/production-runtime/src/shared-codex-migration-executable.js | 090f5471 | ABSENT (R4 freeze had 4444375d — stale via 07102da 09-02 session-messaging closure) |
| 8 | packages/production-runtime/src/shared-codex-migration.js | 70e74439 | ABSENT |

## EXCLUDED (fresh adjudication, SB3)

- **compose.js — EXCLUDED from closure; installed e539ef45 stays.** Reasons:
  1. migration path does not import compose (cli → executable → migration + model-overrides only);
  2. interface-compatible: installed compose calls `loadAgentModelOverrides(file, registeredAgentIds)` — same name+arity on v3 loader 380f5264 (extra export CANONICAL_OPENAI_CODEX_CREDENTIAL_FILE is additive);
  3. installed compose imports only `resolveHarnessRoot` from provisioning — retained on 34479d81;
  4. installing main compose c407b064 would drag the scheduler-history/observed-invoker closure and mutate the 72082 runtime surface beyond this goal's minimal closure; its remaining delta vs installed is the v3 comment + migration re-export (cosmetic for runtime).
  - R4's frozen compose blob 4c744186 is hereby RETIRED from the closure (it differs from installed by 94 lines and from main by the scheduler face).
- **memory.js — untouched** (PRODUCTION_PRESERVATION_GATE_ONLY). Apply-time proof: MEMORY_JS_BEFORE=AFTER=99d59bdeb055e18d7827d5529f2505783252e6b75124f8fb45c91d5a96bf2b7d; DEPLOYMENT_CLOSURE_TOUCHES_MEMORY_JS=NO (closure list above contains no memory.js).

## Interface-closure evidence (fresh, this session)

- route-chain.js e2f69dac local imports: process/provider-errors.js (a89c0cf9), process/state-machine.js (772d0ed2), route-chain-canary.js (97b678b2) — **all SAME-blob in installed app**; sole consumer index.js is SAME (c6806a42). Single-file swap is dependency-closed.
- installed agent-router src/index.js + process/spawn.js (provisioning consumers) == main blobs.
- PR #121 test closure (merged 513c691) runs green on exactly the main blobs this closure installs (route-chain e2f69dac exercised via the same index surface).

## Apply-order constraints (frozen, from SCA V2 + activation spec)

1. All 8 files install in ONE quiesce window, atomic with `agent-model-overrides.json` v2→v3 migration (v2/v3 loader mutually exclusive).
2. Migration executed via closed blob 6 (`node packages/production-runtime/src/shared-codex-migration-cli.js`, package script `migrate:fleet-shared-codex-auth`), canonical credential target `/Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json`.
3. MEMORY_JS gate proof before/after (values above).
4. oc-go launchd implicit default removal + canary/batch plan = apply-time items per V2 (not part of the file closure).
5. PRODUCTION_MUTATION_CONCURRENCY=1: apply only when the P0 workflow goal releases the mutation lane (PRODUCTION_RUNTIME_LOCK=IDLE).

## Drift ledger updates (2026-09-05)

- D4 (new): migration-executable blob moved 4444375d → 090f5471 on main (via 07102da, 09-02 session-messaging implementation closure). R4 artifact references to 4444375d are stale; this document is the fresh authority.
- D5 (new): production compose.js = e539ef45 (old staging blob, absent from main history) — pre-existing state, re-confirmed; not attributed to any 09-03..09-05 goal (workflow-authoring goal's 2-file closure did not touch compose).
- D1 overrides 0600/EACCES unchanged (mtime 2026-09-03 12:56). D2 runtime pid sequence 69904→(63411-era)→72082 — restarts owned by other goals' deployments. D3 fleet 92-member roster unchanged per record (fresh privileged recount still owed at gate time).
