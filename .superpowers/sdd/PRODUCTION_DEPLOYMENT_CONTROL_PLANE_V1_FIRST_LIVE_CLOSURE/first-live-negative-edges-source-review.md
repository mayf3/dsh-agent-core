# Independent fixed negative-edge and retired probe source review

**PASS for graph d558526aef5f3f33b865b10ecbe81c1e6494b987 and the direct probe narrowing830c4e311832eb4d0c1a3064b8a2f95d75168e06. No bounded component blocker found.** The directly dependent nonroot Python graph mirror at9a4a70a was also inspected and tested. This is not whole-operator, current protected graph, retirement execution or first-live PASS. No author source was edited and no production/root/service call occurred.

Governing design: first-live-negative-edges-design.md SHAce54fef27cc4ad276882cb241e9af05c4f6c8c3cea488600e26e7254ccd4fd87, independently REUSE PASS. Unrelated reviewed findings remain closed.

## Exact source bindings

All operator tested files below were checked equal to `git show` of their respective frozen commit:

| Commit | File under packages/deployment-control-plane | SHA256 |
|---|---|---|
| d558526a | src/first_live/native_effects/link_graph.rs |7fe04c83f5c56ed7185d4adc7b37df52a749717724aa418b42979f5f4ba3799b|
| same | src/first_live/native_effects/negative_edges.rs |fa504868e9ec0aecce5d8b861405eddd7ff13dadcfeea094a37b173265452e14|
| same | test/first_live/link_graph.rs |8561363a04091481b956533575912f33d53e45992ed6732291798b3817039318|
|830c4e3|src/first_live/process.rs|690bbca1e29f126280a9f77e61fa91dd8bbadfc8851452ebd7bf86619180cbab|
|same|test/first_live/process.rs|1d76c376389b49f6464d37b62fe110a441f2f657e51f16000a3b7c388c911b64|

Binding-worktree current files were also equal to9a4a70a81fa2671fe967310e1a7cf37906cab8a6:

- deployment-artifacts/control-plane-first-live-v1/prepare_inputs.py:6bfa4732784761cd51309615691aeaac04236f71219dd01d750910e3e3a6261b.
- deployment-artifacts/control-plane-first-live-v1/test_prepare_inputs.py:2c01aee120c175bf6e10c8c1499a5531262ccfab307724e63745d02c302cbada.

## Security/logic disposition

negative_edges.rs15–56 constructs only the four reviewed source/raw-link/missing-prefix/leaf/manifest/hash tuples. Validation at74–105 is all-or-none when any such source exists, requires the exact source literal/type and both pinned regular manifest hashes, verifies every source/manifest/target existing ancestor as Directory, and rejects a newly present missing prefix or any descendant even in an incoherent supplied map. It does not follow filesystem links or create absent targets.

The resolver in link_graph.rs30–86 retains fixed app/harness/node-runtime containment, component validation, directory-before-traversal and40-hop cycle bounds. The missing-entry exception requires the original source to be one of the fixed harness paths, the resolved first-missing component to match exactly, exactly one fixed remaining leaf and exactly one source-link hop (negative_edges.rs114–125). A fifth alias to one of the allowed links does not inherit its exception; source identity and hop count differ. Arbitrary missing siblings, changed literal paths, escapes and cycles remain rejected. `recorded_negative_edges` validates the whole graph before returning expected declarations; a separate invalid graph prevents its export.

A graph with none of the four known source paths uses ordinary strict link validation, preserving existing generic fixture compatibility. This is not permission to omit these four from the actual frozen operation packet: the reviewed actual Tree input includes all four, its exact package digest and the mandatory complete physical census enforce that concrete set. Physical omission, added entries or changed manifest bytes cannot be excused by the pure graph result. Receipt integration must retain this distinction.

The Python mirror applies the same finite tuple/manifest/ancestor/absence checks, joins only exact LINK_DANGLING diagnostic records with the original single source-hop chain, and requires all four accepted issues. It retains unresolved issues and does not synthesize target content. The current static preparer keeps inputs explicitly untrusted/non-admissible and emits no signed/observed lifecycle PASS. Its original source8669984 plus followup9a4a70a were inspected in the directly dependent Tree/template preparation context; this report does not substitute for native typed validation or the later custody-epoch preparation change.

The830c4e3 change only narrows RetiredNode's exact argv from two entries to `/usr/local/libexec/agent-core/app/scripts/production-runtime-launchd.mjs`. The absent routing installer is now explicitly negative-tested alongside `-e`, arbitrary paths and extra arguments. UID502:GID20-only execution and root/UID505 rejection remain unchanged. The final driver still must verify the installed entry already contains the exact protected constant-refusal bytes before executing it, and must separately prove the two absent paths rather than install phantom stubs.

## Independent validation

From `/Users/yanfenma/workspace/worktrees/dcp-first-live-operator`:

1. `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::inventory::link_graph:: -- --nocapture`:6 PASS,0 failed;1 deliberately external-data-dependent test ignored in this fixture invocation.
2. With `DCP_STATIC_INPUT_DIR` set only to retained `first-live-preparation/static-inputs-v4`, ran the exact `first_live::inventory::link_graph::tests::actual_observed_harness_graph -- --ignored --exact --nocapture`:1 PASS,0 failed/ignored. This validates the complete retained app/harness/Node Trees, including1131 app regular entries and5618 harness links, through actual Rust structural and graph functions.
3. `cargo test --manifest-path packages/deployment-control-plane/Cargo.toml --locked --lib first_live::process:: -- --nocapture`:14 PASS,0 failed/ignored.
4. From the binding-worktree preparer directory, `python3 -m unittest -v test_prepare_inputs`:16 PASS. Additional independent mirror counterexamples reject a fifth alias to an allowed missing link and an orphan descendant appearing beneath an absent scope.

The initial reviewer commands used the filesystem namespace `native_effects::link_graph` rather than its actual Rust module `inventory::link_graph` and ran0 tests. Those logs remain retained and are **not** counted as verification; module listing identified the correct namespace and the actual nonzero runs above followed.

Static v4 index SHA is d7849dd1312ff93a272dc9d316fad08387e4b1e5425a307fd79cf3fdfd5e3f4e. The reviewer checked all three Tree files plus configuration/native-enrollment templates against their index hashes and against v2; all five are byte-identical. Only the negative-edge disposition/projection changes. The index remains honestly BLOCKED for separately owned retirement integration; it is not an admission artifact.

Logs under `first-live-preparation/negative-edge-evidence/`:

| File | SHA256 |
|---|---|
|independent-graph-fixtures-corrected.log|a92d1808d3689e11f4a10547ab64bb49cce279314badad667cef69ff2da48c51|
|independent-graph-actual-corrected.log|31280d7cfaab6ab7f1514e50545fe98895ad1e98f3111a167f3475c491871022|
|independent-single-retired-node.log|e4c539114377dca4668ba56c7a95adc07fd90342f1631df57a08e5e6c52385e5|
|independent-static-preparer.log|b484df6ee8a0772e19b4d568f9c41a12385c8d355b545c071be6ea3623a8420b|
|independent-mirror-extra-cases.json|a64c53b9be1c3df368ec541131b84351d8752176bd6e56f268bfbd57b80f087c|

## Remaining integration limits

The surrounding operator still has uncommitted module/driver work. This review gives no full-tree suite/fmt/Clippy/release verdict. Final source review must join pure expected-negative records with complete descriptor-relative pre-effect and post-isolation current censuses, protected ancestry/ACL/ownership proof, actual absence at exactly the declared first component, and immutable lifecycle evidence. It must also complete three-present/two-absent retirement, current-generation handover, authentic Tailscale protected closure and the separately reviewed custody sequencing. These requirements are retained gates, not failures of the fixed graph component.
