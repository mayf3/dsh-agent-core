#!/bin/bash
# BATCH-1: per-tool ARM-native install + verification (CLASS B, stateless CLIs)
# Rollback per tool: /opt/homebrew/bin/brew uninstall <tool> (Intel copies retained; PATH untouched).
RAW="/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/raw"
BREW=/opt/homebrew/bin/brew
export HOMEBREW_NO_AUTO_UPDATE=1
PROOF="$RAW/32-batch1-proof.txt"
: > "$PROOF"

note(){ echo "== $* ==" | tee -a "$PROOF"; }

resolve(){ /bin/zsh -ic "command -v $1" 2>/dev/null | head -1; }

arch_of(){ /usr/bin/file -b "$1" 2>/dev/null | head -c 120; }

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
  if eval "$func" >> "$RAW/34-batch1-function-tests.txt" 2>&1; then
    echo "  NEW_COMMAND_FUNCTION = PASS" | tee -a "$PROOF"
  else
    echo "  NEW_COMMAND_FUNCTION = FAIL (see 34-batch1-function-tests.txt)" | tee -a "$PROOF"
  fi
  echo "  HARD_CODED_X64_REFERENCE check = $(rg -l --no-messages --glob '!**/node_modules/**' --glob '!**/.git/**' "/usr/local/(bin|opt)/(uv/|wget|tmux|starship|cmake|deno)" /Users/yanfenma/.zshrc /Users/yanfenma/.zprofile /Users/yanfenma/.zshenv "$HOME/Library/LaunchAgents" 2>/dev/null | wc -l | tr -d ' ') files" | tee -a "$PROOF"
  echo | tee -a "$PROOF"
}

note "BATCH-1 START $(date)"
# uv: create+remove a throwaway venv against the ARM interpreter (offline)
verify_tool uv "uv venv /tmp/armnorm-uv-venv --python /opt/homebrew/bin/python3.14 && test -x /tmp/armnorm-uv-venv/bin/python && rm -rf /tmp/armnorm-uv-venv"
# wget: fetch a small file from a throwaway localhost server
verify_tool wget "cd /tmp && (/opt/homebrew/bin/python3 -m http.server 18081 --bind 127.0.0.1 >/dev/null 2>&1 & echo \$! > /tmp/armnorm-http.pid) && sleep 1 && wget -q -O /tmp/armnorm-wget-test http://127.0.0.1:18081/etc/hostname 2>/dev/null || wget -q -O /tmp/armnorm-wget-test 'http://127.0.0.1:18081/'; s=\$?; kill \$(cat /tmp/armnorm-http.pid) 2>/dev/null; rm -f /tmp/armnorm-http.pid /tmp/armnorm-wget-test; exit \$s"
# tmux: detached session lifecycle
verify_tool tmux "tmux kill-session -t armnorm_b1 2>/dev/null; tmux new -d -s armnorm_b1 'sleep 2' && tmux has-session -t armnorm_b1 && sleep 2 && ! tmux has-session -t armnorm_b1 2>/dev/null"
# starship: preset listing (offline)
verify_tool starship "starship preset list | head -3"
# cmake: configure a NONE-language throwaway project
verify_tool cmake "mkdir -p /tmp/armnorm-cmake-proj && printf 'project(armnorm NONE)\\n' > /tmp/armnorm-cmake-proj/CMakeLists.txt && cmake -S /tmp/armnorm-cmake-proj -B /tmp/armnorm-cmake-build >/dev/null && rm -rf /tmp/armnorm-cmake-build /tmp/armnorm-cmake-proj"
# deno: offline eval
verify_tool deno "deno eval 'console.log(2+3)' | grep -q 5"
note "BATCH-1 END $(date)"
echo "BATCH1 SCRIPT DONE"
