# MANIFEST — local-arm64-normalization-v1-20260907

Goal: LOCAL_NATIVE_ARM64_PLATFORM_NORMALIZATION_V1 (NEW_GOAL, P1_PLATFORM_PARALLEL)
Date: 2026-09-07
Round r1: FRESH_HOST_ARCHITECTURE_CENSUS → dependency graph → classification →
PHASE 2 BATCH-1 (six CLASS B CLIs normalized to ARM-native).

Contents:
- 00_CENSUS.md — structured census of record (required fields + headline findings)
- 01_DEPENDENCY_GRAPH.md — active infrastructure dependency graph (D1–D11)
- 02_CLASSIFICATION.md — A–H classification frozen pre-mutation; batch-1 designation
- 03_PHASE2_BATCH1.md — BATCH-1 per-tool closure (frozen)
- 04_AUDIT_TRAIL.md — r1 audit REJECT → bounded repair → re-audit ACCEPT (final)
- MANIFEST.sha256 — sha256 of all files in this directory tree
- scripts/ — census-part1.sh, census-part2.sh (read-only), batch1-cli-normalize.sh,
  batch1-continue.sh (the only mutation-bearing scripts, scope = six ARM brew installs)
- raw/ — 33 raw evidence files (numbering skips 28; sanitized: plists + profiles
  redacted; no credentials)

Mutation boundary of this round:
- Installed via /opt/homebrew/bin/brew: uv, wget, tmux, starship, cmake, deno (ARM-native).
- NOTHING uninstalled. NOTHING restarted. NO PATH/launchd/profile edits. NO sudo.
- DSH/Agent Core production surfaces (authsvc runtime, scheduler runtime, luna harness,
  dsh-lark, postgres, syncthing, tailscaled, svc-workflow, irbridge, videobridge,
  article-review-canary) UNTOUCHED — evidence only.

Post-batch production health check obligation: production services were never touched;
no health delta possible from this round (user-level CLI installs only).

Round r370 (2026-10-07, task agent-control#543, branch ac-task/543): added
11_XIAOMUSIC_C2_ARM_CENSUS_PACKET_R1.md + raw/51-58 — xiaomusic C2 bounded
NON_PRODUCTION census (intel py3.13.3 closure, ARM 3.13.14 isolated venv
import proof, credential-path disposition, G4 run_xiaomusic.sh disposition)
and XIAOMUSIC-PACKET-C2 frozen candidate. PRODUCTION_MUTATION=NO.
(C1 packet/execution docs 09/10 live on preserved branch ac-task/528:
6fa857f2, cb72b928.)

Round r373 (2026-10-07, task agent-control#550, branch ac-task/543): added
12_XIAOMUSIC_C2_CUTOVER_EXECUTION_ROLLBACK.md + raw/59-60 — XIAOMUSIC-PACKET-C2
cutover attempt: preflight zero-drift, preimage pinned, venv replay PASS, but
launchd bootstrap rejected the plistlib-serialized plist (exit 5) => exact
rollback verified (original intel generation healthy, pid 23900, 401 alive).
Packet errata recorded (edit primitive + canary scope). PRODUCTION_MUTATION=YES
(bounded, rolled back).

Round r376 (2026-10-07, task agent-control#558, branch ac-task/558): added
13_XIAOMUSIC_C2_PACKET_ERRATA_R376.md + raw/61-62 +
scripts/c2-apply-program-args0-edit.sh + scripts/c2-edit-primitive-proof.sh —
XIAOMUSIC-PACKET-C2 errata repair, NON_PRODUCTION off-lane fixture proof only:
root cause = launchd rejects TAB-indented XML (plistlib/plutil/default forms)
while the 4/8-space-indented original form is accepted; frozen primitive =
deterministic single-line byte substitution (candidate raw/61 sha 01db501d…,
determinism + form/semantic/rollback guards + fail-closed refusals all PASS,
raw/62 25/0); plutil round-trip and defaults-write candidates refuted on
fixtures; canary amended (Mi-login-70016/.mi.token = environmental baseline,
migration-attributable classes = zero-tolerance). Doc 11 §6 PLIST EDIT +
CANARY_LOG rows amended in place ([AMENDED r376] markers). Live service
untouched (read-only anchor; live plist sha byte-identical pre/post proof).
PRODUCTION_MUTATION=NO.

Round r380 (2026-10-07, task agent-control#564, branch ac-task/558): added
14_XIAOMUSIC_C2_REROOTCAUSE_R380.md + raw/63 +
scripts/c2-rerootcause-probe-matrix.sh — NON_PRODUCTION re-root-cause of the
r373/r377 bootstrap exit-5 failures on ~60 disposable dummy-label launchd
probes: OPERATIVE CAUSE = launchd re-load gate (a label whose last EXECUTED
instance had an interpreted-script ProgramArguments[0] rejects byte-changed
re-bootstrap with exit 5 for >=6 min); r376 tab-form root cause SUPERSEDED
(form exonerated); arg0 file properties, spawn-preflight, same-inode writes,
load order and plist path all exonerated; C1 irbridge succeeded because its
arg0 is a Mach-O interpreter. Doc 11 §6 rows TARGET_IDENTITY / PLIST EDIT /
RELOAD amended in place ([AMENDED r380] markers); doc 13 §1 superseded-banner.
Focused reproduction driver 7/7 PASS (disposable labels, synthetic programs).
com.xiaomusic.secure never bootstrapped/booted-out this round; live service
read-only anchor verified pre/post. PRODUCTION_MUTATION=NO.
