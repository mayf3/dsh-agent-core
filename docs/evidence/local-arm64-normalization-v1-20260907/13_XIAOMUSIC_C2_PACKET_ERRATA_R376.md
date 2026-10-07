# 13_XIAOMUSIC_C2_PACKET_ERRATA_R376 — root cause, proven edit primitive, canary amendment (2026-10-07)

Round r376 of record. Task = mayf3/agent-control#558, CLAIM_TOKEN
`g10-xiaomusic-c2-packet-errata-r376`, base HEAD `60eba40b` (branch `ac-task/558`,
fast-forward of the ac-task/543 evidence lineage). Directing authority: #386 standing
delivery authority + rollback-first policy; Product #483 round-376 claim.
SCOPE = NON_PRODUCTION ONLY: fixture-based primitive proof (/tmp copies of the frozen
preimage), packet amendment. NO service restart/cutover, NO sudo, NO launchd mutation
(no bootout/bootstrap/kickstart of ANY label, live or dummy), NO config/data/credential
mutation, NO playback synthesis. Live plist accessed READ-ONLY (cp -p to fixtures).

NOTE ON DOC 12 §9: its proof suggestion ("dummy-label plist in user domain, then
delete") is SUPERSEDED by this round's strictly fixture-only method — the current
command forbids all launchd mutation. Substituted proof: byte-form identity of the
candidate against a serialization form launchd demonstrably accepts — the original
bytes loaded at the Sep-18 original start and bootstrapped exit 0 during the r373
rollback (2026-10-07 17:31 local / raw/59 transcript stamped 09:34:03Z).

## §1 ROOT_CAUSE (failure of agent-control#550, r373)

`launchctl bootstrap gui/502` rejected the plistlib-serialized plist with **exit 5
(Input/output error) while the original bytes bootstrap exit 0**, `plutil -lint` passing
on both. Byte comparison of the live-accepted preimage (sha `e23d0371…`, space-indented
XML) against the preserved rejected artifact (`raw/60`, sha `b8fcc4b3e2d2806d…`) shows
the ONLY serialization-form delta is **indentation: 4/8 spaces (accepted) vs TABs
(rejected)** — plus the intended single ProgramArguments[0] content line.

Closure proof (raw/62 RED R2): re-running the same order-preserving plistlib edit
(`plistlib.dump(..., sort_keys=False)`) on a fixture copy of the preimage reproduces
`raw/60` **byte-identically** (sha `b8fcc4b3…` exact) — the rejected file is exactly
plistlib's output, and its distinguishing property vs the accepted file is the tab
indentation (plistlib's XML writer hardcodes tabs).

Conclusion: on this OS (macOS 26.6.2 / darwin 25.6.0) launchd's plist parser rejects
tab-indented XML at bootstrap (EIO 5); the 4/8-space-indented form of this file is
accepted (loaded since Sep-18; bootstrapped exit 0 at 09:35 during the r373 rollback).
`plutil -lint` validates via the lenient CoreFoundation parser — **lint OK ≠ launchd
acceptance**; lint must not be treated as a reload-readiness oracle.

Secondary finding (raw/62 RED R1): `plutil -replace 'ProgramArguments.0' -string …`
on this OS does NOT replace the array element — it **inserts an extra element at the
subscript position**, yielding a 4-element ProgramArguments
`[ <new>, /usr/local/bin/xiaomusic, --config, setting.json ]` (r373 caught this
pre-reload with the diff gate; reproduced on fixtures; this corrects doc 12 §5's
"APPENDED" wording — observed behavior is insert-at-subscript, operative conclusion
identical: numeric subscripts in plutil keypaths are unusable for replacement).
`/usr/lib/PlistBuddy` is absent on this OS.

EVIDENCE SCOPE: the form conclusion rests on one rejected tab-form bootstrap vs the
accepted space-form loads; fixtures cannot fully exclude the changed arg0 VALUE as an
alternative trigger for that single rejection (lint passes and launchd resolves the
program only at spawn, not at parse, so content-cause is unlikely but not fixture-
falsifiable). The retry's stop-condition 4 (first failure → immediate rollback) is the
final arbiter; the primitive's correctness depends only on preserving the accepted form.

## §2 EDIT_PRIMITIVE (frozen for the C2 retry round)

Primitive = **deterministic single-line byte substitution** on the sha-pinned preimage:
replace the unique 8-space-indented line
`        <string>/usr/local/bin/xiaomusic</string>\n`
with
`        <string>/Users/yanfenma/Library/PythonEnvs/xiaomusic-arm64/bin/xiaomusic</string>\n`
leaving every other byte of the accepted serialization EXACTLY unchanged.

| FIELD | VALUE |
|---|---|
| SCRIPT | `scripts/c2-apply-program-args0-edit.sh` sha256 `11c29f14ac13c53dcd730242e518315d45a43a4ad1bf37c64a384320f9c993b9` |
| USAGE | `c2-apply-program-args0-edit.sh <TARGET_PLIST> <BACKUP_PLIST> <EXPECTED_PREIMAGE_SHA256> <NEW_ARG0>` |
| DRIFT GATE | target AND backup sha256 must equal the frozen preimage sha `e23d0371695260f1a2aec5b4d3ce56c60bce088c21bec69baa9fb2d2325632e0` |
| ROLLBACK COUPLING | refuses to run unless the cp -p backup exists, is sha-exact, and is a DIFFERENT file (same-path/hardlink refused); idempotency: refuses when arg0 already = NEW_ARG0 |
| PRE-GUARDS | old line occurs exactly once; NEW_ARG0 has no XML-escapable bytes; preimage ProgramArguments length 3 with [0] = old value; no duplicate elements |
| CANDIDATE GUARDS | one-line byte diff; form-identity (non-target bytes identical); ZERO tab bytes (launchd-rejected form absent); plistlib semantic diff == exactly `ProgramArguments[0]`, array length 3, tail args + all other keys deep-equal; `plutil -lint` OK; `plutil -convert xml1` round-trip semantic equality (scratch copy only) |
| APPLY | truncate+write on the SAME inode (preserves xattrs incl. `com.apple.provenance`, mode, owner), `fchmod 0600`. In-place, NOT atomic-rename: a crash/ENOSPC mid-write can truncate the live file — the sha-exact backup (mandatory) is the recovery artifact; post-apply sha guard + packet stop conditions forbid reloading unverified bytes |
| POST-GUARDS | re-read sha == candidate sha; lint OK; byte diff vs backup == exactly one line pair |
| CANDIDATE BYTES | pre-frozen at `raw/61-c2-candidate-plist.plist`, sha256 `01db501d925683f00f85a4d53361a818a869afa225792ea24f8080999c7e2c34` — the retry round's post-edit file must equal this sha exactly |
| PROOF DRIVER | `scripts/c2-edit-primitive-proof.sh` sha256 `1a8a290e15324d76832750633249e3d3da4f8c9f41e4e71e719c3999d46321ee` → transcript `raw/62-c2-edit-primitive-fixture-proof.txt` sha256 `13fec3cb6eba42b0d252e909f3d18bbb5554ff186b07766b833494d24ade0ab6`. Driver re-run OVERWRITES raw/61-62 — do not re-run after cutover acceptance without owner instruction |

## §3 SERIALIZATION_PROOF (off-lane, fixtures only — raw/62, 2026-10-07T11:0xZ)

OVERALL=PASS, 26 PASS / 0 FAIL, host macOS 26.6.2 arm64 darwin 25.6.0:

1. POSITIVE: primitive applies to two independent fixture copies → **byte-identical
   candidates** (determinism), each == raw/61 sha.
2. Byte guard: changed lines == exactly the expected old/new ProgramArguments[0] pair,
   same line count, nothing else.
3. Form guards: non-target bytes identical (mask-compare); zero tab bytes anywhere.
4. Semantic guards: plistlib diff == exactly `ProgramArguments[0]`; length 3; tail args
   and all other keys deep-equal; `plutil -lint` OK; plutil round-trip semantic equality.
5. Rollback serialization compatibility: `cp -p` restore → sha == frozen preimage →
   primitive re-applies → candidate byte-identical to raw/61 (the edit is deterministic
   on the restored preimage; the rollback artifact remains the exact accepted bytes).
6. Refusals (fail-closed, all exit 9, target untouched): already-edited target via sha
   gates; sha-consistent already-edited pair exercising the old-line-count/arg0 guard;
   drifted expected-sha; missing backup; TARGET==BACKUP same inode (hardlink).
7. RED reproductions: R1 plutil -replace insert-bug (4-element corruption);
   R2 plistlib dump == raw/60 sha-exact (root-cause closure); R3 `plutil -convert xml1`
   emits TAB-indented, key-re-sorted XML — doc-12 §9 candidate (a) round-trip **refuted**
   (would re-fail bootstrap identically); R3b round-tripping even the ORIGINAL destroys
   the accepted form; R5 `defaults write` rewrites as **binary bplist** — form-destroying,
   refuted.

Launchd-consumability basis (off-lane substitute for a live load): the candidate's
serialization form is byte-form-identical to the file launchd accepts — loaded at the
Sep-18 original start and bootstrapped exit 0 during the 2026-10-07 rollback — with
exactly one content line changed; every serializer that produces a DIFFERENT form
(plistlib tabs, plutil round-trip, defaults binary) is proven-refuted on fixtures.
Residual risk: none identified short of the reload itself, which stays
production-slot-gated (§1 evidence-scope note + §6 stop conditions bound it).

## §4 CANARY_ERRATA (amends packet §6 CANARY_LOG; implements doc 12 §7)

KNOWN_ENVIRONMENTAL_STARTUP_BASELINE (expected, non-failing) — miservice Mi-account
login failures with code **70016 (登录验证失败)**, warnings that **`conf/.mi.token` does
not exist**, and their retry descendants ("All retries failed" warnings). Baseline
evidence (raw/59 + doc 12 §7): Oct-1 original startup window = 12× 70016 + 1×
.mi.token-missing + 47 tracebacks; steady state ≈ 604 "All retries failed" warnings per
300 KB. Condition exists on the CURRENT accepted intel generation (token absent since
the Sep-18 hardening) — it is owner-gated credential hygiene (census GAP-2), NOT a
cutover failure signal.

MIGRATION-ATTRIBUTABLE FAIL CLASSES (zero-tolerance → immediate rollback):
- any Traceback block NOT matching the environmental patterns above — concretely:
  ImportError / ModuleNotFoundError, dyld / Mach-O arm64 load failures, SyntaxError,
  xiaomusic / aiohttp / uvicorn / fastapi / apscheduler fatal startup exceptions,
  watcher or permission errors, any unexpected Python exception at startup;
- startup-log absence of the new pid's startup line(s) within the canary window;
- process exit/restart (runs > expected), loss of `*:8090` LISTEN, loss of `GET / → 401`,
  wrong exec identity (must be `~/Library/PythonEnvs/xiaomusic-arm64` framework Python,
  arm64) — all unchanged hard canaries (packet §6).

Retry-round implementation: snapshot stderr byte offset before bootout; after bootstrap
classify every Traceback block in the post-start window against §4; any block outside
the environmental class = FAIL + rollback. Environmental blocks are counted and recorded
in the evidence, never treated as success signals by themselves.

## §5 AMENDED_PACKET (XIAOMUSIC-PACKET-C2 @ doc 11 §6, r376 deltas)

- §6 PLIST EDIT row: PlistBuddy instruction SUPERSEDED (binary absent on this OS;
  plutil -replace inserts on numeric subscripts; plistlib tab-form is bootstrap-rejected)
  → primitive = §2 script, candidate bytes = raw/61 (sha `01db501d…`), retry post-edit
  file MUST sha-match raw/61 before any reload.
- §6 CANARY_LOG row: "zero Traceback/ERROR" SUPERSEDED → "zero MIGRATION-ATTRIBUTABLE
  traceback classes per 13 §4; known Mi-login-70016 / .mi.token-missing environmental
  baseline is expected and non-failing".
- §6 RELOAD / CANARY_* / ROLLBACK / PARALLEL_BOUNDARY rows: UNCHANGED (bootout→bootstrap
  user-domain contract, 401/listener/identity canaries, cp -p restore, production-slot
  gating). Existing preimage backup
  `com.xiaomusic.secure.plist.bak-armnorm-c2-20261007-172814` remains the rollback
  artifact (live sha re-verified this round, byte-identical, xattr/mode intact); venv
  `~/Library/PythonEnvs/xiaomusic-arm64` retained (live re-check this round: 3.13.14
  arm64 console script present) — both reusable by the retry round ONLY after a fresh
  full-drift re-verification (packet §1 axes).

## §6 RETRY_STOP_CONDITIONS (frozen)

1. Any preimage/venv/packet drift at retry preflight → STOP MATERIAL_DRIFT (no edit).
2. The §2 primitive refuses ANY guard (incl. missing/ drifted backup) → STOP; no reload
   may be attempted with unverified bytes.
3. Post-edit file sha ≠ raw/61 sha → STOP before bootout.
4. FIRST reload failure (bootstrap nonzero, or any §4 fail class / hard-canary miss in
   the canary window) → immediate deterministic rollback (cp -p restore → bootstrap →
   401/identity health proof) and lane release; NO in-lane retry, NO second primitive.
5. Environmental-baseline classification may never be extended in-lane to explain a new
   traceback class; new-class failures roll back first, analyze off-lane after.
6. Owner-assisted speaker playback stays pending/UNKNOWN (BUSINESS_VERIFIED ceiling =
   HEALTH_LEVEL for the C2 slice regardless of mechanical success).

## §7 CONFLICT_CHECK + boundary

Protected writers re-checked this round: agent-control#554 (Product #414, B7
capture-compat candidate under ~/Documents/Codex/2026-10-07/task/b7-capture-compat-*)
and agent-control#556 (Product #388, agent-control controller/dashboard install+reload)
— both surfaces disjoint from com.xiaomusic.secure / xiaomusic venv / port 8090 /
dsh-agent-core evidence tree. This round's writes: this evidence tree (docs 13, raw/61-62,
scripts/c2-*, doc 11 §6 amendments, MANIFEST) + /tmp/c2-errata-r376 fixtures (disposable).
The proof transcript records live-state METADATA only (launchctl state/pid/runs lines and
the unauthenticated HTTP status code — no log payloads, no credential-bearing requests).
PRODUCTION_MUTATION = NO: zero launchd mutation (live file read-only, zero reload of any
label), zero service impact (live sha re-anchored unchanged post-proof), zero
credential/config/data mutation, zero credential content reads (plist census-verified
credential-free; setting.json/admin-credentials/.mi.token/logs untouched), no sudo,
no playback synthesis. Secret guard: docs/raw/scripts added here contain no credential
bytes. MANIFEST.sha256 regenerated.

## §8 INDEPENDENT REVIEW (exact-head round-1, review of commit af9e5c9f)

VERDICT = **PASS / LOAD_BEARING_GAPS = 0**. The independent reviewer reproduced on
private /tmp fixtures: the frozen candidate bytes (primitive exit 0 → sha `01db501d…`
== raw/61, mode 0600 preserved, same-inode apply), the R2 raw/60 byte-exact closure
(`b8fcc4b3…`), the indentation-only form delta, MANIFEST 86/86, and the read-only live
anchor (pid 23900, runs=1, 8090 LISTEN ×2, GET / → 401; plist sha `e23d0371…` exact).
Findings (3 minor + 8 notes, none load-bearing) applied in the same-round fix commit:
timestamp/acceptance-event wording fixed; doc-12 §9 candidate-(a) label corrected;
TARGET==BACKUP same-inode refusal added; byte-diff assert strengthened to exact
old/new-line equality; arg0-guard refusal path now explicitly exercised; in-place-apply
mid-write caveat + driver-overwrite warning documented; APPENDED→INSERT correction
noted vs doc 12 §5; live-state metadata capture added to the transcript.
