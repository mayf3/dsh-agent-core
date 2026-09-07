#!/bin/bash
# BATCH-2A-fix: undo wrong cask (claude Desktop), install correct casks (claude-code,
# 1password-cli), standalone gpg smoke (no eval-quoting mangling).
RAW="/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/raw"
BREW=/opt/homebrew/bin/brew
export HOMEBREW_NO_AUTO_UPDATE=1
PROOF="$RAW/36-batch2-proof.txt"

note(){ echo "== $* ==" | tee -a "$PROOF"; }
resolve(){ /bin/zsh -ic "command -v $1" 2>/dev/null | head -1; }
arch_of(){ /usr/bin/file -b "$1" 2>/dev/null | head -c 100; }

note "BATCH-2A-FIX START $(date)"

note "UNDO wrong cask 'claude' (Claude Desktop.app, census raw/30 confirms absent pre-install)"
"$BREW" uninstall --cask claude >> "$RAW/37-batch2-install-logs.txt" 2>&1 \
  && echo "  uninstall claude (Desktop) = OK" | tee -a "$PROOF" \
  || echo "  uninstall claude (Desktop) = FAIL" | tee -a "$PROOF"
[ -d /Applications/Claude.app ] && echo "  /Applications/Claude.app STILL PRESENT — inspect" | tee -a "$PROOF" \
  || echo "  /Applications/Claude.app removed — host restored" | tee -a "$PROOF"
echo | tee -a "$PROOF"

install_cask_or_formula(){
  local name="$1" caskname="$2" kind="$3" smokecmd="$4"
  note "TOOL=$name (cask: $caskname)"
  local rp; rp="$(resolve "$name")"
  [ -n "$rp" ] && echo "  PRE_RESOLVED = $rp ($(arch_of "$(realpath "$rp")" 2>/dev/null))" | tee -a "$PROOF"
  local flag=""; [ "$kind" = "cask" ] && flag="--cask"
  if ! "$BREW" install $flag "$caskname" >> "$RAW/37-batch2-install-logs.txt" 2>&1; then
    echo "  INSTALL=FAIL (see 37)" | tee -a "$PROOF"; echo | tee -a "$PROOF"; return 1
  fi
  rp="$(resolve "$name")"
  if [ -z "$rp" ]; then echo "  POST_RESOLVED = NONE — cask did not link a binary named $name" | tee -a "$PROOF"; echo | tee -a "$PROOF"; return 1; fi
  local rpath2; rpath2="$(realpath "$rp" 2>/dev/null || echo "$rp")"
  echo "  POST_RESOLVED = $rp" | tee -a "$PROOF"
  echo "  NEW_REALPATH = $rpath2" | tee -a "$PROOF"
  echo "  NEW_ARCH = $(arch_of "$rpath2")" | tee -a "$PROOF"
  echo "  VERSION = $("$rp" --version 2>&1 | head -1)" | tee -a "$PROOF"
  if ( eval "$smokecmd" ) >> "$RAW/38-batch2-function-tests.txt" 2>&1; then
    echo "  FUNCTION = PASS" | tee -a "$PROOF"
  else
    echo "  FUNCTION = FAIL (see 38)" | tee -a "$PROOF"
  fi
  case "$(arch_of "$rpath2")" in
    *arm64*) echo "  REAL_EXECUTED_ARCH = arm64" | tee -a "$PROOF";;
    *) echo "  REAL_EXECUTED_ARCH = NOT-ARM64 — DO NOT COUNT AS MIGRATED" | tee -a "$PROOF";;
  esac
  local n; n=$(rg -l --no-messages "/usr/local/(bin/$name|Caskroom/$caskname)" \
      /Users/yanfenma/.zshrc /Users/yanfenma/.zprofile /Users/yanfenma/.zshenv \
      "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons 2>/dev/null | wc -l | tr -d ' ')
  echo "  HARD_CODED_X64_REFERENCE = $n files" | tee -a "$PROOF"
  echo | tee -a "$PROOF"
}

install_cask_or_formula claude claude-code cask "claude --version 2>&1 | grep -qiE 'Claude Code|[0-9]+\\.[0-9]+'"
install_cask_or_formula op 1password-cli cask "op --version | grep -qE '^2\\.[0-9]+'"

note "TOOL=gpg (standalone smoke, isolated GNUPGHOME)"
if bash "/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/scripts/smoke-gpg.sh" >> "$RAW/38-batch2-function-tests.txt" 2>&1; then
  echo "  FUNCTION(r2, standalone script) = PASS" | tee -a "$PROOF"
else
  echo "  FUNCTION(r2, standalone script) = FAIL (see 38)" | tee -a "$PROOF"
fi
echo | tee -a "$PROOF"

note "BATCH-2A-FIX END $(date)"
echo "BATCH2A-FIX DONE"
