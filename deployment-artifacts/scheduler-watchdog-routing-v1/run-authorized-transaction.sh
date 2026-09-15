#!/bin/bash
# =============================================================================
# run-authorized-transaction.sh — WATCHDOG bounded production transaction slot
# (PRODUCTION_TRANSACTION_AUTHORIZED=YES, Owner authorization 2026-09-15).
#
# Executes docs/runbooks/SCHEDULER_WATCHDOG_PRODUCTION_CLOSURE_RUNBOOK_V1
# §1-§5 as ONE gated sequence. Any gate failure = FAIL_CLOSED, exit non-zero,
# no mutation beyond the gates already passed. Scope is bounded — this script
# performs NO store edits, NO fence release, NO cleanup beyond its gates.
#
# Usage (root):
#   sudo env ROOT_PRODUCTION_TRANSACTION_SLOT=FREE \
#            SCHEDULER_PRODUCTION_MUTATION_SLOT=FREE \
#            NO_CONFLICTING_SCHEDULER_TRANSACTION=YES \
#        ./run-authorized-transaction.sh <MAIN_WORKTREE> <STAGING_DIR>
#   <MAIN_WORKTREE>  e.g. /Users/yanfenma/workspace/project/dsh-agent-core
#   <STAGING_DIR>    e.g. /private/tmp/authorized-deploy-tx  (worktree target)
#
# Selftest (offline, no root, no production touch):
#   bash run-authorized-transaction.sh --selftest
# =============================================================================
set -euo pipefail

AUTH_MAIN_SHA="f0459522cdbdf3b065f2d89e4332d88013537eb9"
REVIEWED_CODE_SHA="7e645ea2a4b353c2e79b4a735aa9ab7a89d5de68"
APP_ROOT="/usr/local/libexec/agent-core/app"
CANONICAL_STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
ROUTING_TARGET="/Users/authsvc/.agent-core/scheduler/routing.json"
RUNTIME_LABEL="system/ai.agent-core.runtime"

gate() { # gate NAME RESULT DETAIL
  if [ "$2" = "0" ]; then echo "✔ $1${3:+ — $3}"; else echo "✖ FAIL_CLOSED $1${3:+ — $3}"; exit 1; fi
}

selftest() {
  bash -n "$0" && echo "✔ syntax" || exit 1
  command -v git >/dev/null && command -v node >/dev/null && echo "✔ tooling present"
  echo "✔ SELFTEST complete (offline: syntax + tooling; all production gates run live in §G)"
}

# ---- §G fresh safety gates (before ANY mutation) ---------------------------
GATES() {
  local MAIN_WORKTREE="$1"
  [ "$(id -u)" = "0" ] || { echo "✖ must run as root (sudo)"; exit 1; }
  [ "${ROOT_PRODUCTION_TRANSACTION_SLOT:-}" = "FREE" ] || gate "ROOT_PRODUCTION_TRANSACTION_SLOT" 1 "env!=FREE"
  [ "${SCHEDULER_PRODUCTION_MUTATION_SLOT:-}" = "FREE" ] || gate "SCHEDULER_PRODUCTION_MUTATION_SLOT" 1 "env!=FREE"
  [ "${NO_CONFLICTING_SCHEDULER_TRANSACTION:-}" = "YES" ] || gate "NO_CONFLICTING_SCHEDULER_TRANSACTION" 1 "env!=YES"
  echo "✔ §3 slot gates: FREE/FREE/YES"
  git -C "$MAIN_WORKTREE" rev-parse HEAD | grep -q "^$AUTH_MAIN_SHA$" \
    || gate "authorized main sha" 1 "worktree HEAD != $AUTH_MAIN_SHA"
  git -C "$MAIN_WORKTREE" rev-parse origin/main | grep -q "^$AUTH_MAIN_SHA$" \
    || gate "origin/main is the authorized artifact" 1 "origin/main moved — STOP, re-verify"
  # Reviewed-code binding: everything after the reviewed head must be docs/artifacts only.
  CODE_DELTA=$(git -C "$MAIN_WORKTREE" diff --name-only "$REVIEWED_CODE_SHA..$AUTH_MAIN_SHA" | grep -v -E '^(docs/|deployment-artifacts/|\.agents/)' || true)
  [ -z "$CODE_DELTA" ] || gate "code delta beyond reviewed head" 1 "$CODE_DELTA"
  echo "✔ CURRENT_MAIN_SHA matches authorized deploy artifact ($AUTH_MAIN_SHA; code == reviewed $REVIEWED_CODE_SHA)"
  [ -f "$CANONICAL_STORE" ] || gate "canonical store readable" 1 "$CANONICAL_STORE"
  echo "EXPECTED_STORE_SHA256=$(shasum -a 256 "$CANONICAL_STORE" | cut -d' ' -f1)"
  [ -f "$ROUTING_TARGET" ] \
    && echo "EXPECTED_ROUTING_TARGET_HASH(pre)=$(shasum -a 256 "$ROUTING_TARGET" | cut -d' ' -f1)" \
    || echo "EXPECTED_ROUTING_TARGET_HASH(pre)=null"
  echo "EXPECTED_RUNTIME_GENERATION(pre)=$(launchctl print "$RUNTIME_LABEL" 2>/dev/null | grep -m1 'state =' | tr -d ' ,' || echo unknown)"
}

# ---- §1/§2 deploy current main via the accepted installer -------------------
DEPLOY() {
  local MAIN_WORKTREE="$1" STAGING_DIR="$2"
  rm -rf "$STAGING_DIR"
  git clone --no-hardlinks --quiet "$MAIN_WORKTREE" "$STAGING_DIR" || gate "staging clone" 1
  git -C "$STAGING_DIR" checkout --quiet --detach "$AUTH_MAIN_SHA" || gate "staging checkout" 1
  git -C "$STAGING_DIR" rev-parse HEAD | grep -q "^$AUTH_MAIN_SHA$" || gate "staging detached at authorized sha" 1
  bash "$STAGING_DIR/scripts/trusted-cp-deploy-install.sh" "$STAGING_DIR" 2>&1 | tee /tmp/wgr-tx-deploy.log
  gate "deploy installer exit" "${PIPESTATUS[0]}"
}

# ---- §2 routing: selftest → candidate → check → plan → apply ----------------
ROUTING() {
  local STAGING_DIR="$1"
  local INSTALLER="$STAGING_DIR/deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs"
  [ -f "$INSTALLER" ] || gate "installer present" 1 "$INSTALLER"
  NODE="${APP_ROOT%/app}/node-runtime/bin/node"; [ -x "$NODE" ] || NODE="$(command -v node)"
  "$NODE" "$INSTALLER" --selftest || gate "routing --selftest" 1
  "$NODE" "$INSTALLER" --candidate || gate "routing --candidate" 1
  env ROOT_PRODUCTION_TRANSACTION_SLOT=FREE SCHEDULER_PRODUCTION_MUTATION_SLOT=FREE \
      NO_CONFLICTING_SCHEDULER_TRANSACTION=YES \
      "$NODE" "$INSTALLER" --check || gate "routing --check (incl. OPS_TARGET_OVERLAPS=NO)" 1
  "$NODE" "$INSTALLER" --plan || gate "routing --plan (zero-write)" 1
  "$NODE" "$INSTALLER" --apply || gate "routing --apply + readback" 1
}

# ---- §5 runtime reload + readiness ------------------------------------------
RELOAD() {
  launchctl kickstart -k "$RUNTIME_LABEL" || gate "kickstart" 1
  sleep 5
  launchctl print "$RUNTIME_LABEL" | grep -m1 'state = running' >/dev/null \
    && echo "✔ runtime state=running" || gate "runtime state" 1 "not running"
}

case "${1:-}" in
  --selftest) selftest; exit 0 ;;
  "") echo "usage: sudo $0 <MAIN_WORKTREE> <STAGING_DIR> | --selftest"; exit 2 ;;
  *) MAIN_WORKTREE="$1"; STAGING_DIR="$2"
     GATES "$MAIN_WORKTREE"
     DEPLOY "$MAIN_WORKTREE" "$STAGING_DIR"
     ROUTING "$STAGING_DIR"
     RELOAD
     echo "TRANSACTION_SEQUENCE_COMPLETE — readbacks: health provenance + receipts are the next acceptance inputs" ;;
esac
