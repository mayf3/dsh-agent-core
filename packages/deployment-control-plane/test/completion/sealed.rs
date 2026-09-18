#[test]
fn existing_only_never_imports_valid_staging() {
    let (t, r, _q, _c, id) = crate::transaction::test_fixture::prepared();
    let q = crate::queue::Queue::open(t.path().join("queue.db")).unwrap();
    let u = q.daemon_status(&id).unwrap().unit;
    let store = r.artifacts().unwrap();
    assert!(store
        .open_existing(&u.artifact_sha256, &u.manifest_digest)
        .is_err());
    assert!(store.sealed.names().unwrap().is_empty());
    let imported = store
        .import(&u.artifact_sha256, &u.manifest_digest)
        .unwrap();
    imported.verify().unwrap();
    store
        .open_existing(&u.artifact_sha256, &u.manifest_digest)
        .unwrap();
}

#[test]
fn corrupt_existing_sealed_never_falls_back_to_staging() {
    let (_t, r, q, _c, id) = crate::transaction::test_fixture::prepared();
    let u = q.daemon_status(&id).unwrap().unit;
    let store = r.artifacts().unwrap();
    let sealed = store
        .import(&u.artifact_sha256, &u.manifest_digest)
        .unwrap();
    sealed.dir.unlink("manifest.json").unwrap();
    assert!(store
        .open_existing(&u.artifact_sha256, &u.manifest_digest)
        .is_err());
    assert!(store
        .import(&u.artifact_sha256, &u.manifest_digest)
        .is_err());
    assert_eq!(store.sealed.names().unwrap(), vec![u.artifact_sha256]);
}
