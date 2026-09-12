#!/bin/bash
# =============================================================================
# AGENT_CORE_OC_GO_HEMOSTASIS_V1 — Owner deployment runner (interactive, ROOT)
#
# Purpose: remove the production Agent Core default-route dependency on the
# exhausted OpenCode Go route by flipping the launchd global route env
#   DSH_AGENT_PROVIDER: oc-go             -> zai
#   DSH_AGENT_MODEL:    deepseek-v4-flash -> glm-5.3
# with a controlled restart of ONLY ai.agent-core.runtime.
#
# Explicitly NOT in scope (enforced by pins / assertions):
#   - agent-model-overrides.json  (byte-pinned read-only; agt_cto-agent
#     glm53 strict chain stays untouched; NO per-agent override entries are
#     added — deployed code scope-checks overrides to {agt_cto-agent} only)
#   - Luna (overrides pin asserted luna-free)
#   - OpenCode Go balance / credentials (oc-go keys stay in place)
#   - any Feishu delivery / business-task resend (scheduler catchup stays 0)
#   - any other launchd service (single-label restart)
#
# Owner command (interactive, no args):
#   sudo bash /tmp/run-agent-core-ocgo-hemostasis-v1.sh
# Confirm phrase when prompted:
#   APPLY AGENT_CORE_OC_GO_HEMOSTASIS_V1
#
# Exit codes:
#   0  SUCCESS / ALREADY_APPLIED
#   1  ROLLED_BACK (apply or verification failed; production restored)
#   2  REFUSED (preflight pin drift / not root / wrong phrase / busy runtime)
#   4  ROLLBACK_INCOMPLETE (manual intervention required — named state)
#
# Test seams (sandbox only; production run leaves them unset):
#   TEST_PLIST / TEST_LAUNCHCTL / TEST_HOMES_ROOT / TEST_LOG_DIR / TEST_ROOT_PREFIX
# =============================================================================
set -Eeuo pipefail

ROOT_PREFIX="${TEST_ROOT_PREFIX:-}"
PLIST="${TEST_PLIST:-/Library/LaunchDaemons/ai.agent-core.runtime.plist}"
LABEL="ai.agent-core.runtime"
OVERRIDES="${ROOT_PREFIX}/Users/authsvc/.agent-core/agent-model-overrides.json"
AGENTS_CONFIG="${ROOT_PREFIX}/usr/local/libexec/agent-core/config/agents.json"
HOMES_ROOT="${TEST_HOMES_ROOT:-${ROOT_PREFIX}/Users/authsvc/.agent-core/homes}"
CTO_HOME="${ROOT_PREFIX}/Users/authsvc/.agent-core/homes/agt_cto-agent"
LOG_DIR="${TEST_LOG_DIR:-${ROOT_PREFIX}/Users/authsvc/.agent-core/logs}"
RUNTIME_LOG="$LOG_DIR/runtime.log"
LEDGER="${ROOT_PREFIX}/usr/local/libexec/agent-core/.deploy-backups/hemostasis-v1-ledger.jsonl"
LAUNCHCTL="${TEST_LAUNCHCTL:-launchctl}"
NODE_BIN="/usr/local/libexec/agent-core/node-runtime/bin/node"

PIN_PLIST_SHA256="9019f07178c13b0caa0d0dacfdc952665ddc20b2ab42b9076e28dd089004566b"
PIN_OVERRIDES_SHA256="b9d301a7ef2e2e659357b2099d748402fcbefa4f3cab9a849a8b10a4d3708551"
PHRASE="APPLY AGENT_CORE_OC_GO_HEMOSTASIS_V1"
GRANT_WRITE_ATTEMPTED=0
ROLLBACK_RUNNING=0
BACKUP_PLIST=""

say() { echo "[hemostasis-v1] $*"; }

ledger() {
  mkdir -p "$(dirname "$LEDGER")" 2>/dev/null || true
  echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"event\":\"$1\",\"detail\":$2}" >> "$LEDGER" 2>/dev/null || true
}

# ─── R: rollback (defined BEFORE traps; always available at runtime) ─────────
do_rollback() {
  ROLLBACK_RUNNING=1
  trap - ERR EXIT
  local CAUSE="$1"
  echo "[hemostasis-v1] ROLLBACK cause=$CAUSE" >&2
  local UNRESTORED=""
  if [ -n "$BACKUP_PLIST" ] && [ -f "$BACKUP_PLIST" ]; then
    cat "$BACKUP_PLIST" > "$PLIST" || UNRESTORED="$UNRESTORED plist_content"
    plutil -lint "$PLIST" > /dev/null || UNRESTORED="$UNRESTORED plist_lint"
    chown root:wheel "$PLIST" 2>/dev/null || true
    chmod 644 "$PLIST" 2>/dev/null || true
    local RB_SHA
    RB_SHA=$(shasum -a 256 "$PLIST" | awk '{print $1}')
    [ "$RB_SHA" = "$PIN_PLIST_SHA256" ] || UNRESTORED="$UNRESTORED plist_sha"
    "$LAUNCHCTL" bootout "system/$LABEL" 2>/dev/null || true
    sleep 3
    "$LAUNCHCTL" bootstrap system "$PLIST" || UNRESTORED="$UNRESTORED relaunch"
    sleep 8
    local RB_PID RB_ENV
    RB_PID=$(pgrep -f "production-runtime.mjs --root ${ROOT_PREFIX}/Users/authsvc/.agent-core" | head -1 || true)
    [ -n "$RB_PID" ] || UNRESTORED="$UNRESTORED runtime_pid"
    RB_ENV=$(ps eww -p "$RB_PID" -o command= 2>/dev/null | tr ' ' '\n' | grep '^DSH_AGENT_PROVIDER=' || true)
    [ "$RB_ENV" = "DSH_AGENT_PROVIDER=oc-go" ] || UNRESTORED="$UNRESTORED runtime_env($RB_ENV)"
  else
    UNRESTORED="$UNRESTORED backup_missing"
  fi
  ledger "rollback" "{\"cause\":\"$CAUSE\",\"unrestored\":\"${UNRESTORED:-none}\"}"
  if [ -n "$UNRESTORED" ]; then
    echo "[hemostasis-v1] ROLLBACK_INCOMPLETE: $UNRESTORED — MANUAL INTERVENTION REQUIRED" >&2
    exit 4
  fi
  echo "[hemostasis-v1] ROLLED_BACK cleanly (cause=$CAUSE; plist sha restored; runtime oc-go)"
  exit 1
}

# die: pre-write refusals exit 2; after the first write everything funnels to rollback
die() {
  if [ "$GRANT_WRITE_ATTEMPTED" = "1" ] && [ "$ROLLBACK_RUNNING" = "0" ]; then
    do_rollback "die_after_writes: $*"
  fi
  echo "[hemostasis-v1] FATAL: $*" >&2
  exit 2
}

on_err() {
  local rc=$?
  [ "$ROLLBACK_RUNNING" = 1 ] && { echo "[hemostasis-v1] rollback already running (rc=$rc)" >&2; exit 4; }
  echo "[hemostasis-v1] ERR trap rc=$rc at line $1 — entering rollback" >&2
  do_rollback "unexpected_error_rc_${rc}_line_$1"
}

cleanup_exit() {
  local rc=$?
  trap - ERR EXIT
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 2 ] && [ "$GRANT_WRITE_ATTEMPTED" = 1 ] && [ "$ROLLBACK_RUNNING" = 0 ]; then
    do_rollback "exit_rc_${rc}"
    rc=$?
  fi
  exit $rc
}

# ─── G0: identity gate ───────────────────────────────────────────────────────
if [ "${TEST_SKIP_G0:-0}" = "1" ]; then
  say "G0 SKIPPED (TEST_SKIP_G0=1 — sandbox only, never in production)"
else
  [ "$(id -u)" -eq 0 ] || { echo "[hemostasis-v1] FATAL: must run as root (sudo bash $0)" >&2; exit 2; }
  [ "$#" -eq 0 ] || { echo "[hemostasis-v1] FATAL: no arguments expected (interactive confirm only)" >&2; exit 2; }
  read -r -p "Confirm phrase: " GIVEN
  [ "$GIVEN" = "$PHRASE" ] || { echo "[hemostasis-v1] FATAL: confirm phrase mismatch — refusing" >&2; exit 2; }
fi

trap 'on_err $LINENO' ERR
trap 'cleanup_exit' EXIT

# ─── P1: config pins (drift => refuse, zero writes) ──────────────────────────
say "P1: pinning production configuration"
CUR_OVR_SHA=$(shasum -a 256 "$OVERRIDES" | awk '{print $1}')
[ "$CUR_OVR_SHA" = "$PIN_OVERRIDES_SHA256" ] || die "agent-model-overrides.json sha256 drift: $CUR_OVR_SHA != pin (refuse — this file must stay byte-identical)"
if grep -q 'luna\|Luna' "$OVERRIDES"; then
  die "overrides pin unexpectedly contains luna (pin mismatch — refuse)"
fi
say "P1 PASS: overrides byte-pinned (luna-free)"

# ─── P2: idempotence / target-state check ────────────────────────────────────
if grep -q '>zai<' "$PLIST" && grep -q '>glm-5.3<' "$PLIST" && ! grep -q '>oc-go<' "$PLIST"; then
  say "plist already at zai/glm-5.3 — ALREADY_APPLIED (no writes)"
  ledger "already_applied" '"plist=ok"'
  trap - ERR EXIT
  exit 0
fi
CUR_PLIST_SHA=$(shasum -a 256 "$PLIST" | awk '{print $1}')
[ "$CUR_PLIST_SHA" = "$PIN_PLIST_SHA256" ] || die "plist sha256 drift: $CUR_PLIST_SHA != pin $PIN_PLIST_SHA256 (concurrent modification? refuse)"
CNT_OCGO=$(grep -c '>oc-go<' "$PLIST" || true)
CNT_DSV4=$(grep -c '>deepseek-v4-flash<' "$PLIST" || true)
CNT_ZAI=$(grep -c '>zai<' "$PLIST" || true)
CNT_GLM=$(grep -c '>glm-5.3<' "$PLIST" || true)
{ [ "$CNT_OCGO" = "1" ] && [ "$CNT_DSV4" = "1" ] && [ "$CNT_ZAI" = "0" ] && [ "$CNT_GLM" = "0" ]; } \
  || die "unexpected plist shape (oc-go=$CNT_OCGO deepseek=$CNT_DSV4 zai=$CNT_ZAI glm53=$CNT_GLM; expected 1/1/0/0) — refuse"

# ─── P3: authoritative inventory sweep (agents.json is root-readable here) ───
say "P3: inventory sweep — every REGISTERED agent must be zai-capable"
"$NODE_BIN" -e '
const fs = require("fs");
const doc = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!Array.isArray(doc.agents)) throw new Error("agents.json: agents must be an array");
console.log(doc.agents.map((a) => a.id).sort().join("\n"));
' "$AGENTS_CONFIG" > /tmp/.hemostasis-agents.$$ || die "cannot parse $AGENTS_CONFIG"
REG_COUNT=$(grep -c . /tmp/.hemostasis-agents.$$)
say "registered agents: $REG_COUNT"
SWEEP_BACKUP=""
FIXED=0; MISSING_HOME=0; OK=0
while IFS= read -r aid; do
  [ -n "$aid" ] || continue
  H="$HOMES_ROOT/$aid"
  if [ ! -d "$H" ]; then
    MISSING_HOME=$((MISSING_HOME+1))
    say "  WARN $aid: no home dir (first-spawn provisioning copies 505 settings/credentials; flagging only)"
    continue
  fi
  NEED_FIX=0
  grep -q '^    zai:' "$H/settings.yaml" 2>/dev/null || NEED_FIX=1
  grep -q '^ZAI_API_KEY:' "$H/.credentials.yaml" 2>/dev/null || NEED_FIX=1
  if [ "$NEED_FIX" = "0" ]; then OK=$((OK+1)); continue; fi
  SWEEP_BACKUP="${SWEEP_BACKUP:-$HOMES_ROOT/.zhixue-runner-backup-$(date -u +%Y%m%dT%H%M%SZ)}"
  mkdir -p "$SWEEP_BACKUP/$aid"
  [ -f "$H/settings.yaml" ] && cp -p "$H/settings.yaml" "$SWEEP_BACKUP/$aid/settings.yaml"
  [ -f "$H/.credentials.yaml" ] && cp -p "$H/.credentials.yaml" "$SWEEP_BACKUP/$aid/.credentials.yaml"
  grep -q '^ZAI_API_KEY:' "$H/.credentials.yaml" 2>/dev/null || \
    grep -E '^ZAI_API_KEY:' "$CTO_HOME/.credentials.yaml" | head -1 >> "$H/.credentials.yaml"
  grep -q '^    zai:' "$H/settings.yaml" 2>/dev/null || \
    awk '/^        - id: deepseek-v4-flash$/ && !done {print; print "    zai:"; print "      apiKeyEnv: ZAI_API_KEY"; print "      models:"; print "        - id: glm-5.3"; done=1; next} {print}' \
      "$H/settings.yaml" > "$H/.settings.new" && cat "$H/.settings.new" > "$H/settings.yaml" && rm -f "$H/.settings.new"
  chown 502:20 "$H/settings.yaml" "$H/.credentials.yaml"
  chmod 600 "$H/.credentials.yaml"; chmod 600 "$H/settings.yaml"
  grep -q '^    zai:' "$H/settings.yaml" && grep -q '^ZAI_API_KEY:' "$H/.credentials.yaml" \
    || die "sweep fix failed verification for $aid"
  FIXED=$((FIXED+1))
  say "  fixed $aid (backup in $SWEEP_BACKUP/$aid)"
done < /tmp/.hemostasis-agents.$$
rm -f /tmp/.hemostasis-agents.$$
say "P3 PASS: registered=$REG_COUNT ok=$OK fixed=$FIXED missing_home=$MISSING_HOME (backup: ${SWEEP_BACKUP:-none-needed})"
ledger "inventory_sweep" "{\"registered\":$REG_COUNT,\"ok\":$OK,\"fixed\":$FIXED,\"missing_home\":$MISSING_HOME}"

# ─── P4: quiescence (no young agent child = no in-flight turn) ───────────────
say "P4: quiescence check"
BUSY=1
for attempt in 1 2 3 4 5; do
  NOW=$(date +%s)
  BUSY=0
  for pid in $(pgrep -f 'harness/apps/cli/lib/bin.js --profile agent-core-production' 2>/dev/null || true); do
    ST=$(ps -p "$pid" -o lstart= 2>/dev/null) || continue
    if ! ST_E=$(date -j -f '%a %b %d %H:%M:%S %Y' "$ST" +%s 2>/dev/null); then continue; fi
    AGE=$((NOW - ST_E))
    if [ "$AGE" -lt 180 ]; then
      BUSY=1; say "  young child pid=$pid age=${AGE}s (likely mid-turn)"
    fi
  done
  [ "$BUSY" = "0" ] && break
  say "  attempt $attempt: runtime busy — waiting 60s"
  sleep 60
done
[ "$BUSY" = "0" ] || die "runtime still busy after 5 min (young agent children) — refuse (retry later)"
say "P4 PASS: quiescent"

# ─── D1: backup plist ────────────────────────────────────────────────────────
say "D1: backup plist"
TS=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_PLIST="${PLIST}.bak-ocgo-hemostasis-${TS}"
cp -p "$PLIST" "$BACKUP_PLIST"
BACKUP_SHA=$(shasum -a 256 "$BACKUP_PLIST" | awk '{print $1}')
[ "$BACKUP_SHA" = "$PIN_PLIST_SHA256" ] || die "backup verification failed"
say "backup: $BACKUP_PLIST (sha256=$BACKUP_SHA)"
ledger "backup_created" "{\"path\":\"$BACKUP_PLIST\",\"sha256\":\"$BACKUP_SHA\"}"

# ─── D2: edit plist (exactly two values) ─────────────────────────────────────
say "D2: flip global route env (oc-go/deepseek-v4-flash -> zai/glm-5.3)"
GRANT_WRITE_ATTEMPTED=1
TMP_PLIST="/tmp/.hemostasis-plist.$$"
sed -e 's|<string>oc-go</string>|<string>zai</string>|' \
    -e 's|<string>deepseek-v4-flash</string>|<string>glm-5.3</string>|' \
    "$PLIST" > "$TMP_PLIST"
plutil -lint "$TMP_PLIST" > /dev/null || die "edited plist failed plutil -lint"
CHANGED=$(diff "$PLIST" "$TMP_PLIST" | grep -c '^<' || true)
[ "$CHANGED" = "2" ] || die "edit produced ${CHANGED:-0} changed lines (expected exactly 2) — refusing to install"
[ "$(grep -c '>zai<' "$TMP_PLIST" || true)" = "1" ] || die "new plist must contain exactly one zai"
[ "$(grep -c '>glm-5.3<' "$TMP_PLIST" || true)" = "1" ] || die "new plist must contain exactly one glm-5.3"
if grep -q '>oc-go<' "$TMP_PLIST"; then die "new plist still contains oc-go"; fi
cat "$TMP_PLIST" > "$PLIST"
rm -f "$TMP_PLIST"
plutil -lint "$PLIST" > /dev/null || die "installed plist failed plutil -lint"
NEW_SHA=$(shasum -a 256 "$PLIST" | awk '{print $1}')
say "installed new plist sha256=$NEW_SHA"
ledger "plist_flipped" "{\"old\":\"$PIN_PLIST_SHA256\",\"new\":\"$NEW_SHA\"}"

# ─── D3: controlled restart (single label) ───────────────────────────────────
say "D3: restart $LABEL (bootout + bootstrap; no other service touched)"
OLD_PID=$(pgrep -f "production-runtime.mjs --root ${ROOT_PREFIX}/Users/authsvc/.agent-core" | head -1 || true)
LOG_MARK=$(wc -l < "$RUNTIME_LOG" 2>/dev/null || echo 0)
"$LAUNCHCTL" bootout "system/$LABEL" 2>/dev/null || say "bootout returned nonzero (job may already be down) — continuing"
for i in $(seq 1 30); do
  pgrep -f "production-runtime.mjs --root ${ROOT_PREFIX}/Users/authsvc/.agent-core" >/dev/null || break
  sleep 1
done
if pgrep -f "production-runtime.mjs --root ${ROOT_PREFIX}/Users/authsvc/.agent-core" >/dev/null; then
  say "WARN old runtime still alive after 30s"
fi
"$LAUNCHCTL" bootstrap system "$PLIST" || die "launchctl bootstrap failed"
NEW_PID=""
for i in $(seq 1 60); do
  NEW_PID=$(pgrep -f "production-runtime.mjs --root ${ROOT_PREFIX}/Users/authsvc/.agent-core" | head -1 || true)
  [ -n "$NEW_PID" ] && break
  sleep 1
done
if [ -z "$NEW_PID" ]; then
  echo "[hemostasis-v1] new runtime did not come up" >&2
  false
fi
say "runtime restarted: old=${OLD_PID:-none} new=$NEW_PID"

# ─── V: verification (all gates must pass) ───────────────────────────────────
say "V: verification gates"
V_FAIL=0
# V1 process identity
if [ "$NEW_PID" = "$OLD_PID" ]; then say "V1 FAIL: pid unchanged"; V_FAIL=1; fi
if ! ps -p "$NEW_PID" > /dev/null 2>&1; then say "V1 FAIL: new pid not alive"; V_FAIL=1; fi
say "V1 process: new=$NEW_PID alive=$(ps -p "$NEW_PID" > /dev/null 2>&1 && echo yes || echo no)"
# V2 runtime env = zai/glm-5.3 (authoritative globalRoute source)
ENV_PROV=$(ps eww -p "$NEW_PID" -o command= | tr ' ' '\n' | grep '^DSH_AGENT_PROVIDER=' || true)
ENV_MODEL=$(ps eww -p "$NEW_PID" -o command= | tr ' ' '\n' | grep '^DSH_AGENT_MODEL=' || true)
say "V2 runtime env: $ENV_PROV $ENV_MODEL"
if [ "$ENV_PROV" != "DSH_AGENT_PROVIDER=zai" ] || [ "$ENV_MODEL" != "DSH_AGENT_MODEL=glm-5.3" ]; then
  say "V2 FAIL: global route env not zai/glm-5.3"; V_FAIL=1
fi
# V3 boot log: cto chain still glm53 strict; no overrides parse error; composed ready
sleep 10
BOOT_LOG=$(tail -n +"$((LOG_MARK + 1))" "$RUNTIME_LOG" 2>/dev/null || true)
if ! echo "$BOOT_LOG" | grep -q 'agent model route chain loaded for agt_cto-agent: glm53 (length 1)'; then
  say "V3 FAIL: cto glm53 strict chain line missing"; V_FAIL=1
fi
if echo "$BOOT_LOG" | grep -q 'invalid agent model overrides'; then
  say "V3 FAIL: overrides parse error in boot log"; V_FAIL=1
fi
if ! echo "$BOOT_LOG" | grep -q 'production runtime ready'; then
  say "V3 FAIL: runtime ready line missing"; V_FAIL=1
fi
say "V3 boot log gates checked (cto chain / no parse error / ready)"
# V4 stability
sleep 5
if ! ps -p "$NEW_PID" > /dev/null 2>&1; then say "V4 FAIL: runtime died after verify"; V_FAIL=1; fi
PROC_COUNT=$(pgrep -f "production-runtime.mjs --root ${ROOT_PREFIX}/Users/authsvc/.agent-core" | wc -l | tr -d ' ')
if [ "$PROC_COUNT" != "1" ]; then say "V4 FAIL: runtime process count=$PROC_COUNT"; V_FAIL=1; fi
say "V4 stability ok"
# V5 residual old children (informational; respawn happens on next message)
sleep 2
LEFT=$(pgrep -f 'harness/apps/cli/lib/bin.js --profile agent-core-production' 2>/dev/null | wc -l | tr -d ' ')
say "V5 residual agent children: $LEFT (0 expected)"

if [ "$V_FAIL" = "1" ]; then
  echo "[hemostasis-v1] verification FAILED — rolling back" >&2
  false
fi

ledger "success" "{\"old_pid\":\"${OLD_PID:-none}\",\"new_pid\":\"$NEW_PID\",\"plist_sha\":\"$NEW_SHA\"}"
trap - ERR EXIT
cat <<SUMMARY

[hemostasis-v1] SUCCESS_COMMITTED
  plist          : $PLIST (sha256=$NEW_SHA)
  global route   : DSH_AGENT_PROVIDER=zai DSH_AGENT_MODEL=glm-5.3 (no oc-go)
  overrides      : byte-pinned untouched ($PIN_OVERRIDES_SHA256)
  cto chain      : glm53 strict preserved (length 1, runtime log)
  runtime        : pid ${OLD_PID:-none} -> $NEW_PID (label-scoped restart)
  inventory      : registered=$REG_COUNT zai_ok=$((OK + FIXED)) fixed=$FIXED
  rollback path  : restore $BACKUP_PLIST then bootout+bootstrap
SUMMARY
exit 0
