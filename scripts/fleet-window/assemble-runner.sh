#!/bin/bash
# C5-r7 isolated official app recipe. Never source or execute installer entrypoint.
# Official line mapping and disclosed isolation differences: ASSEMBLY-RECIPE-C5R3.md.
set -euo pipefail
umask 077

WORK=/tmp/v5-rebuild
OUT="$WORK/c5r7-receipt"
TRUSTED_ROOT="$WORK/assembled-root"
REPO_SRC=/tmp/fleet-v5-candidate
MAIN_REPO=/tmp/fleet-roll-src
HARNESS_SRC="$WORK/harness-src"
INSTALLER="$MAIN_REPO/scripts/trusted-cp-deploy-install.sh"
PACKAGE_COPY_HELPER="$REPO_SRC/scripts/lib/trusted-app-package-copy.mjs"
SOURCE_GIT_STAMP="$MAIN_REPO/scripts/lib/trusted-source-git-stamp.sh"
EXPECTED_APP_HEAD=ce1d13c1e8585759c6a5f194fb5553d990574b5b
EXPECTED_HARNESS_HEAD=13ecda5c759263c7ce7ab93b678f862f65513f34
EXPECTED_INSTALLER_SHA256=99cc67c971406cd1fc287f2e50b85012bf3123e9532ff0890f925fa8f6edad8c
EXPECTED_PACKAGE_HELPER_SHA256=f8118e93306656a0aa45f5f1ca92d710217ecfc3947b8d5cdff6ddd2d4346869
APP_SCRIPTS_WHITELIST="agent-core-resident.mjs demo-home.mjs agentcore-cron.mjs dsh-agent-spawn-helper.c trusted-cp-deploy-install.sh agent-core-backup-ops.sh trusted-cp-hardening-v1-verify.mjs production-runtime.mjs production-runtime-launchd.mjs production-runtime-v1-verify.mjs production-agent-provision.mjs"
MODE="${1:---check}"
case "$MODE" in --check|--reassemble-app) ;; *) echo 'usage: assemble-runner.sh [--check|--reassemble-app]' >&2; exit 2;; esac

fail() { echo "STOPPED_C5R7: $*" >&2; exit 2; }
git_ro() {
  /usr/bin/env -i PATH=/usr/bin:/bin HOME="$OUT/recorder-home" \
    GIT_OPTIONAL_LOCKS=0 GIT_NO_LAZY_FETCH=1 GIT_CONFIG_SYSTEM=/dev/null \
    GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_COUNT=0 \
    /usr/bin/git -c core.fsmonitor=false -c core.hooksPath=/dev/null -c gc.auto=0 "$@"
}
hash_file() { /usr/bin/shasum -a 256 "$1" | /usr/bin/awk '{print $1}'; }
source_stamp() {
  git_ro -C "$1" rev-parse HEAD HEAD^{tree}
  git_ro -C "$1" status --porcelain=v1 --untracked-files=all
}
check_inputs() {
  [ -d "$OUT/recorder-home" ] || fail 'evidence HOME must be prepared by recorder'
  [ -d "$TRUSTED_ROOT" ] && [ ! -L "$TRUSTED_ROOT" ] || fail 'existing isolated root required; root may not be a symlink'
  ROOT_REAL="$(cd "$TRUSTED_ROOT" && pwd -P)"
  [ "$ROOT_REAL" = /private/tmp/v5-rebuild/assembled-root ] || fail 'unexpected isolated root realpath'
  [ -d "$TRUSTED_ROOT/harness" ] && [ ! -L "$TRUSTED_ROOT/harness" ] || fail 'existing real harness required'
  TRUSTED_NODE="$ROOT_REAL/node-runtime/bin/node"
  [ -x "$TRUSTED_NODE" ] && [ ! -L "$TRUSTED_NODE" ] || fail 'existing real trusted Node required'
  [ "$(git_ro -C "$REPO_SRC" rev-parse HEAD)" = "$EXPECTED_APP_HEAD" ] || fail 'app HEAD mismatch'
  git_ro -C "$REPO_SRC" diff --quiet --no-ext-diff --no-textconv || fail 'app tracked diff'
  git_ro -C "$REPO_SRC" diff --cached --quiet --no-ext-diff --no-textconv || fail 'app index diff'
  [ "$(git_ro -C "$REPO_SRC" status --porcelain=v1 --untracked-files=all)" = '?? STOPPED-C3.md' ] || fail 'app status differs from C3-R2 allowlist'
  [ "$(git_ro -C "$MAIN_REPO" rev-parse HEAD)" = "$EXPECTED_APP_HEAD" ] || fail 'MAIN_REPO HEAD mismatch'
  git_ro -C "$MAIN_REPO" diff --quiet --no-ext-diff --no-textconv || fail 'MAIN_REPO tracked diff'
  git_ro -C "$MAIN_REPO" diff --cached --quiet --no-ext-diff --no-textconv || fail 'MAIN_REPO index diff'
  [ "$(git_ro -C "$HARNESS_SRC" rev-parse HEAD)" = "$EXPECTED_HARNESS_HEAD" ] || fail 'harness source HEAD mismatch'
  [ -z "$(git_ro -C "$HARNESS_SRC" status --porcelain=v1 --untracked-files=all)" ] || fail 'harness source dirty'
  [ "$(hash_file "$INSTALLER")" = "$EXPECTED_INSTALLER_SHA256" ] || fail 'official installer bytes drifted'
  [ "$(hash_file "$PACKAGE_COPY_HELPER")" = "$EXPECTED_PACKAGE_HELPER_SHA256" ] || fail 'official package-copy helper bytes drifted'
  [ -f "$SOURCE_GIT_STAMP" ] || fail 'official source Git stamp helper missing'
  [ -f "$REPO_SRC/scripts/lib/trusted-cp-runtime-app-graph-gate.mjs" ] || fail 'official app graph gate missing'
  [ -d "$MAIN_REPO/node_modules" ] || fail 'recorded MAIN_REPO dependency input missing'
  [ -d "$TRUSTED_ROOT/harness/node_modules/.pnpm/node_modules/@deepseek-ai" ] || fail 'official full scope farm unavailable'
  [ -f "$REPO_SRC/vendor/proxy-agent-negotiate/package.json" ] || fail 'vendored proxy-agent-negotiate missing'
}

# Official installer 898-934: same slim runtime selection, helper, and whitelist.
assemble_app() {
  [ ! -e "$TRUSTED_ROOT/app" ] && [ ! -L "$TRUSTED_ROOT/app" ] || fail 'app must be archived by recorder first; no overwrite'
  cd "$TRUSTED_ROOT"
  mkdir -p app/packages app/node_modules
  cp "$REPO_SRC/package.json" app/package.json
  mkdir -p app/scripts
  for f in $APP_SCRIPTS_WHITELIST; do
    [ ! -f "$REPO_SRC/scripts/$f" ] || cp "$REPO_SRC/scripts/$f" app/scripts/
  done
  # Official 604/904 uses a temporary root-owned preserved helper. Isolation
  # uses the same official helper bytes directly, with no root ownership step.
  mkdir -p app/scripts/lib
  cp "$SOURCE_GIT_STAMP" app/scripts/lib/trusted-source-git-stamp.sh
  for pkg in "$REPO_SRC"/packages/*/; do
    name="$(basename "$pkg")"
    [ -f "$pkg/package.json" ] || continue
    "$TRUSTED_NODE" "$PACKAGE_COPY_HELPER" "$pkg" "app/packages/$name"
  done
  for rel in development-execution; do
    [ -d "$REPO_SRC/packages/$rel/src" ] || fail "relative-import app package missing: packages/$rel/src"
    rm -rf "app/packages/$rel"
    mkdir -p "app/packages/$rel"
    cp -R "$REPO_SRC/packages/$rel/src" "app/packages/$rel/src"
  done
  for d in "$REPO_SRC"/bundle-* "$REPO_SRC"/profile-*; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    mkdir -p "app/$name"
    cp "$d/package.json" "app/$name/package.json"
    [ ! -f "$d/cordis.patch.yml" ] || cp "$d/cordis.patch.yml" "app/$name/cordis.patch.yml"
  done
  # Official 943-954 source TOCTOU equivalence; recorder separately manifests
  # every selected source byte and records full post-dependency provenance.
  [ "$(source_stamp "$REPO_SRC")" = "$PRE_PACK_STAMP" ] || fail 'candidate source changed during pack'
  git_ro -C "$REPO_SRC" diff --quiet --no-ext-diff --no-textconv || fail 'candidate tracked bytes changed during pack'
  [ -f app/packages/agent-definition/package.json ] && [ -d app/packages/agent-definition/src ] || fail 'agent-definition closure missing'
  [ ! -e app/packages/agent-registry ] || fail 'retired agent-registry present'
  for need in \
    app/packages/production-runtime/package.json \
    app/packages/production-runtime/src/entry.js \
    app/packages/agent-provisioning/package.json \
    app/profile-production/package.json \
    app/profile-production/cordis.patch.yml \
    app/scripts/production-runtime.mjs \
    app/scripts/production-runtime-launchd.mjs \
    app/scripts/production-agent-provision.mjs; do
    [ -e "$need" ] || fail "production-runtime closure missing: $need"
  done
  # Official 988-993: full @deepseek-ai scope farm, entirely inside this root.
  ln -s ../../harness/node_modules/.pnpm/node_modules/@deepseek-ai app/node_modules/@deepseek-ai
  [ -d app/node_modules/@deepseek-ai ] || fail 'official @deepseek-ai bridge broken'
  # Official 1004-1013: visible top-level third-party dev dependency surface.
  for dep in "$MAIN_REPO"/node_modules/*/; do
    name="$(basename "$dep")"
    case "$name" in @deepseek-ai|@agent-core|node_modules) continue;; esac
    [ -e "$dep" ] || continue
    cp -RL "$dep" "app/node_modules/$name"
  done
  [ -d app/node_modules/@larksuiteoapi ] && [ -d app/node_modules/croner ] || fail 'third-party app deps incomplete'
  # Official 1028-1031: deterministic vendor override wins after ambient copy.
  rm -rf app/node_modules/proxy-agent-negotiate
  cp -RL "$REPO_SRC/vendor/proxy-agent-negotiate" app/node_modules/proxy-agent-negotiate
  [ "$(source_stamp "$MAIN_REPO")" = "$PRE_MAIN_STAMP" ] || fail 'MAIN_REPO source stamp changed during copy'
  git_ro -C "$MAIN_REPO" diff --quiet --no-ext-diff --no-textconv || fail 'MAIN_REPO tracked bytes changed during copy'
}

check_inputs
if [ "$MODE" = --check ]; then echo 'CHECK_PASS_ONLY_NO_ASSEMBLY'; exit 0; fi
PRE_PACK_STAMP="$(source_stamp "$REPO_SRC")"
PRE_MAIN_STAMP="$(source_stamp "$MAIN_REPO")"
export HOME="$OUT/build-home" TMPDIR="$OUT/build-tmp" XDG_CACHE_HOME="$OUT/build-cache"
export COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_DISABLE_COMPILE_CACHE=1 CI=1
mkdir -p "$HOME" "$TMPDIR" "$XDG_CACHE_HOME"
assemble_app
# No app pnpm/workspace/lock step exists in the official installer. Source mode
# reconciliation and official gates are deliberately sequenced by the recorder
# before canary or either boot. Existing harness, Node, config and home reused.
echo 'APP_ASSEMBLED_ONLY_MODE_RECONCILIATION_OFFICIAL_GATES_CANARY_DUAL_BOOT_PENDING'
