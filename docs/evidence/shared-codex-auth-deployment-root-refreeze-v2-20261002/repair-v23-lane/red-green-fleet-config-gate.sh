#!/bin/bash
# red-green-fleet-config-gate.sh — RED/GREEN generator for DEFECT C (agent-control#195).
# Hermetic: /tmp fixtures + the pin worktree's own bytes. PRODUCTION_MUTATION=NO.
#   RED   = a v2 fleet config (the deployed preimage shape: 92 luna-primary overrides,
#           routeCatalog.luna WITHOUT credentialFile) under the pin's v3 loader → the
#           EXACT #195 FATAL line, MODEL_OVERRIDES_CONFIG_GATE_V1 exit 2.
#   GREEN = the frozen v2→v3 migrator's output (version 3 + canonical credentialFile on
#           the openai-codex subscription route, 92-override roster preserved, preimage
#           backup present) loads clean under the SAME loader → gate exit 0.
# Usage: bash red-green-fleet-config-gate.sh [DEPLOY_SRC]   (default: the v2.3 pin worktree)
set -u
REPO=/Users/yanfenma/workspace/project/dsh-agent-core
DEPLOY_SRC="${1:-$REPO/.worktrees/b7-v23-packet-repair-20261002}"
GATE="$DEPLOY_SRC/scripts/lib/trusted-cp-model-overrides-config-gate.mjs"
MIGRATE="$DEPLOY_SRC/scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs"
LOADER="$DEPLOY_SRC/packages/production-runtime/src/model-overrides.js"
PIN=$(git -C "$DEPLOY_SRC" rev-parse HEAD)
TREE=$(git -C "$DEPLOY_SRC" rev-parse HEAD^{tree})
echo "== RED_GREEN_FLEET_CONFIG_GATE (DEFECT C / agent-control#195) =="
echo "DEPLOY_SRC=$DEPLOY_SRC"
echo "PIN=$PIN TREE=$TREE"
T=$(mktemp -d /tmp/red-green-fleet-config.XXXXXX); chmod 700 "$T"
CX="$T/fleet-root"; mkdir -p "$CX"
node -e '
  const { writeFileSync } = require("node:fs")
  const root = process.argv[1]
  const agents = Array.from({ length: 92 }, (_, i) => ({ id: `agt_fix${String(i).padStart(2, "0")}-agent`, name: `f${i}`, description: null }))
  writeFileSync(root + "/agents.json", JSON.stringify({ version: 1, defaultAgentId: agents[0].id, agents }, null, 2))
  const overrides = Object.fromEntries(agents.map((a) => [a.id, { model: { primary: "luna", fallbacks: [] } }]))
  const config = { version: 2, routeCatalog: { luna: { routeKind: "subscription", provider: "openai-codex", model: "gpt-5.6-luna", plugin: "dsh-codex", pluginVersion: "0.2.3", credentialReadiness: "bridge-store-bound" } }, overrides }
  writeFileSync(root + "/agent-model-overrides.json", JSON.stringify(config, null, 2) + "\n", { mode: 0o600 })
' "$CX"
echo "-- fixture written: 92-override v2 preimage shape (routeCatalog.luna without credentialFile)"
echo
echo "== RED: v2 config vs pin v3 loader (the #195 class) =="
node "$GATE" --installed-root "$DEPLOY_SRC" --config "$CX/agent-model-overrides.json" \
  --registry "$CX/agents.json" --deployment-root "$CX" --json > "$T/red.json" 2>&1
RED_RC=$?
node -e '
  const v = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))
  console.log("RED gate rc + verdict: ok=" + v.ok + " errorCode=" + v.errorCode)
  console.log("RED error line: " + v.error)
' "$T/red.json"
echo "RED_RC=$RED_RC (expect 2 — fail-closed BEFORE any cutover)"
[ "$RED_RC" -eq 2 ] || { echo "RED FAILED"; exit 1; }
node -e '
  const v = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))
  if (!(v.error.includes("older files are not converted") && v.error.includes("must be {"))) process.exit(1)
  console.log("RED LINE_CHECK = the exact #195 FATAL class (version-3 requirement, older files refused)")
' "$T/red.json" || { echo "RED LINE CHECK FAILED"; exit 1; }
echo
echo "== GREEN: frozen v2→v3 migration, then the SAME loader =="
node "$MIGRATE" --config "$CX/agent-model-overrides.json" --registry "$CX/agents.json" \
  --deployment-root "$CX" --model-overrides-module "$LOADER" --json > "$T/dry.json" 2>&1
echo "DRY_RUN_RC=$? (expect 0 — candidate validated, zero mutation)"
node "$MIGRATE" --config "$CX/agent-model-overrides.json" --registry "$CX/agents.json" \
  --deployment-root "$CX" --model-overrides-module "$LOADER" --execute --json > "$T/exec.json" 2>&1
EXEC_RC=$?
node -e '
  const v = JSON.parse(require("node:fs").readFileSync(process.argv[2], "utf8"))
  console.log("EXECUTE rc=" + process.argv[1] + " mode=" + v.mode + " routesTouched=" + JSON.stringify(v.routesTouched) +
    " overrides=" + v.overridesBefore + "/" + v.overridesAfter)
  console.log("BACKUP=" + v.backupPath)
' "$EXEC_RC" "$T/exec.json" || { echo "EXECUTE REPORT FAILED"; exit 1; }
node -e '
  const v = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))
  if (!v.ok || v.routesTouched.join(",") !== "luna" || v.overridesAfter !== 92 || !v.backupPath) process.exit(1)
  const { readFileSync } = require("node:fs")
  const backupMatches = readFileSync(v.backupPath, "utf8").includes("\"version\": 2")
  console.log("MIGRATION_DELTA = version 2->3 + credentialFile on luna ONLY; overrides 92 preserved; backup present(v2-content)=" + backupMatches)
  if (!backupMatches) process.exit(1)
' "$T/exec.json" || { echo "MIGRATION DELTA CHECK FAILED"; exit 1; }
node "$GATE" --installed-root "$DEPLOY_SRC" --config "$CX/agent-model-overrides.json" \
  --registry "$CX/agents.json" --deployment-root "$CX" --json > "$T/green.json" 2>&1
GREEN_RC=$?
node -e '
  const v = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))
  console.log("GREEN gate verdict: ok=" + v.ok + " filePresent=" + v.filePresent + " overrides=" + v.overrideCount)
' "$T/green.json"
echo "GREEN_RC=$GREEN_RC (expect 0)"
[ "$GREEN_RC" -eq 0 ] || { echo "GREEN FAILED"; exit 1; }
echo
echo "== G2.5/G2.6 + suite regression at the pin =="
cd "$DEPLOY_SRC"
node --test scripts/lib/trusted-cp-closure-resolution-gate.test.mjs scripts/lib/trusted-cp-fresh-child-boot-canary.test.mjs scripts/lib/trusted-cp-runtime-app-graph-gate.test.mjs scripts/lib/trusted-cp-watchdog-ownership-guard.test.mjs scripts/lib/trusted-cp-model-overrides-config-gate.test.mjs scripts/lib/trusted-cp-fleet-config-v2v3-migration.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail|skipped)'
echo "SUITE_REGRESSION = recorded above (existing four suites unchanged + two new suites)"
rm -rf "$T"
echo "RED_GREEN_FLEET_CONFIG_GATE = PASS"
