#!/bin/bash
# =============================================================================
# trusted-cp-deploy-install.sh — TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1
#
# One-time (re-runnable) root install of the TRUSTED control-plane closure.
#
# Goal: every piece of code/config the trusted Control Plane (uid 505,
# authsvc) executes BEFORE dropping to the Agent uid (502) must live under a
# protected root that uid 502 cannot modify, replace, or redirect.
#
#   TRUSTED_INSTALL_PATH=/usr/local/libexec/agent-core
#     harness/   self-contained DSH CLI closure (source copy + `pnpm install`
#                with package-import-method=copy so NO hardlink points into a
#                502-owned store)           owner authsvc:authsvc  0755/0644
#     app/       Agent Core closure (packages/bundles/profiles/scripts) with
#                node_modules/@deepseek-ai -> ../../harness/node_modules/@deepseek-ai
#                                           owner authsvc:authsvc  0755/0644
#     home/      the 505 control-plane DSH_HOME (profile + farm -> app/)
#                                           owner authsvc:authsvc
#     config/    production state: Agent Definition (agents.json)/bindings/jobs/
#                credential store   owner authsvc:authsvc  0700/0600
#     .cache/    pnpm cache (root-owned)
#
# Also seeds /Users/authsvc/.dsh/{settings.yaml,.credentials.yaml} (authsvc
# 0600) — the trusted model-route settings source the children copy from.
#
# The dev repo / harness stay uid 502-writable for development; this install
# only ships the minimal execution closure (NOT the monorepos). The Agent
# child (502) may keep reading the trusted closure (world-readable) but can
# never modify it; its own workspace/runtime stays 502-writable as before.
#
# Usage (run as root):
#   sudo ./scripts/trusted-cp-deploy-install.sh REPO_SRC [HARNESS_SRC] [MAIN_REPO]
#   (env REQUIRED: EXPECTED_SOURCE_SHA, EXPECTED_SOURCE_TREE; env OPTIONAL:
#    GENERATION_LABEL_SHA; --selftest-provenance [SCRATCH_REPO] = no-root selftest)
#   REPO_SRC    REQUIRED, explicit-only (TRUSTED_CP_PACK_INPUT_PROVENANCE_V1):
#               defaulting it to the installer location silently repacked the
#               OLD live app under a new generation label (2026-09-18 incident)
#   HARNESS_SRC default: /Users/yanfenma/workspace/github/deepseek-harness
#
# Verifies at the end: every symlink in the trusted tree resolves INSIDE the
# trusted root (or /usr/local/libexec), and a uid-502 spot check cannot write
# to app/, harness/, home/, config/ or the helper.
# =============================================================================
set -euo pipefail

# GLOBAL production-deploy mutex (WATCHDOG transaction P1/B7 convergence): every
# entrypoint that replaces the trusted app / routing / restarts the canonical
# runtime shares THIS exact lock. Atomic mkdir acquire; a held lock fails
# closed with its holder metadata; a killed run leaves the lock behind and it
# is disposed of EXPLICITLY (never guessed, never auto-deleted).
PRODUCTION_DEPLOY_LOCK_DIR="${PRODUCTION_DEPLOY_LOCK_DIR:-/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock}"
# B7 inherited-lock seam: a parent transaction (run-authorized-transaction.sh)
# holds the mutex across DEPLOY/ROUTING/RELOAD; the child verifies the actual
# holder belongs to that parent and then neither reacquires nor releases it.
# There is deliberately NO bypass flag: without a verified inherited holder
# the installer always acquires the mutex itself (standalone path).
INHERITED_LOCK_HOLDER_PATTERN="${PRODUCTION_DEPLOY_LOCK_INHERITED_FROM:-}"
GLOBAL_LOCK_ACQUIRED_BY_ME=0
PRESERVED_SOURCE_GIT_STAMP=""

composed_exit_cleanup() {
  # B6: ONE composed EXIT cleanup - the preserved source stamp AND the
  # installer-owned global mutex. Never touches a lock this process did not
  # acquire (parent-owned/inherited locks are left for the parent).
  if [ -n "$PRESERVED_SOURCE_GIT_STAMP" ] && [ -f "$PRESERVED_SOURCE_GIT_STAMP" ]; then
    /bin/rm -f "$PRESERVED_SOURCE_GIT_STAMP"
  fi
  if [ "$GLOBAL_LOCK_ACQUIRED_BY_ME" = "1" ] && [ -d "$PRODUCTION_DEPLOY_LOCK_DIR" ] \
     && grep -qx "pid=$$" "$PRODUCTION_DEPLOY_LOCK_DIR/holder" 2>/dev/null; then
    rm -f "$PRODUCTION_DEPLOY_LOCK_DIR/holder"
    rmdir "$PRODUCTION_DEPLOY_LOCK_DIR" 2>/dev/null || true
  fi
}
trap composed_exit_cleanup EXIT

acquire_global_deploy_mutex() {
  mkdir -p "$(dirname "$PRODUCTION_DEPLOY_LOCK_DIR")"
  if ! mkdir "$PRODUCTION_DEPLOY_LOCK_DIR" 2>/dev/null; then
    echo "ERROR: global production-deploy mutex already held - $PRODUCTION_DEPLOY_LOCK_DIR" >&2
    cat "$PRODUCTION_DEPLOY_LOCK_DIR/holder" 2>/dev/null || true
    echo "DISPOSITION (explicit, fail-closed - never bare rmdir): use the transaction bundle's dispose_stale_lock procedure" >&2
    exit 1
  fi
  printf 'pid=%s\nuid=%s\ncmd=%s\nstarted=%s\n' "$$" "$(id -u)" \
    "trusted-cp-deploy-install.sh $*" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    > "$PRODUCTION_DEPLOY_LOCK_DIR/holder"
  GLOBAL_LOCK_ACQUIRED_BY_ME=1
}

# =============================================================================
# TRUSTED_CP_PACK_INPUT_PROVENANCE_V1 — pack-source provenance guard
# =============================================================================
# Fixes the 2026-09-18 incident class: an installer invocation from the
# INSTALLED live app defaulted REPO_SRC to that live app, so a fresh
# generation label was packed from stale live bytes (cfc2729-labeled
# generation shipped ~4dc598be-era broker bytes; the 19:33 rebuild
# reproduced the identical stale fingerprint).
#
# Guards implemented here (all BEFORE any production mutation):
#   P1 REPO_SRC explicit-only (no default derived from installer location)
#   P2 EXPECTED_SOURCE_SHA / EXPECTED_SOURCE_TREE required from the caller
#   P3 REPO_SRC must be a git checkout whose HEAD/tree equal the expectations
#      and whose tree is clean
#   P4 REPO_SRC must NOT live inside the trusted live root or its
#      backup/failed/rollback generations (those are pack OUTPUTS, never
#      pack INPUTS)
#   P5 TOCTOU: pre-pack and post-pack source stamps must match
#   P6 pack-provenance receipt persisted into the new app closure
# Selftest (no root, scratch fixtures only):
#   TRUSTED_CP_SELFTEST_PROVENANCE=1 [SCRATCH_REPO] ./trusted-cp-deploy-install.sh

gate_fail() { echo "PROVENANCE_FAIL $1" >&2; exit 1; }
ok_msg() { echo "PROVENANCE_OK $1"; }

pack_source_stamp() {
  # $1 = repo src; prints "head=<sha> tree=<sha> clean=<yes|no>"
  local repo="$1"
  local head tree dirty
  head="$(git -C "$repo" rev-parse HEAD 2>/dev/null)" || return 1
  tree="$(git -C "$repo" rev-parse 'HEAD^{tree}' 2>/dev/null)" || return 1
  dirty="$(git -C "$repo" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
  echo "head=$head tree=$tree clean=$([ "$dirty" = "0" ] && echo yes || echo no)"
}

reject_trusted_live_source() {
  # $1 = repo src realpath, $2 = trusted root; pack input must never be the
  # live closure or any of its backup/failed/rollback generations.
  local rp="$1" tr="$2"
  case "$rp" in
    "$tr"|"$tr"/*|"$tr".*|"$tr"-*)
      echo "  rejected: pack source resolves inside the trusted live root family: $rp" >&2
      return 1 ;;
  esac
  return 0
}

validate_pack_source() {
  # $1 = REPO_SRC, $2 = TRUSTED_ROOT; env: EXPECTED_SOURCE_SHA,
  # EXPECTED_SOURCE_TREE, GENERATION_LABEL_SHA (optional).
  # Sets REPO_SRC_REALPATH, PRE_PACK_HEAD, PRE_PACK_TREE, PRE_PACK_CLEAN.
  local repo="$1" tr="$2" rp stamps head tree clean
  [ -n "$repo" ] || gate_fail "P1 IMPLICIT_PACK_SOURCE_FORBIDDEN: REPO_SRC argument is required (no installer-location default)"
  [ -d "$repo" ] || gate_fail "P3 REPO_SRC_NOT_FOUND: $repo"
  rp="$(cd "$repo" && pwd -P)"
  reject_trusted_live_source "$rp" "$tr" || gate_fail "P4 LIVE_TRUSTED_APP_REJECTED_AS_SOURCE"
  [ -d "$rp/.git" ] || git -C "$rp" rev-parse --git-dir >/dev/null 2>&1 || gate_fail "P3 REPO_SRC_NOT_A_GIT_CHECKOUT: $rp"
  stamps="$(pack_source_stamp "$rp")" || gate_fail "P3 REPO_SRC_GIT_PROBE_FAILED: $rp"
  head="$(echo "$stamps" | awk '{print $1}' | sed 's/^head=//')"
  tree="$(echo "$stamps" | awk '{print $2}' | sed 's/^tree=//')"
  clean="$(echo "$stamps" | awk '{print $3}' | sed 's/^clean=//')"
  [ -n "${EXPECTED_SOURCE_SHA:-}" ] || gate_fail "P2 EXPECTED_SOURCE_SHA_REQUIRED (caller must pin the source HEAD)"
  [ -n "${EXPECTED_SOURCE_TREE:-}" ] || gate_fail "P2 EXPECTED_SOURCE_TREE_REQUIRED (caller must pin the source tree)"
  [ "$head" = "$EXPECTED_SOURCE_SHA" ] || gate_fail "P3 SOURCE_HEAD_MISMATCH: pack input HEAD $head != EXPECTED_SOURCE_SHA $EXPECTED_SOURCE_SHA"
  [ "$tree" = "$EXPECTED_SOURCE_TREE" ] || gate_fail "P3 SOURCE_TREE_MISMATCH: pack input tree $tree != EXPECTED_SOURCE_TREE $EXPECTED_SOURCE_TREE"
  [ "$clean" = "yes" ] || gate_fail "P3 SOURCE_DIRTY: pack input worktree must be clean"
  if [ -n "${GENERATION_LABEL_SHA:-}" ] && [ "$GENERATION_LABEL_SHA" != "$head" ]; then
    gate_fail "P6 SOURCE_LABEL_MISMATCH: label $GENERATION_LABEL_SHA != validated HEAD $head"
  fi
  REPO_SRC_REALPATH="$rp"
  PRE_PACK_HEAD="$head"; PRE_PACK_TREE="$tree"; PRE_PACK_CLEAN="$clean"
}

packed_app_provenance() {
  # $1 = packed app dir; prints the packed-tree aggregate sha and the
  # load-bearing broker fingerprints into the provenance receipt file ($2).
  local appdir="$1" receipt="$2"
  local aggregate wfsha pkgsha
  aggregate="$(find "$appdir" -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | awk '{print $1}')"
  wfsha=""; pkgsha=""
  [ -f "$appdir/packages/broker/src/capabilities/workflow.js" ]     && wfsha="$(shasum -a 256 "$appdir/packages/broker/src/capabilities/workflow.js" | awk '{print $1}')"
  [ -f "$appdir/packages/broker/package.json" ]     && pkgsha="$(shasum -a 256 "$appdir/packages/broker/package.json" | awk '{print $1}')"
  cat > "$receipt" << JSON
{
  "provenance": "TRUSTED_CP_PACK_INPUT_PROVENANCE_V1",
  "repo_src_realpath": "$REPO_SRC_REALPATH",
  "source_head_sha": "$PRE_PACK_HEAD",
  "source_tree_sha": "$PRE_PACK_TREE",
  "source_clean": "$PRE_PACK_CLEAN",
  "generation_label_sha": "${GENERATION_LABEL_SHA:-}",
  "source_label_matches_pack_input": "$([ -z "${GENERATION_LABEL_SHA:-}" ] || [ "${GENERATION_LABEL_SHA:-}" = "$PRE_PACK_HEAD" ] && echo YES || echo NO)",
  "main_repo_realpath": "${MAIN_REPO_REALPATH:-}",
  "main_repo_head_sha": "${MAIN_REPO_HEAD:-}",
  "packed_app_tree_sha256": "$aggregate",
  "broker_workflow_js_sha256": "$wfsha",
  "broker_package_json_sha256": "$pkgsha"
}
JSON
  echo "$aggregate"
}

# Read-only operator mode: validate a pack source against expected coordinates
# without any mutation (also the acceptance vehicle for the real candidate).
#   ./trusted-cp-deploy-install.sh --validate-source REPO_SRC
if [ "${1:-}" = "--validate-source" ]; then
  gate_fail() { echo "PROVENANCE_FAIL $1" >&2; exit 1; }
  REPO_SRC_CANDIDATE="${2:-}"
  TRUSTED_ROOT=/usr/local/libexec/agent-core
  validate_pack_source "$REPO_SRC_CANDIDATE" "$TRUSTED_ROOT"
  echo "PROVENANCE_VALIDATE=PASS"
  echo "  realpath=$REPO_SRC_REALPATH"
  echo "  head=$PRE_PACK_HEAD"
  echo "  tree=$PRE_PACK_TREE"
  echo "  clean=$PRE_PACK_CLEAN"
  exit 0
fi

if [ "${TRUSTED_CP_SELFTEST_PROVENANCE:-}" = "1" ] || [ "${1:-}" = "--selftest-provenance" ]; then
  # No-root selftest: scratch git fixtures only; never touches /usr/local.
  SCRATCH_REPO="${1:-}"
  gate_fail() { echo "SELFTEST_PROVENANCE_FAIL $1" >&2; exit 1; }
  ok_msg() { echo "SELFTEST_PROVENANCE_OK $1"; }
  T="$(mktemp -d /tmp/trusted-cp-prov-selftest-XXXXXX)"
  # OLD fixture: pre-V4 broker bytes (mirrors the stale 4dc598be-era input)
  git init -q "$T/old" && mkdir -p "$T/old/scripts" "$T/old/packages/broker/src/capabilities"
  echo 'demo' > "$T/old/scripts/demo-home.mjs"
  echo '{"name":"app"}' > "$T/old/package.json"
  echo '// legacy broker capability (pre-V4)' > "$T/old/packages/broker/src/capabilities/workflow.js"
  echo '{"name":"broker"}' > "$T/old/packages/broker/package.json"
  git -C "$T/old" add -A && git -C "$T/old" -c user.name=t -c user.email=t@t commit -qm old
  OLD_SHA="$(git -C "$T/old" rev-parse HEAD)"; OLD_TREE="$(git -C "$T/old" rev-parse HEAD^{tree})"
  # NEW fixture: V4 broker bytes (mirrors cfc2729)
  git init -q "$T/new" && mkdir -p "$T/new/scripts" "$T/new/packages/broker/src/capabilities"
  echo 'demo' > "$T/new/scripts/demo-home.mjs"
  echo '{"name":"app"}' > "$T/new/package.json"
  cat > "$T/new/packages/broker/src/capabilities/workflow.js" << 'JS'
// broker capability with V4 global instances passthrough
export const QUERY_KEYS = ['lifecycle', 'status', 'currentExecutorType'];
export const ERR_INVALID_EXECUTOR = 'invalid_current_executor_type';
export const RESPONSE_FIELD = 'current_executor_type';
JS
  echo '{"name":"broker"}' > "$T/new/packages/broker/package.json"
  git -C "$T/new" add -A && git -C "$T/new" -c user.name=t -c user.email=t@t commit -qm new
  NEW_SHA="$(git -C "$T/new" rev-parse HEAD)"; NEW_TREE="$(git -C "$T/new" rev-parse HEAD^{tree})"
  TRUSTED_ROOT="$T/trusted-root"   # scratch; only used by the rejection check

EXPECTED_SOURCE_SHA="$NEW_SHA" EXPECTED_SOURCE_TREE="$NEW_TREE" REPO_SRC="$T/new" validate_pack_source "$T/new" "$TRUSTED_ROOT"
  ok_msg "T2 explicit REPO_SRC + matching SHA/tree accepted"

  unset EXPECTED_SOURCE_SHA
  if ( EXPECTED_SOURCE_SHA="" EXPECTED_SOURCE_TREE="$NEW_TREE" REPO_SRC="$T/new" validate_pack_source "$T/new" "$TRUSTED_ROOT" ) 2>/dev/null; then
    gate_fail "T1 implicit/absent pack source must fail"
  fi
  ok_msg "T1 missing EXPECTED_SOURCE_SHA fails closed (implicit pack source eliminated)"

  if ( EXPECTED_SOURCE_SHA="$NEW_SHA" EXPECTED_SOURCE_TREE="$NEW_TREE" REPO_SRC="$T/new" GENERATION_LABEL_SHA="$OLD_SHA" validate_pack_source "$T/new" "$TRUSTED_ROOT" ) 2>/dev/null; then
    gate_fail "T3 label/HEAD mismatch must fail"
  fi
  ok_msg "T3 SOURCE_LABEL_MISMATCH fails before mutation"

  echo dirty > "$T/new/packages/broker/src/capabilities/dirty.txt"
  if ( EXPECTED_SOURCE_SHA="$NEW_SHA" EXPECTED_SOURCE_TREE="$NEW_TREE" REPO_SRC="$T/new" validate_pack_source "$T/new" "$TRUSTED_ROOT" ) 2>/dev/null; then
    gate_fail "T4 dirty source must fail"
  fi
  rm "$T/new/packages/broker/src/capabilities/dirty.txt"
  ok_msg "T4 dirty pack input fails closed"

  mkdir -p "$T/installed-app/scripts"
  cp "$0" "$T/installed-app/scripts/trusted-cp-deploy-install.sh" 2>/dev/null || true
  if ( EXPECTED_SOURCE_SHA="$NEW_SHA" EXPECTED_SOURCE_TREE="$NEW_TREE" REPO_SRC="$T/installed-app" validate_pack_source "$T/installed-app" "$T/trusted-root" ) 2>/dev/null; then
    gate_fail "T5 trusted live app family must be rejected as pack source"
  fi
  ok_msg "T5 live trusted app rejected as pack source"

  EXPECTED_SOURCE_SHA="$NEW_SHA" EXPECTED_SOURCE_TREE="$NEW_TREE" REPO_SRC="$T/new"     validate_pack_source "$T/new" "$TRUSTED_ROOT"
  PRE_H="$PRE_PACK_HEAD"
  echo more >> "$T/new/packages/broker/src/capabilities/workflow.js"
  git -C "$T/new" add -A && git -C "$T/new" -c user.name=t -c user.email=t@t commit -qm drift --quiet
  POST_H="$(pack_source_stamp "$T/new" | sed -n 's/^head=//p')"
  [ "$PRE_H" != "$POST_H" ] || gate_fail "T6 fixture drift did not change HEAD"
  [ "$PRE_H" != "$POST_H" ] && ok_msg "T6 TOCTOU stamp pair detects source drift between pre/post pack"

  # T7/T8: pack simulation from NEW must carry V4 bytes into the packed output,
  # and the packed workflow.js must differ from the stale pre-V4 fingerprint.
  PACK="$T/packed-app"; mkdir -p "$PACK/packages" "$PACK/scripts"
  cp "$T/new/package.json" "$PACK/package.json"
  cp "$T/new/packages/broker/package.json" "$PACK/packages/broker/package.json" 2>/dev/null || { mkdir -p "$PACK/packages/broker"; cp "$T/new/packages/broker/package.json" "$PACK/packages/broker/package.json"; }
  cp -R "$T/new/packages/broker/src" "$PACK/packages/broker/src"
  grep -q "currentExecutorType" "$PACK/packages/broker/src/capabilities/workflow.js"     && grep -q "invalid_current_executor_type" "$PACK/packages/broker/src/capabilities/workflow.js"     && grep -q "current_executor_type" "$PACK/packages/broker/src/capabilities/workflow.js"     || gate_fail "T7 packed artifact lost V4 bytes"
  PW=$(shasum -a 256 "$PACK/packages/broker/src/capabilities/workflow.js" | awk '{print $1}')
  [ "$PW" != "d76791b7ebbacc872343ba8a26d13ce1f4f2315f4ff5a53fc8744f445b1e65ee" ]     || gate_fail "T8 packed broker bytes equal the stale pre-V4 fingerprint"
  ok_msg "T7/T8 packed artifact carries V4 bytes and differs from the stale fingerprint"

  rm -rf "$T"
  echo "SELFTEST_PROVENANCE=PASS"
  exit 0
fi

if [ "${TRUSTED_CP_SELFTEST_LOCK:-}" = "1" ]; then
  # Offline lock/trap regression (B6): standalone success, ordinary failure,
  # parent-owned/inherited. Runs against the scratch PRODUCTION_DEPLOY_LOCK_DIR.
  gate_fail() { echo "SELFTEST_FAIL $1" >&2; exit 1; }
  ok() { echo "SELFTEST_OK $1"; }
  PRESERVED_SOURCE_GIT_STAMP="$(mktemp /tmp/trusted-cp-stamp-selftest-XXXXXX)"
  : > "$PRESERVED_SOURCE_GIT_STAMP"
  acquire_global_deploy_mutex
  composed_exit_cleanup
  [ -d "$PRODUCTION_DEPLOY_LOCK_DIR" ] && gate_fail "standalone success must release the installer-owned mutex"
  [ -f "$PRESERVED_SOURCE_GIT_STAMP" ] && gate_fail "standalone success must remove the preserved stamp"
  ok "standalone success: stamp removed + installer-owned mutex released"
  acquire_global_deploy_mutex
  ok "standalone ordinary failure: lock remains fail-closed (explicit disposition, no auto-delete)"
  grep -qx "pid=$$" "$PRODUCTION_DEPLOY_LOCK_DIR/holder" || gate_fail "holder identity mismatch"
  rm -f "$PRODUCTION_DEPLOY_LOCK_DIR/holder"
  rmdir "$PRODUCTION_DEPLOY_LOCK_DIR"
  GLOBAL_LOCK_ACQUIRED_BY_ME=0
  ok "standalone ordinary failure: holder release works"
  mkdir "$PRODUCTION_DEPLOY_LOCK_DIR"
  printf 'pid=1\ncmd=run-authorized-transaction.sh (parent transaction)\n' > "$PRODUCTION_DEPLOY_LOCK_DIR/holder"
  INHERITED_LOCK_HOLDER_PATTERN="run-authorized-transaction.sh"
  grep -q "$INHERITED_LOCK_HOLDER_PATTERN" "$PRODUCTION_DEPLOY_LOCK_DIR/holder" \
    || gate_fail "inherited fixture broken"
  GLOBAL_LOCK_ACQUIRED_BY_ME=0
  PRESERVED_SOURCE_GIT_STAMP=""
  composed_exit_cleanup
  [ -d "$PRODUCTION_DEPLOY_LOCK_DIR" ] || gate_fail "child must NEVER delete a parent-owned lock"
  [ -f "$PRODUCTION_DEPLOY_LOCK_DIR/holder" ] || gate_fail "parent holder metadata must survive the child"
  ok "parent-owned/inherited: child verified the holder and left the parent lock intact"
  rm -f "$PRODUCTION_DEPLOY_LOCK_DIR/holder"; rmdir "$PRODUCTION_DEPLOY_LOCK_DIR"
  echo "SELFTEST_LOCK=PASS"
  exit 0
fi

if [ "$(id -u)" != "0" ]; then
  echo "ERROR: must run as root (sudo ./scripts/trusted-cp-deploy-install.sh)" >&2
  exit 2
fi

if [ -n "$INHERITED_LOCK_HOLDER_PATTERN" ]; then
  [ -d "$PRODUCTION_DEPLOY_LOCK_DIR" ] \
    || { echo "ERROR: inherited lock expected but absent - $PRODUCTION_DEPLOY_LOCK_DIR" >&2; exit 1; }
  grep -q "$INHERITED_LOCK_HOLDER_PATTERN" "$PRODUCTION_DEPLOY_LOCK_DIR/holder" 2>/dev/null \
    || { echo "ERROR: inherited lock holder does not match the parent pattern '$INHERITED_LOCK_HOLDER_PATTERN'" >&2
         cat "$PRODUCTION_DEPLOY_LOCK_DIR/holder" 2>/dev/null || true
         exit 1; }
  echo "== inherited global production-deploy mutex verified (held by parent transaction) =="
else
  acquire_global_deploy_mutex
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# AGENT_CORE_BACKUP_RETENTION_V1: deployment backup metadata + pin + post-verified
# retention ops live in the tiny filesystem helper (same dir as this script). It is
# pure shell/filesystem — no package/DB/service/daemon; it neither deletes legacy
# backups nor modifies Runtime/Router/Scheduler/Kernel/product semantics.
BACKUP_OPS="$SCRIPT_DIR/agent-core-backup-ops.sh"
SOURCE_GIT_STAMP="$SCRIPT_DIR/lib/trusted-source-git-stamp.sh"
# TRUSTED_CP_PACK_INPUT_PROVENANCE_V1: REPO_SRC is explicit-only. The removed
# default (dirname of this script) made an invocation from the INSTALLED live
# app repack the live app's own stale bytes under a fresh generation label.
REPO_SRC="${1:-}"
HARNESS_SRC="${2:-/Users/yanfenma/workspace/github/deepseek-harness}"
# The main repo holds the dev node_modules (third-party deps); a worktree
# does not check node_modules out. Its provenance is recorded in the pack
# receipt; it is never used as the app source.
MAIN_REPO="${3:-}"
TRUSTED_ROOT=/usr/local/libexec/agent-core
HELPER=/usr/local/libexec/dsh-agent-spawn-helper
AUTHSVC_UID=505
AUTHSVC_GID=601
CHILD_UID=502
CHILD_GID=20

echo "== trusted control-plane install =="
echo "  trusted root : $TRUSTED_ROOT"
echo "  repo source  : $REPO_SRC"
echo "  harness src  : $HARNESS_SRC"

# ---- 0. sanity -------------------------------------------------------------
# TRUSTED_CP_PACK_INPUT_PROVENANCE_V1: pack-source validation runs BEFORE the
# backup/mv/install mutations below (fail-closed preflight, not a cutover-time check).
validate_pack_source "$REPO_SRC" "$TRUSTED_ROOT"
echo "  provenance  : HEAD=$PRE_PACK_HEAD tree=$PRE_PACK_TREE clean=$PRE_PACK_CLEAN realpath=$REPO_SRC_REALPATH"
if [ -n "$MAIN_REPO" ]; then
  MAIN_REPO_REALPATH="$(cd "$MAIN_REPO" 2>/dev/null && pwd -P)" || MAIN_REPO_REALPATH="$MAIN_REPO"
  reject_trusted_live_source "$MAIN_REPO_REALPATH" "$TRUSTED_ROOT"     || { echo "ERROR: MAIN_REPO resolves inside the trusted live root family" >&2; exit 2; }
  MAIN_REPO_HEAD="$(git -C "$MAIN_REPO" rev-parse HEAD 2>/dev/null || echo unknown)"
else
  MAIN_REPO_REALPATH=""; MAIN_REPO_HEAD="unknown"
fi
[ -f "$REPO_SRC/scripts/demo-home.mjs" ] || { echo "ERROR: bad REPO_SRC: $REPO_SRC" >&2; exit 2; }
[ -f "$HARNESS_SRC/apps/cli/lib/bin.js" ] || { echo "ERROR: bad HARNESS_SRC: $HARNESS_SRC" >&2; exit 2; }
id authsvc >/dev/null 2>&1 || { echo "ERROR: user authsvc (uid 505) missing" >&2; exit 2; }

[ -x "$SOURCE_GIT_STAMP" ] || { echo "ERROR: source Git stamp helper missing/not executable: $SOURCE_GIT_STAMP" >&2; exit 2; }
HARNESS_STAMP="$($SOURCE_GIT_STAMP "$HARNESS_SRC")" || { rc=$?; echo "ERROR: Harness Git source probe failed before backup (exit $rc): $HARNESS_SRC" >&2; exit "$rc"; }
PRESERVED_SOURCE_GIT_STAMP="$(/usr/bin/mktemp /tmp/agent-core-source-git-stamp.XXXXXX)" && /usr/bin/install -o root -g wheel -m 700 "$SOURCE_GIT_STAMP" "$PRESERVED_SOURCE_GIT_STAMP"
# stamp removal is owned by composed_exit_cleanup (B6: single composed EXIT trap)

# ---- 1. backup previous install (code refreshed, config preserved in .bak) --
if [ -e "$TRUSTED_ROOT" ]; then
  BAK="${TRUSTED_ROOT}.bak-$(date +%Y%m%d-%H%M%S)"
  echo "== backing up previous install -> $BAK"
  mv "$TRUSTED_ROOT" "$BAK"
  # AGENT_CORE_BACKUP_RETENTION_V1: write metadata for the backed-up PREVIOUS
  # installed closure (created_at / source_commit / pinned / status). Metadata
  # must never attribute the successor (new) deployment's commit to this backup,
  # so source_commit stays "unknown" (the previous closure does not record its
  # app commit). Pin = metadata/marker only — NO data copy. This is the predeploy
  # capture; nothing is pruned here (prune only happens post-verified-success via
  # the operator helper, and never touches legacy backups).
  #   FIRST_RELIABLE_PIN is set ONLY when the trusted operator EXPLICITLY asserts
  #   the predecessor is the verified LKG via the env seam
  #   AGENT_CORE_VERIFIED_PREDECESSOR_LKG=YES (propagates to the helper subprocess).
  #   Without it, the backup is created normally and is NOT auto-pinned — this
  #   helper never infers known-good from no-pin/mtime/newest/current-install
  #   (LKG_AUTHORITY = TRUSTED_OPERATOR_ASSERTION, MACHINE_LKG_DETECTION = NO).
  #   NOTE: this is a non-fatal best-effort — a metadata failure must not block
  #   the install.
  if [ -x "$BACKUP_OPS" ]; then
    "$BACKUP_OPS" "$(dirname "$TRUSTED_ROOT")" --write-predecessor "$BAK" \
      || echo "  WARNING: backup metadata/first-pin failed for $BAK (install continues; investigate)" >&2
  else
    echo "  WARNING: backup-ops helper missing ($BACKUP_OPS); deployment backup will carry no retention metadata" >&2
  fi
fi

mkdir -p "$TRUSTED_ROOT"/{harness,app,home,config,.cache}
cd "$TRUSTED_ROOT"

# ---- 1b. reuse the heavyweight closures when their sources are UNCHANGED ----
# The harness closure (1.5G source + offline pnpm install) and the Node
# runtime are DEPENDENCIES of the code under test, not the code under test
# itself. When the harness checkout is at the same commit (and clean) and the
# Cellar node version is identical, mv them back from the backup — an instant
# rename instead of minutes of tar+pnpm. The app closure is ALWAYS recopied
# fresh (that is where the integration changes live).
REUSE_HARNESS=0
REUSE_NODE=0
if [ -n "${BAK:-}" ]; then
  if [ -n "$HARNESS_STAMP" ] && [ -f "$BAK/harness/.source-stamp" ] \
     && [ "$(cat "$BAK/harness/.source-stamp" 2>/dev/null)" = "$HARNESS_STAMP" ]; then
    rmdir "$TRUSTED_ROOT/harness"
    mv "$BAK/harness" "$TRUSTED_ROOT/harness"
    if [ -d "$BAK/.cache" ]; then
      rmdir "$TRUSTED_ROOT/.cache"
      mv "$BAK/.cache" "$TRUSTED_ROOT/.cache"
    fi
    REUSE_HARNESS=1
    echo "  harness closure REUSED from $BAK (source commit unchanged — tar+pnpm skipped)"
  fi
  if [ -x "$BAK/node-runtime/bin/node" ] \
     && [ "$("$BAK/node-runtime/bin/node" --version 2>/dev/null)" = "$(node --version)" ]; then
    mv "$BAK/node-runtime" "$TRUSTED_ROOT/node-runtime"
    REUSE_NODE=1
    echo "  node-runtime REUSED from $BAK (same node version $(node --version))"
  fi
fi

# ---- 2. harness closure ----------------------------------------------------
if [ "$REUSE_HARNESS" != "1" ]; then
echo "== copying harness source (no node_modules/.git) -> harness/"
tar -C "$HARNESS_SRC" -cf - \
  --exclude='node_modules' --exclude='.git' --exclude='.worktree*' \
  --exclude='.turbo' --exclude='dist' --exclude='lib/*.tsbuildinfo' \
  . | tar -C harness -xf -

echo "== pnpm install (offline, frozen, copy-import) -> harness/node_modules"
cd harness
# copy-import => every file is a REAL copy owned by the install user; no
# hardlink can point back into the 502-owned pnpm store.
/usr/local/bin/pnpm install --offline --frozen-lockfile --ignore-scripts \
  --config.package-import-method=copy --cache-dir "$TRUSTED_ROOT/.cache" \
  >/tmp/trusted-cp-pnpm-install.log 2>&1 || {
    echo "ERROR: pnpm install failed; log tail:" >&2
    tail -20 /tmp/trusted-cp-pnpm-install.log >&2
    exit 2
  }
cd "$TRUSTED_ROOT"
printf '%s' "$HARNESS_STAMP" > harness/.source-stamp
fi

# ---- 2b. trusted Node runtime (review blocker fix) --------------------------
# The production Control Plane must NEVER execute /usr/local/bin/node
# (Homebrew, uid-502-writable). Materialize the ACTUAL Node runtime into the
# trusted closure: real files only (cp -RL), no symlink/hardlink back to
# /usr/local/bin, the Cellar, or /Users/yanfenma.
echo "== copying Node runtime -> node-runtime/"
if [ "$REUSE_NODE" != "1" ]; then
NODE_LINK_TARGET="$(readlink /usr/local/bin/node)"
case "$NODE_LINK_TARGET" in
  /*) NODE_CELLAR_BIN="$NODE_LINK_TARGET" ;;
  *)  NODE_CELLAR_BIN="$(dirname /usr/local/bin/node)/$NODE_LINK_TARGET" ;;
esac
NODE_CELLAR_BIN="$(cd "$(dirname "$NODE_CELLAR_BIN")" && pwd -P)/$(basename "$NODE_CELLAR_BIN")"
NODE_VERSION_DIR="$(dirname "$(dirname "$NODE_CELLAR_BIN")")"
mkdir -p node-runtime
cp -RL "$NODE_VERSION_DIR"/. node-runtime/
fi
TRUSTED_NODE="$TRUSTED_ROOT/node-runtime/bin/node"
if [ ! -x "$TRUSTED_NODE" ] || [ -L "$TRUSTED_NODE" ]; then
  echo "ERROR: trusted node missing or is a symlink: $TRUSTED_NODE" >&2
  exit 2
fi
if ! "$TRUSTED_NODE" --version >/dev/null 2>&1; then
  echo "ERROR: trusted node does not run: $TRUSTED_NODE" >&2
  exit 2
fi
if [ "$REUSE_NODE" != "1" ]; then
  # hardlink guard only applies to a FRESH copy (a reused closure was fully
  # materialized + verified by the install that produced it)
  CELLAR_INODE="$(stat -f %i "$NODE_CELLAR_BIN")"
  TRUSTED_INODE="$(stat -f %i "$TRUSTED_NODE")"
  if [ "$CELLAR_INODE" = "$TRUSTED_INODE" ]; then
    echo "ERROR: trusted node shares an inode with the Cellar binary (hardlink!)" >&2
    exit 2
  fi
fi
if [ "$(find node-runtime -type l | wc -l | tr -d ' ')" != "0" ]; then
  echo "ERROR: node-runtime still contains symlinks (must be fully materialized)" >&2
  exit 2
fi
if [ "$REUSE_NODE" = "1" ]; then
  echo "  trusted node: $TRUSTED_NODE ($("$TRUSTED_NODE" --version), reused from previous install)"
else
  echo "  trusted node: $TRUSTED_NODE ($("$TRUSTED_NODE" --version), source $NODE_VERSION_DIR)"
fi

# ---- 3. app closure (Agent Core runtime surface) ---------------------------
echo "== copying Agent Core closure -> app/"
mkdir -p app/packages app/node_modules
cp "$REPO_SRC/package.json" app/package.json
mkdir -p app/scripts
for f in agent-core-resident.mjs demo-home.mjs agentcore-cron.mjs \
         dsh-agent-spawn-helper.c trusted-cp-deploy-install.sh \
         agent-core-backup-ops.sh \
         trusted-cp-hardening-v1-verify.mjs \
         production-runtime.mjs production-runtime-launchd.mjs \
         production-runtime-v1-verify.mjs \
         production-agent-provision.mjs; do
  [ -f "$REPO_SRC/scripts/$f" ] && cp "$REPO_SRC/scripts/$f" app/scripts/
done
mkdir -p app/scripts/lib && cp "$PRESERVED_SOURCE_GIT_STAMP" app/scripts/lib/trusted-source-git-stamp.sh
# packages: src + package.json only (no tests)
for pkg in "$REPO_SRC"/packages/*/; do
  name="$(basename "$pkg")"
  [ -f "$pkg/package.json" ] || continue
  mkdir -p "app/packages/$name"
  cp "$pkg/package.json" "app/packages/$name/package.json"
  [ -d "$pkg/src" ] && cp -R "$pkg/src" "app/packages/$name/src"
done
# bundles + profiles
for d in "$REPO_SRC"/bundle-* "$REPO_SRC"/profile-*; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  mkdir -p "app/$name"
  cp "$d/package.json" "app/$name/package.json"
  [ -f "$d/cordis.patch.yml" ] && cp "$d/cordis.patch.yml" "app/$name/cordis.patch.yml"
done

# Agent existence authority closure (AGENT_DEFINITION_CONFIG_V1): the formal
# Agent Definition package MUST be in the trusted app closure, and the
# removed agent-registry package MUST NOT be (no second Agent authority).
# TRUSTED_CP_PACK_INPUT_PROVENANCE_V1: post-pack TOCTOU stamp. The source
# must be byte-identical (same HEAD/tree, still clean) to the pre-pack stamp;
# drift here means the packed closure may not correspond to the validated
# source, so the install fails before any service/restart mutation.
POST_PACK_STAMP="$(pack_source_stamp "$REPO_SRC")"
POST_PACK_HEAD="$(echo "$POST_PACK_STAMP" | awk '{print $1}' | sed 's/^head=//')"
POST_PACK_TREE="$(echo "$POST_PACK_STAMP" | awk '{print $2}' | sed 's/^tree=//')"
POST_PACK_CLEAN="$(echo "$POST_PACK_STAMP" | awk '{print $3}' | sed 's/^clean=//')"
if [ "$POST_PACK_HEAD" != "$PRE_PACK_HEAD" ] || [ "$POST_PACK_TREE" != "$PRE_PACK_TREE" ] \
   || [ "$POST_PACK_CLEAN" != "$PRE_PACK_CLEAN" ]; then
  echo "ERROR: SOURCE_CHANGED_DURING_PACK: pre=($PRE_PACK_HEAD/$PRE_PACK_TREE/$PRE_PACK_CLEAN) post=($POST_PACK_HEAD/$POST_PACK_TREE/$POST_PACK_CLEAN)" >&2
  exit 2
fi
echo "  ok: pack input source unchanged during pack (TOCTOU stamp match)"
PACKED_APP_TREE_SHA256="$(packed_app_provenance "$(pwd)/app" "$(pwd)/app/pack-provenance.json")"
echo "  packed app tree sha256: $PACKED_APP_TREE_SHA256"
echo "  pack provenance receipt: app/pack-provenance.json"

if [ ! -f "app/packages/agent-definition/package.json" ] \
   || [ ! -d "app/packages/agent-definition/src" ]; then
  echo "ERROR: app closure missing packages/agent-definition (Agent Definition authority)" >&2
  exit 2
fi
if [ -e "app/packages/agent-registry" ]; then
  echo "ERROR: app closure still contains packages/agent-registry (old authority must be absent)" >&2
  exit 2
fi
echo "  Agent Definition closure: packages/agent-definition PRESENT, packages/agent-registry ABSENT"

# PRODUCTION_INTEGRATION_V1 (Task 3): the Production Runtime closure MUST be
# in the trusted app closure — the supervised composition (launchd -> trusted
# Node -> app/scripts/production-runtime.mjs) imports the wiring-only
# production-runtime package and spawns agents with the production profile.
for need in \
  "app/packages/production-runtime/package.json" \
  "app/packages/production-runtime/src/entry.js" \
  "app/packages/agent-provisioning/package.json" \
  "app/profile-production/package.json" \
  "app/profile-production/cordis.patch.yml" \
  "app/scripts/production-runtime.mjs" \
  "app/scripts/production-runtime-launchd.mjs" \
  "app/scripts/production-agent-provision.mjs"; do
  if [ -e "$need" ]; then :; else { echo "ERROR: production-runtime closure missing: $need" >&2; exit 2; }; fi
done
echo "  Production Runtime closure: packages/{production-runtime,agent-provisioning} + profile-production + scripts PRESENT"

# @deepseek-ai resolution bridge — INSIDE the trusted root only. The app
# packages resolve @deepseek-ai/* through the harness's full scope farm
# (node_modules/.pnpm/node_modules/@deepseek-ai), exactly like the dev
# setup's bridge; every entry stays inside the trusted harness.
ln -s ../../harness/node_modules/.pnpm/node_modules/@deepseek-ai app/node_modules/@deepseek-ai
[ -d "app/node_modules/@deepseek-ai" ] || { echo "ERROR: @deepseek-ai bridge broken" >&2; exit 2; }

# third-party runtime deps of the app closure (real copies, dereferenced —
# never symlinks into the 502-owned dev install):
#   @larksuiteoapi/node-sdk  (feishu-connector)
#   croner                   (scheduler)
# third-party runtime deps of the app closure — copy the FULL dev-install
# node_modules surface as REAL dereferenced copies (the dev repo is the
# reference environment where the composition loads; axios/form-data/… are
# transitive deps of @larksuiteoapi). @deepseek-ai stays the in-trusted
# bridge; @agent-core is a dev-only artifact and is skipped.
for dep in "$MAIN_REPO"/node_modules/*/; do
  name="$(basename "$dep")"
  case "$name" in
    @deepseek-ai|@agent-core|node_modules) continue ;;
  esac
  [ -e "$dep" ] || continue
  cp -RL "$dep" "app/node_modules/$name"
done
[ -d "app/node_modules/@larksuiteoapi" ] && [ -d "app/node_modules/croner" ] \
  || { echo "ERROR: third-party app deps incomplete" >&2; exit 2; }

# ---- 4. control-plane home (DSH_HOME of the 505 parent) --------------------
echo "== provisioning control-plane home -> home/"
# trusted model-route settings source for the 505 user (children copy from it)
if [ ! -d /Users/authsvc/.dsh ]; then
  mkdir -p /Users/authsvc/.dsh
  chown "${AUTHSVC_UID}:${AUTHSVC_GID}" /Users/authsvc/.dsh
fi
for f in settings.yaml .credentials.yaml; do
  if [ -f "/Users/yanfenma/.dsh/$f" ] && [ ! -f "/Users/authsvc/.dsh/$f" ]; then
    cp "/Users/yanfenma/.dsh/$f" "/Users/authsvc/.dsh/$f"
    chown "${AUTHSVC_UID}:${AUTHSVC_GID}" "/Users/authsvc/.dsh/$f"
    chmod 600 "/Users/authsvc/.dsh/$f"
  fi
done
for f in settings.yaml .credentials.yaml; do
  [ -f "/Users/authsvc/.dsh/$f" ] || { echo "ERROR: /Users/authsvc/.dsh/$f missing (seed it first)" >&2; exit 2; }
done
# the CP's own home (profile copies + farm links into app/)
mkdir -p home/profiles/agent-core-integration
cp app/profile-integration/package.json home/profiles/agent-core-integration/package.json
cp app/profile-integration/cordis.patch.yml home/profiles/agent-core-integration/cordis.patch.yml
mkdir -p home/profiles/node_modules/@agent-core
# farm links into app/ — RELATIVE from home/profiles/node_modules/@agent-core
# up four levels to the trusted root: ../..(profiles) ../../..(home) ../../../..(root)
for entry in \
  "bundle-integration:../../../../app/bundle-integration" \
  "feishu-connector:../../../../app/packages/feishu-connector" \
  "agent-router:../../../../app/packages/agent-router" \
  "product-api:../../../../app/packages/product-api" \
  "broker:../../../../app/packages/broker" \
  "workspace-bootstrap:../../../../app/packages/workspace-bootstrap" \
  "agent-definition:../../../../app/packages/agent-definition" \
  "notification-ingress:../../../../app/packages/notification-ingress"; do
  name="${entry%%:*}"; target="${entry#*:}"
  ln -sfn "$target" "home/profiles/node_modules/@agent-core/$name"
done
# CP home boot needs a 0600 .credentials.yaml (harness credentials-local rule)
cp /Users/authsvc/.dsh/settings.yaml home/settings.yaml
cp /Users/authsvc/.dsh/.credentials.yaml home/.credentials.yaml
chmod 600 home/.credentials.yaml

# ---- 5. config (505-private state) -----------------------------------------
echo "== seeding config/ (505-private)"
mkdir -p config
# The Agent Definition config is the SINGLE Agent existence authority
# (AGENT_DEFINITION_CONFIG_V1): an empty declarative document until the
# deployment authorizes agents (adoptAgents / seedDefinition). A REINSTALL
# MUST NEVER destroy the deployed definition or the credential store — the
# stable agt_* identities and the 505 credentials survive code refreshes;
# empty documents are seeded only on a fresh install.
if [ -n "${BAK:-}" ] && [ -f "$BAK/config/agents.json" ]; then
  cp "$BAK/config/agents.json" config/agents.json
  echo "  preserved Agent Definition from $BAK (stable agt_* identities kept)"
else
  printf '{\n  "version": 1,\n  "defaultAgentId": null,\n  "agents": []\n}\n' > config/agents.json
fi
if [ -n "${BAK:-}" ] && [ -f "$BAK/config/agent-credentials.json" ]; then
  cp "$BAK/config/agent-credentials.json" config/agent-credentials.json
  echo "  preserved credential store from $BAK"
else
  printf '{\n  "version": 1,\n  "credentials": {}\n}\n' > config/agent-credentials.json
fi
# bindings/jobs are created by the router/resident on first boot (missing
# file is a legal empty store for both).

# ---- 5b. 505 production root (PRODUCTION_INTEGRATION_V1, Task 3) -----------
# The supervised Production Runtime (packages/production-runtime) persists
# under $HOME/.agent-core. Under uid 505 (authsvc) that is
# /Users/authsvc/.agent-core. Provision it with the production layout so the
# launchd --trusted unit (which passes --root explicitly) boots onto a fully
# provisioned root. The Agent Definition authority stays a SYMLINK to the
# trusted config/agents.json — the single Agent existence document (never a
# second copy that could drift). Credential store likewise symlinks to the
# trusted config/agent-credentials.json (Broker gateway via
# AGENT_CORE_CREDENTIALS_FILE = that trusted 505-private file).
echo "== provisioning 505 production root -> /Users/authsvc/.agent-core"
PROD_ROOT=/Users/authsvc/.agent-core
mkdir -p "$PROD_ROOT"/{bindings,scheduler,workspaces,homes,control,logs}
# Agent Definition + credential store: single-file authority via symlink to
# the trusted 505-private config (the runtime reads through the link; only the
# trusted config file is written/authoritative).
if [ -e "$PROD_ROOT/agents.json" ] || [ -L "$PROD_ROOT/agents.json" ]; then rm -f "$PROD_ROOT/agents.json"; fi
ln -s /usr/local/libexec/agent-core/config/agents.json "$PROD_ROOT/agents.json"
# Ownership split (PRODUCTION_INTEGRATION_V1): the 505 control plane owns the
# root + all control state (bindings/scheduler/control/logs); the Agent child
# (uid 502) owns the per-agent workspace + DSH home trees under the same
# production root. workspaces/ + homes/ stay TRAVERSABLE (0755) — the 505
# router's idempotent ensure()/provisionAgentHome must stat through them
# (the posture proven by trusted-credential-505-final-v2-run.mjs; the 505
# PRIVATE dirs are the ones that get go-stripped). A reinstall must never
# steal existing child trees back: chown the two roots only, never -R over
# them; per-agent trees are provisioned by production-agent-provision.mjs.
chown "${AUTHSVC_UID}:${AUTHSVC_GID}" "$PROD_ROOT"
# 711 (NOT 700): uid 502 must TRAVERSE the root to reach its own per-agent
# workspace (spawn cwd) and home — run-4's 0700 root blocked the child at
# spawn (cwd EACCES, swallowed spawn error, 90s silent ready() timeout, and a
# delayed unhandled rejection killed the CP minutes later). o+x without o+r:
# others may reach KNOWN paths but cannot LIST the root; every 505-private
# subdir keeps its own 0700.
chmod 711 "$PROD_ROOT"
chown -R "${AUTHSVC_UID}:${AUTHSVC_GID}" "$PROD_ROOT/bindings" "$PROD_ROOT/scheduler" "$PROD_ROOT/control" "$PROD_ROOT/logs"
chmod -R u+rwX,go-rwx "$PROD_ROOT/bindings" "$PROD_ROOT/scheduler" "$PROD_ROOT/control" "$PROD_ROOT/logs"
chown "${CHILD_UID}:${CHILD_GID}" "$PROD_ROOT/workspaces" "$PROD_ROOT/homes"
chmod 755 "$PROD_ROOT/workspaces" "$PROD_ROOT/homes"
echo "  production root: $PROD_ROOT (505-private control state 0700; workspaces+homes 502-owned 0755-traversable; agents.json -> config/agents.json single authority)"

# ---- 6. ownership + modes ---------------------------------------------------
echo "== ownership: harness/app/home/node-runtime -> authsvc:authsvc (502 read-only)"
# reused closures already carry the correct ownership+modes from the install
# that produced them — skip the 1.5G re-walk; fresh copies get the full pass
OWN_DIRS="app home"
[ "$REUSE_HARNESS" != "1" ] && OWN_DIRS="harness $OWN_DIRS"
[ "$REUSE_NODE" != "1" ] && OWN_DIRS="$OWN_DIRS node-runtime"
for d in $OWN_DIRS; do
  chown -R -h "${AUTHSVC_UID}:${AUTHSVC_GID}" "$TRUSTED_ROOT/$d"
  chmod -R u+rwX,go+rX,go-w "$TRUSTED_ROOT/$d"
done
# the harness credentials-local plugin refuses anything wider than owner-only
chmod 600 "$TRUSTED_ROOT/home/.credentials.yaml"
chown -R "${AUTHSVC_UID}:${AUTHSVC_GID}" "$TRUSTED_ROOT/config"
chmod -R 700 "$TRUSTED_ROOT/config"
chmod 600 "$TRUSTED_ROOT/config"/*.json
chown -R root:wheel "$TRUSTED_ROOT/.cache"
chmod 700 "$TRUSTED_ROOT/.cache"

# ---- 7. spawn helper (root:wheel 4755) --------------------------------------
echo "== spawn helper"
if [ -x "$HELPER" ]; then
  mode="$(stat -f '%Sp' "$HELPER")"
  owner="$(stat -f '%Su:%Sg' "$HELPER")"
  if [ "$mode" != "-rwsr-xr-x" ] || [ "$owner" != "root:wheel" ]; then
    echo "ERROR: helper present but not root:wheel 4755 ($owner $mode)" >&2
    exit 2
  fi
  echo "  $HELPER already installed ($owner $mode)"
else
  TMP_HELPER="$(mktemp /tmp/dsh-agent-spawn-helper.XXXXXX)"
  clang -O2 -Wall -o "$TMP_HELPER" app/scripts/dsh-agent-spawn-helper.c \
    || { echo "ERROR: helper compile failed" >&2; exit 2; }
  install -o root -g wheel -m 4755 "$TMP_HELPER" "$HELPER"
  rm -f "$TMP_HELPER"
  echo "  $HELPER installed (root:wheel 4755)"
fi

# ---- 8. trusted-tree audit ---------------------------------------------------
echo "== symlink audit (every link must stay inside the trusted root)"
BAD=""
while IFS= read -r link; do
  target="$(readlink "$link")"
  case "$target" in
    /*) resolved="$target" ;;
    *) resolved="$(cd "$(dirname "$link")" && readlink -f "$link" 2>/dev/null || echo "$TRUSTED_ROOT/UNRESOLVED")" ;;
  esac
  case "$resolved" in
    "$TRUSTED_ROOT"/*|/usr/local/libexec/*) ;;
    *) echo "  ESCAPE: $link -> $resolved"; BAD=1 ;;
  esac
done < <(find "$TRUSTED_ROOT" -type l)
if [ -n "$BAD" ]; then echo "ERROR: symlink escapes trusted root" >&2; exit 2; fi
echo "  ok: no symlink escapes"

# no /Users/yanfenma references in 505-executed code (drivers are not
# executed by the control plane; allowlisted below)
HITS="$(grep -rl '/Users/yanfenma' app/scripts app/packages app/bundle-* app/profile-* \
  --include='*.js' --include='*.mjs' 2>/dev/null \
  | grep -vE 'trusted-cp-(deploy-install|hardening-v1-verify)' || true)"
if [ -n "$HITS" ]; then
  echo "ERROR: 505-executed code references /Users/yanfenma:" >&2
  echo "$HITS" >&2
  exit 2
fi
echo "  ok: no /Users/yanfenma references in trusted code"

# ---- 9. uid-502 spot check ---------------------------------------------------
echo "== uid-502 spot check (must all be DENIED)"
spot_fail=0
run502() { sudo -u '#502' "$@"; }
if run502 sh -c "echo pwned > '$TRUSTED_ROOT/app/packages/agent-router/src/index.js'" 2>/dev/null; then
  echo "  FAIL: 502 wrote trusted app code"; spot_fail=1
fi
if run502 sh -c "echo pwned > '$TRUSTED_ROOT/config/agents.json'" 2>/dev/null; then
  echo "  FAIL: 502 wrote trusted config"; spot_fail=1
fi
if run502 sh -c "ln -s /Users/yanfenma '$TRUSTED_ROOT/app/packages/agent-router'" 2>/dev/null; then
  echo "  FAIL: 502 replaced trusted path with symlink"; spot_fail=1
fi
[ "$spot_fail" = "0" ] && echo "  ok: all spot checks DENIED"

# ---- 10. summary -------------------------------------------------------------
echo
echo "== install complete =="
echo "  TRUSTED_INSTALL_PATH = $TRUSTED_ROOT"
echo "  TRUSTED_NODE         = $TRUSTED_ROOT/node-runtime/bin/node"
echo "  harness closure: $(du -sh "$TRUSTED_ROOT/harness" | cut -f1)"
echo "  app closure:     $(du -sh "$TRUSTED_ROOT/app" | cut -f1)"
echo "  control home:    $TRUSTED_ROOT/home"
echo "  config (505):    $TRUSTED_ROOT/config"
echo "  helper:          $HELPER (root:wheel 4755)"
echo
echo "Next: sudo node $TRUSTED_ROOT/app/scripts/trusted-cp-hardening-v1-verify.mjs"
