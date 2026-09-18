use crate::{common::*, fixture::*};
use deployment_control_plane::{model::Catalog, registry::*};
use sha2::{Digest, Sha256};
use std::{
    fs,
    os::unix::fs::{symlink, PermissionsExt},
};
#[test]
fn deployment_child_cannot_alias_its_original_business_goal() {
    let temp = private::temp();
    let c = fixture_catalog();
    let registry = open(temp.path(), &c);
    let mut e = enrollment("goal").payload;
    e.business_goal_id = e.goal_id.clone();
    assert_eq!(
        registry.enroll(&signed("authority", e)).unwrap_err().code(),
        "DEPLOYMENT_SCOPE"
    );
}
fn reopen_error(path: &std::path::Path, c: &Catalog) -> String {
    Registry::open_fixture(path, c, "producer", Sha256::digest(b"producer").into())
        .err()
        .unwrap()
        .code()
        .into()
}
#[test]
fn ledger_tamper_symlink_hardlink_and_writable_metadata_are_rejected() {
    for attack in ["bytes", "symlink", "hardlink", "mode"] {
        let temp = private::temp();
        let c = fixture_catalog();
        let r = open(temp.path(), &c);
        r.enroll(&enrollment("goal")).unwrap();
        drop(r);
        let path = temp.path().join("registry/state-00000000000000000001.json");
        let raw = fs::read(&path).unwrap();
        match attack {
            "bytes" => {
                let mut v: serde_json::Value = serde_json::from_slice(&raw).unwrap();
                v["payload"]["rows"]["goal"]["business_goal_complete"] = true.into();
                fs::write(&path, serde_json::to_vec(&v).unwrap()).unwrap();
                assert_eq!(reopen_error(temp.path(), &c), "INVALID_SIGNATURE");
            }
            "symlink" => {
                let other = temp.path().join("outside.json");
                fs::rename(&path, &other).unwrap();
                symlink(&other, &path).unwrap();
                assert_eq!(reopen_error(temp.path(), &c), "UNSAFE_FILE");
            }
            "hardlink" => {
                fs::hard_link(&path, temp.path().join("outside.json")).unwrap();
                assert_eq!(reopen_error(temp.path(), &c), "UNSAFE_TYPE");
            }
            "mode" => {
                fs::set_permissions(&path, fs::Permissions::from_mode(0o666)).unwrap();
                assert_eq!(reopen_error(temp.path(), &c), "UNSAFE_MODE");
            }
            _ => unreachable!(),
        }
    }
}
#[test]
fn snapshot_restart_is_monotonic_cumulative_and_queue_replay_safe() {
    let (temp, q, c) = setup();
    let r = open(temp.path(), &c);
    r.enroll(&enrollment("first")).unwrap();
    r.activate(&actor(), &proposal("first", "e", 1, "first"), 0, 1001)
        .unwrap();
    r.enroll(&enrollment("second")).unwrap();
    r.activate(&actor(), &proposal("second", "e", 1, "second"), 0, 1001)
        .unwrap();
    drop(r);
    let r = open(temp.path(), &c);
    let snapshots = r.snapshots_after(0, 16).unwrap();
    assert_eq!(snapshots.len(), 4);
    assert_eq!(
        snapshots
            .iter()
            .map(|s| s.payload.revision)
            .collect::<Vec<_>>(),
        vec![1, 2, 3, 4]
    );
    assert_eq!(
        snapshots[3]
            .payload
            .records
            .iter()
            .map(|s| s.payload.goal_id.as_str())
            .collect::<Vec<_>>(),
        vec!["first", "second"]
    );
    for s in &snapshots {
        q.ingest_snapshot(&c, s).unwrap();
    }
    assert_eq!(
        q.ingest_snapshot(&c, &snapshots[3]).unwrap_err().code(),
        "PRODUCER_CAS"
    );
    let page = q.census(q.census_revision().unwrap(), None, 256).unwrap();
    assert!(page.exhaustive);
    assert_eq!(page.records.len(), 2);
    assert!(r.snapshots_after(4, 16).unwrap().is_empty());
    assert_eq!(
        r.snapshots_after(5, 16).unwrap_err().code(),
        "REGISTRY_AHEAD"
    );
}
#[test]
fn another_writer_cannot_reuse_stale_goal_revision() {
    let temp = private::temp();
    let c = fixture_catalog();
    let first = open(temp.path(), &c);
    let second = open(temp.path(), &c);
    first.enroll(&enrollment("goal")).unwrap();
    let p = proposal("request", "e", 1, "goal");
    first.activate(&actor(), &p, 0, 1001).unwrap();
    assert_eq!(
        second.activate(&actor(), &p, 0, 1001).unwrap_err().code(),
        "REGISTRY_CAS"
    );
    assert_eq!(second.get("goal").unwrap().revision, 1);
}
#[test]
fn historical_review_does_not_bypass_current_review_or_prior_dependency() {
    let temp = private::temp();
    let c = fixture_catalog();
    let r = open(temp.path(), &c);
    let mut e = enrollment("goal").payload;
    e.prior_dependencies = vec![PriorDependency {
        goal_id: "watchdog".into(),
        provenance: reference("watchdog-first"),
    }];
    r.enroll(&signed("authority", e)).unwrap();
    let mut p = proposal("request", "e", 1, "goal");
    p.reviews.clear();
    assert_eq!(
        r.activate(&actor(), &p, 0, 1001).unwrap_err().code(),
        "REVIEW_MISSING"
    );
    let p = proposal("request", "e", 1, "goal");
    assert_eq!(
        r.activate(&actor(), &p, 0, 1001).unwrap_err().code(),
        "PRIOR_DEPENDENCY_REQUIRED"
    );
    assert!(r.snapshot().unwrap().payload.records.is_empty());
}
#[test]
fn protected_lock_cannot_be_writable_or_a_symlink() {
    let temp = private::temp();
    let c = fixture_catalog();
    drop(open(temp.path(), &c));
    let path = temp.path().join("registry/registry.lock");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o666)).unwrap();
    assert_eq!(reopen_error(temp.path(), &c), "UNSAFE_MODE");
}
#[test]
fn interrupted_exact_prefix_recovers_without_overwriting_another_operation() {
    for complete in [false, true] {
        let temp = private::temp();
        let c = fixture_catalog();
        let r = open(temp.path(), &c);
        let e = enrollment("goal");
        r.enroll(&e).unwrap();
        drop(r);
        let committed = temp.path().join("registry/state-00000000000000000001.json");
        let pending = temp.path().join("registry/pending.tmp");
        let raw = fs::read(&committed).unwrap();
        fs::rename(&committed, &pending).unwrap();
        if !complete {
            fs::write(&pending, &raw[..raw.len() / 2]).unwrap();
        }
        let r = open(temp.path(), &c);
        assert_eq!(
            r.enroll(&enrollment("another-goal")).unwrap_err().code(),
            "REGISTRY_PENDING_CONFLICT"
        );
        r.enroll(&e).unwrap();
        assert_eq!(fs::read(&committed).unwrap(), raw);
        assert!(!pending.exists());
        assert_eq!(r.snapshot().unwrap().payload.revision, 1);
    }
}
#[test]
fn signed_history_replay_or_gap_cannot_reset_monotonic_revision() {
    for gap in [false, true] {
        let temp = private::temp();
        let c = fixture_catalog();
        let r = open(temp.path(), &c);
        r.enroll(&enrollment("goal")).unwrap();
        r.activate(&actor(), &proposal("request", "e", 1, "goal"), 0, 1001)
            .unwrap();
        drop(r);
        let first = temp.path().join("registry/state-00000000000000000001.json");
        let second = temp.path().join("registry/state-00000000000000000002.json");
        if gap {
            fs::remove_file(&first).unwrap();
            assert_eq!(reopen_error(temp.path(), &c), "REGISTRY_HISTORY_GAP");
        } else {
            fs::write(&second, fs::read(&first).unwrap()).unwrap();
            assert_eq!(reopen_error(temp.path(), &c), "REGISTRY_HISTORY_BINDING");
        }
    }
}
