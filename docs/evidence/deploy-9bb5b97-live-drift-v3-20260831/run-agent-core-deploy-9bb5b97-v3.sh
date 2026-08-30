#!/bin/bash
# =============================================================================
# run-agent-core-deploy-9bb5b97-v3.sh — live-drift freeze + minimal completion
#
# Target: dsh-agent-core main 9bb5b97442c7155da36f06e867d1a655410544ac
#   (= five route-chain / compose app files from merged PR #111, merge b53ebd6,
#    + workflow.js from merged PR #114, whose merge commit IS 9bb5b97)
#
# PROVENANCE OF THE CURRENT LIVE TREE (investigated 2026-08-31, evidence in
# docs/evidence/deploy-9bb5b97-live-drift-v3-20260831/):
#   2026-08-30T16:06:18Z  deploy v2 (/tmp/run-agent-core-deploy-9bb5b97-v2.sh,
#                         sha256 c64b452e…) applied the full 6-file delta to
#                         state=TARGET (132 files, manifest 6ea0b614…) — ledger
#                         + backup README in /usr/local/libexec/agent-core/
#                         .deploy-backups/agent-core-9bb5b97-20260830T160612Z.
#                         => NOTHING from 9bb5b97 is missing: workflow.js is
#                         already live at 04ca8550.
#   2026-08-30T16:23:58Z  emergency breakglass luna fleet
#                         (/tmp/agent-core-breakglass-luna-fleet-v1.sh, sha256
#                         65aee43a…) made exactly ONE app-tree write: it removed
#                         the 3-line V2-activation scope guard from
#                         packages/production-runtime/src/model-overrides.js
#                         (live blob ea44819a…, NOT present in any git commit;
#                         pre-change copy == 9bb5b97 blob f1e09d47…, backed up
#                         in .emergency-route-backups/luna-fleet-20260830T162358Z/).
#   Live manifest NOW: 132 files, sha256 9ac84954fefc3d5893b7e5ca7045b2bb7cf0
#                      ad7492d121607d2b0659a230f4b1 — mathematically equal to
#   the audited TARGET manifest 6ea0b614… with EXACTLY that one file changed
#   (re-swap of the single line reproduces 6ea0b614… bit-for-bit; reverting the
#   six deploy files reproduces the audited BASE 15793b0e…/131 files, so the
#   other 125 files have zero drift).
#
# WHAT V3 DOES:
#   --check   read-only verification: repo authority, live-tree state, service
#             preflight. Zero writes, no root required.
#   --apply   uid 0 + interactive phrase APPLY AGENT_CORE_DEPLOY_9BB5B97_V3.
#             FROZEN live (nothing missing) => zero-write NOOP.
#             PRE_V3 live (workflow.js back at pre-114 content 289a76cf…, the
#             state this deploy family was originally authored for) => deploys
#             EXACTLY ONE file: workflow.js 289a76cf… -> 04ca8550…, atomically,
#             then restarts ONLY system/ai.agent-core.runtime and health-checks.
#             Any failure after the first write rolls back to the PRE_V3
#             manifest with the same durability contract.
#
# WHAT V3 NEVER DOES:
#   - It NEVER writes packages/production-runtime/src/model-overrides.js. That
#     file carries an EMERGENCY BREAKGLASS modification (fleet-wide luna
#     cutover, 91 agents) that has NO merged-PR authority and is pending Owner
#     ratification. Restoring it to 9bb5b97 content WITHOUT a coordinated
#     revert of /Users/authsvc/.agent-core/agent-model-overrides.json would
#     make the runtime reject every non-CTO V2 override at next boot. Its
#     content is PINNED (ea44819a…) purely for drift detection: any change to
#     it — in either direction — fails this runner closed. Ratification or a
#     coordinated revert is a separate, explicitly authorized round.
#   - It never invokes sudo. Production values are fixed (no env overrides).
#
# Durability contract (unchanged from v2): every write is install-to-temp ->
# fsync(temp) -> rename -> fsync(parent dir); rollback writes get the same.
#
# Exits: 0 success / already-applied · 1 rolled-back or refused · 2 preflight
#        failure (zero writes) · 3 rollback incomplete (operator attention).
# =============================================================================
set -Eeuo pipefail

readonly REPO_ROOT="/Users/yanfenma/workspace/project/dsh-agent-core"
readonly TARGET_COMMIT="9bb5b97442c7155da36f06e867d1a655410544ac"
readonly TRUSTED_ROOT="/usr/local/libexec/agent-core"
readonly LIVE_ROOT="$TRUSTED_ROOT/app"
readonly BACKUP_ROOT="$TRUSTED_ROOT/.deploy-backups"
readonly LEDGER="$BACKUP_ROOT/agent-core-deploy-ledger.log"
readonly PLIST_PATH="/Library/LaunchDaemons/ai.agent-core.runtime.plist"
readonly SERVICE_LABEL="system/ai.agent-core.runtime"
readonly HEALTH_URL="http://127.0.0.1:8790/health"
readonly CONFIRM_PHRASE="APPLY AGENT_CORE_DEPLOY_9BB5B97_V3"
readonly GIT=/usr/bin/git
readonly SHASUM=/usr/bin/shasum
readonly PYTHON3=/usr/bin/python3

# The complete authorized delta of this runner (PRE_V3 -> FROZEN live).
# Nothing else changes — in particular NOT model-overrides.js, see header.
readonly MOD_PATH="packages/broker/src/capabilities/workflow.js"
readonly MOD_BASE_OID="289a76cf00255e95d51f921242969361b727f5de"
readonly MOD_TARGET_OID="04ca8550fbdaf9b66624dea42701a8a9af7547a8"

# The breakglass file: pinned for drift detection ONLY, never written here.
readonly BREAKGLASS_PATH="packages/production-runtime/src/model-overrides.js"
readonly BREAKGLASS_OID="ea44819a18085c6bd8665157d92caba205e720d9"

readonly FROZEN_MANIFEST_SHA256="9ac84954fefc3d5893b7e5ca7045b2bb7cf0ad7492d121607d2b0659a230f4b1"
readonly PRE_V3_MANIFEST_SHA256="926c6b9dfa07fd02d87acae381625b0fae1c7e1a3ef95594f5a5abe860bd248d"
readonly FROZEN_FILE_COUNT="132"
readonly PRE_V3_FILE_COUNT="132"

DETECTED_STATE=""

fail() { echo "ERROR: $*" >&2; exit 2; }
hash_file() { "$GIT" -C "$REPO_ROOT" hash-object "$1"; }

write_manifest() {
  local root="$1" output="$2" path
  [ -d "$root" ] || fail "app root is missing: $root"
  (
    cd "$root"
    /usr/bin/find . \
      \( -path './node_modules' -o -path './bundle-*' -o -path './profile-*' \) -prune \
      -o -type f -print \
      | /usr/bin/sed 's#^\./##' \
      | LC_ALL=C /usr/bin/sort
  ) | while IFS= read -r path; do
    printf '%s  %s\n' "$(hash_file "$root/$path")" "$path"
  done > "$output"
}

# Non-exiting core of verify_tree (usable inside the rollback cleanup trap,
# where an exit-2 would corrupt the exit-code semantics — v1-audit finding O-3).
# Sets DETECTED_STATE and returns 0 on success, 1 on any mismatch.
verify_tree_status() {
  local root="$1" manifest count digest actual
  manifest="$(/usr/bin/mktemp "${TMPDIR:-/tmp}/ac9bb-manifest.XXXXXX")" || return 1
  if ! write_manifest "$root" "$manifest"; then /bin/rm -f "$manifest"; return 1; fi
  count="$(/usr/bin/wc -l < "$manifest" | /usr/bin/tr -d ' ')"
  digest="$("$SHASUM" -a 256 "$manifest" | /usr/bin/awk '{print $1}')"
  /bin/rm -f "$manifest"

  if [ "$count" = "$FROZEN_FILE_COUNT" ] && [ "$digest" = "$FROZEN_MANIFEST_SHA256" ]; then
    DETECTED_STATE="FROZEN"
  elif [ "$count" = "$PRE_V3_FILE_COUNT" ] && [ "$digest" = "$PRE_V3_MANIFEST_SHA256" ]; then
    DETECTED_STATE="PRE_V3"
  else
    echo "ERROR: manifest is unapproved: count=$count digest=$digest (root=$root)" >&2
    return 1
  fi

  actual="$(hash_file "$root/$MOD_PATH")" || return 1
  case "$DETECTED_STATE:$actual" in
    "FROZEN:$MOD_TARGET_OID"|"PRE_V3:$MOD_BASE_OID") ;;
    *) echo "ERROR: unapproved content on the delta path: $MOD_PATH ($actual)" >&2; return 1 ;;
  esac

  actual="$(hash_file "$root/$BREAKGLASS_PATH")" || return 1
  if [ "$actual" != "$BREAKGLASS_OID" ]; then
    echo "ERROR: breakglass file drifted (expected $BREAKGLASS_OID got $actual): $BREAKGLASS_PATH — ratification/revert is a separate authorized round" >&2
    return 1
  fi
  return 0
}

verify_tree() {
  local root="$1" required_state="${2:-EITHER}"
  verify_tree_status "$root" || fail "tree verification failed (root=$root)"
  if [ "$required_state" != "EITHER" ] && [ "$DETECTED_STATE" != "$required_state" ]; then
    fail "tree state is $DETECTED_STATE, expected $required_state (root=$root)"
  fi
}

verify_source_authority() {
  local actual
  [ -d "$REPO_ROOT/.git" ] || fail "REPO_ROOT is not a git checkout: $REPO_ROOT"
  "$GIT" -C "$REPO_ROOT" fetch github main >/dev/null 2>&1 \
    || fail "fresh fetch from github failed (network); refusing to deploy unverified target"
  actual="$("$GIT" -C "$REPO_ROOT" rev-parse github/main)"
  # The pinned target must remain a merged, reachable commit. github/main may
  # legitimately advance past it (it has: 9386ac4, 2 app-surface files, NOT
  # deployed by this runner); that is recorded below, not treated as drift of
  # this deploy's authority, whose every byte is pinned by OID anyway.
  "$GIT" -C "$REPO_ROOT" merge-base --is-ancestor "$TARGET_COMMIT" "$actual" \
    || fail "target commit is no longer reachable from github/main: $TARGET_COMMIT (main=$actual)"
  actual="$("$GIT" -C "$REPO_ROOT" rev-parse "$TARGET_COMMIT^{commit}")"
  [ "$actual" = "$TARGET_COMMIT" ] || fail "target commit missing locally: $TARGET_COMMIT"
  actual="$("$GIT" -C "$REPO_ROOT" rev-parse "$TARGET_COMMIT:$MOD_PATH")"
  [ "$actual" = "$MOD_TARGET_OID" ] \
    || fail "repo target blob mismatch: $MOD_PATH ($actual)"
  actual="$("$GIT" -C "$REPO_ROOT" rev-parse "github/main")"
  if [ "$actual" != "$TARGET_COMMIT" ]; then
    echo "NOTICE: github/main advanced past the pinned target (main=$actual, pin=$TARGET_COMMIT); the next monotonic deploy round must re-audit the new head"
  fi
}

service_preflight() {
  [ -x "$PYTHON3" ] || fail "required fsync helper is unavailable: $PYTHON3"
  [ ! -L "$LIVE_ROOT" ] || fail "production app root must not be a symlink"
  [ -f "$PLIST_PATH" ] || fail "launchd plist is missing: $PLIST_PATH"
  /bin/launchctl print "$SERVICE_LABEL" >/dev/null 2>&1 \
    || fail "launchd service is unavailable: $SERVICE_LABEL"
  /usr/bin/curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1 \
    || fail "runtime is not healthy before deploy: $HEALTH_URL"
  local p owner mode
  p="$LIVE_ROOT/$MOD_PATH"
  [ -f "$p" ] && [ ! -L "$p" ] || fail "delta target is not a regular file: $MOD_PATH"
  owner="$(/usr/bin/stat -f '%u:%g' "$p")"
  mode="$(/usr/bin/stat -f '%Lp' "$p")"
  [ "$owner" = "0:0" ] && [ "$mode" = "644" ] \
    || fail "unexpected delta target owner/mode: $MOD_PATH ($owner $mode)"
}

wait_for_health() {
  local attempt=0
  while [ "$attempt" -lt 45 ]; do
    if /usr/bin/curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    /bin/sleep 2
    attempt=$((attempt + 1))
  done
  return 1
}

fsync_file() {
  "$PYTHON3" - "$1" <<'PY'
import os
import sys

path = sys.argv[1]
flags = os.O_RDONLY
if hasattr(os, "O_NOFOLLOW"):
    flags |= os.O_NOFOLLOW
fd = os.open(path, flags)
try:
    os.fsync(fd)
finally:
    os.close(fd)
PY
}

fsync_directory() {
  "$PYTHON3" - "$1" <<'PY'
import os
import sys

path = sys.argv[1]
flags = os.O_RDONLY
if hasattr(os, "O_DIRECTORY"):
    flags |= os.O_DIRECTORY
fd = os.open(path, flags)
try:
    os.fsync(fd)
finally:
    os.close(fd)
PY
}

atomic_install() {
  # atomic_install <src> <dst> <mode> <uid> <gid>
  # Durability contract: write temp -> fsync(temp) -> rename -> fsync(parent).
  local source="$1" target="$2" mode="$3" uid="$4" gid="$5" dir base tmp
  dir="$(dirname "$target")"
  base="$(basename "$target")"
  tmp="$dir/.${base}.deploy9bbv3.$$"
  if ! /usr/bin/install -m "$mode" -o "$uid" -g "$gid" "$source" "$tmp"; then
    /bin/rm -f "$tmp" >/dev/null 2>&1 || true
    return 1
  fi
  if ! fsync_file "$tmp"; then
    /bin/rm -f "$tmp" >/dev/null 2>&1 || true
    return 1
  fi
  if ! /bin/mv -f "$tmp" "$target"; then
    /bin/rm -f "$tmp" >/dev/null 2>&1 || true
    return 1
  fi
  fsync_directory "$dir"
}

run_check() {
  verify_source_authority
  verify_tree "$LIVE_ROOT" EITHER
  service_preflight
  echo "TASK_NAME=接入 调查 (live-drift freeze + completion runner)"
  echo "TARGET_COMMIT=$TARGET_COMMIT"
  echo "LIVE_STATE=$DETECTED_STATE"
  echo "LIVE_FILES=$FROZEN_FILE_COUNT"
  echo "MISSING_FROM_TARGET=NONE (deploy v2 already applied all 6 files at 2026-08-30T16:06:18Z; ledger on record)"
  echo "DRIFT_VS_9BB5B97=1 file: $BREAKGLASS_PATH (emergency breakglass, pending Owner ratification; pinned, never written by this runner)"
  echo "DEPLOY_DELTA_OF_V3=0-or-1 file (workflow.js only, iff live is PRE_V3)"
  echo "SERVICE=$SERVICE_LABEL"
  echo "HEALTH_URL=$HEALTH_URL"
  echo "CHECK=PASS"
}

require_root() {
  [ "$(/usr/bin/id -u)" = "0" ] || fail "--apply requires uid 0; this script never invokes sudo"
}

run_apply() {
  require_root
  verify_source_authority
  verify_tree "$LIVE_ROOT" EITHER
  service_preflight
  if [ "$DETECTED_STATE" = "FROZEN" ]; then
    echo "APPLY=NOOP_NOTHING_MISSING (zero writes; live already carries the full 9bb5b97 app surface; breakglass file pinned and untouched)"
    exit 0
  fi

  echo "This will replace exactly 1 file ($MOD_PATH) in $LIVE_ROOT and restart $SERVICE_LABEL."
  printf 'Type the phrase "%s" to proceed: ' "$CONFIRM_PHRASE"
  local answer=""
  read -r answer
  [ "$answer" = "$CONFIRM_PHRASE" ] || fail "confirmation phrase mismatch; refusing (zero writes)"

  local lock ts backup stage p tmp mode uid gid
  lock="$TRUSTED_ROOT/.deploy-9bb5b97-v3.lock"
  ts="$(/bin/date -u +%Y%m%dT%H%M%SZ)"
  backup="$BACKUP_ROOT/agent-core-9bb5b97-v3-$ts"
  stage=""
  APPLY_WRITES=0
  ROLLBACK_RUNNING=0
  LOCK_CREATED=0
  STAGE_CREATED=0

  /bin/mkdir "$lock" || fail "deploy lock already exists: $lock"
  LOCK_CREATED=1

  cleanup_apply() {
    local rc="$1" rollback_ok=1 base_verified=0
    trap - EXIT
    trap '' INT TERM
    if [ "$rc" -ne 0 ] && [ "$APPLY_WRITES" = "1" ] && [ "$ROLLBACK_RUNNING" = "0" ]; then
      ROLLBACK_RUNNING=1
      echo "ERROR: apply failed (rc=$rc); rolling back to the PRE_V3 audited state" >&2
      if [ ! -d "$backup" ]; then
        echo "ERROR: rollback backup missing: $backup" >&2
        rollback_ok=0
      else
        p="$LIVE_ROOT/$MOD_PATH"
        mode="$(/usr/bin/stat -f '%Lp' "$p" 2>/dev/null || echo 644)"
        uid="$(/usr/bin/stat -f '%u' "$p" 2>/dev/null || echo 0)"
        gid="$(/usr/bin/stat -f '%g' "$p" 2>/dev/null || echo 0)"
        if ! atomic_install "$backup/$MOD_PATH" "$p" "$mode" "$uid" "$gid"; then
          echo "ERROR: rollback copy failed: $MOD_PATH" >&2
          rollback_ok=0
        fi
        if verify_tree_status "$LIVE_ROOT" && [ "$DETECTED_STATE" = "PRE_V3" ]; then
          base_verified=1
        else
          echo "ERROR: rollback manifest verification failed" >&2
          rollback_ok=0
        fi
        if [ "$base_verified" = "1" ]; then
          if ! /bin/launchctl kickstart -k "$SERVICE_LABEL"; then
            echo "ERROR: rollback restart failed: $SERVICE_LABEL" >&2
            rollback_ok=0
          elif ! wait_for_health; then
            echo "ERROR: rollback health check failed: $HEALTH_URL" >&2
            rollback_ok=0
          fi
        fi
      fi
      if [ "$rollback_ok" = "1" ]; then
        echo "ROLLBACK=OK (PRE_V3 manifest restored, service healthy)"
      else
        echo "ERROR: ROLLBACK_INCOMPLETE — lock and backup retained for operator recovery: $backup" >&2
        exit 3
      fi
    fi
    if [ "$STAGE_CREATED" = "1" ] && [ -d "$stage" ]; then
      /bin/rm -rf "$stage" || rollback_ok=0
    fi
    if [ "$LOCK_CREATED" = "1" ] && [ -d "$lock" ]; then
      /bin/rmdir "$lock" || rollback_ok=0
    fi
    [ "$rollback_ok" = "1" ] || exit 3
    exit "$rc"
  }
  trap 'cleanup_apply "$?"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  # ---- backup the PRE_V3 copy of the delta path (+ provenance) ---------------
  echo "== backing up PRE_V3 copy of the delta path -> $backup"
  /bin/mkdir -p "$backup/$(dirname "$MOD_PATH")"
  /bin/cp -p "$LIVE_ROOT/$MOD_PATH" "$backup/$MOD_PATH"
  actual="$(hash_file "$backup/$MOD_PATH")"
  [ "$actual" = "$MOD_BASE_OID" ] || fail "backup blob mismatch: $MOD_PATH ($actual)"
  cat > "$backup/README.txt" <<EOF
agent-core live-drift freeze + completion backup (pre-apply PRE_V3 copy)
created_utc   : $ts
target_commit : $TARGET_COMMIT
pre_v3_manifest : $PRE_V3_MANIFEST_SHA256 ($PRE_V3_FILE_COUNT files)
frozen_manifest : $FROZEN_MANIFEST_SHA256 ($FROZEN_FILE_COUNT files)
delta         : $MOD_PATH $MOD_BASE_OID -> $MOD_TARGET_OID (PR #114)
breakglass    : $BREAKGLASS_PATH pinned at $BREAKGLASS_OID (never written by v3)
runner        : /tmp/run-agent-core-deploy-9bb5b97-v3.sh
EOF

  # ---- stage the target blob and verify it -----------------------------------
  echo "== staging the target blob from $TARGET_COMMIT"
  stage="$(/usr/bin/mktemp -d "$TRUSTED_ROOT/.deploy-9bb5b97-v3-stage.XXXXXX")"
  STAGE_CREATED=1
  "$GIT" -C "$REPO_ROOT" show "$TARGET_COMMIT:$MOD_PATH" > "$stage/mod-0"
  actual="$(hash_file "$stage/mod-0")"
  [ "$actual" = "$MOD_TARGET_OID" ] || fail "staged blob mismatch: $MOD_PATH ($actual)"

  # ---- apply: exactly one atomic file write ----------------------------------
  echo "== applying exactly 1 file: $MOD_PATH"
  APPLY_WRITES=1
  p="$LIVE_ROOT/$MOD_PATH"
  mode="$(/usr/bin/stat -f '%Lp' "$p")"
  uid="$(/usr/bin/stat -f '%u' "$p")"
  gid="$(/usr/bin/stat -f '%g' "$p")"
  atomic_install "$stage/mod-0" "$p" "$mode" "$uid" "$gid"
  verify_tree "$LIVE_ROOT" FROZEN

  # ---- restart ONLY the pinned service, then health-check --------------------
  echo "== restart + health-check $SERVICE_LABEL"
  /bin/launchctl kickstart -k "$SERVICE_LABEL"
  wait_for_health || { echo "ERROR: health check failed after restart" >&2; exit 1; }
  /bin/launchctl print "$SERVICE_LABEL" >/dev/null 2>&1 \
    || { echo "ERROR: launchd status check failed after restart" >&2; exit 1; }
  verify_tree "$LIVE_ROOT" FROZEN

  # ---- append-only ledger BEFORE declaring success ---------------------------
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) applied target=$TARGET_COMMIT backup=$backup health=$HEALTH_URL state=FROZEN delta=workflow.js-only-v3" >> "$LEDGER" \
    || { echo "ERROR: ledger append failed" >&2; exit 1; }

  /bin/rm -rf "$stage"; STAGE_CREATED=0
  /bin/rmdir "$lock"; LOCK_CREATED=0
  APPLY_WRITES=0
  trap - EXIT INT TERM

  echo "SUCCESS_COMMITTED target=$TARGET_COMMIT (workflow.js completed; breakglass file untouched)"
  echo "BACKUP_PATH=$backup"
  echo "LEDGER=$LEDGER"
  echo "APPLY=PASS"
}

usage() {
  cat <<'EOF'
Usage: bash run-agent-core-deploy-9bb5b97-v3.sh MODE

Modes:
  --check   Read-only verification (repo authority, live tree, service health).
  --apply   Deploy (uid 0 only; interactive phrase required). If the live tree
            is the frozen state (nothing missing from 9bb5b97) this is a
            zero-write NOOP. If workflow.js is back at pre-114 content, backs
            up that copy, atomically replaces EXACTLY that one file, restarts
            ONLY system/ai.agent-core.runtime, health-checks, and
            auto-rolls-back to the PRE_V3 manifest on any failure.
            The breakglass file model-overrides.js is pinned and NEVER written.

The script never invokes sudo. Production values are fixed (no env overrides).
EOF
}

[ "$#" = "1" ] || { usage >&2; exit 2; }
case "$1" in
  --check) run_check ;;
  --apply) run_apply ;;
  -h|--help) usage ;;
  *) usage >&2; exit 2 ;;
esac
