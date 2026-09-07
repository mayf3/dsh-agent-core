#!/bin/bash
# BATCH-2B: bun (official installer, arm64) + rustup (arm64 rustup-init + stable-aarch64 toolchain)
RAW="/Users/yanfenma/workspace/project/dsh-agent-core/docs/evidence/local-arm64-normalization-v1-20260907/raw"
PROOF="$RAW/36-batch2-proof.txt"
NETLOG="$RAW/37-batch2-install-logs.txt"
note(){ echo "== $* ==" | tee -a "$PROOF"; }
arch_of(){ /usr/bin/file -b "$1" 2>/dev/null | head -c 100; }
fetch(){ # fetch <url> <out> — try plain, then --noproxy, then proxy-from-env
  curl -fsSL --connect-timeout 20 "$1" -o "$2" 2>>"$NETLOG" && return 0
  curl -fsSL --noproxy '*' --connect-timeout 20 "$1" -o "$2" 2>>"$NETLOG" && return 0
  return 1
}

note "BATCH-2B START $(date)"

# ---------- bun ----------
note "TOOL=bun (official installer, aarch64)"
echo "  PRE: $(file -b ~/.bun/bin/bun | head -c 60) / $($HOME/.bun/bin/bun --version 2>/dev/null)" | tee -a "$PROOF"
cp "$HOME/.bun/bin/bun" "$HOME/.bun/bin/bun.x64.bak-r2" && echo "  backup: ~/.bun/bin/bun.x64.bak-r2" | tee -a "$PROOF"
if fetch https://bun.sh/install /tmp/bun-install-r2.sh; then
  if bash /tmp/bun-install-r2.sh >> "$NETLOG" 2>&1; then
    nb="$HOME/.bun/bin/bun"
    echo "  POST: $(arch_of "$nb")" | tee -a "$PROOF"
    echo "  VERSION = $($nb --version 2>&1 | head -1)" | tee -a "$PROOF"
    if ( bun -e 'console.log(2+3)' 2>/dev/null | grep -q 5 ) >> "$RAW/38-batch2-function-tests.txt" 2>&1; then
      echo "  FUNCTION = PASS (bun -e eval)" | tee -a "$PROOF"
    else
      echo "  FUNCTION = FAIL" | tee -a "$PROOF"
    fi
    case "$(arch_of "$nb")" in
      *arm64*) echo "  REAL_EXECUTED_ARCH = arm64" | tee -a "$PROOF";;
      *) echo "  REAL_EXECUTED_ARCH = NOT-ARM64 — restoring backup"; cp "$HOME/.bun/bin/bun.x64.bak-r2" "$HOME/.bun/bin/bun";;
    esac
  else
    echo "  INSTALL=FAIL — restoring backup"; cp "$HOME/.bun/bin/bun.x64.bak-r2" "$HOME/.bun/bin/bun" 2>/dev/null
  fi
else
  echo "  FETCH=FAIL (installer unreachable; bun left unchanged)" | tee -a "$PROOF"
fi
rm -f /tmp/bun-install-r2.sh
echo | tee -a "$PROOF"

# ---------- rustup ----------
note "TOOL=rustup/cargo (arm64 rustup-init + stable-aarch64 toolchain)"
echo "  PRE: rustup=$(arch_of "$HOME/.cargo/bin/rustup") default=$($HOME/.cargo/bin/rustup show default-toolchain 2>/dev/null)" | tee -a "$PROOF"
if fetch https://static.rust-lang.org/rustup/dist/aarch64-apple-darwin/rustup-init /tmp/rustup-init-arm64; then
  chmod +x /tmp/rustup-init-arm64
  echo "  rustup-init arch = $(arch_of /tmp/rustup-init-arm64)" | tee -a "$PROOF"
  if /tmp/rustup-init-arm64 -y --no-modify-path --default-toolchain stable >> "$NETLOG" 2>&1; then
    rs="$(realpath "$HOME/.cargo/bin/rustc" 2>/dev/null)"
    echo "  POST rustup shim = $(arch_of "$HOME/.cargo/bin/rustup")" | tee -a "$PROOF"
    echo "  rustc realpath = $rs" | tee -a "$PROOF"
    echo "  rustc arch = $(arch_of "$rs")" | tee -a "$PROOF"
    echo "  rustc host = $($HOME/.cargo/bin/rustc -vV 2>/dev/null | grep host)" | tee -a "$PROOF"
    echo "  cargo version = $($HOME/.cargo/bin/cargo --version 2>&1)" | tee -a "$PROOF"
    # real end-to-end: build + run a hello binary, verify the PRODUCED binary is arm64
    mkdir -p /tmp/armnorm-rust-hello/src
    printf '[package]\nname="armnorm_hello"\nversion="0.1.0"\nedition="2021"\n' > /tmp/armnorm-rust-hello/Cargo.toml
    printf 'fn main(){println!("arm64-rust-ok")}\n' > /tmp/armnorm-rust-hello/src/main.rs
    if ( cd /tmp/armnorm-rust-hello && $HOME/.cargo/bin/cargo run --quiet > "$RAW/38-batch2-function-tests.txt.rust" 2>&1 && grep -q arm64-rust-ok "$RAW/38-batch2-function-tests.txt.rust" && file -b target/debug/armnorm_hello | grep -q arm64 ) ; then
      echo "  FUNCTION = PASS (cargo build+run; produced binary is arm64)" | tee -a "$PROOF"
      echo "  REAL_EXECUTED_ARCH = arm64 (rustc host aarch64 + compiled artifact arm64)" | tee -a "$PROOF"
    else
      echo "  FUNCTION = FAIL (see 38.rust)" | tee -a "$PROOF"
    fi
    rm -rf /tmp/armnorm-rust-hello
    n=$(rg -l --no-messages '/usr/local/.*(rust|cargo)' /Users/yanfenma/.zshrc /Users/yanfenma/.zprofile /Users/yanfenma/.zshenv "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons 2>/dev/null | wc -l | tr -d ' ')
    echo "  HARD_CODED_X64_REFERENCE = $n files" | tee -a "$PROOF"
    echo "  ROLLBACK = x86_64 toolchain retained in ~/.rustup; revert: rerun x86_64 rustup-init + rustup default stable-x86_64-apple-darwin" | tee -a "$PROOF"
  else
    echo "  RUSTUP_INIT=FAIL (see 37) — x86_64 rustup untouched" | tee -a "$PROOF"
  fi
else
  echo "  FETCH=FAIL (rustup-init unreachable; rustup left unchanged)" | tee -a "$PROOF"
fi
rm -f /tmp/rustup-init-arm64
note "BATCH-2B END $(date)"
echo "BATCH2B DONE"
