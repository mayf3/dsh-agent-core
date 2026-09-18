# Native profile digest repair evidence

BASE_HEAD=fd4b5f19bf1b5023e91dd4b674dbac1d6cb36cc6
FINDING=FLI-01
AUTHORITY_ACTION=REUSE
PRODUCTION_MUTATION_PERFORMED=NO
INSTALLED_PACKAGE_CHANGED=NO
INDEPENDENT_REVIEW=REQUIRED_SEPARATELY

The active native profile used by normal issuance has `enabled=true`. Bootstrap enrollment deliberately hashes the same profile with `enabled=false`; native binding and production Executor use this shared normalization. The Owner source selector incorrectly hashed the active profile directly and rejected valid v1/v2 issuance. Replace only that comparison with `bootstrap::profile_digest(profile)`. No source-policy encoding, signature domain, issuer draft/cache digest formula, queue behavior or installed package changes.

Both new tests construct an actual active Configuration and NativeEnrollment, require `validate_native_binding` to succeed, and then select the source. Before the production line changed, both failed at `ISSUER_PROFILE_BINDING` (RED exit 101). Each now succeeds and still denies a tampered enrollment profile digest and rollback-profile drift. The existing fixture also uses shared normalization so it cannot hide this convention again. Existing canonical v1, v2 exact-map, cache and draft tests run in the complete issuer module check.

Commands were run from this isolated worktree using manifest `packages/deployment-control-plane/Cargo.toml`. All GREEN commands exited 0:

| Evidence | Command suffix | Result | SHA-256 |
| --- | --- | --- | --- |
| profile-digest-red.log | `cargo test … active_native_binding_selects --lib --locked` | 2 expected failures before repair | d457af45a0a7df5fe3f7fa29eb98c86fcd41be52db4136dbcbf0436b82ff584d |
| profile-digest-issuer-green.log | `cargo test … issuer:: --locked` | 43 passed; 2 existing manual probes ignored | 5de4bcdfda0b9f6e9059164901660509ed4c75483f063378ff4a78a1dd3702b9 |
| profile-digest-bootstrap.log | `cargo test … --test bootstrap --locked` | 13 passed | 38ea55e1d2cea6c2f76d08e0302fa291a74da975d8dd0a272d5a7dcb9408b650 |
| profile-digest-genesis.log | `cargo test … --test genesis --locked` | 10 passed | 63b28491e88a83b41c67957df948fa8615cf56004f1ce16b27a2b5efb54db59b |
| profile-digest-fmt.log | `cargo fmt … -- --check` | clean | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| profile-digest-clippy.log | `cargo clippy … --all-targets -- -D warnings` | clean | 70edd477327ec5132a68780d8aca400c12180e8f62a1bee73f56d5364c193dd7 |
| profile-digest-release.log | `cargo build … --release --locked` | built corrected source | a2ad29b89c349b050c1b37c40a600f22b4e3289b86f0927ae8717d7dc0f0e104 |

`git diff --check` for source/tests passes; raw Cargo logs retain their emitted final blank line (the only staged whitespace warnings). The test file remains 371 lines, below the active 500-line limit. Prior complete-suite evidence at source `730d4a0539cc758eb8c0440e9ceddbefde4c017d` is retained as the earlier baseline, not relabeled as a current complete-suite run. This one-line issuer comparison and isolated regression fixture do not affect mutation/recovery/queue state; no repeated full durability stress was justified. The fresh locked release was built only, never copied into the installed genesis package.

The separate adopted-baseline design is not part of this repair; its implementation remains forbidden pending independent design review. This correction alone grants neither target adoption nor activation readiness.
