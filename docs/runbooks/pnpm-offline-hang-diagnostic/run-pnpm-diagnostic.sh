#!/bin/bash
# =============================================================================
# run-pnpm-diagnostic.sh — PNPM_OFFLINE_INSTALL_HANG single-step diagnosis
# (GOAL=SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1;
#  Owner directive §6/§7: minimal diagnosis with full evidence capture.
#  DIAGNOSTIC aid under docs/ — not a deployed artifact.)
#
#   1. fails closed if either known stale lock from the aborted transaction is
#      still present (explicit disposition required first);
#   2. acquires the GLOBAL production-deploy mutex (same exact path as the
#      deploy/routing entrypoints);
#   3. runs the ONE pnpm command (--reporter=append-only) in the background,
#      recording START_TIME / PID / CPU / open files / node_modules write
#      progress / output tail into /tmp/pnpm-diag/monitor.csv every 10s;
#   4. auto-`sample`s the pnpm pid on stall detection (CPU + fs progress
#      unchanged for the stall window) — WITHOUT killing anything;
#   5. at the deadline: samples, reports STALLED_AT_DEADLINE, exits leaving
#      pnpm RUNNING and the mutex IN PLACE (Owner decides; no kill here);
#   6. if pnpm exits on its own: releases the mutex and reports PNPM_EXIT_RC
#      with the evidence directory.
#
# Usage (root):
#   sudo env ROOT_PRODUCTION_TRANSACTION_SLOT=FREE \
#            SCHEDULER_PRODUCTION_MUTATION_SLOT=FREE \
#            NO_CONFLICTING_PRODUCTION_TRANSACTION=YES \
#     bash run-pnpm-diagnostic.sh 2>&1 | tee /tmp/pnpm-diag.log
# Selftest: bash run-pnpm-diagnostic.sh --selftest
# =============================================================================
set -u

PROD_DEPLOY_LOCK="/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock"
STALE_TX_LOCK="/usr/local/var/agent-core/production-mutation-locks/scheduler-watchdog-routing-tx.lock"
HARNESS_DIR="/usr/local/libexec/agent-core/harness"
CACHE_DIR="/usr/local/libexec/agent-core/.cache"
PNPM_BIN="/usr/local/bin/pnpm"
DIAG_DIR="/tmp/pnpm-diag"
DEADLINE_SEC="${PNPM_DIAG_DEADLINE_SEC:-1200}"
POLL_SEC=10
STALL_SAMPLE_AFTER_SEC=90
SAMPLE_BIN="/usr/bin/sample"
MODE="${1:-run}"
PNPM_PID=""

gate() { echo "✖ FAIL_CLOSED $1${2:+ — $2}" >&2; exit 1; }
pass() { echo "✔ $1${2:+ — $2}"; }

preflight() {
  # --selftest exercises the mechanics offline as a non-root user; production
  # runs keep the root + authorization-flag gates.
  if [ "$MODE" != "--selftest" ]; then
    [ "$(id -u)" = "0" ] || gate "root required"
    [ "${ROOT_PRODUCTION_TRANSACTION_SLOT:-}" = "FREE" ] || gate "ROOT_PRODUCTION_TRANSACTION_SLOT" "env!=FREE"
    [ "${SCHEDULER_PRODUCTION_MUTATION_SLOT:-}" = "FREE" ] || gate "SCHEDULER_PRODUCTION_MUTATION_SLOT" "env!=FREE"
    [ "${NO_CONFLICTING_PRODUCTION_TRANSACTION:-}" = "YES" ] || gate "NO_CONFLICTING_PRODUCTION_TRANSACTION" "env!=YES"
  fi
  pass "authorization flags"
  local p
  for p in "$STALE_TX_LOCK" "$PROD_DEPLOY_LOCK"; do
    if [ -d "$p" ]; then
      echo "✖ FAIL_CLOSED production lock still present — $p" >&2
      cat "$p/holder" 2>/dev/null || true
      echo "STALE_LOCK_DISPOSITION: verify the holder is dead, then explicit: sudo rmdir $p" >&2
      exit 1
    fi
  done
  pass "no leftover production locks"
  [ -d "$HARNESS_DIR" ] || gate "harness dir" "$HARNESS_DIR"
  [ -x "$PNPM_BIN" ] || gate "pnpm binary" "$PNPM_BIN"
  mkdir -p "$DIAG_DIR"
}

acquire_global() {
  mkdir -p "$(dirname "$PROD_DEPLOY_LOCK")" 2>/dev/null || true
  if mkdir "$PROD_DEPLOY_LOCK" 2>/dev/null; then
    printf 'pid=%s\nuid=%s\ncmd=%s\nstarted=%s\n' "$$" "$(id -u)" \
      "pnpm-offline-hang-diagnostic" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$PROD_DEPLOY_LOCK/holder"
    pass "global production-deploy mutex acquired"
  else
    echo "✖ FAIL_CLOSED global production-deploy mutex already held — $PROD_DEPLOY_LOCK" >&2
    cat "$PROD_DEPLOY_LOCK/holder" 2>/dev/null || true
    echo "STALE_LOCK_DISPOSITION: verify the holder is dead, then explicit: sudo rmdir $PROD_DEPLOY_LOCK" >&2
    exit 1
  fi
}
release_global() {
  if [ -d "$PROD_DEPLOY_LOCK" ] && grep -qx "pid=$$" "$PROD_DEPLOY_LOCK/holder" 2>/dev/null; then
    rm -f "$PROD_DEPLOY_LOCK/holder"
    rmdir "$PROD_DEPLOY_LOCK" && pass "global production-deploy mutex released"
  else
    echo "⚠ global mutex release refused (holder mismatch) — left in place for explicit disposition" >&2
  fi
}
leave_notice() {
  echo "⚠ INTERRUPTED — global mutex LEFT IN PLACE at $PROD_DEPLOY_LOCK" >&2
  [ -z "$PNPM_PID" ] || echo "  pnpm pid=$PNPM_PID NOT killed — inspect before any disposition" >&2
}
trap 'leave_notice' INT TERM

monitor_and_wait() { # monitor_and_wait PID DEADLINE_EPOCH — returns when pnpm exits
  local pid="$1" deadline="$2" last_cpu="" last_nm="" stall_since="" now cpu nm out_tail open_n
  while kill -0 "$pid" 2>/dev/null; do
    now=$(date +%s)
    if [ "$now" -ge "$deadline" ]; then
      "$SAMPLE_BIN" "$pid" 3 -file "$DIAG_DIR/sample-deadline.txt" >/dev/null 2>&1 || true
      ps -o pid,ppid,stat,time,%cpu -p "$pid" >> "$DIAG_DIR/process-tree.txt" 2>/dev/null || true
      echo "STALLED_AT_DEADLINE evidence saved under $DIAG_DIR — pnpm pid=$pid LEFT RUNNING, mutex LEFT IN PLACE"
      exit 1
    fi
    cpu=$(ps -o time= -p "$pid" 2>/dev/null | tr -d ' ')
    nm=$(ls "$HARNESS_DIR/node_modules" 2>/dev/null | wc -l | tr -d ' ')
    out_tail=$(tail -1 "$DIAG_DIR/pnpm.out" 2>/dev/null | cut -c1-160)
    open_n=$(lsof -p "$pid" 2>/dev/null | wc -l | tr -d ' ')
    echo "$(date -u +%H:%M:%S),cpu=${cpu:-?},nm_entries=${nm:-?},open_files=${open_n:-?},last=${out_tail}" >> "$DIAG_DIR/monitor.csv"
    if [ "$cpu" = "$last_cpu" ] && [ "$nm" = "$last_nm" ]; then
      [ -z "$stall_since" ] && stall_since=$now
      if [ $((now - stall_since)) -ge "$STALL_SAMPLE_AFTER_SEC" ]; then
        "$SAMPLE_BIN" "$pid" 3 -file "$DIAG_DIR/sample-stall-$(date -u +%H%M%S).txt" >/dev/null 2>&1 || true
        ps -o pid,ppid,stat,time,%cpu -p "$pid" >> "$DIAG_DIR/process-tree.txt" 2>/dev/null || true
        stall_since=$now
      fi
    else
      stall_since=""
    fi
    last_cpu="$cpu"; last_nm="$nm"
    sleep "$POLL_SEC"
  done
}

run() {
  preflight
  acquire_global
  : > "$DIAG_DIR/monitor.csv"
  echo "START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$DIAG_DIR/monitor.csv"
  ( cd "$HARNESS_DIR" && exec "$PNPM_BIN" install --offline --frozen-lockfile --ignore-scripts \
      --config.package-import-method=copy --cache-dir "$CACHE_DIR" --reporter=append-only ) \
    > "$DIAG_DIR/pnpm.out" 2>&1 &
  PNPM_PID=$!
  echo "PNPM_PID=$PNPM_PID" >> "$DIAG_DIR/monitor.csv"
  ps -o pid,ppid,stat,time,%cpu,command -p "$PNPM_PID" >> "$DIAG_DIR/process-tree.txt" 2>/dev/null || true
  monitor_and_wait "$PNPM_PID" "$(( $(date +%s) + DEADLINE_SEC ))"
  wait "$PNPM_PID" 2>/dev/null
  local rc=$?
  release_global
  echo "PNPM_EXIT_RC=$rc — evidence in $DIAG_DIR (pnpm.out, monitor.csv, samples, process-tree.txt)"
  return "$rc"
}

if [ "$MODE" = "--selftest" ]; then
  scratch=$(mktemp -d /tmp/pnpm-diag-selftest-XXXXXX)
  cleanup() { pkill -f "$scratch/fake-hang" 2>/dev/null; rm -rf "$scratch"; }
  trap 'cleanup' EXIT
  bash -n "$0" || exit 1
  pass "selftest: bash -n"
  HARNESS_DIR="$scratch/harness"
  CACHE_DIR="$scratch/cache"
  printf '#!/bin/bash\nsleep 30\n' > "$scratch/fake-hang"   # ignores args, hangs
  chmod +x "$scratch/fake-hang"
  PNPM_BIN="$scratch/fake-hang"
  PROD_DEPLOY_LOCK="$scratch/locks/production-deploy.lock"
  DIAG_DIR="$scratch/diag"
  DEADLINE_SEC=4
  POLL_SEC=1
  STALL_SAMPLE_AFTER_SEC=2
  mkdir -p "$HARNESS_DIR" "$CACHE_DIR"
  # (a) clean-exit path: sleep 5 would exceed the 4s deadline → the deadline
  # branch must fire: mutex LEFT, evidence present.
  ( run ) >/dev/null 2>&1
  [ -d "$PROD_DEPLOY_LOCK" ] || gate "selftest: deadline path must LEAVE the mutex" 1
  [ -f "$DIAG_DIR/monitor.csv" ] || gate "selftest: monitor evidence missing" 1
  pass "selftest: deadline path leaves mutex + evidence (no kill)"
  pkill -f "$PNPM_BIN" 2>/dev/null || true
  # Explicit disposition of case (a)'s leftover: verify provenance (our own
  # diagnostic holder), then remove — the documented manual procedure.
  if grep -q "pnpm-offline-hang-diagnostic" "$PROD_DEPLOY_LOCK/holder" 2>/dev/null; then
    rm -f "$PROD_DEPLOY_LOCK/holder"
    rmdir "$PROD_DEPLOY_LOCK" 2>/dev/null || true
  fi
  # (b) clean-exit path with a fast fake pnpm: mutex released, rc captured.
  PNPM_BIN="/bin/echo"             # fake pnpm: exits 0 immediately
  rm -rf "$DIAG_DIR"; mkdir -p "$DIAG_DIR"
  ( run ) > "$scratch/caseb.out" 2>&1
  local_rc=$?
  sed 's/^/    caseb: /' "$scratch/caseb.out"
  [ "$local_rc" -eq 0 ] || gate "selftest: clean-exit path must succeed" 1
  [ -d "$PROD_DEPLOY_LOCK" ] && gate "selftest: mutex must be released after clean exit" 1
  [ -f "$DIAG_DIR/pnpm.out" ] || gate "selftest: pnpm.out evidence missing" 1
  pass "selftest: clean-exit path releases mutex + captures evidence"
  cleanup
  echo "SELFTEST=PASS"
  exit 0
fi

run
exit $?
