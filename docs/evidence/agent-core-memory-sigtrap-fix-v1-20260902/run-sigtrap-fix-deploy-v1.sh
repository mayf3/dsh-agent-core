#!/bin/bash
# AGENT_MEMORY_SIGTRAP_FIX_V1 — production transaction runner (USER-side).
# Global production resource: AGENT_CORE_PRODUCTION_RUNTIME (system/ai.agent-core.runtime).
# Sequence:
#   P0 read-only preflight (resource free, preimage pin, 4 target files)
#   P1 backup live memory.js (user-readable copy, sha)
#   P2 ROOT STEP via ONE osascript administrator dialog (preimage-verify →
#      install → verify → kickstart) — Owner approves the popup only
#   P3 wait for new runtime PID
#   P4 migrate the four corrupted MEMORY.md files (user-owned; tool --apply)
#   P5 post-verify: parse/render/repeated-render under production limits +
#      isolated-copy writeEntries drill + max-source check
#   P6 telemetry snapshot (node crash reports newer than deploy start)
set -uo pipefail
SANDBOX=/Users/yanfenma/workspace/sigtrap-fix-v1-sandbox
DEPLOY=$SANDBOX/deploy
TOOL=/Users/yanfenma/workspace/project/dsh-agent-core-sigtrap-v1/scripts/agent-memory-sigtrap-migration-v1.mjs
NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
MEMORY_JS_IMPORT=/Users/yanfenma/workspace/project/dsh-agent-core-sigtrap-v1/packages/agent-memory/src/memory.js
EXPECT_INSTALLED=99d59bdeb055e18d7827d5529f2505783252e6b75124f8fb45c91d5a96bf2b7d
EXPECT_PREIMAGE=239cd5ed488886ee9c66900112e7203ce7b6a9432efa1365d550787a2bfeabcc
LIVE=/usr/local/libexec/agent-core/app/packages/agent-memory/src/memory.js
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOG=$DEPLOY/logs/deploy-$STAMP.log
mkdir -p "$DEPLOY/logs" "$DEPLOY/backup"
exec > >(tee -a "$LOG") 2>&1

declare -a AGENTS=(agt_hr-agent agt_efficiency-agent agt_shopping-list-agent agt_ceo-agent)
declare -A WS=(
  [agt_hr-agent]="/Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74"
  [agt_efficiency-agent]="/Users/yanfenma/.openclaw/groups/workspace-oc_c6fa97d6255912b25a277e25441f6c11"
  [agt_shopping-list-agent]="/Users/yanfenma/.openclaw/groups/workspace-oc_96ba3f8c3476edac2fb64ee89f842f4e"
  [agt_ceo-agent]="/Users/yanfenma/.openclaw/groups/workspace-oc_3ce9cb52ea6d64f64a3197a978dd8c89"
)
echo "=== AGENT_MEMORY_SIGTRAP_FIX_V1 deploy start $STAMP ==="

echo "--- P0 preflight"
if ps aux | grep -E 'run-agent-core[^-]' | grep -v grep >/dev/null 2>&1; then
  echo "P0_FAIL: another production transaction appears active"; exit 1
fi
launchctl print system/ai.agent-core.runtime >/dev/null 2>&1 || { echo "P0_FAIL: service missing"; exit 1; }
live_sha=$(/usr/bin/shasum -a 256 "$LIVE" | awk '{print $1}')
[ "$live_sha" = "$EXPECT_PREIMAGE" ] || { echo "P0_FAIL: live memory.js drift sha=$live_sha"; exit 1; }
echo "P0: live preimage OK $live_sha"
for a in "${AGENTS[@]}"; do
  f="${WS[$a]}/MEMORY.md"
  [ -f "$f" ] || { echo "P0_FAIL: missing $f"; exit 1; }
  echo "P0: $a size=$(stat -f%z "$f") mtime=$(stat -f%Sm "$f") sha=$(shasum -a 256 "$f" | awk '{print $1}')"
done
OLD_PID=$(launchctl print system/ai.agent-core.runtime 2>/dev/null | awk '/^\tpid =/{print $3}')
echo "P0: runtime pid=$OLD_PID"

echo "--- P1 backup live memory.js (user copy)"
cp "$LIVE" "$DEPLOY/backup/memory.js.pre-sigtrapfix-v1-$STAMP"
bsha=$(/usr/bin/shasum -a 256 "$DEPLOY/backup/memory.js.pre-sigtrapfix-v1-$STAMP" | awk '{print $1}')
[ "$bsha" = "$EXPECT_PREIMAGE" ] || { echo "P1_FAIL: backup sha $bsha"; exit 1; }
echo "P1 OK"

echo "--- P2 ROOT STEP (ONE osascript administrator dialog; Owner approves popup)"
sed "s|__STAGED__|$DEPLOY/staging/memory.js|" "$DEPLOY/root-override/root-step.sh" > "$DEPLOY/root-override/root-step.rendered.sh"
chmod +x "$DEPLOY/root-override/root-step.rendered.sh"
ROOT_OUT=$(osascript -e "do shell script \"\\\"$DEPLOY/root-override/root-step.rendered.sh\\\" 2>&1\" with administrator privileges with prompt \"Agent Core memory SIGTRAP fix v1 deployment\"" )
echo "$ROOT_OUT"
echo "$ROOT_OUT" | grep -q "ROOT_STEP_ALL_DONE" || { echo "P2_FAIL: root step incomplete"; exit 1; }

echo "--- P3 wait for new runtime pid"
sleep 3
NEW_PID=""
for i in $(seq 1 30); do
  NEW_PID=$(launchctl print system/ai.agent-core.runtime 2>/dev/null | awk '/^\tpid =/{print $3}')
  STATE=$(launchctl print system/ai.agent-core.runtime 2>/dev/null | awk '/^\tstate =/{print $3}')
  if [ -n "$NEW_PID" ] && [ "$NEW_PID" != "$OLD_PID" ] && [ "$STATE" = "running" ]; then break; fi
  sleep 2
done
[ -n "$NEW_PID" ] && [ "$NEW_PID" != "$OLD_PID" ] || { echo "P3_FAIL: pid did not change (old=$OLD_PID new=$NEW_PID)"; exit 1; }
echo "P3 OK: old_pid=$OLD_PID new_pid=$NEW_PID state=running"

echo "--- P4 migrate four MEMORY.md files (tool --apply, user-owned files)"
for a in "${AGENTS[@]}"; do
  f="${WS[$a]}/MEMORY.md"
  echo "P4: $a"
  OUT=$("$NODE" "$TOOL" --file "$f" --apply --backup-dir "$DEPLOY/migration-backups/$a" --report "$DEPLOY/logs" 2>&1 | grep -E 'APPLIED|REFUSED|FAILED')
  echo "P4 $a: $OUT"
  echo "$OUT" | grep -q "APPLIED" || { echo "P4_FAIL: $a"; exit 1; }
done

echo "--- P5 post-verify"
FIXROOT="$DEPLOY/logs/postverify-$STAMP"; mkdir -p "$FIXROOT"
cat > "$FIXROOT/postverify.mjs" <<EOF
import { loadEntries, renderEntries, parseEntries, writeEntries } from "$MEMORY_JS_IMPORT"
import { readFileSync, copyFileSync, mkdirSync, statSync } from "node:fs"
import path from "node:path"
const agents = JSON.parse(process.env.AGENT_FILES)
const drillDir = process.env.DRILL_DIR
mkdirSync(drillDir, { recursive: true })
let allPass = true
for (const [agent, file] of Object.entries(agents)) {
  const entries = await loadEntries(file)                 // PARSE under PRODUCTION limits
  const text = readFileSync(file, "utf8")
  const re = renderEntries(entries)                       // RENDER
  const stable = renderEntries(parseEntries(re))          // REPEATED_RENDER_STABLE
  const maxSource = entries.reduce((n, e) => Math.max(n, e.source.length), 0)
  const drill = path.join(drillDir, agent + "-MEMORY.md") // isolated copy + real writeEntries
  copyFileSync(file, drill)
  const de = await loadEntries(drill)
  await writeEntries(drill, de)
  const db = await loadEntries(drill)
  const drillOk = JSON.stringify(de) === JSON.stringify(db)
  const ok = re === text && stable === text && drillOk
  console.log(\`\${agent}: parse=PASS render=\${re === text ? "PASS" : "FAIL"} stable=\${stable === text ? "PASS" : "FAIL"} entries=\${entries.length} maxSource=\${maxSource} writeDrill=\${drillOk ? "PASS" : "FAIL"} size=\${statSync(file).size}\`)
  if (!ok || maxSource > 8192) allPass = false
}
console.log(allPass ? "POSTVERIFY_ALL_PASS" : "POSTVERIFY_FAIL")
process.exit(allPass ? 0 : 1)
EOF
AGENT_FILES="$(python3 -c "
import json
ws={'agt_hr-agent':'/Users/yanfenma/.openclaw/groups/workspace-oc_a5e904510bbf4b983d6cd97b9f7bbb74','agt_efficiency-agent':'/Users/yanfenma/.openclaw/groups/workspace-oc_c6fa97d6255912b25a277e25441f6c11','agt_shopping-list-agent':'/Users/yanfenma/.openclaw/groups/workspace-oc_96ba3f8c3476edac2fb64ee89f842f4e','agt_ceo-agent':'/Users/yanfenma/.openclaw/groups/workspace-oc_3ce9cb52ea6d64f64a3197a978dd8c89'}
print(json.dumps({a: w + '/MEMORY.md' for a, w in ws.items()}))
")" DRILL_DIR="$FIXROOT/drills" "$NODE" "$FIXROOT/postverify.mjs" || { echo "P5_FAIL"; exit 1; }

echo "--- P6 telemetry snapshot (node crash reports newer than deploy log)"
NEW_CRASH_COUNT=$(find "$HOME/Library/Logs/DiagnosticReports" -name 'node-*.ips' -newer "$LOG" 2>/dev/null | wc -l | tr -d ' ')
find "$HOME/Library/Logs/DiagnosticReports" -name 'node-*.ips' -newer "$LOG" 2>/dev/null | while read -r f; do echo "NEW_CRASH: $f"; done
echo "NEW_MEMORY_SIGTRAP=$NEW_CRASH_COUNT"

echo "installed_sha=$(/usr/bin/shasum -a 256 "$LIVE" | awk '{print $1}')"
echo "=== DEPLOY RUNNER DONE (log: $LOG) ==="
