#!/bin/bash
# SHARED_SKILL_ROOT_PRODUCTION_ACTIVATION_V1 — rollback (Owner, sudo)
# usage: sudo bash rollback-shared-skill-root-v1.sh [preimage.plist]
#        (default: newest ai.agent-core.runtime.plist.bak-shared-skill-root-v1-*)
set -euo pipefail

PLIST="/Library/LaunchDaemons/ai.agent-core.runtime.plist"
DEFAULT_BAK="$(ls -t "${PLIST}".bak-shared-skill-root-v1-* 2>/dev/null | head -1 || true)"
BAK="${1:-$DEFAULT_BAK}"

[ "$(id -u)" = "0" ] || { echo "REFUSED: run with sudo"; exit 1; }
[ -n "$BAK" ] && [ -f "$BAK" ] || { echo "REFUSED: no preimage found"; exit 1; }

cp -p "$BAK" "$PLIST"
plutil -lint "$PLIST"
launchctl bootout system/ai.agent-core.runtime || true
sleep 2
launchctl bootstrap system "$PLIST"
sleep 4
launchctl print system/ai.agent-core.runtime | grep -E '"state"|[[:space:]]*pid = ' | head -3
curl -s -m 5 http://127.0.0.1:8790/health || true
echo
echo "ROLLBACK_DONE from=$BAK"
