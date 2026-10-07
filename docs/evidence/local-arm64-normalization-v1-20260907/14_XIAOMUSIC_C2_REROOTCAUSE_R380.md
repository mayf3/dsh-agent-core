# 14_XIAOMUSIC_C2_REROOTCAUSE_R380 — bootstrap exit-5 root cause PROVEN on dummy labels; C2 packet re-shaped (2026-10-07)

Round r380 of record. Task = mayf3/agent-control#564, CLAIM_TOKEN
`g10-xiaomusic-c2-rerootcause-r380`, session `sess_e21d04c9-70b7-4baa-9567-2dadd8daf890`,
base HEAD `a22b4fb9` (branch `ac-task/558`). Directing authority: Product #483 (G10)
round-380 claim; #386 standing delivery authority + post-mutation failure rule
(rollback-first); NON_PRODUCTION re-root-cause after terminal #550 (r373) and #560
(r377) bootstrap failures. Protects live writer agent-control#565 (Product #414 B7 P1,
capture-compat surfaces — file/effect-disjoint) and #562 (disjoint).
SCOPE = NON_PRODUCTION ONLY: disposable dummy-label launchd probes (`com.probe.disposable.r380.*`),
synthetic programs only, /tmp + `~/Library/Application Support/xr380-probe-disposable/`
disposable files, read-only metadata on the real target. NO sudo, NO system-domain work,
NO bootstrap/bootout of `com.xiaomusic.secure` (or any real label), NO production
restart, NO credential/config/data mutation, NO playback, NO Agent Core/B7/G9/F-family scope.

## §1 ROOT_CAUSE (supersedes doc 13 §1 tab-form conclusion — REFUTED as operative trigger)

`launchctl bootstrap gui/502` returns **exit 5 ("Input/output error") when it re-loads a
label whose previously-EXECUTED instance had an INTERPRETED (non-Mach-O) program as
ProgramArguments[0], if the plist bytes differ from the definition the label last ran
with.** Neither serialization form, nor arg0 target file properties, nor exec-preflight,
nor write mechanics are causal. Measured closure (every row = dummy-label evidence,
raw/63):

| # | VARIABLE | RESULT | PROBES |
|---|---|---|---|
| 1 | Plist serialization form (TAB vs space indentation) | **NOT causal** — both forms bootstrap-accepted on first load; tab-form accepted live on com.irbridge.secure since r371 | A1-A9, D7; live irbridge plist |
| 2 | arg0 target file properties (existence, signature, quarantine/provenance xattrs, mode, owner, path, symlink chain, interpreter) | **NOT causal** — dormant re-loads accept unsigned/provenance-carrying/nonexistent/script/binary arg0 alike | A2-A9, D1-D6, E0-E1 |
| 3 | Spawn-path exec-ability of arg0 | **NOT causal** — unsigned script with the real venv shebang spawns and exits 0 under launchd; nonexistent arg0 fails ASYNC (`last exit code = 78: EX_CONFIG`, bootstrap still 0) | B1-B6 |
| 4 | Same-inode in-place mutation / inode identity / write mechanics | **NOT causal** — true same-inode truncate+write flows accepted (dormant + binary-arg0 classes) | C*, D1-D7, E2 |
| 5 | Load order (edit-before-bootout = C1 order vs bootout-edit-bootstrap) | **NOT causal** — h3 rejects changed bytes in C1 order too | H3 |
| 6 | Plist path/location (LaunchAgents dir vs /tmp vs App Support) | **NOT causal** — label-keyed: changed bytes rejected from a different path (h4); LaunchAgents-dir dummy flows accepted (E0) | C6, H4, E0 |
| 7 | **Re-load of a label whose last executed instance was a SCRIPT (full exec history) with changed bytes** | **REJECTED exit 5 — THE operative trigger** | F2, F3, G1, H3, H4, I1, I3, J1, J2, J4, K2, K5 (F1 = unchanged-bytes teardown race, see §2; H2 = poke-confounded, see §2) |
| 8 | Same, but bytes EXACTLY equal to the last-loaded definition | **ACCEPTED** (after a short settle window; see §2) | F4, J3, J5 |
| 9 | Same, but previous instance was a Mach-O binary (C1 irbridge `bin/python` shape, `/bin/sleep`) | **ACCEPTED** with changed bytes | K1, t06 (driver), C1-production |
| 10 | Same rejection, new label | **ACCEPTED** — the gate is LABEL-keyed, not path- or file-keyed | C6, T07 |

Mechanism internals are not observable without Apple source; the operational rule above
is deterministic and fully reproduces r373/r377: both attempts bootout'd the live
xiaomusic (script-arg0 instance running for days → graceful shutdown), applied the
single-line arg0 edit, and bootstrapped changed bytes → exit 5; both rollbacks restored
byte-exact preimage bytes → exit 0. The doc-13 §1 tab-form "root cause" was a confounder
(raw/60 differed in BOTH form and arg0; form exonerated by rows 1-2).

## §2 MEASURED BOUNDARIES (dummy labels, script-history class)

- **Short settle window**: immediately after bootout (<~1-2s) even UNCHANGED bytes may
  bootstrap-reject (F1 at +0s = 5); at +6..9 s unchanged bytes accept (F4 +6s; J3/J5
  +9s). r373/r377 rollback bootstraps (+2..4s) landed AFTER that uncertain window and
  succeeded.
- **Changed-bytes block is LONG; clean single-poke acceptance measured ONLY at +1200 s**:
  rejected at +8 s on clean single-poke labels (J1/J2/J4); sustained failures to +40 s
  (G1); ACCEPTED at exactly +1200 s single-poke (K6, completing-session re-run, raw/63).
  The interior 8 s..20 min is UNMEASURED on clean labels — the only mid-interval data
  point (h2 at ~+4 min 36 s after the G1 bootout, still rejected) sat on the
  poke-confounded G1 label and cannot bound a clean label. Poke-count confound (G1/I5:
  ~20 failed pokes left a label rejecting even ORIGINAL bytes at +7 min) means ZERO
  intermediate bootstrap attempts are permitted while waiting the window out.
- **Confounds observed**: repeated failed bootstrap attempts on one label may extend the
  block (G1 label rejected even ORIGINAL bytes at +7 min after ~20 pokes (I5), while
  single-poke labels accept unchanged bytes at +8 s (J3/J5)); mechanism unconfirmed.
- SIGKILL-first (I1/J4) and handler-mediated fast exit (I3/J1/K2) do NOT escape the
  block; an intermediate unchanged reload does NOT clear it (J3).
- The gate applies to the label's EXEC-HISTORY: a script arg0 that never fully exec'd
  (bootout during `xpcproxy`, D7) does not poison the label.

## §3 INCIDENT RECORD (d7 — bounded, no production impact, disclosed)

Probe D7 replayed the exact r377 byte flow on a DUMMY label but retained the real
plist's RunAtLoad+KeepAlive keys with the real program bytes: the dummy job reached
`state = xpcproxy` (pre-exec) for <1 s before its bootout. It never exec'd (verified:
`pgrep -fl xiaomusic` shows only live pid; label fully removed). Probe-design error
(RunAtLoad+real-program combination); recorded per no-concealment policy. Live service
verified unaffected immediately after (pid 95291, runs=1 never-exited, *:8090 LISTEN ×2,
GET / → 401 in 5 ms). All later spawn-path probes used synthetic programs only.

## §4 C1_COMPARISON (why r371 succeeded where r373/r377 failed)

| | C1 irbridge (r371, ACCEPTED) | C2 xiaomusic (r373/r377, exit 5) |
|---|---|---|
| arg0 AFTER cutover | `~/Library/PythonEnvs/irbridge-arm64/bin/python` = **Mach-O** (symlink → signed Homebrew python3.14) | `~/Library/PythonEnvs/xiaomusic-arm64/bin/xiaomusic` = **pip console script** (text + shebang) |
| Previous instance arg0 class | Intel `bin/python` — **binary** (doc 10 census) | `/usr/local/bin/xiaomusic` — **script** |
| Re-load gate | binary-history label → clean changed-byte re-load (§1 row 9) | script-history label → changed-byte block (§1 row 7) |
| Teardown character | ir_bridge.py default SIGTERM death (instant) | xiaomusic aiohttp graceful shutdown (logged) |
| Serialization form | TAB-indented plist — accepted | TAB (r373) and space (r377) — both rejected |

C1's success was **method-and-target-luck**, not a reproducible recipe: its arg0 swap
landed on a binary interpreter, which the re-load gate does not block.

## §5 TARGET_METADATA (read-only, 2026-10-07T12:1x-12:2xZ)

- Live plist `~/Library/LaunchAgents/com.xiaomusic.secure.plist`: sha `e23d0371…` exact,
  1100 B, 0600, yanfenma:staff, inode 87250952, xattr `com.apple.provenance`; label
  com.xiaomusic.secure (gui/502), KeepAlive+RunAtLoad; service pid 95291 runs=1
  never-exited, *:8090 LISTEN ×2, GET / → 401 (~5-13 ms). Post-round re-anchor: unchanged.
- Accepted intel arg0 `/usr/local/bin/xiaomusic`: 237 B text script, shebang
  `/usr/local/opt/python@3.13/bin/python3.13`, owner yanfenma:**admin**, mode 0755,
  xattrs = ad-hoc **code signature** (`com.apple.cs.*`, `codesign -v` rc=0), no provenance.
- Rejected ARM arg0 `~/Library/PythonEnvs/xiaomusic-arm64/bin/xiaomusic`: 209 B text
  script, shebang → venv python3.13 (symlink → `/opt/homebrew/opt/python@3.13` → signed
  arm64 Cellar python), owner yanfenma:staff, mode 0755, xattr `com.apple.provenance`
  only, `codesign`: "not signed at all". (Signature/provenance exonerated as causes by
  §1 rows 2-3; recorded for completeness.)
- C1 anchor `com.irbridge.secure.plist`: TAB-indented, loaded+running (bootstrap r371),
  arg0 = venv `bin/python` (binary). Irbridge service untouched; live-print metadata only.

## §6 DISCRIMINATOR + AMENDED_PACKET (XIAOMUSIC-PACKET-C2 deltas, r380)

The operative discriminator is **the label's executed-arg0 class (script vs Mach-O)
against byte-changed re-loads** — not form, not file properties, not method.

AMENDMENTS (doc 11 §6 amended in place with [AMENDED r380] markers; doc 13 §1/§6 marked
SUPERSEDED where conflicting):

1. **doc 13 §1 tab-form root cause → SUPERSEDED** by this doc §1 (form exonerated;
   raw/60's rejection is fully explained by the re-load gate — plistlib's tab output was
   incidental). §2 primitive remains VALID and unchanged for byte mechanics (sha-pinned,
   same-inode apply, refusal paths) but **MUST NOT be used to produce the console-script
   arg0 candidate** — that candidate can no longer be installed on this label by any
   measured user-domain flow (§6 remedy table).
2. **doc 11 §6 TARGET_IDENTITY row → candidate re-frozen (C2-v2, owner-gated choice):**
   - **(A) LABEL-FRESH install (recommended, technically proven end-to-end):** keep the
     single-line primitive SHAPE but change the Label value in the same candidate (e.g.
     `com.xiaomusic.secure.v2`) — a fresh label accepts changed bytes unconditionally
     (§1 row 10, raw/63 T07). Requires owner sign-off on the service-identity rename
     (one additional edited line; new candidate sha; raw/61 remains installed-virgin).
   - **(B) SAME-LABEL install (owner must approve a downtime window):** bootout → wait
     out the block with the service DOWN, then bootstrap changed bytes with ONE single
     poke. Clean single-poke acceptance is measured ONLY at exactly +1200 s (K6,
     raw/63); the 8 s..20 min interior is unmeasured, so the poke must be at ≥ +20 min.
     ZERO intermediate bootstrap attempts during the wait (poke-count confound,
     G1/I5/H2). NO in-lane retry before expiry is permitted.
   - **(C) NOT VIABLE (measured):** unchanged-reload clearing (J3), SIGKILL-first
     (J4), C1-order (H3), path change under same label (H4), reboot-then-cutover
     (login RunAtLoad re-forms script exec-history immediately).
3. **RELOAD row + stop conditions:** insert pre-knowledge: `bootstrap exit 5 on a
   changed-bytes load of this label is a CLASSIFIED expected failure (doc 14 §1), not a
   new unknown` → rollback-first still applies verbatim: restore preimage → poll
   bootstrap (2 s interval, cap 30 s; unchanged bytes accepted at ≥6-9 s per F4/J3/J5)
   → health proof → release lane. The doc 13 §1 tab-form wording is superseded (in-file
   banner + §6 in-file marker added r380).
4. **raw/61 candidate bytes (sha 01db501d…) remain byte-valid** for remedy (B); remedy
   (A) requires a NEW frozen candidate (Label line + arg0 line both change). The frozen
   primitive `c2-apply-program-args0-edit.sh` (11c29f14…) edits ONLY the arg0 line;
   installing (A) therefore needs a two-substitution sha-guarded variant of the same
   single-line byte mechanics plus its own fixture proof, frozen BEFORE the (A) cutover
   round (owner-gated A/B choice resolves which candidate is frozen).

## §7 CHANGED_FILES (this round)

- `14_XIAOMUSIC_C2_REROOTCAUSE_R380.md` (this doc)
- `raw/63-c2-rerootcause-probe-transcript.txt` (stages A-K6 + driver validation)
- `scripts/c2-rerootcause-probe-matrix.sh` (sha `954c7a50a950cd45126551e0f3ec51fde965693345e19da38f8b376b4d46aaa3`,
  7/7 PASS self-contained reproduction, disposable labels, re-runnable)
- doc 11 §6 in-place amendments + doc 13 §1/§6 superseded-markers
- `MANIFEST.sha256` regenerated

## §8 TESTS

- Focused driver `scripts/c2-rerootcause-probe-matrix.sh`: 7 probes, PASS=7 FAIL=0
  (raw/63). t04 reproduces exit 5 deterministically from the committed artifact.
- Full matrix: stages A-K (raw/63), ~60 bootstrap/bootout cycles, all expectations met
  (stage C same-inode leg invalidated by a sed-inode defect and re-proven in stage D
  with python r+ truncate+write — retained in transcript for the record).
- Post-round live anchor: plist sha unchanged, service healthy (§3).

## §9 INDEPENDENT REVIEW

**Round-1 exact-head review of 3a8cd7c1 (base a22b4fb9), independent changed-surface
reviewer (fresh context, did not author the delta): VERDICT = REVISE.** All mechanical
gates PASS: changed surface = exactly the 7 declared evidence-tree files; MANIFEST.sha256
regeneration byte-identical (89/89); secret scan clean; driver safety audit clean
(disposable labels + synthetic programs only); LIVE driver reproduction PASS=7/FAIL=0
with zero residue and live anchor unchanged (pid 95291 runs=1 from 11:38:48Z — predates
round start 12:22Z, zero restarts); D7 disclosure corroborated (pgrep shows exactly one
xiaomusic process); §1 rows 2–10 + most of §2 verified line-by-line vs raw/63; K6v2
confirmed genuinely single-poke (original session died ~31 s before its own poke).

**BLOCKER (FALSE_EVIDENCE class) — "≥6 min" block lower bound was unsupported**: it
cited probe H1, which does not exist in raw/63 (stage H begins at h2), and h2's
"~+6 min" annotation was an arithmetic slip (g1 bootout 12:37:39Z → poke 12:42:15Z =
+4 min 36 s) on the poke-confounded G1 label. Clean single-poke data supports only:
rejected +8 s (J1/J2/J4), accepted exactly +1200 s (K6); the 8 s..20 min interior is
UNMEASURED. MINIMAL_CLOSURE (a) applied: every "≥6 min / ≤20 min" bound reworded across
doc 14 §1 row 7 (probe list corrected: H1 removed, F1 reclassified to §2, H2 marked
confounded; row 9 citation tightened to K1/t06/C1-production), §2 (measured-bound
restatement), §6 remedy (B) (single poke at ≥ +20 min), doc 11 §6 TARGET_IDENTITY +
RELOAD rows, doc 13 SUPERSEDED banner, MANIFEST.md; settle-window arithmetic corrected
to +6..9 s (F4 +6s; J3/J5 +9s); h2 correction appended to raw/63 continuation.
**MINOR findings applied**: doc 13 §6 now carries the r380 in-file classification marker
(banner's "§6 stop conditions carry" claim made true); doc 14 §6 item 3 pointer fixed to
doc 13 §1. Reviewer notes recorded: row-1 TAB-form first-load acceptance rests on the
live irbridge anchor (transparently cited); §3 pgrep/401-latency corroborated
independently (3.1 ms appended to raw/63).

**Exact-head re-audit (blocker-union freeze rule, one repair pass + one re-audit):**
RE-AUDIT of 71b00dea by the same independent reviewer = **REVISE, solely for one
REPOSITORY_INVARIANT_VIOLATION**: every round-1 blocker/minor/note finding verified
CLOSED (probe-list corrections, measured-bound restatement, remedy (B) ≥ +20 min
single-poke, doc 13 §6 in-file marker, settle +6..9 s, raw/63 append-only correction
block, §9 accuracy, live anchor untouched, no residual stale bound anywhere), but the
committed MANIFEST.sha256 pin for doc 14 (`df402c97…`) matched neither the committed
content (`cbd53336…`) nor any prior state — the regen had run before the §9 text landed,
leaving one stale pin of 89. MINIMAL_CLOSURE applied in this commit: re-audit verdict
appended here + MANIFEST.sha256 regenerated from the final tree (regen == committed,
89/89, mechanical diff = zero delta). Per the freeze rule this closure requires no
further re-audit beyond that mechanical check. Round r380 review loop CLOSED:
round-1 REVISE → repair pass → re-audit REVISE (manifest pin only) → final closure
commit (this one).

## §10 PRODUCTION_MUTATION = NO

Zero bootstrap/bootout of any real label; live service continuously verified (pid 95291,
runs=1, 8090 LISTEN, 401); real files read-only (plist bytes copied to fixture only);
no sudo; no credential/config/data mutation; no playback; no Agent Core/B7/G9/F-family
writes (evidence tree + /tmp only; B7 writer #565 surfaces untouched).
