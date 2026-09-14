#!/bin/bash
# CANONICAL_DEPLOY_OFFLINE_PNPM_RESOLUTION_V1
# Resolve, prove, and stage one exact offline Harness dependency closure.
set -euo pipefail

fail() {
  echo "PNPM_PREFLIGHT_FAILED: $*" >&2
  echo "PRODUCTION_BACKUP_CREATED=NO" >&2
  echo "ACTIVE_ROOT_MUTATED=NO" >&2
  echo "LAUNCHD_MUTATED=NO" >&2
  echo "PRODUCTION_MUTATION_PERFORMED=NO" >&2
  exit 2
}

HARNESS_SRC=
SELECTED_NODE_BIN=
EXPECTED_NODE_VERSION=
EXPECTED_NODE_ARCH=
STAGE_ROOT=
RECORD_PATH=
CONFIGURED_PNPM=
HOMEBREW_CANDIDATE=/opt/homebrew/bin/pnpm
LOCAL_CANDIDATE=/usr/local/bin/pnpm
PROBE_TIMEOUT=15
INSTALL_TIMEOUT=1800

while [ "$#" -gt 0 ]; do
  case "$1" in
    --harness) HARNESS_SRC=${2:-}; shift 2 ;;
    --node-bin) SELECTED_NODE_BIN=${2:-}; shift 2 ;;
    --expected-node-version) EXPECTED_NODE_VERSION=${2:-}; shift 2 ;;
    --expected-node-arch) EXPECTED_NODE_ARCH=${2:-}; shift 2 ;;
    --stage-root) STAGE_ROOT=${2:-}; shift 2 ;;
    --record) RECORD_PATH=${2:-}; shift 2 ;;
    --configured-pnpm) CONFIGURED_PNPM=${2:-}; shift 2 ;;
    --homebrew-candidate) HOMEBREW_CANDIDATE=${2:-}; shift 2 ;;
    --local-candidate) LOCAL_CANDIDATE=${2:-}; shift 2 ;;
    --timeout-seconds)
      PROBE_TIMEOUT=${2:-}
      INSTALL_TIMEOUT=${2:-}
      shift 2
      ;;
    --probe-timeout-seconds) PROBE_TIMEOUT=${2:-}; shift 2 ;;
    --install-timeout-seconds) INSTALL_TIMEOUT=${2:-}; shift 2 ;;
    *) fail "unknown argument: $1" ;;
  esac
done

for required in HARNESS_SRC SELECTED_NODE_BIN EXPECTED_NODE_VERSION EXPECTED_NODE_ARCH STAGE_ROOT RECORD_PATH; do
  value=${!required}
  [ -n "$value" ] || fail "missing required input: $required"
  case "$value" in *$'\n'*|*$'\r'*) fail "multiline input rejected: $required" ;; esac
done
for candidate_input in "$CONFIGURED_PNPM" "$HOMEBREW_CANDIDATE" "$LOCAL_CANDIDATE"; do
  case "$candidate_input" in *$'\n'*|*$'\r'*) fail 'multiline pnpm candidate rejected' ;; esac
done
case "$PROBE_TIMEOUT:$INSTALL_TIMEOUT" in
  *[!0-9:]*|0:*|*:0) fail 'timeouts must be positive integers' ;;
esac
case "$EXPECTED_NODE_VERSION" in
  v[0-9]*.[0-9]*.[0-9]*) ;;
  *) fail "invalid expected Node version: $EXPECTED_NODE_VERSION" ;;
esac
case "$EXPECTED_NODE_ARCH" in
  arm64|x64) ;;
  *) fail "invalid expected Node architecture: $EXPECTED_NODE_ARCH" ;;
esac

[ -d "$HARNESS_SRC" ] || fail "Harness source unavailable: $HARNESS_SRC"
HARNESS_SRC="$(cd "$HARNESS_SRC" && pwd -P)" || fail "cannot resolve Harness source: $HARNESS_SRC"
[ -f "$HARNESS_SRC/package.json" ] || fail "Harness package.json unavailable: $HARNESS_SRC"
[ ! -e "$STAGE_ROOT" ] || fail "stage root must not exist: $STAGE_ROOT"
[ ! -e "$RECORD_PATH" ] || fail "resolution record must not exist: $RECORD_PATH"
case "$STAGE_ROOT" in
  /usr/local/libexec/*|/Users/authsvc/.agent-core/*|/Library/LaunchDaemons/*)
    fail "stage root is inside a production path: $STAGE_ROOT" ;;
esac
case "$RECORD_PATH" in
  /usr/local/libexec/*|/Users/authsvc/.agent-core/*|/Library/LaunchDaemons/*)
    fail "resolution record is inside a production path: $RECORD_PATH" ;;
esac

realpath_of() {
  /usr/bin/perl -MCwd=abs_path -e '$p=abs_path(shift); defined($p) or exit 2; print $p' "$1"
}

SOURCE_UID="$(/usr/bin/stat -f '%u' "$HARNESS_SRC")" || fail "cannot determine Harness source owner"
SOURCE_GID="$(/usr/bin/stat -f '%g' "$HARNESS_SRC")" || fail "cannot determine Harness source group"
SOURCE_PASSWD="$(/usr/bin/id -P "$SOURCE_UID")" || fail "cannot resolve source owner uid $SOURCE_UID"
SOURCE_HOME="$(printf '%s\n' "$SOURCE_PASSWD" | /usr/bin/awk -F: '{print $9}')"
[ -n "$SOURCE_HOME" ] && [ -d "$SOURCE_HOME" ] || fail "source owner home unavailable for uid $SOURCE_UID"
CALLER_UID="$(/usr/bin/id -u)"
if [ "$CALLER_UID" != "$SOURCE_UID" ] && [ "$CALLER_UID" != 0 ]; then
  fail "caller uid $CALLER_UID cannot run package-manager work as source owner uid $SOURCE_UID"
fi
if [ "$CALLER_UID" = 0 ] && [ "$SOURCE_UID" = 0 ]; then
  fail "root-owned Harness is not eligible for source-owner package-manager execution"
fi

mkdir -p "$(dirname "$STAGE_ROOT")" "$(dirname "$RECORD_PATH")"
CONTROL_ROOT="$(/usr/bin/mktemp -d "$(dirname "$STAGE_ROOT")/trusted-pnpm-control.XXXXXX")"
SOURCE_TMP="$(/usr/bin/mktemp -d "$(dirname "$STAGE_ROOT")/trusted-pnpm-source.XXXXXX")"
/bin/chmod 700 "$CONTROL_ROOT" "$SOURCE_TMP"
/usr/sbin/chown "$SOURCE_UID:$SOURCE_GID" "$SOURCE_TMP" 2>/dev/null || true
CREATED_STAGE=0
SUCCESS=0
cleanup() {
  /bin/rm -rf "$CONTROL_ROOT" "$SOURCE_TMP"
  if [ "$SUCCESS" != 1 ]; then
    [ "$CREATED_STAGE" = 1 ] && /bin/rm -rf "$STAGE_ROOT"
    /bin/rm -f "$RECORD_PATH"
  fi
}
trap cleanup EXIT
trap 'exit 2' HUP INT TERM

run_as_source() {
  if [ "$CALLER_UID" = "$SOURCE_UID" ]; then
    /usr/bin/env -i HOME="$SOURCE_HOME" PATH=/usr/bin:/bin \
      TMPDIR="$SOURCE_TMP" COREPACK_ENABLE_NETWORK=0 "$@"
  else
    /usr/bin/sudo -u "#$SOURCE_UID" /usr/bin/env -i \
      HOME="$SOURCE_HOME" PATH=/usr/bin:/bin TMPDIR="$SOURCE_TMP" \
      COREPACK_ENABLE_NETWORK=0 "$@"
  fi
}

bounded_as_source() {
  seconds=$1
  stdout_path=$2
  stderr_path=$3
  shift 3
  set +e
  run_as_source /usr/bin/perl -e 'alarm shift; exec @ARGV' "$seconds" "$@" \
    >"$stdout_path" 2>"$stderr_path"
  BOUNDED_RC=$?
  set -e
}

NODE_REALPATH="$(realpath_of "$SELECTED_NODE_BIN")" || fail "selected Node unavailable: $SELECTED_NODE_BIN"
[ -x "$NODE_REALPATH" ] || fail "selected Node is not executable: $NODE_REALPATH"
NODE_FINGERPRINT="$(/usr/bin/stat -f '%d:%i:%z:%m' "$NODE_REALPATH")" || fail "cannot fingerprint selected Node"
bounded_as_source "$PROBE_TIMEOUT" "$CONTROL_ROOT/node.out" "$CONTROL_ROOT/node.err" \
  "$NODE_REALPATH" -p 'process.version+"\n"+process.arch'
if [ "$BOUNDED_RC" -ne 0 ]; then
  /bin/cat "$CONTROL_ROOT/node.err" >&2
  [ "$BOUNDED_RC" -eq 142 ] && fail "selected Node probe timed out after ${PROBE_TIMEOUT}s"
  fail "selected Node probe failed (exit $BOUNDED_RC)"
fi
NODE_VERSION="$(/usr/bin/sed -n '1p' "$CONTROL_ROOT/node.out")"
NODE_ARCH="$(/usr/bin/sed -n '2p' "$CONTROL_ROOT/node.out")"
[ "$NODE_VERSION" = "$EXPECTED_NODE_VERSION" ] \
  || fail "Node version mismatch: expected $EXPECTED_NODE_VERSION actual $NODE_VERSION"
[ "$NODE_ARCH" = "$EXPECTED_NODE_ARCH" ] \
  || fail "Node architecture mismatch: expected $EXPECTED_NODE_ARCH actual $NODE_ARCH"

bounded_as_source "$PROBE_TIMEOUT" "$CONTROL_ROOT/declaration.out" "$CONTROL_ROOT/declaration.err" \
  "$NODE_REALPATH" -e '
    const fs=require("node:fs");
    const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).packageManager;
    if(typeof value!=="string" || !/^pnpm@[0-9]+\.[0-9]+\.[0-9]+$/.test(value)) process.exit(64);
    process.stdout.write(value.slice(5));
  ' "$HARNESS_SRC/package.json"
if [ "$BOUNDED_RC" -ne 0 ]; then
  /bin/cat "$CONTROL_ROOT/declaration.err" >&2
  fail "Harness packageManager must be exact pnpm@<semver>"
fi
DECLARED_PNPM_VERSION="$(/bin/cat "$CONTROL_ROOT/declaration.out")"
[ "$DECLARED_PNPM_VERSION" = 11.7.0 ] \
  || fail "Harness packageManager is not repository-authorized pnpm@11.7.0: $DECLARED_PNPM_VERSION"

PNPM_BIN=
PNPM_REALPATH=
PNPM_VERSION=
RESOLUTION_SOURCE=
SEEN_REALPATHS=
try_candidate() {
  candidate=$1
  source=$2
  [ -e "$candidate" ] || return 1
  canonical="$(realpath_of "$candidate")" || { echo "pnpm candidate cannot resolve: $candidate" >&2; return 1; }
  case $'\n'"$SEEN_REALPATHS"$'\n' in
    *$'\n'"$canonical"$'\n'*)
      echo "pnpm candidate duplicate realpath skipped: $candidate -> $canonical" >&2
      return 1 ;;
  esac
  SEEN_REALPATHS="${SEEN_REALPATHS}${SEEN_REALPATHS:+$'\n'}${canonical}"
  [ -f "$canonical" ] && [ -x "$canonical" ] \
    || { echo "pnpm candidate is not an executable file: $candidate" >&2; return 1; }
  case "$canonical" in
    */corepack/*|*/Corepack/*)
      echo "pnpm candidate rejected: Corepack shim/distribution is not offline-safe: $candidate -> $canonical" >&2
      return 1 ;;
  esac
  bounded_as_source "$PROBE_TIMEOUT" "$CONTROL_ROOT/distribution.out" "$CONTROL_ROOT/distribution.err" \
    "$NODE_REALPATH" -e '
      const fs=require("node:fs"), path=require("node:path");
      const entry=fs.realpathSync(process.argv[1]); let dir=path.dirname(entry);
      for(let depth=0; depth<8; depth++,dir=path.dirname(dir)) {
        const manifest=path.join(dir,"package.json");
        if(!fs.existsSync(manifest)) continue;
        const p=JSON.parse(fs.readFileSync(manifest,"utf8"));
        const rel=typeof p.bin==="string" ? p.bin : p.bin?.pnpm;
        if(p.name!=="pnpm" || typeof rel!=="string") process.exit(65);
        if(fs.realpathSync(path.resolve(dir,rel))!==entry) process.exit(66);
        process.stdout.write(dir); process.exit(0);
      }
      process.exit(67);
    ' "$canonical" "$DECLARED_PNPM_VERSION"
  if [ "$BOUNDED_RC" -ne 0 ]; then
    /bin/cat "$CONTROL_ROOT/distribution.err" >&2
    echo "pnpm candidate is not a direct declared pnpm distribution: $candidate" >&2
    return 1
  fi
  bounded_as_source "$PROBE_TIMEOUT" "$CONTROL_ROOT/pnpm.out" "$CONTROL_ROOT/pnpm.err" \
    "$NODE_REALPATH" "$canonical" --version
  if [ "$BOUNDED_RC" -ne 0 ]; then
    /bin/cat "$CONTROL_ROOT/pnpm.err" >&2
    if [ "$BOUNDED_RC" -eq 142 ]; then
      echo "pnpm candidate version probe timed out after ${PROBE_TIMEOUT}s: $candidate" >&2
    else
      echo "pnpm candidate version probe failed (exit $BOUNDED_RC): $candidate" >&2
    fi
    return 1
  fi
  actual="$($NODE_REALPATH -e '
    const fs=require("node:fs"), value=fs.readFileSync(process.argv[1],"utf8");
    if(!/^[0-9]+\.[0-9]+\.[0-9]+\n?$/.test(value)) process.exit(64);
    process.stdout.write(value.trimEnd());
  ' "$CONTROL_ROOT/pnpm.out")" || {
    echo "pnpm candidate returned malformed version: $candidate" >&2
    return 1
  }
  if [ "$actual" != "$DECLARED_PNPM_VERSION" ]; then
    echo "pnpm version mismatch: expected $DECLARED_PNPM_VERSION actual $actual ($candidate)" >&2
    return 1
  fi
  PNPM_BIN=$candidate
  PNPM_REALPATH=$canonical
  PNPM_VERSION=$actual
  RESOLUTION_SOURCE=$source
  return 0
}

if [ -n "$CONFIGURED_PNPM" ]; then
  try_candidate "$CONFIGURED_PNPM" EXPLICIT_CONFIG \
    || fail "configured pnpm candidate unavailable or rejected: $CONFIGURED_PNPM"
else
  if try_candidate "$HOMEBREW_CANDIDATE" HOMEBREW_PREFIX; then :
  elif try_candidate "$LOCAL_CANDIDATE" USR_LOCAL; then :
  else fail 'no local canonical pnpm candidate passed admission'
  fi
fi
PNPM_FINGERPRINT="$(/usr/bin/stat -f '%d:%i:%z:%m' "$PNPM_REALPATH")" || fail "cannot fingerprint pnpm"

/bin/mkdir "$SOURCE_TMP/stage" "$SOURCE_TMP/stage/harness" "$SOURCE_TMP/stage/cache"
/usr/bin/tar -C "$HARNESS_SRC" -cf - \
  --exclude='node_modules' --exclude='.git' --exclude='.worktree*' \
  --exclude='.turbo' --exclude='dist' --exclude='lib/*.tsbuildinfo' . \
  | /usr/bin/tar -C "$SOURCE_TMP/stage/harness" -xf -
/usr/sbin/chown -R "$SOURCE_UID:$SOURCE_GID" "$SOURCE_TMP/stage" 2>/dev/null || true

old_pwd=$PWD
cd "$SOURCE_TMP/stage/harness"
bounded_as_source "$INSTALL_TIMEOUT" "$CONTROL_ROOT/install.out" "$CONTROL_ROOT/install.err" \
  "$NODE_REALPATH" "$PNPM_REALPATH" install --offline --frozen-lockfile --ignore-scripts \
  --config.package-import-method=copy --cache-dir "$SOURCE_TMP/stage/cache"
cd "$old_pwd"
if [ "$BOUNDED_RC" -ne 0 ]; then
  /bin/cat "$CONTROL_ROOT/install.err" >&2
  [ "$BOUNDED_RC" -eq 142 ] && fail "offline pnpm install timed out after ${INSTALL_TIMEOUT}s"
  fail "offline pnpm install failed (exit $BOUNDED_RC)"
fi

[ "$(realpath_of "$SELECTED_NODE_BIN" 2>/dev/null || true)" = "$NODE_REALPATH" ] \
  || fail 'selected Node realpath changed during preflight'
[ "$(/usr/bin/stat -f '%d:%i:%z:%m' "$NODE_REALPATH" 2>/dev/null || true)" = "$NODE_FINGERPRINT" ] \
  || fail 'selected Node identity changed during preflight'
[ "$(realpath_of "$PNPM_BIN" 2>/dev/null || true)" = "$PNPM_REALPATH" ] \
  || fail 'pnpm realpath changed during preflight'
[ "$(/usr/bin/stat -f '%d:%i:%z:%m' "$PNPM_REALPATH" 2>/dev/null || true)" = "$PNPM_FINGERPRINT" ] \
  || fail 'pnpm identity changed during preflight'

bounded_as_source "$PROBE_TIMEOUT" "$CONTROL_ROOT/node-recheck.out" "$CONTROL_ROOT/node-recheck.err" \
  "$NODE_REALPATH" -p 'process.version+"\n"+process.arch'
if [ "$BOUNDED_RC" -ne 0 ]; then
  /bin/cat "$CONTROL_ROOT/node-recheck.err" >&2
  fail 'selected Node revalidation failed'
fi
/usr/bin/cmp -s "$CONTROL_ROOT/node.out" "$CONTROL_ROOT/node-recheck.out" \
  || fail 'selected Node version or architecture changed during preflight'

bounded_as_source "$PROBE_TIMEOUT" "$CONTROL_ROOT/recheck.out" "$CONTROL_ROOT/recheck.err" \
  "$NODE_REALPATH" "$PNPM_REALPATH" --version
if [ "$BOUNDED_RC" -ne 0 ] || ! /usr/bin/cmp -s "$CONTROL_ROOT/pnpm.out" "$CONTROL_ROOT/recheck.out"; then
  /bin/cat "$CONTROL_ROOT/recheck.err" >&2
  fail 'pnpm version changed during preflight'
fi

# Freeze by copying, never by adopting the source-owned stage. `cp -R`
# preserves links rather than following them. The protected copy admits only
# files, directories, and links that resolve back inside that protected copy.
/bin/mkdir "$STAGE_ROOT"
CREATED_STAGE=1
/bin/mkdir "$STAGE_ROOT/harness" "$STAGE_ROOT/cache"
STAGE_REALPATH="$(realpath_of "$STAGE_ROOT")" || fail 'cannot canonicalize protected stage'
/bin/cp -R "$SOURCE_TMP/stage/harness/." "$STAGE_ROOT/harness/"
/bin/cp -R "$SOURCE_TMP/stage/cache/." "$STAGE_ROOT/cache/"
PROTECTED_REDIRECT="$(/usr/bin/find "$STAGE_ROOT" ! -type f ! -type d ! -type l -print -quit)"
[ -z "$PROTECTED_REDIRECT" ] || fail "redirected/special protected stage entry: $PROTECTED_REDIRECT"
while IFS= read -r protected_link; do
  protected_target="$(realpath_of "$protected_link")" \
    || fail "broken link in protected stage: $protected_link"
  case "$protected_target" in
    "$STAGE_REALPATH"/*) ;;
    *) fail "link escapes protected stage: $protected_link -> $protected_target" ;;
  esac
done < <(/usr/bin/find "$STAGE_ROOT" -type l -print)
if [ "$CALLER_UID" = 0 ]; then
  /usr/sbin/chown -R -h 0:0 "$STAGE_ROOT"
fi
/usr/bin/find "$STAGE_ROOT" -type d -exec /bin/chmod u+rwx,go+rx,go-w {} +
/usr/bin/find "$STAGE_ROOT" -type f -exec /bin/chmod u+rw,go+r,go-w {} +

[ "$(/usr/bin/stat -f '%u' "$HARNESS_SRC")" = "$SOURCE_UID" ] \
  || fail 'Harness source uid changed during preflight'
bounded_as_source "$PROBE_TIMEOUT" "$CONTROL_ROOT/frozen-declaration.out" "$CONTROL_ROOT/frozen-declaration.err" \
  "$NODE_REALPATH" -e '
    const fs=require("node:fs");
    const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")).packageManager;
    if(typeof value!=="string" || !/^pnpm@[0-9]+\.[0-9]+\.[0-9]+$/.test(value)) process.exit(64);
    process.stdout.write(value.slice(5));
  ' "$STAGE_ROOT/harness/package.json"
[ "$BOUNDED_RC" -eq 0 ] || fail 'frozen Harness declaration cannot be revalidated'
[ "$(/bin/cat "$CONTROL_ROOT/frozen-declaration.out")" = "$DECLARED_PNPM_VERSION" ] \
  || fail 'Harness packageManager changed during install'

STAGE_OWNER_UID="$(/usr/bin/stat -f '%u' "$STAGE_ROOT")"

record_tmp="$CONTROL_ROOT/resolution.env"
{
  printf 'DECLARED_PACKAGE_MANAGER=pnpm@%s\n' "$DECLARED_PNPM_VERSION"
  printf 'DECLARED_PNPM_VERSION=%s\n' "$DECLARED_PNPM_VERSION"
  printf 'PNPM_BIN=%s\n' "$PNPM_BIN"
  printf 'PNPM_REALPATH=%s\n' "$PNPM_REALPATH"
  printf 'PNPM_VERSION=%s\n' "$PNPM_VERSION"
  printf 'RESOLUTION_SOURCE=%s\n' "$RESOLUTION_SOURCE"
  printf 'NODE_BIN=%s\n' "$SELECTED_NODE_BIN"
  printf 'NODE_REALPATH=%s\n' "$NODE_REALPATH"
  printf 'NODE_VERSION=%s\n' "$NODE_VERSION"
  printf 'NODE_ARCH=%s\n' "$NODE_ARCH"
  printf 'SOURCE_UID=%s\n' "$SOURCE_UID"
  printf 'NODE_FINGERPRINT=%s\n' "$NODE_FINGERPRINT"
  printf 'PNPM_FINGERPRINT=%s\n' "$PNPM_FINGERPRINT"
  printf 'STAGE_ROOT=%s\n' "$STAGE_ROOT"
  printf 'STAGED_HARNESS=%s\n' "$STAGE_ROOT/harness"
  printf 'STAGE_OWNER_UID=%s\n' "$STAGE_OWNER_UID"
} > "$record_tmp"
/bin/chmod 600 "$record_tmp"
/usr/bin/install -m 600 "$record_tmp" "$RECORD_PATH"
SUCCESS=1
echo "PNPM_PREFLIGHT=PASS"
