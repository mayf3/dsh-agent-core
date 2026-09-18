use super::*;
#[test]
fn unchanged_hash_does_not_hide_replaced_or_missing_leaf() {
    use crate::fs::{file::write_new, FixtureRoots};
    use std::os::unix::fs::MetadataExt;
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let gid = r.root.file.metadata().unwrap().gid();
    write_new(&r.root, "leaf", b"same", r.root.uid, gid, 0o400).unwrap();
    let before = capture_one(&r.root, "leaf").unwrap();
    assert_eq!(capture_one(&r.root, "leaf").unwrap(), before);
    write_new(&r.root, "replacement", b"same", r.root.uid, gid, 0o400).unwrap();
    r.root.rename("replacement", &r.root, "leaf").unwrap();
    assert_ne!(capture_one(&r.root, "leaf").unwrap(), before);
    std::fs::remove_file(t.path().join("leaf")).unwrap();
    assert!(capture_one(&r.root, "leaf").is_err());
}
