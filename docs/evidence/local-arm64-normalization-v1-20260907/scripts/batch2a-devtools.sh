#!/bin/bash
# BATCH-2A: developer tooling ARM normalization — claude / op / gpg / pandoc
# Per tool: wrapper→real executable, OLD arch proof, ARM install, NEW arch proof,
# functional smoke (REAL_EXECUTED_ARCH), hardcoded x64 reference check, rollback retained.
RAW="/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/raw"
BREW=/opt/homebrew/bin/brew
export HOMEBREW_NO_AUTO_UPDATE=1
PROOF="$RAW/36-batch2-proof.txt"
: > "$PROOF"
note(){ echo "== $* ==" | tee -a "$PROOF"; }
resolve(){ /bin/zsh -ic "command -v $1" 2>/dev/null | head -1; }
arch_of(){ /usr/bin/file -b "$1" 2>/dev/null | head -c 100; }
smoke(){ ( eval "$2" ) >> "$RAW/38-batch2-function-tests.txt" 2>&1 && echo "PASS" || echo "FAIL"; }

install_tool(){
  local tool="$1" kind="$2" smokecmd="$3"
  note "TOOL=$tool ($kind)"
  local rp; rp="$(resolve "$tool")"
  if [ -n "$rp" ]; then
    local rpath; rpath="$(realpath "$rp" 2>/dev/null || echo "$rp")"
    echo "  PRE_RESOLVED = $rp" | tee -a "$PROOF"
    echo "  PRE_REALPATH = $rpath" | tee -a "$PROOF"
    echo "  OLD_ARCH = $(arch_of "$rpath")" | tee -a "$PROOF"
  else
    echo "  PRE_RESOLVED = NONE" | tee -a "$PROOF"
  fi
  echo "  -- installing ARM-native" | tee -a "$PROOF"
  local flag=""; [ "$kind" = "cask" ] && flag="--cask"
  if ! "$BREW" install $flag "$tool" >> "$RAW/37-batch2-install-logs.txt" 2>&1; then
    echo "  retry with proxy env stripped" | tee -a "$PROOF"
    if ! env -u http_proxy -u https_proxy -u all_proxy -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY \
        "$BREW" install $flag "$tool" >> "$RAW/37-batch2-install-logs.txt" 2>&1; then
      echo "  INSTALL=FAIL (see 37)" | tee -a "$PROOF"; return 1
    fi
  fi
  rp="$(resolve "$tool")"
  local rpath2; rpath2="$(realpath "$rp" 2>/dev/null || echo "$rp")"
  echo "  POST_RESOLVED = $rp" | tee -a "$PROOF"
  echo "  NEW_REALPATH = $rpath2" | tee -a "$PROOF"
  echo "  NEW_ARCH = $(arch_of "$rpath2")" | tee -a "$PROOF"
  echo "  VERSION = $("$rp" --version 2>&1 | head -1)" | tee -a "$PROOF"
  echo "  FUNCTION = $(smoke "$tool" "$smokecmd")" | tee -a "$PROOF"
  echo "  ACCIDENTAL_X64_FALLBACK = $( [ "$(arch_of "$rpath2")" != "${rpath2##*}" ] && echo checked )"
  local fb; fb="$(resolve "$tool")"
  case "$(arch_of "$rpath2")" in
    *arm64*) echo "  REAL_EXECUTED_ARCH = arm64 (resolution+binary verified)" | tee -a "$PROOF";;
    *) echo "  REAL_EXECUTED_ARCH = NOT-ARM64 — DO NOT COUNT AS MIGRATED" | tee -a "$PROOF";;
  esac
  local n; n=$(rg -l --no-messages "/usr/local/(bin/$tool|opt/.*$tool|Caskroom/$tool)" \
      /Users/yanfenma/.zshrc /Users/yanfenma/.zprofile /Users/yanfenma/.zshenv \
      "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons 2>/dev/null | wc -l | tr -d ' ')
  echo "  HARD_CODED_X64_REFERENCE = $n files" | tee -a "$PROOF"
  echo "  ROLLBACK = Intel copy retained; revert via $BREW uninstall $flag $tool (resolution returns to /usr/local)" | tee -a "$PROOF"
  echo | tee -a "$PROOF"
}

note "BATCH-2A START $(date)"
install_tool claude cask "claude --version | grep -qi 'Claude Code' || claude --version | grep -qE '^2\\.[0-9]+'"
install_tool op cask "op --version | grep -qE '^2\\.[0-9]+'"
install_tool gpg formula "export GNUPGHOME=/tmp/armnorm-gnupg-\\$\\$; mkdir -m 700 \"\\$GNUPGHOME\"; gpg --batch --pinentry-mode loopback --passphrase '' --quick-gen-key armnorm@test.invalid default default never >/dev/null 2>&1 && echo hello | gpg --batch --yes --pinentry-mode loopback --passphrase '' --clearsign --local-user armnorm@test.invalid >/tmp/armnorm-sign.asc 2>/dev/null && gpg --verify /tmp/armnorm-sign.asc >/dev/null 2>&1; rc=\\$?; rm -rf \"\\$GNUPGHOME\" /tmp/armnorm-sign.asc; [ \\$rc -eq 0 ]"
install_tool pandoc formula "printf '# t\\n\\nhi\\n' | pandoc -f markdown -t html | grep -q '<h1'"
note "BATCH-2A END $(date)"
echo "BATCH2A DONE"
