#!/bin/bash
# =============================================================================
# run-agt-cto-hotstandby-activation-v1.sh — AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_
# ACTIVATION_V2 production hot-standby activation (TASK_NAME = 热备 执行).
#
# Owner command (interactive, no arguments):
#   sudo bash /tmp/run-agt-cto-hotstandby-activation-v1.sh
#
# Sequence (Activation V2 CTR-V2-004 order, compressed into one Owner run):
#   G0..G6  zero-write preflight (identity / authority / ARCH / clean source /
#           production state / interactive confirm)
#   W1      clean x64 Harness install + honest .source-stamp (GATE-5)
#   W2      deploy the merged cold-backup code closure (5 files, main e2e1e22)
#   W3      controlled restart on still-strict config + health
#   W4      atomically write target v2 config (glm53 primary + luna fallback)
#   W5      production canary A / B / C / D + final clean GLM turn
#   RB*     any failure after the first write => full rollback + strict restore
#
# ARCH GATE CONTRACT (Owner directive 2026-08-30):
#   Host hardware is Apple Silicon (uname -m = arm64) BY DESIGN; the trusted
#   production runtime is x86_64 Node v25.6.1 under Rosetta. `uname -m` is
#   NEVER a gate input. The gate proves, in order:
#     1. trusted Node binary is Mach-O x86_64          (file -b)
#     2. that binary reports process.arch = x64        (self-report)
#     3. every darwin Mach-O *.node addon in the clean
#        source AND the installed harness is x86_64 or
#        universal (an arm64-only darwin addon = FAIL —
#        the harness.arm64-broken-20260828 failure mode)
#     4. functional proof: the harness CLI boots under
#        the trusted node and reports 0.1.0-rc.8
#   uname -m is recorded as INFORMATIONAL ONLY.
# =============================================================================
set -Eeuo pipefail

# ---- pinned constants --------------------------------------------------------
AGENT_ID="agt_cto-agent"
TRUSTED_ROOT="/usr/local/libexec/agent-core"
HARNESS_DIR="$TRUSTED_ROOT/harness"
NODE_BIN="$TRUSTED_ROOT/node-runtime/bin/node"
APP_PKGS="$TRUSTED_ROOT/app/packages"
PROD_ROOT="/Users/authsvc/.agent-core"
OVERRIDES_FILE="$PROD_ROOT/agent-model-overrides.json"
RUNTIME_LOG="$PROD_ROOT/logs/runtime.log"
RUNTIME_ERR="$PROD_ROOT/logs/runtime.err.log"
SERVICE="system/ai.agent-core.runtime"
BASE_URL="http://127.0.0.1:8790"
HEALTH_URL="$BASE_URL/health"

REPO_PIN="/Users/yanfenma/workspace/project/dsh-agent-core"
REPO_OWNER_NAME="yanfenma"
REPO_OWNER_UID="502"
CLEAN_SRC="/Users/yanfenma/workspace/github/deepseek-harness-clean-coldbackup-514ab7b"

MAIN_PIN="e2e1e22efabe99896bc0f83e02ac5e93d2c97f8d"
COLD_BACKUP_MERGE="b53ebd6"          # PR #111 (impl/luna-cold-backup-v2) merge
SPEC_PATH="docs/specs/AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2.md"

DSH_VERSION_PIN="0.1.0-rc.8"
DSH_COMMIT_PIN="514ab7b0029141b88c807704764d0d3e1eea1da4"
NODE_VERSION_PIN="v25.6.1"
TRACKED_FILES_PIN=7817               # evidence-derived count; mismatch => warn+record

OVERRIDES_STRICT_SHA="b9d301a7ef2e2e659357b2099d748402fcbefa4f3cab9a849a8b10a4d3708551"
PROXY_HTTP="http://127.0.0.1:7890"   # AGENT_CORE_CHATGPT_SUBSCRIPTION_TARGET_PROXY_SEAM_V1 frozen values
PROXY_NO_PROXY="localhost,127.0.0.1,::1"

# merged cold-backup code closure (deploy set; tests stay in the repo)
CLOSURE_FILES=(
  "packages/agent-router/src/route-chain.js"
  "packages/agent-router/src/route-chain-canary.js"
  "packages/agent-router/src/index.js"
  "packages/agent-router/src/ingress-delivery.js"
  "packages/production-runtime/src/compose.js"
)

AUTHSVC_UID=505
AUTHSVC_GID=601
CONFIRM_PHRASE="APPLY AGT_CTO_HOTSTANDBY_ACTIVATION_V1"
MARKER_PREFIX="HOTSTANDBY-CANARY"

TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="/tmp/agt-cto-hotstandby-activation-v1-${TS}-$$.log"
EVDIR="/tmp/hotstandby-activation-evidence-${TS}-$$"
BACKUP_DIR="$TRUSTED_ROOT/.deploy-backups/hotstandby-v1-${TS}-$$"
HARNESS_BACKUP=""                    # set at W1
HARNESS_INSTALLED_BY_US=0
APP_BACKUPS=()
OVERRIDES_BACKUP=""
WRITES_STARTED=0
ROLLBACK_ACTIVE=0
SUCCESS=0
RUNTIME_PID_OLD=""
RUNTIME_PID_NEW=""
LOG_SIZE_AT_START=0
ERR_SIZE_AT_START=0
LOG_MARKS=()                         # (name,byteoffset) pairs for journal windows
SENDER_OPENID=""
SENDER_PROVENANCE=""

exec > >(tee -a "$LOG_FILE") 2>&1

log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
ok()  { printf '[%s] OK  %s\n' "$(date +%H:%M:%S)" "$*"; }
sha256_file() { /usr/bin/shasum -a 256 "$1" | awk '{print $1}'; }
service_pid() { /bin/launchctl print "$SERVICE" 2>/dev/null | awk '/^[[:space:]]*pid =/{print $3; exit}'; }

zero_write_exit() {
  trap - EXIT
  log "RESULT: PREFLIGHT_FAIL (ZERO WRITES) — $1"
  log "FINAL: FAILED_PRE_FLIGHT; WRITES=NONE; READY_FOR_OWNER_RUN=NO"
  exit 2
}

# Authority git queries run as the repository owner (uid 502); bare root git
# trips CVE-2022-24765 dubious-ownership (v6 recovery precedent).
git_as_owner() {
  /usr/bin/sudo -n -u "$REPO_OWNER_NAME" /usr/bin/git -C "$1" "${@:2}"
}

health_ok() {
  local body
  body="$(/usr/bin/curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)" || return 1
  printf '%s' "$body" | "$NODE_BIN" -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  try{const o=JSON.parse(s);process.exit(o.ok===true&&o.deliverReady===true?0:1)}
  catch{process.exit(1)}});'
}

log_size() { stat -f '%z' "$RUNTIME_LOG" 2>/dev/null || printf '0'; }
err_size() { stat -f '%z' "$RUNTIME_ERR" 2>/dev/null || printf '0'; }
mark_log() { LOG_MARKS+=("$1:$(log_size):$(err_size)"); }
# print appended runtime.log(+err) since mark <name>
log_since() {
  local mark="$1" m lo le
  m="$(printf '%s\n' "${LOG_MARKS[@]}" | awk -F: -v n="$mark" '$1==n{print $2":"$3; exit}')"
  lo="${m%%:*}"; le="${m##*:}"
  { tail -c +$((lo + 1)) "$RUNTIME_LOG" 2>/dev/null; tail -c +$((le + 1)) "$RUNTIME_ERR" 2>/dev/null; }
}

# summarize route-chain journal lines for an agent inside a log slice
journal_summary() {  # $1=slice file $2=agentId -> prints one JSON per entry
  "$NODE_BIN" -e '
const fs=require("fs");
const lines=fs.readFileSync(process.argv[1],"utf8").split("\n");
const agent=process.argv[2];
for(const line of lines){
  const i=line.indexOf("route-chain ");
  if(i<0)continue;
  try{const o=JSON.parse(line.slice(i+"route-chain ".length));
    if(o&&o.agentId===agent)
      console.log(JSON.stringify({kind:o.kind,attemptIndex:o.attemptIndex,route:o.route,failureClass:o.failureClass,finalRoute:o.finalRoute,finalOutcome:o.finalOutcome,totalRouteAttempts:o.totalRouteAttempts,primaryRoute:o.primaryRoute,fallbackActivated:o.fallbackActivated}));
  }catch{}
}' "$1" "$2" 2>/dev/null
}

# =============================================================================
# G0 — identity gates (zero writes)
# =============================================================================
[ "$(id -u)" = "0" ] || { echo "ERROR: run as root: sudo bash $0" >&2; exit 2; }
[ "$#" -eq 0 ] || zero_write_exit "no arguments allowed (owner command is: sudo bash $0)"
[ -t 0 ] || zero_write_exit "must run on a tty (interactive phrase required)"

log "AGT_CTO hot-standby activation v1 — preflight begins (log: $LOG_FILE)"

# G1 — repository + authority pins (read-only, as repo owner)
[ "$(cd "$REPO_PIN" && pwd -P)" = "$REPO_PIN" ] || zero_write_exit "repo realpath drift"
[ "$(stat -f '%u' "$REPO_PIN")" = "$REPO_OWNER_UID" ] || zero_write_exit "repo owner uid drift"
[ "$(id -u "$REPO_OWNER_NAME")" = "$REPO_OWNER_UID" ] || zero_write_exit "repo owner name/uid binding drift"
[ -d "$REPO_PIN/.git" ] && [ ! -L "$REPO_PIN/.git" ] || zero_write_exit "repo .git missing or symlinked"
[ "$(git_as_owner "$REPO_PIN" rev-parse refs/remotes/github/main)" = "$MAIN_PIN" ] \
  || zero_write_exit "github/main != MAIN_PIN $MAIN_PIN (fetch first; refusing stale-tree deploy)"
git_as_owner "$REPO_PIN" merge-base --is-ancestor "$COLD_BACKUP_MERGE" "$MAIN_PIN" \
  || zero_write_exit "cold-backup merge $COLD_BACKUP_MERGE not ancestor of MAIN_PIN"
git_as_owner "$REPO_PIN" show "${MAIN_PIN}:${SPEC_PATH}" | grep -q '^spec_id: AGT_CTO_AGENT_ORDERED_ROUTE_CHAIN_ACTIVATION_V2' \
  || zero_write_exit "spec id mismatch at MAIN_PIN"
git_as_owner "$REPO_PIN" show "${MAIN_PIN}:${SPEC_PATH}" | grep -q '^status: accepted' \
  || zero_write_exit "activation spec not accepted at MAIN_PIN"
git_as_owner "$REPO_PIN" show "${MAIN_PIN}:${SPEC_PATH}" | grep -q '^production_apply_authority: contracts' \
  || zero_write_exit "activation spec has no production apply authority"
SPEC_BLOB_LIVE="$(git_as_owner "$REPO_PIN" rev-parse "${MAIN_PIN}:${SPEC_PATH}")"
ok "G1 authority: main=$MAIN_PIN spec=$SPEC_BLOB_LIVE (accepted, production_apply_authority: contracts)"

# =============================================================================
# G2 — ARCH GATE (corrected form; uname -m is INFORMATIONAL ONLY)
# =============================================================================
UNAME_M="$(/usr/bin/uname -m)"
log "G2 arch gate: host uname -m = $UNAME_M (informational only — Rosetta host; NEVER a gate input)"

NODE_DESC="$(/usr/bin/file -b "$NODE_BIN")"
case "$NODE_DESC" in
  *x86_64*) ok "G2.1 trusted node binary is Mach-O x86_64 ($NODE_BIN)" ;;
  *) zero_write_exit "trusted node binary is NOT x86_64: file -b => $NODE_DESC" ;;
esac
[ "$("$NODE_BIN" -p 'process.arch')" = "x64" ] \
  || zero_write_exit "trusted node self-reports process.arch != x64"
[ "$("$NODE_BIN" -p 'process.version')" = "$NODE_VERSION_PIN" ] \
  || zero_write_exit "trusted node version != $NODE_VERSION_PIN"
[ "$("$NODE_BIN" -p 'process.platform')" = "darwin" ] \
  || zero_write_exit "trusted node platform != darwin"
ok "G2.2 trusted node runtime: $NODE_VERSION_PIN darwin x64 (process.arch=x64)"

# every LOADABLE darwin addon under a root must be x86_64 or universal.
# Two shapes exist:
#   (a) arch-flavor packages (lightningcss-darwin-x64, sharp, koffi, fsevents…):
#       chosen by the INSTALL arch — must be x86_64/universal; an arm64-only
#       one here is the harness.arm64-broken failure mode => FAIL;
#   (b) multi-platform prebuild menus (node-pty prebuilds/darwin-x64|darwin-arm64|
#       linux-*|win32-*): only the CURRENT runtime tuple (darwin-x64) is ever
#       loaded by the x64 node; sibling menu entries for other tuples are
#       dormant (same class as PE/ELF) => ignored.
addon_arch_check() {  # $1=label $2=root  -> return 1 on an arm64-only LOADABLE addon
  local bad=""
  while IFS= read -r -d '' f; do
    local d; d="$(/usr/bin/file -b "$f")"
    case "$d" in
      *Mach-O*) ;;
      *) continue ;;                                # PE/ELF prebuild menu files: dormant
    esac
    case "$f" in
      */prebuilds/*)
        case "$f" in
          */prebuilds/darwin-x64/*) ;;              # current runtime tuple: check it
          *) continue ;;                            # other tuples: dormant menu entries
        esac ;;
    esac
    case "$d" in
      *x86_64*) ;;                                  # x86_64 or universal slice: OK
      *Mach-O*) bad="${bad:+$bad
}$f => $d" ;;
    esac
  done < <(find "$2" -type f -name '*.node' -print0 2>/dev/null)
  if [ -n "$bad" ]; then
    log "G2.3 FAIL ($1): arm64-only loadable darwin addons found:"
    printf '%s\n' "$bad" | head -10
    return 1
  fi
  return 0
}
addon_arch_check "clean source node_modules" "$CLEAN_SRC/node_modules" \
  || zero_write_exit "clean harness source carries arm64-only darwin addons"
ok "G2.3 clean-source addons: every darwin Mach-O *.node is x86_64 or universal"
CLEAN_VERSION_OUT="$(cd "$CLEAN_SRC" && "$NODE_BIN" apps/cli/lib/bin.js --version 2>&1)" \
  || zero_write_exit "clean harness CLI failed to boot under trusted x64 node"
[ "$CLEAN_VERSION_OUT" = "$DSH_VERSION_PIN" ] \
  || zero_write_exit "clean harness CLI --version => '$CLEAN_VERSION_OUT' != $DSH_VERSION_PIN"
ok "G2.4 functional Rosetta proof: clean CLI boots under trusted node => $CLEAN_VERSION_OUT"

# =============================================================================
# G3 — clean harness source gates (read-only)
# =============================================================================
[ "$(git_as_owner "$CLEAN_SRC" rev-parse HEAD)" = "$DSH_COMMIT_PIN" ] \
  || zero_write_exit "clean harness source HEAD != $DSH_COMMIT_PIN"
[ -z "$(git_as_owner "$CLEAN_SRC" status --porcelain)" ] \
  || zero_write_exit "clean harness source tree is DIRTY (refusing: stamp would be dishonest)"
[ -f "$CLEAN_SRC/apps/cli/lib/bin.js" ] || zero_write_exit "clean harness has no built CLI"
CLEAN_PKG_VERSION="$(/usr/bin/sudo -n -u "$REPO_OWNER_NAME" /usr/bin/plutil -extract version raw -o - "$CLEAN_SRC/package.json" 2>/dev/null || git_as_owner "$CLEAN_SRC" show HEAD:package.json | /usr/bin/grep -o '"version": *"[^"]*"' | head -1 | sed 's/.*"\(.*\)"$/\1/')"
[ "$CLEAN_PKG_VERSION" = "$DSH_VERSION_PIN" ] \
  || zero_write_exit "clean harness package.json version '$CLEAN_PKG_VERSION' != $DSH_VERSION_PIN"
TRACKED_COUNT="$(git_as_owner "$CLEAN_SRC" ls-files | wc -l | tr -d ' ')"
log "G3 clean source: HEAD=$DSH_COMMIT_PIN clean, built CLI present, tracked files=$TRACKED_COUNT (pin $TRACKED_FILES_PIN)"
[ "$TRACKED_COUNT" = "$TRACKED_FILES_PIN" ] || log "  NOTE: tracked count differs from evidence pin (recorded; comparison below is authoritative)"

# =============================================================================
# G4 — production state gates (read-only)
# =============================================================================
RUNTIME_PID_OLD="$(service_pid)"
[ -n "$RUNTIME_PID_OLD" ] || zero_write_exit "runtime service has no live pid"
health_ok || zero_write_exit "runtime health not ok at $HEALTH_URL"
[ -x "$NODE_BIN" ] && [ ! -L "$NODE_BIN" ] || zero_write_exit "trusted node missing or symlinked"
[ -f "$RUNTIME_LOG" ] || zero_write_exit "runtime log missing: $RUNTIME_LOG"
mark_log "start"

if [ -e "$OVERRIDES_FILE" ]; then
  OVERRIDES_NOW_SHA="$(sha256_file "$OVERRIDES_FILE")"
  if [ "$OVERRIDES_NOW_SHA" != "$OVERRIDES_STRICT_SHA" ]; then
    if "$NODE_BIN" -e '
const fs=require("fs");
const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const t=o?.overrides?.["agt_cto-agent"]?.model;
process.exit(t&&t.primary==="glm53"&&Array.isArray(t.fallbacks)&&t.fallbacks.length===1&&t.fallbacks[0]==="luna"&&o?.routeCatalog?.luna?0:1);' "$OVERRIDES_FILE" 2>/dev/null; then
      log "G4 overrides: ALREADY at v2 target (glm53+[luna]) — W4 will verify only"
    else
      zero_write_exit "overrides file is neither the pinned strict baseline nor the v2 target (sha $OVERRIDES_NOW_SHA)"
    fi
  fi
else
  zero_write_exit "overrides file missing: $OVERRIDES_FILE"
fi

# app closure before-state: model-overrides.js must already equal main; the 4
# other files are recorded (their before blobs become the rollback manifest)
git_as_owner "$REPO_PIN" show "${MAIN_PIN}:packages/production-runtime/src/model-overrides.js" \
  | cmp -s - "$APP_PKGS/production-runtime/src/model-overrides.js" \
  || zero_write_exit "deployed model-overrides.js != main blob (unexpected drift; blocked)"
APP_DEPLOY_NEEDED=0
for rel in "${CLOSURE_FILES[@]}"; do
  if ! git_as_owner "$REPO_PIN" show "${MAIN_PIN}:${rel}" | cmp -s - "$APP_PKGS/${rel#packages/}" 2>/dev/null; then
    APP_DEPLOY_NEEDED=$((APP_DEPLOY_NEEDED + 1))
  fi
done
log "G4 app closure: $APP_DEPLOY_NEEDED of ${#CLOSURE_FILES[@]} files differ from main (deploy set)"

# harness identity state
HARNESS_PHASE_NEEDED=1
if [ -f "$HARNESS_DIR/.source-stamp" ]; then
  if "$NODE_BIN" -e '
const fs=require("fs");
const s=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(s.commit===process.argv[2]&&s.dirtyCount===0?0:1);' "$HARNESS_DIR/.source-stamp" "$DSH_COMMIT_PIN" 2>/dev/null; then
    HARNESS_PHASE_NEEDED=0
    log "G4 harness: .source-stamp already {commit:$DSH_COMMIT_PIN,dirtyCount:0} — W1 will re-verify tree only"
  fi
fi

# luna assets (metadata only; NEVER read token bytes)
DSH_CODEX_PKG="$PROD_ROOT/homes/$AGENT_ID/profiles/node_modules/dsh-codex/package.json"
[ -f "$DSH_CODEX_PKG" ] || zero_write_exit "dsh-codex package missing at home profile"
"$NODE_BIN" -e 'const p=require(process.argv[1]);process.exit(p.version===process.argv[2]?0:1)' "$DSH_CODEX_PKG" "0.2.3" \
  || zero_write_exit "dsh-codex version != 0.2.3"
OAUTH_FILE="$PROD_ROOT/homes/$AGENT_ID/.openai-codex-auth.json"
[ "$(stat -f '%HT' "$OAUTH_FILE" 2>/dev/null)" = "Regular File" ] \
  || zero_write_exit "luna OAuth file missing or not a regular file (metadata only checked)"
[ "$(stat -f '%u' "$OAUTH_FILE")" = "502" ] && [ "$(stat -f '%Lp' "$OAUTH_FILE")" = "600" ] \
  || zero_write_exit "luna OAuth metadata drift (uid/mode)"
ok "G4 luna assets: dsh-codex@0.2.3 present; OAuth stat uid502/0600 (content never read)"

# injection seam must start absent
[ ! -e "$PROD_ROOT/route-chain-canary-injection.json" ] || zero_write_exit "pre-existing canary descriptor present (unexpected)"
find "$PROD_ROOT" -maxdepth 1 -name 'route-chain-canary-injection.used.*' | grep -q . \
  && zero_write_exit "pre-existing used canary markers present" || true

# disk headroom for the second harness tree (856M source + margin)
FREE_KB="$(df -k /usr/local | awk 'NR==2{print $4}')"
[ "$FREE_KB" -gt 3000000 ] || zero_write_exit "less than 3GB free on /usr/local"
ok "G4 production: pid=$RUNTIME_PID_OLD healthy; disk ${FREE_KB}kB free; injection absent; overrides pinned"

# =============================================================================
# G5 — Owner sender id resolution (read-only extraction, interactive confirm)
# =============================================================================
SENDER_CANDIDATES="$( { grep -oE 'sender=ou_[A-Za-z0-9]+' "$RUNTIME_LOG" 2>/dev/null | tail -200; } | sed 's/sender=//' | sort -u | tail -5 )"
if [ -n "$SENDER_CANDIDATES" ]; then
  log "G5 recent feishu sender ids observed in runtime.log (authenticated ingress):"
  printf '%s\n' "$SENDER_CANDIDATES" | sed 's/^/    /'
fi
DEFAULT_SENDER="$(printf '%s\n' "$SENDER_CANDIDATES" | tail -1)"
printf '\n'
log "========== OWNER CONFIRMATION =========="
log "Target: $AGENT_ID  primary=glm53  fallbacks=[luna]"
log "Harness: clean $DSH_VERSION_PIN @ $DSH_COMMIT_PIN from $CLEAN_SRC (x64)"
log "Code: merged cold-backup closure (5 files) from main $MAIN_PIN"
log "providerEnv(luna): HTTP_PROXY=$PROXY_HTTP HTTPS_PROXY=$PROXY_HTTP NO_PROXY=$PROXY_NO_PROXY NODE_USE_ENV_PROXY=1"
log "Maintenance window: runtime restart (all resident agents respawn on next message)"
log "Canary: A clean primary / B one controlled quota fallback (ONE real Luna call) / C outcome_unknown STOP / D aggregates; final clean GLM turn"
log "During the canary, do NOT chat with $AGENT_ID outside the printed markers."
printf 'Owner feishu openId binding for the canary markers\n'
if [ -n "$DEFAULT_SENDER" ]; then
  printf '  press Enter to use the most recent authenticated sender [%s]\n  or paste the exact ou_ id: ' "$DEFAULT_SENDER"
else
  printf '  no authenticated sender found in the log — paste the Owner ou_ id now: '
fi
IFS= read -r SENDER_REPLY
if [ -n "${SENDER_REPLY:-}" ]; then SENDER_OPENID="$SENDER_REPLY"; SENDER_PROVENANCE="owner-pasted";
else SENDER_OPENID="$DEFAULT_SENDER"; SENDER_PROVENANCE="runtime.log-extracted"; fi
[ -n "$SENDER_OPENID" ] || zero_write_exit "no sender openId resolved (send any message to the agent chat, rerun)"
printf '%s' "$SENDER_OPENID" | grep -qE '^ou_[A-Za-z0-9]+$' || zero_write_exit "sender openId malformed: $SENDER_OPENID"
log "G5 canary binding senderOpenId = $SENDER_OPENID ($SENDER_PROVENANCE) — a wrong id is SAFE (binding mismatch => zero-effect descriptor)"

printf '\nTYPE THE EXACT PHRASE TO APPLY: %s\n' "$CONFIRM_PHRASE"
PHRASE_TRIES=0
while :; do
  PHRASE_TRIES=$((PHRASE_TRIES + 1))
  [ "$PHRASE_TRIES" -le 3 ] || zero_write_exit "too many wrong phrases"
  printf 'phrase> '
  IFS= read -r PHRASE
  [ "$PHRASE" = "$CONFIRM_PHRASE" ] && break
  log "  phrase mismatch (attempt $PHRASE_TRIES)"
done

mkdir -p "$EVDIR"
printf '%s\n' "$SENDER_OPENID" > "$EVDIR/sender-openid.txt"
log "PREFLIGHT COMPLETE — writes begin (evidence: $EVDIR)"

# =============================================================================
# rollback engine
# =============================================================================
rollback() {
  [ "$ROLLBACK_ACTIVE" = "1" ] && return 0
  ROLLBACK_ACTIVE=1
  trap - ERR EXIT
  log "ROLLBACK begins — restoring pre-deployment state"
  local bad="" anything_changed=0
  [ "$HARNESS_INSTALLED_BY_US" = "1" ] && anything_changed=1
  [ "${#APP_BACKUPS[@]}" -gt 0 ] && anything_changed=1
  [ -n "$OVERRIDES_BACKUP" ] && anything_changed=1
  # RB1 restore overrides (strict) if we replaced it
  if [ -n "$OVERRIDES_BACKUP" ] && [ -f "$OVERRIDES_BACKUP" ]; then
    /bin/cp -p "$OVERRIDES_BACKUP" "$OVERRIDES_FILE" \
      && [ "$(sha256_file "$OVERRIDES_FILE")" = "$OVERRIDES_STRICT_SHA" ] \
      && log "RB1 overrides restored to strict baseline" || bad="${bad} overrides-restore"
  else
    log "RB1 overrides untouched by this run"
  fi
  # RB2 restore app closure files from backup
  local app_bad=0
  for pair in "${APP_BACKUPS[@]}"; do
    local rel="${pair%%|*}" bak="${pair##*|}"
    if [ -f "$bak" ]; then
      /bin/cp -p "$bak" "$APP_PKGS/${rel#packages/}" || app_bad=1
    elif [ "$bak" = "NEWFILE" ]; then
      rm -f -- "$APP_PKGS/${rel#packages/}"
    else
      app_bad=1
    fi
  done
  if [ "$app_bad" = "0" ]; then log "RB2 app closure restored from backup"; else bad="${bad} app-closure-restore"; fi
  # RB3 restore harness tree
  if [ "$HARNESS_INSTALLED_BY_US" = "1" ] && [ -n "$HARNESS_BACKUP" ] && [ -d "$HARNESS_BACKUP" ]; then
    rm -rf -- "$HARNESS_DIR" \
      && mv "$HARNESS_BACKUP" "$HARNESS_DIR" \
      && log "RB3 harness tree restored from $HARNESS_BACKUP" || bad="${bad} harness-restore"
  else
    log "RB3 harness tree was not replaced by this run"
  fi
  # RB4 clear canary injections
  rm -f -- "$PROD_ROOT/route-chain-canary-injection.json" \
         "$PROD_ROOT/route-chain-canary-injection.used."* \
         "$PROD_ROOT/route-chain-canary-injection.tmp."* 2>/dev/null || true
  [ ! -e "$PROD_ROOT/route-chain-canary-injection.json" ] || bad="${bad} injection-clear"
  if [ "$anything_changed" = "0" ]; then
    log "ROLLBACK_COMPLETE — nothing had been changed by this run (zero-write rollback; no restart)"
    log "FINAL: ROLLED_BACK; SUCCESS=NO; state=unchanged; evidence=$EVDIR"
    exit 1
  fi
  # RB5 controlled restart back onto strict config + health
  /bin/launchctl kickstart -k "$SERVICE" 2>/dev/null || bad="${bad} restart"
  local waited=0 newpid=""
  while [ "$waited" -lt 90 ]; do
    if health_ok; then newpid="$(service_pid)"; [ -n "$newpid" ] && break; fi
    sleep 2; waited=$((waited + 2))
  done
  if [ -n "$newpid" ]; then log "RB5 runtime healthy again (pid $newpid)"; else bad="${bad} health"; fi
  if [ "$(sha256_file "$OVERRIDES_FILE" 2>/dev/null)" = "$OVERRIDES_STRICT_SHA" ]; then
    log "RB5 strict config verified (sha == pinned strict baseline)"
  else
    bad="${bad} strict-verify"
  fi
  if [ -z "$bad" ]; then
    log "ROLLBACK_COMPLETE — production restored to pre-deployment strict state"
    log "FINAL: ROLLED_BACK; SUCCESS=NO; state=strict-glm53; evidence=$EVDIR"
    exit 1
  fi
  log "ROLLBACK_INCOMPLETE — UNRESTORED_STATE:${bad}"
  log "FINAL: ROLLBACK_INCOMPLETE; SUCCESS=NO; UNRESTORED_STATE:${bad}; evidence=$EVDIR — manual intervention required"
  exit 4
}
err_handler() { log "UNEXPECTED ERROR (line $1) — entering rollback"; rollback; }
exit_handler() {
  local rc=$?
  [ "$SUCCESS" = "1" ] && exit "$rc"
  [ "$WRITES_STARTED" = "0" ] && exit "$rc"
  log "exit rc=$rc before success — entering rollback"
  rollback
}

# =============================================================================
# W1 — clean x64 Harness + honest .source-stamp
# =============================================================================
WRITES_STARTED=1
trap 'err_handler $LINENO' ERR
trap 'exit_handler' EXIT
trap 'log "INT received — aborting into rollback"; exit 130' INT
trap 'log "TERM received — aborting into rollback"; exit 143' TERM
mkdir -p "$BACKUP_DIR"
log "W1 harness phase begins (backup dir: $BACKUP_DIR)"

if [ "$HARNESS_PHASE_NEEDED" = "1" ]; then
  HARNESS_BACKUP="$TRUSTED_ROOT/harness.pre-hotstandby-${TS}-$$"
  mv "$HARNESS_DIR" "$HARNESS_BACKUP"
  # from this line on, any failure must restore the displaced original tree
  HARNESS_INSTALLED_BY_US=1
  mkdir -p "$HARNESS_DIR"
  # tar-copy the clean x64 checkout: real files (cross-tree hardlinks break),
  # .git excluded (git identity precedence must stay unavailable => stamp path)
  tar -C "$CLEAN_SRC" -cf - \
    --exclude='./.git' \
    --exclude='./.DS_Store' \
    --exclude='./apps/cli/lib/dump-config-*.js' \
    --exclude='./apps/cli/lib/plugin-*.js' \
    --exclude='./apps/cli/lib/profile-boot-*.js' \
    . | tar -C "$HARNESS_DIR" -xf -
  /usr/sbin/chown -R "${AUTHSVC_UID}:${AUTHSVC_GID}" "$HARNESS_DIR"
  /bin/chmod -R u+rwX,go+rX,go-w "$HARNESS_DIR"
  ok "W1 clean harness installed from $CLEAN_SRC (x64 tree, owner ${AUTHSVC_UID}:${AUTHSVC_GID})"
else
  log "W1 harness tree already clean-stamped — verifying tree only"
fi

# honest stamp prerequisite: EVERY tracked file byte-identical to the clean
# checkout; dirtyCount:0 without this proof would be forgery (CTR-V2-001)
DIRTY_COUNT=0
MISSING_COUNT=0
while IFS= read -r f; do
  if [ ! -f "$HARNESS_DIR/$f" ]; then MISSING_COUNT=$((MISSING_COUNT + 1));
  elif ! cmp -s "$CLEAN_SRC/$f" "$HARNESS_DIR/$f"; then DIRTY_COUNT=$((DIRTY_COUNT + 1)); fi
done < <(git_as_owner "$CLEAN_SRC" ls-files)
log "W1 tree comparison: tracked=$TRACKED_COUNT dirty=$DIRTY_COUNT missing=$MISSING_COUNT"
if [ "$DIRTY_COUNT" != "0" ] || [ "$MISSING_COUNT" != "0" ]; then
  log "W1 FAIL: installed harness tree is not byte-identical to $DSH_COMMIT_PIN"
  rollback
fi
[ ! -e "$HARNESS_DIR/.git" ] || { log "W1 FAIL: .git present in installed harness (git precedence would bypass the stamp)"; rollback; }

# honest .source-stamp (exact {commit,dirtyCount} key set; dirtyCount=0 proven above)
STAMP_TMP="$HARNESS_DIR/.source-stamp.tmp.$$"
printf '{\n  "commit": "%s",\n  "dirtyCount": 0\n}\n' "$DSH_COMMIT_PIN" > "$STAMP_TMP"
/bin/chmod 644 "$STAMP_TMP"
/usr/sbin/chown "${AUTHSVC_UID}:${AUTHSVC_GID}" "$STAMP_TMP"
/bin/mv "$STAMP_TMP" "$HARNESS_DIR/.source-stamp"
ok "W1 .source-stamp written: {commit:$DSH_COMMIT_PIN, dirtyCount:0} (proven honest by the byte comparison above)"

# installed-tree addon arch re-verification + functional boot + identity read
addon_arch_check "installed harness" "$HARNESS_DIR/node_modules" \
  || { log "W1 FAIL: installed tree carries arm64-only darwin addons"; rollback; }
INSTALLED_VERSION="$(/usr/bin/sudo -n -u "#${AUTHSVC_UID}" "$NODE_BIN" "$HARNESS_DIR/apps/cli/lib/bin.js" --version 2>&1)" \
  || { log "W1 FAIL: installed CLI failed to boot as authsvc: $INSTALLED_VERSION"; rollback; }
[ "$INSTALLED_VERSION" = "$DSH_VERSION_PIN" ] \
  || { log "W1 FAIL: installed CLI --version => '$INSTALLED_VERSION'"; rollback; }
IDENTITY_OUT="$("$NODE_BIN" -e '
import("/usr/local/libexec/agent-core/app/packages/agent-provisioning/src/index.js")
  .then((m) => console.log(JSON.stringify(m.readHarnessIdentity(process.argv[1]))))
  .catch((e) => { console.error(String(e?.code ?? e)); process.exit(1) });' "$HARNESS_DIR" 2>&1)" \
  || { log "W1 FAIL: readHarnessIdentity => $IDENTITY_OUT"; rollback; }
log "W1 readHarnessIdentity => $IDENTITY_OUT"
printf '%s' "$IDENTITY_OUT" | grep -q "\"commit\":\"$DSH_COMMIT_PIN\"" \
  || { log "W1 FAIL: identity commit mismatch"; rollback; }
printf '%s' "$IDENTITY_OUT" | grep -q "\"version\":\"$DSH_VERSION_PIN\"" \
  || { log "W1 FAIL: identity version mismatch"; rollback; }
printf '%s\n' "$IDENTITY_OUT" > "$EVDIR/harness-identity.json"
ok "W1 GATE-5 HARNESS_IDENTITY: PASS (clean x64 harness + trusted stamp identity)"

# =============================================================================
# W2 — deploy merged cold-backup code closure (git show from MAIN_PIN only)
# =============================================================================
: > "$EVDIR/path-blob-manifest.txt"
for rel in "${CLOSURE_FILES[@]}"; do
  dest="$APP_PKGS/${rel#packages/}"
  git_as_owner "$REPO_PIN" show "${MAIN_PIN}:${rel}" > "$EVDIR/blob-$(echo "$rel" | tr '/' '_')"
  if cmp -s "$EVDIR/blob-$(echo "$rel" | tr '/' '_')" "$dest" 2>/dev/null; then
    printf '%s BEFORE==AFTER(main) sha=%s\n' "$rel" "$(sha256_file "$dest")" >> "$EVDIR/path-blob-manifest.txt"
    log "W2 $rel already at main blob (skip)"
    continue
  fi
  if [ -f "$dest" ]; then
    bak="$BACKUP_DIR/$(echo "$rel" | tr '/' '_')"
    /bin/cp -p "$dest" "$bak"
    APP_BACKUPS+=("$rel|$bak")
    dest_owner="$(stat -f '%u:%g' "$dest")"; dest_mode="$(stat -f '%Lp' "$dest")"
    before_sha="$(sha256_file "$dest")"
  else
    APP_BACKUPS+=("$rel|NEWFILE")
    sibling="$APP_PKGS/agent-router/src/route-chain.js"
    dest_owner="$(stat -f '%u:%g' "$sibling")"; dest_mode="$(stat -f '%Lp' "$sibling")"
    before_sha="(absent)"
  fi
  tmp="${dest}.hotstandby-tmp.$$"
  /bin/cp "$EVDIR/blob-$(echo "$rel" | tr '/' '_')" "$tmp"
  /usr/sbin/chown "$dest_owner" "$tmp"; /bin/chmod "$dest_mode" "$tmp"
  /bin/mv "$tmp" "$dest"
  after_sha="$(sha256_file "$dest")"
  blob_sha="$(git_as_owner "$REPO_PIN" rev-parse "${MAIN_PIN}:${rel}")"
  printf '%s before=%s after=%s(main-blob %s) owner=%s mode=%s\n' \
    "$rel" "$before_sha" "$after_sha" "$blob_sha" "$dest_owner" "$dest_mode" >> "$EVDIR/path-blob-manifest.txt"
  ok "W2 deployed $rel (owner $dest_owner mode $dest_mode)"
done
# after-set verification: all 5 == main blobs
for rel in "${CLOSURE_FILES[@]}"; do
  git_as_owner "$REPO_PIN" show "${MAIN_PIN}:${rel}" | cmp -s - "$APP_PKGS/${rel#packages/}" \
    || { log "W2 FAIL after-set mismatch at $rel"; rollback; }
done
ok "W2 merged cold-backup closure live: ${#CLOSURE_FILES[@]}/${#CLOSURE_FILES[@]} == main $MAIN_PIN"

# =============================================================================
# W3 — controlled restart on still-strict config
# =============================================================================
OVERRIDES_PRE_RESTART="$(sha256_file "$OVERRIDES_FILE")"
printf '\nW3 maintenance window: runtime restart now. Resident agents respawn on their next message.\n'
printf 'Confirm no agent task is mid-flight, then press Enter to restart... '
IFS= read -r _
mark_log "w3"
/bin/launchctl kickstart -k "$SERVICE"
waited=0
while [ "$waited" -lt 180 ]; do
  if health_ok; then RUNTIME_PID_NEW="$(service_pid)"; [ -n "$RUNTIME_PID_NEW" ] && [ "$RUNTIME_PID_NEW" != "$RUNTIME_PID_OLD" ] && break; fi
  sleep 2; waited=$((waited + 2))
done
[ -n "${RUNTIME_PID_NEW:-}" ] && [ "$RUNTIME_PID_NEW" != "$RUNTIME_PID_OLD" ] \
  || { log "W3 FAIL: runtime did not come back healthy"; rollback; }
[ "$(sha256_file "$OVERRIDES_FILE")" = "$OVERRIDES_PRE_RESTART" ] \
  || { log "W3 FAIL: overrides changed across restart"; rollback; }
log_since "w3" > "$EVDIR/w3-restart.log.slice"
grep -q 'agent model route chain loaded for agt_cto-agent: glm53 (length 1)' "$EVDIR/w3-restart.log.slice" \
  || { log "W3 FAIL: strict chain boot line missing after restart (config must still be strict here)"; rollback; }
ok "W3 runtime restarted healthy: pid $RUNTIME_PID_OLD -> $RUNTIME_PID_NEW; strict config verified by boot line 'glm53 (length 1)'"

# =============================================================================
# W4 — atomically write target v2 config (glm53 + [luna])
# =============================================================================
if [ -f "$OVERRIDES_FILE" ] && [ "$(sha256_file "$OVERRIDES_FILE")" = "$OVERRIDES_STRICT_SHA" ]; then
  OVERRIDES_BACKUP="$BACKUP_DIR/agent-model-overrides.strict.json"
  /bin/cp -p "$OVERRIDES_FILE" "$OVERRIDES_BACKUP"
  TMP_OVR="$PROD_ROOT/agent-model-overrides.json.tmp.$$"
  "$NODE_BIN" -e '
const fs=require("fs");
const out={
  version:2,
  routeCatalog:{
    glm53:{routeKind:"builtin",provider:"zai",model:"glm-5.3",credentialReadiness:"zai-api-key-home"},
    luna:{routeKind:"subscription",provider:"openai-codex",model:"gpt-5.6-luna",plugin:"dsh-codex",pluginVersion:"0.2.3",
      credentialReadiness:"luna-oauth-home",
      providerEnv:{HTTP_PROXY:process.argv[1],HTTPS_PROXY:process.argv[1],NO_PROXY:process.argv[2],NODE_USE_ENV_PROXY:"1"}},
  },
  overrides:{"agt_cto-agent":{model:{primary:"glm53",fallbacks:["luna"]}}},
};
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2)+"\n");' \
    "$PROXY_HTTP" "$PROXY_NO_PROXY" "$TMP_OVR"
  /usr/sbin/chown "${AUTHSVC_UID}:${AUTHSVC_GID}" "$TMP_OVR"; /bin/chmod 644 "$TMP_OVR"
  /bin/mv "$TMP_OVR" "$OVERRIDES_FILE"
  ok "W4 v2 config written atomically (owner ${AUTHSVC_UID}:${AUTHSVC_GID}, mode 644)"
else
  log "W4 overrides already at target — loader read-back only"
fi
# loader read-back through the DEPLOYED loader (fail-loud validation)
READBACK="$("$NODE_BIN" -e '
import("/usr/local/libexec/agent-core/app/packages/production-runtime/src/model-overrides.js").then((m)=>{
  const l=m.loadAgentModelOverrides(process.argv[1],["agt_cto-agent"]);
  const c=l.resolveChain("agt_cto-agent",{provider:"zai",model:"glm-5.3"});
  console.log(JSON.stringify({len:c.routes.length,r0:c.routes[0].routeRef,r1:c.routes[1]?.routeRef,
    sub:c.routes[1]?.processConfig?.subscription?.dshCommit,
    env:Object.keys(c.routes[1]?.processConfig?.providerEnv??{}).sort().join(",")}));
}).catch((e)=>{console.error(String(e?.code??e));process.exit(1)});' "$OVERRIDES_FILE" 2>&1)" \
  || { log "W4 FAIL loader read-back: $READBACK"; rollback; }
log "W4 loader read-back => $READBACK"
printf '%s' "$READBACK" | grep -q '"len":2,"r0":"glm53","r1":"luna"' \
  || { log "W4 FAIL chain shape"; rollback; }
printf '%s' "$READBACK" | grep -q "\"$DSH_COMMIT_PIN\"" \
  || { log "W4 FAIL subscription dshCommit pin"; rollback; }
# no-secret scan (proxy hosts only; no tokens/keys)
grep -qE 'sk-[A-Za-z0-9]|API_KEY.*:|Bearer ' "$OVERRIDES_FILE" \
  && { log "W4 FAIL no-secret scan hit"; rollback; } || ok "W4 no-secret scan clean"

# =============================================================================
# W5 — production canary A/B/C/D + final clean GLM turn (§10.2)
# =============================================================================
gen_nonce() { /usr/bin/openssl rand -hex 12; }
new_marker() { printf '%s-%s-%s reply DONE only' "$MARKER_PREFIX" "$1" "$(gen_nonce)"; }
utc_plus_minutes() { /bin/date -u -v+"$1"M +%Y-%m-%dT%H:%M:%SZ; }

install_descriptor() {  # $1=mode $2=marker $3=nonce
  local tmp exp
  exp="$(utc_plus_minutes 4)"
  tmp="$PROD_ROOT/route-chain-canary-injection.tmp.$$"
  "$NODE_BIN" -e '
const fs=require("fs");
fs.writeFileSync(process.argv[1],JSON.stringify({
  version:1,agentId:"agt_cto-agent",routeRef:"glm53",mode:process.argv[2],nonce:process.argv[3],
  expiresAt:process.argv[4],maxUses:1,
  binding:{channel:"feishu",senderOpenId:process.argv[5],marker:process.argv[6}},
}));' "$tmp" "$1" "$3" "$exp" "$SENDER_OPENID" "$2"
  /bin/chmod 600 "$tmp"
  /usr/sbin/chown "${AUTHSVC_UID}:${AUTHSVC_GID}" "$tmp"
  /bin/mv "$tmp" "$PROD_ROOT/route-chain-canary-injection.json"
  /usr/bin/sync
  # verify: lstat owner/mode + read-back exact values
  [ "$(stat -f '%u:%Lp' "$PROD_ROOT/route-chain-canary-injection.json")" = "${AUTHSVC_UID}:600" ] || return 1
  "$NODE_BIN" -e '
const fs=require("fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
process.exit(d.mode===process.argv[2]&&d.nonce===process.argv[3]&&d.binding.marker===process.argv[4]&&d.binding.senderOpenId===process.argv[5]&&d.maxUses===1?0:1);' \
    "$PROD_ROOT/route-chain-canary-injection.json" "$1" "$3" "$2" "$SENDER_OPENID" || return 1
}
clear_injection() {
  rm -f -- "$PROD_ROOT/route-chain-canary-injection.json" \
         "$PROD_ROOT/route-chain-canary-injection.used."* \
         "$PROD_ROOT/route-chain-canary-injection.tmp."* 2>/dev/null || true
  [ ! -e "$PROD_ROOT/route-chain-canary-injection.json" ] || return 1
  ! find "$PROD_ROOT" -maxdepth 1 -name 'route-chain-canary-injection.used.*' | grep -q . || return 1
}

# one canary case: prints marker, waits for Owner Enter, then slices the log
canary_turn() {  # $1=case-label $2=marker -> sets CASE_SLICE + expects Owner already replied
  mark_log "case-$1"
  printf '\n--- CANARY-%s ---\n' "$1"
  printf '在飞书向 %s 的会话发送这条消息(整条原文, 5分钟内):\n\n    %s\n\n' "$AGENT_ID" "$2"
  printf '等待业务回复到达后, 回到这里按 Enter...'
  IFS= read -r _
  log_since "case-$1" > "$EVDIR/case-$1.log.slice"
  CASE_SLICE="$EVDIR/case-$1.log.slice"
  journal_summary "$CASE_SLICE" "$AGENT_ID" > "$EVDIR/case-$1.journal.txt" || true
}

fail_case() { log "W5 FAIL at $1: $2"; rollback; }

# ---- CANARY-A: clean primary -------------------------------------------------
# NOTE: the 'agent model route chain loaded' line fires only at compose boot;
# the LIVE length-2 proof is mechanical in CANARY-B (a strict chain could not
# hop). Here we prove the turn ran the deployed executor on the v2 file bytes
# (sha unchanged since W4) with a clean single-attempt glm53 success.
OVERRIDES_SHA_AT_A="$(sha256_file "$OVERRIDES_FILE")"
MARKER_A="$(new_marker A)"
canary_turn "A" "$MARKER_A"
[ "$(sha256_file "$OVERRIDES_FILE")" = "$OVERRIDES_SHA_AT_A" ] \
  || fail_case A "overrides file changed during A (unexpected)"
A_SUMMARY="$(cat "$EVDIR/case-A.journal.txt")"
log "CANARY-A journal:
$A_SUMMARY"
echo "$A_SUMMARY" | grep -q '"kind":"route_chain_final","finalRoute":"glm53"' \
  || fail_case A "no glm53 final"
echo "$A_SUMMARY" | grep -q '"totalRouteAttempts":1' || fail_case A "attempts != 1"
echo "$A_SUMMARY" | grep -q '"fallbackActivated":false' || fail_case A "fallbackActivated != false"
ok "CANARY-A CLEAN PRIMARY: glm53=1 luna=0 TOTAL=1 success fallback=false (v2 file bytes stable; live length-2 proof = B hop below)"

# ---- CANARY-B: one controlled quota fallback ---------------------------------
NONCE_B="$(gen_nonce)"
MARKER_B="$(new_marker B)"
install_descriptor "provider_quota_rejected_before_generation" "$MARKER_B" "$NONCE_B" \
  || fail_case B "descriptor install/verify failed"
ok "CANARY-B descriptor installed (mode=provider_quota_rejected_before_generation nonce=$NONCE_B, 0600 ${AUTHSVC_UID}:${AUTHSVC_GID})"
canary_turn "B" "$MARKER_B"
B_SUMMARY="$(cat "$EVDIR/case-B.journal.txt")"
log "CANARY-B journal:
$B_SUMMARY"
echo "$B_SUMMARY" | grep -q 'provider_quota_rejected_before_generation' || fail_case B "quota class missing"
echo "$B_SUMMARY" | grep -q '"finalRoute":"luna"' || fail_case B "final route != luna"
echo "$B_SUMMARY" | grep -q '"totalRouteAttempts":2' || fail_case B "TOTAL != 2"
echo "$B_SUMMARY" | grep -q '"fallbackActivated":true' || fail_case B "fallbackActivated != true"
OBS_B="$(grep -o "route-chain-canary-observer {[^}]*}" "$CASE_SLICE" | grep "$NONCE_B" | head -1)"
[ -n "$OBS_B" ] || fail_case B "canary observer line for nonce missing"
printf '%s\n' "$OBS_B" | grep -q '"terminalOutcome":"success"\|success' || fail_case B "observer terminal not success"
grep -q 'route-chain-canary-delivery {"nonce":"'"$NONCE_B"'"' "$CASE_SLICE" || log "  NOTE: canary-delivery line not found in slice (recorded; journal is the primary channel)"
clear_injection || fail_case B "injection cleanup failed"
ok "CANARY-B ONE CONTROLLED QUOTA FALLBACK: glm53=1(fixture 429) luna=1(TOTAL 2, Luna model call=1) final=luna success; injection cleared+verified absent"

# ---- CANARY-C: outcome_unknown STOP ------------------------------------------
NONCE_C="$(gen_nonce)"
MARKER_C="$(new_marker C)"
install_descriptor "outcome_unknown" "$MARKER_C" "$NONCE_C" \
  || fail_case C "descriptor install/verify failed"
canary_turn "C" "$MARKER_C"
C_SUMMARY="$(cat "$EVDIR/case-C.journal.txt")"
log "CANARY-C journal:
$C_SUMMARY"
echo "$C_SUMMARY" | grep -qi 'outcome_unknown' || fail_case C "outcome_unknown missing"
echo "$C_SUMMARY" | grep -q '"totalRouteAttempts":1' || fail_case C "TOTAL != 1"
echo "$C_SUMMARY" | grep -q '"finalRoute":"luna"' && fail_case C "luna must NOT run in C"
OBS_C="$(grep -o "route-chain-canary-observer {[^}]*}" "$CASE_SLICE" | grep "$NONCE_C" | head -1)"
[ -n "$OBS_C" ] || fail_case C "canary observer line for nonce missing"
clear_injection || fail_case C "injection cleanup failed"
ok "CANARY-C OUTCOME_UNKNOWN STOP: glm53=1 luna=0 STOP_CHAIN one failure receipt; injection cleared+verified absent"

# ---- CANARY-D: aggregate duplicate/delivery invariants over A-C --------------
mark_log "case-D"
log_since "case-A" > "$EVDIR/case-ABCD.log.slice"
D_ALL="$(journal_summary "$EVDIR/case-ABCD.log.slice" "$AGENT_ID")"
FINALS_COUNT="$(printf '%s\n' "$D_ALL" | grep -c 'route_chain_final' || true)"
LUNA_FINALS="$(printf '%s\n' "$D_ALL" | grep -c '"finalRoute":"luna"' || true)"
[ "$FINALS_COUNT" = "3" ] || fail_case D "route_chain_final count $FINALS_COUNT != 3 (A/B/C)"
[ "$LUNA_FINALS" = "1" ] || fail_case D "luna finals $LUNA_FINALS != 1 (B only)"
ok "CANARY-D INVARIANTS: exactly 3 logical turns (A/B/C), single luna terminal across A-D, no count above expected"

# ---- FINAL: clean GLM verification turn + terminal state ---------------------
MARKER_F="$(new_marker FINAL)"
canary_turn "FINAL" "$MARKER_F"
F_SUMMARY="$(cat "$EVDIR/case-FINAL.journal.txt")"
log "FINAL verification journal:
$F_SUMMARY"
echo "$F_SUMMARY" | grep -q '"kind":"route_chain_final","finalRoute":"glm53"' || fail_case FINAL "clean turn did not finish on glm53"
echo "$F_SUMMARY" | grep -q '"totalRouteAttempts":1' || fail_case FINAL "clean turn attempts != 1"
clear_injection || fail_case FINAL "injection residue"
# terminal state: v2 config intact + injection absent
"$NODE_BIN" -e '
const fs=require("fs");const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const t=o.overrides["agt_cto-agent"].model;process.exit(t.primary==="glm53"&&t.fallbacks[0]==="luna"?0:1);' "$OVERRIDES_FILE" \
  || fail_case FINAL "terminal config drift"
ok "FINAL: clean GLM turn success on glm53; admission resumes; terminal state = glm53 primary + luna hot standby"

# =============================================================================
# success ledger
# =============================================================================
{
  printf 'HOTSTANDBY_ACTIVATION_V1 SUCCESS %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'main=%s harness=%s stamp=%s\n' "$MAIN_PIN" "$DSH_VERSION_PIN" "$DSH_COMMIT_PIN"
  printf 'config=glm53+[luna] canary=A/B/C/D+FINAL total_luna_model_calls=1\n'
  printf 'sender=%s(%s)\n' "$SENDER_OPENID" "$SENDER_PROVENANCE"
} > "$EVDIR/SUCCESS.txt"
cp "$LOG_FILE" "$EVDIR/runner-log.txt"
SUCCESS=1
trap - ERR EXIT
log "FINAL: SUCCESS; harness=clean-x64+$DSH_COMMIT_PIN; stamp=honest-dirtyCount0; code=main-$MAIN_PIN; route=glm53+[luna]; canary=A-D PASS; LUNA_CALLS=1; evidence=$EVDIR"
exit 0
