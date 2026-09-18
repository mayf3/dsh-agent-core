# Independent bounded source review: fixed first-live process runner

REVIEW_RESULT=BLOCKED
FROZEN_COMPONENT_BLOCKER_UNION=PR-01
REVIEW_TARGET_COMMIT=675f09e
REVIEW_TARGET_TREE=c0e1ed05cc2dc07f61abba5857e539a8148f33f8
SCOPE=src/first_live/process.rs_and_test/first_live/process.rs_only
WHOLE_OPERATOR_SOURCE_PASS=NOT_EVALUATED
AUTHORITY_ACTION=REUSE
PRODUCTION_OR_PRIVILEGED_ACTIONS_PERFORMED=NO

This independent reviewer did not author the component. The review covers only the fixed-tool runner's deadline, output, process-group/owned-child handling, identity matrix and associated fixture tests. The remaining first-live tree is under active implementation and is not frozen or approved by this report. Compared both component files against the commit before/after the independent tests; they remained unchanged. Existing unrelated runners are outside scope.

## Frozen finding PR-01: enforce the declared combined output budget

The frozen canary operation design requires child output at most1MiB. `process.rs:152–165` instead checks each destination Vec independently against1MiB, and `capture` owns separate stdout and stderr Vecs. A tool emitting, for example,600KiB on each stream therefore fits each individual check but exceeds the declared combined budget. The code is bounded to2MiB, so this is a concrete operation resource-binding mismatch rather than an unbounded allocation claim.

The parent confirmed the intended exact contract is the narrower combined1MiB, not1MiB per stream. Minimal closure is one aggregate byte budget shared by the two drains, retaining fairness, nonblocking reads and deadline checks. Add a dual-stream regression exceeding1MiB in total while each individual stream remains below1MiB, plus a within-budget positive. No general runner redesign is needed. The counterexample follows directly from the two independent checks; its executed RED/GREEN fixture must accompany the repair.

This is the complete identified blocker union for the frozen component review. No additional concrete blocker was found in the remaining scoped logic under its fixed-tool and owned-child assumptions.

## Other scoped checks

- The internal production entry requires effective root before touching fixed paths, hash-verifies a closed Tool enum and accepts only the declared numeric identity pairs. Root execution is limited to Launchctl; Node requires505:601; Sudo/Retired/Sh and unprivileged Launchctl require502:20. Groups are bounded and group0 rejects. Actual package-frozen supplementary-group equality and argument templates must still be verified by the final callers; the helper's internal slice arguments are not a public operation API.
- Each command clears environment, uses fixed PATH/locale, null stdin and captured stdout/stderr. Node receives only the fixed service HOME/store reference and cwd. Identity-drop setup uses setgroups, setgid and setuid and checks resulting real/effective IDs. No root shell/Node is allowed by this matrix. The component's non-root tests validate refusal/matrix logic; they do not pretend to execute a real root identity drop or prove the final loader closure.
- Nonblocking drains have finite per-pass work, so continuous output cannot starve the other stream/status/deadline. The deadline is positive and at most60seconds, with a separate250ms cleanup bound. A direct child timeout, stream error/overflow, invalid UTF-8, signal termination or residual group yields an error rather than a successful Output.
- A new process group is created for the owned child. On errors before that Child is reaped, cleanup signals only that owned group/direct child. Once the leader is reaped, cleanup does not send a destructive group signal that could target a reused number. An absent group is required before a normal exit with both EOF streams is accepted. The negative kill0 existence check after reaping can conservatively fail; it cannot turn a residual into success. The component assumes its owned Child is not externally reaped by unrelated wait/SIGCHLD handlers, as in the inspected fixed runner context.
- A descendant retaining inherited pipes cannot keep this collector blocked beyond its deadline; closing pipes does not make a surviving group acceptable. Cleanup is never semantic completion. An error retains the outer consumed intent/unknown state; it is not permission to rerun a creator, cleanup, service or probe action. Integration must stop later effects and retain the required ownership/reconciliation fence when closure is uncertain.
- The explicit limit is material: this is not a sandbox for arbitrary hostile commands. The reviewed fixed tool/import closure must not daemonize or deliberately escape its process group, and inherited protected write-capable descriptors must remain closed/CLOEXEC. A process group cannot prove absence of an intentionally detached grandchild. Final caller/closure/source review must enforce these preconditions; this component PASS would not establish them for the still-changing operator.

## Independent execution and evidence

Ran ordinary `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::process:: -- --nocapture` against the current compile seam with the exact component files: nine passed, zero failed, exit0. Fixtures execute only non-root `/bin/sh` and bounded `/bin/sleep` with private paths; their cleanup is limited to their own test processes. Cases cover inherited pipe, closed-pipe residual, signal exit, finite nonzero exit with both streams, deadline, identity negatives, output/UTF-8 rejection, real timeout inside consumed durable journal and non-root rejection before fixed production tool access.

The surrounding incomplete implementation emits unused/dead-code warnings. This is not a whole-crate strict-Clippy, release or full-suite PASS. The exact component test run is the claimed evidence.

Independently recomputed retained author logs: original process RED SHA256 `e4bf258d0e82d08a60fbbcccfb9728b8fea9d6cd0df6486eadee397e0ae79790` records the actual inherited-pipe delay, closed-pipe residual acceptance and signal-exit acceptance failures; identity RED SHA256 `45cce0cac0795192598a589eafec93091a49c2f3ef3773b25417b2f3790e966b`; nine-test final log SHA256 `29759999bf64fd436fcc3bc319e923f12f31173aaae8655a7ff578fc9e4676f5`. Those fixes are supported by the independent run, but the new combined-output finding remains open until its focused repair.

No production tool, native/root helper, real service, endpoint, key/auth content or deployment operation was invoked. This report neither approves the eventual first-live package nor reopens prior unrelated source findings. The separate retained-writable-FD/shared-mapping isolation question is an affected lifecycle design obligation, not a defect invented in this process runner.
