use crate::{first_live::initial_queue, fs::FixtureRoots};
#[test]
fn queue_initialization_requires_no_database_or_sidecar() {
    for name in [
        "queue.db",
        "queue.db-wal",
        "queue.db-shm",
        "queue.db-journal",
    ] {
        let t = crate::common::private::temp();
        let roots = FixtureRoots::open(t.path()).unwrap();
        crate::fs::file::write_new(
            &roots.root,
            name,
            b"",
            roots.root.uid,
            unsafe { libc::getgid() },
            0o600,
        )
        .unwrap();
        assert!(
            initial_queue::initialize(&roots.root, t.path()).is_err(),
            "{name}"
        );
    }
}
#[test]
fn first_empty_queue_is_real_and_cannot_be_initialized_twice() {
    let t = crate::common::private::temp();
    let roots = FixtureRoots::open(t.path()).unwrap();
    let q = initial_queue::initialize(&roots.root, t.path()).unwrap();
    assert_eq!(q.unit_count().unwrap(), 0);
    assert!(initial_queue::initialize(&roots.root, t.path()).is_err());
}
