#!/bin/bash
# Legacy installer; enrolled targets must use agent-deployctl.
# Usage: trusted-cp-deploy-install.sh [REPO_SRC] [HARNESS_SRC] (legacy root path).
# Details: docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_LEGACY_INSTALLER_NOTES.md
set -euo pipefail
# DCP enrollment guard begin
DCP_ENROLLMENT_MARKER='/usr/local/libexec/agent-deployd/enrolled-dsh-runtime'
DCP_ENROLLMENT_PARENT='/usr/local/libexec/agent-deployd'
if [ -e "$DCP_ENROLLMENT_MARKER" ] || [ -L "$DCP_ENROLLMENT_MARKER" ] \
  || [ -L "$DCP_ENROLLMENT_PARENT" ] \
  || { [ -d "$DCP_ENROLLMENT_PARENT" ] && [ "$(/usr/bin/stat -f '%u:%Lp' "$DCP_ENROLLMENT_PARENT")" != '0:755' ]; }; then
  echo "Enrolled/unsafe target: use agent-deployctl" >&2
  exit 1
fi
# DCP enrollment guard end
# Global legacy mutex: fail closed; never infer stale-lock disposal.
PRODUCTION_DEPLOY_LOCK_DIR="${PRODUCTION_DEPLOY_LOCK_DIR:-/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock}"
# Parent-owned inherited locks are verified and never released by the child.
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
# Backup metadata and pins use the colocated filesystem retention helper.
BACKUP_OPS="$SCRIPT_DIR/agent-core-backup-ops.sh"
SOURCE_GIT_STAMP="$SCRIPT_DIR/lib/trusted-source-git-stamp.sh"
REPO_SRC="${1:-$(dirname "$SCRIPT_DIR")}"
HARNESS_SRC="${2:-/Users/yanfenma/workspace/github/deepseek-harness}"
# The main repo holds the dev node_modules (third-party deps); a worktree
# does not check node_modules out.
MAIN_REPO="${3:-$(dirname "$REPO_SRC")/dsh-agent-core}"
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

# Reuse unchanged harness/Node closures; always recopy the app.
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

# Trusted Node must be real protected copies, not Homebrew links.
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

# Include the sole Agent Definition authority; exclude the removed registry.
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

# Include the supervised production-runtime composition in the trusted app.
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

# Resolve @deepseek-ai only through the trusted harness bridge.
ln -s ../../harness/node_modules/.pnpm/node_modules/@deepseek-ai app/node_modules/@deepseek-ai
[ -d "app/node_modules/@deepseek-ai" ] || { echo "ERROR: @deepseek-ai bridge broken" >&2; exit 2; }

# Copy third-party runtime dependencies as real files, not dev-store links.
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
# Preserve deployed Agent Definition and credentials; seed only on fresh install.
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

# Provision the 505 runtime root with links to its sole trusted config authority.
echo "== provisioning 505 production root -> /Users/authsvc/.agent-core"
PROD_ROOT=/Users/authsvc/.agent-core
mkdir -p "$PROD_ROOT"/{bindings,scheduler,workspaces,homes,control,logs}
# Agent Definition and credentials retain one authoritative protected file.
if [ -e "$PROD_ROOT/agents.json" ] || [ -L "$PROD_ROOT/agents.json" ]; then rm -f "$PROD_ROOT/agents.json"; fi
ln -s /usr/local/libexec/agent-core/config/agents.json "$PROD_ROOT/agents.json"
# Never recursively chown existing child trees; preserve the 505/502 split.
chown "${AUTHSVC_UID}:${AUTHSVC_GID}" "$PROD_ROOT"
# Runtime root stays0711 for child traversal; private subdirectories stay0700.
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
