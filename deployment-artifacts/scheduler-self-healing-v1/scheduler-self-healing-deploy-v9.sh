#!/bin/bash
# =============================================================================
# scheduler-self-healing-deploy-v9.sh — SCHEDULER_SELF_HEALING_FROM_FEISHU_V1
# Phase C APP-ONLY SEALED GENERATION **FOLLOW-UP** (fresh live baseline
# 2d45fda7… = the V7C generation, ONE-FILE scope: self_ops model-visible).
#
# WHY V9 EXISTS: V8's G5 was authored against the PRE-re-enable world
# (retry.auto==false) and fail-closed at G5 on 2026-09-19 because the
# Owner-authorized HR re-enable had already landed (rev4/auto:true, receipt
# updatedAtMs=1789779023244) — a packet-authoring miss, zero mutation, the V8
# authorization consumed. V9 is byte-identical to V8 except G5: the gate now
# asserts the AUTHORIZED POST-RE-ENABLE ANCHOR (rev4/auto:true/1789779023244,
# fail-closed on drift) and the post-swap check requires the full anchor to
# persist. V9 ships exactly ONE file as a sealed app generation swap:
#   packages/broker/src/capabilities/self-ops.js -> e7f6105d…
#     (= V7C-deployed b302810c bytes MINUS the single infrastructure:true line;
#      accepted Tools V4 authority; implementation a5fed40, dual-reviewed
#      SEMANTIC=PASS SAFETY=PASS BLOCKERS=NONE)
# INVARIANTS: gateway.js stays 4c341db4… (V7C-deployed readiness wiring already
# live), scheduler.js stays e3e8dce0…, root package.json stays d5764403…,
# file SET unchanged. All other broker files (incl. WAP/other-lane divergent
# bytes) untouched.
#
# V7 principles carried over (Owner ruling 2026-09-18 + 2026-09-19 census
# directive): NO trusted-root reinstall, NO package manager, NO network fetch,
# NO corepack, NO full installer. Atomic renames in ONE parent dir. Any
# post-swap failure => automatic rollback. A PATH shim makes
# pnpm/corepack/npm/npx/yarn exit 99 if ever invoked.
#
# Modes:
#   (root) no args        -> production deployment
#   (any)  --fixture-selftest -> non-root sandbox regression (fake pnpm/corepack
#            in PATH exit 99 if invoked; proves the two-file build is
#            manifest-exact and the swap/rollback round-trip restores bytes)
# =============================================================================
set -uo pipefail
PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

FROZEN_MAIN_SHA="41f354d163f532348b2ad1ef33b5ee528655dfc6"
FROZEN_BROKER_SELFOPS_SHA="e7f6105de4be81e37ccc60e983fe005751880d9b8a0af93c9e0602a78da87620"
BROKER_SELFOPS_REL="packages/broker/src/capabilities/self-ops.js"
FROZEN_BROKER_GATEWAY_SHA="4c341db4d0369811b3df4a4eb7e711af33fdf84abe17a39349c5f75e7830490e"
BROKER_GATEWAY_REL="packages/broker/src/gateway.js"
SOURCE_ROOT="${SOURCE_ROOT:-/Users/yanfenma/workspace/project/dsh-agent-core-selfheal-impl/packages/broker/src}"
FROZEN_PREIMAGE_APP_MANIFEST_SHA="2d45fda740f4f8427cac6d953e2dd4fcbc2a36d1c40e70d1861c457678e29764"
FROZEN_TARGET_APP_MANIFEST_SHA="23ed158245424e9e42833fab6f344c8fa68c0e725e9cdc330a4f266882687cf1"
FROZEN_SCHEDULER_JS_SHA="e3e8dce0fd8959336521147b639007b82e8ce98d932eca82ca2b98ac2506770d"
FROZEN_LIVE_ROOT_PKG_SHA="d57644033f2ed7458272262dedad91c1cabc86aa51bc75bcc1f35184029299cd"
TRUSTED_ROOT="/usr/local/libexec/agent-core"
APP="$TRUSTED_ROOT/app"
CANONICAL_STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
CANONICAL_RUNS="/Users/authsvc/.agent-core/scheduler/runs.jsonl"
LOCK_ROOT="/usr/local/var/agent-core/production-mutation-locks"
STATE_ROOT="/usr/local/var/agent-core/scheduler-self-healing-v9-apponly"
RB_TMP="/private/tmp/scheduler-self-healing-deploy-v9-receipt"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

fail() { echo "FAIL $1" >&2; echo "DEPLOY=NO STOP=YES NO_BLIND_RETRY" >&2; exit 1; }
say() { echo "[deploy-v9] $*"; }
manifest_of() { (cd "$1" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1); }
file_sha() { shasum -a 256 "$1" 2>/dev/null | cut -d' ' -f1; }

# ---- package-manager guard (fake pnpm/corepack/npm/npx/yarn exit 99) --------
PM_GUARD_DIR=""
PM_TRIPFILE=""
setup_pm_guard() {
  PM_GUARD_DIR="$(mktemp -d /tmp/scheduler-v9-pm-shim.XXXXXX)"
  PM_TRIPFILE="$PM_GUARD_DIR/tripped"
  for pm in pnpm corepack npm npx yarn; do
    printf '#!/bin/sh\necho "pm-invoked:%%s" "$0" >> "%s"\nexit 99\n' "$PM_TRIPFILE" > "$PM_GUARD_DIR/$pm"
    chmod +x "$PM_GUARD_DIR/$pm"
  done
  export PATH="$PM_GUARD_DIR:$PATH"
}
pm_guard_clean() { [ -e "$PM_TRIPFILE" ] && return 1 || return 0; }

# ---- core building blocks (shared by production + fixture) ------------------
build_app_next_v9() { # $1=live_app  $2=source_root  $3=out_dir
  local live="$1" src="$2" out="$3"
  rm -rf "$out"
  cp -a "$live" "$out"
  cp "$src/capabilities/self-ops.js" "$out/$BROKER_SELFOPS_REL"
  # cp creates a root-owned file under sudo; the deployed generation must
  # keep the live ownership (runtime runs as authsvc)
  if [ "$(id -u)" = "0" ]; then
    chown authsvc:authsvc "$out/$BROKER_SELFOPS_REL"
  fi
}

verify_app_next() { # $1=next_dir  -> manifest printed; caller compares
  manifest_of "$1"
}

swap_generations() { # $1=app  $2=next  $3=rollback_target ; echoes rollback path
  local app="$1" next="$2" rb="$3"
  mv "$app" "$rb" || return 1
  mv "$next" "$app" || return 1
  echo "$rb"
}

restore_rollback() { # $1=app $2=rollback_gen $3=failed_gen_target
  local app="$1" rb="$2" failed="$3"
  mv "$app" "$failed" || return 1
  mv "$rb" "$app" || return 1
}

# ---- fixture selftest (non-root, sandboxed) ---------------------------------
fixture_selftest() {
  local S; S="$(mktemp -d /tmp/scheduler-v9-fixture.XXXXXX)"
  setup_pm_guard
  say "fixture sandbox: $S"
  # live-like app: OLD broker manifest + OLD gateway (no job_disposition marks
  # the old generation), NEW scheduler bytes, untouched sibling capability and
  # root package.json.
  mkdir -p "$S/app/packages/broker/src/capabilities" "$S/app/packages/scheduler/src"
  echo fixture-old-bytes > "$S/app/packages/broker/src/capabilities/self-ops.js"
  echo fixture-gateway-bytes > "$S/app/packages/broker/src/gateway.js"
  echo new-scheduler-bytes > "$S/app/packages/scheduler/src/scheduler.js"
  echo pkg-live > "$S/app/package.json"
  echo untouched-sibling > "$S/app/packages/broker/src/capabilities/workflow.js"
  mkdir -p "$S/srcroot/capabilities"
  printf 'new-manifest-job_disposition-model-visible\n' > "$S/srcroot/capabilities/self-ops.js"

  local pre_live expected built rb
  pre_live="$(manifest_of "$S/app")"
  # independent expectation: assembled by PLAIN COPIES (a different code path
  # than build_app_next_v9) — live tree with exactly ONE file replaced —
  # then aggregated with the same manifest pipeline. A build bug cannot
  # self-confirm through this path.
  local etree="$S/expected-tree"
  mkdir -p "$etree"
  cp -a "$S/app/." "$etree/"
  cp "$S/srcroot/capabilities/self-ops.js" "$etree/packages/broker/src/capabilities/self-ops.js"
  expected="$(manifest_of "$etree")"

  build_app_next_v9 "$S/app" "$S/srcroot" "$S/app.next" || { echo "FIXTURE=FAIL build"; exit 1; }
  built="$(verify_app_next "$S/app.next")"
  [ "$built" = "$expected" ] || { echo "FIXTURE=FAIL manifest built=$built expected=$expected (sandbox kept: $S)"; exit 1; }
  pm_guard_clean || { echo "FIXTURE=FAIL package manager invoked"; cat "$PM_TRIPFILE"; exit 1; }
  grep -q 'job_disposition' "$S/app.next/$BROKER_SELFOPS_REL" || { echo "FIXTURE=FAIL manifest bytes"; exit 1; }
  [ "$(cat "$S/app.next/packages/broker/src/gateway.js")" = "fixture-gateway-bytes" ] || { echo "FIXTURE=FAIL gateway must be untouched"; exit 1; }
  [ "$(cat "$S/app.next/packages/scheduler/src/scheduler.js")" = "new-scheduler-bytes" ] || { echo "FIXTURE=FAIL scheduler must be untouched"; exit 1; }
  [ "$(cat "$S/app.next/package.json")" = "pkg-live" ] || { echo "FIXTURE=FAIL root pkg must be untouched"; exit 1; }
  [ "$(cat "$S/app.next/packages/broker/src/capabilities/workflow.js")" = "untouched-sibling" ] || { echo "FIXTURE=FAIL sibling mutated"; exit 1; }
  [ "$(find "$S/app.next" -type f | wc -l | tr -d ' ')" = "$(find "$S/app" -type f | wc -l | tr -d ' ')" ] || { echo "FIXTURE=FAIL file set changed"; exit 1; }

  rb="$(swap_generations "$S/app" "$S/app.next" "$S/app.rollback-v9-test")" || { echo "FIXTURE=FAIL swap"; exit 1; }
  [ -d "$S/app" ] && [ -d "$S/app.rollback-v9-test" ] || { echo "FIXTURE=FAIL swap layout"; exit 1; }
  [ "$(manifest_of "$S/app")" = "$built" ] || { echo "FIXTURE=FAIL post-swap identity"; exit 1; }
  # rollback restore (Owner §6)
  restore_rollback "$S/app" "$S/app.rollback-v9-test" "$S/app.failed-v9-test" || { echo "FIXTURE=FAIL restore"; exit 1; }
  [ "$(manifest_of "$S/app")" = "$pre_live" ] || { echo "FIXTURE=FAIL restore manifest"; exit 1; }
  pm_guard_clean || { echo "FIXTURE=FAIL pm invoked late"; exit 1; }
  echo "FIXTURE=PASS (pm-guard clean, manifest-exact single-file build, gateway/scheduler/pkg untouched, swap+restore round-trip OK)"
  rm -rf "$S"
}

# ---- production flow ---------------------------------------------------------
production_main() {
  [ "$(id -u)" = "0" ] || { fail "must run as root"; exit 2; }
  mkdir -p "$STATE_ROOT/receipts" || exit 1
  chmod 700 "$STATE_ROOT"
  mkdir -p "$RB_TMP" || { echo "FATAL: cannot create $RB_TMP" >&2; exit 1; }
  local AUTH_MARKER="$STATE_ROOT/receipts/deploy-v9.auth"
  # atomic exactly-once acquisition: noclobber '>' fails when the marker
  # already exists, closing the check-then-create race under double execution
  if ! ( set -o noclobber; printf 'packet=FREEZE_V9\ntarget=%s\nauthorized_by=mayf3\ncreated=%s\n' \
        "$FROZEN_MAIN_SHA" "$(date -u +%FT%TZ)" > "$AUTH_MARKER" ) 2>/dev/null; then
    echo "ERROR: authorization already consumed ($AUTH_MARKER) — EXACTLY_ONCE" >&2
    exit 1
  fi
  chmod 600 "$AUTH_MARKER"
  say "G0 authorization reserved (consumed on any exit; new packet = new authorization)"
  local rollback_done=0 app_rb=""

  finish_ok() {
    say "POSTDEPLOY_PRECHECK=PASS — full acceptance continues outside this script"
  }
  post_swap_fail() { # $1 = reason ; automatic rollback per Owner §6
    say "POST-SWAP FAILURE: $1 — executing automatic rollback"
    if [ "$rollback_done" = "0" ] && [ -n "$app_rb" ] && [ -d "$app_rb" ]; then
      restore_rollback "$APP" "$app_rb" "$APP.failed-v9-$TS" \
        || { echo "FATAL: automatic rollback failed — manual recovery from $app_rb required" >&2; exit 1; }
      rollback_done=1
      launchctl kickstart -k system/ai.agent-core.runtime || true
      sleep 15
      curl -sf -m 5 http://127.0.0.1:8790/health >/dev/null && say "rollback runtime healthy" \
        || say "WARNING: rollback health check failed — inspect immediately"
    fi
    echo "DEPLOY=NO STOP=YES (rolled back to the pre-V9 generation)" >&2
    exit 1
  }

  # G1 source file pin (the ONE file v9 ships)
  [ -f "$SOURCE_ROOT/capabilities/self-ops.js" ] || fail "G1 source self-ops missing"
  local s1="$(file_sha "$SOURCE_ROOT/capabilities/self-ops.js")"
  [ "$s1" = "$FROZEN_BROKER_SELFOPS_SHA" ] || fail "G1 source self-ops pin mismatch ($s1)"
  grep -q 'job_disposition' "$SOURCE_ROOT/capabilities/self-ops.js" || fail "G1 source self-ops missing job_disposition"
  if grep -q 'infrastructure' "$SOURCE_ROOT/capabilities/self-ops.js"; then
    fail "G1 source self-ops still carries infrastructure flag"
  fi
  say "G1 source file bound (Tools V4 self_ops model-visible, ONE-file scope)"

  # G2 live app = the current authoritative generation (no drift since census)
  local live_man="$(manifest_of "$APP")"
  [ "$live_man" = "$FROZEN_PREIMAGE_APP_MANIFEST_SHA" ] || fail "G2 live app manifest drifted ($live_man)"
  say "G2 live app manifest matches the fresh census baseline"

  # G3 locks (store MUTATION lock absent; engine lease positively held)
  for lock in "$LOCK_ROOT/production-deploy.lock" "$LOCK_ROOT/scheduler-watchdog-routing-tx.lock" \
              "/Users/authsvc/.agent-core/scheduler/jobs.json.lock"; do
    [ -e "$lock" ] && fail "G3 lock present: $lock (explicit disposition required; NO_MANUAL_LOCK_DELETE)"
  done
  local engine_lock="/Users/authsvc/.agent-core/scheduler/jobs.json.engine.lock"
  [ -f "$engine_lock" ] || fail "G3 engine lease ABSENT while the canonical runtime is alive"
  local engine_pid="$(jq -r '.pid // empty' "$engine_lock" 2>/dev/null)"
  if [ -z "$engine_pid" ]; then
    engine_pid="$(grep -o '"pid":[0-9]*' "$engine_lock" 2>/dev/null | head -1 | cut -d: -f2)"
  fi
  case "$engine_pid" in "" | *[!0-9]*) fail "G3 engine lease holder pid unreadable" ;; esac
  kill -0 "$engine_pid" 2>/dev/null || fail "G3 engine lease holder pid $engine_pid not alive"
  local engine_cmd="$(ps -o command= -p "$engine_pid" 2>/dev/null)"
  case "$engine_cmd" in
    *production-runtime.mjs*"/Users/authsvc/.agent-core"*) : ;;
    *) fail "G3 engine lease holder is not the canonical runtime (pid $engine_pid: $engine_cmd)" ;;
  esac
  say "G3 locks: mutation/deploy/routing-tx ABSENT; engine lease HELD by live runtime pid $engine_pid"

  # G4 runtime health
  pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" >/dev/null || fail "G4 runtime not running"
  curl -sf -m 5 http://127.0.0.1:8790/health >/dev/null || fail "G4 8790/health not ok"
  local state_dir="$(/usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:SCHEDULER_WATCHDOG_STATE_DIR' /Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w2.plist 2>/dev/null)"
  state_dir="${state_dir:-/Users/authsvc/.agent-core/control/scheduler-watchdog}"
  local now_s="$(date +%s)"
  [ -f "$state_dir/w2.heartbeat" ] || fail "G4 W2 heartbeat missing"
  local hb_s="$(stat -f '%m' "$state_dir/w2.heartbeat")"
  [ $((now_s - hb_s)) -le 3600 ] || fail "G4 W2 heartbeat stale"
  local w2log="/usr/local/var/scheduler-watchdog/w2.log"
  [ -f "$w2log" ] || fail "G4 W2 log missing"
  local log_s="$(stat -f '%m' "$w2log")"
  [ $((now_s - log_s)) -le 1800 ] || fail "G4 W2 log stale"
  tail -3 "$w2log" | grep -q "suppressed_or_healthy" || fail "G4 W2 log not healthy"
  say "G4 runtime health PASS"

  # G5 HR authorized state (V9: post-re-enable anchor; frozen into receipt for
  # post-swap comparison). The bounded re-enable was receipted 2026-09-19
  # (REENABLE_COMMITTED_AND_VERIFIED) — the deployed expectation is
  # rev4/auto:true/updatedAtMs=1789779023244; any drift fail-closes BEFORE mutation.
  local hr="$(jq -c '.jobs[] | select(.id|startswith("b115cb96")) | {id, retry, scheduleRevision, updatedAtMs, enabled}' "$CANONICAL_STORE" 2>/dev/null | head -1)"
  [ -n "$hr" ] || fail "G5 HR job not found"
  jq -e '.enabled == true and .retry.auto == true and .scheduleRevision == 4 and .updatedAtMs == 1789779023244' >/dev/null 2>&1 <<<"$hr" || fail "G5 HR state != authorized re-enable anchor (rev4/auto:true/1789779023244)"
  printf '%s\n' "$hr" > "$STATE_ROOT/hr-job-before.json"
  say "G5 HR authorized re-enable anchor confirmed (rev4/auto:true frozen for post-swap comparison)"

  # G6b no conflicting production mutation process. Self family (our own
  # sudo/bash/tee command lines all contain "deploy-v9") is excluded; a
  # concurrent v9 double-run is already impossible past the G0 noclobber
  # marker, so G6b only guards OTHER families — including stale v7/v7b reruns
  # and installer-lineage processes (Owner rule: fail-closed, never race).
  local g6b_hits
  g6b_hits="$(pgrep -fl 'trusted-cp-deploy-install|run-authorized-transaction|run-routing-install|scheduler-self-healing-deploy|wap-broker-only-deploy' 2>/dev/null | grep -v 'deploy-v9' || true)"
  if [ -n "$g6b_hits" ]; then
    printf '%s\n' "$g6b_hits"
    fail "G6b conflicting production mutation process running"
  fi
  say "G6b no conflicting production mutation process"

  # G7 no in-flight occurrence (restart must not create outcome_unknown)
  local wait=0 inflight=1
  while [ "$wait" -le 2 ]; do
    inflight="$(jq '[.occurrences[] | select(.state == "admitted" or .state == "running")] | length' "$CANONICAL_STORE" 2>/dev/null || echo 999)"
    [ "$inflight" = "0" ] && break
    say "G7 in-flight occurrence present — waiting ($((wait+1))/3)"
    sleep 10; wait=$((wait+1))
  done
  [ "$inflight" = "0" ] || fail "G7 in-flight occurrence still present after 30s (retry the packet later; NO forced restart over an in-flight turn)"
  say "G7 no in-flight occurrence"

  # G8 space
  local need_kb app_kb free_kb
  app_kb="$(du -sk "$APP" | cut -f1)"
  need_kb=$((app_kb * 2 + 20480))
  free_kb="$(df -k /usr/local/libexec/agent-core | awk 'NR==2 {print $4}')"
  [ "$free_kb" -ge "$need_kb" ] || fail "G8 insufficient space: need ${need_kb}KB free ${free_kb}KB"

  # BUILD + VERIFY sealed generation (TWO files on top of the live generation)
  setup_pm_guard
  local next="$TRUSTED_ROOT/app.next-v9-$TS"
  build_app_next_v9 "$APP" "$SOURCE_ROOT" "$next" || fail "G9 app.next build failed"
  local built_man="$(manifest_of "$next")"
  [ "$built_man" = "$FROZEN_TARGET_APP_MANIFEST_SHA" ] || fail "G9 built app.next manifest != frozen v9 target ($built_man)"
  local b1="$(file_sha "$next/$BROKER_SELFOPS_REL")"
  [ "$b1" = "$FROZEN_BROKER_SELFOPS_SHA" ] || fail "G9 broker self-ops != frozen target"
  local b2="$(file_sha "$next/$BROKER_GATEWAY_REL")"
  [ "$b2" = "$FROZEN_BROKER_GATEWAY_SHA" ] || fail "G9 broker gateway != frozen target"
  grep -q 'job_disposition' "$next/$BROKER_SELFOPS_REL" || fail "G9 broker self-ops missing job_disposition"
  grep -q 'job_disposition' "$next/$BROKER_GATEWAY_REL" || fail "G9 broker gateway missing job_disposition"
  local gw_sha="$(file_sha "$next/packages/broker/src/gateway.js")"
  [ "$gw_sha" = "$FROZEN_BROKER_GATEWAY_SHA" ] || fail "G9 gateway.js drifted (v9 must not touch gateway)"
  local sched_sha="$(file_sha "$next/packages/scheduler/src/scheduler.js")"
  [ "$sched_sha" = "$FROZEN_SCHEDULER_JS_SHA" ] || fail "G9 scheduler.js drifted (v9 must not touch scheduler)"
  local pkg_sha="$(file_sha "$next/package.json")"
  [ "$pkg_sha" = "$FROZEN_LIVE_ROOT_PKG_SHA" ] || fail "G9 root package.json drifted"
  pm_guard_clean || fail "G9 package manager invoked (see $(cat "$PM_TRIPFILE"))"
  say "G9 sealed app.next built+verified (manifest $built_man; single-file scope; pm-guard clean)"

  # G7b in-flight re-check adjacent to the swap (the build window may have
  # admitted a new slot; kickstart over it would manufacture an outcome_unknown)
  inflight="$(jq '[.occurrences[] | select(.state == "admitted" or .state == "running")] | length' "$CANONICAL_STORE" 2>/dev/null || echo 999)"
  [ "$inflight" = "0" ] || fail "G7b in-flight occurrence appeared during build — re-run this packet when idle"
  say "G7b in-flight re-check clean"
  # G6 non-target surface PRE hashes (acceptance evidence; post compared at end)
  local pre_harness="$(manifest_of "$TRUSTED_ROOT/harness")"
  local pre_node="$(manifest_of "$TRUSTED_ROOT/node-runtime")"
  local pre_home="$(manifest_of "$TRUSTED_ROOT/home")"
  local pre_config="$(manifest_of "$TRUSTED_ROOT/config")"
  local pre_helper="$(file_sha /usr/local/libexec/dsh-agent-spawn-helper)"
  local pre_routing="$(file_sha "$TRUSTED_ROOT/config/scheduler-routing.json")"
  say "G6 non-target PRE hashes captured (harness/node-runtime/home/config/helper/routing)"

  # APPLY (atomic renames, same parent dir)
  app_rb="$APP.rollback-v9-$TS"
  if ! swap_out="$(swap_generations "$APP" "$next" "$app_rb")"; then
    # partial mv state possible: restore from the rollback generation directly
    [ -d "$app_rb" ] && { rm -rf "$APP" 2>/dev/null || true; mv "$app_rb" "$APP"; launchctl kickstart -k system/ai.agent-core.runtime || true; }
    [ -d "$APP" ] || { echo "FATAL: swap failed and restore failed — pre-V9 generation preserved at $app_rb; manual recovery required" >&2; exit 1; }
    fail "APPLY swap failed (restored pre-V9 generation)"
  fi
  say "APPLY swapped: pre-V9 generation preserved at $app_rb"
  launchctl kickstart -k system/ai.agent-core.runtime || post_swap_fail "kickstart failed"
  sleep 20
  local newpid="$(pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" | head -1)"
  [ -n "$newpid" ] || post_swap_fail "runtime not running after kickstart"
  sleep 10
  local newpid2="$(pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" | head -1)"
  [ "$newpid" = "$newpid2" ] || post_swap_fail "runtime crash-looping ($newpid -> $newpid2)"
  curl -sf -m 5 http://127.0.0.1:8790/health >/dev/null || post_swap_fail "8790/health not ok"
  local dep_sched="$(file_sha "$APP/packages/scheduler/src/scheduler.js")"
  [ "$dep_sched" = "$FROZEN_SCHEDULER_JS_SHA" ] || post_swap_fail "deployed scheduler.js changed (v9 must not touch scheduler)"
  local dep_b1="$(file_sha "$APP/$BROKER_SELFOPS_REL")"
  [ "$dep_b1" = "$FROZEN_BROKER_SELFOPS_SHA" ] || post_swap_fail "deployed broker self-ops != frozen v9 target"
  local dep_b2="$(file_sha "$APP/$BROKER_GATEWAY_REL")"
  [ "$dep_b2" = "$FROZEN_BROKER_GATEWAY_SHA" ] || post_swap_fail "deployed broker gateway != frozen v9 target"
  grep -q 'job_disposition' "$APP/$BROKER_SELFOPS_REL" || post_swap_fail "deployed broker self-ops missing job_disposition"
  grep -q 'job_disposition' "$APP/$BROKER_GATEWAY_REL" || post_swap_fail "deployed broker gateway missing job_disposition"
  # engine lease re-acquired by the NEW runtime (pid-death reaping is pid-proven)
  sleep 5
  local new_engine="$(jq -r '.pid // empty' "$engine_lock" 2>/dev/null)"
  [ -n "$new_engine" ] && [ "$new_engine" = "$newpid" ] || say "WARNING: engine lease holder ($new_engine) != new pid ($newpid) yet — re-check in acceptance"
  # error tail + parse smoke
  sleep 30
  local err_tail="$(tail -200 "$CANONICAL_RUNS" 2>/dev/null | grep -ci 'tick failed\|invalid retry predecessor' || true)"
  local runs_parse="FAIL"
  tail -1 "$CANONICAL_RUNS" 2>/dev/null | jq -e 'type == "object"' >/dev/null 2>&1 && runs_parse="OK"
  # non-target POST hashes (acceptance evidence)
  local post_harness="$(manifest_of "$TRUSTED_ROOT/harness")"
  local post_node="$(manifest_of "$TRUSTED_ROOT/node-runtime")"
  local post_home="$(manifest_of "$TRUSTED_ROOT/home")"
  local post_config="$(manifest_of "$TRUSTED_ROOT/config")"
  local post_helper="$(file_sha /usr/local/libexec/dsh-agent-spawn-helper)"
  local post_routing="$(file_sha "$TRUSTED_ROOT/config/scheduler-routing.json")"
  [ "$post_harness" = "$pre_harness" ] && [ "$post_node" = "$pre_node" ] && [ "$post_home" = "$pre_home" ] \
    && [ "$post_config" = "$pre_config" ] && [ "$post_helper" = "$pre_helper" ] && [ "$post_routing" = "$pre_routing" ] \
    || post_swap_fail "non-target surface hash changed (harness/node-runtime/home/config/helper/routing)"
  local hr_after="$(jq -c '.jobs[] | select(.id|startswith("b115cb96")) | {retry, scheduleRevision, updatedAtMs}' "$CANONICAL_STORE" 2>/dev/null | head -1)"
  jq -e '.retry.auto == true and .scheduleRevision == 4 and .updatedAtMs == 1789779023244' >/dev/null 2>&1 <<<"$hr_after" || post_swap_fail "HR authorized anchor changed during deploy"

  pm_guard_clean || post_swap_fail "package manager invoked during deployment"
  {
    echo "DEPLOYMENT=PASS"
    echo "TARGET_SOURCE_SHA=$FROZEN_MAIN_SHA"
    echo "V9_SCOPE=$BROKER_SELFOPS_REL + $BROKER_GATEWAY_REL ONLY"
    echo "PRIOR_GENERATION_MANIFEST=$FROZEN_PREIMAGE_APP_MANIFEST_SHA (fresh census baseline 2026-09-19 07:56)"
    echo "DEPLOYED_APP_MANIFEST_SHA=$(manifest_of "$APP")"
    echo "DEPLOYED_BROKER_SELFOPS_SHA=$dep_b1"
    echo "DEPLOYED_BROKER_GATEWAY_SHA=$dep_b2"
    echo "DEPLOYED_SCHEDULER_JS=$dep_sched"
    echo "RUNTIME_PID=$newpid"
    echo "ENGINE_LEASE_PID=$new_engine"
    echo "ROLLBACK_GENERATION=$app_rb"
    echo "ROLLBACK=mv $APP $APP.failed-v9-\$TS && mv $app_rb $APP && launchctl kickstart -k system/ai.agent-core.runtime"
    echo "NON_TARGET_PRE_POST=harness:$pre_harness->$post_harness node:$pre_node->$post_node home:$pre_home->$post_home config:$pre_config->$post_config helper:$pre_helper->$post_helper routing:$pre_routing->$post_routing"
    echo "HR_JOB_BEFORE=$hr"
    echo "HR_JOB_AFTER=$hr_after"
    echo "ERROR_TAIL_COUNT_LAST200=$err_tail"
    echo "RUNS_JSONL_PARSE_SMOKE=$runs_parse"
    echo "PM_GUARD=$(pm_guard_clean && echo CLEAN || echo TRIPPED)"
    echo "DO_NOT_REENABLE_HR_RETRY_AUTO=true (until POSTDEPLOY_VERIFICATION=PASS)"
    echo "COMMITTED_AT=$(date -u +%FT%TZ)"
  } | tee "$RB_TMP/deploy-receipt.txt"
  cp "$RB_TMP/deploy-receipt.txt" "$STATE_ROOT/receipts/deploy-v9.receipt" \
    || { echo "FATAL: receipt write failed — deployment SUCCEEDED but receipt only in $RB_TMP" >&2; exit 1; }
  finish_ok
}

case "${1:-}" in
  --fixture-selftest) fixture_selftest ;;
  "") production_main ;;
  *) echo "usage: $0 [--fixture-selftest]" >&2; exit 2 ;;
esac
