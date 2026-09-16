#!/bin/bash
# =============================================================================
# run-pnpm-diagnostic.sh — PNPM_OFFLINE_INSTALL_HANG diagnosis (wrapper r2)
# (GOAL=SCHEDULER_WATCHDOG_ROUTING_AND_STUCK_OCCURRENCE_RECOVERY_V1.
#  r2 closes Owner blockers B2/B3/B4 + concurrency TOCTOU guard.
#  DIAGNOSTIC aid under docs/ — not a deployed artifact.)
#
# ACTION_CLASS=CONTROLLED_PRODUCTION_INSTALLATION_DIAGNOSTIC
#   (the diagnosed pnpm command operates on the production installation's
#    dependency state — this is NOT a read-only action)
# SHARED_PRODUCTION_MUTATION_LANE_REQUIRED=YES
# GLOBAL_PRODUCTION_DEPLOY_MUTEX_REQUIRED=YES  (exact shared path, see below)
#
# Sequence:
#   preflight (root* + env authorization + known stale locks absent)
#   → acquire GLOBAL production-deploy mutex (atomic mkdir; fail-closed when
#     held; a left lock is never auto-deleted)
#   → TOCTOU guard: fresh check for foreign deploy/install/routing/kickstart/
#     pnpm processes; any hit releases ONLY our own mutex and FAILS CLOSED
#   → snapshot installation state (entries/du/file-list hash)
#   → launch the ONE runbook pnpm command (--reporter=append-only) in the
#     background, recording PID/CPU/open files/write progress/output tail
#     every 10s; PRODUCTION_MUTATION_STARTED=YES is printed at launch
#   → auto-`sample` on stall detection; at the deadline: sample + report
#     INSTALLATION_MUTATION_RESULT=UNKNOWN + STALLED_AT_DEADLINE, exit 1 with
#     pnpm LEFT RUNNING and the mutex LEFT IN PLACE (Owner decides)
#   → on pnpm's own exit: post-snapshot, report
#     INSTALLATION_MUTATION_RESULT=NO_NET_CHANGE_PROVEN|MUTATED from file
#     evidence, release the mutex, report PNPM_EXIT_RC
#
# Signals: SIGINT → notice + exit 130; SIGTERM → notice + exit 143.
# In both cases pnpm is LEFT RUNNING, the mutex LEFT IN PLACE — the wrapper
# exits and hands disposition back. No EXIT auto-unlock exists.
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
SAMPLE_BIN="/usr/bin/sample"   # host PATH resolves `sample` to a broken shim
MODE="${1:-run}"
PNPM_PID=""
PRE_STATE=""
PRODUCTION_MUTATION_STARTED="NO"

gate() { echo "✖ FAIL_CLOSED $1${2:+ — $2}" >&2; exit 1; }
pass() { echo "✔ $1${2:+ — $2}"; }

# ---- B3: explicit stale-lock disposition (fail-closed, never automatic) -----
dispose_stale_lock() { # dispose_stale_lock LOCK_DIR
  local p="$1" holder pid provenance
  [ -d "$p" ] || { echo "nothing to dispose: $p"; return 0; }
  holder="$p/holder"
  [ -f "$holder" ] || { echo "✖ refuse: no holder metadata — manual inspection required: $p"; return 1; }
  pid=$(sed -n 's/^pid=//p' "$holder")
  provenance=$(sed -n 's/^cmd=//p' "$holder")
  # ps-based existence check: kill -0 gives a false "dead" for other users'
  # processes when the disposer is unprivileged.
  if [ -n "$pid" ] && ps -p "$pid" -o pid= >/dev/null 2>&1; then
    echo "✖ refuse: holder pid=$pid is ALIVE — not disposing $p"; return 1
  fi
  case "$provenance" in
    *pnpm-offline-hang-diagnostic*|*run-authorized-transaction*|*trusted-cp-deploy-install.sh*|*run-routing-install.mjs*)
      ;; # provenance belongs to this goal's transaction artifacts
    *) echo "✖ refuse: holder provenance not recognized as this goal's transaction: $provenance"; return 1 ;;
  esac
  echo "dispose: holder pid=$pid dead, provenance verified ($provenance)"
  rm -f "$holder"
  rmdir "$p" && echo "disposed: $p"
}

preflight() {
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
      echo "DISPOSITION (explicit, fail-closed helper — never bare rmdir):" >&2
      echo "  bash $0 --dispose-stale-lock $p" >&2
      exit 1
    fi
  done
  pass "no leftover production locks"
  [ -d "$HARNESS_DIR" ] || gate "harness dir" "$HARNESS_DIR"
  [ -x "$PNPM_BIN" ] || gate "pnpm binary" "$PNPM_BIN"
  mkdir -p "$DIAG_DIR"
}

if [ "${2:-}" = "" ] && [ "${1:-}" = "--dispose-stale-lock" ]; then
  echo "AUTO_DELETE_STALE_LOCK=NO — the helper verifies holder-dead + provenance before touching anything:"
  dispose_stale_lock "${3:-}"
  exit $?
fi
if [ "${1:-}" = "--dispose-stale-lock" ]; then
  echo "usage: bash $0 --dispose-stale-lock <LOCK_DIR>   (requires root when the lock is root-owned)" >&2
  exit 2
fi

acquire_global() {
  mkdir -p "$(dirname "$PROD_DEPLOY_LOCK")" 2>/dev/null || true
  if mkdir "$PROD_DEPLOY_LOCK" 2>/dev/null; then
    printf 'pid=%s\nuid=%s\ncmd=%s\nstarted=%s\n' "$$" "$(id -u)" \
      "pnpm-offline-hang-diagnostic" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$PROD_DEPLOY_LOCK/holder"
    pass "global production-deploy mutex acquired"
  else
    echo "✖ FAIL_CLOSED global production-deploy mutex already held — $PROD_DEPLOY_LOCK" >&2
    cat "$PROD_DEPLOY_LOCK/holder" 2>/dev/null || true
    echo "DISPOSITION (explicit helper — never bare rmdir): bash $0 --dispose-stale-lock $PROD_DEPLOY_LOCK" >&2
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
leave_notice_int()  { leave_notice; exit 130; }
leave_notice_term() { leave_notice; exit 143; }
trap 'leave_notice_int' INT
trap 'leave_notice_term' TERM

# ---- concurrency TOCTOU guard (covers the bare-kickstart residual) ----------
toctou_guard() {
  local pat pids
  for pat in 'trusted-cp-deploy-install.sh' 'run-routing-install.mjs' \
             'run-authorized-transaction.sh' 'launchctl kickstart' 'pnpm install'; do
    pids=$(pgrep -f "$pat" 2>/dev/null | grep -vx "$$" || true)
    if [ -n "$pids" ]; then
      release_global   # release ONLY our own mutex, then fail closed
      gate "foreign production operation ($pat): pids $(echo "$pids" | tr '\n' ' ')"
    fi
  done
  pass "TOCTOU guard: no foreign deploy/install/routing/kickstart/pnpm processes"
}

# ---- B2: installation-state evidence ----------------------------------------
snapshot_state() { # echoes one comparable line; appends full evidence
  local base="$HARNESS_DIR/node_modules" line
  line="entries=$(ls "$base" 2>/dev/null | wc -l | tr -d ' '),du_kb=$(du -sk "$base" 2>/dev/null | cut -f1),files_sha=$(find "$base" -type f 2>/dev/null | sort | shasum -a 256 | cut -d' ' -f1)"
  echo "$(date -u +%H:%M:%S) $line" >> "$DIAG_DIR/installation-state.txt"
  printf '%s' "$line"
}

monitor_and_wait() { # monitor_and_wait PID DEADLINE_EPOCH
  local pid="$1" deadline="$2" last_cpu="" last_nm="" stall_since="" now cpu nm out_tail open_n
  while kill -0 "$pid" 2>/dev/null; do
    now=$(date +%s)
    if [ "$now" -ge "$deadline" ]; then
      "$SAMPLE_BIN" "$pid" 3 -file "$DIAG_DIR/sample-deadline.txt" >/dev/null 2>&1 || true
      ps -o pid,ppid,stat,time,%cpu -p "$pid" >> "$DIAG_DIR/process-tree.txt" 2>/dev/null || true
      echo "STALLED_AT_DEADLINE evidence saved under $DIAG_DIR — pnpm pid=$pid LEFT RUNNING, mutex LEFT IN PLACE"
      echo "INSTALLATION_MUTATION_RESULT=UNKNOWN"
      echo "PRODUCTION_MUTATION_STARTED=YES (left running — Owner decides)"
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
  toctou_guard
  # ROOT_CAUSE (proven 2026-09-15): the /usr/local/bin/pnpm corepack shim
  # stalls on registry.npmjs.org when the pinned pnpm@11.7.0 is not in the
  # COREPACK cache. Pinning the prompt off keeps this diagnostic deterministic;
  # the minimal fix is the one-time `corepack install -g pnpm@11.7.0`.
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  echo "ACTION_CLASS=CONTROLLED_PRODUCTION_INSTALLATION_DIAGNOSTIC"
  echo "SHARED_PRODUCTION_MUTATION_LANE_REQUIRED=YES"
  echo "GLOBAL_PRODUCTION_DEPLOY_MUTEX_REQUIRED=YES"
  echo "PRODUCTION_MUTATION_PERFORMED=NO (pre-launch)"
  PRE_STATE=$(snapshot_state)
  : > "$DIAG_DIR/monitor.csv"
  echo "START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) PRE{$PRE_STATE}" >> "$DIAG_DIR/monitor.csv"
  ( cd "$HARNESS_DIR" && exec "$PNPM_BIN" install --offline --frozen-lockfile --ignore-scripts \
      --config.package-import-method=copy --cache-dir "$CACHE_DIR" --reporter=append-only ) \
    > "$DIAG_DIR/pnpm.out" 2>&1 &
  PNPM_PID=$!
  PRODUCTION_MUTATION_STARTED="YES"
  echo "PRODUCTION_MUTATION_STARTED=YES (pid=$PNPM_PID)"
  echo "PNPM_PID=$PNPM_PID" >> "$DIAG_DIR/monitor.csv"
  ps -o pid,ppid,stat,time,%cpu,command -p "$PNPM_PID" >> "$DIAG_DIR/process-tree.txt" 2>/dev/null || true
  monitor_and_wait "$PNPM_PID" "$(( $(date +%s) + DEADLINE_SEC ))"
  wait "$PNPM_PID" 2>/dev/null
  local rc=$?
  local post result performed
  post=$(snapshot_state)
  if [ "$PRE_STATE" = "$post" ]; then result="NO_NET_CHANGE_PROVEN"; performed="NO"; else result="MUTATED"; performed="YES"; fi
  echo "INSTALLATION_MUTATION_RESULT=$result"
  echo "PRODUCTION_MUTATION_PERFORMED=$performed"
  release_global
  echo "PNPM_EXIT_RC=$rc — evidence in $DIAG_DIR (pnpm.out, monitor.csv, installation-state.txt, samples, process-tree.txt)"
  return "$rc"
}

# ---- selftest ---------------------------------------------------------------
if [ "$MODE" = "--selftest" ]; then
  scratch=$(mktemp -d /tmp/pnpm-diag-selftest-XXXXXX)
  cleanup() {
    if [ "${KEEPFAIL:-}" = "1" ]; then pkill -f "$scratch/fake-hang" 2>/dev/null; echo "KEEPFAIL scratch=$scratch"; return; fi
    pkill -f "$scratch/fake-hang" 2>/dev/null; rm -rf "$scratch"
  }
  trap 'cleanup' EXIT
  bash -n "$0" || exit 1
  pass "selftest: bash -n"
  HARNESS_DIR="$scratch/harness"
  CACHE_DIR="$scratch/cache"
  printf '#!/bin/bash\nsleep 30\n' > "$scratch/fake-hang"
  chmod +x "$scratch/fake-hang"
  printf '#!/bin/bash\nmkdir -p "%s/node_modules/touched"\necho touched > "%s/node_modules/touched/marker"\n' \
    "$HARNESS_DIR" "$HARNESS_DIR" > "$scratch/fake-mutate"
  chmod +x "$scratch/fake-mutate"
  PNPM_BIN="$scratch/fake-hang"
  PROD_DEPLOY_LOCK="$scratch/locks/production-deploy.lock"
  STALE_TX_LOCK="$scratch/locks/scheduler-watchdog-routing-tx.lock"
  DIAG_DIR="$scratch/diag"
  DEADLINE_SEC=4
  POLL_SEC=1
  STALL_SAMPLE_AFTER_SEC=2
  SAMPLE_BIN="/bin/echo"
  mkdir -p "$HARNESS_DIR" "$CACHE_DIR"

  # (a) deadline path: fake-hang → mutex LEFT + UNKNOWN + lock survives.
  ( run ) > "$scratch/casea.out" 2>&1
  sed 's/^/    casea: /' "$scratch/casea.out"
  grep -q "STALLED_AT_DEADLINE" "$scratch/casea.out" || gate "selftest: deadline case must report STALLED_AT_DEADLINE" 1
  [ -d "$PROD_DEPLOY_LOCK" ] || gate "selftest: deadline path must LEAVE the mutex" 1
  grep -q "pnpm-offline-hang-diagnostic" "$PROD_DEPLOY_LOCK/holder" || gate "selftest: holder provenance must be intact" 1
  pass "selftest: deadline path leaves mutex + provenance + UNKNOWN result"
  # The holder itself releases (our pid owns it — dispose would correctly refuse).
  release_global
  [ -d "$PROD_DEPLOY_LOCK" ] && gate "selftest: holder release must remove the lock" 1
  pass "selftest: holder release after evidence"
  # B3 dispose helper: ALIVE holder refused; DEAD holder + verified provenance disposed.
  acquire_global
  printf 'pid=1\ncmd=pnpm-offline-hang-diagnostic\n' > "$PROD_DEPLOY_LOCK/holder"
  if dispose_stale_lock "$PROD_DEPLOY_LOCK"; then gate "selftest: dispose must refuse while holder alive" 1; fi
  pass "selftest: dispose refuses an alive holder (pid 1 = launchd)"
  printf 'pid=999999\ncmd=pnpm-offline-hang-diagnostic\n' > "$PROD_DEPLOY_LOCK/holder"
  dispose_stale_lock "$PROD_DEPLOY_LOCK" >/dev/null || gate "selftest: verified dispose must succeed" 1
  [ -d "$PROD_DEPLOY_LOCK" ] && gate "selftest: disposed lock must be gone" 1
  pass "selftest: dispose_stale_lock alive-refuse + verified-dispose"

  # (b) TOCTOU guard: decoy foreign process → FAIL_CLOSED + our mutex released.
  bash -c 'exec -a trusted-cp-deploy-install.sh sleep 30' &
  local_decoy=$!
  ( run ) > "$scratch/caseb.out" 2>&1
  grep -q "foreign production operation (trusted-cp-deploy-install.sh)" "$scratch/caseb.out" \
    || gate "selftest: TOCTOU guard must detect the decoy" 1
  [ -d "$PROD_DEPLOY_LOCK" ] && gate "selftest: TOCTOU fail must release only our own mutex" 1
  kill "$local_decoy" 2>/dev/null || true
  pass "selftest: TOCTOU guard FAIL_CLOSED + own mutex released"

  # (c) B2 mutation result: a fake pnpm that touches node_modules → MUTATED.
  PNPM_BIN="$scratch/fake-mutate"
  rm -rf "$DIAG_DIR"; mkdir -p "$DIAG_DIR"
  ( run ) > "$scratch/casec.out" 2>&1
  grep -q "INSTALLATION_MUTATION_RESULT=MUTATED" "$scratch/casec.out" || gate "selftest: mutating fake must report MUTATED" 1
  grep -q "PRODUCTION_MUTATION_STARTED=YES" "$scratch/casec.out" || gate "selftest: must mark mutation started at launch" 1
  pass "selftest: INSTALLATION_MUTATION_RESULT=MUTATED from file evidence"

  # (d) B2 mutation result: a fake pnpm that touches nothing → NO_NET_CHANGE_PROVEN.
  PNPM_BIN="/bin/echo"
  rm -rf "$DIAG_DIR"; mkdir -p "$DIAG_DIR"
  ( run ) > "$scratch/cased.out" 2>&1
  grep -q "INSTALLATION_MUTATION_RESULT=NO_NET_CHANGE_PROVEN" "$scratch/cased.out" \
    || gate "selftest: no-touch fake must report NO_NET_CHANGE_PROVEN" 1
  pass "selftest: INSTALLATION_MUTATION_RESULT=NO_NET_CHANGE_PROVEN from file evidence"

  # (e) B4: SIGTERM → wrapper exits 143, fake pnpm alive, mutex left, holder intact.
  PNPM_BIN="$scratch/fake-hang"
  rm -rf "$DIAG_DIR"; mkdir -p "$DIAG_DIR"
  ( run ) > "$scratch/casee.out" 2>&1 &
  wrap=$!
  sleep 2
  kill -TERM "$wrap"
  wait "$wrap" 2>/dev/null
  local_rc=$?
  [ "$local_rc" -eq 143 ] || gate "selftest: SIGTERM must exit 143" "got $local_rc"
  pgrep -f "$scratch/fake-hang" >/dev/null || gate "selftest: fake pnpm must stay alive after wrapper signal" 1
  [ -d "$PROD_DEPLOY_LOCK" ] || gate "selftest: mutex must survive the signal" 1
  grep -q "pnpm-offline-hang-diagnostic" "$PROD_DEPLOY_LOCK/holder" || gate "selftest: holder provenance must survive" 1
  pass "selftest: SIGTERM → exit 143, pnpm alive, mutex + holder intact"
  pkill -f "$scratch/fake-hang" 2>/dev/null || true
  dispose_stale_lock "$PROD_DEPLOY_LOCK" >/dev/null || true

  echo "SELFTEST=PASS"
  exit 0
fi

run
exit $?
