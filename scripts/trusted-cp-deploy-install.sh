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
#     config/    production state: registry/bindings/jobs/credential store
#                                           owner authsvc:authsvc  0700/0600
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
#   sudo ./scripts/trusted-cp-deploy-install.sh [REPO_SRC] [HARNESS_SRC]
#   REPO_SRC    default: the repo this script lives in (feature worktree)
#   HARNESS_SRC default: /Users/yanfenma/workspace/github/deepseek-harness
#
# Verifies at the end: every symlink in the trusted tree resolves INSIDE the
# trusted root (or /usr/local/libexec), and a uid-502 spot check cannot write
# to app/, harness/, home/, config/ or the helper.
# =============================================================================
set -euo pipefail

if [ "$(id -u)" != "0" ]; then
  echo "ERROR: must run as root (sudo ./scripts/trusted-cp-deploy-install.sh)" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
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

# ---- 1. backup previous install (code refreshed, config preserved in .bak) --
if [ -e "$TRUSTED_ROOT" ]; then
  BAK="${TRUSTED_ROOT}.bak-$(date +%Y%m%d-%H%M%S)"
  echo "== backing up previous install -> $BAK"
  mv "$TRUSTED_ROOT" "$BAK"
fi

mkdir -p "$TRUSTED_ROOT"/{harness,app,home,config,.cache}
cd "$TRUSTED_ROOT"

# ---- 2. harness closure ----------------------------------------------------
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

# ---- 3. app closure (Agent Core runtime surface) ---------------------------
echo "== copying Agent Core closure -> app/"
mkdir -p app/packages app/node_modules
cp "$REPO_SRC/package.json" app/package.json
mkdir -p app/scripts
for f in agent-core-resident.mjs demo-home.mjs agentcore-cron.mjs \
         dsh-agent-spawn-helper.c trusted-cp-deploy-install.sh \
         trusted-cp-hardening-v1-verify.mjs; do
  [ -f "$REPO_SRC/scripts/$f" ] && cp "$REPO_SRC/scripts/$f" app/scripts/
done
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
    @deepseek-ai|@agent-core) continue ;;
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
  "agent-registry:../../../../app/packages/agent-registry"; do
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
printf '{\n  "version": 1,\n  "agents": {},\n  "defaultAgentId": null\n}\n' > config/registry.json
printf '{\n  "version": 1,\n  "credentials": {}\n}\n' > config/agent-credentials.json
# bindings/jobs are created by the router/resident on first boot (missing
# file is a legal empty store for both).

# ---- 6. ownership + modes ---------------------------------------------------
echo "== ownership: harness/app/home -> authsvc:authsvc (502 read-only)"
for d in harness app home; do
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
if run502 sh -c "echo pwned > '$TRUSTED_ROOT/config/registry.json'" 2>/dev/null; then
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
echo "  harness closure: $(du -sh "$TRUSTED_ROOT/harness" | cut -f1)"
echo "  app closure:     $(du -sh "$TRUSTED_ROOT/app" | cut -f1)"
echo "  control home:    $TRUSTED_ROOT/home"
echo "  config (505):    $TRUSTED_ROOT/config"
echo "  helper:          $HELPER (root:wheel 4755)"
echo
echo "Next: sudo node $TRUSTED_ROOT/app/scripts/trusted-cp-hardening-v1-verify.mjs"
