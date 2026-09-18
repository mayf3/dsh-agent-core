use super::materialize::*;
use crate::fs::{
    file::{sha, write_new},
    FixtureRoots,
};
use std::os::unix::fs::MetadataExt;
#[test]
fn exact_old_signed_registry_bytes_are_preserved_before_enrollment() {
    let t = crate::common::private::temp();
    let r = FixtureRoots::open(t.path()).unwrap();
    let registry = r.root.mkdir("registry").unwrap();
    let history = r.root.mkdir("history").unwrap();
    write_new(
        &registry,
        "state-00000000000000000001.json",
        b"original signed ledger",
        registry.uid,
        registry.file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    archive_registry(&r.root, &history, &sha(b"original signed ledger")).unwrap();
    assert_eq!(
        super::files::raw(&history, "registry-before-materialization.json").unwrap(),
        b"original signed ledger"
    );
    assert!(archive_registry(&r.root, &history, &sha(b"original signed ledger")).is_err());
}
