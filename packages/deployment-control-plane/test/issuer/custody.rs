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

#[test]
fn standing_stage_preserves_genesis_and_changes_all_six_keys_once() {
    let temp = tempfile::tempdir_in(FixtureRoots::kernel_temp().unwrap()).unwrap();
    std::fs::set_permissions(temp.path(), std::fs::Permissions::from_mode(0o700)).unwrap();
    let roots = FixtureRoots::open(temp.path()).unwrap();
    let old = initialize(&roots.root, true).unwrap();
    let old_trust = std::fs::read(temp.path().join("local-trust.json")).unwrap();
    let old_files: BTreeMap<_, _> = ROLES
        .iter()
        .map(|(id, _)| {
            (
                *id,
                std::fs::read(temp.path().join(format!("issuer-keys/{id}.json"))).unwrap(),
            )
        })
        .collect();
    let stage = roots
        .root
        .mkdir("custody-transition")
        .unwrap()
        .mkdir("generated")
        .unwrap();
    let fresh = initialize_revision(&stage, true, "local-first-standing-v1").unwrap();
    assert_eq!(fresh.revision, "local-first-standing-v1");
    assert_eq!(fresh.keys.len(), 6);
    for (id, role) in ROLES {
        assert_ne!(old.keys[id].public_key, fresh.keys[id].public_key);
        assert_eq!(old.keys[id].role, fresh.keys[id].role);
        assert_eq!(old.keys[id].scopes, fresh.keys[id].scopes);
        let previous = load(&roots.root.child("issuer-keys").unwrap(), id, role, &old).unwrap();
        let current = load(&stage.child("issuer-keys").unwrap(), id, role, &fresh).unwrap();
        let signature = previous.sign(b"only a fixture message");
        assert!(current
            .verifying_key()
            .verify_strict(b"only a fixture message", &signature)
            .is_err());
        assert_eq!(
            std::fs::read(temp.path().join(format!("issuer-keys/{id}.json"))).unwrap(),
            old_files[id]
        );
    }
    assert_eq!(
        std::fs::read(temp.path().join("local-trust.json")).unwrap(),
        old_trust
    );
    assert!(initialize_revision(&stage, true, "local-first-standing-v1").is_err());
    assert!(initialize_standing_stage(&stage).is_err());
}
