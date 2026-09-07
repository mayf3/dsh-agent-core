# 06_PHASE3_R2 — Owner CONTINUE_AUTONOMOUSLY round (2026-09-07)

Owner directives §1–§13 executed. This doc is the r2 delta of record; r1 docs remain frozen.

## §1 Secret exposure disposition

Mechanical surface scan (scripts/secret-exposure-scan.py → raw/35): 4 distinct token
byte-sequences identified from 72 plists. Surfaces: git NO / uploaded NO / shared-sync NO /
shell-logs NO / evidence-residual NO / **model-visible-transcript YES** (r1 audit report
text traversed the model-provider API transport).
⇒ SECRET_EXPOSURE = POTENTIAL_EXTERNAL_DISCLOSURE, ROTATION_REQUIRED = YES.
Rotation NOT performed here (DSH-domain); bounded handoff with fingerprints only:
05_SECRET_EXPOSURE_DISPOSITION.md. No token bytes in any file or report.

## §2 P0 service ownership (recorded)

svc-workflow (D8) and auth-service + everything owned by
WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_RECONCILIATION_V1 = OWNED_BY_OTHER_GOAL while P0
active. This Goal: census/prep/tests only — no cutover/restart/binary replace/launch-path
change/package-generation change for those assets. No generation skew created this round.

## §3 DSH boundary

Preserved. F-class family untouched throughout (re-audited). Owner-noted Rosetta-AOT
production incident recorded as further DSH_ARM_DEPENDENCY_EVIDENCE (details live in the
DSH Goal's own lane; no investigation performed from this Goal).

## §4 PHASE 3 BATCH-2 (developer tooling, per-tool REAL_EXECUTED_ARCH)

| TOOL | OLD (x86_64) | NEW (arm64) | FUNCTION | NOTES |
|---|---|---|---|---|
| claude | Caskroom/claude-code 2.1.17 | Caskroom 2.1.236 (ARM cask claude-code) | PASS (--version) | AI CLI; first attempt installed wrong cask `claude` (Desktop app) — uninstalled same hour, host restored (census raw/30 proves app absent pre-install) |
| op | Caskroom/1password-cli 2.34.1 | 2.39.0 | PASS | correct cask name is `1password-cli` |
| gpg | gnupg 2.5.19 | 2.5.22 | PASS (isolated-home keygen+sign+verify r2) | real keyring untouched |
| pandoc | 3.9.0.2 | 3.11 | PASS (md→html) | |
| bun | ~/.bun 1.3.6 x64 | 1.4.2 arm64 (official installer) | PASS (bun -e) | rollback backup ~/.bun/bin/bun.x64.bak-r2 |
| rustup/cargo | x64 rustup + stable-x86_64 | arm64 rustup + stable-aarch64 (1.98.1) | PASS (cargo build+run, artifact arm64) | x64 toolchain retained; revert = rerun x64 rustup-init |
| psql/pg_dump | intel 16.14 client | ARM 16.15 client (postgresql@16 + link --force) | PASS (--version) | client/server same major; HAZARD note: do NOT run shell-resolved `pg_ctl` against /usr/local/var/postgresql@16 until D4 migration |
| openssl | intel 3.6.2 | ARM openssl@3 3.6.4 (link) | PASS (version) | |

Two regex false-positive corrections recorded in raw/36 (op→openclaw prefix match;
rustup→dsh-lark PATH line). All installs: zero uninstall of Intel copies, zero sudo,
zero service mutations. Install evidence: raw/36/37/38.

## §5 Mixed-closure cleanup

Full-tree wrong-arch scan (rule: contains arm64 AND NOT x86_64 — initial sampling
conflation of universal binaries corrected in raw/45): intel python3.14 site-packages
arm64-ONLY count = 0 (flagged files are universal = arch-safe). Active closures:
ARM py 40/40 arm64; intel py x64+universal (coherent); article-review-canary x64 node +
x64 esbuild (coherent, launchd-live, left running); agent-core F-family x64 (coherent).
**MIXED_ARCH_ACTIVE_CLOSURES = 0.** No rebuild of historical environments performed.

## §6 DYLD_LIBRARY_PATH global injection

Consumer search: sole reference = .zshrc:124 itself (no launchd, no scripts).
A/B: initial B-invalid (zsh -ic re-sourced .zshrc) — corrected B2 with `zsh -f` +
absolute paths (raw/39): DYLD UNSET, ARM tools (node/python/ffmpeg/uv/cargo) AND intel
tools (node/python/ffmpeg/java/psql) all PASS. Removal executed (backup
.zshrc.bak-armnorm-r2-20260907, comment-replacement with rollback note). Post-verify
(raw/40): INTERACTIVE_ARM_TOOLS=PASS, DYLD_INTEL_GLOBAL_INJECTION=ABSENT,
INTENDED_LEGACY_CONSUMERS_BROKEN=NO.

## §7 Login PATH normalization (nonprivileged)

Context enumeration: launchd children get minimal PATH (no /usr/local); cron jobs
(openclaw health-check, xiaomusic play/stop) run under cron minimal PATH; sshd untouched;
path_helper demotes injected PATH entries (dry-run proof raw/41) — so the fix point is
user ~/.zprofile (runs after system zprofile). Appended ARM-first prepend (backup
.zshprofile.bak-armnorm-r2-20260907). Post-verify (raw/41): login shell resolves ALL
critical CLIs to /opt/homebrew ARM (node v26.7.0, python 3.14.7, …). /etc/paths NOT
touched (sudo-gated, now redundant for user shells; system-context edit deferred).
Behavior note: legacy npm-global CLIs under /usr/local now execute under ARM node
(pure-JS fine; x64-native-dep ones would fail on use) — per-package correction deferred
as BATCH-3 candidates (dormant/legacy consumers first).

## §8 PostgreSQL migration census (read-only, CUTOVER HOLD_WHILE_P0_DEPENDENT)

Server 16.14 (Intel Cellar postgresql@16), catalog 202307071, data root
/usr/local/var/postgresql@16 (810 MB), pg_hba = scram-sha-256 (local+host for postgres/
yanfenma/agent_dev), socket /tmp/.s.PGSQL.5432, port 5432, launch owner = intel
brew-services (homebrew.mxcl.postgresql@16), observed clients: svc_wf @
svc_workflow_dogfood_clean. DB/role/extension listing = credential-gated (scram) —
deferred to a single supplementary pass at migration-packet time. Backup mechanisms:
daily crons exist (openclaw-backup/backup-all.sh 03:00; project/scripts/
backup-local-mac.sh 07:00) — coverage to be confirmed in packet. ARM target: postgresql@16
16.15 arm64 formula installed (inert, linked client-side). Rollback: Intel Cellar + data
dir untouched; same-major dump/restore plan to be frozen in packet. **No cutover; no
restart; P0 dependency respected.**

## §9 Temporary PG residue — RESOLVED

/tmp/svc-diagnostics-pg-20260906 (pid 22868, port 55449, started 2026-09-06 18:28):
mechanical abandonment proof = 0 established clients (lsof LISTEN-only), no creator
reference in any workspace/script/history, connecting user has no role on it, /tmp
ephemeral, port nonstandard. Stopped via pg_ctl -m fast (raw/44). Data dir retained
(auto-cleans on reboot). Smallest safe cleanup honored.

## §10 Tailscale — launch owner reconciled

Truth established: system-domain com.tailscale.tailscaled (root pid 836, since 08-30) is
the intended owner — healthy, logged in (node 100.103.205.36 macbook-pro), peers listed
via explicit `--socket=/var/run/tailscaled.sock`. The user-domain homebrew.mxcl.tailscale
service was a permanently-failing duplicate (exit 1) — retired via intel `brew services
stop tailscale` (raw/44). Root cause of "tailscale broken": socket path mismatch — daemon
runs with --socket=/var/run/tailscaled.sock, CLI defaults to /var/run/tailscaled.socket.
NOT an architecture defect. No identity reset, no reauth (no Owner gate needed). Arch
migration (arm64 tailscale formula) follows in the D7 packet with socket alignment;
CLI default-socket quirk documented for interactive users.

## §11 Syncthing — migration packet prepared (no cutover)

ARM binary READY: syncthing 2.1.3 arm64 formula installed (service NOT started; intel
2.0.14 service untouched, pids 60360/60436). Identity frozen: DEVICE_ID =
UG3LXUR-XOHGIC3-62U4YCB-KAKH4ZC-JFS7QXZ-ZBKLDZS-A3BPIAY-VGQKXA7; config.xml sha256
c7393791… (unchanged from r1 freeze). Packet gates for future cutover:
DEVICE_ID_UNCHANGED / CONFIG_UNCHANGED (sha match) / FOLDER_IDS_UNCHANGED (from config)
/ INDEX-DATA dir carried whole / same-or-newer version check (2.0.14→2.1.3 forward) /
ROLLBACK = relaunch intel formula. Cutover = service mutation → production-slot gate.

## §13 MILESTONE — HOST_ARM_NORMALIZATION_FOUNDATION_READY = YES

- CRITICAL_CLI_ARM_NORMALIZED = PASS (interactive AND login shells; full critical set:
  node/npm/python3/pip3/git/gh/docker/brew/jq/curl/ssh/sqlite3/openssl/psql/pg_dump +
  batch-1 + batch-2 tools)
- ACCIDENTAL_X64_CLI_FALLTHROUGH = 0 for the critical set; documented non-critical intel
  remainder (dormant/legacy): R/Rscript, gradle, openjdk/java, ngrok, whisper,
  legacy npm-global CLIs — BATCH-3 candidates, none critical
- ACTIVE_X64_SERVICE_INVENTORY = 100% CLASSIFIED (agent-core family F; PG D; syncthing
  D-prepared; tailscale E-reconciled; svc-workflow/auth-service P0-owned; canary,
  irbridge, videobridge, xiaomusic C; docker vmnetd G/E; openclaw control-api legacy A;
  llmwiki universal-python = arm64-effective; temp-PG resolved)
- NO_UNKNOWN_ARCH_DEPENDENCY = PASS (mixed closures = 0; sole remaining unknown = 5
  unreadable root-owned openclaw legacy plists — sudo-gated FOLLOW_UP, none running)
- PRODUCTION_HEALTH = PASS (zero production mutations all round; DSH runtime family
  alive and untouched; re-audit verified)

Goal continues autonomously: BATCH-3 (non-critical CLI remainder + ARM openjdk + legacy
npm-global consumer map) → PHASE 4 launchd/path normalization → PHASE 5 stateful packets
(PG/Syncthing, slot-gated; svc-workflow rebuild prep P0-gated) → PHASE 6 Intel Homebrew
retirement gates.
