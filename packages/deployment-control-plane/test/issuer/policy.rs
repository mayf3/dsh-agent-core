use super::*;
use crate::issuer::coordinator::SupervisorPolicy;
use crate::{
    common,
    fs::FixtureRoots,
    issuer::{github::SourcePolicy, source::SourceSlot},
    queue::Queue,
};
use ed25519_dalek::SigningKey;
use sha2::{Digest, Sha256};
use std::{fs, os::unix::fs::PermissionsExt};
fn setup() -> (tempfile::TempDir, FixtureRoots, Catalog, SupervisorPolicy) {
    let tmp = common::private::temp();
    let roots = FixtureRoots::open(tmp.path()).unwrap();
    let mut c = common::fixture_catalog();
    c.keys.insert(
        "local-authority".into(),
        TrustedKey {
            public_key: hex::encode(
                SigningKey::from_bytes(&Sha256::digest(b"local-authority").into())
                    .verifying_key()
                    .as_bytes(),
            ),
            role: Role::Authority,
            scopes: vec!["fixture".into()],
        },
    );
    let keys = roots.root.mkdir("issuer-keys").unwrap();
    crate::fs::file::write_new(
        &keys,
        "local-authority.json",
        &canonical_bytes(&hex::encode(Sha256::digest(b"local-authority"))).unwrap(),
        keys.uid,
        keys.file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    crate::fs::file::write_new(
        &roots.root,
        "policy.lock",
        b"",
        roots.root.uid,
        roots.root.file.metadata().unwrap().gid(),
        0o600,
    )
    .unwrap();
    let p = SupervisorPolicy {
        version: 1,
        policy_epoch: 9,
        codex_sha256: "a".repeat(64),
        review_helper_sha256: "b".repeat(64),
        revoked_sources: vec![],
        revoked_artifacts: vec![],
        source: SourcePolicy {
            repo: "mayf3/dsh-agent-core".into(),
            branch: "main".into(),
            curl_sha256: "c".repeat(64),
            accepted_contract_path: "docs/specs/test.md".into(),
            accepted_contract_sha256: "d".repeat(64),
            slots: vec![SourceSlot {
                source: "app.js".into(),
                target: "app.js".into(),
                executable: false,
            }],
            additional_review_paths: vec![],
            dependency_closure: vec!["e".repeat(64)],
        },
    };
    owner(&tmp, &p);
    (tmp, roots, c, p)
}
fn owner(tmp: &tempfile::TempDir, p: &SupervisorPolicy) {
    let path = tmp.path().join("issuer-policy.json");
    fs::write(&path, canonical_bytes(p).unwrap()).unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o600)).unwrap();
}
#[test]
fn seconds_apart_reuse_exact_policy_and_queue_revalidation_accepts_it() {
    let (tmp, roots, c, _) = setup();
    let q = Queue::open(tmp.path().join("queue.db")).unwrap();
    let mut p = common::proposal("request", "e", 1, "goal");
    p.policy = current_at(&roots.root, &c, "fixture", 1000).unwrap();
    q.register_producer(&c, "producer").unwrap();
    common::register(&q, &c, &p);
    let id = q.submit(&c, &common::actor(), &p, 1000).unwrap().unit_id;
    let second = current_at(&roots.root, &c, "fixture", 1001).unwrap();
    q.observe_policy(&c, "fixture", &second, 1001).unwrap();
    q.revalidate(&c, &id, &second, 1001).unwrap();
    assert_eq!(second, p.policy);
}
#[test]
fn restart_and_expiry_renewal_keep_monotonic_issuance_epochs() {
    let (tmp, roots, c, _) = setup();
    let first = current_at(&roots.root, &c, "fixture", 1000).unwrap();
    let q = Queue::open(tmp.path().join("queue.db")).unwrap();
    q.observe_policy(&c, "fixture", &first, 1000).unwrap();
    drop(roots);
    let roots = FixtureRoots::open(tmp.path()).unwrap();
    assert_eq!(current_at(&roots.root, &c, "fixture", 1001).unwrap(), first);
    let next = current_at(&roots.root, &c, "fixture", 1291).unwrap();
    assert!(next.payload.epoch > first.payload.epoch);
    assert_eq!(next.payload.issued_at, 1291);
    q.observe_policy(&c, "fixture", &next, 1291).unwrap();
    assert_eq!(current_at(&roots.root, &c, "fixture", 1292).unwrap(), next);
}
#[test]
fn owner_revision_is_independent_and_revocation_cannot_be_hidden() {
    let (tmp, roots, c, mut config) = setup();
    let q = Queue::open(tmp.path().join("queue.db")).unwrap();
    q.register_producer(&c, "producer").unwrap();
    let mut p = common::proposal("request", "e", 1, "goal");
    p.policy = current_at(&roots.root, &c, "fixture", 1000).unwrap();
    common::register(&q, &c, &p);
    let id = q.submit(&c, &common::actor(), &p, 1000).unwrap().unit_id;
    let renewed = current_at(&roots.root, &c, "fixture", 1291).unwrap();
    config.policy_epoch = 10;
    config.revoked_artifacts.push("e".repeat(64));
    owner(&tmp, &config);
    let revoked = current_at(&roots.root, &c, "fixture", 1292).unwrap();
    assert!(revoked.payload.epoch > renewed.payload.epoch);
    assert_eq!(
        q.revalidate(&c, &id, &revoked, 1292).unwrap_err().code(),
        "REVOKED"
    );
    assert_eq!(
        q.observe_policy(&c, "fixture", &renewed, 1292)
            .unwrap_err()
            .code(),
        "POLICY_REPLAY"
    );
    config.policy_epoch = 9;
    owner(&tmp, &config);
    assert_eq!(
        current_at(&roots.root, &c, "fixture", 1293)
            .unwrap_err()
            .code(),
        "POLICY_CONFIG_REPLAY"
    );
    config.policy_epoch = 10;
    config.revoked_artifacts.clear();
    owner(&tmp, &config);
    assert_eq!(
        current_at(&roots.root, &c, "fixture", 1293)
            .unwrap_err()
            .code(),
        "POLICY_EQUIVOCATION"
    );
}
#[test]
fn semantic_config_change_without_owner_revision_is_equivocation() {
    let (tmp, roots, c, mut config) = setup();
    current_at(&roots.root, &c, "fixture", 1000).unwrap();
    config.source.accepted_contract_sha256 = "f".repeat(64);
    owner(&tmp, &config);
    assert_eq!(
        current_at(&roots.root, &c, "fixture", 1001)
            .unwrap_err()
            .code(),
        "POLICY_EQUIVOCATION"
    );
}
#[test]
fn cache_and_lock_metadata_and_unknown_temporary_fail_closed() {
    for fault in [
        "mode",
        "symlink",
        "hardlink",
        "signature",
        "pending",
        "lock",
    ] {
        let (tmp, roots, c, _) = setup();
        current_at(&roots.root, &c, "fixture", 1000).unwrap();
        let cache = tmp.path().join("policy-cache.json");
        match fault {
            "mode" => fs::set_permissions(&cache, fs::Permissions::from_mode(0o666)).unwrap(),
            "symlink" => {
                let other = tmp.path().join("other");
                fs::rename(&cache, &other).unwrap();
                std::os::unix::fs::symlink(&other, &cache).unwrap();
            }
            "hardlink" => fs::hard_link(&cache, tmp.path().join("other")).unwrap(),
            "signature" => {
                let mut value: serde_json::Value =
                    serde_json::from_slice(&fs::read(&cache).unwrap()).unwrap();
                value["signature"] = "0".repeat(128).into();
                fs::write(&cache, serde_json::to_vec(&value).unwrap()).unwrap();
            }
            "pending" => {
                let pending = tmp.path().join("policy-cache.tmp");
                fs::write(&pending, b"partial unknown issuance").unwrap();
                fs::set_permissions(pending, fs::Permissions::from_mode(0o600)).unwrap();
            }
            "lock" => fs::set_permissions(
                tmp.path().join("policy.lock"),
                fs::Permissions::from_mode(0o666),
            )
            .unwrap(),
            _ => unreachable!(),
        }
        assert!(
            current_at(&roots.root, &c, "fixture", 1001).is_err(),
            "accepted {fault}"
        );
    }
}
#[test]
fn native_policy_entry_refuses_fixture_identity_before_effects() {
    let (_tmp, roots, c, _) = setup();
    assert_eq!(
        current_native(&roots.root, &c, "fixture")
            .unwrap_err()
            .code(),
        "ISSUER_REQUIRES_ROOT"
    );
}
#[test]
fn profile_switches_use_global_monotonic_epochs_without_old_profile_replay() {
    let (tmp, roots, mut c, _) = setup();
    c.profiles
        .insert("second".into(), c.profiles["fixture"].clone());
    c.keys
        .get_mut("local-authority")
        .unwrap()
        .scopes
        .push("second".into());
    let q = Queue::open(tmp.path().join("queue.db")).unwrap();
    let first = current_at(&roots.root, &c, "fixture", 1000).unwrap();
    q.observe_policy(&c, "fixture", &first, 1000).unwrap();
    let second = current_at(&roots.root, &c, "second", 1001).unwrap();
    q.observe_policy(&c, "second", &second, 1001).unwrap();
    assert!(second.payload.epoch > first.payload.epoch);
    let returned = current_at(&roots.root, &c, "fixture", 1002).unwrap();
    assert!(returned.payload.epoch > second.payload.epoch);
    q.observe_policy(&c, "fixture", &returned, 1002).unwrap();
    assert_eq!(
        current_at(&roots.root, &c, "fixture", 1003).unwrap(),
        returned
    );
    assert!(!tmp.path().join(TEMPORARY).exists());
}
#[test]
fn cache_signed_by_wrong_issuer_or_with_wrong_source_binding_is_rejected() {
    for wrong_issuer in [false, true] {
        let (tmp, roots, c, _) = setup();
        current_at(&roots.root, &c, "fixture", 1000).unwrap();
        let path = tmp.path().join(CACHE);
        let mut saved: Signed<CachedLease> =
            serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        let name = if wrong_issuer {
            "authority"
        } else {
            "local-authority"
        };
        if !wrong_issuer {
            saved.payload.source_digest = "f".repeat(64);
        }
        let changed = common::signed(name, saved.payload);
        fs::write(&path, canonical_bytes(&changed).unwrap()).unwrap();
        let expected = if wrong_issuer {
            "POLICY_CACHE_ISSUER"
        } else {
            "POLICY_CACHE_BINDING"
        };
        assert_eq!(
            current_at(&roots.root, &c, "fixture", 1001)
                .unwrap_err()
                .code(),
            expected
        );
    }
}
#[test]
fn backwards_clock_cannot_return_a_future_lease() {
    let (_tmp, roots, c, _) = setup();
    current_at(&roots.root, &c, "fixture", 1000).unwrap();
    assert_eq!(
        current_at(&roots.root, &c, "fixture", 999)
            .unwrap_err()
            .code(),
        "CLOCK_ROLLBACK"
    );
}

#[test]
fn finite_v2_source_map_renews_current_owner_lease() {
    let (tmp, roots, c, config) = setup();
    let first = current_at(&roots.root, &c, "fixture", 1000).unwrap();
    let mut value = serde_json::to_value(&config).unwrap();
    let source = value.as_object_mut().unwrap().remove("source").unwrap();
    value["version"] = 2.into();
    value["policy_epoch"] = 10.into();
    value["sources_by_goal"] = serde_json::json!({"watchdog-child": {
        "enrollment_digest": "a".repeat(64), "source": source
    }});
    fs::write(
        tmp.path().join("issuer-policy.json"),
        canonical_bytes(&value).unwrap(),
    )
    .unwrap();
    let second =
        current_at(&roots.root, &c, "fixture", 1001).expect("bounded v2 Owner source selection");
    assert!(second.payload.epoch > first.payload.epoch);
    assert_eq!(
        current_at(&roots.root, &c, "fixture", 1002).unwrap(),
        second
    );
    value["sources_by_goal"]["watchdog-child"]["enrollment_digest"] = "b".repeat(64).into();
    fs::write(
        tmp.path().join("issuer-policy.json"),
        canonical_bytes(&value).unwrap(),
    )
    .unwrap();
    assert_eq!(
        current_at(&roots.root, &c, "fixture", 1003)
            .unwrap_err()
            .code(),
        "POLICY_EQUIVOCATION"
    );
    value["policy_epoch"] = 11.into();
    fs::write(
        tmp.path().join("issuer-policy.json"),
        canonical_bytes(&value).unwrap(),
    )
    .unwrap();
    assert!(
        current_at(&roots.root, &c, "fixture", 1004)
            .unwrap()
            .payload
            .epoch
            > second.payload.epoch
    );
}
