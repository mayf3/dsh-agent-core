use super::inventory::*;
use std::collections::BTreeMap;
fn entry() -> Entry {
    Entry {
        kind: Kind::File,
        uid: 505,
        gid: 601,
        mode: 0o644,
        flags: 0,
        device: 1,
        inode: 2,
        links: 1,
        sha256: Some("a".repeat(64)),
        link: None,
        post_gid: 0,
        post_mode: 0o444,
    }
}
#[test]
fn inventory_never_admits_escape_extra_payload_or_writable_postimage() {
    for path in ["../escape", "/absolute", "a//b"] {
        assert!(validate(&BTreeMap::from([(path.into(), entry())])).is_err());
    }
    let mut e = entry();
    e.post_mode = 0o666;
    assert!(validate(&BTreeMap::from([("a".into(), e)])).is_err());
    let mut e = entry();
    e.kind = Kind::Link;
    e.link = Some("../../../../evil".into());
    assert!(validate(&BTreeMap::from([("a".into(), e)])).is_err());
}
use crate::fs::FixtureRoots;
use std::os::unix::fs::MetadataExt;
fn observed(path: &std::path::Path, kind: Kind) -> Entry {
    let m = std::fs::symlink_metadata(path).unwrap();
    Entry {
        kind: kind.clone(),
        uid: m.uid(),
        gid: m.gid(),
        mode: m.mode() & 0o777,
        flags: 0,
        device: m.dev(),
        inode: m.ino(),
        links: m.nlink(),
        sha256: if kind == Kind::File {
            Some(crate::fs::file::sha(&std::fs::read(path).unwrap()))
        } else {
            None
        },
        link: None,
        post_gid: 0,
        post_mode: if kind == Kind::Directory {
            0o555
        } else {
            0o444
        },
    }
}
#[test]
fn closed_harness_pair_requires_all_aliases_and_preserves_ordinary_single_link_gate() {
    let temp = crate::common::private::temp();
    let roots = FixtureRoots::open(temp.path()).unwrap();
    std::fs::write(temp.path().join("a"), b"esbuild").unwrap();
    std::fs::hard_link(temp.path().join("a"), temp.path().join("b")).unwrap();
    let e = observed(&temp.path().join("a"), Kind::File);
    let tree = Tree {
        root: observed(temp.path(), Kind::Directory),
        entries: BTreeMap::from([("a".into(), e.clone()), ("b".into(), e)]),
    };
    census(&roots.root, &tree, false, true).unwrap();
    assert!(census(&roots.root, &tree, false, false).is_err());
    let outside = crate::common::private::temp();
    std::fs::hard_link(temp.path().join("a"), outside.path().join("external")).unwrap();
    assert!(census(&roots.root, &tree, false, true).is_err());
    assert_eq!(std::fs::read(temp.path().join("a")).unwrap(), b"esbuild");
}
#[test]
fn unlisted_entry_and_replaced_inode_are_rejected() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    std::fs::write(t.path().join("a"), b"a").unwrap();
    let tree = Tree {
        root: observed(t.path(), Kind::Directory),
        entries: BTreeMap::from([("a".into(), observed(&t.path().join("a"), Kind::File))]),
    };
    std::fs::write(t.path().join("b"), b"b").unwrap();
    assert!(census(&r.root, &tree, false, false).is_err());
}

#[test]
fn closed_relative_links_resolve_within_exact_inventory() {
    let mut file = entry();
    file.inode = 3;
    let mut link = entry();
    link.kind = Kind::Link;
    link.sha256 = None;
    link.link = Some("../target".into());
    link.post_mode = 0o555;
    let mut dir = entry();
    dir.kind = Kind::Directory;
    dir.sha256 = None;
    dir.post_mode = 0o555;
    dir.inode = 4;
    let tree = Tree {
        root: dir.clone(),
        entries: BTreeMap::from([
            ("target".into(), file),
            ("bin".into(), dir),
            ("bin/link".into(), link),
        ]),
    };
    validate(&tree.entries).unwrap();
}

#[test]
fn full_link_graph_rejects_escape_dangling_cycles_and_nondirectory_ancestors() {
    let mut dir = entry();
    dir.kind = Kind::Directory;
    dir.sha256 = None;
    dir.post_mode = 0o555;
    let empty = Tree {
        root: dir.clone(),
        entries: BTreeMap::new(),
    };
    for target in ["../../../../etc/passwd", "absent", "link", "target/child"] {
        let mut link = entry();
        link.kind = Kind::Link;
        link.sha256 = None;
        link.link = Some(target.into());
        link.post_mode = 0o555;
        let tree = Tree {
            root: dir.clone(),
            entries: BTreeMap::from([("target".into(), entry()), ("link".into(), link)]),
        };
        assert!(
            closed_links(&[tree, empty.clone(), empty.clone()]).is_err(),
            "{target}"
        );
    }
    let mut link = entry();
    link.kind = Kind::Link;
    link.sha256 = None;
    link.link = Some("../harness/target".into());
    link.post_mode = 0o555;
    let app = Tree {
        root: dir.clone(),
        entries: BTreeMap::from([("link".into(), link)]),
    };
    let harness = Tree {
        root: dir,
        entries: BTreeMap::from([("target".into(), entry())]),
    };
    closed_links(&[app, harness, empty]).unwrap();
}
#[test]
fn observed_setid_bit_cannot_hide_behind_permission_mask() {
    use std::os::unix::fs::PermissionsExt;
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    std::fs::write(t.path().join("a"), b"a").unwrap();
    let tree = Tree {
        root: observed(t.path(), Kind::Directory),
        entries: BTreeMap::from([("a".into(), observed(&t.path().join("a"), Kind::File))]),
    };
    let mode = tree.entries["a"].mode | 0o4000;
    std::fs::set_permissions(t.path().join("a"), std::fs::Permissions::from_mode(mode)).unwrap();
    assert!(census(&r.root, &tree, false, false).is_err());
}
#[test]
fn real_relative_symlink_census_preserves_literal_target() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    std::fs::write(t.path().join("a"), b"a").unwrap();
    std::os::unix::fs::symlink("a", t.path().join("link")).unwrap();
    let mut link = observed(&t.path().join("link"), Kind::Link);
    link.link = Some("a".into());
    link.post_mode = 0o555;
    let tree = Tree {
        root: observed(t.path(), Kind::Directory),
        entries: BTreeMap::from([
            ("a".into(), observed(&t.path().join("a"), Kind::File)),
            ("link".into(), link),
        ]),
    };
    census(&r.root, &tree, false, false).unwrap();
}

#[test]
fn directory_protection_does_not_mutate_regular_preimage_before_new_inode_copy() {
    use std::os::unix::fs::PermissionsExt;
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    std::fs::create_dir(t.path().join("dir")).unwrap();
    std::fs::write(t.path().join("dir/a"), b"a").unwrap();
    let j = crate::common::private::temp();
    let jr = FixtureRoots::open(j.path()).unwrap();
    let mut root = observed(t.path(), Kind::Directory);
    root.post_gid = root.gid;
    let mut dir = observed(&t.path().join("dir"), Kind::Directory);
    dir.post_gid = dir.gid;
    let file = observed(&t.path().join("dir/a"), Kind::File);
    let tree = Tree {
        root,
        entries: BTreeMap::from([("dir".into(), dir), ("dir/a".into(), file.clone())]),
    };
    let result = protect_directories(&r.root, &tree, false, &jr.root, u64::MAX);
    let mode = std::fs::metadata(t.path().join("dir")).unwrap().mode() & 0o777;
    std::fs::set_permissions(t.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    std::fs::set_permissions(t.path().join("dir"), std::fs::Permissions::from_mode(0o700)).unwrap();
    let after = result.unwrap();
    assert_eq!(mode, 0o555);
    assert!(after.entries["dir/a"] == file);
    assert_eq!(
        std::fs::metadata(t.path().join("dir/a")).unwrap().ino(),
        file.inode
    );
}
#[test]
fn root_owner_write_modes_remain_compatible_with_enrolled_slots() {
    for mode in [0o644, 0o755, 0o600, 0o400] {
        let mut e = entry();
        e.post_mode = mode;
        validate(&BTreeMap::from([("source.js".into(), e)])).unwrap();
    }
}
