#!/bin/bash
# =============================================================================
# scheduler-self-healing-deploy-v7.sh — SCHEDULER_SELF_HEALING_FROM_FEISHU_V1
# Phase C APP-ONLY SEALED GENERATION deployment (target
# 41f354d163f532348b2ad1ef33b5ee528655dfc6).
#
# V7 principles (Owner ruling 2026-09-18): ship ONLY the new Scheduler app
# bytes as a sealed app generation. NO trusted-root reinstall, NO package
# manager, NO network fetch, NO corepack: harness/, node-runtime/, home/,
# config/, .cache/ and the spawn helper are untouched surfaces (pre/post
# hashed as acceptance evidence). A PATH shim makes pnpm/corepack/npm/npx/yarn
# exit 99 if anything ever tries to invoke them.
#
# Mutation shape (same-filesystem, atomic renames in ONE parent dir):
#   1. app.next built = current live app copy + packages/scheduler replaced
#      wholesale from the frozen staging (41f354d) + root package.json
#   2. app.next manifest verified against the frozen TARGET_APP_MANIFEST
#   3. mv app  -> app.rollback-v7-<ts>   (exact rollback generation)
#      mv app.next -> app
#   4. launchctl kickstart -k system/ai.agent.core.runtime + verification
#   Any post-swap failure => automatic rollback per Owner spec (failed-v7
#   generation preserved; old generation restored; kickstart; readback).
#
# Modes:
#   (root) no args        -> production deployment
#   (any)  --fixture-selftest -> non-root sandbox regression (fake pnpm/corepack
#            in PATH exit 99 if invoked; proves the runbook never calls them and
#            non-target bytes survive the swap)
# =============================================================================
set -uo pipefail
PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

FROZEN_MAIN_SHA="41f354d163f532348b2ad1ef33b5ee528655dfc6"
FROZEN_STAGING_MANIFEST_SHA="ee8e9d23d3bc3eb282db81a92399045f721000d2497b0181cdc108a14c35feb2"
FROZEN_PREIMAGE_APP_MANIFEST_SHA="66ebc369987bebbfd44549c6d0c8cfc32700decae9b4755ec63913e3a58b6721"
FROZEN_TARGET_APP_MANIFEST_SHA="c41a90453d0170085b3959943af70b1111c9403b5191e097649e28c01c4e15b7"
FROZEN_TARGET_ROOT_PKG_SHA="d57644033f2ed7458272262dedad91c1cabc86aa51bc75bcc1f35184029299cd"
FROZEN_SCHEDULER_JS_SHA="e3e8dce0fd8959336521147b639007b82e8ce98d932eca82ca2b98ac2506770d"
STAGING="${STAGING_DIR:-/Users/yanfenma/workspace/project/dsh-selfheal-staging-41f354d}"
TRUSTED_ROOT="/usr/local/libexec/agent-core"
APP="$TRUSTED_ROOT/app"
CANONICAL_STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
CANONICAL_RUNS="/Users/authsvc/.agent-core/scheduler/runs.jsonl"
LOCK_ROOT="/usr/local/var/agent-core/production-mutation-locks"
STATE_ROOT="/usr/local/var/agent-core/scheduler-self-healing-v7-apponly"
RB_TMP="/private/tmp/scheduler-self-healing-deploy-v7-receipt"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

fail() { echo "FAIL $1" >&2; echo "DEPLOY=NO STOP=YES NO_BLIND_RETRY" >&2; exit 1; }
say() { echo "[deploy-v7] $*"; }
manifest_of() { (cd "$1" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1); }
file_sha() { shasum -a 256 "$1" 2>/dev/null | cut -d' ' -f1; }

# ---- package-manager guard (fake pnpm/corepack/npm/npx/yarn exit 99) --------
PM_GUARD_DIR=""
PM_TRIPFILE=""
setup_pm_guard() {
  PM_GUARD_DIR="$(mktemp -d /tmp/scheduler-v7-pm-shim.XXXXXX)"
  PM_TRIPFILE="$PM_GUARD_DIR/tripped"
  for pm in pnpm corepack npm npx yarn; do
    printf '#!/bin/sh\necho "pm-invoked:%%s" "$0" >> "%s"\nexit 99\n' "$PM_TRIPFILE" > "$PM_GUARD_DIR/$pm"
    chmod +x "$PM_GUARD_DIR/$pm"
  done
  export PATH="$PM_GUARD_DIR:$PATH"
}
pm_guard_clean() { [ -e "$PM_TRIPFILE" ] && return 1 || return 0; }

# ---- core building blocks (shared by production + fixture) ------------------
build_app_next() { # $1=live_app  $2=staging  $3=out_dir
  local live="$1" stg="$2" out="$3"
  rm -rf "$out"
  cp -a "$live" "$out"
  rm -rf "$out/packages/scheduler"
  cp -R "$stg/packages/scheduler" "$out/packages/scheduler"
  cp "$stg/package.json" "$out/package.json"
  # cp -R/cp create root-owned files under sudo; the deployed generation must
  # keep the live ownership (runtime runs as authsvc)
  if [ "$(id -u)" = "0" ]; then
    chown -R authsvc:authsvc "$out/packages/scheduler" "$out/package.json"
  fi
  # scope enforcement is carried ENTIRELY by G9 (built manifest ==
  # frozen TARGET_APP_MANIFEST): every non-scheduler byte is pinned to
  # the live generation and every scheduler byte to 41f354d. A
  # staging-vs-live file loop is unsatisfiable here (staging is a full
  # checkout, live is the narrow closure) and was removed after review.
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
  local S; S="$(mktemp -d /tmp/scheduler-v7-fixture.XXXXXX)"
  setup_pm_guard
  say "fixture sandbox: $S"
  # live-like app: OLD scheduler (flat history file marks the old generation),
  # an untouched sibling package, node_modules bridge, root package.json.
  mkdir -p "$S/app/packages/scheduler/src/self-ops" "$S/app/packages/scheduler/src/watchdog" \
           "$S/app/packages/agent-x/src" "$S/app/scripts" "$S/app/node_modules/@agent-core" \
           "$S/harness-farm/@deepseek-ai" \
           "$S/staging/packages/scheduler/src/self-ops" "$S/staging/packages/scheduler/src/watchdog" \
           "$S/staging/packages/scheduler/src/history" \
           "$S/staging/packages/agent-x/src" "$S/staging/scripts" "$S/other"
  echo old-root-pkg > "$S/app/package.json"
  echo old-scheduler > "$S/app/packages/scheduler/src/scheduler.js"
  echo old-flat-history > "$S/app/packages/scheduler/src/history-sink.js"
  echo old-selfops > "$S/app/packages/scheduler/src/self-ops/index.js"
  echo old-slotacc > "$S/app/packages/scheduler/src/watchdog/slot-accounting.js"
  echo untouched-x > "$S/app/packages/agent-x/src/index.js"
  echo '{"name":"agent-x"}' > "$S/app/packages/agent-x/package.json"
  echo '{"name":"scheduler"}' > "$S/app/packages/scheduler/package.json"
  echo runtime-entry > "$S/app/scripts/production-runtime.mjs"
  ln -s ../../harness-farm/@deepseek-ai "$S/app/node_modules/@deepseek-ai"
  ln -s "$S/app/packages/agent-x" "$S/app/node_modules/@agent-core/agent-x"
  echo harness-bytes > "$S/harness-farm/@deepseek-ai/session"
  # staging (target): NEW scheduler with added+renamed files; agent-x identical
  echo new-scheduler > "$S/staging/packages/scheduler/src/scheduler.js"
  echo new-selfops > "$S/staging/packages/scheduler/src/self-ops/index.js"
  echo new-diagnosis > "$S/staging/packages/scheduler/src/self-ops/diagnosis.js"
  echo new-isolation > "$S/staging/packages/scheduler/src/watchdog/admission-isolation.js"
  echo new-historydir > "$S/staging/packages/scheduler/src/history/history-sink.js"
  echo '{"name":"scheduler"}' > "$S/staging/packages/scheduler/package.json"
  echo untouched-x > "$S/staging/packages/agent-x/src/index.js"
  echo '{"name":"agent-x"}' > "$S/staging/packages/agent-x/package.json"
  echo new-root-pkg > "$S/staging/package.json"
  echo runtime-entry > "$S/staging/scripts/production-runtime.mjs"

  local pre_live expected built rb
  pre_live="$(manifest_of "$S/app")"
  # independent expectation: assembled by PLAIN COPIES (a different code path
  # than build_app_next) — live tree, scheduler subtree swapped from staging,
  # root package.json swapped — then aggregated with the same manifest
  # pipeline. A build bug cannot self-confirm through this path.
  local etree="$S/expected-tree"
  mkdir -p "$etree"
  cp -a "$S/app/." "$etree/"
  rm -rf "$etree/packages/scheduler"
  cp -R "$S/staging/packages/scheduler" "$etree/packages/scheduler"
  cp "$S/staging/package.json" "$etree/package.json"
  expected="$(manifest_of "$etree")"

  build_app_next "$S/app" "$S/staging" "$S/app.next" || { echo "FIXTURE=FAIL build"; exit 1; }
  built="$(verify_app_next "$S/app.next")"
  [ "$built" = "$expected" ] || { echo "FIXTURE=FAIL manifest built=$built expected=$expected (sandbox kept: $S)"; (cd "$S/app.next" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256) > /tmp/sched-v7-built.lines; exit 1; }
  pm_guard_clean || { echo "FIXTURE=FAIL package manager invoked"; cat "$PM_TRIPFILE"; exit 1; }
  [ "$(cat "$S/app.next/packages/scheduler/src/scheduler.js")" = "new-scheduler" ] || { echo "FIXTURE=FAIL new bytes"; exit 1; }
  [ -f "$S/app.next/packages/scheduler/src/self-ops/diagnosis.js" ] || { echo "FIXTURE=FAIL added file"; exit 1; }
  [ ! -f "$S/app.next/packages/scheduler/src/history-sink.js" ] || { echo "FIXTURE=FAIL stale flat file must be gone"; exit 1; }
  [ "$(cat "$S/app.next/packages/agent-x/src/index.js")" = "untouched-x" ] || { echo "FIXTURE=FAIL sibling mutated"; exit 1; }
  [ "$(cat "$S/app.next/package.json")" = "new-root-pkg" ] || { echo "FIXTURE=FAIL root pkg"; exit 1; }

  rb="$(swap_generations "$S/app" "$S/app.next" "$S/app.rollback-v7-test")" || { echo "FIXTURE=FAIL swap"; exit 1; }
  [ -d "$S/app" ] && [ -d "$S/app.rollback-v7-test" ] || { echo "FIXTURE=FAIL swap layout"; exit 1; }
  [ "$(manifest_of "$S/app")" = "$built" ] || { echo "FIXTURE=FAIL post-swap identity"; exit 1; }
  # rollback restore (Owner §6)
  restore_rollback "$S/app" "$S/app.rollback-v7-test" "$S/app.failed-v7-test" || { echo "FIXTURE=FAIL restore"; exit 1; }
  [ "$(manifest_of "$S/app")" = "$pre_live" ] || { echo "FIXTURE=FAIL restore manifest"; exit 1; }
  pm_guard_clean || { echo "FIXTURE=FAIL pm invoked late"; exit 1; }
  echo "FIXTURE=PASS (pm-guard clean, manifest-exact build, added/removed files correct, swap+restore round-trip OK)"
  rm -rf "$S"
}

# ---- production flow ---------------------------------------------------------
production_main() {
  [ "$(id -u)" = "0" ] || { fail "must run as root"; exit 2; }
  mkdir -p "$STATE_ROOT/receipts" || exit 1
  chmod 700 "$STATE_ROOT"
  mkdir -p "$RB_TMP" || { echo "FATAL: cannot create $RB_TMP" >&2; exit 1; }
  local AUTH_MARKER="$STATE_ROOT/receipts/deploy-v7.auth"
  # atomic exactly-once acquisition: noclobber '>' fails when the marker
  # already exists, closing the check-then-create race under double execution
  if ! ( set -o noclobber; printf 'packet=FREEZE_V7\ntarget=%s\nauthorized_by=mayf3\ncreated=%s\n' \
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
      restore_rollback "$APP" "$app_rb" "$APP.failed-v7-$TS" \
        || { echo "FATAL: automatic rollback failed — manual recovery from $app_rb required" >&2; exit 1; }
      rollback_done=1
      launchctl kickstart -k system/ai.agent-core.runtime || true
      sleep 15
      curl -sf -m 5 http://127.0.0.1:8790/health >/dev/null && say "rollback runtime healthy" \
        || say "WARNING: rollback health check failed — inspect immediately"
    fi
    echo "DEPLOY=NO STOP=YES (rolled back to the pre-V7 generation)" >&2
    exit 1
  }

  # G1 frozen source
  [ -f "$STAGING/scripts/demo-home.mjs" ] || fail "G1 staging missing"
  local stg_man="$(manifest_of "$STAGING")"
  [ "$stg_man" = "$FROZEN_STAGING_MANIFEST_SHA" ] || fail "G1 staging manifest drift ($stg_man)"
  say "G1 frozen staging bound ($FROZEN_MAIN_SHA)"

  # G2 live app = the frozen G6 generation (no drift)
  local live_man="$(manifest_of "$APP")"
  [ "$live_man" = "$FROZEN_PREIMAGE_APP_MANIFEST_SHA" ] || fail "G2 live app manifest drifted ($live_man)"
  say "G2 live app manifest matches the frozen preimage"

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

  # G5 HR mitigation state (frozen into receipt for the later bounded re-enable)
  local hr="$(jq -c '.jobs[] | select(.id|startswith("b115cb96")) | {id, retry, scheduleRevision, updatedAtMs, enabled}' "$CANONICAL_STORE" 2>/dev/null | head -1)"
  [ -n "$hr" ] || fail "G5 HR job not found"
  jq -e '.retry.auto == false and .enabled == true' >/dev/null 2>&1 <<<"$hr" || fail "G5 HR retry.auto!=false"
  printf '%s\n' "$hr" > "$STATE_ROOT/hr-job-before.json"
  say "G5 HR mitigation confirmed (revision+updatedAtMs frozen for the bounded re-enable)"


  # G6b no conflicting production mutation process (restored from v6)
  if pgrep -fl "trusted-cp-deploy-install|run-authorized-transaction|run-routing-install" >/dev/null 2>&1; then
    pgrep -fl "trusted-cp-deploy-install|run-authorized-transaction|run-routing-install"
    fail "G6b conflicting production mutation process running"
  fi
  # G6c staging key-hash pins (restored from v6)
  local line want rel got
  while IFS= read -r line; do
    want="${line%% *}"
    rel="${line##*  }"
    got="$(file_sha "$STAGING/$rel")"
    [ "$got" = "$want" ] || fail "G6c staging key hash mismatch $rel"
  done <<'KEYS'
e3e8dce0fd8959336521147b639007b82e8ce98d932eca82ca2b98ac2506770d  packages/scheduler/src/scheduler.js
939863a5d706c74c9129a443b00445ea638dd7791c60609259ee80d11006627b  packages/scheduler/src/eligibility.js
5c770d5e99ebc20f794284020aa9cf5471609e9bf7c9e1e2ff3c2be5a8671d25  packages/scheduler/src/watchdog/admission-isolation.js
0fcb6811f53278f23bca7bfed1cd841a1034874054533453935e4c75da4c4293  packages/scheduler/src/self-ops/index.js
4038e4f88086f49bae3e367b1df669e9f874286231b50606397ba5b6c90540df  packages/scheduler/src/self-ops/diagnosis.js
86f547f3ee51b291999432aab119916e98696f1dd4b5a3a9dccb505bc2b9a5a7  packages/scheduler/src/occurrence.js
a8eacf4f16edd207b7181a5fcc47b30a4b26c9e852d335ca2746c88fd4ac3fcc  packages/scheduler/src/store.js
KEYS
  say "G6b/G6c no conflicting process; staging key pins verified"

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

  # BUILD + VERIFY sealed generation
  setup_pm_guard
  local next="$TRUSTED_ROOT/app.next-v7-$TS"
  build_app_next "$APP" "$STAGING" "$next" || fail "G9 app.next build failed"
  local built_man="$(manifest_of "$next")"
  [ "$built_man" = "$FROZEN_TARGET_APP_MANIFEST_SHA" ] || fail "G9 built app.next manifest != frozen target ($built_man)"
  local sched_sha="$(file_sha "$next/packages/scheduler/src/scheduler.js")"
  [ "$sched_sha" = "$FROZEN_SCHEDULER_JS_SHA" ] || fail "G9 scheduler.js != frozen target"
  local pkg_sha="$(file_sha "$next/package.json")"
  [ "$pkg_sha" = "$FROZEN_TARGET_ROOT_PKG_SHA" ] || fail "G9 root package.json != frozen target"
  pm_guard_clean || fail "G9 package manager invoked (see $(cat "$PM_TRIPFILE"))"
  say "G9 sealed app.next built+verified (manifest $built_man; pm-guard clean)"

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
  local pre_routing="$(file_sha /Users/authsvc/.agent-core/scheduler/routing.json)"
  say "G6 non-target PRE hashes captured (harness/node-runtime/home/config/helper/routing)"

  # APPLY (atomic renames, same parent dir)
  app_rb="$APP.rollback-v7-$TS"
  if ! swap_out="$(swap_generations "$APP" "$next" "$app_rb")"; then
    # partial mv state possible: restore from the rollback generation directly
    [ -d "$app_rb" ] && { rm -rf "$APP" 2>/dev/null || true; mv "$app_rb" "$APP"; launchctl kickstart -k system/ai.agent-core.runtime || true; }
    [ -d "$APP" ] || { echo "FATAL: swap failed and restore failed — pre-V7 generation preserved at $app_rb; manual recovery required" >&2; exit 1; }
    fail "APPLY swap failed (restored pre-V7 generation)"
  fi
  say "APPLY swapped: old generation preserved at $app_rb"
  launchctl kickstart -k system/ai.agent-core.runtime || post_swap_fail "kickstart failed"
  sleep 20
  local newpid="$(pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" | head -1)"
  [ -n "$newpid" ] || post_swap_fail "runtime not running after kickstart"
  sleep 10
  local newpid2="$(pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" | head -1)"
  [ "$newpid" = "$newpid2" ] || post_swap_fail "runtime crash-looping ($newpid -> $newpid2)"
  curl -sf -m 5 http://127.0.0.1:8790/health >/dev/null || post_swap_fail "8790/health not ok"
  local dep_sched="$(file_sha "$APP/packages/scheduler/src/scheduler.js")"
  [ "$dep_sched" = "$FROZEN_SCHEDULER_JS_SHA" ] || post_swap_fail "deployed scheduler.js != frozen target"
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
  local post_routing="$(file_sha /Users/authsvc/.agent-core/scheduler/routing.json)"
  [ "$post_harness" = "$pre_harness" ] && [ "$post_node" = "$pre_node" ] && [ "$post_home" = "$pre_home" ] \
    && [ "$post_config" = "$pre_config" ] && [ "$post_helper" = "$pre_helper" ] && [ "$post_routing" = "$pre_routing" ] \
    || post_swap_fail "non-target surface hash changed (harness/node-runtime/home/config/helper/routing)"
  local hr_after="$(jq -c '.jobs[] | select(.id|startswith("b115cb96")) | {retry, scheduleRevision}' "$CANONICAL_STORE" 2>/dev/null | head -1)"
  jq -e '.retry.auto == false' >/dev/null 2>&1 <<<"$hr_after" || post_swap_fail "HR retry.auto changed during deploy"

  pm_guard_clean || post_swap_fail "package manager invoked during deployment"
  {
    echo "DEPLOYMENT=PASS"
    echo "TARGET_SOURCE_SHA=$FROZEN_MAIN_SHA"
    echo "DEPLOYED_APP_MANIFEST_SHA=$(manifest_of "$APP")"
    echo "DEPLOYED_SCHEDULER_JS=$dep_sched"
    echo "RUNTIME_PID=$newpid"
    echo "ENGINE_LEASE_PID=$new_engine"
    echo "ROLLBACK_GENERATION=$app_rb"
    echo "ROLLBACK=mv $APP $APP.failed-v7-\$TS && mv $app_rb $APP && launchctl kickstart -k system/ai.agent-core.runtime"
    echo "NON_TARGET_PRE_POST=harness:$pre_harness->$post_harness node:$pre_node->$post_node home:$pre_home->$post_home config:$pre_config->$post_config helper:$pre_helper->$post_helper routing:$pre_routing->$post_routing"
    echo "HR_JOB_BEFORE=$hr"
    echo "HR_JOB_AFTER=$hr_after"
    echo "ERROR_TAIL_COUNT_LAST200=$err_tail"
    echo "RUNS_JSONL_PARSE_SMOKE=$runs_parse"
    echo "PM_GUARD=$(pm_guard_clean && echo CLEAN || echo TRIPPED)"
    echo "R1_ATTRIBUTION=WATCHDOG_LARK_V3_G6_NARROW_DEPLOY (carried into acceptance)"
    echo "DO_NOT_REENABLE_HR_RETRY_AUTO=true (until POSTDEPLOY_VERIFICATION=PASS)"
    echo "COMMITTED_AT=$(date -u +%FT%TZ)"
  } | tee "$RB_TMP/deploy-receipt.txt"
  cp "$RB_TMP/deploy-receipt.txt" "$STATE_ROOT/receipts/deploy-v7.receipt" \
    || { echo "FATAL: receipt write failed — deployment SUCCEEDED but receipt only in $RB_TMP" >&2; exit 1; }
  finish_ok
}

case "${1:-}" in
  --fixture-selftest) fixture_selftest ;;
  "") production_main ;;
  *) echo "usage: $0 [--fixture-selftest]" >&2; exit 2 ;;
esac
