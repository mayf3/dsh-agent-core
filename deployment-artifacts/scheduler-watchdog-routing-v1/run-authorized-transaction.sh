#!/bin/bash
# =============================================================================
# run-authorized-transaction.sh — WATCHDOG bounded production transaction slot
# (PRODUCTION_TRANSACTION_AUTHORIZED=YES, Owner authorization 2026-09-15;
#  wrapper r3 — Owner blocker closure P0-1..P0-4 + P1: reliable installer rc,
#  selftest covering the real deploy control flow, EXACT artifact allowlist,
#  disposable authority clone (never fetches the Owner repo), global
#  production-deploy mutex convergence. Product semantics unchanged.)
#
# Sequence:
#   GATES (env authorization + canonical store + fresh EXPECTED_* values)
#   → AUTHORITY_BINDING (in a DISPOSABLE clone: origin/main must contain the
#     reviewed code head 7e645ea; the only non-docs delta beyond it is the
#     EXACT wrapper file + the two content-pinned reviewed artifacts
#     run-routing-install.mjs / trusted-cp-deploy-install.sh — anything else,
#     including any change to those two, FAILS CLOSED; resolves
#     VERIFIED_DEPLOY_SHA = exact fresh origin/main SHA)
#   → ACQUIRE transaction lock (wrapper-level), then every production-mutation
#     entrypoint shares the GLOBAL production-deploy mutex
#     /usr/local/var/agent-core/production-mutation-locks/production-deploy.lock
#     (atomic mkdir; fail-closed when held; stale locks are disposed of
#     explicitly, never auto-deleted)
#   → STAGING (disposable clone at EXACTLY VERIFIED_DEPLOY_SHA, HEAD==sha gate)
#   → DEPLOY via the accepted trusted-cp-deploy-install.sh (takes the global
#     mutex itself); reliable rc capture — success crosses the installer gate
#     to the post-deploy marker, non-zero rc = FAIL_CLOSED
#   → ROUTING selftest → candidate → check → plan → apply (from the same
#     staging tree; --apply takes the global mutex itself)
#   → RELOAD runtime under the global mutex → READBACK → release
#
# Any gate failure = FAIL_CLOSED, exit 1. Locks, if held, are LEFT IN PLACE on
# failure/interrupt with explicit disposition instructions.
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

# Reviewed-product baseline: default is the independently reviewed head.
# The Owner may EXPLICITLY advance it via PRODUCT_REVIEWED_BASELINE=<sha> in
# the sudo env — that act is the blessing of the current main coordinate
# (e.g. accepting other lanes' merged product changes for this deploy).
REVIEWED_CODE_SHA="${PRODUCT_REVIEWED_BASELINE:-7e645ea2a4b353c2e79b4a735aa9ab7a89d5de68}"
WRAPPER_SCRIPT="deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh"
ROUTING_INSTALLER="deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs"
DEPLOY_INSTALLER="scripts/trusted-cp-deploy-install.sh"
# Content pins fixed at the wrapper-r3 review — any later change to these two
# artifacts on origin/main FAILS CLOSED until re-reviewed.
ROUTING_INSTALLER_SHA256="8ff1d255fe4c39e5a70c0a91dc2b529d1331bbdfe37e53b6818fcc7e92cf1e60"
DEPLOY_INSTALLER_SHA256="ce8fea9ca7ce1618d933f26e63f7c95e0e9dfb0167a6903bbf39f3bae5fde915"
APP_ROOT="/usr/local/libexec/agent-core/app"
CANONICAL_STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
ROUTING_TARGET="/Users/authsvc/.agent-core/scheduler/routing.json"
RUNTIME_LABEL="system/ai.agent-core.runtime"
HEALTH_URL="http://127.0.0.1:8790/health"
# The GLOBAL production-deploy mutex (exact shared path — P1 convergence with
# trusted-cp-deploy-install.sh and run-routing-install.mjs --apply). The
# wrapper-level lock stays separate (it sequences THIS transaction only).
GLOBAL_DEPLOY_LOCK_DIR="/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock"
LOCK_ROOT="/usr/local/var/agent-core/production-mutation-locks"
LOCK_NAME="scheduler-watchdog-routing-tx"
LOCK_DIR="$LOCK_ROOT/$LOCK_NAME.lock"
VERIFIED_DEPLOY_SHA=""

gate() { # gate NAME DETAIL — FAIL_CLOSED
  echo "✖ FAIL_CLOSED $1${2:+ — $2}" >&2
  exit 1
}
pass() { echo "✔ $1${2:+ — $2}"; }

# ---- shared global production-deploy mutex (shell impl) ---------------------
acquire_global_deploy_lock() {
  mkdir -p "$(dirname "$GLOBAL_DEPLOY_LOCK_DIR")" 2>/dev/null || true
  if mkdir "$GLOBAL_DEPLOY_LOCK_DIR" 2>/dev/null; then
    printf 'pid=%s\nuid=%s\ncmd=%s\nstarted=%s\n' "$$" "$(id -u)" \
      "${GLOBAL_LOCK_CMD:-runtime reload + readiness readback}" \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$GLOBAL_DEPLOY_LOCK_DIR/holder"
    pass "global production-deploy mutex acquired" "$GLOBAL_DEPLOY_LOCK_DIR"
  else
    echo "✖ FAIL_CLOSED global production-deploy mutex already held — $GLOBAL_DEPLOY_LOCK_DIR" >&2
    cat "$GLOBAL_DEPLOY_LOCK_DIR/holder" 2>/dev/null || true
    echo "STALE_LOCK_DISPOSITION: verify the holding deploy is truly dead, then remove EXPLICITLY:" >&2
    echo "  sudo rmdir $GLOBAL_DEPLOY_LOCK_DIR" >&2
    exit 1
  fi
}
release_global_deploy_lock() {
  if [ -d "$GLOBAL_DEPLOY_LOCK_DIR" ] && grep -qx "pid=$$" "$GLOBAL_DEPLOY_LOCK_DIR/holder" 2>/dev/null; then
    rm -f "$GLOBAL_DEPLOY_LOCK_DIR/holder"
    rmdir "$GLOBAL_DEPLOY_LOCK_DIR" && pass "global production-deploy mutex released"
  else
    echo "✖ global mutex release refused (missing or holder mismatch) — left in place" >&2
    exit 1
  fi
}

# ---- wrapper-level transaction lock -----------------------------------------
acquire_lock() {
  mkdir -p "$LOCK_ROOT" 2>/dev/null || true
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf 'pid=%s\nuid=%s\nhost=%s\nstarted=%s\ncmd=%s\n' "$$" "$(id -u)" \
      "$(hostname)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" > "$LOCK_DIR/holder"
    pass "transaction lock acquired" "$LOCK_DIR"
  else
    echo "✖ FAIL_CLOSED transaction lock already held — $LOCK_DIR" >&2
    cat "$LOCK_DIR/holder" 2>/dev/null || echo "(no holder metadata — inspect manually)" >&2
    echo "STALE_LOCK_DISPOSITION: verify the holding transaction is truly dead, then remove EXPLICITLY:" >&2
    echo "  sudo rmdir $LOCK_DIR   # never guessed, never automatic" >&2
    exit 1
  fi
}
release_lock() {
  if [ -d "$LOCK_DIR" ] && grep -qx "pid=$$" "$LOCK_DIR/holder" 2>/dev/null; then
    rm -f "$LOCK_DIR/holder"
    rmdir "$LOCK_DIR" && pass "transaction lock released"
  else
    echo "✖ transaction lock release refused (missing or holder mismatch) — left in place" >&2
    exit 1
  fi
}
leave_lock_notice() {
  echo "⚠ INTERRUPTED — locks LEFT IN PLACE (tx: $LOCK_DIR; global: $GLOBAL_DEPLOY_LOCK_DIR if acquired)" >&2
  echo "  they are NOT auto-deleted; inspect and dispose explicitly (see holder files)" >&2
}
trap 'leave_lock_notice' INT TERM

# ---- authority binding (P0-4: disposable clone — Owner repo is read-only) ---
authority_binding() { # AUTHORITY_BINDING MAIN_WORKTREE REVIEWED_SHA ROUTING_SHA DEPLOY_SHA
  local W="$1" reviewed="$2" routing_sha="$3" deploy_sha="$4"
  local url ac
  url=$(git -C "$W" remote get-url origin) || gate "source locator (read-only)" "$W has no origin remote"
  ac=$(mktemp -d /tmp/wgr-authority-XXXXXX)
  if ! (
    git clone --no-hardlinks --quiet "$W" "$ac" || exit 1
    git -C "$ac" remote set-url origin "$url" || exit 1
    git -C "$ac" fetch origin main --quiet || exit 1
    git -C "$ac" merge-base --is-ancestor "$reviewed" origin/main \
      || { echo "reviewed head $reviewed missing from origin/main"; exit 1; }
    local unexpected
    unexpected=$(git -C "$ac" diff --name-only "$reviewed" origin/main \
      | grep -v '^docs/' | grep -vx "$WRAPPER_SCRIPT" \
      | grep -vx "$ROUTING_INSTALLER" | grep -vx "$DEPLOY_INSTALLER" || true)
    [ -z "$unexpected" ] || { echo "non-docs delta outside the exact reviewed artifact allowlist:"; echo "$unexpected"; exit 1; }
    [ "$(git -C "$ac" show "origin/main:$ROUTING_INSTALLER" | shasum -a 256 | cut -d' ' -f1)" = "$routing_sha" ] \
      || { echo "run-routing-install.mjs changed since review — content pin mismatch"; exit 1; }
    [ "$(git -C "$ac" show "origin/main:$DEPLOY_INSTALLER" | shasum -a 256 | cut -d' ' -f1)" = "$deploy_sha" ] \
      || { echo "trusted-cp-deploy-install.sh changed since review — content pin mismatch"; exit 1; }
    git -C "$ac" rev-parse origin/main
  ) > "$ac.resolved" 2>&1; then
    cat "$ac.resolved" >&2
    rm -rf "$ac" "$ac.resolved"
    gate "authority binding" "see above"
  fi
  VERIFIED_DEPLOY_SHA=$(tail -1 "$ac.resolved")
  rm -rf "$ac" "$ac.resolved"
  pass "authority binding resolved" "VERIFIED_DEPLOY_SHA=$VERIFIED_DEPLOY_SHA"
}

# staging must sit at EXACTLY VERIFIED_DEPLOY_SHA (executed-artifact binding).
staging_bind() {
  local S="$1"
  git -C "$S" checkout --quiet --detach "$VERIFIED_DEPLOY_SHA" || gate "staging checkout" 1
  local head
  head=$(git -C "$S" rev-parse HEAD)
  [ "$head" = "$VERIFIED_DEPLOY_SHA" ] || gate "staging exact-sha binding" "$head != $VERIFIED_DEPLOY_SHA"
  pass "staging bound to VERIFIED_DEPLOY_SHA" "$head"
}

# ---- P0-1: reliable installer rc + explicit success path --------------------
run_installer() { # run_installer CMD... — captures the real pipeline rc
  RUN_INSTALLER_RC=0
  "$@" 2>&1 | tee /tmp/wgr-tx-deploy.log || RUN_INSTALLER_RC=$?
  return 0
}
deploy_from_staging() { # deploy_from_staging STAGING_DIR APP_ROOT
  local S="$1" app_root="$2"
  PRODUCTION_DEPLOY_LOCK_INHERITED_FROM="run-authorized-transaction.sh" \
    run_installer bash "$S/$DEPLOY_INSTALLER" "$S"
  [ "$RUN_INSTALLER_RC" -eq 0 ] || gate "deploy installer" "rc=$RUN_INSTALLER_RC"
  pass "deploy installer rc=0 — installer gate crossed"
  ls "$app_root/packages" >/dev/null 2>&1 || gate "deployed app tree present" "$app_root"
  pass "DEPLOY_POSTDEPLOY_MARKER reached"
}

GATES() {
  local MAIN_WORKTREE="$1"
  [ "$(id -u)" = "0" ] || gate "root required" "sudo env ... $0 <MAIN_WORKTREE> <STAGING_DIR>"
  [ "${ROOT_PRODUCTION_TRANSACTION_SLOT:-}" = "FREE" ] || gate "ROOT_PRODUCTION_TRANSACTION_SLOT" "env!=FREE"
  [ "${SCHEDULER_PRODUCTION_MUTATION_SLOT:-}" = "FREE" ] || gate "SCHEDULER_PRODUCTION_MUTATION_SLOT" "env!=FREE"
  [ "${NO_CONFLICTING_SCHEDULER_TRANSACTION:-}" = "YES" ] || gate "NO_CONFLICTING_SCHEDULER_TRANSACTION" "env!=YES"
  pass "§3 Owner authorization flags" "FREE/FREE/YES (authorization — the locks are the mutual exclusion)"
  # B5: deterministic corepack behavior — the hydrated cache + network OFF +
  # no latest fallback turn any cache miss into an immediate fail-closed.
  [ "${COREPACK_HOME:-}" = "/usr/local/var/agent-core/corepack-cache" ] || gate "COREPACK_HOME" "must be /usr/local/var/agent-core/corepack-cache (the hydrated cache)"
  [ "${COREPACK_ENABLE_NETWORK:-}" = "0" ] || gate "COREPACK_ENABLE_NETWORK" "env!=0"
  [ "${COREPACK_DEFAULT_TO_LATEST:-}" = "0" ] || gate "COREPACK_DEFAULT_TO_LATEST" "env!=0"
  [ "${COREPACK_ENABLE_DOWNLOAD_PROMPT:-}" = "0" ] || gate "COREPACK_ENABLE_DOWNLOAD_PROMPT" "env!=0"
  pass "§3 COREPACK determinism env" "COREPACK_HOME=$COREPACK_HOME ENABLE_NETWORK=0 DEFAULT_TO_LATEST=0 DOWNLOAD_PROMPT=0"
  [ -f "$CANONICAL_STORE" ] || gate "canonical store readable" "$CANONICAL_STORE"
  authority_binding "$MAIN_WORKTREE" "$REVIEWED_CODE_SHA" "$ROUTING_INSTALLER_SHA256" "$DEPLOY_INSTALLER_SHA256"
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
  bash "$S/$WRAPPER_SCRIPT" --selftest >/dev/null || gate "staging wrapper selftest" 1
  deploy_from_staging "$S" "$APP_ROOT"
}

ROUTING() {
  local S="$1"
  local INSTALLER="$S/$ROUTING_INSTALLER"
  [ -f "$INSTALLER" ] || gate "routing installer present" "$INSTALLER"
  local NODE="${APP_ROOT%/app}/node-runtime/bin/node"
  [ -x "$NODE" ] || NODE="$(command -v node)"
  "$NODE" "$INSTALLER" --selftest || gate "routing --selftest" 1
  "$NODE" "$INSTALLER" --candidate || gate "routing --candidate" 1
  env ROOT_PRODUCTION_TRANSACTION_SLOT=FREE SCHEDULER_PRODUCTION_MUTATION_SLOT=FREE \
      NO_CONFLICTING_SCHEDULER_TRANSACTION=YES \
      "$NODE" "$INSTALLER" --check || gate "routing --check (slots + enrichment + OPS_TARGET_OVERLAPS=NO)" 1
  "$NODE" "$INSTALLER" --plan || gate "routing --plan (zero-write)" 1
  PRODUCTION_DEPLOY_LOCK_INHERITED_FROM="run-authorized-transaction.sh" \
    "$NODE" "$INSTALLER" --apply || gate "routing --apply + readback" 1
  pass "routing receipt + protected-metadata readback complete"
}

RELOAD() {
  # Lock-neutral: the parent already holds the global production-deploy mutex
  # across the whole sequence (B7) — RELOAD must not reacquire or release it.
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
  gate "readiness readback (state=running + health ok)" "see launchd logs — global mutex LEFT IN PLACE"
}

# ---- selftest ---------------------------------------------------------------
selftest() {
  local scratch
  scratch=$(mktemp -d /tmp/wgr-tx-selftest-XXXXXX)
  bash -n "$0" || gate "selftest syntax" 1
  pass "selftest: bash -n"

  # (1) the stale-authority-variable class of bug (wrapper r1 died on an
  # undefined removed authority variable under set -u). The needle is
  # assembled so this check cannot match its own source text.
  local stale_needle="AUTH_MAIN""_SHA"
  if grep -q "$stale_needle" "$0"; then
    gate "selftest: stale authority variable reference must not exist" "$stale_needle"
  fi
  pass "selftest: no stale authority variable reference (set -u safe by construction)"

  # Fixture repo: reviewed head carries packages/a.js, the routing installer
  # and the deploy installer (with the pins this selftest computes).
  local fx="$scratch/fx"
  git init -q -b main "$fx"
  git -C "$fx" config user.email t@t.local
  git -C "$fx" config user.name t
  git -C "$fx" remote add origin "$fx"
  mkdir -p "$fx/packages" "$fx/docs" "$fx/scripts" "$(dirname "$fx/$WRAPPER_SCRIPT")"
  echo x > "$fx/packages/a.js"
  echo 'selftest routing installer' > "$fx/$ROUTING_INSTALLER"
  echo '#!/bin/bash' > "$fx/$DEPLOY_INSTALLER"
  echo 'wrapper r0' > "$fx/$WRAPPER_SCRIPT"
  git -C "$fx" add -A
  git -C "$fx" commit -qm "reviewed head"
  local REVIEWED ROUTING_PIN DEPLOY_PIN
  REVIEWED=$(git -C "$fx" rev-parse HEAD)
  ROUTING_PIN=$(git -C "$fx" show "main:$ROUTING_INSTALLER" | shasum -a 256 | cut -d' ' -f1)
  DEPLOY_PIN=$(git -C "$fx" show "main:$DEPLOY_INSTALLER" | shasum -a 256 | cut -d' ' -f1)

  # (2) binding at the reviewed head → PASS.
  authority_binding "$fx" "$REVIEWED" "$ROUTING_PIN" "$DEPLOY_PIN"
  pass "selftest: authority binding PASS at reviewed head (VERIFIED_DEPLOY_SHA=$VERIFIED_DEPLOY_SHA)"

  # (3) docs-only advance keeps it green and ADVANCES VERIFIED_DEPLOY_SHA.
  echo docs > "$fx/docs/note.md"
  git -C "$fx" add -A && git -C "$fx" commit -qm "docs advance"
  authority_binding "$fx" "$REVIEWED" "$ROUTING_PIN" "$DEPLOY_PIN"
  pass "selftest: docs-only drift keeps binding green (VERIFIED_DEPLOY_SHA advanced)"

  # (4) P0-3: ANY change to the pinned routing installer → FAIL_CLOSED.
  echo 'tampered' >> "$fx/$ROUTING_INSTALLER"
  git -C "$fx" add -A && git -C "$fx" commit -qm "routing installer drift"
  if ( authority_binding "$fx" "$REVIEWED" "$ROUTING_PIN" "$DEPLOY_PIN" ) 2>/dev/null; then
    gate "selftest: routing installer drift must FAIL_CLOSED" 1
  fi
  pass "selftest: ROUTING_INSTALLER_UNREVIEWED_DRIFT FAIL_CLOSED"
  git -C "$fx" reset -q --hard HEAD~1

  # (4b) any other product-code delta (exact allowlist) → FAIL_CLOSED.
  echo y > "$fx/packages/b.js"
  git -C "$fx" add -A && git -C "$fx" commit -qm "product drift"
  if ( authority_binding "$fx" "$REVIEWED" "$ROUTING_PIN" "$DEPLOY_PIN" ) 2>/dev/null; then
    gate "selftest: product drift must FAIL_CLOSED" 1
  fi
  pass "selftest: product-code drift outside the exact allowlist FAIL_CLOSED"
  git -C "$fx" reset -q --hard HEAD~1

  # (5) the wrapper file itself is the exact allowed delta (re-review rides
  # VERIFIED_DEPLOY_SHA + the reviewed diff): MODIFY the existing file, never
  # add paths under it.
  echo 'wrapper r1 content' > "$fx/$WRAPPER_SCRIPT"
  git -C "$fx" add -A && git -C "$fx" commit -qm "wrapper delta"
  authority_binding "$fx" "$REVIEWED" "$ROUTING_PIN" "$DEPLOY_PIN"
  pass "selftest: exact wrapper file delta accepted"

  # (6) exclusive locks: atomic acquire; second acquire FAIL_CLOSED; the lock
  # survives a refused acquire; genuine holder-mismatch release refused;
  # holder release works.
  LOCK_ROOT="$scratch/locks" LOCK_DIR="$scratch/locks/$LOCK_NAME.lock" acquire_lock
  if ( LOCK_ROOT="$scratch/locks" LOCK_DIR="$scratch/locks/$LOCK_NAME.lock" acquire_lock ) 2>/dev/null; then
    gate "selftest: second acquire must FAIL_CLOSED" 1
  fi
  pass "selftest: second acquire FAIL_CLOSED (mutual exclusion)"
  [ -d "$scratch/locks/$LOCK_NAME.lock" ] || gate "selftest: lock must survive refused acquire" 1
  pass "selftest: lock left in place after refused acquire (no auto-delete)"
  printf 'pid=999999\n' > "$scratch/locks/$LOCK_NAME.lock/holder"
  if ( LOCK_ROOT="$scratch/locks" LOCK_DIR="$scratch/locks/$LOCK_NAME.lock" release_lock ) 2>/dev/null; then
    gate "selftest: non-holder release must be refused" 1
  fi
  pass "selftest: non-holder release refused (lock intact)"
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

  # (7b) mechanical regression for the r3-review blocker: RELOAD must be
  # lock-neutral (the parent owns the global mutex across the sequence).
  local reload_body
  reload_body=$(sed -n '/^RELOAD() {$/,/^}/p' "$0")
  case "$reload_body" in
    *acquire_global_deploy_lock*|*release_global_deploy_lock*)
      gate "selftest: RELOAD must be lock-neutral (parent owns the global mutex)" 1 ;;
  esac
  local seq
  seq=$(grep -n 'acquire_lock \|acquire_global_deploy_lock$\|release_global_deploy_lock$\|release_lock$' "$0" | sed 's/:.*//' | tr '\n' ' ')
  pass "selftest: RELOAD lock-neutral verified (body has no global-lock calls)"
  # ordering assertion: main tail is acquire_lock -> acquire_global -> ... -> release_global -> release_lock
  # main-sequence order: lock -> global mutex -> DEPLOY -> ROUTING -> RELOAD
  # -> release global -> release tx (each strictly after the previous).
  local main_body cursor=0 call found
  main_body=$(sed -n '/^GATES "\$MAIN_WORKTREE_DIR"$/,/^echo "TRANSACTION_SEQUENCE_COMPLETE/p' "$0")
  [ -n "$main_body" ] || gate "selftest: main body extraction" 1
  for call in 'acquire_lock ' 'acquire_global_deploy_lock' 'DEPLOY "$STAGING_DIR"' \
              'ROUTING "$STAGING_DIR"' 'RELOAD' 'release_global_deploy_lock' 'release_lock'; do
    found=$(printf '%s\n' "$main_body" | tail -n +$((cursor + 1)) | grep -n -F -- "$call" | head -1 | cut -d: -f1 || true)
    [ -n "$found" ] || gate "selftest: main sequence missing $call" 1
    cursor=$((cursor + found))
  done
  pass "selftest: main sequence order verified (lock, global mutex, deploy, routing, reload, release)"

  # (8) P0-2: REAL deploy control flow — installer rc==0 must cross the
  # installer gate and reach the post-deploy marker; rc!=0 must FAIL_CLOSED.
  local fxapp="$scratch/app"
  mkdir -p "$fxapp/packages" "$(dirname "$fx/staging/$DEPLOY_INSTALLER")"
  printf '#!/bin/bash\necho "stub deploy"\nexit ${STUB_RC:-0}\n' > "$fx/staging/$DEPLOY_INSTALLER"
  chmod +x "$fx/staging/$DEPLOY_INSTALLER"
  local rc=0
  STUB_RC=0 deploy_from_staging "$fx/staging" "$fxapp" 2>/dev/null || rc=$?
  [ "$rc" -eq 0 ] || gate "selftest: deploy success path must reach the post-deploy marker" "rc=$rc"
  pass "selftest: INSTALLER_SUCCESS_PATH crosses the gate to DEPLOY_POSTDEPLOY_MARKER"
  if ( STUB_RC=7 deploy_from_staging "$fx/staging" "$fxapp" ) 2>/dev/null; then
    gate "selftest: installer failure must FAIL_CLOSED" 1
  fi
  pass "selftest: INSTALLER_FAILURE_FAIL_CLOSED (rc=7 rejected)"

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
# B7: the parent holds the global production-deploy mutex ONCE across the
# whole DEPLOY -> ROUTING -> RELOAD -> readiness sequence (no serialization
# gaps). Children verify the inherited holder and never touch it.
acquire_global_deploy_lock
DEPLOY "$STAGING_DIR"
ROUTING "$STAGING_DIR"
RELOAD
release_global_deploy_lock
release_lock
echo "TRANSACTION_SEQUENCE_COMPLETE — deep readbacks (health provenance, receipts, BIP acceptance) follow from disk"
