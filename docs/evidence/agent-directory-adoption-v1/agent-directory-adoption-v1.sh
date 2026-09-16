#!/bin/bash
# agent-directory-adoption-v1.sh — AGENT_DIRECTORY_TOOL_V1_INTEGRATION_REVIEW
# 最小 production adoption：在当前部署代际上落地 agent_directory（2 个新文件
# + 2 个最小 wiring 增量），重启 canonical runtime，回读验收。
#
# Payload 来源 = merged main aa4caf4（PR #298）的 agent_directory 实现字节；
# compose postimage = 当前部署 compose + 恰好 2 处增量（import + provide）。
# v2 (2026-09-16 22:1x)：WGR lane 今晚 20:56 部署事务把部署 compose 换到新混合代际
# (697c7fda)，packet 按设计 fail-closed 拦截后对 v2 preimage 重新生成并复验。
#
# Usage (root):
#   bash /tmp/agent-directory-adoption-v1.sh --selftest   # 零生产触碰
#   bash /tmp/agent-directory-adoption-v1.sh --apply      # 生产 mutation + kickstart + 回读
#   bash /tmp/agent-directory-adoption-v1.sh --rollback   # 恢复最近备份
#
# Fail-closed：任一 sha 漂移 / mutex 被占 / 回读不符 ⇒ 非零退出，绝不半写。
set -euo pipefail

APP=/usr/local/libexec/agent-core/app
PAYLOAD=/tmp/agent-directory-adoption-v1-payload
BACKUP_ROOT=/usr/local/libexec/agent-core/backups
LOCK_DIR=/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock
RECEIPT=/tmp/agent-directory-adoption-v1-receipt.json
DAEMON=system/ai.agent-core.runtime
NODE_BIN=/usr/local/libexec/agent-core/node-runtime/bin/node
ERRLOG=/Users/authsvc/.agent-core/logs/runtime.err.log
OUTLOG=/Users/authsvc/.agent-core/logs/runtime.log

# ---- frozen sha256 (2026-09-16) -------------------------------------------
SHA_PRE_INDEX=60c2f819e1d116c3f678fa1f0f611225aac101b44d60aced02da3a346070f762
SHA_PRE_COMPOSE=697c7fda901b7fbefc08f5b66e0af94425bc957f349263c5f33531b46575e614
SHA_POST_INDEX=37501c48ebeea3cac34f2f5892ab095567174ebe2f5de45c6914dce9573bad8f
SHA_POST_COMPOSE=17e4aedd43053286c4bcead61b18da4bec6bbaccda2bdd99860963a711a3c3d0
SHA_NEW_MANIFEST=bb79c00e646c3a25484414f501825833cb2e7c8759592612d1f93ca314a865cd
SHA_NEW_PROVIDER=db9dc21342d3d5db6a888ed0ce110b014a5cc37e3be1a3de529e910e6d3d61be

F_INDEX="$APP/packages/broker/src/index.js"
F_COMPOSE="$APP/packages/production-runtime/src/compose.js"
F_MANIFEST="$APP/packages/broker/src/capabilities/agent-directory.js"
F_PROVIDER="$APP/packages/production-runtime/src/agent-directory.js"

sha_of() { /usr/bin/shasum -a 256 "$1" 2>/dev/null | /usr/bin/awk '{print $1}'; }

fail() { echo "ADOPTION_FAIL: $*" >&2; exit 1; }

LOCK_ACQUIRED=0
acquire_lock() {
  if [ -d "$LOCK_DIR" ]; then
    fail "global production-deploy mutex held: $(cat "$LOCK_DIR/holder" 2>/dev/null | tr '\n' ' ')"
  fi
  mkdir -p "$LOCK_DIR"
  echo "pid=$$ purpose=agent-directory-adoption-v1 ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK_DIR/holder"
  LOCK_ACQUIRED=1
}
release_lock() {
  if [ "$LOCK_ACQUIRED" = 1 ] && [ -d "$LOCK_DIR" ] && grep -q "pid=$$" "$LOCK_DIR/holder" 2>/dev/null; then
    rm -f "$LOCK_DIR/holder"; rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
}
trap release_lock EXIT

verify_payload() {
  [ -f "$PAYLOAD/broker-index.js" ]              || fail "payload missing broker-index.js"
  [ -f "$PAYLOAD/compose.js" ]                   || fail "payload missing compose.js"
  [ -f "$PAYLOAD/broker-agent-directory.js" ]    || fail "payload missing broker-agent-directory.js"
  [ -f "$PAYLOAD/runtime-agent-directory.js" ]   || fail "payload missing runtime-agent-directory.js"
  [ "$(sha_of "$PAYLOAD/broker-index.js")" = "$SHA_POST_INDEX" ]      || fail "payload sha drift: broker-index.js"
  [ "$(sha_of "$PAYLOAD/compose.js")" = "$SHA_POST_COMPOSE" ]         || fail "payload sha drift: compose.js"
  [ "$(sha_of "$PAYLOAD/broker-agent-directory.js")" = "$SHA_NEW_MANIFEST" ]    || fail "payload sha drift: manifest"
  [ "$(sha_of "$PAYLOAD/runtime-agent-directory.js")" = "$SHA_NEW_PROVIDER" ]   || fail "payload sha drift: provider"
  echo "== payload sha verified (4/4) =="
}

verify_preimage() {
  [ "$(sha_of "$F_INDEX")" = "$SHA_PRE_INDEX" ]   || fail "deployed broker/src/index.js drifted from frozen preimage (another lane deployed?) — regenerate packet"
  [ "$(sha_of "$F_COMPOSE")" = "$SHA_PRE_COMPOSE" ] || fail "deployed production-runtime/src/compose.js drifted from frozen preimage — regenerate packet"
  echo "== deployed preimage sha verified (2/2) =="
}

current_pid() { launchctl print "$DAEMON" 2>/dev/null | awk '/^pid = /{print $3}' | head -1; }

local_cap_last_count() {
  local n
  n=$(grep -o '[0-9][0-9]* local capabilities ready' "$ERRLOG" "$OUTLOG" 2>/dev/null | tail -1 | awk '{print $1}')
  echo "${n:-unknown}"
}

wait_new_pid() {
  local old="$1" i new
  for i in $(seq 1 60); do
    new=$(current_pid)
    if [ -n "$new" ] && [ "$new" != "$old" ]; then echo "$new"; return 0; fi
    sleep 1
  done
  return 1
}

write_receipt() {
  # $1=status, rest key=value pairs appended verbatim
  local status="$1"; shift
  {
    echo "{"
    echo "  \"status\": \"$status\","
    echo "  \"ts\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    for kv in "$@"; do
      key="${kv%%=*}"; val="${kv#*=}"
      echo "  \"$key\": \"${val//\"/\\\"}\","
    done
    echo "  \"script\": \"/tmp/agent-directory-adoption-v1.sh\""
    echo "}"
  } > "$RECEIPT"
  /bin/chmod 644 "$RECEIPT"
}

install_file() { /usr/sbin/install -o authsvc -g authsvc -m 0644 "$1" "$2"; }

# ---------------------------------------------------------------- selftest
do_selftest() {
  echo "== SELFTEST (zero production touch) =="
  verify_payload
  verify_preimage
  [ -x "$NODE_BIN" ] || fail "node runtime binary absent"
  for f in broker-index.js compose.js broker-agent-directory.js runtime-agent-directory.js; do
    "$NODE_BIN" --check "$PAYLOAD/$f" || fail "syntax: $f"
  done
  echo "== payload syntax OK (4/4) =="
  local scratch
  scratch=$(mktemp -d /tmp/agent-directory-adoption-selftest.XXXXXX)
  cp -R "$APP/packages" "$scratch/packages"
  cp "$PAYLOAD/compose.js"                    "$scratch/packages/production-runtime/src/compose.js"
  cp "$PAYLOAD/broker-index.js"               "$scratch/packages/broker/src/index.js"
  cp "$PAYLOAD/broker-agent-directory.js"     "$scratch/packages/broker/src/capabilities/agent-directory.js"
  cp "$PAYLOAD/runtime-agent-directory.js"    "$scratch/packages/production-runtime/src/agent-directory.js"
  ln -s "$APP/node_modules" "$scratch/node_modules"
  env -u HTTP_PROXY -u http_proxy -u HTTPS_PROXY -u https_proxy -u ALL_PROXY -u all_proxy -u NO_PROXY -u no_proxy \
    "$NODE_BIN" --input-type=module -e "
const R = (p) => 'file://' + process.argv[1] + '/packages/' + p;
const m = await import(R('production-runtime/src/compose.js'));
const b = await import(R('broker/src/index.js'));
const manifest = (await import(R('broker/src/capabilities/agent-directory.js'))).agentDirectoryManifest;
if (typeof m.composeProductionRuntime !== 'function') throw new Error('compose export broken');
if (!b.DEFAULT_MANIFESTS.some((x) => x.id === 'agent.directory')) throw new Error('manifest not registered');
if (manifest.toolName !== 'agent_directory') throw new Error('toolName wrong');
console.log('SELFTEST_IMPORT_OK');
" "$scratch" || { rm -rf "$scratch"; fail "rehearsal import smoke failed"; }
  rm -rf "$scratch"
  echo "== SELFTEST_ALL_OK =="
}

# ---------------------------------------------------------------- apply
do_apply() {
  echo "== APPLY (production mutation: 2 new files + 2 minimal wiring deltas + restart) =="
  acquire_lock
  verify_payload
  verify_preimage

  if [ "$(sha_of "$F_INDEX")" = "$SHA_POST_INDEX" ] && [ -f "$F_MANIFEST" ]; then
    echo "== ALREADY_APPLIED (postimage in place) — readback only =="
  else
    local ts bk
    ts=$(date -u +%Y%m%dT%H%M%SZ)
    bk="$BACKUP_ROOT/agent-directory-adoption-$ts"
    mkdir -p "$bk/packages/broker/src" "$bk/packages/production-runtime/src"
    cp -p "$F_INDEX"  "$bk/packages/broker/src/index.js"
    cp -p "$F_COMPOSE" "$bk/packages/production-runtime/src/compose.js"
    echo "$SHA_PRE_INDEX  packages/broker/src/index.js"    > "$bk/PREIMAGE.sha256"
    echo "$SHA_PRE_COMPOSE  packages/production-runtime/src/compose.js" >> "$bk/PREIMAGE.sha256"
    echo "== backup at $bk =="

    local pre_pid pre_count
    pre_pid=$(current_pid); pre_count=$(local_cap_last_count)
    echo "== pre-restart: pid=${pre_pid:-none} local_capabilities_last=${pre_count} =="

    install_file "$PAYLOAD/broker-agent-directory.js"  "$F_MANIFEST"
    install_file "$PAYLOAD/runtime-agent-directory.js" "$F_PROVIDER"
    install_file "$PAYLOAD/broker-index.js"            "$F_INDEX"
    install_file "$PAYLOAD/compose.js"                 "$F_COMPOSE"

    /bin/launchctl kickstart -k "$DAEMON"
    local new_pid
    new_pid=$(wait_new_pid "$pre_pid") || fail "runtime did not come back after kickstart"
    sleep 3
    [ "$(sha_of "$F_INDEX")" = "$SHA_POST_INDEX" ]      || fail "postimage drift after install: index"
    [ "$(sha_of "$F_COMPOSE")" = "$SHA_POST_COMPOSE" ]  || fail "postimage drift after install: compose"
    [ "$(sha_of "$F_MANIFEST")" = "$SHA_NEW_MANIFEST" ] || fail "postimage drift after install: manifest"
    [ "$(sha_of "$F_PROVIDER")" = "$SHA_NEW_PROVIDER" ] || fail "postimage drift after install: provider"
    local post_count
    post_count=$(local_cap_last_count)
    echo "== post-restart: pid=$new_pid local_capabilities_last=$post_count (pre=$pre_count) =="

    write_receipt APPLIED "new_pid=$new_pid" "pre_pid=${pre_pid:-none}" \
      "pre_local_capabilities=$pre_count" "post_local_capabilities=$post_count" \
      "backup=$bk" "index_sha=$(sha_of "$F_INDEX")" "compose_sha=$(sha_of "$F_COMPOSE")"
    echo "== APPLY_OK receipt=$RECEIPT =="
  fi
}

# ---------------------------------------------------------------- rollback
do_rollback() {
  echo "== ROLLBACK =="
  acquire_lock
  local bk
  bk=$(ls -1d "$BACKUP_ROOT"/agent-directory-adoption-* 2>/dev/null | sort | tail -1)
  [ -n "$bk" ] || fail "no adoption backup found"
  [ "$(sha_of "$bk/packages/broker/src/index.js")" = "$SHA_PRE_INDEX" ]   || fail "backup index sha drift"
  [ "$(sha_of "$bk/packages/production-runtime/src/compose.js")" = "$SHA_PRE_COMPOSE" ] || fail "backup compose sha drift"

  local pre_pid; pre_pid=$(current_pid)
  install_file "$bk/packages/broker/src/index.js"               "$F_INDEX"
  install_file "$bk/packages/production-runtime/src/compose.js" "$F_COMPOSE"
  rm -f "$F_MANIFEST" "$F_PROVIDER"
  /bin/launchctl kickstart -k "$DAEMON"
  local new_pid
  new_pid=$(wait_new_pid "$pre_pid") || fail "runtime did not come back after rollback kickstart"
  [ "$(sha_of "$F_INDEX")" = "$SHA_PRE_INDEX" ]   || fail "rollback index sha mismatch"
  [ "$(sha_of "$F_COMPOSE")" = "$SHA_PRE_COMPOSE" ] || fail "rollback compose sha mismatch"
  [ ! -f "$F_MANIFEST" ] || fail "rollback manifest file still present"
  write_receipt ROLLED_BACK "new_pid=$new_pid" "backup=$bk"
  echo "== ROLLBACK_OK =="
}

case "${1:-}" in
  --selftest)  do_selftest ;;
  --apply)     do_apply ;;
  --rollback)  do_rollback ;;
  *) echo "usage: $0 --selftest|--apply|--rollback" >&2; exit 2 ;;
esac
