# OPERATION_PACKAGE_V2 — SHARED_CODEX_AUTH_DEPLOYMENT_ROOT_REFREEZE_V2 (CLOSURE_RESOLUTION_GATE_V1)

> Product #414 [PRODUCT B7] continuation · 2026-10-02 · standing delegation #386
> Status: PREPARED(v2.2) / WAITING_PROD_EXECUTION (this prep lane: PRODUCTION_MUTATION = NO)
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

> **v2.2 REBIND (2026-10-02 repair lane, after agent-control#193 fail-closed at adoption):**
> the #193 terminal receipts proved two packet-internal defects, and the v2.2 lane's own
> fresh-pack gate surfaced a third gap of the same class. Unlike v2.1 (packet-internal
> repair, source pin UNCHANGED), this repair changes SHIPPED SOURCE / PACK CLOSURE, so per
> this package's own R4 it is a NEW freeze at a NEW source pin **b78aa30a (tree d5fb04c9)**
> — branch `svc/b7-v22-packet-repair-20261002` (base c25278e1 = the v2.1 merge):
> 1. **FIX A (Defect A, adoption FATAL):** the fresh pack resolved `@larksuite/channel` →
>    its nested `https-proxy-agent` → `proxy-agent-negotiate`, which NO pack input carries
>    (MAIN_REPO/node_modules lacks it top-level and under @larksuite; the old live tree's
>    top-level copy was ambient legacy). Repairs at the pin: `vendor/proxy-agent-negotiate/`
>    (exact bytes of the version production ran — v1.1.0, 5 files, digests below; byte-
>    identical to the live tree's copy) carried by installer §3 AFTER the dep loop, so the
>    vendored bytes win over ambient drift; NEW **§3b RUNTIME_APP_GRAPH_GATE_V1**
>    (`scripts/lib/trusted-cp-runtime-app-graph-gate.mjs`) imports the WHOLE
>    production-runtime boot graph under the trusted node in a throwaway home, BEFORE §4+.
>    This closes the exact coverage gap #193 proved: G2.5 boots the harness plugin tree,
>    never the runtime app surface.
> 2. **FIX A′ (same class, proven live by the new §3b gate during this lane):**
>    `packages/development-execution` deliberately has no package.json (DES code-only dir,
>    consumed via RELATIVE import from production-runtime), so the package.json-keyed §3
>    loop never packed it — no fresh pack of current main could boot; masked at #193 only
>    because the larksuite resolution failure fired earlier in the import order. §3 now
>    carries its src/ explicitly.
> 3. **FIX B (Defect B, restore completion):** installer §5b no longer blanket-chowns the
>    plist-pinned watchdog private state (`control/scheduler-watchdog` +
>    `control/incident-backups`, `SCHEDULER_INCIDENT_OWNER_GID=20`): the blanket `-R`
>    scope is bindings/scheduler/logs + control/ via find EXCLUDING the pinned set, and
>    the pin is asserted explicitly (existing state: `chgrp -R 20`, uid/modes untouched;
>    missing: pre-create 505:20 0700). **RESTORE-R2** (below + executor) re-pins the set
>    after any restore.
> 4. Executor `owner-router-closure-g2-g7-v22.sh`: pin moved to b78aa30a/d5fb04c9, **G2.6**
>    runs the app-graph gate against the installed tree after G2.5 (both pre-restart,
>    fail-closed), RESTORE-R2 added to the restore contract (comment block + all three die
>    messages), `--selftest-repair` extended (G2.6 wiring RED/GREEN + RESTORE-R2 real-
>    validator RED/GREEN + v2.2 contract markers).
> RED/GREEN evidence (v2.1 bytes → defect reproduced; v2.2 bytes → green):
> `RED_GREEN_RUNTIME_APP_GRAPH_GATE-20261002.txt` (RED = the exact #193
> `MISSING proxy-agent-negotiate imported from …/@larksuite/channel/node_modules/https-proxy-agent/dist/index.js`
> + gate FAIL; RED-A′ = development-execution gap fail-closed; GREEN = whole-graph import
> PASS under the installed node-runtime v25.6.1 x64 + G2.5 fresh-child canary regression
> PASS on the same stage) and `RED_GREEN_WATCHDOG_OWNERSHIP-20261002.txt` (v2.1 §5b bytes
> replayed → pinned group flips → the REAL readPrivateFile rejects `unsafe incident state
> file` = the #193 boot FATAL; v2.2 §5b replay → pinned set untouched, siblings unchanged;
> RESTORE-R2 heals; generators in `repair-v22-lane/`). Offline suites at the pin: 27 tests
> = 26 pass / 1 skip (live seam) / 0 fail; existing closure-gate + fresh-child-canary
> suites 12 pass / 1 skip unchanged; installer `--selftest-provenance` PASS; executor
> `--selftest` + `--selftest-repair` PASS. Status: PREPARED(v2.2) / WAITING_PROD_EXECUTION;
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
| OPERATION_PACKAGE_V2.md (this file, v2.2) | bound in MANIFEST.sha256 |
| INDEPENDENT_REVIEW_V22-20261002.md (v2.2 review) | 8dead616263c752f4a486aedd185bf08102ea0f8e024a5abe8720bc8cfafd9a6 |
| owner-router-closure-g2-g7-v22.sh (executor, v2.2) | 7aff93eb81d7bd3553317a8b2fa332984fccf707f862f176a76a30d0ae30d912 |
| scripts/trusted-cp-deploy-install.sh (at pin b78aa30a) | ad491b792764afb0b43dc39af856fd2f6bf491186e1f38f1a376ee9b1aa176e9 |
| scripts/lib/trusted-cp-closure-resolution-gate.mjs (unchanged v2 bytes) | af43b33739ba05c0b178f5a87347edd774866dc7395ca302ce2a2b962ffded88 |
| scripts/lib/trusted-cp-fresh-child-boot-canary.mjs (unchanged v2 bytes) | b737d6b42460383f305a741fb9d5f12babe9b1e292f933d3735d68a907447802 |
| scripts/lib/trusted-cp-runtime-app-graph-gate.mjs (NEW v2.2) | 6603818cdfda528d3a607e7e0216495dcfd648e3c23b81ec5c4d4477e5b4e98b |
| scripts/lib/trusted-cp-closure-resolution-gate.test.mjs (unchanged) | af364c01fca6b222d5bd00ff9585f938df6ecb4ba3328bfd34b2bd60dd5c3c60 |
| scripts/lib/trusted-cp-fresh-child-boot-canary.test.mjs (unchanged) | 5db9419b802ad7ae881d338a7bee0320fa818cbc21be5b9d90cc1bbb78b8cd6e |
| scripts/lib/trusted-cp-runtime-app-graph-gate.test.mjs (NEW v2.2) | 451a57f30a8b5b0336f040cff815747f43f928ba6857c5605f5c66f54a252bde |
| scripts/lib/trusted-cp-watchdog-ownership-guard.test.mjs (NEW v2.2) | 2d677b2adb63c2c7e69609f293dd797a363bfac1484a1b8a8d18f22ac2fdbe40 |
| vendor/proxy-agent-negotiate/** (NEW v2.2, 5 files) | dist/index.d.ts 3568fa0be646ebf28f9ead14e0c8fe3c7c6fb2bc846fc248f4161f02d7dbf423; dist/index.d.ts.map 4ade5fadd6dd7bcceb0663cf631e78dedca5a2243501e53b8a6c019a32f82bc5; dist/index.js 56f33d231c16933054a0dddc665abdc8514d952c84fa96b245e841875d05f5e5; dist/index.js.map cff70853e95eda06a4427db41c4cd5fa93d2d794ae4198c3ab4f7468450c3f9e; package.json 7b7c2579ea138d20d4f7699ca78ef16c526f35168dbf694f1d47cc861b0954d4 |
| RED_GREEN_RUNTIME_APP_GRAPH_GATE-20261002.txt (NEW v2.2) | 0dfb8538ddbd1d3dc8919022c09a8b0ab4ba7535826600e8e27b688a49a6cec9 |
| RED_GREEN_WATCHDOG_OWNERSHIP-20261002.txt (NEW v2.2) | d3ab7b790e41b1b4d3e3afdc1b6fa4f8866348707da56a7e400a93deae2d869f |
| repair-v22-lane/red-green-app-graph.sh (generator) | 93336f90717bbd67337aaee837b2cc64da9564efcc1208b5bf620623a5287bc1 |
| repair-v22-lane/red-green-ownership.sh (generator) | f35360a30cfed83ce885e7ff551c4d7287d1ff4a165572503098a1887ac29da1 |

Historical rows (unchanged bytes, re-verified 2026-10-02 at the v2.2 lane; kept in
MANIFEST.sha256 for whole-dir coverage): INDEPENDENT_REVIEW_V2.md a5039c2e…;
owner-router-closure-g2-g7.sh (v2.1 executor, superseded by the -v22 file) 6cabf9cd…;
RED_GREEN_GATE-20261002.txt 7776a91c…; RED_GREEN_BOOT_CANARY-20261002.txt a1d02377…;
RED_GREEN_EXECUTOR_REPAIR-20261002.txt 751d364f….

Source pin: HEAD **b78aa30a48e00efda710b255a91e94bebdb7cec0** (tree d5fb04c96de5ea7befe130e59590db29236b71ed)
— the executor's DEPLOY_SRC must be a checkout at exactly this commit (e.g.
`git -C $REPO worktree add .worktrees/b7-v22-packet-repair-20261002 b78aa30a48e00efda710b255a91e94bebdb7cec0`),
not the branch tip (the branch tip additionally carries this evidence rebind; the source
tree the installer packs is the pin's): the deploy checkout HEAD/tree gate (executor
`deploy`) verifies it. GOVERNING_SPECS_UNMODIFIED: `git diff --name-only c25278e1..b78aa30a`
= exactly the 9 declared files (installer + gate lib + 2 new tests + 5 vendored files);
docs/specs/ delta = 0 files.

## §5 STAGE plan (amends v1 §4.1; STAGE order not to be inverted; each Owner-gated)

- **STAGE 0 — preflight** (unchanged from v1 as executed): production-deploy.lock check;
  executor preflight (durable store, floors, health `8790 ok:true/deliverReady:true`); fresh
  preimage re-pin per the CURRENT production algorithm
  `sudo rsync -a /usr/local/libexec/agent-core/ /usr/local/libexec/agent-core.bak-<UTC-ts>-pre-b7-v2/`
  + dry-run diff = 0; custody census (fixed script 7556029d…); lineage check
  (`12616dbff17f`, expiry 2026-10-11 17:43 +0800 — FRESH_LOGIN first if approaching).
- **STAGE 1 — deploy + mandatory pre-cutover gates (fresh-child canary + runtime app-graph)**:
  1. `owner-router-closure-g2-g7-v22.sh deploy` (v2.2 executor): §0b pre-mutation gate →
     installer §1 auto-preimage `agent-core.bak-<ts>` → §1a/§2 closure build under the runtime
     node → **§2c closure gate (fail-closed)** → app closure (§3 now carries the vendored
     `proxy-agent-negotiate` + `packages/development-execution/src`) → **§3b
     RUNTIME_APP_GRAPH_GATE_V1 (fail-closed, before §4+)** → §8 hardening.
  2. Executor then runs **FRESH_CHILD_BOOT_CANARY_V1 against the installed tree**
     (`--trusted-root /usr/local/libexec/agent-core`, disposable home, no credentials):
     PASS requires `[demo-server] ready pid=` with zero disallowed missing packages and no
     `plugin tree failed to load`. Then **G2.6 RUNTIME_APP_GRAPH_GATE_V1 against the
     installed tree** (the whole production-runtime app import graph, throwaway home, no
     services started). Any failure ⇒ fail-closed BEFORE any service restart or health
     handoff; restore exactly per §6 incl. RESTORE-R2 (the running runtime never left the
     old generation, so business impact of an aborted STAGE 1 is nil).
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

**RESTORE-R2 (v2.2, mandatory whenever the failed deploy's installer reached §5b):** the
plist-pinned watchdog private state (`/Users/authsvc/.agent-core/control/scheduler-watchdog`
+ `/Users/authsvc/.agent-core/control/incident-backups`, `SCHEDULER_INCIDENT_OWNER_GID=20`)
must be re-pinned after the restore mv — the v2.1-era blanket `chown -R 505:601 … control`
flipped the group 20→601 (#193: the restored tree then failed its own scheduler startup
readiness gate `unsafe incident state file`, 8790 down ~03:41–03:47 until the group was
re-pinned by hand at 03:46). The v2.2 installer excludes the set from the blanket pass, but
any rollback from a PRE-v2.2 installed generation can still leave the damage behind:

```bash
for p in /Users/authsvc/.agent-core/control/scheduler-watchdog \
         /Users/authsvc/.agent-core/control/incident-backups; do
  [ -d "$p" ] && chgrp -R 20 "$p"
done
```

Idempotent no-op when already correct; uid/modes untouched; never a symlink, never a live
node_modules patch. The executor carries the same clause in its deploy comment block and in
all three fail-closed die messages (verbatim command inlined in the two restore-path dies;
the G2.6 die references the deploy comment block); `--selftest-repair` proves the RED (real readPrivateFile
rejects a foreign group) and GREEN (the pin heals) hermetically against the REAL
`private-state-io.js` validator.
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
2. STAGE 0→1 executed with the v2.2 gates: §2c closure gate + §3b runtime app-graph gate
   PASS in the installer log + fresh-child boot canary (G2.5) AND app-graph gate (G2.6) PASS
   receipts in this evidence dir.
3. Carrier r12 applied: PONG gate committed, STOCK/CEO/CTO canaries PASS.
4. Fleet health `8790 ok:true/deliverReady:true`; real Luna canary PASS.
5. Concurrent deliveries with zero `refresh_token_reused`.
6. Restart + readback PASS; rollback + readback PASS (rollback drill may satisfy P-3 only via
   the documented algorithm).
7. `deploymentRoot` seams (d8ddf546) live and the authsvc canonical is the only lineage.
8. Execution log appended in this directory with stage receipts (append-only).
9. Backups enumerated in §2 still present and unmutated.
