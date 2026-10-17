# HANDOFF — DES_CONTINUE_CANONICAL_NARROW_FIX_V1

Date: 2026-09-25 · Lane: DES_CONTINUE_CANONICAL_NARROW_FIX_V1 (resumes DEVELOPMENT_EXECUTION_SURFACE_V1 source-owner lane sess_a0bfd0d6-5aa4-4c15-8241-9cfec29877de)

## Result
SOURCE_FIX_READY = YES · MERGED_TO_CANONICAL_MAIN = YES (PR #328, merge commit b647ee7e)

## Exact coordinates
- BASE_SHA (fresh canonical origin/main at lane start): b4e8511c533f8fa5be2f48dd56acc16bc79dff39
- EXACT_HEAD (reviewed candidate, single commit): 6ce9ed535f3816708651da85011c662ba4be80b1
- Branch: fix/des-continue-midrun-instruction-loss-v1 (pushed to origin; tip == EXACT_HEAD, byte-identical to what PR #328 merged)
- MERGED_TO_CANONICAL_MAIN: PR #328 → origin/main merge commit b647ee7e5c8dd7de7b2a1957949a33c70c1648ce
- Carried-unchanged proof: `git diff 6ce9ed53 origin/main -- packages/development-execution packages/broker/src/capabilities/development-execute.js` = 0 lines
- Author worktree (this one, Deployment-Agent-readable): /Users/yanfenma/workspace/worktrees/des-continue-midrun-fix-v1

## What was fixed
`development_execute.continue` on a RUNNING execution returned `accepted: 'recorded_midrun'` while the
instruction was neither persisted nor delivered (fake success; reproduced: backendCalls=0,
instructionPersisted=false). Structural causes on BASE: WAITING unreachable; outcome.sessionId dropped by
#appendTerminal (WAITING resume branch dead twice over); resume-run pid never persisted.

Fix (spec-ALIGNED to accepted AGENT_CORE_DEVELOPMENT_EXECUTION_SURFACE_V1 CTR-DES-001/003 — governing
spec file 0-line diff; codex-backend.js untouched; mid-run steering NOT fabricated; supported capability =
post-exit resume only):
1. RUNNING continue → ledger `continue_requested{instruction}` (instruction text = state authority;
   replay-projected; status gains additive-optional `continueRequests[{instruction,disposition,atMs}]`).
2. Exit-0 + queued instruction + captured session ⇒ `WAITING` (now genuinely reachable) → FIFO delivery of
   the OLDEST instruction via existing resume capability through shared #startResumeRun (pid persisted on the
   state line, timeout re-armed, exit re-hooked; terminal classification deferred to the resume run's exit;
   each resume's captured session chains to the next).
3. Never-deliverable dispositions (nonzero exit / signal / spawn error / timeout / cancel / dead-pid owner
   restart / exit-0 without session) ⇒ `continue_delivery{disposition:'undelivered'}` per queued instruction.
   No silent drop, no fabricated steering; cancel remains exactly-once and kills the REAL resume process.
4. Ack vocabulary unchanged (`recorded_midrun`); manifest untouched.

## TESTS
- development-execution: 22/22 PASS (16 pre-existing + 6 new K1–K6; TDD — all 6 verified red on pristine
  BASE via overlay, green on candidate)
- broker: 478/478 PASS
- production-runtime: 172/172 PASS on candidate (pristine-BASE control worktree: equivalent green; fail
  sets byte-identical before fix)
- Environment requirements (false-failure otherwise): /usr/local/bin/node v25.6.1 AND clear ALL EIGHT proxy
  vars (http_proxy/https_proxy/all_proxy/no_proxy × upper/lower case) — gate
  `AGENT_MODEL_OVERRIDE_INVALID: runtime_proxy_env_present` also rejects NO_PROXY/no_proxy.
- 1 known flaky production-runtime spawn-timing test observed failing once on BASE control and passing on
  re-run (not DES-related).

## INDEPENDENT_REVIEW (author/reviewer separation preserved; reviewer = fresh agent, no authoring role)
verdict PASS / blockers=0 / spec_compliance=PASS. Reviewer independently verified: spec file 0-line diff;
K1–K6 mechanically red on BASE overlay; suites re-run (22/22, 478/478, production-runtime 0 fail + 1
pre-existing env-conditional skip `DSH_CODEX_PACKAGE_TARBALL`); adversarial hunt (delivered-without-backend-
call, pending-survives-terminal, unstoppable live resume, replay divergence incl. duplicate-text and
crash-between-appends corners) — nothing found. 5 non-blocking notes (pre-existing BASE patterns or
justified asymmetry), incl.: synchronous-throw contract-violating adapter could leave a `delivered` entry
without a backend call (production adapter cannot: spawn failures surface via done.spawnError).

## Scope discipline
No changes to: governing spec, svc-workflow, production/frozen release packages, broker manifest/args,
codex-backend adapter, Model/Auth/installer/architecture. No real Agent/Workflow calls, no production
daemon, no DS apply, no credential content access, no sudo; tests hermetic (fake backend + temp dirs).
Shared working tree untouched (all work in the independent worktree above).

## REMAINING_GATE
- NONE for merge (canonical integration complete).
- Deployment owner (unchanged from DES closure handoff): fresh real-codex dogfood at canonical head before
  production rollout decision, incl. a midrun-continue E2E (start → continue midrun → observe resume
  delivery via `codex exec resume`) — the fix's production-backend behavior is hermetically proven only.

## Handoff artifact
- This file: docs/evidence/des-continue-canonical-narrow-fix-v1-20260925/HANDOFF.md (untracked in the
  author worktree; the merged branch tip stays byte-exact with the reviewed candidate).
