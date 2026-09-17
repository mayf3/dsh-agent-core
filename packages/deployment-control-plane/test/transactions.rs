#[allow(dead_code)]
mod common;
use common::*;
use deployment_control_plane::{fs::FixtureRoots, model::*, transaction::Executor};
use std::fs;
mod transaction_fixture;
use transaction_fixture::prepared;
#[test]
fn apply_keeps_guard_and_correlates_process_attempt_and_full_evidence() {
    let (tmp, roots, q, c, id) = prepared();
    let mut executor = Executor::fixture(&roots).unwrap();
    let guard = roots.lock().unwrap();
    let applied = executor
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
    assert_eq!(
        fs::read(tmp.path().join("target/main.js")).unwrap(),
        b"new code"
    );
    assert!(roots.lock().is_err());
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Verifying);
    assert_eq!(applied.receipt.attempt, 1);
    assert_ne!(
        applied.receipt.old_service_generation,
        applied.receipt.new_service_generation
    );
    assert_eq!(applied.receipt.attachment_digests.len(), 1);
    executor.rollback(&guard, &q, &id).unwrap();
    assert_eq!(
        fs::read(tmp.path().join("target/main.js")).unwrap(),
        b"old code"
    );
    assert_eq!(q.daemon_status(&id).unwrap().state, State::RolledBack);
}
#[test]
fn unrelated_post_apply_drift_quarantines_and_preserves_bytes() {
    let (tmp, roots, q, c, id) = prepared();
    let mut executor = Executor::fixture(&roots).unwrap();
    let guard = roots.lock().unwrap();
    executor
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
    fs::write(tmp.path().join("target/main.js"), b"unrelated").unwrap();
    assert!(executor.rollback(&guard, &q, &id).is_err());
    assert_eq!(
        fs::read(tmp.path().join("target/main.js")).unwrap(),
        b"unrelated"
    );
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Quarantined);
    assert!(q.next_ready(&c).unwrap().is_none());
}

#[test]
fn launchd_periodic_parser_does_not_confuse_nested_pid_with_generation() {
    let text="system/ai.agent-core.scheduler-watchdog-w1 = {\n\tstate = not running\n\tprogram = /fixed/node\n\truns = 9\n\tlast exit code = 0\n\tenvironment = {\n\t\tpid = 77\n\t}\n}";
    let parsed = deployment_control_plane::transaction::parse_launchd(text).unwrap();
    assert_eq!(parsed["state"], "not running");
    assert!(!parsed.contains_key("pid"));
    assert!(deployment_control_plane::transaction::parse_launchd(
        "\tstate = running\n\tstate = not running\n\tprogram = /node"
    )
    .is_err());
}
#[test]
fn finalize_joins_goal_receipt_to_attempt_and_process() {
    let (_tmp, roots, q, c, id) = prepared();
    let mut executor = Executor::fixture(&roots).unwrap();
    let guard = roots.lock().unwrap();
    let applied = executor
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
    let a = q.daemon_attachments(&id).unwrap();
    let receipt = GoalReceipt {
        unit_id: id.clone(),
        goal_id: "goal".into(),
        acceptance_revision: "accept-1".into(),
        target_generation: 1,
        attempt: 1,
        service_generation: applied.receipt.new_service_generation.clone(),
        attachment_digest: a[0].digest.clone(),
        outcome: GoalOutcome::Pass,
        evidence_digest: "e".repeat(64),
        revision: 1,
    };
    q.record_goal(&c, &signed("verifier", receipt)).unwrap();
    let hash = executor.finalize(&guard, &q, &id).unwrap();
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Applied);
    assert!(q
        .receipt(&actor(), &hash)
        .unwrap()
        .contains(&applied.receipt.new_service_generation));
    assert_eq!(q.outbox(&actor()).unwrap().len(), 1);
    assert!(roots.lock().is_err());
}
#[test]
fn a_different_fixture_mutex_cannot_authorize_apply() {
    let (_tmp, roots, q, c, id) = prepared();
    let other = common::private::temp();
    fs::set_permissions(
        other.path(),
        <std::fs::Permissions as std::os::unix::fs::PermissionsExt>::from_mode(0o700),
    )
    .unwrap();
    let other_roots = FixtureRoots::open(&fs::canonicalize(other.path()).unwrap()).unwrap();
    let guard = other_roots.lock().unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    assert_eq!(
        executor
            .apply(
                &guard,
                &q,
                &c,
                &id,
                &signed("authority", policy()),
                1000,
                "caller"
            )
            .err()
            .unwrap()
            .code(),
        "WRONG_MUTEX"
    );
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Queued);
}
#[test]
fn rebooted_executor_never_replays_unfinished_verification() {
    let (tmp, roots, q, c, id) = prepared();
    let guard = roots.lock().unwrap();
    {
        let mut executor = Executor::fixture(&roots).unwrap();
        executor
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
    }
    let mut recovered = Executor::fixture(&roots).unwrap();
    assert_eq!(recovered.recover(&guard, &q).unwrap(), vec![id.clone()]);
    assert_eq!(q.daemon_status(&id).unwrap().state, State::Quarantined);
    assert_eq!(
        fs::read(tmp.path().join("target/main.js")).unwrap(),
        b"new code"
    );
    assert!(q.next_ready(&c).unwrap().is_none());
}

#[test]
fn partial_install_disk_failure_restores_exact_preimage_without_unrelated_writes() {
    use std::os::unix::fs::PermissionsExt;
    let (tmp, roots, q, c, id) = transaction_fixture::prepared_paths(&["main.js", "config.json"]);
    fs::set_permissions(
        tmp.path().join("target/main.js"),
        fs::Permissions::from_mode(0o440),
    )
    .unwrap();
    // A preexisting conflicting reserved temp is an actual O_EXCL failure, not a boolean mock.
    fs::write(
        tmp.path()
            .join("target")
            .join(format!("dcp-{}-1", &id[..16])),
        b"unrelated sentinel",
    )
    .unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let guard = roots.lock().unwrap();
    assert!(executor
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
    assert_eq!(q.daemon_status(&id).unwrap().state, State::RolledBack);
    assert_eq!(
        fs::read(tmp.path().join("target/main.js")).unwrap(),
        b"old code"
    );
    assert_eq!(
        fs::read(
            tmp.path()
                .join("target")
                .join(format!("dcp-{}-1", &id[..16]))
        )
        .unwrap(),
        b"unrelated sentinel"
    );
    assert_eq!(
        fs::metadata(tmp.path().join("target/main.js"))
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o440
    );
}

#[test]
fn rollback_deletes_only_exact_transaction_created_absent_slot() {
    let (tmp, roots, q, c, id) = transaction_fixture::prepared_paths(&["main.js", "added.js"]);
    fs::remove_file(tmp.path().join("target/added.js")).unwrap();
    let mut executor = Executor::fixture(&roots).unwrap();
    let guard = roots.lock().unwrap();
    executor
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
    assert_eq!(
        fs::read(tmp.path().join("target/added.js")).unwrap(),
        b"new code"
    );
    executor.rollback(&guard, &q, &id).unwrap();
    assert!(!tmp.path().join("target/added.js").exists());
    assert_eq!(
        fs::read(tmp.path().join("target/main.js")).unwrap(),
        b"old code"
    );
}
mod restored_generation;
