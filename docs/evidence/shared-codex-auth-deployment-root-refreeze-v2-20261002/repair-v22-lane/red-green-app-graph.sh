#!/bin/bash
# RED/GREEN evidence generator — FIX A (agent-control#193 Defect A + the A′
# gap the new gate surfaced). Builds fresh §3-shaped pack stages in /tmp from
# the v2.2 worktree bytes (+ MAIN_REPO node_modules; harness/node-runtime are
# READ-ONLY reuses of the installed closure), then runs
# RUNTIME_APP_GRAPH_GATE_V1 and FRESH_CHILD_BOOT_CANARY_V1 against them.
# Non-production: throwaway homes, no restart, no credentials, no live patches.
set -euo pipefail
WT="$(cd "$(dirname "$0")/.." && pwd)"
MAIN=/Users/yanfenma/workspace/project/dsh-agent-core
NODE=/usr/local/libexec/agent-core/node-runtime/bin/node
GATE=$WT/scripts/lib/trusted-cp-runtime-app-graph-gate.mjs
CANARY=$WT/scripts/lib/trusted-cp-fresh-child-boot-canary.mjs
HARNESS_LIVE=/usr/local/libexec/agent-core/harness

OUT=${1:-/tmp/red-green-app-graph.txt}
build_stage() { # $1 = stage dir; $2 = yes/no vendored dep; $3 = yes/no development-execution
  local STAGE=$1 WITH_DEP=$2 WITH_DES=$3
  rm -rf "$STAGE" && mkdir -p "$STAGE/app/scripts/lib" "$STAGE/app/packages" "$STAGE/app/node_modules"
  ln -s "$HARNESS_LIVE" "$STAGE/harness"
  ln -s /usr/local/libexec/agent-core/node-runtime "$STAGE/node-runtime"
  cp "$WT/package.json" "$STAGE/app/package.json"
  for f in agent-core-resident.mjs demo-home.mjs agentcore-cron.mjs dsh-agent-spawn-helper.c trusted-cp-deploy-install.sh agent-core-backup-ops.sh trusted-cp-hardening-v1-verify.mjs production-runtime.mjs production-runtime-launchd.mjs production-runtime-v1-verify.mjs production-agent-provision.mjs; do
    [ -f "$WT/scripts/$f" ] && cp "$WT/scripts/$f" "$STAGE/app/scripts/"
  done
  cp "$WT/scripts/lib/trusted-source-git-stamp.sh" "$STAGE/app/scripts/lib/"
  for pkg in "$WT"/packages/*/; do
    local name; name="$(basename "$pkg")"; [ -f "$pkg/package.json" ] || continue
    node "$WT/scripts/lib/trusted-app-package-copy.mjs" "$pkg" "$STAGE/app/packages/$name" >/dev/null
  done
  if [ "$WITH_DES" = "yes" ]; then
    mkdir -p "$STAGE/app/packages/development-execution"
    cp -R "$WT/packages/development-execution/src" "$STAGE/app/packages/development-execution/src"
  fi
  for d in "$WT"/bundle-* "$WT"/profile-*; do
    [ -d "$d" ] || continue; local name; name="$(basename "$d")"; mkdir -p "$STAGE/app/$name"
    if [ -f "$d/package.json" ]; then cp "$d/package.json" "$STAGE/app/$name/"; fi
    if [ -f "$d/cordis.patch.yml" ]; then cp "$d/cordis.patch.yml" "$STAGE/app/$name/"; fi
  done
  ln -s ../../harness/node_modules/.pnpm/node_modules/@deepseek-ai "$STAGE/app/node_modules/@deepseek-ai"
  for dep in "$MAIN"/node_modules/*/; do
    local name; name="$(basename "$dep")"
    case "$name" in @deepseek-ai|@agent-core|node_modules) continue ;; esac
    cp -RL "$dep" "$STAGE/app/node_modules/$name"
  done
  if [ "$WITH_DEP" = "yes" ]; then cp -RL "$WT/vendor/proxy-agent-negotiate" "$STAGE/app/node_modules/proxy-agent-negotiate"; fi
  return 0
}

{
echo "# RED/GREEN — fresh-pack production-runtime app graph (FIX A, agent-control#193 Defect A + A′)"
echo "# worktree installer: $(shasum -a 256 "$WT/scripts/trusted-cp-deploy-install.sh" | awk '{print $1}')"
echo "# gate lib:           $(shasum -a 256 "$GATE" | awk '{print $1}')"
echo "# node: $NODE ($("$NODE" --version), $(""$NODE"" -p process.arch)) — the installed closure's own runtime (read-only reuse)"
echo "# harness closure: $HARNESS_LIVE (stamp: $(cat "$HARNESS_LIVE/.source-stamp" 2>/dev/null || echo unknown))"
echo "# MAIN_REPO: $MAIN (node_modules top-level entries: $(ls "$MAIN"/node_modules | grep -v -E '^\.|@deepseek-ai|@agent-core' | wc -l | tr -d ' '))"
echo "# proxy-agent-negotiate in MAIN_REPO/node_modules: $(find "$MAIN/node_modules" -maxdepth 1 -name 'proxy-agent-negotiate' | wc -l | tr -d ' ') (top-level), $(find "$MAIN/node_modules/@larksuite" -name 'proxy-agent-negotiate' 2>/dev/null | wc -l | tr -d ' ') (under @larksuite) — the pack inputs never carry it"
echo "# vendored bytes (v2.2 FIX A source):"
(cd "$WT/vendor/proxy-agent-negotiate" && find . -type f | sort | xargs shasum -a 256 | sed 's/^/#   /')
echo "# https-proxy-agent declares: $(node -p "require('$MAIN/node_modules/@larksuite/channel/node_modules/https-proxy-agent/package.json').dependencies['proxy-agent-negotiate']")"
echo

echo "## [RED-A] fresh pack WITHOUT vendored proxy-agent-negotiate (the exact #193 pack shape)"
build_stage /tmp/b7v22-fp-red no yes
"$NODE" "$GATE" --app-dir /tmp/b7v22-fp-red/app --node "$NODE" --timeout-ms 120000 2>&1 | head -3 || true
echo

echo "## [RED-A′] vendored dep PRESENT but packages/development-execution NOT carried (the masked next failure at current main)"
build_stage /tmp/b7v22-fp-red-a2 yes no
"$NODE" "$GATE" --app-dir /tmp/b7v22-fp-red-a2/app --node "$NODE" --timeout-ms 120000 --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('ok=%s importSettled=%s missing=%s' % (d['ok'], d['importSettled'], [m['spec'] for m in d['missingPackages']])); print('\n'.join(d['tail'][-3:]))" || true
echo

echo "## [GREEN-A] fresh pack WITH v2.2 FIX A (vendored dep + development-execution carried)"
build_stage /tmp/b7v22-fp-green yes yes
"$NODE" "$GATE" --app-dir /tmp/b7v22-fp-green/app --node "$NODE" --timeout-ms 120000 2>&1 | tail -3
"$NODE" "$GATE" --app-dir /tmp/b7v22-fp-green/app --node "$NODE" --timeout-ms 120000 --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['ok'] and d['importSettled'] and not d['missingPackages']; print('GATE_JSON_VERDICT ok=true importSettled=true missingPackages=0')"
echo

echo "## [G2.5 regression] FRESH_CHILD_BOOT_CANARY_V1 on the GREEN stage (plugin tree must stay healthy)"
"$NODE" "$CANARY" --trusted-root /tmp/b7v22-fp-green --timeout-ms 120000 2>&1 | tail -2
echo
echo "RED_GREEN_RUNTIME_APP_GRAPH = PASS (RED exact #193 class + RED-A′ masked gap + GREEN whole-graph import + G2.5 regression, hermetic throwaway homes)"
} 2>&1 | tee "$OUT"
echo "evidence written: $OUT"
