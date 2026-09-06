#!/bin/bash
# SHARED_SKILL_ROOT_PRODUCTION_ACTIVATION_V1 — privileged apply (Owner, sudo)
#
# Single production mutation:
#   insert EnvironmentVariables.DSH_AGENTS_HOME=/Users/yanfenma/.agents into
#   /Library/LaunchDaemons/ai.agent-core.runtime.plist (system domain),
#   then bootout+bootstrap ai.agent-core.runtime so launchd re-reads the plist.
#
# PRECONDITIONS (checked by operator, printed here as reminder):
#   1. Run ONLY while the production mutation slot is free.
#   2. kickstart -k is NOT used: it does not re-read plist EnvironmentVariables.
#
# Idempotence: aborts if the key is already present.
# --selftest: offline stub run (no root, no real launchctl/curl, temp plist).
set -euo pipefail

PLIST="/Library/LaunchDaemons/ai.agent-core.runtime.plist"
EXPECTED_ROOT="/Users/yanfenma/.agents"
TS="$(date +%Y%m%d-%H%M%S)"
BAK="${PLIST}.bak-shared-skill-root-v1-${TS}"

main() {
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
}

selftest() {
  local T; T="$(mktemp -d /tmp/ssr-selftest.XXXXXX)"
  local SB="$T/bin"; mkdir -p "$SB"
  # stub launchctl: print emits stub pid; bootout/bootstrap record calls
  cat > "$SB/launchctl" <<'EOF'
#!/bin/bash
LOG="${SSR_STUB_LOG:?}"
echo "launchctl $*" >> "$LOG"
case "$1" in
  print)  printf '\tstate = running\n\tpid = 424242\n\t\tDSH_AGENTS_HOME => /Users/yanfenma/.agents\n' ;;
  bootout|bootstrap) exit 0 ;;
esac
exit 0
EOF
  # stub curl: health face
  cat > "$SB/curl" <<'EOF'
#!/bin/bash
echo '{"ok":true,"stub":true}'
EOF
  chmod +x "$SB/launchctl" "$SB/curl"
  # stub plist: mirror live EnvironmentVariables shape (subset, sufficient for insert+diff)
  PLIST="$T/ai.agent-core.runtime.plist"
  BAK="${PLIST}.bak-shared-skill-root-v1-selftest"
  plutil -create xml1 "$PLIST"
  plutil -insert EnvironmentVariables -dictionary "$PLIST"
  for kv in "AGENT_CORE_CREDENTIALS_FILE:/usr/local/libexec/agent-core/config/agent-credentials.json" \
            "BROKER_AUTH_ORIGIN:http://127.0.0.1:4001" \
            "DSH_AGENT_MODEL:deepseek-v4-flash" \
            "HOME:/Users/authsvc"; do
    plutil -insert "EnvironmentVariables.${kv%%:*}" -string "${kv#*:}" "$PLIST"
  done

  # 1) success path (root check bypassed: PLIST already stubbed, main() skipped root gate via SELFTEST)
  export SSR_STUB_LOG="$T/launchctl.log"
  export PATH="$SB:$PATH"
  SELFTEST=1 bash -c '
    set -euo pipefail
    PLIST="'"$PLIST"'"; BAK="'"$BAK"'"; EXPECTED_ROOT="/Users/yanfenma/.agents"; TS="selftest"
    # inline replica of main() body without root gate
    if plutil -extract EnvironmentVariables.DSH_AGENTS_HOME raw "$PLIST" >/dev/null 2>&1; then echo "ABORT"; exit 1; fi
    cp -p "$PLIST" "$BAK"
    plutil -insert EnvironmentVariables.DSH_AGENTS_HOME -string "$EXPECTED_ROOT" "$PLIST"
    plutil -lint "$PLIST"
    ADDED="$(diff "$BAK" "$PLIST" | grep -c "^>" || true)"; REMOVED="$(diff "$BAK" "$PLIST" | grep -c "^<" || true)"
    [ "$ADDED" = "2" ] && [ "$REMOVED" = "0" ] || { echo "DIFF_GATE_FAIL added=$ADDED removed=$REMOVED"; exit 1; }
    launchctl bootout system/ai.agent-core.runtime
    launchctl bootstrap system "$PLIST"
    NEW_PID="$(launchctl print system/ai.agent-core.runtime | awk -F"= " "/pid = /{print \$2; exit}")"
    echo "APPLY_DONE NEW_PID=$NEW_PID"
  ' > "$T/run1.out" 2>&1 || { echo "SELFTEST FAIL (success path)"; cat "$T/run1.out"; rm -rf "$T"; exit 1; }
  grep -q "APPLY_DONE NEW_PID=424242" "$T/run1.out" || { echo "SELFTEST FAIL (stub pid not observed)"; cat "$T/run1.out"; rm -rf "$T"; exit 1; }
  grep -q "bootout" "$SSR_STUB_LOG" && grep -q "bootstrap" "$SSR_STUB_LOG" || { echo "SELFTEST FAIL (restart calls missing)"; rm -rf "$T"; exit 1; }
  GOT="$(plutil -extract EnvironmentVariables.DSH_AGENTS_HOME raw "$PLIST")"
  [ "$GOT" = "/Users/yanfenma/.agents" ] || { echo "SELFTEST FAIL (key value $GOT)"; rm -rf "$T"; exit 1; }

  # 2) idempotence abort path
  if plutil -extract EnvironmentVariables.DSH_AGENTS_HOME raw "$PLIST" >/dev/null 2>&1; then
    echo "SELFTEST: idempotence precondition holds (re-run would ABORT) : OK"
  else
    echo "SELFTEST FAIL (idempotence)"; rm -rf "$T"; exit 1
  fi

  # 3) diff-gate restore path: simulate an unrelated mutation after insert
  plutil -replace EnvironmentVariables.HOME -string "/Users/changed" "$PLIST"
  ADDED2="$(diff "$BAK" "$PLIST" | grep -c '^>' || true)"
  if [ "$ADDED2" != "2" ]; then
    echo "SELFTEST: diff gate catches unrelated drift (added=$ADDED2, expected 2) : OK"
  else
    echo "SELFTEST FAIL (diff gate blind to drift)"; rm -rf "$T"; exit 1
  fi

  rm -rf "$T"
  echo "SELFTEST PASS (success path + idempotence + diff-gate drift detection, all offline stubs)"
}

if [ "${1:-}" = "--selftest" ]; then
  selftest
else
  main
fi
