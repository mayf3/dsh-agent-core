use super::*;
use crate::{fs::FixtureRoots, model::Role, trust::verify_signed};
use std::os::unix::fs::PermissionsExt;

#[test]
fn fixture_keys_are_unique_role_bound_private_and_not_reinitializable() {
    let temp = tempfile::tempdir_in(FixtureRoots::kernel_temp().unwrap()).unwrap();
    std::fs::set_permissions(temp.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    let roots = FixtureRoots::open(temp.path()).unwrap();
    let catalog = initialize(&roots.root, true).unwrap();
    assert_eq!(catalog.keys.len(), 6);
    let unique: std::collections::BTreeSet<_> =
        catalog.keys.values().map(|k| &k.public_key).collect();
    assert_eq!(unique.len(), 6);
    let keys = roots.root.child("issuer-keys").unwrap();
    let key = load(&keys, "local-authority", Role::Authority, &catalog).unwrap();
    let value = crate::model::Policy {
        epoch: 1,
        issued_at: 1,
        expires_at: 2,
        standing_authority_revision: "test".into(),
        revoked_sources: vec![],
        revoked_artifacts: vec![],
    };
    let signed = sign("local-authority", &key, value).unwrap();
    verify_signed(&signed, &catalog, "dsh-app").unwrap();
    assert!(load(&keys, "local-authority", Role::Reviewer, &catalog).is_err());
    assert!(initialize(&roots.root, true).is_err());
    assert!(initialize(&roots.root, false).is_err());
}

#[test]
fn wrong_catalog_key_and_readable_secret_fail_closed() {
    let temp = tempfile::tempdir_in(FixtureRoots::kernel_temp().unwrap()).unwrap();
    std::fs::set_permissions(temp.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    let roots = FixtureRoots::open(temp.path()).unwrap();
    let mut catalog = initialize(&roots.root, true).unwrap();
    let keys = roots.root.child("issuer-keys").unwrap();
    catalog.keys.get_mut("local-builder").unwrap().public_key = "01".repeat(32);
    assert!(load(&keys, "local-builder", Role::Builder, &catalog).is_err());
    std::fs::set_permissions(
        temp.path().join("issuer-keys/local-reviewer.json"),
        std::fs::Permissions::from_mode(0o644),
    )
    .unwrap();
    assert!(load(&keys, "local-reviewer", Role::Reviewer, &catalog).is_err());
}
