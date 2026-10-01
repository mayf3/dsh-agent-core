# B7 V2 PRODUCTION EXECUTION LOG — 2026-10-02 (standing delegation #386, Product #414, agent-control#191)

Operator session: sess_e3b80663-ac8c-400f-8a0b-b53f162edcd5 (LOCAL_AGENT_STARTED receipt on
agent-control#191 at 2026-10-01T17:42:39Z; autonomous execution under the #386 Owner delegation
comment 2026-10-01T14:24:03Z). Executed bytes: rebound executor + OPERATION_PACKAGE_V2 +
INDEPENDENT_REVIEW_V2 materialized from the merged PR #421 tree at merge commit
7c0d2fe9edc4e189c3ae95f035d95fda809e8429 (MANIFEST.sha256 verified 5/5 OK); DEPLOY_SRC worktree
detached at the packet source pin.

## COMMAND-BUS PRECHECK (before any production read)

- Product #414 fresh-read: DONE_WHEN 1-10; claim `b7-v2-prod-closure-20261002` bound to
  ACTIVE_EXECUTION = agent-control#191 = this session; LAST_COMMAND = agent-control#187
  STOPPED_AFTER_ROLLBACK (2026-10-01T13:51:23Z).
- Standing delegation #386 fresh-read: routine merge/deploy/canary/rollback/acceptance/closure
  unattended; post-mutation failure rule = immediate deterministic rollback; ask Owner only for
  non-delegable external actions (interactive login, unavailable secrets, Owner feishu PONG,
  destructive-outside-contract work, material drift).
- #189 result: CLOSED — packaging repair lane COMPLETE-AS-PREPARED (PR #421, packet v2,
  memory + issue record); its successor command is #191 (this run).
- Old writers stopped: agent-control#183 (v1 deploy, sess_7b627a1e) and #187 (v1 rollback,
  sess_7b627a1e) both show no live writer — process census 2026-10-02T01:5x+0800 found zero
  zcode-cli processes with dsh-agent-core cwd other than pid 46565 (this session); remaining
  zcode-cli pids 1993 (/Users/yanfenma/ZCodeProject) and 61419 (agent-six-pack-runtime) are
  unrelated lanes. Single-writer admission truth = #414 ACTIVE_EXECUTION bound to #191.

## FROZEN PACKET VERIFICATION (gates before any mutation)

- PR #421 merge commit 7c0d2fe9 present on origin/main; packet dir materialized byte-exact via
  `git show 7c0d2fe9:...` into docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/.
- MANIFEST.sha256: 5/5 OK (OPERATION_PACKAGE_V2, INDEPENDENT_REVIEW_V2, executor
  owner-router-closure-g2-g7.sh = 69eb0af8…, RED_GREEN_GATE, RED_GREEN_BOOT_CANARY).
- Source pin worktree .worktrees/b7-closure-runtime-arch-gate-20261002 detached from branch tip
  2fd13199 to HEAD 8fc374ca8f97257b6947db291b82df5bb20acf67 (tree f60cc9e81b28d685418497f3fc1f67fe945f8703),
  status clean (0 entries) — satisfies the executor deploy HEAD/tree gate (NOT branch tip).
- §4 artifact digests at the pin, all exact:
  trusted-cp-deploy-install.sh = 913e4ee0… ✓; trusted-cp-closure-resolution-gate.mjs = af43b337… ✓;
  trusted-cp-fresh-child-boot-canary.mjs = b737d6b4… ✓; both .test.mjs = af364c01…/5db9419b… ✓.
- GOVERNING_SPECS_UNMODIFIED: `git diff --name-only 47aadec1..8fc374ca` = exactly the 5 declared
  files; docs/specs/ delta = 0 files.
- Installer offline selftest --selftest-provenance = PASS (T1a/T1b/T2/T3/T4/T5/T6/T7/T8).
- Gate+canary suites re-run at the pin: 13 tests = 12 pass / 1 skip (live-closure seam), 0 fail —
  matches INDEPENDENT_REVIEW_V2 record.
- STAGE 2 frozen artifacts re-verified byte-exact: carrier owner-authsvc-plugin-upgrade.sh =
  9f835448… ✓; staging dsh-codex-0.2.3-75d98d5b.tgz = d4f0d0ec… ✓; codex-deps-scopes-rc8.tgz =
  7c628e30… ✓; AMENDMENT_ACCEPTED.marker present (specHead b08db324, deploymentRoot=/Users/authsvc/.agent-core).
- Custody census script digest = 7556029d… ✓ (router-durable-generation-restart-safety-v1-20260921/).
- Old 2097e4f worktree .worktrees/deploy-2097e4f untouched (R4).

## STAGE 0 — PREFLIGHT

- 0a production-deploy.lock: NOT HELD (/usr/local/var/agent-core/production-mutation-locks/
  production-deploy.lock absent; locks dir empty; read 2026-10-02T01:56+0800).
- 0b-arch runtime node anchor: live trusted node /usr/local/libexec/agent-core/node-runtime/bin/node
  = Mach-O x86_64, process.arch=x64, v25.6.1; Cellar anchor /usr/local/bin/node resolves to the
  SAME version+arch (x64 v25.6.1) → §1a anchor and §1b reuse criteria aligned with the executing
  runtime (the 2026-10-02 rollback root cause — arm64-host pnpm arch split — is structurally
  addressed by installer §1a/§2 + §2c gate).
- 0b executor preflight (sudo owner-router-closure-g2-g7.sh preflight @ 2026-10-02 01:57:11 +0800):
  durable store loadable; 93 agents; top floors=3 (nine agents), floor=2 for the remainder;
  zero overlapping ranges; live app mtime Sep 29 11:58:15 2026 (= restored preimage,
  temporary-recovery tree; runtime pid 2767 authsvc launched 2026-10-01 19:36:01, never restarted
  through the v1 failed generation + rollback). PREFLIGHT_DONE.
- 0b-health fleet health: 8790 {"ok":true,"service":"agent-core-notification-ingress",
  "deliverReady":true,"authConfigured":false,"storeReady":true} — same healthy shape as v1 STAGE 0d
  (authConfigured:false is the recorded pre-existing ingress state, not part of B7).
- 0d lineage: canonical /Users/authsvc/.agent-core/shared-credentials/openai-codex/.openai-codex-auth.json
  mode 0600, nlink 1, inode 120507344, mtime 2026-10-01T17:43:34+0800, owner authsvc:authsvc,
  not a symlink, tombstone absent — matches recorded FRESH_LOGIN lineage 12616dbff17f exactly
  (sha12 fingerprint at preflight: f38cd250576a). Expiry 2026-10-11T09:43:34Z (17:43 +0800) →
  ~9.7 days runway ⇒ RATIFY branch (no FRESH_LOGIN required).
- 0c FRESH PREIMAGE RE-PIN: sudo rsync -a /usr/local/libexec/agent-core/
  /usr/local/libexec/agent-core.bak-20261001T175809Z-pre-b7-v2/ (started 2026-10-02T01:58+0800,
  RSYNC_EXIT=0, 23G); dry-run diff `rsync -ani --delete` live vs preimage = **0 lines (exact)**.
- 0e custody census receipt (fixed script 7556029d…): CANONICAL_VALID=YES (fresh=true
  tombstone=false); CANONICAL_LINEAGE_REFRESH_SHA12=12616dbff17f;
  AUTHORITATIVE_REFRESH_LINEAGE_COUNT=1; 92 same-lineage copies, 0 foreign;
  NO_DUPLICATE_CREDENTIAL_PATH=PASS; YANFENMA_LINEAGE_SEPARATE=YES; cross-surface scan hits are
  session-transcript paths only (not 505-executed config/code). PRE_ACTIVATION_DONE.
- Environmental prerequisites: pnpm content store 1.9G/44477 files (repaired 2026-10-01, intact);
  MAIN_REPO node_modules carries @larksuiteoapi + croner (installer §3 dep copy source);
  disk free 71Gi; executor `--selftest` family PASS; installer offline selftest PASS.

**STAGE 0 VERDICT = ALL PASS — no material drift detected; frozen packet remains valid
(live tree = the restored preimage the packet was authored against; node anchor x64 = x64;
lineage/expiry on the RATIFY branch; artifacts digest-bound). Proceeding to STAGE 1.**

## STAGE 1 — DEPLOY + G2.5 (EXECUTOR ABORTED AT STALE RECEIPT ECHO — FAIL-CLOSED — RESTORED)

- deploy launched 2026-10-02T02:12+0800 via `sudo bash owner-router-closure-g2-g7.sh deploy`
  (executor 69eb0af8…; full log /tmp/b7-v2-stage1-deploy.log).
- Executor HEAD/tree gate: PASS (8fc374ca / f60cc9e8, clean worktree).
- Installer (913e4ee0…, env EXPECTED_SOURCE_SHA/TREE/GENERATION_LABEL_SHA=8fc374ca/f60cc9e8):
  - §0 provenance: HEAD/tree/clean=8fc374ca/f60cc9e8/yes — PASS.
  - §0b PRE-MUTATION contamination gate: PASS ("no /Users/yanfenma references in the pack source").
  - §1 auto-preimage: `agent-core.bak-20261002-021203` created (backup mv).
  - §1a runtime node anchor: /usr/local/Cellar/node/25.6.1_1/bin/node (v25.6.1, arch **x64**).
  - §1b node-runtime REUSED from the auto-preimage (same version v25.6.1, same arch x64) —
    note: this **mv**s node-runtime OUT of the auto-preimage into the new install.
  - §2 harness closure FRESH build (offline frozen pnpm under the x64 anchor node; JSON-format
    legacy .source-stamp correctly blocked the reuse path).
  - §2c CLOSURE_RESOLUTION_GATE_V1: **PASS** (ran under the trusted x64 node before app pack).
  - §3 app closure packed; TOCTOU stamp match; packed app tree sha256 08228e35a859ef37…;
    pack-provenance.json receipt; agent-definition PRESENT / agent-registry ABSENT;
    production-runtime closure PRESENT.
  - §4-§7 home/config/ownership/helper: PASS (Agent Definition + credential store preserved
    from the auto-preimage).
  - §8 symlink audit + contamination scan + §9 uid-502 spot checks: PASS.
- **EXECUTOR ABORT (fail-closed)**: post-deploy byte-provenance echo #3
  `grep -c AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE …/process-registry.js` returned 0 →
  `die "deployed bytes do not contain the reviewed fix"` → executor exited BEFORE G2.5 and
  BEFORE any restart. The deployed tree DID contain the fix — the constant lives in
  `process-registry-route-gate.js:52` (route-gate echo #2 returned hits=4 on the deployed
  tree; echo #1 store.js highestIssuedGeneration hits=1). Verified: the string lives ONLY in
  process-registry-route-gate.js at the pin 8fc374ca, at v2 base 47aadec1, at v1 base
  360756e3, AND at v1 pin d8ddf546 — the echo greps a file that never carried the string in
  any relevant generation. This is a **stale wrong-path receipt line inside the frozen v2
  executor (inherited verbatim from the v1 executor)** — a packet-internal defect that
  deterministically aborts every deploy run AFTER the installer mutates the tree and BEFORE
  the packet's own load-bearing G2.5 gate. NOT environmental drift; NOT a bad deployment;
  the runtime never restarted (pid 2767 uninterrupted; health ok:true/deliverReady:true
  continuously; zero business impact).
- G2.5 evidence collected out-of-band via the packet's OWN standalone subcommand (read-only,
  disposable home): `sudo bash owner-router-closure-g2-g7.sh boot-canary` against the installed
  tree → **ready=true pluginTreeFailed=false → FRESH_CHILD_BOOT_CANARY PASS**
  (/tmp/b7-v2-g25-standalone.log). The installed generation was bootable by fresh children —
  the 2026-10-02 rollback class is structurally fixed and was verified on the installed tree.
- **NOTWITHSTANDING the PASS canary, STAGE 1 did not complete per the frozen definition**
  (executor non-zero). Per the executor's own deploy contract and the fail-closed discipline,
  no restart / no STAGE 2 was attempted, and the deterministic restore was executed.

## ROLLBACK / RESTORE PROOF (deterministic, per the executor contract)

- Restore reason recorded: frozen executor aborted post-mutation (stale echo); STAGE 1
  formally incomplete ⇒ the installed generation must not be adopted (any launchd cold-boot
  would execute a tree whose STAGE 1 acceptance formally failed).
- Deployed-tree provenance evidence preserved before restore:
  /tmp/b7-v2-installed-pack-provenance.json (packed app tree sha256 08228e35…).
- Restore: `rm -rf /usr/local/libexec/agent-core && mv /usr/local/libexec/agent-core.bak-20261002-021203
  /usr/local/libexec/agent-core` (the executor contract's exact algorithm; newest bak-*).
- **LESSON (new failure class, record for the repair lane)**: the §1b node-runtime REUSE *mv*s
  node-runtime OUT of the auto-preimage; a restore from that auto-preimage therefore lands
  WITHOUT node-runtime (the only other copy dies with the `rm -rf` of the installed tree).
  Detected immediately by the restore-verification diff (2418 `*deleting node-runtime/*`
  lines); repaired within minutes by re-materializing node-runtime from the STAGE 0 fresh
  preimage (byte-exact per the STAGE 0c 0-line diff): running runtime was never affected
  (open inode), but a cold boot between restore and repair would have failed launchd
  ProgramArguments. **The restore runbook must add: re-materialize node-runtime from the
  fresh STAGE 0 preimage whenever §1b reused it.**
- Restored state verification (all PASS):
  - `rsync -ani --delete` live vs STAGE 0 fresh preimage = 2 lines, BOTH mtime-only
    (./ and .backup-meta) — **content exact**, same shape as the v1 restore verification.
  - node-runtime present: v25.6.1 x64, owner root:wheel mode -r-xr-xr-x (= preimage state).
  - health 8790 {"ok":true,"deliverReady":true,"authConfigured":false,"storeReady":true};
    runtime pid 2767 (launched 2026-10-01 19:36:01) NEVER exited through the whole cycle.
  - durable store loadable (floor=3, no overlapping ranges).
  - production-deploy.lock: released (locks dir empty, 02:13).
  - Backups preserved untouched: agent-core.bak-20261001-174434 (禁删),
    agent-core.bak-20261001T144015Z-pre-b7-refreeze, agent-core.bak-20261001T175809Z-pre-b7-v2.

## STAGE 2-4: NOT EXECUTED (fail-closed stop; see VERDICT)

## VERDICT

```text
PRECHECK                    = PASS (claim #191 = this session; #183/#187 writers stopped;
                              #386 standing delegation fresh-read)
PACKET_GATES                = PASS (PR #421 merge 7c0d2fe9; pin 8fc374ca/f60cc9e8 clean worktree;
                              MANIFEST 5/5; §4 digests exact; GOVERNING_SPECS_UNMODIFIED;
                              installer selftest PASS; gate/canary suites 12 pass / 1 skip)
STAGE_0                     = ALL PASS (lock free; node anchor x64=x64; durable load 93 agents;
                              health ok:true/deliverReady:true; lineage 12616dbff17f exact-match,
                              expiry 2026-10-11 → RATIFY; fresh preimage 175809Z diff=0;
                              custody census all PASS/YES, 92 same-lineage copies, 0 foreign)
STAGE_1_INSTALLER           = ALL GATES PASS (§0b, §1a x64 anchor, §2 fresh x64 closure,
                              §2c CLOSURE_RESOLUTION_GATE_V1 PASS, §3 TOCTOU, §8, §9)
STAGE_1_EXECUTOR            = ABORTED at post-deploy byte-provenance echo #3 — stale wrong-path
                              receipt (string lives in process-registry-route-gate.js, echo greps
                              process-registry.js; wrong at the pin AND at every reference commit
                              since v1). Packet-internal defect; NOT drift; NOT a bad deployment.
G2_5_FRESH_CHILD            = PASS (standalone subcommand against the installed tree:
                              ready=true pluginTreeFailed=false) — evidence collected, gate
                              satisfied in substance, but AFTER the frozen run had aborted.
RESTART                     = NOT PERFORMED (STAGE 1 formally incomplete ⇒ no adoption)
ROLLBACK                    = EXECUTED deterministically; restored state content-exact
                              (2 mtime-only lines vs fresh preimage); health/store/pid verified;
                              NEW LESSON recorded: restore must re-materialize node-runtime when
                              §1b reused it (mv-out-of-backup + rm -rf installed tree loses it)
PRODUCTION_IMPACT           = NONE (runtime pid 2767 uninterrupted; health continuous PASS;
                              business canaries/lineage untouched)
FINAL_STATE                 = production healthy on the restored preimage (temporary-recovery
                              tree, identical to the state the packet was authored against);
                              STAGE 2/3/4 NOT reached; #414 DONE_WHEN NOT satisfied
NEEDS_USER                  = repaired executor (one-line echo path fix process-registry.js →
                              process-registry-route-gate.js) as a new prep lane + re-bound
                              packet, then re-run STAGE 0→1 (installer is re-runnable; fresh
                              preimage already in place). No production action possible with
                              the frozen bytes as-is: the executor deterministically aborts
                              before its own G2.5 gate.
```

## REPAIR LANE ADDENDUM — PACKET V2.1 REBIND (2026-10-02, non-production; successor to #191)

Scope: the two directly proven packet-internal defects from the STAGE 1 abort above; no other
change; PRODUCTION_MUTATION = NO throughout (no deploy/restart/sudo/credential/data mutation,
no live symlinks or node_modules patches; production untouched; all backups preserved
untouched: bak-20261001-174434 / bak-20261001T144015Z-pre-b7-refreeze /
bak-20261001T175809Z-pre-b7-v2). Fresh reads before authoring: #414, #191 terminal receipts,
#386 standing delegation, PR #421 merge 7c0d2fe9 (= origin/main), this directory.

- **FIX 1 (echo #3 stale wrong-path receipt)**: executor post-deploy byte-provenance echo #3
  now greps `AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE` in
  `process-registry-route-gate.js` (:52) — the inherited grep of `process-registry.js`
  returned 0 hits at the pin AND at 47aadec1/360756e3/d8ddf546. Echoes extracted into
  `byte_provenance_verdict()` (deploy uses it against $TRUSTED_APP; `--selftest-repair`
  against a fixture). Executor 69eb0af8… → **6cabf9cd010e1aa35fc2bf014de62a9c6ae14ee621c3fbe9ae9e13a0a7f61710**.
- **FIX 2 (RESTORE-R1)**: restore contract (deploy comment block + both fail-closed die
  messages + packet §6) now re-materializes node-runtime from the fresh STAGE 0 preimage
  (`rsync -a` COPY, never a symlink / node_modules patch) whenever installer §1b reused it —
  the #191 restore class (2418 `*deleting node-runtime/*` lines). Rollback semantics
  otherwise unchanged (rm -rf live + mv newest bak back; backup set untouched).
- **NEW offline gate `--selftest-repair`** (hermetic /tmp, no sudo, no production access):
  SELFTEST_REPAIR_PASS — echo#3 GREEN verdict on a pin-layout fixture + RED reproduction
  (stale process-registry.js grep = 0 hits → the exact #191 die); restore RED (§1b-reuse
  restore lands WITHOUT node-runtime) + restore GREEN (RESTORE-R1 re-materialization,
  content-exact); contract markers present in executor + packet §6.
- **RED/GREEN evidence**: RED_GREEN_EXECUTOR_REPAIR-20261002.txt — frozen v2 echo block
  (bytes from 7c0d2fe9, digest 69eb0af8…) re-run verbatim against the fixture → hits=0 →
  `FAIL: deployed bytes do not contain the reviewed fix` rc=1 (= the #191 abort, hermetic);
  v2.1 executor on the SAME fixture → hits=1/1/1 → PASS rc=0.
- **Packet re-bind**: §4 executor row → 6cabf9cd…; §4 adds the repair RED/GREEN row
  (751d364f…); installer/gate/canary/test digests re-verified byte-identical at pin 8fc374ca
  (913e4ee0/af43b337/b737d6b4/af364c01/5db9419b); MANIFEST.sha256 re-bound, 6/6 OK (adds the
  repair RED/GREEN row). DEPLOY_SRC pin **8fc374ca / f60cc9e8 UNCHANGED** (worktree clean);
  GOVERNING_SPECS_UNMODIFIED (zero docs/specs/** and zero scripts/** delta in this lane).
- **Status after this lane**: SOURCE=PR_READY (branch svc/b7-v21-packet-repair-20261002,
  independent changed-surface review on the final exact head recorded in the PR) /
  PROD_AUTH=PREPARED (exact v2.1 packet ready for the next standing-delegation production
  run: re-verify pin + MANIFEST → STAGE 0→1 (installer re-runnable; fresh preimage
  bak-20261001T175809Z-pre-b7-v2 already in place; node-runtime restored) → restart/G4-G5 →
  STAGE 2 carrier r12 → STAGE 3 acceptance → STAGE 4 cleanup, per §5 unchanged).

---

# B7 V2.2 REPAIR LANE — 2026-10-02 (non-production; successor to #193; agent-control#194)

Scope: the two directly proven packet-internal defects from the #193 adoption failure, plus
one same-class gap the new gate itself surfaced; PRODUCTION_MUTATION = NO throughout (no
deploy/restart/sudo/credential/data mutation, no Remote Desktop, no live symlinks or
node_modules patches; production untouched on the restored preimage, pid 74673 healthy;
all backups preserved untouched: bak-20261001-174434 (禁删) / bak-20261001T144015Z-pre-b7-refreeze /
bak-20261001T175809Z-pre-b7-v2). Fresh reads before authoring: #414, #193 terminal receipts
(comment 5939355758), #386 standing delegation, PR #422 merge c25278e1 (= origin/main),
this directory (v2.1 packet + execution log). Because FIX A changes shipped source/pack
closure, this is a NEW freeze at a NEW source pin per the packet's own R4 (unlike the
packet-internal v2.1 rebind).

- **FIX A (Defect A)**: `vendor/proxy-agent-negotiate/` (v1.1.0, exact bytes production ran
  — 5-file sha256 manifest in packet §4, byte-identical to the live tree's ambient copy and
  to a clean worktree install) carried by installer §3 AFTER the dep loop; NEW §3b
  RUNTIME_APP_GRAPH_GATE_V1 imports the WHOLE production-runtime app graph under the trusted
  node, throwaway home, before §4+.
- **FIX A′ (same class, proven live by the new gate in this lane)**: packages/development-
  execution (no package.json, relative import from production-runtime/src/development-
  execution-runtime.js:13) was never packed; §3 now carries its src/ — the masked
  "next failure" of every fresh pack of current main.
- **FIX B (Defect B)**: §5b blanket `-R` scope no longer contains control/ (find-exclusion of
  control/scheduler-watchdog + control/incident-backups); the plist-pinned group is asserted
  explicitly (chgrp -R 20; missing dirs pre-created 505:20 0700); RESTORE-R2 in the restore
  contract (installer §8 late-gate text + executor comment/die messages + packet §6).
- **Executor owner-router-closure-g2-g7-v22.sh**: pin → b78aa30a/d5fb04c9; G2.6 runs the
  app-graph gate against the installed tree after G2.5 (both fail-closed pre-restart);
  RESTORE-R2 in all three die messages; --selftest-repair extended (G2.6 wiring RED/GREEN,
  RESTORE-R2 real-validator RED/GREEN, v2.2 contract markers); --selftest PASS.
- **RED/GREEN evidence** (v2.1 bytes → defect; v2.2 bytes → green):
  RED_GREEN_RUNTIME_APP_GRAPH_GATE-20261002.txt — RED-A: exact #193 line
  (`MISSING proxy-agent-negotiate imported from …/@larksuite/channel/node_modules/https-proxy-agent/dist/index.js`)
  + gate FAIL on a fresh §3-shaped stage; RED-A′: development-execution gap fail-closed;
  GREEN-A: whole-graph import PASS under the installed node-runtime (v25.6.1 x64);
  G2.5 fresh-child canary PASS on the same stage (regression).
  RED_GREEN_WATCHDOG_OWNERSHIP-20261002.txt — v2.1 §5b bytes (913e4ee0) replayed → pinned
  group 20→damage → the REAL readPrivateFile(expectedGid:20) rejects `unsafe incident state
  file` (= the #193 boot FATAL); v2.2 §5b replay → pinned set untouched at 20 (validator
  accepts), non-pinned control state still receives the blanket (reader-gid 601 contract
  untouched); RESTORE-R2 heals the damage; generators committed in repair-v22-lane/.
- **Suites at the pin** (attribution corrected in the absorb commit; the packet-commit
  message mislabeled the split): NEW gate + ownership suites 14 tests = 14 pass / 0 fail;
  existing closure-resolution + fresh-child-canary suites 13 tests = 12 pass / 1 skip /
  0 fail (unchanged from the frozen record); scripts/lib four-suite total 27 tests =
  26 pass / 1 skip / 0 fail; installer --selftest-provenance PASS; fresh-pack full
  production-runtime boot/import gate = GREEN-A above.
- **Packet re-bind**: §0 v2.2 REBIND block; §4 table rebound (executor cc993d92…, installer
  ad491b79… at the new pin, NEW gate lib 6603818c…, NEW tests, vendored 5-file manifest, NEW
  RED/GREEN rows + generators; unchanged-by-design rows re-verified identical: closure gate
  af43b337…, fresh-child canary b737d6b4…, both v2 test files af364c01…/5db9419b…;
  historical v2/v2.1 rows kept, byte-identical); MANIFEST.sha256 11/11 OK. DEPLOY_SRC pin
  **b78aa30a / d5fb04c9**; GOVERNING_SPECS_UNMODIFIED (c25278e1..b78aa30a = exactly the 9
  declared files, 0 docs/specs).
- **Status after this lane**: SOURCE=PR_READY (branch svc/b7-v22-packet-repair-20261002,
  independent changed-surface review on the final exact head recorded as
  INDEPENDENT_REVIEW_V22-20261002.md + in the PR) / PROD_AUTH=PREPARED (exact v2.2 packet
  ready for the next standing-delegation production run: materialize this evidence dir from
  the v2.2 merge commit; DEPLOY_SRC worktree detached at exactly b78aa30a → STAGE 0 (fresh
  preimage re-pin) → STAGE 1 (§3b + G2.5 + G2.6 all pre-restart) → restart/G4-G5 → STAGE 2
  carrier r12 → STAGE 3 acceptance → STAGE 4 cleanup, per §5; if anything fails: restore
  per §6 with RESTORE-R1 AND RESTORE-R2).

---

# B7 V2.2 PRODUCTION RUN — 2026-10-02 (standing delegation #386, Product #414, agent-control#195)

Operator session: sess_da12ce3c-302d-46f2-b1cc-131ac4b1e626. Executed bytes: v2.2 packet
materialized from the merged PR #423 tree at merge commit 431bcab8ec469363ed4a15f21540185d4dbb5078
(= origin/main tip; MANIFEST.sha256 verified 12/12 OK; on-disk dir re-materialized byte-exact —
the pre-run on-disk copy was stale v2.1-era and lacked every v2.2 rebind row; one pre-existing
run-era append-only snapshot gen-snapshot-…-pre-restart-v21-…json kept, all packet files exact).
DEPLOY_SRC worktree .worktrees/b7-v22-packet-repair-20261002 DETACHED from branch tip 0f7020a2
to the packet pin HEAD b78aa30a48e00efda710b255a91e94bebdb7cec0 (tree d5fb04c96de5ea7befe130e59590db29236b71ed,
status clean; pin→tip delta = exactly the 9 evidence-dir files, zero src).

## FROZEN PACKET VERIFICATION (all exact, before any mutation)

- §4 digests at the pin ALL exact: installer ad491b79…; closure gate af43b337…; fresh-child
  canary b737d6b4…; NEW app-graph gate 6603818c…; 4 test files af364c01/5db9419b/451a57f3/2d677b2a;
  vendored proxy-agent-negotiate 5-file manifest byte-exact. GOVERNING_SPECS_UNMODIFIED:
  c25278e1..b78aa30a = exactly the 9 declared files; docs/specs delta = 0.
- Offline suites at the pin: installer --selftest-provenance PASS (T1a–T8); executor --selftest
  PASS; executor --selftest-repair PASS (echo#3 GREEN+RED; RESTORE-R1 RED/GREEN; G2.6 wiring
  GREEN/RED fail-closed; RESTORE-R2 real-validator RED/GREEN; contract markers). Four gate
  suites 27 tests = 0 fail (closure-resolution 9, fresh-child 4, app-graph 7, watchdog-ownership 7).
- STAGE 2 artifacts re-verified: carrier owner-authsvc-plugin-upgrade.sh = 9f835448… (= marker
  scriptSha256) ✓; staging dsh-codex-0.2.3-75d98d5b.tgz = d4f0d0ec… ✓; codex-deps-scopes-rc8.tgz
  = 7c628e30… ✓; AMENDMENT_ACCEPTED.marker present (deploymentRoot=/Users/authsvc/.agent-core).
- Custody census script 7556029d… ✓. Manifest executor row owner-router-closure-g2-g7-v22.sh =
  7aff93eb… ✓ (manifest-verified).

## STAGE 0 — PREFLIGHT: ALL PASS

- 0a production-deploy.lock: NOT HELD (locks dir empty).
- 0b-arch: live trusted node Mach-O x86_64 v25.6.1 x64; /usr/local/bin/node resolves the SAME
  version+arch (Cellar node 25.6.1_1) → §1a anchor / §1b reuse criteria aligned.
- 0b executor preflight: durable store loadable, 93 agents, zero overlapping ranges; live app
  mtime Sep 29 11:58 2026 (restored preimage); runtime pid 74673 (launched 2026-10-02 03:47:04).
- 0b-health: 8790 {"ok":true,"deliverReady":true,"authConfigured":false,"storeReady":true}.
- 0d lineage: canonical 0600 nlink1 inode 120507344 mtime 2026-10-01T17:43:34+0800 authsvc:authsvc,
  not a symlink, tombstone absent; file sha12 f38cd250576a (= recorded); nested expires
  1791711814562 = 2026-10-11T09:43:34Z (= recorded KNOWN_EXPIRY) → 9.52 days runway ⇒ RATIFY.
- 0c FRESH PREIMAGE RE-PIN: sudo rsync -a /usr/local/libexec/agent-core/
  /usr/local/libexec/agent-core.bak-20261001T211351Z-pre-b7-v2/ (RSYNC_EXIT=0, 23G);
  dry-run diff `rsync -ani --delete` live vs preimage = 0 lines (exact).
- 0e custody census (7556029d…): CANONICAL_VALID=YES fresh=true tombstone=false;
  CANONICAL_LINEAGE_REFRESH_SHA12=12616dbff17f; AUTHORITATIVE_LINEAGE_COUNT=1; 92 same-lineage
  copies 0 foreign; NO_DUPLICATE_CREDENTIAL_PATH=PASS; YANFENMA_LINEAGE_SEPARATE=YES;
  cross-surface hits = session transcripts only. Environment: pnpm store 1.9G intact; disk 50Gi;
  MAIN_REPO node_modules @larksuiteoapi+croner present.

## STAGE 1 — DEPLOY: ALL EXECUTOR GATES PASS (exit 0), then RESTART ADOPTION FAILED (NEW DEFECT)

- `sudo bash owner-router-closure-g2-g7-v22.sh deploy` (log /tmp/b7-v22-stage1-deploy.log):
  HEAD/tree gate PASS (b78aa30a/d5fb04c9) → §1 auto-preimage agent-core.bak-20261002-052840 →
  §1a anchor Cellar node v25.6.1 x64 → §1b node-runtime REUSED (same v25.6.1 x64; mv-ed OUT of
  the auto-preimage) → §2 harness closure FRESH offline build under the x64 anchor →
  **§2c CLOSURE_RESOLUTION_GATE PASS** (NATIVE_BINDING darwin-x64 from optional-package
  node-addon-require-builtin-darwin-x64 napi-v9; census loader 2 + apps/cli 71; RESOLVE
  @deepseek-ai/cordis-plugin-timer + cordis) → §3 app closure packed (TOCTOU match; packed tree
  sha256 9166b4979d3952d3…; Agent Definition PRESENT / agent-registry ABSENT; production-runtime
  closure PRESENT) → **§3b RUNTIME_APP_GRAPH_GATE PASS** (importSettled=true timedOut=false) →
  §4 preserved Agent Definition + credential store from the auto-preimage → §5 production root
  provisioning (v2.2 §5b FIX B verified live: plist-pinned watchdog private state kept at gid 20,
  EXCLUDED from the blanket pass) → §6 ownership 505/502 → spawn helper already root:wheel 4755 →
  §8 symlink audit PASS → §9 uid-502 spot checks all DENIED →
  **byte provenance echoes 1/4/1 hits = PASS** (DEPLOYED_SOURCE_SHA = b78aa30a fix bytes live) →
  **G2.5 FRESH_CHILD_BOOT_CANARY PASS (ready=true pluginTreeFailed=false)** →
  **G2.6 RUNTIME_APP_GRAPH_GATE PASS (importSettled=true timedOut=false)**. DEPLOY_RC=0.
  Runtime pid 74673 NEVER exited through the install; health continuous.
- **RESTART (G4) — ADOPTION FAIL-CLOSED, NEW DEFECT C**: `sudo launchctl kickstart -k
  system/ai.agent-core.runtime` at 05:31 +0800 → the new generation FATAL-crash-looped
  (launchd ThrottleInterval 10, spawn scheduled; 8790 down ~05:31–05:38):
  `FATAL Error: production-runtime: invalid agent model overrides:
  /Users/authsvc/.agent-core/agent-model-overrides.json must be {"version":3,...} (older files
  are not converted)` at model-overrides.js:411 (loadAgentModelOverrides ← compose.js:263 ←
  entry.js:71).
- **Bounded defect evidence (read-only, <1 min)**: production fleet config is `version:2`
  (92 overrides — the exact shape the carrier r12 G3 gate itself requires: "fleet config v2");
  the OLD live tree's model-overrides.js accepts version:2 (":315 must be {\"version\":2,...}");
  the NEW pin b78aa30a model-overrides.js:406 REQUIRES version===3 exactly (fail-loud, "older
  files are not converted"). The packet carries NO v2→v3 config migration stage, and its own
  STAGE 2 carrier still binds G3 to fleet config v2 — a structural contradiction inside the
  frozen packet: the pin's runtime contract and the production/carrier config contract diverged.
- **Coverage gap (same family as #191/#193, one layer deeper)**: §2c covers harness closure
  arch/resolution; §3b/G2.6 cover the app-graph IMPORT (throwaway home, no config compose);
  G2.5 covers the fresh-child plugin tree. NO gate composes the production runtime against the
  REAL production agent-model-overrides.json before restart. Each repair unmasked the next
  layer: #191 executor receipt → #193 pack closure → #195 config-version contract.
- Production config file NOT mutated by the run (mtime Oct 1 18:36:29 2026 unchanged).

## ROLLBACK / RESTORE PROOF (deterministic, per §6 incl. RESTORE-R1 + RESTORE-R2)

- Restore per the executor contract: `rm -rf /usr/local/libexec/agent-core && mv
  /usr/local/libexec/agent-core.bak-20261002-052840 /usr/local/libexec/agent-core`
  (the auto-preimage consumed as the restore source, per the frozen algorithm — same as v1).
- **RESTORE-R1 EXECUTED (mandatory: §1b reused node-runtime)**: the restored tree landed WITHOUT
  node-runtime exactly as the contract predicts; re-materialized content-exact via
  `rsync -a /usr/local/libexec/agent-core.bak-20261001T211351Z-pre-b7-v2/node-runtime/
  /usr/local/libexec/agent-core/node-runtime/`; sanity v25.6.1 x64.
- **RESTORE-R2 EXECUTED (idempotent; §5b ran)**: chgrp -R 20 on control/scheduler-watchdog +
  control/incident-backups — verified authsvc:staff(20) 0700 before and after (v2.2 §5b had
  already preserved the pin; R2 confirmed no drift).
- Restored proof (ALL PASS): content diff `rsync -ani --delete` live vs STAGE 0 fresh preimage
  = 2 lines, BOTH mtime-only (./ and .backup-meta) — CONTENT EXACT; health
  {"ok":true,"deliverReady":true} (runtime pid 27455 booted 05:37:58 on the restored tree);
  durable store loadable floor=3 zero overlap; lineage sha12 f38cd250576a unchanged; locks dir
  empty; boot-canary (G2.5 standalone) PASS on the restored root; zero oauth/refresh error
  strings in the current runtime log. Fleet downtime ≈ 7 min (05:31–05:38, single window).
- Backups preserved untouched: agent-core.bak-20261001-174434 (禁删), -20261001T144015Z,
  -20261001T175809Z, -20261001T211351Z (this run's fresh STAGE 0 preimage).

## VERDICT

```text
PRECHECK              = PASS (claim #195 = this session; #386 standing delegation fresh-read)
PACKET_GATES          = PASS (merge 431bcab8 on origin/main; MANIFEST 12/12; pin b78aa30a/d5fb04c9
                        clean; §4 digests exact; GOVERNING_SPECS_UNMODIFIED; installer/executor
                        selftests PASS; suites 0 fail)
STAGE_0               = ALL PASS (lock free; x64=x64; durable load 93 agents; lineage
                        12616dbff17f/f38cd250576a exact, expiry 2026-10-11 → RATIFY; fresh
                        preimage 211351Z diff=0; custody census all PASS/YES)
STAGE_1_INSTALLER     = ALL GATES PASS (§2c, §3b, §5b gid-20 pin, §8, §9, echoes 1/4/1)
STAGE_1_G2_5          = PASS (ready=true pluginTreeFailed=false)
STAGE_1_G2_6          = PASS (importSettled=true timedOut=false)
RESTART_ADOPTION      = FAIL-CLOSED — DEFECT C: pin runtime requires overrides version:3;
                        production fleet config is version:2 (92 overrides) and the packet's own
                        carrier G3 binds "fleet config v2"; no migration stage exists in the
                        packet; runtime FATAL crash-loop ~7 min; NOT environmental drift; NOT a
                        bad install; all pre-restart gates green by construction
ROLLBACK              = EXECUTED deterministically + RESTORE-R1 live + RESTORE-R2 idempotent;
                        restored content-exact (2 mtime-only lines); health/durable/lineage/
                        boot-canary verified; pid 27455 stable
STAGE_2_3_4           = NOT REACHED (fail-closed stop; carrier NOT invoked; credentials untouched)
FINAL_STATE           = production healthy on the restored preimage (pid 27455); #414 DONE_WHEN
                        NOT satisfied (INSTALLED/ENABLED/BUSINESS_VERIFIED unchanged)
NEEDS_USER            = bounded NON-PRODUCTION v2.3 repair lane: (1) reconcile the config-version
                        contract — EITHER a separately frozen v2→v3 fleet-config migration
                        operation for the authsvc deployment root (business config mutation with
                        its own freeze/review/rollback; carrier G3 language must move to v3 with
                        it) OR a source-pin reconciliation that keeps the deployed-contract
                        version — Owner decides the direction; (2) NEW pre-cutover gate G2.7:
                        run the installed runtime's loadAgentModelOverrides against the REAL
                        production config before any restart (the G2.6 gap class); then re-bind
                        packet, independent review, next standing-delegation run re-executes
                        STAGE 0→4. The Owner feishu PONG commit gate remains ahead at STAGE 2.
```
