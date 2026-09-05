#!/bin/bash
# SHARED_SKILL_ROOT_PRODUCTION_ACTIVATION_V1 — privileged apply (Owner, sudo)
#
# Single production mutation:
#   insert EnvironmentVariables.DSH_AGENTS_HOME=/Users/yanfenma/.agents into
#   /Library/LaunchDaemons/ai.agent-core.runtime.plist (system domain),
#   then bootout+bootstrap ai.agent-core.runtime so launchd re-reads the plist.
#
# PRECONDITIONS (checked by operator, printed here as reminder):
#   1. Run ONLY while the production mutation slot is free
#      (as of 2026-09-05 the WDA canary lane still held it: CANARY_RESULT.json absent).
#   2. kickstart -k is NOT used: it does not re-read plist EnvironmentVariables.
#
# Idempotence: aborts if the key is already present.
set -euo pipefail

PLIST="/Library/LaunchDaemons/ai.agent-core.runtime.plist"
EXPECTED_ROOT="/Users/yanfenma/.agents"
TS="$(date +%Y%m%d-%H%M%S)"
BAK="${PLIST}.bak-shared-skill-root-v1-${TS}"

[ "$(id -u)" = "0" ] || { echo "REFUSED: run with sudo"; exit 1; }
[ -f "$PLIST" ] || { echo "REFUSED: plist missing"; exit 1; }

if plutil -extract EnvironmentVariables.DSH_AGENTS_HOME raw "$PLIST" >/dev/null 2>&1; then
  echo "ABORT: DSH_AGENTS_HOME already present in plist (nothing to do)"
  exit 1
fi

OLD_PID="$(launchctl print system/ai.agent-core.runtime 2>/dev/null | awk -F'= ' '/^[[:space:]]*pid = /{print $2; exit}')"
echo "OLD_PID=${OLD_PID:-<none>}"

cp -p "$PLIST" "$BAK"
plutil -insert EnvironmentVariables.DSH_AGENTS_HOME -string "$EXPECTED_ROOT" "$PLIST"
plutil -lint "$PLIST"

# key-only diff gate: exactly 2 added lines, 0 removed/changed
ADDED="$(diff "$BAK" "$PLIST" | grep -c '^>' || true)"
REMOVED="$(diff "$BAK" "$PLIST" | grep -c '^<' || true)"
if [ "$ADDED" != "2" ] || [ "$REMOVED" != "0" ]; then
  echo "DIFF GATE FAIL (added=$ADDED removed=$REMOVED) — restoring preimage"
  cp -p "$BAK" "$PLIST"
  exit 1
fi

launchctl bootout system/ai.agent-core.runtime
sleep 2
launchctl bootstrap system "$PLIST"

NEW_PID=""
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  NEW_PID="$(launchctl print system/ai.agent-core.runtime 2>/dev/null | awk -F'= ' '/^[[:space:]]*pid = /{print $2; exit}')"
  [ -n "$NEW_PID" ] && break
done

echo "--- env face ---"
launchctl print system/ai.agent-core.runtime | grep -A1 'DSH_AGENTS_HOME' || echo "WARN: env key not visible in launchctl print"
echo "--- health face ---"
curl -s -m 5 http://127.0.0.1:8790/health || true
echo
echo "APPLY_DONE OLD_PID=${OLD_PID:-<none>} NEW_PID=${NEW_PID:-<none>} preimage=$BAK"
