use super::*;
use crate::{common, queue::Queue, service::Configuration};
use fixture::*;

#[test]
fn preserved_genesis_accepts_fresh_successor_without_rewriting_original() {
    let c = Case::new();
    let dir = c.roots.root.child("registry").unwrap();
    let inode = dir
        .open_file(STATE1, libc::O_RDONLY, 0)
        .unwrap()
        .metadata()
        .unwrap()
        .ino();
    let lock_inode = dir
        .open_file("registry.lock", libc::O_RDONLY, 0)
        .unwrap()
        .metadata()
        .unwrap()
        .ino();
    c.publish();
    let r = fixture::load(&c.roots, &c.fresh).unwrap();
    assert_eq!(r.get("goal").unwrap().state, DeploymentState::Pending);
    assert_eq!(raw(&dir, STATE1, 0o600).unwrap(), c.p.old_state1);
    assert_eq!(
        dir.open_file(STATE1, libc::O_RDONLY, 0)
            .unwrap()
            .metadata()
            .unwrap()
            .ino(),
        inode
    );
    assert_eq!(
        dir.open_file("registry.lock", libc::O_RDONLY, 0)
            .unwrap()
            .metadata()
            .unwrap()
            .ino(),
        lock_inode
    );
    let snapshots = r.snapshots_after(0, 16).unwrap();
    let q = Queue::open(":memory:").unwrap();
    q.register_producer(&c.fresh, PRODUCER).unwrap();
    assert!(q.ingest_snapshot(&c.fresh, &snapshots[1]).is_err());
    for s in &snapshots {
        q.ingest_snapshot(&c.fresh, s).unwrap();
    }
    assert_eq!(
        snapshots
            .iter()
            .map(|s| s.payload.revision)
            .collect::<Vec<_>>(),
        vec![1, 2]
    );
    assert!(
        q.census(q.census_revision().unwrap(), None, 16)
            .unwrap()
            .exhaustive
    );
    let old: Signed<storage::Ledger> = serde_json::from_slice(&c.p.old_state1).unwrap();
    assert!(q.ingest_snapshot(&c.fresh, &old.payload.snapshot).is_err());
    drop(r);
    fixture::load(&c.roots, &c.fresh).unwrap();
}
#[test]
fn ordinary_enrollment_remains_signed_immutable_and_later_history_is_fresh() {
    let c = Case::new();
    c.publish();
    let r = fixture::load(&c.roots, &c.fresh).unwrap();
    let row = r.get("goal").unwrap();
    r.enroll(&row.enrollment).unwrap();
    let old: Signed<storage::Ledger> = serde_json::from_slice(&c.p.old_state1).unwrap();
    assert!(r.enroll(&old.payload.rows["goal"].enrollment).is_err());
    let mut changed = row.enrollment.payload.clone();
    changed.scope_description += " different";
    assert_eq!(
        r.enroll(&sign(&key("local-authority", "fresh"), "local-authority", changed).unwrap())
            .unwrap_err()
            .code(),
        "ENROLLMENT_IMMUTABLE"
    );
    let mut next = row.enrollment.payload;
    next.goal_id = "second-goal".into();
    r.enroll(&sign(&key("local-authority", "fresh"), "local-authority", next).unwrap())
        .unwrap();
    assert_eq!(
        fixture::load(&c.roots, &c.fresh)
            .unwrap()
            .snapshots_after(2, 16)
            .unwrap()[0]
            .payload
            .revision,
        3
    );
}
#[test]
fn incomplete_publication_and_repeated_transition_are_rejected() {
    let c = Case::new();
    let d = c.archive();
    assert!(fixture::load(&c.roots, &c.fresh).is_err());
    fixture::append(&c.roots, &c.guard, &c.p).unwrap();
    assert!(fixture::load(&c.roots, &c.fresh).is_err());
    assert!(fixture::append(&c.roots, &c.guard, &c.p).is_err());
    c.complete(&d);
    fixture::load(&c.roots, &c.fresh).unwrap();
    assert!(fixture::prepare(
        &c.roots,
        &c.guard,
        &c.fresh,
        &key("local-authority", "fresh"),
        &key(PRODUCER, "fresh"),
        bindings()
    )
    .is_err());
}
#[test]
fn original_bytes_and_successor_must_be_exact() {
    for name in [STATE1, STATE2] {
        let c = Case::new();
        c.publish();
        let d = c.roots.root.child("registry").unwrap();
        let mut bytes = raw(&d, name, 0o600).unwrap();
        bytes.push(b' ');
        replace(&d, name, &bytes, 0o600);
        assert!(fixture::load(&c.roots, &c.fresh).is_err());
    }
}
#[test]
fn completion_bridge_archives_and_reattested_snapshot_are_all_required() {
    for name in [
        "result.json",
        "registry-bridge.json",
        "old-service.json",
        "old-trust.json",
        "old-state1.json",
        "fresh-snapshot1.json",
        "published-service.json",
    ] {
        let c = Case::new();
        let d = c.publish();
        let mut bytes = raw(&d, name, 0o400).unwrap();
        bytes.push(b' ');
        replace(&d, name, &bytes, 0o400);
        // Even result JSON is authenticated by exact typed joins, not raw encoding.
        if name == "result.json" {
            let mut v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
            v["owner_grant_digest"] = "f".repeat(64).into();
            replace(&d, name, &serde_json::to_vec(&v).unwrap(), 0o400);
        }
        assert!(fixture::load(&c.roots, &c.fresh).is_err(), "{name}");
    }
}
#[test]
fn current_profiles_may_evolve_but_current_keys_cannot_mix() {
    let mut c = Case::new();
    c.publish();
    c.fresh.profiles.get_mut("dsh-app").unwrap().enabled = true;
    let mut s: Configuration =
        serde_json::from_slice(&raw(&c.roots.root, "service.json", 0o600).unwrap()).unwrap();
    s.catalog = c.fresh.clone();
    replace(
        &c.roots.root,
        "service.json",
        &canonical_bytes(&s).unwrap(),
        0o600,
    );
    fixture::load(&c.roots, &c.fresh).unwrap();
    c.fresh.keys.insert(
        "local-reviewer".into(),
        catalog("old").keys["local-reviewer"].clone(),
    );
    s.catalog = c.fresh.clone();
    replace(
        &c.roots.root,
        "service.json",
        &canonical_bytes(&s).unwrap(),
        0o600,
    );
    assert!(fixture::load(&c.roots, &c.fresh).is_err());
}
#[test]
fn prepare_refuses_live_state_pending_files_and_wrong_mutex() {
    for name in [
        "queue.db",
        "activation.json",
        "daemon-activation.json",
        "issuer-bindings.json",
    ] {
        let c = Case::new();
        write(&c.roots.root, name, b"{}", 0o600);
        assert!(fixture::prepare(
            &c.roots,
            &c.guard,
            &c.fresh,
            &key("local-authority", "fresh"),
            &key(PRODUCER, "fresh"),
            bindings()
        )
        .is_err());
    }
    let c = Case::new();
    write(
        &c.roots.root.child("registry").unwrap(),
        "pending.tmp",
        b"",
        0o600,
    );
    assert!(fixture::append(&c.roots, &c.guard, &c.p).is_err());
    let other = common::private::temp();
    let roots = FixtureRoots::open(other.path()).unwrap();
    let guard = roots.lock().unwrap();
    assert!(fixture::append(&c.roots, &guard, &c.p).is_err());
}
#[test]
fn committed_bridge_never_recreates_missing_permanent_lock() {
    let c = Case::new();
    c.publish();
    std::fs::remove_file(c._temp.path().join("registry/registry.lock")).unwrap();
    assert!(fixture::load(&c.roots, &c.fresh).is_err());
    assert!(!c._temp.path().join("registry/registry.lock").exists());
}
#[test]
fn fresh_signed_state2_cannot_change_carried_semantics() {
    for change in ["owner", "revision", "business_complete", "goal"] {
        let mut c = Case::new();
        let mut s: Signed<storage::Ledger> = serde_json::from_slice(&c.p.state2).unwrap();
        let row = s.payload.rows.get_mut("goal").unwrap();
        match change {
            "owner" => row.enrollment.payload.owner = "another-owner".into(),
            "revision" => row.revision = 1,
            "business_complete" => row.business_goal_complete = true,
            "goal" => row.enrollment.payload.scope_description += " changed accepted scope",
            _ => unreachable!(),
        }
        row.enrollment = sign(
            &key("local-authority", "fresh"),
            "local-authority",
            row.enrollment.payload.clone(),
        )
        .unwrap();
        c.p.state2 =
            canonical_bytes(&sign(&key(PRODUCER, "fresh"), PRODUCER, s.payload).unwrap()).unwrap();
        let mut b: Signed<Bridge> = serde_json::from_slice(&c.p.bridge).unwrap();
        b.payload.state2_sha256 = sha(&c.p.state2);
        c.p.bridge =
            canonical_bytes(&sign(&key(PRODUCER, "fresh"), PRODUCER, b.payload).unwrap()).unwrap();
        c.publish();
        assert!(fixture::load(&c.roots, &c.fresh).is_err(), "{change}");
    }
}
#[test]
fn fresh_keys_and_fresh_snapshot_are_not_old_signature_fallbacks() {
    let mut c = Case::new();
    let old: Signed<storage::Ledger> = serde_json::from_slice(&c.p.old_state1).unwrap();
    c.p.fresh_snapshot1 = canonical_bytes(&old.payload.snapshot).unwrap();
    let mut b: Signed<Bridge> = serde_json::from_slice(&c.p.bridge).unwrap();
    b.payload.fresh_snapshot1_sha256 = sha(&c.p.fresh_snapshot1);
    c.p.bridge =
        canonical_bytes(&sign(&key(PRODUCER, "fresh"), PRODUCER, b.payload).unwrap()).unwrap();
    c.publish();
    assert!(fixture::load(&c.roots, &c.fresh).is_err());
    let c = Case::new();
    let old = catalog("old");
    for (id, _) in crate::issuer::custody::ROLES {
        let mut mixed = c.fresh.clone();
        mixed.keys.insert(id.into(), old.keys[id].clone());
        assert!(
            fixture::prepare(
                &c.roots,
                &c.guard,
                &mixed,
                &key("local-authority", "fresh"),
                &key(PRODUCER, "fresh"),
                bindings()
            )
            .is_err(),
            "{id}"
        );
    }
}
#[test]
fn initial_active_or_closed_row_extra_history_and_registry_busy_stop_prepare() {
    for state in [DeploymentState::Ready, DeploymentState::Closed] {
        let c = Case::new();
        let dir = c.roots.root.child("registry").unwrap();
        let mut l: Signed<storage::Ledger> = serde_json::from_slice(&c.p.old_state1).unwrap();
        l.payload.rows.get_mut("goal").unwrap().state = state;
        replace(
            &dir,
            STATE1,
            &canonical_bytes(&sign(&key(PRODUCER, "old"), PRODUCER, l.payload).unwrap()).unwrap(),
            0o600,
        );
        assert!(fixture::prepare(
            &c.roots,
            &c.guard,
            &c.fresh,
            &key("local-authority", "fresh"),
            &key(PRODUCER, "fresh"),
            bindings()
        )
        .is_err());
    }
    let c = Case::new();
    let dir = c.roots.root.child("registry").unwrap();
    let lock = storage::lock(&dir).unwrap();
    assert!(fixture::append(&c.roots, &c.guard, &c.p).is_err());
    drop(lock);
    write(&dir, "state-00000000000000000003.json", b"{}", 0o600);
    assert!(fixture::append(&c.roots, &c.guard, &c.p).is_err());
}
#[test]
fn each_old_role_signature_fails_active_verification() {
    let c = Case::new();
    c.publish();
    fn rejects<T: Signable>(c: &Catalog, id: &str, payload: T) {
        let proof = sign(&key(id, "old"), id, payload).unwrap();
        assert_eq!(
            verify_signed(&proof, c, "dsh-app").unwrap_err().code(),
            "INVALID_SIGNATURE"
        );
    }
    let p = common::proposal("request", "a", 1, "goal");
    rejects(&c.fresh, "local-authority", p.acceptance.payload);
    rejects(&c.fresh, "local-builder", p.build.payload);
    rejects(&c.fresh, "local-reviewer", p.reviews[0].payload.clone());
    rejects(&c.fresh, PRODUCER, p.goals[0].payload.clone());
    rejects(
        &c.fresh,
        "local-verifier",
        GoalReceipt {
            unit_id: "unit".into(),
            goal_id: "goal".into(),
            acceptance_revision: "accept-1".into(),
            target_generation: 1,
            attempt: 1,
            service_generation: "service".into(),
            attachment_digest: "a".repeat(64),
            outcome: GoalOutcome::Pass,
            evidence_digest: "b".repeat(64),
            revision: 1,
        },
    );
    rejects(
        &c.fresh,
        "local-recovery",
        RecoveryEvidence {
            unit_id: "unit".into(),
            status_revision: 1,
            failure_cause_digest: "a".repeat(64),
            remediation_digest: "b".repeat(64),
            restored_preimage_digest: "c".repeat(64),
            service_readback_digest: "d".repeat(64),
            owned_operations_receipt: "e".repeat(64),
            step_dispositions: vec![],
            issued_at: 100,
        },
    );
}
#[test]
fn historical_catalog_does_not_authenticate_later_ledgers() {
    let c = Case::new();
    c.publish();
    let r = fixture::load(&c.roots, &c.fresh).unwrap();
    let mut later: Signed<storage::Ledger> = serde_json::from_slice(&c.p.state2).unwrap();
    later.payload.revision = 3;
    later.payload.previous_digest = Some(digest(&later).unwrap());
    later.payload.snapshot.payload.revision = 3;
    later.payload.snapshot.payload.previous_revision = 2;
    later.payload.snapshot.payload.watermark = 3;
    later.payload.snapshot = sign(
        &key(PRODUCER, "old"),
        PRODUCER,
        later.payload.snapshot.payload,
    )
    .unwrap();
    write(
        &c.roots.root.child("registry").unwrap(),
        "state-00000000000000000003.json",
        &canonical_bytes(&sign(&key(PRODUCER, "old"), PRODUCER, later.payload).unwrap()).unwrap(),
        0o600,
    );
    assert_eq!(r.snapshot().unwrap_err().code(), "INVALID_SIGNATURE");
}

#[test]
fn preparation_cannot_enable_or_change_original_profiles() {
    let c = Case::new();
    let mut enabled = c.fresh.clone();
    enabled.profiles.get_mut("dsh-app").unwrap().enabled = true;
    assert!(fixture::prepare(
        &c.roots,
        &c.guard,
        &enabled,
        &key("local-authority", "fresh"),
        &key(PRODUCER, "fresh"),
        bindings()
    )
    .is_err());
}
#[test]
fn published_requests_closure_and_recovery_residue_stop_preparation() {
    for name in ["admitted", "requests", "closure", "recovery-requests"] {
        let c = Case::new();
        let d = c.roots.root.mkdir(name).unwrap();
        write(&d, "existing.json", b"{}", 0o600);
        assert!(
            fixture::prepare(
                &c.roots,
                &c.guard,
                &c.fresh,
                &key("local-authority", "fresh"),
                &key(PRODUCER, "fresh"),
                bindings()
            )
            .is_err(),
            "{name}"
        );
    }
}

#[test]
fn pre_entropy_validation_is_read_only_and_requires_pristine_state() {
    let c = Case::new();
    let names = c.roots.root.names().unwrap();
    fixture::validate_pristine(&c.roots, &c.guard).unwrap();
    assert_eq!(names, c.roots.root.names().unwrap());
    write(&c.roots.root, "queue.db", b"existing", 0o600);
    assert!(fixture::validate_pristine(&c.roots, &c.guard).is_err());
}
