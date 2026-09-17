# Task 4 — inert bootstrap, native closure and adoption evidence

Disposition: **DONE_WITH_CONCERNS** for the bounded source/preparation assignment.
Actual production adoption remains blocked. No bootstrap permission is requested
on the unresolved package, and no production operation was performed.

## Coordinates and DEVELOPMENT_PREFLIGHT

- Worktree: `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`.
- Task base: `28c09f73897b98ba3da520d43128f49eb101a0b0`.
- Accepted semantics: `39865536ce51005f95a98473e77c2329078512c0`;
  acceptance merged at `bb5327f622a0333f1e11d945319e024a3731f05a`.
- Initial source commit: `3f59cf3aa4c11ae2dbec107e1284487b45bac099`.
- Final source commit: `8db5ada86ce13f5f22727cd8fc6d8734afad35a9`.
- Final evidence/report commit follows; it changes no tested executable source.

PREFLIGHT was emitted before implementation: REUSE / EXEC_PLAN / CONTROLLED,
ROUTE_STAGE=IMPLEMENTATION, AUTHORITY_ACCEPTED_IN_BASE=YES,
IMPLEMENTATION_AUTHORITY=contracts, valid controller task mandate and isolated
write surface, SPEC_GAP=NONE, IMPLEMENTATION_ALLOWED=YES,
OPERATION_ALLOWED=NO. The task owns CTR017–019 and cross-contract adoption checks;
no accepted authority was reopened. DONE_WHEN is reviewable inert source/package,
rejecting fixtures, retained evidence and explicit production blockers. Root copy,
activation/enrollment, privileged tool execution, production writes/restarts,
sudoers, key provisioning and live legacy retirement are forbidden here.

Controller preparation, later known-file observations and main movement are
bounded observations, not a stable protected preimage. Fresh origin/main movement
was docs-only and separately recorded by the controller. No global claim that
unrelated production stayed unchanged is made. Local memory search had no relevant
result and supplied no load-bearing evidence.

## Implemented interfaces and limits

`src/bootstrap/{bundle,verify,prospective,loader,plist}.rs` implements a non-root
inert generator, typed candidate manifest, offline verification and complete static
non-system Mach-O graph checking. `agent-deploy-prepare prepare INPUT_JSON
NEW_EMPTY_DIR` creates payloads, canonical manifest and a disabled plist; `verify
BUNDLE MANIFEST_DIGEST SOURCE_DIGEST CHECKOUT` checks exact inventory, bytes,
prospective constraints and source hashes. Expected digests are review inputs,
not self-authenticating provenance. Root invocation is rejected. No installer,
activation writer, private-key generation or generic command interface is added.

The exact candidate profile has fixed system Runtime/W1/W2 handling, regular-file
app slots only, external per-Goal acceptance, STOP_TRAIN, 300s policy lease and
finite existing quotas. Numeric proposed identities are caller502:20,
socket-group602, Runtime/W1 505:601 and W2 0:0. Host identity is explicitly
UNRESOLVED. Proposed issuer IDs are dcp-authority/builder/reviewer/producer/verifier/
recovery-v1, with role-specific scope and binding descriptions; all actual public
keys, service identities and custody receipts remain null. Producer scope includes
its own registry identity. These are requirements, not provisioned trust.

Manifest layout fixes root ownership/ACL-none, root0700 state, 0600 permanent
`daemon.lock`, `production.lock`, **`publication.lock`**, queue and private records,
0750/root:602 socket parent and0660 socket. It records canonical `/var` alias and
future re-pin/collision/ownership/ACL checks. No fixture key becomes production
trust. The existing Task3 versioned verification-request completion/CAS and
publication lock semantics are preserved and exercised by the full suite.

`NativeEnrollment` now requires `loader_files`, `launchctl_sha256` and
`plutil_sha256`, in addition to Node/plist/profile/initial-file pins. Before native
service operations, root no-link descriptor traversal checks every non-system
Node/dylib file, ancestors, metadata and digest. The parser rejects missing/extra
or duplicate closure entries, wrong runtime architecture, malformed commands,
rpath/environment load commands and nonprotected dependency paths. Node remains
x86_64. Limits are64 files,128MiB/file,512MiB/closure; app64MiB and socket64KiB limits
are unchanged. Apple's sealed `/usr/lib` and system-framework/shared-cache space
is an explicit platform boundary requiring future protected OS readback.

Fixed Apple launchctl/plutil hash checks retain root owner/mode/ACL requirements,
allowing only observed restricted/compressed platform flags. Artifact and runtime
loader metadata rules are not relaxed. Plutil receives the exact already-hashed
plist bytes via stdin with env_clear,1MiB input/output,2s deadline, owned kill/reap,
no candidate path reopen and no output values logged. Native precheck compares
exact ProgramArguments and rejects NODE_OPTIONS/NODE_PATH, DYLD_*/LD_*/
__XPC_DYLD_*, external Node REPL, OpenSSL and ICU load configuration. Ordinary
service configuration is retained. This helper is read-only, not a plugin/hook.

The four inspected repo installer/routing/transaction/launchd entrances use fixed
readable `/usr/local/libexec/agent-deployd/enrolled-dsh-runtime` enrollment guards.
Present marker, unreadable lookup or unsafe existing parent refuses with queue
migration guidance; true pre-bootstrap absence preserves legacy behavior.
Routing's local modules are now dynamically imported only after the guard.
There is no production environment path override. Source tests relocate literal
paths in copied scripts, never write a production marker.

Known installed helpers, external wrappers, four lock families, sudoers includes,
launchd/cron managers and service-account/lifecycle controls are listed in the
package. Installed copies remain untouched. Inventory explicitly includes an
unresolved exhaustive-host remainder; no omitted/unreadable surface implies PASS.
Parent505/root lifecycle denial is separate from legitimate caller-controlled
uid502 agent children. Current gui/502 svc-workflow remains ineligible;
auth-service and the distinct GUI runtime remain unenrolled.

Installer structure repair moved15 explanatory comment blocks verbatim into
`docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_LEGACY_INSTALLER_NOTES.md`.
The script links it and retains concise purpose/use/safety comments. It is498 lines.
Mechanical comparison to28c09f7 proves **all original nonblank, non-comment
executable lines are identical**, excluding only the new guard; no here-doc exists
and no string/executable line was moved. Executable-line SHA256:
`ca28391f4a8fda1e79f2d4ed7df120beca0388d8738739fe0c1ea30c011ccc77`.
No structure registry, rule or approval identity was altered.

## Actual inert artifacts

Exact native candidate directory:
`/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl/.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_IMPLEMENTATION_PLAN/task-4-native-candidate-r2`.
It contains22 x86_64 Mach-O files,117266720 bytes. Input source hashes, architecture,
load mappings, rpath removals, output hashes and local ad-hoc signing disposition
are retained in `task-4-evidence/native-closure-manifest.json`.
Closure-manifest SHA256:
`b6b497f0b879aa901b674d0fb2ab33f7ac6084d490f3ebc69cc0b052902a8364`.

The assembler copies current observed Node/Homebrew input bytes locally, rewrites
all non-system loads to fixed protected absolute destinations, removes rpaths and
uses fixed Apple install_name_tool/codesign. Every transformed file passes local
codesign --verify --strict and preserves x86_64. It is **not executed**, installed,
or trusted as an accepted build. Ad-hoc signatures establish structural validity
only. Final protected-runtime validation and accepted build/review provenance are
still missing. Static Mach-O graph coverage does not itself prove Node's dynamic
JS/import/native-addon or harness closure; exact initial app/release facets and
trusted complete build/root-code review remain blockers.

Final package directory:
`/private/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/agent-deployd-task4-final-6bfe64sg`.
It has23 payloads, disabled plist and canonical manifest. It has no activation,
sudoers grant, private signing material or fixture trust. Binary payloads remain
local outside Git; source, reproducer, manifests and receipts are retained in Git.

- Canonical/raw manifest SHA256:
  `ea4e075fa3a04b9b0dffa8772869beee68e335e47344b7eefe79a306f672f18d`.
- Complete relevant per-file source-map digest:
  `2b3e7e19ccb95f9dec1b3c9a9f45347cca1728a63d0af0ea2288700d74e22291`.
- ARM64 native controller binary SHA256:
  `18a69c94b86026a3f4a75d5deff8b6deeea070514c2b3da3dba53d1bc7a21088`.
- Nonroot preparation CLI SHA256:
  `53599a158c7aef35f020e2298cf2f4408969c1edda181725d132d6cbb6669084`.
- Fixed plutil SHA256:
  `3d4086a77e9bc2eb3eab7dc707ff844a8949b78c80daa2ffaa2e643e022c1c2f`.

`final-artifacts.json`, `final-recipe.json`, `final-manifest.json`, the exact plist,
`43-final-package-prepare.log` and `44-final-package-verify.log` bind source8db5ada,
all bytes and verification. Both package commands exit0; verdict is
`integrity_verified=true`, **`bootstrap_ready=false`** with eight blockers.
Workspace ancestors have ACLs refused by the strict package root checker, so the
real package is in the protected-metadata-compatible private kernel temp tree.
Source checkout verification pins its nonprivileged root FD and traverses no-link
descendants; it does not pretend user-owned source is a root executable closure.

## Executed RED/GREEN and final checks

All raw outputs are retained in `task-4-evidence/`. Cargo commands use
`--locked --manifest-path packages/deployment-control-plane/Cargo.toml`.
No failed log was overwritten or renamed into proof of success.

- 01→02: missing canonical source guard rejected by the test; four whole copied
  scripts then refuse before mutation logic. 07→08: unreadable marker lookup
  regression;18→19: unsafe caller-owned parent regression. Later46→49 exercises
  readable whole guards, true absence, all four unsafe lookups and existing lock
  selftest.46 is the expected missing-delimiter failure while tests were refactored.
- 03→04: permissive loader stub accepted transitive Homebrew; final graph checks
  reject Homebrew/rpath/environment/missing/extra/wrong-architecture/truncation.
- 05→06: package verifier stub reported ready and accepted mismatches. Package
  generation scaffolding already existed;05 specifically proves the missing
  validation/refusal behavior, not absence of a generator. Tests reject changed
  source/binary, unknown files/secret input, unsafe ownership/mode/ancestors,
  nonallowlisted targets, enabled GUI profile, unsafe sudoers, omitted lifecycle
  denial/inventory and invented fixture trust.
- 09→10: first assembler mistakenly included LC_ID_DYLIB as a load, producing
  duplicate destination names. Corrected to actual load commands; all22 real
  candidate files transform and verify. Failed directory/log are preserved.
- 12→13: generic file validator rejected Apple's legitimate restricted/compressed
  launchctl flags. A fixed-platform-only narrow validation path passes actual
  read-only host tool metadata and rejects digest drift.
- 15: workspace ACL refusal;17: legitimate sealed-system libc++ path was rejected
  by the initial ASCII component grammar.20 reproduces libc++ failure;21/28 pass
  after allowing `+` in canonical loader names. No Homebrew exception was added.
- 30→31: exact-byte plist parse/unsafe environment cases, including an XML-escaped
  NODE_OPTIONS key; invalid/oversized input and tool drift refuse. No live plist
  was edited or used as a malicious probe.
- 45→49: proposed Producer lacked its own scope; real Queue registration rejected
  PRODUCER_SCOPE. Final scope is correct and unknown host is explicit.48 retained
  a failed source-text replacement attempt, still PRODUCER_SCOPE;49 passes.

**Full final serial invocation at3f59cf3**: `cargo test ... -- --nocapture`,
35-final-full-suite.log, exit0, **105 tests passed /0 failed**, including the
4096-slot install/rollback journal. Library18 + authority12 + bootstrap5 + e2e3 +
filesystem12 + queue25 + socket4 + Train17 + transactions9. Helper child test
invocations are not double-counted. Final-gates.json records exact start/end/head.
36 fmt,37 `cargo clippy ... --all-targets -- -D warnings`,38 release build: exit0.

After that full run, only prospective host/Producer-scope and guard readability/
comment extraction/tests changed, committed8db5ada.49 final affected tests:
**bootstrap6 + e2e3 =9 passed**,50 strict clippy exit0,52 release build exit0.
These executed observations cover all106 final-source tests; no second final
whole-suite pass is claimed for8db5ada. Core transaction/Train/mailbox/loader/plist
behavior did not change after the passing full suite.

23 is a retained **failed full invocation**: the4096-slot test passed, then Cargo
ran a concurrently replaced bootstrap RED stub binary. This was the author's
coordination error (concurrent Cargo jobs shared target output), not final-source
proof. It ended101 and is never called an overall PASS.35 reran the full suite
serially with no concurrent Cargo builds/tests and passed.33 affected suite also
passed before the final boxing/guard/template changes.

Clippy22/24/29 identified same-Goal prior implementation diagnostics, not
repository-grandfathered debt: duplicate common/fixture module loading,
too_many_arguments, type_complexity, needless_question_mark and
DoubleEndedIterator::last (two duplicate-module file diagnoses, six initial
library/test diagnostics). Shared imports, one named tuple alias, direct result
return and next_back fix these mechanically. Executor::apply retains its reviewed
explicit authority/guard/policy/unit/time/caller API via one controller-approved
`#[expect(clippy::too_many_arguments, reason=...)]`, not a crate-wide suppression.
32 additionally exposed the now-large native enum after added closure fields;
boxing only its Native variant resolves it. New local manual_is_multiple_of,
needless_question_mark and test permission octal diagnostics were also corrected.
37 and50 are actual clean strict all-targets results, not a non-strict relabel.

Raw staged whitespace check59 flags only preserved Cargo-log trailing blank
lines; outputs were not trimmed. Report-only check60 exits0.
Final quality54: both shell scripts `bash -n`, both JS scripts `node --check`, fmt,
governance integrity and source whitespace pass.42 governing-Spec diff is empty.
51 machine structure at8db5ada/base28c09f7 exits1 with exactly the three existing
violations: production-runtime/src21, production-runtime/test23, scripts59;
no new violation.40 retains the initial touched-installer/dense-guard failures.
53 supplemental Rust check:74 files, max479 lines,20 immediate children, depth2;
test root exactly20 children. No hidden code split, enlarged registry ceiling or
global structure PASS.55 confirms no owned control-plane fixture process remains.
56 independently reparses the final plist and rehashes all23 payloads, confirms
no activation/private-key/service configuration file, and preserves all unresolved
issuer fields.57 retains full successful standalone private lock-selftest output.
58 repeats the machine structure comparison against accepted basebb5327f and
also retains exactly the same three pre-existing directory violations.
Private fixture socket lifecycle is exercised by socket/Train tests; no production
socket was created, removed or tested for mutation.

## Frozen readiness blockers and next action

The package's exact blocker union is:

1. Real host binding and exact native enrollment, including current initial slots,
   current runtime root/plists/service identities and protected preimages.
2. Real isolated issuer public keys/custody/service identities and authenticated
   upstream adapters. Task3's executable protected mailbox transport exists;
   actual producer/build/review/authority/verifier bridges remain unimplemented
   because no real protocol/service/credential contract was supplied. Never guess.
3. Trusted complete source/build/review bindings; local hashes are insufficient.
4. Exact proposed release slot list and complete required app/root-code/harness/
   native-addon facets. Unsupported facets prevent enabling a claimed release.
5. Protected ownership/ACL/platform/OS preflight and exhaustive actual legacy
   write/launchctl/signal/sudoers/job denial under enrolled identities.
6. Review of transformed Node candidate, accepted signatures/build provenance and
   native runtime validation; no live Node/plist/Homebrew modification occurred.
7. Independent whole-branch security review, dispatched by the controller.
8. Separate exact Owner bootstrap receipt/epoch after the other prerequisites
   become reviewable. No Owner click can make a rejected artifact acceptable.

The eventual single Owner request is: authorize one independently reviewed exact
manifest/source/controller/Node closure/trust-root/numeric-identity/target-enrollment
and rollback package, using pinned Apple tools to stage and rehash inside a new
root-owned closure **before first privileged execution**, then provision disabled
state, retire legacy bypasses and conduct the receipted canary before standing
admission. The current digest above is a blocked candidate, not an actionable
activation request: actual trust/enrollment must first produce a replacement
fully bound manifest. No extra per-head Owner confirmation is added for routine
units after valid adoption.

IMPLEMENTATION_COMPLETE = YES for the assigned bounded source/preparation work;
end-to-end production integration/adoption = NO, externally blocked as listed.
TESTS_PASS = YES at the exact full/affected coordinates above.
INDEPENDENT_REVIEW_PASS = PENDING_CONTROLLER_REVIEW, not self-declared.
BOOTSTRAP_READY = NO.
PRODUCTION_GOAL_COMPLETE = NO. No push or merge performed.

## Frozen Task 4 repair: T4-B01 / T4-B02

This appendix supersedes only the prior fixture-safety and current-package claims;
historical observations above remain at their original coordinates. Controller
mandate freezes B01/B02 from [task-4-review.md](task-4-review.md), with no F-01/F-02
or style expansion. REUSE / IMPLEMENTATION / EXEC_PLAN / CONTROLLED; accepted
39865536/bb5327f unchanged; source/private nonroot fixtures/inert artifacts only.
Fix base `77e54641c63f976de1089bcf99970a620f126f47`.
Repair source `a263c8089e16b3614f37b5c4766af50f4d449275`.
The final evidence commit contains this appendix; it changes no tested source.

B01 changes only `test/adoption/{fixture,bootstrap,e2e}.rs`. One cohesive helper
checks actual euid before fixture effects; explicit base selection also enters
that guard before any effect. It obtains Darwin's kernel user-temp path via
confstr, disregards TMPDIR, rejects outside/aliased bases before creation, creates
0700 using tempfile's creation permissions, then validates FixtureRoots' existing
descriptor/owner/ACL/ancestor boundary. Every effectful adoption entry uses it;
the two read-only platform-tool cases explicitly guard before reads/child work.
The pure Mach-O byte-parser test has no filesystem/process effects.

Root ordering is tested through the very same guard with injected uid0 and a
harmless Cell closure; no root process/probe ran. An explicit `/private/tmp` base
rejects without being created/opened. The whole affected run sets TMPDIR to
`/private/tmp`; the helper safely ignores it and validates the kernel-selected
root. These are distinct proofs: the old selected selftest can now PASS safely
inside the kernel tree, rather than being required to fail on hostile TMPDIR.

The copied installer alone substitutes its unique `/tmp` stamp literal with a
shell-quoted private-tree template. It asserts one occurrence, inverse replacement
recovers every original byte, full existing SELFTEST_LOCK behavior passes, and
cleanup leaves only the copied script. Actual production legacy script bytes and
execution semantics are unchanged; its historical log57 does not prove the new
private stamp location. Source/root/native production code, Task3 publication.lock
and versioned verification work remain unchanged.

B02 adds [stable evidence relations](../../../docs/reports/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_EVIDENCE.md)
EVD-DCP-T4-001–016 and links all14 conformance rows directly. Each binds accepted
authority, source/test/log coordinates, profile inputs/environment, observed
positive/rejecting cases, relation, sufficiency, limitations and provenance.
S1/S2/S3 retain their original execution and independent review coordinates;
F4 full105@3f59, A4 affected9@8db5 and R4 repair15 executions@a263 remain separate.
Old EVD-T4R-002 stays contrary evidence at8db5, not a discarded failed observation.
Only the selected nonproduction subclaims are supported; P remains NOT EXECUTED.

### Repair RED/GREEN and checks

All retained output is under `task-4-evidence/`. Commands run as euid502 in the
same macOS arm64 worktree; Cargo commands below use cwd `packages/deployment-control-plane`.

| Log | Actual command/result and source coordinate |
|---|---|
|61-fixture-boundary-red.log|`cargo test --locked --test bootstrap --test e2e fixture:: -- --nocapture`: exit101,3 failures in bootstrap; Cargo stopped before e2e. Intermediate pre-a263 scaffold intentionally lacked root/base/kernel implementation.|
|62-stamp-boundary-red.log|`cargo test --locked --test e2e original_nonroot_lock_selftest -- --nocapture`: exit101,1 fail. First helper implementation correctly refused its own default0755 tempfile; unintended UNSAFE_MODE failure, not stamp RED.|
|63-stamp-boundary-red.log|Same command after explicit0700 creation: exit101,1 fail at the intended unrelocated-stamp assertion, before invoking the copied installer.|
|64-repair-adoption-green.log|`TMPDIR=/private/tmp cargo test --locked --test bootstrap --test e2e -- --nocapture`: exit0, bootstrap9/e2e6;15 executions,12 unique cases (shared3 helper tests run twice). UTC2026-09-17T16:37:34.844564Z to end timestamp in log. Exact source subsequently committed unchanged as a263c80.|
|65-repair-strict-clippy.log|`cargo clippy --locked --all-targets -- -D warnings`: exit0. No new suppression.|
|66-repair-source-checks.json|fmt check, governance integrity, source whitespace exit0; governing-Spec diff empty; production src/Cargo inputs/installer diff empty against77e5464.|
|67-repair-machine-structure.json|Machine verifier at a263/base28c09f7 exits1, exactly existing production-runtime/src21, production-runtime/test23, scripts59 violations; no new violation and no globalPASS.|
|68-repair-rust-structure.json|75 Rust files, max479lines/20 immediate tracked children/depth2, test-root20, adoption3.|
|69-repair-binary-source-equivalence.json|Exact package diff from8db5 to a263 is the3 adoption test files; all production/build inputs identical. Both retained release binaries match their original hashes.|
|70/71-repair-package-prepare/verify.log|Nonroot fixed prepare CLI generates/verifies replacement exact source-bound inert package; exit0, integrity=true/readiness=false.|

61–63 are retained intermediate working-tree observations, not false claims of
running the committed final source. They establish the development failures;64
is the final-source behavioral proof. No full transaction/4096 test repeated.
No production script changed, so prior shell syntax/executable identity evidence
remains applicable; the affected relocated full selftest executes in64.

### Replacement inert artifact

Old package, recipe, manifest and all logs are preserved at8db5ada. Its source map
included the modified tests and therefore is historical-only for this checkout.
The new [recipe](task-4-evidence/repair-recipe.json) and reproducible
[assembler](task-4-evidence/assemble-repair-package.py) bind84 current source files.
Receipt [repair-artifacts.json](task-4-evidence/repair-artifacts.json) records:

- Package `/private/var/folders/jh/5k4x44w12ps1kbrch8__f6b80000gp/T/agent-deployd-task4-repair-wscow2bn`.
- Manifest SHA256 `1b4b4e1608f9335eb4db8aba319b0e19a0e8610ccefac2c1df2c25e6bbe949c6`.
- Source digest `da70fad9b07a064a07489c14aff006cc1781a66ca359e7d44522bb7fed1bebb7`.
- Same23 payloads/25-file inventory; every payload rehashed/size-checked; eight
  unresolved prerequisites unchanged. All binary payloads remain local outside Git.
- Reused controller `18a69c94b86026a3f4a75d5deff8b6deeea070514c2b3da3dba53d1bc7a21088`
  and prepare CLI `53599a158c7aef35f020e2298cf2f4408969c1edda181725d132d6cbb6669084`,
  originally built at8db5ada. Receipt69 checks exact bytes and production/build-input
  equivalence; this repair did not rebuild binaries or claim new build provenance.
- Same candidate closure digest
  `b6b497f0b879aa901b674d0fb2ab33f7ac6084d490f3ebc69cc0b052902a8364`; no transformed
  Node execution or trusted-origin upgrade occurred.

### Repair disposition and preserved limits

B01/B02 are implemented and self-verified; scoped independent re-audit is pending
controller. This is a bounded source/test/evidence gate, not overall implementation
or bootstrap closure. RP-01–08 remain exactly the review's frozen union, including
actual host enforcement/enrollment and complete release-face integration gaps,
**unimplemented real upstream-to-mailbox bridge code**, real issuer/custody and
trusted provenance, protected legacy/lifecycle denial, native validation,
whole-branch independent review and exact Owner bootstrap receipt. Missing external
inputs do not turn those code omissions into completed integration. The later
host-digest observation remains OBSERVED_NOT_ENROLLED and does not resolve RP-01.
F-01 recipe bounded reading, F-02 broader shell lookup-error hardening, and style
remain FOLLOW_UP outside this repair union. No new permission request, subagent,
production operation, root invocation, push or merge occurred.
