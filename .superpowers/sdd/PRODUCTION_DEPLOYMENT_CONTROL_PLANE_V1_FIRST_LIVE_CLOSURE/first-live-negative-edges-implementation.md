# Exact existing optional negative-edge implementation

Accepted Spec39865536ce51005f95a98473e77c2329078512c0 remains governing. Independent design PASS is parent commit09ae10b5298f0331e48ad058a9719a9e490ea03e, `first-live-negative-edges-design.md` SHA256 ce54fef27cc4ad276882cb241e9af05c4f6c8c3cea488600e26e7254ccd4fd87. Same parent Goal; no production effect or new authority.

Operator component source: commit `d558526aef5f3f33b865b10ecbe81c1e6494b987` changes only `src/first_live/native_effects/link_graph.rs`, private `negative_edges.rs`, and `test/first_live/link_graph.rs`. Parent/native author own all driver, census, retirement and other integration files. The Python converter mirror and this report/index are a separate binding-worktree commit.

The ordinary graph previously failed on four preserved optional Darwin-x64 package links. The code now recognizes only the exact four compiled source paths, raw link strings, missing scope prefix and remaining single package leaf from the reviewed design. It also requires both exact parent package.json file hashes. If any known source is present, the whole set must be present. Every source/manifest/target ancestor must be an actual Directory entry, never a symlink. The expected missing prefix and every descendant must remain absent. Resolver acceptance additionally requires exactly the original source link hop and exact remaining component. All other missing edges still fail.

No target is created or installed. Manifest hashes are checked against the packet Tree and later authenticated by the native descriptor-relative full census; the pure graph function does not make a filesystem observation. Existing full census before effects and protected full census before admission remain required. The ordinary input does not prove current absence or ownership by itself.

`closed_links(&[Tree;3])->Result<()>` remains unchanged. The narrow `recorded_negative_edges(&[Tree;3])->Result<Vec<serde_json::Value>>` first validates the entire graph and then emits only fixed expected source/raw/missing-prefix/remaining-leaf/manifest/hash/expected_absent records. These records are declarations until joined with the caller's authenticated full census. The native author owns the initial/final census receipt integration; this component does not manufacture that proof.

Validation:

- Genuine actual-input RED: retained app/harness/Node Trees passed structural validation, then failed FIRST_LIVE_LINK_DANGLING before the fix. The same three actual Trees pass after the bounded recognition.
- 6 focused fixture tests PASS, including exact-set positive and many mutations of each source/literal/cardinality, newly present missing prefix/leaf, parent manifest bytes/type/absence, missing or symlink ancestor, arbitrary fifth edge, wrong tree, escape and cycle. Record export had its own genuine RED (zero instead of four), then verifies any unrelated invalid graph prevents record publication.
- Complete relevant inventory group:15 PASS/1 ignored. The one external-input test was run separately with explicit DCP_STATIC_INPUT_DIR:1 PASS,0 ignored. It is intentionally ignored by ordinary portable suites because its real census is external and large.
- Python mirror:16 PASS; exact-known graph had a genuine RED before mirror implementation. No observed Tree, link, file, inode, mode or key bytes were changed by the mirror.
- Owned three Rust files pass rustfmt --check and staged whitespace checks. Strict clippy passed before adding the small record accessor; the final rerun fails only the concurrently changed, root-owned process.rs test:151 single_element_loop, with no graph diagnostics. No final whole-clippy PASS is claimed at this handoff; parent was notified.

Final external static input draft: `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/static-inputs-v4`, index SHA256 d7849dd1312ff93a272dc9d316fad08387e4b1e5425a307fd79cf3fdfd5e3f4e. It has0 unrecognized links and4 explicit preserved negative records. All five typed Tree/configuration/native-enrollment inputs remain byte-identical to v2. The index conservatively remains BLOCKED for the separately owned two absent-retirement-path assumption until that contract is completed. The old v1/v2/v3 drafts and original reports remain retained.

No production/root calls, installed-package changes, real keys, signatures, restart, activation, fake PASS, or generic dangling-link option were introduced. Source independent security rereview and final whole-source/full-suite/release validation remain parent integration gates.

Exact retained evidence:

- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-actual-red.log` SHA256 `a8887d7ae8cb3c20fce7eb9c479d04db8de0de06c470d3d4daff7d8a2ce1dd0f`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-actual-final.log` SHA256 `2cecd6a8e0fd3d5dfa8e6f2515b59fdea524a28bb8cd9fdb15b90556581ea925`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-records-red.log` SHA256 `19f2ab15e28cd36de813acf3878aa3cbc718b748cec6cb8b36bae91565c1b136`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-inventory-final.log` SHA256 `3eb2992e7cd01c8680651d830cc0920bae5cb05bcbb3e041e389aebf7095ceb1`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-clippy.log` SHA256 `5c931b37890c8f38713d5b5cdc7a1a07c473f8215654bb53e2c5425bf884603a`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-clippy-final.log` SHA256 `42e581b4782c41c9e0dedd5f15391a74df72e5d356155620c6551b03ff432cb5`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-python-red.log` SHA256 `b2dbca358c8dbb0109a70348e6479d6f61dd0e362f2a81708e47a8e40c084f08`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-python-green.log` SHA256 `ad39657e9a93015fea4ac1851d18700cb486bc60497c740c21a23113b02c3119`.
- `/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1/first-live-preparation/negative-edge-evidence/dcp-negative-static-v4.log` SHA256 `32b6f7b8ca2ee59cd6ac14c8891909b1030e426640b99112342397c8e6b85b83`.
