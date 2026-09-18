# Task 1 census repair report

Status: implementation complete and requested Rust validation PASS; independent review belongs to controller.

Base: eb7e72f2bc75c8842492b2b90cac31263dd583ea.
Scope: only `packages/deployment-control-plane/src/bootstrap/genesis_install_census.rs`
and new private unit-test module `genesis_census_tests.rs`.

## Implementation and provenance

Applied existing persisted REUSE / EXEC_PLAN / CONTROLLED preflight from
`docs/exec-plans/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_CENSUS_REPAIR.md`.
Governing PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 remains unchanged.
Production sudoers entry remains fixed `/private/etc/sudoers`, UID/GID 0/0.
Private recursion takes explicit IDs solely so nonroot fixtures traverse the same
production reader/parser; no public arbitrary root reader or override added.

Census-only read permits flags 0 or UF_COMPRESSED, retaining descriptor-relative
O_NOFOLLOW and parent validation, owner/group/type/single-link/mode/ACL checks.
It compares two bounded logical reads on the same fd, metadata including ctime,
mtime and flags, and the existing visible xattr whitelist and exact values before
and after. Default macOS xattr view hides compression backing attributes, which
are interpreted by the kernel. No generic fs reader or whitelist is changed.

Local SDK headers inspected: `/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sys/stat.h`
defines UF_COMPRESSED 0x20; `sys/xattr.h` defines XATTR_SHOWCOMPRESSION 0x20.

All new fixtures use FixtureRoots::kernel_temp(), refuse root, and create disposable
private temp directories. Real `/usr/bin/ditto --hfsCompression` supplies compressed
files; tests assert flags exactly 32 and logical byte readback before invoking the
census. No real privileged path, credential, installed runner, old package, root
lock, service or identity was touched. chmod/fchflags/xattr operations target only
owned disposable fixture files. No subagents spawned.

## RED and GREEN

RED command: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml compressed_sudoers_census -- --nocapture`.
Captured `red.log`: test process exit 101 (shell wrapper ended with cat/exit 0),
actual existing census graph failed with UNSAFE_FLAGS after artifact rejection
and successful flags32/logical bytes fixture assertions. Only private ID factoring
and the regression existed then; no census-specific reader existed.
Same command after implementation: `green-initial.log`, test result 1 passed.

Focused command: `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml genesis_install_census -- --nocapture`.
Initial `focused.log` failed in test setup: writing an owner-readonly fixture and
setting xattrs on readonly fixture metadata. Changed only fixture setup to owner
writable before mutation, then normal readonly where needed. Final
`focused-final.log`: 4 passed, zero failed.

Coverage: real compression + generic artifact snapshot refusal; symlink and hardlink;
group/other writable or setuid metadata; disallowed flag; disallowed xattr; ACL;
wrong UID/GID; decompressed logical-size boundary; compressed explicit include and
includedir graphs; malformed syntax, cycles and 256-file census bound.

## Self-review and limitations

Only sudoers and explicitly parsed includes use the new reader. All artifact,
key/grant/executable readers remain strict. Include parsing/limits/cycle behavior
unchanged. Source and test files stay below 500 lines; bootstrap directory stays
below 20 immediate children. No privilege boundary is relaxed for artifact intake.

Optional phase-specific error context omitted: existing Error stores only a static
code, and broad error-plumbing changes are unnecessary for this bounded repair;
existing error contracts remain unchanged. This is fixture evidence, not live
root census, successful bootstrap or activation proof. Independent security review
and any corrected-package production authorization remain controller/Owner gates.

Raw logs and validation.json are retained adjacent to this report (untracked,
ignored execution evidence); source/test files alone will be committed.

## Final validation

Source/test commit: `bcfd929b7c760947df9c6f03a830a9e8a0b16651`. Only the two named source/test files are committed.

- `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml` — exit 0; raw `full-test.log`.
- `cargo fmt --manifest-path packages/deployment-control-plane/Cargo.toml -- --check` — exit 0; raw `fmt.log`.
- `cargo clippy --manifest-path packages/deployment-control-plane/Cargo.toml --all-targets -- -D warnings` — exit 0; raw `clippy.log`.
- `cargo build --manifest-path packages/deployment-control-plane/Cargo.toml --release` — exit 0; raw `release.log`.

Full suite: 88 unit tests passed, 2 existing worker-entry tests ignored; 172 integration tests passed. Total 260 passed, 2 ignored, zero failed. Child-worker executions additionally recorded in full-test.log are not double-counted. The 4096-slot test completed; unit-suite duration 269.42s.

Focused final: 4 passed, zero failed. `git diff --check` passed.

The final source comment clarifying hidden compression xattrs changed during the full suite; no behavior changed after its compilation. Strict Clippy and release build compiled the exact final source.

## Structure gate and residual concern

`node scripts/verify-code-structure.mjs --base eb7e72f2bc75c8842492b2b90cac31263dd583ea --head bcfd929b7c760947df9c6f03a830a9e8a0b16651 --json` returned verifier exitCode 1, STRUCTURE_VIOLATION (shell output wrapper exited 0). Raw `structure.log`. Three pre-existing unchanged violations, all baseValue == headValue:
- `packages/production-runtime/src`: UNREGISTERED_LEGACY_DIRECTORY, base/head 21/21.
- `packages/production-runtime/test`: DIRECTORY_OVER_CEILING, base/head 23/23.
- `scripts`: DIRECTORY_OVER_CEILING, base/head 59/59.

FOLLOW_UP_DEBT: these unrelated production-runtime/scripts baseline violations were not repaired. Changed Rust files manually verified at 353 and 219 lines; bootstrap now has 18 immediate tracked files (under20). No global structure PASS is claimed.
