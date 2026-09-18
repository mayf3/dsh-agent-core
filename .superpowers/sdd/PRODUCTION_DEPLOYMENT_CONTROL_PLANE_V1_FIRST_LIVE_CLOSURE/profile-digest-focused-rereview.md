# Focused rereview: activation-normalized profile digest

REVIEWER_ID = dcp_first_live_binding_review
AUTHOR_INDEPENDENCE = PASS
AFFECTED_SOURCE = 730d4a0539cc758eb8c0440e9ceddbefde4c017d
AFFECTED_TREE = dcfc5c84b663da8b1713627757d29503d89aba99
REVIEW_STATUS = PASS_AFTER_FLI_01_CLOSURE
REVIEW_TARGET_HEAD = e8f863fdb5d3b95dc45cd202acee5c1c69124551
REVIEW_TARGET_TREE = b48cf247ab48b1ee77d1600af9cb80036592fe8b
REPAIR_BASE = fd4b5f19bf1b5023e91dd4b674dbac1d6cb36cc6
OPEN_BLOCKERS = 0
HISTORICAL_BLOCKERS = FLI-01 (closed by exact repair below)
PRIOR_PASS = SUPERSEDED_BY_NEW_DIRECTLY_AFFECTED_EVIDENCE

This finding supersedes the current applicability of first-live-binding-independent-review.md's PASS; that prior record remains historical. The newly observed defect is confined to issuer profile selection introduced in the reviewed delta. It does not reopen unrelated closed findings or imply that the separately installed old-source disabled genesis package changed.

## FLI-01 — valid active native profiles cannot pass new issuer selection

Priority: P1. Class: CONCRETE_REGRESSION.

SOURCE: Accepted PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1 CTR-DCP-004 trusted build/profile binding; pre-existing native activation binding enforced by bootstrap::profile_digest and validate_native_binding; the current implementation mandate requires usable first-live issuer wiring while preserving current native binding and v1 compatibility.

COUNTEREXAMPLE: At source 730d4a0, bootstrap/binding.rs:11–14 explicitly clones Profile and forces enabled=false before computing NativeEnrollment.profile_digest. The same module at :34–36 requires the normalized digest and the requested active flag. Native Intake::open at service/intake.rs:114–119 validates this with active=true, so a valid active native profile has enabled=true while its enrollment digest still represents enabled=false. New issuer/owner_policy.rs:223–232 instead requires native.profile_digest == digest(profile), which hashes the enabled=true profile. prepare_native opens active Intake first and then always calls select at issuer/coordinator.rs:96. Barring a hash collision, no correctly enrolled active profile can satisfy both checks; v1 and v2 both return ISSUER_PROFILE_BINDING before issuing a real deployment.

IMPACT: The candidate's new issuer selection makes the intended first real automatic deployment impossible with valid native startup state. Existing issuer fixture constructed native.profile_digest directly from the enabled=true profile (test/issuer/owner_policy.rs:36) without exercising the shared activation convention, so its happy path masked the defect. This is a functional fail-closed regression, not a discovered privilege bypass.

MINIMAL_CLOSURE: Use the existing shared bootstrap::profile_digest helper in issuer selection; do not delete profile binding or accept either arbitrary digest. Correct fixtures to build the genuine normalized enrollment. Add a failing regression before implementation that proves both v1 and v2 selection accept a valid active native configuration/enrollment that also passes the shared native binding gate, while a changed digest and relevant profile drift still fail. Retain legacy canonical v1 policy bytes and draft binding compatibility. Rerun affected issuer/bootstrap tests and required source checks, then independently rereview only this correction at its exact source coordinate.

## Independent reproduction status

The source-level reachable contradiction above was independently traced through the public bootstrap/native Intake/issuer path before the fix. No root command, real activation or production endpoint was used. Runtime regression evidence will be appended below once the author has retained its RED observation and frozen the minimal fix; an authored test definition alone is not a passing observation.

## Exact repair closure — 2026-09-18

FLI_01_STATUS = CLOSED
INDEPENDENT_FOCUSED_REREVIEW = PASS
CONCRETE_NEW_BLOCKERS = NONE
PRODUCTION_OPERATION_ALLOWED = NO

Reviewed correction: e8f863fdb5d3b95dc45cd202acee5c1c69124551, tree b48cf247ab48b1ee77d1600af9cb80036592fe8b, base fd4b5f19bf1b5023e91dd4b674dbac1d6cb36cc6. Exactly one implementation line changes: issuer/owner_policy.rs:226 now calls bootstrap::profile_digest(profile). It neither removes binding nor adds an alternative accepted hash. Activation still independently requires enabled=true; normalization excludes only that activation bit while retaining the rest of the exact profile. No policy encoding, signature domain, v1 draft/cache formula, source selection, queue/transaction, native binding implementation or installed package changed.

The RED log records both newly added v1/v2 tests failing at the expected issuer comparison after each successfully passed actual validate_native_binding(active=true). SHA256: d457af45a0a7df5fe3f7fa29eb98c86fcd41be52db4136dbcbf0436b82ff584d. The test file at the repaired source uses the shared normalization in the generic fixture and a fully specified active native Configuration/NativeEnrollment regression; a tampered digest and rollback-profile drift remain rejected by both selection and native binding.

This reviewer directly executed the corrected compiled test binary for owner_policy, policy and issuance filters: 22 cases PASS. `profile-digest-independent-checks.json` retains full command arguments, binary SHA256, outputs and before/after source/test file hashes. Those file bytes were independently compared to git show at the final repair commit and matched exactly; no source/test diff remained. These checks include both active v1/v2 regressions, their negative assertions, legacy canonical policy bytes/draft binding, source-map rejection, custody binding, lease equivocation/replay and exact draft resume/conflict.

Author evidence was independently inspected and digest-checked: issuer module 43 passed with two pre-existing manual probes ignored; bootstrap 13 passed; genesis 10 passed; fmt clean; all-target Clippy clean; corrected locked release build finished successfully (release log SHA256 a2ad29b89c349b050c1b37c40a600f22b4e3289b86f0927ae8717d7dc0f0e104). The earlier full-suite run remains bound to source 730d4a0 and is not relabeled as a full-suite run of e8f863f. The focused checks cover the sole production comparison changed here; unaffected mutation/recovery/queue paths were not expanded into this rereview.

The earlier review's other affected-surface conclusions remain applicable because their source is unchanged. FLI-01 superseded the original PASS on discovery and is now closed by this new exact-coordinate review. The genuine adopted-baseline design, protected target census, semantic Watchdog verifier and later provisioning/activation package remain separate unresolved first-live gates. This PASS is not first-live readiness or authority to install/enable anything.
