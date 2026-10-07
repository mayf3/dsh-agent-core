# 12_XIAOMUSIC_C2_CUTOVER_EXECUTION_ROLLBACK — C2 attempt failed at bootstrap, exact rollback verified (2026-10-07)

Round r373 of record. Task = mayf3/agent-control#550, CLAIM_TOKEN `g10-xiaomusic-c2-cutover-r373`,
session `sess_a43bc28f…` (continued), packet = XIAOMUSIC-PACKET-C2 @ evidence commit `ede7b842`
on branch `ac-task/543` (amended head of the `27f73d2e` authoring commit — identical content;
raw/54 renamed `.log`→`.txt` to satisfy the repo `*.log` gitignore, manifest updated; referenced
below as PACKET). Directing authority: #386 standing delivery authority + rollback-first policy;
PROD_AUTH = AUTHORIZED_STANDING_IF_FROZEN_PACKET_PASSES.

VERDICT UP FRONT: **C2 cutover NOT completed.** First reload failed (`launchctl bootstrap`
exit 5, Input/output error). Exact rollback executed per frozen contract: original plist
restored byte-exact, bootstrap exit 0, service healthy on the ORIGINAL intel x86_64
generation (new pid 23900, runs=1, 8090 LISTEN, GET / → 401). Production lane released.

## §1 FRESH_PACKET_IDENTITY = PASS (zero drift)

Every preflight axis matched PACKET §6 preimage exactly (full table in raw/59 source
commands + #550 round): plist sha256 `e23d0371695260f1a2aec5b4d3ce56c60bce088c21bec69baa9fb2d2325632e0`
(1100 B, mode 0600, yanfenma:staff, mtime 2026-09-18T22:14:28), pid 1324 runs=1 never-exited,
`*:8090` LISTEN v4+v6, GET / → 401, console script sha `17e9f627…` → intel Cellar
python@3.13 3.13.3 x86_64, xiaomusic 0.3.78, ARM target 3.13.14 arm64 present, target venv
slot free, packet tree clean at HEAD. DISK: 61 Gi free; need ≈144 MB (venv) + 1100 B backup —
budget trivially met (non-Agent-Core tree; 50 GiB floor not triggered).

## §2 CONFLICT_CHECK = PASS

#546 (Product #388 dashboard P1 fixes) = source-only, explicitly defers install/activation —
zero overlap with com.xiaomusic.secure/venv/8090. #548 (scheduler natural-dispatch recovery) =
existing admin/settlement tools on the Agent Core scheduler, explicitly 非生产竞争 — different
platform surface. #549/#547 unrelated. This round's effects: com.xiaomusic.secure plist + job,
new venv dir, evidence tree only.

## §3 PREIMAGE = PASS

`/Users/yanfenma/Library/LaunchAgents/com.xiaomusic.secure.plist.bak-armnorm-c2-20261007-172814`
(cp -p; sha == frozen; mode 0600; cmp byte-identical). Retained in place until acceptance.

## §4 VENV_REPLAY = PASS

`~/Library/PythonEnvs/xiaomusic-arm64` built from frozen 54-pin set (raw/55) with
`--index-url https://pypi.org/simple --only-binary=:all:` → version-identical distribution set
(54/54), pip check clean, interpreter 3.13.14 arm64, all import asserts PASS
(xiaomusic 0.3.78 + xiaomusic.cli:main + 14 closure modules), all `.so` carry arm64 slice,
console script `bin/xiaomusic` shebang → venv python, 144 MB. **Retained** for the next round.

## §5 MUTATION = FAILED → ROLLED BACK (two-primitive record)

1. `/usr/lib/PlistBuddy` absent on this OS. `plutil -replace 'ProgramArguments.0'` **APPENDED**
   an element instead of replacing (4-arg array, size 1100→1088) — caught by the normalized-diff
   gate BEFORE any reload; discarded via byte restore; sha re-verified frozen.
2. plistlib single-key edit: structured diff = EXACTLY the one ProgramArguments[0] line, lint OK,
   mode 0600 — but `launchctl bootstrap gui/502/…` rejected the file: **exit 5 (Input/output
   error)** after a clean `bootout` exit 0. The ORIGINAL bytes (restored byte-exact) bootstrap
   exit 0 immediately during rollback → failure tracks the plistlib XML serialization
   (lint ≠ launchd validation), not a bootout race. Rejected-bytes artifact preserved at
   raw/60-c2-rejected-plist/ (evidence only, never loaded).

Downtime window ≈ 70 s (17:30:03 bootout → 17:31:0x rollback bootstrap). KeepAlive had no
crash-loop (job never started from the rejected file).

## §6 ROLLBACK_STATUS = TRIGGERED AND SUCCEEDED

cp -p restore (sha `e23d0371…` exact) → bootstrap exit 0 → state=running, NEW pid 23900,
runs=1, program `/usr/local/bin/xiaomusic`, exec = intel Cellar 3.13.3 framework (x86_64),
8090 LISTEN ×2, GET / → 401 in 9 ms. Post-rollback stderr segment opens with pid 1324's
graceful shutdown lines (clean bootout) then the 23900 startup. Stability re-checked: runs
still 1, 401 alive, listener ×2.

## §7 LOG/TRACEBACK CLASSIFICATION (honest canary note)

Post-rollback segment contains 2 Tracebacks = miservice Mi-account login failures
(code 70016 登录验证失败) + "conf/.mi.token file not exist". BASELINE: the Oct-1 original
startup window of this same log holds 12× 70016, the same .mi.token-missing warning and 47
tracebacks; steady state logs ~604 "All retries failed" warnings per 300 KB. => Pre-existing
environmental condition (token absent since the Sep-18 hardening), restart-attributable, NOT
migration-attributable (the ARM process never ran). ERRATUM CANDIDATE for the amended packet:
scope the zero-Traceback canary to exclude this known Mi-login-70016 startup pattern, else
every cutover canary fails on a pre-existing condition. Links to census GAP-2 (credential
hygiene is owner-gated).

## §8 C2_ACCEPTANCE / DEVICE_LEVEL_PENDING

C2_ACCEPTANCE = **FAILED_ROLLED_BACK** (first reload failure ⇒ deterministic rollback; C2 NOT
installed). INSTALLED/ENABLED remain C1-only (C2_NOT_YET). DEVICE_LEVEL_PENDING = YES and
unchanged: owner-assisted speaker playback remains explicitly pending/UNKNOWN and was not
synthesized. The Mi-login degradation above is itself a standing business-health caveat on
ANY generation, owner-visible via census GAP-2.

## §9 PACKET ERRATA / NEXT BOUNDED ACTION (packet amendment, OFF-lane)

1. **Edit primitive**: `plutil -replace` on an array index appends on this OS; `/usr/lib/PlistBuddy`
   absent; plistlib serialization is bootstrap-rejected (5). AMEND PACKET §6 to specify the
   verified primitive for next round: candidates to prove OFF-lane first (dummy-label plist in
   user domain, then delete): (a) plistlib dump + `plutil -convert xml1` normalization round-trip;
   (b) `/usr/bin/python3`-hosted CF plist via `plutil` only for validation. The amend MUST land a
   byte-exact primitive proof before the retry round.
2. **Canary amendment**: zero-Traceback canary scoped to exclude the known startup Mi-login-70016
   environmental pattern (§7), keeping all other hard canaries unchanged.
3. Venv (§4) and preimage backup (§3) are already in place and reusable by the retry round after
   fresh drift re-verification.

## §10 Boundary statement

PRODUCTION_MUTATION = YES (single bounded user-domain attempt: bootout + failed bootstrap +
rollback reload; net live effect = same-generation restart of com.xiaomusic.secure only, config
byte-identical to frozen preimage, no other job/system/domain touched). No sudo, no
system-domain action, no credential/config-value/data mutation (setting.json/admin-credentials/
.mi.token/log payloads untouched; only metadata-level log reads). No census/source/review
reopened; B7/D4/D6/G9/F-family/Agent Core production untouched. Lane released; retry requires a
new bounded round against the amended packet.
