# 11_XIAOMUSIC_C2_ARM_CENSUS_PACKET_R1 — xiaomusic C2 bounded NON_PRODUCTION census + packet freeze (2026-10-07)

Round r370 of record. Task = mayf3/agent-control#543, CLAIM_TOKEN `g10-xiaomusic-c2-census-r370`,
session `sess_a43bc28f-b5ab-4a86-81ad-c342771a39a1`, base HEAD `e9699aee` (branch `ac-task/543`).
Directing authority: Product #483 (G10) round-370 claim; prerequisite inventory from
`09_CCLASS_PREFLIGHT_PACKETS_R4.md` §4 (xiaomusic C2 packet: pip-dep census, isolated ARM
py3.13 import proof, credential-path treatment, G4 `run_xiaomusic.sh` intel-ref disposition,
plist preimage freeze) + agent-control#541 terminal PRODUCT_483_REMAINING item 1.
C1 (irbridge) evidence lives on preserved `ac-task/528`: packet @`6fa857f2`, execution @`cb72b928`.
SCOPE = NON_PRODUCTION ONLY: census / isolated test-identity venv / credential-path
classification / packet freeze. NO service restart/cutover, NO sudo, NO launchd mutation,
NO config/data/credential mutation, NO production apply, NO G9/F-family/B7 expansion.

## §1 Fresh launch-owner / topology verification (read-only, 2026-10-07 ~08:45–08:57Z)

| FIELD | VALUE | vs frozen r4 baseline (09 §1) |
|---|---|---|
| PLIST | `~/Library/LaunchAgents/com.xiaomusic.secure.plist`, 1100 B, mode 0600, owner yanfenma:staff, mtime 2026-09-18T22:14:28 | mtime/size match |
| PLIST_SHA256 | `e23d0371695260f1a2aec5b4d3ce56c60bce088c21bec69baa9fb2d2325632e0` | **matches r4 frozen prefix — ZERO DRIFT** |
| LABEL / OWNER | com.xiaomusic.secure, user domain (gui/502), KeepAlive+RunAtLoad | match |
| LIVE PROCESS | pid **1324**, started 2026-10-01 19:34:27, `runs = 1`, last exit `(never exited)` | match (same pid as r4) |
| LISTENER | `*:8090` LISTEN (IPv4 + IPv6, both held by pid 1324) | match |
| HTTP PROBE | `GET / → 401` (fast; service auth-gated — NO credential-bearing requests made, per boundary) | r4 recorded listener only; 401 = alive signal |
| PROGRAM | `/usr/local/bin/xiaomusic --config /Users/yanfenma/workspace/baby/xiaoai/conf/setting.json` (from launchctl + plist structured dump, raw/52) | match |
| SYSTEM-DOMAIN DUP | none (`/Library/LaunchDaemons/` has no xiaomusic entry; disabled-map `com.xiaomusic` entry = stale pre-rename legacy label, as adjudicated in 09 §1) | match |

Raw evidence: raw/51 (live anchor + post-test re-anchor), raw/52 (plist identity/structured dump).

## §2 CENSUS — intel-side runtime + pip dependency closure (raw/53)

| FIELD | VALUE |
|---|---|
| CURRENT_INTERPRETER | console-script shebang `/usr/local/opt/python@3.13/bin/python3.13` → `/usr/local/Cellar/python@3.13/3.13.3` = Python **3.13.3 x86_64** (Rosetta), Mach-O x86_64 verified |
| LIVE EXEC | pid 1324 runs the real framework binary `/usr/local/Cellar/python@3.13/3.13.3/Frameworks/…/Python` |
| CONSOLE SCRIPT | `/usr/local/bin/xiaomusic`, 237 B, mtime 2025-04-13, sha256 `17e9f6272ba44d2ef8fbcd620b001de7f09c732c9f363880805265cbb6032aa2`, entry `xiaomusic.cli:main` |
| PACKAGE | xiaomusic **0.3.78** @ `/usr/local/lib/python3.13/site-packages` |
| DIRECT REQUIRES (17, verbatim markers) | aiohttp>=3.8.6, miservice-fork>=2.7.0, watchdog>=6.0.0, mutagen>=1.47.0, yt-dlp[default]>=2024.12.1.232904.dev0, uvicorn>=0.30.1, fastapi>=0.115.4, starlette>=0.37.2, aiofiles>=24.1.0, ga4mp>=2.0.4, apscheduler>=3.10.4, opencc-python-reimplemented==0.1.7, pillow>=10.4.0, python-multipart>=0.0.12, requests>=2.32.3, sentry-sdk[fastapi]==1.45.1, python-socketio>=5.12.1 |
| MISERVICE FAMILY | miservice-fork 2.8.0 (intel live) |
| SHARED-ENV NOTE | the intel 3.13 site-packages is a shared environment (jupyter stack etc.); the xiaomusic closure is the 17 direct requires + their transitive closure only. The authoritative transitive resolution is the ARM venv freeze (§3, raw/55), not the shared env |

## §3 ARM_IMPORT_PROOF — isolated ARM Python 3.13 test identity (raw/54–56)

Test identity (disposable, /tmp only, referenced by nothing):
`/tmp/xiaomusic-c2-arm-census-r370/venv`, recipe below. Live service untouched throughout
(proof at §3 end + raw/51 re-anchor).

| FIELD | VALUE |
|---|---|
| ARM_TARGET | `/opt/homebrew/opt/python@3.13/bin/python3.13` = Python **3.13.14 arm64** (version-pinned opt path, brew-upgrade-immune); Mach-O arm64 verified |
| VERSION SHAPE | same minor 3.13, patch-forward 3.13.3 → 3.13.14 (identical pattern to C1: 3.14.5 → 3.14.7) |
| INSTALL | `python3.13 -m venv <T>/venv` then `pip install --index-url https://pypi.org/simple --only-binary=:all: xiaomusic==0.3.78` — exit 0 |
| INDEX NOTE | the host-default tsinghua mirror returned NO versions for xiaomusic ("from versions: none"); official `https://pypi.org/simple` required — replay command MUST pin the index (packet precondition) |
| CLOSURE RESOLVED | **54 distributions** (raw/55 = exact replay pin set); `pip check` → "No broken requirements found." |
| WHEEL ARCHITECTURE | every C-extension wheel downloaded as `cp313-cp313-macosx_11_0_arm64` (aiohttp 3.14.4, multidict 6.9.1, yarl 1.25.1, frozenlist 1.8.0, propcache 0.5.4, pillow 12.3.0, pydantic-core 2.46.5); install forced `--only-binary=:all:` so no source builds occurred |
| .SO AUDIT | 62 `.so` files in the venv: **0 files without an arm64 slice** (x86_64 lines in file(1) output are slices inside Mach-O universal2 binaries) |
| IMPORT PROOF | under `python -I` (isolated): `import xiaomusic` (dist 0.3.78), `from xiaomusic.cli import main` (callable), plus aiohttp, PIL, multidict, frozenlist, yarl, propcache, charset_normalizer, brotli, Cryptodome, apscheduler, fastapi, uvicorn, mutagen, miservice — ALL PASS, exit 0 |
| COMPILE | `compileall` over the xiaomusic package — PASS |
| VENV CONSOLE SCRIPT | `venv/bin/xiaomusic` (205 B, sha256 `44273f0d14bd70c3119c8b43088d053a3f3c8cf01a81250fdae3487f638d4fc7`), shebang = absolute venv python path → arm64 (single-file swap target for the plist) |
| SIZE / DISK BUDGET | venv 144 MB (measured); plist backup 1100 B; Data-volume floor rules not triggered (non-Agent-Core tree) |
| NO_LIVE_EFFECT_PROOF | tests are offline (PyPI download + local imports only; server main() never invoked; zero binds); post-test re-anchor: pid 1324 continuous, `runs = 1` (never restarted), 8090 LISTEN ×2, `GET / → 401`; secure_launchd_stdout/stderr growth during the window is the app's own steady logging (sizes/mtime recorded pre/post in raw/51); no PID files touched |

Version drift intel-live → ARM-fresh (same-version-range forward resolution; sentry-sdk
1.45.1, opencc 0.1.7, watchdog 6.0.0 pinned identical): aiohttp 3.11.16→3.14.4,
miservice-fork 2.8.0→**2.9.3**, fastapi 0.115.12→0.142.2, starlette 0.46.1→1.7.0,
pydantic 2.11.3→2.13.5, pillow 11.1.0→12.3.0, uvicorn 0.34.0→0.54.0, requests
2.32.3→2.34.2, mutagen 1.47.0→1.48.1, aiofiles 24.1.0→25.1.0, yt-dlp
2025.4.6.232826.dev0→2026.9.27.232945.dev0. These are range-resolved forwards; the cutover
replays the FROZEN pin set (raw/55) for determinism — see §9 GAP-1.

## §4 CREDENTIAL_PATH_DISPOSITION (metadata/classification only — ZERO credential content read)

| PATH | CLASSIFICATION (metadata) | DISPOSITION |
|---|---|---|
| `~/workspace/baby/xiaoai/conf/setting.json` | service config, **credential-bearing** (xiaomi account + web auth; classification from service contract + 401 behavior — content NOT read). 8787 B, mode **0644**, owner yanfenma:staff, mtime 2026-09-18T22:19:01, sha256 `0a36d0bdf5339f8c6a997d61e9a4e393e92620b8dd9fd406f7f567d2054e36aa` (preimage freeze only) | stays in place, UNTOUCHED through C2 (service reads it via unchanged `--config` arg; packet never reads/copies it). EXPOSURE OBSERVATION: mode 0644 = group/other-readable inside a 0755 dir; AND file is **git-TRACKED with local modifications** in the xiaoai repo (`git status: M conf/setting.json`) → prior credential-bearing versions are recoverable from that repo's history. Hardening (chmod 0600 / untrack + history purge) = owner-decision items, NOT executed here (config/history mutation out of scope) |
| `~/workspace/baby/xiaoai/conf/admin-credentials.txt` | explicit-credential file. 189 B, mode 0600, mtime 2026-09-18 22:16, git-untracked | NOT read. Leave untouched. Out of invocation path (plist passes only setting.json) |
| `~/workspace/baby/xiaoai/conf/setting.json.bak.20260526` | legacy config backup, presumptively credential-bearing. 6713 B, mode 0600, git-untracked | NOT read. Leave untouched |
| git-tracked `conf/.mi.token` (deleted from worktree) | miservice session-token file, **still recoverable from xiaoai repo history** (`git status: D conf/.mi.token`; file absent on disk at `~/.mi.token`, `xiaoai/.mi.token`, `conf/.mi.token` — live service re-authenticates in-process at boot) | owner-decision item (history purge); OUT of C2 scope; recorded as GAP-2 |
| `~/Library/LaunchAgents/com.xiaomusic.secure.plist` | NO credential bytes (structured dump verified: env = HOME/PATH only; config passed by path) | safe to reproduce in evidence; sha256-frozen preimage (§6) |
| `~/workspace/baby/xiaoai/run_xiaomusic.sh` | legacy launcher; secret-pattern scan CLEAN (raw/58) | leave untouched (§5) |
| logs (`secure_launchd_{stdout,stderr}.log`, `xiaomusic.log.txt[.1]`) | service logs (may contain operational data; not opened) | NOT read/truncated. Hygiene observation: `secure_launchd_stderr.log` = **676 MB** (GAP-3) |
| music/data dirs (`music/`, `all_raw_music/`, `peiqi/`, `cache/`, media seasons) | stateful service data | untouched |

## §5 G4 disposition — `run_xiaomusic.sh` intel refs (raw/58)

- Script `~/workspace/baby/xiaoai/run_xiaomusic.sh` (2630 B, sha256 in raw/58, mode rwx--x--x)
  carries exactly **2 `/usr/local` refs** (PATH export line + its comment) — matches the
  Phase-6 G4 measurement (ACTIVE_SCRIPT_REQUIRED_INTEL_PATHS = 1 script, 2 refs).
- It is **referenced by NOTHING active**: the only launchd job touching the xiaoai dir is
  `com.xiaomusic.secure`, which invokes the console script directly (bypasses the launcher);
  all xiaomusic crontab entries have been commented out since 2026-09-13
  ("SECURITY-CONTAINED … while on untrusted networks"). Legacy-inert.
- DISPOSITION: leave the script byte-untouched through C2 (it is not in the active invocation
  path; mutation would be out of scope). It drops out of G4's "ACTIVE script" class on that
  basis already; post-cutover re-measure records the accounting.
- RESIDUAL (recorded, not actioned): plist `EnvironmentVariables.PATH` =
  `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin` → the service (and yt-dlp children) resolve
  `/usr/local/bin/ffmpeg` = intel Cellar ffmpeg 8.1.1, today and identically post-cutover
  (ARM ffmpeg 9.0.1_1 exists at /opt/homebrew/bin but is NOT on the plist PATH). Behavior is
  cutover-invariant; changing PATH would alter child-process behavior and is NOT part of this
  packet (single-line-edit purity). G3 accounting note: post-cutover the plist retains this
  env-PATH /usr/local reference even though the EXECUTING intel-path consumer (Program
  Arguments[0]) is gone.

## §6 XIAOMUSIC-PACKET-C2 — candidate identity FROZEN (cutover = separate production-slot round; NOT executed here)

| FIELD | VALUE |
|---|---|
| ARTIFACT | `~/Library/LaunchAgents/com.xiaomusic.secure.plist` (1100 B, mode 0600, mtime 2026-09-18T22:14:28) |
| ARTIFACT_SHA256 | `e23d0371695260f1a2aec5b4d3ce56c60bce088c21bec69baa9fb2d2325632e0` |
| PROGRAM_ARGUMENTS (pre) | `[ /usr/local/bin/xiaomusic , --config , /Users/yanfenma/workspace/baby/xiaoai/conf/setting.json ]` (WorkingDirectory `~/workspace/baby/xiaoai`; no credentials in plist) |
| CURRENT_RUNTIME | console script sha `17e9f627…` → intel Cellar python@3.13 **3.13.3 x86_64**; xiaomusic 0.3.78 @ /usr/local/lib/python3.13/site-packages |
| LIVE_PROCESS_PREIMAGE | pid 1324 since 2026-10-01 19:34:27, runs=1, *:8090 LISTEN, GET / → 401 |
| ARM_TARGET | `/opt/homebrew/opt/python@3.13/bin/python3.13` = Python **3.13.14 arm64** (pinned opt path) |
| TARGET_IDENTITY | service venv `~/Library/PythonEnvs/xiaomusic-arm64` (mirrors C1 convention) + venv console script `bin/xiaomusic` as new ProgramArguments[0] **[AMENDED r380 → 14 §6]** console-script arg0 candidate is NOT installable on the same label (launchd script-arg0 changed-bytes re-load gate, exit 5, ≥6 min/≤20 min); remedies: (A) owner-gated fresh-label candidate (recommended) or (B) owner-approved downtime window — 14 §6 |
| REPLAY (venv build at cutover time) | `/opt/homebrew/opt/python@3.13/bin/python3.13 -m venv ~/Library/PythonEnvs/xiaomusic-arm64` ; `~/Library/PythonEnvs/xiaomusic-arm64/bin/pip install --index-url https://pypi.org/simple --only-binary=:all: -r <frozen requirements>` where requirements = raw/55 (54 pins, xiaomusic==0.3.78) ; then `pip check` + re-run the §3 isolated import asserts against the service venv |
| PLIST EDIT | **[AMENDED r376 → 13 §2]** primitive = `scripts/c2-apply-program-args0-edit.sh` (deterministic single-line byte substitution; candidate bytes pre-frozen `raw/61`, sha256 `01db501d…`, post-edit file MUST sha-match raw/61 BEFORE any reload). Original PlistBuddy wording SUPERSEDED: `/usr/lib/PlistBuddy` ABSENT on this OS; `plutil -replace ProgramArguments.0` INSERTS an element (4-arg corruption); plistlib dump / `plutil -convert xml1` / `defaults write` all emit non-packet forms — proof 13 §3, raw/62. **[AMENDED r380]** the r376 "launchd-rejected (tab-indented)" reading is superseded: serialization form is exonerated (14 §1) — raw/60's rejection was the script-arg0 changed-bytes re-load gate, not the tab form. ProgramArguments[0] → `/Users/yanfenma/Library/PythonEnvs/xiaomusic-arm64/bin/xiaomusic`. NOTHING else changes (config arg, WorkingDirectory, env, logs untouched). Normalized diff = exactly one line. `plutil -lint` required (note: lint ≠ launchd acceptance — form guard is the raw/61 sha match) |
| RELOAD | user-domain `launchctl bootout gui/$(id -u)/com.xiaomusic.secure` → `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.xiaomusic.secure.plist` (C1 erratum inherited: `kickstart -k` alone does NOT load an on-disk plist edit). No sudo. **[AMENDED r380 → 14 §1/§6]** changed-bytes bootstrap of this label exits 5 (re-load gate, ≥6 min, expires ≤ +20 min on the single-poke protocol — K6, raw/63) = CLASSIFIED expected failure, not a new unknown; rollback bootstrap of byte-exact preimage needs a short settle (accepts at ≥6-8 s; poll 2 s, cap 30 s) |
| CANARY_PROCESS | launchctl print: state=running, NEW pid, runs=2, then stable / never-exit re-check |
| CANARY_LISTEN | `*:8090` LISTEN held by the new pid |
| CANARY_HTTP_ALIVE | `GET / → 401` within 30 s (auth-gated alive signal; NO credential-bearing or authenticated request may be synthesized against 8090) |
| CANARY_LOG | `secure_launchd_stderr.log` gains xiaomusic startup line(s) for the new pid; **[AMENDED r376 → 13 §4]** zero MIGRATION-ATTRIBUTABLE traceback classes in the post-start window (ImportError/dyld/arm64-load/app-fatal/etc. = FAIL); known pre-existing Mi-login **70016 / .mi.token-missing** environmental baseline (raw/59: Oct-1 window 12× 70016, 47 tracebacks; steady-state 604 retry-warnings/300KB) is EXPECTED and non-failing; `xiaomusic.log.txt` keeps rotating |
| CANARY_IDENTITY | new pid's exec = `~/Library/PythonEnvs/xiaomusic-arm64` framework Python, `file` = arm64 (txt-lib check per C1 style) |
| CANARY_BUSINESS (soft, hardware) | owner-assisted speaker playback canary pending — like C1's device canary, do NOT synthesize; absence keeps BUSINESS_VERIFIED at HEALTH_LEVEL for the C2 slice |
| ROLLBACK | `cp -p` restore of timestamped preimage backup `com.xiaomusic.secure.plist.bak-armnorm-c2-<ts>` (byte-copy, sha==ARTIFACT_SHA256, mode 0600 preserved) → bootout→bootstrap → verify pid + 8090 LISTEN + GET / → 401 + startup log. Intel python@3.13 Cellar, `/usr/local/bin/xiaomusic`, and `/usr/local/lib/python3.13/site-packages` remain untouched throughout (rollback needs none of them removed); ARM venv removal optional/additive |
| POST-CUTOVER | re-measure Phase-6 gates (G3/G4 accounting per §5 residual note); update Product #483 truth C2-slice INSTALLED/ENABLED/BUSINESS_VERIFIED from evidence only |
| PARALLEL_BOUNDARY | cutover is a live-listener (8090) restart = production-slot-gated separate round under standing authority; this packet is the frozen preimage/rollback/canary contract for that slot-holder |

AMENDMENT RECORD: r373 cutover FAILED at first bootstrap (exit 5) → exact rollback; r376
errata = root cause (tab-indented XML rejected by launchd), proven edit primitive, canary
environmental-baseline classification, retry stop conditions — authoritative record
`13_XIAOMUSIC_C2_PACKET_ERRATA_R376.md`; packet rows above amended in place with
[AMENDED r376] markers; all other §6 rows unchanged.
AMENDMENT r380: r376 root cause SUPERSEDED — dummy-label probe matrix (raw/63,
`14_XIAOMUSIC_C2_REROOTCAUSE_R380.md` §1/§2) proves the operative trigger is the launchd
script-arg0 changed-bytes re-load gate (exit 5), form- and file-property-independent;
rows TARGET_IDENTITY / PLIST EDIT / RELOAD amended in place with [AMENDED r380] markers;
candidate re-shape owner-gated (14 §6 remedies A/B); all other §6 rows unchanged.

## §7 CONFLICT_CHECK (fresh, 2026-10-07 ~08:45–08:57Z)

- Product #394 / agent-control#538 — **terminal COMPLETED 08:37:22Z**: controller/relay
  activation at `~/workspace/agent-control` prefix, `~/.local/bin/chatgpt-relay`,
  controller launchd reload, `~/.local/share/chatgpt-local-controller/activation-538-*`.
  Zero surface shared with this slice (no agent-control prefix, no relay, no controller
  state, no launchd writes by this lane).
- Product #388 / agent-control#539 — **terminal COMPLETED 08:49:02Z**: PR agent-control#544
  opened (nothing merged/installed/restarted; worktree
  `~/workspace/agent-workspaces/ac-531-dashboard-timeseries`). Zero overlap with this slice's
  surfaces (evidence dir on `ac-task/543`, /tmp test identity, read-only host inspections).
- agent-control#545 ([B7]) exists OPEN but has no LOCAL_AGENT receipt / no running writer at
  check time; its binding class (SOURCE + isolated test) is disjoint from this slice regardless.
- This lane's writes: `/tmp/xiaomusic-c2-arm-census-r370` (new, disposable), evidence files in
  its OWN claimed worktree `ac-543` (branch `ac-task/543`), GitHub truth updates
  (Product #483 body append + task-issue result). No file/effect overlap with any live writer.

## §8 GAPS (non-blocking, recorded for owner / future rounds)

1. **GAP-1 closure float**: unconstrained ranges resolved newer deps on ARM than intel-live
   (e.g. miservice-fork 2.8.0→2.9.3, starlette 0.46→1.7). Mitigated: cutover replays the
   frozen 54-pin set (raw/55) + import asserts; canaries cover runtime health. Residual risk
   accepted by the same pattern as C1.
2. **GAP-2 credential hygiene (owner decisions, NOT executed)**: `conf/setting.json` is mode
   0644 AND git-tracked-with-modifications in the xiaoai repo; a deleted-but-tracked
   `conf/.mi.token` remains recoverable from that repo history. Candidate bounded follow-up
   (owner-gated, config/history mutation): chmod 0600, `git rm --cached` + gitignore conf
   secrets, history scrub decision.
3. **GAP-3 log hygiene**: `secure_launchd_stderr.log` at 676 MB — truncate/rotate is a data
   mutation, out of scope; noted for owner.
4. **GAP-4 business canary**: speaker-playback verification needs the hardware/owner (same
   class as C1's pending device canary); HEALTH_LEVEL acceptance ceiling without it.
5. **GAP-5 index pin**: host pip default (tsinghua) cannot resolve xiaomusic; replay MUST pin
   `--index-url https://pypi.org/simple` (baked into §6 REPLAY).
6. **GAP-6 PATH residual**: intel ffmpeg 8.1.1 stays the resolved ffmpeg for the service
   (plist PATH, §5) post-cutover; ARM ffmpeg exists off-PATH. Behavior-invariant; PATH change
   deliberately excluded from the single-line packet.

## §9 Boundary statement

PRODUCTION_MUTATION = NO. Zero service start/stop/restart/cutover; zero sudo; zero launchd
mutation; zero config/data/credential mutation (only /tmp test-identity writes + this
evidence tree); zero credential content reads (setting.json / admin-credentials.txt / backups
never opened; only metadata + preimage sha). Secret guard: this file contains no
token/credential bytes (device/account addressing stays inside sha-covered files; config
contents not reproduced). MANIFEST.sha256 regenerated for this evidence tree.
