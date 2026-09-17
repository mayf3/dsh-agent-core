# Task 4 frozen-union scoped re-audit

- FIX_BASE: `77e54641c63f976de1089bcf99970a620f126f47`.
- REVIEW_TARGET_HEAD: `c21de2a00b8a2ad9786cd6e1fec3d501d774652e`.
- Repair test source: `a263c8089e16b3614f37b5c4766af50f4d449275`.
- Accepted semantics: `39865536ce51005f95a98473e77c2329078512c0`;
  accepted base `bb5327f622a0333f1e11d945319e024a3731f05a`.
- Environment: isolated implementation worktree, nonprivileged macOS source and
  retained-evidence review, 2026-09-18.

## Verdict

**SPEC / TASK CONFORMANCE: PASS for the T4-B01/T4-B02 repair scope.**

**QUALITY / SECURITY: PASS for the same repair scope.**

| Frozen ID | Disposition | Closure |
|---|---|---|
| T4-B01 | ADDRESSED | All effectful adoption entries now enter the shared nonroot/kernel-temp guard; copied installer stamp stays in the validated fixture tree. |
| T4-B02 | ADDRESSED | Every ACC row links to qualified stable EVD records, retaining exact historical/current coordinates, contrary evidence and production limitations. |

`FROZEN_BLOCKER_UNION = {T4-B01: ADDRESSED, T4-B02: ADDRESSED}`.
`OPEN_REPAIR_BLOCKERS = {}`. `NEW_INTRODUCED_BLOCKERS = {}`.

**RP-01–RP-08 remain OPEN; BOOTSTRAP_READY=NO; PRODUCTION_GOAL_COMPLETE=NO.**
This verdict does not approve merge or production bootstrap, establish a whole-branch
independent PASS, or turn integration omissions into completed implementation.

## Method and exact scope

Read the original frozen findings, repair appendix, and supplied
`review-task-4-repair-77e5464-c21de2a.diff` (195588 bytes). Reviewed all changed
source/test/report/EVD semantics and the new inert-package assembler. Repeated
structure output and source/payload manifest entries were navigated by hunk/path;
parsed comparison confirmed only source revision/digest and the three adoption
source-map entries changed in the replacement manifest. No regenerated diff,
broad re-review, suite rerun, root/privileged probe, production operation or
candidate execution was performed. No new counterexample was needed.

The new source is confined to `test/adoption/{bootstrap,e2e,fixture}.rs`.
Production crate source/build inputs and production legacy scripts remain unchanged
in this repair. Reports69–71 explicitly preserve the original binary build revision;
no rebuild or new trusted provenance is inferred.

## T4-B01 closure

`test/adoption/fixture.rs:8–16` shares the same `with_uid` refusal used by actual
fixture entrypoints and the injected-uid ordering test. `:34–50` checks actual euid
before any fixture effect, obtains the canonical Darwin user-temp root through
confstr, rejects an explicit outside/aliased base before creation, creates mode0700,
and applies the existing descriptor/owner/ACL/ancestor validation via FixtureRoots.
It never consults TMPDIR for the fixture destination.

`bootstrap.rs::bundle` and all three e2e entries call this helper before fixture
work. Both fixed-tool bootstrap tests call `fixture::nonroot` before reading tools
or spawning plutil. The synthetic Mach-O byte-parser case and injected-uid guard
case are pure memory operations; they introduce no root filesystem/process path.

`e2e.rs::original_nonroot_lock_selftest_remains_available_before_enrollment`
replaces the unique old `/tmp` stamp literal only in its copied installer, safely
quotes the new private-tree template, verifies inverse replacement recovers the
original bytes, runs the existing selftest and checks cleanup leaves only the copy.
The actual production installer remains unchanged.

The old EVD-T4R-002 observation remains valid contrary evidence at8db5ada. It is
not relabeled as a failure or deleted. The repaired selftest can correctly PASS
under hostile TMPDIR because the destination is now selected independently by
the kernel. Explicit outside-base refusal is separately tested. Actual euid0 is
not executed: the same refusal function receives injected0 and proves the effect
closure is never reached. This satisfies the requested safe ordering verification.

## T4-B02 closure

The conformance table now links all14 ACC rows to
`docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md`, which supplies
EVD-DCP-T4-001–016. Shared coordinates define accepted authority, environment,
profile/fixture inputs and producer provenance; each record identifies its target
and relation, named executed observations/log anchors, source definitions,
positive/negative cases, sufficiency and limits.

The record distinguishes S1/S2/S3 inherited mechanisms and their original review/
execution coordinates, F4 full105@3f59, A4 affected9@8db5, R4 repair15 executions/
12 unique cases, and P4 replacement-package integrity. It explicitly says the new
IDs do not rerun earlier tests or confer a whole-ACC/P PASS. Historical failed
logs and the old fixture counterexample remain qualified contrary observations.

Independently checked all49 exact named observation-to-log anchors: each named
case occurs with `ok` at its stated retained log line. Inline evidence link paths
resolve. This verifies the newly added evidence associations rather than simply
counting EVD IDs. No inaccessible or missing relation discovered in this repair
prevents closing the original formatting/qualification finding.

## Retained checks and artifact consistency

EVD-T4RR-001 — **Target/relation:** T4-B01 closure, SUPPORTS. **Source/provenance:**
implementer-retained logs61–66 and72, independently inspected in supplied diff.
**Coordinates/input/environment:** exact repair source a263c80, macOS arm64/euid502,
TMPDIR=/private/tmp; log64 UTC2026-09-17T16:37:34.844564Z–16:37:37.305232Z.
**Result:** bootstrap9 plus e2e6 executions pass,15 total/12 unique,0 failed.
The shared3 helper cases run in both targets. Log61 preserves the initial3 failures;
log62 is explicitly an unintended UNSAFE_MODE failure; log63 is the intended
unrelocated-stamp failure. Strict all-target Clippy/fmt/source/governance checks
pass. **Sufficiency/limitations:** final affected behavior and guard ordering;
no actual root run, suite rerun, production effect or general host safety claim.

EVD-T4RR-002 — **Target/relation:** T4-B02 closure, SUPPORTS. **Source/provenance:**
new conformance/EVIDENCE hunks plus reviewer read-only anchor check at c21de2a.
**Input/result:**14 linked ACC rows,16 qualified EVD records,49 named retained
observation anchors all match; no missing inline link paths. **Sufficiency:**
required stable evidence qualification is now present. **Limitations:** prior
mechanisms retain their original review scope; this is not a new complete audit
of Tasks1–3 or an independent execution of their tests.

EVD-T4RR-003 — **Target/relation:** replacement package source/byte consistency,
SUPPORTS integrity only. **Source/provenance:** retained69–72 plus independent
reviewer hashlib/plistlib reads, no execution. **Coordinates:** repair manifest
`1b4b4e1608f9335eb4db8aba319b0e19a0e8610ccefac2c1df2c25e6bbe949c6`, source digest
`da70fad9b07a064a07489c14aff006cc1781a66ca359e7d44522bb7fed1bebb7`, source a263c80;
package `/private/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/agent-deployd-task4-repair-wscow2bn`.
**Input/result:** all84 source-map hashes match current files; all23 payload hashes
and sizes match; exact25-file inventory; parsed Disabled=true; eight unresolved
items retained. Production payloads are identical to the historical package.
Controller `18a69c94b86026a3f4a75d5deff8b6deeea070514c2b3da3dba53d1bc7a21088`
and preparation CLI `53599a158c7aef35f020e2298cf2f4408969c1edda181725d132d6cbb6669084`
remain the exact binaries built at8db5ada. **Sufficiency/limitations:** source-map
refresh and inert artifact integrity, not new build provenance, activation,
complete dynamic closure or production protection. The old package remains
historical, rather than falsely claimed to match the repaired test source.

Structure observations67/68 retain exactly the three unchanged baseline violations:
production-runtime/src21, production-runtime/test23, scripts59. Rust75 files,
max479 lines,20 immediate children,depth2; adoption has3 children. No registry
approval, structure exception or global structure PASS was introduced.

## Preserved boundaries and stop

No concrete reachable breakage introduced by this repair was found. F-01 recipe
bounded reading, F-02 wider shell lookup handling and style stay FOLLOW_UP;
this repair does not reopen them as blockers.

RP-01 host/enrollment enforcement; RP-02 real issuer custody and unimplemented
upstream-to-mailbox bridges; RP-03 authenticated source/build/review; RP-04 complete
app/dynamic/root-code release closure; RP-05 protected legacy/lifecycle denial;
RP-06 transformed Node trust/runtime validation; RP-07 whole-branch independent
review; RP-08 exact separate Owner bootstrap authority all remain open.
Protected host facts, external service protocols and P-only results cannot be
verified from this repair diff. The later observed host digest supplies no
activation or enforced host-binding proof.

The frozen Task4 repair review is complete. The controller may continue the
separate whole-branch review and unresolved readiness work within existing
nonproduction authorization; this report grants no further authority.
