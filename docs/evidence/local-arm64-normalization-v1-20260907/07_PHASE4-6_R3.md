# 07_PHASE4-6_R3 — BATCH-3 + stateful packets + retirement-gate measurement (2026-09-07)

RESUME_GOAL round r3. Production slot remains owned by WORKFLOW_ASSIGNEE_CANONICAL_IDENTITY_
RECONCILIATION_V1 — zero production/service mutations performed. PHASE_LOCK respected:
all cutovers below are PREPARED, not executed.

## BATCH-3a — Java toolchain ARM normalization

- ARM openjdk 26.0.2.1 installed (formula, keg-only). Intel openjdk 25.0.1 retained.
- .zshrc: two duplicate Intel openjdk PATH prepends replaced by ONE ARM prepend +
  JAVA_HOME → ARM (gradle's own JVM discovery previously picked the Intel Cellar JVM;
  JAVA_HOME fixes it deterministically). .zprofile gained the same two lines for login
  shells (the /usr/bin/java stub had ALWAYS been broken in login shells — java_home has
  zero registered JVMs; pre-existing gap, now filled non-privileged).
- Proofs (raw/48): interactive + login both resolve java → /opt/homebrew/opt/openjdk
  arm64, version 26.0.2.1; javac 26.0.2.1; gradle 9.2.0 Launcher JVM 26.0.2.1 ARM
  (gradle is a pure JVM app — architecture follows the JVM; no separate migration needed).
- Backups: ~/.zshrc.bak-armnorm-r3-20260907 (sha f04a560e392e…), ~/.zprofile r3 append.

## BATCH-3b — ngrok + dormant-classification evidence pass

- ngrok: ARM cask 3.39.11 arm64, resolution flipped (raw/49). Intel Caskroom copy retained.
- Usage-evidence classification (raw/49; NO mass action taken):
  - ACTIVE (recent use): whisper (~/.cache/whisper Aug 2026) → ARM openai-whisper
    20250625_6 INSTALLED + normalized (raw/49: resolved /opt/homebrew/bin/whisper,
    interpreter arm64, help smoke PASS). One bounded repair: brew link initially failed
    (a July pip-installed console-script owned /opt/homebrew/bin/whisper as a real file)
    → `brew link --overwrite pytorch openai-whisper` (pip package remains importable;
    only the CLI entry changed). gradle (~/.gradle Aug 2026) → already ARM via JVM swap;
    codebuddy (Jul 2026) → ships dual-arch node-pty prebuilds (raw/24), runs correctly
    under ARM node — no action needed.
  - DORMANT → class A retirement candidates (no install, no deletion): R/Rscript (last
    write Mar–Apr 2025), cloudflared (~/.cloudflared Nov 2025, no service), n8n (Jan
    2026), flyai (Apr 2026), clawdbot (Feb 2026), vercel/qwen/firecrawl (no state dirs),
    unbound/zellij (intel formulae, no services).
  - Behavior note (standing): legacy npm-global CLIs under /usr/local now execute under
    ARM node via PATH precedence; pure-JS CLIs fine, any x64-only-native-dep CLI would
    fail on use → per-package reinstall under ARM npm at that point (FOLLOW_UP rule,
    no proactive mass reinstall).

## PHASE 4 — launchd/path normalization status

Non-privileged actionable items exhausted this round. Remaining launchd Intel-path
consumers are ALL mutation-gated:
- F/P0-owned (untouchable here): agent-core runtime family plists, dsh-lark, canary,
  authsvc system-domain set, com.auth-service user job (stale duplicate — P0-owned).
- C-class service cutover packets (Phase 5 slot-gated): irbridge, videobridge, xiaomusic.
- Legacy retirement (Phase 6, owner-goal caution: openclaw lane frozen by prior rulings):
  openclaw control-api/agent-node-502/auto-repair + 5 root-unreadable plists (sudo-gated).
- /etc/paths edit: sudo-gated; now REDUNDANT for user shells (user .zprofile wins) —
  kept for system-context correctness only, lowest priority.

## PHASE 5 — migration packets (PREPARED, cutover slot-gated)

### PG-PACKET-D4 (Intel PostgreSQL 16.14 → ARM 16.15)

| FIELD | VALUE |
|---|---|
| CURRENT_EXECUTABLE / ARCH | /usr/local/opt/postgresql@16/bin/postgres 16.14 / x86_64 (Rosetta) |
| CURRENT_DATA_ROOT | /usr/local/var/postgresql@16 (810 MB, PG_VERSION=16) |
| CURRENT_CONFIG | postgresql.conf + pg_hba.conf in data root (scram-sha-256; roles postgres/yanfenma/agent_dev + service roles) |
| PORT / SOCKET | 5432 / /tmp/.s.PGSQL.5432 |
| CLIENTS | svc_wf @ svc_workflow_dogfood_clean observed; full client census credential-gated |
| BACKUP | daily crons exist (openclaw-backup/backup-all.sh 03:00; backup-local-mac.sh 07:00) — per-DB coverage to be verified in packet execution |
| ARM_TARGET | postgresql@16 16.15 arm64 (formula installed, inert) — same-major arch-only migration |
| CREDENTIAL GATE | DB/role/extension listing requires scram password — single read-only pass at packet freeze |
| CUTOVER SKETCH | quiesce P0 writers → pg_dumpall (intel client) → stop intel service → initdb ARM 16.15 data root at /opt/homebrew/var/postgresql@16 → restore → ARM brew services start → client smoke → keep Intel Cellar+data dir for rollback |
| ROLLBACK | stop ARM service → restart intel service on original data root (untouched) |
| HAZARD | ARM pg_ctl/psql now PATH-resolved: NEVER run pg_ctl against /usr/local/var/postgresql@16; admin ops must use /usr/local/opt/postgresql@16/bin absolute paths until cutover |
| GATE | CUTOVER = HOLD_WHILE_P0_DEPENDENT (P0 owns svc-workflow which depends on this cluster) |

### SYNCTHING-PACKET-D6 (Intel 2.0.14 → ARM 2.1.3)

| FIELD | VALUE |
|---|---|
| CURRENT | intel syncthing 2.0.14, brew-services plist, pids live |
| IDENTITY FROZEN | DEVICE_ID = UG3LXUR-XOHGIC3-62U4YCB-KAKH4ZC-JFS7QXZ-ZBKLDZS-A3BPIAY-VGQKXA7; config.xml sha256 c7393791… (r1+r3 unchanged) |
| ARM_TARGET | syncthing 2.1.3 arm64 formula installed (service NOT created) |
| CUTOVER SKETCH | config+cert/key+index-v2 backup → stop intel service → ARM brew services start syncthing (same config root ~/Library/Application Support/Syncthing) → DEVICE_ID match check → folder sync health check |
| ROLLBACK | stop ARM service → intel brew services start syncthing (config untouched) |
| VERSION NOTE | 2.0.14 → 2.1.3 forward minor jump; syncthing migrates config forward on start — backup mandatory (rollback then uses archived config) |
| GATE | production slot |

### SVC-WORKFLOW-REBUILD-PREP (P0-OWNED — preparation only)

- Source tree located: /Users/yanfenma/workspace/project/svc-workflow (deploy:
  ~/.local/services/svc-workflow, x86_64 binary + backup lineage).
- Rebuild plan (executed by owning Goal at its slot): ARM Go toolchain (none installed
  today; `go` absent from PATH), GOARCH=arm64 build → stage binary → swap under
  launchd restart owned by P0 goal. This Goal performs NO build/cutover (P0 boundary).

### C-class service interpreters (irbridge 3.14 / videobridge 3.14 / xiaomusic 3.13)

Packet shape per service: census script pip deps → import test under ARM python@3.14 →
plist PATH/env edit → launchd restart smoke → rollback = original plist .bak + restart.
All THREE are user-domain personal services; cutover gated on production slot per
PARALLEL_BOUNDARY (they are live listeners 8091/8092/8090).

## PHASE 6 — Intel Homebrew retirement gates (mechanically measured, raw/50)

| GATE | MEASURED VALUE | MET? |
|---|---|---|
| ACTIVE_BREW_SERVICES_X64 | 2 of 3 started services (postgresql@16, syncthing; third = ollama, arm64, outside gate) — tailscale user svc retired r2 | NO |
| CRITICAL_CLI_RESOLUTION_TO_INTEL | 0 (login shell, 30-command critical set) | YES |
| LAUNCHD_REQUIRED_INTEL_PATHS | 21 active plists reference /usr/local — breakdown: F/P0-owned (agent-core family ×6, dsh-lark, canary, authsvc ×2), C-class packets (irbridge/videobridge/xiaomusic), legacy (openclaw ×3), system daemon (tailscaled), stateful (postgres/syncthing), opencode.server (path only — binary is arm64) | NO |
| ACTIVE_SCRIPT_REQUIRED_INTEL_PATHS | 1 script (run_xiaomusic.sh, 2 refs — part of xiaomusic C packet); serve-web/check/health-check = 0 | YES* (*xiaomusic packet covers it) |
| STATEFUL_DATA_DEPENDENCY_ON_INTEL_CELLAR | 1 (postgresql@16 data root under /usr/local/var; syncthing data outside Cellar) | NO |
| OTHER_GOAL_DEPENDENCY_ON_INTEL_BREW | DSH node-runtime under /usr/local/libexec = standalone, not Cellar (boundary evidence) | documented |
| **VERDICT** | **RETIREMENT = NO — gates not met; re-measure after D4/D6 cutovers + C-class packets + F-family handoff from DSH Goal** | |

## Milestone/boundary state

- No new production mutations; all boundaries honored (PG cutover HOLD, syncthing not
  enabled, services untouched, no token/API-key handling, no new privileged actions).
- Terminal boundary (COMPLETE_WHEN) still pending on: D4/D6/D8-D10 cutovers (slot),
  DSH F-family (other Goal), openclaw legacy retirement (owner-goal caution), GUI apps
  (FOLLOW_UP_DEBT by design). Goal continues at next legal lane.

## r3 focused audit (ONE fresh independent read-only subagent, 2026-09-07 21:5x)

VERDICT = ACCEPT, BLOCKERS = []
Checklist 1–8 all PASS (live re-verification of java/gradle/ngrok/whisper resolution,
dormant mtimes, production non-mutation, PG hazard, gate re-measurement, secret scan,
manifest 68/68 self-consistent).
Concern dispositions:
- C1: /Library/LaunchDaemons/com.auth-service.plist mtime Sep 7 17:07 (root) — outside
  r3's window (21:16+); this Goal holds no sudo and performed no such mutation.
  Attribution: P0-slot deployment activity (authsvc system domain is F/P0-owned).
  Recorded as external observation; P0 Goal's own trail is authoritative.
- C2: G1 clarified — 3 brew services started total, of which 2 are x64 (postgresql@16,
  syncthing); ollama is arm64 (correctly outside the X64-only gate).
