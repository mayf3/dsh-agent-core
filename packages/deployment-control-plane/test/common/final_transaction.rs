use super::*;
use crate::{common::*, transaction::test_fixture as fixture};
#[test]
fn final_prewrite_expiry_releases_active_with_durable_blocked() {
    let (_tmp, roots, q, c, id) = fixture::prepared();
    let mut e = Executor::fixture(&roots).unwrap();
    let guard = roots.lock().unwrap();
    e.gate_time = Some(1300);
    let err = e
        .apply(
            &guard,
            &q,
            &c,
            &id,
            &signed("authority", policy()),
            1000,
            "caller",
        )
        .err()
        .unwrap();
    assert_eq!(err.code(), "POLICY_EXPIRED");
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Blocked);
    assert!(e.active.is_none());
    assert_eq!(q.daemon_status(&id).unwrap().mutating_attempts, 0);
    assert_eq!(
        e.target.read("main.js").unwrap().unwrap().bytes,
        b"old code"
    );
    assert!(e
        .journals
        .names()
        .unwrap()
        .iter()
        .all(|n| Journal::load(&e.journals, n).unwrap().terminal()));
    let mut evidence = e.recovery_binding(&guard, &q, &id).unwrap();
    evidence.issued_at = 1300;
    evidence.remediation_digest = "1".repeat(64);
    let mut current = policy();
    current.epoch = 2;
    current.issued_at = 1300;
    current.expires_at = 1500;
    let current = signed("authority", current);
    e.consume_recovery(
        &guard,
        &q,
        &c,
        &signed("recovery", evidence),
        &current,
        1300,
    )
    .unwrap();
    e.gate_time = None;
    e.apply(&guard, &q, &c, &id, &current, 1300, "caller")
        .unwrap();
    e.rollback(&guard, &q, &id).unwrap();
}
#[test]
fn known_final_health_failure_restores_without_closure() {
    let (_tmp, roots, q, c, id) = fixture::prepared();
    let mut e = Executor::fixture(&roots).unwrap();
    let guard = roots.lock().unwrap();
    let applied = e
        .apply(
            &guard,
            &q,
            &c,
            &id,
            &signed("authority", policy()),
            1000,
            "caller",
        )
        .unwrap();
    q.record_goal(
        &c,
        &signed(
            "verifier",
            GoalReceipt {
                unit_id: id.clone(),
                goal_id: "goal".into(),
                acceptance_revision: "accept-1".into(),
                target_generation: 1,
                attempt: 1,
                service_generation: applied.receipt.new_service_generation,
                attachment_digest: applied.receipt.attachment_digests[0].clone(),
                outcome: GoalOutcome::Pass,
                evidence_digest: "a".repeat(64),
                revision: 1,
            },
        ),
    )
    .unwrap();
    e.fail_finalize_health = Some("HEALTH_FAILED");
    assert_eq!(
        e.finalize(&guard, &q, &id).unwrap_err().code(),
        "HEALTH_FAILED"
    );
    assert_eq!(q.daemon_status(&id).unwrap().state, State::RolledBack);
    assert_eq!(
        e.target.read("main.js").unwrap().unwrap().bytes,
        b"old code"
    );
    assert!(q.outbox(&actor()).unwrap().is_empty());
    assert!(e.active.is_none());
}

fn mapping(e: &mut Executor) {
    let old = e.target.read("main.js").unwrap().unwrap();
    e.slots = Some(vec![EnrolledFile {
        path: "main.js".into(),
        sha256: Some(crate::fs::file::sha(&old.bytes)),
        mutable: true,
        mode: old.mode,
        gid: old.gid,
    }]);
}
#[test]
fn manifest_cannot_expand_protected_mapping() {
    let (_tmp, roots, q, c, id) = fixture::prepared_paths(&["main.js", "extra.js"]);
    let mut e = Executor::fixture(&roots).unwrap();
    mapping(&mut e);
    let guard = roots.lock().unwrap();
    let result = e.apply(
        &guard,
        &q,
        &c,
        &id,
        &signed("authority", policy()),
        1000,
        "caller",
    );
    assert_eq!(result.err().unwrap().code(), "UNDECLARED_SLOT");
    assert_eq!(
        e.target.read("extra.js").unwrap().unwrap().bytes,
        b"old code"
    );
}

#[test]
fn exact_slots_retain_private_mode_and_complete_unchanged_face() {
    use std::os::unix::fs::PermissionsExt;
    let (tmp, roots, q, c, id) = fixture::prepared();
    std::fs::set_permissions(
        tmp.path().join("target/main.js"),
        std::fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    std::fs::write(tmp.path().join("target/retained.js"), b"unchanged").unwrap();
    let mut e = Executor::fixture(&roots).unwrap();
    mapping(&mut e);
    let retained = e.target.read("retained.js").unwrap().unwrap();
    e.slots.as_mut().unwrap().push(EnrolledFile {
        path: "retained.js".into(),
        sha256: Some(crate::fs::file::sha(&retained.bytes)),
        mutable: false,
        mode: retained.mode,
        gid: retained.gid,
    });
    let guard = roots.lock().unwrap();
    e.apply(
        &guard,
        &q,
        &c,
        &id,
        &signed("authority", policy()),
        1000,
        "caller",
    )
    .unwrap();
    assert_eq!(e.target.read("main.js").unwrap().unwrap().mode, 0o600);
    let applied = e
        .active
        .as_ref()
        .unwrap()
        .events
        .iter()
        .find_map(|event| match event {
            journal::Event::Verified { receipt } => Some(receipt.clone()),
            _ => None,
        })
        .unwrap();
    q.record_goal(
        &c,
        &signed(
            "verifier",
            GoalReceipt {
                unit_id: id.clone(),
                goal_id: "goal".into(),
                acceptance_revision: "accept-1".into(),
                target_generation: 1,
                attempt: 1,
                service_generation: applied.new_service_generation,
                attachment_digest: applied.attachment_digests[0].clone(),
                outcome: GoalOutcome::Pass,
                evidence_digest: "a".repeat(64),
                revision: 1,
            },
        ),
    )
    .unwrap();
    e.finalize(&guard, &q, &id).unwrap();
    e.verify_live_baseline(&q, "runtime").unwrap();
    std::fs::write(tmp.path().join("target/retained.js"), b"drift").unwrap();
    assert_eq!(
        e.verify_live_baseline(&q, "runtime").unwrap_err().code(),
        "PREIMAGE_DRIFT"
    );
}
#[test]
fn metadata_executable_and_absent_sibling_reject_before_write() {
    for case in 0..4 {
        let (tmp, roots, q, c, id) = fixture::prepared_paths(&["main.js", "extra.js"]);
        let mut e = Executor::fixture(&roots).unwrap();
        mapping(&mut e);
        match case {
            0 => std::fs::remove_file(tmp.path().join("target/extra.js")).unwrap(),
            1 => e.slots.as_mut().unwrap()[0].mode = 0o755,
            2 => e.slots.as_mut().unwrap()[0].gid += 100,
            _ => std::fs::write(tmp.path().join("target/main.js"), b"drift").unwrap(),
        }
        // Extra path rejection precedes all service or target actions.
        let guard = roots.lock().unwrap();
        assert!(e
            .apply(
                &guard,
                &q,
                &c,
                &id,
                &signed("authority", policy()),
                1000,
                "caller"
            )
            .is_err());
        assert_eq!(q.daemon_status(&id).unwrap().mutating_attempts, 0);
        assert!(e.service.image().unwrap().processes.is_empty());
    }
}
#[test]
fn exact_mapping_rejects_metadata_drift_and_allows_explicit_absent_addition() {
    for case in 0..4 {
        let (tmp, roots, q, c, id) = fixture::prepared();
        let mut e = Executor::fixture(&roots).unwrap();
        mapping(&mut e);
        match case {
            0 => e.slots.as_mut().unwrap()[0].gid += 100,
            1 => e.slots.as_mut().unwrap()[0].mode = 0o600,
            2 => e.slots.as_mut().unwrap()[0].mode = 0o755,
            _ => {
                e.slots.as_mut().unwrap()[0].sha256 = None;
                std::fs::remove_file(tmp.path().join("target/main.js")).unwrap();
            }
        }
        let guard = roots.lock().unwrap();
        let result = e.apply(
            &guard,
            &q,
            &c,
            &id,
            &signed("authority", policy()),
            1000,
            "caller",
        );
        if case == 3 {
            result.unwrap();
            e.rollback(&guard, &q, &id).unwrap();
            assert!(e.target.read("main.js").unwrap().is_none());
        } else {
            assert!(result.is_err());
            assert_eq!(q.daemon_status(&id).unwrap().mutating_attempts, 0);
        }
    }
}

#[test]
fn known_final_health_timeout_restores() {
    let (_tmp, roots, q, c, id) = fixture::prepared();
    let mut e = Executor::fixture(&roots).unwrap();
    let guard = roots.lock().unwrap();
    e.apply(
        &guard,
        &q,
        &c,
        &id,
        &signed("authority", policy()),
        1000,
        "caller",
    )
    .unwrap();
    e.fail_finalize_health = Some("HEALTH_TIMEOUT");
    assert_eq!(
        e.finalize(&guard, &q, &id).unwrap_err().code(),
        "HEALTH_TIMEOUT"
    );
    assert_eq!(q.daemon_status(&id).unwrap().state, State::RolledBack);
    assert_eq!(
        e.target.read("main.js").unwrap().unwrap().bytes,
        b"old code"
    );
}
#[test]
fn no_mutation_fsync_worker_preserves_recovery_fence() {
    let Ok(root) = std::env::var("DCP_NO_MUTATION_ROOT") else {
        return;
    };
    let roots = crate::fs::FixtureRoots::open(std::path::Path::new(&root)).unwrap();
    let q = crate::queue::Queue::open(std::path::Path::new(&root).join("queue.db")).unwrap();
    let id = std::env::var("DCP_NO_MUTATION_UNIT").unwrap();
    let mut e = Executor::fixture(&roots).unwrap();
    e.gate_time = Some(1300);
    let guard = roots.lock().unwrap();
    let result = e.apply(
        &guard,
        &q,
        &fixture_catalog(),
        &id,
        &signed("authority", policy()),
        1000,
        "caller",
    );
    assert_eq!(result.err().unwrap().code(), "FILESYSTEM_IO");
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Precheck);
    assert!(e.active.is_some());
    assert_eq!(q.daemon_status(&id).unwrap().mutating_attempts, 0);
    assert!(q.next_ready(&fixture_catalog()).unwrap().is_none());
}
#[test]
fn no_mutation_failed_flush_never_reports_safe_blocked() {
    let (tmp, _roots, _q, _c, id) = fixture::prepared();
    let status = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "transaction::final_repair_tests::no_mutation_fsync_worker_preserves_recovery_fence",
        ])
        .env("DCP_NO_MUTATION_ROOT", tmp.path())
        .env("DCP_NO_MUTATION_UNIT", id)
        .env("DCP_TEST_FAULT_RECORD", "000002.json")
        .env("DCP_TEST_RECORD_FAULT", "fsync")
        .status()
        .unwrap();
    assert!(status.success());
}
