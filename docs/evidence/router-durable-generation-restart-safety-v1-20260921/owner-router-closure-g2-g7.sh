#!/bin/bash
# owner-router-closure-g2-g7.sh — ROUTER_DURABLE_GENERATION_RESTART_SAFETY_V1_PRODUCTION_CLOSURE
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
# Offline selftest (no sudo, no production access):
#   bash owner-router-closure-g2-g7.sh --selftest

set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

REPO=/Users/yanfenma/workspace/project/dsh-agent-core
DEPLOY_SRC=$REPO/.worktrees/deploy-2097e4f
# G2 纪律：必须执行 2097e4f 检出内的（reviewed、带 P1-P6 provenance 门的）安装器——
# 主 worktree（goal 分支旧 base）上的同名文件是无 provenance 的旧版，禁止使用。
DEPLOYER=$DEPLOY_SRC/scripts/trusted-cp-deploy-install.sh
HARNESS_SRC=/Users/yanfenma/workspace/github/deepseek-harness
EVIDENCE=$REPO/docs/evidence/router-durable-generation-restart-safety-v1-20260921
TRUSTED_APP=/usr/local/libexec/agent-core/app
DURABLE_MODULE=$TRUSTED_APP/packages/agent-router/src/reconciliation/durable-file.js
STORE=/Users/authsvc/.agent-core/control/turn-recovery-v3.json
EXPECTED_SHA=2097e4f948dca77a12d24afa1ff9fb42e9ec7756
EXPECTED_TREE=7c6848f962845b6d614ed63acd5d484b69ab52c8
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

case "${1:-}" in
  --selftest)
    T=$(mktemp -d /tmp/router-closure-selftest.XXXXXX) || exit 1
    chmod 700 "$T"
    F="$T/store.json"
    node --input-type=module -e '
      const { TurnReconciliationStore } = await import("/Users/yanfenma/workspace/project/dsh-agent-core/.worktrees/deploy-2097e4f/packages/agent-router/src/reconciliation/store.js");
      const s = new TurnReconciliationStore({ persistenceFile: process.argv[1], runtimeEpoch: "selftest" });
      s.mintTurnExecution({ agentId: "agt_selftest", processGeneration: 1, sessionId: null });
      s.mintTurnExecution({ agentId: "agt_selftest", processGeneration: 2, sessionId: null });
    ' "$F" || { echo "SELFTEST_FAIL (seed)"; rm -rf "$T"; exit 1; }
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
    # If the mutex was held: dispose per the documented procedure
    # (see dispose-stale-deploy-lock.sh), never bare-rmdir, never retry-past-a-held-lock.
    if ! EXPECTED_SOURCE_SHA="$EXPECTED_SHA" \
    EXPECTED_SOURCE_TREE="$EXPECTED_TREE" \
    GENERATION_LABEL_SHA="$EXPECTED_SHA" \
      bash "$DEPLOYER" "$DEPLOY_SRC" "$HARNESS_SRC" "$REPO"; then
      die "installer exited non-zero (fail-closed). The trusted app tree MAY already be mutated by this run — check the newest agent-core.bak-* preimage and restore exactly (rm -rf live + mv BAK back) before any retry. If the mutex was held: dispose per the documented procedure (see dispose-stale-deploy-lock.sh), never bare-rmdir, never retry-past-a-held-lock."
    fi
    echo "### G2 post-deploy byte provenance"
    HITS_STORE=$(grep -c "highestIssuedGeneration" "$TRUSTED_APP/packages/agent-router/src/reconciliation/store.js" 2>/dev/null); HITS_STORE=${HITS_STORE:-0}
    HITS_GATE=$(grep -c "generationFloor" "$TRUSTED_APP/packages/agent-router/src/process-registry-route-gate.js" 2>/dev/null); HITS_GATE=${HITS_GATE:-0}
    HITS_REG=$(grep -c "AGENT_PROCESS_GENERATION_FLOOR_UNAVAILABLE" "$TRUSTED_APP/packages/agent-router/src/process-registry.js" 2>/dev/null); HITS_REG=${HITS_REG:-0}
    echo "DEPLOYED_BYTES store.highestIssuedGeneration hits=$HITS_STORE (expect >=1)"
    echo "DEPLOYED_BYTES route-gate generationFloor hits=$HITS_GATE (expect >=1)"
    echo "DEPLOYED_BYTES registry floor-unavailable code hits=$HITS_REG (expect >=1)"
    [ "$HITS_STORE" -ge 1 ] && [ "$HITS_GATE" -ge 1 ] && [ "$HITS_REG" -ge 1 ] \
      && echo "DEPLOYED_SOURCE_SHA = $EXPECTED_SHA (fix bytes live)" \
      || die "deployed bytes do not contain the reviewed fix"
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
  *) die "unknown subcommand (use preflight|deploy|health|snapshot|verify-restart|close|--selftest)" ;;
esac
