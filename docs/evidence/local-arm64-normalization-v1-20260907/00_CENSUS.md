# 00_CENSUS — LOCAL_NATIVE_ARM64_PLATFORM_NORMALIZATION_V1

- DATE: 2026-09-07 07:48–08:0x CST (all read-only; zero mutation during census)
- METHOD: scripts/census-part1.sh + census-part2.sh → raw/*. No sudo used (non-privileged scope only).

## Required census fields

| FIELD | VALUE |
|---|---|
| HOST_ARCH | arm64 (Apple M5 Pro, T6050, hw.optional.arm64=1) |
| MACOS_VERSION | macOS 26.6.2 (Build 25G83), Darwin 25.6.0 |
| ROSETTA_INSTALLED | YES (/Library/Apple/usr/share/rosetta; oahd running pid 89085; x86_64 exec test OK) |
| SHELL_PATH (interactive zsh) | `.qoder/entry : /opt/homebrew/bin : ~/bin : ~/.local/bin : ~/.bun/bin : ~/.opencode/bin : /usr/local/opt/openjdk/bin (×2) : /opt/homebrew/bin (dup) : … : /usr/local/bin : /usr/bin : /bin : /usr/sbin : /sbin : cryptex-bootstrap : /pkg/env/global/bin : ~/.cargo/bin : ZCode tools` |
| SHELL_PATH (login non-interactive zsh) | `.qoder/entry : ~/.local/bin : /usr/local/bin : /usr/bin : /bin : … : /opt/homebrew/bin` — **/usr/local/bin BEFORE /opt/homebrew/bin** (path_helper /etc/paths order; .zshrc not read in this mode) |
| ARM_HOMEBREW_ROOT | /opt/homebrew |
| INTEL_HOMEBREW_ROOT | /usr/local |
| ARM_BREW_VERSION | Homebrew 6.0.22 |
| INTEL_BREW_VERSION | Homebrew 6.0.18 |

## Headline findings

1. **Rosetta is live-load-bearing**: 12 x86_64-only executables currently running translated
   (raw/04; r1-audit correction: agent-core node-runtime binary serves 5 PIDs — 51361 authsvc
   prod, 60339 scheduler, 80170/80218 harness children, 36789 additional runtime worker):
   Intel node 25.6.1 ×2 (article-review-canary + deepseek-harness luna worktree), Intel
   postgresql@16 ×2 instances (main + leftover /tmp diagnostics cluster), syncthing 2.0.14,
   tailscaled 1.94.2 (system domain), svc-workflow binary, com.docker.vmnetd (root helper),
   Intel Python 3.13/3.14 (irbridge/videobridge).
2. **Dual Homebrew worlds**: Intel 192 formulae + 15 casks (incl. claude-code 2.1.17 x64,
   codex 0.133.0 stale, ngrok, op) vs ARM 100+ formulae (incl. node, python@3.13/3.14,
   ffmpeg, tesseract, openssl@3, gh) + 5 casks. /usr/local/bin holds 572 x86_64 binaries;
   /opt/homebrew/bin 684 entries (468 arm64-native).
3. **Interactive PATH already prefers ARM** (.zshrc:204 prepends /opt/homebrew/bin):
   node/npm/python3/pip3/brew/ffmpeg/tesseract/gh/docker resolve ARM interactively.
   Still Intel-resolving interactively: uv, wget, tmux, starship, cmake, deno, claude,
   psql, gpg, op. Login/non-interactive shells and cron-style contexts fall through to
   /usr/local first.
4. **.zshrc injects Intel dylib paths into every interactive shell** (line 124):
   `DYLD_LIBRARY_PATH=/usr/local/opt/{xz,zlib,libxml2}/lib:…` — mixed-arch failure class
   (an arm64 process launched from an interactive shell can load x86_64 dylibs).
   Also lines 125/126 duplicate-prepend Intel openjdk.
5. **tailscale split-brain**: system-domain com.tailscale.tailscaled (root, pid 836,
   running) + user-domain homebrew.mxcl.tailscale (loaded, lastexit=1, FAILING).
   Architecture vs configuration separated per dispatch: the user-domain failure is a
   configuration/conflict symptom, not proven arch-caused.
6. **Leftover stateful process**: Intel postgres temp cluster `/tmp/svc-diagnostics-pg-20260906`
   (port 55449, started 2026-09-06 18:28) still running — residue candidate, not touched.
7. **Two listeners on 8787**: pid 63320 (*:8787) and pid 70038 ai.agent-core.runtime
   (127.0.0.1:8787) — different bind scopes; recorded for DSH-goal evidence, not investigated further here.
8. Intel-only GUI apps (informational, G class): Arduino IDE, BaiduNetdisk_mac, GIPHY CAPTURE,
   TUCSender, TencentDocs, Unity Hub, iOAPrinterHelper.

## Command resolution (login-zsh census, raw/19) — x86_64-resolved set

node/npm/npx/yarn/pnpm (Intel node 25.6.1 + /usr/local/lib/node_modules), python3/3.11/3.12/3.13
+ pip3 (Intel), uv/uvx, wget, tmux, deno, starship, cmake, psql/pg_ctl/pg_dump (postgresql@16
16.14), syncthing, tailscale/tailscaled, cloudflared 2025.11.1, ngrok (cask), ffmpeg/ffprobe
(8.1.1), pandoc, tesseract, gpg (gnupg 2.5.19), op (1password-cli cask), claude (claude-code
cask 2.1.17 x64), R/Rscript (r 4.4.3), openssl@3, gradle, rustc/cargo (~/.cargo rustup is
x86_64), bun (~/.bun standalone x86_64), brew (→ /usr/local in login shells).
ARM-native already: gh 2.100.0, aria2c, docker CLI (Docker.app arm64), codex 0.144.4
(standalone aarch64), node/npm/python3/brew/ffmpeg/tesseract (interactive, via /opt/homebrew).

## Inventory index (raw/)

01 system+PATH+Rosetta; 02 processes; 03/04 process executables+arch; 05 launchctl user;
06/07/08 launchd dirs+plists(sanitized)+arch; 09–17 dual brew versions/config/services/list;
18 ports; 19 command resolution; 20–22 /usr/local/bin + /opt/homebrew/bin arch; 23 trees;
24 node native modules; 25 python closures; 26 hardcoded /usr/local (launchd/profiles/IDE);
27 repo script references (565 hits — dominated by dsh-agent-core worktree copies of
trusted-cp-deploy-install.sh + auth-service grant test fixtures); 28 n/a; 29 stateful data
roots; 30 GUI arch; 31 DSH runtime observation.

Secret boundary: plists/env files sanitized (07, 26); no credentials copied; config.xml of
syncthing recorded as sha256 only.
