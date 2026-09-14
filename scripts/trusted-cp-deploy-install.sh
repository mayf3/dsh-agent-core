#!/bin/bash
# trusted-cp-deploy-install.sh — TRUSTED_CONTROL_PLANE_DEPLOYMENT_HARDENING_V1
# Re-runnable root install of the trusted closure. Development sources remain
# uid-502-writable; all pre-drop execution bytes are materialized under the
# protected trusted root with the ownership checks below.
# Usage (run as root):
#   sudo ./scripts/trusted-cp-deploy-install.sh [REPO_SRC] [HARNESS_SRC]
set -euo pipefail

if [ "$(id -u)" != "0" ]; then
  echo "ERROR: must run as root (sudo ./scripts/trusted-cp-deploy-install.sh)" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# AGENT_CORE_BACKUP_RETENTION_V1 filesystem helper; no runtime semantics.
BACKUP_OPS="$SCRIPT_DIR/agent-core-backup-ops.sh"
SOURCE_GIT_STAMP="$SCRIPT_DIR/lib/trusted-source-git-stamp.sh"
PNPM_RESOLVER="$SCRIPT_DIR/lib/trusted-pnpm-resolver.sh"
REPO_SRC="${1:-$(dirname "$SCRIPT_DIR")}"
HARNESS_SRC="${2:-/Users/yanfenma/workspace/github/deepseek-harness}"
# The main repo holds dev node_modules; linked worktrees do not.
MAIN_REPO="${3:-$(dirname "$REPO_SRC")/dsh-agent-core}"
TRUSTED_ROOT=/usr/local/libexec/agent-core
HELPER=/usr/local/libexec/dsh-agent-spawn-helper
AUTHSVC_UID=505
AUTHSVC_GID=601
CHILD_UID=502
CHILD_GID=20

pnpm_preflight_fail() {
  echo "PNPM_PREFLIGHT_FAILED: $*" >&2
  echo "PRODUCTION_BACKUP_CREATED=NO" >&2
  echo "ACTIVE_ROOT_MUTATED=NO" >&2
  echo "LAUNCHD_MUTATED=NO" >&2
  echo "PRODUCTION_MUTATION_PERFORMED=NO" >&2
  exit 2
}

echo "== trusted control-plane install =="
echo "  trusted root : $TRUSTED_ROOT"
echo "  repo source  : $REPO_SRC"
echo "  harness src  : $HARNESS_SRC"

# ---- 0. sanity -------------------------------------------------------------
[ -f "$REPO_SRC/scripts/demo-home.mjs" ] || { echo "ERROR: bad REPO_SRC: $REPO_SRC" >&2; exit 2; }
[ -f "$HARNESS_SRC/apps/cli/lib/bin.js" ] || { echo "ERROR: bad HARNESS_SRC: $HARNESS_SRC" >&2; exit 2; }
id authsvc >/dev/null 2>&1 || { echo "ERROR: user authsvc (uid 505) missing" >&2; exit 2; }

[ -x "$SOURCE_GIT_STAMP" ] || { echo "ERROR: source Git stamp helper missing/not executable: $SOURCE_GIT_STAMP" >&2; exit 2; }
HARNESS_STAMP="$($SOURCE_GIT_STAMP "$HARNESS_SRC")" || { rc=$?; echo "ERROR: Harness Git source probe failed before backup (exit $rc): $HARNESS_SRC" >&2; exit "$rc"; }
[ -x "$PNPM_RESOLVER" ] || pnpm_preflight_fail "trusted pnpm resolver missing/not executable: $PNPM_RESOLVER"
PRESERVED_SOURCE_GIT_STAMP="$(/usr/bin/mktemp /tmp/agent-core-source-git-stamp.XXXXXX)" \
  || pnpm_preflight_fail "cannot allocate preserved Git-stamp helper"
/usr/bin/install -o root -g wheel -m 700 "$SOURCE_GIT_STAMP" "$PRESERVED_SOURCE_GIT_STAMP" \
  || pnpm_preflight_fail "cannot preserve Git-stamp helper"
trap '/bin/rm -f "$PRESERVED_SOURCE_GIT_STAMP"' EXIT
PRESERVED_PNPM_RESOLVER="$(/usr/bin/mktemp /tmp/agent-core-pnpm-resolver.XXXXXX)" \
  || pnpm_preflight_fail "cannot allocate preserved pnpm resolver"
/usr/bin/install -o root -g wheel -m 700 "$PNPM_RESOLVER" "$PRESERVED_PNPM_RESOLVER" \
  || pnpm_preflight_fail "cannot preserve pnpm resolver"

# CANONICAL_DEPLOY_OFFLINE_PNPM_RESOLUTION_V1: every package-manager and Node
# admission check, plus the full offline frozen install, completes in a
# nonproduction stage before the first backup or trusted-root write.
if [ -n "${AGENT_CORE_CANONICAL_NODE_BIN:-}" ]; then
  SELECTED_NODE_BIN="$AGENT_CORE_CANONICAL_NODE_BIN"
  [ -n "${AGENT_CORE_EXPECTED_NODE_VERSION:-}" ] \
    || pnpm_preflight_fail "AGENT_CORE_EXPECTED_NODE_VERSION is required with explicit Node"
  [ -n "${AGENT_CORE_EXPECTED_NODE_ARCH:-}" ] \
    || pnpm_preflight_fail "AGENT_CORE_EXPECTED_NODE_ARCH is required with explicit Node"
  EXPECTED_NODE_VERSION="$AGENT_CORE_EXPECTED_NODE_VERSION"
  EXPECTED_NODE_ARCH="$AGENT_CORE_EXPECTED_NODE_ARCH"
else
  SELECTED_NODE_BIN="$TRUSTED_ROOT/node-runtime/bin/node"
  [ -x "$SELECTED_NODE_BIN" ] \
    || pnpm_preflight_fail "current trusted Node unavailable; explicit canonical Node inputs required"
  EXPECTED_NODE_VERSION="$($SELECTED_NODE_BIN --version)" \
    || pnpm_preflight_fail "cannot read current trusted Node version"
  EXPECTED_NODE_ARCH="$($SELECTED_NODE_BIN -p process.arch)" \
    || pnpm_preflight_fail "cannot read current trusted Node architecture"
fi

PNPM_PREFLIGHT_ROOT="$(/usr/bin/mktemp -d /tmp/agent-core-pnpm-preflight.XXXXXX)"
cleanup_ephemeral_preflight() {
  /bin/rm -f "$PRESERVED_SOURCE_GIT_STAMP" "$PRESERVED_PNPM_RESOLVER"
  if [ -n "${PNPM_PREFLIGHT_ROOT:-}" ]; then
    case "$PNPM_PREFLIGHT_ROOT" in
      /tmp/agent-core-pnpm-preflight.*) /bin/rm -rf "$PNPM_PREFLIGHT_ROOT" ;;
      *) echo "WARNING: refusing to clean unexpected pnpm preflight path: $PNPM_PREFLIGHT_ROOT" >&2 ;;
    esac
  fi
}
trap cleanup_ephemeral_preflight EXIT
/bin/chmod 711 "$PNPM_PREFLIGHT_ROOT"
PNPM_STAGE_ROOT="$PNPM_PREFLIGHT_ROOT/stage"
PNPM_RESOLUTION_RECORD="$PNPM_PREFLIGHT_ROOT/resolution.env"
PNPM_ARGS=(
  --harness "$HARNESS_SRC"
  --node-bin "$SELECTED_NODE_BIN"
  --expected-node-version "$EXPECTED_NODE_VERSION"
  --expected-node-arch "$EXPECTED_NODE_ARCH"
  --stage-root "$PNPM_STAGE_ROOT"
  --record "$PNPM_RESOLUTION_RECORD"
  --homebrew-candidate /opt/homebrew/bin/pnpm
  --local-candidate /usr/local/bin/pnpm
)
if [ -n "${AGENT_CORE_CANONICAL_PNPM_BIN:-}" ]; then
  PNPM_ARGS+=(--configured-pnpm "$AGENT_CORE_CANONICAL_PNPM_BIN")
fi
"$PNPM_RESOLVER" "${PNPM_ARGS[@]}" \
  || { rc=$?; echo "ERROR: pnpm preflight failed before backup (exit $rc)" >&2; exit "$rc"; }

read_resolution() {
  key=$1
  count="$(/usr/bin/grep -c "^${key}=" "$PNPM_RESOLUTION_RECORD" || true)"
  [ "$count" = 1 ] || pnpm_preflight_fail "invalid frozen pnpm record key: $key"
  /usr/bin/sed -n "s/^${key}=//p" "$PNPM_RESOLUTION_RECORD"
}
RESOLVED_PNPM_BIN="$(read_resolution PNPM_BIN)"
RESOLVED_PNPM_REALPATH="$(read_resolution PNPM_REALPATH)"
RESOLVED_PNPM_VERSION="$(read_resolution PNPM_VERSION)"
RESOLUTION_SOURCE="$(read_resolution RESOLUTION_SOURCE)"
RESOLVED_NODE_BIN="$(read_resolution NODE_BIN)"
RESOLVED_NODE_REALPATH="$(read_resolution NODE_REALPATH)"
RESOLVED_NODE_VERSION="$(read_resolution NODE_VERSION)"
RESOLVED_NODE_ARCH="$(read_resolution NODE_ARCH)"
RESOLVED_NODE_FINGERPRINT="$(read_resolution NODE_FINGERPRINT)"
RESOLVED_PNPM_FINGERPRINT="$(read_resolution PNPM_FINGERPRINT)"
STAGED_HARNESS="$(read_resolution STAGED_HARNESS)"
STAGE_OWNER_UID="$(read_resolution STAGE_OWNER_UID)"
[ "$STAGED_HARNESS" = "$PNPM_STAGE_ROOT/harness" ] && [ ! -L "$PNPM_STAGE_ROOT" ] \
  && [ ! -L "$STAGED_HARNESS" ] && [ -d "$STAGED_HARNESS/node_modules" ] \
  || pnpm_preflight_fail "frozen pnpm stage identity mismatch"
[ "$STAGE_OWNER_UID" = 0 ] && [ "$(/usr/bin/stat -f '%u' "$PNPM_STAGE_ROOT")" = 0 ] \
  || pnpm_preflight_fail "preflighted Harness stage is not root-sealed"
[ "$RESOLVED_PNPM_VERSION" = 11.7.0 ] \
  || pnpm_preflight_fail "frozen pnpm version is not 11.7.0"
[ "$(/usr/bin/stat -f '%d:%i:%z:%m' "$RESOLVED_NODE_REALPATH")" = "$RESOLVED_NODE_FINGERPRINT" ] \
  || pnpm_preflight_fail "selected Node identity changed before backup"
[ "$(/usr/bin/stat -f '%d:%i:%z:%m' "$RESOLVED_PNPM_REALPATH")" = "$RESOLVED_PNPM_FINGERPRINT" ] \
  || pnpm_preflight_fail "selected pnpm identity changed before backup"
[ "$($RESOLVED_NODE_REALPATH --version)" = "$RESOLVED_NODE_VERSION" ] \
  || pnpm_preflight_fail "selected Node version changed before backup"
[ "$($RESOLVED_NODE_REALPATH -p process.arch)" = "$RESOLVED_NODE_ARCH" ] \
  || pnpm_preflight_fail "selected Node architecture changed before backup"

echo "== offline pnpm preflight complete (before production mutation) =="
echo "  PNPM_BIN          = $RESOLVED_PNPM_BIN"
echo "  PNPM_REALPATH     = $RESOLVED_PNPM_REALPATH"
echo "  PNPM_VERSION      = $RESOLVED_PNPM_VERSION"
echo "  NODE_BIN          = $RESOLVED_NODE_BIN"
echo "  NODE_REALPATH     = $RESOLVED_NODE_REALPATH"
echo "  NODE_VERSION      = $RESOLVED_NODE_VERSION"
echo "  NODE_ARCH         = $RESOLVED_NODE_ARCH"
echo "  RESOLUTION_SOURCE = $RESOLUTION_SOURCE"

# ---- 1. backup previous install (code refreshed, config preserved in .bak) --
if [ -e "$TRUSTED_ROOT" ]; then
  BAK="${TRUSTED_ROOT}.bak-$(date +%Y%m%d-%H%M%S)"
  echo "== backing up previous install -> $BAK"
  mv "$TRUSTED_ROOT" "$BAK"
  # Metadata describes the predecessor and never infers or copies an LKG.
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
# Reuse only byte-compatible heavyweight dependency closures; app is fresh.
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
     && [ "$("$BAK/node-runtime/bin/node" --version 2>/dev/null)" = "$RESOLVED_NODE_VERSION" ] \
     && [ "$("$BAK/node-runtime/bin/node" -p process.arch 2>/dev/null)" = "$RESOLVED_NODE_ARCH" ]; then
    mv "$BAK/node-runtime" "$TRUSTED_ROOT/node-runtime"
    REUSE_NODE=1
    echo "  node-runtime REUSED from $BAK (same Node $RESOLVED_NODE_VERSION/$RESOLVED_NODE_ARCH)"
  fi
fi

# ---- 2. harness closure ----------------------------------------------------
if [ "$REUSE_HARNESS" != "1" ]; then
echo "== adopting preflighted offline Harness stage -> harness/"
rmdir "$TRUSTED_ROOT/harness"
mv "$STAGED_HARNESS" "$TRUSTED_ROOT/harness"
rmdir "$TRUSTED_ROOT/.cache"
mv "$PNPM_STAGE_ROOT/cache" "$TRUSTED_ROOT/.cache"
printf '%s' "$HARNESS_STAMP" > harness/.source-stamp
fi
/bin/rm -rf "$PNPM_PREFLIGHT_ROOT"

# ---- 2b. trusted Node runtime (review blocker fix) --------------------------
# Materialize the selected Node as real trusted-root files.
echo "== copying Node runtime -> node-runtime/"
if [ "$REUSE_NODE" != "1" ]; then
NODE_CELLAR_BIN="$RESOLVED_NODE_REALPATH"
[ -x "$NODE_CELLAR_BIN" ] \
  || { echo "ERROR: frozen selected Node unavailable after backup: $NODE_CELLAR_BIN" >&2; exit 2; }
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
  # Reused closures were materialized and verified by their originating install.
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
mkdir -p app/scripts/lib
cp "$PRESERVED_SOURCE_GIT_STAMP" app/scripts/lib/trusted-source-git-stamp.sh
cp "$PRESERVED_PNPM_RESOLVER" app/scripts/lib/trusted-pnpm-resolver.sh
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

# Formal Agent Definition package is the only existence authority.
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

# Production Runtime is part of the supervised trusted app closure.
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

# @deepseek-ai resolves only through the in-root Harness farm.
ln -s ../../harness/node_modules/.pnpm/node_modules/@deepseek-ai app/node_modules/@deepseek-ai
[ -d "app/node_modules/@deepseek-ai" ] || { echo "ERROR: @deepseek-ai bridge broken" >&2; exit 2; }

# Copy third-party runtime dependencies as real files, excluding dev farms.
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
# Reinstall preserves the single Agent Definition and credential authority.
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
# Missing bindings/jobs are legal empty stores created on first boot.

# ---- 5b. 505 production root (PRODUCTION_INTEGRATION_V1, Task 3) -----------
# The authsvc runtime root links to the single trusted config authorities.
echo "== provisioning 505 production root -> /Users/authsvc/.agent-core"
PROD_ROOT=/Users/authsvc/.agent-core
mkdir -p "$PROD_ROOT"/{bindings,scheduler,workspaces,homes,control,logs}
# Runtime reads the trusted definition and credential files through links.
if [ -e "$PROD_ROOT/agents.json" ] || [ -L "$PROD_ROOT/agents.json" ]; then rm -f "$PROD_ROOT/agents.json"; fi
ln -s /usr/local/libexec/agent-core/config/agents.json "$PROD_ROOT/agents.json"
# authsvc owns control state; child workspaces/homes remain uid 502-owned.
chown "${AUTHSVC_UID}:${AUTHSVC_GID}" "$PROD_ROOT"
# Root is 0711 so uid 502 can traverse known paths but cannot list control state.
chmod 711 "$PROD_ROOT"
chown -R "${AUTHSVC_UID}:${AUTHSVC_GID}" "$PROD_ROOT/bindings" "$PROD_ROOT/scheduler" "$PROD_ROOT/control" "$PROD_ROOT/logs"
chmod -R u+rwX,go-rwx "$PROD_ROOT/bindings" "$PROD_ROOT/scheduler" "$PROD_ROOT/control" "$PROD_ROOT/logs"
chown "${CHILD_UID}:${CHILD_GID}" "$PROD_ROOT/workspaces" "$PROD_ROOT/homes"
chmod 755 "$PROD_ROOT/workspaces" "$PROD_ROOT/homes"
echo "  production root: $PROD_ROOT (505-private control state 0700; workspaces+homes 502-owned 0755-traversable; agents.json -> config/agents.json single authority)"

# ---- 6. ownership + modes ---------------------------------------------------
echo "== ownership: harness/app/home/node-runtime -> authsvc:authsvc (502 read-only)"
# Reused closures keep verified ownership; fresh copies get the full pass.
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
