use crate::{common::*, installed, transition};
use deployment_control_plane::{model::*, trust::digest};
use rusqlite::Connection;

// Fail-closed negatives for the three PREIMAGE_MISMATCH sites:
// admission::resolve_intent, gates::validate_with_predecessor (non-Applied
// branch), receipts::finalize. Each asserts the exact error code and that the
// refused call leaves the durable state untouched.

#[test]
fn admission_refuses_stale_expected_generation_with_zero_mutation() {
    let (dir, q, c) = setup();
    let mut p = proposal("req", "e", 1, "goal");
    p.desired.payload.expected_target_generation = 1;
    p.desired = signed("authority", p.desired.payload);
    register(&q, &c, &p);
    assert_eq!(
        q.submit(&c, &actor(), &p, 1001).unwrap_err().code(),
        "PREIMAGE_MISMATCH"
    );
    assert_eq!(q.unit_count().unwrap(), 0);
    assert_eq!(q.install_intents_for_target("runtime").unwrap(), 0);
    let db = Connection::open(dir.path().join("queue.db")).unwrap();
    let requests: u64 = db
        .query_row("SELECT count(*) FROM requests", [], |r| r.get(0))
        .unwrap();
    assert_eq!(requests, 0, "refused submit must not persist a request");
}

#[test]
fn gates_refuse_preimage_drift_before_apply() {
    let (_dir, q, c) = setup();
    let p1 = proposal("req-1", "e", 1, "goal-1");
    register(&q, &c, &p1);
    let first = q.submit(&c, &actor(), &p1, 1001).unwrap();
    let revision = q.status(&actor(), &first.unit_id).unwrap().revision;
    q.cancel_pending(&actor(), &first.unit_id, revision)
        .unwrap();

    // Advance the live generation to 1 without the first unit ever reaching
    // Applied: a second desired revision installs while the stale unit waits.
    let p2 = proposal("req-2", "f", 2, "goal-2");
    register(&q, &c, &p2);
    let second = q.submit(&c, &actor(), &p2, 1001).unwrap();
    installed(&q, &c, &second.unit_id, 1);

    // The stale unit is not Applied, so revalidation must take the
    // PREIMAGE_MISMATCH branch, not the Applied-only INSTALLED_GENERATION_CHANGED.
    let revision = q.status(&actor(), &first.unit_id).unwrap().revision;
    assert_eq!(
        q.begin_apply(
            &c,
            &first.unit_id,
            revision,
            &p1.policy,
            1001,
            &"8".repeat(64)
        )
        .unwrap_err()
        .code(),
        "PREIMAGE_MISMATCH"
    );
    assert_eq!(
        q.status(&actor(), &first.unit_id).unwrap().state,
        State::Cancelled
    );
}

#[test]
fn receipts_refuse_stale_generation_at_finalize() {
    let (dir, q, c) = setup();
    let p1 = proposal("req-1", "e", 1, "goal-1");
    register(&q, &c, &p1);
    let first = q.submit(&c, &actor(), &p1, 1001).unwrap();
    installed(&q, &c, &first.unit_id, 1);

    let mut p2 = proposal("req-2", "f", 2, "goal-2");
    p2.desired.payload.expected_target_generation = 1;
    p2.desired = signed("authority", p2.desired.payload);
    register(&q, &c, &p2);
    let second = q.submit(&c, &actor(), &p2, 1001).unwrap();
    for state in [
        State::Precheck,
        State::Applying,
        State::Restarting,
        State::Verifying,
        State::Finalizing,
    ] {
        transition(&q, &second.unit_id, state);
    }

    let status = q.status(&actor(), &second.unit_id).unwrap();
    let u = &status.unit;
    let receipt = TransactionReceipt {
        unit_id: second.unit_id.clone(),
        artifact_sha256: u.artifact_sha256.clone(),
        source_sha: u.source_sha.clone(),
        profile_revision: u.profile_revision.clone(),
        policy_digest: digest(&p2.policy).unwrap(),
        review_digests: u.required_reviews.clone(),
        caller: "caller".into(),
        dependency_receipts: vec![],
        preimage_digest: "1".repeat(64),
        postimage_digest: "2".repeat(64),
        old_service_generation: "old".into(),
        new_service_generation: "new".into(),
        target_generation: u.expected_target_generation + 1,
        attempt: status.mutating_attempts,
        attachment_digests: vec![
            q.submit(
                &c,
                &actor(),
                &q.daemon_evidence(&second.unit_id).unwrap(),
                1001,
            )
            .unwrap()
            .attachment_digest,
        ],
        step_results: vec!["readback-pass".into()],
        rollback_digest: None,
        capability: "installed".into(),
    };
    q.record_transaction(&receipt).unwrap();

    // The live generation races past the unit's expected preimage after the
    // trusted transaction receipt was recorded but before it claims Applied.
    let db = Connection::open(dir.path().join("queue.db")).unwrap();
    db.execute(
        "UPDATE installed SET generation=9 WHERE target='runtime'",
        [],
    )
    .unwrap();

    let revision = q.status(&actor(), &second.unit_id).unwrap().revision;
    assert_eq!(
        q.transition(&second.unit_id, revision, State::Applied, &"8".repeat(64))
            .unwrap_err()
            .code(),
        "PREIMAGE_MISMATCH"
    );
    assert_eq!(
        q.status(&actor(), &second.unit_id).unwrap().state,
        State::Finalizing
    );
}
