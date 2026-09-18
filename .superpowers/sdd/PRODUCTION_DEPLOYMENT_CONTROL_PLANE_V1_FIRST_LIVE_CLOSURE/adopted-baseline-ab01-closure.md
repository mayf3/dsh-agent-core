# Adopted baseline AB-01 closure and final validation

SOURCE_COMMIT = d0a6a1f8698344f07268f47db08b904a9982b660
SOURCE_TREE = 2fae018d4823b227dd4c8fd9e7db4968223c9f39
ACCEPTED_SPEC = 39865536ce51005f95a98473e77c2329078512c0
SCOPE = Reviewed first-target adopted baseline, fixed Watchdog observation, executed-predecessor acceptance and the single AB-01 repair
ENVIRONMENT = Nonroot local isolated worktree; no production endpoints or keys

The independent initial source review identified only AB-01. Authenticated exact-job `outcome_unknown` could be observed before an unrelated event-file read failed, without durably recording UNKNOWN. The repair extracts the existing reader path into a private helper and persists UNKNOWN plus queue quarantine before invoking the unchanged fixed event reader. Malformed/wrong-job input cannot poison the capture, and succeeded input still invokes the reader exactly once. An existing unknown record survives reopen and prevents replacement with a later succeeded response.

Test-first RED used the extracted old ordering: one passed and two failed at the expected callback/order assertions. After the ordering correction, all 50 verification tests passed. Independent reviewer reran the three new helper tests and complete verification namespace and reported PASS at the exact source above; AB-01 is closed and no new scoped source blocker was identified. The independent report is retained in the parent worktree as `adopted-baseline-source-rereview.md`, SHA256 `48ad083585ccddc23cf3f98067b3df7d8caa160023d9b3fd5fb559f449f1d66f`.

## Executed final checks

All commands use `packages/deployment-control-plane/Cargo.toml` and the exact source above.

- `cargo test --locked -- --test-threads=1`: exit 0; 339 top-level passed, 0 failed, 2 ignored. Nested crash-worker executions are not added to that count.
- `cargo test --locked --lib issuer::policy::tests -- --test-threads=1`: exit 0, 10 passed.
- `cargo fmt -- --check`: exit 0.
- `cargo clippy --locked --all-targets -- -D warnings`: exit 0.
- `cargo build --locked --release`: exit 0.
- Structure machine check retains the same three pre-existing directory-count failures (production-runtime source, production-runtime tests, scripts). No global structure PASS is claimed. Manual Rust inspection found no new or grown violation; maximum tracked Rust file is 480 lines.

The first default-parallel full run is also retained: it exited 101 with 161 library tests passed, 1 failed and 2 ignored. The unchanged `issuer::policy::tests::finite_v2_source_map_renews_current_owner_lease` returned `POLICY_BUSY`. Its isolated suite and the full serialized suite subsequently passed with no source or test change. Parallel crash-worker/file-descriptor interference is only a hypothesis, not an established diagnosis. No mutex weakening, ignored test, filtering of the full suite, or retry bypass was introduced. The passing full-suite claim is explicitly for the serialized invocation.

## Evidence hashes

| Retained file | SHA256 |
|---|---|
| `ab01-red.log` | `6a7b52c190121ff74e00a26b475ae80e337e1ad8b7096182f3685ddc05670578` |
| `ab01-observer-green.log` | `07d2c32e7294643788af43427541c991e286aec310fee97add7abff8f57fc280` |
| `ab01-policy-isolated.log` | `1c821086d9cc8163e47c3d43d042ac80e8e2edffbc6fdec976a7b9eeac579e18` |
| `ab01-full.log` | `d1e16d2bd89b372c1485710873c4aaba6aee26b86f493b6078975e16d9b4c08b` |
| `ab01-full-serial.log` | `e7b0a534ea2bd334691a29e821709da2869503598d0f3816a348bfb2f340c8f2` |
| `ab01-fmt.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `ab01-clippy.log` | `bb410aaddef7b4e712ca1b90ea61acea0e99ec4771b50592b6c21bb795a85ae9` |
| `ab01-release.log` | `cb083ac0af90ff57dd14546f93b2a99a83e36ebb3b834940c3840d4989738905` |
| `ab01-structure.json` | `0245a59191bbc6ade1172a0860e4e09360bb8c116663b6c9b92218607233bb59` |

Built `agent-deployd` SHA256: `763482af2905a10617e03cbea3a9229b46d9f8ade3b1201b5583efce765432aa`. This artifact was built locally only; it was not installed or activated.

SOURCE_IMPLEMENTATION_COMPLETE = YES
INDEPENDENT_AFFECTED_SOURCE_REVIEW = PASS
FULL_SUITE_SERIALIZED = PASS
DEFAULT_PARALLEL_RUN = RETAINED_FAILURE_POLICY_BUSY
PRODUCTION_MUTATION_PERFORMED = NO
PRIVILEGED_BOOTSTRAP_PERFORMED = NO
PARENT_GOAL_COMPLETE = NO

This report closes only the reviewed implementation preparation. The parent still owns the exact operation package, real reviewer-login reconciliation, actual protected target adoption, old-entry retirement, genuine current canary, activation and first real Broker deployment. Source checks do not establish installed state, bootstrap/activation readiness or business Goal acceptance.
