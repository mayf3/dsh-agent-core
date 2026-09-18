use super::*;
#[test]
fn canonical_lineage_requires_exact_merge_base_and_complete_tree() {
    let sha = "a".repeat(40);
    let compare = serde_json::json!({"status":"ahead","merge_base_commit":{"sha":sha},"base_commit":{"sha":sha}});
    validate_lineage(&sha, &compare).unwrap();
    let mut evil = compare.clone();
    evil["merge_base_commit"]["sha"] = serde_json::json!("b".repeat(40));
    assert!(validate_lineage(&sha, &evil).is_err());
    evil = compare;
    evil["status"] = serde_json::json!("diverged");
    assert!(validate_lineage(&sha, &evil).is_err());
    let tree = serde_json::json!({"sha":"c".repeat(40),"truncated":false,"tree":[{"path":"app.js","mode":"100644","type":"blob","sha":"d".repeat(40),"size":3}]});
    let paths = parse_tree(&"c".repeat(40), &tree).unwrap();
    assert_eq!(paths.len(), 1);
    let mut missing = tree.clone();
    missing["truncated"] = serde_json::json!(true);
    assert!(parse_tree(&"c".repeat(40), &missing).is_err());
    missing = tree;
    missing["tree"][0]["mode"] = serde_json::json!("120000");
    assert!(parse_tree(&"c".repeat(40), &missing).is_err());
}

#[test]
fn deterministic_artifact_uses_observed_bytes_and_complete_slots() {
    let slots = vec![SourceSlot {
        source: "packages/app.js".into(),
        target: "app.js".into(),
        executable: false,
    }];
    let bytes = std::collections::BTreeMap::from([("packages/app.js".into(), b"ok\n".to_vec())]);
    let built = build_regular_files(&slots, &bytes).unwrap();
    assert_eq!(
        built.manifest.entries[0].sha256,
        crate::fs::file::sha(b"ok\n")
    );
    assert_eq!(
        built.artifact_digest,
        crate::trust::digest(&built.manifest).unwrap()
    );
    assert!(build_regular_files(&slots, &Default::default()).is_err());
    let mut bad = slots.clone();
    bad[0].target = "../root".into();
    assert!(build_regular_files(&bad, &bytes).is_err());
    let dup = vec![slots[0].clone(), slots[0].clone()];
    assert!(build_regular_files(&dup, &bytes).is_err());
}

#[test]
fn build_closure_binds_actual_enrollment_and_issuer_without_opaque_substitution() {
    let declared = vec!["a".repeat(64)];
    let closure = bound_dependencies(&declared, &"b".repeat(64), &"c".repeat(64)).unwrap();
    assert!(closure.contains(&"b".repeat(64)));
    assert!(closure.contains(&"c".repeat(64)));
    assert_eq!(closure.len(), 3);
    assert!(bound_dependencies(&declared, "not-enrolled", &"c".repeat(64)).is_err());
    assert!(bound_dependencies(&[], &"b".repeat(64), &"c".repeat(64)).is_err());
}
