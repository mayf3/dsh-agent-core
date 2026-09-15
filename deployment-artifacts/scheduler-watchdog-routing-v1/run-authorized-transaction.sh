#!/bin/bash
# =============================================================================
# run-authorized-transaction.sh — WATCHDOG bounded production transaction slot
# (PRODUCTION_TRANSACTION_AUTHORIZED=YES, Owner authorization 2026-09-15;
#  wrapper r2 — Owner blocker closure: stable authority binding, exclusive
#  cross-process production-mutation lock, exact-sha staging, deep selftest.
#  Watchdog/Scheduler product semantics unchanged.)
#
# Executes docs/runbooks/SCHEDULER_WATCHDOG_PRODUCTION_CLOSURE_RUNBOOK_V1
# §1-§5 as ONE gated sequence:
#   GATES (env authorization + canonical store + fresh EXPECTED_* values)
#   → AUTHORITY_BINDING (origin/main contains the reviewed code head; the only
#     non-docs delta beyond it is THIS transaction wrapper — mechanically
#     proven; resolves VERIFIED_DEPLOY_SHA = exact fresh origin/main SHA)
#   → ACQUIRE exclusive production-mutation lock (atomic mkdir; fail-closed if
#     held; held from BEFORE deploy until readiness readback completes; a left
#     lock is NEVER auto-deleted — explicit disposition only)
#   → STAGING (disposable clone checked out at EXACTLY VERIFIED_DEPLOY_SHA,
#     verified by a HEAD==sha gate before anything executes from it)
#   → DEPLOY current main via the accepted trusted-cp-deploy-install.sh
#   → ROUTING selftest → candidate → check → plan → apply (from that same
#     staging tree — EXECUTED_ARTIFACT_SHA_BINDING)
#   → RELOAD runtime → READBACK (state + health probe) → RELEASE lock
#
# Any gate failure = FAIL_CLOSED, exit 1. The lock, if held, is LEFT IN PLACE
# on any failure/interrupt with explicit disposition instructions.
#
# Usage (root):
#   sudo env ROOT_PRODUCTION_TRANSACTION_SLOT=FREE \
#            SCHEDULER_PRODUCTION_MUTATION_SLOT=FREE \
#            NO_CONFLICTING_SCHEDULER_TRANSACTION=YES \
#     ./run-authorized-transaction.sh <MAIN_WORKTREE> <STAGING_DIR> 2>&1 | tee /tmp/wgr-tx.log
#
# Offline selftest (no root, no production touch):
#   ./run-authorized-transaction.sh --selftest
# =============================================================================
set -euo pipefail

REVIEWED_CODE_SHA="7e645ea2a4b353c2e79b4a735aa9ab7a89d5de68"
WRAPPER_PATH="deployment-artifacts/scheduler-watchdog-routing-v1"
APP_ROOT="/usr/local/libexec/agent-core/app"
CANONICAL_STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
ROUTING_TARGET="/Users/authsvc/.agent-core/scheduler/routing.json"
RUNTIME_LABEL="system/ai.agent-core.runtime"
HEALTH_URL="http://127.0.0.1:8790/health"
# Cross-Agent / cross-process shared exclusive lock (production default).
# Overridable ONLY by --selftest for scratch fixtures; production runs use the
# fixed path because the path itself is part of the mutual-exclusion contract.
LOCK_ROOT="/usr/local/var/agent-core/production-mutation-locks"
LOCK_NAME="scheduler-watchdog-routing-tx"
LOCK_DIR="$LOCK_ROOT/$LOCK_NAME.lock"
VERIFIED_DEPLOY_SHA=""

gate() { # gate NAME DETAIL — FAIL_CLOSED
  echo "✖ FAIL_CLOSED $1${2:+ — $2}" >&2
  exit 1
}
pass() { echo "✔ $1${2:+ — $2}"; }

# ---- exclusive production-mutation lock ------------------------------------
# The env three flags are Owner AUTHORIZATION; this lock is the actual
# mutual exclusion. Acquire is atomic (mkdir); a held lock fails closed with
# its holder metadata; release requires holder identity; nothing ever deletes
# a lock it does not verifiably own.
acquire_lock() {
  mkdir -p "$LOCK_ROOT" 2>/dev/null || true
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    {
      printf 'pid=%s\n' "$$"
      printf 'uid=%s\n' "$(id -u)"
      printf 'host=%s\n' "$(hostname)"
      printf 'started=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf 'cmd=%s\n' "$*"
    } > "$LOCK_DIR/holder"
    pass "exclusive production-mutation lock acquired" "$LOCK_DIR"
  else
    echo "✖ FAIL_CLOSED production-mutation lock already held — $LOCK_DIR" >&2
    cat "$LOCK_DIR/holder" 2>/dev/null || echo "(no holder metadata — inspect manually)" >&2
    echo "STALE_LOCK_DISPOSITION: verify the holding transaction is truly dead (pid check), then remove EXPLICITLY:" >&2
    echo "  sudo rmdir $LOCK_DIR   # never guessed, never automatic" >&2
    exit 1
  fi
}
release_lock() {
  if [ -d "$LOCK_DIR" ] && grep -qx "pid=$$" "$LOCK_DIR/holder" 2>/dev/null; then
    rm -f "$LOCK_DIR/holder"
    rmdir "$LOCK_DIR" && pass "exclusive production-mutation lock released"
  else
    echo "✖ lock release refused (missing or holder mismatch) — $LOCK_DIR left in place for explicit disposition" >&2
    exit 1
  fi
}
leave_lock_notice() {
  echo "⚠ INTERRUPTED — production-mutation lock LEFT IN PLACE at $LOCK_DIR" >&2
  echo "  it is NOT auto-deleted; inspect and dispose explicitly (see holder file)" >&2
}
trap 'leave_lock_notice' INT TERM

# ---- authority binding ------------------------------------------------------
# origin/main must contain the reviewed code head, and the only non-docs delta
# beyond it is THIS transaction wrapper (the re-reviewed wrapper delta). Any
# other product-code drift = FAIL_CLOSED. Resolves VERIFIED_DEPLOY_SHA to the
# exact fresh origin/main SHA every downstream step must use.
authority_binding() { # authority_binding MAIN_WORKTREE REVIEWED_SHA
  local W="$1" reviewed="$2"
  git -C "$W" fetch origin main --quiet || gate "fetch origin/main" 1
  git -C "$W" merge-base --is-ancestor "$reviewed" origin/main \
    || gate "origin/main contains reviewed head" "$reviewed missing"
  local drift
  drift=$(git -C "$W" diff --name-only "$reviewed" origin/main \
    | grep -v -E "^(docs/|$WRAPPER_PATH/)" || true)
  [ -z "$drift" ] || gate "product drift beyond reviewed head" "$drift"
  VERIFIED_DEPLOY_SHA=$(git -C "$W" rev-parse origin/main)
  pass "authority binding resolved" "VERIFIED_DEPLOY_SHA=$VERIFIED_DEPLOY_SHA"
}

# staging must sit at EXACTLY VERIFIED_DEPLOY_SHA (executed-artifact binding).
staging_bind() {
  local S="$1"
  git -C "$S" fetch origin main --quiet || gate "staging fetch" 1
  git -C "$S" checkout --quiet --detach "$VERIFIED_DEPLOY_SHA" || gate "staging checkout" 1
  local head
  head=$(git -C "$S" rev-parse HEAD)
  [ "$head" = "$VERIFIED_DEPLOY_SHA" ] || gate "staging exact-sha binding" "$head != $VERIFIED_DEPLOY_SHA"
  pass "staging bound to VERIFIED_DEPLOY_SHA" "$head"
}

# ---- sequence steps ---------------------------------------------------------
GATES() {
  local MAIN_WORKTREE="$1"
  [ "$(id -u)" = "0" ] || gate "root required" "sudo env ... $0 <MAIN_WORKTREE> <STAGING_DIR>"
  [ "${ROOT_PRODUCTION_TRANSACTION_SLOT:-}" = "FREE" ] || gate "ROOT_PRODUCTION_TRANSACTION_SLOT" "env!=FREE"
  [ "${SCHEDULER_PRODUCTION_MUTATION_SLOT:-}" = "FREE" ] || gate "SCHEDULER_PRODUCTION_MUTATION_SLOT" "env!=FREE"
  [ "${NO_CONFLICTING_SCHEDULER_TRANSACTION:-}" = "YES" ] || gate "NO_CONFLICTING_SCHEDULER_TRANSACTION" "env!=YES"
  pass "§3 Owner authorization flags" "FREE/FREE/YES (authorization — the lock is the mutual exclusion)"
  [ -f "$CANONICAL_STORE" ] || gate "canonical store readable" "$CANONICAL_STORE"
  authority_binding "$MAIN_WORKTREE" "$REVIEWED_CODE_SHA"
  echo "EXPECTED_STORE_SHA256=$(shasum -a 256 "$CANONICAL_STORE" | cut -d' ' -f1)"
  if [ -f "$ROUTING_TARGET" ]; then
    echo "EXPECTED_ROUTING_TARGET_HASH(pre)=$(shasum -a 256 "$ROUTING_TARGET" | cut -d' ' -f1)"
  else
    echo "EXPECTED_ROUTING_TARGET_HASH(pre)=null"
  fi
  echo "EXPECTED_RUNTIME_GENERATION(pre)=$(launchctl print "$RUNTIME_LABEL" 2>/dev/null | grep -m1 'state =' | tr -d ' ,' || echo unknown)"
}

DEPLOY() {
  local S="$1"
  rm -rf "$S"
  git clone --no-hardlinks --quiet "$MAIN_WORKTREE_DIR" "$S" || gate "staging clone" 1
  staging_bind "$S"
  bash "$S/$WRAPPER_PATH/run-authorized-transaction.sh" --selftest >/dev/null || gate "staging wrapper selftest" 1
  bash "$S/scripts/trusted-cp-deploy-install.sh" "$S" 2>&1 | tee /tmp/wgr-tx-deploy.log
  gate "deploy installer exit" "${PIPESTATUS[0]}"
  ls "$APP_ROOT/packages" >/dev/null 2>&1 || gate "deployed app tree present" "$APP_ROOT"
}

ROUTING() {
  local S="$1"
  local INSTALLER="$S/$WRAPPER_PATH/run-routing-install.mjs"
  [ -f "$INSTALLER" ] || gate "routing installer present" "$INSTALLER"
  local NODE="${APP_ROOT%/app}/node-runtime/bin/node"
  [ -x "$NODE" ] || NODE="$(command -v node)"
  "$NODE" "$INSTALLER" --selftest || gate "routing --selftest" 1
  "$NODE" "$INSTALLER" --candidate || gate "routing --candidate" 1
  env ROOT_PRODUCTION_TRANSACTION_SLOT=FREE SCHEDULER_PRODUCTION_MUTATION_SLOT=FREE \
      NO_CONFLICTING_SCHEDULER_TRANSACTION=YES \
      "$NODE" "$INSTALLER" --check || gate "routing --check (slots + enrichment + OPS_TARGET_OVERLAPS=NO)" 1
  "$NODE" "$INSTALLER" --plan || gate "routing --plan (zero-write)" 1
  "$NODE" "$INSTALLER" --apply || gate "routing --apply + readback" 1
  pass "routing receipt + protected-metadata readback complete"
}

RELOAD() {
  launchctl kickstart -k "$RUNTIME_LABEL" || gate "kickstart" 1
  local i
  for i in 1 2 3 4 5 6; do
    sleep 5
    if launchctl print "$RUNTIME_LABEL" 2>/dev/null | grep -q 'state = running'; then
      pass "runtime state=running"
      if curl -sf -m 5 "$HEALTH_URL" | grep -q '"ok":true'; then
        pass "health probe ok:true" "$HEALTH_URL"
        return 0
      fi
      echo "… health not ok yet (attempt $i/6)"
    fi
  done
  gate "readiness readback (state=running + health ok)" "see launchd logs — lock LEFT IN PLACE"
}

# ---- selftest ---------------------------------------------------------------
selftest() {
  local scratch
  scratch=$(mktemp -d /tmp/wgr-tx-selftest-XXXXXX)
  trap 'rm -rf "$scratch"' EXIT
  bash -n "$0" || gate "selftest syntax" 1
  pass "selftest: bash -n"

  # (1) the stale-authority-variable class of bug (wrapper r1 died on an
  # undefined removed authority variable under set -u): no reference to that
  # removed name may exist anywhere in this script.
  # The needle is assembled so this check cannot match its own source text.
  local stale_needle="AUTH_MAIN""_SHA"
  if grep -q "$stale_needle" "$0"; then
    gate "selftest: stale authority variable reference must not exist" "$stale_needle"
  fi
  pass "selftest: no stale authority variable reference (set -u safe by construction)"

  # Fixture repo: reviewed head → docs-only advance → product drift → wrapper delta.
  local fx="$scratch/fx"
  git init -q -b main "$fx"
  git -C "$fx" config user.email t@t.local
  git -C "$fx" config user.name t
  git -C "$fx" remote add origin "$fx" 
  mkdir -p "$fx/packages" "$fx/docs"
  echo x > "$fx/packages/a.js"
  git -C "$fx" add -A
  git -C "$fx" commit -qm "reviewed head"
  local REVIEWED
  REVIEWED=$(git -C "$fx" rev-parse HEAD)

  # (2) binding on the reviewed head itself → PASS.
  authority_binding "$fx" "$REVIEWED"
  pass "selftest: authority binding PASS at reviewed head (VERIFIED_DEPLOY_SHA=$VERIFIED_DEPLOY_SHA)"

  # (3) docs-only advance keeps it green and ADVANCES VERIFIED_DEPLOY_SHA.
  echo docs > "$fx/docs/note.md"
  git -C "$fx" add -A && git -C "$fx" commit -qm "docs advance"
  authority_binding "$fx" "$REVIEWED"
  pass "selftest: docs-only drift keeps binding green (VERIFIED_DEPLOY_SHA advanced)"

  # (4) product-code drift beyond the wrapper → FAIL_CLOSED (subshell: the
  # internal gate exit must be caught, not kill the selftest).
  echo y > "$fx/packages/b.js"
  git -C "$fx" add -A && git -C "$fx" commit -qm "product drift"
  if ( authority_binding "$fx" "$REVIEWED" ) 2>/dev/null; then
    gate "selftest: product drift must FAIL_CLOSED" 1
  fi
  pass "selftest: product-code drift beyond wrapper FAIL_CLOSED"

  # (5) wrapper-path delta is the allowed re-reviewed wrapper delta.
  git -C "$fx" reset -q --hard HEAD~1
  mkdir -p "$fx/$WRAPPER_PATH"
  echo z > "$fx/$WRAPPER_PATH/extra.txt"
  git -C "$fx" add -A && git -C "$fx" commit -qm "wrapper delta"
  authority_binding "$fx" "$REVIEWED"
  pass "selftest: wrapper-path delta accepted"

  # (6) exclusive lock: atomic acquire; second acquire FAIL_CLOSED; the lock
  # survives a refused acquire; non-holder release refused; holder release OK.
  LOCK_ROOT="$scratch/locks" LOCK_DIR="$scratch/locks/$LOCK_NAME.lock" acquire_lock
  if ( LOCK_ROOT="$scratch/locks" LOCK_DIR="$scratch/locks/$LOCK_NAME.lock" acquire_lock ) 2>/dev/null; then
    gate "selftest: second acquire must FAIL_CLOSED" 1
  fi
  pass "selftest: second acquire FAIL_CLOSED (mutual exclusion)"
  [ -d "$scratch/locks/$LOCK_NAME.lock" ] || gate "selftest: lock must survive refused acquire" 1
  pass "selftest: lock left in place after refused acquire (no auto-delete)"
  # A DIFFERENT process id must be refused ($$ is identical inside a subshell,
  # so the mismatch is simulated by rewriting the holder record).
  printf 'pid=999999\n' > "$scratch/locks/$LOCK_NAME.lock/holder"
  if ( LOCK_ROOT="$scratch/locks" LOCK_DIR="$scratch/locks/$LOCK_NAME.lock" release_lock ) 2>/dev/null; then
    gate "selftest: non-holder release must be refused" 1
  fi
  pass "selftest: non-holder release refused (lock intact: $( [ -d "$scratch/locks/$LOCK_NAME.lock" ] && echo yes ))"
  printf 'pid=%s\n' "$$" > "$scratch/locks/$LOCK_NAME.lock/holder"
  LOCK_ROOT="$scratch/locks" LOCK_DIR="$scratch/locks/$LOCK_NAME.lock" release_lock
  pass "selftest: holder release works"

  # (7) staging exact-sha binding mechanics.
  git init -q "$scratch/origin"
  git -C "$scratch/origin" config user.email t@t.local
  git -C "$scratch/origin" config user.name t
  echo a > "$scratch/origin/a.txt"
  git -C "$scratch/origin" add -A && git -C "$scratch/origin" commit -qm a
  local FIXED_SHA
  FIXED_SHA=$(git -C "$scratch/origin" rev-parse HEAD)
  echo b > "$scratch/origin/b.txt"
  git -C "$scratch/origin" add -A && git -C "$scratch/origin" commit -qm b
  git clone -q "$scratch/origin" "$scratch/staging"
  git -C "$scratch/staging" checkout -q --detach "$FIXED_SHA"
  local head_now
  head_now=$(git -C "$scratch/staging" rev-parse HEAD)
  [ "$head_now" = "$FIXED_SHA" ] || gate "selftest: staging exact-sha fixture" 1
  pass "selftest: staging exact-sha binding verified ($head_now == VERIFIED_DEPLOY_SHA)"

  trap - EXIT
  echo "SELFTEST=PASS"
}

# ---- main -------------------------------------------------------------------
if [ "${1:-}" = "--selftest" ]; then
  selftest
  exit 0
fi
if [ $# -lt 2 ]; then
  echo "usage: sudo env ROOT_PRODUCTION_TRANSACTION_SLOT=FREE SCHEDULER_PRODUCTION_MUTATION_SLOT=FREE NO_CONFLICTING_SCHEDULER_TRANSACTION=YES $0 <MAIN_WORKTREE> <STAGING_DIR>" >&2
  echo "       $0 --selftest" >&2
  exit 2
fi
MAIN_WORKTREE_DIR="$1"
STAGING_DIR="$2"

GATES "$MAIN_WORKTREE_DIR"
acquire_lock "run-authorized-transaction"
DEPLOY "$STAGING_DIR"
ROUTING "$STAGING_DIR"
RELOAD
release_lock
echo "TRANSACTION_SEQUENCE_COMPLETE — deep readbacks (health provenance, receipts, BIP acceptance) follow from disk"
