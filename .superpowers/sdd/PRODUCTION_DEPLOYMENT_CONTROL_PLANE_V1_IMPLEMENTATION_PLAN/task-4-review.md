# Task 4 independent spec and quality/security review

Review target: `77e54641c63f976de1089bcf99970a620f126f47`.
Task base: `28c09f73897b98ba3da520d43128f49eb101a0b0`.
Tested executable source: `8db5ada86ce13f5f22727cd8fc6d8734afad35a9`.
Accepted semantics: `39865536ce51005f95a98473e77c2329078512c0`, accepted base
`bb5327f622a0333f1e11d945319e024a3731f05a`.
Review performed 2026-09-18 in the isolated implementation worktree.

## Verdict

- **SPEC / TASK CONFORMANCE: FIX_REQUIRED** — T4-B01 and T4-B02 remain open.
- **QUALITY / SECURITY: FIX_REQUIRED** — T4-B01 is a concrete fixture isolation
  defect; T4-B02 is a required conformance-evidence defect.
- The inert package and new native dependency enforcement are substantial,
  reviewable implementations. This is not a finding that the generator is an
  empty stub, that the accepted Spec lacks authority, or that a fixture passed
  production activation.
- **BOOTSTRAP_READY=NO; PRODUCTION_GOAL_COMPLETE=NO.** The disclosed readiness
  prerequisites below remain binding independently of the two repairable findings.
- This is the Task 4 affected-surface review. It does not substitute for the
  separately controller-owned whole-branch security review, approve merge, or
  grant production/bootstrap authority.

## Scope and method

Read task-4-brief.md, repository grammar/local governance, accepted CTR-DCP-001–020
and ACC-DCP-001–014, controller rulings and Task 4 integration/report material.
Read the supplied 650014-byte review package in sequential bounded source/hunk
chunks. Preparation, source, tests, configuration and report semantics were
reviewed. Repeated historical suite/structure dumps were navigated by hunk index;
final named results and relevant RED/GREEN observations were inspected. The large
single-line final manifest was decoded from the supplied diff for reviewability.
No new git diff was generated and no reported suite was rerun.

Focused outside-diff lookups were limited to named dependency risks:

1. Whether the newly checked plist is actually checked against fixed service
   identity: native.rs 1–170 and native_profile.rs validation/readback establish
   fixed launchd program, kernel executable/uid/gid and exact argv checks.
2. Whether new adoption tests inherit root/private-temp protection: fs/mod.rs
   `FixtureRoots::open`, secure.rs descriptor operations and the installer's
   existing lock-selftest segment expose T4-B01.
3. Whether the inert candidate can bypass existing production activation:
   service/intake.rs 41–114, transaction/mod.rs 58–88 and the daemon CLI retain
   signed activation/configuration/enrollment/issuer digest binding and root gates.
4. Whether the retained inert artifacts still match the named result: bounded
   local reads rehashed all 23 payloads, manifest and exact inventory and parsed
   the disabled plist. No payload was executed.

One focused disposable counterexample exercised the exact existing e2e binary
with TMPDIR outside the kernel-selected per-user temporary root; details are
EVD-T4R-002 below. It did not run the suite, mutate source/index/refs, invoke root,
probe privileges, or operate a production path. The only persistent review write
is this report. No relevant memory fact supplied authority or evidence.

## Frozen repair blocker union

`FROZEN_BLOCKER_UNION = {T4-B01, T4-B02}` for completion of the bounded Task 4
source/test/evidence deliverable. Readiness prerequisites RP-01–RP-08 are preserved
separately below; they are not waived by this narrower repair union.

### T4-B01 — P1: new adoption fixtures bypass the required fixture safety boundary

Class: `REQUIRED_GATE_FAILURE` / execution-mandate safety violation.

**SOURCE:** The review/implementation mandate explicitly requires fixtures to
refuse euid 0 and paths outside a private temporary tree. The accepted Spec's
ACC environment definitions require disposable unprivileged fixtures; CTR-017
separates them from privileged execution. Existing `fs/mod.rs:13–43` implements
that boundary with euid refusal and `_CS_DARWIN_USER_TEMP_DIR`, expressly preventing
TMPDIR from widening fixture authority.

**SOURCE COORDINATES:** `test/adoption/e2e.rs:98–117` and `120–135` create paths and
spawn shell/Node processes without an euid check or `FixtureRoots` validation.
`e2e.rs:121–131` runs the copied legacy installer with only the lock path relocated.
The original selftest's `scripts/trusted-cp-deploy-install.sh:57` still executes
`mktemp /tmp/trusted-cp-stamp-selftest-XXXXXX`. `test/adoption/bootstrap.rs:91–119`
also uses a raw `tempfile::tempdir()` rather than the existing kernel-temp boundary;
the generate function refuses root, but does not enforce that fixture path boundary.

**CONCRETE REACHABLE COUNTEREXAMPLE:** Run the final retained e2e executable with
`TMPDIR=/private/tmp/<new-private-review-dir>` and select only
`original_nonroot_lock_selftest_remains_available_before_enrollment`. It exits 0
and reports PASS, creating/running its copied installer and scratch lock outside
the permitted kernel-selected user temp root. This was observed nonprivileged
(EVD-T4R-002). Separately, the same test has no euid-0 refusal before writing and
executing the copied shell source, and the legacy selftest branch precedes the
script's normal root check. That root execution path is established by source,
not by an unauthorized root probe. The `/tmp` stamp also escapes the fixture tree
in the normal passing invocation.

**IMPACT:** The new tests do not maintain the mandated safety property. An accidental
root run reaches caller-owned shell/Node source; an environment-selected temp
location is accepted instead of refused. This invalidates the blanket claim that
all new fixtures enforce the established nonroot/private-tree boundary. It is not
a claim that the recorded euid-502 test run performed a production mutation.

**MINIMAL CLOSURE:** Reuse one cohesive test helper that refuses root before any
fixture effect and creates/validates roots against the kernel-selected private
temp location, independent of TMPDIR. Apply it to every effectful adoption entry.
Relocate the copied installer's selftest stamp into that validated fixture tree
(or adapt its copied fixture safely) without changing legacy production semantics.
Retain a rejecting outside-temp counterexample and a nonprivileged way to verify
the root guard's ordering; no root execution is required or authorized for repair.
Re-run only affected adoption tests plus required source checks, not unrelated
transaction crash suites.

### T4-B02 — P2: required stable evidence relations are absent from conformance

Class: `REPOSITORY_INVARIANT_VIOLATION` / `REQUIRED_GATE_FAILURE`.

**SOURCE:** `.agents/README.md:65`: load-bearing Evidence in a Conformance Record
uses stable `EVD-*` identity and records source, target, relation, coordinates,
sufficiency, limitations and provenance. Accepted Spec §6 also requires exact
implementation/profile/authority/environment/input/result/negative-counterexample
binding for each acceptance row.

**SOURCE COORDINATES:**
`docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CONFORMANCE.md:26–42` contains
the 14 load-bearing acceptance rows; `:70–81` and `task-4-report.md` provide global
source/test coordinates. Neither this conformance record nor its Task 4 report
contains any stable EVD identity. The global suite result is not an explicit
row-to-observation relation for each claimed behavior.

**CONCRETE REACHABLE COUNTEREXAMPLE:** An independent reviewer following ACC-006 or
ACC-013 reaches lists of behavior/test categories and the entire Task 4 report,
but no stable evidence record specifying which exact executed log/case and source
revision supports which subclaim, with sufficient versus deferred proof. The
same absence applies across ACC-001–014. The raw logs do exist; this is missing
required qualification, not a claim that their passing results were fabricated.

**IMPACT:** The controlled conformance deliverable fails the active repository
Evidence rule and leaves claims hard to audit without reconstructing the mapping.
It also risks conflating inherited Tasks 1–3 observations with newly executed Task 4
observations or P-only proof, despite the otherwise careful prose qualifications.

**MINIMAL CLOSURE:** Add stable EVD records (a compact table is sufficient) and link
all ACC rows to them. Bind each to exact source/log/test, authority/source revision,
environment and inputs, observed result/rejecting case, relation, sufficiency,
limitations and provenance. Preserve the split full105@3f59 / affected9@8db5 and
all pending production fields. Qualify inherited evidence by its original review/
execution coordinates. This is documentation repair; no test rerun or new authority
is needed merely to assign IDs to already retained observations.

## Readiness prerequisites, omissions and forbidden premature closure

`FROZEN_READINESS_UNION = {RP-01, RP-02, RP-03, RP-04, RP-05, RP-06, RP-07, RP-08}`.
These match the current package's eight explicit blockers. All remain open.

| ID | Accepted source and concrete current counterexample | Type / impact / minimum closure |
|---|---|---|
| RP-01 | CTR-002/008/017: prospective.rs:53 leaves host unresolved; no exact native enrollment/initial slots are included in this package | Host facts plus implementation/enrollment binding. A hardware identifier observation alone cannot make a protected native startup host binding. Produce exact reviewed enrollment and enforce/verify the intended host binding before activation; fresh protected preimages remain later P proof. |
| RP-02 | CTR-001/004/015/017: prospective.rs:88–95 emits null public key, identity and custody fields; task4-integration-gap.md:12–18 explicitly says real upstream-to-mailbox bridges are unimplemented | Actual integration-code omission dependent on unknown external protocol/issuer facts. Generic mailbox transport is implemented; filling key IDs alone cannot authenticate a real producer/build/reviewer/verifier. Obtain real public service/custody contracts, implement and verify the bridges, never promote fixture keys or self-authored PASS JSON. |
| RP-03 | CTR-004: the retained hashes and local ad-hoc signatures establish bytes but carry no authenticated source/merge/build/review attestations | Authority/provenance prerequisite, not a demand to invent a new Spec. Bind canonical acceptance/source, complete dependency closure, recipe/toolchain and independent reviews using established isolated issuers. |
| RP-04 | CTR-004/008, Spec §5: static 22-file Mach-O graph is not the app/JS/import/native-addon/harness/root-code closure; report explicitly leaves exact initial slots and required facets open | Concrete supported-profile/integration incompleteness. The existing regular-file-slot driver is real, but unsupported required facets must block the release. Freeze and implement/verify an independently useful complete release face; disabling all profiles is not implementation closure. |
| RP-05 | CTR-009/018/019: known-path inventory ends in an unresolved exhaustive-host remainder; installed wrappers, sudoers, jobs and caller lifecycle permissions are untouched | Mandated post-authorization protected census, retirement and negative proof. Prepare exact per-target plan now; after separate authorization, re-pin active legacy locks and prove write/launchctl/signal denial under actual identities. Current gui/502 svc-workflow remains ineligible. No global legacy exit is established. |
| RP-06 | CTR-004/008/017: transformed Node/dylibs were not executed; original versions/build trust and complete dynamic behavior are not proved by codesign --verify | Candidate review, trusted build and runtime-validation prerequisites. Static closure checks are useful but insufficient. Review and attest the transformed bytes, stage/rehash them in protected closure before privileged execution, then obtain authorized native readback. |
| RP-07 | CTR-017 and task mandate: this review covers Task 4, not the complete branch | Controller-owned required independent whole-branch security review. Carry this union and known prerequisites into it; do not replace it with this affected-surface verdict. |
| RP-08 | CTR-016/017 and §7: package emits no signed activation/Owner receipt and verifier always returns false | Deliberate separate authority gate. Only after the concrete manifest/trust/enrollment/rollback package is reviewable may the Owner authorize the single exact bootstrap. Missing proof cannot be corrected by an Owner click. Canary and production E2E remain later executed proof. |

No acceptance gap is inferred. External authority existence is unknown, not proven
absent. The newly supplied controller host-digest observation is outside the
reviewed candidate and is not treated as protection, activation or closure evidence.
`IMPLEMENTATION_COMPLETE=YES` in the report is explicitly restricted to bounded
preparation work; it must not become a whole-source integration readiness claim
while RP-01/02/04 remain unresolved.

## Strengths and reviewed implementation behavior

- Generator and verification entrypoints refuse root; generated files are inert,
  private/read-only local payloads plus a disabled plist. There is no installer,
  activation writer, private-key generation, sudo rule, generic privileged command,
  candidate hook or production path override in the new generator.
- `verify.rs:27–148` verifies independently supplied manifest/source digests,
  typed exact prospective constraints, exact package inventory, payload bounds and
  hashes, disabled plist bytes and both loader graphs. Unknown/extra package files,
  fixture trust substitutions and permissive target/sudoers changes reject.
  Fixed template equality is deliberate fail-closed candidate behavior, not a
  working resolved-enrollment schema.
- `loader.rs:73–150` checks finite Mach-O commands, architecture, load paths,
  complete graph reachability and rejects rpath/environment/Homebrew/missing/extra
  closure entries. `:151–187` verifies installed closure via no-link descriptors,
  root metadata, hashes and aggregate bounds. Native dependencies now invoke it.
- `plist.rs` feeds exactly hashed bytes to fixed pinned plutil with cleared
  environment, bounded input/output/deadline and kill/reap. The dangerous environment
  keys are parsed, so XML escaping does not bypass a substring check. Native
  identity/argv readback remains a separate requirement, not replaced by a hash.
- Platform flag relaxation is narrowly scoped to the two compiled-in Apple tools;
  generic artifact/runtime metadata validation is unchanged.
- Legacy guards run before mutation code, and routing imports local modules only
  after the guard. Installer extraction moves comments, not executable content.
  Existing guard tests prove marker-present and the exercised unsafe-parent modes;
  they do not establish complete installed-host retirement.
- Final-source lint changes are local mechanical changes: shared test imports,
  a named tuple alias, direct result return, next_back and boxing the Native enum
  variant. The single documented function-scoped clippy expectation does not
  suppress security checks or create a global warning waiver.
- The report preserves failed logs, distinguishes test histories and explicitly
  refuses readiness. Three baseline structure violations remain visible, with no
  changed registry approval and no claim of a global structure PASS.

## ACC and Contract disposition

This is the Task 4 audit of the complete acceptance mapping, with prior reviewed
mechanisms inherited rather than re-reviewed from types/test names. EVD-T4R-001
establishes executed suite counts, not universal production conformance.

| ACC | Contracts | Task 4 disposition |
|---|---|---|
| 001 | 001 | Prior producer/CAS/pagination/Train observations retained; RP-02 blocks real exhaustive producer integration. |
| 002 | 002,003 | Prior collapse/late/A-B-A and final Train observations retained; native install counts remain P-only. |
| 003 | 004,006 | New source/payload/loader integrity negatives reviewed; authentic external bindings remain RP-02/03. |
| 004 | 005,008 | Descriptor primitives preserved; new package metadata/inventory tests reviewed; exact full release face remains RP-04. |
| 005 | 007 | Socket implementation unchanged except test import wiring; reported real nonroot socket observations retained. Actual caller group remains P-only. |
| 006 | 008,017,019 | New loader/plist/platform-tool validation and rejecting tests reviewed. Empty transition policy is not installed sudoers absence; RP-05/06 remain. |
| 007 | 009,010 | Prior mutex/Train observations retained; new four-source guard evidence is limited by T4-B01 and cannot establish live exclusion. |
| 008 | 010 | Scheduling/dependency implementation unchanged; reported prior executed observations retained. Upstream authority still RP-02. |
| 009 | 010,011,020 | Journal/recovery semantics unchanged by mechanical lint fixes; full serial run and retained fault observations support the tested scope, not real power loss. |
| 010 | 012,013 | Fixture preimage/rollback and maximum-slot results retained; new native closure checks narrow preflight. Actual generation/rollback proof remains P-only. |
| 011 | 014,015 | Prior immutable receipt/outbox/CAS/late-verification observations retained; Task 3 publication lock is in the prospective protected layout. Real external acceptance remains pending. |
| 012 | 016,017 | Signed production activation path remains; candidate bundle is intentionally inert/nonready. RP-01–08 cannot be replaced by fixture success. |
| 013 | 018 | Four source guards reviewed; T4-B01 repairs fixture boundary, RP-05 covers exhaustive installed writer/lifecycle denial. gui/502 remains ineligible. |
| 014 | 019,020 | Transition is disabled; no new unlimited root command. Loader/plist limits reviewed; protected retention and installed-rule proof remain pending. |

T4-B02 applies to the evidence relation formatting/qualification for every row.
No row is promoted to production PASS in this review. All 20 accepted Contracts
remain binding; none is waived because a profile is disabled.

## Review evidence records

**EVD-T4R-001 — retained test/check observations.** Source: supplied diff's final
gates JSON and logs35–38,49–56,58. Target: report's exact test/check claims and
structure delta. Relation: supports. Coordinates: full105/0 at3f59cf3,
2026-09-17 16:02:29–16:07:06 UTC; final adoption9/0 and strict Clippy/release/fmt
at8db5ada as retained. Environment: macOS arm64, euid502, rustc1.98.1. Sufficiency:
full old executable surface plus final affected tests, not a newly executed
106-test single final invocation. Provenance: implementer-produced retained raw
outputs independently inspected here; no rerun. Limitations: simulator launchd,
no P proof, T4-B01 fixture-boundary hole. Structure output remains exit1 with
production-runtime/src21, production-runtime/test23 and scripts59 unchanged;
supplemental Rust maximum479 lines/20 children/depth2.

**EVD-T4R-002 — independent focused fixture counterexample.** Source: reviewer
nonroot Python subprocess invocation of retained
`target/debug/deps/e2e-b726307ab9f9b930`, SHA256
`f5536e16801ac7368e7e1356e44978725b138ae87b61b938e1ec312b8cefd4a2`.
Target: T4-B01 private-temp refusal claim. Relation: contradicts. Coordinates:
2026-09-18 review, source8db5ada retained binary; euid502;
TMPDIR `/private/tmp/dcp-task4-review-kfevoque`; exact test
`original_nonroot_lock_selftest_remains_available_before_enrollment --nocapture`.
Observed exit0, `1 passed; 0 failed; 2 filtered out`, stderr empty. Sufficiency:
proves acceptance of outside-kernel-user-temp fixture location. Limitations:
root path assessed statically and never executed; no production path written.
Provenance: independent reviewer execution, 10-second outer timeout, newly created
private disposable directory removed after child completed.

**EVD-T4R-003 — retained package readback.** Source: reviewer local Python
hashlib/plistlib reads of the exact package named in final-artifacts.json.
Target: current retained artifact integrity. Relation: supports. Coordinates:
source8db5ada; manifest
`ea4e075fa3a04b9b0dffa8772869beee68e335e47344b7eefe79a306f672f18d`;
package `/private/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/agent-deployd-task4-final-6bfe64sg`.
Observed 23 payloads, all sizes/hashes match, exact25-file inventory, Disabled=true,
eight unresolved items. Sufficiency: retained bytes match the review result;
limitations: not build provenance, complete runtime closure, protection or readiness.
Provenance: independent read-only inspection, no candidate execution.

**EVD-T4R-004 — source-level boundary inspection.** Source: supplied Task4 diff and
focused dependency lookups named above. Target: source behavior/omissions and
T4-B01/02. Relation: supports stated conditional/static findings. Coordinates:
base28c09f7 to head77e5464; executable8db5ada; accepted3986553/bb5327f.
Environment: isolated source review. Sufficiency: exact branch/condition and missing
record checks, not execution proof. Limitations: protected external host state,
external issuer protocols and whole-branch behavior cannot be verified from this
diff. Provenance: independent reviewer who authored no candidate implementation.

## FOLLOW_UP and limits

- F-01: `src/bin/agent-deploy-prepare.rs:30–31` reads the entire recipe with
  `std::fs::read` before checking4MiB. A local FIFO can block or a huge regular
  file can exhaust memory before rejection. Use bounded no-follow regular-file
  reading, as already done for payloads. This is nonprivileged preparation CLI
  robustness, not a demonstrated daemon/root bypass; it is not added to this
  ship-blocker union.
- F-02: Shell guard claims should stay within tested scope. Unlike the JS guard,
  the shell `[ -e ]/[ -L ]/[ -d ]` chain does not distinguish every lookup error
  from absence and does not reject an existing non-directory parent. Protected
  bootstrap ownership/ACL/ancestor invariants and legacy retirement remain
  necessary. No current non-root path to replace the planned protected parent
  was established, so this is follow-up hardening, not an invented exploit.
- Source-line readability in prospective data construction and retained Python
  evidence scripts could improve. No encoded/hidden executable payload, moved
  executable installer line, fabricated registry approval or new Rust limit
  violation was found; style preference is not a blocker.
- No claim is made that all host activity stayed unchanged globally, that existing
  external helpers were retired, or that protected ownership/ACL/trust/key custody
  has been verified. Exact production preimages, native process proof and real
  canary acceptance must be obtained only in the later authorized operation.

Next review boundary: repair T4-B01/T4-B02 once, retain evidence, then a focused
exact-head re-audit of that union and affected semantics. Preserve RP-01–RP-08.
