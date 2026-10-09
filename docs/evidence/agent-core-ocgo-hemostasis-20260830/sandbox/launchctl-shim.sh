#!/bin/bash
# sandbox launchctl shim (content-driven): env of fake runtime mirrors the plist CONTENT being bootstrapped
SB=/tmp/hemostasis-sbox
NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
MODE_FILE=$SB/shim-mode
FAILED_ONCE_FILE=$SB/shim-failed-once
cmd="$1"; shift; target_plist="$2"   # bootstrap system <plist>
case "$cmd" in
  bootout)
    for p in $(pgrep -f "production-runtime.mjs --root $SB/Users/authsvc/.agent-core" 2>/dev/null); do kill "$p" 2>/dev/null; done
    exit 0 ;;
  bootstrap)
    MODE=$(cat "$MODE_FILE" 2>/dev/null || echo success)
    if [ "$MODE" = "fail_bootstrap" ]; then
      if [ ! -f "$FAILED_ONCE_FILE" ]; then touch "$FAILED_ONCE_FILE"; exit 1; fi   # fail only the first bootstrap (apply), not the rollback one
    fi
    if grep -q '>zai<' "$target_plist" 2>/dev/null; then PROV=zai; MODEL=glm-5.3
    else PROV=oc-go; MODEL=deepseek-v4-flash; fi
    if [ "$MODE" = "verify_fail" ] && [ "$PROV" = "zai" ]; then
      printf '[production-runtime] agent model route chain loaded for agt_cto-agent: glm53 (length 1)\n' >> $SB/Users/authsvc/.agent-core/logs/runtime.log
    else
      printf '[production-runtime] agent model route chain loaded for agt_cto-agent: glm53 (length 1)\n[production-runtime] production runtime ready (pid fake)\n' >> $SB/Users/authsvc/.agent-core/logs/runtime.log
    fi
    env "DSH_AGENT_PROVIDER=$PROV" "DSH_AGENT_MODEL=$MODEL" "$NODE" -e 'setTimeout(()=>{},600000)' production-runtime.mjs --root "$SB"/Users/authsvc/.agent-core --catchup 0 >/dev/null 2>&1 &
    exit 0 ;;
  *) exit 0 ;;
esac
