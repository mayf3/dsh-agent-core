#!/bin/bash
# owner-router-closure-g2-g7.sh — B7 SHARED_CODEX_DEPLOYMENT_ROOT_REFREEZE_V2 (2026-10-02) — CLOSURE_RESOLUTION_GATE_V1 amendment
# Rebound copy of the v1 executor
# (source: docs/evidence/shared-codex-auth-deployment-root-refreeze-v1-20261001/owner-router-closure-g2-g7.sh).
# V2 rebindings vs that copy:
#   DEPLOY_SRC   = .worktrees/b7-v22-packet-repair-20261002 (clean checkout at the new pin b78aa30a)
#   EXPECTED_SHA = 8fc374ca8f97257b6947db291b82df5bb20acf67 (closure-runtime-arch repair source: installer §1a/§2 runtime-node
#                  closure build + §2c fail-closed closure-resolution gate; GOVERNING_SPECS_UNMODIFIED)
#   EXPECTED_TREE= f60cc9e81b28d685418497f3fc1f67fe945f8703
#   EVIDENCE     = this directory
#   NEW in V2  : after the installer exits 0, `deploy` runs FRESH_CHILD_BOOT_CANARY_V1
#                (scripts/lib/trusted-cp-fresh-child-boot-canary.mjs from DEPLOY_SRC) against the
#                installed tree — disposable fresh agent-core-production child boot in a throwaway
#                home, no credentials, fail-closed BEFORE any service restart/health handoff. This
#                is the gate missing on 2026-10-01 23:35, when a closure built by an arm64-host
#                pnpm shipped without the x64 native binding and every fresh child died at
#                plugin-tree boot (the installer's own §2c closure gate is the second, earlier net).
# V2.1 rebind (2026-10-02 repair lane after agent-control#191 fail-closed; packet-internal
# only — DEPLOY_SRC pin 8fc374ca/f60cc9e8, installer, and gate/canary bytes UNCHANGED):
#   FIX 1 (defect 1 of #191): post-deploy byte-provenance echo #3 greps
#          AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE in process-registry-route-gate.js (:52).
#          The stale inherited grep of process-registry.js (0 hits there at this pin AND at
#          every reference generation since the v1 pin) deterministically aborted every deploy
#          after the install and BEFORE this executor's own G2.5 fresh-child boot canary.
#   FIX 2 (defect 2 of #191): RESTORE-R1 — the restore contract re-materializes node-runtime
#          from the fresh STAGE 0 preimage whenever installer §1b reused it: §1b mv-s
#          node-runtime OUT of the §1 auto-preimage, so a restore from it can land WITHOUT
#          node-runtime once the rm -rf deletes the installed tree (the only other copy) —
#          reproduced 2026-10-02 (2418 deleting lines in the restore diff). Rollback semantics
#          otherwise unchanged (rm -rf live + mv newest bak back; no symlinks, no live
#          node_modules patches). New offline gate: --selftest-repair (hermetic /tmp fixtures,
#          no sudo, no production access).
# V2.2 rebind (2026-10-02 repair lane after agent-control#193 fail-closed at
# adoption; source pin MOVES to b78aa30a/d5fb04c9 — this is the first v2 repair
# that changes shipped source/pack closure, so per the packet's own R4 it is a
# NEW freeze):
#   FIX A (Defect A, #193): fresh pack lacked transitive dep proxy-agent-negotiate
#          (@larksuite/channel/node_modules/https-proxy-agent imports it; no pack
#          input carries it) → production-runtime FATAL at first boot while G2.5
#          passed — the canary covers the plugin tree, not the runtime app graph.
#          Repairs (in DEPLOY_SRC at the new pin): vendored proxy-agent-negotiate
#          carried by installer §3 + NEW §3b RUNTIME_APP_GRAPH_GATE_V1 (installer
#          side, pre-§5b) + THIS executor's G2.6 run of the same gate against the
#          installed tree, both fail-closed before any restart.
#   FIX A′ (same class, proven live by the new gate in the v2.2 lane):
#          packages/development-execution (no package.json, RELATIVE import from
#          production-runtime) was never packed — installer §3 now carries it.
#   FIX B (Defect B, #193 restore-completion): installer §5b no longer blanket-
#          chowns the plist-pinned watchdog private state (control/scheduler-
#          watchdog + control/incident-backups, SCHEDULER_INCIDENT_OWNER_GID=20);
#          RESTORE-R2 below re-pins the set after any restore.
#   RESTORE-R2 (v2.2, mandatory whenever the failed deploy's installer reached §5b):
#   §5b must never touch the plist-pinned watchdog private state (v2.2 installer),
#   but any rollback from a PRE-v2.2 installed generation — or any v2.1-era §5b
#   run — can leave group 601 on it (#193: the restored tree failed its own
#   scheduler startup readiness gate `unsafe incident state file`, 8790 down
#   ~03:41–03:47 until the group was re-pinned). After the restore mv (+ RESTORE-R1),
#   re-pin deterministically (root; idempotent no-op when already correct):
#     for p in /Users/authsvc/.agent-core/control/scheduler-watchdog \
#              /Users/authsvc/.agent-core/control/incident-backups; do
#       [ -d "$p" ] && chgrp -R 20 "$p"
#     done
#   Never a symlink, never a live node_modules patch; the app tree restore
#   algorithm itself is unchanged.
# The installer itself (binding-time trusted-cp-deploy-install.sh inside DEPLOY_SRC) carries
# the section-0b PRE-MUTATION cross-surface gate: a contamination failure now fires before
# the backup mv, and every late failure reports mutation truth + exact restore (the 2026-10-01
# "NOTHING was deployed" false claim is fixed in both copies).
# Owner-sudo execution script for Phase G2–G7. READ/WRITE SCOPE:
#   - deploy  : runs the EXISTING trusted production deployment control plane (mutex,
#               provenance, preimage/rollback contract) — no hand-edits, no file copies.
#   - others  : strictly read-only against the durable store; verdicts + snapshots are
#               written ONLY to this goal's evidence directory.
# It never touches durable store content, Codex credentials, or any credential surface.
#
# Usage (Owner, with sudo):
#   sudo bash owner-router-closure-g2-g7.sh preflight
#   sudo bash owner-router-closure-g2-g7.sh deploy
#   sudo bash owner-router-closure-g2-g7.sh health
#   sudo bash owner-router-closure-g2-g7.sh snapshot <agentId> <label>
#   sudo bash owner-router-closure-g2-g7.sh verify-restart <agentId> <beforeLabel> <afterLabel>
#   sudo bash owner-router-closure-g2-g7.sh close
# Offline selftest (no sudo, no mutation):
#   bash owner-router-closure-g2-g7.sh --selftest
#     (reads the LIVE trusted app's durable-file module via store_state_json —
#      read-only, inherited verbatim from the v2.1 executor; fails on a host
#      without the live tree)
#   bash owner-router-closure-g2-g7.sh --selftest-repair   (v2.1+#191 defect repairs
#      and v2.2 G2.6/RESTORE-R2 proofs — fully hermetic: /tmp fixtures + $DEPLOY_SRC only)

set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

REPO=/Users/yanfenma/workspace/project/dsh-agent-core
DEPLOY_SRC=$REPO/.worktrees/b7-v22-packet-repair-20261002
# G2 纪律：必须执行 2097e4f 检出内的（reviewed、带 P1-P6 provenance 门的）安装器——
# 主 worktree（goal 分支旧 base）上的同名文件是无 provenance 的旧版，禁止使用。
DEPLOYER=$DEPLOY_SRC/scripts/trusted-cp-deploy-install.sh
HARNESS_SRC=/Users/yanfenma/workspace/github/deepseek-harness
EVIDENCE=$REPO/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002
TRUSTED_APP=/usr/local/libexec/agent-core/app
DURABLE_MODULE=$TRUSTED_APP/packages/agent-router/src/reconciliation/durable-file.js
STORE=/Users/authsvc/.agent-core/control/turn-recovery-v3.json
EXPECTED_SHA=b78aa30a48e00efda710b255a91e94bebdb7cec0
EXPECTED_TREE=d5fb04c96de5ea7befe130e59590db29236b71ed
STAMP=$(date '+%Y%m%dT%H%M%S')

die() { echo "FAIL: $*" >&2; exit 1; }

store_state_json() { # $1 = store file, $2 = agentId — prints {floor, live:[{gen,minSeq,maxSeq}], evicted:[[gen,maxSeq]], watermark, records} for the agent
  node --input-type=module -e '
    const { readDurableRecoveryStore } = await import(process.argv[1]);
    let store = null;
    try { store = readDurableRecoveryStore(process.argv[2]); } catch (e) {
      console.log(JSON.stringify({ loadable: false, error: String(e.message) })); process.exit(0);
    }
    if (store === null) { console.log(JSON.stringify({ loadable: true, empty: true })); process.exit(0); }
    const entry = store.issuance.get(process.argv[3]);
    if (entry === undefined) { console.log(JSON.stringify({ loadable: true, absent: true })); process.exit(0); }
    const live = [...entry.generations.entries()].map(([gen, r]) => ({ gen, minSeq: r.minSeq, maxSeq: r.maxSeq })).sort((a, b) => a.gen - b.gen);
    const evicted = [...entry.evictedGenerations.entries()].map(([gen, maxSeq]) => ({ gen, maxSeq })).sort((a, b) => a.gen - b.gen);
    const floor = Math.max(live.at(-1)?.gen ?? 0, evicted.at(-1)?.gen ?? 0, entry.evictedThroughGeneration ?? 0);
    const overlap = live.some((r, i) => i > 0 && r.minSeq <= live[i - 1].maxSeq);
    console.log(JSON.stringify({ loadable: true, floor, evictedThroughGeneration: entry.evictedThroughGeneration, maxIssuedTurnSeq: entry.maxIssuedTurnSeq, live, evicted, overlappingLiveRanges: overlap }));
  ' "$DURABLE_MODULE" "$1" "$2"
}

# Byte-provenance echoes (v2.1): parameterized by app root so --selftest-repair can exercise
# the exact deploy-time check against a hermetic fixture tree.
byte_provenance_verdict() { # $1 = app root; prints the three DEPLOYED_BYTES lines; rc=0 iff all carry the reviewed fix
  local APP="$1" HITS_STORE HITS_GATE HITS_REG
  HITS_STORE=$(grep -c "highestIssuedGeneration" "$APP/packages/agent-router/src/reconciliation/store.js" 2>/dev/null); HITS_STORE=${HITS_STORE:-0}
  HITS_GATE=$(grep -c "generationFloor" "$APP/packages/agent-router/src/process-registry-route-gate.js" 2>/dev/null); HITS_GATE=${HITS_GATE:-0}
  # v2.1 FIX 1: AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE lives ONLY in
  # process-registry-route-gate.js (:52) — at pin 8fc374ca AND at every reference generation
  # since the v1 pin (47aadec1/360756e3/d8ddf546). The stale v1-inherited echo grepped
  # process-registry.js (0 hits) and deterministically aborted every deploy post-install,
  # pre-G2.5 (agent-control#191, 2026-10-02).
  HITS_REG=$(grep -c "AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE" "$APP/packages/agent-router/src/process-registry-route-gate.js" 2>/dev/null); HITS_REG=${HITS_REG:-0}
  echo "DEPLOYED_BYTES store.highestIssuedGeneration hits=$HITS_STORE (expect >=1)"
  echo "DEPLOYED_BYTES route-gate generationFloor hits=$HITS_GATE (expect >=1)"
  echo "DEPLOYED_BYTES route-gate AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE hits=$HITS_REG (expect >=1)"
  [ "$HITS_STORE" -ge 1 ] && [ "$HITS_GATE" -ge 1 ] && [ "$HITS_REG" -ge 1 ]
}

case "${1:-}" in
  --selftest)
    T=$(mktemp -d /tmp/router-closure-selftest.XXXXXX) || exit 1
    chmod 700 "$T"
    F="$T/store.json"
    node --input-type=module -e '
      const { TurnReconciliationStore } = await import(process.argv[2] + "/packages/agent-router/src/reconciliation/store.js");
      const s = new TurnReconciliationStore({ persistenceFile: process.argv[1], runtimeEpoch: "selftest" });
      s.mintTurnExecution({ agentId: "agt_selftest", processGeneration: 1, sessionId: null });
      s.mintTurnExecution({ agentId: "agt_selftest", processGeneration: 2, sessionId: null });
    ' "$F" "$DEPLOY_SRC" || { echo "SELFTEST_FAIL (seed)"; rm -rf "$T"; exit 1; }
    OUT=$(store_state_json "$F" agt_selftest)
    NODE_OUT=$(node --input-type=module -e '
      const { readFileSync } = await import("node:fs");
      const s = JSON.parse(readFileSync("/dev/stdin", "utf8"));
      console.log(JSON.stringify({ floor: s.floor, overlap: s.overlappingLiveRanges }));
    ' <<< "$OUT")
    echo "$OUT" | grep -q '"floor":2' && echo "$NODE_OUT" | grep -q '"overlap":false' \
      && echo "SELFTEST_PASS (store_state_json floor=2, no overlap on a seeded 2-generation store)" \
      || { echo "SELFTEST_FAIL: $OUT"; rm -rf "$T"; exit 1; }
    rm -rf "$T" ;;
  preflight) # ---- G1 completion: store load + per-agent floor census + rollback label ----
    echo "### G1 preflight completion ($(date '+%F %T %z'))"
    echo "G1_5_STORE_LOAD + G1_FLOOR_CENSUS:"
    store_state_json "$STORE" "agt_cto-agent"
    echo "  (top floors across all agents — collision baselines)"
    node --input-type=module -e '
      const { readDurableRecoveryStore } = await import(process.argv[1]);
      const store = readDurableRecoveryStore(process.argv[2]);
      if (store === null) { console.log("  EMPTY_STORE"); process.exit(0); }
      const rows = [];
      for (const [agentId, e] of store.issuance) {
        const live = [...e.generations.keys()], ev = [...e.evictedGenerations.keys()];
        rows.push({ agentId, floor: Math.max(live.at(-1) ?? 0, ev.at(-1) ?? 0, e.evictedThroughGeneration ?? 0), live: live.length, evicted: ev.length });
      }
      rows.sort((a, b) => b.floor - a.floor);
      for (const r of rows.slice(0, 12)) console.log(`  ${r.agentId} floor=${r.floor} liveBuckets=${r.live} evictedBuckets=${r.evicted}`);
      console.log(`  agents_total=${rows.length}`);
    ' "$DURABLE_MODULE" "$STORE"
    echo "G1_4_ROLLBACK_LABEL (current live generation label, for rollback reference):"
    grep -rl "$EXPECTED_SHA" "$TRUSTED_APP" 2>/dev/null | head -2
    find /usr/local/libexec/agent-core -maxdepth 2 -name '*generation*' -o -maxdepth 2 -name '*.label' 2>/dev/null | head -5
    stat -f '  live app mtime: %Sm' "$TRUSTED_APP/packages/agent-router/src/process-registry-route-gate.js"
    echo "PREFLIGHT_DONE"
    ;;
  deploy) # ---- G2: the EXISTING controlled production deployment path, exact SHA ----
    [ "$(id -u)" = "0" ] || die "deploy must run as root"
    [ -f "$DEPLOYER" ] || die "deployer missing at $DEPLOYER"
    [ -d "$DEPLOY_SRC/.git" ] || [ -d "$DEPLOY_SRC/packages" ] || die "deploy source checkout missing"
    ACTUAL_TREE=$(git -C "$DEPLOY_SRC" rev-parse HEAD^{tree})
    ACTUAL_HEAD=$(git -C "$DEPLOY_SRC" rev-parse HEAD)
    [ "$ACTUAL_HEAD" = "$EXPECTED_SHA" ] || die "deploy checkout HEAD $ACTUAL_HEAD != $EXPECTED_SHA"
    [ "$ACTUAL_TREE" = "$EXPECTED_TREE" ] || die "deploy checkout tree mismatch"
    echo "### G2 deploy of $EXPECTED_SHA (tree $ACTUAL_TREE) via trusted control plane"
    # The installer is fail-closed (mutex/provenance gates). A non-zero exit is
    # fail-closed, but it does NOT imply an untouched tree: since 2026-10-01 the
    # installer runs its cross-surface contamination scan PRE-mutation (section
    # 0b, before the backup mv), yet any LATER failure (pack/node/hardening/
    # late-gate drift) can leave a half-built closure while the previous install
    # sits in the newest agent-core.bak-*. NEVER claim "NOTHING was deployed" —
    # verify the mutation truth and restore exactly:
    #   rm -rf /usr/local/libexec/agent-core && mv <newest agent-core.bak-*> /usr/local/libexec/agent-core
    #   RESTORE-R1 (v2.1, mandatory whenever the failed deploy's installer §1b REUSED
    #   node-runtime): §1b mv-ed node-runtime OUT of the §1 auto-preimage (the newest bak-*),
    #   so the restored tree can land WITHOUT node-runtime once the rm -rf deletes the
    #   installed tree — reproduced 2026-10-02 (2418 deleting lines in the restore diff).
    #   Detect and repair from the fresh STAGE 0 preimage (rsync -a COPY — never a symlink,
    #   never a live node_modules patch):
    #     [ -x /usr/local/libexec/agent-core/node-runtime/bin/node ] || \
    #       rsync -a /usr/local/libexec/agent-core.bak-<STAGE0-UTC-ts>-pre-b7-v2/node-runtime/ \
    #             /usr/local/libexec/agent-core/node-runtime/
    #   Then re-verify vs the STAGE 0 preimage: rsync -ani --delete → mtime-only lines at most.
    #   RESTORE-R2 (v2.2, mandatory whenever the failed deploy's installer reached §5b):
    #   for p in /Users/authsvc/.agent-core/control/scheduler-watchdog \
    #            /Users/authsvc/.agent-core/control/incident-backups; do
    #     [ -d "$p" ] && chgrp -R 20 "$p"
    #   done
    #   (plist-pinned SCHEDULER_INCIDENT_OWNER_GID=20; #193 live proof — the
    #   restored tree failed its own boot gate until this was done at 03:46.)
    # If the mutex was held: dispose per the documented procedure
    # (see dispose-stale-deploy-lock.sh), never bare-rmdir, never retry-past-a-held-lock.
    if ! EXPECTED_SOURCE_SHA="$EXPECTED_SHA" \
    EXPECTED_SOURCE_TREE="$EXPECTED_TREE" \
    GENERATION_LABEL_SHA="$EXPECTED_SHA" \
      bash "$DEPLOYER" "$DEPLOY_SRC" "$HARNESS_SRC" "$REPO"; then
      die "installer exited non-zero (fail-closed). The trusted app tree MAY already be mutated by this run — check the newest agent-core.bak-* preimage and restore exactly (rm -rf live + mv BAK back; then RESTORE-R1: if §1b reused node-runtime, re-materialize node-runtime from the fresh STAGE 0 preimage — see the RESTORE-R1 block above; then RESTORE-R2: for p in /Users/authsvc/.agent-core/control/scheduler-watchdog /Users/authsvc/.agent-core/control/incident-backups; do [ -d \"\$p\" ] && chgrp -R 20 \"\$p\"; done — skip if §5b never ran) before any retry. If the mutex was held: dispose per the documented procedure (see dispose-stale-deploy-lock.sh), never bare-rmdir, never retry-past-a-held-lock."
    fi
    echo "### G2 post-deploy byte provenance"
    if byte_provenance_verdict "$TRUSTED_APP"; then
      echo "DEPLOYED_SOURCE_SHA = $EXPECTED_SHA (fix bytes live)"
    else
      die "deployed bytes do not contain the reviewed fix"
    fi
    # ---- G2.5 (V2): FRESH_CHILD_BOOT_CANARY_V1 — fail-closed BEFORE any ----
    # service restart / health handoff. This is the gate that was missing on
    # 2026-10-01 23:35. Disposable home, no credentials, no production state;
    # the installed tree is probed exactly as a freshly spawned
    # agent-core-production child would resolve it.
    TRUSTED_ROOT=$(dirname "$TRUSTED_APP")
    echo "### G2.5 fresh-child boot canary against $TRUSTED_ROOT"
    if ! "$TRUSTED_ROOT/node-runtime/bin/node" \
        "$DEPLOY_SRC/scripts/lib/trusted-cp-fresh-child-boot-canary.mjs" \
        --trusted-root "$TRUSTED_ROOT" --timeout-ms 120000; then
      die "fresh-child boot canary FAILED — the installed closure cannot serve agent-core-production children (2026-10-02 rollback class). Do NOT restart or adopt this generation. Restore exactly: rm -rf /usr/local/libexec/agent-core && mv \"\$(ls -d /usr/local/libexec/agent-core.bak-* | sort | tail -1)\" /usr/local/libexec/agent-core (record the restore reason; then RESTORE-R1: if §1b reused node-runtime, the auto-preimage lacks it — re-materialize node-runtime from the fresh STAGE 0 preimage, see the RESTORE-R1 block above; then RESTORE-R2: for p in /Users/authsvc/.agent-core/control/scheduler-watchdog /Users/authsvc/.agent-core/control/incident-backups; do [ -d \"\$p\" ] && chgrp -R 20 \"\$p\"; done — §5b ran, the pin is mandatory). The running runtime never left the old generation, so no service impact has occurred."
    fi
    echo "FRESH_CHILD_BOOT_CANARY = PASS (installed tree serves fresh agent-core-production children)"
    # ---- G2.6 (V2.2): RUNTIME_APP_GRAPH_GATE_V1 — the coverage gap #193 ----
    # proved fatal: G2.5 boots the harness plugin tree, but the production
    # runtime's own app import graph is a different resolution surface. This
    # gate imports the WHOLE graph (entry.js -> compose.js -> feishu-connector/
    # @larksuite/channel/https-proxy-agent/proxy-agent-negotiate, broker,
    # scheduler, product-api, ...) under the installed node-runtime, throwaway
    # home, no services started — fail-closed BEFORE any restart/health handoff.
    echo "### G2.6 production-runtime app-graph import gate against $TRUSTED_ROOT"
    if ! "$TRUSTED_ROOT/node-runtime/bin/node" \
        "$DEPLOY_SRC/scripts/lib/trusted-cp-runtime-app-graph-gate.mjs" \
        --app-dir "$TRUSTED_APP" --node "$TRUSTED_ROOT/node-runtime/bin/node" --timeout-ms 120000; then
      die "runtime app-graph import gate FAILED — the installed closure cannot boot the production runtime (agent-control#193 Defect A class: a pack input never carried a resolution surface the graph imports). Do NOT restart or adopt this generation. Restore exactly: rm -rf /usr/local/libexec/agent-core && mv \"\$(ls -d /usr/local/libexec/agent-core.bak-* | sort | tail -1)\" /usr/local/libexec/agent-core (record the restore reason; then RESTORE-R1 and RESTORE-R2 as in the blocks above — §5b ran, the pin is mandatory). The running runtime never left the old generation, so no service impact has occurred."
    fi
    echo "RUNTIME_APP_GRAPH_GATE = PASS (installed app closure imports the full production-runtime graph)"
    ;;
  health) # ---- G3: first post-deploy health ----
    echo "### G3 post-deploy health ($(date '+%F %T %z'))"
    curl -s -m 3 http://127.0.0.1:8790/health | grep -q '"deliverReady":true' && echo "G3_INGRESS = PASS" || echo "G3_INGRESS = FAIL"
    ps axww -o pid,user,lstart,command | grep -E 'production-runtime\.mjs --root /Users/authsvc' | grep -v grep | sed 's/^/  runtime: /'
    node --input-type=module -e '
      const { readDurableRecoveryStore } = await import(process.argv[1]);
      try {
        const s = readDurableRecoveryStore(process.argv[2]);
        console.log("G3_DURABLE_LOAD = PASS"); process.exit(0);
      } catch (e) { console.log("G3_DURABLE_LOAD = FAIL " + e.message); process.exit(1); }
    ' "$DURABLE_MODULE" "$STORE" || true
    # no startupBlockedReason is observable as admission readiness: ingress deliverReady=true
    # composes store load + admission; overlapping ranges would have failed the load above.
    ;;
  snapshot) # ---- G4/G5 evidence: durable issuance state for one agent ----
    AGENT="${2:?agentId required}"; LABEL="${3:?label required}"
    [ -f "$STORE" ] || die "store missing"
    mkdir -p "$EVIDENCE"
    OUT="$EVIDENCE/gen-snapshot-$AGENT-$LABEL-$STAMP.json"
    PID=$(ps axww -o pid,user,lstart,command | grep -E 'production-runtime\.mjs --root /Users/authsvc' | grep -v grep | awk '{print $1}' | head -1)
    { echo "{ \"agentId\": \"$AGENT\", \"label\": \"$LABEL\", \"at\": \"$(date '+%F %T %z')\", \"runtimePid\": \"$PID\","; echo "  \"store\": $(store_state_json "$STORE" "$AGENT")"; echo "}"; } > "$OUT"
    chmod 644 "$OUT" 2>/dev/null || true
    cat "$OUT"
    echo "SNAPSHOT_WRITTEN $OUT"
    ;;
  verify-restart) # ---- G4/G5 verdict: after-state must be strictly above the before floor ----
    AGENT="${2:?agentId required}"; BEFORE="${3:?before snapshot json required}"; AFTER="${4:?after snapshot json required}"
    node --input-type=module -e '
      const { readFileSync } = await import("node:fs");
      const before = JSON.parse(readFileSync(process.argv[2], "utf8")).store;
      const after = JSON.parse(readFileSync(process.argv[3], "utf8")).store;
      if (!before.loadable || !after.loadable) { console.log("G_GATE = FAIL (store not loadable)"); process.exit(1); }
      const floorBefore = before.floor ?? 0;
      const floorAfter = after.floor ?? 0;
      console.log(`GENERATION_BEFORE_RESTART = ${floorBefore}`);
      console.log(`GENERATION_AFTER_RESTART  = ${floorAfter}`);
      let ok = true;
      if (!(floorAfter > floorBefore)) { console.log("G_MONOTONIC = FAIL (after <= before)"); ok = false; }
      else console.log("G_MONOTONIC = PASS (strictly above the pre-restart collision floor)");
      if (after.overlappingLiveRanges) { console.log("G_OVERLAP = FAIL"); ok = false; } else console.log("G_OVERLAP = NONE");
      const beforeRecords = before.maxIssuedTurnSeq ?? 0, afterRecords = after.maxIssuedTurnSeq ?? 0;
      if (afterRecords < beforeRecords) { console.log("G_STORE_WIPED = FAIL (maxIssuedTurnSeq went backwards — destructive rewrite)"); ok = false; }
      else console.log(`G_STORE_RETAINED = PASS (maxIssuedTurnSeq ${beforeRecords} -> ${afterRecords})`);
      console.log(ok ? "RESTART_ACCEPTANCE = PASS" : "RESTART_ACCEPTANCE = FAIL");
      process.exit(ok ? 0 : 1);
    ' "$BEFORE" "$AFTER"
    ;;
  close) # ---- G7: gather every closure gate into one verdict ----
    echo "### G7 closure verdict ($(date '+%F %T %z'))"
    HITS=$(grep -c "highestIssuedGeneration" "$TRUSTED_APP/packages/agent-router/src/reconciliation/store.js" 2>/dev/null || echo 0)
    [ "$HITS" -ge 1 ] && echo "DEPLOYED_BYTES_MATCH_REVIEWED_SOURCE = YES" || echo "DEPLOYED_BYTES_MATCH_REVIEWED_SOURCE = NO"
    curl -s -m 3 http://127.0.0.1:8790/health | grep -q '"deliverReady":true' && echo "PRODUCTION_HEALTH = PASS" || echo "PRODUCTION_HEALTH = FAIL"
    node --input-type=module -e '
      const { readDurableRecoveryStore } = await import(process.argv[1]);
      try { readDurableRecoveryStore(process.argv[2]); console.log("DURABLE_STORE_LOAD = PASS"); }
      catch (e) { console.log("DURABLE_STORE_LOAD = FAIL " + e.message); process.exit(1); }
    ' "$DURABLE_MODULE" "$STORE" || true
    echo "FIRST_RESTART_ACCEPTANCE / SECOND_RESTART_ACCEPTANCE / GENERATION_REUSE / REAL_AGENT_TURN:"
    echo "  = read from the verify-restart verdicts + feishu turn receipts recorded in this evidence dir"
    echo "G7_CLOSE_HINT = all PASS rows above + two PASSING verify-restart verdicts => ROUTER_RESTART_SAFETY = PROVEN"
    ;;
  boot-canary) # ---- V2: run FRESH_CHILD_BOOT_CANARY_V1 standalone (no root needed; disposable) ----
    TRUSTED_ROOT=$(dirname "$TRUSTED_APP")
    exec "$TRUSTED_ROOT/node-runtime/bin/node" \
      "$DEPLOY_SRC/scripts/lib/trusted-cp-fresh-child-boot-canary.mjs" \
      --trusted-root "$TRUSTED_ROOT" --timeout-ms 120000 ;;
  --selftest-repair) # ---- V2.1: hermetic offline proof of both #191 packet-defect repairs ----
    # No sudo, no production access: /tmp fixtures only. Proves (1) the v2.1 echo set passes
    # on a tree that mirrors the pin layout while the stale v2 expression still fails on it,
    # and (2) RESTORE-R1 heals the §1b node-runtime-reuse restore case content-exactly.
    T=$(mktemp -d /tmp/router-repair-selftest.XXXXXX) || exit 1
    chmod 700 "$T"
    SRC=$T/app/packages/agent-router/src
    mkdir -p "$SRC/reconciliation"
    printf 'module.exports.highestIssuedGeneration = 1\n' > "$SRC/reconciliation/store.js"
    printf "const FLOOR_UNAVAILABLE = 'AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE'\nexport function generationFloor() { return null }\n" > "$SRC/process-registry-route-gate.js"
    printf '// process-registry.js never carried the generation floor-unavailable code\n' > "$SRC/process-registry.js"
    FAIL=0
    if byte_provenance_verdict "$T/app" > "$T/echo-green.txt" 2>&1 \
      && grep -q "AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE hits=[1-9]" "$T/echo-green.txt"; then
      echo "SELFTEST_REPAIR echo#3 GREEN: verdict PASS on the fixture (route-gate carries the constant)"
    else
      echo "SELFTEST_REPAIR_FAIL echo#3 GREEN"; cat "$T/echo-green.txt" 2>/dev/null; FAIL=1
    fi
    RED_HITS=$(grep -c "AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE" "$SRC/process-registry.js" 2>/dev/null); RED_HITS=${RED_HITS:-0}
    if [ "$RED_HITS" -eq 0 ]; then
      echo "SELFTEST_REPAIR echo#3 RED reproduced: stale process-registry.js grep = 0 hits on the same fixture (the v2 executor died exactly here)"
    else
      echo "SELFTEST_REPAIR_FAIL echo#3 RED (unexpected hits=$RED_HITS)"; FAIL=1
    fi
    for LEG in red green; do
      rm -rf "$T/stage0" "$T/auto" "$T/install" "$T/live"
      cp -R "$T/app" "$T/stage0"
      mkdir -p "$T/stage0/node-runtime/bin"
      printf '#!/bin/node\n' > "$T/stage0/node-runtime/bin/node"; chmod 755 "$T/stage0/node-runtime/bin/node"
      cp -R "$T/stage0" "$T/auto"
      cp -R "$T/stage0" "$T/install"   # the failed install holds the §1b-reused node-runtime
      rm -rf "$T/auto/node-runtime"    # §1b reuse mv-ed node-runtime OUT of the §1 auto-preimage
      rm -rf "$T/live"; mv "$T/auto" "$T/live"   # deterministic restore (executor contract)
      if [ "$LEG" = red ]; then
        if [ ! -x "$T/live/node-runtime/bin/node" ]; then
          echo "SELFTEST_REPAIR restore RED reproduced: §1b-reuse restore lands WITHOUT node-runtime (a cold boot in that window would fail launchd)"
        else
          echo "SELFTEST_REPAIR_FAIL restore RED"; FAIL=1
        fi
      else
        [ -x "$T/live/node-runtime/bin/node" ] || rsync -a "$T/stage0/node-runtime/" "$T/live/node-runtime/"
        if [ -x "$T/live/node-runtime/bin/node" ] && diff -r "$T/stage0" "$T/live" > /dev/null 2>&1; then
          echo "SELFTEST_REPAIR restore GREEN: RESTORE-R1 re-materialization from the fresh STAGE 0 preimage = content-exact"
        else
          echo "SELFTEST_REPAIR_FAIL restore GREEN"; FAIL=1
        fi
      fi
    done
    # ---- V2.2: G2.6 wiring — RUNTIME_APP_GRAPH_GATE_V1 fails closed and passes ----
    GATE_LIB="$DEPLOY_SRC/scripts/lib/trusted-cp-runtime-app-graph-gate.mjs"
    if [ -f "$GATE_LIB" ]; then
      STUB="$T/stub-app/packages/production-runtime/src"
      mkdir -p "$STUB" "$T/stub-app/node_modules/proxy-agent-negotiate"
      printf "import 'proxy-agent-negotiate'\nexport {}\n" > "$STUB/entry.js"
      printf '{"name":"proxy-agent-negotiate","version":"1.1.0","type":"module","main":"index.js"}\n' > "$T/stub-app/node_modules/proxy-agent-negotiate/package.json"
      printf 'export const negotiate = () => true\n' > "$T/stub-app/node_modules/proxy-agent-negotiate/index.js"
      if node "$GATE_LIB" --app-dir "$T/stub-app" --timeout-ms 30000 >/dev/null 2>&1; then
        echo "SELFTEST_REPAIR G2.6 GREEN: gate PASSES when the graph's dep is present"
      else
        echo "SELFTEST_REPAIR_FAIL G2.6 GREEN"; FAIL=1
      fi
      rm -rf "$T/stub-app/node_modules/proxy-agent-negotiate"
      if node "$GATE_LIB" --app-dir "$T/stub-app" --timeout-ms 30000 >/dev/null 2>&1; then
        echo "SELFTEST_REPAIR_FAIL G2.6 RED (gate passed with the dep missing — must fail closed)"; FAIL=1
      else
        echo "SELFTEST_REPAIR G2.6 RED: gate FAILS CLOSED with the dep missing (the #193 class)"
      fi
    else
      echo "SELFTEST_REPAIR_FAIL G2.6 wiring (gate lib missing at $GATE_LIB)"; FAIL=1
    fi
    # ---- V2.2: RESTORE-R2 — the real validator rejects a foreign group and the pin heals it ----
    PSIO="$DEPLOY_SRC/packages/scheduler/src/watchdog/private-state-io.js"
    R2ROOT="$T/prod-root/control"
    mkdir -p "$R2ROOT/scheduler-watchdog" "$R2ROOT/incident-backups"
    printf '{}\n' > "$R2ROOT/scheduler-watchdog/incidents.json"; chmod 700 "$R2ROOT/scheduler-watchdog"; chmod 600 "$R2ROOT/scheduler-watchdog/incidents.json"
    DAMAGE_GID="$(id -G | tr ' ' '\n' | awk '$1!=20{print $1; exit}')"
    validate_incident() {
      node --input-type=module -e '
        const { readPrivateFile } = await import(process.argv[1])
        try { readPrivateFile(process.argv[2], { expectedGid: 20 }); console.log("VALIDATOR_ACCEPT") }
        catch (e) { console.log("VALIDATOR_REJECT") }
      ' "$PSIO" "$1"
    }
    if [ -n "$DAMAGE_GID" ] && chgrp -R "$DAMAGE_GID" "$R2ROOT/scheduler-watchdog" 2>/dev/null; then
      [ "$(validate_incident "$R2ROOT/scheduler-watchdog/incidents.json")" = "VALIDATOR_REJECT" ] \
        && echo "SELFTEST_REPAIR R2 RED reproduced: foreign group $DAMAGE_GID on the pinned state → real readPrivateFile rejects (unsafe incident state file)" \
        || { echo "SELFTEST_REPAIR_FAIL R2 RED"; FAIL=1; }
      for p in "$R2ROOT/scheduler-watchdog" "$R2ROOT/incident-backups"; do [ -d "$p" ] && chgrp -R 20 "$p"; done
      [ "$(validate_incident "$R2ROOT/scheduler-watchdog/incidents.json")" = "VALIDATOR_ACCEPT" ] \
        && echo "SELFTEST_REPAIR R2 GREEN: RESTORE-R2 pin (chgrp -R 20) heals — the exact #193 restore completion" \
        || { echo "SELFTEST_REPAIR_FAIL R2 GREEN"; FAIL=1; }
    else
      echo "SELFTEST_REPAIR R2 skipped (no damage gid available for the invoking user — pin semantics covered by the unit suite)"
    fi
    PKG_FILE="$(cd "$(dirname "$0")" && pwd)/OPERATION_PACKAGE_V2.md"
    [ -f "$PKG_FILE" ] || PKG_FILE="$(cd "$(dirname "$0")/.." && pwd)/OPERATION_PACKAGE_V2.md"
    if grep -q "RESTORE-R1" "$0" && grep -q "re-materialize" "$0" \
      && [ -f "$PKG_FILE" ] && grep -q "RESTORE-R1" "$PKG_FILE" && grep -q "re-materialize" "$PKG_FILE"; then
      echo "SELFTEST_REPAIR contract markers present: executor restore contract + packet §6 runbook"
    else
      echo "SELFTEST_REPAIR_FAIL contract markers (executor and packet §6 must both carry RESTORE-R1)"; FAIL=1
    fi
    if grep -q "RESTORE-R2" "$0" && grep -q "G2.6" "$0" \
      && [ -f "$PKG_FILE" ] && grep -q "RESTORE-R2" "$PKG_FILE"; then
      echo "SELFTEST_REPAIR v2.2 contract markers present: executor G2.6 + RESTORE-R2 (both files)"
    else
      echo "SELFTEST_REPAIR_FAIL v2.2 contract markers (executor G2.6/RESTORE-R2 + packet §6 RESTORE-R2)"; FAIL=1
    fi
    rm -rf "$T"
    [ "$FAIL" -eq 0 ] && echo "SELFTEST_REPAIR_PASS (echo#3 route-gate verdict + RESTORE-R1 re-materialization + G2.6 app-graph wiring + RESTORE-R2 pin heal, hermetic)" \
      || { echo "SELFTEST_REPAIR_FAIL"; exit 1; } ;;
  *) die "unknown subcommand (use preflight|deploy|boot-canary|health|snapshot|verify-restart|close|--selftest|--selftest-repair)" ;;
esac
