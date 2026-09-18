#!/bin/bash
# =============================================================================
# scheduler-self-healing-deploy-v2.sh — SCHEDULER_SELF_HEALING_FROM_FEISHU_V1
# Phase C authorized deployment (EXACTLY_ONCE, Owner authorization 2026-09-18,
# target 41f354d163f532348b2ad1ef33b5ee528655dfc6).
#
# Root runbook implementing the Owner's final root preflight gate list, then
# ONE trusted-cp-deploy-install.sh apply + restart + receipted readback.
# Fail-closed at every gate: any failure => DEPLOY=NO, exit 1, nothing mutated
# by this script beyond the preimage captures (which are additive).
# NO_BLIND_RETRY / NO_MANUAL_LOCK_DELETE / NO_BYPASS: a failed run leaves its
# receipts and exits; re-execution refuses via the consumed-authorization
# marker unless the Owner issues a new packet.
#
# Usage (root, single line): see FREEZE_V2.md §Execution.
# Runbook gaps 1-7 (safety review) folded: see RB-GAP notes inline.
# =============================================================================
set -uo pipefail

FROZEN_MAIN_SHA="41f354d163f532348b2ad1ef33b5ee528655dfc6"
FROZEN_ARTIFACT_MANIFEST_SHA="ee8e9d23d3bc3eb282db81a92399045f721000d2497b0181cdc108a14c35feb2"
FROZEN_LIVE_PREIMAGE_MANIFEST_SHA="66ebc369987bebbfd44549c6d0c8cfc32700decae9b4755ec63913e3a58b6721"
FROZEN_KEY_HASHES='e3e8dce0fd895933  packages/scheduler/src/scheduler.js
939863a5d706c74c  packages/scheduler/src/eligibility.js
5c770d5e99ebc20f  packages/scheduler/src/watchdog/admission-isolation.js
0fcb6811f53278f2  packages/scheduler/src/self-ops/index.js
4038e4f88086f49b  packages/scheduler/src/self-ops/diagnosis.js
86f547f3ee51b291  packages/scheduler/src/occurrence.js
a8eacf4f16edd207  packages/scheduler/src/store.js'
STAGING="${STAGING_DIR:-/Users/yanfenma/workspace/project/dsh-selfheal-staging-41f354d}"
TRUSTED_ROOT="/usr/local/libexec/agent-core"
APP="$TRUSTED_ROOT/app"
CANONICAL_STORE="/Users/authsvc/.agent-core/scheduler/jobs.json"
CANONICAL_RUNS="/Users/authsvc/.agent-core/scheduler/runs.jsonl"
LOCK_ROOT="/usr/local/var/agent-core/production-mutation-locks"
RECEIPT_ROOT="$TRUSTED_ROOT/.deploy-receipts"
RB_TMP="/private/tmp/scheduler-self-healing-deploy-v2-receipt"
AUTH_MARKER="$RECEIPT_ROOT/scheduler-self-healing-deploy-v2.auth"
PLIST="/Library/LaunchDaemons/ai.agent-core.runtime.plist"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

fail() { echo "PREFLIGHT_FAIL $1" >&2; echo "DEPLOY=NO STOP=YES NO_BLIND_RETRY" >&2; exit 1; }
say() { echo "[deploy-v2] $*"; }
mkdir -p "$RB_TMP" && chmod 755 "$RB_TMP"

# ---- G0 exactly-once authorization ------------------------------------------
if [ -e "$AUTH_MARKER" ]; then
  echo "ERROR: authorization already consumed ($AUTH_MARKER) — EXACTLY_ONCE" >&2
  exit 1
fi
printf 'packet=FREEZE_V2\ntarget=%s\nauthorized_by=mayf3\ncreated=%s\n' "$FROZEN_MAIN_SHA" "$(date -u +%FT%TZ)" > "$AUTH_MARKER"
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
say "G1/G2/G3 artifact binding PASS (manifest+key hashes match FREEZE_V2)"

# ---- G5/G4 live generation identity + preimage capture ----------------------
live_manifest="$(cd "$APP" && find . -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1)"
[ "$live_manifest" = "$FROZEN_LIVE_PREIMAGE_MANIFEST_SHA" ] || fail "G5 live generation drifted from expected G6 preimage ($live_manifest)"
PREIMAGE_DIR="$TRUSTED_ROOT/.preimage-scheduler-self-healing-v2-$TS"
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
for lock in "$LOCK_ROOT/production-deploy.lock" "$LOCK_ROOT/scheduler-watchdog-routing-tx.lock" \
            "/Users/authsvc/.agent-core/scheduler/jobs.json.lock" \
            "/Users/authsvc/.agent-core/scheduler/jobs.json.engine.lock"; do
  [ -e "$lock" ] && fail "G6 lock present: $lock (explicit disposition required; NO_MANUAL_LOCK_DELETE)"
done
say "G6 production/deployment/store locks ABSENT"

# ---- G7 other production mutation processes ----------------------------------
if pgrep -fl "trusted-cp-deploy-install|run-authorized-transaction|run-routing-install" >/dev/null 2>&1; then
  pgrep -fl "trusted-cp-deploy-install|run-authorized-transaction|run-routing-install"
  fail "G7 conflicting production mutation process running"
fi
say "G7 no other production mutation process"

# ---- G8 runtime health --------------------------------------------------------
pgrep -f "app/scripts/production-runtime.mjs --root /Users/authsvc/.agent-core" >/dev/null || fail "G8 canonical runtime not running"
curl -sf -m 5 http://127.0.0.1:8790/health >/dev/null || fail "G8 8790/health not ok"
hb="/usr/local/var/scheduler-watchdog/w2.heartbeat"
[ -f "$hb" ] || fail "G8 W2 heartbeat missing"
now_s="$(date +%s)"; hb_s="$(stat -f '%m' "$hb")"
[ $((now_s - hb_s)) -le 900 ] || fail "G8 W2 heartbeat stale ($((now_s - hb_s))s)"
say "G8 runtime health PASS"

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
# RB-GAP 1: dependency manifest must be identical (offline reuse safe, no pnpm)
if ! diff -q "$STAGING/package.json" "$APP/package.json" >/dev/null 2>&1; then
  fail "G11 root package.json differs between staging and live app (node_modules reuse unsafe)"
fi
say "G10/G11 rollback preimage complete; dependency manifests identical (offline reuse safe)"

# ---- APPLY (exactly once) ------------------------------------------------------
say "ALL PREFLIGHT GATES PASS — applying frozen packet v2"
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
[ "$deployed_scheduler" = "$(printf '%s\n' "$FROZEN_KEY_HASHES" | grep ' scheduler.js$' | cut -d' ' -f1)" ] || fail "postdeploy: deployed scheduler.js != frozen target"
sleep 30
err_tail="$(tail -200 "$CANONICAL_RUNS" 2>/dev/null | grep -ci "tick failed\|invalid retry predecessor" || true)"
{
  echo "DEPLOYMENT=PASS"
  echo "TARGET_SOURCE_SHA=$FROZEN_MAIN_SHA"
  echo "DEPLOYED_APP_CONTENT_MANIFEST_SHA=$depsha"
  echo "DEPLOYED_SCHEDULER_JS=$deployed_scheduler"
  echo "RUNTIME_PID=$newpid"
  echo "HR_JOB_BEFORE=$hr"
  echo "ERROR_TAIL_COUNT_LAST200=$err_tail"
  echo "PREIMAGE_DIR=$PREIMAGE_DIR"
  echo "COMMITTED_AT=$(date -u +%FT%TZ)"
} | tee "$RB_TMP/deploy-receipt.txt"
cp "$RB_TMP/deploy-receipt.txt" "$RECEIPT_ROOT/scheduler-self-healing-deploy-v2.receipt" 2>/dev/null || true
cp "$PREIMAGE_DIR/hr-job-before.json" "$RB_TMP/hr-job-before.json" 2>/dev/null || true
say "POSTDEPLOY_PRECHECK=PASS — full acceptance continues outside this script"
