use super::*;
use crate::fs::FixtureRoots;
#[test]
fn node_recovery_bytes_are_separate_sealed_binary_not_unbounded_json_array() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let bytes = vec![0x61; 1024 * 1024];
    let id = "a".repeat(64);
    let old = crate::fs::file::FileImage {
        bytes: bytes.clone(),
        uid: r.root.uid,
        gid: 20,
        mode: 0o555,
        device: 1,
        inode: 2,
        xattrs: BTreeMap::new(),
        mtime_seconds: 1,
        mtime_nanos: 0,
    };
    let value = archive_before(&r.root, &id, &Some(old)).unwrap();
    assert!(serde_json::to_vec(&value).unwrap().len() < 4096);
    assert_eq!(
        super::super::super::files::raw(&r.root, &format!("{id}-bytes")).unwrap(),
        bytes
    );
    assert!(archive_before(&r.root, &id, &None).is_err());
}
