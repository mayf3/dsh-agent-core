# OPERATION_PACKAGE_V2 — SHARED_CODEX_AUTH_DEPLOYMENT_ROOT_REFREEZE_V2 (CLOSURE_RESOLUTION_GATE_V1)

> Product #414 [PRODUCT B7] continuation · 2026-10-02 · standing delegation #386
> Status: PREPARED / WAITING_PROD_EXECUTION (this prep lane: PRODUCTION_MUTATION = NO)
> Supersedes: the v1 package `docs/evidence/shared-codex-auth-deployment-root-refreeze-v1-20261001/`
> **§4.1 STAGE execution clauses and §4.2 preimage/rollback bindings only** — the v1 package's
> deploymentRoot seam authority (accepted amendment b08db324, PR #311), carrier r12 contract,
> custody/canary definitions and preservation rules carry forward unchanged. Per the v1
> package's own R4: the installer bytes changed ⇒ this is a NEW freeze, not an in-place patch.
>
> **v2.1 REBIND (2026-10-02 repair lane, after agent-control#191 fail-closed):** the #191
> terminal receipts proved two packet-internal defects; both are repaired in this evidence
> directory ONLY, with the DEPLOY_SRC pin 8fc374ca/f60cc9e8 and ALL scripts/** bytes
> UNCHANGED (installer 913e4ee0, gate af43b337, canary b737d6b4 re-verified at the pin):
> 1. Executor post-deploy byte-provenance echo #3 now greps
>    `AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE` in `process-registry-route-gate.js` (:52).
>    The inherited grep of `process-registry.js` returned 0 hits at the pin AND at every
>    reference generation since v1 (47aadec1/360756e3/d8ddf546), deterministically aborting
>    every deploy after the install and before the packet's own G2.5 fresh-child boot canary.
> 2. §6 gains **RESTORE-R1**: the deterministic restore re-materializes node-runtime from the
>    fresh STAGE 0 preimage whenever installer §1b reused it (§1b mv-s node-runtime OUT of the
>    §1 auto-preimage; the rm -rf of the installed tree then deletes the only other copy —
>    reproduced 2026-10-02, 2418 deleting lines in the #191 restore-verification diff).
> Rollback semantics otherwise unchanged; no ad-hoc live symlinks; no live node_modules
> patches. Offline gate: executor `--selftest-repair` (hermetic /tmp fixtures); mechanical
> RED/GREEN evidence in `RED_GREEN_EXECUTOR_REPAIR-20261002.txt`. The next production run
> materializes this evidence directory from the v2.1 merge commit on main while DEPLOY_SRC
> remains a checkout at exactly 8fc374ca. Status: PREPARED(v2.1) / WAITING_PROD_EXECUTION;
> PRODUCTION_MUTATION = NO in this lane.

## §1 Authority and context

The v1 frozen package (source pin d8ddf546, installer sha256 dfb262b6…) was executed under
standing delegation #386: STAGE 0 all PASS; STAGE 1 attempt 1 fail-closed (empty pnpm store,
recovered, zero impact); after environmental store repair, STAGE 1 attempt 2 installed a new
generation at 2026-10-01 23:35:38 +0800. That generation **failed fresh-child boots fleet-wide**
(see §2) and was rolled back at ~2026-10-02 00:00 +0800 by the frozen algorithm. This packet
repairs the packaging defect that caused it, adds the missing fail-closed gates, and re-binds
the execution path so the same class cannot reach cutover again.

New-evidence basis (2026-10-02 lane): mechanical reproduction recorded in
`RED_GREEN_GATE-20261002.txt` and `RED_GREEN_BOOT_CANARY-20261002.txt` (this directory).

## §2 FAILED_GENERATION record (no backup deleted or mutated; read-only identification)

- **Deployed generation**: installed 2026-10-01 23:35:38 +0800 by the v1 rebound executor
  (`b0a5efe0…`) running installer `dfb262b6…` at provenance HEAD d8ddf546 / tree 18fcc6b8,
  HARNESS_SRC pinned to the clean 514ab7b0 checkout; the harness closure was built by
  `pnpm install --offline --frozen-lockfile --ignore-scripts` executing under the **invoking
  host's arm64 node** (`/usr/local/bin/pnpm` is corepack `#!/usr/bin/env node`).
- **Failure**: the deployed `node-runtime/bin/node` is x64 (Mach-O x86_64, `process.arch=x64`,
  modules=141). pnpm selects platform-optional native packages by **its own process arch**, so
  the fresh closure shipped only `node-addon-require-builtin-darwin-arm64`. Under x64 the
  loader's internal-module acquisition (`vendor/loader` `ModuleLoader.fromInternal` →
  `node-addon-require-builtin` → prebuilt darwin-x64 binary) throws; `ctx.loader.internal`
  stays undefined; `Tree.import` falls back to raw `import()` from
  `harness/vendor/loader/lib/index.js`, whose parent chain contains no plugin package. EVERY
  loader entry failed `ERR_MODULE_NOT_FOUND` (`@deepseek-ai/cordis-plugin-timer` first, then
  hmr … dsh-codex/tui, 85+ entries) ⇒ `plugin tree failed to load` ⇒ every fresh
  `agent-core-production` child died at boot. Already-running children kept their in-memory
  modules and continued working — which is why the outage surfaced only as fresh-child boots.
  Operator record: `/tmp/b7-prod-closure/child-boot-error.txt` (23:51).
- **Backup identity (rollback receipts)**: installer §1 auto-preimage
  `/usr/local/libexec/agent-core.bak-20261001-233538` = the immediate preimage; it passed a
  fresh boot probe (23:59, `/tmp/b7-prod-closure/preimage-233538-boot.txt`) and was **`mv`ed
  back by the rollback** — it IS the current live tree (its `.backup-meta` mtime 23:35:38;
  `/usr/local/libexec` mtime 00:00 Oct 2 = the restore). The failed generation itself was
  `rm -rf`-deleted in place by the same restore, per the frozen algorithm. Standing backups
  preserved untouched: `agent-core.bak-20261001-174434` (23G, preservation rule from #376),
  `agent-core.bak-20261001T144015Z-pre-b7-refreeze` (STAGE 0c re-pin, diff 0).
- **Why the gates missed it**: §0b scans app-closure literals, not the harness closure's
  runtime-arch closure; pnpm exited 0 (installing the wrong-platform optional package is a
  success for pnpm); no fresh-child boot probe ran against the assembled candidate before
  cutover. Both gaps are closed by this packet (§5 STAGE 1).

## §3 FIX (source pin of this packet)

Branch `svc/b7-closure-runtime-arch-gate-20261002` (base origin/main 47aadec1 — includes the
B7 closure c67c0d4c and PR #418 c11r1 merge):

- installer `scripts/trusted-cp-deploy-install.sh`: **§1a** resolve the Cellar node ONCE
  (single arch authority; exports RUNTIME_ARCH/RUNTIME_NODE_VERSION); **§1b** node-runtime
  reuse now requires version AND arch equality against that anchor; **§2** pnpm executes under
  the anchor node binary (platform-optional packages selected for the arch that will EXECUTE
  the closure); **§2b** de-duplicated resolution; **§2c (new, fail-closed)** the
  closure-resolution gate runs under the trusted node for BOTH fresh and reused harness
  closures, before the app closure is packed.
- NEW `scripts/lib/trusted-cp-closure-resolution-gate.mjs` (CLOSURE_RESOLUTION_GATE_V1):
  (1) native binding acquires and reports a platform suffix that serves the runtime arch;
  (2) mechanical census of every `@deepseek-ai/*` link on the resolution surfaces
  (vendor/loader peers + apps/cli — the whole surface, not a checklist of once-broken names);
  (3) the canonical failing specifier resolves from apps/cli. Exit 2 aborts the install.
- NEW `scripts/lib/trusted-cp-fresh-child-boot-canary.mjs` (FRESH_CHILD_BOOT_CANARY_V1):
  disposable fresh `agent-core-production` child boot from the candidate under its own
  node-runtime in a throwaway home (profile copies + `@agent-core` farm links exactly per
  `provisionAgentHome`; no credentials; no production state). Classifies every
  missing-package line; only explicitly allowlisted external plugins (default `dsh-codex`,
  staged per-deployment-root by the carrier) may be absent. PASS requires the ready marker
  with zero disallowed misses and no plugin-tree failure.
- Tests: `scripts/lib/trusted-cp-closure-resolution-gate.test.mjs`,
  `scripts/lib/trusted-cp-fresh-child-boot-canary.test.mjs` (hermetic RED/GREEN fixtures incl.
  the exact 2026-10-02 failure class; live-closure integration seam
  `DSH_B7_GATE_CLOSURE_UNDER_TEST`/`DSH_B7_GATE_EXPECT`).

GOVERNING_SPECS_UNMODIFIED: no `docs/specs/**` file changes in this pin.

## §4 Artifact digests (computed at finalization; this file's own digest lives in MANIFEST.sha256)

| Artifact | sha256 |
|---|---|
| INDEPENDENT_REVIEW_V2.md | a5039c2e4d9c8bba97d4f3a2786c34e6dfa11962abe4b61bd265f194b67637f0 |
| owner-router-closure-g2-g7.sh (rebound executor, v2.1) | 6cabf9cd010e1aa35fc2bf014de62a9c6ae14ee621c3fbe9ae9e13a0a7f61710 |
| scripts/trusted-cp-deploy-install.sh (at pin) | 913e4ee06adca16cb3b322505f4b6aa9a86f8013dd06350f2c9dc83135182dfe |
| scripts/lib/trusted-cp-closure-resolution-gate.mjs | af43b33739ba05c0b178f5a87347edd774866dc7395ca302ce2a2b962ffded88 |
| scripts/lib/trusted-cp-fresh-child-boot-canary.mjs | b737d6b42460383f305a741fb9d5f12babe9b1e292f933d3735d68a907447802 |
| scripts/lib/trusted-cp-closure-resolution-gate.test.mjs | af364c01fca6b222d5bd00ff9585f938df6ecb4ba3328bfd34b2bd60dd5c3c60 |
| scripts/lib/trusted-cp-fresh-child-boot-canary.test.mjs | 5db9419b802ad7ae881d338a7bee0320fa818cbc21be5b9d90cc1bbb78b8cd6e |
| RED_GREEN_GATE-20261002.txt | 7776a91ce1fba82d98dc48b5a850ecef48a3ac1180007bc7453e8986f2905181 |
| RED_GREEN_BOOT_CANARY-20261002.txt | a1d02377e57d14eb273760d2e2cb0a1c43ac88e08fa87cf88f4d4b372403959d |
| RED_GREEN_EXECUTOR_REPAIR-20261002.txt (v2.1) | 751d364f39578761a51fc3f320f5535ea2545df884c66d83af720a9b85c740e0 |

v2.1 rebind note: only the executor row and the added repair RED/GREEN row changed vs the v2
table; the installer/gate/canary/test digests were re-verified byte-identical at pin
8fc374ca on 2026-10-02 (repair lane). The executing run materializes this evidence directory
from the v2.1 merge commit on main (MANIFEST.sha256 is the verification surface) while
DEPLOY_SRC remains a clean checkout at exactly the pin below.

Source pin: HEAD **8fc374ca8f97257b6947db291b82df5bb20acf67** (tree f60cc9e81b28d685418497f3fc1f67fe945f8703)
— the executor's DEPLOY_SRC must be a checkout at exactly this commit (e.g.
`git -C $REPO worktree add .worktrees/b7-v2-deploy 8fc374ca8f97257b6947db291b82df5bb20acf67`),
not the branch tip: the deploy checkout HEAD/tree gate (executor `deploy`) verifies it.
MANIFEST.sha256 carries the evidence-file rows (this package, the review, the executor, the
two RED/GREEN evidence files).

## §5 STAGE plan (amends v1 §4.1; STAGE order not to be inverted; each Owner-gated)

- **STAGE 0 — preflight** (unchanged from v1 as executed): production-deploy.lock check;
  executor preflight (durable store, floors, health `8790 ok:true/deliverReady:true`); fresh
  preimage re-pin per the CURRENT production algorithm
  `sudo rsync -a /usr/local/libexec/agent-core/ /usr/local/libexec/agent-core.bak-<UTC-ts>-pre-b7-v2/`
  + dry-run diff = 0; custody census (fixed script 7556029d…); lineage check
  (`12616dbff17f`, expiry 2026-10-11 17:43 +0800 — FRESH_LOGIN first if approaching).
- **STAGE 1 — deploy + NEW mandatory fresh-child boot canary**:
  1. `owner-router-closure-g2-g7.sh deploy` (rebound executor): §0b pre-mutation gate →
     installer §1 auto-preimage `agent-core.bak-<ts>` → §1a/§2 closure build under the runtime
     node → **§2c closure gate (fail-closed)** → app closure → §8 hardening.
  2. Executor then runs **FRESH_CHILD_BOOT_CANARY_V1 against the installed tree**
     (`--trusted-root /usr/local/libexec/agent-core`, disposable home, no credentials):
     PASS requires `[demo-server] ready pid=` with zero disallowed missing packages and no
     `plugin tree failed to load`. Any failure ⇒ fail-closed BEFORE any service restart or
     health handoff; restore exactly per §6 (the running runtime never left the old
     generation, so business impact of an aborted STAGE 1 is nil).
  3. Byte provenance echoes (v2.1: echo #3 path corrected to `process-registry-route-gate.js`;
     see the v2.1 REBIND note) → health.
- **STAGE 2 — codex closure carrier r12**: unchanged from v1 (G1 marker, three-way SHA, armed
  `--apply`, REAL PONG commit gate, `--commit`, fence clear). dsh-codex plugin tgz d4f0d0ec…
  and scopes tgz 7c628e30… remain digest-bound at
  `~/.agent-core/staging/chatgpt-subscription-provider-v1-authsvc/`.
- **STAGE 3 — acceptance** (#414 DONE_WHEN set, unchanged): fleet health; real **Luna canary**
  (driver call against the authsvc canonical); concurrent deliveries with zero
  `refresh_token_reused`; restart + readback; rollback + readback; **STOCK/CEO/CTO canaries**
  (frozen CTR-ACT2-002 set) inside the carrier apply.
- **STAGE 4 — cleanup** of the 92-home duplicates (v1 scope, unchanged).

## §6 Rollback / preimage (unchanged bindings)

P-1 installer §1 auto `agent-core.bak-<YYYYMMDD-HHMMSS>` per deploy; P-2 Owner pre-deploy
re-pin (STAGE 0); P-3 standing evidence `agent-core.bak-20261001-174434` (禁删, per the #376
preservation rule) + `agent-core.bak-20261001T144015Z-pre-b7-refreeze`. Restore algorithm:
`rm -rf /usr/local/libexec/agent-core && mv <newest agent-core.bak-*> /usr/local/libexec/agent-core`
with the restore reason recorded; never bare-rmdir a held mutex (dispose-stale-deploy-lock.sh).
Canaries invariant: STOCK/CEO/CTO untouched by rollback. §2c/canary failures occur before any
restart, so the usual case needs no restore at all (the tree was replaced, the service never
moved) — the executor still prints the exact restore command.

**RESTORE-R1 (v2.1, mandatory):** whenever the failed deploy's installer §1b REUSED
node-runtime, the §1 auto-preimage (the newest `agent-core.bak-*`) lacks node-runtime — §1b
mv-ed it OUT into the installed tree that the `rm -rf` then deletes. After the restore mv,
detect and repair from the fresh STAGE 0 preimage (the STAGE 0c re-pin, verified diff=0):

```bash
[ -x /usr/local/libexec/agent-core/node-runtime/bin/node ] || \
  rsync -a /usr/local/libexec/agent-core.bak-<STAGE0-UTC-ts>-pre-b7-v2/node-runtime/ \
        /usr/local/libexec/agent-core/node-runtime/
```

`rsync -a` COPY from the preimage — never a symlink, never a live node_modules patch. Then
re-verify live vs the STAGE 0 preimage (`rsync -ani --delete` → mtime-only lines at most).
Reproduced 2026-10-02 (#191 restore): the §1b-reuse restore landed WITHOUT node-runtime (2418
`*deleting node-runtime/*` lines in the restore-verification diff) and was repaired exactly
this way, content-exact; the running runtime was unaffected (open inode), but a cold boot in
that window would have failed launchd ProgramArguments. The executor carries the same clause
in its deploy comment block and in both fail-closed die messages; `--selftest-repair` proves
the RED (restore-without-node-runtime) and GREEN (content-exact re-materialization) hermetically.

## §7 Constraints held by the prep lane (this packet's authoring)

PRODUCTION_MUTATION = NO throughout: no deploy/restart/sudo/credential mutation; no live
node_modules patches; no ad-hoc production symlinks; production inspected read-only only. All
experiments ran in disposable `/tmp` candidates. Backups: none deleted, none mutated.

## §8 DONE_WHEN (B7, amended by this packet)

1. This packet's source pin merged to main (PR open, independent review PASS, SPEC_GATE n/a —
   no spec bytes touched, GOVERNING_SPECS_UNMODIFIED).
2. STAGE 0→1 executed with the new gates: closure gate PASS in the installer log + fresh-child
   boot canary PASS receipt in this evidence dir.
3. Carrier r12 applied: PONG gate committed, STOCK/CEO/CTO canaries PASS.
4. Fleet health `8790 ok:true/deliverReady:true`; real Luna canary PASS.
5. Concurrent deliveries with zero `refresh_token_reused`.
6. Restart + readback PASS; rollback + readback PASS (rollback drill may satisfy P-3 only via
   the documented algorithm).
7. `deploymentRoot` seams (d8ddf546) live and the authsvc canonical is the only lineage.
8. Execution log appended in this directory with stage receipts.
9. Backups enumerated in §2 still present and unmutated.
