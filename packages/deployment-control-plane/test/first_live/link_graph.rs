use super::*;
const A: &str = "node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.220_@anthropic-ai+sdk@0.93.0_zod@4.4.3__@modelcontex_57ba44dcbc2a36491e18d36fec520472/node_modules/@anthropic-ai";
const B: &str = "node_modules/.pnpm/@openai+codex@0.147.0/node_modules/@openai";
const AT: &str = "node_modules/.pnpm/@anthropic-ai+claude-agent-sdk-darwin-x64@0.3.220/node_modules/@anthropic-ai";
const BT: &str = "node_modules/.pnpm/@openai+codex@0.147.0-darwin-x64/node_modules/@openai";
fn observed(kind: Kind) -> Entry {
    Entry {
        kind: kind.clone(),
        uid: 505,
        gid: 601,
        mode: 0o755,
        flags: 0,
        device: 1,
        inode: 2,
        links: 1,
        sha256: if kind == Kind::File {
            Some("a".repeat(64))
        } else {
            None
        },
        link: None,
        post_gid: 601,
        post_mode: if kind == Kind::Link { 0o555 } else { 0o755 },
    }
}
fn add(tree: &mut Tree, path: &str, e: Entry) {
    let parts = path.split('/').collect::<Vec<_>>();
    for i in 1..parts.len() {
        tree.entries
            .entry(parts[..i].join("/"))
            .or_insert_with(|| observed(Kind::Directory));
    }
    tree.entries.insert(path.into(), e);
}
fn sources() -> Vec<(String, String)> {
    vec![(format!("{A}/claude-agent-sdk-darwin-x64"),"../../../@anthropic-ai+claude-agent-sdk-darwin-x64@0.3.220/node_modules/@anthropic-ai/claude-agent-sdk-darwin-x64".into()),
        (format!("{B}/codex-darwin-x64"),"../../../@openai+codex@0.147.0-darwin-x64/node_modules/@openai/codex".into()),
        ("node_modules/.pnpm/node_modules/@anthropic-ai/claude-agent-sdk-darwin-x64".into(),"../../@anthropic-ai+claude-agent-sdk-darwin-x64@0.3.220/node_modules/@anthropic-ai/claude-agent-sdk-darwin-x64".into()),
        ("node_modules/.pnpm/node_modules/@openai/codex-darwin-x64".into(),"../../@openai+codex@0.147.0-darwin-x64/node_modules/@openai/codex".into())]
}
fn fixture() -> [Tree; 3] {
    let mut trees = std::array::from_fn(|_| Tree {
        root: observed(Kind::Directory),
        entries: BTreeMap::new(),
    });
    let h = &mut trees[1];
    for (p, target) in sources() {
        let mut e = observed(Kind::Link);
        e.link = Some(target);
        add(h, &p, e);
    }
    for target in [AT, BT] {
        let parent = target.rsplit_once('/').unwrap().0;
        add(h, parent, observed(Kind::Directory));
    }
    for (path, hash) in [
        (
            format!("{A}/claude-agent-sdk/package.json"),
            "1c9d0905f64e126850efe4fc4e7244c604a0855de8d4c82aff78da6f1988bd08",
        ),
        (
            format!("{B}/codex/package.json"),
            "bbaf3b9597b54bc1d4cf4aea93870e9035629d79bdaba58234011c31f0cfcf3d",
        ),
    ] {
        let mut e = observed(Kind::File);
        e.sha256 = Some(hash.into());
        add(h, &path, e);
    }
    trees
}
#[test]
fn four_exact_absent_optional_edges_preserve_existing_graph() {
    closed_links(&fixture()).unwrap();
}
#[test]
fn exact_negative_records_are_derived_only_after_full_graph_validation() {
    let records = recorded_negative_edges(&fixture()).unwrap();
    assert_eq!(records.len(), 4);
    for record in records {
        assert_eq!(record["expected_absent"], true);
        assert!(record["source"]
            .as_str()
            .unwrap()
            .starts_with("/usr/local/libexec/agent-core/harness/"));
        assert!(record["missing_prefix"]
            .as_str()
            .unwrap()
            .starts_with("/usr/local/libexec/agent-core/harness/"));
        assert_eq!(record["manifest_sha256"].as_str().unwrap().len(), 64);
    }
    let mut trees = fixture();
    let mut link = observed(Kind::Link);
    link.link = Some("missing".into());
    trees[0].entries.insert("other".into(), link);
    assert!(recorded_negative_edges(&trees).is_err());
}
#[test]
fn optional_edge_literal_source_and_cardinality_drift_fail() {
    for (path, _) in sources() {
        let mut t = fixture();
        t[1].entries
            .get_mut(&path)
            .unwrap()
            .link
            .as_mut()
            .unwrap()
            .push_str("/child");
        assert!(closed_links(&t).is_err());
        let mut t = fixture();
        let e = t[1].entries.remove(&path).unwrap();
        t[1].entries.insert(format!("{path}-other"), e);
        assert!(closed_links(&t).is_err());
        let mut t = fixture();
        t[1].entries.remove(&path);
        assert!(closed_links(&t).is_err());
    }
}
#[test]
fn absent_scope_or_endpoint_becoming_present_always_fails() {
    for (scope, leaf) in [(AT, "claude-agent-sdk-darwin-x64"), (BT, "codex")] {
        for path in [scope.to_owned(), format!("{scope}/{leaf}")] {
            let mut t = fixture();
            t[1].entries.insert(path, observed(Kind::Directory));
            assert!(closed_links(&t).is_err());
        }
    }
}
#[test]
fn manifest_bytes_kind_and_existing_ancestor_drift_fail() {
    for path in [
        format!("{A}/claude-agent-sdk/package.json"),
        format!("{B}/codex/package.json"),
    ] {
        let mut t = fixture();
        t[1].entries.get_mut(&path).unwrap().sha256 = Some("0".repeat(64));
        assert!(closed_links(&t).is_err());
        let mut t = fixture();
        t[1].entries.insert(path.clone(), observed(Kind::Directory));
        assert!(closed_links(&t).is_err());
        let mut t = fixture();
        t[1].entries.remove(&path);
        assert!(closed_links(&t).is_err());
    }
    for p in [
        A,
        B,
        AT.rsplit_once('/').unwrap().0,
        BT.rsplit_once('/').unwrap().0,
    ] {
        let mut t = fixture();
        t[1].entries.remove(p);
        assert!(closed_links(&t).is_err());
        let mut t = fixture();
        let mut e = observed(Kind::Link);
        e.link = Some(".".into());
        t[1].entries.insert(p.into(), e);
        assert!(closed_links(&t).is_err());
    }
}
#[test]
fn arbitrary_fifth_edge_wrong_tree_escape_and_loop_fail() {
    for target in ["absent", "../../../../etc/passwd", "fifth"] {
        let mut t = fixture();
        let mut e = observed(Kind::Link);
        e.link = Some(target.into());
        t[1].entries.insert("fifth".into(), e);
        assert!(closed_links(&t).is_err());
    }
    let mut t = fixture();
    t.swap(0, 1);
    assert!(closed_links(&t).is_err());
}
#[test]
#[ignore = "requires exact external ordinary input directory; pure graph only"]
fn actual_observed_harness_graph() {
    let root = std::path::PathBuf::from(
        std::env::var("DCP_STATIC_INPUT_DIR").expect("explicit external input directory"),
    );
    let trees: [Tree; 3] = std::array::from_fn(|i| {
        serde_json::from_slice(
            &std::fs::read(root.join(format!("{}-inventory.json", NAMES[i]))).unwrap(),
        )
        .unwrap()
    });
    for tree in &trees {
        validate(&tree.entries).unwrap();
    }
    assert_eq!(
        trees[0]
            .entries
            .values()
            .filter(|e| e.kind == Kind::File)
            .count(),
        1131
    );
    assert_eq!(
        trees[1]
            .entries
            .values()
            .filter(|e| e.kind == Kind::Link)
            .count(),
        5618
    );
    closed_links(&trees).unwrap();
}
