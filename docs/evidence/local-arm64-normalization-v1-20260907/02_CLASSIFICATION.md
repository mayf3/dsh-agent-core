# 02_CLASSIFICATION — LOCAL_NATIVE_ARM64_PLATFORM_NORMALIZATION_V1

Every discovered x86_64/Rosetta item → exactly one primary class (dispatch taxonomy).
Frozen 2026-09-07 after fresh census. This is the pre-mutation classification of record.

## CLASS B — LOW_RISK_CLI_REPLACEMENT (Phase 2, first bounded batch)

ARM-brew-missing, Intel-only-resolving, stateless CLIs; zero hard-coded Intel references
found in repos/profiles/launchd (raw/26, 27); interactive PATH already prefers /opt/homebrew
(.zshrc:204) so ARM install flips resolution without PATH surgery. Intel copies RETAINED
(rollback = uninstall ARM formula; Intel Cellar untouched).

| # | TOOL | OLD (x86_64) | ARM PLAN | BATCH |
|---|---|---|---|---|
| B1 | uv / uvx | /usr/local/bin/uv (Intel) | brew install uv (ARM) | **BATCH-1** |
| B2 | wget | Cellar/wget/1.25.0 | brew install wget | **BATCH-1** |
| B3 | tmux | Cellar/tmux/3.6a | brew install tmux | **BATCH-1** |
| B4 | starship | Cellar/starship/1.24.2 | brew install starship | **BATCH-1** (.zshrc:174 uses name-based init → auto-flips) |
| B5 | cmake | Cellar/cmake/4.3.1 | brew install cmake | **BATCH-1** |
| B6 | deno | Cellar/deno/2.8.0 | brew install deno | **BATCH-1** |

Per-tool proof required (raw/32-batch1-proof.txt): OLD_ARCH=x86_64, NEW_ARCH=arm64,
NEW_COMMAND_FUNCTION=PASS, PATH_RESOLUTION=ARM, HARD_CODED_X64_REFERENCE=0.

## CLASS C — DEVELOPER_TOOL_WITH_PLUGIN_OR_NATIVE_DEPENDENCIES (Phase 3)

| ITEM | EVIDENCE | NOTE |
|---|---|---|
| Intel Node 25.6.1 + /usr/local/lib/node_modules (npm, corepack/yarn/pnpm, claude-code pkg, codebuddy, vercel, clawdbot, openclaw) | raw/19, 24 | interactive node already ARM; Intel side is launchd-absolute-path consumers (D1–D3, D8, D9) + global npm pkgs. Requires per-consumer mapping before any cutover |
| ARM Node/Python shadowing risk | raw/14, 25 | ARM brew HAS node + python@3.13/3.14 — PATH reorder for login shells must NOT proceed before per-project runtime map (NODE/PYTHON TOOLING BOUNDARY) |
| claude CLI | /usr/local/Caskroom/claude-code/2.1.17 x64 binary; sharp-darwin-x64 addon; vendor rg has arm64 | AI CLI SPECIAL HANDLING: spawned runtime is x86_64 today. Upgrade path = ARM-brew cask latest (arm64) — architecture-aware validation required before cutover |
| op (1password-cli cask) | Caskroom x64 | low-use; cask swap w/ validation |
| rustup/cargo (~/.cargo) | rustup shim x86_64 | re-install rustup arm64; toolchain rebuild — Phase 3 |
| bun (~/.bun) | standalone x86_64 | standalone installer upgrade — Phase 3 |
| ngrok (cask) | x64 | low-use |
| Intel Python 3.11/3.12/3.13/3.14 + /usr/local/lib/python3.* site-packages | raw/25 | per-interpreter consumer map first (irbridge/videobridge/whisper…) |
| svc-workflow binary (x86_64 build) | D8 | arm64 rebuild + bounded service migration |
| article-review-canary x64 closure | D9 | rebuild under ARM node |
| gpg (gnupg 2.5.19 x64) | raw/19 | keyring is data (outside brew); arm64 formula swap + roundtrip test — Phase 3 |
| pandoc, R/Rscript, gradle, openssl@3 (intel side) | raw/19, 15 | Phase 3 mass, individually validated |
| llmwiki serve-web.sh (com.llmwiki.local, port 8000) | launchd | shell script — interpreter to verify, Phase 3/4 |

## CLASS D — STATEFUL_LOCAL_SERVICE (Phase 5)

| ITEM | STATE | GATE |
|---|---|---|
| PostgreSQL@16 16.14 main | RUNNING, data /usr/local/var/postgresql@16, port 5432, clients: svc_wf/svc_workflow_dogfood_clean (+ more to census) | DB/role/extension census → same-major 16→16 migration packet → **cutover HOLD for production slot** (P0 adjacency) |
| Syncthing 2.0.14 | RUNNING, identity certs Feb 2026, config hash frozen | device-identity-preserving arch migration packet |
| tailscaled 1.94.2 (system, root) | RUNNING since 08-30 | see class E |

## CLASS E — NETWORK_OR_SYSTEM_SERVICE

tailscale split-brain: system-domain daemon (pid 836) RUNNING vs user-domain brew service
FAILING (lastexit=1). ARCHITECTURE_PROBLEM vs SERVICE_CONFIGURATION_PROBLEM separated:
the failure is a launch-owner conflict until proven otherwise. Normalization = retire the
duplicate user-domain service + single launch owner, THEN arch migration with state
preservation. No reauth anticipated; if unavoidable → TRUE OWNER GATE.

## CLASS F — OWNED_BY_OTHER_GOAL (DO NOT MUTATE)

- agent-core production runtime (authsvc, pid 51361, system-domain launchd) + harness children
- agent-core scheduler runtime (pid 60339, scheduler-v2 plist)
- GLM/Luna harness luna-production-rc8 (pid 70388) + parent ai.agent-core.runtime (70038)
- /usr/local/bin/dsh + dev.omdsh.dsh-lark runtime (60341)
- dsh-agent-core worktree deploy scripts referencing /usr/local/bin/node (565 rg hits family)
→ recorded as DSH_ARM_DEPENDENCY_EVIDENCE for DSH_NATIVE_ARM64_RUNTIME_MIGRATION_V1:
  the entire Agent Core production surface runs x86_64/Rosetta on Intel node.

## CLASS A — UNUSED_INTEL_RESIDUE (retirement candidates, no mutation yet)

- PostgreSQL temp cluster /tmp/svc-diagnostics-pg-20260906:55449 (pid 22868) — confirm-then-stop
- Intel brew formulae with no active consumer — requires full retirement-gate pass (Phase 6):
  ACTIVE_BREW_SERVICES_X64 / CRITICAL_CLI_RESOLUTION_TO_INTEL / LAUNCHD_REQUIRED_INTEL_PATHS /
  ACTIVE_SCRIPT_REQUIRED_INTEL_PATHS / STATEFUL_DATA_DEPENDENCY_ON_INTEL_CELLAR all → 0 first
- Legacy openclaw launchd set (control-api 3093 node, agent-node-502, auto-repair daemon,
  PARSE_ERROR plists ai.openclaw.gateway / com.openclaw.{forum-scheduler,gateway,host-exec-runner,
  workflow-dispatcher}) — legacy-runtime retirement was a prior-goal lane; only classify here.
  PARSE_ERROR files need one file-type inspection before any retirement decision (H→A pending).
- .plist.bak-* lineage in ~/Library/LaunchAgents + /Library/LaunchDaemons (archives, inert)
- com.auth-service user-domain job (lastexit=1, not running; real authsvc runtime = system-domain
  D1) — stale duplicate candidate, confirm before removal

## CLASS G — GUI_APPLICATION (informational)

x86_64-only: Arduino IDE, BaiduNetdisk_mac, GIPHY CAPTURE, TUCSender, TencentDocs,
Unity Hub, iOAPrinterHelper. Universal-intel-side: WeChat, Chrome, Alacritty, iKuuuVPN,
WeType, Sogou, OneDrive, MS Office family, Adobe CC (Creative Cloud + CCXProcess x64-only
LaunchAgents). → FOLLOW_UP_DEBT_GUI_ARM_UPDATES; does not block completion.

## CLASS H — UNKNOWN (must resolve before mutation; none blocking BATCH-1)

- plist PARSE_ERROR set (5 files) — file-type inspection pending
- tailscaled state-dir location (standard paths empty) — locate before D7 migration
- svc-workflow source tree location (for arm64 rebuild) — locate before D8 migration
- /usr/local/opt/openjdk consumers (who needs Intel JDK; .zshrc prepends it ×2)
- DYLD_LIBRARY_PATH Intel libs consumers (xz/zlib/libxml2 — who breaks if removed)

## PATH POLICY NOTE (Phase 3/4 prerequisite)

Login/non-interactive shells get /usr/local/bin BEFORE /opt/homebrew/bin (path_helper,
/etc/paths is sudo-gated). Interactive shells already prefer ARM. Any global PATH surgery
is deferred until: (a) per-project Node/Python runtime map (NODE/PYTHON BOUNDARY), (b)
launchd Intel-path normalization (Phase 4). /etc/paths edit → native sudo gate at Phase 4.

## NO-PERFORMANCE-CLAIM NOTE

No CPU/performance percentages are claimed anywhere in this Goal. Priority is driven by
reliability, architecture consistency, and real dependency-failure classes only.
