#!/bin/bash
# BATCH-1 continuation: wget function proof + remaining tools (tmux starship cmake deno)
# All function tests run inside a subshell so they cannot kill this script.
RAW="/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/raw"
BREW=/opt/homebrew/bin/brew
export HOMEBREW_NO_AUTO_UPDATE=1
PROOF="$RAW/32-batch1-proof.txt"

note(){ echo "== $* ==" | tee -a "$PROOF"; }
resolve(){ /bin/zsh -ic "command -v $1" 2>/dev/null | head -1; }
arch_of(){ /usr/bin/file -b "$1" 2>/dev/null | head -c 120; }

# --- wget function-only proof (already installed ARM) ---
note "TOOL=wget (function proof only)"
if (
  cd /tmp || exit 9
  /opt/homebrew/bin/python3 -m http.server 18082 --bind 127.0.0.1 >/dev/null 2>&1 &
  pid=$!
  sleep 1
  wget -q -O /tmp/armnorm-wget-test "http://127.0.0.1:18082/etc/hosts" 2>/dev/null
  rc=$?
  kill $pid 2>/dev/null
  wait $pid 2>/dev/null
  rm -f /tmp/armnorm-wget-test
  exit $rc
) >> "$RAW/34-batch1-function-tests.txt" 2>&1; then
  echo "  NEW_COMMAND_FUNCTION = PASS" | tee -a "$PROOF"
else
  echo "  NEW_COMMAND_FUNCTION = FAIL (see 34)" | tee -a "$PROOF"
fi
echo | tee -a "$PROOF"

verify_tool(){
  local tool="$1" func="$2"
  note "TOOL=$tool"
  local rp; rp="$(resolve "$tool")"
  echo "  PATH_RESOLUTION(pre) = ${rp:-NONE}" | tee -a "$PROOF"
  if [ -n "$rp" ]; then
    local rpath; rpath="$(realpath "$rp" 2>/dev/null || echo "$rp")"
    echo "  OLD_REALPATH = $rpath" | tee -a "$PROOF"
    echo "  OLD_ARCH = $(arch_of "$rpath")" | tee -a "$PROOF"
  fi
  echo "  -- installing ARM-native via $BREW" | tee -a "$PROOF"
  if ! "$BREW" install "$tool" >> "$RAW/33-batch1-install-logs.txt" 2>&1; then
    echo "  install failed once; retry with proxy env stripped" | tee -a "$PROOF"
    if ! env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
        "$BREW" install "$tool" >> "$RAW/33-batch1-install-logs.txt" 2>&1; then
      echo "  INSTALL=FAIL (see 33-batch1-install-logs.txt)" | tee -a "$PROOF"
      return 1
    fi
  fi
  rp="$(resolve "$tool")"
  local rpath2; rpath2="$(realpath "$rp" 2>/dev/null || echo "$rp")"
  echo "  PATH_RESOLUTION(post) = $rp" | tee -a "$PROOF"
  echo "  NEW_REALPATH = $rpath2" | tee -a "$PROOF"
  echo "  NEW_ARCH = $(arch_of "$rpath2")" | tee -a "$PROOF"
  echo "  VERSION = $("$rp" --version 2>&1 | head -1)" | tee -a "$PROOF"
  if ( eval "$func" ) >> "$RAW/34-batch1-function-tests.txt" 2>&1; then
    echo "  NEW_COMMAND_FUNCTION = PASS" | tee -a "$PROOF"
  else
    echo "  NEW_COMMAND_FUNCTION = FAIL (see 34-batch1-function-tests.txt)" | tee -a "$PROOF"
  fi
  echo | tee -a "$PROOF"
}

note "BATCH-1 CONTINUATION $(date)"
verify_tool tmux "tmux kill-server 2>/dev/null; tmux new -d -s armnorm_b1 'sleep 2' && tmux has-session -t armnorm_b1 && sleep 3 && ! tmux has-session -t armnorm_b1"
verify_tool starship "starship preset list | head -3"
verify_tool cmake "mkdir -p /tmp/armnorm-cmake-proj && printf 'project(armnorm NONE)\n' > /tmp/armnorm-cmake-proj/CMakeLists.txt && cmake -S /tmp/armnorm-cmake-proj -B /tmp/armnorm-cmake-build >/dev/null && rm -rf /tmp/armnorm-cmake-build /tmp/armnorm-cmake-proj"
verify_tool deno "deno eval 'console.log(2+3)' | grep -q 5"
note "BATCH-1 CONTINUATION END $(date)"
echo "BATCH1 CONTINUATION DONE"
