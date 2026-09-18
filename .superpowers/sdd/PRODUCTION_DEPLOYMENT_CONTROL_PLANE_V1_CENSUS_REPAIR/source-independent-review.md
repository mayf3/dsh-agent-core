# Independent census repair source review

Evaluation date: 2026-09-18 (Asia/Shanghai).
Reviewer: independent delegated reviewer `dcp_census_repair_review`; not the semantic implementer.

## Coordinates and mandate

- Repository: `mayf3/dsh-agent-core`.
- Isolated worktree: `/Users/yanfenma/workspace/worktrees/production-deployment-control-plane-v1-impl`.
- REVIEW_TARGET_HEAD: `bcfd929b7c760947df9c6f03a830a9e8a0b16651`.
- BASE_HEAD: `eb7e72f2bc75c8842492b2b90cac31263dd583ea`.
- CURRENT_BASE_HEAD: locally observed `refs/remotes/origin/main` = `41f354d163f532348b2ad1ef33b5ee528655dfc6`; no network refresh or integration-readiness claim.
- Product authority: `PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1`, accepted reviewed revision `39865536ce51005f95a98473e77c2329078512c0`, especially CTR-DCP-004/005/017/020. Current accepted document changes from that reviewed proposal are acceptance/lifecycle declarations, not this repair's Contract amendments.
- Scope: whole two-file bounded diff, read-only census and directly affected installer/trust dependencies; source inspection plus retained nonproduction test evidence. Read-only operations except writing this explicitly requested review record.
- Route inherited from persisted repair preflight: REUSE / EXEC_PLAN / CONTROLLED, implementation and nonproduction review only.

## Verdict

SPEC_AND_SECURITY_CONFORMANCE = PASS for the bounded source repair.
CODE_QUALITY = PASS for the bounded source repair.
FROZEN_BLOCKER_UNION = empty.
No concrete reachable blocker found. This is not package authorization, privileged retry permission, bootstrap completion, activation readiness, or whole-system conformance.

## Findings and affected-boundary checks

1. `genesis_install_census.rs:234-287`: native entry remains compiled-in `/private/etc/sudoers` with UID/GID 0/0. The factored owner parameters and reader are private; caller requests acquire no arbitrary root-read API. Include parsing, absolute-path constraints, strict components, cycle detection and 256-file cap are unchanged. Included files use the same reader and owner policy.
2. `genesis_install_census.rs:293-337`: the new reader opens once through descriptor-relative `Dir::open_file`, which retains `O_NOFOLLOW`, `O_CLOEXEC` and `O_NONBLOCK`; parents retain the existing secure traversal. It requires a regular single-link file, exact owner/group, no group/other write or special mode bits, no ACL, and only zero/UF_COMPRESSED flags. Trusted root owner write remains possible, consistent with the prior metadata policy; this is not a world/group-writable allowance.
3. Logical reads are bounded by the 4 MiB call-site limit, including a checked limit-plus-one sentinel. Two reads use the same fd. Before/after checks compare bytes, size, identity, ownership, mode, link count, flags and nanosecond ctime/mtime. Visible xattrs retain the existing exact whitelist and byte comparison. Kernel-hidden compression representation is deliberately outside the visible xattr view; the admitted object here is logical configuration bytes, not an artifact or executable representation.
4. `fs/secure.rs`, `fs/file.rs` and `genesis_install_io.rs` are unchanged. Generic snapshots still reject every nonzero file flag, including compression. Package sources/executables/support, protected grants and installed-runner hashing retain their strict path. No key, trust, review acceptance, recovery, journal or mutex semantics changed.
5. `genesis_install_native.rs:109-127,188-204,384-403`: census still executes after grant/package/runner checks and under the existing bootstrap mutex, before creating the attempt or invoking any InstallStep; post-install census equality still verifies the existing configuration surfaces. This repair adds no sudoers write, installer bypass or replay mechanism.
6. Code is localized and readable. Deliberate separation from generic snapshots avoids accidental relaxation of artifact intake. Optional phase-context changes were omitted without changing static error contracts; omission is allowed by the brief. The tests use the production parser/reader through private fixture IDs and refuse root via `FixtureRoots::kernel_temp`.

## Evidence reviewed

Read the brief first, then implementer report and complete retained diff. Verified candidate HEAD, clean tracked deployment-control-plane content relative to candidate, the exact two-file Git delta, and equality of retained diff changed lines/blob identities to that delta (context width differs only). Inspected the shared secure directory/file/xattr/ACL functions, generic snapshots, package/grant input, native preflight/readback and step ordering.

Retained evidence in this directory:

- `red.log`: compressed regression fails with `UNSAFE_FLAGS` through the census, consistent with the brief/report's pre-repair fixture assertions. RED is retained implementer execution, not independently re-executed history.
- `focused-final.log`: all four focused tests pass. Tests assert real ditto-compressed flag32 and logical readback; generic artifact refusal; symlink/hardlink; unsafe modes/flags/xattr/ACL; UID/GID mismatch; decompressed-size boundary; compressed include/includedir; malformed syntax/cycle/count rejection.
- `full-test.log`: 88 unit and 172 integration tests pass, 2 pre-existing explicit manual probes ignored: `local_codex_help_starts_under_same_execution_restriction` (read-only local CLI compatibility) and `local_codex_model_transport_smoke_is_not_attestation` (authorized network model transport), zero failures. Nested worker result lines are not double-counted.
- `validation.json`, `fmt.log`, `clippy.log`, `release.log`: recorded zero exits for formatting, strict all-target Clippy and release build. Report explicitly records the comment-only change during full test execution; exact final source was compiled by Clippy/release. This limitation does not hide a behavioral delta.
- `structure.log`: global structure result is **STRUCTURE_VIOLATION**, not PASS. Its three violations have identical base/head values: production-runtime/src 21, production-runtime/test 23, scripts 59. They are unrelated unchanged FOLLOW_UP_DEBT. No candidate-introduced structure violation is shown; both changed Rust files and bootstrap directory remain within their stated limits.

No unchanged test suite rerun, privileged command, live privileged configuration read, credential access, system modification, package replacement or subagent use occurred in this review. No source edits occurred. Prior failed package and root preimages were supplied context, not independently re-read live. Actual compressed production census, exact corrected inert-package binding, new exact Owner authorization and any later receipted root continuation remain separate boundaries. Available for the requested inert-package source/hash review.

## Actual inert package binding review (intermediate pins)

Parent subsequently requested read-only verification of `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/genesis-bcfd929` and its sibling `.pins.json`/`.preparation.json`.

PACKAGE_BYTE_BINDING = PASS at the following **intermediate** tuple:

```text
plan_digest = 4e2c057caa154391a5edcd9f78f502be28ec33f40b8884337c813f30378a329a
package_digest = 5bf407d815068e84d9dcfbbbe442498169bb43ab98f388b168bd5d6eca40911b
source_digest = 6e06c0b665c8758c548adf02816c7f892ed4b8710cbc999ee0c3e7a82bb95a0d
review_record_digest = 77c284103808fe2608feb43729051cdc15661c04309016491aa92625bb0c4d63
initial_registry_digest = 2a02f1b597c1963a1b080924d778099b6aea3c1ef345ae04643648cd8e333842
supervisor_policy_digest = 980d3f08cd741139b6d1c1d5ade9b0a7a9deefe4a650776b1b504c0258cdb6a0
source_tree = ed0d500fff0546abb68099a4ab51a0114827fc0a
```

Independently recalculated all six pins (canonical sorted compact JSON for typed plan/source-map digests, raw byte hashes for sealed files). All 153 packaged source files match their declared SHA256 and exact Git bytes at reviewed HEAD. Source tree matches Git. All four executable byte hashes match plan/package/preparation declarations; `file` confirms arm64 Mach-O. Schema bytes match declared `8c19ccf24f5f929bcbcc70bafff468b0fd23cbaf272fc64497157d02e4eb7e50`. Complete package regular-file inventory is exactly 163 declared files, without extra or missing entries.

Actual executable SHA256:

- agent-deploy-bootstrap: `d918d8f6f1d5e84334cd4a5e130cca998bcc5eb049a5de10a95093c0f4e7fe3c`
- agent-deploy-issuer: `13f1afd7173356069939253ea53a06b757ca0d76442cff42fd9c61f3161b22cb`
- agent-deployd: `d334470bfac831b6dee1ce314ac8db6aecdafcca7aec9804336ad6362e743a88`
- codex: `b973d440acac501fd2594a43e7ca9ce41e0a65b9dfb28d0d7a7837c99e1261e3`

Compared with original inert `genesis-65559dd`: initial business registry and Codex bytes are identical. Recursive JSON comparison shows supervisor policy changes only `issuer_policy.review_helper_sha256`, now matching the rebuilt agent-deploy-issuer above. No other policy semantic delta was observed.

The review-record explicitly says INTERMEDIATE/not an approval. Final record and plan must be resealed and final pins mechanically verified. Source bytes and package digest are independently checked; build provenance is the retained local-build observation, not an independently reproduced build or cryptographic trusted-build attestation. This package check neither authorizes nor performs root installation and makes no live-state or protection-metadata claim.
