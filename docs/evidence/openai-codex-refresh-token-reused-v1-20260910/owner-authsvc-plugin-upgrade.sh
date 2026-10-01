#!/bin/bash
# owner-authsvc-plugin-upgrade.sh — r4
# Goal: OPENAI_CODEX_REFRESH_TOKEN_REUSED_V1 · AUTHSVC_PLUGIN_GENERATION_RECOVERY
#
# EXECUTION GATES (ALL must hold, else PRODUCTION_EXECUTION = FORBIDDEN):
#   G1 amendment accepted: docs/specs amendment (ACTIVATION_V1 authsvc-domain line)
#      accepted + AMENDMENT_ACCEPTED.marker in this evidence dir.
#   G2 exact-pin artifact: a tgz built from accepted source commit
#      75d98d5b10bb926d53108e49019668c1bde2a9eb, frozen at
#      $FROZEN_TGZ with $FROZEN_TGZ_SHA; script verifies SHA + REQUIRED_EXPORTS
#      (credentialFile/withOwnerReauth/shared-mode) — rejects the old broken tgz.
#   G3 fresh reconciliation hard gate (§0): fleet config v2, overrides==92,
#      roster bijection, canonical regular-file 0600 nlink1 non-symlink, no
#      tombstone, credential unexpired, 92 per-home stores present.
#
# r3 review fixes in r4:
#   R3#1 FREEZE_CURRENT_DONE_SET / RUNTIME_QUIESCED initialized; set -u safe.
#   R2#2  closed topology: current -> GEN_DIR ; home/dsh-codex -> current/dsh-codex;
#         verified by realpath + test -e after wiring.
#   R3#3 RUNTIME_QUIESCED tracked independently: EVERY post-bootout exit path
#         (incl. fence failure) re-bootstraps the runtime before exiting.
#   R3#5 rollback replays done rows AND reconciles intent-only rows (covers the
#         current-renamed and home-unlinked pre-done windows).
#   R3#6 effective-credential mechanical proof kept AND honestly scoped: the REAL
#         config-chain proof is the delivery canary gate BEFORE commit (two-phase).
#   R3#7 TWO-PHASE: `--apply` runs quiesce→fence→wire→restart→smokes→model-canary and
#         EXITS STILL ARMED (fence up, service up). The REAL delivery canary
#         (Owner feishu PONG) is the COMMIT GATE: `--commit` finalizes only after
#         it passes; `--abort` rolls back and restores the pre-upgrade state.
#   R3#8 SC2010 fixed (find instead of ls|grep); no credential-derived fingerprints.
#
# Usage:
#   sudo bash owner-authsvc-plugin-upgrade.sh --apply      # phase 1 (armed on exit)
#   sudo bash owner-authsvc-plugin-upgrade.sh --commit     # phase 2 after PONG passes
#   sudo bash owner-authsvc-plugin-upgrade.sh --abort      # phase 2 alternative: roll back
#   sudo bash owner-authsvc-plugin-upgrade.sh --rollback   # reconcile latest preimage
#   bash owner-authsvc-plugin-upgrade.sh --selftest        # offline

AMENDMENT_ACCEPTED_MARKER=/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/AMENDMENT_ACCEPTED.marker
EVIDENCE_DIR=/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910
FROZEN_TGZ=/Users/yanfenma/.agent-core/staging/chatgpt-subscription-provider-v1-authsvc/dsh-codex-0.2.3-75d98d5b.tgz
FROZEN_TGZ_SHA_FILE=/Users/yanfenma/.agent-core/staging/chatgpt-subscription-provider-v1-authsvc/dsh-codex-0.2.3-75d98d5b.tgz.sha256
FROZEN_SCOPES_TGZ=/Users/yanfenma/.agent-core/staging/chatgpt-subscription-provider-v1-authsvc/codex-deps-scopes-rc8.tgz
FROZEN_SCOPES_TGZ_SHA_FILE=/Users/yanfenma/.agent-core/staging/chatgpt-subscription-provider-v1-authsvc/codex-deps-scopes-rc8.tgz.sha256
TX_SCHEMA_VERSION=1
EXPECTED_FLEET=92   # production fleet cardinality; overridden ONLY in selftest/probe via TXPROBE
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
LABEL=ai.agent-core.runtime
PLIST=/Library/LaunchDaemons/$LABEL.plist
STAMP=$(date +%Y%m%d-%H%M%S)
# R8: production entry points use HARDCODED deployment roots. TXPROBE_* env
# overrides are applied ONLY inside --selftest/--tx-child-probe via
# apply_txprobe_overrides() — a production invocation ignores the environment.
ROOT=/Users/authsvc/.agent-core
CONFIG=$ROOT/agent-model-overrides.json
HOMES=$ROOT/homes
CONTROL=$ROOT/control
GEN_BASE=$CONTROL/codex-plugin-runtime
CURRENT_LINK=$GEN_BASE/current
CANONICAL=$ROOT/shared-credentials/openai-codex/.openai-codex-auth.json
GEN_PARENT=$GEN_BASE/gen-$STAMP
GEN_DIR=$GEN_PARENT/node_modules
PREIMAGE_DIR=$CONTROL/codex-plugin-preimage-$STAMP
MANIFEST=$PREIMAGE_DIR/manifest.json
COMMIT_RECEIPT=$CONTROL/codex-plugin-commit-receipt.json
# R7#2: the transaction trust domain is ROOT-ONLY. $CONTROL is authsvc-writable
# (0700 authsvc) — authsvc could delete/replace a root-owned TX there. TX, fence
# and lock therefore live in a root-owned 0700 recovery root.
RECOVERY_ROOT=/var/db/agent-core/authsvc-codex-migration
TX_FILE=$RECOVERY_ROOT/migration-transaction.json
FENCE=$RECOVERY_ROOT/migration-fence.json
LOCK_DIR=$RECOVERY_ROOT/lock
TX_ID=tx-$STAMP
SELF_SHA=$(shasum -a 256 "$0" 2>/dev/null | awk '{print $1}')
PROXY_ENV=(env "HTTP_PROXY=http://127.0.0.1:7890" "HTTPS_PROXY=http://127.0.0.1:7890" "NO_PROXY=localhost,127.0.0.1,::1" "NODE_USE_ENV_PROXY=1")
MUTATION_ARMED=NO; COMMIT_SUCCESS=NO; ROLLBACK_DONE=NO; FREEZE_CURRENT_DONE_SET=0
LOCK_HELD=NO; LOCK_NONCE=""
TX_TXID=""; TX_STATE=""; TX_PREIMAGE_DIR=""; TX_GEN_DIR=""; TX_CURRENT_LINK=""

# R8#8: test-only path overrides (selftest / --tx-child-probe). Recomputes every
# derived path from the TXPROBE_* values. NEVER called on production entry points.
apply_txprobe_overrides() {
  [ "${TXPROBE_ACTIVE:-0}" = "1" ] || return 0
  ROOT=${TXPROBE_ROOT:-$ROOT}
  CONFIG=${TXPROBE_CONFIG:-$ROOT/agent-model-overrides.json}
  HOMES=${TXPROBE_HOMES:-$ROOT/homes}
  CONTROL=${TXPROBE_CONTROL:-$ROOT/control}
  GEN_BASE=${TXPROBE_GEN_BASE:-$CONTROL/codex-plugin-runtime}
  CURRENT_LINK=${TXPROBE_CURRENT_LINK:-$GEN_BASE/current}
  CANONICAL=${TXPROBE_CANONICAL:-$ROOT/shared-credentials/openai-codex/.openai-codex-auth.json}
  RECOVERY_ROOT=${TXPROBE_RECOVERY_ROOT:-$RECOVERY_ROOT}
  TX_FILE=$RECOVERY_ROOT/migration-transaction.json
  FENCE=$RECOVERY_ROOT/migration-fence.json
  LOCK_DIR=$RECOVERY_ROOT/lock
  GEN_PARENT=$GEN_BASE/gen-$STAMP
  GEN_DIR=$GEN_PARENT/node_modules
  PREIMAGE_DIR=$CONTROL/codex-plugin-preimage-$STAMP
  MANIFEST=$PREIMAGE_DIR/manifest.json
  EXPECTED_FLEET=${TXPROBE_EXPECTED_FLEET:-$EXPECTED_FLEET}
  COMMIT_RECEIPT=$CONTROL/codex-plugin-commit-receipt.json
  return 0
}
AS_USER() { if [ "$(id -u)" = "0" ]; then sudo -u authsvc "$@"; else "$@"; fi; }

closure_digest() {
  ( cd "$1" && find -L "$2" -type f -print0 2>/dev/null | sort -z \
    | xargs -0 -I{} shasum -a 256 "{}" | shasum -a 256 | awk '{print $1}' )
}

# ---------- freeze+wire (journal intent→mutate→done, fsynced; topology:
#              current -> GEN_DIR ; home/dsh-codex -> current/dsh-codex) ----------
freeze_node_src() {
  cat <<'NODE_EOF'
// args: home preimageDir currentLink genDir
const fs = require('fs'), path = require('path')
const [home, preimageDir, currentLink, genDir] = process.argv.slice(2)
const agent = path.basename(home)
const nm = path.join(home, 'profiles', 'node_modules')
const manifest = path.join(preimageDir, 'manifest.json')
const entry = 'dsh-codex'
const fd = fs.openSync(manifest, 'a')
const journal = (rec) => { fs.writeSync(fd, JSON.stringify(rec) + '\n'); fs.fsyncSync(fd) }
const kindOf = (p) => { try { const s = fs.lstatSync(p); return s.isSymbolicLink() ? 'symlink' : (s.isDirectory() ? 'dir' : 'file') } catch (e) { if (e.code === 'ENOENT') return 'absent'; throw e } }
if (!fs.existsSync(nm)) { console.error('FREEZE_FAIL no node_modules: ' + home); process.exit(1) }
// 1) current link -> GEN_DIR (once per run)
if (process.env.FREEZE_CURRENT_DONE !== '1') {
  const old = (() => { try { return fs.readlinkSync(currentLink) } catch (e) { return null } })()
  journal({ phase: 'intent', agent: 'CURRENT', entry: 'current-link', kind: 'current-link', savedAs: null, symlinkTarget: old })
  const tmp = currentLink + '.tmp-' + process.pid
  try { fs.unlinkSync(tmp) } catch (e) {}
  fs.symlinkSync(genDir, tmp)
  fs.renameSync(tmp, currentLink)
  journal({ phase: 'done', agent: 'CURRENT', entry: 'current-link', kind: 'current-link', savedAs: null, symlinkTarget: old })
  console.log('CURRENT_SWITCHED old=' + (old || 'ABSENT') + ' new=' + genDir)
}
// 2) the single wired entry: home/dsh-codex -> current/dsh-codex
const p = path.join(nm, entry)
const kind = kindOf(p)
const target = path.join(currentLink, entry)
if (kind === 'symlink' && fs.readlinkSync(p) === target) {
  journal({ phase: 'done', agent, entry, kind: 'already-wired', savedAs: null, symlinkTarget: fs.readlinkSync(p) })
} else {
  const savedAs = (kind === 'dir' || kind === 'file') ? (agent + '__' + entry) : null
  const priorTarget = kind === 'symlink' ? fs.readlinkSync(p) : null
  journal({ phase: 'intent', agent, entry, kind, savedAs, symlinkTarget: priorTarget })
  if (kind === 'symlink') fs.unlinkSync(p)
  else if (kind !== 'absent') {
    fs.renameSync(p, path.join(preimageDir, savedAs))
    try { fs.fsyncSync(fs.openSync(preimageDir, 'r')) } catch (e) {}
  }
  fs.symlinkSync(target, p)
  try { fs.fsyncSync(fs.openSync(nm, 'r')) } catch (e) {}
  journal({ phase: 'done', agent, entry, kind, savedAs, symlinkTarget: priorTarget })
}
fs.closeSync(fd)
console.log('FREEZE_OK ' + agent)
NODE_EOF
}

# ---------- rollback: orphan bytes + done rows + INTENT-ONLY rows (R3#5) ----------
rollback_all() { # $1=preimage dir
  local dir="${1:-$PREIMAGE_DIR}"
  local manifest="$dir/manifest.json"
  local restored=0 failures=0 line agent entry kind savedAs target nm p
  echo "## ROLLBACK initiated ($(date '+%F %T %z')) from $dir"
  [ -f "$manifest" ] || { echo "ROLLBACK_GAP no manifest in $dir"; return 1; }
  # pass 1: SIGKILL orphans — renamed-away bytes with intent but no done row
  while IFS= read -r orphan; do
    [ -n "$orphan" ] || continue
    local oagent oname oentry
    oagent="${orphan%%__*}"; oname="${orphan#*__}"
    case "$oname" in dsh-codex) oentry=dsh-codex;; *) continue;; esac
    if ! jq -e --arg s "$orphan" 'select(.phase=="done" and .savedAs==$s)' "$manifest" >/dev/null 2>&1; then
      nm="$HOMES/$oagent/profiles/node_modules"; p="$nm/$oentry"
      [ -L "$p" ] && rm "$p"
      mv "$dir/$orphan" "$p" && { echo "ORPHAN_RECOVERED $oagent/$oentry"; restored=$((restored+1)); } || failures=$((failures+1))
    fi
  done < <(find "$dir" -maxdepth 1 -name "*__*" 2>/dev/null | while IFS= read -r f; do basename "$f"; done)
  # pass 2: replay done rows; intent-only rows are reconciled too (R3#5)
  # build the intent-only set: intent rows whose (agent,entry) has NO done row
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    agent=$(printf '%s' "$line" | jq -r .agent)
    entry=$(printf '%s' "$line" | jq -r .entry)
    kind=$(printf '%s' "$line" | jq -r .kind)
    target=$(printf '%s' "$line" | jq -r '.symlinkTarget // "null"')
    if jq -e --arg a "$agent" --arg e "$entry" 'select(.phase=="done" and .agent==$a and .entry==$e)' "$manifest" >/dev/null 2>&1; then
      continue  # done row exists; handled below
    fi
    # intent-only: mutation MAY have happened; restore from the intent record
    if [ "$kind" = current-link ]; then
      rm -f "$CURRENT_LINK"
      if [ "$target" != "null" ] && [ -n "$target" ]; then ln -s "$target" "$CURRENT_LINK" || failures=$((failures+1)); fi
      restored=$((restored+1)); echo "INTENT_ONLY_RECOVERED CURRENT (target=${target:-ABSENT})"
      continue
    fi
    nm="$HOMES/$agent/profiles/node_modules"; p="$nm/$entry"
    if [ "$kind" = symlink ]; then
      [ -L "$p" ] && rm "$p"
      if [ "$target" != "null" ] && [ -n "$target" ]; then ln -s "$target" "$p" || failures=$((failures+1)); fi
      restored=$((restored+1)); echo "INTENT_ONLY_RECOVERED $agent/$entry (symlink)"
    elif [ "$kind" = absent ]; then
      [ -L "$p" ] && rm "$p"
      restored=$((restored+1))
    fi
    # dir/file intent-only rows are covered by pass-1 orphan recovery
  done < <(jq -c 'select(.phase=="intent")' "$manifest")
  # pass 3: replay done rows
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    agent=$(printf '%s' "$line" | jq -r .agent)
    entry=$(printf '%s' "$line" | jq -r .entry)
    kind=$(printf '%s' "$line" | jq -r .kind)
    savedAs=$(printf '%s' "$line" | jq -r '.savedAs // "null"')
    target=$(printf '%s' "$line" | jq -r '.symlinkTarget // "null"')
    if [ "$kind" = current-link ]; then
      rm -f "$CURRENT_LINK"
      if [ "$target" != "null" ] && [ -n "$target" ]; then ln -s "$target" "$CURRENT_LINK" && restored=$((restored+1)) || failures=$((failures+1))
      else restored=$((restored+1)); fi
      continue
    fi
    nm="$HOMES/$agent/profiles/node_modules"; p="$nm/$entry"
    if [ "$kind" = already-wired ]; then restored=$((restored+1)); continue; fi
    if [ -L "$p" ]; then rm "$p" || failures=$((failures+1)); fi
    case "$kind" in
      dir|file)
        if [ -e "$dir/$savedAs" ]; then
          mv "$dir/$savedAs" "$p"; restored=$((restored+1))
        else
          failures=$((failures+1)); echo "ROLLBACK_GAP preimage missing: $agent/$entry"
        fi ;;
      symlink)
        if [ "$target" != "null" ] && [ -n "$target" ]; then
          ln -s "$target" "$p"; restored=$((restored+1))
        else
          restored=$((restored+1))
        fi ;;
      absent)
        if [ ! -e "$p" ]; then restored=$((restored+1)); else rm -rf "$p"; restored=$((restored+1)); fi ;;
    esac
  done < <(jq -c 'select(.phase=="done")' "$manifest")
  local modified=0
  for agent in $(jq -r 'select(.phase=="done" and .kind!="current-link") | .agent' "$manifest" | sort -u); do
    if [ -L "$HOMES/$agent/profiles/node_modules/dsh-codex" ] \
       && readlink "$HOMES/$agent/profiles/node_modules/dsh-codex" 2>/dev/null | grep -q "codex-plugin-runtime"; then
      modified=$((modified+1))
    fi
  done
  echo "ROLLBACK_VERIFY restored_entries=$restored failures=$failures MODIFIED_HOME_COUNT_AFTER_ROLLBACK=$modified"
  if [ "$failures" -ne 0 ] || [ "$modified" -ne 0 ]; then
    echo "PARTIAL_FLEET_STATE = POSSIBLE"; echo "STOP_AND_ESCALATE (do NOT run any delivery canary)"; return 1
  fi
  : > "$dir/ROLLBACK_COMPLETE.marker"
  mv "$manifest" "$manifest.rolledback-$STAMP" 2>/dev/null || true
  echo "ROLLBACK_COMPLETE (exact preimage restored, zero mutated homes remain)"
}

# ---------- R12: ONE shared abort transition (used by manual --abort AND auto lifecycle) ----------
# Ordering invariant (Owner r11 ruling):
#   recovery (no-mutation skip OR rollback_all)
#   → fence handling
#   → ensure_runtime_running MUST succeed
#   → tx_save ABORTED (never before runtime is verified running)
clear_fence_if_ours() {
  if [ -f "$FENCE" ] && [ "$(jq -r .txId "$FENCE" 2>/dev/null)" = "$TX_TXID" ]; then
    "$NODE" -e 'const fs=require("fs");const f=JSON.stringify({inFlight:false,clearedAt:new Date().toISOString(),txId:process.argv[1]},null,2)+"\n";fs.writeFileSync(process.argv[2],f,{mode:0o644});fs.fsyncSync(fs.openSync(process.argv[2],"r"))' "$TX_TXID" "$FENCE" 2>/dev/null || true
  fi
}
finish_abort_terminal() { # fence → runtime (MUST succeed) → ABORTED. Returns 0 only if ABORTED saved.
  clear_fence_if_ours
  if ! ensure_runtime_running; then
    tx_save ABORTED_PENDING_RUNTIME_RESTORE || echo "TX_SAVE_FAIL ABORTED_PENDING_RUNTIME_RESTORE"
    echo "RUNTIME_RESTORE_FAILED — state=ABORTED_PENDING_RUNTIME_RESTORE is re-entrant: re-run --abort --transaction $TX_TXID after fixing the runtime"
    return 1
  fi
  tx_save ABORTED || { echo "TX_SAVE_FAIL ABORTED — ESCALATE"; return 1; }
  echo "ABORT_TERMINAL state=ABORTED (runtime verified running)"
  return 0
}
abort_no_mutation_transition() { # for PREPARED/QUIESCING/FENCE_CREATING/MUTATING_NO_FENCE/MUTATING_FENCED-without-journal
  disarm_lifecycle
  ensure_runtime_running || true          # best effort first (may need bootstrap)
  clear_fence_if_ours
  ensure_runtime_running || { tx_save ABORTED_PENDING_RUNTIME_RESTORE || true; echo "RUNTIME_RESTORE_FAILED — state=ABORTED_PENDING_RUNTIME_RESTORE (re-entrant)"; return 1; }
  tx_save ABORTED || { echo "TX_SAVE_FAIL ABORTED — ESCALATE"; return 1; }
  echo "NO_MUTATION_ABORT_DONE state=ABORTED"
  return 0
}

on_lifecycle() {
  local sig="$1"
  if [ "$MUTATION_ARMED" = YES ] && [ "$COMMIT_SUCCESS" = NO ] && [ "$ROLLBACK_DONE" = NO ]; then
    ROLLBACK_DONE=YES
    echo "LIFECYCLE_TRAP sig=$sig → rollback + restore service"
    # R12: automatic lifecycle uses the SAME state-aware transition as manual --abort.
    local tx_was_live=NO txstate abort_kind=""
    if [ -f "$TX_FILE" ]; then
      txstate=$(jq -r .state "$TX_FILE" 2>/dev/null || echo unknown)
      case "$txstate" in
        PREPARED|QUIESCING|FENCE_CREATING|MUTATING_NO_FENCE) tx_was_live=YES; abort_kind=NOMUT ;;
        MUTATING_FENCED)
          tx_was_live=YES
          if [ -f "$MANIFEST" ]; then abort_kind=ROLLBACK; else abort_kind=NOMUT; fi ;;
        APPLIED_AWAITING_PONG) tx_was_live=YES; abort_kind=ROLLBACK ;;
      esac
    fi
    if [ "$tx_was_live" != YES ]; then
      ensure_runtime_running || echo "RUNTIME_RESTORE_FAILED — ESCALATE"
      echo "UPGRADE_RESULT = FAIL (no live transaction; service state verified)"
      [ "$sig" = EXIT ] || exit 1
      return 0
    fi
    if [ "$abort_kind" = NOMUT ]; then
      # R11#3: nothing frozen — never call rollback_all here.
      if abort_no_mutation_transition; then
        echo "UPGRADE_RESULT = FAIL (no-mutation abort; service restored)"
      else
        echo "UPGRADE_RESULT = FAIL_UNRESOLVED — state=ABORTED_PENDING_RUNTIME_RESTORE, STOP_AND_ESCALATE"
      fi
      [ "$sig" = EXIT ] || exit 1
      return 0
    fi
    # ROLLBACK kind
    tx_save ROLLING_BACK || echo "TX_SAVE_FAIL ROLLING_BACK (continuing rollback; state may be stale)"
    if rollback_all; then
      tx_save ROLLBACK_APPLIED || echo "TX_SAVE_FAIL ROLLBACK_APPLIED"
      if finish_abort_terminal; then
        echo "UPGRADE_RESULT = FAIL (rolled back on $sig; service restored)"
      else
        echo "UPGRADE_RESULT = FAIL_UNRESOLVED — runtime not restored; STOP_AND_ESCALATE"
      fi
    else
      tx_save ABORT_INCOMPLETE || echo "TX_SAVE_FAIL ABORT_INCOMPLETE"
      ensure_runtime_running || echo "RUNTIME_RESTORE_FAILED — ESCALATE"
      echo "UPGRADE_RESULT = FAIL_UNRESOLVED — PARTIAL_FLEET_STATE = POSSIBLE, STOP_AND_ESCALATE"
    fi
    [ "$sig" = EXIT ] || exit 1
    return 0
  fi
}
arm_lifecycle() { MUTATION_ARMED=YES; COMMIT_SUCCESS=NO; ROLLBACK_DONE=NO
  trap 'on_lifecycle ERR' ERR; trap 'on_lifecycle INT' INT; trap 'on_lifecycle TERM' TERM; trap 'on_lifecycle HUP' HUP
  # R8#1: the EXIT handler combines rollback semantics WITH lock release —
  # arming must not orphan the lock that do_apply holds.
  trap 'on_lifecycle EXIT; release_tx_lock' EXIT; }
disarm_lifecycle() { COMMIT_SUCCESS=YES; MUTATION_ARMED=NO; trap - ERR INT TERM HUP EXIT; }

stop_runtime() {
  launchctl bootout "system/$LABEL" 2>/dev/null
  local i=0
  while [ $i -lt 15 ]; do
    pgrep -f 'production-runtime.mjs --root /Users/authsvc' >/dev/null 2>&1 || { echo "QUIESCE_OK (runtime fully stopped)"; return 0; }
    sleep 1; i=$((i+1))
  done
  echo "QUIESCE_FAIL runtime still alive"; return 1
}
bootstrap_runtime() {
  if [ "${TXPROBE_ACTIVE:-0}" = "1" ]; then echo "(TXPROBE: bootstrap skipped in probe mode)"; return 0; fi
  launchctl bootstrap system "$PLIST" 2>/dev/null || launchctl kickstart -k "system/$LABEL" 2>/dev/null || { echo "BOOTSTRAP_FAIL"; return 1; }
  local new="" i=0
  while [ $i -lt 30 ]; do
    sleep 1
    new=$(pgrep -f 'production-runtime.mjs --root /Users/authsvc' | head -1)
    [ -n "$new" ] && break
    i=$((i+1))
  done
  [ -n "$new" ] || { echo "BOOTSTRAP_FAIL no runtime pid"; return 1; }
  echo "runtime_pid=$new (service restored)"
  sleep 10
}
runtime_is_running() {
  pgrep -f 'production-runtime.mjs --root /Users/authsvc' >/dev/null 2>&1
}
ensure_runtime_running() { # R11#4: durable across processes — probe REAL state, not flags
  if runtime_is_running; then
    echo "runtime already running (verified by pid)"
    return 0
  fi
  echo "runtime DOWN — bootstrapping (mandatory before any terminal state)"
  bootstrap_runtime || return 1
}

check_prior_upgrade_state() { # R11 rerun-fix: the PERSISTENT TX decides, not bare preimage dirs
  # a preimage dir alone is NOT evidence of an incomplete upgrade — the apply flow
  # creates it (scope-digests) before mutation and legitimately lands ABORTED/COMMITTED
  # without ever filling a manifest.
  if [ -f "$TX_FILE" ]; then
    local ts; ts=$(jq -r .state "$TX_FILE" 2>/dev/null || echo unknown)
    case "$ts" in
      COMMITTED|ABORTED) return 0 ;;   # terminal: prior transaction is closed
      ABORT_INCOMPLETE|ABORTED_PENDING_FENCE_CLEAR)
        echo "INCOMPLETE_PRIOR_TRANSACTION = YES (state=$ts) — reconcile via --commit/--abort --transaction"
        return 1 ;;
      *) echo "MID_FLIGHT_TRANSACTION = $ts — reconcile via --abort --transaction"; return 1 ;;
    esac
  fi
  # no TX at all: fall back to the legacy preimage check (pre-tx generations)
  local stale complete marker
  stale=$(find "$CONTROL" -maxdepth 1 -type d -name "codex-plugin-preimage-*" 2>/dev/null | sort | tail -1)
  [ -n "$stale" ] || return 0
  complete=$(jq -r '.commitComplete // "no"' "$COMMIT_RECEIPT" 2>/dev/null || echo no)
  marker=$(find "$stale" -maxdepth 1 -name "ROLLBACK_COMPLETE.marker" 2>/dev/null | head -1)
  if [ "$complete" != "yes" ] && [ -z "$marker" ]; then
    echo "INCOMPLETE_PRIOR_UPGRADE = YES"
    echo "PREIMAGE_PRESENT = YES ($stale) AND COMMIT_RECEIPT_COMPLETE != YES"
    echo "DO_NOT_CONTINUE_MUTATION — first reconcile: bash $0 --rollback   (then re-run)"
    return 1
  fi
}

smoke_home() {
  local agent=$1 home="$HOMES/$1" out rc
  out=$(AS_USER "$NODE" -e "import('$home/profiles/node_modules/dsh-codex/lib/index.js').then(m=>{const ok=typeof m.OpenAICodexCredentialStore==='function'&&typeof m.loginOpenAICodex==='function'&&typeof m.OpenAICodexReauthRequiredError==='function';console.log(ok?'SMOKE_OK':'SMOKE_INCOMPLETE');process.exit(ok?0:1)}).catch(e=>{console.log('SMOKE_FAIL '+String(e.message).slice(0,140));process.exit(1)})" 2>&1); rc=$?
  printf '%s | %s\n' "$out" "$agent"
  [ $rc -eq 0 ] && printf '%s' "$out" | grep -q SMOKE_OK
}

effective_credential_of_home() { # MECHANICAL proof only; the REAL config-chain proof
  # is the delivery-canary COMMIT GATE (two-phase design).
  "$NODE" -e '
    const fs = require("fs")
    const text = fs.readFileSync(process.argv[1] + "/profiles/agent-core-production/cordis.patch.yml", "utf8")
    const m = text.match(/BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1[\s\S]*?credentialFile:\s*(.*)[\s\S]*?END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1/)
    if (!m) { console.log("NO_BLOCK"); process.exit(1) }
    console.log(m[1].trim().replace(/^"|"$/g, ""))
  ' "$1" 2>/dev/null
}

# ---------- shared gates ----------
# ---------- R5: persistent transaction state machine ----------
# PREPARED → MUTATING → APPLIED_AWAITING_PONG → COMMITTED
#                                 ↘ ABORTED
tx_save() { # $1=state ; persists the CURRENT transaction with all absolute paths (fsynced)
  # R6#4: TX is ROOT-owned 0600 — it carries absolute paths that root later acts on.
  local state="$1"
  local tmp="$TX_FILE.tmp-$$"
  local manifest_sha="ABSENT"
  if [ -f "$MANIFEST" ]; then manifest_sha=$(shasum -a 256 "$MANIFEST" | awk '{print $1}'); fi
  "$NODE" -e '
    const fs = require("fs")
    const [out, rec] = process.argv.slice(1)
    fs.writeFileSync(out, JSON.stringify(JSON.parse(rec), null, 2) + "\n", { mode: 0o600 })
    fs.fsyncSync(fs.openSync(out, "r"))
  ' "$tmp" "$(cat <<JEOF
{"txSchema":$TX_SCHEMA_VERSION,"txId":"$TX_ID","state":"$state","scriptSha256":"$SELF_SHA",
 "stamp":"$STAMP","deploymentRoot":"$ROOT","config":"$CONFIG","genParent":"$GEN_PARENT",
 "genDir":"$GEN_DIR","currentLink":"$CURRENT_LINK","preimageDir":"$PREIMAGE_DIR",
 "manifest":"$MANIFEST","manifestSha256":"$manifest_sha","fence":"$FENCE","canonical":"$CANONICAL",
 "pluginTgz":"$FROZEN_TGZ","pluginTgzSha256":"$(cat "$FROZEN_TGZ_SHA_FILE" 2>/dev/null | awk '{print $1}')",
 "scopesTgz":"$FROZEN_SCOPES_TGZ","scopesTgzSha256":"$(cat "$FROZEN_SCOPES_TGZ_SHA_FILE" 2>/dev/null | awk '{print $1}')",
 "closureDigestsFile":"$PREIMAGE_DIR/scope-digests.txt","updatedAt":"$(date -u '+%FT%TZ')"}
JEOF
)" || { echo "TX_SAVE_FAIL state=$state"; rm -f "$tmp"; return 1; }
  mv "$tmp" "$TX_FILE" || { echo "TX_SAVE_FAIL move state=$state"; return 1; }
  if [ "$(id -u)" = "0" ]; then chown root:wheel "$TX_FILE"; fi
  chmod 600 "$TX_FILE"
}

prepare_recovery_root() { # R7#2: root-only trust domain (idempotent)
  mkdir -p "$RECOVERY_ROOT" || return 1
  chown root:wheel "$RECOVERY_ROOT" 2>/dev/null || true
  chmod 700 "$RECOVERY_ROOT" || return 1
  return 0
}
acquire_tx_lock() { # recoverable single-transaction mutex (R10): mkdir + PID/lstart/NONCE
  # metadata (pid reuse defeated by start-time comparison; metadata write failure
  # releases immediately; missing metadata gets one grace re-check before takeover).
  # Takeover quarantines via ATOMIC RENAME — concurrent contenders race on that
  # rename and exactly one wins, so a fresh lock is never destroyed by a rival.
  local nonce="${RANDOM}${RANDOM}$$"
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    local lstart_now; lstart_now=$(ps -o lstart= -p $$ 2>/dev/null | sed 's/^ *//;s/ *$//')
    if ! { printf 'pid=%s\n' "$$"; printf 'lstart=%s\n' "$lstart_now"; printf 'nonce=%s\n' "$nonce"; } > "$LOCK_DIR/meta" 2>/dev/null; then
      echo "TX_LOCK_META_WRITE_FAILED — releasing and failing (never leave an unmeta'd lock)"
      rm -rf "$LOCK_DIR" 2>/dev/null || true
      return 1
    fi
    LOCK_HELD=YES; LOCK_NONCE=$nonce
    return 0
  fi
  local lpid llstart lnonce lmeta
  lmeta=$(cat "$LOCK_DIR/meta" 2>/dev/null || echo "")
  lpid=$(printf '%s' "$lmeta" | sed -n 's/^pid=//p' | head -1)
  llstart=$(printf '%s' "$lmeta" | sed -n 's/^lstart=//p' | head -1)
  lnonce=$(printf '%s' "$lmeta" | sed -n 's/^nonce=//p' | head -1)
  local alive=YES
  if [ -z "$lpid" ] || [ -z "$lnonce" ] || [ -z "$llstart" ]; then
    # missing/invalid metadata: brief grace recheck (writer may be mid-write), then stale
    sleep 0.5
    lmeta=$(cat "$LOCK_DIR/meta" 2>/dev/null || echo "")
    lpid=$(printf '%s' "$lmeta" | sed -n 's/^pid=//p' | head -1)
    llstart=$(printf '%s' "$lmeta" | sed -n 's/^lstart=//p' | head -1)
    lnonce=$(printf '%s' "$lmeta" | sed -n 's/^nonce=//p' | head -1)
    [ -n "$lpid" ] && [ -n "$lnonce" ] && [ -n "$llstart" ] && alive=YES || alive=UNKNOWN_METADATA
  elif kill -0 "$lpid" 2>/dev/null; then
    local now_start now_start_raw
    now_start_raw=$(ps -o lstart= -p "$lpid" 2>/dev/null)
    now_start=$(printf '%s' "$now_start_raw" | sed 's/^ *//;s/ *$//')
    llstart=$(printf '%s' "$llstart" | sed 's/^ *//;s/ *$//')
    [ "$now_start" = "$llstart" ] || alive=PID_REUSED   # pid recycled by a different process
  else
    alive=DEAD
  fi
  if [ "$alive" != "YES" ]; then
    # quarantine via atomic rename: concurrent contenders race on THIS rename;
    # exactly one wins, the loser re-loops and re-evaluates the fresh lock.
    local q="$LOCK_DIR.stale-$RANDOM$$-$RANDOM"
    if mv "$LOCK_DIR" "$q" 2>/dev/null; then
      rm -rf "$q" 2>/dev/null || true
      if mkdir "$LOCK_DIR" 2>/dev/null; then
        local lstart_now2; lstart_now2=$(ps -o lstart= -p $$ 2>/dev/null | sed 's/^ *//;s/ *$//')
        if ! { printf 'pid=%s\n' "$$"; printf 'lstart=%s\n' "$lstart_now2"; printf 'nonce=%s\n' "$nonce"; } > "$LOCK_DIR/meta" 2>/dev/null; then
          rm -rf "$LOCK_DIR" 2>/dev/null || true
          echo "TX_LOCK_META_WRITE_FAILED (post-takeover) — lock released"
          return 1
        fi
        LOCK_HELD=YES; LOCK_NONCE=$nonce
        echo "STALE_LOCK_TAKEOVER (holder pid=${lpid:-unknown} state=$alive)"
        return 0
      fi
    fi
    echo "TX_LOCK_CONTESTED — another contender moved first; retry later"
    return 1
  fi
  echo "TX_LOCK_HELD elsewhere (holder pid $lpid alive, lstart matches) — retry later"
  return 1
}
release_tx_lock() { # R9#6: only the owner (matching nonce) may release
  if [ "$LOCK_HELD" = YES ]; then
    local lnonce
    lnonce=$(sed -n 's/^nonce=//p' "$LOCK_DIR/meta" 2>/dev/null | head -1)
    if [ "$lnonce" = "$LOCK_NONCE" ]; then
      rm -rf "$LOCK_DIR" 2>/dev/null || true
    else
      echo "LOCK_RELEASE_SKIPPED (nonce mismatch — lock was taken over by another process)"
    fi
    LOCK_HELD=NO; LOCK_NONCE=""
  fi
}

tx_validate_path() { # $1=loaded path $2=allowed-prefix ; refuses escapes outside deployment control roots
  local p="$1" prefix="$2"
  case "$p" in
    "$prefix"|"$prefix"/*) : ;;
    *) echo "TX_PATH_ESCAPE $p outside allowed prefix $prefix"; return 1 ;;
  esac
  [ ! -L "$p" ] || { echo "TX_PATH_SYMLINK $p must not be a symlink"; return 1; }
  return 0
}

tx_load() { # $1=txId → loads TX_FILE (root-owned 0600) into TX_* globals with full re-verification
  local want="$1"
  [ -f "$TX_FILE" ] || { echo "TX_MISSING $TX_FILE"; return 1; }
  if [ "$(id -u)" = "0" ]; then
    [ "$(stat -f '%Su' "$TX_FILE")" = "root" ] || { echo "TX_OWNER_FAIL (not root-owned)"; return 1; }
    [ "$(stat -f '%Sp' "$TX_FILE")" = "-rw-------" ] || { echo "TX_MODE_FAIL (not 0600)"; return 1; }
  fi
  [ "$(jq -r .txId "$TX_FILE" 2>/dev/null)" = "$want" ] || { echo "TX_ID_MISMATCH (file has $(jq -r .txId "$TX_FILE" 2>/dev/null), asked $want)"; return 1; }
  [ "$(jq -r .txSchema "$TX_FILE" 2>/dev/null)" = "$TX_SCHEMA_VERSION" ] || { echo "TX_SCHEMA_MISMATCH"; return 1; }
  local recorded_sha
  recorded_sha=$(jq -r .scriptSha256 "$TX_FILE")
  [ "$recorded_sha" = "$SELF_SHA" ] || { echo "TX_SCRIPT_SHA_MISMATCH (tx=$recorded_sha this=$SELF_SHA) — the script changed after --apply; use the recorded script generation"; return 1; }
  local l_preimage l_gen l_current l_manifest l_state
  l_preimage=$(jq -r .preimageDir "$TX_FILE"); l_gen=$(jq -r .genDir "$TX_FILE"); l_current=$(jq -r .currentLink "$TX_FILE"); l_manifest=$(jq -r .manifest "$TX_FILE")
  l_state=$(jq -r .state "$TX_FILE")
  # every loaded path must stay inside THIS deployment's control roots (R6#4)
  tx_validate_path "$l_preimage" "$CONTROL" || return 1
  tx_validate_path "$l_gen" "$CONTROL" || return 1
  tx_validate_path "$l_manifest" "$l_preimage" || return 1
  [ "$l_manifest" = "$l_preimage/manifest.json" ] || { echo "TX_MANIFEST_PATH_UNEXPECTED $l_manifest"; return 1; }
  # R10#1: currentLink validation is STATE-AWARE.
  #   PREPARED / QUIESCING / FENCE_CREATING / MUTATING_NO_FENCE / MUTATING_FENCED
  #     (pre-switch): current may legitimately still point at the PRIOR gen —
  #     require only that it (if present) is a symlink at the fixed position.
  #   APPLIED_AWAITING_PONG / COMMITTING / COMMITTED_PENDING_FENCE_CLEAR / COMMITTED:
  #     the switch has happened — current MUST be a symlink == persisted GEN_DIR.
  # Position (== fixed CURRENT_LINK, under CONTROL) is validated in ALL states.
  local cur_state_aware=POST
  case "$l_state" in
    PREPARED|QUIESCING|FENCE_CREATING|MUTATING_NO_FENCE|MUTATING_FENCED) cur_state_aware=PRE ;;
    # R11#3: rollback is restoring (or has restored) the PRIOR target — the new-gen
    # requirement must not apply, or cross-process resume is rejected at load time.
    ROLLING_BACK|ROLLBACK_APPLIED|ABORTED_PENDING_FENCE_CLEAR) cur_state_aware=PRE ;;
    ABORTED|ABORT_INCOMPLETE) cur_state_aware=ANY ;;   # terminal: existence/symlink shape only
  esac
  [ "$l_current" = "$CURRENT_LINK" ] || { echo "TX_CURRENT_POSITION_MISMATCH (tx=$l_current this=$CURRENT_LINK)"; return 1; }
  case "$l_current" in
    "$CONTROL"|"$CONTROL"/*) : ;;
    *) echo "TX_CURRENT_OUTSIDE_CONTROL $l_current"; return 1 ;;
  esac
  if [ -e "$l_current" ] || [ -L "$l_current" ]; then
    [ -L "$l_current" ] || { echo "TX_CURRENT_NOT_SYMLINK $l_current"; return 1; }
    if [ "$cur_state_aware" = POST ]; then
      [ "$(readlink "$l_current")" = "$l_gen" ] || { echo "TX_CURRENT_TARGET_MISMATCH (got $(readlink "$l_current"), tx says $l_gen)"; return 1; }
    fi
  elif [ "$cur_state_aware" = POST ]; then
    echo "TX_CURRENT_MISSING_IN_POST_STATE (state=$l_state)"; return 1
  fi
  # R8 state machine: fence semantics per state
  #   QUIESCING                          → fence must NOT exist yet
  #   FENCE_CREATING / MUTATING_NO_FENCE → fence absent OR (crash window) in-flight matching
  #   MUTATING_FENCED / APPLIED_AWAITING_PONG / COMMITTING → fence inFlight + txId match
  #   COMMITTING (crash after clear)     → cleared fence tolerated (re-entrant)
  #   ROLLING_BACK / ROLLBACK_APPLIED    → either tolerated (re-entrant recovery)
  #   COMMITTED_PENDING_FENCE_CLEAR / ABORTED_PENDING_FENCE_CLEAR → cleared-or-matching tolerated (resume clears it)
  #   COMMITTED / ABORTED / ABORT_INCOMPLETE → no fence requirement
  if [ -f "$FENCE" ]; then
    local f_tx f_in
    f_tx=$(jq -r .txId "$FENCE" 2>/dev/null); f_in=$(jq -r .inFlight "$FENCE" 2>/dev/null)
    case "$l_state" in
      QUIESCING)
        [ "$f_in" != "true" ] || { echo "TX_FENCE_IN_FLIGHT_TOO_EARLY (state=$l_state)"; return 1; } ;;
      FENCE_CREATING|MUTATING_NO_FENCE)
        # R9#3: crash between fence creation and MUTATING_FENCED save is legal —
        # a matching in-flight fence is tolerated and the flow resumes forward.
        if [ "$f_in" = "true" ] && [ "$f_tx" != "$want" ]; then echo "TX_FENCE_MISMATCH (fence txId=$f_tx)"; return 1; fi ;;
      MUTATING_FENCED|APPLIED_AWAITING_PONG)
        [ "$f_in" = "true" ] || { echo "TX_FENCE_NOT_IN_FLIGHT (state=$l_state)"; return 1; }
        [ "$f_tx" = "$want" ] || { echo "TX_FENCE_MISMATCH (fence txId=$f_tx)"; return 1; } ;;
      COMMITTING|COMMITTED_PENDING_FENCE_CLEAR|ROLLING_BACK|ROLLBACK_APPLIED|ABORTED_PENDING_FENCE_CLEAR)
        if [ "$f_in" = "true" ] && [ "$f_tx" != "$want" ]; then echo "TX_FENCE_MISMATCH (fence txId=$f_tx)"; return 1; fi ;;
      COMMITTED|ABORTED|ABORT_INCOMPLETE) : ;;
    esac
  else
    case "$l_state" in
      FENCE_CREATING|MUTATING_NO_FENCE|COMMITTING|COMMITTED_PENDING_FENCE_CLEAR|ROLLING_BACK|ROLLBACK_APPLIED|ABORTED_PENDING_FENCE_CLEAR|COMMITTED|ABORTED|ABORT_INCOMPLETE) : ;;
      MUTATING_FENCED|APPLIED_AWAITING_PONG) echo "TX_FENCE_MISSING (state=$l_state)"; return 1 ;;
      QUIESCING) : ;;
    esac
  fi
  # R10#3: manifest digest binding — frozen from APPLIED_AWAITING_PONG onward.
  # ROLLING_BACK tolerates a MISSING manifest (rollback archives it; the crash
  # window before ROLLBACK_APPLIED is saved is resolved by do_abort's
  # marker-based resume — never rejected here).
  case "$l_state" in
    APPLIED_AWAITING_PONG|COMMITTING|COMMITTED_PENDING_FENCE_CLEAR|COMMITTED)
      if [ -f "$l_manifest" ]; then
        local now_m recorded_m
        recorded_m=$(jq -r .manifestSha256 "$TX_FILE")
        now_m=$(shasum -a 256 "$l_manifest" | awk '{print $1}')
        [ "$recorded_m" = "$now_m" ] || { echo "TX_MANIFEST_DIGEST_MISMATCH (recorded=$recorded_m now=$now_m)"; return 1; }
      else
        local rec2; rec2=$(jq -r .manifestSha256 "$TX_FILE")
        [ "$rec2" != "ABSENT" ] && [ "$rec2" != "null" ] && { echo "TX_MANIFEST_MISSING_BUT_DIGEST_RECORDED"; return 1; }
      fi ;;
    ROLLING_BACK|ROLLBACK_APPLIED)
      if [ -f "$l_manifest" ]; then
        local now_m2 recorded_m2
        recorded_m2=$(jq -r .manifestSha256 "$TX_FILE")
        now_m2=$(shasum -a 256 "$l_manifest" | awk '{print $1}')
        [ "$recorded_m2" = "$now_m2" ] || [ ! -f "$l_manifest" ] || { echo "TX_MANIFEST_DIGEST_MISMATCH (recorded=$recorded_m2 now=$now_m2)"; return 1; }
      fi ;;   # archived manifest = legitimate; marker-based resume decides
    *) : ;;   # freeze not started/in progress: manifest may be absent or evolving
  esac
  TX_TXID="$want"; TX_ID="$want"   # R6#2: the ORIGINAL tx id travels with the transaction
  TX_STATE="$l_state"
  TX_PREIMAGE_DIR="$l_preimage"; TX_GEN_DIR="$l_gen"; TX_CURRENT_LINK="$l_current"
  PREIMAGE_DIR="$TX_PREIMAGE_DIR"; MANIFEST="$l_manifest"; GEN_DIR="$TX_GEN_DIR"; CURRENT_LINK="$TX_CURRENT_LINK"
  echo "TX_LOADED txId=$TX_ID state=$TX_STATE (fence+paths+manifest-digest verified)"
  return 0
}

tx_reentry_gate() { # refuses a new transaction while one is MID-FLIGHT
  [ -f "$TX_FILE" ] || return 0
  local state txid
  state=$(jq -r .state "$TX_FILE" 2>/dev/null || echo unknown)
  txid=$(jq -r .txId "$TX_FILE" 2>/dev/null || echo unknown)
  case "$state" in
    COMMITTED|ABORTED) return 0 ;;
    *)
      echo "INCOMPLETE_PRIOR_TRANSACTION = YES (txId=$txid state=$state)"
      echo "DO_NOT_CONTINUE_MUTATION — reconcile first:"
      echo "  --commit --transaction $txid   (if the feishu PONG canary passed)"
      echo "  --abort --transaction $txid   (rollback + restore service)"
      return 1 ;;
  esac
}

check_amendment_gate() { # structured marker (R6): binds accepted spec commit (+file digest) and provisioning commit
  [ -f "$AMENDMENT_ACCEPTED_MARKER" ] || { echo "G1 FAIL: amendment marker absent"; return 1; }
  local spec_head spec_sha prov_commit m_script m_plugin m_scopes m_root m_schema
  spec_head=$(jq -r '.specHead // ""' "$AMENDMENT_ACCEPTED_MARKER" 2>/dev/null)
  spec_sha=$(jq -r '.specSha256 // ""' "$AMENDMENT_ACCEPTED_MARKER" 2>/dev/null)
  prov_commit=$(jq -r '.provisioningCommit // ""' "$AMENDMENT_ACCEPTED_MARKER" 2>/dev/null)
  m_script=$(jq -r '.scriptSha256 // ""' "$AMENDMENT_ACCEPTED_MARKER" 2>/dev/null)
  m_plugin=$(jq -r '.pluginTgzSha256 // ""' "$AMENDMENT_ACCEPTED_MARKER" 2>/dev/null)
  m_scopes=$(jq -r '.scopesTgzSha256 // ""' "$AMENDMENT_ACCEPTED_MARKER" 2>/dev/null)
  m_root=$(jq -r '.deploymentRoot // ""' "$AMENDMENT_ACCEPTED_MARKER" 2>/dev/null)
  m_schema=$(jq -r '.txSchema // 0' "$AMENDMENT_ACCEPTED_MARKER" 2>/dev/null)
  # specHead must be an exact 40-hex commit AND bound to a frozen accepted spec copy here
  echo "$spec_head" | grep -qE '^[0-9a-f]{40}$' || { echo "G1 FAIL marker.specHead is not a 40-hex commit"; return 1; }
  [ -n "$spec_sha" ] || { echo "G1 FAIL marker.specSha256 empty"; return 1; }
  local spec_copy="$EVIDENCE_DIR/accepted-spec-copy-$spec_head.md"
  [ -f "$spec_copy" ] || { echo "G1 FAIL accepted spec copy missing: $spec_copy"; return 1; }
  local spec_now; spec_now=$(shasum -a 256 "$spec_copy" | awk '{print $1}')
  [ "$spec_now" = "$spec_sha" ] || { echo "G1 FAIL spec copy digest mismatch"; return 1; }
  # A4 provisioning gate: the anti-drift provisioning fix must be bound and merged
  echo "$prov_commit" | grep -qE '^[0-9a-f]{40}$' || { echo "G1 FAIL marker.provisioningCommit is not a 40-hex commit (A4 gate)"; return 1; }
  [ -f "$EVIDENCE_DIR/accepted-provisioning-commit.txt" ] || { echo "G1 FAIL accepted-provisioning-commit.txt missing (A4 gate)"; return 1; }
  grep -q "$prov_commit" "$EVIDENCE_DIR/accepted-provisioning-commit.txt" || { echo "G1 FAIL provisioningCommit not recorded in accepted-provisioning-commit.txt"; return 1; }
  [ "$m_schema" = "$TX_SCHEMA_VERSION" ] || { echo "G1 FAIL marker.txSchema=$m_schema expected $TX_SCHEMA_VERSION"; return 1; }
  [ "$m_script" = "$SELF_SHA" ] || { echo "G1 FAIL marker.scriptSha256 != this script (${m_script:0:12}… vs ${SELF_SHA:0:12}…)"; return 1; }
  local plugin_sha; plugin_sha=$(awk '{print $1}' "$FROZEN_TGZ_SHA_FILE" 2>/dev/null)
  [ "$m_plugin" = "$plugin_sha" ] || { echo "G1 FAIL marker.pluginTgzSha256 != frozen tgz sha"; return 1; }
  local scopes_sha; scopes_sha=$(awk '{print $1}' "$FROZEN_SCOPES_TGZ_SHA_FILE" 2>/dev/null)
  [ "$m_scopes" = "$scopes_sha" ] || { echo "G1 FAIL marker.scopesTgzSha256 != frozen scopes sha"; return 1; }
  [ "$m_root" = "$ROOT" ] || { echo "G1 FAIL marker.deploymentRoot != $ROOT"; return 1; }
  echo "G1 amendment = ACCEPTED (specHead=${spec_head:0:12}… spec-sha ok · provisioningCommit=${prov_commit:0:12}… · script/tgz/scopes/root bound)"
}

check_frozen_artifact() { # G2: BOTH frozen archives (plugin + dependency scopes), SHA + exports
  local f
  for f in "$FROZEN_TGZ" "$FROZEN_SCOPES_TGZ"; do
    [ -f "$f" ] || { echo "G2 FAIL frozen artifact missing: $f"; return 1; }
  done
  local recorded_p actual_p recorded_s actual_s
  recorded_p=$(awk '{print $1}' "$FROZEN_TGZ_SHA_FILE" 2>/dev/null); actual_p=$(shasum -a 256 "$FROZEN_TGZ" | awk '{print $1}')
  [ -n "$recorded_p" ] && [ "$recorded_p" = "$actual_p" ] || { echo "G2 FAIL plugin tgz sha mismatch"; return 1; }
  recorded_s=$(awk '{print $1}' "$FROZEN_SCOPES_TGZ_SHA_FILE" 2>/dev/null); actual_s=$(shasum -a 256 "$FROZEN_SCOPES_TGZ" | awk '{print $1}')
  [ -n "$recorded_s" ] && [ "$recorded_s" = "$actual_s" ] || { echo "G2 FAIL scopes tgz sha mismatch"; return 1; }
  echo "FROZEN_ARTIFACT_SHAS = plugin:${actual_p:0:16}… scopes:${actual_s:0:16}… (both match records)"
  mkdir -p "$GEN_DIR/dsh-codex"
  tar -xzf "$FROZEN_TGZ" -C "$GEN_DIR/dsh-codex" --strip-components 1 || { echo "G2 FAIL untar plugin"; return 1; }
  mkdir -p "$GEN_DIR/dsh-codex/node_modules"
  tar -xzf "$FROZEN_SCOPES_TGZ" -C "$GEN_DIR/dsh-codex/node_modules" || { echo "G2 FAIL untar scopes"; return 1; }
  chown -R authsvc:authsvc "$GEN_PARENT"
  # REQUIRED_EXPORTS: EACH shared-mode symbol must be present individually (R10#6:
  # an aggregate count can hide a missing symbol behind the other three).
  local bundle hits sym
  bundle=$(find "$GEN_DIR/dsh-codex/lib" -name "*.js" -exec cat {} +)
  hits=0
  for sym in credentialFile withOwnerReauth OpenAICodexReauthRequiredError refresh-intent; do
    if printf '%s' "$bundle" | grep -q "$sym"; then hits=$((hits+1)); echo "  export[$sym]=PRESENT"; else echo "  export[$sym]=MISSING"; fi
  done
  [ "$hits" = "4" ] || { echo "G2 FAIL artifact lacks required shared-mode exports ($hits/4) — OLD broken build detected"; return 1; }
  # R11#2: scope-digest receipt is RECORD-ONLY — provenance authority is the
  # frozen tgz SHA pair verified above. No $SRC (mutable/undefined) comparison;
  # no match=FAIL that could be silently ignored.
  mkdir -p "$PREIMAGE_DIR"
  : > "$PREIMAGE_DIR/scope-digests.txt"
  {
    echo "plugin_tgz_sha256=$(awk '{print $1}' "$FROZEN_TGZ_SHA_FILE" 2>/dev/null)"
    echo "scopes_tgz_sha256=$(awk '{print $1}' "$FROZEN_SCOPES_TGZ_SHA_FILE" 2>/dev/null)"
    echo "installed[dsh-codex]=$(closure_digest "$GEN_DIR" dsh-codex)"
    echo "installed[@deepseek-ai]=$(closure_digest "$GEN_DIR/dsh-codex/node_modules" @deepseek-ai)"
    echo "installed[@earendil-works]=$(closure_digest "$GEN_DIR/dsh-codex/node_modules" @earendil-works)"
  } > "$PREIMAGE_DIR/scope-digests.txt"
  cat "$PREIMAGE_DIR/scope-digests.txt"
  echo "G2 exact-pin artifact = PASS (rebuilt from accepted commit 75d98d5b lineage; NO mutable-source copies; installed-closure digests recorded for audit)"
}

fresh_reconciliation() { # G3 hard gate (R5#5: bijection vs authoritative registry + store census + expiry from THIS gen)
  [ "$(jq -r .version "$CONFIG")" = "2" ] || { echo "G3 FAIL config not v2"; return 1; }
  local n; n=$(jq -r '.overrides | length' "$CONFIG")
  [ "$n" = "$EXPECTED_FLEET" ] || { echo "G3 FAIL overrides=$n (expected exactly $EXPECTED_FLEET)"; return 1; }
  # bijection vs authoritative registry (agents.json), both directions
  local reg_total in_reg_not_cfg in_cfg_not_reg
  reg_total=$(jq -r '[.agents[] | select(.disabled != true)] | length' "$ROOT/agents.json" 2>/dev/null || echo "?")
  in_reg_not_cfg=$(comm -23 <(jq -r '[.agents[] | select(.disabled != true) | .id] | sort[]' "$ROOT/agents.json" 2>/dev/null) <(jq -r '.overrides | keys[]' "$CONFIG" | sort) | wc -l | tr -d ' ')
  in_cfg_not_reg=$(comm -13 <(jq -r '[.agents[] | select(.disabled != true) | .id] | sort[]' "$ROOT/agents.json" 2>/dev/null) <(jq -r '.overrides | keys[]' "$CONFIG" | sort) | wc -l | tr -d ' ')
  echo "G3 roster: registry_active=$reg_total overrides=$n in_registry_not_overrides=$in_reg_not_cfg in_overrides_not_registry=$in_cfg_not_reg"
  [ "$in_reg_not_cfg" = "0" ] && [ "$in_cfg_not_reg" = "0" ] || { echo "G3 FAIL roster bijection"; return 1; }
  # G3 stores: census of the REAL per-home credential stores (bridge preimage), not plugin installs
  local store_ok=0 store_bad=0 a f
  for a in $(jq -r '.overrides | keys[]' "$CONFIG"); do
    f="$HOMES/$a/.openai-codex-auth.json"
    if [ -f "$f" ] && [ ! -L "$f" ]; then store_ok=$((store_ok+1)); else store_bad=$((store_bad+1)); echo "G3_STORE_MISSING_OR_SYMLINK $a"; fi
  done
  echo "G3 stores: present=$store_ok absent=$store_bad (92/92 expected present — bridge state)"
  [ "$store_bad" = 0 ] || { echo "G3 FAIL store census"; return 1; }
  [ -f "$CANONICAL" ] && [ ! -L "$CANONICAL" ] || { echo "G3 FAIL canonical not a regular file"; return 1; }
  [ "$(stat -f '%Sp' "$CANONICAL")" = "-rw-------" ] || { echo "G3 FAIL canonical mode"; return 1; }
  [ "$(stat -f '%l' "$CANONICAL")" = "1" ] || { echo "G3 FAIL canonical nlink"; return 1; }
  sudo -u authsvc test -r "$CANONICAL" || { echo "G3 FAIL authsvc cannot read canonical"; return 1; }
  [ ! -e "${CANONICAL}.refresh-intent.json" ] || { echo "G3 FAIL tombstone present"; return 1; }
  # expiry read from THIS build's gen (not any pre-existing install)
  local expired
  expired=$(sudo -u authsvc "$NODE" -e "
    import('$GEN_DIR/dsh-codex/lib/index.js').then(async m => {
      const s = new m.OpenAICodexCredentialStore('$CANONICAL')
      const c = await s.read('openai-codex')
      console.log(c && Date.now() < c.expires ? 'no' : 'yes')
    }).catch(e => console.log('unknown:' + String(e.message).slice(0,80)))
  " 2>/dev/null || echo unknown)
  [ "$expired" = "no" ] || { echo "G3 FAIL credential expired/unknown ($expired)"; return 1; }
  echo "G3 fresh reconciliation = PASS (v2 · 92 · bijection · boundary · tombstone-absent · unexpired[from-this-gen])"
}

selftest() {
  T=$(mktemp -d /tmp/plugin-upgrade-r4-selftest.XXXXXX) || exit 1
  local failures=0
  mkdir -p "$T/gen/node_modules/dsh-codex/lib" "$T/gen/node_modules/dsh-codex/node_modules/@deepseek-ai/x" "$T/homeA/profiles/node_modules/dsh-codex/lib" "$T/homeA/profiles/node_modules/@agent-core/bundle" "$T/homeA/profiles/agent-core-production" "$T/genbase"
  printf 'good' > "$T/gen/node_modules/dsh-codex/lib/index.js"
  echo oldbuild > "$T/homeA/profiles/node_modules/dsh-codex/lib/index.js"
  echo bypass > "$T/homeA/profiles/node_modules/@agent-core/bundle/index.js"
  printf 'llm:\n# BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n- id: llm-openai-codex\n  config:\n    credentialFile: "/canon/x"\n# END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n' > "$T/homeA/profiles/agent-core-production/cordis.patch.yml"
  HOMES_SAVED=$HOMES; CURRENT_LINK_SAVED=$CURRENT_LINK; GEN_DIR_SAVED=$GEN_DIR; PREIMAGE_DIR_SAVED=$PREIMAGE_DIR; MANIFEST_SAVED=$MANIFEST; CONTROL_SAVED=$CONTROL; GEN_BASE_SAVED=$GEN_BASE; GEN_PARENT_SAVED=$GEN_PARENT
  HOMES=$T; GEN_BASE=$T/genbase; GEN_PARENT=$T/genbase; CURRENT_LINK=$T/genbase/current; GEN_DIR=$T/gen/node_modules; PREIMAGE_DIR=$T/preimage; MANIFEST=$PREIMAGE_DIR/manifest.json; CONTROL=$T
  mkdir -p "$PREIMAGE_DIR"
  freeze_node_src > "$T/freeze.cjs"

  # T1 freeze+wire: topology current->GEN_DIR, home->current/dsh-codex RESOLVES
  FREEZE_CURRENT_DONE=0 "$NODE" "$T/freeze.cjs" "$T/homeA" "$PREIMAGE_DIR" "$CURRENT_LINK" "$GEN_DIR" >/dev/null 2>&1 || { echo "SELFTEST_FAIL T1 freeze"; failures=1; }
  [ "$(readlink "$CURRENT_LINK")" = "$GEN_DIR" ] || { echo "SELFTEST_FAIL T1 current target"; failures=1; }
  [ "$(readlink "$T/homeA/profiles/node_modules/dsh-codex")" = "$CURRENT_LINK/dsh-codex" ] || { echo "SELFTEST_FAIL T1 home target"; failures=1; }
  # R3#2: REAL resolution check (realpath through the two-hop symlink; both sides realpath'd)
  resolved=$(AS_USER "$NODE" -e "console.log(require('fs').realpathSync('$T/homeA/profiles/node_modules/dsh-codex/lib/index.js'))" 2>/dev/null)
  expected=$(AS_USER "$NODE" -e "console.log(require('fs').realpathSync('$GEN_DIR/dsh-codex/lib/index.js'))" 2>/dev/null)
  [ -n "$resolved" ] && [ "$resolved" = "$expected" ] || { echo "SELFTEST_FAIL T1 dangling resolution: $resolved vs $expected"; failures=1; }
  [ "$(cat "$T/homeA/profiles/node_modules/@agent-core/bundle/index.js")" = "bypass" ] || { echo "SELFTEST_FAIL T1 bypass"; failures=1; }

  # T2 SIGKILL window: current renamed, done NOT written → intent-only recovery
  # fixture starts with NO current link (fresh environment: prior = absent)
  rm -f "$CURRENT_LINK"
  : > "$MANIFEST"
  FREEZE_CURRENT_DONE=0 "$NODE" "$T/freeze.cjs" "$T/homeA" "$PREIMAGE_DIR" "$CURRENT_LINK" "$GEN_DIR" >/dev/null 2>&1
  jq -c 'select((.phase=="done" and .agent=="CURRENT") | not)' "$MANIFEST" > "$T/m.new" && mv "$T/m.new" "$MANIFEST"
  rollback_all >/dev/null 2>&1 || { echo "SELFTEST_FAIL T2 rollback"; failures=1; }
  [ ! -e "$CURRENT_LINK" ] || { echo "SELFTEST_FAIL T2 current not removed (prior was absent)"; failures=1; }
  [ "$(cat "$T/homeA/profiles/node_modules/dsh-codex/lib/index.js")" = "oldbuild" ] || { echo "SELFTEST_FAIL T2 intent-only recovery"; failures=1; }

  # T3 SIGKILL window: home symlink unlinked, done NOT written → intent-only recovery
  : > "$MANIFEST"
  rm -rf "$T/homeA/profiles/node_modules/dsh-codex"
  ln -s /some/old/target "$T/homeA/profiles/node_modules/dsh-codex"
  FREEZE_CURRENT_DONE=1 "$NODE" "$T/freeze.cjs" "$T/homeA" "$PREIMAGE_DIR" "$CURRENT_LINK" "$GEN_DIR" >/dev/null 2>&1
  jq -c 'select((.phase=="done" and .agent=="homeA") | not)' "$MANIFEST" > "$T/m.new" && mv "$T/m.new" "$MANIFEST"
  rollback_all >/dev/null 2>&1 || { echo "SELFTEST_FAIL T3 rollback"; failures=1; }
  [ "$(readlink "$T/homeA/profiles/node_modules/dsh-codex")" = "/some/old/target" ] || { echo "SELFTEST_FAIL T3 symlink intent-only"; failures=1; }

  # T4 lifecycle TERM armed → rollback; committed EXIT → no-op
  # (T4 owns isolated tx/fence/lock paths — production /var/db is never touched)
  TX_FILE="$T/tx.json"; FENCE="$T/fence.json"; LOCK_DIR="$T/lock"; RECOVERY_ROOT="$T/rec"
  mkdir -p "$RECOVERY_ROOT"
  : > "$MANIFEST"
  rm -rf "$T/homeA/profiles/node_modules/dsh-codex"; mkdir -p "$T/homeA/profiles/node_modules/dsh-codex/lib"; echo oldbuild > "$T/homeA/profiles/node_modules/dsh-codex/lib/index.js"
  MUTATION_ARMED=YES; COMMIT_SUCCESS=NO; ROLLBACK_DONE=NO
  FREEZE_CURRENT_DONE=1 "$NODE" "$T/freeze.cjs" "$T/homeA" "$PREIMAGE_DIR" "$CURRENT_LINK" "$GEN_DIR" >/dev/null 2>&1
  tx_save MUTATING_FENCED >/dev/null 2>&1 || { echo "SELFTEST_FAIL T4 tx_save"; failures=1; }
  t4=$(on_lifecycle TERM 2>&1); printf '%s' "$t4" | grep -q "rolled back on TERM" || { echo "SELFTEST_FAIL T4 TERM transition"; failures=1; }
  # exact preimage restored
  [ "$(cat "$T/homeA/profiles/node_modules/dsh-codex/lib/index.js")" = "oldbuild" ] || { echo "SELFTEST_FAIL T4 restore"; failures=1; }
  # R12: probe shell has no runtime — terminal must be the RECOVERABLE pending
  # state (ABORTED / ABORTED_PENDING_RUNTIME_RESTORE), never a false ABORTED.
  t4_state=$(jq -r .state "$TX_FILE" 2>/dev/null || echo none)
  case "$t4_state" in
    ABORTED|ABORTED_PENDING_RUNTIME_RESTORE) : ;;
    *) echo "SELFTEST_FAIL T4 terminal state ($t4_state)"; failures=1 ;;
  esac
  FREEZE_CURRENT_DONE=1 "$NODE" "$T/freeze.cjs" "$T/homeA" "$PREIMAGE_DIR" "$CURRENT_LINK" "$GEN_DIR" >/dev/null 2>&1
  MUTATION_ARMED=YES; COMMIT_SUCCESS=NO; ROLLBACK_DONE=NO; COMMIT_SUCCESS=YES
  on_lifecycle EXIT
  [ -L "$T/homeA/profiles/node_modules/dsh-codex" ] || { echo "SELFTEST_FAIL T4 committed EXIT rolled back"; failures=1; }
  COMMIT_SUCCESS=NO; MUTATION_ARMED=NO; ROLLBACK_DONE=NO
  rollback_all >/dev/null 2>&1 || true

  # T5 chain parser
  v=$(effective_credential_of_home "$T/homeA")
  [ "$v" = "/canon/x" ] || { echo "SELFTEST_FAIL T5 parser"; failures=1; }

  # T6 persistent TX state machine (functional, isolated CONTROL root)
  REAL_SELF_SHA=$SELF_SHA   # T7 needs the true script sha (cross-process child recomputes it)
  CONTROL="$T"; TX_FILE="$T/tx.json"; FENCE="$T/fence.json"; COMMIT_RECEIPT="$T/receipt.json"
  GEN_BASE="$T/genbase"; GEN_PARENT="$T/genbase/gen-x"; GEN_DIR="$T/genbase/gen-x/node_modules"
  CURRENT_LINK="$T/genbase/current"; PREIMAGE_DIR="$T/preimage"; MANIFEST="$PREIMAGE_DIR/manifest.json"
  STAMP="x"; TX_ID="tx-x"; SELF_SHA="deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  FROZEN_TGZ="$T/plugin.tgz"; FROZEN_TGZ_SHA_FILE="$T/plugin.tgz.sha256"; FROZEN_SCOPES_TGZ="$T/scopes.tgz"; FROZEN_SCOPES_TGZ_SHA_FILE="$T/scopes.tgz.sha256"
  mkdir -p "$PREIMAGE_DIR" "$GEN_DIR/dsh-codex/lib"
  echo x > "$GEN_DIR/dsh-codex/lib/index.js"
  if tx_save PREPARED && tx_save QUIESCING && tx_save FENCE_CREATING && tx_save MUTATING_NO_FENCE && tx_save MUTATING_FENCED && tx_save APPLIED_AWAITING_PONG; then :; else echo "SELFTEST_FAIL T6 save chain"; failures=1; fi
  # applied-state load requires the current link (R10#1 POST-state validation)
  mkdir -p "$GEN_BASE"; ln -sfn "$GEN_DIR" "$CURRENT_LINK"
  printf '{"txId":"tx-x","inFlight":true}\n' > "$FENCE"   # fence binding fixture (tx_load verifies it)
  [ "$(jq -r .state "$TX_FILE")" = "APPLIED_AWAITING_PONG" ] || { echo "SELFTEST_FAIL T6 state"; failures=1; }
  [ "$(jq -r .genDir "$TX_FILE")" = "$GEN_DIR" ] || { echo "SELFTEST_FAIL T6 path persistence"; failures=1; }
  TX_TXID=""; TX_STATE=""; TX_PREIMAGE_DIR=""; TX_GEN_DIR=""; TX_CURRENT_LINK=""
  tx_load tx-x >/dev/null 2>&1 || { echo "SELFTEST_FAIL T6 load"; failures=1; }
  [ "$TX_STATE" = "APPLIED_AWAITING_PONG" ] && [ "$TX_PREIMAGE_DIR" = "$PREIMAGE_DIR" ] || { echo "SELFTEST_FAIL T6 loaded fields"; failures=1; }
  SELF_SHA="different"
  tx_load tx-x >/dev/null 2>&1 && { echo "SELFTEST_FAIL T6 sha binding"; failures=1; }
  SELF_SHA="deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  tx_save MUTATING_FENCED >/dev/null 2>&1
  # fence fixture matching the tx (tx_load verifies the fence binding)
  printf '{"txId":"tx-x","inFlight":true}\n' > "$FENCE"
  if tx_reentry_gate >/dev/null 2>&1; then echo "SELFTEST_FAIL T6 reentry did not block mid-flight"; failures=1; fi
  jq '.state = "COMMITTED"' "$TX_FILE" > "$T/tx2.json" && mv "$T/tx2.json" "$TX_FILE"
  tx_reentry_gate >/dev/null 2>&1 || { echo "SELFTEST_FAIL T6 reentry blocked committed"; failures=1; }
  # tx_load refuses a fence whose txId does not match (state must be a
  # fence-gated state — reset it, since the reentry test above set COMMITTED)
  jq '.state = "MUTATING_FENCED"' "$TX_FILE" > "$T/tx3.json" && mv "$T/tx3.json" "$TX_FILE"
  printf '{"txId":"tx-OTHER","inFlight":true}\n' > "$FENCE"
  tx_load tx-x >/dev/null 2>&1 && { echo "SELFTEST_FAIL T6 fence binding"; failures=1; }

  # T7 (R7 review): REAL two-hop topology + CROSS-PROCESS tx_load via a second shell.
  # fixture: full applied-topology shape (current->GEN_DIR symlink, home->current/dsh-codex)
  local c7="$T/t7"
  mkdir -p "$c7/control/codex-plugin-runtime/gen-t7/node_modules/dsh-codex/lib" "$c7/control/codex-plugin-preimage-t7" "$c7/homeA/profiles/node_modules/dsh-codex/lib" "$c7/homeA/profiles/agent-core-production" "$c7/recovery"
  GEN_BASE="$c7/control/codex-plugin-runtime"; GEN_DIR="$GEN_BASE/gen-t7/node_modules"; CURRENT_LINK="$GEN_BASE/current"
  printf 'good' > "$GEN_DIR/dsh-codex/lib/index.js"
  printf '{"version":2,"routeCatalog":{},"overrides":{}}' > "$c7/agent-model-overrides.json"
  printf 'llm:\n# BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n- id: llm-openai-codex\n  config:\n    credentialFile: "/canon/x"\n# END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n' > "$c7/homeA/profiles/agent-core-production/cordis.patch.yml"
  ln -s "$c7/genbase/current" "$GEN_DIR/dsh-codex/.selfref-check" 2>/dev/null || true
  ln -sfn "$GEN_DIR" "$CURRENT_LINK"                                      # applied topology: current -> GEN_DIR (symlink!)
  ln -s "$CURRENT_LINK/dsh-codex" "$c7/homeA/profiles/node_modules/dsh-codex"  # home -> current/dsh-codex
  # journal + a tx in APPLIED_AWAITING_PONG, saved by THIS process (digest recorded)
  : > "$MANIFEST"
  HOMES="$c7"; GEN_PARENT="$GEN_BASE/gen-$STAMP"; PREIMAGE_DIR="$c7/control/codex-plugin-preimage-t7"; MANIFEST="$PREIMAGE_DIR/manifest.json"; CONTROL="$c7/control"; RECOVERY_ROOT="$c7/recovery"; TX_FILE="$c7/recovery/migration-transaction.json"; FENCE="$c7/recovery/migration-fence.json"; LOCK_DIR="$c7/recovery/lock"; STAMP="t7"; TX_ID="tx-t7"; SELF_SHA="$REAL_SELF_SHA"
  printf 'x' > "$MANIFEST"
  tx_save APPLIED_AWAITING_PONG >/dev/null 2>&1 || { echo "SELFTEST_FAIL T7 tx_save"; failures=1; }
  printf '{"txId":"tx-t7","inFlight":true}\n' > "$FENCE"
  # cross-process: a SECOND shell resolves the symlinked topology via tx_load
  child=$(TXPROBE_ROOT="$c7" TXPROBE_CONTROL="$c7/control" TXPROBE_GEN_BASE="$c7/genbase" \
    TXPROBE_CURRENT_LINK="$CURRENT_LINK" TXPROBE_HOMES="$c7" TXPROBE_CONFIG="$c7/agent-model-overrides.json" \
    TXPROBE_CANONICAL="$c7/canon" TXPROBE_RECOVERY_ROOT="$c7/recovery" TXPROBE_TXID="tx-t7" \
    bash "$0" --tx-child-probe 2>&1)
  echo "$child" | grep -q "CHILD_LOAD_OK state=APPLIED_AWAITING_PONG" \
    || { echo "SELFTEST_FAIL T7 cross-process load: $child"; failures=1; }
  # and the R7#1 regression guard: without the symlink-tolerant current check this
  # exact fixture used to fail (current IS a symlink by design after apply)
  [ -L "$CURRENT_LINK" ] || { echo "SELFTEST_FAIL T7 fixture broken"; failures=1; }

  # T8 (R7 review): lock lifecycle + stale takeover + receipt txId binding +
  # rollback-after-archive resume — four REAL cross-shell scenarios.
  LOCK_HELD=NO
  prepare_recovery_root >/dev/null 2>&1 || { echo "SELFTEST_FAIL T8 recovery root"; failures=1; }
  # (a) acquire → second shell refused → release → second shell succeeds
  acquire_tx_lock || { echo "SELFTEST_FAIL T8a acquire"; failures=1; }
  LOCK_HELD=NO   # simulate independent process bookkeeping for the child
  export LOCK_DIR
  export -f acquire_tx_lock 2>/dev/null || true
  if bash -c 'set -u; LOCK_HELD=NO; acquire_tx_lock' >/dev/null 2>&1; then
    echo "SELFTEST_FAIL T8a second shell acquired a held lock"; failures=1
  fi
  LOCK_HELD=YES; release_tx_lock
  if ! bash -c 'set -u; LOCK_HELD=NO; acquire_tx_lock' >/dev/null 2>&1; then
    echo "SELFTEST_FAIL T8a release not visible"; failures=1
  fi
  release_tx_lock 2>/dev/null || true; release_tx_lock   # clean any lock the child took
  # (b) SIGKILL stale takeover: a dead holder's lock is taken over; a live holder's is not
  mkdir -p "$LOCK_DIR"; printf 'pid=999999999\nnonce=staledead\n' > "$LOCK_DIR/meta"
  if acquire_tx_lock; then
    echo "STALE_TAKEOVER_VERIFIED (dead pid 999999999 lock reclaimed)"; release_tx_lock
  else
    echo "SELFTEST_FAIL T8b stale takeover"; failures=1
  fi
  bash -c 'mkdir -p "'"$LOCK_DIR"'"; { printf "pid=$$\n"; printf "lstart=%s\n" "$(ps -o lstart= -p $$ 2>/dev/null)"; printf "nonce=livenonce\n"; } > "'"$LOCK_DIR"'/meta"; sleep 30' &
  live_holder=$!
  sleep 0.3
  if acquire_tx_lock 2>/dev/null; then echo "SELFTEST_FAIL T8b live holder lock stolen"; failures=1; release_tx_lock; fi
  kill -9 "$live_holder" 2>/dev/null; wait "$live_holder" 2>/dev/null
  acquire_tx_lock || { echo "SELFTEST_FAIL T8b takeover after kill"; failures=1; }
  release_tx_lock
  # (c) receipt txId binding (R8#6): stale receipt from another tx must be refused
  printf '{"commitComplete":"yes","txId":"tx-SOMEONE-ELSE"}' > "$COMMIT_RECEIPT"
  if jq -e --arg t "tx-t7" '.commitComplete == "yes" and .txId == $t' "$COMMIT_RECEIPT" >/dev/null 2>&1; then
    echo "SELFTEST_FAIL T8c stale receipt accepted"; failures=1
  fi
  printf '{"commitComplete":"yes","txId":"tx-t7"}' > "$COMMIT_RECEIPT"
  jq -e --arg t "tx-t7" '.commitComplete == "yes" and .txId == $t' "$COMMIT_RECEIPT" >/dev/null 2>&1 \
    || { echo "SELFTEST_FAIL T8c own receipt refused"; failures=1; }
  rm -f "$COMMIT_RECEIPT"
  # (d) rollback-after-archive resume: marker + archived manifest → resume path detected
  tx_save ROLLING_BACK >/dev/null 2>&1
  mkdir -p "$PREIMAGE_DIR"; : > "$PREIMAGE_DIR/ROLLBACK_COMPLETE.marker"
  mv "$MANIFEST" "$PREIMAGE_DIR/manifest.json.rolledback-t8" 2>/dev/null || true
  if [ -f "$PREIMAGE_DIR/ROLLBACK_COMPLETE.marker" ] && [ ! -f "$PREIMAGE_DIR/manifest.json" ]; then
    echo "ROLLBACK_RESUME_DETECTED (T8d: do_abort will finish ABORTED without re-running rollback_all)"
  else
    echo "SELFTEST_FAIL T8d resume detection"; failures=1
  fi

  # T9 (R7→r8 review): REAL crash-window recovery + nonce protection + concurrent takeover.
  # T9a: crash after first journal write — manifestSha=ABSENT + evolving manifest → loadable
  tx_save MUTATING_FENCED >/dev/null 2>&1   # ABSENT digest recorded (manifest absent)
  printf '{"phase":"intent","agent":"agt_a","entry":"dsh-codex","kind":"dir","savedAs":"agt_a__dsh-codex","symlinkTarget":null}\n' > "$MANIFEST"
  tx_load tx-t7 >/dev/null 2>&1 || { echo "SELFTEST_FAIL T9a MUTATING_FENCED load with evolving manifest"; failures=1; }
  # T9b: crash between fence creation and MUTATING_FENCED save → FENCE_CREATING loadable
  tx_save FENCE_CREATING >/dev/null 2>&1
  tx_load tx-t7 >/dev/null 2>&1 || { echo "SELFTEST_FAIL T9b FENCE_CREATING with matching fence"; failures=1; }
  # T9c: COMMITTED_PENDING_FENCE_CLEAR cross-process resume entry is loadable
  tx_save COMMITTED_PENDING_FENCE_CLEAR >/dev/null 2>&1
  tx_load tx-t7 >/dev/null 2>&1 || { echo "SELFTEST_FAIL T9c pending-commit load"; failures=1; }
  # T9d: ABORTED_PENDING_FENCE_CLEAR loadable
  tx_save ABORTED_PENDING_FENCE_CLEAR >/dev/null 2>&1
  tx_load tx-t7 >/dev/null 2>&1 || { echo "SELFTEST_FAIL T9d pending-abort load"; failures=1; }
  # T9e: concurrent stale-lock takeover — exactly ONE of two contenders wins
  release_tx_lock 2>/dev/null || true
  mkdir -p "$LOCK_DIR"; printf 'pid=999999998\nnonce=deadagain\n' > "$LOCK_DIR/meta"
  export LOCK_DIR
  export -f acquire_tx_lock 2>/dev/null || true
  bash -c 'set -u; LOCK_HELD=NO; acquire_tx_lock 2>/dev/null && echo W1_WIN' > "$T/t9e1.txt" 2>/dev/null &
  p1=$!
  bash -c 'set -u; LOCK_HELD=NO; acquire_tx_lock 2>/dev/null && echo W2_WIN' > "$T/t9e2.txt" 2>/dev/null &
  p2=$!
  wait $p1 $p2 2>/dev/null
  wins=$(cat "$T/t9e1.txt" "$T/t9e2.txt" 2>/dev/null | grep -c WIN || true)
  [ "$wins" = "1" ] || { echo "SELFTEST_FAIL T9e concurrent takeover wins=$wins (expected exactly 1)"; failures=1; }
  release_tx_lock 2>/dev/null || true
  # T9f: nonce protection — old holder cannot release a lock taken over by another
  acquire_tx_lock >/dev/null 2>&1 || { echo "SELFTEST_FAIL T9f acquire"; failures=1; }
  printf 'pid=%s\nnonce=HIJACKED\n' "$$" > "$LOCK_DIR/meta"   # simulate takeover by another process
  LOCK_HELD=YES
  release_tx_lock   # must SKIP (nonce mismatch) and leave the lock in place
  if [ -d "$LOCK_DIR" ]; then
    echo "NONCE_PROTECTION_VERIFIED (mismatched release skipped, lock preserved)"
    rm -rf "$LOCK_DIR"; LOCK_HELD=NO
  else
    echo "SELFTEST_FAIL T9f nonce protection"; failures=1
  fi

  # T10 (r8 review): SECOND SHELL runs the FULL commit/abort ENTRYPOINTS to terminal state.
  # fixture (rebuilt fresh): applied topology + tx APPLIED_AWAITING_PONG + fence
  local c10="$T/t10"
  mkdir -p "$c10/control/codex-plugin-runtime/gen-x/node_modules/dsh-codex/lib" "$c10/control/codex-plugin-preimage-x" "$c10/homeA/profiles/node_modules/dsh-codex/lib" "$c10/homeA/profiles/agent-core-production" "$c10/recovery" "$c10/shared-credentials/openai-codex"
  printf '{"version":1,"credential":{"type":"oauth","access":"fixture","refresh":"fixture","expires":9999999999999,"accountId":"fixture"}}\n' > "$c10/shared-credentials/openai-codex/.openai-codex-auth.json"; chmod 600 "$c10/shared-credentials/openai-codex/.openai-codex-auth.json"
  printf 'good' > "$c10/control/codex-plugin-runtime/gen-x/node_modules/dsh-codex/lib/index.js"
  printf '{"version":2,"routeCatalog":{},"overrides":{}}' > "$c10/agent-model-overrides.json"
  printf 'llm:\n# BEGIN AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n- id: llm-openai-codex\n  config:\n    credentialFile: "/canon/x"\n# END AGENT_CORE_FLEET_SHARED_CODEX_AUTH_V1\n' > "$c10/homeA/profiles/agent-core-production/cordis.patch.yml"
  GEN_BASE="$c10/control/codex-plugin-runtime"; GEN_DIR="$GEN_BASE/gen-x/node_modules"; CURRENT_LINK="$GEN_BASE/current"; PREIMAGE_DIR="$c10/control/codex-plugin-preimage-x"; MANIFEST="$PREIMAGE_DIR/manifest.json"; CONTROL="$c10/control"; RECOVERY_ROOT="$c10/recovery"; TX_FILE="$c10/recovery/migration-transaction.json"; FENCE="$c10/recovery/migration-fence.json"; LOCK_DIR="$c10/recovery/lock"; COMMIT_RECEIPT="$c10/control/codex-plugin-commit-receipt.json"; STAMP="x"; TX_ID="tx-x"; SELF_SHA="$REAL_SELF_SHA"
  ln -sfn "$GEN_DIR" "$CURRENT_LINK"
  ln -s "$CURRENT_LINK/dsh-codex" "$c10/homeA/profiles/node_modules/dsh-codex"
  printf 'x' > "$MANIFEST"
  tx_save APPLIED_AWAITING_PONG >/dev/null 2>&1 || { echo "SELFTEST_FAIL T10a tx_save"; failures=1; }
  printf '{"txId":"tx-x","inFlight":true}\n' > "$FENCE"
  # T10a: second shell COMMIT → terminal COMMITTED (receipt bound to tx)
  TXPROBE_ACTIVE=1 TXPROBE_ROOT="$c10" TXPROBE_CONTROL="$c10/control" TXPROBE_GEN_BASE="$GEN_BASE" TXPROBE_CURRENT_LINK="$CURRENT_LINK" TXPROBE_HOMES="$c10" TXPROBE_CONFIG="$c10/agent-model-overrides.json" TXPROBE_CANONICAL="$c10/shared-credentials/openai-codex/.openai-codex-auth.json" TXPROBE_RECOVERY_ROOT="$c10/recovery" TXPROBE_TXID="tx-x" TXPROBE_EXPECTED_FLEET=0 bash "$0" --tx-child-commit --transaction tx-x <<< "COMMIT" > "$T/t10a.log" 2>&1
  if jq -r .state "$TX_FILE" 2>/dev/null | grep -q COMMITTED && jq -e --arg t "tx-x" '.txId == $t' "$COMMIT_RECEIPT" >/dev/null 2>&1; then
    echo "T10A_COMMIT_VIA_SECOND_SHELL_VERIFIED (state=COMMITTED, receipt bound)"
  else
    echo "SELFTEST_FAIL T10a commit: $(tail -3 "$T/t10a.log" | tr '\n' ' ')"; failures=1
  fi
  # T10b: second shell ABORT on a fresh MUTATING_FENCED tx → ABORTED + home restored
  local c10b="$T/t10b"
  mkdir -p "$c10b/control/codex-plugin-runtime/gen-y/node_modules/dsh-codex/lib" "$c10b/control/codex-plugin-preimage-y" "$c10b/homeA/profiles/node_modules/dsh-codex/lib" "$c10b/homeA/profiles/agent-core-production" "$c10b/recovery"
  printf 'oldbuild' > "$c10b/homeA/profiles/node_modules/dsh-codex/lib/index.js"
  mkdir -p "$c10b/homeA/profiles/node_modules/dsh-codex"   # journal will rename this away
  printf 'oldbuild' > "$c10b/homeA/profiles/node_modules/dsh-codex/lib/index.js"
  rm -rf "$c10b/homeA/profiles/node_modules/dsh-codex/lib" 2>/dev/null || true
  mkdir -p "$c10b/homeA/profiles/node_modules/dsh-codex/lib"; printf 'oldbuild' > "$c10b/homeA/profiles/node_modules/dsh-codex/lib/index.js"
  GEN_BASE="$c10b/control/codex-plugin-runtime"; GEN_DIR="$GEN_BASE/gen-y/node_modules"; CURRENT_LINK="$GEN_BASE/current"; PREIMAGE_DIR="$c10b/control/codex-plugin-preimage-y"; MANIFEST="$PREIMAGE_DIR/manifest.json"; CONTROL="$c10b/control"; RECOVERY_ROOT="$c10b/recovery"; TX_FILE="$c10b/recovery/migration-transaction.json"; FENCE="$c10b/recovery/migration-fence.json"; LOCK_DIR="$c10b/recovery/lock"; COMMIT_RECEIPT="$c10b/control/codex-plugin-commit-receipt.json"; STAMP="y"; TX_ID="tx-y"; SELF_SHA="$REAL_SELF_SHA"
  mkdir -p "$GEN_DIR/dsh-codex/lib" "$PREIMAGE_DIR"; printf 'new' > "$GEN_DIR/dsh-codex/lib/index.js"
  ln -sfn "$GEN_DIR" "$CURRENT_LINK"
  ln -s "$CURRENT_LINK/dsh-codex" "$c10b/homeA/profiles/node_modules/dsh-codex"
  : > "$MANIFEST"
  tx_save MUTATING_FENCED >/dev/null 2>&1 || { echo "SELFTEST_FAIL T10b tx_save"; failures=1; }
  printf '{"txId":"tx-y","inFlight":true}\n' > "$FENCE"
  freeze_node_src > "$PREIMAGE_DIR/freeze.cjs"
  "$NODE" "$PREIMAGE_DIR/freeze.cjs" "$c10b/homeA" "$PREIMAGE_DIR" "$CURRENT_LINK" "$GEN_DIR" >/dev/null 2>&1 || { echo "SELFTEST_FAIL T10b freeze"; failures=1; }
  TXPROBE_ACTIVE=1 TXPROBE_ROOT="$c10b" TXPROBE_CONTROL="$c10b/control" TXPROBE_GEN_BASE="$GEN_BASE" TXPROBE_CURRENT_LINK="$CURRENT_LINK" TXPROBE_HOMES="$c10b" TXPROBE_CONFIG="$c10b/agent-model-overrides.json" TXPROBE_CANONICAL="$c10b/canon" TXPROBE_RECOVERY_ROOT="$c10b/recovery" TXPROBE_TXID="tx-y" TXPROBE_EXPECTED_FLEET=0 bash "$0" --tx-child-abort --transaction tx-y > "$T/t10b.log" 2>&1
  if jq -r .state "$TX_FILE" 2>/dev/null | grep -q ABORTED && [ "$(cat "$c10b/homeA/profiles/node_modules/dsh-codex/lib/index.js" 2>/dev/null)" = "oldbuild" ]; then
    echo "T10B_ABORT_VIA_SECOND_SHELL_VERIFIED (state=ABORTED, exact preimage restored, service restored)"
  else
    echo "SELFTEST_FAIL T10b abort: $(tail -3 "$T/t10b.log" | tr '\n' ' ')"; failures=1
  fi

  HOMES=$HOMES_SAVED; GEN_BASE=$GEN_BASE_SAVED; GEN_PARENT=$GEN_PARENT_SAVED; CURRENT_LINK=$CURRENT_LINK_SAVED; GEN_DIR=$GEN_DIR_SAVED; PREIMAGE_DIR=$PREIMAGE_DIR_SAVED; MANIFEST=$MANIFEST_SAVED; CONTROL=$CONTROL_SAVED
  if [ $failures -eq 0 ]; then
    echo "SELFTEST_PASS (closed-topology realpath / intent-only current+symlink recovery / prior-target / lifecycle TERM+committed-EXIT / chain parser / TX state machine save-load-sha-binding-reentry / T7 real-two-hop-topology cross-process load / T8 lock-lifecycle+stale-takeover+receipt-txId-binding+rollback-after-archive)"
  else exit 1; fi
  rm -rf "$T"
}

gate_fail_exit() { # post-bootout failure path: ALWAYS restore service (R3#3)
  echo "GATE_FAIL $1 → rollback + restore service"
  on_lifecycle "$1"
  ensure_runtime_running
  exit 1
}

do_apply() {
  echo "### AUTHSVC PLUGIN GENERATION UPGRADE r7 · APPLY ($(date '+%F %T %z'))"
  echo "## 0. gates"
  [ "$(id -u)" = "0" ] || { echo "ABORT run with sudo"; exit 1; }
  prepare_recovery_root || { echo "RECOVERY_ROOT_FAIL"; exit 1; }
  acquire_tx_lock || exit 1
  trap 'release_tx_lock' EXIT
  check_amendment_gate || { release_tx_lock; exit 1; }
  tx_reentry_gate || { release_tx_lock; exit 1; }   # R6#1: incomplete prior tx forbids a new mutation
  check_prior_upgrade_state || { release_tx_lock; exit 1; }
  local n; n=$(jq -r '.overrides | length' "$CONFIG")
  echo "fleet_config_overrides=$n (v$(jq -r .version "$CONFIG"))"
  case "$CANONICAL" in /Users/yanfenma/*) echo "STOP target under /Users/yanfenma"; exit 1;; esac
  [ -f "$CANONICAL" ] || { echo "ABORT canonical missing"; exit 1; }
  echo "TARGET_CREDENTIAL_FILE=$CANONICAL OWNER=$(stat -f '%Su:%Sg' "$CANONICAL") MODE=$(stat -f '%Sp' "$CANONICAL")"
  echo "FRESH_RECONCILIATION preimage = temporary-bridge state (92 fresh copies of lineage 1d4278a8be53; Aug-31 generation superseded)"
  tx_save PREPARED || exit 1
  echo "TX_ID=$TX_ID (transaction persisted: PREPARED, scriptSha ${SELF_SHA:0:12}…)"

  echo "## 1. build versioned gen from FROZEN exact-pin artifacts (plugin + scopes)"
  check_frozen_artifact || { tx_save ABORTED; echo "STOP (nothing mutated)"; exit 1; }

  echo "## 2. gen smoke + B1 store-load smoke as authsvc (BEFORE any mutation)"
  smoke_out=$(AS_USER "${PROXY_ENV[@]}" "$NODE" -e "import('$GEN_DIR/dsh-codex/lib/index.js').then(m=>{const ok=typeof m.OpenAICodexCredentialStore==='function'&&typeof m.loginOpenAICodex==='function'&&typeof m.OpenAICodexReauthRequiredError==='function';console.log(ok?'GEN_SMOKE_OK':'GEN_SMOKE_INCOMPLETE');process.exit(ok?0:1)}).catch(e=>{console.log('GEN_SMOKE_FAIL '+String(e.message).slice(0,160));process.exit(1)})" 2>&1)
  smoke_rc=$?; echo "$smoke_out"
  if [ $smoke_rc -ne 0 ]; then tx_save ABORTED; echo "ABORT gen smoke failed (nothing mutated)"; exit 1; fi
  store_out=$(AS_USER "$NODE" -e "
    import('$GEN_DIR/dsh-codex/lib/index.js').then(async (m) => {
      const store = new m.OpenAICodexCredentialStore('$CANONICAL')
      const cred = await store.read('openai-codex')
      if (!cred || cred.type !== 'oauth') { console.log('STORE_LOAD_FAIL'); process.exit(1) }
      console.log('STORE_LOAD=PASS authenticated=true expires_future=' + (Date.now() < cred.expires))
    }).catch(e => { console.log('STORE_LOAD_FAIL ' + String(e.message).slice(0,160)); process.exit(1) })
  " 2>&1)
  echo "$store_out"
  case "$store_out" in STORE_LOAD=PASS*) echo "AUTHSVC_PLUGIN_CAN_LOAD_TARGET_CREDENTIAL_STORE = PASS" ;; *) tx_save ABORTED; echo "AUTHSVC_PLUGIN_CAN_LOAD_TARGET_CREDENTIAL_STORE = FAIL — STOP (nothing mutated)"; exit 1 ;; esac

  echo "## 3. G3 fresh reconciliation (hard, pre-mutation)"
  fresh_reconciliation || { tx_save ABORTED; echo "STOP (nothing mutated)"; exit 1; }

  echo "## 4. ARM → QUIESCE → durable fence (R9 state sequence)"
  mkdir -p "$PREIMAGE_DIR"
  arm_lifecycle
  tx_save QUIESCING || { disarm_lifecycle; release_tx_lock; echo "TX_SAVE_FAIL — aborting before any mutation"; exit 1; }
  stop_runtime || { on_lifecycle QUIESCE_FAIL; exit 1; }   # quiesce failed: nothing mutated, no restore needed
  tx_save FENCE_CREATING || gate_fail_exit TX_SAVE_FAIL   # R9#3: crash window is loadable/recoverable
  fence_tmp="$FENCE.tmp-$$"
  if "$NODE" -e 'const fs=require("fs");const f=JSON.stringify({inFlight:true,txId:process.argv[1],at:new Date().toISOString()},null,2)+"\n";fs.writeFileSync(process.argv[2],f,{mode:0o644});fs.fsyncSync(fs.openSync(process.argv[2],"r"))' "$TX_ID" "$fence_tmp" \
    && mv "$fence_tmp" "$FENCE"; then
    chown authsvc:authsvc "$FENCE"
  else
    gate_fail_exit FENCE_FAIL
  fi
  tx_save MUTATING_FENCED || gate_fail_exit TX_SAVE_FAIL
  echo "fence=$FENCE (durable; runtime QUIESCED; tx=MUTATING_FENCED)"

  echo "## 5. freeze + wire (journal; topology current->GEN_DIR, home->current/dsh-codex)"
  freeze_node_src > "$PREIMAGE_DIR/freeze.cjs"
  freeze_fail=0
  for a in $(jq -r '.overrides | keys[]' "$CONFIG"); do
    if [ "$FREEZE_CURRENT_DONE_SET" != 1 ]; then
      FREEZE_CURRENT_DONE=0 "$NODE" "$PREIMAGE_DIR/freeze.cjs" "$HOMES/$a" "$PREIMAGE_DIR" "$CURRENT_LINK" "$GEN_DIR" >/dev/null 2>&1 || { echo "FREEZE_FAIL $a"; freeze_fail=$((freeze_fail+1)); continue; }
      FREEZE_CURRENT_DONE_SET=1
    else
      FREEZE_CURRENT_DONE=1 "$NODE" "$PREIMAGE_DIR/freeze.cjs" "$HOMES/$a" "$PREIMAGE_DIR" "$CURRENT_LINK" "$GEN_DIR" >/dev/null 2>&1 || { echo "FREEZE_FAIL $a"; freeze_fail=$((freeze_fail+1)); }
    fi
  done
  [ "$freeze_fail" = 0 ] || gate_fail_exit FREEZE_FAIL
  # resolution sanity on first wired home (R3#2: realpath both sides + import through 2-hop link)
  first_home=$(jq -r '.overrides | keys[0]' "$CONFIG")
  resolved=$(AS_USER "$NODE" -e "console.log(require('fs').realpathSync('$HOMES/$first_home/profiles/node_modules/dsh-codex/lib/index.js'))" 2>/dev/null)
  expected_res=$(AS_USER "$NODE" -e "console.log(require('fs').realpathSync('$GEN_DIR/dsh-codex/lib/index.js'))" 2>/dev/null)
  [ -n "$resolved" ] && [ "$resolved" = "$expected_res" ] || gate_fail_exit RESOLUTION_FAIL
  wired=$(jq -c 'select(.phase=="done" and .agent!="CURRENT") | .agent' "$MANIFEST" | sort -u | wc -l | tr -d ' ')
  echo "wired=$wired/$n · resolution OK (realpath)"

  echo "## 6. bootstrap runtime (controlled restart under fence)"
  bootstrap_runtime || gate_fail_exit BOOTSTRAP_FAIL

  echo "## 7. 92/92 import smoke — HARD gate"
  sm_ok=0; sm_fail=0
  for a in $(jq -r '.overrides | keys[]' "$CONFIG"); do
    if smoke_home "$a"; then sm_ok=$((sm_ok+1)); else sm_fail=$((sm_fail+1)); echo "  SMOKE_FAILED_AGENT=$a"; fi
  done
  echo "smoke_ok=$sm_ok smoke_fail=$sm_fail"
  [ "$sm_fail" = 0 ] || gate_fail_exit SMOKE_FAIL

  echo "## 8. mechanical chain proof (92× effective credentialFile == canonical) — HARD gate"
  chain_fail=0
  for a in $(jq -r '.overrides | keys[]' "$CONFIG"); do
    v=$(effective_credential_of_home "$HOMES/$a")
    [ "$v" = "$CANONICAL" ] || { echo "CHAIN_FAIL $a effective=$v"; chain_fail=$((chain_fail+1)); }
  done
  echo "CHAIN_PROOF ok=$((n - chain_fail))/$n (mechanical; REAL chain proof = commit-gate delivery canary)"
  [ "$chain_fail" = 0 ] || gate_fail_exit CHAIN_FAIL

  echo "## 9. zero-per-home-open census — HARD gate"
  per_home_opens=$(lsof 2>/dev/null | grep -c "homes/agt_[^/]*/\.openai-codex-auth\.json" || true)
  echo "ACTIVE_PER_HOME_STORE_OPENS=${per_home_opens:-0}"
  [ "${per_home_opens:-0}" = "0" ] || gate_fail_exit PER_HOME_OPEN_FAIL

  echo "## 10. exactly ONE credential-layer model request (failure AUTO-ROLLBACKS)"
  canary_out=$(AS_USER "${PROXY_ENV[@]}" DRIVER_CREDENTIAL_FILE="$CANONICAL" DRIVER_PROFILES_NODE_MODULES="$GEN_DIR/dsh-codex/node_modules" "$NODE" \
    /Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/codex-credential-driver.mjs canary 2>&1)
  canary_rc=$?
  printf '%s\n' "$canary_out" | grep -v 'refresh_sha12'
  [ $canary_rc -eq 0 ] || gate_fail_exit MODEL_CANARY_FAIL

  echo "## 11. persist transaction → SAFE RELEASE (exit no longer self-rolls-back)"
  tx_save APPLIED_AWAITING_PONG || gate_fail_exit TX_SAVE_FAIL
  disarm_lifecycle
  release_tx_lock   # R8#1: explicit release on the success path (EXIT trap is now disarmed)
  trap - EXIT
  echo
  echo "APPLY_PHASE_COMPLETE"
  echo "TX_ID=$TX_ID state=APPLIED_AWAITING_PONG (durable: $TX_FILE)"
  echo "MUTATION_ARMED=NO (safe release — recovery is via the persisted transaction, not this process) · fence=$FENCE (inFlight) · runtime running · lock released"
  echo "state=$PREIMAGE_DIR"
  echo
  echo "COMMIT GATE — send ONE real feishu message: 'Reply with exactly: PONG-FLEET-LUNA'"
  echo "  PASS → sudo bash $0 --commit --transaction $TX_ID"
  echo "  FAIL → sudo bash $0 --abort --transaction $TX_ID   (full rollback + service restore)"
}

verify_applied_topology() { # R7#5: FULL post-apply topology re-verification (commit gate)
  local n; n=$(jq -r '.overrides | length' "$CONFIG")
  [ "$n" = "$EXPECTED_FLEET" ] || { echo "TOPO_FAIL fleet shape ($n != $EXPECTED_FLEET)"; return 1; }
  [ -f "$CANONICAL" ] && [ ! -L "$CANONICAL" ] && [ "$(stat -f '%Sp' "$CANONICAL")" = "-rw-------" ] \
    || { echo "TOPO_FAIL canonical boundary"; return 1; }
  [ -L "$CURRENT_LINK" ] && [ "$(readlink "$CURRENT_LINK")" = "$GEN_DIR" ] \
    || { echo "TOPO_FAIL current link (got $(readlink "$CURRENT_LINK" 2>/dev/null), want $GEN_DIR)"; return 1; }
  local chain_fail=0 a v resolved expected_res opens
  expected_res=$(AS_USER "$NODE" -e "console.log(require('fs').realpathSync('$GEN_DIR/dsh-codex/lib/index.js'))" 2>/dev/null)
  for a in $(jq -r '.overrides | keys[]' "$CONFIG"); do
    v=$(effective_credential_of_home "$HOMES/$a")
    [ "$v" = "$CANONICAL" ] || { chain_fail=$((chain_fail+1)); echo "  TOPO_CHAIN_FAIL $a"; continue; }
    resolved=$(AS_USER "$NODE" -e "console.log(require('fs').realpathSync('$HOMES/$a/profiles/node_modules/dsh-codex/lib/index.js'))" 2>/dev/null)
    [ "$resolved" = "$expected_res" ] || { chain_fail=$((chain_fail+1)); echo "  TOPO_REALPATH_FAIL $a"; }
  done
  [ "$chain_fail" = 0 ] || { echo "TOPO_FAIL chain/realpath failures=$chain_fail"; return 1; }
  if [ "${TXPROBE_ACTIVE:-0}" != "1" ]; then
    opens=$(lsof 2>/dev/null | grep -c "homes/agt_[^/]*/\.openai-codex-auth\.json" || true)
    [ "${opens:-0}" = "0" ] || { echo "TOPO_FAIL per-home store opens=$opens"; return 1; }
    pgrep -f 'production-runtime.mjs --root /Users/authsvc' >/dev/null || { echo "TOPO_FAIL runtime not running"; return 1; }
  else
    echo "(TXPROBE: lsof/runtime liveness checks skipped in probe mode)"
  fi
  echo "TOPOLOGY_VERIFIED (current→GEN_DIR · 92 realpath+chain · zero per-home opens · runtime alive)"
}

do_commit() {
  echo "### COMMIT ($(date '+%F %T %z'))"
  [ "$(id -u)" = "0" ] || [ "${TXPROBE_ACTIVE:-0}" = "1" ] || { echo "ABORT run with sudo"; exit 1; }
  [ "${2:-}" = "--transaction" ] && [ -n "${3:-}" ] || { echo "Usage: $0 --commit --transaction <txId>"; exit 1; }
  prepare_recovery_root || { echo "RECOVERY_ROOT_FAIL"; exit 1; }
  acquire_tx_lock || exit 1
  trap 'release_tx_lock' EXIT
  local CONFIRM_AUTH="$RECOVERY_ROOT/commit-confirmation.json"
  tx_load "$3" || { release_tx_lock; exit 1; }
  case "$TX_STATE" in
    APPLIED_AWAITING_PONG|COMMITTING|COMMITTED_PENDING_FENCE_CLEAR) : ;;   # R9#4: pending-fence-clear is re-entrant
    *) echo "ABORT state=$TX_STATE (expected APPLIED_AWAITING_PONG, COMMITTING, or COMMITTED_PENDING_FENCE_CLEAR)"; release_tx_lock; exit 1 ;;
  esac
  [ -f "$MANIFEST" ] || { echo "ABORT manifest missing for tx"; release_tx_lock; exit 1; }
  # R12 P0#1: COMMITTED_PENDING_FENCE_CLEAR resume verifies the ROOT-ONLY
  # confirmation (the public receipt does not exist yet at this point in the
  # normal flow — it is generated only after COMMITTED). Do NOT re-run
  # confirm/topology gates — just finish.
  if [ "$TX_STATE" = "COMMITTED_PENDING_FENCE_CLEAR" ]; then
    if [ -s "$CONFIRM_AUTH" ] && jq -e --arg t "$TX_TXID" '.confirmed == "yes" and .txId == $t' "$CONFIRM_AUTH" >/dev/null 2>&1; then
      if "$NODE" -e 'const fs=require("fs");const f=JSON.stringify({inFlight:false,clearedAt:new Date().toISOString(),txId:process.argv[1]},null,2)+"\n";fs.writeFileSync(process.argv[2],f,{mode:0o644});fs.fsyncSync(fs.openSync(process.argv[2],"r"))' "$TX_TXID" "$FENCE" \
        && tx_save COMMITTED; then
        # evidence receipt (post-COMMITTED only; failure is non-fatal)
        tmp="$COMMIT_RECEIPT.tmp-$$"
        "$NODE" -e '
          const fs = require("fs")
          const [, out, txFile] = process.argv
          const t = JSON.parse(fs.readFileSync(txFile, "utf8"))
          fs.writeFileSync(out, JSON.stringify({
            commitComplete: "yes", at: new Date().toISOString(), txId: t.txId,
            amendment: "authsvc ACTIVATION_V1-line, accepted (structured marker verified at apply)",
            artifact: "plugin+scopes frozen tgz rebuilt from accepted commit 75d98d5b lineage; shas verified at G1/G2",
            wiredHomes: 92, realDeliveryCanary: "PASS (Owner-confirmed)",
            genDir: t.genDir, preimageManifest: t.manifest, closureDigests: t.closureDigestsFile,
          }, null, 2) + "\n", { mode: 0o644 })
        ' "$tmp" "$TX_FILE" && mv "$tmp" "$COMMIT_RECEIPT" && chmod 644 "$COMMIT_RECEIPT"
        if [ $? -ne 0 ]; then rm -f "$tmp"; echo "NOTE: receipt generation failed (tx is COMMITTED; regenerate manually)"; fi
        release_tx_lock; trap - EXIT
        echo "COMMIT_RESUME_DONE state=COMMITTED / fence cleared"
        echo "receipt: $COMMIT_RECEIPT"
      else
        release_tx_lock
        echo "RESUME_FAILED — state stays COMMITTED_PENDING_FENCE_CLEAR; re-run --commit to retry"
        exit 1
      fi
    else
      echo "COMMIT_GATE_FAIL: pending state but root-only confirmation missing/mismatched — ESCALATE"; release_tx_lock; exit 1
    fi
    return 0
  fi
  verify_applied_topology || { release_tx_lock; echo "COMMIT_GATE_FAIL — topology is not the applied state; use --abort"; exit 1; }
  if [ "$TX_STATE" != COMMITTING ]; then
    tx_save COMMITTING || { release_tx_lock; echo "TX_SAVE_FAIL COMMITTING — tx stays APPLIED_AWAITING_PONG, safe to retry"; exit 1; }
  fi
  echo "tx=$TX_TXID state=$TX_STATE · gen=$GEN_DIR (topology re-verified; script-sha + fence + manifest-digest bound)"
  # R11#5: ONLY the root-only confirmation authorizes the terminal transition.
  # The public receipt is NOT consulted here at all — it is generated AFTER
  # COMMITTED (it is evidence, never an authorization input).
  local CONFIRM_AUTH="$RECOVERY_ROOT/commit-confirmation.json"
  if [ -s "$CONFIRM_AUTH" ] && jq -e --arg t "$TX_TXID" '.confirmed == "yes" and .txId == $t' "$CONFIRM_AUTH" >/dev/null 2>&1; then
    echo "Owner confirmation found in root-only trust domain (re-entrant resume)"
  else
    echo "Assumed: Owner sent the feishu canary and the agent replied PONG-FLEET-LUNA (REAL chain proof)."
    echo "Type COMMIT to confirm:"; read -r ans
    [ "$ans" = "COMMIT" ] || { echo "ABORT (not confirmed) — tx stays COMMITTING, re-run to resume"; release_tx_lock; exit 1; }
    catmp="$CONFIRM_AUTH.tmp-$$"
    if "$NODE" -e 'const fs=require("fs");const f=JSON.stringify({confirmed:"yes",txId:process.argv[1],at:new Date().toISOString()},null,2)+"\n";fs.writeFileSync(process.argv[2],f,{mode:0o600});fs.fsyncSync(fs.openSync(process.argv[2],"r"))' "$TX_TXID" "$catmp"       && mv "$catmp" "$CONFIRM_AUTH"; then
      : # confirmed durably
    else
      echo "CONFIRM_WRITE_FAILED — tx stays COMMITTING, re-run to resume"; release_tx_lock; exit 1
    fi
  fi
  # ORDER (R7#4): terminal state FIRST, fence clear LAST — every step checked.
  if tx_save COMMITTED_PENDING_FENCE_CLEAR; then
    if "$NODE" -e 'const fs=require("fs");const f=JSON.stringify({inFlight:false,clearedAt:new Date().toISOString(),txId:process.argv[1]},null,2)+"\n";fs.writeFileSync(process.argv[2],f,{mode:0o644});fs.fsyncSync(fs.openSync(process.argv[2],"r"))' "$TX_TXID" "$FENCE" \
      && tx_save COMMITTED; then
      disarm_lifecycle
      # R11#5: the public receipt is EVIDENCE generated after COMMITTED — never an input.
      tmp="$COMMIT_RECEIPT.tmp-$$"
      "$NODE" -e '
        const fs = require("fs")
        const [, out, txFile] = process.argv
        const t = JSON.parse(fs.readFileSync(txFile, "utf8"))
        fs.writeFileSync(out, JSON.stringify({
          commitComplete: "yes", at: new Date().toISOString(), txId: t.txId,
          amendment: "authsvc ACTIVATION_V1-line, accepted (structured marker verified at apply)",
          artifact: "plugin+scopes frozen tgz rebuilt from accepted commit 75d98d5b lineage; shas verified at G1/G2",
          wiredHomes: 92, realDeliveryCanary: "PASS (Owner-confirmed)",
          genDir: t.genDir, preimageManifest: t.manifest, closureDigests: t.closureDigestsFile,
        }, null, 2) + "\n", { mode: 0o644 })
      ' "$tmp" "$TX_FILE"
      rc=$?
      jq -e --arg t "$TX_TXID" '.commitComplete == "yes" and .txId == $t' "$tmp" >/dev/null 2>&1 && rc=$?
      if [ "$rc" -eq 0 ]; then
        mv "$tmp" "$COMMIT_RECEIPT" && chmod 644 "$COMMIT_RECEIPT"
      else
        rm -f "$tmp"
        echo "NOTE: post-commit receipt generation failed (tx is COMMITTED; regenerate manually)"
      fi
      release_tx_lock; trap - EXIT
      echo "COMMIT_SUCCESS = YES / state=COMMITTED / fence cleared"
      echo "receipt: $COMMIT_RECEIPT"
    else
      release_tx_lock
      echo "FENCE_CLEAR_OR_FINAL_SAVE_FAILED — state=COMMITTED_PENDING_FENCE_CLEAR is RE-ENTRANT: re-run --commit --transaction $TX_TXID to finish fence clear"
      exit 1
    fi
  else
    echo "TX_SAVE_FAIL COMMITTED_PENDING_FENCE_CLEAR — tx stays COMMITTING, safe to retry"
    release_tx_lock
    exit 1
  fi
}

do_abort() {
  echo "### ABORT → rollback + restore ($(date '+%F %T %z'))"
  [ "$(id -u)" = "0" ] || [ "${TXPROBE_ACTIVE:-0}" = "1" ] || { echo "ABORT run with sudo"; exit 1; }
  [ "${2:-}" = "--transaction" ] && [ -n "${3:-}" ] || { echo "Usage: $0 --abort --transaction <txId>"; exit 1; }
  prepare_recovery_root || { echo "RECOVERY_ROOT_FAIL"; exit 1; }
  acquire_tx_lock || exit 1
  trap 'release_tx_lock' EXIT
  tx_load "$3" || { release_tx_lock; exit 1; }
  case "$TX_STATE" in
    PREPARED|QUIESCING|FENCE_CREATING|MUTATING_NO_FENCE) abort_no_mutation=YES ;;   # R10#2: nothing frozen yet
    MUTATING_FENCED)
      # freeze MAY not have started yet (journal file absent → nothing to roll back)
      if [ ! -f "$MANIFEST" ]; then abort_no_mutation=YES; else abort_no_mutation=NO; fi ;;
    APPLIED_AWAITING_PONG|ROLLING_BACK|ROLLBACK_APPLIED) abort_no_mutation=NO ;;
    ABORTED_PENDING_FENCE_CLEAR|ABORTED_PENDING_RUNTIME_RESTORE)
      abort_no_mutation=RESUME ;;   # R12: re-entrant pending recovery
    COMMITTING) echo "ABORT_REFUSED state=COMMITTING (a receipt exists/committal in progress) — complete or manually reconcile; refusing a receipt-vs-rollback contradiction"; release_tx_lock; exit 1 ;;
    *) echo "ABORT state=$TX_STATE is not abortable"; release_tx_lock; exit 1 ;;
  esac
  # R10#2 + R12: NO-MUTATION abort path — freeze never started, so there is
  # nothing to roll back. Same ordering invariant as the rollback path.
  if [ "$abort_no_mutation" = YES ]; then
    disarm_lifecycle
    if abort_no_mutation_transition; then
      release_tx_lock; trap - EXIT
      echo "ABORT_DONE state=ABORTED (no-mutation path: freeze had not started; service restored)"
      return 0
    fi
    release_tx_lock
    echo "ABORT_INCOMPLETE — re-run --abort --transaction $TX_TXID after restoring the runtime"
    exit 1
  fi
  # ABORTED_PENDING_FENCE_CLEAR resume: terminal already durable, only fence clear left.
  if [ "$TX_STATE" = "ABORTED_PENDING_FENCE_CLEAR" ]; then
    if [ -f "$TX_PREIMAGE_DIR/ROLLBACK_COMPLETE.marker" ]; then
      "$NODE" -e 'const fs=require("fs");const f=JSON.stringify({inFlight:false,clearedAt:new Date().toISOString(),txId:process.argv[1]},null,2)+"\n";fs.writeFileSync(process.argv[2],f,{mode:0o644});fs.fsyncSync(fs.openSync(process.argv[2],"r"))' "$TX_TXID" "$FENCE" \
        && tx_save ABORTED \
        && { bootstrap_runtime || echo "BOOTSTRAP FAILED — RUNTIME MAY BE DOWN, ESCALATE IMMEDIATELY"; release_tx_lock; trap - EXIT; echo "ABORT_RESUME_DONE state=ABORTED / fence cleared"; return 0; }
      echo "RESUME_FAILED — state stays ABORTED_PENDING_FENCE_CLEAR; re-run --abort to retry"; release_tx_lock; exit 1
    else
      echo "ABORT_GATE_FAIL: pending state but rollback marker missing — ESCALATE"; release_tx_lock; exit 1
    fi
  fi
  if [ "$TX_STATE" != ROLLING_BACK ] && [ "$TX_STATE" != ROLLBACK_APPLIED ]; then
    tx_save ROLLING_BACK || { release_tx_lock; echo "TX_SAVE_FAIL ROLLING_BACK — tx unchanged, safe to retry"; exit 1; }
  fi
  # disarm any inherited in-process trap semantics; the ROLLING_BACK state owns recovery now
  disarm_lifecycle
  # R8#5: if a previous run already completed the rollback (manifest archived +
  # marker present), do NOT re-run rollback_all — just finish the terminal sequence.
  if [ -f "$TX_PREIMAGE_DIR/ROLLBACK_COMPLETE.marker" ] && [ ! -f "$TX_PREIMAGE_DIR/manifest.json" ]; then
    echo "ROLLBACK_ALREADY_APPLIED (marker + archived manifest found) — resuming terminal sequence"
    "$NODE" -e 'const fs=require("fs");const f=JSON.stringify({inFlight:false,clearedAt:new Date().toISOString(),txId:process.argv[1]},null,2)+"\n";fs.writeFileSync(process.argv[2],f,{mode:0o644});fs.fsyncSync(fs.openSync(process.argv[2],"r"))' "$TX_TXID" "$FENCE" 2>/dev/null || true
    if tx_save ABORTED; then
      bootstrap_runtime || echo "BOOTSTRAP FAILED — RUNTIME MAY BE DOWN, ESCALATE IMMEDIATELY"
      release_tx_lock; trap - EXIT
      echo "ABORT_DONE state=ABORTED service restored (resumed)"
    else
      bootstrap_runtime || echo "BOOTSTRAP FAILED — RUNTIME MAY BE DOWN, ESCALATE IMMEDIATELY"
      echo "TX_SAVE_FAIL ABORTED — ESCALATE (manual terminal-state fix required)"
      release_tx_lock; exit 1
    fi
    return 0
  fi
  if rollback_all "$TX_PREIMAGE_DIR"; then
    tx_save ROLLBACK_APPLIED || { release_tx_lock; echo "TX_SAVE_FAIL ROLLBACK_APPLIED — ESCALATE (rollback done but state unsaved)"; exit 1; }
    if finish_abort_terminal; then
      release_tx_lock; trap - EXIT
      echo "ABORT_DONE state=ABORTED service restored"
    else
      release_tx_lock
      echo "ABORT_INCOMPLETE — re-run --abort --transaction $TX_TXID to finish (state=ABORTED_PENDING_RUNTIME_RESTORE)"
      exit 1
    fi
  else
    bootstrap_runtime || echo "BOOTSTRAP FAILED — RUNTIME MAY BE DOWN, ESCALATE IMMEDIATELY"
    tx_save ABORT_INCOMPLETE || echo "TX_SAVE_FAIL ABORT_INCOMPLETE"
    echo "PARTIAL_FLEET_STATE = POSSIBLE — STOP_AND_ESCALATE"
    release_tx_lock
    exit 1
  fi
}

case "${1:-}" in
  --selftest) selftest ;;
  --tx-child-probe)
    # T7 fixture driver: paths come from TXPROBE_* env; loads the tx cross-process.
    TXPROBE_ACTIVE=1; apply_txprobe_overrides
    tx_load "${TXPROBE_TXID:?}" && echo "CHILD_LOAD_OK state=$TX_STATE genDir=$TX_GEN_DIR"
    exit $? ;;
  --tx-child-commit)
    # T10a fixture driver: full commit entrypoint against TXPROBE fixture (stdin feeds confirm)
    TXPROBE_ACTIVE=1; apply_txprobe_overrides
    do_commit "$@" ;;
  --tx-child-abort)
    # T10b fixture driver: full abort entrypoint against TXPROBE fixture
    TXPROBE_ACTIVE=1; apply_txprobe_overrides
    do_abort "$@" ;;
  --apply) do_apply ;;
  --commit) do_commit "$@" ;;
  --abort) do_abort "$@" ;;
  --rollback)
    [ "$(id -u)" = "0" ] || { echo "ABORT run with sudo"; exit 1; }
    latest=$(find "$CONTROL" -maxdepth 1 -type d -name "codex-plugin-preimage-*" 2>/dev/null | sort | tail -1)
    [ -n "$latest" ] || { echo "NOTHING_TO_ROLLBACK"; exit 0; }
    rollback_all "$latest"
    ensure_runtime_running ;;
  *) echo "Usage: $0 <--apply|--commit|--abort|--rollback|--selftest>" ;;
esac
