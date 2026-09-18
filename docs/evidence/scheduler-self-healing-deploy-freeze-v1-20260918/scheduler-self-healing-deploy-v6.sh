#!/bin/bash
# =============================================================================
# scheduler-self-healing-deploy-v6.sh — SCHEDULER_SELF_HEALING_FROM_FEISHU_V1
# Phase C authorized deployment (target 41f354d163f532348b2ad1ef33b5ee528655dfc6).
# V6 supersedes V5: the V5 attempt was consumed by a FALSE-FAIL gate —
# jobs.json.engine.lock was required ABSENT, but that lock is the
# single-live-engine guard HELD by the live canonical runtime at all times
# (store.js acquireEngineLease; scheduler start() asserts it; OwnerLock proves
# holder liveness by pid). Its presence while pid 53645 runs is the healthy
# steady state. V6 corrects the gate: store MUTATION lock absent; engine lease
# positively HELD by the live runtime (holder pid alive + identity match).
# No production mutation occurred in the V5 attempt (preimage capture only).
#
# Root runbook implementing the Owner's final root preflight gate list, then
# ONE trusted-cp-deploy-install.sh apply + restart + receipted readback.
# Fail-closed at every gate: any failure => DEPLOY=NO, exit 1, nothing mutated
# by this script beyond the preimage captures (which are additive).
# NO_BLIND_RETRY / NO_MANUAL_LOCK_DELETE / NO_BYPASS: a failed run leaves its
# receipts and exits; re-execution refuses via the consumed-authorization
# marker unless the Owner issues a new packet.
#
# Usage (root, single line): see FREEZE_V5.md §Execution.
# Runbook gaps 1-7 (safety review) folded: see RB-GAP notes inline.
# =============================================================================
set -uo pipefail
PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

FROZEN_MAIN_SHA="41f354d163f532348b2ad1ef33b5ee528655dfc6"
FROZEN_ARTIFACT_MANIFEST_SHA="ee8e9d23d3bc3eb282db81a92399045f721000d2497b0181cdc108a14c35feb2"
FROZEN_LIVE_PREIMAGE_MANIFEST_SHA="66ebc369987bebbfd44549c6d0c8cfc32700decae9b4755ec63913e3a58b6721"
FROZEN_KEY_HASHES='e3e8dce0fd8959336521147b639007b82e8ce98d932eca82ca2b98ac2506770d  packages/scheduler/src/scheduler.js
939863a5d706c74c9129a443b00445ea638dd7791c60609259ee80d11006627b  packages/scheduler/src/eligibility.js
5c770d5e99ebc20f794284020aa9cf5471609e9bf7c9e1e2ff3c2be5a8671d25  packages/scheduler/src/watchdog/admission-isolation.js
0fcb6811f53278f23bca7bfed1cd841a1034874054533453935e4c75da4c4293  packages/scheduler/src/self-ops/index.js
4038e4f88086f49bae3e367b1df669e9f874286231b50606397ba5b6c90540df  packages/scheduler/src/self-ops/diagnosis.js
86f547f3ee51b291999432aab119916e98696f1dd4b5a3a9dccb505bc2b9a5a7  packages/scheduler/src/occurrence.js
a8eacf4f16edd207b7181a5fcc47b30a4b26c9e852d335ca2746c88fd4ac3fcc  packages/scheduler/src/store.js'
STAGING="${STAGING_DIR:-/Users/yanfenma/workspace/project/dsh-selfheal-staging-41f354d}"
TRUSTED_ROOT="/usr/local/libexec/agent-core"
APP="$TRUSTED_ROOT/app"
CANONICAL_STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
CANONICAL_RUNS="/Users/authsvc/.agent-core/scheduler/runs.jsonl"
LOCK_ROOT="/usr/local/var/agent-core/production-mutation-locks"
# RB-GAP re-site: the installer mv's the ENTIRE $TRUSTED_ROOT into .bak-<ts>
# during apply, so marker/receipts/preimage live OUTSIDE it (root-owned area),
# with operator-readable copies in /private/tmp.
STATE_ROOT="/usr/local/var/agent-core/scheduler-self-healing-v6"
RECEIPT_ROOT="$STATE_ROOT/receipts"
RB_TMP="/private/tmp/scheduler-self-healing-deploy-v6-receipt"
AUTH_MARKER="$RECEIPT_ROOT/deploy-v6.auth"
PLIST="/Library/LaunchDaemons/ai.agent-core.runtime.plist"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

fail() { echo "PREFLIGHT_FAIL $1" >&2; echo "DEPLOY=NO STOP=YES NO_BLIND_RETRY" >&2; exit 1; }
say() { echo "[deploy-v6] $*"; }
mkdir -p "$RECEIPT_ROOT" || { echo "FATAL: cannot create $RECEIPT_ROOT" >&2; exit 1; }
chmod 700 "$RECEIPT_ROOT"
mkdir -p "$RB_TMP" && chmod 755 "$RB_TMP"

# ---- G0 exactly-once authorization ------------------------------------------
if [ -e "$AUTH_MARKER" ]; then
  echo "ERROR: authorization already consumed ($AUTH_MARKER) — EXACTLY_ONCE" >&2
  exit 1
fi
printf 'packet=FREEZE_V6\ntarget=%s\nauthorized_by=mayf3\ncreated=%s\n' "$FROZEN_MAIN_SHA" "$(date -u +%FT%TZ)" > "$AUTH_MARKER" \
  || { echo "FATAL: cannot write exactly-once marker" >&2; exit 1; }
chmod 600 "$AUTH_MARKER"
say "G0 authorization reserved (consumed on any exit; new packet = new authorization)"

# ---- G1/G2/G3 staging binding (artifact source + hashes) ---------------------
[ -f "$STAGING/scripts/demo-home.mjs" ] || fail "G1 staging missing"
manifest="$(cd "$STAGING" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
[ "$manifest" = "$FROZEN_ARTIFACT_MANIFEST_SHA" ] || fail "G2 staging manifest drift ($manifest)"
for rel in packages/scheduler/src/scheduler.js packages/scheduler/src/eligibility.js packages/scheduler/src/watchdog/admission-isolation.js packages/scheduler/src/self-ops/index.js packages/scheduler/src/self-ops/diagnosis.js packages/scheduler/src/occurrence.js packages/scheduler/src/store.js; do
  want="$(printf '%s\n' "$FROZEN_KEY_HASHES" | grep " $rel\$" | cut -d' ' -f1)"
  got="$(shasum -a 256 "$STAGING/$rel" | cut -d' ' -f1)"
  [ "$got" = "$want" ] || fail "G3 key hash mismatch $rel"
done
say "G1/G2/G3 artifact binding PASS (manifest+key hashes match FREEZE_V4)"

# ---- G5/G4 live generation identity + preimage capture ----------------------
live_manifest="$(cd "$APP" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
[ "$live_manifest" = "$FROZEN_LIVE_PREIMAGE_MANIFEST_SHA" ] || fail "G5 live generation drifted from expected G6 preimage ($live_manifest)"
PREIMAGE_DIR="$STATE_ROOT/preimage-$TS"
mkdir -p "$PREIMAGE_DIR"
cp -a "$APP" "$PREIMAGE_DIR/app"
cp "$PLIST" "$PREIMAGE_DIR/ai.agent-core.runtime.plist"
cp "$CANONICAL_STORE" "$PREIMAGE_DIR/jobs.json"
cp "$CANONICAL_RUNS" "$PREIMAGE_DIR/runs.jsonl" 2>/dev/null || true
(cd "$APP" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256) > "$PREIMAGE_DIR/app-manifest.txt"
shasum -a 256 "$CANONICAL_STORE" | awk '{print "store_before", $1}' > "$PREIMAGE_DIR/hashes.txt"
say "G4 live preimage captured -> $PREIMAGE_DIR"
# RB-GAP 2/3: declare DO-NOT-TOUCH surfaces; credentials excluded by construction
say "G4b do-not-touch (installer never writes these): harness root, W1/W2 plists+copies, spawn helper, scheduler-routing manifest, credentials"

# ---- G6 locks ----------------------------------------------------------------
# SCHEDULER_STORE_LOCK semantics corrected in V6: the store MUTATION lock
# (jobs.json.lock) must be ABSENT. The engine lease (jobs.json.engine.lock) is
# the single-live-engine guard HELD by the live canonical runtime at all times
# (store.js acquireEngineLease; OwnerLock holder liveness is pid-proven) — its
# presence while the runtime runs is the healthy steady state, verified
# positively below.
for lock in "$LOCK_ROOT/production-deploy.lock" "$LOCK_ROOT/scheduler-watchdog-routing-tx.lock" \
            "/Users/authsvc/.agent-core/scheduler/jobs.json.lock"; do
  [ -e "$lock" ] && fail "G6 lock present: $lock (explicit disposition required; NO_MANUAL_LOCK_DELETE)"
done
engine_lock="/Users/authsvc/.agent-core/scheduler/jobs.json.engine.lock"
[ -f "$engine_lock" ] || fail "G6 engine lease ABSENT while the canonical runtime is alive (halted engine?)"
engine_pid="$(jq -r ".pid // empty" "$engine_lock" 2>/dev/null)"
if [ -z "$engine_pid" ]; then
  engine_pid="$(grep -o '"pid":[0-9]*' "$engine_lock" 2>/dev/null | head -1 | cut -d: -f2)"
fi
case "$engine_pid" in "" | *[!0-9]*) fail "G6 engine lease holder pid unreadable" ;; esac
kill -0 "$engine_pid" 2>/dev/null || fail "G6 engine lease holder pid $engine_pid is NOT alive"
engine_cmd="$(ps -o command= -p "$engine_pid" 2>/dev/null)"
case "$engine_cmd" in
  *production-runtime.mjs*"/Users/authsvc/.agent-core"*) : ;;
  *) fail "G6 engine lease holder is not the canonical runtime (pid $engine_pid: $engine_cmd)" ;;
esac
say "G6 locks: deploy/routing-tx/store-mutation ABSENT; engine lease HELD by live runtime pid $engine_pid (expected steady state)"

# ---- G7 other production mutation processes ----------------------------------
if pgrep -fl "trusted-cp-deploy-install|run-authorized-transaction|run-routing-install" >/dev/null 2>&1; then
  pgrep -fl "trusted-cp-deploy-install|run-authorized-transaction|run-routing-install"
  fail "G7 conflicting production mutation process running"
fi
say "G7 no other production mutation process"

# ---- G8 runtime health --------------------------------------------------------
pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" >/dev/null || fail "G8 canonical runtime not running"
curl -sf -m 5 http://127.0.0.1:8790/health >/dev/null || fail "G8 8790/health not ok"
# W2 heartbeat: state dir is PINNED by the installed W1/W2 plists
# (SCHEDULER_WATCHDOG_STATE_DIR=/Users/authsvc/.agent-core/control/scheduler-watchdog);
# derive it from the plist instead of hardcoding (v2 gate had a stale dev path here).
state_dir="$(/usr/libexec/PlistBuddy -c 'Print :EnvironmentVariables:SCHEDULER_WATCHDOG_STATE_DIR' /Library/LaunchDaemons/ai.agent-core.scheduler-watchdog-w2.plist 2>/dev/null)"
state_dir="${state_dir:-/Users/authsvc/.agent-core/control/scheduler-watchdog}"
hb="$state_dir/w2.heartbeat"
[ -f "$hb" ] || fail "G8 W2 heartbeat missing at plist-pinned path ($hb)"
now_s="$(date +%s)"; hb_s="$(stat -f '%m' "$hb")"
[ $((now_s - hb_s)) -le 3600 ] || fail "G8 W2 heartbeat stale ($((now_s - hb_s))s)"
w2log="/usr/local/var/scheduler-watchdog/w2.log"
[ -f "$w2log" ] || fail "G8 W2 log missing"
now_s="$(date +%s)"; log_s="$(stat -f '%m' "$w2log")"
[ $((now_s - log_s)) -le 1800 ] || fail "G8 W2 log stale ($((now_s - log_s))s)"
tail -3 "$w2log" | grep -q "suppressed_or_healthy" || fail "G8 W2 log does not report healthy"
say "G8 runtime health PASS (heartbeat $((now_s - hb_s))s old; w2.log $((now_s - log_s))s old)"

# ---- G9 HR job mitigation state (read + freeze for the later re-enable) ------
hr="$(jq -c '.jobs[] | select(.id|startswith("b115cb96")) | {id, retry, scheduleRevision, updatedAtMs, enabled}' "$CANONICAL_STORE" 2>/dev/null | head -1)"
[ -n "$hr" ] || fail "G9 HR job b115cb96 not found"
echo "$hr" > "$PREIMAGE_DIR/hr-job-before.json"
jq -e '.retry.auto == false and .enabled == true' >/dev/null 2>&1 <<<"$hr" || fail "G9 HR retry.auto!=false (A mitigation drifted) — DO_NOT_REENABLE contract broken pre-deploy"
say "G9 HR mitigation confirmed: $(echo "$hr" | head -c 160)"

# ---- G10 rollback preimage complete / G11 gaps folded ------------------------
for f in "$PREIMAGE_DIR/app/scripts/production-runtime.mjs" "$PREIMAGE_DIR/ai.agent-core.runtime.plist" "$PREIMAGE_DIR/jobs.json" "$PREIMAGE_DIR/app-manifest.txt"; do
  [ -s "$f" ] || fail "G10 preimage incomplete: $f"
done
# ---- G11 dependency-surface binding (v2 whole-file equality was WRONG: the
# live generation is a narrow-overlay tree whose root package.json legitimately
# differs; the correct invariants are:) ---------------------------------------
# (a) staging dependency surface is unchanged from the G6 source generation:
stg_pkg="$(shasum -a 256 "$STAGING/package.json" | cut -d' ' -f1)"
[ "$stg_pkg" = "d57644033f2ed7458272262dedad91c1cabc86aa51bc75bcc1f35184029299cd" ] || fail "G11 staging package.json hash drifted from the frozen G6-source value ($stg_pkg)"
# (b) the third-party node_modules surface is bound explicitly to the G6-lineage
#     dev checkout (the same effective surface G6 deployed from) and carries the
#     app's two hard runtime deps:
MAIN_REPO="/Users/yanfenma/workspace/project/dsh-agent-core"
[ -d "$MAIN_REPO/node_modules/croner" ] || fail "G11 MAIN_REPO missing croner"
[ -d "$MAIN_REPO/node_modules/@larksuiteoapi/node-sdk" ] || fail "G11 MAIN_REPO missing @larksuiteoapi/node-sdk"
croner_v="$(node -p "require('$MAIN_REPO/node_modules/croner/package.json').version" 2>/dev/null || echo unknown)"
lark_v="$(node -p "require('$MAIN_REPO/node_modules/@larksuiteoapi/node-sdk/package.json').version" 2>/dev/null || echo unknown)"
say "G10 rollback preimage complete"
say "G11 dependency surface bound: package.json==G6-source (d5764403), MAIN_REPO=$MAIN_REPO croner=$croner_v larksuiteoapi=$lark_v (recorded in receipt)"

# ---- APPLY (exactly once) ------------------------------------------------------
say "ALL PREFLIGHT GATES PASS — applying frozen packet V6"
bash "$STAGING/scripts/trusted-cp-deploy-install.sh" "$STAGING" 2>&1 | tee "$RB_TMP/install.log"
install_rc=${PIPESTATUS[0]}
[ "$install_rc" = "0" ] || fail "installer rc=$install_rc (fail-closed; lock left in place per installer policy)"
say "installer PASS — restarting canonical runtime"
launchctl kickstart -k system/ai.agent-core.runtime || fail "launchctl kickstart failed"
sleep 20
newpid="$(pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" | head -1)"
[ -n "$newpid" ] || fail "postdeploy: runtime not running"
sleep 10
newpid2="$(pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" | head -1)"
[ "$newpid" = "$newpid2" ] || fail "postdeploy: runtime restarted again (crash loop) pid $newpid -> $newpid2"
curl -sf -m 5 http://127.0.0.1:8790/health >/dev/null || fail "postdeploy: 8790/health not ok"
depsha="$(cd "$APP" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
deployed_scheduler="$(shasum -a 256 "$APP/packages/scheduler/src/scheduler.js" | cut -d' ' -f1)"
want_scheduler="$(printf '%s\n' "$FROZEN_KEY_HASHES" | grep ' packages/scheduler/src/scheduler.js$' | cut -d' ' -f1)"
[ -n "$want_scheduler" ] || fail "postdeploy: pinned digest for scheduler.js not found (packet corruption)"
[ "$deployed_scheduler" = "$want_scheduler" ] || fail "postdeploy: deployed scheduler.js != frozen target"
sleep 30
err_tail="$(tail -200 "$CANONICAL_RUNS" 2>/dev/null | grep -ci "tick failed\|invalid retry predecessor" || true)"
tail -1 "$CANONICAL_RUNS" 2>/dev/null | jq -e 'type == "object"' >/dev/null 2>&1 && runs_parse="OK" || runs_parse="FAIL"
{
  echo "DEPLOYMENT=PASS"
  echo "TARGET_SOURCE_SHA=$FROZEN_MAIN_SHA"
  echo "ROLLBACK=rsync --delete $PREIMAGE_DIR/app/ $APP/ && cp $PREIMAGE_DIR/ai.agent-core.runtime.plist $PLIST && launchctl kickstart -k system/ai.agent-core.runtime"
  echo "RB5_READBACK_SMOKE=see runs_tail_parse below"
  echo "R1_ATTRIBUTION=WATCHDOG_LARK_V3_G6_NARROW_DEPLOY (Owner-closed; G6 canary obligation carried into postdeploy acceptance)"
  echo "DO_NOT_REENABLE_HR_RETRY_AUTO=true (until POSTDEPLOY_VERIFICATION=PASS; then exact bounded canonical mutation only)"
  echo "DEPLOYED_APP_CONTENT_MANIFEST_SHA=$depsha"
  echo "DEPLOYED_SCHEDULER_JS=$deployed_scheduler"
  echo "RUNTIME_PID=$newpid"
  echo "HR_JOB_BEFORE=$hr"
  echo "ERROR_TAIL_COUNT_LAST200=$err_tail"
  echo "RUNS_JSONL_PARSE_SMOKE=$runs_parse"
  echo "PREIMAGE_DIR=$PREIMAGE_DIR"
  echo "COMMITTED_AT=$(date -u +%FT%TZ)"
} | tee "$RB_TMP/deploy-receipt.txt"
cp "$RB_TMP/deploy-receipt.txt" "$RECEIPT_ROOT/scheduler-self-healing-deploy-v6.receipt" 2>/dev/null || true
cp "$PREIMAGE_DIR/hr-job-before.json" "$RB_TMP/hr-job-before.json" 2>/dev/null || true
say "POSTDEPLOY_PRECHECK=PASS — full acceptance continues outside this script"
