# Independent focused component rereview: PR-01

REVIEW_RESULT=PASS_FOR_BOUNDED_PROCESS_COMPONENT
PR_01=CLOSED
FROZEN_COMPONENT_BLOCKER_UNION=PR-01_CLOSED
NEW_COMPONENT_BLOCKERS=NONE_IDENTIFIED
REVIEW_TARGET_COMMIT=e67ccf7f5c2dc495f3488165a86a23283e5a6ce1
REVIEW_TARGET_TREE=17a3bb6f8b9d5d9c77ef28f58d3a41ab8bf4d7ed
PRIOR_COMPONENT_COMMIT=675f09e8bceff4d3fb85389de0d9b2ec6b649b9d
WHOLE_OPERATOR_SOURCE_PASS=NOT_EVALUATED
PRODUCTION_OPERATION_ALLOWED=NO
PRODUCTION_OR_PRIVILEGED_ACTIONS_PERFORMED=NO

The reviewer did not author the correction. Scope remains exactly `src/first_live/process.rs` and `test/first_live/process.rs`; the original component review is retained unchanged. This is a component-source verdict, not a whole-tree compile/Clippy/release/package verdict for the still-developing native operator.

The minimal correction gives each stream only the remaining aggregate budget after accounting for bytes already captured on the other stream. Both drains preserve their existing per-pass bound, nonblocking behavior and deadline fairness. Because each append checks its current Vec length plus incoming bytes against that remaining limit, stdout+stderr cannot exceed1MiB. The remaining-budget subtraction is safe under the preserved invariant that neither Vec can already exceed the aggregate bound. No tool pin, identity, command/environment, group/cleanup, status or unknown-journal behavior changed.

The new test emits524289bytes to stdout and524289bytes to stderr, individually below1MiB but jointly exceeding it. The retained author RED at SHA256 `6d540145bd0a570a7718c707dc2ecee0aaf5ece07194cc5206264e3a54105e14` records that the old implementation failed to return the expected limit error. The author GREEN at SHA256 `93abb09bcd3c2791f1969ff4a41d32c5b8e14e70d66f9fb37b05e5db254c71aa` reports ten passing tests. Both hashes were independently recomputed and the RED failure inspected.

## Independent executed validation

The shared development worktree temporarily failed to link due to `_closefrom` in unrelated newly added denial-probe code. The reviewer did not alter that code or classify a transient in-progress link error as a process-component finding. To avoid concurrent author edits, created an ordinary private Git archive at exact e67ccf7, wired only this component plus the existing journal/files fixture seam into its test module, and ran:

`cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::process:: -- --nocapture`

Result: exit0, **10 passed, zero failed**. This includes the new dual-stream limit case and all prior timeout/residual/signal/identity/UTF-8/durable-unknown/no-replay tests. The existing finite nonzero-exit test still accepts within-budget stdout+stderr and preserves both diagnostics. Only non-root fixed `/bin/sh` and bounded `/bin/sleep` fixtures/private paths were executed. No fixed production tool entry was run; its non-root refusal test rejects before tool access.

Exact tested component hashes, matched byte-for-byte to e67ccf7:

- process source: `c4ee247116d49613ffe03aae4c0d6fe67d81fac2858979f6c6c0da26abf9bf07`.
- process tests: `3a24703095fd624c9f5066d387c7839ef34f50f933218e7354251fc71a4703b7`.

The scratch-only module declaration enabled the otherwise not-yet-committed first_live wiring. The copied fixture seam hashes were journal.rs `ed460b92a2a0fdf1ce76d7c50f2fa6a186a9512a062398853888ccf4b2209c68` and files.rs `e0752c39c465f89059cdc0b6f584a1aec02e4160135c4d7e909a55888e991cca`. These supporting files and wiring are disclosed test context, not newly reviewed operator source. An initial bare archive run selected zero tests and was not counted as verification. The executed ten-test log is retained as `first-live-preparation/process-pr01-independent-review.log` in the ordinary artifact directory, SHA256 `0c15738775ab0471a2e39157d340ceb5bf18c45f10d746daa8acca32d330198f`.

PR-01 is closed; no new concrete blocker was found in the directly affected correction. All fixed-tool, exact-call-site/group/descriptor, no-daemonization/group-escape and durable unknown/reconciliation limitations in the original component review remain. In particular, group cleanup is never semantic completion and this component cannot turn a retained unknown into permission to replay a canary or service action. Final integration must still prove those boundaries in the complete frozen source and package. This verdict grants no production/root operation and does not complete first-live delivery or the parent Goal.
